# Spécification du bytecode EnergyLab (v1)

Ce document est la **référence commune** entre :

- le compilateur de blocs (navigateur, `web/src/40_compiler.js`) ;
- la machine virtuelle JavaScript (simulateur / jumeau numérique, `web/src/30_vm.js`) ;
- la machine virtuelle C++ du kit ESP32 (`firmware/src/vm.cpp`).

Les deux machines virtuelles doivent produire **exactement** les mêmes actions pour le
même programme et les mêmes mesures (vérifié par `tests/js/crossvalidate.js`).

## 1. Format du programme (JSON)

```json
{
  "fmt": "elab-bc", "v": 1,
  "name": "Délestage",
  "code": "31 0 1 1500 18 5 12 ...",
  "scripts": [ {"type": 0, "entry": 0}, {"type": 1, "entry": 9, "period": 5} ],
  "vars": ["seuil", "compteur"],
  "strs": ["Surcharge !"],
  "hash": "a1b2c3"
}
```

- `code` : suite de nombres séparés par des espaces (opcodes et opérandes).
  Un seul tableau pour tous les scripts. Taille max : 4096 nombres.
- `scripts` (max 32) :

| type | événement | champs |
|---|---|---|
| 0 | au démarrage du programme | `entry` |
| 1 | toutes les `period` secondes (1er déclenchement immédiat) | `entry`, `period` (≥ 0,1) |
| 2 | quand la condition devient vraie (front montant) | `entry`, `cond` (adresse d'une expression terminée par END) |
| 3 | chaque jour à `h`:`m` (heure locale du kit) | `entry`, `h`, `m` |
| 4 | quand le bouton virtuel `btn` est appuyé | `entry`, `btn` (1..4) |

- `vars` : noms des variables (max 64). Toutes globales, initialisées à 0. Les variables
  internes du compilateur (compteurs de boucles) commencent par `#`.
- `strs` : textes (max 64, 80 caractères max chacun).

## 2. Valeurs

Tous les nombres sont des flottants double précision (IEEE 754).
Vrai = 1, faux = 0. Une valeur est **vraie** si elle est différente de 0 **et** n'est pas NaN.
Un capteur absent renvoie NaN (affiché « -- »). Toute comparaison avec NaN est fausse.

## 3. Jeu d'instructions

`a b → r` : la VM dépile `b` puis `a` et empile `r`.

| op | nom | opérande | pile | sémantique |
|---|---|---|---|---|
| 0 | END | – | – | fin du script (ou de l'expression) |
| 1 | PUSH | k | → k | constante |
| 2 | LOAD | v | → vars[v] | lire variable |
| 3 | STORE | v | a → | vars[v] = a |
| 4 | JMP | adr | – | saut |
| 5 | JZ | adr | c → | saut si c est faux |
| 6 | JNZ | adr | c → | saut si c est vrai |
| 7 | WAIT | – | s → | attendre s secondes (0 ≤ s ≤ 604800) puis reprendre (au plus tôt au tic suivant) |
| 8 | YIELD | – | – | point de rendu de boucle (voir §4) |
| 9 | POP | – | a → | |
| 10–14 | ADD SUB MUL DIV MOD | – | a b → r | DIV : b = 0 → 0 ; MOD : b = 0 → 0 sinon a − b·⌊a/b⌋ |
| 15 | NEG | – | a → −a | |
| 16–21 | LT LE GT GE EQ NE | – | a b → 0/1 | comparaisons IEEE |
| 22 | AND | – | a b → 0/1 | vrai(a) et vrai(b) |
| 23 | OR | – | a b → 0/1 | |
| 24 | NOT | – | a → 0/1 | |
| 25 | FN | f | a → f(a) | 0 abs, 1 arrondi ⌊a+0,5⌋, 2 plancher, 3 plafond, 4 racine, 5 carré |
| 26 | MIN | – | a b → r | |
| 27 | MAX | – | a b → r | |
| 28 | RAND | – | a b → r | aléatoire (xorshift32) ; entiers si a et b entiers |
| 29 | BETWEEN | – | x a b → 0/1 | min(a,b) ≤ x ≤ max(a,b) |
| 30 | SENS | q | k → val | grandeur q de la prise k (tableau §5) |
| 31 | SENSG | q | → val | grandeur globale q (tableau §6) |
| 32 | PARGET | p | k → val | paramètre p (k ignoré pour un paramètre global) |
| 33 | PARSET | p | k v → | régler le paramètre p (limité par le kit) |
| 34 | RELAY | – | k s → | prise k (0 = toutes) : allumer si vrai(s) sinon éteindre |
| 35 | TOGGLE | – | k → | inverser la prise k |
| 36 | PULSE | – | k s → | allumer k pendant s secondes puis éteindre |
| 37 | BEEP | n | – | 0 court, 1 long, 2 alarme, 3 succès |
| 38 | ALERT | s | – | alerte (texte strs[s]) |
| 39 | LOG | s | – | message console |
| 40 | LOGV | s | v → | message console + valeur |
| 41 | SCREEN | s | – | message sur l'écran du kit |
| 42 | RESETE | – | k → | remise à zéro du compteur d'énergie de la prise k |
| 43 | AI | q | args → val | fonction intelligente q (tableau §8) |
| 44 | SHED | – | lim → | une étape de délestage par priorités (§9) |
| 45 | STOP | s | – | 0 : ce script ; 1 : tout le programme |

Les opcodes 1–6, 25, 30–33, 37–41, 43, 45 ont **un** opérande ; les autres aucun.
Les indices de prise sont arrondis par ⌊k + 0,5⌋.

## 4. Ordonnancement

- La VM est appelée par « tics » (100 ms sur le kit et en simulation temps réel ;
  1 s dans l'arène accélérée). `now` est le temps du tic en millisecondes.
- À chaque tic :
  1. **Déclencheurs**, dans l'ordre des scripts :
     - type 1 : si `now ≥ nextFire` → démarrer le script s'il ne tourne pas ; puis
       `nextFire += period` jusqu'à `nextFire > now`. Premier `nextFire` = instant de démarrage.
     - type 2 : évaluer la condition (budget 1000 instructions) ; si vraie et fausse au tic
       précédent (état initial : faux) et script arrêté → démarrer.
     - type 3 : si l'horloge est valide, `h:m` égal et pas encore déclenché ce jour → démarrer.
     - type 4 : si un appui est en attente → démarrer (si arrêté) ; l'appui est consommé.
  2. **Exécution** des scripts actifs dont `wakeAt ≤ now`, dans l'ordre.
- Un script démarré par un déclencheur s'exécute dans le même tic.
- Un déclencheur qui survient pendant que son script tourne est **ignoré**.
- `YIELD` : si le script a exécuté ≥ 300 instructions dans ce tic, il rend la main
  (reprise au tic suivant), sinon il continue. Le compilateur place un `YIELD` à la fin de
  chaque tour de boucle.
- Limite de sécurité : 20000 instructions par tic → erreur.
- Erreurs (pile > 64, pile vide, opcode inconnu, saut invalide, condition contenant
  WAIT) → arrêt du programme avec message.
- Le programme est **terminé** quand plus aucun script ne tourne et qu'il n'existe aucun
  script de type 1 à 4.

## 5. Grandeurs d'une prise (SENS q)

| q | grandeur | unité |
|---|---|---|
| 0 | tension U | V |
| 1 | courant I | A |
| 2 | puissance active P | W |
| 3 | puissance apparente S = U·I | VA |
| 4 | puissance réactive Q = √(S² − P²) | var |
| 5 | facteur de puissance | – |
| 6 | fréquence | Hz |
| 7 | compteur d'énergie du capteur | kWh |
| 8 | énergie aujourd'hui | Wh |
| 9 | coût aujourd'hui | monnaie |
| 10 | relais allumé | 0/1 |
| 11 | capteur en ligne | 0/1 |
| 12 | protection déclenchée | 0/1 |
| 13 | déphasage φ = arccos(FP) | ° |
| 14 | commutations aujourd'hui | – |

## 6. Grandeurs globales (SENSG q)

| q | grandeur |
|---|---|
| 0 | puissance totale (W) |
| 1 | énergie totale aujourd'hui (Wh) |
| 2 | coût total aujourd'hui |
| 3 | température (°C) |
| 4 | humidité (%) |
| 5 | luminosité (%) |
| 6 | présence (0/1, maintenue pendant le délai de présence) |
| 7 | heure (0–23) |
| 8 | minute |
| 9 | seconde |
| 10 | jour de la semaine (1 = lundi … 7 = dimanche) |
| 11 | heure en minutes depuis minuit |
| 12 | secondes depuis le démarrage du programme |
| 13 | heures creuses (0/1) |
| 14 | prix actuel du kWh |
| 15 | tension moyenne (V) |
| 16 | pointe de puissance totale du jour (W) |
| 17 | CO₂ émis aujourd'hui (g) |
| 18 | nombre de prises allumées |

## 7. Paramètres (PARGET / PARSET p)

Par prise (k = 1..4) :

| p | paramètre | bornes |
|---|---|---|
| 0 | puissance max (protection logicielle, W) | 10 … limite enseignant |
| 1 | seuil d'alarme interne du capteur PZEM (W) | 1 … 23000 |
| 2 | priorité (1 = la plus importante) | 1 … 4 |
| 3 | état au démarrage du kit (0 éteint, 1 allumé, 2 dernier) | 0 … 2 |
| 4 | délai minimum entre deux commutations (s) | plancher enseignant … 600 |
| 5 | seuil de veille (W) | 0 … 200 |

Globaux (k ignoré) :

| p | paramètre | bornes |
|---|---|---|
| 10 | période de mesure (ms) | 1000 … 10000 |
| 11 | lissage (nombre d'échantillons) | 1 … 10 |
| 12 | puissance souscrite (W) | 100 … 12000 |
| 13 | prix heures pleines / kWh | 0 … 100 |
| 14 | prix heures creuses / kWh | 0 … 100 |
| 15 | consigne de température (°C) | 5 … 35 |
| 16 | hystérésis (°C) | 0,1 … 5 |
| 17 | seuil de luminosité (%) | 0 … 100 |
| 18 | délai de présence (s) | 5 … 3600 |
| 19 | facteur CO₂ (g/kWh) | 0 … 2000 |
| 20 | seuil de détection d'anomalie (z) | 2 … 10 |
| 21 | k du k-plus-proches-voisins | 1 … 7 |
| 22 | début heures creuses (min depuis minuit) | 0 … 1439 |
| 23 | fin heures creuses (min depuis minuit) | 0 … 1439 |

## 8. Fonctions intelligentes (AI q)

| q | fonction | arguments | résultat |
|---|---|---|---|
| 0 | moyenne de P d'une prise | k, N (s, 1…600) | W |
| 1 | moyenne de P totale | N (s) | W |
| 2 | maximum de P totale | N (s) | W |
| 3 | tendance de P totale (régression linéaire) | N (s, 10…600) | W/min |
| 4 | prévision de P totale (lissage de Holt) | N (min, 1…120) | W |
| 5 | anomalie détectée sur la prise | k | 0/1 |
| 6 | durée d'inactivité (P ≤ seuil de veille, relais allumé) | k | s |
| 7 | appareil reconnu (k-NN) | k | 0 aucun, −1 inconnu, n ≥ 1 étiquette |

Historique : un échantillon par seconde (600 s conservées).
Holt : mis à jour toutes les 10 s sur la moyenne des 10 dernières secondes, α = 0,3, β = 0,1.
Anomalie : moyenne et variance exponentielles (α = 0,05) ; z = |P − μ| / max(σ, 2 + 0,05·μ) ;
anomalie si z > seuil pendant 3 s consécutives et P > 5 W ; le modèle n'apprend pas pendant
une anomalie.

## 9. Délestage (SHED lim)

Une étape, appelée périodiquement par le programme :

1. Si P totale > lim : parmi les prises allumées, non protégées et non déjà délestées,
   choisir la **moins prioritaire** (priorité la plus grande, puis numéro le plus grand) dont
   P > 1 W ; l'éteindre et la marquer « délestée » en mémorisant sa puissance.
2. Sinon, s'il existe des prises délestées : prendre la **plus prioritaire** ; si
   P totale + P mémorisée < 0,9 · lim, la rallumer.

Les commutations respectent toujours le délai minimum de chaque prise.

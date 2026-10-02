# 7. Les algorithmes du kit

Tous les algorithmes ci-dessous sont implémentés **deux fois, à l'identique** : en C++ dans le firmware
(`firmware/src/ai.cpp`, `kitcore.cpp`) et en JavaScript pour le jumeau numérique (`web/src/32_ai.js`,
`34_kitcore.js`). Des tests automatiques vérifient que les deux versions donnent les mêmes résultats.

## 7.1 Grandeurs électriques

Le PZEM-004T mesure U (V), I (A), P (W), l'énergie (Wh), f (Hz) et le facteur de puissance FP. Le kit en
déduit :

- puissance apparente **S = U × I** (VA) ;
- puissance réactive **Q = √(S² − P²)** (var) ;
- déphasage **φ = arccos(FP)** (°) — le capteur ne donne pas son signe (inductif ou capacitif) ;
- énergie du jour **E = Σ P·Δt** intégrée chaque seconde, **coût = E × prix(t)** avec le prix des heures
  pleines ou creuses à l'instant t, **CO₂ = E × facteur** (g/kWh).

Le **lissage** (paramètre « lissage ») est une moyenne glissante des N dernières mesures : il réduit le bruit
mais retarde la réponse. Le capteur 100 A ne détecte pas les courants inférieurs à environ 20 mA (≈ 4 W) :
pour mesurer une veille, faire passer le fil plusieurs fois dans le tore et régler « passages dans le tore ».

## 7.2 Protections (toujours actives)

- **Puissance max par prise** : deux mesures consécutives au-dessus (ou une seule au-dessus de 1,5 × max)
  → la prise est coupée et **verrouillée** jusqu'au réarmement.
- **Puissance totale du kit** (2 300 W par défaut, disjoncteur 10 A) : au-delà, la prise allumée la moins
  prioritaire est coupée (une coupure toutes les 5 s au plus) ; une prise qui vient d'être allumée et
  n'a pas encore été mesurée fait partie des candidates (c'est souvent elle qui a provoqué le dépassement).
- **Délai minimum entre commutations** : une commande trop rapide est retardée (protège relais et moteurs).

## 7.3 Délestage par priorités (bloc « délester … »)

Algorithme **glouton** appelé périodiquement avec une limite L (souvent la puissance souscrite) :

1. P_eff = somme des puissances des prises non délestées ;
2. si P_eff > L : couper la prise allumée **la moins prioritaire** (numéro de priorité le plus grand, à
   égalité la plus à droite) et retenir sa puissance P_k ; attendre 5 s avant toute autre action ;
3. sinon, pour la prise délestée **la plus prioritaire** : la rallumer si P_eff + P_k < 0,9 L (marge de
   10 % = hystérésis) ;
4. **nouvel essai** : si la marge n'est jamais suffisante (P_k mesurée pendant un pic, par exemple une
   bouilloire), la prise est tout de même rallumée après 2 min si P_eff < 0,7 L ; si elle doit être
   délestée de nouveau dans la minute, le délai suivant double (4 min, 8 min… jusqu'à 15 min) ;
5. pendant qu'une prise est délestée, un programme ne peut pas la rallumer : c'est le délestage qui le fera ;
   si le programme cesse d'appeler le délestage pendant 30 s, les prises redeviennent pilotables.

## 7.4 Régulation à hystérésis (thermostat)

Chauffer si T < consigne − h ; arrêter si T > consigne + h. Avec h petit, la température est proche de la
consigne mais le relais commute souvent ; avec h grand, moins de commutations mais plus d'écart. C'est le
compromis classique de la **régulation tout-ou-rien**.

## 7.5 Historique et statistiques

Le kit garde les **600 dernières secondes** (puissance de chaque prise, température, humidité, luminosité,
présence, état des relais). Les blocs calculent sur cet historique :

- moyenne glissante d'une prise, moyenne et maximum de la puissance totale sur N secondes ;
- **tendance** : pente de la droite des moindres carrés de la puissance totale sur N secondes,
  a = Σ(x−x̄)(y−ȳ) / Σ(x−x̄)², exprimée en W/min.

## 7.6 Prévision : lissage exponentiel double de Holt

Toutes les 10 s, la puissance totale moyenne y_t met à jour un **niveau** L et une **tendance** T :

- L_t = α·y_t + (1 − α)·(L_{t−1} + T_{t−1}), avec α = 0,3 ;
- T_t = β·(L_t − L_{t−1}) + (1 − β)·T_{t−1}, avec β = 0,1 ;
- prévision à h minutes : ŷ = L + T × 6h (6 pas de 10 s par minute), bornée à 0, horizon ≤ 120 min.

Exemple « Écrêtage de pointe prédictif » : si la prévision à 5 min dépasse la puissance souscrite, on
déleste sous 90 % de cette puissance, **avant** le dépassement.

## 7.7 Détection d'anomalie : score z en ligne

Pour chaque prise, moyenne μ et variance v **exponentielles** (a = 0,05) :
μ ← μ + a·(p − μ) ; v ← (1 − a)·(v + a·(p − μ)²).
Score **z = |p − μ| / max(√v, 2 + 0,05·|μ|)** (le plancher évite les fausses alertes sur un signal très
stable). Anomalie si z dépasse le seuil (4 par défaut) pendant 3 mesures consécutives ; si la nouvelle
situation dure (60 mesures), elle devient la nouvelle normale (**apprentissage en ligne**).

## 7.8 Reconnaissance d'appareils : k plus proches voisins (k-NN)

- **Exemples** : l'apprenant branche un appareil, lui donne un nom et clique « Apprendre » ; le kit
  enregistre la moyenne des 5 dernières mesures (P, FP). Jusqu'à 16 appareils et 60 exemples.
- **Distance** entre deux mesures : d = √( ((log₁₀P₁ − log₁₀P₂)/0,12)² + ((FP₁ − FP₂)/0,08)² ).
  Le logarithme rend la distance relative (9 W et 12 W sont aussi « loin » que 900 W et 1 200 W) ; les
  échelles 0,12 et 0,08 équilibrent les deux caractéristiques.
- **Décision** : les k exemples les plus proches (k = 3 par défaut) votent ; si le plus proche est à une
  distance supérieure au seuil (2 par défaut), l'appareil est déclaré **inconnu**. Si P < 1 W : aucun
  appareil.
- **Limites** à discuter : deux appareils de même puissance et même FP sont confondus ; un appareil à
  plusieurs régimes (lave-linge) nécessite plusieurs exemples ; l'IA ne « comprend » rien, elle compare.

L'onglet IA affiche le nuage de points (log P, FP), les voisins retenus et leur distance : l'algorithme est
transparent.

## 7.9 L'arène : évaluer des algorithmes sur une journée simulée

Le **jumeau numérique** simule 24 h (pas de 1 s) d'une maison : habitudes des occupants (présence,
appareils allumés à certaines heures, oublis), météo (température extérieure sinusoïdale), lumière du jour,
modèles d'appareils (bouilloire et micro-ondes minutés, convecteur, réfrigérateur à cycles, chauffe-eau
100 L avec puisages, lave-linge à programme, veilles…), thermique de la pièce
(dT/dt = (T_ext − T)/(R·C) + P_chauffage/C, R = 0,03 °C/W, C = 2·10⁶ J/°C) et capteurs PZEM (seuil de
20 mA, quantification).

Trois scénarios : **Journée d'hiver en famille** (heures pleines/creuses, 2 500 W souscrits), **Soirée de
pointe** (2 500 W), **Consommations cachées** (été, veilles, éclairage oublié).

Indicateurs calculés pour chaque algorithme : énergie (kWh), **coût**, **pointe** (moyenne sur 1 min),
minutes au-dessus de la puissance souscrite, **service non rendu** (appareil voulu mais coupé), **inconfort
thermique** (°C·h sous consigne − 1 °C en présence), douches froides (eau < 40 °C), réfrigérateur trop
chaud, nombre de commutations, CO₂, lave-linge terminé. Aucun algorithme n'est le meilleur partout : c'est
l'occasion de débattre des **compromis**.

Résultats de référence (journée d'hiver) obtenus avec les exemples fournis :

| Algorithme | Coût | Pointe | Dépassements | Remarque |
|---|---|---|---|---|
| Aucun | référence | 4 357 W | 24 min | |
| Délestage par priorités | −3 % | 2 451 W | 0 | 1 min de service perdu |
| Heures creuses | −20 % | 4 450 W | 56 min | une douche froide, effet rebond à 22 h |
| Heures creuses + préchauffage | −7 % | 4 450 W | 56 min | plus de douche froide |
| Thermostat à hystérésis | −25 % | 4 357 W | 24 min | chauffage coupé en l'absence : pièce froide au retour (inconfort) |

Une solution de référence du **défi final** (thermostat la nuit, chauffage libre avant le départ des
occupants, heures creuses avec relance l'après-midi) obtient −23 % sans douche froide ni perte de confort :
voir `tests/js/arena_test.js`, qui vérifie automatiquement que le défi reste réalisable.

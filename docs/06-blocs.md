# 6. Référence des blocs

Les programmes se construisent avec des blocs, comme dans Scratch. Un programme est un ensemble de
**scripts** ; chaque script commence par un bloc **Événement** et s'exécute **en parallèle** des autres.
Le programme est compilé en **bytecode** puis exécuté par une petite machine virtuelle sur le kit (ou dans
le simulateur) : il ne peut pas bloquer le kit, et les **limites de sécurité** s'appliquent toujours.

## Événements (jaune)

| Bloc | Rôle |
|---|---|
| ▶ quand le programme démarre | une seule fois, au démarrage |
| ⏱ toutes les N secondes | périodiquement (la première fois dès le démarrage) |
| ⚡ quand ⟨condition⟩ devient vrai | à l'instant où la condition passe de faux à vrai (front montant) |
| 🕐 chaque jour à H h M | chaque jour à l'heure indiquée (horloge du kit) |
| 🔘 quand on appuie sur le bouton A/B/C/D | boutons virtuels de la console de l'éditeur |

## Contrôle (orange)

attendre N secondes · répéter N fois · répéter indéfiniment · si … alors · si … alors … sinon ·
tant que … · répéter jusqu'à ce que … · attendre jusqu'à ce que … · arrêter ce script / tout le programme.

> Dans une boucle, ajoutez toujours un « attendre » : le kit cède la main automatiquement, mais une boucle
> sans attente commande les prises beaucoup trop vite (le délai entre commutations les protège).

## Opérateurs (vert)

comparaison (`>`, `<`, `≥`, `≤`, `=`, `≠`) · et / ou · non · vrai / faux · `+ − × ÷` et modulo ·
min / max · valeur absolue, arrondi, partie entière, arrondi supérieur, racine carrée, carré ·
« est entre … et … » · nombre aléatoire. Une mesure absente (`--`) rend une comparaison fausse ; la
division par zéro donne 0.

## Variables

Créer une variable, la fixer, l'augmenter de… Les valeurs sont visibles en direct dans le panneau
*Variables* de l'éditeur.

## Mesures (bleu)

| Bloc | Valeurs disponibles |
|---|---|
| ⟨grandeur⟩ de la prise n | puissance P (W), tension U (V), courant I (A), puissance apparente S (VA), puissance réactive Q (var), facteur de puissance, déphasage φ (°), fréquence (Hz), énergie aujourd'hui (Wh), coût aujourd'hui, compteur d'énergie (kWh), commutations aujourd'hui |
| la prise n est ⟨état⟩ | allumée, éteinte, verrouillée (protection), en ligne (capteur OK) |
| ⟨grandeur de la maison⟩ | puissance totale, énergie totale du jour, coût total du jour, tension moyenne, pointe du jour, CO₂ du jour, nombre de prises allumées, prix actuel du kWh |
| température, luminosité, humidité | capteurs DHT22 et photorésistance |
| présence détectée | détecteur HC-SR501 (vrai pendant le « délai de présence » après un mouvement) |
| heure, minute, seconde, jour de la semaine, minutes depuis minuit, secondes depuis le démarrage | horloge du kit |
| l'heure est entre … et … | plage horaire (peut passer minuit) |
| heures creuses en cours | selon le tarif réglé |

## Prises (vert d'eau)

allumer / éteindre la prise n · allumer / éteindre toutes les prises · inverser la prise n ·
allumer la prise n pendant N secondes (minuterie) · mettre la prise n à l'état ⟨condition⟩.

Le délai minimum entre deux commutations est respecté (la commande est retardée si besoin). Une prise
**verrouillée** par une protection ne se rallume pas par programme. Une prise **délestée** est rallumée par
le délestage lui-même quand la puissance le permet.

## Paramètres (violet)

| Paramètres d'une prise (régler … de la prise n à …) | Paramètres du kit (régler … à …) |
|---|---|
| puissance max (protection, W) | période de mesure (ms, 1 000 à 10 000) |
| seuil d'alarme du capteur PZEM (W) | lissage (nombre de mesures moyennées) |
| priorité de délestage (1 = la plus importante) | puissance souscrite (W) |
| état au démarrage (éteinte, allumée, dernier état) | prix heures pleines / heures creuses |
| délai entre commutations (s) | consigne de température, hystérésis (°C) |
| seuil de veille (W) | seuil de luminosité (%), délai de présence (s) |
| | facteur CO₂ (g/kWh), seuil d'anomalie, k du k-NN, début et fin des heures creuses |

Les valeurs sont **bornées** par les limites de l'enseignant (le journal indique la valeur réellement
appliquée). La modification peut être interdite aux apprenants (*Réglages* > *Pédagogie*). Le bloc
« remettre à zéro le compteur de la prise n » nécessite l'autorisation de l'enseignant.

## Intelligence (rose)

| Bloc | Principe |
|---|---|
| délester par priorités pour rester sous N W | une étape de délestage : coupe la prise allumée la moins prioritaire si la limite est dépassée, rallume quand il y a de la marge (à appeler régulièrement) |
| prévision de la puissance totale dans N min | lissage exponentiel double (Holt) |
| tendance de la puissance totale sur N s (W/min) | pente de la droite de régression |
| moyenne de P de la prise n sur N s | moyenne glissante |
| moyenne / maximum de la puissance totale sur N s | statistiques sur l'historique (600 s max) |
| anomalie détectée sur la prise n | score z sur la moyenne et la variance glissantes |
| durée d'inactivité de la prise n (s) | temps passé allumée sous le seuil de veille |
| l'appareil reconnu sur la prise n est ⟨appareil⟩ | k plus proches voisins sur (log P, facteur de puissance) ; les appareils sont appris dans l'onglet IA |

Détails : [07-algorithmes.md](07-algorithmes.md).

## Alertes (magenta)

envoyer l'alerte « … » (application + écran du kit + bip) · écrire « … » dans la console · écrire « … »
suivi d'une valeur · bip court / long / alarme / succès · afficher sur l'écran du kit (10 s).

## Exemples fournis (bouton « Exemples »)

clignotant · minuterie · programmation horaire · alerte de surconsommation · délestage simple du
chauffage · délestage par priorités · écrêtage de pointe prédictif · heures creuses · heures creuses +
préchauffage · thermostat à hystérésis · tueur de veille · éclairage intelligent · détection d'anomalie ·
IA : priorité à la bouilloire · gestionnaire d'énergie complet · paramètres par programme · compteur
d'allumages (variables).

# 4. Utilisation du kit et de l'application

## 4.1 Se connecter : kit, PC et téléphones sur le même point d'accès

L'application s'exécute dans le navigateur de n'importe quel appareil (PC, tablette, téléphone) relié au
**même réseau Wi-Fi que le kit**. Elle est servie par le kit lui-même : aucune installation, aucun Internet.

| | Mode 1 — Wi-Fi du kit (par défaut) | Mode 2 — réseau existant |
|---|---|---|
| Point d'accès | le kit (`EnergyLab-XXXX`) | box/routeur de l'établissement ou partage de connexion d'un téléphone |
| Adresse | **http://192.168.4.1** (ou http://energie.lab) | adresse IP affichée sur l'écran du kit, ou **http://energylab.local** |
| Appareils | jusqu'à 8 | selon le routeur |
| Internet | non (inutile) | possible ; l'heure est alors réglée par Internet |
| Réglage | aucun | *Réglages* > *Réseau Wi-Fi* > « Rejoindre un réseau existant » + nom et mot de passe, puis redémarrer |

- Si le réseau existant est introuvable, le kit **recrée automatiquement** son propre Wi-Fi.
- Pour revenir au mode 1 à tout moment : **maintenir le bouton BOOT 6 secondes** (bip long), puis relâcher.
- Sur téléphone, si la page ne s'ouvre pas, désactivez les données mobiles (le téléphone préfère parfois
  la 4G à un Wi-Fi sans Internet).
- L'heure du kit est réglée automatiquement par le premier navigateur qui se connecte.

## 4.2 Les onglets de l'application

| Onglet | Contenu |
|---|---|
| **Maison** | plan de la maison animé, puissance totale (jauge et puissance souscrite), énergie, coût, CO₂, pointe du jour, ambiance ; une carte par prise avec interrupteur, mesures et alertes ; courbe des 10 dernières minutes ; programme en cours ; journal. |
| **Mesures** | laboratoire d'une prise : U, I, P, S, Q, FP, φ, f, énergie, coût ; **formules vivantes** (calculées avec les mesures) ; triangle des puissances ; diagramme de Fresnel ; formes d'onde reconstruites ; calcul du coût d'un appareil à l'année ; **paramètres du relais et du capteur** ; fiche de mesures comparatives exportable. |
| **Programmer** | éditeur de **blocs** (type Scratch) en français, 9 catégories ; boutons **Simuler** (maison virtuelle) et **Envoyer au kit** ; console, variables en direct, surlignage du bloc exécuté ; exemples ; enregistrement dans le navigateur ou sur le kit ; affichage du « code » produit (pseudo-code et bytecode). |
| **Missions** | 16 travaux pratiques guidés en 6 niveaux, étapes validées automatiquement par les mesures, indices adaptés au niveau de guidage, badges. |
| **IA & algorithmes** | 17 algorithmes expliqués ; **arène** : comparaison d'algorithmes sur une journée simulée (coût, pointe, confort…) ; **reconnaissance d'appareils** (k plus proches voisins) ; **prévision** (Holt) ; **anomalies** (score z). |
| **Données** | historiques (10 min, jour, 7 jours), expériences « avant / après », fichiers CSV du kit. |
| **Évaluation** | pré-test, post-test, questionnaire d'utilisabilité (SUS), motivation ; espace enseignant-chercheur avec statistiques. |
| **Réglages** | thème, profil ; en mode enseignant : prises, réseau, tarif, capteurs, sécurité, IA, pédagogie et permissions, MQTT, adressage des PZEM, maintenance. |
| **Aide & câblage** | démarrage rapide, connexion, sécurité, schémas, blocs, glossaire, FAQ. |

## 4.3 Commander les prises et régler les paramètres, sans programmer

- **Interrupteurs** (onglet Maison) : allument/éteignent la prise. Le kit impose un **délai minimum entre
  deux commutations** (2 s par défaut) pour protéger les appareils : une commande trop rapide est retardée.
- **Allumer 30 s** (onglet Mesures) : minuterie.
- **Paramètres d'une prise** (onglet Mesures) : puissance max (protection), seuil d'alarme interne du PZEM,
  délai entre commutations, seuil de veille, priorité de délestage ; et pour tout le kit : période de mesure,
  lissage, puissance souscrite. Les mêmes réglages existent en **blocs** (catégorie *Paramètres*).
- **Protection** : si une prise dépasse sa puissance max, elle est coupée et **verrouillée** ; débranchez
  l'appareil en cause puis cliquez **Réarmer**. Si la puissance totale dépasse la limite du kit (2 300 W
  par défaut), la prise la moins prioritaire est coupée.

## 4.4 Programmer avec des blocs

1. Glissez un bloc **Événement** (jaune) : « quand le programme démarre », « toutes les N secondes »,
   « quand … devient vrai », « chaque jour à … », « quand on appuie sur le bouton … ».
2. Ajoutez dedans des blocs de **contrôle**, de **mesures**, de **prises**, d'**intelligence**…
3. **Simuler** : le programme pilote la maison virtuelle (jumeau numérique), accélérable jusqu’à ×300.
4. **Envoyer au kit** : le programme est compilé et **exécuté par le kit lui-même**. Il continue si l'on
   ferme l'application ; il peut redémarrer automatiquement à la mise sous tension (case à cocher).

Les erreurs sont signalées sur les blocs concernés avant l'envoi ; pendant l'exécution, la console affiche
les messages et la valeur des variables. Référence complète : [06-blocs.md](06-blocs.md).

## 4.5 Mode enseignant et permissions

*Réglages* > **Mode enseignant** (code par défaut `1234`, à changer). L'enseignant choisit ce que les
apprenants peuvent faire : commander les prises, modifier les paramètres (dans des limites), envoyer des
programmes, remettre à zéro les compteurs, entraîner l'IA, réarmer une prise. Il règle aussi le **niveau de
guidage** des missions (fort, adaptatif, faible) — variable utile pour une étude comparative.

Les limites de sécurité (*Sécurité et matériel*) s'appliquent quoi que fassent les programmes.

## 4.6 Mode démonstration (sans kit)

Si aucun kit ne répond, l'application passe en **mode démonstration** : toutes les mesures viennent de la
maison virtuelle, on choisit l'appareil branché sur chaque prise. Idéal pour préparer une séance.

- Sur un PC, ouvrez `release/demo/index.html` dans Chrome ou Edge (aucune installation).
- Ou lancez le faux kit : `node tools/mock-kit/server.js` puis http://localhost:8080 (l'application se
  comporte exactement comme avec un vrai kit, appareils simulés).

## 4.7 MQTT, Node-RED, Home Assistant (option)

En mode « réseau existant », le kit peut publier ses mesures vers un courtier MQTT
(*Réglages* > *MQTT*). Avec le préfixe par défaut `energylab` et l'identifiant du kit `XXXX` :

| Sujet | Contenu |
|---|---|
| `energylab/XXXX/status` | `online` / `offline` (message de dernière volonté) |
| `energylab/XXXX/state` | état complet (JSON), toutes les 5 s |
| `energylab/XXXX/outlet/<n>/power` | puissance de la prise n (W) |
| `energylab/XXXX/outlet/<n>/energy` | énergie du jour (Wh) |
| `energylab/XXXX/outlet/<n>/relay` | `ON` / `OFF` (conservé) |
| `energylab/XXXX/total/power` | puissance totale (W) |
| `energylab/XXXX/outlet/<n>/set` | **commande** : `ON`, `OFF` ou `TOGGLE` |

Un flux Node-RED d'exemple est fourni : [node-red-energylab.json](node-red-energylab.json)
(menu *Importer* de Node-RED, puis indiquez l'adresse de votre courtier et l'identifiant du kit).

## 4.8 Données et fichiers

- **Journaux de mesures** : une ligne par minute et par jour, 10 jours conservés (`/log/AAAAMMJJ.csv`),
  téléchargeables dans *Données* > *Fichiers du kit*.
- **Recherche** : traces d'apprentissage (`events.csv`) et résultats des tests et questionnaires
  (`results.csv`), dans *Données* > *Fichiers du kit* (dossier `research`).
- Tous les fichiers sont au format CSV (séparateur virgule, UTF-8), lisibles par un tableur, R ou Python.

# EnergyLab — kit pédagogique IoT de gestion de l'énergie

EnergyLab est un **environnement d'apprentissage** pour enseigner la mesure et la gestion de l'énergie
électrique dans une maison, avec de la pratique réelle et sans écrire de code.

- Une **maquette d'installation domestique** : 4 prises 230 V, chacune **mesurée** (PZEM-004T v3.0 :
  U, I, P, S, Q, cos φ, f, énergie, coût) et **commandée** (relais), protégée par un différentiel 30 mA.
- Une **application web pédagogique** servie par le kit lui-même : le kit, les PC et les téléphones se
  connectent au **même point d'accès Wi-Fi** (celui du kit ou celui de l'établissement) et affichent les
  mesures en temps réel. Rien à installer.
- Une **programmation par blocs** (type Scratch, en français) pour commander les relais et régler les
  paramètres des relais et des capteurs ; le programme est compilé et **exécuté par le kit**.
- Des **algorithmes intelligents** à tester : délestage par priorités, heures creuses, thermostat à
  hystérésis, tueur de veille, prévision (Holt), détection d'anomalies (score z), **reconnaissance
  d'appareils par IA** (k plus proches voisins) — et une **arène** qui les compare sur une journée simulée.
- Un **jumeau numérique** de la maison : simulation fidèle pour tester sans risque, préparer une séance ou
  travailler sans kit (mode démonstration).
- **16 missions guidées** (6 niveaux), guidage réglable, et des **outils de recherche** : pré/post-test,
  SUS, motivation, traces d'apprentissage, statistiques (t de Student, d de Cohen, gain de Hake).

Conçu pour le projet de recherche *Development of Learning Environments for Applied Sciences Education*
(LeapSpace).

> ⚠️ **Sécurité** : le kit fonctionne en 230 V. Le câblage de la partie puissance doit être réalisé ou
> contrôlé par une personne habilitée, boîtier fermé et différentiel testé avant toute utilisation.

## Démarrer

1. **Matériel** : [docs/01-materiel.md](docs/01-materiel.md) — ESP32 DevKit V1, 4 × PZEM-004T v3.0
   100 A, module 4 relais, convertisseur de niveau, écran OLED, DHT22, LDR, HC-SR501, buzzer,
   alimentation 5 V, différentiel, prises.
2. **Flasher l'ESP32** : [docs/03-installation.md](docs/03-installation.md) — un seul fichier,
   [`release/energylab-esp32-full.bin`](release/energylab-esp32-full.bin), à l'adresse 0x0, depuis le
   navigateur (https://espressif.github.io/esptool-js/).
3. **Câbler** : [docs/02-cablage.md](docs/02-cablage.md), avec les schémas
   [basse tension](docs/img/cablage-basse-tension.svg) et [230 V](docs/img/cablage-230v.svg).
4. **Utiliser** : se connecter au Wi-Fi `EnergyLab-XXXX` (mot de passe `energie123`) et ouvrir
   **http://192.168.4.1** — [docs/04-utilisation.md](docs/04-utilisation.md).
5. **Enseigner et évaluer** : [docs/05-guide-pedagogique.md](docs/05-guide-pedagogique.md).

Sans kit : ouvrez `release/demo/index.html` dans Chrome ou Edge (mode démonstration).

## Documentation

| | |
|---|---|
| [01 — Matériel](docs/01-materiel.md) | liste du matériel et variantes |
| [02 — Câblage](docs/02-cablage.md) | guide pas à pas, schémas, adressage des capteurs, contrôles |
| [03 — Installation](docs/03-installation.md) | flashage, premier démarrage, mise à jour, compilation |
| [04 — Utilisation](docs/04-utilisation.md) | connexion, onglets, mode enseignant, MQTT / Node-RED |
| [05 — Guide pédagogique](docs/05-guide-pedagogique.md) | compétences, missions, séquence, protocole de recherche, analyse des données |
| [06 — Blocs](docs/06-blocs.md) | référence des blocs de programmation |
| [07 — Algorithmes](docs/07-algorithmes.md) | protections, délestage, Holt, score z, k-NN, arène |
| [08 — Dépannage](docs/08-depannage.md) | problèmes fréquents et solutions |
| [09 — Architecture](docs/09-architecture.md) | logiciel, API, bytecode, tests |

## Organisation du dépôt

```
firmware/   programme de l'ESP32 (PlatformIO, Arduino-ESP32)
web/        application web pédagogique (intégrée au programme lors de la compilation)
docs/       documentation et schémas
tests/      tests C++ natifs, tests JavaScript, tests de l'interface (Playwright)
tools/      faux kit pour développer sans matériel, génération des schémas
release/    fichier à flasher, fichiers séparés, démonstration hors-ligne
```

## Tests

```bash
cd tests/native && make                    # cœur du kit en C++ (VM, PZEM, IA, protections)
cd tests/js && npm install && npm test     # cœur JS, arène, validation croisée VM JS ↔ C++
node tools/mock-kit/server.js              # faux kit : http://localhost:8080
```

## Licence

Le code d'EnergyLab est la propriété de son auteur ; aucune licence n'a encore été choisie.
Les composants tiers (Blockly, bibliothèques Arduino) restent sous leurs licences respectives :
voir [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

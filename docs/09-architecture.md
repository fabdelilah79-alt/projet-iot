# 9. Architecture technique (pour les développeurs)

## 9.1 Vue d'ensemble

```
 Navigateur (PC, tablette, téléphone)                    Kit ESP32
 ┌──────────────────────────────────────┐   Wi-Fi    ┌──────────────────────────────────────────┐
 │ Application web (web/)               │  HTTP +    │ Serveur web asynchrone (webapi.cpp)       │
 │  - Blockly → compilateur → bytecode  │ WebSocket  │  - fichiers de l'appli (gzip, en flash)   │
 │  - jumeau numérique (SimKit)         │◄──────────►│  - API REST + diffusion de l'état (1 s)   │
 │  - missions, IA, données, recherche  │            │ KitCore : mesures, énergie, protections,  │
 └──────────────────────────────────────┘            │   délestage, IA, journal                  │
                                                     │ VM bytecode (vm.cpp) : programmes élèves  │
                                                     │ PZEM ×4 (Modbus RTU), relais, capteurs,   │
                                                     │ écran, buzzer, NVS + LittleFS, MQTT       │
                                                     └──────────────────────────────────────────┘
```

Principes :

- **Le kit est autonome** : il mesure, protège et exécute le programme des apprenants même sans
  navigateur connecté. L'application n'est qu'une interface.
- **Pas de code généré en C** : les blocs sont compilés en un **bytecode** compact (pile, nombres réels)
  vérifié puis interprété par une machine virtuelle à pas limités : un programme d'élève ne peut ni planter
  ni bloquer le kit, ni contourner les protections.
- **Double implémentation** du cœur (C++ sur le kit, JavaScript dans le navigateur) pour un jumeau
  numérique fidèle ; des tests de validation croisée garantissent l'identité des comportements.

## 9.2 Arborescence

| Dossier | Contenu |
|---|---|
| `firmware/` | projet PlatformIO (Arduino-ESP32) |
| `firmware/src/` | `main.cpp` (tâches, boucle), `kitcore.*` (logique du kit), `vm.*` (machine virtuelle), `pzem.*` (pilote Modbus), `relays.*`, `ai.*`, `config.*`, `storage.*` (NVS, LittleFS), `measure.*` (tâche de mesure), `net.*` (Wi-Fi, DNS, mDNS, heure), `webapi.*` (serveur), `display.*`, `buzzer.*`, `mqttbridge.*`, `pins.h` |
| `firmware/tools/` | `embed_web.py` (intègre `web/` dans le programme), `make_release.py` (binaire unique + démo) |
| `web/` | application : `index.html`, `css/app.css`, `src/*.js` (modules numérotés), `lib/blockly/` (Blockly 13.3), `img/` |
| `docs/` | documentation, schémas, [spécification du bytecode](specs/bytecode.md) |
| `tests/native/` | tests C++ (g++ sur PC) : VM, PZEM, IA, cœur du kit, sécurité |
| `tests/js/` | tests Node : cœur JS, arène, validation croisée VM JS ↔ C++ |
| `tests/e2e/` | tests de l'interface dans Chromium (Playwright) avec le faux kit |
| `tools/mock-kit/` | faux kit (Node, sans dépendance) : API et WebSocket du firmware, appareils simulés |
| `tools/diagrams/` | génération des schémas de câblage SVG |
| `release/` | binaire à flasher, fichiers séparés, démonstration hors-ligne |

Modules JavaScript (concaténés dans l'ordre en `app.js`) : `00_util`, `30_vm`, `31_config`, `32_ai`,
`33_relays`, `34_kitcore`, `35_house` (modèle physique), `37_simkit` (kit virtuel + arène), `38_realkit`
(client du vrai kit), `40_blocks`, `42_compiler`, `44_examples`, puis l'interface `50_ui` … `70_help`,
`99_main`. Blockly est chargé à la demande (`blockly.js`) à la première ouverture de l'éditeur.

## 9.3 Tâches du firmware

| Tâche | Cœur | Rôle |
|---|---|---|
| mesure | 1 | lecture des 4 PZEM (Modbus, adresses 1–4) à la période réglée, DHT22, outils PZEM |
| boucle Arduino | 1 | `tick100` (relais, VM, événements) toutes les 100 ms, `tick1s` (énergie, protections, IA), écran, bouton, sauvegardes, journaux |
| AsyncTCP | 0 | serveur web et WebSocket |
| MQTT | 0 | passerelle optionnelle |

L'état partagé est protégé par un mutex récursif. Les réglages sont dans la NVS (`elab`), le programme et
les journaux dans LittleFS (`/program.json`, `/program_ws.json`, `/log/AAAAMMJJ.csv`, `/research/*.csv`).

Table de partitions (4 Mo) : NVS 20 Ko · otadata 8 Ko · application 2,4 Mo · LittleFS 1,6 Mo.

## 9.4 API HTTP

Toutes les réponses sont en JSON (`{"ok":1,"msg":"…"}` pour les actions). Les actions réservées exigent
l'en-tête `X-Pin: <code enseignant>`. Les autres dépendent des permissions réglées par l'enseignant.

| Méthode et chemin | Rôle |
|---|---|
| `GET /api/ping` | `ok` (détection du kit) |
| `GET /api/info` | version, identifiant, réseau, mémoire, heure |
| `GET /api/state` | état compact (identique aux messages WebSocket) |
| `GET /api/config` · `POST /api/config` | réglages (secrets masqués sans code) · modification (enseignant) |
| `POST /api/cmd` | `relay`, `toggle`, `pulse`, `rearm`, `param`, `resetEnergy`, `beep`, `vbtn`, `time`, `knnClear`, `pzem`, `reboot`, `factory`, `clearLogs`, `clearResearch` |
| `GET/POST /api/program` | programme chargé · envoi du bytecode (`?start=1&save=1&autostart=0/1`) |
| `GET/POST /api/program/ws` | blocs (JSON Blockly) du programme enregistré |
| `GET /api/program/bc` | bytecode enregistré |
| `POST /api/program/ctl` | `start`, `stop`, `autostart` |
| `GET /api/history?n=600` | historique 1 s en CSV (`t,p1,p2,p3,p4,T,H,L,pr,r`) |
| `GET /api/logs?since=n` | journal du kit |
| `GET /api/days` | énergie et coût par jour et par prise |
| `GET /api/files?dir=log|research` · `GET /files/<dir>/<nom>` | fichiers CSV |
| `POST /api/research/events` · `POST /api/research/result` | traces et résultats (recherche) |
| `GET/POST /api/knn` | apprentissage de l'IA (`train`, `add`, `delete`) |
| `GET /api/pzem` | diagnostic des capteurs |
| `WS /ws` | état (`{"t":"st",…}`) chaque seconde et entrées de journal (`{"t":"lg",…}`) |

En mode point d'accès, un serveur DNS répond à tous les noms (portail captif) : les téléphones ouvrent
l'application automatiquement.

## 9.5 Bytecode et machine virtuelle

Voir [specs/bytecode.md](specs/bytecode.md) : 46 instructions (pile de nombres réels, sauts, variables,
mesures, relais, paramètres, IA, délestage, messages), scripts déclenchés par événements (démarrage,
période, condition, heure, bouton), ordonnancement coopératif (300 instructions par script et par pas,
20 000 au maximum par pas de 100 ms), générateur pseudo-aléatoire xorshift32 reproductible.

## 9.6 Tests

| Commande | Ce qui est vérifié |
|---|---|
| `cd tests/native && make` | 97 + 47 vérifications : VM, pilote PZEM (trames, CRC), historique, Holt, anomalies, k-NN, relais, protections, énergie, délestage, horloge, paramètres |
| `cd tests/js && npm install && npm test` | cœur JS identique au C++ (45 vérifications), 17 exemples compilés, cohérence de l'arène et faisabilité du défi (42), validation croisée de 54 programmes (VM JS ↔ VM C++ : mêmes actions aux mêmes instants) |
| `NODE_PATH=… node tests/e2e/smoke.js` | toutes les pages, PC et mobile, kit et démonstration, sans erreur JavaScript |
| `NODE_PATH=… node tests/e2e/flows.js` | 19 parcours : commande d'une prise, mesure, envoi d'un programme au kit, mode enseignant, arène, IA, questionnaire |

Les tests e2e utilisent Playwright (`npm install playwright` puis un navigateur Chromium).

## 9.7 Développer sans matériel

```bash
node tools/mock-kit/server.js --port 8080 --speed 10
```

Le faux kit sert l'application à partir des sources (`web/`, rechargées à chaque requête) et répond à toute
l'API avec le jumeau numérique : on développe l'interface comme si le kit était branché. Le code
enseignant est `1234`.

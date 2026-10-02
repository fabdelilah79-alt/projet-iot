# 3. Installer le logiciel sur l'ESP32

Le programme du kit **et** l'application web sont réunis dans un seul fichier :
[`release/energylab-esp32-full.bin`](../release/energylab-esp32-full.bin) (≈ 1,5 Mo). Il se flashe à
l'adresse **0x0**. Rien d'autre à installer : ni Arduino, ni bibliothèque, ni application sur les téléphones.

> Flashez l'ESP32 **avant** de le monter dans le boîtier, ou **cordon 230 V débranché**.

## 3.1 Méthode recommandée : depuis le navigateur (sans rien installer)

Il faut **Google Chrome** ou **Microsoft Edge** sur ordinateur (la fonction Web Serial n'existe pas sur
Firefox, Safari ni sur téléphone).

1. Téléchargez `energylab-esp32-full.bin` (dossier `release/` du projet).
2. Reliez l'ESP32 au PC avec un câble USB **de données**.
   Sous Windows, si aucun port n'apparaît, installez le pilote de la puce USB de votre carte :
   *CP210x* (Silicon Labs) ou *CH340* (WCH).
3. Ouvrez **https://espressif.github.io/esptool-js/**.
4. *Baudrate* : 921600 (ou 115200 si des erreurs apparaissent). Cliquez **Connect** et choisissez le port
   de la carte. Si la connexion échoue : maintenez le bouton **BOOT** de la carte appuyé, cliquez
   **Connect**, relâchez BOOT quand la connexion est établie.
5. Conseillé lors de la première installation : **Erase Flash** (effacement complet, ≈ 20 s).
6. Dans le tableau, *Flash Address* : **0x0**, choisissez le fichier `energylab-esp32-full.bin`, cliquez
   **Program**. Attendez « Leaving… » (≈ 30 à 60 s).
7. Appuyez sur le bouton **EN** (redémarrage). L'écran affiche le Wi-Fi du kit.

## 3.2 Méthode en ligne de commande (esptool)

```bash
pip install esptool
esptool.py --chip esp32 --baud 921600 erase_flash
esptool.py --chip esp32 --baud 921600 write_flash 0x0 release/energylab-esp32-full.bin
```

Les fichiers séparés (bootloader, table de partitions, otadata, programme) et leurs adresses se trouvent dans
`release/fichiers-separes/` pour l'outil *Flash Download Tools* d'Espressif.

## 3.3 Compiler soi-même (développeurs)

Le projet utilise [PlatformIO](https://platformio.org/) (extension VS Code ou ligne de commande) :

```bash
cd firmware
pio run -e esp32dev -t upload       # compile, intègre l'application web et téléverse
pio device monitor                  # journal série (115200 bauds)
python tools/make_release.py        # recrée release/energylab-esp32-full.bin
```

PlatformIO télécharge automatiquement la plateforme Espressif et les bibliothèques. Le script
`tools/embed_web.py` assemble et compresse le dossier `web/` dans le programme à chaque compilation : toute
modification de l'application web est donc embarquée au prochain téléversement.

Tests sans matériel :

```bash
cd tests/native && make                      # tests C++ du cœur du kit (VM, PZEM, IA, sécurité)
cd tests/js && npm install && npm test       # tests JS + validation croisée VM C++ / JS
node tools/mock-kit/server.js                # faux kit sur http://localhost:8080
```

## 3.4 Premier démarrage

1. Le kit crée le Wi-Fi **`EnergyLab-XXXX`** (XXXX = identifiant de la carte), mot de passe
   **`energie123`**. L'écran les affiche, ainsi qu'un QR code de connexion (appui court sur BOOT).
2. Connectez un téléphone ou un PC à ce Wi-Fi, puis ouvrez **http://192.168.4.1** (sur beaucoup de
   téléphones, la page s'ouvre toute seule).
3. Saisissez un nom ou un code apprenant. Pour l'enseignant : *Réglages* > **Mode enseignant**, code
   **`1234`**, puis **changez ce code** et le mot de passe du Wi-Fi (*Réglages* > *Pédagogie* et
   *Réseau Wi-Fi*).
4. Réglez le tarif (monnaie, prix du kWh, heures creuses) et la puissance souscrite (*Tarif et
   environnement*).

## 3.5 Mettre à jour

Le fichier unique recouvre aussi la zone des réglages : pour **conserver** les réglages, l'IA apprise et
l'historique du jour, ne flashez que le programme :

- esptool-js : *Flash Address* **0x10000**, fichier `release/fichiers-separes/firmware.bin` ;
- ligne de commande : `esptool.py --chip esp32 write_flash 0x10000 release/fichiers-separes/firmware.bin` ;
- PlatformIO : `pio run -e esp32dev -t upload` (n'écrit que les zones du programme).

Le programme à blocs enregistré, les journaux de mesures et les données de recherche (système de fichiers)
sont conservés dans tous les cas, sauf après « Erase Flash ».

Pour repartir de zéro : *Réglages* > *Données et maintenance* > **Réinitialisation d'usine**, ou
« Erase Flash » puis le fichier unique.

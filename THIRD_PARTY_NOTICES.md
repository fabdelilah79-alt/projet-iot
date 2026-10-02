# Composants tiers

EnergyLab utilise les logiciels libres suivants. Leurs licences s'appliquent aux parties correspondantes.

| Composant | Utilisation | Licence |
|---|---|---|
| [Blockly](https://github.com/google/blockly) 13.3.0 (Google / Raspberry Pi Foundation) | éditeur de blocs, inclus dans `web/lib/blockly/` | Apache 2.0 (voir `web/lib/blockly/LICENSE`) |
| [Arduino-ESP32](https://github.com/espressif/arduino-esp32) 2.0.17 et [ESP-IDF](https://github.com/espressif/esp-idf) (Espressif) | cœur Arduino, Wi-Fi, NVS, LittleFS, mDNS, QR code (`esp_qrcode`) | LGPL 2.1 / Apache 2.0 |
| [ESPAsyncWebServer](https://github.com/ESP32Async/ESPAsyncWebServer) 3.12.1 | serveur web et WebSocket | LGPL 3.0 |
| [AsyncTCP](https://github.com/ESP32Async/AsyncTCP) 3.5.0 | réseau asynchrone | LGPL 3.0 |
| [ArduinoJson](https://github.com/bblanchon/ArduinoJson) 7.4.3 (Benoît Blanchon) | JSON | MIT |
| [U8g2](https://github.com/olikraus/u8g2) 2.36.19 (Oliver Kraus) | écran OLED | BSD 2 clauses |
| [DHT sensor library](https://github.com/adafruit/DHT-sensor-library) 1.4.7 et [Adafruit Unified Sensor](https://github.com/adafruit/Adafruit_Sensor) 1.1.15 | capteur DHT22 | MIT / Apache 2.0 |
| [PubSubClient](https://github.com/knolleary/pubsubclient) 2.8 (Nick O'Leary) | client MQTT | MIT |

Les bibliothèques sous LGPL sont liées statiquement au programme de l'ESP32. Conformément à la LGPL, le
code source complet d'EnergyLab et les instructions de compilation ([docs/03-installation.md](docs/03-installation.md))
permettent de recompiler le programme avec une version modifiée de ces bibliothèques.

Le protocole des capteurs PZEM-004T v3.0 a été implémenté à partir de la documentation du fabricant
(Peacefair) et des travaux publiés par la communauté, notamment
[mandulaj/PZEM-004T-v30](https://github.com/mandulaj/PZEM-004T-v30) et
[mathieucarbou/MycilaPZEM](https://github.com/mathieucarbou/MycilaPZEM) ; aucun de leurs codes n'est inclus.

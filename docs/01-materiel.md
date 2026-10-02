# 1. Liste du matériel

Tout le matériel est courant (boutiques d'électronique, sites de vente en ligne). Les références indiquées sont
celles utilisées pour concevoir et tester le logiciel ; des équivalents conviennent s'ils ont les mêmes
caractéristiques.

## 1.1 Électronique (basse tension)

| Qté | Composant | Caractéristiques à vérifier | Rôle |
|---:|---|---|---|
| 1 | **ESP32 DevKit V1** (ESP32-WROOM-32, 30 broches) | flash 4 Mo, port micro-USB ou USB-C | cerveau du kit, Wi-Fi, serveur web |
| 4 | **PZEM-004T v3.0, version 100 A** avec son tore (transformateur de courant) | « v3.0 » (protocole Modbus-RTU) ; tore fermé ou ouvrant fourni | mesure U, I, P, énergie, f, FP de chaque prise |
| 1 | **Module 4 relais 5 V** avec optocoupleurs | relais 10 A / 250 V AC, entrée « actif à l'état bas », cavalier JD-VCC | commande des 4 prises |
| 1 | **Convertisseur de niveau logique 4 voies BSS138** | bidirectionnel, côtés LV (3,3 V) et HV (5 V) | adapte les signaux 5 V des PZEM à l'ESP32 |
| 1 | **Écran OLED I2C 0,96"** SSD1306 128×64 (ou 1,3" SH1106) | 4 broches GND VCC SCL SDA, adresse 0x3C | affiche le Wi-Fi, un QR code et les mesures |
| 1 | **DHT22 / AM2302** | module 3 broches (résistance de tirage intégrée) de préférence | température et humidité |
| 1 | **Photorésistance (LDR) 5 mm** + **résistance 10 kΩ** | GL5528 ou équivalent | luminosité |
| 1 | **Détecteur de présence HC-SR501** | réglage du délai au minimum (≈ 3 s), mode « répétable » (cavalier H) | présence des occupants |
| 1 | **Buzzer piézo passif** | 3–5 V | signaux sonores |
| 1 | **Alimentation 230 V AC → 5 V DC, 2 A** | **Hi-Link HLK-10M05** (sur circuit imprimé) ou **Mean Well HDR-15-5** (rail DIN, plus sûr à câbler) | alimente toute la basse tension |
| 1 | Plaque à bandes ou petite carte de prototypage + barrettes femelles | | répartition 5 V / GND / 3V3 |
| 1 lot | Fils Dupont femelle-femelle, fils de câblage 0,5 mm² | rouge (5 V), orange (3,3 V), noir (GND), couleurs variées pour les signaux | |

> Consommation basse tension : ESP32 ≈ 250 mA en pointe Wi-Fi, 4 relais ≈ 4 × 75 mA, écran et capteurs
> ≈ 50 mA, PZEM ≈ 4 × 10 mA : moins de 700 mA au total. Une alimentation de 2 A laisse une marge confortable.

## 1.2 Partie 230 V (puissance)

| Qté | Composant | Caractéristiques à vérifier |
|---:|---|---|
| 1 | **Embase IEC C14 avec porte-fusible et interrupteur** (ou cordon secteur 3G 1,5 mm² avec fiche) | fusible **10 A** |
| 1 | **Disjoncteur différentiel 2P 10 A 30 mA type A** (« DDR », 1 module DIN) | ou interrupteur différentiel 30 mA + disjoncteur 10 A |
| 1 | Porte-fusible + **fusible T1A** (temporisé) | protection de l'alimentation 5 V |
| 4 | **Prises 2P+T 16 A** pour montage en saillie ou sur rail DIN | norme du pays (type C/E/F au Maroc et en France) |
| 2 | Répartiteurs (barrettes de pontage ou bornes à levier Wago 221) | un pour la phase, un pour le neutre |
| 1 | Bornier de terre | |
| 1 lot | Fil souple **1,5 mm²** : marron (phase), bleu (neutre), vert/jaune (terre) | circuits des prises |
| 1 lot | Fil souple **0,75 mm²** marron/bleu | alimentation des PZEM et de l'alimentation 5 V |
| 1 lot | Embouts de câblage (ferrules) + pince à sertir | obligatoires sur le fil souple dans les bornes à vis |
| 1 | **Boîtier isolant** (plastique, IP40 minimum) avec rail DIN, ou coffret électrique 2 rangées | séparation nette 230 V / basse tension |
| — | Presse-étoupes, colliers, entretoises, vis | |

## 1.3 Outillage et contrôle

- Multimètre (continuité, isolement entre phase/neutre et terre, mesure 5 V et 3,3 V).
- Tournevis isolés, pince à dénuder, pince à sertir les embouts.
- Un câble USB **de données** (et pas seulement de charge) pour flasher l'ESP32.
- Pour les essais : une lampe (halogène ou LED), une bouilloire, un chargeur de téléphone, un ventilateur…
  des appareils de natures différentes (résistif, moteur, électronique) rendent les activités plus riches.

## 1.4 Variantes possibles

- **PZEM-004T 10 A** (shunt interne, sans tore) : fonctionne avec le même logiciel, mais le courant de la prise
  traverse le module ; limitez alors chaque prise à 2 000 W. La version 100 A avec tore est plus sûre.
- **Module relais 3,3 V** ou module « déclenchement haut / bas » : réglez « Module relais actif à l'état bas »
  dans *Réglages > Sécurité et matériel* selon votre module.
- **Pas d'écran, pas de capteurs d'ambiance** : le kit fonctionne quand même ; décochez les capteurs absents
  dans *Réglages > Capteurs* et choisissez « Écran : aucun ».

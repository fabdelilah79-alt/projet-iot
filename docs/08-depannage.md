# 8. Dépannage

Le **journal du kit** (cloche en haut à droite de l'application) et le **tableau de diagnostic des PZEM**
(*Réglages* > *Capteurs PZEM-004T*, mode enseignant) donnent la cause de la plupart des problèmes.
Le port série USB (115 200 bauds) affiche aussi le journal au démarrage.

> Toute intervention dans le boîtier se fait **cordon débranché**.

## Connexion

| Symptôme | Causes possibles et solutions |
|---|---|
| Le Wi-Fi `EnergyLab-XXXX` n'apparaît pas | le kit n'est pas alimenté (écran éteint) ; le kit est en mode « réseau existant » : maintenez **BOOT 6 s** pour revenir au Wi-Fi du kit |
| Connecté au Wi-Fi mais la page ne s'ouvre pas | tapez bien **http://192.168.4.1** (pas https) ; désactivez les données mobiles du téléphone ; essayez un autre navigateur |
| « Kit virtuel » / mode démonstration au lieu du kit | l'application n'a pas été ouverte depuis le kit : utilisez l'adresse du kit, pas un fichier local |
| Mode « réseau existant » : kit introuvable | l'écran du kit affiche son adresse IP : utilisez-la ; certains réseaux (wifi « invités », isolation des clients) empêchent les appareils de se voir : utilisez un partage de connexion de téléphone ou le Wi-Fi du kit |
| « Kit déconnecté » par moments | trop d'appareils (8 au maximum sur le Wi-Fi du kit) ; éloignement ; boîtier métallique (l'antenne doit être dégagée) |
| Code enseignant oublié | flashez le kit avec « Erase Flash » ([03-installation.md](03-installation.md)) : tous les réglages reviennent aux valeurs d'usine (code `1234`) |

## Mesures (PZEM-004T)

| Symptôme | Causes possibles et solutions |
|---|---|
| « capteur absent » sur toutes les prises | PZEM non alimentés en 230 V (leur partie mesure en a besoin) ; 5 V absent sur leur connecteur TTL ; **TX et RX inversés** (TX des PZEM → HV2 → LV2 → GPIO16) ; convertisseur de niveau mal alimenté (LV = 3,3 V, HV = 5 V, GND des deux côtés) |
| « capteur absent » sur certaines prises | adresses non attribuées ou en double : refaites l'adressage **un capteur à la fois** ([02-cablage.md §2.5](02-cablage.md)) puis « Rechercher les capteurs » |
| Diagnostic : « CRC » ou « trame » fréquents | deux PZEM ont la même adresse ; fils TTL trop longs ou proches des fils 230 V ; mauvais contact Dupont |
| La puissance s'affiche sur une autre prise | le tore de la prise k n'est pas sur le PZEM n°k, ou adresses inversées : suivez le fil de phase de chaque prise |
| P = 0 W avec un petit appareil | le capteur 100 A ne détecte pas les courants < 20 mA (≈ 4 W) : faites passer le fil de phase 5 fois dans le tore et réglez « passages dans le tore » à 5 (*Réglages* > *Kit et prises*) |
| Tension ou puissance légèrement différente d'un wattmètre de référence | ajustez « Étalonnage U » et « Étalonnage I » (ex. 1,012) |
| Énergie du jour remise à zéro | normal à minuit (changement de jour) ; l'historique des jours précédents est dans *Données* |

## Relais et prises

| Symptôme | Causes possibles et solutions |
|---|---|
| Les relais ne collent jamais / restent collés | vérifiez le réglage « Module relais actif à l'état bas » (*Sécurité et matériel*) selon votre module ; VCC du module au **5 V**, cavalier JD-VCC en place ; GND commun avec l'ESP32 |
| Un relais colle mais la prise reste sans tension | phase non câblée sur **COM**, ou prise câblée sur **NC** au lieu de **NO** |
| « Commutation retardée » | protection normale : délai minimum entre deux commutations (réglable par prise) |
| « Prise verrouillée par une protection » | la prise a dépassé sa puissance max : débranchez l'appareil, vérifiez le réglage, cliquez **Réarmer** |
| Une prise s'éteint toute seule | protection de puissance totale du kit (2 300 W), délestage par un programme, minuterie, programme en cours (voir le journal) |
| L'ESP32 redémarre quand un relais commute | alimentation 5 V trop faible ou fils fins : alimentation 2 A, fils courts, condensateur 470 µF–1 000 µF / 10 V entre 5V et GND près de l'ESP32 ; éloignez les fils basse tension des fils 230 V |
| Le différentiel déclenche | appareil défectueux (fuite à la terre) : testez sans appareil ; erreur de câblage : **tous** les neutres doivent venir de la sortie du différentiel (ne jamais mélanger avec un neutre pris en amont) |

## Capteurs d'ambiance et écran

| Symptôme | Causes possibles et solutions |
|---|---|
| Écran noir | type d'écran (*Sécurité et matériel* > Écran : SSD1306 ou SH1106) ; SDA/SCL inversés ; écran alimenté en 3,3 V |
| Écran décalé ou « neige » | choisissez l'autre type (SH1106 au lieu de SSD1306) |
| Température « -- » | DHT22 : DATA sur GPIO27, résistance de 10 kΩ entre DATA et 3V3 pour un capteur nu ; capteur décoché dans *Réglages* > *Capteurs* |
| Luminosité inversée | cochez « Inverser la luminosité » (selon le sens du pont diviseur) |
| Présence toujours vraie | réglez le potentiomètre « temps » du HC-SR501 au minimum, attendez 1 min après la mise sous tension (stabilisation) ; le « délai de présence » du kit (60 s) s'ajoute |

## Programmes

| Symptôme | Causes possibles et solutions |
|---|---|
| « Le programme contient des erreurs » | un bloc est mal assemblé : il est signalé en rouge avec une explication ; chaque script doit commencer par un événement |
| « L'envoi de programmes est désactivé » | permission retirée par l'enseignant (*Réglages* > *Pédagogie*) |
| Le programme ne fait rien | pas de bloc d'événement en tête ; condition jamais vraie (affichez la valeur avec « écrire … ») ; prise verrouillée ou délestée |
| Le programme s'arrête au redémarrage du kit | cochez « Redémarrer le programme du kit à sa mise sous tension » (éditeur) |
| Erreur d'exécution affichée sur un bloc | le bloc fautif est surligné ; la console explique (ex. trop d'instructions sans attente) |

## Flashage

| Symptôme | Causes possibles et solutions |
|---|---|
| Aucun port série | câble USB « charge seule » : changez de câble ; pilote CP210x ou CH340 à installer (Windows) |
| « Failed to connect » | maintenez **BOOT** pendant la connexion ; baisser la vitesse à 115 200 bauds |
| Réglages perdus après une mise à jour | le fichier unique (adresse 0x0) réinitialise les réglages : pour les garder, ne flashez que `firmware.bin` à 0x10000 |

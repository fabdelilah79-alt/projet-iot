/* EnergyLab — aide : démarrage rapide, connexion, sécurité, câblage, glossaire, blocs, FAQ */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  if (typeof document === 'undefined') return;
  const U = EL.util, h = U.h;

  const GLOSSARY = [
    ['Tension U (volt, V)', 'Différence de potentiel entre phase et neutre : environ 230 V sur le réseau domestique.'],
    ['Courant I (ampère, A)', 'Débit de charges électriques dans le circuit. Mesuré par le tore (transformateur de courant) du capteur.'],
    ['Puissance active P (watt, W)', 'Puissance réellement transformée (chaleur, lumière, mouvement). P = U × I × cos φ.'],
    ['Puissance apparente S (VA)', 'S = U × I. Dimensionne les câbles et les protections.'],
    ['Puissance réactive Q (var)', 'Q = √(S² − P²). Échangée sans être consommée (moteurs, électronique).'],
    ['Facteur de puissance (FP)', 'FP = P / S, entre 0 et 1. Proche de 1 pour une résistance.'],
    ['Énergie E (Wh, kWh)', 'E = P × t. C’est ce que mesure le compteur et ce que l’on paie. 1 kWh = 1 000 W pendant 1 h.'],
    ['Puissance souscrite', 'Puissance maximale prévue au contrat : au-delà, le disjoncteur du compteur coupe toute la maison.'],
    ['Heures creuses', 'Plage horaire où le kWh est moins cher (souvent la nuit).'],
    ['Relais', 'Interrupteur commandé électriquement par le microcontrôleur.'],
    ['Délestage', 'Couper temporairement des appareils peu prioritaires pour rester sous une puissance limite.'],
    ['Hystérésis', 'Écart entre le seuil d’allumage et le seuil d’extinction, qui évite les commutations répétées.'],
    ['Veille', 'Consommation d’un appareil « éteint » mais branché.'],
    ['k plus proches voisins (k-NN)', 'Méthode d’apprentissage supervisé : un objet prend la classe majoritaire de ses k exemples les plus proches.'],
    ['Lissage exponentiel (Holt)', 'Méthode de prévision qui suit un niveau et une tendance en donnant plus de poids aux mesures récentes.'],
    ['Score z', 'Écart à la moyenne exprimé en nombre d’écarts-types : sert à détecter les anomalies.'],
    ['Bytecode', 'Code intermédiaire très simple exécuté par la machine virtuelle du kit, produit à partir des blocs.'],
    ['Modbus RTU', 'Protocole série industriel utilisé entre l’ESP32 et les capteurs PZEM-004T.']
  ];

  const view = {
    mount: function (main) {
      const app = EL.app;
      const kitIp = app.info && app.info.ip ? 'http://' + app.info.ip : null;
      main.appendChild(h('div.page-head', [h('div', [h('h1', 'Aide & câblage'), h('p', 'Tout pour démarrer, se connecter, câbler le kit en sécurité et comprendre les notions.')])]));
      const toc = [['demarrer', '🚀 Démarrer'], ['connexion', '📶 Se connecter au kit'], ['securite', '⚠️ Sécurité'], ['cablage', '🔧 Câblage'], ['blocs', '🧩 Les blocs'], ['glossaire', '📖 Glossaire'], ['faq', '❓ Questions fréquentes'], ['apropos', 'ℹ️ À propos']];
      main.appendChild(h('div.row', { style: { marginBottom: '12px' } }, toc.map(function (t) { return h('a.btn.small', { href: '#', onclick: function (e) { e.preventDefault(); const el = document.getElementById('h-' + t[0]); if (el) el.scrollIntoView({ behavior: 'smooth' }); } }, t[1]); })));
      const c = h('div.card.help-content');
      c.innerHTML = [
        '<h2 id="h-demarrer">🚀 Démarrer en 5 minutes</h2><ol>',
        '<li>Branchez le kit sur une prise murale : l’écran affiche le nom du Wi-Fi du kit et son adresse.</li>',
        '<li>Connectez votre téléphone ou ordinateur à ce Wi-Fi (ou scannez le QR code de l’écran).</li>',
        '<li>Ouvrez <b>http://192.168.4.1</b> dans le navigateur : cette application s’affiche.</li>',
        '<li>Onglet <b>Maison</b> : allumez une prise et branchez un appareil, la puissance apparaît.</li>',
        '<li>Onglet <b>Missions</b> : suivez les travaux pratiques guidés, du niveau 1 au défi final.</li></ol>',
        '<h2 id="h-connexion">📶 Se connecter au kit</h2>',
        '<p><b>Mode 1 — Wi-Fi du kit (par défaut, sans Internet)</b> : le kit crée le réseau <code>' + U.escapeHtml((app.config && app.config.net.apSsid) || 'EnergyLab-XXXX') + '</code>. Mot de passe par défaut : <code>energie123</code>. Adresse : <b>http://192.168.4.1</b>. Jusqu’à 8 appareils.</p>',
        '<p><b>Mode 2 — Réseau de l’établissement ou partage de connexion</b> : en mode enseignant (Réglages &gt; Réseau), saisissez le nom et le mot de passe du réseau, puis redémarrez. Le kit, les PC et les téléphones doivent être sur le <b>même point d’accès</b>. L’adresse IP s’affiche sur l’écran du kit' + (kitIp ? ' (actuellement <b>' + kitIp + '</b>)' : '') + ' ; on peut aussi essayer <b>http://energylab.local</b>.</p>',
        '<p>Si le kit ne trouve pas le réseau, il recrée automatiquement son propre Wi-Fi. Pour revenir au mode 1, maintenez le bouton <b>BOOT</b> du kit 6 secondes.</p>',
        '<p class="note tip">Sur téléphone, si le système propose « Se connecter au réseau », acceptez : l’application s’ouvre. Pensez à désactiver les données mobiles si la page ne s’affiche pas.</p>',
        '<h2 id="h-securite">⚠️ Règles de sécurité</h2><ul>',
        '<li>Le kit fonctionne en <b>230 V</b> : seul l’enseignant ouvre le boîtier, <b>hors tension</b> (débranché).</li>',
        '<li>Ne jamais brancher d’appareil de plus de 2 000 W ni dépasser 10 A au total (disjoncteur du kit).</li>',
        '<li>Les apprenants ne manipulent que les prises du kit et l’application.</li>',
        '<li>Vérifier régulièrement le bouton test du disjoncteur différentiel 30 mA.</li>',
        '<li>Ne pas laisser un appareil chauffant (bouilloire, fer, radiateur) sans surveillance.</li>',
        '<li>Les protections logicielles du kit ne remplacent pas les protections matérielles.</li></ul>',
        '<h2 id="h-cablage">🔧 Câblage (résumé)</h2>',
        '<p>Le guide complet, avec schémas et photos de repérage, se trouve dans le dossier <code>docs/</code> du projet (fichier <code>02-cablage.md</code>).</p>',
        '<table class="tbl"><thead><tr><th>Élément</th><th>Broche du module</th><th>ESP32</th></tr></thead><tbody>',
        '<tr><td>PZEM-004T ×4 (bus commun)</td><td>TX (via convertisseur de niveau)</td><td>GPIO16 (RX2)</td></tr>',
        '<tr><td></td><td>RX (via convertisseur de niveau)</td><td>GPIO17 (TX2)</td></tr>',
        '<tr><td></td><td>5V / GND</td><td>5 V / GND</td></tr>',
        '<tr><td>Module 4 relais</td><td>IN1 / IN2 / IN3 / IN4</td><td>GPIO26 / 25 / 33 / 32</td></tr>',
        '<tr><td></td><td>VCC / GND</td><td>5 V / GND</td></tr>',
        '<tr><td>Écran OLED I2C</td><td>SDA / SCL</td><td>GPIO21 / GPIO22 (3,3 V)</td></tr>',
        '<tr><td>DHT22</td><td>DATA</td><td>GPIO27 (3,3 V)</td></tr>',
        '<tr><td>Photorésistance + 10 kΩ</td><td>point milieu</td><td>GPIO34</td></tr>',
        '<tr><td>Détecteur HC-SR501</td><td>OUT</td><td>GPIO35 (alimentation 5 V)</td></tr>',
        '<tr><td>Buzzer</td><td>+</td><td>GPIO13</td></tr></tbody></table>',
        '<p><img class="svg-diagram" src="img/cablage-basse-tension.svg" alt="Schéma de câblage basse tension"></p>',
        '<p><img class="svg-diagram" src="img/cablage-230v.svg" alt="Schéma de câblage 230 V"></p>',
        '<p class="note warn">Partie 230 V : le fil de <b>phase</b> de chaque prise passe <b>seul</b> dans le tore de son capteur, puis par le contact COM → NO du relais. Les bornes de tension des PZEM sont reliées en amont des relais (toujours alimentées).</p>',
        '<h2 id="h-blocs">🧩 Les blocs</h2>',
        '<ul><li><b>Événements</b> (jaune) : démarrent un script (au démarrage, toutes les N s, quand une condition devient vraie, à une heure, bouton).</li>',
        '<li><b>Contrôle</b> (orange) : attendre, répéter, si… alors… sinon.</li><li><b>Opérateurs</b> (vert) : calculs, comparaisons, et / ou / non.</li>',
        '<li><b>Variables</b> : mémoriser des valeurs.</li><li><b>Mesures</b> (bleu) : U, I, P, S, Q, FP, énergie, coût, ambiance, heure.</li>',
        '<li><b>Prises</b> (vert d’eau) : allumer, éteindre, minuterie.</li><li><b>Paramètres</b> (violet) : régler les relais et les capteurs (puissance max, alarme, période de mesure, lissage…).</li>',
        '<li><b>Intelligence</b> (rose) : délestage, prévision, tendance, anomalie, reconnaissance d’appareils.</li><li><b>Alertes</b> : messages, bips, écran du kit.</li></ul>',
        '<p>Le programme est <b>compilé</b> en bytecode et <b>exécuté par le kit</b> : il continue même si vous fermez l’application. Le bouton « Simuler » l’exécute sur la maison virtuelle (jumeau numérique), sans risque.</p>',
        '<h2 id="h-glossaire">📖 Glossaire</h2><dl>',
        GLOSSARY.map(function (g) { return '<dt><b>' + g[0] + '</b></dt><dd>' + g[1] + '</dd>'; }).join(''), '</dl>',
        '<h2 id="h-faq">❓ Questions fréquentes</h2>',
        '<p><b>Une prise affiche « capteur absent ».</b> Le capteur PZEM ne répond pas : vérifiez son alimentation 230 V, le 5 V, les fils TX/RX et son adresse (Réglages &gt; Capteurs PZEM).</p>',
        '<p><b>La puissance reste à 0 W pour un petit appareil.</b> Le capteur 100 A ne mesure pas sous 20 mA (≈ 4 W). Faites passer le fil 5 fois dans le tore et réglez « passages dans le tore » à 5.</p>',
        '<p><b>Une prise refuse de s’allumer.</b> Elle est peut-être verrouillée par une protection (bouton « Réarmer ») ou délestée par un programme.</p>',
        '<p><b>Mon programme ne fait rien.</b> Vérifiez qu’il commence par un bloc d’événement, et regardez la console (onglet Programmer).</p>',
        '<p><b>L’heure du kit est fausse.</b> Elle est réglée automatiquement par le navigateur à la connexion (ou par Internet en mode réseau existant).</p>',
        '<h2 id="h-apropos">ℹ️ À propos</h2>',
        '<p>EnergyLab — kit pédagogique IoT de gestion de l’énergie domestique : ESP32, capteurs PZEM-004T v3.0, relais, programmation par blocs exécutée sur le kit, jumeau numérique, laboratoire d’IA, missions guidées et outils d’évaluation pour la recherche.</p>',
        '<p class="small muted">Composants logiciels libres : Blockly (Google, licence Apache 2.0), ESPAsyncWebServer, AsyncTCP, ArduinoJson, U8g2, PubSubClient, bibliothèque DHT d’Adafruit. Voir le fichier THIRD_PARTY_NOTICES.md.</p>'
      ].join('');
      main.appendChild(c);
    }
  };
  EL.views.aide = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* EnergyLab — missions guidées (travaux pratiques) avec étayage (« scaffolding ») adaptatif
 * Trois modes réglés par l'enseignant : guidage fort, adaptatif (par défaut), faible. */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  if (typeof document === 'undefined') return;
  const U = EL.util, h = U.h;

  const anyOutlet = function (s, f) { for (let k = 0; k < 4; k++) if (f(s.outlets[k], k)) return k; return -1; };
  const cfg = function () { return EL.app.config; };
  const logsSince = function (seq, f) { return EL.app.logs.some(function (e) { return e.seq > seq && f(e); }); };

  // ---------------------------------------------------------------- contenu des missions
  const LEVELS = ['', 'Découvrir', 'Comprendre', 'Commander', 'Programmer', 'Optimiser', 'Défi'];
  const MISSIONS = [
    {
      id: 'm1', level: 1, title: 'Prise en main du kit', duration: '10 min', icon: '🔌',
      comp: ['Identifier les éléments d’une installation électrique', 'Utiliser une interface de supervision'],
      intro: 'Le kit représente l’installation d’une maison : quatre prises commandées par des relais et mesurées par des capteurs. Vous allez allumer une prise, lire les mesures et comprendre le rôle des protections.',
      theory: '<p>Chaque prise possède un <b>relais</b> (interrupteur commandé électriquement) et un <b>capteur PZEM-004T</b> qui mesure la tension U (V), le courant I (A), la puissance P (W) et l’énergie E (Wh). L’ensemble est protégé par un <b>disjoncteur différentiel 30 mA</b>.</p>',
      steps: [
        { type: 'action', text: 'Dans l’onglet « Maison », allumez la prise 1 avec son interrupteur.', check: function (s) { return s.outlets[0].on; }, hints: ['L’interrupteur se trouve en haut à droite de la carte « 1 · … ».', 'Si l’interrupteur est grisé, la commande des prises a peut-être été verrouillée par l’enseignant.'] },
        { type: 'action', text: 'Branchez une lampe sur la prise 1 et allumez-la (en mode démonstration, choisissez une lampe et cochez « interrupteur de l’appareil »). La puissance doit dépasser 3 W.', check: function (s) { return s.outlets[0].on && s.outlets[0].p > 3; }, hints: ['La lampe doit être allumée ET la prise doit être allumée.', 'Regardez la valeur en gros sur la carte de la prise : elle doit dépasser 3 W.'] },
        { type: 'numeric', text: 'Relevez la tension U mesurée sur la prise 1 (en volts).', unit: 'V', answer: function (s) { return s.outlets[0].u; }, tolAbs: 3, hints: ['La tension est indiquée sous la puissance : « U … V ».', 'Dans un réseau domestique, elle est proche de 230 V.'] },
        { type: 'action', text: 'Éteignez la prise 1 et observez la puissance.', check: function (s) { return !s.outlets[0].on; }, hints: ['Utilisez de nouveau l’interrupteur de la prise 1.'] },
        { type: 'qcm', text: 'Quand le relais de la prise est ouvert (prise éteinte), la puissance mesurée est :', options: ['nulle : aucun courant ne circule vers l’appareil', 'la même qu’avant', 'deux fois plus grande'], correct: 0, explain: 'Le relais ouvre le circuit : le courant ne peut plus circuler, donc P = U × I × cos φ = 0.' },
        { type: 'qcm', text: 'À quoi sert le disjoncteur différentiel 30 mA du kit ?', options: ['À protéger les personnes contre l’électrocution (courant de fuite)', 'À mesurer l’énergie', 'À augmenter la puissance disponible'], correct: 0, explain: 'Il compare le courant qui part et celui qui revient : s’il manque plus de 30 mA (fuite vers la terre ou à travers une personne), il coupe en quelques millisecondes.' }
      ]
    },
    {
      id: 'm2', level: 1, title: 'Puissance, énergie et coût', duration: '20 min', icon: '💰',
      comp: ['Distinguer puissance (W) et énergie (Wh)', 'Calculer une énergie et un coût'],
      intro: 'Une bouilloire et une lampe n’ont pas la même puissance. Mais ce que l’on paie, c’est l’énergie : la puissance multipliée par la durée.',
      theory: '<p><b>E = P × t</b> : une puissance de 1 000 W pendant 1 h consomme 1 000 Wh = <b>1 kWh</b>.<br>Coût = E (kWh) × prix du kWh.</p>',
      steps: [
        { type: 'action', text: 'Faites fonctionner un appareil puissant (bouilloire, radiateur, fer…) sur la prise 2 : P doit dépasser 500 W.', check: function (s, ctx) { const o = s.outlets[1]; if (o.on && o.p > 500) { ctx.p = o.p; return true; } return false; }, hints: ['Allumez la prise 2 puis l’appareil.', 'En démonstration : choisissez « Bouilloire 2000 W » sur la prise 2 et cochez son interrupteur.'] },
        { type: 'numeric', text: 'Quelle puissance avez-vous relevée (en W) ?', unit: 'W', answer: function (s, ctx) { return ctx.shared.p; }, tolRel: 0.1, hints: ['La valeur a été mesurée à l’étape précédente : environ celle affichée sur la carte de la prise 2.'] },
        { type: 'numeric', text: 'Calculez l’énergie consommée si l’appareil fonctionne 3 minutes (en Wh).', unit: 'Wh', answer: function (s, ctx) { return ctx.shared.p * 3 / 60; }, tolRel: 0.1, hints: ['3 minutes = 3/60 heure = 0,05 h.', 'E = P × t = P × 0,05.'] },
        { type: 'numeric', text: 'Avec le prix du kWh du tableau de bord, combien coûtent 10 utilisations de 3 minutes ?', unitFn: function () { return cfg() ? cfg().tariff.currency : ''; }, answer: function (s, ctx) { return ctx.shared.p * 0.05 * 10 / 1000 * (cfg() ? cfg().tariff.priceHP : 1); }, tolRel: 0.12, hints: ['Énergie pour 10 utilisations = 10 × l’énergie précédente (en Wh), à convertir en kWh (÷ 1 000).', 'Coût = énergie en kWh × prix du kWh.'] },
        { type: 'observe', text: 'Comparez une lampe LED (environ 9 W) et la bouilloire : pourquoi une lampe allumée toute la journée peut-elle coûter autant que quelques bouilloires ?' }
      ]
    },
    {
      id: 'm3', level: 2, title: 'Puissance apparente et facteur de puissance', duration: '25 min', icon: '📐',
      comp: ['Calculer S = U × I', 'Interpréter le facteur de puissance'],
      intro: 'Pour certains appareils, U × I est plus grand que la puissance active P. Pourquoi ?',
      theory: '<p><b>S = U × I</b> (VA) est la puissance apparente. <b>P = U × I × cos φ</b> (W) est la puissance active (utile). <b>Q = √(S² − P²)</b> (var) est la puissance réactive. Le facteur de puissance vaut <b>FP = P / S</b>.</p>',
      steps: [
        { type: 'action', text: 'Mesurez un appareil électronique ou un moteur (chargeur, ordinateur, ventilateur, lampe LED…) : il faut P > 2 W et un facteur de puissance inférieur à 0,9.', check: function (s, ctx) { const k = anyOutlet(s, function (o) { return o.on && o.p > 2 && o.pf < 0.9; }); if (k >= 0) { const o = s.outlets[k]; ctx.k = k; ctx.u = o.u; ctx.i = o.i; ctx.p = o.p; return true; } return false; }, hints: ['Une bouilloire ou une lampe halogène ont un FP proche de 1 : choisissez plutôt un chargeur ou un ventilateur.', 'Regardez le FP dans l’onglet « Mesures ».'] },
        { type: 'numeric', text: 'Avec les valeurs mesurées, calculez S = U × I (en VA).', unit: 'VA', answer: function (s, ctx) { return ctx.shared.u * ctx.shared.i; }, tolRel: 0.06, hints: ['Multipliez la tension (≈ 230 V) par le courant (en A).'] },
        { type: 'numeric', text: 'Calculez le facteur de puissance cos φ = P / S.', unit: '', answer: function (s, ctx) { return ctx.shared.p / (ctx.shared.u * ctx.shared.i); }, tolAbs: 0.05, hints: ['Divisez la puissance active P par la puissance apparente S que vous venez de calculer.'] },
        { type: 'qcm', text: 'Pourquoi P est-elle plus petite que S pour cet appareil ?', options: ['Une partie du courant ne produit pas de puissance active (déphasage ou courant déformé)', 'Le capteur est mal étalonné', 'La tension du réseau est trop faible'], correct: 0, explain: 'Les moteurs déphasent le courant (φ) ; les alimentations électroniques déforment le courant (harmoniques). Dans les deux cas, U × I > P.' },
        { type: 'qcm', text: 'Pour une bouilloire (résistance chauffante), le facteur de puissance est proche de :', options: ['1', '0,5', '0'], correct: 0, explain: 'Une résistance pure ne déphase pas le courant : φ = 0 donc cos φ = 1.' }
      ]
    },
    {
      id: 'm4', level: 2, title: 'Résistif, moteur ou électronique ?', duration: '25 min', icon: '🔬',
      comp: ['Mener une campagne de mesures', 'Classer des charges électriques'],
      intro: 'Chaque famille d’appareils a sa « signature » électrique. Vous allez en mesurer plusieurs et les comparer.',
      theory: '<ul><li><b>Résistif</b> (bouilloire, radiateur, halogène) : FP ≈ 1.</li><li><b>Moteur</b> (ventilateur, frigo, perceuse) : FP ≈ 0,6 à 0,85, courant en retard.</li><li><b>Électronique</b> (chargeur, LED, ordinateur) : FP souvent &lt; 0,7, courant déformé.</li></ul>',
      steps: [
        { type: 'action', text: 'Dans l’onglet « Mesures », enregistrez au moins 3 appareils différents avec « Enregistrer la mesure ».', check: function (s, ctx) { const n = U.store.get('measures', []).length; if (ctx.n0 === undefined) ctx.n0 = n; return n >= ctx.n0 + 3 || n >= 3; }, hints: ['Branchez un appareil, attendez que la mesure soit stable, puis cliquez sur « Enregistrer la mesure ».'] },
        { type: 'qcm', text: 'Un ventilateur a un facteur de puissance de 0,75. C’est une charge :', options: ['inductive (moteur)', 'résistive', 'sans consommation'], correct: 0, explain: 'Le bobinage du moteur crée un déphasage : le courant est en retard sur la tension.' },
        { type: 'qcm', text: 'Quel appareil appelle le plus de courant pour une même puissance active P ?', options: ['Celui qui a le facteur de puissance le plus faible', 'Celui qui a le facteur de puissance le plus élevé', 'Ils appellent tous le même courant'], correct: 0, explain: 'I = P / (U × cos φ) : plus cos φ est petit, plus le courant est grand. Les fournisseurs pénalisent les mauvais facteurs de puissance dans l’industrie.' },
        { type: 'observe', text: 'Classez vos appareils du meilleur au moins bon facteur de puissance et justifiez avec la nature de chaque charge.' }
      ]
    },
    {
      id: 'm5', level: 2, title: 'Les consommations cachées (veille)', duration: '20 min', icon: '👻',
      comp: ['Mesurer une faible puissance', 'Évaluer un gisement d’économie'],
      intro: 'Un téléviseur « éteint » à la télécommande consomme encore. Combien sur une année ?',
      theory: '<p>Énergie annuelle de veille : <b>E = P × 24 h × 365 j</b>. Astuce de mesure : pour mieux mesurer les très faibles courants, on peut faire passer plusieurs fois le fil dans le tore du capteur (réglage « passages dans le tore »).</p>',
      steps: [
        { type: 'action', text: 'Mesurez un appareil en veille (TV éteinte à la télécommande, chargeur sans téléphone, box…) : prise allumée et P entre 0,2 W et 10 W.', check: function (s, ctx) { const k = anyOutlet(s, function (o) { return o.on && o.p > 0.2 && o.p < 10; }); if (k >= 0) { ctx.p = s.outlets[k].p; return true; } return false; }, hints: ['En démonstration : choisissez « Téléviseur » et décochez l’interrupteur de l’appareil (veille).', 'Le capteur 100 A ne mesure pas les courants inférieurs à 20 mA (≈ 4 W).'] },
        { type: 'numeric', text: 'Calculez l’énergie consommée par cette veille en un an (kWh).', unit: 'kWh', answer: function (s, ctx) { return ctx.shared.p * 8.76; }, tolRel: 0.1, hints: ['P × 24 × 365 donne des Wh ; divisez par 1 000 pour obtenir des kWh.'] },
        { type: 'numeric', text: 'Combien coûte cette veille par an ?', unitFn: function () { return cfg() ? cfg().tariff.currency : ''; }, answer: function (s, ctx) { return ctx.shared.p * 8.76 * (cfg() ? cfg().tariff.priceHP : 1); }, tolRel: 0.12, hints: ['Multipliez l’énergie annuelle (kWh) par le prix du kWh.'] },
        { type: 'qcm', text: 'Quelle solution supprime cette consommation sans gêner l’utilisateur ?', options: ['Couper la prise automatiquement quand l’appareil est inactif et que personne n’est là', 'Débrancher le compteur', 'Augmenter la puissance souscrite'], correct: 0, explain: 'C’est l’algorithme « tueur de veille » que vous programmerez au niveau Optimiser.' }
      ]
    },
    {
      id: 'm6', level: 3, title: 'Commander les relais et régler leurs paramètres', duration: '20 min', icon: '🎚️',
      comp: ['Configurer un actionneur', 'Comprendre les contraintes de commutation'],
      intro: 'Un relais ne doit pas commuter trop souvent : les appareils à moteur (réfrigérateur, climatiseur) peuvent être endommagés. Le kit impose donc un délai minimum entre deux commutations.',
      theory: '<p>Le relais est un interrupteur électromécanique. Le paramètre <b>délai entre commutations</b> fixe le temps minimum entre deux changements d’état ; une commande trop rapide est mise <b>en attente</b>.</p>',
      steps: [
        { type: 'action', text: 'Onglet « Mesures », prise 1 : réglez le « délai entre commutations » à 5 s et appliquez.', check: function () { return cfg() && cfg().outlets[0].minSwitchS >= 5; }, hints: ['Le panneau « Paramètres du relais et du capteur » se trouve en bas de la page Mesures.'] },
        { type: 'action', text: 'Allumez puis éteignez immédiatement la prise 1 : la seconde commande doit être retardée (badge « commutation en attente »).', check: function (s) { return s.outlets[0].pending; }, hints: ['Cliquez deux fois rapidement sur l’interrupteur de la prise 1.'] },
        { type: 'qcm', text: 'Pourquoi limiter la fréquence de commutation d’un relais ?', options: ['Pour protéger les contacts du relais et les appareils (moteurs, compresseurs)', 'Pour économiser le Wi-Fi', 'Pour que le capteur mesure plus vite'], correct: 0, explain: 'Chaque commutation use les contacts (étincelles) ; un compresseur redémarré trop tôt peut caler et chauffer.' },
        { type: 'action', text: 'Remettez le délai entre commutations de la prise 1 à 2 s.', check: function () { return cfg() && cfg().outlets[0].minSwitchS <= 2.5; }, hints: ['Même panneau, même champ.'] }
      ]
    },
    {
      id: 'm7', level: 3, title: 'Déclencher une protection en toute sécurité', duration: '15 min', icon: '⛔',
      comp: ['Paramétrer une protection', 'Réarmer après défaut'],
      intro: 'Le kit protège chaque prise : si la puissance dépasse la « puissance max », la prise est coupée et verrouillée.',
      theory: '<p>La protection logicielle s’ajoute aux protections matérielles (disjoncteur). Elle exige un <b>réarmement manuel</b> : on vérifie la cause avant de remettre sous tension.</p>',
      steps: [
        { type: 'action', text: 'Onglet « Mesures », prise 2 : réglez la « puissance max » à 50 W.', check: function () { return cfg() && cfg().outlets[1].maxPower <= 50; }, hints: ['Saisissez 50 puis « Appliquer » dans le panneau des paramètres de la prise 2.'] },
        { type: 'action', text: 'Faites fonctionner sur la prise 2 un appareil de plus de 50 W : la prise doit se couper et se verrouiller.', check: function (s) { return s.outlets[1].latched; }, hints: ['Une lampe halogène, un ventilateur ou une bouilloire conviennent.', 'Le kit coupe après deux mesures au-dessus du seuil (ou immédiatement au-delà de 1,5 × le seuil).'] },
        { type: 'qcm', text: 'Que signifie « prise verrouillée » ?', options: ['Elle reste coupée jusqu’à un réarmement volontaire', 'Elle se rallume seule après 10 s', 'Le capteur est en panne'], correct: 0, explain: 'Comme un disjoncteur : on ne remet pas sous tension sans avoir trouvé la cause.' },
        { type: 'action', text: 'Remettez la puissance max de la prise 2 à 2 000 W, puis réarmez la prise (bouton « Réarmer »).', check: function (s) { return cfg() && cfg().outlets[1].maxPower >= 1500 && !s.outlets[1].latched; }, hints: ['Le bouton « Réarmer » apparaît sur la carte de la prise verrouillée (onglet Maison).'] }
      ]
    },
    {
      id: 'm8', level: 3, title: 'Régler les paramètres des capteurs', duration: '15 min', icon: '📡',
      comp: ['Paramétrer un capteur', 'Comprendre l’échantillonnage et le filtrage'],
      intro: 'Un capteur numérique mesure à intervalles réguliers (période d’échantillonnage). On peut lisser les mesures en faisant la moyenne des dernières valeurs.',
      theory: '<p><b>Période de mesure</b> : temps entre deux lectures. <b>Lissage</b> : moyenne glissante des N dernières mesures, qui réduit le bruit mais ralentit la réaction.</p>',
      steps: [
        { type: 'action', text: 'Onglet « Mesures » : réglez la période de mesure à 5 000 ms.', check: function () { return cfg() && cfg().measure.sampleMs >= 5000; }, hints: ['Champ « Période de mesure (toutes prises) ».'] },
        { type: 'observe', text: 'Allumez et éteignez une lampe : qu’observez-vous sur la vitesse de mise à jour de la puissance ?' },
        { type: 'action', text: 'Réglez maintenant la période à 1 000 ms et le lissage à 5 mesures.', check: function () { return cfg() && cfg().measure.sampleMs <= 1000 && cfg().measure.smoothN >= 5; }, hints: ['Deux champs à modifier puis « Appliquer ».'] },
        { type: 'qcm', text: 'Quel est l’effet du lissage sur 5 mesures ?', options: ['Les valeurs fluctuent moins, mais réagissent plus lentement aux changements', 'Les mesures deviennent plus précises et plus rapides', 'Aucun effet'], correct: 0, explain: 'C’est un compromis classique en instrumentation : filtrer le bruit retarde la réponse.' },
        { type: 'action', text: 'Remettez le lissage à 1.', check: function () { return cfg() && cfg().measure.smoothN === 1; }, hints: [] }
      ]
    },
    {
      id: 'm9', level: 4, title: 'Mon premier programme', duration: '20 min', icon: '🧩',
      comp: ['Concevoir un algorithme séquentiel avec une boucle', 'Exécuter un programme sur un système embarqué'],
      intro: 'Sans écrire de code : assemblez des blocs comme dans Scratch. Le programme est compilé puis exécuté par le kit lui-même.',
      theory: '<p>Un <b>événement</b> déclenche le script (« quand le programme démarre »). Une <b>boucle</b> répète des instructions. Le bloc <b>attendre</b> met le script en pause.</p>',
      steps: [
        { type: 'action', text: 'Onglet « Programmer » : ouvrez l’exemple « Mon premier programme : clignotant » (bouton Exemples), puis cliquez sur « Envoyer au kit ». La prise 1 doit changer d’état au moins 2 fois.', check: function (s, ctx) { if (ctx.sw0 === undefined) ctx.sw0 = s.outlets[0].switches; return s.vm.status === 1 && s.outlets[0].switches >= ctx.sw0 + 2; }, hints: ['Exemples → « Mon premier programme : clignotant » → Ouvrir.', 'Cliquez ensuite sur « Envoyer au kit » (ou « Exécuter » en démonstration).'] },
        { type: 'qcm', text: 'Pourquoi faut-il un bloc « attendre » dans la boucle ?', options: ['Sans attente, la prise devrait changer d’état en permanence, beaucoup trop vite', 'Le bloc attendre économise de l’énergie', 'Pour que le programme compile'], correct: 0, explain: 'Le processeur exécute des milliers d’instructions par seconde. Les appareils, eux, ont besoin de temps.' },
        { type: 'action', text: 'Modifiez le programme pour faire une minuterie : remplacez la boucle par « allumer la prise 1 pendant 30 secondes » et envoyez-le.', check: function (s) { return s.outlets[0].pulseLeft > 0; }, hints: ['Le bloc « allumer la prise … pendant … secondes » est dans la catégorie Prises.'] },
        { type: 'observe', text: 'Ouvrez « Code » : comparez le pseudo-code et le langage machine (bytecode). Combien d’instructions votre programme contient-il ?' }
      ]
    },
    {
      id: 'm10', level: 4, title: 'Programmer une alerte', duration: '20 min', icon: '🚨',
      comp: ['Utiliser un événement conditionnel', 'Relier capteur et action'],
      intro: 'Vous allez programmer une surveillance : une alerte quand la puissance totale dépasse un seuil.',
      theory: '<p>Le bloc <b>« quand … devient vrai »</b> réagit au passage de faux à vrai : une seule alerte par dépassement, au lieu d’une alerte toutes les secondes.</p>',
      steps: [
        { type: 'action', text: 'Créez et envoyez un programme qui envoie une alerte quand la puissance totale dépasse 1 000 W, puis dépassez 1 000 W.', check: function (s, ctx) { if (ctx.seq0 === undefined) ctx.seq0 = EL.app.lastLogSeq; return s.vm.status === 1 && logsSince(ctx.seq0, function (e) { return e.level === 3 && !/Protection|Sécurité|Erreur/.test(e.msg); }); }, hints: ['Événements → « quand … devient vrai » ; Opérateurs → « … > … » ; Mesures → « puissance totale (W) » ; Alertes → « envoyer l’alerte ».', 'Vous pouvez partir de l’exemple « Alerte de surconsommation » et changer le seuil.'] },
        { type: 'qcm', text: 'Avec « toutes les 1 secondes : si P > 1 000 alors alerte », que se passe-t-il pendant un dépassement de 2 minutes ?', options: ['120 alertes (une par seconde)', 'Une seule alerte', 'Aucune alerte'], correct: 0, explain: 'D’où l’intérêt de l’événement « devient vrai » (détection de front montant).' },
        { type: 'observe', text: 'Proposez une amélioration : comment éviter une alerte pour un dépassement très bref (bouilloire de 3 minutes) ?' }
      ]
    },
    {
      id: 'm11', level: 5, title: 'Délestage : rester sous la puissance souscrite', duration: '30 min', icon: '⚖️',
      comp: ['Mettre en œuvre un algorithme de régulation', 'Analyser un compromis puissance / confort'],
      intro: 'Si la maison appelle plus que la puissance souscrite, le disjoncteur du compteur coupe tout. Le délestage coupe d’abord les appareils les moins prioritaires.',
      theory: '<p>Algorithme glouton : tant que P totale &gt; limite, couper la prise allumée de plus faible priorité ; quand la marge revient, rallumer la plus prioritaire.</p>',
      steps: [
        { type: 'action', text: 'Envoyez au kit l’exemple « Délestage intelligent par priorités » (ou votre propre version).', check: function (s) { return s.vm.status === 1 && /lestage/i.test(s.vm.name); }, hints: ['Onglet IA → Algorithmes → « Ouvrir dans l’éditeur », puis « Envoyer au kit ».'] },
        { type: 'action', text: 'Allumez plusieurs appareils pour dépasser la puissance souscrite : une prise doit être délestée.', check: function (s) { return anyOutlet(s, function (o) { return o.shed; }) >= 0; }, hints: ['Pour faciliter l’expérience, baissez la puissance souscrite (bloc « régler la puissance souscrite » ou réglages).'] },
        { type: 'qcm', text: 'Quelle prise est coupée en premier ?', options: ['La prise allumée la moins prioritaire (numéro de priorité le plus grand)', 'La prise qui consomme le plus', 'Une prise au hasard'], correct: 0, explain: 'La priorité 1 est la plus importante. Le chauffage (priorité 4 par défaut) supporte une courte coupure.' },
        { type: 'observe', text: 'Le délestage améliore la sécurité du contrat mais peut gêner l’utilisateur. Quel appareil ne faut-il jamais délester longtemps, et pourquoi ?' }
      ]
    },
    {
      id: 'm12', level: 5, title: 'Comparer des algorithmes dans l’arène', duration: '30 min', icon: '🏟️',
      comp: ['Évaluer des algorithmes avec des indicateurs', 'Argumenter un choix technique'],
      intro: 'Un ingénieur compare objectivement plusieurs solutions. L’arène simule une journée complète en quelques secondes.',
      theory: '<p>Indicateurs : énergie, coût, pointe, minutes de dépassement, confort (service rendu, température, eau chaude), usure (commutations).</p>',
      steps: [
        { type: 'action', text: 'Onglet IA → Arène : lancez le scénario « Journée d’hiver » avec « Aucun algorithme » et « Heures creuses (chauffe-eau, lave-linge) ».', check: function () { const a = EL.lastArena; return !!a && a.scenario === 'hiver' && a.res.some(function (r) { return r.id === 'none'; }) && a.res.some(function (r) { return /Heures creuses/.test(r.label); }); }, hints: ['Choisissez les deux concurrents dans les listes puis « Lancer la journée simulée ».'] },
        { type: 'numeric', text: 'De combien de % le coût baisse-t-il avec « Heures creuses » par rapport à « Aucun algorithme » ?', unit: '%', answer: function () { const a = EL.lastArena; const ref = a.res.find(function (r) { return r.id === 'none'; }) || a.res[0], hc = a.res.find(function (r) { return /Heures creuses/.test(r.label); }); return (ref.cost - hc.cost) / ref.cost * 100; }, tolAbs: 2, hints: ['Baisse (%) = (coût de référence − coût de l’algorithme) / coût de référence × 100.'] },
        { type: 'qcm', text: 'Pourquoi l’algorithme « Heures creuses + préchauffage » a-t-il été conçu ?', options: ['Pour garder assez d’eau chaude pour la douche du soir tout en évitant la pointe', 'Pour consommer plus', 'Pour tester le Wi-Fi'], correct: 0, explain: 'Optimiser seulement le coût peut dégrader le confort : c’est un problème multi-objectifs.' },
        { type: 'observe', text: 'Rédigez une recommandation (3 lignes) : quel algorithme conseillez-vous à cette famille et pourquoi ?' }
      ]
    },
    {
      id: 'm13', level: 5, title: 'Tueur de veille et éclairage intelligent', duration: '25 min', icon: '💡',
      comp: ['Combiner plusieurs capteurs', 'Programmer une logique conditionnelle'],
      intro: 'Le détecteur de présence et le capteur de lumière permettent d’éviter les gaspillages.',
      theory: '<p>Opérateurs logiques : « A et B » est vrai si les deux le sont ; « non A » inverse A.</p>',
      steps: [
        { type: 'action', text: 'Envoyez (ou simulez) l’exemple « Éclairage intelligent » ou « Tueur de veille ».', check: function (s) { return s.vm.status === 1 && /clairage|veille/i.test(s.vm.name); }, hints: ['IA → Algorithmes → Économiser.', 'Dans l’éditeur, le bouton « Simuler » utilise la maison virtuelle : décochez « Quelqu’un est présent » pour tester.'] },
        { type: 'qcm', text: 'Dans « présence détectée ET luminosité < seuil », la lampe s’allume :', options: ['seulement s’il y a quelqu’un ET qu’il fait sombre', 'dès qu’il y a quelqu’un', 'dès qu’il fait sombre'], correct: 0, explain: 'C’est la table de vérité du ET logique.' },
        { type: 'observe', text: 'Pourquoi le délai de présence (60 s par défaut) est-il utile ?' }
      ]
    },
    {
      id: 'm14', level: 5, title: 'Entraîner une intelligence artificielle', duration: '30 min', icon: '🤖',
      comp: ['Comprendre l’apprentissage supervisé', 'Évaluer les limites d’un modèle'],
      intro: 'L’IA du kit apprend à reconnaître les appareils à partir de leurs mesures (k plus proches voisins).',
      theory: '<p>Apprentissage <b>supervisé</b> : on donne des exemples étiquetés (mesure → nom). Pour une nouvelle mesure, on cherche les <b>k</b> exemples les plus proches et on vote.</p>',
      steps: [
        { type: 'action', text: 'Onglet IA → Reconnaissance : apprenez au moins 2 appareils différents, avec au moins 2 exemples chacun.', check: function () { const k = EL.app.knn; return !!k && k.labels.filter(function (l) { return l.n >= 2; }).length >= 2; }, hints: ['Branchez l’appareil, écrivez son nom, cliquez « Apprendre cet exemple » ; recommencez.'] },
        { type: 'action', text: 'Branchez l’un des appareils appris : l’IA doit le reconnaître (nom affiché sur la carte de la prise).', check: function (s) { return anyOutlet(s, function (o) { return o.appliance > 0; }) >= 0; }, hints: ['L’étoile sur le graphique doit être proche des points de l’appareil.'] },
        { type: 'qcm', text: 'Deux appareils différents ont presque la même puissance et le même facteur de puissance. Que va faire l’IA ?', options: ['Elle risque de les confondre : ces deux caractéristiques ne suffisent pas à les distinguer', 'Elle les distingue toujours parfaitement', 'Elle refuse de fonctionner'], correct: 0, explain: 'Une IA ne voit que les caractéristiques qu’on lui donne. Il faudrait d’autres informations (forme du courant, durée de fonctionnement…).' },
        { type: 'qcm', text: 'Que représente k dans « k plus proches voisins » ?', options: ['Le nombre d’exemples consultés pour voter', 'Le nombre d’appareils', 'La puissance maximale'], correct: 0, explain: 'Avec k = 1, on suit le plus proche exemple (sensible aux erreurs) ; avec k plus grand, le vote est plus robuste.' }
      ]
    },
    {
      id: 'm15', level: 5, title: 'Le thermostat à hystérésis', duration: '25 min', icon: '🌡️',
      comp: ['Comprendre une régulation tout-ou-rien', 'Analyser l’effet d’un paramètre'],
      intro: 'Un thermostat allume le chauffage sous la consigne et l’éteint au-dessus. L’hystérésis évite les commutations incessantes.',
      theory: '<p>Chauffer si T &lt; consigne − h ; arrêter si T &gt; consigne + h. Plus h est grand, moins il y a de commutations, mais plus la température varie.</p>',
      steps: [
        { type: 'action', text: 'Simulez l’exemple « Thermostat à hystérésis » (bouton « Simuler »), avec le convecteur sur la prise 3, à la vitesse ×60.', check: function () { const v = EL.views.programmer; return !!v && !!v.twin && v.twin.core.machine.status === 1 && /Thermostat/.test(v.twin.core.machine.prog.name); }, hints: ['Exemples → « Thermostat à hystérésis » → Simuler ; dans la maison virtuelle, choisissez « Convecteur 1000 W » sur la prise 3 et cochez son interrupteur.'] },
        { type: 'qcm', text: 'Si on passe l’hystérésis de 0,5 °C à 0,1 °C :', options: ['Le nombre de commutations augmente', 'Le nombre de commutations diminue', 'Rien ne change'], correct: 0, explain: 'La plage de température tolérée est plus étroite : le relais commute plus souvent.' },
        { type: 'observe', text: 'Pourquoi un thermostat économise-t-il de l’énergie par rapport à un convecteur laissé allumé en continu ?' }
      ]
    },
    {
      id: 'm16', level: 6, title: 'Défi : le meilleur gestionnaire d’énergie', duration: '45 min', icon: '🏆',
      comp: ['Concevoir une solution multi-objectifs', 'Valider par l’expérimentation'],
      intro: 'Créez votre propre programme et battez la référence dans l’arène « Journée d’hiver » : coût réduit d’au moins 15 %, sans douche froide et sans dégrader le confort thermique.',
      theory: '<p>Combinez les idées : thermostat, heures creuses, préchauffage, délestage… Testez, mesurez, améliorez : c’est la démarche d’ingénierie.</p>',
      steps: [
        { type: 'action', text: 'Dans l’arène « Journée d’hiver », comparez « Aucun algorithme » et « Mon programme (éditeur de blocs) ». Votre programme doit réduire le coût d’au moins 15 %, avec 0 douche froide et un inconfort thermique au plus égal à celui de la référence + 0,5 °C·h.', check: function () {
          const a = EL.lastArena;
          if (!a || a.scenario !== 'hiver') return false;
          const ref = a.res.find(function (r) { return r.id === 'none'; });
          const mine = a.res.find(function (r) { return r.id === '__editor'; });
          return !!ref && !!mine && mine.cost <= ref.cost * 0.85 && mine.coldDraws === 0 && mine.thermalDegH <= ref.thermalDegH + 0.5;
        }, hints: ['Point de départ possible : l’exemple « Gestionnaire d’énergie complet ».', 'Regardez quels indicateurs se dégradent et pourquoi : chauffe-eau, chauffage, lave-linge…'] },
        { type: 'observe', text: 'Présentez votre solution : principe, résultats (tableau de l’arène) et limites.' }
      ]
    }
  ];

  const BADGES = { 1: ['🥉', 'Électricien·ne débutant·e'], 2: ['🔬', 'Expérimentateur·rice'], 3: ['🎚️', 'Technicien·ne'], 4: ['🧩', 'Programmeur·se'], 5: ['🧠', 'Ingénieur·e énergie'], 6: ['🏆', 'Expert·e EnergyLab'] };

  // ---------------------------------------------------------------- progression
  function progKey() { return 'progress.' + ((EL.app.profile && EL.app.profile.name) || 'anonyme'); }
  function loadProg() { return U.store.get(progKey(), {}); }
  function saveProg(p) { U.store.set(progKey(), p); }
  function mprog(p, id) { return p[id] || (p[id] = { done: {}, answers: {}, hints: {}, errors: {}, shared: {}, started: Date.now(), completed: 0 }); }

  function scaffold() { return EL.app.config ? EL.app.config.peda.scaffold : 1; }

  // ---------------------------------------------------------------- vue
  const view = {
    mount: function (main, args) {
      this.main = main;
      if (args[0]) this.openMission(args[0]);
      else this.renderList();
    },
    unmount: function () { clearInterval(this.timer); },
    renderList: function () {
      const main = this.main, p = loadProg();
      U.clear(main);
      main.appendChild(h('div.page-head', [h('div', [h('h1', 'Missions'), h('p', 'Travaux pratiques guidés, du plus simple au plus avancé. Les étapes se valident automatiquement grâce aux mesures du kit.')])]));
      const total = MISSIONS.length, done = MISSIONS.filter(function (m) { return p[m.id] && p[m.id].completed; }).length;
      const badges = h('div.row');
      for (let l = 1; l <= 6; l++) {
        const ms = MISSIONS.filter(function (m) { return m.level === l; });
        const ok = ms.every(function (m) { return p[m.id] && p[m.id].completed; });
        badges.appendChild(h('span.badge' + (ok ? '.ok' : ''), { title: BADGES[l][1], style: { fontSize: '.9rem', opacity: ok ? 1 : 0.45 } }, BADGES[l][0] + ' ' + BADGES[l][1]));
      }
      main.appendChild(h('div.card', [
        h('div.row.between', [h('b', 'Progression : ' + done + ' / ' + total + ' missions'), h('span.small.muted', 'Guidage : ' + ['fort', 'adaptatif', 'faible'][scaffold()])]),
        h('div.progress', { style: { margin: '8px 0' } }, h('i', { style: { width: (done / total * 100) + '%' } })),
        badges
      ]));
      for (let l = 1; l <= 6; l++) {
        main.appendChild(h('h2', { style: { margin: '18px 0 10px' } }, 'Niveau ' + l + ' — ' + LEVELS[l]));
        main.appendChild(h('div.mission-list', MISSIONS.filter(function (m) { return m.level === l; }).map(function (m) {
          const mp = p[m.id];
          const nd = mp ? Object.keys(mp.done).length : 0;
          return h('div.card.mission' + (mp && mp.completed ? '.done' : ''), { onclick: function () { location.hash = '#/missions/' + m.id; } }, [
            h('div.row.between', [h('span.lvl', 'Niveau ' + m.level + ' · ' + m.duration), mp && mp.completed ? h('span.badge.ok', '✓ terminée') : (nd ? h('span.badge.info', nd + '/' + m.steps.length) : null)]),
            h('h3', { style: { margin: '6px 0' } }, m.icon + ' ' + m.title),
            h('p.small.muted', { style: { margin: 0 } }, m.intro)
          ]);
        })));
      }
    },
    openMission: function (id) {
      const m = MISSIONS.find(function (x) { return x.id === id; });
      if (!m) { this.renderList(); return; }
      const self = this, main = this.main;
      U.clear(main);
      const p = loadProg(), mp = mprog(p, m.id);
      if (!mp.startedLogged) { mp.startedLogged = true; saveProg(p); EL.track('mission_start', m.id); }
      this.m = m;
      this.ctxs = {};
      this.stepStart = Date.now();
      main.appendChild(h('div.row', { style: { marginBottom: '10px' } }, [h('a.btn.small', { href: '#/missions' }, '← Toutes les missions')]));
      main.appendChild(h('div.card', [
        h('div.lvl.small', { style: { color: 'var(--primary)', fontWeight: 800 } }, 'NIVEAU ' + m.level + ' — ' + LEVELS[m.level].toUpperCase() + ' · ' + m.duration),
        h('h1', { style: { margin: '6px 0' } }, m.icon + ' ' + m.title),
        h('p', m.intro),
        h('div.row', m.comp.map(function (c) { return h('span.badge.prim', '🎯 ' + c); })),
        h('details', { style: { marginTop: '10px' }, open: scaffold() === 0 }, [h('summary', h('b', '📖 Rappel de cours')), h('div.small', { html: m.theory })])
      ]));
      this.stepsBox = h('ol.steps', { style: { marginTop: '14px' } });
      main.appendChild(this.stepsBox);
      this.endBox = h('div');
      main.appendChild(this.endBox);
      this.renderSteps();
      this.timer = setInterval(function () { self.tickHints(); }, 5000);
    },
    current: function () {
      const p = loadProg(), mp = mprog(p, this.m.id);
      for (let i = 0; i < this.m.steps.length; i++) if (!mp.done[i]) return i;
      return -1;
    },
    renderSteps: function () {
      const self = this, m = this.m, box = this.stepsBox;
      const p = loadProg(), mp = mprog(p, m.id);
      U.clear(box);
      const cur = this.current();
      const sc = scaffold();
      this.stepEls = [];
      m.steps.forEach(function (st, i) {
        const done = !!mp.done[i];
        // guidage fort : seule l'étape courante est détaillée ; guidage faible : tout est visible
        const visible = done || i === cur || sc === 2 || (sc === 1 && i <= cur + 1);
        const li = h('li' + (done ? '.ok' : (i === cur ? '.current' : '')));
        li.appendChild(h('div', { html: st.text }));
        if (!visible) { li.classList.add('muted'); li.firstChild.textContent = 'Étape verrouillée : terminez d’abord les étapes précédentes.'; box.appendChild(li); self.stepEls.push(null); return; }
        const ctl = h('div', { style: { marginTop: '8px' } });
        const hintBox = h('div');
        li.append(ctl, hintBox);
        const ctx = self.ctxs[i] = self.ctxs[i] || { shared: mp.shared };
        if (done) {
          if (mp.answers[i] !== undefined) ctl.appendChild(h('div.small.muted', 'Votre réponse : ' + mp.answers[i]));
        } else if (st.type === 'action') {
          ctl.appendChild(h('div.row', [h('span.badge.info', '⏳ validation automatique'), h('button.btn.small', { onclick: function () { self.checkAction(i, true); } }, 'Vérifier')]));
        } else if (st.type === 'numeric') {
          const inp = h('input.inp', { type: 'number', step: 'any', style: { width: '150px' } });
          const unit = st.unitFn ? st.unitFn() : (st.unit || '');
          const fb = h('div.small');
          ctl.append(h('div.row', [inp, h('span', unit), h('button.btn.small.primary', { onclick: function () { self.checkNumeric(i, inp, fb); } }, 'Valider')]), fb);
        } else if (st.type === 'qcm') {
          const name = 'q' + m.id + i;
          const fb = h('div.small');
          const opts = h('div.qcm', st.options.map(function (o, j) { return h('label', [h('input', { type: 'radio', name: name, value: j }), o]); }));
          ctl.append(opts, h('button.btn.small.primary', { onclick: function () { self.checkQcm(i, opts, fb); } }, 'Valider'), fb);
        } else if (st.type === 'observe') {
          const ta = h('textarea.inp', { rows: 3, style: { width: '100%' }, placeholder: 'Votre observation / réponse…' });
          ctl.append(ta, h('button.btn.small.primary', { style: { marginTop: '6px' }, onclick: function () {
            if (ta.value.trim().length < 10) { EL.toast('Rédigez une réponse un peu plus complète', 'warn'); return; }
            self.complete(i, ta.value.trim());
          } }, 'Valider ma réponse'));
        }
        if (!done && st.hints && st.hints.length) {
          const shown = mp.hints[i] || 0;
          for (let j = 0; j < shown; j++) hintBox.appendChild(h('div.note.tip', { style: { marginTop: '6px' } }, '💡 ' + st.hints[j]));
          if (shown < st.hints.length && sc !== 0) hintBox.appendChild(h('button.btn.small.ghost', { style: { marginTop: '4px' }, onclick: function () { self.giveHint(i, 'demande'); } }, sc === 2 ? 'Je suis bloqué·e (indice)' : 'Un indice ?'));
        }
        box.appendChild(li);
        self.stepEls.push(li);
      });
      U.clear(this.endBox);
      if (mp.completed) {
        this.endBox.appendChild(h('div.card', { style: { marginTop: '14px', textAlign: 'center' } }, [
          h('div.badge-big', '🎉'), h('h2', 'Mission terminée !'),
          h('p', 'Durée : ' + U.fmtDuration((mp.completed - mp.started) / 1000) + ' · indices utilisés : ' + Object.values(mp.hints).reduce(function (a, b) { return a + b; }, 0) + ' · erreurs : ' + Object.values(mp.errors).reduce(function (a, b) { return a + b; }, 0)),
          h('div.row', { style: { justifyContent: 'center' } }, [h('a.btn.primary', { href: '#/missions' }, 'Mission suivante'), h('button.btn', { onclick: function () { self.reset(); } }, 'Recommencer')])
        ]));
      }
    },
    giveHint: function (i, why) {
      const p = loadProg(), mp = mprog(p, this.m.id);
      const st = this.m.steps[i];
      const n = mp.hints[i] || 0;
      if (!st.hints || n >= st.hints.length) return;
      mp.hints[i] = n + 1;
      saveProg(p);
      EL.track('mission_hint', { mission: this.m.id, step: i, n: n + 1, why: why });
      this.renderSteps();
    },
    tickHints: function () {
      // étayage : indices automatiques selon le mode
      const i = this.current();
      if (i < 0) return;
      const sc = scaffold(), st = this.m.steps[i];
      if (st.type === 'action') this.checkAction(i, false);
      if (!st.hints || !st.hints.length) return;
      const p = loadProg(), mp = mprog(p, this.m.id);
      const shown = mp.hints[i] || 0;
      const waited = (Date.now() - this.stepStart) / 1000;
      const errors = mp.errors[i] || 0;
      if (sc === 0 && shown < st.hints.length && waited > 20 + shown * 40) this.giveHint(i, 'auto-fort');
      else if (sc === 1 && shown < st.hints.length && (errors >= 2 * (shown + 1) || waited > 120 + shown * 120)) this.giveHint(i, errors ? 'auto-erreurs' : 'auto-temps');
    },
    checkAction: function (i, manual) {
      const s = EL.app.state;
      if (!s) return;
      const st = this.m.steps[i];
      const ctx = this.ctxs[i] || (this.ctxs[i] = { shared: mprog(loadProg(), this.m.id).shared });
      let ok = false;
      try { ok = !!st.check(s, ctx); } catch (e) { ok = false; }
      if (ok) {
        // les valeurs capturées sont partagées avec les étapes suivantes
        const p = loadProg(), mp = mprog(p, this.m.id);
        for (const k of Object.keys(ctx)) if (k !== 'shared') mp.shared[k] = ctx[k];
        saveProg(p);
        this.complete(i);
      } else if (manual) {
        EL.toast('Pas encore : vérifiez les conditions demandées', 'warn');
        this.error(i);
      }
    },
    checkNumeric: function (i, inp, fb) {
      const st = this.m.steps[i], s = EL.app.state;
      const v = Number(String(inp.value).replace(',', '.'));
      if (!Number.isFinite(v) || inp.value === '') { fb.textContent = 'Entrez un nombre.'; return; }
      const ctx = this.ctxs[i] || { shared: mprog(loadProg(), this.m.id).shared };
      let target;
      try { target = st.answer(s, ctx); } catch (e) { target = NaN; }
      if (!Number.isFinite(target)) { fb.textContent = 'Impossible de vérifier pour l’instant (mesure absente).'; return; }
      const ok = st.tolAbs !== undefined ? Math.abs(v - target) <= st.tolAbs : Math.abs(v - target) <= Math.abs(target) * (st.tolRel || 0.05) + 1e-9;
      EL.track('mission_answer', { mission: this.m.id, step: i, value: v, expected: +target.toFixed(4), ok: ok });
      if (ok) { this.complete(i, String(v)); EL.toast('Bonne réponse ! (valeur attendue ≈ ' + U.fmt(target, Math.abs(target) < 10 ? 2 : 1) + ')', 'ok'); }
      else {
        fb.style.color = 'var(--danger)';
        fb.textContent = v > target ? 'Trop grand. Vérifiez votre calcul et les unités.' : 'Trop petit. Vérifiez votre calcul et les unités.';
        this.error(i);
      }
    },
    checkQcm: function (i, opts, fb) {
      const st = this.m.steps[i];
      const sel = opts.querySelector('input:checked');
      if (!sel) { fb.textContent = 'Choisissez une réponse.'; return; }
      const j = Number(sel.value), ok = j === st.correct;
      EL.track('mission_answer', { mission: this.m.id, step: i, choice: j, ok: ok });
      U.$$('label', opts).forEach(function (l, k) { l.classList.remove('right', 'wrong'); if (k === j) l.classList.add(ok ? 'right' : 'wrong'); });
      if (ok) {
        EL.toast('Exact !', 'ok');
        const self = this;
        if (st.explain) EL.modal({ title: '✓ Bonne réponse', body: h('p', st.explain), onClose: function () { self.complete(i, st.options[j]); } });
        else this.complete(i, st.options[j]);
      } else {
        fb.style.color = 'var(--danger)';
        fb.textContent = 'Ce n’est pas la bonne réponse. ' + (scaffold() === 0 && st.explain ? 'Indice : ' + st.explain.split('.')[0] + '.' : 'Réessayez.');
        this.error(i);
      }
    },
    error: function (i) {
      const p = loadProg(), mp = mprog(p, this.m.id);
      mp.errors[i] = (mp.errors[i] || 0) + 1;
      saveProg(p);
    },
    complete: function (i, answer) {
      const p = loadProg(), mp = mprog(p, this.m.id);
      if (mp.done[i]) return;
      mp.done[i] = Date.now();
      if (answer !== undefined) mp.answers[i] = answer;
      EL.track('mission_step_ok', { mission: this.m.id, step: i, seconds: Math.round((Date.now() - this.stepStart) / 1000), hints: mp.hints[i] || 0, errors: mp.errors[i] || 0, answer: answer });
      this.stepStart = Date.now();
      if (Object.keys(mp.done).length === this.m.steps.length && !mp.completed) {
        mp.completed = Date.now();
        EL.track('mission_complete', { mission: this.m.id, seconds: Math.round((mp.completed - mp.started) / 1000) });
        if (EL.app.kit) EL.app.kit.cmd({ cmd: 'beep', n: 3 });
      }
      saveProg(p);
      this.renderSteps();
    },
    reset: async function () {
      if (!(await EL.confirm('Recommencer', 'Effacer votre progression sur cette mission ?', 'Recommencer'))) return;
      const p = loadProg();
      delete p[this.m.id];
      saveProg(p);
      this.openMission(this.m.id);
    }
  };

  EL.MISSIONS = MISSIONS;
  EL.views.missions = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);

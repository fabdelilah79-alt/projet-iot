/* EnergyLab — blocs de programmation (style Scratch, moteur Blockly)
 * Chaque bloc correspond à une ou plusieurs instructions du bytecode (docs/specs/bytecode.md). */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};

  // Options dynamiques : noms des prises et appareils appris (mis à jour par l'application)
  const dyn = {
    outlets: ['Salon', 'Cuisine', 'Chambre', 'Bureau'],
    labels: []  // [{id, name}]
  };
  function outletOptions() {
    return dyn.outlets.map(function (n, i) { return [(i + 1) + ' · ' + n, String(i + 1)]; });
  }
  function labelOptions() {
    const o = [['aucun appareil (P < 1 W)', '0'], ['un appareil inconnu', '-1']];
    for (const l of dyn.labels) o.push([l.name, String(l.id)]);
    return o;
  }

  const STYLES = {
    el_events: { colourPrimary: '#FFBF00', colourSecondary: '#E6AC00', colourTertiary: '#CC9900', hat: 'cap' },
    el_control: { colourPrimary: '#FFAB19', colourSecondary: '#EC9C13', colourTertiary: '#CF8B17' },
    el_operators: { colourPrimary: '#59C059', colourSecondary: '#46B946', colourTertiary: '#389438' },
    el_sensing: { colourPrimary: '#4C97FF', colourSecondary: '#4280D7', colourTertiary: '#3373CC' },
    el_env: { colourPrimary: '#5CB1D6', colourSecondary: '#47A8D1', colourTertiary: '#2E8EB8' },
    el_outlets: { colourPrimary: '#0FBD8C', colourSecondary: '#0DA57A', colourTertiary: '#0B8E69' },
    el_params: { colourPrimary: '#9966FF', colourSecondary: '#855CD6', colourTertiary: '#774DCB' },
    el_ai: { colourPrimary: '#FF6680', colourSecondary: '#FF4D6A', colourTertiary: '#FF3355' },
    el_display: { colourPrimary: '#CF63CF', colourSecondary: '#C94FC9', colourTertiary: '#BD42BD' },
    variable_blocks: { colourPrimary: '#FF8C1A', colourSecondary: '#FF8000', colourTertiary: '#DB6E00' },
    variable_dynamic_blocks: { colourPrimary: '#FF8C1A', colourSecondary: '#FF8000', colourTertiary: '#DB6E00' },
    math_blocks: { colourPrimary: '#59C059', colourSecondary: '#46B946', colourTertiary: '#389438' },
    logic_blocks: { colourPrimary: '#59C059', colourSecondary: '#46B946', colourTertiary: '#389438' }
  };
  const CAT = {
    events: '#FFBF00', control: '#FFAB19', operators: '#59C059', variables: '#FF8C1A', sensing: '#4C97FF',
    env: '#5CB1D6', outlets: '#0FBD8C', params: '#9966FF', ai: '#FF6680', display: '#CF63CF'
  };

  const DO = { type: 'input_statement', name: 'DO' };
  const COND = { type: 'input_value', name: 'COND', check: 'Boolean' };
  const OUTLET = { type: 'input_value', name: 'OUTLET', check: 'Number' };
  function num(name) { return { type: 'input_value', name: name, check: 'Number' }; }
  function stmt(o) { o.previousStatement = null; o.nextStatement = null; return o; }

  const OUTLET_PARAMS = [
    ['la puissance max (W)', '0'], ["le seuil d'alarme du capteur (W)", '1'], ['la priorité (1 à 4)', '2'],
    ["l'état au démarrage (0, 1 ou 2)", '3'], ['le délai entre commutations (s)', '4'], ['le seuil de veille (W)', '5']
  ];
  const GLOBAL_PARAMS = [
    ['la puissance souscrite (W)', '12'], ['la période de mesure (ms)', '10'], ['le lissage (nb de mesures)', '11'],
    ['le prix heures pleines (/kWh)', '13'], ['le prix heures creuses (/kWh)', '14'], ['la consigne de température (°C)', '15'],
    ["l'hystérésis (°C)", '16'], ['le seuil de luminosité (%)', '17'], ['le délai de présence (s)', '18'],
    ['le facteur CO₂ (g/kWh)', '19'], ["le seuil d'anomalie (z)", '20'], ['le k des k plus proches voisins', '21'],
    ['le début des heures creuses (min)', '22'], ['la fin des heures creuses (min)', '23']
  ];
  const QTY = [
    ['puissance P (W)', '2'], ['tension U (V)', '0'], ['courant I (A)', '1'], ['puissance apparente S (VA)', '3'],
    ['puissance réactive Q (var)', '4'], ['facteur de puissance', '5'], ['déphasage φ (°)', '13'], ['fréquence (Hz)', '6'],
    ["énergie aujourd'hui (Wh)", '8'], ["coût aujourd'hui", '9'], ["compteur d'énergie (kWh)", '7'], ["commutations aujourd'hui", '14']
  ];

  const DEFS = [
    // ------------------------------------------------------------ Événements
    { type: 'el_on_start', message0: '▶ quand le programme démarre', message1: '%1', args1: [DO], style: 'el_events', tooltip: 'Exécute les blocs une seule fois, au démarrage du programme.' },
    { type: 'el_every', message0: '⏱ toutes les %1 secondes', args0: [{ type: 'field_number', name: 'PERIOD', value: 5, min: 0.1, max: 86400, precision: 0.1 }], message1: '%1', args1: [DO], style: 'el_events', tooltip: 'Exécute les blocs régulièrement (la première fois dès le démarrage).' },
    { type: 'el_when', message0: '⚡ quand %1 devient vrai', args0: [COND], message1: '%1', args1: [DO], style: 'el_events', tooltip: "Exécute les blocs à l'instant où la condition passe de faux à vrai." },
    { type: 'el_at', message0: '🕐 chaque jour à %1 h %2', args0: [{ type: 'field_number', name: 'H', value: 7, min: 0, max: 23, precision: 1 }, { type: 'field_number', name: 'M', value: 0, min: 0, max: 59, precision: 1 }], message1: '%1', args1: [DO], style: 'el_events', tooltip: "Exécute les blocs chaque jour à l'heure indiquée (horloge du kit)." },
    { type: 'el_button', message0: '🔘 quand on appuie sur le bouton %1', args0: [{ type: 'field_dropdown', name: 'BTN', options: [['A', '1'], ['B', '2'], ['C', '3'], ['D', '4']] }], message1: '%1', args1: [DO], style: 'el_events', tooltip: "Exécute les blocs quand on appuie sur ce bouton dans l'application (console du programme)." },
    // ------------------------------------------------------------ Contrôle
    stmt({ type: 'el_wait', message0: 'attendre %1 secondes', args0: [num('SECS')], inputsInline: true, style: 'el_control', tooltip: 'Met ce script en pause. Les autres scripts continuent.' }),
    stmt({ type: 'el_repeat', message0: 'répéter %1 fois', args0: [num('TIMES')], message1: '%1', args1: [DO], inputsInline: true, style: 'el_control', tooltip: 'Répète les blocs un nombre donné de fois.' }),
    { type: 'el_forever', message0: 'répéter indéfiniment', message1: '%1', args1: [DO], previousStatement: null, style: 'el_control', tooltip: "Répète les blocs sans fin. Pensez à ajouter un bloc « attendre » à l'intérieur." },
    stmt({ type: 'el_while', message0: 'tant que %1', args0: [COND], message1: '%1', args1: [DO], style: 'el_control', tooltip: 'Répète les blocs tant que la condition est vraie.' }),
    stmt({ type: 'el_until', message0: "répéter jusqu'à ce que %1", args0: [COND], message1: '%1', args1: [DO], style: 'el_control', tooltip: 'Répète les blocs jusqu’à ce que la condition devienne vraie.' }),
    stmt({ type: 'el_wait_until', message0: "attendre jusqu'à ce que %1", args0: [COND], style: 'el_control', tooltip: 'Met ce script en pause jusqu’à ce que la condition soit vraie.' }),
    stmt({ type: 'el_if', message0: 'si %1 alors', args0: [COND], message1: '%1', args1: [DO], style: 'el_control', tooltip: 'Exécute les blocs seulement si la condition est vraie.' }),
    stmt({ type: 'el_ifelse', message0: 'si %1 alors', args0: [COND], message1: '%1', args1: [DO], message2: 'sinon', message3: '%1', args3: [{ type: 'input_statement', name: 'ELSE' }], style: 'el_control', tooltip: 'Choisit entre deux suites de blocs selon la condition.' }),
    { type: 'el_stop', message0: 'arrêter %1', args0: [{ type: 'field_dropdown', name: 'WHAT', options: [['ce script', '0'], ['tout le programme', '1']] }], previousStatement: null, style: 'el_control', tooltip: 'Arrête ce script ou tout le programme.' },
    // ------------------------------------------------------------ Opérateurs
    { type: 'el_arith', message0: '%1 %2 %3', args0: [num('A'), { type: 'field_dropdown', name: 'OP', options: [['+', 'ADD'], ['−', 'SUB'], ['×', 'MUL'], ['÷', 'DIV'], ['modulo', 'MOD']] }, num('B')], inputsInline: true, output: 'Number', style: 'el_operators', tooltip: 'Calcul. La division par zéro donne 0.' },
    { type: 'el_compare', message0: '%1 %2 %3', args0: [num('A'), { type: 'field_dropdown', name: 'OP', options: [['>', 'GT'], ['<', 'LT'], ['≥', 'GE'], ['≤', 'LE'], ['=', 'EQ'], ['≠', 'NE']] }, num('B')], inputsInline: true, output: 'Boolean', style: 'el_operators', tooltip: 'Compare deux nombres (vrai ou faux). Une mesure absente (--) rend la comparaison fausse.' },
    { type: 'el_logic', message0: '%1 %2 %3', args0: [{ type: 'input_value', name: 'A', check: 'Boolean' }, { type: 'field_dropdown', name: 'OP', options: [['et', 'AND'], ['ou', 'OR']] }, { type: 'input_value', name: 'B', check: 'Boolean' }], inputsInline: true, output: 'Boolean', style: 'el_operators', tooltip: '« et » : les deux conditions sont vraies ; « ou » : au moins une est vraie.' },
    { type: 'el_not', message0: 'non %1', args0: [{ type: 'input_value', name: 'A', check: 'Boolean' }], output: 'Boolean', style: 'el_operators', tooltip: 'Inverse la condition.' },
    { type: 'el_bool', message0: '%1', args0: [{ type: 'field_dropdown', name: 'V', options: [['vrai', '1'], ['faux', '0']] }], output: 'Boolean', style: 'el_operators', tooltip: 'Valeur logique.' },
    { type: 'el_math', message0: '%1 de %2', args0: [{ type: 'field_dropdown', name: 'FN', options: [['valeur absolue', '0'], ['arrondi', '1'], ['partie entière', '2'], ['arrondi supérieur', '3'], ['racine carrée', '4'], ['carré', '5']] }, num('A')], inputsInline: true, output: 'Number', style: 'el_operators', tooltip: 'Fonction mathématique.' },
    { type: 'el_minmax', message0: '%1 de %2 et %3', args0: [{ type: 'field_dropdown', name: 'OP', options: [['minimum', 'MIN'], ['maximum', 'MAX']] }, num('A'), num('B')], inputsInline: true, output: 'Number', style: 'el_operators', tooltip: 'Le plus petit ou le plus grand des deux nombres.' },
    { type: 'el_random', message0: 'nombre aléatoire entre %1 et %2', args0: [num('A'), num('B')], inputsInline: true, output: 'Number', style: 'el_operators', tooltip: 'Nombre au hasard (entier si les deux bornes sont entières).' },
    { type: 'el_between', message0: '%1 est entre %2 et %3', args0: [num('X'), num('A'), num('B')], inputsInline: true, output: 'Boolean', style: 'el_operators', tooltip: 'Vrai si la valeur est comprise entre les deux bornes (incluses).' },
    // ------------------------------------------------------------ Mesures
    { type: 'el_sensor', message0: '%1 de la prise %2', args0: [{ type: 'field_dropdown', name: 'QTY', options: QTY }, OUTLET], inputsInline: true, output: 'Number', style: 'el_sensing', tooltip: 'Mesure fournie par le capteur PZEM-004T de la prise.' },
    { type: 'el_outlet_state', message0: 'la prise %1 est %2', args0: [OUTLET, { type: 'field_dropdown', name: 'STATE', options: [['allumée', '10'], ['éteinte', '-10'], ['verrouillée (protection)', '12'], ['en ligne (capteur OK)', '11']] }], inputsInline: true, output: 'Boolean', style: 'el_sensing', tooltip: 'État de la prise.' },
    { type: 'el_global', message0: '%1', args0: [{ type: 'field_dropdown', name: 'Q', options: [['puissance totale (W)', '0'], ["énergie totale aujourd'hui (Wh)", '1'], ["coût total aujourd'hui", '2'], ['tension moyenne (V)', '15'], ['pointe de puissance du jour (W)', '16'], ["CO₂ émis aujourd'hui (g)", '17'], ['nombre de prises allumées', '18'], ['prix actuel du kWh', '14']] }], output: 'Number', style: 'el_sensing', tooltip: 'Grandeur pour toute la maison.' },
    { type: 'el_env', message0: '%1', args0: [{ type: 'field_dropdown', name: 'Q', options: [['température (°C)', '3'], ['luminosité (%)', '5'], ['humidité (%)', '4']] }], output: 'Number', style: 'el_env', tooltip: 'Capteurs d’ambiance (DHT22, photorésistance).' },
    { type: 'el_presence', message0: 'présence détectée', output: 'Boolean', style: 'el_env', tooltip: 'Vrai si le détecteur de mouvement a vu quelqu’un récemment (délai de présence).' },
    { type: 'el_time', message0: '%1', args0: [{ type: 'field_dropdown', name: 'Q', options: [['heure', '7'], ['minute', '8'], ['seconde', '9'], ['jour de la semaine (1 = lundi)', '10'], ['minutes depuis minuit', '11'], ['secondes depuis le démarrage du programme', '12']] }], output: 'Number', style: 'el_env', tooltip: 'Horloge du kit.' },
    { type: 'el_time_between', message0: "l'heure est entre %1 h %2 et %3 h %4", args0: [{ type: 'field_number', name: 'H1', value: 22, min: 0, max: 23, precision: 1 }, { type: 'field_number', name: 'M1', value: 0, min: 0, max: 59, precision: 1 }, { type: 'field_number', name: 'H2', value: 6, min: 0, max: 23, precision: 1 }, { type: 'field_number', name: 'M2', value: 0, min: 0, max: 59, precision: 1 }], output: 'Boolean', style: 'el_env', tooltip: 'Vrai entre les deux heures (la plage peut passer minuit). La seconde heure est exclue.' },
    { type: 'el_offpeak', message0: 'heures creuses en cours', output: 'Boolean', style: 'el_env', tooltip: 'Vrai pendant les heures creuses définies par le tarif.' },
    // ------------------------------------------------------------ Prises
    stmt({ type: 'el_relay', message0: '%1 la prise %2', args0: [{ type: 'field_dropdown', name: 'ACTION', options: [['allumer', '1'], ['éteindre', '0']] }, OUTLET], inputsInline: true, style: 'el_outlets', tooltip: 'Commande le relais de la prise (le délai minimum entre deux commutations est respecté).' }),
    stmt({ type: 'el_relay_all', message0: '%1 toutes les prises', args0: [{ type: 'field_dropdown', name: 'ACTION', options: [['allumer', '1'], ['éteindre', '0']] }], style: 'el_outlets', tooltip: 'Commande les quatre prises.' }),
    stmt({ type: 'el_toggle', message0: 'inverser la prise %1', args0: [OUTLET], inputsInline: true, style: 'el_outlets', tooltip: 'Allume la prise si elle est éteinte, l’éteint sinon.' }),
    stmt({ type: 'el_pulse', message0: 'allumer la prise %1 pendant %2 secondes', args0: [OUTLET, num('SECS')], inputsInline: true, style: 'el_outlets', tooltip: 'Minuterie : la prise s’éteint seule après la durée (le script continue tout de suite).' }),
    stmt({ type: 'el_relay_set', message0: "mettre la prise %1 à l'état %2", args0: [OUTLET, { type: 'input_value', name: 'STATE', check: 'Boolean' }], inputsInline: true, style: 'el_outlets', tooltip: 'Allume la prise si la condition est vraie, l’éteint sinon.' }),
    // ------------------------------------------------------------ Paramètres
    stmt({ type: 'el_param_outlet_set', message0: 'régler %1 de la prise %2 à %3', args0: [{ type: 'field_dropdown', name: 'PARAM', options: OUTLET_PARAMS }, OUTLET, num('VALUE')], inputsInline: true, style: 'el_params', tooltip: 'Change un paramètre du relais ou du capteur de la prise (dans les limites fixées par l’enseignant).' }),
    stmt({ type: 'el_param_set', message0: 'régler %1 à %2', args0: [{ type: 'field_dropdown', name: 'PARAM', options: GLOBAL_PARAMS }, num('VALUE')], inputsInline: true, style: 'el_params', tooltip: 'Change un paramètre du kit.' }),
    { type: 'el_param_outlet_get', message0: '%1 de la prise %2', args0: [{ type: 'field_dropdown', name: 'PARAM', options: OUTLET_PARAMS }, OUTLET], inputsInline: true, output: 'Number', style: 'el_params', tooltip: 'Valeur actuelle du paramètre.' },
    { type: 'el_param_get', message0: '%1', args0: [{ type: 'field_dropdown', name: 'PARAM', options: GLOBAL_PARAMS }], output: 'Number', style: 'el_params', tooltip: 'Valeur actuelle du paramètre.' },
    stmt({ type: 'el_reset_energy', message0: 'remettre à zéro le compteur de la prise %1', args0: [OUTLET], inputsInline: true, style: 'el_params', tooltip: 'Remet à zéro le compteur interne du capteur PZEM (autorisation de l’enseignant nécessaire).' }),
    // ------------------------------------------------------------ Intelligence
    { type: 'el_ai_avg', message0: 'moyenne de P de la prise %1 sur %2 s', args0: [OUTLET, num('N')], inputsInline: true, output: 'Number', style: 'el_ai', tooltip: 'Moyenne glissante de la puissance (filtre les variations rapides).' },
    { type: 'el_ai_total', message0: '%1 de la puissance totale sur %2 s', args0: [{ type: 'field_dropdown', name: 'Q', options: [['moyenne', '1'], ['maximum', '2']] }, num('N')], inputsInline: true, output: 'Number', style: 'el_ai', tooltip: 'Statistique sur l’historique (600 s maximum).' },
    { type: 'el_ai_trend', message0: 'tendance de la puissance totale sur %1 s (W/min)', args0: [num('N')], inputsInline: true, output: 'Number', style: 'el_ai', tooltip: 'Pente de la droite de régression linéaire : positive si la consommation augmente.' },
    { type: 'el_ai_forecast', message0: 'prévision de la puissance totale dans %1 min', args0: [num('N')], inputsInline: true, output: 'Number', style: 'el_ai', tooltip: 'Prévision par lissage exponentiel double (méthode de Holt).' },
    { type: 'el_ai_anomaly', message0: 'anomalie détectée sur la prise %1', args0: [OUTLET], inputsInline: true, output: 'Boolean', style: 'el_ai', tooltip: 'Vrai si la consommation s’écarte brutalement de son comportement habituel (score z).' },
    { type: 'el_ai_idle', message0: "durée d'inactivité de la prise %1 (s)", args0: [OUTLET], inputsInline: true, output: 'Number', style: 'el_ai', tooltip: 'Temps passé allumée sous le seuil de veille (appareil en veille ou inutilisé).' },
    stmt({ type: 'el_shed', message0: 'délester par priorités pour rester sous %1 W', args0: [num('LIMIT')], inputsInline: true, style: 'el_ai', tooltip: 'Une étape de délestage : coupe la prise la moins prioritaire si la limite est dépassée, rallume quand il y a de la marge.' }),
    // ------------------------------------------------------------ Alertes et affichage
    stmt({ type: 'el_alert', message0: "envoyer l'alerte %1", args0: [{ type: 'field_input', name: 'TEXT', text: 'Attention !' }], style: 'el_display', tooltip: 'Affiche une alerte sur l’application et sur l’écran du kit.' }),
    stmt({ type: 'el_log', message0: 'écrire %1', args0: [{ type: 'field_input', name: 'TEXT', text: 'Bonjour' }], style: 'el_display', tooltip: 'Écrit un message dans la console du programme.' }),
    stmt({ type: 'el_log_value', message0: 'écrire %1 %2', args0: [{ type: 'field_input', name: 'TEXT', text: 'P =' }, { type: 'input_value', name: 'VALUE' }], inputsInline: true, style: 'el_display', tooltip: 'Écrit un message suivi d’une valeur dans la console.' }),
    stmt({ type: 'el_beep', message0: 'bip %1', args0: [{ type: 'field_dropdown', name: 'KIND', options: [['court', '0'], ['long', '1'], ['alarme', '2'], ['succès', '3']] }], style: 'el_display', tooltip: 'Joue un son sur le buzzer du kit.' }),
    stmt({ type: 'el_screen', message0: "afficher sur l'écran du kit %1", args0: [{ type: 'field_input', name: 'TEXT', text: 'Bonjour !' }], style: 'el_display', tooltip: 'Affiche un message pendant 10 s sur l’écran OLED du kit.' })
  ];

  let defined = false;
  function define(Blockly) {
    if (defined) return;
    defined = true;
    Blockly.common.defineBlocksWithJsonArray(DEFS);
    Blockly.Blocks.el_outlet_menu = {
      init: function () {
        this.appendDummyInput().appendField(new Blockly.FieldDropdown(outletOptions), 'OUTLET');
        this.setOutput(true, 'Number');
        this.setStyle('el_sensing');
        this.setTooltip('Numéro de la prise (on peut aussi y glisser une variable).');
      }
    };
    Blockly.Blocks.el_ai_appliance = {
      init: function () {
        this.appendValueInput('OUTLET').setCheck('Number').appendField("l'appareil reconnu sur la prise");
        this.appendDummyInput().appendField('est').appendField(new Blockly.FieldDropdown(labelOptions), 'LABEL');
        this.setInputsInline(true);
        this.setOutput(true, 'Boolean');
        this.setStyle('el_ai');
        this.setTooltip('Intelligence artificielle : reconnaissance de l’appareil par les k plus proches voisins (à entraîner dans l’onglet IA).');
      }
    };
  }

  function theme(Blockly) {
    return Blockly.Theme.defineTheme('energylab', {
      base: Blockly.Themes.Classic,
      blockStyles: STYLES,
      categoryStyles: {},
      componentStyles: {
        workspaceBackgroundColour: '#F7F8FA', toolboxBackgroundColour: '#FFFFFF', toolboxForegroundColour: '#3B4252',
        flyoutBackgroundColour: '#EEF1F5', flyoutForegroundColour: '#3B4252', flyoutOpacity: 0.96,
        scrollbarColour: '#C9CED6', insertionMarkerColour: '#000000', insertionMarkerOpacity: 0.25
      },
      fontStyle: { family: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', weight: '600', size: 11 },
      startHats: true
    });
  }

  // ---------------------------------------------------------------- boîte à outils
  function sh(type, fields) { return { shadow: { type: type, fields: fields || {} } }; }
  function n(v) { return sh('math_number', { NUM: v }); }
  function out(k) { return sh('el_outlet_menu', { OUTLET: String(k || 1) }); }
  function b(type, inputs, fields) { const o = { kind: 'block', type: type }; if (inputs) o.inputs = inputs; if (fields) o.fields = fields; return o; }
  // bloc imbriqué (sans « kind »)
  function nb(type, inputs, fields) { const o = { type: type }; if (inputs) o.inputs = inputs; if (fields) o.fields = fields; return o; }
  function label(text) { return { kind: 'label', text: text }; }

  function toolbox() {
    return {
      kind: 'categoryToolbox',
      contents: [
        { kind: 'category', name: 'Événements', colour: CAT.events, contents: [
          b('el_on_start'), b('el_every'), b('el_when', { COND: { block: nb('el_compare', { A: { block: nb('el_global') }, B: n(1500) }) } }), b('el_at'), b('el_button')
        ] },
        { kind: 'category', name: 'Contrôle', colour: CAT.control, contents: [
          b('el_wait', { SECS: n(1) }), b('el_repeat', { TIMES: n(4) }), b('el_forever'), b('el_if'), b('el_ifelse'),
          b('el_while'), b('el_until'), b('el_wait_until'), b('el_stop')
        ] },
        { kind: 'category', name: 'Opérateurs', colour: CAT.operators, contents: [
          b('el_compare', { A: n(0), B: n(100) }), b('el_logic'), b('el_not'), b('el_bool'),
          b('el_arith', { A: n(0), B: n(0) }), b('el_minmax', { A: n(0), B: n(0) }), b('el_math', { A: n(0) }),
          b('el_between', { X: n(0), A: n(0), B: n(10) }), b('el_random', { A: n(1), B: n(10) }), b('math_number')
        ] },
        { kind: 'category', name: 'Variables', colour: CAT.variables, custom: 'VARIABLE' },
        { kind: 'category', name: 'Mesures', colour: CAT.sensing, contents: [
          label('Mesures de chaque prise'),
          b('el_sensor', { OUTLET: out(1) }), b('el_outlet_state', { OUTLET: out(1) }),
          label('Toute la maison'), b('el_global'),
          label('Ambiance et temps'), b('el_env'), b('el_presence'), b('el_time'), b('el_time_between'), b('el_offpeak')
        ] },
        { kind: 'category', name: 'Prises', colour: CAT.outlets, contents: [
          b('el_relay', { OUTLET: out(1) }), b('el_relay_all'), b('el_toggle', { OUTLET: out(1) }),
          b('el_pulse', { OUTLET: out(1), SECS: n(10) }), b('el_relay_set', { OUTLET: out(1) })
        ] },
        { kind: 'category', name: 'Paramètres', colour: CAT.params, contents: [
          label('Relais et capteur de chaque prise'),
          b('el_param_outlet_set', { OUTLET: out(1), VALUE: n(1500) }), b('el_param_outlet_get', { OUTLET: out(1) }),
          label('Paramètres du kit'),
          b('el_param_set', { VALUE: n(3000) }), b('el_param_get'), b('el_reset_energy', { OUTLET: out(1) })
        ] },
        { kind: 'category', name: 'Intelligence', colour: CAT.ai, contents: [
          b('el_shed', { LIMIT: { block: nb('el_param_get', null, { PARAM: '12' }) } }),
          b('el_ai_forecast', { N: n(5) }), b('el_ai_trend', { N: n(120) }), b('el_ai_avg', { OUTLET: out(1), N: n(30) }),
          b('el_ai_total', { N: n(60) }), b('el_ai_anomaly', { OUTLET: out(1) }), b('el_ai_idle', { OUTLET: out(1) }),
          b('el_ai_appliance', { OUTLET: out(1) })
        ] },
        { kind: 'category', name: 'Alertes', colour: CAT.display, contents: [
          b('el_alert'), b('el_log'), b('el_log_value', { VALUE: { block: nb('el_global') } }), b('el_beep'), b('el_screen')
        ] }
      ]
    };
  }

  EL.blocks = { define, theme, toolbox, dyn, outletOptions, labelOptions, DEFS, STYLES, CAT, OUTLET_PARAMS, GLOBAL_PARAMS, QTY };
})(typeof globalThis !== 'undefined' ? globalThis : this);

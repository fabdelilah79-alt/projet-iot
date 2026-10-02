/* EnergyLab — bibliothèque de programmes exemples et d'algorithmes intelligents
 * Chaque exemple est un programme à blocs (format de sérialisation Blockly) que l'apprenant
 * peut ouvrir, comprendre, modifier, simuler et envoyer au kit. */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};

  // ---------------------------------------------------------------- petit constructeur de blocs
  let _id = 0;
  function id() { return 'ex' + (++_id); }
  const n = function (v) { return { shadow: { type: 'math_number', id: id(), fields: { NUM: v } } }; };
  const out = function (k) { return { shadow: { type: 'el_outlet_menu', id: id(), fields: { OUTLET: String(k) } } }; };
  const val = function (block) { return { block: block }; };
  function B(type, fields, inputs) {
    const o = { type: type, id: id() };
    if (fields) o.fields = fields;
    if (inputs) o.inputs = inputs;
    return o;
  }
  // enchaîne des blocs instruction
  function seq(list) {
    list = list.filter(Boolean);
    for (let i = 0; i < list.length - 1; i++) list[i].next = { block: list[i + 1] };
    return list[0];
  }
  function body(list) { return { block: seq(list) }; }
  function hat(type, fields, inputs, stmts, x, y) {
    const h = B(type, fields, inputs || {});
    if (stmts && stmts.length) h.inputs.DO = body(stmts);
    h.x = x || 20;
    h.y = y || 20;
    return h;
  }
  // expressions
  const E = {
    num: function (v) { return B('math_number', { NUM: v }); },
    total: function () { return B('el_global', { Q: '0' }); },
    global: function (q) { return B('el_global', { Q: String(q) }); },
    sensor: function (q, k) { return B('el_sensor', { QTY: String(q) }, { OUTLET: out(k) }); },
    state: function (k, st) { return B('el_outlet_state', { STATE: String(st) }, { OUTLET: out(k) }); },
    env: function (q) { return B('el_env', { Q: String(q) }); },
    presence: function () { return B('el_presence'); },
    offpeak: function () { return B('el_offpeak'); },
    param: function (p) { return B('el_param_get', { PARAM: String(p) }); },
    cmp: function (a, op, b) { return B('el_compare', { OP: op }, { A: val(a), B: val(b) }); },
    arith: function (a, op, b) { return B('el_arith', { OP: op }, { A: val(a), B: val(b) }); },
    and: function (a, b) { return B('el_logic', { OP: 'AND' }, { A: val(a), B: val(b) }); },
    or: function (a, b) { return B('el_logic', { OP: 'OR' }, { A: val(a), B: val(b) }); },
    not: function (a) { return B('el_not', null, { A: val(a) }); },
    forecast: function (m) { return B('el_ai_forecast', null, { N: n(m) }); },
    idle: function (k) { return B('el_ai_idle', null, { OUTLET: out(k) }); },
    anomaly: function (k) { return B('el_ai_anomaly', null, { OUTLET: out(k) }); },
    appliance: function (k, label) { return B('el_ai_appliance', { LABEL: String(label) }, { OUTLET: out(k) }); },
    timeBetween: function (h1, m1, h2, m2) { return B('el_time_between', { H1: h1, M1: m1, H2: h2, M2: m2 }); },
    v: function (vid) { return B('variables_get', { VAR: { id: vid } }); }
  };
  // instructions
  const S = {
    relay: function (k, on) { return B('el_relay', { ACTION: on ? '1' : '0' }, { OUTLET: out(k) }); },
    relayAll: function (on) { return B('el_relay_all', { ACTION: on ? '1' : '0' }); },
    pulse: function (k, s) { return B('el_pulse', null, { OUTLET: out(k), SECS: n(s) }); },
    wait: function (s) { return B('el_wait', null, { SECS: n(s) }); },
    if_: function (cond, stmts) { const b = B('el_if', null, { COND: val(cond) }); b.inputs.DO = body(stmts); return b; },
    ifelse: function (cond, a, b2) { const b = B('el_ifelse', null, { COND: val(cond) }); b.inputs.DO = body(a); b.inputs.ELSE = body(b2); return b; },
    forever: function (stmts) { const b = B('el_forever'); b.inputs = { DO: body(stmts) }; return b; },
    repeat: function (t, stmts) { const b = B('el_repeat', null, { TIMES: n(t) }); b.inputs.DO = body(stmts); return b; },
    shed: function (limitExpr) { return B('el_shed', null, { LIMIT: val(limitExpr) }); },
    alert: function (t) { return B('el_alert', { TEXT: t }); },
    log: function (t) { return B('el_log', { TEXT: t }); },
    logv: function (t, e) { return B('el_log_value', { TEXT: t }, { VALUE: val(e) }); },
    beep: function (k) { return B('el_beep', { KIND: String(k) }); },
    screen: function (t) { return B('el_screen', { TEXT: t }); },
    setParam: function (p, v) { return B('el_param_set', { PARAM: String(p) }, { VALUE: n(v) }); },
    setOutletParam: function (p, k, v) { return B('el_param_outlet_set', { PARAM: String(p) }, { OUTLET: out(k), VALUE: n(v) }); },
    set: function (vid, e) { return B('variables_set', { VAR: { id: vid } }, { VALUE: val(e) }); },
    change: function (vid, d) { return B('math_change', { VAR: { id: vid } }, { DELTA: n(d) }); }
  };
  function ws(hats, vars) {
    return { blocks: { languageVersion: 0, blocks: hats }, variables: (vars || []).map(function (v) { return { name: v[1], id: v[0] }; }) };
  }

  // ---------------------------------------------------------------- les exemples
  const LIST = [
    {
      id: 'clignotant', level: 1, title: 'Mon premier programme : clignotant', cat: 'Débuter',
      summary: 'Allume et éteint la prise 1 toutes les 3 secondes.',
      concepts: ['séquence', 'boucle', 'attente'],
      explain: 'Un programme est une suite d’instructions. La boucle « répéter indéfiniment » recommence sans fin. Le bloc « attendre » laisse le temps de voir le changement. Remarque : le kit impose un délai minimum entre deux commutations pour protéger les appareils.',
      build: function () {
        return ws([hat('el_on_start', null, null, [S.forever([S.relay(1, true), S.wait(3), S.relay(1, false), S.wait(3)])])]);
      }
    },
    {
      id: 'minuterie', level: 1, title: 'Minuterie', cat: 'Débuter',
      summary: 'Allume la prise 1 pendant 60 s puis l’éteint, en affichant la puissance mesurée.',
      concepts: ['minuterie', 'mesure', 'console'],
      explain: 'Le bloc « allumer pendant » programme une extinction automatique. Pendant ce temps, le programme écrit la puissance mesurée dans la console.',
      build: function () {
        return ws([hat('el_on_start', null, null, [S.pulse(1, 60), S.wait(5), S.logv('Puissance de la prise 1 (W) :', E.sensor(2, 1))])]);
      }
    },
    {
      id: 'horaire', level: 1, title: 'Programmation horaire', cat: 'Débuter',
      summary: 'Allume la prise 2 à 7 h 00 et l’éteint à 7 h 30 chaque jour.',
      concepts: ['événement horaire', 'automatisation'],
      explain: 'Les blocs « chaque jour à » se déclenchent selon l’horloge du kit (synchronisée par l’application).',
      build: function () {
        return ws([
          hat('el_at', { H: 7, M: 0 }, null, [S.relay(2, true), S.log('Cuisine allumée (7 h 00)')], 20, 20),
          hat('el_at', { H: 7, M: 30 }, null, [S.relay(2, false), S.log('Cuisine éteinte (7 h 30)')], 20, 160)
        ]);
      }
    },
    {
      id: 'alerte', level: 2, title: 'Alerte de surconsommation', cat: 'Surveiller',
      summary: 'Déclenche une alerte sonore et visuelle quand la puissance totale dépasse la puissance souscrite.',
      concepts: ['événement conditionnel', 'seuil', 'alerte'],
      explain: 'Le bloc « quand … devient vrai » réagit au passage du seuil (front montant) : l’alerte n’est envoyée qu’une fois par dépassement.',
      build: function () {
        return ws([hat('el_when', null, { COND: val(E.cmp(E.total(), 'GT', E.param(12))) }, [S.alert('Consommation trop élevée !'), S.beep(2), S.logv('Puissance totale (W) :', E.total())])]);
      }
    },
    {
      id: 'delestage_simple', level: 2, title: 'Délestage simple du chauffage', cat: 'Optimiser',
      summary: 'Coupe le chauffage (prise 3) quand la puissance totale dépasse la puissance souscrite, le rallume quand il y a de la marge.',
      concepts: ['délestage', 'hystérésis', 'puissance souscrite'],
      explain: 'Pour éviter de couper le disjoncteur général, on coupe d’abord un appareil peu prioritaire (le chauffage supporte une courte coupure). L’écart entre le seuil de coupure et le seuil de remise en marche (1 200 W) évite les commutations trop fréquentes : c’est une hystérésis.',
      build: function () {
        return ws([hat('el_every', { PERIOD: 2 }, null, [
          S.if_(E.cmp(E.total(), 'GT', E.param(12)), [S.relay(3, false), S.log('Surcharge : chauffage coupé')]),
          S.if_(E.cmp(E.total(), 'LT', E.arith(E.param(12), 'SUB', E.num(1200))), [S.relay(3, true)])
        ])]);
      }
    },
    {
      id: 'delestage', level: 3, title: 'Délestage intelligent par priorités', cat: 'Optimiser', arena: 'pointe',
      summary: 'Toutes les 2 s, coupe la prise la moins prioritaire en cas de dépassement et rallume dès qu’il y a de la marge.',
      concepts: ['algorithme glouton', 'priorités', 'boucle de régulation'],
      explain: 'Algorithme glouton : à chaque étape, il choisit la meilleure action locale (couper la prise de priorité la plus faible). Il mémorise la puissance de chaque prise coupée et ne la rallume que si la marge est suffisante (90 % de la limite). Les priorités se règlent dans les paramètres (1 = la plus importante).',
      build: function () {
        return ws([
          hat('el_on_start', null, null, [S.setOutletParam(2, 2, 1), S.setOutletParam(2, 1, 2), S.setOutletParam(2, 4, 3), S.setOutletParam(2, 3, 4)], 20, 20),
          hat('el_every', { PERIOD: 2 }, null, [S.shed(E.param(12))], 20, 260)
        ]);
      }
    },
    {
      id: 'predictif', level: 4, title: 'Écrêtage de pointe prédictif', cat: 'Optimiser', arena: 'pointe',
      summary: 'Utilise la prévision de Holt : si la puissance prévue dans 5 min dépasse la limite, on déleste avec une marge de sécurité.',
      concepts: ['prévision', 'lissage exponentiel', 'anticipation'],
      explain: 'Au lieu de réagir quand la limite est dépassée, l’algorithme anticipe : la méthode de Holt estime le niveau et la tendance de la consommation pour prévoir la puissance future. Si la prévision dépasse la puissance souscrite, la limite de délestage est abaissée à 90 %.',
      build: function () {
        return ws([hat('el_every', { PERIOD: 3 }, null, [
          S.ifelse(E.cmp(E.forecast(5), 'GT', E.param(12)),
            [S.shed(E.arith(E.param(12), 'MUL', E.num(0.9)))],
            [S.shed(E.param(12))])
        ])]);
      }
    },
    {
      id: 'heures_creuses', level: 3, title: 'Heures creuses (chauffe-eau, lave-linge)', cat: 'Optimiser', arena: 'hiver',
      summary: 'N’alimente la prise 4 qu’en heures creuses, quand le kWh est moins cher.',
      concepts: ['tarification horaire', 'déplacement de charge'],
      explain: 'Certains appareils peuvent attendre (chauffe-eau à accumulation, lave-linge) : on décale leur consommation vers les heures creuses. Attention au confort : l’eau chaude doit rester suffisante le soir !',
      build: function () {
        return ws([hat('el_every', { PERIOD: 30 }, null, [S.ifelse(E.offpeak(), [S.relay(4, true)], [S.relay(4, false)])])]);
      }
    },
    {
      id: 'heures_creuses_plus', level: 4, title: 'Heures creuses + préchauffage', cat: 'Optimiser', arena: 'hiver',
      summary: 'Heures creuses, plus une relance de 15 h à 17 h (heures pleines peu chargées) pour garantir l’eau chaude du soir.',
      concepts: ['compromis coût / confort', 'planification'],
      explain: 'Amélioration de l’algorithme précédent : une courte relance l’après-midi, quand la maison consomme peu, évite de manquer d’eau chaude le soir tout en évitant la pointe de 18 h – 21 h.',
      build: function () {
        return ws([hat('el_every', { PERIOD: 30 }, null, [S.ifelse(E.or(E.offpeak(), E.timeBetween(15, 0, 17, 0)), [S.relay(4, true)], [S.relay(4, false)])])]);
      }
    },
    {
      id: 'thermostat', level: 3, title: 'Thermostat à hystérésis', cat: 'Confort', arena: 'hiver',
      summary: 'Régule la température avec le chauffage de la prise 3 : consigne ± hystérésis, et mode éco en l’absence d’occupants.',
      concepts: ['régulation tout-ou-rien', 'hystérésis', 'présence'],
      explain: 'Régulation « tout ou rien » : on chauffe sous (consigne − hystérésis), on arrête au-dessus de (consigne + hystérésis). Une hystérésis trop faible multiplie les commutations ; trop forte, elle dégrade le confort. Sans présence, le chauffage est coupé.',
      build: function () {
        return ws([hat('el_every', { PERIOD: 10 }, null, [
          S.ifelse(E.presence(), [
            S.if_(E.cmp(E.env(3), 'LT', E.arith(E.param(15), 'SUB', E.param(16))), [S.relay(3, true)]),
            S.if_(E.cmp(E.env(3), 'GT', E.arith(E.param(15), 'ADD', E.param(16))), [S.relay(3, false)])
          ], [S.relay(3, false)])
        ])]);
      }
    },
    {
      id: 'veille', level: 2, title: 'Tueur de veille', cat: 'Économiser', arena: 'veille',
      summary: 'Coupe le salon (prise 1) après 5 min d’inactivité si personne n’est là, et le rallume dès qu’une présence est détectée.',
      concepts: ['consommation de veille', 'détection d’inactivité'],
      explain: 'Les appareils en veille consomment en permanence quelques watts. Sur une année, cela représente plusieurs dizaines de kWh. Le programme utilise la durée d’inactivité (P sous le seuil de veille) et le détecteur de présence.',
      build: function () {
        return ws([hat('el_every', { PERIOD: 10 }, null, [
          S.if_(E.and(E.cmp(E.idle(1), 'GT', E.num(300)), E.not(E.presence())), [S.relay(1, false), S.log('Veille coupée : salon')]),
          S.if_(E.and(E.presence(), E.state(1, -10)), [S.relay(1, true)])
        ])]);
      }
    },
    {
      id: 'eclairage', level: 2, title: 'Éclairage intelligent', cat: 'Économiser', arena: 'veille',
      summary: 'Allume la lampe (prise 1) seulement s’il y a quelqu’un et qu’il fait sombre.',
      concepts: ['capteurs', 'logique combinatoire'],
      explain: 'La décision combine deux capteurs avec l’opérateur « et ». Le délai de présence évite d’éteindre dès qu’on reste immobile.',
      build: function () {
        return ws([hat('el_every', { PERIOD: 5 }, null, [
          S.relay(1, false),
          S.if_(E.and(E.presence(), E.cmp(E.env(5), 'LT', E.param(17))), [S.relay(1, true)])
        ])]);
      }
    },
    {
      id: 'anomalie', level: 3, title: 'Détection d’anomalie', cat: 'Surveiller',
      summary: 'Alerte quand la consommation de la cuisine (prise 2) change brutalement par rapport à son comportement habituel.',
      concepts: ['statistiques', 'score z', 'apprentissage en ligne'],
      explain: 'Le kit apprend en continu la moyenne et la dispersion de la puissance (moyenne exponentielle). Un écart de plus de z écarts-types pendant 3 s est une anomalie. On peut régler le seuil z : trop bas, il y a de fausses alertes ; trop haut, on rate des anomalies.',
      build: function () {
        return ws([hat('el_when', null, { COND: val(E.anomaly(2)) }, [S.alert('Consommation inhabituelle en cuisine'), S.logv('P cuisine (W) :', E.sensor(2, 2))])]);
      }
    },
    {
      id: 'ia_appareil', level: 4, title: 'IA : priorité à la bouilloire', cat: 'Intelligence',
      summary: 'Si l’IA reconnaît la bouilloire sur la prise 2 et que la limite est dépassée, le chauffage est coupé le temps qu’elle chauffe.',
      concepts: ['apprentissage supervisé', 'k plus proches voisins', 'décision'],
      explain: 'Entraînez d’abord l’IA dans l’onglet « IA » (exemple « Bouilloire »). Le programme combine la reconnaissance d’appareil (k-NN sur puissance et facteur de puissance) avec une règle de délestage.',
      build: function () {
        return ws([hat('el_every', { PERIOD: 2 }, null, [
          S.ifelse(E.and(E.appliance(2, 1), E.cmp(E.total(), 'GT', E.param(12))), [S.relay(3, false), S.log('Bouilloire détectée : chauffage suspendu')], [S.relay(3, true)])
        ])]);
      }
    },
    {
      id: 'combine', level: 5, title: 'Gestionnaire d’énergie complet', cat: 'Défi', arena: 'hiver',
      summary: 'Combine thermostat, heures creuses avec préchauffage et délestage par priorités.',
      concepts: ['système multi-objectifs', 'compromis', 'architecture'],
      explain: 'Un vrai gestionnaire d’énergie poursuit plusieurs objectifs à la fois : coût, puissance de pointe, confort. Chaque script s’occupe d’un objectif ; le délestage garde le dernier mot pour la sécurité du contrat.',
      build: function () {
        return ws([
          hat('el_every', { PERIOD: 10 }, null, [
            S.ifelse(E.presence(), [
              S.if_(E.cmp(E.env(3), 'LT', E.arith(E.param(15), 'SUB', E.param(16))), [S.relay(3, true)]),
              S.if_(E.cmp(E.env(3), 'GT', E.arith(E.param(15), 'ADD', E.param(16))), [S.relay(3, false)])
            ], [S.relay(3, false)])
          ], 20, 20),
          hat('el_every', { PERIOD: 30 }, null, [S.ifelse(E.or(E.offpeak(), E.timeBetween(15, 0, 17, 0)), [S.relay(4, true)], [S.relay(4, false)])], 20, 330),
          hat('el_every', { PERIOD: 2 }, null, [S.shed(E.param(12))], 20, 520)
        ]);
      }
    },
    {
      id: 'parametres', level: 2, title: 'Régler les paramètres par programme', cat: 'Paramètres',
      summary: 'Règle la période de mesure, le lissage, la puissance max et le seuil d’alarme du capteur de la prise 1, puis affiche les valeurs.',
      concepts: ['paramètres de capteur', 'paramètres de relais', 'filtrage'],
      explain: 'Les capteurs et les relais ont des paramètres : période d’échantillonnage, lissage (moyenne glissante), protection en puissance, seuil d’alarme interne du PZEM, délai entre commutations. Observez l’effet du lissage sur les mesures !',
      build: function () {
        return ws([hat('el_on_start', null, null, [
          S.setParam(10, 2000), S.setParam(11, 3),
          S.setOutletParam(0, 1, 1500), S.setOutletParam(1, 1, 1200), S.setOutletParam(4, 1, 5),
          S.logv('Période de mesure (ms) :', E.param(10)),
          S.logv('Lissage (mesures) :', E.param(11)),
          S.logv('Puissance max prise 1 (W) :', B('el_param_outlet_get', { PARAM: '0' }, { OUTLET: out(1) }))
        ])]);
      }
    },
    {
      id: 'compteur', level: 2, title: 'Compter les allumages (variables)', cat: 'Débuter',
      summary: 'Utilise une variable pour compter combien de fois la bouilloire (prise 2) a été utilisée.',
      concepts: ['variable', 'événement', 'compteur'],
      explain: 'Une variable mémorise une valeur. À chaque fois que la puissance de la prise 2 dépasse 500 W, on ajoute 1 au compteur.',
      build: function () {
        return ws([
          hat('el_on_start', null, null, [S.set('vCompteur', E.num(0))], 20, 20),
          hat('el_when', null, { COND: val(E.cmp(E.sensor(2, 2), 'GT', E.num(500))) }, [S.change('vCompteur', 1), S.logv('Utilisations de la bouilloire :', E.v('vCompteur'))], 20, 140)
        ], [['vCompteur', 'compteur']]);
      }
    }
  ];

  function get(idv) { return LIST.find(function (e) { return e.id === idv; }); }

  EL.examples = { LIST: LIST, get: get, builder: { B: B, E: E, S: S, hat: hat, ws: ws, n: n, out: out, val: val, seq: seq } };
})(typeof globalThis !== 'undefined' ? globalThis : this);

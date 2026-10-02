/* EnergyLab — réglages (enseignant) : prises, réseau, tarifs, capteurs, sécurité, pédagogie,
 * MQTT, outils des capteurs PZEM (adressage), données et maintenance */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  if (typeof document === 'undefined') return;
  const U = EL.util, h = U.h;

  const ICON_CHOICES = [['lamp', '💡 lampe'], ['kettle', '🫖 bouilloire'], ['heater', '🔥 chauffage'], ['laptop', '💻 ordinateur'], ['tv', '📺 TV'], ['fridge', '🧊 réfrigérateur'], ['fan', '🌀 ventilateur'], ['washer', '🧺 lave-linge'], ['charger', '🔋 chargeur'], ['microwave', '🍲 micro-ondes'], ['iron', '👔 fer'], ['ac', '❄️ climatiseur'], ['water_heater', '🚿 chauffe-eau'], ['router', '📶 box'], ['motor', '🛠️ moteur'], ['plug', '🔌 prise']];

  function minToHHMM(m) { return U.pad2(Math.floor(m / 60)) + ':' + U.pad2(m % 60); }
  function hhmmToMin(s) { const p = String(s).split(':'); return (Number(p[0]) || 0) * 60 + (Number(p[1]) || 0); }

  // champ lié à un chemin de configuration ; renvoie {el, get}
  function field(cfg, path, label, opts) {
    opts = opts || {};
    const parts = path.split('.');
    let v = cfg;
    for (const p of parts) v = v === undefined ? undefined : v[p];
    let inp;
    if (opts.type === 'select') {
      inp = h('select', opts.options.map(function (o) { return h('option', { value: o[0] }, o[1]); }));
      inp.value = String(v);
    } else if (typeof v === 'boolean') {
      inp = h('input', { type: 'checkbox', checked: v });
      return { el: h('label.check', [inp, label]), path: path, get: function () { return inp.checked; } };
    } else if (opts.type === 'time') {
      inp = h('input', { type: 'time', value: minToHHMM(v) });
      return { el: h('label.field', [h('span', label), inp, opts.help ? h('small', opts.help) : null]), path: path, get: function () { return hhmmToMin(inp.value); } };
    } else {
      inp = h('input', { type: typeof v === 'number' ? 'number' : (opts.secret ? 'password' : 'text'), value: v, step: opts.step || 'any', min: opts.min, max: opts.max, maxlength: opts.maxlength, autocomplete: 'off' });
    }
    return {
      el: h('label.field', [h('span', label), inp, opts.help ? h('small', opts.help) : null]), path: path,
      get: function () {
        if (opts.type === 'select') return opts.num ? Number(inp.value) : inp.value;
        return typeof v === 'number' ? Number(inp.value) : inp.value;
      }
    };
  }
  function setPath(o, path, val) {
    const parts = path.split('.');
    let cur = o;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i];
      if (cur[k] === undefined) cur[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = val;
  }

  const view = {
    mount: function (main) {
      this.main = main;
      const self = this;
      this.offT = EL.app.on('teacher', function () { self.render(); });
      this.render();
    },
    unmount: function () { if (this.offT) this.offT(); clearInterval(this.timer); },
    render: function () {
      const self = this, main = this.main, app = EL.app;
      U.clear(main);
      clearInterval(this.timer);
      main.appendChild(h('div.page-head', [h('div', [h('h1', 'Réglages'), h('p', 'Configuration du kit (réservée à l’enseignant) et préférences de cet appareil.')]),
        EL.isTeacher() ? h('button.btn', { onclick: function () { EL.logoutTeacher(); } }, [EL.icon('lock'), 'Quitter le mode enseignant']) : h('button.btn.primary', { onclick: function () { EL.askPin(); } }, [EL.icon('unlock'), 'Mode enseignant'])]));
      // préférences locales
      const theme = h('select.inp', [h('option', { value: '' }, 'Automatique'), h('option', { value: 'light' }, 'Clair'), h('option', { value: 'dark' }, 'Sombre')]);
      theme.value = U.store.get('theme', '');
      theme.addEventListener('change', function () { U.store.set('theme', theme.value); EL.applyTheme(); });
      main.appendChild(h('div.card', [h('h2', '📱 Cet appareil'), h('div.form-grid', [
        h('label.field', [h('span', 'Thème'), theme]),
        h('div.field', [h('span', 'Profil'), h('div.row', [h('span', (app.profile ? app.profile.name : '—') + (app.profile && app.profile.group ? ' · ' + app.profile.group : '')), h('button.btn.small', { onclick: function () { EL.profileModal(false); } }, 'Modifier')])]),
        h('div.field', [h('span', 'Mode'), h('span', app.mode === 'demo' ? 'Démonstration (kit virtuel)' : 'Kit réel')])
      ])]));
      if (!EL.isTeacher()) {
        main.appendChild(h('div.note', { style: { marginTop: '14px' } }, 'Les réglages du kit (réseau, sécurité, permissions, capteurs…) sont accessibles en mode enseignant. Les paramètres pédagogiques des prises (puissance max, délai, veille) se modifient aussi depuis l’onglet « Mesures » ou avec des blocs.'));
        this.infoCard(main);
        return;
      }
      const c = EL.config.clone(app.config);
      this.fields = [];
      const F = function (path, label, opts) { const f = field(c, path, label, opts); self.fields.push(f); return f.el; };
      const section = function (title, children, desc) {
        return h('div.card', { style: { marginTop: '14px' } }, [h('h2', title), desc ? h('p.small.muted', desc) : null].concat(children));
      };
      // prises
      const outlets = h('div.grid.g2');
      c.outlets.forEach(function (o, k) {
        outlets.appendChild(h('div.card.flat', [h('h3', 'Prise ' + (k + 1)), h('div.form-grid', [
          F('outlets.' + k + '.name', 'Nom (pièce)', { maxlength: 23 }),
          F('outlets.' + k + '.icon', 'Icône', { type: 'select', options: ICON_CHOICES }),
          F('outlets.' + k + '.maxPower', 'Puissance max (W)', { help: 'Protection logicielle' }),
          F('outlets.' + k + '.pzemAlarm', 'Alarme capteur (W)'),
          F('outlets.' + k + '.priority', 'Priorité (1 = haute)', { type: 'select', num: true, options: [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']] }),
          F('outlets.' + k + '.bootState', 'Au démarrage', { type: 'select', num: true, options: [['0', 'éteinte'], ['1', 'allumée'], ['2', 'dernier état']] }),
          F('outlets.' + k + '.minSwitchS', 'Délai entre commutations (s)'),
          F('outlets.' + k + '.standbyW', 'Seuil de veille (W)'),
          F('outlets.' + k + '.ctTurns', 'Passages dans le tore', { help: 'Pour mesurer les petits courants' }),
          F('outlets.' + k + '.calU', 'Étalonnage U (×)', { step: 0.001 }),
          F('outlets.' + k + '.calI', 'Étalonnage I (×)', { step: 0.001 }),
          F('outlets.' + k + '.enabled', 'Prise utilisée')
        ])]));
      });
      main.appendChild(section('🔌 Kit et prises', [h('div.form-grid', [F('kitName', 'Nom du kit', { maxlength: 31 })]), h('div', { style: { height: '10px' } }), outlets]));
      main.appendChild(section('📶 Réseau Wi-Fi', [h('div.form-grid', [
        F('net.wifiMode', 'Mode', { type: 'select', num: true, options: [['0', 'Point d’accès du kit (recommandé)'], ['1', 'Rejoindre un réseau existant']] }),
        F('net.staSsid', 'Réseau existant : nom (SSID)'), F('net.staPass', 'Réseau existant : mot de passe', { secret: true }),
        F('net.apSsid', 'Wi-Fi du kit : nom'), F('net.apPass', 'Wi-Fi du kit : mot de passe (8 caractères min.)', { secret: true }),
        F('net.hostname', 'Nom d’hôte (http://nom.local)'), F('net.apAlways', 'Garder le Wi-Fi du kit actif en mode réseau existant'),
        F('net.tzMin', 'Fuseau horaire (minutes / UTC)', { help: 'ex. 60 pour UTC+1' }), F('net.tzAuto', 'Fuseau réglé automatiquement par le navigateur')
      ])], 'Les changements de réseau s’appliquent au redémarrage. En cas d’erreur, maintenez le bouton BOOT du kit 6 s pour revenir au Wi-Fi du kit.'));
      main.appendChild(section('💰 Tarif et environnement', [h('div.form-grid', [
        F('tariff.currency', 'Monnaie', { maxlength: 7 }), F('tariff.priceHP', 'Prix du kWh (heures pleines)', { step: 0.01 }),
        F('tariff.hpHc', 'Tarif heures pleines / heures creuses'), F('tariff.priceHC', 'Prix du kWh (heures creuses)', { step: 0.01 }),
        F('tariff.hcStart', 'Début des heures creuses', { type: 'time' }), F('tariff.hcEnd', 'Fin des heures creuses', { type: 'time' }),
        F('tariff.contractW', 'Puissance souscrite (W)'), F('tariff.co2', 'Facteur CO₂ (g/kWh)')
      ])]));
      main.appendChild(section('📡 Capteurs', [h('div.form-grid', [
        F('measure.sampleMs', 'Période de mesure (ms)', { help: '1000 à 10000' }), F('measure.smoothN', 'Lissage (nombre de mesures)'),
        F('env.dhtOn', 'Capteur DHT22 branché'), F('env.ldrOn', 'Photorésistance branchée'), F('env.pirOn', 'Détecteur de présence branché'), F('env.ldrInvert', 'Inverser la luminosité'),
        F('env.tempSet', 'Consigne de température (°C)'), F('env.tempHyst', 'Hystérésis (°C)'), F('env.lightThr', 'Seuil de luminosité (%)'), F('env.presenceS', 'Délai de présence (s)')
      ])]));
      main.appendChild(section('🛡️ Sécurité et matériel', [h('div.form-grid', [
        F('safety.maxTotalW', 'Puissance totale max du kit (W)', { help: 'Coupure de la prise la moins prioritaire au-delà' }),
        F('safety.hardMaxOutletW', 'Plafond de « puissance max » par prise (W)'), F('safety.minSwitchFloorS', 'Délai minimum imposé entre commutations (s)'),
        F('hw.relayActiveLow', 'Module relais actif à l’état bas (cas le plus courant)'), F('hw.buzzerOn', 'Buzzer activé'),
        F('hw.oledType', 'Écran', { type: 'select', num: true, options: [['0', 'OLED SSD1306 0,96"'], ['1', 'OLED SH1106 1,3"'], ['2', 'aucun']] })
      ])], 'Ces limites s’appliquent quoi que fassent les programmes des apprenants. Le disjoncteur différentiel du kit reste la protection principale.'));
      main.appendChild(section('🧠 Intelligence artificielle', [h('div.form-grid', [
        F('ai.anomalyZ', 'Seuil d’anomalie (score z)'), F('ai.knnK', 'k (plus proches voisins)'), F('ai.knnMaxDist', 'Distance max pour reconnaître')
      ])]));
      // pédagogie
      const perms = h('div.col');
      const PERMS = [[1, 'Commander les prises manuellement'], [2, 'Modifier les paramètres (dans les limites)'], [4, 'Envoyer / démarrer des programmes'], [8, 'Remettre à zéro les compteurs des capteurs'], [16, 'Entraîner l’IA de reconnaissance'], [32, 'Réarmer une prise après une protection']];
      const permBoxes = PERMS.map(function (p) {
        const cb = h('input', { type: 'checkbox', checked: (c.peda.perms & p[0]) !== 0 });
        perms.appendChild(h('label.check', [cb, p[1]]));
        return { bit: p[0], cb: cb };
      });
      this.fields.push({ path: 'peda.perms', get: function () { return permBoxes.reduce(function (a, p) { return a | (p.cb.checked ? p.bit : 0); }, 0); } });
      main.appendChild(section('🎓 Pédagogie', [h('div.form-grid', [
        F('peda.scaffold', 'Guidage des missions (étayage)', { type: 'select', num: true, options: [['0', 'Fort : indices automatiques, étape par étape'], ['1', 'Adaptatif : indices après erreurs ou blocage'], ['2', 'Faible : exploration libre, indices sur demande']] }),
        F('peda.pin', 'Code enseignant (4 à 8 caractères)', { secret: true }), F('peda.progAutostart', 'Redémarrer le programme du kit à la mise sous tension')
      ]), h('h3', { style: { marginTop: '12px' } }, 'Les apprenants peuvent :'), perms]));
      main.appendChild(section('🔗 MQTT (Node-RED, Home Assistant, Grafana…)', [h('div.form-grid', [
        F('mqtt.on', 'Activer la passerelle MQTT'), F('mqtt.host', 'Courtier (adresse)'), F('mqtt.port', 'Port'),
        F('mqtt.user', 'Utilisateur'), F('mqtt.pass', 'Mot de passe', { secret: true }), F('mqtt.base', 'Préfixe des sujets')
      ])], 'Nécessite le mode « réseau existant ». Sujets publiés : <préfixe>/<kit>/state, …/outlet/<n>/power, …/outlet/<n>/energy ; commande : …/outlet/<n>/set (ON/OFF/TOGGLE).'));
      const save = h('button.btn.primary', [EL.icon('save'), 'Enregistrer les réglages']);
      save.onclick = function () { self.save(); };
      main.appendChild(h('div.row', { style: { margin: '14px 0', position: 'sticky', bottom: '74px', zIndex: 5 } }, [save]));
      this.pzemCard(main);
      this.maintenanceCard(main);
      this.infoCard(main);
    },
    save: async function () {
      const app = EL.app;
      const patch = {};
      for (const f of this.fields) setPath(patch, f.path, f.get());
      const r = await app.kit.setConfig(patch, app.pin);
      EL.track('config_save', { ok: !!r.ok });
      if (!r.ok) { EL.toast(r.msg || 'Échec', 'bad'); return; }
      if (patch.peda && patch.peda.pin && patch.peda.pin !== '********' && patch.peda.pin.length >= 4) { app.pin = patch.peda.pin; U.session.set('pin', app.pin); }
      EL.toast(r.msg || 'Enregistré', 'ok');
      await EL.refreshConfig();
      if (r.reboot && await EL.confirm('Redémarrer le kit', 'Les réglages Wi-Fi seront appliqués au redémarrage. Votre appareil devra peut-être se reconnecter à un autre réseau. Redémarrer maintenant ?', 'Redémarrer')) {
        await app.kit.cmd({ cmd: 'reboot' }, app.pin);
      }
      this.render();
    },
    pzemCard: function (main) {
      const app = EL.app, self = this;
      const msg = h('div.note', 'Prêt.');
      const stats = h('div');
      const addr = h('select.inp', [1, 2, 3, 4].map(function (a) { return h('option', { value: a }, 'Adresse ' + a + ' (prise ' + a + ')'); }));
      const run = async function (o) {
        const r = await app.kit.cmd(Object.assign({ cmd: 'pzem' }, o), app.pin);
        msg.textContent = r.msg;
        setTimeout(poll, 800);
      };
      const poll = async function () {
        const p = await app.kit.getPzem();
        if (!p || !p.stats) return;
        msg.textContent = p.msg || 'Prêt.';
        msg.className = 'note' + (p.busy ? '' : (/Échec|Aucun/.test(p.msg) ? ' bad' : (/Réussi|trouvés/.test(p.msg) ? ' ok' : '')));
        if (p.busy) setTimeout(poll, 800);
        U.clear(stats);
        stats.appendChild(h('table.tbl', [h('thead', h('tr', ['Prise / adresse', 'Lectures OK', 'Erreurs', 'Dernier état', 'Seuil d’alarme lu'].map(function (t, i) { return h('th' + (i ? '.num' : ''), t); }))),
          h('tbody', p.stats.map(function (s, k) { return h('tr', [h('td', String(k + 1)), h('td.num', String(s.ok)), h('td.num', String(s.err)), h('td.num', ['ok', 'pas de réponse', 'CRC', 'exception', 'trame'][s.le] || '?'), h('td.num', p.alarm[k] ? p.alarm[k] + ' W' : '--')]); }))]));
      };
      main.appendChild(h('div.card', { style: { marginTop: '14px' } }, [
        h('h2', '🔧 Capteurs PZEM-004T : adressage et diagnostic'),
        h('p.small', 'Les 4 capteurs partagent le même bus série : chacun doit avoir une adresse différente (1 à 4, celle de sa prise). Procédure d’adressage : ne branchez QU’UN SEUL capteur sur le bus (fils TX/RX), choisissez son adresse, cliquez « Attribuer », puis passez au suivant. Les capteurs doivent être alimentés en 230 V pour répondre.'),
        h('div.row', [addr, h('button.btn.primary', { onclick: function () { run({ op: 'setaddr', addr: Number(addr.value) }); } }, 'Attribuer cette adresse au capteur branché'),
          h('button.btn', { onclick: function () { run({ op: 'scan' }); } }, 'Rechercher les capteurs'),
          h('button.btn', { onclick: function () { run({ op: 'readalarms' }); } }, 'Lire les seuils d’alarme')]),
        h('div', { style: { margin: '10px 0' } }, msg), stats
      ]));
      poll();
      this.timer = setInterval(poll, 5000);
      void self;
    },
    maintenanceCard: function (main) {
      const app = EL.app;
      const btn = function (label, cls, fn) { return h('button.btn' + (cls ? '.' + cls : ''), { onclick: fn }, label); };
      const reset = h('select.inp', [1, 2, 3, 4].map(function (k) { return h('option', { value: k }, 'Prise ' + k); }));
      main.appendChild(h('div.card', { style: { marginTop: '14px' } }, [
        h('h2', '🧰 Données et maintenance'),
        h('div.row', [
          reset, btn('Remettre à zéro le compteur du capteur', '', async function () { const r = await app.kit.cmd({ cmd: 'resetEnergy', outlet: Number(reset.value) }, app.pin); EL.toast(r.msg, r.ok ? 'ok' : 'bad'); })
        ]),
        h('div.row', { style: { marginTop: '10px' } }, [
          btn('Effacer les journaux de mesures', '', async function () { if (await EL.confirm('Effacer', 'Supprimer tous les journaux de mesures du kit ?', 'Effacer')) { const r = await app.kit.cmd({ cmd: 'clearLogs' }, app.pin); EL.toast(r.msg, r.ok ? 'ok' : 'bad'); } }),
          btn('Effacer les données de recherche', '', async function () { if (await EL.confirm('Effacer', 'Supprimer toutes les traces, tests et questionnaires enregistrés sur le kit ?', 'Effacer')) { const r = await app.kit.cmd({ cmd: 'clearResearch' }, app.pin); EL.toast(r.msg, r.ok ? 'ok' : 'bad'); } }),
          btn('Effacer l’apprentissage de l’IA', '', async function () { if (await EL.confirm('Effacer', 'Oublier tous les appareils appris ?', 'Effacer')) { const r = await app.kit.cmd({ cmd: 'knnClear' }, app.pin); EL.toast(r.msg, r.ok ? 'ok' : 'bad'); EL.refreshKnn(); } }),
          btn('Redémarrer le kit', '', async function () { if (await EL.confirm('Redémarrer', 'Redémarrer le kit maintenant ?', 'Redémarrer')) { const r = await app.kit.cmd({ cmd: 'reboot' }, app.pin); EL.toast(r.msg, 'ok'); } }),
          btn('Réinitialisation d’usine', 'danger', async function () { if (await EL.confirm('Réinitialisation d’usine', 'Tous les réglages, programmes, journaux et données de recherche seront effacés. Continuer ?', 'Tout effacer')) { const r = await app.kit.cmd({ cmd: 'factory' }, app.pin); EL.toast(r.msg, 'warn'); } })
        ])
      ]));
    },
    infoCard: async function (main) {
      const app = EL.app;
      const box = h('div.card', { style: { marginTop: '14px' } }, [h('h2', 'ℹ️ Informations')]);
      main.appendChild(box);
      const i = await app.kit.getInfo();
      if (!i) return;
      const rows = [
        ['Firmware', i.fw + (i.build ? ' (' + i.build + ')' : '')], ['Identifiant du kit', i.kit], ['Mode réseau', i.mode],
        ['Wi-Fi du kit', i.apSsid + (i.apIp ? ' — http://' + i.apIp : '')], ['Réseau existant', i.ssid ? i.ssid + (i.ip ? ' — http://' + i.ip : '') : '—'],
        ['Appareils connectés au Wi-Fi du kit', String(i.clients)], ['Mémoire libre', i.heap ? Math.round(i.heap / 1024) + ' Ko (min. ' + Math.round(i.minHeap / 1024) + ' Ko)' : '—'],
        ['Fonctionne depuis', U.fmtDuration(i.uptime)], ['Heure du kit', i.timeValid ? new Date(i.time * 1000).toLocaleString('fr-FR') : 'non réglée'], ['MQTT', i.mqtt || '—']
      ];
      box.appendChild(h('table.tbl', h('tbody', rows.map(function (r) { return h('tr', [h('td', r[0]), h('td', r[1])]); }))));
    }
  };

  EL.applyTheme = function () {
    const t = U.store.get('theme', '');
    if (t) document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  };
  EL.views.reglages = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* EnergyLab — noyau de l'interface : icônes, navigation, connexion au kit, profils, traces */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  if (typeof document === 'undefined') return;
  const U = EL.util, h = U.h;

  // ---------------------------------------------------------------- icônes (24x24, trait)
  const ICONS = {
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    meter: '<path d="M3.5 18a9 9 0 1 1 17 0"/><path d="M12 14l4.5-4.5"/><circle cx="12" cy="14" r="1.2"/>',
    blocks: '<path d="M4 7h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4h-4a2 2 0 1 0-4 0H4z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    brain: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/><path d="M10 10h4v4h-4z"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 11h6M9 15h4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.3c-.8.4-1 .9-1 1.7"/><path d="M12 17h.01"/>',
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 21h4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 17v3h16v-3"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 17v3h16v-3"/>',
    save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
    folder: '<path d="M3 6h7l2 2h9v11H3z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    flask: '<path d="M9 3h6M10 3v6L4 19a1.5 1.5 0 0 0 1.3 2h13.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/>',
    code: '<path d="M9 8l-5 4 5 4M15 8l5 4-5 4"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/>',
    plug: '<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
    zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    book: '<path d="M4 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6v15"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>'
  };
  function icon(name, cls) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    if (cls) s.setAttribute('class', cls);
    s.innerHTML = ICONS[name] || '';
    return s;
  }

  // ---------------------------------------------------------------- application
  const app = new U.Emitter();
  Object.assign(app, {
    kit: null, mode: null, state: null, config: null, info: null, knn: null, logs: [], lastLogSeq: 0,
    pin: U.session.get('pin', ''), profile: U.store.get('profile', null), device: U.store.get('device', null),
    view: null, viewName: null, alerts: 0, cfgSeq: -1, knnSeq: -1
  });
  if (!app.device) { app.device = U.uid(); U.store.set('device', app.device); }
  EL.app = app;
  EL.icon = icon;

  const NAV = [
    { id: 'maison', title: 'Maison', icon: 'home' },
    { id: 'mesures', title: 'Mesures', icon: 'meter' },
    { id: 'programmer', title: 'Programmer', icon: 'blocks' },
    { id: 'missions', title: 'Missions', icon: 'target' },
    { id: 'ia', title: 'IA & algorithmes', icon: 'brain' },
    { id: 'donnees', title: 'Données', icon: 'chart' },
    { id: 'evaluation', title: 'Évaluation', icon: 'clipboard' },
    { id: 'reglages', title: 'Réglages', icon: 'gear' },
    { id: 'aide', title: 'Aide & câblage', icon: 'help' }
  ];
  EL.NAV = NAV;
  EL.views = EL.views || {};

  // ---------------------------------------------------------------- notifications & fenêtres
  function toast(msg, kind, ms) {
    const box = document.getElementById('toasts');
    if (!box) return;
    const t = h('div.toast' + (kind ? '.' + kind : ''), [msg]);
    box.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, (ms || 3500) - 300);
    setTimeout(function () { t.remove(); }, ms || 3500);
  }
  function modal(opts) {
    const rootEl = document.getElementById('modal-root');
    let closed = false;
    const back = h('div.modal-back');
    const close = function () {
      if (closed) return;
      closed = true;
      back.remove();
      document.removeEventListener('keydown', onKey);
      if (opts.onClose) opts.onClose();
    };
    const onKey = function (e) { if (e.key === 'Escape' && !opts.noEscape) close(); };
    const foot = h('div.modal-foot');
    for (const a of (opts.actions || [{ label: 'Fermer' }])) {
      foot.appendChild(h('button.btn' + (a.kind ? '.' + a.kind : ''), {
        type: 'button',
        onclick: async function () {
          if (a.onClick) { const r = await a.onClick(); if (r === false) return; }
          close();
        }
      }, a.label));
    }
    const box = h('div.modal' + (opts.wide ? '.wide' : ''), { role: 'dialog', 'aria-modal': 'true' }, [
      h('div.modal-head', [h('h2', opts.title || ''), opts.noEscape ? null : h('button.iconbtn', { onclick: close, 'aria-label': 'Fermer' }, icon('x'))]),
      h('div.modal-body', typeof opts.body === 'string' ? h('div', { html: opts.body }) : opts.body),
      foot
    ]);
    back.appendChild(box);
    back.addEventListener('click', function (e) { if (e.target === back && !opts.noEscape) close(); });
    document.addEventListener('keydown', onKey);
    rootEl.appendChild(back);
    const first = box.querySelector('input, select, textarea');
    if (first) setTimeout(function () { first.focus(); }, 50);
    return { close: close, el: box };
  }
  function confirmBox(title, text, okLabel) {
    return new Promise(function (resolve) {
      let res = false;
      modal({
        title: title, body: h('p', text), onClose: function () { resolve(res); },
        actions: [{ label: 'Annuler' }, { label: okLabel || 'Confirmer', kind: 'primary', onClick: function () { res = true; } }]
      });
    });
  }

  // ---------------------------------------------------------------- traces d'apprentissage (recherche)
  const SCAF = ['fort', 'adaptatif', 'faible'];
  let trackQ = U.store.get('trackq', []);
  function track(type, detail) {
    const p = app.profile || {};
    trackQ.push({
      ts: new Date().toISOString(), learner: p.name || 'anonyme', group: p.group || '',
      cond: app.config ? SCAF[app.config.peda.scaffold] || '' : '', device: app.device, type: type,
      detail: detail === undefined ? '' : (typeof detail === 'string' ? detail : JSON.stringify(detail))
    });
    if (trackQ.length > 3000) trackQ = trackQ.slice(-3000);
    U.store.set('trackq', trackQ);
  }
  async function flushTrack() {
    if (!app.kit || !trackQ.length || !isConnected()) return;
    const batch = trackQ.slice(0, 80);
    const r = await app.kit.postEvents(batch);
    if (r && r.ok) {
      trackQ = trackQ.slice(batch.length);
      U.store.set('trackq', trackQ);
    }
  }
  setInterval(flushTrack, 20000);

  // ---------------------------------------------------------------- enseignant
  function isTeacher() { return !!app.pin; }
  async function askPin() {
    return new Promise(function (resolve) {
      const inp = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off', placeholder: 'Code enseignant' });
      const msg = h('p.small.muted', 'Code par défaut : 1234 (à changer dans Réglages > Pédagogie).');
      let result = null;
      const m = modal({
        title: 'Mode enseignant', body: h('div.col', [h('label.field', [h('span', 'Code enseignant'), inp]), msg]),
        onClose: function () { resolve(result); },
        actions: [{ label: 'Annuler' }, {
          label: 'Valider', kind: 'primary', onClick: async function () {
            const pin = inp.value.trim();
            const c = await app.kit.getConfig(pin);
            if (c && c.teacher) {
              app.pin = pin; U.session.set('pin', pin); result = pin;
              app.config = c; app.emit('config', c); app.emit('teacher', true);
              toast('Mode enseignant activé', 'ok');
              track('teacher_login', '');
              return true;
            }
            msg.textContent = 'Code incorrect.';
            msg.className = 'small';
            msg.style.color = 'var(--danger)';
            return false;
          }
        }]
      });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') m.el.querySelector('.modal-foot .primary').click(); });
    });
  }
  function logoutTeacher() { app.pin = ''; U.session.del('pin'); app.emit('teacher', false); refreshConfig(); toast('Mode enseignant désactivé'); }
  async function requireTeacher() { if (isTeacher()) return app.pin; return askPin(); }

  // ---------------------------------------------------------------- profil
  function profileModal(force) {
    const p = app.profile || { name: '', group: '', role: 'apprenant' };
    const name = h('input', { value: p.name, placeholder: 'ex. Yasmine B. ou code E07', maxlength: 40 });
    const group = h('input', { value: p.group, placeholder: 'ex. Groupe A, TS2…', maxlength: 30 });
    const role = h('select', [h('option', { value: 'apprenant' }, 'Apprenant·e'), h('option', { value: 'enseignant' }, 'Enseignant·e')]);
    role.value = p.role || 'apprenant';
    modal({
      title: force ? 'Bienvenue dans EnergyLab !' : 'Mon profil', noEscape: !!force,
      body: h('div.col', [
        force ? h('p', 'Ce kit vous permet de mesurer la consommation de chaque prise d’une maison, de commander les prises et de programmer des algorithmes intelligents avec des blocs, sans écrire de code.') : null,
        h('label.field', [h('span', 'Prénom, pseudonyme ou code apprenant'), name, h('small', 'Pour la recherche, préférez un code anonyme fourni par l’enseignant.')]),
        h('label.field', [h('span', 'Groupe / classe (facultatif)'), group]),
        h('label.field', [h('span', 'Je suis'), role])
      ]),
      actions: [{
        label: 'Commencer', kind: 'primary', onClick: function () {
          const n = name.value.trim();
          if (!n) { name.focus(); name.style.outline = '2px solid var(--danger)'; return false; }
          const isNew = !app.profile || app.profile.name !== n;
          app.profile = { name: n, group: group.value.trim(), role: role.value };
          U.store.set('profile', app.profile);
          if (isNew) track('session_start', { ua: navigator.userAgent.slice(0, 80), mode: app.mode });
          if (role.value === 'enseignant' && !isTeacher()) setTimeout(askPin, 100);
          app.emit('profile', app.profile);
        }
      }]
    });
  }

  // ---------------------------------------------------------------- chargement de scripts (Blockly à la demande)
  const scripts = {};
  function loadScript(src) {
    if (!scripts[src]) {
      scripts[src] = new Promise(function (resolve, reject) {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = function () { delete scripts[src]; reject(new Error('Impossible de charger ' + src)); };
        document.head.appendChild(s);
      });
    }
    return scripts[src];
  }
  async function ensureBlockly() {
    if (!root.Blockly) await loadScript('blockly.js');
    EL.blocks.define(root.Blockly);
    return root.Blockly;
  }

  // ---------------------------------------------------------------- connexion au kit
  function isConnected() { return app.kit && (app.kit.kind === 'sim' || app.kit.connected); }
  async function refreshConfig() {
    if (!app.kit) return;
    const c = await app.kit.getConfig(app.pin);
    if (c && c.outlets) {
      if (app.pin && !c.teacher) { app.pin = ''; U.session.del('pin'); app.emit('teacher', false); }
      app.config = c;
      EL.blocks.dyn.outlets = c.outlets.map(function (o) { return o.name; });
      document.getElementById('kit-name').textContent = c.kitName;
      app.emit('config', c);
    }
  }
  async function refreshKnn() {
    if (!app.kit) return;
    const k = await app.kit.getKnn();
    if (k && k.labels) {
      app.knn = k;
      EL.blocks.dyn.labels = k.labels.map(function (l) { return { id: l.id, name: l.name }; });
      app.emit('knn', k);
    }
  }
  function applianceName(id) {
    if (id === 0) return '';
    if (id === -1) return 'appareil inconnu';
    const l = app.knn && app.knn.labels.find(function (x) { return x.id === id; });
    return l ? l.name : '';
  }

  function setKit(kit, mode) {
    if (app.kit && app.kit.disconnect) app.kit.disconnect();
    app.kit = kit;
    app.mode = mode;
    app.logs = [];
    app.lastLogSeq = 0;
    kit.on('state', onState);
    kit.on('log', onLog);
    kit.on('status', function (st) { updateConn(); app.emit('status', st); if (st.connected) syncTime(); });
    kit.on('config', function () { refreshConfig(); });
    kit.on('beep', function (k) { beepSound(k); });
  }

  let timeSynced = false;
  async function syncTime() {
    if (!app.kit || app.kit.kind !== 'real' || timeSynced) return;
    const s = app.state;
    const now = Math.floor(Date.now() / 1000);
    if (!s || !s.timeValid || Math.abs(s.ts - now) > 120 || (app.config && app.config.net.tzAuto && app.config.net.tzMin !== -new Date().getTimezoneOffset())) {
      const r = await app.kit.cmd({ cmd: 'time', epoch: now, tz: -new Date().getTimezoneOffset() });
      if (r && r.ok) timeSynced = true;
    } else timeSynced = true;
  }

  function onState(s) {
    const prev = app.state;
    app.state = s;
    document.getElementById('top-power').textContent = U.fmtP(s.total.p);
    document.getElementById('top-clock').textContent = s.timeValid ? U.fmtClock(s.ts, s.tz) : '--:--';
    if (app.cfgSeq !== s.seq.cfg) { app.cfgSeq = s.seq.cfg; refreshConfig(); }
    if (app.knnSeq !== s.seq.knn) { app.knnSeq = s.seq.knn; refreshKnn(); }
    if (s.seq.log > app.lastLogSeq && app.kit.kind === 'real') fetchLogs();
    if (!prev && app.kit.kind === 'real') syncTime();
    if (app.view && app.view.onState) {
      try { app.view.onState(s); } catch (e) { console.error(e); }
    }
    app.emit('state', s);
  }
  async function fetchLogs() {
    if (fetchLogs.busy) return;
    fetchLogs.busy = true;
    const list = await app.kit.getLogs(app.lastLogSeq);
    fetchLogs.busy = false;
    for (const e of list) onLog(e);
  }
  function onLog(e) {
    if (e.seq <= app.lastLogSeq) return;
    const first = app.lastLogSeq === 0;
    app.lastLogSeq = e.seq;
    app.logs.push(e);
    if (app.logs.length > 300) app.logs.shift();
    if (!first || app.logs.length > 1) {
      if (e.level === 3) { toast('⚠ ' + e.msg, 'bad', 6000); app.alerts++; updateAlertDot(); }
    }
    app.emit('log', e);
  }
  function updateAlertDot() {
    const b = document.getElementById('btn-alerts');
    const dot = b.querySelector('.badge-dot');
    if (app.alerts > 0 && !dot) b.appendChild(h('span.badge-dot'));
    if (app.alerts === 0 && dot) dot.remove();
  }
  function updateConn() {
    const chip = document.getElementById('chip-conn');
    const txt = document.getElementById('conn-text');
    chip.classList.remove('ok', 'bad', 'demo');
    if (!app.kit) { txt.textContent = 'Recherche du kit…'; return; }
    if (app.kit.kind === 'sim') { chip.classList.add('demo'); txt.textContent = 'Kit virtuel'; return; }
    if (app.kit.connected) { chip.classList.add('ok'); txt.textContent = 'Kit connecté'; } else { chip.classList.add('bad'); txt.textContent = 'Kit déconnecté'; }
  }

  // petit bip local (mode démonstration)
  let audio = null;
  function beepSound(kind) {
    if (app.kit && app.kit.kind !== 'sim') return;
    try {
      audio = audio || new (root.AudioContext || root.webkitAudioContext)();
      const seq = [[[2000, 0.09]], [[2000, 0.45]], [[2600, .15], [0, .07], [1800, .15], [0, .07], [2600, .15]], [[1047, .1], [1319, .1], [1568, .18]]][kind] || [[2000, .09]];
      let t = audio.currentTime;
      for (const n of seq) {
        if (n[0]) {
          const o = audio.createOscillator(), g = audio.createGain();
          o.frequency.value = n[0]; g.gain.value = 0.04;
          o.connect(g); g.connect(audio.destination);
          o.start(t); o.stop(t + n[1]);
        }
        t += n[1];
      }
    } catch (e) { /* pas de son */ }
  }

  // ---------------------------------------------------------------- navigation
  function buildNav() {
    const side = document.getElementById('sidenav');
    const bottom = document.getElementById('bottomnav');
    U.clear(side); U.clear(bottom);
    NAV.forEach(function (n, i) {
      if (i === 4 || i === 7) side.appendChild(h('div.sep'));
      side.appendChild(h('a', { href: '#/' + n.id, dataset: { nav: n.id } }, [icon(n.icon), n.title]));
    });
    side.appendChild(h('div.foot', [h('div', 'EnergyLab 1.0'), h('div', 'Kit pédagogique IoT')]));
    ['maison', 'mesures', 'programmer', 'missions'].forEach(function (id) {
      const n = NAV.find(function (x) { return x.id === id; });
      bottom.appendChild(h('a', { href: '#/' + id, dataset: { nav: id } }, [icon(n.icon), n.title]));
    });
    bottom.appendChild(h('a', { href: '#', dataset: { nav: 'plus' }, onclick: function (e) { e.preventDefault(); moreMenu(); } }, [icon('more'), 'Plus']));
    const ab = document.getElementById('btn-alerts');
    ab.appendChild(icon('bell'));
    ab.onclick = function () { app.alerts = 0; updateAlertDot(); logModal(); };
    const pb = document.getElementById('btn-profile');
    pb.appendChild(icon('user'));
    pb.onclick = function () { profileModal(false); };
  }
  function moreMenu() {
    const list = h('div.col');
    const m = modal({ title: 'Plus', body: list });
    NAV.slice(4).forEach(function (n) {
      list.appendChild(h('a.btn.block', { href: '#/' + n.id, style: { justifyContent: 'flex-start' }, onclick: function () { m.close(); } }, [icon(n.icon), n.title]));
    });
  }
  function logModal() {
    const box = h('div.console', { style: { height: '420px' } });
    const render = function () {
      U.clear(box);
      for (const e of app.logs.slice().reverse()) {
        box.appendChild(h('div.l' + e.level, [h('span.ts', e.ts ? U.fmtDateTime(e.ts, app.state ? app.state.tz : 0) : '#' + e.seq), e.msg]));
      }
      if (!app.logs.length) box.appendChild(h('div', 'Aucun événement pour le moment.'));
    };
    render();
    const off = app.on('log', render);
    modal({ title: 'Journal du kit', body: box, wide: true, onClose: off });
  }

  function route() {
    const hash = location.hash.replace(/^#\/?/, '') || 'maison';
    const parts = hash.split('/');
    const name = EL.views[parts[0]] ? parts[0] : 'maison';
    U.$$('[data-nav]').forEach(function (a) { a.classList.toggle('active', a.dataset.nav === name); });
    if (app.view && app.view.unmount) { try { app.view.unmount(); } catch (e) { console.error(e); } }
    const main = document.getElementById('view');
    U.clear(main);
    app.viewName = name;
    app.view = EL.views[name];
    const nav = NAV.find(function (n) { return n.id === name; });
    document.title = (nav ? nav.title + ' — ' : '') + 'EnergyLab';
    try {
      app.view.mount(main, parts.slice(1));
      if (app.state && app.view.onState) app.view.onState(app.state);
    } catch (e) {
      console.error(e);
      main.appendChild(h('div.note.bad', 'Erreur d’affichage : ' + e.message));
    }
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    track('view', name);
  }

  // ---------------------------------------------------------------- démarrage
  async function boot() {
    buildNav();
    updateConn();
    const params = new URLSearchParams(location.search);
    let kit = null, mode = 'demo';
    if (!params.has('demo') && location.protocol.startsWith('http')) {
      const real = new EL.RealKit('');
      if (await real.probe()) { kit = real; mode = 'real'; }
    }
    if (!kit) kit = new EL.SimKit({ persistKey: 'demo', name: 'Kit virtuel (démonstration)' });
    setKit(kit, mode);
    await kit.connect();
    updateConn();
    for (const e of await kit.getLogs(0)) onLog(e);
    await refreshConfig();
    await refreshKnn();
    if (mode === 'real') app.info = await kit.getInfo();
    window.addEventListener('hashchange', route);
    route();
    if (!app.profile) profileModal(true);
    else track('session_start', { mode: mode });
    if (params.has('portal')) toast('Astuce : pour une meilleure expérience, ouvrez http://192.168.4.1 dans votre navigateur habituel.', 'warn', 8000);
  }

  Object.assign(EL, {
    toast: toast, modal: modal, confirm: confirmBox, track: track, flushTrack: flushTrack, askPin: askPin, requireTeacher: requireTeacher,
    isTeacher: isTeacher, logoutTeacher: logoutTeacher, profileModal: profileModal, loadScript: loadScript, ensureBlockly: ensureBlockly,
    refreshConfig: refreshConfig, refreshKnn: refreshKnn, applianceName: applianceName, boot: boot, isConnected: isConnected, SCAF: SCAF
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);

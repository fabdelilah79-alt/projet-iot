/* EnergyLab — tableau de bord « Maison » : plan de la maison, prises, indicateurs, courbe en direct */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  if (typeof document === 'undefined') return;
  const U = EL.util, h = U.h, svg = U.svg;

  const ICONS = { lamp: '💡', kettle: '🫖', heater: '🔥', laptop: '💻', tv: '📺', fridge: '🧊', fan: '🌀', washer: '🧺', charger: '🔋', microwave: '🍲', iron: '👔', ac: '❄️', router: '📶', motor: '🛠️', plug: '🔌', water_heater: '🚿' };
  const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)'];
  const HEX = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981'];
  EL.OUTLET_COLORS = HEX;
  EL.OUTLET_ICONS = ICONS;

  async function relayCmd(k, on) {
    const r = await EL.app.kit.cmd({ cmd: 'relay', outlet: k + 1, on: on }, EL.app.pin);
    EL.track('relay_cmd', { outlet: k + 1, on: on, ok: !!r.ok });
    if (!r.ok) EL.toast(r.msg || 'Commande refusée', 'bad');
    else if (r.msg) EL.toast(r.msg, 'warn');
  }
  async function rearm(k) {
    const r = await EL.app.kit.cmd({ cmd: 'rearm', outlet: k + 1 }, EL.app.pin);
    EL.track('rearm', { outlet: k + 1, ok: !!r.ok });
    EL.toast(r.msg || (r.ok ? 'Réarmée' : 'Refusé'), r.ok ? 'ok' : 'bad');
  }
  EL.relayCmd = relayCmd;
  EL.rearm = rearm;

  function gaugeSvg() {
    const g = svg('svg', { viewBox: '0 0 200 120', class: 'gauge' });
    g.appendChild(svg('path', { d: 'M20 100 A80 80 0 0 1 180 100', fill: 'none', stroke: 'var(--line)', 'stroke-width': 16, 'stroke-linecap': 'round' }));
    const arc = svg('path', { d: 'M20 100 A80 80 0 0 1 180 100', fill: 'none', stroke: 'var(--primary)', 'stroke-width': 16, 'stroke-linecap': 'round', 'stroke-dasharray': '0 1000' });
    const mark = svg('line', { x1: 0, y1: 0, x2: 0, y2: 0, stroke: 'var(--danger)', 'stroke-width': 3 });
    const val = svg('text', { x: 100, y: 92, 'text-anchor': 'middle', 'font-size': 24, 'font-weight': 800 }, '--');
    const sub = svg('text', { x: 100, y: 114, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--muted)' }, '');
    g.append(arc, mark, val, sub);
    const L = Math.PI * 80;
    return {
      el: g,
      set: function (p, contract) {
        const max = Math.max(contract * 1.25, p * 1.05, 100);
        const f = Math.min(1, Math.max(0, p / max));
        arc.setAttribute('stroke-dasharray', (f * L).toFixed(1) + ' 1000');
        arc.setAttribute('stroke', p > contract ? 'var(--danger)' : p > contract * 0.8 ? 'var(--accent)' : 'var(--primary)');
        const a = Math.PI * (1 - contract / max);
        mark.setAttribute('x1', 100 + 70 * Math.cos(a)); mark.setAttribute('y1', 100 - 70 * Math.sin(a));
        mark.setAttribute('x2', 100 + 90 * Math.cos(a)); mark.setAttribute('y2', 100 - 90 * Math.sin(a));
        val.textContent = U.fmtP(p);
        sub.textContent = 'puissance souscrite : ' + U.fmtP(contract);
      }
    };
  }

  function houseSvg() {
    const s = svg('svg', { viewBox: '0 0 660 380', class: 'house-svg', role: 'img', 'aria-label': 'Plan de la maison' });
    const style = svg('style');
    style.textContent = '.wf{stroke:#f2a900;stroke-width:4;fill:none;stroke-dasharray:4 12;animation:elflow 1s linear infinite}@keyframes elflow{to{stroke-dashoffset:-32}}';
    s.appendChild(style);
    s.appendChild(svg('path', { class: 'roof', d: 'M180 120 L410 18 L640 120 Z' }));
    s.appendChild(svg('rect', { x: 180, y: 120, width: 460, height: 250, rx: 6, fill: 'none', stroke: 'var(--line)', 'stroke-width': 3 }));
    // compteur
    s.appendChild(svg('rect', { x: 12, y: 185, width: 120, height: 90, rx: 12, fill: 'var(--surface)', stroke: 'var(--primary)', 'stroke-width': 2 }));
    s.appendChild(svg('text', { x: 72, y: 207, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: 'var(--primary)' }, 'Compteur'));
    const total = svg('text', { x: 72, y: 238, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 800 }, '--');
    const energy = svg('text', { x: 72, y: 260, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--muted)' }, '');
    s.append(total, energy);
    const rooms = [];
    const pos = [[190, 130], [415, 130], [190, 250], [415, 250]];
    const wires = svg('g');
    s.appendChild(wires); // les fils passent derrière les pièces
    for (let k = 0; k < 4; k++) {
      const x = pos[k][0], y = pos[k][1];
      const g = svg('g');
      const rect = svg('rect', { class: 'room', x: x, y: y, width: 215, height: 110, rx: 10 });
      const glow = svg('rect', { x: x, y: y, width: 215, height: 110, rx: 10, fill: HEX[k], opacity: 0 });
      const name = svg('text', { x: x + 12, y: y + 22, 'font-size': 14, 'font-weight': 700 }, '');
      const ico = svg('text', { x: x + 12, y: y + 72, 'font-size': 34 }, '🔌');
      const p = svg('text', { x: x + 200, y: y + 62, 'text-anchor': 'end', 'font-size': 26, 'font-weight': 800 }, '--');
      const sub = svg('text', { x: x + 200, y: y + 92, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--muted)' }, '');
      const led = svg('circle', { cx: x + 198, cy: y + 18, r: 7, fill: '#b9c2cc' });
      // fil du compteur vers la pièce (pièces de droite : par le couloir du haut puis entre les pièces)
      const wy = y + 55;
      const d = x < 300 ? 'M132 230 L160 230 L160 ' + wy + ' L' + x + ' ' + wy
        : 'M132 230 L160 230 L160 125 L410 125 L410 ' + wy + ' L' + x + ' ' + wy;
      const wire = svg('path', { d: d, class: 'wire' });
      const flow = svg('path', { d: d, class: 'wf', style: 'display:none' });
      wires.append(wire, flow);
      g.append(rect, glow, name, ico, p, sub, led);
      g.style.cursor = 'pointer';
      g.addEventListener('click', function () { location.hash = '#/mesures/' + (k + 1); });
      s.appendChild(g);
      rooms.push({ glow: glow, name: name, ico: ico, p: p, sub: sub, led: led, flow: flow, wire: wire });
    }
    return { el: s, total: total, energy: energy, rooms: rooms };
  }

  function outletCard(k) {
    const sw = h('input', { type: 'checkbox', 'aria-label': 'Commander la prise ' + (k + 1) });
    const swWrap = h('label.switch', [sw, h('span')]);
    sw.addEventListener('change', function () { relayCmd(k, sw.checked); });
    const refs = {
      ico: h('div.o-icon', '🔌'), name: h('div.o-name', 'Prise ' + (k + 1)), sub: h('div.o-sub', ''),
      p: h('div.o-p', '--'), meta: h('div.o-meta'), bar: h('i'), badges: h('div.row'), sw: sw, rearm: null, sim: h('div')
    };
    refs.rearm = h('button.btn.small.danger.hidden', { onclick: function () { rearm(k); } }, 'Réarmer');
    const el = h('div.outlet', { style: { '--oc': COLORS[k] } }, [
      h('div.o-head', [refs.ico, h('div', { style: { flex: 1, minWidth: 0 } }, [refs.name, refs.sub]), swWrap]),
      h('div.row.between', [refs.p, refs.rearm]),
      h('div.bar', refs.bar), refs.meta, refs.badges, refs.sim
    ]);
    refs.el = el;
    return refs;
  }

  function simControls(k, refs) {
    const kit = EL.app.kit;
    if (!kit || kit.kind !== 'sim') return;
    U.clear(refs.sim);
    const sel = h('select.inp', { style: { flex: 1, minWidth: '140px' }, 'aria-label': 'Appareil simulé' });
    for (const id of Object.keys(EL.house.APPLIANCES)) sel.appendChild(h('option', { value: id }, EL.house.APPLIANCES[id].icon + ' ' + EL.house.APPLIANCES[id].name));
    sel.value = kit.apps[k][0] || 'none';
    sel.addEventListener('change', function () { kit.setAppliances(k, [sel.value]); EL.track('sim_appliance', { outlet: k + 1, id: sel.value }); });
    const asw = h('input', { type: 'checkbox' });
    asw.addEventListener('change', function () { kit.setApplianceSwitch(k, 0, asw.checked); });
    refs.simSel = sel;
    refs.simSw = asw;
    refs.sim.append(h('div.small.muted', '🧪 Simulation : appareil branché'), h('div.row', [sel, h('label.check.small', [asw, 'interrupteur de l’appareil'])]));
  }

  // ---------------------------------------------------------------- vue
  const view = {
    mount: function (main) {
      const app = EL.app;
      this.refs = {};
      this.progKey = null;
      const R = this.refs;
      if (app.mode === 'demo') {
        main.appendChild(h('div.demo-banner', [h('b', 'Mode démonstration'), ' — aucun kit détecté : les mesures viennent du jumeau numérique (simulation réaliste). Choisissez les appareils branchés sur chaque prise ci-dessous.']));
      }
      R.alert = h('div.alert-banner.hidden');
      main.appendChild(R.alert);
      main.appendChild(h('div.page-head', [h('div', [h('h1', 'Ma maison'), h('p', 'Consommation de chaque prise en temps réel. Touchez une pièce pour voir les mesures détaillées.')])]));
      R.gauge = gaugeSvg();
      R.kE = h('div.val', '--'); R.kC = h('div.val', '--'); R.kCO2 = h('div.val', '--'); R.kPk = h('div.val', '--');
      R.kEs = h('div.sub', ''); R.kCs = h('div.sub', ''); R.kPks = h('div.sub', ''); R.kCO2s = h('div.sub', '');
      R.envT = h('b', '--'); R.envH = h('b', '--'); R.envL = h('b', '--'); R.envP = h('b', '--'); R.clock = h('b', '--');
      R.tariff = h('span.badge', '');
      const kpis = h('div.grid.g4', [
        h('div.card', [h('div.kpi', [h('div.lbl', 'Puissance totale'), R.gauge.el])]),
        h('div.card', [h('div.kpi', [h('div.lbl', 'Énergie aujourd’hui'), R.kE, R.kEs]), h('div.kpi', { style: { marginTop: '10px' } }, [h('div.lbl', 'Coût aujourd’hui'), R.kC, R.kCs])]),
        h('div.card', [h('div.kpi', [h('div.lbl', 'Pointe du jour'), R.kPk, R.kPks]), h('div.kpi', { style: { marginTop: '10px' } }, [h('div.lbl', 'CO₂ émis'), R.kCO2, R.kCO2s])]),
        h('div.card', [h('div.kpi', [h('div.lbl', 'Ambiance')]), h('div.col.small', { style: { gap: '6px', marginTop: '6px' } }, [
          h('div', ['🌡️ Température : ', R.envT]), h('div', ['💧 Humidité : ', R.envH]), h('div', ['☀️ Luminosité : ', R.envL]),
          h('div', ['🚶 Présence : ', R.envP]), h('div', ['🕐 Heure du kit : ', R.clock, ' ', R.tariff])
        ])])
      ]);
      main.appendChild(kpis);
      R.house = houseSvg();
      main.appendChild(h('div.card', { style: { marginTop: '14px' } }, [R.house.el]));
      R.outlets = [0, 1, 2, 3].map(outletCard);
      R.outlets.forEach(function (o, k) { simControls(k, o); });
      main.appendChild(h('h2', { style: { margin: '18px 0 10px' } }, 'Les prises'));
      main.appendChild(h('div.outlet-cards', R.outlets.map(function (o) { return o.el; })));
      // courbe
      R.cv = h('canvas.chart.tall');
      R.legend = h('div.legend');
      main.appendChild(h('div.card', { style: { marginTop: '14px' } }, [
        h('div.card-head', [h('h2', '📈 Puissance des 10 dernières minutes'), R.legend]), R.cv
      ]));
      R.chart = new EL.charts.LineChart(R.cv, { stacked: true, fill: true, yMin: 0, yUnit: 'W', xFmt: function (t) { return U.fmtClock(t, app.state ? app.state.tz : 0); } });
      // programme + journal
      R.prog = h('div');
      R.logs = h('div.console', { style: { height: '170px' } });
      main.appendChild(h('div.grid.g2', { style: { marginTop: '14px' } }, [
        h('div.card', [h('div.card-head', [h('h2', '🧩 Programme du kit'), h('a.btn.small', { href: '#/programmer' }, 'Ouvrir l’éditeur')]), R.prog]),
        h('div.card', [h('div.card-head', [h('h2', '📋 Journal'), h('button.btn.small', { onclick: function () { document.getElementById('btn-alerts').click(); } }, 'Tout voir')]), R.logs])
      ]));
      this.offLog = app.on('log', this.renderLogs.bind(this));
      this.offCfg = app.on('config', this.applyConfig.bind(this));
      this.renderLogs();
      this.applyConfig();
      this.loadHistory();
    },
    unmount: function () {
      if (this.offLog) this.offLog();
      if (this.offCfg) this.offCfg();
      if (this.refs && this.refs.chart) this.refs.chart.destroy();
      clearInterval(this.histTimer);
    },
    loadHistory: async function () {
      const self = this;
      const draw = async function () {
        const list = await EL.app.kit.getHistory(600);
        if (!self.refs || !self.refs.cv.isConnected) return;
        const xs = list.map(function (s) { return s.t; });
        const ys = [0, 1, 2, 3].map(function (k) { return list.map(function (s) { return s.p[k]; }); });
        const c = EL.app.config;
        self.refs.chart.o.series = [0, 1, 2, 3].map(function (k) { return { name: c ? c.outlets[k].name : 'Prise ' + (k + 1), color: HEX[k] }; });
        self.refs.chart.o.refLines = c ? [{ y: c.tariff.contractW, label: 'puissance souscrite', color: '#d64545' }] : [];
        self.refs.chart.setData(xs, ys);
      };
      draw();
      this.histTimer = setInterval(draw, 5000);
    },
    applyConfig: function () {
      const c = EL.app.config, R = this.refs;
      if (!c || !R) return;
      U.clear(R.legend);
      c.outlets.forEach(function (o, k) {
        R.outlets[k].name.textContent = (k + 1) + '\u00a0·\u00a0' + o.name;
        R.outlets[k].ico.textContent = ICONS[o.icon] || '🔌';
        R.house.rooms[k].name.textContent = (k + 1) + '\u00a0·\u00a0' + o.name;
        R.house.rooms[k].ico.textContent = ICONS[o.icon] || '🔌';
        R.legend.appendChild(h('span', [h('i', { style: { background: HEX[k] } }), o.name]));
        R.outlets[k].el.style.opacity = o.enabled ? '' : '0.45';
      });
    },
    renderLogs: function () {
      const R = this.refs;
      if (!R) return;
      U.clear(R.logs);
      const tz = EL.app.state ? EL.app.state.tz : 0;
      for (const e of EL.app.logs.slice(-12).reverse()) R.logs.appendChild(h('div.l' + e.level, [h('span.ts', e.ts ? U.fmtClock(e.ts, tz) : ''), e.msg]));
    },
    onState: function (s) {
      const R = this.refs, c = EL.app.config;
      if (!R) return;
      const contract = c ? c.tariff.contractW : 3000;
      const cur = c ? c.tariff.currency : '';
      R.gauge.set(s.total.p, contract);
      R.kE.textContent = U.fmtE(s.total.eToday);
      R.kEs.textContent = 'soit ' + U.fmt(s.total.eToday / 1000, 3, 'kWh');
      R.kC.textContent = U.fmtMoney(s.total.costToday, cur);
      R.kCs.textContent = 'prix actuel : ' + U.fmt(s.tariff.price, 2, cur + '/kWh');
      R.kPk.textContent = U.fmtP(s.total.peak);
      R.kPks.textContent = s.total.peak > contract ? 'au-dessus de la puissance souscrite !' : 'sous la puissance souscrite';
      R.kCO2.textContent = U.fmt(s.total.co2, 0, 'g');
      R.kCO2s.textContent = c ? 'facteur ' + c.tariff.co2 + ' g/kWh' : '';
      R.envT.textContent = U.fmt(s.env.temp, 1, '°C');
      R.envH.textContent = U.fmt(s.env.hum, 0, '%');
      R.envL.textContent = U.fmt(s.env.lum, 0, '%');
      R.envP.textContent = s.env.pres ? 'oui' : 'non';
      R.clock.textContent = s.timeValid ? U.fmtClock(s.ts, s.tz) : 'non réglée';
      R.tariff.textContent = c && c.tariff.hpHc ? (s.tariff.offPeak ? 'heures creuses' : 'heures pleines') : '';
      R.tariff.className = 'badge ' + (s.tariff.offPeak ? 'ok' : (c && c.tariff.hpHc ? 'warn' : ''));
      R.house.total.textContent = U.fmtP(s.total.p);
      R.house.energy.textContent = U.fmtE(s.total.eToday) + ' aujourd’hui';
      const latched = [];
      s.outlets.forEach(function (o, k) {
        const r = R.outlets[k], room = R.house.rooms[k];
        const oc = c ? c.outlets[k] : null;
        r.p.textContent = o.online ? U.fmtP(o.p) : 'capteur absent';
        r.el.classList.toggle('off', !o.on);
        r.el.classList.toggle('latched', o.latched);
        if (document.activeElement !== r.sw) r.sw.checked = o.on;
        r.rearm.classList.toggle('hidden', !o.latched);
        const app = EL.applianceName(o.appliance);
        r.sub.textContent = o.latched ? '⛔ protection : ' + o.latchReason : (app ? '🧠 reconnu : ' + app : (o.on ? 'prise allumée' : 'prise éteinte'));
        const max = oc ? oc.maxPower : 2000;
        r.bar.style.width = Math.min(100, (o.p || 0) / max * 100).toFixed(1) + '%';
        U.clear(r.meta);
        r.meta.append(
          h('span', 'U ' + U.fmt(o.u, 1, 'V')), h('span', 'I ' + U.fmt(o.i, 3, 'A')),
          h('span', 'FP ' + U.fmt(o.pf, 2)), h('span', 'Aujourd’hui ' + U.fmtE(o.eToday))
        );
        U.clear(r.badges);
        if (o.shed) r.badges.appendChild(h('span.badge.warn', 'délestée'));
        if (o.pending) r.badges.appendChild(h('span.badge.info', 'commutation en attente'));
        if (o.pulseLeft > 0) r.badges.appendChild(h('span.badge.info', '⏱ ' + U.fmtDuration(o.pulseLeft)));
        if (o.anomaly) r.badges.appendChild(h('span.badge.bad', 'anomalie'));
        if (o.alarm) r.badges.appendChild(h('span.badge.bad', 'alarme capteur'));
        if (o.on && o.idle > 60) r.badges.appendChild(h('span.badge', 'inactive ' + U.fmtDuration(o.idle)));
        if (o.latched) latched.push((k + 1) + ' (' + (oc ? oc.name : '') + ')');
        // pièce
        room.p.textContent = o.online ? U.fmtP(o.p) : '--';
        room.sub.textContent = o.latched ? 'PROTECTION' : (o.on ? (app ? '≈ ' + app : 'allumée') : 'éteinte');
        room.led.setAttribute('fill', o.latched ? '#d64545' : (o.on ? '#1f9d55' : '#b9c2cc'));
        room.glow.setAttribute('opacity', Math.min(0.35, (o.p || 0) / 2000 * 0.35 + (o.on && o.p > 1 ? 0.04 : 0)).toFixed(3));
        const flowing = o.on && o.p > 1;
        room.flow.style.display = flowing ? '' : 'none';
        room.wire.classList.toggle('on', flowing);
        if (flowing) room.flow.style.animationDuration = Math.max(0.25, Math.min(4, 300 / o.p)).toFixed(2) + 's';
        // simulation
        if (r.simSw && EL.app.kit.kind === 'sim' && s.sim) {
          const a = s.sim.outlets[k][0];
          if (a) {
            if (document.activeElement !== r.simSw) r.simSw.checked = !!a.sw;
            if (document.activeElement !== r.simSel && r.simSel.value !== a.id) r.simSel.value = a.id;
          }
        }
      });
      if (latched.length) {
        R.alert.classList.remove('hidden');
        R.alert.textContent = '⛔ Protection déclenchée sur la prise ' + latched.join(', ') + '. Débranchez l’appareil en cause puis réarmez la prise.';
      } else R.alert.classList.add('hidden');
      this.renderProgram(s);
    },
    renderProgram: function (s) {
      const R = this.refs;
      const st = ['aucun programme', 'en cours', 'terminé', 'erreur', 'arrêté'][s.vm.status] || '';
      const cls = ['', 'ok', 'info', 'bad', 'warn'][s.vm.status] || '';
      const key = s.vm.status + '|' + s.vm.name + '|' + s.vm.error + '|' + Math.floor(s.vm.runtime / 5);
      if (key === this.progKey) return;
      this.progKey = key;
      U.clear(R.prog);
      if (!s.vm.name) { R.prog.appendChild(h('p.muted', 'Aucun programme chargé. Créez-en un avec les blocs dans l’onglet « Programmer ».')); return; }
      R.prog.append(
        h('div.row', [h('b', s.vm.name), h('span.badge.' + cls, st), s.vm.status === 1 ? h('span.small.muted', 'depuis ' + U.fmtDuration(s.vm.runtime)) : null]),
        s.vm.error ? h('div.note.bad', { style: { marginTop: '8px' } }, s.vm.error) : null,
        h('div.row', { style: { marginTop: '10px' } }, [
          s.vm.status === 1 ? h('button.btn.small', { onclick: async function () { const r = await EL.app.kit.programCtl('stop', null, EL.app.pin); if (!r.ok) EL.toast(r.msg, 'bad'); EL.track('program_stop', 'maison'); } }, [EL.icon('stop'), 'Arrêter'])
            : h('button.btn.small.primary', { onclick: async function () { const r = await EL.app.kit.programCtl('start', null, EL.app.pin); if (!r.ok) EL.toast(r.msg, 'bad'); EL.track('program_start', 'maison'); } }, [EL.icon('play'), 'Démarrer'])
        ])
      );
    }
  };
  EL.views.maison = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);

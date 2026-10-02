/* EnergyLab — laboratoire de mesure : grandeurs électriques, formules vivantes, triangle des
 * puissances, diagramme de Fresnel, formes d'onde, fiche comparative, paramètres du capteur et du relais */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  if (typeof document === 'undefined') return;
  const U = EL.util, h = U.h, svg = U.svg;

  function readout(label, unit) {
    const v = h('span', '--');
    return { el: h('div.readout', [h('div.lbl', label), h('div', [h('span.val', v), h('span.unit', unit)])]), v: v };
  }

  function triangle() {
    const s = svg('svg', { viewBox: '0 0 300 210', style: 'width:100%;max-width:360px;display:block;margin:auto' });
    const P = svg('line', { stroke: '#3b82f6', 'stroke-width': 5, 'stroke-linecap': 'round' });
    const Q = svg('line', { stroke: '#ef4444', 'stroke-width': 5, 'stroke-linecap': 'round' });
    const S = svg('line', { stroke: '#10b981', 'stroke-width': 5, 'stroke-linecap': 'round' });
    const arc = svg('path', { fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1.5 });
    const tP = svg('text', { 'font-size': 12, 'font-weight': 700, fill: '#3b82f6', 'text-anchor': 'middle' });
    const tQ = svg('text', { 'font-size': 12, 'font-weight': 700, fill: '#ef4444' });
    const tS = svg('text', { 'font-size': 12, 'font-weight': 700, fill: '#10b981', 'text-anchor': 'end' });
    const tPhi = svg('text', { 'font-size': 12, fill: 'var(--muted)' });
    const empty = svg('text', { x: 150, y: 105, 'font-size': 13, fill: 'var(--muted)', 'text-anchor': 'middle' }, 'Aucun courant : allumez la prise et branchez un appareil');
    const g = svg('g');
    g.append(arc, P, Q, S, tP, tQ, tS, tPhi);
    s.append(g, empty);
    return {
      el: s,
      set: function (p, q, sv, phi) {
        const none = !(sv >= 1);
        g.style.display = none ? 'none' : '';
        empty.style.display = none ? '' : 'none';
        if (none) return;
        const ox = 30, oy = 180;
        let k = 0;
        if (sv > 0 && Number.isFinite(sv)) k = 230 / Math.max(p, q * 1.4, 1);
        const px = ox + p * k, qy = oy - Math.min(150, q * k);
        P.setAttribute('x1', ox); P.setAttribute('y1', oy); P.setAttribute('x2', px); P.setAttribute('y2', oy);
        Q.setAttribute('x1', px); Q.setAttribute('y1', oy); Q.setAttribute('x2', px); Q.setAttribute('y2', qy);
        S.setAttribute('x1', ox); S.setAttribute('y1', oy); S.setAttribute('x2', px); S.setAttribute('y2', qy);
        const a = Math.atan2(oy - qy, px - ox);
        arc.setAttribute('d', 'M' + (ox + 40) + ' ' + oy + ' A40 40 0 0 0 ' + (ox + 40 * Math.cos(a)) + ' ' + (oy - 40 * Math.sin(a)));
        tP.setAttribute('x', (ox + px) / 2); tP.setAttribute('y', oy + 20); tP.textContent = 'P = ' + U.fmtP(p);
        tQ.setAttribute('x', Math.min(px + 6, 240)); tQ.setAttribute('y', (oy + qy) / 2); tQ.textContent = 'Q = ' + U.fmt(q, 1, 'var');
        tS.setAttribute('x', (ox + px) / 2 - 8); tS.setAttribute('y', (oy + qy) / 2 - 8); tS.textContent = 'S = ' + U.fmt(sv, 1, 'VA');
        tPhi.setAttribute('x', ox + 46); tPhi.setAttribute('y', oy - 8); tPhi.textContent = 'φ = ' + U.fmt(phi, 1, '°');
      }
    };
  }

  function fresnel() {
    const s = svg('svg', { viewBox: '0 0 220 220', style: 'width:100%;max-width:260px;display:block;margin:auto' });
    s.append(
      svg('circle', { cx: 110, cy: 110, r: 95, fill: 'none', stroke: 'var(--line)' }),
      svg('line', { x1: 10, y1: 110, x2: 210, y2: 110, stroke: 'var(--line)' }),
      svg('line', { x1: 110, y1: 10, x2: 110, y2: 210, stroke: 'var(--line)' })
    );
    const u = svg('line', { x1: 110, y1: 110, stroke: '#3b82f6', 'stroke-width': 4, 'stroke-linecap': 'round' });
    const i = svg('line', { x1: 110, y1: 110, stroke: '#ef4444', 'stroke-width': 4, 'stroke-linecap': 'round' });
    const tu = svg('text', { 'font-size': 12, 'font-weight': 700, fill: '#3b82f6' }, 'U');
    const ti = svg('text', { 'font-size': 12, 'font-weight': 700, fill: '#ef4444' }, 'I');
    s.append(u, i, tu, ti);
    let phi = 0, angle = 0, last = 0, raf = null, hasI = true;
    const draw = function (t) {
      if (!s.isConnected) { raf = null; return; }
      const dt = last ? (t - last) / 1000 : 0;
      last = t;
      angle += dt * 0.6; // rotation lente (pédagogique : 50 Hz serait trop rapide)
      const ua = angle, ia = angle - phi * Math.PI / 180;
      u.setAttribute('x2', 110 + 90 * Math.cos(ua)); u.setAttribute('y2', 110 - 90 * Math.sin(ua));
      i.style.display = ti.style.display = hasI ? '' : 'none';
      i.setAttribute('x2', 110 + 65 * Math.cos(ia)); i.setAttribute('y2', 110 - 65 * Math.sin(ia));
      tu.setAttribute('x', 110 + 100 * Math.cos(ua) - 4); tu.setAttribute('y', 114 - 100 * Math.sin(ua));
      ti.setAttribute('x', 110 + 78 * Math.cos(ia) - 4); ti.setAttribute('y', 114 - 78 * Math.sin(ia));
      raf = requestAnimationFrame(draw);
    };
    return { el: s, set: function (p, current) { phi = Number.isFinite(p) ? p : 0; hasI = current === undefined || current > 0.001; if (!raf) raf = requestAnimationFrame(draw); } };
  }

  function waveforms(cv, U0, I0, phiDeg, P) {
    const S = cv.getBoundingClientRect();
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    cv.width = Math.max(100, S.width) * dpr;
    cv.height = Math.max(100, S.height) * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = S.width, H = S.height;
    ctx.clearRect(0, 0, W, H);
    const mid = H / 2;
    ctx.strokeStyle = EL.charts.css('--line', '#ddd');
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(W, mid); ctx.stroke();
    if (!Number.isFinite(U0) || !Number.isFinite(I0)) return;
    const um = U0 * Math.SQRT2, im = I0 * Math.SQRT2, pm = Math.max(1, um * im);
    const phi = (Number.isFinite(phiDeg) ? phiDeg : 0) * Math.PI / 180;
    const T = 0.04; // deux périodes à 50 Hz
    const plot = function (fn, col, scale, width, dash) {
      ctx.strokeStyle = col; ctx.lineWidth = width || 2; ctx.setLineDash(dash || []);
      ctx.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const t = x / W * T;
        const y = mid - fn(t) * scale;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };
    const w = 2 * Math.PI * 50;
    const k = (H / 2 - 10);
    plot(function (t) { return um * Math.sin(w * t); }, '#3b82f6', k / um);
    plot(function (t) { return im * Math.sin(w * t - phi); }, '#ef4444', k * 0.75 / Math.max(im, 1e-6));
    plot(function (t) { return um * Math.sin(w * t) * im * Math.sin(w * t - phi); }, '#f59e0b', k / pm, 1.5);
    const pAvg = Number.isFinite(P) ? P : um * im / 2 * Math.cos(phi);
    ctx.strokeStyle = '#10b981'; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(0, mid - pAvg * k / pm); ctx.lineTo(W, mid - pAvg * k / pm); ctx.stroke(); ctx.setLineDash([]);
  }

  const MKEY = 'measures';

  const view = {
    mount: function (main, args) {
      const app = EL.app, self = this;
      this.k = Math.min(4, Math.max(1, parseInt(args[0], 10) || this.k || 1)) - 1;
      const R = this.R = {};
      main.appendChild(h('div.page-head', [h('div', [h('h1', 'Laboratoire de mesure'), h('p', 'Grandeurs électriques mesurées par le capteur PZEM-004T de chaque prise, et les lois de l’électricité appliquées en direct.')])]));
      R.tabs = h('div.tabs');
      for (let k = 0; k < 4; k++) {
        R.tabs.appendChild(h('button', { onclick: function () { location.hash = '#/mesures/' + (k + 1); } }, 'Prise ' + (k + 1)));
      }
      main.appendChild(R.tabs);
      R.sw = h('input', { type: 'checkbox' });
      R.sw.addEventListener('change', function () { EL.relayCmd(self.k, R.sw.checked); });
      R.title = h('h2', '');
      R.status = h('span.badge', '');
      main.appendChild(h('div.card', [
        h('div.card-head', [h('div.row', [R.title, R.status]), h('div.row', [
          h('label.row.small', [h('label.switch', [R.sw, h('span')]), 'prise allumée']),
          h('button.btn.small', { onclick: function () { self.pulse(); } }, [EL.icon('bolt'), 'Allumer 30 s']),
          h('button.btn.small', { onclick: function () { self.snapshot(); } }, [EL.icon('plus'), 'Enregistrer la mesure'])
        ])]),
        (function () {
          const g = h('div.big-readouts');
          R.r = {
            u: readout('Tension U', 'V'), i: readout('Courant I', 'A'), p: readout('Puissance active P', 'W'),
            s: readout('Puissance apparente S', 'VA'), q: readout('Puissance réactive Q', 'var'), pf: readout('Facteur de puissance', ''),
            phi: readout('Déphasage φ', '°'), f: readout('Fréquence f', 'Hz'), ed: readout("Énergie aujourd'hui", 'Wh'),
            ec: readout('Compteur du capteur', 'kWh'), cd: readout("Coût aujourd'hui", ''), sw: readout("Commutations aujourd'hui", '')
          };
          for (const k of Object.keys(R.r)) g.appendChild(R.r[k].el);
          return g;
        })()
      ]));
      // formules + triangle + Fresnel
      R.formulas = h('div.col');
      R.tri = triangle();
      R.fre = fresnel();
      main.appendChild(h('div.grid.g2', { style: { marginTop: '14px' } }, [
        h('div.card', [h('h2', '🧮 Formules vivantes'), h('p.small.muted', 'Les lois du cours, calculées avec les mesures actuelles.'), R.formulas]),
        h('div.card', [h('h2', '📐 Triangle des puissances'), R.tri.el, h('p.small.muted', 'S² = P² + Q². Plus φ est grand, plus le facteur de puissance cos φ est faible.')])
      ]));
      R.wave = h('canvas.chart');
      main.appendChild(h('div.grid.g2', { style: { marginTop: '14px' } }, [
        h('div.card', [h('h2', '🌀 Diagramme de Fresnel'), R.fre.el, h('p.small.muted', 'Vecteurs tournants de la tension U et du courant I, décalés de φ (sens du déphasage non mesuré : représenté en retard, cas d’une charge inductive).')]),
        h('div.card', [h('h2', '〰️ Formes d’onde (reconstruites)'), R.wave, h('div.legend', [
          h('span', [h('i', { style: { background: '#3b82f6' } }), 'tension u(t)']), h('span', [h('i', { style: { background: '#ef4444' } }), 'courant i(t)']),
          h('span', [h('i', { style: { background: '#f59e0b' } }), 'puissance p(t) = u·i']), h('span', [h('i', { style: { background: '#10b981' } }), 'puissance moyenne P'])
        ]), h('p.small.muted', 'Courbes sinusoïdales reconstruites à partir de U, I et φ (le capteur ne fournit pas les échantillons). Pour un appareil électronique, le courant réel est déformé (harmoniques).')])
      ]));
      // courbe
      R.cv = h('canvas.chart');
      R.chart = new EL.charts.LineChart(R.cv, { yMin: 0, yUnit: 'W', fill: true, xFmt: function (t) { return U.fmtClock(t, app.state ? app.state.tz : 0); } });
      main.appendChild(h('div.card', { style: { marginTop: '14px' } }, [h('h2', '📈 Puissance de la prise (10 min)'), R.cv]));
      // coût d'usage
      R.hours = h('input.inp', { type: 'number', value: 4, min: 0, max: 24, step: 0.5, style: { width: '90px' } });
      R.usage = h('div.formula');
      R.hours.addEventListener('input', function () { self.renderUsage(); });
      // paramètres
      R.params = h('div.form-grid');
      main.appendChild(h('div.grid.g2', { style: { marginTop: '14px' } }, [
        h('div.card', [h('h2', '💰 Combien coûte cet appareil ?'), h('label.row', ['Utilisation par jour :', R.hours, 'heures']), R.usage]),
        h('div.card', [h('h2', '⚙️ Paramètres du relais et du capteur'), h('p.small.muted', 'Modifiez les réglages de cette prise (dans les limites fixées par l’enseignant). Les mêmes réglages existent sous forme de blocs.'), R.params])
      ]));
      // fiche comparative
      R.table = h('div.tbl-wrap');
      R.bars = h('canvas.chart');
      main.appendChild(h('div.card', { style: { marginTop: '14px' } }, [
        h('div.card-head', [h('h2', '📋 Fiche de mesures comparatives'), h('div.row', [
          h('button.btn.small', { onclick: function () { self.exportCsv(); } }, [EL.icon('download'), 'CSV']),
          h('button.btn.small', { onclick: async function () { if (await EL.confirm('Effacer la fiche', 'Supprimer toutes les mesures enregistrées ?', 'Effacer')) { U.store.set(MKEY, []); self.renderTable(); } } }, [EL.icon('trash'), 'Effacer'])
        ])]),
        h('p.small.muted', 'Branchez différents appareils, cliquez sur « Enregistrer la mesure » et comparez : résistif, moteur, électronique…'),
        R.table, R.bars
      ]));
      this.renderTable();
      this.offCfg = app.on('config', function () { self.renderParams(); self.renderTitle(); });
      this.renderTitle();
      this.renderParams();
      this.histTimer = setInterval(function () { self.loadHistory(); }, 5000);
      this.loadHistory();
    },
    unmount: function () {
      if (this.offCfg) this.offCfg();
      clearInterval(this.histTimer);
      if (this.R && this.R.chart) this.R.chart.destroy();
    },
    renderTitle: function () {
      const c = EL.app.config, R = this.R, k = this.k;
      U.$$('button', R.tabs).forEach(function (b, i) {
        b.classList.toggle('active', i === k);
        if (c) b.textContent = (i + 1) + ' · ' + c.outlets[i].name;
      });
      R.title.textContent = 'Prise ' + (k + 1) + (c ? ' — ' + c.outlets[k].name : '');
    },
    loadHistory: async function () {
      const list = await EL.app.kit.getHistory(600);
      if (!this.R || !this.R.cv.isConnected) return;
      const k = this.k;
      this.R.chart.o.series = [{ name: 'P', color: EL.OUTLET_COLORS[k] }];
      this.R.chart.setData(list.map(function (s) { return s.t; }), [list.map(function (s) { return s.p[k]; })]);
    },
    pulse: async function () {
      const r = await EL.app.kit.cmd({ cmd: 'pulse', outlet: this.k + 1, s: 30 }, EL.app.pin);
      EL.track('relay_pulse', { outlet: this.k + 1 });
      if (!r.ok) EL.toast(r.msg, 'bad');
    },
    renderParams: function () {
      const c = EL.app.config, R = this.R, k = this.k, self = this;
      if (!c) return;
      U.clear(R.params);
      const o = c.outlets[k];
      const field = function (label, p, idx, value, unit, step, help) {
        const inp = h('input', { type: 'number', value: value, step: step || 'any' });
        const btn = h('button.btn.small', { type: 'button' }, 'Appliquer');
        btn.onclick = async function () {
          const v = Number(inp.value);
          const r = await EL.app.kit.cmd({ cmd: 'param', p: p, idx: idx, v: v }, EL.app.pin);
          EL.track('param_change', { p: p, idx: idx, v: v, ok: !!r.ok, from: 'mesures' });
          if (r.ok) { EL.toast(r.msg ? 'Appliqué : ' + r.msg : 'Paramètre appliqué', r.msg ? 'warn' : 'ok'); inp.value = r.v; } else EL.toast(r.msg, 'bad');
        };
        return h('div.field', [h('span', label + (unit ? ' (' + unit + ')' : '')), h('div.row', { style: { flexWrap: 'nowrap' } }, [inp, btn]), help ? h('small', help) : null]);
      };
      R.params.append(
        field('Puissance max (protection)', 0, k + 1, o.maxPower, 'W', 10, 'Au-delà, la prise est coupée et verrouillée.'),
        field("Seuil d'alarme du capteur", 1, k + 1, o.pzemAlarm, 'W', 1, 'Registre interne du PZEM-004T.'),
        field('Délai entre commutations', 4, k + 1, o.minSwitchS, 's', 0.5, 'Protège les appareils (compresseurs…).'),
        field('Seuil de veille', 5, k + 1, o.standbyW, 'W', 0.5, 'Sous ce seuil, l’appareil est considéré inactif.'),
        field('Priorité (délestage)', 2, k + 1, o.priority, '1 à 4', 1, '1 = la plus importante.'),
        field('Période de mesure (toutes prises)', 10, 0, c.measure.sampleMs, 'ms', 100, 'Intervalle entre deux lectures des capteurs.'),
        field('Puissance souscrite (maison)', 12, 0, c.tariff.contractW, 'W', 50, 'Limite utilisée par le délestage et les alertes.'),
        field('Lissage (toutes prises)', 11, 0, c.measure.smoothN, 'mesures', 1, 'Moyenne glissante : 1 = aucune.')
      );
      void self;
    },
    renderUsage: function () {
      const s = EL.app.state, c = EL.app.config, R = this.R;
      if (!s || !R) return;
      const o = s.outlets[this.k];
      const hrs = Number(R.hours.value) || 0;
      const p = Number.isFinite(o.p) ? o.p : 0;
      const day = p * hrs / 1000, price = c ? c.tariff.priceHP : 1, cur = c ? c.tariff.currency : '';
      U.clear(R.usage);
      R.usage.append(
        h('div', ['E/jour = P × t = ', h('b', U.fmt(p, 1, 'W')), ' × ', h('b', U.fmt(hrs, 1, 'h')), ' = ', h('b', U.fmt(day, 3, 'kWh'))]),
        h('div', ['Par mois (30 j) : ', h('b', U.fmt(day * 30, 2, 'kWh')), ' → ', h('b', U.fmt(day * 30 * price, 2, cur))]),
        h('div', ['Par an : ', h('b', U.fmt(day * 365, 1, 'kWh')), ' → ', h('b', U.fmt(day * 365 * price, 2, cur)), ' ; CO₂ ≈ ', h('b', U.fmt(day * 365 * (c ? c.tariff.co2 : 600) / 1000, 1, 'kg'))])
      );
    },
    snapshot: function () {
      const s = EL.app.state;
      if (!s) return;
      const o = s.outlets[this.k];
      if (!o.online) { EL.toast('Pas de mesure disponible sur cette prise', 'bad'); return; }
      const self = this;
      const name = h('input', { placeholder: 'ex. bouilloire, lampe LED, chargeur…', maxlength: 40 });
      EL.modal({
        title: 'Enregistrer la mesure', body: h('label.field', [h('span', 'Nom de l’appareil'), name]),
        actions: [{ label: 'Annuler' }, {
          label: 'Enregistrer', kind: 'primary', onClick: function () {
            const list = U.store.get(MKEY, []);
            list.push({ name: name.value.trim() || 'Appareil ' + (list.length + 1), outlet: self.k + 1, u: o.u, i: o.i, p: o.p, s: o.s, q: o.q, pf: o.pf, phi: o.phi, at: new Date().toISOString() });
            U.store.set(MKEY, list);
            EL.track('measure_snapshot', { name: name.value.trim(), p: o.p, pf: o.pf });
            self.renderTable();
          }
        }]
      });
    },
    renderTable: function () {
      const R = this.R, list = U.store.get(MKEY, []);
      U.clear(R.table);
      if (!list.length) { R.table.appendChild(h('div.empty', 'Aucune mesure enregistrée.')); R.bars.style.display = 'none'; return; }
      const nature = function (m) {
        if (!(m.p > 0.5)) return '—';
        if (m.pf >= 0.97) return 'résistif (φ ≈ 0)';
        if (m.pf >= 0.7) return 'moteur / inductif';
        return 'électronique (courant déformé)';
      };
      const tb = h('table.tbl', [
        h('thead', h('tr', ['Appareil', 'Prise', 'U (V)', 'I (A)', 'P (W)', 'S (VA)', 'Q (var)', 'FP', 'Nature probable', ''].map(function (t, i) { return h('th' + (i >= 2 && i <= 7 ? '.num' : ''), t); }))),
        h('tbody', list.map(function (m, idx) {
          return h('tr', [h('td', m.name), h('td', String(m.outlet)), h('td.num', U.fmt(m.u, 1)), h('td.num', U.fmt(m.i, 3)), h('td.num', U.fmt(m.p, 1)), h('td.num', U.fmt(m.s, 1)), h('td.num', U.fmt(m.q, 1)), h('td.num', U.fmt(m.pf, 2)), h('td', nature(m)),
            h('td', h('button.btn.small.ghost', { onclick: function () { list.splice(idx, 1); U.store.set(MKEY, list); view.renderTable(); }, title: 'Supprimer' }, EL.icon('trash')))]);
        }))
      ]);
      R.table.appendChild(tb);
      R.bars.style.display = '';
      requestAnimationFrame(function () {
        EL.charts.barChart(R.bars, list.map(function (m) { return m.name.slice(0, 14); }), [{ color: '#3b82f6', values: list.map(function (m) { return m.p; }) }], { showValues: true });
      });
    },
    exportCsv: function () {
      const list = U.store.get(MKEY, []);
      const rows = [['appareil', 'prise', 'U_V', 'I_A', 'P_W', 'S_VA', 'Q_var', 'FP', 'phi_deg', 'date']].concat(list.map(function (m) { return [m.name, m.outlet, m.u, m.i, m.p, m.s, m.q, m.pf, m.phi, m.at]; }));
      U.download('fiche-mesures.csv', U.toCsv(rows), 'text/csv;charset=utf-8');
    },
    onState: function (s) {
      const R = this.R, k = this.k, c = EL.app.config;
      if (!R) return;
      const o = s.outlets[k];
      const cur = c ? c.tariff.currency : '';
      R.r.u.v.textContent = U.fmt(o.u, 1); R.r.i.v.textContent = U.fmt(o.i, 3); R.r.p.v.textContent = U.fmt(o.p, 1);
      R.r.s.v.textContent = U.fmt(o.s, 1); R.r.q.v.textContent = U.fmt(o.q, 1); R.r.pf.v.textContent = U.fmt(o.pf, 2);
      R.r.phi.v.textContent = U.fmt(o.phi, 1); R.r.f.v.textContent = U.fmt(o.f, 1); R.r.ed.v.textContent = U.fmt(o.eToday, 2);
      R.r.ec.v.textContent = U.fmt(o.eCounter, 3); R.r.cd.v.textContent = U.fmt(o.costToday, 3) + ' ' + cur; R.r.sw.v.textContent = String(o.switches);
      if (document.activeElement !== R.sw) R.sw.checked = o.on;
      R.status.textContent = o.latched ? 'protection déclenchée' : (o.online ? (o.on ? 'allumée' : 'éteinte') : 'capteur absent');
      R.status.className = 'badge ' + (o.latched ? 'bad' : (o.online ? (o.on ? 'ok' : '') : 'warn'));
      R.tri.set(o.p || 0, o.q || 0, o.s || 0, o.phi);
      R.fre.set(o.phi, o.i);
      waveforms(R.wave, o.u, o.i, o.phi, o.p);
      // formules
      U.clear(R.formulas);
      const f = function (parts) { return h('div.formula', parts); };
      const S = o.u * o.i;
      R.formulas.append(
        f(['S = U × I = ', h('b', U.fmt(o.u, 1)), ' × ', h('b', U.fmt(o.i, 3)), ' = ', h('b', U.fmt(S, 1, 'VA'))]),
        f(['P = U × I × cos φ = ', h('b', U.fmt(S, 1)), ' × ', h('b', U.fmt(o.pf, 2)), ' ≈ ', h('b', U.fmt(S * o.pf, 1, 'W')), h('span.muted', '  (mesuré : ' + U.fmt(o.p, 1, 'W') + ')')]),
        f(['Q = √(S² − P²) = ', h('b', U.fmt(o.q, 1, 'var'))]),
        f(['cos φ = P / S = ', h('b', U.fmt(o.s > 0 ? o.p / o.s : NaN, 2)), ' → φ = ', h('b', U.fmt(o.phi, 1, '°'))]),
        f(['E = P × t : en 1 h, ', h('b', U.fmt((o.p || 0) / 1000, 3, 'kWh')), ' ; coût = E × prix = ', h('b', U.fmt((o.p || 0) / 1000 * (s.tariff.price || 0), 3, cur))]),
        f(['I = P / (U × cos φ) = ', h('b', U.fmt(o.u > 0 && o.pf > 0 ? o.p / (o.u * o.pf) : NaN, 3, 'A'))])
      );
      this.renderUsage();
    }
  };
  EL.views.mesures = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);

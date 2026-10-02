/* EnergyLab — laboratoire d'intelligence : algorithmes, arène de comparaison, apprentissage
 * des appareils (k plus proches voisins), prévision et détection d'anomalies */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  if (typeof document === 'undefined') return;
  const U = EL.util, h = U.h;
  const PALETTE = ['#64748b', '#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6'];
  const LABEL_COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4', '#a855f7', '#e11d48', '#0ea5e9', '#65a30d', '#d97706'];

  function openInEditor(id) {
    const ex = EL.examples.get(id);
    if (!ex) return;
    U.store.set('ws.current', ex.build());
    U.store.set('ws.name', ex.title.slice(0, 40));
    EL.track('example_open', id);
    location.hash = '#/programmer';
  }

  const view = {
    tab: 0,
    mount: function (main) {
      const self = this;
      this.main = main;
      main.appendChild(h('div.page-head', [h('div', [h('h1', 'Intelligence & algorithmes'), h('p', 'Découvrez, comparez et améliorez des algorithmes de gestion de l’énergie. Entraînez une IA à reconnaître les appareils.')])]));
      this.tabs = h('div.tabs');
      ['🧠 Algorithmes', '🏟️ Arène de comparaison', '🔎 Reconnaissance d’appareils', '📉 Prévision', '🚨 Anomalies'].forEach(function (t, i) {
        self.tabs.appendChild(h('button', { onclick: function () { self.show(i); } }, t));
      });
      main.appendChild(this.tabs);
      this.body = h('div');
      main.appendChild(this.body);
      this.offKnn = EL.app.on('knn', function () { if (self.tab === 2) self.renderKnnList(); });
      this.show(this.tab);
    },
    unmount: function () { if (this.offKnn) this.offKnn(); if (this.chart) this.chart.destroy(); clearInterval(this.timer); },
    show: function (i) {
      this.tab = i;
      U.$$('button', this.tabs).forEach(function (b, j) { b.classList.toggle('active', i === j); });
      U.clear(this.body);
      clearInterval(this.timer);
      if (this.chart) { this.chart.destroy(); this.chart = null; }
      [this.algorithms, this.arena, this.knnTab, this.forecastTab, this.anomalyTab][i].call(this);
      EL.track('ai_tab', i);
    },

    // ------------------------------------------------------------ algorithmes
    algorithms: function () {
      const self = this;
      this.body.appendChild(h('p', 'Chaque algorithme est un programme à blocs que vous pouvez ouvrir, lire, modifier, simuler puis envoyer au kit. Comparez-les ensuite dans l’arène.'));
      const grid = h('div.grid.g2');
      for (const ex of EL.examples.LIST) {
        if (ex.level < 2) continue;
        grid.appendChild(h('div.card.ex-card', [
          h('div.row.between', [h('h3', { style: { margin: 0 } }, ex.title), h('span.badge.prim', ex.cat)]),
          h('div', ex.summary),
          h('details', [h('summary.small', 'Comment ça marche ?'), h('p.small', ex.explain)]),
          h('div.concepts', ex.concepts.map(function (c) { return h('span.badge', c); })),
          h('div.row', [
            h('button.btn.small.primary', { onclick: function () { openInEditor(ex.id); } }, [EL.icon('blocks'), 'Ouvrir dans l’éditeur']),
            ex.arena ? h('button.btn.small', { onclick: function () { self.preset = { scenario: ex.arena, ids: ['none', ex.id] }; self.show(1); } }, [EL.icon('trophy'), 'Tester dans l’arène']) : null
          ])
        ]));
      }
      this.body.appendChild(grid);
    },

    // ------------------------------------------------------------ arène
    arena: function () {
      const self = this, B = this.body;
      const sc = h('select.inp');
      for (const id of Object.keys(EL.house.SCENARIOS)) sc.appendChild(h('option', { value: id }, EL.house.SCENARIOS[id].name));
      const desc = h('p.small.muted');
      const preset = this.preset || { scenario: 'hiver', ids: ['none', 'delestage', 'heures_creuses'] };
      this.preset = null;
      sc.value = preset.scenario;
      const upd = function () { desc.textContent = EL.house.SCENARIOS[sc.value].desc; };
      sc.addEventListener('change', upd);
      upd();
      const opts = [['none', 'Aucun algorithme (référence : tout reste allumé)'], ['__editor', 'Mon programme (éditeur de blocs)']].concat(EL.examples.LIST.filter(function (e) { return e.level >= 2; }).map(function (e) { return [e.id, e.title]; }));
      const sels = [0, 1, 2, 3].map(function (i) {
        const s = h('select.inp');
        s.appendChild(h('option', { value: '' }, '—'));
        for (const o of opts) s.appendChild(h('option', { value: o[0] }, o[1]));
        s.value = preset.ids[i] || '';
        return s;
      });
      const prog = h('div.progress.hidden', h('i'));
      const results = h('div');
      const runBtn = h('button.btn.primary', [EL.icon('play'), 'Lancer la journée simulée']);
      runBtn.onclick = async function () {
        const list = [];
        for (const s of sels) {
          if (!s.value) continue;
          let bc = null, label;
          if (s.value === 'none') label = 'Aucun algorithme';
          else if (s.value === '__editor') {
            const w = U.store.get('ws.current', null);
            if (!w) { EL.toast('Aucun programme dans l’éditeur', 'bad'); return; }
            label = U.store.get('ws.name', 'Mon programme');
            bc = await self.compileJson(w, label);
            if (!bc) return;
          } else {
            const ex = EL.examples.get(s.value);
            label = ex.title;
            bc = await self.compileJson(ex.build(), ex.title);
            if (!bc) return;
          }
          list.push({ label: label, bc: bc, id: s.value });
        }
        if (!list.length) { EL.toast('Choisissez au moins un algorithme', 'warn'); return; }
        runBtn.disabled = true;
        prog.classList.remove('hidden');
        U.clear(results);
        try {
          const res = await EL.runArena(sc.value, list, function (f) { prog.firstChild.style.width = (f * 100).toFixed(0) + '%'; });
          self.lastArena = EL.lastArena = { scenario: sc.value, res: res };
          self.renderArena(results, sc.value, res);
          EL.track('arena_run', { scenario: sc.value, algos: list.map(function (l) { return l.id; }), cost: res.map(function (r) { return +r.cost.toFixed(3); }), peak: res.map(function (r) { return Math.round(r.peakW); }) });
        } catch (e) {
          EL.toast('Erreur de simulation : ' + e.message, 'bad');
        }
        runBtn.disabled = false;
        prog.classList.add('hidden');
      };
      B.append(
        h('div.card', [
          h('h2', '🏟️ Arène : comparer des algorithmes sur une journée simulée'),
          h('p.small', 'Le jumeau numérique simule 24 heures de vie d’une maison (habitudes des occupants, météo, appareils) en quelques secondes. Chaque algorithme pilote les prises ; on mesure le coût, la pointe de puissance et le confort.'),
          h('div.form-grid', [h('label.field', [h('span', 'Scénario'), sc]), h('div', desc)]),
          h('div.form-grid', { style: { marginTop: '10px' } }, sels.map(function (s, i) { return h('label.field', [h('span', 'Concurrent ' + (i + 1)), s]); })),
          h('div.row', { style: { marginTop: '12px' } }, [runBtn, h('div', { style: { flex: 1 } }, prog)])
        ]),
        results
      );
    },
    compileJson: async function (json, name) {
      await EL.ensureBlockly();
      const ws = new root.Blockly.Workspace();
      try {
        root.Blockly.serialization.workspaces.load(json, ws);
        const r = EL.compiler.compile(ws, name);
        if (!r.ok) { EL.toast('« ' + name + ' » : ' + r.errors[0].msg, 'bad'); return null; }
        return r.bc;
      } finally { ws.dispose(); }
    },
    renderArena: function (box, scId, res) {
      const sc = EL.house.SCENARIOS[scId];
      const cur = EL.app.config ? EL.app.config.tariff.currency : '';
      const rows = [
        ['Énergie consommée', 'energyKWh', 'kWh', 3, 'low'],
        ['Coût', 'cost', cur, 2, 'low'],
        ['Puissance de pointe (moy. 1 min)', 'peakW', 'W', 0, 'low'],
        ['Minutes au-dessus de la puissance souscrite', 'overMin', 'min', 0, 'low'],
        ['Service non rendu (appareil voulu mais coupé)', 'serviceLostMin', 'min', 0, 'low'],
        ['Inconfort thermique (sous la consigne − 1 °C)', 'thermalDegH', '°C·h', 2, 'low'],
        ['Douches trop froides (eau < 40 °C)', 'coldDraws', '', 0, 'low'],
        ['Réfrigérateur trop chaud (> 8 °C)', 'fridgeWarmMin', 'min', 0, 'low'],
        ['Commutations des relais', 'switches', '', 0, 'low'],
        ['CO₂ émis', 'co2kg', 'kg', 2, 'low']
      ];
      const ref = res[0];
      const tbl = h('table.tbl.arena-kpis', [
        h('thead', h('tr', [h('th', 'Indicateur')].concat(res.map(function (r, i) { return h('th.num', { style: { color: PALETTE[i] } }, r.label); })))),
        h('tbody', rows.map(function (row) {
          const vals = res.map(function (r) { return r[row[1]]; });
          const fin = vals.filter(Number.isFinite);
          const best = Math.min.apply(null, fin), worst = Math.max.apply(null, fin);
          return h('tr', [h('td', row[0])].concat(vals.map(function (v, i) {
            let txt = Number.isFinite(v) ? U.fmt(v, row[3], row[2]) : '--';
            if (i > 0 && Number.isFinite(v) && Number.isFinite(ref[row[1]]) && ref[row[1]] > 0 && (row[1] === 'cost' || row[1] === 'energyKWh' || row[1] === 'peakW')) {
              const d = (v - ref[row[1]]) / ref[row[1]] * 100;
              txt += ' (' + (d > 0 ? '+' : '') + d.toFixed(0) + ' %)';
            }
            return h('td.num' + (fin.length > 1 && best !== worst ? (v === best ? '.best' : (v === worst ? '.worst' : '')) : ''), txt);
          })));
        }).concat([h('tr', [h('td', 'Lave-linge terminé avant minuit')].concat(res.map(function (r) { return h('td.num', r.washerDone === null ? '—' : (r.washerDone ? 'oui' : 'non')); })))]))
      ]);
      const cv = h('canvas.chart.tall');
      const legend = h('div.legend', res.map(function (r, i) { return h('span', [h('i', { style: { background: PALETTE[i] } }), r.label]); }));
      const cvT = h('canvas.chart.short');
      box.append(
        h('div.card', { style: { marginTop: '14px' } }, [
          h('h2', 'Résultats — ' + sc.name),
          res.some(function (r) { return r.error; }) ? h('div.note.bad', res.filter(function (r) { return r.error; }).map(function (r) { return r.label + ' : ' + r.error; }).join(' ; ')) : null,
          h('div.tbl-wrap', tbl),
          h('p.small.muted', 'Vert : meilleure valeur ; rouge : moins bonne. Pourcentages : écart par rapport au premier concurrent. Un bon algorithme réduit le coût et la pointe sans dégrader le confort : c’est un compromis !')
        ]),
        h('div.card', { style: { marginTop: '14px' } }, [h('div.card-head', [h('h2', 'Puissance totale sur 24 h'), legend]), cv]),
        h('div.card', { style: { marginTop: '14px' } }, [h('h2', 'Température de la pièce'), cvT]),
        h('div.row', { style: { marginTop: '10px' } }, [
          h('button.btn', { onclick: function () {
            const head = ['indicateur'].concat(res.map(function (r) { return r.label; }));
            const lines = [head].concat(rows.map(function (row) { return [row[0] + (row[2] ? ' (' + row[2] + ')' : '')].concat(res.map(function (r) { return r[row[1]]; })); }));
            U.download('arene-' + scId + '.csv', U.toCsv(lines), 'text/csv');
          } }, [EL.icon('download'), 'Exporter les indicateurs (CSV)'])
        ])
      );
      requestAnimationFrame(function () {
        const xs = res[0].series.p.map(function (_, i) { return i; });
        const fmt = function (m) { return U.pad2(Math.floor(m / 60) % 24) + ':' + U.pad2(Math.floor(m % 60)); };
        const ch = new EL.charts.LineChart(cv, { yMin: 0, yUnit: 'W', xFmt: fmt, series: res.map(function (r, i) { return { name: r.label, color: PALETTE[i], width: i ? 2 : 1.5 }; }), refLines: [{ y: sc.contractW, label: 'puissance souscrite', color: '#d64545' }] });
        ch.setData(xs, res.map(function (r) { return r.series.p; }));
        const ch2 = new EL.charts.LineChart(cvT, { yUnit: '°C', xFmt: fmt, series: res.map(function (r, i) { return { name: r.label, color: PALETTE[i] }; }) });
        ch2.setData(xs, res.map(function (r) { return r.series.troom; }));
      });
    },

    // ------------------------------------------------------------ k-NN
    knnTab: function () {
      const self = this, B = this.body, app = EL.app;
      const outlet = h('select.inp');
      for (let k = 1; k <= 4; k++) outlet.appendChild(h('option', { value: k }, 'Prise ' + k + (app.config ? ' · ' + app.config.outlets[k - 1].name : '')));
      const label = h('input.inp', { placeholder: 'ex. Bouilloire, Lampe LED, Chargeur…', list: 'knn-names', maxlength: 24 });
      const dl = h('datalist#knn-names', ['Bouilloire', 'Lampe LED', 'Lampe halogène', 'Chargeur de téléphone', 'Ventilateur', 'Radiateur', 'Ordinateur portable', 'Téléviseur', 'Fer à repasser', 'Réfrigérateur'].map(function (n) { return h('option', { value: n }); }));
      const live = h('div.small');
      const train = h('button.btn.primary', [EL.icon('plus'), 'Apprendre cet exemple']);
      train.onclick = async function () {
        const name = label.value.trim();
        if (!name) { label.focus(); return; }
        const r = await app.kit.knnOp({ op: 'train', outlet: Number(outlet.value), label: name }, app.pin);
        EL.track('knn_train', { outlet: Number(outlet.value), label: name, ok: !!r.ok });
        EL.toast(r.msg, r.ok ? 'ok' : 'bad');
        if (r.ok) await EL.refreshKnn();
      };
      this.knnList = h('div');
      this.scatterCv = h('canvas');
      this.knnInfo = h('div.small');
      B.append(
        h('div.grid.g2', [
          h('div.card', [
            h('h2', '1. Entraîner l’IA'),
            h('p.small', 'Apprentissage supervisé : branchez un appareil en fonctionnement, donnez-lui un nom, et cliquez sur « Apprendre ». Répétez 2 ou 3 fois par appareil, puis avec d’autres appareils.'),
            h('div.form-grid', [h('label.field', [h('span', 'Prise'), outlet]), h('label.field', [h('span', 'Nom de l’appareil'), label, dl])]),
            h('div.row', { style: { marginTop: '10px' } }, [train, live]),
            h('h3', { style: { marginTop: '16px' } }, 'Appareils appris'),
            this.knnList
          ]),
          h('div.card', [
            h('h2', '2. Comment l’IA décide'),
            h('p.small', 'Chaque mesure devient un point défini par deux caractéristiques : la puissance P (échelle logarithmique) et le facteur de puissance. L’appareil inconnu (étoile) prend le nom le plus fréquent parmi ses k plus proches voisins. S’il est trop loin de tous les exemples, il est déclaré « inconnu ».'),
            h('div.scatter-wrap', this.scatterCv), this.knnInfo
          ])
        ])
      );
      const upd = function () {
        const s = app.state;
        if (!s) return;
        const o = s.outlets[Number(outlet.value) - 1];
        live.textContent = 'Mesure actuelle : ' + U.fmtP(o.p) + ', FP ' + U.fmt(o.pf, 2);
        self.drawScatter();
      };
      this.renderKnnList();
      upd();
      this.timer = setInterval(upd, 1500);
    },
    renderKnnList: function () {
      const app = EL.app, box = this.knnList;
      if (!box) return;
      U.clear(box);
      const k = app.knn;
      if (!k || !k.labels.length) { box.appendChild(h('p.muted.small', 'Aucun appareil appris pour le moment.')); return; }
      box.appendChild(h('table.tbl', h('tbody', k.labels.map(function (l, i) {
        return h('tr', [h('td', [h('span', { style: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: LABEL_COLORS[(l.id - 1) % LABEL_COLORS.length], marginRight: '6px' } }), l.name]), h('td.num', l.n + ' exemple(s)'),
          h('td.right', h('button.btn.small.ghost', { title: 'Oublier', onclick: async function () { const r = await app.kit.knnOp({ op: 'delete', id: l.id }, app.pin); if (!r.ok) EL.toast(r.msg, 'bad'); await EL.refreshKnn(); } }, EL.icon('trash')))]);
      }))));
      box.appendChild(h('p.small.muted', 'k = ' + k.k + ' voisins, distance maximale = ' + k.maxDist + ' (réglables : paramètre « k des k plus proches voisins »).'));
      this.drawScatter();
    },
    drawScatter: function () {
      const app = EL.app, cv = this.scatterCv;
      if (!cv || !cv.isConnected || !app.knn) return;
      const k = app.knn;
      const pts = k.samples.map(function (s) { return { x: s[1], y: s[2], color: LABEL_COLORS[(s[0] - 1) % LABEL_COLORS.length], r: 5 }; });
      const links = [];
      const info = [];
      if (app.state) {
        const knn = new EL.ai.Knn();
        knn.load({ labels: k.labels, samples: k.samples });
        app.state.outlets.forEach(function (o, i) {
          if (!o.online || !(o.p >= 1)) return;
          const r = knn.classifyFull(o.p, o.pf, k.k, k.maxDist);
          pts.push({ x: o.p, y: o.pf, color: EL.OUTLET_COLORS[i], star: true, label: 'prise ' + (i + 1) });
          for (const n of r.neighbours) {
            const s = knn.samples[n.i];
            links.push({ x1: o.p, y1: o.pf, x2: s.p, y2: s.pf, color: EL.OUTLET_COLORS[i] });
          }
          info.push('Prise ' + (i + 1) + ' : ' + (r.id > 0 ? '« ' + knn.labelName(r.id) + ' »' : (r.id === -1 ? 'inconnu' : 'aucun')) + (Number.isFinite(r.dist) ? ' (distance au plus proche : ' + r.dist.toFixed(2) + ')' : ''));
        });
      }
      EL.charts.scatter(cv, pts, { xMin: 0.5, xMax: 5000, yMin: 0, yMax: 1, xLog: true, xLabel: 'Puissance active P (échelle logarithmique)', yLabel: 'Facteur de puissance' }, links);
      if (this.knnInfo) { U.clear(this.knnInfo); for (const l of info) this.knnInfo.appendChild(h('div', '⭐ ' + l)); }
    },

    // ------------------------------------------------------------ prévision
    forecastTab: function () {
      const self = this, B = this.body, app = EL.app;
      const cv = h('canvas.chart.tall');
      const kp = h('div.grid.g3');
      B.append(
        h('div.card', [
          h('h2', '📉 Prévoir la consommation (méthode de Holt)'),
          h('p.small', 'Le kit calcule toutes les 10 s un niveau L et une tendance T (lissage exponentiel double, α = 0,3 ; β = 0,1). La prévision dans h minutes vaut L + T × 6h. La tendance par régression linéaire (moindres carrés) est aussi disponible en bloc.'),
          kp, cv,
          h('p.small.muted', 'Points violets : prévisions à 10 et 30 minutes. Une prévision n’est jamais certaine : elle prolonge la tendance récente.')
        ])
      );
      this.chart = new EL.charts.LineChart(cv, { yMin: 0, yUnit: 'W', xFmt: function (t) { return U.fmtClock(t, app.state ? app.state.tz : 0); }, series: [{ name: 'P totale', color: '#3b82f6', fill: true }, { name: 'prévision', color: '#8b5cf6', dash: [5, 4] }] });
      const draw = async function () {
        const list = await app.kit.getHistory(600);
        const s = app.state;
        if (!s || !self.chart) return;
        U.clear(kp);
        kp.append(
          h('div.kpi', [h('div.lbl', 'Maintenant'), h('div.val', U.fmtP(s.total.p))]),
          h('div.kpi', [h('div.lbl', 'Prévision à 10 min'), h('div.val', U.fmtP(s.forecast.f10))]),
          h('div.kpi', [h('div.lbl', 'Tendance (2 min)'), h('div.val', U.fmt(s.forecast.trend, 1, 'W/min'))])
        );
        const xs = list.map(function (x) { return x.t; });
        const tot = list.map(function (x) { return x.p.reduce(function (a, b) { return a + (Number.isFinite(b) ? b : 0); }, 0); });
        const fc = tot.map(function () { return NaN; });
        if (xs.length && Number.isFinite(s.forecast.f10)) {
          const t0 = xs[xs.length - 1];
          xs.push(t0 + 600); tot.push(NaN); fc.push(s.forecast.f10);
          xs.push(t0 + 1800); tot.push(NaN); fc.push(s.forecast.f30);
          fc[fc.length - 3] = tot[tot.length - 3];
        }
        self.chart.setData(xs, [tot, fc]);
      };
      draw();
      this.timer = setInterval(draw, 4000);
    },

    // ------------------------------------------------------------ anomalies
    anomalyTab: function () {
      const B = this.body, app = EL.app, self = this;
      const tbl = h('div');
      B.append(h('div.card', [
        h('h2', '🚨 Détection d’anomalies (score z)'),
        h('p.small', 'Pour chaque prise, le kit apprend en continu la moyenne μ et l’écart-type σ de la puissance (moyennes exponentielles). Le score z = |P − μ| / σ mesure l’écart à l’habitude. Au-delà du seuil (paramètre « seuil d’anomalie », 4 par défaut) pendant 3 s, une anomalie est signalée. Après 60 s, le nouveau comportement devient la référence.'),
        tbl,
        h('div.note.tip', { style: { marginTop: '10px' } }, 'Expérience : laissez une lampe allumée une minute, puis branchez la bouilloire. Observez le score z, puis réglez le seuil avec le bloc « régler le seuil d’anomalie ». Combien de fausses alertes obtenez-vous avec un seuil de 2 ? de 8 ?')
      ]));
      const upd = function () {
        const s = app.state;
        if (!s) return;
        U.clear(tbl);
        tbl.appendChild(h('table.tbl', [h('thead', h('tr', ['Prise', 'P (W)', 'Score z', 'État'].map(function (t, i) { return h('th' + (i ? '.num' : ''), t); }))),
          h('tbody', s.outlets.map(function (o, k) {
            return h('tr', [h('td', (k + 1) + (app.config ? ' · ' + app.config.outlets[k].name : '')), h('td.num', U.fmt(o.p, 1)), h('td.num', U.fmt(o.z, 2)), h('td.num', o.anomaly ? h('span.badge.bad', 'ANOMALIE') : h('span.badge.ok', 'normal'))]);
          }))]));
      };
      upd();
      this.timer = setInterval(upd, 1000);
      void self;
    }
  };
  EL.views.ia = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);

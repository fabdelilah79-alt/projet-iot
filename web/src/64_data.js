/* EnergyLab — données : historique temps réel, journée, 7 jours, fichiers du kit, expériences */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  if (typeof document === 'undefined') return;
  const U = EL.util, h = U.h;
  const EXP = 'experiments';

  const view = {
    tab: 0,
    mount: function (main) {
      const self = this;
      main.appendChild(h('div.page-head', [h('div', [h('h1', 'Données'), h('p', 'Historiques, journaux du kit et expériences « avant / après » pour analyser la consommation.')])]));
      this.tabs = h('div.tabs');
      ['⏱️ 10 dernières minutes', '📅 Aujourd’hui', '🗓️ 7 jours', '🧪 Mes expériences', '💾 Fichiers du kit'].forEach(function (t, i) {
        self.tabs.appendChild(h('button', { onclick: function () { self.show(i); } }, t));
      });
      this.body = h('div');
      main.append(this.tabs, this.body);
      this.show(this.tab);
    },
    unmount: function () { clearInterval(this.timer); if (this.chart) this.chart.destroy(); },
    show: function (i) {
      this.tab = i;
      U.$$('button', this.tabs).forEach(function (b, j) { b.classList.toggle('active', i === j); });
      clearInterval(this.timer);
      if (this.chart) { this.chart.destroy(); this.chart = null; }
      U.clear(this.body);
      [this.live, this.today, this.week, this.experiments, this.files][i].call(this);
    },
    names: function () { const c = EL.app.config; return [0, 1, 2, 3].map(function (k) { return c ? c.outlets[k].name : 'Prise ' + (k + 1); }); },

    live: function () {
      const self = this, app = EL.app;
      const cv = h('canvas.chart.tall'), cvE = h('canvas.chart');
      const names = this.names();
      this.body.append(
        h('div.card', [h('div.card-head', [h('h2', 'Puissance par prise'), h('button.btn.small', { onclick: function () { self.exportLive(); } }, [EL.icon('download'), 'CSV'])]), cv]),
        h('div.card', { style: { marginTop: '14px' } }, [h('h2', 'Ambiance : température (°C) et luminosité (%)'), cvE])
      );
      this.chart = new EL.charts.LineChart(cv, { yMin: 0, yUnit: 'W', xFmt: function (t) { return U.fmtClock(t, app.state ? app.state.tz : 0); }, series: names.map(function (n, k) { return { name: n, color: EL.OUTLET_COLORS[k] }; }) });
      const envChart = new EL.charts.LineChart(cvE, { xFmt: function (t) { return U.fmtClock(t, app.state ? app.state.tz : 0); }, series: [{ name: 'température', color: '#ef4444' }, { name: 'luminosité', color: '#f59e0b' }] });
      const draw = async function () {
        const list = await app.kit.getHistory(600);
        self.liveData = list;
        const xs = list.map(function (s) { return s.t; });
        if (self.chart) self.chart.setData(xs, [0, 1, 2, 3].map(function (k) { return list.map(function (s) { return s.p[k]; }); }));
        envChart.setData(xs, [list.map(function (s) { return s.T; }), list.map(function (s) { return s.L; })]);
      };
      draw();
      this.timer = setInterval(draw, 5000);
    },
    exportLive: function () {
      const names = this.names(), tz = EL.app.state ? EL.app.state.tz : 0;
      const rows = [['horodatage', 'heure'].concat(names.map(function (n) { return 'P ' + n + ' (W)'; })).concat(['T (°C)', 'H (%)', 'L (%)', 'presence', 'relais'])];
      for (const s of this.liveData || []) rows.push([s.t, U.fmtDateTime(s.t, tz)].concat(s.p).concat([s.T, s.H, s.L, s.pr, s.r]));
      U.download('historique-10min.csv', U.toCsv(rows), 'text/csv');
    },

    today: async function () {
      const B = this.body, kit = EL.app.kit;
      const files = await kit.listFiles('log');
      if (!files.length) {
        B.appendChild(h('div.note', kit.kind === 'sim' ? 'Le journal minute par minute est enregistré par le kit réel (mémoire du kit). En démonstration, utilisez l’onglet « 10 dernières minutes ».' : 'Pas encore de journal : le kit enregistre une ligne par minute dès que son horloge est réglée.'));
        return;
      }
      files.sort(function (a, b) { return a.n < b.n ? 1 : -1; });
      const sel = h('select.inp', files.map(function (f) { return h('option', { value: f.n }, f.n.replace(/(\d{4})(\d{2})(\d{2})\.csv/, '$3/$2/$1') + ' (' + Math.round(f.s / 1024) + ' Ko)'); }));
      const cv = h('canvas.chart.tall'), bars = h('canvas.chart'), sum = h('div');
      const dl = h('a.btn.small', { download: '' }, [EL.icon('download'), 'Télécharger']);
      B.append(h('div.card', [h('div.card-head', [h('div.row', [h('h2', 'Journal minute par minute'), sel]), dl]), cv, h('h3', { style: { marginTop: '12px' } }, 'Énergie par heure (Wh)'), bars, sum]));
      const self = this;
      const load = async function () {
        dl.href = kit.fileUrl ? kit.fileUrl('log', sel.value) : '#';
        dl.setAttribute('download', 'energylab-' + sel.value);
        const text = await kit.fetchFile('log', sel.value);
        const rows = U.parseCsv(text).slice(1).filter(function (r) { return r.length >= 9; });
        const xs = rows.map(function (r) { const p = r[0].split(':'); return Number(p[0]) * 60 + Number(p[1]); });
        const ys = [1, 2, 3, 4].map(function (c) { return rows.map(function (r) { return Number(r[c]); }); });
        if (self.chart) self.chart.destroy();
        self.chart = new EL.charts.LineChart(cv, { stacked: true, fill: true, yMin: 0, yUnit: 'W', xFmt: function (m) { return U.pad2(Math.floor(m / 60)) + ':' + U.pad2(Math.round(m % 60)); }, series: self.names().map(function (n, k) { return { name: n, color: EL.OUTLET_COLORS[k] }; }) });
        self.chart.setData(xs, ys);
        const hours = [];
        for (let i = 0; i < 24; i++) hours.push([0, 0, 0, 0]);
        for (const r of rows) { const hh = Number(r[0].split(':')[0]); for (let k = 0; k < 4; k++) hours[hh][k] += Number(r[5 + k]) || 0; }
        EL.charts.barChart(bars, hours.map(function (_, i) { return String(i); }), [0, 1, 2, 3].map(function (k) { return { color: EL.OUTLET_COLORS[k], values: hours.map(function (x) { return x[k]; }) }; }));
        const tot = [0, 1, 2, 3].map(function (k) { return hours.reduce(function (a, x) { return a + x[k]; }, 0); });
        U.clear(sum);
        sum.appendChild(h('div.row.small', self.names().map(function (n, k) { return h('span.badge', n + ' : ' + U.fmtE(tot[k])); }).concat([h('span.badge.prim', 'Total : ' + U.fmtE(tot.reduce(function (a, b) { return a + b; }, 0)))])));
      };
      sel.addEventListener('change', load);
      load();
    },

    week: async function () {
      const days = await EL.app.kit.getDays();
      const cur = EL.app.config ? EL.app.config.tariff.currency : '';
      const names = this.names();
      if (!days.length) { this.body.appendChild(h('div.empty', 'Pas encore de données journalières.')); return; }
      const list = days.slice().reverse();
      const cv = h('canvas.chart.tall');
      const labels = list.map(function (d) { return d.d >= 0 ? U.dayKeyToDate(d.d).slice(0, 5) : '?'; });
      this.body.append(
        h('div.card', [h('h2', 'Énergie par jour et par prise (Wh)'), cv]),
        h('div.card', { style: { marginTop: '14px' } }, [h('div.tbl-wrap', h('table.tbl', [
          h('thead', h('tr', [h('th', 'Jour')].concat(names.map(function (n) { return h('th.num', n); })).concat([h('th.num', 'Total'), h('th.num', 'Coût'), h('th.num', 'Pointe')]))),
          h('tbody', list.map(function (d, i) {
            const tot = d.e.reduce(function (a, b) { return a + b; }, 0), cost = d.c.reduce(function (a, b) { return a + b; }, 0);
            return h('tr', [h('td', labels[i] + (i === list.length - 1 ? ' (aujourd’hui)' : ''))].concat(d.e.map(function (v) { return h('td.num', U.fmtE(v)); })).concat([h('td.num', U.fmtE(tot)), h('td.num', U.fmt(cost, 2, cur)), h('td.num', U.fmtP(d.pk))]));
          }))
        ]))])
      );
      requestAnimationFrame(function () {
        EL.charts.barChart(cv, labels, [0, 1, 2, 3].map(function (k) { return { color: EL.OUTLET_COLORS[k], values: list.map(function (d) { return d.e[k]; }) }; }));
      });
    },

    // ------------------------------------------------------------ expériences avant / après
    experiments: function () {
      const self = this, B = this.body, app = EL.app;
      const list = U.store.get(EXP, []);
      const name = h('input.inp', { placeholder: 'ex. sans algorithme / avec délestage', maxlength: 50 });
      const run = this.runningExp;
      const status = h('div');
      B.append(h('div.card', [
        h('h2', '🧪 Mesurer une expérience'),
        h('p.small', 'Démarche scientifique : enregistrez une période de référence (ex. 10 minutes sans programme), puis la même durée avec votre algorithme, et comparez les indicateurs.'),
        h('div.row', [name, run ? h('button.btn.danger', { onclick: function () { self.stopExp(); } }, [EL.icon('stop'), 'Arrêter l’enregistrement']) : h('button.btn.primary', { onclick: function () { self.startExp(name.value.trim()); } }, [EL.icon('play'), 'Démarrer l’enregistrement'])]),
        status
      ]));
      if (run) {
        const upd = function () {
          const k = self.expKpis(run, app.state);
          U.clear(status);
          status.appendChild(h('div.note', { style: { marginTop: '10px' } }, '⏺ « ' + run.name + ' » en cours depuis ' + U.fmtDuration(k.duration) + ' : ' + U.fmtE(k.energyWh) + ', pointe ' + U.fmtP(k.peakW) + ', ' + k.switches + ' commutations.'));
        };
        upd();
        this.timer = setInterval(upd, 1000);
      }
      if (!list.length) { B.appendChild(h('div.empty', 'Aucune expérience enregistrée.')); return; }
      const cur = app.config ? app.config.tariff.currency : '';
      const cv = h('canvas.chart');
      B.append(h('div.card', { style: { marginTop: '14px' } }, [
        h('div.card-head', [h('h2', 'Comparaison'), h('div.row', [
          h('button.btn.small', { onclick: function () {
            const rows = [['expérience', 'debut', 'duree_s', 'energie_Wh', 'cout', 'puissance_moy_W', 'pointe_W', 'commutations', 'temperature_moy']].concat(list.map(function (e) { return [e.name, e.start, e.duration, e.energyWh, e.cost, e.avgW, e.peakW, e.switches, e.tempAvg]; }));
            U.download('experiences.csv', U.toCsv(rows), 'text/csv');
          } }, [EL.icon('download'), 'CSV']),
          h('button.btn.small', { onclick: async function () { if (await EL.confirm('Effacer', 'Supprimer toutes les expériences ?', 'Effacer')) { U.store.set(EXP, []); self.show(3); } } }, [EL.icon('trash'), 'Effacer'])
        ])]),
        h('div.tbl-wrap', h('table.tbl', [
          h('thead', h('tr', ['Expérience', 'Durée', 'Énergie', 'Coût', 'P moyenne', 'Pointe', 'Commutations', 'T moy.'].map(function (t, i) { return h('th' + (i ? '.num' : ''), t); }))),
          h('tbody', list.map(function (e) { return h('tr', [h('td', e.name), h('td.num', U.fmtDuration(e.duration)), h('td.num', U.fmtE(e.energyWh)), h('td.num', U.fmt(e.cost, 3, cur)), h('td.num', U.fmtP(e.avgW)), h('td.num', U.fmtP(e.peakW)), h('td.num', String(e.switches)), h('td.num', U.fmt(e.tempAvg, 1, '°C'))]); }))
        ])),
        h('p.small.muted', 'Pour comparer équitablement, utilisez des durées identiques et les mêmes appareils. La puissance moyenne permet de comparer des durées différentes.'),
        cv
      ]));
      requestAnimationFrame(function () {
        EL.charts.barChart(cv, list.map(function (e) { return e.name.slice(0, 16); }), [{ color: '#3b82f6', values: list.map(function (e) { return e.avgW; }) }, { color: '#ef4444', values: list.map(function (e) { return e.peakW; }) }], { showValues: true });
      });
    },
    startExp: function (name) {
      const s = EL.app.state;
      if (!s) return;
      this.runningExp = { name: name || 'Expérience ' + (U.store.get(EXP, []).length + 1), t0: Date.now(), e0: s.total.eToday, c0: s.total.costToday, sw0: s.outlets.reduce(function (a, o) { return a + o.switches; }, 0), peak: 0, tSum: 0, tN: 0 };
      const self = this;
      this.expOff = EL.app.on('state', function (st) {
        const r = self.runningExp;
        if (!r) return;
        if (st.total.p > r.peak) r.peak = st.total.p;
        if (Number.isFinite(st.env.temp)) { r.tSum += st.env.temp; r.tN++; }
      });
      EL.track('experiment_start', this.runningExp.name);
      this.show(3);
    },
    expKpis: function (r, s) {
      const duration = (Date.now() - r.t0) / 1000;
      let e = s.total.eToday - r.e0;
      if (e < 0) e = s.total.eToday; // passage de minuit
      return {
        duration: duration, energyWh: e, cost: Math.max(0, s.total.costToday - r.c0), avgW: duration > 0 ? e * 3600 / duration : 0,
        peakW: r.peak, switches: s.outlets.reduce(function (a, o) { return a + o.switches; }, 0) - r.sw0, tempAvg: r.tN ? r.tSum / r.tN : NaN
      };
    },
    stopExp: function () {
      const r = this.runningExp, s = EL.app.state;
      if (!r || !s) return;
      const k = this.expKpis(r, s);
      const list = U.store.get(EXP, []);
      list.push(Object.assign({ name: r.name, start: new Date(r.t0).toISOString() }, k));
      U.store.set(EXP, list);
      if (this.expOff) this.expOff();
      this.runningExp = null;
      EL.track('experiment_stop', { name: r.name, energyWh: +k.energyWh.toFixed(2), peakW: Math.round(k.peakW), duration: Math.round(k.duration) });
      this.show(3);
    },

    files: async function () {
      const B = this.body, kit = EL.app.kit;
      for (const dir of ['log', 'research']) {
        const list = await kit.listFiles(dir);
        B.appendChild(h('div.card', { style: { marginBottom: '14px' } }, [
          h('h2', dir === 'log' ? 'Journaux de mesures (une ligne par minute)' : 'Données de recherche (traces, tests, questionnaires)'),
          list.length ? h('table.tbl', h('tbody', list.map(function (f) {
            return h('tr', [h('td', f.n), h('td.num', Math.round(f.s / 1024 * 10) / 10 + ' Ko'), h('td.right', kit.fileUrl ? h('a.btn.small', { href: kit.fileUrl(dir, f.n), download: f.n }, [EL.icon('download'), 'Télécharger']) : h('button.btn.small', { onclick: async function () { U.download(f.n, await kit.fetchFile(dir, f.n), 'text/csv'); } }, [EL.icon('download'), 'Télécharger']))]);
          }))) : h('p.muted.small', 'Aucun fichier.')
        ]));
      }
      if (EL.app.info) B.appendChild(h('p.small.muted', 'Mémoire du kit utilisée : ' + Math.round(EL.app.info.fsUsed / 1024) + ' Ko / ' + Math.round(EL.app.info.fsTotal / 1024) + ' Ko. Les journaux de plus de 10 jours sont supprimés automatiquement.'));
    }
  };
  EL.views.donnees = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);

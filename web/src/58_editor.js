/* EnergyLab — éditeur de programmes par blocs (type Scratch), simulation et envoi au kit */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  if (typeof document === 'undefined') return;
  const U = EL.util, h = U.h;

  const LS_WS = 'ws.current';
  const LS_PROGS = 'programs';
  const STATUS = ['aucun programme', 'en cours', 'terminé', 'erreur', 'arrêté'];
  const STATUS_CLS = ['', 'ok', 'info', 'bad', 'warn'];

  const view = {
    ws: null, twin: null, target: 'kit', last: null,

    mount: function (main) {
      const self = this, app = EL.app;
      this.main = main;
      this.R = {};
      const R = this.R;
      R.name = h('input.inp.name', { value: U.store.get('ws.name', 'Mon programme'), maxlength: 40, 'aria-label': 'Nom du programme' });
      R.name.addEventListener('input', function () { U.store.set('ws.name', R.name.value); });
      const demo = app.mode === 'demo';
      R.btnSim = h('button.btn', { title: 'Tester le programme sur la maison virtuelle (jumeau numérique)', onclick: function () { self.run('sim'); } }, [EL.icon('flask'), h('span.hide-xs', 'Simuler')]);
      R.btnKit = h('button.btn.primary', { onclick: function () { self.run('kit'); } }, [EL.icon('upload'), demo ? 'Exécuter (kit virtuel)' : 'Envoyer au kit']);
      R.btnStop = h('button.btn', { title: 'Arrêter le programme du kit', onclick: function () { self.stop(); } }, [EL.icon('stop'), h('span.hide-xs', 'Arrêter')]);
      if (demo) R.btnSim.classList.add('hidden');
      main.appendChild(h('div.editor-bar', [
        R.name, R.btnSim, R.btnKit, R.btnStop,
        h('button.btn', { title: 'Programmes d’exemple', onclick: function () { self.examples(); } }, [EL.icon('book'), h('span.hide-xs', 'Exemples')]),
        h('button.btn', { title: 'Ouvrir un programme', onclick: function () { self.openMenu(); } }, [EL.icon('folder'), h('span.hide-xs', 'Ouvrir')]),
        h('button.btn', { title: 'Enregistrer le programme', onclick: function () { self.saveMenu(); } }, [EL.icon('save'), h('span.hide-xs', 'Enregistrer')]),
        h('button.btn', { title: 'Voir le code produit par les blocs', onclick: function () { self.showCode(); } }, [EL.icon('code'), h('span.hide-xs', 'Code')]),
        h('button.btn.ghost', { title: 'Tout effacer', onclick: function () { self.clearWs(); } }, EL.icon('trash'))
      ]));
      R.area = h('div#blockly-area', [h('div#blockly-div'), h('div.loading', [h('div.spinner'), h('p', 'Chargement des blocs…')])]);
      // panneau latéral
      R.status = h('div');
      R.console = h('div.console');
      R.vars = h('div');
      R.simPanel = h('div');
      R.buttons = h('div.row', ['A', 'B', 'C', 'D'].map(function (l, i) {
        return h('button.btn', { onclick: function () { self.pressButton(i + 1); } }, '🔘 ' + l);
      }));
      R.warnings = h('div');
      // redémarrage automatique du programme du kit à la mise sous tension
      R.auto = h('input', { type: 'checkbox', checked: !!(app.config && app.config.peda.progAutostart) });
      R.auto.addEventListener('change', async function () {
        const r = await app.kit.programCtl('autostart', R.auto.checked, app.pin);
        if (!r.ok) { EL.toast(r.msg || 'Refusé', 'bad'); R.auto.checked = !R.auto.checked; return; }
        EL.track('program_autostart', R.auto.checked);
        EL.toast(R.auto.checked ? 'Le programme du kit redémarrera à la mise sous tension' : 'Démarrage automatique désactivé', 'ok');
        EL.refreshConfig();
      });
      main.appendChild(h('div.editor-layout', [
        R.area,
        h('div.side-panel', [
          h('div.card', [h('div.card-head', [h('h2', '▶ Exécution'), R.status]), R.warnings, h('div.small.muted', { style: { margin: '6px 0' } }, 'Boutons virtuels (blocs « quand on appuie sur le bouton ») :'), R.buttons,
            h('label.check.small', { style: { marginTop: '10px' } }, [R.auto, 'Redémarrer le programme du kit à sa mise sous tension'])]),
          h('div.card', [h('h2', '🖥️ Console'), R.console]),
          h('div.card', [h('h2', '🔢 Variables'), R.vars]),
          h('div.card', [h('h2', '🧪 Maison virtuelle'), R.simPanel])
        ])
      ]));
      this.consoleLines = [];
      this.offLog = app.on('log', function (e) { if (self.target === 'kit') self.addConsole(e); });
      this.offState = app.on('state', function (s) { if (self.target === 'kit') self.onTargetState(s); });
      this.offKnn = app.on('knn', function () { /* les listes déroulantes se mettent à jour à l'ouverture */ });
      this.target = U.store.get('ws.target', 'kit');
      if (demo) this.target = 'kit';
      this.renderSimPanel();
      EL.ensureBlockly().then(function () { self.inject(); }).catch(function (e) {
        U.clear(R.area);
        R.area.appendChild(h('div.note.bad', 'Impossible de charger les blocs : ' + e.message));
      });
      this.onResize = function () { if (self.ws) root.Blockly.svgResize(self.ws); };
      window.addEventListener('resize', this.onResize);
    },

    unmount: function () {
      if (this.offLog) this.offLog();
      if (this.offState) this.offState();
      if (this.offKnn) this.offKnn();
      window.removeEventListener('resize', this.onResize);
      if (this.ws) { this.saveLocal(); this.ws.dispose(); this.ws = null; }
      if (this.twinOffs) this.twinOffs.forEach(function (f) { f(); });
      this.twinOffs = null;
    },

    inject: function () {
      const Blockly = root.Blockly, self = this, R = this.R;
      const div = R.area.querySelector('#blockly-div');
      const loading = R.area.querySelector('.loading');
      if (loading) loading.remove();
      this.ws = Blockly.inject(div, {
        toolbox: EL.blocks.toolbox(),
        renderer: 'zelos',
        theme: EL.blocks.theme(Blockly),
        media: 'media/',
        sounds: false,
        trashcan: true,
        zoom: { controls: true, wheel: true, startScale: 0.72, maxScale: 2, minScale: 0.3, scaleSpeed: 1.15 },
        grid: { spacing: 24, length: 3, colour: '#dde2e8', snap: true },
        move: { scrollbars: true, drag: true, wheel: false }
      });
      const saved = U.store.get(LS_WS, null);
      if (saved) {
        try { Blockly.serialization.workspaces.load(saved, this.ws); } catch (e) { console.warn(e); }
      } else {
        this.loadExample('clignotant', true);
      }
      const save = U.debounce(function () { self.saveLocal(); self.compile(true); }, 800);
      this.ws.addChangeListener(function (ev) { if (!ev.isUiEvent) save(); });
      setTimeout(function () { Blockly.svgResize(self.ws); }, 50);
      this.compile(true);
      if (EL.app.state && this.target === 'kit') this.onTargetState(EL.app.state);
    },

    saveLocal: function () {
      if (!this.ws) return;
      U.store.set(LS_WS, root.Blockly.serialization.workspaces.save(this.ws));
    },

    compile: function (quiet) {
      const r = EL.compiler.compile(this.ws, this.R.name.value.trim() || 'Mon programme');
      if (quiet) { this.lastCompile = r; return r; }
      // avertissements sur les blocs
      const all = this.ws.getAllBlocks(false);
      for (const b of all) if (b.setWarningText) b.setWarningText(null);
      for (const w of r.warnings.concat(r.errors)) {
        if (!w.id) continue;
        const b = this.ws.getBlockById(w.id);
        if (b && b.setWarningText) b.setWarningText(w.msg);
      }
      U.clear(this.R.warnings);
      for (const e of r.errors) this.R.warnings.appendChild(h('div.note.bad', { style: { marginBottom: '6px' } }, e.msg));
      if (r.warnings.length) this.R.warnings.appendChild(h('div.note.warn', { style: { marginBottom: '6px' } }, r.warnings.length + ' avertissement(s) : voir les blocs marqués d’un triangle ⚠.'));
      this.lastCompile = r;
      EL.track('program_compile', { ok: r.ok, size: r.size, errors: r.errors.length, warnings: r.warnings.length, blocks: all.length });
      return r;
    },

    ensureTwin: function () {
      if (this.twin) return this.twin;
      const app = EL.app, self = this;
      const twin = new EL.SimKit({ name: 'Jumeau numérique', seed: 99 });
      if (app.config) {
        const c = EL.config.clone(app.config);
        // le jumeau reprend les noms, priorités et réglages du kit réel (sans secrets)
        delete c.net; delete c.mqtt; delete c.peda;
        EL.config.merge(twin.cfg, c);
        twin.core.applyOutletConfig();
      }
      twin.cfg.peda.perms = 63;
      if (app.knn) twin.core.knn.load({ labels: app.knn.labels, samples: app.knn.samples });
      this.twin = twin;
      return twin;
    },
    attachTwin: function () {
      const self = this, twin = this.twin;
      if (this.twinOffs) return;
      this.twinOffs = [
        twin.on('state', function (s) { if (self.target === 'sim') self.onTargetState(s); }),
        twin.on('log', function (e) { if (self.target === 'sim') self.addConsole(e); })
      ];
    },

    run: async function (target) {
      if (!this.ws) return;
      const r = this.compile();
      if (!r.ok) { EL.toast('Le programme contient des erreurs', 'bad'); return; }
      this.target = target;
      U.store.set('ws.target', target);
      this.R.btnStop.title = target === 'sim' ? 'Arrêter la simulation' : 'Arrêter le programme du kit';
      this.consoleLines = [];
      U.clear(this.R.console);
      const wsJson = root.Blockly.serialization.workspaces.save(this.ws);
      let res;
      if (target === 'sim') {
        const twin = this.ensureTwin();
        this.attachTwin();
        await twin.connect();
        res = await twin.sendProgram(r.bc, wsJson, { start: true, save: true });
        EL.track('program_sim', { hash: r.bc.hash, size: r.size });
      } else {
        if (EL.app.kit.kind === 'real' && !EL.app.kit.connected) { EL.toast('Kit non connecté', 'bad'); return; }
        res = await EL.app.kit.sendProgram(r.bc, wsJson, { start: true, save: true, pin: EL.app.pin });
        EL.track('program_deploy', { hash: r.bc.hash, size: r.size, ok: !!res.ok });
        if (EL.app.kit.kind === 'real') for (const e of EL.app.logs.slice(-5)) this.addConsole(e);
      }
      this.renderSimPanel();
      EL.toast(res.msg || (res.ok ? 'Programme démarré' : 'Refusé'), res.ok ? 'ok' : 'bad');
      if (target === 'sim' && this.twin) this.onTargetState(this.twin.state());
    },

    stop: async function () {
      const kit = this.target === 'sim' ? this.twin : EL.app.kit;
      if (!kit) return;
      const r = await kit.programCtl('stop', null, EL.app.pin);
      EL.track('program_stop', this.target);
      if (!r.ok) EL.toast(r.msg, 'bad');
      if (this.ws) this.ws.highlightBlock(null);
    },

    pressButton: async function (b) {
      const kit = this.target === 'sim' ? this.twin : EL.app.kit;
      if (!kit) return;
      await kit.cmd({ cmd: 'vbtn', b: b }, EL.app.pin);
      EL.track('virtual_button', b);
    },

    addConsole: function (e) {
      const R = this.R;
      if (!R) return;
      const tz = EL.app.state ? EL.app.state.tz : 0;
      R.console.appendChild(h('div.l' + e.level, [h('span.ts', e.ts ? U.fmtClock(e.ts, tz) : '#' + e.seq), e.msg]));
      while (R.console.childNodes.length > 200) R.console.removeChild(R.console.firstChild);
      R.console.scrollTop = R.console.scrollHeight;
    },

    onTargetState: function (s) {
      const R = this.R;
      if (!R) return;
      const vm = s.vm;
      const st = STATUS[vm.status] || '';
      U.clear(R.status);
      R.status.append(
        h('span.badge.' + (this.target === 'sim' ? 'info' : 'prim'), this.target === 'sim' ? 'simulation' : (EL.app.mode === 'demo' ? 'kit virtuel' : 'kit')),
        ' ', h('span.badge.' + (STATUS_CLS[vm.status] || ''), st)
      );
      const mine = this.lastCompile && vm.hash && this.lastCompile.bc.hash === vm.hash;
      if (vm.name && !mine && this.lastCompile) R.status.append(h('div.tiny.muted', 'Programme exécuté : « ' + vm.name + ' » (différent de l’éditeur)'));
      if (vm.error) R.status.append(h('div.note.bad.small', { style: { marginTop: '6px' } }, 'Erreur : ' + vm.error));
      // variables
      U.clear(R.vars);
      const names = mine ? this.lastCompile.bc.vars : null;
      const rows = [];
      (vm.vars || []).forEach(function (v, i) {
        const n = names ? names[i] : 'variable ' + (i + 1);
        if (n && n[0] === '#') return;
        rows.push(h('tr', [h('td', n), h('td.num', U.fmt(v, Math.abs(v) < 100 && v % 1 ? 3 : 0))]));
      });
      if (rows.length) R.vars.appendChild(h('table.tbl.vars-table', h('tbody', rows)));
      else R.vars.appendChild(h('div.small.muted', 'Aucune variable.'));
      // surlignage des blocs en cours
      if (this.ws && mine) {
        const ids = new Set();
        const code = EL.vm.normalize(this.lastCompile.bc).code;
        for (const pc of vm.pcs || []) {
          const id = EL.compiler.blockAtPc(this.lastCompile.ranges, code, pc);
          if (id) ids.add(id);
        }
        if (vm.status === 3 && vm.errPc >= 0) {
          const id = EL.compiler.blockAtPc(this.lastCompile.ranges, code, vm.errPc);
          if (id) { ids.add(id); const b = this.ws.getBlockById(id); if (b) b.setWarningText('Erreur : ' + vm.error); }
        }
        const key = Array.from(ids).join(',');
        if (key !== this.hlKey) {
          this.hlKey = key;
          try {
            this.ws.highlightBlock(null);
            ids.forEach(function (id) { view.ws.highlightBlock(id, true); });
          } catch (e) { /* bloc supprimé entre-temps */ }
        }
      } else if (this.ws && this.hlKey) { this.hlKey = ''; try { this.ws.highlightBlock(null); } catch (e) { /* rien */ } }
      if (this.target === 'sim' || EL.app.mode === 'demo') this.updateSimPanel(s);
    },

    renderSimPanel: function () {
      const R = this.R, self = this;
      U.clear(R.simPanel);
      const kit = EL.app.mode === 'demo' ? EL.app.kit : this.twin;
      if (!kit) {
        R.simPanel.append(
          h('p.small', 'Le jumeau numérique simule la maison : appareils, température, lumière, présence. Testez votre programme sans risque avant de l’envoyer au vrai kit.'),
          h('button.btn', { onclick: function () { self.run('sim'); } }, [EL.icon('flask'), 'Simuler mon programme'])
        );
        return;
      }
      const P = this.sim = {};
      const apps = Object.keys(EL.house.APPLIANCES);
      P.rows = [0, 1, 2, 3].map(function (k) {
        const sel = h('select.inp', { style: { minWidth: 0 } });
        for (const id of apps) sel.appendChild(h('option', { value: id }, EL.house.APPLIANCES[id].icon + ' ' + EL.house.APPLIANCES[id].name));
        sel.value = kit.apps[k][0] || 'none';
        sel.addEventListener('change', function () { kit.setAppliances(k, [sel.value]); });
        const sw = h('input', { type: 'checkbox', title: 'Interrupteur de l’appareil' });
        sw.addEventListener('change', function () { kit.setApplianceSwitch(k, 0, sw.checked); });
        const p = h('span.small.mono', '--');
        const relay = h('span.badge', 'off');
        R.simPanel.appendChild(h('div.sim-outlet', { style: { marginBottom: '6px' } }, [h('b', String(k + 1)), sel, h('label.check', [sw, '']), h('span'), h('div.row', [relay, p]), h('span')]));
        return { sel: sel, sw: sw, p: p, relay: relay };
      });
      P.presence = h('input', { type: 'checkbox', checked: kit.house.presence });
      P.presence.addEventListener('change', function () { kit.setPresence('manual', P.presence.checked); });
      P.tout = h('input', { type: 'range', min: -5, max: 40, step: 1, value: 10 });
      P.toutV = h('span.small', 'auto');
      P.tout.addEventListener('input', function () { kit.setOutdoor(Number(P.tout.value)); P.toutV.textContent = P.tout.value + ' °C'; });
      P.light = h('input', { type: 'range', min: 0, max: 100, step: 1, value: 50 });
      P.lightV = h('span.small', 'auto');
      P.light.addEventListener('input', function () { kit.setDaylight(Number(P.light.value)); P.lightV.textContent = P.light.value + ' %'; });
      P.speed = h('div.pill-group', [1, 10, 60, 300].map(function (x) {
        return h('button', { onclick: function () { kit.setSpeed(x); U.$$('button', P.speed).forEach(function (b) { b.classList.toggle('active', b.textContent === '×' + x); }); } }, '×' + x);
      }));
      U.$$('button', P.speed).forEach(function (b) { b.classList.toggle('active', b.textContent === '×' + kit.speed); });
      P.info = h('div.small.muted');
      R.simPanel.append(
        h('label.check', [P.presence, 'Quelqu’un est présent (détecteur de mouvement)']),
        h('div.field', [h('span', ['Température extérieure : ', P.toutV]), P.tout]),
        h('div.field', [h('span', ['Lumière du jour : ', P.lightV]), P.light]),
        h('div.row', [h('span.small', 'Vitesse du temps :'), P.speed]),
        P.info,
        h('button.btn.small', { onclick: function () { kit.setOutdoor(null); kit.setDaylight(null); P.toutV.textContent = 'auto'; P.lightV.textContent = 'auto'; } }, 'Météo automatique')
      );
    },

    updateSimPanel: function (s) {
      const P = this.sim;
      if (!P || !s.sim) return;
      s.sim.outlets.forEach(function (list, k) {
        const a = list[0], row = P.rows[k];
        if (!row) return;
        if (a && document.activeElement !== row.sw) row.sw.checked = !!a.sw;
        row.p.textContent = U.fmtP(s.outlets[k].p);
        row.relay.textContent = s.outlets[k].on ? 'relais ON' : 'relais OFF';
        row.relay.className = 'badge ' + (s.outlets[k].on ? 'ok' : '');
      });
      if (document.activeElement !== P.presence) P.presence.checked = s.sim.presence;
      P.info.textContent = 'Pièce : ' + U.fmt(s.sim.troom, 1, '°C') + ' · extérieur : ' + U.fmt(s.sim.tout, 1, '°C') + ' · jour : ' + U.fmt(s.sim.daylight, 0, '%') + ' · heure simulée : ' + U.fmtClock(s.ts, s.tz);
    },

    // ------------------------------------------------------------ exemples, ouverture, enregistrement
    loadExample: function (id, silent) {
      const ex = EL.examples.get(id);
      if (!ex || !this.ws) return;
      this.ws.clear();
      root.Blockly.serialization.workspaces.load(ex.build(), this.ws);
      this.ws.cleanUp(); // range les scripts en colonne, sans chevauchement
      this.ws.scrollCenter();
      this.R.name.value = ex.title.slice(0, 40);
      U.store.set('ws.name', this.R.name.value);
      this.saveLocal();
      if (!silent) { EL.toast('Exemple chargé : ' + ex.title, 'ok'); EL.track('example_open', id); }
    },
    examples: function () {
      const self = this;
      const body = h('div.col');
      const cats = {};
      for (const ex of EL.examples.LIST) (cats[ex.cat] = cats[ex.cat] || []).push(ex);
      let m;
      for (const cat of Object.keys(cats)) {
        body.appendChild(h('h3', cat));
        body.appendChild(h('div.grid.g2', cats[cat].map(function (ex) {
          return h('div.card.flat.ex-card', [
            h('div.row.between', [h('b', ex.title), h('span.badge.prim', 'niveau ' + ex.level)]),
            h('div.small', ex.summary),
            h('div.concepts', ex.concepts.map(function (c) { return h('span.badge', c); })),
            h('div.row', [h('button.btn.small.primary', { onclick: async function () {
              if (self.ws && self.ws.getAllBlocks(false).length && !(await EL.confirm('Ouvrir un exemple', 'Remplacer les blocs actuels par l’exemple « ' + ex.title + ' » ?', 'Remplacer'))) return;
              self.loadExample(ex.id);
              m.close();
            } }, 'Ouvrir')])
          ]);
        })));
      }
      m = EL.modal({ title: 'Exemples et algorithmes', body: body, wide: true });
    },
    openMenu: function () {
      const self = this, progs = U.store.get(LS_PROGS, {});
      const list = h('div.col');
      let m;
      const names = Object.keys(progs).sort();
      if (!names.length) list.appendChild(h('p.muted.small', 'Aucun programme enregistré dans ce navigateur.'));
      for (const n of names) {
        list.appendChild(h('div.row.between', [h('span', [h('b', n), h('span.small.muted', '  ' + new Date(progs[n].savedAt).toLocaleString('fr-FR'))]), h('div.row', [
          h('button.btn.small', { onclick: function () { self.loadJson(progs[n].ws, n); m.close(); } }, 'Ouvrir'),
          h('button.btn.small.ghost', { onclick: function () { delete progs[n]; U.store.set(LS_PROGS, progs); m.close(); self.openMenu(); } }, EL.icon('trash'))
        ])]));
      }
      const file = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
      file.addEventListener('change', function () {
        const f = file.files[0];
        if (!f) return;
        const rd = new FileReader();
        rd.onload = function () {
          try {
            const j = JSON.parse(rd.result);
            self.loadJson(j.ws || j, j.name || f.name.replace(/\.(elab\.)?json$/, ''));
            m.close();
          } catch (e) { EL.toast('Fichier illisible', 'bad'); }
        };
        rd.readAsText(f);
      });
      m = EL.modal({
        title: 'Ouvrir un programme', body: h('div.col', [list, file]),
        actions: [
          { label: 'Depuis un fichier…', onClick: function () { file.click(); return false; } },
          { label: 'Programme du kit', onClick: async function () {
            const w = await EL.app.kit.getProgramWs();
            if (!w) { EL.toast('Aucun programme à blocs enregistré sur le kit', 'warn'); return false; }
            const meta = await EL.app.kit.getProgram();
            self.loadJson(w, meta && meta.name || 'Programme du kit');
          } },
          { label: 'Fermer' }
        ]
      });
    },
    loadJson: function (json, name) {
      try {
        this.ws.clear();
        root.Blockly.serialization.workspaces.load(json, this.ws);
        if (name) { this.R.name.value = String(name).slice(0, 40); U.store.set('ws.name', this.R.name.value); }
        this.saveLocal();
        EL.toast('Programme ouvert', 'ok');
        EL.track('program_open', name || '');
      } catch (e) { EL.toast('Impossible d’ouvrir ce programme : ' + e.message, 'bad'); }
    },
    saveMenu: function () {
      const self = this;
      const name = this.R.name.value.trim() || 'Mon programme';
      const ws = root.Blockly.serialization.workspaces.save(this.ws);
      EL.modal({
        title: 'Enregistrer « ' + name + ' »',
        body: h('p', 'Enregistrez le programme dans ce navigateur ou téléchargez-le dans un fichier (à partager, rendre à l’enseignant, ou rouvrir sur un autre appareil).'),
        actions: [
          { label: 'Dans ce navigateur', kind: 'primary', onClick: function () {
            const progs = U.store.get(LS_PROGS, {});
            progs[name] = { ws: ws, savedAt: Date.now() };
            U.store.set(LS_PROGS, progs);
            EL.toast('Programme enregistré', 'ok');
            EL.track('program_save', name);
          } },
          { label: 'Télécharger un fichier', onClick: function () {
            U.download(name.replace(/[^\w\-àâäéèêëîïôöùûüç ]+/gi, '_') + '.elab.json', JSON.stringify({ format: 'energylab-blocks', v: 1, name: name, ws: ws }, null, 1), 'application/json');
            EL.track('program_download', name);
          } },
          { label: 'Annuler' }
        ]
      });
      void self;
    },
    showCode: function () {
      if (!this.ws) return;
      const r = this.compile();
      const ps = EL.compiler.pseudo(this.ws);
      const asm = r.ok ? EL.compiler.disassemble(r.bc) : '(le programme contient des erreurs)';
      const tabs = h('div.tabs');
      const content = h('div');
      const show = function (i) {
        U.$$('button', tabs).forEach(function (b, j) { b.classList.toggle('active', i === j); });
        U.clear(content);
        if (i === 0) content.append(h('p.small.muted', 'Le même programme écrit en pseudo-code, comme dans un cours d’algorithmique.'), h('pre', ps));
        else content.append(h('p.small.muted', 'Les instructions que la machine virtuelle du kit exécute réellement (« bytecode »). Chaque bloc devient une ou plusieurs instructions simples. Taille : ' + (r.size || 0) + ' nombres.'), h('pre', asm));
      };
      tabs.append(h('button', { onclick: function () { show(0); } }, 'Pseudo-code'), h('button', { onclick: function () { show(1); } }, 'Langage machine (bytecode)'));
      show(0);
      EL.modal({ title: 'Voir le code', body: h('div', [tabs, content]), wide: true });
      EL.track('code_view', '');
    },
    clearWs: async function () {
      if (!this.ws) return;
      if (!(await EL.confirm('Tout effacer', 'Supprimer tous les blocs de l’espace de travail ?', 'Effacer'))) return;
      this.ws.clear();
      this.saveLocal();
    }
  };

  EL.views.programmer = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);

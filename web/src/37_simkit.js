/* EnergyLab — kit virtuel (jumeau numérique) et arène de comparaison d'algorithmes
 * SimKit expose exactement la même interface que RealKit (38_realkit.js). */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  const U = EL.util;

  const DEFAULT_APPS = [['lamp_halo'], ['kettle'], ['heater'], ['laptop']];

  function ok(msg, extra) { return Promise.resolve(Object.assign({ ok: true, msg: msg || '' }, extra || {})); }
  function fail(msg, code) { return Promise.resolve({ ok: false, msg: msg, code: code || 400 }); }

  class SimKit extends U.Emitter {
    constructor(opts) {
      super();
      opts = opts || {};
      this.kind = 'sim';
      this.persistKey = opts.persistKey || null;
      this.cfg = EL.config.defaults('SIMU');
      this.cfg.kitName = opts.name || 'Kit virtuel';
      this.cfg.net.tzMin = -new Date().getTimezoneOffset();
      this.cfgSeq = 1;
      this.knnSeq = 1;
      this.relays = new EL.relays.Relays(null);
      const self = this;
      this.io = {
        beep: function (k) { self.emit('beep', k); },
        screenMessage: function (m) { self.screen = { msg: m, until: self.simMs + 10000 }; },
        alertScreen: function (m) { self.screen = { msg: '⚠ ' + m, until: self.simMs + 8000 }; },
        pzemResetEnergy: function (k) { self.house.outlets[k].meterWh = 0; },
        pzemSetAlarm: function () { /* pas d'effet en simulation */ },
        configChanged: function () { self.cfgSeq++; self.persist(); self.emit('config', self.cfgSeq); },
        onLog: function (e) { self.emit('log', e); }
      };
      this.core = new EL.kitcore.KitCore(this.cfg, this.relays, this.io);
      this.house = new EL.house.House({ seed: opts.seed || 4242, troom: 19, toutMean: 10, toutAmp: 5 });
      this.apps = (opts.apps || DEFAULT_APPS).map(function (a) { return a.slice(); });
      this.apps.forEach(function (ids, k) { self.house.setAppliances(k, ids); self.switchOn(k); });
      this.simMs = 0;
      this.epoch0 = Math.floor(Date.now() / 1000);
      this.speed = 1;
      this.paused = false;
      this.timer = null;
      this.nextSample = 0;
      this.next1s = 0;
      this.lastEmit = 0;
      this.program = null;
      this.programWs = null;
      this.research = { events: [], results: [] };
      this.screen = null;
      this.restore();
      this.core.applyOutletConfig();
      this.core.note(EL.kitcore.LG.INFO, 'Kit virtuel démarré : les mesures sont simulées (jumeau numérique)');
    }

    // ------------------------------------------------------------ persistance (mode démonstration)
    persist() {
      if (!this.persistKey) return;
      U.store.set(this.persistKey, {
        cfg: this.cfg, knn: this.core.knn.toJSON(), program: this.program, programWs: this.programWs,
        apps: this.apps, research: this.research
      });
    }
    restore() {
      if (!this.persistKey) return;
      const s = U.store.get(this.persistKey, null);
      if (!s) return;
      if (s.cfg) EL.config.merge(this.cfg, s.cfg);
      if (s.cfg && s.cfg.peda && s.cfg.peda.pin) this.cfg.peda.pin = s.cfg.peda.pin;
      if (s.knn) this.core.knn.load(s.knn);
      if (s.apps) { this.apps = s.apps; const self = this; this.apps.forEach(function (ids, k) { self.house.setAppliances(k, ids); self.switchOn(k); }); }
      if (s.research) this.research = s.research;
      if (s.program) {
        this.program = s.program;
        this.programWs = s.programWs || null;
        const err = this.core.loadProgram(this.program);
        if (!err && this.cfg.peda.progAutostart) this.core.startProgram(this.simMs, (Math.random() * 4294967295) >>> 0);
      }
    }

    // ------------------------------------------------------------ boucle de simulation
    epoch() { return this.epoch0 + Math.floor(this.simMs / 1000); }
    minuteOfDay() {
      const t = this.epoch() + this.cfg.net.tzMin * 60;
      return Math.floor(((t % 86400) + 86400) % 86400 / 60);
    }
    connect() {
      if (!this.timer) {
        const self = this;
        this.timer = setInterval(function () { if (!self.paused) self.advance(100 * self.speed); }, 100);
      }
      this.emit('status', { connected: true });
      this.emitState(true);
      return Promise.resolve(true);
    }
    disconnect() { if (this.timer) clearInterval(this.timer); this.timer = null; }
    setSpeed(x) { this.speed = Math.max(1, Math.min(600, x)); }
    setPaused(p) { this.paused = !!p; }
    advance(ms) {
      const step = this.speed > 60 ? 1000 : 100;
      while (ms > 0) {
        const d = Math.min(step, ms);
        this.stepOnce(d);
        ms -= d;
      }
      this.emitState(false);
    }
    stepOnce(dms) {
      this.simMs += dms;
      const minute = this.minuteOfDay();
      this.house.ctTurns = this.cfg.outlets.map(function (o) { return o.ctTurns; });
      this.house.step(dms / 1000, this.relays.on, minute);
      this.core.setClock(true, this.epoch());
      if (this.simMs >= this.nextSample) {
        this.nextSample = this.simMs + this.cfg.measure.sampleMs;
        for (let k = 0; k < 4; k++) this.core.onMeasurement(k, this.house.readPzem(k, this.simMs / 1000), this.simMs);
      }
      const env = this.house.readEnv(minute);
      this.core.onEnv(env.temp, env.hum, env.lum, env.motion, this.simMs);
      this.core.tick100(this.simMs);
      if (this.simMs >= this.next1s) {
        this.next1s += 1000;
        if (this.next1s < this.simMs) this.next1s = this.simMs + 1000;
        this.core.tick1s(this.simMs);
      }
    }
    emitState(force) {
      const now = Date.now();
      if (!force && now - this.lastEmit < 450) return;
      this.lastEmit = now;
      this.emit('state', this.state());
    }
    state() {
      const minute = this.minuteOfDay();
      const h = this.house;
      return this.core.snapshot(this.simMs, {
        net: { mode: 'sim', clients: 1, rssi: 0, ws: 1 },
        seq: { log: this.core.logSeq, cfg: this.cfgSeq, knn: this.knnSeq, pzem: 0 },
        sim: {
          speed: this.speed, paused: this.paused, troom: h.troom, tout: h.tout(minute), daylight: h.daylight(minute),
          presence: h.presence, presenceMode: h.presenceMode,
          screen: this.screen && this.screen.until > this.simMs ? this.screen.msg : '',
          outlets: h.outlets.map(function (o) {
            return o.apps.map(function (a) {
              return { id: a.id, name: a.def.name, icon: a.def.icon, cat: a.def.cat, model: a.def.model, sw: a.sw, p: a.p, pf: a.pf, demand: a.demand, tw: a.tw, tin: a.tin, t: a.t };
            });
          })
        }
      });
    }

    // ------------------------------------------------------------ commandes propres au simulateur
    // l'appareil branché est en marche : il consomme dès que la prise est allumée
    switchOn(k) { for (const a of this.house.outlets[k].apps) a.sw = true; }
    setAppliances(k, ids) {
      this.apps[k] = ids.slice();
      this.house.setAppliances(k, ids);
      this.switchOn(k);
      this.persist();
      this.emitState(true);
    }
    setApplianceSwitch(k, j, on) {
      const a = this.house.outlets[k].apps[j];
      if (a) { a.sw = !!on; if (!on && a.def.model !== 'program') a.t = 0; }
      this.emitState(true);
    }
    setPresence(mode, value) {
      this.house.presenceMode = mode;
      if (mode === 'manual') this.house.presence = !!value;
      this.emitState(true);
    }
    setOutdoor(t) { this.house.toutOverride = (t === null || t === undefined) ? null : Number(t); }
    setDaylight(l) { this.house.lightOverride = (l === null || l === undefined) ? null : Number(l); }
    setRoomTemp(t) { this.house.troom = Number(t); }

    // ------------------------------------------------------------ interface Kit (identique à RealKit)
    isTeacher(pin) { return !!pin && pin === this.cfg.peda.pin; }
    allowed(pin, perm) { return this.isTeacher(pin) || (this.cfg.peda.perms & perm) !== 0; }
    getInfo() {
      return Promise.resolve({
        fw: 'simulation', build: '', kit: 'SIMU', name: this.cfg.kitName, mode: 'sim', ip: '', apIp: '', ssid: '',
        apSsid: this.cfg.net.apSsid, host: 'simulation', rssi: 0, clients: 1, heap: 0, uptime: Math.floor(this.simMs / 1000),
        time: this.epoch(), timeValid: true, fsUsed: 0, fsTotal: 0, mqtt: 'désactivé', simulated: true
      });
    }
    getConfig(pin) {
      const teacher = this.isTeacher(pin);
      const c = teacher ? EL.config.clone(this.cfg) : EL.config.masked(this.cfg);
      c.seq = this.cfgSeq;
      c.teacher = teacher;
      return Promise.resolve(c);
    }
    setConfig(patch, pin) {
      if (!this.isTeacher(pin)) return fail('Code enseignant requis', 403);
      const net = EL.config.merge(this.cfg, patch);
      this.core.applyOutletConfig();
      this.core.note(EL.kitcore.LG.INFO, "Configuration modifiée par l'enseignant");
      this.cfgSeq++;
      this.persist();
      this.emit('config', this.cfgSeq);
      return ok(net ? 'Réglages réseau sans effet en simulation' : 'Enregistré', { reboot: false });
    }
    cmd(o, pin) {
      const c = o.cmd, now = this.simMs, P = EL.config.PERM, RES = EL.relays.RES, SRC = EL.relays.SRC;
      const self = this;
      if (c === 'relay' || c === 'toggle' || c === 'pulse') {
        if (!this.allowed(pin, P.RELAY)) return fail("La commande manuelle des prises est désactivée par l'enseignant", 403);
        const outlet = o.outlet | 0;
        if (outlet < 0 || outlet > 4) return fail('Prise invalide');
        let msg = '';
        const ks = outlet === 0 ? [0, 1, 2, 3] : [outlet - 1];
        ks.forEach(function (k) {
          let r;
          if (c === 'relay') r = self.core.userRelay(k, !!o.on, SRC.USER, now);
          else if (c === 'toggle') r = self.core.userRelay(k, !self.relays.isOn(k), SRC.USER, now);
          else if (self.relays.isLatched(k)) r = RES.LATCHED;
          else { self.core.out[k].shed = false; self.relays.pulse(k, o.s || 10, SRC.USER, now); r = RES.OK; }
          if (r === RES.DELAYED) msg = 'Commutation retardée : délai minimum de ' + self.cfg.outlets[k].minSwitchS.toFixed(1) + ' s entre deux commutations';
          else if (r === RES.LATCHED) msg = "Prise verrouillée par une protection : réarmez-la d'abord";
          else if (r === RES.INVALID) msg = 'Prise invalide ou désactivée';
        });
        this.emitState(true);
        return ok(msg);
      }
      if (c === 'rearm') {
        if (!this.allowed(pin, P.REARM)) return fail("Le réarmement est réservé à l'enseignant", 403);
        const r = this.core.rearm((o.outlet | 0) - 1);
        this.emitState(true);
        return r ? ok('Prise réarmée') : fail("Cette prise n'était pas verrouillée");
      }
      if (c === 'param') {
        if (!this.allowed(pin, P.PARAMS)) return fail("La modification des paramètres est verrouillée par l'enseignant", 403);
        const before = EL.config.paramGet(this.cfg, o.p, o.idx);
        const r = EL.config.paramSet(this.cfg, o.p, o.idx, Number(o.v));
        if (!r.ok) return fail(r.msg);
        const after = EL.config.paramGet(this.cfg, o.p, o.idx);
        if (after !== before) {
          const name = EL.config.PARAMS[o.p].name;
          this.core.note(EL.kitcore.LG.INFO, 'Paramètre « ' + name + ' »' + (EL.config.paramIsOutlet(o.p) ? ' de la prise ' + o.idx : '') + ' : ' + before + ' → ' + after);
          if (o.p === 4) this.core.applyOutletConfig();
          this.io.configChanged();
        }
        return ok(r.msg, { v: after });
      }
      if (c === 'resetEnergy') {
        if (!this.allowed(pin, P.RESET_ENERGY)) return fail("La remise à zéro des compteurs est réservée à l'enseignant", 403);
        const k = (o.outlet | 0) - 1;
        if (k < 0 || k > 3) return fail('Prise invalide');
        this.house.outlets[k].meterWh = 0;
        this.core.note(EL.kitcore.LG.OK, 'Capteur de la prise ' + (k + 1) + " : compteur d'énergie remis à zéro");
        return ok('Remise à zéro demandée');
      }
      if (c === 'beep') { this.emit('beep', o.n | 0); return ok(''); }
      if (c === 'vbtn') { this.core.machine.pressButton(o.b | 0); return ok(''); }
      if (c === 'time') return ok('');
      if (c === 'knnClear') {
        if (!this.allowed(pin, P.KNN)) return fail("Action réservée à l'enseignant", 403);
        this.core.knn.samples = []; this.core.knn.labels = []; this.knnSeq++; this.persist();
        return ok('Apprentissage effacé');
      }
      if (!this.isTeacher(pin)) return fail('Code enseignant requis', 403);
      if (c === 'pzem') return ok('Outil sans objet en simulation : les capteurs virtuels sont toujours adressés 1 à 4.');
      if (c === 'reboot') { this.core.note(EL.kitcore.LG.INFO, 'Redémarrage simulé'); return ok('Redémarrage simulé'); }
      if (c === 'factory') { U.store.del(this.persistKey); return ok('Réinitialisation : rechargez la page'); }
      if (c === 'clearLogs') return ok('Journaux effacés');
      if (c === 'clearResearch') { this.research = { events: [], results: [] }; this.persist(); return ok('Données de recherche effacées'); }
      return fail('Commande inconnue');
    }
    sendProgram(bc, ws, opts) {
      opts = opts || {};
      if (!this.allowed(opts.pin, EL.config.PERM.PROGRAM)) return fail("L'envoi de programmes est désactivé par l'enseignant", 403);
      const err = this.core.loadProgram(bc);
      if (err) return fail('Programme refusé : ' + err);
      if (opts.save !== false) { this.program = bc; this.programWs = ws || null; }
      if (opts.autostart !== undefined) this.cfg.peda.progAutostart = !!opts.autostart;
      if (opts.start !== false) this.core.startProgram(this.simMs, (Math.random() * 4294967295) >>> 0);
      this.persist();
      this.emitState(true);
      return ok(opts.start !== false ? 'Programme envoyé et démarré' : 'Programme envoyé');
    }
    programCtl(action, value, pin) {
      if (!this.allowed(pin, EL.config.PERM.PROGRAM)) return fail("Interdit par l'enseignant", 403);
      if (action === 'start') {
        if (!this.core.machine.loaded) return fail('Aucun programme chargé');
        this.core.startProgram(this.simMs, (Math.random() * 4294967295) >>> 0);
      } else if (action === 'stop') this.core.stopProgram();
      else if (action === 'autostart') { this.cfg.peda.progAutostart = !!value; this.persist(); }
      this.emitState(true);
      return ok('');
    }
    getProgram() {
      const m = this.core.machine;
      return Promise.resolve({ loaded: m.loaded, name: m.loaded ? m.prog.name : '', hash: m.loaded ? m.prog.hash : '', status: m.status, err: m.err, autostart: this.cfg.peda.progAutostart, saved: !!this.program, hasBlocks: !!this.programWs });
    }
    getProgramWs() { return Promise.resolve(this.programWs); }
    getHistory(n) { return Promise.resolve(U.contiguousTail(this.core.hist.list(n || 600)).map(function (s) { return { t: s.t, p: s.p.slice(), T: s.temp, H: s.hum, L: s.lum, pr: s.pres, r: s.relays }; })); }
    getLogs(since) { return Promise.resolve(this.core.logs.filter(function (e) { return e.seq > (since || 0); })); }
    getDays() {
      const t = this.core.today();
      return Promise.resolve([t].concat(this.core.days).map(function (d) { return { d: d.dayKey, e: d.eWh.slice(), c: d.cost.slice(), pk: d.peak }; }));
    }
    getKnn() {
      const knn = this.core.knn;
      return Promise.resolve({
        k: this.cfg.ai.knnK, maxDist: this.cfg.ai.knnMaxDist, seq: this.knnSeq,
        labels: knn.labels.map(function (l) { return { id: l.id, name: l.name, n: knn.samples.filter(function (s) { return s.label === l.id; }).length }; }),
        samples: knn.samples.map(function (s) { return [s.label, s.p, s.pf]; })
      });
    }
    knnOp(o, pin) {
      if (!this.allowed(pin, EL.config.PERM.KNN)) return fail("L'entraînement de l'IA est désactivé par l'enseignant", 403);
      let r;
      if (o.op === 'train') r = this.core.knnTrain((o.outlet | 0) - 1, o.label || '');
      else if (o.op === 'add') {
        const id = this.core.knn.labelId(o.label, true);
        if (id < 0 || !(o.p >= 1)) r = { ok: false, msg: 'exemple invalide' };
        else { this.core.knn.samples.push({ label: id, p: o.p, pf: o.pf }); r = { ok: true, msg: 'exemple ajouté' }; }
      } else if (o.op === 'delete') { this.core.knn.removeLabel(o.id); r = { ok: true, msg: 'appareil oublié' }; }
      else r = { ok: false, msg: 'opération inconnue' };
      if (r.ok) { this.knnSeq++; this.persist(); }
      return Promise.resolve(r);
    }
    getPzem() {
      return Promise.resolve({ busy: false, msg: 'Capteurs virtuels (simulation)', seq: 0, found: [1, 2, 3, 4], alarm: this.cfg.outlets.map(function (o) { return o.pzemAlarm; }), stats: [0, 1, 2, 3].map(function () { return { ok: 1, err: 0, le: 0 }; }) });
    }
    listFiles(dir) {
      if (dir === 'research') {
        const f = [];
        if (this.research.events.length) f.push({ n: 'events.csv', s: JSON.stringify(this.research.events).length });
        if (this.research.results.length) f.push({ n: 'results.csv', s: JSON.stringify(this.research.results).length });
        return Promise.resolve(f);
      }
      return Promise.resolve([]);
    }
    fetchFile(dir, name) {
      if (dir === 'research' && name === 'events.csv') {
        const rows = [['horodatage', 'apprenant', 'groupe', 'condition', 'appareil', 'type', 'detail']].concat(this.research.events.map(function (e) { return [e.ts, e.learner, e.group, e.cond, e.device, e.type, typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail)]; }));
        return Promise.resolve(rows.map(function (r) { return r.map(U.csvEscape).join(','); }).join('\n'));
      }
      if (dir === 'research' && name === 'results.csv') {
        const rows = [['horodatage', 'apprenant', 'groupe', 'condition', 'instrument', 'score', 'max', 'duree_s', 'reponses']].concat(this.research.results.map(function (e) { return [e.ts, e.learner, e.group, e.cond, e.kind, e.score, e.max, e.duration, JSON.stringify(e.answers)]; }));
        return Promise.resolve(rows.map(function (r) { return r.map(U.csvEscape).join(','); }).join('\n'));
      }
      return Promise.resolve('');
    }
    postEvents(arr) { this.research.events = this.research.events.concat(arr).slice(-5000); this.persist(); return ok(''); }
    postResult(o) { this.research.results.push(o); this.persist(); return ok('Résultat enregistré (simulation)'); }
  }

  // ------------------------------------------------------------------ arène : journée simulée accélérée
  // programs : [{label, bc (programme compilé) ou null pour « aucun algorithme »}]
  async function runArena(scenarioId, programs, onProgress) {
    const sc = EL.house.SCENARIOS[scenarioId];
    if (!sc) throw new Error('scénario inconnu');
    const results = [];
    const epoch0 = 1735689600; // 1er janvier 2025, 00:00 (fuseau 0 pour la simulation)
    for (let pi = 0; pi < programs.length; pi++) {
      const prog = programs[pi];
      const cfg = EL.config.defaults('ARENE');
      cfg.net.tzMin = 0;
      Object.assign(cfg.tariff, sc.tariff);
      cfg.tariff.contractW = sc.contractW;
      cfg.peda.perms = 63;
      cfg.hw.buzzerOn = false;
      // la maison virtuelle n'est pas le kit : circuits de 16 A, pas de limite totale du kit (on compte les dépassements du contrat)
      cfg.safety.maxTotalW = 1e6;
      cfg.safety.hardMaxOutletW = 3680;
      sc.outlets.forEach(function (o, k) {
        Object.assign(cfg.outlets[k], { name: o.name, priority: o.priority, maxPower: 3680, pzemAlarm: 23000 });
      });
      const relays = new EL.relays.Relays(null);
      const logs = [];
      const io = { beep: function () {}, screenMessage: function () {}, alertScreen: function () {}, pzemResetEnergy: function () {}, pzemSetAlarm: function () {}, configChanged: function () {}, onLog: function (e) { if (logs.length < 400) logs.push(e); } };
      const core = new EL.kitcore.KitCore(cfg, relays, io);
      core.applyOutletConfig();
      EL.house.pretrainKnn(core.knn, EL.util.rng(99));
      const house = new EL.house.House({ seed: 777, troom: sc.troom, toutMean: sc.tout.mean, toutAmp: sc.tout.amp, presenceMode: 'schedule', schedule: sc.presence });
      sc.outlets.forEach(function (o, k) { house.setAppliances(k, o.apps.map(function (a) { return a.id; })); });
      for (let k = 0; k < 4; k++) relays.force(k, true, 0);
      let error = '';
      if (prog.bc) {
        const err = core.loadProgram(prog.bc);
        if (err) error = err;
        else core.startProgram(0, 12345);
      }
      const k1 = { energyWh: 0, cost: 0, peakW: 0, overMin: 0, thermalDegH: 0, fridgeWarmMin: 0 };
      const series = { p: [], outlets: [[], [], [], []], troom: [], relays: [], tw: [] };
      let minAcc = 0, minAccO = [0, 0, 0, 0], prevMinute = -1;
      for (let s = 0; s < 86400; s++) {
        const t = s * 1000;
        const minute = Math.floor(s / 60);
        if (minute !== prevMinute) {
          EL.house.applyHabits(house, sc, minute, prevMinute);
        }
        house.step(1, relays.on, minute);
        core.setClock(true, epoch0 + s);
        for (let k = 0; k < 4; k++) core.onMeasurement(k, house.readPzem(k, s), t);
        const env = house.readEnv(minute);
        core.onEnv(env.temp, env.hum, env.lum, env.motion, t);
        core.tick100(t);
        core.tick1s(t);
        const p = house.totalPNow();
        k1.energyWh += p / 3600;
        k1.cost += p / 3600 / 1000 * EL.config.priceAt(cfg, minute, true);
        minAcc += p;
        for (let k = 0; k < 4; k++) minAccO[k] += house.outlets[k].pNow || 0;
        if (house.presence && house.troom < cfg.env.tempSet - 1) k1.thermalDegH += (cfg.env.tempSet - 1 - house.troom) / 3600;
        for (const o of house.outlets) for (const a of o.apps) if (a.def.model === 'fridge' && a.tin > 8) k1.fridgeWarmMin += 1 / 60;
        if (s % 60 === 59) {
          const avg = minAcc / 60;
          if (avg > k1.peakW) k1.peakW = avg;
          if (avg > cfg.tariff.contractW) k1.overMin++;
          series.p.push(avg);
          for (let k = 0; k < 4; k++) { series.outlets[k].push(minAccO[k] / 60); minAccO[k] = 0; }
          series.troom.push(house.troom);
          series.relays.push(relays.mask());
          let tw = NaN;
          for (const o of house.outlets) for (const a of o.apps) if (a.def.model === 'waterheater') tw = a.tw;
          series.tw.push(tw);
          minAcc = 0;
        }
        prevMinute = minute;
        if (s % 7200 === 7199) {
          if (onProgress) onProgress((pi + s / 86400) / programs.length);
          await new Promise(function (r) { setTimeout(r, 0); });
        }
      }
      let lost = 0, coldDraws = 0, washerDone = true, washers = 0;
      for (const o of house.outlets) {
        for (const a of o.apps) {
          const m = a.def.model;
          if (m === 'simple' || m === 'standby' || m === 'timed' || m === 'charger' || m === 'cycling' || m === 'cooler') lost += a.unserved / 60;
          if (m === 'waterheater') coldDraws += a.coldDraws || 0;
          if (m === 'program') { washers++; if (a.sw || a.done === 0) washerDone = false; }
        }
      }
      let switches = 0;
      for (let k = 0; k < 4; k++) switches += relays.switches(k);
      results.push({
        label: prog.label, id: prog.id || '', error: error, energyKWh: k1.energyWh / 1000, cost: k1.cost, peakW: k1.peakW, overMin: k1.overMin,
        switches: switches, serviceLostMin: lost, thermalDegH: k1.thermalDegH, coldDraws: coldDraws,
        washerDone: washers ? washerDone : null, fridgeWarmMin: k1.fridgeWarmMin, co2kg: k1.energyWh / 1000 * cfg.tariff.co2 / 1000,
        series: series, logs: logs, vmError: core.machine.err
      });
    }
    if (onProgress) onProgress(1);
    return results;
  }

  EL.SimKit = SimKit;
  EL.runArena = runArena;
})(typeof globalThis !== 'undefined' ? globalThis : this);

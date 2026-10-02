/* EnergyLab — cœur logique du kit (copie de firmware/src/kitcore.cpp)
 * Utilisé par le simulateur (jumeau numérique) et le kit virtuel de démonstration. */
(function (root) {
  'use strict';
  // délestage : premier nouvel essai de remise en service après 2 min, puis délai doublé (max 15 min)
  const SHED_RETRY_MS = 120000, SHED_RETRY_MAX_MS = 900000, SHED_ABANDON_MS = 30000;
  const EL = root.EL = root.EL || {};
  const NOUT = 4;
  const LG = { INFO: 0, OK: 1, WARN: 2, ALERT: 3, PROG: 4 };
  const WK = { DELAY: 0, LATCHED: 4, BADOUTLET: 8, CLOCK: 9, PARAMS: 10, RESET: 11, DISABLED: 12, CURRENT_OFF: 16, VOLTAGE: 20, PARAMMSG: 24, ALARM: 28 };

  function newOutlet() {
    return {
      u: NaN, i: NaN, p: NaN, s: NaN, q: NaN, pf: NaN, f: NaN, phi: NaN, eCounterKWh: NaN,
      eTodayWh: 0, costToday: 0, online: false, alarm: false, okCount: 0, errCount: 0, failStreak: 0,
      shed: false, shedP: 0, shedAt: 0, retryMs: SHED_RETRY_MS, restoredAt: -1e12, overCount: 0, latchReason: '', idleS: 0, appliance: 0, applianceDist: NaN,
      buf: [], rawP: NaN, last5: []
    };
  }
  function vmIdx(v) { if (!Number.isFinite(v) || v > 1e6 || v < -1e6) return -1; return Math.floor(v + 0.5); }
  function clampRound(v, lo, hi) { if (!Number.isFinite(v)) return lo; const r = Math.floor(v + 0.5); return r < lo ? lo : (r > hi ? hi : r); }
  function g6(v) { return Number(v.toPrecision(6)).toString(); }

  class KitCore {
    // io : { beep(kind), screenMessage(msg), alertScreen(msg), pzemResetEnergy(k), pzemSetAlarm(k, w), configChanged(), onLog(entry) }
    constructor(cfg, relays, io) {
      this.cfg = cfg;
      this.rel = relays;
      this.io = io;
      this.out = [newOutlet(), newOutlet(), newOutlet(), newOutlet()];
      this.env = { temp: NaN, hum: NaN, lum: NaN, pres: false, lastMotion: -1e12, motion: false };
      this.hist = new EL.ai.FastHistory();
      this.holt = new EL.ai.Holt();
      this.anom = [new EL.ai.Anomaly(), new EL.ai.Anomaly(), new EL.ai.Anomaly(), new EL.ai.Anomaly()];
      this.knn = new EL.ai.Knn();
      this.machine = new EL.vm.Machine(this);
      this.programRuns = 0;
      this.lastStatus = EL.vm.STATUS.IDLE;
      this.clockValid = false;
      this.epoch = 0;
      this.now = 0;
      this.lastSec = -1;
      this.dayKey = -1;
      this.peakToday = 0;
      this.shedHold = 0;
      this.lastShedCall = -1e12;
      this.safetyHold = 0;
      this.days = [];
      this.logs = [];
      this.logSeq = 0;
      this.warnAt = new Array(48).fill(-1e12);
    }

    setClock(valid, epoch) { this.clockValid = valid; this.epoch = epoch; }
    localTime() {
      if (!this.clockValid) return null;
      const t = this.epoch + this.cfg.net.tzMin * 60;
      const d = Math.floor(t / 86400);
      const sod = t - d * 86400;
      return { h: Math.floor(sod / 3600), m: Math.floor(sod / 60) % 60, s: Math.floor(sod % 60), wday: (((d + 3) % 7) + 7) % 7 + 1, dayKey: d };
    }
    warnLimited(key, interval, now) {
      if (key < 0 || key >= 48) return true;
      if (now - this.warnAt[key] < interval) return false;
      this.warnAt[key] = now;
      return true;
    }
    note(level, msg) {
      const e = { seq: ++this.logSeq, ts: this.clockValid ? this.epoch : 0, level: level, msg: msg };
      this.logs.push(e);
      if (this.logs.length > 40) this.logs.shift();
      if (this.io.onLog) this.io.onLog(e);
    }
    applyOutletConfig() {
      for (let k = 0; k < NOUT; k++) {
        let s = this.cfg.outlets[k].minSwitchS;
        if (s < this.cfg.safety.minSwitchFloorS) s = this.cfg.safety.minSwitchFloorS;
        this.rel.setMinSwitchMs(k, s * 1000);
      }
    }

    // ------------------------------------------------------------ mesures
    onMeasurement(k, r, now) {
      const o = this.out[k];
      const oc = this.cfg.outlets[k];
      const clearValues = function () { o.u = o.i = o.p = o.s = o.q = o.pf = o.f = o.phi = NaN; o.rawP = NaN; };
      if (!oc.enabled) { o.online = false; clearValues(); return; }
      if (!r.ok) {
        o.errCount++;
        if (o.failStreak < 255) o.failStreak++;
        if (o.failStreak >= 3) {
          if (o.online) this.note(LG.WARN, 'Prise ' + (k + 1) + ' (' + oc.name + ') : le capteur PZEM ne répond plus');
          o.online = false; clearValues(); o.buf = []; o.last5 = [];
        }
        return;
      }
      o.okCount++;
      o.failStreak = 0;
      if (!o.online) {
        if (o.okCount > 1) this.note(LG.OK, 'Prise ' + (k + 1) + ' (' + oc.name + ') : capteur PZEM de nouveau en ligne');
        o.online = true;
      }
      const turns = oc.ctTurns || 1;
      const u = r.u * oc.calU, i = r.i * oc.calI / turns, p = r.p * oc.calU * oc.calI / turns;
      o.eCounterKWh = r.eWh * oc.calU * oc.calI / turns / 1000;
      o.alarm = !!r.alarm;
      o.rawP = p;
      o.buf.push({ u: u, i: i, p: p, pf: r.pf, f: r.f });
      if (o.buf.length > 10) o.buf.shift();
      const n = Math.min(Math.max(1, Math.min(10, this.cfg.measure.smoothN)), o.buf.length);
      let su = 0, si = 0, sp = 0, spf = 0, sf = 0;
      for (let j = o.buf.length - n; j < o.buf.length; j++) { const b = o.buf[j]; su += b.u; si += b.i; sp += b.p; spf += b.pf; sf += b.f; }
      o.u = su / n; o.i = si / n; o.p = sp / n; o.pf = spf / n; o.f = sf / n;
      o.s = o.u * o.i;
      const q2 = o.s * o.s - o.p * o.p;
      o.q = q2 > 0 ? Math.sqrt(q2) : 0;
      o.phi = Math.acos(Math.min(1, Math.max(0, o.pf))) * 180 / Math.PI;
      o.last5.push({ p: o.p, pf: o.pf });
      if (o.last5.length > 5) o.last5.shift();
      // protections
      if (this.rel.isOn(k) && !this.rel.isLatched(k)) {
        if (p > oc.maxPower) { if (o.overCount < 255) o.overCount++; } else o.overCount = 0;
        if (o.overCount >= 2 || p > 1.5 * oc.maxPower) {
          o.latchReason = Math.round(p) + ' W > ' + Math.round(oc.maxPower) + ' W';
          this.rel.latch(k, now);
          o.overCount = 0;
          o.shed = false;
          this.note(LG.ALERT, 'Protection prise ' + (k + 1) + ' (' + oc.name + ') : ' + Math.round(p) + ' W > max ' + Math.round(oc.maxPower) + ' W. Prise coupée et verrouillée.');
          this.io.alertScreen('Surpuissance P' + (k + 1));
          if (this.cfg.hw.buzzerOn) this.io.beep(2);
        }
      } else {
        o.overCount = 0;
        if (!this.rel.isOn(k) && p > 5 && now - this.rel.lastChange(k) > 5000 && this.warnLimited(WK.CURRENT_OFF + k, 120000, now)) {
          this.note(LG.WARN, 'Prise ' + (k + 1) + ' : ' + Math.round(p) + ' W mesurés alors que le relais est ouvert. Vérifiez le câblage (tore sur le bon fil ?).');
        }
      }
      if (r.alarm && this.warnLimited(WK.ALARM + k, 60000, now)) {
        this.note(LG.WARN, 'Prise ' + (k + 1) + " : le capteur signale le dépassement de son seuil d'alarme (" + oc.pzemAlarm + ' W)');
      }
      if ((u < 190 || u > 255) && this.warnLimited(WK.VOLTAGE + k, 300000, now)) {
        this.note(LG.WARN, 'Prise ' + (k + 1) + ' : tension anormale ' + u.toFixed(1) + ' V');
      }
    }

    onEnv(temp, hum, lum, motion, now) {
      const c = this.cfg.env;
      this.env.temp = c.dhtOn ? temp : NaN;
      this.env.hum = c.dhtOn ? hum : NaN;
      this.env.lum = c.ldrOn ? lum : NaN;
      if (c.pirOn) { this.env.motion = motion; if (motion) this.env.lastMotion = now; } else this.env.motion = false;
    }

    tick100(now) {
      this.now = now;
      this.rel.tick(now);
      this.env.pres = this.cfg.env.pirOn && (now - this.env.lastMotion) < this.cfg.env.presenceS * 1000;
      const S = EL.vm.STATUS;
      if (this.machine.status === S.RUNNING) this.machine.tick(now);
      const st = this.machine.status;
      if (st !== this.lastStatus) {
        if (st === S.FINISHED) this.note(LG.OK, 'Programme « ' + this.machine.prog.name + ' » terminé');
        else if (st === S.ERROR) this.note(LG.ALERT, 'Erreur dans le programme : ' + this.machine.err);
        this.lastStatus = st;
      }
    }

    rollover(day) {
      this.days.unshift(this.today());
      if (this.days.length > 7) this.days.pop();
      for (const o of this.out) { o.eTodayWh = 0; o.costToday = 0; }
      this.peakToday = 0;
      this.rel.resetSwitchCounters();
      this.dayKey = day;
      this.note(LG.INFO, 'Nouvelle journée : compteurs du jour remis à zéro');
    }

    tick1s(now) {
      // délestage abandonné par le programme : les prises redeviennent pilotables
      if (now - this.lastShedCall > SHED_ABANDON_MS) for (const o of this.out) o.shed = false;
      let dt = this.lastSec < 0 ? 1 : (now - this.lastSec) / 1000;
      if (dt > 5) dt = 5;
      if (dt < 0) dt = 0;
      this.lastSec = now;
      const lt = this.localTime();
      if (lt) {
        if (this.dayKey < 0) this.dayKey = lt.dayKey;
        else if (lt.dayKey !== this.dayKey) this.rollover(lt.dayKey);
      }
      const price = this.priceNow();
      let tot = 0;
      const smp = { t: this.clockValid ? this.epoch : Math.floor(now / 1000), p: [0, 0, 0, 0], temp: this.env.temp, hum: this.env.hum, lum: this.env.lum, pres: this.env.pres ? 1 : 0, relays: this.rel.mask() };
      for (let k = 0; k < NOUT; k++) {
        const o = this.out[k];
        const valid = o.online && !Number.isNaN(o.p);
        const p = valid ? o.p : 0;
        const wh = p * dt / 3600;
        o.eTodayWh += wh;
        o.costToday += wh / 1000 * price;
        tot += p;
        smp.p[k] = p;
        if (this.rel.isOn(k) && valid && o.p <= this.cfg.outlets[k].standbyW) o.idleS += dt; else o.idleS = 0;
        if (valid) this.anom[k].update(o.p, this.cfg.ai.anomalyZ);
        if (valid) {
          const r = this.knn.classifyFull(o.p, o.pf, this.cfg.ai.knnK, this.cfg.ai.knnMaxDist);
          o.appliance = r.id; o.applianceDist = r.dist;
        } else { o.appliance = 0; o.applianceDist = NaN; }
      }
      if (tot > this.peakToday) this.peakToday = tot;
      this.hist.push(smp);
      this.holt.addSecond(tot);
      this.safetyTotal(now);
    }

    safetyTotal(now) {
      if (now < this.safetyHold) return;
      let tot = 0;
      for (const o of this.out) if (o.online && !Number.isNaN(o.rawP)) tot += o.rawP;
      if (tot <= this.cfg.safety.maxTotalW) return;
      let best = -1;
      for (let k = 0; k < NOUT; k++) {
        if (!this.rel.isOn(k) || this.rel.isLatched(k)) continue;
        if (!(this.out[k].rawP > 1)) continue;
        const pk = this.cfg.outlets[k].priority;
        if (best < 0 || pk > this.cfg.outlets[best].priority || (pk === this.cfg.outlets[best].priority && k > best)) best = k;
      }
      if (best < 0) return;
      this.rel.request(best, false, EL.relays.SRC.SAFETY, now);
      this.out[best].shed = false;
      this.safetyHold = now + 5000;
      this.note(LG.ALERT, 'Sécurité : puissance totale ' + Math.round(tot) + ' W > limite ' + Math.round(this.cfg.safety.maxTotalW) + ' W. Prise ' + (best + 1) + ' (' + this.cfg.outlets[best].name + ') coupée.');
      if (this.cfg.hw.buzzerOn) this.io.beep(2);
    }

    shedStep(lim, now) {
      if (!(lim > 0)) return;
      this.lastShedCall = now;
      if (now < this.shedHold) return;
      const SRC = EL.relays.SRC;
      let tot = 0;
      for (const o of this.out) { if (o.shed) continue; if (o.online && !Number.isNaN(o.p)) tot += o.p; }
      if (tot > lim) {
        let best = -1;
        for (let k = 0; k < NOUT; k++) {
          const o = this.out[k];
          if (!this.rel.isOn(k) || this.rel.isLatched(k) || o.shed) continue;
          if (!(o.p > 1)) continue;
          const pk = this.cfg.outlets[k].priority;
          if (best < 0 || pk > this.cfg.outlets[best].priority || (pk === this.cfg.outlets[best].priority && k > best)) best = k;
        }
        if (best < 0) return;
        const o = this.out[best];
        o.shedP = o.p;
        o.shed = true;
        // remise en service récente qui échoue : on attend plus longtemps avant le prochain essai
        o.retryMs = now - o.restoredAt < 60000 ? Math.min(o.retryMs * 2, SHED_RETRY_MAX_MS) : SHED_RETRY_MS;
        o.shedAt = now;
        this.rel.request(best, false, SRC.SHED, now);
        this.shedHold = now + 5000;
        this.note(LG.INFO, 'Délestage : P = ' + Math.round(tot) + ' W > ' + Math.round(lim) + ' W, prise ' + (best + 1) + ' (' + this.cfg.outlets[best].name + ', priorité ' + this.cfg.outlets[best].priority + ') coupée');
      } else {
        let best = -1;
        for (let k = 0; k < NOUT; k++) {
          if (!this.out[k].shed) continue;
          const pk = this.cfg.outlets[k].priority;
          if (best < 0 || pk < this.cfg.outlets[best].priority || (pk === this.cfg.outlets[best].priority && k < best)) best = k;
        }
        if (best < 0) return;
        const o = this.out[best];
        const margin = tot + o.shedP < 0.9 * lim;
        if (margin || (now - o.shedAt >= o.retryMs && tot < 0.7 * lim)) {
          o.shed = false;
          o.restoredAt = now;
          this.rel.request(best, true, SRC.SHED, now);
          this.shedHold = now + 5000;
          this.note(LG.INFO, 'Délestage : ' + (margin ? 'marge suffisante' : 'nouvel essai') + ', prise ' + (best + 1) + ' (' + this.cfg.outlets[best].name + ') rallumée');
        }
      }
    }

    // ------------------------------------------------------------ commandes
    userRelay(k, on, src, now) {
      if (k < 0 || k >= NOUT || !this.cfg.outlets[k].enabled) return EL.relays.RES.INVALID;
      this.out[k].shed = false;
      return this.rel.request(k, on, src, now);
    }
    rearm(k) {
      if (!this.rel.rearm(k)) return false;
      this.out[k].latchReason = '';
      this.note(LG.OK, 'Prise ' + (k + 1) + ' (' + this.cfg.outlets[k].name + ') réarmée');
      return true;
    }
    loadProgram(bc) {
      this.machine.stop();
      this.lastStatus = this.machine.status;
      const err = this.machine.load(bc);
      this.lastStatus = this.machine.status;
      return err;
    }
    startProgram(now, seed) {
      if (!this.machine.loaded) return;
      for (const o of this.out) o.shed = false;
      this.shedHold = 0;
      this.lastShedCall = -1e12;
      this.machine.start(now, seed);
      this.programRuns++;
      this.lastStatus = this.machine.status;
      this.note(LG.OK, 'Programme « ' + this.machine.prog.name + ' » démarré');
    }
    stopProgram() {
      if (this.machine.status === EL.vm.STATUS.RUNNING) {
        this.machine.stop();
        this.note(LG.INFO, 'Programme « ' + this.machine.prog.name + ' » arrêté');
      }
      this.lastStatus = this.machine.status;
    }
    knnTrain(k, label) {
      if (k < 0 || k >= NOUT) return { ok: false, msg: 'prise invalide' };
      const o = this.out[k];
      if (!o.online || o.last5.length < 3) return { ok: false, msg: 'mesures insuffisantes : attendez quelques secondes' };
      let sp = 0, spf = 0;
      for (const x of o.last5) { sp += x.p; spf += x.pf; }
      const p = sp / o.last5.length, pf = spf / o.last5.length;
      if (p < 1) return { ok: false, msg: 'aucun appareil ne consomme sur cette prise (P < 1 W)' };
      if (!label) return { ok: false, msg: "nom d'appareil vide" };
      const id = this.knn.labelId(label, true);
      if (id < 0) return { ok: false, msg: "trop d'appareils différents (16 max)" };
      if (this.knn.samples.length >= EL.ai.Knn.MAX_SAMPLES) {
        let victim = this.knn.samples.findIndex(function (s) { return s.label === id; });
        if (victim < 0) victim = 0;
        this.knn.samples.splice(victim, 1);
      }
      this.knn.samples.push({ label: id, p: p, pf: pf });
      this.note(LG.OK, 'IA : « ' + label + ' » appris sur la prise ' + (k + 1) + ' (' + p.toFixed(1) + ' W, FP ' + pf.toFixed(2) + ')');
      return { ok: true, msg: 'exemple appris : ' + p.toFixed(1) + ' W, FP ' + pf.toFixed(2) };
    }
    today() {
      return { dayKey: this.dayKey, eWh: this.out.map(function (o) { return o.eTodayWh; }), cost: this.out.map(function (o) { return o.costToday; }), peak: this.peakToday };
    }

    // ------------------------------------------------------------ agrégats
    totalP() { let t = 0; for (const o of this.out) if (o.online && !Number.isNaN(o.p)) t += o.p; return t; }
    totalEToday() { let t = 0; for (const o of this.out) t += o.eTodayWh; return t; }
    totalCostToday() { let t = 0; for (const o of this.out) t += o.costToday; return t; }
    co2Today() { return this.totalEToday() / 1000 * this.cfg.tariff.co2; }
    avgVoltage() { let s = 0, n = 0; for (const o of this.out) if (o.online && !Number.isNaN(o.u)) { s += o.u; n++; } return n ? s / n : NaN; }
    offPeakNow() { const lt = this.localTime(); return lt ? EL.config.isOffPeak(this.cfg, lt.h * 60 + lt.m) : false; }
    priceNow() { const lt = this.localTime(); return EL.config.priceAt(this.cfg, lt ? lt.h * 60 + lt.m : 0, !!lt); }
    relaysOn() { let n = 0; for (let k = 0; k < NOUT; k++) if (this.rel.isOn(k)) n++; return n; }

    // ------------------------------------------------------------ interface de la VM
    sensor(q, k) {
      if (k < 1 || k > NOUT) {
        if (this.warnLimited(WK.BADOUTLET, 30000, this.now)) this.note(LG.WARN, 'Programme : la prise ' + k + " n'existe pas (1 à 4)");
        return NaN;
      }
      const o = this.out[k - 1];
      switch (q) {
        case 0: return o.u;
        case 1: return o.i;
        case 2: return o.p;
        case 3: return o.s;
        case 4: return o.q;
        case 5: return o.pf;
        case 6: return o.f;
        case 7: return o.eCounterKWh;
        case 8: return o.eTodayWh;
        case 9: return o.costToday;
        case 10: return this.rel.isOn(k - 1) ? 1 : 0;
        case 11: return o.online ? 1 : 0;
        case 12: return this.rel.isLatched(k - 1) ? 1 : 0;
        case 13: return o.phi;
        case 14: return this.rel.switches(k - 1);
      }
      return NaN;
    }
    gsensor(q) {
      const lt = this.localTime();
      if (q >= 7 && q <= 11 && !lt) {
        if (this.warnLimited(WK.CLOCK, 60000, this.now)) this.note(LG.WARN, "Programme : l'horloge du kit n'est pas réglée (ouvrez l'application pour la synchroniser)");
        return NaN;
      }
      switch (q) {
        case 0: return this.totalP();
        case 1: return this.totalEToday();
        case 2: return this.totalCostToday();
        case 3: return this.env.temp;
        case 4: return this.env.hum;
        case 5: return this.env.lum;
        case 6: return this.cfg.env.pirOn ? (this.env.pres ? 1 : 0) : NaN;
        case 7: return lt.h;
        case 8: return lt.m;
        case 9: return lt.s;
        case 10: return lt.wday;
        case 11: return lt.h * 60 + lt.m;
        case 12: return this.machine.status === EL.vm.STATUS.RUNNING ? (this.now - this.machine.startedAt) / 1000 : 0;
        case 13: return this.offPeakNow() ? 1 : 0;
        case 14: return this.priceNow();
        case 15: return this.avgVoltage();
        case 16: return this.peakToday;
        case 17: return this.co2Today();
        case 18: return this.relaysOn();
      }
      return NaN;
    }
    param(p, idx) { return EL.config.paramGet(this.cfg, p, idx); }
    setParam(p, idx, v) {
      if (!(this.cfg.peda.perms & EL.config.PERM.PARAMS)) {
        if (this.warnLimited(WK.PARAMS, 30000, this.now)) this.note(LG.WARN, "Programme : la modification des paramètres est verrouillée par l'enseignant");
        return;
      }
      const before = EL.config.paramGet(this.cfg, p, idx);
      const r = EL.config.paramSet(this.cfg, p, idx, v);
      if (!r.ok) { if (this.warnLimited(WK.PARAMMSG, 10000, this.now)) this.note(LG.WARN, 'Programme : ' + r.msg); return; }
      const after = EL.config.paramGet(this.cfg, p, idx);
      const name = EL.config.PARAMS[p].name;
      if (r.msg && this.warnLimited(WK.PARAMMSG, 10000, this.now)) this.note(LG.WARN, 'Paramètre « ' + name + ' » : ' + r.msg);
      if (after === before) return;
      if (EL.config.paramIsOutlet(p)) this.note(LG.INFO, 'Paramètre « ' + name + ' » de la prise ' + idx + ' : ' + g6(before) + ' → ' + g6(after));
      else this.note(LG.INFO, 'Paramètre « ' + name + ' » : ' + g6(before) + ' → ' + g6(after));
      if (p === 4) this.applyOutletConfig();
      if (p === 1) this.io.pzemSetAlarm(idx - 1, after);
      this.io.configChanged();
    }
    relay(k, on) {
      if (k === 0) { for (let j = 1; j <= NOUT; j++) this.relay(j, on); return; }
      if (k < 1 || k > NOUT) {
        if (this.warnLimited(WK.BADOUTLET, 30000, this.now)) this.note(LG.WARN, 'Programme : la prise ' + k + " n'existe pas (1 à 4)");
        return;
      }
      if (!this.cfg.outlets[k - 1].enabled) {
        if (this.warnLimited(WK.DISABLED + k - 1, 60000, this.now)) this.note(LG.WARN, 'Programme : la prise ' + k + ' est désactivée');
        return;
      }
      const o = this.out[k - 1];
      if (o.shed) {
        if (on) return; // prise délestée : c'est le délestage qui la rallumera quand la puissance le permettra
        o.shed = false;
      }
      const RES = EL.relays.RES;
      const r = this.rel.request(k - 1, on, EL.relays.SRC.PROGRAM, this.now);
      if (r === RES.LATCHED && this.warnLimited(WK.LATCHED + k - 1, 30000, this.now)) this.note(LG.WARN, 'Prise ' + k + ' verrouillée par une protection : réarmez-la avant de la rallumer');
      else if (r === RES.DELAYED && this.warnLimited(WK.DELAY + k - 1, 30000, this.now)) this.note(LG.INFO, 'Prise ' + k + ' : commutation retardée (délai minimum ' + this.cfg.outlets[k - 1].minSwitchS.toFixed(1) + ' s entre deux commutations)');
    }
    toggle(k) {
      if (k < 1 || k > NOUT) { this.relay(k, true); return; }
      this.relay(k, !this.rel.isOn(k - 1));
    }
    pulse(k, seconds) {
      if (k < 1 || k > NOUT || !this.cfg.outlets[k - 1].enabled) { this.relay(k, true); return; }
      this.out[k - 1].shed = false;
      if (this.rel.isLatched(k - 1)) { this.relay(k, true); return; }
      this.rel.pulse(k - 1, seconds, EL.relays.SRC.PROGRAM, this.now);
    }
    beep(kind) { if (this.cfg.hw.buzzerOn) this.io.beep(kind); }
    alert(msg) { this.note(LG.ALERT, msg); this.io.alertScreen(msg); if (this.cfg.hw.buzzerOn) this.io.beep(0); }
    log(msg, value, hasValue) {
      if (hasValue) this.note(LG.PROG, Number.isNaN(value) ? msg + ' --' : msg + ' ' + g6(value));
      else this.note(LG.PROG, msg);
    }
    screen(msg) { this.io.screenMessage(msg); }
    resetEnergy(k) {
      if (!(this.cfg.peda.perms & EL.config.PERM.RESET_ENERGY)) {
        if (this.warnLimited(WK.RESET, 30000, this.now)) this.note(LG.WARN, "Programme : la remise à zéro des compteurs est réservée à l'enseignant");
        return;
      }
      if (k < 1 || k > NOUT) return;
      this.io.pzemResetEnergy(k - 1);
      this.note(LG.INFO, "Compteur d'énergie de la prise " + k + ' remis à zéro');
    }
    ai(q, a, b) {
      switch (q) {
        case 0: { const k = vmIdx(a); if (k < 1 || k > NOUT) return NaN; return this.hist.avgP(k - 1, clampRound(b, 1, 600)); }
        case 1: return this.hist.avgTotal(clampRound(a, 1, 600));
        case 2: return this.hist.maxTotal(clampRound(a, 1, 600));
        case 3: return this.hist.slopeTotalPerMin(clampRound(a, 10, 600));
        case 4: return this.holt.forecast(a);
        case 5: case 6: case 7: {
          const k = vmIdx(a);
          if (k < 1 || k > NOUT) return NaN;
          if (q === 5) return this.anom[k - 1].flag() ? 1 : 0;
          if (q === 6) return this.out[k - 1].idleS;
          return this.out[k - 1].appliance;
        }
      }
      return NaN;
    }
    shed(limit) { this.shedStep(limit, this.now); }
    clock() {
      const lt = this.localTime();
      return lt ? { valid: true, hour: lt.h, minute: lt.m, dayKey: lt.dayKey } : { valid: false };
    }

    // État normalisé (même structure que celle produite par EL.RealKit à partir du JSON du kit)
    snapshot(now, extra) {
      const m = this.machine;
      const outlets = this.out.map((o, k) => ({
        u: o.u, i: o.i, p: o.p, s: o.s, q: o.q, pf: o.pf, f: o.f, phi: o.phi, eCounter: o.eCounterKWh,
        eToday: o.eTodayWh, costToday: o.costToday, on: this.rel.isOn(k), online: o.online,
        latched: this.rel.isLatched(k), latchReason: o.latchReason, alarm: o.alarm, shed: o.shed,
        switches: this.rel.switches(k), pending: this.rel.hasPending(k),
        pulseLeft: this.rel.pulseEnd(k) > 0 ? Math.max(0, (this.rel.pulseEnd(k) - now) / 1000) : 0,
        idle: o.idleS, anomaly: this.anom[k].flag(), z: this.anom[k].z, appliance: o.appliance, applianceDist: o.applianceDist
      }));
      return Object.assign({
        ts: this.clockValid ? this.epoch : 0, timeValid: this.clockValid, uptime: Math.floor(now / 1000), tz: this.cfg.net.tzMin,
        outlets: outlets,
        env: { temp: this.env.temp, hum: this.env.hum, lum: this.env.lum, pres: this.env.pres, motion: this.env.motion },
        total: { p: this.totalP(), eToday: this.totalEToday(), costToday: this.totalCostToday(), co2: this.co2Today(), peak: this.peakToday, voltage: this.avgVoltage() },
        tariff: { offPeak: this.offPeakNow(), price: this.priceNow() },
        vm: {
          status: m.status, name: m.loaded ? m.prog.name : '', hash: m.loaded ? m.prog.hash : '', error: m.err,
          errScript: m.errScript, errPc: m.errPc, pcs: m.st.map(function (s, i) { return m.scriptPc(i); }),
          vars: m.vars.slice(), runtime: m.status === EL.vm.STATUS.RUNNING ? (now - m.startedAt) / 1000 : 0, instr: m.lastTickInstr
        },
        forecast: { f10: this.holt.forecast(10), f30: this.holt.forecast(30), trend: this.hist.slopeTotalPerMin(120) },
        net: { mode: 'sim', clients: 1, rssi: 0, ws: 1 },
        seq: { log: this.logSeq, cfg: 0, knn: 0, pzem: 0 }, pzemBusy: false
      }, extra || {});
    }
  }

  EL.kitcore = { KitCore, LG, NOUT };
})(typeof globalThis !== 'undefined' ? globalThis : this);

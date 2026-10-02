/* EnergyLab — client du kit réel (API HTTP + WebSocket temps réel)
 * Même interface que EL.SimKit. Normalise le JSON compact envoyé par le firmware. */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  const U = EL.util;

  function n(v) { return v === null || v === undefined ? NaN : v; }

  // JSON compact du firmware (webapi.cpp: buildState) -> objet normalisé
  function normalizeState(j) {
    return {
      ts: j.ts || 0, timeValid: !!j.tv, uptime: j.up || 0, tz: j.tz || 0,
      outlets: (j.o || []).map(function (o) {
        return {
          u: n(o.u), i: n(o.i), p: n(o.p), s: n(o.s), q: n(o.q), pf: n(o.pf), f: n(o.f), phi: n(o.phi),
          eCounter: n(o.ec), eToday: n(o.ed), costToday: n(o.cd), on: !!o.on, online: !!o.ol, latched: !!o.lt,
          latchReason: o.lr || '', alarm: !!o.al, shed: !!o.sh, switches: o.sw || 0, pending: !!o.pd, pulseLeft: n(o.pu),
          idle: n(o.id), anomaly: !!o.an, z: n(o.z), appliance: o.ap || 0, applianceDist: n(o.ad)
        };
      }),
      env: { temp: n(j.env && j.env.T), hum: n(j.env && j.env.H), lum: n(j.env && j.env.L), pres: !!(j.env && j.env.pr), motion: !!(j.env && j.env.mo) },
      total: { p: n(j.tot && j.tot.p), eToday: n(j.tot && j.tot.ed), costToday: n(j.tot && j.tot.cd), co2: n(j.tot && j.tot.co2), peak: n(j.tot && j.tot.pk), voltage: n(j.tot && j.tot.v) },
      tariff: { offPeak: !!(j.tar && j.tar.off), price: n(j.tar && j.tar.pr) },
      vm: {
        status: j.vm ? j.vm.st : 0, name: j.vm ? j.vm.n : '', hash: j.vm ? j.vm.h : '', error: j.vm ? j.vm.e : '',
        errScript: j.vm ? j.vm.es : -1, errPc: j.vm ? j.vm.ep : -1, pcs: j.vm ? j.vm.pc || [] : [],
        vars: j.vm ? (j.vm.v || []).map(n) : [], runtime: j.vm ? j.vm.rt : 0, instr: j.vm ? j.vm.ir : 0
      },
      forecast: { f10: n(j.fc && j.fc.f10), f30: n(j.fc && j.fc.f30), trend: n(j.fc && j.fc.tr) },
      net: { mode: j.net ? j.net.m : '', clients: j.net ? j.net.n : 0, rssi: j.net ? j.net.rs : 0, ws: j.net ? j.net.ws : 0 },
      seq: { log: j.lg || 0, cfg: j.cs || 0, knn: j.ks || 0, pzem: j.ps || 0 }, pzemBusy: !!j.pb
    };
  }

  class RealKit extends U.Emitter {
    constructor(base) {
      super();
      this.kind = 'real';
      this.base = base || '';
      this.ws = null;
      this.connected = false;
      this.lastState = null;
      this.retry = 0;
      this.pollTimer = null;
      this.lastMsg = 0;
      this.closed = false;
    }

    async req(method, path, body, pin, raw) {
      const headers = {};
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (pin) headers['X-Pin'] = pin;
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const to = ctrl ? setTimeout(function () { ctrl.abort(); }, 12000) : null;
      try {
        const r = await fetch(this.base + path, {
          method: method, headers: headers, cache: 'no-store',
          body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
          signal: ctrl ? ctrl.signal : undefined
        });
        if (raw) return r;
        const text = await r.text();
        let j;
        try { j = JSON.parse(text); } catch (e) { j = { ok: r.ok, msg: text }; }
        if (!r.ok && j && typeof j === 'object' && j.ok === undefined) j.ok = false;
        if (j && typeof j === 'object' && !Array.isArray(j)) j.code = r.status;
        return j;
      } catch (e) {
        return { ok: false, msg: 'Kit injoignable (' + (e.name === 'AbortError' ? 'délai dépassé' : e.message) + ')', code: 0 };
      } finally {
        if (to) clearTimeout(to);
      }
    }

    async probe() {
      try {
        const ctrl = new AbortController();
        const to = setTimeout(function () { ctrl.abort(); }, 3500);
        const r = await fetch(this.base + '/api/ping', { cache: 'no-store', signal: ctrl.signal });
        clearTimeout(to);
        return r.ok && (await r.text()).trim() === 'ok';
      } catch (e) { return false; }
    }

    connect() {
      this.closed = false;
      this.openWs();
      const self = this;
      // secours : si le WebSocket ne délivre rien pendant 4 s, interrogation HTTP
      this.pollTimer = setInterval(function () {
        if (Date.now() - self.lastMsg > 4000) self.pollState();
      }, 2000);
      return this.pollState();
    }
    disconnect() {
      this.closed = true;
      if (this.ws) try { this.ws.close(); } catch (e) { /* rien */ }
      if (this.pollTimer) clearInterval(this.pollTimer);
    }
    setConnected(c) {
      if (c !== this.connected) { this.connected = c; this.emit('status', { connected: c }); }
    }
    async pollState() {
      const j = await this.req('GET', '/api/state');
      if (j && j.t === 'st') { this.onState(j); return true; }
      if (Date.now() - this.lastMsg > 6000) this.setConnected(false);
      return false;
    }
    onState(j) {
      this.lastMsg = Date.now();
      this.setConnected(true);
      this.lastState = normalizeState(j);
      this.emit('state', this.lastState);
    }
    openWs() {
      if (this.closed || typeof WebSocket === 'undefined') return;
      let url;
      if (this.base) url = this.base.replace(/^http/, 'ws') + '/ws';
      else url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
      const self = this;
      let ws;
      try { ws = new WebSocket(url); } catch (e) { setTimeout(function () { self.openWs(); }, 3000); return; }
      this.ws = ws;
      ws.onopen = function () { self.retry = 0; };
      ws.onmessage = function (ev) {
        let j;
        try { j = JSON.parse(ev.data); } catch (e) { return; }
        if (j.t === 'st') self.onState(j);
        else if (j.t === 'lg') { self.lastMsg = Date.now(); self.emit('log', { seq: j.s, ts: j.ts, level: j.l, msg: j.m }); }
      };
      ws.onclose = function () {
        self.ws = null;
        if (self.closed) return;
        self.retry = Math.min(self.retry + 1, 6);
        setTimeout(function () { self.openWs(); }, 500 * self.retry);
      };
      ws.onerror = function () { try { ws.close(); } catch (e) { /* rien */ } };
    }

    getInfo() { return this.req('GET', '/api/info'); }
    getConfig(pin) { return this.req('GET', '/api/config', undefined, pin); }
    setConfig(patch, pin) { return this.req('POST', '/api/config', patch, pin); }
    cmd(o, pin) { return this.req('POST', '/api/cmd', o, pin); }
    async sendProgram(bc, ws, opts) {
      opts = opts || {};
      const q = '?start=' + (opts.start === false ? 0 : 1) + '&save=' + (opts.save === false ? 0 : 1) + (opts.autostart !== undefined ? '&autostart=' + (opts.autostart ? 1 : 0) : '');
      const r = await this.req('POST', '/api/program' + q, JSON.stringify(bc), opts.pin);
      if (r.ok && ws && opts.save !== false) await this.req('POST', '/api/program/ws', JSON.stringify(ws), opts.pin);
      return r;
    }
    programCtl(action, value, pin) { return this.req('POST', '/api/program/ctl', { action: action, value: value }, pin); }
    getProgram() { return this.req('GET', '/api/program'); }
    async getProgramWs() {
      const r = await this.req('GET', '/api/program/ws', undefined, undefined, true);
      if (!r || !r.ok) return null;
      try { return await r.json(); } catch (e) { return null; }
    }
    async getHistory(n) {
      const r = await this.req('GET', '/api/history' + (n ? '?n=' + n : ''), undefined, undefined, true);
      if (!r || !r.ok) return [];
      const text = await r.text();
      const rows = U.parseCsv(text);
      const out = [];
      for (let i = 1; i < rows.length; i++) {
        const c = rows[i];
        if (c.length < 10) continue;
        const num = function (x) { return x === '' ? NaN : Number(x); };
        out.push({ t: Number(c[0]), p: [num(c[1]), num(c[2]), num(c[3]), num(c[4])], T: num(c[5]), H: num(c[6]), L: num(c[7]), pr: Number(c[8]), r: Number(c[9]) });
      }
      return out;
    }
    async getLogs(since) {
      const r = await this.req('GET', '/api/logs?since=' + (since || 0));
      return Array.isArray(r) ? r.map(function (e) { return { seq: e.s, ts: e.ts, level: e.l, msg: e.m }; }) : [];
    }
    async getDays() { const r = await this.req('GET', '/api/days'); return Array.isArray(r) ? r : []; }
    getKnn() { return this.req('GET', '/api/knn'); }
    knnOp(o, pin) { return this.req('POST', '/api/knn', o, pin); }
    getPzem() { return this.req('GET', '/api/pzem'); }
    async listFiles(dir) { const r = await this.req('GET', '/api/files?dir=' + dir); return Array.isArray(r) ? r : []; }
    async fetchFile(dir, name) {
      const r = await this.req('GET', '/files/' + dir + '/' + encodeURIComponent(name), undefined, undefined, true);
      return r && r.ok ? r.text() : '';
    }
    fileUrl(dir, name) { return this.base + '/files/' + dir + '/' + encodeURIComponent(name); }
    postEvents(arr) { return this.req('POST', '/api/research/events', arr); }
    postResult(o) { return this.req('POST', '/api/research/result', o); }
  }

  EL.RealKit = RealKit;
  EL.normalizeState = normalizeState;
})(typeof globalThis !== 'undefined' ? globalThis : this);

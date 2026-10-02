/* ---- 00_util.js ---- */
/* EnergyLab — utilitaires communs (DOM, formats, stockage local, événements) */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  const hasDOM = typeof document !== 'undefined';

  // ---------------------------------------------------------------- DOM
  // h('div.card#id', {onclick, style, title, dataset}, [enfants...])
  function h(tag, attrs, children) {
    const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(tag) || [];
    const el = document.createElement(m[1] || 'div');
    (m[2] || '').replace(/([.#])([\w-]+)/g, function (_, t, v) {
      if (t === '.') el.classList.add(v); else el.id = v;
    });
    if (attrs && (Array.isArray(attrs) || typeof attrs !== 'object' || attrs instanceof Node)) {
      children = attrs;
      attrs = null;
    }
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else if (k === 'class') el.className = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    append(el, children);
    return el;
  }
  function append(el, children) {
    if (children === undefined || children === null || children === false) return el;
    if (!Array.isArray(children)) children = [children];
    for (const c of children) {
      if (c === undefined || c === null || c === false) continue;
      if (Array.isArray(c)) append(el, c);
      else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }
  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }
  function svg(tag, attrs, children) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    let style = '';
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v === undefined || v === null) continue;
        // les variables CSS ne sont pas fiables dans les attributs de présentation SVG : on passe par style
        if (typeof v === 'string' && v.indexOf('var(') >= 0 && k !== 'style') style += k + ':' + v + ';';
        else if (k === 'style') style += v;
        else el.setAttribute(k, v);
      }
      if (style) el.setAttribute('style', style);
    }
    if (children) for (const c of [].concat(children)) if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    return el;
  }

  // ---------------------------------------------------------------- formats
  const NB = ' '; // espace fine insécable
  function fmt(v, dec, unit) {
    if (v === null || v === undefined || Number.isNaN(v) || !Number.isFinite(v)) return '--' + (unit ? NB + unit : '');
    const s = Number(v).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return unit ? s + NB + unit : s;
  }
  // puissance : W ou kW
  function fmtP(w) {
    if (w === null || w === undefined || Number.isNaN(w)) return '--' + NB + 'W';
    if (Math.abs(w) >= 10000) return fmt(w / 1000, 1, 'kW');
    if (Math.abs(w) >= 100) return fmt(w, 0, 'W');
    return fmt(w, 1, 'W');
  }
  // énergie à partir de Wh
  function fmtE(wh) {
    if (wh === null || wh === undefined || Number.isNaN(wh)) return '--' + NB + 'Wh';
    if (Math.abs(wh) >= 1000) return fmt(wh / 1000, 3, 'kWh');
    if (Math.abs(wh) >= 10) return fmt(wh, 1, 'Wh');
    return fmt(wh, 2, 'Wh');
  }
  function fmtMoney(v, cur) { return fmt(v, v !== null && Math.abs(v) < 1 ? 3 : 2, cur || ''); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDuration(s) {
    if (s === null || s === undefined || Number.isNaN(s)) return '--';
    s = Math.round(s);
    if (s < 60) return s + NB + 's';
    if (s < 3600) return Math.floor(s / 60) + NB + 'min' + (s % 60 ? NB + pad2(s % 60) + NB + 's' : '');
    return Math.floor(s / 3600) + NB + 'h' + NB + pad2(Math.floor((s % 3600) / 60));
  }
  function fmtClock(epoch, tzMin) {
    if (!epoch) return '--:--';
    const d = new Date((epoch + (tzMin || 0) * 60) * 1000);
    return pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes());
  }
  function fmtDateTime(epoch, tzMin) {
    if (!epoch) return '';
    const d = new Date((epoch + (tzMin || 0) * 60) * 1000);
    return pad2(d.getUTCDate()) + '/' + pad2(d.getUTCMonth() + 1) + ' ' + pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ':' + pad2(d.getUTCSeconds());
  }
  function dayKeyToDate(dayKey) {
    const d = new Date(dayKey * 86400000);
    return pad2(d.getUTCDate()) + '/' + pad2(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear();
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  // garde la fin d'un historique à partir du dernier saut d'horloge (mise à l'heure du kit)
  function contiguousTail(list, maxGap) {
    maxGap = maxGap || 120;
    let start = 0;
    for (let i = 1; i < list.length; i++) {
      const d = list[i].t - list[i - 1].t;
      if (d <= 0 || d > maxGap) start = i;
    }
    return start ? list.slice(start) : list;
  }

  // ---------------------------------------------------------------- stockage local (jamais bloquant)
  const store = {
    get(key, def) {
      try {
        const v = root.localStorage && root.localStorage.getItem('elab.' + key);
        return v === null || v === undefined ? def : JSON.parse(v);
      } catch (e) { return def; }
    },
    set(key, val) {
      try { if (root.localStorage) root.localStorage.setItem('elab.' + key, JSON.stringify(val)); return true; } catch (e) { return false; }
    },
    del(key) { try { if (root.localStorage) root.localStorage.removeItem('elab.' + key); } catch (e) { /* rien */ } }
  };
  const session = {
    get(key, def) {
      try { const v = root.sessionStorage && root.sessionStorage.getItem('elab.' + key); return v === null || v === undefined ? def : JSON.parse(v); } catch (e) { return def; }
    },
    set(key, val) { try { if (root.sessionStorage) root.sessionStorage.setItem('elab.' + key, JSON.stringify(val)); } catch (e) { /* rien */ } },
    del(key) { try { if (root.sessionStorage) root.sessionStorage.removeItem('elab.' + key); } catch (e) { /* rien */ } }
  };

  // ---------------------------------------------------------------- événements
  class Emitter {
    constructor() { this._h = {}; }
    on(ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); return () => this.off(ev, fn); }
    off(ev, fn) { const a = this._h[ev]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } }
    emit(ev, data) {
      const a = this._h[ev];
      if (!a) return;
      for (const fn of a.slice()) {
        try { fn(data); } catch (e) { if (root.console) console.error('[EL] ' + ev, e); }
      }
    }
  }

  // ---------------------------------------------------------------- divers
  function download(filename, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function csvEscape(v) {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(rows, sep) {
    sep = sep || ';';
    return '﻿' + rows.map(function (r) { return r.map(csvEscape).join(sep); }).join('\r\n');
  }
  function parseCsv(text) {
    const rows = [];
    let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',' || c === ';') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c !== '\r' && c !== '﻿') cur += c;
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function debounce(fn, ms) {
    let t = null;
    return function () {
      const args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }
  // Générateur pseudo-aléatoire reproductible (simulations)
  function rng(seed) {
    let x = (seed >>> 0) || 0x12345678;
    return function () {
      x ^= x << 13; x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5; x >>>= 0;
      return x / 4294967296;
    };
  }
  function gauss(r) {
    const u = Math.max(1e-12, r()), v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  EL.util = {
    h, append, clear, $, $$, svg, fmt, fmtP, fmtE, fmtMoney, fmtDuration, fmtClock, fmtDateTime, dayKeyToDate,
    pad2, escapeHtml, clamp, contiguousTail, store, session, Emitter, download, toCsv, parseCsv, csvEscape, fnv1a, uid, debounce,
    rng, gauss, hasDOM, NB
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ---- 30_vm.js ---- */
/* EnergyLab — machine virtuelle JavaScript (bytecode v1)
 * Copie conforme de firmware/src/vm.cpp : toute modification doit être reportée.
 * Spécification : docs/specs/bytecode.md
 */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};

  const OP = {
    END: 0, PUSH: 1, LOAD: 2, STORE: 3, JMP: 4, JZ: 5, JNZ: 6, WAIT: 7, YIELD: 8, POP: 9,
    ADD: 10, SUB: 11, MUL: 12, DIV: 13, MOD: 14, NEG: 15,
    LT: 16, LE: 17, GT: 18, GE: 19, EQ: 20, NE: 21, AND: 22, OR: 23, NOT: 24,
    FN: 25, MIN: 26, MAX: 27, RAND: 28, BETWEEN: 29,
    SENS: 30, SENSG: 31, PARGET: 32, PARSET: 33,
    RELAY: 34, TOGGLE: 35, PULSE: 36, BEEP: 37, ALERT: 38, LOG: 39, LOGV: 40, SCREEN: 41,
    RESETE: 42, AI: 43, SHED: 44, STOP: 45, COUNT: 46
  };
  const ST = { START: 0, EVERY: 1, WHEN: 2, AT: 3, BUTTON: 4 };
  const STATUS = { IDLE: 0, RUNNING: 1, FINISHED: 2, ERROR: 3, STOPPED: 4 };
  const LIM = {
    MAX_CODE: 4096, MAX_SCRIPTS: 32, MAX_VARS: 64, MAX_STRS: 64, MAX_STR_LEN: 80,
    STACK_SIZE: 64, SOFT_YIELD: 300, HARD_LIMIT: 20000, COND_BUDGET: 1000
  };

  const ONE_ARG = new Set([OP.PUSH, OP.LOAD, OP.STORE, OP.JMP, OP.JZ, OP.JNZ, OP.FN, OP.SENS,
    OP.SENSG, OP.PARGET, OP.PARSET, OP.BEEP, OP.ALERT, OP.LOG, OP.LOGV, OP.SCREEN, OP.AI, OP.STOP]);

  function opArgCount(op) { return ONE_ARG.has(op) ? 1 : 0; }
  function aiArity(q) {
    if (q === 0) return 2;
    if (q >= 1 && q <= 7) return 1;
    return -1;
  }
  function isInt(v) { return Number.isFinite(v) && Math.floor(v) === v; }
  function validParam(p) { return (p >= 0 && p <= 5) || (p >= 10 && p <= 23); }
  function truthy(v) { return v !== 0 && !Number.isNaN(v); }
  function toIndex(v) {
    if (!Number.isFinite(v) || v > 1e6 || v < -1e6) return -1;
    return Math.floor(v + 0.5);
  }
  function utf8Len(s) {
    let n = 0;
    for (const ch of s) {
      const c = ch.codePointAt(0);
      n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
    }
    return n;
  }

  function parseCode(text) {
    const out = [];
    const parts = String(text || '').split(/[\s,]+/).filter(Boolean);
    for (const p of parts) {
      const v = Number(p);
      if (!Number.isFinite(v)) throw new Error('code invalide');
      out.push(v);
      if (out.length > LIM.MAX_CODE) throw new Error('programme trop long');
    }
    return out;
  }

  // Normalise un programme (JSON du format elab-bc) en objet exécutable
  function normalize(bc) {
    const code = Array.isArray(bc.code) ? bc.code.slice() : parseCode(bc.code);
    return {
      name: bc.name || 'Programme',
      code: code,
      scripts: (bc.scripts || []).map(function (s) {
        return {
          type: s.type | 0, entry: s.entry | 0, cond: s.cond === undefined ? -1 : s.cond | 0,
          period: s.period === undefined ? 1 : +s.period, h: s.h | 0, m: s.m | 0,
          btn: s.btn === undefined ? 1 : s.btn | 0
        };
      }),
      vars: (bc.vars || []).slice(),
      strs: (bc.strs || []).slice(),
      hash: bc.hash || ''
    };
  }

  // Renvoie '' si valide, sinon le message d'erreur (mêmes messages que le C++)
  function validate(p) {
    const c = p.code;
    const n = c.length;
    if (n === 0) return 'programme vide';
    if (n > LIM.MAX_CODE) return 'programme trop long';
    if (p.scripts.length === 0) return "aucun script (ajoutez un bloc d'événement)";
    if (p.scripts.length > LIM.MAX_SCRIPTS) return 'trop de scripts';
    if (p.vars.length > LIM.MAX_VARS) return 'trop de variables';
    if (p.strs.length > LIM.MAX_STRS) return 'trop de textes';
    for (const s of p.strs) if (utf8Len(s) > LIM.MAX_STR_LEN * 2) return 'texte trop long';
    const boundary = new Uint8Array(n);
    let pc = 0;
    while (pc < n) {
      if (!isInt(c[pc])) return 'opcode invalide';
      const op = c[pc];
      if (op < 0 || op >= OP.COUNT) return 'opcode inconnu';
      boundary[pc] = 1;
      const na = opArgCount(op);
      if (na > 0 && pc + na >= n) return 'opérande manquant';
      if (na === 1) {
        const a = c[pc + 1];
        const ia = isInt(a) ? a : -1;
        switch (op) {
          case OP.PUSH: break;
          case OP.LOAD: case OP.STORE: if (ia < 0 || ia >= p.vars.length) return 'variable invalide'; break;
          case OP.JMP: case OP.JZ: case OP.JNZ: if (ia < 0 || ia >= n) return 'saut invalide'; break;
          case OP.FN: if (ia < 0 || ia > 5) return 'fonction invalide'; break;
          case OP.SENS: if (ia < 0 || ia > 14) return 'grandeur invalide'; break;
          case OP.SENSG: if (ia < 0 || ia > 18) return 'grandeur invalide'; break;
          case OP.PARGET: case OP.PARSET: if (!validParam(ia)) return 'paramètre invalide'; break;
          case OP.BEEP: if (ia < 0 || ia > 3) return 'bip invalide'; break;
          case OP.ALERT: case OP.LOG: case OP.LOGV: case OP.SCREEN:
            if (ia < 0 || ia >= p.strs.length) return 'texte invalide'; break;
          case OP.AI: if (aiArity(ia) < 0) return 'fonction IA invalide'; break;
          case OP.STOP: if (ia < 0 || ia > 1) return 'arrêt invalide'; break;
          default: break;
        }
      }
      pc += 1 + na;
    }
    pc = 0;
    while (pc < n) {
      const op = c[pc];
      const na = opArgCount(op);
      if ((op === OP.JMP || op === OP.JZ || op === OP.JNZ) && !boundary[c[pc + 1]]) {
        return "saut au milieu d'une instruction";
      }
      pc += 1 + na;
    }
    for (const d of p.scripts) {
      if (d.type < ST.START || d.type > ST.BUTTON) return 'type de script invalide';
      if (d.entry < 0 || d.entry >= n || !boundary[d.entry]) return 'entrée de script invalide';
      if (d.type === ST.EVERY && !(d.period >= 0.1 && d.period <= 86400)) return 'période invalide';
      if (d.type === ST.WHEN && (d.cond < 0 || d.cond >= n || !boundary[d.cond])) return 'condition invalide';
      if (d.type === ST.AT && (d.h < 0 || d.h > 23 || d.m < 0 || d.m > 59)) return 'heure invalide';
      if (d.type === ST.BUTTON && (d.btn < 1 || d.btn > 4)) return 'bouton invalide';
    }
    return '';
  }

  class VmError extends Error {}

  class Machine {
    constructor(hal) {
      this.hal = hal;
      this.prog = null;
      this.loaded = false;
      this.vars = [];
      this.st = [];
      this.status = STATUS.IDLE;
      this.err = '';
      this.errScript = -1;
      this.errPc = -1;
      this.rng = 1;
      this.startedAt = 0;
      this.now = 0;
      this.tickInstr = 0;
      this.lastTickInstr = 0;
      this.hasTriggers = false;
    }

    load(bc) {
      const p = normalize(bc);
      const e = validate(p);
      if (e) return e;
      this.prog = p;
      this.vars = new Array(p.vars.length).fill(0);
      this.st = p.scripts.map(function () { return Machine.newState(); });
      this.hasTriggers = p.scripts.some(function (s) { return s.type !== ST.START; });
      this.loaded = true;
      this.status = STATUS.IDLE;
      this.err = '';
      this.errScript = this.errPc = -1;
      return '';
    }

    static newState() {
      return { running: false, pc: 0, wakeAt: 0, stack: [], nextFire: 0, prevCond: false, lastDay: -1, pendingBtn: false };
    }

    start(nowMs, seed) {
      if (!this.loaded) return;
      for (let i = 0; i < this.vars.length; i++) this.vars[i] = 0;
      this.rng = (seed >>> 0) || 0x9E3779B9;
      this.err = '';
      this.errScript = this.errPc = -1;
      this.startedAt = nowMs;
      this.now = nowMs;
      this.status = STATUS.RUNNING;
      for (let i = 0; i < this.st.length; i++) {
        const s = Machine.newState();
        s.nextFire = nowMs;
        this.st[i] = s;
      }
      for (let i = 0; i < this.st.length; i++) {
        if (this.prog.scripts[i].type === ST.START) this.startScript(i, nowMs);
      }
    }

    stop() {
      for (const s of this.st) { s.running = false; s.stack.length = 0; }
      if (this.status === STATUS.RUNNING) this.status = STATUS.STOPPED;
    }

    pressButton(b) {
      if (this.status !== STATUS.RUNNING) return;
      for (let i = 0; i < this.st.length; i++) {
        const d = this.prog.scripts[i];
        if (d.type === ST.BUTTON && d.btn === b) this.st[i].pendingBtn = true;
      }
    }

    scriptPc(i) { const s = this.st[i]; return s && s.running ? s.pc : -1; }

    startScript(i, now) {
      const s = this.st[i];
      s.running = true;
      s.pc = this.prog.scripts[i].entry;
      s.stack.length = 0;
      s.wakeAt = now;
    }

    anyRunning() { return this.st.some(function (s) { return s.running; }); }

    fail(script, pc, msg) {
      this.status = STATUS.ERROR;
      this.err = msg;
      this.errScript = script;
      this.errPc = pc;
      for (const s of this.st) { s.running = false; s.stack.length = 0; }
    }

    rnd(a, b) {
      let x = this.rng;
      x ^= x << 13; x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5; x >>>= 0;
      this.rng = x;
      const u = x / 4294967296;
      const lo = a < b ? a : b;
      const hi = a < b ? b : a;
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) return NaN;
      if (Math.floor(lo) === lo && Math.floor(hi) === hi) return lo + Math.floor(u * (hi - lo + 1));
      return lo + u * (hi - lo);
    }

    tick(now) {
      if (this.status !== STATUS.RUNNING) return;
      this.now = now;
      this.tickInstr = 0;
      const hal = this.hal;
      for (let i = 0; i < this.st.length; i++) {
        const d = this.prog.scripts[i];
        const s = this.st[i];
        switch (d.type) {
          case ST.EVERY:
            if (now >= s.nextFire) {
              if (!s.running) this.startScript(i, now);
              const per = d.period * 1000;
              while (s.nextFire <= now) s.nextFire += per;
            }
            break;
          case ST.WHEN: {
            const r = this.evalCond(i);
            if (r === null) return;
            const c = truthy(r);
            if (c && !s.prevCond && !s.running) this.startScript(i, now);
            s.prevCond = c;
            break;
          }
          case ST.AT: {
            const ck = hal.clock();
            if (ck && ck.valid && ck.hour === d.h && ck.minute === d.m && ck.dayKey !== s.lastDay) {
              s.lastDay = ck.dayKey;
              if (!s.running) this.startScript(i, now);
            }
            break;
          }
          case ST.BUTTON:
            if (s.pendingBtn) {
              s.pendingBtn = false;
              if (!s.running) this.startScript(i, now);
            }
            break;
          default: break;
        }
        if (this.status !== STATUS.RUNNING) return;
      }
      for (let i = 0; i < this.st.length; i++) {
        const s = this.st[i];
        if (s.running && s.wakeAt <= now) {
          this.runScript(i, now);
          if (this.status !== STATUS.RUNNING) break;
        }
      }
      this.lastTickInstr = this.tickInstr;
      if (this.status === STATUS.RUNNING && !this.hasTriggers && !this.anyRunning()) this.status = STATUS.FINISHED;
    }

    // opérations binaires communes
    static binop(m, op, a, b) {
      switch (op) {
        case OP.ADD: return a + b;
        case OP.SUB: return a - b;
        case OP.MUL: return a * b;
        case OP.DIV: return b === 0 ? 0 : a / b;
        case OP.MOD: return b === 0 ? 0 : a - b * Math.floor(a / b);
        case OP.LT: return a < b ? 1 : 0;
        case OP.LE: return a <= b ? 1 : 0;
        case OP.GT: return a > b ? 1 : 0;
        case OP.GE: return a >= b ? 1 : 0;
        case OP.EQ: return a === b ? 1 : 0;
        case OP.NE: return a !== b ? 1 : 0;
        case OP.AND: return (truthy(a) && truthy(b)) ? 1 : 0;
        case OP.OR: return (truthy(a) || truthy(b)) ? 1 : 0;
        case OP.MIN: return a < b ? a : b;
        case OP.MAX: return a > b ? a : b;
        case OP.RAND: return m.rnd(a, b);
      }
      return 0;
    }

    static fn(f, a) {
      switch (f) {
        case 0: return Math.abs(a);
        case 1: return Math.floor(a + 0.5);
        case 2: return Math.floor(a);
        case 3: return Math.ceil(a);
        case 4: return Math.sqrt(a);
        default: return a * a;
      }
    }

    // Renvoie la valeur de la condition, ou null en cas d'erreur
    evalCond(idx) {
      const code = this.prog.code;
      const n = code.length;
      const stack = [];
      let pc = this.prog.scripts[idx].cond;
      let budget = 0;
      const hal = this.hal;
      const need = (k) => { if (stack.length < k) throw new VmError('pile vide'); };
      const push = (v) => { if (stack.length >= LIM.STACK_SIZE) throw new VmError('pile pleine'); stack.push(v); };
      try {
        for (;;) {
          if (pc < 0 || pc >= n) throw new VmError('adresse invalide');
          if (++budget > LIM.COND_BUDGET) throw new VmError('condition trop longue');
          this.tickInstr++;
          const op = code[pc];
          const na = opArgCount(op);
          const arg = na ? code[pc + 1] : 0;
          let next = pc + 1 + na;
          switch (op) {
            case OP.END: return stack.length > 0 ? stack[stack.length - 1] : 0;
            case OP.PUSH: push(arg); break;
            case OP.LOAD: push(this.vars[arg]); break;
            case OP.JMP: next = arg; break;
            case OP.JZ: { need(1); const c = stack.pop(); if (!truthy(c)) next = arg; break; }
            case OP.JNZ: { need(1); const c = stack.pop(); if (truthy(c)) next = arg; break; }
            case OP.POP: need(1); stack.pop(); break;
            case OP.ADD: case OP.SUB: case OP.MUL: case OP.DIV: case OP.MOD:
            case OP.LT: case OP.LE: case OP.GT: case OP.GE: case OP.EQ: case OP.NE:
            case OP.AND: case OP.OR: case OP.MIN: case OP.MAX: case OP.RAND: {
              need(2);
              const b = stack.pop();
              const a = stack.pop();
              push(Machine.binop(this, op, a, b));
              break;
            }
            case OP.NEG: need(1); stack[stack.length - 1] = -stack[stack.length - 1]; break;
            case OP.NOT: need(1); stack[stack.length - 1] = truthy(stack[stack.length - 1]) ? 0 : 1; break;
            case OP.FN: need(1); stack[stack.length - 1] = Machine.fn(arg, stack[stack.length - 1]); break;
            case OP.BETWEEN: {
              need(3);
              const b = stack.pop(); const a = stack.pop(); const x = stack.pop();
              const lo = a < b ? a : b; const hi = a < b ? b : a;
              push((x >= lo && x <= hi) ? 1 : 0);
              break;
            }
            case OP.SENS: { need(1); const k = toIndex(stack.pop()); push(hal.sensor(arg, k)); break; }
            case OP.SENSG: push(hal.gsensor(arg)); break;
            case OP.PARGET: { need(1); const k = toIndex(stack.pop()); push(hal.param(arg, k)); break; }
            case OP.AI: {
              const ar = aiArity(arg);
              need(ar);
              let a = 0, b = 0;
              if (ar === 2) { b = stack.pop(); a = stack.pop(); } else { a = stack.pop(); }
              push(hal.ai(arg, a, b));
              break;
            }
            default: throw new VmError('bloc non autorisé dans une condition');
          }
          pc = next;
        }
      } catch (e) {
        if (!(e instanceof VmError)) throw e;
        this.fail(idx, pc, e.message);
        return null;
      }
    }

    runScript(idx, now) {
      const s = this.st[idx];
      const code = this.prog.code;
      const n = code.length;
      const hal = this.hal;
      const stack = s.stack;
      let executed = 0;
      let pc = s.pc;
      const need = (k) => { if (stack.length < k) throw new VmError('pile vide'); };
      const push = (v) => { if (stack.length >= LIM.STACK_SIZE) throw new VmError('pile pleine'); stack.push(v); };
      try {
        for (;;) {
          pc = s.pc;
          if (pc < 0 || pc >= n) throw new VmError('adresse invalide');
          executed++;
          if (++this.tickInstr > LIM.HARD_LIMIT) throw new VmError("trop d'instructions dans un tic (boucle sans attente ?)");
          const op = code[pc];
          const na = opArgCount(op);
          const arg = na ? code[pc + 1] : 0;
          let next = pc + 1 + na;
          switch (op) {
            case OP.END: s.running = false; stack.length = 0; return;
            case OP.PUSH: push(arg); break;
            case OP.LOAD: push(this.vars[arg]); break;
            case OP.STORE: need(1); this.vars[arg] = stack.pop(); break;
            case OP.JMP: next = arg; break;
            case OP.JZ: { need(1); const c = stack.pop(); if (!truthy(c)) next = arg; break; }
            case OP.JNZ: { need(1); const c = stack.pop(); if (truthy(c)) next = arg; break; }
            case OP.WAIT: {
              need(1);
              let sec = stack.pop();
              if (!(sec > 0)) sec = 0;
              if (sec > 604800) sec = 604800;
              s.wakeAt = now + sec * 1000;
              s.pc = next;
              return;
            }
            case OP.YIELD:
              if (executed >= LIM.SOFT_YIELD) { s.wakeAt = now; s.pc = next; return; }
              break;
            case OP.POP: need(1); stack.pop(); break;
            case OP.ADD: case OP.SUB: case OP.MUL: case OP.DIV: case OP.MOD:
            case OP.LT: case OP.LE: case OP.GT: case OP.GE: case OP.EQ: case OP.NE:
            case OP.AND: case OP.OR: case OP.MIN: case OP.MAX: case OP.RAND: {
              need(2);
              const b = stack.pop();
              const a = stack.pop();
              push(Machine.binop(this, op, a, b));
              break;
            }
            case OP.NEG: need(1); stack[stack.length - 1] = -stack[stack.length - 1]; break;
            case OP.NOT: need(1); stack[stack.length - 1] = truthy(stack[stack.length - 1]) ? 0 : 1; break;
            case OP.FN: need(1); stack[stack.length - 1] = Machine.fn(arg, stack[stack.length - 1]); break;
            case OP.BETWEEN: {
              need(3);
              const b = stack.pop(); const a = stack.pop(); const x = stack.pop();
              const lo = a < b ? a : b; const hi = a < b ? b : a;
              push((x >= lo && x <= hi) ? 1 : 0);
              break;
            }
            case OP.SENS: { need(1); const k = toIndex(stack.pop()); push(hal.sensor(arg, k)); break; }
            case OP.SENSG: push(hal.gsensor(arg)); break;
            case OP.PARGET: { need(1); const k = toIndex(stack.pop()); push(hal.param(arg, k)); break; }
            case OP.PARSET: { need(2); const v = stack.pop(); const k = toIndex(stack.pop()); hal.setParam(arg, k, v); break; }
            case OP.RELAY: { need(2); const on = stack.pop(); const k = toIndex(stack.pop()); hal.relay(k, truthy(on)); break; }
            case OP.TOGGLE: { need(1); const k = toIndex(stack.pop()); hal.toggle(k); break; }
            case OP.PULSE: { need(2); const sec = stack.pop(); const k = toIndex(stack.pop()); hal.pulse(k, sec); break; }
            case OP.BEEP: hal.beep(arg); break;
            case OP.ALERT: hal.alert(this.prog.strs[arg]); break;
            case OP.LOG: hal.log(this.prog.strs[arg], 0, false); break;
            case OP.LOGV: { need(1); const v = stack.pop(); hal.log(this.prog.strs[arg], v, true); break; }
            case OP.SCREEN: hal.screen(this.prog.strs[arg]); break;
            case OP.RESETE: { need(1); const k = toIndex(stack.pop()); hal.resetEnergy(k); break; }
            case OP.AI: {
              const ar = aiArity(arg);
              need(ar);
              let a = 0, b = 0;
              if (ar === 2) { b = stack.pop(); a = stack.pop(); } else { a = stack.pop(); }
              push(hal.ai(arg, a, b));
              break;
            }
            case OP.SHED: { need(1); hal.shed(stack.pop()); break; }
            case OP.STOP:
              if (arg === 1) {
                for (const t of this.st) { t.running = false; t.stack.length = 0; }
                this.status = STATUS.FINISHED;
                return;
              }
              s.running = false;
              stack.length = 0;
              return;
            default:
              throw new VmError('instruction inconnue');
          }
          s.pc = next;
          if (this.status !== STATUS.RUNNING) return;
        }
      } catch (e) {
        if (!(e instanceof VmError)) throw e;
        this.fail(idx, pc, e.message);
      }
    }
  }

  EL.vm = { OP, ST, STATUS, LIM, opArgCount, aiArity, truthy, toIndex, parseCode, normalize, validate, Machine };
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ---- 31_config.js ---- */
/* EnergyLab — configuration du kit et paramètres (copie de firmware/src/config.cpp) */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};

  const PERM = { RELAY: 1, PARAMS: 2, PROGRAM: 4, RESET_ENERGY: 8, KNN: 16, REARM: 32 };

  function defaults(kitId) {
    const names = ['Salon', 'Cuisine', 'Chambre', 'Bureau'];
    const icons = ['lamp', 'kettle', 'heater', 'laptop'];
    const prio = [2, 1, 4, 3];
    return {
      kitName: 'Kit EnergyLab',
      outlets: names.map(function (n, k) {
        return { name: n, icon: icons[k], enabled: true, maxPower: 2300, pzemAlarm: 2300, priority: prio[k], bootState: 0, minSwitchS: 2, standbyW: 3, ctTurns: 1, calU: 1, calI: 1 };
      }),
      net: { wifiMode: 0, staSsid: '', staPass: '', apSsid: 'EnergyLab-' + (kitId || 'SIMU'), apPass: 'energie123', apAlways: true, hostname: 'energylab', tzMin: 60, tzAuto: true },
      tariff: { priceHP: 1.2, priceHC: 0.9, hpHc: false, hcStart: 22 * 60, hcEnd: 6 * 60, currency: 'DH', co2: 600, contractW: 3000 },
      measure: { sampleMs: 1000, smoothN: 1 },
      env: { tempSet: 20, tempHyst: 0.5, lightThr: 30, presenceS: 60, dhtOn: true, ldrOn: true, pirOn: true, ldrInvert: false },
      hw: { oledType: 0, buzzerOn: true, relayActiveLow: true },
      safety: { maxTotalW: 2300, hardMaxOutletW: 2300, minSwitchFloorS: 1 },
      ai: { anomalyZ: 4, knnK: 3, knnMaxDist: 2 },
      peda: { pin: '1234', perms: PERM.RELAY | PERM.PARAMS | PERM.PROGRAM | PERM.KNN | PERM.REARM, scaffold: 1, progAutostart: false },
      mqtt: { on: false, host: '', port: 1883, user: '', pass: '', base: 'energylab' }
    };
  }

  // Bornes des champs (pour la mise à jour partielle, comme configFromJson en C++)
  function lim(c) {
    return {
      outlet: { maxPower: [10, c.safety.hardMaxOutletW], pzemAlarm: [1, 23000, 1], priority: [1, 4, 1], bootState: [0, 2, 1], minSwitchS: [c.safety.minSwitchFloorS, 600], standbyW: [0, 200], ctTurns: [1, 10, 1], calU: [0.5, 1.5], calI: [0.5, 1.5] },
      tariff: { priceHP: [0, 100], priceHC: [0, 100], hcStart: [0, 1439, 1], hcEnd: [0, 1439, 1], co2: [0, 2000], contractW: [100, 12000] },
      measure: { sampleMs: [1000, 10000, 1], smoothN: [1, 10, 1] },
      env: { tempSet: [5, 35], tempHyst: [0.1, 5], lightThr: [0, 100], presenceS: [5, 3600, 1] },
      hw: { oledType: [0, 2, 1] },
      safety: { maxTotalW: [100, 3680], hardMaxOutletW: [10, 3680], minSwitchFloorS: [0.5, 60] },
      ai: { anomalyZ: [2, 10], knnK: [1, 7, 1], knnMaxDist: [0.5, 20] },
      peda: { perms: [0, 63, 1], scaffold: [0, 2, 1] },
      net: { wifiMode: [0, 1, 1], tzMin: [-720, 840, 1] },
      mqtt: { port: [1, 65535, 1] }
    };
  }

  function applyField(dst, key, v, bounds) {
    if (v === undefined || v === null) return false;
    const cur = dst[key];
    if (typeof cur === 'boolean') { if (typeof v !== 'boolean' || v === cur) return false; dst[key] = v; return true; }
    if (typeof cur === 'string') { if (typeof v !== 'string' || v === '********' || v === cur) return false; dst[key] = v; return true; }
    if (typeof cur === 'number') {
      let x = Number(v);
      if (Number.isNaN(x)) return false;
      if (bounds) {
        if (bounds[2]) x = Math.round(x);
        x = Math.min(bounds[1], Math.max(bounds[0], x));
      }
      if (x === cur) return false;
      dst[key] = x;
      return true;
    }
    return false;
  }

  // Mise à jour partielle ; renvoie true si un réglage réseau a changé
  function merge(c, patch) {
    let net = false;
    if (!patch) return false;
    const L = lim(c);
    if (typeof patch.kitName === 'string') c.kitName = patch.kitName;
    if (Array.isArray(patch.outlets)) {
      patch.outlets.forEach(function (o, k) {
        if (k >= 4 || !o) return;
        for (const key of Object.keys(c.outlets[k])) applyField(c.outlets[k], key, o[key], L.outlet[key]);
      });
    }
    for (const g of ['net', 'tariff', 'measure', 'env', 'hw', 'safety', 'ai', 'peda', 'mqtt']) {
      if (!patch[g]) continue;
      for (const key of Object.keys(c[g])) {
        if (g === 'peda' && key === 'pin' && typeof patch.peda.pin === 'string' && (patch.peda.pin.length < 4 || patch.peda.pin.length > 8)) continue;
        const changed = applyField(c[g], key, patch[g][key], L[g] && L[g][key]);
        if (changed && g === 'net' && key !== 'tzMin' && key !== 'tzAuto') net = true;
      }
    }
    for (const o of c.outlets) {
      if (o.maxPower > c.safety.hardMaxOutletW) o.maxPower = c.safety.hardMaxOutletW;
      if (o.minSwitchS < c.safety.minSwitchFloorS) o.minSwitchS = c.safety.minSwitchFloorS;
    }
    return net;
  }

  function clone(c) { return JSON.parse(JSON.stringify(c)); }
  function masked(c) {
    const m = clone(c);
    if (m.net.staPass) m.net.staPass = '********';
    if (m.net.apPass) m.net.apPass = '********';
    if (m.peda.pin) m.peda.pin = '********';
    if (m.mqtt.pass) m.mqtt.pass = '********';
    return m;
  }

  // ---------------------------------------------------------------- paramètres (bytecode §7)
  const PARAMS = {
    0: { name: 'puissance max', unit: 'W', outlet: true, get: function (c, k) { return c.outlets[k].maxPower; }, set: function (c, k, v) { c.outlets[k].maxPower = v; }, lo: function (c) { return 10; }, hi: function (c) { return c.safety.hardMaxOutletW; } },
    1: { name: "seuil d'alarme du capteur", unit: 'W', outlet: true, int: true, get: function (c, k) { return c.outlets[k].pzemAlarm; }, set: function (c, k, v) { c.outlets[k].pzemAlarm = v; }, lo: function () { return 1; }, hi: function () { return 23000; } },
    2: { name: 'priorité', unit: '', outlet: true, int: true, get: function (c, k) { return c.outlets[k].priority; }, set: function (c, k, v) { c.outlets[k].priority = v; }, lo: function () { return 1; }, hi: function () { return 4; } },
    3: { name: 'état au démarrage', unit: '', outlet: true, int: true, get: function (c, k) { return c.outlets[k].bootState; }, set: function (c, k, v) { c.outlets[k].bootState = v; }, lo: function () { return 0; }, hi: function () { return 2; } },
    4: { name: 'délai entre commutations', unit: 's', outlet: true, get: function (c, k) { return c.outlets[k].minSwitchS; }, set: function (c, k, v) { c.outlets[k].minSwitchS = v; }, lo: function (c) { return c.safety.minSwitchFloorS; }, hi: function () { return 600; } },
    5: { name: 'seuil de veille', unit: 'W', outlet: true, get: function (c, k) { return c.outlets[k].standbyW; }, set: function (c, k, v) { c.outlets[k].standbyW = v; }, lo: function () { return 0; }, hi: function () { return 200; } },
    10: { name: 'période de mesure', unit: 'ms', int: true, get: function (c) { return c.measure.sampleMs; }, set: function (c, k, v) { c.measure.sampleMs = v; }, lo: function () { return 1000; }, hi: function () { return 10000; } },
    11: { name: 'lissage', unit: '', int: true, get: function (c) { return c.measure.smoothN; }, set: function (c, k, v) { c.measure.smoothN = v; }, lo: function () { return 1; }, hi: function () { return 10; } },
    12: { name: 'puissance souscrite', unit: 'W', get: function (c) { return c.tariff.contractW; }, set: function (c, k, v) { c.tariff.contractW = v; }, lo: function () { return 100; }, hi: function () { return 12000; } },
    13: { name: 'prix heures pleines', unit: '', get: function (c) { return c.tariff.priceHP; }, set: function (c, k, v) { c.tariff.priceHP = v; }, lo: function () { return 0; }, hi: function () { return 100; } },
    14: { name: 'prix heures creuses', unit: '', get: function (c) { return c.tariff.priceHC; }, set: function (c, k, v) { c.tariff.priceHC = v; }, lo: function () { return 0; }, hi: function () { return 100; } },
    15: { name: 'consigne de température', unit: '°C', get: function (c) { return c.env.tempSet; }, set: function (c, k, v) { c.env.tempSet = v; }, lo: function () { return 5; }, hi: function () { return 35; } },
    16: { name: 'hystérésis', unit: '°C', get: function (c) { return c.env.tempHyst; }, set: function (c, k, v) { c.env.tempHyst = v; }, lo: function () { return 0.1; }, hi: function () { return 5; } },
    17: { name: 'seuil de luminosité', unit: '%', get: function (c) { return c.env.lightThr; }, set: function (c, k, v) { c.env.lightThr = v; }, lo: function () { return 0; }, hi: function () { return 100; } },
    18: { name: 'délai de présence', unit: 's', int: true, get: function (c) { return c.env.presenceS; }, set: function (c, k, v) { c.env.presenceS = v; }, lo: function () { return 5; }, hi: function () { return 3600; } },
    19: { name: 'facteur CO2', unit: 'g/kWh', get: function (c) { return c.tariff.co2; }, set: function (c, k, v) { c.tariff.co2 = v; }, lo: function () { return 0; }, hi: function () { return 2000; } },
    20: { name: "seuil d'anomalie", unit: '', get: function (c) { return c.ai.anomalyZ; }, set: function (c, k, v) { c.ai.anomalyZ = v; }, lo: function () { return 2; }, hi: function () { return 10; } },
    21: { name: 'k (k-NN)', unit: '', int: true, get: function (c) { return c.ai.knnK; }, set: function (c, k, v) { c.ai.knnK = v; }, lo: function () { return 1; }, hi: function () { return 7; } },
    22: { name: 'début heures creuses', unit: 'min', int: true, get: function (c) { return c.tariff.hcStart; }, set: function (c, k, v) { c.tariff.hcStart = v; }, lo: function () { return 0; }, hi: function () { return 1439; } },
    23: { name: 'fin heures creuses', unit: 'min', int: true, get: function (c) { return c.tariff.hcEnd; }, set: function (c, k, v) { c.tariff.hcEnd = v; }, lo: function () { return 0; }, hi: function () { return 1439; } }
  };

  function paramValid(p) { return Object.prototype.hasOwnProperty.call(PARAMS, p); }
  function paramIsOutlet(p) { return paramValid(p) && !!PARAMS[p].outlet; }
  function paramGet(c, p, idx) {
    if (!paramValid(p)) return NaN;
    const d = PARAMS[p];
    if (d.outlet) { if (idx < 1 || idx > 4) return NaN; return d.get(c, idx - 1); }
    return d.get(c);
  }
  // renvoie {ok, applied, msg}
  function paramSet(c, p, idx, v) {
    if (!paramValid(p)) return { ok: false, msg: 'paramètre inconnu' };
    const d = PARAMS[p];
    if (d.outlet && (idx < 1 || idx > 4)) return { ok: false, msg: 'numéro de prise invalide' };
    if (Number.isNaN(v)) return { ok: false, msg: 'valeur invalide' };
    const lo = d.lo(c), hi = d.hi(c);
    let x = v;
    if (d.int) x = Math.floor(x + 0.5);
    if (x < lo) x = lo;
    if (x > hi) x = hi;
    let msg = '';
    if (x !== v) msg = 'valeur ajustée à ' + x + ' (limites ' + lo + ' … ' + hi + ')';
    d.set(c, d.outlet ? idx - 1 : 0, x);
    return { ok: true, applied: x, msg: msg };
  }

  function isOffPeak(c, mod) {
    const t = c.tariff;
    if (!t.hpHc || t.hcStart === t.hcEnd) return false;
    if (t.hcStart < t.hcEnd) return mod >= t.hcStart && mod < t.hcEnd;
    return mod >= t.hcStart || mod < t.hcEnd;
  }
  function priceAt(c, mod, timeValid) { return (timeValid && isOffPeak(c, mod)) ? c.tariff.priceHC : c.tariff.priceHP; }

  EL.config = { PERM, defaults, merge, clone, masked, PARAMS, paramValid, paramIsOutlet, paramGet, paramSet, isOffPeak, priceAt };
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ---- 32_ai.js ---- */
/* EnergyLab — fonctions intelligentes (copie de firmware/src/ai.cpp)
 *  historique 1 s, Holt, anomalies (score z), k plus proches voisins */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  const NOUT = 4;
  const FAST_N = 600;

  function clampN(n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }

  class FastHistory {
    constructor() { this.buf = new Array(FAST_N); this.head = 0; this.n = 0; }
    clear() { this.head = 0; this.n = 0; }
    push(s) { this.buf[this.head] = s; this.head = (this.head + 1) % FAST_N; if (this.n < FAST_N) this.n++; }
    count() { return this.n; }
    at(i) { let idx = this.head - 1 - i; while (idx < 0) idx += FAST_N; return this.buf[idx % FAST_N]; }
    total(i) { const s = this.at(i); let t = 0; for (let k = 0; k < NOUT; k++) t += s.p[k]; return t; }
    avgP(o, n) {
      if (this.n === 0 || o < 0 || o >= NOUT) return NaN;
      n = clampN(n, 1, this.n);
      let s = 0;
      for (let i = 0; i < n; i++) s += this.at(i).p[o];
      return s / n;
    }
    avgTotal(n) {
      if (this.n === 0) return NaN;
      n = clampN(n, 1, this.n);
      let s = 0;
      for (let i = 0; i < n; i++) s += this.total(i);
      return s / n;
    }
    maxTotal(n) {
      if (this.n === 0) return NaN;
      n = clampN(n, 1, this.n);
      let m = this.total(0);
      for (let i = 1; i < n; i++) { const v = this.total(i); if (v > m) m = v; }
      return m;
    }
    slopeTotalPerMin(n) {
      if (this.n < 2) return 0;
      n = clampN(n, 2, this.n);
      let sx = 0, sy = 0;
      for (let i = 0; i < n; i++) { sx += -i; sy += this.total(i); }
      const mx = sx / n, my = sy / n;
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) { const dx = -i - mx; num += dx * (this.total(i) - my); den += dx * dx; }
      return den === 0 ? 0 : num / den * 60;
    }
    // échantillons du plus ancien au plus récent
    list(max) {
      const n = Math.min(this.n, max || FAST_N);
      const out = [];
      for (let i = n - 1; i >= 0; i--) out.push(this.at(i));
      return out;
    }
  }

  class Holt {
    constructor() { this.reset(); }
    reset() { this.acc = 0; this.n = 0; this.init = false; this.L = 0; this.T = 0; }
    addSecond(total) {
      if (Number.isNaN(total)) return;
      this.acc += total;
      this.n++;
      if (this.n < 10) return;
      const y = this.acc / this.n;
      this.acc = 0; this.n = 0;
      const alpha = 0.3, beta = 0.1;
      if (!this.init) { this.L = y; this.T = 0; this.init = true; return; }
      const prev = this.L;
      this.L = alpha * y + (1 - alpha) * (this.L + this.T);
      this.T = beta * (this.L - prev) + (1 - beta) * this.T;
    }
    forecast(minutes) {
      if (!this.init) return NaN;
      if (!(minutes >= 0)) minutes = 0;
      if (minutes > 120) minutes = 120;
      const v = this.L + this.T * (minutes * 6);
      return v < 0 ? 0 : v;
    }
    ready() { return this.init; }
  }

  class Anomaly {
    constructor() { this.reset(); }
    reset() { this.init = false; this.mu = 0; this.v = 0; this.over = 0; this.flagged = false; this.z = 0; }
    update(p, zThr) {
      if (Number.isNaN(p)) return;
      if (!this.init) { this.init = true; this.mu = p; this.v = 0; this.over = 0; this.flagged = false; this.z = 0; return; }
      const sd = Math.sqrt(this.v);
      const floorSd = 2 + 0.05 * Math.abs(this.mu);
      const den = sd > floorSd ? sd : floorSd;
      this.z = Math.abs(p - this.mu) / den;
      if (this.z > zThr && p > 5) this.over++; else this.over = 0;
      this.flagged = this.over >= 3;
      if (this.over >= 60) { this.mu = p; this.v = 0; this.over = 0; this.flagged = false; return; }
      if (this.over === 0) {
        const a = 0.05, d = p - this.mu;
        this.mu += a * d;
        this.v = (1 - a) * (this.v + a * d * d);
      }
    }
    flag() { return this.flagged; }
  }

  class Knn {
    constructor() { this.samples = []; this.labels = []; }
    static distance(p1, pf1, p2, pf2) {
      const x1 = Math.log10(p1 > 0.1 ? p1 : 0.1), x2 = Math.log10(p2 > 0.1 ? p2 : 0.1);
      const dx = (x1 - x2) / 0.12, dy = (pf1 - pf2) / 0.08;
      return Math.sqrt(dx * dx + dy * dy);
    }
    // renvoie {id, dist, neighbours}
    classifyFull(p, pf, k, maxDist) {
      if (Number.isNaN(p) || p < 1) return { id: 0, dist: NaN, neighbours: [] };
      if (this.samples.length === 0) return { id: -1, dist: NaN, neighbours: [] };
      if (k < 1) k = 1;
      const v = this.samples.map(function (s, i) { return { d: Knn.distance(p, pf, s.p, s.pf), label: s.label, i: i }; });
      v.sort(function (a, b) { return a.d - b.d || a.i - b.i; });
      const n = Math.min(k, v.length);
      const neighbours = v.slice(0, n);
      if (v[0].d > maxDist) return { id: -1, dist: v[0].d, neighbours: neighbours };
      let best = v[0].label, bestCount = 0;
      for (let i = 0; i < n; i++) {
        let c = 0;
        for (let j = 0; j < n; j++) if (v[j].label === v[i].label) c++;
        if (c > bestCount) { bestCount = c; best = v[i].label; }
      }
      return { id: best, dist: v[0].d, neighbours: neighbours };
    }
    classify(p, pf, k, maxDist) { return this.classifyFull(p, pf, k, maxDist).id; }
    labelId(name, create) {
      for (const l of this.labels) if (l.name === name) return l.id;
      if (!create || this.labels.length >= 16) return -1;
      let id = 1;
      while (this.labels.some(function (l) { return l.id === id; })) id++;
      this.labels.push({ id: id, name: name });
      return id;
    }
    labelName(id) { const l = this.labels.find(function (x) { return x.id === id; }); return l ? l.name : ''; }
    removeLabel(id) {
      this.labels = this.labels.filter(function (l) { return l.id !== id; });
      this.samples = this.samples.filter(function (s) { return s.label !== id; });
    }
    toJSON() {
      return { labels: this.labels.map(function (l) { return { id: l.id, name: l.name }; }), samples: this.samples.map(function (s) { return [s.label, s.p, s.pf]; }) };
    }
    load(o) {
      this.labels = (o && o.labels || []).map(function (l) { return { id: l.id, name: l.name }; });
      this.samples = (o && o.samples || []).map(function (s) { return Array.isArray(s) ? { label: s[0], p: s[1], pf: s[2] } : s; });
    }
  }
  Knn.MAX_SAMPLES = 60;

  EL.ai = { FastHistory, Holt, Anomaly, Knn, NOUT, FAST_N };
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ---- 33_relays.js ---- */
/* EnergyLab — gestionnaire des relais (copie de firmware/src/relays.cpp) */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  const SRC = { USER: 0, PROGRAM: 1, SAFETY: 2, MQTT: 3, BOOT: 4, SHED: 5, PULSE: 6 };
  const RES = { OK: 0, NOCHANGE: 1, DELAYED: 2, LATCHED: 3, INVALID: 4 };
  const N = 4;

  class Relays {
    constructor(writeFn) {
      this.write = writeFn || null;
      this.on = [false, false, false, false];
      this.latched = [false, false, false, false];
      this.pending = [-1, -1, -1, -1];
      this.last = [-1e12, -1e12, -1e12, -1e12];
      this.pulseOff = [0, 0, 0, 0];
      this.minMs = [2000, 2000, 2000, 2000];
      this.switchCount = [0, 0, 0, 0];
      this.changed = false;
    }
    setMinSwitchMs(k, ms) { if (k >= 0 && k < N) this.minMs[k] = ms; }
    apply(k, on, now) {
      if (this.on[k] !== on) {
        this.on[k] = on;
        this.last[k] = now;
        this.switchCount[k]++;
        this.changed = true;
        if (this.write) this.write(k, on);
      }
      this.pending[k] = -1;
    }
    force(k, on, now) {
      if (k < 0 || k >= N) return;
      this.on[k] = on; this.pending[k] = -1; this.pulseOff[k] = 0; this.last[k] = now - 1e9;
      if (this.write) this.write(k, on);
    }
    request(k, on, src, now) {
      if (k < 0 || k >= N) return RES.INVALID;
      if (src !== SRC.PULSE) this.pulseOff[k] = 0;
      if (on && this.latched[k]) return RES.LATCHED;
      if (src === SRC.SAFETY && !on) { this.apply(k, false, now); return RES.OK; }
      if (on === this.on[k]) { this.pending[k] = -1; return RES.NOCHANGE; }
      if (now - this.last[k] < this.minMs[k]) { this.pending[k] = on ? 1 : 0; return RES.DELAYED; }
      this.apply(k, on, now);
      return RES.OK;
    }
    latch(k, now) {
      if (k < 0 || k >= N) return;
      this.latched[k] = true; this.pulseOff[k] = 0;
      this.apply(k, false, now);
    }
    rearm(k) {
      if (k < 0 || k >= N || !this.latched[k]) return false;
      this.latched[k] = false;
      return true;
    }
    pulse(k, seconds, src, now) {
      if (k < 0 || k >= N) return;
      if (!(seconds > 0)) seconds = 0;
      if (seconds > 86400) seconds = 86400;
      const r = this.request(k, true, src, now);
      if (r === RES.LATCHED || r === RES.INVALID) return;
      this.pulseOff[k] = now + seconds * 1000;
      if (this.pulseOff[k] === 0) this.pulseOff[k] = 1;
    }
    tick(now) {
      for (let k = 0; k < N; k++) {
        if (this.pending[k] >= 0 && now - this.last[k] >= this.minMs[k]) {
          const on = this.pending[k] === 1;
          if (on && this.latched[k]) this.pending[k] = -1;
          else this.apply(k, on, now);
        }
        if (this.pulseOff[k] !== 0 && now >= this.pulseOff[k]) {
          this.pulseOff[k] = 0;
          this.request(k, false, SRC.PULSE, now);
        }
      }
    }
    isOn(k) { return k >= 0 && k < N && this.on[k]; }
    isLatched(k) { return k >= 0 && k < N && this.latched[k]; }
    hasPending(k) { return k >= 0 && k < N && this.pending[k] >= 0; }
    switches(k) { return (k >= 0 && k < N) ? this.switchCount[k] : 0; }
    lastChange(k) { return (k >= 0 && k < N) ? this.last[k] : 0; }
    pulseEnd(k) { return (k >= 0 && k < N) ? this.pulseOff[k] : 0; }
    resetSwitchCounters() { this.switchCount = [0, 0, 0, 0]; }
    mask() { let m = 0; for (let k = 0; k < N; k++) if (this.on[k]) m |= (1 << k); return m; }
    takeChanged() { const c = this.changed; this.changed = false; return c; }
  }

  EL.relays = { Relays, SRC, RES };
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ---- 34_kitcore.js ---- */
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
      // relais ouvert = aucun courant : on ignore la dernière mesure, peut-être antérieure à la coupure
      let tot = 0;
      for (let k = 0; k < NOUT; k++) { const o = this.out[k]; if (o.online && this.rel.isOn(k) && !Number.isNaN(o.rawP)) tot += o.rawP; }
      if (tot <= this.cfg.safety.maxTotalW) return;
      let best = -1;
      for (let k = 0; k < NOUT; k++) {
        if (!this.rel.isOn(k) || this.rel.isLatched(k)) continue;
        // une prise allumée depuis moins d'une période de mesure n'est pas encore mesurée : elle reste candidate
        const fresh = now - this.rel.lastChange(k) < this.cfg.measure.sampleMs + 1000;
        if (!(this.out[k].rawP > 1) && !fresh) continue;
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
      for (let k = 0; k < NOUT; k++) { const o = this.out[k]; if (o.shed || !this.rel.isOn(k)) continue; if (o.online && !Number.isNaN(o.p)) tot += o.p; }
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

/* ---- 35_house.js ---- */
/* EnergyLab — modèle physique de la maison (jumeau numérique)
 *  - catalogue d'appareils réalistes (résistifs, moteurs, électroniques, programmes)
 *  - thermique de la pièce, chauffe-eau, réfrigérateur, lumière du jour, présence
 *  - émulation des capteurs PZEM-004T (quantification, seuil de démarrage, retard)
 *  - scénarios de journée pour l'arène de comparaison des algorithmes */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};

  // ---------------------------------------------------------------- catalogue
  const APPLIANCES = {
    none: { name: 'Rien de branché', icon: '⭕', cat: '—', model: 'none' },
    lamp_led: { name: 'Lampe LED 9 W', icon: '💡', cat: 'électronique', model: 'simple', P: 9, pf: 0.88, light: true },
    lamp_halo: { name: 'Lampe halogène 42 W', icon: '💡', cat: 'résistif', model: 'simple', P: 42, pf: 1.0, light: true },
    lamp_cfl: { name: 'Lampe fluocompacte 15 W', icon: '💡', cat: 'électronique', model: 'simple', P: 15, pf: 0.58, light: true },
    kettle: { name: 'Bouilloire 2000 W', icon: '🫖', cat: 'résistif', model: 'timed', P: 2000, pf: 1.0, duration: 170 },
    heater: { name: 'Convecteur 1000 W', icon: '🔥', cat: 'résistif', model: 'heater', P: 1000, pf: 1.0 },
    fan: { name: 'Ventilateur 45 W', icon: '🌀', cat: 'moteur (inductif)', model: 'simple', P: 45, pf: 0.76, noise: 0.03 },
    fridge: { name: 'Réfrigérateur', icon: '🧊', cat: 'compresseur (inductif)', model: 'fridge', P: 110, pf: 0.66, standby: 1.5, standbyPf: 0.4, inrush: 550 },
    charger: { name: 'Chargeur de téléphone', icon: '🔋', cat: 'électronique', model: 'charger', P: 10, pf: 0.55, full: 5400, trickle: 1.2, standby: 0.3, standbyPf: 0.3 },
    tvbox: { name: 'Décodeur TV + console', icon: '🎮', cat: 'électronique', model: 'standby', P: 35, pf: 0.6, standby: 14, standbyPf: 0.45, noise: 0.1 },
    tv: { name: 'Téléviseur', icon: '📺', cat: 'électronique', model: 'standby', P: 85, pf: 0.95, standby: 1.5, standbyPf: 0.3, noise: 0.08 },
    laptop: { name: 'Ordinateur portable', icon: '💻', cat: 'électronique', model: 'standby', P: 60, pf: 0.62, standby: 0.6, standbyPf: 0.3, noise: 0.15 },
    washer: { name: 'Lave-linge', icon: '🧺', cat: 'mixte (résistance + moteur)', model: 'program', phases: [{ d: 900, P: 2000, pf: 1.0 }, { d: 2400, P: 230, pf: 0.68, noise: 0.25 }, { d: 600, P: 420, pf: 0.8, noise: 0.15 }], standby: 1, standbyPf: 0.4 },
    water_heater: { name: 'Chauffe-eau 100 L (1200 W)', icon: '🚿', cat: 'résistif', model: 'waterheater', P: 1200, pf: 1.0 },
    iron: { name: 'Fer à repasser', icon: '👔', cat: 'résistif', model: 'cycling', P: 1100, pf: 1.0, onS: 40, offS: 25 },
    microwave: { name: 'Micro-ondes', icon: '🍲', cat: 'électronique', model: 'timed', P: 1150, pf: 0.95, duration: 180, standby: 2, standbyPf: 0.35 },
    ac: { name: 'Climatiseur 900 W', icon: '❄️', cat: 'compresseur (inductif)', model: 'cooler', P: 900, pf: 0.92, fanP: 40, fanPf: 0.8 },
    router: { name: 'Box Internet', icon: '📶', cat: 'électronique', model: 'simple', P: 9, pf: 0.55 },
    motor: { name: 'Moteur / perceuse 600 W', icon: '🛠️', cat: 'moteur (inductif)', model: 'simple', P: 600, pf: 0.82, noise: 0.05 }
  };

  // Instance d'appareil : sw = interrupteur de l'appareil (souhait de l'utilisateur)
  function makeAppliance(id, opts) {
    const def = APPLIANCES[id] || APPLIANCES.none;
    return Object.assign({ id: id, def: def, sw: false, t: 0, phase: 0, done: 0, tin: 4, cooling: false, tw: 58, heating: false, cyc: 0, served: 0, unserved: 0, startedAt: -1, finishedAt: -1, p: 0, pf: 1 }, opts || {});
  }

  // Avance un appareil de dt secondes. powered = relais de la prise fermé.
  // Renvoie {p, pf} et met à jour a.demand (l'appareil a besoin d'énergie maintenant).
  function stepAppliance(a, powered, dt, ctx) {
    const d = a.def;
    let p = 0, pf = 1;
    const noise = d.noise ? 1 + d.noise * (ctx.rnd() - 0.5) * 2 : 1;
    a.demand = false;
    switch (d.model) {
      case 'simple':
        a.demand = a.sw && (!d.light || ctx.presence);
        if (a.sw && powered) { p = d.P * noise; pf = d.pf; }
        break;
      case 'timed': // bouilloire, micro-ondes : s'arrête seul après 'duration' secondes alimentées
        if (a.sw) {
          a.demand = true;
          if (powered) { a.t += dt; p = d.P; pf = d.pf; if (a.t >= d.duration) { a.sw = false; a.t = 0; } }
        } else if (powered && d.standby) { p = d.standby; pf = d.standbyPf; }
        break;
      case 'heater':
        a.demand = a.sw;
        if (a.sw && powered) { p = d.P; pf = d.pf; ctx.heat += d.P; }
        break;
      case 'cooler':
        a.demand = a.sw;
        if (a.sw && powered) {
          if (ctx.troom > 25) a.cooling = true;
          else if (ctx.troom < 23) a.cooling = false;
          if (a.cooling) { p = d.P; pf = d.pf; ctx.heat -= d.P * 2.5; } else { p = d.fanP; pf = d.fanPf; }
        } else a.cooling = false;
        break;
      case 'fridge': { // température intérieure 3..6 °C
        const running = a.tin > 6 || (a.cooling && a.tin > 3);
        a.demand = a.tin > 6 || (a.cooling && a.tin > 3);
        if (powered && running) {
          if (!a.cooling) a.t = 0;
          a.cooling = true;
          a.t += dt;
          p = a.t <= 1 ? d.inrush : d.P * (0.97 + 0.06 * ctx.rnd());
          pf = d.pf;
          a.tin -= dt / 200;
        } else {
          a.cooling = false;
          if (powered) { p = d.standby; pf = d.standbyPf; }
          a.tin += dt / 420;
        }
        break;
      }
      case 'charger':
        if (a.sw) { // téléphone branché
          a.demand = a.t < d.full;
          if (powered) { a.t += dt; if (a.t < d.full) { p = d.P; pf = d.pf; } else { p = d.trickle; pf = 0.4; } }
        } else { a.t = 0; if (powered) { p = d.standby; pf = d.standbyPf; } }
        break;
      case 'standby': // TV, ordinateur : veille quand l'utilisateur l'éteint
        a.demand = a.sw;
        if (powered) { if (a.sw) { p = d.P * noise; pf = d.pf; } else { p = d.standby; pf = d.standbyPf; } }
        break;
      case 'program': { // lave-linge : programme en phases, reprend après coupure
        if (a.sw) {
          a.demand = true;
          if (powered) {
            if (a.startedAt < 0) a.startedAt = ctx.minute;
            a.t += dt;
            let acc = 0, ph = null;
            for (const x of d.phases) { acc += x.d; if (a.t < acc) { ph = x; break; } }
            if (ph) { p = ph.P * (ph.noise ? 1 + ph.noise * (ctx.rnd() - 0.5) * 2 : 1); pf = ph.pf; } else { a.sw = false; a.t = 0; a.done++; a.finishedAt = ctx.minute; }
          }
        } else if (powered) { p = d.standby; pf = d.standbyPf; }
        break;
      }
      case 'waterheater': { // 100 L : 1200 W -> +10,3 °C/h ; pertes 0,2 °C/h ; thermostat 55..60 °C
        if (a.tw < 55) a.heating = true;
        else if (a.tw >= 60) a.heating = false;
        a.demand = a.heating;
        if (a.heating && powered) { p = d.P; pf = d.pf; a.tw += dt * 10.3 / 3600; }
        a.tw -= dt * 0.2 / 3600;
        break;
      }
      case 'cycling': // fer à repasser : thermostat interne
        a.demand = a.sw;
        if (a.sw && powered) {
          a.cyc += dt;
          const per = d.onS + d.offS;
          if (a.cyc % per < d.onS) { p = d.P; pf = d.pf; } else { p = 0.5; pf = 0.5; }
        }
        break;
      default:
        break;
    }
    a.p = p;
    a.pf = p > 0 ? pf : 1;
    return a;
  }

  // ---------------------------------------------------------------- maison
  class House {
    constructor(opts) {
      opts = opts || {};
      this.rnd = EL.util.rng(opts.seed || 12345);
      this.outlets = [0, 1, 2, 3].map(function () { return { apps: [], meterWh: 0, acc: { p: 0, q: 0, n: 0 }, last: null }; });
      this.troom = opts.troom !== undefined ? opts.troom : 19;
      this.toutMean = opts.toutMean !== undefined ? opts.toutMean : 10;
      this.toutAmp = opts.toutAmp !== undefined ? opts.toutAmp : 5;
      this.toutOverride = null;
      this.lightOverride = null;
      this.presence = opts.presence !== undefined ? opts.presence : true;
      this.presenceMode = opts.presenceMode || 'manual';  // 'manual' | 'schedule'
      this.schedule = opts.schedule || null;
      this.voltageNominal = 230;
      this.hum = 45;
      this.lightExtra = 0;
      this.R = 0.03;       // °C/W (déperditions d'une pièce isolée : 33 W/°C)
      this.C = 2.0e6;      // J/°C (inertie air + murs + meubles) : constante de temps R·C ≈ 17 h
      this.ctTurns = [1, 1, 1, 1];
    }
    setAppliances(k, ids) {
      this.outlets[k].apps = ids.map(function (x) { return typeof x === 'string' ? makeAppliance(x) : makeAppliance(x.id, x); });
    }
    tout(minuteOfDay) {
      if (this.toutOverride !== null) return this.toutOverride;
      return this.toutMean + this.toutAmp * Math.cos(2 * Math.PI * (minuteOfDay / 60 - 15) / 24);
    }
    daylight(minuteOfDay) {
      if (this.lightOverride !== null) return this.lightOverride;
      const h = minuteOfDay / 60;
      return Math.max(0, Math.sin(Math.PI * (h - 7) / 12)) * 85;
    }
    presenceAt(minuteOfDay) {
      if (this.presenceMode !== 'schedule' || !this.schedule) return this.presence;
      for (const iv of this.schedule) if (minuteOfDay >= iv[0] && minuteOfDay < iv[1]) return true;
      return false;
    }
    // avance la physique de dt secondes ; relays[k] = relais fermé
    step(dt, relays, minuteOfDay) {
      const ctx = { rnd: this.rnd, heat: 0, troom: this.troom, minute: minuteOfDay, presence: this.presence };
      let light = 0;
      for (let k = 0; k < 4; k++) {
        const o = this.outlets[k];
        let P = 0, Q = 0;
        for (const a of o.apps) {
          stepAppliance(a, !!relays[k], dt, ctx);
          if (a.p > 0) {
            P += a.p;
            Q += a.p * Math.tan(Math.acos(Math.min(1, Math.max(0.05, a.pf))));
            if (a.def.light) light += 25;
          }
          if (a.demand) { if (relays[k]) a.served += dt; else a.unserved += dt; }
        }
        o.acc.p += P * dt;
        o.acc.q += Q * dt;
        o.acc.n += dt;
        o.meterWh += P * dt / 3600;
        o.pNow = P;
        o.qNow = Q;
      }
      const tout = this.tout(minuteOfDay);
      // dT/dt = (Tout - T)/(R C) + Pchauffage / C
      this.troom += dt * ((tout - this.troom) / (this.R * this.C) + ctx.heat / this.C);
      this.lightExtra = light;
      this.presence = this.presenceAt(minuteOfDay);
      this.hum = 45 + 5 * Math.sin(minuteOfDay / 1440 * 2 * Math.PI) + (this.rnd() - 0.5);
    }
    // lecture d'un capteur PZEM (valeurs moyennées depuis la lecture précédente)
    readPzem(k, tSec) {
      const o = this.outlets[k];
      const n = o.acc.n || 1e-9;
      const P = o.acc.n ? o.acc.p / n : (o.pNow || 0);
      const Q = o.acc.n ? o.acc.q / n : (o.qNow || 0);
      o.acc = { p: 0, q: 0, n: 0 };
      const turns = this.ctTurns[k] || 1;
      const U = this.voltageNominal + 2.5 * Math.sin((tSec || 0) / 600) - 0.0015 * this.totalPNow() + EL.util.gauss(this.rnd) * 0.15;
      const S = Math.sqrt(P * P + Q * Q);
      let I = S / U * turns;
      let Pm = P * turns;
      let pf = S > 0 ? P / S : 0;
      if (I < 0.02) { I = 0; Pm = 0; pf = 0; } // seuil de démarrage du PZEM-004T 100 A
      const q = function (v, step) { return Math.round(v / step) * step; };
      const r = {
        ok: true,
        u: q(U, 0.1),
        i: q(I * (1 + EL.util.gauss(this.rnd) * 0.002), 0.001),
        p: q(Pm * (1 + EL.util.gauss(this.rnd) * 0.002), 0.1),
        eWh: Math.floor(o.meterWh * turns),
        f: q(50 + EL.util.gauss(this.rnd) * 0.02, 0.1),
        pf: q(pf, 0.01),
        alarm: false
      };
      if (r.p < 0) r.p = 0;
      return r;
    }
    totalPNow() { let t = 0; for (const o of this.outlets) t += o.pNow || 0; return t; }
    readEnv(minuteOfDay) {
      const lum = Math.min(100, this.daylight(minuteOfDay) + this.lightExtra + (this.rnd() - 0.5) * 2);
      return {
        temp: Math.round((this.troom + (this.rnd() - 0.5) * 0.2) * 10) / 10,
        hum: Math.round(this.hum * 10) / 10,
        lum: Math.round(Math.max(0, lum) * 10) / 10,
        motion: this.presence && this.rnd() < 0.35
      };
    }
  }

  // ---------------------------------------------------------------- scénarios (arène)
  // Horaires en minutes depuis minuit. 'on' : intervalles où l'utilisateur allume l'appareil ;
  // 'starts' : démarrages ponctuels (l'appareil s'arrête seul) ; 'auto' : toujours en service.
  const SCENARIOS = {
    hiver: {
      name: "Journée d'hiver en famille",
      desc: 'Convecteur allumé le soir et laissé en marche toute la nuit, lampe souvent oubliée, bouilloire, lave-linge lancé à 18 h 30 (à terminer avant 7 h), chauffe-eau, télévision. Tarif heures pleines / heures creuses, puissance souscrite 2 500 W.',
      tout: { mean: 8, amp: 5 }, troom: 18,
      tariff: { hpHc: true, priceHP: 1.6, priceHC: 0.9, hcStart: 22 * 60, hcEnd: 6 * 60 }, contractW: 2500,
      presence: [[6 * 60 + 30, 7 * 60 + 45], [12 * 60, 13 * 60 + 30], [17 * 60 + 30, 23 * 60]], // éveillés à la maison
      outlets: [
        { name: 'Salon', priority: 2, apps: [{ id: 'lamp_halo', when: 'dark-presence' }, { id: 'tv', on: [[19 * 60, 22 * 60 + 30]] }] },
        { name: 'Cuisine', priority: 1, apps: [{ id: 'fridge', auto: true }, { id: 'kettle', starts: [7 * 60, 12 * 60 + 30, 17 * 60 + 45] }, { id: 'microwave', starts: [12 * 60 + 15, 19 * 60 + 30] }] },
        { name: 'Chambre', priority: 4, apps: [{ id: 'heater', on: [[0, 7 * 60 + 45], [17 * 60 + 30, 24 * 60]] }, { id: 'charger', on: [[22 * 60, 24 * 60], [0, 6 * 60]] }] },
        { name: 'Buanderie', priority: 3, apps: [{ id: 'washer', starts: [18 * 60 + 30], deadline: 31 * 60 }, { id: 'water_heater', auto: true, draws: [[7 * 60, 18], [20 * 60 + 30, 18]] }] }
      ]
    },
    pointe: {
      name: 'Soirée de pointe',
      desc: 'Beaucoup d’appareils en même temps entre 18 h et 21 h : idéal pour tester le délestage et l’écrêtage de pointe. Puissance souscrite 2 500 W.',
      tout: { mean: 12, amp: 4 }, troom: 19,
      tariff: { hpHc: false, priceHP: 1.2, priceHC: 0.9, hcStart: 22 * 60, hcEnd: 6 * 60 }, contractW: 2500,
      presence: [[6 * 60 + 30, 8 * 60], [17 * 60, 23 * 60]],
      outlets: [
        { name: 'Salon', priority: 2, apps: [{ id: 'lamp_led', when: 'dark-presence' }, { id: 'tv', on: [[18 * 60, 23 * 60]] }, { id: 'laptop', on: [[18 * 60 + 30, 21 * 60]] }] },
        { name: 'Cuisine', priority: 1, apps: [{ id: 'fridge', auto: true }, { id: 'kettle', starts: [7 * 60 + 15, 18 * 60 + 10, 20 * 60] }, { id: 'microwave', starts: [18 * 60 + 40, 19 * 60 + 5] }] },
        { name: 'Chambre', priority: 4, apps: [{ id: 'heater', on: [[17 * 60, 23 * 60]] }] },
        { name: 'Atelier', priority: 3, apps: [{ id: 'iron', on: [[18 * 60 + 15, 19 * 60 + 15]] }, { id: 'motor', on: [[18 * 60 + 50, 19 * 60]] }] }
      ]
    },
    veille: {
      name: 'Consommations cachées (veille)',
      desc: 'Été, sans chauffage : la consommation vient surtout des veilles (TV, décodeur, console, ordinateur, chargeurs, box) et de l’éclairage oublié la nuit. Idéal pour le « tueur de veille » et l’éclairage intelligent.',
      tout: { mean: 26, amp: 6 }, troom: 25,
      tariff: { hpHc: false, priceHP: 1.2, priceHC: 0.9, hcStart: 22 * 60, hcEnd: 6 * 60 }, contractW: 3000,
      presence: [[6 * 60 + 30, 8 * 60], [13 * 60, 14 * 60], [18 * 60, 23 * 60 + 30]],
      outlets: [
        { name: 'Salon', priority: 2, apps: [{ id: 'tv', on: [[20 * 60, 22 * 60]] }, { id: 'tvbox', on: [[20 * 60, 22 * 60]] }, { id: 'lamp_cfl', when: 'dark-presence' }] },
        { name: 'Cuisine', priority: 1, apps: [{ id: 'fridge', auto: true }, { id: 'microwave', starts: [13 * 60 + 10, 19 * 60 + 45] }] },
        { name: 'Chambre', priority: 4, apps: [{ id: 'fan', on: [[22 * 60, 24 * 60], [0, 6 * 60]] }, { id: 'charger', on: [[23 * 60, 24 * 60], [0, 7 * 60]] }] },
        { name: 'Bureau', priority: 3, apps: [{ id: 'laptop', on: [[18 * 60 + 30, 20 * 60]] }, { id: 'router', auto: true }] }
      ]
    }
  };

  function inIntervals(m, list) {
    for (const iv of list) if (m >= iv[0] && m < iv[1]) return true;
    return false;
  }

  // Applique les habitudes des occupants (interrupteurs des appareils) pour la minute courante
  function applyHabits(house, scenario, minute, prevMinute) {
    const dark = house.daylight(minute) < 30;
    scenario.outlets.forEach(function (os, k) {
      const apps = house.outlets[k].apps;
      os.apps.forEach(function (spec, j) {
        const a = apps[j];
        if (!a) return;
        if (spec.auto) a.sw = true;
        if (spec.on) a.sw = inIntervals(minute, spec.on);
        if (spec.when === 'dark-presence') {
          // les occupants allument quand il fait sombre... et oublient souvent d'éteindre en partant
          if (!dark) a.sw = false;
          else if (house.presence) a.sw = true;
        }
        if (spec.starts && minute !== prevMinute) {
          for (const s of spec.starts) if (minute === s) a.sw = true;
        }
        if (spec.draws && minute !== prevMinute) {
          for (const dr of spec.draws) {
            if (minute === dr[0]) {
              a.drawCount = (a.drawCount || 0) + 1;
              if (a.tw < 40) a.coldDraws = (a.coldDraws || 0) + 1;
              a.tw -= dr[1];
            }
          }
        }
      });
    });
  }

  // Apprentissage de référence pour l'arène : mêmes numéros que si l'on entraînait l'IA dans cet ordre
  const KNN_REFERENCE = [['Bouilloire', 'kettle'], ['Convecteur', 'heater'], ['Réfrigérateur', 'fridge'], ['Micro-ondes', 'microwave'],
    ['Téléviseur', 'tv'], ['Ordinateur portable', 'laptop'], ['Lampe halogène', 'lamp_halo'], ['Fer à repasser', 'iron']];
  function pretrainKnn(knn, rnd) {
    for (const ref of KNN_REFERENCE) {
      const d = APPLIANCES[ref[1]];
      const id = knn.labelId(ref[0], true);
      for (let i = 0; i < 3; i++) knn.samples.push({ label: id, p: d.P * (1 + (rnd() - 0.5) * 0.06), pf: Math.min(1, d.pf * (1 + (rnd() - 0.5) * 0.04)) });
    }
  }

  EL.house = { KNN_REFERENCE, pretrainKnn, APPLIANCES, makeAppliance, stepAppliance, House, SCENARIOS, applyHabits, inIntervals };
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ---- 37_simkit.js ---- */
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

/* ---- 38_realkit.js ---- */
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
      return U.contiguousTail(out);
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

/* ---- 40_blocks.js ---- */
/* EnergyLab — blocs de programmation (style Scratch, moteur Blockly)
 * Chaque bloc correspond à une ou plusieurs instructions du bytecode (docs/specs/bytecode.md). */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};

  // Options dynamiques : noms des prises et appareils appris (mis à jour par l'application)
  const dyn = {
    outlets: ['Salon', 'Cuisine', 'Chambre', 'Bureau'],
    labels: []  // [{id, name}]
  };
  function outletOptions() {
    return dyn.outlets.map(function (n, i) { return [(i + 1) + ' · ' + n, String(i + 1)]; });
  }
  function labelOptions() {
    const o = [['aucun appareil (P < 1 W)', '0'], ['un appareil inconnu', '-1']];
    let max = 4;
    for (const l of dyn.labels) { o.push([l.name, String(l.id)]); if (l.id >= max) max = l.id + 1; }
    // numéros encore libres : un programme peut viser un appareil avant son apprentissage
    for (let id = 1; id <= Math.min(max, 16); id++) {
      if (!dyn.labels.some(function (l) { return l.id === id; })) o.push(['appareil n°' + id + ' (pas encore appris)', String(id)]);
    }
    return o;
  }

  const STYLES = {
    el_events: { colourPrimary: '#FFBF00', colourSecondary: '#E6AC00', colourTertiary: '#CC9900', hat: 'cap' },
    el_control: { colourPrimary: '#FFAB19', colourSecondary: '#EC9C13', colourTertiary: '#CF8B17' },
    el_operators: { colourPrimary: '#59C059', colourSecondary: '#46B946', colourTertiary: '#389438' },
    el_sensing: { colourPrimary: '#4C97FF', colourSecondary: '#4280D7', colourTertiary: '#3373CC' },
    el_env: { colourPrimary: '#5CB1D6', colourSecondary: '#47A8D1', colourTertiary: '#2E8EB8' },
    el_outlets: { colourPrimary: '#0FBD8C', colourSecondary: '#0DA57A', colourTertiary: '#0B8E69' },
    el_params: { colourPrimary: '#9966FF', colourSecondary: '#855CD6', colourTertiary: '#774DCB' },
    el_ai: { colourPrimary: '#FF6680', colourSecondary: '#FF4D6A', colourTertiary: '#FF3355' },
    el_display: { colourPrimary: '#CF63CF', colourSecondary: '#C94FC9', colourTertiary: '#BD42BD' },
    variable_blocks: { colourPrimary: '#FF8C1A', colourSecondary: '#FF8000', colourTertiary: '#DB6E00' },
    variable_dynamic_blocks: { colourPrimary: '#FF8C1A', colourSecondary: '#FF8000', colourTertiary: '#DB6E00' },
    math_blocks: { colourPrimary: '#59C059', colourSecondary: '#46B946', colourTertiary: '#389438' },
    logic_blocks: { colourPrimary: '#59C059', colourSecondary: '#46B946', colourTertiary: '#389438' }
  };
  const CAT = {
    events: '#FFBF00', control: '#FFAB19', operators: '#59C059', variables: '#FF8C1A', sensing: '#4C97FF',
    env: '#5CB1D6', outlets: '#0FBD8C', params: '#9966FF', ai: '#FF6680', display: '#CF63CF'
  };

  const DO = { type: 'input_statement', name: 'DO' };
  const COND = { type: 'input_value', name: 'COND', check: 'Boolean' };
  const OUTLET = { type: 'input_value', name: 'OUTLET', check: 'Number' };
  function num(name) { return { type: 'input_value', name: name, check: 'Number' }; }
  function stmt(o) { o.previousStatement = null; o.nextStatement = null; return o; }

  const OUTLET_PARAMS = [
    ['la puissance max (W)', '0'], ["le seuil d'alarme du capteur (W)", '1'], ['la priorité (1 à 4)', '2'],
    ["l'état au démarrage (0, 1 ou 2)", '3'], ['le délai entre commutations (s)', '4'], ['le seuil de veille (W)', '5']
  ];
  const GLOBAL_PARAMS = [
    ['la puissance souscrite (W)', '12'], ['la période de mesure (ms)', '10'], ['le lissage (nb de mesures)', '11'],
    ['le prix heures pleines (/kWh)', '13'], ['le prix heures creuses (/kWh)', '14'], ['la consigne de température (°C)', '15'],
    ["l'hystérésis (°C)", '16'], ['le seuil de luminosité (%)', '17'], ['le délai de présence (s)', '18'],
    ['le facteur CO₂ (g/kWh)', '19'], ["le seuil d'anomalie (z)", '20'], ['le k des k plus proches voisins', '21'],
    ['le début des heures creuses (min)', '22'], ['la fin des heures creuses (min)', '23']
  ];
  const QTY = [
    ['puissance P (W)', '2'], ['tension U (V)', '0'], ['courant I (A)', '1'], ['puissance apparente S (VA)', '3'],
    ['puissance réactive Q (var)', '4'], ['facteur de puissance', '5'], ['déphasage φ (°)', '13'], ['fréquence (Hz)', '6'],
    ["énergie aujourd'hui (Wh)", '8'], ["coût aujourd'hui", '9'], ["compteur d'énergie (kWh)", '7'], ["commutations aujourd'hui", '14']
  ];

  const DEFS = [
    // ------------------------------------------------------------ Événements
    { type: 'el_on_start', message0: '▶ quand le programme démarre', message1: '%1', args1: [DO], style: 'el_events', tooltip: 'Exécute les blocs une seule fois, au démarrage du programme.' },
    { type: 'el_every', message0: '⏱ toutes les %1 secondes', args0: [{ type: 'field_number', name: 'PERIOD', value: 5, min: 0.1, max: 86400, precision: 0.1 }], message1: '%1', args1: [DO], style: 'el_events', tooltip: 'Exécute les blocs régulièrement (la première fois dès le démarrage).' },
    { type: 'el_when', message0: '⚡ quand %1 devient vrai', args0: [COND], message1: '%1', args1: [DO], style: 'el_events', tooltip: "Exécute les blocs à l'instant où la condition passe de faux à vrai." },
    { type: 'el_at', message0: '🕐 chaque jour à %1 h %2', args0: [{ type: 'field_number', name: 'H', value: 7, min: 0, max: 23, precision: 1 }, { type: 'field_number', name: 'M', value: 0, min: 0, max: 59, precision: 1 }], message1: '%1', args1: [DO], style: 'el_events', tooltip: "Exécute les blocs chaque jour à l'heure indiquée (horloge du kit)." },
    { type: 'el_button', message0: '🔘 quand on appuie sur le bouton %1', args0: [{ type: 'field_dropdown', name: 'BTN', options: [['A', '1'], ['B', '2'], ['C', '3'], ['D', '4']] }], message1: '%1', args1: [DO], style: 'el_events', tooltip: "Exécute les blocs quand on appuie sur ce bouton dans l'application (console du programme)." },
    // ------------------------------------------------------------ Contrôle
    stmt({ type: 'el_wait', message0: 'attendre %1 secondes', args0: [num('SECS')], inputsInline: true, style: 'el_control', tooltip: 'Met ce script en pause. Les autres scripts continuent.' }),
    stmt({ type: 'el_repeat', message0: 'répéter %1 fois', args0: [num('TIMES')], message1: '%1', args1: [DO], inputsInline: true, style: 'el_control', tooltip: 'Répète les blocs un nombre donné de fois.' }),
    { type: 'el_forever', message0: 'répéter indéfiniment', message1: '%1', args1: [DO], previousStatement: null, style: 'el_control', tooltip: "Répète les blocs sans fin. Pensez à ajouter un bloc « attendre » à l'intérieur." },
    stmt({ type: 'el_while', message0: 'tant que %1', args0: [COND], message1: '%1', args1: [DO], style: 'el_control', tooltip: 'Répète les blocs tant que la condition est vraie.' }),
    stmt({ type: 'el_until', message0: "répéter jusqu'à ce que %1", args0: [COND], message1: '%1', args1: [DO], style: 'el_control', tooltip: 'Répète les blocs jusqu’à ce que la condition devienne vraie.' }),
    stmt({ type: 'el_wait_until', message0: "attendre jusqu'à ce que %1", args0: [COND], style: 'el_control', tooltip: 'Met ce script en pause jusqu’à ce que la condition soit vraie.' }),
    stmt({ type: 'el_if', message0: 'si %1 alors', args0: [COND], message1: '%1', args1: [DO], style: 'el_control', tooltip: 'Exécute les blocs seulement si la condition est vraie.' }),
    stmt({ type: 'el_ifelse', message0: 'si %1 alors', args0: [COND], message1: '%1', args1: [DO], message2: 'sinon', message3: '%1', args3: [{ type: 'input_statement', name: 'ELSE' }], style: 'el_control', tooltip: 'Choisit entre deux suites de blocs selon la condition.' }),
    { type: 'el_stop', message0: 'arrêter %1', args0: [{ type: 'field_dropdown', name: 'WHAT', options: [['ce script', '0'], ['tout le programme', '1']] }], previousStatement: null, style: 'el_control', tooltip: 'Arrête ce script ou tout le programme.' },
    // ------------------------------------------------------------ Opérateurs
    { type: 'el_arith', message0: '%1 %2 %3', args0: [num('A'), { type: 'field_dropdown', name: 'OP', options: [['+', 'ADD'], ['−', 'SUB'], ['×', 'MUL'], ['÷', 'DIV'], ['modulo', 'MOD']] }, num('B')], inputsInline: true, output: 'Number', style: 'el_operators', tooltip: 'Calcul. La division par zéro donne 0.' },
    { type: 'el_compare', message0: '%1 %2 %3', args0: [num('A'), { type: 'field_dropdown', name: 'OP', options: [['>', 'GT'], ['<', 'LT'], ['≥', 'GE'], ['≤', 'LE'], ['=', 'EQ'], ['≠', 'NE']] }, num('B')], inputsInline: true, output: 'Boolean', style: 'el_operators', tooltip: 'Compare deux nombres (vrai ou faux). Une mesure absente (--) rend la comparaison fausse.' },
    { type: 'el_logic', message0: '%1 %2 %3', args0: [{ type: 'input_value', name: 'A', check: 'Boolean' }, { type: 'field_dropdown', name: 'OP', options: [['et', 'AND'], ['ou', 'OR']] }, { type: 'input_value', name: 'B', check: 'Boolean' }], inputsInline: true, output: 'Boolean', style: 'el_operators', tooltip: '« et » : les deux conditions sont vraies ; « ou » : au moins une est vraie.' },
    { type: 'el_not', message0: 'non %1', args0: [{ type: 'input_value', name: 'A', check: 'Boolean' }], output: 'Boolean', style: 'el_operators', tooltip: 'Inverse la condition.' },
    { type: 'el_bool', message0: '%1', args0: [{ type: 'field_dropdown', name: 'V', options: [['vrai', '1'], ['faux', '0']] }], output: 'Boolean', style: 'el_operators', tooltip: 'Valeur logique.' },
    { type: 'el_math', message0: '%1 de %2', args0: [{ type: 'field_dropdown', name: 'FN', options: [['valeur absolue', '0'], ['arrondi', '1'], ['partie entière', '2'], ['arrondi supérieur', '3'], ['racine carrée', '4'], ['carré', '5']] }, num('A')], inputsInline: true, output: 'Number', style: 'el_operators', tooltip: 'Fonction mathématique.' },
    { type: 'el_minmax', message0: '%1 de %2 et %3', args0: [{ type: 'field_dropdown', name: 'OP', options: [['minimum', 'MIN'], ['maximum', 'MAX']] }, num('A'), num('B')], inputsInline: true, output: 'Number', style: 'el_operators', tooltip: 'Le plus petit ou le plus grand des deux nombres.' },
    { type: 'el_random', message0: 'nombre aléatoire entre %1 et %2', args0: [num('A'), num('B')], inputsInline: true, output: 'Number', style: 'el_operators', tooltip: 'Nombre au hasard (entier si les deux bornes sont entières).' },
    { type: 'el_between', message0: '%1 est entre %2 et %3', args0: [num('X'), num('A'), num('B')], inputsInline: true, output: 'Boolean', style: 'el_operators', tooltip: 'Vrai si la valeur est comprise entre les deux bornes (incluses).' },
    // ------------------------------------------------------------ Mesures
    { type: 'el_sensor', message0: '%1 de la prise %2', args0: [{ type: 'field_dropdown', name: 'QTY', options: QTY }, OUTLET], inputsInline: true, output: 'Number', style: 'el_sensing', tooltip: 'Mesure fournie par le capteur PZEM-004T de la prise.' },
    { type: 'el_outlet_state', message0: 'la prise %1 est %2', args0: [OUTLET, { type: 'field_dropdown', name: 'STATE', options: [['allumée', '10'], ['éteinte', '-10'], ['verrouillée (protection)', '12'], ['en ligne (capteur OK)', '11']] }], inputsInline: true, output: 'Boolean', style: 'el_sensing', tooltip: 'État de la prise.' },
    { type: 'el_global', message0: '%1', args0: [{ type: 'field_dropdown', name: 'Q', options: [['puissance totale (W)', '0'], ["énergie totale aujourd'hui (Wh)", '1'], ["coût total aujourd'hui", '2'], ['tension moyenne (V)', '15'], ['pointe de puissance du jour (W)', '16'], ["CO₂ émis aujourd'hui (g)", '17'], ['nombre de prises allumées', '18'], ['prix actuel du kWh', '14']] }], output: 'Number', style: 'el_sensing', tooltip: 'Grandeur pour toute la maison.' },
    { type: 'el_env', message0: '%1', args0: [{ type: 'field_dropdown', name: 'Q', options: [['température (°C)', '3'], ['luminosité (%)', '5'], ['humidité (%)', '4']] }], output: 'Number', style: 'el_env', tooltip: 'Capteurs d’ambiance (DHT22, photorésistance).' },
    { type: 'el_presence', message0: 'présence détectée', output: 'Boolean', style: 'el_env', tooltip: 'Vrai si le détecteur de mouvement a vu quelqu’un récemment (délai de présence).' },
    { type: 'el_time', message0: '%1', args0: [{ type: 'field_dropdown', name: 'Q', options: [['heure', '7'], ['minute', '8'], ['seconde', '9'], ['jour de la semaine (1 = lundi)', '10'], ['minutes depuis minuit', '11'], ['secondes depuis le démarrage du programme', '12']] }], output: 'Number', style: 'el_env', tooltip: 'Horloge du kit.' },
    { type: 'el_time_between', message0: "l'heure est entre %1 h %2 et %3 h %4", args0: [{ type: 'field_number', name: 'H1', value: 22, min: 0, max: 23, precision: 1 }, { type: 'field_number', name: 'M1', value: 0, min: 0, max: 59, precision: 1 }, { type: 'field_number', name: 'H2', value: 6, min: 0, max: 23, precision: 1 }, { type: 'field_number', name: 'M2', value: 0, min: 0, max: 59, precision: 1 }], output: 'Boolean', style: 'el_env', tooltip: 'Vrai entre les deux heures (la plage peut passer minuit). La seconde heure est exclue.' },
    { type: 'el_offpeak', message0: 'heures creuses en cours', output: 'Boolean', style: 'el_env', tooltip: 'Vrai pendant les heures creuses définies par le tarif.' },
    // ------------------------------------------------------------ Prises
    stmt({ type: 'el_relay', message0: '%1 la prise %2', args0: [{ type: 'field_dropdown', name: 'ACTION', options: [['allumer', '1'], ['éteindre', '0']] }, OUTLET], inputsInline: true, style: 'el_outlets', tooltip: 'Commande le relais de la prise (le délai minimum entre deux commutations est respecté).' }),
    stmt({ type: 'el_relay_all', message0: '%1 toutes les prises', args0: [{ type: 'field_dropdown', name: 'ACTION', options: [['allumer', '1'], ['éteindre', '0']] }], style: 'el_outlets', tooltip: 'Commande les quatre prises.' }),
    stmt({ type: 'el_toggle', message0: 'inverser la prise %1', args0: [OUTLET], inputsInline: true, style: 'el_outlets', tooltip: 'Allume la prise si elle est éteinte, l’éteint sinon.' }),
    stmt({ type: 'el_pulse', message0: 'allumer la prise %1 pendant %2 secondes', args0: [OUTLET, num('SECS')], inputsInline: true, style: 'el_outlets', tooltip: 'Minuterie : la prise s’éteint seule après la durée (le script continue tout de suite).' }),
    stmt({ type: 'el_relay_set', message0: "mettre la prise %1 à l'état %2", args0: [OUTLET, { type: 'input_value', name: 'STATE', check: 'Boolean' }], inputsInline: true, style: 'el_outlets', tooltip: 'Allume la prise si la condition est vraie, l’éteint sinon.' }),
    // ------------------------------------------------------------ Paramètres
    stmt({ type: 'el_param_outlet_set', message0: 'régler %1 de la prise %2 à %3', args0: [{ type: 'field_dropdown', name: 'PARAM', options: OUTLET_PARAMS }, OUTLET, num('VALUE')], inputsInline: true, style: 'el_params', tooltip: 'Change un paramètre du relais ou du capteur de la prise (dans les limites fixées par l’enseignant).' }),
    stmt({ type: 'el_param_set', message0: 'régler %1 à %2', args0: [{ type: 'field_dropdown', name: 'PARAM', options: GLOBAL_PARAMS }, num('VALUE')], inputsInline: true, style: 'el_params', tooltip: 'Change un paramètre du kit.' }),
    { type: 'el_param_outlet_get', message0: '%1 de la prise %2', args0: [{ type: 'field_dropdown', name: 'PARAM', options: OUTLET_PARAMS }, OUTLET], inputsInline: true, output: 'Number', style: 'el_params', tooltip: 'Valeur actuelle du paramètre.' },
    { type: 'el_param_get', message0: '%1', args0: [{ type: 'field_dropdown', name: 'PARAM', options: GLOBAL_PARAMS }], output: 'Number', style: 'el_params', tooltip: 'Valeur actuelle du paramètre.' },
    stmt({ type: 'el_reset_energy', message0: 'remettre à zéro le compteur de la prise %1', args0: [OUTLET], inputsInline: true, style: 'el_params', tooltip: 'Remet à zéro le compteur interne du capteur PZEM (autorisation de l’enseignant nécessaire).' }),
    // ------------------------------------------------------------ Intelligence
    { type: 'el_ai_avg', message0: 'moyenne de P de la prise %1 sur %2 s', args0: [OUTLET, num('N')], inputsInline: true, output: 'Number', style: 'el_ai', tooltip: 'Moyenne glissante de la puissance (filtre les variations rapides).' },
    { type: 'el_ai_total', message0: '%1 de la puissance totale sur %2 s', args0: [{ type: 'field_dropdown', name: 'Q', options: [['moyenne', '1'], ['maximum', '2']] }, num('N')], inputsInline: true, output: 'Number', style: 'el_ai', tooltip: 'Statistique sur l’historique (600 s maximum).' },
    { type: 'el_ai_trend', message0: 'tendance de la puissance totale sur %1 s (W/min)', args0: [num('N')], inputsInline: true, output: 'Number', style: 'el_ai', tooltip: 'Pente de la droite de régression linéaire : positive si la consommation augmente.' },
    { type: 'el_ai_forecast', message0: 'prévision de la puissance totale dans %1 min', args0: [num('N')], inputsInline: true, output: 'Number', style: 'el_ai', tooltip: 'Prévision par lissage exponentiel double (méthode de Holt).' },
    { type: 'el_ai_anomaly', message0: 'anomalie détectée sur la prise %1', args0: [OUTLET], inputsInline: true, output: 'Boolean', style: 'el_ai', tooltip: 'Vrai si la consommation s’écarte brutalement de son comportement habituel (score z).' },
    { type: 'el_ai_idle', message0: "durée d'inactivité de la prise %1 (s)", args0: [OUTLET], inputsInline: true, output: 'Number', style: 'el_ai', tooltip: 'Temps passé allumée sous le seuil de veille (appareil en veille ou inutilisé).' },
    stmt({ type: 'el_shed', message0: 'délester par priorités pour rester sous %1 W', args0: [num('LIMIT')], inputsInline: true, style: 'el_ai', tooltip: 'Une étape de délestage : coupe la prise la moins prioritaire si la limite est dépassée, rallume quand il y a de la marge.' }),
    // ------------------------------------------------------------ Alertes et affichage
    stmt({ type: 'el_alert', message0: "envoyer l'alerte %1", args0: [{ type: 'field_input', name: 'TEXT', text: 'Attention !' }], style: 'el_display', tooltip: 'Affiche une alerte sur l’application et sur l’écran du kit.' }),
    stmt({ type: 'el_log', message0: 'écrire %1', args0: [{ type: 'field_input', name: 'TEXT', text: 'Bonjour' }], style: 'el_display', tooltip: 'Écrit un message dans la console du programme.' }),
    stmt({ type: 'el_log_value', message0: 'écrire %1 %2', args0: [{ type: 'field_input', name: 'TEXT', text: 'P =' }, { type: 'input_value', name: 'VALUE' }], inputsInline: true, style: 'el_display', tooltip: 'Écrit un message suivi d’une valeur dans la console.' }),
    stmt({ type: 'el_beep', message0: 'bip %1', args0: [{ type: 'field_dropdown', name: 'KIND', options: [['court', '0'], ['long', '1'], ['alarme', '2'], ['succès', '3']] }], style: 'el_display', tooltip: 'Joue un son sur le buzzer du kit.' }),
    stmt({ type: 'el_screen', message0: "afficher sur l'écran du kit %1", args0: [{ type: 'field_input', name: 'TEXT', text: 'Bonjour !' }], style: 'el_display', tooltip: 'Affiche un message pendant 10 s sur l’écran OLED du kit.' })
  ];

  let defined = false;
  function define(Blockly) {
    if (defined) return;
    defined = true;
    Blockly.common.defineBlocksWithJsonArray(DEFS);
    Blockly.Blocks.el_outlet_menu = {
      init: function () {
        this.appendDummyInput().appendField(new Blockly.FieldDropdown(outletOptions), 'OUTLET');
        this.setOutput(true, 'Number');
        this.setStyle('el_sensing');
        this.setTooltip('Numéro de la prise (on peut aussi y glisser une variable).');
      }
    };
    Blockly.Blocks.el_ai_appliance = {
      init: function () {
        this.appendValueInput('OUTLET').setCheck('Number').appendField("l'appareil reconnu sur la prise");
        this.appendDummyInput().appendField('est').appendField(new Blockly.FieldDropdown(labelOptions), 'LABEL');
        this.setInputsInline(true);
        this.setOutput(true, 'Boolean');
        this.setStyle('el_ai');
        this.setTooltip('Intelligence artificielle : reconnaissance de l’appareil par les k plus proches voisins (à entraîner dans l’onglet IA).');
      }
    };
  }

  function theme(Blockly) {
    return Blockly.Theme.defineTheme('energylab', {
      base: Blockly.Themes.Classic,
      blockStyles: STYLES,
      categoryStyles: {},
      componentStyles: {
        workspaceBackgroundColour: '#F7F8FA', toolboxBackgroundColour: '#FFFFFF', toolboxForegroundColour: '#3B4252',
        flyoutBackgroundColour: '#EEF1F5', flyoutForegroundColour: '#3B4252', flyoutOpacity: 0.96,
        scrollbarColour: '#C9CED6', insertionMarkerColour: '#000000', insertionMarkerOpacity: 0.25
      },
      fontStyle: { family: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', weight: '600', size: 11 },
      startHats: true
    });
  }

  // ---------------------------------------------------------------- boîte à outils
  function sh(type, fields) { return { shadow: { type: type, fields: fields || {} } }; }
  function n(v) { return sh('math_number', { NUM: v }); }
  function out(k) { return sh('el_outlet_menu', { OUTLET: String(k || 1) }); }
  function b(type, inputs, fields) { const o = { kind: 'block', type: type }; if (inputs) o.inputs = inputs; if (fields) o.fields = fields; return o; }
  // bloc imbriqué (sans « kind »)
  function nb(type, inputs, fields) { const o = { type: type }; if (inputs) o.inputs = inputs; if (fields) o.fields = fields; return o; }
  function label(text) { return { kind: 'label', text: text }; }

  function toolbox() {
    return {
      kind: 'categoryToolbox',
      contents: [
        { kind: 'category', name: 'Événements', colour: CAT.events, contents: [
          b('el_on_start'), b('el_every'), b('el_when', { COND: { block: nb('el_compare', { A: { block: nb('el_global') }, B: n(1500) }) } }), b('el_at'), b('el_button')
        ] },
        { kind: 'category', name: 'Contrôle', colour: CAT.control, contents: [
          b('el_wait', { SECS: n(1) }), b('el_repeat', { TIMES: n(4) }), b('el_forever'), b('el_if'), b('el_ifelse'),
          b('el_while'), b('el_until'), b('el_wait_until'), b('el_stop')
        ] },
        { kind: 'category', name: 'Opérateurs', colour: CAT.operators, contents: [
          b('el_compare', { A: n(0), B: n(100) }), b('el_logic'), b('el_not'), b('el_bool'),
          b('el_arith', { A: n(0), B: n(0) }), b('el_minmax', { A: n(0), B: n(0) }), b('el_math', { A: n(0) }),
          b('el_between', { X: n(0), A: n(0), B: n(10) }), b('el_random', { A: n(1), B: n(10) }), b('math_number')
        ] },
        { kind: 'category', name: 'Variables', colour: CAT.variables, custom: 'VARIABLE' },
        { kind: 'category', name: 'Mesures', colour: CAT.sensing, contents: [
          label('Mesures de chaque prise'),
          b('el_sensor', { OUTLET: out(1) }), b('el_outlet_state', { OUTLET: out(1) }),
          label('Toute la maison'), b('el_global'),
          label('Ambiance et temps'), b('el_env'), b('el_presence'), b('el_time'), b('el_time_between'), b('el_offpeak')
        ] },
        { kind: 'category', name: 'Prises', colour: CAT.outlets, contents: [
          b('el_relay', { OUTLET: out(1) }), b('el_relay_all'), b('el_toggle', { OUTLET: out(1) }),
          b('el_pulse', { OUTLET: out(1), SECS: n(10) }), b('el_relay_set', { OUTLET: out(1) })
        ] },
        { kind: 'category', name: 'Paramètres', colour: CAT.params, contents: [
          label('Relais et capteur de chaque prise'),
          b('el_param_outlet_set', { OUTLET: out(1), VALUE: n(1500) }), b('el_param_outlet_get', { OUTLET: out(1) }),
          label('Paramètres du kit'),
          b('el_param_set', { VALUE: n(3000) }), b('el_param_get'), b('el_reset_energy', { OUTLET: out(1) })
        ] },
        { kind: 'category', name: 'Intelligence', colour: CAT.ai, contents: [
          b('el_shed', { LIMIT: { block: nb('el_param_get', null, { PARAM: '12' }) } }),
          b('el_ai_forecast', { N: n(5) }), b('el_ai_trend', { N: n(120) }), b('el_ai_avg', { OUTLET: out(1), N: n(30) }),
          b('el_ai_total', { N: n(60) }), b('el_ai_anomaly', { OUTLET: out(1) }), b('el_ai_idle', { OUTLET: out(1) }),
          b('el_ai_appliance', { OUTLET: out(1) })
        ] },
        { kind: 'category', name: 'Alertes', colour: CAT.display, contents: [
          b('el_alert'), b('el_log'), b('el_log_value', { VALUE: { block: nb('el_global') } }), b('el_beep'), b('el_screen')
        ] }
      ]
    };
  }

  EL.blocks = { define, theme, toolbox, dyn, outletOptions, labelOptions, DEFS, STYLES, CAT, OUTLET_PARAMS, GLOBAL_PARAMS, QTY };
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ---- 42_compiler.js ---- */
/* EnergyLab — compilateur : espace de travail Blockly -> bytecode (docs/specs/bytecode.md)
 * Produit aussi un pseudo-code lisible et un listing « assembleur » pour l'apprentissage. */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  const OP = EL.vm.OP;

  const OPNAME = {};
  for (const k of Object.keys(OP)) OPNAME[OP[k]] = k;

  const ARITH = { ADD: OP.ADD, SUB: OP.SUB, MUL: OP.MUL, DIV: OP.DIV, MOD: OP.MOD };
  const CMP = { LT: OP.LT, LE: OP.LE, GT: OP.GT, GE: OP.GE, EQ: OP.EQ, NE: OP.NE };

  class Ctx {
    constructor() {
      this.code = [];
      this.varIds = new Map();
      this.vars = [];
      this.strs = [];
      this.strIdx = new Map();
      this.ranges = [];
      this.warnings = [];
      this.errors = [];
      this.temp = 0;
    }
    emit(op, arg) {
      const pc = this.code.length;
      this.code.push(op);
      if (EL.vm.opArgCount(op) === 1) this.code.push(arg === undefined ? 0 : arg);
      return pc;
    }
    here() { return this.code.length; }
    patch(pos, addr) { this.code[pos + 1] = addr; }
    varIndex(model) {
      const id = model.getId();
      if (!this.varIds.has(id)) { this.varIds.set(id, this.vars.length); this.vars.push(model.getName()); }
      return this.varIds.get(id);
    }
    tempVar() { const i = this.vars.length; this.vars.push('#boucle' + (++this.temp)); return i; }
    str(text) {
      let t = String(text === undefined || text === null ? '' : text);
      if (t.length > 80) t = t.slice(0, 80);
      if (!this.strIdx.has(t)) { this.strIdx.set(t, this.strs.length); this.strs.push(t); }
      return this.strIdx.get(t);
    }
    warn(block, msg) { this.warnings.push({ id: block ? block.id : null, msg: msg }); }
    error(block, msg) { this.errors.push({ id: block ? block.id : null, msg: msg }); }
  }

  function numField(b, name, lo, hi, def) {
    let v = Number(b.getFieldValue(name));
    if (!Number.isFinite(v)) v = def;
    if (lo !== undefined) v = Math.max(lo, v);
    if (hi !== undefined) v = Math.min(hi, v);
    return v;
  }

  function expr(ctx, b, parent, what) {
    if (!b) {
      ctx.warn(parent, 'Il manque une valeur' + (what ? ' (' + what + ')' : '') + ' : 0 sera utilisé.');
      ctx.emit(OP.PUSH, 0);
      return;
    }
    if (!b.isEnabled()) { ctx.warn(b, 'Bloc désactivé : 0 sera utilisé.'); ctx.emit(OP.PUSH, 0); return; }
    const inp = function (name, w) { expr(ctx, b.getInputTargetBlock(name), b, w); };
    switch (b.type) {
      case 'math_number': ctx.emit(OP.PUSH, numField(b, 'NUM', undefined, undefined, 0)); break;
      case 'el_outlet_menu': ctx.emit(OP.PUSH, Number(b.getFieldValue('OUTLET')) || 1); break;
      case 'el_bool': ctx.emit(OP.PUSH, Number(b.getFieldValue('V'))); break;
      case 'el_arith': inp('A'); inp('B'); ctx.emit(ARITH[b.getFieldValue('OP')]); break;
      case 'el_compare': inp('A'); inp('B'); ctx.emit(CMP[b.getFieldValue('OP')]); break;
      case 'el_logic': inp('A', 'condition'); inp('B', 'condition'); ctx.emit(b.getFieldValue('OP') === 'AND' ? OP.AND : OP.OR); break;
      case 'el_not': inp('A', 'condition'); ctx.emit(OP.NOT); break;
      case 'el_math': inp('A'); ctx.emit(OP.FN, Number(b.getFieldValue('FN'))); break;
      case 'el_minmax': inp('A'); inp('B'); ctx.emit(b.getFieldValue('OP') === 'MIN' ? OP.MIN : OP.MAX); break;
      case 'el_random': inp('A'); inp('B'); ctx.emit(OP.RAND); break;
      case 'el_between': inp('X'); inp('A'); inp('B'); ctx.emit(OP.BETWEEN); break;
      case 'variables_get': {
        const v = b.getField('VAR').getVariable();
        if (!v) { ctx.error(b, 'Variable inconnue'); ctx.emit(OP.PUSH, 0); break; }
        ctx.emit(OP.LOAD, ctx.varIndex(v));
        break;
      }
      case 'el_sensor': inp('OUTLET', 'prise'); ctx.emit(OP.SENS, Number(b.getFieldValue('QTY'))); break;
      case 'el_outlet_state': {
        const q = Number(b.getFieldValue('STATE'));
        inp('OUTLET', 'prise');
        ctx.emit(OP.SENS, Math.abs(q));
        if (q < 0) ctx.emit(OP.NOT);
        break;
      }
      case 'el_global': case 'el_env': case 'el_time': ctx.emit(OP.SENSG, Number(b.getFieldValue('Q'))); break;
      case 'el_presence': ctx.emit(OP.SENSG, 6); break;
      case 'el_offpeak': ctx.emit(OP.SENSG, 13); break;
      case 'el_time_between': {
        const a = numField(b, 'H1', 0, 23, 0) * 60 + numField(b, 'M1', 0, 59, 0);
        const z = numField(b, 'H2', 0, 23, 0) * 60 + numField(b, 'M2', 0, 59, 0);
        ctx.emit(OP.SENSG, 11); ctx.emit(OP.PUSH, a); ctx.emit(OP.GE);
        ctx.emit(OP.SENSG, 11); ctx.emit(OP.PUSH, z); ctx.emit(OP.LT);
        ctx.emit(a <= z ? OP.AND : OP.OR);
        break;
      }
      case 'el_param_outlet_get': inp('OUTLET', 'prise'); ctx.emit(OP.PARGET, Number(b.getFieldValue('PARAM'))); break;
      case 'el_param_get': ctx.emit(OP.PUSH, 0); ctx.emit(OP.PARGET, Number(b.getFieldValue('PARAM'))); break;
      case 'el_ai_avg': inp('OUTLET', 'prise'); inp('N', 'durée'); ctx.emit(OP.AI, 0); break;
      case 'el_ai_total': inp('N', 'durée'); ctx.emit(OP.AI, Number(b.getFieldValue('Q'))); break;
      case 'el_ai_trend': inp('N', 'durée'); ctx.emit(OP.AI, 3); break;
      case 'el_ai_forecast': inp('N', 'minutes'); ctx.emit(OP.AI, 4); break;
      case 'el_ai_anomaly': inp('OUTLET', 'prise'); ctx.emit(OP.AI, 5); break;
      case 'el_ai_idle': inp('OUTLET', 'prise'); ctx.emit(OP.AI, 6); break;
      case 'el_ai_appliance': inp('OUTLET', 'prise'); ctx.emit(OP.AI, 7); ctx.emit(OP.PUSH, Number(b.getFieldValue('LABEL'))); ctx.emit(OP.EQ); break;
      default:
        ctx.error(b, 'Ce bloc ne peut pas être utilisé comme valeur');
        ctx.emit(OP.PUSH, 0);
    }
  }

  function stmts(ctx, b) {
    while (b) {
      if (b.isEnabled()) stmt(ctx, b);
      b = b.getNextBlock();
    }
  }

  function stmt(ctx, b) {
    const start = ctx.here();
    const inp = function (name, w) { expr(ctx, b.getInputTargetBlock(name), b, w); };
    const body = function (name) { stmts(ctx, b.getInputTargetBlock(name || 'DO')); };
    switch (b.type) {
      case 'el_wait': inp('SECS', 'secondes'); ctx.emit(OP.WAIT); break;
      case 'el_repeat': {
        const t = ctx.tempVar();
        inp('TIMES', 'nombre de fois'); ctx.emit(OP.FN, 1); ctx.emit(OP.STORE, t);
        const L = ctx.here();
        ctx.emit(OP.LOAD, t); ctx.emit(OP.PUSH, 0); ctx.emit(OP.GT);
        const j = ctx.emit(OP.JZ, 0);
        body();
        ctx.emit(OP.LOAD, t); ctx.emit(OP.PUSH, 1); ctx.emit(OP.SUB); ctx.emit(OP.STORE, t);
        ctx.emit(OP.YIELD); ctx.emit(OP.JMP, L);
        ctx.patch(j, ctx.here());
        break;
      }
      case 'el_forever': {
        const L = ctx.here();
        if (!b.getInputTargetBlock('DO')) ctx.warn(b, 'Boucle vide.');
        else if (!containsWait(b.getInputTargetBlock('DO'))) ctx.warn(b, 'Boucle sans « attendre » : elle tourne en permanence. Ajoutez « attendre 1 secondes » pour laisser le temps aux mesures de changer.');
        body(); ctx.emit(OP.YIELD); ctx.emit(OP.JMP, L);
        break;
      }
      case 'el_while': case 'el_until': {
        const L = ctx.here();
        inp('COND', 'condition');
        const j = ctx.emit(b.type === 'el_while' ? OP.JZ : OP.JNZ, 0);
        body(); ctx.emit(OP.YIELD); ctx.emit(OP.JMP, L);
        ctx.patch(j, ctx.here());
        break;
      }
      case 'el_wait_until': {
        const L = ctx.here();
        inp('COND', 'condition');
        const j = ctx.emit(OP.JNZ, 0);
        ctx.emit(OP.PUSH, 0); ctx.emit(OP.WAIT); ctx.emit(OP.JMP, L);
        ctx.patch(j, ctx.here());
        break;
      }
      case 'el_if': {
        inp('COND', 'condition');
        const j = ctx.emit(OP.JZ, 0);
        body();
        ctx.patch(j, ctx.here());
        break;
      }
      case 'el_ifelse': {
        inp('COND', 'condition');
        const j = ctx.emit(OP.JZ, 0);
        body('DO');
        const k = ctx.emit(OP.JMP, 0);
        ctx.patch(j, ctx.here());
        body('ELSE');
        ctx.patch(k, ctx.here());
        break;
      }
      case 'el_stop': ctx.emit(OP.STOP, Number(b.getFieldValue('WHAT'))); break;
      case 'variables_set': {
        const v = b.getField('VAR').getVariable();
        inp('VALUE', 'valeur');
        ctx.emit(OP.STORE, ctx.varIndex(v));
        break;
      }
      case 'math_change': {
        const v = b.getField('VAR').getVariable();
        const i = ctx.varIndex(v);
        ctx.emit(OP.LOAD, i); inp('DELTA', 'valeur'); ctx.emit(OP.ADD); ctx.emit(OP.STORE, i);
        break;
      }
      case 'el_relay': inp('OUTLET', 'prise'); ctx.emit(OP.PUSH, Number(b.getFieldValue('ACTION'))); ctx.emit(OP.RELAY); break;
      case 'el_relay_all': ctx.emit(OP.PUSH, 0); ctx.emit(OP.PUSH, Number(b.getFieldValue('ACTION'))); ctx.emit(OP.RELAY); break;
      case 'el_toggle': inp('OUTLET', 'prise'); ctx.emit(OP.TOGGLE); break;
      case 'el_pulse': inp('OUTLET', 'prise'); inp('SECS', 'secondes'); ctx.emit(OP.PULSE); break;
      case 'el_relay_set': inp('OUTLET', 'prise'); inp('STATE', 'état'); ctx.emit(OP.RELAY); break;
      case 'el_param_outlet_set': inp('OUTLET', 'prise'); inp('VALUE', 'valeur'); ctx.emit(OP.PARSET, Number(b.getFieldValue('PARAM'))); break;
      case 'el_param_set': ctx.emit(OP.PUSH, 0); inp('VALUE', 'valeur'); ctx.emit(OP.PARSET, Number(b.getFieldValue('PARAM'))); break;
      case 'el_reset_energy': inp('OUTLET', 'prise'); ctx.emit(OP.RESETE); break;
      case 'el_shed': inp('LIMIT', 'limite'); ctx.emit(OP.SHED); break;
      case 'el_alert': ctx.emit(OP.ALERT, ctx.str(b.getFieldValue('TEXT'))); break;
      case 'el_log': ctx.emit(OP.LOG, ctx.str(b.getFieldValue('TEXT'))); break;
      case 'el_log_value': inp('VALUE', 'valeur'); ctx.emit(OP.LOGV, ctx.str(b.getFieldValue('TEXT'))); break;
      case 'el_beep': ctx.emit(OP.BEEP, Number(b.getFieldValue('KIND'))); break;
      case 'el_screen': ctx.emit(OP.SCREEN, ctx.str(b.getFieldValue('TEXT'))); break;
      default:
        ctx.error(b, 'Ce bloc ne peut pas être placé ici');
    }
    ctx.ranges.push({ id: b.id, start: start, end: ctx.here() });
  }

  function containsWait(b) {
    while (b) {
      if (b.type === 'el_wait' || b.type === 'el_wait_until' || b.type === 'el_forever') return true;
      for (const inp of b.inputList || []) {
        const t = inp.connection && inp.connection.targetBlock && inp.connection.targetBlock();
        if (t && inp.type === 3 /* statement */ && containsWait(t)) return true;
      }
      b = b.getNextBlock();
    }
    return false;
  }

  const HATS = { el_on_start: 1, el_every: 1, el_when: 1, el_at: 1, el_button: 1 };

  // Compile l'espace de travail. Renvoie {ok, bc, errors, warnings, ranges}
  function compile(ws, name) {
    const ctx = new Ctx();
    const scripts = [];
    const tops = ws.getTopBlocks(true);
    for (const top of tops) {
      if (!top.isEnabled()) continue;
      if (!HATS[top.type]) {
        ctx.warn(top, "Ce bloc n'est accroché à aucun événement : il ne sera pas exécuté.");
        continue;
      }
      const hatStart = ctx.here();
      if (top.type === 'el_when') {
        const cond = ctx.here();
        expr(ctx, top.getInputTargetBlock('COND'), top, 'condition');
        ctx.emit(OP.END);
        const entry = ctx.here();
        stmts(ctx, top.getInputTargetBlock('DO'));
        ctx.emit(OP.END);
        scripts.push({ type: 2, entry: entry, cond: cond });
      } else {
        const entry = ctx.here();
        stmts(ctx, top.getInputTargetBlock('DO'));
        ctx.emit(OP.END);
        const s = { type: 0, entry: entry };
        if (top.type === 'el_every') { s.type = 1; s.period = numField(top, 'PERIOD', 0.1, 86400, 1); }
        else if (top.type === 'el_at') { s.type = 3; s.h = numField(top, 'H', 0, 23, 0); s.m = numField(top, 'M', 0, 59, 0); }
        else if (top.type === 'el_button') { s.type = 4; s.btn = Number(top.getFieldValue('BTN')) || 1; }
        scripts.push(s);
      }
      if (!top.getInputTargetBlock('DO')) ctx.warn(top, 'Événement sans blocs à exécuter.');
      ctx.ranges.push({ id: top.id, start: hatStart, end: ctx.here(), hat: true });
    }
    if (!scripts.length) ctx.error(null, "Ajoutez au moins un bloc d'événement (catégorie Événements), par exemple « ▶ quand le programme démarre ».");
    if (ctx.code.length > EL.vm.LIM.MAX_CODE) ctx.error(null, 'Programme trop long (' + ctx.code.length + ' nombres, maximum ' + EL.vm.LIM.MAX_CODE + ').');
    if (ctx.vars.length > EL.vm.LIM.MAX_VARS) ctx.error(null, 'Trop de variables (64 maximum).');
    if (ctx.strs.length > EL.vm.LIM.MAX_STRS) ctx.error(null, 'Trop de textes différents (64 maximum).');
    const codeStr = ctx.code.join(' ');
    const bc = {
      fmt: 'elab-bc', v: 1, name: (name || 'Mon programme').slice(0, 40),
      code: codeStr, scripts: scripts, vars: ctx.vars, strs: ctx.strs
    };
    bc.hash = EL.util.fnv1a(codeStr + '|' + JSON.stringify(scripts) + '|' + JSON.stringify(ctx.strs) + '|' + JSON.stringify(ctx.vars));
    if (!ctx.errors.length) {
      const err = EL.vm.validate(EL.vm.normalize(bc));
      if (err) ctx.error(null, 'Erreur interne du compilateur : ' + err);
    }
    return { ok: ctx.errors.length === 0, bc: bc, errors: ctx.errors, warnings: ctx.warnings, ranges: ctx.ranges, size: ctx.code.length };
  }

  // Bloc en cours d'exécution pour un pc donné (plus petite plage qui le contient)
  function blockAtPc(ranges, code, pc) {
    if (pc < 0) return null;
    let p = pc;
    if (pc > 0 && code) {
      const prev = code[pc - 1];
      if (prev === OP.WAIT || prev === OP.YIELD) p = pc - 1;
      else if (pc > 1 && code[pc - 2] === OP.JMP) p = pc - 2;
    }
    let best = null;
    for (const r of ranges) {
      if (r.hat) continue;
      if (p >= r.start && p < r.end && (!best || r.end - r.start < best.end - best.start)) best = r;
    }
    return best ? best.id : null;
  }

  // Listing « assembleur » commenté
  function disassemble(bc) {
    const p = EL.vm.normalize(bc);
    const lines = [];
    const entries = {};
    p.scripts.forEach(function (s, i) {
      const tn = ['au démarrage', 'toutes les ' + s.period + ' s', 'quand la condition devient vraie', 'chaque jour à ' + s.h + ':' + String(s.m).padStart(2, '0'), 'bouton ' + 'ABCD'[s.btn - 1]][s.type];
      entries[s.entry] = (entries[s.entry] || '') + '; ── script ' + (i + 1) + ' : ' + tn;
      if (s.type === 2) entries[s.cond] = (entries[s.cond] || '') + '; ── condition du script ' + (i + 1);
    });
    let pc = 0;
    while (pc < p.code.length) {
      if (entries[pc]) lines.push(entries[pc]);
      const op = p.code[pc];
      const na = EL.vm.opArgCount(op);
      let arg = na ? p.code[pc + 1] : '';
      let note = '';
      if (op === OP.LOAD || op === OP.STORE) note = p.vars[arg];
      if (op === OP.ALERT || op === OP.LOG || op === OP.LOGV || op === OP.SCREEN) note = '"' + p.strs[arg] + '"';
      lines.push(String(pc).padStart(4, ' ') + '  ' + (OPNAME[op] || '?').padEnd(8, ' ') + String(arg).padEnd(8, ' ') + (note ? ' ; ' + note : ''));
      pc += 1 + na;
    }
    return lines.join('\n');
  }

  // ---------------------------------------------------------------- pseudo-code (français)
  function pseudo(ws) {
    const out = [];
    const ind = function (n) { return '    '.repeat(n); };
    const outletTxt = function (b, name) {
      const t = b.getInputTargetBlock(name);
      if (t && t.type === 'el_outlet_menu') return t.getFieldValue('OUTLET');
      return '(' + e(t) + ')';
    };
    function fieldText(b, name) {
      const f = b.getField(name);
      return f ? String(f.getText()) : '';
    }
    function e(b) {
      if (!b) return '?';
      switch (b.type) {
        case 'math_number': return String(b.getFieldValue('NUM'));
        case 'el_outlet_menu': return b.getFieldValue('OUTLET');
        case 'el_bool': return b.getFieldValue('V') === '1' ? 'VRAI' : 'FAUX';
        case 'el_arith': return '(' + e(b.getInputTargetBlock('A')) + ' ' + fieldText(b, 'OP') + ' ' + e(b.getInputTargetBlock('B')) + ')';
        case 'el_compare': return e(b.getInputTargetBlock('A')) + ' ' + fieldText(b, 'OP') + ' ' + e(b.getInputTargetBlock('B'));
        case 'el_logic': return '(' + e(b.getInputTargetBlock('A')) + ' ' + fieldText(b, 'OP').toUpperCase() + ' ' + e(b.getInputTargetBlock('B')) + ')';
        case 'el_not': return 'NON (' + e(b.getInputTargetBlock('A')) + ')';
        case 'el_math': return fieldText(b, 'FN') + '(' + e(b.getInputTargetBlock('A')) + ')';
        case 'el_minmax': return fieldText(b, 'OP') + '(' + e(b.getInputTargetBlock('A')) + ', ' + e(b.getInputTargetBlock('B')) + ')';
        case 'el_random': return 'aléatoire(' + e(b.getInputTargetBlock('A')) + ', ' + e(b.getInputTargetBlock('B')) + ')';
        case 'el_between': return e(b.getInputTargetBlock('X')) + ' entre ' + e(b.getInputTargetBlock('A')) + ' et ' + e(b.getInputTargetBlock('B'));
        case 'variables_get': { const v = b.getField('VAR').getVariable(); return v ? v.getName() : '?'; }
        case 'el_sensor': return fieldText(b, 'QTY') + '[prise ' + outletTxt(b, 'OUTLET') + ']';
        case 'el_outlet_state': return 'prise ' + outletTxt(b, 'OUTLET') + ' ' + fieldText(b, 'STATE');
        case 'el_global': case 'el_env': case 'el_time': return fieldText(b, 'Q');
        case 'el_presence': return 'présence';
        case 'el_offpeak': return 'heures_creuses';
        case 'el_time_between': return 'heure entre ' + b.getFieldValue('H1') + 'h' + String(b.getFieldValue('M1')).padStart(2, '0') + ' et ' + b.getFieldValue('H2') + 'h' + String(b.getFieldValue('M2')).padStart(2, '0');
        case 'el_param_outlet_get': return fieldText(b, 'PARAM') + '[prise ' + outletTxt(b, 'OUTLET') + ']';
        case 'el_param_get': return fieldText(b, 'PARAM');
        case 'el_ai_avg': return 'moyenne_P(prise ' + outletTxt(b, 'OUTLET') + ', ' + e(b.getInputTargetBlock('N')) + ' s)';
        case 'el_ai_total': return fieldText(b, 'Q') + '_P_totale(' + e(b.getInputTargetBlock('N')) + ' s)';
        case 'el_ai_trend': return 'tendance(' + e(b.getInputTargetBlock('N')) + ' s)';
        case 'el_ai_forecast': return 'prévision(' + e(b.getInputTargetBlock('N')) + ' min)';
        case 'el_ai_anomaly': return 'anomalie(prise ' + outletTxt(b, 'OUTLET') + ')';
        case 'el_ai_idle': return 'inactivité(prise ' + outletTxt(b, 'OUTLET') + ')';
        case 'el_ai_appliance': return 'appareil(prise ' + outletTxt(b, 'OUTLET') + ') = « ' + fieldText(b, 'LABEL') + ' »';
        default: return '?';
      }
    }
    function s(b, n) {
      while (b) {
        if (!b.isEnabled()) { b = b.getNextBlock(); continue; }
        const i = ind(n);
        const d = function (name) { s(b.getInputTargetBlock(name || 'DO'), n + 1); };
        switch (b.type) {
          case 'el_wait': out.push(i + 'attendre ' + e(b.getInputTargetBlock('SECS')) + ' s'); break;
          case 'el_repeat': out.push(i + 'répéter ' + e(b.getInputTargetBlock('TIMES')) + ' fois :'); d(); break;
          case 'el_forever': out.push(i + 'répéter indéfiniment :'); d(); break;
          case 'el_while': out.push(i + 'tant que ' + e(b.getInputTargetBlock('COND')) + ' :'); d(); break;
          case 'el_until': out.push(i + "répéter jusqu'à ce que " + e(b.getInputTargetBlock('COND')) + ' :'); d(); break;
          case 'el_wait_until': out.push(i + "attendre jusqu'à ce que " + e(b.getInputTargetBlock('COND'))); break;
          case 'el_if': out.push(i + 'si ' + e(b.getInputTargetBlock('COND')) + ' alors :'); d(); break;
          case 'el_ifelse': out.push(i + 'si ' + e(b.getInputTargetBlock('COND')) + ' alors :'); d('DO'); out.push(i + 'sinon :'); d('ELSE'); break;
          case 'el_stop': out.push(i + 'arrêter ' + fieldText(b, 'WHAT')); break;
          case 'variables_set': { const v = b.getField('VAR').getVariable(); out.push(i + (v ? v.getName() : '?') + ' ← ' + e(b.getInputTargetBlock('VALUE'))); break; }
          case 'math_change': { const v = b.getField('VAR').getVariable(); const nm = v ? v.getName() : '?'; out.push(i + nm + ' ← ' + nm + ' + ' + e(b.getInputTargetBlock('DELTA'))); break; }
          case 'el_relay': out.push(i + fieldText(b, 'ACTION') + ' prise ' + outletTxt(b, 'OUTLET')); break;
          case 'el_relay_all': out.push(i + fieldText(b, 'ACTION') + ' toutes les prises'); break;
          case 'el_toggle': out.push(i + 'inverser prise ' + outletTxt(b, 'OUTLET')); break;
          case 'el_pulse': out.push(i + 'allumer prise ' + outletTxt(b, 'OUTLET') + ' pendant ' + e(b.getInputTargetBlock('SECS')) + ' s'); break;
          case 'el_relay_set': out.push(i + 'prise ' + outletTxt(b, 'OUTLET') + ' ← ' + e(b.getInputTargetBlock('STATE'))); break;
          case 'el_param_outlet_set': out.push(i + fieldText(b, 'PARAM') + '[prise ' + outletTxt(b, 'OUTLET') + '] ← ' + e(b.getInputTargetBlock('VALUE'))); break;
          case 'el_param_set': out.push(i + fieldText(b, 'PARAM') + ' ← ' + e(b.getInputTargetBlock('VALUE'))); break;
          case 'el_reset_energy': out.push(i + 'remettre à zéro compteur prise ' + outletTxt(b, 'OUTLET')); break;
          case 'el_shed': out.push(i + 'délester(limite = ' + e(b.getInputTargetBlock('LIMIT')) + ' W)'); break;
          case 'el_alert': out.push(i + 'alerte « ' + b.getFieldValue('TEXT') + ' »'); break;
          case 'el_log': out.push(i + 'écrire « ' + b.getFieldValue('TEXT') + ' »'); break;
          case 'el_log_value': out.push(i + 'écrire « ' + b.getFieldValue('TEXT') + ' », ' + e(b.getInputTargetBlock('VALUE'))); break;
          case 'el_beep': out.push(i + 'bip ' + fieldText(b, 'KIND')); break;
          case 'el_screen': out.push(i + 'écran « ' + b.getFieldValue('TEXT') + ' »'); break;
          default: out.push(i + '?');
        }
        b = b.getNextBlock();
      }
    }
    for (const top of ws.getTopBlocks(true)) {
      if (!top.isEnabled() || !HATS[top.type]) continue;
      switch (top.type) {
        case 'el_on_start': out.push('AU DÉMARRAGE :'); break;
        case 'el_every': out.push('TOUTES LES ' + top.getFieldValue('PERIOD') + ' SECONDES :'); break;
        case 'el_when': out.push('QUAND ' + e(top.getInputTargetBlock('COND')) + ' DEVIENT VRAI :'); break;
        case 'el_at': out.push('CHAQUE JOUR À ' + top.getFieldValue('H') + ' h ' + String(top.getFieldValue('M')).padStart(2, '0') + ' :'); break;
        case 'el_button': out.push('QUAND ON APPUIE SUR LE BOUTON ' + fieldText(top, 'BTN') + ' :'); break;
      }
      s(top.getInputTargetBlock('DO'), 1);
      out.push('');
    }
    return out.join('\n').trim() || '(programme vide)';
  }

  EL.compiler = { compile, blockAtPc, disassemble, pseudo, OPNAME };
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ---- 44_examples.js ---- */
/* EnergyLab — bibliothèque de programmes exemples et d'algorithmes intelligents
 * Chaque exemple est un programme à blocs (format de sérialisation Blockly) que l'apprenant
 * peut ouvrir, comprendre, modifier, simuler et envoyer au kit. */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};

  // ---------------------------------------------------------------- petit constructeur de blocs
  let _id = 0;
  function id() { return 'ex' + (++_id); }
  const n = function (v) { return { shadow: { type: 'math_number', id: id(), fields: { NUM: v } } }; };
  const out = function (k) { return { shadow: { type: 'el_outlet_menu', id: id(), fields: { OUTLET: String(k) } } }; };
  const val = function (block) { return { block: block }; };
  function B(type, fields, inputs) {
    const o = { type: type, id: id() };
    if (fields) o.fields = fields;
    if (inputs) o.inputs = inputs;
    return o;
  }
  // enchaîne des blocs instruction
  function seq(list) {
    list = list.filter(Boolean);
    for (let i = 0; i < list.length - 1; i++) list[i].next = { block: list[i + 1] };
    return list[0];
  }
  function body(list) { return { block: seq(list) }; }
  function hat(type, fields, inputs, stmts, x, y) {
    const h = B(type, fields, inputs || {});
    if (stmts && stmts.length) h.inputs.DO = body(stmts);
    h.x = x || 20;
    h.y = y || 20;
    return h;
  }
  // expressions
  const E = {
    num: function (v) { return B('math_number', { NUM: v }); },
    total: function () { return B('el_global', { Q: '0' }); },
    global: function (q) { return B('el_global', { Q: String(q) }); },
    sensor: function (q, k) { return B('el_sensor', { QTY: String(q) }, { OUTLET: out(k) }); },
    state: function (k, st) { return B('el_outlet_state', { STATE: String(st) }, { OUTLET: out(k) }); },
    env: function (q) { return B('el_env', { Q: String(q) }); },
    presence: function () { return B('el_presence'); },
    offpeak: function () { return B('el_offpeak'); },
    param: function (p) { return B('el_param_get', { PARAM: String(p) }); },
    cmp: function (a, op, b) { return B('el_compare', { OP: op }, { A: val(a), B: val(b) }); },
    arith: function (a, op, b) { return B('el_arith', { OP: op }, { A: val(a), B: val(b) }); },
    and: function (a, b) { return B('el_logic', { OP: 'AND' }, { A: val(a), B: val(b) }); },
    or: function (a, b) { return B('el_logic', { OP: 'OR' }, { A: val(a), B: val(b) }); },
    not: function (a) { return B('el_not', null, { A: val(a) }); },
    forecast: function (m) { return B('el_ai_forecast', null, { N: n(m) }); },
    idle: function (k) { return B('el_ai_idle', null, { OUTLET: out(k) }); },
    anomaly: function (k) { return B('el_ai_anomaly', null, { OUTLET: out(k) }); },
    appliance: function (k, label) { return B('el_ai_appliance', { LABEL: String(label) }, { OUTLET: out(k) }); },
    timeBetween: function (h1, m1, h2, m2) { return B('el_time_between', { H1: h1, M1: m1, H2: h2, M2: m2 }); },
    v: function (vid) { return B('variables_get', { VAR: { id: vid } }); }
  };
  // instructions
  const S = {
    relay: function (k, on) { return B('el_relay', { ACTION: on ? '1' : '0' }, { OUTLET: out(k) }); },
    relayAll: function (on) { return B('el_relay_all', { ACTION: on ? '1' : '0' }); },
    pulse: function (k, s) { return B('el_pulse', null, { OUTLET: out(k), SECS: n(s) }); },
    wait: function (s) { return B('el_wait', null, { SECS: n(s) }); },
    if_: function (cond, stmts) { const b = B('el_if', null, { COND: val(cond) }); b.inputs.DO = body(stmts); return b; },
    ifelse: function (cond, a, b2) { const b = B('el_ifelse', null, { COND: val(cond) }); b.inputs.DO = body(a); b.inputs.ELSE = body(b2); return b; },
    forever: function (stmts) { const b = B('el_forever'); b.inputs = { DO: body(stmts) }; return b; },
    repeat: function (t, stmts) { const b = B('el_repeat', null, { TIMES: n(t) }); b.inputs.DO = body(stmts); return b; },
    shed: function (limitExpr) { return B('el_shed', null, { LIMIT: val(limitExpr) }); },
    alert: function (t) { return B('el_alert', { TEXT: t }); },
    log: function (t) { return B('el_log', { TEXT: t }); },
    logv: function (t, e) { return B('el_log_value', { TEXT: t }, { VALUE: val(e) }); },
    beep: function (k) { return B('el_beep', { KIND: String(k) }); },
    screen: function (t) { return B('el_screen', { TEXT: t }); },
    setParam: function (p, v) { return B('el_param_set', { PARAM: String(p) }, { VALUE: n(v) }); },
    setOutletParam: function (p, k, v) { return B('el_param_outlet_set', { PARAM: String(p) }, { OUTLET: out(k), VALUE: n(v) }); },
    set: function (vid, e) { return B('variables_set', { VAR: { id: vid } }, { VALUE: val(e) }); },
    change: function (vid, d) { return B('math_change', { VAR: { id: vid } }, { DELTA: n(d) }); }
  };
  function ws(hats, vars) {
    return { blocks: { languageVersion: 0, blocks: hats }, variables: (vars || []).map(function (v) { return { name: v[1], id: v[0] }; }) };
  }

  // ---------------------------------------------------------------- les exemples
  const LIST = [
    {
      id: 'clignotant', level: 1, title: 'Mon premier programme : clignotant', cat: 'Débuter',
      summary: 'Allume et éteint la prise 1 toutes les 3 secondes.',
      concepts: ['séquence', 'boucle', 'attente'],
      explain: 'Un programme est une suite d’instructions. La boucle « répéter indéfiniment » recommence sans fin. Le bloc « attendre » laisse le temps de voir le changement. Remarque : le kit impose un délai minimum entre deux commutations pour protéger les appareils.',
      build: function () {
        return ws([hat('el_on_start', null, null, [S.forever([S.relay(1, true), S.wait(3), S.relay(1, false), S.wait(3)])])]);
      }
    },
    {
      id: 'minuterie', level: 1, title: 'Minuterie', cat: 'Débuter',
      summary: 'Allume la prise 1 pendant 60 s puis l’éteint, en affichant la puissance mesurée.',
      concepts: ['minuterie', 'mesure', 'console'],
      explain: 'Le bloc « allumer pendant » programme une extinction automatique. Pendant ce temps, le programme écrit la puissance mesurée dans la console.',
      build: function () {
        return ws([hat('el_on_start', null, null, [S.pulse(1, 60), S.wait(5), S.logv('Puissance de la prise 1 (W) :', E.sensor(2, 1))])]);
      }
    },
    {
      id: 'horaire', level: 1, title: 'Programmation horaire', cat: 'Débuter',
      summary: 'Allume la prise 2 à 7 h 00 et l’éteint à 7 h 30 chaque jour.',
      concepts: ['événement horaire', 'automatisation'],
      explain: 'Les blocs « chaque jour à » se déclenchent selon l’horloge du kit (synchronisée par l’application).',
      build: function () {
        return ws([
          hat('el_at', { H: 7, M: 0 }, null, [S.relay(2, true), S.log('Cuisine allumée (7 h 00)')], 20, 20),
          hat('el_at', { H: 7, M: 30 }, null, [S.relay(2, false), S.log('Cuisine éteinte (7 h 30)')], 20, 160)
        ]);
      }
    },
    {
      id: 'alerte', level: 2, title: 'Alerte de surconsommation', cat: 'Surveiller',
      summary: 'Déclenche une alerte sonore et visuelle quand la puissance totale dépasse la puissance souscrite.',
      concepts: ['événement conditionnel', 'seuil', 'alerte'],
      explain: 'Le bloc « quand … devient vrai » réagit au passage du seuil (front montant) : l’alerte n’est envoyée qu’une fois par dépassement.',
      build: function () {
        return ws([hat('el_when', null, { COND: val(E.cmp(E.total(), 'GT', E.param(12))) }, [S.alert('Consommation trop élevée !'), S.beep(2), S.logv('Puissance totale (W) :', E.total())])]);
      }
    },
    {
      id: 'delestage_simple', level: 2, title: 'Délestage simple du chauffage', cat: 'Optimiser',
      summary: 'Coupe le chauffage (prise 3) quand la puissance totale dépasse la puissance souscrite, le rallume quand il y a de la marge.',
      concepts: ['délestage', 'hystérésis', 'puissance souscrite'],
      explain: 'Pour éviter de couper le disjoncteur général, on coupe d’abord un appareil peu prioritaire (le chauffage supporte une courte coupure). L’écart entre le seuil de coupure et le seuil de remise en marche (1 200 W) évite les commutations trop fréquentes : c’est une hystérésis.',
      build: function () {
        return ws([hat('el_every', { PERIOD: 2 }, null, [
          S.if_(E.cmp(E.total(), 'GT', E.param(12)), [S.relay(3, false), S.log('Surcharge : chauffage coupé')]),
          S.if_(E.cmp(E.total(), 'LT', E.arith(E.param(12), 'SUB', E.num(1200))), [S.relay(3, true)])
        ])]);
      }
    },
    {
      id: 'delestage', level: 3, title: 'Délestage intelligent par priorités', cat: 'Optimiser', arena: 'pointe',
      summary: 'Toutes les 2 s, coupe la prise la moins prioritaire en cas de dépassement et rallume dès qu’il y a de la marge.',
      concepts: ['algorithme glouton', 'priorités', 'boucle de régulation'],
      explain: 'Algorithme glouton : à chaque étape, il choisit la meilleure action locale (couper la prise de priorité la plus faible). Il mémorise la puissance de chaque prise coupée et ne la rallume que si la marge est suffisante (90 % de la limite). Les priorités se règlent dans les paramètres (1 = la plus importante).',
      build: function () {
        return ws([
          hat('el_on_start', null, null, [S.setOutletParam(2, 2, 1), S.setOutletParam(2, 1, 2), S.setOutletParam(2, 4, 3), S.setOutletParam(2, 3, 4)], 20, 20),
          hat('el_every', { PERIOD: 2 }, null, [S.shed(E.param(12))], 20, 260)
        ]);
      }
    },
    {
      id: 'predictif', level: 4, title: 'Écrêtage de pointe prédictif', cat: 'Optimiser', arena: 'pointe',
      summary: 'Utilise la prévision de Holt : si la puissance prévue dans 5 min dépasse la limite, on déleste avec une marge de sécurité.',
      concepts: ['prévision', 'lissage exponentiel', 'anticipation'],
      explain: 'Au lieu de réagir quand la limite est dépassée, l’algorithme anticipe : la méthode de Holt estime le niveau et la tendance de la consommation pour prévoir la puissance future. Si la prévision dépasse la puissance souscrite, la limite de délestage est abaissée à 90 %.',
      build: function () {
        return ws([hat('el_every', { PERIOD: 3 }, null, [
          S.ifelse(E.cmp(E.forecast(5), 'GT', E.param(12)),
            [S.shed(E.arith(E.param(12), 'MUL', E.num(0.9)))],
            [S.shed(E.param(12))])
        ])]);
      }
    },
    {
      id: 'heures_creuses', level: 3, title: 'Heures creuses (chauffe-eau, lave-linge)', cat: 'Optimiser', arena: 'hiver',
      summary: 'N’alimente la prise 4 qu’en heures creuses, quand le kWh est moins cher.',
      concepts: ['tarification horaire', 'déplacement de charge'],
      explain: 'Certains appareils peuvent attendre (chauffe-eau à accumulation, lave-linge) : on décale leur consommation vers les heures creuses. Attention au confort : l’eau chaude doit rester suffisante le soir !',
      build: function () {
        return ws([hat('el_every', { PERIOD: 30 }, null, [S.ifelse(E.offpeak(), [S.relay(4, true)], [S.relay(4, false)])])]);
      }
    },
    {
      id: 'heures_creuses_plus', level: 4, title: 'Heures creuses + préchauffage', cat: 'Optimiser', arena: 'hiver',
      summary: 'Heures creuses, plus une relance de 15 h à 17 h (heures pleines peu chargées) pour garantir l’eau chaude du soir.',
      concepts: ['compromis coût / confort', 'planification'],
      explain: 'Amélioration de l’algorithme précédent : une courte relance l’après-midi, quand la maison consomme peu, évite de manquer d’eau chaude le soir tout en évitant la pointe de 18 h – 21 h.',
      build: function () {
        return ws([hat('el_every', { PERIOD: 30 }, null, [S.ifelse(E.or(E.offpeak(), E.timeBetween(15, 0, 17, 0)), [S.relay(4, true)], [S.relay(4, false)])])]);
      }
    },
    {
      id: 'thermostat', level: 3, title: 'Thermostat à hystérésis', cat: 'Confort', arena: 'hiver',
      summary: 'Régule la température avec le chauffage de la prise 3 : consigne ± hystérésis, et mode éco en l’absence d’occupants.',
      concepts: ['régulation tout-ou-rien', 'hystérésis', 'présence'],
      explain: 'Régulation « tout ou rien » : on chauffe sous (consigne − hystérésis), on arrête au-dessus de (consigne + hystérésis). Une hystérésis trop faible multiplie les commutations ; trop forte, elle dégrade le confort. Sans présence, le chauffage est coupé.',
      build: function () {
        return ws([hat('el_every', { PERIOD: 10 }, null, [
          S.ifelse(E.presence(), [
            S.if_(E.cmp(E.env(3), 'LT', E.arith(E.param(15), 'SUB', E.param(16))), [S.relay(3, true)]),
            S.if_(E.cmp(E.env(3), 'GT', E.arith(E.param(15), 'ADD', E.param(16))), [S.relay(3, false)])
          ], [S.relay(3, false)])
        ])]);
      }
    },
    {
      id: 'veille', level: 2, title: 'Tueur de veille', cat: 'Économiser', arena: 'veille',
      summary: 'Coupe le salon (prise 1) après 5 min d’inactivité si personne n’est là, et le rallume dès qu’une présence est détectée.',
      concepts: ['consommation de veille', 'détection d’inactivité'],
      explain: 'Les appareils en veille (décodeur, console, téléviseur…) consomment en permanence plusieurs watts. Sur une année, cela représente des dizaines de kWh. Au démarrage, le programme règle le seuil de veille de la prise à 20 W : en dessous, la prise est considérée comme inactive. Il utilise ensuite la durée d’inactivité et le détecteur de présence.',
      build: function () {
        return ws([
          hat('el_on_start', null, null, [S.setOutletParam(5, 1, 20), S.log('Seuil de veille du salon : 20 W')], 20, 20),
          hat('el_every', { PERIOD: 10 }, null, [
            S.if_(E.and(E.cmp(E.idle(1), 'GT', E.num(300)), E.not(E.presence())), [S.relay(1, false), S.log('Veille coupée : salon')]),
            S.if_(E.and(E.presence(), E.state(1, -10)), [S.relay(1, true)])
          ], 20, 170)
        ]);
      }
    },
    {
      id: 'eclairage', level: 2, title: 'Éclairage intelligent', cat: 'Économiser', arena: 'veille',
      summary: 'Allume la lampe (prise 1) seulement s’il y a quelqu’un et qu’il fait sombre.',
      concepts: ['capteurs', 'logique combinatoire'],
      explain: 'La décision combine deux capteurs avec les opérateurs « et » / « ou ». Piège : la lampe éclaire aussi le capteur de lumière ! Si l’on éteignait dès que la luminosité dépasse le seuil, la lampe clignoterait sans fin. On n’éteint donc que s’il n’y a personne ou s’il fait vraiment jour (seuil + 40 %) : c’est une hystérésis.',
      build: function () {
        return ws([hat('el_every', { PERIOD: 5 }, null, [
          S.if_(E.and(E.presence(), E.cmp(E.env(5), 'LT', E.param(17))), [S.relay(1, true)]),
          S.if_(E.or(E.not(E.presence()), E.cmp(E.env(5), 'GT', E.arith(E.param(17), 'ADD', E.num(40)))), [S.relay(1, false)])
        ])]);
      }
    },
    {
      id: 'anomalie', level: 3, title: 'Détection d’anomalie', cat: 'Surveiller',
      summary: 'Alerte quand la consommation de la cuisine (prise 2) change brutalement par rapport à son comportement habituel.',
      concepts: ['statistiques', 'score z', 'apprentissage en ligne'],
      explain: 'Le kit apprend en continu la moyenne et la dispersion de la puissance (moyenne exponentielle). Un écart de plus de z écarts-types pendant 3 s est une anomalie. On peut régler le seuil z : trop bas, il y a de fausses alertes ; trop haut, on rate des anomalies.',
      build: function () {
        return ws([hat('el_when', null, { COND: val(E.anomaly(2)) }, [S.alert('Consommation inhabituelle en cuisine'), S.logv('P cuisine (W) :', E.sensor(2, 2))])]);
      }
    },
    {
      id: 'ia_appareil', level: 4, title: 'IA : priorité à la bouilloire', cat: 'Intelligence',
      summary: 'Si l’IA reconnaît la bouilloire sur la prise 2 et que la limite est dépassée, le chauffage est coupé le temps qu’elle chauffe.',
      concepts: ['apprentissage supervisé', 'k plus proches voisins', 'décision'],
      explain: 'Entraînez d’abord l’IA dans l’onglet « IA » : apprenez la « Bouilloire » en premier (elle devient l’appareil n°1). Le programme combine la reconnaissance d’appareil (k-NN sur puissance et facteur de puissance) avec une règle de délestage.',
      build: function () {
        return ws([hat('el_every', { PERIOD: 2 }, null, [
          S.ifelse(E.and(E.appliance(2, 1), E.cmp(E.total(), 'GT', E.param(12))), [S.relay(3, false), S.log('Bouilloire détectée : chauffage suspendu')], [S.relay(3, true)])
        ])]);
      }
    },
    {
      id: 'combine', level: 5, title: 'Gestionnaire d’énergie complet', cat: 'Défi', arena: 'hiver',
      summary: 'Combine thermostat, heures creuses avec préchauffage et délestage par priorités.',
      concepts: ['système multi-objectifs', 'compromis', 'architecture'],
      explain: 'Un vrai gestionnaire d’énergie poursuit plusieurs objectifs à la fois : coût, puissance de pointe, confort. Chaque script s’occupe d’un objectif ; le délestage garde le dernier mot pour la sécurité du contrat.',
      build: function () {
        return ws([
          hat('el_every', { PERIOD: 10 }, null, [
            S.ifelse(E.presence(), [
              S.if_(E.cmp(E.env(3), 'LT', E.arith(E.param(15), 'SUB', E.param(16))), [S.relay(3, true)]),
              S.if_(E.cmp(E.env(3), 'GT', E.arith(E.param(15), 'ADD', E.param(16))), [S.relay(3, false)])
            ], [S.relay(3, false)])
          ], 20, 20),
          hat('el_every', { PERIOD: 30 }, null, [S.ifelse(E.or(E.offpeak(), E.timeBetween(15, 0, 17, 0)), [S.relay(4, true)], [S.relay(4, false)])], 20, 330),
          hat('el_every', { PERIOD: 2 }, null, [S.shed(E.param(12))], 20, 520)
        ]);
      }
    },
    {
      id: 'parametres', level: 2, title: 'Régler les paramètres par programme', cat: 'Paramètres',
      summary: 'Règle la période de mesure, le lissage, la puissance max et le seuil d’alarme du capteur de la prise 1, puis affiche les valeurs.',
      concepts: ['paramètres de capteur', 'paramètres de relais', 'filtrage'],
      explain: 'Les capteurs et les relais ont des paramètres : période d’échantillonnage, lissage (moyenne glissante), protection en puissance, seuil d’alarme interne du PZEM, délai entre commutations. Observez l’effet du lissage sur les mesures !',
      build: function () {
        return ws([hat('el_on_start', null, null, [
          S.setParam(10, 2000), S.setParam(11, 3),
          S.setOutletParam(0, 1, 1500), S.setOutletParam(1, 1, 1200), S.setOutletParam(4, 1, 5),
          S.logv('Période de mesure (ms) :', E.param(10)),
          S.logv('Lissage (mesures) :', E.param(11)),
          S.logv('Puissance max prise 1 (W) :', B('el_param_outlet_get', { PARAM: '0' }, { OUTLET: out(1) }))
        ])]);
      }
    },
    {
      id: 'compteur', level: 2, title: 'Compter les allumages (variables)', cat: 'Débuter',
      summary: 'Utilise une variable pour compter combien de fois la bouilloire (prise 2) a été utilisée.',
      concepts: ['variable', 'événement', 'compteur'],
      explain: 'Une variable mémorise une valeur. À chaque fois que la puissance de la prise 2 dépasse 500 W, on ajoute 1 au compteur.',
      build: function () {
        return ws([
          hat('el_on_start', null, null, [S.set('vCompteur', E.num(0))], 20, 20),
          hat('el_when', null, { COND: val(E.cmp(E.sensor(2, 2), 'GT', E.num(500))) }, [S.change('vCompteur', 1), S.logv('Utilisations de la bouilloire :', E.v('vCompteur'))], 20, 140)
        ], [['vCompteur', 'compteur']]);
      }
    }
  ];

  function get(idv) { return LIST.find(function (e) { return e.id === idv; }); }

  EL.examples = { LIST: LIST, get: get, builder: { B: B, E: E, S: S, hat: hat, ws: ws, n: n, out: out, val: val, seq: seq } };
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ---- 50_ui.js ---- */
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

/* ---- 52_charts.js ---- */
/* EnergyLab — graphiques légers sur canvas (courbes, barres, nuage de points) */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  if (typeof document === 'undefined') return;

  function css(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function niceStep(range, target) {
    const raw = range / Math.max(1, target);
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  }
  function fmtTick(v) {
    const a = Math.abs(v);
    if (a >= 10000) return (v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' k';
    if (a >= 100 || v === 0) return Math.round(v).toLocaleString('fr-FR');
    if (a >= 1) return v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
    return v.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
  }
  function setupCanvas(cv) {
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    const r = cv.getBoundingClientRect();
    const w = Math.max(50, r.width), hh = Math.max(50, r.height);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(hh * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(hh * dpr);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: hh };
  }

  // ---------------------------------------------------------------- courbes
  class LineChart {
    constructor(canvas, opts) {
      this.cv = canvas;
      this.o = Object.assign({ yMin: null, yMax: null, refLines: [], fill: false, stacked: false, xFmt: null, yUnit: '', pad: [12, 12, 26, 48], step: false }, opts || {});
      this.xs = [];
      this.ys = [];
      this.hover = null;
      const self = this;
      canvas.addEventListener('pointermove', function (e) {
        const r = canvas.getBoundingClientRect();
        self.hover = e.clientX - r.left;
        self.draw();
      });
      canvas.addEventListener('pointerleave', function () { self.hover = null; self.draw(); });
      this._ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function () { self.draw(); }) : null;
      if (this._ro) this._ro.observe(canvas);
    }
    setData(xs, ys) { this.xs = xs; this.ys = ys; this.draw(); }
    destroy() { if (this._ro) this._ro.disconnect(); }
    draw() {
      const cv = this.cv;
      if (!cv.isConnected) return;
      const S = setupCanvas(cv), ctx = S.ctx, W = S.w, H = S.h;
      const o = this.o, pad = o.pad;
      const text = css('--muted', '#667'), line = css('--line', '#ddd');
      ctx.clearRect(0, 0, W, H);
      ctx.font = '11px ' + css('--font', 'sans-serif');
      const xs = this.xs, ys = this.ys;
      if (!xs.length) {
        ctx.fillStyle = text;
        ctx.textAlign = 'center';
        ctx.fillText('En attente de données…', W / 2, H / 2);
        return;
      }
      const series = o.series || [];
      // valeurs empilées éventuelles
      let vals = ys;
      if (o.stacked) {
        vals = ys.map(function () { return []; });
        for (let i = 0; i < xs.length; i++) {
          let acc = 0;
          for (let s = 0; s < ys.length; s++) {
            const v = ys[s][i];
            acc += Number.isFinite(v) ? v : 0;
            vals[s][i] = acc;
          }
        }
      }
      let lo = Infinity, hi = -Infinity;
      for (const arr of vals) for (const v of arr) if (Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
      for (const r of o.refLines) if (Number.isFinite(r.y)) { hi = Math.max(hi, r.y); lo = Math.min(lo, r.y); }
      if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
      if (o.yMin !== null) lo = Math.min(lo, o.yMin);
      if (o.yMax !== null) hi = Math.max(hi, o.yMax);
      if (hi - lo < 1e-9) { hi = lo + 1; }
      const step = niceStep(hi - lo, Math.max(2, Math.floor((H - pad[0] - pad[2]) / 40)));
      lo = Math.floor(lo / step) * step;
      hi = Math.ceil(hi / step) * step;
      // marge gauche adaptée à la plus longue graduation (avec l'unité)
      let labW = 0;
      for (let v = lo; v <= hi + step / 2; v += step) labW = Math.max(labW, ctx.measureText(fmtTick(v) + (o.yUnit && v + step > hi + step / 2 ? ' ' + o.yUnit : '')).width);
      const x0 = Math.max(pad[3], Math.ceil(labW) + 10), x1 = W - pad[1], y0 = H - pad[2], y1 = pad[0];
      const xmin = xs[0], xmax = xs[xs.length - 1] === xs[0] ? xs[0] + 1 : xs[xs.length - 1];
      const X = function (x) { return x0 + (x - xmin) / (xmax - xmin) * (x1 - x0); };
      const Y = function (y) { return y0 - (y - lo) / (hi - lo) * (y0 - y1); };
      // grille
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      ctx.fillStyle = text;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let v = lo; v <= hi + step / 2; v += step) {
        const y = Math.round(Y(v)) + 0.5;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
        ctx.fillText(fmtTick(v) + (o.yUnit && v + step > hi + step / 2 ? ' ' + o.yUnit : ''), x0 - 6, y);
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const nx = Math.max(2, Math.floor((x1 - x0) / 90));
      for (let i = 0; i <= nx; i++) {
        const xv = xmin + (xmax - xmin) * i / nx;
        ctx.textAlign = i === 0 ? 'left' : (i === nx ? 'right' : 'center');
        ctx.fillText(o.xFmt ? o.xFmt(xv) : fmtTick(xv), X(xv), y0 + 6);
      }
      ctx.textAlign = 'center';
      // séries
      for (let s = vals.length - 1; s >= 0; s--) {
        const arr = vals[s];
        const col = (series[s] && series[s].color) || '#3b82f6';
        ctx.strokeStyle = col;
        ctx.lineWidth = (series[s] && series[s].width) || 2;
        ctx.setLineDash((series[s] && series[s].dash) || []);
        ctx.beginPath();
        let started = false, prevY = null;
        for (let i = 0; i < xs.length; i++) {
          const v = arr[i];
          if (!Number.isFinite(v)) { started = false; continue; }
          const px = X(xs[i]), py = Y(v);
          if (!started) { ctx.moveTo(px, py); started = true; } else if (o.step) { ctx.lineTo(px, prevY); ctx.lineTo(px, py); } else ctx.lineTo(px, py);
          prevY = py;
        }
        ctx.stroke();
        ctx.setLineDash([]);
        if (o.fill || (series[s] && series[s].fill)) {
          ctx.globalAlpha = o.stacked ? 0.55 : 0.12;
          ctx.fillStyle = col;
          ctx.beginPath();
          let first = true;
          for (let i = 0; i < xs.length; i++) {
            const v = arr[i];
            if (!Number.isFinite(v)) continue;
            if (first) { ctx.moveTo(X(xs[i]), y0); first = false; }
            ctx.lineTo(X(xs[i]), Y(v));
          }
          for (let i = xs.length - 1; i >= 0; i--) {
            const below = o.stacked && s > 0 ? vals[s - 1][i] : lo;
            ctx.lineTo(X(xs[i]), Y(Number.isFinite(below) ? below : lo));
          }
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      // lignes de référence
      for (const r of o.refLines) {
        if (!Number.isFinite(r.y)) continue;
        const y = Y(r.y);
        ctx.strokeStyle = r.color || '#d64545';
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = r.color || '#d64545';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(r.label || '', x0 + 4, y - 2);
      }
      // survol
      if (this.hover !== null && this.hover >= x0 && this.hover <= x1) {
        const xv = xmin + (this.hover - x0) / (x1 - x0) * (xmax - xmin);
        let bi = 0, bd = Infinity;
        for (let i = 0; i < xs.length; i++) { const d = Math.abs(xs[i] - xv); if (d < bd) { bd = d; bi = i; } }
        const px = X(xs[bi]);
        ctx.strokeStyle = text;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, y1); ctx.lineTo(px, y0); ctx.stroke();
        const lines = [o.xFmt ? o.xFmt(xs[bi]) : String(xs[bi])];
        for (let s = 0; s < ys.length; s++) {
          const v = ys[s][bi];
          lines.push(((series[s] && series[s].name) || 'série ' + (s + 1)) + ' : ' + (Number.isFinite(v) ? fmtTick(Math.round(v * 100) / 100) : '--') + (o.yUnit ? ' ' + o.yUnit : ''));
        }
        const bw = Math.max.apply(null, lines.map(function (l) { return ctx.measureText(l).width; })) + 16;
        const bh = lines.length * 15 + 8;
        let bx = px + 10;
        if (bx + bw > W) bx = px - bw - 10;
        ctx.fillStyle = 'rgba(20,28,38,.9)';
        ctx.fillRect(bx, y1 + 4, bw, bh);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        lines.forEach(function (l, i) { ctx.fillText(l, bx + 8, y1 + 9 + i * 15); });
      }
    }
  }

  // ---------------------------------------------------------------- barres groupées
  function barChart(canvas, labels, groups, opts) {
    opts = opts || {};
    const S = setupCanvas(canvas), ctx = S.ctx, W = S.w, H = S.h;
    const text = css('--muted', '#667'), line = css('--line', '#ddd');
    ctx.clearRect(0, 0, W, H);
    ctx.font = '11px ' + css('--font', 'sans-serif');
    const pad = [14, 10, 34, 48];
    let hi = 0;
    for (const g of groups) for (const v of g.values) if (Number.isFinite(v)) hi = Math.max(hi, v);
    if (hi <= 0) hi = 1;
    const step = niceStep(hi, 4);
    hi = Math.ceil(hi / step) * step;
    const x0 = pad[3], x1 = W - pad[1], y0 = H - pad[2], y1 = pad[0];
    const Y = function (v) { return y0 - v / hi * (y0 - y1); };
    ctx.strokeStyle = line;
    ctx.fillStyle = text;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let v = 0; v <= hi + step / 2; v += step) {
      const y = Math.round(Y(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.fillText(fmtTick(v), x0 - 6, y);
    }
    const n = labels.length, gw = (x1 - x0) / Math.max(1, n), bw = Math.min(46, (gw * 0.75) / Math.max(1, groups.length));
    labels.forEach(function (lab, i) {
      const cx = x0 + gw * (i + 0.5);
      groups.forEach(function (g, j) {
        const v = g.values[i];
        if (!Number.isFinite(v)) return;
        const bx = cx - (groups.length * bw) / 2 + j * bw;
        ctx.fillStyle = g.color;
        ctx.fillRect(bx + 1, Y(v), bw - 2, y0 - Y(v));
        if (opts.showValues) {
          ctx.fillStyle = css('--text', '#222');
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(fmtTick(Math.round(v * 100) / 100), bx + bw / 2, Y(v) - 2);
        }
      });
      ctx.fillStyle = text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(lab, cx, y0 + 6);
    });
  }

  // ---------------------------------------------------------------- nuage de points (k-NN)
  // points : [{x, y, color, label, r, ring}] ; axes : {xMin, xMax, yMin, yMax, xLog, xLabel, yLabel}
  function scatter(canvas, points, axes, links) {
    const S = setupCanvas(canvas), ctx = S.ctx, W = S.w, H = S.h;
    const text = css('--muted', '#667'), line = css('--line', '#ddd');
    ctx.clearRect(0, 0, W, H);
    ctx.font = '11px ' + css('--font', 'sans-serif');
    const pad = [14, 14, 40, 52];
    const x0 = pad[3], x1 = W - pad[1], y0 = H - pad[2], y1 = pad[0];
    const tx = function (x) { return axes.xLog ? Math.log10(Math.max(x, 0.1)) : x; };
    const X = function (x) { return x0 + (tx(x) - tx(axes.xMin)) / (tx(axes.xMax) - tx(axes.xMin)) * (x1 - x0); };
    const Y = function (y) { return y0 - (y - axes.yMin) / (axes.yMax - axes.yMin) * (y0 - y1); };
    ctx.strokeStyle = line;
    ctx.fillStyle = text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xt = axes.xLog ? [0.1, 1, 10, 100, 1000, 10000] : [];
    for (const v of xt) {
      if (v < axes.xMin || v > axes.xMax) continue;
      const x = Math.round(X(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y0); ctx.stroke();
      ctx.fillText(fmtTick(v) + ' W', x, y0 + 5);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let v = axes.yMin; v <= axes.yMax + 1e-9; v += 0.2) {
      const y = Math.round(Y(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.fillText(v.toFixed(1), x0 - 6, y);
    }
    ctx.textAlign = 'center';
    ctx.fillText(axes.xLabel || '', (x0 + x1) / 2, H - 9);
    ctx.save();
    ctx.translate(12, (y0 + y1) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(axes.yLabel || '', 0, 0);
    ctx.restore();
    for (const l of links || []) {
      ctx.strokeStyle = l.color || '#888';
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(X(l.x1), Y(l.y1)); ctx.lineTo(X(l.x2), Y(l.y2)); ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const p of points) {
      const px = X(p.x), py = Y(p.y);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (p.star) {
        for (let i = 0; i < 10; i++) {
          const a = Math.PI / 5 * i - Math.PI / 2, r = i % 2 ? 5 : 11;
          ctx.lineTo(px + r * Math.cos(a), py + r * Math.sin(a));
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        ctx.arc(px, py, p.r || 5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (p.label) {
        ctx.fillStyle = css('--text', '#222');
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.label, px + 9, py - 9);
      }
    }
  }

  EL.charts = { LineChart: LineChart, barChart: barChart, scatter: scatter, niceStep: niceStep, fmtTick: fmtTick, css: css };
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ---- 54_house.js ---- */
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
        const max = oc ? oc.maxPower : 2300;
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

/* ---- 56_measure.js ---- */
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

/* ---- 58_editor.js ---- */
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

/* ---- 60_ai.js ---- */
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

/* ---- 62_missions.js ---- */
/* EnergyLab — missions guidées (travaux pratiques) avec étayage (« scaffolding ») adaptatif
 * Trois modes réglés par l'enseignant : guidage fort, adaptatif (par défaut), faible. */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  if (typeof document === 'undefined') return;
  const U = EL.util, h = U.h;

  const anyOutlet = function (s, f) { for (let k = 0; k < 4; k++) if (f(s.outlets[k], k)) return k; return -1; };
  const cfg = function () { return EL.app.config; };
  const logsSince = function (seq, f) { return EL.app.logs.some(function (e) { return e.seq > seq && f(e); }); };

  // ---------------------------------------------------------------- contenu des missions
  const LEVELS = ['', 'Découvrir', 'Comprendre', 'Commander', 'Programmer', 'Optimiser', 'Défi'];
  const MISSIONS = [
    {
      id: 'm1', level: 1, title: 'Prise en main du kit', duration: '10 min', icon: '🔌',
      comp: ['Identifier les éléments d’une installation électrique', 'Utiliser une interface de supervision'],
      intro: 'Le kit représente l’installation d’une maison : quatre prises commandées par des relais et mesurées par des capteurs. Vous allez allumer une prise, lire les mesures et comprendre le rôle des protections.',
      theory: '<p>Chaque prise possède un <b>relais</b> (interrupteur commandé électriquement) et un <b>capteur PZEM-004T</b> qui mesure la tension U (V), le courant I (A), la puissance P (W) et l’énergie E (Wh). L’ensemble est protégé par un <b>disjoncteur différentiel 30 mA</b>.</p>',
      steps: [
        { type: 'action', text: 'Dans l’onglet « Maison », allumez la prise 1 avec son interrupteur.', check: function (s) { return s.outlets[0].on; }, hints: ['L’interrupteur se trouve en haut à droite de la carte « 1 · … ».', 'Si l’interrupteur est grisé, la commande des prises a peut-être été verrouillée par l’enseignant.'] },
        { type: 'action', text: 'Branchez une lampe sur la prise 1 et allumez-la (en mode démonstration, choisissez une lampe et cochez « interrupteur de l’appareil »). La puissance doit dépasser 3 W.', check: function (s) { return s.outlets[0].on && s.outlets[0].p > 3; }, hints: ['La lampe doit être allumée ET la prise doit être allumée.', 'Regardez la valeur en gros sur la carte de la prise : elle doit dépasser 3 W.'] },
        { type: 'numeric', text: 'Relevez la tension U mesurée sur la prise 1 (en volts).', unit: 'V', answer: function (s) { return s.outlets[0].u; }, tolAbs: 3, hints: ['La tension est indiquée sous la puissance : « U … V ».', 'Dans un réseau domestique, elle est proche de 230 V.'] },
        { type: 'action', text: 'Éteignez la prise 1 et observez la puissance.', check: function (s) { return !s.outlets[0].on; }, hints: ['Utilisez de nouveau l’interrupteur de la prise 1.'] },
        { type: 'qcm', text: 'Quand le relais de la prise est ouvert (prise éteinte), la puissance mesurée est :', options: ['nulle : aucun courant ne circule vers l’appareil', 'la même qu’avant', 'deux fois plus grande'], correct: 0, explain: 'Le relais ouvre le circuit : le courant ne peut plus circuler, donc P = U × I × cos φ = 0.' },
        { type: 'qcm', text: 'À quoi sert le disjoncteur différentiel 30 mA du kit ?', options: ['À protéger les personnes contre l’électrocution (courant de fuite)', 'À mesurer l’énergie', 'À augmenter la puissance disponible'], correct: 0, explain: 'Il compare le courant qui part et celui qui revient : s’il manque plus de 30 mA (fuite vers la terre ou à travers une personne), il coupe en quelques millisecondes.' }
      ]
    },
    {
      id: 'm2', level: 1, title: 'Puissance, énergie et coût', duration: '20 min', icon: '💰',
      comp: ['Distinguer puissance (W) et énergie (Wh)', 'Calculer une énergie et un coût'],
      intro: 'Une bouilloire et une lampe n’ont pas la même puissance. Mais ce que l’on paie, c’est l’énergie : la puissance multipliée par la durée.',
      theory: '<p><b>E = P × t</b> : une puissance de 1 000 W pendant 1 h consomme 1 000 Wh = <b>1 kWh</b>.<br>Coût = E (kWh) × prix du kWh.</p>',
      steps: [
        { type: 'action', text: 'Faites fonctionner un appareil puissant (bouilloire, radiateur, fer…) sur la prise 2 : P doit dépasser 500 W.', check: function (s, ctx) { const o = s.outlets[1]; if (o.on && o.p > 500) { ctx.p = o.p; return true; } return false; }, hints: ['Allumez la prise 2 puis l’appareil.', 'En démonstration : choisissez « Bouilloire 2000 W » sur la prise 2 et cochez son interrupteur.'] },
        { type: 'numeric', text: 'Quelle puissance avez-vous relevée (en W) ?', unit: 'W', answer: function (s, ctx) { return ctx.shared.p; }, tolRel: 0.1, hints: ['La valeur a été mesurée à l’étape précédente : environ celle affichée sur la carte de la prise 2.'] },
        { type: 'numeric', text: 'Calculez l’énergie consommée si l’appareil fonctionne 3 minutes (en Wh).', unit: 'Wh', answer: function (s, ctx) { return ctx.shared.p * 3 / 60; }, tolRel: 0.1, hints: ['3 minutes = 3/60 heure = 0,05 h.', 'E = P × t = P × 0,05.'] },
        { type: 'numeric', text: 'Avec le prix du kWh du tableau de bord, combien coûtent 10 utilisations de 3 minutes ?', unitFn: function () { return cfg() ? cfg().tariff.currency : ''; }, answer: function (s, ctx) { return ctx.shared.p * 0.05 * 10 / 1000 * (cfg() ? cfg().tariff.priceHP : 1); }, tolRel: 0.12, hints: ['Énergie pour 10 utilisations = 10 × l’énergie précédente (en Wh), à convertir en kWh (÷ 1 000).', 'Coût = énergie en kWh × prix du kWh.'] },
        { type: 'observe', text: 'Comparez une lampe LED (environ 9 W) et la bouilloire : pourquoi une lampe allumée toute la journée peut-elle coûter autant que quelques bouilloires ?' }
      ]
    },
    {
      id: 'm3', level: 2, title: 'Puissance apparente et facteur de puissance', duration: '25 min', icon: '📐',
      comp: ['Calculer S = U × I', 'Interpréter le facteur de puissance'],
      intro: 'Pour certains appareils, U × I est plus grand que la puissance active P. Pourquoi ?',
      theory: '<p><b>S = U × I</b> (VA) est la puissance apparente. <b>P = U × I × cos φ</b> (W) est la puissance active (utile). <b>Q = √(S² − P²)</b> (var) est la puissance réactive. Le facteur de puissance vaut <b>FP = P / S</b>.</p>',
      steps: [
        { type: 'action', text: 'Mesurez un appareil électronique ou un moteur (chargeur, ordinateur, ventilateur, lampe LED…) : il faut P > 2 W et un facteur de puissance inférieur à 0,9.', check: function (s, ctx) { const k = anyOutlet(s, function (o) { return o.on && o.p > 2 && o.pf < 0.9; }); if (k >= 0) { const o = s.outlets[k]; ctx.k = k; ctx.u = o.u; ctx.i = o.i; ctx.p = o.p; return true; } return false; }, hints: ['Une bouilloire ou une lampe halogène ont un FP proche de 1 : choisissez plutôt un chargeur ou un ventilateur.', 'Regardez le FP dans l’onglet « Mesures ».'] },
        { type: 'numeric', text: 'Avec les valeurs mesurées, calculez S = U × I (en VA).', unit: 'VA', answer: function (s, ctx) { return ctx.shared.u * ctx.shared.i; }, tolRel: 0.06, hints: ['Multipliez la tension (≈ 230 V) par le courant (en A).'] },
        { type: 'numeric', text: 'Calculez le facteur de puissance cos φ = P / S.', unit: '', answer: function (s, ctx) { return ctx.shared.p / (ctx.shared.u * ctx.shared.i); }, tolAbs: 0.05, hints: ['Divisez la puissance active P par la puissance apparente S que vous venez de calculer.'] },
        { type: 'qcm', text: 'Pourquoi P est-elle plus petite que S pour cet appareil ?', options: ['Une partie du courant ne produit pas de puissance active (déphasage ou courant déformé)', 'Le capteur est mal étalonné', 'La tension du réseau est trop faible'], correct: 0, explain: 'Les moteurs déphasent le courant (φ) ; les alimentations électroniques déforment le courant (harmoniques). Dans les deux cas, U × I > P.' },
        { type: 'qcm', text: 'Pour une bouilloire (résistance chauffante), le facteur de puissance est proche de :', options: ['1', '0,5', '0'], correct: 0, explain: 'Une résistance pure ne déphase pas le courant : φ = 0 donc cos φ = 1.' }
      ]
    },
    {
      id: 'm4', level: 2, title: 'Résistif, moteur ou électronique ?', duration: '25 min', icon: '🔬',
      comp: ['Mener une campagne de mesures', 'Classer des charges électriques'],
      intro: 'Chaque famille d’appareils a sa « signature » électrique. Vous allez en mesurer plusieurs et les comparer.',
      theory: '<ul><li><b>Résistif</b> (bouilloire, radiateur, halogène) : FP ≈ 1.</li><li><b>Moteur</b> (ventilateur, frigo, perceuse) : FP ≈ 0,6 à 0,85, courant en retard.</li><li><b>Électronique</b> (chargeur, LED, ordinateur) : FP souvent &lt; 0,7, courant déformé.</li></ul>',
      steps: [
        { type: 'action', text: 'Dans l’onglet « Mesures », enregistrez au moins 3 appareils différents avec « Enregistrer la mesure ».', check: function (s, ctx) { const n = U.store.get('measures', []).length; if (ctx.n0 === undefined) ctx.n0 = n; return n >= ctx.n0 + 3 || n >= 3; }, hints: ['Branchez un appareil, attendez que la mesure soit stable, puis cliquez sur « Enregistrer la mesure ».'] },
        { type: 'qcm', text: 'Un ventilateur a un facteur de puissance de 0,75. C’est une charge :', options: ['inductive (moteur)', 'résistive', 'sans consommation'], correct: 0, explain: 'Le bobinage du moteur crée un déphasage : le courant est en retard sur la tension.' },
        { type: 'qcm', text: 'Quel appareil appelle le plus de courant pour une même puissance active P ?', options: ['Celui qui a le facteur de puissance le plus faible', 'Celui qui a le facteur de puissance le plus élevé', 'Ils appellent tous le même courant'], correct: 0, explain: 'I = P / (U × cos φ) : plus cos φ est petit, plus le courant est grand. Les fournisseurs pénalisent les mauvais facteurs de puissance dans l’industrie.' },
        { type: 'observe', text: 'Classez vos appareils du meilleur au moins bon facteur de puissance et justifiez avec la nature de chaque charge.' }
      ]
    },
    {
      id: 'm5', level: 2, title: 'Les consommations cachées (veille)', duration: '20 min', icon: '👻',
      comp: ['Mesurer une faible puissance', 'Évaluer un gisement d’économie'],
      intro: 'Un téléviseur « éteint » à la télécommande consomme encore. Combien sur une année ?',
      theory: '<p>Énergie annuelle de veille : <b>E = P × 24 h × 365 j</b>. Astuce de mesure : pour mieux mesurer les très faibles courants, on peut faire passer plusieurs fois le fil dans le tore du capteur (réglage « passages dans le tore »).</p>',
      steps: [
        { type: 'action', text: 'Mesurez un appareil en veille (TV éteinte à la télécommande, chargeur sans téléphone, box…) : prise allumée et P entre 0,2 W et 10 W.', check: function (s, ctx) { const k = anyOutlet(s, function (o) { return o.on && o.p > 0.2 && o.p < 10; }); if (k >= 0) { ctx.p = s.outlets[k].p; return true; } return false; }, hints: ['En démonstration : choisissez « Téléviseur » et décochez l’interrupteur de l’appareil (veille).', 'Le capteur 100 A ne mesure pas les courants inférieurs à 20 mA (≈ 4 W).'] },
        { type: 'numeric', text: 'Calculez l’énergie consommée par cette veille en un an (kWh).', unit: 'kWh', answer: function (s, ctx) { return ctx.shared.p * 8.76; }, tolRel: 0.1, hints: ['P × 24 × 365 donne des Wh ; divisez par 1 000 pour obtenir des kWh.'] },
        { type: 'numeric', text: 'Combien coûte cette veille par an ?', unitFn: function () { return cfg() ? cfg().tariff.currency : ''; }, answer: function (s, ctx) { return ctx.shared.p * 8.76 * (cfg() ? cfg().tariff.priceHP : 1); }, tolRel: 0.12, hints: ['Multipliez l’énergie annuelle (kWh) par le prix du kWh.'] },
        { type: 'qcm', text: 'Quelle solution supprime cette consommation sans gêner l’utilisateur ?', options: ['Couper la prise automatiquement quand l’appareil est inactif et que personne n’est là', 'Débrancher le compteur', 'Augmenter la puissance souscrite'], correct: 0, explain: 'C’est l’algorithme « tueur de veille » que vous programmerez au niveau Optimiser.' }
      ]
    },
    {
      id: 'm6', level: 3, title: 'Commander les relais et régler leurs paramètres', duration: '20 min', icon: '🎚️',
      comp: ['Configurer un actionneur', 'Comprendre les contraintes de commutation'],
      intro: 'Un relais ne doit pas commuter trop souvent : les appareils à moteur (réfrigérateur, climatiseur) peuvent être endommagés. Le kit impose donc un délai minimum entre deux commutations.',
      theory: '<p>Le relais est un interrupteur électromécanique. Le paramètre <b>délai entre commutations</b> fixe le temps minimum entre deux changements d’état ; une commande trop rapide est mise <b>en attente</b>.</p>',
      steps: [
        { type: 'action', text: 'Onglet « Mesures », prise 1 : réglez le « délai entre commutations » à 5 s et appliquez.', check: function () { return cfg() && cfg().outlets[0].minSwitchS >= 5; }, hints: ['Le panneau « Paramètres du relais et du capteur » se trouve en bas de la page Mesures.'] },
        { type: 'action', text: 'Allumez puis éteignez immédiatement la prise 1 : la seconde commande doit être retardée (badge « commutation en attente »).', check: function (s) { return s.outlets[0].pending; }, hints: ['Cliquez deux fois rapidement sur l’interrupteur de la prise 1.'] },
        { type: 'qcm', text: 'Pourquoi limiter la fréquence de commutation d’un relais ?', options: ['Pour protéger les contacts du relais et les appareils (moteurs, compresseurs)', 'Pour économiser le Wi-Fi', 'Pour que le capteur mesure plus vite'], correct: 0, explain: 'Chaque commutation use les contacts (étincelles) ; un compresseur redémarré trop tôt peut caler et chauffer.' },
        { type: 'action', text: 'Remettez le délai entre commutations de la prise 1 à 2 s.', check: function () { return cfg() && cfg().outlets[0].minSwitchS <= 2.5; }, hints: ['Même panneau, même champ.'] }
      ]
    },
    {
      id: 'm7', level: 3, title: 'Déclencher une protection en toute sécurité', duration: '15 min', icon: '⛔',
      comp: ['Paramétrer une protection', 'Réarmer après défaut'],
      intro: 'Le kit protège chaque prise : si la puissance dépasse la « puissance max », la prise est coupée et verrouillée.',
      theory: '<p>La protection logicielle s’ajoute aux protections matérielles (disjoncteur). Elle exige un <b>réarmement manuel</b> : on vérifie la cause avant de remettre sous tension.</p>',
      steps: [
        { type: 'action', text: 'Onglet « Mesures », prise 2 : réglez la « puissance max » à 50 W.', check: function () { return cfg() && cfg().outlets[1].maxPower <= 50; }, hints: ['Saisissez 50 puis « Appliquer » dans le panneau des paramètres de la prise 2.'] },
        { type: 'action', text: 'Faites fonctionner sur la prise 2 un appareil de plus de 50 W : la prise doit se couper et se verrouiller.', check: function (s) { return s.outlets[1].latched; }, hints: ['Une lampe halogène, un ventilateur ou une bouilloire conviennent.', 'Le kit coupe après deux mesures au-dessus du seuil (ou immédiatement au-delà de 1,5 × le seuil).'] },
        { type: 'qcm', text: 'Que signifie « prise verrouillée » ?', options: ['Elle reste coupée jusqu’à un réarmement volontaire', 'Elle se rallume seule après 10 s', 'Le capteur est en panne'], correct: 0, explain: 'Comme un disjoncteur : on ne remet pas sous tension sans avoir trouvé la cause.' },
        { type: 'action', text: 'Remettez la puissance max de la prise 2 à 2 300 W (valeur d’origine), puis réarmez la prise (bouton « Réarmer »).', check: function (s) { return cfg() && cfg().outlets[1].maxPower >= 1500 && !s.outlets[1].latched; }, hints: ['Le bouton « Réarmer » apparaît sur la carte de la prise verrouillée (onglet Maison).'] }
      ]
    },
    {
      id: 'm8', level: 3, title: 'Régler les paramètres des capteurs', duration: '15 min', icon: '📡',
      comp: ['Paramétrer un capteur', 'Comprendre l’échantillonnage et le filtrage'],
      intro: 'Un capteur numérique mesure à intervalles réguliers (période d’échantillonnage). On peut lisser les mesures en faisant la moyenne des dernières valeurs.',
      theory: '<p><b>Période de mesure</b> : temps entre deux lectures. <b>Lissage</b> : moyenne glissante des N dernières mesures, qui réduit le bruit mais ralentit la réaction.</p>',
      steps: [
        { type: 'action', text: 'Onglet « Mesures » : réglez la période de mesure à 5 000 ms.', check: function () { return cfg() && cfg().measure.sampleMs >= 5000; }, hints: ['Champ « Période de mesure (toutes prises) ».'] },
        { type: 'observe', text: 'Allumez et éteignez une lampe : qu’observez-vous sur la vitesse de mise à jour de la puissance ?' },
        { type: 'action', text: 'Réglez maintenant la période à 1 000 ms et le lissage à 5 mesures.', check: function () { return cfg() && cfg().measure.sampleMs <= 1000 && cfg().measure.smoothN >= 5; }, hints: ['Deux champs à modifier puis « Appliquer ».'] },
        { type: 'qcm', text: 'Quel est l’effet du lissage sur 5 mesures ?', options: ['Les valeurs fluctuent moins, mais réagissent plus lentement aux changements', 'Les mesures deviennent plus précises et plus rapides', 'Aucun effet'], correct: 0, explain: 'C’est un compromis classique en instrumentation : filtrer le bruit retarde la réponse.' },
        { type: 'action', text: 'Remettez le lissage à 1.', check: function () { return cfg() && cfg().measure.smoothN === 1; }, hints: [] }
      ]
    },
    {
      id: 'm9', level: 4, title: 'Mon premier programme', duration: '20 min', icon: '🧩',
      comp: ['Concevoir un algorithme séquentiel avec une boucle', 'Exécuter un programme sur un système embarqué'],
      intro: 'Sans écrire de code : assemblez des blocs comme dans Scratch. Le programme est compilé puis exécuté par le kit lui-même.',
      theory: '<p>Un <b>événement</b> déclenche le script (« quand le programme démarre »). Une <b>boucle</b> répète des instructions. Le bloc <b>attendre</b> met le script en pause.</p>',
      steps: [
        { type: 'action', text: 'Onglet « Programmer » : ouvrez l’exemple « Mon premier programme : clignotant » (bouton Exemples), puis cliquez sur « Envoyer au kit ». La prise 1 doit changer d’état au moins 2 fois.', check: function (s, ctx) { if (ctx.sw0 === undefined) ctx.sw0 = s.outlets[0].switches; return s.vm.status === 1 && s.outlets[0].switches >= ctx.sw0 + 2; }, hints: ['Exemples → « Mon premier programme : clignotant » → Ouvrir.', 'Cliquez ensuite sur « Envoyer au kit » (ou « Exécuter » en démonstration).'] },
        { type: 'qcm', text: 'Pourquoi faut-il un bloc « attendre » dans la boucle ?', options: ['Sans attente, la prise devrait changer d’état en permanence, beaucoup trop vite', 'Le bloc attendre économise de l’énergie', 'Pour que le programme compile'], correct: 0, explain: 'Le processeur exécute des milliers d’instructions par seconde. Les appareils, eux, ont besoin de temps.' },
        { type: 'action', text: 'Modifiez le programme pour faire une minuterie : remplacez la boucle par « allumer la prise 1 pendant 30 secondes » et envoyez-le.', check: function (s) { return s.outlets[0].pulseLeft > 0; }, hints: ['Le bloc « allumer la prise … pendant … secondes » est dans la catégorie Prises.'] },
        { type: 'observe', text: 'Ouvrez « Code » : comparez le pseudo-code et le langage machine (bytecode). Combien d’instructions votre programme contient-il ?' }
      ]
    },
    {
      id: 'm10', level: 4, title: 'Programmer une alerte', duration: '20 min', icon: '🚨',
      comp: ['Utiliser un événement conditionnel', 'Relier capteur et action'],
      intro: 'Vous allez programmer une surveillance : une alerte quand la puissance totale dépasse un seuil.',
      theory: '<p>Le bloc <b>« quand … devient vrai »</b> réagit au passage de faux à vrai : une seule alerte par dépassement, au lieu d’une alerte toutes les secondes.</p>',
      steps: [
        { type: 'action', text: 'Créez et envoyez un programme qui envoie une alerte quand la puissance totale dépasse 1 000 W, puis dépassez 1 000 W.', check: function (s, ctx) { if (ctx.seq0 === undefined) ctx.seq0 = EL.app.lastLogSeq; return s.vm.status === 1 && logsSince(ctx.seq0, function (e) { return e.level === 3 && !/Protection|Sécurité|Erreur/.test(e.msg); }); }, hints: ['Événements → « quand … devient vrai » ; Opérateurs → « … > … » ; Mesures → « puissance totale (W) » ; Alertes → « envoyer l’alerte ».', 'Vous pouvez partir de l’exemple « Alerte de surconsommation » et changer le seuil.'] },
        { type: 'qcm', text: 'Avec « toutes les 1 secondes : si P > 1 000 alors alerte », que se passe-t-il pendant un dépassement de 2 minutes ?', options: ['120 alertes (une par seconde)', 'Une seule alerte', 'Aucune alerte'], correct: 0, explain: 'D’où l’intérêt de l’événement « devient vrai » (détection de front montant).' },
        { type: 'observe', text: 'Proposez une amélioration : comment éviter une alerte pour un dépassement très bref (bouilloire de 3 minutes) ?' }
      ]
    },
    {
      id: 'm11', level: 5, title: 'Délestage : rester sous la puissance souscrite', duration: '30 min', icon: '⚖️',
      comp: ['Mettre en œuvre un algorithme de régulation', 'Analyser un compromis puissance / confort'],
      intro: 'Si la maison appelle plus que la puissance souscrite, le disjoncteur du compteur coupe tout. Le délestage coupe d’abord les appareils les moins prioritaires.',
      theory: '<p>Algorithme glouton : tant que P totale &gt; limite, couper la prise allumée de plus faible priorité ; quand la marge revient, rallumer la plus prioritaire.</p>',
      steps: [
        { type: 'action', text: 'Envoyez au kit l’exemple « Délestage intelligent par priorités » (ou votre propre version).', check: function (s) { return s.vm.status === 1 && /lestage/i.test(s.vm.name); }, hints: ['Onglet IA → Algorithmes → « Ouvrir dans l’éditeur », puis « Envoyer au kit ».'] },
        { type: 'action', text: 'Allumez plusieurs appareils pour dépasser la puissance souscrite : une prise doit être délestée.', check: function (s) { return anyOutlet(s, function (o) { return o.shed; }) >= 0; }, hints: ['Pour faciliter l’expérience, baissez la puissance souscrite (bloc « régler la puissance souscrite » ou réglages).'] },
        { type: 'qcm', text: 'Quelle prise est coupée en premier ?', options: ['La prise allumée la moins prioritaire (numéro de priorité le plus grand)', 'La prise qui consomme le plus', 'Une prise au hasard'], correct: 0, explain: 'La priorité 1 est la plus importante. Le chauffage (priorité 4 par défaut) supporte une courte coupure.' },
        { type: 'observe', text: 'Le délestage améliore la sécurité du contrat mais peut gêner l’utilisateur. Quel appareil ne faut-il jamais délester longtemps, et pourquoi ?' }
      ]
    },
    {
      id: 'm12', level: 5, title: 'Comparer des algorithmes dans l’arène', duration: '30 min', icon: '🏟️',
      comp: ['Évaluer des algorithmes avec des indicateurs', 'Argumenter un choix technique'],
      intro: 'Un ingénieur compare objectivement plusieurs solutions. L’arène simule une journée complète en quelques secondes.',
      theory: '<p>Indicateurs : énergie, coût, pointe, minutes de dépassement, confort (service rendu, température, eau chaude), usure (commutations).</p>',
      steps: [
        { type: 'action', text: 'Onglet IA → Arène : lancez le scénario « Journée d’hiver » avec « Aucun algorithme » et « Heures creuses (chauffe-eau, lave-linge) ».', check: function () { const a = EL.lastArena; return !!a && a.scenario === 'hiver' && a.res.some(function (r) { return r.id === 'none'; }) && a.res.some(function (r) { return /Heures creuses/.test(r.label); }); }, hints: ['Choisissez les deux concurrents dans les listes puis « Lancer la journée simulée ».'] },
        { type: 'numeric', text: 'De combien de % le coût baisse-t-il avec « Heures creuses » par rapport à « Aucun algorithme » ?', unit: '%', answer: function () { const a = EL.lastArena; const ref = a.res.find(function (r) { return r.id === 'none'; }) || a.res[0], hc = a.res.find(function (r) { return /Heures creuses/.test(r.label); }); return (ref.cost - hc.cost) / ref.cost * 100; }, tolAbs: 2, hints: ['Baisse (%) = (coût de référence − coût de l’algorithme) / coût de référence × 100.'] },
        { type: 'qcm', text: 'Pourquoi l’algorithme « Heures creuses + préchauffage » a-t-il été conçu ?', options: ['Pour garder assez d’eau chaude pour la douche du soir tout en évitant la pointe', 'Pour consommer plus', 'Pour tester le Wi-Fi'], correct: 0, explain: 'Optimiser seulement le coût peut dégrader le confort : c’est un problème multi-objectifs.' },
        { type: 'observe', text: 'Rédigez une recommandation (3 lignes) : quel algorithme conseillez-vous à cette famille et pourquoi ?' }
      ]
    },
    {
      id: 'm13', level: 5, title: 'Tueur de veille et éclairage intelligent', duration: '25 min', icon: '💡',
      comp: ['Combiner plusieurs capteurs', 'Programmer une logique conditionnelle'],
      intro: 'Le détecteur de présence et le capteur de lumière permettent d’éviter les gaspillages.',
      theory: '<p>Opérateurs logiques : « A et B » est vrai si les deux le sont ; « non A » inverse A.</p>',
      steps: [
        { type: 'action', text: 'Envoyez (ou simulez) l’exemple « Éclairage intelligent » ou « Tueur de veille ».', check: function (s) { return s.vm.status === 1 && /clairage|veille/i.test(s.vm.name); }, hints: ['IA → Algorithmes → Économiser.', 'Dans l’éditeur, le bouton « Simuler » utilise la maison virtuelle : décochez « Quelqu’un est présent » pour tester.'] },
        { type: 'qcm', text: 'Dans « présence détectée ET luminosité < seuil », la lampe s’allume :', options: ['seulement s’il y a quelqu’un ET qu’il fait sombre', 'dès qu’il y a quelqu’un', 'dès qu’il fait sombre'], correct: 0, explain: 'C’est la table de vérité du ET logique.' },
        { type: 'observe', text: 'Pourquoi le délai de présence (60 s par défaut) est-il utile ?' }
      ]
    },
    {
      id: 'm14', level: 5, title: 'Entraîner une intelligence artificielle', duration: '30 min', icon: '🤖',
      comp: ['Comprendre l’apprentissage supervisé', 'Évaluer les limites d’un modèle'],
      intro: 'L’IA du kit apprend à reconnaître les appareils à partir de leurs mesures (k plus proches voisins).',
      theory: '<p>Apprentissage <b>supervisé</b> : on donne des exemples étiquetés (mesure → nom). Pour une nouvelle mesure, on cherche les <b>k</b> exemples les plus proches et on vote.</p>',
      steps: [
        { type: 'action', text: 'Onglet IA → Reconnaissance : apprenez au moins 2 appareils différents, avec au moins 2 exemples chacun.', check: function () { const k = EL.app.knn; return !!k && k.labels.filter(function (l) { return l.n >= 2; }).length >= 2; }, hints: ['Branchez l’appareil, écrivez son nom, cliquez « Apprendre cet exemple » ; recommencez.'] },
        { type: 'action', text: 'Branchez l’un des appareils appris : l’IA doit le reconnaître (nom affiché sur la carte de la prise).', check: function (s) { return anyOutlet(s, function (o) { return o.appliance > 0; }) >= 0; }, hints: ['L’étoile sur le graphique doit être proche des points de l’appareil.'] },
        { type: 'qcm', text: 'Deux appareils différents ont presque la même puissance et le même facteur de puissance. Que va faire l’IA ?', options: ['Elle risque de les confondre : ces deux caractéristiques ne suffisent pas à les distinguer', 'Elle les distingue toujours parfaitement', 'Elle refuse de fonctionner'], correct: 0, explain: 'Une IA ne voit que les caractéristiques qu’on lui donne. Il faudrait d’autres informations (forme du courant, durée de fonctionnement…).' },
        { type: 'qcm', text: 'Que représente k dans « k plus proches voisins » ?', options: ['Le nombre d’exemples consultés pour voter', 'Le nombre d’appareils', 'La puissance maximale'], correct: 0, explain: 'Avec k = 1, on suit le plus proche exemple (sensible aux erreurs) ; avec k plus grand, le vote est plus robuste.' }
      ]
    },
    {
      id: 'm15', level: 5, title: 'Le thermostat à hystérésis', duration: '25 min', icon: '🌡️',
      comp: ['Comprendre une régulation tout-ou-rien', 'Analyser l’effet d’un paramètre'],
      intro: 'Un thermostat allume le chauffage sous la consigne et l’éteint au-dessus. L’hystérésis évite les commutations incessantes.',
      theory: '<p>Chauffer si T &lt; consigne − h ; arrêter si T &gt; consigne + h. Plus h est grand, moins il y a de commutations, mais plus la température varie.</p>',
      steps: [
        { type: 'action', text: 'Simulez l’exemple « Thermostat à hystérésis » (bouton « Simuler »), avec le convecteur sur la prise 3, à la vitesse ×60.', check: function () { const v = EL.views.programmer; return !!v && !!v.twin && v.twin.core.machine.status === 1 && /Thermostat/.test(v.twin.core.machine.prog.name); }, hints: ['Exemples → « Thermostat à hystérésis » → Simuler ; dans la maison virtuelle, choisissez « Convecteur 1000 W » sur la prise 3 et cochez son interrupteur.'] },
        { type: 'qcm', text: 'Si on passe l’hystérésis de 0,5 °C à 0,1 °C :', options: ['Le nombre de commutations augmente', 'Le nombre de commutations diminue', 'Rien ne change'], correct: 0, explain: 'La plage de température tolérée est plus étroite : le relais commute plus souvent.' },
        { type: 'observe', text: 'Pourquoi un thermostat économise-t-il de l’énergie par rapport à un convecteur laissé allumé en continu ?' }
      ]
    },
    {
      id: 'm16', level: 6, title: 'Défi : le meilleur gestionnaire d’énergie', duration: '45 min', icon: '🏆',
      comp: ['Concevoir une solution multi-objectifs', 'Valider par l’expérimentation'],
      intro: 'Créez votre propre programme et battez la référence dans l’arène « Journée d’hiver » : coût réduit d’au moins 15 %, sans douche froide et sans dégrader le confort thermique.',
      theory: '<p>Combinez les idées : thermostat, heures creuses, préchauffage, délestage… Testez, mesurez, améliorez : c’est la démarche d’ingénierie.</p>',
      steps: [
        { type: 'action', text: 'Dans l’arène « Journée d’hiver », comparez « Aucun algorithme » et « Mon programme (éditeur de blocs) ». Votre programme doit réduire le coût d’au moins 15 %, avec 0 douche froide et un inconfort thermique au plus égal à celui de la référence + 1 °C·h.', check: function () {
          const a = EL.lastArena;
          if (!a || a.scenario !== 'hiver') return false;
          const ref = a.res.find(function (r) { return r.id === 'none'; });
          const mine = a.res.find(function (r) { return r.id === '__editor'; });
          return !!ref && !!mine && mine.cost <= ref.cost * 0.85 && mine.coldDraws === 0 && mine.thermalDegH <= ref.thermalDegH + 1;
        }, hints: ['Point de départ possible : l’exemple « Gestionnaire d’énergie complet ».', 'Regardez quels indicateurs se dégradent et pourquoi : chauffe-eau, chauffage, lave-linge…', 'Le convecteur n’est allumé par les occupants que le matin et le soir : la nuit, un thermostat suffit ; avant leur départ, laissez-le chauffer pour « stocker » de la chaleur.'] },
        { type: 'observe', text: 'Présentez votre solution : principe, résultats (tableau de l’arène) et limites.' }
      ]
    }
  ];

  const BADGES = { 1: ['🥉', 'Électricien·ne débutant·e'], 2: ['🔬', 'Expérimentateur·rice'], 3: ['🎚️', 'Technicien·ne'], 4: ['🧩', 'Programmeur·se'], 5: ['🧠', 'Ingénieur·e énergie'], 6: ['🏆', 'Expert·e EnergyLab'] };

  // ---------------------------------------------------------------- progression
  function progKey() { return 'progress.' + ((EL.app.profile && EL.app.profile.name) || 'anonyme'); }
  function loadProg() { return U.store.get(progKey(), {}); }
  function saveProg(p) { U.store.set(progKey(), p); }
  function mprog(p, id) { return p[id] || (p[id] = { done: {}, answers: {}, hints: {}, errors: {}, shared: {}, started: Date.now(), completed: 0 }); }

  function scaffold() { return EL.app.config ? EL.app.config.peda.scaffold : 1; }

  // ---------------------------------------------------------------- vue
  const view = {
    mount: function (main, args) {
      this.main = main;
      if (args[0]) this.openMission(args[0]);
      else this.renderList();
    },
    unmount: function () { clearInterval(this.timer); },
    renderList: function () {
      const main = this.main, p = loadProg();
      U.clear(main);
      main.appendChild(h('div.page-head', [h('div', [h('h1', 'Missions'), h('p', 'Travaux pratiques guidés, du plus simple au plus avancé. Les étapes se valident automatiquement grâce aux mesures du kit.')])]));
      const total = MISSIONS.length, done = MISSIONS.filter(function (m) { return p[m.id] && p[m.id].completed; }).length;
      const badges = h('div.row');
      for (let l = 1; l <= 6; l++) {
        const ms = MISSIONS.filter(function (m) { return m.level === l; });
        const ok = ms.every(function (m) { return p[m.id] && p[m.id].completed; });
        badges.appendChild(h('span.badge' + (ok ? '.ok' : ''), { title: BADGES[l][1], style: { fontSize: '.9rem', opacity: ok ? 1 : 0.45 } }, BADGES[l][0] + ' ' + BADGES[l][1]));
      }
      main.appendChild(h('div.card', [
        h('div.row.between', [h('b', 'Progression : ' + done + ' / ' + total + ' missions'), h('span.small.muted', 'Guidage : ' + ['fort', 'adaptatif', 'faible'][scaffold()])]),
        h('div.progress', { style: { margin: '8px 0' } }, h('i', { style: { width: (done / total * 100) + '%' } })),
        badges
      ]));
      for (let l = 1; l <= 6; l++) {
        main.appendChild(h('h2', { style: { margin: '18px 0 10px' } }, 'Niveau ' + l + ' — ' + LEVELS[l]));
        main.appendChild(h('div.mission-list', MISSIONS.filter(function (m) { return m.level === l; }).map(function (m) {
          const mp = p[m.id];
          const nd = mp ? Object.keys(mp.done).length : 0;
          return h('div.card.mission' + (mp && mp.completed ? '.done' : ''), { onclick: function () { location.hash = '#/missions/' + m.id; } }, [
            h('div.row.between', [h('span.lvl', 'Niveau ' + m.level + ' · ' + m.duration), mp && mp.completed ? h('span.badge.ok', '✓ terminée') : (nd ? h('span.badge.info', nd + '/' + m.steps.length) : null)]),
            h('h3', { style: { margin: '6px 0' } }, m.icon + ' ' + m.title),
            h('p.small.muted', { style: { margin: 0 } }, m.intro)
          ]);
        })));
      }
    },
    openMission: function (id) {
      const m = MISSIONS.find(function (x) { return x.id === id; });
      if (!m) { this.renderList(); return; }
      const self = this, main = this.main;
      U.clear(main);
      const p = loadProg(), mp = mprog(p, m.id);
      if (!mp.startedLogged) { mp.startedLogged = true; saveProg(p); EL.track('mission_start', m.id); }
      this.m = m;
      this.ctxs = {};
      this.stepStart = Date.now();
      main.appendChild(h('div.row', { style: { marginBottom: '10px' } }, [h('a.btn.small', { href: '#/missions' }, '← Toutes les missions')]));
      main.appendChild(h('div.card', [
        h('div.lvl.small', { style: { color: 'var(--primary)', fontWeight: 800 } }, 'NIVEAU ' + m.level + ' — ' + LEVELS[m.level].toUpperCase() + ' · ' + m.duration),
        h('h1', { style: { margin: '6px 0' } }, m.icon + ' ' + m.title),
        h('p', m.intro),
        h('div.row', m.comp.map(function (c) { return h('span.badge.prim', '🎯 ' + c); })),
        h('details', { style: { marginTop: '10px' }, open: scaffold() === 0 }, [h('summary', h('b', '📖 Rappel de cours')), h('div.small', { html: m.theory })])
      ]));
      this.stepsBox = h('ol.steps', { style: { marginTop: '14px' } });
      main.appendChild(this.stepsBox);
      this.endBox = h('div');
      main.appendChild(this.endBox);
      this.renderSteps();
      this.timer = setInterval(function () { self.tickHints(); }, 5000);
    },
    current: function () {
      const p = loadProg(), mp = mprog(p, this.m.id);
      for (let i = 0; i < this.m.steps.length; i++) if (!mp.done[i]) return i;
      return -1;
    },
    renderSteps: function () {
      const self = this, m = this.m, box = this.stepsBox;
      const p = loadProg(), mp = mprog(p, m.id);
      U.clear(box);
      const cur = this.current();
      const sc = scaffold();
      this.stepEls = [];
      m.steps.forEach(function (st, i) {
        const done = !!mp.done[i];
        // guidage fort : seule l'étape courante est détaillée ; guidage faible : tout est visible
        const visible = done || i === cur || sc === 2 || (sc === 1 && i <= cur + 1);
        const li = h('li' + (done ? '.ok' : (i === cur ? '.current' : '')));
        li.appendChild(h('div', { html: st.text }));
        if (!visible) { li.classList.add('muted'); li.firstChild.textContent = 'Étape verrouillée : terminez d’abord les étapes précédentes.'; box.appendChild(li); self.stepEls.push(null); return; }
        const ctl = h('div', { style: { marginTop: '8px' } });
        const hintBox = h('div');
        li.append(ctl, hintBox);
        const ctx = self.ctxs[i] = self.ctxs[i] || { shared: mp.shared };
        if (done) {
          if (mp.answers[i] !== undefined) ctl.appendChild(h('div.small.muted', 'Votre réponse : ' + mp.answers[i]));
        } else if (st.type === 'action') {
          ctl.appendChild(h('div.row', [h('span.badge.info', '⏳ validation automatique'), h('button.btn.small', { onclick: function () { self.checkAction(i, true); } }, 'Vérifier')]));
        } else if (st.type === 'numeric') {
          const inp = h('input.inp', { type: 'number', step: 'any', style: { width: '150px' } });
          const unit = st.unitFn ? st.unitFn() : (st.unit || '');
          const fb = h('div.small');
          ctl.append(h('div.row', [inp, h('span', unit), h('button.btn.small.primary', { onclick: function () { self.checkNumeric(i, inp, fb); } }, 'Valider')]), fb);
        } else if (st.type === 'qcm') {
          const name = 'q' + m.id + i;
          const fb = h('div.small');
          const opts = h('div.qcm', st.options.map(function (o, j) { return h('label', [h('input', { type: 'radio', name: name, value: j }), o]); }));
          ctl.append(opts, h('button.btn.small.primary', { onclick: function () { self.checkQcm(i, opts, fb); } }, 'Valider'), fb);
        } else if (st.type === 'observe') {
          const ta = h('textarea.inp', { rows: 3, style: { width: '100%' }, placeholder: 'Votre observation / réponse…' });
          ctl.append(ta, h('button.btn.small.primary', { style: { marginTop: '6px' }, onclick: function () {
            if (ta.value.trim().length < 10) { EL.toast('Rédigez une réponse un peu plus complète', 'warn'); return; }
            self.complete(i, ta.value.trim());
          } }, 'Valider ma réponse'));
        }
        if (!done && st.hints && st.hints.length) {
          const shown = mp.hints[i] || 0;
          for (let j = 0; j < shown; j++) hintBox.appendChild(h('div.note.tip', { style: { marginTop: '6px' } }, '💡 ' + st.hints[j]));
          if (shown < st.hints.length && sc !== 0) hintBox.appendChild(h('button.btn.small.ghost', { style: { marginTop: '4px' }, onclick: function () { self.giveHint(i, 'demande'); } }, sc === 2 ? 'Je suis bloqué·e (indice)' : 'Un indice ?'));
        }
        box.appendChild(li);
        self.stepEls.push(li);
      });
      U.clear(this.endBox);
      if (mp.completed) {
        this.endBox.appendChild(h('div.card', { style: { marginTop: '14px', textAlign: 'center' } }, [
          h('div.badge-big', '🎉'), h('h2', 'Mission terminée !'),
          h('p', 'Durée : ' + U.fmtDuration((mp.completed - mp.started) / 1000) + ' · indices utilisés : ' + Object.values(mp.hints).reduce(function (a, b) { return a + b; }, 0) + ' · erreurs : ' + Object.values(mp.errors).reduce(function (a, b) { return a + b; }, 0)),
          h('div.row', { style: { justifyContent: 'center' } }, [h('a.btn.primary', { href: '#/missions' }, 'Mission suivante'), h('button.btn', { onclick: function () { self.reset(); } }, 'Recommencer')])
        ]));
      }
    },
    giveHint: function (i, why) {
      const p = loadProg(), mp = mprog(p, this.m.id);
      const st = this.m.steps[i];
      const n = mp.hints[i] || 0;
      if (!st.hints || n >= st.hints.length) return;
      mp.hints[i] = n + 1;
      saveProg(p);
      EL.track('mission_hint', { mission: this.m.id, step: i, n: n + 1, why: why });
      this.renderSteps();
    },
    tickHints: function () {
      // étayage : indices automatiques selon le mode
      const i = this.current();
      if (i < 0) return;
      const sc = scaffold(), st = this.m.steps[i];
      if (st.type === 'action') this.checkAction(i, false);
      if (!st.hints || !st.hints.length) return;
      const p = loadProg(), mp = mprog(p, this.m.id);
      const shown = mp.hints[i] || 0;
      const waited = (Date.now() - this.stepStart) / 1000;
      const errors = mp.errors[i] || 0;
      if (sc === 0 && shown < st.hints.length && waited > 20 + shown * 40) this.giveHint(i, 'auto-fort');
      else if (sc === 1 && shown < st.hints.length && (errors >= 2 * (shown + 1) || waited > 120 + shown * 120)) this.giveHint(i, errors ? 'auto-erreurs' : 'auto-temps');
    },
    checkAction: function (i, manual) {
      const s = EL.app.state;
      if (!s) return;
      const st = this.m.steps[i];
      const ctx = this.ctxs[i] || (this.ctxs[i] = { shared: mprog(loadProg(), this.m.id).shared });
      let ok = false;
      try { ok = !!st.check(s, ctx); } catch (e) { ok = false; }
      if (ok) {
        // les valeurs capturées sont partagées avec les étapes suivantes
        const p = loadProg(), mp = mprog(p, this.m.id);
        for (const k of Object.keys(ctx)) if (k !== 'shared') mp.shared[k] = ctx[k];
        saveProg(p);
        this.complete(i);
      } else if (manual) {
        EL.toast('Pas encore : vérifiez les conditions demandées', 'warn');
        this.error(i);
      }
    },
    checkNumeric: function (i, inp, fb) {
      const st = this.m.steps[i], s = EL.app.state;
      const v = Number(String(inp.value).replace(',', '.'));
      if (!Number.isFinite(v) || inp.value === '') { fb.textContent = 'Entrez un nombre.'; return; }
      const ctx = this.ctxs[i] || { shared: mprog(loadProg(), this.m.id).shared };
      let target;
      try { target = st.answer(s, ctx); } catch (e) { target = NaN; }
      if (!Number.isFinite(target)) { fb.textContent = 'Impossible de vérifier pour l’instant (mesure absente).'; return; }
      const ok = st.tolAbs !== undefined ? Math.abs(v - target) <= st.tolAbs : Math.abs(v - target) <= Math.abs(target) * (st.tolRel || 0.05) + 1e-9;
      EL.track('mission_answer', { mission: this.m.id, step: i, value: v, expected: +target.toFixed(4), ok: ok });
      if (ok) { this.complete(i, String(v)); EL.toast('Bonne réponse ! (valeur attendue ≈ ' + U.fmt(target, Math.abs(target) < 10 ? 2 : 1) + ')', 'ok'); }
      else {
        fb.style.color = 'var(--danger)';
        fb.textContent = v > target ? 'Trop grand. Vérifiez votre calcul et les unités.' : 'Trop petit. Vérifiez votre calcul et les unités.';
        this.error(i);
      }
    },
    checkQcm: function (i, opts, fb) {
      const st = this.m.steps[i];
      const sel = opts.querySelector('input:checked');
      if (!sel) { fb.textContent = 'Choisissez une réponse.'; return; }
      const j = Number(sel.value), ok = j === st.correct;
      EL.track('mission_answer', { mission: this.m.id, step: i, choice: j, ok: ok });
      U.$$('label', opts).forEach(function (l, k) { l.classList.remove('right', 'wrong'); if (k === j) l.classList.add(ok ? 'right' : 'wrong'); });
      if (ok) {
        EL.toast('Exact !', 'ok');
        const self = this;
        if (st.explain) EL.modal({ title: '✓ Bonne réponse', body: h('p', st.explain), onClose: function () { self.complete(i, st.options[j]); } });
        else this.complete(i, st.options[j]);
      } else {
        fb.style.color = 'var(--danger)';
        fb.textContent = 'Ce n’est pas la bonne réponse. ' + (scaffold() === 0 && st.explain ? 'Indice : ' + st.explain.split('.')[0] + '.' : 'Réessayez.');
        this.error(i);
      }
    },
    error: function (i) {
      const p = loadProg(), mp = mprog(p, this.m.id);
      mp.errors[i] = (mp.errors[i] || 0) + 1;
      saveProg(p);
    },
    complete: function (i, answer) {
      const p = loadProg(), mp = mprog(p, this.m.id);
      if (mp.done[i]) return;
      mp.done[i] = Date.now();
      if (answer !== undefined) mp.answers[i] = answer;
      EL.track('mission_step_ok', { mission: this.m.id, step: i, seconds: Math.round((Date.now() - this.stepStart) / 1000), hints: mp.hints[i] || 0, errors: mp.errors[i] || 0, answer: answer });
      this.stepStart = Date.now();
      if (Object.keys(mp.done).length === this.m.steps.length && !mp.completed) {
        mp.completed = Date.now();
        EL.track('mission_complete', { mission: this.m.id, seconds: Math.round((mp.completed - mp.started) / 1000) });
        if (EL.app.kit) EL.app.kit.cmd({ cmd: 'beep', n: 3 });
      }
      saveProg(p);
      this.renderSteps();
    },
    reset: async function () {
      if (!(await EL.confirm('Recommencer', 'Effacer votre progression sur cette mission ?', 'Recommencer'))) return;
      const p = loadProg();
      delete p[this.m.id];
      saveProg(p);
      this.openMission(this.m.id);
    }
  };

  EL.MISSIONS = MISSIONS;
  EL.views.missions = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ---- 64_data.js ---- */
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

/* ---- 66_research.js ---- */
/* EnergyLab — module d'évaluation pour la recherche : pré-test / post-test, utilisabilité (SUS),
 * motivation, et analyse statistique (t de Student apparié, d de Cohen, gain normalisé de Hake) */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  if (typeof document === 'undefined') return;
  const U = EL.util, h = U.h;

  // ---------------------------------------------------------------- instruments
  const TEST = [
    { q: 'Une bouilloire de 2 000 W fonctionne pendant 6 minutes. Quelle énergie consomme-t-elle ?', o: ['200 Wh', '12 000 Wh', '2 000 Wh', '333 Wh'], c: 0 },
    { q: 'L’unité de la puissance active est :', o: ['le watt (W)', 'le kilowattheure (kWh)', 'le volt-ampère réactif (var)', 'l’ampère (A)'], c: 0 },
    { q: 'Sur une facture d’électricité, on paie principalement :', o: ['l’énergie consommée (kWh)', 'la tension (V)', 'le courant (A)', 'la fréquence (Hz)'], c: 0 },
    { q: 'Un appareil mesure U = 230 V et I = 0,5 A avec un facteur de puissance de 0,6. Sa puissance active vaut :', o: ['69 W', '115 W', '460 W', '383 W'], c: 0 },
    { q: 'Pour un radiateur électrique (résistance), le facteur de puissance est proche de :', o: ['1', '0,5', '0', '2'], c: 0 },
    { q: 'La puissance apparente S est :', o: ['le produit U × I', 'toujours égale à P', 'la puissance perdue en chaleur', 'l’énergie divisée par la tension'], c: 0 },
    { q: 'Un téléviseur en veille consomme 2 W en permanence. Sur une année, cela fait environ :', o: ['17,5 kWh', '2 kWh', '730 kWh', '0,05 kWh'], c: 0 },
    { q: 'Le « délestage » consiste à :', o: ['couper temporairement des appareils peu prioritaires pour ne pas dépasser une puissance limite', 'augmenter la tension', 'mesurer l’énergie', 'changer de fournisseur'], c: 0 },
    { q: 'Décaler le fonctionnement d’un chauffe-eau vers les heures creuses permet surtout de :', o: ['réduire le coût', 'réduire la tension', 'augmenter le facteur de puissance', 'supprimer la consommation'], c: 0 },
    { q: 'Dans un thermostat, l’hystérésis sert à :', o: ['éviter que le chauffage s’allume et s’éteigne trop souvent', 'chauffer plus vite', 'mesurer l’humidité', 'augmenter la consigne'], c: 0 },
    { q: 'Un relais est :', o: ['un interrupteur commandé électriquement', 'un capteur de courant', 'un disjoncteur différentiel', 'une résistance'], c: 0 },
    { q: 'Dans l’algorithme des k plus proches voisins, un appareil inconnu est reconnu :', o: ['par vote des exemples appris les plus proches de sa mesure', 'au hasard', 'par sa couleur', 'par la tension du réseau uniquement'], c: 0 },
    { q: 'Le disjoncteur différentiel 30 mA protège avant tout :', o: ['les personnes contre l’électrocution', 'les appareils contre la surtension', 'le compteur contre le vol', 'le Wi-Fi'], c: 0 },
    { q: 'Le capteur de courant (tore) doit entourer :', o: ['un seul conducteur (la phase)', 'la phase et le neutre ensemble', 'le fil de terre', 'le câble USB'], c: 0 }
  ];
  // SUS - System Usability Scale (Brooke, 1996), traduction française (Gronier & Baudet, 2021)
  const SUS = [
    'Je pense que j’aimerais utiliser ce système fréquemment.',
    'J’ai trouvé ce système inutilement complexe.',
    'J’ai trouvé ce système facile à utiliser.',
    'Je pense que j’aurais besoin de l’aide d’un technicien pour être capable d’utiliser ce système.',
    'J’ai trouvé que les différentes fonctions de ce système ont été bien intégrées.',
    'J’ai trouvé qu’il y avait trop d’incohérences dans ce système.',
    'Je suppose que la plupart des gens apprendraient très rapidement à utiliser ce système.',
    'J’ai trouvé ce système très lourd à utiliser.',
    'Je me suis senti·e très en confiance en utilisant ce système.',
    'J’ai eu besoin d’apprendre beaucoup de choses avant de pouvoir utiliser ce système.'
  ];
  // Motivation (adapté de l'Intrinsic Motivation Inventory, McAuley, Duncan & Tammen, 1989) — échelle 1 à 7
  const IMI = [
    { t: 'J’ai pris plaisir à faire ces activités.', s: 'interet', r: false },
    { t: 'Ces activités étaient intéressantes.', s: 'interet', r: false },
    { t: 'J’ai trouvé ces activités ennuyeuses.', s: 'interet', r: true },
    { t: 'Je pense être assez compétent·e dans ces activités.', s: 'competence', r: false },
    { t: 'Je suis satisfait·e de ma performance.', s: 'competence', r: false },
    { t: 'Je pense que ces activités peuvent m’être utiles.', s: 'valeur', r: false },
    { t: 'Ces activités sont importantes pour comprendre l’énergie à la maison.', s: 'valeur', r: false },
    { t: 'Je me suis senti·e tendu·e pendant ces activités.', s: 'pression', r: false }
  ];

  // ---------------------------------------------------------------- statistiques
  function mean(a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }
  function sd(a) { if (a.length < 2) return NaN; const m = mean(a); return Math.sqrt(a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / (a.length - 1)); }
  // fonction bêta incomplète régularisée (Numerical Recipes, fraction continue)
  function betacf(a, b, x) {
    const MAXIT = 200, EPS = 3e-12, FPMIN = 1e-300;
    let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let hh = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; hh *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c;
      hh *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return hh;
  }
  function gammaln(x) {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }
  function ibeta(a, b, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(gammaln(a + b) - gammaln(a) - gammaln(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }
  // p bilatéral pour une statistique t à df degrés de liberté
  function pT(t, df) { return ibeta(df / 2, 0.5, df / (df + t * t)); }
  function pairedT(pre, post) {
    const d = pre.map(function (x, i) { return post[i] - x; });
    const n = d.length;
    if (n < 2) return null;
    const md = mean(d), sdd = sd(d);
    const t = sdd > 0 ? md / (sdd / Math.sqrt(n)) : NaN;
    return { n: n, meanDiff: md, sdDiff: sdd, t: t, df: n - 1, p: Number.isFinite(t) ? pT(Math.abs(t), n - 1) : NaN, dz: sdd > 0 ? md / sdd : NaN };
  }
  function welchT(a, b) {
    if (a.length < 2 || b.length < 2) return null;
    const ma = mean(a), mb = mean(b), va = sd(a) ** 2, vb = sd(b) ** 2;
    const se = Math.sqrt(va / a.length + vb / b.length);
    const t = (ma - mb) / se;
    const df = (va / a.length + vb / b.length) ** 2 / ((va / a.length) ** 2 / (a.length - 1) + (vb / b.length) ** 2 / (b.length - 1));
    const sp = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / (a.length + b.length - 2));
    return { t: t, df: df, p: pT(Math.abs(t), df), d: sp > 0 ? (ma - mb) / sp : NaN, ma: ma, mb: mb };
  }
  function susScore(ans) {
    let s = 0;
    for (let i = 0; i < 10; i++) s += i % 2 === 0 ? ans[i] - 1 : 5 - ans[i];
    return s * 2.5;
  }

  // ---------------------------------------------------------------- vue
  const view = {
    mount: function (main) {
      this.main = main;
      this.render();
    },
    render: function () {
      const self = this, main = this.main;
      U.clear(main);
      main.appendChild(h('div.page-head', [h('div', [h('h1', 'Évaluation'), h('p', 'Questionnaires pour mesurer les apprentissages et l’expérience utilisateur. Les réponses sont enregistrées sur le kit pour l’enseignant-chercheur.')])]));
      const p = EL.app.profile || {};
      const done = U.store.get('research.done.' + (p.name || 'anonyme'), {});
      const card = function (id, icon, title, desc, fn) {
        return h('div.card', [h('h2', icon + ' ' + title), h('p.small', desc), h('div.row', [
          done[id] ? h('span.badge.ok', '✓ déjà répondu') : null,
          h('button.btn' + (done[id] ? '' : '.primary'), { onclick: fn }, done[id] ? 'Répondre à nouveau' : 'Commencer')
        ])]);
      };
      main.appendChild(h('div.grid.g2', [
        card('pretest', '📝', 'Pré-test de connaissances', TEST.length + ' questions à choix multiple, à faire AVANT les activités (environ 10 min).', function () { self.test('pretest'); }),
        card('posttest', '✅', 'Post-test de connaissances', 'Les mêmes questions, à faire APRÈS les activités : on mesure la progression.', function () { self.test('posttest'); }),
        card('sus', '🖐️', 'Utilisabilité (SUS)', 'Questionnaire standard de 10 affirmations (System Usability Scale).', function () { self.likert('sus'); }),
        card('motivation', '🔥', 'Motivation', '8 affirmations sur l’intérêt, la compétence perçue, l’utilité et la tension ressentie.', function () { self.likert('motivation'); })
      ]));
      main.appendChild(h('div.card', { style: { marginTop: '14px' } }, [
        h('h2', '👩‍🏫 Espace enseignant-chercheur'),
        h('p.small', 'Analyse des résultats enregistrés sur le kit : progression pré/post-test, gain normalisé, test t de Student apparié, taille d’effet, comparaison de groupes (ex. guidage fort / faible), score SUS moyen.'),
        h('button.btn', { onclick: async function () { if (await EL.requireTeacher()) self.analysis(); } }, [EL.icon('chart'), 'Analyser les résultats'])
      ]));
    },
    submit: async function (kind, score, max, answers, t0) {
      const p = EL.app.profile || {};
      const res = {
        ts: new Date().toISOString(), learner: p.name || 'anonyme', group: p.group || '', cond: EL.app.config ? EL.SCAF[EL.app.config.peda.scaffold] : '',
        kind: kind, score: Math.round(score * 100) / 100, max: max, duration: Math.round((Date.now() - t0) / 1000), answers: answers
      };
      const r = await EL.app.kit.postResult(res);
      const key = 'research.done.' + (p.name || 'anonyme');
      const done = U.store.get(key, {});
      done[kind] = res.ts;
      U.store.set(key, done);
      const local = U.store.get('research.local', []);
      local.push(res);
      U.store.set('research.local', local);
      EL.track('research_submit', { kind: kind, score: res.score });
      EL.toast(r && r.ok ? 'Merci ! Réponses enregistrées.' : 'Réponses gardées sur cet appareil (kit injoignable).', r && r.ok ? 'ok' : 'warn');
      return res;
    },
    test: function (kind) {
      const self = this, t0 = Date.now();
      const body = h('div');
      body.appendChild(h('p.small.muted', 'Répondez seul·e, sans chercher : on mesure ce que vous savez. Il n’y a pas de note.'));
      const groups = TEST.map(function (q, i) {
        const g = h('div.qcm', { style: { marginBottom: '14px' } }, [h('b', (i + 1) + '. ' + q.q)]);
        // ordre des options mélangé de façon reproductible (même ordre au pré et au post-test)
        const order = q.o.map(function (_, j) { return j; }).sort(function (a, b) { return ((a * 7 + i * 3) % 5) - ((b * 7 + i * 3) % 5); });
        order.forEach(function (j) { g.appendChild(h('label', [h('input', { type: 'radio', name: 'tq' + i, value: j }), q.o[j]])); });
        body.appendChild(g);
        return g;
      });
      EL.modal({
        title: kind === 'pretest' ? 'Pré-test' : 'Post-test', body: body, wide: true,
        actions: [{ label: 'Annuler' }, {
          label: 'Envoyer mes réponses', kind: 'primary', onClick: async function () {
            const answers = groups.map(function (g) { const s = g.querySelector('input:checked'); return s ? Number(s.value) : -1; });
            if (answers.some(function (a) { return a < 0; })) { EL.toast('Répondez à toutes les questions', 'warn'); return false; }
            const score = answers.reduce(function (s, a, i) { return s + (a === TEST[i].c ? 1 : 0); }, 0);
            await self.submit(kind, score, TEST.length, answers, t0);
            self.render();
          }
        }]
      });
    },
    likert: function (kind) {
      const self = this, t0 = Date.now();
      const items = kind === 'sus' ? SUS.map(function (t) { return { t: t }; }) : IMI;
      const n = kind === 'sus' ? 5 : 7;
      const body = h('div');
      body.appendChild(h('p.small.muted', kind === 'sus' ? '1 = pas du tout d’accord … 5 = tout à fait d’accord' : '1 = pas du tout vrai … 7 = tout à fait vrai'));
      const rows = items.map(function (it, i) {
        const row = h('div', { style: { marginBottom: '12px' } }, [h('div', (i + 1) + '. ' + it.t)]);
        const lk = h('div.likert', { style: { '--n': n } });
        for (let v = 1; v <= n; v++) lk.appendChild(h('label', [h('input', { type: 'radio', name: 'lk' + i, value: v }), String(v)]));
        row.appendChild(lk);
        body.appendChild(row);
        return row;
      });
      EL.modal({
        title: kind === 'sus' ? 'Utilisabilité du kit (SUS)' : 'Motivation', body: body, wide: true,
        actions: [{ label: 'Annuler' }, {
          label: 'Envoyer', kind: 'primary', onClick: async function () {
            const ans = rows.map(function (r) { const s = r.querySelector('input:checked'); return s ? Number(s.value) : 0; });
            if (ans.some(function (a) { return !a; })) { EL.toast('Répondez à toutes les affirmations', 'warn'); return false; }
            let score, max;
            if (kind === 'sus') { score = susScore(ans); max = 100; } else {
              score = mean(ans.map(function (a, i) { return IMI[i].r ? 8 - a : a; }).filter(function (_, i) { return IMI[i].s !== 'pression'; }));
              max = 7;
            }
            await self.submit(kind, score, max, ans, t0);
            self.render();
          }
        }]
      });
    },
    analysis: async function () {
      const kit = EL.app.kit;
      let text = await kit.fetchFile('research', 'results.csv');
      let rows = U.parseCsv(text || '').slice(1).filter(function (r) { return r.length >= 8; });
      let source = 'kit';
      if (!rows.length) {
        source = 'cet appareil';
        rows = U.store.get('research.local', []).map(function (r) { return [r.ts, r.learner, r.group, r.cond, r.kind, r.score, r.max, r.duration, JSON.stringify(r.answers)]; });
      }
      const recs = rows.map(function (r) { return { ts: r[0], learner: r[1], group: r[2], cond: r[3], kind: r[4], score: Number(r[5]), max: Number(r[6]) }; });
      // dernière réponse de chaque apprenant pour chaque instrument
      const last = {};
      for (const r of recs) { last[r.learner + '|' + r.kind] = r; }
      const learners = Array.from(new Set(recs.map(function (r) { return r.learner; })));
      const pairs = [];
      for (const l of learners) {
        const a = last[l + '|pretest'], b = last[l + '|posttest'];
        if (a && b) pairs.push({ learner: l, group: b.group || a.group, cond: b.cond || a.cond, pre: a.score, post: b.score, max: a.max });
      }
      const body = h('div');
      body.appendChild(h('p.small.muted', 'Source : ' + source + ' · ' + recs.length + ' réponse(s), ' + learners.length + ' apprenant(s), ' + pairs.length + ' paire(s) pré/post complètes.'));
      if (pairs.length) {
        const pre = pairs.map(function (x) { return x.pre; }), post = pairs.map(function (x) { return x.post; });
        const max = pairs[0].max;
        const st = pairedT(pre, post);
        const gains = pairs.map(function (x) { return x.max > x.pre ? (x.post - x.pre) / (x.max - x.pre) : 0; });
        const gAvg = (mean(post) - mean(pre)) / (max - mean(pre));
        body.appendChild(h('div.card.flat', [
          h('h3', 'Progression des connaissances (pré-test → post-test)'),
          h('table.tbl', h('tbody', [
            h('tr', [h('td', 'Score moyen au pré-test'), h('td.num', U.fmt(mean(pre), 2) + ' / ' + max + ' (σ = ' + U.fmt(sd(pre), 2) + ')')]),
            h('tr', [h('td', 'Score moyen au post-test'), h('td.num', U.fmt(mean(post), 2) + ' / ' + max + ' (σ = ' + U.fmt(sd(post), 2) + ')')]),
            h('tr', [h('td', 'Gain moyen'), h('td.num', U.fmt(st ? st.meanDiff : NaN, 2) + ' point(s)')]),
            h('tr', [h('td', 'Gain normalisé de Hake ⟨g⟩ (sur les moyennes)'), h('td.num', U.fmt(gAvg, 2) + ' (moyenne individuelle : ' + U.fmt(mean(gains), 2) + ')')]),
            h('tr', [h('td', 't de Student apparié'), h('td.num', st ? 't(' + st.df + ') = ' + U.fmt(st.t, 2) + ', p = ' + (st.p < 0.001 ? '< 0,001' : U.fmt(st.p, 3)) : 'au moins 2 paires nécessaires')]),
            h('tr', [h('td', 'Taille d’effet (d de Cohen pour mesures appariées, dz)'), h('td.num', U.fmt(st ? st.dz : NaN, 2))])
          ])),
          h('p.small.muted', 'Repères : ⟨g⟩ < 0,3 gain faible, 0,3–0,7 moyen, > 0,7 élevé (Hake, 1998). d ≈ 0,2 petit, 0,5 moyen, 0,8 grand (Cohen, 1988). Vérifiez la normalité des différences pour de petits effectifs (sinon, test de Wilcoxon).')
        ]));
        // comparaison des groupes / conditions
        const byKey = function (key) {
          const m = {};
          for (const x of pairs) { const k = x[key] || '(vide)'; (m[k] = m[k] || []).push(x.max > x.pre ? (x.post - x.pre) / (x.max - x.pre) : 0); }
          return m;
        };
        for (const key of ['cond', 'group']) {
          const m = byKey(key);
          const ks = Object.keys(m);
          if (ks.length < 2) continue;
          const rowsT = ks.map(function (k) { return h('tr', [h('td', k), h('td.num', String(m[k].length)), h('td.num', U.fmt(mean(m[k]), 2)), h('td.num', U.fmt(sd(m[k]), 2))]); });
          const w = ks.length === 2 ? welchT(m[ks[0]], m[ks[1]]) : null;
          body.appendChild(h('div.card.flat', { style: { marginTop: '10px' } }, [
            h('h3', 'Gain normalisé par ' + (key === 'cond' ? 'condition de guidage' : 'groupe')),
            h('table.tbl', [h('thead', h('tr', ['Modalité', 'n', 'g moyen', 'σ'].map(function (t, i) { return h('th' + (i ? '.num' : ''), t); }))), h('tbody', rowsT)]),
            w ? h('p.small', 'Test t de Welch (' + ks[0] + ' vs ' + ks[1] + ') : t(' + U.fmt(w.df, 1) + ') = ' + U.fmt(w.t, 2) + ', p = ' + (w.p < 0.001 ? '< 0,001' : U.fmt(w.p, 3)) + ', d = ' + U.fmt(w.d, 2)) : null
          ]));
        }
      }
      for (const inst of ['sus', 'motivation']) {
        const xs = learners.map(function (l) { return last[l + '|' + inst]; }).filter(Boolean).map(function (r) { return r.score; });
        if (!xs.length) continue;
        body.appendChild(h('div.card.flat', { style: { marginTop: '10px' } }, [
          h('h3', inst === 'sus' ? 'Utilisabilité (SUS)' : 'Motivation (1 à 7)'),
          h('p', 'n = ' + xs.length + ' ; moyenne = ' + U.fmt(mean(xs), 1) + ' ; σ = ' + U.fmt(sd(xs), 1) + (inst === 'sus' ? ' (repère : 68 = moyenne des systèmes évalués ; > 80 = excellent)' : ''))
        ]));
      }
      if (!recs.length) body.appendChild(h('div.empty', 'Aucun résultat pour le moment.'));
      EL.modal({
        title: 'Analyse des résultats', body: body, wide: true,
        actions: [
          { label: 'Télécharger results.csv', onClick: function () { U.download('results.csv', text || U.toCsv([['horodatage', 'apprenant', 'groupe', 'condition', 'instrument', 'score', 'max', 'duree_s', 'reponses']].concat(rows), ','), 'text/csv'); return false; } },
          { label: 'Télécharger les traces (events.csv)', onClick: async function () { U.download('events.csv', await kit.fetchFile('research', 'events.csv'), 'text/csv'); return false; } },
          { label: 'Fermer' }
        ]
      });
      EL.track('research_analysis', { n: recs.length });
    }
  };
  EL.stats = { mean: mean, sd: sd, pT: pT, pairedT: pairedT, welchT: welchT, susScore: susScore, ibeta: ibeta };
  EL.views.evaluation = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ---- 68_settings.js ---- */
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

/* ---- 70_help.js ---- */
/* EnergyLab — aide : démarrage rapide, connexion, sécurité, câblage, glossaire, blocs, FAQ */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  if (typeof document === 'undefined') return;
  const U = EL.util, h = U.h;

  const GLOSSARY = [
    ['Tension U (volt, V)', 'Différence de potentiel entre phase et neutre : environ 230 V sur le réseau domestique.'],
    ['Courant I (ampère, A)', 'Débit de charges électriques dans le circuit. Mesuré par le tore (transformateur de courant) du capteur.'],
    ['Puissance active P (watt, W)', 'Puissance réellement transformée (chaleur, lumière, mouvement). P = U × I × cos φ.'],
    ['Puissance apparente S (VA)', 'S = U × I. Dimensionne les câbles et les protections.'],
    ['Puissance réactive Q (var)', 'Q = √(S² − P²). Échangée sans être consommée (moteurs, électronique).'],
    ['Facteur de puissance (FP)', 'FP = P / S, entre 0 et 1. Proche de 1 pour une résistance.'],
    ['Énergie E (Wh, kWh)', 'E = P × t. C’est ce que mesure le compteur et ce que l’on paie. 1 kWh = 1 000 W pendant 1 h.'],
    ['Puissance souscrite', 'Puissance maximale prévue au contrat : au-delà, le disjoncteur du compteur coupe toute la maison.'],
    ['Heures creuses', 'Plage horaire où le kWh est moins cher (souvent la nuit).'],
    ['Relais', 'Interrupteur commandé électriquement par le microcontrôleur.'],
    ['Délestage', 'Couper temporairement des appareils peu prioritaires pour rester sous une puissance limite.'],
    ['Hystérésis', 'Écart entre le seuil d’allumage et le seuil d’extinction, qui évite les commutations répétées.'],
    ['Veille', 'Consommation d’un appareil « éteint » mais branché.'],
    ['k plus proches voisins (k-NN)', 'Méthode d’apprentissage supervisé : un objet prend la classe majoritaire de ses k exemples les plus proches.'],
    ['Lissage exponentiel (Holt)', 'Méthode de prévision qui suit un niveau et une tendance en donnant plus de poids aux mesures récentes.'],
    ['Score z', 'Écart à la moyenne exprimé en nombre d’écarts-types : sert à détecter les anomalies.'],
    ['Bytecode', 'Code intermédiaire très simple exécuté par la machine virtuelle du kit, produit à partir des blocs.'],
    ['Modbus RTU', 'Protocole série industriel utilisé entre l’ESP32 et les capteurs PZEM-004T.']
  ];

  const view = {
    mount: function (main) {
      const app = EL.app;
      const kitIp = app.info && app.info.ip ? 'http://' + app.info.ip : null;
      main.appendChild(h('div.page-head', [h('div', [h('h1', 'Aide & câblage'), h('p', 'Tout pour démarrer, se connecter, câbler le kit en sécurité et comprendre les notions.')])]));
      const toc = [['demarrer', '🚀 Démarrer'], ['connexion', '📶 Se connecter au kit'], ['securite', '⚠️ Sécurité'], ['cablage', '🔧 Câblage'], ['blocs', '🧩 Les blocs'], ['glossaire', '📖 Glossaire'], ['faq', '❓ Questions fréquentes'], ['apropos', 'ℹ️ À propos']];
      main.appendChild(h('div.row', { style: { marginBottom: '12px' } }, toc.map(function (t) { return h('a.btn.small', { href: '#', onclick: function (e) { e.preventDefault(); const el = document.getElementById('h-' + t[0]); if (el) el.scrollIntoView({ behavior: 'smooth' }); } }, t[1]); })));
      const c = h('div.card.help-content');
      c.innerHTML = [
        '<h2 id="h-demarrer">🚀 Démarrer en 5 minutes</h2><ol>',
        '<li>Branchez le kit sur une prise murale : l’écran affiche le nom du Wi-Fi du kit et son adresse.</li>',
        '<li>Connectez votre téléphone ou ordinateur à ce Wi-Fi (ou scannez le QR code de l’écran).</li>',
        '<li>Ouvrez <b>http://192.168.4.1</b> dans le navigateur : cette application s’affiche.</li>',
        '<li>Onglet <b>Maison</b> : allumez une prise et branchez un appareil, la puissance apparaît.</li>',
        '<li>Onglet <b>Missions</b> : suivez les travaux pratiques guidés, du niveau 1 au défi final.</li></ol>',
        '<h2 id="h-connexion">📶 Se connecter au kit</h2>',
        '<p><b>Mode 1 — Wi-Fi du kit (par défaut, sans Internet)</b> : le kit crée le réseau <code>' + U.escapeHtml((app.config && app.config.net.apSsid) || 'EnergyLab-XXXX') + '</code>. Mot de passe par défaut : <code>energie123</code>. Adresse : <b>http://192.168.4.1</b>. Jusqu’à 8 appareils.</p>',
        '<p><b>Mode 2 — Réseau de l’établissement ou partage de connexion</b> : en mode enseignant (Réglages &gt; Réseau), saisissez le nom et le mot de passe du réseau, puis redémarrez. Le kit, les PC et les téléphones doivent être sur le <b>même point d’accès</b>. L’adresse IP s’affiche sur l’écran du kit' + (kitIp ? ' (actuellement <b>' + kitIp + '</b>)' : '') + ' ; on peut aussi essayer <b>http://energylab.local</b>.</p>',
        '<p>Si le kit ne trouve pas le réseau, il recrée automatiquement son propre Wi-Fi. Pour revenir au mode 1, maintenez le bouton <b>BOOT</b> du kit 6 secondes.</p>',
        '<p class="note tip">Sur téléphone, si le système propose « Se connecter au réseau », acceptez : l’application s’ouvre. Pensez à désactiver les données mobiles si la page ne s’affiche pas.</p>',
        '<h2 id="h-securite">⚠️ Règles de sécurité</h2><ul>',
        '<li>Le kit fonctionne en <b>230 V</b> : seul l’enseignant ouvre le boîtier, <b>hors tension</b> (débranché).</li>',
        '<li>Ne jamais dépasser 2 300 W (10 A) au total : c’est la limite du disjoncteur du kit.</li>',
        '<li>Les apprenants ne manipulent que les prises du kit et l’application.</li>',
        '<li>Vérifier régulièrement le bouton test du disjoncteur différentiel 30 mA.</li>',
        '<li>Ne pas laisser un appareil chauffant (bouilloire, fer, radiateur) sans surveillance.</li>',
        '<li>Les protections logicielles du kit ne remplacent pas les protections matérielles.</li></ul>',
        '<h2 id="h-cablage">🔧 Câblage (résumé)</h2>',
        '<p>Le guide complet, avec les contrôles à faire avant la mise sous tension, se trouve dans le dossier <code>docs/</code> du projet (fichier <code>02-cablage.md</code>).</p>',
        '<table class="tbl"><thead><tr><th>Élément</th><th>Broche du module</th><th>ESP32</th></tr></thead><tbody>',
        '<tr><td>PZEM-004T ×4 (bus commun)</td><td>TX (via convertisseur de niveau)</td><td>GPIO16 (RX2)</td></tr>',
        '<tr><td></td><td>RX (via convertisseur de niveau)</td><td>GPIO17 (TX2)</td></tr>',
        '<tr><td></td><td>5V / GND</td><td>5 V / GND</td></tr>',
        '<tr><td>Module 4 relais</td><td>IN1 / IN2 / IN3 / IN4</td><td>GPIO26 / 25 / 33 / 32</td></tr>',
        '<tr><td></td><td>VCC / GND</td><td>5 V / GND</td></tr>',
        '<tr><td>Écran OLED I2C</td><td>SDA / SCL</td><td>GPIO21 / GPIO22 (3,3 V)</td></tr>',
        '<tr><td>DHT22</td><td>DATA</td><td>GPIO27 (3,3 V)</td></tr>',
        '<tr><td>Photorésistance + 10 kΩ</td><td>point milieu</td><td>GPIO34</td></tr>',
        '<tr><td>Détecteur HC-SR501</td><td>OUT</td><td>GPIO35 (alimentation 5 V)</td></tr>',
        '<tr><td>Buzzer</td><td>+</td><td>GPIO13</td></tr></tbody></table>',
        '<p><img class="svg-diagram" src="img/cablage-basse-tension.svg" alt="Schéma de câblage basse tension"></p>',
        '<p><img class="svg-diagram" src="img/cablage-230v.svg" alt="Schéma de câblage 230 V"></p>',
        '<p class="note warn">Partie 230 V : le fil de <b>phase</b> de chaque prise passe <b>seul</b> dans le tore de son capteur, puis par le contact COM → NO du relais. Les bornes de tension des PZEM sont reliées en amont des relais (toujours alimentées).</p>',
        '<h2 id="h-blocs">🧩 Les blocs</h2>',
        '<ul><li><b>Événements</b> (jaune) : démarrent un script (au démarrage, toutes les N s, quand une condition devient vraie, à une heure, bouton).</li>',
        '<li><b>Contrôle</b> (orange) : attendre, répéter, si… alors… sinon.</li><li><b>Opérateurs</b> (vert) : calculs, comparaisons, et / ou / non.</li>',
        '<li><b>Variables</b> : mémoriser des valeurs.</li><li><b>Mesures</b> (bleu) : U, I, P, S, Q, FP, énergie, coût, ambiance, heure.</li>',
        '<li><b>Prises</b> (vert d’eau) : allumer, éteindre, minuterie.</li><li><b>Paramètres</b> (violet) : régler les relais et les capteurs (puissance max, alarme, période de mesure, lissage…).</li>',
        '<li><b>Intelligence</b> (rose) : délestage, prévision, tendance, anomalie, reconnaissance d’appareils.</li><li><b>Alertes</b> : messages, bips, écran du kit.</li></ul>',
        '<p>Le programme est <b>compilé</b> en bytecode et <b>exécuté par le kit</b> : il continue même si vous fermez l’application. Le bouton « Simuler » l’exécute sur la maison virtuelle (jumeau numérique), sans risque.</p>',
        '<h2 id="h-glossaire">📖 Glossaire</h2><dl>',
        GLOSSARY.map(function (g) { return '<dt><b>' + g[0] + '</b></dt><dd>' + g[1] + '</dd>'; }).join(''), '</dl>',
        '<h2 id="h-faq">❓ Questions fréquentes</h2>',
        '<p><b>Une prise affiche « capteur absent ».</b> Le capteur PZEM ne répond pas : vérifiez son alimentation 230 V, le 5 V, les fils TX/RX et son adresse (Réglages &gt; Capteurs PZEM).</p>',
        '<p><b>La puissance reste à 0 W pour un petit appareil.</b> Le capteur 100 A ne mesure pas sous 20 mA (≈ 4 W). Faites passer le fil 5 fois dans le tore et réglez « passages dans le tore » à 5.</p>',
        '<p><b>Une prise refuse de s’allumer.</b> Elle est peut-être verrouillée par une protection (bouton « Réarmer ») ou délestée par un programme.</p>',
        '<p><b>Mon programme ne fait rien.</b> Vérifiez qu’il commence par un bloc d’événement, et regardez la console (onglet Programmer).</p>',
        '<p><b>L’heure du kit est fausse.</b> Elle est réglée automatiquement par le navigateur à la connexion (ou par Internet en mode réseau existant).</p>',
        '<h2 id="h-apropos">ℹ️ À propos</h2>',
        '<p>EnergyLab — kit pédagogique IoT de gestion de l’énergie domestique : ESP32, capteurs PZEM-004T v3.0, relais, programmation par blocs exécutée sur le kit, jumeau numérique, laboratoire d’IA, missions guidées et outils d’évaluation pour la recherche.</p>',
        '<p class="small muted">Composants logiciels libres : Blockly (Google, licence Apache 2.0), ESPAsyncWebServer, AsyncTCP, ArduinoJson, U8g2, PubSubClient, bibliothèque DHT d’Adafruit. Voir le fichier THIRD_PARTY_NOTICES.md.</p>'
      ].join('');
      main.appendChild(c);
    }
  };
  EL.views.aide = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ---- 99_main.js ---- */
/* EnergyLab — démarrage de l'application */
(function (root) {
  'use strict';
  const EL = root.EL;
  if (typeof document === 'undefined') return;
  function start() {
    if (EL.applyTheme) EL.applyTheme();
    EL.boot().catch(function (e) {
      console.error(e);
      const main = document.getElementById('view');
      if (main) main.innerHTML = '<div class="note bad">Erreur au démarrage : ' + EL.util.escapeHtml(e.message) + '</div>';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : this);


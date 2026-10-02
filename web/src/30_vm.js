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

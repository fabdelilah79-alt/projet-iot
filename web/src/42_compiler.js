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

// EnergyLab - machine virtuelle des programmes à blocs (bytecode v1)
// Toute modification doit être reportée dans web/src/30_vm.js (même sémantique).
#include "vm.h"

#include <math.h>
#include <stdlib.h>
#include <string.h>

namespace vm {

int opArgCount(int op) {
  switch (op) {
    case OP_PUSH: case OP_LOAD: case OP_STORE: case OP_JMP: case OP_JZ: case OP_JNZ:
    case OP_FN: case OP_SENS: case OP_SENSG: case OP_PARGET: case OP_PARSET:
    case OP_BEEP: case OP_ALERT: case OP_LOG: case OP_LOGV: case OP_SCREEN:
    case OP_AI: case OP_STOP:
      return 1;
    default:
      return 0;
  }
}

int aiArity(int q) {
  switch (q) {
    case 0: return 2;
    case 1: case 2: case 3: case 4: case 5: case 6: case 7: return 1;
    default: return -1;
  }
}

static bool isInt(double v) { return isfinite(v) && floor(v) == v; }

static bool validParam(int p) { return (p >= 0 && p <= 5) || (p >= 10 && p <= 23); }

bool parseCode(const char* text, std::vector<double>& out, std::string& err) {
  out.clear();
  if (!text) { err = "code absent"; return false; }
  const char* p = text;
  while (*p) {
    while (*p == ' ' || *p == ',' || *p == '\n' || *p == '\r' || *p == '\t') p++;
    if (!*p) break;
    char* end = nullptr;
    double v = strtod(p, &end);
    if (end == p || !isfinite(v)) { err = "code invalide"; return false; }
    out.push_back(v);
    if ((int)out.size() > MAX_CODE) { err = "programme trop long"; return false; }
    p = end;
  }
  return true;
}

bool validate(const Program& prog, std::string& err) {
  const std::vector<double>& c = prog.code;
  const int n = (int)c.size();
  if (n == 0) { err = "programme vide"; return false; }
  if (n > MAX_CODE) { err = "programme trop long"; return false; }
  if (prog.scripts.empty()) { err = "aucun script (ajoutez un bloc d'événement)"; return false; }
  if ((int)prog.scripts.size() > MAX_SCRIPTS) { err = "trop de scripts"; return false; }
  if ((int)prog.vars.size() > MAX_VARS) { err = "trop de variables"; return false; }
  if ((int)prog.strs.size() > MAX_STRS) { err = "trop de textes"; return false; }
  for (size_t i = 0; i < prog.strs.size(); i++) {
    if (prog.strs[i].size() > (size_t)MAX_STR_LEN * 2) { err = "texte trop long"; return false; }
  }
  std::vector<uint8_t> boundary(n, 0);
  int pc = 0;
  while (pc < n) {
    if (!isInt(c[pc])) { err = "opcode invalide"; return false; }
    int op = (int)c[pc];
    if (op < 0 || op >= OP_COUNT) { err = "opcode inconnu"; return false; }
    boundary[pc] = 1;
    int na = opArgCount(op);
    if (na > 0 && pc + na >= n) { err = "opérande manquant"; return false; }
    if (na == 1) {
      double a = c[pc + 1];
      int ia = isInt(a) ? (int)a : -1;
      switch (op) {
        case OP_PUSH: break;
        case OP_LOAD: case OP_STORE:
          if (ia < 0 || ia >= (int)prog.vars.size()) { err = "variable invalide"; return false; }
          break;
        case OP_JMP: case OP_JZ: case OP_JNZ:
          if (ia < 0 || ia >= n) { err = "saut invalide"; return false; }
          break;
        case OP_FN: if (ia < 0 || ia > 5) { err = "fonction invalide"; return false; } break;
        case OP_SENS: if (ia < 0 || ia > 14) { err = "grandeur invalide"; return false; } break;
        case OP_SENSG: if (ia < 0 || ia > 18) { err = "grandeur invalide"; return false; } break;
        case OP_PARGET: case OP_PARSET:
          if (!validParam(ia)) { err = "paramètre invalide"; return false; }
          break;
        case OP_BEEP: if (ia < 0 || ia > 3) { err = "bip invalide"; return false; } break;
        case OP_ALERT: case OP_LOG: case OP_LOGV: case OP_SCREEN:
          if (ia < 0 || ia >= (int)prog.strs.size()) { err = "texte invalide"; return false; }
          break;
        case OP_AI: if (aiArity(ia) < 0) { err = "fonction IA invalide"; return false; } break;
        case OP_STOP: if (ia < 0 || ia > 1) { err = "arrêt invalide"; return false; } break;
        default: break;
      }
    }
    pc += 1 + na;
  }
  // Les cibles de saut doivent être des débuts d'instruction
  pc = 0;
  while (pc < n) {
    int op = (int)c[pc];
    int na = opArgCount(op);
    if (op == OP_JMP || op == OP_JZ || op == OP_JNZ) {
      if (!boundary[(int)c[pc + 1]]) { err = "saut au milieu d'une instruction"; return false; }
    }
    pc += 1 + na;
  }
  for (size_t i = 0; i < prog.scripts.size(); i++) {
    const ScriptDef& d = prog.scripts[i];
    if (d.type < ST_START || d.type > ST_BUTTON) { err = "type de script invalide"; return false; }
    if (d.entry < 0 || d.entry >= n || !boundary[d.entry]) { err = "entrée de script invalide"; return false; }
    if (d.type == ST_EVERY && !(d.period >= 0.1 && d.period <= 86400)) { err = "période invalide"; return false; }
    if (d.type == ST_WHEN && (d.cond < 0 || d.cond >= n || !boundary[d.cond])) { err = "condition invalide"; return false; }
    if (d.type == ST_AT && (d.h < 0 || d.h > 23 || d.m < 0 || d.m > 59)) { err = "heure invalide"; return false; }
    if (d.type == ST_BUTTON && (d.btn < 1 || d.btn > 4)) { err = "bouton invalide"; return false; }
  }
  return true;
}

bool Machine::truthy(double v) { return v != 0 && !isnan(v); }

static int toIndex(double v) {
  if (!isfinite(v) || v > 1e6 || v < -1e6) return -1;
  return (int)floor(v + 0.5);
}

bool Machine::load(const Program& p, std::string& err) {
  if (!validate(p, err)) return false;
  prog_ = p;
  vars_.assign(p.vars.size(), 0.0);
  st_.assign(p.scripts.size(), ScriptState());
  hasTriggers_ = false;
  for (size_t i = 0; i < p.scripts.size(); i++) {
    if (p.scripts[i].type != ST_START) hasTriggers_ = true;
  }
  loaded_ = true;
  status_ = VM_IDLE;
  err_.clear();
  errScript_ = errPc_ = -1;
  return true;
}

void Machine::start(double nowMs, uint32_t seed) {
  if (!loaded_) return;
  for (size_t i = 0; i < vars_.size(); i++) vars_[i] = 0;
  rng_ = seed ? seed : 0x9E3779B9u;
  err_.clear();
  errScript_ = errPc_ = -1;
  startedAt_ = nowMs;
  now_ = nowMs;
  status_ = VM_RUNNING;
  for (size_t i = 0; i < st_.size(); i++) {
    ScriptState& s = st_[i];
    s = ScriptState();
    s.nextFire = nowMs;
  }
  for (size_t i = 0; i < st_.size(); i++) {
    if (prog_.scripts[i].type == ST_START) startScript((int)i, nowMs);
  }
}

void Machine::stop() {
  for (size_t i = 0; i < st_.size(); i++) {
    st_[i].running = false;
    st_[i].sp = 0;
  }
  if (status_ == VM_RUNNING) status_ = VM_STOPPED;
}

void Machine::pressButton(int b) {
  if (status_ != VM_RUNNING) return;
  for (size_t i = 0; i < st_.size(); i++) {
    if (prog_.scripts[i].type == ST_BUTTON && prog_.scripts[i].btn == b) st_[i].pendingBtn = true;
  }
}

int Machine::scriptPc(int i) const {
  if (i < 0 || i >= (int)st_.size()) return -1;
  return st_[i].running ? st_[i].pc : -1;
}

void Machine::startScript(int idx, double now) {
  ScriptState& s = st_[idx];
  s.running = true;
  s.pc = prog_.scripts[idx].entry;
  s.sp = 0;
  s.wakeAt = now;
}

bool Machine::anyRunning() const {
  for (size_t i = 0; i < st_.size(); i++)
    if (st_[i].running) return true;
  return false;
}

void Machine::fail(int script, int pc, const char* msg) {
  status_ = VM_ERROR;
  err_ = msg;
  errScript_ = script;
  errPc_ = pc;
  for (size_t i = 0; i < st_.size(); i++) {
    st_[i].running = false;
    st_[i].sp = 0;
  }
}

double Machine::rnd(double a, double b) {
  uint32_t x = rng_;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  rng_ = x;
  double u = (double)x / 4294967296.0;
  double lo = a < b ? a : b;
  double hi = a < b ? b : a;
  if (!isfinite(lo) || !isfinite(hi)) return NAN;
  if (floor(lo) == lo && floor(hi) == hi) return lo + floor(u * (hi - lo + 1));
  return lo + u * (hi - lo);
}

void Machine::tick(double now) {
  if (status_ != VM_RUNNING) return;
  now_ = now;
  tickInstr_ = 0;
  // 1) déclencheurs
  for (size_t i = 0; i < st_.size(); i++) {
    const ScriptDef& d = prog_.scripts[i];
    ScriptState& s = st_[i];
    switch (d.type) {
      case ST_EVERY: {
        if (now >= s.nextFire) {
          if (!s.running) startScript((int)i, now);
          double per = d.period * 1000.0;
          while (s.nextFire <= now) s.nextFire += per;
        }
        break;
      }
      case ST_WHEN: {
        double v = 0;
        if (!evalCond((int)i, v)) return;
        bool c = truthy(v);
        if (c && !s.prevCond && !s.running) startScript((int)i, now);
        s.prevCond = c;
        break;
      }
      case ST_AT: {
        int h = 0, m = 0;
        long day = 0;
        if (hal_->clock(h, m, day) && h == d.h && m == d.m && day != s.lastDay) {
          s.lastDay = day;
          if (!s.running) startScript((int)i, now);
        }
        break;
      }
      case ST_BUTTON:
        if (s.pendingBtn) {
          s.pendingBtn = false;
          if (!s.running) startScript((int)i, now);
        }
        break;
      default:
        break;
    }
    if (status_ != VM_RUNNING) return;
  }
  // 2) exécution
  for (size_t i = 0; i < st_.size(); i++) {
    if (st_[i].running && st_[i].wakeAt <= now) {
      runScript((int)i, now);
      if (status_ != VM_RUNNING) break;
    }
  }
  lastTickInstr_ = tickInstr_;
  if (status_ == VM_RUNNING && !hasTriggers_ && !anyRunning()) status_ = VM_FINISHED;
}

// Évalue l'expression d'une condition (script de type 2). false si erreur.
bool Machine::evalCond(int idx, double& out) {
  const std::vector<double>& code = prog_.code;
  const int n = (int)code.size();
  double stack[STACK_SIZE];
  int sp = 0;
  int pc = prog_.scripts[idx].cond;
  int budget = 0;
  while (true) {
    if (pc < 0 || pc >= n) { fail(idx, pc, "adresse invalide"); return false; }
    if (++budget > COND_BUDGET) { fail(idx, pc, "condition trop longue"); return false; }
    tickInstr_++;
    int op = (int)code[pc];
    int na = opArgCount(op);
    double arg = na ? code[pc + 1] : 0;
    int next = pc + 1 + na;
#define CNEED(k) if (sp < (k)) { fail(idx, pc, "pile vide"); return false; }
#define CPUSH(v) do { if (sp >= STACK_SIZE) { fail(idx, pc, "pile pleine"); return false; } stack[sp++] = (v); } while (0)
    switch (op) {
      case OP_END: out = sp > 0 ? stack[sp - 1] : 0; return true;
      case OP_PUSH: CPUSH(arg); break;
      case OP_LOAD: CPUSH(vars_[(int)arg]); break;
      case OP_JMP: next = (int)arg; break;
      case OP_JZ: { CNEED(1); double c = stack[--sp]; if (!truthy(c)) next = (int)arg; break; }
      case OP_JNZ: { CNEED(1); double c = stack[--sp]; if (truthy(c)) next = (int)arg; break; }
      case OP_POP: CNEED(1); sp--; break;
      case OP_ADD: case OP_SUB: case OP_MUL: case OP_DIV: case OP_MOD:
      case OP_LT: case OP_LE: case OP_GT: case OP_GE: case OP_EQ: case OP_NE:
      case OP_AND: case OP_OR: case OP_MIN: case OP_MAX: case OP_RAND: {
        CNEED(2);
        double b = stack[--sp];
        double a = stack[--sp];
        double r = 0;
        switch (op) {
          case OP_ADD: r = a + b; break;
          case OP_SUB: r = a - b; break;
          case OP_MUL: r = a * b; break;
          case OP_DIV: r = (b == 0) ? 0 : a / b; break;
          case OP_MOD: r = (b == 0) ? 0 : a - b * floor(a / b); break;
          case OP_LT: r = a < b ? 1 : 0; break;
          case OP_LE: r = a <= b ? 1 : 0; break;
          case OP_GT: r = a > b ? 1 : 0; break;
          case OP_GE: r = a >= b ? 1 : 0; break;
          case OP_EQ: r = a == b ? 1 : 0; break;
          case OP_NE: r = a != b ? 1 : 0; break;
          case OP_AND: r = (truthy(a) && truthy(b)) ? 1 : 0; break;
          case OP_OR: r = (truthy(a) || truthy(b)) ? 1 : 0; break;
          case OP_MIN: r = a < b ? a : b; break;
          case OP_MAX: r = a > b ? a : b; break;
          case OP_RAND: r = rnd(a, b); break;
        }
        CPUSH(r);
        break;
      }
      case OP_NEG: { CNEED(1); stack[sp - 1] = -stack[sp - 1]; break; }
      case OP_NOT: { CNEED(1); stack[sp - 1] = truthy(stack[sp - 1]) ? 0 : 1; break; }
      case OP_FN: {
        CNEED(1);
        double a = stack[sp - 1];
        double r = 0;
        switch ((int)arg) {
          case 0: r = fabs(a); break;
          case 1: r = floor(a + 0.5); break;
          case 2: r = floor(a); break;
          case 3: r = ceil(a); break;
          case 4: r = sqrt(a); break;
          default: r = a * a; break;
        }
        stack[sp - 1] = r;
        break;
      }
      case OP_BETWEEN: {
        CNEED(3);
        double b = stack[--sp];
        double a = stack[--sp];
        double x = stack[--sp];
        double lo = a < b ? a : b, hi = a < b ? b : a;
        CPUSH((x >= lo && x <= hi) ? 1 : 0);
        break;
      }
      case OP_SENS: { CNEED(1); int k = toIndex(stack[--sp]); CPUSH(hal_->sensor((int)arg, k)); break; }
      case OP_SENSG: CPUSH(hal_->gsensor((int)arg)); break;
      case OP_PARGET: { CNEED(1); int k = toIndex(stack[--sp]); CPUSH(hal_->param((int)arg, k)); break; }
      case OP_AI: {
        int ar = aiArity((int)arg);
        CNEED(ar);
        double a = 0, b = 0;
        if (ar == 2) { b = stack[--sp]; a = stack[--sp]; } else { a = stack[--sp]; }
        CPUSH(hal_->ai((int)arg, a, b));
        break;
      }
      default:
        fail(idx, pc, "bloc non autorisé dans une condition");
        return false;
    }
#undef CNEED
#undef CPUSH
    pc = next;
  }
}

void Machine::runScript(int idx, double now) {
  ScriptState& s = st_[idx];
  const std::vector<double>& code = prog_.code;
  const int n = (int)code.size();
  int executed = 0;
#define NEED(k) if (s.sp < (k)) { fail(idx, pc, "pile vide"); return; }
#define PUSHV(v) do { if (s.sp >= STACK_SIZE) { fail(idx, pc, "pile pleine"); return; } s.stack[s.sp++] = (v); } while (0)
#define POPV() (s.stack[--s.sp])
  while (true) {
    const int pc = s.pc;
    if (pc < 0 || pc >= n) { fail(idx, pc, "adresse invalide"); return; }
    executed++;
    if (++tickInstr_ > (uint32_t)HARD_LIMIT) {
      fail(idx, pc, "trop d'instructions dans un tic (boucle sans attente ?)");
      return;
    }
    const int op = (int)code[pc];
    const int na = opArgCount(op);
    const double arg = na ? code[pc + 1] : 0;
    int next = pc + 1 + na;
    switch (op) {
      case OP_END:
        s.running = false;
        s.sp = 0;
        return;
      case OP_PUSH: PUSHV(arg); break;
      case OP_LOAD: PUSHV(vars_[(int)arg]); break;
      case OP_STORE: { NEED(1); vars_[(int)arg] = POPV(); break; }
      case OP_JMP: next = (int)arg; break;
      case OP_JZ: { NEED(1); double c = POPV(); if (!truthy(c)) next = (int)arg; break; }
      case OP_JNZ: { NEED(1); double c = POPV(); if (truthy(c)) next = (int)arg; break; }
      case OP_WAIT: {
        NEED(1);
        double sec = POPV();
        if (!(sec > 0)) sec = 0;
        if (sec > 604800) sec = 604800;
        s.wakeAt = now + sec * 1000.0;
        s.pc = next;
        return;
      }
      case OP_YIELD:
        if (executed >= SOFT_YIELD) {
          s.wakeAt = now;
          s.pc = next;
          return;
        }
        break;
      case OP_POP: { NEED(1); s.sp--; break; }
      case OP_ADD: case OP_SUB: case OP_MUL: case OP_DIV: case OP_MOD:
      case OP_LT: case OP_LE: case OP_GT: case OP_GE: case OP_EQ: case OP_NE:
      case OP_AND: case OP_OR: case OP_MIN: case OP_MAX: case OP_RAND: {
        NEED(2);
        double b = POPV();
        double a = POPV();
        double r = 0;
        switch (op) {
          case OP_ADD: r = a + b; break;
          case OP_SUB: r = a - b; break;
          case OP_MUL: r = a * b; break;
          case OP_DIV: r = (b == 0) ? 0 : a / b; break;
          case OP_MOD: r = (b == 0) ? 0 : a - b * floor(a / b); break;
          case OP_LT: r = a < b ? 1 : 0; break;
          case OP_LE: r = a <= b ? 1 : 0; break;
          case OP_GT: r = a > b ? 1 : 0; break;
          case OP_GE: r = a >= b ? 1 : 0; break;
          case OP_EQ: r = a == b ? 1 : 0; break;
          case OP_NE: r = a != b ? 1 : 0; break;
          case OP_AND: r = (truthy(a) && truthy(b)) ? 1 : 0; break;
          case OP_OR: r = (truthy(a) || truthy(b)) ? 1 : 0; break;
          case OP_MIN: r = a < b ? a : b; break;
          case OP_MAX: r = a > b ? a : b; break;
          case OP_RAND: r = rnd(a, b); break;
        }
        PUSHV(r);
        break;
      }
      case OP_NEG: { NEED(1); s.stack[s.sp - 1] = -s.stack[s.sp - 1]; break; }
      case OP_NOT: { NEED(1); s.stack[s.sp - 1] = truthy(s.stack[s.sp - 1]) ? 0 : 1; break; }
      case OP_FN: {
        NEED(1);
        double a = s.stack[s.sp - 1];
        double r = 0;
        switch ((int)arg) {
          case 0: r = fabs(a); break;
          case 1: r = floor(a + 0.5); break;
          case 2: r = floor(a); break;
          case 3: r = ceil(a); break;
          case 4: r = sqrt(a); break;
          default: r = a * a; break;
        }
        s.stack[s.sp - 1] = r;
        break;
      }
      case OP_BETWEEN: {
        NEED(3);
        double b = POPV();
        double a = POPV();
        double x = POPV();
        double lo = a < b ? a : b, hi = a < b ? b : a;
        PUSHV((x >= lo && x <= hi) ? 1 : 0);
        break;
      }
      case OP_SENS: { NEED(1); int k = toIndex(POPV()); PUSHV(hal_->sensor((int)arg, k)); break; }
      case OP_SENSG: PUSHV(hal_->gsensor((int)arg)); break;
      case OP_PARGET: { NEED(1); int k = toIndex(POPV()); PUSHV(hal_->param((int)arg, k)); break; }
      case OP_PARSET: {
        NEED(2);
        double v = POPV();
        int k = toIndex(POPV());
        hal_->setParam((int)arg, k, v);
        break;
      }
      case OP_RELAY: {
        NEED(2);
        double on = POPV();
        int k = toIndex(POPV());
        hal_->relay(k, truthy(on));
        break;
      }
      case OP_TOGGLE: { NEED(1); int k = toIndex(POPV()); hal_->toggle(k); break; }
      case OP_PULSE: {
        NEED(2);
        double sec = POPV();
        int k = toIndex(POPV());
        hal_->pulse(k, sec);
        break;
      }
      case OP_BEEP: hal_->beep((int)arg); break;
      case OP_ALERT: hal_->alert(prog_.strs[(int)arg].c_str()); break;
      case OP_LOG: hal_->log(prog_.strs[(int)arg].c_str(), 0, false); break;
      case OP_LOGV: { NEED(1); double v = POPV(); hal_->log(prog_.strs[(int)arg].c_str(), v, true); break; }
      case OP_SCREEN: hal_->screen(prog_.strs[(int)arg].c_str()); break;
      case OP_RESETE: { NEED(1); int k = toIndex(POPV()); hal_->resetEnergy(k); break; }
      case OP_AI: {
        int ar = aiArity((int)arg);
        NEED(ar);
        double a = 0, b = 0;
        if (ar == 2) { b = POPV(); a = POPV(); } else { a = POPV(); }
        PUSHV(hal_->ai((int)arg, a, b));
        break;
      }
      case OP_SHED: { NEED(1); double lim = POPV(); hal_->shed(lim); break; }
      case OP_STOP:
        if ((int)arg == 1) {
          for (size_t i = 0; i < st_.size(); i++) {
            st_[i].running = false;
            st_[i].sp = 0;
          }
          status_ = VM_FINISHED;
          return;
        }
        s.running = false;
        s.sp = 0;
        return;
      default:
        fail(idx, pc, "instruction inconnue");
        return;
    }
    s.pc = next;
    if (status_ != VM_RUNNING) return;
  }
#undef NEED
#undef PUSHV
#undef POPV
}

}  // namespace vm

// EnergyLab - machine virtuelle des programmes à blocs (bytecode v1)
// Indépendante du matériel : compilée sur l'ESP32 et sur PC pour les tests.
// Spécification : docs/specs/bytecode.md (doit rester identique à web/src/30_vm.js)
#pragma once

#include <stdint.h>
#include <string>
#include <vector>

namespace vm {

enum Op : int {
  OP_END = 0, OP_PUSH = 1, OP_LOAD = 2, OP_STORE = 3, OP_JMP = 4, OP_JZ = 5, OP_JNZ = 6,
  OP_WAIT = 7, OP_YIELD = 8, OP_POP = 9,
  OP_ADD = 10, OP_SUB = 11, OP_MUL = 12, OP_DIV = 13, OP_MOD = 14, OP_NEG = 15,
  OP_LT = 16, OP_LE = 17, OP_GT = 18, OP_GE = 19, OP_EQ = 20, OP_NE = 21,
  OP_AND = 22, OP_OR = 23, OP_NOT = 24, OP_FN = 25, OP_MIN = 26, OP_MAX = 27,
  OP_RAND = 28, OP_BETWEEN = 29,
  OP_SENS = 30, OP_SENSG = 31, OP_PARGET = 32, OP_PARSET = 33,
  OP_RELAY = 34, OP_TOGGLE = 35, OP_PULSE = 36, OP_BEEP = 37, OP_ALERT = 38,
  OP_LOG = 39, OP_LOGV = 40, OP_SCREEN = 41, OP_RESETE = 42, OP_AI = 43,
  OP_SHED = 44, OP_STOP = 45,
  OP_COUNT = 46
};

enum ScriptType : int { ST_START = 0, ST_EVERY = 1, ST_WHEN = 2, ST_AT = 3, ST_BUTTON = 4 };

enum Status : int { VM_IDLE = 0, VM_RUNNING = 1, VM_FINISHED = 2, VM_ERROR = 3, VM_STOPPED = 4 };

static const int MAX_CODE = 4096;
static const int MAX_SCRIPTS = 32;
static const int MAX_VARS = 64;
static const int MAX_STRS = 64;
static const int MAX_STR_LEN = 80;
static const int STACK_SIZE = 64;
static const int SOFT_YIELD = 300;
static const int HARD_LIMIT = 20000;
static const int COND_BUDGET = 1000;

// Nombre d'opérandes de chaque opcode (0 ou 1)
int opArgCount(int op);
// Nombre d'arguments dépilés par une fonction intelligente AI q
int aiArity(int q);

// Interface vers le matériel (kit réel, simulateur ou banc de test)
class Hal {
 public:
  virtual ~Hal() {}
  virtual double sensor(int q, int outlet) = 0;
  virtual double gsensor(int q) = 0;
  virtual double param(int p, int idx) = 0;
  virtual void setParam(int p, int idx, double v) = 0;
  virtual void relay(int outlet, bool on) = 0;  // outlet 0 = toutes
  virtual void toggle(int outlet) = 0;
  virtual void pulse(int outlet, double seconds) = 0;
  virtual void beep(int kind) = 0;
  virtual void alert(const char* msg) = 0;
  virtual void log(const char* msg, double value, bool hasValue) = 0;
  virtual void screen(const char* msg) = 0;
  virtual void resetEnergy(int outlet) = 0;
  virtual double ai(int q, double a, double b) = 0;
  virtual void shed(double limit) = 0;
  // Heure locale : renvoie false si l'horloge n'est pas réglée.
  // dayKey identifie le jour (ex. nombre de jours depuis 1970).
  virtual bool clock(int& hour, int& minute, long& dayKey) = 0;
};

struct ScriptDef {
  int type = 0;
  int entry = 0;
  int cond = -1;
  double period = 1;
  int h = 0, m = 0, btn = 1;
};

struct Program {
  std::string name;
  std::vector<double> code;
  std::vector<ScriptDef> scripts;
  std::vector<std::string> vars;
  std::vector<std::string> strs;
  std::string hash;
};

// Analyse la chaîne "code" (nombres séparés par des espaces). Renvoie false si invalide.
bool parseCode(const char* text, std::vector<double>& out, std::string& err);
// Vérifie la cohérence structurelle d'un programme (opcodes, opérandes, sauts...)
bool validate(const Program& p, std::string& err);

struct ScriptState {
  bool running = false;
  int pc = 0;
  double wakeAt = 0;
  double stack[STACK_SIZE];
  int sp = 0;
  double nextFire = 0;
  bool prevCond = false;
  long lastDay = -1;
  bool pendingBtn = false;
};

class Machine {
 public:
  explicit Machine(Hal* hal) : hal_(hal) {}

  // Charge un programme (déjà validé ou non). Renvoie false + err si invalide.
  bool load(const Program& p, std::string& err);
  void start(double nowMs, uint32_t seed);
  void stop();  // arrêt demandé par l'utilisateur
  void tick(double nowMs);
  void pressButton(int b);

  Status status() const { return status_; }
  const std::string& error() const { return err_; }
  int errorScript() const { return errScript_; }
  int errorPc() const { return errPc_; }
  bool loaded() const { return loaded_; }
  const Program& program() const { return prog_; }
  double var(int i) const { return (i >= 0 && i < (int)vars_.size()) ? vars_[i] : 0; }
  size_t varCount() const { return vars_.size(); }
  // pc courant de chaque script (-1 si arrêté)
  int scriptPc(int i) const;
  size_t scriptCount() const { return st_.size(); }
  double startedAt() const { return startedAt_; }
  uint32_t instructionsLastTick() const { return lastTickInstr_; }

  static bool truthy(double v);

 private:
  void fail(int script, int pc, const char* msg);
  void runScript(int idx, double now);
  bool evalCond(int entry, double& out);
  double rnd(double a, double b);
  void startScript(int idx, double now);
  bool anyRunning() const;

  Hal* hal_;
  Program prog_;
  bool loaded_ = false;
  std::vector<double> vars_;
  std::vector<ScriptState> st_;
  Status status_ = VM_IDLE;
  std::string err_;
  int errScript_ = -1, errPc_ = -1;
  uint32_t rng_ = 1;
  double startedAt_ = 0;
  double now_ = 0;
  uint32_t tickInstr_ = 0;
  uint32_t lastTickInstr_ = 0;
  bool hasTriggers_ = false;
};

}  // namespace vm

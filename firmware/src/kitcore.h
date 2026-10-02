// EnergyLab - cœur logique du kit (indépendant du matériel)
//  - traitement des mesures (étalonnage, lissage, grandeurs dérivées)
//  - énergie et coût du jour, pointe, CO2
//  - protections (surpuissance par prise, puissance totale)
//  - délestage par priorités
//  - fonctions intelligentes (historique, Holt, anomalies, veille, k-NN)
//  - interface matérielle de la machine virtuelle (vm::Hal)
//  - journal d'événements
// Le simulateur JavaScript (web/src/34_kitcore.js) en est une copie fidèle.
#pragma once

#include <stdint.h>

#include "ai.h"
#include "config.h"
#include "relays.h"
#include "vm.h"

enum LogLevel : uint8_t { LG_INFO = 0, LG_OK = 1, LG_WARN = 2, LG_ALERT = 3, LG_PROG = 4 };

struct LogEntry {
  uint32_t seq;
  int64_t ts;  // horodatage Unix (0 si horloge non réglée)
  uint8_t level;
  char msg[112];
};

struct RawMeas {
  bool ok = false;
  float u = 0, i = 0, p = 0, eWh = 0, f = 0, pf = 0;
  bool alarm = false;
};

struct OutletLive {
  float u = NAN, i = NAN, p = NAN, s = NAN, q = NAN, pf = NAN, f = NAN, phi = NAN;
  double eCounterKWh = NAN;
  double eTodayWh = 0;
  double costToday = 0;
  bool online = false;
  bool alarm = false;
  uint32_t okCount = 0, errCount = 0;
  uint8_t failStreak = 0;
  bool shed = false;
  float shedP = 0;
  uint8_t overCount = 0;
  char latchReason[64] = {0};
  double idleS = 0;
  int appliance = 0;
  float applianceDist = NAN;
  // lissage
  float bu[10], bi[10], bp[10], bpf[10], bf[10];
  uint8_t bn = 0, bpos = 0;
  float rawP = NAN;  // dernière puissance brute (protection)
  float pf5[5], p5[5];
  uint8_t n5 = 0, pos5 = 0;
};

struct EnvLive {
  float temp = NAN, hum = NAN, lum = NAN;
  bool pres = false;
  double lastMotion = -1e12;
  bool motion = false;
};

struct DaySummary {
  long dayKey = -1;
  float eWh[NOUT] = {0, 0, 0, 0};
  float cost[NOUT] = {0, 0, 0, 0};
  float peak = 0;
};

// Services matériels fournis par le firmware (ou par le banc de test)
class KitIO {
 public:
  virtual ~KitIO() {}
  virtual void beep(int kind) = 0;
  virtual void screenMessage(const char* msg) = 0;
  virtual void alertScreen(const char* msg) = 0;
  virtual void pzemResetEnergy(int outlet0) = 0;
  virtual void pzemSetAlarm(int outlet0, uint16_t watts) = 0;
  virtual void configChanged(uint32_t mask) = 0;
  virtual void onLog(const LogEntry& e) = 0;
};

class KitCore : public vm::Hal {
 public:
  KitCore(Config& cfg, Relays& relays, KitIO& io);

  // Horloge : valid=false tant que l'heure n'a pas été réglée
  void setClock(bool valid, int64_t epochUtc) { clockValid_ = valid; epoch_ = epochUtc; }
  bool clockValid() const { return clockValid_; }
  int64_t epoch() const { return epoch_; }
  bool localTime(int& h, int& m, int& s, int& wday, long& dayKey) const;

  void onMeasurement(int k, const RawMeas& r, double nowMs);
  void onEnv(float temp, float hum, float lum, bool motion, double nowMs);
  void tick100(double nowMs);
  void tick1s(double nowMs);

  // Commandes (interface web, MQTT...)
  Relays::Result userRelay(int k, bool on, Relays::Source src, double nowMs);
  bool rearm(int k);
  void shedStep(double limit, double nowMs);
  bool loadProgram(const vm::Program& p, std::string& err);
  void startProgram(double nowMs, uint32_t seed);
  void stopProgram();
  bool knnTrain(int k, const char* label, std::string& msg);
  void restoreDay(const DaySummary& d);
  DaySummary today() const;
  int dayCount() const { return dayCount_; }
  const DaySummary& day(int i) const { return days_[i]; }  // jours précédents (0 = hier)
  void restoreHistory(const DaySummary* arr, int n);
  long dayKey() const { return dayKey_; }
  void applyOutletConfig();

  // Journal
  void note(uint8_t level, const char* fmt, ...);
  const LogEntry* logAt(int i) const;  // 0 = plus récent
  int logCount() const { return logCount_; }
  uint32_t logSeq() const { return logSeq_; }

  // Agrégats
  double totalP() const;
  double totalEToday() const;
  double totalCostToday() const;
  double co2Today() const { return totalEToday() / 1000.0 * cfg_.co2; }
  double peakToday() const { return peakToday_; }
  double avgVoltage() const;
  bool offPeakNow() const;
  double priceNow() const;
  int relaysOn() const;
  bool pzemAlarmAny() const;

  // vm::Hal
  double sensor(int q, int outlet) override;
  double gsensor(int q) override;
  double param(int p, int idx) override;
  void setParam(int p, int idx, double v) override;
  void relay(int outlet, bool on) override;
  void toggle(int outlet) override;
  void pulse(int outlet, double seconds) override;
  void beep(int kind) override;
  void alert(const char* msg) override;
  void log(const char* msg, double value, bool hasValue) override;
  void screen(const char* msg) override;
  void resetEnergy(int outlet) override;
  double ai(int q, double a, double b) override;
  void shed(double limit) override;
  bool clock(int& hour, int& minute, long& dayKey) override;

  OutletLive out[NOUT];
  EnvLive env;
  ai::FastHistory hist;
  ai::Holt holt;
  ai::Anomaly anom[NOUT];
  ai::Knn knn;
  vm::Machine machine;
  uint32_t programRuns = 0;

 private:
  bool warnLimited(int key, double intervalMs, double nowMs);
  void safetyTotal(double nowMs);
  void rollover(long dayKey);
  int lastStatus_ = vm::VM_IDLE;
  Config& cfg_;
  Relays& rel_;
  KitIO& io_;
  bool clockValid_ = false;
  int64_t epoch_ = 0;
  double now_ = 0;
  double lastSec_ = -1;
  long dayKey_ = -1;
  double peakToday_ = 0;
  double shedHold_ = 0;
  double safetyHold_ = 0;
  DaySummary days_[7];
  int dayCount_ = 0;
  LogEntry logs_[40];
  int logHead_ = 0, logCount_ = 0;
  uint32_t logSeq_ = 0;
  double warnAt_[48];
};

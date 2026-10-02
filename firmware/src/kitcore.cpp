// EnergyLab - cœur logique du kit (voir kitcore.h)
#include "kitcore.h"

#include <math.h>
#include <algorithm>
#include <stdarg.h>
#include <stdio.h>
#include <string.h>

// délestage : premier nouvel essai de remise en service après 2 min, puis délai doublé (max 15 min)
static const double SHED_RETRY_MS = 120000, SHED_RETRY_MAX_MS = 900000, SHED_ABANDON_MS = 30000;

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

// Clés des avertissements limités en fréquence
enum WarnKey {
  WK_DELAY = 0,       // +k
  WK_LATCHED = 4,     // +k
  WK_BADOUTLET = 8,
  WK_CLOCK = 9,
  WK_PARAMS = 10,
  WK_RESET = 11,
  WK_DISABLED = 12,   // +k
  WK_CURRENT_OFF = 16,  // +k
  WK_VOLTAGE = 20,    // +k
  WK_PARAMMSG = 24,
  WK_ALARM = 28       // +k
};

static void utf8Trim(char* s) {
  size_t n = strlen(s);
  if (n == 0) return;
  // remonter au début du dernier caractère
  size_t i = n;
  int cont = 0;
  while (i > 0 && ((unsigned char)s[i - 1] & 0xC0) == 0x80) { i--; cont++; }
  if (i == 0) { s[0] = 0; return; }
  unsigned char lead = (unsigned char)s[i - 1];
  int need = 0;
  if (lead >= 0xF0) need = 3;
  else if (lead >= 0xE0) need = 2;
  else if (lead >= 0xC0) need = 1;
  if (need != cont) s[i - 1] = 0;
}

static int clampRound(double v, int lo, int hi) {
  if (!isfinite(v)) return lo;
  double r = floor(v + 0.5);
  if (r < lo) return lo;
  if (r > hi) return hi;
  return (int)r;
}

static int vmIdx(double v) {
  if (!isfinite(v) || v > 1e6 || v < -1e6) return -1;
  return (int)floor(v + 0.5);
}

KitCore::KitCore(Config& cfg, Relays& relays, KitIO& io) : machine(this), cfg_(cfg), rel_(relays), io_(io) {
  for (int i = 0; i < 48; i++) warnAt_[i] = -1e12;
}

bool KitCore::warnLimited(int key, double intervalMs, double now) {
  if (key < 0 || key >= 48) return true;
  if (now - warnAt_[key] < intervalMs) return false;
  warnAt_[key] = now;
  return true;
}

bool KitCore::localTime(int& h, int& m, int& s, int& wday, long& dayKey) const {
  if (!clockValid_) return false;
  int64_t t = epoch_ + (int64_t)cfg_.tzMin * 60;
  int64_t d = t >= 0 ? t / 86400 : -((-t + 86399) / 86400);
  int64_t sod = t - d * 86400;
  dayKey = (long)d;
  h = (int)(sod / 3600);
  m = (int)((sod / 60) % 60);
  s = (int)(sod % 60);
  wday = (int)(((d + 3) % 7 + 7) % 7) + 1;  // 1 = lundi (le 1/1/1970 était un jeudi)
  return true;
}

void KitCore::note(uint8_t level, const char* fmt, ...) {
  LogEntry& e = logs_[logHead_];
  e.seq = ++logSeq_;
  e.ts = clockValid_ ? epoch_ : 0;
  e.level = level;
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(e.msg, sizeof e.msg, fmt, ap);
  va_end(ap);
  utf8Trim(e.msg);
  logHead_ = (logHead_ + 1) % 40;
  if (logCount_ < 40) logCount_++;
  io_.onLog(e);
}

const LogEntry* KitCore::logAt(int i) const {
  if (i < 0 || i >= logCount_) return nullptr;
  int idx = logHead_ - 1 - i;
  while (idx < 0) idx += 40;
  return &logs_[idx % 40];
}

void KitCore::applyOutletConfig() {
  for (int k = 0; k < NOUT; k++) {
    float s = cfg_.out[k].minSwitchS;
    if (s < cfg_.minSwitchFloorS) s = cfg_.minSwitchFloorS;
    rel_.setMinSwitchMs(k, (uint32_t)(s * 1000.0f));
  }
}

// ------------------------------------------------------------------ mesures
void KitCore::onMeasurement(int k, const RawMeas& r, double now) {
  if (k < 0 || k >= NOUT) return;
  OutletLive& o = out[k];
  const OutletConfig& oc = cfg_.out[k];
  if (!oc.enabled) {
    o.online = false;
    o.u = o.i = o.p = o.s = o.q = o.pf = o.f = o.phi = NAN;
    o.rawP = NAN;
    return;
  }
  if (!r.ok) {
    o.errCount++;
    if (o.failStreak < 255) o.failStreak++;
    if (o.failStreak >= 3) {
      if (o.online) note(LG_WARN, "Prise %d (%s) : le capteur PZEM ne répond plus", k + 1, oc.name);
      o.online = false;
      o.u = o.i = o.p = o.s = o.q = o.pf = o.f = o.phi = NAN;
      o.rawP = NAN;
      o.bn = o.bpos = 0;
      o.n5 = o.pos5 = 0;
    }
    return;
  }
  o.okCount++;
  o.failStreak = 0;
  if (!o.online) {
    if (o.okCount > 1) note(LG_OK, "Prise %d (%s) : capteur PZEM de nouveau en ligne", k + 1, oc.name);
    o.online = true;
  }
  float turns = oc.ctTurns ? (float)oc.ctTurns : 1.0f;
  float u = r.u * oc.calU;
  float i = r.i * oc.calI / turns;
  float p = r.p * oc.calU * oc.calI / turns;
  o.eCounterKWh = (double)r.eWh * oc.calU * oc.calI / turns / 1000.0;
  o.alarm = r.alarm;
  o.rawP = p;
  // lissage par moyenne glissante
  o.bu[o.bpos] = u;
  o.bi[o.bpos] = i;
  o.bp[o.bpos] = p;
  o.bpf[o.bpos] = r.pf;
  o.bf[o.bpos] = r.f;
  o.bpos = (uint8_t)((o.bpos + 1) % 10);
  if (o.bn < 10) o.bn++;
  int n = cfg_.smoothN < 1 ? 1 : (cfg_.smoothN > 10 ? 10 : cfg_.smoothN);
  if (n > o.bn) n = o.bn;
  double su = 0, si = 0, sp = 0, spf = 0, sf = 0;
  for (int j = 0; j < n; j++) {
    int idx = (o.bpos - 1 - j + 20) % 10;
    su += o.bu[idx];
    si += o.bi[idx];
    sp += o.bp[idx];
    spf += o.bpf[idx];
    sf += o.bf[idx];
  }
  o.u = (float)(su / n);
  o.i = (float)(si / n);
  o.p = (float)(sp / n);
  o.pf = (float)(spf / n);
  o.f = (float)(sf / n);
  o.s = o.u * o.i;
  double q2 = (double)o.s * o.s - (double)o.p * o.p;
  o.q = q2 > 0 ? (float)sqrt(q2) : 0.0f;
  double c = o.pf < 0 ? 0 : (o.pf > 1 ? 1 : o.pf);
  o.phi = (float)(acos(c) * 180.0 / M_PI);
  // fenêtre de 5 mesures pour l'apprentissage k-NN
  o.p5[o.pos5] = o.p;
  o.pf5[o.pos5] = o.pf;
  o.pos5 = (uint8_t)((o.pos5 + 1) % 5);
  if (o.n5 < 5) o.n5++;

  // --- protections
  if (rel_.isOn(k) && !rel_.isLatched(k)) {
    if (p > oc.maxPower) {
      if (o.overCount < 255) o.overCount++;
    } else {
      o.overCount = 0;
    }
    if (o.overCount >= 2 || p > 1.5f * oc.maxPower) {
      snprintf(o.latchReason, sizeof o.latchReason, "%.0f W > %.0f W", p, oc.maxPower);
      rel_.latch(k, now);
      o.overCount = 0;
      o.shed = false;
      note(LG_ALERT, "Protection prise %d (%s) : %.0f W > max %.0f W. Prise coupée et verrouillée.", k + 1, oc.name, p,
           oc.maxPower);
      char m[64];
      snprintf(m, sizeof m, "Surpuissance P%d", k + 1);
      io_.alertScreen(m);
      if (cfg_.buzzerOn) io_.beep(2);
    }
  } else {
    o.overCount = 0;
    // courant mesuré alors que la prise est coupée : câblage à vérifier
    if (!rel_.isOn(k) && p > 5.0f && now - rel_.lastChange(k) > 5000 &&
        warnLimited(WK_CURRENT_OFF + k, 120000, now)) {
      note(LG_WARN, "Prise %d : %.0f W mesurés alors que le relais est ouvert. Vérifiez le câblage (tore sur le bon fil ?).",
           k + 1, p);
    }
  }
  if (r.alarm && warnLimited(WK_ALARM + k, 60000, now)) {
    note(LG_WARN, "Prise %d : le capteur signale le dépassement de son seuil d'alarme (%u W)", k + 1,
         (unsigned)oc.pzemAlarm);
  }
  if ((u < 190 || u > 255) && warnLimited(WK_VOLTAGE + k, 300000, now)) {
    note(LG_WARN, "Prise %d : tension anormale %.1f V", k + 1, u);
  }
}

void KitCore::onEnv(float temp, float hum, float lum, bool motion, double now) {
  env.temp = cfg_.dhtOn ? temp : NAN;
  env.hum = cfg_.dhtOn ? hum : NAN;
  env.lum = cfg_.ldrOn ? lum : NAN;
  if (cfg_.pirOn) {
    env.motion = motion;
    if (motion) env.lastMotion = now;
  } else {
    env.motion = false;
  }
}

// ------------------------------------------------------------------ tics
void KitCore::tick100(double now) {
  now_ = now;
  rel_.tick(now);
  env.pres = cfg_.pirOn && (now - env.lastMotion) < cfg_.presenceS * 1000.0;
  if (machine.status() == vm::VM_RUNNING) machine.tick(now);
  int st = machine.status();
  if (st != lastStatus_) {
    if (st == vm::VM_FINISHED) note(LG_OK, "Programme « %s » terminé", machine.program().name.c_str());
    else if (st == vm::VM_ERROR) note(LG_ALERT, "Erreur dans le programme : %s", machine.error().c_str());
    lastStatus_ = st;
  }
}

void KitCore::rollover(long day) {
  for (int i = 6; i > 0; i--) days_[i] = days_[i - 1];
  days_[0] = today();
  if (dayCount_ < 7) dayCount_++;
  for (int k = 0; k < NOUT; k++) {
    out[k].eTodayWh = 0;
    out[k].costToday = 0;
  }
  peakToday_ = 0;
  rel_.resetSwitchCounters();
  dayKey_ = day;
  note(LG_INFO, "Nouvelle journée : compteurs du jour remis à zéro");
}

void KitCore::tick1s(double now) {
  // délestage abandonné par le programme : les prises redeviennent pilotables
  if (now - lastShedCall_ > SHED_ABANDON_MS)
    for (int k = 0; k < NOUT; k++) out[k].shed = false;
  double dt = lastSec_ < 0 ? 1.0 : (now - lastSec_) / 1000.0;
  if (dt > 5) dt = 5;
  if (dt < 0) dt = 0;
  lastSec_ = now;
  int h, m, s, wd;
  long day;
  if (localTime(h, m, s, wd, day)) {
    if (dayKey_ < 0) dayKey_ = day;
    else if (day != dayKey_) rollover(day);
  }
  double price = priceNow();
  double tot = 0;
  ai::Sample smp;
  memset(&smp, 0, sizeof smp);
  smp.t = clockValid_ ? (uint32_t)epoch_ : (uint32_t)(now / 1000.0);
  for (int k = 0; k < NOUT; k++) {
    OutletLive& o = out[k];
    bool valid = o.online && !isnan(o.p);
    double p = valid ? o.p : 0;
    double wh = p * dt / 3600.0;
    o.eTodayWh += wh;
    o.costToday += wh / 1000.0 * price;
    tot += p;
    smp.p[k] = (float)p;
    if (rel_.isOn(k) && valid && o.p <= cfg_.out[k].standbyW) o.idleS += dt;
    else o.idleS = 0;
    if (valid) anom[k].update(o.p, cfg_.anomalyZ);
    double nd = NAN;
    o.appliance = valid ? knn.classify(o.p, o.pf, cfg_.knnK, cfg_.knnMaxDist, &nd) : 0;
    o.applianceDist = (float)nd;
  }
  if (tot > peakToday_) peakToday_ = tot;
  smp.temp = env.temp;
  smp.hum = env.hum;
  smp.lum = env.lum;
  smp.pres = env.pres ? 1 : 0;
  smp.relays = rel_.mask();
  hist.push(smp);
  holt.addSecond(tot);
  safetyTotal(now);
}

void KitCore::safetyTotal(double now) {
  if (now < safetyHold_) return;
  // relais ouvert = aucun courant : on ignore la dernière mesure, peut-être antérieure à la coupure
  double tot = 0;
  for (int k = 0; k < NOUT; k++)
    if (out[k].online && rel_.isOn(k) && !isnan(out[k].rawP)) tot += out[k].rawP;
  if (tot <= cfg_.maxTotalW) return;
  int best = -1;
  for (int k = 0; k < NOUT; k++) {
    if (!rel_.isOn(k) || rel_.isLatched(k)) continue;
    // une prise allumée depuis moins d'une période de mesure n'est pas encore mesurée : elle reste candidate
    bool fresh = now - rel_.lastChange(k) < cfg_.sampleMs + 1000;
    if (!(out[k].rawP > 1) && !fresh) continue;
    if (best < 0 || cfg_.out[k].priority > cfg_.out[best].priority ||
        (cfg_.out[k].priority == cfg_.out[best].priority && k > best))
      best = k;
  }
  if (best < 0) return;
  rel_.request(best, false, Relays::SRC_SAFETY, now);
  out[best].shed = false;
  safetyHold_ = now + 5000;
  note(LG_ALERT, "Sécurité : puissance totale %.0f W > limite %.0f W. Prise %d (%s) coupée.", tot, cfg_.maxTotalW,
       best + 1, cfg_.out[best].name);
  if (cfg_.buzzerOn) io_.beep(2);
}

// ------------------------------------------------------------------ délestage
void KitCore::shedStep(double lim, double now) {
  if (!(lim > 0)) return;
  lastShedCall_ = now;
  if (now < shedHold_) return;
  // puissance "effective" : les prises délestées comptent pour 0 (même si la coupure est en attente)
  double tot = 0;
  for (int k = 0; k < NOUT; k++) {
    if (out[k].shed || !rel_.isOn(k)) continue;
    if (out[k].online && !isnan(out[k].p)) tot += out[k].p;
  }
  if (tot > lim) {
    int best = -1;
    for (int k = 0; k < NOUT; k++) {
      if (!rel_.isOn(k) || rel_.isLatched(k) || out[k].shed) continue;
      if (!(out[k].p > 1)) continue;
      if (best < 0 || cfg_.out[k].priority > cfg_.out[best].priority ||
          (cfg_.out[k].priority == cfg_.out[best].priority && k > best))
        best = k;
    }
    if (best < 0) return;
    OutletLive& o = out[best];
    o.shedP = o.p;
    o.shed = true;
    // remise en service récente qui échoue : on attend plus longtemps avant le prochain essai
    o.retryMs = now - o.restoredAt < 60000 ? std::min(o.retryMs * 2, SHED_RETRY_MAX_MS) : SHED_RETRY_MS;
    o.shedAt = now;
    rel_.request(best, false, Relays::SRC_SHED, now);
    shedHold_ = now + 5000;
    note(LG_INFO, "Délestage : P = %.0f W > %.0f W, prise %d (%s, priorité %d) coupée", tot, lim, best + 1,
         cfg_.out[best].name, cfg_.out[best].priority);
  } else {
    int best = -1;
    for (int k = 0; k < NOUT; k++) {
      if (!out[k].shed) continue;
      if (best < 0 || cfg_.out[k].priority < cfg_.out[best].priority ||
          (cfg_.out[k].priority == cfg_.out[best].priority && k < best))
        best = k;
    }
    if (best < 0) return;
    OutletLive& o = out[best];
    bool margin = tot + o.shedP < 0.9 * lim;
    if (margin || (now - o.shedAt >= o.retryMs && tot < 0.7 * lim)) {
      o.shed = false;
      o.restoredAt = now;
      rel_.request(best, true, Relays::SRC_SHED, now);
      shedHold_ = now + 5000;
      note(LG_INFO, "Délestage : %s, prise %d (%s) rallumée", margin ? "marge suffisante" : "nouvel essai", best + 1,
           cfg_.out[best].name);
    }
  }
}

// ------------------------------------------------------------------ commandes
Relays::Result KitCore::userRelay(int k, bool on, Relays::Source src, double now) {
  if (k < 0 || k >= NOUT) return Relays::RL_INVALID;
  if (!cfg_.out[k].enabled) return Relays::RL_INVALID;
  out[k].shed = false;
  return rel_.request(k, on, src, now);
}

bool KitCore::rearm(int k) {
  if (!rel_.rearm(k)) return false;
  out[k].latchReason[0] = 0;
  note(LG_OK, "Prise %d (%s) réarmée", k + 1, cfg_.out[k].name);
  return true;
}

bool KitCore::loadProgram(const vm::Program& p, std::string& err) {
  machine.stop();
  lastStatus_ = machine.status();
  if (!machine.load(p, err)) return false;
  lastStatus_ = machine.status();
  return true;
}

void KitCore::startProgram(double now, uint32_t seed) {
  if (!machine.loaded()) return;
  for (int k = 0; k < NOUT; k++) out[k].shed = false;
  shedHold_ = 0;
  lastShedCall_ = -1e12;
  machine.start(now, seed);
  programRuns++;
  lastStatus_ = machine.status();
  note(LG_OK, "Programme « %s » démarré", machine.program().name.c_str());
}

void KitCore::stopProgram() {
  if (machine.status() == vm::VM_RUNNING) {
    machine.stop();
    note(LG_INFO, "Programme « %s » arrêté", machine.program().name.c_str());
  }
  lastStatus_ = machine.status();
}

bool KitCore::knnTrain(int k, const char* label, std::string& msg) {
  if (k < 0 || k >= NOUT) { msg = "prise invalide"; return false; }
  OutletLive& o = out[k];
  if (!o.online || o.n5 < 3) { msg = "mesures insuffisantes : attendez quelques secondes"; return false; }
  double sp = 0, spf = 0;
  for (int i = 0; i < o.n5; i++) {
    sp += o.p5[i];
    spf += o.pf5[i];
  }
  double p = sp / o.n5, pf = spf / o.n5;
  if (p < 1.0) { msg = "aucun appareil ne consomme sur cette prise (P < 1 W)"; return false; }
  if (!label || !label[0]) { msg = "nom d'appareil vide"; return false; }
  int id = knn.labelId(label, true);
  if (id < 0) { msg = "trop d'appareils différents (16 max)"; return false; }
  if ((int)knn.samples.size() >= ai::Knn::MAX_SAMPLES) {
    size_t victim = 0;
    for (size_t i = 0; i < knn.samples.size(); i++)
      if (knn.samples[i].label == id) { victim = i; break; }
    knn.samples.erase(knn.samples.begin() + victim);
  }
  knn.samples.push_back({id, (float)p, (float)pf});
  char b[96];
  snprintf(b, sizeof b, "exemple appris : %.1f W, FP %.2f", p, pf);
  msg = b;
  note(LG_OK, "IA : « %s » appris sur la prise %d (%.1f W, FP %.2f)", label, k + 1, p, pf);
  return true;
}

void KitCore::restoreDay(const DaySummary& d) {
  dayKey_ = d.dayKey;
  for (int k = 0; k < NOUT; k++) {
    out[k].eTodayWh = d.eWh[k];
    out[k].costToday = d.cost[k];
  }
  peakToday_ = d.peak;
}

void KitCore::restoreHistory(const DaySummary* arr, int n) {
  dayCount_ = 0;
  for (int i = 0; i < n && i < 7; i++) {
    if (arr[i].dayKey < 0) break;
    days_[i] = arr[i];
    dayCount_++;
  }
}

DaySummary KitCore::today() const {
  DaySummary d;
  d.dayKey = dayKey_;
  for (int k = 0; k < NOUT; k++) {
    d.eWh[k] = (float)out[k].eTodayWh;
    d.cost[k] = (float)out[k].costToday;
  }
  d.peak = (float)peakToday_;
  return d;
}

// ------------------------------------------------------------------ agrégats
double KitCore::totalP() const {
  double t = 0;
  for (int k = 0; k < NOUT; k++)
    if (out[k].online && !isnan(out[k].p)) t += out[k].p;
  return t;
}
double KitCore::totalEToday() const {
  double t = 0;
  for (int k = 0; k < NOUT; k++) t += out[k].eTodayWh;
  return t;
}
double KitCore::totalCostToday() const {
  double t = 0;
  for (int k = 0; k < NOUT; k++) t += out[k].costToday;
  return t;
}
double KitCore::avgVoltage() const {
  double s = 0;
  int n = 0;
  for (int k = 0; k < NOUT; k++)
    if (out[k].online && !isnan(out[k].u)) { s += out[k].u; n++; }
  return n ? s / n : NAN;
}
bool KitCore::offPeakNow() const {
  int h, m, s, wd;
  long d;
  if (!localTime(h, m, s, wd, d)) return false;
  return isOffPeak(cfg_, h * 60 + m);
}
double KitCore::priceNow() const {
  int h, m, s, wd;
  long d;
  bool v = localTime(h, m, s, wd, d);
  return priceAt(cfg_, v ? h * 60 + m : 0, v);
}
int KitCore::relaysOn() const {
  int n = 0;
  for (int k = 0; k < NOUT; k++)
    if (rel_.isOn(k)) n++;
  return n;
}
bool KitCore::pzemAlarmAny() const {
  for (int k = 0; k < NOUT; k++)
    if (out[k].alarm) return true;
  return false;
}

// ------------------------------------------------------------------ vm::Hal
double KitCore::sensor(int q, int k) {
  if (k < 1 || k > NOUT) {
    if (warnLimited(WK_BADOUTLET, 30000, now_)) note(LG_WARN, "Programme : la prise %d n'existe pas (1 à 4)", k);
    return NAN;
  }
  const OutletLive& o = out[k - 1];
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
    case 10: return rel_.isOn(k - 1) ? 1 : 0;
    case 11: return o.online ? 1 : 0;
    case 12: return rel_.isLatched(k - 1) ? 1 : 0;
    case 13: return o.phi;
    case 14: return rel_.switches(k - 1);
  }
  return NAN;
}

double KitCore::gsensor(int q) {
  int h = 0, m = 0, s = 0, wd = 0;
  long d = 0;
  bool tv = localTime(h, m, s, wd, d);
  if (q >= 7 && q <= 11 && !tv) {
    if (warnLimited(WK_CLOCK, 60000, now_))
      note(LG_WARN, "Programme : l'horloge du kit n'est pas réglée (ouvrez l'application pour la synchroniser)");
    return NAN;
  }
  switch (q) {
    case 0: return totalP();
    case 1: return totalEToday();
    case 2: return totalCostToday();
    case 3: return env.temp;
    case 4: return env.hum;
    case 5: return env.lum;
    case 6: return cfg_.pirOn ? (env.pres ? 1 : 0) : NAN;
    case 7: return h;
    case 8: return m;
    case 9: return s;
    case 10: return wd;
    case 11: return h * 60 + m;
    case 12: return machine.status() == vm::VM_RUNNING ? (now_ - machine.startedAt()) / 1000.0 : 0;
    case 13: return offPeakNow() ? 1 : 0;
    case 14: return priceNow();
    case 15: return avgVoltage();
    case 16: return peakToday_;
    case 17: return co2Today();
    case 18: return relaysOn();
  }
  return NAN;
}

double KitCore::param(int p, int idx) { return paramGet(cfg_, p, idx); }

void KitCore::setParam(int p, int idx, double v) {
  if (!(cfg_.perms & PERM_PARAMS)) {
    if (warnLimited(WK_PARAMS, 30000, now_))
      note(LG_WARN, "Programme : la modification des paramètres est verrouillée par l'enseignant");
    return;
  }
  double before = paramGet(cfg_, p, idx);
  double applied = 0;
  std::string msg;
  if (!paramSet(cfg_, p, idx, v, applied, msg)) {
    if (warnLimited(WK_PARAMMSG, 10000, now_)) note(LG_WARN, "Programme : %s", msg.c_str());
    return;
  }
  double after = paramGet(cfg_, p, idx);
  if (!msg.empty() && warnLimited(WK_PARAMMSG, 10000, now_))
    note(LG_WARN, "Paramètre « %s » : %s", paramName(p), msg.c_str());
  if (after == before) return;
  if (paramIsOutlet(p)) note(LG_INFO, "Paramètre « %s » de la prise %d : %g → %g", paramName(p), idx, before, after);
  else note(LG_INFO, "Paramètre « %s » : %g → %g", paramName(p), before, after);
  if (p == 4) applyOutletConfig();
  if (p == 1) io_.pzemSetAlarm(idx - 1, (uint16_t)after);
  io_.configChanged(p == 1 ? (CHG_OUTLET | CHG_ALARM) : (paramIsOutlet(p) ? CHG_OUTLET : CHG_OTHER));
}

void KitCore::relay(int k, bool on) {
  if (k == 0) {
    for (int j = 1; j <= NOUT; j++) relay(j, on);
    return;
  }
  if (k < 1 || k > NOUT) {
    if (warnLimited(WK_BADOUTLET, 30000, now_)) note(LG_WARN, "Programme : la prise %d n'existe pas (1 à 4)", k);
    return;
  }
  if (!cfg_.out[k - 1].enabled) {
    if (warnLimited(WK_DISABLED + k - 1, 60000, now_)) note(LG_WARN, "Programme : la prise %d est désactivée", k);
    return;
  }
  if (out[k - 1].shed) {
    if (on) return;  // prise délestée : c'est le délestage qui la rallumera quand la puissance le permettra
    out[k - 1].shed = false;
  }
  Relays::Result r = rel_.request(k - 1, on, Relays::SRC_PROGRAM, now_);
  if (r == Relays::RL_LATCHED && warnLimited(WK_LATCHED + k - 1, 30000, now_))
    note(LG_WARN, "Prise %d verrouillée par une protection : réarmez-la avant de la rallumer", k);
  else if (r == Relays::RL_DELAYED && warnLimited(WK_DELAY + k - 1, 30000, now_))
    note(LG_INFO, "Prise %d : commutation retardée (délai minimum %.1f s entre deux commutations)", k,
         cfg_.out[k - 1].minSwitchS);
}

void KitCore::toggle(int k) {
  if (k < 1 || k > NOUT) {
    relay(k, true);  // produit l'avertissement
    return;
  }
  relay(k, !rel_.isOn(k - 1));
}

void KitCore::pulse(int k, double seconds) {
  if (k < 1 || k > NOUT || !cfg_.out[k - 1].enabled) {
    relay(k, true);
    return;
  }
  out[k - 1].shed = false;
  if (rel_.isLatched(k - 1)) {
    relay(k, true);
    return;
  }
  rel_.pulse(k - 1, seconds, Relays::SRC_PROGRAM, now_);
}

void KitCore::beep(int kind) {
  if (cfg_.buzzerOn) io_.beep(kind);
}

void KitCore::alert(const char* msg) {
  note(LG_ALERT, "%s", msg);
  io_.alertScreen(msg);
  if (cfg_.buzzerOn) io_.beep(0);
}

void KitCore::log(const char* msg, double value, bool hasValue) {
  if (hasValue) {
    if (isnan(value)) note(LG_PROG, "%s --", msg);
    else note(LG_PROG, "%s %.6g", msg, value);
  } else {
    note(LG_PROG, "%s", msg);
  }
}

void KitCore::screen(const char* msg) { io_.screenMessage(msg); }

void KitCore::resetEnergy(int k) {
  if (!(cfg_.perms & PERM_RESET_ENERGY)) {
    if (warnLimited(WK_RESET, 30000, now_))
      note(LG_WARN, "Programme : la remise à zéro des compteurs est réservée à l'enseignant");
    return;
  }
  if (k < 1 || k > NOUT) return;
  io_.pzemResetEnergy(k - 1);
  note(LG_INFO, "Compteur d'énergie de la prise %d remis à zéro", k);
}

double KitCore::ai(int q, double a, double b) {
  switch (q) {
    case 0: {
      int k = vmIdx(a);
      if (k < 1 || k > NOUT) return NAN;
      return hist.avgP(k - 1, clampRound(b, 1, 600));
    }
    case 1: return hist.avgTotal(clampRound(a, 1, 600));
    case 2: return hist.maxTotal(clampRound(a, 1, 600));
    case 3: return hist.slopeTotalPerMin(clampRound(a, 10, 600));
    case 4: return holt.forecast(a);
    case 5: case 6: case 7: {
      int k = vmIdx(a);
      if (k < 1 || k > NOUT) return NAN;
      if (q == 5) return anom[k - 1].flag() ? 1 : 0;
      if (q == 6) return out[k - 1].idleS;
      return out[k - 1].appliance;
    }
  }
  return NAN;
}

void KitCore::shed(double limit) { shedStep(limit, now_); }

bool KitCore::clock(int& hour, int& minute, long& dayKey) {
  int s, wd;
  return localTime(hour, minute, s, wd, dayKey);
}

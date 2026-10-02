// Tests natifs (PC) des modules indépendants du matériel : PZEM, VM, IA.
// Compilation : make -C tests/native
#include <math.h>
#include <stdio.h>
#include <string.h>

#include <deque>
#include <map>
#include <string>
#include <vector>

#include "../../firmware/src/ai.h"
#include "../../firmware/src/pzem.h"
#include "../../firmware/src/vm.h"

static int g_fail = 0, g_pass = 0;
#define CHECK(c)                                                         \
  do {                                                                   \
    if (c) g_pass++;                                                     \
    else {                                                               \
      g_fail++;                                                          \
      printf("  ECHEC %s:%d : %s\n", __FILE__, __LINE__, #c);            \
    }                                                                    \
  } while (0)
#define NEAR(a, b, eps) CHECK(fabs((double)(a) - (double)(b)) <= (eps))

// ---------------------------------------------------------------- PZEM
struct FakeDevice {
  uint8_t addr;
  uint16_t alarm = 2300;
  uint32_t energy = 1234;
  uint16_t volt10 = 2301;
  uint32_t cur_mA = 452;
  uint32_t pow10 = 1012;
  uint16_t freq10 = 500;
  uint16_t pf100 = 97;
  bool alarmOn = false;
};

class FakeBus : public pzem::ByteStream {
 public:
  std::vector<FakeDevice> devs;
  std::deque<uint8_t> rx;
  std::vector<uint8_t> lastTx;
  uint32_t t = 0;
  bool garbageBefore = false;
  bool corruptCrc = false;
  size_t write(const uint8_t* d, size_t n) override {
    lastTx.assign(d, d + n);
    if (garbageBefore) { rx.push_back(0x55); }
    respond(d, n);
    return n;
  }
  int available() override { return (int)rx.size(); }
  int read() override {
    if (rx.empty()) return -1;
    int v = rx.front();
    rx.pop_front();
    return v;
  }
  void flushTx() override {}
  uint32_t millis() override { return t; }
  void delayMs(uint32_t ms) override { t += ms; }

  void put(std::vector<uint8_t> f) {
    pzem::appendCrc(f.data(), f.size() - 2);
    if (corruptCrc) f[f.size() - 1] ^= 0xFF;
    for (auto b : f) rx.push_back(b);
  }
  FakeDevice* find(uint8_t a) {
    if (a == pzem::ADDR_GENERAL) return devs.size() == 1 ? &devs[0] : nullptr;
    for (auto& d : devs)
      if (d.addr == a) return &d;
    return nullptr;
  }
  void respond(const uint8_t* q, size_t n) {
    if (!pzem::checkCrc(q, n)) return;
    FakeDevice* d = find(q[0]);
    if (!d) return;
    uint8_t a = d->addr;
    if (q[1] == 0x04 && n == 8) {
      std::vector<uint8_t> f = {a, 0x04, 20};
      auto w16 = [&](uint16_t v) { f.push_back(v >> 8); f.push_back(v & 0xFF); };
      w16(d->volt10);
      w16(d->cur_mA & 0xFFFF); w16(d->cur_mA >> 16);
      w16(d->pow10 & 0xFFFF); w16(d->pow10 >> 16);
      w16(d->energy & 0xFFFF); w16(d->energy >> 16);
      w16(d->freq10); w16(d->pf100); w16(d->alarmOn ? 0xFFFF : 0);
      f.push_back(0); f.push_back(0);
      put(f);
    } else if (q[1] == 0x03 && n == 8) {
      uint16_t reg = (q[2] << 8) | q[3];
      uint16_t v = reg == 1 ? d->alarm : (reg == 2 ? d->addr : 0);
      if (reg != 1 && reg != 2) { put({a, 0x83, 0x02, 0, 0}); return; }
      put({a, 0x03, 2, (uint8_t)(v >> 8), (uint8_t)(v & 0xFF), 0, 0});
    } else if (q[1] == 0x06 && n == 8) {
      uint16_t reg = (q[2] << 8) | q[3];
      uint16_t v = (q[4] << 8) | q[5];
      if (reg == 1) d->alarm = v;
      else if (reg == 2) d->addr = (uint8_t)v;
      else { put({a, 0x86, 0x02, 0, 0}); return; }
      std::vector<uint8_t> f(q, q + 6);
      f[0] = a;
      f.push_back(0); f.push_back(0);
      put(f);
    } else if (q[1] == 0x42 && n == 4) {
      d->energy = 0;
      put({a, 0x42, 0, 0});
    }
  }
};

static void testPzem() {
  printf("[pzem]\n");
  // CRC Modbus : vecteur connu (lecture 10 registres d'entrée à l'adresse 1)
  uint8_t req[8];
  pzem::buildReadInput(0x01, req);
  uint8_t expect[8] = {0x01, 0x04, 0x00, 0x00, 0x00, 0x0A, 0x70, 0x0D};
  CHECK(memcmp(req, expect, 8) == 0);
  uint8_t rst[4];
  pzem::buildResetEnergy(0x01, rst);
  CHECK(rst[0] == 0x01 && rst[1] == 0x42 && rst[2] == 0x80 && rst[3] == 0x11);

  FakeBus bus;
  FakeDevice d1; d1.addr = 1;
  FakeDevice d2; d2.addr = 2; d2.cur_mA = 70000; d2.pow10 = 161000; d2.alarmOn = true;
  bus.devs = {d1, d2};
  pzem::Bus b(&bus);
  pzem::Values v;
  CHECK(b.readValues(1, v));
  NEAR(v.voltage, 230.1, 1e-3);
  NEAR(v.current, 0.452, 1e-6);
  NEAR(v.power, 101.2, 1e-3);
  NEAR(v.energyWh, 1234, 1e-6);
  NEAR(v.frequency, 50.0, 1e-4);
  NEAR(v.pf, 0.97, 1e-6);
  CHECK(!v.alarm);
  CHECK(b.readValues(2, v));
  NEAR(v.current, 70.0, 1e-3);  // mot de poids fort utilisé
  NEAR(v.power, 16100.0, 1e-2);
  CHECK(v.alarm);
  // module absent -> délai dépassé
  CHECK(!b.readValues(3, v));
  CHECK(b.lastError() == pzem::ERR_TIMEOUT);
  // octet parasite avant la trame : rejet (trame décalée)
  bus.garbageBefore = true;
  CHECK(!b.readValues(1, v));
  bus.garbageBefore = false;
  CHECK(b.readValues(1, v));
  // CRC corrompu
  bus.corruptCrc = true;
  CHECK(!b.readValues(1, v));
  CHECK(b.lastError() == pzem::ERR_CRC);
  bus.corruptCrc = false;
  // seuil d'alarme
  CHECK(b.setAlarmThreshold(1, 1500));
  uint16_t w = 0;
  CHECK(b.readAlarmThreshold(1, w) && w == 1500);
  // remise à zéro énergie
  CHECK(b.resetEnergy(2));
  CHECK(b.readValues(2, v) && v.energyWh == 0);
  // changement d'adresse par l'adresse générale : refusé si plusieurs modules
  CHECK(!b.setAddress(pzem::ADDR_GENERAL, 4));
  bus.devs = {d1};
  CHECK(b.setAddress(pzem::ADDR_GENERAL, 4));
  uint8_t a = 0;
  CHECK(b.readAddress(4, a) && a == 4);
  CHECK(b.readValues(4, v));
  CHECK(!b.setAddress(4, 0));      // adresse hors limites
  CHECK(!b.setAddress(4, 0xF8));
}

// ---------------------------------------------------------------- VM
struct MockHal : vm::Hal {
  std::map<int, double> sens;  // (q*10+outlet)
  std::map<int, double> gs;
  std::map<int, double> params;
  std::vector<std::string> actions;
  double now = 0;
  int hour = 7, minute = 29;
  long day = 100;
  bool clockOk = true;
  void act(const char* fmt, double a = 0, double b = 0) {
    char buf[128];
    snprintf(buf, sizeof buf, fmt, a, b);
    actions.push_back(buf);
  }
  double sensor(int q, int o) override {
    auto it = sens.find(q * 10 + o);
    return it == sens.end() ? NAN : it->second;
  }
  double gsensor(int q) override {
    auto it = gs.find(q);
    return it == gs.end() ? 0 : it->second;
  }
  double param(int p, int idx) override {
    auto it = params.find(p * 10 + idx);
    return it == params.end() ? 0 : it->second;
  }
  void setParam(int p, int idx, double v) override {
    params[p * 10 + idx] = v;
    act("param %g=%g", p * 10 + idx, v);
  }
  void relay(int o, bool on) override { act("relay %g %g", o, on ? 1 : 0); }
  void toggle(int o) override { act("toggle %g", o); }
  void pulse(int o, double s) override { act("pulse %g %g", o, s); }
  void beep(int k) override { act("beep %g", k); }
  void alert(const char* m) override { actions.push_back(std::string("alert ") + m); }
  void log(const char* m, double v, bool hv) override {
    char buf[128];
    if (hv) snprintf(buf, sizeof buf, "log %s %g", m, v);
    else snprintf(buf, sizeof buf, "log %s", m);
    actions.push_back(buf);
  }
  void screen(const char* m) override { actions.push_back(std::string("screen ") + m); }
  void resetEnergy(int o) override { act("reset %g", o); }
  double ai(int q, double a, double b) override { return q * 1000 + a + b / 10; }
  void shed(double l) override { act("shed %g", l); }
  bool clock(int& h, int& m, long& d) override {
    h = hour;
    m = minute;
    d = day;
    return clockOk;
  }
};

static vm::Program prog(const char* code, std::vector<vm::ScriptDef> scripts, int nvars = 2,
                        std::vector<std::string> strs = {"msg"}) {
  vm::Program p;
  std::string err;
  bool ok = vm::parseCode(code, p.code, err);
  if (!ok) printf("parse err %s\n", err.c_str());
  p.scripts = scripts;
  for (int i = 0; i < nvars; i++) p.vars.push_back("v" + std::to_string(i));
  p.strs = strs;
  return p;
}

static vm::ScriptDef sd(int type, int entry, double period = 1, int cond = -1, int h = 0, int m = 0, int btn = 1) {
  vm::ScriptDef d;
  d.type = type; d.entry = entry; d.period = period; d.cond = cond; d.h = h; d.m = m; d.btn = btn;
  return d;
}

static void testVm() {
  printf("[vm]\n");
  std::string err;
  // 1) start : allumer prise 1, attendre 2 s, éteindre ; fin
  {
    MockHal h;
    vm::Machine m(&h);
    // PUSH 1 PUSH 1 RELAY PUSH 2 WAIT PUSH 1 PUSH 0 RELAY END
    auto p = prog("1 1 1 1 34 1 2 7 1 1 1 0 34 0", {sd(0, 0)});
    CHECK(m.load(p, err));
    m.start(0, 1);
    m.tick(0);
    CHECK(h.actions.size() == 1 && h.actions[0] == "relay 1 1");
    m.tick(1000);
    CHECK(h.actions.size() == 1);
    m.tick(1900);
    CHECK(h.actions.size() == 1);
    m.tick(2000);
    CHECK(h.actions.size() == 2 && h.actions[1] == "relay 1 0");
    CHECK(m.status() == vm::VM_FINISHED);
  }
  // 2) boucle "répéter 3 fois" avec variable : v0 += 2
  {
    MockHal h;
    vm::Machine m(&h);
    // v1 = 3 ; loop: LOAD1 PUSH0 GT JZ end ; LOAD0 PUSH2 ADD STORE0 ; LOAD1 PUSH1 SUB STORE1 ; YIELD JMP loop ; end: LOGV END
    const char* code =
        "1 3 3 1 "                // 0: PUSH 3 STORE 1
        "2 1 1 0 18 5 31 "        // 4: LOAD1 PUSH0 GT JZ 31
        "2 0 1 2 10 3 0 "         // 11: LOAD0 PUSH2 ADD STORE0
        "2 1 1 1 11 3 1 "         // 18: LOAD1 PUSH1 SUB STORE1
        "8 4 4 "                  // 25: YIELD JMP 4
        "0 "                      // 28: END (non atteint)
        "0 0 "                    // 29,30 : padding END END
        "2 0 40 0 0";             // 31: LOAD0 LOGV 0 END
    auto p = prog(code, {sd(0, 0)});
    bool ok = m.load(p, err);
    if (!ok) printf("  err=%s\n", err.c_str());
    CHECK(ok);
    m.start(0, 1);
    m.tick(0);
    CHECK(h.actions.size() == 1 && h.actions[0] == "log msg 6");
    CHECK(m.var(0) == 6);
  }
  // 3) script "toutes les 5 s" et condition
  {
    MockHal h;
    vm::Machine m(&h);
    // every 5s: SENSG 0 ; LOGV 0 ; END     cond script: SENSG 0 PUSH 100 GT END ; body: BEEP 2 END
    const char* code = "31 0 40 0 0 "     // 0
                       "31 0 1 100 18 0 "  // 5: cond
                       "37 2 0";           // 11: body
    auto p = prog(code, {sd(1, 0, 5), sd(2, 11, 1, 5)});
    CHECK(m.load(p, err));
    m.start(0, 1);
    h.gs[0] = 50;
    m.tick(0);
    CHECK(h.actions.size() == 1);
    m.tick(100);
    m.tick(4900);
    CHECK(h.actions.size() == 1);
    h.gs[0] = 150;
    m.tick(5000);  // déclenchement périodique + front montant
    CHECK(h.actions.size() == 3);
    CHECK(h.actions[1] == "log msg 150" && h.actions[2] == "beep 2");
    m.tick(5100);  // condition toujours vraie : pas de nouveau front
    CHECK(h.actions.size() == 3);
    h.gs[0] = 20;
    m.tick(5200);
    h.gs[0] = 120;
    m.tick(5300);
    CHECK(h.actions.size() == 4 && h.actions[3] == "beep 2");
    CHECK(m.status() == vm::VM_RUNNING);
  }
  // 4) boucle infinie sans attente : rend la main (YIELD) sans erreur
  {
    MockHal h;
    vm::Machine m(&h);
    const char* code = "2 0 1 1 10 3 0 8 4 0 0";  // loop: v0 += 1 ; YIELD ; JMP 0
    auto p = prog(code, {sd(0, 0)});
    CHECK(m.load(p, err));
    m.start(0, 1);
    m.tick(0);
    CHECK(m.status() == vm::VM_RUNNING);
    double v1 = m.var(0);
    CHECK(v1 > 10 && v1 < 400);
    m.tick(100);
    CHECK(m.var(0) > v1);
  }
  // 5) erreurs : pile vide, condition avec action
  {
    MockHal h;
    vm::Machine m(&h);
    auto p = prog("10 0", {sd(0, 0)});
    CHECK(m.load(p, err));
    m.start(0, 1);
    m.tick(0);
    CHECK(m.status() == vm::VM_ERROR);
    CHECK(m.error() == "pile vide");
    vm::Machine m2(&h);
    auto p2 = prog("37 0 0 1 1 0", {sd(2, 2, 1, 0)});  // cond = BEEP (interdit)
    CHECK(m2.load(p2, err));
    m2.start(0, 1);
    m2.tick(0);
    CHECK(m2.status() == vm::VM_ERROR);
  }
  // 6) validation
  {
    vm::Program p = prog("4 3 0", {sd(0, 0)});  // saut au milieu
    CHECK(!vm::validate(p, err));
    vm::Program p2 = prog("2 5 0", {sd(0, 0)}, 2);  // variable inexistante
    CHECK(!vm::validate(p2, err));
    vm::Program p3 = prog("0", {});
    CHECK(!vm::validate(p3, err));
    std::vector<double> c;
    CHECK(!vm::parseCode("1 abc", c, err));
    CHECK(vm::parseCode("1 0.1 -2.5e3", c, err) && c.size() == 3 && c[2] == -2500);
  }
  // 7) script horaire et bouton
  {
    MockHal h;
    vm::Machine m(&h);
    const char* code = "37 0 0 37 1 0";
    auto p = prog(code, {sd(3, 0, 1, -1, 7, 30), sd(4, 3, 1, -1, 0, 0, 2)});
    CHECK(m.load(p, err));
    m.start(0, 1);
    m.tick(0);
    CHECK(h.actions.empty());
    h.minute = 30;
    m.tick(100);
    CHECK(h.actions.size() == 1);
    m.tick(200);  // même minute, même jour : pas de second déclenchement
    CHECK(h.actions.size() == 1);
    m.pressButton(1);
    m.tick(300);
    CHECK(h.actions.size() == 1);
    m.pressButton(2);
    m.tick(400);
    CHECK(h.actions.size() == 2 && h.actions[1] == "beep 1");
    h.day = 101;
    m.tick(500);
    CHECK(h.actions.size() == 3);
  }
  // 8) arithmétique et sémantique des NaN / division par zéro / modulo / arrondi
  {
    MockHal h;
    vm::Machine m(&h);
    // v0 = 7 / 0 ; v1 = -7 mod 3 ; LOGV (round -2.5) ; capteur absent > 0 ?
    const char* code =
        "1 7 1 0 13 3 0 "       // 0
        "1 -7 1 3 14 3 1 "      // 7
        "1 -2.5 25 1 40 0 "     // 14
        "1 1 30 2 1 0 18 40 0 " // 20: SENS 2 de la prise 1 (absent=NaN) > 0
        "0";
    auto p = prog(code, {sd(0, 0)});
    CHECK(m.load(p, err));
    m.start(0, 1);
    m.tick(0);
    CHECK(m.var(0) == 0);
    CHECK(m.var(1) == 2);
    CHECK(h.actions.size() == 2 && h.actions[0] == "log msg -2" && h.actions[1] == "log msg 0");
  }
  // 9) aléatoire déterministe (même graine -> même suite)
  {
    MockHal h;
    vm::Machine m(&h);
    const char* code = "1 1 1 6 28 40 0 1 1 1 6 28 40 0 1 0 1 1 28 40 0 0";
    auto p = prog(code, {sd(0, 0)});
    CHECK(m.load(p, err));
    m.start(0, 12345);
    m.tick(0);
    CHECK(h.actions.size() == 3);
    // valeurs de référence (identiques à la VM JavaScript)
    printf("  rand: %s | %s | %s\n", h.actions[0].c_str(), h.actions[1].c_str(), h.actions[2].c_str());
  }
}

// ---------------------------------------------------------------- IA
static void testAi() {
  printf("[ai]\n");
  ai::FastHistory hs;
  CHECK(isnan(hs.avgTotal(10)));
  for (int i = 0; i < 700; i++) {
    ai::Sample s{};
    s.t = i;
    s.p[0] = 100;
    s.p[1] = (float)i;  // rampe : +1 W/s
    hs.push(s);
  }
  CHECK(hs.count() == 600);
  NEAR(hs.avgP(0, 30), 100, 1e-9);
  NEAR(hs.avgP(1, 3), 698, 1e-9);
  NEAR(hs.maxTotal(600), 100 + 699, 1e-9);
  NEAR(hs.slopeTotalPerMin(60), 60.0, 1e-6);  // 1 W/s = 60 W/min

  ai::Holt holt;
  CHECK(isnan(holt.forecast(5)));
  for (int i = 0; i < 600; i++) holt.addSecond(1000 + i);  // rampe 1 W/s
  CHECK(holt.ready());
  double f = holt.forecast(10);
  CHECK(f > 1600 && f < 2300);

  ai::Anomaly an;
  for (int i = 0; i < 100; i++) an.update(100 + (i % 2), 4);
  CHECK(!an.flag());
  an.update(400, 4);
  an.update(400, 4);
  CHECK(!an.flag());
  an.update(400, 4);
  CHECK(an.flag());
  for (int i = 0; i < 60; i++) an.update(400, 4);
  CHECK(!an.flag());  // le nouveau régime est appris après 60 s

  ai::Knn knn;
  int kettle = knn.labelId("Bouilloire", true);
  int charger = knn.labelId("Chargeur", true);
  int lamp = knn.labelId("Lampe LED", true);
  CHECK(kettle == 1 && charger == 2 && lamp == 3);
  knn.samples = {{kettle, 1950, 1.0f}, {kettle, 2010, 0.99f}, {charger, 9.5f, 0.55f},
                 {charger, 11, 0.58f}, {lamp, 8.5f, 0.92f}};
  CHECK(knn.classify(0.5, 0, 3, 3) == 0);
  CHECK(knn.classify(1980, 1.0, 1, 3) == kettle);
  CHECK(knn.classify(10, 0.56, 1, 3) == charger);
  CHECK(knn.classify(9, 0.9, 1, 3) == lamp);
  CHECK(knn.classify(300, 0.7, 1, 3) == -1);  // trop loin : inconnu
  CHECK(knn.classify(10, 0.6, 3, 3) == charger);
  knn.removeLabel(charger);
  CHECK(knn.samples.size() == 3);
  CHECK(knn.labelId("Chargeur", false) == -1);
  CHECK(knn.labelId("Ventilateur", true) == 2);  // identifiant réutilisé
}

int main() {
  testPzem();
  testVm();
  testAi();
  printf("\n%d vérifications réussies, %d échecs\n", g_pass, g_fail);
  return g_fail ? 1 : 0;
}

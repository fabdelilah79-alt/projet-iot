// Tests natifs du cœur du kit (KitCore + Relays + Config)
#include <math.h>
#include <stdio.h>
#include <string.h>
#include <string>
#include <vector>
#include "../../firmware/src/kitcore.h"

static int g_fail = 0, g_pass = 0;
#define CHECK(c) do { if (c) g_pass++; else { g_fail++; printf("  ECHEC %s:%d : %s\n", __FILE__, __LINE__, #c); } } while (0)
#define NEAR(a, b, eps) CHECK(fabs((double)(a) - (double)(b)) <= (eps))

struct TestIO : KitIO {
  std::vector<std::string> logs; int beeps = 0; int resets = 0; int alarms = 0; uint32_t chg = 0;
  void beep(int) override { beeps++; }
  void screenMessage(const char*) override {}
  void alertScreen(const char*) override {}
  void pzemResetEnergy(int) override { resets++; }
  void pzemSetAlarm(int, uint16_t) override { alarms++; }
  void configChanged(uint32_t m) override { chg |= m; }
  void onLog(const LogEntry& e) override { logs.push_back(e.msg); }
};
static bool g_pins[4];
static void writePin(int k, bool on) { g_pins[k] = on; }

static RawMeas meas(float p, float pf = 1.0f, float u = 230.0f) {
  RawMeas r; r.ok = true; r.u = u; r.p = p; r.pf = pf; r.f = 50; r.i = (pf > 0 && u > 0) ? p / (u * pf) : 0; r.eWh = 1000; return r;
}

int main() {
  Config cfg; configDefaults(cfg, "TEST");
  Relays rel; rel.begin(writePin);
  TestIO io;
  KitCore kit(cfg, rel, io);
  kit.applyOutletConfig();
  double t = 0;
  printf("[kit]\n");
  // relais : délai minimum
  CHECK(kit.userRelay(0, true, Relays::SRC_USER, t) == Relays::RL_OK);
  CHECK(g_pins[0]);
  CHECK(kit.userRelay(0, false, Relays::SRC_USER, t + 500) == Relays::RL_DELAYED);
  CHECK(g_pins[0]);
  kit.tick100(t + 1000); CHECK(g_pins[0]);
  kit.tick100(t + 2000); CHECK(!g_pins[0]);
  // mesures et grandeurs dérivées
  kit.onMeasurement(1, meas(100, 0.5f), t);
  NEAR(kit.out[1].s, 200, 0.01);
  NEAR(kit.out[1].q, sqrt(200.0*200 - 100.0*100), 0.01);
  NEAR(kit.out[1].phi, 60, 0.01);
  NEAR(kit.out[1].eCounterKWh, 1.0, 1e-9);
  // protection : 2 mesures > max -> verrouillage
  t = 10000;
  kit.userRelay(2, true, Relays::SRC_USER, t);
  cfg.out[2].maxPower = 500;
  kit.onMeasurement(2, meas(600), t);
  CHECK(rel.isOn(2));
  kit.onMeasurement(2, meas(600), t + 1000);
  CHECK(!rel.isOn(2) && rel.isLatched(2));
  CHECK(kit.userRelay(2, true, Relays::SRC_USER, t + 5000) == Relays::RL_LATCHED);
  CHECK(kit.rearm(2));
  CHECK(kit.userRelay(2, true, Relays::SRC_USER, t + 5000) == Relays::RL_OK);
  // mesure très au-dessus du maximum : coupure immédiate
  kit.onMeasurement(2, meas(800), t + 6000);
  CHECK(rel.isLatched(2));
  kit.rearm(2);
  // énergie du jour : 1000 W pendant 3600 s = 1000 Wh
  t = 100000;
  for (int k = 0; k < 4; k++) kit.onMeasurement(k, meas(0), t);
  kit.onMeasurement(0, meas(1000), t);
  kit.tick1s(t);
  double e0 = kit.out[0].eTodayWh;
  for (int s = 1; s <= 3600; s++) kit.tick1s(t + s * 1000.0);
  NEAR(kit.out[0].eTodayWh - e0, 1000, 1e-6);
  NEAR(kit.out[0].costToday, (kit.out[0].eTodayWh) / 1000.0 * (double)1.20f, 1e-9);
  NEAR(kit.peakToday(), 1000, 1e-9);
  // inactivité (veille) : relais allumé, P <= 3 W
  t = 200000;
  kit.userRelay(3, true, Relays::SRC_USER, t);
  kit.onMeasurement(3, meas(2, 0.5f), t);
  for (int s = 0; s < 30; s++) kit.tick1s(t + s * 1000.0);
  NEAR(kit.out[3].idleS, 29, 1e-9);
  // délestage par priorités : priorités par défaut {2,1,4,3}
  t = 300000;
  for (int k = 0; k < 4; k++) { kit.userRelay(k, true, Relays::SRC_USER, t); }
  t += 2500;
  kit.onMeasurement(0, meas(800), t); kit.onMeasurement(1, meas(900), t);
  kit.onMeasurement(2, meas(400), t); kit.onMeasurement(3, meas(300), t);
  kit.shedStep(2000, t + 500);  // total 2400 > 2000 -> prise 3 (priorité 4) coupée
  CHECK(kit.out[2].shed && !rel.isOn(2));
  kit.shedStep(2000, t + 1500);  // retenue de 5 s : rien d'autre n'est coupé
  CHECK(rel.isOn(3) && rel.isOn(0) && rel.isOn(1));
  kit.onMeasurement(2, meas(0), t + 6500);
  kit.shedStep(2000, t + 6500);  // effectif 2000 : pas de surcharge ; 2000 + 400 >= 1800 -> reste délestée
  CHECK(kit.out[2].shed && !rel.isOn(2));
  kit.onMeasurement(1, meas(100), t + 7500);  // la cuisine consomme moins : 800+100+300 = 1200
  kit.shedStep(2000, t + 12500);  // 1200 + 400 < 1800 -> prise 3 rallumée
  CHECK(!kit.out[2].shed && rel.isOn(2));
  // sécurité puissance totale (2300 W)
  t = 400000;
  kit.onMeasurement(2, meas(400), t);
  kit.onMeasurement(1, meas(1500), t);
  kit.tick1s(t);  // 800+1500+400+300 = 3000 > 2300 -> priorité la plus faible coupée (prise 3)
  CHECK(!rel.isOn(2));
  // horloge, jour, rollover
  kit.setClock(true, 1700000000);  // 14/11/2023 22:13:20 UTC -> 23:13:20 à UTC+1
  int h, m, s, wd; long day;
  CHECK(kit.localTime(h, m, s, wd, day));
  CHECK(h == 23 && m == 13 && s == 20 && wd == 2);  // mardi
  kit.tick1s(t + 1000);
  double eBefore = kit.totalEToday();
  CHECK(eBefore > 0);
  kit.setClock(true, 1700000000 + 3600);  // lendemain 00:13
  kit.tick1s(t + 2000);
  CHECK(kit.dayCount() == 1);
  CHECK(kit.totalEToday() < eBefore);
  // programme : paramètre borné et journalisé
  cfg.perms |= PERM_PARAMS;
  kit.setParam(10, 0, 500);  // période de mesure < 1000 -> 1000
  CHECK(cfg.sampleMs == 1000);
  kit.setParam(2, 1, 9);  // priorité bornée à 4
  CHECK(cfg.out[0].priority == 4);
  CHECK(io.chg & CHG_OUTLET);
  // remise à zéro réservée à l'enseignant par défaut
  kit.resetEnergy(1);
  CHECK(io.resets == 0);
  cfg.perms |= PERM_RESET_ENERGY;
  kit.resetEnergy(1);
  CHECK(io.resets == 1);
  // k-NN
  std::string msg;
  for (int i = 0; i < 5; i++) kit.onMeasurement(0, meas(1980, 1.0f), t + 3000 + i * 1000);
  CHECK(kit.knnTrain(0, "Bouilloire", msg));
  for (int i = 0; i < 5; i++) kit.onMeasurement(0, meas(9, 0.55f), t + 9000 + i * 1000);
  CHECK(kit.knnTrain(0, "Chargeur", msg));
  kit.onMeasurement(0, meas(2005, 0.99f), t + 20000);
  kit.tick1s(t + 20000);
  CHECK(kit.out[0].appliance == 1);
  // délestage : nouvel essai de remise en service, délai doublé après un échec ;
  // un programme ne rallume pas une prise délestée
  cfg.out[2].maxPower = 2000;
  cfg.out[0].priority = 2;
  t = 1000000;
  for (int k = 0; k < 4; k++) { kit.rearm(k); kit.userRelay(k, true, Relays::SRC_USER, t); }
  t += 3000;
  kit.onMeasurement(0, meas(300), t); kit.onMeasurement(1, meas(200), t);
  kit.onMeasurement(2, meas(1500), t); kit.onMeasurement(3, meas(100), t);
  kit.shedStep(2000, t + 100);  // 2100 > 2000 -> prise 3 (priorité 4) délestée
  CHECK(kit.out[2].shed && !rel.isOn(2));
  NEAR(kit.out[2].retryMs, 120000, 1e-9);
  kit.relay(3, true);
  CHECK(kit.out[2].shed && !rel.isOn(2));
  kit.onMeasurement(2, meas(0), t + 1000);
  kit.shedStep(2000, t + 60000);  // 600 + 1500 >= 1800 et délai non écoulé : reste délestée
  CHECK(kit.out[2].shed);
  kit.shedStep(2000, t + 120100);  // 2 min écoulées et 600 < 0,7 x 2000 : nouvel essai
  CHECK(!kit.out[2].shed && rel.isOn(2));
  kit.onMeasurement(2, meas(1500), t + 121000);
  kit.shedStep(2000, t + 125200);  // de nouveau en surcharge juste après l'essai : délai doublé
  CHECK(kit.out[2].shed && !rel.isOn(2));
  NEAR(kit.out[2].retryMs, 240000, 1e-9);
  kit.shedStep(2000, t + 325200);  // délai doublé non écoulé
  CHECK(kit.out[2].shed);
  kit.tick1s(t + 365200);  // plus d'appel au délestage depuis 40 s : la prise redevient pilotable
  CHECK(!kit.out[2].shed);
  printf("  journal (%d entrées), dernier : %s\n", kit.logCount(), kit.logAt(0)->msg);
  printf("\n%d vérifications réussies, %d échecs\n", g_pass, g_fail);
  return g_fail ? 1 : 0;
}

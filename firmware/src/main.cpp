// EnergyLab - Kit pédagogique IoT de gestion de l'énergie domestique
// ESP32 + 4 x PZEM-004T v3.0 + module 4 relais + OLED + DHT22 + LDR + PIR + buzzer
//
// Le kit crée son propre réseau Wi-Fi (ou rejoint celui de l'établissement) et sert
// l'application pédagogique : tableau de bord, laboratoire de mesure, programmation par
// blocs (type Scratch) exécutée sur le kit, algorithmes intelligents, missions guidées.
#include <Arduino.h>
#include <WiFi.h>
#include <esp_timer.h>
#include <time.h>

#include "app.h"
#include "buzzer.h"
#include "display.h"
#include "measure.h"
#include "mqttbridge.h"
#include "net.h"
#include "pins.h"
#include "storage.h"
#include "webapi.h"

// ------------------------------------------------------------------ objets globaux
class FirmwareIO : public KitIO {
 public:
  void beep(int kind) override { buzzer::play(kind); }
  void screenMessage(const char* msg) override { display::message(msg, 10000); }
  void alertScreen(const char* msg) override { display::alert(msg); }
  void pzemResetEnergy(int k) override {
    PzemCmd c = {PZ_RESET_ENERGY, (uint8_t)k, 0};
    pzemCommand(c);
  }
  void pzemSetAlarm(int k, uint16_t w) override {
    PzemCmd c = {PZ_SET_ALARM, (uint8_t)k, w};
    pzemCommand(c);
  }
  void configChanged(uint32_t) override { requestConfigSave(); }
  void onLog(const LogEntry& e) override { queueLogBroadcast(e); }
};

Config g_cfg;
Relays g_relays;
static FirmwareIO s_io;
KitCore g_kit(g_cfg, g_relays, s_io);
SemaphoreHandle_t g_lock = nullptr;
char g_kitId[8] = "0000";
PzemToolState g_pzemTool;
volatile uint32_t g_rebootAt = 0;

static QueueHandle_t s_logQ = nullptr;
static volatile uint32_t s_cfgSaveAt = 0;
static volatile uint32_t s_relaySaveAt = 0;
static const int RELAY_PINS[4] = {PIN_RELAY1, PIN_RELAY2, PIN_RELAY3, PIN_RELAY4};

double nowMs() { return esp_timer_get_time() / 1000.0; }

void requestConfigSave() { s_cfgSaveAt = millis() + 3000; }
void requestRelaySave() { s_relaySaveAt = millis() + 5000; }

void queueLogBroadcast(const LogEntry& e) {
  if (s_logQ) xQueueSend(s_logQ, &e, 0);
}

static void writeRelayPin(int k, bool on) {
  if (k < 0 || k > 3) return;
  bool level = g_cfg.relayActiveLow ? !on : on;
  digitalWrite(RELAY_PINS[k], level ? HIGH : LOW);
}

// ------------------------------------------------------------------ programme
bool programLoadFromJson(const char* json, size_t len, std::string& err, bool start, bool save) {
  JsonDocument doc;
  DeserializationError de = deserializeJson(doc, json, len);
  if (de) {
    err = "JSON invalide";
    return false;
  }
  const char* fmt = doc["fmt"] | "";
  if (strcmp(fmt, "elab-bc") != 0 || (doc["v"] | 0) != 1) {
    err = "format de programme inconnu (mettez à jour l'application)";
    return false;
  }
  vm::Program p;
  p.name = (const char*)(doc["name"] | "Programme");
  p.hash = (const char*)(doc["hash"] | "");
  if (!vm::parseCode(doc["code"] | "", p.code, err)) return false;
  for (JsonObjectConst s : doc["scripts"].as<JsonArrayConst>()) {
    vm::ScriptDef d;
    d.type = s["type"] | 0;
    d.entry = s["entry"] | 0;
    d.cond = s["cond"] | -1;
    d.period = s["period"] | 1.0;
    d.h = s["h"] | 0;
    d.m = s["m"] | 0;
    d.btn = s["btn"] | 1;
    p.scripts.push_back(d);
  }
  for (JsonVariantConst v : doc["vars"].as<JsonArrayConst>()) p.vars.push_back(v.as<const char*>() ? v.as<const char*>() : "");
  for (JsonVariantConst v : doc["strs"].as<JsonArrayConst>()) p.strs.push_back(v.as<const char*>() ? v.as<const char*>() : "");
  {
    Lock l;
    if (!g_kit.loadProgram(p, err)) return false;
    if (start) g_kit.startProgram(nowMs(), esp_random());
    else g_kit.note(LG_INFO, "Programme « %s » chargé", p.name.c_str());
  }
  if (save) storage::writeFile("/program.json", (const uint8_t*)json, len);
  return true;
}

void programAutostartOnBoot() {
  if (!storage::exists("/program.json")) return;
  String s = storage::readFile("/program.json", 48000);
  if (s.length() == 0) return;
  bool autostart;
  {
    Lock l;
    autostart = g_cfg.progAutostart;
  }
  std::string err;
  if (!programLoadFromJson(s.c_str(), s.length(), err, autostart, false)) {
    Lock l;
    g_kit.note(LG_WARN, "Programme enregistré illisible : %s", err.c_str());
  }
}

// ------------------------------------------------------------------ aides
static bool localParts(struct tm& out) {
  if (!net::timeValid()) return false;
  time_t t = (time_t)(net::epochNow() + (int64_t)g_cfg.tzMin * 60);
  gmtime_r(&t, &out);
  return true;
}

static void sendLogs() {
  LogEntry e;
  while (s_logQ && xQueueReceive(s_logQ, &e, 0) == pdTRUE) {
    Serial.printf("[%lu] %s\n", (unsigned long)e.seq, e.msg);
    String j = "{\"t\":\"lg\",\"s\":";
    j += String((unsigned long)e.seq);
    j += ",\"ts\":";
    j += String((long)e.ts);
    j += ",\"l\":";
    j += String(e.level);
    j += ",\"m\":\"";
    for (const char* p = e.msg; *p; p++) {
      if (*p == '"' || *p == '\\') {
        j += '\\';
        j += *p;
      } else if ((unsigned char)*p >= 0x20) {
        j += *p;
      }
    }
    j += "\"}";
    webapi::broadcastLog(j.c_str());
  }
}

static void minuteLog() {
  static int lastMin = -1;
  struct tm tm;
  if (!localParts(tm)) return;
  if (tm.tm_min == lastMin) return;
  bool first = lastMin < 0;
  lastMin = tm.tm_min;
  if (first) return;  // première minute incomplète
  char date[12], line[160];
  snprintf(date, sizeof date, "%04d%02d%02d", tm.tm_year + 1900, tm.tm_mon + 1, tm.tm_mday);
  // la minute écoulée
  int hh = tm.tm_hour, mm = tm.tm_min - 1;
  if (mm < 0) {
    mm = 59;
    hh = (hh + 23) % 24;
  }
  double p[4];
  float T, H, L;
  int pres;
  uint8_t mask;
  {
    Lock l;
    for (int k = 0; k < 4; k++) p[k] = g_kit.hist.avgP(k, 60);
    T = g_kit.env.temp;
    H = g_kit.env.hum;
    L = g_kit.env.lum;
    pres = g_kit.env.pres ? 1 : 0;
    mask = g_relays.mask();
  }
  for (int k = 0; k < 4; k++)
    if (isnan(p[k])) p[k] = 0;
  char t[10] = "", h[10] = "", l[10] = "";
  if (!isnan(T)) snprintf(t, sizeof t, "%.1f", T);
  if (!isnan(H)) snprintf(h, sizeof h, "%.1f", H);
  if (!isnan(L)) snprintf(l, sizeof l, "%.0f", L);
  snprintf(line, sizeof line, "%02d:%02d,%.1f,%.1f,%.1f,%.1f,%.3f,%.3f,%.3f,%.3f,%s,%s,%s,%d,%u\n", hh, mm, p[0], p[1], p[2],
           p[3], p[0] / 60, p[1] / 60, p[2] / 60, p[3] / 60, t, h, l, pres, mask);
  static String lastDate;
  if (lastDate != date) {
    lastDate = date;
    storage::dataLogFlush();
    storage::dataLogCleanup(10);
  }
  storage::dataLogMinute(date, line);
  if (mm % 5 == 4) storage::dataLogFlush();
}

static void handleButton() {
  static uint32_t downAt = 0;
  static bool down = false, longDone = false;
  bool pressed = digitalRead(PIN_BUTTON) == LOW;
  uint32_t ms = millis();
  if (pressed && !down) {
    down = true;
    downAt = ms;
    longDone = false;
  } else if (pressed && down && !longDone && ms - downAt > 6000) {
    longDone = true;
    buzzer::play(buzzer::LONG);
    display::message("Relâchez : retour au Wi-Fi du kit (mode point d'accès)", 5000);
  } else if (!pressed && down) {
    down = false;
    if (longDone) {
      {
        Lock l;
        g_cfg.wifiMode = 0;
        g_kit.note(LG_WARN, "Bouton : retour au point d'accès Wi-Fi du kit");
      }
      Config copy;
      {
        Lock l;
        copy = g_cfg;
      }
      storage::saveConfig(copy);
      g_rebootAt = millis() + 1000;
    } else if (ms - downAt > 40) {
      display::nextScreen();
    }
  }
}

static void updateDisplay() {
  if (!display::present()) return;
  display::Snapshot s;
  memset(&s, 0, sizeof s);
  {
    Lock l;
    strncpy(s.kitName, g_cfg.kitName, sizeof s.kitName - 1);
    strncpy(s.kitId, g_kitId, sizeof s.kitId - 1);
    strncpy(s.apSsid, g_cfg.apSsid, sizeof s.apSsid - 1);
    strncpy(s.apPass, g_cfg.apPass, sizeof s.apPass - 1);
    strncpy(s.host, g_cfg.hostname, sizeof s.host - 1);
    strncpy(s.currency, g_cfg.currency, sizeof s.currency - 1);
    for (int k = 0; k < 4; k++) {
      strncpy(s.names[k], g_cfg.out[k].name, sizeof s.names[k] - 1);
      s.p[k] = g_kit.out[k].p;
      s.on[k] = g_relays.isOn(k);
      s.latched[k] = g_relays.isLatched(k);
      s.online[k] = g_kit.out[k].online;
    }
    s.total = g_kit.totalP();
    s.eToday = g_kit.totalEToday();
    s.costToday = g_kit.totalCostToday();
    s.temp = g_kit.env.temp;
    s.hum = g_kit.env.hum;
    s.lum = g_kit.env.lum;
    s.pres = g_kit.env.pres;
    s.progStatus = g_kit.machine.status();
    if (g_kit.machine.loaded()) strncpy(s.prog, g_kit.machine.program().name.c_str(), sizeof s.prog - 1);
  }
  s.apActive = net::apActive();
  s.staConnected = net::staConnected();
  strncpy(s.staSsid, net::staSsid(), sizeof s.staSsid - 1);
  strncpy(s.ip, net::staIp().c_str(), sizeof s.ip - 1);
  strncpy(s.apIp, "192.168.4.1", sizeof s.apIp - 1);
  struct tm tm;
  s.timeValid = localParts(tm);
  if (s.timeValid) {
    s.hh = tm.tm_hour;
    s.mm = tm.tm_min;
  }
  display::update(s);
}

// ------------------------------------------------------------------ setup / loop
void setup() {
  Serial.begin(115200);
  delay(50);
  Serial.println();
  Serial.println("EnergyLab " FW_VERSION " - kit pédagogique IoT de gestion de l'énergie");
  g_lock = xSemaphoreCreateRecursiveMutex();
  s_logQ = xQueueCreate(16, sizeof(LogEntry));

  uint8_t mac[6];
  WiFi.macAddress(mac);
  snprintf(g_kitId, sizeof g_kitId, "%02X%02X", mac[4], mac[5]);

  configDefaults(g_cfg, g_kitId);
  bool hadConfig = storage::loadConfig(g_cfg);

  // Relais à l'état sûr (éteints) avant toute autre chose
  for (int k = 0; k < 4; k++) {
    digitalWrite(RELAY_PINS[k], g_cfg.relayActiveLow ? HIGH : LOW);
    pinMode(RELAY_PINS[k], OUTPUT);
  }
  g_relays.begin(writeRelayPin);
  g_kit.applyOutletConfig();
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  buzzer::begin();
  display::begin(g_cfg.oledType);
  display::boot("Démarrage…");

  storage::begin();
  uint32_t boots = storage::bootCount();
  DaySummary d;
  if (storage::loadToday(d)) g_kit.restoreDay(d);
  DaySummary days[7];
  int nd = storage::loadDays(days, 7);
  g_kit.restoreHistory(days, nd);
  storage::loadKnn(g_kit.knn);

  uint8_t last = storage::loadRelayMask();
  double now = nowMs();
  for (int k = 0; k < 4; k++) {
    uint8_t bs = g_cfg.out[k].bootState;
    bool on = g_cfg.out[k].enabled && (bs == 1 || (bs == 2 && ((last >> k) & 1)));
    g_relays.force(k, on, now);
  }
  g_kit.note(LG_INFO, "EnergyLab %s démarré (démarrage n° %lu)%s", FW_VERSION, (unsigned long)boots,
             hadConfig ? "" : " — configuration par défaut");

  measure::begin();
  net::begin();
  webapi::begin();
  mqttbridge::begin();
  programAutostartOnBoot();
  if (g_cfg.buzzerOn) buzzer::play(buzzer::BOOT);
}

void loop() {
  static uint32_t t100 = 0, t1s = 0, tDisp = 0, tToday = 0;
  static long lastDay = -2;
  uint32_t ms = millis();

  net::loop();
  buzzer::loop();
  sendLogs();
  handleButton();

  if (ms - t100 >= 100) {
    t100 = ms;
    float t, h;
    measure::lastTempHum(t, h);
    bool ldrOn, ldrInv, pirOn;
    {
      Lock l;
      ldrOn = g_cfg.ldrOn;
      ldrInv = g_cfg.ldrInvert;
      pirOn = g_cfg.pirOn;
    }
    float lum = ldrOn ? measure::readLightPct(ldrInv) : NAN;
    bool motion = pirOn && measure::readMotion();
    Lock l;
    g_kit.setClock(net::timeValid(), net::epochNow());
    g_kit.onEnv(t, h, lum, motion, nowMs());
    g_kit.tick100(nowMs());
  }

  if (ms - t1s >= 1000) {
    t1s = (ms - t1s > 3000) ? ms : t1s + 1000;
    bool saveDay = false;
    {
      Lock l;
      g_kit.tick1s(nowMs());
      webapi::buildState();
      if (g_relays.takeChanged()) requestRelaySave();
      long dk = g_kit.dayKey();
      if (dk != lastDay) {
        if (lastDay != -2) saveDay = true;
        lastDay = dk;
      }
    }
    webapi::broadcastState();
    if (saveDay || ms - tToday > 600000) {
      tToday = ms;
      DaySummary today;
      {
        Lock l;
        today = g_kit.today();
      }
      storage::saveToday(today);
      if (saveDay) {
        Lock l;
        storage::saveDays(g_kit);
      }
    }
    minuteLog();
    // LED : fixe si connecté à un réseau, clignotante en point d'accès seul
    digitalWrite(PIN_LED, net::staConnected() ? HIGH : ((ms / 1000) % 2 ? HIGH : LOW));
  }

  if (ms - tDisp >= 500) {
    tDisp = ms;
    updateDisplay();
  }

  if (s_cfgSaveAt && (int32_t)(ms - s_cfgSaveAt) >= 0) {
    s_cfgSaveAt = 0;
    Config copy;
    {
      Lock l;
      copy = g_cfg;
    }
    storage::saveConfig(copy);
    webapi::bumpConfigSeq();
  }
  if (s_relaySaveAt && (int32_t)(ms - s_relaySaveAt) >= 0) {
    s_relaySaveAt = 0;
    uint8_t m;
    {
      Lock l;
      m = g_relays.mask();
    }
    storage::saveRelayMask(m);
  }
  if (g_rebootAt && (int32_t)(ms - g_rebootAt) >= 0) {
    storage::dataLogFlush();
    DaySummary today;
    {
      Lock l;
      today = g_kit.today();
    }
    storage::saveToday(today);
    delay(100);
    ESP.restart();
  }
  delay(2);
}

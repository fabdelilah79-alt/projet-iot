// EnergyLab - serveur web (voir webapi.h)
#include "webapi.h"

#include <ArduinoJson.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>

#include <memory>
#include <vector>

#include "app.h"
#include "measure.h"
#include "mqttbridge.h"
#include "net.h"
#include "storage.h"
#include "web_assets.h"

extern volatile uint32_t g_rebootAt;

namespace webapi {

static AsyncWebServer server(80);
static AsyncWebSocket ws("/ws");
static String s_state = "{}";
static SemaphoreHandle_t s_stateMtx = nullptr;
static volatile uint32_t s_cfgSeq = 1;
static volatile uint32_t s_knnSeq = 1;
static const size_t MAX_BODY = 65536;

uint32_t configSeq() { return s_cfgSeq; }
void bumpConfigSeq() { s_cfgSeq++; }
void bumpKnnSeq() { s_knnSeq++; }
int wsClients() { return (int)ws.count(); }

// ------------------------------------------------------------------ JSON
struct J {
  String s;
  void key(const char* k) {
    s += '"';
    s += k;
    s += "\":";
  }
  void val(double v, int dec) {
    if (isnan(v) || isinf(v)) {
      s += "null";
      return;
    }
    char b[32];
    snprintf(b, sizeof b, "%.*f", dec, v);
    s += b;
  }
  void num(const char* k, double v, int dec) {
    key(k);
    val(v, dec);
    s += ',';
  }
  void i(const char* k, long v) {
    key(k);
    s += String(v);
    s += ',';
  }
  void b(const char* k, bool v) {
    key(k);
    s += v ? '1' : '0';
    s += ',';
  }
  void esc(const char* v) {
    s += '"';
    for (const char* p = v; p && *p; p++) {
      char c = *p;
      if (c == '"' || c == '\\') {
        s += '\\';
        s += c;
      } else if ((unsigned char)c < 0x20) {
        char e[8];
        snprintf(e, sizeof e, "\\u%04x", (unsigned)c);
        s += e;
      } else {
        s += c;
      }
    }
    s += '"';
  }
  void str(const char* k, const char* v) {
    key(k);
    esc(v);
    s += ',';
  }
  void open(const char* k, char br) {
    if (k) key(k);
    s += br;
  }
  void close(char br) {
    if (s.endsWith(",")) s.remove(s.length() - 1);
    s += br;
    s += ',';
  }
  void finish() {
    if (s.endsWith(",")) s.remove(s.length() - 1);
  }
};

void buildState() {
  double now = nowMs();
  J j;
  j.s.reserve(3000);
  j.s += '{';
  j.str("t", "st");
  bool tv = g_kit.clockValid();
  j.i("ts", tv ? (long)g_kit.epoch() : 0);
  j.b("tv", tv);
  j.i("up", (long)(millis() / 1000));
  j.i("tz", g_cfg.tzMin);
  j.open("o", '[');
  for (int k = 0; k < NOUT; k++) {
    const OutletLive& o = g_kit.out[k];
    j.s += '{';
    j.num("u", o.u, 1);
    j.num("i", o.i, 3);
    j.num("p", o.p, 1);
    j.num("s", o.s, 1);
    j.num("q", o.q, 1);
    j.num("pf", o.pf, 2);
    j.num("f", o.f, 1);
    j.num("phi", o.phi, 1);
    j.num("ec", o.eCounterKWh, 3);
    j.num("ed", o.eTodayWh, 2);
    j.num("cd", o.costToday, 4);
    j.b("on", g_relays.isOn(k));
    j.b("ol", o.online);
    j.b("lt", g_relays.isLatched(k));
    j.str("lr", o.latchReason);
    j.b("al", o.alarm);
    j.b("sh", o.shed);
    j.i("sw", (long)g_relays.switches(k));
    j.b("pd", g_relays.hasPending(k));
    double pe = g_relays.pulseEnd(k);
    j.num("pu", pe > 0 ? (pe - now > 0 ? (pe - now) / 1000.0 : 0) : 0, 0);
    j.num("id", o.idleS, 0);
    j.b("an", g_kit.anom[k].flag());
    j.num("z", g_kit.anom[k].z(), 2);
    j.i("ap", o.appliance);
    j.num("ad", o.applianceDist, 2);
    j.close('}');
  }
  j.close(']');
  j.open("env", '{');
  j.num("T", g_kit.env.temp, 1);
  j.num("H", g_kit.env.hum, 1);
  j.num("L", g_kit.env.lum, 1);
  j.b("pr", g_kit.env.pres);
  j.b("mo", g_kit.env.motion);
  j.close('}');
  j.open("tot", '{');
  j.num("p", g_kit.totalP(), 1);
  j.num("ed", g_kit.totalEToday(), 1);
  j.num("cd", g_kit.totalCostToday(), 3);
  j.num("co2", g_kit.co2Today(), 1);
  j.num("pk", g_kit.peakToday(), 1);
  j.num("v", g_kit.avgVoltage(), 1);
  j.close('}');
  j.open("tar", '{');
  j.b("off", g_kit.offPeakNow());
  j.num("pr", g_kit.priceNow(), 3);
  j.close('}');
  const vm::Machine& m = g_kit.machine;
  j.open("vm", '{');
  j.i("st", m.status());
  j.str("n", m.loaded() ? m.program().name.c_str() : "");
  j.str("h", m.loaded() ? m.program().hash.c_str() : "");
  j.str("e", m.error().c_str());
  j.i("es", m.errorScript());
  j.i("ep", m.errorPc());
  j.open("pc", '[');
  for (size_t i = 0; i < m.scriptCount(); i++) {
    j.s += String(m.scriptPc((int)i));
    j.s += ',';
  }
  j.close(']');
  j.open("v", '[');
  for (size_t i = 0; i < m.varCount(); i++) {
    j.val(m.var((int)i), 4);
    j.s += ',';
  }
  j.close(']');
  j.num("rt", m.status() == vm::VM_RUNNING ? (now - m.startedAt()) / 1000.0 : 0, 0);
  j.i("ir", (long)m.instructionsLastTick());
  j.close('}');
  j.open("fc", '{');
  j.num("f10", g_kit.holt.forecast(10), 0);
  j.num("f30", g_kit.holt.forecast(30), 0);
  j.num("tr", g_kit.hist.slopeTotalPerMin(120), 1);
  j.close('}');
  j.open("net", '{');
  j.str("m", net::modeName());
  j.i("n", net::apClients());
  j.i("rs", net::rssi());
  j.i("ws", (long)ws.count());
  j.close('}');
  j.i("lg", (long)g_kit.logSeq());
  j.i("cs", (long)s_cfgSeq);
  j.i("ks", (long)s_knnSeq);
  j.i("ps", (long)g_pzemTool.seq);
  j.b("pb", g_pzemTool.busy);
  j.finish();
  j.s += '}';
  xSemaphoreTake(s_stateMtx, portMAX_DELAY);
  s_state = j.s;
  xSemaphoreGive(s_stateMtx);
}

static String stateCopy() {
  xSemaphoreTake(s_stateMtx, portMAX_DELAY);
  String c = s_state;
  xSemaphoreGive(s_stateMtx);
  return c;
}

String stateJson() { return stateCopy(); }

void broadcastState() {
  ws.cleanupClients();
  if (ws.count() == 0) return;
  ws.textAll(stateCopy());
}

void broadcastLog(const char* json) {
  if (ws.count() == 0) return;
  ws.textAll(json);
}

void loop() {}

// ------------------------------------------------------------------ aides HTTP
static void bodyCollector(AsyncWebServerRequest* r, uint8_t* data, size_t len, size_t index, size_t total) {
  if (total > MAX_BODY) return;
  if (index == 0) {
    if (r->_tempObject) free(r->_tempObject);
    r->_tempObject = malloc(total + 1);
  }
  if (!r->_tempObject) return;
  memcpy((uint8_t*)r->_tempObject + index, data, len);
  if (index + len == total) ((char*)r->_tempObject)[total] = 0;
}

static const char* bodyOf(AsyncWebServerRequest* r) {
  return r->_tempObject ? (const char*)r->_tempObject : "{}";
}

static size_t bodyLen(AsyncWebServerRequest* r) { return r->_tempObject ? strlen((const char*)r->_tempObject) : 2; }

static void sendJson(AsyncWebServerRequest* r, int code, const String& s) {
  AsyncWebServerResponse* res = r->beginResponse(code, "application/json", s);
  res->addHeader("Cache-Control", "no-store");
  r->send(res);
}

static void reply(AsyncWebServerRequest* r, bool ok, const String& msg, int code = 200) {
  J j;
  j.s = "{";
  j.b("ok", ok);
  j.str("msg", msg.c_str());
  j.finish();
  j.s += "}";
  sendJson(r, ok ? 200 : (code == 200 ? 400 : code), j.s);
}

static bool isTeacher(AsyncWebServerRequest* r) {
  if (!r->hasHeader("X-Pin")) return false;
  const String& pin = r->header("X-Pin");
  Lock l;
  return pin.length() > 0 && pin == g_cfg.pin;
}

static bool allowed(AsyncWebServerRequest* r, uint16_t perm) {
  if (isTeacher(r)) return true;
  Lock l;
  return (g_cfg.perms & perm) != 0;
}

static String relayMsg(Relays::Result res, int k) {
  switch (res) {
    case Relays::RL_OK: return "";
    case Relays::RL_NOCHANGE: return "";
    case Relays::RL_DELAYED: {
      char b[96];
      snprintf(b, sizeof b, "Commutation retardée : délai minimum de %.1f s entre deux commutations", g_cfg.out[k].minSwitchS);
      return b;
    }
    case Relays::RL_LATCHED: return "Prise verrouillée par une protection : réarmez-la d'abord";
    default: return "Prise invalide ou désactivée";
  }
}

static String csvField(const char* v) {
  String s = "\"";
  for (const char* p = v; p && *p; p++) {
    if (*p == '"') s += "\"\"";
    else if (*p == '\n' || *p == '\r') s += ' ';
    else s += *p;
  }
  s += "\"";
  return s;
}

static String csvVal(JsonVariantConst v) {
  if (v.isNull()) return "";
  if (v.is<const char*>()) return csvField(v.as<const char*>());
  if (v.is<bool>()) return v.as<bool>() ? "1" : "0";
  if (v.is<long>()) return String(v.as<long>());
  if (v.is<double>()) {
    char b[32];
    snprintf(b, sizeof b, "%.4g", v.as<double>());
    return b;
  }
  String s;
  serializeJson(v, s);
  return csvField(s.c_str());
}

// ------------------------------------------------------------------ commandes
static void handleCmd(AsyncWebServerRequest* r) {
  JsonDocument doc;
  if (deserializeJson(doc, bodyOf(r))) return reply(r, false, "JSON invalide");
  const char* cmd = doc["cmd"] | "";
  bool teacher = isTeacher(r);
  double now = nowMs();

  if (!strcmp(cmd, "relay") || !strcmp(cmd, "toggle") || !strcmp(cmd, "pulse")) {
    if (!allowed(r, PERM_RELAY)) return reply(r, false, "La commande manuelle des prises est désactivée par l'enseignant", 403);
    int outlet = doc["outlet"] | 0;
    if (outlet < 0 || outlet > NOUT) return reply(r, false, "Prise invalide");
    Lock l;
    String msg;
    int from = outlet == 0 ? 0 : outlet - 1;
    int to = outlet == 0 ? NOUT - 1 : outlet - 1;
    for (int k = from; k <= to; k++) {
      Relays::Result res;
      if (!strcmp(cmd, "relay")) res = g_kit.userRelay(k, doc["on"] | false, Relays::SRC_USER, now);
      else if (!strcmp(cmd, "toggle")) res = g_kit.userRelay(k, !g_relays.isOn(k), Relays::SRC_USER, now);
      else {
        double s = doc["s"] | 10.0;
        if (g_relays.isLatched(k)) res = Relays::RL_LATCHED;
        else {
          g_kit.out[k].shed = false;
          g_relays.pulse(k, s, Relays::SRC_USER, now);
          res = Relays::RL_OK;
        }
      }
      String m = relayMsg(res, k);
      if (m.length()) msg = m;
    }
    requestRelaySave();
    return reply(r, true, msg);
  }
  if (!strcmp(cmd, "rearm")) {
    if (!allowed(r, PERM_REARM)) return reply(r, false, "Le réarmement est réservé à l'enseignant", 403);
    int outlet = doc["outlet"] | 0;
    if (outlet < 1 || outlet > NOUT) return reply(r, false, "Prise invalide");
    Lock l;
    bool ok = g_kit.rearm(outlet - 1);
    return reply(r, ok, ok ? "Prise réarmée" : "Cette prise n'était pas verrouillée");
  }
  if (!strcmp(cmd, "param")) {
    if (!allowed(r, PERM_PARAMS)) return reply(r, false, "La modification des paramètres est verrouillée par l'enseignant", 403);
    int p = doc["p"] | -1;
    int idx = doc["idx"] | 0;
    double v = doc["v"] | NAN;
    Lock l;
    double before = paramGet(g_cfg, p, idx);
    double applied = 0;
    std::string msg;
    if (!paramSet(g_cfg, p, idx, v, applied, msg)) return reply(r, false, msg.c_str());
    double after = paramGet(g_cfg, p, idx);
    if (after != before) {
      if (paramIsOutlet(p)) g_kit.note(LG_INFO, "Paramètre « %s » de la prise %d : %g → %g", paramName(p), idx, before, after);
      else g_kit.note(LG_INFO, "Paramètre « %s » : %g → %g", paramName(p), before, after);
      if (p == 4) g_kit.applyOutletConfig();
      if (p == 1) {
        PzemCmd c = {PZ_SET_ALARM, (uint8_t)(idx - 1), (uint16_t)after};
        pzemCommand(c);
      }
      requestConfigSave();
    }
    J j;
    j.s = "{";
    j.b("ok", true);
    j.num("v", after, 3);
    j.str("msg", msg.c_str());
    j.finish();
    j.s += "}";
    return sendJson(r, 200, j.s);
  }
  if (!strcmp(cmd, "resetEnergy")) {
    if (!allowed(r, PERM_RESET_ENERGY)) return reply(r, false, "La remise à zéro des compteurs est réservée à l'enseignant", 403);
    int outlet = doc["outlet"] | 0;
    if (outlet < 1 || outlet > NOUT) return reply(r, false, "Prise invalide");
    PzemCmd c = {PZ_RESET_ENERGY, (uint8_t)(outlet - 1), 0};
    return reply(r, pzemCommand(c), "Remise à zéro demandée");
  }
  if (!strcmp(cmd, "beep")) {
    Lock l;
    g_kit.beep(doc["n"] | 0);
    return reply(r, true, "");
  }
  if (!strcmp(cmd, "vbtn")) {
    Lock l;
    g_kit.machine.pressButton(doc["b"] | 1);
    return reply(r, true, "");
  }
  if (!strcmp(cmd, "time")) {
    int64_t epoch = (int64_t)(doc["epoch"] | 0.0);
    bool changed = net::setTimeFromClient(epoch);
    if (!doc["tz"].isNull()) {
      int tz = doc["tz"] | 0;
      Lock l;
      if (g_cfg.tzAuto && tz >= -720 && tz <= 840 && tz != g_cfg.tzMin) {
        g_cfg.tzMin = (int16_t)tz;
        requestConfigSave();
      }
    }
    if (changed) {
      Lock l;
      g_kit.note(LG_INFO, "Horloge du kit réglée depuis un navigateur");
    }
    return reply(r, true, changed ? "Horloge réglée" : "");
  }
  if (!strcmp(cmd, "knnClear")) {
    if (!allowed(r, PERM_KNN)) return reply(r, false, "Action réservée à l'enseignant", 403);
    Lock l;
    g_kit.knn.samples.clear();
    g_kit.knn.labels.clear();
    storage::saveKnn(g_kit.knn);
    s_knnSeq++;
    return reply(r, true, "Apprentissage effacé");
  }
  // --- commandes enseignant
  if (!teacher) return reply(r, false, "Code enseignant requis", 403);
  if (!strcmp(cmd, "pzem")) {
    const char* op = doc["op"] | "";
    PzemCmd c = {PZ_SCAN, 0, 0};
    if (!strcmp(op, "scan")) c.type = PZ_SCAN;
    else if (!strcmp(op, "setaddr")) {
      int a = doc["addr"] | 0;
      if (a < 1 || a > 247) return reply(r, false, "Adresse invalide (1 à 247)");
      c.type = PZ_SET_ADDR;
      c.outlet0 = (uint8_t)a;
    } else if (!strcmp(op, "readalarms")) c.type = PZ_READ_ALARMS;
    else return reply(r, false, "Opération inconnue");
    {
      Lock l;
      g_pzemTool.busy = true;
      snprintf(g_pzemTool.msg, sizeof g_pzemTool.msg, "Opération en cours…");
      g_pzemTool.seq++;
    }
    return reply(r, pzemCommand(c), "Opération lancée");
  }
  if (!strcmp(cmd, "reboot")) {
    g_rebootAt = millis() + 1500;
    return reply(r, true, "Redémarrage du kit…");
  }
  if (!strcmp(cmd, "factory")) {
    storage::factoryReset();
    g_rebootAt = millis() + 1500;
    return reply(r, true, "Réinitialisation d'usine : le kit redémarre");
  }
  if (!strcmp(cmd, "clearLogs")) {
    storage::clearDir("/log");
    return reply(r, true, "Journaux effacés");
  }
  if (!strcmp(cmd, "clearResearch")) {
    storage::clearDir("/research");
    return reply(r, true, "Données de recherche effacées");
  }
  return reply(r, false, "Commande inconnue");
}

// ------------------------------------------------------------------ configuration
static void handleConfigGet(AsyncWebServerRequest* r) {
  bool teacher = isTeacher(r);
  JsonDocument doc;
  {
    Lock l;
    configToJson(g_cfg, doc.to<JsonObject>(), teacher);
  }
  doc["seq"] = s_cfgSeq;
  doc["teacher"] = teacher;
  String s;
  serializeJson(doc, s);
  sendJson(r, 200, s);
}

static void handleConfigPost(AsyncWebServerRequest* r) {
  if (!isTeacher(r)) return reply(r, false, "Code enseignant requis", 403);
  JsonDocument in;
  if (deserializeJson(in, bodyOf(r))) return reply(r, false, "JSON invalide");
  uint32_t chg;
  uint16_t oldAlarm[NOUT];
  {
    Lock l;
    for (int k = 0; k < NOUT; k++) oldAlarm[k] = g_cfg.out[k].pzemAlarm;
    chg = configFromJson(g_cfg, in.as<JsonObjectConst>());
    if (chg & CHG_OUTLET) g_kit.applyOutletConfig();
    if (chg & CHG_ALARM) {
      for (int k = 0; k < NOUT; k++) {
        if (g_cfg.out[k].pzemAlarm != oldAlarm[k]) {
          PzemCmd c = {PZ_SET_ALARM, (uint8_t)k, g_cfg.out[k].pzemAlarm};
          pzemCommand(c);
        }
      }
    }
    if (chg != CHG_NONE) g_kit.note(LG_INFO, "Configuration modifiée par l'enseignant");
  }
  if (chg & CHG_MQTT) mqttbridge::reconfigure();
  if (chg != CHG_NONE) requestConfigSave();
  JsonDocument out;
  out["ok"] = true;
  out["reboot"] = (chg & CHG_NET) != 0;
  out["msg"] = (chg & CHG_NET) ? "Redémarrez le kit pour appliquer les réglages Wi-Fi" : "Enregistré";
  String s;
  serializeJson(out, s);
  sendJson(r, 200, s);
}

static void handleInfo(AsyncWebServerRequest* r) {
  JsonDocument d;
  d["fw"] = FW_VERSION;
  d["build"] = __DATE__ " " __TIME__;
  d["kit"] = g_kitId;
  {
    Lock l;
    d["name"] = g_cfg.kitName;
    d["apSsid"] = g_cfg.apSsid;
    d["host"] = g_cfg.hostname;
  }
  d["mode"] = net::modeName();
  d["ip"] = net::staIp();
  d["apIp"] = net::apIp();
  d["ssid"] = net::staSsid();
  d["rssi"] = net::rssi();
  d["clients"] = net::apClients();
  d["heap"] = ESP.getFreeHeap();
  d["minHeap"] = ESP.getMinFreeHeap();
  d["uptime"] = millis() / 1000;
  d["time"] = (double)net::epochNow();
  d["timeValid"] = net::timeValid();
  d["fsUsed"] = storage::usedBytes();
  d["fsTotal"] = storage::totalBytes();
  d["teacher"] = isTeacher(r);
  d["mqtt"] = mqttbridge::status();
  String s;
  serializeJson(d, s);
  sendJson(r, 200, s);
}

// ------------------------------------------------------------------ programme
static void handleProgramPost(AsyncWebServerRequest* r) {
  if (!allowed(r, PERM_PROGRAM)) return reply(r, false, "L'envoi de programmes est désactivé par l'enseignant", 403);
  if (!r->_tempObject) return reply(r, false, "Programme absent");
  bool start = !r->hasParam("start") || r->getParam("start")->value() != "0";
  bool save = !r->hasParam("save") || r->getParam("save")->value() != "0";
  std::string err;
  bool ok = programLoadFromJson(bodyOf(r), bodyLen(r), err, start, save);
  if (r->hasParam("autostart")) {
    Lock l;
    bool a = r->getParam("autostart")->value() == "1";
    if (a != g_cfg.progAutostart) {
      g_cfg.progAutostart = a;
      requestConfigSave();
    }
  }
  reply(r, ok, ok ? (start ? "Programme envoyé et démarré" : "Programme envoyé") : String("Programme refusé : ") + err.c_str());
}

static void handleProgramWsPost(AsyncWebServerRequest* r) {
  if (!allowed(r, PERM_PROGRAM)) return reply(r, false, "Interdit", 403);
  if (!r->_tempObject) return reply(r, false, "Vide");
  bool ok = storage::writeFile("/program_ws.json", (const uint8_t*)bodyOf(r), bodyLen(r));
  reply(r, ok, ok ? "" : "Impossible d'enregistrer les blocs");
}

static void handleProgramGet(AsyncWebServerRequest* r) {
  JsonDocument d;
  {
    Lock l;
    const vm::Machine& m = g_kit.machine;
    d["loaded"] = m.loaded();
    d["name"] = m.loaded() ? m.program().name.c_str() : "";
    d["hash"] = m.loaded() ? m.program().hash.c_str() : "";
    d["status"] = m.status();
    d["err"] = m.error().c_str();
    d["autostart"] = g_cfg.progAutostart;
  }
  d["saved"] = storage::exists("/program.json");
  d["hasBlocks"] = storage::exists("/program_ws.json");
  String s;
  serializeJson(d, s);
  sendJson(r, 200, s);
}

static void handleProgramCtl(AsyncWebServerRequest* r) {
  if (!allowed(r, PERM_PROGRAM)) return reply(r, false, "Interdit par l'enseignant", 403);
  JsonDocument doc;
  if (deserializeJson(doc, bodyOf(r))) return reply(r, false, "JSON invalide");
  const char* a = doc["action"] | "";
  Lock l;
  if (!strcmp(a, "start")) {
    if (!g_kit.machine.loaded()) return reply(r, false, "Aucun programme chargé");
    g_kit.startProgram(nowMs(), esp_random());
    return reply(r, true, "Programme démarré");
  }
  if (!strcmp(a, "stop")) {
    g_kit.stopProgram();
    return reply(r, true, "Programme arrêté");
  }
  if (!strcmp(a, "autostart")) {
    g_cfg.progAutostart = doc["value"] | false;
    requestConfigSave();
    return reply(r, true, g_cfg.progAutostart ? "Démarrage automatique activé" : "Démarrage automatique désactivé");
  }
  return reply(r, false, "Action inconnue");
}

// ------------------------------------------------------------------ historique & journaux
static void handleHistory(AsyncWebServerRequest* r) {
  auto data = std::make_shared<std::vector<ai::Sample>>();
  {
    Lock l;
    int n = g_kit.hist.count();
    int want = 600;
    if (r->hasParam("n")) want = r->getParam("n")->value().toInt();
    if (want < 1) want = 1;
    if (n > want) n = want;
    data->reserve(n);
    for (int i = n - 1; i >= 0; i--) data->push_back(g_kit.hist.at(i));
  }
  auto pos = std::make_shared<size_t>(0);
  auto hdr = std::make_shared<bool>(false);
  AsyncWebServerResponse* res = r->beginChunkedResponse(
      "text/csv", [data, pos, hdr](uint8_t* buf, size_t maxLen, size_t) -> size_t {
        size_t w = 0;
        if (!*hdr) {
          const char* h = "t,p1,p2,p3,p4,T,H,L,pr,r\n";
          size_t n = strlen(h);
          if (n > maxLen) return 0;
          memcpy(buf, h, n);
          w = n;
          *hdr = true;
        }
        while (*pos < data->size()) {
          const ai::Sample& s = (*data)[*pos];
          char line[128];
          char t[12], hh[12], ll[12];
          if (isnan(s.temp)) strcpy(t, "");
          else snprintf(t, sizeof t, "%.1f", s.temp);
          if (isnan(s.hum)) strcpy(hh, "");
          else snprintf(hh, sizeof hh, "%.1f", s.hum);
          if (isnan(s.lum)) strcpy(ll, "");
          else snprintf(ll, sizeof ll, "%.1f", s.lum);
          int n = snprintf(line, sizeof line, "%lu,%.1f,%.1f,%.1f,%.1f,%s,%s,%s,%u,%u\n", (unsigned long)s.t, s.p[0], s.p[1],
                           s.p[2], s.p[3], t, hh, ll, s.pres, s.relays);
          if (w + n > maxLen) break;
          memcpy(buf + w, line, n);
          w += n;
          (*pos)++;
        }
        return w;
      });
  res->addHeader("Cache-Control", "no-store");
  r->send(res);
}

static void handleLogs(AsyncWebServerRequest* r) {
  uint32_t since = 0;
  if (r->hasParam("since")) since = (uint32_t)r->getParam("since")->value().toInt();
  J j;
  j.s.reserve(2048);
  j.s = "[";
  {
    Lock l;
    for (int i = g_kit.logCount() - 1; i >= 0; i--) {
      const LogEntry* e = g_kit.logAt(i);
      if (!e || e->seq <= since) continue;
      j.s += '{';
      j.i("s", (long)e->seq);
      j.i("ts", (long)e->ts);
      j.i("l", e->level);
      j.str("m", e->msg);
      j.close('}');
    }
  }
  j.finish();
  j.s += "]";
  sendJson(r, 200, j.s);
}

static void handleDays(AsyncWebServerRequest* r) {
  J j;
  j.s = "[";
  {
    Lock l;
    DaySummary t = g_kit.today();
    for (int i = -1; i < g_kit.dayCount(); i++) {
      const DaySummary& d = i < 0 ? t : g_kit.day(i);
      j.s += '{';
      j.i("d", d.dayKey);
      j.open("e", '[');
      for (int k = 0; k < NOUT; k++) {
        j.val(d.eWh[k], 1);
        j.s += ',';
      }
      j.close(']');
      j.open("c", '[');
      for (int k = 0; k < NOUT; k++) {
        j.val(d.cost[k], 3);
        j.s += ',';
      }
      j.close(']');
      j.num("pk", d.peak, 0);
      j.close('}');
    }
  }
  j.finish();
  j.s += "]";
  sendJson(r, 200, j.s);
}

static void handleFiles(AsyncWebServerRequest* r) {
  String dir = r->hasParam("dir") ? r->getParam("dir")->value() : "log";
  if (dir != "log" && dir != "research") return reply(r, false, "Dossier inconnu");
  if (dir == "log") storage::dataLogFlush();
  String out;
  storage::listDir(("/" + dir).c_str(), out);
  sendJson(r, 200, out);
}

// ------------------------------------------------------------------ recherche
static void handleResearchEvents(AsyncWebServerRequest* r) {
  JsonDocument doc;
  if (deserializeJson(doc, bodyOf(r))) return reply(r, false, "JSON invalide");
  JsonArrayConst arr = doc.as<JsonArrayConst>();
  if (arr.isNull()) return reply(r, false, "Tableau attendu");
  if (!storage::exists("/research/events.csv"))
    storage::appendLine("/research/events.csv", "horodatage,apprenant,groupe,condition,appareil,type,detail\n", 600000);
  String lines;
  for (JsonObjectConst e : arr) {
    lines += csvVal(e["ts"]);
    lines += ',';
    lines += csvVal(e["learner"]);
    lines += ',';
    lines += csvVal(e["group"]);
    lines += ',';
    lines += csvVal(e["cond"]);
    lines += ',';
    lines += csvVal(e["device"]);
    lines += ',';
    lines += csvVal(e["type"]);
    lines += ',';
    lines += csvVal(e["detail"]);
    lines += '\n';
  }
  bool ok = storage::appendLine("/research/events.csv", lines, 600000);
  reply(r, ok, ok ? "" : "Écriture impossible");
}

static void handleResearchResult(AsyncWebServerRequest* r) {
  JsonDocument doc;
  if (deserializeJson(doc, bodyOf(r))) return reply(r, false, "JSON invalide");
  if (!storage::exists("/research/results.csv"))
    storage::appendLine("/research/results.csv",
                        "horodatage,apprenant,groupe,condition,instrument,score,max,duree_s,reponses\n", 600000);
  String line;
  line += csvVal(doc["ts"]);
  line += ',';
  line += csvVal(doc["learner"]);
  line += ',';
  line += csvVal(doc["group"]);
  line += ',';
  line += csvVal(doc["cond"]);
  line += ',';
  line += csvVal(doc["kind"]);
  line += ',';
  line += csvVal(doc["score"]);
  line += ',';
  line += csvVal(doc["max"]);
  line += ',';
  line += csvVal(doc["duration"]);
  line += ',';
  line += csvVal(doc["answers"]);
  line += '\n';
  bool ok = storage::appendLine("/research/results.csv", line, 600000);
  reply(r, ok, ok ? "Résultat enregistré sur le kit" : "Écriture impossible");
}

// ------------------------------------------------------------------ IA (k-NN)
static void handleKnnGet(AsyncWebServerRequest* r) {
  J j;
  j.s.reserve(1500);
  j.s = "{";
  {
    Lock l;
    j.i("k", g_cfg.knnK);
    j.num("maxDist", g_cfg.knnMaxDist, 2);
    j.i("seq", (long)s_knnSeq);
    j.open("labels", '[');
    for (auto& lb : g_kit.knn.labels) {
      int n = 0;
      for (auto& s : g_kit.knn.samples)
        if (s.label == lb.id) n++;
      j.s += '{';
      j.i("id", lb.id);
      j.str("name", lb.name.c_str());
      j.i("n", n);
      j.close('}');
    }
    j.close(']');
    j.open("samples", '[');
    for (auto& s : g_kit.knn.samples) {
      j.s += '[';
      j.s += String(s.label);
      j.s += ',';
      j.val(s.p, 2);
      j.s += ',';
      j.val(s.pf, 3);
      j.s += "],";
    }
    j.close(']');
  }
  j.finish();
  j.s += "}";
  sendJson(r, 200, j.s);
}

static void handleKnnPost(AsyncWebServerRequest* r) {
  if (!allowed(r, PERM_KNN)) return reply(r, false, "L'entraînement de l'IA est désactivé par l'enseignant", 403);
  JsonDocument doc;
  if (deserializeJson(doc, bodyOf(r))) return reply(r, false, "JSON invalide");
  const char* op = doc["op"] | "";
  Lock l;
  std::string msg;
  bool ok = false;
  if (!strcmp(op, "train")) {
    ok = g_kit.knnTrain((doc["outlet"] | 1) - 1, doc["label"] | "", msg);
  } else if (!strcmp(op, "add")) {
    const char* label = doc["label"] | "";
    double p = doc["p"] | NAN, pf = doc["pf"] | NAN;
    if (!label[0] || isnan(p) || isnan(pf) || p < 1) msg = "exemple invalide";
    else {
      int id = g_kit.knn.labelId(label, true);
      if (id < 0) msg = "trop d'appareils différents";
      else if ((int)g_kit.knn.samples.size() >= ai::Knn::MAX_SAMPLES) msg = "mémoire d'exemples pleine";
      else {
        g_kit.knn.samples.push_back({id, (float)p, (float)pf});
        ok = true;
        msg = "exemple ajouté";
      }
    }
  } else if (!strcmp(op, "delete")) {
    g_kit.knn.removeLabel(doc["id"] | -1);
    ok = true;
    msg = "appareil oublié";
  } else {
    msg = "opération inconnue";
  }
  if (ok) {
    storage::saveKnn(g_kit.knn);
    s_knnSeq++;
  }
  reply(r, ok, msg.c_str());
}

static void handlePzem(AsyncWebServerRequest* r) {
  measure::BusStats st;
  measure::stats(st);
  J j;
  j.s = "{";
  {
    Lock l;
    j.b("busy", g_pzemTool.busy);
    j.str("msg", g_pzemTool.msg);
    j.i("seq", (long)g_pzemTool.seq);
    j.open("found", '[');
    for (int i = 0; i < g_pzemTool.nFound; i++) {
      j.s += String(g_pzemTool.found[i]);
      j.s += ',';
    }
    j.close(']');
    j.open("alarm", '[');
    for (int k = 0; k < 4; k++) {
      j.s += String(g_pzemTool.alarm[k]);
      j.s += ',';
    }
    j.close(']');
  }
  j.open("stats", '[');
  for (int k = 0; k < 4; k++) {
    j.s += '{';
    j.i("ok", (long)st.ok[k]);
    j.i("err", (long)st.err[k]);
    j.i("le", st.lastErr[k]);
    j.close('}');
  }
  j.close(']');
  j.finish();
  j.s += "}";
  sendJson(r, 200, j.s);
}

// ------------------------------------------------------------------ fichiers statiques
static void serveAsset(AsyncWebServerRequest* r, const WebAsset& a) {
  if (r->hasHeader("If-None-Match") && r->header("If-None-Match") == a.etag) {
    r->send(304);
    return;
  }
  AsyncWebServerResponse* res = r->beginResponse(200, a.mime, a.data, a.len);
  res->addHeader("Content-Encoding", "gzip");
  res->addHeader("Cache-Control", "no-cache");
  res->addHeader("ETag", a.etag);
  r->send(res);
}

static bool isOwnHost(const String& host) {
  if (host.length() == 0) return true;
  String h = host;
  int colon = h.indexOf(':');
  if (colon >= 0) h = h.substring(0, colon);
  if (h == "192.168.4.1" || h == "energie.lab") return true;
  if (net::staConnected() && h == net::staIp()) return true;
  String hn;
  {
    Lock l;
    hn = g_cfg.hostname;
  }
  return h == hn || h == hn + ".local";
}

static void onWsEvent(AsyncWebSocket*, AsyncWebSocketClient* client, AwsEventType type, void*, uint8_t*, size_t) {
  if (type == WS_EVT_CONNECT) {
    client->text(stateCopy());
  }
}

void begin() {
  s_stateMtx = xSemaphoreCreateMutex();
  ws.onEvent(onWsEvent);
  server.addHandler(&ws);

  for (size_t i = 0; i < WEB_ASSET_COUNT; i++) {
    const WebAsset* a = &WEB_ASSETS[i];
    server.on(a->path, HTTP_GET, [a](AsyncWebServerRequest* r) { serveAsset(r, *a); });
    if (!strcmp(a->path, "/index.html")) {
      server.on("/", HTTP_GET, [a](AsyncWebServerRequest* r) { serveAsset(r, *a); });
    }
  }

  server.on("/api/ping", HTTP_GET, [](AsyncWebServerRequest* r) { r->send(200, "text/plain", "ok"); });
  server.on("/api/info", HTTP_GET, handleInfo);
  server.on("/api/state", HTTP_GET, [](AsyncWebServerRequest* r) { sendJson(r, 200, stateCopy()); });
  server.on("/api/config", HTTP_GET, handleConfigGet);
  server.on("/api/config", HTTP_POST, handleConfigPost, nullptr, bodyCollector);
  server.on("/api/cmd", HTTP_POST, handleCmd, nullptr, bodyCollector);
  server.on("/api/program", HTTP_GET, handleProgramGet);
  server.on("/api/program", HTTP_POST, handleProgramPost, nullptr, bodyCollector);
  server.on("/api/program/ws", HTTP_POST, handleProgramWsPost, nullptr, bodyCollector);
  server.on("/api/program/ws", HTTP_GET, [](AsyncWebServerRequest* r) {
    if (!storage::exists("/program_ws.json")) return reply(r, false, "Aucun bloc enregistré", 404);
    r->send(LittleFS, "/program_ws.json", "application/json");
  });
  server.on("/api/program/bc", HTTP_GET, [](AsyncWebServerRequest* r) {
    if (!storage::exists("/program.json")) return reply(r, false, "Aucun programme enregistré", 404);
    r->send(LittleFS, "/program.json", "application/json");
  });
  server.on("/api/program/ctl", HTTP_POST, handleProgramCtl, nullptr, bodyCollector);
  server.on("/api/history", HTTP_GET, handleHistory);
  server.on("/api/logs", HTTP_GET, handleLogs);
  server.on("/api/days", HTTP_GET, handleDays);
  server.on("/api/files", HTTP_GET, handleFiles);
  server.on("/api/research/events", HTTP_POST, handleResearchEvents, nullptr, bodyCollector);
  server.on("/api/research/result", HTTP_POST, handleResearchResult, nullptr, bodyCollector);
  server.on("/api/knn", HTTP_GET, handleKnnGet);
  server.on("/api/knn", HTTP_POST, handleKnnPost, nullptr, bodyCollector);
  server.on("/api/pzem", HTTP_GET, handlePzem);
  server.serveStatic("/files/log/", LittleFS, "/log/").setCacheControl("no-store");
  server.serveStatic("/files/research/", LittleFS, "/research/").setCacheControl("no-store");

  server.onNotFound([](AsyncWebServerRequest* r) {
    if (r->method() == HTTP_OPTIONS) {
      r->send(204);
      return;
    }
    if (net::apActive() && !isOwnHost(r->host())) {
      // portail captif : les téléphones affichent directement l'application
      r->redirect("http://192.168.4.1/?portal=1");
      return;
    }
    if (r->url().startsWith("/api/")) {
      reply(r, false, "Ressource inconnue", 404);
      return;
    }
    r->redirect("/");
  });
  server.begin();
}

}  // namespace webapi

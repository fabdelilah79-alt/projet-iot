// EnergyLab - configuration du kit
#include "config.h"

#include <math.h>
#include <stdio.h>
#include <string.h>

static const char* MASK = "********";

static void copyStr(char* dst, size_t size, const char* src) {
  if (!src) src = "";
  size_t n = strlen(src);
  if (n >= size) n = size - 1;
  // ne pas couper un caractère UTF-8 multi-octets
  while (n > 0 && ((unsigned char)src[n] & 0xC0) == 0x80) n--;
  memcpy(dst, src, n);
  dst[n] = 0;
}

static float clampf(double v, double lo, double hi) {
  if (isnan(v)) return (float)lo;
  return (float)(v < lo ? lo : (v > hi ? hi : v));
}

void configDefaults(Config& c, const char* kitId) {
  memset(&c, 0, sizeof(c));
  static const char* names[NOUT] = {"Salon", "Cuisine", "Chambre", "Bureau"};
  static const char* icons[NOUT] = {"lamp", "kettle", "heater", "laptop"};
  static const uint8_t prio[NOUT] = {2, 1, 4, 3};
  for (int k = 0; k < NOUT; k++) {
    OutletConfig& o = c.out[k];
    copyStr(o.name, sizeof o.name, names[k]);
    copyStr(o.icon, sizeof o.icon, icons[k]);
    o.enabled = true;
    o.maxPower = 2000;
    o.pzemAlarm = 2300;
    o.priority = prio[k];
    o.bootState = 0;
    o.minSwitchS = 2;
    o.standbyW = 3;
    o.ctTurns = 1;
    o.calU = 1;
    o.calI = 1;
  }
  c.wifiMode = 0;
  char ap[33];
  snprintf(ap, sizeof ap, "EnergyLab-%s", kitId ? kitId : "0000");
  copyStr(c.apSsid, sizeof c.apSsid, ap);
  copyStr(c.apPass, sizeof c.apPass, "energie123");
  c.apAlways = true;
  copyStr(c.hostname, sizeof c.hostname, "energylab");
  c.tzMin = 60;
  c.tzAuto = true;
  copyStr(c.kitName, sizeof c.kitName, "Kit EnergyLab");
  c.priceHP = 1.20f;
  c.priceHC = 0.90f;
  c.hpHc = false;
  c.hcStart = 22 * 60;
  c.hcEnd = 6 * 60;
  copyStr(c.currency, sizeof c.currency, "DH");
  c.co2 = 600;
  c.contractW = 3000;
  c.sampleMs = 1000;
  c.smoothN = 1;
  c.tempSet = 20;
  c.tempHyst = 0.5f;
  c.lightThr = 30;
  c.presenceS = 60;
  c.dhtOn = c.ldrOn = c.pirOn = true;
  c.ldrInvert = false;
  c.oledType = 0;
  c.buzzerOn = true;
  c.relayActiveLow = true;
  c.maxTotalW = 2300;
  c.hardMaxOutletW = 2300;
  c.minSwitchFloorS = 1;
  c.anomalyZ = 4;
  c.knnK = 3;
  c.knnMaxDist = 3;
  copyStr(c.pin, sizeof c.pin, "1234");
  c.perms = PERM_RELAY | PERM_PARAMS | PERM_PROGRAM | PERM_KNN | PERM_REARM;
  c.scaffold = 1;
  c.progAutostart = false;
  c.mqttOn = false;
  c.mqttPort = 1883;
  copyStr(c.mqttBase, sizeof c.mqttBase, "energylab");
}

static const char* secret(const char* s, bool withSecrets) {
  if (withSecrets) return s;
  return s[0] ? MASK : "";
}

void configToJson(const Config& c, JsonObject o, bool withSecrets) {
  o["kitName"] = c.kitName;
  JsonArray outs = o["outlets"].to<JsonArray>();
  for (int k = 0; k < NOUT; k++) {
    const OutletConfig& x = c.out[k];
    JsonObject j = outs.add<JsonObject>();
    j["name"] = x.name;
    j["icon"] = x.icon;
    j["enabled"] = x.enabled;
    j["maxPower"] = x.maxPower;
    j["pzemAlarm"] = x.pzemAlarm;
    j["priority"] = x.priority;
    j["bootState"] = x.bootState;
    j["minSwitchS"] = x.minSwitchS;
    j["standbyW"] = x.standbyW;
    j["ctTurns"] = x.ctTurns;
    j["calU"] = x.calU;
    j["calI"] = x.calI;
  }
  JsonObject n = o["net"].to<JsonObject>();
  n["wifiMode"] = c.wifiMode;
  n["staSsid"] = c.staSsid;
  n["staPass"] = secret(c.staPass, withSecrets);
  n["apSsid"] = c.apSsid;
  n["apPass"] = secret(c.apPass, withSecrets);
  n["apAlways"] = c.apAlways;
  n["hostname"] = c.hostname;
  n["tzMin"] = c.tzMin;
  n["tzAuto"] = c.tzAuto;
  JsonObject t = o["tariff"].to<JsonObject>();
  t["priceHP"] = c.priceHP;
  t["priceHC"] = c.priceHC;
  t["hpHc"] = c.hpHc;
  t["hcStart"] = c.hcStart;
  t["hcEnd"] = c.hcEnd;
  t["currency"] = c.currency;
  t["co2"] = c.co2;
  t["contractW"] = c.contractW;
  JsonObject m = o["measure"].to<JsonObject>();
  m["sampleMs"] = c.sampleMs;
  m["smoothN"] = c.smoothN;
  JsonObject e = o["env"].to<JsonObject>();
  e["tempSet"] = c.tempSet;
  e["tempHyst"] = c.tempHyst;
  e["lightThr"] = c.lightThr;
  e["presenceS"] = c.presenceS;
  e["dhtOn"] = c.dhtOn;
  e["ldrOn"] = c.ldrOn;
  e["pirOn"] = c.pirOn;
  e["ldrInvert"] = c.ldrInvert;
  JsonObject h = o["hw"].to<JsonObject>();
  h["oledType"] = c.oledType;
  h["buzzerOn"] = c.buzzerOn;
  h["relayActiveLow"] = c.relayActiveLow;
  JsonObject s = o["safety"].to<JsonObject>();
  s["maxTotalW"] = c.maxTotalW;
  s["hardMaxOutletW"] = c.hardMaxOutletW;
  s["minSwitchFloorS"] = c.minSwitchFloorS;
  JsonObject a = o["ai"].to<JsonObject>();
  a["anomalyZ"] = c.anomalyZ;
  a["knnK"] = c.knnK;
  a["knnMaxDist"] = c.knnMaxDist;
  JsonObject p = o["peda"].to<JsonObject>();
  p["pin"] = secret(c.pin, withSecrets);
  p["perms"] = c.perms;
  p["scaffold"] = c.scaffold;
  p["progAutostart"] = c.progAutostart;
  JsonObject q = o["mqtt"].to<JsonObject>();
  q["on"] = c.mqttOn;
  q["host"] = c.mqttHost;
  q["port"] = c.mqttPort;
  q["user"] = c.mqttUser;
  q["pass"] = secret(c.mqttPass, withSecrets);
  q["base"] = c.mqttBase;
}

// --- aides pour les mises à jour partielles
static bool getF(JsonObjectConst o, const char* k, float& dst, double lo, double hi) {
  JsonVariantConst v = o[k];
  if (v.isNull() || !(v.is<float>() || v.is<int>() || v.is<double>())) return false;
  float nv = clampf(v.as<double>(), lo, hi);
  if (nv == dst) return false;
  dst = nv;
  return true;
}
template <typename T>
static bool getI(JsonObjectConst o, const char* k, T& dst, long lo, long hi) {
  JsonVariantConst v = o[k];
  if (v.isNull() || !(v.is<int>() || v.is<long>() || v.is<float>() || v.is<double>())) return false;
  double d = v.as<double>();
  if (isnan(d)) return false;
  long x = lround(d);
  if (x < lo) x = lo;
  if (x > hi) x = hi;
  if ((T)x == dst) return false;
  dst = (T)x;
  return true;
}
static bool getB(JsonObjectConst o, const char* k, bool& dst) {
  JsonVariantConst v = o[k];
  if (v.isNull() || !v.is<bool>()) return false;
  bool b = v.as<bool>();
  if (b == dst) return false;
  dst = b;
  return true;
}
static bool getS(JsonObjectConst o, const char* k, char* dst, size_t size, bool isSecret = false) {
  JsonVariantConst v = o[k];
  if (v.isNull() || !v.is<const char*>()) return false;
  const char* s = v.as<const char*>();
  if (isSecret && strcmp(s, MASK) == 0) return false;
  if (strcmp(s, dst) == 0) return false;
  copyStr(dst, size, s);
  return true;
}

uint32_t configFromJson(Config& c, JsonObjectConst o) {
  uint32_t chg = CHG_NONE;
  if (getS(o, "kitName", c.kitName, sizeof c.kitName)) chg |= CHG_OTHER;
  JsonArrayConst outs = o["outlets"];
  if (!outs.isNull()) {
    int k = 0;
    for (JsonVariantConst jv : outs) {
      if (k >= NOUT) break;
      JsonObjectConst j = jv.as<JsonObjectConst>();
      if (!j.isNull()) {
        OutletConfig& x = c.out[k];
        bool ch = false;
        ch |= getS(j, "name", x.name, sizeof x.name);
        ch |= getS(j, "icon", x.icon, sizeof x.icon);
        ch |= getB(j, "enabled", x.enabled);
        ch |= getF(j, "maxPower", x.maxPower, 10, c.hardMaxOutletW);
        if (getI(j, "pzemAlarm", x.pzemAlarm, 1, 23000)) chg |= CHG_ALARM;
        ch |= getI(j, "priority", x.priority, 1, 4);
        ch |= getI(j, "bootState", x.bootState, 0, 2);
        ch |= getF(j, "minSwitchS", x.minSwitchS, c.minSwitchFloorS, 600);
        ch |= getF(j, "standbyW", x.standbyW, 0, 200);
        ch |= getI(j, "ctTurns", x.ctTurns, 1, 10);
        ch |= getF(j, "calU", x.calU, 0.5, 1.5);
        ch |= getF(j, "calI", x.calI, 0.5, 1.5);
        if (ch) chg |= CHG_OUTLET;
      }
      k++;
    }
  }
  JsonObjectConst n = o["net"];
  if (!n.isNull()) {
    bool ch = false;
    ch |= getI(n, "wifiMode", c.wifiMode, 0, 1);
    ch |= getS(n, "staSsid", c.staSsid, sizeof c.staSsid);
    ch |= getS(n, "staPass", c.staPass, sizeof c.staPass, true);
    ch |= getS(n, "apSsid", c.apSsid, sizeof c.apSsid);
    JsonVariantConst ap = n["apPass"];
    if (ap.is<const char*>()) {
      const char* s = ap.as<const char*>();
      size_t len = strlen(s);
      // WPA2 : 8 à 63 caractères (ou vide = réseau ouvert)
      if (strcmp(s, MASK) != 0 && (len == 0 || (len >= 8 && len <= 63))) ch |= getS(n, "apPass", c.apPass, sizeof c.apPass, true);
    }
    ch |= getB(n, "apAlways", c.apAlways);
    ch |= getS(n, "hostname", c.hostname, sizeof c.hostname);
    if (ch) chg |= CHG_NET;
    if (getI(n, "tzMin", c.tzMin, -720, 840)) chg |= CHG_OTHER;
    if (getB(n, "tzAuto", c.tzAuto)) chg |= CHG_OTHER;
  }
  JsonObjectConst t = o["tariff"];
  if (!t.isNull()) {
    bool ch = false;
    ch |= getF(t, "priceHP", c.priceHP, 0, 100);
    ch |= getF(t, "priceHC", c.priceHC, 0, 100);
    ch |= getB(t, "hpHc", c.hpHc);
    ch |= getI(t, "hcStart", c.hcStart, 0, 1439);
    ch |= getI(t, "hcEnd", c.hcEnd, 0, 1439);
    ch |= getS(t, "currency", c.currency, sizeof c.currency);
    ch |= getF(t, "co2", c.co2, 0, 2000);
    ch |= getF(t, "contractW", c.contractW, 100, 12000);
    if (ch) chg |= CHG_OTHER;
  }
  JsonObjectConst m = o["measure"];
  if (!m.isNull()) {
    bool ch = false;
    ch |= getI(m, "sampleMs", c.sampleMs, 1000, 10000);
    ch |= getI(m, "smoothN", c.smoothN, 1, 10);
    if (ch) chg |= CHG_OTHER;
  }
  JsonObjectConst e = o["env"];
  if (!e.isNull()) {
    bool ch = false;
    ch |= getF(e, "tempSet", c.tempSet, 5, 35);
    ch |= getF(e, "tempHyst", c.tempHyst, 0.1, 5);
    ch |= getF(e, "lightThr", c.lightThr, 0, 100);
    ch |= getI(e, "presenceS", c.presenceS, 5, 3600);
    ch |= getB(e, "dhtOn", c.dhtOn);
    ch |= getB(e, "ldrOn", c.ldrOn);
    ch |= getB(e, "pirOn", c.pirOn);
    ch |= getB(e, "ldrInvert", c.ldrInvert);
    if (ch) chg |= CHG_OTHER;
  }
  JsonObjectConst h = o["hw"];
  if (!h.isNull()) {
    bool ch = false;
    ch |= getI(h, "oledType", c.oledType, 0, 2);
    ch |= getB(h, "buzzerOn", c.buzzerOn);
    ch |= getB(h, "relayActiveLow", c.relayActiveLow);
    if (ch) chg |= CHG_OTHER;
  }
  JsonObjectConst s = o["safety"];
  if (!s.isNull()) {
    bool ch = false;
    ch |= getF(s, "maxTotalW", c.maxTotalW, 100, 3680);
    ch |= getF(s, "hardMaxOutletW", c.hardMaxOutletW, 10, 3680);
    ch |= getF(s, "minSwitchFloorS", c.minSwitchFloorS, 0.5, 60);
    if (ch) {
      chg |= CHG_OTHER;
      for (int k = 0; k < NOUT; k++) {
        if (c.out[k].maxPower > c.hardMaxOutletW) c.out[k].maxPower = c.hardMaxOutletW;
        if (c.out[k].minSwitchS < c.minSwitchFloorS) c.out[k].minSwitchS = c.minSwitchFloorS;
      }
    }
  }
  JsonObjectConst a = o["ai"];
  if (!a.isNull()) {
    bool ch = false;
    ch |= getF(a, "anomalyZ", c.anomalyZ, 2, 10);
    ch |= getI(a, "knnK", c.knnK, 1, 7);
    ch |= getF(a, "knnMaxDist", c.knnMaxDist, 0.5, 20);
    if (ch) chg |= CHG_OTHER;
  }
  JsonObjectConst p = o["peda"];
  if (!p.isNull()) {
    bool ch = false;
    JsonVariantConst pin = p["pin"];
    if (pin.is<const char*>()) {
      const char* s2 = pin.as<const char*>();
      size_t len = strlen(s2);
      if (strcmp(s2, MASK) != 0 && len >= 4 && len <= 8) ch |= getS(p, "pin", c.pin, sizeof c.pin, true);
    }
    ch |= getI(p, "perms", c.perms, 0, 63);
    ch |= getI(p, "scaffold", c.scaffold, 0, 2);
    ch |= getB(p, "progAutostart", c.progAutostart);
    if (ch) chg |= CHG_OTHER;
  }
  JsonObjectConst q = o["mqtt"];
  if (!q.isNull()) {
    bool ch = false;
    ch |= getB(q, "on", c.mqttOn);
    ch |= getS(q, "host", c.mqttHost, sizeof c.mqttHost);
    ch |= getI(q, "port", c.mqttPort, 1, 65535);
    ch |= getS(q, "user", c.mqttUser, sizeof c.mqttUser);
    ch |= getS(q, "pass", c.mqttPass, sizeof c.mqttPass, true);
    ch |= getS(q, "base", c.mqttBase, sizeof c.mqttBase);
    if (ch) chg |= CHG_MQTT;
  }
  return chg;
}

// ------------------------------------------------------------------ paramètres
bool paramValid(int p) { return (p >= 0 && p <= 5) || (p >= 10 && p <= 23); }
bool paramIsOutlet(int p) { return p >= 0 && p <= 5; }

const char* paramName(int p) {
  switch (p) {
    case 0: return "puissance max";
    case 1: return "seuil d'alarme du capteur";
    case 2: return "priorité";
    case 3: return "état au démarrage";
    case 4: return "délai entre commutations";
    case 5: return "seuil de veille";
    case 10: return "période de mesure";
    case 11: return "lissage";
    case 12: return "puissance souscrite";
    case 13: return "prix heures pleines";
    case 14: return "prix heures creuses";
    case 15: return "consigne de température";
    case 16: return "hystérésis";
    case 17: return "seuil de luminosité";
    case 18: return "délai de présence";
    case 19: return "facteur CO2";
    case 20: return "seuil d'anomalie";
    case 21: return "k (k-NN)";
    case 22: return "début heures creuses";
    case 23: return "fin heures creuses";
    default: return "?";
  }
}

double paramGet(const Config& c, int p, int idx) {
  if (paramIsOutlet(p)) {
    if (idx < 1 || idx > NOUT) return NAN;
    const OutletConfig& o = c.out[idx - 1];
    switch (p) {
      case 0: return o.maxPower;
      case 1: return o.pzemAlarm;
      case 2: return o.priority;
      case 3: return o.bootState;
      case 4: return o.minSwitchS;
      case 5: return o.standbyW;
    }
    return NAN;
  }
  switch (p) {
    case 10: return c.sampleMs;
    case 11: return c.smoothN;
    case 12: return c.contractW;
    case 13: return c.priceHP;
    case 14: return c.priceHC;
    case 15: return c.tempSet;
    case 16: return c.tempHyst;
    case 17: return c.lightThr;
    case 18: return c.presenceS;
    case 19: return c.co2;
    case 20: return c.anomalyZ;
    case 21: return c.knnK;
    case 22: return c.hcStart;
    case 23: return c.hcEnd;
  }
  return NAN;
}

static void bounds(const Config& c, int p, double& lo, double& hi, bool& integer) {
  integer = false;
  switch (p) {
    case 0: lo = 10; hi = c.hardMaxOutletW; break;
    case 1: lo = 1; hi = 23000; integer = true; break;
    case 2: lo = 1; hi = 4; integer = true; break;
    case 3: lo = 0; hi = 2; integer = true; break;
    case 4: lo = c.minSwitchFloorS; hi = 600; break;
    case 5: lo = 0; hi = 200; break;
    case 10: lo = 1000; hi = 10000; integer = true; break;
    case 11: lo = 1; hi = 10; integer = true; break;
    case 12: lo = 100; hi = 12000; break;
    case 13: case 14: lo = 0; hi = 100; break;
    case 15: lo = 5; hi = 35; break;
    case 16: lo = 0.1; hi = 5; break;
    case 17: lo = 0; hi = 100; break;
    case 18: lo = 5; hi = 3600; integer = true; break;
    case 19: lo = 0; hi = 2000; break;
    case 20: lo = 2; hi = 10; break;
    case 21: lo = 1; hi = 7; integer = true; break;
    case 22: case 23: lo = 0; hi = 1439; integer = true; break;
    default: lo = 0; hi = 0; break;
  }
}

bool paramSet(Config& c, int p, int idx, double v, double& applied, std::string& msg) {
  msg.clear();
  if (!paramValid(p)) { msg = "paramètre inconnu"; return false; }
  if (paramIsOutlet(p) && (idx < 1 || idx > NOUT)) { msg = "numéro de prise invalide"; return false; }
  if (isnan(v)) { msg = "valeur invalide"; return false; }
  double lo, hi;
  bool integer;
  bounds(c, p, lo, hi, integer);
  double x = v;
  if (integer) x = floor(x + 0.5);
  if (x < lo) x = lo;
  if (x > hi) x = hi;
  if (x != v) {
    char b[96];
    snprintf(b, sizeof b, "valeur ajustée à %g (limites %g … %g)", x, lo, hi);
    msg = b;
  }
  applied = x;
  if (paramIsOutlet(p)) {
    OutletConfig& o = c.out[idx - 1];
    switch (p) {
      case 0: o.maxPower = (float)x; break;
      case 1: o.pzemAlarm = (uint16_t)x; break;
      case 2: o.priority = (uint8_t)x; break;
      case 3: o.bootState = (uint8_t)x; break;
      case 4: o.minSwitchS = (float)x; break;
      case 5: o.standbyW = (float)x; break;
    }
    return true;
  }
  switch (p) {
    case 10: c.sampleMs = (uint16_t)x; break;
    case 11: c.smoothN = (uint8_t)x; break;
    case 12: c.contractW = (float)x; break;
    case 13: c.priceHP = (float)x; break;
    case 14: c.priceHC = (float)x; break;
    case 15: c.tempSet = (float)x; break;
    case 16: c.tempHyst = (float)x; break;
    case 17: c.lightThr = (float)x; break;
    case 18: c.presenceS = (uint16_t)x; break;
    case 19: c.co2 = (float)x; break;
    case 20: c.anomalyZ = (float)x; break;
    case 21: c.knnK = (uint8_t)x; break;
    case 22: c.hcStart = (uint16_t)x; break;
    case 23: c.hcEnd = (uint16_t)x; break;
  }
  return true;
}

bool isOffPeak(const Config& c, int mod) {
  if (!c.hpHc || c.hcStart == c.hcEnd) return false;
  if (c.hcStart < c.hcEnd) return mod >= c.hcStart && mod < c.hcEnd;
  return mod >= c.hcStart || mod < c.hcEnd;
}

double priceAt(const Config& c, int mod, bool timeValid) {
  if (timeValid && isOffPeak(c, mod)) return c.priceHC;
  return c.priceHP;
}

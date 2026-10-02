// EnergyLab - persistance (voir storage.h)
#include "storage.h"

#include <ArduinoJson.h>
#include <LittleFS.h>
#include <Preferences.h>

#include <algorithm>
#include <vector>

namespace storage {

static Preferences prefs;
static bool fsOk = false;
static String pendingLines;
static String pendingFile;

static bool nvsOpen() { return prefs.begin("elab", false); }

bool begin() {
  fsOk = LittleFS.begin(true, "/littlefs", 10, "spiffs");
  if (fsOk) {
    if (!LittleFS.exists("/log")) LittleFS.mkdir("/log");
    if (!LittleFS.exists("/research")) LittleFS.mkdir("/research");
  }
  return fsOk;
}

bool loadConfig(Config& c) {
  if (!nvsOpen()) return false;
  String s = prefs.getString("cfg", "");
  prefs.end();
  if (s.length() == 0) return false;
  JsonDocument doc;
  if (deserializeJson(doc, s)) return false;
  configFromJson(c, doc.as<JsonObjectConst>());
  return true;
}

void saveConfig(const Config& c) {
  JsonDocument doc;
  configToJson(c, doc.to<JsonObject>(), true);
  String s;
  serializeJson(doc, s);
  if (!nvsOpen()) return;
  prefs.putString("cfg", s);
  prefs.end();
}

uint8_t loadRelayMask() {
  if (!nvsOpen()) return 0;
  uint8_t m = prefs.getUChar("relays", 0);
  prefs.end();
  return m;
}

void saveRelayMask(uint8_t m) {
  if (!nvsOpen()) return;
  if (prefs.getUChar("relays", 0xFF) != m) prefs.putUChar("relays", m);
  prefs.end();
}

bool loadToday(DaySummary& d) {
  if (!nvsOpen()) return false;
  size_t n = prefs.getBytes("today", &d, sizeof d);
  prefs.end();
  return n == sizeof d;
}

void saveToday(const DaySummary& d) {
  if (!nvsOpen()) return;
  prefs.putBytes("today", &d, sizeof d);
  prefs.end();
}

int loadDays(DaySummary* arr, int max) {
  if (!nvsOpen()) return 0;
  size_t len = prefs.getBytesLength("days");
  int n = (int)(len / sizeof(DaySummary));
  if (n > max) n = max;
  if (n > 0) prefs.getBytes("days", arr, n * sizeof(DaySummary));
  prefs.end();
  return n;
}

void saveDays(const KitCore& kit) {
  DaySummary arr[7];
  int n = kit.dayCount();
  for (int i = 0; i < n; i++) arr[i] = kit.day(i);
  if (!nvsOpen()) return;
  if (n > 0) prefs.putBytes("days", arr, n * sizeof(DaySummary));
  else prefs.remove("days");
  prefs.end();
}

void loadKnn(ai::Knn& knn) {
  if (!nvsOpen()) return;
  String s = prefs.getString("knn", "");
  prefs.end();
  if (s.length() == 0) return;
  JsonDocument doc;
  if (deserializeJson(doc, s)) return;
  knn.labels.clear();
  knn.samples.clear();
  for (JsonArrayConst l : doc["labels"].as<JsonArrayConst>()) {
    if (l.size() < 2) continue;
    knn.labels.push_back({l[0].as<int>(), std::string(l[1].as<const char*>() ? l[1].as<const char*>() : "")});
  }
  for (JsonArrayConst x : doc["samples"].as<JsonArrayConst>()) {
    if (x.size() < 3) continue;
    knn.samples.push_back({x[0].as<int>(), x[1].as<float>(), x[2].as<float>()});
  }
}

void saveKnn(const ai::Knn& knn) {
  JsonDocument doc;
  JsonArray labels = doc["labels"].to<JsonArray>();
  for (const auto& l : knn.labels) {
    JsonArray a = labels.add<JsonArray>();
    a.add(l.id);
    a.add(l.name.c_str());
  }
  JsonArray samples = doc["samples"].to<JsonArray>();
  for (const auto& x : knn.samples) {
    JsonArray a = samples.add<JsonArray>();
    a.add(x.label);
    a.add(x.p);
    a.add(x.pf);
  }
  String s;
  serializeJson(doc, s);
  if (!nvsOpen()) return;
  prefs.putString("knn", s);
  prefs.end();
}

uint32_t bootCount() {
  if (!nvsOpen()) return 0;
  uint32_t n = prefs.getUInt("boots", 0) + 1;
  prefs.putUInt("boots", n);
  prefs.end();
  return n;
}

void factoryReset() {
  if (nvsOpen()) {
    prefs.clear();
    prefs.end();
  }
  if (fsOk) {
    clearDir("/log");
    clearDir("/research");
    LittleFS.remove("/program.json");
    LittleFS.remove("/program_ws.json");
  }
}

bool writeFile(const char* path, const uint8_t* data, size_t len) {
  if (!fsOk) return false;
  File f = LittleFS.open(path, "w");
  if (!f) return false;
  size_t w = f.write(data, len);
  f.close();
  return w == len;
}

String readFile(const char* path, size_t maxLen) {
  String s;
  if (!fsOk) return s;
  File f = LittleFS.open(path, "r");
  if (!f) return s;
  size_t n = f.size();
  if (n > maxLen) n = maxLen;
  s.reserve(n + 1);
  while (f.available() && s.length() < n) {
    char buf[256];
    size_t r = f.readBytes(buf, sizeof buf);
    if (r == 0) break;
    s.concat(buf, r);
  }
  f.close();
  return s;
}

bool exists(const char* path) { return fsOk && LittleFS.exists(path); }

void remove(const char* path) {
  if (fsOk && LittleFS.exists(path)) LittleFS.remove(path);
}

bool appendLine(const char* path, const String& line, size_t maxSize) {
  if (!fsOk) return false;
  if (LittleFS.exists(path)) {
    File f = LittleFS.open(path, "r");
    size_t sz = f ? f.size() : 0;
    if (f) f.close();
    if (sz > maxSize) {
      String old = String(path) + ".1";
      LittleFS.remove(old);
      LittleFS.rename(path, old);
    }
  }
  File f = LittleFS.open(path, "a");
  if (!f) return false;
  f.print(line);
  f.close();
  return true;
}

void listDir(const char* dir, String& out) {
  out = "[";
  if (fsOk) {
    File d = LittleFS.open(dir);
    bool first = true;
    if (d && d.isDirectory()) {
      File f = d.openNextFile();
      while (f) {
        if (!f.isDirectory()) {
          if (!first) out += ",";
          first = false;
          out += "{\"n\":\"";
          out += f.name();
          out += "\",\"s\":";
          out += String((unsigned long)f.size());
          out += "}";
        }
        f = d.openNextFile();
      }
    }
  }
  out += "]";
}

void clearDir(const char* dir) {
  if (!fsOk) return;
  std::vector<String> names;
  File d = LittleFS.open(dir);
  if (!d || !d.isDirectory()) return;
  File f = d.openNextFile();
  while (f) {
    if (!f.isDirectory()) names.push_back(String(dir) + "/" + f.name());
    f = d.openNextFile();
  }
  d.close();
  for (auto& n : names) LittleFS.remove(n);
}

size_t usedBytes() { return fsOk ? LittleFS.usedBytes() : 0; }
size_t totalBytes() { return fsOk ? LittleFS.totalBytes() : 0; }

void dataLogMinute(const String& dateName, const String& line) {
  if (!fsOk) return;
  if (pendingFile.length() && pendingFile != dateName) dataLogFlush();
  pendingFile = dateName;
  pendingLines += line;
  if (pendingLines.length() > 1200) dataLogFlush();
}

void dataLogFlush() {
  if (!fsOk || pendingLines.length() == 0 || pendingFile.length() == 0) return;
  String path = "/log/" + pendingFile + ".csv";
  bool isNew = !LittleFS.exists(path);
  File f = LittleFS.open(path, "a");
  if (!f) return;
  if (isNew) f.print("heure,P1_W,P2_W,P3_W,P4_W,E1_Wh,E2_Wh,E3_Wh,E4_Wh,T_C,H_pct,L_pct,presence,relais\n");
  f.print(pendingLines);
  f.close();
  pendingLines = "";
}

void dataLogCleanup(int keepDays) {
  if (!fsOk) return;
  std::vector<String> names;
  File d = LittleFS.open("/log");
  if (!d || !d.isDirectory()) return;
  File f = d.openNextFile();
  while (f) {
    if (!f.isDirectory()) names.push_back(f.name());
    f = d.openNextFile();
  }
  d.close();
  std::sort(names.begin(), names.end(), [](const String& a, const String& b) { return a < b; });
  // garder les keepDays plus récents ; et libérer de la place si le système de fichiers est presque plein
  int extra = (int)names.size() - keepDays;
  for (int i = 0; i < (int)names.size(); i++) {
    bool full = LittleFS.totalBytes() - LittleFS.usedBytes() < 150000;
    if (i < extra || (full && i < (int)names.size() - 1)) LittleFS.remove("/log/" + names[i]);
  }
}

}  // namespace storage

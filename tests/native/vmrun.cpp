// Validation croisée : exécute avec la VM C++ (firmware/src/vm.cpp) les programmes compilés par
// le compilateur JavaScript et compare les actions à celles produites par la VM JavaScript.
// Usage : ./vmrun fichier1.json [fichier2.json ...]   (générés par tests/js/crossvalidate.js)
#include <ArduinoJson.h>
#include <math.h>
#include <stdio.h>

#include <fstream>
#include <map>
#include <sstream>
#include <string>
#include <vector>

#include "../../firmware/src/vm.h"

struct ScriptedHal : vm::Hal {
  double t = 0;
  std::map<int, double> params;
  std::vector<std::string> acts;
  long s() const { return (long)floor(t / 1000); }
  static std::string F(double v) {
    if (isnan(v)) return "nan";
    if (isinf(v)) return v > 0 ? "inf" : "-inf";
    char b[40];
    snprintf(b, sizeof b, "%lld", (long long)floor(v * 1e6 + 0.5));
    return b;
  }
  void act(const std::string& x) {
    char b[32];
    snprintf(b, sizeof b, "%lld ", (long long)t);
    acts.push_back(std::string(b) + x);
  }
  double sensor(int q, int k) override {
    if (k < 1 || k > 4) return NAN;
    return ((q * 7 + k * 13 + s() * 3) % 41) * 25 + q;
  }
  double gsensor(int q) override {
    long sec = s();
    long mod = (420 + sec / 60) % 1440;
    switch (q) {
      case 0: return ((sec * 17) % 53) * 60;
      case 6: return (sec % 20) < 10 ? 1 : 0;
      case 7: return mod / 60;
      case 8: return mod % 60;
      case 9: return sec % 60;
      case 10: return 1 + (sec / 86400) % 7;
      case 11: return mod;
      case 12: return sec;
      case 13: return (mod >= 1320 || mod < 360) ? 1 : 0;
      default: return q * 10 + (sec % 7);
    }
  }
  double param(int p, int idx) override {
    auto it = params.find(p * 10 + idx);
    return it == params.end() ? p * 100 + idx : it->second;
  }
  void setParam(int p, int idx, double v) override {
    params[p * 10 + idx] = v;
    act("param " + std::to_string(p) + " " + std::to_string(idx) + " " + F(v));
  }
  void relay(int k, bool on) override { act("relay " + std::to_string(k) + " " + (on ? "1" : "0")); }
  void toggle(int k) override { act("toggle " + std::to_string(k)); }
  void pulse(int k, double sec) override { act("pulse " + std::to_string(k) + " " + F(sec)); }
  void beep(int k) override { act("beep " + std::to_string(k)); }
  void alert(const char* m) override { act(std::string("alert ") + m); }
  void log(const char* m, double v, bool hv) override { act(std::string("log ") + m + (hv ? " " + F(v) : "")); }
  void screen(const char* m) override { act(std::string("screen ") + m); }
  void resetEnergy(int k) override { act("reset " + std::to_string(k)); }
  double ai(int q, double a, double b) override {
    long long av = (isfinite(a) && fabs(a) < 1e9) ? (long long)floor(a) : -1;
    long long bv = (isfinite(b) && fabs(b) < 1e9) ? (long long)floor(b) : -1;
    long long x = (q * 31 + av * 7 + bv * 3 + s()) % 97;
    return (double)((x + 97) % 97);
  }
  void shed(double l) override { act("shed " + F(l)); }
  bool clock(int& h, int& m, long& day) override {
    long sec = s();
    long mod = (420 + sec / 60) % 1440;
    h = (int)(mod / 60);
    m = (int)(mod % 60);
    day = 20000 + (420 * 60 + sec) / 86400;
    return true;
  }
};

static bool runFile(const char* path) {
  std::ifstream f(path);
  std::stringstream ss;
  ss << f.rdbuf();
  JsonDocument doc;
  if (deserializeJson(doc, ss.str())) {
    printf("  %s : JSON illisible\n", path);
    return false;
  }
  JsonObjectConst bc = doc["bc"];
  vm::Program p;
  std::string err;
  p.name = (const char*)(bc["name"] | "");
  if (!vm::parseCode(bc["code"] | "", p.code, err)) {
    printf("  %s : code illisible (%s)\n", path, err.c_str());
    return false;
  }
  for (JsonObjectConst s : bc["scripts"].as<JsonArrayConst>()) {
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
  for (JsonVariantConst v : bc["vars"].as<JsonArrayConst>()) p.vars.push_back(v.as<const char*>());
  for (JsonVariantConst v : bc["strs"].as<JsonArrayConst>()) p.strs.push_back(v.as<const char*>());
  ScriptedHal hal;
  vm::Machine m(&hal);
  if (!m.load(p, err)) {
    printf("  %s : programme refusé par la VM C++ (%s)\n", path, err.c_str());
    return false;
  }
  JsonObjectConst o = doc["opts"];
  double tick = o["tickMs"] | 100.0, end = o["endMs"] | 60000.0;
  m.start(0, o["seed"] | 12345u);
  std::multimap<long long, int> buttons;
  for (JsonArrayConst b : o["buttons"].as<JsonArrayConst>()) buttons.insert({b[0].as<long long>(), b[1].as<int>()});
  for (double t = 0; t <= end; t += tick) {
    hal.t = t;
    auto range = buttons.equal_range((long long)t);
    for (auto it = range.first; it != range.second; ++it) m.pressButton(it->second);
    m.tick(t);
  }
  JsonObjectConst ex = doc["expected"];
  JsonArrayConst ea = ex["acts"];
  bool ok = true;
  size_t n = ea.size();
  if (n != hal.acts.size()) {
    printf("  %s : %zu actions attendues, %zu obtenues\n", path, n, hal.acts.size());
    ok = false;
  }
  size_t lim = n < hal.acts.size() ? n : hal.acts.size();
  for (size_t i = 0; i < lim; i++) {
    std::string e = ea[i].as<const char*>();
    if (e != hal.acts[i]) {
      printf("  %s : action %zu différente\n    attendu : %s\n    obtenu  : %s\n", path, i, e.c_str(), hal.acts[i].c_str());
      ok = false;
      break;
    }
  }
  int st = ex["status"] | -1;
  if (st != m.status()) {
    printf("  %s : statut attendu %d, obtenu %d (%s)\n", path, st, m.status(), m.error().c_str());
    ok = false;
  }
  JsonArrayConst ev = ex["vars"];
  for (size_t i = 0; i < ev.size() && i < m.varCount(); i++) {
    std::string e = ev[i].as<const char*>();
    if (e != ScriptedHal::F(m.var((int)i))) {
      printf("  %s : variable %zu attendue %s, obtenue %s\n", path, i, e.c_str(), ScriptedHal::F(m.var((int)i)).c_str());
      ok = false;
    }
  }
  printf("  %s %s (%zu actions)\n", ok ? "OK  " : "ÉCHEC", path, hal.acts.size());
  return ok;
}

int main(int argc, char** argv) {
  int fails = 0;
  for (int i = 1; i < argc; i++)
    if (!runFile(argv[i])) fails++;
  printf("%d programme(s), %d échec(s)\n", argc - 1, fails);
  return fails ? 1 : 0;
}

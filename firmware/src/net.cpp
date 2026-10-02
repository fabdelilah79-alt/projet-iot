// EnergyLab - réseau (voir net.h)
#include "net.h"

#include <DNSServer.h>
#include <ESPmDNS.h>
#include <WiFi.h>
#include <sys/time.h>
#include <time.h>

#include "app.h"

namespace net {

enum State { ST_AP_ONLY, ST_CONNECTING, ST_CONNECTED, ST_FALLBACK };

static State s_state = ST_AP_ONLY;
static bool s_ap = false;
static DNSServer s_dns;
static uint32_t s_t0 = 0;
static uint32_t s_lastRetry = 0;
static bool s_mdns = false;
static bool s_ntp = false;
static char s_staSsid[33] = "";
static const IPAddress AP_IP(192, 168, 4, 1);

static void startAp() {
  if (s_ap) return;
  char ssid[33], pass[65];
  {
    Lock l;
    strncpy(ssid, g_cfg.apSsid, sizeof ssid);
    strncpy(pass, g_cfg.apPass, sizeof pass);
  }
  WiFi.softAPConfig(AP_IP, AP_IP, IPAddress(255, 255, 255, 0));
  bool ok = WiFi.softAP(ssid, pass[0] ? pass : nullptr, 6, 0, 8);
  s_dns.setErrorReplyCode(DNSReplyCode::NoError);
  s_dns.start(53, "*", AP_IP);
  s_ap = ok;
  Lock l;
  if (ok) g_kit.note(LG_INFO, "Point d'accès Wi-Fi « %s » actif : http://192.168.4.1", ssid);
  else g_kit.note(LG_ALERT, "Impossible de créer le point d'accès Wi-Fi");
}

static void startServices() {
  char host[24];
  {
    Lock l;
    strncpy(host, g_cfg.hostname, sizeof host);
  }
  if (!s_mdns && MDNS.begin(host)) {
    MDNS.addService("http", "tcp", 80);
    s_mdns = true;
  }
}

void begin() {
  uint8_t mode;
  char ssid[33], pass[65], host[24];
  bool apAlways;
  {
    Lock l;
    mode = g_cfg.wifiMode;
    strncpy(ssid, g_cfg.staSsid, sizeof ssid);
    strncpy(pass, g_cfg.staPass, sizeof pass);
    strncpy(host, g_cfg.hostname, sizeof host);
    apAlways = g_cfg.apAlways;
  }
  strncpy(s_staSsid, ssid, sizeof s_staSsid);
  WiFi.persistent(false);
  WiFi.setHostname(host);
  if (mode == 1 && ssid[0]) {
    WiFi.mode(apAlways ? WIFI_AP_STA : WIFI_STA);
    WiFi.setSleep(false);
    WiFi.setAutoReconnect(true);
    if (apAlways) startAp();
    WiFi.begin(ssid, pass);
    s_state = ST_CONNECTING;
    s_t0 = millis();
    Lock l;
    g_kit.note(LG_INFO, "Connexion au réseau Wi-Fi « %s »…", ssid);
  } else {
    WiFi.mode(WIFI_AP);
    WiFi.setSleep(false);
    startAp();
    s_state = ST_AP_ONLY;
  }
  startServices();
}

void loop() {
  if (s_ap) s_dns.processNextRequest();
  switch (s_state) {
    case ST_CONNECTING:
      if (WiFi.status() == WL_CONNECTED) {
        s_state = ST_CONNECTED;
        if (!s_ntp) {
          configTime(0, 0, "pool.ntp.org", "time.google.com");
          s_ntp = true;
        }
        Lock l;
        g_kit.note(LG_OK, "Connecté à « %s » : http://%s", s_staSsid, WiFi.localIP().toString().c_str());
      } else if (millis() - s_t0 > 20000) {
        s_state = ST_FALLBACK;
        s_lastRetry = millis();
        if (!s_ap) {
          WiFi.mode(WIFI_AP_STA);
          startAp();
        }
        Lock l;
        g_kit.note(LG_WARN, "Réseau « %s » introuvable : utilisez le Wi-Fi du kit « %s »", s_staSsid, g_cfg.apSsid);
      }
      break;
    case ST_CONNECTED:
      if (WiFi.status() != WL_CONNECTED) {
        s_state = ST_CONNECTING;
        s_t0 = millis();
      }
      break;
    case ST_FALLBACK:
      if (WiFi.status() == WL_CONNECTED) {
        s_state = ST_CONNECTING;  // passera à CONNECTED au prochain tour
      } else if (millis() - s_lastRetry > 120000 && WiFi.softAPgetStationNum() == 0) {
        // nouvelle tentative seulement si personne n'utilise le point d'accès (le changement de canal les déconnecterait)
        s_lastRetry = millis();
        WiFi.reconnect();
      }
      break;
    default:
      break;
  }
}

bool apActive() { return s_ap; }
bool staConnected() { return WiFi.status() == WL_CONNECTED; }
String staIp() { return staConnected() ? WiFi.localIP().toString() : String(""); }
String apIp() { return s_ap ? WiFi.softAPIP().toString() : String(""); }
const char* modeName() {
  bool sta = s_state != ST_AP_ONLY;
  if (s_ap && sta) return "apsta";
  return s_ap ? "ap" : "sta";
}
int rssi() { return staConnected() ? WiFi.RSSI() : 0; }
int apClients() { return s_ap ? WiFi.softAPgetStationNum() : 0; }
const char* staSsid() { return s_staSsid; }

bool timeValid() { return time(nullptr) > 1704067200;  /* 1/1/2024 */ }

int64_t epochNow() { return (int64_t)time(nullptr); }

bool setTimeFromClient(int64_t epoch) {
  if (epoch < 1704067200) return false;
  int64_t now = time(nullptr);
  if (timeValid() && llabs(now - epoch) < 300) return false;
  struct timeval tv;
  tv.tv_sec = (time_t)epoch;
  tv.tv_usec = 0;
  settimeofday(&tv, nullptr);
  return true;
}

}  // namespace net

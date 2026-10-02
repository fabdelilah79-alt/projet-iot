// EnergyLab - passerelle MQTT (voir mqttbridge.h)
#include "mqttbridge.h"

#include <PubSubClient.h>
#include <WiFi.h>

#include "app.h"
#include "net.h"
#include "webapi.h"

namespace mqttbridge {

static volatile bool s_reconf = false;
static const char* volatile s_status = "désactivé";
static char s_prefix[64] = "";

void reconfigure() { s_reconf = true; }
const char* status() { return s_status; }

static void onMessage(char* topic, byte* payload, unsigned int len) {
  // <prefix>/outlet/<n>/set
  String t(topic);
  String pre = String(s_prefix) + "/outlet/";
  if (!t.startsWith(pre) || !t.endsWith("/set")) return;
  int n = t.substring(pre.length(), t.length() - 4).toInt();
  if (n < 1 || n > NOUT) return;
  String v;
  for (unsigned int i = 0; i < len && i < 16; i++) v += (char)payload[i];
  v.trim();
  v.toUpperCase();
  Lock l;
  bool on;
  if (v == "ON" || v == "1" || v == "TRUE") on = true;
  else if (v == "OFF" || v == "0" || v == "FALSE") on = false;
  else if (v == "TOGGLE") on = !g_relays.isOn(n - 1);
  else return;
  g_kit.userRelay(n - 1, on, Relays::SRC_MQTT, nowMs());
  requestRelaySave();
}

static void task(void*) {
  WiFiClient client;
  PubSubClient mq(client);
  mq.setBufferSize(4096);
  mq.setCallback(onMessage);
  mq.setSocketTimeout(3);
  uint32_t lastTry = 0, lastPub = 0;
  for (;;) {
    vTaskDelay(pdMS_TO_TICKS(100));
    bool on;
    char host[64], user[32], pass[32], base[32];
    uint16_t port;
    {
      Lock l;
      on = g_cfg.mqttOn && g_cfg.mqttHost[0];
      strncpy(host, g_cfg.mqttHost, sizeof host);
      strncpy(user, g_cfg.mqttUser, sizeof user);
      strncpy(pass, g_cfg.mqttPass, sizeof pass);
      strncpy(base, g_cfg.mqttBase, sizeof base);
      port = g_cfg.mqttPort;
    }
    if (s_reconf) {
      s_reconf = false;
      if (mq.connected()) mq.disconnect();
      lastTry = 0;
    }
    if (!on) {
      if (mq.connected()) mq.disconnect();
      s_status = "désactivé";
      continue;
    }
    if (!net::staConnected()) {
      if (mq.connected()) mq.disconnect();
      s_status = "en attente du réseau Wi-Fi";
      continue;
    }
    snprintf(s_prefix, sizeof s_prefix, "%s/%s", base[0] ? base : "energylab", g_kitId);
    if (!mq.connected()) {
      if (lastTry != 0 && millis() - lastTry < 15000) continue;
      lastTry = millis();
      mq.setServer(host, port);
      String will = String(s_prefix) + "/status";
      String id = String("energylab-") + g_kitId;
      bool ok = user[0] ? mq.connect(id.c_str(), user, pass, will.c_str(), 0, true, "offline")
                        : mq.connect(id.c_str(), will.c_str(), 0, true, "offline");
      if (!ok) {
        s_status = "connexion impossible";
        continue;
      }
      mq.publish(will.c_str(), "online", true);
      mq.subscribe((String(s_prefix) + "/outlet/+/set").c_str());
      s_status = "connecté";
      Lock l;
      g_kit.note(LG_OK, "MQTT : connecté à %s:%u (sujets %s/…)", host, port, s_prefix);
    }
    mq.loop();
    if (millis() - lastPub >= 5000) {
      lastPub = millis();
      String st = webapi::stateJson();
      mq.publish((String(s_prefix) + "/state").c_str(), st.c_str());
      float p[NOUT], e[NOUT];
      bool r[NOUT];
      float tot;
      {
        Lock l;
        for (int k = 0; k < NOUT; k++) {
          p[k] = isnan(g_kit.out[k].p) ? 0 : g_kit.out[k].p;
          e[k] = g_kit.out[k].eTodayWh;
          r[k] = g_relays.isOn(k);
        }
        tot = g_kit.totalP();
      }
      char v[24];
      for (int k = 0; k < NOUT; k++) {
        String b = String(s_prefix) + "/outlet/" + String(k + 1);
        snprintf(v, sizeof v, "%.1f", p[k]);
        mq.publish((b + "/power").c_str(), v);
        snprintf(v, sizeof v, "%.1f", e[k]);
        mq.publish((b + "/energy").c_str(), v);
        mq.publish((b + "/relay").c_str(), r[k] ? "ON" : "OFF", true);
      }
      snprintf(v, sizeof v, "%.1f", tot);
      mq.publish((String(s_prefix) + "/total/power").c_str(), v);
    }
  }
}

void begin() { xTaskCreatePinnedToCore(task, "mqtt", 6144, nullptr, 1, nullptr, 0); }

}  // namespace mqttbridge

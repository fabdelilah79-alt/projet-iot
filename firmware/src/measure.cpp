// EnergyLab - tâche de mesure (voir measure.h)
#include "measure.h"

#include <DHT.h>

#include "app.h"
#include "pins.h"
#include "pzem.h"

namespace measure {

class SerialStream : public pzem::ByteStream {
 public:
  explicit SerialStream(HardwareSerial& s) : s_(s) {}
  size_t write(const uint8_t* d, size_t n) override { return s_.write(d, n); }
  int available() override { return s_.available(); }
  int read() override { return s_.read(); }
  void flushTx() override { s_.flush(true); }
  uint32_t millis() override { return ::millis(); }
  void delayMs(uint32_t ms) override { vTaskDelay(pdMS_TO_TICKS(ms ? ms : 1)); }

 private:
  HardwareSerial& s_;
};

static QueueHandle_t s_queue = nullptr;
static DHT s_dht(PIN_DHT, DHT22);
static portMUX_TYPE s_mux = portMUX_INITIALIZER_UNLOCKED;
static float s_temp = NAN, s_hum = NAN;
static BusStats s_stats = {};

void lastTempHum(float& t, float& h) {
  portENTER_CRITICAL(&s_mux);
  t = s_temp;
  h = s_hum;
  portEXIT_CRITICAL(&s_mux);
}

void stats(BusStats& out) {
  portENTER_CRITICAL(&s_mux);
  out = s_stats;
  portEXIT_CRITICAL(&s_mux);
}

float readLightPct(bool invert) {
  uint32_t sum = 0;
  for (int i = 0; i < 8; i++) sum += analogRead(PIN_LDR);
  float pct = (sum / 8.0f) * 100.0f / 4095.0f;
  if (invert) pct = 100.0f - pct;
  return roundf(pct * 10) / 10;
}

bool readMotion() { return digitalRead(PIN_PIR) == HIGH; }

static void toolMsg(const char* fmt, ...) {
  Lock l;
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(g_pzemTool.msg, sizeof g_pzemTool.msg, fmt, ap);
  va_end(ap);
  g_pzemTool.seq++;
}

static void handle(pzem::Bus& bus, const PzemCmd& c) {
  switch (c.type) {
    case PZ_RESET_ENERGY: {
      bool ok = bus.resetEnergy(c.outlet0 + 1);
      Lock l;
      if (ok) g_kit.note(LG_OK, "Capteur de la prise %d : compteur d'énergie remis à zéro", c.outlet0 + 1);
      else g_kit.note(LG_WARN, "Capteur de la prise %d : échec de la remise à zéro (%s)", c.outlet0 + 1,
                      pzem::errorText(bus.lastError()));
      break;
    }
    case PZ_SET_ALARM: {
      bool ok = bus.setAlarmThreshold(c.outlet0 + 1, c.value);
      Lock l;
      if (ok) {
        g_pzemTool.alarm[c.outlet0] = c.value;
        g_kit.note(LG_OK, "Capteur de la prise %d : seuil d'alarme interne réglé à %u W", c.outlet0 + 1, c.value);
      } else {
        g_kit.note(LG_WARN, "Capteur de la prise %d : impossible d'écrire le seuil d'alarme (%s)", c.outlet0 + 1,
                   pzem::errorText(bus.lastError()));
      }
      break;
    }
    case PZ_READ_ALARMS: {
      for (int k = 0; k < 4; k++) {
        uint16_t w = 0;
        if (bus.readAlarmThreshold(k + 1, w)) {
          Lock l;
          g_pzemTool.alarm[k] = w;
        }
      }
      break;
    }
    case PZ_SCAN: {
      {
        Lock l;
        g_pzemTool.busy = true;
        g_pzemTool.nFound = 0;
      }
      uint8_t found[16];
      uint8_t n = 0;
      uint32_t saved = 250;
      bus.setTimeout(150);
      for (uint8_t a = 1; a <= 10 && n < 16; a++) {
        uint8_t r = 0;
        if (bus.readAddress(a, r)) found[n++] = a;
      }
      // adresse générale : répond si au moins un module est branché
      uint8_t gen = 0;
      bool anyGen = bus.readAddress(pzem::ADDR_GENERAL, gen);
      int genErr = bus.lastError();
      bus.setTimeout(saved);
      {
        Lock l;
        memcpy(g_pzemTool.found, found, n);
        g_pzemTool.nFound = n;
        g_pzemTool.busy = false;
      }
      String list;
      for (int i = 0; i < n; i++) {
        if (i) list += ", ";
        list += String(found[i]);
      }
      if (n > 0)
        toolMsg("Capteurs trouvés aux adresses : %s%s", list.c_str(),
                anyGen ? "" : " (l'adresse générale ne répond pas : plusieurs modules partagent le bus, c'est normal)");
      else if (anyGen)
        toolMsg("Un capteur répond à l'adresse générale (adresse actuelle %u) mais pas aux adresses 1 à 10.", gen);
      else
        toolMsg("Aucun capteur ne répond (%s). Vérifiez l'alimentation 230 V des PZEM, le 5 V et les fils TX/RX.",
                genErr == pzem::ERR_CRC ? "réponses brouillées : plusieurs modules ont la même adresse ?" : "délai dépassé");
      break;
    }
    case PZ_SET_ADDR: {
      {
        Lock l;
        g_pzemTool.busy = true;
      }
      uint8_t target = c.outlet0;
      bool ok = bus.setAddress(pzem::ADDR_GENERAL, target);
      uint8_t check = 0;
      if (ok) {
        vTaskDelay(pdMS_TO_TICKS(200));
        ok = bus.readAddress(target, check) && check == target;
      }
      {
        Lock l;
        g_pzemTool.busy = false;
      }
      if (ok) toolMsg("Réussi : ce capteur a maintenant l'adresse %u (prise %u).", target, target);
      else toolMsg("Échec (%s). Un seul capteur PZEM doit être branché sur le bus pendant cette opération.",
                   pzem::errorText(bus.lastError()));
      break;
    }
  }
}

static void task(void*) {
  Serial2.begin(9600, SERIAL_8N1, PIN_PZEM_RX, PIN_PZEM_TX);
  SerialStream stream(Serial2);
  pzem::Bus bus(&stream);
  bus.setTimeout(250);
  s_dht.begin();
  uint32_t lastDht = 0;
  int dhtFails = 0;
  PzemCmd boot = {PZ_READ_ALARMS, 0, 0};
  handle(bus, boot);
  for (;;) {
    uint32_t t0 = millis();
    PzemCmd cmd;
    while (xQueueReceive(s_queue, &cmd, 0) == pdTRUE) handle(bus, cmd);
    uint16_t period = 1000;
    bool enabled[4];
    bool dhtOn = true;
    {
      Lock l;
      period = g_cfg.sampleMs;
      for (int k = 0; k < 4; k++) enabled[k] = g_cfg.out[k].enabled;
      dhtOn = g_cfg.dhtOn;
    }
    for (int k = 0; k < 4; k++) {
      if (!enabled[k]) continue;
      pzem::Values v;
      RawMeas r;
      r.ok = bus.readValues((uint8_t)(k + 1), v);
      if (r.ok) {
        r.u = v.voltage;
        r.i = v.current;
        r.p = v.power;
        r.eWh = v.energyWh;
        r.f = v.frequency;
        r.pf = v.pf;
        r.alarm = v.alarm;
      }
      portENTER_CRITICAL(&s_mux);
      if (r.ok) s_stats.ok[k]++;
      else s_stats.err[k]++;
      s_stats.lastErr[k] = (uint8_t)bus.lastError();
      portEXIT_CRITICAL(&s_mux);
      {
        Lock l;
        g_kit.onMeasurement(k, r, nowMs());
      }
      vTaskDelay(pdMS_TO_TICKS(10));
      while (xQueueReceive(s_queue, &cmd, 0) == pdTRUE) handle(bus, cmd);
    }
    if (dhtOn && millis() - lastDht > 3000) {
      lastDht = millis();
      float t = s_dht.readTemperature();
      float h = s_dht.readHumidity();
      if (isnan(t) || isnan(h)) {
        if (++dhtFails >= 3) {
          portENTER_CRITICAL(&s_mux);
          s_temp = NAN;
          s_hum = NAN;
          portEXIT_CRITICAL(&s_mux);
        }
      } else {
        dhtFails = 0;
        portENTER_CRITICAL(&s_mux);
        s_temp = roundf(t * 10) / 10;
        s_hum = roundf(h * 10) / 10;
        portEXIT_CRITICAL(&s_mux);
      }
    }
    uint32_t el = millis() - t0;
    vTaskDelay(pdMS_TO_TICKS(el < period ? period - el : 20));
  }
}

void begin() {
  pinMode(PIN_PIR, INPUT);
  pinMode(PIN_LDR, INPUT);
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_LDR, ADC_11db);
  s_queue = xQueueCreate(8, sizeof(PzemCmd));
  xTaskCreatePinnedToCore(task, "mesure", 6144, nullptr, 2, nullptr, 1);
}

}  // namespace measure

bool pzemCommand(const PzemCmd& c) {
  if (!measure::s_queue) return false;
  return xQueueSend(measure::s_queue, &c, 0) == pdTRUE;
}

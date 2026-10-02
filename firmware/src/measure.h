// EnergyLab - tâche de mesure : interrogation des 4 PZEM-004T et du DHT22
#pragma once

#include <Arduino.h>

namespace measure {

void begin();
float readLightPct(bool invert);  // photorésistance (0..100 %)
bool readMotion();                // détecteur de présence
void lastTempHum(float& t, float& h);

struct BusStats {
  uint32_t ok[4];
  uint32_t err[4];
  uint8_t lastErr[4];
};
void stats(BusStats& out);

}  // namespace measure

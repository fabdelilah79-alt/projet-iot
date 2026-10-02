// EnergyLab - passerelle MQTT optionnelle (Node-RED, Home Assistant, Grafana...)
// Sujets publiés (toutes les 5 s) :
//   <base>/<kit>/state                 état complet (JSON)
//   <base>/<kit>/outlet/<n>/power      puissance active (W)
//   <base>/<kit>/outlet/<n>/energy     énergie du jour (Wh)
//   <base>/<kit>/outlet/<n>/relay      ON / OFF
//   <base>/<kit>/total/power           puissance totale (W)
// Sujets écoutés :
//   <base>/<kit>/outlet/<n>/set        ON | OFF | TOGGLE
#pragma once

#include <Arduino.h>

namespace mqttbridge {

void begin();
void reconfigure();
const char* status();

}  // namespace mqttbridge

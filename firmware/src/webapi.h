// EnergyLab - serveur web : application, API JSON, WebSocket temps réel, portail captif
#pragma once

#include <Arduino.h>

namespace webapi {

void begin();
// Construit l'état JSON (appelée chaque seconde, verrou pris par l'appelant)
void buildState();
// Diffusion WebSocket (hors verrou)
void broadcastState();
void broadcastLog(const char* json);
void loop();
uint32_t configSeq();
void bumpConfigSeq();
void bumpKnnSeq();
int wsClients();
String stateJson();  // copie du dernier état JSON

}  // namespace webapi

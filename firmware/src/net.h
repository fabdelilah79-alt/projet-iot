// EnergyLab - réseau Wi-Fi : point d'accès du kit et/ou réseau existant, DNS captif, mDNS, NTP
#pragma once

#include <Arduino.h>

namespace net {

void begin();
void loop();
bool apActive();
bool staConnected();
String staIp();
String apIp();
const char* modeName();  // "ap", "sta", "apsta"
int rssi();
int apClients();
const char* staSsid();
// Heure : réglage depuis le navigateur (si l'heure est inconnue ou très fausse)
bool setTimeFromClient(int64_t epoch);
bool timeValid();
int64_t epochNow();

}  // namespace net

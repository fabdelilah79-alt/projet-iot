// EnergyLab - écran OLED 128x64 (SSD1306 ou SH1106, I2C) : connexion, QR code, mesures
#pragma once

#include <Arduino.h>

namespace display {

struct Snapshot {
  char kitName[32];
  char kitId[8];
  bool apActive;
  bool staConnected;
  char apSsid[33];
  char apPass[65];
  char staSsid[33];
  char ip[16];
  char apIp[16];
  char host[24];
  char names[4][24];
  float p[4];
  bool on[4];
  bool latched[4];
  bool online[4];
  float total;
  float temp, hum, lum;
  bool pres;
  bool timeValid;
  int hh, mm;
  char prog[32];
  int progStatus;
  float eToday;
  char currency[8];
  float costToday;
};

void begin(uint8_t type);  // 0 SSD1306, 1 SH1106, 2 aucun
bool present();
void update(const Snapshot& s);  // appelée ~ toutes les 500 ms
void nextScreen();
void message(const char* msg, uint32_t ms);  // message d'un programme
void alert(const char* msg);                 // alerte (prioritaire)
void boot(const char* line);

}  // namespace display

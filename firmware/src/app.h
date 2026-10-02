// EnergyLab - objets globaux partagés entre les modules du firmware
#pragma once

#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/semphr.h>

#include "config.h"
#include "kitcore.h"
#include "relays.h"

#define FW_VERSION "1.0.0"

extern Config g_cfg;
extern Relays g_relays;
extern KitCore g_kit;
extern SemaphoreHandle_t g_lock;
extern char g_kitId[8];  // 4 derniers chiffres hexadécimaux de l'adresse MAC

// Verrou récursif protégeant g_cfg, g_relays et g_kit
struct Lock {
  Lock() { xSemaphoreTakeRecursive(g_lock, portMAX_DELAY); }
  ~Lock() { xSemaphoreGiveRecursive(g_lock); }
  Lock(const Lock&) = delete;
  Lock& operator=(const Lock&) = delete;
};

// Temps monotone en millisecondes (64 bits, ne déborde pas)
double nowMs();

// Commandes destinées à la tâche de mesure (bus PZEM)
enum PzemCmdType : uint8_t { PZ_RESET_ENERGY = 1, PZ_SET_ALARM, PZ_SCAN, PZ_SET_ADDR, PZ_READ_ALARMS };
struct PzemCmd {
  PzemCmdType type;
  uint8_t outlet0;  // ou adresse cible pour PZ_SET_ADDR
  uint16_t value;
};
bool pzemCommand(const PzemCmd& c);

// Résultat des outils PZEM (enseignant)
struct PzemToolState {
  bool busy = false;
  char msg[160] = "";
  uint8_t found[16];
  uint8_t nFound = 0;
  uint16_t alarm[4] = {0, 0, 0, 0};
  uint32_t seq = 0;
};
extern PzemToolState g_pzemTool;

// Sauvegardes différées
void requestConfigSave();
void requestRelaySave();

// Journal -> diffusion WebSocket (file d'attente, non bloquant)
void queueLogBroadcast(const LogEntry& e);

// Programme
bool programLoadFromJson(const char* json, size_t len, std::string& err, bool start, bool save);
void programAutostartOnBoot();

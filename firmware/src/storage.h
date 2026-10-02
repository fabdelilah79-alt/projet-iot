// EnergyLab - persistance : NVS (configuration, états) et LittleFS (programmes, journaux, recherche)
#pragma once

#include <Arduino.h>

#include "kitcore.h"

namespace storage {

bool begin();  // monte LittleFS (formate si nécessaire)

// NVS
bool loadConfig(Config& c);
void saveConfig(const Config& c);
uint8_t loadRelayMask();
void saveRelayMask(uint8_t m);
bool loadToday(DaySummary& d);
void saveToday(const DaySummary& d);
int loadDays(DaySummary* arr, int max);
void saveDays(const KitCore& kit);
void loadKnn(ai::Knn& knn);
void saveKnn(const ai::Knn& knn);
uint32_t bootCount();
void factoryReset();

// LittleFS
bool writeFile(const char* path, const uint8_t* data, size_t len);
String readFile(const char* path, size_t maxLen = 65536);
bool exists(const char* path);
void remove(const char* path);
bool appendLine(const char* path, const String& line, size_t maxSize);
void listDir(const char* dir, String& jsonOut);  // [{"n":"...","s":123},...]
void clearDir(const char* dir);
size_t usedBytes();
size_t totalBytes();

// Journal de données (une ligne par minute)
void dataLogMinute(const String& dateName, const String& line);
void dataLogFlush();
void dataLogCleanup(int keepDays);

}  // namespace storage

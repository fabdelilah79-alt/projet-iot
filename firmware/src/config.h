// EnergyLab - configuration du kit (enregistrée en NVS au format JSON)
#pragma once

#include <ArduinoJson.h>
#include <stdint.h>

#include <string>

static const int NOUT = 4;

// Permissions des apprenants (bits)
enum Perm : uint16_t {
  PERM_RELAY = 1,         // commander les prises
  PERM_PARAMS = 2,        // changer les paramètres (dans les limites de l'enseignant)
  PERM_PROGRAM = 4,       // envoyer / démarrer / arrêter un programme
  PERM_RESET_ENERGY = 8,  // remettre à zéro les compteurs des capteurs
  PERM_KNN = 16,          // entraîner l'IA de reconnaissance
  PERM_REARM = 32         // réarmer une protection
};

struct OutletConfig {
  char name[24];
  char icon[16];
  bool enabled;
  float maxPower;      // W : protection logicielle (coupure + verrouillage)
  uint16_t pzemAlarm;  // W : seuil d'alarme interne du PZEM
  uint8_t priority;    // 1 = la plus importante
  uint8_t bootState;   // 0 éteinte, 1 allumée, 2 dernier état
  float minSwitchS;    // s : délai minimum entre deux commutations
  float standbyW;      // W : seuil de veille
  uint8_t ctTurns;     // nombre de passages du fil de phase dans le tore
  float calU, calI;    // coefficients d'étalonnage
};

struct Config {
  OutletConfig out[NOUT];
  // Réseau
  uint8_t wifiMode;  // 0 : point d'accès du kit, 1 : réseau existant (+ secours)
  char staSsid[33];
  char staPass[65];
  char apSsid[33];
  char apPass[65];
  bool apAlways;
  char hostname[24];
  int16_t tzMin;
  bool tzAuto;
  char kitName[32];
  // Tarifs et environnement
  float priceHP, priceHC;
  bool hpHc;
  uint16_t hcStart, hcEnd;  // minutes depuis minuit
  char currency[8];
  float co2;        // g CO2 / kWh
  float contractW;  // puissance souscrite (pédagogique)
  // Mesure
  uint16_t sampleMs;
  uint8_t smoothN;
  // Ambiance
  float tempSet, tempHyst, lightThr;
  uint16_t presenceS;
  bool dhtOn, ldrOn, pirOn, ldrInvert;
  uint8_t oledType;  // 0 SSD1306, 1 SH1106, 2 aucun
  bool buzzerOn;
  bool relayActiveLow;
  // Sécurité (enseignant)
  float maxTotalW;
  float hardMaxOutletW;
  float minSwitchFloorS;
  // IA
  float anomalyZ;
  uint8_t knnK;
  float knnMaxDist;
  // Pédagogie
  char pin[9];
  uint16_t perms;
  uint8_t scaffold;  // 0 fort, 1 adaptatif, 2 faible
  bool progAutostart;
  // MQTT (optionnel)
  bool mqttOn;
  char mqttHost[64];
  uint16_t mqttPort;
  char mqttUser[32];
  char mqttPass[32];
  char mqttBase[32];
};

void configDefaults(Config& c, const char* kitId);
// Sérialise la configuration. withSecrets=false masque les mots de passe.
void configToJson(const Config& c, JsonObject o, bool withSecrets);
// Applique une mise à jour partielle. Renvoie un masque de changements (voir ci-dessous).
enum ConfigChange : uint32_t {
  CHG_NONE = 0,
  CHG_NET = 1,      // nécessite un redémarrage du Wi-Fi
  CHG_OUTLET = 2,
  CHG_ALARM = 4,    // seuils d'alarme PZEM à écrire
  CHG_MQTT = 8,
  CHG_OTHER = 16
};
uint32_t configFromJson(Config& c, JsonObjectConst o);

// Paramètres accessibles aux programmes (voir docs/specs/bytecode.md §7)
bool paramValid(int p);
bool paramIsOutlet(int p);
double paramGet(const Config& c, int p, int idx);
// Applique la valeur bornée. Renvoie false si refusé (msg explique pourquoi).
// 'applied' reçoit la valeur effectivement retenue.
bool paramSet(Config& c, int p, int idx, double v, double& applied, std::string& msg);
const char* paramName(int p);

// Heures creuses ?
bool isOffPeak(const Config& c, int minuteOfDay);
double priceAt(const Config& c, int minuteOfDay, bool timeValid);

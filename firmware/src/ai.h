// EnergyLab - fonctions "intelligentes" (indépendantes du matériel)
//  - historique 1 s (600 s) : moyennes, maximum, tendance par régression linéaire
//  - prévision de Holt (lissage exponentiel double)
//  - détection d'anomalie (score z sur moyenne/variance exponentielles)
//  - durée d'inactivité (veille)
//  - reconnaissance d'appareils par k plus proches voisins (k-NN)
// Ces algorithmes sont reproduits à l'identique dans web/src/32_ai.js (simulateur).
#pragma once

#include <math.h>
#include <stdint.h>
#include <string>
#include <vector>

namespace ai {

static const int NOUT = 4;
static const int FAST_N = 600;

struct Sample {
  uint32_t t;        // secondes (horodatage Unix si disponible, sinon temps de fonctionnement)
  float p[NOUT];     // puissance active par prise (W)
  float temp;        // °C (NaN si absent)
  float hum;         // %
  float lum;         // %
  uint8_t pres;      // présence 0/1
  uint8_t relays;    // bit i = relais i allumé
};

class FastHistory {
 public:
  void clear() { head_ = 0; count_ = 0; }
  void push(const Sample& s);
  int count() const { return count_; }
  // i = 0 : échantillon le plus récent
  const Sample& at(int i) const;
  double total(int i) const;
  double avgP(int outlet0, int n) const;
  double avgTotal(int n) const;
  double maxTotal(int n) const;
  double slopeTotalPerMin(int n) const;

 private:
  Sample buf_[FAST_N];
  int head_ = 0;   // prochaine position d'écriture
  int count_ = 0;
};

class Holt {
 public:
  void reset() { acc_ = 0; n_ = 0; init_ = false; L_ = 0; T_ = 0; }
  void addSecond(double total);  // appelée chaque seconde ; mise à jour toutes les 10 s
  double forecast(double minutes) const;
  bool ready() const { return init_; }
  double level() const { return L_; }
  double trend() const { return T_; }  // W par pas de 10 s

 private:
  double acc_ = 0;
  int n_ = 0;
  bool init_ = false;
  double L_ = 0, T_ = 0;
};

class Anomaly {
 public:
  void reset() { init_ = false; mu_ = 0; var_ = 0; over_ = 0; flag_ = false; z_ = 0; }
  void update(double p, double zThreshold);
  bool flag() const { return flag_; }
  double z() const { return z_; }
  double mean() const { return mu_; }

 private:
  bool init_ = false;
  double mu_ = 0, var_ = 0;
  int over_ = 0;
  bool flag_ = false;
  double z_ = 0;
};

struct KnnSample {
  int label;
  float p;
  float pf;
};

struct KnnLabel {
  int id;
  std::string name;
};

class Knn {
 public:
  static double distance(double p1, double pf1, double p2, double pf2);
  // 0 : aucun appareil (P < 1 W), -1 : inconnu, n >= 1 : identifiant d'étiquette
  int classify(double p, double pf, int k, double maxDist, double* nearestDist = nullptr) const;
  std::vector<KnnSample> samples;
  std::vector<KnnLabel> labels;
  int labelId(const std::string& name, bool create);
  const char* labelName(int id) const;
  void removeLabel(int id);
  static const int MAX_SAMPLES = 60;
  static const int MAX_LABELS = 16;
};

}  // namespace ai

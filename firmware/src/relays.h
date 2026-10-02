// EnergyLab - gestionnaire des relais (prises commandées)
//  - délai minimum entre deux commutations (protection des appareils et des relais)
//  - verrouillage après déclenchement d'une protection (réarmement manuel)
//  - minuterie "allumer pendant N secondes"
// Indépendant du matériel : l'écriture des broches passe par un rappel.
// Le simulateur (web/src/34_kitcore.js) reproduit exactement ce comportement.
#pragma once

#include <stdint.h>

class Relays {
 public:
  enum Source : uint8_t { SRC_USER = 0, SRC_PROGRAM, SRC_SAFETY, SRC_MQTT, SRC_BOOT, SRC_SHED, SRC_PULSE };
  enum Result : uint8_t { RL_OK = 0, RL_NOCHANGE, RL_DELAYED, RL_LATCHED, RL_INVALID };
  typedef void (*WriteFn)(int outlet0, bool on);

  static const int N = 4;

  void begin(WriteFn fn) { write_ = fn; }
  void setMinSwitchMs(int k, uint32_t ms) { if (k >= 0 && k < N) minMs_[k] = ms; }

  Result request(int k, bool on, Source src, double nowMs);
  // Coupure immédiate + verrouillage
  void latch(int k, double nowMs);
  bool rearm(int k);
  void pulse(int k, double seconds, Source src, double nowMs);
  void tick(double nowMs);
  // État initial au démarrage (sans délai)
  void force(int k, bool on, double nowMs);

  bool isOn(int k) const { return k >= 0 && k < N && on_[k]; }
  bool isLatched(int k) const { return k >= 0 && k < N && latched_[k]; }
  bool hasPending(int k) const { return k >= 0 && k < N && pending_[k] >= 0; }
  uint32_t switches(int k) const { return (k >= 0 && k < N) ? switches_[k] : 0; }
  double lastChange(int k) const { return (k >= 0 && k < N) ? last_[k] : 0; }
  double pulseEnd(int k) const { return (k >= 0 && k < N) ? pulseOff_[k] : 0; }
  void resetSwitchCounters() { for (int k = 0; k < N; k++) switches_[k] = 0; }
  uint8_t mask() const;
  // Renvoie vrai (une seule fois) si une commutation a eu lieu depuis le dernier appel
  bool takeChanged() { bool c = changed_; changed_ = false; return c; }

 private:
  void apply(int k, bool on, double nowMs);
  WriteFn write_ = nullptr;
  bool on_[N] = {false, false, false, false};
  bool latched_[N] = {false, false, false, false};
  int8_t pending_[N] = {-1, -1, -1, -1};
  double last_[N] = {-1e12, -1e12, -1e12, -1e12};
  double pulseOff_[N] = {0, 0, 0, 0};
  uint32_t minMs_[N] = {2000, 2000, 2000, 2000};
  uint32_t switches_[N] = {0, 0, 0, 0};
  bool changed_ = false;
};

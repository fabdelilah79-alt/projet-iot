// EnergyLab - gestionnaire des relais (voir relays.h)
#include "relays.h"

void Relays::apply(int k, bool on, double now) {
  if (on_[k] != on) {
    on_[k] = on;
    last_[k] = now;
    switches_[k]++;
    changed_ = true;
    if (write_) write_(k, on);
  }
  pending_[k] = -1;
}

void Relays::force(int k, bool on, double now) {
  if (k < 0 || k >= N) return;
  on_[k] = on;
  pending_[k] = -1;
  pulseOff_[k] = 0;
  last_[k] = now - 1e9;
  if (write_) write_(k, on);
}

Relays::Result Relays::request(int k, bool on, Source src, double now) {
  if (k < 0 || k >= N) return RL_INVALID;
  if (src != SRC_PULSE) pulseOff_[k] = 0;  // une commande annule la minuterie
  if (on && latched_[k]) return RL_LATCHED;
  if (src == SRC_SAFETY && !on) {  // la sécurité coupe toujours immédiatement
    apply(k, false, now);
    return RL_OK;
  }
  if (on == on_[k]) {
    pending_[k] = -1;  // annule une commutation en attente
    return RL_NOCHANGE;
  }
  if (now - last_[k] < (double)minMs_[k]) {
    pending_[k] = on ? 1 : 0;
    return RL_DELAYED;
  }
  apply(k, on, now);
  return RL_OK;
}

void Relays::latch(int k, double now) {
  if (k < 0 || k >= N) return;
  latched_[k] = true;
  pulseOff_[k] = 0;
  apply(k, false, now);
}

bool Relays::rearm(int k) {
  if (k < 0 || k >= N || !latched_[k]) return false;
  latched_[k] = false;
  return true;
}

void Relays::pulse(int k, double seconds, Source src, double now) {
  if (k < 0 || k >= N) return;
  if (!(seconds > 0)) seconds = 0;
  if (seconds > 86400) seconds = 86400;
  Result r = request(k, true, src, now);
  if (r == RL_LATCHED || r == RL_INVALID) return;
  pulseOff_[k] = now + seconds * 1000.0;
  if (pulseOff_[k] == 0) pulseOff_[k] = 1;  // 0 signifie "pas de minuterie"
}

void Relays::tick(double now) {
  for (int k = 0; k < N; k++) {
    if (pending_[k] >= 0 && now - last_[k] >= (double)minMs_[k]) {
      bool on = pending_[k] == 1;
      if (on && latched_[k]) pending_[k] = -1;
      else apply(k, on, now);
    }
    if (pulseOff_[k] != 0 && now >= pulseOff_[k]) {
      pulseOff_[k] = 0;
      request(k, false, SRC_PULSE, now);
    }
  }
}

uint8_t Relays::mask() const {
  uint8_t m = 0;
  for (int k = 0; k < N; k++)
    if (on_[k]) m |= (uint8_t)(1 << k);
  return m;
}

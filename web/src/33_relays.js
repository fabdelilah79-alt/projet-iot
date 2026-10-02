/* EnergyLab — gestionnaire des relais (copie de firmware/src/relays.cpp) */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  const SRC = { USER: 0, PROGRAM: 1, SAFETY: 2, MQTT: 3, BOOT: 4, SHED: 5, PULSE: 6 };
  const RES = { OK: 0, NOCHANGE: 1, DELAYED: 2, LATCHED: 3, INVALID: 4 };
  const N = 4;

  class Relays {
    constructor(writeFn) {
      this.write = writeFn || null;
      this.on = [false, false, false, false];
      this.latched = [false, false, false, false];
      this.pending = [-1, -1, -1, -1];
      this.last = [-1e12, -1e12, -1e12, -1e12];
      this.pulseOff = [0, 0, 0, 0];
      this.minMs = [2000, 2000, 2000, 2000];
      this.switchCount = [0, 0, 0, 0];
      this.changed = false;
    }
    setMinSwitchMs(k, ms) { if (k >= 0 && k < N) this.minMs[k] = ms; }
    apply(k, on, now) {
      if (this.on[k] !== on) {
        this.on[k] = on;
        this.last[k] = now;
        this.switchCount[k]++;
        this.changed = true;
        if (this.write) this.write(k, on);
      }
      this.pending[k] = -1;
    }
    force(k, on, now) {
      if (k < 0 || k >= N) return;
      this.on[k] = on; this.pending[k] = -1; this.pulseOff[k] = 0; this.last[k] = now - 1e9;
      if (this.write) this.write(k, on);
    }
    request(k, on, src, now) {
      if (k < 0 || k >= N) return RES.INVALID;
      if (src !== SRC.PULSE) this.pulseOff[k] = 0;
      if (on && this.latched[k]) return RES.LATCHED;
      if (src === SRC.SAFETY && !on) { this.apply(k, false, now); return RES.OK; }
      if (on === this.on[k]) { this.pending[k] = -1; return RES.NOCHANGE; }
      if (now - this.last[k] < this.minMs[k]) { this.pending[k] = on ? 1 : 0; return RES.DELAYED; }
      this.apply(k, on, now);
      return RES.OK;
    }
    latch(k, now) {
      if (k < 0 || k >= N) return;
      this.latched[k] = true; this.pulseOff[k] = 0;
      this.apply(k, false, now);
    }
    rearm(k) {
      if (k < 0 || k >= N || !this.latched[k]) return false;
      this.latched[k] = false;
      return true;
    }
    pulse(k, seconds, src, now) {
      if (k < 0 || k >= N) return;
      if (!(seconds > 0)) seconds = 0;
      if (seconds > 86400) seconds = 86400;
      const r = this.request(k, true, src, now);
      if (r === RES.LATCHED || r === RES.INVALID) return;
      this.pulseOff[k] = now + seconds * 1000;
      if (this.pulseOff[k] === 0) this.pulseOff[k] = 1;
    }
    tick(now) {
      for (let k = 0; k < N; k++) {
        if (this.pending[k] >= 0 && now - this.last[k] >= this.minMs[k]) {
          const on = this.pending[k] === 1;
          if (on && this.latched[k]) this.pending[k] = -1;
          else this.apply(k, on, now);
        }
        if (this.pulseOff[k] !== 0 && now >= this.pulseOff[k]) {
          this.pulseOff[k] = 0;
          this.request(k, false, SRC.PULSE, now);
        }
      }
    }
    isOn(k) { return k >= 0 && k < N && this.on[k]; }
    isLatched(k) { return k >= 0 && k < N && this.latched[k]; }
    hasPending(k) { return k >= 0 && k < N && this.pending[k] >= 0; }
    switches(k) { return (k >= 0 && k < N) ? this.switchCount[k] : 0; }
    lastChange(k) { return (k >= 0 && k < N) ? this.last[k] : 0; }
    pulseEnd(k) { return (k >= 0 && k < N) ? this.pulseOff[k] : 0; }
    resetSwitchCounters() { this.switchCount = [0, 0, 0, 0]; }
    mask() { let m = 0; for (let k = 0; k < N; k++) if (this.on[k]) m |= (1 << k); return m; }
    takeChanged() { const c = this.changed; this.changed = false; return c; }
  }

  EL.relays = { Relays, SRC, RES };
})(typeof globalThis !== 'undefined' ? globalThis : this);

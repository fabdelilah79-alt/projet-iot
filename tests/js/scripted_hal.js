// HAL déterministe partagée par la validation croisée JS / C++ (voir tests/native/vmrun.cpp)
'use strict';

class ScriptedHal {
  constructor() { this.t = 0; this.params = new Map(); this.acts = []; }
  s() { return Math.floor(this.t / 1000); }
  F(v) {
    if (Number.isNaN(v)) return 'nan';
    if (!Number.isFinite(v)) return v > 0 ? 'inf' : '-inf';
    return String(Math.floor(v * 1e6 + 0.5));
  }
  act(str) { this.acts.push(this.t + ' ' + str); }
  sensor(q, k) { if (k < 1 || k > 4) return NaN; const s = this.s(); return ((q * 7 + k * 13 + s * 3) % 41) * 25 + q; }
  gsensor(q) {
    const s = this.s();
    const mod = (420 + Math.floor(s / 60)) % 1440;
    switch (q) {
      case 0: return ((s * 17) % 53) * 60;
      case 6: return (s % 20) < 10 ? 1 : 0;
      case 7: return Math.floor(mod / 60);
      case 8: return mod % 60;
      case 9: return s % 60;
      case 10: return 1 + Math.floor(s / 86400) % 7;
      case 11: return mod;
      case 12: return s;
      case 13: return (mod >= 1320 || mod < 360) ? 1 : 0;
      default: return q * 10 + (s % 7);
    }
  }
  param(p, idx) { const k = p * 10 + idx; return this.params.has(k) ? this.params.get(k) : p * 100 + idx; }
  setParam(p, idx, v) { this.params.set(p * 10 + idx, v); this.act('param ' + p + ' ' + idx + ' ' + this.F(v)); }
  relay(k, on) { this.act('relay ' + k + ' ' + (on ? 1 : 0)); }
  toggle(k) { this.act('toggle ' + k); }
  pulse(k, s) { this.act('pulse ' + k + ' ' + this.F(s)); }
  beep(k) { this.act('beep ' + k); }
  alert(m) { this.act('alert ' + m); }
  log(m, v, hv) { this.act('log ' + m + (hv ? ' ' + this.F(v) : '')); }
  screen(m) { this.act('screen ' + m); }
  resetEnergy(k) { this.act('reset ' + k); }
  ai(q, a, b) {
    const av = Number.isFinite(a) && Math.abs(a) < 1e9 ? Math.floor(a) : -1;
    const bv = Number.isFinite(b) && Math.abs(b) < 1e9 ? Math.floor(b) : -1;
    return (((q * 31 + av * 7 + bv * 3 + this.s()) % 97) + 97) % 97;
  }
  shed(l) { this.act('shed ' + this.F(l)); }
  clock() {
    const s = this.s();
    const mod = (420 + Math.floor(s / 60)) % 1440;
    return { valid: true, hour: Math.floor(mod / 60), minute: mod % 60, dayKey: 20000 + Math.floor((420 * 60 + s) / 86400) };
  }
}

module.exports = { ScriptedHal };

/* EnergyLab — fonctions intelligentes (copie de firmware/src/ai.cpp)
 *  historique 1 s, Holt, anomalies (score z), k plus proches voisins */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  const NOUT = 4;
  const FAST_N = 600;

  function clampN(n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }

  class FastHistory {
    constructor() { this.buf = new Array(FAST_N); this.head = 0; this.n = 0; }
    clear() { this.head = 0; this.n = 0; }
    push(s) { this.buf[this.head] = s; this.head = (this.head + 1) % FAST_N; if (this.n < FAST_N) this.n++; }
    count() { return this.n; }
    at(i) { let idx = this.head - 1 - i; while (idx < 0) idx += FAST_N; return this.buf[idx % FAST_N]; }
    total(i) { const s = this.at(i); let t = 0; for (let k = 0; k < NOUT; k++) t += s.p[k]; return t; }
    avgP(o, n) {
      if (this.n === 0 || o < 0 || o >= NOUT) return NaN;
      n = clampN(n, 1, this.n);
      let s = 0;
      for (let i = 0; i < n; i++) s += this.at(i).p[o];
      return s / n;
    }
    avgTotal(n) {
      if (this.n === 0) return NaN;
      n = clampN(n, 1, this.n);
      let s = 0;
      for (let i = 0; i < n; i++) s += this.total(i);
      return s / n;
    }
    maxTotal(n) {
      if (this.n === 0) return NaN;
      n = clampN(n, 1, this.n);
      let m = this.total(0);
      for (let i = 1; i < n; i++) { const v = this.total(i); if (v > m) m = v; }
      return m;
    }
    slopeTotalPerMin(n) {
      if (this.n < 2) return 0;
      n = clampN(n, 2, this.n);
      let sx = 0, sy = 0;
      for (let i = 0; i < n; i++) { sx += -i; sy += this.total(i); }
      const mx = sx / n, my = sy / n;
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) { const dx = -i - mx; num += dx * (this.total(i) - my); den += dx * dx; }
      return den === 0 ? 0 : num / den * 60;
    }
    // échantillons du plus ancien au plus récent
    list(max) {
      const n = Math.min(this.n, max || FAST_N);
      const out = [];
      for (let i = n - 1; i >= 0; i--) out.push(this.at(i));
      return out;
    }
  }

  class Holt {
    constructor() { this.reset(); }
    reset() { this.acc = 0; this.n = 0; this.init = false; this.L = 0; this.T = 0; }
    addSecond(total) {
      if (Number.isNaN(total)) return;
      this.acc += total;
      this.n++;
      if (this.n < 10) return;
      const y = this.acc / this.n;
      this.acc = 0; this.n = 0;
      const alpha = 0.3, beta = 0.1;
      if (!this.init) { this.L = y; this.T = 0; this.init = true; return; }
      const prev = this.L;
      this.L = alpha * y + (1 - alpha) * (this.L + this.T);
      this.T = beta * (this.L - prev) + (1 - beta) * this.T;
    }
    forecast(minutes) {
      if (!this.init) return NaN;
      if (!(minutes >= 0)) minutes = 0;
      if (minutes > 120) minutes = 120;
      const v = this.L + this.T * (minutes * 6);
      return v < 0 ? 0 : v;
    }
    ready() { return this.init; }
  }

  class Anomaly {
    constructor() { this.reset(); }
    reset() { this.init = false; this.mu = 0; this.v = 0; this.over = 0; this.flagged = false; this.z = 0; }
    update(p, zThr) {
      if (Number.isNaN(p)) return;
      if (!this.init) { this.init = true; this.mu = p; this.v = 0; this.over = 0; this.flagged = false; this.z = 0; return; }
      const sd = Math.sqrt(this.v);
      const floorSd = 2 + 0.05 * Math.abs(this.mu);
      const den = sd > floorSd ? sd : floorSd;
      this.z = Math.abs(p - this.mu) / den;
      if (this.z > zThr && p > 5) this.over++; else this.over = 0;
      this.flagged = this.over >= 3;
      if (this.over >= 60) { this.mu = p; this.v = 0; this.over = 0; this.flagged = false; return; }
      if (this.over === 0) {
        const a = 0.05, d = p - this.mu;
        this.mu += a * d;
        this.v = (1 - a) * (this.v + a * d * d);
      }
    }
    flag() { return this.flagged; }
  }

  class Knn {
    constructor() { this.samples = []; this.labels = []; }
    static distance(p1, pf1, p2, pf2) {
      const x1 = Math.log10(p1 > 0.1 ? p1 : 0.1), x2 = Math.log10(p2 > 0.1 ? p2 : 0.1);
      const dx = (x1 - x2) / 0.12, dy = (pf1 - pf2) / 0.08;
      return Math.sqrt(dx * dx + dy * dy);
    }
    // renvoie {id, dist, neighbours}
    classifyFull(p, pf, k, maxDist) {
      if (Number.isNaN(p) || p < 1) return { id: 0, dist: NaN, neighbours: [] };
      if (this.samples.length === 0) return { id: -1, dist: NaN, neighbours: [] };
      if (k < 1) k = 1;
      const v = this.samples.map(function (s, i) { return { d: Knn.distance(p, pf, s.p, s.pf), label: s.label, i: i }; });
      v.sort(function (a, b) { return a.d - b.d || a.i - b.i; });
      const n = Math.min(k, v.length);
      const neighbours = v.slice(0, n);
      if (v[0].d > maxDist) return { id: -1, dist: v[0].d, neighbours: neighbours };
      let best = v[0].label, bestCount = 0;
      for (let i = 0; i < n; i++) {
        let c = 0;
        for (let j = 0; j < n; j++) if (v[j].label === v[i].label) c++;
        if (c > bestCount) { bestCount = c; best = v[i].label; }
      }
      return { id: best, dist: v[0].d, neighbours: neighbours };
    }
    classify(p, pf, k, maxDist) { return this.classifyFull(p, pf, k, maxDist).id; }
    labelId(name, create) {
      for (const l of this.labels) if (l.name === name) return l.id;
      if (!create || this.labels.length >= 16) return -1;
      let id = 1;
      while (this.labels.some(function (l) { return l.id === id; })) id++;
      this.labels.push({ id: id, name: name });
      return id;
    }
    labelName(id) { const l = this.labels.find(function (x) { return x.id === id; }); return l ? l.name : ''; }
    removeLabel(id) {
      this.labels = this.labels.filter(function (l) { return l.id !== id; });
      this.samples = this.samples.filter(function (s) { return s.label !== id; });
    }
    toJSON() {
      return { labels: this.labels.map(function (l) { return { id: l.id, name: l.name }; }), samples: this.samples.map(function (s) { return [s.label, s.p, s.pf]; }) };
    }
    load(o) {
      this.labels = (o && o.labels || []).map(function (l) { return { id: l.id, name: l.name }; });
      this.samples = (o && o.samples || []).map(function (s) { return Array.isArray(s) ? { label: s[0], p: s[1], pf: s[2] } : s; });
    }
  }
  Knn.MAX_SAMPLES = 60;

  EL.ai = { FastHistory, Holt, Anomaly, Knn, NOUT, FAST_N };
})(typeof globalThis !== 'undefined' ? globalThis : this);

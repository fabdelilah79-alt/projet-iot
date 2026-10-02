/* EnergyLab — graphiques légers sur canvas (courbes, barres, nuage de points) */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  if (typeof document === 'undefined') return;

  function css(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function niceStep(range, target) {
    const raw = range / Math.max(1, target);
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  }
  function fmtTick(v) {
    const a = Math.abs(v);
    if (a >= 10000) return (v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' k';
    if (a >= 100 || v === 0) return Math.round(v).toLocaleString('fr-FR');
    if (a >= 1) return v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
    return v.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
  }
  function setupCanvas(cv) {
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    const r = cv.getBoundingClientRect();
    const w = Math.max(50, r.width), hh = Math.max(50, r.height);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(hh * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(hh * dpr);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: hh };
  }

  // ---------------------------------------------------------------- courbes
  class LineChart {
    constructor(canvas, opts) {
      this.cv = canvas;
      this.o = Object.assign({ yMin: null, yMax: null, refLines: [], fill: false, stacked: false, xFmt: null, yUnit: '', pad: [12, 12, 26, 48], step: false }, opts || {});
      this.xs = [];
      this.ys = [];
      this.hover = null;
      const self = this;
      canvas.addEventListener('pointermove', function (e) {
        const r = canvas.getBoundingClientRect();
        self.hover = e.clientX - r.left;
        self.draw();
      });
      canvas.addEventListener('pointerleave', function () { self.hover = null; self.draw(); });
      this._ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function () { self.draw(); }) : null;
      if (this._ro) this._ro.observe(canvas);
    }
    setData(xs, ys) { this.xs = xs; this.ys = ys; this.draw(); }
    destroy() { if (this._ro) this._ro.disconnect(); }
    draw() {
      const cv = this.cv;
      if (!cv.isConnected) return;
      const S = setupCanvas(cv), ctx = S.ctx, W = S.w, H = S.h;
      const o = this.o, pad = o.pad;
      const text = css('--muted', '#667'), line = css('--line', '#ddd');
      ctx.clearRect(0, 0, W, H);
      ctx.font = '11px ' + css('--font', 'sans-serif');
      const xs = this.xs, ys = this.ys;
      if (!xs.length) {
        ctx.fillStyle = text;
        ctx.textAlign = 'center';
        ctx.fillText('En attente de données…', W / 2, H / 2);
        return;
      }
      const series = o.series || [];
      // valeurs empilées éventuelles
      let vals = ys;
      if (o.stacked) {
        vals = ys.map(function () { return []; });
        for (let i = 0; i < xs.length; i++) {
          let acc = 0;
          for (let s = 0; s < ys.length; s++) {
            const v = ys[s][i];
            acc += Number.isFinite(v) ? v : 0;
            vals[s][i] = acc;
          }
        }
      }
      let lo = Infinity, hi = -Infinity;
      for (const arr of vals) for (const v of arr) if (Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
      for (const r of o.refLines) if (Number.isFinite(r.y)) { hi = Math.max(hi, r.y); lo = Math.min(lo, r.y); }
      if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
      if (o.yMin !== null) lo = Math.min(lo, o.yMin);
      if (o.yMax !== null) hi = Math.max(hi, o.yMax);
      if (hi - lo < 1e-9) { hi = lo + 1; }
      const step = niceStep(hi - lo, Math.max(2, Math.floor((H - pad[0] - pad[2]) / 40)));
      lo = Math.floor(lo / step) * step;
      hi = Math.ceil(hi / step) * step;
      // marge gauche adaptée à la plus longue graduation (avec l'unité)
      let labW = 0;
      for (let v = lo; v <= hi + step / 2; v += step) labW = Math.max(labW, ctx.measureText(fmtTick(v) + (o.yUnit && v + step > hi + step / 2 ? ' ' + o.yUnit : '')).width);
      const x0 = Math.max(pad[3], Math.ceil(labW) + 10), x1 = W - pad[1], y0 = H - pad[2], y1 = pad[0];
      const xmin = xs[0], xmax = xs[xs.length - 1] === xs[0] ? xs[0] + 1 : xs[xs.length - 1];
      const X = function (x) { return x0 + (x - xmin) / (xmax - xmin) * (x1 - x0); };
      const Y = function (y) { return y0 - (y - lo) / (hi - lo) * (y0 - y1); };
      // grille
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      ctx.fillStyle = text;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let v = lo; v <= hi + step / 2; v += step) {
        const y = Math.round(Y(v)) + 0.5;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
        ctx.fillText(fmtTick(v) + (o.yUnit && v + step > hi + step / 2 ? ' ' + o.yUnit : ''), x0 - 6, y);
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const nx = Math.max(2, Math.floor((x1 - x0) / 90));
      for (let i = 0; i <= nx; i++) {
        const xv = xmin + (xmax - xmin) * i / nx;
        ctx.textAlign = i === 0 ? 'left' : (i === nx ? 'right' : 'center');
        ctx.fillText(o.xFmt ? o.xFmt(xv) : fmtTick(xv), X(xv), y0 + 6);
      }
      ctx.textAlign = 'center';
      // séries
      for (let s = vals.length - 1; s >= 0; s--) {
        const arr = vals[s];
        const col = (series[s] && series[s].color) || '#3b82f6';
        ctx.strokeStyle = col;
        ctx.lineWidth = (series[s] && series[s].width) || 2;
        ctx.setLineDash((series[s] && series[s].dash) || []);
        ctx.beginPath();
        let started = false, prevY = null;
        for (let i = 0; i < xs.length; i++) {
          const v = arr[i];
          if (!Number.isFinite(v)) { started = false; continue; }
          const px = X(xs[i]), py = Y(v);
          if (!started) { ctx.moveTo(px, py); started = true; } else if (o.step) { ctx.lineTo(px, prevY); ctx.lineTo(px, py); } else ctx.lineTo(px, py);
          prevY = py;
        }
        ctx.stroke();
        ctx.setLineDash([]);
        if (o.fill || (series[s] && series[s].fill)) {
          ctx.globalAlpha = o.stacked ? 0.55 : 0.12;
          ctx.fillStyle = col;
          ctx.beginPath();
          let first = true;
          for (let i = 0; i < xs.length; i++) {
            const v = arr[i];
            if (!Number.isFinite(v)) continue;
            if (first) { ctx.moveTo(X(xs[i]), y0); first = false; }
            ctx.lineTo(X(xs[i]), Y(v));
          }
          for (let i = xs.length - 1; i >= 0; i--) {
            const below = o.stacked && s > 0 ? vals[s - 1][i] : lo;
            ctx.lineTo(X(xs[i]), Y(Number.isFinite(below) ? below : lo));
          }
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      // lignes de référence
      for (const r of o.refLines) {
        if (!Number.isFinite(r.y)) continue;
        const y = Y(r.y);
        ctx.strokeStyle = r.color || '#d64545';
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = r.color || '#d64545';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(r.label || '', x0 + 4, y - 2);
      }
      // survol
      if (this.hover !== null && this.hover >= x0 && this.hover <= x1) {
        const xv = xmin + (this.hover - x0) / (x1 - x0) * (xmax - xmin);
        let bi = 0, bd = Infinity;
        for (let i = 0; i < xs.length; i++) { const d = Math.abs(xs[i] - xv); if (d < bd) { bd = d; bi = i; } }
        const px = X(xs[bi]);
        ctx.strokeStyle = text;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, y1); ctx.lineTo(px, y0); ctx.stroke();
        const lines = [o.xFmt ? o.xFmt(xs[bi]) : String(xs[bi])];
        for (let s = 0; s < ys.length; s++) {
          const v = ys[s][bi];
          lines.push(((series[s] && series[s].name) || 'série ' + (s + 1)) + ' : ' + (Number.isFinite(v) ? fmtTick(Math.round(v * 100) / 100) : '--') + (o.yUnit ? ' ' + o.yUnit : ''));
        }
        const bw = Math.max.apply(null, lines.map(function (l) { return ctx.measureText(l).width; })) + 16;
        const bh = lines.length * 15 + 8;
        let bx = px + 10;
        if (bx + bw > W) bx = px - bw - 10;
        ctx.fillStyle = 'rgba(20,28,38,.9)';
        ctx.fillRect(bx, y1 + 4, bw, bh);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        lines.forEach(function (l, i) { ctx.fillText(l, bx + 8, y1 + 9 + i * 15); });
      }
    }
  }

  // ---------------------------------------------------------------- barres groupées
  function barChart(canvas, labels, groups, opts) {
    opts = opts || {};
    const S = setupCanvas(canvas), ctx = S.ctx, W = S.w, H = S.h;
    const text = css('--muted', '#667'), line = css('--line', '#ddd');
    ctx.clearRect(0, 0, W, H);
    ctx.font = '11px ' + css('--font', 'sans-serif');
    const pad = [14, 10, 34, 48];
    let hi = 0;
    for (const g of groups) for (const v of g.values) if (Number.isFinite(v)) hi = Math.max(hi, v);
    if (hi <= 0) hi = 1;
    const step = niceStep(hi, 4);
    hi = Math.ceil(hi / step) * step;
    const x0 = pad[3], x1 = W - pad[1], y0 = H - pad[2], y1 = pad[0];
    const Y = function (v) { return y0 - v / hi * (y0 - y1); };
    ctx.strokeStyle = line;
    ctx.fillStyle = text;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let v = 0; v <= hi + step / 2; v += step) {
      const y = Math.round(Y(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.fillText(fmtTick(v), x0 - 6, y);
    }
    const n = labels.length, gw = (x1 - x0) / Math.max(1, n), bw = Math.min(46, (gw * 0.75) / Math.max(1, groups.length));
    labels.forEach(function (lab, i) {
      const cx = x0 + gw * (i + 0.5);
      groups.forEach(function (g, j) {
        const v = g.values[i];
        if (!Number.isFinite(v)) return;
        const bx = cx - (groups.length * bw) / 2 + j * bw;
        ctx.fillStyle = g.color;
        ctx.fillRect(bx + 1, Y(v), bw - 2, y0 - Y(v));
        if (opts.showValues) {
          ctx.fillStyle = css('--text', '#222');
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(fmtTick(Math.round(v * 100) / 100), bx + bw / 2, Y(v) - 2);
        }
      });
      ctx.fillStyle = text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(lab, cx, y0 + 6);
    });
  }

  // ---------------------------------------------------------------- nuage de points (k-NN)
  // points : [{x, y, color, label, r, ring}] ; axes : {xMin, xMax, yMin, yMax, xLog, xLabel, yLabel}
  function scatter(canvas, points, axes, links) {
    const S = setupCanvas(canvas), ctx = S.ctx, W = S.w, H = S.h;
    const text = css('--muted', '#667'), line = css('--line', '#ddd');
    ctx.clearRect(0, 0, W, H);
    ctx.font = '11px ' + css('--font', 'sans-serif');
    const pad = [14, 14, 40, 52];
    const x0 = pad[3], x1 = W - pad[1], y0 = H - pad[2], y1 = pad[0];
    const tx = function (x) { return axes.xLog ? Math.log10(Math.max(x, 0.1)) : x; };
    const X = function (x) { return x0 + (tx(x) - tx(axes.xMin)) / (tx(axes.xMax) - tx(axes.xMin)) * (x1 - x0); };
    const Y = function (y) { return y0 - (y - axes.yMin) / (axes.yMax - axes.yMin) * (y0 - y1); };
    ctx.strokeStyle = line;
    ctx.fillStyle = text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xt = axes.xLog ? [0.1, 1, 10, 100, 1000, 10000] : [];
    for (const v of xt) {
      if (v < axes.xMin || v > axes.xMax) continue;
      const x = Math.round(X(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y0); ctx.stroke();
      ctx.fillText(fmtTick(v) + ' W', x, y0 + 5);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let v = axes.yMin; v <= axes.yMax + 1e-9; v += 0.2) {
      const y = Math.round(Y(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.fillText(v.toFixed(1), x0 - 6, y);
    }
    ctx.textAlign = 'center';
    ctx.fillText(axes.xLabel || '', (x0 + x1) / 2, H - 9);
    ctx.save();
    ctx.translate(12, (y0 + y1) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(axes.yLabel || '', 0, 0);
    ctx.restore();
    for (const l of links || []) {
      ctx.strokeStyle = l.color || '#888';
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(X(l.x1), Y(l.y1)); ctx.lineTo(X(l.x2), Y(l.y2)); ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const p of points) {
      const px = X(p.x), py = Y(p.y);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (p.star) {
        for (let i = 0; i < 10; i++) {
          const a = Math.PI / 5 * i - Math.PI / 2, r = i % 2 ? 5 : 11;
          ctx.lineTo(px + r * Math.cos(a), py + r * Math.sin(a));
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        ctx.arc(px, py, p.r || 5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (p.label) {
        ctx.fillStyle = css('--text', '#222');
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.label, px + 9, py - 9);
      }
    }
  }

  EL.charts = { LineChart: LineChart, barChart: barChart, scatter: scatter, niceStep: niceStep, fmtTick: fmtTick, css: css };
})(typeof globalThis !== 'undefined' ? globalThis : this);

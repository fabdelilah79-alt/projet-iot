/* EnergyLab — utilitaires communs (DOM, formats, stockage local, événements) */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  const hasDOM = typeof document !== 'undefined';

  // ---------------------------------------------------------------- DOM
  // h('div.card#id', {onclick, style, title, dataset}, [enfants...])
  function h(tag, attrs, children) {
    const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(tag) || [];
    const el = document.createElement(m[1] || 'div');
    (m[2] || '').replace(/([.#])([\w-]+)/g, function (_, t, v) {
      if (t === '.') el.classList.add(v); else el.id = v;
    });
    if (attrs && (Array.isArray(attrs) || typeof attrs !== 'object' || attrs instanceof Node)) {
      children = attrs;
      attrs = null;
    }
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else if (k === 'class') el.className = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    append(el, children);
    return el;
  }
  function append(el, children) {
    if (children === undefined || children === null || children === false) return el;
    if (!Array.isArray(children)) children = [children];
    for (const c of children) {
      if (c === undefined || c === null || c === false) continue;
      if (Array.isArray(c)) append(el, c);
      else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }
  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }
  function svg(tag, attrs, children) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    let style = '';
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v === undefined || v === null) continue;
        // les variables CSS ne sont pas fiables dans les attributs de présentation SVG : on passe par style
        if (typeof v === 'string' && v.indexOf('var(') >= 0 && k !== 'style') style += k + ':' + v + ';';
        else if (k === 'style') style += v;
        else el.setAttribute(k, v);
      }
      if (style) el.setAttribute('style', style);
    }
    if (children) for (const c of [].concat(children)) if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    return el;
  }

  // ---------------------------------------------------------------- formats
  const NB = ' '; // espace fine insécable
  function fmt(v, dec, unit) {
    if (v === null || v === undefined || Number.isNaN(v) || !Number.isFinite(v)) return '--' + (unit ? NB + unit : '');
    const s = Number(v).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return unit ? s + NB + unit : s;
  }
  // puissance : W ou kW
  function fmtP(w) {
    if (w === null || w === undefined || Number.isNaN(w)) return '--' + NB + 'W';
    if (Math.abs(w) >= 10000) return fmt(w / 1000, 1, 'kW');
    if (Math.abs(w) >= 100) return fmt(w, 0, 'W');
    return fmt(w, 1, 'W');
  }
  // énergie à partir de Wh
  function fmtE(wh) {
    if (wh === null || wh === undefined || Number.isNaN(wh)) return '--' + NB + 'Wh';
    if (Math.abs(wh) >= 1000) return fmt(wh / 1000, 3, 'kWh');
    if (Math.abs(wh) >= 10) return fmt(wh, 1, 'Wh');
    return fmt(wh, 2, 'Wh');
  }
  function fmtMoney(v, cur) { return fmt(v, v !== null && Math.abs(v) < 1 ? 3 : 2, cur || ''); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDuration(s) {
    if (s === null || s === undefined || Number.isNaN(s)) return '--';
    s = Math.round(s);
    if (s < 60) return s + NB + 's';
    if (s < 3600) return Math.floor(s / 60) + NB + 'min' + (s % 60 ? NB + pad2(s % 60) + NB + 's' : '');
    return Math.floor(s / 3600) + NB + 'h' + NB + pad2(Math.floor((s % 3600) / 60));
  }
  function fmtClock(epoch, tzMin) {
    if (!epoch) return '--:--';
    const d = new Date((epoch + (tzMin || 0) * 60) * 1000);
    return pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes());
  }
  function fmtDateTime(epoch, tzMin) {
    if (!epoch) return '';
    const d = new Date((epoch + (tzMin || 0) * 60) * 1000);
    return pad2(d.getUTCDate()) + '/' + pad2(d.getUTCMonth() + 1) + ' ' + pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ':' + pad2(d.getUTCSeconds());
  }
  function dayKeyToDate(dayKey) {
    const d = new Date(dayKey * 86400000);
    return pad2(d.getUTCDate()) + '/' + pad2(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear();
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  // garde la fin d'un historique à partir du dernier saut d'horloge (mise à l'heure du kit)
  function contiguousTail(list, maxGap) {
    maxGap = maxGap || 120;
    let start = 0;
    for (let i = 1; i < list.length; i++) {
      const d = list[i].t - list[i - 1].t;
      if (d <= 0 || d > maxGap) start = i;
    }
    return start ? list.slice(start) : list;
  }

  // ---------------------------------------------------------------- stockage local (jamais bloquant)
  const store = {
    get(key, def) {
      try {
        const v = root.localStorage && root.localStorage.getItem('elab.' + key);
        return v === null || v === undefined ? def : JSON.parse(v);
      } catch (e) { return def; }
    },
    set(key, val) {
      try { if (root.localStorage) root.localStorage.setItem('elab.' + key, JSON.stringify(val)); return true; } catch (e) { return false; }
    },
    del(key) { try { if (root.localStorage) root.localStorage.removeItem('elab.' + key); } catch (e) { /* rien */ } }
  };
  const session = {
    get(key, def) {
      try { const v = root.sessionStorage && root.sessionStorage.getItem('elab.' + key); return v === null || v === undefined ? def : JSON.parse(v); } catch (e) { return def; }
    },
    set(key, val) { try { if (root.sessionStorage) root.sessionStorage.setItem('elab.' + key, JSON.stringify(val)); } catch (e) { /* rien */ } },
    del(key) { try { if (root.sessionStorage) root.sessionStorage.removeItem('elab.' + key); } catch (e) { /* rien */ } }
  };

  // ---------------------------------------------------------------- événements
  class Emitter {
    constructor() { this._h = {}; }
    on(ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); return () => this.off(ev, fn); }
    off(ev, fn) { const a = this._h[ev]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } }
    emit(ev, data) {
      const a = this._h[ev];
      if (!a) return;
      for (const fn of a.slice()) {
        try { fn(data); } catch (e) { if (root.console) console.error('[EL] ' + ev, e); }
      }
    }
  }

  // ---------------------------------------------------------------- divers
  function download(filename, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function csvEscape(v) {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(rows, sep) {
    sep = sep || ';';
    return '﻿' + rows.map(function (r) { return r.map(csvEscape).join(sep); }).join('\r\n');
  }
  function parseCsv(text) {
    const rows = [];
    let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',' || c === ';') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c !== '\r' && c !== '﻿') cur += c;
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function debounce(fn, ms) {
    let t = null;
    return function () {
      const args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }
  // Générateur pseudo-aléatoire reproductible (simulations)
  function rng(seed) {
    let x = (seed >>> 0) || 0x12345678;
    return function () {
      x ^= x << 13; x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5; x >>>= 0;
      return x / 4294967296;
    };
  }
  function gauss(r) {
    const u = Math.max(1e-12, r()), v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  EL.util = {
    h, append, clear, $, $$, svg, fmt, fmtP, fmtE, fmtMoney, fmtDuration, fmtClock, fmtDateTime, dayKeyToDate,
    pad2, escapeHtml, clamp, contiguousTail, store, session, Emitter, download, toCsv, parseCsv, csvEscape, fnv1a, uid, debounce,
    rng, gauss, hasDOM, NB
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

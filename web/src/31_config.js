/* EnergyLab — configuration du kit et paramètres (copie de firmware/src/config.cpp) */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};

  const PERM = { RELAY: 1, PARAMS: 2, PROGRAM: 4, RESET_ENERGY: 8, KNN: 16, REARM: 32 };

  function defaults(kitId) {
    const names = ['Salon', 'Cuisine', 'Chambre', 'Bureau'];
    const icons = ['lamp', 'kettle', 'heater', 'laptop'];
    const prio = [2, 1, 4, 3];
    return {
      kitName: 'Kit EnergyLab',
      outlets: names.map(function (n, k) {
        return { name: n, icon: icons[k], enabled: true, maxPower: 2000, pzemAlarm: 2300, priority: prio[k], bootState: 0, minSwitchS: 2, standbyW: 3, ctTurns: 1, calU: 1, calI: 1 };
      }),
      net: { wifiMode: 0, staSsid: '', staPass: '', apSsid: 'EnergyLab-' + (kitId || 'SIMU'), apPass: 'energie123', apAlways: true, hostname: 'energylab', tzMin: 60, tzAuto: true },
      tariff: { priceHP: 1.2, priceHC: 0.9, hpHc: false, hcStart: 22 * 60, hcEnd: 6 * 60, currency: 'DH', co2: 600, contractW: 3000 },
      measure: { sampleMs: 1000, smoothN: 1 },
      env: { tempSet: 20, tempHyst: 0.5, lightThr: 30, presenceS: 60, dhtOn: true, ldrOn: true, pirOn: true, ldrInvert: false },
      hw: { oledType: 0, buzzerOn: true, relayActiveLow: true },
      safety: { maxTotalW: 2300, hardMaxOutletW: 2300, minSwitchFloorS: 1 },
      ai: { anomalyZ: 4, knnK: 3, knnMaxDist: 3 },
      peda: { pin: '1234', perms: PERM.RELAY | PERM.PARAMS | PERM.PROGRAM | PERM.KNN | PERM.REARM, scaffold: 1, progAutostart: false },
      mqtt: { on: false, host: '', port: 1883, user: '', pass: '', base: 'energylab' }
    };
  }

  // Bornes des champs (pour la mise à jour partielle, comme configFromJson en C++)
  function lim(c) {
    return {
      outlet: { maxPower: [10, c.safety.hardMaxOutletW], pzemAlarm: [1, 23000, 1], priority: [1, 4, 1], bootState: [0, 2, 1], minSwitchS: [c.safety.minSwitchFloorS, 600], standbyW: [0, 200], ctTurns: [1, 10, 1], calU: [0.5, 1.5], calI: [0.5, 1.5] },
      tariff: { priceHP: [0, 100], priceHC: [0, 100], hcStart: [0, 1439, 1], hcEnd: [0, 1439, 1], co2: [0, 2000], contractW: [100, 12000] },
      measure: { sampleMs: [1000, 10000, 1], smoothN: [1, 10, 1] },
      env: { tempSet: [5, 35], tempHyst: [0.1, 5], lightThr: [0, 100], presenceS: [5, 3600, 1] },
      hw: { oledType: [0, 2, 1] },
      safety: { maxTotalW: [100, 3680], hardMaxOutletW: [10, 3680], minSwitchFloorS: [0.5, 60] },
      ai: { anomalyZ: [2, 10], knnK: [1, 7, 1], knnMaxDist: [0.5, 20] },
      peda: { perms: [0, 63, 1], scaffold: [0, 2, 1] },
      net: { wifiMode: [0, 1, 1], tzMin: [-720, 840, 1] },
      mqtt: { port: [1, 65535, 1] }
    };
  }

  function applyField(dst, key, v, bounds) {
    if (v === undefined || v === null) return false;
    const cur = dst[key];
    if (typeof cur === 'boolean') { if (typeof v !== 'boolean' || v === cur) return false; dst[key] = v; return true; }
    if (typeof cur === 'string') { if (typeof v !== 'string' || v === '********' || v === cur) return false; dst[key] = v; return true; }
    if (typeof cur === 'number') {
      let x = Number(v);
      if (Number.isNaN(x)) return false;
      if (bounds) {
        if (bounds[2]) x = Math.round(x);
        x = Math.min(bounds[1], Math.max(bounds[0], x));
      }
      if (x === cur) return false;
      dst[key] = x;
      return true;
    }
    return false;
  }

  // Mise à jour partielle ; renvoie true si un réglage réseau a changé
  function merge(c, patch) {
    let net = false;
    if (!patch) return false;
    const L = lim(c);
    if (typeof patch.kitName === 'string') c.kitName = patch.kitName;
    if (Array.isArray(patch.outlets)) {
      patch.outlets.forEach(function (o, k) {
        if (k >= 4 || !o) return;
        for (const key of Object.keys(c.outlets[k])) applyField(c.outlets[k], key, o[key], L.outlet[key]);
      });
    }
    for (const g of ['net', 'tariff', 'measure', 'env', 'hw', 'safety', 'ai', 'peda', 'mqtt']) {
      if (!patch[g]) continue;
      for (const key of Object.keys(c[g])) {
        if (g === 'peda' && key === 'pin' && typeof patch.peda.pin === 'string' && (patch.peda.pin.length < 4 || patch.peda.pin.length > 8)) continue;
        const changed = applyField(c[g], key, patch[g][key], L[g] && L[g][key]);
        if (changed && g === 'net' && key !== 'tzMin' && key !== 'tzAuto') net = true;
      }
    }
    for (const o of c.outlets) {
      if (o.maxPower > c.safety.hardMaxOutletW) o.maxPower = c.safety.hardMaxOutletW;
      if (o.minSwitchS < c.safety.minSwitchFloorS) o.minSwitchS = c.safety.minSwitchFloorS;
    }
    return net;
  }

  function clone(c) { return JSON.parse(JSON.stringify(c)); }
  function masked(c) {
    const m = clone(c);
    if (m.net.staPass) m.net.staPass = '********';
    if (m.net.apPass) m.net.apPass = '********';
    if (m.peda.pin) m.peda.pin = '********';
    if (m.mqtt.pass) m.mqtt.pass = '********';
    return m;
  }

  // ---------------------------------------------------------------- paramètres (bytecode §7)
  const PARAMS = {
    0: { name: 'puissance max', unit: 'W', outlet: true, get: function (c, k) { return c.outlets[k].maxPower; }, set: function (c, k, v) { c.outlets[k].maxPower = v; }, lo: function (c) { return 10; }, hi: function (c) { return c.safety.hardMaxOutletW; } },
    1: { name: "seuil d'alarme du capteur", unit: 'W', outlet: true, int: true, get: function (c, k) { return c.outlets[k].pzemAlarm; }, set: function (c, k, v) { c.outlets[k].pzemAlarm = v; }, lo: function () { return 1; }, hi: function () { return 23000; } },
    2: { name: 'priorité', unit: '', outlet: true, int: true, get: function (c, k) { return c.outlets[k].priority; }, set: function (c, k, v) { c.outlets[k].priority = v; }, lo: function () { return 1; }, hi: function () { return 4; } },
    3: { name: 'état au démarrage', unit: '', outlet: true, int: true, get: function (c, k) { return c.outlets[k].bootState; }, set: function (c, k, v) { c.outlets[k].bootState = v; }, lo: function () { return 0; }, hi: function () { return 2; } },
    4: { name: 'délai entre commutations', unit: 's', outlet: true, get: function (c, k) { return c.outlets[k].minSwitchS; }, set: function (c, k, v) { c.outlets[k].minSwitchS = v; }, lo: function (c) { return c.safety.minSwitchFloorS; }, hi: function () { return 600; } },
    5: { name: 'seuil de veille', unit: 'W', outlet: true, get: function (c, k) { return c.outlets[k].standbyW; }, set: function (c, k, v) { c.outlets[k].standbyW = v; }, lo: function () { return 0; }, hi: function () { return 200; } },
    10: { name: 'période de mesure', unit: 'ms', int: true, get: function (c) { return c.measure.sampleMs; }, set: function (c, k, v) { c.measure.sampleMs = v; }, lo: function () { return 1000; }, hi: function () { return 10000; } },
    11: { name: 'lissage', unit: '', int: true, get: function (c) { return c.measure.smoothN; }, set: function (c, k, v) { c.measure.smoothN = v; }, lo: function () { return 1; }, hi: function () { return 10; } },
    12: { name: 'puissance souscrite', unit: 'W', get: function (c) { return c.tariff.contractW; }, set: function (c, k, v) { c.tariff.contractW = v; }, lo: function () { return 100; }, hi: function () { return 12000; } },
    13: { name: 'prix heures pleines', unit: '', get: function (c) { return c.tariff.priceHP; }, set: function (c, k, v) { c.tariff.priceHP = v; }, lo: function () { return 0; }, hi: function () { return 100; } },
    14: { name: 'prix heures creuses', unit: '', get: function (c) { return c.tariff.priceHC; }, set: function (c, k, v) { c.tariff.priceHC = v; }, lo: function () { return 0; }, hi: function () { return 100; } },
    15: { name: 'consigne de température', unit: '°C', get: function (c) { return c.env.tempSet; }, set: function (c, k, v) { c.env.tempSet = v; }, lo: function () { return 5; }, hi: function () { return 35; } },
    16: { name: 'hystérésis', unit: '°C', get: function (c) { return c.env.tempHyst; }, set: function (c, k, v) { c.env.tempHyst = v; }, lo: function () { return 0.1; }, hi: function () { return 5; } },
    17: { name: 'seuil de luminosité', unit: '%', get: function (c) { return c.env.lightThr; }, set: function (c, k, v) { c.env.lightThr = v; }, lo: function () { return 0; }, hi: function () { return 100; } },
    18: { name: 'délai de présence', unit: 's', int: true, get: function (c) { return c.env.presenceS; }, set: function (c, k, v) { c.env.presenceS = v; }, lo: function () { return 5; }, hi: function () { return 3600; } },
    19: { name: 'facteur CO2', unit: 'g/kWh', get: function (c) { return c.tariff.co2; }, set: function (c, k, v) { c.tariff.co2 = v; }, lo: function () { return 0; }, hi: function () { return 2000; } },
    20: { name: "seuil d'anomalie", unit: '', get: function (c) { return c.ai.anomalyZ; }, set: function (c, k, v) { c.ai.anomalyZ = v; }, lo: function () { return 2; }, hi: function () { return 10; } },
    21: { name: 'k (k-NN)', unit: '', int: true, get: function (c) { return c.ai.knnK; }, set: function (c, k, v) { c.ai.knnK = v; }, lo: function () { return 1; }, hi: function () { return 7; } },
    22: { name: 'début heures creuses', unit: 'min', int: true, get: function (c) { return c.tariff.hcStart; }, set: function (c, k, v) { c.tariff.hcStart = v; }, lo: function () { return 0; }, hi: function () { return 1439; } },
    23: { name: 'fin heures creuses', unit: 'min', int: true, get: function (c) { return c.tariff.hcEnd; }, set: function (c, k, v) { c.tariff.hcEnd = v; }, lo: function () { return 0; }, hi: function () { return 1439; } }
  };

  function paramValid(p) { return Object.prototype.hasOwnProperty.call(PARAMS, p); }
  function paramIsOutlet(p) { return paramValid(p) && !!PARAMS[p].outlet; }
  function paramGet(c, p, idx) {
    if (!paramValid(p)) return NaN;
    const d = PARAMS[p];
    if (d.outlet) { if (idx < 1 || idx > 4) return NaN; return d.get(c, idx - 1); }
    return d.get(c);
  }
  // renvoie {ok, applied, msg}
  function paramSet(c, p, idx, v) {
    if (!paramValid(p)) return { ok: false, msg: 'paramètre inconnu' };
    const d = PARAMS[p];
    if (d.outlet && (idx < 1 || idx > 4)) return { ok: false, msg: 'numéro de prise invalide' };
    if (Number.isNaN(v)) return { ok: false, msg: 'valeur invalide' };
    const lo = d.lo(c), hi = d.hi(c);
    let x = v;
    if (d.int) x = Math.floor(x + 0.5);
    if (x < lo) x = lo;
    if (x > hi) x = hi;
    let msg = '';
    if (x !== v) msg = 'valeur ajustée à ' + x + ' (limites ' + lo + ' … ' + hi + ')';
    d.set(c, d.outlet ? idx - 1 : 0, x);
    return { ok: true, applied: x, msg: msg };
  }

  function isOffPeak(c, mod) {
    const t = c.tariff;
    if (!t.hpHc || t.hcStart === t.hcEnd) return false;
    if (t.hcStart < t.hcEnd) return mod >= t.hcStart && mod < t.hcEnd;
    return mod >= t.hcStart || mod < t.hcEnd;
  }
  function priceAt(c, mod, timeValid) { return (timeValid && isOffPeak(c, mod)) ? c.tariff.priceHC : c.tariff.priceHP; }

  EL.config = { PERM, defaults, merge, clone, masked, PARAMS, paramValid, paramIsOutlet, paramGet, paramSet, isOffPeak, priceAt };
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* EnergyLab — modèle physique de la maison (jumeau numérique)
 *  - catalogue d'appareils réalistes (résistifs, moteurs, électroniques, programmes)
 *  - thermique de la pièce, chauffe-eau, réfrigérateur, lumière du jour, présence
 *  - émulation des capteurs PZEM-004T (quantification, seuil de démarrage, retard)
 *  - scénarios de journée pour l'arène de comparaison des algorithmes */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};

  // ---------------------------------------------------------------- catalogue
  const APPLIANCES = {
    none: { name: 'Rien de branché', icon: '⭕', cat: '—', model: 'none' },
    lamp_led: { name: 'Lampe LED 9 W', icon: '💡', cat: 'électronique', model: 'simple', P: 9, pf: 0.88, light: true },
    lamp_halo: { name: 'Lampe halogène 42 W', icon: '💡', cat: 'résistif', model: 'simple', P: 42, pf: 1.0, light: true },
    lamp_cfl: { name: 'Lampe fluocompacte 15 W', icon: '💡', cat: 'électronique', model: 'simple', P: 15, pf: 0.58, light: true },
    kettle: { name: 'Bouilloire 2000 W', icon: '🫖', cat: 'résistif', model: 'timed', P: 2000, pf: 1.0, duration: 170 },
    heater: { name: 'Convecteur 1000 W', icon: '🔥', cat: 'résistif', model: 'heater', P: 1000, pf: 1.0 },
    fan: { name: 'Ventilateur 45 W', icon: '🌀', cat: 'moteur (inductif)', model: 'simple', P: 45, pf: 0.76, noise: 0.03 },
    fridge: { name: 'Réfrigérateur', icon: '🧊', cat: 'compresseur (inductif)', model: 'fridge', P: 110, pf: 0.66, standby: 1.5, standbyPf: 0.4, inrush: 550 },
    charger: { name: 'Chargeur de téléphone', icon: '🔋', cat: 'électronique', model: 'charger', P: 10, pf: 0.55, full: 5400, trickle: 1.2, standby: 0.3, standbyPf: 0.3 },
    tvbox: { name: 'Décodeur TV + console', icon: '🎮', cat: 'électronique', model: 'standby', P: 35, pf: 0.6, standby: 14, standbyPf: 0.45, noise: 0.1 },
    tv: { name: 'Téléviseur', icon: '📺', cat: 'électronique', model: 'standby', P: 85, pf: 0.95, standby: 1.5, standbyPf: 0.3, noise: 0.08 },
    laptop: { name: 'Ordinateur portable', icon: '💻', cat: 'électronique', model: 'standby', P: 60, pf: 0.62, standby: 0.6, standbyPf: 0.3, noise: 0.15 },
    washer: { name: 'Lave-linge', icon: '🧺', cat: 'mixte (résistance + moteur)', model: 'program', phases: [{ d: 900, P: 2000, pf: 1.0 }, { d: 2400, P: 230, pf: 0.68, noise: 0.25 }, { d: 600, P: 420, pf: 0.8, noise: 0.15 }], standby: 1, standbyPf: 0.4 },
    water_heater: { name: 'Chauffe-eau 100 L (1200 W)', icon: '🚿', cat: 'résistif', model: 'waterheater', P: 1200, pf: 1.0 },
    iron: { name: 'Fer à repasser', icon: '👔', cat: 'résistif', model: 'cycling', P: 1100, pf: 1.0, onS: 40, offS: 25 },
    microwave: { name: 'Micro-ondes', icon: '🍲', cat: 'électronique', model: 'timed', P: 1150, pf: 0.95, duration: 180, standby: 2, standbyPf: 0.35 },
    ac: { name: 'Climatiseur 900 W', icon: '❄️', cat: 'compresseur (inductif)', model: 'cooler', P: 900, pf: 0.92, fanP: 40, fanPf: 0.8 },
    router: { name: 'Box Internet', icon: '📶', cat: 'électronique', model: 'simple', P: 9, pf: 0.55 },
    motor: { name: 'Moteur / perceuse 600 W', icon: '🛠️', cat: 'moteur (inductif)', model: 'simple', P: 600, pf: 0.82, noise: 0.05 }
  };

  // Instance d'appareil : sw = interrupteur de l'appareil (souhait de l'utilisateur)
  function makeAppliance(id, opts) {
    const def = APPLIANCES[id] || APPLIANCES.none;
    return Object.assign({ id: id, def: def, sw: false, t: 0, phase: 0, done: 0, tin: 4, cooling: false, tw: 58, heating: false, cyc: 0, served: 0, unserved: 0, startedAt: -1, finishedAt: -1, p: 0, pf: 1 }, opts || {});
  }

  // Avance un appareil de dt secondes. powered = relais de la prise fermé.
  // Renvoie {p, pf} et met à jour a.demand (l'appareil a besoin d'énergie maintenant).
  function stepAppliance(a, powered, dt, ctx) {
    const d = a.def;
    let p = 0, pf = 1;
    const noise = d.noise ? 1 + d.noise * (ctx.rnd() - 0.5) * 2 : 1;
    a.demand = false;
    switch (d.model) {
      case 'simple':
        a.demand = a.sw && (!d.light || ctx.presence);
        if (a.sw && powered) { p = d.P * noise; pf = d.pf; }
        break;
      case 'timed': // bouilloire, micro-ondes : s'arrête seul après 'duration' secondes alimentées
        if (a.sw) {
          a.demand = true;
          if (powered) { a.t += dt; p = d.P; pf = d.pf; if (a.t >= d.duration) { a.sw = false; a.t = 0; } }
        } else if (powered && d.standby) { p = d.standby; pf = d.standbyPf; }
        break;
      case 'heater':
        a.demand = a.sw;
        if (a.sw && powered) { p = d.P; pf = d.pf; ctx.heat += d.P; }
        break;
      case 'cooler':
        a.demand = a.sw;
        if (a.sw && powered) {
          if (ctx.troom > 25) a.cooling = true;
          else if (ctx.troom < 23) a.cooling = false;
          if (a.cooling) { p = d.P; pf = d.pf; ctx.heat -= d.P * 2.5; } else { p = d.fanP; pf = d.fanPf; }
        } else a.cooling = false;
        break;
      case 'fridge': { // température intérieure 3..6 °C
        const running = a.tin > 6 || (a.cooling && a.tin > 3);
        a.demand = a.tin > 6 || (a.cooling && a.tin > 3);
        if (powered && running) {
          if (!a.cooling) a.t = 0;
          a.cooling = true;
          a.t += dt;
          p = a.t <= 1 ? d.inrush : d.P * (0.97 + 0.06 * ctx.rnd());
          pf = d.pf;
          a.tin -= dt / 200;
        } else {
          a.cooling = false;
          if (powered) { p = d.standby; pf = d.standbyPf; }
          a.tin += dt / 420;
        }
        break;
      }
      case 'charger':
        if (a.sw) { // téléphone branché
          a.demand = a.t < d.full;
          if (powered) { a.t += dt; if (a.t < d.full) { p = d.P; pf = d.pf; } else { p = d.trickle; pf = 0.4; } }
        } else { a.t = 0; if (powered) { p = d.standby; pf = d.standbyPf; } }
        break;
      case 'standby': // TV, ordinateur : veille quand l'utilisateur l'éteint
        a.demand = a.sw;
        if (powered) { if (a.sw) { p = d.P * noise; pf = d.pf; } else { p = d.standby; pf = d.standbyPf; } }
        break;
      case 'program': { // lave-linge : programme en phases, reprend après coupure
        if (a.sw) {
          a.demand = true;
          if (powered) {
            if (a.startedAt < 0) a.startedAt = ctx.minute;
            a.t += dt;
            let acc = 0, ph = null;
            for (const x of d.phases) { acc += x.d; if (a.t < acc) { ph = x; break; } }
            if (ph) { p = ph.P * (ph.noise ? 1 + ph.noise * (ctx.rnd() - 0.5) * 2 : 1); pf = ph.pf; } else { a.sw = false; a.t = 0; a.done++; a.finishedAt = ctx.minute; }
          }
        } else if (powered) { p = d.standby; pf = d.standbyPf; }
        break;
      }
      case 'waterheater': { // 100 L : 1200 W -> +10,3 °C/h ; pertes 0,2 °C/h ; thermostat 55..60 °C
        if (a.tw < 55) a.heating = true;
        else if (a.tw >= 60) a.heating = false;
        a.demand = a.heating;
        if (a.heating && powered) { p = d.P; pf = d.pf; a.tw += dt * 10.3 / 3600; }
        a.tw -= dt * 0.2 / 3600;
        break;
      }
      case 'cycling': // fer à repasser : thermostat interne
        a.demand = a.sw;
        if (a.sw && powered) {
          a.cyc += dt;
          const per = d.onS + d.offS;
          if (a.cyc % per < d.onS) { p = d.P; pf = d.pf; } else { p = 0.5; pf = 0.5; }
        }
        break;
      default:
        break;
    }
    a.p = p;
    a.pf = p > 0 ? pf : 1;
    return a;
  }

  // ---------------------------------------------------------------- maison
  class House {
    constructor(opts) {
      opts = opts || {};
      this.rnd = EL.util.rng(opts.seed || 12345);
      this.outlets = [0, 1, 2, 3].map(function () { return { apps: [], meterWh: 0, acc: { p: 0, q: 0, n: 0 }, last: null }; });
      this.troom = opts.troom !== undefined ? opts.troom : 19;
      this.toutMean = opts.toutMean !== undefined ? opts.toutMean : 10;
      this.toutAmp = opts.toutAmp !== undefined ? opts.toutAmp : 5;
      this.toutOverride = null;
      this.lightOverride = null;
      this.presence = opts.presence !== undefined ? opts.presence : true;
      this.presenceMode = opts.presenceMode || 'manual';  // 'manual' | 'schedule'
      this.schedule = opts.schedule || null;
      this.voltageNominal = 230;
      this.hum = 45;
      this.lightExtra = 0;
      this.R = 0.02;       // °C/W (déperditions de la pièce : 50 W/°C)
      this.C = 2.0e6;      // J/°C (inertie air + murs + meubles) : constante de temps R·C ≈ 11 h
      this.ctTurns = [1, 1, 1, 1];
    }
    setAppliances(k, ids) {
      this.outlets[k].apps = ids.map(function (x) { return typeof x === 'string' ? makeAppliance(x) : makeAppliance(x.id, x); });
    }
    tout(minuteOfDay) {
      if (this.toutOverride !== null) return this.toutOverride;
      return this.toutMean + this.toutAmp * Math.cos(2 * Math.PI * (minuteOfDay / 60 - 15) / 24);
    }
    daylight(minuteOfDay) {
      if (this.lightOverride !== null) return this.lightOverride;
      const h = minuteOfDay / 60;
      return Math.max(0, Math.sin(Math.PI * (h - 7) / 12)) * 85;
    }
    presenceAt(minuteOfDay) {
      if (this.presenceMode !== 'schedule' || !this.schedule) return this.presence;
      for (const iv of this.schedule) if (minuteOfDay >= iv[0] && minuteOfDay < iv[1]) return true;
      return false;
    }
    // avance la physique de dt secondes ; relays[k] = relais fermé
    step(dt, relays, minuteOfDay) {
      const ctx = { rnd: this.rnd, heat: 0, troom: this.troom, minute: minuteOfDay, presence: this.presence };
      let light = 0;
      for (let k = 0; k < 4; k++) {
        const o = this.outlets[k];
        let P = 0, Q = 0;
        for (const a of o.apps) {
          stepAppliance(a, !!relays[k], dt, ctx);
          if (a.p > 0) {
            P += a.p;
            Q += a.p * Math.tan(Math.acos(Math.min(1, Math.max(0.05, a.pf))));
            if (a.def.light) light += 25;
          }
          if (a.demand) { if (relays[k]) a.served += dt; else a.unserved += dt; }
        }
        o.acc.p += P * dt;
        o.acc.q += Q * dt;
        o.acc.n += dt;
        o.meterWh += P * dt / 3600;
        o.pNow = P;
        o.qNow = Q;
      }
      const tout = this.tout(minuteOfDay);
      // dT/dt = (Tout - T)/(R C) + Pchauffage / C
      this.troom += dt * ((tout - this.troom) / (this.R * this.C) + ctx.heat / this.C);
      this.lightExtra = light;
      this.presence = this.presenceAt(minuteOfDay);
      this.hum = 45 + 5 * Math.sin(minuteOfDay / 1440 * 2 * Math.PI) + (this.rnd() - 0.5);
    }
    // lecture d'un capteur PZEM (valeurs moyennées depuis la lecture précédente)
    readPzem(k, tSec) {
      const o = this.outlets[k];
      const n = o.acc.n || 1e-9;
      const P = o.acc.n ? o.acc.p / n : (o.pNow || 0);
      const Q = o.acc.n ? o.acc.q / n : (o.qNow || 0);
      o.acc = { p: 0, q: 0, n: 0 };
      const turns = this.ctTurns[k] || 1;
      const U = this.voltageNominal + 2.5 * Math.sin((tSec || 0) / 600) - 0.0015 * this.totalPNow() + EL.util.gauss(this.rnd) * 0.15;
      const S = Math.sqrt(P * P + Q * Q);
      let I = S / U * turns;
      let Pm = P * turns;
      let pf = S > 0 ? P / S : 0;
      if (I < 0.02) { I = 0; Pm = 0; pf = 0; } // seuil de démarrage du PZEM-004T 100 A
      const q = function (v, step) { return Math.round(v / step) * step; };
      const r = {
        ok: true,
        u: q(U, 0.1),
        i: q(I * (1 + EL.util.gauss(this.rnd) * 0.002), 0.001),
        p: q(Pm * (1 + EL.util.gauss(this.rnd) * 0.002), 0.1),
        eWh: Math.floor(o.meterWh * turns),
        f: q(50 + EL.util.gauss(this.rnd) * 0.02, 0.1),
        pf: q(pf, 0.01),
        alarm: false
      };
      if (r.p < 0) r.p = 0;
      return r;
    }
    totalPNow() { let t = 0; for (const o of this.outlets) t += o.pNow || 0; return t; }
    readEnv(minuteOfDay) {
      const lum = Math.min(100, this.daylight(minuteOfDay) + this.lightExtra + (this.rnd() - 0.5) * 2);
      return {
        temp: Math.round((this.troom + (this.rnd() - 0.5) * 0.2) * 10) / 10,
        hum: Math.round(this.hum * 10) / 10,
        lum: Math.round(Math.max(0, lum) * 10) / 10,
        motion: this.presence && this.rnd() < 0.35
      };
    }
  }

  // ---------------------------------------------------------------- scénarios (arène)
  // Horaires en minutes depuis minuit. 'on' : intervalles où l'utilisateur allume l'appareil ;
  // 'starts' : démarrages ponctuels (l'appareil s'arrête seul) ; 'auto' : toujours en service.
  const SCENARIOS = {
    hiver: {
      name: "Journée d'hiver en famille",
      desc: 'Convecteur allumé le soir et laissé en marche toute la nuit, lampe souvent oubliée, bouilloire, lave-linge lancé à 18 h 30 (à terminer avant 7 h), chauffe-eau, télévision. Tarif heures pleines / heures creuses, puissance souscrite 2 500 W.',
      tout: { mean: 8, amp: 5 }, troom: 18,
      tariff: { hpHc: true, priceHP: 1.6, priceHC: 0.9, hcStart: 22 * 60, hcEnd: 6 * 60 }, contractW: 2500,
      presence: [[6 * 60 + 30, 7 * 60 + 45], [12 * 60, 13 * 60 + 30], [17 * 60 + 30, 23 * 60]], // éveillés à la maison
      outlets: [
        { name: 'Salon', priority: 2, apps: [{ id: 'lamp_halo', when: 'dark-presence' }, { id: 'tv', on: [[19 * 60, 22 * 60 + 30]] }] },
        { name: 'Cuisine', priority: 1, apps: [{ id: 'fridge', auto: true }, { id: 'kettle', starts: [7 * 60, 12 * 60 + 30, 17 * 60 + 45] }, { id: 'microwave', starts: [12 * 60 + 15, 19 * 60 + 30] }] },
        { name: 'Chambre', priority: 4, apps: [{ id: 'heater', on: [[0, 7 * 60 + 45], [17 * 60 + 30, 24 * 60]] }, { id: 'charger', on: [[22 * 60, 24 * 60], [0, 6 * 60]] }] },
        { name: 'Buanderie', priority: 3, apps: [{ id: 'washer', starts: [18 * 60 + 30], deadline: 31 * 60 }, { id: 'water_heater', auto: true, draws: [[7 * 60, 18], [20 * 60 + 30, 18]] }] }
      ]
    },
    pointe: {
      name: 'Soirée de pointe',
      desc: 'Beaucoup d’appareils en même temps entre 18 h et 21 h : idéal pour tester le délestage et l’écrêtage de pointe. Puissance souscrite 2 500 W.',
      tout: { mean: 12, amp: 4 }, troom: 19,
      tariff: { hpHc: false, priceHP: 1.2, priceHC: 0.9, hcStart: 22 * 60, hcEnd: 6 * 60 }, contractW: 2500,
      presence: [[6 * 60 + 30, 8 * 60], [17 * 60, 23 * 60]],
      outlets: [
        { name: 'Salon', priority: 2, apps: [{ id: 'lamp_led', when: 'dark-presence' }, { id: 'tv', on: [[18 * 60, 23 * 60]] }, { id: 'laptop', on: [[18 * 60 + 30, 21 * 60]] }] },
        { name: 'Cuisine', priority: 1, apps: [{ id: 'fridge', auto: true }, { id: 'kettle', starts: [7 * 60 + 15, 18 * 60 + 10, 20 * 60] }, { id: 'microwave', starts: [18 * 60 + 40, 19 * 60 + 5] }] },
        { name: 'Chambre', priority: 4, apps: [{ id: 'heater', on: [[17 * 60, 23 * 60]] }] },
        { name: 'Atelier', priority: 3, apps: [{ id: 'iron', on: [[18 * 60 + 15, 19 * 60 + 15]] }, { id: 'motor', on: [[18 * 60 + 50, 19 * 60]] }] }
      ]
    },
    veille: {
      name: 'Consommations cachées (veille)',
      desc: 'Été, sans chauffage : la consommation vient surtout des veilles (TV, décodeur, console, ordinateur, chargeurs, box) et de l’éclairage oublié la nuit. Idéal pour le « tueur de veille » et l’éclairage intelligent.',
      tout: { mean: 26, amp: 6 }, troom: 25,
      tariff: { hpHc: false, priceHP: 1.2, priceHC: 0.9, hcStart: 22 * 60, hcEnd: 6 * 60 }, contractW: 3000,
      presence: [[6 * 60 + 30, 8 * 60], [13 * 60, 14 * 60], [18 * 60, 23 * 60 + 30]],
      outlets: [
        { name: 'Salon', priority: 2, apps: [{ id: 'tv', on: [[20 * 60, 22 * 60]] }, { id: 'tvbox', on: [[20 * 60, 22 * 60]] }, { id: 'lamp_cfl', when: 'dark-presence' }] },
        { name: 'Cuisine', priority: 1, apps: [{ id: 'fridge', auto: true }, { id: 'microwave', starts: [13 * 60 + 10, 19 * 60 + 45] }] },
        { name: 'Chambre', priority: 4, apps: [{ id: 'fan', on: [[22 * 60, 24 * 60], [0, 6 * 60]] }, { id: 'charger', on: [[23 * 60, 24 * 60], [0, 7 * 60]] }] },
        { name: 'Bureau', priority: 3, apps: [{ id: 'laptop', on: [[18 * 60 + 30, 20 * 60]] }, { id: 'router', auto: true }] }
      ]
    }
  };

  function inIntervals(m, list) {
    for (const iv of list) if (m >= iv[0] && m < iv[1]) return true;
    return false;
  }

  // Applique les habitudes des occupants (interrupteurs des appareils) pour la minute courante
  function applyHabits(house, scenario, minute, prevMinute) {
    const dark = house.daylight(minute) < 30;
    scenario.outlets.forEach(function (os, k) {
      const apps = house.outlets[k].apps;
      os.apps.forEach(function (spec, j) {
        const a = apps[j];
        if (!a) return;
        if (spec.auto) a.sw = true;
        if (spec.on) a.sw = inIntervals(minute, spec.on);
        if (spec.when === 'dark-presence') {
          // les occupants allument quand il fait sombre... et oublient souvent d'éteindre en partant
          if (!dark) a.sw = false;
          else if (house.presence) a.sw = true;
        }
        if (spec.starts && minute !== prevMinute) {
          for (const s of spec.starts) if (minute === s) a.sw = true;
        }
        if (spec.draws && minute !== prevMinute) {
          for (const dr of spec.draws) {
            if (minute === dr[0]) {
              a.drawCount = (a.drawCount || 0) + 1;
              if (a.tw < 40) a.coldDraws = (a.coldDraws || 0) + 1;
              a.tw -= dr[1];
            }
          }
        }
      });
    });
  }

  // Apprentissage de référence pour l'arène : mêmes numéros que si l'on entraînait l'IA dans cet ordre
  const KNN_REFERENCE = [['Bouilloire', 'kettle'], ['Convecteur', 'heater'], ['Réfrigérateur', 'fridge'], ['Micro-ondes', 'microwave'],
    ['Téléviseur', 'tv'], ['Ordinateur portable', 'laptop'], ['Lampe halogène', 'lamp_halo'], ['Fer à repasser', 'iron']];
  function pretrainKnn(knn, rnd) {
    for (const ref of KNN_REFERENCE) {
      const d = APPLIANCES[ref[1]];
      const id = knn.labelId(ref[0], true);
      for (let i = 0; i < 3; i++) knn.samples.push({ label: id, p: d.P * (1 + (rnd() - 0.5) * 0.06), pf: Math.min(1, d.pf * (1 + (rnd() - 0.5) * 0.04)) });
    }
  }

  EL.house = { KNN_REFERENCE, pretrainKnn, APPLIANCES, makeAppliance, stepAppliance, House, SCENARIOS, applyHabits, inIntervals };
})(typeof globalThis !== 'undefined' ? globalThis : this);

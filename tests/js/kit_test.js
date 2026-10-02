// Test du cœur du kit en JavaScript (web/src/34_kitcore.js) : mêmes vérifications que
// tests/native/test_kit.cpp, pour garantir que le simulateur et le kit réel se comportent pareil.
'use strict';
const { loadApp } = require('./load');
const EL = loadApp({ blockly: false });

let pass = 0, fail = 0;
function CHECK(c, what) { if (c) pass++; else { fail++; console.log('  ECHEC : ' + what + '  (' + new Error().stack.split('\n')[2].trim() + ')'); } }
function NEAR(a, b, eps, what) { CHECK(Math.abs(a - b) <= eps, (what || '') + ' ' + a + ' ≈ ' + b); }

const io = { logs: [], beeps: 0, resets: 0, alarms: 0, chg: 0,
  beep() { this.beeps++; }, screenMessage() {}, alertScreen() {}, pzemResetEnergy() { this.resets++; },
  pzemSetAlarm() { this.alarms++; }, configChanged() { this.chg++; }, onLog(e) { this.logs.push(e.msg); } };
const pins = [false, false, false, false];
const cfg = EL.config.defaults('TEST');
cfg.net.tzMin = 60;
const rel = new EL.relays.Relays(function (k, on) { pins[k] = on; });
const kit = new EL.kitcore.KitCore(cfg, rel, io);
kit.applyOutletConfig();
const SRC = EL.relays.SRC, RES = EL.relays.RES;
function meas(p, pf, u) {
  pf = pf === undefined ? 1 : pf; u = u || 230;
  return { ok: true, u: u, p: p, pf: pf, f: 50, i: pf > 0 && u > 0 ? p / (u * pf) : 0, eWh: 1000 };
}

console.log('[kit js]');
let t = 0;
// relais : délai minimum
CHECK(kit.userRelay(0, true, SRC.USER, t) === RES.OK, 'relais OK');
CHECK(pins[0], 'broche 1');
CHECK(kit.userRelay(0, false, SRC.USER, t + 500) === RES.DELAYED, 'commutation retardée');
kit.tick100(t + 1000); CHECK(pins[0], 'toujours allumé');
kit.tick100(t + 2000); CHECK(!pins[0], 'éteint après 2 s');
// mesures et grandeurs dérivées
kit.onMeasurement(1, meas(100, 0.5), t);
NEAR(kit.out[1].s, 200, 0.01, 'S');
NEAR(kit.out[1].q, Math.sqrt(200 * 200 - 100 * 100), 0.01, 'Q');
NEAR(kit.out[1].phi, 60, 0.01, 'phi');
NEAR(kit.out[1].eCounterKWh, 1.0, 1e-9, 'compteur');
// protection : 2 mesures > max -> verrouillage
t = 10000;
kit.userRelay(2, true, SRC.USER, t);
cfg.outlets[2].maxPower = 500;
kit.onMeasurement(2, meas(600), t);
CHECK(rel.isOn(2), 'une seule mesure au-dessus : pas de coupure');
kit.onMeasurement(2, meas(600), t + 1000);
CHECK(!rel.isOn(2) && rel.isLatched(2), 'verrouillage');
CHECK(kit.userRelay(2, true, SRC.USER, t + 5000) === RES.LATCHED, 'refus si verrouillée');
CHECK(kit.rearm(2), 'réarmement');
CHECK(kit.userRelay(2, true, SRC.USER, t + 5000) === RES.OK, 'rallumage');
kit.onMeasurement(2, meas(800), t + 6000);
CHECK(rel.isLatched(2), 'coupure immédiate si > 1,5 x max');
kit.rearm(2);
// énergie du jour : 1000 W pendant 3600 s = 1000 Wh
t = 100000;
for (let k = 0; k < 4; k++) kit.onMeasurement(k, meas(0), t);
kit.onMeasurement(0, meas(1000), t);
kit.tick1s(t);
const e0 = kit.out[0].eTodayWh;
for (let s = 1; s <= 3600; s++) kit.tick1s(t + s * 1000);
NEAR(kit.out[0].eTodayWh - e0, 1000, 1e-6, 'énergie');
NEAR(kit.out[0].costToday, kit.out[0].eTodayWh / 1000 * 1.2, 1e-6, 'coût');
NEAR(kit.peakToday, 1000, 1e-9, 'pointe');
// inactivité (veille)
t = 200000;
kit.userRelay(3, true, SRC.USER, t);
kit.onMeasurement(3, meas(2, 0.5), t);
for (let s = 0; s < 30; s++) kit.tick1s(t + s * 1000);
NEAR(kit.out[3].idleS, 29, 1e-9, 'inactivité');
// délestage par priorités {2,1,4,3}
t = 300000;
for (let k = 0; k < 4; k++) kit.userRelay(k, true, SRC.USER, t);
t += 2500;
kit.onMeasurement(0, meas(800), t); kit.onMeasurement(1, meas(900), t);
kit.onMeasurement(2, meas(400), t); kit.onMeasurement(3, meas(300), t);
kit.shedStep(2000, t + 500);
CHECK(kit.out[2].shed && !rel.isOn(2), 'prise 3 délestée');
kit.shedStep(2000, t + 1500);
CHECK(rel.isOn(3) && rel.isOn(0) && rel.isOn(1), 'retenue de 5 s');
kit.onMeasurement(2, meas(0), t + 6500);
kit.shedStep(2000, t + 6500);
CHECK(kit.out[2].shed && !rel.isOn(2), 'pas assez de marge');
kit.onMeasurement(1, meas(100), t + 7500);
kit.shedStep(2000, t + 12500);
CHECK(!kit.out[2].shed && rel.isOn(2), 'remise en service avec marge');
// sécurité puissance totale (2300 W)
t = 400000;
kit.onMeasurement(2, meas(400), t);
kit.onMeasurement(1, meas(1500), t);
kit.tick1s(t);
CHECK(!rel.isOn(2), 'sécurité totale');
// horloge, jour, rollover
kit.setClock(true, 1700000000);
const lt = kit.localTime();
CHECK(lt && lt.h === 23 && lt.m === 13 && lt.s === 20 && lt.wday === 2, 'heure locale');
kit.tick1s(t + 1000);
const eBefore = kit.totalEToday();
CHECK(eBefore > 0, 'énergie du jour');
kit.setClock(true, 1700000000 + 3600);
kit.tick1s(t + 2000);
CHECK(kit.days.length === 1, 'jour archivé');
CHECK(kit.totalEToday() < eBefore, 'remise à zéro du jour');
// paramètres bornés
cfg.peda.perms |= EL.config.PERM.PARAMS;
kit.setParam(10, 0, 500);
CHECK(cfg.measure.sampleMs === 1000, 'période bornée');
kit.setParam(2, 1, 9);
CHECK(cfg.outlets[0].priority === 4, 'priorité bornée');
CHECK(io.chg > 0, 'configuration modifiée');
kit.resetEnergy(1);
CHECK(io.resets === 0, 'remise à zéro refusée');
cfg.peda.perms |= EL.config.PERM.RESET_ENERGY;
kit.resetEnergy(1);
CHECK(io.resets === 1, 'remise à zéro autorisée');
// k-NN
for (let i = 0; i < 5; i++) kit.onMeasurement(0, meas(1980, 1.0), t + 3000 + i * 1000);
CHECK(kit.knnTrain(0, 'Bouilloire').ok, 'apprentissage 1');
for (let i = 0; i < 5; i++) kit.onMeasurement(0, meas(9, 0.55), t + 9000 + i * 1000);
CHECK(kit.knnTrain(0, 'Chargeur').ok, 'apprentissage 2');
kit.onMeasurement(0, meas(2005, 0.99), t + 20000);
kit.tick1s(t + 20000);
CHECK(kit.out[0].appliance === 1, 'reconnaissance');
// délestage : nouvel essai, délai doublé, un programme ne rallume pas une prise délestée
cfg.outlets[2].maxPower = 2000;
cfg.outlets[0].priority = 2;
t = 1000000;
for (let k = 0; k < 4; k++) { kit.rearm(k); kit.userRelay(k, true, SRC.USER, t); }
t += 3000;
kit.onMeasurement(0, meas(300), t); kit.onMeasurement(1, meas(200), t);
kit.onMeasurement(2, meas(1500), t); kit.onMeasurement(3, meas(100), t);
kit.shedStep(2000, t + 100);
CHECK(kit.out[2].shed && !rel.isOn(2), 'délestage');
NEAR(kit.out[2].retryMs, 120000, 1e-9, 'premier délai');
kit.relay(3, true);
CHECK(kit.out[2].shed && !rel.isOn(2), 'programme sans effet sur une prise délestée');
kit.onMeasurement(2, meas(0), t + 1000);
kit.shedStep(2000, t + 60000);
CHECK(kit.out[2].shed, 'délai non écoulé');
kit.shedStep(2000, t + 120100);
CHECK(!kit.out[2].shed && rel.isOn(2), 'nouvel essai');
kit.onMeasurement(2, meas(1500), t + 121000);
kit.shedStep(2000, t + 125200);
CHECK(kit.out[2].shed && !rel.isOn(2), 'nouvel échec');
NEAR(kit.out[2].retryMs, 240000, 1e-9, 'délai doublé');
kit.shedStep(2000, t + 325200);
CHECK(kit.out[2].shed, 'délai doublé non écoulé');
kit.tick1s(t + 365200);
CHECK(!kit.out[2].shed, 'délestage abandonné');

// sécurité totale : une prise allumée à l'instant (pas encore mesurée) est coupée en priorité
t = 2000000;
for (let k = 0; k < 4; k++) kit.rearm(k);
kit.userRelay(0, true, SRC.USER, t); kit.userRelay(1, true, SRC.USER, t);
kit.userRelay(2, false, SRC.USER, t); kit.userRelay(3, false, SRC.USER, t);
kit.onMeasurement(0, meas(300), t + 3000); kit.onMeasurement(1, meas(2100), t + 3000);
kit.onMeasurement(2, meas(0), t + 3000); kit.onMeasurement(3, meas(0), t + 3000);
CHECK(kit.userRelay(2, true, SRC.USER, t + 3000) === RES.OK, 'allumage du convecteur');
kit.tick1s(t + 3500);
CHECK(!rel.isOn(2) && rel.isOn(0) && rel.isOn(1), 'la prise qui vient de s’allumer est coupée en priorité');

// délestage et sécurité au même instant : la prise délestée ne compte plus, aucune autre n'est coupée
t = 2100000;
kit.userRelay(2, true, SRC.USER, t);
kit.onMeasurement(0, meas(300), t + 3000); kit.onMeasurement(1, meas(1800), t + 3000);
kit.onMeasurement(2, meas(1000), t + 3000);
kit.shedStep(3000, t + 3000);
kit.tick1s(t + 3000);
CHECK(!rel.isOn(2) && rel.isOn(0) && rel.isOn(1), 'délestage puis sécurité au même instant : une seule coupure');

console.log('  journal (' + kit.logs.length + ' entrées), dernier : ' + kit.logs[kit.logs.length - 1].msg);
console.log('\n' + pass + ' vérifications réussies, ' + fail + ' échecs');
process.exitCode = fail ? 1 : 0;

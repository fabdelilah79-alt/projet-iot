// Validation croisée des machines virtuelles JavaScript (simulateur) et C++ (kit ESP32).
// 1. compile les programmes exemples + des programmes de test avec le compilateur de blocs ;
// 2. les exécute avec la VM JavaScript et une interface matérielle déterministe ;
// 3. écrit les résultats attendus, puis lance la VM C++ (tests/native/vmrun) qui doit produire
//    exactement les mêmes actions, aux mêmes instants.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { loadApp } = require('./load');
const { ScriptedHal } = require('./scripted_hal');

const EL = loadApp();
const Blockly = global.Blockly;
const { B, E, S, hat, ws, n, out, val } = EL.examples.builder;

function compileWs(json, name) {
  const w = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(json, w);
  const r = EL.compiler.compile(w, name);
  w.dispose();
  return r;
}

// Programmes de test supplémentaires (couvrent les recoins de la sémantique)
const EXTRA = {
  boucles_imbriquees: ws([hat('el_on_start', null, null, [
    S.set('a', E.num(0)),
    S.repeat(3, [S.repeat(4, [S.change('a', 1), S.logv('a =', E.v('a'))]), S.wait(0.5)]),
    S.logv('fin, a =', E.v('a'))
  ])], [['a', 'a']]),
  aleatoire: ws([hat('el_on_start', null, null, [
    S.repeat(10, [S.logv('dé', B('el_random', null, { A: n(1), B: n(6) })), S.logv('réel', B('el_random', null, { A: n(0.5), B: n(2.5) }))])
  ])]),
  boutons_et_quand: ws([
    hat('el_button', { BTN: '1' }, null, [S.log('bouton A'), S.wait(2), S.log('fin A')], 20, 20),
    hat('el_button', { BTN: '2' }, null, [S.log('bouton B')], 20, 120),
    hat('el_when', null, { COND: val(E.presence()) }, [S.log('présence !'), S.beep(0)], 20, 220)
  ]),
  arret: ws([
    hat('el_every', { PERIOD: 1.5 }, null, [S.logv('t =', B('el_time', { Q: '12' }))], 20, 20),
    hat('el_on_start', null, null, [S.wait(10), S.log('stop'), B('el_stop', { WHAT: '1' })], 20, 160)
  ]),
  maths: ws([hat('el_on_start', null, null, [
    S.logv('abs', B('el_math', { FN: '0' }, { A: n(-3.5) })),
    S.logv('arrondi', B('el_math', { FN: '1' }, { A: n(-2.5) })),
    S.logv('plancher', B('el_math', { FN: '2' }, { A: n(-2.5) })),
    S.logv('plafond', B('el_math', { FN: '3' }, { A: n(2.1) })),
    S.logv('racine', B('el_math', { FN: '4' }, { A: n(2) })),
    S.logv('racine négative', B('el_math', { FN: '4' }, { A: n(-4) })),
    S.logv('carré', B('el_math', { FN: '5' }, { A: n(1.5) })),
    S.logv('min', B('el_minmax', { OP: 'MIN' }, { A: n(3), B: n(-1) })),
    S.logv('max', B('el_minmax', { OP: 'MAX' }, { A: n(3), B: n(-1) })),
    S.logv('modulo', E.arith(E.num(-7), 'MOD', E.num(3))),
    S.logv('div0', E.arith(E.num(5), 'DIV', E.num(0))),
    S.logv('entre', B('el_between', null, { X: n(5), A: n(10), B: n(1) })),
    S.logv('NaN > 0', E.cmp(B('el_sensor', { QTY: '2' }, { OUTLET: n(7) }), 'GT', E.num(0))),
    S.logv('NaN ≠ 0', E.cmp(B('el_sensor', { QTY: '2' }, { OUTLET: n(7) }), 'NE', E.num(0))),
    S.logv('non', E.not(E.cmp(E.num(1), 'EQ', E.num(1)))),
    S.logv('0.1+0.2', E.arith(E.num(0.1), 'ADD', E.num(0.2)))
  ])]),
  boucle_occupee: ws([hat('el_on_start', null, null, [S.set('c', E.num(0)), S.forever([S.change('c', 1)])])], [['c', 'compteur']]),
  horaires: ws([
    hat('el_every', { PERIOD: 0.5 }, null, [S.if_(E.timeBetween(7, 5, 7, 6), [S.log('entre 7h05 et 7h06')])], 20, 20),
    hat('el_at', { H: 7, M: 3 }, null, [S.log('il est 7h03')], 20, 160),
    hat('el_every', { PERIOD: 7 }, null, [S.if_(E.timeBetween(22, 0, 6, 0), [S.log('nuit')])], 20, 260)
  ]),
  parametres: ws([hat('el_on_start', null, null, [
    S.setParam(12, 2500), S.setOutletParam(2, 3, 9), S.logv('souscrite', E.param(12)),
    S.logv('prio 3', B('el_param_outlet_get', { PARAM: '2' }, { OUTLET: out(3) })), S.logv('lissage', E.param(11))
  ])]),
  intelligence: ws([hat('el_every', { PERIOD: 3 }, null, [
    S.logv('prév', E.forecast(5)), S.logv('moy', B('el_ai_avg', null, { OUTLET: out(2), N: n(30) })),
    S.logv('tend', B('el_ai_trend', null, { N: n(60) })), S.logv('max', B('el_ai_total', { Q: '2' }, { N: n(60) })),
    S.if_(E.anomaly(1), [S.log('anomalie 1')]), S.logv('inact', E.idle(4)),
    S.if_(E.appliance(2, 0), [S.log('rien sur 2')]),
    S.shed(E.param(12)), S.pulse(2, 4), B('el_toggle', null, { OUTLET: out(1) }),
    B('el_relay_set', null, { OUTLET: out(4), STATE: val(E.presence()) })
  ])]),
  tant_que: ws([hat('el_on_start', null, null, [
    S.set('x', E.num(0)),
    B('el_while', null, { COND: val(E.cmp(E.v('x'), 'LT', E.num(5))), DO: { block: S.change('x', 1) } }),
    B('el_until', null, { COND: val(E.cmp(E.v('x'), 'GE', E.num(9))), DO: { block: S.change('x', 2) } }),
    B('el_wait_until', null, { COND: val(E.cmp(B('el_time', { Q: '12' }), 'GE', E.num(4))) }),
    S.logv('x =', E.v('x')), S.screen('fini')
  ])], [['x', 'x']])
};

function run(bc, opts, label) {
  const hal = new ScriptedHal();
  const m = new EL.vm.Machine(hal);
  const err = m.load(bc);
  if (err) throw new Error(label + ' : VM JS refuse le programme : ' + err);
  m.start(0, opts.seed);
  const buttons = new Map();
  for (const b of opts.buttons) {
    if (!buttons.has(b[0])) buttons.set(b[0], []);
    buttons.get(b[0]).push(b[1]);
  }
  for (let t = 0; t <= opts.endMs; t += opts.tickMs) {
    hal.t = t;
    if (buttons.has(t)) for (const b of buttons.get(t)) m.pressButton(b);
    m.tick(t);
  }
  return { acts: hal.acts, status: m.status, err: m.err, vars: m.vars.map((v) => hal.F(v)) };
}

function main() {
  const outDir = path.join(__dirname, 'out', 'xval');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const programs = [];
  for (const ex of EL.examples.LIST) programs.push({ name: 'ex_' + ex.id, json: ex.build() });
  for (const k of Object.keys(EXTRA)) programs.push({ name: 'test_' + k, json: EXTRA[k] });
  const files = [];
  let compileErrors = 0;
  for (const p of programs) {
    const r = compileWs(p.json, p.name);
    if (!r.ok) {
      console.log('ÉCHEC compilation', p.name, JSON.stringify(r.errors));
      compileErrors++;
      continue;
    }
    for (const tick of [100, 1000]) {
      const opts = { tickMs: tick, endMs: 2400000 / (tick === 100 ? 4 : 1), seed: 12345, buttons: [[5000, 1], [12000, 2], [30000, 1], [31000, 1]] };
      const expected = run(r.bc, opts, p.name);
      const file = path.join(outDir, p.name + '_t' + tick + '.json');
      fs.writeFileSync(file, JSON.stringify({ bc: r.bc, opts: opts, expected: expected }));
      files.push(file);
    }
  }
  console.log(programs.length + ' programmes compilés (' + compileErrors + ' erreur(s)), ' + files.length + ' exécutions de référence');
  const vmrun = path.join(__dirname, '..', 'native', 'vmrun');
  execFileSync('make', ['-s', 'vmrun'], { cwd: path.join(__dirname, '..', 'native'), stdio: 'inherit' });
  let ok = true;
  try {
    execFileSync(vmrun, files, { stdio: 'inherit' });
  } catch (e) {
    ok = false;
  }
  if (compileErrors) ok = false;
  console.log(ok ? 'VALIDATION CROISÉE RÉUSSIE' : 'VALIDATION CROISÉE ÉCHOUÉE');
  process.exitCode = ok ? 0 : 1;
}

main();

// Vérifie que le jumeau numérique et les algorithmes d'exemple donnent des résultats cohérents
// (chaque algorithme améliore bien l'indicateur qu'il vise, sans effet absurde).
'use strict';
const { loadApp } = require('./load');
const EL = loadApp();
const Blockly = global.Blockly;

let pass = 0, fail = 0;
function CHECK(c, what) { if (c) pass++; else { fail++; console.log('  ECHEC : ' + what); } }

function compile(ex) {
  const w = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(ex.build(), w);
  const r = EL.compiler.compile(w, ex.title);
  w.dispose();
  return r;
}

(async function () {
  console.log('[exemples]');
  const bc = {};
  for (const ex of EL.examples.LIST) {
    const r = compile(ex);
    CHECK(r.ok, 'compilation de « ' + ex.id + ' » : ' + JSON.stringify(r.errors));
    if (r.ok) bc[ex.id] = r.bc;
  }
  console.log('  ' + EL.examples.LIST.length + ' exemples compilés');

  console.log('[arène]');
  async function run(sc, ids) {
    const res = await EL.runArena(sc, ids.map(function (id) { return { label: id, id: id, bc: id === 'none' ? null : bc[id] }; }));
    const o = {};
    res.forEach(function (r) { o[r.id] = r; CHECK(!r.error && !r.vmError, sc + '/' + r.id + ' sans erreur (' + r.error + r.vmError + ')'); });
    return o;
  }
  const hiver = await run('hiver', ['none', 'delestage', 'heures_creuses', 'heures_creuses_plus', 'thermostat', 'eclairage']);
  const H = hiver.none, contractH = EL.house.SCENARIOS.hiver.contractW;
  CHECK(H.overMin > 0 && H.serviceLostMin === 0 && H.fridgeWarmMin === 0, 'hiver : la référence dépasse le contrat sans perte de service');
  CHECK(hiver.delestage.overMin === 0 && hiver.delestage.peakW < contractH * 1.02, 'hiver : le délestage supprime les dépassements');
  CHECK(hiver.delestage.serviceLostMin < 15, 'hiver : le délestage préserve le service');
  CHECK(hiver.heures_creuses.cost < H.cost * 0.9, 'hiver : les heures creuses réduisent le coût');
  CHECK(hiver.heures_creuses_plus.coldDraws === 0, 'hiver : le préchauffage évite la douche froide');
  CHECK(hiver.thermostat.energyKWh < H.energyKWh * 0.8, 'hiver : le thermostat économise');
  CHECK(hiver.eclairage.energyKWh < H.energyKWh && hiver.eclairage.switches < 30, 'hiver : éclairage économe et stable');
  const pointe = await run('pointe', ['none', 'delestage', 'predictif']);
  CHECK(pointe.none.overMin > 0, 'pointe : la référence dépasse le contrat');
  CHECK(pointe.delestage.overMin === 0 && pointe.delestage.fridgeWarmMin === 0, 'pointe : délestage sans dépassement, réfrigérateur préservé');
  CHECK(pointe.predictif.peakW <= pointe.delestage.peakW, 'pointe : le prédictif écrête au moins autant');
  const veille = await run('veille', ['none', 'veille', 'eclairage']);
  CHECK(veille.veille.energyKWh < veille.none.energyKWh - 0.05 && veille.veille.serviceLostMin < 2, 'veille : le tueur de veille économise sans gêne');
  CHECK(veille.eclairage.energyKWh < veille.none.energyKWh - 0.1 && veille.eclairage.serviceLostMin < 2, 'veille : éclairage intelligent (' + veille.eclairage.energyKWh.toFixed(3) + ' kWh, perte ' + veille.eclairage.serviceLostMin.toFixed(1) + ' min)');
  console.log('\n' + pass + ' vérifications réussies, ' + fail + ' échecs');
  process.exitCode = fail ? 1 : 0;
})();

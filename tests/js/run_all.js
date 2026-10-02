// Lance tous les tests JavaScript (et la validation croisée avec la VM C++).
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
let failed = 0;
for (const f of ['kit_test.js', 'arena_test.js', 'crossvalidate.js']) {
  console.log('\n===== ' + f);
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit' });
  if (r.status !== 0) { failed++; console.log('>>> ' + f + ' : ÉCHEC'); }
}
console.log(failed ? '\n' + failed + ' suite(s) en échec' : '\nToutes les suites JavaScript sont réussies');
process.exitCode = failed ? 1 : 0;

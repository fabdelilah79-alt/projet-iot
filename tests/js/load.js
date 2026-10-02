// Charge les sources de l'application (web/src) dans Node, avec Blockly en mode sans affichage.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadApp(opts) {
  opts = opts || {};
  if (opts.blockly !== false && !global.Blockly) {
    global.Blockly = require('blockly');
  }
  const dir = path.join(__dirname, '..', '..', 'web', 'src');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
  for (const f of files) {
    // les modules d'interface (>= 50) ont besoin du DOM : on ne charge que le cœur
    const num = parseInt(f, 10);
    if (num >= 50 && !opts.ui) continue;
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    vm.runInThisContext(code, { filename: f });
  }
  if (global.Blockly && global.EL.blocks) global.EL.blocks.define(global.Blockly);
  return global.EL;
}

module.exports = { loadApp };

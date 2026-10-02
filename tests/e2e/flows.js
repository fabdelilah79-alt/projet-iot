// Parcours utilisateur de bout en bout avec le faux kit (tools/mock-kit) :
// commander une prise, envoyer un programme au kit, mode enseignant, arène, IA, questionnaire.
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('playwright-core')); }

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'out');
const PORT = 8000 + Math.floor(Math.random() * 900);
const BASE = 'http://127.0.0.1:' + PORT;
let pass = 0, fail = 0;
function CHECK(c, what) { if (c) { pass++; console.log('  ok   ' + what); } else { fail++; console.log('  ÉCHEC ' + what); } }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function api(p, opts) { const r = await fetch(BASE + p, opts); return r.headers.get('content-type').includes('json') ? r.json() : r.text(); }
async function until(fn, ms, step) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(step || 250); } return false; }

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = spawn(process.execPath, [path.join(ROOT, 'tools/mock-kit/server.js'), '--port', String(PORT), '--quiet'], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((res) => srv.stdout.once('data', res));
  const browser = await chromium.launch();
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('dialog', (d) => d.accept());
    await page.goto(BASE + '/');
    await page.waitForSelector('.modal input');
    await page.fill('.modal input', 'E07');
    await page.click('.modal .btn.primary');
    await page.waitForSelector('.outlet');

    console.log('[maison]');
    await page.locator('.outlet').nth(1).locator('label.switch').click();
    CHECK(await until(async () => (await api('/api/state')).o[1].on === 1, 4000), 'la prise 2 s’allume depuis l’interface');
    CHECK(await until(async () => (await api('/api/state')).o[1].p > 1000, 6000), 'la bouilloire consomme (mesure > 1 000 W)');
    CHECK(await until(async () => /W/.test(await page.locator('.outlet').nth(1).locator('.o-p').textContent()), 3000), 'la carte affiche la puissance');
    await page.screenshot({ path: path.join(OUT, 'flow-maison.png') });
    await page.locator('.outlet').nth(1).locator('label.switch').click();
    CHECK(await until(async () => (await api('/api/state')).o[1].on === 0, 5000), 'la prise 2 s’éteint');

    console.log('[programmer]');
    await page.goto(BASE + '/#/programmer');
    await page.waitForSelector('.blocklySvg', { timeout: 20000 });
    await page.click('button[title="Programmes d’exemple"]');
    await page.locator('.ex-card', { hasText: 'Délestage intelligent par priorités' }).locator('button', { hasText: 'Ouvrir' }).click();
    await page.locator('.modal .btn.primary', { hasText: 'Remplacer' }).click();
    await sleep(800);
    await page.locator('.editor-bar .btn.primary').click();
    CHECK(await until(async () => { const s = await api('/api/state'); return s.vm.st === 1 && /lestage/.test(s.vm.n); }, 6000), 'le programme est envoyé et tourne sur le kit');
    CHECK(await until(async () => { const w = await api('/api/program/ws'); return w && w.blocks; }, 4000), 'les blocs sont sauvegardés sur le kit');
    await page.click('button[title="Arrêter le programme du kit"]');
    CHECK(await until(async () => (await api('/api/state')).vm.st !== 1, 5000), 'le programme du kit s’arrête');
    await page.click('button[title="Tester le programme sur la maison virtuelle (jumeau numérique)"]');
    await sleep(2500);
    CHECK((await api('/api/state')).vm.st !== 1, 'la simulation ne touche pas au kit');
    await page.screenshot({ path: path.join(OUT, 'flow-programmer.png') });
    await page.click('button[title="Arrêter la simulation"]');

    console.log('[mesures]');
    await page.goto(BASE + '/#/mesures/1');
    await page.waitForSelector('.readout');
    await sleep(1500);
    await page.screenshot({ path: path.join(OUT, 'flow-mesures.png'), fullPage: true });
    CHECK((await page.locator('.readout').count()) >= 10, 'les grandeurs électriques sont affichées');

    console.log('[enseignant]');
    await page.goto(BASE + '/#/reglages');
    await page.locator('button', { hasText: 'Mode enseignant' }).click();
    await page.fill('.modal input', '0000');
    await page.click('.modal .btn.primary');
    await sleep(500);
    CHECK(await page.locator('.modal', { hasText: 'Code incorrect' }).count() === 1, 'un mauvais code est refusé');
    await page.fill('.modal input', '1234');
    await page.click('.modal .btn.primary');
    await page.waitForSelector('text=Enregistrer les réglages');
    const name = page.locator('label.field', { hasText: 'Nom du kit' }).locator('input');
    await name.fill('Kit Lycée A');
    await page.locator('button', { hasText: 'Enregistrer les réglages' }).click();
    CHECK(await until(async () => (await api('/api/config')).kitName === 'Kit Lycée A', 4000), 'les réglages sont enregistrés sur le kit');
    CHECK(await until(async () => (await page.locator('#kit-name').textContent()) === 'Kit Lycée A', 4000), 'le nom du kit est mis à jour');
    const cfgNoPin = await api('/api/config');
    CHECK(cfgNoPin.peda.pin === '********' && cfgNoPin.teacher === false, 'le code enseignant n’est pas divulgué');
    await page.screenshot({ path: path.join(OUT, 'flow-reglages.png'), fullPage: true });

    console.log('[ia]');
    await page.goto(BASE + '/#/ia');
    await page.locator('.tabs button, button', { hasText: 'Arène de comparaison' }).first().click();
    await page.locator('button', { hasText: 'Lancer la journée simulée' }).click();
    CHECK(await until(async () => (await page.locator('text=Résultats —').count()) > 0, 90000, 500), 'l’arène calcule une journée pour 3 algorithmes');
    await sleep(500);
    await page.screenshot({ path: path.join(OUT, 'flow-arene.png'), fullPage: true });
    await page.locator('button', { hasText: 'Reconnaissance d’appareils' }).first().click();
    await api('/api/cmd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cmd: 'relay', outlet: 3, on: true }) });
    await sleep(6000);
    await page.locator('select').first().selectOption('3');
    await page.fill('input[list="knn-names"]', 'Radiateur');
    await page.locator('button', { hasText: 'Apprendre cet exemple' }).click();
    CHECK(await until(async () => (await api('/api/knn')).labels.some((l) => l.name === 'Radiateur'), 5000), 'l’IA apprend un appareil');
    CHECK(await until(async () => (await api('/api/state')).o[2].ap > 0, 8000), 'l’IA reconnaît l’appareil branché');
    await page.screenshot({ path: path.join(OUT, 'flow-knn.png'), fullPage: true });

    console.log('[évaluation]');
    await page.goto(BASE + '/#/evaluation');
    await page.locator('.card', { hasText: 'Pré-test' }).locator('button', { hasText: 'Commencer' }).click();
    const groups = page.locator('.modal .qcm');
    const nq = await groups.count();
    for (let i = 0; i < nq; i++) await groups.nth(i).locator('input').first().check();
    await page.locator('.modal .btn.primary', { hasText: 'Envoyer mes réponses' }).click();
    CHECK(await until(async () => /pretest/.test(await api('/files/research/results.csv')), 5000), 'le pré-test est enregistré sur le kit (' + nq + ' questions)');
    await page.locator('button', { hasText: 'Analyser les résultats' }).click();
    await sleep(800);
    CHECK(await page.locator('.modal').count() > 0, 'l’analyse des résultats s’affiche');
    await page.screenshot({ path: path.join(OUT, 'flow-analyse.png') });
  } finally {
    await browser.close();
    srv.kill();
  }
  for (const e of errors) console.log('  ' + e);
  CHECK(errors.length === 0, 'aucune erreur JavaScript dans la page');
  console.log('\n' + pass + ' vérifications réussies, ' + fail + ' échecs');
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });

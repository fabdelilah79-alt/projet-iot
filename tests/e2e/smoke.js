// Test de fumée de l'interface : démarre le faux kit, ouvre chaque page dans Chromium,
// relève les erreurs JavaScript et enregistre des captures d'écran dans tests/e2e/out/.
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
const VIEWS = ['maison', 'mesures', 'programmer', 'missions', 'ia', 'donnees', 'evaluation', 'reglages', 'aide'];
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? undefined : undefined;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = spawn(process.execPath, [path.join(ROOT, 'tools/mock-kit/server.js'), '--port', String(PORT), '--quiet', '--speed', '10'], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((res) => srv.stdout.once('data', res));
  const browser = await chromium.launch({ executablePath: exe });
  const errors = [];
  let failures = 0;
  try {
    for (const mode of ['kit', 'demo']) {
      for (const vp of [{ name: 'pc', width: 1280, height: 860 }, { name: 'mobile', width: 390, height: 844 }]) {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'fr-FR' });
        const page = await ctx.newPage();
        page.on('pageerror', (e) => errors.push(`[${mode}/${vp.name}] pageerror: ${e.message}`));
        page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${mode}/${vp.name}] console: ${m.text()}`); });
        await page.goto(BASE + '/' + (mode === 'demo' ? '?demo' : ''));
        await page.waitForSelector('.modal input', { timeout: 15000 });
        await page.fill('.modal input', 'Testeur');
        await page.click('.modal .btn.primary');
        await sleep(400);
        for (const v of VIEWS) {
          await page.evaluate((v) => { location.hash = '#/' + v; }, v);
          await sleep(v === 'programmer' ? 3500 : 1500);
          const bad = await page.$$eval('#view .note.bad', (els) => els.map((e) => e.textContent));
          if (bad.some((t) => /Erreur/.test(t))) { failures++; errors.push(`[${mode}/${vp.name}] ${v}: ${bad.join(' | ')}`); }
          await page.screenshot({ path: path.join(OUT, `${mode}-${vp.name}-${v}.png`), fullPage: vp.name === 'pc' });
        }
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
    srv.kill();
  }
  for (const e of errors) console.log(e);
  console.log(errors.length ? `${errors.length} problème(s)` : 'Aucune erreur');
  process.exit(errors.length || failures ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });

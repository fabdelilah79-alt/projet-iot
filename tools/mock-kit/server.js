#!/usr/bin/env node
/* EnergyLab — faux kit pour développer et tester l'application sans matériel.
 *
 * Sert l'application web (assemblée à la volée comme le fait tools/embed_web.py)
 * et émule l'API HTTP + WebSocket du firmware ESP32 à partir du jumeau numérique
 * (EL.SimKit). Aucune dépendance : Node.js 18 ou plus suffit.
 *
 *   node tools/mock-kit/server.js [--port 8080] [--speed 1] [--host 0.0.0.0]
 *
 * puis ouvrir http://localhost:8080 (l'application se croit connectée à un vrai kit).
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const WEB = path.join(ROOT, 'web');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const PORT = Number(arg('port', process.env.PORT || 8080));
const HOST = arg('host', '127.0.0.1');
const SPEED = Number(arg('speed', 1));
const QUIET = process.argv.includes('--quiet');

// ------------------------------------------------------------------ cœur de l'application (sans interface)
function loadCore() {
  const dir = path.join(WEB, 'src');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js')).sort()) {
    if (parseInt(f, 10) >= 40) continue; // blocs, compilateur et interface inutiles ici
    vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
  }
  return global.EL;
}
const EL = loadCore();
const sim = new EL.SimKit({ name: 'Kit EnergyLab (faux kit)' });
sim.setSpeed(SPEED);
// des « occupants » virtuels remettent en marche les appareils qui s'arrêtent seuls (bouilloire…)
setInterval(function () { for (let k = 0; k < 4; k++) sim.switchOn(k); }, 60000);
const files = { program: null, programWs: null };

// ------------------------------------------------------------------ état compact (identique à webapi.cpp: buildState)
function r(v, d) { return v === null || v === undefined || !isFinite(v) ? null : Number(Number(v).toFixed(d)); }
function b(v) { return v ? 1 : 0; }
function compactState() {
  const s = sim.state();
  return {
    t: 'st', ts: s.timeValid ? s.ts : 0, tv: b(s.timeValid), up: s.uptime, tz: s.tz,
    o: s.outlets.map(function (o) {
      return {
        u: r(o.u, 1), i: r(o.i, 3), p: r(o.p, 1), s: r(o.s, 1), q: r(o.q, 1), pf: r(o.pf, 2), f: r(o.f, 1), phi: r(o.phi, 1),
        ec: r(o.eCounter, 3), ed: r(o.eToday, 2), cd: r(o.costToday, 4), on: b(o.on), ol: b(o.online), lt: b(o.latched),
        lr: o.latchReason || '', al: b(o.alarm), sh: b(o.shed), sw: o.switches, pd: b(o.pending), pu: r(o.pulseLeft, 0),
        id: r(o.idle, 0), an: b(o.anomaly), z: r(o.z, 2), ap: o.appliance, ad: r(o.applianceDist, 2)
      };
    }),
    env: { T: r(s.env.temp, 1), H: r(s.env.hum, 1), L: r(s.env.lum, 1), pr: b(s.env.pres), mo: b(s.env.motion) },
    tot: { p: r(s.total.p, 1), ed: r(s.total.eToday, 1), cd: r(s.total.costToday, 3), co2: r(s.total.co2, 1), pk: r(s.total.peak, 1), v: r(s.total.voltage, 1) },
    tar: { off: b(s.tariff.offPeak), pr: r(s.tariff.price, 3) },
    vm: { st: s.vm.status, n: s.vm.name, h: s.vm.hash, e: s.vm.error, es: s.vm.errScript, ep: s.vm.errPc, pc: s.vm.pcs, v: s.vm.vars.map(function (x) { return r(x, 4); }), rt: r(s.vm.runtime, 0), ir: s.vm.instr },
    fc: { f10: r(s.forecast.f10, 0), f30: r(s.forecast.f30, 0), tr: r(s.forecast.trend, 1) },
    net: { m: 'AP', n: wsClients.size, rs: 0, ws: wsClients.size },
    lg: s.seq.log, cs: s.seq.cfg, ks: s.seq.knn, ps: 0, pb: 0
  };
}

// ------------------------------------------------------------------ WebSocket minimal (RFC 6455, texte uniquement)
const wsClients = new Set();
function wsFrame(text) {
  const data = Buffer.from(text, 'utf8');
  let head;
  if (data.length < 126) head = Buffer.from([0x81, data.length]);
  else if (data.length < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(data.length, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(data.length), 2); }
  return Buffer.concat([head, data]);
}
function wsBroadcast(obj) {
  const f = wsFrame(JSON.stringify(obj));
  for (const sock of wsClients) { try { sock.write(f); } catch (e) { wsClients.delete(sock); } }
}
function wsUpgrade(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (req.url.split('?')[0] !== '/ws' || !key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  wsClients.add(socket);
  socket.on('data', function (buf) {
    // on ignore les messages du client ; on répond seulement à la fermeture (opcode 8)
    if (buf.length && (buf[0] & 0x0f) === 8) { try { socket.end(Buffer.from([0x88, 0])); } catch (e) { /* rien */ } wsClients.delete(socket); }
  });
  socket.on('close', function () { wsClients.delete(socket); });
  socket.on('error', function () { wsClients.delete(socket); });
  try { socket.write(wsFrame(JSON.stringify(compactState()))); } catch (e) { /* rien */ }
}
sim.on('log', function (e) { wsBroadcast({ t: 'lg', s: e.seq, ts: e.ts, l: e.level, m: e.msg }); });
sim.connect();
setInterval(function () { if (wsClients.size) wsBroadcast(compactState()); }, 1000);

// ------------------------------------------------------------------ fichiers de l'application
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.cur': 'image/x-icon', '.json': 'application/json' };
function bundleApp() {
  const dir = path.join(WEB, 'src');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort().map(function (f) {
    return '/* ---- ' + f + ' ---- */\n' + fs.readFileSync(path.join(dir, f), 'utf8') + '\n';
  }).join('');
}
function bundleBlockly() {
  const lib = path.join(WEB, 'lib', 'blockly');
  return ['blockly_compressed.js', 'blocks_compressed.js', 'fr.js'].map(function (n) { return fs.readFileSync(path.join(lib, n), 'utf8'); }).join('\n;\n');
}
function staticFile(p) {
  if (p === '/' || p === '/index.html') return [path.join(WEB, 'index.html')];
  if (p === '/app.css') return [path.join(WEB, 'css', 'app.css')];
  if (p === '/favicon.svg') return [path.join(WEB, 'favicon.svg')];
  if (p.startsWith('/media/')) return [path.join(WEB, 'lib', 'blockly', 'media', path.basename(p))];
  if (p.startsWith('/img/')) return [path.join(WEB, 'img', path.basename(p))];
  return null;
}

// ------------------------------------------------------------------ API (mêmes routes et formats que webapi.cpp)
function send(res, code, body, type, extra) {
  res.writeHead(code, Object.assign({ 'Content-Type': type || 'application/json', 'Cache-Control': 'no-store' }, extra || {}));
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function reply(res, out) {
  const o = Object.assign({}, out);
  const code = o.ok ? 200 : (o.code && o.code !== 200 ? o.code : 400);
  delete o.code;
  o.ok = o.ok ? 1 : 0;
  send(res, code, o);
}
function readBody(req) {
  return new Promise(function (resolve) {
    const chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () { resolve(Buffer.concat(chunks).toString('utf8')); });
  });
}
function json(text) { try { return JSON.parse(text || '{}'); } catch (e) { return null; } }

async function api(req, res, url) {
  const p = url.pathname, m = req.method;
  const pin = req.headers['x-pin'] || '';
  if (p === '/api/ping') return send(res, 200, 'ok', 'text/plain');
  if (p === '/api/state') return send(res, 200, compactState());
  if (p === '/api/info') {
    const i = await sim.getInfo();
    return send(res, 200, Object.assign(i, { fw: '1.0.0-mock', build: 'faux kit', kit: 'MOCK', mode: 'AP', ip: '', apIp: '192.168.4.1', host: 'energylab', clients: wsClients.size, heap: 150000, minHeap: 120000, fsUsed: 24576, fsTotal: 1572864, teacher: sim.isTeacher(pin), mqtt: 'désactivé', simulated: false }));
  }
  if (p === '/api/config' && m === 'GET') return send(res, 200, await sim.getConfig(pin));
  if (p === '/api/config' && m === 'POST') { const o = json(await readBody(req)); return o ? reply(res, await sim.setConfig(o, pin)) : reply(res, { ok: false, msg: 'JSON invalide' }); }
  if (p === '/api/cmd' && m === 'POST') {
    const o = json(await readBody(req));
    if (!o) return reply(res, { ok: false, msg: 'JSON invalide' });
    if (o.cmd === 'time') {
      sim.epoch0 = (o.epoch | 0) - Math.floor(sim.simMs / 1000);
      if (typeof o.tz === 'number' && sim.cfg.net.tzAuto) sim.cfg.net.tzMin = o.tz;
      return reply(res, { ok: true, msg: 'Heure réglée' });
    }
    return reply(res, await sim.cmd(o, pin));
  }
  if (p === '/api/program' && m === 'GET') return send(res, 200, await sim.getProgram());
  if (p === '/api/program' && m === 'POST') {
    const bc = json(await readBody(req));
    if (!bc) return reply(res, { ok: false, msg: 'Programme absent' });
    const q = url.searchParams;
    const opts = { pin: pin, start: q.get('start') !== '0', save: q.get('save') !== '0' };
    if (q.has('autostart')) opts.autostart = q.get('autostart') === '1';
    const out = await sim.sendProgram(bc, null, opts);
    if (out.ok && opts.save) files.program = bc;
    return reply(res, out);
  }
  if (p === '/api/program/ws' && m === 'POST') {
    if (!sim.allowed(pin, EL.config.PERM.PROGRAM)) return reply(res, { ok: false, msg: "Interdit par l'enseignant", code: 403 });
    files.programWs = await readBody(req);
    return reply(res, { ok: true, msg: 'Blocs enregistrés' });
  }
  if (p === '/api/program/ws' && m === 'GET') return files.programWs ? send(res, 200, files.programWs) : reply(res, { ok: false, msg: 'Aucun programme enregistré', code: 404 });
  if (p === '/api/program/bc' && m === 'GET') return files.program ? send(res, 200, files.program) : reply(res, { ok: false, msg: 'Aucun programme enregistré', code: 404 });
  if (p === '/api/program/ctl' && m === 'POST') { const o = json(await readBody(req)) || {}; return reply(res, await sim.programCtl(o.action, o.value, pin)); }
  if (p === '/api/history') {
    const n = Number(url.searchParams.get('n')) || 600;
    const rows = (await sim.getHistory(n)).map(function (s) {
      const f = function (v) { return isFinite(v) ? v.toFixed(1) : ''; };
      return [s.t, s.p[0].toFixed(1), s.p[1].toFixed(1), s.p[2].toFixed(1), s.p[3].toFixed(1), f(s.T), f(s.H), f(s.L), s.pr ? 1 : 0, s.r].join(',');
    });
    return send(res, 200, 't,p1,p2,p3,p4,T,H,L,pr,r\n' + rows.join('\n') + (rows.length ? '\n' : ''), 'text/csv');
  }
  if (p === '/api/logs') {
    const since = Number(url.searchParams.get('since')) || 0;
    return send(res, 200, (await sim.getLogs(since)).map(function (e) { return { s: e.seq, ts: e.ts, l: e.level, m: e.msg }; }));
  }
  if (p === '/api/days') return send(res, 200, await sim.getDays());
  if (p === '/api/files') return send(res, 200, await sim.listFiles(url.searchParams.get('dir')));
  if (p === '/api/research/events' && m === 'POST') { const a = json(await readBody(req)); return reply(res, Array.isArray(a) ? await sim.postEvents(a) : { ok: false, msg: 'JSON invalide' }); }
  if (p === '/api/research/result' && m === 'POST') { const o = json(await readBody(req)); return reply(res, o ? await sim.postResult(o) : { ok: false, msg: 'JSON invalide' }); }
  if (p === '/api/knn' && m === 'GET') return send(res, 200, await sim.getKnn());
  if (p === '/api/knn' && m === 'POST') { const o = json(await readBody(req)); return reply(res, o ? await sim.knnOp(o, pin) : { ok: false, msg: 'JSON invalide' }); }
  if (p === '/api/pzem') return send(res, 200, await sim.getPzem());
  return reply(res, { ok: false, msg: 'Route inconnue', code: 404 });
}

const server = http.createServer(async function (req, res) {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (!QUIET && url.pathname.startsWith('/api/') && url.pathname !== '/api/state') console.log(req.method, url.pathname + url.search);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (url.pathname.startsWith('/files/')) {
      const parts = url.pathname.split('/');
      const text = await sim.fetchFile(parts[2], decodeURIComponent(parts[3] || ''));
      return text ? send(res, 200, text, 'text/csv') : send(res, 404, 'introuvable', 'text/plain');
    }
    if (url.pathname === '/app.js') return send(res, 200, bundleApp(), MIME['.js']);
    if (url.pathname === '/blockly.js') return send(res, 200, bundleBlockly(), MIME['.js'], { 'Cache-Control': 'max-age=3600' });
    const f = staticFile(url.pathname);
    if (f && fs.existsSync(f[0])) return send(res, 200, fs.readFileSync(f[0]), MIME[path.extname(f[0])] || 'application/octet-stream');
    return send(res, 404, 'introuvable', 'text/plain');
  } catch (e) {
    console.error(e);
    return send(res, 500, { ok: 0, msg: String(e.message || e) });
  }
});
server.on('upgrade', wsUpgrade);
server.listen(PORT, HOST, function () {
  console.log('Faux kit EnergyLab : http://' + (HOST === '0.0.0.0' ? 'localhost' : HOST) + ':' + PORT + '  (vitesse ×' + SPEED + ', code enseignant ' + sim.cfg.peda.pin + ')');
});

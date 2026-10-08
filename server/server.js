// Arre simulator 2.0 – multiplayerserver.
// Serverar spelets filer och skickar spelarnas positioner och chatt mellan varandra via WebSocket.
// Starta: npm install && npm start   (porten sätts med PORT, standard 8080)
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { WebSocketServer } = require('ws');
const { openStore } = require('./store');

const PORT = Number(process.env.PORT) || 8080;
const ROOT = path.resolve(__dirname, '..');
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS) || 40;
const TICK_MS = 100; // positioner skickas ut 10 gånger per sekund
// Gemensam spelklocka och fredagsfest. Samma uträkning som i spelet (js/shared/clock.js),
// räknad från en fast tidpunkt så att alla får samma tid och den överlever omstarter.
const { partyStatus } = require('../js/shared/clock.js');
const PARTY_FORCE = process.env.PARTY_FORCE === '1'; // för test: festen pågår alltid
const clockMessage = () => ({
  t: 'clock',
  now: Date.now(),
  party: partyStatus(Date.now(), PARTY_FORCE),
});

// ---- Statiska filer ----
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};
// Bara spelets egna mappar serveras, aldrig servern själv eller git-filer.
const PUBLIC = ['index.html', 'css/', 'js/', 'img/'];
const server = http.createServer((req, res) => {
  let url;
  try {
    url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, players: players.size, accounts: !!store }));
    return;
  }
  if (url.startsWith('/api/')) {
    handleApi(req, res, url).catch((e) => {
      console.error(e);
      json(res, 500, { error: 'Något gick fel på servern.' });
    });
    return;
  }
  const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep) || !PUBLIC.some((p) => rel === p || rel.startsWith(p))) {
    res.writeHead(404).end('Hittades inte');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404).end('Hittades inte');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': rel.startsWith('img/') ? 'public, max-age=86400' : 'no-cache',
    });
    res.end(data);
  });
});

// ---- Konton och sparning ----
// Lösenord lagras som scrypt-hash med salt. Inloggningen ger en slumpad nyckel (token) som
// webbläsaren skickar med. Servern sparar bara en hash av nyckeln.
let store = null;
const MAX_SAVE = 300 * 1024;
function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0,
      tooBig = Number(req.headers['content-length']) > limit;
    const chunks = [];
    // För stora förfrågningar läses färdigt utan att sparas, så att svaret (413) hinner fram.
    if (tooBig) reject(Object.assign(new Error('för stor'), { code: 413 }));
    req.on('data', (c) => {
      if (tooBig) return;
      size += c.length;
      if (size > limit) {
        tooBig = true;
        chunks.length = 0;
        reject(Object.assign(new Error('för stor'), { code: 413 }));
      } else chunks.push(c);
    });
    req.on('end', () => {
      if (tooBig) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('trasig json'), { code: 400 }));
      }
    });
    req.on('error', reject);
  });
}
const accountKey = (name) => name.toLowerCase();
const validName = (n) => typeof n === 'string' && /^[\p{L}\p{N} _.-]{2,20}$/u.test(n.trim());
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
function hashPassword(password, salt) {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, 32, (err, key) =>
      err ? reject(err) : resolve(key.toString('hex')),
    ),
  );
}
// Högst 10 inloggningsförsök per minut och adress.
const attempts = new Map();
function tooMany(req) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
      .split(',')[0]
      .trim(),
    now = Date.now(),
    list = (attempts.get(ip) || []).filter((t) => now - t < 60000);
  list.push(now);
  attempts.set(ip, list);
  return list.length > 10;
}
async function newSession(key) {
  const token = crypto.randomBytes(32).toString('hex');
  await store.putSession(sha(token), key);
  return token;
}
async function sessionKey(req) {
  const m = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const s = await store.getSession(sha(m[1]));
  return s ? s.key : null;
}
async function handleApi(req, res, url) {
  if (!store) return json(res, 503, { error: 'Konton är inte igång på den här servern.' });
  try {
    if (url === '/api/register' && req.method === 'POST') {
      if (tooMany(req)) return json(res, 429, { error: 'För många försök. Vänta en minut.' });
      const { name, password } = await readBody(req, 2048);
      if (!validName(name))
        return json(res, 400, {
          error:
            'Namnet ska vara 2–20 tecken: bokstäver, siffror, mellanslag, punkt eller bindestreck.',
        });
      if (typeof password !== 'string' || password.length < 6 || password.length > 200)
        return json(res, 400, { error: 'Lösenordet ska vara minst 6 tecken.' });
      const key = accountKey(name.trim()),
        salt = crypto.randomBytes(16).toString('hex'),
        hash = await hashPassword(password, salt);
      if (!(await store.createUser(key, { name: name.trim(), salt, hash, created: Date.now() })))
        return json(res, 409, { error: 'Namnet är redan upptaget.' });
      return json(res, 200, { token: await newSession(key), name: name.trim() });
    }
    if (url === '/api/login' && req.method === 'POST') {
      if (tooMany(req)) return json(res, 429, { error: 'För många försök. Vänta en minut.' });
      const { name, password } = await readBody(req, 2048);
      const key = validName(name) ? accountKey(name.trim()) : '',
        user = key && (await store.getUser(key));
      const hash = await hashPassword(String(password || ''), user ? user.salt : 'ingen');
      if (!user || !crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex')))
        return json(res, 401, { error: 'Fel namn eller lösenord.' });
      const saved = await store.getSave(key);
      return json(res, 200, {
        token: await newSession(key),
        name: user.name,
        savedAt: saved?.savedAt || 0,
      });
    }
    if (url === '/api/logout' && req.method === 'POST') {
      const m = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.authorization || '');
      if (m) await store.deleteSession(sha(m[1]));
      return json(res, 200, { ok: true });
    }
    if (url === '/api/save') {
      const key = await sessionKey(req);
      if (!key) return json(res, 401, { error: 'Logga in igen.' });
      if (req.method === 'GET') {
        const saved = await store.getSave(key),
          user = await store.getUser(key);
        return json(res, 200, {
          name: user?.name,
          save: saved ? JSON.parse(saved.data) : null,
          savedAt: saved?.savedAt || 0,
        });
      }
      if (req.method === 'PUT') {
        const body = await readBody(req, MAX_SAVE);
        if (!body.save || typeof body.save !== 'object' || Array.isArray(body.save))
          return json(res, 400, { error: 'Ingen sparning skickades.' });
        const savedAt = Date.now();
        await store.putSave(key, JSON.stringify(body.save), savedAt);
        return json(res, 200, { savedAt });
      }
    }
    return json(res, 404, { error: 'Finns inte.' });
  } catch (e) {
    if (e.code === 413) {
      res.setHeader('connection', 'close');
      return json(res, 413, { error: 'Sparningen är för stor.' });
    }
    if (e.code === 400) return json(res, 400, { error: 'Trasig förfrågan.' });
    throw e;
  }
}

// ---- Spelare ----
// id -> { ws, id, name, character, color, world, x, y, a, moving, lastChat, alive }
const players = new Map();
let nextId = 1;
const clean = (s, max) =>
  String(s ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);
const num = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);
const publicInfo = (p) => ({
  id: p.id,
  name: p.name,
  character: p.character,
  color: p.color,
  world: p.world,
  x: p.x,
  y: p.y,
  a: p.a,
});
function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}
function broadcast(msg, except) {
  const data = JSON.stringify(msg);
  for (const p of players.values())
    if (p !== except && p.ws.readyState === p.ws.OPEN) p.ws.send(data);
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
wss.on('connection', (ws) => {
  if (players.size >= MAX_PLAYERS) {
    send(ws, { t: 'full' });
    ws.close();
    return;
  }
  let me = null;
  ws.on('message', (raw) => {
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello' && !me) {
      me = {
        ws,
        id: nextId++,
        name: clean(m.name, 24) || 'Spelare',
        character: /^[a-z]{2,16}$/.test(m.character) ? m.character : 'arvid',
        color: /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : null,
        world: 'outdoor',
        x: 0,
        y: 0,
        a: 0,
        moving: false,
        lastChat: 0,
        alive: true,
        dirty: true,
      };
      players.set(me.id, me);
      send(ws, {
        t: 'welcome',
        id: me.id,
        clock: clockMessage(),
        players: [...players.values()].filter((p) => p !== me).map(publicInfo),
      });
      broadcast({ t: 'join', p: publicInfo(me) }, me);
      return;
    }
    if (!me) return;
    if (m.t === 'state') {
      // Världsnamn är korta ord, t.ex. outdoor, w33, home:3. Koordinater hålls inom kartan.
      const world = clean(m.world, 24);
      if (/^[a-z0-9:]{1,24}$/.test(world)) me.world = world;
      me.x = num(m.x, 0, 512) ?? me.x;
      me.y = num(m.y, 0, 512) ?? me.y;
      me.a = num(m.a, -1e6, 1e6) ?? me.a;
      me.moving = !!m.moving;
      if (/^#[0-9a-f]{6}$/i.test(m.color)) me.color = m.color;
      me.dirty = true;
    } else if (m.t === 'chat') {
      const now = Date.now(),
        text = clean(m.text, 140);
      if (!text || now - me.lastChat < 800) return;
      me.lastChat = now;
      broadcast({ t: 'chat', id: me.id, name: me.name, text, world: me.world });
    }
  });
  ws.on('pong', () => me && (me.alive = true));
  ws.on('close', () => {
    if (!me) return;
    players.delete(me.id);
    broadcast({ t: 'leave', id: me.id });
  });
  ws.on('error', () => {});
});

// Positioner för alla som har rört sig skickas ut i ett paket per tick.
setInterval(() => {
  const changed = [...players.values()].filter((p) => p.dirty);
  if (!changed.length) return;
  for (const p of changed) p.dirty = false;
  broadcast({
    t: 'states',
    list: changed.map((p) => [
      p.id,
      p.world,
      +p.x.toFixed(3),
      +p.y.toFixed(3),
      +p.a.toFixed(3),
      p.moving ? 1 : 0,
      p.color,
    ]),
  });
}, TICK_MS);

// Klockan skickas ut varje halvminut så att ingen hinner glida isär.
setInterval(() => {
  if (players.size) broadcast(clockMessage());
}, 30000);

// Släng anslutningar som slutat svara.
setInterval(() => {
  for (const p of players.values()) {
    if (!p.alive) {
      p.ws.terminate();
      continue;
    }
    p.alive = false;
    try {
      p.ws.ping();
    } catch {}
  }
}, 15000);

openStore()
  .then((s) => {
    store = s;
    console.log('Konton sparas i ' + s.kind);
  })
  .catch((e) => console.error('Kunde inte öppna lagringen, konton är avstängda:', e.message))
  .finally(() =>
    server.listen(PORT, () => console.log('Arre simulator körs på http://localhost:' + PORT)),
  );
for (const sig of ['SIGTERM', 'SIGINT'])
  process.on(sig, () => {
    try {
      store?.flush();
    } catch {}
    process.exit(0);
  });

// Arre simulator 2.0 – multiplayerserver.
// Serverar spelets filer och skickar spelarnas positioner och chatt mellan varandra via WebSocket.
// Starta: npm install && npm start   (porten sätts med PORT, standard 8080)
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT) || 8080;
const ROOT = path.resolve(__dirname, '..');
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS) || 40;
const TICK_MS = 100; // positioner skickas ut 10 gånger per sekund

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
    res.end(JSON.stringify({ ok: true, players: players.size }));
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
      me.x = num(m.x, 0, 128) ?? me.x;
      me.y = num(m.y, 0, 128) ?? me.y;
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

server.listen(PORT, () => console.log('Arre simulator körs på http://localhost:' + PORT));

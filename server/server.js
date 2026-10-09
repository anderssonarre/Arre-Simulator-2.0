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
const ai = require('./ai');
const stats = require('./stats');

const PORT = Number(process.env.PORT) || 8080;
const ROOT = path.resolve(__dirname, '..');
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS) || 40;
const TICK_MS = 100; // positioner skickas ut 10 gånger per sekund
// Gemensam spelklocka och fredagsfest. Samma uträkning som i spelet (js/shared/clock.js),
// räknad från en fast tidpunkt så att alla får samma tid och den överlever omstarter.
const { partyStatus, gameMinutesAt } = require('../js/shared/clock.js');
const paper = require('./paper.js');
const aiQuests = require('./quests.js');
const quiz = require('./quiz.js');
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
// Versionen av spelet som servern kör. Render sätter RENDER_GIT_COMMIT vid varje deploy,
// annars blir det tiden servern startade. Skrivs in i sidan och skickas när spelet ansluter,
// så att en flik med äldre kod vet att den ska ladda om (se js/net/online.js).
const BUILD = (process.env.RENDER_GIT_COMMIT || '').slice(0, 12) || 't' + Date.now().toString(36);
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
    res.end(
      JSON.stringify({
        ok: true,
        players: players.size,
        accounts: !!store,
        ai: ai.enabled(),
        seed: campusSeed, // slumpfrö för personligheterna, samma för alla (js/game/traits.js)
        build: BUILD,
      }),
    );
    return;
  }
  // Samma statistik som JSON, för speltestaren. Svaren från Tyck till kräver STATS_KEY om den är satt.
  if (url === '/stats.json') {
    if (!store) return json(res, 503, {});
    const key = process.env.STATS_KEY,
      show = !key || new URL(req.url, 'http://x').searchParams.get('key') === key;
    Promise.all([
      store.getStats(),
      show ? store.getFeedback(40) : null,
      store.getKv('paper:latest'),
      store.getKv('paper-events:' + paper.weekKey()),
    ])
      .then(([s, f, issue, week]) =>
        json(res, 200, {
          ...stats.summary(s),
          tyckTill: f,
          tidning: issue ? { vecka: issue.week, rubrik: issue.rubrik } : null,
          händelserDenHärVeckan: (week || []).length,
          spelareOnline: players.size,
        }),
      )
      .catch((e) => {
        console.error(e);
        json(res, 500, {});
      });
    return;
  }
  if (url === '/stats') {
    if (!store) return res.writeHead(503).end('Statistiken är inte igång.');
    const key = process.env.STATS_KEY,
      show = !key || new URL(req.url, 'http://x').searchParams.get('key') === key;
    Promise.all([store.getStats(), show ? store.getFeedback(40) : null])
      .then(([s, f]) => {
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
        });
        res.end(stats.statsPage(s, f));
      })
      .catch((e) => {
        console.error(e);
        res.writeHead(500).end();
      });
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
    if (rel === 'index.html')
      data = String(data).replace('</head>', '<meta name="arre-build" content="' + BUILD + '">\n</head>');
    res.end(data);
  });
});

// ---- Konton och sparning ----
// Lösenord lagras som scrypt-hash med salt. Inloggningen ger en slumpad nyckel (token) som
// webbläsaren skickar med. Servern sparar bara en hash av nyckeln.
let store = null;
const MAX_SAVE = 300 * 1024;
const saveVersion = (s) => (Number.isInteger(s?.version) ? s.version : 1);
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
const eventLog = new Map();
function eventFlood(ip) {
  const now = Date.now(),
    list = (eventLog.get(ip) || []).filter((t) => now - t < 36e5);
  list.push(now);
  eventLog.set(ip, list);
  return list.length > 300;
}
let campusSeed = 1 + Math.floor(Math.random() * 1e6);
// Dagens AI-uppdrag: sparas per dag i databasen (eller i minnet utan databas).
const questDays = new Map();
async function todaysQuests(body) {
  const day = aiQuests.dayKey(),
    key = 'aiquests:' + day;
  if (questDays.has(day)) return questDays.get(day);
  const job = (async () => {
    const saved = store ? await store.getKv(key) : null;
    if (saved) return saved;
    if (!ai.spendDaily()) return null;
    try {
      const out = await ai.ask(
        aiQuests.buildQuestPrompt(body),
        'Hitta på dagens uppdrag nu.',
        3000,
        40000,
        aiQuests.QUEST_TOOL,
      );
      const list = aiQuests.cleanQuests(out, body, day);
      if (list.length && store) await store.putKv(key, list);
      return list;
    } catch (e) {
      console.error('AI uppdrag:', e.message);
      return null;
    }
  })();
  questDays.set(day, job);
  // Misslyckades det får nästa spelare försöka igen, och gamla dagar glöms.
  job.then((list) => !list?.length && questDays.delete(day));
  for (const d of questDays.keys()) if (d < day) questDays.delete(d);
  return job;
}
// Veckans quizfrågor: AI skriver dem en gång i veckan (sparas), annars reservfrågorna.
const quizWeeks = new Map();
async function weeksQuiz(week) {
  if (quizWeeks.has(week)) return quizWeeks.get(week);
  const job = (async () => {
    const saved = store ? await store.getKv('quiz:' + week) : null;
    if (saved) return saved;
    let list = null;
    if (ai.enabled() && ai.spendDaily())
      try {
        list = quiz.cleanQuiz(await ai.ask(quiz.buildQuizPrompt(week), 'Skriv veckans frågor nu.', 2000, 40000, quiz.QUIZ_TOOL));
      } catch (e) {
        console.error('AI quiz:', e.message);
      }
    list ??= quiz.reservQuiz(week);
    if (store) await store.putKv('quiz:' + week, list);
    return list;
  })();
  quizWeeks.set(week, job);
  return job;
}
// Ger ut numret för en vecka, en gång. Med AI skriver Haiku, annars blir det rubriker.
const publishing = new Map();
async function publishPaper(week) {
  const done = await store.getKv('paper:' + week);
  if (done) return done;
  if (publishing.has(week)) return publishing.get(week);
  const job = (async () => {
    const happenings = (await store.getKv('paper-events:' + week)) || [];
    if (happenings.length < 2) return null;
    let issue = null;
    if (ai.enabled() && ai.spendDaily())
      try {
        issue = paper.cleanPaper(
          await ai.ask(
            paper.buildPaperPrompt(week, happenings.map(paper.factText)),
            'Skriv numret nu.',
            2000,
            40000,
            paper.PAPER_TOOL,
          ),
          week,
        );
      } catch (e) {
        console.error('AI tidning:', e.message);
      }
    issue ??= paper.templatePaper(week, happenings);
    if (issue) {
      issue.publicerad = Date.now();
      await store.putKv('paper:' + week, issue);
      await store.putKv('paper:latest', issue);
    }
    return issue;
  })().finally(() => publishing.delete(week));
  publishing.set(week, job);
  return job;
}
const noAi = (res) => res.writeHead(204, { 'cache-control': 'no-store' }).end();
// Vem som räknas mot AI-taket: kontot om man är inloggad, annars spelarens eget id.
async function aiWho(req) {
  if (store) {
    const key = await sessionKey(req).catch(() => null);
    if (key) return 'u:' + key;
  }
  const id = String(req.headers['x-arre-player'] || '');
  return /^[a-z0-9-]{8,40}$/i.test(id) ? 'p:' + id : null;
}
// Dagens liv delas av alla: ett svar per speldag på servern (gemensamma klockan).
const sharedDays = new Map(); // serverdag -> Promise med svaret
const serverDayNow = () => Math.floor(gameMinutesAt(Date.now()) / 1440) + 1;
const onlineNames = () => [...new Set([...players.values()].map((p) => p.name))].slice(0, 12);
function sharedDay(day, body) {
  if (sharedDays.has(day)) return sharedDays.get(day);
  if (!ai.spendDaily()) return null;
  const job = ai.dayLife({ ...body, players: onlineNames() }).catch((e) => {
    console.error('AI dag:', e.message);
    sharedDays.delete(day); // nästa spelare får försöka igen
    return null;
  });
  sharedDays.set(day, job);
  for (const d of sharedDays.keys()) if (d < day - 2) sharedDays.delete(d);
  return job;
}
const clientIp = (req) =>
  (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
async function handleApi(req, res, url) {
  // AI-samtal med personerna. Svarar 204 när AI inte finns eller taket är nått: då tar spelet
  // sina färdiga repliker i stället.
  if (url === '/api/talk' && req.method === 'POST') {
    if (!ai.enabled()) return noAi(res);
    let body;
    try {
      body = await readBody(req, 8192);
    } catch {
      return json(res, 413, {});
    }
    if (!body || typeof body.text !== 'string' || !body.text.trim()) return json(res, 400, {});
    if (!ai.allowed(await aiWho(req), clientIp(req))) return noAi(res);
    try {
      return json(res, 200, await ai.talk(body));
    } catch (e) {
      console.error('AI:', e.message);
      return noAi(res);
    }
  }
  // Dagens liv: tankar och samtal. Online gäller samma svar för alla under hela speldagen.
  if (url === '/api/day' && req.method === 'POST') {
    if (!ai.enabled()) return noAi(res);
    let body;
    try {
      body = await readBody(req, 24576);
    } catch {
      return json(res, 413, {});
    }
    if (!body || !Array.isArray(body.people) || !body.people.length) return json(res, 400, {});
    const day = Number(body.serverDay),
      today = serverDayNow();
    if (Number.isInteger(day) && Math.abs(day - today) <= 1) {
      const out = await sharedDay(day, body);
      return out ? json(res, 200, { ...out, shared: true }) : noAi(res);
    }
    // Inte online: ett eget svar, som räknas mot spelarens tak.
    if (!ai.allowed(await aiWho(req), clientIp(req))) return noAi(res);
    try {
      return json(res, 200, await ai.dayLife({ ...body, players: [String(body.playerName || '')] }));
    } catch (e) {
      console.error('AI dag:', e.message);
      return noAi(res);
    }
  }
  // Dagens AI-skrivna sidouppdrag, samma för alla (server/quests.js). Ett anrop per dygn.
  if (url === '/api/quests' && req.method === 'POST') {
    if (!ai.enabled()) return noAi(res);
    let body;
    try {
      body = await readBody(req, 24576);
    } catch {
      return json(res, 413, {});
    }
    if (!body || !Array.isArray(body.people) || !Array.isArray(body.places)) return json(res, 400, {});
    const list = await todaysQuests(body);
    return list?.length ? json(res, 200, { uppdrag: list }) : noAi(res);
  }
  // Hur de du känner hälsar på just dig idag.
  if (url === '/api/greet' && req.method === 'POST') {
    if (!ai.enabled()) return noAi(res);
    let body;
    try {
      body = await readBody(req, 16384);
    } catch {
      return json(res, 413, {});
    }
    if (!body || !Array.isArray(body.people) || !body.people.length) return json(res, 400, {});
    if (!ai.allowed(await aiWho(req), clientIp(req))) return noAi(res);
    try {
      return json(res, 200, await ai.greetings(body));
    } catch (e) {
      console.error('AI hälsningar:', e.message);
      return noAi(res);
    }
  }
  // ---- Pubquizen på Filicia (server/quiz.js): åtta frågor per vecka, samma för alla ----
  if (url === '/api/quiz' && req.method === 'GET') {
    const week = paper.weekKey(),
      frågor = await weeksQuiz(week),
      topp = store ? (await store.getKv('quiz-score:' + week)) || [] : [];
    return json(res, 200, { week, frågor, topp });
  }
  if (url === '/api/quiz/score' && req.method === 'POST') {
    if (!store) return json(res, 200, { topp: [] });
    if (eventFlood(clientIp(req))) return json(res, 429, {});
    let b;
    try {
      b = await readBody(req, 512);
    } catch {
      return json(res, 400, {});
    }
    const key = 'quiz-score:' + paper.weekKey(),
      topp = quiz.addScore((await store.getKv(key)) || [], b?.name, b?.score);
    await store.putKv(key, topp);
    return json(res, 200, { topp });
  }
  if (!store) return json(res, 503, { error: 'Konton är inte igång på den här servern.' });
  // ---- Campustidningen (server/paper.js) ----
  // Spelet berättar vad som hänt: bara typ och några korta fält, servern skriver meningarna.
  if (url === '/api/happening' && req.method === 'POST') {
    if (eventFlood(clientIp(req))) return json(res, 429, {});
    let b;
    try {
      b = await readBody(req, 1024);
    } catch {
      return json(res, 400, {});
    }
    const h = paper.cleanHappening(b);
    if (!h) return json(res, 400, {});
    const key = 'paper-events:' + paper.weekKey(),
      list = (await store.getKv(key)) || [];
    list.push({ ...h, at: Date.now() });
    await store.putKv(key, list.slice(-200));
    return json(res, 200, { ok: true });
  }
  if (url === '/api/paper' && req.method === 'GET') {
    // Testerna kan be om att veckan som pågår ges ut direkt (bara med ARRE_TEST=1).
    const now = process.env.ARRE_TEST === '1' && /[?&]publish=now\b/.test(req.url);
    const issue = await publishPaper(now ? paper.weekKey() : paper.lastWeekKey());
    const latest = issue || (await store.getKv('paper:latest'));
    const thisWeek = (await store.getKv('paper-events:' + paper.weekKey())) || [];
    return json(res, 200, {
      issue: latest || null,
      week: paper.weekKey(),
      nytt: thisWeek.slice(-6).reverse().map(paper.factText),
      antal: thisWeek.length,
    });
  }
  // Topplistor: spelet skickar sina siffror, alla kan läsa de bästa.
  if (url === '/api/records' && req.method === 'GET')
    return json(res, 200, await store.getRecords());
  if (url === '/api/record' && req.method === 'POST') {
    if (eventFlood(clientIp(req))) return json(res, 429, {});
    let b;
    try {
      b = await readBody(req, 1024);
    } catch {
      return json(res, 400, {});
    }
    const name = typeof b.name === 'string' ? b.name.trim().slice(0, 24) : '';
    if (!name) return json(res, 400, {});
    const n = (v, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(0, v)) : 0);
    await store.putRecord(name.toLowerCase(), {
      name,
      credits: n(b.credits, 200),
      avg: n(b.avg, 5),
      courses: n(b.courses, 40),
      friends: n(b.friends, 40),
      jobs: n(b.jobs, 100000),
      at: Date.now(),
    });
    return json(res, 200, {});
  }
  // Anonym statistik och "tyck till". Högst 300 per timme och adress.
  if ((url === '/api/event' || url === '/api/feedback') && req.method === 'POST') {
    if (eventFlood(clientIp(req))) return json(res, 429, {});
    let body;
    try {
      body = await readBody(req, 4096);
    } catch {
      return json(res, 400, {});
    }
    if (url === '/api/feedback') {
      const f = stats.cleanFeedback(body);
      if (f) await store.addFeedback(f);
      return json(res, f ? 200 : 400, {});
    }
    const c = stats.countersFor(body);
    if (c) await store.addStats(c);
    return json(res, c ? 200 : 400, {});
  }
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
        // En flik med äldre kod får inte skriva över en sparning från en nyare version.
        const prev = await store.getSave(key);
        if (prev && saveVersion(JSON.parse(prev.data)) > saveVersion(body.save))
          return json(res, 409, {
            error: 'Det finns en nyare version av spelet. Ladda om sidan.',
            code: 'newer',
          });
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
const EMOTES = new Set(['vinka', 'skåla', 'dansa', 'highfive', 'skratta', 'sjunga']);
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
async function deliverNotes(p) {
  if (!store) return;
  try {
    const list = await store.takeNotes(p.name.toLowerCase());
    if (list.length) send(p.ws, { t: 'notes', list });
  } catch (e) {
    console.error(e);
  }
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
        build: BUILD,
        id: me.id,
        clock: clockMessage(),
        players: [...players.values()].filter((p) => p !== me).map(publicInfo),
      });
      broadcast({ t: 'join', p: publicInfo(me) }, me);
      deliverNotes(me);
      return;
    }
    if (!me) return;
    if (m.t === 'state') {
      // Världsnamn är korta ord, t.ex. outdoor, w33, home:3. Koordinater hålls inom kartan.
      const world = clean(m.world, 24);
      if (/^[a-z0-9:]{1,24}$/.test(world)) me.world = world;
      me.x = num(m.x, 0, 1024) ?? me.x;
      me.y = num(m.y, 0, 1024) ?? me.y;
      me.a = num(m.a, -1e6, 1e6) ?? me.a;
      me.moving = !!m.moving;
      if (/^#[0-9a-f]{6}$/i.test(m.color)) me.color = m.color;
      me.car = /^#[0-9a-f]{6}$/i.test(m.car) ? m.car : ''; // kör egen bil (färgen)
      me.dirty = true;
    } else if (m.t === 'chat') {
      const now = Date.now(),
        text = clean(m.text, 140);
      if (!text || now - me.lastChat < 800) return;
      me.lastChat = now;
      broadcast({ t: 'chat', id: me.id, name: me.name, text, world: me.world });
    } else if (m.t === 'invite' || m.t === 'answer') {
      // Inbjudningar mellan spelare (hem på besök). Servern skickar bara vidare, högst var tredje sekund.
      const to = players.get(m.to),
        now = Date.now();
      if (!to || to === me || now - (me.lastInvite || 0) < (m.t === 'invite' ? 3000 : 300)) return;
      me.lastInvite = now;
      const kind = ['home', 'job', 'kubb'].includes(m.kind) ? m.kind : null;
      if (!kind) return;
      // Inbjudan hem tar med värdens möbler (id och plats) så att gästen ser samma hem.
      let home;
      if (m.t === 'invite' && m.home && typeof m.home === 'object') {
        const ok = (s) => typeof s === 'string' && /^[a-zåäö]{2,16}$/.test(s);
        home = {
          typ: ok(m.home.typ) ? m.home.typ : 'etta',
          items: (Array.isArray(m.home.items) ? m.home.items : [])
            .slice(0, 8)
            .filter((it) => it && ok(it.id) && ok(it.slot))
            .map((it) => ({ id: it.id, slot: it.slot })),
        };
      }
      send(to.ws, { t: m.t, from: me.id, name: me.name, kind, accept: !!m.accept, home });
    } else if (m.t === 'emote') {
      // Vinka, skåla, dansa ... syns för alla i samma värld (spelet filtrerar). Högst en per sekund.
      const now = Date.now();
      if (!EMOTES.has(m.e) || now - (me.lastEmote || 0) < 900) return;
      me.lastEmote = now;
      broadcast({ t: 'emote', id: me.id, e: m.e, world: me.world });
    } else if (m.t === 'throw') {
      // En snöboll: var den kastades och åt vilket håll. Alla i samma värld ser den flyga.
      const now = Date.now();
      if (now - (me.lastThrow || 0) < 400) return;
      me.lastThrow = now;
      const x = num(m.x, 0, 1024),
        y = num(m.y, 0, 1024),
        a = num(m.a, -1e6, 1e6),
        p = num(m.p, -1, 1);
      if (x === null || y === null || a === null) return;
      broadcast({ t: 'throw', id: me.id, world: me.world, x, y, a, p: p ?? 0 }, me);
    } else if (m.t === 'hit' || m.t === 'gift' || m.t === 'duel') {
      // Till en spelare: träffad av en snöboll, en present ur väskan eller resultatet i ett spel.
      const to = players.get(m.to),
        now = Date.now();
      if (!to || to === me || now - (me['last' + m.t] || 0) < (m.t === 'hit' ? 300 : 1000)) return;
      me['last' + m.t] = now;
      const out = { t: m.t, from: me.id, name: me.name };
      if (m.t === 'gift') {
        if (typeof m.item !== 'string' || !/^[a-zåäö]{2,16}$/.test(m.item)) return;
        out.item = m.item;
      }
      if (m.t === 'duel') {
        if (!['kubb'].includes(m.game)) return;
        out.game = m.game;
        out.score = num(m.score, 0, 99) ?? 0;
      }
      send(to.ws, out);
    } else if (m.t === 'note') {
      // Lappar till ett spelarnamn. Finns mottagaren online levereras lappen direkt, annars när hen loggar in.
      const text = clean(m.text, 200),
        to = clean(m.to, 24),
        now = Date.now();
      if (!text || !to || !store || now - (me.lastNote || 0) < 2000) return;
      me.lastNote = now;
      store
        .addNote(to.toLowerCase(), { from: me.name, text, at: now })
        .then(() => {
          for (const p of players.values())
            if (p.name.toLowerCase() === to.toLowerCase()) deliverNotes(p);
        })
        .catch(() => {});
      send(ws, { t: 'noteSent', to });
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
      p.car || '',
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
  .then(async (s) => {
    store = s;
    console.log('Konton sparas i ' + s.kind);
    // Personligheternas slumpfrö sparas, så att alla ser samma personligheter även efter omstart.
    try {
      const saved = (await s.getStats()).campusSeed;
      if (saved) campusSeed = saved;
      else await s.addStats({ campusSeed });
    } catch (e) {
      console.error('Kunde inte läsa slumpfröet:', e.message);
    }
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

// AI-samtal: personerna i spelet svarar med Claude Haiku via servern.
// Nyckeln ligger bara på servern (miljövariabeln ANTHROPIC_API_KEY) och syns aldrig i spelet.
// Tak för kostnaden: AI_DAILY_LIMIT samtal per dygn för hela servern och AI_HOURLY_LIMIT per spelare
// och timme. Utan nyckel, eller när taket är nått, använder spelet sina färdiga repliker.
'use strict';
const KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.AI_MODEL || 'claude-haiku-5-5';
const BASE = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
const DAILY = Number(process.env.AI_DAILY_LIMIT) || 1500;
const HOURLY = Number(process.env.AI_HOURLY_LIMIT) || 60;
const ACTIONS = ['ingen', 'gladare', 'surare', 'kaffe', 'tips', 'minns'];

// Taket räknas per spelare (konto, annars spelarens id), inte per IP-adress, eftersom alla på
// samma skolnät syns som samma adress utåt. Ett lösare tak per IP (IP_FACTOR gånger större)
// hindrar att någon kringgår taket genom att hitta på nya spelar-id.
const IP_FACTOR = Number(process.env.AI_IP_FACTOR) || 8;
let day = '',
  usedToday = 0;
const perPlayer = new Map(), // spelare -> [tidpunkter]
  perIp = new Map(); // ip -> [tidpunkter]

function enabled() {
  return !!KEY;
}
function newDay() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    usedToday = 0;
  }
}
// Räknar ett anrop mot hela serverns dygnstak. Ger false när taket är nått.
function spendDaily() {
  newDay();
  if (usedToday >= DAILY) return false;
  usedToday++;
  return true;
}
function underLimit(map, key, max, now) {
  const list = (map.get(key) || []).filter((t) => now - t < 36e5);
  map.set(key, list);
  return list.length < max;
}
// who: "u:<konto>" eller "p:<spelar-id>". Utan who räknas IP-adressen som spelare.
function allowed(who, ip) {
  newDay();
  if (usedToday >= DAILY) return false;
  const now = Date.now(),
    player = who || 'ip:' + ip;
  if (!underLimit(perPlayer, player, HOURLY, now)) return false;
  if (ip && !underLimit(perIp, ip, HOURLY * IP_FACTOR, now)) return false;
  perPlayer.get(player).push(now);
  if (ip) perIp.get(ip).push(now);
  usedToday++;
  return true;
}
// Rensar gamla spelare så att listorna inte växer för evigt.
setInterval(() => {
  const now = Date.now();
  for (const m of [perPlayer, perIp])
    for (const [k, list] of m) if (!list.some((t) => now - t < 36e5)) m.delete(k);
}, 6e5).unref?.();
const str = (v, n) => String(v ?? '').slice(0, n);

// Bygger instruktionen till modellen av det spelet skickar. Allt kortas, så att ingen kan skicka romaner.
function buildPrompt(b) {
  const p = b.person || {},
    c = b.context || {},
    mem = Array.isArray(b.memories) ? b.memories.slice(-5).map((m) => '- ' + str(m, 120)) : [];
  return [
    'Du spelar ' +
      str(p.name, 40) +
      ' i Arre Simulator, ett spel om studielivet på campus i Vasa (Novia och VAMK, W33, Technobothnia).',
    'Roll: ' +
      str(p.role, 60) +
      '. Personlighet: ' +
      str(p.personality, 20) +
      '. Favoritämne: ' +
      str(p.topic, 30) +
      '.',
    'Du pratar med ' +
      str(c.playerName, 30) +
      '. Er relation: ' +
      str(c.relationName, 30) +
      ' (' +
      Number(c.relation) +
      ' av 100).',
    'Just nu: ' +
      str(c.weekday, 10) +
      ' kl. ' +
      str(c.time, 5) +
      ', ' +
      str(c.place, 40) +
      (c.activity ? ', du ' + str(c.activity, 30) : '') +
      '.',
    c.drunk
      ? 'Du har varit på fest (kanske Ollis tisdag) och är glad och lite berusad, det märks på hur du pratar.'
      : '',
    c.courses ? 'Terminens kurser: ' + str(c.courses, 120) + '.' : '',
    c.traits ? 'Dina personlighetsdrag (låt dem märkas tydligt): ' + str(c.traits, 240) + '.' : '',
    c.thought ? 'Det här går du och tänker på idag (ta gärna upp det): ' + str(c.thought, 200) : '',
    c.playerState
      ? 'Spelaren är ' + str(c.playerState, 60) + ', det märks. Reagera på det på ett vänligt sätt.'
      : '',
    c.mood ? 'Ditt humör idag: ' + str(c.mood, 30) + '. Låt det märkas lite.' : '',
    c.friends ? 'Dina vänner och ovänner på campus: ' + str(c.friends, 160) + '.' : '',
    c.rumor ? 'Skvaller du har hört om spelaren (nämn det gärna): ' + str(c.rumor, 160) : '',
    mem.length ? 'Det här minns du om ' + str(c.playerName, 30) + ':\n' + mem.join('\n') : '',
    'Svara på svenska som en finlandssvensk student, kort: en eller två meningar, högst 35 ord. Håll dig i rollen, var vänlig och passande för alla åldrar.',
    'Svara med verktyget svara.',
    'handling: gladare om spelaren var trevlig, surare om spelaren var otrevlig, kaffe om du föreslår kaffe, tips om du ger ett studietips, minns om spelaren berättade något personligt, annars ingen.',
  ]
    .filter(Boolean)
    .join('\n');
}

async function talk(b) {
  const history = (Array.isArray(b.history) ? b.history : [])
    .slice(-10)
    .map((h) => ({ role: h.who === 'you' ? 'user' : 'assistant', content: str(h.text, 300) }))
    .filter((m) => m.content);
  // Meddelandena måste börja med spelaren och växla mellan rollerna.
  const msgs = [];
  for (const m of [...history, { role: 'user', content: str(b.text, 200) }]) {
    if (!msgs.length && m.role === 'assistant') continue;
    if (msgs.length && msgs[msgs.length - 1].role === m.role)
      msgs[msgs.length - 1].content += '\n' + m.content;
    else msgs.push({ ...m });
  }
  const r = await fetch(BASE + '/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      system: buildPrompt(b),
      messages: msgs,
      tools: [TOOLS.svara],
      tool_choice: { type: 'tool', name: 'svara' },
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw Error('AI svarade ' + r.status);
  const data = await r.json();
  let out = (data.content || []).find((c) => c.type === 'tool_use')?.input;
  if (!out || typeof out !== 'object') {
    const text = (data.content || [])
      .map((c) => c.text || '')
      .join('')
      .trim();
    try {
      out = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    } catch {
      out = { svar: text };
    }
  }
  return {
    svar: str(out.svar, 300).trim(),
    handling: ACTIONS.includes(out.handling) ? out.handling : 'ingen',
    minne: str(out.minne, 120).trim(),
  };
}

// ---- Dagens liv: ett anrop per speldag för hela servern ----
// Tankar och samtal mellan personerna är samma för alla som spelar (server.js sparar svaret per
// speldag). Hälsningarna till dig är personliga och skrivs i ett eget, mindre anrop.
const DAY_PEOPLE = 24;
// Frågar modellen och tvingar svaret genom ett verktyg med schema, så att det alltid är giltig
// JSON i rätt form. Ger verktygets indata. Kapas svaret (för långt) märks det i loggen.
async function ask(system, user, maxTokens, timeout, tool) {
  const r = await fetch(BASE + '/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
    }),
    signal: AbortSignal.timeout(timeout),
  });
  if (!r.ok) throw Error('AI svarade ' + r.status);
  const data = await r.json();
  if (data.stop_reason === 'max_tokens')
    console.warn('AI: svaret från ' + tool.name + ' kapades, höj max_tokens');
  const used = (data.content || []).find((c) => c.type === 'tool_use' && c.name === tool.name);
  if (used?.input && typeof used.input === 'object') return used.input;
  // Reserv: JSON i vanlig text.
  const text = (data.content || [])
    .map((c) => c.text || '')
    .join('')
    .trim();
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}
const S = (description, extra = {}) => ({ type: 'string', description, ...extra });
const TOOLS = {
  svara: {
    name: 'svara',
    description: 'Personens replik till spelaren och vad som händer.',
    input_schema: {
      type: 'object',
      properties: {
        svar: S('Din replik, en eller två meningar, högst 35 ord.'),
        handling: { type: 'string', enum: ACTIONS },
        minne: S('Valfritt: en kort sak värd att minnas om spelaren.'),
      },
      required: ['svar', 'handling'],
    },
  },
  vardag: {
    name: 'vardag',
    description: 'Dagens tankar och samtal för personerna på campus.',
    input_schema: {
      type: 'object',
      properties: {
        personer: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: S('Personens id.'), tanke: S('En mening i jagform.') },
            required: ['id', 'tanke'],
          },
        },
        samtal: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              a: S('Id för den som börjar.'),
              b: S('Id för den andra.'),
              repliker: { type: 'array', items: { type: 'string' } },
              om: S('Namnet på en riktig studerande som samtalet handlar om, annars tomt.'),
            },
            required: ['a', 'b', 'repliker'],
          },
        },
      },
      required: ['personer', 'samtal'],
    },
  },
  halsa: {
    name: 'halsa',
    description: 'Hur var och en hälsar på spelaren idag.',
    input_schema: {
      type: 'object',
      properties: {
        personer: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: S('Personens id.'),
              hälsningar: { type: 'array', items: { type: 'string' } },
            },
            required: ['id', 'hälsningar'],
          },
        },
      },
      required: ['personer'],
    },
  },
};
// Modellen svarar med listor; resten av koden använder objekt med id som nyckel.
const byId = (v, key) =>
  Array.isArray(v)
    ? Object.fromEntries(v.filter((x) => x && x.id).map((x) => [String(x.id), x[key] ?? x]))
    : v;
const playerList = (b) =>
  (Array.isArray(b.players) ? b.players : [])
    .map((n) => str(n, 24).trim())
    .filter(Boolean)
    .slice(0, 12);
function buildDayPrompt(b) {
  const people = (Array.isArray(b.people) ? b.people : []).slice(0, DAY_PEOPLE).map((p) =>
    [
      '- ' + str(p.id, 20) + ': ' + str(p.name, 40) + ', ' + str(p.role, 40),
      'personlighet ' + str(p.personality, 20) + ', gillar ' + str(p.topic, 30),
      p.traits ? 'drag: ' + str(p.traits, 220) : '',
      'humör ' + str(p.mood, 30),
      'dagen: ' + str(p.plan, 160),
      p.friends ? 'vänner/ovänner: ' + str(p.friends, 120) : '',
    ]
      .filter(Boolean)
      .join('; '),
  );
  const news = (Array.isArray(b.news) ? b.news : []).slice(-6).map((n) => '- ' + str(n, 140));
  const pairs = (Array.isArray(b.pairs) ? b.pairs : [])
    .slice(0, 6)
    .map((p) => '- ' + str(p.a, 20) + ' och ' + str(p.b, 20) + ' (' + str(p.why, 60) + ')');
  const players = playerList(b);
  return [
    'Du skriver vardagen för personerna i Arre Simulator, ett spel om studielivet på campus i Vasa (Novia och VAMK, W33, Technobothnia, Filicia).',
    'Idag: ' + str(b.date, 40) + ', ' + str(b.weekday, 10) + ', ' + str(b.weather, 40) + '.',
    b.events ? 'På campus: ' + str(b.events, 160) + '.' : '',
    players.length
      ? 'Riktiga studerande som spelar och går runt på campus: ' + players.join(', ') + '.'
      : '',
    'Personerna:',
    ...people,
    news.length ? 'Nyheter på campus:\n' + news.join('\n') : '',
    pairs.length ? 'De här kommer att ses idag:\n' + pairs.join('\n') : '',
    'Skriv för VARJE person "tanke": vad personen går och tänker på idag, en mening i jagform, konkret och kopplad till dagen, humöret, vänner eller nyheter. Inte allmänt.',
    'Skriv också "samtal": ett kort samtal för varje par som ses idag, 3 eller 4 repliker som växlar mellan dem (a börjar), högst 14 ord per replik. De pratar om något som händer i deras liv, gärna skvaller, kurser, planer eller varandra.' +
      (players.length
        ? ' Låt ett eller två av samtalen handla om en av de riktiga studerande, och skriv då hens namn i "om".'
        : ''),
    'Svenska som finlandssvenska studerande pratar, vardagligt, gärna lite humor. Passande för alla åldrar. Hitta inte på nya personer.',
    'Svara med verktyget vardag: en tanke för varje person och ett samtal för varje par.',
  ]
    .filter(Boolean)
    .join('\n');
}
// Tar bara med det som går att använda: kända personer, kända spelare och korta texter.
function cleanDay(out, b) {
  const ids = new Set((Array.isArray(b.people) ? b.people : []).map((p) => String(p.id)));
  const players = playerList(b);
  const personer = {};
  for (const [id, v] of Object.entries(out?.personer || {})) {
    if (!ids.has(id) || !v || typeof v !== 'object') continue;
    const tanke = str(v.tanke, 200).trim();
    if (tanke) personer[id] = { tanke };
  }
  const samtal = (Array.isArray(out?.samtal) ? out.samtal : [])
    .filter((s) => s && ids.has(s.a) && ids.has(s.b) && s.a !== s.b && Array.isArray(s.repliker))
    .slice(0, 8)
    .map((s) => ({
      a: s.a,
      b: s.b,
      repliker: s.repliker
        .map((r) => str(r, 120).trim())
        .filter(Boolean)
        .slice(0, 5),
      om: players.find((n) => n.toLowerCase() === String(s.om || '').toLowerCase()) || null,
    }))
    .filter((s) => s.repliker.length >= 2);
  return { personer, samtal };
}
async function dayLife(b) {
  const out = await ask(buildDayPrompt(b), 'Skriv dagens vardag nu.', 3000, 40000, TOOLS.vardag);
  return cleanDay({ ...out, personer: byId(out.personer, null) }, b);
}

// Personliga hälsningar: hur de du känner hälsar på just dig idag.
function buildGreetPrompt(b) {
  const people = (Array.isArray(b.people) ? b.people : []).slice(0, DAY_PEOPLE).map((p) =>
    [
      '- ' + str(p.id, 20) + ': ' + str(p.name, 40) + ', personlighet ' + str(p.personality, 20),
      'humör ' + str(p.mood, 30),
      p.traits ? 'drag: ' + str(p.traits, 220) : '',
      'relation: ' + str(p.relation, 30),
      p.thought ? 'tänker på: ' + str(p.thought, 160) : '',
      p.memory ? 'minns om dig: ' + str(p.memory, 160) : '',
      p.rumor ? 'har hört: ' + str(p.rumor, 140) : '',
    ]
      .filter(Boolean)
      .join('; '),
  );
  return [
    'Personer i Arre Simulator, ett spel om studielivet på campus i Vasa, ska hälsa på ' +
      str(b.playerName, 30) +
      ' när de går förbi idag.',
    ...people,
    'Skriv två korta hälsningar per person, högst 8 ord var, som passar relationen, humöret och det de minns eller har hört. Finlandssvensk vardagssvenska, passande för alla åldrar.',
    'Svara med verktyget halsa.',
  ].join('\n');
}
function cleanGreet(out, b) {
  const ids = new Set((Array.isArray(b.people) ? b.people : []).map((p) => String(p.id)));
  const res = {};
  for (const [id, list] of Object.entries(out || {})) {
    if (!ids.has(id) || !Array.isArray(list)) continue;
    const l = list
      .map((h) => str(h, 80).trim())
      .filter(Boolean)
      .slice(0, 3);
    if (l.length) res[id] = l;
  }
  return res;
}
async function greetings(b) {
  const out = await ask(buildGreetPrompt(b), 'Skriv hälsningarna nu.', 1200, 20000, TOOLS.halsa);
  return cleanGreet(out.personer ? byId(out.personer, 'hälsningar') : out, b);
}
module.exports = {
  ask,
  enabled,
  allowed,
  spendDaily,
  talk,
  buildPrompt,
  buildDayPrompt,
  cleanDay,
  dayLife,
  buildGreetPrompt,
  cleanGreet,
  greetings,
};

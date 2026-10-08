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

let day = '',
  usedToday = 0;
const perClient = new Map(); // ip -> [tidpunkter]

function enabled() {
  return !!KEY;
}
function allowed(ip) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    usedToday = 0;
  }
  if (usedToday >= DAILY) return false;
  const now = Date.now(),
    list = (perClient.get(ip) || []).filter((t) => now - t < 36e5);
  if (list.length >= HOURLY) {
    perClient.set(ip, list);
    return false;
  }
  list.push(now);
  perClient.set(ip, list);
  usedToday++;
  return true;
}
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
    c.mood ? 'Ditt humör idag: ' + str(c.mood, 30) + '. Låt det märkas lite.' : '',
    c.friends ? 'Dina vänner och ovänner på campus: ' + str(c.friends, 160) + '.' : '',
    c.rumor ? 'Skvaller du har hört om spelaren (nämn det gärna): ' + str(c.rumor, 160) : '',
    mem.length ? 'Det här minns du om ' + str(c.playerName, 30) + ':\n' + mem.join('\n') : '',
    'Svara på svenska som en finlandssvensk student, kort: en eller två meningar, högst 35 ord. Håll dig i rollen, var vänlig och passande för alla åldrar.',
    'Svara ENDAST med JSON: {"svar": "<din replik>", "handling": "<en av: ' +
      ACTIONS.join(', ') +
      '>", "minne": "<valfritt: en kort sak värd att minnas om spelaren>"}.',
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
    body: JSON.stringify({ model: MODEL, max_tokens: 200, system: buildPrompt(b), messages: msgs }),
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw Error('AI svarade ' + r.status);
  const data = await r.json(),
    text = (data.content || [])
      .map((c) => c.text || '')
      .join('')
      .trim();
  let out;
  try {
    out = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  } catch {
    out = { svar: text };
  }
  return {
    svar: str(out.svar, 300).trim(),
    handling: ACTIONS.includes(out.handling) ? out.handling : 'ingen',
    minne: str(out.minne, 120).trim(),
  };
}
module.exports = { enabled, allowed, talk, buildPrompt };

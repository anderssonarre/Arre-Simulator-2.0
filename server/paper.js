// Campustidningen: servern samlar vad som händer på campus under veckan, och varje måndag
// skrivs ett nytt nummer om förra veckan. Med AI skriver Claude Haiku artiklarna, utan AI
// blir det en enkel lista med rubriker. Spelet skickar bara strukturerade händelser
// (typ och några korta fält), aldrig fritext, och servern bygger själv meningarna.
'use strict';
const str = (v, n) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .slice(0, n);

// Händelser som får komma med i tidningen, och hur de blir en mening.
const KINDS = {
  femma: (h) => h.namn + ' fick en femma i ' + h.kurs + '.',
  godkand: (h) => h.namn + ' klarade tentan i ' + h.kurs + ' med betyg ' + h.betyg + '.',
  dackade: (h) => h.namn + ' fick hjälp hem efter en kväll på Filicia.',
  uppdrag: (h) =>
    h.namn +
    ' klarade uppdraget "' +
    h.titel +
    '"' +
    (h.person ? ' åt ' + h.person : '') +
    (h.märke ? ' och fick overallmärket ' + h.märke : '') +
    '.',
  van: (h) => h.namn + ' och ' + h.person + ' är numera vänner.',
  sitz: (h) => h.namn + ' var på sitzen på Filicia Castle.',
  praktik: (h) => h.namn + ' fick praktikplats på ' + h.företag + '.',
  examen: (h) => h.namn + ' tog examen och blev ' + h.yrke + '.',
  flytt: (h) => h.namn + ' flyttade till en ' + h.till + '.',
};
const FIELDS = ['kurs', 'betyg', 'titel', 'person', 'märke', 'företag', 'yrke', 'till'];

// Kontrollerar en händelse från spelet. Ger { kind, namn, ... } eller null.
function cleanHappening(b) {
  if (!b || !KINDS[b.kind]) return null;
  const h = { kind: b.kind, namn: str(b.namn, 24) || 'En studerande' };
  for (const f of FIELDS) if (b[f] != null) h[f] = str(b[f], 40);
  if (h.betyg && !/^[1-5]$/.test(h.betyg)) return null;
  return h;
}
const factText = (h) => KINDS[h.kind](h);

// Veckans nyckel i finsk tid, t.ex. "2026-v41" (ISO-vecka).
function weekKey(ms = Date.now()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Helsinki',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  const d = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day));
  const day = (d.getUTCDay() + 6) % 7; // måndag = 0
  d.setUTCDate(d.getUTCDate() - day + 3); // torsdagen i samma vecka avgör året
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week =
    1 + Math.round(((d - jan4) / 864e5 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return d.getUTCFullYear() + '-v' + String(week).padStart(2, '0');
}
const lastWeekKey = (ms = Date.now()) => weekKey(ms - 7 * 864e5);

// ---- Numret ----
function buildPaperPrompt(week, facts) {
  return [
    'Du är redaktör för Campustidningen, en liten studenttidning för campus i Vasa (Novia och VAMK, W33, Technobothnia, Filicia Castle) i spelet Arre Simulator.',
    'Skriv veckans nummer om ' + week + ' utifrån de här händelserna. Hitta inte på händelser som inte står här, men du får gärna ge dem färg och sammanhang.',
    'Händelser:',
    ...facts.slice(0, 80).map((f) => '- ' + f),
    'Skriv 3 till 6 korta artiklar. Varje artikel har en rubrik och 2 till 4 meningar. Slå ihop liknande händelser. Börja med det största.',
    'Ton: varm, lite skämtsam finlandssvensk studenttidning. Snäll mot alla, även den som däckade. Passande för alla åldrar. Använd spelarnas namn som de står.',
    'Svara med verktyget tidning.',
  ].join('\n');
}
const PAPER_TOOL = {
  name: 'tidning',
  description: 'Veckans nummer av Campustidningen.',
  input_schema: {
    type: 'object',
    properties: {
      rubrik: { type: 'string', description: 'Numrets huvudrubrik, högst 8 ord.' },
      artiklar: {
        type: 'array',
        items: {
          type: 'object',
          properties: { rubrik: { type: 'string' }, text: { type: 'string' } },
          required: ['rubrik', 'text'],
        },
      },
    },
    required: ['rubrik', 'artiklar'],
  },
};
function cleanPaper(out, week) {
  const artiklar = (Array.isArray(out?.artiklar) ? out.artiklar : [])
    .map((a) => ({ rubrik: str(a?.rubrik, 90), text: str(a?.text, 700) }))
    .filter((a) => a.rubrik && a.text)
    .slice(0, 6);
  if (!artiklar.length) return null;
  return { week, rubrik: str(out.rubrik, 90) || 'Veckan på campus', artiklar, ai: true };
}
// Utan AI: händelserna grupperade under enkla rubriker.
function templatePaper(week, happenings) {
  const groups = {
    'Veckans tentor': ['femma', 'godkand'],
    'Uppdrag och overallmärken': ['uppdrag'],
    'Nya vänner': ['van'],
    'Kvällarna på Filicia': ['sitz', 'dackade'],
    'Framtiden': ['praktik', 'examen', 'flytt'],
  };
  const artiklar = Object.entries(groups)
    .map(([rubrik, kinds]) => ({
      rubrik,
      text: happenings
        .filter((h) => kinds.includes(h.kind))
        .map(factText)
        .slice(0, 8)
        .join(' '),
    }))
    .filter((a) => a.text);
  return artiklar.length ? { week, rubrik: 'Veckan på campus', artiklar, ai: false } : null;
}
module.exports = {
  KINDS,
  cleanHappening,
  factText,
  weekKey,
  lastWeekKey,
  buildPaperPrompt,
  PAPER_TOOL,
  cleanPaper,
  templatePaper,
};

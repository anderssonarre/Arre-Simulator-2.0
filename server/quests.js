// AI-skrivna sidouppdrag: en gång per dygn skriver Claude Haiku några nya uppdrag i samma
// format som js/data/quests.js, utifrån personernas drag och platserna på campus. Samma
// uppdrag gäller för alla som spelar (server.js sparar dem per dag). Allt kontrolleras mot
// de personer, platser och handlingar som spelet skickar, och spelet kontrollerar igen.
'use strict';
const str = (v, n) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .slice(0, n);
const ID = /^[a-zA-Zåäö0-9]{2,24}$/;
const HANDLINGAR = ['kaffe', 'lunch'];
const VÄRLDAR = ['outdoor', 'w33', 'tech', 'gym'];
const DAGAR = ['mån', 'tis', 'ons', 'tor', 'fre', 'lör', 'sön'];
const num = (v, lo, hi) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.round(+v))) : 0);

// Dagens datum i finsk tid, t.ex. "2026-10-09".
function dayKey(ms = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Helsinki' }).format(new Date(ms));
}
function ctx(b) {
  const people = (Array.isArray(b.people) ? b.people : [])
    .filter((p) => ID.test(p?.id))
    .slice(0, 30);
  const places = (Array.isArray(b.places) ? b.places : []).filter((p) => ID.test(p?.id)).slice(0, 30);
  return { people, places };
}
function buildQuestPrompt(b) {
  const { people, places } = ctx(b);
  return [
    'Du hittar på sidouppdrag i Arre Simulator, ett spel om studielivet på campus i Vasa (Novia och VAMK).',
    'Uppdragen ska INTE handla om skolan, kurser eller tentor. De ska handla om vardagsliv, kompisar, hobbyer, mat, natur, fester, små mysterier och tjänster mellan vänner.',
    'Varje uppdrag ges av en person och ska passa personens drag tydligt.',
    'Personer (id: namn, drag):',
    ...people.map((p) => '- ' + p.id + ': ' + str(p.name, 40) + ', ' + str(p.traits, 200)),
    'Platser man kan gå till (id: namn):',
    ...places.map((p) => '- ' + p.id + ': ' + str(p.name, 50)),
    'Stegtyper:',
    '- plats: gå till en plats och tryck E. Fält: plats (id), mål, hittar (vad man hittar där). Valfritt: tid {från, till} (hela timmar 8 till 24) och dagar (mån tis ons tor fre lör sön).',
    '- prata: prata med en person. Fält: person (id), mål, knapp (vad spelaren säger), svar (vad personen svarar). Valfritt: kostar (1 till 5 euro).',
    '- gör: handling kaffe (köp en kaffe i en automat) eller lunch (ät lunch i W33). Fält: handling, mål. Valfritt: värld (w33, tech eller gym) för kaffe.',
    'Regler: 2 till 4 steg. Sista steget är oftast att prata med personen som gav uppdraget. Belöning: pengar 0 till 15, glädje 0 till 12, relation med personen 4 till 12. Texterna på finlandssvenska, korta, gärna lite humor, passande för alla åldrar. Använd bara id:n från listorna.',
    'Svara med verktyget uppdrag. Skriv ' + num(b.antal || 3, 1, 4) + ' uppdrag från olika personer.',
  ].join('\n');
}
const S = (description) => ({ type: 'string', description });
const QUEST_TOOL = {
  name: 'uppdrag',
  description: 'Nya sidouppdrag för campus.',
  input_schema: {
    type: 'object',
    properties: {
      uppdrag: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            titel: S('Uppdragets namn, högst 6 ord.'),
            person: S('Id på personen som ger uppdraget.'),
            erbjudande: S('Vad personen säger när hen ber om hjälp, 1 till 3 meningar.'),
            steg: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  typ: { type: 'string', enum: ['plats', 'prata', 'gör'] },
                  plats: S('Plats-id för plats-steg.'),
                  person: S('Person-id för prata-steg.'),
                  handling: { type: 'string', enum: HANDLINGAR },
                  värld: { type: 'string', enum: ['w33', 'tech', 'gym'] },
                  mål: S('Vad spelaren ska göra, kort.'),
                  hittar: S('Vad man hittar på platsen.'),
                  knapp: S('Vad spelaren säger.'),
                  svar: S('Vad personen svarar.'),
                  kostar: { type: 'number' },
                  tid: {
                    type: 'object',
                    properties: { från: { type: 'number' }, till: { type: 'number' } },
                  },
                  dagar: { type: 'array', items: { type: 'string', enum: DAGAR } },
                },
                required: ['typ', 'mål'],
              },
            },
            belöning: {
              type: 'object',
              properties: {
                pengar: { type: 'number' },
                glädje: { type: 'number' },
                relation: { type: 'number', description: 'Relation med personen som gav uppdraget.' },
              },
            },
            avslut: S('En mening om hur det slutar.'),
          },
          required: ['titel', 'person', 'erbjudande', 'steg', 'avslut'],
        },
      },
    },
    required: ['uppdrag'],
  },
};
// Gör om ett steg till spelets format, eller null om det inte går att använda.
function cleanStep(s, people, places) {
  const mål = str(s?.mål, 120);
  if (!mål) return null;
  if (s.typ === 'plats') {
    if (!places.has(s.plats)) return null;
    const out = { typ: 'plats', plats: s.plats, mål, hittar: str(s.hittar, 300) || 'Klart!' };
    const från = num(s.tid?.från, 0, 24),
      till = num(s.tid?.till, 0, 24);
    if (s.tid && till > från && från >= 6) out.tid = { från, till };
    const dagar = (Array.isArray(s.dagar) ? s.dagar : []).filter((d) => DAGAR.includes(d));
    if (dagar.length && dagar.length < 7) out.dagar = [...new Set(dagar)];
    return out;
  }
  if (s.typ === 'prata') {
    if (!people.has(s.person)) return null;
    const out = {
      typ: 'prata',
      person: s.person,
      mål,
      knapp: str(s.knapp, 80) || 'Klart!',
      svar: str(s.svar, 300) || 'Tack!',
    };
    const kostar = num(s.kostar, 0, 5);
    if (kostar) out.kostar = kostar;
    return out;
  }
  if (s.typ === 'gör' && HANDLINGAR.includes(s.handling)) {
    const out = { typ: 'gör', handling: s.handling, mål };
    if (s.handling === 'kaffe' && ['w33', 'tech', 'gym'].includes(s.värld)) out.värld = s.värld;
    return out;
  }
  return null;
}
function cleanQuests(out, b, day = dayKey()) {
  const { people: pl, places: pa } = ctx(b),
    people = new Set(pl.map((p) => p.id)),
    places = new Set(pa.map((p) => p.id)),
    used = new Set();
  const list = [];
  for (const q of Array.isArray(out?.uppdrag) ? out.uppdrag : []) {
    if (!people.has(q?.person) || used.has(q.person)) continue;
    const steg = (Array.isArray(q.steg) ? q.steg : [])
      .map((s) => cleanStep(s, people, places))
      .filter(Boolean)
      .slice(0, 4);
    const titel = str(q.titel, 60),
      erbjudande = str(q.erbjudande, 400);
    if (steg.length < 1 || !titel || !erbjudande) continue;
    used.add(q.person);
    const b2 = q.belöning || {};
    list.push({
      id: 'ai-' + day + '-' + list.length,
      ai: true,
      titel,
      person: q.person,
      erbjudande,
      steg,
      belöning: {
        pengar: num(b2.pengar, 0, 15),
        glädje: num(b2.glädje, 0, 12),
        relation: { [q.person]: num(b2.relation || 6, 2, 12) },
      },
      avslut: str(q.avslut, 200) || 'Tack för hjälpen!',
    });
    if (list.length >= 4) break;
  }
  return list;
}
module.exports = { dayKey, buildQuestPrompt, QUEST_TOOL, cleanQuests, VÄRLDAR };

// Sparfilens version och uppgradering. Används av spelet och av testerna.
//
// Så här lägger man till en ändring i sparfilen:
//   1. Höj SAVE_VERSION med ett.
//   2. Lägg till ett steg i MIGRATIONS med samma nummer som den gamla versionen.
//      Steget får en sparning i den gamla formen och gör om den till den nya.
//   3. Skriv ett test i tests/savefile.test.js med en sparning i den gamla formen.
// Ta aldrig bort gamla steg: en sparning från version 1 går igenom alla steg i tur och ordning.
'use strict';
const SAVE_VERSION = 2;

const MIGRATIONS = {
  // 1 → 2: kartan över campus byttes. Den som stod ute börjar vid hemmets dörr,
  // eftersom de gamla koordinaterna pekar på fel ställe i den nya kartan.
  1(s) {
    if (s.mapRevision !== 3 && s.world !== 'home') {
      s.world = 'home';
      s.respawn = true;
    }
    delete s.mapRevision;
  },
};

const num = (v, lo, hi, def) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// Gör om en sparning till den nuvarande versionen och lagar det som går att laga.
// known = { characters: [id], people: [id], outfits: [id], worlds: [id], defaults: {...} }
// Ger { save, from, fixed } där fixed är en lista med det som lagades.
// Kastar bara när sparningen inte går att använda alls.
function upgradeSave(raw, known) {
  if (!isObj(raw)) throw Object.assign(Error('Det här är ingen sparfil.'), { code: 'invalid' });
  const s = JSON.parse(JSON.stringify(raw));
  const from = Number.isInteger(s.version) && s.version >= 1 ? s.version : 1;
  if (from > SAVE_VERSION)
    throw Object.assign(
      Error('Sparningen är från en nyare version av spelet. Ladda om sidan för att få den.'),
      { code: 'newer' },
    );
  if (!known.characters.includes(s.character))
    throw Object.assign(Error('Okänd karaktär i sparfilen.'), { code: 'invalid' });
  for (let v = from; v < SAVE_VERSION; v++) MIGRATIONS[v]?.(s);
  s.version = SAVE_VERSION;
  const fixed = [];
  const fix = (what) => fixed.push(what);
  const d = known.defaults || {};

  // Tal som måste finnas.
  const nums = {
    term: [1, 8, 1],
    day: [1, 1e6, 1],
    hour: [0, 23.99, 8],
    money: [0, 1e7, d.money ?? 0],
    runs: [0, 1e6, 0],
    lunches: [0, 1e6, 0],
  };
  for (const [k, [lo, hi, def]] of Object.entries(nums)) {
    const v = num(s[k], lo, hi, def);
    if (v !== s[k]) fix(k);
    s[k] = k === 'term' || k === 'day' ? Math.round(v) : v;
  }
  if (!isObj(s.stats)) (s.stats = {}), fix('stats');
  for (const k of ['hunger', 'happy', 'energy']) {
    const v = num(s.stats[k], 0, 100, 70);
    if (v !== s.stats[k]) fix('stats.' + k);
    s.stats[k] = v;
  }

  // Kurser: alltid tre.
  if (!Array.isArray(s.courses)) (s.courses = []), fix('courses');
  if (s.courses.length !== 3) fix('courses');
  s.courses = [0, 1, 2].map((i) => {
    const c = isObj(s.courses[i]) ? s.courses[i] : {};
    return {
      ...c,
      study: Math.round(num(c.study, 0, 2, 0)),
      pass: c.pass === true,
      lectures: num(c.lectures, 0, 1e4, 0),
    };
  });

  // Kläder som inte finns längre tas bort.
  const owned = (Array.isArray(s.owned) ? s.owned : []).filter((o) => known.outfits.includes(o));
  if (!owned.length) owned.push(known.outfits[0]);
  if (owned.length !== (s.owned || []).length) fix('owned');
  s.owned = [...new Set(owned)];
  if (!s.owned.includes(s.outfit)) (s.outfit = s.owned[0]), fix('outfit');

  // Plats.
  if (!known.worlds.includes(s.world)) (s.world = 'home'), (s.respawn = true), fix('world');
  for (const k of ['x', 'y', 'a'])
    if (!Number.isFinite(s[k])) (s[k] = 0), (s.respawn = true), fix(k);

  // Personer som inte finns längre glöms bort.
  for (const k of ['relations', 'histories', 'socialDay']) {
    if (!isObj(s[k])) (s[k] = {}), fix(k);
    for (const id of Object.keys(s[k]))
      if (!known.people.includes(id)) delete s[k][id], fix(k + '.' + id);
  }
  for (const [id, v] of Object.entries(s.relations))
    if (!Number.isFinite(v)) delete s.relations[id], fix('relations.' + id);
    else s.relations[id] = num(v, -100, 100, 0);
  for (const [id, a] of Object.entries(s.histories)) {
    const ok = (Array.isArray(a) ? a : []).filter(
      (h) => isObj(h) && typeof h.text === 'string' && ['npc', 'you'].includes(h.who),
    );
    s.histories[id] = ok.slice(-16).map((h) => ({ ...h, text: h.text.slice(0, 500) }));
  }
  for (const [id, v] of Object.entries(s.socialDay))
    if (!Number.isFinite(v) || v < 0) delete s.socialDay[id];
  if (isObj(s.memories))
    for (const id of Object.keys(s.memories))
      if (!known.people.includes(id) || !Array.isArray(s.memories[id])) delete s.memories[id];

  if (typeof s.graduated !== 'boolean') (s.graduated = !!s.graduated), fix('graduated');
  return { save: s, from, fixed };
}

if (typeof module !== 'undefined') module.exports = { SAVE_VERSION, MIGRATIONS, upgradeSave };

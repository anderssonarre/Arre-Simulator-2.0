// Personlighetsdrag: varje person får två slumpade drag (js/data/traits.js) som styr vad hen
// gör, hur hen mår, hur fort man blir vän och hur hen pratar. Online kommer slumpfröet från
// servern så att alla ser samma personligheter, offline får varje nytt liv ett eget frö.
'use strict';
// Grundtoner som inte går ihop med vissa drag.
const TRAIT_CLASH = {
  shy: ['pratsam', 'festprisse'],
  cold: ['pratsam', 'skamtare', 'generos'],
  social: ['introvert'],
  friendly: ['grinig'],
};
let traitCache = { seed: null, map: {} };
function traitSeed() {
  if (Number.isFinite(serverInfo?.seed)) return serverInfo.seed;
  if (!state) return 1;
  if (!Number.isInteger(state.traitSeed)) state.traitSeed = 1 + Math.floor(Math.random() * 1e6);
  return state.traitSeed;
}
// De två dragen för en person, alltid samma för samma frö.
function traitsOf(id) {
  const seed = traitSeed();
  if (traitCache.seed !== seed) traitCache = { seed, map: {} };
  if (traitCache.map[id]) return traitCache.map[id];
  const p = [...characters, ...extra].find((c) => c.id === id),
    r = seeded(seed * 7919 + hashId(id) * 104729),
    keys = Object.keys(DRAG).sort(() => r() - 0.5),
    clash = TRAIT_CLASH[p?.personality] || [],
    picked = [];
  for (const k of keys) {
    if (picked.length >= 2) break;
    if (clash.includes(k)) continue;
    if (picked.some((o) => DRAG[o].motsats === k || DRAG[k].motsats === o)) continue;
    picked.push(k);
  }
  return (traitCache.map[id] = picked);
}
const traitDefs = (id) => traitsOf(id).map((k) => DRAG[k]);
const hasTrait = (id, k) => traitsOf(id).includes(k);
function traitMood(id) {
  return traitDefs(id).reduce((a, d) => a + (d.humör || 0), 0);
}
function traitFriendship(id) {
  return traitDefs(id).reduce((a, d) => a * (d.vänskap || 1), 1);
}
function traitGossip(id) {
  return traitDefs(id).reduce((a, d) => a * (d.skvaller || 1), 1);
}
function traitTalk(id) {
  return traitDefs(id).reduce((a, d) => a * (d.pratsam || 1), 1);
}
const traitParty = (id) => traitDefs(id).some((d) => d.fest);
// En egen rutin från dragen, om någon gäller just nu (används av planFor i people.js).
function traitPlan(id, day, hour) {
  for (const d of traitDefs(id))
    for (const [spec, from, to, where, activity] of d.schema || [])
      if ((spec === 'alla' || dayMatches(spec, day)) && hour >= from && hour < to)
        return where === 'hemma' ? { where: 'hemma' } : { where, activity };
  return null;
}
// En hälsning från dragen, ibland (annars null).
function traitGreeting(id, chance = 0.4) {
  const lines = traitDefs(id).flatMap((d) => d.hälsningar || []);
  return lines.length && Math.random() < chance ? rand(lines) : null;
}
function traitThought(id, r = Math.random) {
  const lines = traitDefs(id).flatMap((d) => d.tankar || []);
  return lines.length ? lines[Math.floor(r() * lines.length)] : null;
}
// Hur personen är, för AI-samtalen.
function traitAiText(id) {
  return traitDefs(id)
    .map((d) => d.namn.toLowerCase() + ' (' + (d.om || '') + ')')
    .join('; ');
}
// Dragen du har upptäckt: ett när ni har pratat, båda när ni är bekanta.
function revealedTraits(p) {
  const met = (state.histories[p.id] || []).length > 0,
    r = relation(p),
    n = !met ? 0 : r >= 15 ? 2 : 1;
  return traitDefs(p.id)
    .slice(0, n)
    .map((d) => d.namn);
}
// En generös person (eller kaffeälskare) bjuder dig ibland på något.
function traitGift(p) {
  const d = traitDefs(p.id).find((x) => x.ger);
  if (!d || relation(p) < 15 || !VAROR[d.ger]) return null;
  state.giftDay ??= {};
  if (state.giftDay[p.id] === state.day || Math.random() > 0.35) return null;
  if (bagCount() >= VÄSKA.platser) return null;
  state.giftDay[p.id] = state.day;
  const b = ensureBag();
  b[d.ger] = (b[d.ger] || 0) + 1;
  toast(firstName(p.id) + ' gav dig ' + VAROR[d.ger].ikon + ' ' + VAROR[d.ger].namn.toLowerCase() + '.');
  return 'Här, ta en ' + VAROR[d.ger].namn.toLowerCase() + '. Jag har extra.';
}
// Kollar datafilen när spelet startar.
for (const [k, d] of Object.entries(DRAG)) {
  if (d.motsats && !DRAG[d.motsats]) console.warn('Drag ' + k + ': okänd motsats ' + d.motsats);
  if (d.ger && !VAROR[d.ger]) console.warn('Drag ' + k + ': okänd vara ' + d.ger);
}

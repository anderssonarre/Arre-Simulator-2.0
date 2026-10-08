// Motorn för händelser: läser EVENT_DATA (js/data/events.js) och tolkar effekter och villkor.
'use strict';
const EFFECT_KEYS = [
  'pengar',
  'glädje',
  'energi',
  'mättnad',
  'tid',
  'relation',
  'studiepass',
  'flagga',
  'meddelande',
];
const CONDITION_KEYS = ['kursEjKlar', 'pengarMinst', 'relationMinst'];
const EVENT_KEYS = [
  'id',
  'titel',
  'text',
  'person',
  'frånTermin',
  'upprepas',
  'dagar',
  'villkor',
  'val',
];
const allPeople = () => [...characters, ...extra];

// Kollar innehållsfilen när spelet laddas och skriver tydliga varningar i konsolen vid stavfel.
function checkContent() {
  const ids = new Set(),
    warn = (e, msg) => console.warn('Händelse "' + (e.id || '?') + '": ' + msg);
  for (const e of EVENT_DATA) {
    if (!e.id) warn(e, 'saknar id');
    if (ids.has(e.id)) warn(e, 'id finns redan');
    ids.add(e.id);
    for (const k of Object.keys(e)) if (!EVENT_KEYS.includes(k)) warn(e, 'okänt fält "' + k + '"');
    if (e.person && !allPeople().some((p) => p.id === e.person))
      warn(e, 'okänd person "' + e.person + '"');
    for (const d of e.dagar || []) if (!WEEKDAYS.includes(d)) warn(e, 'okänd dag "' + d + '"');
    if (!Array.isArray(e.val) || !e.val.length) warn(e, 'behöver minst ett val');
    for (const v of e.val || []) {
      for (const k of Object.keys(v.effekt || {}))
        if (!EFFECT_KEYS.includes(k)) warn(e, 'okänd effekt "' + k + '"');
      for (const k of Object.keys(v.kräver || {}))
        if (!CONDITION_KEYS.includes(k)) warn(e, 'okänt krav "' + k + '"');
      for (const id of Object.keys(v.effekt?.relation || {}))
        if (!allPeople().some((p) => p.id === id)) warn(e, 'okänd person "' + id + '" i relation');
    }
    for (const k of Object.keys(e.villkor || {}))
      if (!CONDITION_KEYS.includes(k)) warn(e, 'okänt villkor "' + k + '"');
  }
}
// Ersätter {kurs0}, {kurs1}, {kurs2} och {jag} i texter.
function fillText(text) {
  return String(text)
    .replace(/\{kurs([0-2])\}/g, (_, i) => course(+i).name)
    .replace(/\{jag\}/g, playerName());
}
function conditionsMet(c = {}) {
  if (c.kursEjKlar != null) {
    const k = state.courses[c.kursEjKlar];
    if (!k || k.pass || k.study >= 2 || k.retake) return false;
  }
  if (c.pengarMinst != null && state.money < c.pengarMinst) return false;
  for (const [id, n] of Object.entries(c.relationMinst || {}))
    if ((state.relations[id] || 0) < n) return false;
  return true;
}
function applyEffect(e = {}) {
  if (e.pengar) state.money = Math.max(0, state.money + e.pengar);
  if (e.glädje) gain('happy', e.glädje);
  if (e.energi) gain('energy', e.energi);
  if (e.mättnad) gain('hunger', e.mättnad);
  if (e.tid) advance(e.tid);
  for (const [id, n] of Object.entries(e.relation || {})) bump(id, n);
  if (e.studiepass) {
    const k = state.courses[e.studiepass.kurs];
    if (k && !k.pass) {
      k.study = Math.min(2, k.study + (e.studiepass.antal || 1));
      delete k.retake;
    }
  }
  if (e.flagga === 'lunchkampanj') state.cheapLunchDay = state.day;
  if (e.flagga === 'dubbelLön') state.doubleJobDay = state.day;
  if (e.meddelande) setTimeout(() => toast(fillText(e.meddelande)), 300);
}
// Visar en slumpad händelse som passar just nu. chance styr hur ofta något händer.
function morningEvent(chance = 0.5) {
  if (Math.random() > chance) return;
  state.seenEvents ??= [];
  const today = weekday(state.day),
    list = EVENT_DATA.filter(
      (e) =>
        (e.upprepas || !state.seenEvents.includes(e.id)) &&
        (e.frånTermin || 1) <= state.term &&
        e.person !== state.character &&
        (!e.dagar || e.dagar.includes(today)) &&
        conditionsMet(e.villkor),
    );
  if (!list.length) return;
  const e = rand(list);
  if (!e.upprepas) state.seenEvents.push(e.id);
  save();
  dialog(
    fillText(e.titel),
    '<p>' + esc(fillText(e.text)) + '</p>',
    e.val.map((c, n) => ({
      label: fillText(c.text),
      primary: n === 0,
      disabled: c.kräver && !conditionsMet(c.kräver),
      run: () => {
        applyEffect(c.effekt);
        close();
        updateHUD();
        save();
      },
    })),
    'Händelse',
  );
}
checkContent();

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
  'färdighet',
  'följs',
  'betalaSkuld',
  'rykte',
];
const CONDITION_KEYS = [
  'kursEjKlar',
  'pengarMinst',
  'pengarHögst',
  'skuldMinst',
  'relationMinst',
  'färdighetMinst',
  'snittMinst',
  'tentaRedo',
];
const TAGS = ['vardag', 'chans', 'kris', 'följd', 'social', 'studier'];
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
  'taggar',
  'vikt',
  'uppföljning',
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
    for (const t of e.taggar || []) if (!TAGS.includes(t)) warn(e, 'okänd tagg "' + t + '"');
    for (const v of e.val || []) {
      for (const k of Object.keys(v.effekt || {}))
        if (!EFFECT_KEYS.includes(k)) warn(e, 'okänd effekt "' + k + '"');
      for (const k of Object.keys(v.kräver || {}))
        if (!CONDITION_KEYS.includes(k)) warn(e, 'okänt krav "' + k + '"');
      for (const id of Object.keys(v.effekt?.relation || {}))
        if (!allPeople().some((p) => p.id === id)) warn(e, 'okänd person "' + id + '" i relation');
      for (const k of Object.keys(v.effekt?.färdighet || {}))
        if (!SKILLS[k]) warn(e, 'okänd färdighet "' + k + '"');
      const f = v.effekt?.följs;
      if (f && !EVENT_DATA.some((x) => x.id === f.id))
        warn(e, 'följs av okänd händelse "' + f.id + '"');
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
  if (c.pengarHögst != null && state.money > c.pengarHögst) return false;
  if (c.skuldMinst != null && (state.debt || 0) < c.skuldMinst) return false;
  if (c.snittMinst != null && (!state.transcript?.length || gradeAverage() < c.snittMinst))
    return false;
  if (c.tentaRedo && !state.courses.some((k) => !k.pass && k.study >= 2 && !k.retake)) return false;
  for (const [k, n] of Object.entries(c.färdighetMinst || {})) if (skillLevel(k) < n) return false;
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
  for (const [k, n] of Object.entries(e.färdighet || {})) addXp(k, n);
  if (e.betalaSkuld) payDebt();
  if (e.rykte) addRumor(e.rykte.typ, {}, e.rykte.vet || []);
  if (e.följs) state.storyQueue.push({ id: e.följs.id, day: state.day + (e.följs.omDagar || 1) });
  if (e.meddelande) setTimeout(() => toast(fillText(e.meddelande)), 300);
}
// Berättaren väljer en händelse som passar läget. Uppföljningar i en kedja går först.
// chance styr hur ofta något händer en vanlig dag.
function morningEvent(chance = 0.5) {
  state.seenEvents ??= [];
  let e = dueChainEvent();
  if (!e) {
    if (Math.random() > chance) return;
    const today = weekday(state.day),
      list = EVENT_DATA.filter(
        (x) =>
          !x.uppföljning &&
          (x.upprepas || !state.seenEvents.includes(x.id)) &&
          (x.frånTermin || 1) <= state.term &&
          x.person !== state.character &&
          (!x.dagar || x.dagar.includes(today)) &&
          conditionsMet(x.villkor),
      );
    if (!list.length) return;
    const mood = storyMood();
    e = weightedPick(list, (x) => storyWeight(x, mood));
  }
  if (!e.upprepas) state.seenEvents.push(e.id);
  if (e.taggar?.includes('kris')) state.lastCrisisDay = state.day;
  showEvent(e);
}
function showEvent(e) {
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
// Kollas när allt har laddats, eftersom färdigheterna ligger i en senare fil.
addEventListener('load', checkContent);

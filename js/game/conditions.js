// Tillstånd: berusning, illamående och koncentration. De går upp av det man äter och dricker
// och avtar med speltiden, även när man sover eller klockan spolas fram. Siffrorna finns i
// TILLSTÅND i js/data/items.js. Läget sparas i state.cond.
'use strict';
function ensureCond() {
  const c = (state.cond ??= {});
  for (const k of ['berusning', 'illamående']) c[k] = clamp(Number(c[k]) || 0, 0, 100);
  c.koncentration = clamp(Number(c.koncentration ?? TILLSTÅND.koncentration.normal) || 0, 0, 100);
  c.peak = Number(c.peak) || 0;
  return c;
}
function cond(k) {
  return state?.cond ? state.cond[k] || 0 : k === 'koncentration' ? TILLSTÅND.koncentration.normal : 0;
}
// Ändrar tillstånden, t.ex. { berusning: 20, koncentration: -12 }.
function changeCond(delta = {}) {
  const c = ensureCond();
  for (const [k, n] of Object.entries(delta)) if (k in TILLSTÅND) c[k] = clamp(c[k] + n, 0, 100);
  c.peak = Math.max(c.peak, c.berusning);
  updateConditionsHUD();
}
// Namnet på det läge ett tillstånd är i just nu, eller null.
function condLevel(k) {
  const v = cond(k);
  let found = null;
  for (const g of TILLSTÅND[k].gränser)
    if ((g.från == null || v >= g.från) && (g.till == null || v <= g.till)) found = g;
  return found;
}
const isDrunk = () => cond('berusning') >= 45;
const isNauseous = () => cond('illamående') >= 35;

// ---- Tiden går ----
// Körs varje bildruta. Räknar på speltiden, så allt avtar även under sömn och när tiden spolas.
let condClock = null;
function conditionsTick() {
  if (!state) return;
  const c = ensureCond(),
    now = state.day * 1440 + state.hour * 60;
  if (condClock === null || now < condClock || now - condClock > 24 * 60) {
    condClock = now;
    return;
  }
  const hours = (now - condClock) / 60;
  if (hours < 1 / 60) return;
  condClock = now;
  const B = TILLSTÅND.berusning,
    I = TILLSTÅND.illamående,
    K = TILLSTÅND.koncentration;
  const wasDrunk = c.berusning;
  // Väldigt full: man börjar må illa.
  if (c.berusning > I.avBerusningÖver) c.illamående = clamp(c.illamående + hours * 20, 0, 100);
  c.berusning = Math.max(0, c.berusning - B.avtar * hours);
  c.illamående = Math.max(0, c.illamående - I.avtar * hours);
  c.koncentration += clamp(K.normal - c.koncentration, -K.glider * hours, K.glider * hours);
  // Ruset har gått över efter en blöt kväll: bakfylla.
  if (wasDrunk > 0 && c.berusning === 0 && c.peak >= B.bakfyllaFrån) {
    c.peak = 0;
    c.illamående = clamp(c.illamående + B.bakfylla, 0, 100);
    c.koncentration = Math.min(c.koncentration, 25);
    toast('Bakfylla. Huvudet bultar och magen protesterar. Vatten hjälper.');
  }
  if (c.berusning === 0) c.peak = 0;
  // Illamående tar på humöret och orken.
  if (c.illamående >= 35) {
    gain('happy', -hours * 3);
    gain('energy', -hours * (c.illamående >= 70 ? 4 : 1.5));
  }
  // Så full att man däckar.
  if (c.berusning >= B.däckarVid && !modal && !job) passOutDrunk();
  updateConditionsHUD();
}
function passOutDrunk() {
  const c = ensureCond();
  c.berusning = 30;
  c.illamående = 60;
  c.peak = Math.max(c.peak, 60);
  changeWorld('home');
  if (!sharedClock()) {
    if (state.hour >= 8) state.day++;
    state.hour = 9;
  }
  condClock = null;
  const lost = Math.min(state.money, 5);
  state.money -= lost;
  gain('happy', -12);
  addRumor('däckade', {}, witnessesHere());
  save();
  dialog(
    'Du däckade',
    '<p>Det blev för många. Du minns inte riktigt hur du kom hem, men en kompis måste ha hjälpt dig.</p><div class="info">−12 glädje' +
      (lost ? ' · ' + lost + ' € försvann ur fickan' : '') +
      ' · du mår illa och har bakfylla</div><p>Vatten mellan ölen gör stor skillnad.</p>',
    [{ label: 'Aj', primary: true, run: close }],
    'Kvällen',
  );
  sound('bad');
}
// En hel natts sömn ger god koncentration (anropas när man vaknar utvilad).
function restedConcentration() {
  const c = ensureCond();
  c.koncentration = Math.max(c.koncentration, TILLSTÅND.koncentration.efterSömn - c.illamående / 3);
  updateConditionsHUD();
}

// ---- Vad tillstånden gör ----
// Ett skäl att inte kunna plugga eller skriva tenta, eller null (används av focusProblem).
function conditionProblem() {
  if (!state?.cond) return null;
  if (isDrunk()) return 'full';
  if (cond('illamående') >= 50) return 'illamående';
  if (cond('koncentration') <= 25) return 'ofokuserad';
  return null;
}
// Fokuserad ger ett betyg högre på tentan (se examGrade i progress.js).
function focusedForExam() {
  return cond('koncentration') >= 70 && !isDrunk();
}
// Berusad går man inte rakt (används av walk i movement.js).
function drunkSway(dt) {
  const b = cond('berusning');
  if (b < 45) return 0;
  const k = (b - 40) / 60;
  return Math.sin(performance.now() / 700) * k * 0.9 * dt;
}
// Kamerans lutning när man är full (3D).
function drunkRoll() {
  const b = cond('berusning');
  return b < 45 ? 0 : Math.sin(performance.now() / 1100) * ((b - 40) / 60) * 0.06;
}
// Hur andra ser dig, för AI-samtalen.
function playerStateText() {
  const parts = [];
  const b = condLevel('berusning'),
    i = condLevel('illamående');
  if (b) parts.push(b.namn.toLowerCase());
  if (i) parts.push('mår illa');
  return parts.join(', ');
}

// ---- Statusfältet ----
function updateConditionsHUD() {
  const el = $('conditions');
  if (!el || !state) return;
  const chips = ['berusning', 'illamående', 'koncentration']
    .map((k) => condLevel(k))
    .filter(Boolean)
    .map((g) => '<span class="cond">' + g.ikon + ' ' + esc(g.namn) + '</span>');
  const html = chips.join('');
  if (el.innerHTML !== html) el.innerHTML = html;
  el.hidden = !chips.length;
}

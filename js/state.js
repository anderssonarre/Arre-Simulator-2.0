// Speltillstånd, ljud, sparning och dialogrutor
'use strict';
let state = null,
  selected = 'arvid',
  active = false,
  modal = false,
  paused = false,
  world = null,
  near = null,
  job = null,
  party = false,
  sleeping = null,
  saveTimer = 0,
  hudTimer = 0,
  noticeTimer = 0,
  toastTimer = 0,
  muted = false,
  audio = null;
const keys = new Set(),
  touch = { x: 0, y: 0, run: false },
  view = $('view'),
  ctx = view.getContext('2d', { alpha: false }),
  mapCtx = $('minimap').getContext('2d');
let highDetail = !matchMedia('(pointer:coarse)').matches;
let W = 640,
  H = 360,
  horizon = 180,
  zbuffer = new Float32Array(W),
  wallTops = new Float32Array(W),
  last = 0,
  pitch = 0,
  frame = 0;
const player = { x: 46.5, y: 22, a: -0.7 };
const worlds = {};
const cache = {};
function fresh(id) {
  return {
    version: VERSION,
    character: id,
    term: 1,
    day: 1,
    hour: 8,
    money: ECONOMY.startpengar,
    stats: { hunger: 80, happy: 80, energy: 100 },
    courses: [
      { study: 0, pass: false, lectures: 0 },
      { study: 0, pass: false, lectures: 0 },
      { study: 0, pass: false, lectures: 0 },
    ],
    owned: ['casual'],
    outfit: 'casual',
    relations: {},
    histories: {},
    socialDay: {},
    runs: 0,
    lunches: 0,
    graduated: false,
    tutorial: [],
    world: 'home',
    x: 5.5,
    y: 8,
    a: -Math.PI / 2,
  };
}
function profile() {
  return characters.find((c) => c.id === (state?.character || selected));
}
function sound(kind = 'tap') {
  if (muted) return;
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const o = audio.createOscillator(),
      g = audio.createGain(),
      t = audio.currentTime;
    o.type = 'sine';
    o.frequency.setValueAtTime(kind === 'win' ? 660 : kind === 'bad' ? 170 : 390, t);
    o.frequency.exponentialRampToValueAtTime(
      kind === 'win' ? 1100 : kind === 'bad' ? 100 : 500,
      t + 0.13,
    );
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.035, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g);
    g.connect(audio.destination);
    o.start(t);
    o.stop(t + 0.2);
  } catch {}
}
function toast(text) {
  $('toast').textContent = text;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3800);
}
function gain(key, n) {
  state.stats[key] = clamp(state.stats[key] + n, 0, 100);
  updateHUD();
}
function safeStorage() {
  try {
    return localStorage.getItem(SAVE);
  } catch {
    return null;
  }
}
function save() {
  if (!state) return false;
  state.mapRevision = 3;
  state.world = job ? 'outdoor' : world.id;
  state.x = job ? jobReturnSpot().x : player.x;
  state.y = job ? jobReturnSpot().y : player.y;
  state.a = player.a;
  state.savedAt = Date.now();
  scheduleCloudSave();
  try {
    localStorage.setItem(SAVE, JSON.stringify(state));
    $('saving').textContent = 'Sparat';
    $('saving').style.opacity = 1;
    setTimeout(() => ($('saving').style.opacity = 0), 1400);
    return true;
  } catch {
    $('saving').textContent = 'Spara via export';
    $('saving').style.opacity = 1;
    return false;
  }
}
function validate(s) {
  if (!s || s.version !== VERSION || !characters.some((c) => c.id === s.character))
    throw Error('Fel version eller karaktär.');
  for (const k of ['term', 'day', 'hour', 'money', 'x', 'y', 'a', 'runs', 'lunches'])
    if (!Number.isFinite(s[k])) throw Error('Sparfilen saknar giltiga värden.');
  if (
    s.term < 1 ||
    s.term > 8 ||
    !Number.isInteger(s.term) ||
    s.day < 1 ||
    !Number.isInteger(s.day) ||
    s.hour < 0 ||
    s.hour >= 24 ||
    s.money < 0 ||
    s.money > 1e7
  )
    throw Error('Ogiltig spelprogression.');
  if (
    !s.stats ||
    !['hunger', 'happy', 'energy'].every(
      (k) => Number.isFinite(s.stats[k]) && s.stats[k] >= 0 && s.stats[k] <= 100,
    )
  )
    throw Error('Ogiltiga behov.');
  if (
    !Array.isArray(s.courses) ||
    s.courses.length !== 3 ||
    !s.courses.every(
      (c) =>
        Number.isInteger(c.study) && c.study >= 0 && c.study <= 2 && typeof c.pass === 'boolean',
    )
  )
    throw Error('Ogiltiga kurser.');
  if (
    !Array.isArray(s.owned) ||
    !s.owned.every((k) => outfits.some((o) => o.id === k)) ||
    !s.owned.includes(s.outfit)
  )
    throw Error('Ogiltiga kläder.');
  if (!['home', 'outdoor', 'w33', 'tech', 'gym'].includes(s.world)) throw Error('Ogiltig plats.');
  for (const k of ['relations', 'histories', 'socialDay']) {
    if (!s[k] || typeof s[k] !== 'object' || Array.isArray(s[k]))
      throw Error('Ogiltiga relationer.');
    if (Object.keys(s[k]).some((v) => ![...characters, ...extra].some((c) => c.id === v)))
      throw Error('Okänd karaktär i sparfil.');
  }
  if (!Object.values(s.relations).every((v) => Number.isFinite(v) && v >= -100 && v <= 100))
    throw Error('Ogiltig relation.');
  if (
    !Object.values(s.histories).every(
      (a) =>
        Array.isArray(a) &&
        a.length <= 16 &&
        a.every(
          (h) =>
            typeof h.text === 'string' && h.text.length <= 500 && ['npc', 'you'].includes(h.who),
        ),
    )
  )
    throw Error('Ogiltig historik.');
  if (!Object.values(s.socialDay).every((v) => Number.isFinite(v) && v >= 0))
    throw Error('Ogiltig dag.');
  if (typeof s.graduated !== 'boolean') throw Error('Ogiltigt examensvärde.');
  return JSON.parse(JSON.stringify(s));
}
function dialog(title, body, buttons = [], tag = 'Campusliv') {
  modal = true;
  keys.clear();
  touch.x = touch.y = 0;
  document.exitPointerLock?.();
  $('dialogTag').textContent = tag;
  $('dialogTitle').textContent = title;
  $('dialogBody').innerHTML = body;
  $('dialogActions').replaceChildren();
  for (const b of buttons) {
    const e = document.createElement('button');
    e.textContent = b.label;
    e.className = b.primary ? 'primary' : '';
    e.disabled = !!b.disabled;
    e.addEventListener('click', () => {
      sound();
      b.run();
    });
    $('dialogActions').append(e);
  }
  $('dialog').hidden = false;
}
function close() {
  if (job?.type === 'challenge') {
    showChallenge();
    return;
  }
  modal = false;
  paused = false;
  $('dialog').hidden = true;
  keys.clear();
  touch.x = touch.y = 0;
}
$('closeButton').onclick = () => {
  if (job?.type === 'challenge') {
    confirmAbort();
    return;
  }
  close();
};
function seeded(n) {
  return () => {
    n = (Math.imul(1664525, n) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}

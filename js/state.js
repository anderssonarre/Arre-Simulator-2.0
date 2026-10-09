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
  state.world = job ? 'outdoor' : world.id;
  state.x = job ? jobReturnSpot().x : player.x;
  state.y = job ? jobReturnSpot().y : player.y;
  state.a = player.a;
  state.savedAt = Date.now();
  scheduleCloudSave();
  scheduleRecord();
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
// Läser en sparning och uppgraderar den till den här versionen av spelet (js/shared/savefile.js).
// Det som inte går att använda längre, t.ex. en person som tagits bort, lagas i stället för
// att hela sparningen kastas. En sparning från en äldre version sparas först som kopia.
function validate(s) {
  const { save: up, from, fixed } = upgradeSave(s, {
    characters: characters.map((c) => c.id),
    people: [...characters, ...extra].map((c) => c.id),
    outfits: outfits.map((o) => o.id),
    worlds: ['home', 'outdoor', 'w33', 'tech', 'gym'],
    defaults: { money: ECONOMY.startpengar },
  });
  if (from < VERSION) backupSave(s, from);
  if (fixed.length) console.info('Sparningen lagades:', fixed.join(', '));
  return up;
}
// Sparar en kopia av sparningen som den såg ut före en uppgradering, en per gammal version.
function backupSave(s, from) {
  try {
    const key = SAVE + '_backup_v' + from;
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(s));
  } catch {}
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

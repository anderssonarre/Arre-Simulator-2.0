// Tangentbord, mus och touch
'use strict';
// Unified input path: typing never moves the player and held E never repeats actions.
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input,textarea')) return;
  // Stora kartan (js/ui/storkarta.js): M öppnar och stänger, Esc stänger.
  if (BIGMAP.open && (e.code === 'Escape' || e.code === 'KeyM')) {
    e.preventDefault();
    if (!e.repeat) closeBigMap();
    return;
  }
  if (e.code === 'KeyM' && !e.repeat && active && !modal) {
    openBigMap();
    return;
  }
  if (e.code === 'Escape') {
    e.preventDefault();
    if (!active) {
      close();
      return;
    }
    if (modal) {
      if (job?.minigame === 'kubb') kubbEnd(true);
      else if (job?.type === 'challenge') confirmAbort();
      else close();
    } else menu();
    return;
  }
  if (modal) {
    if (e.code === 'Space' && !e.repeat && $('dialogTag').textContent === 'Timingövning') {
      e.preventDefault();
      $('dialogActions').firstElementChild?.click();
    }
    return;
  }
  if (!active) return;
  if ((e.code === 'Enter' || e.code === 'KeyT') && !e.repeat && net.status === 'online') {
    e.preventDefault();
    openChat();
    return;
  }
  if (
    [
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'KeyE',
      'Space',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ShiftLeft',
      'ShiftRight',
    ].includes(e.code)
  )
    e.preventDefault();
  keys.add(e.code);
  if (e.code === 'KeyE' && !e.repeat) interact();
  if (e.code === 'KeyI' && !e.repeat && active && !modal) showBag();
  if (e.code === 'KeyG' && !e.repeat && active && !modal) openGestures();
  if (e.code === 'KeyP' && !e.repeat && active && !modal) openPhone();
  if (e.code === 'KeyF' && !e.repeat && active && !modal) throwSnowball();
});
document.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => {
  keys.clear();
  touch.x = touch.y = 0;
  touch.run = false;
  if (active) save();
});
document.addEventListener('visibilitychange', () => {
  keys.clear();
  touch.x = touch.y = 0;
  last = performance.now();
  if (document.hidden && active) save();
});
window.addEventListener('pagehide', () => {
  if (active) save();
});
view.addEventListener('click', () => {
  if (active && !modal && !document.body.classList.contains('touch')) {
    try {
      const p = view.requestPointerLock?.();
      p?.catch?.(() => {});
    } catch {}
  }
});
// Mus: 0,0025 radianer per pixel vid normal känslighet. Samma skala åt båda håll.
const MOUSE_RAD = 0.0025;
document.addEventListener('mousemove', (e) => {
  if (!active || modal || document.pointerLockElement !== view) return;
  // Vissa webbläsare skickar enstaka jättehopp när musen låses. Ignorera dem.
  if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
  turnView(e.movementX * MOUSE_RAD * controls.sens, e.movementY * MOUSE_RAD * controls.sens);
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === view) mouseDrag = null;
  updatePointerHint();
});
// Om musen inte går att låsa (t.ex. i en inbäddad vy) kan man dra med musen för att titta.
let mouseDrag = null;
view.addEventListener('mousedown', (e) => {
  if (!active || modal || document.pointerLockElement === view) return;
  mouseDrag = { x: e.clientX, y: e.clientY };
});
document.addEventListener('mousemove', (e) => {
  if (!mouseDrag || modal || document.pointerLockElement === view) return;
  turnView(
    (e.clientX - mouseDrag.x) * MOUSE_RAD * controls.sens,
    (e.clientY - mouseDrag.y) * MOUSE_RAD * controls.sens,
  );
  mouseDrag.x = e.clientX;
  mouseDrag.y = e.clientY;
});
document.addEventListener('mouseup', () => (mouseDrag = null));
function updatePointerHint() {
  const show =
    active &&
    !modal &&
    !document.body.classList.contains('touch') &&
    document.pointerLockElement !== view;
  document.body.classList.toggle('unlocked', show);
}
const touchMode = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
if (touchMode) {
  document.body.classList.add('touch');
  $('controlHelp').textContent =
    'Vänster tumme: gå, styrspaken hamnar där du trycker · dra till höger: se dig omkring · tryck i bilden eller E: interagera · Spring: håll inne';
}
// Fångar pekaren så att rörelsen följer med även utanför elementet. Kan misslyckas om pekaren
// redan har släppts, och då gör det inget.
function capture(el, id) {
  try {
    el.setPointerCapture(id);
  } catch {}
}
let look = null;
// Pekskärm: tummen på vänstra delen av skärmen blir en styrspak där den landar,
// tummen på högra delen vrider blicken. Ett kort tryck i bilden är som E.
view.addEventListener('pointerdown', (e) => {
  if (!active || modal || e.pointerType === 'mouse') return;
  document.body.classList.add('touch');
  capture(view, e.pointerId);
  if (e.clientX < innerWidth * 0.42 && stickId === null) {
    floatStick(e);
    return;
  }
  look = {
    id: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    x0: e.clientX,
    y0: e.clientY,
    t: performance.now(),
  };
});
// Touch: att dra över hela skärmens bredd vrider ungefär 180° vid normal känslighet.
view.addEventListener('pointermove', (e) => {
  if (stickId === e.pointerId) return stickMove(e);
  if (!look || look.id !== e.pointerId || modal) return;
  const k = (Math.PI / Math.max(320, view.clientWidth)) * controls.sens;
  turnView((e.clientX - look.x) * k, (e.clientY - look.y) * k);
  look.x = e.clientX;
  look.y = e.clientY;
});
view.addEventListener('pointerup', (e) => {
  if (stickId === e.pointerId) return resetStick();
  // Ett kort tryck utan att dra: gör det som E gör, om det finns något nära.
  if (
    look?.id === e.pointerId &&
    performance.now() - look.t < 300 &&
    Math.hypot(e.clientX - look.x0, e.clientY - look.y0) < 12 &&
    near &&
    !modal
  )
    interact();
  look = null;
});
for (const event of ['pointercancel', 'lostpointercapture'])
  view.addEventListener(event, (e) => {
    if (stickId === e.pointerId) resetStick();
    if (look?.id === e.pointerId) look = null;
  });
let stickId = null;
// Flyttar styrspaken dit tummen landade.
function floatStick(e) {
  const s = $('stick'),
    r = s.getBoundingClientRect();
  s.classList.add('floating');
  s.style.left = e.clientX - r.width / 2 + 'px';
  s.style.top = e.clientY - r.height / 2 + 'px';
  s.style.bottom = 'auto';
  stickId = e.pointerId;
  stickMove(e);
}
$('stick').addEventListener('pointerdown', (e) => {
  if (modal) return;
  stickId = e.pointerId;
  capture($('stick'), stickId);
  stickMove(e);
});
function stickMove(e) {
  if (stickId !== e.pointerId) return;
  const r = $('stick').getBoundingClientRect(),
    dx = e.clientX - r.left - r.width / 2,
    dy = e.clientY - r.top - r.height / 2,
    dist = Math.hypot(dx, dy),
    scale = Math.max(1, dist / 38),
    // Död zon i mitten och mjuk kurva så att små rörelser går att styra exakt.
    amount = clamp((dist / 38 - 0.12) / 0.88, 0, 1),
    strength = dist > 0 ? (amount * amount * (3 - 2 * amount)) / (dist / 38 || 1) : 0;
  touch.x = (dx / 38) * strength;
  touch.y = (dy / 38) * strength;
  $('knob').style.transform = 'translate(' + dx / scale + 'px,' + dy / scale + 'px)';
}
$('stick').addEventListener('pointermove', stickMove);
function resetStick() {
  stickId = null;
  touch.x = touch.y = 0;
  $('knob').style.transform = 'none';
  // Tillbaka till sin vanliga plats, där den visar var man kan styra.
  const s = $('stick');
  s.classList.remove('floating');
  s.style.left = s.style.top = s.style.bottom = '';
}
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'])
  $('stick').addEventListener(ev, resetStick);
$('interactBtn').onclick = interact;
$('runBtn').addEventListener('pointerdown', (e) => {
  touch.run = true;
  capture($('runBtn'), e.pointerId);
});
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'])
  $('runBtn').addEventListener(ev, () => (touch.run = false));

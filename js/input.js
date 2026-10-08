// Tangentbord, mus och touch
'use strict';
// Unified input path: typing never moves the player and held E never repeats actions.
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input,textarea')) return;
  if (e.code === 'Escape') {
    e.preventDefault();
    if (!active) {
      close();
      return;
    }
    if (modal) {
      if (job?.type === 'challenge') confirmAbort();
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
document.addEventListener('mousemove', (e) => {
  if (!active || modal || document.pointerLockElement !== view) return;
  player.a += e.movementX * 0.0028;
  pitch = clamp(pitch + e.movementY * 0.003, -0.7, 0.7);
});
const touchMode = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
if (touchMode) {
  document.body.classList.add('touch');
  $('controlHelp').textContent =
    'Vänster styrspak: gå / gas · dra på skärmen: se dig omkring · E: interagera · Spring: håll inne';
}
let look = null;
view.addEventListener('pointerdown', (e) => {
  if (!active || modal || e.pointerType === 'mouse') return;
  document.body.classList.add('touch');
  look = { id: e.pointerId, x: e.clientX, y: e.clientY };
  view.setPointerCapture(e.pointerId);
});
view.addEventListener('pointermove', (e) => {
  if (!look || look.id !== e.pointerId || modal) return;
  player.a += (e.clientX - look.x) * 0.007;
  pitch = clamp(pitch + (e.clientY - look.y) * 0.005, -0.7, 0.7);
  look.x = e.clientX;
  look.y = e.clientY;
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
  view.addEventListener(event, () => (look = null));
let stickId = null;
$('stick').addEventListener('pointerdown', (e) => {
  if (modal) return;
  stickId = e.pointerId;
  $('stick').setPointerCapture(stickId);
  stickMove(e);
});
function stickMove(e) {
  if (stickId !== e.pointerId) return;
  const r = $('stick').getBoundingClientRect(),
    dx = e.clientX - r.left - r.width / 2,
    dy = e.clientY - r.top - r.height / 2,
    scale = Math.max(1, Math.hypot(dx, dy) / 38);
  touch.x = dx / scale / 38;
  touch.y = dy / scale / 38;
  $('knob').style.transform = 'translate(' + dx / scale + 'px,' + dy / scale + 'px)';
}
$('stick').addEventListener('pointermove', stickMove);
function resetStick() {
  stickId = null;
  touch.x = touch.y = 0;
  $('knob').style.transform = 'none';
}
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'])
  $('stick').addEventListener(ev, resetStick);
$('interactBtn').onclick = interact;
$('runBtn').addEventListener('pointerdown', (e) => {
  touch.run = true;
  $('runBtn').setPointerCapture(e.pointerId);
});
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'])
  $('runBtn').addEventListener(ev, () => (touch.run = false));

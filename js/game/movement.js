// Rörelse och kamera: gång med acceleration, kollision mot väggar, huvudgung och körning.
'use strict';

// ---- Inställningar (sparas separat från spelet så de gäller alla karaktärer) ----
const CONTROLS_KEY = 'arre_simulator_2_controls_v1';
const controls = {
  sens: 1,
  invert: false,
  bob: !matchMedia('(prefers-reduced-motion: reduce)').matches,
  fov: 'normal',
};
try {
  Object.assign(controls, JSON.parse(localStorage.getItem(CONTROLS_KEY) || '{}'));
} catch {}
function saveControls() {
  try {
    localStorage.setItem(CONTROLS_KEY, JSON.stringify(controls));
  } catch {}
}

// ---- Kamerans tillstånd ----
// plane = halva bildbredden i kamerans plan (0,72 ≈ 72° synfält). eye = ögonhöjd i väggenheter.
const camera = { plane: 0.72, eye: 0.58, bob: 0, bobPhase: 0, bobAmount: 0, turnVel: 0 };
const motion = { vx: 0, vy: 0, steer: 0 };
const WALK_SPEED = 2.3,
  RUN_SPEED = 3.9,
  PLAYER_RADIUS = 0.22,
  CAR_RADIUS = 0.3,
  PITCH_LIMIT = 0.9;

function basePlane() {
  return controls.fov === 'wide' ? 0.86 : 0.72;
}
function resetMotion() {
  motion.vx = motion.vy = motion.steer = 0;
  camera.turnVel = camera.bobAmount = camera.bob = 0;
  camera.plane = basePlane();
}
// Vrider och tittar upp/ner. dx/dy är i radianer, positivt dy = titta ner.
function turnView(dx, dy) {
  player.a += dx;
  pitch = clamp(pitch + (controls.invert ? dy : -dy), -PITCH_LIMIT, PITCH_LIMIT);
}
// Närmar a mot b med en hastighet som inte beror på bildfrekvensen.
function approach(a, b, rate, dt) {
  return b + (a - b) * Math.exp(-rate * dt);
}

// ---- Kollision: spelaren är en cirkel som glider längs väggarna ----
// Puttar ut spelaren ur en rektangel x0..x1, y0..y1 om cirkeln överlappar den.
function pushOutOfRect(x0, y0, x1, y1, r) {
  const nx = clamp(player.x, x0, x1),
    ny = clamp(player.y, y0, y1),
    dx = player.x - nx,
    dy = player.y - ny,
    d = Math.hypot(dx, dy);
  if (d >= r) return;
  if (d > 1e-6) {
    player.x = nx + (dx / d) * r;
    player.y = ny + (dy / d) * r;
  } else {
    // Mitt i rektangeln (borde inte hända): putta ut åt närmaste kant.
    const left = player.x - x0,
      right = x1 - player.x,
      up = player.y - y0,
      down = y1 - player.y,
      m = Math.min(left, right, up, down);
    if (m === left) player.x = x0 - r;
    else if (m === right) player.x = x1 + r;
    else if (m === up) player.y = y0 - r;
    else player.y = y1 + r;
  }
}
function pushOut(w, r) {
  for (let pass = 0; pass < 4; pass++) {
    const cx = Math.floor(player.x),
      cy = Math.floor(player.y);
    if (w.segments) segPushOut(w, r);
    else
      for (let y = cy - 1; y <= cy + 1; y++)
        for (let x = cx - 1; x <= cx + 1; x++)
          if (isWall(w, x + 0.5, y + 0.5)) pushOutOfRect(x, y, x + 1, y + 1, r);
    // Möbler är också hinder.
    for (const s of w.solids || []) pushOutOfRect(s.x0, s.y0, s.x1, s.y1, r);
  }
}
// Flyttar spelaren och returnerar hur långt hen faktiskt kom.
function slide(w, dx, dy, r) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (r * 0.5))),
    sx = player.x,
    sy = player.y;
  for (let i = 0; i < steps; i++) {
    player.x += dx / steps;
    player.y += dy / steps;
    pushOut(w, r);
  }
  return Math.hypot(player.x - sx, player.y - sy);
}
// Behålls för kod som anropar move direkt.
function move(dx, dy, r = PLAYER_RADIUS) {
  slide(world, dx, dy, r);
}

// ---- Gång ----
function walk(dt, f, r, sprintHeld) {
  const turnKeys = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
  camera.turnVel = approach(camera.turnVel, turnKeys * 2.4 * controls.sens, 10, dt);
  player.a += camera.turnVel * dt + drunkSway(dt); // full: man går inte rakt

  const len = Math.hypot(f, r),
    nf = len > 1 ? f / len : f,
    nr = len > 1 ? r / len : r,
    canRun = sprintHeld && state.stats.energy > 10 && state.stats.hunger > 5 && nf > 0.2,
    speed = (canRun ? RUN_SPEED : WALK_SPEED) * weatherSpeed(),
    cos = Math.cos(player.a),
    sin = Math.sin(player.a),
    tx = (cos * nf - sin * nr) * speed,
    ty = (sin * nf + cos * nr) * speed,
    rate = len > 0.05 ? 11 : 9;
  motion.vx = approach(motion.vx, tx, rate, dt);
  motion.vy = approach(motion.vy, ty, rate, dt);
  if (Math.hypot(motion.vx, motion.vy) < 0.01 && len < 0.05) motion.vx = motion.vy = 0;

  const moved = slide(world, motion.vx * dt, motion.vy * dt, PLAYER_RADIUS),
    actual = moved / Math.max(dt, 1e-4);
  // Tappa fart mot väggar så att man inte "laddar upp" fart när man går in i dem.
  const wanted = Math.hypot(motion.vx, motion.vy);
  if (wanted > 0.1 && actual < wanted * 0.6) {
    const k = actual / wanted;
    motion.vx *= k;
    motion.vy *= k;
  }
  // Att springa kostar lite extra energi, ungefär 7 per minut.
  if (canRun && len > 0.05) state.stats.energy = Math.max(0, state.stats.energy - dt * 0.12);

  // Huvudgung och lite bredare synfält när man springer.
  const pace = clamp(actual / RUN_SPEED, 0, 1);
  camera.bobAmount = approach(camera.bobAmount, controls.bob ? pace : 0, 8, dt);
  camera.bobPhase += actual * dt * 4.2;
  camera.bob = Math.sin(camera.bobPhase) * camera.bobAmount;
  camera.plane = approach(camera.plane, basePlane() * (canRun && actual > 2.5 ? 1.07 : 1), 6, dt);
}

// ---- Körning (buss, lastbil, truck) ----
function drive(dt, f, r) {
  const max = job.moment === 'truck' ? 2.5 : 5,
    s = job.speed,
    arrows = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
  motion.steer = approach(motion.steer, clamp(r + arrows, -1, 1), 6, dt);
  // Gas framåt, broms när man trycker emot färdriktningen, rullmotstånd annars.
  if (Math.abs(f) > 0.06) {
    const braking = Math.sign(f) !== Math.sign(s) && Math.abs(s) > 0.2;
    job.speed = s + f * dt * (braking ? 7 : 3.2);
  } else job.speed = approach(s, 0, 1.1, dt);
  job.speed = clamp(job.speed, -1.8, max);
  // Styrningen är mjukare i hög fart och byter håll när man backar.
  const grip = clamp(job.speed / 1.6, -1, 1) / (1 + Math.abs(job.speed) * 0.12);
  player.a += motion.steer * dt * 1.7 * grip;
  const dx = Math.cos(player.a) * job.speed * dt,
    dy = Math.sin(player.a) * job.speed * dt,
    want = Math.hypot(dx, dy),
    moved = slide(world, dx, dy, CAR_RADIUS);
  if (want > 0.001 && moved < want * 0.5) {
    const hard = moved < want * 0.15;
    job.speed *= hard ? 0.2 : 0.75;
    if (hard && noticeTimer <= 0) {
      toast('För nära väggen. Backa och styr undan.');
      sound('bad');
      noticeTimer = 3;
    }
  }
  camera.bobAmount = approach(camera.bobAmount, 0, 8, dt);
  camera.bob = 0;
  camera.plane = approach(camera.plane, basePlane() * (1 + Math.abs(job.speed) * 0.012), 4, dt);
}

// ---- Inställningsmeny ----
function showControls() {
  const sensName =
    controls.sens < 0.8
      ? 'Låg'
      : controls.sens > 1.8
        ? 'Mycket hög'
        : controls.sens > 1.2
          ? 'Hög'
          : 'Normal';
  const set = (k, v) => () => {
    controls[k] = v;
    saveControls();
    if (k === 'fov') camera.plane = basePlane();
    showControls();
  };
  const sensSteps = [0.6, 1, 1.5, 2.2],
    next =
      sensSteps[(sensSteps.findIndex((v) => v >= controls.sens - 0.01) + 1) % sensSteps.length];
  dialog(
    'Kontroller',
    '<p>Ändringarna gäller direkt och sparas i den här webbläsaren.</p><div class="info keys">Dator: klicka i bilden för att styra med musen. Esc släpper musen och öppnar menyn.<br>Mobil: vänster spak för att gå, dra på resten av skärmen för att titta.</div>',
    [
      { label: 'Känslighet: ' + sensName + ' · byt', run: set('sens', next) },
      {
        label: 'Titta upp/ner: ' + (controls.invert ? 'Inverterad' : 'Normal') + ' · byt',
        run: set('invert', !controls.invert),
      },
      {
        label: 'Huvudgung: ' + (controls.bob ? 'På' : 'Av') + ' · byt',
        run: set('bob', !controls.bob),
      },
      {
        label: 'Synfält: ' + (controls.fov === 'wide' ? 'Brett' : 'Normalt') + ' · byt',
        run: set('fov', controls.fov === 'wide' ? 'normal' : 'wide'),
      },
      { label: 'Tillbaka till menyn', primary: true, run: menu },
    ],
    'Inställningar',
  );
}

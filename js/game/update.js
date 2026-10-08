// Interaktion, rörelse och uppdatering varje bildruta
'use strict';
function visibleObjects() {
  return world.objects.filter((o) => o.profile?.id !== state?.character);
}
function lineOfSight(o) {
  const d = Math.hypot(o.x - player.x, o.y - player.y);
  for (let t = 0.12; t < d; t += 0.12) {
    if (isWall(world, player.x + ((o.x - player.x) * t) / d, player.y + ((o.y - player.y) * t) / d))
      return false;
  }
  return true;
}
function updateNear() {
  near = null;
  if (!active || modal) return;
  let best = 1.65;
  for (const o of visibleObjects()) {
    if (!o.action) continue;
    const dist = Math.hypot(o.x - player.x, o.y - player.y);
    const dot =
      ((o.x - player.x) * Math.cos(player.a) + (o.y - player.y) * Math.sin(player.a)) /
      Math.max(0.01, dist);
    if (dist < best && dot > -0.05 && lineOfSight(o)) {
      best = dist;
      near = o;
    }
  }
  $('prompt').style.display = near ? 'block' : 'none';
  if (near)
    $('prompt').textContent =
      (document.body.classList.contains('touch') ? 'Tryck E · ' : 'E · ') + near.label;
}
function interact() {
  if (active && !modal && near) near.action();
}
function move(dx, dy, r = 0.18) {
  if (walkable(world, player.x + dx, player.y, r)) player.x += dx;
  if (walkable(world, player.x, player.y + dy, r)) player.y += dy;
}
function update(dt) {
  if (job?.type === 'challenge' && !paused && $('dialogTag').textContent === 'Timingövning') {
    job.phase += dt * (job.gymOnly ? 2.1 : 2.2 + job.stage * 0.35);
    job.elapsed += dt;
    if ($('timingCursor'))
      $('timingCursor').style.left = clamp(((Math.sin(job.phase) + 1) / 2) * 100, 0, 99) + '%';
  }
  if (!active || modal || document.hidden) return;
  const f =
      (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
      (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) -
      touch.y,
    r = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + touch.x;
  const turn = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
  player.a += turn * dt * 1.9;
  if (job?.type === 'drive') {
    const max = job.key === 'vilhelm' ? 2.5 : 5;
    job.speed = clamp(job.speed + f * dt * 3.5, -1.8, max);
    if (Math.abs(f) < 0.06) job.speed *= Math.exp(-dt * 1.4);
    player.a += r * dt * 1.55 * clamp(job.speed / 2, -1, 1);
    const dx = Math.cos(player.a) * job.speed * dt,
      dy = Math.sin(player.a) * job.speed * dt;
    if (walkable(world, player.x + dx, player.y + dy, 0.3)) move(dx, dy, 0.3);
    else {
      job.speed = 0;
      if (noticeTimer <= 0) {
        toast('För nära väggen. Backa och styr undan.');
        noticeTimer = 3;
      }
    }
    $('jobHUD').style.display = 'block';
    $('jobHUD').innerHTML =
      '<div>' +
      esc(job.title) +
      ' · ' +
      (job.stage ? 'Last ombord' : 'Ingen last') +
      '</div><b>' +
      Math.round(Math.abs(job.speed) * 12) +
      ' km/h</b><div class="sub">' +
      (job.stage ? 'Leverera till andra markeringen' : 'Stanna vid första markeringen') +
      '</div>';
  } else {
    const length = Math.max(1, Math.hypot(f, r)),
      sprint =
        (keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.run) &&
        state.stats.energy > 10 &&
        state.stats.hunger > 5,
      speed = sprint ? 3.6 : 2.1;
    move(
      ((Math.cos(player.a) * f - Math.sin(player.a) * r) * speed * dt) / length,
      ((Math.sin(player.a) * f + Math.cos(player.a) * r) * speed * dt) / length,
    );
    if (sprint && (f || r)) state.stats.energy = Math.max(0, state.stats.energy - dt * 0.65);
    $('jobHUD').style.display = 'none';
  }
  const hours = state.hour + dt / 60;
  state.day += Math.floor(hours / 24);
  state.hour = hours % 24;
  state.stats.hunger = Math.max(0, state.stats.hunger - dt * 0.07);
  state.stats.energy = Math.max(0, state.stats.energy - dt * 0.025);
  state.stats.happy = Math.max(0, state.stats.happy - dt * 0.018);
  if (state.stats.hunger <= 0) {
    // Utan mat tar både ork och humör slut fortare.
    state.stats.energy = Math.max(0, state.stats.energy - dt * 0.05);
    state.stats.happy = Math.max(0, state.stats.happy - dt * 0.06);
  }
  if (state.stats.energy <= 0 && !modal && !job) passOut();
  if (party && world.id === 'w33' && player.x > 13 && player.y < 9)
    state.stats.happy = clamp(state.stats.happy + dt * 0.3, 0, 100);
  noticeTimer -= dt;
  if (noticeTimer <= 0 && (state.stats.hunger < 15 || state.stats.energy < 15)) {
    toast(
      state.stats.hunger < 15
        ? 'Hungrig? Lunch finns i W33 för ' + lunchPrice() + ' €.'
        : 'Du är trött. Vila hemma eller gör yoga på gymmet.',
    );
    noticeTimer = 40;
  }
  for (const o of world.objects) {
    if (!o.profile || o.profile.id === state.character) continue;
    o.roam -= dt;
    if (o.roam <= 0) {
      o.targetX = o.anchorX + (Math.random() - 0.5) * 2.8;
      o.targetY = o.anchorY + (Math.random() - 0.5) * 2.8;
      o.roam = 3 + Math.random() * 5;
    }
    if (o.targetX != null) {
      const dx = o.targetX - o.x,
        dy = o.targetY - o.y,
        d = Math.hypot(dx, dy);
      if (d > 0.03 && walkable(world, o.x + dx * dt * 0.6, o.y + dy * dt * 0.6)) {
        o.x += dx * dt * 0.6;
        o.y += dy * dt * 0.6;
      }
    }
  }
  saveTimer += dt;
  if (saveTimer > 12) {
    saveTimer = 0;
    save();
  }
  hudTimer += dt;
  if (hudTimer > 0.2) {
    hudTimer = 0;
    updateHUD();
  }
  updateNear();
}

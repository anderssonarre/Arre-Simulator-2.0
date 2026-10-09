// Interaktion, rörelse och uppdatering varje bildruta
'use strict';
function visibleObjects() {
  return world.objects.filter(
    (o) =>
      o.profile?.id !== state?.character &&
      !(o.profile && !o.guest && onlineChars.has(o.profile.id)),
  );
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
function update(dt) {
  if (job?.type === 'challenge' && !paused && $('dialogTag').textContent === 'Timingövning') {
    job.phase += dt * (job.gymOnly ? 2.1 : 2.2 + job.stage * 0.35);
    job.elapsed += dt;
    if ($('timingCursor'))
      $('timingCursor').style.left = clamp(((Math.sin(job.phase) + 1) / 2) * 100, 0, 99) + '%';
  }
  updatePointerHint();
  onlineTick(dt);
  try {
    ambientTick(dt);
  } catch {}
  storyTick();
  // Dagens liv (js/game/life.js) hämtas även när en dialogruta är öppen.
  if (active) lifeTick();
  if (active) conditionsTick();
  if (active) weatherTick(dt);
  if (active) eventsTick(); // årets evenemang (evenemang.js)
  if (active) jobsTick(); // svar på jobbansökningar (jobboard.js)
  buildTick(); // ny version efter en deploy (online.js)
  if (active && !modal) ballsTick(dt); // snöbollar (play.js)
  if (!active || modal || document.hidden) return;
  if (sleeping) {
    // Under sömnen står allt still för dig, men världen och klockan går vidare.
    if (!sharedClock()) {
      const hours = state.hour + (dt * clockRate(state.hour)) / 60;
      state.day += Math.floor(hours / 24);
      state.hour = hours % 24;
    }
    sleepTick(dt);
    peopleTick(dt);
    hudTimer += dt;
    if (hudTimer > 0.2) {
      hudTimer = 0;
      updateHUD();
    }
    return;
  }
  const f =
      (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
      (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) -
      touch.y,
    r = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + touch.x;
  if (job?.type === 'drive') {
    drive(dt, f, r);
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
    walk(dt, f, r, keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.run);
    $('jobHUD').style.display = 'none';
  }
  if (!sharedClock()) {
    // Online går klockan efter servern (se online.js). Natten går fortare, se js/shared/clock.js.
    const hours = state.hour + (dt * clockRate(state.hour)) / 60;
    state.day += Math.floor(hours / 24);
    state.hour = hours % 24;
  }
  state.stats.hunger = Math.max(0, state.stats.hunger - dt * 0.07);
  state.stats.energy = Math.max(0, state.stats.energy - dt * 0.025 * energyDrain());
  // Vintermörkret tar på humöret, sommaren ger mer.
  const season = seasonName(),
    moodK =
      (season === 'vinter' ? 1.25 : season === 'sommar' ? 0.8 : 1) *
      // Ett mysigt hem gör att humöret håller längre när man är hemma.
      (world.id === 'home' && net.visiting == null ? Math.max(0.5, 1 - coziness() * 0.04) : 1);
  state.stats.happy = Math.max(0, state.stats.happy - dt * 0.018 * moodK);
  if (state.stats.hunger <= 0) {
    // Utan mat tar både ork och humör slut fortare.
    state.stats.energy = Math.max(0, state.stats.energy - dt * 0.05);
    state.stats.happy = Math.max(0, state.stats.happy - dt * 0.06);
  }
  if (state.stats.energy <= 0 && !modal && !job) passOut();
  if (partyNow() && world.id === 'w33') party = true;
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
    if (!o.guest) continue;
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
  partyTick(dt);
  peopleTick(dt);
  nightlifeTick(dt);
  careerTick();
  vappenCheck();
  crowdTick(dt);
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

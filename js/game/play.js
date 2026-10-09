// Fas 15: spela tillsammans. Gester som alla ser, presenter ur väskan, snöbollskrig på
// vintern, kubb på sommaren och pubquiz på Filicia på fredagar. Siffror och texter finns i
// js/data/play.js. Servern skickar bara vidare (server/server.js), quizfrågorna kommer från
// server/quiz.js.
'use strict';
const firstOf = (name) => String(name || '').split(' ')[0];
const nowMs = () => performance.now();
const hourStamp = () => (state ? state.day * 24 + Math.floor(state.hour) : 0);

// ---- Gester ----
function openGestures() {
  if (!active || !state) return;
  if (modal && $('dialogTag').textContent !== 'Gester') return;
  dialog(
    'Gester',
    '<p class="sub">Alla i närheten ser dem, även andra spelare online. Gör samma gest samtidigt som en kompis för en bonus.</p>',
    [
      ...Object.entries(GESTER).map(([k, g]) => ({
        label: g.ikon + ' ' + g.namn,
        run: () => (close(), gesture(k)),
      })),
      ...(canThrow() ? [{ label: '❄️ Kasta en snöboll (F)', run: () => (close(), throwSnowball()) }] : []),
      { label: 'Stäng', primary: true, run: close },
    ],
    'Gester',
  );
}
const gestureText = (k, seed = Date.now()) => {
  const t = GESTER[k].text;
  return t[Math.floor(seed / 1000) % t.length];
};
// Sista gången någon i din värld gjorde en gest: { gest: { vem: tid } }.
const gestureLog = {};
function gesture(k, fromNet) {
  const g = GESTER[k];
  if (!g) return;
  const text = gestureText(k);
  // Din egen bubbla och folk runt dig som reagerar.
  net.myChat = g.ikon + ' ' + text;
  net.myChatUntil = nowMs() + 4000;
  toast(g.ikon + ' ' + text);
  state.gestures ??= {};
  if (state.gestures[k] !== hourStamp()) {
    state.gestures[k] = hourStamp();
    gain('happy', g.glädje);
  }
  npcsReact(k);
  noteGesture(k, 'me');
  if (!fromNet && net.status === 'online') {
    try {
      net.ws.send(JSON.stringify({ t: 'emote', e: k }));
    } catch {}
  }
}
function npcsReact(k) {
  const near = world.objects.filter(
    (o) => o.person && o.profile && Math.hypot(o.x - player.x, o.y - player.y) < 6,
  );
  for (const o of near.slice(0, 4)) {
    const r = relation(o.profile);
    if (k === 'vinka' || k === 'highfive') {
      o.waveUntil = nowMs() + 1800;
      if (r >= 5) speak(o, k === 'highfive' ? 'Yes! 🙌' : 'Hej ' + firstOf(playerName()) + '!', 3);
    } else if (k === 'skåla' && (o.activity === 'fest' || party || homeParty)) {
      o.gestureUntil = nowMs() + 2000;
      speak(o, rand(['Skål!', 'Kippis!', 'Skååål!']), 3);
    } else if (k === 'dansa' && (o.activity === 'fest' || party || homeParty)) {
      o.dancing = true;
      speak(o, '🎶', 2);
    } else if (k === 'skratta' && r >= 15) {
      o.gestureUntil = nowMs() + 1500;
      speak(o, rand(['Haha!', 'Vad är det som är så roligt?', '😂']), 3);
    } else if (k === 'sjunga') {
      o.gestureUntil = nowMs() + 3000;
      if (o.activity === 'fest' || party) speak(o, '🎵 ... hej!', 3);
    }
  }
}
// Två eller fler som gör samma gest inom några sekunder i samma värld: gemensam bonus.
function noteGesture(k, who) {
  const t = Date.now(),
    log = (gestureLog[k] ??= {});
  log[who] = t;
  for (const [id, at] of Object.entries(log)) if (t - at > GEMENSAM_SKÅL.sekunder * 1000) delete log[id];
  const n = Object.keys(log).length;
  if (n < 2 || !log.me) return;
  state.together ??= {};
  if (state.together[k] === hourStamp()) return;
  state.together[k] = hourStamp();
  gain('happy', GEMENSAM_SKÅL.glädje);
  addXp('socialt', XP.fest);
  sound('win');
  const names = Object.keys(log)
    .filter((id) => id !== 'me')
    .map((id) => firstOf(remotes.get(+id)?.name))
    .filter(Boolean);
  toast(
    (k === 'skåla' ? 'Gemensam skål' : 'Alla tillsammans') +
      (names.length ? ' med ' + names.join(' och ') : '') +
      '! +' +
      GEMENSAM_SKÅL.glädje +
      ' glädje',
  );
}
function remoteGesture(m) {
  const r = remotes.get(m.id),
    g = GESTER[m.e];
  if (!r || !g) return;
  if (r.world !== worldKey()) return;
  r.chat = g.ikon + ' ' + gestureText(m.e);
  r.chatUntil = nowMs() + 4000;
  r.body = g.kropp;
  r.bodyUntil = nowMs() + (g.kropp === 'dansa' ? 6000 : 2500);
  if (Math.hypot(r.x - player.x, r.y - player.y) < 12) noteGesture(m.e, String(m.id));
}
// Hur en annan spelares figur rör sig just nu (används av båda grafikmotorerna).
function remoteBody(r) {
  return r.bodyUntil > nowMs() ? r.body : null;
}

// ---- Presenter ur väskan ----
function giftMenu(r) {
  const b = ensureBag(),
    items = Object.keys(b);
  dialog(
    'Ge ' + firstOf(r.name) + ' något',
    items.length ? '<p>Vad vill du ge?</p>' : '<p>Väskan är tom. Kiosken i W33 och baren på Filicia säljer saker.</p>',
    [
      ...items.map((k) => ({
        label: VAROR[k].ikon + ' ' + VAROR[k].namn + ' ×' + b[k],
        run: () => sendGift(r, k),
      })),
      { label: 'Tillbaka', primary: true, run: () => playerActions(r) },
    ],
    'Spelare',
  );
}
function sendGift(r, k) {
  const b = ensureBag();
  if (!b[k] || net.status !== 'online') return;
  try {
    net.ws.send(JSON.stringify({ t: 'gift', to: r.id, item: k }));
  } catch {
    return;
  }
  if (--b[k] <= 0) delete b[k];
  save();
  sound('tap');
  close();
  toast('Du gav ' + firstOf(r.name) + ' ' + VAROR[k].ikon + ' ' + VAROR[k].namn.toLowerCase() + '.');
}
function receivedGift(m) {
  const v = VAROR[m.item];
  if (!v) return;
  if (bagCount() >= VÄSKA.platser) return toast(firstOf(m.name) + ' ville ge dig ' + v.namn.toLowerCase() + ', men väskan är full.');
  const b = ensureBag();
  b[m.item] = (b[m.item] || 0) + 1;
  save();
  sound('win');
  toast(firstOf(m.name) + ' gav dig ' + v.ikon + ' ' + v.namn.toLowerCase() + '!');
}

// ---- Snöbollar ----
const balls = []; // { x, y, z, vx, vy, vz, owner: 'me' | 'npc' | spelar-id, world }
let throwWait = 0;
function canThrow() {
  if (!world?.outdoor || !state) return false;
  const w = weather();
  return snowCover() >= 0.5 || (w.snö && w.ned > 0.05);
}
function launch(owner, x, y, a, p = 0, wkey = worldKey()) {
  const S = SNÖBOLL;
  balls.push({
    owner,
    world: wkey,
    x: x + Math.cos(a) * 0.45,
    y: y + Math.sin(a) * 0.45,
    z: 0.85,
    vx: Math.cos(a) * S.fart,
    vy: Math.sin(a) * S.fart,
    vz: S.uppåt + p * 5,
    age: 0,
  });
  if (balls.length > 40) balls.shift();
}
function throwSnowball() {
  if (!active || modal || throwWait > 0) return;
  if (!canThrow()) return toast(world?.outdoor ? 'Det finns ingen snö att göra snöbollar av.' : 'Snöbollar kastar man ute.');
  throwWait = SNÖBOLL.vänta;
  launch('me', player.x, player.y, player.a, clamp(pitch, -0.6, 0.8));
  sound('tap');
  if (net.status === 'online')
    try {
      net.ws.send(JSON.stringify({ t: 'throw', x: +player.x.toFixed(2), y: +player.y.toFixed(2), a: +player.a.toFixed(3), p: +clamp(pitch, -0.6, 0.8).toFixed(2) }));
    } catch {}
}
function remoteThrow(m) {
  if (m.world !== worldKey()) return;
  launch(m.id, m.x, m.y, m.a, m.p || 0, m.world);
}
const G = 9.8 / 1.7; // tyngdkraften i rutor per sekund i kvadrat
function ballsTick(dt) {
  throwWait = Math.max(0, throwWait - dt);
  const here = worldKey();
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if (b.world !== here) {
      balls.splice(i, 1);
      continue;
    }
    b.age += dt;
    b.vz -= G * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    let gone = b.z <= 0 || b.age > 3 || isWall(world, b.x, b.y);
    if (!gone) gone = ballHits(b);
    if (gone) balls.splice(i, 1);
  }
}
// Kollar om bollen träffar någon. Den som kastade avgör träffen, så att alla ser samma sak.
function ballHits(b) {
  if (b.z > 1.2) return false;
  if (b.owner === 'me') {
    for (const o of world.objects) {
      if (!o.person || !o.profile || o.hidden) continue;
      if (Math.hypot(o.x - b.x, o.y - b.y) < 0.4) {
        npcHit(o);
        return true;
      }
    }
    for (const r of remotesHere())
      if (Math.hypot(r.x - b.x, r.y - b.y) < 0.4) {
        remoteHit(r);
        return true;
      }
    return false;
  }
  // Andras bollar (och personer som kastar tillbaka) mot dig.
  if (Math.hypot(player.x - b.x, player.y - b.y) < 0.4) {
    if (b.owner === 'npc') splat(b.from || 'Någon');
    return true;
  }
  return false;
}
function npcHit(o) {
  speak(o, rand(SNÖBOLL.repliker), 3);
  o.gestureUntil = nowMs() + 1500;
  gain('happy', SNÖBOLL.träffGlädje / 2);
  // Ibland kastar de tillbaka, och de träffar inte alltid.
  if (Math.random() < SNÖBOLL.kastarTillbaka)
    setTimeout(() => {
      if (!world?.objects.includes(o)) return;
      const a = Math.atan2(player.y - o.y, player.x - o.x) + (Math.random() - 0.5) * 0.25;
      launch('npc', o.x, o.y, a, 0.05 + Math.hypot(player.x - o.x, player.y - o.y) * 0.004);
      balls[balls.length - 1].from = firstOf(o.profile.name);
    }, 700 + Math.random() * 600);
}
function remoteHit(r) {
  try {
    net.ws.send(JSON.stringify({ t: 'hit', to: r.id }));
  } catch {}
  gain('happy', SNÖBOLL.träffGlädje);
  sound('win');
  toast('Träff på ' + firstOf(r.name) + '! ❄️');
  r.chat = '❄️ Aj!';
  r.chatUntil = nowMs() + 2500;
  const s = (state.snowFight ??= { day: 0, hits: 0, reported: false });
  if (s.day !== state.day) Object.assign(s, { day: state.day, hits: 0, reported: false });
  s.hits++;
  if (s.hits >= 3 && !s.reported) {
    s.reported = true;
    reportHappening('snoboll');
  }
}
function splat(name) {
  const el = $('splat');
  if (el) {
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }
  sound('bad');
  toast(name + ' träffade dig med en snöboll! ❄️');
}

// ---- Kubb ----
function kubbSeason() {
  return KUBB.månader.includes(monthIndex()) && snowCover() < 0.5 && weather().ned < 0.3;
}
function placeKubb() {
  const w = worlds[KUBB.plats.värld];
  if (!w) return;
  let spot = null;
  for (let r = 0; r < 40 && !spot; r += 0.5)
    for (let a = 0; a < 6.28 && !spot; a += 0.25) {
      const x = Math.floor(KUBB.plats.x + Math.cos(a) * r) + 0.5,
        y = Math.floor(KUBB.plats.y + Math.sin(a) * r) + 0.5;
      if (w.ground && groundAt(w, x, y) !== GROUND.GRASS) continue;
      if (!walkable(w, x, y, 0.6) || !findPath(w, w.spawn.x, w.spawn.y, x, y)) continue;
      spot = [x, y];
    }
  if (!spot) return;
  const o = obj(w, spot[0], spot[1], 'kubb', 'Kubb', kubbMenu, { height: 0.5, sprite: kubbSprite() });
  Object.defineProperty(o, 'label', {
    get: () => (kubbSeason() ? 'Kubb · spela mot någon' : 'Kubb · spelas när det är sommar och torrt'),
    enumerable: true,
  });
}
function kubbSprite() {
  if (cache.kubb) return cache.kubb;
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#d8b67a';
  for (let i = 0; i < 5; i++) g.fillRect(6 + i * 18, 26, 12, 34);
  g.fillStyle = '#b48c4f';
  for (let i = 0; i < 5; i++) g.fillRect(6 + i * 18, 26, 12, 4);
  g.fillStyle = '#e6c88e';
  g.fillRect(40, 4, 16, 56);
  g.fillStyle = '#a2783d';
  g.fillRect(40, 4, 16, 6);
  cache.kubb = c;
  return c;
}
function kubbMenu() {
  if (!kubbSeason()) return toast('Kubben ligger i förrådet tills det är sommar och torrt ute.');
  const npcs = world.objects.filter(
      (o) => o.person && o.profile && Math.hypot(o.x - player.x, o.y - player.y) < 12,
    ),
    friends = remotesHere().filter((r) => Math.hypot(r.x - player.x, r.y - player.y) < 20);
  dialog(
    'Kubb',
    '<p>Sex pinnar, fem kubbar och kungen i mitten. Kasta när markören är i den gröna zonen. Fäll alla kubbar och sedan kungen.</p>',
    [
      ...friends.map((r) => ({ label: 'Utmana ' + firstOf(r.name), primary: true, run: () => kubbInvite(r) })),
      ...npcs.slice(0, 3).map((o) => ({
        label: 'Spela mot ' + firstOf(o.profile.name),
        run: () => playKubb({ npc: o }),
      })),
      { label: 'Träna själv', run: () => playKubb({}) },
      { label: 'Stäng', run: close },
    ],
    'Kubb',
  );
}
function kubbInvite(r) {
  try {
    net.ws.send(JSON.stringify({ t: 'invite', to: r.id, kind: 'kubb' }));
  } catch {}
  close();
  toast('Du utmanade ' + firstOf(r.name) + ' i kubb. Väntar på svar …');
}
function receivedKubbInvite(m) {
  const show = () => {
    if (modal || sleeping || job) return setTimeout(show, 1500);
    dialog(
      firstOf(m.name) + ' utmanar dig i kubb',
      '<p>Ni kastar samtidigt, och den som fäller flest vinner.</p>',
      [
        { label: 'Kör!', primary: true, run: () => (answer({ ...m, kind: 'kubb' }, true), playKubb({ remote: { id: m.from, name: m.name } })) },
        { label: 'Inte nu', run: () => (answer({ ...m, kind: 'kubb' }, false), close()) },
      ],
      'Kubb',
    );
    sound('win');
  };
  show();
}
function kubbAnswer(m) {
  if (!m.accept) return toast(firstOf(m.name) + ' kan inte spela just nu.');
  if (modal || job) close();
  playKubb({ remote: { id: m.from, name: m.name } });
}
// Pågående match: { mot, fällda, kung, pinnar, theirs }
let kubb = null;
function playKubb(mot) {
  kubb = { mot, fällda: 0, kung: false, pinnar: KUBB.pinnar, theirs: kubb?.pendingTheirs ?? null };
  job = { type: 'challenge', minigame: 'kubb', stage: 0, phase: Math.random() * 6, elapsed: 0 };
  kubbThrow();
}
function kubbZone() {
  const king = kubb.fällda >= KUBB.kubbar;
  return {
    width: king ? KUBB.kungZon : Math.max(0.1, KUBB.zon - kubb.fällda * KUBB.smalare),
    center: king ? 0.5 : 0.25 + ((kubb.fällda * 0.37 + kubb.pinnar * 0.21) % 0.5),
  };
}
function kubbThrow() {
  const z = kubbZone(),
    king = kubb.fällda >= KUBB.kubbar;
  job.stage = kubb.fällda * 0.6;
  dialog(
    'Kubb' + (kubb.mot.npc ? ' mot ' + firstOf(kubb.mot.npc.profile.name) : kubb.mot.remote ? ' mot ' + firstOf(kubb.mot.remote.name) : ''),
    '<p>' +
      (king ? '<strong>Alla kubbar ligger. Fäll kungen!</strong>' : 'Fällda kubbar: ' + kubb.fällda + ' av ' + KUBB.kubbar) +
      ' · pinnar kvar: ' +
      kubb.pinnar +
      '</p><div class="meter"><div class="zone" style="left:' +
      (z.center - z.width / 2) * 100 +
      '%;width:' +
      z.width * 100 +
      '%"></div><div class="cursor" id="timingCursor"></div></div><p class="sub">Mellanslag eller knappen kastar.</p>',
    [
      { label: 'Kasta!', primary: true, run: kubbRelease },
      { label: 'Ge upp', run: () => kubbEnd(true) },
    ],
    'Timingövning',
  );
}
function kubbRelease() {
  if (!kubb) return;
  const z = kubbZone(),
    pos = (Math.sin(job.phase) + 1) / 2,
    hit = Math.abs(pos - z.center) <= z.width / 2,
    king = kubb.fällda >= KUBB.kubbar;
  kubb.pinnar--;
  if (hit && king) {
    kubb.kung = true;
    sound('win');
    return kubbEnd();
  }
  if (hit) {
    kubb.fällda++;
    sound('tap');
    toast('Kubben föll! 🪵');
  } else toast('Miss!');
  if (kubb.pinnar <= 0) return kubbEnd();
  kubbThrow();
}
const kubbScore = (k) => k.fällda + (k.kung ? 2 : 0);
function kubbEnd(gaveUp) {
  job = null;
  const k = kubb,
    mine = gaveUp ? 0 : kubbScore(k);
  advance(20);
  if (k.mot.remote) {
    try {
      net.ws.send(JSON.stringify({ t: 'duel', to: k.mot.remote.id, game: 'kubb', score: mine }));
    } catch {}
    k.mine = mine;
    if (k.theirs == null) {
      dialog('Kubb', '<p>Du fick ' + mine + ' poäng. Väntar på ' + esc(firstOf(k.mot.remote.name)) + ' …</p>', [{ label: 'Stäng', primary: true, run: close }], 'Kubb');
      // Svarar kompisen inte inom en och en halv minut räknas bara ditt resultat.
      setTimeout(() => kubb === k && k.theirs == null && kubbResult(k, null), 90000);
      return;
    }
    return kubbResult(k, k.theirs);
  }
  // Mot en person på campus: de är ungefär lika bra som du, ibland bättre.
  const theirs = k.mot.npc ? Math.floor(seeded(hashId(k.mot.npc.profile.id) + state.day * 13 + Math.floor(Date.now() / 6e4))() * 8) : null;
  k.mine = mine;
  kubbResult(k, theirs);
}
function kubbDuel(m) {
  if (m.game !== 'kubb') return;
  if (kubb && kubb.mot.remote?.id === m.from) {
    kubb.theirs = m.score;
    if (kubb.mine != null) kubbResult(kubb, m.score);
  } else kubb = { pendingTheirs: m.score, mot: { remote: { id: m.from, name: m.name } } };
}
function kubbResult(k, theirs) {
  kubb = null;
  const who = k.mot.npc ? firstOf(k.mot.npc.profile.name) : k.mot.remote ? firstOf(k.mot.remote.name) : null,
    won = theirs == null ? k.kung : k.mine > theirs,
    tie = theirs != null && k.mine === theirs;
  if (won || (theirs == null && k.kung)) {
    gain('happy', KUBB.vinst.glädje);
    addXp('socialt', KUBB.vinst.socialt);
    if (k.mot.remote) reportHappening('kubb', { person: who });
  } else gain('happy', 3);
  if (k.mot.npc) bump(k.mot.npc.profile.id, 2);
  save();
  dialog(
    'Kubb',
    '<p>Du: <strong>' +
      k.mine +
      '</strong> poäng' +
      (theirs != null ? ' · ' + esc(who) + ': <strong>' + theirs + '</strong>' : '') +
      '</p><p>' +
      (theirs == null
        ? k.kung
          ? 'Kungen föll. Snyggt!'
          : 'Bra träning.'
        : tie
          ? 'Oavgjort! Revansch?'
          : won
            ? 'Du vann! +' + KUBB.vinst.glädje + ' glädje'
            : esc(who) + ' vann den här gången.') +
      '</p><p class="sub">Kubbar ger 1 poäng var, kungen 2.</p>',
    [{ label: 'Klar', primary: true, run: close }],
    'Kubb',
  );
}

// ---- Pubquiz på Filicia ----
function quizOpen() {
  const P = PUBQUIZ,
    h = state.hour < 6 ? state.hour + 24 : state.hour,
    d = state.hour < 6 ? state.day - 1 : state.day;
  return WEEKDAYS[weekdayIndex(d)] === P.dag && h >= P.från && h < P.till;
}
function placeQuiz() {
  const w = worlds[PUBQUIZ.plats.värld];
  if (!w) return;
  const [x, y] = coffeeSpot(w, PUBQUIZ.plats.x, PUBQUIZ.plats.y);
  const o = obj(w, x, y, 'quiz', 'Pubquiz', startQuiz, { height: 1.1, sprite: quizSprite() });
  Object.defineProperty(o, 'label', {
    get: () => (state && quizOpen() ? 'Pubquiz · veckans frågor' : 'Pubquiz · fredagar ' + PUBQUIZ.från + '–' + PUBQUIZ.till % 24),
    enumerable: true,
  });
}
function quizSprite() {
  if (cache.quiz) return cache.quiz;
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#3b2a1c';
  g.fillRect(44, 60, 8, 66);
  g.fillStyle = '#1d2a24';
  g.fillRect(10, 8, 76, 60);
  g.strokeStyle = '#b48c4f';
  g.lineWidth = 5;
  g.strokeRect(10, 8, 76, 60);
  g.fillStyle = '#f2efe4';
  g.font = 'bold 20px system-ui';
  g.textAlign = 'center';
  g.fillText('QUIZ', 48, 34);
  g.font = '14px system-ui';
  g.fillText('fre ' + PUBQUIZ.från, 48, 54);
  cache.quiz = c;
  return c;
}
async function startQuiz() {
  if (!quizOpen()) return toast('Pubquizen är på fredagar ' + PUBQUIZ.från + '–' + (PUBQUIZ.till % 24) + ' på Filicia.');
  let data;
  try {
    const r = await fetch('/api/quiz');
    if (r.ok) data = await r.json();
  } catch {}
  if (!data?.frågor?.length) return toast('Quizmastern har tappat sina papper. Försök igen om en stund.');
  if (state.quizWeek === data.week) return quizBoard(data, null);
  let i = 0,
    right = 0;
  const next = () => {
    if (i >= data.frågor.length) return quizDone(data, right);
    const q = data.frågor[i++];
    quiz(
      'Pubquiz · fråga ' + i + ' av ' + data.frågor.length,
      q.fråga,
      [q.rätt, ...q.fel],
      () => (right++, toast('Rätt!'), next()),
      () => (toast('Fel. Rätt svar: ' + q.rätt), next()),
      'Pubquiz',
    );
  };
  next();
}
async function quizDone(data, right) {
  state.quizWeek = data.week;
  const money = right * PUBQUIZ.prisPerRätt;
  state.money += money;
  gain('happy', PUBQUIZ.glädje);
  addXp('socialt', XP.fest);
  advance(60);
  save();
  reportHappening('quiz', { poäng: String(right) });
  let top = data.topp || [];
  try {
    const r = await fetch('/api/quiz/score', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: playerName(), score: right }),
    });
    if (r.ok) top = (await r.json()).topp || top;
  } catch {}
  quizBoard({ ...data, topp: top }, { right, money });
}
function quizBoard(data, mine) {
  const rows = (data.topp || [])
    .slice(0, 8)
    .map((t, i) => '<div class="course"><span>' + (i + 1) + '. ' + esc(t.name) + '</span><span class="badge">' + t.score + ' rätt</span></div>')
    .join('');
  dialog(
    'Pubquiz · ' + esc(data.week),
    (mine
      ? '<p>Du fick <strong>' + mine.right + ' av ' + data.frågor.length + '</strong> rätt och vann ' + mine.money + ' € i baren.</p>'
      : '<p>Du har redan kört veckans quiz. Nya frågor nästa vecka.</p>') +
      '<p><strong>Veckans topplista</strong></p>' +
      (rows || '<p class="sub">Ingen har kört quizen än.</p>'),
    [{ label: 'Klar', primary: true, run: close }],
    'Pubquiz',
  );
}

// ---- Meddelanden från servern ----
function playMessage(m) {
  if (m.t === 'emote') remoteGesture(m);
  else if (m.t === 'throw') remoteThrow(m);
  else if (m.t === 'hit') splat(firstOf(m.name));
  else if (m.t === 'gift') receivedGift(m);
  else if (m.t === 'duel') kubbDuel(m);
}

$('gestButton')?.addEventListener('click', () => (modal ? null : openGestures()));

// En snöboll som figur, för båda grafikmotorerna.
function ballSprite() {
  if (cache.ball) return cache.ball;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d'),
    r = g.createRadialGradient(13, 12, 2, 16, 16, 14);
  r.addColorStop(0, '#ffffff');
  r.addColorStop(1, '#c9d6e2');
  g.fillStyle = r;
  g.beginPath();
  g.arc(16, 16, 13, 0, 7);
  g.fill();
  cache.ball = c;
  return c;
}

// Kollar datafilen när spelet startar.
for (const [k, g] of Object.entries(GESTER))
  if (!['vinka', 'dansa', 'gestikulera'].includes(g.kropp) || !g.text?.length) console.warn('Gest ' + k + ': kropp eller text saknas');

// Hemmafest: bjud in bekanta, de kommer hem till dig, dansar och pratar.
'use strict';
let homeParty = null; // { guests: [id], startDay, startHour }
const PARTY_COST = 15,
  PARTY_MAX = 6,
  PARTY_HOURS = 5;
// Platser i hemmet där gästerna står. De i det öppna golvet mellan skrivbordet och köket dansar.
const partySpots = [
  [5.0, 3.0, true],
  [5.8, 3.4, true],
  [6.4, 2.9, true],
  [5.2, 3.9, true],
  [6.5, 3.85, true],
  [4.7, 2.5, true],
  [3.4, 4.25, false],
  [2.3, 3.4, false],
  [3.1, 2.4, false],
  [5.0, 5.6, false],
  [6.95, 5.95, false],
  [2.1, 4.5, false],
];
let partySelection = new Set(),
  partyBeat = 0,
  partyTimer = 0;
function partyCandidates() {
  return [...characters, ...extra].filter((p) => p.id !== state.character && relation(p) >= 15);
}
function partyInvite() {
  const people = partyCandidates();
  if (!people.length) {
    dialog(
      'Ingen att bjuda än',
      '<p>Du behöver lära känna folk först. Alla som är <strong>Bekant</strong> eller mer kan bjudas hem.</p><div class="info">Prata med folk på campus några dagar i rad, eller ta en kaffe.</div>',
      [{ label: 'Okej', primary: true, run: close }],
      'Hemmafest',
    );
    return;
  }
  for (const id of [...partySelection])
    if (!people.some((p) => p.id === id)) partySelection.delete(id);
  const n = partySelection.size;
  dialog(
    'Hemmafest',
    '<p>Välj upp till ' +
      PARTY_MAX +
      ' gäster. Snacks och dricka kostar <strong>' +
      PARTY_COST +
      ' €</strong>. Festen pågår i ungefär fem timmar eller tills du avslutar den vid köksbordet.</p><div class="info">Gästerna blir gladare av festen och relationen växer dubbelt så fort när ni pratar.</div>',
    [
      ...people.map((p) => ({
        label:
          (partySelection.has(p.id) ? '✓ ' : '+ ') + p.name + ' · ' + relationName(relation(p)),
        disabled: !partySelection.has(p.id) && n >= PARTY_MAX,
        run: () => {
          if (partySelection.has(p.id)) partySelection.delete(p.id);
          else partySelection.add(p.id);
          partyInvite();
        },
      })),
      {
        label: n
          ? 'Starta festen med ' + n + (n === 1 ? ' gäst' : ' gäster') + ' · ' + PARTY_COST + ' €'
          : 'Välj minst en gäst',
        primary: true,
        disabled: !n || state.money < PARTY_COST,
        run: () => startHomeParty([...partySelection]),
      },
      { label: 'Inte nu', run: close },
    ],
    state.money < PARTY_COST ? 'Du behöver ' + PARTY_COST + ' €' : 'Bjud in',
  );
}
function startHomeParty(ids) {
  if (!ids.length || state.money < PARTY_COST) return;
  state.money -= PARTY_COST;
  homeParty = { guests: ids, startDay: state.day, startHour: state.hour };
  const w = worlds.home,
    spots = shuffled(partySpots.map((_, i) => i));
  ids.forEach((id, n) => {
    const p = [...characters, ...extra].find((c) => c.id === id),
      [x, y] = partySpots[spots[n % spots.length]];
    obj(w, 5.5, 5.9, 'npc', p.name, () => chat(p), {
      profile: p,
      sprite: npcSprite(p),
      height: 1.08,
      guest: true,
      anchorX: x,
      anchorY: y,
      targetX: x,
      targetY: y,
      phase: Math.random() * 6,
      roam: 4 + Math.random() * 4,
      dancing: false,
    });
  });
  close();
  sound('win');
  toast(
    ids.length === 1
      ? 'Gästen är här. Festen har börjat!'
      : ids.length + ' gäster är här. Festen har börjat!',
  );
  save();
}
// Körs varje bildruta från update().
function partyTick(dt) {
  if (!homeParty) return;
  const w = worlds.home;
  partyTimer -= dt;
  if (partyTimer <= 0) {
    partyTimer = 7 + Math.random() * 5;
    // Ge några gäster en ny plats att gå till.
    const free = shuffled(partySpots.slice());
    for (const o of w.objects)
      if (o.guest && Math.random() < 0.5) {
        const [x, y] = free.pop() || partySpots[0];
        o.anchorX = x;
        o.anchorY = y;
        o.roam = 0;
      }
  }
  for (const o of w.objects)
    if (o.guest) {
      const spot = partySpots.find(([x, y]) => Math.hypot(x - o.anchorX, y - o.anchorY) < 0.01);
      o.dancing = !!spot?.[2] && Math.hypot(o.x - o.anchorX, o.y - o.anchorY) < 1.6;
    }
  if (world === w) {
    gain('happy', dt * 0.22);
    state.stats.energy = Math.max(0, state.stats.energy - dt * 0.03);
    beat(dt);
  }
  const hours = (state.day - homeParty.startDay) * 24 + state.hour - homeParty.startHour;
  if (hours >= PARTY_HOURS && !modal) endHomeParty();
}
// Enkel takt: bastrumma och hi-hat, bara när du är hemma och ljudet är på.
function beat(dt) {
  partyBeat -= dt;
  if (partyBeat > 0 || muted) return;
  partyBeat = 0.5;
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime,
      o = audio.createOscillator(),
      g = audio.createGain();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g);
    g.connect(audio.destination);
    o.start(t);
    o.stop(t + 0.2);
    const h = audio.createOscillator(),
      hg = audio.createGain();
    h.type = 'square';
    h.frequency.setValueAtTime(7000, t + 0.25);
    hg.gain.setValueAtTime(0.0001, t);
    hg.gain.setValueAtTime(0.006, t + 0.25);
    hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    h.connect(hg);
    hg.connect(audio.destination);
    h.start(t + 0.25);
    h.stop(t + 0.32);
  } catch {}
}
// Färgade ljusfläckar som sveper över golvet under festen.
const glowOut = [0, 0, 0];
function partyGlow(wx, wy) {
  glowOut[0] = glowOut[1] = glowOut[2] = 0;
  const t = frame * 0.02;
  for (let i = 0; i < 3; i++) {
    const cx = 5.4 + Math.cos(t + i * 2.1) * 1.4,
      cy = 3.4 + Math.sin(t * 1.3 + i * 2.1) * 0.9,
      d2 = (wx - cx) ** 2 + (wy - cy) ** 2;
    if (d2 > 0.5) continue;
    const k = (1 - d2 / 0.5) * 70;
    if (i === 0) {
      glowOut[0] += k;
      glowOut[2] += k * 0.6;
    } else if (i === 1) {
      glowOut[1] += k * 0.8;
      glowOut[2] += k;
    } else {
      glowOut[0] += k;
      glowOut[1] += k * 0.7;
    }
  }
  return glowOut;
}
function endHomeParty(silent = false) {
  if (!homeParty) return;
  const guests = homeParty.guests;
  for (const id of guests) bump(id, 6);
  const w = worlds.home;
  w.objects = w.objects.filter((o) => !o.guest);
  homeParty = null;
  partySelection = new Set();
  gain('energy', -10);
  save();
  const names = guests.map(
    (id) => [...characters, ...extra].find((c) => c.id === id).name.split(' ')[0],
  );
  if (silent) {
    toast('Festen tog slut när du gick. ' + names.join(', ') + ' gick hem glada.');
    return;
  }
  dialog(
    'Festen är slut',
    '<p>' +
      names.join(', ') +
      (names.length === 1 ? ' tackar' : ' tackar') +
      ' för en riktigt bra kväll.</p><div class="info">Alla gäster: +6 relation · Du: −10 energi</div>',
    [{ label: 'Städa upp', primary: true, run: close }],
    'Hemmafest',
  );
  sound('win');
}

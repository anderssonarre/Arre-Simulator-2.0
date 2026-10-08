// Nattlivet: studerande som är på väg hem från fester raglar omkring på campus på natten.
// Flest natten mellan tisdag och onsdag, efter Ollis tisdag.
'use strict';
const NIGHTLIFE = {
  // Hur många som är ute samtidigt. Natten räknas till dagen den började.
  antal: { tis: 9, fre: 6, lör: 6, ons: 1, tor: 2, sön: 1, mån: 1 },
  från: 22, // kl. 22 på kvällen
  till: 4, // till kl. 04 på natten
  namn: ['Emil', 'Ella', 'Oskar', 'Aino', 'Viktor', 'Linnea', 'Leo', 'Saga', 'Elias', 'Wilma'],
  // Overallfärger.
  färger: ['#e8c43a', '#2f6fb8', '#c23b3b', '#1f8a5b', '#7a3fa0', '#e07a2f', '#f1f1ee'],
  repliker: [
    'Var bor jag nu igen...',
    '♪ La la laaa ♪',
    'Har någon sett min mössa?',
    'Imorgon pluggar jag. Seriöst.',
    'Kebab. Nu.',
    'Vem tog mitt overallmärke?',
    'Föreläsning kl. 9? Haha. Nej.',
    'Du är min bästa kompis. Vad hette du?',
    'En fest till, kom igen!',
    'Vasa är så vackert på natten...',
  ],
  tisdag: [
    'OLLIS TISDAG!',
    'Ollis är bäst på tisdagar. Alla vet.',
    'Det var bara en till. Sa jag. Tre gånger.',
    'Onsdagsföreläsningen... vi hoppar den.',
  ],
};
const nightPeople = [];
// Vilken natt det är (dagen den började) och om nattlivet pågår just nu.
function nightInfo() {
  const h = state.hour,
    late = h < NIGHTLIFE.till,
    on = h >= NIGHTLIFE.från || late;
  return { on, day: late ? state.day - 1 : state.day };
}
function nightCount() {
  const n = nightInfo();
  return n.on ? NIGHTLIFE.antal[weekday(n.day)] || 0 : 0;
}
function randomOutdoorSpot(seed) {
  const w = worlds.outdoor,
    r = seeded(seed);
  for (let i = 0; i < 80; i++) {
    const x = 20 + r() * (w.size - 40),
      y = 20 + r() * (w.size - 40);
    if (walkable(w, x, y, 0.3) && w.ground && groundAt(w, x, y) !== GROUND.GRASS) return [x, y];
  }
  return w.exits[0];
}
function makeReveler(i) {
  const night = nightInfo().day,
    seed = night * 31 + i * 7 + 3,
    r = seeded(seed),
    name = NIGHTLIFE.namn[Math.floor(r() * NIGHTLIFE.namn.length)],
    profile = {
      id: 'natt' + i,
      name,
      color: NIGHTLIFE.färger[Math.floor(r() * NIGHTLIFE.färger.length)],
      hair: ['#2b1d14', '#6b4a2b', '#d8b26a', '#1a1a1a'][Math.floor(r() * 4)],
      skin: ['#e5b89b', '#d9a582', '#f0c9ae'][Math.floor(r() * 3)],
    };
  const [x, y] = w0Exit(i);
  const o = {
    x,
    y,
    type: 'npc',
    label: name + ' · på väg hem',
    profile,
    sprite: npcSprite(profile),
    height: 1.05,
    phase: r() * 6,
    drunk: true,
    reveler: true,
    action: () => revelerChat(o),
  };
  return { o, path: null, wait: r() * 4, talk: 3 + r() * 10, leaving: false, seed };
}
function w0Exit(i) {
  const ex = worlds.outdoor.exits;
  return ex[i % ex.length];
}
function removeReveler(n) {
  const list = worlds.outdoor.objects,
    k = list.indexOf(n.o);
  if (k >= 0) list.splice(k, 1);
  nightPeople.splice(nightPeople.indexOf(n), 1);
}
// Körs varje bildruta: rätt antal ute, de vinglar mot slumpade mål och pratar för sig själva.
function nightlifeTick(dt) {
  if (!state || !worlds.outdoor) return;
  const want = nightCount();
  while (nightPeople.filter((n) => !n.leaving).length < want) {
    const n = makeReveler(nightPeople.length + Math.floor(Math.random() * 1000));
    nightPeople.push(n);
    worlds.outdoor.objects.push(n.o);
  }
  // För många ute (natten är slut): de överblivna går hem.
  let extraOut = nightPeople.filter((n) => !n.leaving).length - want;
  for (const n of nightPeople)
    if (extraOut > 0 && !n.leaving) {
      n.leaving = true;
      n.path = null;
      extraOut--;
    }
  const w = worlds.outdoor;
  for (const n of [...nightPeople]) {
    const o = n.o;
    if (!n.path) {
      n.wait -= dt;
      o.targetX = null;
      if (n.wait > 0) continue;
      const [tx, ty] = n.leaving
        ? w.exits.reduce((a, b) =>
            Math.hypot(a[0] - o.x, a[1] - o.y) < Math.hypot(b[0] - o.x, b[1] - o.y) ? a : b,
          )
        : randomOutdoorSpot(n.seed++);
      n.path = findPath(w, o.x, o.y, tx, ty) || [];
      if (!n.path.length) {
        if (n.leaving) removeReveler(n);
        else n.wait = 2;
        continue;
      }
    }
    // Vinglig gång: långsammare, och lite åt sidan.
    const [tx, ty] = n.path[0],
      dx = tx - o.x,
      dy = ty - o.y,
      d = Math.hypot(dx, dy),
      step = 0.75 * dt,
      sway = Math.sin(performance.now() / 420 + o.phase) * 0.6;
    o.targetX = tx;
    o.targetY = ty;
    if (d <= step) {
      o.x = tx;
      o.y = ty;
      n.path.shift();
      if (!n.path.length) {
        n.path = null;
        n.wait = 2 + Math.random() * 6;
        if (n.leaving) removeReveler(n);
      }
    } else {
      const ux = dx / d,
        uy = dy / d,
        nx = o.x + (ux - uy * sway) * step,
        ny = o.y + (uy + ux * sway) * step;
      if (walkable(w, nx, ny, 0.2)) {
        o.x = nx;
        o.y = ny;
      } else {
        o.x += ux * step;
        o.y += uy * step;
      }
    }
    n.talk -= dt;
    if (n.talk <= 0 && world === w && Math.hypot(o.x - player.x, o.y - player.y) < 14) {
      n.talk = 8 + Math.random() * 14;
      const tue = weekday(nightInfo().day) === 'tis';
      speak(o, rand(tue && Math.random() < 0.6 ? NIGHTLIFE.tisdag : NIGHTLIFE.repliker), 4);
    }
  }
}
function revelerChat(o) {
  const tue = weekday(nightInfo().day) === 'tis',
    name = o.profile.name;
  dialog(
    name,
    '<p>' +
      esc(name) +
      ' står och vinglar i en ' +
      (tue ? 'overall full av märken från Ollis tisdag' : 'overall') +
      ' och ler stort.</p><p>”' +
      esc(rand(tue ? NIGHTLIFE.tisdag : NIGHTLIFE.repliker)) +
      '”</p>',
    [
      {
        label: 'Hjälp ' + name + ' hem · 20 min',
        primary: true,
        run: () => {
          advance(20);
          gain('happy', 4);
          addXp('socialt', 6);
          const n = nightPeople.find((x) => x.o === o);
          if (n) removeReveler(n);
          close();
          save();
          toast(name + ' kom hem tryggt. ”Du är bäst!” · +4 glädje');
        },
      },
      { label: 'God natt', run: close },
    ],
    'Natt på campus',
  );
}

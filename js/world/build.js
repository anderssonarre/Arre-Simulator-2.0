// Bygger världarna: hem, campus, W33, Technobothnia, gym
'use strict';
function makeWorld(id, name, size, outdoor = false) {
  const w = {
    id,
    name,
    size,
    outdoor,
    grid: Array.from({ length: size }, (_, y) =>
      Array.from({ length: size }, (_, x) =>
        x === 0 || y === 0 || x === size - 1 || y === size - 1 ? 3 : 0,
      ),
    ),
    objects: [],
    spawn: { x: 3.5, y: size - 3.5, a: -Math.PI / 2 },
    wallHeight: outdoor ? 2.2 : 1.4,
  };
  worlds[id] = w;
  return w;
}
function rect(w, x, y, width, height, value) {
  for (let yy = y; yy < y + height; yy++)
    for (let xx = x; xx < x + width; xx++) w.grid[yy][xx] = value;
}
function boxRoom(w, x, y, width, height, doorX, doorY) {
  for (let yy = y; yy < y + height; yy++)
    for (let xx = x; xx < x + width; xx++)
      if (yy === y || yy === y + height - 1 || xx === x || xx === x + width - 1) w.grid[yy][xx] = 1;
  w.grid[doorY][doorX] = 0;
}
function obj(w, x, y, type, label, action, extraData = {}) {
  const o = { x, y, type, label, action, ...extraData };
  w.objects.push(o);
  return o;
}
function station(w, x, y, type, label, action) {
  return obj(w, x, y, type, label, action, {
    height: 0.85,
    sprite: propSprite(type, type === 'exam' ? '#ffcb83' : '#92e2bf'),
  });
}
// En portal är en dörr: själva dörren ritas i väggen (doorAt), markören är osynlig och visar bara etiketten.
function portal(w, x, y, label, target, spawn) {
  const o = station(w, x, y, 'portal', label, () => changeWorld(target, spawn));
  o.target = target;
  o.hidden = true;
  o.height = 1.3;
  return o;
}
function deco(w, x, y, type, height = 1.1) {
  obj(w, x, y, type, '', null, { height, sprite: propSprite(type) });
}
function build() {
  let w = buildHome();
  w = makeWorld('outdoor', 'Wolffskavägen · campus', 64, true);
  w.spawn = { x: 39.5, y: 19.5, a: -Math.PI / 2 };
  w.wallHeight = 2.4;
  // Wolffskavägen separates W33 from the brick industrial campus; distances compressed.
  rect(w, 40, 3, 20, 9, 6);
  rect(w, 54, 3, 6, 13, 6);
  rect(w, 53, 10, 4, 5, 9);
  rect(w, 6, 28, 25, 11, 7);
  rect(w, 14, 22, 12, 6, 7);
  rect(w, 6, 43, 25, 9, 8);
  rect(w, 6, 52, 8, 7, 8);
  rect(w, 14, 56, 20, 4, 8);
  rect(w, 29, 48, 5, 9, 8);
  rect(w, 3, 30, 3, 8, 7);
  // Dörrar in i husen. Bostadshuset längst söderut är där du bor.
  rect(w, 45, 58, 7, 4, 10);
  doorAt(w, 54, 15);
  doorAt(w, 24, 38);
  doorAt(w, 24, 43);
  doorAt(w, 48, 58);
  portal(w, 54.5, 16.45, 'W33 · gå in', 'w33');
  portal(w, 24.5, 39.45, 'Technobothnia · gå in', 'tech');
  portal(w, 24.5, 42.55, 'Wasa Sports Club · träning', 'gym');
  portal(w, 48.5, 57.45, 'Gå hem', 'home');
  station(w, 18.5, 17.5, 'job', 'Starta ditt extrajobb', startJobPrompt);
  station(w, 44.5, 21.5, 'photo', 'W33 · se platsbilderna', () => showPhotos(1));
  station(w, 35.5, 32.5, 'photo', 'Technobothnia · se platsbilderna', () => showPhotos(6));
  sign(w, 50.5, 12.3, 'NOVIA', 0.6, 3.1);
  sign(w, 25.5, 39.3, 'TECHNOBOTHNIA', 0.4, 1.5);
  sign(w, 25.5, 42.7, 'WASA SPORTS CLUB', 0.38, 1.55);
  sign(w, 43.5, 24, 'Wolffskavägen', 0.34, 1.2);
  sceneProp(w, 53.5, 15.2, 'towerglass', 4.3);
  for (let x = 7; x < 30; x += 3) sceneProp(w, x, 39.1, 'saw', 1.5, 2.1);
  for (let y = 29; y < 38; y += 3) sceneProp(w, 31.15, y, 'saw', 1.3, 2.1);
  sceneProp(w, 10, 30, 'chimney', 9);
  sceneProp(w, 16, 27, 'chimney', 7);
  for (const y of [23, 34, 45, 55]) sceneProp(w, 42.5, y, 'lamp', 3.7);
  placeTrees(w);
  w = makeWorld('w33', 'W33 · entréplanet', 48);
  w.grid.forEach((row) => row.fill(1));
  rect(w, 3, 16, 40, 14, 0);
  rect(w, 33, 2, 10, 15, 0);
  w.spawn = { x: 37.5, y: 27.5, a: -Math.PI / 2 };
  // Ground-floor outline and connectivity traced from EPS 2023 fig.33. 2017 plan informs the dining wing.
  rect(w, 3, 23, 25, 1, 1);
  for (const x of [9, 21, 25, 29]) rect(w, x, 24, 1, 6, 1);
  for (const x of [7, 15, 23, 27]) w.grid[23][x] = 0;
  rect(w, 3, 20, 23, 1, 1);
  w.grid[20][24] = 0;
  rect(w, 25, 16, 1, 5, 1);
  rect(w, 8, 16, 1, 4, 1);
  w.grid[19][8] = 0;
  rect(w, 33, 2, 1, 14, 1);
  for (const y of [5, 9]) {
    rect(w, 34, y, 4, 1, 1);
    w.grid[y][36] = 0;
  }
  rect(w, 38, 2, 1, 16, 1);
  for (const y of [7, 14]) w.grid[y][38] = 0;
  rect(w, 39, 12, 4, 1, 1);
  w.grid[12][40] = 0;
  rect(w, 39, 16, 4, 1, 1);
  w.grid[16][40] = 0;
  rect(w, 30, 19, 3, 2, 1);
  rect(w, 31, 25, 2, 5, 1);
  rect(w, 39, 25, 4, 1, 1);
  w.grid[25][41] = 0;
  station(w, 14.5, 26.5, 'study', '', () => study(0)).courseIndex = 0;
  lectureSpot(w, 0, ...freeSpotNear(w, 14.5, 26.5));
  station(w, 23.5, 26.5, 'exam', '', () => exam(0)).courseIndex = 0;
  station(w, 23.5, 21.5, 'food', 'Lunch · 8 €', lunch);
  station(w, 35.5, 12.5, 'party', 'Filicia Castle · fest', partyPrompt);
  doorAt(w, 37, 30);
  portal(w, 37.5, 29.55, 'Ut till Wolffskavägen', 'outdoor', { x: 54.5, y: 17.0, a: Math.PI / 2 });
  sign(w, 37, 24, 'ENTRÉ');
  sign(w, 20, 21.5, 'RESTAURANG');
  sign(w, 13, 25, 'STUDIEPLATSER');
  sign(w, 35.5, 10.5, 'FILICIA CASTLE');
  for (const p of [
    [12, 26],
    [16, 26],
    [18, 28],
    [10, 28],
    [28, 17],
    [30, 17],
    [35, 17],
    [35, 14],
    [40, 4],
    [40, 7],
    [40, 10],
    [6, 27],
  ])
    deco(w, p[0] + 0.5, p[1] + 0.5, 'desk', 0.75);
  w = makeWorld('tech', 'Technobothnia · laboratorier', 58);
  w.grid.forEach((row) => row.fill(1));
  rect(w, 2, 22, 54, 20, 0);
  rect(w, 13, 5, 23, 18, 0);
  rect(w, 26, 2, 10, 4, 0);
  w.spawn = { x: 32.5, y: 39.5, a: -Math.PI / 2 };
  // Main east-west passage, central cross-corridor and north extension from VAMK 2014 page 2.
  rect(w, 2, 37, 54, 1, 1);
  for (const x of [8, 18, 32, 43, 53]) w.grid[37][x] = 0;
  rect(w, 13, 22, 1, 15, 1);
  for (const y of [25, 32, 36]) w.grid[y][13] = 0;
  rect(w, 2, 31, 11, 1, 1);
  w.grid[31][11] = 0;
  rect(w, 4, 22, 1, 9, 1);
  w.grid[29][4] = 0;
  rect(w, 19, 26, 1, 11, 1);
  w.grid[35][19] = 0;
  rect(w, 20, 29, 10, 1, 1);
  w.grid[29][28] = 0;
  rect(w, 30, 10, 1, 27, 1);
  for (const y of [12, 19, 25, 29, 35]) w.grid[y][30] = 0;
  rect(w, 32, 29, 22, 1, 1);
  for (const x of [34, 41, 51]) w.grid[29][x] = 0;
  rect(w, 40, 30, 1, 7, 1);
  w.grid[34][40] = 0;
  rect(w, 32, 24, 24, 1, 1);
  for (const x of [35, 40, 45, 50, 54]) w.grid[24][x] = 0;
  for (const x of [36, 41, 46, 51]) rect(w, x, 22, 1, 2, 1);
  rect(w, 13, 11, 17, 1, 1);
  for (const x of [17, 22, 27]) w.grid[11][x] = 0;
  for (const x of [18, 23, 27]) rect(w, x, 5, 1, 6, 1);
  rect(w, 13, 16, 17, 1, 1);
  for (const x of [18, 29]) w.grid[16][x] = 0;
  rect(w, 18, 17, 1, 5, 1);
  w.grid[20][18] = 0;
  rect(w, 25, 12, 1, 4, 1);
  w.grid[14][25] = 0;
  for (const x of [9, 17, 24, 37, 42, 49]) {
    rect(w, x, 38, 1, 4, 1);
  }
  station(w, 45.5, 27, 'study', '', () => study(1)).courseIndex = 1;
  lectureSpot(w, 1, ...freeSpotNear(w, 45.5, 27));
  station(w, 49.5, 27, 'exam', '', () => exam(1)).courseIndex = 1;
  station(w, 24.5, 32.5, 'study', '', () => study(2)).courseIndex = 2;
  lectureSpot(w, 2, ...freeSpotNear(w, 24.5, 32.5));
  station(w, 26.5, 35.5, 'exam', '', () => exam(2)).courseIndex = 2;
  doorAt(w, 32, 42);
  portal(w, 32.5, 41.55, 'Gå ut på campus', 'outdoor', { x: 24.5, y: 40.15, a: Math.PI / 2 });
  sign(w, 32.5, 38.5, 'TECHNOBOTHNIA');
  sign(w, 23.5, 27, 'ROBOTIK');
  sign(w, 24.5, 34, 'MASKINLABB');
  sign(w, 35, 32, 'VATTENPROCESS');
  sign(w, 46, 33, 'AUTOMATION');
  sign(w, 44, 26, 'IT / ELEKTRONIK');
  for (const p of [
    [23, 27],
    [27, 27],
    [22, 33],
    [27, 33],
    [35, 33],
    [44, 32],
    [49, 34],
    [37, 26],
    [41, 26],
    [50, 26],
    [16, 8],
    [21, 8],
    [28, 8],
    [33, 18],
  ])
    deco(w, p[0] + 0.5, p[1] + 0.5, 'desk', 0.85);
  w = makeWorld('gym', 'WSC · tidigare träningsbana', 18);
  w.spawn = { x: 8.5, y: 15, a: -Math.PI / 2 };
  for (const p of [
    [3.5, 3.5],
    [7.5, 3.5],
    [11.5, 3.5],
    [14.5, 3.5],
    [3.5, 9.5],
    [7.5, 9.5],
    [11.5, 9.5],
    [14.5, 9.5],
  ])
    deco(w, ...p, 'gym', 1);
  station(w, 5.5, 6.5, 'training', 'Träna · timingövning', gymPrompt);
  station(w, 12.5, 12.5, 'rest', 'Yoga / stretch', () => {
    gain('happy', 8);
    gain('energy', 5);
    advance(45);
    toast('En lugn stund. +8 glädje, +5 energi.');
    save();
  });
  doorAt(w, 8, 17);
  portal(w, 8.5, 16.55, 'Gå ut på campus', 'outdoor', { x: 24.5, y: 41.85, a: -Math.PI / 2 });
  // Personerna placeras av schemat (js/game/people.js) när spelet startar.
}
function isWall(w, x, y) {
  return w.grid[Math.floor(y)]?.[Math.floor(x)] ?? 3;
}
function walkable(w, x, y, r = 0.18) {
  return (
    [
      [-r, -r],
      [r, -r],
      [-r, r],
      [r, r],
    ].every(([dx, dy]) => !isWall(w, x + dx, y + dy)) && !hitsSolid(w, x, y, r)
  );
}
function changeWorld(id, spawn) {
  if (homeParty && id !== 'home') endHomeParty(true);
  world = worlds[id];
  const s = spawn || world.spawn;
  Object.assign(player, s);
  pitch = 0;
  resetMotion();
  near = null;
  party = false;
  keys.clear();
  touch.x = touch.y = 0;
  close();
  sound();
  updateHUD();
  save();
}

// Träd växer bara på gräs: inte på vägar, trottoarer, i hus eller framför dörrar.
function placeTrees(w) {
  const r = seeded(2026),
    placed = [],
    blockers = w.objects.filter((o) => o.action || o.type === 'lamp' || o.type === 'sign'),
    nearWall = (x, y, d) => {
      for (let yy = Math.floor(y - d); yy <= Math.floor(y + d); yy++)
        for (let xx = Math.floor(x - d); xx <= Math.floor(x + d); xx++)
          if (w.grid[yy]?.[xx] !== 0) {
            const dx = x - clamp(x, xx, xx + 1),
              dy = y - clamp(y, yy, yy + 1);
            if (Math.hypot(dx, dy) < d) return true;
          }
      return false;
    },
    clearOf = (x, y, list, d) => list.every((o) => Math.hypot(o.x - x, o.y - y) >= d),
    nearHard = (x, y, d) => {
      for (let a = 0; a < 6.28; a += 0.8)
        if (outdoorGround(x + Math.cos(a) * d, y + Math.sin(a) * d) !== 'grass') return true;
      return false;
    };
  for (let y = 2.5; y < 61; y += 1.7)
    for (let x = 2.5; x < 61; x += 1.7) {
      const tx = x + (r() - 0.5) * 1.1,
        ty = y + (r() - 0.5) * 1.1,
        park = tx > 31 && tx < 36 && ty > 23 && ty < 53,
        chance = park ? 0.7 : 0.26;
      if (r() > chance || outdoorGround(tx, ty) !== 'grass') continue;
      if (nearHard(tx, ty, 0.7) || nearWall(tx, ty, 1.4)) continue;
      if (!clearOf(tx, ty, blockers, 2.2) || !clearOf(tx, ty, placed, park ? 2.0 : 2.6)) continue;
      if (Math.hypot(tx - w.spawn.x, ty - w.spawn.y) < 3) continue;
      placed.push({ x: tx, y: ty });
    }
  // Slumpa ordningen så att begränsningen inte bara tar träden i norr.
  for (let i = placed.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [placed[i], placed[j]] = [placed[j], placed[i]];
  }
  for (const t of placed.slice(0, 38)) {
    const pick = r(),
      park = t.x > 31 && t.x < 36;
    if (pick < (park ? 0.45 : 0.3)) deco(w, t.x, t.y, 'tree', 3.1 + r() * 0.8);
    else if (pick < (park ? 0.9 : 0.65))
      obj(w, t.x, t.y, 'tree', '', null, {
        height: 3.6 + r() * 0.9,
        sprite: birchSprite(Math.floor(r() * 3)),
      });
    else
      obj(w, t.x, t.y, 'tree', '', null, {
        height: 3.9 + r() * 1.1,
        sprite: spruceSprite(Math.floor(r() * 3)),
      });
  }
}

// Närmaste lediga punkt (gångbar och inte för nära något annat man kan använda).
function freeSpotNear(w, x, y, minGap = 1.5) {
  for (let r = 1.5; r < 6; r += 0.5)
    for (let a = 0; a < 6.28; a += 0.4) {
      const px = Math.floor(x + Math.cos(a) * r) + 0.5,
        py = Math.floor(y + Math.sin(a) * r) + 0.5;
      if (!walkable(w, px, py, 0.4)) continue;
      if (w.objects.some((o) => o.action && Math.hypot(o.x - px, o.y - py) < minGap)) continue;
      return [px, py];
    }
  return [x, y + 1];
}

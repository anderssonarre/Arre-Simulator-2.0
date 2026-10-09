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
  w = buildCampus();
  buildCentrum(); // Vasa centrum, dit bussen går (js/world/centrum.js)
  placeCampusBusStop(worlds.outdoor);
  buildOllis(); // Oliver's Inn i centrum (js/world/ollis.js)
  linkOllis();
  buildBron(); // Brändöbron mellan campus och centrum, och kartornas kanter (js/world/kartor.js)
  openMapEdges();
  placeVenues(); // bio, teater, fik ... i centrum (js/game/centrumliv.js)
  placeCarDealer(); // bilhandlaren (js/game/bilar.js)
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
  coffeeMachine(w, 34.5, 25.5);
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
  coffeeMachine(w, 28.5, 39.5);
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
  coffeeMachine(w, 13.5, 14.5);
  doorAt(w, 8, 17);
  portal(w, 8.5, 16.55, 'Gå ut på campus', 'outdoor', { x: 24.5, y: 41.85, a: -Math.PI / 2 });
  placeShops(); // kiosken och baren, se js/data/items.js
  placeKubb(); // kubb på sommaren och pubquiz på Filicia, se js/game/play.js
  placeQuiz();
  placeSauna(); // bastun på WSC och pulkabacken, se js/game/evenemang.js
  placeSled();
  placePaperStand(); // campustidningen, se js/net/paper.js
  linkCampusExits();
  // Personerna placeras av schemat (js/game/people.js) när spelet startar.
}
function isWall(w, x, y) {
  if (w.mask) return maskAt(w, x, y);
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
  // Bilen kan bara köras på kartorna ute (inte in i hus): den parkeras först.
  if (driving && !KARTGEO[id]) stopDriving(true);
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
  tutorialDone('world:' + id);
  leftWorld(id);
  updateHUD();
  save();
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

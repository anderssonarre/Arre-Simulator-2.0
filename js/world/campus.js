// Bygger campus kring Wolffskavägen från kartdatan i js/data/campus.js (OpenStreetMap).
'use strict';
// Markslag i marklagret (samma nummer som i tools/campus/bygg_karta.py).
const GROUND = { PAVING: 0, GRASS: 1, ASPHALT: 2, PAINT: 3, PARKING: 4, CURB: 5 };
const MASK_RES = 4;
// Hemmet är påhittat och ligger i västra kanten av kartan.
const HOME_HOUSE = {
  name: 'Hemma',
  type: 'home',
  h: 5.6,
  rings: [
    {
      inner: false,
      pts: [
        [4, 62],
        [16.5, 62],
        [16.5, 68],
        [4, 68],
      ],
    },
  ],
};

function decodeGround(C) {
  const n = C.size * C.groundRes,
    out = new Uint8Array(n * n);
  let i = 0;
  for (const run of C.ground.split('.')) {
    const v = +run[0],
      count = parseInt(run.slice(1), 16);
    out.fill(v, i, i + count);
    i += count;
  }
  return out;
}
function groundAt(w, x, y) {
  const r = w.groundRes,
    n = w.size * r,
    px = Math.floor(x * r),
    py = Math.floor(y * r);
  if (px < 0 || py < 0 || px >= n || py >= n) return GROUND.GRASS;
  return w.ground[py * n + px];
}
// Hängande gatlampa i vajer över gatan, som längs Wolffskavägen.
function hangingLampSprite() {
  if (cache.hanglamp) return cache.hanglamp;
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 60;
  const g = c.getContext('2d');
  g.strokeStyle = '#3a3f44';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, 8);
  g.quadraticCurveTo(80, 20, 160, 8);
  g.stroke();
  g.fillStyle = '#c9ccc8';
  g.beginPath();
  g.ellipse(80, 30, 16, 9, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = '#f4f0de';
  g.fillRect(70, 30, 20, 4);
  g.fillStyle = '#3a3f44';
  g.fillRect(79, 14, 2, 8);
  cache.hanglamp = c;
  return c;
}
// Skylt med bokstäver direkt på fasaden (ingen bakgrund).
function letterSprite(text, color = '#f2f0ea', font = '600 64px Georgia, serif') {
  const key = 'letters' + text + color;
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas'),
    g = c.getContext('2d');
  g.font = font;
  c.width = Math.ceil(g.measureText(text).width) + 16;
  c.height = 84;
  g.font = font;
  g.fillStyle = '#00000044';
  g.textBaseline = 'middle';
  g.fillText(text, 10, 46);
  g.fillStyle = color;
  g.fillText(text, 8, 44);
  cache[key] = c;
  return c;
}
// Vit skylt med mörk text, som på Technobothnias tak.
function boardSprite(text) {
  const key = 'board' + text;
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas'),
    g = c.getContext('2d');
  g.font = '700 46px system-ui';
  c.width = Math.ceil(g.measureText(text).width) + 40;
  c.height = 70;
  g.fillStyle = '#f2f1ec';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#c9c7bf';
  g.lineWidth = 3;
  g.strokeRect(2, 2, c.width - 4, c.height - 4);
  g.font = '700 46px system-ui';
  g.fillStyle = '#1f3a4a';
  g.textBaseline = 'middle';
  g.fillText(text, 20, 37);
  cache[key] = c;
  return c;
}
function buildCampus() {
  const C = CAMPUS,
    N = C.size,
    w = makeWorld('outdoor', 'Wolffskavägen · campus', N, true);
  w.groundRes = C.groundRes;
  w.ground = decodeGround(C);
  w.maskRes = MASK_RES;
  w.mask = new Uint8Array(N * MASK_RES * N * MASK_RES);
  w.segments = [];
  w.houses = [...C.houses, HOME_HOUSE];
  w.wallHeight = 2.4;
  // Hus: fast mark och väggsegment.
  for (const h of w.houses) {
    fillMask(
      w,
      h.rings.map((r) => r.pts),
      1,
      MASK_RES,
    );
    for (const r of h.rings)
      r.pts.forEach(([ax, ay], i) => {
        const [bx, by] = r.pts[(i + 1) % r.pts.length];
        addSegment(w, ax, ay, bx, by, h.h, h.type, { house: h.name });
      });
  }
  // Murar och häckar: låga väggar som syns från båda håll.
  for (const wl of C.walls) {
    const type = wl.kind === 'hedge' ? 'hedge' : 'stonewall';
    for (let i = 0; i + 1 < wl.pts.length; i++) {
      const [ax, ay] = wl.pts[i],
        [bx, by] = wl.pts[i + 1];
      addSegment(w, ax, ay, bx, by, wl.h, type, { low: true });
      const L = Math.hypot(bx - ax, by - ay);
      for (let t = 0; t <= L; t += 0.1) {
        const x = ax + ((bx - ax) * t) / L,
          y = ay + ((by - ay) * t) / L,
          m = N * MASK_RES;
        for (const [dx, dy] of [
          [0, 0],
          [0.12, 0],
          [-0.12, 0],
          [0, 0.12],
          [0, -0.12],
        ]) {
          const px = Math.floor((x + dx) * MASK_RES),
            py = Math.floor((y + dy) * MASK_RES);
          if (px >= 0 && py >= 0 && px < m && py < m) w.mask[py * m + px] = 2;
        }
      }
    }
  }
  // Kartans kant: en häck runt hela området.
  const e = 0.3;
  for (const [ax, ay, bx, by] of [
    [e, e, N - e, e],
    [N - e, e, N - e, N - e],
    [N - e, N - e, e, N - e],
    [e, N - e, e, e],
  ])
    addSegment(w, ax, ay, bx, by, 1.1, 'hedge', { low: true, edge: true });
  // Dörrar (innan segmenten indexeras, eftersom väggen delas där dörren sitter).
  const doors = {
    w33Corner: cutDoor(w, 106, 103.7, 1.2),
    w33Side: cutDoor(w, 100.7, 86, 1.1),
    techno: cutDoor(w, 76.7, 140.5, 1.2),
    wsc: cutDoor(w, 62.5, 195.5, 1.2),
    home: cutDoor(w, 10.25, 68, 1),
  };
  indexSegments(w);
  // Rutnätet används för vägsökning och sikt: en ruta är spärrad om något av den är hus.
  const m = N * MASK_RES;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let solid = 0;
      for (let j = 0; j < MASK_RES && !solid; j++)
        for (let i = 0; i < MASK_RES && !solid; i++)
          solid = w.mask[(y * MASK_RES + j) * m + x * MASK_RES + i];
      w.grid[y][x] = solid ? 1 : 0;
    }
  // Portaler framför dörrarna.
  const at = (d, k = 0.6) => [d.x + d.nx * k, d.y + d.ny * k];
  w.doors = doors;
  portal(w, ...at(doors.w33Corner), 'W33 · huvudentrén', 'w33');
  portal(w, ...at(doors.w33Side), 'W33 · sidoingången', 'w33');
  portal(w, ...at(doors.techno), 'Technobothnia · gå in', 'tech');
  portal(w, ...at(doors.wsc), 'Wasa Sports Club · träning', 'gym');
  portal(w, ...at(doors.home), 'Gå hem', 'home');
  const out = at(doors.home, 1.2);
  w.spawn = { x: out[0], y: out[1], a: Math.atan2(doors.home.ny, doors.home.nx) };
  // Skärmtak och trappa vid W33:s två ingångar (som på bilderna).
  const stone = [176, 172, 164],
    canopy = [196, 198, 194];
  // Huvudentrén på hörnet, mot korsningen (söder).
  addBox(w, 104.1, 103.7, 107.9, 105.2, 1.55, 1.66, { color: canopy, solid: false });
  addBox(w, 104.15, 104.95, 104.4, 105.2, 0, 1.55, { color: [210, 206, 198] });
  addBox(w, 107.6, 104.95, 107.85, 105.2, 0, 1.55, { color: [210, 206, 198] });
  addBox(w, 104.4, 103.7, 107.6, 104.5, 0, 0.08, { color: stone, solid: false });
  // Sidoingången mot Wolffskavägen (väster), med trappa.
  addBox(w, 99.3, 84.9, 100.7, 87.1, 1.55, 1.65, { color: canopy, solid: false });
  addBox(w, 99.35, 86.75, 99.6, 87.0, 0, 1.55, { color: [210, 206, 198] });
  for (let k = 0; k < 3; k++)
    addBox(w, 99.6 + k * 0.3, 85.2, 100.7, 86.8, 0, 0.09 * (k + 1), { color: stone, solid: false });
  buildMirrorBoxes(w);
  // Skyltar på fasaderna.
  obj(w, 103.55, 103.9, 'sign', '', null, { height: 0.42, z: 6.4, sprite: letterSprite('NOVIA') });
  obj(w, 81.3, 136, 'sign', '', null, {
    height: 0.36,
    z: 5.3,
    sprite: boardSprite('TECHNOBOTHNIA'),
  });
  // Fabrikens två skorstenar bakom Fabriikki.
  sceneProp(w, 9, 141, 'chimney', 17);
  sceneProp(w, 20, 147, 'chimney', 14);
  // Träd från kartan (inte där hemmet står).
  const r = seeded(4711);
  for (const [x, y] of C.trees) {
    if (maskAt(w, x, y)) continue;
    const pick = r();
    if (pick < 0.5)
      obj(w, x, y, 'tree', '', null, {
        height: 6 + r() * 1.6,
        sprite: propSprite('tree'),
        kind: 'leafy',
      });
    else if (pick < 0.8)
      obj(w, x, y, 'tree', '', null, {
        height: 7 + r() * 2,
        sprite: birchSprite(Math.floor(r() * 3)),
        kind: 'birch',
      });
    else
      obj(w, x, y, 'tree', '', null, {
        height: 7 + r() * 2.5,
        sprite: spruceSprite(Math.floor(r() * 3)),
        kind: 'spruce',
      });
  }
  // Gatlampor i vajer.
  for (const [x, y] of C.lamps)
    obj(w, x, y, 'lamp', '', null, { height: 0.5, z: 4.9, sprite: hangingLampSprite() });
  // Extrajobbet och platsbilderna.
  station(w, ...freeSpotNear(w, 72, 176), 'job', 'Jobbtavlan · sök jobb och jobba ett pass', jobBoard);
  station(w, ...freeSpotNear(w, 97, 106), 'photo', 'W33 · se platsbilderna', () => showPhotos(1));
  station(w, ...freeSpotNear(w, 84, 142), 'photo', 'Technobothnia · se platsbilderna', () =>
    showPhotos(6),
  );
  // Utgångar från kartan (där gatorna går ut), för personer som kommer och går.
  w.exits = [];
  for (let k = 2; k < N - 2; k++)
    for (const [x, y] of [
      [k + 0.5, 1.5],
      [k + 0.5, N - 1.5],
      [1.5, k + 0.5],
      [N - 1.5, k + 0.5],
    ])
      if (
        groundAt(w, x, y) === GROUND.ASPHALT &&
        !w.exits.some(([a, b]) => Math.hypot(a - x, b - y) < 12)
      )
        w.exits.push([x, y]);
  // Bara utgångar som går att gå från till W33 (inte instängda gårdar).
  const target = doors.w33Corner;
  w.exits = w.exits.filter(([x, y]) =>
    findPath(w, x, y, target.x + target.nx, target.y + target.ny),
  );
  return w;
}
// Var man hamnar ute när man går ut ur ett hus: framför den första dörren som leder dit.
function outdoorSpawnFor(fromWorld) {
  const o = worlds.outdoor.objects.find((p) => p.type === 'portal' && p.target === fromWorld);
  if (!o) return worlds.outdoor.spawn;
  const d = Object.values(worlds.outdoor.doors).find((d) => Math.hypot(d.x - o.x, d.y - o.y) < 1.5);
  const a = d ? Math.atan2(d.ny, d.nx) : 0;
  return { x: o.x + Math.cos(a) * 0.6, y: o.y + Math.sin(a) * 0.6, a };
}
// Kopplar inomhusvärldarnas utgångar till rätt dörr på campus.
function linkCampusExits() {
  for (const id of ['w33', 'tech', 'gym', 'home'])
    for (const o of worlds[id].objects)
      if (o.type === 'portal' && o.target === 'outdoor')
        o.action = () => changeWorld('outdoor', outdoorSpawnFor(id));
}

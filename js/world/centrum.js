// Vasa centrum: torget, esplanaderna, stadshuset och Trefaldighetskyrkan, i verklig skala från
// OpenStreetMap (js/data/centrum.js, byggd av tools/centrum/bygg_karta.py). Man tar bussen hit
// från campus. Butiker och busshållplatser finns i js/data/centrum-platser.js.
'use strict';
// Var en namngiven plats (busshållplats, kafé ...) från kartan ligger, eller null.
function centrumPoi(name) {
  const p = CENTRUM.pois.find((q) => q.name === name);
  return p ? [p.x, p.y] : null;
}
function centrumHouse(name) {
  return CENTRUM.houses.find((h) => h.name === name);
}
// Närmaste ställe man kan stå på, inom en radie.
function nearestFree(w, x, y, maxR = 24, r0 = 0.45) {
  for (let r = 0; r < maxR; r += 0.5)
    for (let a = 0; a < 6.28; a += 0.25) {
      const px = Math.floor(x + Math.cos(a) * r) + 0.5,
        py = Math.floor(y + Math.sin(a) * r) + 0.5;
      if (walkable(w, px, py, r0)) return [px, py];
    }
  return [x, y];
}
function busStopSprite() {
  if (cache.busStop) return cache.busStop;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#5d6266';
  g.fillRect(29, 40, 6, 120);
  g.fillStyle = '#f2c230';
  g.beginPath();
  g.arc(32, 30, 26, 0, 7);
  g.fill();
  g.fillStyle = '#1d3b5a';
  g.beginPath();
  g.arc(32, 30, 21, 0, 7);
  g.fill();
  g.fillStyle = '#f2c230';
  g.font = 'bold 26px system-ui';
  g.textAlign = 'center';
  g.fillText('H', 32, 40);
  g.fillStyle = '#eef0ee';
  g.fillRect(16, 66, 32, 22);
  g.fillStyle = '#1d3b5a';
  g.font = 'bold 11px system-ui';
  g.fillText('BUSS', 32, 81);
  cache.busStop = c;
  return c;
}
// Svenska namn på statyerna (kartan har dem på finska).
const STATYNAMN = { 'Suomen Vapaudenpatsas': 'Frihetsstatyn', 'Vaasan Jaakkoo': 'Vasa-Jaakko' };
function statueSprite() {
  if (cache.statue) return cache.statue;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d'),
    gr = g.createLinearGradient(0, 0, 64, 0);
  gr.addColorStop(0, '#2f4a40');
  gr.addColorStop(0.5, '#4f7363');
  gr.addColorStop(1, '#263a33');
  g.fillStyle = gr;
  // En stående figur i ärgad brons.
  g.beginPath();
  g.arc(32, 16, 10, 0, 7);
  g.fill();
  g.fillRect(20, 26, 24, 50);
  g.fillRect(12, 30, 9, 34);
  g.fillRect(43, 30, 9, 34);
  g.fillRect(22, 76, 9, 50);
  g.fillRect(33, 76, 9, 50);
  cache.statue = c;
  return c;
}
function buildCentrum() {
  const C = CENTRUM,
    w = osmWorld('centrum', 'Vasa centrum', C);
  // Dörrar (innan segmenten indexeras): Oliver's Inn, se js/world/ollis.js.
  w.doors = { ollis: ollisDoor(w) };
  osmGrid(w);
  // Trefaldighetskyrkans torn över den smala norra delen av kyrkan (ungefärlig höjd).
  const church = centrumHouse('Trefaldighetskyrkan');
  if (church) {
    const pts = church.rings[0].pts,
      minY = Math.min(...pts.map((p) => p[1])),
      base = pts.filter((p) => p[1] < minY + 5.5),
      x0 = Math.min(...base.map((p) => p[0])),
      x1 = Math.max(...base.map((p) => p[0])),
      y1 = minY + 5.2,
      red = [150, 66, 48],
      roof = [70, 86, 82];
    addBox(w, x0, minY, x1, y1, church.h, 18, { color: red, solid: false });
    // Spiran: allt smalare lådor upp till cirka 50 meter.
    const cx = (x0 + x1) / 2,
      cy = (minY + y1) / 2;
    for (let k = 0; k < 6; k++) {
      const half = ((x1 - x0) / 2) * (0.7 - k * 0.11);
      addBox(w, cx - half, cy - half, cx + half, cy + half, 18 + k * 2, 20 + k * 2, { color: roof, solid: false });
    }
    obj(w, cx, cy, 'sign', '', null, { height: 0.8, z: 30, sprite: letterSprite('✝', '#d8c67a') });
  }
  // Busshållplatsen vid torget (Tori 1). Bussen går till campus.
  const [bx, by] = nearestFree(w, ...(centrumPoi('Tori 1') || [w.size / 2, w.size / 2]));
  placeBusStop(w, bx, by, 'Torget');
  w.spawn = { x: bx, y: by - 1.2, a: -Math.PI / 2 };
  // Torget: där folk står och går, och var torgstånden står på sommaren.
  const torg = nearestFree(w, -C.origin[0] / C.meterPerTile, -C.origin[1] / C.meterPerTile);
  w.npcSpots = [
    torg,
    [torg[0] - 6, torg[1] + 6],
    [torg[0] + 8, torg[1] - 4],
    ...['Espresso House', 'Cafe Espen', 'Görans Café', 'Amore']
      .map(centrumPoi)
      .filter(Boolean),
  ];
  osmTreesAndLamps(w, C, 1606);
  // Statyer och minnesmärken (sockel i granit, figur i brons) och fontänerna vid torget.
  for (const p of C.pois) {
    if (p.kind === 'monument') {
      if (maskAt(w, p.x, p.y)) continue;
      addBox(w, p.x - 0.5, p.y - 0.5, p.x + 0.5, p.y + 0.5, 0, 1.1, { color: [128, 126, 122] });
      obj(w, p.x, p.y, 'statue', STATYNAMN[p.name] || p.name, null, {
        height: 1.25,
        z: 1.1,
        sprite: statueSprite(),
      });
    } else if (p.kind === 'fountain' && !maskAt(w, p.x, p.y)) {
      addBox(w, p.x - 0.7, p.y - 0.7, p.x + 0.7, p.y + 0.7, 0, 0.3, { color: [150, 148, 142] });
      addBox(w, p.x - 0.55, p.y - 0.55, p.x + 0.55, p.y + 0.55, 0.3, 0.31, { color: [86, 128, 150], solid: false });
    }
  }
  // Julgranen på torget, bara i december (evenemang.js visar och gömmer den).
  obj(w, torg[0], torg[1] - 3, 'xmastree', 'Julgranen på torget', null, {
    height: 11,
    sprite: spruceSprite(0),
    månad: 3,
    hidden: true,
  });
  // Torgstånd: står på torget varje dag, med markiser i olika färger.
  const colors = [
    [176, 52, 46],
    [226, 226, 220],
    [44, 92, 150],
    [222, 168, 52],
  ];
  for (let i = 0; i < 6; i++) {
    const [sx, sy] = nearestFree(w, torg[0] - 7 + (i % 3) * 7, torg[1] + 2 + Math.floor(i / 3) * 7, 4, 1.2);
    addBox(w, sx - 0.9, sy - 0.6, sx + 0.9, sy + 0.6, 0, 0.55, { color: [120, 92, 64] });
    addBox(w, sx - 1.1, sy - 0.8, sx + 1.1, sy + 0.8, 1.25, 1.35, { color: colors[i % 4], solid: false });
  }
  placeCentrumShops(w);
  osmExits(w, [bx, by]);
  return w;
}
// Torgstånd på sommaren mitt på dagen, och butiker från platsfilen.
function placeCentrumShops(w) {
  for (const [id, b] of Object.entries(BUTIKER)) {
    if (b.värld !== 'centrum' || !b.poi) continue;
    const p = centrumPoi(b.poi) || (b.hus && centroid(centrumHouse(b.hus)));
    if (p) [b.x, b.y] = nearestFree(w, p[0], p[1]);
    else console.warn('Butik ' + id + ': hittar inte ' + (b.poi || b.hus) + ' på kartan');
  }
}
function centroid(h) {
  if (!h) return null;
  const pts = h.rings[0].pts;
  return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
}

// ---- Bussen mellan campus, centrum och Vasklot ----
// En hållplats per karta (BUSS.hållplatser). Bussen kostar en slant och tar några minuter.
const BUSSLINJE = ['outdoor', 'centrum', 'vasklot'];
const BUSSNAMN = { outdoor: 'Campus (W33)', centrum: 'Torget i centrum', vasklot: 'Wärtsilä i Vasklot' };
function placeBusStop(w, x, y, namn) {
  const others = BUSSLINJE.filter((id) => id !== w.id),
    o = portal(w, x, y, 'Busshållplats ' + namn + ' · ' + BUSS.pris + ' €', others[0]);
  o.busStop = true;
  o.action = busMenu;
  // Osynliga vägar för personerna till de andra hållplatserna (de har ingen egen knapp).
  for (const id of others.slice(1))
    w.objects.push({ x, y, type: 'portal', target: id, hidden: true, busStop: true, label: '', action: null });
  obj(w, x + 0.6, y, 'busstop', '', null, { height: 2.2, sprite: busStopSprite() });
}
function busMinutes(to) {
  const a = worlds[world.id] && KARTGEO[world.id] ? tileToGeo(world.id, player.x, player.y) : tileToGeo('outdoor', 100, 100),
    s = worlds[to].objects.find((o) => o.busStop && o.action),
    b = tileToGeo(to, s.x, s.y),
    km = Math.hypot((a[0] - b[0]) * 110.54, ((a[1] - b[1]) * kx(a[0])) / 1000);
  return Math.max(BUSS.minuter, Math.round((km / 25) * 60) + 6);
}
function busMenu() {
  dialog(
    'Bussen',
    '<p>Vart vill du åka? Biljetten kostar ' + BUSS.pris + ' €.</p>',
    [
      ...BUSSLINJE.filter((id) => id !== world.id && worlds[id]).map((id) => ({
        label: BUSSNAMN[id] + ' · ' + busMinutes(id) + ' min',
        primary: true,
        run: () => takeBus(id),
      })),
      { label: 'Inte nu', run: close },
    ],
    'Buss',
  );
}
function takeBus(to) {
  if (state.money < BUSS.pris) return toast('Bussen kostar ' + BUSS.pris + ' €. Du har inte råd, du får gå.');
  state.money -= BUSS.pris;
  advance(busMinutes(to));
  const stop = worlds[to].objects.find((o) => o.busStop && o.action);
  sound('tap');
  changeWorld(to, stop ? { x: stop.x, y: stop.y - 1.2, a: -Math.PI / 2 } : undefined);
  toast('Framme: ' + BUSSNAMN[to] + '.');
  questEvent('buss');
}
// Hållplatsen på campus (anropas från buildCampus).
function placeCampusBusStop(w) {
  const [x, y] = nearestFree(w, BUSS.campus.x, BUSS.campus.y, 10);
  placeBusStop(w, x, y, 'W33');
}

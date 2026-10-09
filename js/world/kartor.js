// Kartorna från OpenStreetMap hänger ihop: campus, Brändöbron och Vasa centrum ligger där de
// ligger i verkligheten, så man kan gå från W33 längs Wolffskavägen, över Brändöbron och ner
// längs Kyrkoesplanaden till torget. När du närmar dig kanten av en karta och marken fortsätter
// på nästa karta byter spelet karta, på samma ställe i verkligheten.
'use strict';
// Varje kartas läge: origo (lat, lon) och hur mycket den är vriden (grader).
const KARTGEO = {
  outdoor: { lat: 63.1055, lon: 21.595, vrid: 42.7, data: () => CAMPUS },
  bron: { lat: 63.1055, lon: 21.595, vrid: 42.7, data: () => BRON },
  centrum: { lat: 63.09572, lon: 21.61578, vrid: 21.7, data: () => CENTRUM },
};
const KY_M = 110540;
const kx = (lat) => Math.cos((lat * Math.PI) / 180) * 111320;
// Ruta i en karta -> latitud och longitud, och tillbaka.
function tileToGeo(id, tx, ty) {
  const G = KARTGEO[id],
    C = G.data(),
    v = (G.vrid * Math.PI) / 180,
    X = C.origin[0] + tx * C.meterPerTile,
    Y = C.origin[1] + ty * C.meterPerTile,
    x = X * Math.cos(v) + Y * Math.sin(v),
    y = -X * Math.sin(v) + Y * Math.cos(v);
  return [G.lat - y / KY_M, G.lon + x / kx(G.lat)];
}
function geoToTile(id, lat, lon) {
  const G = KARTGEO[id],
    C = G.data(),
    v = (G.vrid * Math.PI) / 180,
    x = (lon - G.lon) * kx(G.lat),
    y = -(lat - G.lat) * KY_M,
    X = x * Math.cos(v) - y * Math.sin(v),
    Y = x * Math.sin(v) + y * Math.cos(v);
  return [(X - C.origin[0]) / C.meterPerTile, (Y - C.origin[1]) / C.meterPerTile];
}
const EDGE = 2.2, // så nära kanten man kommer innan kartan byts
  CORE = 3.5; // så långt in på nästa karta man måste hamna
// Var samma ställe ligger på en annan karta där man kan stå, eller null.
function continuesIn(fromId, tx, ty) {
  const [lat, lon] = tileToGeo(fromId, tx, ty);
  for (const id of Object.keys(KARTGEO)) {
    if (id === fromId || !worlds[id]) continue;
    const [x, y] = geoToTile(id, lat, lon),
      n = worlds[id].size;
    if (x < CORE || y < CORE || x > n - CORE || y > n - CORE) continue;
    if (!walkable(worlds[id], x, y, 0.3)) continue;
    return { id, x, y };
  }
  return null;
}
// Körs varje bildruta: byter karta när du går över kanten.
function mapLinkTick() {
  if (!world || !KARTGEO[world.id] || modal || job) return;
  const n = world.size,
    { x, y } = player;
  if (x > EDGE && y > EDGE && x < n - EDGE && y < n - EDGE) return;
  const to = continuesIn(world.id, x, y);
  if (!to) return;
  const turn = ((KARTGEO[to.id].vrid - KARTGEO[world.id].vrid) * Math.PI) / 180,
    keep = { vx: motion.vx, vy: motion.vy },
    a = player.a + turn;
  changeWorld(to.id, { x: to.x, y: to.y, a });
  // Fortsätt gå i samma riktning, utan att stanna upp.
  const c = Math.cos(turn),
    s = Math.sin(turn);
  motion.vx = keep.vx * c - keep.vy * s;
  motion.vy = keep.vx * s + keep.vy * c;
  toast(world.name);
}
// Kanthäcken ritas bara där kartan verkligen tar slut (inte där den fortsätter på nästa).
function openMapEdges() {
  for (const id of Object.keys(KARTGEO)) {
    const w = worlds[id];
    if (!w?.segments) continue;
    const n = w.size,
      e = 0.3;
    w.segments = w.segments.filter((s) => !s.edge);
    const piece = (ax, ay, bx, by, ox, oy) => {
      if (!continuesIn(id, (ax + bx) / 2 + ox, (ay + by) / 2 + oy))
        addSegment(w, ax, ay, bx, by, 1.1, 'hedge', { low: true, edge: true });
    };
    for (let k = 0; k < n; k += 2) {
      const k2 = Math.min(n, k + 2);
      piece(k + e, e, k2 - e, e, 0, 1.5);
      piece(k + e, n - e, k2 - e, n - e, 0, -1.5);
      piece(e, k + e, e, k2 - e, 1.5, 0);
      piece(n - e, k + e, n - e, k2 - e, -1.5, 0);
    }
    indexSegments(w);
  }
}

// ---- Brändöbron ----
function buildBron() {
  const C = BRON,
    w = osmWorld('bron', 'Brändöbron · Wolffskavägen', C);
  osmGrid(w);
  osmTreesAndLamps(w, C, 1852);
  // Mitt på bron, med utsikt över sundet.
  const [lat, lon] = [63.1024, 21.6016], // Brändöbron (Palosaaren silta), samma ställe på Google Maps och i kartdatan
    [bx, by] = geoToTile('bron', lat, lon);
  const [sx, sy] = nearestFree(w, bx, by, 12);
  w.spawn = { x: sx, y: sy, a: Math.PI / 2 };
  w.npcSpots = [[sx, sy]];
  return w;
}
// Bron som plats för sidouppdrag (se PLATSER i js/data/quests.js).
{
  const [x, y] = geoToTile('bron', 63.1024, 21.6016);
  PLATSER.brandobron = { värld: 'bron', x, y, namn: 'på Brändöbron' };
}

// Vasklot (Vaskiluoto): hamnen, kraftverket och Wärtsilä Sustainable Technology Hub, där
// motorerna byggs. Jennifer jobbar här. Kartan kommer från OpenStreetMap
// (tools/centrum/bygg_karta.py vasklot) och läget är kontrollerat mot Google Maps
// (Frilundsvägen 5). Man kommer hit med bussen, Uber eller taxi.
'use strict';
const WARTSILA = { lat: 63.0920302, lon: 21.5616613 }; // Frilundsvägen 5, huvudentrén
function buildVasklot() {
  const C = VASKLOT,
    w = osmWorld('vasklot', 'Vasklot · Wärtsilä', C);
  osmGrid(w);
  osmTreesAndLamps(w, C, 1834);
  // Hållplatsen vid huvudentrén.
  const [ex, ey] = geoToTile('vasklot', WARTSILA.lat, WARTSILA.lon),
    [bx, by] = nearestFree(w, ex, ey, 20, 0.5);
  placeBusStop(w, bx, by, 'Wärtsilä');
  w.spawn = { x: bx, y: by - 1.2, a: -Math.PI / 2 };
  // Skylten på fasaden och grinden in till fabriken.
  const hub = w.houses.find((h) => h.name === 'Wärtsilä Sustainable Technology Hub');
  if (hub) {
    const pts = hub.rings[0].pts,
      cx = pts.reduce((a, p) => a + p[0], 0) / pts.length,
      cy = pts.reduce((a, p) => a + p[1], 0) / pts.length,
      [sx, sy] = nearestFree(w, cx, cy, 40, 0.5);
    obj(w, sx, sy, 'sign', '', null, { height: 0.6, z: 7, sprite: boardSprite('WÄRTSILÄ') });
    station(w, ...nearestFree(w, sx + 1.5, sy, 6, 0.5), 'job', 'Wärtsilä · ta ett skift i motorproduktionen', wartsilaShift);
    w.npcSpots = [
      [sx, sy],
      [sx + 2, sy + 1],
      [sx - 2, sy + 1],
    ];
  }
  return w;
}
// Ett skift på Wärtsilä är jobbet Fabriksskift (js/data/jobs.js). Har man inte jobbet får man
// söka det på jobbtavlan.
function wartsilaShift() {
  if (!hasJob('fabrik')) return toast('Du jobbar inte här. Sök "' + JOBB.fabrik.namn + '" på jobbtavlan.');
  const why = shiftProblem('fabrik');
  if (why) return toast(why);
  jobPrompt('fabrik');
}
// Platsen för sidouppdrag.
{
  PLATSER.wartsila = { värld: 'vasklot', x: 0, y: 0, namn: 'vid Wärtsilä i Vasklot' };
  const set = () => {
    const [x, y] = geoToTile('vasklot', WARTSILA.lat, WARTSILA.lon);
    Object.assign(PLATSER.wartsila, { x, y });
  };
  set();
}

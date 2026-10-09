// Stora kartan (M): campus, Brändöbron och Vasa centrum ihopsatta med norr uppåt, som i
// verkligheten. Visar var du är, kompisar online, din bil, uppdrag och ställen. Dra för att
// flytta, scrolla (eller nyp) för att zooma. M eller Esc stänger.
'use strict';
const BIGMAP = { open: false, zoom: 1.4, cx: 0, cy: 0, bases: {}, drag: null };
const BM_PX = 2; // pixlar per ruta i kartbilderna
// Gemensamt koordinatsystem: meter från torget, x österut och y söderut (norr uppåt).
const BM_ORIGIN = { lat: 63.09572, lon: 21.61578 };
function geoToMeters(lat, lon) {
  return [(lon - BM_ORIGIN.lon) * kx(BM_ORIGIN.lat), -(lat - BM_ORIGIN.lat) * KY_M];
}
function tileToMeters(id, x, y) {
  return geoToMeters(...tileToGeo(id, x, y));
}
// En bild av en karta (mark, vatten och hus), ritas en gång.
function bigMapBase(id) {
  if (BIGMAP.bases[id]) return BIGMAP.bases[id];
  const w = worlds[id],
    n = w.size,
    c = document.createElement('canvas');
  c.width = c.height = n * BM_PX;
  const g = c.getContext('2d'),
    img = g.createImageData(c.width, c.height),
    COL = [
      [214, 210, 200], // plattor
      [150, 186, 120], // gräs
      [92, 96, 100], // asfalt
      [230, 230, 222], // målning
      [120, 124, 128], // parkering
      [160, 160, 156], // kantsten
      [96, 150, 190], // vatten
    ];
  for (let py = 0; py < c.height; py++)
    for (let px = 0; px < c.width; px++) {
      const v = groundAt(w, (px + 0.5) / BM_PX, (py + 0.5) / BM_PX),
        col = COL[v] || COL[0],
        i = (py * c.width + px) * 4;
      img.data[i] = col[0];
      img.data[i + 1] = col[1];
      img.data[i + 2] = col[2];
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  g.fillStyle = '#b5826e';
  g.strokeStyle = '#6f4a3c';
  g.lineWidth = 1;
  for (const h of w.houses || []) {
    g.beginPath();
    for (const r of h.rings) r.pts.forEach(([x, y], k) => (k ? g.lineTo(x * BM_PX, y * BM_PX) : g.moveTo(x * BM_PX, y * BM_PX)));
    g.fill('evenodd');
    g.stroke();
  }
  return (BIGMAP.bases[id] = c);
}
// Var du är i verkligheten (inne i ett hus: vid husets dörr).
function playerMeters() {
  if (KARTGEO[world.id]) return tileToMeters(world.id, player.x, player.y);
  if (world.id === 'home' || world.id === 'trapphus') {
    const d = myHomeDoorSpot();
    return tileToMeters(d.world, d.x, d.y);
  }
  const id = world.id === 'ollis' ? 'centrum' : 'outdoor',
    p = id === 'centrum' ? worlds.centrum.objects.find((o) => o.target === 'ollis') : outdoorSpawnFor(world.id);
  return tileToMeters(id, p.x, p.y);
}
function openBigMap() {
  if (!active || !state || (modal && !BIGMAP.open)) return;
  if (BIGMAP.open) return closeBigMap();
  let el = $('bigMap');
  if (!el) {
    el = document.createElement('div');
    el.id = 'bigMap';
    el.innerHTML =
      '<canvas></canvas><div class="bmHead glass"><b>Karta</b><span class="sub">Dra för att flytta · scrolla för att zooma · M stänger</span><button id="bmClose">Stäng</button></div>';
    document.body.appendChild(el);
    $('bmClose').onclick = closeBigMap;
    const cv = el.querySelector('canvas');
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      BIGMAP.zoom = clamp(BIGMAP.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 0.25, 8);
      drawBigMap();
    });
    cv.addEventListener('pointerdown', (e) => {
      BIGMAP.drag = { x: e.clientX, y: e.clientY, cx: BIGMAP.cx, cy: BIGMAP.cy, pts: new Map([[e.pointerId, e]]) };
      capture(cv, e.pointerId);
    });
    cv.addEventListener('pointermove', (e) => {
      const d = BIGMAP.drag;
      if (!d) return;
      d.pts.set(e.pointerId, e);
      if (d.pts.size === 2) {
        // Nyp för att zooma på pekskärm.
        const [a, b] = [...d.pts.values()],
          dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (d.pinch) BIGMAP.zoom = clamp(BIGMAP.zoom * (dist / d.pinch), 0.25, 8);
        d.pinch = dist;
      } else {
        BIGMAP.cx = d.cx - (e.clientX - d.x) / BIGMAP.zoom;
        BIGMAP.cy = d.cy - (e.clientY - d.y) / BIGMAP.zoom;
      }
      drawBigMap();
    });
    const end = (e) => {
      BIGMAP.drag?.pts.delete(e.pointerId);
      if (!BIGMAP.drag?.pts.size) BIGMAP.drag = null;
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
  }
  [BIGMAP.cx, BIGMAP.cy] = playerMeters();
  BIGMAP.open = true;
  modal = true;
  el.hidden = false;
  drawBigMap();
  BIGMAP.timer = setInterval(drawBigMap, 500);
}
function closeBigMap() {
  BIGMAP.open = false;
  modal = false;
  clearInterval(BIGMAP.timer);
  const el = $('bigMap');
  if (el) el.hidden = true;
}
function drawBigMap() {
  const el = $('bigMap'),
    cv = el?.querySelector('canvas');
  if (!cv || !BIGMAP.open) return;
  const W = (cv.width = el.clientWidth * (devicePixelRatio || 1)),
    H = (cv.height = el.clientHeight * (devicePixelRatio || 1)),
    g = cv.getContext('2d'),
    dpr = devicePixelRatio || 1,
    z = BIGMAP.zoom * dpr,
    toScreen = ([mx, my]) => [W / 2 + (mx - BIGMAP.cx) * z, H / 2 + (my - BIGMAP.cy) * z];
  g.fillStyle = '#5f8fae';
  g.fillRect(0, 0, W, H);
  // Kartorna, var och en vriden till norr uppåt. Bron först, campus och centrum ovanpå.
  for (const id of ['bron', 'outdoor', 'centrum']) {
    const C = KARTGEO[id].data(),
      v = (KARTGEO[id].vrid * Math.PI) / 180,
      [ox, oy] = geoToMeters(KARTGEO[id].lat, KARTGEO[id].lon);
    g.save();
    g.translate(W / 2 + (ox - BIGMAP.cx) * z, H / 2 + (oy - BIGMAP.cy) * z);
    g.scale(z, z);
    g.rotate(-v);
    g.translate(C.origin[0], C.origin[1]);
    g.scale(C.meterPerTile / BM_PX, C.meterPerTile / BM_PX);
    g.imageSmoothingEnabled = BIGMAP.zoom < 2;
    g.drawImage(bigMapBase(id), 0, 0);
    g.restore();
  }
  const label = (text, [x, y], color = '#1d2a33', size = 12, bg = '#ffffffcc') => {
    g.font = '600 ' + size * dpr + 'px system-ui';
    const tw = g.measureText(text).width;
    g.fillStyle = bg;
    g.fillRect(x - tw / 2 - 4 * dpr, y - size * dpr, tw + 8 * dpr, size * dpr * 1.35);
    g.fillStyle = color;
    g.textAlign = 'center';
    g.fillText(text, x, y);
  };
  // Namngivna hus.
  if (BIGMAP.zoom > 0.6)
    for (const id of Object.keys(KARTGEO))
      for (const h of worlds[id].houses || []) {
        if (!h.name || h.name === 'Hemma') continue;
        const pts = h.rings[0].pts,
          c = [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
        label(h.name, toScreen(tileToMeters(id, c[0], c[1])), '#3a2a22', 10, '#ffffffaa');
      }
  // Ställen, butiker, hållplatser och uppdrag.
  for (const id of Object.keys(KARTGEO))
    for (const o of worlds[id].objects) {
      const t = o.type;
      let icon = null;
      if (t === 'venue' || t === 'shop') icon = '•';
      else if (t === 'quest' || t === 'event') icon = '★';
      else if (t === 'portal' && /Buss/.test(o.label)) icon = '🚌';
      else if (t === 'portal' && o.target !== 'outdoor' && o.target !== 'centrum') icon = '🚪';
      else if (t === 'mycar') icon = '🚗';
      else if (t === 'uber') icon = '🚕';
      if (!icon) continue;
      const [x, y] = toScreen(tileToMeters(id, o.x, o.y));
      if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
      if (icon === '•') {
        g.fillStyle = '#1f6fb8';
        g.beginPath();
        g.arc(x, y, 4 * dpr, 0, 7);
        g.fill();
        if (BIGMAP.zoom > 1.6) label(String(o.label).split('·')[0].trim(), [x, y - 7 * dpr], '#123', 10);
      } else {
        g.font = 16 * dpr + 'px system-ui';
        g.textAlign = 'center';
        g.fillStyle = icon === '★' ? '#e0a020' : '#000';
        g.fillText(icon, x, y + 6 * dpr);
        if (icon === '★' && o.label) label(String(o.label).split('·')[0].trim(), [x, y - 10 * dpr], '#5a3a00', 11);
      }
    }
  // Kompisar online.
  for (const r of remotes.values()) {
    if (!KARTGEO[r.world]) continue;
    const p = toScreen(tileToMeters(r.world, r.x, r.y));
    g.fillStyle = '#ffcb83';
    g.beginPath();
    g.arc(p[0], p[1], 6 * dpr, 0, 7);
    g.fill();
    label(r.name.split(' ')[0], [p[0], p[1] - 9 * dpr], '#5a3a00', 11);
  }
  // Du: en pil åt det håll du tittar.
  const me = toScreen(playerMeters()),
    turn = KARTGEO[world.id] ? (KARTGEO[world.id].vrid * Math.PI) / 180 : 0,
    a = player.a - turn;
  g.save();
  g.translate(me[0], me[1]);
  g.rotate(a);
  g.fillStyle = '#e8483c';
  g.strokeStyle = '#fff';
  g.lineWidth = 2 * dpr;
  g.beginPath();
  g.moveTo(12 * dpr, 0);
  g.lineTo(-8 * dpr, 7 * dpr);
  g.lineTo(-4 * dpr, 0);
  g.lineTo(-8 * dpr, -7 * dpr);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
  label('Du', [me[0], me[1] - 14 * dpr], '#8a1f1a', 12);
  // Norrpil och skala.
  g.fillStyle = '#ffffffdd';
  g.fillRect(W - 50 * dpr, H - 70 * dpr, 40 * dpr, 60 * dpr);
  g.fillStyle = '#1d2a33';
  g.font = '700 ' + 14 * dpr + 'px system-ui';
  g.textAlign = 'center';
  g.fillText('N', W - 30 * dpr, H - 50 * dpr);
  g.fillText('↑', W - 30 * dpr, H - 30 * dpr);
  const m100 = 100 * z;
  g.fillRect(16 * dpr, H - 24 * dpr, m100, 4 * dpr);
  g.font = 11 * dpr + 'px system-ui';
  g.textAlign = 'left';
  g.fillText('100 m', 16 * dpr, H - 30 * dpr);
}
// Ett tryck på minikartan öppnar också den stora kartan (bra på mobilen).
$('mapBox')?.addEventListener('click', () => !modal && openBigMap());

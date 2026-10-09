// Väggar i valfri vinkel ("segment"), för campus där husen har sina riktiga former.
// Används av världar som har w.segments (utomhus). Inomhus används rutnätet som förut.
'use strict';

// ---- Fasadtexturer ----
// En textur är 1 ruta (1,7 m) bred och lika hög som huset. 64 px per ruta.
const FACADE_PX = 64;
const facadeCache = {};
function bricks(g, w, h, base, mortar, seed, from = 0, to = h) {
  const r = seeded(seed);
  g.fillStyle = mortar;
  g.fillRect(0, from, w, to - from);
  for (let y = from, row = 0; y < to; y += 4, row++)
    for (let x = row % 2 ? -4 : 0; x < w; x += 8) {
      const k = 0.88 + r() * 0.22;
      g.fillStyle = shadeHex(base, k);
      g.fillRect(x, y, 7, 3);
    }
}
function shadeHex(hex, k) {
  const n = parseInt(hex.slice(1), 16),
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => clamp(Math.round(v * k), 0, 255));
  return 'rgb(' + c.join(',') + ')';
}
function windowAt(g, x, y, w, h, frame, glass = '#4c6672', split = true) {
  g.fillStyle = '#00000033';
  g.fillRect(x + 2, y + 2, w, h);
  g.fillStyle = frame;
  g.fillRect(x, y, w, h);
  const grd = g.createLinearGradient(x, y, x + w, y + h);
  grd.addColorStop(0, shadeHex(glass, 1.35));
  grd.addColorStop(0.45, glass);
  grd.addColorStop(1, shadeHex(glass, 0.8));
  g.fillStyle = grd;
  g.fillRect(x + 2, y + 2, w - 4, h - 4);
  if (split) {
    g.fillStyle = frame;
    g.fillRect(x + w / 2 - 1, y, 2, h);
  }
  g.fillStyle = '#ffffff22';
  g.fillRect(x + 3, y + 3, 3, h - 6);
}
function boards(g, w, h, base, seed) {
  const r = seeded(seed);
  for (let x = 0; x < w; x += 6) {
    g.fillStyle = shadeHex(base, 0.92 + r() * 0.14);
    g.fillRect(x, 0, 6, h);
    g.fillStyle = '#00000022';
    g.fillRect(x, 0, 1, h);
  }
}
// Rita en fasad av en viss typ och höjd (i rutor).
function facadeTexture(type, h) {
  const key = type + ':' + h;
  if (facadeCache[key]) return facadeCache[key];
  const W = FACADE_PX,
    H = Math.max(32, Math.round(h * FACADE_PX)),
    c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d'),
    unit = FACADE_PX,
    zy = (z) => H - z * unit; // höjd i rutor -> y i texturen
  if (type === 'w33' || type === 'novia') {
    // Rött tegel, sockel i granit, fyra våningar med gröna fönsterkarmar (som W33 mot Wolffskavägen).
    bricks(g, W, H, '#a5583c', '#c9a48a', 33);
    g.fillStyle = '#8f8a84';
    g.fillRect(0, zy(0.75), W, 0.75 * unit);
    g.fillStyle = '#a7a29a';
    g.fillRect(0, zy(0.78), W, 3);
    const floors = type === 'w33' ? 4 : 4,
      fh = (h - 1.4) / floors;
    for (let f = 0; f < floors; f++) {
      const y0 = zy(0.9 + f * fh + fh * 0.8);
      windowAt(g, 12, y0, 40, fh * unit * 0.55, '#3f7f72', '#3d5865');
    }
    // Källarfönster och takkant.
    windowAt(g, 20, zy(0.6), 24, 0.3 * unit, '#6b6b66', '#2d3a40', false);
    g.fillStyle = '#9c968c';
    g.fillRect(0, 0, W, 5);
  } else if (type === 'techno') {
    // Låg verkstadshall i tegel med en rad små fönster högt upp och lisener (som Technobothnia).
    bricks(g, W, H, '#b0613f', '#cfa489', 52);
    g.fillStyle = '#00000018';
    g.fillRect(0, 0, 4, H);
    g.fillStyle = '#8d8a82';
    g.fillRect(0, zy(0.45), W, 0.45 * unit);
    windowAt(g, 18, zy(3.55), 28, 0.55 * unit, '#5f5a52', '#3f5560', false);
    windowAt(g, 22, zy(2.2), 20, 0.45 * unit, '#5f5a52', '#3f5560', false);
    g.fillStyle = '#9a8f80';
    g.fillRect(0, 0, W, 6);
  } else if (type === 'fabriikki' || type === 'oldbrick') {
    // Gammal fabrik i mörkt tegel med höga välvda fönster.
    bricks(g, W, H, type === 'fabriikki' ? '#99472f' : '#8f5038', '#b98d76', 71);
    const floors = Math.max(2, Math.round(h / 2.4)),
      fh = h / floors;
    for (let f = 0; f < floors; f++) {
      const y0 = zy(f * fh + fh * 0.85),
        wh = fh * unit * 0.6;
      g.fillStyle = '#e8e3d8';
      g.beginPath();
      g.moveTo(16, y0 + wh);
      g.lineTo(16, y0 + 10);
      g.arc(32, y0 + 10, 16, Math.PI, 0);
      g.lineTo(48, y0 + wh);
      g.fill();
      g.fillStyle = '#41545c';
      g.fillRect(19, y0 + 6, 26, wh - 8);
      g.fillStyle = '#e8e3d8';
      g.fillRect(31, y0 + 2, 2, wh);
      g.fillRect(19, y0 + wh * 0.5, 26, 2);
    }
    g.fillStyle = '#7d4a36';
    g.fillRect(0, 0, W, 6);
  } else if (type === 'woodred' || type === 'villa') {
    // Trähus: falurött eller ljust gulgrått med vita fönster.
    boards(g, W, H, type === 'woodred' ? '#9b3a2c' : '#cfc3a1', type === 'woodred' ? 5 : 6);
    g.fillStyle = '#f0ece2';
    g.fillRect(0, zy(0.35), W, 5);
    const floors = h > 3.5 ? 2 : 1,
      fh = (h - 0.6) / floors;
    for (let f = 0; f < floors; f++)
      windowAt(g, 16, zy(0.5 + f * fh + fh * 0.75), 32, fh * unit * 0.5, '#f4f2ec', '#53697a');
    g.fillStyle = '#4a4440';
    g.fillRect(0, 0, W, 10);
    g.fillStyle = '#7a756d';
    g.fillRect(0, zy(0.35), W, 0.35 * unit);
  } else if (type === 'wsc' || type === 'brickmodern') {
    bricks(g, W, H, type === 'wsc' ? '#a9654a' : '#b06a4c', '#d2b39d', 91);
    const floors = Math.max(1, Math.round(h / 2)),
      fh = h / floors;
    for (let f = 0; f < floors; f++)
      windowAt(g, 6, zy(f * fh + fh * 0.8), 52, fh * unit * 0.5, '#3a3f43', '#40545e');
    g.fillStyle = '#7f7a72';
    g.fillRect(0, 0, W, 6);
  } else if (type === 'office') {
    bricks(g, W, H, '#b9906a', '#ddc7ac', 17);
    const floors = Math.max(2, Math.round(h / 2)),
      fh = h / floors;
    for (let f = 0; f < floors; f++)
      windowAt(g, 0, zy(f * fh + fh * 0.75), 64, fh * unit * 0.42, '#d8d4c8', '#4a6270', false);
  } else if (type === 'apartment' || type === 'home') {
    g.fillStyle = type === 'home' ? '#e4d39f' : '#e3ddcf';
    g.fillRect(0, 0, W, H);
    const r = seeded(7);
    for (let i = 0; i < W * H * 0.02; i++) {
      g.fillStyle = r() > 0.5 ? '#ffffff14' : '#5b4a2a10';
      g.fillRect(r() * W, r() * H, 1 + r() * 2, 1);
    }
    const floors = Math.max(1, Math.round(h / 1.75)),
      fh = h / floors;
    for (let f = 0; f < floors; f++) {
      const y0 = zy(f * fh + fh * 0.78);
      windowAt(g, 14, y0, 36, fh * unit * 0.5, '#f6f4ee', '#5f7f8e');
      if (f > 0 && type === 'apartment') {
        g.fillStyle = '#cfc8b8';
        g.fillRect(6, y0 + fh * unit * 0.5, 52, 6);
      }
    }
    g.fillStyle = '#9a9a92';
    g.fillRect(0, 0, W, 6);
  } else if (type === 'church') {
    // Trefaldighetskyrkan: rött tegel i engelsk gotik med höga spetsbågiga fönster.
    bricks(g, W, H, '#9c4632', '#c08f78', 1869);
    g.fillStyle = '#7f7a72';
    g.fillRect(0, zy(0.5), W, 0.5 * unit);
    const top = zy(h * 0.82),
      bottom = zy(1.4);
    g.fillStyle = '#d9cdb8';
    g.beginPath();
    g.moveTo(18, bottom);
    g.lineTo(18, top + 22);
    g.quadraticCurveTo(32, top - 10, 46, top + 22);
    g.lineTo(46, bottom);
    g.fill();
    const glass = g.createLinearGradient(0, top, 0, bottom);
    glass.addColorStop(0, '#5a6f86');
    glass.addColorStop(1, '#344656');
    g.fillStyle = glass;
    g.beginPath();
    g.moveTo(21, bottom - 3);
    g.lineTo(21, top + 22);
    g.quadraticCurveTo(32, top - 4, 43, top + 22);
    g.lineTo(43, bottom - 3);
    g.fill();
    g.fillStyle = '#d9cdb8';
    g.fillRect(31, top + 8, 2, bottom - top - 10);
    for (let y = top + 30; y < bottom; y += 26) g.fillRect(21, y, 22, 2);
    g.fillStyle = '#7a3526';
    g.fillRect(0, 0, W, 8);
  } else if (type === 'stadshus') {
    // Stadshuset (och stationen): ljusgul fasad med vita listverk och rundbågiga fönster.
    g.fillStyle = '#e6cf8f';
    g.fillRect(0, 0, W, H);
    const r = seeded(1883);
    for (let i = 0; i < W * H * 0.02; i++) {
      g.fillStyle = r() > 0.5 ? '#ffffff18' : '#7a5a2010';
      g.fillRect(r() * W, r() * H, 1 + r() * 2, 1);
    }
    g.fillStyle = '#b9a174';
    g.fillRect(0, zy(0.9), W, 0.9 * unit);
    const floors = Math.max(1, Math.round((h - 0.9) / 2.3)),
      fh = (h - 1.2) / floors;
    for (let f = 0; f < floors; f++) {
      const y0 = zy(1 + f * fh + fh * 0.82),
        wh = fh * unit * 0.58;
      g.fillStyle = '#f6f1e4';
      g.beginPath();
      g.moveTo(14, y0 + wh + 4);
      g.lineTo(14, y0 + 14);
      g.arc(32, y0 + 14, 18, Math.PI, 0);
      g.lineTo(50, y0 + wh + 4);
      g.fill();
      windowAt(g, 18, y0 + 8, 28, wh - 6, '#efe9da', '#4d6675');
      g.fillStyle = '#f6f1e4';
      g.fillRect(0, y0 + wh + 6, W, 4);
    }
    g.fillStyle = '#f6f1e4';
    g.fillRect(0, 0, W, 10);
    g.fillStyle = '#c9b27a';
    g.fillRect(0, 10, W, 3);
  } else if (type.startsWith('city:')) {
    // Stadshus i centrum: puts i husets egen färg (från kartan) och butiksfönster i gatuplanet.
    const [, color, kind] = type.split(':'),
      shop = kind === 'shop',
      brick = /^#[89a][0-9a-f][3-5]/i.test(color) && parseInt(color.slice(1, 3), 16) > 1.6 * parseInt(color.slice(5, 7), 16);
    if (brick) bricks(g, W, H, color, shadeHex(color, 1.35), parseInt(color.slice(1), 16) % 997);
    else {
      g.fillStyle = color;
      g.fillRect(0, 0, W, H);
      const r = seeded(parseInt(color.slice(1), 16) % 997);
      for (let i = 0; i < W * H * 0.02; i++) {
        g.fillStyle = r() > 0.5 ? '#ffffff14' : '#3b302010';
        g.fillRect(r() * W, r() * H, 1 + r() * 2, 1);
      }
    }
    const ground = shop && h > 2.4 ? 2.1 : 0,
      floors = Math.max(1, Math.round((h - ground) / 1.85)),
      fh = (h - ground) / floors,
      light = (parseInt(color.slice(1, 3), 16) + parseInt(color.slice(3, 5), 16)) / 2 > 150;
    if (ground) {
      // Skyltfönster och en markis i gatuplanet.
      g.fillStyle = shadeHex(color, 0.7);
      g.fillRect(0, zy(ground), W, ground * unit);
      windowAt(g, 4, zy(ground - 0.25), 56, (ground - 0.55) * unit, '#2f3438', '#5b7584', false);
      g.fillStyle = shadeHex(color, 0.55);
      g.fillRect(0, zy(ground) - 4, W, 6);
    }
    for (let f = 0; f < floors; f++) {
      const y0 = zy(ground + f * fh + fh * 0.78);
      windowAt(g, 13, y0, 38, fh * unit * 0.5, light ? '#f4f2ec' : '#e9e4d8', '#55707f');
    }
    g.fillStyle = shadeHex(color, 0.6);
    g.fillRect(0, 0, W, 6);
  } else if (type === 'hedge') {
    const r = seeded(3);
    g.fillStyle = '#2f5a2e';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = r() > 0.5 ? '#3f7a3a' : '#24472a';
      g.beginPath();
      g.arc(r() * W, r() * H, 2 + r() * 3, 0, 7);
      g.fill();
    }
  } else if (type === 'railing') {
    // Broräcke: betongkant med stolpar och ledstänger i målad stål.
    g.fillStyle = '#a3a7a6';
    g.fillRect(0, H * 0.55, W, H * 0.45);
    g.fillStyle = '#7c8a91';
    g.fillRect(0, 0, W, H * 0.55);
    g.fillStyle = '#4b5a63';
    for (let x = 4; x < W; x += 32) g.fillRect(x, 0, 5, H);
    g.fillRect(0, 0, W, 6);
    g.fillRect(0, H * 0.5, W, 4);
    g.fillStyle = '#6f828c';
    g.fillRect(0, 0, W, 2);
  } else if (type === 'stonewall') {
    g.fillStyle = '#7f7d78';
    g.fillRect(0, 0, W, H);
    const r = seeded(9);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = shadeHex('#8e8b84', 0.8 + r() * 0.35);
      g.fillRect(r() * W, r() * H, 8 + r() * 14, 5 + r() * 6);
    }
  } else {
    g.fillStyle = '#cfcac0';
    g.fillRect(0, 0, W, H);
    const floors = Math.max(1, Math.round(h / 1.9)),
      fh = h / floors;
    for (let f = 0; f < floors; f++)
      windowAt(g, 14, zy(f * fh + fh * 0.75), 36, fh * unit * 0.45, '#f3f1ea', '#566e7a');
    g.fillStyle = '#8f8b82';
    g.fillRect(0, 0, W, 5);
  }
  facadeCache[key] = c;
  return c;
}

// ---- Bygga segment ----
// Ett segment: a→b, höjd h, fasad (typ), normal (n) som pekar ut från huset.
function addSegment(w, ax, ay, bx, by, h, type, extra = {}) {
  const len = Math.hypot(bx - ax, by - ay);
  if (len < 0.02) return null;
  const s = { ax, ay, bx, by, h, type, len, nx: (ay - by) / len, ny: (bx - ax) / len, ...extra };
  w.segments.push(s);
  return s;
}
// Lägger in segmenten i ett rutnät så att strålen bara behöver testa de som ligger i rutan.
function indexSegments(w) {
  const n = w.size;
  w.segCells = Array.from({ length: n * n }, () => null);
  w.segments.forEach((s, i) => {
    s.id = i;
    const steps = Math.ceil(s.len / 0.2) + 1;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps,
        x = Math.floor(s.ax + (s.bx - s.ax) * t),
        y = Math.floor(s.ay + (s.by - s.ay) * t);
      if (x < 0 || y < 0 || x >= n || y >= n) continue;
      const c = y * n + x;
      (w.segCells[c] ??= []).includes(i) || w.segCells[c].push(i);
    }
  });
}
// Byt en bit av ett segment mot en dörr. Returnerar dörrens mittpunkt och normal.
function cutDoor(w, x, y, width = 1) {
  let best = null,
    bd = 1e9;
  for (const s of w.segments) {
    if (s.door || s.low) continue;
    const dx = s.bx - s.ax,
      dy = s.by - s.ay,
      t = clamp(((x - s.ax) * dx + (y - s.ay) * dy) / (s.len * s.len), 0, 1),
      d = Math.hypot(s.ax + dx * t - x, s.ay + dy * t - y);
    if (d < bd && s.len >= width + 0.2) {
      bd = d;
      best = { s, t };
    }
  }
  if (!best) return null;
  const s = best.s,
    half = width / 2 / s.len,
    t0 = clamp(best.t - half, 0, 1 - 2 * half),
    t1 = t0 + 2 * half,
    P = (t) => [s.ax + (s.bx - s.ax) * t, s.ay + (s.by - s.ay) * t],
    [x0, y0] = P(t0),
    [x1, y1] = P(t1),
    end = [s.bx, s.by];
  // Korta originalet till första biten, lägg dörren och resten efter.
  s.bx = x0;
  s.by = y0;
  s.len = Math.hypot(s.bx - s.ax, s.by - s.ay);
  const door = addSegment(w, x0, y0, x1, y1, s.h, s.type, { door: true, nx: s.nx, ny: s.ny });
  addSegment(w, x1, y1, end[0], end[1], s.h, s.type, { nx: s.nx, ny: s.ny });
  const mx = (x0 + x1) / 2,
    my = (y0 + y1) / 2;
  // Normalen ska peka ut från huset: kolla vilken sida som är fri.
  let nx = s.nx,
    ny = s.ny;
  if (isWall(w, mx + nx * 0.4, my + ny * 0.4) && !isWall(w, mx - nx * 0.4, my - ny * 0.4)) {
    nx = -nx;
    ny = -ny;
  }
  door.nx = nx;
  door.ny = ny;
  return { x: mx, y: my, nx, ny, seg: door };
}

// ---- Fast mark (husens insida) med hög upplösning ----
function fillMask(w, rings, value, res) {
  const n = w.size * res,
    mask = w.mask;
  // Scanline: för varje rad, hitta skärningar med alla kanter.
  for (let py = 0; py < n; py++) {
    const y = (py + 0.5) / res,
      xs = [];
    for (const ring of rings)
      for (let i = 0; i < ring.length; i++) {
        const [ax, ay] = ring[i],
          [bx, by] = ring[(i + 1) % ring.length];
        if (ay <= y !== by <= y) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.max(0, Math.ceil(xs[k] * res - 0.5)),
        x1 = Math.min(n - 1, Math.floor(xs[k + 1] * res - 0.5));
      for (let px = x0; px <= x1; px++) mask[py * n + px] = value;
    }
  }
}
function maskAt(w, x, y) {
  const r = w.maskRes,
    n = w.size * r,
    px = Math.floor(x * r),
    py = Math.floor(y * r);
  if (px < 0 || py < 0 || px >= n || py >= n) return 3;
  return w.mask[py * n + px];
}

// ---- Strålar mot segment ----
let segStampN = 1;
const segHits = [];
// Kastar en stråle och fyller segHits med träffar (närmast först): närmaste väggen och sedan
// högre hus längre bort som syns ovanför den.
function castSegments(w, rx, ry, cam, maxDist) {
  segHits.length = 0;
  segStampN++;
  const n = w.size;
  let mx = Math.floor(player.x),
    my = Math.floor(player.y);
  const ddx = Math.abs(1 / rx),
    ddy = Math.abs(1 / ry),
    stepX = rx < 0 ? -1 : 1,
    stepY = ry < 0 ? -1 : 1;
  let sx = (rx < 0 ? player.x - mx : mx + 1 - player.x) * ddx,
    sy = (ry < 0 ? player.y - my : my + 1 - player.y) * ddy,
    tEnter = 0,
    bestTop = Infinity;
  for (let k = 0; k < 600; k++) {
    const tExit = Math.min(sx, sy);
    if (mx >= 0 && my >= 0 && mx < n && my < n) {
      const list = w.segCells[my * n + mx];
      if (list) {
        let found = [];
        for (const id of list) {
          if (w.segments[id]._s === segStampN) continue;
          const s = w.segments[id],
            ex = s.bx - s.ax,
            ey = s.by - s.ay,
            den = rx * ey - ry * ex;
          if (Math.abs(den) < 1e-9) continue;
          const qx = s.ax - player.x,
            qy = s.ay - player.y,
            t = (qx * ey - qy * ex) / den,
            u = (qx * ry - qy * rx) / den;
          if (u < 0 || u > 1 || t < 0.02 || t < tEnter - 1e-6 || t > tExit + 1e-6) continue;
          s._s = segStampN;
          found.push({ s, t, u });
        }
        if (found.length > 1) found.sort((a, b) => a.t - b.t);
        for (const f of found) {
          const top = cam.horizon - ((f.s.h - cam.eye) * cam.focal) / f.t;
          if (!segHits.length || top < bestTop - 0.5) {
            segHits.push(f);
            bestTop = top;
            if (segHits.length >= 4 || top <= 0) return segHits;
          }
        }
      }
    }
    if (tExit > maxDist) break;
    tEnter = tExit;
    if (sx < sy) {
      sx += ddx;
      mx += stepX;
    } else {
      sy += ddy;
      my += stepY;
    }
    if (mx < -1 || my < -1 || mx > n || my > n) break;
  }
  return segHits;
}
// Ritar en kolumn med segmentträffar (längst bort först) och sätter zbuffer.
function drawSegmentColumn(w, x, hits, cam, light, fogColor) {
  if (!hits.length) {
    zbuffer[x] = zbuffer[x + 1] = 1e9;
    wallTops[x] = wallTops[x + 1] = H;
    return;
  }
  const sunX = 0.6,
    sunY = -0.8;
  for (let i = hits.length - 1; i >= 0; i--) {
    const { s, t, u } = hits[i],
      top = cam.horizon - ((s.h - cam.eye) * cam.focal) / t,
      bottom = cam.horizon + (cam.eye * cam.focal) / t,
      tex = s.door
        ? doorTexture('seg:' + s.type, s.h, false, facadeTexture(s.type, s.h))
        : facadeTexture(s.type, s.h),
      along = u * s.len,
      col = s.door
        ? Math.floor(u * (tex.width - 1))
        : Math.floor((((along % 1) + 1) % 1) * (tex.width - 1));
    ctx.drawImage(tex, col, 0, 1, tex.height, x, top, 2, bottom - top);
    const facing = Math.max(0, s.nx * sunX + s.ny * sunY),
      dark = clamp(0.28 - facing * 0.22 + (1 - light) * 0.7, 0, 0.85),
      fog = clamp((t - 30) / 170, 0, 0.6);
    if (dark > 0.01) {
      ctx.fillStyle = 'rgba(13,24,34,' + dark + ')';
      ctx.fillRect(x, top, 2, bottom - top);
    }
    if (fog > 0.01) {
      ctx.fillStyle = fogColor + fog + ')';
      ctx.fillRect(x, top, 2, bottom - top);
    }
  }
  const near = hits[0];
  zbuffer[x] = zbuffer[x + 1] = near.t;
  wallTops[x] = wallTops[x + 1] = cam.horizon - ((near.s.h - cam.eye) * cam.focal) / near.t;
}

// ---- Krock mot segment ----
function segPushOut(w, r) {
  const n = w.size,
    cx = Math.floor(player.x),
    cy = Math.floor(player.y);
  for (let y = cy - 1; y <= cy + 1; y++)
    for (let x = cx - 1; x <= cx + 1; x++) {
      if (x < 0 || y < 0 || x >= n || y >= n) continue;
      const list = w.segCells[y * n + x];
      if (!list) continue;
      for (const id of list) {
        const s = w.segments[id],
          dx = s.bx - s.ax,
          dy = s.by - s.ay,
          t = clamp(((player.x - s.ax) * dx + (player.y - s.ay) * dy) / (s.len * s.len), 0, 1),
          px = s.ax + dx * t,
          py = s.ay + dy * t,
          ox = player.x - px,
          oy = player.y - py,
          d = Math.hypot(ox, oy);
        if (d >= r) continue;
        if (d > 1e-6) {
          player.x = px + (ox / d) * r;
          player.y = py + (oy / d) * r;
        } else {
          player.x = px + s.nx * r;
          player.y = py + s.ny * r;
        }
      }
    }
  // Hamnade man ändå innanför ett hus (t.ex. mycket hög fart) puttas man till närmaste fria punkt.
  if (maskAt(w, player.x, player.y)) {
    for (let rad = 0.2; rad < 3; rad += 0.2)
      for (let a = 0; a < 6.28; a += 0.5) {
        const x = player.x + Math.cos(a) * rad,
          y = player.y + Math.sin(a) * rad;
        if (!maskAt(w, x, y)) {
          player.x = x;
          player.y = y;
          return;
        }
      }
  }
}

// ---- Minikartan: ritas en gång och klipps sedan runt spelaren ----
function minimapBase(w) {
  if (w._minimap) return w._minimap;
  const c = document.createElement('canvas'),
    scale = w.segments ? 3 : Math.max(2, Math.floor(296 / w.size));
  c.width = c.height = w.size * scale;
  const g = c.getContext('2d');
  if (w.ground) {
    const colors = ['#9b9c94', '#4e6e3f', '#5b5f63', '#d8d8cc', '#666a70', '#7b7d80'],
      res = w.groundRes,
      n = w.size * res;
    // Ett pixelvärde per ruta och skala räcker för kartan.
    for (let y = 0; y < w.size * scale; y++)
      for (let x = 0; x < w.size * scale; x++) {
        const v = w.ground[Math.floor((y / scale) * res) * n + Math.floor((x / scale) * res)];
        g.fillStyle = colors[v] || '#888';
        g.fillRect(x, y, 1, 1);
      }
    for (const hse of w.houses || []) {
      g.fillStyle = '#a27658';
      g.beginPath();
      for (const r of hse.rings)
        r.pts.forEach(([x, y], i) =>
          i ? g.lineTo(x * scale, y * scale) : g.moveTo(x * scale, y * scale),
        );
      g.fill('evenodd');
    }
  } else {
    g.fillStyle = w.outdoor ? '#344c36' : '#14252b';
    g.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < w.size; y++)
      for (let x = 0; x < w.size; x++) {
        if (!w.outdoor && !w.grid[y][x]) {
          g.fillStyle = '#2c4248';
          g.fillRect(x * scale, y * scale, scale, scale);
        }
        if (
          w.grid[y][x] &&
          (w.outdoor ||
            [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ].some(([dx, dy]) => w.grid[y + dy]?.[x + dx] === 0))
        ) {
          g.fillStyle = '#586c74';
          g.fillRect(x * scale, y * scale, scale, scale);
        }
      }
  }
  w._minimap = { canvas: c, scale };
  return w._minimap;
}

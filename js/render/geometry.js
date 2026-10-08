// 3D-lådor (möbler), ljuskarta, dörrar och spegel. Används av render.js.
'use strict';

// ---- Specialrutor i rutnätet ----
const MIRROR = 90; // Spegelruta: strålen studsar på dess södra sida.
const DOOR = 100; // Dörr = DOOR + väggtypen runt dörren, t.ex. 107 = dörr i fasad 7.
function isDoor(tile) {
  return tile >= DOOR;
}

// ---- Lådor ----
// En låda är ett rätblock med golvmått x0..x1, y0..y1 och höjd z0..z1 (väggenheter, 1 ≈ 1,7 m).
// opts: color [r,g,b] eller färg för alla sidor, top [r,g,b], tex (canvas på sidorna),
// front ('-x', '+x', '-y', '+y') + frontTex för sidan med t.ex. lådor eller skärm,
// glow (lyser själv), solid (krockar), mirror:false (syns inte i spegeln).
function addBox(w, x0, y0, x1, y1, z0, z1, opts = {}) {
  const b = {
    x0: Math.min(x0, x1),
    y0: Math.min(y0, y1),
    x1: Math.max(x0, x1),
    y1: Math.max(y0, y1),
    z0,
    z1,
    color: opts.color || [180, 170, 160],
    top: opts.top || opts.color || [190, 180, 170],
    tex: opts.tex || null,
    front: opts.front || null,
    frontTex: opts.frontTex || null,
    glow: opts.glow || false,
    mirror: opts.mirror !== false,
  };
  w.boxes ??= [];
  w.boxes.push(b);
  if (opts.solid ?? (z0 < 0.3 && z1 > 0.12)) {
    w.solids ??= [];
    w.solids.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
  }
  return b;
}
// Krockar en punkt med radie r mot någon möbel?
function hitsSolid(w, x, y, r) {
  if (!w.solids) return false;
  for (const s of w.solids) {
    const dx = x - clamp(x, s.x0, s.x1),
      dy = y - clamp(y, s.y0, s.y1);
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}
// Skapar spegelvända kopior av lådorna bakom spegeln (en gång när världen byggs).
function buildMirrorBoxes(w) {
  if (!w.mirror) return;
  const P = w.mirror.plane;
  w.mirrorBoxes = (w.boxes || [])
    .filter((b) => b.mirror)
    .map((b) => ({
      ...b,
      y0: 2 * P - b.y1,
      y1: 2 * P - b.y0,
      front: flipFront(b.front),
      virtual: true,
    }));
}
function flipFront(f) {
  return f === '-y' ? '+y' : f === '+y' ? '-y' : f;
}

// ---- Ljus ----
// Ljuskartan lagrar ljus per 1/8 ruta: lampor (varmt) och fönster (dagsljus) var för sig.
function buildLightmap(w) {
  if (!w.lights) return;
  const res = 8,
    n = w.size * res,
    lamp = new Float32Array(n * n),
    day = new Float32Array(n * n);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) / res,
        y = (j + 0.5) / res;
      let a = 0,
        d = 0;
      for (const l of w.lights) {
        const dist2 = (x - l.x) ** 2 + (y - l.y) ** 2 + (l.z || 0) ** 2;
        const v = l.power / (1 + dist2 * l.falloff);
        if (l.day) d += v;
        else a += v;
      }
      lamp[j * n + i] = a;
      day[j * n + i] = d;
    }
  w.lightmap = { res, n, lamp, day };
}
// Hur mycket lamporna respektive dagsljuset lyser just nu.
function lightLevels(w) {
  const h = state?.hour ?? 12,
    // Dagsljuset följer årstiden (js/game/seasons.js).
    sun = daylight(h);
  return {
    sun,
    lamps: homeParty ? 0.6 : sun > 0.7 ? 0.45 : 1,
    ambient: (homeParty ? 0.14 : 0.2) + sun * 0.34,
  };
}
let lightNow = { sun: 1, lamps: 1, ambient: 0.5 };
function lightAt(w, x, y) {
  const m = w.lightmap;
  if (!m) return 1;
  const i = clamp(Math.floor(x * m.res), 0, m.n - 1),
    j = clamp(Math.floor(y * m.res), 0, m.n - 1),
    k = j * m.n + i;
  return Math.min(1.45, lightNow.ambient + m.lamp[k] * lightNow.lamps + m.day[k] * lightNow.sun);
}

// ---- Rita lådor kolumn för kolumn (samma perspektiv som väggarna) ----
// cam: { focal, horizon, eye, dirX, dirY, planeX, planeY }
function drawBox(w, b, cam) {
  const px = player.x,
    py = player.y,
    faces = [];
  if (px < b.x0) faces.push('-x');
  if (px > b.x1) faces.push('+x');
  if (py < b.y0) faces.push('-y');
  if (py > b.y1) faces.push('+y');
  // Ljus mitt i lådan. Spegelkopior tar ljuset från originalets plats.
  const cy = (b.y0 + b.y1) / 2,
    realY = b.virtual ? 2 * w.mirror.plane - cy : cy,
    lit = b.glow ? 1.25 : lightAt(w, (b.x0 + b.x1) / 2, realY);
  for (const f of faces) drawSide(b, f, cam, lit);
  if (cam.eye > b.z1) drawCap(b, b.z1, b.top, cam, lit * (b.glow ? 1 : 1.04));
  else if (cam.eye < b.z0) drawCap(b, b.z0, b.color, cam, lit * 0.6);
}
const faceShade = { '-x': 0.8, '+x': 0.9, '-y': 0.86, '+y': 0.95 };
function shadeRGB(c, k) {
  return (
    'rgb(' +
    clamp(c[0] * k, 0, 255) +
    ',' +
    clamp(c[1] * k, 0, 255) +
    ',' +
    clamp(c[2] * k, 0, 255) +
    ')'
  );
}
function screenX(cam, x, y) {
  const dx = x - player.x,
    dy = y - player.y,
    depth = dx * cam.dirX + dy * cam.dirY,
    lateral = -dx * cam.dirY + dy * cam.dirX;
  if (depth < 0.02) return lateral < 0 ? -Infinity : Infinity;
  return W / 2 + (lateral / depth) * cam.focal;
}
function columnRange(cam, ax, ay, bx, by) {
  const a = screenX(cam, ax, ay),
    c = screenX(cam, bx, by);
  if (a === c && !isFinite(a)) return null;
  let lo = Math.min(a, c),
    hi = Math.max(a, c);
  lo = Math.max(0, Math.floor(lo / 2) * 2);
  hi = Math.min(W, hi);
  return lo < hi ? [lo, hi] : null;
}
function drawSide(b, f, cam, lit) {
  const xFace = f === '-x' ? b.x0 : f === '+x' ? b.x1 : null,
    yFace = f === '-y' ? b.y0 : f === '+y' ? b.y1 : null;
  const range =
    xFace !== null
      ? columnRange(cam, xFace, b.y0, xFace, b.y1)
      : columnRange(cam, b.x0, yFace, b.x1, yFace);
  if (!range) return;
  const tex = b.front === f && b.frontTex ? b.frontTex : b.tex,
    k = b.glow && b.front === f ? 1.2 : faceShade[f] * lit,
    fill = shadeRGB(b.color, k),
    dark = tex ? clamp(1 - k, 0, 0.85) : 0,
    light = tex ? clamp(k - 1, 0, 0.3) : 0;
  for (let x = range[0]; x < range[1]; x += 2) {
    const cx = (2 * x) / W - 1,
      rx = cam.dirX + cam.planeX * cx,
      ry = cam.dirY + cam.planeY * cx;
    let t, u;
    if (xFace !== null) {
      if (Math.abs(rx) < 1e-6) continue;
      t = (xFace - player.x) / rx;
      const hy = player.y + t * ry;
      if (hy < b.y0 || hy > b.y1) continue;
      u = (hy - b.y0) / (b.y1 - b.y0);
      if (f === '+x') u = 1 - u;
    } else {
      if (Math.abs(ry) < 1e-6) continue;
      t = (yFace - player.y) / ry;
      const hx = player.x + t * rx;
      if (hx < b.x0 || hx > b.x1) continue;
      u = (hx - b.x0) / (b.x1 - b.x0);
      if (f === '-y') u = 1 - u;
    }
    if (t < 0.02 || t > zbuffer[x] - 0.002) continue;
    const top = cam.horizon - ((b.z1 - cam.eye) * cam.focal) / t,
      bottom = cam.horizon - ((b.z0 - cam.eye) * cam.focal) / t,
      h = bottom - top;
    if (h <= 0) continue;
    if (tex) {
      ctx.drawImage(
        tex,
        Math.min(tex.width - 1, Math.floor(u * tex.width)),
        0,
        1,
        tex.height,
        x,
        top,
        2,
        h,
      );
      if (dark > 0.01) {
        ctx.fillStyle = 'rgba(12,16,22,' + dark + ')';
        ctx.fillRect(x, top, 2, h);
      } else if (light > 0.01) {
        ctx.fillStyle = 'rgba(255,236,200,' + light + ')';
        ctx.fillRect(x, top, 2, h);
      }
    } else {
      ctx.fillStyle = fill;
      ctx.fillRect(x, top, 2, h);
    }
  }
}
function drawCap(b, z, color, cam, lit) {
  const range = capRange(b, cam);
  if (!range) return;
  ctx.fillStyle = shadeRGB(color, lit);
  for (let x = range[0]; x < range[1]; x += 2) {
    const cx = (2 * x) / W - 1,
      rx = cam.dirX + cam.planeX * cx,
      ry = cam.dirY + cam.planeY * cx;
    // Där strålen går in i och ut ur rektangeln sett ovanifrån.
    let t0 = 0.02,
      t1 = zbuffer[x] - 0.002;
    for (const [p, r, lo, hi] of [
      [player.x, rx, b.x0, b.x1],
      [player.y, ry, b.y0, b.y1],
    ]) {
      if (Math.abs(r) < 1e-9) {
        if (p < lo || p > hi) t1 = -1;
        continue;
      }
      let a = (lo - p) / r,
        c = (hi - p) / r;
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, c);
    }
    if (t1 <= t0) continue;
    const ya = cam.horizon - ((z - cam.eye) * cam.focal) / t0,
      yb = cam.horizon - ((z - cam.eye) * cam.focal) / t1,
      top = Math.min(ya, yb),
      h = Math.abs(ya - yb);
    if (h > 0.2) ctx.fillRect(x, top, 2, Math.max(1, h));
  }
}
function capRange(b, cam) {
  let lo = Infinity,
    hi = -Infinity;
  for (const [x, y] of [
    [b.x0, b.y0],
    [b.x1, b.y0],
    [b.x0, b.y1],
    [b.x1, b.y1],
  ]) {
    const s = screenX(cam, x, y);
    lo = Math.min(lo, s);
    hi = Math.max(hi, s);
  }
  // Står man ovanför/vid lådan kan den täcka hela bredden.
  if (!isFinite(lo)) lo = 0;
  if (!isFinite(hi)) hi = W;
  lo = Math.max(0, Math.floor(lo / 2) * 2);
  hi = Math.min(W, hi);
  return lo < hi ? [lo, hi] : null;
}
// Avstånd framåt till lådans mitt, används för att rita i rätt ordning.
function boxDepth(b, cam) {
  const x = clamp(player.x, b.x0, b.x1),
    y = clamp(player.y, b.y0, b.y1),
    cx = (b.x0 + b.x1) / 2,
    cy = (b.y0 + b.y1) / 2;
  // Blandning av närmaste punkt och mitt ger stabil ordning mellan möbler som står nära varandra.
  const mx = (x + cx) / 2,
    my = (y + cy) / 2;
  return (mx - player.x) * cam.dirX + (my - player.y) * cam.dirY;
}

// ---- Dörrar ----
const doorCache = {};
function doorTexture(base, wallHeight, indoor, wallSrc) {
  const key = base + ':' + wallHeight + (wallSrc ? ':own' : '');
  if (doorCache[key]) return doorCache[key];
  const src = wallSrc || wallTextures[(base - 1) % wallTextures.length],
    c = document.createElement('canvas');
  c.width = 128;
  c.height = Math.round(128 * Math.max(1, wallHeight));
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0, c.width, c.height);
  const doorH = Math.round((1.22 / wallHeight) * c.height),
    top = c.height - doorH,
    glass = !indoor;
  if (glass) {
    // Dubbla glasdörrar med karm, tak och en lampa ovanför.
    g.fillStyle = '#2f3b40';
    g.fillRect(14, top - 10, 100, doorH + 10);
    g.fillStyle = '#c8cfc9';
    g.fillRect(10, top - 16, 108, 8);
    for (const x of [20, 66]) {
      g.fillStyle = '#5b7480';
      g.fillRect(x, top + 2, 42, doorH - 6);
      const gr = g.createLinearGradient(x, top, x + 42, top + doorH);
      gr.addColorStop(0, '#9fc1c7aa');
      gr.addColorStop(0.5, '#4f6b75aa');
      gr.addColorStop(1, '#8fb0b5aa');
      g.fillStyle = gr;
      g.fillRect(x + 3, top + 5, 36, doorH - 14);
      g.fillStyle = '#d8dcd6';
      g.fillRect(x === 20 ? x + 34 : x + 4, top + doorH * 0.45, 3, doorH * 0.18);
    }
    g.fillStyle = '#ffe9b0';
    g.beginPath();
    g.arc(64, top - 24, 5, 0, 7);
    g.fill();
    g.fillStyle = '#ffe9b033';
    g.beginPath();
    g.arc(64, top - 24, 14, 0, 7);
    g.fill();
  } else {
    // Innerdörr i trä med karm och handtag.
    g.fillStyle = '#e9e5dc';
    g.fillRect(26, top - 6, 76, doorH + 6);
    const gr = g.createLinearGradient(32, 0, 96, 0);
    gr.addColorStop(0, '#8a6644');
    gr.addColorStop(0.5, '#a07a52');
    gr.addColorStop(1, '#84603f');
    g.fillStyle = gr;
    g.fillRect(32, top, 64, doorH);
    g.strokeStyle = '#6e5035';
    g.lineWidth = 2;
    g.strokeRect(38, top + 8, 52, doorH * 0.38);
    g.strokeRect(38, top + doorH * 0.52, 52, doorH * 0.4);
    g.fillStyle = '#d7d2c4';
    g.fillRect(84, top + doorH * 0.5, 9, 4);
    g.fillStyle = '#6f6a5c';
    g.fillRect(84, top + doorH * 0.5 + 4, 9, 2);
  }
  // Dörrmatta och tröskel.
  g.fillStyle = '#00000022';
  g.fillRect(0, c.height - 3, c.width, 3);
  doorCache[key] = c;
  return c;
}
// Gör om en vanlig portal till en dörr i väggrutan (tx, ty). Portalen blir osynlig men har kvar etiketten.
function doorAt(w, tx, ty) {
  const base = w.grid[ty][tx];
  if (!base || isDoor(base)) return;
  w.grid[ty][tx] = DOOR + base;
}

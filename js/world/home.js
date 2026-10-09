// Hemmet: en möblerad etta med riktiga 3D-möbler, ljus, fönster och en spegel.
'use strict';
// Rutnät 9 × 9. Insidan är x 1–8 och y 1–7 (1 ruta ≈ 1,7 m).
// Rutor: 11 = vägg, 12 = fönster, 13 = vägg med tavla, MIRROR = spegel, DOOR + 11 = ytterdörr.

// ---- Texturer ----
function canvasOf(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}
function grain(g, w, h, seed, n, light, dark) {
  const r = seeded(seed);
  for (let i = 0; i < n; i++) {
    g.fillStyle = r() > 0.5 ? light : dark;
    g.fillRect(r() * w, r() * h, 1 + r() * 2, 1);
  }
}
// Väggens höjd är 1,4 enheter. Texturen är 128 × 180 px, så 1 enhet ≈ 128 px.
const WALL_PX = 180,
  zToPx = (z) => WALL_PX - (z / 1.4) * WALL_PX;
function paintedWall(g, w, h) {
  // Ljust gråbeige målad vägg med vit golvlist och taklist.
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#e6e1d6');
  grd.addColorStop(1, '#ddd6c8');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  grain(g, w, h, 61, 900, '#ffffff14', '#5a4a3010');
  g.fillStyle = '#f4f2ec';
  g.fillRect(0, h - 11, w, 11);
  g.fillStyle = '#c9c3b6';
  g.fillRect(0, h - 12, w, 1);
  g.fillStyle = '#f3f1ea';
  g.fillRect(0, 0, w, 5);
  g.fillStyle = '#cfc8ba';
  g.fillRect(0, 5, w, 1);
}
const homeTex = {
  wall: canvasOf(128, WALL_PX, paintedWall),
  poster: canvasOf(128, WALL_PX, (g, w, h) => {
    paintedWall(g, w, h);
    // Inramad affisch: stiliserad karta över Vasa med kustlinje och skärgård.
    const x = 22,
      y = 34,
      pw = 84,
      ph = 74;
    g.fillStyle = '#00000022';
    g.fillRect(x + 3, y + 4, pw, ph);
    g.fillStyle = '#2b2b2b';
    g.fillRect(x - 3, y - 3, pw + 6, ph + 6);
    g.fillStyle = '#f2ede2';
    g.fillRect(x, y, pw, ph);
    g.fillStyle = '#9cc3cf';
    g.fillRect(x + 6, y + 6, pw - 12, ph - 22);
    g.fillStyle = '#d9cfa9';
    g.beginPath();
    g.moveTo(x + 6, y + 6);
    g.lineTo(x + 50, y + 6);
    g.quadraticCurveTo(x + 40, y + 24, x + 56, y + 32);
    g.quadraticCurveTo(x + 42, y + 44, x + 48, y + ph - 16);
    g.lineTo(x + 6, y + ph - 16);
    g.fill();
    g.fillStyle = '#d9cfa9';
    for (const [a, b, r] of [
      [62, 20, 4],
      [70, 34, 3],
      [60, 46, 5],
      [72, 52, 2.5],
    ]) {
      g.beginPath();
      g.arc(x + a, y + b, r, 0, 7);
      g.fill();
    }
    g.fillStyle = '#3c3a35';
    g.font = '700 9px system-ui';
    g.textAlign = 'center';
    g.fillText('VASA · VAASA', x + pw / 2, y + ph - 5);
  }),
  bedHead: canvasOf(64, 64, (g, w, h) => {
    g.fillStyle = '#7f8c86';
    g.fillRect(0, 0, w, h);
    grain(g, w, h, 9, 500, '#ffffff18', '#00000014');
    g.fillStyle = '#00000022';
    for (let x = 8; x < w; x += 16) g.fillRect(x, 4, 2, h - 8);
  }),
  wood: canvasOf(64, 64, (g, w, h) => {
    g.fillStyle = '#b48a5e';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      g.fillStyle =
        'rgba(90,55,25,' + (0.05 + 0.05 * Math.sin(y * 0.9 + Math.sin(y * 0.13) * 3)) + ')';
      g.fillRect(0, y, w, 1);
    }
  }),
  fabric: canvasOf(64, 64, (g, w, h) => {
    g.fillStyle = '#5f7f8e';
    g.fillRect(0, 0, w, h);
    grain(g, w, h, 33, 900, '#ffffff12', '#00000016');
  }),
  wardrobe: canvasOf(128, 128, (g, w, h) => {
    g.fillStyle = '#f1efe9';
    g.fillRect(0, 0, w, h);
    grain(g, w, h, 5, 300, '#ffffff22', '#00000008');
    g.fillStyle = '#c8c3b8';
    g.fillRect(w / 2 - 1, 0, 2, h);
    g.fillRect(0, h - 6, w, 6);
    g.fillStyle = '#8b867b';
    g.fillRect(w / 2 - 9, h * 0.45, 3, 14);
    g.fillRect(w / 2 + 6, h * 0.45, 3, 14);
  }),
  drawer: canvasOf(64, 64, (g, w, h) => {
    g.fillStyle = '#c99e6d';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#a07a50';
    g.fillRect(0, h * 0.48, w, 2);
    g.fillStyle = '#5a4630';
    g.fillRect(w / 2 - 7, h * 0.24, 14, 3);
    g.fillRect(w / 2 - 7, h * 0.72, 14, 3);
  }),
  cabinet: canvasOf(128, 64, (g, w, h) => {
    g.fillStyle = '#4f6c68';
    g.fillRect(0, 0, w, h);
    grain(g, w, h, 21, 200, '#ffffff10', '#00000010');
    g.fillStyle = '#3e5653';
    for (let x = 0; x <= w; x += w / 4) g.fillRect(x - 1, 0, 2, h);
    g.fillStyle = '#d7d4cb';
    for (let x = w / 8; x < w; x += w / 4) g.fillRect(x - 6, 8, 12, 2);
  }),
  fridge: canvasOf(64, 160, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, '#dfe3e2');
    grd.addColorStop(0.5, '#f4f6f5');
    grd.addColorStop(1, '#d2d7d6');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#aab1b0';
    g.fillRect(0, h * 0.36, w, 2);
    g.fillStyle = '#868d8c';
    g.fillRect(6, h * 0.14, 3, 26);
    g.fillRect(6, h * 0.44, 3, 34);
    // Magneter och en lapp på dörren.
    g.fillStyle = '#ffeaa0';
    g.fillRect(30, h * 0.5, 18, 22);
    g.fillStyle = '#d65a4a';
    g.fillRect(37, h * 0.5 - 2, 4, 4);
  }),
  books: canvasOf(128, 160, (g, w, h) => {
    g.fillStyle = '#6d4c32';
    g.fillRect(0, 0, w, h);
    const r = seeded(77),
      colors = [
        '#a63d3d',
        '#3d5a8a',
        '#d9b35b',
        '#4e7d55',
        '#e5e0d4',
        '#2f2f35',
        '#8c5a9c',
        '#c96f3b',
      ];
    for (let s = 0; s < 4; s++) {
      const y0 = 6 + s * 38,
        y1 = y0 + 32;
      g.fillStyle = '#3e2a1c';
      g.fillRect(4, y0, w - 8, 32);
      let x = 6;
      while (x < w - 10) {
        const bw = 5 + r() * 7,
          bh = 18 + r() * 13;
        if (r() < 0.12) {
          x += bw;
          continue;
        }
        g.fillStyle = colors[Math.floor(r() * colors.length)];
        g.fillRect(x, y1 - bh, bw - 1, bh);
        g.fillStyle = '#ffffff30';
        g.fillRect(x + 1, y1 - bh + 3, bw - 3, 2);
        x += bw;
      }
      g.fillStyle = '#8a6447';
      g.fillRect(0, y1, w, 6);
    }
  }),
  tvStand: canvasOf(128, 32, (g, w, h) => {
    g.fillStyle = '#2f3436';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#3d4447';
    g.fillRect(4, 4, w / 2 - 6, h - 8);
    g.fillRect(w / 2 + 2, 4, w / 2 - 6, h - 8);
    g.fillStyle = '#70a8ff';
    g.fillRect(w * 0.8, h - 7, 3, 2);
  }),
  radiator: canvasOf(64, 32, (g, w, h) => {
    g.fillStyle = '#f2f2ee';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#d3d3cc';
    for (let x = 2; x < w; x += 5) g.fillRect(x, 2, 2, h - 4);
  }),
};
// Skärmar ritas om när spelets tid går, så TV:n och datorn ser levande ut.
function screenTex(kind) {
  return canvasOf(128, 80, (g, w, h) => {
    g.fillStyle = '#111518';
    g.fillRect(0, 0, w, h);
    if (kind === 'tv') {
      const grd = g.createLinearGradient(0, 4, 0, h - 4);
      grd.addColorStop(0, '#5d9fd6');
      grd.addColorStop(0.55, '#a9d1e6');
      grd.addColorStop(0.56, '#3f8a4a');
      grd.addColorStop(1, '#2f6e39');
      g.fillStyle = grd;
      g.fillRect(4, 4, w - 8, h - 8);
      g.fillStyle = '#ffffffcc';
      g.fillRect(4, 6, 30, 7);
      g.fillStyle = '#1b3f22';
      g.fillRect(6, 8, 26, 3);
      g.fillStyle = '#f5f1e4';
      for (const [x, y] of [
        [40, 52],
        [70, 58],
        [96, 50],
      ])
        g.fillRect(x, y, 3, 8);
    } else {
      g.fillStyle = '#1e2a33';
      g.fillRect(4, 4, w - 8, h - 8);
      g.fillStyle = '#92e2bf';
      g.fillRect(8, 8, 50, 6);
      for (let i = 0; i < 7; i++) {
        g.fillStyle = i % 3 ? '#9cb3c4' : '#ffcb83';
        g.fillRect(8 + (i % 2) * 8, 20 + i * 7, 30 + ((i * 37) % 60), 3);
      }
      g.fillStyle = '#2c3d49';
      g.fillRect(w - 46, 20, 38, 50);
    }
  });
}
function windowTex(night) {
  return canvasOf(128, WALL_PX, (g, w, h) => {
    paintedWall(g, w, h);
    const x0 = 14,
      x1 = w - 14,
      top = zToPx(1.2),
      bot = zToPx(0.42);
    // Utsikt: himmel, björkar och grannhus.
    const sky = g.createLinearGradient(0, top, 0, bot);
    sky.addColorStop(0, night ? '#0e1b2e' : '#7fb2d6');
    sky.addColorStop(1, night ? '#24344a' : '#d8e8ea');
    g.fillStyle = sky;
    g.fillRect(x0, top, x1 - x0, bot - top);
    g.fillStyle = night ? '#2a3442' : '#b8a58a';
    g.fillRect(x0, bot - 28, 46, 28);
    g.fillStyle = night ? '#f0c86a' : '#7e95a3';
    for (const [a, b] of [
      [x0 + 6, bot - 22],
      [x0 + 24, bot - 22],
    ])
      g.fillRect(a, b, 10, 8);
    g.fillStyle = night ? '#1b2a22' : '#5d8a4f';
    for (const [cx, cy, r] of [
      [x1 - 30, bot - 26, 18],
      [x1 - 14, bot - 34, 14],
      [x0 + 60, bot - 16, 12],
    ]) {
      g.beginPath();
      g.arc(cx, cy, r, 0, 7);
      g.fill();
    }
    if (night) {
      g.fillStyle = '#fff8';
      for (const [a, b] of [
        [30, top + 8],
        [80, top + 14],
        [100, top + 6],
      ])
        g.fillRect(a, b, 1.5, 1.5);
    }
    // Ljusreflex i glaset.
    g.fillStyle = '#ffffff1c';
    g.beginPath();
    g.moveTo(x0 + 10, bot);
    g.lineTo(x0 + 34, top);
    g.lineTo(x0 + 46, top);
    g.lineTo(x0 + 22, bot);
    g.fill();
    // Vit karm med spröjs, fönsterbräda.
    g.strokeStyle = '#f7f6f1';
    g.lineWidth = 6;
    g.strokeRect(x0, top, x1 - x0, bot - top);
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(w / 2, top);
    g.lineTo(w / 2, bot);
    g.moveTo(x0, top + (bot - top) * 0.32);
    g.lineTo(x1, top + (bot - top) * 0.32);
    g.stroke();
    g.fillStyle = '#ffffff';
    g.fillRect(x0 - 6, bot + 2, x1 - x0 + 12, 5);
    g.fillStyle = '#00000018';
    g.fillRect(x0 - 6, bot + 7, x1 - x0 + 12, 3);
    // Gardiner på sidorna.
    g.fillStyle = '#c9b48f';
    g.fillRect(2, top - 10, 12, bot - top + 26);
    g.fillRect(w - 14, top - 10, 12, bot - top + 26);
    g.fillStyle = '#00000014';
    for (const x of [5, 9, w - 11, w - 7]) g.fillRect(x, top - 10, 1, bot - top + 26);
  });
}
const homeWin = { day: windowTex(false), night: windowTex(true) };
const homeScreens = { tv: screenTex('tv'), pc: screenTex('pc') };

// Golvet: ekparkett i plankor och en mönstrad matta framför soffan.
const plank = (() => {
  const n = 128,
    data = new Uint8ClampedArray(n * n * 3),
    r = seeded(4242);
  const plankShade = [];
  for (let i = 0; i < 64; i++) plankShade.push(0.88 + r() * 0.2);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      // Plankor 1/4 ruta breda i x-led, förskjutna skarvar i y-led.
      const row = Math.floor(x / 32),
        len = (y + row * 53) % 128,
        seam = x % 32 === 0 || len === 0,
        k = plankShade[(row * 7 + Math.floor((y + row * 53) / 128)) % 64],
        wave = Math.sin(y * 0.35 + Math.sin(x * 0.2) * 2 + row) * 6,
        i = (y * n + x) * 3;
      data[i] = seam ? 150 : (184 + wave) * k;
      data[i + 1] = seam ? 116 : (146 + wave * 0.8) * k;
      data[i + 2] = seam ? 82 : (104 + wave * 0.6) * k;
    }
  return data;
})();
const RUG = { x0: 2.0, y0: 4.7, x1: 3.75, y1: 6.3 };
function homeFloor(wx, wy, out) {
  if (wx > RUG.x0 && wx < RUG.x1 && wy > RUG.y0 && wy < RUG.y1) {
    const u = (wx - RUG.x0) / (RUG.x1 - RUG.x0),
      v = (wy - RUG.y0) / (RUG.y1 - RUG.y0),
      edge = Math.min(u, 1 - u, v, 1 - v),
      fringe = edge < 0.02,
      border = edge < 0.09 && edge > 0.05,
      diamond = Math.abs(((u * 6) % 1) - 0.5) + Math.abs(((v * 5) % 1) - 0.5) < 0.12,
      n = ((Math.floor(wx * 90) * 7 + Math.floor(wy * 90) * 13) % 9) * 1.4;
    if (fringe) [out[0], out[1], out[2]] = [214, 206, 188];
    else if (border || diamond) [out[0], out[1], out[2]] = [62 + n, 70 + n, 78 + n];
    else [out[0], out[1], out[2]] = [222 - n, 214 - n, 198 - n];
    return;
  }
  const tx = ((Math.floor(wx * 150) % 128) + 128) % 128,
    ty = ((Math.floor(wy * 150) % 128) + 128) % 128,
    i = (ty * 128 + tx) * 3;
  out[0] = plank[i];
  out[1] = plank[i + 1];
  out[2] = plank[i + 2];
  // Mjuk skugga under möbler som står på golvet.
  const s = homeShadow(wx, wy);
  if (s < 1) {
    out[0] *= s;
    out[1] *= s;
    out[2] *= s;
  }
}
function homeCeiling(wx, wy, out) {
  out[0] = 238;
  out[1] = 235;
  out[2] = 228;
}
// Kontaktskugga: mörkare golv precis vid möblernas fötter och längs väggarna.
// Räknas ut en gång (16 punkter per ruta) och slås sedan upp per pixel.
let shadowMap = null;
function homeShadow(wx, wy) {
  if (!shadowMap) return 1;
  const i = clamp(Math.floor(wx * 16), 0, 143),
    j = clamp(Math.floor(wy * 16), 0, 143);
  return shadowMap[j * 144 + i];
}
function computeShadow(wx, wy) {
  let s = 1;
  const edge = Math.min(wx - 1, 8 - wx, wy - 1, 7 - wy);
  if (edge < 0.12) s = Math.min(s, 0.8 + edge * 1.6);
  for (const b of worlds.home.solids || []) {
    const dx = Math.max(b.x0 - wx, 0, wx - b.x1),
      dy = Math.max(b.y0 - wy, 0, wy - b.y1),
      d = Math.hypot(dx, dy);
    if (d < 0.12) s = Math.min(s, 0.62 + d * 3.1);
  }
  return s;
}

// ---- Bygg hemmet ----
function buildHome() {
  const w = makeWorld('home', 'Hemmet', 9);
  w.grid.forEach((row, y) =>
    row.forEach((_, x) => (row[x] = x === 0 || y === 0 || x === 8 || y >= 7 ? 11 : 0)),
  );
  w.grid[0][1] = 13; // tavla ovanför sängen
  w.grid[0][4] = MIRROR;
  w.grid[0][6] = 12; // fönster mot norr
  w.grid[5][0] = 12; // fönster bakom soffan
  w.grid[7][5] = DOOR + 11; // ytterdörren
  w.wallHeight = 1.4;
  w.wallTex = { 11: homeTex.wall, 12: homeWin.day, 13: homeTex.poster };
  w.mirror = { plane: 1, x0: 4, x1: 5 };
  w.spawn = { x: 5.5, y: 6.1, a: -Math.PI / 2 };
  w.floor = homeFloor;
  w.ceiling = homeCeiling;
  w.onRender = () => {
    w.wallTex[12] = lightNow.sun > 0.35 ? homeWin.day : homeWin.night;
  };
  w.lights = [
    { x: 4.5, y: 3.6, z: 0.75, power: 0.55, falloff: 0.32 }, // taklampa
    { x: 7.6, y: 2.45, z: 0.15, power: 0.32, falloff: 2.2 }, // skrivbordslampa
    { x: 1.4, y: 4.35, z: 0.45, power: 0.4, falloff: 1.1 }, // golvlampa
    { x: 2.33, y: 1.25, z: 0.15, power: 0.3, falloff: 2.4 }, // sänglampa
    { x: 6.5, y: 1.15, z: 0.2, power: 0.55, falloff: 0.35, day: true }, // fönster norr
    { x: 1.15, y: 5.5, z: 0.2, power: 0.45, falloff: 0.4, day: true }, // fönster väster
  ];
  const wood = [176, 132, 90],
    darkWood = [112, 80, 54],
    white = [238, 236, 230],
    metal = [70, 74, 78];
  const legs = (x0, y0, x1, y1, z, t = 0.035, color = darkWood) => {
    for (const [x, y] of [
      [x0, y0],
      [x1 - t, y0],
      [x0, y1 - t],
      [x1 - t, y1 - t],
    ])
      addBox(w, x, y, x + t, y + t, 0, z, { color, solid: false });
  };
  // Säng med sänggavel, madrass, täcke och kuddar.
  addBox(w, 1.08, 1.02, 2.07, 1.1, 0, 0.62, { color: [127, 140, 134], tex: homeTex.bedHead });
  addBox(w, 1.1, 1.1, 2.05, 2.4, 0, 0.16, { color: wood, tex: homeTex.wood });
  addBox(w, 1.13, 1.14, 2.02, 2.37, 0.16, 0.27, {
    color: white,
    top: [246, 245, 240],
    solid: false,
  });
  addBox(w, 1.11, 1.62, 2.04, 2.39, 0.2, 0.31, {
    color: [74, 104, 128],
    top: [86, 120, 146],
    solid: false,
  });
  addBox(w, 1.12, 1.55, 2.03, 1.66, 0.27, 0.315, { color: [236, 233, 225], solid: false });
  addBox(w, 1.18, 1.16, 1.56, 1.42, 0.27, 0.36, { color: [244, 242, 236], solid: false });
  addBox(w, 1.6, 1.16, 1.98, 1.42, 0.27, 0.36, { color: [244, 242, 236], solid: false });
  // Nattduksbord med lampa.
  addBox(w, 2.15, 1.06, 2.5, 1.4, 0, 0.3, {
    color: wood,
    tex: homeTex.wood,
    front: '+y',
    frontTex: homeTex.drawer,
  });
  addBox(w, 2.29, 1.2, 2.37, 1.28, 0.3, 0.42, { color: [60, 60, 62], solid: false });
  addBox(w, 2.24, 1.15, 2.42, 1.33, 0.42, 0.52, {
    color: [255, 236, 196],
    glow: true,
    solid: false,
  });
  // Växt bredvid spegeln.
  addBox(w, 3.25, 1.12, 3.5, 1.37, 0, 0.18, { color: [196, 112, 74] });
  // Spegelns ram (syns inte själv i spegeln).
  const frame = [40, 40, 42];
  addBox(w, 3.95, 0.97, 4.05, 1.05, 0, 1.4, { color: frame, mirror: false, solid: false });
  addBox(w, 4.95, 0.97, 5.05, 1.05, 0, 1.4, { color: frame, mirror: false, solid: false });
  addBox(w, 3.95, 0.97, 5.05, 1.05, 1.33, 1.4, { color: frame, mirror: false, solid: false });
  addBox(w, 3.95, 0.97, 5.05, 1.04, 0, 0.05, { color: frame, mirror: false, solid: false });
  // Element under norrfönstret.
  addBox(w, 6.12, 1.0, 6.88, 1.06, 0.08, 0.34, {
    color: white,
    tex: homeTex.radiator,
    solid: false,
  });
  // Skrivbord, skärm, tangentbord, lampa och stol.
  addBox(w, 7.38, 1.35, 7.96, 2.65, 0.43, 0.46, {
    color: [214, 196, 168],
    top: [222, 205, 176],
    solid: false,
  });
  legs(7.38, 1.35, 7.96, 2.65, 0.43, 0.04, metal);
  w.solids.push({ x0: 7.38, y0: 1.35, x1: 7.96, y1: 2.65 });
  addBox(w, 7.79, 1.95, 7.84, 2.05, 0.46, 0.53, { color: metal, solid: false });
  addBox(w, 7.76, 1.68, 7.82, 2.32, 0.53, 0.82, {
    color: [32, 34, 38],
    front: '-x',
    frontTex: homeScreens.pc,
    glow: false,
    solid: false,
  });
  addBox(w, 7.48, 1.82, 7.62, 2.18, 0.46, 0.468, {
    color: [52, 54, 58],
    top: [64, 66, 70],
    solid: false,
  });
  addBox(w, 7.5, 2.25, 7.58, 2.33, 0.46, 0.475, {
    color: [62, 62, 66],
    top: [44, 46, 50],
    solid: false,
  });
  addBox(w, 7.85, 2.43, 7.93, 2.52, 0.46, 0.48, { color: metal, solid: false });
  addBox(w, 7.87, 2.46, 7.9, 2.49, 0.48, 0.66, { color: metal, solid: false });
  addBox(w, 7.76, 2.4, 7.9, 2.55, 0.63, 0.67, { color: [255, 240, 205], glow: true, solid: false });
  addBox(w, 6.95, 1.82, 7.3, 2.18, 0.24, 0.28, { color: [48, 52, 58], solid: false });
  addBox(w, 6.9, 1.82, 6.95, 2.18, 0.28, 0.62, { color: [48, 52, 58], solid: false });
  addBox(w, 7.1, 1.97, 7.15, 2.03, 0, 0.24, { color: metal, solid: false });
  w.solids.push({ x0: 6.9, y0: 1.82, x1: 7.3, y1: 2.18 });
  // Hylla ovanför skrivbordet med böcker.
  addBox(w, 7.72, 1.5, 7.97, 2.55, 0.97, 1.0, { color: wood, solid: false });
  const r = seeded(12),
    bookColors = [
      [166, 61, 61],
      [61, 90, 138],
      [217, 179, 91],
      [78, 125, 85],
      [229, 224, 212],
    ];
  for (let y = 1.52; y < 2.2;) {
    const bw = 0.03 + r() * 0.03,
      bh = 0.12 + r() * 0.08;
    addBox(w, 7.78, y, 7.95, y + bw, 1.0, 1.0 + bh, {
      color: bookColors[Math.floor(r() * 5)],
      solid: false,
    });
    y += bw + 0.004;
  }
  // Bokhylla.
  addBox(w, 7.62, 3.0, 7.97, 3.95, 0, 1.15, {
    color: [109, 76, 50],
    tex: homeTex.wood,
    front: '-x',
    frontTex: homeTex.books,
  });
  // Garderob.
  addBox(w, 1.0, 2.85, 1.44, 4.15, 0, 1.25, {
    color: white,
    tex: homeTex.wardrobe,
    front: '+x',
    frontTex: homeTex.wardrobe,
  });
  // Golvlampa.
  addBox(w, 1.35, 4.3, 1.45, 4.4, 0, 0.03, { color: metal });
  addBox(w, 1.385, 4.335, 1.415, 4.365, 0.03, 0.82, { color: metal, solid: false });
  addBox(w, 1.28, 4.23, 1.52, 4.47, 0.82, 0.98, {
    color: [255, 232, 190],
    glow: true,
    solid: false,
  });
  // Soffa med kuddar.
  const sofa = [96, 118, 126];
  addBox(w, 1.05, 4.6, 1.62, 6.3, 0, 0.2, { color: [70, 84, 90], tex: homeTex.fabric });
  addBox(w, 1.18, 4.73, 1.62, 6.17, 0.2, 0.29, {
    color: sofa,
    top: [108, 132, 140],
    tex: homeTex.fabric,
    solid: false,
  });
  addBox(w, 1.05, 4.6, 1.22, 6.3, 0.2, 0.56, { color: sofa, tex: homeTex.fabric, solid: false });
  addBox(w, 1.05, 4.6, 1.62, 4.73, 0.2, 0.4, { color: sofa, tex: homeTex.fabric, solid: false });
  addBox(w, 1.05, 6.17, 1.62, 6.3, 0.2, 0.4, { color: sofa, tex: homeTex.fabric, solid: false });
  addBox(w, 1.22, 4.82, 1.33, 5.14, 0.29, 0.45, { color: [214, 160, 74], solid: false });
  addBox(w, 1.22, 5.82, 1.33, 6.12, 0.29, 0.45, { color: [226, 222, 210], solid: false });
  // Soffbord.
  addBox(w, 2.35, 5.15, 3.1, 5.85, 0.2, 0.235, { color: wood, top: [190, 146, 102], solid: false });
  legs(2.35, 5.15, 3.1, 5.85, 0.2, 0.035, darkWood);
  w.solids.push({ x0: 2.35, y0: 5.15, x1: 3.1, y1: 5.85 });
  addBox(w, 2.55, 5.35, 2.65, 5.45, 0.235, 0.3, { color: [236, 236, 232], solid: false });
  // TV-bänk och TV.
  addBox(w, 3.98, 4.85, 4.22, 6.15, 0, 0.26, {
    color: [47, 52, 54],
    tex: homeTex.tvStand,
    front: '-x',
    frontTex: homeTex.tvStand,
  });
  addBox(w, 4.07, 5.45, 4.13, 5.55, 0.26, 0.31, { color: metal, solid: false });
  addBox(w, 4.06, 4.98, 4.11, 6.02, 0.31, 0.82, {
    color: [20, 22, 24],
    front: '-x',
    frontTex: homeScreens.tv,
    solid: false,
  });
  // Kök: underskåp, bänkskiva, spis, diskho, överskåp och kylskåp.
  addBox(w, 7.38, 4.4, 7.96, 6.2, 0, 0.5, {
    color: [79, 108, 104],
    tex: homeTex.cabinet,
    front: '-x',
    frontTex: homeTex.cabinet,
  });
  addBox(w, 7.34, 4.4, 7.96, 6.2, 0.5, 0.55, {
    color: [218, 214, 206],
    top: [228, 224, 216],
    solid: false,
  });
  addBox(w, 7.46, 4.55, 7.86, 5.05, 0.55, 0.56, {
    color: [24, 24, 26],
    top: [28, 28, 30],
    solid: false,
  });
  for (const [cx, cy] of [
    [7.56, 4.66],
    [7.76, 4.66],
    [7.56, 4.92],
    [7.76, 4.92],
  ])
    addBox(w, cx - 0.06, cy - 0.06, cx + 0.06, cy + 0.06, 0.56, 0.563, {
      color: [60, 60, 64],
      top: [72, 70, 70],
      solid: false,
    });
  addBox(w, 7.5, 5.45, 7.85, 5.8, 0.545, 0.552, {
    color: [170, 176, 178],
    top: [160, 166, 168],
    solid: false,
  });
  addBox(w, 7.84, 5.58, 7.88, 5.66, 0.55, 0.7, { color: [190, 194, 196], solid: false });
  addBox(w, 7.72, 4.4, 7.97, 6.2, 0.86, 1.22, {
    color: [79, 108, 104],
    tex: homeTex.cabinet,
    front: '-x',
    frontTex: homeTex.cabinet,
    solid: false,
  });
  addBox(w, 7.3, 6.25, 7.96, 6.97, 0, 1.18, {
    color: [230, 233, 232],
    tex: homeTex.fridge,
    front: '-x',
    frontTex: homeTex.fridge,
  });
  // Köksbord med två stolar.
  addBox(w, 5.9, 4.62, 6.7, 5.3, 0.42, 0.45, {
    color: [236, 234, 228],
    top: [244, 242, 236],
    solid: false,
  });
  legs(5.9, 4.62, 6.7, 5.3, 0.42, 0.035, [200, 196, 188]);
  w.solids.push({ x0: 5.9, y0: 4.62, x1: 6.7, y1: 5.3 });
  for (const [y0, y1, by0, by1] of [
    [4.26, 4.56, 4.22, 4.26],
    [5.36, 5.66, 5.66, 5.7],
  ]) {
    addBox(w, 6.1, y0, 6.5, y1, 0.24, 0.27, { color: wood, solid: false });
    addBox(w, 6.1, by0, 6.5, by1, 0.27, 0.56, { color: wood, solid: false });
    legs(6.1, Math.min(y0, by0), 6.5, Math.max(y1, by1), 0.24, 0.03, darkWood);
    w.solids.push({ x0: 6.1, y0: Math.min(y0, by0), x1: 6.5, y1: Math.max(y1, by1) });
  }
  // Fruktskål på köksbordet.
  addBox(w, 6.22, 4.88, 6.38, 5.04, 0.45, 0.49, { color: [220, 120, 60], solid: false });
  // Taklampa med sladd.
  addBox(w, 4.49, 3.59, 4.51, 3.61, 1.3, 1.4, { color: [30, 30, 30], solid: false, mirror: true });
  addBox(w, 4.36, 3.46, 4.64, 3.74, 1.2, 1.3, { color: [255, 240, 210], glow: true, solid: false });
  // Hatthylla och skor vid dörren.
  addBox(w, 4.6, 6.86, 4.95, 6.98, 0, 0.08, { color: darkWood });
  addBox(w, 4.64, 6.78, 4.74, 6.9, 0.08, 0.13, { color: [40, 40, 44], solid: false });
  addBox(w, 4.78, 6.78, 4.88, 6.9, 0.08, 0.13, { color: [180, 70, 60], solid: false });
  // Växter (bladen ritas som en bild, krukan som låda).
  addBox(w, 1.22, 6.5, 1.5, 6.78, 0, 0.2, { color: [210, 205, 196] });
  obj(w, 3.375, 1.245, 'plant', '', null, { height: 0.6, z: 0.15, sprite: plantSprite(1) });
  obj(w, 1.36, 6.64, 'plant', '', null, { height: 0.75, z: 0.17, sprite: plantSprite(2) });
  buildMirrorBoxes(w);
  buildLightmap(w);
  shadowMap = new Float32Array(144 * 144);
  for (let j = 0; j < 144; j++)
    for (let i = 0; i < 144; i++)
      shadowMap[j * 144 + i] = computeShadow((i + 0.5) / 16, (j + 0.5) / 16);
  // Det man kan göra hemma. Möblerna syns, så markeringarna är osynliga och bara etiketten visas.
  const spot = (x, y, label, action) => {
    const o = station(w, x, y, 'home', label, action);
    o.hidden = true;
    o.height = 0.7;
    return o;
  };
  spot(1.6, 2.6, 'Sängen · vila eller sov', sleep);
  spot(6.75, 2.0, 'Skrivbordet · studieplan och examensprov', homeDesk);
  spot(1.75, 3.5, 'Garderoben', wardrobe);
  spot(4.5, 1.25, 'Spegeln', mirrorLook);
  spot(7.05, 6.55, 'Köket · laga mat eller koka kaffe', kitchen);
  spot(2.75, 5.5, 'Soffan · titta på TV', watchTv);
  spot(3.9, 6.55, 'Hallen · inred hemmet och boende', homeShop);
  spot(6.3, 4.95, 'Köksbordet · hemmafest', () => (homeParty ? endHomeParty() : partyInvite()));
  const exit = spot(5.5, 6.55, 'Gå ut till campus', () =>
    changeWorld('outdoor', { x: 48.5, y: 57.0, a: -Math.PI / 2 }),
  );
  exit.type = 'portal';
  exit.target = 'outdoor';
  exit.height = 1.2;
  return w;
}
function plantSprite(kind) {
  const key = 'plant' + kind;
  if (cache[key]) return cache[key];
  const c = canvasOf(128, 160, (g, w, h) => {
    const r = seeded(kind * 91);
    g.lineCap = 'round';
    for (let i = 0; i < (kind === 1 ? 14 : 22); i++) {
      const a = -Math.PI / 2 + (r() - 0.5) * 2.4,
        len = 50 + r() * 90,
        x2 = 64 + Math.cos(a) * len * 0.55,
        y2 = h - 6 + Math.sin(a) * len;
      g.strokeStyle = '#4f7a3a';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(64, h - 6);
      g.quadraticCurveTo(64 + (x2 - 64) * 0.3, y2 + 30, x2, y2);
      g.stroke();
      g.fillStyle = r() > 0.4 ? '#5f9447' : '#3f6e33';
      g.beginPath();
      g.ellipse(x2, y2, kind === 1 ? 14 : 9, kind === 1 ? 7 : 20, a + Math.PI / 2, 0, 7);
      g.fill();
    }
  });
  cache[key] = c;
  return c;
}
// ---- Saker att göra hemma ----
function mirrorLook() {
  const p = profile(),
    out = outfits.find((o) => o.id === state.outfit),
    mood = state.stats.happy;
  dialog(
    'Spegeln',
    '<p>' +
      esc(p.name.split(' ')[0]) +
      ' i ' +
      esc(out.name.toLowerCase()) +
      '. ' +
      (mood > 70
        ? 'Du ser riktigt nöjd ut idag.'
        : mood > 40
          ? 'Det ser helt okej ut.'
          : 'Lite trött i blicken. Kanske dags för något roligt?') +
      '</p>',
    [
      { label: 'Byt kläder', primary: true, run: wardrobe },
      { label: 'Stäng', run: close },
    ],
    'Hemma',
  );
}
// Köket: laga mat eller koka kaffe (gratis hemma, se js/game/coffee.js).
function kitchen() {
  dialog(
    'Köket',
    '<p>Vad blir det?</p>',
    [
      { label: 'Laga middag', primary: true, run: () => (close(), cookAtHome()) },
      { label: coffeeLabel(true), run: () => (close(), drinkCoffee(true)) },
      { label: 'Tillbaka', run: close },
    ],
    'Hemma',
  );
}
function cookAtHome() {
  if (isNauseous()) return toast('Du mår för illa för att äta. Vatten hjälper.');
  // I studentkorridoren delar man kök och handlar billigare tillsammans.
  const price = state.home?.typ === 'korridor' ? 2 : 3;
  if (state.money < price)
    return toast('Kylskåpet är tomt. Det kostar ' + price + ' € att handla till en enkel middag.');
  state.money -= price;
  tutorialDone('lunch');
  gain('hunger', 35);
  gain('happy', 2);
  advance(25);
  save();
  sound('win');
  toast('Du lagade pasta hemma för ' + price + ' €. +35 mättnad.');
}
function watchTv() {
  gain('happy', 6);
  gain('energy', 4);
  advance(45);
  save();
  toast('Ett avsnitt i soffan. +6 glädje, 45 minuter.');
}

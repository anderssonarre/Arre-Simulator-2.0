// Björk och gran (lövträdet finns i sprites.js). Varje sort finns i några varianter.
'use strict';
function birchSprite(v = 0) {
  const key = 'birch' + v;
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas');
  c.width = 220;
  c.height = 420;
  const g = c.getContext('2d'),
    r = seeded(500 + v * 17);
  g.fillStyle = '#13251820';
  g.beginPath();
  g.ellipse(110, 412, 46, 7, 0, 0, 7);
  g.fill();
  // Vit stam med svarta fläckar, lätt lutande.
  const lean = (r() - 0.5) * 18;
  g.fillStyle = '#ece9df';
  g.beginPath();
  g.moveTo(102, 416);
  g.lineTo(108 + lean, 90);
  g.lineTo(116 + lean, 90);
  g.lineTo(118, 416);
  g.fill();
  for (let i = 0; i < 26; i++) {
    const y = 120 + r() * 290,
      t = (416 - y) / 326;
    g.fillStyle = '#2b2a28';
    g.fillRect(103 + lean * t + r() * 10, y, 3 + r() * 7, 2 + r() * 2);
  }
  // Hängande grenar och ljust, glest lövverk.
  g.strokeStyle = '#5d5040';
  g.lineWidth = 2;
  for (let i = 0; i < 16; i++) {
    const y = 110 + r() * 150;
    g.beginPath();
    g.moveTo(112 + lean * ((416 - y) / 326), y);
    g.quadraticCurveTo(110 + (r() - 0.5) * 140, y - 30, 110 + (r() - 0.5) * 170, y + 40 + r() * 40);
    g.stroke();
  }
  for (let i = 0; i < 900; i++) {
    const a = r() * Math.PI * 2,
      rad = Math.sqrt(r()),
      x = 110 + lean * 0.6 + Math.cos(a) * 82 * rad,
      y = 175 + Math.sin(a) * 120 * rad;
    const shade = y < 140 ? 0 : y > 240 ? 2 : 1;
    g.fillStyle = ['#a8c46a', '#86a855', '#5f8240'][shade];
    g.globalAlpha = 0.75;
    g.beginPath();
    g.ellipse(x, y, 4 + r() * 3, 2.5 + r() * 2, r() * 3, 0, 7);
    g.fill();
  }
  g.globalAlpha = 1;
  cache[key] = c;
  return c;
}
function spruceSprite(v = 0) {
  const key = 'spruce' + v;
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas');
  c.width = 200;
  c.height = 420;
  const g = c.getContext('2d'),
    r = seeded(900 + v * 31);
  g.fillStyle = '#13251826';
  g.beginPath();
  g.ellipse(100, 412, 52, 8, 0, 0, 7);
  g.fill();
  g.fillStyle = '#5a4433';
  g.fillRect(94, 340, 12, 76);
  // Grenvåningar från botten och upp, mörkare i skuggan.
  const layers = 11;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1),
      y = 360 - t * 330,
      half = 88 * (1 - t) + 8;
    for (let k = 0; k < 2; k++) {
      g.fillStyle = k ? '#2f5638' : '#20402a';
      g.beginPath();
      g.moveTo(100, y - 52);
      g.lineTo(100 - half - (k ? -6 : 0), y + 4 + r() * 6);
      for (let s = -half; s <= half; s += 12)
        g.lineTo(100 + s, y + (Math.abs(s) % 24 < 12 ? 10 : 2) - k * 4);
      g.lineTo(100 + half + (k ? -6 : 0), y + 4 + r() * 6);
      g.closePath();
      g.fill();
    }
    g.fillStyle = '#4f7a4c55';
    for (let s = 0; s < 6; s++)
      g.fillRect(100 - half * 0.7 + r() * half * 1.2, y - 18 + r() * 14, 3, 2);
  }
  cache[key] = c;
  return c;
}

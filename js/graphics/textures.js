// Fasader, marktexturer, skyltar och miljö
'use strict';
const wallTextures = [];
for (const [base, line] of [
  ['#d8d7c9', '#b4b7af'],
  ['#bfccb9', '#98ad98'],
  ['#647e91', '#425e74'],
  ['#b79c7d', '#91775e'],
  ['#d7c7b4', '#b09d88'],
]) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 120; i++) {
    g.fillStyle = 'rgba(30,45,40,.035)';
    g.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
  }
  g.fillStyle = line;
  for (let y = 0; y < 64; y += 16) {
    g.fillRect(0, y, 64, 1);
    g.fillRect(y % 32 === 0 ? 32 : 0, y, 1, 16);
  }
  wallTextures.push(c);
}
// Facade materials follow the supplied Look Around references, not generic campus blocks.
function facade(base, rows, window = true) {
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 384;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 192, 384);
  for (let y = 0; y < 384; y += 6) {
    g.fillStyle = '#dbc6ae55';
    g.fillRect(0, y, 192, 1);
    for (let x = y % 12 ? 0 : 12; x < 192; x += 24) {
      g.fillRect(x, y, 1, 6);
      g.fillStyle = 'rgba(54,28,14,' + (0.05 + ((x * y) % 11) * 0.009) + ')';
      g.fillRect(x + 1, y + 1, 22, 4);
      g.fillStyle = '#dbc6ae55';
    }
  }
  g.fillStyle = '#818a88';
  g.fillRect(0, 0, 192, 7);
  g.fillStyle = '#99958b';
  g.fillRect(0, 365, 192, 19);
  if (window)
    for (let row = 0; row < rows; row++) {
      const y = 30 + row * (325 / rows);
      for (let x = 24; x < 192; x += 64) {
        g.fillStyle = '#513f34';
        g.fillRect(x - 3, y - 3, 34, 55);
        g.fillStyle = '#dddcd0';
        g.fillRect(x, y, 28, 49);
        g.fillStyle = '#557484';
        g.fillRect(x + 3, y + 3, 22, 43);
        g.fillStyle = '#9eb6b9';
        g.fillRect(x + 6, y + 4, 7, 40);
        g.fillStyle = '#e1ded1';
        g.fillRect(x + 12, y, 2, 49);
      }
    }
  else {
    for (let x = 0; x < 192; x += 64) {
      g.fillStyle = '#634b3b66';
      g.fillRect(x, 22, 6, 344);
      g.fillStyle = '#d1aa7e55';
      g.fillRect(x + 6, 22, 2, 344);
    }
    g.fillStyle = '#513b3180';
    g.fillRect(0, 22, 192, 7);
  }
  return c;
}
wallTextures.push(
  facade('#a87654', 4),
  facade('#88644e', 1, false),
  facade('#91634e', 2),
  facade('#a57350', 0, false),
);
const TEXTURE_PACK = { name: 'Campus Vasa HD', version: 1 };
function surfaceTexture(type) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d'),
    r = seeded(type === 'grass' ? 18 : type === 'asphalt' ? 74 : 29);
  let base =
    type === 'grass'
      ? [93, 119, 60]
      : type === 'asphalt'
        ? [108, 112, 113]
        : type === 'wood'
          ? [151, 119, 82]
          : [166, 170, 162];
  const im = g.createImageData(128, 128);
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const n = (r() - 0.5) * (type === 'grass' ? 42 : 22),
        seam =
          type === 'paving' && (x % 64 < 2 || y % 64 < 2)
            ? -26
            : type === 'wood'
              ? Math.sin(y * 0.6 + x * 0.035) * 7
              : 0,
        i = (y * 128 + x) * 4;
      for (let k = 0; k < 3; k++) im.data[i + k] = base[k] + n + seam;
      im.data[i + 3] = 255;
    }
  g.putImageData(im, 0, 0);
  return { canvas: c, data: im.data };
}
const groundPack = {
  grass: surfaceTexture('grass'),
  asphalt: surfaceTexture('asphalt'),
  paving: surfaceTexture('paving'),
  wood: surfaceTexture('wood'),
};
// Fine grain and weathering applied once when loading, never regenerated per frame.
for (let t = 0; t < wallTextures.length; t++) {
  const c = wallTextures[t],
    g = c.getContext('2d'),
    r = seeded(810 + t);
  for (let n = 0; n < 2200; n++) {
    g.fillStyle = r() > 0.5 ? '#f5e4c30a' : '#321d140a';
    g.fillRect(r() * c.width, r() * c.height, 1 + r() * 3, 1 + r() * 2);
  }
  if (t >= 5) {
    g.fillStyle = '#35403818';
    for (let n = 0; n < 12; n++)
      g.fillRect(
        r() * c.width,
        c.height * 0.72 + r() * c.height * 0.2,
        2 + r() * 9,
        c.height * 0.15,
      );
  }
}
// Indoor plaster replaces oversized masonry blocks; physical outlines stay unchanged.
{
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d'),
    r = seeded(450);
  g.fillStyle = '#d8d5c7';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = r() > 0.5 ? '#fff1' : '#574c3b0b';
    g.fillRect(r() * 256, r() * 256, 1, 1);
  }
  g.fillStyle = '#9bada5';
  g.fillRect(0, 185, 256, 62);
  g.fillStyle = '#536c67';
  g.fillRect(0, 245, 256, 11);
  g.fillStyle = '#fff4';
  g.fillRect(0, 183, 256, 2);
  wallTextures[0] = c;
}
const facadeHeights = { 6: 4.6, 7: 2.4, 8: 3, 9: 5.3 };
function signSprite(text, bg = '#24483f') {
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 100;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(2, 2, 316, 96);
  g.strokeStyle = '#d2e2d4';
  g.strokeRect(5, 5, 310, 90);
  g.fillStyle = '#fff9e8';
  g.font = '600 28px system-ui';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 160, 50, 290);
  return c;
}
function sign(w, x, y, text, height = 0.28, z = 1.05) {
  obj(w, x, y, 'sign', '', null, { height, z, sprite: signSprite(text) });
}
function scenery(type) {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 240;
  const g = c.getContext('2d');
  if (type === 'saw') {
    g.fillStyle = '#91a5b1';
    g.beginPath();
    g.moveTo(0, 238);
    g.lineTo(0, 210);
    g.lineTo(55, 100);
    g.lineTo(55, 210);
    g.lineTo(110, 100);
    g.lineTo(110, 210);
    g.lineTo(160, 112);
    g.lineTo(160, 240);
    g.fill();
    g.strokeStyle = '#516878';
    g.lineWidth = 5;
    for (let x = 0; x < 160; x += 55) {
      g.beginPath();
      g.moveTo(x, 210);
      g.lineTo(x + 55, 100);
      g.lineTo(x + 55, 238);
      g.stroke();
    }
  } else if (type === 'chimney') {
    g.fillStyle = '#725b4f';
    g.beginPath();
    g.moveTo(62, 240);
    g.lineTo(70, 20);
    g.lineTo(91, 20);
    g.lineTo(100, 240);
    g.fill();
    g.fillStyle = '#4c4b48';
    g.fillRect(66, 17, 30, 8);
  } else if (type === 'lamp') {
    g.fillStyle = '#a8b0ad';
    g.fillRect(77, 50, 5, 190);
    g.fillRect(77, 45, 60, 5);
    g.fillStyle = '#d1d2c1';
    g.fillRect(117, 49, 25, 7);
  } else if (type === 'canopy') {
    g.fillStyle = '#b1b5a5';
    g.fillRect(0, 72, 160, 9);
    g.fillStyle = '#e2d9c3';
    g.fillRect(9, 80, 12, 158);
    g.fillRect(139, 80, 12, 158);
    g.fillStyle = '#556769';
    g.fillRect(28, 100, 103, 132);
    g.fillStyle = '#b7c4bd';
    g.fillRect(33, 105, 43, 112);
    g.fillRect(83, 105, 43, 112);
    g.fillStyle = '#b7b3a2';
    g.fillRect(0, 225, 160, 15);
  } else if (type === 'towerglass') {
    g.fillStyle = '#b9bfb5';
    g.fillRect(66, 0, 27, 240);
    g.fillStyle = '#48616a';
    g.fillRect(70, 0, 19, 240);
    for (let y = 12; y < 240; y += 24) {
      g.fillStyle = '#d2d4cb';
      g.fillRect(68, y, 24, 3);
    }
  }
  return c;
}
function sceneProp(w, x, y, type, height, z = 0) {
  obj(w, x, y, type, '', null, { height, z, sprite: scenery(type) });
}
// Bostadshuset där du bor: ljusgul puts, vita fönster med balkongräcke.
wallTextures.push(
  (() => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 256;
    const g = c.getContext('2d'),
      r = seeded(1010);
    g.fillStyle = '#e4d39f';
    g.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = r() > 0.5 ? '#ffffff12' : '#6b5a2a10';
      g.fillRect(r() * 128, r() * 256, 1 + r() * 2, 1);
    }
    g.fillStyle = '#9a9a92';
    g.fillRect(0, 0, 128, 8);
    g.fillStyle = '#b8b2a2';
    g.fillRect(0, 238, 128, 18);
    g.fillStyle = '#d7c58f';
    g.fillRect(0, 118, 128, 4);
    // Två våningar med fönster. Nedre våningens fönster ligger vid sidan så att dörren får plats.
    for (const [x, y] of [
      [14, 26],
      [74, 26],
    ]) {
      g.fillStyle = '#f6f4ee';
      g.fillRect(x - 3, y - 3, 46, 66);
      g.fillStyle = '#5f7f8e';
      g.fillRect(x, y, 40, 60);
      g.fillStyle = '#a9c6cc';
      g.fillRect(x + 4, y + 4, 12, 52);
      g.fillStyle = '#f6f4ee';
      g.fillRect(x + 19, y, 3, 60);
      g.fillStyle = '#ffffffaa';
      g.fillRect(x - 5, y + 62, 50, 3);
    }
    g.fillStyle = '#f6f4ee';
    g.fillRect(4, 148, 22, 50);
    g.fillRect(102, 148, 22, 50);
    g.fillStyle = '#5f7f8e';
    g.fillRect(7, 151, 16, 44);
    g.fillRect(105, 151, 16, 44);
    return c;
  })(),
);
facadeHeights[10] = 2.6;

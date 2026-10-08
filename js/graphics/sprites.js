// Figurer, träd och föremål
'use strict';
function npcSprite(p, pose = 0) {
  const key = 'npcHD' + p.id + p.color + pose;
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 256;
  const g = c.getContext('2d'),
    female = ['ida', 'jennifer'].includes(p.id),
    skin = p.skin || '#e5b89b',
    stride = [0, 8, 0, -8][pose % 4];
  g.fillStyle = '#10192135';
  g.beginPath();
  g.ellipse(80, 247, 39, 7, 0, 0, 7);
  g.fill();
  function limb(x, y, x2, y2, width, color) {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x2, y2);
    g.stroke();
  }
  const pants = g.createLinearGradient(50, 0, 110, 0);
  pants.addColorStop(0, '#182b37');
  pants.addColorStop(0.5, '#475766');
  pants.addColorStop(1, '#202e39');
  limb(66, 165, 61 - stride * 0.45, 236 + stride * 0.25, 23, pants);
  limb(94, 165, 100 + stride * 0.45, 236 - stride * 0.25, 23, pants);
  g.fillStyle = '#152027';
  g.beginPath();
  g.roundRect(45 - stride * 0.45, 233 + stride * 0.25, 32, 13, 6);
  g.roundRect(88 + stride * 0.45, 233 - stride * 0.25, 31, 13, 6);
  g.fill();
  g.fillStyle = '#a8b3af';
  g.fillRect(47 - stride * 0.45, 244 + stride * 0.25, 28, 2);
  g.fillRect(90 + stride * 0.45, 244 - stride * 0.25, 27, 2);
  limb(47, 101, 36 + stride * 0.6, 158 - stride * 0.5, 19, p.color);
  limb(113, 101, 124 - stride * 0.6, 158 + stride * 0.5, 19, p.color);
  limb(36 + stride * 0.6, 158 - stride * 0.5, 37 + stride * 0.6, 171 - stride * 0.5, 14, skin);
  limb(124 - stride * 0.6, 158 + stride * 0.5, 123 - stride * 0.6, 171 + stride * 0.5, 14, skin);
  g.fillStyle = p.color;
  g.beginPath();
  g.moveTo(55, 89);
  g.quadraticCurveTo(80, 80, 105, 89);
  g.quadraticCurveTo(119, 118, 111, 169);
  g.quadraticCurveTo(80, 178, 49, 169);
  g.quadraticCurveTo(42, 119, 55, 89);
  g.fill();
  const shade = g.createLinearGradient(45, 0, 116, 0);
  shade.addColorStop(0, '#0005');
  shade.addColorStop(0.35, '#fff2');
  shade.addColorStop(0.7, '#fff0');
  shade.addColorStop(1, '#0005');
  g.fillStyle = shade;
  g.fill();
  g.strokeStyle = '#ffffff26';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(62, 101);
  g.lineTo(59, 153);
  g.moveTo(99, 113);
  g.lineTo(102, 160);
  g.stroke();
  g.fillStyle = '#0d1b2833';
  g.fillRect(78, 98, 3, 66);
  g.fillStyle = skin;
  g.fillRect(70, 71, 20, 22);
  if (female) {
    g.fillStyle = p.hair;
    g.beginPath();
    g.ellipse(80, 51, 34, 45, 0, 0, 7);
    g.fill();
  }
  const face = g.createRadialGradient(69, 43, 3, 80, 52, 37);
  face.addColorStop(0, '#f7d8bc');
  face.addColorStop(0.65, skin);
  face.addColorStop(1, '#ad7d64');
  g.fillStyle = face;
  g.beginPath();
  g.ellipse(80, 48, 26, 34, 0, 0, 7);
  g.fill();
  g.fillStyle = p.hair;
  g.beginPath();
  g.moveTo(52, 44);
  g.bezierCurveTo(42, 2, 119, 1, 108, 45);
  g.lineTo(98, 25);
  g.quadraticCurveTo(76, 35, 57, 27);
  g.closePath();
  g.fill();
  g.fillStyle = '#f7ece3';
  g.beginPath();
  g.ellipse(69, 48, 6, 3, 0, 0, 7);
  g.ellipse(91, 48, 6, 3, 0, 0, 7);
  g.fill();
  g.fillStyle = '#293532';
  g.beginPath();
  g.arc(70, 48, 2.4, 0, 7);
  g.arc(90, 48, 2.4, 0, 7);
  g.fill();
  g.strokeStyle = p.hair;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(63, 40);
  g.lineTo(74, 39);
  g.moveTo(86, 39);
  g.lineTo(98, 41);
  g.stroke();
  g.strokeStyle = '#af7968';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(80, 48);
  g.lineTo(77, 59);
  g.lineTo(82, 59);
  g.moveTo(72, 67);
  g.quadraticCurveTo(80, 71, 89, 66);
  g.stroke();
  if (p.id === 'arvid') {
    g.fillStyle = '#121923';
    g.beginPath();
    g.roundRect(50, 13, 60, 19, 7);
    g.fill();
    g.fillRect(72, 29, 46, 5);
  }
  if (['zeb', 'rasmus', 'mats'].includes(p.id)) {
    g.strokeStyle = '#334450';
    g.lineWidth = 2;
    g.strokeRect(60, 43, 17, 11);
    g.strokeRect(84, 43, 17, 11);
    g.beginPath();
    g.moveTo(77, 47);
    g.lineTo(84, 47);
    g.stroke();
  }
  if (['vilhelm', 'tobias'].includes(p.id)) {
    g.fillStyle = '#d3b96c';
    g.fillRect(56, 110, 15, 4);
  }
  cache[key] = c;
  return c;
}
function leafyTree() {
  if (cache.leafy) return cache.leafy;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 384;
  const g = c.getContext('2d'),
    r = seeded(274);
  g.fillStyle = '#13251824';
  g.beginPath();
  g.ellipse(130, 374, 62, 9, 0, 0, 7);
  g.fill();
  g.fillStyle = '#6e6750';
  g.beginPath();
  g.moveTo(116, 377);
  g.lineTo(123, 171);
  g.lineTo(136, 166);
  g.lineTo(143, 377);
  g.fill();
  g.strokeStyle = '#544a3b';
  g.lineWidth = 5;
  for (let i = 0; i < 20; i++) {
    g.beginPath();
    g.moveTo(130, 250 - i * 5);
    g.lineTo(30 + r() * 190, 75 + r() * 150);
    g.stroke();
  }
  for (let i = 0; i < 850; i++) {
    const a = r() * Math.PI * 2,
      rad = Math.sqrt(r()),
      x = 128 + Math.cos(a) * 108 * rad,
      y = 130 + Math.sin(a) * 106 * rad;
    g.fillStyle = ['#355a35', '#477842', '#65904a', '#759b51', '#839f58'][Math.floor(r() * 5)];
    g.beginPath();
    g.ellipse(x, y, 5 + r() * 13, 4 + r() * 9, a, 0, 7);
    g.fill();
  }
  cache.leafy = c;
  return c;
}
function propSprite(type, color = '#92e2bf') {
  if (type === 'tree') return leafyTree();
  const key = type + color;
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 128;
  const g = c.getContext('2d');
  if (type === 'tree') {
    g.fillStyle = '#72543a';
    g.fillRect(42, 62, 10, 60);
    for (const [x, y, r] of [
      [47, 42, 35],
      [29, 61, 24],
      [67, 61, 24],
    ]) {
      g.fillStyle = y === 42 ? '#669877' : '#4b7e63';
      g.beginPath();
      g.arc(x, y, r, 0, 7);
      g.fill();
    }
  } else if (type === 'desk') {
    g.fillStyle = '#647583';
    g.fillRect(19, 85, 5, 37);
    g.fillRect(74, 85, 5, 37);
    g.fillStyle = '#aa865e';
    g.fillRect(10, 76, 78, 12);
    g.fillStyle = '#263c4a';
    g.fillRect(34, 49, 32, 23);
    g.fillStyle = '#90d6cb';
    g.fillRect(38, 53, 24, 14);
    g.fillStyle = '#465e66';
    g.fillRect(46, 71, 7, 5);
  } else if (type === 'bed') {
    g.fillStyle = '#55665e';
    g.fillRect(14, 73, 68, 45);
    g.fillStyle = '#a5c9be';
    g.fillRect(14, 70, 68, 31);
    g.fillStyle = '#dde7df';
    g.fillRect(21, 65, 23, 12);
  } else if (type === 'gym') {
    g.strokeStyle = '#859baa';
    g.lineWidth = 9;
    g.strokeRect(16, 29, 64, 86);
    g.fillStyle = '#243d52';
    g.fillRect(31, 76, 35, 11);
    g.strokeStyle = '#d6dfe2';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(8, 45);
    g.lineTo(88, 45);
    g.stroke();
    g.fillStyle = '#42555c';
    g.fillRect(9, 31, 14, 28);
    g.fillRect(73, 31, 14, 28);
  } else if (type === 'wardrobe') {
    g.fillStyle = '#99795a';
    g.fillRect(16, 18, 66, 103);
    g.fillStyle = '#bea48a';
    g.fillRect(20, 22, 28, 93);
    g.fillRect(51, 22, 26, 93);
    g.fillStyle = '#ddd9ba';
    g.fillRect(42, 63, 3, 14);
    g.fillRect(54, 63, 3, 14);
  } else {
    g.fillStyle = color + '22';
    g.beginPath();
    g.ellipse(48, 115, 35, 10, 0, 0, 7);
    g.fill();
    g.strokeStyle = color;
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(48, 115, 34, 8, 0, 0, 7);
    g.stroke();
    g.fillStyle = color;
    g.beginPath();
    g.roundRect(26, 50, 44, 44, 12);
    g.fill();
    g.fillStyle = '#16332d';
    g.font = 'bold 28px system-ui';
    g.textAlign = 'center';
    g.fillText(
      type === 'portal'
        ? '↗'
        : type === 'food'
          ? '☕'
          : type === 'study'
            ? '▤'
            : type === 'exam'
              ? '✓'
              : type === 'job'
                ? '€'
                : 'E',
      48,
      82,
    );
  }
  cache[key] = c;
  return c;
}

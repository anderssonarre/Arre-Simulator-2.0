// 3D-figurer för personerna: kropp, armar och ben som rör sig när de går, och huvud med
// samma ansikte som i den klassiska grafiken (målat runt ett klot).
'use strict';
const FIG = { cache: new Map(), heads: new Map(), mats: new Map() };
const FEMALE = ['ida', 'jennifer'];
function figMat(color) {
  let m = FIG.mats.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.8 });
    FIG.mats.set(color, m);
  }
  return m;
}
// Huvudets textur: ansiktet från figuren i den klassiska grafiken framtill, hår bak och upptill.
function headTexture(p) {
  const key = p.id + (p.skin || '') + (p.hair || '');
  if (FIG.heads.has(key)) return FIG.heads.get(key);
  const src = npcSprite({ ...p, color: '#000000' }, 0),
    skin = p.skin || '#e5b89b',
    c = canvasOf2(512, 256, (g) => {
      g.fillStyle = skin;
      g.fillRect(0, 0, 512, 256);
      // Hår över hela hjässan och baktill.
      g.fillStyle = p.hair || '#2a1d14';
      g.fillRect(0, 0, 512, FEMALE.includes(p.id) ? 120 : 92);
      g.fillRect(256, 0, 256, FEMALE.includes(p.id) ? 256 : 150);
      g.beginPath();
      g.ellipse(384, 150, 150, 60, 0, 0, 7);
      g.fill();
      // Ansiktet (ögon, mun, glasögon, keps) mitt fram, u = 0,25.
      g.drawImage(src, 46, 0, 68, 86, 128 - 74, 20, 148, 200);
    });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  FIG.heads.set(key, t);
  return t;
}
function makeFigure(p) {
  const g = new THREE.Group(),
    skin = figMat(p.skin || '#e5b89b'),
    pants = figMat(['albin'].includes(p.id) ? '#2b3138' : '#26323d'),
    shoes = figMat('#151b20'),
    shirt = new THREE.MeshStandardMaterial({ color: new THREE.Color(p.color), roughness: 0.85 }),
    limb = (r, len, mat) => {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), mat);
      m.position.y = -len / 2 - r * 0.6;
      const pivot = new THREE.Group();
      pivot.add(m);
      return pivot;
    };
  // Ben med skor, höften på 0,5.
  const legL = limb(0.048, 0.38, pants),
    legR = limb(0.048, 0.38, pants);
  for (const [leg, x] of [
    [legL, -0.065],
    [legR, 0.065],
  ]) {
    leg.position.set(x, 0.5, 0);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.15), shoes);
    shoe.position.set(0, -0.47, 0.025);
    leg.add(shoe);
    g.add(leg);
  }
  // Överkropp.
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.2, 4, 10), shirt);
  torso.scale.set(1.3, 1, 0.78);
  torso.position.y = 0.69;
  g.add(torso);
  // Armar med händer, axlarna på 0,84.
  const armL = limb(0.037, 0.28, shirt),
    armR = limb(0.037, 0.28, shirt);
  for (const [arm, x] of [
    [armL, -0.175],
    [armR, 0.175],
  ]) {
    arm.position.set(x, 0.84, 0);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), skin);
    hand.position.y = -0.4;
    arm.add(hand);
    g.add(arm);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.06, 8), skin);
  neck.position.y = 0.88;
  g.add(neck);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshStandardMaterial({ map: headTexture(p), roughness: 0.7 }),
  );
  head.scale.set(0.105, 0.13, 0.11);
  head.position.y = 1.0;
  g.add(head);
  g.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
  g.userData = { legL, legR, armL, armR, head, torso, shirt, heading: 0, walk: 0, color: p.color };
  return g;
}
// Ställer in figuren för den här bildrutan: position, vart den tittar och hur den rör sig.
function poseFigure(fig, x, y, opts) {
  const u = fig.userData,
    dx = x - (u.lastX ?? x),
    dy = y - (u.lastY ?? y),
    speed = Math.hypot(dx, dy);
  u.lastX = x;
  u.lastY = y;
  const moving = opts.moving ?? speed > 0.004;
  // Riktning: dit den går, annars mot dig om du står nära, annars som förut.
  let want = u.heading;
  if (moving && speed > 0.001) want = Math.atan2(dx, dy);
  else if (opts.faceTo) want = Math.atan2(opts.faceTo[0] - x, opts.faceTo[1] - y);
  const diff = ((((want - u.heading + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
  // Första gången står figuren direkt rätt, sedan vrider den sig mjukt.
  u.heading = u.posed ? u.heading + diff * 0.2 : want;
  u.posed = true;
  u.walk = moving ? u.walk + 0.22 : u.walk * 0.85;
  const swing = moving ? Math.sin(u.walk) * 0.55 : 0;
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.8;
  u.armR.rotation.x = swing * 0.8;
  u.armL.rotation.z = u.armR.rotation.z = 0;
  let lift = 0,
    tilt = 0;
  if (opts.dancing) {
    const t = frame * 0.16 + (opts.phase || 0);
    lift = Math.abs(Math.sin(t)) * 0.05;
    u.armL.rotation.x = u.armR.rotation.x = -2.6 + Math.sin(t) * 0.4;
    u.armL.rotation.z = 0.3;
    u.armR.rotation.z = -0.3;
  }
  if (opts.drunk) tilt = Math.sin(frame * 0.05 + (opts.phase || 0)) * 0.12;
  // Andas lite när den står still.
  if (!moving && !opts.dancing)
    u.torso.scale.y = 1 + Math.sin(frame * 0.05 + (opts.phase || 0)) * 0.012;
  fig.position.set(x, (opts.z || 0) + lift, y);
  fig.rotation.set(0, u.heading, tilt);
  if (opts.color && opts.color !== u.color) {
    u.color = opts.color;
    u.shirt.color.set(opts.color);
  }
  const s = (opts.height || 1.08) / 1.08;
  fig.scale.setScalar(s);
}
function figureFor(key, p) {
  let f = FIG.cache.get(key);
  if (!f || f.userData.pid !== p.id) {
    f = makeFigure(p);
    f.userData.pid = p.id;
    FIG.cache.set(key, f);
  }
  return f;
}

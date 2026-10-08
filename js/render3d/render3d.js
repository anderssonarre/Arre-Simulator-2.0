// Realistisk 3D med three.js: riktiga skuggor från solen, himmel, dimma, lampor och spegel.
// Bygger en 3D-scen av samma världsdata som den klassiska motorn (rutnät, segment, lådor, mark),
// så spellogiken är densamma. Klassiska motorn (render.js) används om WebGL saknas eller väljs i menyn.
// Enhet: 1 ruta = 1 enhet ≈ 1,7 m. Spelets (x, y) blir (x, höjd, y) i 3D.
'use strict';
const R3 = { ok: false, scenes: new Map(), sprites: new Map(), texCache: new WeakMap() };
let gfx3d = (() => {
  try {
    const q = new URLSearchParams(location.search).get('gfx');
    if (q) return q === '3d';
    const s = localStorage.getItem('arre_gfx');
    if (s) return s === '3d';
  } catch {}
  return null; // bestäms när WebGL har provats
})();
const EYE3D = 0.93; // ögonhöjd ≈ 1,6 m

function initR3() {
  if (typeof THREE === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.id = 'view3d';
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    const gl = renderer.getContext(),
      info = gl.getExtension('WEBGL_debug_renderer_info'),
      name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    // Mjukvaru-WebGL (utan grafikkort) är för långsamt: där blir klassiska motorn standard.
    R3.software = /swiftshader|llvmpipe|software/i.test(name);
    if (gfx3d === null) gfx3d = !R3.software;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const overlay = document.createElement('canvas');
    overlay.id = 'overlay3d';
    view.after(canvas, overlay);
    R3.renderer = renderer;
    R3.canvas = canvas;
    R3.overlay = overlay;
    R3.octx = overlay.getContext('2d');
    R3.camera = new THREE.PerspectiveCamera(70, 1, 0.03, 6000);
    R3.camera.rotation.order = 'YXZ';
    R3.scene = new THREE.Scene();
    // Ljus som delas av alla världar.
    R3.hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5b5040, 1);
    R3.sun = new THREE.DirectionalLight(0xfff2dd, 2.5);
    R3.sun.castShadow = true;
    R3.sun.shadow.bias = -0.0004;
    R3.sun.shadow.normalBias = 0.03;
    R3.scene.add(R3.hemi, R3.sun, R3.sun.target);
    R3.points = [];
    for (let i = 0; i < 8; i++) {
      const l = new THREE.PointLight(0xffd7a0, 0, 12, 1.6);
      R3.points.push(l);
      R3.scene.add(l);
    }
    R3.sky = new THREE.Sky();
    R3.sky.scale.setScalar(4500);
    const u = R3.sky.material.uniforms;
    u.turbidity.value = 3;
    u.rayleigh.value = 2.2;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.8;
    R3.scene.add(R3.sky);
    R3.shadowTex = blobTexture();
    R3.ok = true;
    resize3d();
    addEventListener('resize', resize3d);
    return true;
  } catch (e) {
    console.error('3D kunde inte startas:', e);
    R3.ok = false;
    return false;
  }
}
function resize3d() {
  if (!R3.ok) return;
  const w = innerWidth,
    h = innerHeight;
  R3.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, highDetail ? 1.5 : 1));
  R3.renderer.setSize(w, h, false);
  R3.camera.aspect = w / h;
  R3.camera.updateProjectionMatrix();
  R3.overlay.width = w;
  R3.overlay.height = h;
  R3.sun.shadow.mapSize.set(highDetail ? 2048 : 1024, highDetail ? 2048 : 1024);
  R3.sun.shadow.map?.dispose();
  R3.sun.shadow.map = null;
}
function use3d() {
  return gfx3d && R3.ok;
}
function setGfx3d(on) {
  gfx3d = on;
  try {
    localStorage.setItem('arre_gfx', on ? '3d' : 'classic');
  } catch {}
  if (on && !R3.ok) initR3();
  document.body.classList.toggle('gfx3d', use3d());
}

// ---- Texturer ----
function tex(canvas, repeat = false) {
  let t = R3.texCache.get(canvas);
  if (!t) {
    t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = R3.renderer.capabilities.getMaxAnisotropy();
    R3.texCache.set(canvas, t);
  }
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function canvasOf2(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}
function blobTexture() {
  return new THREE.CanvasTexture(
    canvasOf2(64, 64, (g) => {
      const r = g.createRadialGradient(32, 32, 2, 32, 32, 31);
      r.addColorStop(0, 'rgba(0,0,0,0.45)');
      r.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, 64, 64);
    }),
  );
}
// Detaljtexturer för marken, 512 px, upprepas över ytan.
function noiseCanvas(base, spread, seed, extra) {
  return canvasOf2(512, 512, (g, w, h) => {
    const im = g.createImageData(w, h),
      r = seeded(seed);
    for (let i = 0; i < w * h; i++) {
      const n = (r() - 0.5) * spread;
      im.data[i * 4] = base[0] + n;
      im.data[i * 4 + 1] = base[1] + n;
      im.data[i * 4 + 2] = base[2] + n;
      im.data[i * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    extra?.(g, w, h, r);
  });
}
function groundDetail() {
  if (R3.ground) return R3.ground;
  const asphalt = noiseCanvas([86, 88, 90], 34, 11, (g, w, h, r) => {
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(150,150,150,0.35)' : 'rgba(30,30,32,0.35)';
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
    g.strokeStyle = 'rgba(40,40,42,0.25)';
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(r() * w, r() * h);
      for (let k = 0; k < 6; k++) g.lineTo(r() * w, r() * h);
      g.stroke();
    }
  });
  const grass = noiseCanvas([78, 112, 56], 30, 12, (g, w, h, r) => {
    for (let i = 0; i < 9000; i++) {
      const x = r() * w,
        y = r() * h,
        l = 3 + r() * 6;
      g.strokeStyle = r() > 0.5 ? 'rgba(120,160,80,0.5)' : 'rgba(40,70,30,0.45)';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 3, y - l);
      g.stroke();
    }
    for (let i = 0; i < 60; i++) {
      g.fillStyle = 'rgba(110,95,60,0.18)';
      g.beginPath();
      g.ellipse(r() * w, r() * h, 6 + r() * 18, 4 + r() * 10, r() * 3, 0, 7);
      g.fill();
    }
  });
  // Betongplattor i förband, som på trottoarerna i Vasa.
  const paving = noiseCanvas([168, 164, 156], 18, 13, (g, w, h, r) => {
    const s = 64;
    for (let y = 0; y < h; y += s / 2)
      for (let x = -(y / (s / 2)) % 2 ? s / 2 : 0; x < w; x += s) {
        g.fillStyle = 'rgba(' + (r() > 0.5 ? '255,255,255' : '0,0,0') + ',' + r() * 0.06 + ')';
        g.fillRect(x, y, s, s / 2);
        g.strokeStyle = 'rgba(70,66,60,0.55)';
        g.lineWidth = 2;
        g.strokeRect(x + 1, y + 1, s - 2, s / 2 - 2);
      }
  });
  R3.ground = { asphalt: tex(asphalt, true), grass: tex(grass, true), paving: tex(paving, true) };
  return R3.ground;
}

// ---- Bygg en värld ----
function worldGroup(w) {
  let g = R3.scenes.get(w);
  if (g) return g;
  // Extrajobbets värld byggs ny varje pass: släpp den gamla.
  for (const [k, old] of R3.scenes)
    if (k.id === w.id) {
      old.traverse((o) => {
        o.geometry?.dispose();
        for (const m of [].concat(o.material || [])) m.dispose();
      });
      R3.scenes.delete(k);
    }
  g = new THREE.Group();
  g.userData.materials = [];
  if (w.segments) buildCampus3d(w, g);
  else buildGrid3d(w, g);
  for (const b of w.boxes || []) g.add(boxMesh(b));
  buildStatics(w, g);
  R3.scenes.set(w, g);
  return g;
}
function std(opts) {
  return new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0, ...opts });
}
// Väggbitar (fyrhörningar) samlade per material, så att hela världen ritas med få anrop.
function quadBuilder() {
  const groups = new Map();
  return {
    add(key, mat, a, b, h0, h1, u0, u1, v0 = 0, v1 = 1) {
      let q = groups.get(key);
      if (!q) groups.set(key, (q = { mat, pos: [], uv: [], nrm: [] }));
      const [ax, ay] = a,
        [bx, by] = b,
        len = Math.hypot(bx - ax, by - ay) || 1,
        nx = (by - ay) / len,
        nz = -(bx - ax) / len;
      // Två trianglar: a-nere, b-nere, b-uppe, a-uppe.
      q.pos.push(ax, h0, ay, bx, h0, by, bx, h1, by, ax, h0, ay, bx, h1, by, ax, h1, ay);
      q.uv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
      for (let i = 0; i < 6; i++) q.nrm.push(nx, 0, nz);
    },
    meshes() {
      return [...groups.values()].map((q) => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(q.pos, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(q.uv, 2));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(q.nrm, 3));
        const m = new THREE.Mesh(geo, q.mat);
        m.castShadow = m.receiveShadow = true;
        return m;
      });
    },
  };
}
function buildCampus3d(w, g) {
  const q = quadBuilder(),
    mats = {};
  const facadeMat = (s) => {
    const key = (s.door ? 'door:' : '') + s.type + ':' + s.h;
    if (!mats[key]) {
      const c = s.door
        ? doorTexture('seg:' + s.type, s.h, false, facadeTexture(s.type, s.h))
        : facadeTexture(s.type, s.h);
      mats[key] = std({ map: tex(c, !s.door), side: THREE.DoubleSide });
      if (!s.door && !s.low) litWindows(mats[key], c, s.h);
    }
    return [key, mats[key]];
  };
  for (const s of w.segments) {
    if (s.edge) continue;
    const [key, mat] = facadeMat(s);
    // Fasadtexturen är en ruta bred och upprepas längs väggen. En dörr fyller sin bit.
    if (s.door) q.add(key, mat, [s.ax, s.ay], [s.bx, s.by], 0, s.h, 0, 1);
    else {
      // Varje vägg börjar på ett eget ställe i mönstret, så att tända fönster inte upprepas.
      const u0 = ((s.id || 0) * 7) % 97;
      q.add(key, mat, [s.ax, s.ay], [s.bx, s.by], 0, s.h, u0, u0 + s.len);
    }
  }
  q.meshes().forEach((m) => g.add(m));
  // Platta tak med takpapp och en låg kant av plåt runt om.
  const roofMat = std({ color: 0x4d4f52, roughness: 0.95 });
  g.userData.roofMat = roofMat;
  const edgeMat = std({ color: 0x6d7174, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide }),
    edges = quadBuilder();
  for (const h of w.houses || [])
    for (const r of h.rings)
      r.pts.forEach(([ax, ay], i) => {
        const [bx, by] = r.pts[(i + 1) % r.pts.length];
        edges.add('kant', edgeMat, [ax, ay], [bx, by], h.h, h.h + 0.14, 0, 1);
      });
  edges.meshes().forEach((m) => g.add(m));
  for (const h of w.houses || []) {
    const [outer, ...holes] = h.rings.map((r) => r.pts);
    const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const hole of holes)
      shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
    const geo = new THREE.ShapeGeometry(shape);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i), h.h, p.getY(i));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, roofMat);
    m.material.side = THREE.DoubleSide;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  g.add(groundMesh(w));
}
// Fönster som lyser på kvällen: glaset i fasadtexturen hittas på färgen, och vilka fönster
// som är tända slumpas per fönster i shadern.
const nightUniform = { value: 0 };
function litWindows(mat, canvas, h) {
  const glass = canvasOf2(canvas.width, canvas.height, (g, w, hh) => {
    const src = canvas.getContext('2d').getImageData(0, 0, w, hh),
      im = g.createImageData(w, hh);
    for (let i = 0; i < w * hh; i++) {
      const r = src.data[i * 4],
        gg = src.data[i * 4 + 1],
        b = src.data[i * 4 + 2],
        isGlass = b - r > 18 && b < 170 && gg > r;
      im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = isGlass ? 255 : 0;
      im.data[i * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  });
  const gt = new THREE.CanvasTexture(glass);
  gt.wrapS = gt.wrapT = THREE.RepeatWrapping;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGlass = { value: gt };
    sh.uniforms.uNight = nightUniform;
    sh.uniforms.uFloors = { value: Math.max(1, Math.round(h / 1.7)) };
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform sampler2D uGlass;\nuniform float uNight, uFloors;',
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float glassMask = texture2D(uGlass, vMapUv).r;
        float rnd = fract(sin(dot(vec2(floor(vMapUv.x), floor(vMapUv.y * uFloors)), vec2(12.9898, 78.233))) * 43758.5453);
        totalEmissiveRadiance += glassMask * uNight * step(0.72, rnd) * vec3(1.0, 0.68, 0.36) * (0.25 + rnd * 0.5);`,
      );
  };
}
// Marken på campus: klasskartan (gräs, asfalt, plattor, målning, trottoarkant) styr vilken
// detaljtextur som visas, så kanterna blir skarpa fast texturerna är högupplösta.
const snowUniform = { value: 0 };
function groundMesh(w) {
  const n = w.size * w.groundRes,
    classes = new THREE.DataTexture(w.ground, n, n, THREE.RedFormat, THREE.UnsignedByteType);
  classes.magFilter = classes.minFilter = THREE.NearestFilter;
  classes.needsUpdate = true;
  const d = groundDetail(),
    size = w.size,
    pad = size * 2,
    geo = new THREE.PlaneGeometry(size + pad * 2, size + pad * 2),
    mat = std({ color: 0xffffff, roughness: 0.93 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(size / 2, 0, size / 2);
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      uClass: { value: classes },
      uAsphalt: { value: d.asphalt },
      uGrass: { value: d.grass },
      uPaving: { value: d.paving },
      uSize: { value: size },
      uSnow: snowUniform,
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWorld;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xz;',
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vWorld;\nuniform sampler2D uClass, uAsphalt, uGrass, uPaving;\nuniform float uSize, uSnow;',
      )
      .replace(
        '#include <map_fragment>',
        `vec2 cuv = vWorld / uSize;
        float cls = 1.0;
        if (cuv.x > 0.0 && cuv.y > 0.0 && cuv.x < 1.0 && cuv.y < 1.0) cls = floor(texture2D(uClass, cuv).r * 255.0 + 0.5);
        vec2 t = vWorld / 2.3;
        vec3 col;
        if (cls < 0.5) col = texture2D(uPaving, t).rgb;
        else if (cls < 1.5) col = texture2D(uGrass, t * 0.8).rgb;
        else if (cls < 2.5) col = texture2D(uAsphalt, t).rgb;
        else if (cls < 3.5) col = vec3(0.75, 0.76, 0.71);
        else if (cls < 4.5) col = texture2D(uAsphalt, t).rgb * 1.12;
        else col = vec3(0.41, 0.41, 0.38);
        // Snö: vitt på gräs och plattor, sörjigt på asfalten.
        float snowAmt = uSnow * (cls < 1.5 ? 1.0 : cls < 2.5 || cls > 3.5 ? 0.35 : 0.8);
        col = mix(col, vec3(0.9, 0.92, 0.95), snowAmt);
        diffuseColor.rgb *= col;`,
      );
  };
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  return m;
}
// Rutnätsvärldar (hemmet, W33, Technobothnia, gymmet, jobbet): väggar, golv, tak och spegel.
function buildGrid3d(w, g) {
  const q = quadBuilder(),
    n = w.size,
    hgt = w.wallHeight || 1.4,
    tileAt = (x, y) => (x < 0 || y < 0 || x >= n || y >= n ? 3 : w.grid[y][x]),
    mats = {};
  w.__tileMats = mats;
  const matFor = (tile) => {
    if (mats[tile]) return mats[tile];
    let c;
    if (isDoor(tile)) c = doorTexture(tile - DOOR, hgt, !w.outdoor, w.wallTex?.[tile - DOOR]);
    else c = w.wallTex?.[tile] || wallTextures[(tile - 1) % wallTextures.length];
    const m = std({ map: tex(c), side: THREE.DoubleSide });
    m.userData.src = c;
    m.userData.tile = tile;
    return (mats[tile] = m);
  };
  const mirrors = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const t = w.grid[y][x];
      if (!t) continue;
      // Bara sidor som vetter mot en öppen ruta ritas.
      const faces = [
        [0, -1, [x + 1, y], [x, y]], // norr
        [0, 1, [x, y + 1], [x + 1, y + 1]], // söder
        [-1, 0, [x, y], [x, y + 1]], // väster
        [1, 0, [x + 1, y + 1], [x + 1, y]], // öster
      ];
      for (const [dx, dy, a, b] of faces) {
        if (tileAt(x + dx, y + dy)) continue;
        if (t === MIRROR && dy === 1) {
          mirrors.push(x);
          continue;
        }
        const tile = t === MIRROR ? 11 : t;
        q.add(tile, matFor(tile), a, b, 0, hgt, 0, 1);
      }
    }
  q.meshes().forEach((m) => g.add(m));
  // Spegeln: en riktig reflektion av rummet (och av dig).
  if (mirrors.length && w.mirror) {
    const x0 = Math.min(...mirrors),
      x1 = Math.max(...mirrors) + 1,
      geo = new THREE.PlaneGeometry(x1 - x0 - 0.08, hgt * 0.82),
      mirror = new THREE.Reflector(geo, {
        textureWidth: 1024,
        textureHeight: 1024,
        color: 0xb8c4c8,
      });
    mirror.position.set((x0 + x1) / 2, hgt * 0.47, w.mirror.plane + 0.005);
    mirror.camera.layers.enable(1);
    g.add(mirror);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(x1 - x0, hgt * 0.86, 0.03),
      std({ color: 0x2b2f33, roughness: 0.4, metalness: 0.4 }),
    );
    frame.position.set((x0 + x1) / 2, hgt * 0.47, w.mirror.plane - 0.012);
    g.add(frame);
    R3.selfLayer = true;
  }
  // Golv och tak från världens egna mönster.
  g.add(surfaceMesh(w, w.floor, 0, false));
  if (!w.outdoor) g.add(surfaceMesh(w, w.ceiling || plasterCeiling, hgt, true));
}
function plasterCeiling(x, y, out) {
  const n = ((Math.floor(x * 7) * 13 + Math.floor(y * 7) * 7) % 5) * 1.5;
  out[0] = 226 + n;
  out[1] = 224 + n;
  out[2] = 218 + n;
}
// Ritar golvet (eller taket) till en textur genom att fråga världen om färgen punkt för punkt.
function surfaceMesh(w, fn, z, ceiling) {
  const n = w.size,
    px = n <= 12 ? 64 : n <= 30 ? 40 : 24,
    size = n * px,
    c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d'),
    im = g.createImageData(size, size),
    out = [0, 0, 0],
    pave = groundPack[w.outdoor ? 'asphalt' : 'paving'].data;
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const x = (i + 0.5) / px,
        y = (j + 0.5) / px,
        k = (j * size + i) * 4;
      if (fn) fn(x, y, out);
      else {
        const ti = ((Math.floor(y * 56) % 128) * 128 + (Math.floor(x * 56) % 128)) * 4;
        out[0] = pave[ti];
        out[1] = pave[ti + 1];
        out[2] = pave[ti + 2];
      }
      im.data[k] = out[0];
      im.data[k + 1] = out[1];
      im.data[k + 2] = out[2];
      im.data[k + 3] = 255;
    }
  g.putImageData(im, 0, 0);
  const t = tex(c);
  t.flipY = false;
  const geo = new THREE.PlaneGeometry(n, n);
  geo.rotateX(ceiling ? Math.PI / 2 : -Math.PI / 2);
  // UV så att bildens rad j motsvarar y = j / px.
  const uv = geo.attributes.uv,
    pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / n + 0.5, pos.getZ(i) / n + 0.5);
  geo.translate(n / 2, z, n / 2);
  const m = new THREE.Mesh(
    geo,
    std({
      map: t,
      roughness: ceiling ? 0.95 : 0.7,
      // Taket får lite eget ljus, som om ljuset studsar från golvet.
      ...(ceiling ? { emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.22 } : {}),
    }),
  );
  m.receiveShadow = true;
  return m;
}
// Möbler och andra lådor.
function boxMesh(b) {
  const col = (c) => new THREE.Color(`rgb(${c[0]},${c[1]},${c[2]})`),
    side = b.tex ? std({ map: tex(b.tex) }) : std({ color: col(b.color) }),
    top = std({ color: col(b.top) }),
    front = b.frontTex ? std({ map: tex(b.frontTex) }) : side;
  // Lysande saker (lampor, skärmar, akvarium) lyser i sin egen färg.
  if (b.glow)
    for (const m of [side, top, front]) {
      m.emissive = col(b.color);
      m.emissiveIntensity = 0.7;
    }
  // BoxGeometry: +x, -x, +y (topp), -y, +z, -z. Spelets +y är 3D:s +z.
  const faces = { '+x': 0, '-x': 1, '+y': 4, '-y': 5 },
    list = [side, side, top, side, side, side];
  if (b.front) list[faces[b.front]] = front;
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(b.x1 - b.x0, Math.max(0.005, b.z1 - b.z0), b.y1 - b.y0),
    list,
  );
  m.position.set((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, (b.y0 + b.y1) / 2);
  m.castShadow = m.receiveShadow = true;
  return m;
}
// Träd, skorstenar och skyltar blir riktiga 3D-föremål i stället för platta figurer.
function buildStatics(w, g) {
  const trees = w.objects.filter((o) => o.type === 'tree'),
    r = seeded(99);
  if (trees.length) {
    const trunkGeo = new THREE.CylinderGeometry(0.07, 0.11, 1, 7),
      leafGeo = new THREE.SphereGeometry(1, 18, 12),
      coneGeo = new THREE.ConeGeometry(1, 1, 9),
      bark = std({ color: 0x5a4434 }),
      birchBark = std({ color: 0xe8e4da }),
      leaves = std({ color: 0xffffff, roughness: 0.9 }),
      needles = std({ color: 0x2c4a2e, roughness: 0.95 }),
      count = trees.length,
      trunks = new THREE.InstancedMesh(trunkGeo, bark, count),
      birchTrunks = new THREE.InstancedMesh(trunkGeo, birchBark, count),
      blobs = new THREE.InstancedMesh(leafGeo, leaves, count * 4),
      cones = new THREE.InstancedMesh(coneGeo, needles, count * 4);
    // Lövverket får en ojämn yta, så att kronorna inte ser ut som klot.
    const lp = leafGeo.attributes.position,
      rr0 = seeded(5);
    for (let i = 0; i < lp.count; i++) {
      const x = lp.getX(i),
        y = lp.getY(i),
        z = lp.getZ(i),
        k =
          0.82 +
          0.3 * Math.abs(Math.sin(x * 5.1 + y * 3.7) * Math.cos(z * 4.3 - y * 2.9)) +
          rr0() * 0.06;
      lp.setXYZ(i, x * k, y * k, z * k);
    }
    leafGeo.computeVertexNormals();
    const M = new THREE.Matrix4(),
      Q = new THREE.Quaternion(),
      S = new THREE.Vector3(),
      P = new THREE.Vector3(),
      C = new THREE.Color();
    const leafInfo = [];
    let nt = 0,
      nb = 0,
      nl = 0,
      nc = 0;
    for (const o of trees) {
      const h = o.height || 6,
        kind = o.kind || 'leafy';
      o.r3 = true;
      if (kind === 'spruce') {
        M.compose(P.set(o.x, h * 0.12, o.y), Q.identity(), S.set(1.3, h * 0.24, 1.3));
        trunks.setMatrixAt(nt++, M);
        for (let k = 0; k < 4; k++) {
          const rad = (1 - k * 0.22) * h * 0.2,
            y = h * (0.28 + k * 0.17);
          M.compose(P.set(o.x, y + h * 0.13, o.y), Q.identity(), S.set(rad, h * 0.32, rad));
          cones.setMatrixAt(nc, M);
          cones.setColorAt(nc++, C.setHSL(0.33, 0.35, 0.18 + r() * 0.06));
        }
      } else {
        const birch = kind === 'birch',
          tm = birch ? birchTrunks : trunks,
          idx = birch ? nb++ : nt++;
        M.compose(
          P.set(o.x, h * 0.3, o.y),
          Q.identity(),
          S.set(birch ? 0.9 : 1.4, h * 0.6, birch ? 0.9 : 1.4),
        );
        tm.setMatrixAt(idx, M);
        for (let k = 0; k < 4; k++) {
          const a = r() * 6.28,
            rr = h * (k === 0 ? 0 : 0.11),
            s = h * (birch ? 0.15 : 0.2) * (0.8 + r() * 0.35);
          Q.setFromAxisAngle(P.set(0, 1, 0), r() * 6.28);
          M.compose(
            P.set(o.x + Math.cos(a) * rr, h * (0.62 + r() * 0.18), o.y + Math.sin(a) * rr),
            Q,
            S.set(s, s * 0.85, s),
          );
          blobs.setMatrixAt(nl, M);
          leafInfo.push([birch, r()]);
          blobs.setColorAt(nl++, C.setHSL(birch ? 0.24 : 0.27, 0.45, 0.24 + r() * 0.1));
        }
      }
    }
    for (const [m, used] of [
      [trunks, nt],
      [birchTrunks, nb],
      [blobs, nl],
      [cones, nc],
    ]) {
      m.count = used;
      m.castShadow = m.receiveShadow = true;
      g.add(m);
    }
    g.userData.leaves = { mesh: blobs, info: leafInfo, look: null };
  }
  for (const o of w.objects) {
    if (o.type === 'chimney') {
      o.r3 = true;
      const h = o.height,
        m = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, h, 14), std({ color: 0x8a4a38 }));
      m.position.set(o.x, h / 2, o.y);
      m.castShadow = m.receiveShadow = true;
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.47, 0.47, 0.35, 14),
        std({ color: 0xd9d6cf }),
      );
      band.position.set(o.x, h * 0.86, o.y);
      g.add(m, band);
    }
    if (o.type === 'sign' && w.segments) {
      // Skylten sätts platt på närmaste fasad.
      let best = null,
        bd = 1e9;
      for (const s of w.segments) {
        if (s.low) continue;
        const dx = s.bx - s.ax,
          dy = s.by - s.ay,
          t = clamp(((o.x - s.ax) * dx + (o.y - s.ay) * dy) / (s.len * s.len), 0, 1),
          d = Math.hypot(s.ax + dx * t - o.x, s.ay + dy * t - o.y);
        if (d < bd) {
          bd = d;
          best = { s, x: s.ax + dx * t, y: s.ay + dy * t };
        }
      }
      if (!best) continue;
      o.r3 = true;
      const c = o.sprite,
        h = o.height,
        wdt = (h * c.width) / c.height,
        m = new THREE.Mesh(
          new THREE.PlaneGeometry(wdt, h),
          std({ map: tex(c), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }),
        );
      const nx = best.s.nx,
        ny = best.s.ny,
        out = isWall(w, best.x + nx * 0.3, best.y + ny * 0.3) ? -1 : 1;
      m.position.set(best.x + nx * out * 0.04, (o.z || 0) + h / 2, best.y + ny * out * 0.04);
      m.lookAt(m.position.x + nx * out, m.position.y, m.position.z + ny * out);
      g.add(m);
    }
    if (o.type === 'lamp') {
      // Gatlampa i vajer: liten armatur som lyser på kvällen.
      o.r3 = true;
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.2, 0.12, 10),
        std({ color: 0x3a3f44, emissive: 0xffd9a0, emissiveIntensity: 0 }),
      );
      m.position.set(o.x, (o.z || 4.9) + 0.25, o.y);
      g.userData.lamps ??= [];
      g.userData.lamps.push(m);
      g.add(m);
    }
  }
}

// ---- Ljus efter tid på dygnet ----
function lightRig(w) {
  const h = state?.hour ?? 12,
    outdoor = !!w.outdoor,
    // Solen går upp och ner efter årstiden i Vasa och står lägre på vintern.
    sunT = sunTimes(),
    t = (h - sunT.up) / (sunT.down - sunT.up),
    maxElev = 0.15 + (sunT.down - sunT.up - 5) * 0.045,
    elev = Math.max(0.03, Math.sin(clamp(t, 0, 1) * Math.PI) * maxElev),
    az = (t - 0.5) * Math.PI * 1.4,
    wx = weather(),
    day = daylight(h),
    dir = new THREE.Vector3(
      Math.sin(az) * Math.cos(elev),
      Math.sin(elev),
      -Math.cos(az) * Math.cos(elev),
    );
  const u = R3.sky.material.uniforms;
  u.sunPosition.value.copy(dir);
  R3.sky.visible = outdoor;
  u.turbidity.value = 3 + wx.clouds * 12;
  u.rayleigh.value = 2.2 - wx.clouds * 1.4;
  seasonLook(w, wx);
  R3.renderer.toneMappingExposure = outdoor ? 0.9 - day * 0.4 : 0.95;
  nightUniform.value = clamp(1 - day * 2.5, 0, 1);
  // Solen följer spelaren så att skuggorna alltid är skarpa nära dig.
  const sun = R3.sun,
    span = outdoor ? 48 : w.size / 2 + 2;
  sun.position.set(player.x + dir.x * 120, Math.max(8, dir.y * 120), player.y + dir.z * 120);
  sun.target.position.set(player.x, 0, player.y);
  const sc = sun.shadow.camera;
  if (sc.right !== span) {
    sc.left = sc.bottom = -span;
    sc.right = sc.top = span;
    sc.near = 1;
    sc.far = 400;
    sc.updateProjectionMatrix();
  }
  const moon = day < 0.15;
  if (moon) {
    // Månljus på natten: svagt, blåaktigt, högt upp.
    sun.position.set(player.x + 40, 90, player.y - 30);
    sun.intensity = outdoor ? 0.35 : 0.1;
    sun.color.setHex(0x9fb4d8);
  } else {
    sun.intensity = (outdoor ? 4.2 * day : 1.1 * day) * (1 - wx.clouds * 0.75);
    sun.color.setHSL(0.09, 0.6 - day * 0.35, 0.75 + day * 0.15);
  }
  sun.castShadow = highDetail && !moon;
  R3.hemi.intensity = outdoor ? 0.45 + day * 1.1 : 0.7 + day * 0.4;
  R3.hemi.color.setHSL(0.6, 0.45, 0.3 + day * 0.45);
  R3.hemi.groundColor.setHSL(0.08, 0.25, 0.12 + day * 0.15);
  // Dimman mot horisonten har himlens färg.
  const fog =
    day > 0.6 ? (wx.clouds > 0.5 ? 0xa9b2b6 : 0xc5d6d8) : day > 0.15 ? 0xd2a07c : 0x1b2433;
  if (outdoor) {
    R3.scene.fog ??= new THREE.Fog(fog, 70, 330);
    R3.scene.fog.color.setHex(fog);
    R3.scene.fog.far = wx.kind === 'regn' || wx.kind === 'snö' ? 160 : 330;
    R3.scene.background = new THREE.Color(fog);
  } else {
    R3.scene.fog = null;
    R3.scene.background = new THREE.Color(0x0c1218);
  }
  // Lampor: gatlampor ute, rummets lampor inne. Bara de åtta närmaste får riktigt ljus.
  const lamps = [];
  if (outdoor) {
    const lit = day < 0.35;
    for (const m of R3.scenes.get(w)?.userData.lamps || []) {
      m.material.emissiveIntensity = lit ? 2.5 : 0;
      if (lit)
        lamps.push({
          x: m.position.x,
          y: m.position.z,
          z: m.position.y - 0.2,
          power: 22,
          color: 0xffd39a,
          dist: 20,
        });
    }
  } else if (w.lights) {
    for (const l of w.lights)
      lamps.push({
        x: l.x,
        y: l.y,
        z: (l.z || 0.5) + 0.3,
        power: l.day ? 14 * day : 14 * l.power * (homeParty ? 0.6 : day > 0.7 ? 0.5 : 1),
        color: l.day ? 0xdbe8ff : 0xffcf96,
        dist: 9,
      });
  } else {
    // Stora lokaler utan egna lampor: taklampor i ett rutmönster.
    const hgt = w.wallHeight || 1.4;
    for (let y = 4; y < w.size; y += 9)
      for (let x = 4; x < w.size; x += 9)
        if (!isWall(w, x, y))
          lamps.push({ x, y, z: hgt - 0.1, power: 9, color: 0xfff1dc, dist: 14 });
  }
  lamps.sort(
    (a, b) =>
      Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y),
  );
  R3.points.forEach((p, i) => {
    const l = lamps[i];
    if (!l) return (p.intensity = 0);
    p.position.set(l.x, l.z, l.y);
    p.color.setHex(l.color);
    p.intensity = l.power;
    p.distance = l.dist;
  });
  // Fest: färgade ljus som rör sig.
  if ((party && w.id === 'w33') || (homeParty && w.id === 'home')) {
    const t = frame * 0.03;
    for (let i = 0; i < 3; i++) {
      const p = R3.points[7 - i],
        cx = w.id === 'home' ? 4.5 : 38,
        cy = w.id === 'home' ? 3.5 : 9;
      p.position.set(cx + Math.cos(t + i * 2.1) * 2, 1.1, cy + Math.sin(t + i * 2.1) * 2);
      p.color.setHSL((frame * 0.004 + i / 3) % 1, 0.9, 0.55);
      p.intensity = 12;
      p.distance = 8;
    }
  }
  return day;
}

// ---- Årstiden: snö på marken och taken, höstlöv, kala träd, regn och snöfall ----
function seasonLook(w, wx) {
  const g = R3.scenes.get(w);
  snowUniform.value = w.outdoor ? snowCover() : 0;
  if (g?.userData.roofMat) g.userData.roofMat.color.setHex(snowCover() > 0.5 ? 0xe4e8ec : 0x4d4f52);
  const leaves = g?.userData.leaves,
    look = foliage();
  if (leaves && leaves.look !== look) {
    leaves.look = look;
    leaves.mesh.visible = look !== 'kal';
    const C = new THREE.Color();
    leaves.info.forEach(([birch, r], i) => {
      if (look === 'höst') C.setHSL(birch ? 0.13 : 0.07 + r * 0.06, 0.75, 0.38 + r * 0.1);
      else C.setHSL(birch ? 0.24 : 0.27, 0.45, 0.24 + r * 0.1);
      leaves.mesh.setColorAt(i, C);
    });
    leaves.mesh.instanceColor.needsUpdate = true;
  }
  precipitation(w.outdoor ? wx.kind : null);
}
function precipitation(kind) {
  if (!R3.rain) {
    const n = 2500,
      pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = Math.random() * 14;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    R3.rain = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xcfd8e0,
        size: 0.06,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        map: new THREE.CanvasTexture(
          canvasOf2(32, 32, (g) => {
            const r = g.createRadialGradient(16, 16, 1, 16, 16, 15);
            r.addColorStop(0, 'rgba(255,255,255,1)');
            r.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = r;
            g.fillRect(0, 0, 32, 32);
          }),
        ),
      }),
    );
    R3.rain.frustumCulled = false;
    R3.scene.add(R3.rain);
  }
  const p = R3.rain;
  p.visible = !!(kind === 'regn' || kind === 'snö');
  if (!p.visible) return;
  const snow = kind === 'snö',
    a = p.geometry.attributes.position,
    fall = snow ? 0.03 : 0.35;
  p.material.size = snow ? 0.07 : 0.03;
  p.material.color.setHex(snow ? 0xffffff : 0xaebccb);
  for (let i = 0; i < a.count; i++) {
    let y = a.getY(i) - fall;
    if (y < 0) y += 14;
    a.setY(i, y);
    if (snow) a.setX(i, a.getX(i) + Math.sin(frame * 0.02 + i) * 0.01);
  }
  a.needsUpdate = true;
  p.position.set(player.x, 0, player.y);
}

// ---- Figurer (personer, markörer) som skyltar mot kameran ----
function spriteFor(key, canvas) {
  let s = R3.sprites.get(key);
  if (!s) {
    s = new THREE.Sprite(new THREE.SpriteMaterial({ alphaTest: 0.35 }));
    s.center.set(0.5, 0);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.8),
      new THREE.MeshBasicMaterial({ map: R3.shadowTex, transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    s.userData.shadow = shadow;
    R3.sprites.set(key, s);
  }
  const t = tex(canvas);
  if (s.material.map !== t) {
    s.material.map = t;
    s.material.needsUpdate = true;
  }
  return s;
}
function placeSprites(w, day) {
  const live = new Set(),
    root = R3.dyn,
    bright = w.outdoor ? 0.35 + day * 0.65 : 0.92;
  const add = (key, o, canvas, x, y, height, z = 0, opts = {}) => {
    const s = spriteFor(key, canvas),
      wd = (height * canvas.width) / canvas.height;
    s.scale.set(wd, height, 1);
    s.position.set(x, z, y);
    s.material.color.setScalar(bright);
    s.layers.set(opts.layer || 0);
    root.add(s);
    live.add(key);
    if (opts.shadow) {
      const sh = s.userData.shadow;
      sh.position.set(x, 0.006 + z, y);
      sh.scale.setScalar(Math.max(0.6, wd * 0.9));
      root.add(sh);
      live.add(key + ':sh');
    }
  };
  // Personer blir 3D-figurer, allt annat (markörer, föremål) är figurer mot kameran.
  const figs = new Set(),
    placeFig = (key, prof, x, y, opts) => {
      const f = figureFor(key, prof);
      poseFigure(f, x, y, opts);
      f.traverse((c) => c.layers.set(opts.layer || 0));
      root.add(f);
      figs.add(key);
    };
  for (const o of w.objects) {
    if (o.r3 || o.hidden || !o.sprite) continue;
    if (o.profile && !o.guest && onlineChars.has(o.profile.id)) continue;
    if (o.profile?.id === state?.character) continue;
    if (o.profile) {
      const near = Math.hypot(o.x - player.x, o.y - player.y) < 3.2;
      placeFig(o, o.profile, o.x, o.y, {
        z: o.z || 0,
        height: o.height || 1.08,
        phase: o.phase,
        drunk: o.drunk || (o.activity === 'fest' && w.id === 'outdoor'),
        dancing:
          (party && w.id === 'w33' && o.x > 33 && o.y < 16) ||
          (homeParty && w.id === 'home' && o.dancing),
        moving: o.targetX != null && Math.hypot(o.targetX - o.x, o.targetY - o.y) > 0.04,
        faceTo: near ? [player.x, player.y] : null,
      });
      continue;
    }
    add(o, o, o.sprite, o.x, o.y, o.height || 1, o.z || 0);
  }
  for (const r of remotesHere()) {
    const prof = remoteProfile(r);
    placeFig('r' + r.id, prof, r.x, r.y, { moving: r.moving, phase: r.id, color: prof.color });
  }
  // Du själv: syns bara i spegeln (lager 1).
  if (R3.selfLayer && w.mirror) {
    const me = profile(),
      out = outfits.find((x) => x.id === state?.outfit);
    if (me)
      placeFig('self', me, player.x, player.y, {
        layer: 1,
        moving: Math.hypot(motion.vx, motion.vy) > 0.2,
        color: out?.color || me.color,
        faceTo: [player.x + Math.cos(player.a), player.y + Math.sin(player.a)],
      });
  }
  for (const [key, f] of FIG.cache) if (!figs.has(key)) root.remove(f);
  for (const [key, s] of R3.sprites)
    if (!live.has(key)) {
      root.remove(s);
      root.remove(s.userData.shadow);
    } else if (!live.has(key + ':sh')) root.remove(s.userData.shadow);
}

// ---- En bildruta ----
function render3d() {
  const w = world || worlds.outdoor;
  lightNow = lightLevels(w);
  w.onRender?.();
  const g = worldGroup(w);
  if (R3.current !== g) {
    if (R3.current) R3.scene.remove(R3.current);
    R3.scene.add(g);
    R3.current = g;
    R3.dyn ??= new THREE.Group();
    R3.scene.add(R3.dyn);
    R3.sprites.forEach((s) => (R3.dyn.remove(s), R3.dyn.remove(s.userData.shadow)));
  }
  // Hemmets fönster byter bild mellan dag och natt.
  if (w.__tileMats)
    for (const m of Object.values(w.__tileMats)) {
      const src = w.wallTex?.[m.userData.tile];
      if (src && src !== m.userData.src) {
        m.userData.src = src;
        m.map = tex(src);
        m.needsUpdate = true;
      }
    }
  const day = lightRig(w);
  placeSprites(w, day);
  // Kameran: samma position, riktning och synfält som spelet, med lite huvudgung.
  const cam = R3.camera,
    eye =
      (w.outdoor || w.size > 20 ? EYE3D : Math.min(EYE3D, (w.wallHeight || 1.4) * 0.66)) +
      camera.bob * 0.012;
  cam.position.set(player.x, eye, player.y);
  cam.rotation.y = -player.a - Math.PI / 2;
  cam.rotation.x = Math.atan(pitch * 0.9);
  const vfov = 2 * Math.atan(camera.plane / cam.aspect);
  if (Math.abs(cam.fov - (vfov * 180) / Math.PI) > 0.1) {
    cam.fov = (vfov * 180) / Math.PI;
    cam.updateProjectionMatrix();
  }
  if (job?.type === 'drive') cam.position.y = 1.15;
  R3.renderer.render(R3.scene, cam);
  overlay3d(w);
  drawMap(w);
}
// Namnskyltar, pratbubblor och annat som ritas ovanpå 3D-bilden.
function overlay3d(w) {
  const c = R3.octx,
    cw = R3.overlay.width,
    ch = R3.overlay.height,
    v = new THREE.Vector3(),
    now = performance.now();
  c.clearRect(0, 0, cw, ch);
  const size = clamp(cw / 85, 10, 14);
  const tag = (text, x, y, color) => {
    c.font = '600 ' + size + 'px system-ui';
    const tw = c.measureText(text).width;
    c.fillStyle = '#102635dd';
    c.beginPath();
    c.roundRect(x - tw / 2 - 7, y - size - 10, tw + 14, size + 9, 6);
    c.fill();
    c.fillStyle = color;
    c.textAlign = 'center';
    c.fillText(text, x, y - 6);
  };
  const bubble = (text, x, bottom) => {
    c.font = '500 ' + size + 'px system-ui';
    const maxW = clamp(cw * 0.25, 140, 280),
      lines = [];
    let line = '';
    for (const wd of text.split(/\s+/)) {
      const t = line ? line + ' ' + wd : wd;
      if (c.measureText(t).width > maxW && line) {
        lines.push(line);
        line = wd;
      } else line = t;
    }
    if (line) lines.push(line);
    if (lines.length > 3) {
      lines.length = 3;
      lines[2] += ' …';
    }
    const lh = size + 4,
      bw = Math.min(maxW + 18, Math.max(...lines.map((l) => c.measureText(l).width)) + 18),
      bh = lines.length * lh + 12,
      top = bottom - bh;
    c.fillStyle = '#f4f1e8';
    c.beginPath();
    c.roundRect(x - bw / 2, top, bw, bh, 9);
    c.fill();
    c.beginPath();
    c.moveTo(x - 6, bottom);
    c.lineTo(x, bottom + 7);
    c.lineTo(x + 6, bottom);
    c.fill();
    c.fillStyle = '#1b2a33';
    c.textAlign = 'center';
    lines.forEach((l, i) => c.fillText(l, x, top + 6 + lh * (i + 0.8)));
  };
  const project = (x, y, z) => {
    v.set(x, z, y).project(R3.camera);
    if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.1) return null;
    return [((v.x + 1) / 2) * cw, ((1 - v.y) / 2) * ch];
  };
  for (const o of w.objects) {
    if (!o.label || o.r3) continue;
    if (o.profile && !o.guest && onlineChars.has(o.profile.id)) continue;
    if (o.profile?.id === state?.character) continue;
    const d = Math.hypot(o.x - player.x, o.y - player.y),
      talking = o.bubbleUntil > now;
    if (d > (talking ? 16 : 6) || !lineOfSight(o)) continue;
    const p = project(o.x, o.y, (o.z || 0) + (o.height || 1) + 0.05);
    if (!p) continue;
    if (talking) bubble(o.bubble, p[0], p[1] - size - 14);
    const label =
      near && o.x === near.x && o.y === near.y
        ? o.label
        : o.profile
          ? o.profile.name.split(' ')[0] + (o.activity ? ' · ' + ACTIVITY_TEXT[o.activity] : '')
          : o.type === 'portal'
            ? o.label.split('·')[0]
            : null;
    if (label) tag(label, p[0], p[1], o.type === 'portal' ? '#a7efd0' : '#edf4f3');
  }
  for (const r of remotesHere()) {
    if (Math.hypot(r.x - player.x, r.y - player.y) > 24) continue;
    const p = project(r.x, r.y, 1.15);
    if (!p) continue;
    tag(r.name, p[0], p[1], '#ffcb83');
    if (r.chatUntil > now) bubble(r.chat, p[0], p[1] - size - 14);
  }
  if (job?.type === 'drive') {
    c.fillStyle = '#142635';
    c.beginPath();
    c.moveTo(0, ch);
    c.lineTo(cw * 0.2, ch * 0.87);
    c.quadraticCurveTo(cw * 0.5, ch * 0.82, cw * 0.8, ch * 0.87);
    c.lineTo(cw, ch);
    c.fill();
  }
  const vg = c.createRadialGradient(
    cw / 2,
    ch / 2,
    ch * 0.25,
    cw / 2,
    ch / 2,
    Math.max(cw, ch) * 0.7,
  );
  vg.addColorStop(0, '#0000');
  vg.addColorStop(1, '#05080d55');
  c.fillStyle = vg;
  c.fillRect(0, 0, cw, ch);
}

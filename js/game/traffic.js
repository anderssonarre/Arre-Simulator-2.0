// Trafik: bilar som kör på gatorna i kartorna från OpenStreetMap (campus, Brändöbron och
// centrum). De kör på högra sidan, följer gatorna från kartdatan (roads), svänger in på
// gator som hänger ihop och stannar för dig. Bara bilarna nära dig finns.
'use strict';
const TRAFIK = {
  antal: { outdoor: 5, bron: 7, centrum: 16 }, // bilar samtidigt, mitt på dagen
  fart: 7.5, // rutor per sekund (ca 45 km/h)
  avstånd: 70, // hur långt från dig bilarna finns
  färger: ['#c9ccd0', '#1f2328', '#f2f2ee', '#8a1f22', '#244a7a', '#5b6066', '#2f5a3a', '#b8a27a', '#d0d3d6', '#3a3f45'],
};
const traffic = { world: null, cars: [], graph: null };
function trafficRoads(w) {
  const C = { outdoor: typeof CAMPUS !== 'undefined' && CAMPUS, bron: typeof BRON !== 'undefined' && BRON, centrum: typeof CENTRUM !== 'undefined' && CENTRUM }[w.id];
  return C?.roads || null;
}
// Hur många bilar det är just nu: färre på natten och kvällen.
function trafficWanted(id) {
  const h = state.hour,
    base = TRAFIK.antal[id] || 0,
    k = h < 6 ? 0.15 : h < 7 ? 0.5 : h < 9 ? 1.1 : h < 16 ? 0.9 : h < 18 ? 1.1 : h < 22 ? 0.6 : 0.3;
  return Math.round(base * k);
}
// Körfält: gatans mittlinje förskjuten åt höger i färdriktningen.
function lanePoint(road, i, dir) {
  const pts = road.pts,
    a = pts[i],
    b = pts[i + dir] || pts[i - dir],
    dx = (b[0] - a[0]) * (pts[i + dir] ? 1 : -1),
    dy = (b[1] - a[1]) * (pts[i + dir] ? 1 : -1),
    L = Math.hypot(dx, dy) || 1,
    off = road.oneway ? 0 : road.w / 4;
  return [a[0] - (dy / L) * off, a[1] + (dx / L) * off];
}
function spawnCar(w, roads, far) {
  for (let tries = 0; tries < 30; tries++) {
    const road = roads[Math.floor(Math.random() * roads.length)],
      i = Math.floor(Math.random() * (road.pts.length - 1)),
      [x, y] = road.pts[i],
      d = Math.hypot(x - player.x, y - player.y);
    if (d > TRAFIK.avstånd || (far && d < 25)) continue;
    const dir = road.oneway || Math.random() < 0.5 ? 1 : -1,
      start = dir === 1 ? i : i + 1;
    const [lx, ly] = lanePoint(road, start, dir);
    return {
      road,
      dir,
      i: start,
      x: lx,
      y: ly,
      a: 0,
      v: TRAFIK.fart * (0.8 + Math.random() * 0.35),
      speed: 0,
      color: TRAFIK.färger[Math.floor(Math.random() * TRAFIK.färger.length)],
      honk: 0,
    };
  }
  return null;
}
// Nästa gata vid en ändpunkt: en annan gata som börjar eller slutar där.
function nextRoad(roads, car) {
  const end = car.road.pts[car.dir === 1 ? car.road.pts.length - 1 : 0],
    options = [];
  for (const r of roads) {
    if (r === car.road) continue;
    const first = r.pts[0],
      last = r.pts[r.pts.length - 1];
    if (Math.hypot(first[0] - end[0], first[1] - end[1]) < 1.2) options.push({ road: r, dir: 1, i: 0 });
    if (!r.oneway && Math.hypot(last[0] - end[0], last[1] - end[1]) < 1.2)
      options.push({ road: r, dir: -1, i: r.pts.length - 1 });
    // Korsningar mitt på en gata.
    if (!options.length)
      for (let k = 1; k < r.pts.length - 1; k++)
        if (Math.hypot(r.pts[k][0] - end[0], r.pts[k][1] - end[1]) < 1.2) {
          options.push({ road: r, dir: 1, i: k });
          if (!r.oneway) options.push({ road: r, dir: -1, i: k });
        }
  }
  return options.length ? options[Math.floor(Math.random() * options.length)] : null;
}
function trafficTick(dt) {
  if (!state || !world) return;
  if (traffic.world !== world) {
    traffic.world = world;
    traffic.cars = [];
  }
  const roads = trafficRoads(world);
  if (!roads?.length) return;
  const want = trafficWanted(world.id);
  // Nya bilar dyker upp en bit bort, gamla försvinner när de kommit långt bort.
  while (traffic.cars.length < want) {
    const c = spawnCar(world, roads, traffic.cars.length > 0 || state.day > 0);
    if (!c) break;
    traffic.cars.push(c);
  }
  if (traffic.cars.length > want) traffic.cars.pop();
  for (let k = traffic.cars.length - 1; k >= 0; k--) {
    const c = traffic.cars[k];
    if (Math.hypot(c.x - player.x, c.y - player.y) > TRAFIK.avstånd * 1.3) {
      traffic.cars.splice(k, 1);
      continue;
    }
    // Bromsa för dig och för bilen framför.
    const fx = Math.cos(c.a),
      fy = Math.sin(c.a),
      blocked = (ox, oy, r, w) => {
        const dx = ox - c.x,
          dy = oy - c.y,
          ahead = dx * fx + dy * fy,
          side = Math.abs(-dx * fy + dy * fx);
        return ahead > 0 && ahead < r && side < w;
      };
    // Bara bilar i samma körfält räknas (inte mötande trafik).
    const stopForYou = blocked(player.x, player.y, 6, 1.1),
      stopForCar = traffic.cars.some(
        (o) => o !== c && Math.cos(o.a - c.a) > 0.5 && blocked(o.x, o.y, 4, 0.6),
      );
    const target = stopForYou || stopForCar ? 0 : c.v;
    c.speed = approach(c.speed, target, stopForYou ? 9 : 4, dt);
    // En bil som stått still länge (utan att det är du som står i vägen) kör vidare någon annanstans.
    c.stuck = c.speed < 0.3 && !stopForYou ? (c.stuck || 0) + dt : 0;
    if (c.stuck > 15) {
      traffic.cars.splice(k, 1);
      continue;
    }
    if (stopForYou && c.speed < 0.5 && (c.honk -= dt) <= 0) {
      c.honk = 6 + Math.random() * 6;
      if (Math.hypot(c.x - player.x, c.y - player.y) < 8) honk();
    }
    // Kör mot nästa punkt i körfältet.
    let move = c.speed * dt;
    while (move > 0) {
      const ni = c.i + c.dir;
      if (ni < 0 || ni >= c.road.pts.length) {
        const nx = nextRoad(roads, c);
        if (!nx) {
          traffic.cars.splice(k, 1);
          break;
        }
        Object.assign(c, nx);
        continue;
      }
      const [tx, ty] = lanePoint(c.road, ni, c.dir),
        dx = tx - c.x,
        dy = ty - c.y,
        d = Math.hypot(dx, dy);
      if (d > 0.01) c.a = Math.atan2(dy, dx);
      if (d <= move) {
        c.x = tx;
        c.y = ty;
        c.i = ni;
        move -= d;
      } else {
        c.x += (dx / d) * move;
        c.y += (dy / d) * move;
        move = 0;
      }
    }
  }
}
function honk() {
  if (!audio || muted) return;
  const a = audio,
    t = a.currentTime,
    g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
  g.gain.setValueAtTime(0.08, t + 0.28);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  g.connect(a.destination);
  for (const f of [392, 494]) {
    const o = a.createOscillator();
    o.type = 'square';
    o.frequency.value = f;
    o.connect(g);
    o.start(t);
    o.stop(t + 0.36);
  }
}
// Bilarna som figurer för den klassiska grafiken: från sidan eller framifrån/bakifrån.
function carSprite(color, view) {
  const key = 'car' + color + view;
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas'),
    g = c.getContext('2d'),
    side = view === 'side';
  c.width = side ? 160 : 92;
  c.height = 64;
  g.fillStyle = '#00000040';
  g.beginPath();
  g.ellipse(c.width / 2, 60, c.width * 0.46, 4, 0, 0, 7);
  g.fill();
  if (side) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(8, 50);
    g.lineTo(8, 34);
    g.quadraticCurveTo(12, 28, 30, 27);
    g.lineTo(46, 12);
    g.lineTo(108, 12);
    g.lineTo(128, 27);
    g.quadraticCurveTo(152, 28, 154, 36);
    g.lineTo(154, 50);
    g.closePath();
    g.fill();
    g.fillStyle = '#3c4c58';
    g.beginPath();
    g.moveTo(50, 15);
    g.lineTo(78, 15);
    g.lineTo(78, 27);
    g.lineTo(38, 27);
    g.closePath();
    g.moveTo(82, 15);
    g.lineTo(106, 15);
    g.lineTo(122, 27);
    g.lineTo(82, 27);
    g.closePath();
    g.fill();
    for (const x of [34, 126]) {
      g.fillStyle = '#16181a';
      g.beginPath();
      g.arc(x, 50, 11, 0, 7);
      g.fill();
      g.fillStyle = '#8d9296';
      g.beginPath();
      g.arc(x, 50, 5, 0, 7);
      g.fill();
    }
  } else {
    g.fillStyle = color;
    g.fillRect(6, 26, 80, 26);
    g.beginPath();
    g.moveTo(16, 26);
    g.lineTo(24, 8);
    g.lineTo(68, 8);
    g.lineTo(76, 26);
    g.closePath();
    g.fill();
    g.fillStyle = '#3c4c58';
    g.fillRect(26, 12, 40, 13);
    g.fillStyle = view === 'front' ? '#f4f0d8' : '#b3261e';
    g.fillRect(10, 32, 14, 7);
    g.fillRect(68, 32, 14, 7);
    g.fillStyle = '#16181a';
    g.fillRect(8, 50, 14, 10);
    g.fillRect(70, 50, 14, 10);
    g.fillStyle = '#e9e9e2';
    g.fillRect(36, 42, 20, 6);
  }
  cache[key] = c;
  return c;
}
// Vilken vy av bilen man ser, efter vinkeln mellan bilen och dig.
function carView(c, fromX, fromY) {
  const toMe = Math.atan2(fromY - c.y, fromX - c.x),
    d = Math.atan2(Math.sin(toMe - c.a), Math.cos(toMe - c.a));
  const ad = Math.abs(d);
  return ad < 0.6 ? 'front' : ad > Math.PI - 0.6 ? 'back' : 'side';
}

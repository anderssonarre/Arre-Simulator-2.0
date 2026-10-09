// Personer med egna liv: de följer ett schema, går mellan husen genom dörrarna och gör saker.
'use strict';
const ACTIVITY_TEXT = {
  föreläsning: 'på föreläsning',
  pluggar: 'pluggar',
  lunch: 'äter lunch',
  tränar: 'tränar',
  fest: 'festar',
  jobbar: 'jobbar',
  paus: 'tar en paus',
  promenerar: 'promenerar',
  umgås: 'umgås med vänner',
  kaffe: 'dricker kaffe',
};
const PLACE_TEXT = {
  w33: 'i W33',
  tech: 'på Technobothnia',
  gym: 'på gymmet',
  outdoor: 'ute på campus',
  centrum: 'i Vasa centrum',
};
const WALK_SPEED_NPC = 1.35;
// id -> { p, obj, world (null = hemma), path, plan, goal }
const people = new Map();
let lastPeopleHour = null;

// ---- Var ska personen vara just nu? ----
function dayMatches(spec, day) {
  const wd = weekday(day);
  return (
    spec === wd || (spec === 'vardag' && !isWeekend(day)) || (spec === 'helg' && isWeekend(day))
  );
}
// Planen efter vädret (weather.js): i regn går folk in.
function planFor(id, day, hour) {
  return weatherPlan(id, day, hour, basePlan(id, day, hour));
}
function basePlan(id, day, hour) {
  const S = PEOPLE_SCHEDULE;
  // Gäst på din hemmafest: borta från campus så länge.
  if (homeParty?.guests.includes(id)) return { where: 'hemma' };
  // Fest på fredag och lördag kväll, även efter midnatt.
  const partyPerson = S.festfolk.includes(id) || traitParty(id); // festprissar (traits.js)
  if (partyPerson) {
    const partyDay = hour < 6 ? day - 1 : day,
      h = hour < 6 ? hour + 24 : hour;
    if (['fre', 'lör'].includes(weekday(partyDay)) && h >= S.fest.från && h < S.fest.till)
      return { where: 'w33', activity: 'fest' };
  }
  // Ollis tisdag: festfolket är ute på campus natten mellan tisdag och onsdag.
  if (partyPerson) {
    const night = hour < 3 ? day - 1 : day;
    if (weekday(night) === 'tis' && (hour >= 22 || hour < 3))
      return { where: 'outdoor', activity: 'fest' };
  }
  // Föreläsningar: kurskamrater och lärare.
  for (let i = 0; i < 3; i++) {
    const l = lectureNow(i, day, hour);
    if (!l) continue;
    if (S.lärare[i] === id)
      return { where: LECTURE_ROOM[i].world, activity: 'föreläsning', lecture: i, teacher: true };
    if (S.kurs[i].includes(id))
      return { where: LECTURE_ROOM[i].world, activity: 'föreläsning', lecture: i };
  }
  for (const [spec, from, to, where, activity] of S.egna[id] || [])
    if (dayMatches(spec, day) && hour >= from && hour < to) return { where, activity };
  // Personlighetsdragens rutiner: nattugglor sover länge, plugghästar stannar kvar, och så vidare.
  const own = traitPlan(id, day, hour);
  if (own) return own;
  // Vappen: hela campus har picknick ute på eftermiddagen.
  if (isVappen(day) && hour >= 12 && hour < 20) return { where: 'outdoor', activity: 'fest' };
  // Tentaveckan: kurskamraterna pluggar på kvällarna.
  if (isExamWeek(day) && hour >= 17 && hour < 20 && S.kurs.some((k) => k.includes(id)))
    return { where: S.kurs[0].includes(id) ? 'w33' : 'tech', activity: 'pluggar' };
  // Sitz: festfolket sitter på Filicia på torsdagskvällen.
  if (isSitzDay(day) && hour >= 18 && hour < 23 && partyPerson)
    return { where: 'w33', activity: 'fest' };
  // Bästa vänner umgås ibland på kvällen i W33.
  if (state?.society && hour >= 17 && hour < 21) {
    const best = allIds().find((o) => o !== state.character && npcRel(id, o) >= 70);
    if (best && seeded(day * 31 + hour * 0)() < 0.45) return { where: 'w33', activity: 'umgås' };
  }
  // Helger: en del åker in till stan en stund på eftermiddagen.
  if (isWeekend(day) && hour >= 12 && hour < 17 && seeded(hashId(id) + day * 17)() < 0.3)
    return { where: 'centrum', activity: 'promenerar' };
  if (isWeekend(day) || id === 'ossi') return { where: 'hemma' };
  const p = [...characters, ...extra].find((c) => c.id === id),
    d = S.dag;
  if (hour >= d.lunchFrån && hour < d.lunchTill && !S.lärare.includes(id))
    return { where: 'w33', activity: 'lunch' };
  if (hour >= d.start && hour < d.slut)
    return {
      where: p.place,
      activity: S.lärare.includes(id) ? 'jobbar' : p.place === 'outdoor' ? 'paus' : 'pluggar',
    };
  return { where: 'hemma' };
}

// ---- Platser i varje värld ----
const spotCache = {};
// Lediga rutor nära en punkt, sorterade efter avstånd. Används för att sprida ut folk.
function freeCellsNear(w, x, y, n, maxR = 6) {
  const out = [],
    seen = new Set(),
    q = [[Math.floor(x), Math.floor(y)]];
  while (q.length && out.length < n) {
    const [cx, cy] = q.shift(),
      k = cx + ',' + cy;
    if (seen.has(k)) continue;
    seen.add(k);
    if (Math.hypot(cx + 0.5 - x, cy + 0.5 - y) > maxR) continue;
    if (!isWall(w, cx + 0.5, cy + 0.5)) {
      const px = cx + 0.5,
        py = cy + 0.5;
      if (
        walkable(w, px, py, 0.32) &&
        !w.objects.some((o) => o.action && !o.profile && Math.hypot(o.x - px, o.y - py) < 1)
      )
        out.push([px, py]);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        q.push([cx + dx, cy + dy]);
    }
  }
  return out;
}
function spotsFor(where, activity, lecture) {
  const key = where + ':' + activity + ':' + (lecture ?? '');
  if (spotCache[key]) return spotCache[key];
  const w = worlds[where],
    near = (x, y, n = 10) => freeCellsNear(w, x, y, n);
  let list;
  if (activity === 'föreläsning') {
    const st = w.objects.find((o) => o.lectureIndex === lecture);
    list = near(st.x, st.y, 12);
  } else if (activity === 'lunch' && where === 'w33') list = near(23.5, 21.5, 14);
  else if (activity === 'fest' && where === 'w33') list = near(36.5, 12.5, 14);
  else if (activity === 'tränar') list = near(6.5, 8.5, 8);
  else if (activity === 'kaffe') {
    const m = w.objects.find((o) => o.type === 'coffee');
    list = m ? near(m.x, m.y, 4) : near(w.spawn.x, w.spawn.y, 8);
  }
  else if (activity === 'jobbar' && where === 'outdoor') {
    const job = w.objects.find((o) => o.type === 'job');
    list = near(job.x + 1, job.y, 2);
  } else {
    const base = {
      w33: [
        [17.5, 27.5],
        [27.5, 27.5],
        [29.5, 22.5],
        [21.5, 21.5],
        [12.5, 18.5],
      ],
      tech: [
        [42.5, 27.5],
        [27.5, 31.5],
        [50.5, 27.5],
        [22.5, 35.5],
        [35.5, 34.5],
      ],
      outdoor: [
        [60.5, 75.5],
        [45.5, 66.5],
        [70.5, 95.5],
        [84.5, 120.5],
        [128.5, 168.5],
        [150.5, 158.5],
        [112.5, 150.5],
        [30.5, 90.5],
      ],
      gym: [[6.5, 8.5]],
    }[where] ||
      w.npcSpots || [[w.spawn.x, w.spawn.y]];
    list = base.flatMap(([x, y]) => near(x, y, 3));
  }
  if (!list.length) list = [[w.spawn.x, w.spawn.y]];
  return (spotCache[key] = list);
}
function hashId(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}
function spotFor(id, plan) {
  const list = spotsFor(plan.where, plan.activity, plan.lecture);
  // Läraren står längst fram (första platsen), övriga sprids ut.
  if (plan.teacher) return list[0];
  return list[(hashId(id) % Math.max(1, list.length - 1)) + (list.length > 1 ? 1 : 0)] || list[0];
}

// ---- Vägsökning (A*) på rutnätet ----
function passableGrid(w) {
  if (w._pass) return w._pass;
  const n = w.size,
    g = new Uint8Array(n * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      g[y * n + x] = w.grid[y][x] === 0 && !hitsSolid(w, x + 0.5, y + 0.5, 0.3) ? 1 : 0;
  return (w._pass = g);
}
function findPath(w, sx, sy, tx, ty) {
  const n = w.size,
    pass = passableGrid(w),
    start = Math.floor(sy) * n + Math.floor(sx),
    goal = Math.floor(ty) * n + Math.floor(tx);
  if (start === goal) return [[tx, ty]];
  // A* med en binär hög, så att det går snabbt även på den stora campuskartan.
  const came = new Int32Array(n * n).fill(-1),
    gs = new Float32Array(n * n).fill(Infinity),
    closed = new Uint8Array(n * n),
    gx = goal % n,
    gy = Math.floor(goal / n),
    h = (i) => Math.hypot((i % n) - gx, Math.floor(i / n) - gy),
    heap = [],
    push = (i, f) => {
      heap.push([f, i]);
      let k = heap.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (heap[p][0] <= heap[k][0]) break;
        [heap[p], heap[k]] = [heap[k], heap[p]];
        k = p;
      }
    },
    pop = () => {
      const top = heap[0],
        last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let k = 0;
        for (;;) {
          const l = 2 * k + 1,
            r = l + 1;
          let m = k;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]];
          k = m;
        }
      }
      return top[1];
    };
  gs[start] = 0;
  push(start, h(start));
  let guard = 0;
  while (heap.length && guard++ < Math.max(60000, n * n)) {
    const cur = pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goal) break;
    const cx = cur % n,
      cy = Math.floor(cur / n);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx,
          ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const ni = ny * n + nx;
        if ((!pass[ni] && ni !== goal) || closed[ni]) continue;
        // Inga genvägar genom hörn.
        if (dx && dy && (!pass[cy * n + nx] || !pass[ny * n + cx])) continue;
        const ng = gs[cur] + (dx && dy ? 1.414 : 1);
        if (ng < gs[ni]) {
          gs[ni] = ng;
          came[ni] = cur;
          push(ni, ng + h(ni));
        }
      }
  }
  if (came[goal] === -1) return null;
  const cells = [];
  for (let c = goal; c !== start && c !== -1; c = came[c])
    cells.push([(c % n) + 0.5, Math.floor(c / n) + 0.5]);
  cells.reverse();
  cells[cells.length - 1] = [tx, ty];
  // Stryk mellanpunkter som går att gå rakt förbi, så att vägen blir mjukare.
  const out = [];
  let from = [sx, sy];
  for (let i = 0; i < cells.length; i++) {
    const nextFar = cells[i + 1];
    if (nextFar && clearLine(w, from[0], from[1], nextFar[0], nextFar[1])) continue;
    out.push(cells[i]);
    from = cells[i];
  }
  return out;
}
function clearLine(w, x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  for (let t = 0; t <= d; t += 0.25) {
    const x = x0 + ((x1 - x0) * t) / d,
      y = y0 + ((y1 - y0) * t) / d;
    if (!walkable(w, x, y, 0.25)) return false;
  }
  return true;
}

// ---- Flytta personer mellan världar ----
function doorTo(fromWorld, toWorld) {
  return worlds[fromWorld].objects.find((o) => o.type === 'portal' && o.target === toWorld);
}
// Ställen där personer kommer in på och lämnar kartan (där gatorna går ut).
const campusExits = () => worlds.outdoor.exits;
function placePerson(pp, where, x, y) {
  if (pp.world) {
    const list = worlds[pp.world].objects,
      i = list.indexOf(pp.obj);
    if (i >= 0) list.splice(i, 1);
  }
  pp.world = where === 'hemma' ? null : where;
  pp.path = null;
  if (!pp.world) return;
  pp.obj.x = x;
  pp.obj.y = y;
  pp.obj.targetX = null;
  worlds[where].objects.push(pp.obj);
}
// Nästa delmål på vägen mot målet: en dörr, en utgång från campus eller själva platsen.
function nextLeg(pp) {
  const goal = pp.goal;
  if (!pp.world) {
    if (goal.where === 'hemma') return null;
    // Kommer till campus från vägen.
    const [x, y] = campusExits()[hashId(pp.p.id) % campusExits().length];
    placePerson(pp, 'outdoor', x, y);
    return nextLeg(pp);
  }
  if (pp.world === goal.where) return { x: goal.x, y: goal.y, arrive: true };
  if (pp.world !== 'outdoor') {
    const d = doorTo(pp.world, 'outdoor');
    return { x: d.x, y: d.y, through: { to: 'outdoor', from: pp.world } };
  }
  if (goal.where === 'hemma') {
    const [x, y] = campusExits().reduce((a, b) =>
      Math.hypot(a[0] - pp.obj.x, a[1] - pp.obj.y) < Math.hypot(b[0] - pp.obj.x, b[1] - pp.obj.y)
        ? a
        : b,
    );
    return { x, y, leave: true };
  }
  const d = doorTo('outdoor', goal.where);
  return { x: d.x, y: d.y, through: { to: goal.where, from: 'outdoor' } };
}
function startLeg(pp) {
  pp.leg = nextLeg(pp);
  if (!pp.leg) return;
  pp.path = findPath(worlds[pp.world], pp.obj.x, pp.obj.y, pp.leg.x, pp.leg.y);
  // Hittas ingen väg flyttar personen direkt dit, hellre än att gå genom en vägg.
  if (!pp.path) {
    pp.obj.x = pp.leg.x;
    pp.obj.y = pp.leg.y;
    pp.path = [];
    finishLeg(pp);
  }
}
function finishLeg(pp) {
  const leg = pp.leg;
  pp.leg = null;
  if (leg.leave) placePerson(pp, 'hemma');
  else if (leg.through) {
    // Kliv in genom dörren och dyk upp innanför dörren i nästa värld.
    const d = doorTo(leg.through.to, leg.through.from);
    placePerson(pp, leg.through.to, d.x, d.y);
  }
  if (!leg.arrive) startLeg(pp);
  else pp.path = null;
}
// Ställer alla direkt på rätt plats, t.ex. när spelet startar eller tiden hoppar framåt.
function snapPeople() {
  for (const pp of people.values()) {
    const plan = planFor(pp.p.id, state.day, state.hour);
    applyPlan(pp, plan, true);
  }
  lastPeopleHour = state.day * 24 + state.hour;
}
function applyPlan(pp, plan, snap) {
  pp.plan = plan;
  pp.obj.activity = plan.activity || null;
  pp.obj.lecture = plan.lecture ?? null;
  if (plan.where === 'hemma') {
    pp.goal = { where: 'hemma' };
    if (snap) placePerson(pp, 'hemma');
  } else {
    const [x, y] = spotFor(pp.p.id, plan);
    pp.goal = { where: plan.where, x, y };
    pp.obj.anchorX = x;
    pp.obj.anchorY = y;
    if (snap) placePerson(pp, plan.where, x, y);
  }
  if (!snap) startLeg(pp);
}
function setupPeople() {
  people.clear();
  nightPeople.length = 0;
  crowd.list.length = 0;
  crowd.world = null;
  for (const w of Object.values(worlds)) w.objects = w.objects.filter((o) => !o.profile || o.guest);
  for (const p of [...characters, ...extra]) {
    const o = {
      x: 0,
      y: 0,
      type: 'npc',
      label: p.name,
      action: () => chat(p),
      profile: p,
      sprite: npcSprite(p),
      height: 1.08,
      phase: Math.random() * 6,
      person: true,
    };
    people.set(p.id, { p, obj: o, world: null, path: null, plan: null, goal: null, leg: null });
  }
  snapPeople();
}
// Körs varje bildruta.
function peopleTick(dt) {
  if (!state || !people.size) return;
  const now = state.day * 24 + state.hour;
  // Hoppade tiden (sömn, föreläsning, jobb)? Ställ alla direkt på plats.
  if (lastPeopleHour === null || now - lastPeopleHour > 0.4 || now < lastPeopleHour) {
    snapPeople();
    return;
  }
  lastPeopleHour = now;
  for (const pp of people.values()) {
    const plan = planFor(pp.p.id, state.day, state.hour);
    if (!pp.plan || plan.where !== pp.plan.where || plan.activity !== pp.plan.activity)
      applyPlan(pp, plan, false);
    if (!pp.world) continue;
    const o = pp.obj;
    if (pp.path?.length) {
      const [tx, ty] = pp.path[0],
        dx = tx - o.x,
        dy = ty - o.y,
        d = Math.hypot(dx, dy),
        step = WALK_SPEED_NPC * dt;
      o.targetX = tx;
      o.targetY = ty;
      if (d <= step) {
        o.x = tx;
        o.y = ty;
        pp.path.shift();
        if (!pp.path.length && pp.leg) finishLeg(pp);
      } else {
        o.x += (dx / d) * step;
        o.y += (dy / d) * step;
      }
    } else {
      // Framme: står still och tittar runt, flyttar sig lite ibland.
      o.idle = (o.idle || 0) - dt;
      if (o.idle <= 0) {
        o.idle = 6 + Math.random() * 10;
        const nx = (o.anchorX ?? o.x) + (Math.random() - 0.5) * 0.8,
          ny = (o.anchorY ?? o.y) + (Math.random() - 0.5) * 0.8;
        if (walkable(worlds[pp.world], nx, ny, 0.25)) pp.path = [[nx, ny]];
      } else o.targetX = null;
    }
  }
  chatterTick(dt);
}

// ---- Prat och hälsningar ----
function speak(o, text, seconds = 5) {
  o.bubble = text;
  o.bubbleUntil = performance.now() + seconds * 1000;
}
let chatterTimer = 3;
function chatterTick(dt) {
  if (!world || modal) return;
  const here = world.objects.filter(
    (o) => o.person && !onlineChars.has(o.profile.id) && o.profile.id !== state.character,
  );
  // Hälsar när du går förbi någon du känner.
  for (const o of here) {
    const r = relation(o.profile),
      d = Math.hypot(o.x - player.x, o.y - player.y);
    if (r >= 15 && d < 2.6 && (o.greetedAt || 0) < state.day * 24 + state.hour - 3) {
      o.greetedAt = state.day * 24 + state.hour;
      speak(
        o,
        lifeBark(o) ||
          traitGreeting(o.profile.id) ||
          say(r >= 40 ? DIALOGUE.förbi.vän : DIALOGUE.förbi.bekant, o.profile),
      );
      if (r >= 40) o.waveUntil = performance.now() + 1800;
    }
  }
  talkTick();
  // Småprat mellan personer som står nära varandra.
  chatterTimer -= dt;
  if (chatterTimer > 0) return;
  callOutTick(here);
  chatterTimer = 6 + Math.random() * 8;
  const idle = here.filter(
    (o) =>
      !people.get(o.profile.id)?.path?.length && Math.hypot(o.x - player.x, o.y - player.y) < 12,
  );
  for (const a of shuffled(idle)) {
    const b = idle.find((o) => o !== a && Math.hypot(o.x - a.x, o.y - a.y) < 2.2);
    if (!b) continue;
    // Pratsamma pratar oftare, introverta mer sällan.
    if (Math.random() > Math.min(1, 0.6 * traitTalk(a.profile.id))) continue;
    // Dagens samtal om de har ett, annars lite småprat.
    if (!startTalk(a, b) && !talksNow.some((t) => t.a === a || t.b === a))
      speak(a, rand(DIALOGUE.småprat), 4);
    break;
  }
}
// Text om var någon är just nu, för "Vet du var X är?" och kartan.
function whereIs(id) {
  const pp = people.get(id);
  if (!pp) return null;
  const plan = pp.plan || planFor(id, state.day, state.hour);
  if (plan.where === 'hemma') return { home: true, text: 'hemma' };
  return {
    home: false,
    place: PLACE_TEXT[plan.where] || plan.where,
    activity:
      plan.activity === 'föreläsning'
        ? 'på föreläsning i ' + course(plan.lecture).name
        : ACTIVITY_TEXT[plan.activity] || '',
    text: (PLACE_TEXT[plan.where] || plan.where) + ' · ' + (ACTIVITY_TEXT[plan.activity] || ''),
  };
}
function askWhere(p) {
  const others = [...characters, ...extra].filter((c) => c.id !== p.id && c.id !== state.character);
  dialog(
    'Vet du var någon är?',
    '<p>Fråga ' + esc(p.name.split(' ')[0]) + ' om någon av de andra.</p>',
    [
      ...others.map((c) => ({
        label: c.name,
        run: () => {
          const wi = whereIs(c.id),
            answer = wi.home
              ? say(DIALOGUE.varÄr.hemma, c)
              : say(DIALOGUE.varÄr.vet, c, { plats: wi.place, aktivitet: wi.activity });
          remember(p, 'you', 'Vet du var ' + c.name.split(' ')[0] + ' är?');
          remember(p, 'npc', answer);
          chat(p);
        },
      })),
      { label: 'Tillbaka', primary: true, run: () => chat(p) },
    ],
    'Campusfolk',
  );
}

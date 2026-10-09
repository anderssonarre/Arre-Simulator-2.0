// Fas 10: levande vardag. En gång per speldag får varje person något att tänka på, egna sätt
// att hälsa på dig, och vänner som ses får något att prata om. Med AI på servern skriver
// Claude Haiku allt utifrån humör, schema, vänner och skvaller (server/ai.js, /api/day).
// Utan AI används raderna i js/data/dialogue.js (tanke, samtal, ropar).
// Online skriver servern tankar och samtal en gång per speldag, samma för alla som spelar, och
// samtalen kan handla om er riktiga spelare. Hälsningarna till dig är personliga (/api/greet).
// Allt sparas i state.life och gäller resten av speldagen.
'use strict';
let lifeFetching = 0;
const talksNow = []; // samtal som pågår: { a, b, lines, i, next, aId, bId }

// Personerna som lever i världen idag (inte du själv och inte andra riktiga spelare).
function lifePeople() {
  return [...characters, ...extra].filter((p) => p.id !== state.character);
}
// Vad personen gör idag, i ord: "9 föreläsning i X, 12 lunch, 17 tränar på gymmet".
function dayPlanText(id, day = state.day) {
  const out = [];
  let lastKey = '';
  for (let h = 8; h <= 23; h += 1) {
    const p = planFor(id, day, h),
      key = p.where + p.activity;
    if (key === lastKey) continue;
    lastKey = key;
    if (p.where === 'hemma') {
      if (h > 8 && h < 22) out.push(h + ' hemma');
      continue;
    }
    const what =
      p.activity === 'föreläsning' ? 'föreläsning i ' + course(p.lecture).name : p.activity;
    out.push(h + ' ' + what + ' ' + (PLACE_TEXT[p.where] || p.where));
  }
  return out.join(', ') || 'ledig, mest hemma';
}
// Vilka som är på samma ställe samtidigt idag, minst en timme. Vänner och osams först.
function pairsMeetingToday(day = state.day) {
  const together = new Map();
  const ids = lifePeople().map((p) => p.id);
  for (let h = 8; h <= 23.5; h += 0.5) {
    const at = {};
    for (const id of ids) {
      const p = planFor(id, day, h);
      if (p.where !== 'hemma') (at[p.where] ??= []).push(id);
    }
    for (const list of Object.values(at))
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) {
          const k = pairKey(list[i], list[j]);
          together.set(k, (together.get(k) || 0) + 0.5);
        }
  }
  const r = seeded(day * 131 + 7);
  return [...together.entries()]
    .filter(([, hours]) => hours >= 1)
    .map(([k]) => {
      const [a, b] = k.split('|'),
        rel = npcRel(a, b);
      const weight = (rel >= 35 ? 3 : rel <= -20 ? 2.5 : 1) + r();
      return { a, b, rel, weight };
    })
    .sort((x, y) => y.weight - x.weight)
    .slice(0, 5)
    .map(({ a, b, rel }) => ({
      a,
      b,
      why: rel >= 70 ? 'bästa vänner' : rel >= 35 ? 'vänner' : rel <= -20 ? 'osams' : 'bekanta',
    }));
}

// ---- Dagens liv utan AI ----
function localLife() {
  const day = state.day,
    r = seeded(day * 53 + 11),
    pick = (a) => a[Math.floor(r() * a.length)],
    fill = (line, map) => line.replace(/\{(\w+)\}/g, (m, k) => map[k] ?? m);
  const thoughts = {},
    barks = {};
  const examSoon = typeof isExamWeek === 'function' && isExamWeek(day);
  for (const p of lifePeople()) {
    const m = state.society?.mood[p.id] ?? 60,
      plan = planFor(p.id, day, 13),
      party = planFor(p.id, day, 21).activity === 'fest';
    const list = party
      ? DIALOGUE.tanke.fest
      : examSoon && r() < 0.6
        ? DIALOGUE.tanke.tenta
        : m >= 55
          ? DIALOGUE.tanke.glad
          : m >= 35
            ? DIALOGUE.tanke.trött
            : DIALOGUE.tanke.nere;
    thoughts[p.id] = fill(pick(list), {
      aktivitet: plan.where === 'hemma' ? 'vila' : ACTIVITY_TEXT[plan.activity] || plan.activity,
    });
  }
  const talks = pairsMeetingToday(day).map(({ a, b, why }) => {
    const pa = lifePeople().find((p) => p.id === a);
    const aboutYou = why !== 'osams' && r() < 0.25 && (state.relations[a] || 0) > 10;
    const lines = pick(
      why === 'osams'
        ? DIALOGUE.samtal.osams
        : aboutYou
          ? DIALOGUE.samtal.omDig
          : DIALOGUE.samtal.vänner,
    );
    return {
      a,
      b,
      om: aboutYou ? playerName() : null,
      lines: lines.map((l) =>
        fill(l, {
          a: firstName(a),
          b: firstName(b),
          jag: playerName().split(' ')[0],
          ämne: pa?.topic || 'plugget',
        }),
      ),
    };
  });
  return { day, ai: false, thoughts, barks, talks, played: [], told: [] };
}

// ---- Dagens liv med AI ----
function lifeRequest() {
  const meeting = pairsMeetingToday();
  const events = [
    typeof isExamWeek === 'function' && isExamWeek() ? 'tentavecka' : '',
    typeof isSitzDay === 'function' && isSitzDay() ? 'sitz ikväll' : '',
    typeof isVappen === 'function' && isVappen() ? 'vappen' : '',
    weekdayIndex(state.day) >= 4 ? 'fest på Filicia ikväll' : '',
  ].filter(Boolean);
  return {
    playerName: playerName(),
    date: typeof dateText === 'function' ? dateText() : '',
    weekday: WEEKDAY_NAMES[weekdayIndex(state.day)],
    weather: typeof weatherText === 'function' ? weatherText() : '',
    events: events.join(', '),
    // Online delar alla samma speldag på servern, så svaret blir samma för alla.
    serverDay: typeof sharedClock === 'function' && sharedClock() ? state.day - net.clock.offset : null,
    // Bara det som gäller alla: inget om vad personerna tycker om just dig.
    people: lifePeople().map((p) => {
      const sc = socialContext(p.id);
      return {
        id: p.id,
        name: p.name,
        role: p.role,
        personality: p.personality,
        topic: p.topic,
        mood: sc.mood,
        plan: dayPlanText(p.id),
        friends: sc.friends,
      };
    }),
    news: (state.society?.news || []).slice(-6).map((n) => n.text),
    pairs: meeting,
  };
}
// Det personliga: de du känner, med vad de tycker om dig, minns och har hört.
function greetRequest() {
  return {
    playerName: playerName(),
    people: lifePeople()
      .filter((p) => (state.relations[p.id] || 0) >= 15)
      .map((p) => {
        const sc = socialContext(p.id),
          rel = state.relations[p.id];
        return {
          id: p.id,
          name: p.name,
          personality: p.personality,
          mood: sc.mood,
          relation: relationName(rel).toLowerCase() + ' (' + rel + ')',
          thought: lifeThought(p.id),
          memory: (state.memories?.[p.id] || []).slice(-3).join('; '),
          rumor: sc.rumor,
        };
      }),
  };
}
const aiPost = (path, body) =>
  fetch(path, { method: 'POST', headers: aiHeaders(), body: JSON.stringify(body) });
async function fetchAiLife(day) {
  if (lifeFetching === day) return;
  lifeFetching = day;
  const current = () => state && state.day === day && state.life?.day === day;
  try {
    const r = await aiPost('/api/day', lifeRequest());
    if (r.status === 200) {
      const d = await r.json();
      // Hann dagen ta slut medan vi väntade? Då gäller inte svaret längre.
      if (!current()) return;
      const L = state.life;
      for (const [id, v] of Object.entries(d.personer || {})) if (v.tanke) L.thoughts[id] = v.tanke;
      if (d.samtal?.length)
        L.talks = d.samtal.map((s) => ({ a: s.a, b: s.b, om: s.om || null, lines: s.repliker }));
      L.ai = true;
      L.shared = !!d.shared;
    }
  } catch {}
  // Sedan hälsningarna till dig, när tankarna finns att bygga på.
  try {
    const req = greetRequest();
    if (!current() || !req.people.length) return;
    const r = await aiPost('/api/greet', req);
    if (r.status !== 200) return;
    const g = await r.json();
    if (!current()) return;
    for (const [id, list] of Object.entries(g)) state.life.barks[id] = list;
  } catch {}
}
// Körs när en ny speldag börjar (och när ett spel laddas).
function lifeDay() {
  state.life = localLife();
  lifeWait = { day: state.day, since: performance.now() };
}
// AI-svaret hämtas först när anslutningen till servern är klar. Annars frågar spelet en gång
// innan anslutningen och en gång till när dagen ställs om efter serverns klocka.
let lifeWait = null;
function lifeAiTick() {
  if (!lifeWait || lifeWait.day !== state.day) return;
  const waiting = serverFound === null || net.status === 'connecting';
  if (waiting && performance.now() - lifeWait.since < 10000) return;
  lifeWait = null;
  if (aiAvailable()) fetchAiLife(state.day);
}
function lifeThought(id) {
  return state?.life?.day === state.day ? state.life.thoughts[id] || '' : '';
}

// ---- I världen: hälsningar, samtal mellan personerna och vänner som ropar ----
// Ersätter de färdiga hälsningarna när dagen har egna.
function lifeBark(o) {
  const list = state.life?.barks[o.profile.id];
  if (!list?.length) return null;
  o.barkIndex = ((o.barkIndex ?? -1) + 1) % list.length;
  return list[o.barkIndex];
}
// Startar dagens samtal mellan a och b om de står nära varandra. Ger true om det startade.
function startTalk(a, b) {
  const L = state.life;
  if (!L || talksNow.length >= 2) return false;
  const k = pairKey(a.profile.id, b.profile.id);
  if (L.played.includes(k)) return false;
  const t = L.talks.find((t) => pairKey(t.a, t.b) === k);
  if (!t) return false;
  L.played.push(k);
  const first = t.a === a.profile.id ? a : b,
    second = first === a ? b : a;
  talksNow.push({ a: first, b: second, lines: t.lines, i: 0, next: 0, om: t.om });
  return true;
}
function talkTick() {
  const now = performance.now();
  for (let n = talksNow.length - 1; n >= 0; n--) {
    const t = talksNow[n];
    const apart = Math.hypot(t.a.x - t.b.x, t.a.y - t.b.y) > 3.5;
    if (apart || t.i >= t.lines.length || !world.objects.includes(t.a)) {
      if (now >= t.next || apart) {
        t.a.lookAt = t.b.lookAt = null;
        talksNow.splice(n, 1);
      }
      continue;
    }
    t.a.lookAt = t.b;
    t.b.lookAt = t.a;
    if (now < t.next) continue;
    const who = t.i % 2 ? t.b : t.a,
      line = t.lines[t.i];
    speak(who, line, 4.2);
    who.gestureUntil = now + 3500;
    // Pratar de om dig, eller om en kompis som också spelar? Står du nära hör du det.
    if (t.i === 0 && t.om && Math.hypot(t.a.x - player.x, t.a.y - player.y) < 6) {
      const me = t.om.toLowerCase() === playerName().toLowerCase();
      toast(
        'Du hör ' +
          firstName(t.a.profile.id) +
          ' och ' +
          firstName(t.b.profile.id) +
          ' prata om ' +
          (me ? 'dig.' : t.om + '.'),
      );
    }
    t.i++;
    t.next = now + 2600 + line.length * 45;
  }
}
// En vän som har något på hjärtat ropar på dig, en gång per dag.
function callOutTick(here) {
  const L = state.life;
  if (!L) return;
  for (const o of here) {
    const id = o.profile.id;
    if (L.told.includes(id) || (state.relations[id] || 0) < 40 || !L.thoughts[id]) continue;
    const d = Math.hypot(o.x - player.x, o.y - player.y);
    if (d < 3 || d > 7 || people.get(id)?.path?.length) continue;
    if (o.calledOut === state.day) continue;
    o.calledOut = state.day;
    speak(o, say(DIALOGUE.ropar, o.profile), 4);
    o.waveUntil = performance.now() + 2500;
    break;
  }
}
// Första gången idag ni pratar berättar personen vad hen tänker på.
function tellThought(p) {
  const L = state.life,
    t = lifeThought(p.id);
  if (!L || !t || L.told.includes(p.id)) return null;
  const r = state.relations[p.id] || 0;
  // Blyga och kalla säger det bara till vänner.
  if (r < 15 || (r < 40 && ['shy', 'cold'].includes(p.personality))) return null;
  L.told.push(p.id);
  return t;
}

// Okända studerande: folk man inte känner som går mellan husen, står och pratar i korridorerna
// och går in och ut genom dörrarna. Flest mitt på dagen på vardagar.
'use strict';
const CROWD = {
  // Hur många som är ute samtidigt per plats, vardag mitt på dagen. Kvällar och helger färre.
  antal: { outdoor: 16, w33: 12, tech: 9, gym: 4 },
  namn: [
    'Emma',
    'Oliver',
    'Aino',
    'Elias',
    'Linnea',
    'Hugo',
    'Ella',
    'Noah',
    'Alva',
    'Eino',
    'Venla',
    'Onni',
    'Matilda',
    'Lukas',
    'Selma',
    'Anton',
    'Wilma',
    'Kasper',
    'Elsa',
    'Joel',
  ],
  färger: [
    '#3b5f8a',
    '#8a3b3b',
    '#2f6b4f',
    '#6b5b2f',
    '#5a3f7a',
    '#2b2f36',
    '#a46a2a',
    '#d8d4c8',
    '#4f7f8f',
    '#7a2f55',
  ],
  repliker: [
    'Har du gjort labben redan?',
    'Kaffe innan föreläsningen?',
    'Tentan på fredag, jag är inte redo.',
    'Var är sal B-hundra-nånting?',
    'Lunchen idag var faktiskt god.',
    'Jag har sovit typ fyra timmar.',
    'Ska du på Filicia i helgen?',
    'Wifin funkar inte igen.',
    'Har någon laddare?',
    'Grupparbetet... ingen svarar i chatten.',
  ],
  hälsningar: [
    'Hej! Nya här?',
    'Tjena. Har vi en kurs ihop?',
    'Hej hej, jag är på väg till föreläsning.',
    'Moi! Eller hej, menar jag.',
  ],
};
const crowd = { world: null, list: [], seed: 1 };
// Hur många som borde vara på en plats just nu.
function crowdWanted(id) {
  const h = state.hour,
    base = CROWD.antal[id] || 0;
  if (!base || h < 7 || h >= 22) return 0;
  const weekend = isWeekend(state.day),
    peak = h >= 9 && h < 16 ? 1 : h >= 7.5 && h < 18 ? 0.6 : 0.25;
  if (isVappen() && id === 'outdoor' && h >= 11 && h < 21) return base * 2;
  return Math.round(base * peak * (weekend ? (id === 'gym' || id === 'outdoor' ? 0.5 : 0.15) : 1));
}
function makeStranger(w) {
  const r = seeded((crowd.seed += 7919)),
    name = CROWD.namn[Math.floor(r() * CROWD.namn.length)],
    profile = {
      id: 'okänd' + crowd.seed,
      name,
      role: 'Studerande',
      personality: ['friendly', 'shy', 'chatty', 'cold'][Math.floor(r() * 4)],
      topic: ['teknik', 'matematik', 'fest', 'sport', 'spel'][Math.floor(r() * 5)],
      color: CROWD.färger[Math.floor(r() * CROWD.färger.length)],
      hair: ['#2b1d14', '#6b4a2b', '#d8b26a', '#1a1a1a', '#8a4b2a'][Math.floor(r() * 5)],
      skin: ['#e5b89b', '#d9a582', '#f0c9ae', '#b98a6b'][Math.floor(r() * 4)],
    },
    [x, y] = crowdSpot(w, r),
    o = {
      x,
      y,
      type: 'npc',
      label: name,
      profile,
      sprite: npcSprite(profile),
      height: 1.02 + r() * 0.1,
      phase: r() * 6,
      stranger: true,
    };
  o.action = () => strangerChat(o);
  // Vissa står still och pratar, andra går runt.
  return { o, path: null, wait: r() * 5, talk: 4 + r() * 20, idle: r() < 0.35, leaving: false };
}
function crowdSpot(w, r) {
  if (w.id === 'outdoor') return randomOutdoorSpot(Math.floor(r() * 1e6));
  for (let i = 0; i < 60; i++) {
    const x = 1 + r() * (w.size - 2),
      y = 1 + r() * (w.size - 2);
    if (walkable(w, x, y, 0.3)) return [x, y];
  }
  return [w.spawn.x, w.spawn.y];
}
function removeStranger(n) {
  const list = crowd.world?.objects,
    k = list ? list.indexOf(n.o) : -1;
  if (k >= 0) list.splice(k, 1);
  crowd.list.splice(crowd.list.indexOf(n), 1);
}
function clearCrowd() {
  for (const n of [...crowd.list]) removeStranger(n);
  crowd.world = null;
}
// Körs varje bildruta, bara för den värld du är i.
function crowdTick(dt) {
  if (!state || !world) return;
  if (crowd.world !== world) {
    clearCrowd();
    crowd.world = world;
  }
  const w = world,
    want = crowdWanted(w.id);
  while (crowd.list.filter((n) => !n.leaving).length < want) {
    const n = makeStranger(w);
    crowd.list.push(n);
    w.objects.push(n.o);
  }
  let extra = crowd.list.filter((n) => !n.leaving).length - want;
  for (const n of crowd.list)
    if (extra > 0 && !n.leaving) {
      n.leaving = true;
      n.path = null;
      n.wait = 0;
      extra--;
    }
  for (const n of [...crowd.list]) {
    const o = n.o;
    if (!n.path) {
      n.wait -= dt;
      o.targetX = null;
      if (n.wait > 0) continue;
      if (n.idle && !n.leaving) {
        n.wait = 8 + Math.random() * 12;
        if (Math.random() < 0.3) n.idle = false;
        continue;
      }
      // Går till en dörr (och försvinner in) eller till ett nytt ställe.
      const doors = w.objects.filter((d) => d.type === 'portal');
      let target;
      if ((n.leaving || Math.random() < 0.25) && doors.length) {
        const d = doors[Math.floor(Math.random() * doors.length)];
        target = [d.x, d.y];
        n.toDoor = true;
      } else target = crowdSpot(w, seeded(Math.floor(Math.random() * 1e6)));
      n.path = findPath(w, o.x, o.y, target[0], target[1]) || [];
      if (!n.path.length) {
        if (n.leaving) removeStranger(n);
        else n.wait = 3;
        continue;
      }
    }
    if (!n.path?.length) {
      n.path = null;
      continue;
    }
    const [tx, ty] = n.path[0],
      dx = tx - o.x,
      dy = ty - o.y,
      d = Math.hypot(dx, dy),
      step = 1.2 * dt;
    o.targetX = tx;
    o.targetY = ty;
    if (d <= step) {
      o.x = tx;
      o.y = ty;
      n.path.shift();
      if (!n.path.length) {
        n.path = null;
        n.wait = 2 + Math.random() * 8;
        if (n.toDoor) removeStranger(n);
        n.toDoor = false;
      }
    } else {
      o.x += (dx / d) * step;
      o.y += (dy / d) * step;
    }
    n.talk -= dt;
    if (n.talk <= 0 && Math.hypot(o.x - player.x, o.y - player.y) < 10) {
      n.talk = 12 + Math.random() * 25;
      speak(o, rand(CROWD.repliker), 4);
    }
  }
}
// Prata med någon okänd. Med AI på servern svarar personen fritt, annars med färdiga repliker.
// Okända sparas inte i historiken, men den första pratstunden per dag ger lite socialt.
function strangerChat(o, lines = null) {
  // Okända räknas också som att prata med någon första dagen.
  tutorialDone('prata');
  const p = o.profile;
  lines ??= [{ who: 'npc', text: rand(CROWD.hälsningar) }];
  o.chatLines = lines;
  dialog(
    p.name,
    '<span class="badge">Okänd studerande</span><div class="history">' +
      lines
        .slice(-6)
        .map(
          (h) =>
            '<div class="bubble ' + (h.who === 'you' ? 'you' : '') + '">' + esc(h.text) + '</div>',
        )
        .join('') +
      '</div><input id="chatInput" type="text" maxlength="180" placeholder="Säg något …" aria-label="Din replik">',
    [
      { label: 'Skicka', primary: true, run: () => strangerSay(o, $('chatInput').value.trim()) },
      { label: 'Hej då', run: close },
    ],
    'Okänd',
  );
  $('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
      strangerSay(o, e.target.value.trim());
    }
  });
  setTimeout(() => $('chatInput')?.focus(), 50);
}
async function strangerSay(o, text) {
  if (!text) return;
  const lines = [...o.chatLines, { who: 'you', text }],
    p = o.profile,
    reply = { who: 'npc', text: '…' };
  lines.push(reply);
  strangerChat(o, lines);
  if (!o.metToday || o.metToday !== state.day) {
    o.metToday = state.day;
    addXp('socialt', 2);
    gain('happy', 2);
  }
  let answer = null;
  if (aiAvailable())
    try {
      const r = await fetch('/api/talk', {
        method: 'POST',
        headers: aiHeaders(),
        body: JSON.stringify({
          person: {
            name: p.name,
            role: 'studerande som du inte känner',
            personality: p.personality,
            topic: p.topic,
          },
          context: { ...aiContext({ id: '', name: p.name }), relation: 0, relationName: 'okänd' },
          history: lines.slice(0, -2).map((h) => ({ who: h.who, text: h.text })),
          text,
        }),
      });
      if (r.status === 200) answer = (await r.json()).svar;
    } catch {}
  reply.text = answer || rand(CROWD.repliker);
  if (modal && $('dialogTag').textContent === 'Okänd' && $('dialogTitle').textContent === p.name)
    strangerChat(o, lines);
}

// Fas 16: årets evenemang (nollning, halloween, lucia, lillajul, midsommar ...), bastun på
// WSC och pulkabacken på vintern. Innehållet finns i js/data/evenemang.js.
// Läget sparas i state.evenemang: { id: studieår } så att varje evenemang händer en gång per år.
'use strict';
// Spelets år är 112 dagar, så en speldag motsvarar några kalenderdagar. Vilka?
function calendarSpan(day = state?.day ?? 1) {
  const perMonth = YEAR.dagar / 12,
    yd = yearDay(day),
    m = monthIndex(day),
    from = ((yd - m * perMonth) / perMonth) * 30 + 1;
  return { m, från: from, till: from + 30 / perMonth };
}
const studyYear = (day = state?.day ?? 1) => Math.floor((day - 1) / YEAR.dagar) + 1;
function eventsOn(day = state?.day ?? 1) {
  const s = calendarSpan(day);
  return EVENEMANG.filter((e) => e.månad === s.m && e.dagar[0] < s.till && e.dagar[1] + 1 > s.från);
}
function eventOpen(e, hour = state.hour) {
  return hour >= e.tid.från && hour < e.tid.till;
}
const eventDone = (e) => state.evenemang?.[e.id] === studyYear();

// ---- Personerna går dit (används av planFor i people.js) ----
function eventPlan(id, day, hour) {
  for (const [i, e] of eventsOn(day).entries()) {
    const p = PLATSER[e.plats];
    if (!p || !eventOpen(e, hour)) continue;
    if (seeded(hashId(id) + day * 7 + i * 131)() < e.folk)
      return { where: p.värld, activity: 'evenemang', lecture: e.plats };
  }
  return null;
}

// ---- Markeringar och det som händer på plats ----
let eventDay = null;
function eventsTick() {
  if (!state || state.day === eventDay) return;
  eventDay = state.day;
  for (const w of Object.values(worlds)) w.objects = w.objects.filter((o) => o.type !== 'event');
  const today = eventsOn();
  for (const e of today) {
    const spot = questSpot(e.plats);
    if (!spot) continue;
    worlds[spot.world].objects.push({
      x: spot.x + 0.6,
      y: spot.y + 0.6,
      type: 'event',
      height: 1.8,
      sprite: questSprite(),
      get label() {
        return e.namn + (eventDone(e) ? ' · du har varit med' : eventOpen(e) ? ' · nu!' : ' · ' + e.tid.från + '–' + (e.tid.till % 24));
      },
      action: () => eventPrompt(e),
    });
  }
  // Säsongens pynt: julgranen på torget i december.
  for (const w of Object.values(worlds))
    for (const o of w.objects) if (o.månad != null) o.hidden = monthIndex() !== o.månad;
  if (today.length)
    setTimeout(
      () => toast('Idag: ' + today.map((e) => e.namn + ' ' + PLATSER[e.plats].namn + ' ' + e.tid.från + '–' + (e.tid.till % 24)).join(', ')),
      2500,
    );
}
function eventPrompt(e) {
  if (eventDone(e)) return toast('Du har redan varit med på ' + e.namn.toLowerCase() + ' i år.');
  if (!eventOpen(e)) return toast(e.namn + ' är ' + e.tid.från + '–' + (e.tid.till % 24) + '. Kom tillbaka då.');
  dialog(
    e.namn,
    '<p>' + esc(e.text) + '</p>',
    [
      ...e.val.map((v) => ({
        label: v.knapp,
        primary: true,
        disabled: (v.effekt.pengar || 0) < 0 && state.money < -v.effekt.pengar,
        run: () => eventChoice(e, v),
      })),
      { label: 'Inte nu', run: close },
    ],
    'Evenemang',
  );
}
function eventChoice(e, v) {
  const f = v.effekt || {};
  state.evenemang ??= {};
  state.evenemang[e.id] = studyYear();
  applyEffect(f);
  if (f.socialt) addXp('socialt', f.socialt);
  if (f.märke) addBadge(f.märke);
  for (const id of witnessesHere(12)) bump(id, 2);
  advance(60);
  reportHappening('evenemang', { titel: e.namn });
  save();
  sound('win');
  dialog(e.namn, '<p>' + esc(v.text) + '</p>', [{ label: 'Härligt', primary: true, run: close }], 'Evenemang');
}
// Det som händer de närmaste veckorna, för kalendern.
function upcomingEvents(days = 21) {
  const out = [];
  for (let d = state.day; d < state.day + days; d++)
    for (const e of eventsOn(d))
      if (!out.some((x) => x.e === e)) out.push({ e, d });
  return out;
}

// ---- Bastun på Wasa Sports Club ----
function placeSauna() {
  const w = worlds.gym;
  if (!w) return;
  const o = station(w, ...freeSpotNear(w, 10.5, 4.5), 'rest', 'Bastu', sauna);
  Object.defineProperty(o, 'label', {
    get: () =>
      state && (state.hour < BASTU.öppet.från || state.hour >= BASTU.öppet.till)
        ? 'Bastun · varm ' + BASTU.öppet.från + '–' + BASTU.öppet.till
        : state?.saunaDay === state?.day
          ? 'Bastu · du har redan badat idag'
          : 'Bastu · bada en stund',
    enumerable: true,
  });
}
function sauna() {
  if (state.hour < BASTU.öppet.från || state.hour >= BASTU.öppet.till)
    return toast('Bastun är varm ' + BASTU.öppet.från + '–' + BASTU.öppet.till + '.');
  if (state.saunaDay === state.day) return toast('Du har redan badat bastu idag. Imorgon igen!');
  state.saunaDay = state.day;
  advance(BASTU.minuter);
  applyEffect(BASTU.effekt);
  changeCond(BASTU.tillstånd);
  if (state.cond) state.cond.blöt = 0;
  const snow = snowCover() >= 0.5;
  save();
  sound('win');
  dialog(
    'Löyly!',
    '<p>Du kastar vatten på stenarna och värmen sveper över dig. Ingen säger något på en lång stund, och det är precis rätt.</p>' +
      '<div class="info">+' + BASTU.effekt.glädje + ' glädje · +' + BASTU.effekt.energi + ' energi · klarare i huvudet</div>' +
      (snow ? '<p>Ute ligger snön. Vågar du?</p>' : ''),
    [
      ...(snow
        ? [
            {
              label: 'Rulla dig i snön!',
              primary: true,
              run: () => {
                gain('happy', BASTU.snöbad.glädje);
                addBadge(BASTU.snöbad.märke);
                save();
                dialog('Snöbad', '<p>AAAAH! Huden pirrar och du känner dig odödlig.</p>', [{ label: 'Tillbaka in i värmen', primary: true, run: close }], 'Bastu');
              },
            },
          ]
        : []),
      { label: 'Skönt', primary: !snow, run: close },
    ],
    'Bastu',
  );
}

// ---- Pulkabacken ----
function placeSled() {
  const w = worlds[PULKA.plats.värld];
  if (!w) return;
  let spot = null;
  for (let r = 0; r < 40 && !spot; r += 0.5)
    for (let a = 0; a < 6.28 && !spot; a += 0.25) {
      const x = Math.floor(PULKA.plats.x + Math.cos(a) * r) + 0.5,
        y = Math.floor(PULKA.plats.y + Math.sin(a) * r) + 0.5;
      if (w.ground && groundAt(w, x, y) !== GROUND.GRASS) continue;
      if (!walkable(w, x, y, 0.6) || !findPath(w, w.spawn.x, w.spawn.y, x, y)) continue;
      if (w.objects.some((o) => o.action && Math.hypot(o.x - x, o.y - y) < 4)) continue;
      spot = [x, y];
    }
  if (!spot) return;
  const o = obj(w, spot[0], spot[1], 'sled', 'Pulka', sled, { height: 0.45, sprite: sledSprite() });
  Object.defineProperty(o, 'label', {
    get: () => (snowCover() >= 0.5 ? 'Pulkabacken · åk en sväng' : 'Pulkan · väntar på snö'),
    enumerable: true,
  });
}
function sledSprite() {
  if (cache.sled) return cache.sled;
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 48;
  const g = c.getContext('2d');
  g.fillStyle = '#c8322b';
  g.beginPath();
  g.moveTo(8, 20);
  g.lineTo(80, 20);
  g.quadraticCurveTo(96, 20, 90, 38);
  g.lineTo(14, 38);
  g.closePath();
  g.fill();
  g.strokeStyle = '#2b2f36';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(10, 44);
  g.lineTo(84, 44);
  g.quadraticCurveTo(94, 44, 92, 34);
  g.stroke();
  cache.sled = c;
  return c;
}
function sled() {
  if (snowCover() < 0.5) return toast('Det finns ingen snö. Pulkan får vänta på vintern.');
  if (state.sledDay === state.day) return toast('Benen är redan mör efter dagens åkning.');
  state.sledDay = state.day;
  gain('happy', PULKA.glädje);
  gain('energy', PULKA.energi);
  advance(30);
  for (const id of witnessesHere(10)) bump(id, 1);
  save();
  sound('win');
  toast('Wiiii! Du åker ner för backen tre gånger och välter i den sista. +' + PULKA.glädje + ' glädje');
}

// Kollar datafilen när spelet startar.
for (const e of EVENEMANG) {
  if (!PLATSER[e.plats]) console.warn('Evenemang ' + e.id + ': okänd plats ' + e.plats);
  if (!(e.månad >= 0 && e.månad < 12) || e.dagar?.length !== 2) console.warn('Evenemang ' + e.id + ': fel datum');
}

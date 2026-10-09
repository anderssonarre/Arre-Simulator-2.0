// Oliver's Inn, "Ollis": baren vid Handelsesplanaden i Vasa centrum (läget kontrollerat mot
// Google Maps: Kauppapuistikko 8). Öppet tisdag till lördag på kvällen, och tisdagar är det
// billig öl från kran. Därför är "Ollis tisdag" en grej. Öppettider och priser finns i
// OLLIS i js/data/centrum-platser.js.
'use strict';
function ollisOpenAt(day, hour) {
  // Efter midnatt hör natten till dagen innan.
  const d = hour < 6 ? day - 1 : day,
    h = hour < 6 ? hour + 24 : hour,
    t = OLLIS.tider[WEEKDAYS[weekdayIndex(d)]];
  return !!t && h >= t[0] && h < t[1];
}
const ollisOpen = () => !!state && ollisOpenAt(state.day, state.hour);
const ollisTuesday = () => {
  const d = state.hour < 6 ? state.day - 1 : state.day;
  return WEEKDAYS[weekdayIndex(d)] === 'tis';
};
function ollisHours() {
  return Object.entries(OLLIS.tider)
    .map(([d, [a, b]]) => d + ' ' + a + '–' + String(b % 24).padStart(2, '0'))
    .join(', ');
}
// Dörren i fasaden mot esplanaden (anropas från buildCentrum innan segmenten indexeras).
function ollisDoor(w) {
  const p = centrumPoi("Oliver's Inn");
  return p ? cutDoor(w, p[0], p[1], 1.2) : null;
}
function buildOllis() {
  const w = makeWorld('ollis', "Oliver's Inn · Ollis", 22);
  w.grid.forEach((row) => row.fill(1));
  rect(w, 2, 2, 18, 17, 0);
  // Baren längs västra väggen, scen i norr, dansgolv i mitten och bås längs östra väggen.
  rect(w, 2, 6, 2, 9, 1);
  w.spawn = { x: 11.5, y: 17.4, a: -Math.PI / 2 };
  w.wallHeight = 1.5;
  // Mörkt trägolv, svart tak och dansgolv i rutor.
  w.floor = (x, y, out) => {
    if (x > 8 && x < 15 && y > 6 && y < 10) {
      const on = (Math.floor(x * 1.5) + Math.floor(y * 1.5)) % 2;
      [out[0], out[1], out[2]] = on ? [62, 40, 70] : [30, 24, 36];
      return;
    }
    const plank = Math.floor(y * 4),
      n = ((plank * 37 + Math.floor(x * 1.3 + plank * 0.6) * 11) % 7) * 3;
    out[0] = 84 + n;
    out[1] = 56 + n * 0.7;
    out[2] = 36 + n * 0.5;
    if ((y * 4) % 1 < 0.06) [out[0], out[1], out[2]] = [40, 28, 20];
  };
  w.ceiling = (x, y, out) => {
    out[0] = 26;
    out[1] = 24;
    out[2] = 26;
  };
  w.lights = [
    { x: 4.5, y: 10.5, z: 1.2, power: 0.55, falloff: 0.5 },
    { x: 11, y: 4, z: 1.2, power: 0.7, falloff: 0.4 },
    { x: 11, y: 11, z: 1.2, power: 0.45, falloff: 0.5 },
    { x: 17, y: 9, z: 1.2, power: 0.4, falloff: 0.6 },
    { x: 11, y: 16, z: 1.2, power: 0.35, falloff: 0.6 },
  ];
  // Disken och hyllorna bakom.
  addBox(w, 4, 6, 4.8, 15, 0, 0.62, { color: [86, 52, 30] });
  addBox(w, 3.95, 5.95, 4.9, 15.05, 0.62, 0.66, { color: [130, 88, 52] });
  addBox(w, 2, 6, 2.6, 15, 0.7, 1.3, { color: [70, 46, 30], solid: false });
  // Scenen.
  addBox(w, 7, 2, 15, 4.2, 0, 0.25, { color: [40, 36, 40] });
  for (const x of [8, 14]) addBox(w, x, 2.4, x + 0.8, 3, 0.25, 0.95, { color: [24, 24, 26] });
  // Bås och bord.
  for (const y of [6, 10, 14]) {
    addBox(w, 18.2, y, 19.8, y + 0.5, 0, 0.5, { color: [110, 40, 36] });
    addBox(w, 18.2, y + 2, 19.8, y + 2.5, 0, 0.5, { color: [110, 40, 36] });
    addBox(w, 18.5, y + 0.9, 19.6, y + 1.6, 0.38, 0.42, { color: [96, 64, 40] });
    addBox(w, 18.95, y + 1.1, 19.15, y + 1.4, 0, 0.38, { color: [60, 40, 26] });
  }
  sign(w, 11, 1.6, "OLIVER'S INN");
  station(w, 11.5, 7.5, 'party', 'Dansgolvet', ollisDance);
  station(w, 11.5, 5, 'party', 'Scenen · kvällens band', ollisBand);
  doorAt(w, 11, 19);
  portal(w, 11.5, 18.55, 'Ut till Handelsesplanaden', 'centrum');
  w.npcSpots = [
    [6, 9],
    [6, 12],
    [10, 8],
    [13, 9],
    [11, 11],
    [16, 8],
    [16, 13],
  ];
  return w;
}
// Kopplar ihop dörren i centrum med baren (anropas från build efter buildCentrum och buildOllis).
function linkOllis() {
  const c = worlds.centrum,
    d = c.doors?.ollis;
  if (!d) return;
  const at = (k) => ({ x: d.x + d.nx * k, y: d.y + d.ny * k, a: Math.atan2(d.ny, d.nx) });
  const door = portal(c, at(0.6).x, at(0.6).y, "Oliver's Inn · Ollis", 'ollis');
  door.action = () => {
    if (!ollisOpen()) return toast('Ollis är stängt. Öppet ' + ollisHours() + '.');
    changeWorld('ollis');
    toast(ollisTuesday() ? 'Ollis tisdag! Billig öl från kran ikväll.' : "Välkommen till Oliver's Inn.");
  };
  Object.defineProperty(door, 'label', {
    get: () => "Oliver's Inn · Ollis" + (state && !ollisOpen() ? ' · stängt' : ollisTuesday() ? ' · Ollis tisdag!' : ''),
    enumerable: true,
  });
  // Skylten ovanför dörren.
  obj(c, d.x + d.nx * 0.06, d.y + d.ny * 0.06, 'sign', '', null, {
    height: 0.4,
    z: 2.1,
    sprite: letterSprite("Oliver's Inn", '#f1d27a'),
  });
  const out = worlds.ollis.objects.find((o) => o.type === 'portal');
  out.action = () => changeWorld('centrum', at(1.2));
}
function ollisDance() {
  state.ollisDance ??= 0;
  if (state.ollisDance === state.day * 24 + Math.floor(state.hour))
    return toast('Ta en paus, du har precis dansat. Kanske en vatten?');
  state.ollisDance = state.day * 24 + Math.floor(state.hour);
  const friends = remotesHere().length;
  gain('happy', OLLIS.dans.glädje + friends * 2);
  gain('energy', OLLIS.dans.energi);
  addXp('socialt', XP.fest);
  for (const id of witnessesHere(10)) bump(id, 2);
  advance(30);
  save();
  sound('win');
  toast('Du dansar en halvtimme' + (friends ? ' med kompisarna' : '') + '. +' + (OLLIS.dans.glädje + friends * 2) + ' glädje');
}
function ollisBand() {
  const bands = OLLIS.band,
    b = bands[(state.day + (ollisTuesday() ? 1 : 0)) % bands.length];
  toast('🎸 Ikväll spelar ' + b + '.');
}
// Musik i högtalarna när baren är öppen (används av ambient.js).
const ollisMusic = () => world?.id === 'ollis' && ollisOpen();
// Folket: festprissar går till Ollis på tisdagar, andra ibland på helgen (används av planFor).
function ollisPlan(id, day, hour, partyPerson) {
  if (!ollisOpenAt(day, hour)) return null;
  const d = hour < 6 ? day - 1 : day,
    wd = WEEKDAYS[weekdayIndex(d)],
    chance = wd === 'tis' ? (partyPerson ? 0.9 : 0.25) : ['fre', 'lör'].includes(wd) ? (partyPerson ? 0.35 : 0.1) : 0.05;
  if (hour >= 6 && hour < 21) return null;
  return seeded(hashId(id) + d * 29)() < chance ? { where: 'ollis', activity: 'fest' } : null;
}

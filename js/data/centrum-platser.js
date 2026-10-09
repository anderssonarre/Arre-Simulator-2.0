// VASA CENTRUM · innehållsfil
// Bussen dit, butikerna och platserna för sidouppdrag. Kartan själv kommer från
// OpenStreetMap (js/data/centrum.js) och ändras med tools/centrum/bygg_karta.py.
//
// Butiker här läggs till i BUTIKER (se js/data/items.js). poi är namnet på ett ställe i
// kartdatan (ett kafé, en busshållplats ...) och hus är namnet på ett hus. Butiken ställs på
// närmaste ställe man kan gå till.
const BUSS = {
  pris: 2, // € per resa
  minuter: 15, // så lång tid resan tar
  campus: { x: 95, y: 92 }, // hållplatsen vid Wolffskavägen, nära W33
};

Object.assign(VAROR, {
  munk: {
    namn: 'Torgmunk',
    ikon: '🍩',
    pris: 2,
    mat: true,
    effekt: { mättnad: 14, glädje: 4 },
    tillstånd: { koncentration: 3 },
    text: 'Varm munk med socker, köpt på torget.',
    bjuda: 'En torgmunk! Du är bäst.',
  },
  burgare: {
    namn: 'Hamburgare',
    ikon: '🍔',
    pris: 7,
    mat: true,
    effekt: { mättnad: 45, glädje: 3 },
    tillstånd: { illamående: -4 },
    text: 'Snabbmat. Precis vad som behövdes.',
    bjuda: 'Burgare? Ja tack!',
  },
  lakrits: {
    namn: 'Lakritsstång',
    ikon: '🍬',
    pris: 1,
    mat: true,
    effekt: { glädje: 3 },
    text: 'Seg och svart.',
    bjuda: 'Lakrits, tack!',
  },
});

Object.assign(BUTIKER, {
  torget: {
    namn: 'Torgkiosken',
    värld: 'centrum',
    poi: 'Tori 2',
    varor: ['munk', 'vatten', 'lakrits'],
    öppet: { från: 8, till: 18 },
  },
  hesburger: {
    namn: 'Hesburger vid torget',
    värld: 'centrum',
    hus: 'Hesburger',
    varor: ['burgare', 'vatten'],
    öppet: { från: 10, till: 26 },
  },
  saluhallen: {
    namn: 'Saluhallen',
    värld: 'centrum',
    hus: 'Saluhallen',
    varor: ['smörgås', 'pirog', 'choklad'],
    öppet: { från: 9, till: 17 },
  },
  kapten: {
    namn: 'Pub Kapten',
    värld: 'centrum',
    poi: 'Kapten',
    varor: ['öl', 'vatten'],
    öppet: { från: 15, till: 27 },
  },
});

// Platser i centrum för sidouppdrag (se PLATSER i js/data/quests.js). hus eller poi ger läget.
const CENTRUMPLATSER = {
  torget: { hus: null, poi: 'Ylätori', namn: 'på torget i Vasa' },
  stadshuset: { hus: 'Vasa stadshus', namn: 'vid stadshuset' },
  kyrkan: { hus: 'Trefaldighetskyrkan', namn: 'vid Trefaldighetskyrkan' },
  saluhallen: { hus: 'Saluhallen', namn: 'vid Saluhallen' },
  vattentornet: { hus: 'Vasa vattentorn', namn: 'vid vattentornet' },
  stationen: { hus: 'Vasa järnvägsstation', namn: 'vid järnvägsstationen' },
  rewell: { hus: 'Rewell Center', namn: 'vid Rewell Center' },
};
// Läget räknas ut från kartan (spelet flyttar markeringen till närmaste ställe man kan gå till).
for (const [k, p] of Object.entries(CENTRUMPLATSER)) {
  const h = p.hus && CENTRUM.houses.find((x) => x.name === p.hus),
    poi = p.poi && CENTRUM.pois.find((x) => x.name === p.poi),
    pts = h ? h.rings[0].pts : poi ? [[poi.x, poi.y]] : null;
  if (!pts) {
    console.warn('Centrumplats ' + k + ': hittar inte ' + (p.hus || p.poi));
    continue;
  }
  PLATSER[k] = {
    värld: 'centrum',
    x: pts.reduce((a, q) => a + q[0], 0) / pts.length,
    y: pts.reduce((a, q) => a + q[1], 0) / pts.length,
    namn: p.namn,
  };
}

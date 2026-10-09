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
  cider: {
    namn: 'Cider',
    ikon: '🍏',
    pris: 6,
    effekt: { glädje: 5 },
    tillstånd: { berusning: 18, koncentration: -10 },
    text: 'Söt och kall.',
    bjuda: 'Cider! Skål!',
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
  ollis: {
    namn: "Baren på Oliver's Inn",
    värld: 'ollis',
    x: 5.5,
    y: 10.5,
    varor: ['öl', 'cider', 'vatten'],
    öppet: { från: 20, till: 28 },
    // Ollis tisdag: billig öl från kran.
    rabatt: { dag: 'tis', priser: { öl: 3 } },
  },
  kapten: {
    namn: 'Pub Kapten',
    värld: 'centrum',
    poi: 'Kapten',
    varor: ['öl', 'vatten'],
    öppet: { från: 15, till: 27 },
  },
});

// Oliver's Inn ("Ollis"), baren vid Handelsesplanaden. Öppettider som på Google Maps:
// tisdag–lördag från 20 (efter midnatt räknas som 24, 25 ...). Måndag och söndag stängt.
const OLLIS = {
  tider: { tis: [20, 28], ons: [20, 26], tor: [20, 26], fre: [20, 28], lör: [20, 28] },
  dans: { glädje: 12, energi: -8 },
  // Påhittade band som spelar på scenen.
  band: ['Kvarkens Kvintett', 'Esplanadbandet', 'Fem Tentor och en Gitarr', 'Kebab Kollektivet', 'The Wolffskas'],
};

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

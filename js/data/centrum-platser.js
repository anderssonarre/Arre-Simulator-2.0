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
  bio: { poi: 'BioRex', namn: 'vid bion BioRex' },
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

// Ställen i centrum att göra något på. Varje ställe ställs vid sitt läge i kartdatan (poi).
//   namn, ikon   vad som visas
//   poi          namnet i kartdatan (OpenStreetMap)
//   öppet        { från, till } och dagar: ['tor', 'fre'] om det bara är vissa dagar
//   val          knappar: knapp, pris (€), tid (minuter), text (vad som händer),
//                effekt (som i events.js: glädje, energi, mättnad, färdighet ...),
//                tillstånd (berusning, illamående, koncentration), handling ('kaffe' eller
//                'lunch', räknas för sidouppdrag), enGångPerDag: true
const STÄLLEN = {
  bio: {
    namn: 'BioRex',
    ikon: '🎬',
    poi: 'BioRex',
    öppet: { från: 12, till: 24 },
    val: [
      {
        knapp: 'Se en film · 12 €',
        pris: 12,
        tid: 120,
        effekt: { glädje: 22, energi: -4 },
        text: ['En actionfilm där allt exploderar. Popcornen tog slut efter trailrarna.', 'En romantisk komedi. Du skrattade högre än du tänkt.', 'En skräckfilm. Du kollar bakom dig hela vägen ut.', 'En finsk dramafilm med väldigt lite prat. Vackert, faktiskt.'],
      },
    ],
  },
  teater: {
    namn: 'Vasa stadsteater',
    ikon: '🎭',
    poi: 'Vaasan kaupunginteatteri',
    öppet: { från: 18, till: 22, dagar: ['tor', 'fre', 'lör'] },
    val: [
      {
        knapp: 'Se kvällens föreställning · 18 €',
        pris: 18,
        tid: 150,
        effekt: { glädje: 25, energi: -6, färdighet: { socialt: 5 } },
        text: ['En musikal med en överraskande bra sångare i huvudrollen.', 'Ett drama som handlar om en familj i Österbotten. Du känner igen dig.'],
        enGångPerDag: true,
      },
    ],
  },
  buffe: {
    namn: 'Rax Pizzabuffet',
    ikon: '🍕',
    poi: 'Rax Pizzabuffet',
    öppet: { från: 11, till: 21 },
    val: [
      {
        knapp: 'Ät buffé · 12 €',
        pris: 12,
        tid: 45,
        effekt: { mättnad: 75, glädje: 6, energi: -2 },
        tillstånd: { koncentration: -5 },
        handling: 'lunch',
        text: ['Sex bitar pizza, lite sallad för samvetets skull och en glass.'],
      },
    ],
  },
  kafe: {
    namn: 'Espresso House',
    ikon: '☕',
    poi: 'Espresso House',
    öppet: { från: 8, till: 20 },
    val: [
      {
        knapp: 'Fika: kaffe och kanelbulle · 6 €',
        pris: 6,
        tid: 25,
        effekt: { energi: 14, mättnad: 15, glädje: 6 },
        tillstånd: { koncentration: 10 },
        handling: 'kaffe',
        text: ['Kanelbullen är stor som en handflata. Du sitter vid fönstret och ser folk gå förbi.'],
      },
    ],
  },
  bokhandel: {
    namn: 'Suomalainen Kirjakauppa',
    ikon: '📚',
    poi: 'Suomalainen Kirjakauppa',
    öppet: { från: 9, till: 20 },
    val: [
      {
        knapp: 'Köp en fackbok · 22 €',
        pris: 22,
        tid: 30,
        effekt: { färdighet: { teknik: 20 } },
        tillstånd: { koncentration: 8 },
        text: ['"Mekanik för ingenjörer, del 2". Tung, men full av bra exempel.'],
        enGångPerDag: true,
      },
      { knapp: 'Bläddra en stund (gratis)', tid: 20, effekt: { glädje: 3 }, text: ['Du läser halva första kapitlet av en deckare och ställer tillbaka den.'] },
    ],
  },
  spel: {
    namn: 'Pelimies',
    ikon: '🎲',
    poi: 'Pelimies',
    öppet: { från: 10, till: 18 },
    val: [
      {
        knapp: 'Köp ett brädspel till spelkvällen · 15 €',
        pris: 15,
        tid: 20,
        effekt: { glädje: 10 },
        text: ['Ett spel om att bygga tåg genom Europa. Alla kommer att bråka om det, perfekt.'],
        enGångPerDag: true,
      },
    ],
  },
  loppis: {
    namn: 'Toivon tähti (second hand)',
    ikon: '🧥',
    poi: 'Toivon tähti',
    öppet: { från: 10, till: 18 },
    val: [
      {
        knapp: 'Fynda något · 4 €',
        pris: 4,
        tid: 30,
        effekt: { glädje: 8 },
        text: ['En overall i perfekt storlek för 4 €.', 'En mugg med texten "Världens bästa ingenjör".', 'En vinylskiva med finsk tango.'],
        enGångPerDag: true,
      },
    ],
  },
  kyrkan: {
    namn: 'Trefaldighetskyrkan',
    ikon: '🕯️',
    hus: 'Trefaldighetskyrkan',
    öppet: { från: 10, till: 17 },
    val: [
      {
        knapp: 'Sitt en stund i tystnaden',
        tid: 20,
        effekt: { glädje: 6 },
        tillstånd: { koncentration: 10, illamående: -6 },
        text: ['Det är tyst och svalt. Ljuset faller genom de höga fönstren. Du andas ut.'],
        enGångPerDag: true,
      },
    ],
  },
};

Object.assign(BUTIKER, {
  citymarket: {
    namn: 'K-Citymarket',
    värld: 'centrum',
    poi: 'K-Citymarket',
    varor: ['vatten', 'smörgås', 'pirog', 'choklad', 'salmiak', 'lakrits', 'paraply'],
    öppet: { från: 7, till: 23 },
  },
});

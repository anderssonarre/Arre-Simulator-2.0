// HÄNDELSER · innehållsfil
// Här kan vem som helst lägga till händelser utan att röra spelkoden.
// Kopiera en befintlig händelse, byt id och ändra texterna.
//
// Fält:
//   id          unikt namn utan mellanslag
//   titel       rubriken i rutan
//   text        själva texten. {kurs0} {kurs1} {kurs2} blir namnen på terminens kurser, {jag} ditt namn
//   person      id på personen som är med. Händelsen hoppar över sig själv om du spelar som hen
//   frånTermin  tidigaste termin (1–8)
//   upprepas    true om den kan hända flera gånger
//   dagar       bara vissa veckodagar, t.ex. ['fre', 'lör']
//   villkor     extra krav, se nedan
//   val         knapparna. Varje val har text, effekt och valfritt kräver
//
// Effekter (effekt):
//   pengar, glädje, energi, mättnad   tal som läggs till, t.ex. pengar: 40 eller energi: -15
//   tid                               minuter som går
//   relation                          { axel: 8 } ändrar relationen till personer
//   studiepass                        { kurs: 1 } ger ett studiepass i kurs 0, 1 eller 2
//   flagga                            'lunchkampanj' (lunch 4 € idag) eller 'dubbelLön' (dubbel lön idag)
//   meddelande                        text som visas kort efteråt
//
// Villkor (villkor och kräver):
//   kursEjKlar: 1          kurs 1 är inte klar och har färre än två studiepass
//   pengarMinst: 15        du har minst 15 €
//   relationMinst: { ida: 20 }
const EVENT_DATA = [
  {
    id: 'studiestod',
    upprepas: true,
    titel: 'Studiestödet kom',
    text: 'Pengarna från FPA har kommit in på kontot.',
    val: [{ text: 'Härligt! · +40 €', effekt: { pengar: 40 } }],
  },
  {
    id: 'lunchkampanj',
    upprepas: true,
    titel: 'Halva priset på lunchen',
    text: 'Restaurangen i W33 har kampanj. Lunchen kostar bara 4 € idag.',
    dagar: ['mån', 'tis', 'ons', 'tor', 'fre'],
    val: [{ text: 'Bra att veta', effekt: { flagga: 'lunchkampanj' } }],
  },
  {
    id: 'ossi-dubbel',
    person: 'ossi',
    upprepas: true,
    titel: 'Ossi ringer',
    text: '”Jag har brist på folk idag. Gör du ett pass får du dubbel lön.”',
    val: [
      {
        text: 'Jag kommer! · dubbel lön idag',
        effekt: { flagga: 'dubbelLön', relation: { ossi: 3 } },
      },
      { text: 'Inte idag', effekt: {} },
    ],
  },
  {
    id: 'regn',
    upprepas: true,
    titel: 'Ösregn över Vasa',
    text: 'Det öser ner från en grå himmel. Inte direkt en dag för promenader.',
    val: [{ text: 'Fram med regnjackan · −5 glädje', effekt: { glädje: -5 } }],
  },
  {
    id: 'punktering',
    titel: 'Punktering',
    text: 'Cykeln har fått punktering. Laga den eller gå till campus.',
    val: [
      { text: 'Laga den · −15 €', kräver: { pengarMinst: 15 }, effekt: { pengar: -15 } },
      { text: 'Gå i stället · −15 energi', effekt: { energi: -15 } },
    ],
  },
  {
    id: 'kaffe-entren',
    person: 'lumberjack',
    titel: 'Gratis kaffe',
    text: 'Lumberjack har fixat gratis kaffe i entrén till alla som kommer tidigt.',
    val: [{ text: 'Ta en kopp · +10 energi', effekt: { energi: 10, relation: { lumberjack: 4 } } }],
  },
  {
    id: 'albin-morgonpass',
    person: 'albin',
    titel: 'Albin vill träna',
    text: '”Morgonpass innan föreläsningen? Det blir kort, jag lovar.”',
    val: [
      {
        text: 'Kör! · +12 glädje, −10 energi',
        effekt: { glädje: 12, energi: -10, relation: { albin: 6 } },
      },
      { text: 'Sov vidare · +10 energi', effekt: { energi: 10 } },
    ],
  },
  {
    id: 'rasmus-losningar',
    person: 'rasmus',
    villkor: { kursEjKlar: 1 },
    titel: 'Rasmus har räknat i förväg',
    text: 'Rasmus skickar sina lösningar i {kurs1}. Vill du gå igenom dem?',
    val: [
      {
        text: 'Gå igenom dem · +1 studiepass',
        effekt: { studiepass: { kurs: 1 }, tid: 30, relation: { rasmus: 5 } },
      },
      { text: 'Jag vill lösa dem själv', effekt: { glädje: 3 } },
    ],
  },
  {
    id: 'axel-fest',
    person: 'axel',
    frånTermin: 2,
    dagar: ['fre', 'lör'],
    titel: 'Axel har planer',
    text: '”Fest på Filicia Castle ikväll! Alla kommer.” Tentorna närmar sig, men det låter kul.',
    val: [
      {
        text: 'Följ med · +20 glädje, −30 energi',
        effekt: { glädje: 20, energi: -30, relation: { axel: 8 } },
      },
      { text: 'Stanna hemma · +15 energi', effekt: { energi: 15, relation: { axel: -3 } } },
    ],
  },
  {
    id: 'ida-grupparbete',
    person: 'ida',
    frånTermin: 2,
    titel: 'Grupparbete',
    text: 'Ida undrar om du vill leda ert grupparbete den här terminen.',
    val: [
      {
        text: 'Ta ledningen · +10 glädje, −15 energi',
        effekt: { glädje: 10, energi: -15, relation: { ida: 10 } },
      },
      { text: 'Låt Ida leda', effekt: { relation: { ida: 3 } } },
    ],
  },
  {
    id: 'niklas-abonnemang',
    person: 'niklas',
    frånTermin: 3,
    titel: 'Niklas har ett tips',
    text: 'Niklas har hittat ett billigare mobilabonnemang åt dig.',
    val: [{ text: 'Byt · +20 €', effekt: { pengar: 20, relation: { niklas: 5 } } }],
  },
  {
    id: 'mats-forelasning',
    person: 'mats',
    frånTermin: 3,
    titel: 'Gästföreläsning',
    text: 'Mats Borg bjuder in till en föreläsning om bergvärme och energilager i Vasa.',
    val: [
      {
        text: 'Gå dit · +10 glädje, 1 timme',
        effekt: { glädje: 10, tid: 60, relation: { mats: 8 } },
      },
      { text: 'Hoppa över', effekt: {} },
    ],
  },
  {
    id: 'tentaangest',
    frånTermin: 4,
    titel: 'Allt på en gång',
    text: 'Det känns som att hela terminen kommer samtidigt. Hur tar du dig an dagen?',
    val: [
      { text: 'Promenad längs stranden · +12 glädje', effekt: { glädje: 12, tid: 45 } },
      { text: 'Bita ihop · −8 glädje', effekt: { glädje: -8 } },
    ],
  },
  {
    id: 'praktik',
    frånTermin: 6,
    titel: 'Praktikerbjudande',
    text: 'Ett företag i Vasa söker praktikanter till sommaren och vill träffa dig på en kort intervju.',
    val: [
      {
        text: 'Gå på intervjun · +15 glädje, −10 energi',
        effekt: { glädje: 15, energi: -10, tid: 60 },
      },
      { text: 'Fokusera på studierna', effekt: {} },
    ],
  },
  {
    id: 'sondag-sovmorgon',
    upprepas: true,
    dagar: ['sön'],
    titel: 'Söndag',
    text: 'Inga föreläsningar idag. Solen letar sig in genom gardinerna.',
    val: [
      { text: 'Sovmorgon · +20 energi', effekt: { energi: 20, tid: 90 } },
      { text: 'Upp och ut · +6 glädje', effekt: { glädje: 6 } },
    ],
  },
  {
    id: 'jennifer-pluggsallskap',
    person: 'jennifer',
    villkor: { relationMinst: { jennifer: 15 } },
    titel: 'Jennifer skriver',
    text: '”Ska vi sitta i W33 och plugga ihop idag? Jag bjuder på kaffe.”',
    val: [
      {
        text: 'Gärna · +8 glädje',
        effekt: {
          glädje: 8,
          relation: { jennifer: 6 },
          meddelande: 'Jennifer sitter i W33 i eftermiddag.',
        },
      },
      { text: 'Inte idag', effekt: { relation: { jennifer: -2 } } },
    ],
  },
];

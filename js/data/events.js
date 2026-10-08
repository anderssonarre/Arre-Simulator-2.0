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
//   taggar      vad händelsen handlar om: 'vardag', 'chans', 'kris', 'följd', 'social', 'studier'.
//               'följd' är konsekvenser av hur du skött dig och dämpas aldrig.
//               Berättaren läser av läget: kämpar du blir 'chans' vanligare och 'kris'
//               ovanligare, går allt för lätt blir 'kris' vanligare.
//   vikt        hur vanlig händelsen är jämfört med andra (standard 1)
//   uppföljning true om händelsen bara kommer som fortsättning i en kedja (se följs)
//
// Effekter (effekt):
//   pengar, glädje, energi, mättnad   tal som läggs till, t.ex. pengar: 40 eller energi: -15
//   tid                               minuter som går
//   relation                          { axel: 8 } ändrar relationen till personer
//   studiepass                        { kurs: 1 } ger ett studiepass i kurs 0, 1 eller 2
//   flagga                            'lunchkampanj' (lunch 4 € idag) eller 'dubbelLön' (dubbel lön idag)
//   meddelande                        text som visas kort efteråt
//   färdighet                         { teknik: 15 } ger erfarenhet i en färdighet
//   följs                             { id: 'annan-händelse', omDagar: 3 } startar en kedja
//   betalaSkuld                       true betalar så mycket av skulden som pengarna räcker till
//
// Villkor (villkor och kräver):
//   kursEjKlar: 1          kurs 1 är inte klar och har färre än två studiepass
//   pengarMinst: 15        du har minst 15 €
//   relationMinst: { ida: 20 }
//   pengarHögst: 20        du har högst 20 €
//   skuldMinst: 1          du har minst 1 € i hyresskuld
//   snittMinst: 3.5        betygssnittet är minst 3,5
//   färdighetMinst: { programmering: 3 }
//   tentaRedo: true        någon tenta är redo att skrivas
//
// Hyra och studiestöd dras automatiskt varje måndag, se js/data/progress.js.
const EVENT_DATA = [
  {
    id: 'lunchkampanj',
    taggar: ['chans'],
    upprepas: true,
    titel: 'Halva priset på lunchen',
    text: 'Restaurangen i W33 har kampanj. Lunchen kostar bara 4 € idag.',
    dagar: ['mån', 'tis', 'ons', 'tor', 'fre'],
    val: [{ text: 'Bra att veta', effekt: { flagga: 'lunchkampanj' } }],
  },
  {
    id: 'ossi-dubbel',
    taggar: ['chans'],
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
    taggar: ['vardag'],
    upprepas: true,
    titel: 'Ösregn över Vasa',
    text: 'Det öser ner från en grå himmel. Inte direkt en dag för promenader.',
    val: [{ text: 'Fram med regnjackan · −5 glädje', effekt: { glädje: -5 } }],
  },
  {
    id: 'punktering',
    taggar: ['kris'],
    titel: 'Punktering',
    text: 'Cykeln har fått punktering. Laga den eller gå till campus.',
    val: [
      { text: 'Laga den · −15 €', kräver: { pengarMinst: 15 }, effekt: { pengar: -15 } },
      { text: 'Gå i stället · −15 energi', effekt: { energi: -15 } },
    ],
  },
  {
    id: 'kaffe-entren',
    taggar: ['vardag'],
    person: 'lumberjack',
    titel: 'Gratis kaffe',
    text: 'Lumberjack har fixat gratis kaffe i entrén till alla som kommer tidigt.',
    val: [{ text: 'Ta en kopp · +10 energi', effekt: { energi: 10, relation: { lumberjack: 4 } } }],
  },
  {
    id: 'albin-morgonpass',
    taggar: ['social'],
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
    taggar: ['studier', 'chans'],
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
    taggar: ['social'],
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
    taggar: ['studier', 'social'],
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
    taggar: ['chans'],
    person: 'niklas',
    frånTermin: 3,
    titel: 'Niklas har ett tips',
    text: 'Niklas har hittat ett billigare mobilabonnemang åt dig.',
    val: [{ text: 'Byt · +20 €', effekt: { pengar: 20, relation: { niklas: 5 } } }],
  },
  {
    id: 'mats-forelasning',
    taggar: ['studier'],
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
    taggar: ['kris'],
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
    taggar: ['chans'],
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
    taggar: ['vardag'],
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
    taggar: ['social'],
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
  // ---- Fas 3: berättaren, ekonomi och kedjor ----
  {
    id: 'hyresvarden',
    taggar: ['följd'],
    upprepas: true,
    villkor: { skuldMinst: 1 },
    titel: 'Hyresvärden ringer',
    text: 'Hyran för förra veckan har inte kommit in. Hyresvärden låter mer trött än arg, men frågar när pengarna kommer.',
    val: [
      {
        text: 'Betala det jag har',
        kräver: { pengarMinst: 1 },
        effekt: { betalaSkuld: true, meddelande: 'Du betalade så mycket du kunde.' },
      },
      {
        text: 'Lova att betala nästa vecka · −5 glädje',
        effekt: { glädje: -5, följs: { id: 'hyresvarden-igen', omDagar: 6 } },
      },
    ],
  },
  {
    id: 'hyresvarden-igen',
    taggar: ['följd'],
    uppföljning: true,
    upprepas: true,
    villkor: { skuldMinst: 1 },
    titel: 'Hyresvärden igen',
    text: 'En vecka har gått och skulden finns kvar. Nu vill hyresvärden ha en plan.',
    val: [
      { text: 'Betala nu', kräver: { pengarMinst: 1 }, effekt: { betalaSkuld: true } },
      {
        text: 'Ta extrapass tills den är betald · −10 glädje',
        effekt: { glädje: -10, meddelande: 'Extrajobbet ger pengar. Skulden betalas i menyn.' },
      },
    ],
  },
  {
    id: 'paket-hemifran',
    taggar: ['chans'],
    upprepas: true,
    villkor: { pengarHögst: 20 },
    titel: 'Paket hemifrån',
    text: 'Ett paket väntar i trappan. Hemlagad mat i burkar, raggsockor och en tjugoeuro i ett kuvert.',
    val: [
      {
        text: 'Ring och tacka · +20 €, +40 mättnad',
        effekt: { pengar: 20, mättnad: 40, glädje: 10, tid: 20 },
      },
    ],
  },
  {
    id: 'loppis',
    taggar: ['chans'],
    upprepas: true,
    villkor: { pengarHögst: 30 },
    dagar: ['lör', 'sön'],
    titel: 'Loppis i W33',
    text: 'Studentkåren har loppis. Du har några gamla grejer som bara samlar damm.',
    val: [
      { text: 'Sälj dem · +25 €, 1 timme', effekt: { pengar: 25, tid: 60, glädje: 4 } },
      { text: 'Strunta i det', effekt: {} },
    ],
  },
  {
    id: 'trasig-dator',
    taggar: ['kris'],
    frånTermin: 2,
    villkor: { pengarMinst: 40 },
    titel: 'Datorn dog',
    text: 'Skärmen blir svart mitt i en inlämning. Datorn startar inte igen.',
    val: [
      { text: 'Laga den direkt · −40 €', effekt: { pengar: -40 } },
      {
        text: 'Plugga på skolans datorer ett tag · −15 energi, −6 glädje',
        effekt: { energi: -15, glädje: -6 },
      },
    ],
  },
  {
    id: 'forkylning',
    taggar: ['kris'],
    upprepas: true,
    vikt: 0.6,
    titel: 'Förkyld',
    text: 'Halsen river och näsan rinner. Hela Vasa verkar ha samma förkylning.',
    val: [
      { text: 'Kör på ändå · −25 energi', effekt: { energi: -25 } },
      { text: 'Te och filt i två timmar · −8 energi', effekt: { energi: -8, tid: 120, glädje: 4 } },
    ],
  },
  {
    id: 'stipendium',
    taggar: ['chans', 'studier'],
    frånTermin: 2,
    villkor: { snittMinst: 3.5 },
    titel: 'Stipendium',
    text: 'Ett lokalt företag delar ut stipendier till studerande med bra betyg. Ansökan tar en timme.',
    val: [
      {
        text: 'Skriv ansökan · 1 timme',
        effekt: { tid: 60, energi: -5, följs: { id: 'stipendium-svar', omDagar: 4 } },
      },
      { text: 'Orkar inte', effekt: {} },
    ],
  },
  {
    id: 'stipendium-svar',
    taggar: ['chans'],
    uppföljning: true,
    titel: 'Svar på stipendiet',
    text: 'Mejlet börjar med "Grattis". Ditt betygssnitt och din motivering övertygade juryn.',
    val: [{ text: 'Yes! · +150 €', effekt: { pengar: 150, glädje: 20 } }],
  },
  {
    id: 'axel-gokart',
    taggar: ['social'],
    person: 'axel',
    frånTermin: 2,
    villkor: { färdighetMinst: { teknik: 2 }, relationMinst: { axel: 10 } },
    titel: 'Axel bygger gokart',
    text: '”Jag har en motor från en gräsklippare och ett ramverk som nästan håller. Hjälper du till?”',
    val: [
      {
        text: 'Klart jag gör · 2 timmar, teknik +20 XP',
        effekt: {
          tid: 120,
          energi: -10,
          färdighet: { teknik: 20 },
          relation: { axel: 6 },
          följs: { id: 'axel-gokart-klar', omDagar: 5 },
        },
      },
      { text: 'Låter farligt', effekt: { relation: { axel: -2 } } },
    ],
  },
  {
    id: 'axel-gokart-klar',
    taggar: ['social'],
    uppföljning: true,
    person: 'axel',
    titel: 'Gokarten rullar',
    text: 'Axel skickar en video. Gokarten tar sig hela vägen runt parkeringen utan att något lossnar. Nästan.',
    val: [{ text: 'Provkör · +20 glädje', effekt: { glädje: 20, relation: { axel: 5 }, tid: 40 } }],
  },
  {
    id: 'ida-jennifer-osams',
    taggar: ['social'],
    frånTermin: 2,
    villkor: { relationMinst: { ida: 15, jennifer: 15 } },
    titel: 'Ida och Jennifer är osams',
    text: 'Grupparbetet har spårat ur. Ida tycker att Jennifer inte gör sin del, Jennifer tycker att Ida bestämmer allt. Båda vill att du säger vad du tycker.',
    val: [
      {
        text: 'Medla mellan dem',
        kräver: { färdighetMinst: { socialt: 2 } },
        effekt: {
          relation: { ida: 4, jennifer: 4 },
          färdighet: { socialt: 10 },
          följs: { id: 'ida-jennifer-sams', omDagar: 3 },
        },
      },
      {
        text: 'Håll med Ida',
        effekt: {
          relation: { ida: 6, jennifer: -8 },
          följs: { id: 'ida-jennifer-sams', omDagar: 5 },
        },
      },
      {
        text: 'Håll med Jennifer',
        effekt: {
          relation: { ida: -8, jennifer: 6 },
          följs: { id: 'ida-jennifer-sams', omDagar: 5 },
        },
      },
    ],
  },
  {
    id: 'ida-jennifer-sams',
    taggar: ['social'],
    uppföljning: true,
    titel: 'Fika för tre',
    text: 'Ida och Jennifer har pratat ut. De bjuder dig på fika i W33 som tack för att du stod ut med dem.',
    val: [
      {
        text: 'Gärna · +10 glädje',
        effekt: { glädje: 10, tid: 30, relation: { ida: 3, jennifer: 3 } },
      },
    ],
  },
  {
    id: 'rasmus-gamla-tentor',
    taggar: ['studier', 'chans'],
    person: 'rasmus',
    villkor: { tentaRedo: true },
    titel: 'Gamla tentor',
    text: 'Rasmus har grävt fram fem år av gamla tentor. ”Samma typ av frågor kommer varje år, lovar.”',
    val: [
      {
        text: 'Räkna igenom dem · 1 timme',
        effekt: {
          tid: 60,
          energi: -6,
          färdighet: { matematik: 15, programmering: 10, teknik: 10 },
        },
      },
      { text: 'Jag kan redan det här', effekt: {} },
    ],
  },
  {
    id: 'hackathon',
    taggar: ['chans', 'studier'],
    frånTermin: 3,
    dagar: ['fre'],
    villkor: { färdighetMinst: { programmering: 3 } },
    titel: 'Hackathon i Technobothnia',
    text: 'Ett energibolag ordnar hackathon i helgen. Lag på tre, pizza och ett pris till bästa idé.',
    val: [
      {
        text: 'Anmäl dig · −20 energi',
        effekt: { energi: -20, följs: { id: 'hackathon-resultat', omDagar: 2 } },
      },
      { text: 'Vila i helgen', effekt: { energi: 10 } },
    ],
  },
  {
    id: 'hackathon-resultat',
    taggar: ['chans'],
    uppföljning: true,
    titel: 'Andra plats',
    text: 'Er app som flyttar elförbrukning till billiga timmar kom tvåa. Juryn vill hålla kontakten.',
    val: [
      {
        text: 'Ta emot priset · +80 €',
        effekt: { pengar: 80, glädje: 15, färdighet: { programmering: 20 } },
      },
    ],
  },
  {
    id: 'albin-lopning',
    taggar: ['social'],
    person: 'albin',
    villkor: { färdighetMinst: { kondition: 2 } },
    titel: 'Albin utmanar',
    text: '”Du har börjat träna ser jag. Fem kilometer längs Sandviken, den som förlorar bjuder på lunch?”',
    val: [
      {
        text: 'Spring · −20 energi',
        effekt: {
          energi: -20,
          glädje: 12,
          färdighet: { kondition: 15 },
          relation: { albin: 6 },
          tid: 40,
        },
      },
      { text: 'Nästa gång', effekt: { relation: { albin: -1 } } },
    ],
  },
];

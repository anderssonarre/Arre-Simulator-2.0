// PERSONLIGHETSDRAG · innehållsfil
// Varje person får två slumpade drag ovanpå sin grundton (personality i characters.js).
// Online är dragen samma för alla som spelar på servern, offline slumpas de nya för varje liv.
// Man upptäcker dragen när man lär känna någon: ett när ni har pratat, ett till som bekanta.
//
// Fält (alla utom namn är valfria):
//   namn        vad draget heter
//   om          kort beskrivning som AI:n använder för att spela personen
//   motsats     ett drag som inte kan finnas hos samma person
//   schema      egna rutiner, som i schedules.js: [dagar, från, till, plats, aktivitet]
//               dagar: 'alla', 'vardag', 'helg' eller t.ex. 'tor'. Plats 'hemma' betyder borta.
//   fest        true: går på fest fredag och lördag och på Ollis tisdag
//   humör       hur glad personen brukar vara (+ gladare, − surare än normalt)
//   vänskap     hur fort man blir vän (1 = normalt, 1.3 = fortare, 0.7 = långsammare)
//   skvaller    hur gärna personen för skvaller vidare (1 = normalt)
//   pratsam     hur ofta personen småpratar med andra (1 = normalt)
//   hälsningar  vad personen ibland säger när ni ses
//   tankar      vad personen kan gå och tänka på en vanlig dag
//   ger         en vara ur väskan (items.js) som personen ibland bjuder dig på
const DRAG = {
  nattuggla: {
    namn: 'Nattuggla',
    om: 'vaknar sent, piggast på kvällen och natten, tycker morgnar är ett övergrepp',
    motsats: 'morgonpigg',
    schema: [
      ['vardag', 7, 10, 'hemma', null],
      ['alla', 20, 23.5, 'outdoor', 'promenerar'],
    ],
    hälsningar: ['Är det verkligen morgon redan?', 'Jag vaknade nyss, ha tålamod.'],
    tankar: ['Jag var vaken till tre igen. Det var värt det.'],
  },
  morgonpigg: {
    namn: 'Morgonpigg',
    om: 'uppe med tuppen, effektiv på förmiddagen och sover tidigt',
    motsats: 'nattuggla',
    schema: [
      ['vardag', 7, 8, 'w33', 'paus'],
      ['alla', 20, 30, 'hemma', null],
    ],
    humör: 3,
    hälsningar: ['God morgon! Har du också varit uppe sedan sex?', 'Bästa tiden på dagen!'],
    tankar: ['Jag hann jogga, äta frukost och läsa nyheterna före åtta.'],
  },
  festprisse: {
    namn: 'Festprisse',
    om: 'älskar fester och folk, vet alltid var nästa fest är',
    motsats: 'introvert',
    fest: true,
    schema: [['tor', 20, 24, 'w33', 'fest']],
    humör: 4,
    pratsam: 1.4,
    hälsningar: ['Fest ikväll, är du med?', 'Har du hört var det händer i helgen?'],
    tankar: ['Jag planerar redan nästa fest. Den blir legendarisk.'],
  },
  plugghast: {
    namn: 'Plugghäst',
    om: 'pluggar mer än nödvändigt, har alltid koll på deadlines och lite stressad',
    schema: [
      ['vardag', 16, 19.5, 'w33', 'pluggar'],
      ['sön', 13, 16, 'tech', 'pluggar'],
    ],
    humör: -2,
    hälsningar: ['Har du börjat på inlämningen?', 'Jag har läst kapitel fem tre gånger.'],
    tankar: ['Jag har gjort ett schema för mitt schema.'],
  },
  traningsfreak: {
    namn: 'Träningsfreak',
    om: 'tränar varje dag, pratar om gains och proteinintag',
    schema: [
      ['vardag', 16.5, 18.5, 'gym', 'tränar'],
      ['helg', 10, 12, 'gym', 'tränar'],
    ],
    humör: 2,
    hälsningar: ['Benpass idag, jag går som en pingvin.', 'Hängde du med på gymmet?'],
    tankar: ['Jag slog personbästa i marklyft. Jag måste berätta för någon.'],
  },
  kaffealskare: {
    namn: 'Kaffeälskare',
    om: 'lever på kaffe, har starka åsikter om automaterna på campus',
    schema: [
      ['vardag', 9.75, 10.25, 'w33', 'kaffe'],
      ['vardag', 14, 14.5, 'tech', 'kaffe'],
    ],
    vänskap: 1.1,
    hälsningar: ['Kaffe? Kaffe.', 'Automaten i Technobothnia är bäst, säger jag bara.'],
    tankar: ['Fjärde koppen idag. Händerna skakar men själen är lugn.'],
    ger: 'choklad',
  },
  naturalskare: {
    namn: 'Naturälskare',
    om: 'vill helst vara ute, pratar om fåglar, väder och skärgården',
    schema: [
      ['vardag', 15, 16.5, 'outdoor', 'promenerar'],
      ['helg', 11, 15, 'outdoor', 'promenerar'],
    ],
    humör: 3,
    hälsningar: ['Har du sett hur fint ljuset är idag?', 'Jag hörde en hackspett i morse!'],
    tankar: ['Jag vill till skärgården i helgen, oavsett väder.'],
  },
  gamer: {
    namn: 'Gamer',
    om: 'spelar datorspel på kvällarna, refererar gärna till spel',
    schema: [['alla', 18, 30, 'hemma', null]],
    hälsningar: ['Jag var uppe sent och spelade. Igen.', 'Lag i verkliga livet idag.'],
    tankar: ['Vi ska köra en raid ikväll. Det går inte att flytta.'],
  },
  pratsam: {
    namn: 'Pratsam',
    om: 'pratar mycket och gärna, lär känna alla',
    motsats: 'introvert',
    pratsam: 1.8,
    vänskap: 1.3,
    hälsningar: ['Hej hej! Vet du vad som hände idag?', 'Åh, du! Jag måste berätta en sak.'],
    tankar: ['Jag har pratat med typ alla på campus idag.'],
  },
  introvert: {
    namn: 'Introvert',
    om: 'tystlåten och eftertänksam, öppnar sig långsamt men blir en trogen vän',
    motsats: 'pratsam',
    pratsam: 0.4,
    vänskap: 0.75,
    hälsningar: ['Hej.', '… hej.'],
    tankar: ['Det var för mycket folk idag. Jag behöver en lugn kväll.'],
  },
  skamtare: {
    namn: 'Skämtare',
    om: 'skämtar om allt, lite ironisk, gör ordvitsar',
    motsats: 'grinig',
    humör: 6,
    hälsningar: ['Varför gick tomaten till tentan? Den ville bli mogen.', 'Läget? Svara ärligt.'],
    tankar: ['Jag har en ny vits. Den är dålig. Jag ska berätta den för alla.'],
  },
  grinig: {
    namn: 'Grinig',
    om: 'muttrar och klagar men har ett gott hjärta innerst inne',
    motsats: 'skamtare',
    humör: -8,
    vänskap: 0.85,
    hälsningar: ['Mm.', 'Vad är det nu då?', 'Snålblåst igen.'],
    tankar: ['Allt var bättre förr. Typ förra veckan.'],
  },
  skvallerbytta: {
    namn: 'Skvallerbytta',
    om: 'vet allt om alla och berättar det gärna',
    skvaller: 1.8,
    pratsam: 1.3,
    hälsningar: ['Har du hört det senaste?', 'Jag säger ingenting, men …'],
    tankar: ['Jag vet något som ingen annan vet. Ännu.'],
  },
  generos: {
    namn: 'Generös',
    om: 'bjuder gärna och delar med sig',
    motsats: 'snal',
    vänskap: 1.1,
    hälsningar: ['Har du ätit? Jag har extra.', 'Ta en, jag köpte för många.'],
    tankar: ['Jag köpte bullar till hela korridoren. Igen.'],
    ger: 'pirog',
  },
  snal: {
    namn: 'Snål',
    om: 'räknar varje cent, letar alltid efter gratis mat',
    motsats: 'generos',
    hälsningar: ['Vet du om det finns gratis kaffe någonstans?', 'Lunchen kostar åtta euro. Åtta!'],
    tankar: ['Jag har levt på pasta i en vecka. Det är en livsstil.'],
  },
};

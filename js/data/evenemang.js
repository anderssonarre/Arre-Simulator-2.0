// ÅRETS EVENEMANG OCH BASTUN · innehållsfil
// Saker som händer vissa dagar under studieåret. Var på rätt plats vid rätt tid, så händer det.
// Se js/game/evenemang.js.
//
// Fält:
//   namn       vad evenemanget heter
//   månad      0 = september, 1 = oktober ... 11 = augusti (som YEAR.månader i seasons.js)
//   dagar      [från, till] dag i månaden, t.ex. [13, 13] för 13 december
//   tid        { från, till } hela timmar
//   plats      en plats i PLATSER (js/data/quests.js), t.ex. 'torget' eller 'w33Filicia'
//   text       vad som händer när du kommer dit
//   val        knappar: { knapp, text, effekt } där effekt är glädje, energi, mättnad,
//              pengar (kan vara negativt), socialt (erfarenhet) och märke (overallmärke)
//   folk       hur stor del av alla personer som kommer dit (0–1)
const EVENEMANG = [
  {
    id: 'nollning',
    namn: 'Nollningsrundan',
    månad: 0,
    dagar: [3, 10],
    tid: { från: 12, till: 18 },
    plats: 'tritonia',
    text: 'Faddrarna i overall har ställt upp kontroller över hela campus. Nollorna springer runt med kartor, sjunger, äter något konstigt och får stämplar.',
    val: [
      { knapp: 'Spring rundan', text: 'Du klarar alla kontroller och kan nu tre nya sånger.', effekt: { glädje: 15, energi: -10, socialt: 25, märke: 'Nollning' } },
      { knapp: 'Hjälp till som fadder', text: 'Du står vid en kontroll och hittar på uppgifter. Nollorna tittar upp till dig.', effekt: { glädje: 10, socialt: 15, märke: 'Fadder' } },
    ],
    folk: 0.6,
  },
  {
    id: 'halloween',
    namn: 'Halloweenfest på Filicia',
    månad: 1,
    dagar: [28, 31],
    tid: { från: 19, till: 24 },
    plats: 'w33Filicia',
    text: 'Filicia är full av spindelväv, pumpor och folk utklädda till allt från vampyrer till en mycket övertygande kaffeautomat.',
    val: [
      { knapp: 'Klä ut dig och festa (5 €)', text: 'Din dräkt får en applåd. Ingen vet riktigt vad du föreställer.', effekt: { pengar: -5, glädje: 20, energi: -10, socialt: 15, märke: 'Halloween' } },
      { knapp: 'Titta in en stund', text: 'Du tar en pumpakaka och ser på utklädnadstävlingen.', effekt: { glädje: 6, mättnad: 8 } },
    ],
    folk: 0.5,
  },
  {
    id: 'fackeltag',
    namn: 'Fackeltåget på självständighetsdagen',
    månad: 3,
    dagar: [6, 6],
    tid: { från: 17, till: 20 },
    plats: 'torget',
    text: 'Studenterna går med facklor genom centrum till torget. Det är tyst, kallt och väldigt fint.',
    val: [{ knapp: 'Gå med i tåget', text: 'Facklorna fladdrar och någon börjar sjunga. Du får gåshud.', effekt: { glädje: 12, energi: -6, socialt: 10, märke: 'Fackeltåg' } }],
    folk: 0.4,
  },
  {
    id: 'lucia',
    namn: 'Luciatåg på torget',
    månad: 3,
    dagar: [13, 13],
    tid: { från: 16, till: 19 },
    plats: 'torget',
    text: 'Lucia med ljuskrona och tärnor sjunger på torget. Det luktar glögg och pepparkakor.',
    val: [{ knapp: 'Stanna och lyssna', text: 'Du får en pepparkaka och blir varm i hjärtat, om inte om fötterna.', effekt: { glädje: 12, mättnad: 6, märke: 'Lucia' } }],
    folk: 0.35,
  },
  {
    id: 'lillajul',
    namn: 'Lillajul på Filicia',
    månad: 3,
    dagar: [15, 20],
    tid: { från: 18, till: 23 },
    plats: 'w33Filicia',
    text: 'Julbord, glögg och en tomte som misstänkt liknar Ossi. Alla får en hemlig klapp.',
    val: [
      { knapp: 'Ät julbord (8 €)', text: 'Skinka, lådor och rissoppa. Du hittar mandeln!', effekt: { pengar: -8, mättnad: 60, glädje: 18, socialt: 10, märke: 'Lillajul' } },
      { knapp: 'Bara glögg och snack', text: 'En kopp glögg och prat vid fönstret medan snön faller.', effekt: { glädje: 8 } },
    ],
    folk: 0.6,
  },
  {
    id: 'runeberg',
    namn: 'Runebergsdagen',
    månad: 5,
    dagar: [5, 5],
    tid: { från: 8, till: 18 },
    plats: 'saluhallen',
    text: 'Saluhallen säljer Runebergstårtor med hallonsylt och en sockerring på toppen.',
    val: [{ knapp: 'Köp en tårta (3 €)', text: 'Mandel, rom och hallon. Runeberg visste vad han gjorde.', effekt: { pengar: -3, mättnad: 15, glädje: 8 } }],
    folk: 0.2,
  },
  {
    id: 'midsommar',
    namn: 'Midsommar på campus',
    månad: 9,
    dagar: [19, 25],
    tid: { från: 16, till: 24 },
    plats: 'puuvillakuja',
    text: 'Majstången står rest, någon grillar och det blir aldrig riktigt mörkt.',
    val: [{ knapp: 'Dansa runt majstången', text: 'Små grodorna, tre varv. Du skrattar så att du får håll.', effekt: { glädje: 20, energi: -8, socialt: 15, märke: 'Midsommar' } }],
    folk: 0.5,
  },
];

// Bastun på Wasa Sports Club. Varje dag finns ett bastupass att ta.
const BASTU = {
  öppet: { från: 15, till: 23 },
  minuter: 40,
  effekt: { glädje: 12, energi: 8 },
  tillstånd: { koncentration: 12, illamående: -15, berusning: -5 },
  // På vintern kan man rulla sig i snön efteråt.
  snöbad: { glädje: 8, märke: 'Snöbad' },
};

// Pulkabacken på campus, när det ligger snö.
const PULKA = {
  plats: { värld: 'outdoor', x: 30, y: 90 },
  glädje: 10,
  energi: -6,
};

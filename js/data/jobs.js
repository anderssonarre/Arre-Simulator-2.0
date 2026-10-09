// JOBB · innehållsfil
// Extrajobb man kan söka på jobbtavlan (vid jobbmarkeringen på campus eller hos Ossi).
// Man kan ha flera jobb och väljer vilket man jobbar ett pass på. Se js/game/jobs.js.
//
// Fält:
//   namn        jobbets namn
//   moment      vad man gör under passet:
//                 'buss', 'lastbil', 'truck'  köra till två stopp (styr med W/A/S/D)
//                 'timing'                    tre stationer där man trycker i rätt ögonblick
//                 'quiz'                      tre frågor (fält frågor nedan)
//                 'matte'                     tre räkneuppgifter som slumpas varje gång
//   lön         € för ett helt pass
//   energi      så mycket energi passet kostar
//   färdighet   färdigheten man blir bättre på (utöver arbetsvana)
//   text        vad man gör, visas innan passet börjar
//   stationer   för timing: namnen på de tre stationerna
//   stopp       för buss, lastbil och truck: namnen på de två stoppen
//   frågor      för quiz: [rubrik, fråga, [rätt svar, fel, fel]] tre stycken
//   tider       när man kan jobba, { från: 18, till: 26 } (efter midnatt räknas som 24, 25 ...)
//   dagar       bara vissa dagar, t.ex. ['fre', 'lör']
//   dricks      högsta dricks utöver lönen (slumpas)
//   krav        { färdighet: { socialt: 2 }, termin: 2 } för att få söka
//   chans       hur troligt det är att få jobbet om man uppfyller kraven (0–1, standard 0.75)
//   intervju    { fråga, rätt, fel: [...] } en fråga när man söker. Rätt svar höjer chansen.
const JOBB = {
  buss: {
    namn: 'Bussjobb',
    moment: 'buss',
    lön: 24,
    energi: 12,
    färdighet: 'teknik',
    text: 'Kör bussen till hållplatsen, plocka upp passageraren och kör till campus.',
    stopp: ['Plocka upp passageraren', 'Släpp av på campus'],
  },
  lastbil: {
    namn: 'Lastbilskörning',
    moment: 'lastbil',
    lön: 28,
    energi: 14,
    färdighet: 'teknik',
    text: 'Hämta godset vid lastzonen och leverera det vid terminalen. Sakta ner före varje stopp.',
    stopp: ['Lasta godset', 'Lossa vid terminalen'],
    krav: { färdighet: { teknik: 1 } },
  },
  truck: {
    namn: 'Gaffeltruckpass',
    moment: 'truck',
    lön: 26,
    energi: 12,
    färdighet: 'teknik',
    text: 'Styr trucken genom lagret, hämta en pall och lämna den i lagerzonen.',
    stopp: ['Hämta pallen', 'Placera pallen'],
  },
  fabrik: {
    namn: 'Fabriksskift',
    moment: 'timing',
    lön: 23,
    energi: 12,
    färdighet: 'teknik',
    text: 'Montering, kvalitetskontroll och packning. Träffa den gröna zonen på varje station.',
    stationer: ['Montering', 'Kvalitetskontroll', 'Packning'],
  },
  ritning: {
    namn: 'Ritningspass',
    moment: 'quiz',
    lön: 22,
    energi: 10,
    färdighet: 'teknik',
    text: 'Läs ritningens krav och välj skala, måttsättning och vy.',
    frågor: [
      ['Skala', 'En detalj är 100 mm lång. Hur lång är den på ritningen i skala 1:2?', ['50 mm', '200 mm', '100 mm']],
      ['Måttsättning', 'Vilket mått behövs för ett cirkulärt hål?', ['Diameter', 'Bara färg', 'Bara vikt']],
      ['Vy', 'Vilken vy visar ett dolt hål genom detaljen?', ['Snittvy', 'Bara en titel', 'Bara en yttre silhuett']],
    ],
  },
  gym: {
    namn: 'Gyminstruktör',
    moment: 'timing',
    lön: 26,
    energi: 16,
    färdighet: 'kondition',
    text: 'Leda ett pass: rodd, cykel och styrka. Hitta rytmen och träffa den gröna zonen.',
    stationer: ['Rodd · hitta rytmen', 'Cykel · jämn takt', 'Styrka · kontrollerad rörelse'],
    tider: { från: 7, till: 21 },
    krav: { färdighet: { kondition: 1 } },
  },
  matte: {
    namn: 'Mattehandledare',
    moment: 'matte',
    lön: 30,
    energi: 10,
    färdighet: 'matematik',
    text: 'Hjälp förstaårsstuderande med tre uppgifter. Ett fel avslutar inte passet.',
    tider: { från: 14, till: 20 },
    krav: { färdighet: { matematik: 2 } },
    intervju: {
      fråga: 'En studerande har fastnat. Vad gör du först?',
      rätt: 'Frågar hur hen har tänkt hittills',
      fel: ['Löser uppgiften åt hen', 'Säger att det är lätt'],
    },
  },
  order: {
    namn: 'Orderrunda',
    moment: 'quiz',
    lön: 24,
    energi: 10,
    färdighet: 'socialt',
    text: 'Ge tre tydliga order till teamen i rätt ordning.',
    frågor: [
      ['Monteringslaget', 'Vad säger du först?', ['Kontrollera materialet och börja monteringen', 'Byt avdelning utan plan', 'Vänta utan information']],
      ['Logistikteamet', 'Hur får du lasten till rätt plats?', ['Flytta lasten till zon B och bekräfta när det är klart', 'Lägg den någonstans', 'Ta rast och lämna lasten']],
      ['Kvalitetsteamet', 'Vad krävs före leverans?', ['Kontrollera måtten och dokumentera resultatet', 'Hoppa över kontrollen', 'Gissa om allt passar']],
    ],
  },
  kiosk: {
    namn: 'Kioskbiträde i W33',
    moment: 'timing',
    lön: 16,
    energi: 7,
    färdighet: 'socialt',
    text: 'Kassan, påfyllning och kaffemaskinen. Ett lugnt pass med låg lön.',
    stationer: ['Kassan', 'Påfyllning', 'Kaffemaskinen'],
    tider: { från: 8, till: 18 },
    chans: 0.9,
  },
  bartender: {
    namn: 'Bartender på Filicia',
    moment: 'timing',
    lön: 24,
    energi: 14,
    färdighet: 'socialt',
    text: 'Ta beställningar, tappa öl och sköt kassan. Dricksen beror på kvällen.',
    stationer: ['Ta beställningar', 'Tappa öl', 'Kassan'],
    tider: { från: 18, till: 26 },
    dricks: 12,
    krav: { färdighet: { socialt: 1 } },
    intervju: {
      fråga: 'En gäst har fått för mycket. Vad gör du?',
      rätt: 'Serverar vatten i stället och ser till att hen kommer hem',
      fel: ['Serverar en till, kunden har alltid rätt', 'Ignorerar det'],
    },
  },
  tidningsbud: {
    namn: 'Tidningsbud',
    moment: 'lastbil',
    lön: 32,
    energi: 18,
    färdighet: 'kondition',
    text: 'Hämta tidningarna vid tryckeriet och dela ut dem innan folk vaknar. Tidigt, men bra betalt.',
    stopp: ['Hämta tidningarna', 'Dela ut'],
    tider: { från: 5, till: 8 },
    chans: 0.85,
  },
  skiftledare: {
    namn: 'Skiftledare',
    moment: 'quiz',
    lön: 38,
    energi: 12,
    färdighet: 'socialt',
    text: 'Planera skiftet, fördela folket och lös det som går snett.',
    frågor: [
      ['Planering', 'Två är sjuka. Vad gör du först?', ['Prioriterar de viktigaste ordrarna och flyttar folk dit', 'Stänger linjen', 'Låter alla jobba som vanligt']],
      ['Säkerhet', 'En truck har ett läckage. Vad gäller?', ['Ställer av trucken och rapporterar', 'Kör vidare till rasten', 'Torkar upp och glömmer det']],
      ['Överlämning', 'Vad lämnar du till nästa skift?', ['Läget, avvikelser och vad som är kvar', 'Ingenting, de får lista ut det', 'Bara antalet timmar']],
    ],
    krav: { färdighet: { socialt: 2, arbetsvana: 3 } },
    chans: 0.6,
    intervju: {
      fråga: 'Två i teamet är osams. Hur gör du?',
      rätt: 'Pratar med båda och hittar en lösning tillsammans',
      fel: ['Väljer sida', 'Låtsas att inget har hänt'],
    },
  },
  itsupport: {
    namn: 'IT-support',
    moment: 'quiz',
    lön: 32,
    energi: 9,
    färdighet: 'programmering',
    text: 'Hjälp campus med datorproblem. Tre ärenden per pass.',
    frågor: [
      ['Ärende 1', 'Wifi fungerar inte för en studerande. Vad testar du först?', ['Om andra enheter har nät och om wifi är påslaget', 'Byter ut datorn', 'Säger att det är solfläckar']],
      ['Ärende 2', 'Någon har glömt sitt lösenord. Vad gör du?', ['Återställer det efter att ha kontrollerat vem det är', 'Skickar det gamla lösenordet', 'Ger dem ditt lösenord']],
      ['Ärende 3', 'Skrivaren skriver bara ut tomma papper. Vad kollar du?', ['Tonern och om rätt skrivare är vald', 'Om pappret är vått', 'Ringer brandkåren']],
    ],
    tider: { från: 8, till: 17 },
    krav: { färdighet: { programmering: 2 } },
    intervju: {
      fråga: 'Vad är det viktigaste i support?',
      rätt: 'Att förstå problemet innan man ändrar något',
      fel: ['Att vara snabb oavsett vad', 'Att använda så många tekniska ord som möjligt'],
    },
  },
};
// Jobbet varje karaktär har från början.
const STARTJOBB = {
  arvid: 'buss',
  zeb: 'lastbil',
  vilhelm: 'truck',
  jennifer: 'fabrik',
  axel: 'ritning',
  albin: 'gym',
  rasmus: 'matte',
  ida: 'order',
};
// Så här många jobb man kan ha samtidigt.
const MAX_JOBB = 3;

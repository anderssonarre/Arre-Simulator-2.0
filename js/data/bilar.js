// BILAR · innehållsfil
// Bilar man kan köpa hos bilhandlaren i centrum och köra själv. Se js/game/bilar.js.
//
//   namn       bilens namn
//   pris       € (kontant, eller med billån)
//   toppfart   km/h
//   acc        hur snabbt den accelererar (1 = vanlig bil, 2 = sportbil)
//   färg       lackens färg
//   text       vad säljaren säger om den
const BILAR = {
  corolla: {
    namn: 'Toyota Corolla 2004',
    pris: 2500,
    toppfart: 150,
    acc: 0.8,
    färg: '#9aa0a6',
    text: 'Lite rost vid trösklarna, men den startar varje morgon. Kassettbandspelare ingår.',
  },
  golf: {
    namn: 'Volkswagen Golf 2012',
    pris: 6900,
    toppfart: 170,
    acc: 1,
    färg: '#2b4f7e',
    text: 'En riktig studentbil. Bara en tidigare ägare, en pensionär från Korsholm.',
  },
  v70: {
    namn: 'Volvo V70 2010',
    pris: 8900,
    toppfart: 180,
    acc: 1,
    färg: '#7a1f22',
    text: 'Plats för hela gänget och en flyttkartong till. Österbottens nationalbil.',
  },
  octavia: {
    namn: 'Škoda Octavia 2019',
    pris: 15900,
    toppfart: 200,
    acc: 1.2,
    färg: '#e8e8e2',
    text: 'Snål, tyst och med farthållare. Den vuxna valet.',
  },
  tesla: {
    namn: 'Tesla Model 3',
    pris: 39900,
    toppfart: 220,
    acc: 1.9,
    färg: '#1d1f22',
    text: 'Helt eldriven. Tyst som en mus och snabb som en raket från rödljuset.',
  },
  bmw: {
    namn: 'BMW M3',
    pris: 74000,
    toppfart: 250,
    acc: 2.2,
    färg: '#2e6fb8',
    text: '510 hästkrafter. Grannarna kommer att höra när du kommer hem.',
  },
  porsche: {
    namn: 'Porsche 911 Carrera',
    pris: 100000,
    toppfart: 290,
    acc: 2.6,
    färg: '#d4a020',
    text: 'Lyx. Gul, låg och helt onödig. Perfekt.',
  },
};
// Bilhandlaren och billånet.
const BILHANDEL = {
  namn: 'Vasa Bilcenter',
  poi: 'Vaasanpuistikko 17', // ställs nära den här platsen i kartdatan
  handpenning: 0.2, // så stor del man betalar direkt med billån
  ränta: 0.08, // på hela lånet
  veckor: 16, // lånet betalas av på så många veckor (ett studieår)
  inbyte: 0.6, // så mycket av priset man får tillbaka när man säljer
};

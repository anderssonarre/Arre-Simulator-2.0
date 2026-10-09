// TELEFON OCH UBER · innehållsfil
// Telefoner köps i telefonbutiken i centrum. Öppna telefonen med P (eller knappen 📱).
// Se js/game/telefon.js.
//
// Telefoner (TELEFONER):
//   namn, pris   vad den heter och kostar
//   smart        true om den har appar (Uber, väder, bank, karta). En knapptelefon kan bara
//                ringa och skicka sms, och ringa taxi.
const TELEFONER = {
  nokia: { namn: 'Begagnad Nokia 3310', pris: 35, smart: false, text: 'Batteriet räcker i en vecka och den går inte sönder.' },
  android: { namn: 'Samsung Galaxy A', pris: 249, smart: true, text: 'En bra mellanklasstelefon med alla appar du behöver.' },
  iphone: { namn: 'iPhone', pris: 1099, smart: true, text: 'Dyr, blank och kameran är fantastisk.' },
};
const TELEFONBUTIK = { namn: 'Telefonbutiken', poi: 'Telia Kauppa' };

// Uber och taxi. Priset räknas efter fågelvägen mellan där du är och dit du ska.
const UBER = {
  start: 4, // € grundavgift
  perKm: 1.6, // € per kilometer
  minst: 8, // € minsta pris
  natt: 1.5, // gånger dyrare på natten (00–05) och fredag–lördag kväll efter 22
  taxi: 1.4, // vanlig taxi (knapptelefon) är så här mycket dyrare än Uber
  väntan: [2, 6], // minuter tills bilen kommer (slumpas)
  fart: 35, // km/h i snitt genom stan, för hur lång tid resan tar
  bilar: [
    { namn: 'Toyota Prius', färg: '#1d1f22' },
    { namn: 'Škoda Superb', färg: '#e8e8e2' },
    { namn: 'Tesla Model Y', färg: '#9aa0a6' },
    { namn: 'Kia Niro', färg: '#2b4f7e' },
  ],
  förare: ['Ahmed', 'Mikko', 'Sanna', 'Jari', 'Leila', 'Tomas', 'Oskar', 'Aino'],
  prat: [
    'Föraren berättar om när hen körde en hel hockeylag hem efter en vinst.',
    'Det spelas finsk schlager på radion. Föraren sjunger med.',
    'Föraren frågar vad du pluggar och säger att hens kusin också är ingenjör.',
    'Tyst resa. Du ser Vasa glida förbi i fönstret.',
    'Föraren tipsar om den bästa pizzerian i stan.',
  ],
};
// Dit man kan åka. värld är kartan, och läget är en plats i verkligheten (lat, lon) eller
// en dörr på kartan. hem: true betyder hemma (man kliver ur vid ytterdörren).
const RESMÅL = {
  w33: { namn: 'W33 · campus', värld: 'outdoor', x: 103, y: 106 },
  hem: { namn: 'Hem', värld: 'outdoor', hem: true },
  torget: { namn: 'Torget i centrum', värld: 'centrum', torget: true },
  ollis: { namn: "Oliver's Inn (Ollis)", värld: 'centrum', ollis: true },
  bilhandeln: { namn: 'Vasa Bilcenter', värld: 'centrum', poi: 'Vaasanpuistikko 17' },
  bron: { namn: 'Brändöbron', värld: 'bron', lat: 63.1024, lon: 21.6016 },
};

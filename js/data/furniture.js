// MÖBLER OCH BOENDE · innehållsfil
// Möbler man kan köpa till hemmet, och lägenheterna man kan flytta till.
// mys: hur mycket möbeln höjer trivseln hemma. Trivseln gör att man vilar bättre och mår bättre hemma.
'use strict';
const FURNITURE = {
  fatolj: { namn: 'Fåtölj', pris: 45, mys: 3, text: 'Skön att sjunka ner i efter en lång dag.' },
  bokhylla: { namn: 'Bokhylla', pris: 35, mys: 2, text: '+10 % erfarenhet när du pluggar.' },
  vaxt: { namn: 'Stor krukväxt', pris: 15, mys: 1, text: 'Grönt och levande.' },
  hantlar: { namn: 'Hantlar', pris: 25, mys: 0, text: 'Träna hemma: kondition och glädje.' },
  spel: {
    namn: 'Spelhörna',
    pris: 60,
    mys: 2,
    text: 'Spela en stund: mycket glädje, men tiden går.',
  },
  lampa: { namn: 'Saltkristallampa', pris: 12, mys: 1, text: 'Varmt sken på kvällarna.' },
  akvarium: { namn: 'Akvarium', pris: 70, mys: 4, text: 'Lugnande att titta på.' },
};
// Platser i hemmet där en möbel får stå.
const HOME_SLOTS = [
  { id: 'norr', namn: 'vid norra väggen', x: 5.5, y: 1.35 },
  { id: 'sangen', namn: 'vid sängens fotända', x: 2.9, y: 3.1 },
  { id: 'hyllan', namn: 'vid bokhyllan', x: 6.45, y: 3.4 },
  { id: 'soder', namn: 'vid södra väggen', x: 3.0, y: 6.5 },
  { id: 'koket', namn: 'vid köket', x: 6.55, y: 6.45 },
];
// Lägenheter: hyra per vecka, trivsel och väggfärg.
const APARTMENTS = {
  korridor: {
    namn: 'Studentkorridor',
    hyra: 40,
    mys: -2,
    text: 'Billigast. Delat kök och ibland högljudda grannar.',
    vägg: '#d8c9a6',
  },
  etta: { namn: 'Etta', hyra: 55, mys: 0, text: 'Där du bor nu: eget kök och lugnt.', vägg: null },
  balkong: {
    namn: 'Stor etta med balkong',
    hyra: 75,
    mys: 3,
    text: 'Nyrenoverad, ljusa väggar och balkong mot gården.',
    vägg: '#e9eef0',
  },
};
const MOVING_COST = 30;

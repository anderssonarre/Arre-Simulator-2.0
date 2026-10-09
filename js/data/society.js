// LEVANDE MÄNNISKOR · innehållsfil
// Hur personerna står till varandra från början, och skvaller som sprids om det du gör.
// Relationer: [person, person, värde -100..100]. 70+ = bästa vänner, 35+ = vänner, under 0 = osams.
'use strict';
const SOCIETY = {
  relationer: [
    ['axel', 'otto', 75],
    ['axel', 'lumberjack', 45],
    ['otto', 'abbe', 40],
    ['ida', 'jennifer', 45],
    ['albin', 'vilhelm', 55],
    ['arvid', 'axel', 40],
    ['arvid', 'zeb', 50],
    ['rasmus', 'zeb', 45],
    ['rasmus', 'philip', 35],
    ['frassin', 'abbe', 35],
    ['hannes', 'arvid', 35],
    ['niklas', 'mats', 50],
    ['niklas', 'tobias', 40],
    ['ossi', 'vilhelm', 30],
  ],
  // Skvaller: vad folk säger när de hört något om dig. {namn} är personen som säger det.
  skvaller: {
    femma: { text: 'Jag hörde att du fick en femma i {kurs}! Snyggt.', relation: 2 },
    underkänd: {
      text: 'Hörde att tentan i {kurs} gick dåligt. Det fixar sig, omtentan brukar vara lättare.',
      relation: 1,
    },
    fest: { text: 'Du var visst på fest på Filicia! Hur var det?', relation: 1 },
    fredagsfest: { text: 'Alla pratar om fredagsfesten. Du var ju där!', relation: 2 },
    hjälpte: {
      text: 'Någon sa att du hjälpte en full studerande hem i natt. Schysst gjort.',
      relation: 3,
    },
    skuld: {
      text: 'Är det sant att hyresvärden jagar dig? Säg till om du behöver tips om extrajobb.',
      relation: 0,
    },
    kaffe: { text: 'Jag såg dig och {med} ta kaffe. Trevligt!', relation: 1 },
    full: { text: 'Du var visst rätt full igår. Allt okej idag?', relation: 0 },
    däckade: {
      text: 'Hörde att någon fick hjälpa dig hem. Drick vatten mellan ölen nästa gång.',
      relation: 0,
    },
    kaffekopp: {
      text: 'Fjärde koppen kaffe idag? Du skakade ju när du gick förbi automaten.',
      relation: 0,
    },
    stipendium: { text: 'Du fick ju stipendiet! Grattis!', relation: 3 },
    flytt: { text: 'Har du flyttat till en {till}? Grattis! Får man komma på besök?', relation: 1 },
    praktik: { text: 'Du fick praktik på {företag}! Snyggt jobbat.', relation: 2 },
    skippade: { text: 'Axel sa att du inte kom på festen. Han var lite besviken.', relation: -1 },
  },
};

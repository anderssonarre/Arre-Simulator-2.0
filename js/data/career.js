// FRAMTIDEN · innehållsfil
// Praktikplatser, examensarbete och vad man kan bli. Företagen är påhittade.
'use strict';
const CAREER = {
  // Praktikplatser. kräver: färdighet och nivå, snitt: lägsta betygssnitt, frånTermin: tidigast.
  företag: [
    {
      id: 'botnia',
      namn: 'Botnia Motor',
      bransch: 'motorer och energi',
      färdighet: 'teknik',
      nivå: 2,
      snitt: 0,
      frånTermin: 3,
      fråga: [
        'Vad betyder verkningsgrad?',
        'Nyttig energi delat med tillförd energi',
        'Motorns maxeffekt',
        'Bränsleförbrukning per timme',
      ],
    },
    {
      id: 'kvarkenkraft',
      namn: 'Kvarkenkraft',
      bransch: 'vindkraft och elnät',
      färdighet: 'matematik',
      nivå: 3,
      snitt: 3,
      frånTermin: 4,
      fråga: [
        'Vad är effekt?',
        'Energi per tidsenhet',
        'Spänning gånger resistans',
        'Ström delat med tid',
      ],
    },
    {
      id: 'strandvik',
      namn: 'Strandvik Automation',
      bransch: 'automation och robotar',
      färdighet: 'programmering',
      nivå: 2,
      snitt: 0,
      frånTermin: 3,
      fråga: [
        'Vad gör en PLC?',
        'Styr maskiner efter program och givare',
        'Ritar 3D-modeller',
        'Lagrar fakturor',
      ],
    },
    {
      id: 'pixelhamn',
      namn: 'Pixelhamn',
      bransch: 'mjukvara och appar',
      färdighet: 'programmering',
      nivå: 4,
      snitt: 3.5,
      frånTermin: 4,
      fråga: [
        'Vad är en API?',
        'Ett gränssnitt som program pratar med',
        'En sorts databas',
        'Ett programspråk',
      ],
    },
    {
      id: 'osterbo',
      namn: 'Österbo Konsult',
      bransch: 'konstruktion och CAD',
      färdighet: 'teknik',
      nivå: 4,
      snitt: 3,
      frånTermin: 5,
      fråga: [
        'Varför toleranssätter man en ritning?',
        'Så att delarna passar trots små avvikelser',
        'För att ritningen ska se snyggare ut',
        'Det behövs bara för plast',
      ],
    },
  ],
  praktikVeckor: 4,
  praktikLön: 70, // € per vecka
  // Examensarbetet: så många skrivpass, och vilken termin det tidigast kan börjas.
  examensarbete: { pass: 6, frånTermin: 7 },
};

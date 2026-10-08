// FÄRDIGHETER OCH EKONOMI · innehållsfil
// Siffrorna här styr hur snabbt man blir bättre och hur mycket saker kostar.
// Ändra gärna, spelet läser värdena när det startar.
'use strict';

// Färdigheterna. Nivå 0–10. Varje nivå kräver lite mer erfarenhet än den förra.
const SKILLS = {
  programmering: {
    namn: 'Programmering',
    ikon: '⌨',
    text: 'Lättare tentor i programmeringskurser.',
  },
  matematik: { namn: 'Matematik', ikon: '∑', text: 'Lättare tentor i matte- och analyskurser.' },
  teknik: { namn: 'Teknik', ikon: '⚙', text: 'Lättare tentor i konstruktion, CAD och produktion.' },
  socialt: { namn: 'Socialt', ikon: '☺', text: '+5 % på allt som bygger vänskap, per nivå.' },
  kondition: { namn: 'Kondition', ikon: '♥', text: 'Energin tar slut 4 % långsammare per nivå.' },
  arbetsvana: { namn: 'Arbetsvana', ikon: '€', text: '+5 % lön på extrajobben per nivå.' },
};

// Vilken färdighet varje kurs hör till. Kurser som saknas här räknas som teknik.
const COURSE_SKILL = {
  Programmering: 'programmering',
  Webbutveckling: 'programmering',
  Databaser: 'programmering',
  'Objektorienterad design': 'programmering',
  'Inbyggda system': 'programmering',
  Backendprojekt: 'programmering',
  Systemintegration: 'programmering',
  'Matematik I': 'matematik',
  'Diskret matematik': 'matematik',
  Statistik: 'matematik',
  'Linjär algebra': 'matematik',
  'Numeriska metoder': 'matematik',
  Optimering: 'matematik',
  'Tillämpad analys': 'matematik',
  Reglerteknik: 'matematik',
};

// Erfarenhet (XP) för olika saker man gör.
const XP = {
  studiepass: 12,
  föreläsning: 15,
  tentaGodkänd: 10,
  pluggaMedVän: 4, // socialt
  samtal: 3, // socialt, första samtalet per dag och person
  kaffe: 5, // socialt
  fest: 5, // socialt
  jobbpass: 12, // arbetsvana, plus jobbets egen färdighet nedan
  gymset: 8, // kondition
};

// Extrajobben tränar också en färdighet utöver arbetsvana.
const JOB_SKILL = {
  arvid: 'teknik',
  zeb: 'teknik',
  vilhelm: 'teknik',
  jennifer: 'teknik',
  axel: 'teknik',
  albin: 'kondition',
  rasmus: 'matematik',
  ida: 'socialt',
};

// Ekonomin räknas per vecka och dras på måndagar.
const ECONOMY = {
  hyra: 55, // € per vecka
  studiestöd: 45, // € per vecka från FPA
  // FPA kräver studieframgång: en godkänd kurs de senaste så här många dagarna
  // (eller att terminen nyss har börjat).
  stödKräverKursInom: 21,
  startpengar: 40,
  // Vänner man inte träffat på så här många dagar svalnar lite varje vecka.
  vänskapSvalnarEfter: 14,
  vänskapSvalnar: 3,
};

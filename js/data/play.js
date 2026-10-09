// SPELA TILLSAMMANS · innehållsfil
// Gester, snöbollar, kubb och pubquiz. Se js/game/play.js.
//
// Gester (GESTER): syns för alla i samma värld. Öppna menyn med G (eller knappen 😀).
//   namn, ikon   vad som visas
//   kropp        hur figuren rör sig: 'vinka', 'dansa' eller 'gestikulera'
//   glädje       glädje du och de runt dig får, högst en gång i timmen per gest
//   text         vad som står i bubblan (en slumpas)
const GESTER = {
  vinka: { namn: 'Vinka', ikon: '👋', kropp: 'vinka', glädje: 1, text: ['Hej!', 'Tjenare!', 'Moi!'] },
  skåla: { namn: 'Skåla', ikon: '🍻', kropp: 'gestikulera', glädje: 3, text: ['Skål!', 'Kippis!', 'Skål på er!'] },
  dansa: { namn: 'Dansa', ikon: '💃', kropp: 'dansa', glädje: 4, text: ['🎶', '🎶 🎶'] },
  highfive: { namn: 'High five', ikon: '🙌', kropp: 'vinka', glädje: 2, text: ['High five!', 'Yes!'] },
  skratta: { namn: 'Skratta', ikon: '😂', kropp: 'gestikulera', glädje: 2, text: ['Hahaha!', 'Haha, nej!'] },
  sjunga: {
    namn: 'Sjunga en visa',
    ikon: '🎵',
    kropp: 'gestikulera',
    glädje: 5,
    // Egna snapsvisor (inga riktiga, så att det inte blir upphovsrättsbråk).
    text: [
      '🎵 Nu tar vi en till för Technobothnia, hej!',
      '🎵 W33, du är vår borg, här finns ingen sorg!',
      '🎵 Tentan var svår men sitzen är lång, så vi tar en sång!',
      '🎵 Vasa i snö och Vasa i sol, vi sjunger tills vi står på en stol!',
    ],
  },
};
// Skålar två eller fler inom några sekunder blir det en gemensam skål.
const GEMENSAM_SKÅL = { sekunder: 8, glädje: 6 };

// Snöbollar: kastas med F (eller i gestmenyn) när det ligger snö ute.
const SNÖBOLL = {
  fart: 13, // rutor per sekund
  uppåt: 2.6, // hur högt den kastas
  vänta: 0.6, // sekunder mellan kasten
  träffGlädje: 2, // glädje när du träffar någon
  kastarTillbaka: 0.4, // chansen att en person du träffar kastar tillbaka
  repliker: ['Hallå!', 'Du ska få!', 'Aj, kallt!', 'Okej, nu är det krig!', 'Haha, missade nästan!'],
};

// Kubb: spelas på gräsmattan på sommaren. Sex pinnar, fem kubbar och kungen.
const KUBB = {
  plats: { värld: 'outdoor', x: 60, y: 120 }, // ungefär var spelet står, flyttas till närmaste gräsplätt
  månader: [8, 9, 10, 11, 0], // maj till september (se YEAR.månader i seasons.js, 0 = september)
  pinnar: 6,
  kubbar: 5,
  zon: 0.26, // hur bred den gröna zonen är från början (0–1)
  smalare: 0.03, // så mycket smalare den blir för varje fälld kubb
  kungZon: 0.12,
  vinst: { glädje: 10, socialt: 15 },
};

// Pubquiz på Filicia: fredagar på kvällen. Frågorna är samma för alla och byts varje vecka.
const PUBQUIZ = {
  dag: 'fre',
  från: 18,
  till: 24,
  plats: { värld: 'w33', x: 36, y: 12 },
  prisPerRätt: 2, // € per rätt svar, första gången i veckan
  glädje: 8,
};

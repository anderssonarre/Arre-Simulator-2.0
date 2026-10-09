// SIDOUPPDRAG · innehållsfil
// Små uppdrag som personerna ger dig, som inte har med skolan att göra.
// Kopiera ett uppdrag, byt id och ändra texterna. Spelet kollar filen när det startar
// och skriver en varning i webbläsarens konsol om något är fel.
//
// Fält:
//   id          unikt namn utan mellanslag
//   titel       namnet på uppdraget
//   person      id på personen som ger uppdraget (se characters.js)
//   villkor     när uppdraget går att få (samma villkor som i events.js, t.ex.
//               relationMinst: { ossi: 10 } eller årstid: 'vinter'), plus frånTermin: 2
//   erbjudande  vad personen säger när hen ber om hjälp
//   steg        det man ska göra, i ordning. Se stegtyperna nedan
//   belöning    samma effekter som i events.js (pengar, glädje, energi, relation, färdighet,
//               rykte, meddelande) plus märke: 'Namn' som ger ett overallmärke
//   avslut      vad personen säger när allt är klart
//
// Stegtyper:
//   { typ: 'plats', plats: 'tritonia', mål: 'Leta vid Tritonia', hittar: 'Där är den!' }
//       gå till en plats (se PLATSER nedan) och tryck E vid markeringen.
//       Valfritt: tid: { från: 20, till: 24 } och dagar: ['tor'] om det bara går vissa tider.
//   { typ: 'prata', person: 'ossi', mål: 'Berätta för Ossi', knapp: 'Jag hittade den!', svar: '...' }
//       prata med en person. Valfritt: kostar: 3 (€ som betalas när man trycker på knappen).
//       Valfritt: tillsammans: 2 betyder att så många spelare måste stå där samtidigt
//       (du och kompisar online). Sätt då grupp: true på uppdraget, så erbjuds det bara online.
//   { typ: 'gör', handling: 'kaffe', värld: 'tech', mål: 'Köp en kaffe i Technobothnia' }
//       gör något i spelet. Handlingar: 'kaffe' (köp en kopp), 'lunch' och 'buss' (ta bussen).
//       värld är valfri och betyder att det måste göras i just det huset.
//
// Platser: värld är 'outdoor', 'w33', 'tech' eller 'gym'. x och y är ungefärliga, spelet
// flyttar markeringen till närmaste ställe man kan gå till.
const PLATSER = {
  tritonia: { värld: 'outdoor', x: 74, y: 70, namn: 'vid Tritonia' },
  tervahovi: { värld: 'outdoor', x: 26, y: 46, namn: 'vid Tervahovi' },
  puuvillakuja: { värld: 'outdoor', x: 44, y: 106, namn: 'på Puuvillakuja' },
  fabriikki: { värld: 'outdoor', x: 30, y: 152, namn: 'vid Fabriikki' },
  leison: { värld: 'outdoor', x: 86, y: 150, namn: 'vid Leison Café' },
  virastotalo: { värld: 'outdoor', x: 142, y: 128, namn: 'vid Virastotalo' },
  muova: { värld: 'outdoor', x: 74, y: 196, namn: 'vid Muova' },
  wscCyklar: { värld: 'outdoor', x: 56, y: 190, namn: 'vid cykelstället utanför WSC' },
  techEntre: { värld: 'outdoor', x: 74, y: 136, namn: 'utanför Technobothnia' },
  maskinlabbet: { värld: 'tech', x: 24.5, y: 35.5, namn: 'i maskinlabbet på Technobothnia' },
  w33Förråd: { värld: 'w33', x: 30, y: 27.5, namn: 'i förrådet i W33' },
};

const QUESTS = [
  {
    id: 'albins-nyckel',
    titel: 'Albins skåpnyckel',
    person: 'albin',
    erbjudande:
      'Öh … jag har tappat nyckeln till mitt skåp på gymmet. Jag tror den åkte ur fickan vid cykelstället. Kan du kolla?',
    steg: [
      {
        typ: 'plats',
        plats: 'wscCyklar',
        mål: 'Leta efter Albins nyckel vid cykelstället utanför WSC',
        hittar: 'En liten nyckel med en blå gummibricka ligger i gruset. Nummer 14.',
      },
      {
        typ: 'prata',
        person: 'albin',
        mål: 'Ge nyckeln till Albin',
        knapp: 'Här är din nyckel!',
        svar: 'Nej men tack! Skåp 14, det är min. Jag bjuder på ett proteinkaffe nästa gång.',
      },
    ],
    belöning: { relation: { albin: 10 }, glädje: 6, färdighet: { kondition: 6 } },
    avslut: 'Albin ser lättad ut och springer iväg till gymmet.',
  },
  {
    id: 'lumberjacks-kaffe',
    titel: 'Lumberjacks morgonkaffe',
    person: 'lumberjack',
    erbjudande:
      'Automaten i W33 gör bara hett vatten idag. Den i Technobothnia ska vara bättre. Hämtar du en kopp åt mig? Jag kan inte lämna min plats.',
    steg: [
      {
        typ: 'gör',
        handling: 'kaffe',
        värld: 'tech',
        mål: 'Köp en kaffe i automaten på Technobothnia',
      },
      {
        typ: 'prata',
        person: 'lumberjack',
        mål: 'Ge kaffet till Lumberjack',
        knapp: 'Varsågod, en kopp från Technobothnia',
        svar: 'Ahh. Det här är livet. Du är en sann vän.',
      },
    ],
    belöning: { relation: { lumberjack: 10 }, glädje: 5, pengar: 3 },
    avslut: 'Lumberjack höjer koppen mot dig.',
  },
  {
    id: 'korvapuusti',
    titel: 'Torsdagsbullar på Leison',
    person: 'abbe',
    erbjudande:
      'Leison Café bakar korvapuusti på torsdagar mellan 10 och 14. Jag hinner inte dit. Köper du två åt oss?',
    steg: [
      {
        typ: 'plats',
        plats: 'leison',
        dagar: ['tor'],
        tid: { från: 10, till: 14 },
        mål: 'Köp bullar på Leison Café (torsdag 10–14)',
        hittar: 'Det doftar kardemumma. Två varma korvapuusti i en papperspåse.',
      },
      {
        typ: 'prata',
        person: 'abbe',
        mål: 'Ge bullarna till Abbe',
        knapp: 'Två korvapuusti, en till dig',
        kostar: 4,
        svar: 'Du är bäst. De här är fortfarande varma!',
      },
    ],
    belöning: { relation: { abbe: 10 }, glädje: 10, mättnad: 15 },
    avslut: 'Ni äter bullarna tillsammans. Pengarna är väl spenderade.',
  },
  {
    id: 'fagelrundan',
    titel: 'Frassins fågelrunda',
    person: 'frassin',
    erbjudande:
      'Jag räknar fåglar på campus. Det sägs att det finns en hackspett vid Tervahovi, en kaja vid Tritonia och en sädesärla på Puuvillakuja. Kan du kolla alla tre?',
    steg: [
      {
        typ: 'plats',
        plats: 'tervahovi',
        mål: 'Hitta hackspetten vid Tervahovi',
        hittar: 'Tok-tok-tok. En större hackspett hackar i en gammal tall.',
      },
      {
        typ: 'plats',
        plats: 'tritonia',
        mål: 'Hitta kajan vid Tritonia',
        hittar: 'En kaja sitter på räcket och tittar misstänksamt på dig.',
      },
      {
        typ: 'plats',
        plats: 'puuvillakuja',
        mål: 'Hitta sädesärlan på Puuvillakuja',
        hittar: 'En sädesärla vippar på stjärten mellan cyklarna.',
      },
      {
        typ: 'prata',
        person: 'frassin',
        mål: 'Berätta för Frassin vad du såg',
        knapp: 'Hackspett, kaja och sädesärla!',
        svar: 'Alla tre! Du har ögon för det här. Välkommen i fågelklubben.',
      },
    ],
    belöning: { relation: { frassin: 12 }, glädje: 10, märke: 'Fågelskådare' },
    avslut: 'Frassin skriver ner allt i ett slitet anteckningsblock.',
  },
  {
    id: 'ossis-cykel',
    titel: 'Ossis borttappade cykel',
    person: 'ossi',
    villkor: { relationMinst: { ossi: 5 } },
    erbjudande:
      'Min cykel är borta! Den stod vid Fabriikki i morse. Röd, med en korg. Kan du hålla utkik?',
    steg: [
      {
        typ: 'plats',
        plats: 'fabriikki',
        mål: 'Leta efter Ossis cykel vid Fabriikki',
        hittar:
          'Ingen cykel, men en lapp på stolpen: "Felparkerade cyklar har flyttats till Virastotalo. /Fastighetsskötaren"',
      },
      {
        typ: 'plats',
        plats: 'virastotalo',
        mål: 'Hämta cykeln vid Virastotalo',
        hittar: 'Där står den! Röd, med en korg och en lapp på styret.',
      },
      {
        typ: 'prata',
        person: 'ossi',
        mål: 'Lämna tillbaka cykeln till Ossi',
        knapp: 'Den var vid Virastotalo',
        svar: 'Fastighetsskötaren igen! Tack. Här, för besväret. Och säg till om du vill ha extra pass.',
      },
    ],
    belöning: { pengar: 15, relation: { ossi: 10 }, färdighet: { arbetsvana: 6 } },
    avslut: 'Ossi cyklar iväg och plingar två gånger.',
  },
  {
    id: 'ljudet-i-labbet',
    titel: 'Ljudet i maskinlabbet',
    person: 'vilhelm',
    erbjudande:
      'Det låter konstigt i maskinlabbet på kvällarna. Skrapande. Jag har inte tid att kolla. Gör du det, efter klockan 19?',
    steg: [
      {
        typ: 'plats',
        plats: 'maskinlabbet',
        tid: { från: 19, till: 24 },
        mål: 'Undersök maskinlabbet på Technobothnia (efter 19)',
        hittar: 'Bakom svarven sitter en mager grå katt och tittar på dig. Den jamar.',
      },
      {
        typ: 'prata',
        person: 'vilhelm',
        mål: 'Berätta för Vilhelm vad du hittade',
        knapp: 'Det var en katt! Jag köper mat åt den',
        kostar: 3,
        svar: 'En katt? … Okej. Ge den maten utanför, så hittar den hem. Bra jobbat.',
      },
      {
        typ: 'plats',
        plats: 'techEntre',
        mål: 'Ge katten mat utanför Technobothnia',
        hittar: 'Katten äter upp allt, stryker sig mot benet och försvinner mot Puuvillakuja.',
      },
    ],
    belöning: { relation: { vilhelm: 14 }, glädje: 12, märke: 'Campuskatten' },
    avslut: 'Vilhelm ler, nästan. Det är ovanligt.',
  },
  {
    id: 'bastukvall',
    titel: 'Bastukväll på Puuvillakuja',
    person: 'otto',
    villkor: { relationMinst: { otto: 10 } },
    erbjudande:
      'Vi har bastu i studentbostäderna på Puuvillakuja på fredagar och lördagar efter 19. Kom!',
    steg: [
      {
        typ: 'plats',
        plats: 'puuvillakuja',
        dagar: ['fre', 'lör'],
        tid: { från: 19, till: 24 },
        mål: 'Gå på bastukväll på Puuvillakuja (fre–lör efter 19)',
        hittar: 'Löylyä! Bastun är het och snacket är bra. Du kliver ut ny människa.',
      },
    ],
    belöning: { relation: { otto: 8 }, glädje: 15, energi: 20, märke: 'Bastukväll' },
    avslut: 'Du går hem med blöt handduk och rosiga kinder.',
  },
  {
    id: 'idas-loppis',
    titel: 'Idas loppis',
    person: 'ida',
    erbjudande:
      'Jag håller loppis vid Tritonia på lördag förmiddag. Lådorna står i förrådet i W33. Hjälper du mig bära?',
    steg: [
      {
        typ: 'plats',
        plats: 'w33Förråd',
        mål: 'Hämta Idas lådor i W33',
        hittar: 'Tre lådor: böcker, en våffeljärn och en mystisk kartong märkt "kablar".',
      },
      {
        typ: 'plats',
        plats: 'tritonia',
        dagar: ['lör'],
        tid: { från: 9, till: 14 },
        mål: 'Bär lådorna till loppisen vid Tritonia (lördag 9–14)',
        hittar: 'Ida har redan ett bord och en skylt. Våffeljärnet säljs efter fem minuter.',
      },
    ],
    belöning: { pengar: 12, relation: { ida: 10 }, färdighet: { arbetsvana: 5 }, glädje: 6 },
    avslut: 'Ida delar vinsten med dig. "Samma tid nästa termin?"',
  },
  // ---- I Vasa centrum (bussen går från hållplatsen vid Wolffskavägen) ----
  {
    id: 'ossis-munkar',
    titel: 'Torgmunkar åt Ossi',
    person: 'ossi',
    erbjudande:
      'Jag har möte hela eftermiddagen och det enda som får mig att överleva är en torgmunk. Tar du bussen in till torget och köper en åt mig? Jag swishar.',
    steg: [
      { typ: 'gör', handling: 'buss', mål: 'Ta bussen till Vasa centrum' },
      {
        typ: 'plats',
        plats: 'torget',
        tid: { från: 8, till: 18 },
        mål: 'Köp torgmunkar på torget (8–18)',
        hittar: 'Det doftar kardemumma. Du köper två, en åt Ossi och en som "provsmakning".',
      },
      { typ: 'prata', person: 'ossi', mål: 'Ge munken till Ossi', knapp: 'Här, fortfarande varm!', svar: 'Du har räddat mötet. Och mig.' },
    ],
    belöning: { pengar: 6, relation: { ossi: 8 }, glädje: 5 },
    avslut: 'Ossi har socker i mustaschen resten av dagen.',
  },
  {
    id: 'jennifers-kyrka',
    titel: 'Kyrkan i kvällsljus',
    person: 'jennifer',
    erbjudande:
      'Trefaldighetskyrkan är så fin när solen går ner. Kan du ta en bild åt mig? Jag har ingen tid att åka in till stan själv.',
    steg: [
      {
        typ: 'plats',
        plats: 'kyrkan',
        mål: 'Fota Trefaldighetskyrkan',
        hittar: 'Det röda teglet glöder och tornet syns över hela parken. Klick.',
      },
      { typ: 'prata', person: 'jennifer', mål: 'Visa bilden för Jennifer', knapp: 'Kolla här!', svar: 'Wow. Den blir min nya bakgrundsbild.' },
    ],
    belöning: { relation: { jennifer: 8 }, glädje: 6 },
    avslut: 'Bilden får fler gillningar än något Jennifer lagt upp i år.',
  },
  // ---- Gruppuppdrag: kräver att ni är minst två spelare online på samma ställe ----
  {
    id: 'ottos-soffa',
    titel: 'Soffan till Puuvillakuja',
    person: 'otto',
    grupp: true,
    erbjudande:
      'Jag har köpt en soffa på loppis, men den väger ett ton. Skaffa en kompis till, så bär ni den till Puuvillakuja?',
    steg: [
      {
        typ: 'plats',
        plats: 'puuvillakuja',
        tillsammans: 2,
        mål: 'Bär soffan till Puuvillakuja, minst två (ta med en kompis online)',
        hittar: '"Lyft med benen!" Ni får upp soffan för trappan med bara ett litet märke i tapeten.',
      },
      { typ: 'prata', person: 'otto', mål: 'Säg till Otto att soffan står på plats', knapp: 'Soffan är levererad!', svar: 'Legender. Ni är välkomna att sitta i den när som helst.' },
    ],
    belöning: { pengar: 8, relation: { otto: 10 }, glädje: 8, märke: 'Soffbärare' },
    avslut: 'Soffan är grön, sliten och perfekt.',
  },
  {
    id: 'idas-gruppbild',
    titel: 'Gruppbild vid vattentornet',
    person: 'ida',
    grupp: true,
    erbjudande:
      'Jag gör en kalender om studentlivet i Vasa. Jag behöver en gruppbild vid vattentornet i centrum, minst två personer. Fixar du och en kompis det?',
    steg: [
      { typ: 'gör', handling: 'buss', mål: 'Ta bussen till Vasa centrum' },
      {
        typ: 'plats',
        plats: 'vattentornet',
        tillsammans: 2,
        mål: 'Ta en gruppbild vid vattentornet, minst två (kompisar online)',
        hittar: 'Ni ställer er under vattentornet och självutlösaren piper. Någon blinkar. Ta två.',
      },
      { typ: 'prata', person: 'ida', mål: 'Skicka bilden till Ida', knapp: 'Här är gruppbilden!', svar: 'Perfekt, ni blir oktober i kalendern!' },
    ],
    belöning: { relation: { ida: 10 }, glädje: 10, märke: 'Kalenderbild' },
    avslut: 'Kalendern säljs slut på en vecka.',
  },
];

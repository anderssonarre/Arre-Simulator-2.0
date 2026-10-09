// REPLIKER · innehållsfil
// Allt personerna säger. Listor ger variation: spelet väljer en slumpad rad.
// {namn} blir personens förnamn, {jag} ditt namn, {plats} en plats och {aktivitet} vad någon gör.
const DIALOGUE = {
  // Första repliken när ni börjar prata, beroende på relation och personlighet.
  hälsning: {
    vän: [
      'Hej igen! Kul att du är här.',
      'Där är du ju! Hur är läget?',
      'Tjena {jag}! Saknade dig lite.',
    ],
    ovän: ['Jaha, du igen.', 'Vad vill du?'],
    shy: ['Hej … hur går det?', 'Åh, hej.'],
    cold: ['Hej. Vad funderar du på?', 'Ja?'],
    vanlig: ['Hej! Vad händer idag?', 'Hallå! Allt bra?', 'Tja! Läget?'],
  },
  // Vad personen säger om sitt favoritämne.
  ämne: {
    teknik: [
      'Ett litet steg i taget. Testa det du bygger innan du gör det större.',
      'Jag håller på att automatisera en grej. Det är beroendeframkallande.',
    ],
    system: [
      'Jag försöker få delarna att fungera tillsammans. Det är nästan som ett strategispel.',
      'Allt hänger ihop. Ändrar man en sak påverkas tre andra.',
    ],
    konstruktion: [
      'Precision först. En bra ritning sparar mycket problem senare.',
      'Jag har ritat om samma fäste fyra gånger nu. Men nu sitter det.',
    ],
    campus: [
      'Det känns som att alla har något på gång. Har du hunnit äta lunch?',
      'Har du varit i nya restaurangen i W33? Bättre än väntat.',
    ],
    fester: [
      'Filicia Castle behöver bara lite musik och rätt folk!',
      'Fredag. Filicia. Du kommer, va?',
    ],
    träning: [
      'Jag kör hellre ett bra pass än ett långt pass. Vill du ses på gymmet?',
      'Benpass idag. Trapporna blir ett äventyr.',
    ],
    matematik: [
      'Bryt ner problemet. Panik har aldrig gjort en integral lättare.',
      'Jag hittade ett snyggare sätt att lösa förra veckans uppgift.',
    ],
    planering: [
      'Om vi delar upp jobbet blir det klart. Jag kan hålla koll på planen.',
      'Jag har gjort ett schema för hela terminen. Ja, med färger.',
    ],
    jobb: [
      'Det finns ett pass vid den gröna jobbmarkeringen ute. Du får lön när hela jobbet är klart.',
    ],
    budget: ['Små utgifter blir stora tillsammans. Låt inte alla pengar gå till nya outfits.'],
  },
  // Om du skriver ett av orden i en egen replik svarar personen med en av raderna.
  nyckelord: [
    { ord: ['tack'], svar: ['Varsågod. Kul att kunna hjälpa.', 'Ingen orsak!'] },
    {
      ord: ['jobb', 'pengar'],
      svar: ['Kolla jobbmarkeringen ute på campus. Ett pass kan rädda lunchbudgeten.'],
    },
    {
      ord: ['tenta', 'stud', 'plugg'],
      svar: [
        'Två studiepass först, sedan tentan. Föreläsningarna hjälper också.',
        'Gå på föreläsningarna, det är halva jobbet.',
      ],
    },
    { ord: ['fest', 'filicia'], svar: ['Fredagar och lördagar på Filicia Castle. Hör med Axel.'] },
    {
      ord: ['schema', 'föreläsning'],
      svar: ['Kolla veckoschemat i menyn. Föreläsningarna har fasta tider.'],
    },
    {
      ord: ['vasa', 'vaasa'],
      svar: ['Vasa är bäst på hösten. Och på våren. Okej, inte i november.'],
    },
  ],
  vänsvar: [
    'Skönt att prata med någon som känner mig. Hur har din dag varit?',
    'Jag minns vårt senaste snack. Ska vi fortsätta på det?',
    'Kul att se dig igen. Det blev en bättre dag nu.',
  ],
  blygsvar: ['Jo, det går framåt. Jag håller på med {ämne}.'],
  vanligasvar: [
    'Ganska bra faktiskt. Har du hittat runt på campus?',
    'Lite mycket idag, men en lunch och lite sällskap hjälper.',
    'Vi försöker få ihop dagen. Hur går det för dig?',
  ],
  oförskämt: ['Det där var onödigt. Vi kan prata när du har en bättre ton.'],
  inbjudanFörTidigt: ['Kanske senare. Vi får lära känna varandra lite först.'],
  kaffe: [
    'Gärna! Vi tar en kaffe i entrén.',
    'Ja, det behövs. Kaffe på mig den här gången.',
    'Perfekt timing, jag behövde en paus.',
  ],
  kaffeIgen: ['Vi tog ju redan en kaffe idag. Imorgon igen?'],
  // Vad personen säger om det hen håller på med just nu (från schemat).
  aktivitet: {
    föreläsning: [
      'Shh, föreläsning pågår. Vi pratar efteråt!',
      'Jag försöker hänga med i föreläsningen.',
    ],
    pluggar: ['Jag pluggar inför tentan. Hjärnan går på högvarv.', 'Pluggar. Eller ja, försöker.'],
    lunch: ['Lunch! Det bästa på hela dagen.', 'Dagens rätt var faktiskt god idag.'],
    tränar: ['Mitt i ett set! Ge mig en minut.', 'Bra pass idag. Känns i hela kroppen.'],
    fest: ['Vilken kväll! Kom och dansa!', 'Musiken är för bra ikväll.'],
    jobbar: ['Jobbar lite extra idag, pengarna behövs.'],
    paus: ['Tar en paus i solen.', 'Bara andas lite mellan föreläsningarna.'],
    promenerar: ['Är på väg någonstans. Ses!'],
  },
  // Svar på "Vet du var X är?"
  varÄr: {
    vet: [
      '{namn} är {plats} och {aktivitet}.',
      'Senast jag såg {namn} var hen {plats}, {aktivitet}.',
    ],
    hemma: ['{namn} är hemma nu, tror jag.', 'Hen har nog gått hem för idag.'],
  },
  // Korta hälsningar när du går förbi någon du känner.
  förbi: {
    vän: ['Hej {jag}!', 'Tja {jag}!', '{jag}! Läget?'],
    bekant: ['Hej!', 'Tjena.'],
  },
  // Småprat som personer säger till varandra när de står tillsammans.
  småprat: [
    'Har du gjort labbrapporten?',
    'Ses vi på Filicia på fredag?',
    'Den här kaffen är för stark.',
    'Jag har tenta på måndag, hjälp.',
    'Snyggt väder idag i alla fall.',
    'Vem tog sista kanelbullen?',
  ],

  // ---- Levande vardag (js/game/life.js) ----
  // Används när servern inte har någon AI. Med AI skriver Haiku nya rader varje speldag.
  // Vad en person går och tänker på idag, efter humör. {aktivitet} är något hen ska göra idag.
  tanke: {
    glad: [
      'Idag känns bra. Jag ska {aktivitet} och sedan bara ta det lugnt.',
      'Jag har faktiskt koll på läget för en gångs skull.',
      'Jag vaknade utvilad. Det händer inte ofta.',
    ],
    trött: [
      'Jag sov för lite. Bara {aktivitet} och sedan hem.',
      'Kaffe. Jag behöver kaffe innan jag kan tänka.',
      'Den här veckan är lång.',
    ],
    nere: [
      'Inte min bästa dag. Jag orkar knappt {aktivitet}.',
      'Allt känns lite tungt idag.',
    ],
    tenta: ['Tentan ligger och gnager i bakhuvudet hela tiden.', 'Jag borde plugga mer än jag gör.'],
    fest: ['Ikväll blir det fest, det har jag väntat på hela veckan.'],
  },
  // Korta samtal mellan två personer som ses. Raderna växlar: a, b, a, b.
  // {a} och {b} är deras förnamn, {jag} ditt namn och {ämne} något a gillar.
  samtal: {
    vänner: [
      ['Har du hunnit med {ämne} något idag?', 'Nej, jag har inte haft tid. Du då?', 'Lite. Vi kan köra ihop sen.'],
      ['Kommer du till Filicia på fredag?', 'Kanske, om jag hinner bli klar med labben.', 'Du säger alltid så.', 'Och jag kommer alltid. Till slut.'],
      ['Lunch sen?', 'Absolut. Vad är dagens?', 'Ingen aning, men det är lunch.'],
    ],
    osams: [
      ['Jaha. Hej.', 'Hej.', 'Vi kanske borde prata någon gång.', 'Kanske.'],
      ['Du vet vad du gjorde.', 'Kan vi inte bara släppa det?'],
    ],
    omDig: [
      ['Har du pratat med {jag} något?', 'Lite. Verkar schysst faktiskt.', 'Ja, tycker jag med.'],
      ['Var {jag} inte med på festen?', 'Nej, jag såg hen inte där.', 'Synd. Nästa gång.'],
    ],
  },
  // När en vän vill prata med dig och ropar.
  ropar: ['{jag}! Har du en sekund?', 'Hej {jag}, kom hit!', '{jag}! Vänta lite.'],
};

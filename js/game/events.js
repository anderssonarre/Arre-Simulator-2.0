// Händelser som kan dyka upp när du vaknar på morgonen
'use strict';
// Varje händelse:
//   id         unikt namn, sparas när händelsen har visats
//   who        person som är med (händelsen hoppas över om du spelar som hen)
//   minTerm    tidigaste terminen den kan hända
//   repeat     true om den kan hända flera gånger
//   when()     extra villkor, valfritt
//   choices    knappar: label, run() och valfritt need() som måste vara sant för att knappen ska gå att välja
const events = [
  {
    id: 'studiestod',
    repeat: true,
    title: 'Studiestödet kom',
    body: 'Pengarna från FPA har kommit in på kontot.',
    choices: [{ label: 'Härligt! · +40 €', run: () => (state.money += 40) }],
  },
  {
    id: 'lunchkampanj',
    repeat: true,
    title: 'Halva priset på lunchen',
    body: 'Restaurangen i W33 har kampanj. Lunchen kostar bara 4 € idag.',
    choices: [{ label: 'Bra att veta', run: () => (state.cheapLunchDay = state.day) }],
  },
  {
    id: 'ossi-dubbel',
    who: 'ossi',
    repeat: true,
    title: 'Ossi ringer',
    body: '”Jag har brist på folk idag. Gör du ett pass får du dubbel lön.”',
    choices: [
      {
        label: 'Jag kommer! · dubbel lön idag',
        run: () => {
          state.doubleJobDay = state.day;
          bump('ossi', 3);
        },
      },
      { label: 'Inte idag', run: () => {} },
    ],
  },
  {
    id: 'regn',
    repeat: true,
    title: 'Ösregn över Vasa',
    body: 'Det öser ner från en grå himmel. Inte direkt en dag för promenader.',
    choices: [{ label: 'Fram med regnjackan · −5 glädje', run: () => gain('happy', -5) }],
  },
  {
    id: 'punktering',
    title: 'Punktering',
    body: 'Cykeln har fått punktering. Laga den eller gå till campus.',
    choices: [
      { label: 'Laga den · −15 €', need: () => state.money >= 15, run: () => (state.money -= 15) },
      { label: 'Gå i stället · −15 energi', run: () => gain('energy', -15) },
    ],
  },
  {
    id: 'kaffe-entren',
    who: 'lumberjack',
    title: 'Gratis kaffe',
    body: 'Lumberjack har fixat gratis kaffe i entrén till alla som kommer tidigt.',
    choices: [
      {
        label: 'Ta en kopp · +10 energi',
        run: () => {
          gain('energy', 10);
          bump('lumberjack', 4);
        },
      },
    ],
  },
  {
    id: 'albin-morgonpass',
    who: 'albin',
    title: 'Albin vill träna',
    body: '”Morgonpass innan föreläsningen? Det blir kort, jag lovar.”',
    choices: [
      {
        label: 'Kör! · +12 glädje, −10 energi',
        run: () => {
          gain('happy', 12);
          gain('energy', -10);
          bump('albin', 6);
        },
      },
      { label: 'Sov vidare · +10 energi', run: () => gain('energy', 10) },
    ],
  },
  {
    id: 'rasmus-losningar',
    who: 'rasmus',
    when: () => !state.courses[1].pass && state.courses[1].study < 2 && !state.courses[1].retake,
    title: 'Rasmus har räknat i förväg',
    body: () => 'Rasmus skickar sina lösningar i ' + course(1).name + '. Vill du gå igenom dem?',
    choices: [
      {
        label: 'Gå igenom dem · +1 studiepass',
        run: () => {
          state.courses[1].study++;
          advance(30);
          bump('rasmus', 5);
        },
      },
      { label: 'Jag vill lösa dem själv', run: () => gain('happy', 3) },
    ],
  },
  {
    id: 'axel-fest',
    who: 'axel',
    minTerm: 2,
    title: 'Axel har planer',
    body: '”Fest på Filicia Castle ikväll! Alla kommer.” Tentorna närmar sig, men det låter kul.',
    choices: [
      {
        label: 'Följ med · +20 glädje, −30 energi',
        run: () => {
          gain('happy', 20);
          gain('energy', -30);
          bump('axel', 8);
        },
      },
      {
        label: 'Stanna hemma · +15 energi',
        run: () => {
          gain('energy', 15);
          bump('axel', -3);
        },
      },
    ],
  },
  {
    id: 'ida-grupparbete',
    who: 'ida',
    minTerm: 2,
    title: 'Grupparbete',
    body: 'Ida undrar om du vill leda ert grupparbete den här terminen.',
    choices: [
      {
        label: 'Ta ledningen · +10 glädje, −15 energi',
        run: () => {
          gain('happy', 10);
          gain('energy', -15);
          bump('ida', 10);
        },
      },
      { label: 'Låt Ida leda', run: () => bump('ida', 3) },
    ],
  },
  {
    id: 'niklas-abonnemang',
    who: 'niklas',
    minTerm: 3,
    title: 'Niklas har ett tips',
    body: 'Niklas har hittat ett billigare mobilabonnemang åt dig.',
    choices: [
      {
        label: 'Byt · +20 €',
        run: () => {
          state.money += 20;
          bump('niklas', 5);
        },
      },
    ],
  },
  {
    id: 'mats-forelasning',
    who: 'mats',
    minTerm: 3,
    title: 'Gästföreläsning',
    body: 'Mats Borg bjuder in till en föreläsning om bergvärme och energilager i Vasa.',
    choices: [
      {
        label: 'Gå dit · +10 glädje, 1 timme',
        run: () => {
          gain('happy', 10);
          advance(60);
          bump('mats', 8);
        },
      },
      { label: 'Hoppa över', run: () => {} },
    ],
  },
  {
    id: 'tentaangest',
    minTerm: 4,
    title: 'Allt på en gång',
    body: 'Det känns som att hela terminen kommer samtidigt. Hur tar du dig an dagen?',
    choices: [
      {
        label: 'Promenad längs stranden · +12 glädje',
        run: () => {
          gain('happy', 12);
          advance(45);
        },
      },
      { label: 'Bita ihop · −8 glädje', run: () => gain('happy', -8) },
    ],
  },
  {
    id: 'praktik',
    minTerm: 6,
    title: 'Praktikerbjudande',
    body: 'Ett företag i Vasa söker praktikanter till sommaren och vill träffa dig på en kort intervju.',
    choices: [
      {
        label: 'Gå på intervjun · +15 glädje, −10 energi',
        run: () => {
          gain('happy', 15);
          gain('energy', -10);
          advance(60);
        },
      },
      { label: 'Fokusera på studierna', run: () => {} },
    ],
  },
];
// Visar en slumpad händelse som passar just nu. chance styr hur ofta något händer.
function morningEvent(chance = 0.5) {
  if (Math.random() > chance) return;
  state.seenEvents ??= [];
  const list = events.filter(
    (e) =>
      (e.repeat || !state.seenEvents.includes(e.id)) &&
      (e.minTerm || 1) <= state.term &&
      e.who !== state.character &&
      (!e.when || e.when()),
  );
  if (!list.length) return;
  const e = rand(list);
  if (!e.repeat) state.seenEvents.push(e.id);
  save();
  dialog(
    e.title,
    '<p>' + esc(typeof e.body === 'function' ? e.body() : e.body) + '</p>',
    e.choices.map((c, n) => ({
      label: c.label,
      primary: n === 0,
      disabled: c.need && !c.need(),
      run: () => {
        c.run();
        close();
        updateHUD();
        save();
      },
    })),
    'Händelse',
  );
}

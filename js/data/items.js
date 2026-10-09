// VÄSKA, BUTIKER OCH TILLSTÅND · innehållsfil
// Saker man kan köpa, bära med sig i väskan och använda när man vill. Se js/game/inventory.js
// och js/game/conditions.js.
//
// Varor (VAROR):
//   namn, ikon      vad som visas i väskan
//   pris            € i butiken
//   effekt          samma effekter som i events.js: mättnad, glädje, energi
//   tillstånd       ändrar tillstånden: berusning, illamående, koncentration (tal som läggs till)
//   text            vad som står när man använder den
//   mat             true om den räknas som mat (går inte att äta när man mår illa)
//   bjuda           vad personen säger när man bjuder på den
const VAROR = {
  vatten: {
    namn: 'Vattenflaska',
    ikon: '💧',
    pris: 1,
    effekt: { energi: 2 },
    tillstånd: { berusning: -8, illamående: -15, koncentration: 6 },
    text: 'Kallt vatten. Huvudet klarnar lite.',
    bjuda: 'Tack, man glömmer att dricka.',
  },
  smörgås: {
    namn: 'Smörgås',
    ikon: '🥪',
    pris: 4,
    mat: true,
    effekt: { mättnad: 30 },
    tillstånd: { illamående: -5, koncentration: 4 },
    text: 'Ost och gurka. Det håller ett tag.',
    bjuda: 'Åh, du räddade min eftermiddag.',
  },
  pirog: {
    namn: 'Karelsk pirog',
    ikon: '🥟',
    pris: 2,
    mat: true,
    effekt: { mättnad: 18 },
    tillstånd: { koncentration: 3 },
    text: 'Med äggsmör, så klart.',
    bjuda: 'Karjalanpiirakka! Tack!',
  },
  choklad: {
    namn: 'Chokladkaka',
    ikon: '🍫',
    pris: 2,
    mat: true,
    effekt: { glädje: 6, mättnad: 6 },
    tillstånd: { koncentration: 6, illamående: 6 },
    text: 'Socker rakt in i blodet.',
    bjuda: 'Choklad löser det mesta.',
  },
  salmiak: {
    namn: 'Salmiakpåse',
    ikon: '🖤',
    pris: 2,
    mat: true,
    effekt: { glädje: 5 },
    tillstånd: { illamående: 5 },
    text: 'Salt, svart och omöjligt att sluta äta.',
    bjuda: 'Salmiak! Du förstår mig.',
  },
  öl: {
    namn: 'Öl',
    ikon: '🍺',
    pris: 6,
    effekt: { glädje: 5 },
    tillstånd: { berusning: 20, koncentration: -12 },
    text: 'Skål!',
    bjuda: 'Skål! Den här tar jag gärna.',
  },
};

// Butiker. Varje butik är en plats i ett hus, öppen vissa tider (efter midnatt räknas som 24, 25 ...).
const BUTIKER = {
  kiosk: {
    namn: 'Kiosken i W33',
    värld: 'w33',
    x: 20.5,
    y: 18.5,
    varor: ['vatten', 'smörgås', 'pirog', 'choklad', 'salmiak'],
    öppet: { från: 8, till: 18 },
  },
  bar: {
    namn: 'Baren på Filicia Castle',
    värld: 'w33',
    x: 39.5,
    y: 13.5,
    varor: ['öl', 'vatten'],
    öppet: { från: 16, till: 26 },
  },
};

// Väskan rymmer så här många saker sammanlagt.
const VÄSKA = { platser: 10 };

// Tillstånd. Alla går från 0 till 100.
//   avtar    så mycket som försvinner per spelad timme
//   gränser  när ett tillstånd märks, och vad det heter då
const TILLSTÅND = {
  berusning: {
    avtar: 12,
    gränser: [
      { från: 15, namn: 'Salongsberusad', ikon: '🍺' },
      { från: 45, namn: 'Full', ikon: '🍺' },
      { från: 80, namn: 'Väldigt full', ikon: '🥴' },
    ],
    däckarVid: 95, // då somnar man och vaknar hemma
    bakfyllaFrån: 45, // den som varit så här full får bakfylla när ruset gått över
    bakfylla: 45, // så mycket illamående bakfyllan ger
  },
  illamående: {
    avtar: 14,
    gränser: [
      { från: 35, namn: 'Illamående', ikon: '🤢' },
      { från: 70, namn: 'Mår riktigt dåligt', ikon: '🤢' },
    ],
    // Så här full blir man illamående av, per timme.
    avBerusningÖver: 70,
  },
  koncentration: {
    // Koncentrationen glider tillbaka mot normalläget med så här mycket per timme.
    normal: 50,
    glider: 8,
    gränser: [
      { till: 25, namn: 'Ofokuserad', ikon: '💭' },
      { från: 70, namn: 'Fokuserad', ikon: '🎯' },
    ],
    efterSömn: 65, // koncentrationen efter en hel natts sömn
  },
};

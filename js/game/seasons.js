// Fas 7: campusåret. Ett studieår är 112 speldagar och börjar i september.
// Årstiden styr när solen går upp och ner (som i Vasa), väder, snö och studentlivets evenemang.
'use strict';
const YEAR = {
  dagar: 112,
  månader: [
    'september',
    'oktober',
    'november',
    'december',
    'januari',
    'februari',
    'mars',
    'april',
    'maj',
    'juni',
    'juli',
    'augusti',
  ],
  // Soluppgång och solnedgång i Vasa per månad, ungefär (finsk tid).
  sol: [
    [7, 20.5],
    [8, 18.5],
    [8.8, 16.3],
    [9.8, 15.2],
    [9.5, 15.8],
    [8.3, 17.5],
    [6.8, 18.8],
    [6, 20.8],
    [4.6, 22.2],
    [3.8, 23.2],
    [4.2, 22.8],
    [5.6, 21.3],
  ],
  // Chans för regn/snö och moln per månad.
  nederbörd: [0.35, 0.45, 0.5, 0.45, 0.4, 0.35, 0.3, 0.3, 0.25, 0.25, 0.3, 0.35],
};
function yearDay(day = state?.day ?? 1) {
  return (((day - 1) % YEAR.dagar) + YEAR.dagar) % YEAR.dagar;
}
function monthIndex(day = state?.day ?? 1) {
  return Math.min(11, Math.floor((yearDay(day) / YEAR.dagar) * 12));
}
// "3 oktober"
function dateText(day = state?.day ?? 1) {
  if (isVappen(day)) return yearDay(day) === vappenStart() ? '30 april' : '1 maj';
  const perMonth = YEAR.dagar / 12,
    yd = yearDay(day),
    m = monthIndex(day);
  return Math.floor(((yd - m * perMonth) / perMonth) * 30) + 1 + ' ' + YEAR.månader[m];
}
function seasonName(day = state?.day ?? 1) {
  const m = monthIndex(day);
  return m <= 2 ? 'höst' : m <= 5 ? 'vinter' : m <= 8 ? 'vår' : 'sommar';
}
// Snö ligger december till mars (och lite i slutet av november).
function snowCover(day = state?.day ?? 1) {
  const m = monthIndex(day),
    yd = yearDay(day);
  if (m >= 3 && m <= 6) return 1;
  if (m === 2 && yd > YEAR.dagar * 0.22) return 0.5;
  if (m === 7) return 0.3;
  return 0;
}
// Höstlöv: grönt till gult och orange i oktober–november, kala träd på vintern.
function foliage(day = state?.day ?? 1) {
  const m = monthIndex(day);
  return m === 0 ? 'grön' : m <= 2 ? 'höst' : m <= 7 ? 'kal' : 'grön';
}
function sunTimes(day = state?.day ?? 1) {
  const [up, down] = YEAR.sol[monthIndex(day)];
  return { up, down };
}
// Hur ljust det är ute (0 natt, 1 dag) vid ett klockslag.
function daylight(hour, day = state?.day ?? 1) {
  const { up, down } = sunTimes(day),
    fade = 1.2;
  if (hour < up - fade / 2 || hour > down + fade / 2) return 0;
  if (hour < up + fade / 2) return (hour - (up - fade / 2)) / fade;
  if (hour > down - fade / 2) return (down + fade / 2 - hour) / fade;
  return 1;
}
// Dagens väder, samma för alla som spelar samma dag.
function weather(day = state?.day ?? 1) {
  const r = seeded(day * 7351 + 11),
    m = monthIndex(day),
    wet = r() < YEAR.nederbörd[m],
    cloudy = wet || r() < 0.4,
    cold = m >= 2 && m <= 6;
  return {
    kind: wet ? (cold && m !== 2 && m !== 6 ? 'snö' : 'regn') : cloudy ? 'mulet' : 'klart',
    clouds: wet ? 0.85 : cloudy ? 0.55 : 0.1,
  };
}
function weatherText() {
  const w = weather();
  return { klart: 'klart', mulet: 'mulet', regn: 'regn', snö: 'snöfall' }[w.kind];
}

// ---- Studentlivets kalender ----
// Varje fyraveckorsperiod: sitz torsdagen i vecka 2, tentavecka i vecka 4. Vappen 30.4–1.5.
function blockWeek(day = state?.day ?? 1) {
  return Math.floor(((((day - 1) % 28) + 28) % 28) / 7) + 1;
}
function isExamWeek(day = state?.day ?? 1) {
  return blockWeek(day) === 4;
}
function isSitzDay(day = state?.day ?? 1) {
  return blockWeek(day) === 2 && weekday(day) === 'tor';
}
function vappenStart() {
  return Math.round(YEAR.dagar * (7 / 12 + 29 / 30 / 12)); // runt 30 april
}
function isVappen(day = state?.day ?? 1) {
  const yd = yearDay(day);
  return yd === vappenStart() || yd === vappenStart() + 1;
}
function seasonHud() {
  return dateText() + (isExamWeek() ? ' · tentavecka' : isVappen() ? ' · vappen!' : '');
}
// Overallmärken man samlar på evenemang.
function addBadge(name) {
  state.marken ??= [];
  if (state.marken.includes(name)) return false;
  state.marken.push(name);
  setTimeout(() => toast('Nytt overallmärke: ' + name + '!'), 600);
  return true;
}

// ---- Sitz och vappen ----
function sitzPrompt() {
  const price = 15,
    overall = state.outfit === 'overall';
  dialog(
    'Sitz på Filicia Castle',
    '<p>Långbord, sånghäften och trerättersmiddag. Kvällens toastmaster slår i bordet och alla sjunger.</p><div class="info">Biljett ' +
      price +
      ' € · +30 glädje · socialt +' +
      XP.fest * 3 +
      ' XP' +
      (overall ? ' · overallen ger +5 glädje' : ' · tips: kom i overall') +
      '</div>',
    [
      {
        label: state.sitzDay === state.day ? 'Du är redan på sitzen' : 'Köp biljett och sitt ner',
        primary: true,
        disabled: state.sitzDay === state.day || state.money < price,
        run: () => {
          state.money -= price;
          state.sitzDay = state.day;
          reportHappening('sitz');
          gain('happy', 30 + (overall ? 5 : 0));
          gain('hunger', 50);
          gain('energy', -10);
          addXp('socialt', XP.fest * 3);
          for (const id of witnessesHere(16)) bump(id, 3);
          advance(120);
          addBadge('Sitz');
          addRumor('fest', {}, witnessesHere(16));
          party = true;
          close();
          save();
          sound('win');
          toast('Skål! Sitzen var en succé.');
        },
      },
      { label: 'Inte ikväll', run: close },
    ],
    'Sitz',
  );
}
// Kallas när du går ut på vappen: picknick för hela campus.
function vappenCheck() {
  if (!isVappen() || world?.id !== 'outdoor' || state.vappenDay === state.day) return;
  if (state.hour < 10 || state.hour > 22) return;
  state.vappenDay = state.day;
  gain('happy', 25);
  addXp('socialt', XP.fest * 2);
  addBadge('Vappen ' + (Math.floor((state.day - 1) / YEAR.dagar) + 1));
  setTimeout(() => toast('Glad vappen! Hela campus har picknick i studentmössa. +25 glädje'), 300);
}

// Kalender: veckodagar, föreläsningar på fasta tider och veckoschemat.
'use strict';
const WEEKDAYS = ['mån', 'tis', 'ons', 'tor', 'fre', 'lör', 'sön'];
const WEEKDAY_NAMES = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
// Dag 1 är en måndag.
function weekday(day) {
  return WEEKDAYS[(((day - 1) % 7) + 7) % 7];
}
function weekdayIndex(day) {
  return (((day - 1) % 7) + 7) % 7;
}
function isWeekend(day) {
  return weekdayIndex(day) >= 5;
}
function clockText(hour) {
  const h = Math.floor(hour),
    m = Math.floor((hour - h) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
function capital(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
// Föreläsningar per kurs (0 = W33, 1 och 2 = Technobothnia). Samma tider varje termin.
const LECTURES = [
  [
    { dag: 'mån', från: 9, till: 11 },
    { dag: 'ons', från: 13, till: 15 },
  ],
  [
    { dag: 'tis', från: 9, till: 11 },
    { dag: 'tor', från: 9, till: 11 },
  ],
  [
    { dag: 'ons', från: 9, till: 11 },
    { dag: 'fre', från: 10, till: 12 },
  ],
];
const LECTURE_ROOM = [
  { world: 'w33', name: 'W33' },
  { world: 'tech', name: 'Technobothnia' },
  { world: 'tech', name: 'Technobothnia' },
];
// Pågående föreläsning i kurs i just nu, eller null.
function lectureNow(i, day = state.day, hour = state.hour) {
  return LECTURES[i].find((l) => l.dag === weekday(day) && hour >= l.från && hour < l.till) || null;
}
// Nästa föreläsning i kurs i, som text ("tis 09–11").
function nextLecture(i) {
  for (let d = 0; d < 8; d++) {
    const day = state.day + d;
    for (const l of LECTURES[i])
      if (l.dag === weekday(day) && (d > 0 || state.hour < l.till))
        return {
          day,
          ...l,
          text: (d === 0 ? 'idag' : d === 1 ? 'imorgon' : l.dag) + ' ' + l.från + '–' + l.till,
        };
  }
  return null;
}
function attendLecture(i) {
  const l = lectureNow(i),
    c = state.courses[i],
    cs = course(i);
  if (!l) {
    const n = nextLecture(i);
    return toast(
      'Ingen föreläsning i ' + cs.name + ' just nu. Nästa: ' + (n ? n.text : 'nästa vecka') + '.',
    );
  }
  if (c.pass)
    return toast('Du har redan klarat ' + cs.name + '. Föreläsningen är för de andra nu.');
  const key = state.day + ':' + i;
  state.lecturesSeen ??= {};
  if (state.lecturesSeen[key]) return toast('Du har redan varit på dagens föreläsning.');
  state.lecturesSeen[key] = true;
  // Föreläsningen räknas som ett studiepass med alla anteckningar och kostar mindre energi.
  const pass = !c.pass && c.study < 2;
  if (pass) {
    c.study = c.retake ? 2 : c.study + 1;
    delete c.retake;
  }
  c.lectures = (c.lectures || 0) + 1;
  tutorialDone('föreläsning');
  addXp(courseSkill(i), XP.föreläsning);
  const minutes = Math.max(20, Math.round((l.till - state.hour) * 60));
  advance(minutes);
  gain('energy', -5);
  gain('happy', 2);
  // Kurskamrater som också sitter där blir lite bättre vänner.
  const mates = world.objects.filter(
    (o) => o.profile && o.activity === 'föreläsning' && o.lecture === i,
  );
  for (const o of mates) bump(o.profile.id, 2);
  dialog(
    'Föreläsning · ' + cs.name,
    '<p>Du satt med hela föreläsningen' +
      (mates.length
        ? ' tillsammans med ' + mates.map((o) => o.profile.name.split(' ')[0]).join(', ')
        : '') +
      '.</p><p>Läraren gick igenom:</p>' +
      tipList(cs, [0, 1, 2, 3, 4]) +
      '<p class="sub">' +
      (pass ? 'Räknas som ett studiepass. ' : '') +
      'Höjer betyget på tentan. ' +
      SKILLS[courseSkill(i)].namn +
      ' +' +
      XP.föreläsning +
      ' XP · energi −5' +
      (mates.length ? ' · relation +2 med kurskamraterna' : '') +
      '</p>',
    [{ label: 'Klar', primary: true, run: close }],
    'Föreläsning',
  );
  sound('win');
  save();
}
// Veckoschemat i menyn.
function showWeek() {
  const rows = [];
  for (let d = 0; d < 7; d++) {
    const day = state.day - weekdayIndex(state.day) + d,
      items = [];
    LECTURES.forEach((ls, i) =>
      ls
        .filter((l) => l.dag === WEEKDAYS[d])
        .forEach((l) =>
          items.push([l.från, course(i).name + ' · ' + LECTURE_ROOM[i].name, 'Föreläsning']),
        ),
    );
    if (d === 4) items.push([20, 'Fredagsfest för alla online · Filicia Castle', 'Fest']);
    if (d === 5) items.push([20, 'Filicia Castle · W33', 'Fest']);
    items.sort((a, b) => a[0] - b[0]);
    rows.push(
      '<div class="course' +
        (day === state.day ? ' today' : '') +
        '"><span><strong>' +
        WEEKDAY_NAMES[d] +
        (day === state.day ? ' · idag' : '') +
        '</strong><br><small style="color:var(--muted)">' +
        (items.length ? items.map((it) => it[0] + ':00 ' + esc(it[1])).join('<br>') : 'Ledigt') +
        '</small></span><span class="badge">' +
        (items.length ? items.length + (items.length === 1 ? ' sak' : ' saker') : 'Fri dag') +
        '</span></div>',
    );
  }
  dialog(
    'Veckoschema',
    '<p>Vecka ' +
      (Math.floor((state.day - 1) / 7) + 1) +
      ', termin ' +
      state.term +
      '. Föreläsningar räknas som studiepass och ger alla anteckningar. Kurskamraterna sitter också där.</p>' +
      rows.join(''),
    [{ label: 'Tillbaka', primary: true, run: menu }],
    'Kalender',
  );
}
// Lägger till en föreläsningssal bredvid en kurs studieplats.
function lectureSpot(w, i, x, y) {
  const o = station(w, x, y, 'study', 'Föreläsning', () => attendLecture(i));
  o.lectureIndex = i;
  return o;
}
// Uppdaterar skyltarna så att de visar kursnamn och om föreläsningen pågår.
function updateLectureLabels() {
  if (!state || !world) return;
  for (const o of world.objects) {
    if (o.courseIndex != null) {
      const c = state.courses[o.courseIndex];
      o.label =
        (o.type === 'exam' ? 'Tenta · ' : 'Studera · ') +
        course(o.courseIndex).name +
        (c.pass ? ' · klar' : o.type === 'exam' && c.study < 2 ? ' · plugga först' : '');
    }
    if (o.lectureIndex != null) {
      const i = o.lectureIndex,
        now = lectureNow(i),
        n = nextLecture(i);
      o.label = 'Föreläsning · ' + course(i).name + (now ? ' · pågår nu' : n ? ' · ' + n.text : '');
    }
  }
}

// Fas 9: framtiden. Praktik, examensarbete, karriärval, olika slut och nytt liv med arv.
'use strict';
const LEGACY_KEY = 'arre_simulator_2_legacy';
function ensureCareer() {
  state.career ??= { applied: [], praktik: null, done: [], thesis: null, ending: null };
}
function company(id) {
  return CAREER.företag.find((c) => c.id === id);
}
function meetsReq(c) {
  return (
    state.term >= c.frånTermin &&
    skillLevel(c.färdighet) >= c.nivå &&
    (c.snitt === 0 || gradeAverage() >= c.snitt)
  );
}

// ---- Praktik ----
function careerOverview() {
  ensureCareer();
  const k = state.career,
    pr = k.praktik ? company(k.praktik.id) : null;
  dialog(
    'Framtiden',
    '<div class="info">' +
      (pr
        ? '<strong>Praktik pågår:</strong> ' +
          esc(pr.namn) +
          ', ' +
          k.praktik.weeksLeft +
          ' veckor kvar. ' +
          CAREER.praktikLön +
          ' € i veckan.'
        : k.done.length
          ? '<strong>Gjord praktik:</strong> ' +
            k.done.map((id) => esc(company(id).namn)).join(', ')
          : 'Ingen praktik än. Praktikplatser finns från termin 3, fråga Ossi eller se listan nedan.') +
      '<br><strong>Examensarbete:</strong> ' +
      (k.thesis
        ? k.thesis.grade
          ? 'klart, betyg ' + k.thesis.grade
          : k.thesis.sessions +
            ' / ' +
            CAREER.examensarbete.pass +
            ' skrivpass hos ' +
            esc(company(k.thesis.company).namn)
        : 'börjar tidigast termin ' + CAREER.examensarbete.frånTermin + ', vid skrivbordet hemma') +
      '</div>',
    [
      { label: 'Praktikplatser', primary: !pr, run: internshipBoard },
      { label: 'Tillbaka', run: menu },
    ],
    'Karriär',
  );
}
function internshipBoard() {
  ensureCareer();
  const k = state.career;
  dialog(
    'Praktikplatser i Vasa',
    '<p>Platserna kräver en viss färdighet, ibland ett betygssnitt. Ansökan har en kort intervjufråga.</p>' +
      CAREER.företag
        .map(
          (c) =>
            '<div class="course"><span><strong>' +
            esc(c.namn) +
            '</strong> · ' +
            esc(c.bransch) +
            '<br><small style="color:var(--muted)">' +
            SKILLS[c.färdighet].namn +
            ' nivå ' +
            c.nivå +
            (c.snitt ? ', snitt ' + String(c.snitt).replace('.', ',') : '') +
            ', från termin ' +
            c.frånTermin +
            '</small></span><span class="badge">' +
            (k.done.includes(c.id)
              ? 'Gjord'
              : k.praktik?.id === c.id
                ? 'Pågår'
                : k.applied.some((a) => a.id === c.id)
                  ? 'Ansökt'
                  : meetsReq(c)
                    ? 'Kan sökas'
                    : 'Krav saknas') +
            '</span></div>',
        )
        .join(''),
    [
      ...CAREER.företag
        .filter(
          (c) =>
            meetsReq(c) &&
            !k.done.includes(c.id) &&
            k.praktik?.id !== c.id &&
            !k.applied.some((a) => a.id === c.id),
        )
        .map((c) => ({ label: 'Sök till ' + c.namn, run: () => interview(c) })),
      { label: 'Tillbaka', primary: true, run: careerOverview },
    ],
    'Karriär',
  );
}
function interview(c) {
  quiz(
    'Intervju hos ' + c.namn,
    c.fråga[0],
    c.fråga.slice(1),
    () => apply(c, true),
    () => apply(c, false),
    'Intervju',
  );
}
function apply(c, good) {
  state.career.applied.push({ id: c.id, day: state.day, good });
  advance(45);
  save();
  dialog(
    good ? 'Intervjun gick bra' : 'Intervjun gick sådär',
    '<p>' +
      (good
        ? 'De nickade mycket och lovade att höra av sig om ett par dagar.'
        : 'Du svarade fel på deras fråga, men de sa att de ska fundera.') +
      '</p>',
    [{ label: 'Spännande', primary: true, run: close }],
    'Intervju',
  );
}
// En gång per dag: svar på ansökningar.
function careerDay() {
  ensureCareer();
  const k = state.career;
  for (const a of [...k.applied]) {
    if (state.day - a.day < 2) continue;
    k.applied = k.applied.filter((x) => x !== a);
    const c = company(a.id),
      yes = a.good || Math.random() < 0.35;
    k.inbox = { id: c.id, yes };
  }
}
function careerTick() {
  const k = state?.career;
  if (!k?.inbox || modal || !active || job || sleeping) return;
  const { id, yes } = k.inbox,
    c = company(id);
  k.inbox = null;
  if (!yes) {
    toast(
      c.namn + ' valde någon annan den här gången. Sök igen senare eller till ett annat företag.',
    );
    return;
  }
  dialog(
    'Praktikerbjudande!',
    '<p>' +
      esc(c.namn) +
      ' vill ha dig som praktikant i ' +
      CAREER.praktikVeckor +
      ' veckor. Du får ' +
      CAREER.praktikLön +
      ' € i veckan och lär dig mycket om ' +
      esc(c.bransch) +
      '.</p>',
    [
      {
        label: 'Tacka ja',
        primary: true,
        disabled: !!k.praktik,
        run: () => {
          k.praktik = { id, weeksLeft: CAREER.praktikVeckor };
          addRumor('praktik', { företag: c.namn });
          reportHappening('praktik', { företag: c.namn });
          close();
          save();
          toast('Grattis! Praktiken hos ' + c.namn + ' börjar nu.');
        },
      },
      { label: k.praktik ? 'Du har redan en praktik' : 'Tacka nej', run: close },
    ],
    'Karriär',
  );
}
// Varje måndag under praktiken: lön och erfarenhet.
function careerWeek() {
  const k = state.career;
  if (!k?.praktik) return;
  const c = company(k.praktik.id);
  state.money += CAREER.praktikLön;
  ledger('Praktiklön, ' + c.namn, CAREER.praktikLön);
  addXp(c.färdighet, 20);
  addXp('arbetsvana', 15);
  k.praktik.weeksLeft--;
  if (k.praktik.weeksLeft <= 0) {
    k.done.push(c.id);
    k.praktik = null;
    setTimeout(() => toast('Praktiken hos ' + c.namn + ' är klar. Den syns i ditt CV.'), 1500);
  }
}

// ---- Examensarbetet ----
function thesisDesk() {
  ensureCareer();
  const k = state.career,
    E = CAREER.examensarbete;
  if (!k.thesis) {
    const options = CAREER.företag
      .filter((c) => k.done.includes(c.id))
      .concat(CAREER.företag.filter((c) => !k.done.includes(c.id)).slice(0, 2));
    return dialog(
      'Examensarbete',
      '<p>Välj ett företag att skriva examensarbetet åt. Har du gjort praktik där blir det lättare.</p>',
      [
        ...options.map((c) => ({
          label: c.namn + (k.done.includes(c.id) ? ' · gjort praktik här' : '') + ' · ' + c.bransch,
          run: () => {
            k.thesis = { company: c.id, sessions: 0, quality: 0 };
            save();
            thesisDesk();
          },
        })),
        { label: 'Tillbaka', run: close },
      ],
      'Examensarbete',
    );
  }
  if (k.thesis.grade) return showCourses();
  const c = company(k.thesis.company);
  dialog(
    'Examensarbete hos ' + c.namn,
    '<p>' +
      k.thesis.sessions +
      ' av ' +
      E.pass +
      ' skrivpass klara. Bra energi och hög ' +
      SKILLS[c.färdighet].namn.toLowerCase() +
      ' gör passen bättre.</p>',
    [
      k.thesis.sessions < E.pass
        ? {
            label: 'Skriv ett pass · 90 minuter',
            primary: true,
            disabled: state.stats.energy < 20,
            run: () => {
              const q =
                0.4 +
                skillLevel(c.färdighet) * 0.12 +
                (state.stats.energy > 60 ? 0.2 : 0) +
                (k.done.includes(c.id) ? 0.25 : 0);
              k.thesis.quality += q;
              k.thesis.sessions++;
              advance(90);
              gain('energy', -15);
              addXp(c.färdighet, 10);
              save();
              thesisDesk();
              toast('Ett pass till på examensarbetet.');
            },
          }
        : {
            label: 'Presentera examensarbetet',
            primary: true,
            run: () => {
              const avg = k.thesis.quality / E.pass,
                grade = clamp(Math.round(avg * 2.6), 1, 5);
              k.thesis.grade = grade;
              state.transcript.push({
                term: state.term,
                name: 'Examensarbete',
                grade,
                day: state.day,
              });
              gain('happy', 20);
              addRumor('femma', { kurs: 'examensarbetet' }, grade === 5 ? witnessesHere() : []);
              save();
              dialog(
                'Godkänt examensarbete!',
                '<p>Opponenten var nöjd och handledaren på ' +
                  esc(c.namn) +
                  ' tackade för ett bra jobb. Betyg <strong>' +
                  grade +
                  '</strong>.</p>',
                [{ label: 'Äntligen', primary: true, run: close }],
                'Examensarbete',
              );
            },
          },
      { label: 'Tillbaka', run: close },
    ],
    'Examensarbete',
  );
}

// ---- Examen, karriärval och slut ----
function careerPaths() {
  const k = state.career,
    avg = gradeAverage(),
    friends = Object.values(state.relations).filter((r) => r >= 40).length,
    paths = [];
  for (const id of k.done) {
    const c = company(id);
    paths.push({
      id: 'jobb-' + id,
      titel: 'Ingenjör på ' + c.namn,
      text: 'Praktiken ledde till ett fast jobb inom ' + c.bransch + ' här i Vasa.',
    });
  }
  if (avg >= 4)
    paths.push({
      id: 'di',
      titel: 'Vidare till diplomingenjör',
      text: 'Med ditt snitt kom du in på DI-utbildningen vid Åbo Akademi i Vasa.',
    });
  if (skillLevel('programmering') >= 5 && state.money >= 150)
    paths.push({
      id: 'startup',
      titel: 'Eget företag',
      text: 'Du startar ett eget mjukvaruföretag med pengarna du sparat och koden du skrivit.',
    });
  if (friends >= 8 || (state.marken?.length || 0) >= 4)
    paths.push({
      id: 'legend',
      titel: 'Campuslegend',
      text: 'Alla känner dig. Du blir kvar i Vasa och ordnar evenemang för nästa generation studerande.',
    });
  paths.push({
    id: 'ut',
    titel: 'Ut i världen',
    text: 'Du tar examen och söker jobb i hela Norden. Var det slutar vet ingen än.',
  });
  return paths;
}
function graduationDialog() {
  const paths = careerPaths();
  dialog(
    'Examensdagen',
    '<p>Studentmössan på, betyget i handen. Vad blir nästa steg?</p>',
    paths.map((p, i) => ({
      label: p.titel + ' · ' + p.text,
      primary: i === 0,
      run: () => endingDialog(p),
    })),
    'Examen',
  );
}
function endingDialog(path) {
  state.graduated = true;
  state.career.ending = path.id;
  reportHappening('examen', { yrke: String(path.titel || '').toLowerCase() });
  const friends = [...characters, ...extra]
      .filter((p) => (state.relations[p.id] || 0) >= 40)
      .sort((a, b) => state.relations[b.id] - state.relations[a.id]),
    best = friends[0];
  gain('happy', 40);
  save();
  dialog(
    path.titel,
    '<p>' +
      esc(path.text) +
      '</p><div class="info"><strong>Ditt studieliv</strong><br>' +
      credits() +
      ' sp med snittet ' +
      gradeAverage().toFixed(1).replace('.', ',') +
      '<br>' +
      friends.length +
      ' vänner' +
      (best ? ', bäst med ' + esc(best.name.split(' ')[0]) : '') +
      '<br>' +
      state.runs +
      ' extrajobb · ' +
      (state.career.done.length
        ? 'praktik hos ' + state.career.done.map((id) => company(id).namn).join(', ')
        : 'ingen praktik') +
      '<br>' +
      (state.marken?.length
        ? 'Overallmärken: ' + state.marken.map(esc).join(', ')
        : 'Inga overallmärken') +
      '<br>' +
      state.money +
      ' € kvar' +
      (state.debt ? ', ' + state.debt + ' € i skuld' : '') +
      '</div><p>Nästa liv kan börja med ett arv från det här: lite pengar och ett försprång i det du var bäst på.</p>',
    [
      { label: 'Stanna på campus', primary: true, run: close },
      { label: 'Börja ett nytt liv med arv', run: () => newLifeWithLegacy() },
      { label: 'Exportera min historia', run: exportSave },
    ],
    'Slutet',
  );
}
// Arv till nästa liv: pengar efter snittet och lite erfarenhet i bästa färdigheten.
function newLifeWithLegacy() {
  const best = Object.keys(SKILLS).sort(
      (a, b) => (state.skills[b] || 0) - (state.skills[a] || 0),
    )[0],
    legacy = {
      pengar: 30 + Math.round(gradeAverage() * 10),
      färdighet: best,
      xp: Math.round((state.skills[best] || 0) * 0.25),
      märke: 'Alumn',
      från: profile().name,
    };
  try {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
  } catch {}
  start(fresh(state.character));
}
// Används när ett nytt liv startar.
function applyLegacy(s) {
  let legacy = null;
  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
  if (!legacy || !SKILLS[legacy.färdighet]) return;
  s.money += Math.min(200, legacy.pengar || 0);
  s.skills = { ...(s.skills || {}), [legacy.färdighet]: Math.min(400, legacy.xp || 0) };
  s.marken = ['Alumn'];
  setTimeout(
    () =>
      toast(
        'Arv från förra livet: ' +
          legacy.pengar +
          ' € och ett försprång i ' +
          SKILLS[legacy.färdighet].namn.toLowerCase() +
          '.',
      ),
    5000,
  );
}

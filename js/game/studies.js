// Studier, tentor, sömn och examen
'use strict';
// Kurser i termin 1-8. course(i) ger kursens namn och frågebank.
function course(i) {
  return curriculum[state.term - 1][i];
}
// Vad som hindrar koncentrationen just nu, eller null om allt är okej.
function focusProblem() {
  const s = state.stats;
  if (s.hunger < 20) return 'hungrig';
  if (s.energy < 20) return 'trött';
  if (s.happy < 20) return 'nere';
  return null;
}
function tipList(cs, indexes) {
  return (
    '<div class="info">' +
    indexes.map((n) => '• ' + esc(cs.questions[n][4])).join('<br>') +
    '</div>'
  );
}
function study(i, buddy = null) {
  const c = state.courses[i],
    cs = course(i);
  if (c.pass) return toast('Den här kursen är redan klar.');
  if (c.study >= 2) return toast('Du är redo för tentan. Hitta den gula markeringen.');
  if (state.stats.energy < 12)
    return toast('För trött för ett studiepass. Vila hemma eller gör yoga.');
  const problem = buddy ? null : focusProblem();
  if (problem) {
    gain('energy', -5);
    advance(40);
    save();
    dialog(
      'Svårt att fokusera',
      '<p>Du är för ' +
        problem +
        ' för att få ut något av passet. Det räknades inte.</p><div class="info">' +
        (problem === 'hungrig'
          ? 'Ät lunch i W33 först.'
          : problem === 'trött'
            ? 'Vila hemma eller gör yoga på gymmet.'
            : 'Gör något roligt: prata med en vän, träna eller gå på fest.') +
        '</div><p>Plugga med en vän så hjälper hen dig att fokusera ändå.</p>',
      [{ label: 'Okej', primary: true, run: close }],
      'Studier',
    );
    sound('bad');
    return;
  }
  const all = [0, 1, 2, 3, 4],
    tips = buddy || c.retake ? all : c.study === 0 ? [0, 1, 2] : [3, 4];
  const label = c.retake ? 'Repetitionspasset' : 'Studiepass ' + (c.study + 1) + ' / 2';
  c.study = c.retake ? 2 : c.study + 1;
  delete c.retake;
  gain('energy', -8);
  advance(40);
  if (buddy) {
    gain('happy', 5);
    bump(buddy.id, 3);
    state.studiedWith ??= {};
    state.studiedWith[buddy.id] = state.day;
  }
  dialog(
    cs.name,
    '<p>' +
      label +
      ' är klart.' +
      (buddy
        ? ' Du pluggade med ' + esc(buddy.name.split(' ')[0]) + ' och ni gick igenom allt.'
        : '') +
      '</p><p>Dagens anteckningar:</p>' +
      tipList(cs, tips) +
      '<p class="sub">Studietid: 40 minuter. Energi: −8.' +
      (c.study >= 2 ? ' Du är redo för tentan.' : '') +
      '</p>',
    [{ label: 'Tillbaka till campuslivet', primary: true, run: close }],
    'Studier',
  );
  sound('win');
  save();
}
function shuffled(a) {
  return a
    .map((v) => ({ v, n: Math.random() }))
    .sort((a, b) => a.n - b.n)
    .map((x) => x.v);
}
function quiz(title, question, answers, onCorrect, onWrong, tag = 'Tentamen') {
  const list = shuffled(answers.map((text, i) => ({ text, correct: i === 0 })));
  dialog(
    title,
    '<p>' + esc(question) + '</p>',
    list.map((a) => ({
      label: a.text,
      run: () => {
        if (a.correct) {
          sound('win');
          onCorrect();
        } else {
          sound('bad');
          onWrong();
        }
      },
    })),
    tag,
  );
}
function exam(i) {
  const c = state.courses[i],
    cs = course(i);
  if (c.pass) return toast('Tentan är redan godkänd.');
  if (c.retake) return toast('Gör ett repetitionspass innan omtentan.');
  if (c.study < 2) return toast('Läs två studiepass före tentan.');
  const problem = focusProblem(),
    need = problem ? 3 : 2,
    picks = shuffled([0, 1, 2, 3, 4]).slice(0, 3);
  dialog(
    'Tenta i ' + cs.name,
    '<p>Tre frågor. Du behöver <strong>' +
      need +
      ' rätt</strong> för att bli godkänd.</p>' +
      (problem
        ? '<div class="info">Du är ' +
          problem +
          ' och har svårt att tänka klart. Därför krävs alla rätt. Ta hand om dig först om du vill ha bättre chans.</div>'
        : ''),
    [
      { label: 'Börja tentan', primary: true, run: () => examQuestion(i, picks, [], need) },
      { label: 'Inte än', run: close },
    ],
    'Tentamen',
  );
}
function examQuestion(i, picks, answers, need) {
  const cs = course(i),
    n = answers.length;
  if (n === picks.length) return examResult(i, picks, answers, need);
  const q = cs.questions[picks[n]];
  quiz(
    cs.name + ' · fråga ' + (n + 1) + ' / ' + picks.length,
    q[0],
    q.slice(1, 4),
    () => examQuestion(i, picks, [...answers, true], need),
    () => examQuestion(i, picks, [...answers, false], need),
  );
}
function examResult(i, picks, answers, need) {
  const c = state.courses[i],
    cs = course(i),
    right = answers.filter(Boolean).length;
  advance(30);
  if (right >= need) {
    c.pass = true;
    gain('happy', right === picks.length ? 12 : 8);
    save();
    sound('win');
    dialog(
      'Godkänd!',
      '<p>' +
        right +
        ' av ' +
        picks.length +
        ' rätt. Du klarade ' +
        esc(cs.name) +
        '.' +
        (right === picks.length ? ' Full pott!' : '') +
        '</p>',
      [{ label: 'Fortsätt', primary: true, run: close }],
      'Tentamen',
    );
    return;
  }
  const wrong = picks.filter((_, n) => !answers[n]);
  c.study = 1;
  c.retake = true;
  gain('energy', -3);
  gain('happy', -5);
  save();
  sound('bad');
  dialog(
    'Inte godkänd',
    '<p>' +
      right +
      ' av ' +
      picks.length +
      ' rätt, ' +
      need +
      ' krävdes. Du behöver ett repetitionspass innan omtentan.</p><p>Det här var svårt:</p>' +
      '<div class="info">' +
      wrong
        .map((k) => esc(cs.questions[k][0]) + '<br><small>' + esc(cs.questions[k][4]) + '</small>')
        .join('<br><br>') +
      '</div>',
    [{ label: 'Tillbaka', primary: true, run: close }],
    'Tentamen',
  );
}
function sleep() {
  const done = state.courses.every((c) => c.pass);
  dialog(
    'En stund hemma',
    '<p>Vila, sov till morgonen' +
      (done && state.term < 8 ? ' eller avsluta terminen' : '') +
      '.</p>',
    [
      {
        label: 'Vila 1 timme · +35 energi',
        run: () => {
          advance(60);
          gain('energy', 35);
          close();
          save();
          toast('Lite vila gjorde gott.');
        },
      },
      {
        label: 'Sov till morgonen · +75 energi',
        run: () => {
          state.day++;
          state.hour = 8;
          gain('energy', 75);
          gain('hunger', -20);
          close();
          save();
          toast('Ny dag. Klockan är 08:00.');
          morningEvent();
        },
      },
      ...(done && state.term < 8
        ? [
            {
              label: 'Börja termin ' + (state.term + 1),
              primary: true,
              run: () => {
                state.term++;
                state.day++;
                state.hour = 8;
                state.courses = [
                  { study: 0, pass: false },
                  { study: 0, pass: false },
                  { study: 0, pass: false },
                ];
                gain('energy', 80);
                gain('happy', 15);
                close();
                updateHUD();
                save();
                toast('Välkommen till termin ' + state.term + '!');
                morningEvent(0.8);
              },
            },
          ]
        : []),
      { label: 'Tillbaka', run: close },
    ],
  );
}
// Energin tog slut: du somnar där du står och vaknar hemma nästa morgon.
function passOut() {
  if (job) return;
  changeWorld('home');
  if (state.hour >= 8) state.day++;
  state.hour = 8;
  state.stats.energy = 45;
  gain('happy', -10);
  gain('hunger', -15);
  save();
  dialog(
    'Du somnade',
    '<p>Energin tog slut och du somnade där du stod. Någon hjälpte dig hem.</p><div class="info">Du vaknar hemma klockan 08:00 · −10 glädje · −15 mättnad</div><p>Vila i tid nästa gång, sängen hemma ger mest energi.</p>',
    [{ label: 'Upp och hoppa', primary: true, run: close }],
    'Utmattad',
  );
  sound('bad');
}
function homeDesk() {
  if (state.term === 8 && state.courses.every((c) => c.pass) && !state.graduated) {
    quiz(
      'Examensprovet',
      'Vad gör ett examensarbete trovärdigt?',
      [
        'Planering, källor, analys och verifiering',
        'Gissa resultatet utan mätningar',
        'Hoppa över diskussionen',
      ],
      () => {
        state.graduated = true;
        gain('happy', 40);
        save();
        dialog(
          'Grattis till examen!',
          '<p>' +
            esc(profile().name) +
            ' har klarat åtta terminer och examensprovet.</p><div class="info">' +
            state.runs +
            ' extrajobb · ' +
            state.lunches +
            ' luncher · ' +
            Object.values(state.relations).filter((r) => r >= 40).length +
            ' vänner · ' +
            state.money +
            ' € kvar.</div><p>Fortsätt utforska eller börja ett nytt liv.</p>',
          [
            { label: 'Stanna på campus', primary: true, run: close },
            { label: 'Exportera min historia', run: exportSave },
          ],
          'Examensdagen',
        );
      },
      () => {
        toast('Tänk på hur resultatet kan kontrolleras.');
        close();
      },
    );
    return;
  }
  showCourses();
}
function showCourses() {
  dialog(
    'Din studieplan',
    '<p>Termin ' +
      state.term +
      ' av 8. Varje kurs kräver två studiepass och en tenta med tre frågor där två rätt krävs.</p>' +
      curriculum[state.term - 1]
        .map(
          (q, i) =>
            '<div class="course"><span>' +
            esc(q.name) +
            '</span><span class="badge">' +
            (state.courses[i].pass
              ? '✓ Godkänd'
              : state.courses[i].retake
                ? 'Omtenta · repetera först'
                : state.courses[i].study + ' / 2 studiepass') +
            '</span></div>',
        )
        .join(''),
    [{ label: 'Tillbaka', primary: true, run: close }],
    'Studieplan',
  );
}

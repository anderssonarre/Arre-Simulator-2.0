// Studier, tentor, sömn och examen
'use strict';
function study(i) {
  const c = state.courses[i],
    q = curriculum[state.term - 1][i];
  if (c.pass) return toast('Den här kursen är redan klar.');
  if (c.study >= 2) return toast('Du är redo för tentan. Hitta den gula markeringen.');
  if (state.stats.energy < 12)
    return toast('För trött för ett studiepass. Vila hemma eller gör yoga.');
  c.study++;
  gain('energy', -8);
  advance(40);
  dialog(
    q[0],
    '<p>Studiepass ' +
      c.study +
      ' / 2 är klart.</p><div class="info">Dagens anteckning: ' +
      esc(q[1]) +
      '<br><strong style="color:var(--mint)">' +
      esc(q[2]) +
      '</strong></div><p>Studietid: 40 minuter. Energi: −8.</p>',
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
    q = curriculum[state.term - 1][i];
  if (c.pass) return toast('Tentan är redan godkänd.');
  if (c.study < 2) return toast('Läs två studiepass före tentan.');
  quiz(
    q[0],
    q[1],
    q.slice(2),
    () => {
      c.pass = true;
      gain('happy', 8);
      advance(30);
      save();
      dialog(
        'Godkänd!',
        '<p>Du klarade ' + esc(q[0]) + '. En kurs närmare examen.</p>',
        [{ label: 'Fortsätt', primary: true, run: close }],
        'Tentamen',
      );
    },
    () => {
      gain('energy', -3);
      advance(15);
      save();
      dialog(
        'Inte riktigt',
        '<p>Läs anteckningen igen. Du kan försöka på nytt utan att förlora dina studiepass.</p>',
        [
          {
            label: 'Läs anteckningen',
            run: () =>
              dialog(
                'Anteckning',
                '<p>' + esc(q[1]) + '</p><div class="info">' + esc(q[2]) + '</div>',
                [{ label: 'Stäng', run: close }],
              ),
          },
          { label: 'Tillbaka', run: close },
        ],
        'Tentamen',
      );
    },
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
              },
            },
          ]
        : []),
      { label: 'Tillbaka', run: close },
    ],
  );
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
      ' av 8. Varje kurs kräver två studiepass och en godkänd tenta.</p>' +
      curriculum[state.term - 1]
        .map(
          (q, i) =>
            '<div class="course"><span>' +
            esc(q[0]) +
            '</span><span class="badge">' +
            (state.courses[i].pass ? '✓ Godkänd' : state.courses[i].study + ' / 2 studiepass') +
            '</span></div>',
        )
        .join(''),
    [{ label: 'Tillbaka', primary: true, run: close }],
    'Studieplan',
  );
}

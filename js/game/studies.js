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
  // En riktig spelare bredvid dig räknas som studiekamrat.
  const mate = buddy ? null : studyMate();
  const problem = buddy || mate ? null : focusProblem();
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
    tips = buddy || mate || c.retake ? all : c.study === 0 ? [0, 1, 2] : [3, 4];
  const label = c.retake ? 'Repetitionspasset' : 'Studiepass ' + (c.study + 1) + ' / 2';
  c.study = c.retake ? 2 : c.study + 1;
  delete c.retake;
  gain('energy', -8);
  advance(40);
  addXp(courseSkill(i), XP.studiepass);
  tutorialDone('föreläsning');
  if (mate) {
    addXp('socialt', XP.pluggaMedVän);
    addXp(courseSkill(i), 6);
    gain('happy', 6);
  }
  if (buddy) {
    addXp('socialt', XP.pluggaMedVän);
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
        : mate
          ? ' Du pluggade ihop med ' +
            esc(mate.name.split(' ')[0]) +
            '. Ni förhörde varandra: alla anteckningar, +6 glädje och extra erfarenhet.'
          : '') +
      '</p><p>Dagens anteckningar:</p>' +
      tipList(cs, tips) +
      '<p class="sub">Studietid: 40 minuter. Energi: −8.' +
      ' ' +
      SKILLS[courseSkill(i)].namn +
      ' +' +
      XP.studiepass +
      ' XP.' +
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
        : '') +
      (skillHelps(i)
        ? '<div class="info">Din ' +
          SKILLS[courseSkill(i)].namn.toLowerCase() +
          ' (nivå ' +
          skillLevel(courseSkill(i)) +
          ') gör att du direkt ser ett fel svar på varje fråga.</div>'
        : '<p class="sub">' +
          SKILLS[courseSkill(i)].namn +
          ' nivå ' +
          skillNeeded() +
          ' skulle stryka ett fel svar per fråga och höja betyget. Du har nivå ' +
          skillLevel(courseSkill(i)) +
          '.</p>') +
      (c.lectures
        ? ''
        : '<p class="sub">Tips: en föreläsning i kursen höjer betyget ett steg.</p>'),
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
  const q = cs.questions[picks[n]],
    options = skillHelps(i) ? [q[1], q[2 + Math.floor(Math.random() * 2)]] : q.slice(1, 4);
  quiz(
    cs.name + ' · fråga ' + (n + 1) + ' / ' + picks.length,
    q[0],
    options,
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
    const grade = examGrade(i, right, picks.length),
      reasons = gradeReasons(i, right, picks.length);
    track('exam', { pass: true, grade, retake: !!c.failed });
    c.pass = true;
    recordPass(i, grade);
    if (grade === 5) addRumor('femma', { kurs: cs.name }, witnessesHere());
    addXp(courseSkill(i), XP.tentaGodkänd);
    gain('happy', 4 + grade * 2);
    save();
    sound('win');
    dialog(
      'Godkänd med betyg ' + grade + '!',
      '<p>' +
        right +
        ' av ' +
        picks.length +
        ' rätt. Du klarade ' +
        esc(cs.name) +
        ' och fick 5 studiepoäng.</p><div class="info">' +
        reasons +
        '</div><p class="sub">Snitt hittills: ' +
        gradeAverage().toFixed(1).replace('.', ',') +
        ' · ' +
        credits() +
        ' sp</p>',
      [{ label: 'Fortsätt', primary: true, run: close }],
      'Tentamen',
    );
    return;
  }
  const wrong = picks.filter((_, n) => !answers[n]);
  track('exam', { pass: false, retake: !!c.failed });
  c.study = 1;
  c.retake = true;
  c.failed = true;
  addRumor('underkänd', { kurs: cs.name }, witnessesHere());
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
// Hemma: vila eller sov. Offline spolas tiden fram. Online är klockan gemensam, så där sover man
// en stund i verklig tid och energin fylls på medan man ligger (natten går dessutom fortare för alla).
function sleep() {
  const done = state.courses.every((c) => c.pass),
    online = sharedClock();
  dialog(
    'En stund hemma',
    '<p>Vila, sov' +
      (done && state.term < 8 ? ' eller avsluta terminen' : '') +
      '.</p>' +
      (online
        ? '<p class="sub">Online är klockan gemensam och kan inte spolas fram. Du sover en stund och energin fylls på snabbt. På natten går klockan dessutom sex gånger fortare.</p>'
        : ''),
    [
      {
        label: online ? 'Ta en tupplur · +35 energi, 15 sekunder' : 'Vila 1 timme · +35 energi',
        run: () => {
          close();
          tutorialDone('sov');
          if (online) return startSleep(Math.round(35 * restBonus()), 15, 0, 'Tupplur');
          advance(60);
          gain('energy', Math.round(35 * restBonus()));
          save();
          toast('Lite vila gjorde gott.');
        },
      },
      {
        label: online
          ? 'Sov tills du är utvilad · full energi, 30 sekunder'
          : 'Sov till morgonen · +75 energi',
        run: () => {
          close();
          tutorialDone('sov');
          if (online) return startSleep(Math.max(40, 100 - state.stats.energy), 30, 15, 'Sömn');
          gain('energy', Math.round(75 * restBonus()));
          gain('hunger', -20);
          state.day++;
          state.hour = 8;
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
                if (!sharedClock()) {
                  state.day++;
                  state.hour = 8;
                }
                state.courses = [
                  { study: 0, pass: false, lectures: 0 },
                  { study: 0, pass: false, lectures: 0 },
                  { study: 0, pass: false, lectures: 0 },
                ];
                state.termStartDay = state.day;
                track('term');
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
// Trivseln hemma (möbler och lägenhet) gör att man vilar bättre.
function restBonus() {
  return clamp(1 + coziness() * 0.03, 0.9, 1.4);
}
// Sömnläge (online): energin fylls på i verklig tid tills tiden är ute eller du vaknar.
function startSleep(energy, seconds, hunger, title) {
  sleeping = { energy, hunger, seconds, start: performance.now(), elapsed: 0, given: 0, title };
  document.exitPointerLock?.();
  keys.clear();
  $('sleepTitle').textContent = title === 'Tupplur' ? 'Tupplur' : 'Du sover';
  $('sleepOverlay').hidden = false;
  sleepTick(0);
}
function sleepTick(dt) {
  if (!sleeping) return;
  const s = sleeping;
  // Räknas på klockan i verkligheten, så att långsamma datorer inte sover längre.
  s.elapsed = (performance.now() - s.start) / 1000;
  const p = clamp(s.elapsed / s.seconds, 0, 1),
    share = p - s.given;
  if (share > 0) {
    gain('energy', s.energy * share);
    if (s.hunger) gain('hunger', -s.hunger * share);
    s.given = p;
  }
  $('sleepText').textContent =
    clockText(state.hour) +
    ' · energi ' +
    Math.round(state.stats.energy) +
    (p < 1 ? ' · vaknar om ' + Math.ceil(s.seconds - s.elapsed) + ' s' : '');
  if (p >= 1) wakeUp();
}
function wakeUp() {
  if (!sleeping) return;
  const full = sleeping.given >= 1,
    nap = sleeping.title === 'Tupplur';
  sleeping = null;
  $('sleepOverlay').hidden = true;
  save();
  toast(
    full
      ? nap
        ? 'Pigg igen efter tuppluren.'
        : 'Utvilad! Klockan är ' + clockText(state.hour) + '.'
      : 'Du vaknade tidigt. Energi ' + Math.round(state.stats.energy) + '.',
  );
}
$('wakeButton').onclick = wakeUp;
// Energin tog slut: du somnar där du står och vaknar hemma nästa morgon.
function passOut() {
  if (job) return;
  changeWorld('home');
  if (!sharedClock()) {
    if (state.hour >= 8) state.day++;
    state.hour = 8;
  }
  state.stats.energy = 45;
  gain('happy', -10);
  gain('hunger', -15);
  save();
  dialog(
    'Du somnade',
    '<p>Energin tog slut och du somnade där du stod. Någon hjälpte dig hem.</p><div class="info">' +
      (sharedClock() ? 'Du vaknar hemma' : 'Du vaknar hemma klockan 08:00') +
      ' · −10 glädje · −15 mättnad</div><p>Vila i tid nästa gång, sängen hemma ger mest energi.</p>',
    [{ label: 'Upp och hoppa', primary: true, run: close }],
    'Utmattad',
  );
  sound('bad');
}
// Skrivbordet hemma: studieplan, examensarbete (från termin 7) och examen.
function homeDesk() {
  ensureCareer();
  const thesisOpen = state.term >= CAREER.examensarbete.frånTermin && !state.graduated,
    ready =
      state.term === 8 &&
      state.courses.every((c) => c.pass) &&
      state.career.thesis?.grade &&
      !state.graduated;
  if (!thesisOpen && !ready) return showCourses();
  dialog(
    'Skrivbordet',
    '<p>' +
      (ready ? 'Allt är klart. Dags att ta examen!' : 'Studieplanen och examensarbetet.') +
      '</p>',
    [
      ...(ready ? [{ label: 'Ta examen', primary: true, run: graduationDialog }] : []),
      ...(thesisOpen && !state.career.thesis?.grade
        ? [{ label: 'Examensarbetet', primary: !ready, run: thesisDesk }]
        : []),
      { label: 'Studieplan och betyg', run: showCourses },
      { label: 'Stäng', run: close },
    ],
    'Skrivbordet',
  );
}
function showCourses() {
  dialog(
    'Din studieplan',
    '<p>Termin ' +
      state.term +
      ' av 8. Varje kurs kräver två studiepass och en tenta med tre frågor där två rätt krävs. Betyget blir 1–5: alla rätt, föreläsningar och färdighet höjer, omtenta sänker.</p>' +
      curriculum[state.term - 1]
        .map(
          (q, i) =>
            '<div class="course"><span>' +
            esc(q.name) +
            '</span><span class="badge">' +
            (state.courses[i].pass
              ? '✓ Betyg ' + (state.courses[i].grade || '–')
              : state.courses[i].retake
                ? 'Omtenta · repetera först'
                : state.courses[i].study + ' / 2 studiepass') +
            '</span></div>',
        )
        .join('') +
      '<h3>Studieutdrag</h3><div class="info">' +
      credits() +
      ' sp · snitt ' +
      (state.transcript.length ? gradeAverage().toFixed(1).replace('.', ',') : '–') +
      (state.transcript.length
        ? '<br>' +
          state.transcript
            .slice(-9)
            .map((t) => 'T' + t.term + ' ' + esc(t.name) + ': ' + t.grade)
            .join('<br>')
        : '') +
      '</div>',
    [{ label: 'Tillbaka', primary: true, run: close }],
    'Studieplan',
  );
}

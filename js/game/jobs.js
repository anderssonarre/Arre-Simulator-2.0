// Extrajobb och utmaningar
'use strict';
// Extrajobben styrs av js/data/jobs.js. Man kan ha flera jobb (state.jobs.have) och söker
// nya på jobbtavlan (js/game/jobboard.js). Här finns själva passen.
// Gamla anrop (Ossi i samtalet, jobbmarkeringen) öppnar jobbtavlan.
function startJobPrompt() {
  jobBoard();
}
// Visar vad passet går ut på och startar det.
function jobPrompt(id) {
  const def = JOBB[id];
  dialog(
    def.namn,
    '<p>Ett pass ger <strong>' +
      def.lön +
      ' €</strong>' +
      (def.dricks ? ' plus dricks' : '') +
      ' när hela passet är klart.</p><div class="info">' +
      esc(def.text) +
      '</div><p>Passet kostar ' +
      def.energi +
      ' energi. Du kan avbryta i menyn utan lön.</p>',
    [
      { label: 'Starta passet →', primary: true, run: () => startJob(id) },
      { label: 'Tillbaka', run: jobBoard },
    ],
    'Extrajobb',
  );
}
function startJob(id = myJobs()[0]) {
  const def = JOBB[id];
  if (!def) return;
  const why = shiftProblem(id);
  if (why) return toast(why);
  close();
  job = {
    key: id,
    def,
    moment: def.moment,
    title: def.namn,
    stage: 0,
    type: ['buss', 'lastbil', 'truck'].includes(def.moment) ? 'drive' : 'challenge',
    speed: 0,
  };
  if (job.type === 'drive') {
    const truck = def.moment === 'truck',
      stops = def.stopp || ['Första stoppet', 'Andra stoppet'];
    let w = makeWorld('work', 'Extrajobb · ' + def.namn, truck ? 20 : 48, !truck);
    if (!truck) {
      for (let y = 1; y < 47; y++) {
        for (let x = 1; x < 47; x++) if (x < 4 || x > 13) w.grid[y][x] = 2;
      }
      w.spawn = { x: 8.5, y: 42, a: -Math.PI / 2 };
      station(w, 8.5, 28.5, 'job', stops[0], () => jobStation(0));
      station(w, 8.5, 8.5, 'job', stops[1], () => jobStation(1));
      for (const y of [37.5, 22.5, 13.5]) deco(w, 12.5, y, 'tree', 1.5);
    } else {
      rect(w, 4, 4, 2, 9, 2);
      rect(w, 13, 7, 2, 9, 2);
      w.spawn = { x: 9.5, y: 16.5, a: -Math.PI / 2 };
      station(w, 9.5, 11.5, 'job', stops[0], () => jobStation(0));
      station(w, 9.5, 3.5, 'job', stops[1], () => jobStation(1));
      deco(w, 8.5, 11.5, 'desk', 0.65);
    }
    world = w;
    Object.assign(player, w.spawn);
    pitch = 0;
    resetMotion();
    toast('W / spak fram: gas. S / bak: broms/back. A/D: styr. E vid stoppen.');
    updateHUD();
  } else showChallenge();
}
function jobStation(stage) {
  if (!job || job.stage !== stage)
    return toast(
      stage < job.stage ? 'Redan klart. Fortsätt till nästa stopp.' : 'Hämta lasten först.',
    );
  if (Math.abs(job.speed) > 0.65) return toast('Stanna helt innan du lastar eller släpper av.');
  sound('win');
  if (stage === 0) {
    job.stage = 1;
    toast('Klart. Kör vidare: ' + (job.def.stopp?.[1] || 'nästa stopp').toLowerCase() + '.');
    updateHUD();
    save();
  } else finishJob();
}
function finishJob() {
  if (!job) return;
  const def = job.def;
  job = null;
  let happyBonus = state.stats.happy >= 70,
    double = state.doubleJobDay === state.day,
    pay = Math.round(def.lön * (happyBonus ? 1.25 : 1) * (double ? 2 : 1) * payBoost());
  const mate = teamBonus();
  if (mate) pay = Math.round(pay * 1.3);
  // Dricks på vissa jobb, mer när man är på gott humör.
  const tips = def.dricks ? Math.round(Math.random() * def.dricks * (happyBonus ? 1 : 0.6)) : 0;
  pay += tips;
  addXp('arbetsvana', XP.jobbpass);
  tutorialDone('jobb');
  state.weekJobs = (state.weekJobs || 0) + 1;
  addXp(def.färdighet || 'teknik', XP.jobbpass);
  state.money += pay;
  state.runs++;
  advance(60);
  gain('energy', -(def.energi || 12));
  gain('happy', 12);
  $('jobHUD').style.display = 'none';
  changeWorld('outdoor', jobReturnSpot());
  sound('win');
  dialog(
    'Passet är klart!',
    '<p>' +
      esc(def.namn) +
      ' är avslutat. Du får <strong style="color:var(--mint)">' +
      pay +
      ' €</strong>.</p>' +
      (happyBonus || double || mate || tips || skillLevel('arbetsvana')
        ? '<p>' +
          [
            double ? 'Dubbel lön från Ossi idag.' : '',
            tips ? 'Dricks: ' + tips + ' €.' : '',
            happyBonus ? 'Ditt goda humör gav 25 % bonus.' : '',
            mate ? 'Lagbonus +30 % med ' + mate + '.' : '',
            skillLevel('arbetsvana')
              ? 'Arbetsvana nivå ' +
                skillLevel('arbetsvana') +
                ' gav +' +
                Math.round((payBoost() - 1) * 100) +
                ' %.'
              : '',
          ]
            .filter(Boolean)
            .join(' ') +
          '</p>'
        : '') +
      '<div class="info">+12 glädje · −' + (def.energi || 12) + ' energi · 1 timme har gått</div>',
    [{ label: 'Tillbaka till campus', primary: true, run: close }],
    'Lön utbetald',
  );
  save();
}
function abortJob() {
  job = null;
  $('jobHUD').style.display = 'none';
  changeWorld('outdoor', jobReturnSpot());
  toast('Passet avbröts. Ingen lön betalades ut.');
}
function showChallenge() {
  if (!job) return;
  paused = false;
  if (job.gymOnly) {
    showGymTiming();
    return;
  }
  const j = job,
    p = { job: j.def.namn };
  if (j.moment === 'matte') {
    if (!j.questions) {
      const n = 3 + Math.floor(Math.random() * 6);
      j.questions = [
        ['Uppgift 1', 'Vad är ' + n + ' × 4?', [String(n * 4), String(n * 4 + 2), String(n + 4)]],
        ['Uppgift 2', 'Derivatan av x³?', ['3x²', 'x²', '3x']],
        ['Uppgift 3', 'Vad är 25 % av 80?', ['20', '25', '40']],
      ];
    }
    const t = j.questions[j.stage];
    quiz(
      p.job + ' · ' + (j.stage + 1) + '/3',
      t[1],
      t[2],
      () => {
        j.stage++;
        if (j.stage >= 3) finishJob();
        else showChallenge();
      },
      () => {
        gain('energy', -2);
        toast('Inte riktigt. Försök igen.');
        showChallenge();
      },
      'Extrajobb',
    );
    return;
  }
  if (j.moment === 'quiz' && j.def.frågor) {
    const t = j.def.frågor[j.stage];
    quiz(
      t[0] + ' · ' + (j.stage + 1) + '/3',
      t[1],
      t[2],
      () => {
        j.stage++;
        if (j.stage >= 3) finishJob();
        else showChallenge();
      },
      () => {
        gain('energy', -2);
        toast('Tänk på tydlighet och precision.');
        showChallenge();
      },
      'Extrajobb',
    );
    return;
  }
  const names = j.def.stationer || ['Station 1', 'Station 2', 'Station 3'];
  j.phase = 0;
  j.elapsed = 0;
  j.center = 0.3 + Math.random() * 0.4;
  j.width = 0.23 - j.stage * 0.025;
  dialog(
    p.job + ' · ' + names[j.stage],
    '<p>Tryck när den vita markören ligger i den gröna zonen.</p><div class="meter"><div class="zone" id="timingZone" style="left:' +
      (j.center - j.width / 2) * 100 +
      '%;width:' +
      j.width * 100 +
      '%"></div><div class="cursor" id="timingCursor"></div></div><div class="row"><span class="badge">Station ' +
      (j.stage + 1) +
      ' / 3</span><span class="sub">Knapp / mellanslag</span></div>',
    [
      { label: 'NU! · träffa gröna zonen', primary: true, run: timingHit },
      { label: 'Avbryt passet', run: () => confirmAbort() },
    ],
    'Timingövning',
  );
}
function timingHit() {
  if (!job || job.phase === undefined) return;
  const pos = (Math.sin(job.phase) + 1) / 2;
  if (Math.abs(pos - job.center) <= job.width / 2) {
    sound('win');
    job.stage++;
    if (job.stage >= 3) finishJob();
    else showChallenge();
  } else {
    sound('bad');
    gain('energy', -1);
    toast('Nästan. Träffa den gröna zonen.');
  }
}
function gymPrompt() {
  job = {
    type: 'challenge',
    key: profile().id,
    title: 'Gymträning',
    stage: 0,
    gymOnly: true,
    phase: 0,
    elapsed: 0,
    center: 0.5,
    width: 0.25,
  };
  showGymTiming();
}
function showGymTiming() {
  paused = false;
  dialog(
    'Ett set på gymmet',
    '<p>Tryck när markören är i den gröna zonen.</p><div class="meter"><div class="zone"></div><div class="cursor" id="timingCursor"></div></div>',
    [
      {
        label: 'NU!',
        primary: true,
        run: () => {
          const pos = (Math.sin(job.phase) + 1) / 2;
          if (Math.abs(pos - 0.5) > 0.125) {
            toast('Försök igen.');
            return;
          }
          job = null;
          advance(20);
          gain('energy', -5);
          gain('happy', 12);
          addXp('kondition', XP.gymset);
          close();
          save();
          toast('Bra set! +12 glädje, −5 energi.');
        },
      },
      {
        label: 'Tillbaka',
        run: () => {
          job = null;
          close();
        },
      },
    ],
    'Timingövning',
  );
}
function confirmAbort() {
  paused = true;
  dialog(
    'Avbryta passet?',
    '<p>Du får ingen lön om jobbet inte slutförs.</p>',
    [
      {
        label: 'Fortsätt passet',
        primary: true,
        run: () => {
          paused = false;
          if (job?.type === 'challenge') showChallenge();
          else close();
        },
      },
      { label: 'Avbryt', run: abortJob },
    ],
    'Extrajobb',
  );
}

// Där man hamnar efter ett extrajobb: vid jobbmarkeringen på campus.
function jobReturnSpot() {
  const o = worlds.outdoor.objects.find((o) => o.type === 'job');
  return o ? { x: o.x - 0.8, y: o.y, a: 0 } : worlds.outdoor.spawn;
}

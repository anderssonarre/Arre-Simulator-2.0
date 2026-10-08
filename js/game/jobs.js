// Extrajobb och utmaningar
'use strict';
function startJobPrompt() {
  const p = profile();
  dialog(
    p.job,
    '<p>Ditt personliga extrajobb ger <strong>' +
      p.reward +
      ' €</strong> när hela passet är klart.</p><div class="info">' +
      {
        arvid:
          'Kör bussen till Stefaan, stanna och plocka upp honom. Kör sedan till campus och släpp av honom.',
        zeb: 'Hämta godset vid lastzonen och leverera det vid terminalen. Sakta ner före varje stopp.',
        vilhelm: 'Styr trucken genom lagret, hämta en pall och lämna den i lagerzonen.',
        jennifer:
          'Montering, kvalitetskontroll och packning. Träffa den gröna zonen på varje station.',
        axel: 'Läs ritningens krav och välj skala, måttsättning och vy i rätt ordning.',
        albin: 'Rodd, cykel och styrka. Hitta rytmen och träffa den gröna zonen tre gånger.',
        rasmus:
          'Lös tre problem i följd. Ett fel avslutar inte passet, men du behöver försöka igen.',
        ida: 'Ge tre tydliga order till teamen i rätt ordning.',
      }[p.id] +
      '</div><p>Passet förbrukar energi. Du kan avbryta i menyn utan lön.</p>',
    [
      { label: 'Starta passet →', primary: true, disabled: state.stats.energy < 15, run: startJob },
      { label: 'Inte nu', run: close },
    ],
    'Extrajobb',
  );
}
function startJob() {
  if (state.stats.energy < 15) return toast('Vila först. Minst 15 energi krävs.');
  close();
  const p = profile();
  job = {
    key: p.id,
    title: p.job,
    stage: 0,
    type: ['arvid', 'zeb', 'vilhelm'].includes(p.id) ? 'drive' : 'challenge',
    speed: 0,
  };
  if (job.type === 'drive') {
    let w = makeWorld(
      'work',
      'Extrajobb · ' + p.job,
      p.id === 'vilhelm' ? 20 : 48,
      p.id !== 'vilhelm',
    );
    if (p.id !== 'vilhelm') {
      for (let y = 1; y < 47; y++) {
        for (let x = 1; x < 47; x++) if (x < 4 || x > 13) w.grid[y][x] = 2;
      }
      w.spawn = { x: 8.5, y: 42, a: -Math.PI / 2 };
      station(w, 8.5, 28.5, 'job', p.id === 'arvid' ? 'Plocka upp Stefaan' : 'Lasta godset', () =>
        jobStation(0),
      );
      station(
        w,
        8.5,
        8.5,
        'job',
        p.id === 'arvid' ? 'Släpp av på campus' : 'Lossa vid terminalen',
        () => jobStation(1),
      );
      for (const y of [37.5, 22.5, 13.5]) deco(w, 12.5, y, 'tree', 1.5);
    } else {
      rect(w, 4, 4, 2, 9, 2);
      rect(w, 13, 7, 2, 9, 2);
      w.spawn = { x: 9.5, y: 16.5, a: -Math.PI / 2 };
      station(w, 9.5, 11.5, 'job', 'Hämta pallen', () => jobStation(0));
      station(w, 9.5, 3.5, 'job', 'Placera pallen', () => jobStation(1));
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
    toast(
      job.key === 'arvid'
        ? 'Stefaan är ombord. Kör till campus.'
        : 'Lasten är ombord. Kör till leveransen.',
    );
    updateHUD();
    save();
  } else finishJob();
}
function finishJob() {
  if (!job) return;
  const p = characters.find((c) => c.id === job.key);
  job = null;
  const happyBonus = state.stats.happy >= 70,
    double = state.doubleJobDay === state.day,
    pay = Math.round(p.reward * (happyBonus ? 1.25 : 1) * (double ? 2 : 1));
  state.money += pay;
  state.runs++;
  advance(60);
  gain('energy', -12);
  gain('happy', 12);
  $('jobHUD').style.display = 'none';
  changeWorld('outdoor', jobReturnSpot());
  sound('win');
  dialog(
    'Passet är klart!',
    '<p>' +
      esc(p.job) +
      ' är avslutat. Du får <strong style="color:var(--mint)">' +
      pay +
      ' €</strong>.</p>' +
      (happyBonus || double
        ? '<p>' +
          [
            double ? 'Dubbel lön från Ossi idag.' : '',
            happyBonus ? 'Ditt goda humör gav 25 % bonus.' : '',
          ]
            .filter(Boolean)
            .join(' ') +
          '</p>'
        : '') +
      '<div class="info">+12 glädje · −12 energi · 1 timme har gått</div>',
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
const tasks = {
  axel: [
    [
      'Skala',
      'En detalj är 100 mm lång. Hur lång är den på ritningen i skala 1:2?',
      ['50 mm', '200 mm', '100 mm'],
    ],
    [
      'Måttsättning',
      'Vilket mått behövs för ett cirkulärt hål?',
      ['Diameter', 'Bara färg', 'Bara vikt'],
    ],
    [
      'Vy',
      'Vilken vy visar ett dolt hål genom detaljen?',
      ['Snittvy', 'Bara en titel', 'Bara en yttre silhuett'],
    ],
  ],
  ida: [
    [
      'Monteringslaget',
      'Vad säger du först?',
      [
        'Kontrollera materialet och börja monteringen',
        'Byt avdelning utan plan',
        'Vänta utan information',
      ],
    ],
    [
      'Logistikteamet',
      'Hur får du lasten till rätt plats?',
      [
        'Flytta lasten till zon B och bekräfta när det är klart',
        'Lägg den någonstans',
        'Ta rast och lämna lasten',
      ],
    ],
    [
      'Kvalitetsteamet',
      'Vad krävs före leverans?',
      [
        'Kontrollera måtten och dokumentera resultatet',
        'Hoppa över kontrollen',
        'Gissa om allt passar',
      ],
    ],
  ],
};
function showChallenge() {
  if (!job) return;
  paused = false;
  if (job.gymOnly) {
    showGymTiming();
    return;
  }
  const j = job,
    p = characters.find((c) => c.id === j.key);
  if (j.key === 'rasmus') {
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
  if (tasks[j.key]) {
    const t = tasks[j.key][j.stage];
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
  const names =
    j.key === 'albin'
      ? ['Rodd · hitta rytmen', 'Cykel · jämn takt', 'Styrka · kontrollerad rörelse']
      : j.key === 'jennifer'
        ? ['Montering', 'Kvalitetskontroll', 'Packning']
        : ['Uppvärmning', 'Styrka', 'Stretch'];
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
  if (profile().id === 'albin') {
    startJobPrompt();
    return;
  }
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

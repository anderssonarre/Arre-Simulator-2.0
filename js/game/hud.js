// Mål, statusfält och tid
'use strict';
function objective() {
  // Fredagsfesten är sällsynt och gemensam, så den går före allt annat.
  if (!job && partyNow() && !state.graduated)
    return {
      title: 'Fredagsfest på Filicia Castle',
      detail: 'W33 · alla online är där till ' + CLOCK.party.to + '.00. Mer glädje ju fler ni är.',
    };
  // En pågående föreläsning i en kurs som inte är klar går före allt annat.
  if (!job && state && !state.graduated)
    for (let k = 0; k < 3; k++)
      if (!state.courses[k].pass && lectureNow(k) && !state.lecturesSeen?.[state.day + ':' + k])
        return {
          title: 'Föreläsning nu: ' + course(k).name,
          detail:
            LECTURE_ROOM[k].name +
            ' · till ' +
            lectureNow(k).till +
            ':00. Räknas som ett studiepass.',
        };
  const t = !job && tutorialStep();
  if (t)
    return {
      title: 'Första dagen · ' + t.title,
      detail: t.detail,
    };
  if (job)
    return {
      title: job.title,
      detail:
        job.type === 'drive'
          ? job.stage === 0
            ? 'Kör till första hållplatsen. Stanna i den markerade zonen och tryck E.'
            : 'Kör till leveransen. Stanna i den markerade zonen och tryck E.'
          : 'Slutför uppgifterna i ordning.',
    };
  if (state.graduated)
    return {
      title: 'Ingenjör. Äntligen.',
      detail: 'Alla åtta terminer är klara. Campus är fortfarande ditt att utforska.',
    };
  const i = state.courses.findIndex((c) => !c.pass);
  if (i < 0)
    return {
      title: state.term === 8 ? 'Examensprovet väntar' : 'Dags för nästa termin',
      detail:
        state.term === 8
          ? 'Gå hem till skrivbordet och skriv examensprovet.'
          : 'Gå hem och sov för att börja nästa termin.',
    };
  const c = state.courses[i],
    name = course(i).name;
  return {
    title: (c.retake ? 'Repetera ' : c.study < 2 ? 'Studera ' : 'Skriv tenta i ') + name,
    detail:
      (i === 0 ? 'W33' : 'Technobothnia') +
      ' · ' +
      (c.retake
        ? 'Ett repetitionspass behövs före omtentan.'
        : c.study < 2
          ? 'Två studiepass förbereder dig för tentan.'
          : 'Besök den gula tentamarkeringen.'),
  };
}
function updateHUD() {
  if (!state) return;
  const o = objective();
  $('goalTitle').textContent = o.title;
  $('goalDetail').textContent = o.detail;
  $('termLabel').textContent = state.graduated
    ? 'EXAMEN AVKLARAD'
    : 'Termin ' + state.term + ' / 8 · dag ' + state.day;
  $('courseCount').textContent = state.courses.filter((c) => c.pass).length + ' / 3 kurser klara';
  $('characterName').textContent = profile().name.split(' ')[0];
  $('termProgress').style.width =
    (state.courses.reduce((a, c) => a + (c.pass ? 3 : c.study), 0) / 9) * 100 + '%';
  $('place').textContent = world.name + (party ? ' · Filicia fest' : '');
  $('mapTitle').textContent =
    world.id === 'outdoor' ? 'CAMPUS' : world.id === 'home' ? 'HEMMET' : world.id.toUpperCase();
  $('money').textContent = state.money + ' €' + (state.debt ? ' · skuld ' + state.debt : '');
  $('money').style.color = state.debt ? '#ed807b' : '';
  const h = Math.floor(state.hour),
    m = Math.floor((state.hour - h) * 60);
  $('time').textContent =
    capital(weekday(state.day)) +
    ' ' +
    String(h).padStart(2, '0') +
    ':' +
    String(m).padStart(2, '0');
  updateLectureLabels();
  for (const k of ['hunger', 'happy', 'energy']) {
    $(k + 'Bar').style.width = state.stats[k] + '%';
    $(k + 'Value').textContent = Math.round(state.stats[k]);
    $(k + 'Bar').style.background = state.stats[k] < 20 ? '#ed807b' : '';
  }
}
function advance(minutes) {
  if (!sharedClock()) {
    // Online kan ingen spola fram tiden, den är gemensam för alla.
    const h = state.hour + minutes / 60;
    state.day += Math.floor(h / 24);
    state.hour = h % 24;
  }
  state.stats.hunger = clamp(state.stats.hunger - minutes * 0.05, 0, 100);
  state.stats.energy = clamp(state.stats.energy - minutes * 0.025, 0, 100);
  updateHUD();
}

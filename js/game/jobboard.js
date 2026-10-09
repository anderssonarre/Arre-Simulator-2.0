// Jobbtavlan: se dina jobb, sök nya och välj vilket du jobbar ett pass på. Jobben finns i
// js/data/jobs.js. Svaret på en ansökan kommer nästa dag. Rätt färdigheter, en bra intervju,
// arbetsvana och en bra relation med jobbförmedlaren Ossi ger bättre chans.
// Läget sparas i state.jobs: { have: [id], applied: { id: { day, intervju } }, rejected: { id: day } }.
'use strict';
const REAPPLY_DAYS = 3;
function ensureJobs() {
  const j = (state.jobs ??= {});
  j.have = (Array.isArray(j.have) ? j.have : []).filter((id) => JOBB[id]);
  // Karaktärens eget jobb har man från början (även i äldre sparningar).
  if (!j.started) {
    j.started = true;
    const own = STARTJOBB[state.character] || 'fabrik';
    if (!j.have.includes(own)) j.have.unshift(own);
  }
  j.applied = j.applied && typeof j.applied === 'object' ? j.applied : {};
  j.rejected = j.rejected && typeof j.rejected === 'object' ? j.rejected : {};
  for (const id of Object.keys(j.applied)) if (!JOBB[id]) delete j.applied[id];
  return j;
}
const myJobs = () => (state ? ensureJobs().have : []);
const hasJob = (id) => myJobs().includes(id);

// ---- Tider och krav ----
function shiftOpen(def) {
  if (def.dagar && !def.dagar.includes(WEEKDAYS[weekdayIndex(state.hour < 6 ? state.day - 1 : state.day)]))
    return false;
  if (!def.tider) return true;
  const h = state.hour < 6 && def.tider.till > 24 ? state.hour + 24 : state.hour;
  return h >= def.tider.från && h < def.tider.till;
}
const hours = (def) =>
  def.tider
    ? String(def.tider.från % 24).padStart(2, '0') + '–' + String(def.tider.till % 24).padStart(2, '0')
    : 'när du vill';
// Varför man inte kan jobba ett pass just nu, eller null.
function shiftProblem(id) {
  const def = JOBB[id];
  if (!hasJob(id)) return 'Det jobbet har du inte. Sök det på jobbtavlan.';
  if (!shiftOpen(def)) return def.namn + ' har pass ' + hours(def) + '.';
  if (state.stats.energy < Math.max(15, def.energi)) return 'Vila först. Passet kräver ' + Math.max(15, def.energi) + ' energi.';
  if (isDrunk()) return 'Du kan inte jobba full. Kom tillbaka när ruset gått över.';
  return null;
}
// Kraven du inte uppfyller, som text, eller tom lista.
function missingReqs(def) {
  const out = [];
  for (const [k, n] of Object.entries(def.krav?.färdighet || {}))
    if (skillLevel(k) < n) out.push(SKILLS[k].namn + ' nivå ' + n);
  if (def.krav?.termin && state.term < def.krav.termin) out.push('termin ' + def.krav.termin);
  return out;
}
// Varför man inte kan söka ett jobb just nu, eller null.
function applyProblem(id) {
  const j = ensureJobs(),
    def = JOBB[id];
  if (j.have.includes(id)) return 'Du har redan jobbet.';
  if (j.applied[id]) return 'Du har sökt. Svaret kommer imorgon.';
  if (j.rejected[id] != null && state.day - j.rejected[id] < REAPPLY_DAYS)
    return 'Du kan söka igen om ' + (REAPPLY_DAYS - (state.day - j.rejected[id])) + ' dagar.';
  if (j.have.length >= MAX_JOBB) return 'Du har redan ' + MAX_JOBB + ' jobb. Sluta på ett först.';
  const miss = missingReqs(def);
  if (miss.length) return 'Kräver ' + miss.join(' och ') + '.';
  return null;
}

// ---- Tavlan ----
function jobBoard() {
  const j = ensureJobs(),
    open = Object.keys(JOBB).filter((id) => !j.have.includes(id));
  const line = (id) => {
    const def = JOBB[id];
    return (
      '<strong>' +
      esc(def.namn) +
      '</strong> · ' +
      def.lön +
      ' €' +
      (def.dricks ? ' + dricks' : '') +
      ' · ' +
      hours(def) +
      ' · −' +
      def.energi +
      ' energi'
    );
  };
  dialog(
    'Jobbtavlan',
    '<div class="info"><strong>Dina jobb</strong><br>' +
      j.have.map(line).join('<br>') +
      '</div>' +
      (Object.keys(j.applied).length
        ? '<p class="sub">Sökt, svar imorgon: ' +
          Object.keys(j.applied)
            .map((id) => esc(JOBB[id].namn))
            .join(', ') +
          '</p>'
        : '') +
      '<p><strong>Lediga jobb</strong></p><p class="sub">' +
      open
        .map((id) => {
          const why = applyProblem(id);
          return line(id) + (why ? ' · <em>' + esc(why) + '</em>' : '');
        })
        .join('<br>') +
      '</p>',
    [
      ...j.have.map((id) => ({
        label: 'Jobba: ' + JOBB[id].namn + ' · ' + JOBB[id].lön + ' €',
        primary: !shiftProblem(id),
        run: () => {
          const why = shiftProblem(id);
          return why ? toast(why) : jobPrompt(id);
        },
      })),
      ...open
        .filter((id) => !applyProblem(id))
        .map((id) => ({ label: 'Sök: ' + JOBB[id].namn, run: () => applyJob(id) })),
      ...(j.have.length > 1 ? [{ label: 'Sluta på ett jobb', run: quitMenu }] : []),
      { label: 'Stäng', run: close },
    ],
    'Extrajobb',
  );
}
function applyJob(id) {
  const def = JOBB[id],
    why = applyProblem(id);
  if (why) return toast(why);
  const send = (intervju) => {
    ensureJobs().applied[id] = { day: state.day, intervju };
    save();
    sound('tap');
    dialog(
      'Ansökan skickad',
      '<p>Du sökte jobbet som <strong>' +
        esc(def.namn.toLowerCase()) +
        '</strong>.' +
        (intervju === true
          ? ' Intervjun gick bra.'
          : intervju === false
            ? ' Intervjun kunde ha gått bättre.'
            : '') +
        '</p><p>Svaret kommer imorgon.</p>',
      [{ label: 'Tillbaka till tavlan', primary: true, run: jobBoard }],
      'Extrajobb',
    );
  };
  if (!def.intervju) return send(null);
  const q = def.intervju;
  quiz(
    'Intervju · ' + def.namn,
    q.fråga,
    [q.rätt, ...q.fel],
    () => send(true),
    () => send(false),
    'Intervju',
  );
}
function quitMenu() {
  const j = ensureJobs();
  dialog(
    'Sluta på ett jobb',
    '<p>Vilket jobb vill du sluta på? Du kan söka det igen senare.</p>',
    [
      ...j.have.map((id) => ({
        label: 'Sluta som ' + JOBB[id].namn.toLowerCase(),
        run: () => {
          j.have = j.have.filter((x) => x !== id);
          save();
          toast('Du slutade som ' + JOBB[id].namn.toLowerCase() + '.');
          jobBoard();
        },
      })),
      { label: 'Tillbaka', primary: true, run: jobBoard },
    ],
    'Extrajobb',
  );
}

// ---- Svaren kommer nästa dag ----
function jobChance(id, intervju) {
  const def = JOBB[id];
  let c = def.chans ?? 0.75;
  if (intervju === true) c += 0.2;
  if (intervju === false) c -= 0.3;
  if ((state.relations.ossi || 0) >= 40) c += 0.1; // Ossi känner alla arbetsgivare
  c += skillLevel('arbetsvana') * 0.03;
  return clamp(c, 0.05, 0.97);
}
// Körs varje bildruta, men gör bara något när en ansökan har fått svar.
function jobsTick() {
  if (!state?.jobs?.applied) return;
  const j = state.jobs;
  for (const [id, a] of Object.entries(j.applied)) {
    if (a.day >= state.day) continue;
    delete j.applied[id];
    // Samma svar även om man laddar om: slumpen bestäms av dagen och jobbet.
    const roll = seeded(a.day * 977 + hashId(id))();
    const def = JOBB[id];
    if (roll < jobChance(id, a.intervju) && j.have.length < MAX_JOBB) {
      j.have.push(id);
      reportHappening('jobb', { yrke: def.namn.toLowerCase() });
      setTimeout(
        () => toast('Du fick jobbet som ' + def.namn.toLowerCase() + '! Börja ett pass vid jobbtavlan.'),
        1500,
      );
      sound('win');
    } else {
      j.rejected[id] = state.day;
      setTimeout(
        () =>
          toast(
            'Tyvärr, jobbet som ' +
              def.namn.toLowerCase() +
              ' gick till någon annan. Du kan söka igen om ' +
              REAPPLY_DAYS +
              ' dagar.',
          ),
        1500,
      );
    }
    save();
  }
}
// Kollar datafilen när spelet startar.
for (const [id, def] of Object.entries(JOBB)) {
  if (!['buss', 'lastbil', 'truck', 'timing', 'quiz', 'matte'].includes(def.moment))
    console.warn('Jobb ' + id + ': okänt moment ' + def.moment);
  if (def.moment === 'quiz' && def.frågor?.length !== 3) console.warn('Jobb ' + id + ': behöver tre frågor');
  for (const k of Object.keys(def.krav?.färdighet || {}))
    if (!SKILLS[k]) console.warn('Jobb ' + id + ': okänd färdighet ' + k);
}

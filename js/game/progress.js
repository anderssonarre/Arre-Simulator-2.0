// Fas 3: färdigheter, betyg, hyra och studiestöd, vänskap som svalnar och berättaren.
// Siffrorna finns i js/data/progress.js.
'use strict';

// Fyller i det som saknas i äldre sparningar.
function ensureProgress() {
  const s = state;
  s.skills = s.skills && typeof s.skills === 'object' ? s.skills : {};
  for (const k of Object.keys(SKILLS))
    s.skills[k] = Number.isFinite(s.skills[k]) ? Math.max(0, s.skills[k]) : 0;
  s.transcript = Array.isArray(s.transcript) ? s.transcript.slice(-64) : [];
  s.debt = Number.isFinite(s.debt) ? Math.max(0, s.debt) : 0;
  s.ledger = Array.isArray(s.ledger) ? s.ledger.slice(-12) : [];
  s.econDay = Number.isInteger(s.econDay) ? s.econDay : s.day;
  s.storyDay = Number.isInteger(s.storyDay) ? s.storyDay : s.day;
  s.storyQueue = Array.isArray(s.storyQueue) ? s.storyQueue : [];
  s.termStartDay = Number.isInteger(s.termStartDay) ? s.termStartDay : s.day;
  s.lastPassDay = Number.isFinite(s.lastPassDay) ? s.lastPassDay : 0;
  for (const c of s.courses) c.lectures ??= 0;
}

// ---- Färdigheter ----
// Nivå n kräver 15 + 30 + 45 + ... erfarenhet, alltså 15·n·(n+1)/2.
const xpForLevel = (n) => (15 * n * (n + 1)) / 2;
function skillLevel(k) {
  const xp = state.skills?.[k] || 0;
  let n = 0;
  while (n < 10 && xp >= xpForLevel(n + 1)) n++;
  return n;
}
function addXp(k, n) {
  if (!SKILLS[k] || !n) return;
  const before = skillLevel(k);
  state.skills[k] = (state.skills[k] || 0) + n;
  const after = skillLevel(k);
  if (after > before)
    setTimeout(() => toast(SKILLS[k].namn + ' nivå ' + after + '! ' + SKILLS[k].text), 900);
}
function courseSkill(i) {
  return COURSE_SKILL[course(i).name] || 'teknik';
}
// Nivån som behövs för att kursens färdighet ska hjälpa på tentan. Stiger med terminerna.
function skillNeeded() {
  return 2 + Math.floor((state.term - 1) / 2);
}
function skillHelps(i) {
  return skillLevel(courseSkill(i)) >= skillNeeded();
}
// Socialt gör att vänskap växer fortare.
function socialBoost(n) {
  return n > 0 ? Math.round(n * (1 + 0.05 * skillLevel('socialt'))) : n;
}
// Kondition gör att energin räcker längre.
function energyDrain() {
  return 1 - 0.04 * skillLevel('kondition');
}
function payBoost() {
  return 1 + 0.05 * skillLevel('arbetsvana');
}

// ---- Betyg ----
// Två rätt ger 2, alla rätt ger 4. Föreläsningar och färdighet ger +1 var, omtenta −1.
function examGrade(i, right, total) {
  const c = state.courses[i];
  let g = right >= total ? 4 : 2;
  if (c.lectures > 0) g++;
  if (skillHelps(i)) g++;
  if (c.failed) g--;
  return clamp(g, 1, 5);
}
function gradeReasons(i, right, total) {
  const c = state.courses[i],
    r = [right >= total ? 'Alla rätt: 4' : 'Godkänd: 2'];
  if (c.lectures > 0) r.push('Var på föreläsning: +1');
  if (skillHelps(i)) r.push(SKILLS[courseSkill(i)].namn + ' nivå ' + skillNeeded() + ': +1');
  if (c.failed) r.push('Omtenta: −1');
  return r.join(' · ');
}
function recordPass(i, grade) {
  const c = state.courses[i];
  c.grade = grade;
  state.lastPassDay = state.day;
  state.transcript.push({ term: state.term, name: course(i).name, grade, day: state.day });
}
function credits() {
  return state.transcript.length * 5;
}
function gradeAverage() {
  const t = state.transcript;
  return t.length ? t.reduce((a, x) => a + x.grade, 0) / t.length : 0;
}

// ---- Ekonomi ----
function ledger(text, amount) {
  state.ledger.push({ d: state.day, t: text, n: amount });
  if (state.ledger.length > 12) state.ledger.shift();
}
function supportEligible(day = state.day) {
  const n = ECONOMY.stödKräverKursInom;
  return day - state.termStartDay <= n || day - state.lastPassDay <= n;
}
function payDebt() {
  const n = Math.min(state.debt, state.money);
  if (n <= 0) return 0;
  state.money -= n;
  state.debt -= n;
  ledger('Betalade av skulden', -n);
  return n;
}
// Körs en gång per måndag.
function weeklyEconomy() {
  const notes = [];
  if (supportEligible()) {
    state.money += ECONOMY.studiestöd;
    ledger('Studiestöd från FPA', ECONOMY.studiestöd);
    notes.push('studiestöd +' + ECONOMY.studiestöd + ' €');
  } else {
    ledger('FPA pausade stödet: ingen godkänd kurs på länge', 0);
    notes.push('inget studiestöd (för få studiepoäng)');
  }
  const rent = Math.min(state.money, ECONOMY.hyra),
    missing = ECONOMY.hyra - rent;
  state.money -= rent;
  ledger('Hyra', -ECONOMY.hyra);
  notes.push('hyra −' + ECONOMY.hyra + ' €');
  if (missing > 0) {
    state.debt += missing;
    ledger('Hyran räckte inte, skuld', missing);
    notes.push(missing + ' € blev skuld');
  }
  if (state.debt > 0 && missing === 0) payDebt();
  if (state.debt > 0) gain('happy', -8);
  // Vänner man inte har träffat på länge svalnar lite.
  const cooled = [];
  for (const [id, r] of Object.entries(state.relations)) {
    if (r < 20) continue;
    const met = Math.max(state.socialDay[id] || 0, state.hangout?.[id] || 0);
    if (state.day - met < ECONOMY.vänskapSvalnarEfter) continue;
    state.relations[id] = Math.max(15, r - ECONOMY.vänskapSvalnar);
    if (r >= 40 && state.relations[id] < 40) cooled.push(id);
  }
  setTimeout(
    () =>
      toast(
        'Ny vecka: ' +
          notes.join(', ') +
          '.' +
          (cooled.length
            ? ' ' +
              cooled
                .map((id) => [...characters, ...extra].find((p) => p.id === id).name.split(' ')[0])
                .join(' och ') +
              ' har inte hört av dig på länge.'
            : ''),
      ),
    400,
  );
}
// Går igenom dagar som har passerat sedan sist (sömn, gemensam klocka, lång paus).
function processDays() {
  if (state.day - state.econDay > 28) state.econDay = state.day - 28;
  let changed = false;
  while (state.econDay < state.day) {
    state.econDay++;
    if (weekdayIndex(state.econDay) === 0) {
      const real = state.day;
      state.day = state.econDay;
      weeklyEconomy();
      state.day = real;
      changed = true;
    }
  }
  if (changed) {
    updateHUD();
    save();
  }
}

// ---- Berättaren ----
// Körs varje bildruta. En ny dag ger en chans till en händelse när du inte är upptagen.
function storyTick() {
  if (!state?.skills) return;
  processDays();
  if (state.day > state.storyDay) {
    state.storyDay = state.day;
    state.storyPending = true;
  }
  if (state.storyPending && active && !modal && !job && state.hour >= 7) {
    state.storyPending = false;
    morningEvent(0.55);
  }
}
// Hur det går för spelaren just nu, som berättaren läser av.
function storyMood() {
  const s = state.stats,
    struggle =
      (state.money < 25 ? 1 : 0) +
      (state.debt > 0 ? 2 : 0) +
      (s.happy < 35 ? 1 : 0) +
      (s.energy < 25 ? 1 : 0),
    comfort = state.money >= 120 && s.happy >= 65 && state.debt === 0;
  return { struggle, comfort };
}
// Vikt för en händelse. Kämpar du blir chanser vanligare och kriser ovanligare,
// går allt för lätt blir kriserna vanligare.
function storyWeight(e, mood) {
  const tags = e.taggar || ['vardag'];
  let w = e.vikt || 1;
  if (tags.includes('chans')) w *= 1 + mood.struggle;
  // Följder av hur du skött dig (t.ex. obetald hyra) dämpas aldrig.
  if (tags.includes('följd')) w *= 2 + mood.struggle;
  if (tags.includes('kris')) {
    w *= mood.struggle >= 2 ? 0.25 : mood.comfort ? 2.5 : 1;
    if (state.day - (state.lastCrisisDay || -99) < 3) w *= 0.2;
  }
  return w;
}
function weightedPick(list, weight) {
  const ws = list.map(weight),
    sum = ws.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let n = 0; n < list.length; n++) if ((r -= ws[n]) <= 0) return list[n];
  return list[list.length - 1];
}
// Uppföljningar som är dags att visa idag.
function dueChainEvent() {
  const q = state.storyQueue;
  for (let n = 0; n < q.length; n++) {
    if (q[n].day > state.day) continue;
    const e = EVENT_DATA.find((x) => x.id === q[n].id);
    q.splice(n, 1);
    if (e && conditionsMet(e.villkor)) return e;
    n--;
  }
  return null;
}

// ---- Menyer ----
function showProgress() {
  const bars = Object.entries(SKILLS)
    .map(([k, s]) => {
      const lvl = skillLevel(k),
        xp = state.skills[k] || 0,
        lo = xpForLevel(lvl),
        hi = xpForLevel(lvl + 1),
        pct = lvl >= 10 ? 100 : ((xp - lo) / (hi - lo)) * 100;
      return (
        '<div class="course"><span><strong>' +
        s.ikon +
        ' ' +
        s.namn +
        '</strong><br><small style="color:var(--muted)">' +
        s.text +
        '</small><div class="skillbar"><i style="width:' +
        pct.toFixed(0) +
        '%"></i></div></span><span class="badge">Nivå ' +
        lvl +
        '</span></div>'
      );
    })
    .join('');
  const daysToMonday = 7 - weekdayIndex(state.day),
    eligible = supportEligible(state.day + daysToMonday),
    rows = state.ledger
      .slice(-6)
      .reverse()
      .map(
        (l) =>
          '<div class="ledger"><span>' +
          capital(weekday(l.d)) +
          ' v.' +
          (Math.floor((l.d - 1) / 7) + 1) +
          ' · ' +
          esc(l.t) +
          '</span><b>' +
          (l.n > 0 ? '+' : '') +
          (l.n || '') +
          (l.n ? ' €' : '') +
          '</b></div>',
      )
      .join('');
  dialog(
    'Färdigheter och ekonomi',
    '<p>Du blir bättre på det du gör. För tentorna den här terminen behöver kursens färdighet nivå <strong>' +
      skillNeeded() +
      '</strong> för att hjälpa: ett fel svar stryks på varje fråga och betyget höjs.</p>' +
      bars +
      '<h3>Ekonomi</h3><div class="info">Kassa: <b>' +
      state.money +
      ' €</b>' +
      (state.debt ? ' · skuld: <b style="color:#ed807b">' + state.debt + ' €</b>' : '') +
      '<br>Måndag om ' +
      daysToMonday +
      (daysToMonday === 1 ? ' dag' : ' dagar') +
      ': hyra −' +
      ECONOMY.hyra +
      ' €, ' +
      (eligible
        ? 'studiestöd +' + ECONOMY.studiestöd + ' €'
        : '<b style="color:#ed807b">inget studiestöd</b>. FPA kräver en godkänd kurs inom ' +
          ECONOMY.stödKräverKursInom +
          ' dagar.') +
      '</div>' +
      (rows || '<p class="sub">Inga transaktioner än.</p>'),
    [
      ...(state.debt && state.money
        ? [
            {
              label: 'Betala av skulden · ' + Math.min(state.debt, state.money) + ' €',
              primary: true,
              run: () => {
                payDebt();
                updateHUD();
                save();
                showProgress();
              },
            },
          ]
        : []),
      { label: 'Tillbaka', primary: !state.debt, run: menu },
    ],
    'Utveckling',
  );
}

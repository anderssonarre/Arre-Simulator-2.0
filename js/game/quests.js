// Fas 11: sidouppdrag som inte har med skolan att göra. Innehållet finns i js/data/quests.js.
// Personerna ger uppdrag i samtalet ("Behöver du hjälp med något?"). Ett uppdrag har steg:
// gå till en plats och tryck E vid markeringen, prata med någon, eller gör något (köp kaffe).
// Läget sparas i state.quests: { active: { id: { step, since } }, done: [id], tracked: id }.
'use strict';
const MAX_ACTIVE_QUESTS = 3;

function ensureQuests() {
  const q = (state.quests ??= {});
  q.active = q.active && typeof q.active === 'object' ? q.active : {};
  q.done = Array.isArray(q.done) ? q.done : [];
  // AI-uppdrag man har tagit sparas här, så att de finns kvar när nästa dags uppdrag kommer.
  q.custom = q.custom && typeof q.custom === 'object' ? q.custom : {};
  for (const [id, def] of Object.entries(q.custom)) if (!q.active[id] || !validQuest(def)) delete q.custom[id];
  // Uppdrag som tagits bort ur datafilen glöms bort.
  for (const id of Object.keys(q.active)) if (!questById(id)) delete q.active[id];
  if (q.tracked && !q.active[q.tracked]) q.tracked = Object.keys(q.active)[0] || null;
  return q;
}
const questById = (id) => QUESTS.find((x) => x.id === id) || state?.quests?.custom?.[id] || null;
function questStep(id) {
  const a = state.quests?.active?.[id],
    q = questById(id);
  return a && q ? q.steg[a.step] : null;
}
// Uppdraget personen kan ge just nu, eller null.
function questOfferFor(personId) {
  if (!state || state.character === personId) return null;
  const q = ensureQuests();
  if (Object.keys(q.active).length >= MAX_ACTIVE_QUESTS) return null;
  return (
    QUESTS.find(
      (x) =>
        x.person === personId &&
        !q.done.includes(x.id) &&
        !q.active[x.id] &&
        state.term >= (x.villkor?.frånTermin || 1) &&
        conditionsMet(x.villkor || {}),
    ) || null
  );
}
// Personen som ska ha ett svar i ett pågående uppdrag (prata-steg).
function questTalkFor(personId) {
  const q = ensureQuests();
  for (const id of Object.keys(q.active)) {
    const s = questStep(id);
    if (s?.typ === 'prata' && s.person === personId) return { id, step: s };
  }
  return null;
}

// Tecken framför namnet på personer som har något åt dig: ! = ett nytt uppdrag, ? = väntar på dig.
function questMark(personId) {
  if (!state || !QUESTS.some((x) => x.person === personId)) return '';
  return questTalkFor(personId) ? '? ' : questOfferFor(personId) ? '! ' : '';
}

// ---- Samtalet ----
// Knappar som läggs till i samtalsrutan (se chat i social.js).
function questChatButtons(p) {
  const out = [],
    talk = questTalkFor(p.id),
    offer = questOfferFor(p.id);
  if (talk)
    out.push({
      label: talk.step.knapp + (talk.step.kostar ? ' · ' + talk.step.kostar + ' €' : ''),
      primary: true,
      run: () => questTalk(p, talk.id, talk.step),
    });
  else if (offer) out.push({ label: 'Behöver du hjälp med något?', run: () => questOffer(p, offer) });
  return out;
}
function questOffer(p, quest) {
  remember(p, 'you', 'Behöver du hjälp med något?');
  remember(p, 'npc', quest.erbjudande);
  dialog(
    quest.titel,
    '<div class="history"><div class="bubble">' +
      esc(quest.erbjudande) +
      '</div></div><p class="sub">' +
      (quest.ai ? 'Nytt idag · ' : '') +
      'Sidouppdrag · ' +
      quest.steg.length +
      ' steg' +
      (quest.belöning?.märke ? ' · ger ett overallmärke' : '') +
      '</p>',
    [
      {
        label: 'Jag fixar det!',
        primary: true,
        run: () => {
          acceptQuest(quest);
          remember(p, 'you', 'Jag fixar det!');
          chat(p);
        },
      },
      { label: 'Inte nu', run: () => chat(p) },
    ],
    'Sidouppdrag',
  );
}
function acceptQuest(quest) {
  const q = ensureQuests();
  q.active[quest.id] = { step: 0, since: state.day };
  if (quest.ai) q.custom[quest.id] = quest;
  q.tracked = quest.id;
  questSync();
  updateHUD();
  save();
  sound('win');
  toast('Nytt sidouppdrag: ' + quest.titel + '. ' + questStep(quest.id).mål + '.');
}
function questTalk(p, id, step) {
  if (step.kostar && state.money < step.kostar)
    return toast('Det kostar ' + step.kostar + ' €. Du har inte råd just nu.');
  if (step.kostar) state.money -= step.kostar;
  remember(p, 'you', step.knapp);
  remember(p, 'npc', step.svar);
  advanceQuest(id);
  // Samtalet kan ha stängts av att uppdraget blev klart.
  if (!modal) return;
  chat(p);
}

// ---- Handlingar i spelet (kaffe, lunch) ----
function questEvent(handling) {
  const q = state && ensureQuests();
  if (!q) return;
  for (const id of Object.keys(q.active)) {
    const s = questStep(id);
    if (s?.typ !== 'gör' || s.handling !== handling) continue;
    if (s.värld && world?.id !== s.värld) continue;
    advanceQuest(id);
  }
}

// ---- Platser och markeringar ----
// Närmaste ställe runt en plats som man faktiskt kan gå till från husets ingång
// (inte en instängd innergård eller ett rum utan dörr).
const questSpotCache = {};
function questSpot(name) {
  if (questSpotCache[name]) return questSpotCache[name];
  const p = PLATSER[name],
    w = p && worlds[p.värld];
  if (!w) return null;
  const tried = new Set();
  for (let r = 0; r < 18; r += 0.5)
    for (let a = 0; a < 6.28; a += 0.3) {
      const x = Math.floor(p.x + Math.cos(a) * r) + 0.5,
        y = Math.floor(p.y + Math.sin(a) * r) + 0.5,
        key = x + ',' + y;
      if (tried.has(key)) continue;
      tried.add(key);
      if (!walkable(w, x, y, 0.35)) continue;
      if (!findPath(w, w.spawn.x, w.spawn.y, x, y)) continue;
      return (questSpotCache[name] = { world: p.värld, x, y });
    }
  return null;
}
function placeOpen(step) {
  if (step.dagar && !step.dagar.includes(WEEKDAYS[weekdayIndex(state.day)])) return false;
  if (step.tid && (state.hour < step.tid.från || state.hour >= step.tid.till)) return false;
  return true;
}
function whenText(step) {
  const days = step.dagar ? step.dagar.join(', ') + ' ' : '',
    time = step.tid ? step.tid.från + '–' + step.tid.till : '';
  return (days + time).trim();
}
// Lägger markeringar i världarna för alla aktiva plats-steg.
function questSync() {
  if (!state) return;
  const q = ensureQuests();
  for (const w of Object.values(worlds)) w.objects = w.objects.filter((o) => o.type !== 'quest');
  for (const id of Object.keys(q.active)) {
    const s = questStep(id);
    if (s?.typ !== 'plats') continue;
    const spot = questSpot(s.plats);
    if (!spot) continue;
    const quest = questById(id);
    worlds[spot.world].objects.push({
      x: spot.x,
      y: spot.y,
      type: 'quest',
      quest: id,
      height: 1.8, // hög så att stjärnan syns på avstånd
      sprite: questSprite(),
      get label() {
        return quest.titel + (placeOpen(s) ? ' · ' + s.mål : ' · ' + whenText(s));
      },
      action: () => questPlace(id),
    });
  }
}
function questPlace(id) {
  const s = questStep(id);
  if (s?.typ !== 'plats') return;
  if (!placeOpen(s)) return toast('Det går bara ' + whenText(s) + '. Kom tillbaka då.');
  advance(5);
  dialog(
    questById(id).titel,
    '<p>' + esc(s.hittar) + '</p>',
    [{ label: 'Vidare', primary: true, run: () => (close(), advanceQuest(id)) }],
    'Sidouppdrag',
  );
}
function questSprite() {
  if (cache.questMark) return cache.questMark;
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffcb8333';
  g.beginPath();
  g.ellipse(48, 118, 30, 8, 0, 0, 7);
  g.fill();
  g.strokeStyle = '#ffcb83';
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(48, 118, 28, 7, 0, 0, 7);
  g.stroke();
  // En ljus pelare och en stjärna, så att den syns på avstånd.
  const beam = g.createLinearGradient(0, 20, 0, 118);
  beam.addColorStop(0, '#ffcb8300');
  beam.addColorStop(1, '#ffcb8366');
  g.fillStyle = beam;
  g.fillRect(40, 20, 16, 98);
  g.fillStyle = '#ffcb83';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 9 : 22,
      a = -Math.PI / 2 + (i * Math.PI) / 5;
    g.lineTo(48 + Math.cos(a) * r, 40 + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  cache.questMark = c;
  return c;
}

// ---- Framsteg ----
function advanceQuest(id) {
  const q = ensureQuests(),
    a = q.active[id],
    quest = questById(id);
  if (!a || !quest) return;
  a.step++;
  if (a.step >= quest.steg.length) return finishQuest(quest);
  questSync();
  updateHUD();
  save();
  sound('tap');
  toast(quest.titel + ' · ' + questStep(id).mål + '.');
}
function finishQuest(quest) {
  const q = ensureQuests();
  delete q.active[quest.id];
  q.done.push(quest.id);
  if (q.tracked === quest.id) q.tracked = Object.keys(q.active)[0] || null;
  const b = quest.belöning || {};
  applyEffect(b);
  if (b.märke) addBadge(b.märke);
  reportHappening('uppdrag', {
    titel: quest.titel,
    person: firstName(quest.person),
    ...(b.märke ? { märke: b.märke } : {}),
  });
  questSync();
  updateHUD();
  save();
  sound('win');
  const lines = [];
  if (b.pengar) lines.push('+' + b.pengar + ' €');
  if (b.glädje) lines.push('+' + b.glädje + ' glädje');
  if (b.energi) lines.push('+' + b.energi + ' energi');
  for (const [pid, n] of Object.entries(b.relation || {}))
    lines.push('+' + n + ' relation med ' + firstName(pid));
  if (b.märke) lines.push('overallmärket ' + b.märke);
  dialog(
    'Uppdrag klart: ' + quest.titel,
    '<p>' +
      esc(quest.avslut || '') +
      '</p>' +
      (lines.length ? '<div class="info">' + lines.map(esc).join(' · ') + '</div>' : ''),
    [{ label: 'Snyggt', primary: true, run: close }],
    'Sidouppdrag',
  );
}

// ---- Målrutan och menyn ----
// Det följda uppdraget visas i målrutan när inget viktigare pågår (se objective i hud.js).
function questObjective() {
  const q = state && ensureQuests(),
    id = q?.tracked,
    s = id && questStep(id);
  if (!s) return null;
  const where = s.typ === 'plats' ? PLATSER[s.plats]?.namn : '';
  return {
    title: 'Sidouppdrag · ' + questById(id).titel,
    detail:
      s.mål +
      (where && !s.mål.includes(where) ? ' · ' + where : '') +
      (s.typ === 'plats' && (s.dagar || s.tid) && !placeOpen(s) ? ' · öppet ' + whenText(s) : ''),
  };
}
function showQuests() {
  const q = ensureQuests(),
    open = Object.keys(q.active),
    givers = [...characters, ...extra].filter((p) => questOfferFor(p.id)).map((p) => firstName(p.id));
  dialog(
    'Sidouppdrag',
    (open.length
      ? open
          .map((id) => {
            const quest = questById(id),
              s = questStep(id);
            return (
              '<div class="info"><strong>' +
              esc(quest.titel) +
              (q.tracked === id ? ' · följs' : '') +
              '</strong><br>' +
              esc(s.mål) +
              '<br><span class="sub">Steg ' +
              (q.active[id].step + 1) +
              ' av ' +
              quest.steg.length +
              ' · från ' +
              esc(firstName(quest.person)) +
              '</span></div>'
            );
          })
          .join('')
      : '<p>Inga uppdrag just nu.</p>') +
      '<p class="sub">Klara: ' +
      q.done.length +
      ' av ' +
      QUESTS.length +
      '.' +
      (givers.length
        ? ' Fråga ' + esc(givers.slice(0, 4).join(', ')) + ' om de behöver hjälp.'
        : '') +
      '</p>',
    [
      ...open
        .filter((id) => id !== q.tracked)
        .map((id) => ({
          label: 'Följ: ' + questById(id).titel,
          run: () => {
            q.tracked = id;
            updateHUD();
            save();
            showQuests();
          },
        })),
      ...open.map((id) => ({
        label: 'Ge upp: ' + questById(id).titel,
        run: () => {
          delete q.active[id];
          if (q.tracked === id) q.tracked = Object.keys(q.active)[0] || null;
          questSync();
          updateHUD();
          save();
          showQuests();
        },
      })),
      { label: 'Tillbaka', primary: true, run: menu },
    ],
    'Sidouppdrag',
  );
}
// ---- AI-skrivna uppdrag (server/quests.js) ----
// Ett uppdrag går att använda om alla personer, platser och handlingar finns i spelet.
function validQuest(q) {
  const ids = new Set([...characters, ...extra].map((c) => c.id));
  if (!q || typeof q !== 'object' || !ids.has(q.person) || !Array.isArray(q.steg) || !q.steg.length)
    return false;
  if (typeof q.titel !== 'string' || typeof q.erbjudande !== 'string') return false;
  return q.steg.every(
    (s) =>
      typeof s?.mål === 'string' &&
      ((s.typ === 'plats' && PLATSER[s.plats]) ||
        (s.typ === 'prata' && ids.has(s.person)) ||
        (s.typ === 'gör' &&
          ['kaffe', 'lunch'].includes(s.handling) &&
          (!s.värld || ['w33', 'tech', 'gym'].includes(s.värld)))),
  );
}
let aiQuestDay = null;
// Hämtar dagens AI-uppdrag en gång per dag och lägger till dem bland de vanliga.
async function loadAiQuests() {
  const today = new Date().toDateString();
  if (!aiAvailable() || aiQuestDay === today) return;
  aiQuestDay = today;
  try {
    const r = await fetch('/api/quests', {
      method: 'POST',
      headers: aiHeaders(),
      body: JSON.stringify({
        antal: 3,
        people: [...characters, ...extra].map((c) => ({
          id: c.id,
          name: c.name,
          traits: traitAiText(c.id),
        })),
        places: Object.entries(PLATSER).map(([id, p]) => ({ id, name: p.namn })),
      }),
    });
    if (r.status !== 200) return;
    const list = ((await r.json()).uppdrag || []).filter(validQuest);
    // Gårdagens AI-uppdrag som ingen har tagit försvinner.
    for (let i = QUESTS.length - 1; i >= 0; i--) if (QUESTS[i].ai) QUESTS.splice(i, 1);
    for (const q of list) QUESTS.push({ ...q, ai: true });
    if (state) updateHUD();
  } catch {
    aiQuestDay = null;
  }
}
// Kollar datafilen när spelet startar, så att skrivfel syns i konsolen.
function checkQuests() {
  const ids = new Set([...characters, ...extra].map((c) => c.id));
  for (const q of QUESTS) {
    if (!ids.has(q.person)) console.warn('Sidouppdrag ' + q.id + ': okänd person ' + q.person);
    for (const s of q.steg || []) {
      if (s.typ === 'plats' && !PLATSER[s.plats])
        console.warn('Sidouppdrag ' + q.id + ': okänd plats ' + s.plats);
      if (s.typ === 'prata' && !ids.has(s.person))
        console.warn('Sidouppdrag ' + q.id + ': okänd person ' + s.person);
      if (!['plats', 'prata', 'gör'].includes(s.typ))
        console.warn('Sidouppdrag ' + q.id + ': okänd stegtyp ' + s.typ);
    }
  }
}
checkQuests();

// Relationer och samtal
'use strict';
// Väljer en slumpad rad ur en lista i DIALOGUE och fyller i {namn}, {jag}, {ämne} m.fl.
function say(lines, p, extraFill = {}) {
  const line = Array.isArray(lines) ? rand(lines) : lines;
  return String(line)
    .replace(/\{namn\}/g, p ? p.name.split(' ')[0] : '')
    .replace(/\{jag\}/g, playerName().split(' ')[0])
    .replace(/\{ämne\}/g, p?.topic || '')
    .replace(/\{(\w+)\}/g, (m, k) => extraFill[k] ?? m);
}
function relation(p) {
  return state.relations[p.id] || 0;
}
// Ändrar relationen till en person med n poäng.
function bump(id, n) {
  state.relations[id] = clamp((state.relations[id] || 0) + n, -100, 100);
}
// Vilka ämnen i en persons profil som hjälper i respektive kurs (0 = W33, 1 och 2 = Technobothnia).
const studyTopics = [
  ['teknik', 'system'],
  ['matematik', 'planering'],
  ['konstruktion', 'teknik'],
];
// Kursen som personen kan hjälpa dig med just nu, eller -1.
function buddyCourse(p) {
  if (relation(p) < 40 || state.studiedWith?.[p.id] === state.day) return -1;
  return state.courses.findIndex(
    (c, i) => !c.pass && (c.study < 2 || c.retake) && studyTopics[i].includes(p.topic),
  );
}
function relationName(n) {
  return n >= 70
    ? 'Nära vän'
    : n >= 40
      ? 'Vän'
      : n >= 15
        ? 'Bekant'
        : n <= -40
          ? 'Ovän'
          : n < 0
            ? 'Avvaktande'
            : 'Ny bekantskap';
}
function remember(p, who, text) {
  state.histories[p.id] ??= [];
  state.histories[p.id].push({ who, text });
  state.histories[p.id] = state.histories[p.id].slice(-16);
}
function chat(p) {
  const r = relation(p),
    hist = state.histories[p.id] || [];
  const greet = say(
    r >= 40
      ? DIALOGUE.hälsning.vän
      : r < 0
        ? DIALOGUE.hälsning.ovän
        : DIALOGUE.hälsning[p.personality] || DIALOGUE.hälsning.vanlig,
    p,
  );
  if (!hist.length) remember(p, 'npc', greet);
  // Säger vad hen håller på med, en gång per aktivitet och dag.
  const me = people.get(p.id)?.obj,
    act = me?.activity,
    actKey = state.day + ':' + act;
  if (act && DIALOGUE.aktivitet[act] && me.saidActivity !== actKey) {
    me.saidActivity = actKey;
    remember(p, 'npc', say(DIALOGUE.aktivitet[act], p));
  }
  const history = (state.histories[p.id] || [])
    .slice(-6)
    .map(
      (h) => '<div class="bubble ' + (h.who === 'you' ? 'you' : '') + '">' + esc(h.text) + '</div>',
    )
    .join('');
  dialog(
    p.name,
    '<span class="badge">' +
      esc(p.role) +
      ' · ' +
      relationName(r) +
      ' (' +
      r +
      ')</span><div class="history">' +
      history +
      '</div><input id="chatInput" type="text" maxlength="180" placeholder="Skriv en egen replik …" aria-label="Din replik"><p class="sub">Lokala dialoger som minns tidigare repliker. Inget internet krävs.</p>',
    [
      { label: 'Hur går det idag?', run: () => reply(p, 'Hur går det idag?', 'hello') },
      {
        label: 'Prata om ' + p.topic,
        run: () => reply(p, 'Kan vi prata om ' + p.topic + '?', 'topic'),
      },
      {
        label: r >= 15 ? 'Ska vi ta en kaffe?' : 'Vill du hitta på något?',
        run: () => reply(p, r >= 15 ? 'Ska vi ta en kaffe?' : 'Vill du hitta på något?', 'invite'),
      },
      { label: 'Vet du var någon är?', run: () => askWhere(p) },
      ...(buddyCourse(p) >= 0
        ? [
            {
              label: 'Plugga ' + course(buddyCourse(p)).name + ' tillsammans',
              run: () => {
                close();
                study(buddyCourse(p), p);
              },
            },
          ]
        : []),
      {
        label: 'Skicka min replik',
        primary: true,
        run: () => {
          const t = $('chatInput').value.trim();
          if (t) reply(p, t, 'free');
        },
      },
      ...(p.id === 'ossi' ? [{ label: 'Visa mitt extrajobb', run: startJobPrompt }] : []),
      ...(p.id === 'axel' || p.id === 'otto' ? [{ label: 'Ordna en fest', run: partyPrompt }] : []),
      {
        label: 'Vi hörs senare',
        run: () => {
          close();
          save();
        },
      },
    ],
    'Campusfolk',
  );
  $('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
      const t = e.target.value.trim();
      if (t) reply(p, t, 'free');
    }
  });
}
function reply(p, text, type) {
  const lower = text.toLowerCase(),
    r = relation(p),
    bad = /\b(idiot|dum|sämst|tyst|äcklig)\b/.test(lower);
  const newDay = state.socialDay[p.id] !== state.day;
  const slow = p.personality === 'shy' || p.personality === 'cold';
  let delta = bad ? -7 : newDay ? (slow ? 3 : 7) : 1;
  if (type === 'invite' && r < 15) delta = 0;
  if (homeParty?.guests.includes(p.id) && delta > 0) delta *= 2;
  state.relations[p.id] = clamp(r + delta, -100, 100);
  state.socialDay[p.id] = state.day;
  const keyword = DIALOGUE.nyckelord.find((k) => k.ord.some((o) => lower.includes(o)));
  let response = bad
    ? say(DIALOGUE.oförskämt, p)
    : type === 'invite'
      ? r >= 15
        ? say(DIALOGUE.kaffe, p)
        : say(DIALOGUE.inbjudanFörTidigt, p)
      : type === 'topic' || lower.includes(p.topic)
        ? say(DIALOGUE.ämne[p.topic] || DIALOGUE.vanligasvar, p)
        : type === 'free' && keyword
          ? say(keyword.svar, p)
          : r >= 40
            ? say(DIALOGUE.vänsvar, p)
            : slow
              ? say(DIALOGUE.blygsvar, p)
              : say(DIALOGUE.vanligasvar, p);
  // En kaffe med en bekant ger glädje och närmare relation, en gång per dag och person.
  state.hangout ??= {};
  if (type === 'invite' && r >= 15 && !bad) {
    if (state.hangout[p.id] !== state.day) {
      state.hangout[p.id] = state.day;
      bump(p.id, 4);
      gain('happy', 8);
      advance(30);
      response = say(DIALOGUE.kaffe, p);
      toast('Kaffe med ' + p.name.split(' ')[0] + ' · +8 glädje · 30 minuter');
    } else response = say(DIALOGUE.kaffeIgen, p);
  }
  if (relation(p) >= 40 && r < 40)
    toast(
      p.name.split(' ')[0] +
        ' är nu din vän.' +
        (studyTopics.some((t) => t.includes(p.topic)) ? ' Ni kan plugga tillsammans.' : ''),
    );
  remember(p, 'you', text);
  remember(p, 'npc', response);
  gain('happy', bad ? -3 : newDay ? 5 : 1);
  advance(3);
  save();
  chat(p);
}

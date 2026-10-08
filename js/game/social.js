// Relationer och samtal
'use strict';
function relation(p) {
  return state.relations[p.id] || 0;
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
  const greet =
    r >= 40
      ? 'Hej igen! Kul att du är här.'
      : r < 0
        ? 'Jaha, du igen.'
        : p.personality === 'shy'
          ? 'Hej … hur går det?'
          : p.personality === 'cold'
            ? 'Hej. Vad funderar du på?'
            : 'Hej! Vad händer idag?';
  if (!hist.length) remember(p, 'npc', greet);
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
        label: 'Vill du hitta på något?',
        run: () => reply(p, 'Vill du hitta på något?', 'invite'),
      },
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
  state.relations[p.id] = clamp(r + delta, -100, 100);
  state.socialDay[p.id] = state.day;
  const lines = {
    teknik: 'Ett litet steg i taget. Testa det du bygger innan du gör det större.',
    system: 'Jag försöker få delarna att fungera tillsammans. Det är nästan som ett strategispel.',
    konstruktion: 'Precision först. En bra ritning sparar mycket problem senare.',
    campus: 'Det känns som att alla har något på gång. Har du hunnit äta lunch?',
    fester: 'Filicia Castle behöver bara lite musik och rätt folk!',
    träning: 'Jag kör hellre ett bra pass än ett långt pass. Vill du ses på gymmet?',
    matematik: 'Bryt ner problemet. Panik har aldrig gjort en integral lättare.',
    planering: 'Om vi delar upp jobbet blir det klart. Jag kan hålla koll på planen.',
    jobb: 'Det finns ett pass vid den gröna jobbmarkeringen ute. Du får lön när hela jobbet är klart.',
    budget: 'Små utgifter blir stora tillsammans. Låt inte alla pengar gå till nya outfits.',
  };
  let response = bad
    ? 'Det där var onödigt. Vi kan prata när du har en bättre ton.'
    : type === 'invite'
      ? r >= 15
        ? 'Gärna! Vi tar en kaffe efter nästa föreläsning.'
        : 'Kanske senare. Vi får lära känna varandra lite först.'
      : type === 'topic' || lower.includes(p.topic)
        ? lines[p.topic]
        : lower.includes('tack')
          ? 'Varsågod. Kul att kunna hjälpa.'
          : lower.includes('jobb')
            ? 'Kolla jobbmarkeringen ute på campus. Ett pass kan rädda lunchbudgeten.'
            : lower.includes('tenta') || lower.includes('stud')
              ? 'Två studiepass först, sedan tentan. Ta en kurs i taget.'
              : lower.includes('fest')
                ? 'Hör med Axel i Filicia Castle. Det brukar finnas planer där.'
                : r >= 40
                  ? rand([
                      'Skönt att prata med någon som känner mig. Hur har din dag varit?',
                      'Jag minns vårt senaste snack. Ska vi fortsätta på det?',
                      'Kul att se dig igen. Det blev en bättre dag nu.',
                    ])
                  : slow
                    ? 'Jo, det går framåt. Jag håller på med ' + p.topic + '.'
                    : rand([
                        'Ganska bra faktiskt. Har du hittat runt på campus?',
                        'Lite mycket idag, men en lunch och lite sällskap hjälper.',
                        'Vi försöker få ihop dagen. Hur går det för dig?',
                      ]);
  remember(p, 'you', text);
  remember(p, 'npc', response);
  gain('happy', bad ? -3 : newDay ? 5 : 1);
  advance(3);
  save();
  chat(p);
}

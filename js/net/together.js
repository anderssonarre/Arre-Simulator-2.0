// Fas 5: saker att göra tillsammans med riktiga spelare.
// Besök hemma, lappar som väntar tills mottagaren loggar in, plugga ihop och topplistor.
'use strict';
net.visiting = null; // id på spelaren vars hem du är i, eller null
let inviteSent = 0;

// ---- Spelarlistan ----
function remotePlace(r) {
  return r.world.startsWith('home')
    ? r.world === worldKey()
      ? 'här hemma'
      : 'hemma'
    : r.world.startsWith('work')
      ? 'på extrajobbet'
      : PLACE_TEXT[r.world] || r.world;
}
// Från menyn får listan öppnas fast en dialog är öppen, från knappen bara när ingen är det.
function showPlayers(fromBadge) {
  if (net.status !== 'online' || (modal && fromBadge instanceof Event)) return;
  const list = [...remotes.values()];
  dialog(
    list.length + 1 + ' online',
    '<p class="sub">Välj en spelare för att bjuda hem eller lämna en lapp.</p>' +
      '<div class="course"><span><strong>' +
      esc(playerName()) +
      '</strong> (du)</span><span class="badge">' +
      esc(net.visiting != null ? 'på besök' : PLACE_TEXT[world?.id] || 'hemma') +
      '</span></div>',
    [
      ...list.map((r) => ({ label: r.name + ' · ' + remotePlace(r), run: () => playerActions(r) })),
      { label: 'Lämna en lapp till någon', run: () => noteDialog('') },
      { label: 'Topplistor', run: showRecords },
      { label: 'Stäng', primary: true, run: close },
    ],
    'Spelare',
  );
}
function playerActions(r) {
  const home = world.id === 'home' && net.visiting == null;
  dialog(
    r.name,
    '<p>' + esc(r.name) + ' är ' + esc(remotePlace(r)) + '.</p>',
    [
      {
        label: home ? 'Bjud hem ' + r.name.split(' ')[0] : 'Bjud hem (gå hem först)',
        primary: home,
        disabled: !home,
        run: () => sendInvite(r),
      },
      { label: 'Jobba ihop (lagbonus på extrajobbet)', run: () => sendJobInvite(r) },
      { label: 'Ge något ur väskan', run: () => giftMenu(r) },
      ...(kubbSeason() ? [{ label: 'Utmana i kubb', run: () => kubbInvite(r) }] : []),
      { label: 'Lämna en lapp', run: () => noteDialog(r.name) },
      { label: 'Tillbaka', run: showPlayers },
    ],
    'Spelare',
  );
}

// ---- Besök hemma ----
function sendInvite(r) {
  if (Date.now() - inviteSent < 3000) return toast('Vänta lite innan du bjuder in igen.');
  inviteSent = Date.now();
  try {
    net.ws.send(JSON.stringify({ t: 'invite', to: r.id, kind: 'home', home: state.home }));
  } catch {}
  close();
  toast('Inbjudan skickad till ' + r.name.split(' ')[0] + '.');
}
function receivedInvite(m) {
  if (m.kind === 'job') return receivedJobInvite(m);
  if (m.kind === 'kubb') return receivedKubbInvite(m);
  const show = () => {
    if (modal || job || sleeping) return setTimeout(show, 1500);
    dialog(
      m.name + ' bjuder hem dig',
      '<p>' + esc(m.name) + ' är hemma och vill att du kommer på besök.</p>',
      [
        {
          label: 'Gå dit',
          primary: true,
          run: () => {
            answer(m, true);
            visitHome(m.from, m.name, m.home);
          },
        },
        {
          label: 'Inte nu',
          run: () => {
            answer(m, false);
            close();
          },
        },
      ],
      'Inbjudan',
    );
    sound('win');
  };
  show();
}
function answer(m, accept) {
  try {
    net.ws.send(JSON.stringify({ t: 'answer', to: m.from, kind: m.kind || 'home', accept }));
  } catch {}
}
function visitHome(id, name, home) {
  changeWorld('home');
  // Värdens möbler och lägenhet, så att du ser hur hen har det.
  if (home) applyHome(home);
  net.visiting = id;
  net.visitingName = name;
  updateHUD();
  toast('Du är hemma hos ' + name.split(' ')[0] + '. Gå ut genom dörren för att gå därifrån.');
}
// Anropas från changeWorld: lämnar man hemmet är besöket slut.
function leftWorld(id) {
  if (id !== 'home' && net.visiting != null) {
    net.visiting = null;
    net.visitingName = null;
    applyHome(state.home);
  }
}

// ---- Jobba ihop ----
// Två spelare som har extrajobb samtidigt får 30 % lagbonus. Laget gäller en kvart.
function sendJobInvite(r) {
  if (Date.now() - inviteSent < 3000) return toast('Vänta lite innan du frågar igen.');
  inviteSent = Date.now();
  try {
    net.ws.send(JSON.stringify({ t: 'invite', to: r.id, kind: 'job' }));
  } catch {}
  close();
  toast('Du frågade ' + r.name.split(' ')[0] + ' om att jobba ihop.');
}
function receivedJobInvite(m) {
  const show = () => {
    if (modal || sleeping) return setTimeout(show, 1500);
    dialog(
      m.name + ' vill jobba ihop',
      '<p>Har ni extrajobb samtidigt de närmaste femton minuterna får ni båda 30 % lagbonus på lönen.</p>',
      [
        {
          label: 'Kör!',
          primary: true,
          run: () => {
            answer({ ...m, kind: 'job' }, true);
            startTeam(m.from, m.name);
            close();
          },
        },
        { label: 'Inte nu', run: () => (answer({ ...m, kind: 'job' }, false), close()) },
      ],
      'Lagjobb',
    );
    sound('win');
  };
  show();
}
function startTeam(id, name) {
  net.team = { id, name, until: Date.now() + 15 * 60000 };
  toast('Ni jobbar ihop! Starta era extrajobb, så får ni lagbonus.');
  updateHUD();
}
// Lagbonus om kompisen också är på sitt extrajobb just nu.
function teamBonus() {
  const t = net.team;
  if (!t || Date.now() > t.until) return null;
  const r = remotes.get(t.id);
  return r && r.world.startsWith('work') ? t.name.split(' ')[0] : null;
}

// ---- Lappar ----
function noteDialog(to) {
  dialog(
    'Lämna en lapp',
    '<p>Lappen hamnar på mottagarens dörr. Är hen inte online får hen den nästa gång hen loggar in med samma namn.</p>' +
      '<input type="text" id="noteTo" maxlength="24" placeholder="Till (spelarnamn)" value="' +
      esc(to) +
      '"><input type="text" id="noteText" maxlength="200" placeholder="Din lapp …">',
    [
      {
        label: 'Lämna lappen',
        primary: true,
        run: () => {
          const t = $('noteTo').value.trim(),
            text = $('noteText').value.trim();
          if (!t || !text) return toast('Skriv vem lappen är till och vad den säger.');
          try {
            net.ws.send(JSON.stringify({ t: 'note', to: t, text }));
          } catch {
            return toast('Inte ansluten till servern.');
          }
          close();
        },
      },
      { label: 'Tillbaka', run: close },
    ],
    'Lappar',
  );
  setTimeout(() => $(to ? 'noteText' : 'noteTo')?.focus(), 50);
}
function receivedNotes(list) {
  const show = () => {
    if (modal || job || sleeping) return setTimeout(show, 1500);
    dialog(
      list.length === 1 ? 'En lapp på dörren' : list.length + ' lappar på dörren',
      list
        .map(
          (n) =>
            '<div class="bubble">' +
            esc(n.text) +
            '<br><small style="color:var(--muted)">' +
            esc(n.from) +
            ' · ' +
            new Date(n.at).toLocaleString('sv-FI', {
              weekday: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }) +
            '</small></div>',
        )
        .join(''),
      [
        {
          label: 'Svara ' + list[list.length - 1].from.split(' ')[0],
          primary: true,
          run: () => noteDialog(list[list.length - 1].from),
        },
        { label: 'Stäng', run: close },
      ],
      'Lappar',
    );
    sound('win');
  };
  show();
}
function togetherMessage(m) {
  if (m.t === 'invite') receivedInvite(m);
  else if (m.t === 'answer' && m.kind === 'kubb') kubbAnswer(m);
  else if (m.t === 'answer' && m.kind === 'job') {
    if (m.accept) startTeam(m.from, m.name);
    else toast(m.name.split(' ')[0] + ' kan inte jobba just nu.');
  } else if (m.t === 'answer')
    toast(m.name.split(' ')[0] + (m.accept ? ' är på väg hem till dig!' : ' kan inte just nu.'));
  else if (m.t === 'notes') receivedNotes(m.list);
  else if (m.t === 'noteSent') toast('Lappen till ' + m.to + ' är lämnad.');
}

// ---- Plugga ihop ----
// En riktig spelare inom några meter räknas som studiekamrat.
function studyMate() {
  if (net.status !== 'online') return null;
  let best = null,
    bd = 4.5;
  for (const r of remotesHere()) {
    const d = Math.hypot(r.x - player.x, r.y - player.y);
    if (d < bd) {
      bd = d;
      best = r;
    }
  }
  return best;
}

// ---- Topplistor ----
let recordTimer = 0;
function scheduleRecord() {
  if (!serverInfo || !state || Date.now() - recordTimer < 60000) return;
  recordTimer = Date.now();
  fetch('/api/record', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: playerName(),
      credits: credits(),
      avg: gradeAverage(),
      courses: state.transcript.length,
      friends: Object.values(state.relations).filter((r) => r >= 40).length,
      jobs: state.runs,
    }),
  }).catch(() => {});
}
async function showRecords() {
  let list = [];
  try {
    list = await (await fetch('/api/records')).json();
  } catch {
    return toast('Kunde inte hämta topplistorna.');
  }
  const top = (title, key, fmt, filter = () => true) =>
    '<h3>' +
    title +
    '</h3>' +
    (list
      .filter(filter)
      .sort((a, b) => b[key] - a[key])
      .slice(0, 5)
      .map(
        (r, i) =>
          '<div class="ledger"><span>' +
          (i + 1) +
          '. ' +
          esc(r.name) +
          '</span><b>' +
          fmt(r[key]) +
          '</b></div>',
      )
      .join('') || '<p class="sub">Ingen än.</p>');
  dialog(
    'Topplistor',
    top('Studiepoäng', 'credits', (v) => v + ' sp') +
      top(
        'Betygssnitt (minst tre kurser)',
        'avg',
        (v) => v.toFixed(1).replace('.', ','),
        (r) => r.courses >= 3,
      ) +
      top('Flest vänner', 'friends', (v) => v) +
      top('Flest extrajobb', 'jobs', (v) => v),
    [{ label: 'Stäng', primary: true, run: close }],
    'Tillsammans',
  );
}

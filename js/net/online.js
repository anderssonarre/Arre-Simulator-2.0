// Online: ansluter till multiplayerservern, visar andra spelare och sköter chatten.
// Utan server (t.ex. när index.html öppnas som fil) spelar man ensam som vanligt.
'use strict';
const net = {
  ws: null,
  id: null,
  status: 'off', // off | connecting | online
  retry: 0,
  sendTimer: 0,
  last: '',
  manualClose: false,
};
// Andra spelare: id -> { id, name, character, color, world, x, y, a, tx, ty, moving, chat, chatUntil }
const remotes = new Map();
// Karaktärer som styrs av någon online. Deras vanliga figur på campus döljs.
const onlineChars = new Set();
const chatLog = [];

// Servern ligger på samma adress som sidan. ?server=wss://… går också att ange för test.
// Sidan frågar /health först, så att spelet inte försöker ansluta där ingen server finns.
let serverFound = null, // null = inte kollat än, true/false = svar
  serverInfo = null;
function customServer() {
  try {
    return (
      new URLSearchParams(location.search).get('server') || localStorage.getItem('arre_server')
    );
  } catch {
    return null;
  }
}
function serverUrl() {
  const custom = customServer();
  if (custom) return custom;
  if (serverFound && (location.protocol === 'http:' || location.protocol === 'https:'))
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  return null;
}
async function findServer() {
  if (serverFound !== null || customServer()) return;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') {
    serverFound = false;
    return;
  }
  try {
    const r = await fetch('/health', { cache: 'no-store' }),
      info = r.ok ? await r.json() : null;
    serverFound = info?.ok === true;
    serverInfo = serverFound ? info : null;
  } catch {
    serverFound = false;
  }
}
// Hem och extrajobb är privata, så de får ett eget namn per spelare.
function worldKey() {
  if (!world) return 'outdoor';
  return world.id === 'home' || world.id === 'work' ? world.id + ':' + (net.id ?? 0) : world.id;
}
async function onlineConnect() {
  await findServer();
  const url = serverUrl();
  if (!url || !state) return;
  if (net.ws) {
    net.manualClose = true;
    try {
      net.ws.close();
    } catch {}
  }
  net.manualClose = false;
  net.status = 'connecting';
  updateOnlineBadge();
  let ws;
  try {
    ws = new WebSocket(url);
  } catch {
    scheduleReconnect();
    return;
  }
  net.ws = ws;
  ws.onopen = () => {
    const p = profile(),
      out = outfits.find((o) => o.id === state.outfit);
    ws.send(
      JSON.stringify({
        t: 'hello',
        name: playerName(),
        character: p.id,
        color: out?.color || p.color,
      }),
    );
  };
  ws.onmessage = (e) => {
    let m;
    try {
      m = JSON.parse(e.data);
    } catch {
      return;
    }
    onlineMessage(m);
  };
  ws.onclose = () => {
    if (net.ws !== ws) return;
    net.ws = null;
    net.id = null;
    net.status = 'off';
    remotes.clear();
    onlineChars.clear();
    updateOnlineBadge();
    if (!net.manualClose) scheduleReconnect();
  };
  ws.onerror = () => {};
}
function scheduleReconnect() {
  net.status = 'off';
  updateOnlineBadge();
  const wait = Math.min(30000, 2000 * 2 ** net.retry++);
  setTimeout(() => {
    if (!net.ws && state) onlineConnect();
  }, wait);
}
function onlineMessage(m) {
  if (m.t === 'welcome') {
    net.id = m.id;
    net.status = 'online';
    net.retry = 0;
    net.last = '';
    setServerClock(m.clock, true);
    remotes.clear();
    for (const p of m.players) addRemote(p);
    updateOnlineBadge();
    toast(
      remotes.size
        ? 'Online. ' +
            remotes.size +
            (remotes.size === 1 ? ' annan spelare är här.' : ' andra spelare är här.')
        : 'Online. Du är först på campus.',
    );
  } else if (m.t === 'join') {
    addRemote(m.p);
    updateOnlineBadge();
    toast(m.p.name + ' kom online.');
  } else if (m.t === 'leave') {
    const r = remotes.get(m.id);
    remotes.delete(m.id);
    refreshOnlineChars();
    updateOnlineBadge();
    if (r) toast(r.name + ' gick offline.');
  } else if (m.t === 'states') {
    for (const [id, w, x, y, a, moving, color] of m.list) {
      const r = remotes.get(id);
      if (!r) continue;
      if (r.world !== w) {
        // Bytt värld: hoppa direkt till nya platsen i stället för att glida dit.
        r.x = x;
        r.y = y;
      }
      r.world = w;
      r.tx = x;
      r.ty = y;
      r.a = a;
      r.moving = !!moving;
      if (color) r.color = color;
    }
  } else if (m.t === 'chat') {
    const r = remotes.get(m.id);
    if (r) {
      r.chat = m.text;
      r.chatUntil = performance.now() + 7000;
    }
    addChatLine(m.name, m.text, m.id === net.id);
  } else if (m.t === 'clock') {
    setServerClock(m.minutes, false);
  } else if (m.t === 'full') {
    toast('Servern är full just nu. Du spelar ensam så länge.');
    net.manualClose = true;
  }
}
// ---- Gemensam klocka ----
// Online följer alla serverns klocka, så veckodag och tid är samma för alla.
// Ditt eget dagnummer (dag 1, dag 2 ...) behålls: vid anslutning hoppar det fram
// till närmaste dag med serverns veckodag, och följer sedan servern.
function setServerClock(minutes, fresh) {
  if (!Number.isFinite(minutes)) return;
  const serverDay = Math.floor(minutes / 1440) + 1;
  if (fresh || net.clock?.offset === undefined) {
    let day = state ? state.day : 1;
    while (weekdayIndex(day) !== weekdayIndex(serverDay)) day++;
    net.clock = { minutes, at: performance.now(), offset: day - serverDay };
  } else net.clock = { ...net.clock, minutes, at: performance.now() };
  syncClock();
}
function sharedClock() {
  return net.status === 'online' && net.clock;
}
function syncClock() {
  if (!sharedClock() || !state) return;
  const minutes = net.clock.minutes + (performance.now() - net.clock.at) / 1000,
    serverDay = Math.floor(minutes / 1440) + 1;
  state.day = serverDay + net.clock.offset;
  state.hour = (minutes % 1440) / 60;
}
function addRemote(p) {
  remotes.set(p.id, { ...p, tx: p.x, ty: p.y, moving: false, chat: '', chatUntil: 0 });
  refreshOnlineChars();
}
function refreshOnlineChars() {
  onlineChars.clear();
  for (const r of remotes.values()) onlineChars.add(r.character);
}
function remoteProfile(r) {
  const base = [...characters, ...extra].find((c) => c.id === r.character) || characters[0];
  return { ...base, color: r.color || base.color };
}
// Körs varje bildruta: skickar egen position och låter andra glida mjukt mot sin senaste position.
function onlineTick(dt) {
  syncClock();
  for (const r of remotes.values()) {
    const k = 1 - Math.exp(-dt * 12);
    r.x += (r.tx - r.x) * k;
    r.y += (r.ty - r.y) * k;
  }
  if (net.status !== 'online' || !net.ws || !state) return;
  // Ett litet livstecken varje halvminut, så att servern vet att du är kvar även när du står still.
  net.beat = (net.beat || 0) - dt;
  if (net.beat <= 0) {
    net.beat = 30;
    try {
      net.ws.send('{"t":"ping"}');
    } catch {}
  }
  net.sendTimer -= dt;
  if (net.sendTimer > 0) return;
  net.sendTimer = 0.1;
  const out = outfits.find((o) => o.id === state.outfit),
    moving =
      Math.hypot(motion.vx, motion.vy) > 0.2 ||
      (job?.type === 'drive' && Math.abs(job.speed) > 0.2),
    msg = {
      t: 'state',
      world: worldKey(),
      x: +player.x.toFixed(3),
      y: +player.y.toFixed(3),
      a: +player.a.toFixed(3),
      moving,
      color: out?.color || profile().color,
    },
    key = JSON.stringify(msg);
  if (key === net.last) return;
  net.last = key;
  try {
    net.ws.send(key);
  } catch {}
}
// Andra spelare i samma värld som du, för renderaren.
function remotesHere() {
  const here = worldKey();
  return [...remotes.values()].filter((r) => r.world === here);
}

// ---- Chatt ----
function sendChat(text) {
  text = text.trim().slice(0, 140);
  if (!text || net.status !== 'online') return;
  try {
    net.ws.send(JSON.stringify({ t: 'chat', text }));
  } catch {}
  // Din egen bubbla syns direkt för dig.
  net.myChat = text;
  net.myChatUntil = performance.now() + 7000;
}
function addChatLine(name, text, mine) {
  chatLog.push({ name, text, mine, at: performance.now() });
  if (chatLog.length > 6) chatLog.shift();
  renderChatLog();
}
function renderChatLog() {
  const box = $('chatLog');
  if (!box) return;
  box.replaceChildren(
    ...chatLog.map((c) => {
      const line = document.createElement('div');
      line.className = 'chatLine' + (c.mine ? ' mine' : '');
      const who = document.createElement('b');
      who.textContent = c.name.split(' ')[0] + ': ';
      line.append(who, document.createTextNode(c.text));
      return line;
    }),
  );
  box.classList.toggle('show', chatLog.length > 0);
  clearTimeout(renderChatLog.timer);
  renderChatLog.timer = setTimeout(() => box.classList.remove('show'), 14000);
}
function chatOpen() {
  return !$('chatForm').hidden;
}
function openChat() {
  if (net.status !== 'online') {
    toast(
      serverUrl()
        ? 'Inte ansluten till servern just nu.'
        : 'Chatten fungerar när spelet körs från servern.',
    );
    return;
  }
  document.exitPointerLock?.();
  keys.clear();
  $('chatForm').hidden = false;
  $('chatInput2').value = '';
  $('chatInput2').focus();
  $('chatLog').classList.add('show');
}
function closeChat() {
  $('chatForm').hidden = true;
  $('chatInput2').blur();
}
$('chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  sendChat($('chatInput2').value);
  closeChat();
});
$('chatInput2').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    closeChat();
  }
});
$('chatBtn').addEventListener('click', () => (chatOpen() ? closeChat() : openChat()));

function updateOnlineBadge() {
  const b = $('onlineBadge');
  if (!b) return;
  const url = serverUrl();
  b.hidden = !url;
  b.className = 'pill online ' + net.status;
  b.textContent =
    net.status === 'online'
      ? '● ' + (remotes.size + 1) + ' online'
      : net.status === 'connecting'
        ? '○ ansluter'
        : '○ offline';
  $('chatBtn').hidden = net.status !== 'online';
}

// Klick på "N online" visar vilka som är inne.
$('onlineBadge').style.cursor = 'pointer';
$('onlineBadge').addEventListener('click', () => {
  if (net.status !== 'online' || modal) return;
  const list = [...remotes.values()];
  dialog(
    list.length + 1 + ' online',
    '<div class="course"><span><strong>' +
      esc(playerName()) +
      '</strong> (du)</span><span class="badge">' +
      esc(PLACE_TEXT[world?.id] || 'hemma') +
      '</span></div>' +
      list
        .map(
          (r) =>
            '<div class="course"><span>' +
            esc(r.name) +
            '</span><span class="badge">' +
            esc(
              r.world.startsWith('home')
                ? 'hemma'
                : r.world.startsWith('work')
                  ? 'på extrajobbet'
                  : PLACE_TEXT[r.world] || r.world,
            ) +
            '</span></div>',
        )
        .join(''),
    [{ label: 'Stäng', primary: true, run: close }],
    'Spelare',
  );
});

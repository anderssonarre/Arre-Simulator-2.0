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
function serverUrl() {
  let custom = null;
  try {
    custom =
      new URLSearchParams(location.search).get('server') || localStorage.getItem('arre_server');
  } catch {}
  if (custom) return custom;
  if (location.protocol === 'http:' || location.protocol === 'https:')
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  return null;
}
// Hem och extrajobb är privata, så de får ett eget namn per spelare.
function worldKey() {
  if (!world) return 'outdoor';
  return world.id === 'home' || world.id === 'work' ? world.id + ':' + (net.id ?? 0) : world.id;
}
function onlineConnect() {
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
      JSON.stringify({ t: 'hello', name: p.name, character: p.id, color: out?.color || p.color }),
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
  } else if (m.t === 'full') {
    toast('Servern är full just nu. Du spelar ensam så länge.');
    net.manualClose = true;
  }
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
  for (const r of remotes.values()) {
    const k = 1 - Math.exp(-dt * 12);
    r.x += (r.tx - r.x) * k;
    r.y += (r.ty - r.y) * k;
  }
  if (net.status !== 'online' || !net.ws || !state) return;
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

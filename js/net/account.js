// Spelarnamn, konton och sparning på servern.
// Utan server sparas allt bara i webbläsaren, precis som förut.
'use strict';
const ACCOUNT_KEY = 'arre_simulator_2_account';
const account = { token: null, name: null };
try {
  Object.assign(account, JSON.parse(localStorage.getItem(ACCOUNT_KEY) || '{}'));
} catch {}
function storeAccount() {
  try {
    if (account.token) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch {}
}
// Namnet andra ser: ditt eget spelarnamn, annars karaktärens namn.
function playerName() {
  return (state?.nickname || '').trim() || profile()?.name || 'Spelare';
}
function cleanNick(s) {
  return String(s || '')
    .replace(/[\u0000-\u001f]/g, '')
    .trim()
    .slice(0, 20);
}

// ---- Anrop till servern ----
async function api(path, opts = {}) {
  const r = await fetch(path, {
    method: opts.method || 'GET',
    headers: {
      'content-type': 'application/json',
      ...(account.token ? { authorization: 'Bearer ' + account.token } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    keepalive: !!opts.keepalive,
  });
  let data = {};
  try {
    data = await r.json();
  } catch {}
  if (r.status === 401 && path === '/api/save') {
    account.token = null;
    storeAccount();
    updateAccountUI();
    toast('Du har loggats ut. Logga in igen för att spara på servern.');
  }
  if (!r.ok)
    throw Object.assign(new Error(data.error || 'Servern svarade inte.'), { status: r.status });
  return data;
}
function accountsAvailable() {
  return !!serverInfo?.accounts;
}

// ---- Sparning på servern ----
let cloudTimer = null,
  cloudBusy = false;
// Anropas från save(). Laddar upp högst var 15:e sekund.
function scheduleCloudSave() {
  if (!account.token || !accountsAvailable() || !state || cloudTimer) return;
  cloudTimer = setTimeout(cloudSaveNow, 15000);
}
async function cloudSaveNow(keepalive = false) {
  clearTimeout(cloudTimer);
  cloudTimer = null;
  if (!account.token || !state || cloudBusy) return;
  cloudBusy = true;
  try {
    await api('/api/save', { method: 'PUT', body: { save: state }, keepalive });
  } catch {
  } finally {
    cloudBusy = false;
  }
}
window.addEventListener('pagehide', () => {
  if (account.token && state && JSON.stringify(state).length < 60000) cloudSaveNow(true);
});
// Hämtar sparningen från servern och använder den om den är nyare än den i webbläsaren.
async function pullCloudSave() {
  if (!account.token || !accountsAvailable()) return false;
  try {
    const { save: cloud, savedAt } = await api('/api/save');
    if (!cloud) return false;
    let local = null;
    try {
      local = JSON.parse(safeStorage() || 'null');
    } catch {}
    if (local && (local.savedAt || 0) >= savedAt) return false;
    validate(cloud);
    localStorage.setItem(SAVE, JSON.stringify(cloud));
    return true;
  } catch {
    return false;
  }
}

// ---- Startskärmen och kontorutan ----
function updateAccountUI() {
  const row = $('accountRow');
  if (!row) return;
  row.hidden = !accountsAvailable();
  $('accountText').textContent = account.token
    ? 'Inloggad som ' + account.name + ' · sparas på servern'
    : 'Logga in så sparas spelet på servern och följer med till andra datorer.';
  $('accountButton').textContent = account.token ? 'Logga ut' : 'Logga in';
  $('continueButton').hidden = !safeStorage();
  if (account.token && !$('nickInput').value) $('nickInput').value = account.name;
  const badge = $('startBadge');
  if (badge)
    badge.textContent = serverInfo ? 'Campus Vasa HD · online' : 'Campus Vasa HD · offline';
}
function accountDialog(message = '') {
  dialog(
    'Konto',
    '<p>Med ett konto sparas spelet på servern. Då kan du fortsätta från vilken dator eller mobil som helst.</p>' +
      '<label class="field"><span>Namn</span><input id="accName" maxlength="20" autocomplete="username" value="' +
      esc(account.name || $('nickInput').value || '') +
      '"></label><label class="field"><span>Lösenord (minst 6 tecken)</span><input id="accPass" type="password" maxlength="200" autocomplete="current-password"></label>' +
      '<p class="sub" id="accError" style="color:#ffacac">' +
      esc(message) +
      '</p>',
    [
      { label: 'Logga in', primary: true, run: () => accountSubmit('login') },
      { label: 'Skapa konto', run: () => accountSubmit('register') },
      { label: 'Avbryt', run: close },
    ],
    'Spara online',
  );
  setTimeout(() => $(account.name ? 'accPass' : 'accName')?.focus(), 50);
  $('accPass').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') accountSubmit('login');
  });
}
async function accountSubmit(kind) {
  const name = $('accName').value.trim(),
    password = $('accPass').value;
  $('accError').textContent = kind === 'login' ? 'Loggar in …' : 'Skapar konto …';
  try {
    const r = await api('/api/' + kind, { method: 'POST', body: { name, password } });
    account.token = r.token;
    account.name = r.name;
    storeAccount();
    const pulled = await pullCloudSave();
    // Spelar man redan och servern inte har något, laddas nuvarande spel upp direkt.
    if (state && !pulled) cloudSaveNow();
    close();
    updateAccountUI();
    toast(
      kind === 'register'
        ? 'Kontot är skapat. Spelet sparas nu på servern.'
        : pulled
          ? 'Inloggad. Din sparning från servern är hämtad.'
          : 'Inloggad som ' + r.name + '.',
    );
    if (pulled && active) start(validate(JSON.parse(safeStorage())));
  } catch (e) {
    const el = $('accError');
    if (el) el.textContent = e.message;
  }
}
async function logout() {
  if (state) await cloudSaveNow();
  try {
    await api('/api/logout', { method: 'POST' });
  } catch {}
  account.token = null;
  storeAccount();
  updateAccountUI();
  toast('Utloggad. Spelet sparas fortfarande i den här webbläsaren.');
}
$('accountButton').addEventListener('click', () => (account.token ? logout() : accountDialog()));
// När sidan laddas: leta efter servern och hämta en nyare sparning om du är inloggad.
(async () => {
  await findServer();
  if (account.token) await pullCloudSave();
  updateAccountUI();
})();

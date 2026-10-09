// Campustidningen: spelet berättar för servern vad som händer (femmor, nya vänner, klarade
// uppdrag ...), och varje måndag kommer ett nytt nummer om förra veckan (se server/paper.js).
// Tidningen finns bara när spelet körs från servern, och läses vid stället i W33 eller i menyn.
'use strict';
function paperAvailable() {
  return !!serverInfo?.accounts;
}
// Skickar en händelse till veckans tidning. Bara typ och korta fält, aldrig fritext.
function reportHappening(kind, fields = {}) {
  if (!paperAvailable() || !state) return;
  fetch('/api/happening', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, namn: playerName(), ...fields }),
    keepalive: true,
  }).catch(() => {});
}
async function fetchPaper(publishNow = false) {
  try {
    const r = await fetch('/api/paper' + (publishNow ? '?publish=now' : ''), { cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}
async function showPaper() {
  if (!paperAvailable())
    return toast('Campustidningen finns när ni spelar online på servern.');
  const d = await fetchPaper();
  if (!d) return toast('Tidningen gick inte att hämta just nu.');
  const issue = d.issue;
  if (issue) {
    state.paperRead = issue.week;
    save();
  }
  dialog(
    issue ? issue.rubrik : 'Campustidningen',
    (issue
      ? '<p class="sub">Campustidningen · ' +
        esc(issue.week.replace('-v', ', vecka ')) +
        '</p>' +
        issue.artiklar
          .map((a) => '<h3>' + esc(a.rubrik) + '</h3><p>' + esc(a.text) + '</p>')
          .join('')
      : '<p>Det första numret kommer på måndag, om förra veckan.</p>') +
      (d.nytt?.length
        ? '<div class="info"><strong>Senaste nytt den här veckan</strong><br>' +
          d.nytt.map(esc).join('<br>') +
          '</div>'
        : ''),
    [{ label: 'Lägg ifrån dig tidningen', primary: true, run: close }],
    'Campustidningen',
  );
}
// Säger till när ett nytt nummer har kommit (anropas när spelet startar).
async function paperNotice() {
  if (!paperAvailable()) return;
  const d = await fetchPaper();
  if (d?.issue && d.issue.week !== state?.paperRead)
    setTimeout(() => toast('Nytt nummer av Campustidningen! Läs det vid stället i W33 eller i menyn.'), 6000);
}
// Tidningsstället vid entrén i W33 (anropas från build i world/build.js).
function placePaperStand() {
  const w = worlds.w33,
    [x, y] = coffeeSpot(w, 39.5, 26.5);
  obj(w, x, y, 'paper', 'Campustidningen · veckans nummer', showPaper, {
    height: 1,
    sprite: paperSprite(),
  });
}
function paperSprite() {
  if (cache.paperStand) return cache.paperStand;
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#10192135';
  g.beginPath();
  g.ellipse(48, 122, 34, 5, 0, 0, 7);
  g.fill();
  g.fillStyle = '#2f5d73';
  g.beginPath();
  g.roundRect(18, 40, 60, 80, 6);
  g.fill();
  g.fillStyle = '#f2efe6';
  g.fillRect(24, 22, 48, 54);
  g.fillStyle = '#16332d';
  g.font = 'bold 10px system-ui';
  g.textAlign = 'center';
  g.fillText('CAMPUS', 48, 35);
  g.fillText('TIDNINGEN', 48, 46);
  g.fillStyle = '#9aa8a6';
  for (let i = 0; i < 5; i++) g.fillRect(28, 52 + i * 4, 40, 2);
  cache.paperStand = c;
  return c;
}

// Anonym statistik till servern (se server/stats.js och sidan /stats) och "Tyck till".
// Inga namn skickas, bara siffror som hur lång en session var eller vilket betyg en tenta gav.
'use strict';
const sessionStart = Date.now();
let sessionSent = false;
function track(kind, data = {}) {
  if (!serverInfo) return;
  fetch('/api/event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, data }),
    keepalive: true,
  }).catch(() => {});
}
// Sessionens längd skickas när sidan stängs.
addEventListener('pagehide', () => {
  if (!serverInfo || !state || sessionSent) return;
  const minutes = (Date.now() - sessionStart) / 60000;
  if (minutes < 1) return;
  sessionSent = true;
  navigator.sendBeacon?.(
    '/api/event',
    new Blob([JSON.stringify({ kind: 'session', data: { minutes } })], {
      type: 'application/json',
    }),
  );
});
function feedbackDialog() {
  dialog(
    'Tyck till',
    '<p>Tre korta frågor. Svaren är anonyma och hjälper oss bestämma vad som ska bli bättre.</p>' +
      '<label class="sub">Vad var roligast?</label><input type="text" id="fbFun" maxlength="300">' +
      '<label class="sub">Var fastnade du eller blev förvirrad?</label><input type="text" id="fbStuck" maxlength="300">' +
      '<label class="sub">Vad saknade du?</label><input type="text" id="fbMissing" maxlength="300">',
    [
      {
        label: 'Skicka',
        primary: true,
        run: () => {
          const body = {
            fun: $('fbFun').value,
            stuck: $('fbStuck').value,
            missing: $('fbMissing').value,
          };
          if (!body.fun.trim() && !body.stuck.trim() && !body.missing.trim())
            return toast('Skriv något i minst en ruta.');
          fetch('/api/feedback', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          })
            .then((r) => toast(r.ok ? 'Tack! Svaret är skickat.' : 'Kunde inte skicka just nu.'))
            .catch(() => toast('Kunde inte skicka just nu.'));
          menu();
        },
      },
      { label: 'Tillbaka', run: menu },
    ],
    'Speltest',
  );
}

// Anonym statistik: spelet skickar små händelser (en tenta, en vecka, en session) och servern
// räknar ihop dem. Inga namn eller konton sparas. Sidan /stats jämför med balansmålen i planen.
// Sätt STATS_KEY för att kräva /stats?key=... för att se spelarnas fritextsvar.
'use strict';
const STEPS = ['world:outdoor', 'world:w33', 'föreläsning', 'lunch', 'prata', 'jobb', 'sov'];
const num = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0);
const str = (v, n) =>
  String(v ?? '')
    .slice(0, n)
    .trim();

// Gör om en händelse från spelet till räknare. Okända händelser ignoreras.
function countersFor(e) {
  const d = e?.data || {};
  switch (e?.kind) {
    case 'session': {
      const m = num(d.minutes, 0, 600);
      return { sessions: 1, sessionMinutes: m, sessions20: m >= 20 ? 1 : 0 };
    }
    case 'exam':
      return {
        exams: 1,
        examsFirstTry: d.retake ? 0 : 1,
        examsFirstPass: !d.retake && d.pass ? 1 : 0,
        gradeSum: d.pass ? num(d.grade, 1, 5) : 0,
        gradeN: d.pass ? 1 : 0,
      };
    case 'week':
      return { weeks: 1, weeksDebt: d.debt > 0 ? 1 : 0, weekJobs: num(d.jobs, 0, 50) };
    case 'tutorial':
      return STEPS.includes(d.step) ? { ['tutorial:' + d.step]: 1 } : null;
    case 'start':
      return { starts: 1 };
    case 'term':
      return { terms: 1 };
    default:
      return null;
  }
}
function cleanFeedback(d) {
  const f = { fun: str(d?.fun, 300), stuck: str(d?.stuck, 300), missing: str(d?.missing, 300) };
  return f.fun || f.stuck || f.missing ? { ...f, created: Date.now() } : null;
}
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

function statsPage(s, feedback) {
  const ratio = (a, b) => (s[b] ? s[a] / s[b] : null),
    pct = (v) => (v == null ? '–' : Math.round(v * 100) + ' %'),
    dec = (v) => (v == null ? '–' : v.toFixed(1).replace('.', ',')),
    row = (name, value, goal, good) =>
      '<tr><td>' +
      name +
      '</td><td><b>' +
      value +
      '</b></td><td>' +
      goal +
      '</td><td>' +
      (good == null ? '' : good ? '✓' : '✗') +
      '</td></tr>';
  const jobs = ratio('weekJobs', 'weeks'),
    first = ratio('examsFirstPass', 'examsFirstTry'),
    grade = ratio('gradeSum', 'gradeN'),
    debt = ratio('weeksDebt', 'weeks'),
    minutes = ratio('sessionMinutes', 'sessions'),
    long = ratio('sessions20', 'sessions'),
    funnel = STEPS.map(
      (k, i) =>
        '<tr><td>' +
        (i + 1) +
        '. ' +
        esc(k) +
        '</td><td><b>' +
        (s['tutorial:' + k] || 0) +
        '</b></td></tr>',
    ).join('');
  return (
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arre Simulator · statistik</title>' +
    '<style>body{font:15px system-ui;margin:24px auto;max-width:760px;padding:0 16px;background:#0e1820;color:#e6eef2}table{border-collapse:collapse;width:100%;margin:8px 0 24px}td,th{border-bottom:1px solid #2a3a46;padding:8px;text-align:left}th{color:#9cacb8;font-weight:600}h1{font-size:22px}h2{font-size:17px;margin-top:28px}.q{background:#15232e;border-radius:10px;padding:10px 12px;margin:8px 0}.q small{color:#9cacb8}</style>' +
    '<h1>Arre Simulator · statistik</h1><p>Anonyma siffror från alla som spelat på servern: ' +
    (s.starts || 0) +
    ' nya spel, ' +
    (s.sessions || 0) +
    ' sessioner, ' +
    (s.weeks || 0) +
    ' spelveckor.</p><h2>Balans mot målen</h2><table><tr><th>Mått</th><th>Nu</th><th>Mål</th><th></th></tr>' +
    row(
      'Extrajobb per vecka',
      dec(jobs),
      '1–2 pass',
      jobs == null ? null : jobs >= 1 && jobs <= 2,
    ) +
    row(
      'Tentor godkända på första försöket',
      pct(first),
      '70–80 %',
      first == null ? null : first >= 0.7 && first <= 0.8,
    ) +
    row('Betygssnitt', dec(grade), 'cirka 3', grade == null ? null : grade >= 2.6 && grade <= 3.4) +
    row('Veckor med hyresskuld', pct(debt), 'under 20 %', debt == null ? null : debt < 0.2) +
    row(
      'Session i snitt',
      minutes == null ? '–' : Math.round(minutes) + ' min',
      'minst 20 min',
      minutes == null ? null : minutes >= 20,
    ) +
    row('Sessioner på minst 20 min', pct(long), '', null) +
    '</table><h2>Första dagen: hur långt nya spelare kommer</h2><table><tr><th>Steg</th><th>Antal</th></tr>' +
    funnel +
    '</table>' +
    (feedback
      ? '<h2>Tyck till</h2>' +
        (feedback.length
          ? feedback
              .map(
                (f) =>
                  '<div class="q"><small>' +
                  new Date(f.created).toLocaleString('sv-FI', { timeZone: 'Europe/Helsinki' }) +
                  '</small>' +
                  (f.fun ? '<div><b>Roligast:</b> ' + esc(f.fun) + '</div>' : '') +
                  (f.stuck ? '<div><b>Fastnade:</b> ' + esc(f.stuck) + '</div>' : '') +
                  (f.missing ? '<div><b>Saknades:</b> ' + esc(f.missing) + '</div>' : '') +
                  '</div>',
              )
              .join('')
          : '<p>Inga svar än.</p>')
      : '<p>Svaren från "Tyck till" visas med rätt nyckel.</p>')
  );
}
// Samma siffror som statistiksidan, jämförda med balansmålen i planen. För speltestaren.
function summary(s) {
  const ratio = (a, b) => (s[b] ? s[a] / s[b] : null),
    round = (v, d = 2) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d),
    m = (namn, värde, mål, ok) => ({ namn, värde: round(värde), mål, ok: värde == null ? null : ok });
  const jobs = ratio('weekJobs', 'weeks'),
    first = ratio('examsFirstPass', 'examsFirstTry'),
    grade = ratio('gradeSum', 'gradeN'),
    debt = ratio('weeksDebt', 'weeks'),
    minutes = ratio('sessionMinutes', 'sessions'),
    long = ratio('sessions20', 'sessions');
  return {
    underlag: {
      sessioner: s.sessions || 0,
      starter: s.starts || 0,
      veckor: s.weeks || 0,
      tentor: s.exams || 0,
      terminer: s.terms || 0,
    },
    mått: [
      m('Extrajobb per vecka', jobs, '1–2', jobs >= 1 && jobs <= 2),
      m('Tentor godkända på första försöket', first, '0,70–0,80', first >= 0.7 && first <= 0.8),
      m('Betygssnitt', grade, 'cirka 3', grade >= 2.5 && grade <= 3.5),
      m('Andel veckor med hyresskuld', debt, 'låg, under 0,25', debt < 0.25),
      m('Minuter per session', minutes, 'minst 20', minutes >= 20),
      m('Andel sessioner över 20 minuter', long, 'så hög som möjligt', null),
    ],
    förstaDagen: STEPS.map((k) => ({ steg: k, antal: s['tutorial:' + k] || 0, av: s.starts || 0 })),
  };
}
module.exports = { countersFor, cleanFeedback, statsPage, summary, STEPS };

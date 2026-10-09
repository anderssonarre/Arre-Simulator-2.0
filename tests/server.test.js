// Snabba tester som körs med `node --test tests/*.test.js` (och på GitHub vid varje push).
// De kollar det som servern och spelet delar: klockan, festen, statistiken och AI-instruktionen.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { CLOCK, clockRate, gameMinutesAt, partyStatus } = require('../js/shared/clock.js');
const stats = require('../server/stats.js');
const ai = require('../server/ai.js');

test('dagen går i normal takt, natten sex gånger fortare', () => {
  const t = CLOCK.epoch;
  assert.equal(gameMinutesAt(t) / 60, 7); // måndag 07:00
  assert.equal(gameMinutesAt(t + 960e3) / 60, 23);
  assert.equal(gameMinutesAt(t + 1040e3) / 60, 31); // 07:00 nästa dag
  assert.equal(clockRate(12), 1);
  assert.equal(clockRate(2), 6);
});

test('klockan går alltid framåt', () => {
  let last = -1;
  for (let s = 0; s < 5000; s += 7) {
    const m = gameMinutesAt(CLOCK.epoch + s * 1000);
    assert.ok(m > last);
    last = m;
  }
});

test('fredagsfesten är fredag 20-22 finsk tid', () => {
  const fri = Date.parse('2026-10-09T17:30:00Z'); // 20:30 i Helsingfors
  assert.equal(partyStatus(fri).active, true);
  assert.equal(partyStatus(fri - 3 * 36e5).active, false);
  const thu = Date.parse('2026-10-08T12:00:00Z');
  assert.equal(new Date(partyStatus(thu).nextAt).toISOString(), '2026-10-09T17:00:00.000Z');
});

test('statistiken räknar bara kända händelser', () => {
  assert.deepEqual(stats.countersFor({ kind: 'week', data: { debt: 5, jobs: 2 } }), {
    weeks: 1,
    weeksDebt: 1,
    weekJobs: 2,
  });
  assert.equal(stats.countersFor({ kind: 'hack', data: {} }), null);
  assert.equal(stats.countersFor({ kind: 'tutorial', data: { step: 'okänt' } }), null);
  assert.equal(stats.cleanFeedback({ fun: '   ' }), null);
});

test('statistiksidan escapar fritext', () => {
  const html = stats.statsPage({}, [{ created: 0, fun: '<script>x</script>' }]);
  assert.ok(!html.includes('<script>x'));
});

test('AI-instruktionen kortar allt spelet skickar', () => {
  const p = ai.buildPrompt({
    person: { name: 'A'.repeat(500) },
    context: { playerName: 'Zeb', drunk: true },
    memories: ['katt'],
  });
  assert.ok(!p.includes('A'.repeat(41)));
  assert.ok(p.includes('berusad'));
  assert.ok(p.includes('katt'));
});

test('dagens liv tar bara med kända personer och korta texter', () => {
  const b = { people: [{ id: 'axel' }, { id: 'otto' }] };
  const d = ai.cleanDay(
    {
      personer: {
        axel: { tanke: 'x'.repeat(500), hälsningar: ['Tja!', '', 'Hej', 'Yo', 'För många'] },
        okänd: { tanke: 'Hej' },
      },
      samtal: [
        { a: 'axel', b: 'otto', repliker: ['Fest?', 'Klart.'], omSpelaren: 'ja' },
        { a: 'axel', b: 'axel', repliker: ['a', 'b'] },
        { a: 'axel', b: 'okänd', repliker: ['a', 'b'] },
        { a: 'otto', b: 'axel', repliker: ['bara en'] },
      ],
    },
    b,
  );
  assert.deepEqual(Object.keys(d.personer), ['axel']);
  assert.equal(d.personer.axel.tanke.length, 200);
  assert.deepEqual(d.personer.axel.hälsningar, ['Tja!', 'Hej', 'Yo']);
  assert.equal(d.samtal.length, 1);
  assert.equal(d.samtal[0].omSpelaren, false);
});

test('dagens instruktion innehåller personerna och vilka som ses', () => {
  const p = ai.buildDayPrompt({
    playerName: 'Zeb',
    people: [{ id: 'axel', name: 'Axel', plan: '9 föreläsning', mood: 'glad' }],
    pairs: [{ a: 'axel', b: 'otto', why: 'vänner' }],
    news: ['Otto och Ida är osams.'],
  });
  assert.ok(p.includes('axel: Axel'));
  assert.ok(p.includes('axel och otto (vänner)'));
  assert.ok(p.includes('osams'));
});

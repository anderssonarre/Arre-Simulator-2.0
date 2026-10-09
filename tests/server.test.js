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

test('dagens liv tar bara med kända personer, kända spelare och korta texter', () => {
  const b = { people: [{ id: 'axel' }, { id: 'otto' }], players: ['Zeb', 'Arvid'] };
  const d = ai.cleanDay(
    {
      personer: { axel: { tanke: 'x'.repeat(500) }, okänd: { tanke: 'Hej' } },
      samtal: [
        { a: 'axel', b: 'otto', repliker: ['Fest?', 'Klart.'], om: 'zeb' },
        { a: 'otto', b: 'axel', repliker: ['Hej', 'Tja'], om: 'Någon annan' },
        { a: 'axel', b: 'axel', repliker: ['a', 'b'] },
        { a: 'axel', b: 'okänd', repliker: ['a', 'b'] },
        { a: 'otto', b: 'axel', repliker: ['bara en'] },
      ],
    },
    b,
  );
  assert.deepEqual(Object.keys(d.personer), ['axel']);
  assert.equal(d.personer.axel.tanke.length, 200);
  assert.equal(d.samtal.length, 2);
  assert.equal(d.samtal[0].om, 'Zeb');
  assert.equal(d.samtal[1].om, null);
});

test('hälsningarna gäller bara personer som skickades med', () => {
  const g = ai.cleanGreet(
    { axel: ['Tja!', '', 'Hej', 'Yo', 'För många'], okänd: ['Hej'], otto: 'inte en lista' },
    { people: [{ id: 'axel' }, { id: 'otto' }] },
  );
  assert.deepEqual(g, { axel: ['Tja!', 'Hej', 'Yo'] });
});

test('dagens instruktion innehåller personerna, spelarna och vilka som ses', () => {
  const p = ai.buildDayPrompt({
    people: [{ id: 'axel', name: 'Axel', plan: '9 föreläsning', mood: 'glad' }],
    pairs: [{ a: 'axel', b: 'otto', why: 'vänner' }],
    news: ['Otto och Ida är osams.'],
    players: ['Zeb', 'Arvid'],
  });
  assert.ok(p.includes('axel: Axel'));
  assert.ok(p.includes('axel och otto (vänner)'));
  assert.ok(p.includes('Zeb, Arvid'));
  assert.ok(p.includes('osams'));
});

test('AI-taket räknas per spelare, inte per skolnät', () => {
  // Standardtaket är 60 i timmen per spelare och åtta gånger så mycket per IP.
  for (let i = 0; i < 60; i++) assert.ok(ai.allowed('p:anna', '10.0.0.1'));
  assert.equal(ai.allowed('p:anna', '10.0.0.1'), false);
  // En annan spelare på samma nät kan fortfarande prata.
  assert.ok(ai.allowed('p:bertil', '10.0.0.1'));
});

test('svaren läses från verktygsanropet, även när personerna kommer som lista', async () => {
  const real = global.fetch;
  let sent;
  global.fetch = async (url, opts) => {
    sent = JSON.parse(opts.body);
    return {
      ok: true,
      json: async () => ({
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            name: 'vardag',
            input: {
              personer: [{ id: 'axel', tanke: 'Fest ikväll.' }, { id: 'okänd', tanke: 'x' }],
              samtal: [{ a: 'axel', b: 'otto', repliker: ['Kommer du?', 'Klart.'], om: 'Zeb' }],
            },
          },
        ],
      }),
    };
  };
  try {
    const d = await ai.dayLife({ people: [{ id: 'axel' }, { id: 'otto' }], players: ['Zeb'] });
    assert.equal(sent.tool_choice.name, 'vardag');
    assert.deepEqual(d.personer, { axel: { tanke: 'Fest ikväll.' } });
    assert.equal(d.samtal[0].om, 'Zeb');
  } finally {
    global.fetch = real;
  }
});

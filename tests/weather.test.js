// Tester för vädret: årstiderna ska märkas, vädret ska vara samma för alla och skifta mjukt.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

function load(extra = {}) {
  const ctx = {
    console,
    state: { day: 1, hour: 12 },
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    seeded(n) {
      return () => {
        n = (Math.imul(1664525, n) + 1013904223) >>> 0;
        return n / 4294967296;
      };
    },
    hashId: (id) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0),
    ...extra,
  };
  vm.createContext(ctx);
  for (const f of ['js/data/weather.js', 'js/game/seasons.js', 'js/game/weather.js'])
    vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
  // const-värden syns inte på kontexten av sig själva.
  for (const k of ['YEAR', 'VÄDERTYPER', 'weatherPlan', 'weatherKey']) ctx[k] = vm.runInContext(k, ctx);
  return ctx;
}
const daysIn = (c, m) => [...Array(c.YEAR.dagar).keys()].map((i) => i + 1).filter((d) => c.monthIndex(d) === m);

test('vintern är kall och snöig, sommaren varm och solig', () => {
  const c = load();
  const stats = (m) => {
    let temp = 0,
      snow = 0,
      wet = 0,
      sun = 0,
      n = 0;
    for (let year = 0; year < 10; year++)
      for (const d of daysIn(c, m))
        for (const h of [3, 9, 15, 21]) {
          const w = c.weatherAt(d + year * c.YEAR.dagar, h);
          temp += w.temp;
          if (w.ned > 0.05) (wet++, w.snö && snow++);
          if (w.typ === 'sol') sun++;
          n++;
        }
    return { temp: temp / n, snow: snow / Math.max(1, wet), sun: sun / n };
  };
  const jan = stats(4),
    jul = stats(10);
  assert.ok(jan.temp < -3, 'januari ' + jan.temp);
  assert.ok(jul.temp > 13, 'juli ' + jul.temp);
  assert.ok(jan.snow > 0.8, 'nederbörden i januari är snö');
  assert.strictEqual(jul.snow, 0);
  assert.ok(jul.sun > jan.sun);
});

test('alla vädertyper förekommer och vädret ändras under året', () => {
  const c = load(),
    seen = new Set();
  for (let d = 1; d <= c.YEAR.dagar * 5; d++) for (const h of [3, 9, 15, 21]) seen.add(c.weatherAt(d, h).typ);
  for (const k of Object.keys(c.VÄDERTYPER)) assert.ok(seen.has(k), k);
});

test('vädret skiftar mjukt mellan perioderna', () => {
  const c = load();
  for (let d = 1; d < 60; d++)
    for (let h = 0; h < 24; h += 0.25) {
      const a = c.weatherAt(d, h),
        b = c.weatherAt(d, h + 0.25 >= 24 ? 0 : h + 0.25);
      if (h + 0.25 >= 24) continue;
      assert.ok(Math.abs(a.moln - b.moln) < 0.3, 'dag ' + d + ' kl ' + h);
      assert.ok(Math.abs(a.temp - b.temp) <= 2);
    }
  // Över midnatt också.
  for (let d = 1; d < 60; d++)
    assert.ok(Math.abs(c.weatherAt(d, 23.99).moln - c.weatherAt(d + 1, 0).moln) < 0.05);
});

test('online följer vädret serverns dag', () => {
  const online = { status: 'online', clock: { offset: 5 } },
    c = load({ net: online, sharedClock: () => true }),
    off = load();
  // Spelare med dag 10 och offset 5 har serverns dag 5.
  assert.deepStrictEqual(c.weatherKey(10), 5);
  const a = c.weatherAt(10, 14),
    b = off.weatherAt(5, 14);
  assert.strictEqual(a.typ === b.typ || c.monthIndex(10) !== off.monthIndex(5), true);
});

test('regn flyttar in folk, men inte fester', () => {
  const c = load();
  let rainy = null;
  for (let d = 1; d < 200 && !rainy; d++) if (c.weatherAt(d, 14).ned > 0.5 && !c.weatherAt(d, 14).snö) rainy = d;
  assert.ok(rainy);
  const p = c.weatherPlan('otto', rainy, 14, { where: 'outdoor', activity: 'paus' });
  assert.notStrictEqual(p.where, 'outdoor');
  const f = c.weatherPlan('otto', rainy, 14, { where: 'outdoor', activity: 'fest' });
  assert.strictEqual(f.where, 'outdoor');
});

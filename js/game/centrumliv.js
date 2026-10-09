// Ställen i Vasa centrum: bio, teater, buffé, fik, bokhandel, spelbutik, loppis och kyrkan.
// Innehållet finns i STÄLLEN i js/data/centrum-platser.js.
'use strict';
function venueOpen(v) {
  const h = state.hour < 6 ? state.hour + 24 : state.hour,
    d = state.hour < 6 ? state.day - 1 : state.day;
  if (v.öppet.dagar && !v.öppet.dagar.includes(WEEKDAYS[weekdayIndex(d)])) return false;
  return h >= v.öppet.från && h < v.öppet.till;
}
function venueHours(v) {
  return (v.öppet.dagar ? v.öppet.dagar.join(', ') + ' ' : '') + v.öppet.från + '–' + (v.öppet.till % 24);
}
function venueSprite(ikon) {
  const key = 'venue' + ikon;
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#3a3f44';
  g.fillRect(29, 56, 6, 72);
  g.fillStyle = '#f3efe4';
  g.beginPath();
  g.roundRect(4, 4, 56, 56, 12);
  g.fill();
  g.strokeStyle = '#1f3a4a';
  g.lineWidth = 4;
  g.stroke();
  g.font = '34px system-ui';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(ikon, 32, 34);
  cache[key] = c;
  return c;
}
function placeVenues() {
  const w = worlds.centrum;
  if (!w) return;
  for (const [id, v] of Object.entries(STÄLLEN)) {
    const p = v.poi ? centrumPoi(v.poi) : centroid(centrumHouse(v.hus));
    if (!p) {
      console.warn('Ställe ' + id + ': hittar inte ' + (v.poi || v.hus) + ' på kartan');
      continue;
    }
    const [x, y] = nearestFree(w, p[0], p[1]);
    const o = obj(w, x, y, 'venue', v.namn, () => venueMenu(id), { height: 1.3, sprite: venueSprite(v.ikon) });
    Object.defineProperty(o, 'label', {
      get: () => v.ikon + ' ' + v.namn + (state && !venueOpen(v) ? ' · öppet ' + venueHours(v) : ' · ' + v.val[0].knapp),
      enumerable: true,
    });
  }
}
function venueMenu(id) {
  const v = STÄLLEN[id];
  if (!venueOpen(v)) return toast(v.namn + ' har öppet ' + venueHours(v) + '.');
  state.venueDay ??= {};
  dialog(
    v.ikon + ' ' + v.namn,
    '<p class="sub">Du har ' + state.money + ' €.</p>',
    [
      ...v.val.map((val, i) => {
        const done = val.enGångPerDag && state.venueDay[id + i] === state.day;
        return {
          label: val.knapp + (done ? ' (redan idag)' : ''),
          primary: i === 0,
          disabled: done || (val.pris || 0) > state.money,
          run: () => venueChoice(id, i),
        };
      }),
      { label: 'Gå därifrån', run: close },
    ],
    'Centrum',
  );
}
function venueChoice(id, i) {
  const v = STÄLLEN[id],
    val = v.val[i];
  if ((val.pris || 0) > state.money) return toast('Du har inte råd.');
  state.money -= val.pris || 0;
  if (val.enGångPerDag) state.venueDay[id + i] = state.day;
  if (val.tid) advance(val.tid);
  applyEffect(val.effekt || {});
  if (val.tillstånd) changeCond(val.tillstånd);
  if (val.handling) questEvent(val.handling);
  for (const pid of witnessesHere(6)) bump(pid, 1);
  save();
  sound('win');
  dialog(v.ikon + ' ' + v.namn, '<p>' + esc(rand(val.text)) + '</p>', [{ label: 'Klar', primary: true, run: close }], 'Centrum');
}

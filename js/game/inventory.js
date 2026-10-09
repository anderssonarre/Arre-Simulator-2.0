// Väskan: köp saker i kiosken och baren, bär dem med dig och använd dem när du vill, eller
// bjud en kompis. Varor, butiker och väskans storlek finns i js/data/items.js.
// Läget sparas i state.bag: { vara: antal }.
'use strict';
function ensureBag() {
  const b = (state.bag ??= {});
  for (const [k, n] of Object.entries(b))
    if (!VAROR[k] || !Number.isInteger(n) || n <= 0) delete b[k];
  return b;
}
const bagCount = () => Object.values(ensureBag()).reduce((a, n) => a + n, 0);

// ---- Butikerna ----
function shopOpen(shop) {
  const h = state.hour < 6 ? state.hour + 24 : state.hour;
  return h >= shop.öppet.från && h < shop.öppet.till;
}
const clockOf = (h) => String(h % 24).padStart(2, '0') + '.00';
function openShop(id) {
  const shop = BUTIKER[id];
  if (!shopOpen(shop))
    return toast(
      shop.namn + ' är stängd. Öppet ' + clockOf(shop.öppet.från) + '–' + clockOf(shop.öppet.till) + '.',
    );
  const full = bagCount() >= VÄSKA.platser;
  dialog(
    shop.namn,
    '<p>Du har <strong>' +
      state.money +
      ' €</strong>. Väskan: ' +
      bagCount() +
      ' av ' +
      VÄSKA.platser +
      '.</p>' +
      (full ? '<div class="info">Väskan är full. Använd eller bjud bort något först.</div>' : ''),
    [
      ...shop.varor.map((k) => {
        const v = VAROR[k];
        return {
          label: v.ikon + ' ' + v.namn + ' · ' + v.pris + ' €',
          run: () => buy(id, k),
        };
      }),
      { label: 'Klar', primary: true, run: close },
    ],
    'Butik',
  );
}
function buy(shopId, k) {
  const v = VAROR[k];
  if (bagCount() >= VÄSKA.platser) return toast('Väskan är full.');
  if (state.money < v.pris) return toast(v.namn + ' kostar ' + v.pris + ' €. Du har inte råd.');
  state.money -= v.pris;
  const b = ensureBag();
  b[k] = (b[k] || 0) + 1;
  sound('tap');
  save();
  toast(v.ikon + ' ' + v.namn + ' i väskan.');
  openShop(shopId);
}
// Ställer en butik i sitt hus (anropas från build i world/build.js).
function placeShops() {
  for (const [id, shop] of Object.entries(BUTIKER)) {
    const w = worlds[shop.värld];
    if (!w) continue;
    const [x, y] = coffeeSpot(w, shop.x, shop.y);
    const o = obj(w, x, y, 'shop', shop.namn, () => openShop(id), {
      height: 1.05,
      sprite: shopSprite(id),
    });
    Object.defineProperty(o, 'label', {
      get: () =>
        shop.namn +
        (state && !shopOpen(shop)
          ? ' · stängd, öppnar ' + clockOf(shop.öppet.från)
          : ' · ' + shop.varor.map((k) => VAROR[k].ikon).join(' ')),
      enumerable: true,
    });
  }
}

// ---- Väskan ----
function showBag() {
  const b = ensureBag(),
    items = Object.keys(b);
  dialog(
    'Väskan',
    (items.length
      ? '<p>' + bagCount() + ' av ' + VÄSKA.platser + ' platser.</p>'
      : '<p>Väskan är tom. Kiosken i W33 har snacks och baren på Filicia har öl.</p>') +
      conditionsSummary(),
    [
      ...items.map((k) => ({
        label: VAROR[k].ikon + ' ' + VAROR[k].namn + ' ×' + b[k] + ' · använd',
        run: () => useItem(k),
      })),
      { label: 'Stäng', primary: true, run: close },
    ],
    'Väska',
  );
}
function conditionsSummary() {
  const parts = ['berusning', 'illamående', 'koncentration', 'blöt'].map(
    (k) => capital(k) + ' ' + Math.round(cond(k)),
  );
  return '<p class="sub">' + parts.join(' · ') + '</p>';
}
function useItem(k, fromBag = true) {
  const v = VAROR[k],
    b = ensureBag();
  if (fromBag && !b[k]) return;
  if (v.verktyg) return toast(v.ikon + ' ' + v.text);
  if (v.mat && isNauseous())
    return toast('Du mår för illa för att äta. Vatten och vila hjälper.');
  if (fromBag && --b[k] <= 0) delete b[k];
  applyEffect(v.effekt || {});
  changeCond(v.tillstånd || {});
  advance(3);
  // Den som syns full får folk att prata.
  if (k === 'öl' && isDrunk() && state.drunkRumorDay !== state.day) {
    state.drunkRumorDay = state.day;
    addRumor('full', {}, witnessesHere());
  }
  save();
  sound('tap');
  const lvl = k === 'öl' ? condLevel('berusning') : null;
  toast(v.ikon + ' ' + v.text + (lvl ? ' Du är ' + lvl.namn.toLowerCase() + '.' : ''));
  if (modal && $('dialogTag').textContent === 'Väska') showBag();
}

// ---- Bjuda en kompis ----
function treatButtons(p) {
  const b = state.bag ? ensureBag() : {};
  if (!Object.keys(b).length) return [];
  return [{ label: 'Bjud på något', run: () => treatMenu(p) }];
}
function treatMenu(p) {
  const b = ensureBag();
  dialog(
    'Bjud ' + p.name.split(' ')[0],
    '<p>Vad vill du bjuda på?</p>',
    [
      ...Object.keys(b).map((k) => ({
        label: VAROR[k].ikon + ' ' + VAROR[k].namn,
        run: () => treat(p, k),
      })),
      { label: 'Tillbaka', run: () => chat(p) },
    ],
    'Campusfolk',
  );
}
function treat(p, k) {
  const b = ensureBag(),
    v = VAROR[k];
  if (!b[k]) return chat(p);
  if (--b[k] <= 0) delete b[k];
  state.treatDay ??= {};
  // Första gången per dag och person blir ni närmare vänner.
  if (state.treatDay[p.id] !== state.day) {
    state.treatDay[p.id] = state.day;
    bump(p.id, 4);
    gain('happy', 3);
  }
  remember(p, 'you', 'Vill du ha en ' + v.namn.toLowerCase() + '?');
  remember(p, 'npc', v.bjuda || 'Tack!');
  save();
  chat(p);
}
function shopSprite(id) {
  const key = 'shop' + id;
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d'),
    bar = id === 'bar';
  g.fillStyle = '#10192135';
  g.beginPath();
  g.ellipse(64, 122, 56, 6, 0, 0, 7);
  g.fill();
  // Disken
  g.fillStyle = bar ? '#5a3a28' : '#3d5866';
  g.beginPath();
  g.roundRect(8, 62, 112, 60, 6);
  g.fill();
  g.fillStyle = bar ? '#8a5a3c' : '#5f8496';
  g.fillRect(4, 56, 120, 10);
  // Skylt
  g.fillStyle = bar ? '#ffcb83' : '#92e2bf';
  g.beginPath();
  g.roundRect(24, 10, 80, 26, 6);
  g.fill();
  g.fillStyle = '#16332d';
  g.font = 'bold 16px system-ui';
  g.textAlign = 'center';
  g.fillText(bar ? 'BAR' : 'KIOSK', 64, 29);
  // Varor på disken
  g.font = '22px system-ui';
  const icons = bar ? ['🍺', '🍺', '💧'] : ['🥪', '🍫', '🥟', '💧'];
  icons.forEach((s, i) => g.fillText(s, 26 + i * (76 / (icons.length - 1 || 1)), 54));
  cache[key] = c;
  return c;
}

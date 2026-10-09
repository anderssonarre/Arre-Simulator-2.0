// Telefonen: köp en i telefonbutiken i centrum och öppna den med P (eller 📱). Ring kompisar,
// beställ en Uber (eller taxi med en knapptelefon), kolla vädret, banken och kartan.
// Innehållet finns i js/data/telefon.js. Läget sparas i state.phone (modellens id).
'use strict';
let uber = null; // { dest, price, förare, bil, world, x, y, kommer (ms), obj, taxi }
const hasSmart = () => !!TELEFONER[state?.phone]?.smart;

// ---- Telefonbutiken ----
function placePhoneShop() {
  const w = worlds.centrum,
    p = w && centrumPoi(TELEFONBUTIK.poi);
  if (!p) return;
  const [x, y] = nearestFree(w, p[0], p[1]);
  obj(w, x, y, 'venue', TELEFONBUTIK.namn + ' · telefoner', phoneShop, { height: 1.3, sprite: venueSprite('📱') });
}
function phoneShop() {
  dialog(
    TELEFONBUTIK.namn,
    '<p>Du har ' + state.money + ' €.' + (state.phone ? ' Din telefon: ' + esc(TELEFONER[state.phone].namn) + '.' : '') + '</p>',
    [
      ...Object.entries(TELEFONER).map(([id, t]) => ({
        label: t.namn + ' · ' + t.pris + ' €' + (state.phone === id ? ' (din)' : ''),
        disabled: state.phone === id || state.money < t.pris,
        run: () => {
          state.money -= t.pris;
          state.phone = id;
          ledger('Köpte ' + t.namn, -t.pris);
          save();
          sound('win');
          dialog(
            t.namn,
            '<p>' + esc(t.text) + '</p><p>Öppna telefonen med <strong>P</strong> eller knappen 📱.' + (t.smart ? ' Uber-appen finns redan installerad.' : '') + '</p>',
            [{ label: 'Snyggt', primary: true, run: close }],
            'Telefon',
          );
          updatePhoneButton();
        },
      })),
      { label: 'Stäng', primary: true, run: close },
    ],
    'Telefon',
  );
}

// ---- Telefonen ----
function openPhone() {
  if (!active || !state || (modal && $('dialogTag').textContent !== 'Telefon')) return;
  if (!state.phone) return toast('Du har ingen telefon. Telefonbutiken finns i Rewell i centrum.');
  const t = TELEFONER[state.phone];
  dialog(
    '📱 ' + t.namn,
    '<p class="sub">' + clockText(state.hour) + ' · ' + weatherHud() + ' · ' + state.money + ' €</p>' + (uber ? '<div class="info">' + uberStatus() + '</div>' : ''),
    [
      { label: '📞 Ring någon', primary: true, run: callMenu },
      ...(t.smart
        ? [
            { label: '🚗 Uber', run: () => rideMenu(false) },
            { label: '🌦️ Väder', run: phoneWeather },
            { label: '🏦 Banken', run: phoneBank },
            { label: '🗺️ Karta', run: phoneMap },
          ]
        : [{ label: '🚕 Ring taxi', run: () => rideMenu(true) }]),
      ...(uber && !uber.obj ? [{ label: 'Avboka resan', run: cancelRide }] : []),
      { label: 'Lägg undan telefonen', run: close },
    ],
    'Telefon',
  );
}
// Personer du känner (bekant eller mer) kan du ringa.
function callMenu() {
  const known = [...characters, ...extra].filter((p) => p.id !== state.character && relation(p) >= 15);
  dialog(
    'Ring någon',
    known.length ? '<p class="sub">Dina kontakter.</p>' : '<p>Du har inga kontakter än. Lär känna folk på campus först.</p>',
    [
      ...known.slice(0, 10).map((p) => ({
        label: '📞 ' + p.name,
        run: () => {
          toast('Det ringer hos ' + p.name.split(' ')[0] + ' …');
          sound('tap');
          setTimeout(() => chat(p), 900);
        },
      })),
      { label: 'Tillbaka', primary: true, run: openPhone },
    ],
    'Telefon',
  );
}
function phoneWeather() {
  dialog(
    'Väder i Vasa',
    '<p><strong>Nu: ' + weatherHud() + ' · ' + esc(weather().namn) + '</strong></p><p>Idag: ' + esc(forecastText()) + '</p><p>Imorgon: ' + esc(forecastText(state.day + 1)) + '</p>',
    [{ label: 'Tillbaka', primary: true, run: openPhone }],
    'Telefon',
  );
}
function phoneBank() {
  dialog(
    'Banken',
    '<p>Saldo: <strong>' +
      state.money +
      ' €</strong></p>' +
      (state.debt ? '<p>Skuld: ' + state.debt + ' €</p>' : '') +
      (state.carLoan ? '<p>Billån kvar: ' + state.carLoan.kvar + ' € (' + state.carLoan.perVecka + ' € i veckan)</p>' : '') +
      '<p class="sub">Senaste: ' +
      (state.ledger || [])
        .slice(-5)
        .reverse()
        .map((l) => esc(l.t) + ' ' + (l.n > 0 ? '+' : '') + l.n + ' €')
        .join(' · ') +
      '</p>',
    [{ label: 'Tillbaka', primary: true, run: openPhone }],
    'Telefon',
  );
}
function phoneMap() {
  const here = KARTGEO[world.id] ? tileToGeo(world.id, player.x, player.y) : null;
  dialog(
    'Karta',
    '<p>Du är ' +
      esc(world.name) +
      '.</p>' +
      (here ? '<p class="sub">' + here[0].toFixed(5) + ' N, ' + here[1].toFixed(5) + ' E</p>' : '') +
      '<p>Campus och centrum hänger ihop via Wolffskavägen och Brändöbron, ungefär 1,5 km att gå. Bussen går från hållplatsen vid W33 och från torget.</p>',
    [{ label: 'Tillbaka', primary: true, run: openPhone }],
    'Telefon',
  );
}

// ---- Uber och taxi ----
function destSpot(d) {
  const w = worlds[destWorld(d)];
  if (d.hem) {
    const s = myHomeDoorSpot();
    return nearestFree(worlds[s.world], s.x, s.y, 6);
  }
  if (d.torget) return [w.spawn.x, w.spawn.y];
  if (d.ollis) {
    const o = w.objects.find((x) => x.type === 'portal' && x.target === 'ollis');
    return nearestFree(w, o.x, o.y, 6);
  }
  if (d.poi) return nearestFree(w, ...centrumPoi(d.poi), 12);
  if (d.lat) return nearestFree(w, ...geoToTile(d.värld, d.lat, d.lon), 12);
  return nearestFree(w, d.x, d.y, 8);
}
// Hem ligger på olika kartor för olika karaktärer (js/data/hem.js).
const destWorld = (d) => (d.hem ? myHomeDoorSpot().world : d.värld);
function rideKm(d) {
  const [x, y] = destSpot(d),
    a = tileToGeo(world.id, player.x, player.y),
    b = tileToGeo(destWorld(d), x, y);
  return Math.hypot((a[0] - b[0]) * 110.54, (a[1] - b[1]) * kx(a[0]) / 1000);
}
function ridePrice(km, taxi) {
  const h = state.hour,
    wd = WEEKDAYS[weekdayIndex(state.day)],
    night = h < 5 || (h >= 22 && ['fre', 'lör'].includes(wd)),
    p = Math.max(UBER.minst, UBER.start + UBER.perKm * km) * (night ? UBER.natt : 1) * (taxi ? UBER.taxi : 1);
  return { price: Math.round(p), night };
}
function rideMenu(taxi) {
  if (!KARTGEO[world.id]) return toast('Gå ut först, så hittar chauffören dig.');
  if (uber) return toast(uberStatus());
  dialog(
    taxi ? '🚕 Taxi' : '🚗 Uber',
    '<p>Vart ska du?</p>',
    [
      ...Object.entries(RESMÅL).map(([id, d]) => {
        const km = rideKm(d),
          { price, night } = ridePrice(km, taxi);
        return {
          label: d.namn + ' · ' + km.toFixed(1) + ' km · ' + price + ' €' + (night ? ' (nattpris)' : ''),
          disabled: km < 0.15 || state.money < price,
          run: () => orderRide(id, price, km, taxi),
        };
      }),
      { label: 'Tillbaka', primary: true, run: openPhone },
    ],
    'Telefon',
  );
}
function orderRide(id, price, km, taxi) {
  const [a, b] = UBER.väntan,
    wait = a + Math.floor(Math.random() * (b - a + 1)),
    bil = taxi ? { namn: 'Vasa Taxi, Mercedes', färg: '#f0f0ea' } : rand(UBER.bilar);
  uber = { dest: id, price, km, taxi, förare: rand(UBER.förare), bil, world: world.id, kommer: performance.now() + wait * 1000 * 1.5 };
  close();
  sound('tap');
  toast((taxi ? 'Taxin' : uber.förare + ' i en ' + bil.namn) + ' kommer om ' + wait + ' min.');
}
function uberStatus() {
  if (!uber) return '';
  const d = RESMÅL[uber.dest];
  return uber.obj
    ? (uber.taxi ? 'Taxin' : uber.förare) + ' väntar på dig. Gå fram till bilen och tryck E. Resan till ' + d.namn + ' kostar ' + uber.price + ' €.'
    : (uber.taxi ? 'Taxin' : uber.förare + ' i en ' + uber.bil.namn) + ' är på väg. Mot ' + d.namn + '.';
}
function cancelRide() {
  if (uber?.obj) removeUberCar();
  uber = null;
  close();
  toast('Resan är avbokad.');
}
function removeUberCar() {
  for (const w of Object.values(worlds)) {
    const i = w.objects.indexOf(uber.obj);
    if (i >= 0) w.objects.splice(i, 1);
  }
  uber.obj = null;
}
// Körs varje bildruta: bilen dyker upp bredvid dig när den är framme.
function uberTick() {
  if (!uber || !state) return;
  if (!uber.obj && performance.now() >= uber.kommer) {
    if (!KARTGEO[world.id]) {
      uber.kommer = performance.now() + 5000;
      return;
    }
    uber.world = world.id;
    const [x, y] = nearestFree(world, player.x + Math.cos(player.a) * 3, player.y + Math.sin(player.a) * 3, 8, 1.1),
      car = { x, y, a: player.a + Math.PI / 2, color: uber.bil.färg };
    uber.car = car;
    uber.obj = obj(world, x, y, 'uber', (uber.taxi ? 'Taxi' : 'Din Uber') + ' · kliv in', boardRide, { height: 0.85 });
    Object.defineProperty(uber.obj, 'sprite', { get: () => carSprite(car.color, carView(car, player.x, player.y)), enumerable: true });
    uber.väntar = performance.now() + 90000;
    honk();
    toast((uber.taxi ? 'Taxin' : uber.förare) + ' är här! Bilen står bredvid dig.');
  }
  // Kommer du inte på en och en halv minut kör bilen iväg, och det kostar en avgift.
  if (uber.obj && performance.now() > uber.väntar) {
    removeUberCar();
    const fee = Math.min(state.money, 5);
    state.money -= fee;
    uber = null;
    toast('Chauffören väntade förgäves och körde. Avgift ' + fee + ' €.');
  }
}
function boardRide() {
  const u = uber,
    d = RESMÅL[u.dest];
  if (state.money < u.price) return toast('Du har inte råd med resan (' + u.price + ' €).');
  state.money -= u.price;
  ledger((u.taxi ? 'Taxi' : 'Uber') + ' till ' + d.namn, -u.price);
  removeUberCar();
  uber = null;
  advance(Math.max(4, Math.round((u.km / UBER.fart) * 60) + 2));
  const [x, y] = destSpot(d);
  changeWorld(destWorld(d), { x, y, a: player.a });
  questEvent('buss');
  save();
  dialog(
    'Framme: ' + d.namn,
    '<p>' + esc(rand(UBER.prat)) + '</p><p class="sub">' + u.price + ' € · ' + u.km.toFixed(1) + ' km</p>',
    [
      ...(u.taxi
        ? []
        : [1, 3, 5].map((s) => ({
            label: '⭐'.repeat(s),
            primary: s === 5,
            run: () => (close(), toast(s === 5 ? u.förare + ' tackar för betyget!' : 'Tack för ditt betyg.')),
          }))),
      { label: 'Kliv ur', primary: u.taxi, run: close },
    ],
    'Telefon',
  );
}
// Uber-bilen i 3D (används av carsTick3d i render3d.js).
const uberCar3d = () => (uber?.obj && uber.world === world?.id ? uber.car : null);

// ---- Knappen i statusfältet ----
function updatePhoneButton() {
  const b = $('phoneButton');
  if (b) b.hidden = !state?.phone;
}
$('phoneButton')?.addEventListener('click', () => (modal ? null : openPhone()));

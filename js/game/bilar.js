// Egna bilar: köp en hos bilhandlaren i centrum (kontant eller med billån), kör den på
// gatorna mellan campus, bron och centrum, och parkera var du vill. Bilarna finns i
// js/data/bilar.js. Läget sparas i state.car: { model, world, x, y, a } och
// state.carLoan: { kvar, perVecka }.
'use strict';
let driving = null; // { model, speed } när du kör
let myCarObj = null; // den parkerade bilen i världen
const inVehicle = () => job?.type === 'drive' || !!driving;
// km/h -> rutor per sekund (en ruta är 1,7 m).
const kmh = (v) => v / 3.6 / 1.7;
const carColor = () => BILAR[state.car?.model]?.färg;

// ---- Bilhandlaren ----
function placeCarDealer() {
  const w = worlds.centrum;
  if (!w) return;
  const p = centrumPoi(BILHANDEL.poi);
  if (!p) return console.warn('Bilhandlaren hittar inte ' + BILHANDEL.poi);
  const [x, y] = nearestFree(w, p[0], p[1], 20, 0.8);
  obj(w, x, y, 'venue', BILHANDEL.namn + ' · bilar från ' + cheapestCar() + ' €', carDealer, {
    height: 1.3,
    sprite: venueSprite('🚗'),
  });
  // Tre bilar i utställningen.
  ['golf', 'tesla', 'porsche'].forEach((m, i) => {
    const [cx, cy] = nearestFree(w, x + 3 + i * 3, y + 2, 8, 1.2);
    const car = { x: cx, y: cy, a: 0.4, color: BILAR[m].färg, show: true };
    w.showroom ??= [];
    w.showroom.push(car);
  });
}
const cheapestCar = () => Math.min(...Object.values(BILAR).map((b) => b.pris)).toLocaleString('sv-FI');
const euro = (n) => Math.round(n).toLocaleString('sv-FI') + ' €';
function carDealer() {
  const own = state.car && BILAR[state.car.model],
    trade = own ? tradeIn() : 0;
  dialog(
    BILHANDEL.namn,
    '<p>Du har <strong>' +
      euro(state.money) +
      '</strong>' +
      (own ? '. Din ' + esc(own.namn) + ' är värd ' + euro(trade) + ' i inbyte' : '') +
      (state.carLoan ? '. Billån kvar: ' + euro(state.carLoan.kvar) : '') +
      '.</p><p class="sub">Billån: ' +
      Math.round(BILHANDEL.handpenning * 100) +
      ' % handpenning, resten plus ' +
      Math.round(BILHANDEL.ränta * 100) +
      ' % ränta betalas varje måndag i ' +
      BILHANDEL.veckor +
      ' veckor.</p>',
    [
      ...Object.entries(BILAR).map(([id, b]) => ({
        label: b.namn + ' · ' + euro(b.pris) + (state.car?.model === id ? ' (din)' : ''),
        disabled: state.car?.model === id,
        run: () => carOffer(id),
      })),
      ...(own ? [{ label: 'Sälj din ' + own.namn + ' · ' + euro(trade), run: sellCar }] : []),
      { label: 'Stäng', primary: true, run: close },
    ],
    'Bilar',
  );
}
// Vad din bil är värd, minus det som är kvar på lånet.
function tradeIn() {
  const b = BILAR[state.car?.model];
  return b ? Math.max(0, Math.round(b.pris * BILHANDEL.inbyte - (state.carLoan?.kvar || 0))) : 0;
}
function carOffer(id) {
  const b = BILAR[id],
    trade = state.car ? tradeIn() : 0,
    cash = state.money + trade,
    down = Math.ceil(b.pris * BILHANDEL.handpenning),
    loan = b.pris - down,
    perWeek = Math.ceil((loan * (1 + BILHANDEL.ränta)) / BILHANDEL.veckor),
    canLoan = !state.carLoan || state.car;
  dialog(
    b.namn,
    '<p>"' +
      esc(b.text) +
      '"</p><div class="info">Toppfart ' +
      b.toppfart +
      ' km/h · ' +
      euro(b.pris) +
      (trade ? ' · inbyte ' + euro(trade) : '') +
      '</div>',
    [
      {
        label: 'Köp kontant · ' + euro(b.pris),
        primary: cash >= b.pris,
        disabled: cash < b.pris,
        run: () => buyCar(id, b.pris, 0, 0),
      },
      {
        label: 'Billån · ' + euro(down) + ' nu, sedan ' + euro(perWeek) + ' i veckan',
        disabled: cash < down || !canLoan || state.debt > 0,
        run: () => buyCar(id, down, Math.ceil(loan * (1 + BILHANDEL.ränta)), perWeek),
      },
      { label: 'Tillbaka', run: carDealer },
    ],
    'Bilar',
  );
}
function buyCar(id, pay, loanTotal, perWeek) {
  const b = BILAR[id],
    trade = state.car ? tradeIn() : 0;
  if (state.money + trade < pay) return toast('Du har inte råd.');
  // Gamla bilen byts in och lånet på den löses.
  if (state.car) removeMyCar();
  state.carLoan = null;
  state.money = state.money + trade - pay;
  ledger('Köpte ' + b.namn, -pay + trade);
  if (loanTotal) state.carLoan = { kvar: loanTotal, perVecka: perWeek };
  const w = worlds.centrum,
    show = w.showroom?.[0] || w.spawn,
    [x, y] = nearestFree(w, show.x - 3, show.y + 3, 10, 1.2);
  state.car = { model: id, world: 'centrum', x, y, a: 0 };
  placeMyCar();
  addBadge('Bilägare');
  reportHappening('bil', { titel: b.namn });
  save();
  sound('win');
  dialog(
    'Grattis till bilen!',
    '<p>Din ' +
      esc(b.namn) +
      ' står parkerad utanför. Gå fram till den och tryck E för att köra. Tryck E igen när du står still för att parkera och kliva ur.</p>' +
      (loanTotal ? '<div class="info">Billån: ' + euro(perWeek) + ' dras varje måndag tills ' + euro(loanTotal) + ' är betalt.</div>' : ''),
    [{ label: 'Till bilen!', primary: true, run: close }],
    'Bilar',
  );
}
function sellCar() {
  const b = BILAR[state.car.model],
    trade = tradeIn();
  if (driving) stopDriving(true);
  removeMyCar();
  state.money += trade;
  state.car = null;
  state.carLoan = null;
  ledger('Sålde ' + b.namn, trade);
  save();
  close();
  toast('Du sålde din ' + b.namn + ' för ' + euro(trade) + '.');
}
// Varje måndag: en avbetalning på billånet (anropas från weeklyEconomy i progress.js).
function carLoanWeek(notes) {
  const L = state.carLoan;
  if (!L) return;
  const due = Math.min(L.kvar, L.perVecka),
    paid = Math.min(state.money, due);
  state.money -= paid;
  L.kvar -= due;
  ledger('Billån', -due);
  notes.push('billån −' + due + ' €');
  if (paid < due) {
    state.debt += due - paid;
    notes.push(due - paid + ' € av billånet blev skuld');
  }
  if (L.kvar <= 0) {
    state.carLoan = null;
    notes.push('billånet är betalt!');
  }
}

// ---- Den parkerade bilen ----
function placeMyCar() {
  removeMyCar();
  const c = state?.car,
    w = c && worlds[c.world];
  if (!w || driving) return;
  const b = BILAR[c.model];
  myCarObj = obj(w, c.x, c.y, 'mycar', 'Din ' + b.namn + ' · kör', startDriving, { height: 0.85 });
  // Bilden beror på varifrån du ser bilen.
  Object.defineProperty(myCarObj, 'sprite', {
    get: () => carSprite(b.färg, carView({ x: c.x, y: c.y, a: c.a }, player.x, player.y)),
    enumerable: true,
  });
}
function removeMyCar() {
  if (!myCarObj) return;
  for (const w of Object.values(worlds)) {
    const i = w.objects.indexOf(myCarObj);
    if (i >= 0) w.objects.splice(i, 1);
  }
  myCarObj = null;
}
// Körs varje bildruta: ställer ut bilen efter en laddad sparning.
function carsSync() {
  if (state?.car && !myCarObj && !driving && worlds[state.car.world]) placeMyCar();
}

// ---- Köra ----
function startDriving() {
  if (isDrunk()) return toast('Du kör inte full. Ta bussen, eller gå.');
  if (job) return toast('Avsluta jobbet först.');
  const c = state.car;
  removeMyCar();
  driving = { model: c.model, speed: 0 };
  Object.assign(player, { x: c.x, y: c.y, a: c.a });
  resetMotion();
  sound('tap');
  toast('Du kör din ' + BILAR[c.model].namn + '. W gasar, S bromsar och backar, E parkerar.');
}
function stopDriving(silent) {
  if (!driving) return;
  if (!silent && Math.abs(driving.speed) > 1) return toast('Stanna först.');
  state.car = { model: driving.model, world: world.id, x: player.x, y: player.y, a: player.a };
  driving = null;
  // Kliv ur på sidan av bilen.
  const side = player.a + Math.PI / 2,
    [x, y] = nearestFree(world, player.x + Math.cos(side) * 1.1, player.y + Math.sin(side) * 1.1, 4, 0.25);
  Object.assign(player, { x, y });
  placeMyCar();
  save();
  if (!silent) toast('Parkerad.');
}
function driveCar(dt, f, r) {
  const b = BILAR[driving.model],
    max = kmh(b.toppfart),
    s = driving.speed,
    arrows = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
  motion.steer = approach(motion.steer, clamp(r + arrows, -1, 1), 6, dt);
  // Gas, broms (åt andra hållet) och rullmotstånd. Snö och regn gör vägen halare.
  const wx = weather(),
    slippery = snowCover() > 0.5 ? 0.6 : wx.ned > 0.3 ? 0.85 : 1;
  if (Math.abs(f) > 0.06) {
    const braking = Math.sign(f) !== Math.sign(s) && Math.abs(s) > 0.2;
    driving.speed = s + f * dt * (braking ? 9 * slippery : 3.4 * b.acc);
  } else driving.speed = approach(s, 0, 1.3, dt);
  driving.speed = clamp(driving.speed, -kmh(25), max);
  const grip = (clamp(driving.speed / 1.6, -1, 1) / (1 + Math.abs(driving.speed) * 0.06)) * slippery;
  player.a += motion.steer * dt * 1.9 * grip;
  const dx = Math.cos(player.a) * driving.speed * dt,
    dy = Math.sin(player.a) * driving.speed * dt,
    want = Math.hypot(dx, dy),
    moved = slide(world, dx, dy, 0.5);
  if (want > 0.001 && moved < want * 0.5) {
    const hard = moved < want * 0.15;
    if (hard && Math.abs(driving.speed) > 4 && noticeTimer <= 0) {
      toast('Krasch! Försiktigt med lacken.');
      sound('bad');
      noticeTimer = 3;
    }
    driving.speed *= hard ? 0.15 : 0.7;
  }
  // Andra bilar: krocka inte rakt igenom dem.
  for (const c of traffic.cars)
    if (Math.hypot(c.x - player.x, c.y - player.y) < 1.4 && Math.abs(driving.speed) > 1) {
      driving.speed *= -0.3;
      c.speed = 0;
      honk();
      break;
    }
  camera.bobAmount = approach(camera.bobAmount, 0, 8, dt);
  camera.bob = 0;
  camera.plane = approach(camera.plane, basePlane() * (1 + Math.abs(driving.speed) * 0.008), 4, dt);
}
function drivingHud() {
  return (
    '<div>' +
    esc(BILAR[driving.model].namn) +
    '</div><b>' +
    Math.round(Math.abs(driving.speed) * 1.7 * 3.6) +
    ' km/h</b><div class="sub">E parkerar när du står still</div>'
  );
}

// Kollar datafilen när spelet startar.
for (const [id, b] of Object.entries(BILAR))
  if (!(b.pris > 0 && b.toppfart > 0 && /^#[0-9a-f]{6}$/i.test(b.färg))) console.warn('Bil ' + id + ': pris, toppfart eller färg saknas');

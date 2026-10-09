// Trapphuset i hus med hiss (Arvid bor på sjunde våningen på Kyrkoesplanaden 6). Samma rum
// används för alla våningar: hissen tar dig mellan dem, och dörrarna gör olika saker beroende
// på vilken våning du är på. Ytterdörren finns bara på bottenvåningen, och trappan är låst,
// så man måste ta hissen.
'use strict';
const stair = { floor: 1, riding: false };
const GRANNAR = ['Lindholm', 'Mäkinen', 'Björk', 'Nyström', 'Korhonen', 'Sjöberg', 'Heikkilä', 'Ek'];
function liftInfo() {
  return myAddress()?.hiss || { våning: 1, våningar: 2 };
}
function buildStairwell() {
  const w = makeWorld('trapphus', 'Trapphuset', 10);
  Object.defineProperty(w, 'name', {
    get: () => 'Trapphuset · ' + (myAddress()?.adress || '') + ' · våning ' + stair.floor,
    configurable: true,
  });
  w.grid.forEach((row) => row.fill(1));
  rect(w, 2, 2, 6, 6, 0);
  w.wallHeight = 1.5;
  w.lights = [
    { x: 5, y: 4, z: 1.2, power: 0.75, falloff: 0.4 },
    { x: 5, y: 7, z: 1.2, power: 0.45, falloff: 0.6 },
  ];
  w.floor = (x, y, out) => {
    // Stenplattor i schackmönster, som i ett gammalt trapphus.
    const on = (Math.floor(x * 2) + Math.floor(y * 2)) % 2,
      n = ((Math.floor(x * 9) * 7 + Math.floor(y * 9) * 13) % 5) * 2;
    out[0] = (on ? 170 : 118) + n;
    out[1] = (on ? 162 : 104) + n;
    out[2] = (on ? 150 : 92) + n;
  };
  w.ceiling = (x, y, out) => {
    out[0] = 232;
    out[1] = 230;
    out[2] = 224;
  };
  // Hissen i norr, lägenhetsdörren i öster, porten i söder och trappan (låst) i väster.
  doorAt(w, 5, 1);
  doorAt(w, 8, 4);
  doorAt(w, 4, 8);
  doorAt(w, 1, 5);
  const lift = station(w, 5.5, 2.55, 'portal', 'Hissen', liftMenu);
  lift.hidden = true;
  Object.defineProperty(lift, 'label', {
    get: () => (stair.riding ? 'Hissen åker …' : 'Hissen · du är på våning ' + stair.floor + ' · tryck E'),
    enumerable: true,
  });
  const flat = station(w, 7.45, 4.5, 'portal', 'Dörr', flatDoor);
  flat.hidden = true;
  Object.defineProperty(flat, 'label', {
    get: () =>
      stair.floor === liftInfo().våning
        ? 'Hem · din lägenhet'
        : stair.floor === 1
          ? 'Postlådorna'
          : 'Grannens dörr · ' + GRANNAR[(stair.floor * 3) % GRANNAR.length],
    enumerable: true,
  });
  const street = station(w, 4.5, 7.45, 'portal', 'Porten', streetDoor);
  street.hidden = true;
  Object.defineProperty(street, 'label', {
    get: () => (stair.floor === 1 ? 'Ut på gatan' : 'Fönster · våning ' + stair.floor),
    enumerable: true,
  });
  const steps = station(w, 2.55, 5.5, 'portal', 'Trappan · låst', () =>
    toast('Trappdörren är låst. Ta hissen.'),
  );
  steps.hidden = true;
  w.spawn = { x: 4.5, y: 6.6, a: -Math.PI / 2 };
  return w;
}
// In i trapphuset på en viss våning (från gatan: bottenvåningen, från lägenheten: din våning).
function enterStairwell(floor, fromFlat) {
  stair.floor = floor;
  stair.riding = false;
  changeWorld('trapphus', fromFlat ? { x: 6.6, y: 4.5, a: Math.PI } : { x: 4.5, y: 6.6, a: -Math.PI / 2 });
}
function flatDoor() {
  const h = liftInfo();
  if (stair.floor === h.våning) return changeWorld('home');
  if (stair.floor === 1) return toast('Bara reklam och en räkning till någon som flyttat för länge sedan.');
  toast('Fel våning. Det här är familjen ' + GRANNAR[(stair.floor * 3) % GRANNAR.length] + 's dörr.');
}
function streetDoor() {
  if (stair.floor !== 1) {
    const view = stair.floor >= 6 ? 'Du ser ut över Kyrkoesplanaden och ända bort till Brändöbron.' : 'Du ser ut över gården.';
    return toast(view + ' Porten finns på bottenvåningen.');
  }
  const s = myHomeDoorSpot();
  changeWorld(s.world, s);
}
function liftMenu() {
  if (stair.riding) return;
  const h = liftInfo(),
    floors = Array.from({ length: h.våningar }, (_, i) => i + 1);
  dialog(
    'Hissen',
    '<p>Du är på våning ' + stair.floor + '. Vart ska du?</p>',
    [
      ...floors.map((f) => ({
        label: (f === 1 ? '1 · bottenvåningen' : String(f)) + (f === h.våning ? ' · hem' : ''),
        primary: f === (stair.floor === 1 ? h.våning : 1),
        disabled: f === stair.floor,
        run: () => liftRide(f),
      })),
      { label: 'Stanna här', run: close },
    ],
    'Hiss',
  );
}
// Hissen åker en våning i taget: dörrarna stängs, siffrorna tickar och det plingar.
function liftRide(target) {
  stair.riding = true;
  const dir = target > stair.floor ? 1 : -1;
  dialog('Hissen', '<p class="liftFloor" id="liftFloor">Dörrarna stängs …</p>', [], 'Hiss');
  sound('tap');
  let f = stair.floor;
  const step = () => {
    if (f === target) {
      stair.floor = target;
      stair.riding = false;
      advance(1);
      sound('win');
      close();
      Object.assign(player, { x: 5.5, y: 3.2, a: Math.PI / 2 });
      toast('Pling! Våning ' + target + (target === liftInfo().våning ? '. Hemma snart.' : '.'));
      updateHUD();
      return;
    }
    f += dir;
    const el = $('liftFloor');
    if (el) el.textContent = (dir > 0 ? '⬆ ' : '⬇ ') + f;
    sound('tap');
    setTimeout(step, 650);
  };
  setTimeout(step, 900);
}

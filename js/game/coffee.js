// Kaffe: automater i W33, Technobothnia och gymmet, och bryggaren i köket hemma.
// Varje kopp samma dag ger mindre energi än den förra, för många gör en darrig, och kaffe
// sent på kvällen gör att man sover sämre. Siffrorna finns i KAFFE i js/data/progress.js.
'use strict';
function coffeeToday() {
  if (state.coffee?.day !== state.day)
    state.coffee = { day: state.day, cups: 0, wiredUntil: state.coffee?.wiredUntil || 0 };
  return state.coffee;
}
// Energin nästa kopp ger, 0 om den inte ger något alls längre.
function nextCupEnergy() {
  const c = coffeeToday();
  return KAFFE.energi[c.cups] ?? 0;
}
function nowHours() {
  return state.day * 24 + state.hour;
}
// Sömnen ger mindre om man druckit kaffe sent (används av restBonus i studies.js).
function coffeeSleepFactor() {
  return (state.coffee?.wiredUntil || 0) > nowHours() ? KAFFE.sömnFaktor : 1;
}
function drinkCoffee(atHome = false) {
  const price = atHome ? 0 : KAFFE.pris;
  if (state.money < price)
    return toast('En kopp kostar ' + price + ' €. Du har inte råd just nu.');
  const c = coffeeToday(),
    energy = nextCupEnergy();
  state.money -= price;
  c.cups++;
  // Tiden för koppen går först, så att energin man ser i meddelandet är det man får.
  advance(KAFFE.minuter);
  gain('energy', energy);
  const jittery = c.cups >= KAFFE.darrigFrån;
  if (jittery) gain('happy', -KAFFE.darrig);
  if (state.hour >= KAFFE.sentEfter) c.wiredUntil = nowHours() + KAFFE.verkarTimmar;
  save();
  sound(energy > 0 ? 'win' : 'tap');
  const where = atHome ? 'Kaffe hemma' : 'Kaffe för ' + price + ' €';
  const parts = [energy > 0 ? '+' + energy + ' energi' : 'ingen mer effekt idag'];
  if (jittery) parts.push('darrig, −' + KAFFE.darrig + ' glädje');
  if (state.hour >= KAFFE.sentEfter) parts.push('du kommer sova sämre i natt');
  toast(where + ' · kopp ' + c.cups + ' idag · ' + parts.join(' · ') + '.');
  // Folk runt omkring märker när du dricker för mycket kaffe.
  if (c.cups === KAFFE.darrigFrån && typeof addRumor === 'function')
    addRumor('kaffekopp', {}, witnessesHere());
}
// Etiketten på automaten visar vad nästa kopp ger.
function coffeeLabel(atHome) {
  if (!state) return 'Kaffeautomat';
  const e = nextCupEnergy();
  return (
    (atHome ? 'Kaffebryggaren' : 'Kaffeautomat · ' + KAFFE.pris + ' €') +
    (e > 0 ? ' · +' + e + ' energi' : ' · ger inget mer idag')
  );
}
// En plats nära (x, y) som inte är där man kommer in eller i vägen för en dörr.
function coffeeSpot(w, x, y) {
  for (let r = 0; r < 6; r += 0.5)
    for (let a = 0; a < 6.28; a += 0.4) {
      const px = Math.floor(x + Math.cos(a) * r) + 0.5,
        py = Math.floor(y + Math.sin(a) * r) + 0.5;
      if (!walkable(w, px, py, 0.4)) continue;
      if (Math.hypot(px - w.spawn.x, py - w.spawn.y) < 2.5) continue;
      if (w.objects.some((o) => o.action && Math.hypot(o.x - px, o.y - py) < 2)) continue;
      return [px, py];
    }
  return [x, y];
}
// Ställer en automat i ett hus. Etiketten uppdateras när man närmar sig.
function coffeeMachine(w, x, y) {
  [x, y] = coffeeSpot(w, x, y);
  const o = obj(w, x, y, 'coffee', 'Kaffeautomat', () => drinkCoffee(false), {
    height: 1.05,
    sprite: coffeeSprite(),
  });
  Object.defineProperty(o, 'label', { get: () => coffeeLabel(false), enumerable: true });
  return o;
}
function coffeeSprite() {
  if (cache.coffee) return cache.coffee;
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 160;
  const g = c.getContext('2d');
  // Skugga
  g.fillStyle = '#10192135';
  g.beginPath();
  g.ellipse(48, 154, 38, 6, 0, 0, 7);
  g.fill();
  // Skåpet
  const body = g.createLinearGradient(12, 0, 84, 0);
  body.addColorStop(0, '#26313a');
  body.addColorStop(0.5, '#3d4b56');
  body.addColorStop(1, '#222c34');
  g.fillStyle = body;
  g.beginPath();
  g.roundRect(14, 14, 68, 140, 8);
  g.fill();
  // Skylt med kopp
  g.fillStyle = '#8a5a3c';
  g.beginPath();
  g.roundRect(20, 20, 56, 30, 5);
  g.fill();
  g.fillStyle = '#f3e3cf';
  g.font = 'bold 13px system-ui';
  g.textAlign = 'center';
  g.fillText('KAFFE', 48, 40);
  // Knappar och skärm
  g.fillStyle = '#91d8c6';
  g.fillRect(24, 58, 30, 14);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i === 0 ? '#ffcb83' : '#c7d1d6';
    g.beginPath();
    g.arc(64, 60 + i * 9, 3, 0, 7);
    g.fill();
  }
  // Uttaget med en kopp
  g.fillStyle = '#121a20';
  g.beginPath();
  g.roundRect(28, 92, 40, 38, 4);
  g.fill();
  g.fillStyle = '#f5f1ea';
  g.beginPath();
  g.moveTo(39, 112);
  g.lineTo(57, 112);
  g.lineTo(55, 128);
  g.lineTo(41, 128);
  g.closePath();
  g.fill();
  g.fillStyle = '#5b3a26';
  g.fillRect(40, 113, 16, 3);
  // Ånga
  g.strokeStyle = '#ffffff88';
  g.lineWidth = 2;
  g.lineCap = 'round';
  for (const dx of [-4, 4]) {
    g.beginPath();
    g.moveTo(48 + dx, 109);
    g.quadraticCurveTo(44 + dx, 103, 48 + dx, 98);
    g.stroke();
  }
  // Grön lampa: den är i drift
  g.fillStyle = '#7ee08f';
  g.beginPath();
  g.arc(72, 142, 3, 0, 7);
  g.fill();
  cache.coffee = c;
  return c;
}

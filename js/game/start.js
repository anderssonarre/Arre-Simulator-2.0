// Starta spel och välja karaktär
'use strict';
function start(s) {
  const nick = cleanNick($('nickInput').value);
  if (nick) s.nickname = nick;
  state = s;
  active = true;
  job = null;
  party = false;
  world = worlds[s.world];
  if (s.mapRevision !== 2 && s.world !== 'home') {
    Object.assign(s, world.spawn);
    s.mapRevision = 2;
  }
  Object.assign(player, { x: s.x, y: s.y, a: s.a });
  if (!walkable(world, player.x, player.y)) Object.assign(player, world.spawn);
  pitch = 0;
  resetMotion();
  $('start').hidden = true;
  document.body.classList.add('playing');
  close();
  updateHUD();
  save();
  toast('Välkommen, ' + profile().name.split(' ')[0] + '. Ditt liv på campus börjar nu.');
  setupPeople();
  onlineConnect();
}
function choose(id) {
  selected = id;
  document
    .querySelectorAll('.char')
    .forEach((b) => b.classList.toggle('selected', b.dataset.id === id));
}
for (const c of characters) {
  const b = document.createElement('button');
  b.className = 'char';
  b.dataset.id = c.id;
  const p = document.createElement('img');
  p.className = 'portrait';
  p.src = npcSprite(c).toDataURL();
  p.alt = '';
  b.append(p);
  const title = document.createElement('b');
  title.textContent = c.name;
  b.append(title);
  const sub = document.createElement('small');
  sub.textContent = c.job;
  b.append(sub);
  b.onclick = () => choose(c.id);
  $('characters').append(b);
}
choose(selected);
$('newButton').onclick = () => {
  sound();
  if (safeStorage()) {
    dialog(
      'Börja ett nytt liv?',
      '<p>Din nuvarande sparning ersätts när det nya spelet börjar. Du kan exportera den först.</p>',
      [
        { label: 'Exportera sparningen', run: () => exportSaved() },
        {
          label: 'Starta som ' + characters.find((c) => c.id === selected).name,
          primary: true,
          run: () => start(fresh(selected)),
        },
        { label: 'Tillbaka', run: close },
      ],
    );
  } else start(fresh(selected));
};
$('continueButton').hidden = !safeStorage();
$('continueButton').onclick = () => {
  try {
    start(validate(JSON.parse(safeStorage())));
  } catch (e) {
    dialog(
      'Sparningen kunde inte läsas',
      '<p>' +
        esc(e.message) +
        '</p><p>Starta nytt eller importera en exporterad säkerhetskopia.</p>',
      [
        { label: 'Välj en sparfil', run: () => $('importFile').click() },
        { label: 'Stäng', run: close },
      ],
    );
  }
};

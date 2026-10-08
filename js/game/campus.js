// Lunch, garderob och fest
'use strict';
function lunchPrice() {
  return state.cheapLunchDay === state.day ? 4 : 8;
}
function lunch() {
  const price = lunchPrice();
  if (state.money < price)
    return toast('Lunchen kostar ' + price + ' €. Ett extrajobb ger dig råd.');
  state.money -= price;
  state.lunches++;
  tutorialDone('lunch');
  gain('hunger', 55);
  gain('happy', 5);
  advance(15);
  save();
  toast('Lunch på W33 för ' + price + ' €. +55 mättnad och +5 glädje.');
  sound('win');
}
function wardrobe() {
  dialog(
    'Garderoben',
    '<p>Din nuvarande outfit: <strong>' +
      esc(outfits.find((o) => o.id === state.outfit).name) +
      '</strong>.</p><p>Kläderna syns på porträttet i menyn. Välj din campusstil.</p>' +
      (state.marken?.length
        ? '<div class="info"><strong>Overallmärken:</strong> ' +
          state.marken.map(esc).join(' · ') +
          '</div>'
        : '<p class="sub">Overallmärken får du på sitzar, vappen och andra evenemang.</p>'),
    outfits.map((o) => ({
      label:
        (state.outfit === o.id ? '✓ ' : state.owned.includes(o.id) ? 'Ta på ' : 'Köp ') +
        o.name +
        (state.owned.includes(o.id) ? '' : ' · ' + o.price + ' €'),
      disabled: !state.owned.includes(o.id) && state.money < o.price,
      run: () => {
        if (!state.owned.includes(o.id)) {
          state.money -= o.price;
          state.owned.push(o.id);
        }
        state.outfit = o.id;
        save();
        wardrobe();
      },
    })),
    'Din stil',
  );
}
// ---- Fredagsfesten ----
// Online startar servern en fest på Filicia Castle varje fredag 20–22 finsk tid (js/shared/clock.js).
function partyNow() {
  return !!(sharedClock() && net.party?.active);
}
function partyStarted() {
  toast('Fredagsfest på Filicia Castle i W33! Alla som är online är välkomna till 22.00.');
  sound('win');
  updateHUD();
}
// Nästa fredagsfest som text, t.ex. "fredag 20.00" eller "pågår till 22.00".
function partyText() {
  const p = CLOCK.party;
  if (partyNow()) return 'pågår nu, till ' + p.to + '.00';
  return 'fredagar ' + p.from + '.00–' + p.to + '.00 finsk tid';
}
function partyPrompt() {
  if (partyNow()) return fridayParty();
  if (isSitzDay() && state.hour >= 17 && state.hour < 23) return sitzPrompt();
  dialog(
    'Filicia Castle',
    '<p>Axel och Otto har laddat upp för en campusfest. Musik, färger och ett välbehövligt avbrott från tentorna.</p><p class="sub">Fredagsfest för alla online: ' +
      partyText() +
      '.</p>',
    [
      {
        label: party ? 'Festen pågår · dansa' : 'Starta festen och dansa',
        primary: true,
        run: () => {
          party = true;
          addRumor('fest', {}, witnessesHere(14));
          addXp('socialt', XP.fest);
          gain('happy', 25);
          gain('energy', -8);
          advance(45);
          close();
          save();
          toast('Filicia Castle lever! +25 glädje.');
        },
      },
      { label: 'Inte nu', run: close },
    ],
    'Campusfest',
  );
}
// Den gemensamma festen ger mer ju fler riktiga spelare som är där, en gång per fest.
function fridayParty() {
  const key = net.party.nextAt,
    friends = remotesHere().length,
    bonus = Math.min(20, friends * 5),
    done = state.fridayParty === key;
  dialog(
    'Fredagsfest',
    '<p>Hela campus är på Filicia Castle. ' +
      (friends
        ? friends + (friends === 1 ? ' annan spelare är' : ' andra spelare är') + ' här just nu.'
        : 'Inga andra spelare här än. Ju fler ni är, desto bättre fest.') +
      '</p><div class="info">+25 glädje · +' +
      bonus +
      ' för kompisarna här · socialt +' +
      XP.fest * 2 +
      ' XP</div>',
    [
      {
        label: done ? 'Du har redan dansat på den här festen' : 'Dansa',
        primary: true,
        disabled: done,
        run: () => {
          state.fridayParty = key;
          addRumor('fredagsfest', {}, witnessesHere(14));
          party = true;
          addXp('socialt', XP.fest * 2);
          gain('happy', 25 + bonus);
          gain('energy', -8);
          close();
          save();
          sound('win');
          toast('Fredagsfest! +' + (25 + bonus) + ' glädje.');
        },
      },
      { label: 'Inte nu', run: close },
    ],
    'Fredagsfest',
  );
}

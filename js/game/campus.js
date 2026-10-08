// Lunch, garderob och fest
'use strict';
function lunch() {
  if (state.money < 8) return toast('Lunchen kostar 8 €. Ett extrajobb ger dig råd.');
  state.money -= 8;
  state.lunches++;
  gain('hunger', 55);
  gain('happy', 5);
  advance(15);
  save();
  toast('Lunch på W33. +55 mättnad och +5 glädje.');
  sound('win');
}
function wardrobe() {
  dialog(
    'Garderoben',
    '<p>Din nuvarande outfit: <strong>' +
      esc(outfits.find((o) => o.id === state.outfit).name) +
      '</strong>.</p><p>Kläderna syns på porträttet i menyn. Välj din campusstil.</p>',
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
function partyPrompt() {
  dialog(
    'Filicia Castle',
    '<p>Axel och Otto har laddat upp för en campusfest. Musik, färger och ett välbehövligt avbrott från tentorna.</p>',
    [
      {
        label: party ? 'Festen pågår · dansa' : 'Starta festen och dansa',
        primary: true,
        run: () => {
          party = true;
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

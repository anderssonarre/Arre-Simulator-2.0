// Tester för sparfilen: gamla sparningar ska alltid gå att fortsätta.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { SAVE_VERSION, upgradeSave } = require('../js/shared/savefile.js');

const known = {
  characters: ['arvid', 'zeb'],
  people: ['arvid', 'zeb', 'otto', 'axel'],
  outfits: ['casual', 'overall'],
  worlds: ['home', 'outdoor', 'w33', 'tech', 'gym'],
  defaults: { money: 120 },
};
// En sparning som den såg ut i version 1, innan kartan byttes.
const v1 = () => ({
  version: 1,
  character: 'arvid',
  term: 2,
  day: 30,
  hour: 14.5,
  money: 88,
  stats: { hunger: 50, happy: 60, energy: 70 },
  courses: [
    { study: 1, pass: true, lectures: 3 },
    { study: 0, pass: false },
    { study: 2, pass: false, lectures: 1 },
  ],
  owned: ['casual'],
  outfit: 'casual',
  relations: { otto: 40 },
  histories: { otto: [{ who: 'npc', text: 'Hej!' }] },
  socialDay: { otto: 29 },
  runs: 2,
  lunches: 5,
  graduated: false,
  world: 'outdoor',
  x: 10,
  y: 20,
  a: 1,
});

test('en sparning från version 1 uppgraderas och behåller allt', () => {
  const { save, from, fixed } = upgradeSave(v1(), known);
  assert.equal(from, 1);
  assert.equal(save.version, SAVE_VERSION);
  assert.equal(save.money, 88);
  assert.equal(save.relations.otto, 40);
  assert.equal(save.courses[1].lectures, 0);
  assert.deepEqual(fixed, []);
});

test('den som stod ute på gamla kartan börjar hemma', () => {
  const { save } = upgradeSave(v1(), known);
  assert.equal(save.world, 'home');
  assert.equal(save.respawn, true);
  const ny = { ...v1(), mapRevision: 3 };
  assert.equal(upgradeSave(ny, known).save.world, 'outdoor');
});

test('borttagna personer och kläder lagas i stället för att sparningen kastas', () => {
  const s = {
    ...v1(),
    version: SAVE_VERSION,
    relations: { otto: 40, borta: 90 },
    histories: { borta: [] },
    owned: ['casual', 'hatt'],
    outfit: 'hatt',
    world: 'källaren',
    stats: { hunger: 500, happy: 'x' },
    courses: [{ study: 9, pass: true }],
  };
  const { save, fixed } = upgradeSave(s, known);
  assert.deepEqual(save.relations, { otto: 40 });
  assert.equal(save.histories.borta, undefined);
  assert.deepEqual(save.owned, ['casual']);
  assert.equal(save.outfit, 'casual');
  assert.equal(save.world, 'home');
  assert.equal(save.stats.hunger, 100);
  assert.equal(save.stats.happy, 70);
  assert.equal(save.courses.length, 3);
  assert.equal(save.courses[0].study, 2);
  assert.ok(fixed.length > 0);
});

test('saker som inte går att laga kastar', () => {
  assert.throws(() => upgradeSave(null, known), { code: 'invalid' });
  assert.throws(() => upgradeSave({ ...v1(), character: 'okänd' }, known), { code: 'invalid' });
  assert.throws(() => upgradeSave({ ...v1(), version: SAVE_VERSION + 1 }, known), {
    code: 'newer',
  });
});

test('sparningen ändras inte på plats', () => {
  const s = v1();
  upgradeSave(s, known);
  assert.equal(s.version, 1);
  assert.equal(s.world, 'outdoor');
});

// Tester för pubquizen (server/quiz.js).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const quiz = require('../server/quiz.js');

test('reservfrågorna har ett rätt och tre olika fel svar', () => {
  for (const [fråga, rätt, ...fel] of quiz.RESERV) {
    assert.ok(fråga.endsWith('?'), fråga);
    assert.equal(fel.length, 3, fråga);
    assert.equal(new Set([rätt, ...fel]).size, 4, fråga);
  }
});
test('samma vecka ger samma frågor, nästa vecka andra', () => {
  const a = quiz.reservQuiz('2026-v41'),
    b = quiz.reservQuiz('2026-v41'),
    c = quiz.reservQuiz('2026-v42');
  assert.equal(a.length, quiz.ANTAL);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});
test('AI-svar kontrolleras', () => {
  const ok = { fråga: 'Vad är 1+1?', rätt: '2', fel: ['3', '4', '5'] };
  assert.equal(quiz.cleanQuiz({ frågor: [ok, ok, ok, ok] }), null, 'för få frågor');
  const list = quiz.cleanQuiz({ frågor: [...Array(9)].map(() => ok).concat([{ fråga: 'x', rätt: '2', fel: ['2', '3'] }]) });
  assert.equal(list.length, quiz.ANTAL);
  assert.ok(list.every((q) => q.fel.length === 3 && !q.fel.includes(q.rätt)));
});
test('topplistan sparar bästa resultatet per namn', () => {
  let t = quiz.addScore([], 'Zeb', 5);
  t = quiz.addScore(t, 'zeb', 3);
  t = quiz.addScore(t, 'Arvid', 7);
  t = quiz.addScore(t, 'Fuskare', 99);
  assert.deepEqual(t, [
    { name: 'Arvid', score: 7 },
    { name: 'zeb', score: 5 },
  ]);
});

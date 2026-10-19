// Studio track ST-0: coats in the game's own logic (game/js/logic/rules.js): a Billie keeps a coat that exists, drops
// one that doesn't, and wild Billies, eggs and fishing roll coats only from their odds.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { data, fn, reseed, startedSave } from './setup-real.mjs';

const { DEX_ORDER } = data;
beforeEach(() => reseed());

test('a Billie keeps a real coat and drops an unknown one', () => {
  startedSave(DEX_ORDER[0], 5);
  const sp = DEX_ORDER[0];
  assert.equal(fn('makeBilly')(sp, 5, { coat: 'midnight' }).coat, 'midnight');
  assert.equal(fn('makeBilly')(sp, 5, { coat: 'nope' }).coat, undefined);
  assert.equal(fn('makeBilly')(sp, 5).coat, undefined);
  assert.equal(fn('coatPrefix')('midnight'), 'Midnight ');
  assert.equal(fn('coatPrefix')(undefined), '');
});

test('without odds no coat is rolled; with wild odds of 2 about half the wild Billies wear it', () => {
  startedSave(DEX_ORDER[0], 5);
  const C = data.COATS.midnight;
  for (let i = 0; i < 40; i++) assert.equal(fn('coatRoll')(data.COATS, 'wild', Math.random), undefined);
  C.odds = { wild: 2 };
  try {
    let n = 0;
    for (let i = 0; i < 400; i++) if (fn('coatRoll')(data.COATS, 'wild', Math.random) === 'midnight') n++;
    assert.ok(n > 140 && n < 260, `${n} of 400`);
    assert.equal(
      fn('coatRoll')(data.COATS, 'egg', () => 0),
      undefined
    );
  } finally {
    delete C.odds;
  }
});

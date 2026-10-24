// RL-13: a run's Expedition and challenges (logic/modifiers.js): their effect rows, joined to the Perks' (effects.js
// fxOfRun), foes' levels and the boss's HP, the challenges' mods and the Expedition a win opens.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const M = modules.modifiers,
  E = modules.effects,
  MODS = GAME_DATA.modifiers,
  PERKS = GAME_DATA.perks;

test('modifiers: Expedition I changes nothing; each Expedition after it raises foes and prices, never less', () => {
  assert.equal(M.expeditionCount(), MODS.expeditions.length);
  assert.equal(E.fxOfRun({ perks: [], expedition: 1, mods: [] }, PERKS), null);
  assert.equal(E.fxFoeLevels({ expedition: 1 }), 0);
  assert.equal(E.fxBossHp({ expedition: 1 }), 1);
  assert.equal(E.fxFoeLevels(null), 0);
  let lv = 0,
    hp = 1,
    shop = 100;
  for (let n = 2; n <= M.expeditionCount(); n++) {
    const run = { perks: [], expedition: n, mods: [] };
    assert.ok(E.fxFoeLevels(run) > lv, `Expedition ${n}: foes higher`);
    assert.ok(E.fxBossHp(run) > hp, `Expedition ${n}: the boss tougher`);
    assert.ok(E.fxRunPrice(run, PERKS, 'shop', 100) > shop, `Expedition ${n}: dearer`);
    [lv, hp, shop] = [E.fxFoeLevels(run), E.fxBossHp(run), E.fxRunPrice(run, PERKS, 'shop', 100)];
  }
  /* past the data's last, the last */
  assert.equal(E.fxFoeLevels({ expedition: 9 }), E.fxFoeLevels({ expedition: M.expeditionCount() }));
});

test('modifiers: Expedition II is section 3 from I: +2 levels, the boss x1.15, prices +10%', () => {
  const run = { perks: [], expedition: 2, mods: [] };
  assert.equal(E.fxFoeLevels(run), 2);
  assert.equal(E.fxBossHp(run), 1.15);
  assert.equal(E.fxRunPrice(run, PERKS, 'shop', 100), 110);
  assert.equal(E.fxRunPrice(run, PERKS, 'heal', 60), 66);
  /* with a Perk the rows stack */
  assert.equal(E.fxRunPrice({ ...run, perks: ['coupon_book'] }, PERKS, 'shop', 100), 94);
});

test('modifiers: challenges add their rows; a mono-type run keeps its type', () => {
  const mods = M.modsMake(['fragile', 'mono', 'nosuch'], 'Water', ['dbg_mountains']);
  assert.deepEqual(mods, ['mono', 'fragile', 'mono_water', 'dbg_mountains']);
  assert.deepEqual(M.modsMake(['mono'], ''), [], 'mono-type without a type is no challenge');
  const run = { perks: [], expedition: 1, mods };
  assert.deepEqual(M.modChallenges(run), ['mono', 'fragile']);
  assert.ok(M.modHas(run, 'fragile') && !M.modHas(run, 'noheal'));
  assert.equal(M.modMonoTypeId(run), 'water');
  assert.equal(M.modMonoType(run, ['Fire', 'Water']), 'Water');
  assert.ok(M.modTypeFits(run, ['Electric', 'Water']) && !M.modTypeFits(run, ['Fire']));
  assert.ok(M.modTypeFits({ mods: [] }, ['Fire']), 'no rule: anything fits');
  assert.deepEqual(
    E.fxOfRun(run, PERKS).map(f => f.src),
    ['mono', 'fragile']
  );
  assert.equal(E.fxPayoutRates(E.fxOfRun(run, PERKS), { itemShare: 0.5 }).research, 1.5625);
});

test('modifiers: winning the highest Expedition open opens the next, never past the last', () => {
  const most = M.expeditionCount();
  assert.equal(M.expeditionAfterWin(1, 1, true), 2);
  assert.equal(M.expeditionAfterWin(1, 1, false), 1);
  assert.equal(M.expeditionAfterWin(3, 2, true), 3, 'an easier one won opens nothing');
  assert.equal(M.expeditionAfterWin(most, most, true), most);
  assert.equal(M.expeditionNumeral(4), 'IV');
});

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
  assert.equal(M.modFoeLevels({ expedition: 1 }), 0);
  assert.equal(M.modBossHp({ expedition: 1 }), 1);
  assert.equal(M.modFoeLevels(null), 0);
  let lv = 0,
    hp = 1,
    shop = 100;
  for (let n = 2; n <= M.expeditionCount(); n++) {
    const run = { perks: [], expedition: n, mods: [] };
    assert.ok(M.modFoeLevels(run) > lv, `Expedition ${n}: foes higher`);
    assert.ok(M.modBossHp(run) > hp, `Expedition ${n}: the boss tougher`);
    assert.ok(E.fxRunPrice(run, PERKS, 'shop', 100) > shop, `Expedition ${n}: dearer`);
    [lv, hp, shop] = [M.modFoeLevels(run), M.modBossHp(run), E.fxRunPrice(run, PERKS, 'shop', 100)];
  }
  /* past the data's last, the last */
  assert.equal(M.modFoeLevels({ expedition: 9 }), M.modFoeLevels({ expedition: M.expeditionCount() }));
});

test('modifiers: Expedition II is section 3 from I: +2 levels, the boss x1.15, prices +10%', () => {
  const run = { perks: [], expedition: 2, mods: [] };
  assert.equal(M.modFoeLevels(run), 2);
  assert.equal(M.modBossHp(run), 1.15);
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

test('modifiers: the run sim takes an Expedition, challenges and a trained level', async () => {
  const { runSim } = await import('./sim/run-sim.mjs');
  const o = { scenes: 'skip', team: 3, fights: 2, pack: 2, lvl: 20 },
    one = runSim('SIMEXP1', { ...o, expedition: 1 }),
    three = runSim('SIMEXP1', { ...o, expedition: 3 });
  /* RL-R1: a higher Expedition's region has more zones, so the run is longer */
  assert.ok(three.log.nodes.length > one.log.nodes.length, `${one.log.nodes.length} -> ${three.log.nodes.length}`);
  const foes = r => r.log.places.flatMap(p => (p.battles || []).map(b => b.foe));
  assert.ok(foes(one).length && foes(three).length);
  /* the same run, higher foes: the first wild Billie met is the Expedition's levels up */
  const lvlOf = s => Number(String(s).split(':')[1]);
  assert.equal(lvlOf(foes(three)[0]), lvlOf(foes(one)[0]) + 4);
  /* a challenge takes hold: no Perk is ever bought or offered on a "No Perks" run */
  const none = runSim('SIMEXP2', { ...o, mods: ['noperks'] }),
    plain = runSim('SIMEXP2', o);
  assert.deepEqual(none.stats.perks, []);
  assert.ok(none.log.places.every(p => !p.relic));
  assert.ok(plain.log.places.some(p => p.relic) || plain.stats.places < 2);
});

// RL-13: what each challenge changes in play, on the game's own data: mono-type (who may start and be caught), no
// healing (the clinic shut, no healing wares in run shops), no Perks (no pick and no shelf), fainted is gone (a
// fainted Billie leaves the run after the battle).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, data, fn, hooks, modules, startedSave } from './setup-real.mjs';

const M = modules.modifiers,
  L = modules['run-loop'],
  P = modules.perks,
  R = GAME_DATA.rules.run,
  UD = { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings },
  { newRun } = modules['run-state'],
  { runMapStart } = modules['run-map'];

/** a run on the game's rules with these challenges */
function runWith(challenges, monoType = 'Water', seed = 'CHAL0001') {
  const run = newRun(seed, 1, 1, { team: [] });
  runMapStart(run, { nodeTypes: GAME_DATA.nodeTypes, biomes: GAME_DATA.biomes, rules: R });
  run.mods = M.modsMake(challenges, monoType);
  run.unlocks = Object.keys(GAME_DATA.unlocks);
  return run;
}

test('no Perks: nothing is offered and no shop has one', () => {
  const plain = runWith([]),
    none = runWith(['noperks']);
  assert.ok(P.perkPool(plain, GAME_DATA.perks, R.perks).length > 0);
  assert.deepEqual(P.perkPool(none, GAME_DATA.perks, R.perks), []);
  assert.equal(P.perkOfferMake(none, GAME_DATA.perks, R.perks), null, 'a mini-boss offers no pick');
  assert.equal(P.perkShelf(none, 3, 1, GAME_DATA.perks, R.perks), '', 'a run shop has none');
  assert.ok(P.perkOfferMake(plain, GAME_DATA.perks, R.perks), 'without the challenge there is a pick');
});

test('no healing: the clinic is shut and run shops stock no healing wares', () => {
  const s = startedSave('musk0', 20);
  s.team[0].hp = 1;
  s.se = 100000;
  s.run = runWith(['noheal']);
  const shut = L.runClinic(s, R.healCost);
  assert.deepEqual([shut.paid, shut.shut], [0, true]);
  assert.equal(s.team[0].hp, 1, 'nobody was healed');
  /* without it the clinic works as before */
  s.run = runWith([]);
  assert.ok(L.runClinic(s, R.healCost).paid > 0);
  /* the shop: no healing ware on any day */
  const heals = w => L.runWareHeals(w.item || `coin:${w.coin}`, data.ITEMS);
  const open = runWith(['noheal']),
    plain = runWith([]);
  let sawPlain = false;
  for (let day = 1; day <= 30; day++) {
    assert.ok(
      !L.runShopOpen(open, 3, day, R.shop, UD).some(heals),
      `day ${day}: ${JSON.stringify(L.runShopOpen(open, 3, day, R.shop, UD))}`
    );
    if (L.runShopOpen(plain, 3, day, R.shop, UD).some(heals)) sawPlain = true;
  }
  assert.ok(sawPlain, 'without the challenge a shop does stock healing');
  assert.ok(L.runShopOpen(open, 3, 1, R.shop, UD).length, 'the shop still has something to sell');
});

test('fainted is gone: a fainted Billie leaves the run, never the last one standing', () => {
  const s = startedSave('musk0', 20);
  s.team.push(fn('makeBilly')('bezos0', 20), fn('makeBilly')('gates0', 20));
  s.run = runWith(['fragile']);
  s.run.home = s.team.map(m => m.uid);
  s.buddy = s.team[0].uid;
  s.team[0].hp = 0;
  const gone = L.runFragileDrop(s);
  assert.deepEqual(
    gone.map(m => m.sp),
    ['musk0']
  );
  assert.equal(s.team.length, 2);
  assert.equal(s.buddy, s.team[0].uid, 'the buddy moves to one still standing');
  /* the whole party down: nobody leaves (the run is over and the payout keeps one) */
  for (const m of s.team) m.hp = 0;
  assert.deepEqual(L.runFragileDrop(s), []);
  assert.equal(s.team.length, 2);
  /* without the challenge a fainted Billie stays */
  const t = startedSave('musk0', 20);
  t.team.push(fn('makeBilly')('bezos0', 20));
  t.run = runWith([]);
  t.team[0].hp = 0;
  assert.deepEqual(L.runFragileDrop(t), []);
  assert.equal(t.team.length, 2);
});

test('fainted is gone: battleSettle takes them out when a run battle ends', () => {
  const s = startedSave('musk0', 30);
  s.team.push(fn('makeBilly')('bezos0', 30));
  s.run = runWith(['fragile']);
  s.run.home = s.team.map(m => m.uid);
  hooks.provide({ saveData: s });
  s.team[1].hp = 0;
  const b = {
    kind: 'wild',
    over: 'win',
    runK: 0,
    lead: s.team[0].uid,
    sides: [{ team: s.team }, { team: [fn('makeBilly')('swift0', 5)] }],
    fx: null,
  };
  const { gone } = modules['battle-rewards'].battleSettle(b, s);
  assert.deepEqual(
    gone.map(m => m.sp),
    ['bezos0']
  );
  assert.equal(s.team.length, 1);
});

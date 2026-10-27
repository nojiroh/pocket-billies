// RS-4: the residents' services on the game's own data: a run takes off with each resident's level (run.res), their
// levels' items go into the bag, their effect rows join the run's, a reload keeps them (validRun), and a daily or
// weekly takes none of it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules, startedSave } from './setup-real.mjs';

const RS = modules.residents,
  { fxOfRun } = modules.effects,
  { validRun, runBegin } = modules['run-state'],
  { newMeta } = modules['meta-state'],
  RES = GAME_DATA.residents,
  U = GAME_DATA.unlocks;

/** a hub save with these residents (id -> the run they came after) and these unlocks owned, then a run begun */
function takeoff(here, owned = {}) {
  const s = startedSave('musk0', 5);
  s.meta = { ...newMeta(), residents: { ...here }, unlocks: { ...owned } };
  s.run = null;
  runBegin(s, { seed: 'RESSEED', expedition: 1, mapgenV: 1, se: 0, items: { potion: 2 } });
  return s;
}

test('residents: RS-4: a run takes off with each service level; Bertha’s packed lunch goes into the bag', () => {
  let s = takeoff({});
  assert.deepEqual(RS.resTakeoff(s, RES, U), { items: {} });
  assert.equal(s.run.res, undefined, 'nobody lives there: nothing rides along');
  s = takeoff({ bertha: 1, mo: 2 });
  RS.resTakeoff(s, RES, U);
  assert.deepEqual(s.run.res, { bertha: 1, mo: 1 }, 'Lv 1 with moving in');
  assert.equal(s.items.pretzel || 0, 0, 'Bertha’s lunch is Lv 2');
  s = takeoff({ bertha: 1 }, { bertha_2: 1 });
  const got = RS.resTakeoff(s, RES, U);
  assert.deepEqual(s.run.res, { bertha: 2 });
  assert.deepEqual(got.items, { pretzel: 1 });
  assert.equal(s.items.pretzel, 1);
  assert.equal(s.items.potion, 2, 'the run’s start untouched');
  assert.equal(validRun(s.run), true, 'a reload keeps the levels');
  assert.equal(validRun({ ...s.run, res: { bertha: 0 } }), false);
  assert.equal(validRun({ ...s.run, rerolled: -1 }), false);
});

test('residents: RS-4: a service level’s effect rows join the run’s, tagged res:<id>', () => {
  const R = structuredClone(RES);
  R.bertha.service[0].fx = [{ kind: 'payout', mult: 1.1 }];
  const rows = RS.resFxRows({ perks: [], res: { bertha: 1 } }, R);
  assert.deepEqual(rows, [{ kind: 'payout', mult: 1.1, src: 'res:bertha' }]);
  assert.deepEqual(RS.resFxRows({ perks: [] }, R), [], 'a run from before has none');
  assert.deepEqual(
    RS.resHeld({ mo: 2, nobody: 3 }, RES).map(([id]) => id),
    ['mo', 'mo']
  );
  assert.equal(fxOfRun({ perks: [], res: { bertha: 2, mo: 3 } }, GAME_DATA.perks), null, 'Mo and Bertha have no rows');
});

test('residents: RS-4: the game’s takeoff (runStartOn) brings the services; a daily brings none', () => {
  const { runStartOn, runStartPlan } = modules['run-start'],
    { runUnlocks } = modules.unlocks,
    D = { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings },
    DATA = {
      nodeTypes: GAME_DATA.nodeTypes,
      biomes: GAME_DATA.biomes,
      pools: GAME_DATA.pools,
      scenery: GAME_DATA.scenery,
      rules: GAME_DATA.rules.run,
      unlockData: D,
      region: modules['run-region'].runRegionData(GAME_DATA, GAME_DATA.trainers),
    };
  for (const board of [null, { kind: 'daily', id: '2026-10-27' }]) {
    const s = startedSave('musk0', 5);
    s.meta = { ...newMeta(), residents: { bertha: 1 }, unlocks: { bertha_2: 1 } };
    s.run = null;
    const plan = runStartPlan('RESSEED', DATA, { unlocks: runUnlocks(s, D) });
    if (board) plan.board = board;
    runStartOn(s, plan, { home: [s.team[0].uid] });
    if (board) assert.equal(s.run.res, undefined, 'a daily is the same for everyone');
    else {
      assert.deepEqual(s.run.res, { bertha: 2 });
      assert.equal(s.items.pretzel, 1);
    }
  }
});

test('residents: RS-4: Mo’s store sells his Lv 1 stock once he moves in, and more at Lv 2', () => {
  const s = { meta: { ...newMeta(), residents: {}, unlocks: {} } };
  assert.deepEqual(RS.resStock(s, 'mo', RES, U), [], 'not living there: an empty store');
  s.meta.residents.mo = 1;
  const one = RS.resStock(s, 'mo', RES, U);
  assert.deepEqual(
    one.map(w => w.item || 'coin:' + w.coin),
    ['potion', 'pretzel', 'coin:pyramid']
  );
  assert.ok(
    one.every(w => w.price > 0 && w.price < GAME_DATA.items.potion.price),
    'priced in Research, not Moneys'
  );
  s.meta.unlocks.mo_2 = 1;
  assert.deepEqual(
    RS.resStock(s, 'mo', RES, U).map(w => w.item || 'coin:' + w.coin),
    ['potion', 'pretzel', 'coin:pyramid', 'hi_potion', 'full_remedy', 'revive']
  );
  one[0].price = 1;
  assert.equal(RS.resStock(s, 'mo', RES, U)[0].price, RES.mo.service[0].stock[0].price, 'a copy, never the table');
  assert.deepEqual(RS.resStock(s, 'bertha', RES, U), [], 'Bertha sells nothing');
});

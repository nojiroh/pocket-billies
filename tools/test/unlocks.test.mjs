// RL-11: logic/unlocks.js, the one unlock table on the game's own data: buying at a building in its currency, what a
// row needs, the doors, earned rows (in the hub only), the tidy-up on load, and a run's copy of its shop and biome
// unlocks, which keeps the same seed making the same run.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules, startedSave } from './setup-real.mjs';

const K = modules.unlocks,
  D = { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings },
  RUN = GAME_DATA.rules.run;
const { runMapMake } = modules['run-map'],
  { runShopStock } = modules['run-loop'];

const hubSave = (o = {}) => {
  const s = startedSave('musk0', 5);
  Object.assign(s.meta, o);
  return s;
};

test('unlocks: each row is sold at its building in that building’s currency, or earned', () => {
  for (const [id, R] of Object.entries(D.unlocks)) {
    const door = K.unlockDoor(R);
    if (R.when) assert.equal(door, 'earned', id);
    else assert.equal(K.unlockCurrency(R, D), D.buildings[R.at].currency, id);
  }
  assert.equal(K.unlockDoor(D.unlocks.shop_bailout), 'board');
  assert.equal(K.unlockDoor(D.unlocks.ranch_2), 'building');
  assert.equal(K.unlockCurrency(D.unlocks.ranch_2, D), 'scrap');
  assert.equal(K.unlockCurrency(D.unlocks.airship_2, D), 'crests');
});

test('unlocks: buying pays once, in the right currency, and grants', () => {
  const s = hubSave({ research: 200, scrap: 50, crests: 0 });
  assert.equal(K.unlockReady(s, 'shop_bailout', D), null);
  assert.equal(K.unlockBuy(s, 'shop_bailout', D), true);
  assert.equal(s.meta.research, 200 - D.unlocks.shop_bailout.cost);
  assert.equal(s.meta.unlocks.shop_bailout, 1);
  assert.equal(K.unlockReady(s, 'shop_bailout', D), 'owned');
  assert.equal(K.unlockBuy(s, 'shop_bailout', D), false, 'never twice');
  assert.equal(s.meta.research, 200 - D.unlocks.shop_bailout.cost);
  assert.equal(K.buildingLevel(s, 'ranch'), 1);
  assert.equal(K.unlockBuy(s, 'ranch_2', D), true);
  assert.equal(s.meta.scrap, 50 - D.unlocks.ranch_2.cost, 'the ranch is paid in Scrap');
  assert.equal(K.buildingLevel(s, 'ranch'), 2);
  assert.equal(modules.ranch.ranchLevel(s), 2, 'the ranch reads its new level');
  assert.equal(K.unlockReady(s, 'airship_2', D), 'cost', 'no Crests');
  assert.equal(K.unlockReady(s, 'nope', D), 'unknown');
});

test('unlocks: what a row needs, earned rows, and the run refuse a purchase', () => {
  const s = hubSave({ research: 1e6, scrap: 1e6, crests: 9 });
  assert.equal(K.unlockReady(s, 'ranch_3', D), 'requires');
  assert.equal(K.unlockReady(s, 'biome_ridge', D), 'requires');
  assert.equal(K.unlockReady(s, 'first_run', D), 'earned', 'an earned row is not sold');
  assert.equal(K.unlockBuy(s, 'first_run', D), false);
  s.run = /** @type {any} */ ({ seed: 'X' });
  assert.equal(K.unlockReady(s, 'shop_appeal', D), 'run', 'bought in the hub');
  s.run = null;
  assert.ok(K.unlockBuy(s, 'ranch_2', D) && K.unlockBuy(s, 'ranch_3', D));
  assert.equal(K.buildingLevel(s, 'ranch'), 3);
  const soon = {
    ...D,
    unlocks: { ...D.unlocks, w: { name: 'w', about: 'w', at: 'workshop', cost: 1, grant: { scrap: 1 } } },
  };
  assert.equal(K.unlockReady(s, 'w', soon), 'soon', 'a building coming later sells nothing');
});

test('unlocks: earned rows are granted when their condition holds, once, in the hub only, chained', () => {
  const s = hubSave({ runs: 1, wins: 0 });
  const scrap = s.meta.scrap;
  s.run = /** @type {any} */ ({ seed: 'X' });
  assert.deepEqual(K.unlockAuto(s, D), [], 'never on a run');
  s.run = null;
  assert.deepEqual(K.unlockAuto(s, D), ['first_run']);
  assert.equal(s.meta.scrap, scrap + D.unlocks.first_run.grant.scrap);
  assert.deepEqual(K.unlockAuto(s, D), [], 'once');
  s.meta.wins = 1;
  const crests = s.meta.crests;
  assert.deepEqual(K.unlockAuto(s, D), ['first_win']);
  assert.equal(s.meta.crests, crests + 1);
  const chain = {
    ...D,
    unlocks: {
      a: { name: 'a', about: 'a', when: 'unlock:b', grant: { research: 1 } },
      b: { name: 'b', about: 'b', when: 'runs >= 1', grant: { research: 2 } },
    },
  };
  const t = hubSave({ runs: 1, research: 0 });
  assert.deepEqual(K.unlockAuto(t, chain), ['b', 'a'], 'a condition reading another unlock follows it');
  assert.equal(t.meta.research, 3);
});

test('unlocks: tidy forgets rows the table lost and rebuilds the buildings’ levels from what is owned', () => {
  const s = hubSave();
  s.meta.unlocks = { ranch_2: 1, gone_row: 1, shop_appeal: 1 };
  s.meta.buildings = { ranch: 7, lab: 4 };
  K.unlockTidy(s, D);
  assert.deepEqual(s.meta.unlocks, { ranch_2: 1, shop_appeal: 1 });
  assert.deepEqual(s.meta.buildings, { ranch: 2 });
  s.meta.unlocks = {};
  K.unlockTidy(s, D);
  assert.deepEqual(s.meta.buildings, {});
  assert.equal(K.buildingLevel(s, 'ranch'), 1);
  assert.ok(modules['meta-state'].validMeta(s.meta));
});

test('unlocks: a run’s copy opens its shops and map; the same seed and copy make the same run', () => {
  const s = hubSave();
  s.meta.unlocks = { shop_bailout: 1, ranch_2: 1, biome_ridge: 1, airship_2: 1 };
  assert.deepEqual(K.runUnlocks(s, D), ['biome_ridge', 'shop_bailout'], 'only shop and biome rows, sorted');
  const none = K.unlockOpen(RUN.shop.pick, 'shop', [], D);
  for (const k of ['settlement', 'appeal', 'bailout']) assert.ok(!(k in none), `${k} locked for a new player`);
  assert.ok('pretzel' in none && 'loophole' in none, 'what no row grants stays open');
  const some = K.unlockOpen(RUN.shop.pick, 'shop', K.runUnlocks(s, D), D);
  assert.ok('bailout' in some && !('appeal' in some));
  assert.equal(K.unlockOpen(RUN.shop.pick, 'shop', undefined, D), RUN.shop.pick, 'a run from before RL-11: all open');
  const biomes = K.unlockOpen(RUN.map.biomes, 'biome', K.runUnlocks(s, D), D);
  assert.deepEqual(Object.keys(biomes).sort(), ['lake', 'meadow', 'ridge', 'thicket']);
  const fresh = K.unlockOpen(RUN.map.biomes, 'biome', [], D);
  const map = runMapMake('SEED123456', GAME_DATA.nodeTypes, { ...RUN.map, biomes: fresh });
  assert.ok(
    map.nodes.every(n => n.biome in fresh),
    'a new player’s map uses open biomes only'
  );
  assert.deepEqual(
    runMapMake('SEED123456', GAME_DATA.nodeTypes, { ...RUN.map, biomes: fresh }),
    map,
    'same seed, same map'
  );
  const run = /** @type {any} */ ({ seed: 'SEED123456' }),
    rule = { ...RUN.shop, pick: some };
  for (let day = 1; day < 9; day++) {
    const a = runShopStock(run, 3, day, rule);
    assert.deepEqual(runShopStock(run, 3, day, rule), a, `day ${day}: same stock`);
    assert.ok(
      a.every(w => !w.item || w.item !== 'appeal'),
      'nothing it hasn’t unlocked'
    );
  }
});

test('unlocks: a loaded save (saves.js saveFill) is tidied: lost rows forgotten, levels from what is owned', () => {
  const s = hubSave();
  s.meta.unlocks = { ranch_2: 1, ranch_3: 1, gone_row: 1 };
  s.meta.buildings = { ranch: 1 };
  const back = modules.saves.saveFill(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.meta.unlocks, { ranch_2: 1, ranch_3: 1 });
  assert.equal(modules.ranch.ranchLevel(back), 3);
});

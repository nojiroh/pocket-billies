// Studio plan T2.4: the Run Lab's preview of a run (logic/run-preview.js runPreview, which the Studio's logic worker
// answers) equals what the game itself works out for the same seed: a save at the mast takes off through
// runStartPlan/runStartOn, then the run's foes as run-world.js makes them, a town's stock and shelf as shop.js opens
// them on a day, its places' wild tables (run-scenes.js runWorldTables) and the Perk picks battle.js makes after
// each mini-boss, with nothing held; RL-R2b: the run's side area too.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, fn, GAME_DATA, hooks, modules, reseed } from './setup-real.mjs';

const { runPreview } = modules['run-preview'];
const { runStartOn, runStartPlan } = modules['run-start'];
const { runUnlocks, unlockOpen } = modules.unlocks;
const { runFoes, runShopStock } = modules['run-loop'];
const { runWorldTables, runPlaceId } = modules['run-scenes'];
const { perkOfferMake, perkShelf } = modules.perks;
const { NODE_TYPES, POOLS, PERKS, RULES, START_NODE, TRAINERS, UNLOCK_DATA, gameData } = data;

const SEEDS = ['LAB1', 'TESTSEED', 'Q7', 'ZZTOP99', 'PREVIEW-3'],
  CASES = {
    none: { unlocks: [] },
    all: { unlocks: Object.keys(GAME_DATA.unlocks) },
    short: { unlocks: [], map: { rows: 5, minibosses: 1 } },
  };

/** run-world.js runWorldData, which the page's runTakeOff and runWorldSync use */
const worldData = () => ({
  nodeTypes: NODE_TYPES,
  biomes: gameData.biomes,
  pools: POOLS,
  scenery: gameData.scenery,
  rules: RULES.run,
  region: modules['run-region'].runRegionData(gameData, TRAINERS),
  fieldMoves: data.FIELD_MOVES,
  setPieces: data.SET_PIECES,
});

/** what the game shows for a seed: the run on a save, then each part as the page asks for it */
function theGame(/** @type {string} */ seed, /** @type {{ unlocks: string[], map?: object }} */ c) {
  reseed(1);
  const s = fn('newSave')();
  s.started = true;
  s.starter = RULES.start.starters[0];
  s.team.push(fn('makeBilly')(s.starter + '0', RULES.start.starterLevel));
  for (const id of c.unlocks) s.meta.unlocks[id] = 1;
  hooks.provide({ saveData: s });
  const plan = runStartPlan(
    seed,
    { ...worldData(), unlockData: UNLOCK_DATA },
    { unlocks: runUnlocks(s, UNLOCK_DATA), map: c.map }
  );
  runStartOn(s, plan, { home: [s.team[0].uid] });
  const run = s.run,
    foes = runFoes(run, { leaders: Object.values(TRAINERS).filter(T => T.miniboss), rules: RULES.run }),
    W = runWorldTables(run, gameData.locations[START_NODE], worldData()),
    rule = RULES.run.shop;
  /* RL-R2: three days past the shortest walk's last day (the old deadline's) */
  const lastDay = 1 + Math.max(...run.map.nodes.map(n => n.row)) + 3;
  const nodes = run.map.nodes.map((n, i) => {
    const shop = [];
    if (n.type === 'town')
      for (let day = n.row + 1; day <= lastDay; day++) {
        run.clock = day;
        const stock = runShopStock(run, i, run.clock, {
          ...rule,
          pick: unlockOpen(rule.pick, 'shop', run.unlocks, UNLOCK_DATA),
        });
        shop.push({ day, stock, relic: perkShelf(run, i, run.clock, PERKS, RULES.run.perks) });
      }
    const foe = Object.values(foes).find(F => F.runNode === i) || null;
    return { wild: W.pools[runPlaceId(i)], foe, shop: n.type === 'town' ? shop : null };
  });
  const offers = [],
    guards = new Set(run.map.nodes.filter(n => n.type === 'miniboss').map(n => n.row)).size;
  for (let k = 0; k < guards; k++) offers.push(perkOfferMake(run, PERKS, RULES.run.perks) || []);
  return { map: run.map, unlocks: run.unlocks, nodes, offers };
}

test('runPreview: the foes, shops, wild tables and Perk picks are the game’s for the same seed', () => {
  let sides = 0;
  for (const seed of SEEDS)
    for (const [name, c] of Object.entries(CASES)) {
      const want = theGame(seed, c),
        got = runPreview(seed, { unlocks: runUnlocks(hooks.saveData, UNLOCK_DATA), map: c.map });
      const at = `${seed}, ${name}`;
      assert.deepEqual(got.map, want.map, `${at}: the map`);
      assert.deepEqual(got.unlocks, want.unlocks, `${at}: the unlocks`);
      assert.equal(got.nodes.length, want.nodes.length, at);
      got.nodes.forEach((n, i) => {
        assert.deepEqual(n.wild, want.nodes[i].wild, `${at}: node ${i}'s wild table`);
        assert.deepEqual(n.foe, want.nodes[i].foe, `${at}: node ${i}'s foe`);
        assert.deepEqual(n.shop, want.nodes[i].shop, `${at}: node ${i}'s shop`);
      });
      assert.deepEqual(got.relicOffers, want.offers, `${at}: the Perk picks`);
      if (got.map.side) sides++;
    }
  /* RL-R2b: a side area on most runs (rules.json run.side), in the preview as in the game */
  assert.ok(sides > 0, 'some seed has a side area');
});

test('runPreview: every mini-boss and the boss has a foe, every town a day of stock, and it is plain data', () => {
  const p = runPreview('LAB1', { unlocks: [] });
  for (const n of p.map.nodes) {
    const P = p.nodes[p.map.nodes.indexOf(n)];
    if (n.type === 'miniboss' || n.type === 'boss') assert.ok(P.foe && P.foe.team.length, `${n.type} has a foe`);
    if (n.type === 'town') assert.ok(P.shop.length > 0 && P.shop[0].stock.length > 0, 'a town has stock');
    assert.ok(P.wild.list.length > 0, 'a place has wild Billies');
  }
  assert.ok(p.relicOffers.length >= 1);
  assert.deepEqual(JSON.parse(JSON.stringify(p)), p, 'it crosses to the Studio page as it is (structured clone)');
});

test('the preview gives a stall a shop and a waystation its event, as the game draws it (RL-12b)', () => {
  const { eventAt } = modules.encounters;
  let stalls = 0,
    stands = 0;
  for (let k = 0; k < 12; k++) {
    const seed = `PREVWAY${k}`,
      P = runPreview(seed, {});
    P.map.nodes.forEach((/** @type {any} */ n, /** @type {number} */ i) => {
      const N = P.nodes[i];
      if (n.type === 'stall') stalls++;
      assert.equal(!!N.shop, n.type === 'stall' || n.type === 'town', `${seed} node ${i}`);
      if (n.type !== 'event') return assert.equal(N.event, null);
      stands++;
      const run = /** @type {any} */ ({ seed, map: P.map, enc: undefined });
      assert.equal(N.event, eventAt(run, i, data.EVENTS) || null, `${seed} node ${i}`);
    });
  }
  assert.ok(stalls >= 1 && stands >= 1, `${stalls} stalls, ${stands} waystations`);
});

// RL-12b: a waystation's and a stall's scenes and world rows on the game's own data. Over a few seeds whose maps hold
// both: each such place is made with no generator note and walkable from its hub; a waystation has its stand (act
// 'event') and a stall its stall (act 'stall') beside the road, and neither has a clinic or a shop building; both
// rows are waystations (fewer wild Billies: rules.json run.wild.waystation), and a stall's row has a shop of its own.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';
import { data, GAME_DATA, modules } from './setup-real.mjs';

const { runStartPlan } = modules['run-start'],
  { runRegionData } = modules['run-region'],
  { newRun } = modules['run-state'],
  { MAPGEN_VERSION, mapgenUnreachable } = modules.mapgen,
  { runSceneMake, runWorldTables, runShopId } = modules['run-scenes'];
const RAW = readGameData(),
  DATA = {
    nodeTypes: GAME_DATA.nodeTypes,
    biomes: GAME_DATA.biomes,
    rules: GAME_DATA.rules.run,
    unlockData: { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings },
    region: runRegionData(RAW, RAW.trainers),
    fieldMoves: GAME_DATA.fieldMoves.moves,
  },
  WORLD_DATA = {
    nodeTypes: GAME_DATA.nodeTypes,
    biomes: GAME_DATA.biomes,
    pools: data.POOLS,
    scenery: GAME_DATA.scenery,
    rules: GAME_DATA.rules.run,
    fieldMoves: GAME_DATA.fieldMoves.moves,
  },
  HUB = GAME_DATA.locations[0];

/** the first seeds (WAY0, WAY1, ...) whose main path holds a waystation and a stall @param {number} n */
function seedsWithBoth(n) {
  const out = [];
  for (let k = 0; out.length < n && k < 200; k++) {
    const seed = `WAY${k}`,
      plan = runStartPlan(seed, DATA, { expedition: 5 }),
      types = new Set(plan.map.nodes.filter((/** @type {any} */ x) => !x.side).map((/** @type {any} */ x) => x.type));
    if (types.has('event') && types.has('stall')) out.push({ seed, plan });
  }
  return out;
}

test("a waystation's stand and a stall's stall stand by the road, and their rows say so", () => {
  const found = seedsWithBoth(2);
  assert.equal(found.length, 2, 'two seeds of the first 200 have both');
  for (const { seed, plan } of found) {
    const run = newRun(seed, 1, MAPGEN_VERSION, /** @type {any} */ ({}));
    run.map = plan.map;
    run.region = plan.region;
    const made = /** @type {any[]} */ ([]),
      W = runWorldTables(run, HUB, WORLD_DATA);
    run.map.nodes.forEach((/** @type {any} */ node, /** @type {number} */ i) => {
      const { scene, notes } = runSceneMake(run, i, made, WORLD_DATA);
      made.push(scene);
      const row = W.locations[i + 1],
        where = `${seed} node ${i} (${node.type})`;
      if (node.type !== 'event' && node.type !== 'stall') {
        assert.equal(row.waystation, undefined, where);
        return;
      }
      assert.deepEqual(notes, [], where);
      assert.deepEqual(mapgenUnreachable(scene, GAME_DATA.scenery), [], `${where}: walkable from its hub`);
      const acts = scene.props.map((/** @type {any} */ p) => p.act).filter(Boolean);
      assert.ok(!acts.includes('clinic') && !acts.includes('shop'), `${where}: no clinic or shop building`);
      assert.equal(row.waystation, 1, where);
      if (node.type === 'event') {
        const P = scene.props.find((/** @type {any} */ p) => p.act === 'event');
        assert.ok(P && P.k === 'tent' && P.label === 'Waystation', `${where}: the stand`);
        assert.equal(row.shop, undefined, where);
      } else {
        const P = scene.props.find((/** @type {any} */ p) => p.act === 'stall');
        assert.ok(P && P.k === 'stall', `${where}: the stall`);
        assert.equal(row.shop, runShopId(i), where);
        assert.equal(W.shops[row.shop].runNode, i, `${where}: its shop`);
      }
    });
  }
});

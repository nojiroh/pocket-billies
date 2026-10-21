// RL-7: a run's world on the game's own data (biomes.json, rules.json run, nodeTypes.json, scenery.json): every scene
// of a run's map made by the generator from the run's seed, each joined to its parents, and the world tables with
// Copperleaf first. What must hold for every seed: each road's two exits exist with the ids the tables name, face
// each other and line up (check-data's seam rules), the two scenes meet with no height gap or step and a straight
// walk across (mapgenSeamAgreement), every scene can be walked from its hub to everywhere, the generator has no note;
// the same seed makes the same scenes; the run's world goes in and the hub's comes back exactly.
//   node --test --test-update-snapshots tools/test/run-world-real.test.mjs   remakes the frozen dials (say why in the
//   commit: a change to how a node's dials are drawn changes every run's scenes)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PB_DATA } from '../data-files.mjs';
import { data, GAME_DATA, modules } from './setup-real.mjs';

const { runMapStart } = modules['run-map'];
const { newRun } = modules['run-state'];
const { seamRulesLinks } = modules['seam-rules'];
const { MAPGEN_VERSION, mapgenSeamAgreement, mapgenUnreachable } = modules.mapgen;
const { runSceneExits, runSceneMake, runSceneParams, runScenesMake, runWorldTables } = modules['run-scenes'];

const START = {
  team: [],
  se: 0,
  items: {},
  coins: {},
  trip: { node: 0, plan: [] },
  wild: {},
  eggs: [],
  flags: {},
  seats: [],
  visited: {},
};
const R = GAME_DATA.rules.run,
  MAP_DATA = { nodeTypes: GAME_DATA.nodeTypes, biomes: GAME_DATA.biomes, rules: R },
  WORLD_DATA = {
    nodeTypes: GAME_DATA.nodeTypes,
    biomes: GAME_DATA.biomes,
    pools: data.POOLS,
    scenery: GAME_DATA.scenery,
    rules: R,
  },
  HUB = GAME_DATA.locations[0];
/** a run with its map, as the mast gives it (RL-8) */
function runOf(/** @type {string} */ seed) {
  const run = newRun(seed, 1, MAPGEN_VERSION, START);
  runMapStart(run, MAP_DATA);
  return run;
}
const SEEDS = ['RL7WORLD0', 'RL7WORLD1', 'RL7WORLD2', 'RL7WORLD3', 'RL7WORLD4', 'RL7WORLD5'];

test("every run's scenes join: exits where the roads say, no gap, a straight walk across, all ground reachable", () => {
  const scenery = GAME_DATA.scenery;
  let roads = 0,
    scenes = 0;
  for (const seed of SEEDS) {
    const run = runOf(seed),
      map = run.map,
      made = /** @type {any[]} */ ([]);
    map.nodes.forEach((_, i) => {
      const { scene, notes } = runSceneMake(run, i, made, WORLD_DATA);
      assert.deepEqual(notes, [], `${seed} node ${i}`);
      made.push(scene);
    });
    const W = runWorldTables(run, HUB, WORLD_DATA),
      maps = Object.fromEntries(W.locations.slice(1).map((p, i) => [p.mapId, made[i]]));
    made.forEach((sc, i) => {
      const where = `${seed} node ${i}`;
      assert.deepEqual(
        sc.edgeExits.map((/** @type {any} */ e) => [e.id, e.side, e.t]),
        runSceneExits(map, i).map(e => [e.id, e.side, e.t]),
        `${where}: the exits the roads name`
      );
      assert.deepEqual(mapgenUnreachable(sc, scenery), [], where);
      assert.equal(sc.locationId, W.locations[i + 1].id, where);
      assert.equal(sc.climate, GAME_DATA.biomes[map.nodes[i].biome].climate, where);
      scenes++;
    });
    /* check-data's seam rules on the run's roads, as on the hub's */
    const links = seamRulesLinks({
      roads: W.roads,
      roadOf: L => PB_DATA.road({ locations: W.locations }, L),
      locations: W.locations,
      maps,
      terrains: scenery.terrains,
    });
    assert.deepEqual(links.problems, [], seed);
    for (const L of W.roads) {
      const a = mapgenSeamAgreement(maps[L.a.map], L.a.exit, maps[L.b.map], L.b.exit, scenery);
      assert.ok(a, `${seed} ${L.id}`);
      assert.deepEqual([a.dhNear, a.dhBand, a.raiseExit, a.walk], [0, 0, 0, null], `${seed} ${L.id}`);
      roads++;
    }
  }
  assert.ok(scenes > 60 && roads > 60, `${scenes} scenes, ${roads} roads`);
});

test('the same seed makes the same scenes; every node its own', () => {
  const a = runScenesMake(runOf('RL7SAME'), WORLD_DATA),
    b = runScenesMake(runOf('RL7SAME'), WORLD_DATA);
  assert.deepEqual(a, b);
  assert.equal(new Set(a.map(sc => sc.gen.seed)).size, a.length);
  assert.notDeepEqual(runScenesMake(runOf('RL7OTHER'), WORLD_DATA)[0].tiles, a[0].tiles);
});

test("a node's dials are frozen: a change to how they are drawn changes every run's scenes", t => {
  const run = runOf('RL7FROZEN'),
    made = runScenesMake(run, WORLD_DATA);
  t.assert.snapshot(
    run.map.nodes.map((_, i) => {
      const { edges, ...P } = runSceneParams(run, i, made, WORLD_DATA);
      return { ...P, edges: edges.length };
    })
  );
});

test("the run's world goes in (its scenes, pools, places and roads) and the hub's comes back exactly", () => {
  const TABLES = ['LOCATIONS', 'ROADS', 'ROADS_BY_NODE', 'LOCATION_BY_ID'],
    hubTables = () => structuredClone(Object.fromEntries(TABLES.map(k => [k, data[k]]))),
    hub = hubTables(),
    mapIds = Object.keys(data.gameData.maps),
    poolIds = Object.keys(data.POOLS),
    run = runOf('RL7SWAP'),
    made = runScenesMake(run, WORLD_DATA),
    W = runWorldTables(run, data.LOCATIONS[0], WORLD_DATA),
    maps = Object.fromEntries(W.locations.slice(1).map((p, i) => [p.mapId, made[i]]));
  try {
    data.worldPut({ ...W, maps });
    assert.equal(data.LOCATIONS.length, 1 + run.map.nodes.length);
    assert.equal(data.LOCATIONS[0].id, 'copperleaf');
    assert.equal(data.ROADS.length, W.roads.length);
    assert.deepEqual(data.worldExtraMaps(), maps);
    data.LOCATIONS.slice(1).forEach((p, i) => {
      assert.equal(p.pool, `run_${i}`, 'its own pool, kept');
      assert.equal(data.POOLS[p.pool], W.pools[p.pool]);
      assert.equal(data.gameData.maps[p.mapId], made[i]);
      assert.equal(p.runNode, i);
    });
    /* each road as long as the walk out of one scene and into the other (its exits' len), not the 100 m of a
       road without scenes */
    for (const [a, b, m, j] of data.ROADS) {
      const len = (/** @type {number} */ n, /** @type {string} */ id) =>
        maps[data.LOCATIONS[n].mapId].edgeExits.find((/** @type {any} */ e) => e.id === id).len;
      assert.equal(m, Math.max(1, Math.round(len(a, j.a) + len(b, j.b))), j.id);
    }
    assert.deepEqual(data.ROADS_BY_NODE[1].map(e => e.to).sort(), run.map.nodes[0].to.map(i => i + 1).sort());
    /* another run's world in its place takes the first one's out */
    const run2 = runOf('RL7SWAP2'),
      W2 = runWorldTables(run2, data.LOCATIONS[0], WORLD_DATA),
      made2 = runScenesMake(run2, WORLD_DATA);
    data.worldPut({ ...W2, maps: Object.fromEntries(W2.locations.slice(1).map((p, i) => [p.mapId, made2[i]])) });
    assert.ok(
      Object.keys(maps).every(id => !data.gameData.maps[id]),
      "the first run's scenes are gone"
    );
    assert.equal(data.LOCATIONS.length, 1 + run2.map.nodes.length);
  } finally {
    data.worldHubBack();
  }
  assert.deepEqual(hubTables(), hub);
  assert.deepEqual(Object.keys(data.gameData.maps), mapIds, "only the hub's scenes");
  assert.deepEqual(Object.keys(data.POOLS), poolIds, "only the game's pools");
  assert.deepEqual(data.worldExtraMaps(), {});
});

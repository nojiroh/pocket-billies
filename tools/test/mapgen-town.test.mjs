// Towns track TW-1: a run town (mapgen.js mapgenStageTown, kind 'town'). On real runs' town nodes: a street off the
// main road to a level square with its middle (a well or a fountain) and a notice board's spot, the clinic and the
// shop on the square's north side facing the camera with their doors a walk from the hub and their rooms fitting
// behind them, 4-7 shut houses (no act, no room) facing the camera, tall grass kept, no townsfolk yet, no note,
// nothing unreachable, the east and west edges still pinned; the same seed makes the same town; a route has none.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, GAME_DATA, modules } from './setup-real.mjs';

const G = modules.mapgen;
const { runMapStart } = modules['run-map'];
const { newRun } = modules['run-state'];
const { runSceneMake } = modules['run-scenes'];
const C = GAME_DATA.scenery,
  R = GAME_DATA.rules.run,
  MAP_DATA = { nodeTypes: GAME_DATA.nodeTypes, biomes: GAME_DATA.biomes, rules: R },
  WORLD_DATA = { nodeTypes: GAME_DATA.nodeTypes, biomes: GAME_DATA.biomes, pools: data.POOLS, scenery: C, rules: R },
  START = {
    team: [],
    se: 0,
    items: {},
    pyramids: {},
    trip: { node: 0, plan: [] },
    wild: {},
    eggs: [],
    flags: {},
    seats: [],
    visited: {},
  };
const HOUSE = /house|cottage/;

/** every scene of a run's map, with the nodes' types */
function runScenes(/** @type {string} */ seed) {
  const run = newRun(seed, 1, G.MAPGEN_VERSION, START);
  runMapStart(run, MAP_DATA);
  const made = /** @type {any[]} */ ([]);
  return run.map.nodes.map((node, i) => {
    const { scene, notes } = runSceneMake(run, i, made, WORLD_DATA);
    made[i] = scene;
    return { node, i, scene, notes };
  });
}

test('a route has no square and no houses', () => {
  const sc = G.mapgenScene(
    { seed: 4242, props: { clinic: 1, shop: 1 } },
    { scenery: C, biomes: GAME_DATA.biomes }
  ).scene;
  assert.equal(sc.kind, 'route');
  assert.ok(!(sc.spots || []).some(s => s.kind === 'square' || s.kind === 'board'));
  assert.ok(!sc.props.some(p => HOUSE.test(p.k)));
});

test('every run town has a street, a square with the clinic and the shop on it, and 4-7 shut houses', () => {
  let towns = 0,
    four = 0;
  for (const seed of ['TW1A', 'TW1B', 'TW1C', 'TW1D', 'TW1E', 'TW1F']) {
    for (const { node, i, scene: sc, notes } of runScenes(seed)) {
      const where = `${seed} node ${i}`;
      if (node.type !== 'town') {
        assert.equal(sc.kind, 'route', where);
        continue;
      }
      towns++;
      assert.equal(sc.kind, 'town', where);
      assert.deepEqual(notes, [], where);
      assert.equal(sc.folk, 0, `${where}: no townsfolk yet (TW-2)`);
      const B = GAME_DATA.biomes[node.biome],
        sq = (sc.spots || []).find(s => s.kind === 'square'),
        board = (sc.spots || []).find(s => s.kind === 'board');
      assert.ok(sq && board, `${where}: a square and a board's spot`);
      assert.ok(
        sc.props.some(p => p.k === B.town.centre && Math.hypot(p.x - sq.x, p.z - sq.z) < 0.1),
        `${where}: the ${B.town.centre} in the square's middle`
      );
      assert.ok(!sc.props.some(p => Math.hypot(p.x - board.x, p.z - board.z) < 1), `${where}: the board's spot clear`);
      /* the square is level and paved */
      const tile = (x, z) => (sc.tiles[sc.h - 1 - Math.floor(z)] || '')[Math.floor(x)];
      assert.equal(tile(sq.x + 0.5, sq.z - 2.5), B.town.square, `${where}: the square's ground`);
      const hs = [];
      for (let z = Math.ceil(sq.z - 2); z <= Math.floor(sq.z + 2); z++)
        for (let x = Math.ceil(sq.x - 5); x <= Math.floor(sq.x + 5); x++) hs.push(G.mapgenSceneCorner(sc, x, z));
      assert.ok(Math.max(...hs) - Math.min(...hs) <= 0.01, `${where}: the square is level`);
      /* the clinic and the shop: north of the square, facing the camera, doors reachable, rooms fitting */
      const reach = G.mapgenReach(sc, C);
      for (const [k, act] of [
        ['clinic', 'clinic'],
        ['shop', 'shop'],
      ]) {
        const b = sc.props.filter(p => p.k === k);
        assert.equal(b.length, 1, `${where}: one ${k}`);
        const p = b[0],
          M = C.props[k],
          dx = ((M.door && M.door.x) || 0) / (C.ppu || 34),
          step = [p.x + dx, p.z - 0.55];
        assert.equal(p.act, act, where);
        assert.ok(!p.rot && !p.f, `${where}: the ${k} faces the camera`);
        assert.ok(p.z > sq.z && Math.abs(p.x - sq.x) < 8, `${where}: the ${k} on the square's north side`);
        assert.ok(G.mapgenReached(reach, ...step), `${where}: the ${k}'s door step can't be walked to`);
        assert.ok(step[0] >= 7 && step[0] <= sc.w - 7 && p.z <= sc.h - 10.4, `${where}: the ${k}'s room fits`);
      }
      /* the houses: shut (no act, no room of their own), facing the camera, each a walk from the hub */
      const houses = sc.props.filter(p => HOUSE.test(p.k));
      assert.ok(houses.length >= 3 && houses.length <= 7, `${where}: ${houses.length} houses`);
      if (houses.length >= 4) four++;
      for (const p of houses) {
        const M = C.props[p.k];
        assert.ok(B.town.houses[p.k], `${where}: ${p.k} is in the ${node.biome} set`);
        assert.ok(!p.act && !p.room && !M.room, `${where}: ${p.k} is shut`);
        assert.ok(!p.rot && !p.f, `${where}: ${p.k} faces the camera`);
        const dx = ((M.door && M.door.x) || 0) / (C.ppu || 34);
        assert.ok(G.mapgenReached(reach, p.x + dx, p.z - 0.55), `${where}: ${p.k}'s door step can't be walked to`);
      }
      assert.ok(sc.tiles.join('').includes(B.ground.tall), `${where}: tall grass`);
      assert.deepEqual(G.mapgenUnreachable(sc, C), [], where);
      /* a run's scenes meet any neighbour at height 0 on their east and west edges */
      for (const row of sc.heights) assert.ok(row[0] === 0 && row[sc.w] === 0, `${where}: the edges pinned`);
    }
  }
  assert.ok(towns >= 15, `${towns} towns`);
  assert.ok(four >= towns * 0.9, `${four} of ${towns} towns with 4 houses or more`);
});

test('the same seed makes the same town', () => {
  const a = runScenes('TW1SAME'),
    b = runScenes('TW1SAME');
  const towns = a.filter(t => t.node.type === 'town');
  assert.ok(towns.length > 0);
  for (const t of towns) assert.equal(JSON.stringify(t.scene), JSON.stringify(b[t.i].scene));
});

// Towns track TW-1: a run town (mapgen.js mapgenStageTown, kind 'town'). On real runs' town nodes: a street off the
// main road to a level square with its middle (a well or a fountain) and a notice board's spot, the clinic and the
// shop on the square's north side facing the camera with their doors a walk from the hub and their rooms fitting
// behind them, 4-7 shut houses (no act, no room) facing the camera, a vegetable plot south of the road, tall grass kept, no note,
// nothing unreachable, the east and west edges still pinned; the same seed makes the same town; a route has none.
// TW-2: its townsfolk by its houses, its biome's town animals on its ground, its biome's and region's chat, 1-2
// named locals on its square and by a gate, each with a townsfolk look, a name and two of the biome's lines; a route
// has no folk, no chat and no locals.
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
const HOUSE = /house|cottage/,
  /* half the deepest square's depth (MAPGEN_TOWN.squares) */
  SQUARE_HALF_DEPTH = 4;

/** every scene of a run's map, with the nodes' types */
function runScenes(/** @type {string} */ seed) {
  const run = newRun(seed, 1, G.MAPGEN_VERSION, START);
  runMapStart(run, MAP_DATA);
  const made = /** @type {any[]} */ ([]);
  return run.map.nodes.map((node, i) => {
    const { scene, notes } = runSceneMake(run, i, made, WORLD_DATA);
    made[i] = scene;
    return { node, i, scene, notes, run };
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
  assert.equal(sc.folk, 0);
  assert.ok(!sc.chat && !sc.people);
  assert.ok(
    sc.life.every(l => !l.area),
    "only the biome's wild animals"
  );
});

test('a run town draws 3 folk when busy, 5 on Balanced, 6 on Beautiful', () => {
  const { runTownFolkCap } = modules['run-scenes'];
  assert.equal(runTownFolkCap(R.town, 0, 'sharp'), 6);
  assert.equal(runTownFolkCap(R.town, 1, 'smooth'), 5);
  assert.equal(runTownFolkCap(R.town, 2, 'sharp'), 3);
  assert.equal(runTownFolkCap(R.town, 4, 'smooth'), 3);
});

test('every run town has a street, a square with the clinic and the shop on it, and 4-7 shut houses', () => {
  let towns = 0,
    four = 0;
  for (const seed of ['TW1A', 'TW1B', 'TW1C', 'TW1D', 'TW1E', 'TW1F']) {
    for (const { node, i, scene: sc, notes, run } of runScenes(seed)) {
      const where = `${seed} node ${i}`;
      if (node.type !== 'town') {
        assert.equal(sc.kind, 'route', where);
        continue;
      }
      towns++;
      assert.equal(sc.kind, 'town', where);
      assert.deepEqual(notes, [], where);
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
      /* south of the road (the camera's side): a fenced vegetable plot in farm soil */
      assert.ok(
        sc.props.some(p => p.k === 'planter_box' && p.z < sq.z - 8 && tile(p.x, p.z) === 'o'),
        `${where}: a vegetable plot south of the road`
      );
      assert.deepEqual(G.mapgenUnreachable(sc, C), [], where);
      /* TW-2: townsfolk by its houses (2, one more every 2 houses, at most 6) */
      const F = G.MAPGEN_TOWN.folk;
      assert.equal(sc.folk, Math.min(F.most, F.base + Math.floor(houses.length / F.houses)), `${where}: folk`);
      assert.ok(sc.folk >= 2 && sc.folk <= 6, where);
      /* its biome's town animals, on its ground (pigeons only with 5 houses or more, on the square) */
      for (const L of B.town.life || []) {
        const got = sc.life.find(l => l.k === L.k && l.area);
        if (L.houses && houses.length < L.houses) assert.ok(!got, `${where}: no ${L.k} in a small town`);
        else {
          assert.ok(got && got.n === L.n, `${where}: ${L.k} in town`);
          const [x0, z0, x1, z1] = got.area;
          assert.ok(x0 < x1 && z0 < z1 && x0 >= 1 && z1 <= sc.h - 1, `${where}: ${L.k}'s ground`);
          if (L.square) assert.ok(x0 >= sq.x - 9 && x1 <= sq.x + 9, `${where}: ${L.k} on the square`);
        }
      }
      /* its chat: the biome's lines, then the region's */
      const own = (run.region && R.town.chat[run.region.theme]) || [];
      assert.deepEqual(sc.chat, B.town.chat.concat(own), `${where}: chat`);
      /* 1-2 named locals, on the square first, a walk from the hub, each with a townsfolk look and two lines */
      const P = sc.people || [];
      assert.ok(P.length >= R.town.locals[0] && P.length <= R.town.locals[1], `${where}: ${P.length} locals`);
      assert.equal(new Set(P.map(p => p.name)).size, P.length, `${where}: no name twice`);
      P.forEach((p, k) => {
        assert.ok(R.town.names.includes(p.name), where);
        assert.match(p.who, /^folk:\d+$/, where);
        assert.equal(p.lines.length, 2, where);
        assert.notEqual(p.lines[0], p.lines[1], where);
        for (const l of p.lines) assert.ok(B.town.chat.includes(l), `${where}: ${p.name} says the biome's lines`);
        assert.ok(G.mapgenReached(reach, p.x, p.z), `${where}: ${p.name} can't be walked to`);
        if (k === 0) assert.ok(Math.abs(p.z - sq.z) < SQUARE_HALF_DEPTH, `${where}: the first local on the square`);
      });
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

test("a run town's chat ends with its region's lines", () => {
  const { runTownLife } = modules['run-scenes'];
  const t = runScenes('TW2REGION').find(x => x.node.type === 'town');
  assert.ok(t);
  const sc = JSON.parse(JSON.stringify(t.scene)),
    biome = GAME_DATA.biomes[t.node.biome].town.chat;
  sc.chat = biome.slice();
  runTownLife({ ...t.run, region: { theme: 'harvest' } }, t.i, sc, WORLD_DATA);
  assert.deepEqual(sc.chat, biome.concat(R.town.chat.harvest));
  assert.deepEqual(sc.people, t.scene.people, 'the same locals: the region moves no draw');
});

// Towns track TW-1: a run town (mapgen.js mapgenStageTown, kind 'town'). On real runs' town nodes: a level square at
// the through road with its middle (a well or a fountain) and a notice board's spot, the clinic and the shop on the
// square's north side facing the camera with their doors a walk from the hub and their rooms fitting behind them, its
// size's shut houses (no act, no room) facing the camera, a vegetable plot south of a road or street, tall grass kept,
// no note, nothing unreachable, the east and west edges still pinned; the same seed makes the same town; a route has
// none. TW-2: its townsfolk by its houses, its biome's town animals on its ground, its biome's and region's chat, 1-2
// named locals on its square and by a gate, each with a townsfolk look, a name and two of the biome's lines; a route
// has no folk, no chat and no locals. WM-5: streets grown from the through road (mapgenTownPlan) at the three sizes
// (MAPGEN_TOWN_SIZES): a village's and a town's market stall, a town's second quest giver's spot, the houses its size
// asks for, every one facing the camera on the north side of its street; streets and houses south of a through road
// that runs high in a place two cells tall; the town dial. WM-6: the districts at every size and in runs: a park on
// lawn with the size's landmark in it, a farm edge on farm soil with crop rows, apart and off the square.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, GAME_DATA, modules } from './setup-real.mjs';

const G = modules.mapgen;
const { runMapStart } = modules['run-map'];
const { newRun } = modules['run-state'];
const { runSceneMake, runStallId, runTownOf } = modules['run-scenes'];
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
    flags: {},
    seats: [],
    visited: {},
  };
const HOUSE = /house|cottage/,
  /* the road's tiles, whichever surface (mapgen.js MAPGEN_SURFACES) */
  ROAD_TILES = Object.values(G.MAPGEN_SURFACES),
  /* half the deepest square's depth (MAPGEN_TOWN_SIZES squares) */
  SQUARE_HALF_DEPTH = 5,
  /* half the widest square's width, and a metre */
  SQUARE_HALF_WIDTH = 13;

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

test("every run town has a square with the clinic and the shop on it, streets and its size's shut houses", () => {
  let towns = 0,
    full = 0;
  const sizes = /** @type {Record<string, number>} */ ({});
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
      /* TW-3: the notice board on its spot (act notice), nothing else near it; the quest giver's spot clear */
      const near = (x, z, r) => sc.props.filter(p => Math.hypot(p.x - x, p.z - z) < r);
      assert.deepEqual(
        near(board.x, board.z, 1).map(p => [p.k, p.act]),
        [['notice_board', 'notice']],
        `${where}: the board on its spot`
      );
      const giver = (sc.spots || []).find(s => s.kind === 'giver');
      assert.ok(giver && !near(giver.x, giver.z, 0.6).length, `${where}: the giver's spot clear`);
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
      /* the houses: its size's (WM-5b: by its footprint, rules.json run.town.sizes), shut (no act, no room of their
         own), facing the camera, each a walk from the hub */
      const houses = sc.props.filter(p => HOUSE.test(p.k)),
        Z = G.MAPGEN_TOWN_SIZES[sc.town.size],
        want = runTownOf(run.map, i, WORLD_DATA);
      assert.equal(sc.town.size, want.size, where);
      sizes[want.size] = (sizes[want.size] || 0) + 1;
      assert.ok(sc.name.endsWith(' ' + want.word), `${where}: ${sc.name} says it is a ${want.word}`);
      /* WM-5b: a village's and a town's market stall opens its own shop; a town's second quest giver */
      const stalls = sc.props.filter(p => p.act === 'stall');
      assert.equal(stalls.length, want.stall, `${where}: market stalls`);
      for (const p of stalls) assert.equal(p.shop, runStallId(i), `${where}: the stall's own shop`);
      assert.equal(sc.town.givers, want.givers, `${where}: quest givers' spots`);
      assert.equal((sc.people || []).filter(p => p.quest).length, want.givers, `${where}: quest givers on their spots`);
      assert.equal(sc.town.houses, houses.length, where);
      assert.ok(houses.length >= 1 && houses.length <= Z.houses[1], `${where}: ${houses.length} houses`);
      if (houses.length >= Z.houses[0]) full++;
      assert.ok(sc.town.streets >= 1, `${where}: a street`);
      for (const p of houses) {
        const M = C.props[p.k];
        assert.ok(B.town.houses[p.k], `${where}: ${p.k} is in the ${node.biome} set`);
        assert.ok(!p.act && !p.room && !M.room, `${where}: ${p.k} is shut`);
        assert.ok(!p.rot && !p.f, `${where}: ${p.k} faces the camera`);
        const dx = ((M.door && M.door.x) || 0) / (C.ppu || 34);
        assert.ok(G.mapgenReached(reach, p.x + dx, p.z - 0.55), `${where}: ${p.k}'s door step can't be walked to`);
      }
      assert.ok(sc.tiles.join('').includes(B.ground.tall), `${where}: tall grass`);
      /* south of the road (the camera's side): a fenced vegetable plot in farm soil, the road (WM-5: or a street) a
         few metres north of it at its own x (WM-3: a road may bend, so not by the square's z) */
      const roadNorth = (/** @type {any} */ p) => {
        for (let dz = 1; dz <= 12; dz++) {
          const t = tile(p.x, p.z + dz);
          if (ROAD_TILES.includes(t) || t === B.town.square) return true;
        }
        return false;
      };
      assert.ok(
        sc.props.some(p => p.k === 'planter_box' && tile(p.x, p.z) === 'o' && roadNorth(p)),
        `${where}: a vegetable plot south of the road`
      );
      assert.deepEqual(G.mapgenUnreachable(sc, C), [], where);
      /* a run's scenes meet any neighbour at height 0 on their east and west edges, but where a river crosses (WA-3a:
         its bed keeps its height, the neighbour takes it from the edge strip; WM-1: and a bank's corner a cell on,
         a centimetre off, as TW1D's west edge since runs go west to east) */
      const wetBy = (x, r) =>
        [r - 2, r - 1, r, r + 1].some(k => k >= 0 && k < sc.h && 'wd'.includes(sc.tiles[k][Math.min(sc.w - 1, x)]));
      sc.heights.forEach((row, r) => {
        for (const x of [0, sc.w]) assert.ok(row[x] === 0 || wetBy(x, r), `${where}: the edges pinned`);
      });
      /* TW-2: townsfolk by its houses (2, one more every 2 houses, at most 10: WM-5) */
      const F = G.MAPGEN_TOWN.folk;
      assert.equal(sc.folk, Math.min(F.most, F.base + Math.floor(houses.length / F.houses)), `${where}: folk`);
      assert.ok(sc.folk >= 2 && sc.folk <= 10, where);
      /* its biome's town animals, on its ground (pigeons only with 5 houses or more, on the square) */
      for (const L of B.town.life || []) {
        const got = sc.life.find(l => l.k === L.k && l.area);
        if (L.houses && houses.length < L.houses) assert.ok(!got, `${where}: no ${L.k} in a small town`);
        else {
          assert.ok(got && got.n === L.n, `${where}: ${L.k} in town`);
          const [x0, z0, x1, z1] = got.area;
          assert.ok(x0 < x1 && z0 < z1 && x0 >= 1 && z1 <= sc.h - 1, `${where}: ${L.k}'s ground`);
          if (L.square)
            assert.ok(
              x0 >= sq.x - SQUARE_HALF_WIDTH && x1 <= sq.x + SQUARE_HALF_WIDTH,
              `${where}: ${L.k} on the square`
            );
        }
      }
      /* its chat: the biome's lines, then the region's */
      const own = (run.region && R.town.chat[run.region.theme]) || [];
      assert.deepEqual(sc.chat, B.town.chat.concat(own), `${where}: chat`);
      /* 1-2 named locals, on the square first, a walk from the hub, each with a townsfolk look and two lines */
      const P = (sc.people || []).filter(p => p.id !== 'quest');
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
      /* TW-3: one quest giver by the board, a walk from the hub, a townsfolk look, a name no local has */
      const Q = (sc.people || []).filter(p => p.quest);
      assert.equal(Q.length, 1, `${where}: a quest giver`);
      assert.deepEqual([Q[0].id, Q[0].x, Q[0].z], ['quest', giver.x, giver.z], where);
      assert.match(Q[0].who, /^folk:\d+$/, where);
      assert.ok(R.town.names.includes(Q[0].name) && !P.some(p => p.name === Q[0].name), `${where}: the giver's name`);
      assert.ok(G.mapgenReached(reach, Q[0].x, Q[0].z), `${where}: the quest giver can't be walked to`);
      assert.ok(G.mapgenReached(reach, board.x, board.z - 0.8), `${where}: the board can't be walked to`);
    }
  }
  assert.ok(towns >= 15, `${towns} towns`);
  assert.ok(full >= towns * 0.9, `${full} of ${towns} towns with their size's houses`);
  /* Expedition I: a hamlet, then a village (rules.json run.map.townSizes) */
  assert.deepEqual(Object.keys(sizes).sort(), ['hamlet', 'village'], JSON.stringify(sizes));
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
  assert.deepEqual(
    sc.people,
    t.scene.people.filter(p => !p.quest),
    'the same locals: the region moves no draw'
  );
});

/* ---------- WM-5: the three sizes, at their places' sizes ---------- */
const { RUN_TOWN_ROAD } = modules['run-scenes'];
const SIZES = /** @type {Record<string, [number, number]>} */ ({
    hamlet: [128, 64],
    village: [128, 128],
    town: [192, 128],
  }),
  BIOMES = ['meadow', 'thicket', 'lake', 'canyon', 'volcano', 'tundra', 'sea', 'ridge', 'autumn', 'badlands', 'jungle'],
  CTX = { scenery: C, biomes: GAME_DATA.biomes, setPieces: GAME_DATA.setPieces };

/** a town of `size` from seed s, as a run makes one: its way in by the west (at one cell's middle or the other's), its
 * way on east (likewise), north or south, the land and water drawn as a run's are; `more`: other dials
 * @param {string} size @param {number} s @param {string} way @param {any} [more] */
function townAt(size, s, way, more = {}) {
  const [w, h] = SIZES[size],
    cell = (/** @type {number} */ t) => (h > 64 ? [32 / h, 1 - 32 / h][t % 2] : 0.5),
    exits = [
      { side: 'W', t: cell(s), width: 2 },
      way === 'E' ? { side: 'E', t: cell(s >> 1), width: 2 } : { side: way, t: 0.6, width: 2 },
    ];
  const P = {
    seed: 7000 + s * 13,
    w,
    h,
    kind: 'town',
    biome: BIOMES[s % BIOMES.length],
    props: { clinic: 1, shop: 1 },
    road: { ...RUN_TOWN_ROAD, exits },
    pin: way === 'E' ? 'EW' : 'EW' + way,
    ahead: way,
    feature: 'none',
    land: {
      hills: 0.15 + (s % 5) * 0.12,
      cliffs: 0.3,
      water: ['none', 'none', 'stream', 'pond', 'none'][s % 5],
      waterAmount: 0.5,
    },
    ...more,
  };
  return { P, ...G.mapgenScene(P, CTX) };
}

test('WM-5: every size grows streets from its through road, with its square, services and houses', () => {
  const towns = /** @type {Record<string, number>} */ ({}),
    full = /** @type {Record<string, number>} */ ({});
  for (const size of Object.keys(SIZES))
    for (const way of ['E', 'N', 'S'])
      for (let s = 0; s < 8; s++) {
        const { scene: sc, notes } = townAt(size, s, way),
          where = `${size}, way on ${way}, seed ${s}`,
          Z = G.MAPGEN_TOWN_SIZES[size],
          B = GAME_DATA.biomes[sc.biome],
          spots = (/** @type {string} */ k) => (sc.spots || []).filter((/** @type {any} */ p) => p.kind === k);
        assert.deepEqual(notes, [], where);
        assert.equal(sc.kind, 'town', where);
        assert.equal(sc.town.size, size, where);
        towns[size] = (towns[size] || 0) + 1;
        assert.equal(spots('square').length, 1, `${where}: a square`);
        assert.equal(spots('board').length, 1, `${where}: a notice board's spot`);
        /* its streets: a main street and side streets off it (a village's and a town's two at least) */
        assert.ok(sc.town.streets >= (size === 'hamlet' ? 1 : 2), `${where}: ${sc.town.streets} streets`);
        /* the size's houses, shut, facing the camera, each door a walk from the hub */
        const houses = sc.props.filter((/** @type {any} */ p) => HOUSE.test(p.k)),
          reach = G.mapgenReach(sc, C),
          step = (/** @type {any} */ p) => {
            const M = C.props[p.k],
              dx = ((M.door && M.door.x) || 0) / (C.ppu || 34);
            return [p.x + dx, p.z - 0.55];
          };
        assert.equal(sc.town.houses, houses.length, where);
        assert.ok(houses.length <= Z.houses[1], `${where}: ${houses.length} houses`);
        if (houses.length >= Z.houses[0]) full[size] = (full[size] || 0) + 1;
        for (const p of houses) {
          assert.ok(B.town.houses[p.k], `${where}: ${p.k} is in the ${sc.biome} set`);
          assert.ok(!p.act && !p.rot && !p.f, `${where}: ${p.k} shut, facing the camera`);
          assert.ok(G.mapgenReached(reach, ...step(p)), `${where}: ${p.k}'s door step can't be walked to`);
        }
        /* the clinic and the shop, one each, facing the camera, their doors a walk away; a village's and a town's
           market stall (act 'stall'); a town's second quest giver's spot */
        for (const k of ['clinic', 'shop']) {
          const b = sc.props.filter((/** @type {any} */ p) => p.k === k);
          assert.equal(b.length, 1, `${where}: one ${k}`);
          assert.ok(!b[0].rot && !b[0].f, `${where}: the ${k} faces the camera`);
          assert.ok(G.mapgenReached(reach, ...step(b[0])), `${where}: the ${k}'s door step can't be walked to`);
        }
        const stalls = sc.props.filter((/** @type {any} */ p) => p.k === 'stall');
        assert.equal(stalls.length, Z.stall, `${where}: ${stalls.length} market stalls`);
        for (const p of stalls) {
          assert.equal(p.act, 'stall', where);
          assert.ok(G.mapgenReached(reach, p.x, p.z - 0.8), `${where}: the stall can't be walked to`);
        }
        const givers = spots('giver');
        assert.equal(givers.length, Z.givers, `${where}: ${givers.length} quest givers' spots`);
        for (const g of givers)
          assert.ok(G.mapgenReached(reach, g.x, g.z), `${where}: a giver's spot can't be walked to`);
        /* tall grass kept, a vegetable plot, every exit a walk from the hub */
        assert.ok(sc.tiles.join('').includes(B.ground.tall), `${where}: tall grass`);
        const tile = (/** @type {number} */ x, /** @type {number} */ z) =>
          (sc.tiles[sc.h - 1 - Math.floor(z)] || '')[Math.floor(x)];
        assert.ok(
          sc.props.some((/** @type {any} */ p) => p.k === 'planter_box' && tile(p.x, p.z) === 'o'),
          `${where}: a vegetable plot`
        );
        assert.deepEqual(G.mapgenUnreachable(sc, C), [], where);
        /* townsfolk by its houses, at most 10 */
        const F = G.MAPGEN_TOWN.folk;
        assert.equal(sc.folk, Math.min(F.most, F.base + Math.floor(houses.length / F.houses)), `${where}: folk`);
      }
  for (const size of Object.keys(SIZES))
    assert.ok((full[size] || 0) >= towns[size] * 0.9, `${size}: ${full[size]} of ${towns[size]} with their houses`);
});

test('WM-5: a through road running high in a place two cells tall grows the town south of it too', () => {
  let south = 0;
  for (const size of ['village', 'town'])
    for (const s of [1, 3, 5, 7, 9, 11]) {
      /* seeds whose west exit is on the upper cell, and the east one too (s >> 1 odd) or the lower one */
      const { scene: sc } = townAt(size, s, 'E'),
        sq = (sc.spots || []).find((/** @type {any} */ p) => p.kind === 'square'),
        road = sq.z - 5;
      if (sc.props.some((/** @type {any} */ p) => HOUSE.test(p.k) && p.z < road - 6)) south++;
    }
  assert.ok(south >= 9, `${south} of 12 high-road towns have houses south of the road`);
});

test('WM-5: the same seed makes the same town at every size', () => {
  for (const size of Object.keys(SIZES)) {
    const a = townAt(size, 4, 'N').scene,
      b = townAt(size, 4, 'N').scene;
    assert.equal(JSON.stringify(a), JSON.stringify(b), size);
  }
});

test('WM-5: a town is sized by its cells, and the town dial asks for its houses, stall and givers', () => {
  assert.equal(G.mapgenTownSize({ w: 128, h: 64 }).size, 'hamlet');
  assert.equal(G.mapgenTownSize({ w: 112, h: 64 }).size, 'hamlet', "the Studio's route size");
  assert.equal(G.mapgenTownSize({ w: 128, h: 128 }).size, 'village');
  assert.equal(G.mapgenTownSize({ w: 192, h: 128 }).size, 'town');
  const T = G.mapgenTownSize({ w: 128, h: 64, town: { houses: [5, 6], stall: 1, givers: 2 } });
  assert.deepEqual([T.size, T.houses, T.stall, T.givers], ['hamlet', [5, 6], 1, 2]);
  assert.equal(G.mapgenTownSize({ w: 128, h: 64, town: { size: 'town' } }).size, 'town');
  /* kept only when given, bad parts dropped */
  assert.ok(!('town' in G.mapgenParams({})));
  assert.deepEqual(G.mapgenParams({ town: { size: 'city', houses: [9, 2], stall: 3, givers: 2 } }).town, { givers: 2 });
  /* a hamlet asked for a stall and two givers makes them */
  const { scene: sc, notes } = townAt('hamlet', 2, 'E', { town: { stall: 1, givers: 2 } });
  assert.deepEqual(notes, []);
  assert.equal(sc.props.filter((/** @type {any} */ p) => p.k === 'stall').length, 1);
  assert.equal((sc.spots || []).filter((/** @type {any} */ p) => p.kind === 'giver').length, 2);
});

/* ---------- WM-6: the districts: a park with the town's landmark, a farm edge ---------- */
test('WM-6: every size gets a park with its landmark and a farm edge, off the roads and apart', () => {
  const S = G.MAPGEN_TOWN_SET,
    T = G.MAPGEN_TOWN;
  let n = 0,
    parks = 0,
    farms = 0;
  for (const size of Object.keys(SIZES))
    for (const way of ['E', 'N', 'S'])
      for (let s = 0; s < 8; s++) {
        const { scene: sc } = townAt(size, s, way),
          where = `${size}, way on ${way}, seed ${s}`,
          D = sc.town.districts,
          tile = (/** @type {number} */ x, /** @type {number} */ z) =>
            (sc.tiles[sc.h - 1 - Math.floor(z)] || '')[Math.floor(x)];
        n++;
        assert.ok(D, `${where}: districts`);
        /* a district's box is the size's, inside the place, on no road and clear of the square */
        const box = (/** @type {number[]} */ R, /** @type {number[]} */ dims, /** @type {string} */ ground) => {
          const [x0, z0, x1, z1] = R;
          assert.ok(Math.abs(x1 - x0 - dims[0]) < 0.05 && Math.abs(z1 - z0 - dims[1]) < 0.05, `${where}: its size`);
          assert.ok(x0 >= 4 && z0 >= 2 && x1 <= sc.w - 4 && z1 <= sc.h - 2, `${where}: inside`);
          for (let z = Math.ceil(z0); z < z1; z += 2)
            for (let x = Math.ceil(x0); x < x1; x += 2)
              assert.equal(tile(x, z), ground, `${where}: ${ground} at ${x},${z}`);
          const [q0, r0, q1, r1] = sc.town.square;
          assert.ok(x1 <= q0 || x0 >= q1 || z1 <= r0 || z0 >= r1, `${where}: off the square`);
        };
        if (D.park) {
          parks++;
          box(D.park, T.park[size], 'l');
          /* its landmark, the size's first, in it */
          assert.equal(D.landmark, S.landmarks[size][0], where);
          const L = sc.props.find((/** @type {any} */ p) => p.k === D.landmark);
          assert.ok(
            L && L.x > D.park[0] && L.x < D.park[2] && L.z > D.park[1] && L.z < D.park[3],
            `${where}: landmark`
          );
        }
        if (D.farm) {
          farms++;
          box(D.farm, T.farm[size], 'o');
          const [x0, z0, x1, z1] = D.farm;
          assert.ok(
            sc.props.some((/** @type {any} */ p) => p.k === S.crop && p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1),
            `${where}: crops`
          );
        }
        if (D.park && D.farm) {
          const [a0, b0, a1, b1] = D.park,
            [c0, d0, c1, d1] = D.farm;
          assert.ok(a1 <= c0 || a0 >= c1 || b1 <= d0 || b0 >= d1, `${where}: the park and the farm apart`);
        }
        assert.deepEqual(G.mapgenUnreachable(sc, C), [], `${where}: nothing unreachable`);
      }
  assert.ok(parks >= n * 0.95 && farms >= n * 0.9, `${parks} parks, ${farms} farm edges in ${n} towns`);
});

test('WM-6: a run town has its districts too', () => {
  let towns = 0,
    both = 0;
  for (const seed of ['TW1A', 'TW1B', 'TW1C', 'TW1D'])
    for (const { node, scene: sc } of runScenes(seed)) {
      if (node.type !== 'town' || !sc.town) continue;
      towns++;
      if (sc.town.districts.park && sc.town.districts.farm) both++;
    }
  assert.ok(towns >= 8 && both >= towns * 0.9, `${both} of ${towns} run towns with a park and a farm edge`);
});

test("WM-5b: an Expedition II run's last town is a 3 x 2 town: its market stall, two quest givers with names of their own, its houses and folk", () => {
  const { runMapLength } = modules['run-map'];
  let seen = 0;
  for (const seed of ['WM5B1', 'WM5B2', 'WM5B3']) {
    const run = newRun(seed, 2, G.MAPGEN_VERSION, START);
    runMapStart(run, { ...MAP_DATA, rules: { ...R, map: { ...R.map, ...runMapLength(seed, R.map, 2) } } });
    const made = /** @type {any[]} */ ([]);
    run.map.nodes.forEach((node, i) => {
      const { scene: sc, notes } = runSceneMake(run, i, made, WORLD_DATA);
      made[i] = sc;
      const want = runTownOf(run.map, i, WORLD_DATA);
      if (!want || want.size !== 'town') return;
      seen++;
      const where = `${seed} node ${i}`;
      assert.deepEqual(node.size, [3, 2], where);
      assert.deepEqual(notes, [], where);
      assert.equal(sc.w * sc.h, 6 * 64 * 64, `${where}: 192 x 128`);
      assert.ok(sc.name.endsWith(' Town'), sc.name);
      assert.equal(sc.town.size, 'town');
      const givers = (sc.people || []).filter(p => p.quest);
      assert.deepEqual(
        givers.map(p => [p.id, p.quest]),
        [
          ['quest', 1],
          ['quest2', 2],
        ],
        where
      );
      assert.notEqual(givers[0].name, givers[1].name, `${where}: two names`);
      assert.equal(sc.props.filter(p => p.act === 'stall' && p.shop === runStallId(i)).length, 1, where);
      assert.ok(sc.town.houses >= 10 && sc.town.houses <= 16, `${where}: ${sc.town.houses} houses`);
      assert.ok(sc.folk >= 7 && sc.folk <= 10, `${where}: ${sc.folk} folk`);
    });
  }
  assert.ok(seen >= 3, `${seen}: one town a run at least (two on a row of two)`);
});

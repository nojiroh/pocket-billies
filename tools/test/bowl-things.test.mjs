// Phase 10, the look, session 4: landmarks, buildings and trees on the world map (game/js/logic/bowl-things.js).
// RL-8b: on the worlds the game draws: Copperleaf's own map, and a run's world put in as the game does (its scenes,
// places and roads, worldPut) with the run's look, the clumps worked out as world-bowl.js does.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, GAME_DATA, modules } from './setup-real.mjs';
import {
  bowlClumps,
  bowlLandmarkPick,
  bowlMapPoint,
  bowlMapTurn,
  bowlPropClass,
  bowlTreeStyle,
} from '../../game/js/logic/bowl-things.js';
import {
  bowlCoastAt,
  bowlGridHeight,
  bowlGroundGrid,
  bowlReliefFeatures,
  bowlSeaInput,
  bowlSpotOf,
  bowlWaterLevel,
  bowlXY,
} from '../../game/js/logic/bowl.js';
import { runBowlLook } from '../../game/js/logic/run-bowl.js';
import { runSpot } from '../../game/js/logic/run-map.js';
import { rngFrom } from '../../game/js/logic/rng.js';

const { runMapStart } = modules['run-map'];
const { newRun } = modules['run-state'];
const { MAPGEN_VERSION } = modules.mapgen;
const { runScenesMake, runWorldTables } = modules['run-scenes'];
const ART = GAME_DATA.scenery.props;
const R = GAME_DATA.rules.run,
  WD = {
    nodeTypes: GAME_DATA.nodeTypes,
    biomes: GAME_DATA.biomes,
    pools: data.POOLS,
    scenery: GAME_DATA.scenery,
    rules: R,
  },
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
/* a run's world as the game makes it from the seed (run-world.js runWorldSync): its places with their whole scenes,
   and its look */
const runWorld = seed => {
  const run = newRun(seed, 1, MAPGEN_VERSION, START);
  runMapStart(run, { nodeTypes: GAME_DATA.nodeTypes, biomes: GAME_DATA.biomes, rules: R });
  const W = runWorldTables(run, data.LOCATIONS[0], WD),
    made = runScenesMake(run, WD),
    maps = Object.fromEntries(W.locations.slice(1).map((p, i) => [p.mapId, made[i]])),
    spots = run.map.nodes.map((_, i) => {
      const s = runSpot(run.map, i);
      return bowlXY(s.a, s.r);
    }),
    look = runBowlLook(seed, run.map, spots, GAME_DATA.biomes, GAME_DATA.worldmap, bowlTreeStyle, rngFrom);
  return { W, maps, look };
};
const RUNS = ['T0', 'T3'].map(runWorld);
const spotIn = (/** @type {any[]} */ locations) => {
  const byId = id => locations.find(l => l.id === id);
  return l => {
    const s = bowlSpotOf(l, byId),
      [x, y] = bowlXY(s.a, s.r);
    return { x, y, under: s.under, off: !!s.off };
  };
};

test('a walk map lies on the bowl as the terrain stamps it: its middle on the place, its north to the centre', () => {
  const { W } = RUNS[0],
    s = spotIn(W.locations)(W.locations[1]),
    M = { w: 120, h: 84 },
    mid = bowlMapPoint(s, M, 60, 42),
    up = bowlMapPoint(s, M, 60, 84);
  assert.ok(Math.hypot(mid[0] - s.x, mid[1] - s.y) < 1e-12);
  assert.ok(Math.hypot(up[0], up[1]) < Math.hypot(s.x, s.y), 'the map’s north edge is nearer the centre');
  /* the turn agrees with the points: east of the middle lies along the turn */
  const east = bowlMapPoint(s, M, 70, 42),
    t = bowlMapTurn(s);
  assert.ok(Math.abs(Math.atan2(east[1] - mid[1], east[0] - mid[0]) - t) < 1e-9);
});

test('what props are on the map: trees, buildings, nothing', () => {
  assert.equal(bowlPropClass('tree_oak', ART.tree_oak), 'tree');
  assert.equal(bowlPropClass('house_red', ART.house_red), 'building');
  assert.equal(bowlPropClass('clinic', ART.clinic), 'building');
  assert.equal(bowlPropClass('tallgrass', ART.tallgrass), null);
  assert.equal(bowlPropClass('tree_fallen', ART.tree_fallen), null);
  assert.equal(bowlTreeStyle('tree_larch'), 'cone');
  assert.equal(bowlTreeStyle('mushroom_blue'), 'mushroom');
  assert.equal(bowlTreeStyle('tree_oak'), 'round');
});

test('each place gets its own landmark when its map has one: Copperleaf its tree, every run town one', () => {
  const hub = GAME_DATA.locations[0],
    hubMap = GAME_DATA.maps[hub.mapId];
  assert.equal(bowlLandmarkPick(hub, hubMap, ART).k, 'tree_giant_swing');
  /* a place's own choice wins */
  assert.equal(bowlLandmarkPick({ ...hub, landmark: 'tree_giant' }, hubMap, ART).k, 'tree_giant');
  for (const { W, maps } of RUNS) {
    const towns = W.locations.slice(1).filter(l => l.kind === 'town');
    assert.ok(towns.length, 'the run needs a town');
    for (const l of towns) assert.ok(bowlLandmarkPick(l, maps[l.mapId], ART), `${l.id} (${l.name}) has no landmark`);
  }
});

test('clumps grow on dry land between places, off the routes, in their region’s kinds', () => {
  for (const { W, maps, look } of RUNS) {
    data.worldPut({ ...W, look, maps });
    try {
      const L = data.LOCATIONS,
        at = spotIn(L),
        S = bowlSeaInput(
          L,
          data.ROADS.map(r => [r[0], r[1]]),
          l => maps[l.mapId] || null,
          1000,
          look.sea
        ),
        G = bowlGroundGrid(bowlReliefFeatures(L, look.relief, look.seed), undefined, S),
        spots = L.map(at),
        places = L.flatMap((l, i) => {
          const s = spots[i],
            m = maps[l.mapId];
          return s.off || s.under
            ? []
            : [{ x: s.x, y: s.y, reach: m ? Math.hypot(m.w, m.h) / 2000 : 0.06, region: l.region || 'starter' }];
        }),
        segs = data.ROADS.filter(([a, b]) => !spots[a].off && !spots[b].off).map(([a, b]) => [
          spots[a].x,
          spots[a].y,
          spots[b].x,
          spots[b].y,
        ]),
        trees = Object.fromEntries(Object.entries(look.regions).map(([k, Rg]) => [k, Rg.trees])),
        rel = (x, y) => bowlGridHeight(G, x, y) - bowlWaterLevel(x, y),
        T = bowlClumps(G, places, segs, rel, undefined, trees, look.seed);
      assert.ok(T.length > 200 && T.length < 5000, `${T.length} trees`);
      assert.deepEqual(T.slice(0, 20), bowlClumps(G, places, segs, rel, undefined, trees, look.seed).slice(0, 20));
      for (const t of T) {
        assert.ok(bowlCoastAt(G, t.x, t.y) < 0, `a tree in the sea at ${t.x},${t.y}`);
        for (const p of places) assert.ok(Math.hypot(t.x - p.x, t.y - p.y) > p.reach, 'a tree on a place’s own ground');
        for (const [ax, ay, bx, by] of segs) {
          const vx = bx - ax,
            vy = by - ay,
            k = Math.max(0, Math.min(1, ((t.x - ax) * vx + (t.y - ay) * vy) / (vx * vx + vy * vy)));
          assert.ok(Math.hypot(t.x - ax - vx * k, t.y - ay - vy * k) > 0.012, 'a tree on a route');
        }
        assert.ok((trees[t.region] || trees.starter).includes(t.style), `${t.style} in ${t.region}`);
      }
    } finally {
      data.worldHubBack();
    }
  }
});

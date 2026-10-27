// Phase 10, session E-map-4: the bowl's ground (game/js/logic/bowl.js): gentle relief from the places' kinds, the
// grid the map draws as a low-poly mesh, and the camera reading the same heights it draws. RL-8b: on a run's world as
// the game puts it in (its places by their biomes, on the run's map spots; the hub off it) with the run's look.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, GAME_DATA, modules } from './setup-real.mjs';
import { runBowlLook } from '../../game/js/logic/run-bowl.js';
import { runSpot } from '../../game/js/logic/run-map.js';
import { rngFrom } from '../../game/js/logic/rng.js';
import { bowlTreeStyle } from '../../game/js/logic/bowl-things.js';
import {
  BOWL_GROUND_EXTENT,
  BOWL_RELIEF_MAX,
  BOWL_RIM_HEIGHT,
  bowlBaseHeight,
  bowlGridHeight,
  bowlGroundGrid,
  bowlRelief,
  bowlReliefFeatures,
  bowlSpotOf,
  bowlXY,
} from '../../game/js/logic/bowl.js';
import {
  BOWL_CAMERA,
  bowlCamClamp,
  bowlCamHome,
  bowlCamProject,
  bowlCamUseGround,
  bowlCamView,
  bowlPickGround,
  bowlSurface,
  bowlToGpu,
} from '../../game/js/logic/bowl-camera.js';

const { runMapStart } = modules['run-map'];
const { newRun } = modules['run-state'];
const { MAPGEN_VERSION } = modules.mapgen;
const { runWorldTables } = modules['run-scenes'];
const R = GAME_DATA.rules.run,
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
/* a run's places (Copperleaf first, off the run's map) and the relief the game makes from them with the run's look */
const runWorld = seed => {
  const run = newRun(seed, 1, MAPGEN_VERSION, START);
  runMapStart(run, { nodeTypes: GAME_DATA.nodeTypes, biomes: GAME_DATA.biomes, rules: R });
  const { locations } = runWorldTables(run, data.LOCATIONS[0], {
      nodeTypes: GAME_DATA.nodeTypes,
      biomes: GAME_DATA.biomes,
      pools: data.POOLS,
      scenery: GAME_DATA.scenery,
      rules: R,
    }),
    spots = run.map.nodes.map((_, i) => {
      const s = runSpot(run.map, i);
      return bowlXY(s.a, s.r);
    }),
    look = runBowlLook(seed, run.map, spots, GAME_DATA.biomes, GAME_DATA.worldmap, bowlTreeStyle, rngFrom),
    byId = id => locations.find(l => l.id === id);
  return {
    locations,
    F: bowlReliefFeatures(locations, look.relief, look.seed),
    at: l => {
      const s = bowlSpotOf(l, byId);
      return bowlXY(s.a, s.r);
    },
  };
};
/* three runs with ridges and lakes */
const RUNS = ['G0', 'G2', 'G4'].map(runWorld);
const { F, locations, at } = RUNS[0];

test("every run place shapes the ground; the hub, off the run's map, adds nothing", () => {
  for (const W of RUNS) {
    assert.ok(W.locations[0].bowl.off, 'Copperleaf is off the run’s map');
    assert.equal(W.F.length, W.locations.length - 1);
  }
});

test('the relief is gentle: within its limit everywhere, and gone beyond the rim', () => {
  for (let k = 0; k < 4000; k++) {
    const x = Math.sin(k * 12.9898) * 1.3,
      y = Math.cos(k * 78.233) * 1.3,
      h = bowlRelief(F, x, y);
    assert.ok(Math.abs(h) <= BOWL_RELIEF_MAX + 1e-12, `${h} at ${x},${y}`);
    if (Math.hypot(x, y) > 1.08) assert.equal(h, 0);
  }
});

test('the kinds read: a ridge stands up, a lake dips', () => {
  const seen = { ridge: 0, lake: 0 };
  for (const W of RUNS)
    for (const l of W.locations.slice(1)) {
      const h = bowlRelief(W.F, ...W.at(l));
      if (l.t === 'ridge') (seen.ridge++, assert.ok(h > 0.04, `a ridge at ${h}`));
      if (l.t === 'lake') (seen.lake++, assert.ok(h < 0, `a lake at ${h}`));
    }
  assert.ok(seen.ridge && seen.lake, 'the runs need a ridge and a lake');
});

test('the grid holds the heights at its corners and runs flat between them', () => {
  const G = bowlGroundGrid(F, 40),
    step = (2 * BOWL_GROUND_EXTENT) / 40;
  for (const [i, j] of [
    [0, 0],
    [20, 20],
    [7, 31],
    [40, 40],
  ]) {
    const x = -BOWL_GROUND_EXTENT + i * step,
      y = -BOWL_GROUND_EXTENT + j * step,
      want = G.h[j * 41 + i];
    assert.ok(Math.abs(bowlGridHeight(G, x, y) - want) < 1e-6);
  }
  const flat = bowlGroundGrid([], 40);
  for (const [x, y] of [
    [0, 0],
    [0.5, 0.3],
    [-0.2, 0.9],
  ])
    assert.ok(
      Math.abs(bowlGridHeight(flat, x, y) - bowlBaseHeight(x, y)) < 0.025,
      'the bare grid is the bowl (and its rolling hills)'
    );
});

test('the camera, the pins and a tap read the drawn ground', () => {
  const G = bowlGroundGrid(F);
  bowlCamUseGround(G);
  try {
    const [x, y] = at(locations.find(l => l.t === 'ridge'));
    assert.ok(Math.abs(bowlSurface(x, y) - bowlGridHeight(G, x, y)) < 1e-12);
    const v = bowlCamView(bowlCamHome(x, y), 390, 760),
      g = bowlPickGround(v, 195, 380);
    assert.ok(g && Math.hypot(g[0] - x, g[1] - y) < 1e-3, 'a tap in the middle finds the ground under the target');
    for (let k = 0; k < 500; k++) {
      const s = bowlCamClamp({ tx: Math.sin(k) * 0.9, ty: Math.cos(k * 1.7) * 0.9, yaw: k, tilt: 0.2, dist: 0.1 }),
        V = bowlCamView(s, 390, 760);
      assert.ok(V.C[1] >= BOWL_RIM_HEIGHT + BOWL_CAMERA.eyeAboveRim - 1e-9, 'below the rim line');
      assert.ok(V.C[1] > bowlSurface(V.C[0], -V.C[2]) + 0.01, 'inside a hill');
      assert.ok(bowlCamProject(V, bowlToGpu(s.tx, s.ty, bowlSurface(s.tx, s.ty))), 'the target is out of view');
    }
  } finally {
    bowlCamUseGround(null);
  }
});

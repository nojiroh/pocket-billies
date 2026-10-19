// Phase 10, session E-map-4: the bowl's ground (game/js/logic/bowl.js): gentle relief from the places' kinds, the
// grid the map draws as a low-poly mesh, and the camera reading the same heights it draws.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA } from './setup-real.mjs';
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

const { locations } = GAME_DATA;
const byId = id => locations.find(l => l.id === id);
const F = bowlReliefFeatures(locations);
const at = id => {
  const s = bowlSpotOf(byId(id), byId);
  return bowlXY(s.a, s.r);
};

test('every place with its own spot shapes the ground; places under another add nothing', () => {
  assert.equal(F.length, locations.filter(l => !('under' in l.bowl)).length);
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

test('the landmarks read: a peak by Frostcrown, dips at the trench and the sea', () => {
  assert.ok(bowlRelief(F, ...at('frostcrown')) > 0.05, 'Frostcrown');
  assert.ok(bowlRelief(F, ...at('cinderpeak')) > 0.04, 'the volcano');
  assert.ok(bowlRelief(F, ...at('abyssal_trench')) < -0.02, 'the trench');
  assert.ok(bowlRelief(F, ...at('driftwreck')) < -0.01, 'the sea');
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
    assert.ok(Math.abs(bowlGridHeight(flat, x, y) - bowlBaseHeight(x, y)) < 0.02, 'the bare grid is the bowl');
});

test('the camera, the pins and a tap read the drawn ground', () => {
  const G = bowlGroundGrid(F);
  bowlCamUseGround(G);
  try {
    const [x, y] = at('frostcrown');
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

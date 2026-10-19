// Phase 10, the look, session 3: the bowl's sky (game/js/logic/bowl-weather.js): the game's weather spread over the
// map, the clouds for each setting, and the Inner Sun's day.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BOWL_CLOUD_LEVELS,
  bowlCloudAt,
  bowlCloudLayout,
  bowlCloudLevel,
  bowlCloudShow,
  bowlSkyAt,
  bowlSkyGrid,
  bowlSunAt,
} from '../../game/js/logic/bowl-weather.js';
import { BOWL_SPHERE, BOWL_SUN_SLANT } from '../../game/js/logic/bowl.js';

const STORM = { cloud: 1, grey: 0.9, storm: 1, rain: 1.6, fog: 0.2 },
  CLEAR = { cloud: 0.35 },
  P = [
    { x: -0.5, y: 0, look: STORM },
    { x: 0.5, y: 0, look: CLEAR },
  ];

test("each place's weather shows over it, blending between places", () => {
  const a = bowlSkyAt(P, -0.5, 0),
    b = bowlSkyAt(P, 0.5, 0),
    m = bowlSkyAt(P, 0, 0);
  assert.ok(a.rain > 1.5 && a.storm > 0.95, 'the storm over its place');
  assert.ok(b.rain < 0.01 && Math.abs(b.cloud - 0.35) < 0.01, 'clear over the other');
  assert.ok(m.cloud > b.cloud && m.cloud < a.cloud, 'blended between');
});

test('the same weather gives the same sky (no randomness)', () => {
  assert.deepEqual(bowlSkyGrid(P, 16).v, bowlSkyGrid(P, 16).v);
  assert.deepEqual(bowlCloudLayout('high'), bowlCloudLayout('high'));
});

test('the cloud counts follow the setting; Off has none', () => {
  for (const k of /** @type {const} */ (['off', 'low', 'high'])) {
    const C = bowlCloudLayout(k);
    assert.equal(C.length, BOWL_CLOUD_LEVELS[k].count);
    for (const c of C) {
      assert.ok(c.r >= 0 && c.r <= 0.92 && c.puffs.length >= 2);
      assert.ok(c.layer < BOWL_CLOUD_LEVELS[k].layers.length);
    }
  }
  assert.equal(bowlCloudLayout('off').length, 0);
  assert.equal(new Set(bowlCloudLayout('high').map(c => c.layer)).size, 2, 'two layers on High');
});

test('more clouds show in cloudier weather; they drift and stay over the bowl', () => {
  const C = bowlCloudLayout('high'),
    shown = s => C.reduce((n, c) => n + bowlCloudShow(c, s), 0);
  assert.ok(shown({ cloud: 1, grey: 0.9 }) > shown({ cloud: 0.35, grey: 0 }) * 2);
  for (const c of C) {
    const [x0, y0] = bowlCloudAt(c, 0),
      [x1, y1] = bowlCloudAt(c, 60);
    assert.ok(Math.hypot(x1 - x0, y1 - y0) > 1e-4, 'a cloud stands still');
    assert.ok(Math.abs(Math.hypot(x1, y1) - c.r) < 1e-9, 'a cloud leaves its circle');
  }
});

test('the Inner Sun circles once a day and dims at night', () => {
  const noon = bowlSunAt(13, 0),
    six = bowlSunAt(19, 0.4),
    night = bowlSunAt(1, 1);
  assert.equal(noon.az, 135);
  assert.equal(six.az, 225);
  assert.equal(bowlSunAt(37, 0).az, noon.az, 'a day later it is back');
  assert.ok(night.light < 0.2 && noon.light === 1);
  for (const s of [noon, six, night]) {
    assert.ok(Math.abs((Math.acos(s.dir[2]) * 180) / Math.PI - BOWL_SUN_SLANT) < 1e-6);
    assert.ok(Math.hypot(s.at[0], s.at[1], s.at[2] - BOWL_SPHERE) < BOWL_SPHERE, 'the sun left the world');
  }
});

test('the setting: your choice, else from the graphics preset', () => {
  assert.equal(bowlCloudLevel('off', 'sharp'), 'off');
  assert.equal(bowlCloudLevel('high', 'smooth'), 'high');
  assert.equal(bowlCloudLevel('auto', 'sharp'), 'high');
  assert.equal(bowlCloudLevel(undefined, 'smooth'), 'low');
});

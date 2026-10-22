// Terrain TR-3: the walking camera's extra tilt on tall ground (game/js/logic/camera-rise.js): none on flat ground,
// enough to clear rock between the eye and the player, capped, and only for ground on the camera's side.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-real.mjs';

const R = modules['camera-rise'];
const flat = () => 0;
// a wall 10 m tall across the ground 5-8 m in front of the camera's side of a player at z 30 (the camera is at smaller z)
const wall = (x, z) => (z > 22 && z < 25 ? 10 : 0);

test('flat ground and ground below the player need no rise', () => {
  assert.equal(R.cameraRiseNeeded(flat, 10, 30, 0, 0, 30, 30, 18), 0);
  assert.equal(R.cameraRiseNeeded(flat, 10, 30, 12, 0, 30, 30, 18), 0, 'standing on a summit');
});

test('a wall between the eye and the player raises the tilt until the line clears it', () => {
  const need = R.cameraRiseNeeded(wall, 10, 30, 0, 0, 20, 40, 60);
  assert.ok(need > 0);
  // with the new tilt the line from the head toward the eye passes above the wall's top at its near face (5 m away)
  const pitch = ((20 + need) * Math.PI) / 180,
    atFace = R.CAMERA_RISE_HEAD + Math.tan(pitch) * 6.5;
  assert.ok(atFace >= 10 + R.CAMERA_RISE_MARGIN - 1e-9, `${atFace} clears 10 m`);
});

test('the rise is capped, and off at 0', () => {
  assert.equal(R.cameraRiseNeeded(wall, 10, 30, 0, 0, 20, 40, 18), 18);
  assert.equal(R.cameraRiseNeeded(wall, 10, 30, 0, 0, 20, 40, 0), 0);
});

test('ground behind the player (away from the camera) and beyond the eye is not counted', () => {
  const behind = (x, z) => (z > 32 ? 10 : 0);
  assert.equal(R.cameraRiseNeeded(behind, 10, 30, 0, 0, 30, 30, 18), 0);
  assert.equal(R.cameraRiseNeeded(wall, 10, 30, 0, 0, 20, 4, 18), 0, 'the wall is past the eye');
});

test('the camera turned: the line follows its yaw', () => {
  // turned a quarter, the camera stands at smaller x
  const side = (x, z) => (x > 2 && x < 5 ? 10 : 0);
  assert.ok(R.cameraRiseNeeded(side, 10, 30, 0, Math.PI / 2, 20, 40, 60) > 0);
  assert.equal(R.cameraRiseNeeded(side, 10, 30, 0, 0, 20, 40, 60), 0);
});

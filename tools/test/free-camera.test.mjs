// The Studio's free camera (game/js/logic/free-camera.js): where it looks from, moving, turning, tilting, zooming
// towards a point, staying in the scene and above the ground, gliding.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-real.mjs';

const F = modules['free-camera'];
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);

test('it looks at its target from its distance, tilted down', () => {
  const s = F.freeCamAt(10, 20, 2);
  const L = F.freeCamLook(s);
  near(Math.hypot(L.eye[0] - 10, L.eye[1] - 2, L.eye[2] - 20), s.dist);
  assert.ok(L.eye[1] > 2, 'the eye is above the target');
  assert.ok(L.eye[2] < 20, 'with yaw 0 it looks along +z (the eye is behind, at smaller z)');
  assert.deepEqual(L.tgt, [10, 2, 20]);
});

test('moving, turning, tilting and zooming', () => {
  const s = F.freeCamAt(10, 20);
  F.freeCamPan(s, 0, 5);
  near(s.tgt[2], 25);
  F.freeCamTurn(s, Math.PI / 2);
  F.freeCamPan(s, 0, 3);
  near(s.tgt[0], 13);
  F.freeCamTilt(s, 500);
  assert.equal(s.pitch, F.FREE_CAM.pitchMax);
  F.freeCamTilt(s, -500);
  assert.equal(s.pitch, F.FREE_CAM.pitchMin);
  const t = F.freeCamAt(0, 0);
  t.dist = 20;
  F.freeCamZoom(t, 0.5, [10, 0]);
  assert.equal(t.dist, 10);
  near(t.tgt[0], 5, 1e-9);
  F.freeCamZoom(t, 1e-6);
  assert.equal(t.dist, F.FREE_CAM.distMin);
});

test('a pan to the right and one ahead are at right angles, whatever the turn', () => {
  for (const yaw of [0, 0.7, 2, -2.5]) {
    const a = F.freeCamAt(0, 0, 0, yaw),
      b = F.freeCamAt(0, 0, 0, yaw);
    F.freeCamPan(a, 1, 0);
    F.freeCamPan(b, 0, 1);
    near(a.tgt[0] * b.tgt[0] + a.tgt[2] * b.tgt[2], 0);
    near(Math.hypot(a.tgt[0], a.tgt[2]), 1);
  }
});

test('it stays in the scene, its target on or above the ground, its eye above the ground', () => {
  const hill = (x, z) => (x > 40 ? 30 : 0);
  const s = F.freeCamAt(-50, 500, -9);
  F.freeCamKeep(s, { w: 60, h: 40 }, hill);
  assert.deepEqual([s.tgt[0], s.tgt[1], s.tgt[2]], [-4, 0, 44]);
  const t = F.freeCamAt(30, 20, 0, -Math.PI / 2);
  t.pitch = 15;
  t.dist = 40;
  F.freeCamKeep(t, { w: 60, h: 40 }, hill);
  const e = F.freeCamLook(t).eye;
  assert.ok(e[1] >= hill(e[0], e[2]) + F.FREE_CAM.above, 'the eye is out of the hill');
});

test('it glides to the goal, turning the short way round', () => {
  const cur = F.freeCamAt(0, 0, 0, 3),
    goal = F.freeCamAt(10, 0, 0, -3);
  goal.dist = 52;
  for (let i = 0; i < 120; i++) F.freeCamGlide(cur, goal, 1 / 60);
  near(cur.tgt[0], 10, 1e-3);
  near(cur.dist, 52, 1e-2);
  near(Math.cos(cur.yaw), Math.cos(-3), 1e-3);
  assert.ok(cur.yaw > 3, 'past π, not back through 0');
});

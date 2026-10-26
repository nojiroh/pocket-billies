// VFX track VFX-1: the throw's pace and its afterimages (game/js/logic/smear.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SMEAR_GHOSTS,
  SMEAR_NEAR,
  SMEAR_STEP,
  smearCount,
  smearGhosts,
  smearHistory,
  smearRecord,
  throwArcEase,
} from '../../game/js/logic/smear.js';

test('the throw keeps its start, middle and end, always moves forward, and is fastest at both ends', () => {
  assert.equal(throwArcEase(0), 0);
  assert.ok(Math.abs(throwArcEase(0.5) - 0.5) < 1e-12);
  assert.ok(Math.abs(throwArcEase(1) - 1) < 1e-12);
  const speed = k => (throwArcEase(k + 1e-4) - throwArcEase(k)) / 1e-4;
  for (let k = 0; k < 1; k += 0.01) assert.ok(speed(k) > 0, `forward at ${k}`);
  assert.ok(speed(0) > 1.4 && speed(0.999) > 1.4, 'fast from the hand and into the hit');
  assert.ok(speed(0.5) < 0.6, 'a hang at the top');
});

/* a pyramid flying along x at 10 m/s for 480 ms, stepped every 8 ms as battle-stage.js pyramidArc steps it */
const fly = (ms = 480) => {
  const H = smearHistory();
  let kept = 0;
  for (let t = 0; t <= ms; t += 8) kept += +smearRecord(H, t, { x: t / 100, y: 1, z: 0 });
  return { H, kept };
};

test('places are kept on the 24 fps grid, never more than the afterimages need', () => {
  const { H, kept } = fly();
  assert.equal(kept, Math.floor(480 / SMEAR_STEP) + 1);
  assert.equal(H.list.length, SMEAR_GHOSTS.length + 1);
  for (let i = 1; i < H.list.length; i++) assert.ok(H.list[i - 1].t > H.list[i].t, 'newest first');
});

test('in flight every afterimage shows, newest first, behind the pyramid and fading', () => {
  const { H } = fly(),
    G = smearGhosts(H, 480);
  assert.equal(G.length, SMEAR_GHOSTS.length);
  for (let i = 1; i < G.length; i++) {
    assert.ok(G[i].s.x < G[i - 1].s.x, 'older is further back');
    assert.ok(G[i].fade < G[i - 1].fade, 'older is fainter');
  }
  assert.ok(G[0].s.x < H.list[0].x, 'the first copy is a cell back, not on the pyramid');
});

test('once it stops the afterimages run out oldest first, and are all gone within their life', () => {
  const { H } = fly(),
    n = t => smearGhosts(H, t).length,
    end = H.list[0].t;
  let last = n(end);
  for (let t = end; t < end + 10 * SMEAR_STEP; t += 4) {
    assert.ok(n(t) <= last, 'never comes back');
    last = n(t);
  }
  assert.equal(n(end + (SMEAR_GHOSTS.length + 1) * SMEAR_STEP), 0);
});

test('an afterimage on top of the newer place (a slow moment) is not drawn', () => {
  const H = smearHistory();
  for (let t = 0; t <= 200; t += 8) smearRecord(H, t, { x: 0.001 * t, y: 1, z: 0 });
  assert.equal(smearGhosts(H, 200).length, 0);
});

test('no afterimage is drawn right in front of the camera', () => {
  const { H } = fly(),
    G = smearGhosts(H, 480),
    eye = { x: G[0].s.x + 1.5, y: 1, z: 0 },
    near = smearGhosts(H, 480, 3, eye),
    gap = g => Math.hypot(g.s.x - eye.x, g.s.y - eye.y, g.s.z - eye.z);
  assert.ok(near.length >= 1 && near.length < G.length, 'the copies at the lens are gone, the far ones stay');
  assert.ok(near.every(g => gap(g) >= SMEAR_NEAR));
  assert.equal(G.filter(g => gap(g) >= SMEAR_NEAR).length, near.length);
});

test('Reduced motion and the lowest quality draw none; level 2 draws two', () => {
  assert.equal(smearCount(true, 0), 0);
  assert.equal(smearCount(false, 3), 0);
  assert.equal(smearCount(false, 2), 2);
  assert.equal(smearCount(false, 0), SMEAR_GHOSTS.length);
  const { H } = fly();
  assert.equal(smearGhosts(H, 480, 2).length, 2);
  assert.deepEqual(smearGhosts(null, 0), []);
});

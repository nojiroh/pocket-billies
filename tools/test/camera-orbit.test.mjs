// Island track IS-1: the orbit camera's maths (game/js/logic/camera-orbit.js): the yaw toward the island's middle,
// the lag, the dead zone, the short way round past +/-180 degrees, the joystick's frame and a lap that stays on its
// circle.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-real.mjs';

const O = modules['camera-orbit'];
const ORB = { c: [60, 60], dead: 3, lag: 0.6, turn: 30 };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('the yaw looks at the middle: 0 from the south, a quarter turn from the west, a half from the north', () => {
  assert.ok(near(O.orbitYawAt(ORB.c, 60, 20), 0));
  assert.ok(near(O.orbitYawAt(ORB.c, 20, 60), Math.PI / 2));
  assert.ok(near(Math.abs(O.orbitYawAt(ORB.c, 60, 100)), Math.PI));
  assert.ok(near(O.orbitYawAt(ORB.c, 100, 60), -Math.PI / 2));
  // the camera's forward [sin, cos] points from the player to the middle
  const y = O.orbitYawAt(ORB.c, 30, 45),
    d = Math.hypot(30, 15);
  assert.ok(near(Math.sin(y), 30 / d) && near(Math.cos(y), 15 / d));
});

test('wrapAngle keeps angles in (-180, 180] degrees', () => {
  for (const [a, w] of [
    [0, 0],
    [Math.PI, Math.PI],
    [-Math.PI, Math.PI],
    [3 * Math.PI, Math.PI],
    [Math.PI * 1.5, -Math.PI / 2],
    [-Math.PI * 1.5, Math.PI / 2],
    [Math.PI * 20 + 0.3, 0.3],
  ])
    assert.ok(near(O.wrapAngle(a), w, 1e-9), `${a} -> ${O.wrapAngle(a)}, wanted ${w}`);
});

test('the lag eases the yaw toward its target and settles; lag 0 follows at once', () => {
  const S = O.orbitStart(ORB, 60, 20);
  assert.equal(S.yaw, 0);
  // jump to the west side: the target is a quarter turn, the yaw gets there over a few lags
  O.orbitStep(S, ORB, 20, 60, 0.6);
  assert.ok(near(S.target, Math.PI / 2));
  assert.ok(near(S.yaw, (Math.PI / 2) * (1 - Math.exp(-1)), 1e-9), 'one time constant: 63%');
  for (let i = 0; i < 300; i++) O.orbitStep(S, ORB, 20, 60, 1 / 60);
  assert.ok(near(S.yaw, Math.PI / 2, 1e-3));
  const S0 = O.orbitStart({ ...ORB, lag: 0 }, 60, 20);
  O.orbitStep(S0, { ...ORB, lag: 0 }, 20, 60, 1 / 60);
  assert.ok(near(S0.yaw, Math.PI / 2));
});

test('the frame time does not change where the yaw ends up (one long step = many short ones)', () => {
  const A = O.orbitStart(ORB, 60, 20),
    B = O.orbitStart(ORB, 60, 20);
  O.orbitStep(A, ORB, 20, 60, 0.5);
  for (let i = 0; i < 10; i++) O.orbitStep(B, ORB, 20, 60, 0.05);
  assert.ok(near(A.yaw, B.yaw, 1e-9));
});

test('past +/-180 degrees the yaw goes the short way round, with no jump or spin', () => {
  const S = O.orbitStart(ORB, 60, 20);
  let prev = S.yaw,
    worst = 0;
  // walk the north side from east to west, crossing the half turn; 1200 small steps round a 40 m circle
  for (let i = 0; i <= 1200; i++) {
    const a = (i / 1200) * Math.PI * 4,
      x = 60 - Math.sin(a) * 40,
      z = 60 - Math.cos(a) * 40;
    O.orbitStep(S, ORB, x, z, 1 / 60);
    worst = Math.max(worst, Math.abs(S.yaw - prev));
    prev = S.yaw;
  }
  // stand still at the start a moment: the eased yaw catches up
  for (let i = 0; i < 300; i++) O.orbitStep(S, ORB, 60, 20, 1 / 60);
  assert.ok(worst < 0.02, `largest change in a frame ${worst}`);
  // two laps: the unwrapped yaw has turned two full circles, the wrapped one is back at the start
  assert.ok(Math.abs(S.yaw) > Math.PI * 3.5, `turned ${S.yaw}`);
  assert.ok(Math.abs(O.wrapAngle(S.yaw)) < 0.1);
});

test('the unwrapped yaw stays small over many laps', () => {
  const S = O.orbitStart({ ...ORB, lag: 0 }, 60, 20);
  for (let i = 0; i <= 60 * 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    O.orbitStep(S, { ...ORB, lag: 0 }, 60 - Math.sin(a) * 40, 60 - Math.cos(a) * 40, 1 / 60);
  }
  assert.ok(Math.abs(S.yaw) <= Math.PI * 2 * 9, `${S.yaw}`);
  assert.ok(Math.abs(S.target - S.yaw) < 0.2);
});

test('inside the dead zone the yaw holds its last value', () => {
  const S = O.orbitStart(ORB, 60, 50);
  for (let i = 0; i < 120; i++) O.orbitStep(S, ORB, 60, 50, 1 / 60);
  const y = S.yaw;
  assert.ok(!S.hold);
  for (const [x, z] of [
    [60, 58],
    [61, 60],
    [60, 62],
    [58.5, 60.5],
  ]) {
    for (let i = 0; i < 60; i++) O.orbitStep(S, ORB, x, z, 1 / 60);
    assert.ok(S.hold, `holds at ${x}, ${z}`);
    assert.ok(near(S.yaw, y, 1e-9), `still ${y} at ${x}, ${z}: ${S.yaw}`);
  }
  // starting inside it keeps the yaw handed in
  assert.equal(O.orbitStart(ORB, 60, 61, 1.2).yaw, 1.2);
  assert.equal(O.orbitStart(ORB, 60, 61).yaw, 0);
});

test("the joystick's frame follows the target, and stays locked while held after the dead zone", () => {
  const S = O.orbitStart(ORB, 60, 40);
  // holding up from the south walks north; once inside the summit's dead zone the frame locks
  assert.equal(O.orbitStickYaw(S, true), 0);
  O.orbitStep(S, ORB, 60, 59, 1 / 60);
  assert.equal(O.orbitStickYaw(S, true), 0);
  // out the north side the target flips half a turn, but the held stick keeps walking north
  for (let i = 0; i < 60; i++) O.orbitStep(S, ORB, 60, 64, 1 / 60);
  assert.ok(near(Math.abs(O.wrapAngle(S.target)), Math.PI, 1e-6));
  assert.equal(O.orbitStickYaw(S, true), 0);
  // let go and push again: the frame is the target (up walks south, toward the middle)
  assert.equal(O.orbitStickYaw(S, false), S.target);
  assert.equal(O.orbitStickYaw(S, true), S.target);
  // away from the dead zone a held stick follows the target as it turns
  const T = O.orbitStart(ORB, 60, 20);
  O.orbitStickYaw(T, true, ORB, 60, 20);
  assert.ok(near(O.orbitStickYaw(T, true, ORB, 20, 60), Math.PI / 2), 'from where you stand, before the camera eases');
});

test('a step across the radius stays on the circle; along it moves in or out', () => {
  const c = [60, 60];
  // at the south, facing north (yaw 0), right is +x: a step that way keeps the radius
  const [x1, z1] = O.orbitWalkStep(c, 60, 20, 1, 0, 2);
  assert.ok(near(Math.hypot(x1 - 60, z1 - 60), 40, 1e-9));
  assert.ok(x1 > 60 && near(Math.hypot(x1 - 60, z1 - 20), 2, 0.01));
  // up (toward the middle) shortens the radius by the step
  const [x2, z2] = O.orbitWalkStep(c, 60, 20, 0, 1, 2);
  assert.ok(near(x2, 60) && near(z2, 22));
  // inside minR it is a straight step
  assert.deepEqual(O.orbitWalkStep(c, 61, 60, 1, 0, 2, 3), [63, 60]);
});

test('holding right for a full lap ends within 1 m of the start radius (the walk drift)', () => {
  // the walk as walk-view.js does it: the stick's right along the frame orbitStickYaw gives, the step taken round
  // the middle; 8 fps (software drawing) and 20 fps (a slow phone) running, and 60 fps walking
  for (const [fps, speed] of [
    [8, 3.4 * 1.8],
    [20, 3.4 * 1.8],
    [60, 3.4],
  ]) {
    const S = O.orbitStart(ORB, 60, 15);
    let x = 60,
      z = 15,
      turned = 0,
      last = Math.atan2(x - 60, z - 60);
    const dt = 1 / fps;
    for (let i = 0; i < fps * 400 && turned < Math.PI * 2; i++) {
      // the camera eases after the walk (as in a frame), so the stick reads where you stand now, not its target
      const y = O.orbitStickYaw(S, true, ORB, x, z),
        rx = Math.cos(y),
        rz = -Math.sin(y);
      [x, z] = O.orbitWalkStep(ORB.c, x, z, rx, rz, speed * dt, ORB.dead);
      O.orbitStep(S, ORB, x, z, dt);
      const a = Math.atan2(x - 60, z - 60);
      turned += Math.abs(O.wrapAngle(a - last));
      last = a;
    }
    assert.ok(turned >= Math.PI * 2, 'went all the way round');
    assert.ok(Math.abs(Math.hypot(x - 60, z - 60) - 45) < 0.01, `radius ${Math.hypot(x - 60, z - 60)} at ${fps} fps`);
    // and the camera's eased yaw turned with it, ending close behind
    assert.ok(Math.abs(O.wrapAngle(S.yaw - O.orbitYawAt(ORB.c, x, z))) < 0.15);
  }
});

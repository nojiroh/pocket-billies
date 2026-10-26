// HB-8: logic/train-path.js, the sky train's way from Skyline Station: along the path at a distance, its heading and
// pitch, the departure's route on Copperleaf's own rail, the way back, the glide in and the train's placement (in
// front of the rail by half its width, turned, lifted, its nose up on the climb).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const { TRAIN_RIDE, trainPathOf, trainPathAt, trainRoute, trainRouteBack, trainGlide, trainPlace } =
  modules['train-path'];
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} is not ${b}`);

test('train path: points along it, held at its ends, with the heading and the climb', () => {
  const P = trainPathOf([
    [0, 0, 1],
    [10, 0, 1],
    [20, 0, 11],
  ]);
  near(P.len, 10 + Math.hypot(10, 10));
  const a = trainPathAt(P, 5);
  assert.deepEqual([a.x, a.z, a.h, a.dx, a.dz], [5, 0, 1, 1, 0]);
  near(a.pitch, 0);
  const b = trainPathAt(P, 10 + Math.hypot(10, 10) / 2);
  near(b.x, 15);
  near(b.h, 6);
  near(b.pitch, 45, 1e-3);
  assert.deepEqual([trainPathAt(P, -3).x, trainPathAt(P, 99).x], [0, 20]);
});

test('train path: the route on Copperleaf’s rail starts at the station, ends in the tear; the way back reverses it', () => {
  const C = GAME_DATA.maps.copperleaf,
    st = C.props.find(p => p.act === 'station'),
    { rail, portal } = C.landmarks,
    R = trainRoute(rail, portal, st.x + TRAIN_RIDE.stop);
  assert.deepEqual(R.pts[0], [st.x + TRAIN_RIDE.stop, rail[0][1], rail[0][2]]);
  assert.deepEqual(R.pts[R.pts.length - 1], portal);
  // every point east of the last, the rail never falling
  for (let i = 1; i < R.pts.length; i++) {
    assert.ok(R.pts[i][0] > R.pts[i - 1][0]);
    assert.ok(R.pts[i][2] >= R.pts[i - 1][2]);
  }
  const B = trainRouteBack(R);
  near(B.len, R.len, 1e-9);
  assert.deepEqual(B.pts[0], portal);
  const down = trainPathAt(B, B.len / 2);
  assert.equal(down.dx, -1);
  assert.ok(down.pitch < -10, `the way down is ${down.pitch} degrees`);
});

test('train path: the glide in comes down onto the track bed where the train stops, nose down, level at the end', () => {
  const stop = [100, 50, 1.04],
    G = TRAIN_RIDE.glide,
    a = trainGlide(stop, 0),
    z = trainGlide(stop, 1);
  assert.deepEqual([a.x, a.z, a.h], [100 - G.back, 50, 1.04 + G.up]);
  assert.ok(a.pitch < -20);
  assert.deepEqual([z.x, z.z, z.h, z.pitch], [100, 50, 1.04, -0]);
  for (let k = 0.1; k <= 1; k += 0.1) assert.ok(trainGlide(stop, k).x >= trainGlide(stop, k - 0.1).x);
});

test('train path: the placement stands in front of the rail, turned to the way it goes, lifted and tilted', () => {
  const y0 = 0.91;
  const east = trainPlace({ x: 10, z: 20, h: 1.04, dx: 1, dz: 0, pitch: 0 }, y0);
  near(east.x, 10);
  near(east.z, 20 - TRAIN_RIDE.half);
  near(east.rot, 0);
  near(east.lift, 0);
  const west = trainPlace({ x: 10, z: 20, h: 6.04, dx: -1, dz: 0, pitch: -20 }, y0);
  near(west.z, 20 + TRAIN_RIDE.half);
  near(Math.abs(west.rot), 180);
  near(west.lift, 5);
  assert.deepEqual(west.tilt, [20, 0]);
});

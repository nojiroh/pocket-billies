// Phase 10, session E-map-3: the bowl map's camera (game/js/logic/bowl-camera.js). It must never drop below the rim
// line, its matrix must agree with its own projection, a tap must find the ground it shows, and dragging, zooming,
// turning and easing must stay inside the limits.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOWL_RIM_HEIGHT } from '../../game/js/logic/bowl.js';
import {
  BOWL_CAMERA,
  bowlCamClamp,
  bowlCamEase,
  bowlCamGap,
  bowlCamHome,
  bowlCamMatrix,
  bowlCamOverview,
  bowlCamPan,
  bowlCamProject,
  bowlCamTurn,
  bowlCamView,
  bowlCamZoom,
  bowlPickGround,
  bowlSurface,
  bowlToGpu,
} from '../../game/js/logic/bowl-camera.js';

const W = 390,
  H = 760;
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const randomState = () => ({
  tx: rnd() * 2.4 - 1.2,
  ty: rnd() * 2.4 - 1.2,
  yaw: rnd() * 20 - 10,
  tilt: rnd() * 2 - 0.3,
  dist: rnd() * 4,
});

test('a clamped camera stays inside every limit and above the rim line', () => {
  for (let i = 0; i < 2000; i++) {
    const s = bowlCamClamp(randomState()),
      v = bowlCamView(s, W, H);
    assert.ok(Math.hypot(s.tx, s.ty) <= BOWL_CAMERA.targetMax + 1e-9);
    assert.ok(s.tilt >= BOWL_CAMERA.tiltMin - 1e-9 && s.tilt <= BOWL_CAMERA.tiltMax + 1e-9);
    assert.ok(s.dist >= BOWL_CAMERA.distMin - 1e-9);
    assert.ok(v.C[1] >= BOWL_RIM_HEIGHT + BOWL_CAMERA.eyeAboveRim - 1e-9, `eye at ${v.C[1]}`);
    assert.ok(v.C[1] > bowlSurface(v.C[0], -v.C[2]), 'the eye is inside the ground');
  }
});

test('the view looks at its target, which lands in the middle of the screen', () => {
  for (let i = 0; i < 200; i++) {
    const s = bowlCamClamp(randomState()),
      v = bowlCamView(s, W, H),
      q = bowlCamProject(v, bowlToGpu(s.tx, s.ty, bowlSurface(s.tx, s.ty)));
    assert.ok(q && near(q.x, W / 2, 1e-6) && near(q.y, H / 2, 1e-6), JSON.stringify(q));
  }
});

test('the GPU matrix puts points where the projection does', () => {
  const s = bowlCamHome(0.4, -0.3),
    v = bowlCamView(s, W, H),
    m = bowlCamMatrix(v);
  for (const p of [
    [0.1, 0.05, -0.2],
    [-0.3, 0.2, 0.4],
    [0.5, 0.1, 0.1],
  ]) {
    const q = bowlCamProject(v, /** @type {[number, number, number]} */ (p));
    if (!q) continue;
    const c = [0, 1, 2, 3].map(r => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
    assert.ok(near(c[3], q.z, 1e-5), 'clip w is the depth');
    assert.ok(near(((c[0] / c[3] + 1) / 2) * W, q.x, 1e-3));
    assert.ok(near(((1 - c[1] / c[3]) / 2) * H, q.y, 1e-3));
  }
});

test('a tap finds the ground it shows', () => {
  for (const [x, y] of [
    [0, 0],
    [0.3, 0.2],
    [-0.6, 0.5],
    [0.1, -0.85],
  ]) {
    const v = bowlCamView(bowlCamHome(x, y), W, H);
    for (const [sx, sy] of [
      [W / 2, H / 2],
      [W * 0.2, H * 0.7],
      [W * 0.8, H * 0.45],
    ]) {
      const g = bowlPickGround(v, sx, sy);
      assert.ok(g, `nothing under ${sx},${sy}`);
      const q = bowlCamProject(v, bowlToGpu(g[0], g[1], bowlSurface(g[0], g[1])));
      assert.ok(q && near(q.x, sx, 0.05) && near(q.y, sy, 0.05), `${sx},${sy} -> ${JSON.stringify(q)}`);
    }
  }
});

test('dragging moves the land with the finger, zoom and turn keep the limits', () => {
  const s = bowlCamHome(0, 0),
    v = bowlCamView(s, W, H),
    before = bowlPickGround(v, W / 2 + 40, H / 2),
    p = bowlCamPan(s, v, 40, 0),
    after = bowlPickGround(bowlCamView(p, W, H), W / 2 + 80, H / 2);
  assert.ok(before && after);
  assert.ok(Math.hypot(before[0] - after[0], before[1] - after[1]) < 0.02, 'the spot under the finger stays under it');
  assert.equal(bowlCamZoom(s, 0.01).dist >= BOWL_CAMERA.distMin, true);
  assert.equal(bowlCamZoom(s, 100).dist, BOWL_CAMERA.distMax);
  assert.ok(bowlCamTurn(s, 0, -5).tilt >= BOWL_CAMERA.tiltMin);
  assert.ok(bowlCamTurn(s, 0, 5).tilt <= BOWL_CAMERA.tiltMax);
});

test('the opening view: about 50 degrees, looking outward at the wall behind the place', () => {
  const h = bowlCamHome(0.6, 0);
  assert.ok(near(h.yaw, Math.PI / 2, 1e-9), 'faces east, away from the centre');
  assert.ok(h.tilt >= BOWL_CAMERA.tilt - 1e-9);
  const o = bowlCamOverview();
  const v = bowlCamView(o, W, H);
  for (const [x, y] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const q = bowlCamProject(v, bowlToGpu(x, y, BOWL_RIM_HEIGHT));
    assert.ok(q && q.x > -W * 0.6 && q.x < W * 1.6 && q.y > -H * 0.2 && q.y < H * 1.2, `rim ${x},${y} far off`);
  }
});

test('easing reaches its goal and takes the short way round', () => {
  let s = bowlCamHome(0.5, 0.5);
  const g = { ...bowlCamHome(-0.5, -0.2), yaw: s.yaw + 0.3 - 2 * Math.PI };
  for (let i = 0; i < 200 && bowlCamGap(s, g) > 1e-4; i++) s = bowlCamEase(s, g, 0.2);
  assert.ok(bowlCamGap(s, g) <= 1e-4);
  const mid = bowlCamEase(bowlCamHome(0.5, 0.5), g, 0.5);
  assert.ok(Math.abs(mid.yaw - bowlCamHome(0.5, 0.5).yaw) < 0.2, 'turned the long way round');
});

test('a look-at view puts its target in the middle and keeps its axes square', async () => {
  const { bowlCamLookView } = await import('../../game/js/logic/bowl-camera.js');
  for (const [C, T] of [
    [
      [0, 1.4, 0.8],
      [0, 0, 0],
    ],
    [
      [0.2, 2, 0.01],
      [0.2, 0, 0],
    ],
    [
      [0, 0.5, 0],
      [0, 1.7, 0],
    ],
  ]) {
    const v = bowlCamLookView(C, T, W, H, 0.3),
      q = bowlCamProject(v, T);
    assert.ok(q && near(q.x, W / 2, 1e-6) && near(q.y, H / 2, 1e-6));
    const d = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    assert.ok(near(d(v.fw, v.rt), 0) && near(d(v.fw, v.up), 0) && near(d(v.rt, v.up), 0));
  }
});

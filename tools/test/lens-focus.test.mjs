// Camera track CAM-3: the diorama blur's plane of focus (game/js/logic/lens-focus.js). Tilt 0 is the old blur
// exactly (a slab of view depth round the focus); tilt 1 an upright plane, so a tall thing in the strip is sharp
// head to toe; the plane's distance comes from three numbers a frame, as the shader works it out.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  edgeBlur,
  focusAim,
  focusBlur,
  focusPlane,
  leanStep,
  planeDistance,
  unprojectNdc,
  viewRays,
} from '../../game/js/logic/lens-focus.js';

const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);

/* the walk camera's matrices (walk/camera.js, engine/webgl.js matrix4), rebuilt here without a page */
function persp(fy, asp, n, f) {
  const t = 1 / Math.tan(fy / 2),
    o = new Float64Array(16);
  o[0] = t / asp;
  o[5] = t;
  o[10] = (f + n) / (n - f);
  o[11] = -1;
  o[14] = (2 * f * n) / (n - f);
  return o;
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  unit = a => {
    const l = Math.hypot(...a);
    return a.map(c => c / l);
  },
  dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function look(e, c, u) {
  const z = unit(sub(e, c)),
    x = unit(cross(u, z)),
    y = cross(z, x),
    o = new Float64Array(16);
  [o[0], o[4], o[8]] = x;
  [o[1], o[5], o[9]] = y;
  [o[2], o[6], o[10]] = z;
  o[12] = -dot(x, e);
  o[13] = -dot(y, e);
  o[14] = -dot(z, e);
  o[15] = 1;
  return o;
}
function mul(a, b) {
  const o = new Float64Array(16);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
      o[i * 4 + j] = s;
    }
  return o;
}
/* a general 4x4 inverse (Gauss-Jordan; the game uses matrix4.inv) */
function inv(m) {
  const a = [];
  for (let r = 0; r < 4; r++) a.push([0, 1, 2, 3].map(c => m[c * 4 + r]).concat([0, 1, 2, 3].map(c => +(c === r))));
  for (let c = 0; c < 4; c++) {
    let p = c;
    for (let r = c + 1; r < 4; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    const d = a[c][c];
    for (let k = 0; k < 8; k++) a[c][k] /= d;
    for (let r = 0; r < 4; r++)
      if (r !== c) {
        const f = a[r][c];
        for (let k = 0; k < 8; k++) a[r][k] -= f * a[c][k];
      }
  }
  const o = new Float64Array(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) o[c * 4 + r] = a[r][c + 4];
  return o;
}
/* a camera like the walk's: 36 m off, looking down at 50 degrees, mirrored in x as walk/camera.js does */
function camera(pitchDeg = 50, yawDeg = 20, df = 36) {
  const p = (pitchDeg * Math.PI) / 180,
    y = (yawDeg * Math.PI) / 180,
    tgt = [10, 2, -4],
    f = [Math.sin(y) * Math.cos(p), -Math.sin(p), Math.cos(y) * Math.cos(p)],
    eye = [tgt[0] - f[0] * df, tgt[1] - f[1] * df, tgt[2] - f[2] * df],
    proj = persp(0.7, 9 / 16, 0.5, 420);
  proj[0] = -proj[0];
  const vp = mul(proj, look(eye, tgt, [0, 1, 0]));
  return { vp, ivp: inv(vp), eye, tgt, near: 0.5, far: 420 };
}
/* the view depth of a world point and its screen place, as the depth buffer and the shader see them */
function onScreen(C, p) {
  const m = C.vp,
    x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return { u: (x / w + 1) / 2, v: (y / w + 1) / 2, z: w };
}
const shaderDistance = (P, s) => s.z * (P.g[0] + P.g[1] * s.u + P.g[2] * s.v) - P.h;

test('the eye and the view axis come back out of the inverse matrix', () => {
  const C = camera(),
    R = viewRays(C.ivp, C.near, C.far),
    f = unit(sub(C.tgt, C.eye));
  for (let i = 0; i < 3; i++) near(R.eye[i], C.eye[i], 1e-6);
  for (let i = 0; i < 3; i++) near(R.fwd[i], f[i], 1e-9);
  /* a point back on screen lands where it started */
  const q = unprojectNdc(C.ivp, 0.3, -0.2, 0.5),
    s = onScreen(C, q);
  near(s.u, 0.65, 1e-9);
  near(s.v, 0.4, 1e-9);
});

test('tilt 0 is the old blur: the distance is the view depth minus the focus, everywhere on screen', () => {
  const C = camera(),
    F = [11, 2.8, -3],
    P = focusPlane(C, F, 34.5, 0);
  near(P.g[0], 1, 1e-9);
  near(P.g[1], 0, 1e-9);
  near(P.g[2], 0, 1e-9);
  near(P.h, 34.5, 1e-9);
  for (const p of [
    [3, 0, 8],
    [20, 6, -15],
    [10, 2, -4],
  ]) {
    const s = onScreen(C, p);
    near(shaderDistance(P, s), s.z - 34.5, 1e-6);
    near(planeDistance(P, p), s.z - 34.5, 1e-6);
  }
});

test("the shader's three numbers give the plane's own distance at any tilt", () => {
  const C = camera(55, -30),
    F = [9, 2.5, -6];
  for (const t of [0.25, 0.5, 0.7, 1]) {
    const P = focusPlane(C, F, 33, t);
    for (const p of [
      [3, 0, 8],
      [20, 6, -15],
      [14, 1, -1],
      [6, 9, -9],
    ])
      near(shaderDistance(P, onScreen(C, p)), planeDistance(P, p), 1e-6);
  }
});

test('tilt 1: something standing in the strip is sharp head to toe; the ground ahead and behind is not', () => {
  const C = camera(),
    R = viewRays(C.ivp, C.near, C.far),
    F = [10, 0.8, -4],
    fd = dot(sub(F, R.eye), R.fwd),
    P = focusPlane(C, F, fd, 1),
    band = 16 * 0.62,
    rampF = 16 * 2.6,
    rampN = 16 * 0.9;
  near(P.n[1], 0, 1e-12);
  /* a 6 m tower at the focus: every height on the plane */
  for (const y of [0, 2, 4, 6]) near(planeDistance(P, [10, y, -4]), 0, 1e-6);
  /* the old slab blurs the tower's top (it leans out of a plane that faces a camera looking down) */
  const S = focusPlane(C, F, fd, 0),
    top = [10, 18, -4];
  assert.ok(focusBlur(planeDistance(S, top), band * 0.3, rampF, rampN) > 0.05);
  assert.equal(focusBlur(planeDistance(P, top), band * 0.3, rampF, rampN), 0);
  /* the ground 20 m behind the focus, along the view laid flat, melts away; beside it stays sharp */
  const flat = unit([R.fwd[0], 0, R.fwd[2]]),
    side = [flat[2], 0, -flat[0]];
  assert.ok(focusBlur(planeDistance(P, [10 + flat[0] * 20, 0, -4 + flat[2] * 20]), band, rampF, rampN) > 0.1);
  assert.equal(focusBlur(planeDistance(P, [10 + side[0] * 20, 0.8, -4 + side[2] * 20]), band, rampF, rampN), 0);
});

test('the eased focus moves the plane along the view, as the old focus distance did', () => {
  const C = camera(),
    F = [10, 0.8, -4],
    R = viewRays(C.ivp, C.near, C.far),
    fd = dot(sub(F, R.eye), R.fwd);
  for (const t of [0, 0.6, 1]) {
    const P = focusPlane(C, F, fd + 3, t);
    near(dot(sub(P.at, R.eye), R.fwd), fd + 3, 1e-9);
    near(planeDistance(P, P.at), 0, 1e-9);
  }
});

test("the blur's curve: sharp in the band, 0.6 of it in front, full past the ramp", () => {
  assert.equal(focusBlur(5, 6, 10, 4), 0);
  assert.equal(focusBlur(-3.5, 6, 10, 4), 0);
  assert.ok(focusBlur(-4, 6, 10, 4) > 0);
  near(focusBlur(11, 6, 10, 4), 0.5);
  assert.equal(focusBlur(16, 6, 10, 4), 1);
  assert.equal(focusBlur(-7.6, 6, 10, 4), 1);
});

test('the edge blur: none in the middle, the most in the corners, none when off', () => {
  assert.equal(edgeBlur(0.5, 0.5, 1), 0);
  assert.equal(edgeBlur(0.75, 0.5, 1), 0);
  assert.ok(edgeBlur(0, 0, 1) > 0.9);
  assert.equal(edgeBlur(0, 0, 0), 0);
});

test('what the focus is on: you; a tap for 2.6 s; the two-shot; the encounter; a boss', () => {
  const you = { px: 2, pz: 3, t: 10000 };
  assert.deepEqual(focusAim(you), { x: 2, z: 3, kind: 'you' });
  const tap = { x: 8, z: 3, t: 9000 };
  assert.equal(focusAim({ ...you, tap }).x, 8);
  assert.equal(focusAim({ ...you, tap: { ...tap, t: 7000 } }).x, 2);
  assert.deepEqual(focusAim({ ...you, moment: 'talk', talk: [6, 7] }), { x: 4, z: 5, kind: 'talk' });
  /* the speaker alone (a talk spot kept after the talk) is not a moment */
  assert.equal(focusAim({ ...you, moment: 'idle', talk: [6, 7] }).kind, 'you');
  assert.deepEqual(focusAim({ ...you, moment: 'boss', boss: [20, 1] }), { x: 20, z: 1, kind: 'boss' });
  assert.equal(focusAim({ ...you, moment: 'talk', talk: [6, 7], swoop: { ex: 9, ez: 9 } }).kind, 'encounter');
});

test('the lean eases at the same rate at any frame rate, and walking never leaves it behind', () => {
  const run = fps => {
    let o = [0, 0];
    for (let i = 0; i < Math.round(fps * 0.3); i++) o = leanStep(o, [4, -2], 1 / fps, 0.3);
    return o;
  };
  const a = run(30),
    b = run(150);
  near(a[0], b[0], 1e-9);
  near(a[0], 4 * (1 - Math.exp(-3)), 1e-9);
  assert.deepEqual(leanStep([1, 1], [4, 4], 0.016, 0), [4, 4]);
});

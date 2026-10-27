// Air track AIR-1: the haze maths (tools/test/haze-twin.mjs, the JS twin of fogit in engine/webgl.js and of the sky's
// gradient, SKY_GLSL). Every new dial at 0 must give fogit's old result (the quick-check baseline relies on it); the
// height falloff is the exact integral of the density along the ray; the RGB fade loses red first.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { airAvg, hazeAt, skyGrad } from './haze-twin.mjs';

const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const near = (a, b, eps, msg) => a.forEach((v, i) => assert.ok(close(v, b[i], eps), `${msg}: ${a} vs ${b}`));
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// fogit before AIR-1 (engine/webgl.js at air-0-done), without the wobble, the valley mist, tint and room dimming
function oldFogit(p, F) {
  const r = p.map((v, i) => v - F.eye[i]),
    d = Math.hypot(...r);
  let f = 1 - Math.exp((-Math.max(0, d - F.fogStart) / F.fogD) * 1.6);
  const m = F.mist * Math.exp(-Math.max(0, p[1] - F.mistY) * 1.4) * smooth(4, 22, d);
  f = Math.min(1, Math.max(0, f + m * (1 - f)));
  const vd = r.map(v => v / Math.max(d, 0.001)),
    toSun = Math.pow(Math.max(vd[0] * F.sunDir[0] + vd[1] * F.sunDir[1] + vd[2] * F.sunDir[2], 0), 6),
    k = toSun * F.fogSun,
    fc = F.fog.map((v, i) => v * (1 - k) + (v * 0.45 + F.sunCol[i] * 0.7) * k);
  return { f, col: fc };
}
const frame = (o = {}) => ({
  eye: [0, 18, 14],
  fog: [0.85, 0.8, 0.72],
  fogStart: 15,
  fogD: 39,
  fogSun: 0.4,
  sunDir: [0.4, 0.5, -0.77],
  sunCol: [1.1, 0.95, 0.75],
  mist: 0.12,
  mistY: 0.25,
  skyTop: [0.3, 0.5, 0.85],
  skyMid: [0.6, 0.75, 0.9],
  skyLow: [0.93, 0.88, 0.78],
  hazeY: 0,
  hazeSky: 0,
  hazeTint: 0,
  hazeFall: 0,
  mistRay: 0,
  skyGlow: 0,
  ...o,
});
const POINTS = [
  [0, 0, 0],
  [5, 0.2, -30],
  [-20, 3, -60],
  [30, 12, -90],
  [0, 40, -140],
  [2, 0, 10],
  [60, -4, -40],
];

test('skyGrad: the sky shader’s three stops, and its old inline formula at every height', () => {
  const s0 = [0.1, 0.2, 0.9],
    s1 = [0.5, 0.6, 0.7],
    s2 = [0.9, 0.8, 0.6];
  assert.deepEqual(skyGrad(s0, s1, s2, -0.5), s2);
  assert.deepEqual(skyGrad(s0, s1, s2, 0.18), s1);
  assert.deepEqual(skyGrad(s0, s1, s2, 1), s0);
  for (let e = -1; e <= 1; e += 0.01) {
    const old =
      e < 0.18
        ? s2.map((v, i) => v + (s1[i] - v) * smooth(-0.05, 0.18, e))
        : s1.map((v, i) => v + (s0[i] - v) * smooth(0.18, 0.75, e));
    near(skyGrad(s0, s1, s2, e), old, 1e-12, 'e ' + e);
  }
});

test('every new dial at 0: fogit’s old haze amount and colour (the baseline does not move)', () => {
  for (const o of [
    {},
    { eye: [3, 40, 30], fogStart: 2 },
    { mist: 0.5, mistY: 2 },
    { fogSun: 1.5, sunDir: [0, 0.6, -0.8] },
  ])
    for (const p of POINTS) {
      const F = frame(o),
        a = hazeAt(p, F),
        b = oldFogit(p, F);
      near(a.f, [b.f, b.f, b.f], 1e-12, 'amount at ' + p);
      near(a.col, b.col, 1e-12, 'colour at ' + p);
    }
});

test('airAvg: the integral matches a numerical sum, is 1 with no falloff, and stays under its cap', () => {
  for (const [y0, y1, r, b] of [
    [18, 0, 0, 0.06],
    [18, 30, 2, 0.1],
    [5, 5, 0, 0.2],
    [40, -3, 1, 0.03],
  ]) {
    let s = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) s += Math.exp(-b * (y0 + ((i + 0.5) / n) * (y1 - y0) - r));
    assert.ok(
      close(airAvg(y0, y1, r, b, 1e9), s / n, 1e-6),
      `${[y0, y1, r, b]}: ${airAvg(y0, y1, r, b, 1e9)} vs ${s / n}`
    );
  }
  assert.equal(airAvg(18, 0, 0, 0, 3), 1);
  assert.equal(airAvg(-400, -500, 0, 0.3, 3), 3);
  assert.ok(Number.isFinite(airAvg(1e4, -1e4, 0, 0.3, 3)));
});

test('height falloff: a hilltop is clearer than low ground at the same distance, and nothing goes NaN', () => {
  const F = frame({ hazeFall: 0.08 }),
    low = hazeAt([0, 0, -80], F).f[1],
    high = hazeAt([0, 25, -80], F).f[1],
    flat = hazeAt([0, 0, -80], frame()).f[1];
  assert.ok(high < low, `${high} < ${low}`);
  assert.ok(low > 0 && flat > 0);
  for (const p of POINTS) for (const v of hazeAt(p, F).f) assert.ok(v >= 0 && v <= 1);
});

test('RGB fade: neutral at 0; red lost first, blue last when tinted', () => {
  const p = [0, 0, -70];
  const [r0, g0, b0] = hazeAt(p, frame()).f;
  assert.ok(r0 === g0 && g0 === b0);
  const [r, g, b] = hazeAt(p, frame({ hazeTint: 1 })).f;
  assert.ok(r > g && g > b, `${r} > ${g} > ${b}`);
  assert.equal(g, g0);
});

test('sky-shaped colour keeps the place’s haze below the horizon and leans to the sky above it', () => {
  // the sky is its low colour only below e = -0.05 (looking down: what the walk camera mostly sees)
  const F = frame({ hazeSky: 1, fogSun: 0 }),
    level = hazeAt([0, F.eye[1] - 10, -100], F).col,
    up = hazeAt([0, 120, -40], F).col;
  near(level, F.fog, 1e-12, 'below the horizon: the place’s haze');
  assert.ok(up[2] - up[0] > F.fog[2] - F.fog[0], 'bluer looking up');
  for (const p of POINTS) for (const v of hazeAt(p, frame({ hazeSky: 1, skyTop: [0, 0, 0] })).col) assert.ok(v >= 0);
});

test('ray mist: a hill seen across low ground gets some mist; the point mist gives it none', () => {
  const p = [0, 6, -40],
    F = frame({ eye: [0, 3, 0], mist: 0.4, fogStart: 500 });
  assert.ok(hazeAt(p, F).f[0] < 0.02);
  assert.ok(hazeAt(p, { ...F, mistRay: 1 }).f[0] > hazeAt(p, F).f[0]);
});

test('the sky glow is a broad lobe: toward the sun it warms, away from the sun it changes nothing', () => {
  const F = frame({ fogSun: 0, skyGlow: 1, sunDir: [0, 0, -1] }),
    toward = hazeAt([0, 18, -60], F).col,
    away = hazeAt([0, 18, 60], F).col,
    side = hazeAt([60, 18, 14 - 60], F).col;
  near(away, F.fog, 1e-12, 'away');
  assert.ok(toward[0] > F.fog[0]);
  assert.ok(side[0] > F.fog[0] && side[0] < toward[0], 'broad: the side still warms');
});

test('the sky shader and fogit both read the one skyGrad, and fogit the one airAvg (they cannot drift apart)', () => {
  const read = f => readFileSync(new URL('../../game/js/' + f, import.meta.url), 'utf8'),
    gl = read('engine/webgl.js'),
    sky = read('walk/walk-shaders.js');
  assert.equal(gl.match(/vec3 skyGrad\(/g).length, 1, 'one skyGrad');
  const fogit = gl.slice(gl.indexOf('vec3 fogit('), gl.indexOf('return mix(c,fc,f);}'));
  assert.match(fogit, /skyGrad\(uSkyTop,uSkyMid,uSkyLow,vd\.y\)/);
  assert.equal(fogit.match(/airAvg\(/g).length, 2, 'the haze and the ray mist');
  assert.match(sky, /\$\{SKY_GLSL\}/);
  assert.match(sky, /vec3 c=skyGrad\(uSky0,uSky1,uSky2,e\);/);
});

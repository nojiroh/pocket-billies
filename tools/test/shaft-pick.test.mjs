// Smart light shafts (game/js/logic/shaft-pick.js): beams go where shade lies behind them, looking into the light, at
// a middle distance, apart from each other, never over you; a beam showing keeps its place; none with the sun down.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SHAFT_HOLD,
  crownGaps,
  footShade,
  forwardScatter,
  inShade,
  pickShafts,
  projectNdc,
} from '../../game/js/logic/shaft-pick.js';

/* a walk-like camera: perspective, looking from eye at the target (column-major, as engine/webgl.js matrix4) */
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
function look(e, c) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    nrm = v => {
      const l = Math.hypot(...v);
      return v.map(x => x / l);
    },
    cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const z = nrm(sub(e, c)),
    x = nrm(cross([0, 1, 0], z)),
    y = cross(z, x);
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1];
}
function mul(a, b) {
  const o = new Float64Array(16);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k];
  return o;
}
const eye = [0, 14, 20],
  vp = mul(persp(0.9, 4 / 3, 0.5, 420), look(eye, [0, 0, 0])),
  /* a low sun in the north-west, behind the scene as the camera looks north (into the light) */
  sun = (() => {
    const v = [-0.4, 0.35, -0.85],
      l = Math.hypot(...v);
    return v.map(x => x / l);
  })(),
  flat = () => 0,
  base = { eye, vp, sun, ground: flat, blockers: [] };
const crown = (key, x, z, top = 7) => ({ key, x, z, top, w: 1.2, kind: 'crown' });

test('forward scattering: looking into the light counts most, across it 1, with it behind you least', () => {
  assert.ok(forwardScatter(0.9) > forwardScatter(0) && forwardScatter(0) > forwardScatter(-0.9));
  assert.ok(Math.abs(forwardScatter(0) - 1) < 1e-9);
  assert.ok(forwardScatter(1) <= 2.5 && forwardScatter(-1) >= 0.35);
});

test('shade: ground under a crown, seen toward the sun, is shaded; open ground is not; no sun is all shade', () => {
  const b = [{ x: 0, z: 0, y: 5, r: 1.5 }],
    t = 5 / sun[1];
  assert.equal(inShade(-sun[0] * t, 0, -sun[2] * t, sun, b), true);
  assert.equal(inShade(8, 0, 8, sun, b), false);
  assert.equal(inShade(8, 0, 8, [0, -0.1, 1], b), true);
  assert.equal(footShade(30, 0, 30, 1, sun, b), 0);
});

test('gaps: two crowns a few radii apart give one gap between their edges; touching or far apart give none', () => {
  const C = (key, x) => ({ key, x, z: 0, r: 1.5, top: 7 });
  const g = crownGaps([C('a', 0), C('b', 4)]);
  assert.equal(g.length, 1);
  assert.equal(g[0].kind, 'gap');
  assert.ok(Math.abs(g[0].x - 2) < 1e-9 && g[0].w >= 0.6 && g[0].w <= 2);
  assert.equal(crownGaps([C('a', 0), C('b', 2)]).length, 0);
  assert.equal(crownGaps([C('a', 0), C('b', 9)]).length, 0);
});

test('no shafts with the sun at or below the horizon, or with no budget', () => {
  const c = [crown('a', 0, -4)];
  assert.equal(pickShafts(c, { ...base, sun: [0, 0.02, -1] }).length, 0);
  assert.equal(pickShafts(c, { ...base, max: 0 }).length, 0);
});

test('the budget, the spacing in the world and on screen, and the share of the screen', () => {
  const many = [];
  for (let i = 0; i < 12; i++) many.push(crown('t' + i, -12 + i * 2.2, -6));
  const p = pickShafts(many, { ...base, max: 3 });
  assert.ok(p.length > 0 && p.length <= 3);
  for (let i = 0; i < p.length; i++)
    for (let j = i + 1; j < p.length; j++) assert.ok(Math.hypot(p[i].x - p[j].x, p[i].z - p[j].z) >= 3);
  const near = pickShafts([crown('a', 0, -6), crown('b', 1, -6)], base);
  assert.equal(near.length, 1);
  const tiny = pickShafts(many, { ...base, max: 8, cover: 0.0001 });
  assert.equal(tiny.length, 0);
  const sum = pickShafts(many, { ...base, max: 8, cover: 0.05 }).reduce((s, q) => s + q.cover, 0);
  assert.ok(sum <= 0.05 + 1e-9);
});

test('the same scene gives the same shafts (no randomness)', () => {
  const c = [crown('a', -4, -6), crown('b', 4, -6), crown('c', 0, -10)];
  assert.deepEqual(pickShafts(c, base), pickShafts(c, base));
});

test('a beam with shade behind it beats one in the open', () => {
  const t = 5 / sun[1],
    /* a blocker whose shadow covers the second beam's foot */
    a = crown('open', -6, -6),
    b = crown('shaded', 6, -6),
    B = pickShafts([b], base)[0],
    foot = [b.x - sun[0] * B.len, b.z - sun[2] * B.len],
    blockers = [{ x: foot[0] + sun[0] * t, z: foot[1] + sun[2] * t, y: 5, r: 3 }];
  const p = pickShafts([a, b], { ...base, blockers, max: 1 });
  assert.equal(p[0].key, 'shaded');
});

test('a beam showing keeps its place against a slightly better one, not against a much better one', () => {
  const c = [crown('a', -1.6, -6), crown('b', 1.6, -6)],
    [hi, lo] = c.map(x => pickShafts([x], base)[0]).sort((p, q) => q.score - p.score),
    held = pickShafts(c, { ...base, max: 1, keep: new Set([lo.key]) })[0].key;
  assert.equal(held, hi.score / lo.score < SHAFT_HOLD ? lo.key : hi.key);
  assert.equal(pickShafts(c, { ...base, max: 1 })[0].key, hi.key);
});

test('never across you, and nothing right at the camera or past the range', () => {
  const pl = [0, 0, -2],
    s = projectNdc(vp, 0, 0.9, -2);
  assert.ok(s);
  const c = [crown('over', 0 + sun[0] * 3, -2 + sun[2] * 3, 6)];
  const free = pickShafts(c, base)[0],
    over = pickShafts(c, { ...base, player: pl })[0];
  assert.ok(!over || over.score < free.score * 0.2);
  assert.equal(pickShafts([crown('cam', 0, 18, 15)], base).length, 0);
  assert.equal(pickShafts([crown('far', 0, -60)], base).length, 0);
});

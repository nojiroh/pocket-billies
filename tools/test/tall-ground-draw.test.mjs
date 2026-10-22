// Terrain TR-3: what the walk renderer sends for tall ground, with a stand-in WebGL context (no graphics): the rock
// fade's uniforms (draw-common.js rockUniformsFor) are off on flat ground, in battle and for another camera (the water's
// reflection), and on with the player's feet and a circle when ground cuts the camera's line; the player's silhouette
// (sprites.js drawPlayerSilhouette) is one draw with depth GREATER and no depth writes, put back afterwards, and none
// on flat ground, in battle, indoors or with its setting off.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordingGL } from './walk-renderer.mjs';

const G = globalThis;
const { gpuState, walkView, walkRenderer, rockUniformsFor, drawPlayerSilhouette } = G;

// a camera 20 m back and 15 m up from a player at (10, 0, 30), looking along +z: a plain perspective matrix
function camera(extra) {
  const eye = [10, 15, 10],
    f = [0, -0.6, 0.8],
    // view: right = [1,0,0] (flipped x as walkCamera does), up = cross(right, f)
    up = [0, 0.8, 0.6],
    r = [-1, 0, 0],
    t = v => -(v[0] * eye[0] + v[1] * eye[1] + v[2] * eye[2]);
  const V = [r[0], up[0], -f[0], 0, r[1], up[1], -f[1], 0, r[2], up[2], -f[2], 0, t(r), t(up), -t(f), 1];
  const n = 0.5,
    fa = 420,
    k = 1 / Math.tan(0.5);
  const Pm = [k, 0, 0, 0, 0, k, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, (2 * fa * n) / (n - fa), 0];
  const vp = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r2 = 0; r2 < 4; r2++) for (let i = 0; i < 4; i++) vp[c * 4 + r2] += Pm[i * 4 + r2] * V[c * 4 + i];
  return { vp, eye, rw: 400, rh: 300, right: [1, 0, 0], back: [0, 0, -1], fwd: [0, 0, 1], occ: 0, rockK: 0, ...extra };
}
const me = {
  k: 'me',
  im: { width: 32, height: 48 },
  x: 10,
  y: 0,
  z: 30,
  mpp: 1 / 32,
  ox: -16,
  oy: -40,
  w: 32,
  h: 48,
  flip: 1,
};

function setup(C) {
  const gl = recordingGL();
  gpuState.gl = gl;
  const U = n => Object.fromEntries(n.map(k => [k, k]));
  gpuState.P = {
    sprite: {
      p: 'sprite',
      U: U([
        'uVP',
        'uPlC',
        'uRock',
        'uAspect',
        'uRight',
        'uBack',
        'uFwd',
        'uDZ',
        'uCurveOn',
        'uAlpha',
        'uFade',
        'uGhost',
        'uGhostV',
        'uBase',
        'uOff',
        'uUV',
        'uFlip',
        'uShear',
      ]),
    },
  };
  walkView.sc = { w: 64, h: 64, heights: null };
  walkView.pl = { x: 10, z: 30, yv: 0 };
  walkView.C = C;
  walkRenderer.bt = null;
  G.imageTexture = () => ({ t: 'tex', n: 'nrm' });
  return gl.calls;
}
const uniform = (calls, name) => calls.filter(c => c[1] === name).map(c => c.slice(2));

test('rock fade: off on flat ground, on (feet, circle) when ground cuts the line, off in battle and for another camera', () => {
  let C = camera();
  setup(C);
  let R = rockUniformsFor(C);
  assert.ok(R.plc[2] > 0.2, 'the player is on screen');
  assert.deepEqual(Array.from(R.rock), [0, 0, 0, 0], 'flat ground: off');
  C = camera({ rockK: 1, occ: 9 });
  walkView.C = C;
  R = rockUniformsFor(C);
  assert.equal(R.rock[0], 0, "the player's feet");
  assert.ok(R.rock[1] >= 0.3 && R.rock[1] <= 0.46, `a circle round the player: ${R.rock[1]}`);
  assert.ok(Math.abs(R.rock[2] - 0.8) < 1e-6);
  const other = camera({ rockK: 1 });
  assert.deepEqual(Array.from(rockUniformsFor(other).rock), [0, 0, 0, 0], 'a reflection camera: off');
  walkRenderer.bt = {};
  const B = camera({ rockK: 1 });
  walkView.C = B;
  R = rockUniformsFor(B);
  assert.deepEqual(Array.from(R.plc), [9, 9, -1], 'in battle the spot is off screen');
  assert.deepEqual(Array.from(R.rock), [0, 0, 0, 0]);
  walkRenderer.bt = null;
});

test('silhouette: one draw with depth GREATER and no depth writes, put back after; the ghost uniforms cleared', () => {
  const C = camera({ rockK: 1 });
  const calls = setup(C);
  assert.equal(drawPlayerSilhouette(C, [me], {}), 1);
  const names = calls.map(c => c[0]);
  const draw = names.indexOf('drawArrays');
  assert.ok(draw > 0 && names.lastIndexOf('drawArrays') === draw, 'one draw');
  const before = calls.slice(0, draw),
    after = calls.slice(draw + 1);
  assert.deepEqual(before.filter(c => c[0] === 'depthFunc').at(-1), ['depthFunc', 'GREATER']);
  assert.deepEqual(before.filter(c => c[0] === 'depthMask').at(-1), ['depthMask', false]);
  assert.deepEqual(after.filter(c => c[0] === 'depthFunc').at(-1), ['depthFunc', 'LEQUAL']);
  assert.deepEqual(after.filter(c => c[0] === 'depthMask').at(-1), ['depthMask', true]);
  const ghost = uniform(before, 'uGhost').at(-1);
  assert.ok(ghost[3] > 0 && ghost[3] <= 1, 'a tint over part of the pixels');
  assert.deepEqual(uniform(before, 'uGhostV').at(-1), [...C.eye, 0.6], 'pulled toward the eye');
  assert.deepEqual(uniform(after, 'uGhost').at(-1), [0, 0, 0, 0]);
  assert.deepEqual(uniform(after, 'uGhostV').at(-1), [0, 0, 0, 0]);
});

test('no silhouette on flat ground, in battle, indoors or without the player', () => {
  let C = camera();
  let calls = setup(C);
  assert.equal(drawPlayerSilhouette(C, [me], {}), 0, 'flat ground');
  C = camera({ rockK: 1 });
  calls = setup(C);
  walkRenderer.bt = {};
  assert.equal(drawPlayerSilhouette(C, [me], {}), 0, 'battle');
  walkRenderer.bt = null;
  walkView.sc.indoor = true;
  assert.equal(drawPlayerSilhouette(C, [me], {}), 0, 'indoors');
  walkView.sc.indoor = false;
  assert.equal(drawPlayerSilhouette(C, [], {}), 0, 'no player');
  assert.equal(calls.filter(c => c[0] === 'drawArrays').length, 0);
});

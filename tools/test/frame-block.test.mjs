// Phase 20 C3: the frame's light values in one uniform block (game/js/engine/frame-block.js). The packed block must
// hold, at the offsets the GLSL's std140 layout gives, exactly the values setLightUniforms sends one uniform at a time
// today (recorded on a stand-in WebGL context). No graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeProgram, recordingGL } from './walk-renderer.mjs';

await import('../../game/js/engine/frame-block.js');
const G = globalThis;
const { FRAME_BLOCK_BYTES, FRAME_BLOCK_GLSL, FRAME_BLOCK_LAYOUT, packFrameBlock, std140Layout } = G;
const { setLightUniforms, LIGHT_GLSL, gpuState } = G;

const SAMPLERS = ['uShadow', 'uShadowD', 'uShadow2', 'uShadowD2', 'uLampSh0', 'uLampSh1'];
// every uniform LIGHT_GLSL declares without the block (its #else branch), by name: [type, array length]
function lightUniforms() {
  const out = {},
    plain = LIGHT_GLSL.replace(/\/\*[\s\S]*?\*\//g, '').replace(/#ifdef PB_FRAME_BLOCK[\s\S]*?#else/, '');
  for (const m of plain.matchAll(/uniform\s+(?:highp\s+)?(\w+)\s+([^;]+);/g))
    for (const part of m[2].split(',')) {
      const [, name, n] = part.trim().match(/^(\w+)(?:\[(\d+)\])?$/);
      out[name] = [m[1], n ? +n : 0];
    }
  return out;
}
const mat = k => Array.from({ length: 16 }, (_, i) => k + i * 0.125);
// a light context with every part filled, odd numbers so a wrong offset shows
function fixture(o = {}) {
  const sh = new Float32Array(27).map((_, i) => 0.01 * (i + 1));
  return {
    eye: [1.5, 2.25, -3],
    sun: { dir: [0.3, 0.8, 0.52], col: [1.1, 0.95, 0.7] },
    ambTop: [0.4, 0.5, 0.6],
    ambBot: [0.2, 0.18, 0.15],
    ambK: 0.85,
    fogSun: 0.6,
    sh,
    shK: 0.7,
    fog: [0.6, 0.7, 0.8],
    fogStart: 12,
    fogD: 41.4,
    tint: [1, 0.9, 0.8],
    tintAmt: 0.3,
    mist: 0.12,
    mistY: 0.4,
    valley: [2.5, 0.35],
    time: 123456.5,
    shStr: 0.66,
    shTint: [0.5, 0.55, 0.7],
    cloudSh: 0.2,
    cloudCov: 0.45,
    cloudSpd: 1.3,
    contact: 0.4,
    shLift: [0.02, 0.03, 0.05],
    shPx: 32,
    shSteps: 2,
    roomB: [1, 2, 3, 4],
    roomDim: 0.68,
    lite: true,
    season: [0.1, 0.2, 0.3, 0.4],
    lights: [
      { p: [1, 2, 3], r: 6, c: [1, 0.8, 0.5] },
      { p: [-4, 1.5, 7.25], r: 4.5, c: [0.3, 0.4, 0.9], front: true },
      { p: [9, 0.5, -2], r: 3, c: [2, 1.5, 1] },
    ],
    ao: [
      [1, 2, 0.5, 0.75],
      [3.25, -1, 1.5, 1],
      [0, 0, 2, 2],
    ],
    curve: [32, 24, 0.0004, 40],
    shadow: {
      d: 'depthNear',
      vp: mat(1),
      size: 2048,
      pen: 3.5,
      far: { d: 'depthFar', vp: mat(2), size: 1024, pen: 1.75 },
    },
    lampSh: [
      { d: 'lamp0', vp: mat(3) },
      { d: 'lamp1', vp: mat(4) },
    ],
    ...o,
  };
}
// what setLightUniforms sends to a program that uses every light uniform: { name: [numbers] }
function sent(X) {
  const gl = recordingGL();
  gpuState.gl = gl;
  gpuState.samp = { cmp: 'cmp', raw: 'raw' };
  gpuState.fb = {};
  gpuState.depthStub = 'stub';
  setLightUniforms(fakeProgram([...Object.keys(lightUniforms()), 'uCurve', 'uCurveD0']), X);
  const out = {};
  for (const [fn, loc, ...a] of gl.calls) {
    if (!/^uniform/.test(fn)) continue;
    out[loc] = (fn.startsWith('uniformMatrix') ? a[1] : a.length === 1 && Array.isArray(a[0]) ? a[0] : a).map(Number);
  }
  return out;
}
function packed(X) {
  const buf = new ArrayBuffer(FRAME_BLOCK_BYTES),
    f = new Float32Array(buf),
    n = new Int32Array(buf);
  packFrameBlock(X, f, n);
  // a member's values as setLightUniforms would send them (uSH: vec4 slots back to vec3s; arrays: the used part)
  return (name, count) => {
    const [at, type, len] = FRAME_BLOCK_LAYOUT.members[name],
      src = type === 'int' ? n : f,
      i = at / 4;
    if (name === 'uSH') return Array.from({ length: 27 }, (_, k) => f[i + Math.floor(k / 3) * 4 + (k % 3)]);
    const w = { float: 1, int: 1, vec2: 2, vec3: 3, vec4: 4, mat4: 16 }[type];
    return Array.from(src.subarray(i, i + (count ?? (len ? len * w : w))));
  };
}
function compare(X) {
  const S = sent(X),
    get = packed(X);
  let n = 0;
  for (const [name, v] of Object.entries(S)) {
    if (SAMPLERS.includes(name) || ['uFol', 'uCurve', 'uCurveD0'].includes(name)) continue;
    assert.ok(FRAME_BLOCK_LAYOUT.members[name], name + ' is set by setLightUniforms but is not in the block');
    const want = Float32Array.from(v),
      got = get(name, ['uLP', 'uLC', 'uAO'].includes(name) ? v.length : undefined);
    assert.deepEqual(Array.from(got).slice(0, want.length), Array.from(want), name);
    n++;
  }
  return n;
}

test('the block declares every light value LIGHT_GLSL has (uSH as vec4 slots), and nothing else but padding', () => {
  const L = lightUniforms(),
    B = FRAME_BLOCK_LAYOUT.members;
  for (const [name, [type, len]] of Object.entries(L)) {
    if (SAMPLERS.includes(name) || name === 'uFol') continue;
    assert.ok(B[name], name + ' missing from the block');
    assert.deepEqual([B[name][1], B[name][2]], name === 'uSH' ? ['vec4', 9] : [type, len], name);
  }
  for (const name of Object.keys(B)) assert.ok(L[name] || /Pad/.test(name), name + ' is not a light uniform');
});

test('std140 offsets: matrices, arrays, vec3 + float pairs, the ints at the end; 2208 bytes', () => {
  const B = FRAME_BLOCK_LAYOUT.members,
    at = k => B[k][0];
  assert.equal(FRAME_BLOCK_BYTES, 2208);
  assert.deepEqual([at('uShadowM'), at('uShadowM2'), at('uLampM0'), at('uLampM1')], [0, 64, 128, 192]);
  assert.deepEqual([at('uLP'), at('uLC'), at('uAO'), at('uSH')], [256, 512, 768, 1792]);
  assert.deepEqual([at('uEye'), at('uTime'), at('uSunDir'), at('uFogStart')], [1936, 1948, 1952, 1964]);
  assert.deepEqual([at('uValley'), at('uMist'), at('uMistY'), at('uCloudSh')], [2112, 2120, 2124, 2128]);
  assert.deepEqual([at('uShadowTexel'), at('uShadowTexel2'), at('uRoomDim')], [2160, 2168, 2176]);
  assert.deepEqual([at('uNL'), at('uNLS'), at('uNAO')], [2192, 2196, 2200]);
  // the rules on their own: a vec3 takes 16-byte alignment, a float may fill its fourth slot, arrays step by vec4
  const t = std140Layout('layout(std140) uniform T{float a;vec3 b;float c;vec2 d[2];int e;};').members;
  assert.deepEqual(
    Object.values(t).map(v => v[0]),
    [0, 16, 28, 32, 64]
  );
  assert.ok(FRAME_BLOCK_GLSL.startsWith('layout(std140) uniform Frame{'));
});

test('packing: every value setLightUniforms sends, at its offset (shadows, both cascades, two lamps)', () => {
  assert.ok(compare(fixture()) >= 45);
});

test('packing: no shadow map, no sky terms, no room box or valley (the defaults setLightUniforms uses)', () => {
  const X = fixture({ shadow: null, sh: null, roomB: null, valley: null, season: null, shLift: null });
  delete X.cloudCov;
  delete X.shSteps;
  compare(X);
  const get = packed(X);
  assert.deepEqual(get('uShadowOn'), [0]);
  assert.deepEqual(get('uShadow2On'), [0]);
  assert.deepEqual(get('uNLS'), [0]);
  assert.deepEqual(get('uSHK'), [0]);
  assert.deepEqual(get('uCloudCov'), [Math.fround(0.45)]);
  assert.deepEqual(get('uShSteps'), [2]);
});

test('packing: one cascade, one lamp, no lights or contact shadows; a second pack leaves nothing behind', () => {
  const X = fixture({ lights: [], ao: [], lampSh: [{ d: 'lamp0', vp: mat(5) }] });
  X.shadow = { ...X.shadow, far: null };
  compare(X);
  const buf = new ArrayBuffer(FRAME_BLOCK_BYTES),
    f = new Float32Array(buf),
    n = new Int32Array(buf);
  packFrameBlock(fixture(), f, n);
  packFrameBlock(X, f, n);
  assert.equal(n[FRAME_BLOCK_LAYOUT.members.uNL[0] / 4], 0);
  assert.equal(n[FRAME_BLOCK_LAYOUT.members.uNLS[0] / 4], 1);
  assert.equal(f[FRAME_BLOCK_LAYOUT.members.uLP[0] / 4], 0, 'last frame’s first light is gone');
  assert.equal(f[FRAME_BLOCK_LAYOUT.members.uLampM1[0] / 4], 0, 'last frame’s second lamp matrix is gone');
});

test('a program with the block: packed and sent once per light context, bound again only when the slot changes', () => {
  const gl = recordingGL();
  gpuState.gl = gl;
  gpuState.samp = { cmp: 'cmp', raw: 'raw' };
  gpuState.fb = {};
  gpuState.depthStub = 'stub';
  const prog = names => ({ ...fakeProgram(names), frame: true }),
    A = prog(['uCurve', 'uCurveD0', 'uFol', ...SAMPLERS]),
    B = prog(['uCurve', 'uCurveD0', 'uFol', 'uShadow', 'uShadowD']),
    X = fixture(),
    calls = k => gl.calls.filter(c => c[0] === k);
  setLightUniforms(A, X);
  // only the vertex curve, the per-thing foliage and the sampler units go as plain uniforms
  const plain = new Set(gl.calls.filter(c => /^uniform/.test(c[0])).map(c => c[1]));
  assert.deepEqual([...plain].sort(), ['uCurve', 'uCurveD0', 'uFol', ...SAMPLERS].sort());
  const [up] = calls('bufferSubData'),
    want = new Float32Array(FRAME_BLOCK_BYTES / 4);
  packFrameBlock(X, want, new Int32Array(want.buffer));
  assert.deepEqual(up.slice(1, 3), ['UNIFORM_BUFFER', 0]);
  assert.deepEqual(up[3], Array.from(want));
  assert.deepEqual(calls('bindBufferRange')[0].slice(1), ['UNIFORM_BUFFER', 0, null, 0, FRAME_BLOCK_BYTES]);
  setLightUniforms(B, X);
  assert.equal(calls('bufferSubData').length, 1, 'the same context is not sent again');
  assert.equal(calls('bindBufferRange').length, 1, 'nor bound again');
  // the reflection's copy (no shadow map) takes the next slot; going back to the frame's context binds its slot again
  const R = Object.assign({}, X, { shadow: null });
  setLightUniforms(B, R);
  assert.deepEqual(calls('bufferSubData')[1].slice(1, 3), ['UNIFORM_BUFFER', 2304]);
  setLightUniforms(B, X);
  assert.deepEqual(
    calls('bindBufferRange').map(c => c[4]),
    [0, 2304, 0]
  );
  assert.equal(calls('bufferSubData').length, 2);
  // a context changed after it was sent (the lamps) is packed again
  G.frameBlockStale(X);
  X.lampSh = [];
  setLightUniforms(B, X);
  assert.equal(calls('bufferSubData').length, 3);
});

// Phase 20 D2: Medium precision (quality.mediump). The post passes' fragment shaders in mediump with highp kept where
// it is needed (game/js/engine/shader-precision.js, the lists in engine/post-effects.js POST_MEDIUMP). Off: every
// shader text exactly as before. On: each edit found exactly once (an edit to a shader that breaks a list fails here,
// not silently on a phone), and what must stay highp does. Whether a version builds is the in-game full test's
// Shaders step (engine/webgl.js mediumpCheck), on the device's own driver. No graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './walk-renderer.mjs';

const { POST_EFFECT_SHADERS, POST_MEDIUMP, gpuState, MEDIUMP_FROM, MEDIUMP_TO, mediumpFragment, mediumpMissing } =
  globalThis;
const NAMES = ['bright', 'down', 'up', 'rays', 'grade'];

test('the post passes that opt in are the ones meant, and each carries its list', () => {
  assert.deepEqual(Object.keys(POST_MEDIUMP).sort(), [...NAMES].sort());
  for (const k of NAMES) assert.equal(POST_EFFECT_SHADERS[k].mp, POST_MEDIUMP[k], k);
  for (const k of ['dof', 'dofnear', 'dofgrow', 'ao', 'vol']) assert.equal(POST_EFFECT_SHADERS[k].mp, undefined, k);
});

test('every edit is found exactly once in its shader', () => {
  for (const k of NAMES) assert.deepEqual(mediumpMissing(POST_EFFECT_SHADERS[k][1], POST_MEDIUMP[k]), [], k);
});

test('off (the switch read as the 3D view starts): nothing about the shaders changes', () => {
  assert.equal(gpuState.mp, false);
  for (const k of NAMES) assert.ok(POST_EFFECT_SHADERS[k][1].includes(MEDIUMP_FROM), k);
});

test('on: mediump by default, every edit applied, the vertex shader as it was', () => {
  for (const k of NAMES) {
    const [vs, fs] = POST_EFFECT_SHADERS[k],
      m = mediumpFragment(fs, POST_MEDIUMP[k]);
    assert.ok(m.includes(MEDIUMP_TO) && !m.includes(MEDIUMP_FROM), k);
    for (const [, b] of POST_MEDIUMP[k]) assert.ok(m.includes(b), `${k}: ${b}`);
    assert.ok(m.includes('in highp vec2 vUV;'), `${k}: the screen place stays highp`);
    assert.ok(vs.startsWith('#version 300 es\nprecision highp float;'), k);
  }
});

test('on: what must stay highp does (time, depth, the hashes, the sun on screen)', () => {
  const g = mediumpFragment(POST_EFFECT_SHADERS.grade[1], POST_MEDIUMP.grade);
  assert.match(g, /uniform highp float uTime,uNear,uFar;/);
  assert.match(g, /uniform highp sampler2D uDep;/);
  assert.match(g, /uniform mediump sampler2D uCol,uDof,uBloom,uAO,uRays,uVol;/);
  assert.match(g, /highp float linz\(highp float d\)\{highp float z=/);
  assert.match(g, /highp float gh\(highp vec3 p\)/);
  assert.match(g, /\{highp vec2 q=floor\(gl_FragCoord\.xy\);/);
  assert.match(g, /uniform highp vec3 uSunP;/);
  // every uniform declared once, and none lost
  const names = s =>
    [...s.matchAll(/uniform\s+(?:highp\s+|mediump\s+)?\w+\s+([^;]+);/g)]
      .flatMap(m => m[1].split(','))
      .map(n => n.trim().replace(/\[.*\]$/, ''))
      .sort();
  assert.deepEqual(names(g), names(POST_EFFECT_SHADERS.grade[1]));
  const r = mediumpFragment(POST_EFFECT_SHADERS.rays[1], POST_MEDIUMP.rays);
  assert.match(r, /highp float h\(highp vec2 p\)/);
  assert.match(r, /uniform highp sampler2D uDep;/);
  assert.deepEqual(names(r), names(POST_EFFECT_SHADERS.rays[1]));
});

test('a list that no longer matches leaves the shader as it was', () => {
  const fs = '#version 300 es\nprecision highp float;out vec4 o;void main(){o=vec4(1.);}';
  assert.equal(mediumpFragment(fs, [['nowhere', 'x']]), fs);
  assert.equal(mediumpFragment(fs, []), fs.replace(MEDIUMP_FROM, MEDIUMP_TO));
  // a replacement with $ in it is taken as written
  assert.equal(mediumpFragment(fs, [['o=vec4(1.);', 'o=vec4($&);']]).includes('o=vec4($&);'), true);
});

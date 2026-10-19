// Phase 20, stage A: the GPU counters (game/js/engine/gpu-counters.js) on a stand-in context: what each call adds to
// which pass, and that switching off leaves the context exactly as it was. No graphics; nothing here draws.
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window ??= globalThis;
globalThis.document ??= {};
/* the module's names through the test globals (game/js/test-globals.js): npm run modules exports only what the page's
   other modules import */
globalThis.PB_TEST_GLOBALS = true;
await import('../../game/js/engine/gpu-counters.js');
const G = globalThis;
const { countersOn, countersOff, gpuPass, gpuCounters, gpuFrameDone, gpuCountSummary, gpuCountBegin, gpuCountEnd } = G;

/* a stand-in WebGL2 context: methods on its prototype, as a browser's are, each logging that it ran */
class FakeGL {
  constructor() {
    this.ran = [];
  }
}
const C = { RGBA: 1, RGB: 2, RG: 3, RED: 4, UNSIGNED_BYTE: 10, FLOAT: 11, HALF_FLOAT: 12, UNSIGNED_SHORT_5_6_5: 13 };
Object.assign(FakeGL.prototype, C);
for (const k of [
  'drawArrays',
  'drawElements',
  'drawArraysInstanced',
  'drawElementsInstanced',
  'useProgram',
  'bindTexture',
  'bindVertexArray',
  'texImage2D',
  'texSubImage2D',
  'bufferData',
  'bufferSubData',
  'uniform1f',
  'uniform3fv',
  'uniformMatrix4fv',
  'uniformBlockBinding',
  'getError',
])
  FakeGL.prototype[k] = function (...a) {
    this.ran.push(k);
    return a.length;
  };

const sumOf = (pass, field) =>
  gpuCounters.last[G.GPU_PASSES.indexOf(pass) * G.GPU_FIELDS.length + G.GPU_FIELDS.indexOf(field)];

test('each call counts in the pass it was made in, and still runs', () => {
  const gl = new FakeGL();
  assert.equal(countersOn(gl), true);
  gl.useProgram('a');
  gl.drawArrays(4, 0, 6);
  gpuPass('sprites');
  gl.useProgram('a'); /* the same program: no switch */
  gl.useProgram('b');
  gl.bindTexture(1, 't');
  gl.bindVertexArray('v');
  gl.uniform1f('u', 1);
  gl.uniform3fv('u', [1, 2, 3]);
  gl.uniformMatrix4fv('u', false, []);
  gl.uniformBlockBinding('p', 0, 0); /* sets no value: not a uniform call */
  gl.drawArraysInstanced(4, 0, 6, 40);
  gl.drawElementsInstanced(4, 6, 5123, 0, 7);
  gl.drawElements(4, 6, 5123, 0);
  gpuPass('shadowFar');
  gl.drawArrays(4, 0, 3);
  gpuPass('no such pass');
  gl.drawArrays(4, 0, 3);
  countersOff();
  gpuFrameDone(1000);
  assert.equal(gl.ran.length, 15);
  assert.equal(sumOf('other', 'draws'), 2);
  assert.equal(sumOf('other', 'programs'), 1);
  assert.equal(sumOf('sprites', 'programs'), 1);
  assert.equal(sumOf('sprites', 'draws'), 3);
  assert.equal(sumOf('sprites', 'instances'), 47);
  assert.equal(sumOf('sprites', 'uniforms'), 3);
  assert.equal(sumOf('sprites', 'textures'), 1);
  assert.equal(sumOf('sprites', 'vaos'), 1);
  assert.equal(sumOf('shadowFar', 'draws'), 1);
  const s = gpuCountSummary();
  assert.deepEqual(s.dc, [6, 47, 2, 1, 3]);
  assert.deepEqual(s.dcp, { other: 2, sprites: 3, shadowFar: 1 });
});

test('uploads count their bytes, in both argument forms', () => {
  const gl = new FakeGL();
  countersOn(gl);
  gl.texImage2D(0, 0, 0, 16, 8, 0, C.RGBA, C.UNSIGNED_BYTE, null); /* 512 */
  gl.texImage2D(0, 0, 0, C.RGBA, C.UNSIGNED_BYTE, { width: 32, height: 32 }); /* 4096 */
  gl.texImage2D(0, 0, 0, 4, 4, 0, C.RGBA, C.HALF_FLOAT, null); /* 128 */
  gl.texSubImage2D(0, 0, 0, 0, 2, 2, C.RGB, C.UNSIGNED_SHORT_5_6_5, null); /* 8 */
  gl.texSubImage2D(0, 0, 0, 0, C.RGBA, C.UNSIGNED_BYTE, { videoWidth: 10, videoHeight: 10, width: 300 }); /* 400 */
  gl.bufferData(0, new Float32Array(256), 0); /* 1024 */
  gl.bufferData(0, 2048, 0);
  gl.bufferSubData(0, 0, new Float32Array(100), 0, 10); /* 40 */
  countersOff();
  gpuFrameDone(2000);
  assert.equal(sumOf('other', 'texBytes'), 512 + 4096 + 128 + 8 + 400);
  assert.equal(sumOf('other', 'bufBytes'), 1024 + 2048 + 40);
});

test('off leaves the context as it was: plain methods again, a wrapper that was there kept', () => {
  const gl = new FakeGL();
  let seen = 0;
  const theirs = function (...a) {
    seen++;
    return FakeGL.prototype.drawArrays.apply(gl, a);
  };
  gl.drawArrays = theirs; /* a test's own wrapper (the full test's light lab does this) */
  countersOn(gl);
  assert.notEqual(gl.drawArrays, theirs);
  gl.drawArrays(4, 0, 3);
  assert.equal(seen, 1);
  countersOff();
  assert.equal(gl.drawArrays, theirs);
  delete gl.drawArrays;
  assert.deepEqual(Object.keys(gl), ['ran']);
  countersOn(gl);
  assert.ok(Object.keys(gl).length > 10);
  assert.equal(countersOn(gl), false, 'a second on while counting is refused');
  countersOff();
  assert.deepEqual(Object.keys(gl), ['ran']);
  assert.equal(countersOff(), null);
});

test('calls made while counting is off are not counted', () => {
  const gl = new FakeGL();
  countersOn(gl);
  gl.drawArrays(4, 0, 3);
  countersOff();
  gl.drawArrays(4, 0, 3);
  gl.uniform1f('u', 1);
  gpuFrameDone(3000);
  assert.deepEqual(gpuCountSummary().dc, [1, 0, 0, 0, 0]);
});

test('a test gets the average per counted frame, and the scheduler counts every tick while it asks', () => {
  const gl = new FakeGL();
  gpuCounters.lastT = 5000;
  assert.equal(G.gpuCountDue(5500), false);
  assert.equal(G.gpuCountDue(6000), true);
  gpuCountBegin();
  assert.equal(G.gpuCountDue(5001), true);
  for (const n of [2, 4]) {
    countersOn(gl);
    gpuPass('ground');
    for (let i = 0; i < n; i++) gl.drawArrays(4, 0, 3);
    countersOff();
    gpuFrameDone(5001);
  }
  const s = gpuCountEnd();
  assert.equal(s.frames, 2);
  assert.deepEqual(s.dc, [3, 0, 0, 0, 0]);
  assert.deepEqual(s.dcp, { ground: 3 });
  assert.equal(gpuCounters.want, 0);
});

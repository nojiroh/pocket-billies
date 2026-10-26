// Phase 20 H1-H3: the GPU resource registry (engine/webgl.js gpuMake ... gpuMemory) on a stand-in context. No graphics:
// the context hands out plain objects and records what was deleted.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import './walk-renderer.mjs';

const G = globalThis;

/* a context that makes numbered handles and keeps the deleted ones */
function handleGL() {
  let n = 0;
  const deleted = [],
    gl = new Proxy(
      { deleted, lost: false, isContextLost: () => gl.lost },
      {
        get(o, k) {
          if (k in o) return o[k];
          if (typeof k !== 'string') return undefined;
          if (k.startsWith('create')) return () => ({ id: ++n, of: k.slice(6) });
          if (k.startsWith('delete')) return h => deleted.push(h.id);
          return () => null;
        },
      }
    );
  return gl;
}
/* runs f with a fresh stand-in context of its own generation, the engine's state put back after */
function withGL(f) {
  const S = G.gpuState,
    was = { gl: S.gl, lost: S.lost, gen: S.gen },
    gl = handleGL();
  Object.assign(S, { gl, lost: 0 });
  G.gpuNewGeneration();
  try {
    return f(gl);
  } finally {
    Object.assign(S, was);
    G.gpuNewGeneration();
  }
}

test('objects are counted by kind with their bytes, and freed objects are deleted and counted off', () =>
  withGL(gl => {
    const b = G.gpuBuffer('meshes', 1000),
      t = G.gpuTexture('pictures', 4096),
      v = G.gpuVao('meshes');
    assert.equal(b.of, 'Buffer');
    assert.equal(v.of, 'VertexArray');
    assert.deepEqual(G.gpuRes.n.meshes, 2);
    assert.equal(G.gpuRes.bytes.meshes, 1000);
    G.gpuSized(b, 3000);
    assert.equal(G.gpuRes.bytes.meshes, 3000);
    G.gpuFree(b);
    G.gpuFree(b);
    assert.deepEqual(gl.deleted, [b.id], 'deleted once');
    assert.equal(G.gpuRes.n.meshes, 1);
    assert.equal(G.gpuRes.bytes.meshes, 0);
    const M = G.gpuMemory();
    assert.deepEqual(M.pictures, { mb: 0, n: 1, dropped: 0 });
    assert.equal(M.programs, undefined, 'kinds with nothing are left out');
    G.gpuFree(t);
    G.gpuFree(v);
    assert.equal(G.gpuRes.n.meshes, 0);
  }));

test('an unknown kind counts as other; a shader counts with the programs', () =>
  withGL(() => {
    G.gpuBuffer('nonsense', 8);
    G.gpuShader('VERTEX_SHADER');
    assert.equal(G.gpuRes.n.other, 1);
    assert.equal(G.gpuRes.n.programs, 1);
  }));

test('a retired object is freed two frame ticks later (H2)', () =>
  withGL(gl => {
    const b = G.gpuBuffer('instances', 64);
    G.gpuRetire(b);
    assert.equal(G.gpuFrame(), true);
    assert.deepEqual(gl.deleted, []);
    G.gpuFrame();
    assert.deepEqual(gl.deleted, [b.id]);
    assert.equal(G.gpuRes.n.instances, 0);
  }));

test("objects of an older generation are only forgotten: a restored context doesn't know them", () =>
  withGL(gl => {
    const b = G.gpuBuffer('meshes', 100);
    G.gpuNewGeneration();
    assert.equal(G.gpuRes.n.meshes, 0, 'a new generation starts empty');
    G.gpuFree(b);
    assert.deepEqual(gl.deleted, []);
    assert.equal(G.gpuRes.n.meshes, 0);
  }));

test('a context that dies before its lost event is noticed by the next frame tick', () =>
  withGL(gl => {
    const b = G.gpuBuffer('meshes', 100);
    G.gpuRetire(b, 0);
    gl.lost = true;
    assert.equal(G.gpuFrame(), false);
    assert.equal(G.gpuState.lost, 1);
    assert.deepEqual(gl.deleted, [], 'nothing deleted on a lost context');
  }));

test('a restore bumps the generation and runs every owner’s drop once (gpuOnRestore)', () => {
  const ran = [],
    cv = {
      on: {},
      addEventListener(k, f) {
        (this.on[k] ||= []).push(f);
      },
    },
    was = { back: G.onGlContextRestored, gen: G.gpuState.gen };
  G.gpuOnRestore('test-a', () => ran.push('a'));
  G.gpuOnRestore('test-b', () => {
    throw new Error('one owner failing');
  });
  G.gpuOnRestore('test-c', () => ran.push('c'));
  G.onGlContextRestored = () => ran.push('walk');
  G.watchContextLoss(cv);
  try {
    for (const f of cv.on.webglcontextrestored) f();
    assert.deepEqual(ran, ['a', 'c', 'walk'], 'the owners first, a failing one skipped, then the walk view');
    assert.equal(G.gpuState.gen, was.gen + 1);
  } finally {
    for (const k of ['test-a', 'test-b', 'test-c']) G.gpuRes.restore.delete(k);
    G.onGlContextRestored = was.back;
    G.gpuState.lost = 0;
  }
});

test("the engine's own objects go through it: a render target resized frees the old one, a mesh freed counts off", () =>
  withGL(gl => {
    const fb = G.gpuState.fb;
    G.gpuState.fb = {};
    try {
      const A = G.renderTarget('t', 4, 2, { depth: true });
      assert.equal(G.gpuRes.n.targets, 3, 'framebuffer, colour, depth');
      assert.equal(G.gpuRes.bytes.targets, 4 * 2 * 4 * 2);
      G.renderTarget('t', 8, 2, { depth: true });
      assert.deepEqual(gl.deleted.sort(), [A.f.id, A.c.id, A.d.id].sort());
      assert.equal(G.gpuRes.n.targets, 3);
      const m = G.uploadMesh(new Float32Array(6), new Uint16Array(3), [['aPos', 3, 0]], 12, 'ground');
      assert.deepEqual([G.gpuRes.n.ground, G.gpuRes.bytes.ground], [3, 24 + 6]);
      G.freeMesh(m);
      assert.deepEqual([G.gpuRes.n.ground, G.gpuRes.bytes.ground], [0, 0]);
    } finally {
      G.gpuState.fb = fb;
    }
  }));

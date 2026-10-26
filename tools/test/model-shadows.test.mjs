// Phase 20 R3 (shadows lane): the shadow maps' models instanced (game/js/prop-models.js drawPropModelShadows with
// Engine > Quality "Shadows in batches" on) send what the one-at-a-time voxS loop sends: on a stand-in WebGL context,
// every (item, mesh part) the old loop draws is drawn once by voxSI, from a record whose decoded values equal the old
// uniforms (as 32-bit floats), turning parts with the same turns, voxel props and low-poly models each in their own
// mesh layout, in vertex arrays of the shadows' own. No graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './walk-renderer.mjs';
await import('../../game/js/prop-models.js');

const G = globalThis;
const { gpuState, walkView, engineContext, MODEL_INSTANCE_ATTRIBS, MODEL_INSTANCE_BYTES, readModelInstance } = G;

function namingGL() {
  const calls = [],
    n = {};
  const copy = a =>
    ArrayBuffer.isView(a)
      ? new Uint8Array(a.buffer, a.byteOffset, a.byteLength).slice()
      : Array.isArray(a)
        ? [...a]
        : a;
  return new Proxy(
    { calls },
    {
      get(o, k) {
        if (k in o) return o[k];
        if (typeof k !== 'string') return undefined;
        if (/^[A-Z_0-9]+$/.test(k)) return k;
        return (...args) => {
          calls.push([k, ...args.map(copy)]);
          if (k.startsWith('create')) return `${k.slice(6)}#${(n[k] = (n[k] || 0) + 1)}`;
          return null;
        };
      },
    }
  );
}
const prog = (p, names) => ({ p, U: Object.fromEntries(names.map(k => [k, k])) });
const part = (name, o = {}) => ({ vao: name, n: 36, el: 1, u32: false, bufs: [name + ':vb', name + ':eb'], ...o });
const spinPart = (name, a, c, rps, sw) => part(name, { a, c, rps, sw });
function meshes() {
  return {
    lamp: { ...part('lamp'), q: 1 / 32, spins: [] },
    mill: {
      ...part('mill'),
      q: 1 / 32,
      spins: [
        spinPart('mill.sail', [0, 0, 1], [0, 2, 0.3], 0.5, 0),
        spinPart('mill.sail2', [1, 0, 0], [0, 2.5, 0], 1.5, 0),
      ],
    },
    house: { ...part('house'), model: 1, q: 1 / 256, spins: [] },
    tree: { ...part('tree'), model: 1, q: 1 / 256, more: [part('tree.b'), part('tree.c')], spins: [] },
    ship: {
      ...part('ship'),
      model: 1,
      q: 1 / 256,
      more: [part('ship.b')],
      spins: [
        spinPart('ship.prop', [1, 0, 0], [0, 1, -2], 2, 0),
        spinPart('ship.swing', [0, 0, 1], [1, 0, 0], 0.3, 0.4),
      ],
    },
    arr: { ...part('arr', { el: 0 }), q: 1 / 16, spins: [] },
  };
}
function items() {
  const M = meshes(),
    it = (x, mesh, o) => ({
      k: 'prop',
      x,
      y: 0.25 + x / 100,
      z: 3 + x / 7,
      p: { s: 1 },
      M: {},
      vox: { mesh },
      voxPath: 'm' + x,
      ...o,
    });
  return [
    it(1, M.lamp, { glow: 0.6 }),
    it(2, M.mill, { p: { s: 1.3, rot: 45 }, flip: -1 }),
    it(3, M.lamp, { vis: false }),
    it(4, M.mill, { spin: { a: [0, 0, 1], an: 0.4, c: [0, 1, 0] } }),
    it(10, M.house, { lk: { size: 1.1, rot: 0.2 } }),
    it(11, M.tree, { lk: { size: 0.9, rot: 0.1 }, flip: -1, p: { s: 2, rot: 90 } }),
    it(12, M.ship, { M: { bob: 0.3 } }),
    it(13, M.tree, {}),
    it(15, M.ship, { M: { bob: 0.2 }, spin: { a: [1, 0, 0], an: 1.2, c: [0, 0.5, 0] } }),
    it(16, M.arr, {}),
    { k: 'prop', x: 20, z: 1, y: 0, p: {}, M: {} },
  ];
}
const NAMES = ['uVP', 'uCurve', 'uCurveD0', 'uBase', 'uS', 'uRot', 'uFlip', 'uQ', 'uSpin', 'uSpinC', 'uPart'];
function setup(on) {
  const gl = namingGL();
  gpuState.gl = gl;
  // every model program there already (nothing compiles on a stand-in)
  gpuState.P = Object.fromEntries(Object.keys(G.PROP_MODEL_SHADERS).map(k => [k, prog(k, NAMES)]));
  gpuState.P.voxSI = prog('voxSI', NAMES);
  G.propModelState.fail = 0;
  walkView.t = 98765;
  walkView.sc = { w: 64, h: 64, wind: 1 };
  engineContext.look = { quality: { shadowInstances: on }, world: { curve: 0.001, voxelProps: true } };
  G.propModelMesh = (path, rec) => rec.mesh;
  return gl;
}
const UNIFORM = /^uniform(\d)(f|i)v?$/;
const f32 = v => (Array.isArray(v) ? v.map(Math.fround) : Math.fround(v));
const SH = { vp: 'sun' };

function oldDraws(L) {
  const gl = setup(false);
  G.drawPropModelShadows(SH, L);
  const st = {},
    out = new Map();
  let vao = null;
  for (const [k, ...a] of gl.calls) {
    if (UNIFORM.test(k)) st[a[0]] = a.length === 2 ? a[1] : a.slice(1);
    else if (k === 'bindVertexArray') vao = a[0];
    else if (k === 'drawElements' || k === 'drawArrays') {
      const key = `${vao}|${st.uBase[0]}`;
      assert.ok(!out.has(key), key);
      out.set(key, {
        uBase: st.uBase,
        uS: st.uS,
        uRot: st.uRot,
        uFlip: st.uFlip,
        uQ: st.uQ,
        uSpin: st.uSpin,
        uSpinC: st.uSpinC,
      });
    }
  }
  return { out, gl };
}
function newDraws(L) {
  const gl = setup(true);
  G.drawPropModelShadows(SH, L);
  const parts = new Map();
  for (const it of L)
    if (it.vox) for (const q of [it.vox.mesh, ...(it.vox.mesh.more || []), ...it.vox.mesh.spins]) parts.set(q.sivao, q);
  const st = {},
    ptr = {},
    out = new Map(),
    layouts = new Map();
  let F = null,
    UI = null,
    vao = null,
    draws = 0;
  for (const [k, ...a] of gl.calls) {
    if (k === 'useProgram') assert.equal(a[0], 'voxSI');
    if (UNIFORM.test(k)) st[a[0]] = a.length === 2 ? a[1] : a.slice(1);
    else if (k === 'bufferData' && a[0] === 'ARRAY_BUFFER') {
      const b = a[1].slice().buffer;
      F = new Float32Array(b);
      UI = new Uint32Array(b);
    } else if (k === 'bindVertexArray') vao = a[0];
    else if (k === 'vertexAttribPointer' || k === 'vertexAttribIPointer') {
      ptr[a[0]] = a.at(-1);
      // a mesh attribute while its vertex array is made: the layout it was given (location 0's stride)
      if (a[0] === 0) layouts.set(vao, a[4]);
    } else if (k === 'createVertexArray') vao = null;
    else if (k === 'drawElementsInstanced' || k === 'drawArraysInstanced') {
      draws++;
      const at = ptr[5] / MODEL_INSTANCE_BYTES,
        count = k === 'drawElementsInstanced' ? a[4] : a[3],
        q = parts.get(vao);
      assert.ok(q, 'a part of the shadows’ own vertex arrays');
      for (const [loc, , f] of MODEL_INSTANCE_ATTRIBS.vox) assert.equal(ptr[loc], at * MODEL_INSTANCE_BYTES + f * 4);
      assert.ok(!(10 in ptr), 'only the five placing attributes');
      for (let j = at; j < at + count; j++) {
        const r = readModelInstance(F, UI, j),
          sp = st.uPart === 1;
        const key = `${q.vao}|${r.pos[0]}`;
        assert.ok(!out.has(key), key);
        out.set(key, {
          uBase: r.pos,
          uS: r.s,
          uRot: r.rot,
          uFlip: r.flip,
          uQ: f32(st.uQ),
          uSpin: sp ? f32(st.uSpin) : r.spin,
          uSpinC: sp ? f32(st.uSpinC) : r.spinC,
        });
      }
    }
  }
  return { out, draws, layouts, gl };
}

test('every item’s every part drawn once, with the old uniforms’ values; one draw per mesh part', () => {
  const { out: O } = oldDraws(items());
  const { out: N, draws } = newDraws(items());
  assert.deepEqual([...N.keys()].sort(), [...O.keys()].sort());
  for (const [key, o] of O) for (const n of Object.keys(o)) assert.deepEqual(N.get(key)[n], f32(o[n]), `${key} ${n}`);
  const M = new Set(
    items()
      .filter(it => it.vox)
      .map(it => it.vox.mesh.vao)
  );
  assert.equal(M.size, 6);
  assert.equal(
    draws,
    1 + 3 + 1 + 3 + 4 + 1,
    'lamp, mill and its sails, house, tree and two parts, ship (part, two spins), arr'
  );
  assert.ok(draws < O.size);
});

test('the fixture means something: bobs, turns, spins and an item not shown (the shadows draw it as before)', () => {
  const { out: O } = oldDraws(items());
  assert.ok(O.has('lamp|3'), 'vis false still casts, as before');
  assert.notEqual(O.get('ship|12').uBase[1], 0.25 + 12 / 100, 'the airship bobs');
  assert.notEqual(O.get('ship.prop|12').uSpin[3], 0);
  assert.deepEqual(O.get('mill|4').uSpin, [0, 0, 1, 0.4]);
  assert.equal(O.get('tree.b|11').uFlip, -1);
});

test('voxel props and low-poly models in their own mesh layouts, in vertex arrays apart from the main pass’s', () => {
  const L = items(),
    { layouts, out } = newDraws(L),
    by = new Map();
  assert.ok(out.size);
  for (const it of L) if (it.vox) by.set(it.vox.mesh.sivao, it.vox.mesh);
  for (const [v, m] of by) {
    assert.equal(layouts.get(v), m.model ? 24 : 16, m.vao);
    assert.equal(m.ivao, undefined, 'the main pass’s vertex array untouched');
  }
});

test('voxSI: depth only, the main pass’s placing, the placing attributes alone', () => {
  const [vs, fs] = G.MODEL_SHADOW_SHADERS.voxSI;
  assert.equal(fs, G.PROP_MODEL_SHADERS.voxS[1]);
  assert.ok(!/\bout\b/.test(vs.replace(/gl_Position/g, '')), 'no outputs');
  const locs = [...vs.matchAll(/layout\(location=(\d+)\) in (\w+) i\w+;/g)].map(m => +m[1]);
  assert.deepEqual(
    locs,
    MODEL_INSTANCE_ATTRIBS.vox.map(a => a[0])
  );
  for (const v of G.voxInstancedShaders()[0].match(/vec4 S=uPart[^`]*?curveY\(iPos\.xz\);/)) assert.ok(vs.includes(v));
});

test('a flush drops the shadows’ record buffer and their vertex arrays too', () => {
  const L = items();
  newDraws(L);
  const S = G.MODEL_SHADOW_INSTANCES;
  assert.ok(S.buf);
  for (const it of L) if (it.vox) G.propModelState.meshes.set('test:' + it.vox.mesh.vao, it.vox.mesh);
  const gl = gpuState.gl;
  G.flushPropModelMeshes();
  assert.equal(S.buf, null);
  const del = gl.calls.filter(c => c[0] === 'deleteVertexArray').map(c => c[1]);
  for (const it of L) if (it.vox) assert.ok(del.includes(it.vox.mesh.sivao), it.vox.mesh.vao);
});

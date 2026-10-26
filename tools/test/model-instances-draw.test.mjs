// Phase 20 R2 (models lane): the instanced models (game/js/prop-models.js drawModelInstances, "Models in batches")
// send the card exactly what the one-at-a-time loops (drawVoxItems, drawLowPolyItems) send: on a stand-in WebGL
// context, every (item, mesh part) the old loops draw with a set of uniforms is drawn once by the new path, from a
// record whose decoded values equal those uniforms (as 32-bit floats), with the same turning parts' turns; the
// instanced shaders' flat values and attributes line up with the records. No graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './walk-renderer.mjs';
await import('../../game/js/prop-models.js');

const G = globalThis;
const {
  gpuState,
  walkView,
  walkRenderer,
  propModelState,
  drawVoxItems,
  drawLowPolyItems,
  drawModelInstances,
  propModelShaders,
  voxInstancedShaders,
  lowPolyInstancedShaders,
  PROP_MODEL_SHADERS,
  MODEL_INSTANCE_ATTRIBS,
  MODEL_INSTANCE_BYTES,
  readModelInstance,
} = G;

// a context that records every call and gives each created object its own name
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
const U = names => ({ p: 'prog', U: Object.fromEntries(names.map(k => [k, k])) });
const part = (name, o = {}) => ({ vao: name, n: 36, el: 1, u32: false, bufs: [name + ':vb', name + ':eb'], ...o });
const spinPart = (name, a, c, rps, sw) => part(name, { a, c, rps, sw });

// meshes: a voxel lamp, a voxel windmill (two turning sails), a house, a tree with two extra parts, an airship with a
// propeller and a part that swings, a pyramid
const M = {
  lamp: { ...part('lamp'), q: 1 / 32, spins: [] },
  mill: {
    ...part('mill'),
    q: 1 / 32,
    spins: [
      spinPart('mill.sail', [0, 0, 1], [0, 2, 0.3], 0.5, 0),
      spinPart('mill.sail2', [1, 0, 0], [0, 2.5, 0], 1.5, 0),
    ],
  },
  house: { ...part('house'), model: 1, q: 1 / 256, spins: [], wins: [] },
  tree: { ...part('tree'), model: 1, q: 1 / 256, more: [part('tree.b'), part('tree.c')], spins: [] },
  ship: {
    ...part('ship'),
    model: 1,
    q: 1 / 256,
    more: [part('ship.b')],
    spins: [spinPart('ship.prop', [1, 0, 0], [0, 1, -2], 2, 0), spinPart('ship.swing', [0, 0, 1], [1, 0, 0], 0.3, 0.4)],
  },
  pyr: { ...part('pyr'), model: 1, q: 1 / 256, spins: [] },
};
const look = (k, size) => ({
  size,
  rot: 0.1 * k,
  wear: [0.1 * k, 0.2, 0.05, 0.3],
  hsv: [0.02 * k, -0.1, 0.15, 1],
  tint: [1, 0.8, 0.7, 0.4],
  mask: [0.25, 0.08],
});
const win = (id, x) => ({ id, p: [x, 1.5, 2], n: [0, 0, 1] });
function items() {
  const it = (x, o) => ({ x, y: 0.25 + x / 100, z: 3 + x / 7, p: { s: 1 }, M: {}, ...o });
  return {
    vox: [
      [it(1, { glow: 0.6, fade: 0.5 }), M.lamp],
      [it(2, { p: { s: 1.3, rot: 45 }, flip: -1 }), M.mill],
      [it(3, {}), M.lamp],
      [it(4, { spin: { a: [0, 0, 1], an: 0.4, c: [0, 1, 0] } }), M.mill],
    ],
    mdl: [
      [it(10, { wins: [win(3, 1), win(31, -1), win(0, 0.5)], lk: look(1, 1.1), vox: { cel: 0.4 } }), M.house],
      [it(11, { lk: look(2, 0.9), flip: -1, p: { s: 2, rot: 90 } }), M.tree],
      [it(12, { M: { bob: 0.3 }, vox: {} }), M.ship],
      [it(13, { fade: 0.25 }), M.tree],
      [it(14, { wins: [win(5, 0)], lk: look(3, 1) }), M.house],
      [it(15, { M: { bob: 0.2 }, spin: { a: [1, 0, 0], an: 1.2, c: [0, 0.5, 0] } }), M.ship],
      [it(16, { spin: { a: [0.6, 0, 0.8], an: -2, c: [0, 0.1, 0] } }), M.pyr],
      [it(17, {}), M.tree],
    ],
  };
}
function setup() {
  const gl = namingGL();
  gpuState.gl = gl;
  walkView.t = 98765;
  walkView.sc = { w: 64, h: 64, wind: 1 };
  walkRenderer.dark = 1;
  return gl;
}
const f32 = v => (Array.isArray(v) ? v.map(Math.fround) : Math.fround(v));
const VOX_NAMES = ['uBase', 'uS', 'uRot', 'uFlip', 'uBaseP', 'uFade', 'uEmit', 'uQ', 'uSpin', 'uSpinC'];
const MDL_NAMES = [
  'uBase',
  'uS',
  'uRot',
  'uFlip',
  'uFade',
  'uBaseY',
  'uCel',
  'uWear',
  'uHsv',
  'uLkTint',
  'uMaskH',
  'uBP',
  'uWinK',
  'uWinOn',
  'uWinSeed',
  'uSpin',
  'uSpinC',
];
const UNIFORM = /^uniform(\d)(f|i)v?$/;

// the old loops: each draw's part and the uniforms in force, keyed by part and item (its x)
function oldDraws(kind, L) {
  const gl = setup(),
    names = kind === 'vox' ? VOX_NAMES : MDL_NAMES;
  (kind === 'vox' ? drawVoxItems : drawLowPolyItems)(U(names), L);
  const st = {},
    out = new Map();
  let vao = null;
  for (const [k, ...a] of gl.calls) {
    if (UNIFORM.test(k))
      st[a[0]] = a.length === 2 && !Array.isArray(a[1]) ? a[1] : Array.isArray(a[1]) ? a[1] : a.slice(1);
    else if (k === 'bindVertexArray') vao = a[0];
    else if (k === 'drawElements') {
      const key = `${vao}|${st.uBase[0]}`;
      assert.ok(!out.has(key), key);
      out.set(key, Object.fromEntries(names.map(n => [n, st[n]])));
    }
  }
  return out;
}
// the new path: each instanced draw's part (by the instanced vertex array each part was given) and its records
function newDraws(kind, L) {
  const gl = setup(),
    P = U(['uPart', 'uSpin', 'uSpinC', 'uQ']);
  drawModelInstances(P, kind, L);
  const parts = new Map();
  for (const [, m] of L) for (const q of [m, ...(m.more || []), ...(m.spins || [])]) parts.set(q.ivao, q.vao);
  const st = {},
    ptr = {},
    out = new Map();
  let F = null,
    UI = null,
    vao = null,
    draws = 0;
  for (const [k, ...a] of gl.calls) {
    if (UNIFORM.test(k))
      st[a[0]] = a.length === 2 && !Array.isArray(a[1]) ? a[1] : Array.isArray(a[1]) ? a[1] : a.slice(1);
    else if (k === 'bufferData' && a[0] === 'ARRAY_BUFFER') {
      const b = a[1].slice().buffer;
      F = new Float32Array(b);
      UI = new Uint32Array(b);
    } else if (k === 'bindVertexArray') vao = a[0];
    else if (k === 'vertexAttribPointer' || k === 'vertexAttribIPointer') ptr[a[0]] = a.at(-1);
    else if (k === 'drawElementsInstanced') {
      draws++;
      const at = ptr[5] / MODEL_INSTANCE_BYTES,
        count = a[4];
      assert.equal(ptr[5] % MODEL_INSTANCE_BYTES, 0);
      for (const [loc, , f] of MODEL_INSTANCE_ATTRIBS[kind])
        assert.equal(ptr[loc], at * MODEL_INSTANCE_BYTES + f * 4, `location ${loc}`);
      for (let j = at; j < at + count; j++) {
        const r = readModelInstance(F, UI, j),
          part = st.uPart === 1;
        const v = {
          uBase: r.pos,
          uS: r.s,
          uRot: r.rot,
          uFlip: r.flip,
          uFade: r.fade,
          uSpin: part ? f32(st.uSpin) : r.spin,
          uSpinC: part ? f32(st.uSpinC) : r.spinC,
        };
        if (kind === 'vox') Object.assign(v, { uBaseP: r.base, uEmit: r.k, uQ: f32(st.uQ) });
        else
          Object.assign(v, {
            uBaseY: r.base[1],
            uCel: r.k,
            uWear: r.wear,
            uHsv: r.hsv,
            uLkTint: r.tint,
            uMaskH: r.mask,
            uBP: r.base,
            uWinK: r.winK,
            uWinOn: r.winOn,
            uWinSeed: r.seed,
          });
        const key = `${parts.get(vao)}|${r.base[0]}`;
        assert.ok(!out.has(key), key);
        out.set(key, v);
      }
    }
  }
  return { out, draws };
}

for (const kind of ['vox', 'mdl'])
  test(`${kind}: every item's every part drawn once, with the old uniforms' values`, () => {
    const A = items()[kind],
      B = items()[kind];
    const O = oldDraws(kind, A);
    propModelState.drawn = 0;
    propModelState.lowPoly = 0;
    const { out: N, draws } = newDraws(kind, B);
    assert.deepEqual([...N.keys()].sort(), [...O.keys()].sort());
    for (const [key, o] of O) {
      const n = N.get(key);
      for (const name of Object.keys(o)) {
        const want = name === 'uWinOn' ? o[name] >>> 0 : name === 'uQ' ? f32(o[name]) : f32(o[name]);
        assert.deepEqual(n[name], want, `${key} ${name}`);
      }
    }
    // one draw per mesh part, the items counted as before
    const meshes = new Set(A.map(e => e[1])),
      parts = [...meshes].reduce((s, m) => s + 1 + (m.more || []).length + m.spins.length, 0);
    assert.equal(draws, parts);
    assert.ok(draws < O.size);
    assert.equal(propModelState.drawn, A.length);
    assert.equal(propModelState.lowPoly, kind === 'mdl' ? A.length : 0);
  });

test('the windows were lit and the turns were real (the fixture means something)', () => {
  const O = oldDraws('mdl', items().mdl);
  const house = O.get('house|10');
  assert.ok(house.uWinOn & (1 << 31) && house.uWinOn & 8, 'window 31 and 3 lit');
  assert.ok(house.uWinK > 0 && house.uWinSeed > 0);
  assert.notEqual(O.get('ship.prop|12').uSpin[3], 0);
  assert.notEqual(O.get('ship|12').uBase[1], 12 / 100 + 0.25, 'the airship bobs');
  assert.deepEqual(O.get('pyr|16').uSpin, [0.6, 0, 0.8, -2]);
});

// the GLSL's declarations: [qualifier, type, name]
function decls(src, re) {
  const out = [];
  for (const m of src.matchAll(re)) for (const n of m[2].split(',')) out.push([m[1], n.trim()]);
  return out;
}
const SIZE = { vec4: [4, 0], vec3: [3, 0], uint: [1, 1] };
test('the instanced shaders: flat values passed under the old uniform names, attributes as the records', () => {
  propModelShaders();
  assert.ok(PROP_MODEL_SHADERS.mdl, 'the low-poly pair');
  for (const [kind, [vs, fs], plain] of [
    ['vox', voxInstancedShaders(), PROP_MODEL_SHADERS.vox],
    ['mdl', lowPolyInstancedShaders(), PROP_MODEL_SHADERS.mdl],
  ]) {
    const flatIn = decls(fs, /flat in (\w+) ([\w,]+);/g),
      flatOut = decls(vs, /flat out (\w+) ([\w,]+);/g);
    assert.ok(flatIn.length >= 3, kind);
    assert.deepEqual(flatOut.slice().sort(), flatIn.slice().sort(), kind);
    for (const [, n] of flatIn) {
      assert.ok(!new RegExp(`uniform [^;]*\\b${n}\\b`).test(fs), `${kind}: ${n} still a uniform`);
      assert.ok(new RegExp(`uniform [^;]*\\b${n}\\b`).test(plain[1]), `${kind}: ${n} a uniform in the plain shader`);
    }
    // the fragment shader is the plain one but for those declarations
    const strip = s => s.replace(/(uniform|flat in) [^;]*;/g, '');
    assert.equal(strip(fs), strip(plain[1]), kind);
    // instance attributes: locations, sizes and integer-ness as MODEL_INSTANCE_ATTRIBS
    const A = [...vs.matchAll(/layout\(location=(\d+)\) in (\w+) i\w+;/g)].map(m => [+m[1], ...SIZE[m[2]]]);
    assert.deepEqual(
      A,
      MODEL_INSTANCE_ATTRIBS[kind].map(([loc, n, , int]) => [loc, n, int])
    );
  }
});

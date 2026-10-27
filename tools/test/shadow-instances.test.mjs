// Phase 20 R3 (shadows lane, E9): with the shadow pictures as instances (the only path since R4), every shadow map (the sun's near and
// far maps, the far map's cache missed and hit, the lamps') draws the very quads the one-at-a-time path drew (shadow-loops-ref.mjs), the
// same pictures skipped and missed, one instanced draw per picture; everything else the passes do (the ground,
// buildings, structures, solid props, models, the cache's copies) stays in its place. A shadow map keeps depth only,
// so the order of its pictures can't change it: the quads are compared as sets per pass. No graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shadowFixture, shadowSetup, withOldShadowSprites } from './shadow-fixture.mjs';

const G = globalThis;
const { engineContext, SPRITE_INSTANCE_STRIDE, halfValue } = G;
const SUN = { travel: [0.4, -0.8, 0.45] };

// a run's calls split into the shadow pictures' quads (per picture loop) and the rest, in order
function split(calls) {
  const rest = [],
    loops = [];
  let prog = null,
    tex = null,
    bytes = null,
    first = 0,
    cur = null;
  const st = {};
  for (const [k, ...a] of calls) {
    // the instances are uploaded before their program is used
    if (k === 'bufferSubData') {
      bytes = Uint8Array.from(a[2]);
      continue;
    }
    if (k === 'useProgram') {
      prog = a[0];
      if (prog === 'shadow' || prog === 'shadowI') loops.push((cur = []));
      else cur = null;
      rest.push('useProgram ' + (prog === 'shadowI' ? 'shadow' : prog));
      continue;
    }
    if (prog !== 'shadow' && prog !== 'shadowI') {
      rest.push([k, ...a].join(' '));
      continue;
    }
    if (
      typeof k !== 'string' ||
      !/^[a-z]/.test(k) ||
      /^(sun|lamp|end|stale|target|ground|buildings|structures|solid|models)$/.test(k)
    ) {
      // a stand-in's note ends the picture loop
      rest.push([k, ...a].join(' '));
      prog = null;
      continue;
    }
    if (k === 'bindTexture') tex = a[1];
    else if (k.startsWith('uniform') && k !== 'uniformMatrix4fv') st[a[0]] = a.length > 2 ? a.slice(1) : a[1];
    else if (k === 'vertexAttribPointer' && a[0] === 1) first = a[5] / SPRITE_INSTANCE_STRIDE;
    else if (k === 'drawArrays' && a[2] === 6)
      cur.push(quad(tex, st.uBase, st.uOff, st.uUV[3], st.uFlip, st.uShear, st.uRight));
    else if (k === 'drawArraysInstanced') {
      const D = new DataView(bytes.buffer);
      for (let i = first; i < first + a[3]; i++) {
        const o = i * SPRITE_INSTANCE_STRIDE,
          f = j => D.getFloat32(o + j * 4, true),
          h = j => halfValue(D.getUint16(o + j * 2, true));
        cur.push(
          quad(tex, [f(0), f(1), f(2)], [f(3), f(4), f(5), f(6)], h(21), D.getUint8(o + 88) & 8 ? -1 : 1, h(19), [
            h(14),
            0,
            h(15),
          ])
        );
      }
    }
  }
  return { rest, loops: loops.map(L => L.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))) };
}
const f32 = v => Math.fround(v);
// a quad: its exact part as text (the picture, the base and size as 32-bit floats, the flip) and its halves
function quad(tex, base, off, shown, flip, shear, right) {
  return { key: [tex, ...base.map(f32), ...off.map(f32), flip].join(' '), halves: [shown, shear, right[0], right[2]] };
}
// two loops' quads equal: the same exact parts, each pair's halves within half precision (2^-11 of the value)
function sameQuads(A, B, what) {
  assert.deepEqual(
    A.map(q => q.key),
    B.map(q => q.key),
    what
  );
  A.forEach((q, i) =>
    q.halves.forEach((v, j) =>
      assert.ok(
        Math.abs(v - B[i].halves[j]) <= Math.max(1e-6, Math.abs(B[i].halves[j]) / 1024),
        `${what}: ${q.key} half ${j}`
      )
    )
  );
}
function both(run) {
  const a = shadowSetup();
  withOldShadowSprites(run);
  const old = split(a.calls);
  const b = shadowSetup();
  run();
  return { old, inst: split(b.calls), calls: b.calls };
}
const lamps = () => [
  { p: [2, 3, 2], r: 8 },
  { p: [6, 2.5, 5], r: 6 },
];
const cases = {
  'the sun: near, far missed then hit': () => {
    const L = shadowFixture();
    G.shadowPass(L, SUN, null);
    G.shadowPass(L, SUN, null);
  },
  'the sun overhead, no cache, one cascade': () => {
    engineContext.look.quality.shadowCache = false;
    engineContext.look.shadows.cascades = false;
    G.shadowPass(shadowFixture(), { travel: [0, -1, 0.01] }, null);
  },
  "the lamps' maps": () => {
    G.LAMP_SHADOWED.length = 0;
    G.lampShadowMaps(shadowFixture(), { lights: lamps() }, 1);
  },
  'buildings as pictures (no 3D walls)': () => {
    engineContext.look.shadows.buildings = false;
    G.shadowPass(shadowFixture(), SUN, null);
  },
};
for (const [name, run] of Object.entries(cases))
  test(`${name}: the same quads in each picture loop, the rest in place`, () => {
    const { old, inst, calls } = both(run);
    assert.equal(inst.loops.length, old.loops.length);
    assert.ok(old.loops.some(L => L.length));
    inst.loops.forEach((L, i) => sameQuads(L, old.loops[i], `picture loop ${i}`));
    // the stand-ins' turns and the cache's copies in the same order (the loops' own set-up aside)
    const keep = r =>
      r.filter(
        c =>
          !/^(createVertexArray|createBuffer|bufferData|bindVertexArray|bindBuffer|enableVertexAttribArray|vertexAttribPointer|disableVertexAttribArray|vertexAttribDivisor|activeTexture|uniform1i uTex|uniformMatrix4fv uVP|uniform3f uCurve|uniform1f uCurveD0)/.test(
            c
          )
      );
    assert.deepEqual(keep(inst.rest), keep(old.rest));
    // one draw per picture in each loop, never more than the old draws
    const draws = calls.filter(c => c[0] === 'drawArraysInstanced').length,
      oldDraws = old.loops.reduce((s, L) => s + L.length, 0),
      pics = inst.loops.reduce((s, L) => s + new Set(L.map(q => q.key.split(' ')[0])).size, 0);
    assert.equal(draws, pics);
    assert.ok(draws < oldDraws);
    assert.ok(!calls.some(c => c[0] === 'drawArrays'), 'no picture drawn one at a time');
  });

test('the instanced shadow program is the shadow one with its uniforms read from the instance', () => {
  const [vs, fs] = G.SHADOW_INSTANCE_SHADERS.shadowI;
  assert.equal(fs, G.WALK_SHADERS.shadow[1]);
  assert.ok(!/uniform vec3 uBase|uniform float uFlip/.test(vs));
  for (const n of ['uBase', 'uRight', 'uOff', 'uUV', 'uFlip', 'uShear'])
    assert.ok(vs.includes('#define ' + n + ' '), n);
  assert.equal(
    vs.slice(vs.indexOf('void main')),
    G.WALK_SHADERS.shadow[0].slice(G.WALK_SHADERS.shadow[0].indexOf('void main'))
  );
});

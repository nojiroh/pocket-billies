'use strict';
/* ================= ENGINE MODEL INSTANCES =================
   Phase 20 (R2, stage F retargeted to the models): the solid models (prop-models.js: voxel props `vox`, low-poly
   models `mdl`) drawn one instanced draw per mesh part instead of one draw per item. Each item's values (the ones the
   old path set as uniforms before its draw) are one record of MODEL_INSTANCE_FLOATS floats in a buffer uploaded once
   a pass; the items are grouped by mesh (buildModelBatches), and each batch points the instance attributes at its own
   records (WebGL2 has no base instance). Also the pure pieces the shadow casters will need (round 3): a box against
   the view (boxInFrustum) and a set of items split into pieces (splitPieces). Nothing but the two GL helpers at the
   end touches WebGL. */
/* the record of one item, in floats (the window bits are a 32-bit integer in float 19's slot):
   0-3   x, y (with a moored airship's bob), z, scale
   4-7   turn, flip, fade, cel (a low-poly model) or emit (a voxel prop)
   8-11  the base point x, y, z (no bob: the look's seed, the foot of the contact shade), the window seed
   12-15 the item's own spin: axis x, y, z (up as y), angle
   16-18 the spin's pivot (the model's metres, up as y); 19 the lit windows' bits
   20-23 wear, 24-27 hue/saturation/value shift, 28-31 tint, 32-33 the hue mask, 34 the windows' light, 35 unused */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  MODEL_INSTANCE_ATTRIBS: [() => MODEL_INSTANCE_ATTRIBS],
  MODEL_INSTANCE_BYTES: [() => MODEL_INSTANCE_BYTES],
  MODEL_INSTANCE_FLOATS: [() => MODEL_INSTANCE_FLOATS],
  boxInFrustum: [() => boxInFrustum, v => (boxInFrustum = v)],
  buildModelBatches: [() => buildModelBatches, v => (buildModelBatches = v)],
  modelInstanceStore: [() => modelInstanceStore, v => (modelInstanceStore = v)],
  modelInstanceValues: [() => modelInstanceValues, v => (modelInstanceValues = v)],
  modelInstanceVao: [() => modelInstanceVao, v => (modelInstanceVao = v)],
  pointModelInstances: [() => pointModelInstances, v => (pointModelInstances = v)],
  readModelInstance: [() => readModelInstance, v => (readModelInstance = v)],
  reserveModelInstances: [() => reserveModelInstances, v => (reserveModelInstances = v)],
  splitPieces: [() => splitPieces, v => (splitPieces = v)],
  writeModelInstance: [() => writeModelInstance, v => (writeModelInstance = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const MODEL_INSTANCE_FLOATS = 36,
  MODEL_INSTANCE_BYTES = MODEL_INSTANCE_FLOATS * 4;
/* the instance attributes [location, size, first float, integer]: a voxel prop reads the first five (its mesh has
   locations 0-2), a low-poly model all ten (its mesh has 0-4); 15 of the 16 a WebGL2 vertex shader may have */
export const MODEL_INSTANCE_ATTRIBS = {
  vox: [
    [5, 4, 0, 0],
    [6, 4, 4, 0],
    [7, 4, 8, 0],
    [8, 4, 12, 0],
    [9, 3, 16, 0],
  ],
  mdl: [
    [5, 4, 0, 0],
    [6, 4, 4, 0],
    [7, 4, 8, 0],
    [8, 4, 12, 0],
    [9, 3, 16, 0],
    [10, 4, 20, 0],
    [11, 4, 24, 0],
    [12, 4, 28, 0],
    [13, 4, 32, 0],
    [14, 1, 19, 1],
  ],
};
/* one item's values as the old path's uniforms had them (prop-models.js propModelInstanceValues fills it) */
export function modelInstanceValues() {
  return {
    pos: [0, 0, 0],
    s: 1,
    rot: 0,
    flip: 1,
    fade: 1,
    k: 0,
    base: [0, 0, 0],
    seed: 0,
    spin: [1, 0, 0, 0],
    spinC: [0, 0, 0],
    winOn: 0,
    winK: 0,
    wear: [0, 0, 0, 0],
    hsv: [0, 0, 0, 0],
    tint: [1, 1, 1, 0],
    mask: [0, 0],
  };
}
/* the records' memory, grown as needed and kept: floats, the same bytes as 32-bit integers, and as bytes (uploaded) */
export function modelInstanceStore() {
  return { F: new Float32Array(0), U: new Uint32Array(0), B: new Uint8Array(0), n: 0, buf: null, gl: null };
}
export function reserveModelInstances(S, n) {
  if (S.F.length >= n * MODEL_INSTANCE_FLOATS) return S;
  const ab = new ArrayBuffer(Math.max(n, 64, (S.F.length / MODEL_INSTANCE_FLOATS) * 2) * MODEL_INSTANCE_BYTES);
  S.F = new Float32Array(ab);
  S.U = new Uint32Array(ab);
  S.B = new Uint8Array(ab);
  return S;
}
export function writeModelInstance(S, i, v) {
  const F = S.F,
    o = i * MODEL_INSTANCE_FLOATS;
  F[o] = v.pos[0];
  F[o + 1] = v.pos[1];
  F[o + 2] = v.pos[2];
  F[o + 3] = v.s;
  F[o + 4] = v.rot;
  F[o + 5] = v.flip;
  F[o + 6] = v.fade;
  F[o + 7] = v.k;
  F[o + 8] = v.base[0];
  F[o + 9] = v.base[1];
  F[o + 10] = v.base[2];
  F[o + 11] = v.seed;
  for (let j = 0; j < 4; j++) {
    F[o + 12 + j] = v.spin[j];
    F[o + 20 + j] = v.wear[j];
    F[o + 24 + j] = v.hsv[j];
    F[o + 28 + j] = v.tint[j];
  }
  F[o + 16] = v.spinC[0];
  F[o + 17] = v.spinC[1];
  F[o + 18] = v.spinC[2];
  S.U[o + 19] = v.winOn >>> 0;
  F[o + 32] = v.mask[0];
  F[o + 33] = v.mask[1];
  F[o + 34] = v.winK;
  F[o + 35] = 0;
}
/* a record read back (the tests decode what the instanced path uploaded with it) */
function readModelInstance(F, U, i) {
  const o = i * MODEL_INSTANCE_FLOATS,
    r = (a, n) => Array.from(F.subarray(o + a, o + a + n));
  return {
    pos: r(0, 3),
    s: F[o + 3],
    rot: F[o + 4],
    flip: F[o + 5],
    fade: F[o + 6],
    k: F[o + 7],
    base: r(8, 3),
    seed: F[o + 11],
    spin: r(12, 4),
    spinC: r(16, 3),
    winOn: U[o + 19],
    wear: r(20, 4),
    hsv: r(24, 4),
    tint: r(28, 4),
    mask: r(32, 2),
    winK: F[o + 34],
  };
}
/* the items grouped by mesh, in the order each mesh is first met (L: [item, mesh] pairs); each batch's items keep
   their own order. `at` is the batch's first record once the records are written in batch order */
export function buildModelBatches(L) {
  const by = new Map(),
    out = [];
  for (const e of L) {
    let b = by.get(e[1]);
    if (!b) {
      b = { mesh: e[1], list: [], at: 0 };
      by.set(e[1], b);
      out.push(b);
    }
    b.list.push(e);
  }
  let at = 0;
  for (const b of out) {
    b.at = at;
    at += b.list.length;
  }
  return out;
}
/* F5: a box [x0, y0, z0, x1, y1, z1] against the view's planes (walk/quality-cull.js computeFrustum: six planes of
   four, normals inward): out only when wholly behind one plane (its corner farthest along that plane's normal is
   behind it). The far plane (the sixth) is skipped as inFrustum skips it, unless far is set. A box is never shown
   where the sphere round it is hidden: that corner is no farther along the normal than the sphere's edge */
function boxInFrustum(F, b, far) {
  const n = far ? 6 : 5;
  for (let i = 0; i < n; i++) {
    const a = F[i * 4],
      c = F[i * 4 + 1],
      d = F[i * 4 + 2];
    if (a * (a > 0 ? b[3] : b[0]) + c * (c > 0 ? b[4] : b[1]) + d * (d > 0 ? b[5] : b[2]) + F[i * 4 + 3] < 0)
      return false;
  }
  return true;
}
/* F5: items cut into pieces of at most maxCount items and at most maxExtent metres across the ground (x, z), each
   split at the median along its longer side; a single item is a piece whatever its size. boxOf gives an item's box
   [x0, y0, z0, x1, y1, z1] (by default its point x, y, z). Each piece is {items, box}: its items in their first
   order, its box round theirs. The same items give the same pieces */
function splitPieces(items, o, boxOf) {
  const maxCount = Math.max(1, (o && o.maxCount) || Infinity),
    maxExtent = (o && o.maxExtent) || Infinity,
    bx = boxOf || (it => [it.x, it.y || 0, it.z, it.x, it.y || 0, it.z]),
    E = items.map((it, i) => ({ it, i, b: bx(it) })),
    out = [];
  const boxRound = L => {
    const B = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const e of L)
      for (let j = 0; j < 3; j++) {
        if (e.b[j] < B[j]) B[j] = e.b[j];
        if (e.b[j + 3] > B[j + 3]) B[j + 3] = e.b[j + 3];
      }
    return B;
  };
  const go = L => {
    if (!L.length) return;
    const B = boxRound(L),
      wx = B[3] - B[0],
      wz = B[5] - B[2];
    if (L.length === 1 || (L.length <= maxCount && Math.max(wx, wz) <= maxExtent)) {
      out.push({ items: L.sort((a, b) => a.i - b.i).map(e => e.it), box: B });
      return;
    }
    const ax = wx >= wz ? 0 : 2,
      mid = e => (e.b[ax] + e.b[ax + 3]) / 2,
      S = L.slice().sort((a, b) => mid(a) - mid(b) || a.i - b.i),
      h = S.length >> 1;
    go(S.slice(0, h));
    go(S.slice(h));
  };
  go(E);
  return out;
}
/* ---------- WebGL ---------- */
/* a mesh part's own vertex array for instanced draws (made once; its vertex and index buffers are the part's own, so
   the part's plain vertex array and the shadows' draws are untouched): the mesh layout A (prop-models.js
   VOX_ATTRIBS / MDL_ATTRIBS), the instance attributes I with a divisor of one */
export function modelInstanceVao(gl, q, A, I) {
  if (q.ivao !== undefined) return q.ivao;
  const v = gl.createVertexArray();
  gl.bindVertexArray(v);
  gl.bindBuffer(gl.ARRAY_BUFFER, q.bufs[0]);
  for (const [loc, n, ty, nm, off] of A.rows) {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, n, gl[ty], nm, A.stride, off);
  }
  if (q.el) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, q.bufs[1]);
  for (const [loc] of I) {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribDivisor(loc, 1);
  }
  q.ivao = v;
  return v;
}
/* the instance attributes pointed at a batch's first record (the instance buffer bound as the array buffer) */
export function pointModelInstances(gl, I, at) {
  const o = at * MODEL_INSTANCE_BYTES;
  for (const [loc, n, f, int] of I)
    if (int) gl.vertexAttribIPointer(loc, n, gl.UNSIGNED_INT, MODEL_INSTANCE_BYTES, o + f * 4);
    else gl.vertexAttribPointer(loc, n, gl.FLOAT, false, MODEL_INSTANCE_BYTES, o + f * 4);
}

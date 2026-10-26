'use strict';
/* ================= ENGINE SPRITE INSTANCES =================
   Phase 20 (stage E4): the standing pictures of a frame packed as instances, one after another in one buffer, so a
   run of the same picture is one draw. A sprite record (walk/sprites.js spriteRecord: the values the old path sent as
   uniforms) becomes SPRITE_INSTANCE_STRIDE bytes laid out as SPRITE_INSTANCE_LAYOUT says; the instanced programs read
   them at those attribute locations. Halves are packed here (no reliance on Float16Array). Where and how big a picture
   stands are full floats (a half is 8 mm off 16 m away); the rest are halves, the tint bytes. Nothing here touches
   WebGL but the buffer (spriteInstanceBuffer, from stage E6).

   A record holds: x y z (base), ox oy w h (offset and size, in metres), uv (its [3]: the share of the picture's
   height shown, someone wading), flip, slope, shear (the CPU's sway), dz (pulled toward the eye), right and back
   (the picture's own axes; unused when cam is set: it faces the camera), fixed, noRecv, flipN, lk (a prop's look:
   hsv, wear, tint, mask; null for none), fol (foliage, snow), self (self-shade amount and way), fade, emit, lit, rim,
   shade, mt (a SURFACE_MATERIALS entry). Round 3's shadow sprites can use the same buffer: their program reads only
   the base, the offset, the axes, the sway and the UV (locations 1-4). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { SURFACE_MATERIALS, gpuState } from './webgl.js';
/* eslint-disable no-func-assign */
expose({
  HALF_F32: [() => HALF_F32],
  HALF_U32: [() => HALF_U32],
  MATERIAL_INDEX: [() => MATERIAL_INDEX],
  NO_LOOK: [() => NO_LOOK],
  SPRITE_FLAG: [() => SPRITE_FLAG],
  SPRITE_INSTANCE_LAYOUT: [() => SPRITE_INSTANCE_LAYOUT],
  SPRITE_INSTANCE_STRIDE: [() => SPRITE_INSTANCE_STRIDE],
  SPRITE_MATERIALS: [() => SPRITE_MATERIALS],
  SPRITE_MATERIAL_TABLE: [() => SPRITE_MATERIAL_TABLE],
  bindSpriteInstances: [() => bindSpriteInstances, v => (bindSpriteInstances = v)],
  growSpriteInstances: [() => growSpriteInstances, v => (growSpriteInstances = v)],
  halfBits: [() => halfBits, v => (halfBits = v)],
  halfValue: [() => halfValue, v => (halfValue = v)],
  materialIndex: [() => materialIndex, v => (materialIndex = v)],
  packSpriteInstance: [() => packSpriteInstance, v => (packSpriteInstance = v)],
  packSpriteInstances: [() => packSpriteInstances, v => (packSpriteInstances = v)],
  spriteInstanceBuffer: [() => spriteInstanceBuffer, v => (spriteInstanceBuffer = v)],
  spriteInstanceBytes: [() => spriteInstanceBytes],
  spriteInstanceGL: [() => spriteInstanceGL],
  spriteMaterialTable: [() => spriteMaterialTable, v => (spriteMaterialTable = v)],
  unitByte: [() => unitByte],
  unpackSpriteInstance: [() => unpackSpriteInstance, v => (unpackSpriteInstance = v)],
  uploadSpriteInstances: [() => uploadSpriteInstances, v => (uploadSpriteInstances = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* the attributes after the corner (location 0, per vertex): [location, name, components, format, byte offset].
   f32: float; f16: half float; u8n: a byte read as 0-1; u8i: a byte read as an integer (vertexAttribIPointer) */
const SPRITE_INSTANCE_LAYOUT = [
  [1, 'base', 3, 'f32', 0],
  [2, 'offset', 4, 'f32', 12],
  [3, 'axes', 4, 'f16', 28] /* right.x, right.z, back.x, back.z */,
  [4, 'bend', 4, 'f16', 36] /* slope, shear, dz, shown height */,
  [5, 'hsv', 4, 'f16', 44],
  [6, 'wear', 4, 'f16', 52],
  [7, 'tint', 4, 'u8n', 60],
  [8, 'maskFol', 4, 'f16', 64] /* mask low, mask width, foliage, snow */,
  [9, 'selfFade', 4, 'f16', 72] /* self-shade amount, way x, way y, fade */,
  [10, 'light', 4, 'f16', 80] /* emit, lit, rim, shade */,
  [11, 'flags', 4, 'u8i', 88] /* flags, material, spare, spare */,
];
export const SPRITE_INSTANCE_STRIDE = 92;
/* the flags byte */
const SPRITE_FLAG = { fixed: 1, noRecv: 2, flipN: 4, flip: 8, cam: 16 };
/* the materials by index (the instanced programs' uniform table holds them in this order) */
const SPRITE_MATERIALS = Object.keys(SURFACE_MATERIALS);
const MATERIAL_INDEX = new Map();
function materialIndex(mt) {
  let i = MATERIAL_INDEX.get(mt);
  if (i === undefined) {
    i = Math.max(0, SPRITE_MATERIALS.indexOf(Object.keys(SURFACE_MATERIALS).find(k => SURFACE_MATERIALS[k] === mt)));
    MATERIAL_INDEX.set(mt, i);
  }
  return i;
}
/* ---------- halves ---------- */
const HALF_F32 = new Float32Array(1),
  HALF_U32 = new Uint32Array(HALF_F32.buffer);
/* a number as the bits of the nearest half (ties to even); past the largest half it is infinity, NaN stays NaN */
function halfBits(v) {
  HALF_F32[0] = v;
  const x = HALF_U32[0],
    sign = (x >>> 16) & 0x8000,
    e = (x >>> 23) & 0xff,
    m = x & 0x7fffff;
  if (e === 0xff) return sign | 0x7c00 | (m ? 0x200 : 0);
  const he = e - 127 + 15;
  if (he >= 0x1f) return sign | 0x7c00;
  if (he <= 0) {
    if (he < -10) return sign;
    /* a subnormal half */
    const mm = m | 0x800000,
      shift = 14 - he,
      h = mm >>> shift,
      rest = mm & ((1 << shift) - 1),
      half = 1 << (shift - 1);
    return sign | (h + (rest > half || (rest === half && h & 1) ? 1 : 0));
  }
  const h = (he << 10) | (m >>> 13),
    rest = m & 0x1fff;
  /* rounding may carry into the exponent, up to infinity: the bits stay right */
  return sign | (h + (rest > 0x1000 || (rest === 0x1000 && h & 1) ? 1 : 0));
}
function halfValue(b) {
  const s = b & 0x8000 ? -1 : 1,
    e = (b >> 10) & 0x1f,
    m = b & 0x3ff;
  if (e === 0) return s * m * 2 ** -24;
  if (e === 0x1f) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * 2 ** (e - 15);
}
/* ---------- packing ---------- */
/* the bytes of a frame's instances, grown as needed and kept: three views of one buffer */
const spriteInstanceBytes = { buf: null, f32: null, u16: null, u8: null, cap: 0 };
function growSpriteInstances(n) {
  const B = spriteInstanceBytes;
  if (B.cap >= n) return B;
  const cap = Math.max(n, B.cap * 2, 256),
    buf = new ArrayBuffer(cap * SPRITE_INSTANCE_STRIDE);
  if (B.u8) new Uint8Array(buf).set(B.u8);
  B.buf = buf;
  B.f32 = new Float32Array(buf);
  B.u16 = new Uint16Array(buf);
  B.u8 = new Uint8Array(buf);
  B.cap = cap;
  return B;
}
const NO_LOOK = { hsv: [0, 0, 0, 0], wear: [0, 0, 0, 0], tint: [1, 1, 1, 0], mask: [0, 0] };
const unitByte = v => (v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255));
/* record r into instance i (cam: the picture faces the camera; its axes are then the camera's) */
export function packSpriteInstance(i, r, cam) {
  const B = growSpriteInstances(i + 1),
    f = B.f32,
    h = B.u16,
    b = B.u8,
    o = i * SPRITE_INSTANCE_STRIDE,
    o4 = o >> 2,
    o2 = o >> 1,
    L = r.lk || NO_LOOK;
  f[o4] = r.x;
  f[o4 + 1] = r.y;
  f[o4 + 2] = r.z;
  f[o4 + 3] = r.ox;
  f[o4 + 4] = r.oy;
  f[o4 + 5] = r.w;
  f[o4 + 6] = r.h;
  h[o2 + 14] = halfBits(cam ? 0 : r.right[0]);
  h[o2 + 15] = halfBits(cam ? 0 : r.right[2]);
  h[o2 + 16] = halfBits(cam ? 0 : r.back[0]);
  h[o2 + 17] = halfBits(cam ? 0 : r.back[2]);
  h[o2 + 18] = halfBits(r.slope);
  h[o2 + 19] = halfBits(r.shear);
  h[o2 + 20] = halfBits(r.dz);
  h[o2 + 21] = halfBits(r.uv[3]);
  for (let k = 0; k < 4; k++) {
    h[o2 + 22 + k] = halfBits(L.hsv[k]);
    h[o2 + 26 + k] = halfBits(L.wear[k]);
    b[o + 60 + k] = unitByte(L.tint[k]);
  }
  h[o2 + 32] = halfBits(L.mask[0]);
  h[o2 + 33] = halfBits(L.mask[1]);
  h[o2 + 34] = halfBits(r.fol[0]);
  h[o2 + 35] = halfBits(r.fol[1]);
  h[o2 + 36] = halfBits(r.self[0]);
  h[o2 + 37] = halfBits(r.self[1]);
  h[o2 + 38] = halfBits(r.self[2]);
  h[o2 + 39] = halfBits(r.fade);
  h[o2 + 40] = halfBits(r.emit);
  h[o2 + 41] = halfBits(r.lit);
  h[o2 + 42] = halfBits(r.rim);
  h[o2 + 43] = halfBits(r.shade);
  b[o + 88] =
    (r.fixed ? SPRITE_FLAG.fixed : 0) |
    (r.noRecv ? SPRITE_FLAG.noRecv : 0) |
    (r.flipN < 0 ? SPRITE_FLAG.flipN : 0) |
    (r.flip < 0 ? SPRITE_FLAG.flip : 0) |
    (cam ? SPRITE_FLAG.cam : 0);
  b[o + 89] = materialIndex(r.mt);
  b[o + 90] = 0;
  b[o + 91] = 0;
}
/* records [from, to) into instances 0...; cam(r) says whether a record faces the camera. The byte count */
function packSpriteInstances(records, from, to, cam) {
  for (let i = from; i < to; i++) packSpriteInstance(i - from, records[i], cam(records[i]));
  return (to - from) * SPRITE_INSTANCE_STRIDE;
}
/* instance i back as values (for the tests and the debug log) */
function unpackSpriteInstance(i) {
  const B = spriteInstanceBytes,
    o = i * SPRITE_INSTANCE_STRIDE,
    f = B.f32,
    o4 = o >> 2,
    o2 = o >> 1,
    hv = k => halfValue(B.u16[o2 + k]),
    fl = B.u8[o + 88];
  return {
    x: f[o4],
    y: f[o4 + 1],
    z: f[o4 + 2],
    ox: f[o4 + 3],
    oy: f[o4 + 4],
    w: f[o4 + 5],
    h: f[o4 + 6],
    right: [hv(14), 0, hv(15)],
    back: [hv(16), 0, hv(17)],
    slope: hv(18),
    shear: hv(19),
    dz: hv(20),
    shown: hv(21),
    hsv: [hv(22), hv(23), hv(24), hv(25)],
    wear: [hv(26), hv(27), hv(28), hv(29)],
    tint: [0, 1, 2, 3].map(k => B.u8[o + 60 + k] / 255),
    mask: [hv(32), hv(33)],
    fol: [hv(34), hv(35)],
    self: [hv(36), hv(37), hv(38)],
    fade: hv(39),
    emit: hv(40),
    lit: hv(41),
    rim: hv(42),
    shade: hv(43),
    fixed: fl & SPRITE_FLAG.fixed ? 1 : 0,
    noRecv: fl & SPRITE_FLAG.noRecv ? 1 : 0,
    flipN: fl & SPRITE_FLAG.flipN ? -1 : 1,
    flip: fl & SPRITE_FLAG.flip ? -1 : 1,
    cam: !!(fl & SPRITE_FLAG.cam),
    mat: SPRITE_MATERIALS[B.u8[o + 89]],
  };
}
/* ---------- the buffer (phase 20 E7) ---------- */
/* one vertex array: the corner quad (location 0) and the instances (1-11, one step per instance), remade with the
   context (initWebgl makes a new quad); the buffer is orphaned and refilled every frame */
const spriteInstanceGL = { quad: null, vao: null, buf: null, size: 0, at: -1 };
function spriteInstanceBuffer() {
  const gl = gpuState.gl,
    S = spriteInstanceGL;
  if (S.quad === gpuState.quad && S.vao) return S;
  S.quad = gpuState.quad;
  S.vao = gl.createVertexArray();
  S.buf = gl.createBuffer();
  S.size = 0;
  S.at = -1;
  gl.bindVertexArray(S.vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gpuState.quad);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, S.buf);
  for (const [loc] of SPRITE_INSTANCE_LAYOUT) {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribDivisor(loc, 1);
  }
  gl.bindVertexArray(null);
  return S;
}
/* the first bytes of spriteInstanceBytes into the buffer */
export function uploadSpriteInstances(bytes) {
  const gl = gpuState.gl,
    S = spriteInstanceBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, S.buf);
  if (bytes > S.size) S.size = Math.max(bytes, S.size * 2, 64 * SPRITE_INSTANCE_STRIDE);
  gl.bufferData(gl.ARRAY_BUFFER, S.size, gl.DYNAMIC_DRAW);
  if (bytes) gl.bufferSubData(gl.ARRAY_BUFFER, 0, spriteInstanceBytes.u8, 0, bytes);
  S.at = -1;
  return S;
}
/* the vertex array bound with its instance attributes starting at instance first (WebGL2 has no base instance, so the
   attributes are pointed again for each run) */
export function bindSpriteInstances(first) {
  const gl = gpuState.gl,
    S = spriteInstanceGL;
  gl.bindVertexArray(S.vao);
  if (S.at === first) return;
  S.at = first;
  gl.bindBuffer(gl.ARRAY_BUFFER, S.buf);
  const o = first * SPRITE_INSTANCE_STRIDE;
  for (const [loc, , n, fmt, off] of SPRITE_INSTANCE_LAYOUT)
    if (fmt === 'u8i') gl.vertexAttribIPointer(loc, n, gl.UNSIGNED_BYTE, SPRITE_INSTANCE_STRIDE, o + off);
    else
      gl.vertexAttribPointer(
        loc,
        n,
        fmt === 'f32' ? gl.FLOAT : fmt === 'f16' ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
        fmt === 'u8n',
        SPRITE_INSTANCE_STRIDE,
        o + off
      );
}
/* the materials' table for the instanced programs (uMats: specular, shininess, translucency, wrap) */
const SPRITE_MATERIAL_TABLE = new Float32Array(32);
export function spriteMaterialTable() {
  const T = SPRITE_MATERIAL_TABLE;
  for (let i = 0; i < SPRITE_MATERIALS.length; i++) {
    const m = SURFACE_MATERIALS[SPRITE_MATERIALS[i]];
    T[i * 4] = m.spec;
    T[i * 4 + 1] = m.shin;
    T[i * 4 + 2] = m.transl;
    T[i * 4 + 3] = m.wrap;
  }
  return T;
}

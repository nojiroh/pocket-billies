'use strict';
/* ================= ENGINE GPU COUNTERS =================
   Phase 20 (stage A): what a frame asks of the graphics card, counted per render pass: draw calls, instances, program
   switches, texture and vertex-array binds, uniform calls, and the bytes sent to it. Counting wraps the context's
   methods with its own properties for one frame at a time (countersOn ... countersOff in the same scheduler tick), so
   between counted frames the context has its plain methods again and costs nothing. Numbers only; nothing leaves the
   device (the debug log is exported by the player). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  COUNTED: [() => COUNTED],
  FIELD_COUNT: [() => FIELD_COUNT],
  F_BUFB: [() => F_BUFB],
  F_DRAW: [() => F_DRAW],
  F_INST: [() => F_INST],
  F_PROG: [() => F_PROG],
  F_TEX: [() => F_TEX],
  F_TEXB: [() => F_TEXB],
  F_UNI: [() => F_UNI],
  F_VAO: [() => F_VAO],
  GPU_FIELDS: [() => GPU_FIELDS],
  GPU_PASSES: [() => GPU_PASSES],
  PASS_INDEX: [() => PASS_INDEX],
  UNIFORM_NAMES: [() => UNIFORM_NAMES],
  countInPass: [() => countInPass],
  countUniform: [() => countUniform],
  countersOff: [() => countersOff, v => (countersOff = v)],
  countersOn: [() => countersOn, v => (countersOn = v)],
  dataBytes: [() => dataBytes],
  gpuCountBegin: [() => gpuCountBegin, v => (gpuCountBegin = v)],
  gpuCountDue: [() => gpuCountDue, v => (gpuCountDue = v)],
  gpuCountEnd: [() => gpuCountEnd, v => (gpuCountEnd = v)],
  gpuCountSummary: [() => gpuCountSummary, v => (gpuCountSummary = v)],
  gpuCounters: [() => gpuCounters],
  gpuFrameDone: [() => gpuFrameDone, v => (gpuFrameDone = v)],
  gpuPass: [() => gpuPass, v => (gpuPass = v)],
  pixelBytes: [() => pixelBytes, v => (pixelBytes = v)],
  sourceSize: [() => sourceSize],
  texImageBytes: [() => texImageBytes, v => (texImageBytes = v)],
  texSubImageBytes: [() => texSubImageBytes, v => (texSubImageBytes = v)],
  uniformNames: [() => uniformNames, v => (uniformNames = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const GPU_PASSES = [
  'other',
  'sky',
  'ground',
  'grass',
  'sprites',
  'solid',
  'models',
  'box',
  'buildings',
  'structures',
  'water',
  'effects',
  'post',
  'shadowNear',
  'shadowFar',
  'lamp0',
  'lamp1',
  'reflection',
];
/* the fields of each pass's slot */
const GPU_FIELDS = ['draws', 'instances', 'programs', 'textures', 'vaos', 'uniforms', 'texBytes', 'bufBytes'];
const FIELD_COUNT = GPU_FIELDS.length,
  [F_DRAW, F_INST, F_PROG, F_TEX, F_VAO, F_UNI, F_TEXB, F_BUFB] = GPU_FIELDS.keys(),
  PASS_INDEX = Object.fromEntries(GPU_PASSES.map((p, i) => [p, i]));
const gpuCounters = {
  on: false,
  pass: 0,
  /* the frame being counted, the last one counted, and a running sum while a test asks (want > 0) */
  cur: new Int32Array(GPU_PASSES.length * FIELD_COUNT),
  last: null,
  lastT: 0,
  sum: new Float64Array(GPU_PASSES.length * FIELD_COUNT),
  frames: 0,
  want: 0,
  everyMs: 1000,
  gl: null,
  prog: null,
  saved: null,
};
/* which pass the calls that follow belong to (one store; free while counting is off) */
function gpuPass(name) {
  gpuCounters.pass = PASS_INDEX[name] ?? 0;
}
const countInPass = (f, n) => {
  gpuCounters.cur[gpuCounters.pass * FIELD_COUNT + f] += n;
};
/* bytes of one pixel for a format and type pair (a rough figure for the less common ones) */
function pixelBytes(gl, format, type) {
  if (type === gl.UNSIGNED_SHORT_5_6_5 || type === gl.UNSIGNED_SHORT_4_4_4_4 || type === gl.UNSIGNED_SHORT_5_5_5_1)
    return 2;
  if (
    type === gl.UNSIGNED_INT_24_8 ||
    type === gl.UNSIGNED_INT_2_10_10_10_REV ||
    type === gl.UNSIGNED_INT_10F_11F_11F_REV
  )
    return 4;
  const ch =
    format === gl.RGBA || format === gl.RGBA_INTEGER
      ? 4
      : format === gl.RGB || format === gl.RGB_INTEGER
        ? 3
        : format === gl.RG || format === gl.RG_INTEGER || format === gl.LUMINANCE_ALPHA
          ? 2
          : 1;
  const per =
    type === gl.FLOAT || type === gl.INT || type === gl.UNSIGNED_INT
      ? 4
      : type === gl.HALF_FLOAT || type === gl.SHORT || type === gl.UNSIGNED_SHORT
        ? 2
        : 1;
  return ch * per;
}
const sourceSize = s =>
  s ? [s.videoWidth || s.naturalWidth || s.width || 0, s.videoHeight || s.naturalHeight || s.height || 0] : [0, 0];
/* texImage2D(t, l, if, w, h, b, f, ty, ...) or texImage2D(t, l, if, f, ty, source) */
function texImageBytes(gl, a) {
  if (a.length === 6) {
    const [w, h] = sourceSize(a[5]);
    return w * h * pixelBytes(gl, a[3], a[4]);
  }
  return (a[3] || 0) * (a[4] || 0) * pixelBytes(gl, a[6], a[7]);
}
/* texSubImage2D(t, l, x, y, w, h, f, ty, ...) or texSubImage2D(t, l, x, y, f, ty, source) */
function texSubImageBytes(gl, a) {
  if (a.length === 7) {
    const [w, h] = sourceSize(a[6]);
    return w * h * pixelBytes(gl, a[4], a[5]);
  }
  return (a[4] || 0) * (a[5] || 0) * pixelBytes(gl, a[6], a[7]);
}
/* bufferData(t, sizeOrData, usage, ...) and bufferSubData(t, offset, data, srcOffset, length) */
const dataBytes = (d, len) =>
  typeof d === 'number' ? d : len ? len * (d.BYTES_PER_ELEMENT || 1) : d ? d.byteLength || 0 : 0;
/* each counted method: what it adds, from its arguments */
const COUNTED = {
  drawArrays: () => countInPass(F_DRAW, 1),
  drawElements: () => countInPass(F_DRAW, 1),
  drawArraysInstanced: a => {
    countInPass(F_DRAW, 1);
    countInPass(F_INST, a[3] | 0);
  },
  drawElementsInstanced: a => {
    countInPass(F_DRAW, 1);
    countInPass(F_INST, a[4] | 0);
  },
  useProgram: a => {
    if (a[0] !== gpuCounters.prog) {
      gpuCounters.prog = a[0];
      countInPass(F_PROG, 1);
    }
  },
  bindTexture: () => countInPass(F_TEX, 1),
  bindVertexArray: () => countInPass(F_VAO, 1),
  texImage2D: (a, gl) => countInPass(F_TEXB, texImageBytes(gl, a)),
  texSubImage2D: (a, gl) => countInPass(F_TEXB, texSubImageBytes(gl, a)),
  bufferData: a => countInPass(F_BUFB, dataBytes(a[1])),
  bufferSubData: a => countInPass(F_BUFB, dataBytes(a[2], a[4])),
};
const countUniform = () => countInPass(F_UNI, 1);
/* the uniform setters, from the context's own prototype chain (uniformBlockBinding sets no value) */
const UNIFORM_NAMES = new WeakMap();
function uniformNames(gl) {
  const P = Object.getPrototypeOf(gl);
  if (P && UNIFORM_NAMES.has(P)) return UNIFORM_NAMES.get(P);
  const out = new Set();
  for (let o = Object.getPrototypeOf(gl); o && o !== Object.prototype; o = Object.getPrototypeOf(o))
    for (const k of Object.getOwnPropertyNames(o))
      if (/^uniform(Matrix)?\d/.test(k) && typeof gl[k] === 'function') out.add(k);
  const names = [...out];
  if (P) UNIFORM_NAMES.set(P, names);
  return names;
}
/* start counting on this context: each method is wrapped round whatever it was (a test's own wrapper included) */
function countersOn(gl) {
  if (!gl || gpuCounters.on) return false;
  const saved = [];
  const wrap = (k, count) => {
    if (typeof gl[k] !== 'function') return;
    const own = Object.prototype.hasOwnProperty.call(gl, k),
      f = gl[k];
    saved.push([k, own, f]);
    gl[k] = function (...a) {
      count(a, gl);
      return f.apply(gl, a);
    };
  };
  for (const [k, c] of Object.entries(COUNTED)) wrap(k, c);
  for (const k of uniformNames(gl)) wrap(k, countUniform);
  gpuCounters.cur.fill(0);
  gpuCounters.pass = 0;
  gpuCounters.prog = undefined; /* the frame's first useProgram counts (asking the context would cost a query) */
  gpuCounters.gl = gl;
  gpuCounters.saved = saved;
  gpuCounters.on = true;
  return true;
}
/* stop counting: every method is put back exactly as it was (the prototype's again, or the wrapper that was there) */
function countersOff() {
  if (!gpuCounters.on) return null;
  const gl = gpuCounters.gl;
  for (let i = gpuCounters.saved.length - 1; i >= 0; i--) {
    const [k, own, f] = gpuCounters.saved[i];
    if (own) gl[k] = f;
    else delete gl[k];
  }
  gpuCounters.saved = null;
  gpuCounters.gl = null;
  gpuCounters.prog = null;
  gpuCounters.on = false;
  gpuCounters.pass = 0;
  return gpuCounters.cur;
}
/* the scheduler's side: is this tick a counted one (one a second, or every tick while a test asks) */
function gpuCountDue(ts) {
  return gpuCounters.want > 0 || ts - gpuCounters.lastT >= gpuCounters.everyMs;
}
/* a counted tick ended: keep it as the last one, and add it to a test's sum */
function gpuFrameDone(ts) {
  const c = gpuCounters.cur;
  gpuCounters.last = c.slice();
  gpuCounters.lastT = ts;
  if (gpuCounters.want > 0) {
    for (let i = 0; i < c.length; i++) gpuCounters.sum[i] += c[i];
    gpuCounters.frames++;
  }
}
/* one counted frame (or a sum) read as numbers: totals and the draws of each pass that had any */
function gpuCountSummary(c = gpuCounters.last, frames = 1) {
  if (!c) return null;
  const n = Math.max(1, frames),
    tot = new Array(FIELD_COUNT).fill(0),
    dcp = {};
  for (let p = 0; p < GPU_PASSES.length; p++) {
    for (let f = 0; f < FIELD_COUNT; f++) tot[f] += c[p * FIELD_COUNT + f];
    const d = c[p * FIELD_COUNT + F_DRAW];
    if (d) dcp[GPU_PASSES[p]] = Math.round((d / n) * 10) / 10;
  }
  const r = v => Math.round((v / n) * 10) / 10;
  return {
    dc: [r(tot[F_DRAW]), r(tot[F_INST]), r(tot[F_PROG]), r(tot[F_TEX]), r(tot[F_UNI])],
    vao: r(tot[F_VAO]),
    up: [Math.round(tot[F_TEXB] / n / 1024), Math.round(tot[F_BUFB] / n / 1024)],
    dcp,
  };
}
/* a test counts every frame while it measures: begin, then end gives the averages per frame */
function gpuCountBegin() {
  if (!gpuCounters.want) {
    gpuCounters.sum.fill(0);
    gpuCounters.frames = 0;
  }
  gpuCounters.want++;
}
function gpuCountEnd() {
  const s = gpuCounters.frames ? gpuCountSummary(gpuCounters.sum, gpuCounters.frames) : null;
  if (s) s.frames = gpuCounters.frames;
  gpuCounters.want = Math.max(0, gpuCounters.want - 1);
  return s;
}

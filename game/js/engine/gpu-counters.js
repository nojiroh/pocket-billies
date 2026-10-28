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
  F_TEXK: [() => F_TEXK],
  F_UNI: [() => F_UNI],
  F_VAO: [() => F_VAO],
  F_VAOK: [() => F_VAOK],
  GPU_FIELDS: [() => GPU_FIELDS],
  GPU_PASSES: [() => GPU_PASSES],
  GPU_TAGS: [() => GPU_TAGS],
  PASS_INDEX: [() => PASS_INDEX],
  TAG_INDEX: [() => TAG_INDEX],
  TAG_SLOTS: [() => TAG_SLOTS],
  UNIFORM_NAMES: [() => UNIFORM_NAMES],
  countInPass: [() => countInPass],
  countTagged: [() => countTagged],
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
  gpuTag: [() => gpuTag, v => (gpuTag = v)],
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
  'silhouette',
  'water',
  'effects',
  'post',
  'shadowNear',
  'shadowFar',
  'lamp0',
  'lamp1',
  'reflection',
];
/* the fields of each pass's slot (R1 measure: texKinds and vaoKinds, the distinct textures and vertex arrays the pass
   bound in the frame: the fewest draws grouping by picture or mesh could reach) */
const GPU_FIELDS = [
  'draws',
  'instances',
  'programs',
  'textures',
  'vaos',
  'uniforms',
  'texBytes',
  'bufBytes',
  'texKinds',
  'vaoKinds',
];
const FIELD_COUNT = GPU_FIELDS.length,
  [F_DRAW, F_INST, F_PROG, F_TEX, F_VAO, F_UNI, F_TEXB, F_BUFB, F_TEXK, F_VAOK] = GPU_FIELDS.keys(),
  PASS_INDEX = Object.fromEntries(GPU_PASSES.map((p, i) => [p, i]));
/* R1 measure: what a draw belongs to across the passes (0: untagged): a low-poly model's mesh, or a picture layer of a
   model (its leaf clumps and vines, drawn as sprites); each pass keeps the draws and instances of each tag. CH-1: a
   person's picture (logic/person-view.js personPicture), in every pass that draws one */
const GPU_TAGS = ['', 'model', 'modelPic', 'person'];
const TAG_INDEX = Object.fromEntries(GPU_TAGS.map((t, i) => [t, i])),
  TAG_SLOTS = GPU_PASSES.length * GPU_TAGS.length * 2;
export const gpuCounters = {
  on: false,
  pass: 0,
  /* the frame being counted, the last one counted, and a running sum while a test asks (want > 0) */
  cur: new Int32Array(GPU_PASSES.length * FIELD_COUNT),
  last: null,
  lastT: 0,
  sum: new Float64Array(GPU_PASSES.length * FIELD_COUNT),
  /* the same for the tags: [pass][tag][draws, instances] */
  tag: 0,
  tcur: new Int32Array(TAG_SLOTS),
  tlast: null,
  tsum: new Float64Array(TAG_SLOTS),
  /* the distinct textures and vertex arrays each pass bound in the counted frame */
  texSeen: GPU_PASSES.map(() => new Set()),
  vaoSeen: GPU_PASSES.map(() => new Set()),
  frames: 0,
  want: 0,
  everyMs: 1000,
  gl: null,
  prog: null,
  saved: null,
};
/* which pass the calls that follow belong to (one store; free while counting is off) */
export function gpuPass(name) {
  gpuCounters.pass = PASS_INDEX[name] ?? 0;
  gpuCounters.tag = 0;
}
/* what the draws that follow belong to: a tag name, its index (an item's `mp`), or nothing (one store, free while
   counting is off) */
export function gpuTag(t) {
  gpuCounters.tag = typeof t === 'number' ? t : TAG_INDEX[t] || 0;
}
const countInPass = (f, n) => {
  gpuCounters.cur[gpuCounters.pass * FIELD_COUNT + f] += n;
};
const countTagged = (draws, inst) => {
  const t = gpuCounters.tag;
  if (!t) return;
  const i = (gpuCounters.pass * GPU_TAGS.length + t) * 2;
  gpuCounters.tcur[i] += draws;
  gpuCounters.tcur[i + 1] += inst;
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
  drawArrays: () => {
    countInPass(F_DRAW, 1);
    countTagged(1, 0);
  },
  drawElements: () => {
    countInPass(F_DRAW, 1);
    countTagged(1, 0);
  },
  drawArraysInstanced: a => {
    countInPass(F_DRAW, 1);
    countInPass(F_INST, a[3] | 0);
    countTagged(1, a[3] | 0);
  },
  drawElementsInstanced: a => {
    countInPass(F_DRAW, 1);
    countInPass(F_INST, a[4] | 0);
    countTagged(1, a[4] | 0);
  },
  useProgram: a => {
    if (a[0] !== gpuCounters.prog) {
      gpuCounters.prog = a[0];
      countInPass(F_PROG, 1);
    }
  },
  bindTexture: a => {
    countInPass(F_TEX, 1);
    if (a[1]) gpuCounters.texSeen[gpuCounters.pass].add(a[1]);
  },
  bindVertexArray: a => {
    countInPass(F_VAO, 1);
    if (a[0]) gpuCounters.vaoSeen[gpuCounters.pass].add(a[0]);
  },
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
export function countersOn(gl) {
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
  gpuCounters.tcur.fill(0);
  for (const S of gpuCounters.texSeen) S.clear();
  for (const S of gpuCounters.vaoSeen) S.clear();
  gpuCounters.pass = 0;
  gpuCounters.tag = 0;
  gpuCounters.prog = undefined; /* the frame's first useProgram counts (asking the context would cost a query) */
  gpuCounters.gl = gl;
  gpuCounters.saved = saved;
  gpuCounters.on = true;
  return true;
}
/* stop counting: every method is put back exactly as it was (the prototype's again, or the wrapper that was there) */
export function countersOff() {
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
  gpuCounters.tag = 0;
  /* the distinct textures and vertex arrays become the pass's kinds; the sets let go of the objects */
  for (let p = 0; p < GPU_PASSES.length; p++) {
    gpuCounters.cur[p * FIELD_COUNT + F_TEXK] = gpuCounters.texSeen[p].size;
    gpuCounters.cur[p * FIELD_COUNT + F_VAOK] = gpuCounters.vaoSeen[p].size;
    gpuCounters.texSeen[p].clear();
    gpuCounters.vaoSeen[p].clear();
  }
  return gpuCounters.cur;
}
/* the scheduler's side: is this tick a counted one (one a second, or every tick while a test asks) */
export function gpuCountDue(ts) {
  return gpuCounters.want > 0 || ts - gpuCounters.lastT >= gpuCounters.everyMs;
}
/* a counted tick ended: keep it as the last one, and add it to a test's sum. A tick that drew nothing (no task was due
   in it, or the screen draws no WebGL) is not kept, and the next tick is counted instead */
export function gpuFrameDone(ts) {
  const c = gpuCounters.cur;
  let draws = 0;
  for (let p = 0; p < GPU_PASSES.length; p++) draws += c[p * FIELD_COUNT + F_DRAW];
  if (!draws) return;
  gpuCounters.last = c.slice();
  gpuCounters.tlast = gpuCounters.tcur.slice();
  gpuCounters.lastT = ts;
  if (gpuCounters.want > 0) {
    for (let i = 0; i < c.length; i++) gpuCounters.sum[i] += c[i];
    for (let i = 0; i < TAG_SLOTS; i++) gpuCounters.tsum[i] += gpuCounters.tcur[i];
    gpuCounters.frames++;
  }
}
/* one counted frame (or a sum) read as numbers: totals and the draws of each pass that had any; R1 measure: `dct`, each
   pass's tagged draws ({ sprites: { modelPic: 120 }, models: { model: 40 }, ... }; the rest of the pass is its `dcp`
   less these) and `dcu`, each pass's distinct textures and vertex arrays ([textures, vaos]) */
export function gpuCountSummary(
  c = gpuCounters.last,
  frames = 1,
  t = c === gpuCounters.last ? gpuCounters.tlast : null
) {
  if (!c) return null;
  const n = Math.max(1, frames),
    tot = new Array(FIELD_COUNT).fill(0),
    dcp = {},
    dct = {},
    dcu = {};
  const r = v => Math.round((v / n) * 10) / 10;
  for (let p = 0; p < GPU_PASSES.length; p++) {
    for (let f = 0; f < FIELD_COUNT; f++) tot[f] += c[p * FIELD_COUNT + f];
    const d = c[p * FIELD_COUNT + F_DRAW];
    if (!d) continue;
    dcp[GPU_PASSES[p]] = r(d);
    dcu[GPU_PASSES[p]] = [r(c[p * FIELD_COUNT + F_TEXK]), r(c[p * FIELD_COUNT + F_VAOK])];
    if (t)
      for (let g = 1; g < GPU_TAGS.length; g++) {
        const td = t[(p * GPU_TAGS.length + g) * 2];
        if (td) (dct[GPU_PASSES[p]] = dct[GPU_PASSES[p]] || {})[GPU_TAGS[g]] = r(td);
      }
  }
  return {
    dc: [r(tot[F_DRAW]), r(tot[F_INST]), r(tot[F_PROG]), r(tot[F_TEX]), r(tot[F_UNI])],
    vao: r(tot[F_VAO]),
    up: [Math.round(tot[F_TEXB] / n / 1024), Math.round(tot[F_BUFB] / n / 1024)],
    dcp,
    dct,
    dcu,
  };
}
/* a test counts every frame while it measures: begin, then end gives the averages per frame */
export function gpuCountBegin() {
  if (!gpuCounters.want) {
    gpuCounters.sum.fill(0);
    gpuCounters.tsum.fill(0);
    gpuCounters.frames = 0;
  }
  gpuCounters.want++;
}
export function gpuCountEnd() {
  const s = gpuCounters.frames ? gpuCountSummary(gpuCounters.sum, gpuCounters.frames, gpuCounters.tsum) : null;
  if (s) s.frames = gpuCounters.frames;
  gpuCounters.want = Math.max(0, gpuCounters.want - 1);
  return s;
}

'use strict';
/* phase 20 D2: a fragment shader in mediump where it is safe (Engine > Quality "Medium precision", quality.mediump,
   read when the 3D view starts). Phones' graphics chips (Adreno, Mali) run mediump maths at about twice the speed of
   highp; Apple's ignore it. A shader that opts in carries a list of edits (def.mp): its default float precision goes
   to mediump and each edit puts highp back on what needs it (screen places, depth, time, the hashes). In GLSL ES an
   operation runs at the highest precision of its operands, so a value marked highp keeps every sum it is part of
   highp. Pure: no GL here (tools/test/shader-precision.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  MEDIUMP_FROM: [() => MEDIUMP_FROM],
  MEDIUMP_TO: [() => MEDIUMP_TO],
  mediumpFragment: [() => mediumpFragment, v => (mediumpFragment = v)],
  mediumpMissing: [() => mediumpMissing, v => (mediumpMissing = v)],
  solidFragment: [() => solidFragment, v => (solidFragment = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const MEDIUMP_FROM = 'precision highp float;';
const MEDIUMP_TO = 'precision mediump float;';
/* the fragment text with mediump as its default and each edit [from, to] applied once; the text as it was when an
   edit is missing (tools/test checks every list against its shader) */
export function mediumpFragment(fs, edits) {
  if (!fs.includes(MEDIUMP_FROM) || mediumpMissing(fs, edits).length) return fs;
  let s = fs.replace(MEDIUMP_FROM, () => MEDIUMP_TO);
  for (const [a, b] of edits) s = s.replace(a, () => b);
  return s;
}
/* the edits whose text is not in the shader exactly once */
function mediumpMissing(fs, edits) {
  return edits.filter(([a]) => fs.split(a).length !== 2).map(([a]) => a);
}
/* FL-5a: a discard-free version of an opaque fragment shader (quality.drawOrder). A tile GPU (Adreno's LRZ, Mali's
   early depth) turns off its early depth writes for a draw whose shader holds the word `discard`, even in a branch
   never taken; so each cut (a fade's dither, the rock circle, a room's hole, a wall's thinning) is cut out of the text
   by an exact-once edit [from, to], and the program is used only for draws that would never discard. null when an
   edit is missing or a `discard` is left (tools/test checks every list against its shader) */
export function solidFragment(fs, edits) {
  if (mediumpMissing(fs, edits).length) return null;
  let s = fs;
  for (const [a, b] of edits) s = s.replace(a, () => b);
  return /\bdiscard\b/.test(s) ? null : s;
}

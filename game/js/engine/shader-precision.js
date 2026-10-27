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

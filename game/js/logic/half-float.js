// @ts-check
'use strict';
/* ================= HALF FLOATS =================
   Numbers turned into 16-bit floats (IEEE 754 half precision, rounded to the nearest, ties to even) for a half-float
   texture (RGBA16F) uploaded as HALF_FLOAT. WebGL2 also lets a page hand RGBA16F full floats (FLOAT) and leave the
   rounding to the driver, but the owner's Android phone (Adreno 750) then kept nothing: the water's kinds texture read
   as zeros there, and its water was dark and see-through (2026-10-29). Made here, the driver has nothing to convert.
   Plain numbers, no graphics. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  HALF_SCRATCH: [() => HALF_SCRATCH],
  HALF_SCRATCH_BITS: [() => HALF_SCRATCH_BITS],
  // @ts-expect-error -- replaced on purpose
  halfFloatBits: [() => halfFloatBits, v => (halfFloatBits = v)],
  // @ts-expect-error -- replaced on purpose
  halfFloats: [() => halfFloats, v => (halfFloats = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const HALF_SCRATCH = new Float32Array(1),
  HALF_SCRATCH_BITS = new Uint32Array(HALF_SCRATCH.buffer);
/**
 * one number's 16 bits as a half float
 * @param {number} v
 * @returns {number}
 */
export function halfFloatBits(v) {
  HALF_SCRATCH[0] = v;
  const x = HALF_SCRATCH_BITS[0],
    sign = (x >>> 16) & 0x8000,
    m = x & 0x7fffff;
  let e = (x >>> 23) & 0xff;
  /* infinity stays infinity, NaN stays NaN */
  if (e === 0xff) return sign | 0x7c00 | (m ? 0x200 : 0);
  e = e - 127 + 15;
  if (e >= 0x1f) return sign | 0x7c00;
  if (e <= 0) {
    /* too small for a normal half: a subnormal one, or zero */
    if (e < -10) return sign;
    const M = m | 0x800000,
      shift = 14 - e,
      rest = M & ((1 << shift) - 1),
      half = 1 << (shift - 1);
    let h = M >>> shift;
    if (rest > half || (rest === half && h & 1)) h++;
    return sign | h;
  }
  let h = (e << 10) | (m >>> 13);
  const rest = m & 0x1fff;
  /* a carry out of the fraction steps the exponent up, which is the right answer (up to infinity) */
  if (rest > 0x1000 || (rest === 0x1000 && h & 1)) h++;
  return sign | h;
}
/**
 * a list of numbers as half floats, ready for texImage2D(..., gl.HALF_FLOAT, ...)
 * @param {ArrayLike<number>} a
 * @returns {Uint16Array}
 */
export function halfFloats(a) {
  const out = new Uint16Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = halfFloatBits(a[i]);
  return out;
}

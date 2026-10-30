// @ts-check
'use strict';
/* ================= CONTACT SHADE (fluid track FL-2a) =================
   The soft dark patch under a prop (the contact-shadow list of the frame's light context, walk/lighting.js) at one
   point on the ground: the CPU twin of engine/webgl.js contactAO (LIGHT_GLSL). A standing picture reads it at its base
   point only, the same for every pixel, so the sprite pass works it out once per picture (walk/sprites.js) instead of
   running the 64-step loop in every pixel's fragment shader. Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  CONTACT_SHADE_MAX: [() => CONTACT_SHADE_MAX],
  // @ts-expect-error -- replaced on purpose
  contactShade: [() => contactShade, v => (contactShade = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* the most patches the Frame block holds (engine/frame-block.js uAO[64]) */
export const CONTACT_SHADE_MAX = 64;
/* how lit the ground is at (x, z), 0-1: 1 away from every patch. ao: [x, z, half width, half depth] each;
   contact: the dial (shadows.contact), how dark a patch's middle is */
export function contactShade(ao, contact, x, z) {
  let a = 1;
  const n = Math.min(ao ? ao.length : 0, CONTACT_SHADE_MAX);
  for (let i = 0; i < n; i++) {
    const b = ao[i],
      dx = (x - b[0]) / b[2],
      dz = (z - b[1]) / b[3],
      e = dx * dx + dz * dz;
    if (e < 1) {
      const k = 1 - e;
      a = Math.min(a, 1 - k * k * contact);
    }
  }
  return a;
}

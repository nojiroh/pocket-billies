'use strict';
/* ================= ENGINE FRAME BLOCK =================
   Phase 20 (stage C3): the frame's light values (sun, sky, fog, shadow maps, lamps, contact shadows) as one std140
   uniform block, packed once per frame and read by every lit program, instead of about 40 uniform calls each time a
   lit program is bound (light.js setLightUniforms; on for every lit program since phase 20 C3's close-out). The offsets are worked out from
   the block's own GLSL by the std140 rules, so the text is the one place the layout is written. Nothing here touches
   WebGL; Node tests check the packing against what the old setLightUniforms sent one uniform at a time (kept in
   tools/test/frame-block.test.mjs as the reference). */
/* uCurve stays a plain uniform: the vertex shaders read it, and the shadow passes set it before the frame's light
   context exists */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  FRAME_BLOCK_BYTES: [() => FRAME_BLOCK_BYTES],
  FRAME_BLOCK_GLSL: [() => FRAME_BLOCK_GLSL],
  FRAME_BLOCK_LAYOUT: [() => FRAME_BLOCK_LAYOUT],
  FRAME_OFFSETS: [() => FRAME_OFFSETS],
  STD140: [() => STD140],
  packFrameBlock: [() => packFrameBlock, v => (packFrameBlock = v)],
  put: [() => put],
  std140Layout: [() => std140Layout, v => (std140Layout = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const FRAME_BLOCK_GLSL = `layout(std140) uniform Frame{
mat4 uShadowM;mat4 uShadowM2;mat4 uLampM0;mat4 uLampM1;
vec4 uLP[16];vec4 uLC[16];vec4 uAO[64];vec4 uSH[9];
vec3 uEye;float uTime;vec3 uSunDir;float uFogStart;vec3 uSunCol;float uFogD;vec3 uAmbTop;float uAmbK;
vec3 uAmbBot;float uSHK;vec3 uFogCol;float uFogSun;vec3 uTint;float uTintAmt;vec3 uShTint;float uShStr;
vec3 uShLift;float uShPx;vec4 uRoomB;vec4 uSeason;vec2 uValley;float uMist,uMistY;
float uCloudSh,uCloudSpd,uCloudCov,uContact;float uShadowOn,uShadow2On,uShPen,uShPen2;
vec2 uShadowTexel,uShadowTexel2;float uRoomDim,uShLite,uShSteps,uFramePad;int uNL,uNLS,uNAO,uFramePadI;
};`;
/* std140: a member's size and alignment in bytes; an array element and a matrix column take a whole vec4 */
const STD140 = { float: [4, 4], int: [4, 4], vec2: [8, 8], vec3: [12, 16], vec4: [16, 16], mat4: [64, 16] };
/* { name: [byte offset, type, array length] } in declaration order, and the block's size */
function std140Layout(glsl) {
  const body = glsl.slice(glsl.indexOf('{') + 1, glsl.lastIndexOf('}')),
    out = {};
  let at = 0;
  for (const decl of body.split(';')) {
    const m = decl.trim().match(/^(\w+)\s+(.+)$/);
    if (!m) continue;
    for (const part of m[2].split(',')) {
      const [, name, n] = part.trim().match(/^(\w+)(?:\[(\d+)\])?$/),
        [size, align] = STD140[m[1]],
        len = n ? +n : 0,
        a = len ? 16 : align;
      at = Math.ceil(at / a) * a;
      out[name] = [at, m[1], len];
      at += len ? len * Math.max(16, size) : size;
    }
  }
  return { members: out, size: Math.ceil(at / 16) * 16 };
}
export const FRAME_BLOCK_LAYOUT = std140Layout(FRAME_BLOCK_GLSL);
export const FRAME_BLOCK_BYTES = FRAME_BLOCK_LAYOUT.size;
/* each member's offset in floats (the block is packed through a Float32Array and an Int32Array over the same bytes) */
const FRAME_OFFSETS = Object.fromEntries(Object.entries(FRAME_BLOCK_LAYOUT.members).map(([k, v]) => [k, v[0] / 4]));
const put = (f, at, v, n) => {
  for (let i = 0; i < n; i++) f[at + i] = v[i];
};
/* the light context X (light.js lightContext, after lampShadowMaps) into f (Float32Array) and n (Int32Array over the
   same buffer), with the values setLightUniforms sends; what it leaves as it was (a shadow map's matrix with no map)
   is 0 here, and the shaders don't read it */
export function packFrameBlock(X, f, n) {
  f.fill(0);
  const S = X.shadow,
    F = S && S.far,
    LS = (S && X.lampSh) || [];
  if (S) {
    put(f, FRAME_OFFSETS.uShadowM, S.vp, 16);
    f[FRAME_OFFSETS.uShadowOn] = 1;
    f[FRAME_OFFSETS.uShLite] = X.lite ? 1 : 0;
    f[FRAME_OFFSETS.uShadowTexel] = f[FRAME_OFFSETS.uShadowTexel + 1] = 1 / S.size;
    f[FRAME_OFFSETS.uShPen] = S.pen;
  }
  if (F) {
    put(f, FRAME_OFFSETS.uShadowM2, F.vp, 16);
    f[FRAME_OFFSETS.uShadow2On] = 1;
    f[FRAME_OFFSETS.uShadowTexel2] = f[FRAME_OFFSETS.uShadowTexel2 + 1] = 1 / F.size;
    f[FRAME_OFFSETS.uShPen2] = F.pen;
  }
  for (let i = 0; i < 2; i++) if (LS[i]) put(f, i ? FRAME_OFFSETS.uLampM1 : FRAME_OFFSETS.uLampM0, LS[i].vp, 16);
  n[FRAME_OFFSETS.uNLS] = LS.length;
  const L = X.lights;
  for (let i = 0; i < L.length; i++) {
    const l = L[i],
      p = FRAME_OFFSETS.uLP + i * 4,
      c = FRAME_OFFSETS.uLC + i * 4;
    f[p] = l.p[0];
    f[p + 1] = l.p[1];
    f[p + 2] = l.p[2];
    f[p + 3] = l.front ? -l.r : l.r;
    f[c] = l.c[0];
    f[c + 1] = l.c[1];
    f[c + 2] = l.c[2];
    f[c + 3] = 1;
  }
  n[FRAME_OFFSETS.uNL] = L.length;
  for (let i = 0; i < X.ao.length; i++) put(f, FRAME_OFFSETS.uAO + i * 4, X.ao[i], 4);
  n[FRAME_OFFSETS.uNAO] = X.ao.length;
  if (X.sh) {
    for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) f[FRAME_OFFSETS.uSH + i * 4 + j] = X.sh[i * 3 + j];
    f[FRAME_OFFSETS.uSHK] = X.shK;
  }
  put(f, FRAME_OFFSETS.uEye, X.eye, 3);
  put(f, FRAME_OFFSETS.uSunDir, X.sun.dir, 3);
  put(f, FRAME_OFFSETS.uSunCol, X.sun.col, 3);
  put(f, FRAME_OFFSETS.uAmbTop, X.ambTop, 3);
  put(f, FRAME_OFFSETS.uAmbBot, X.ambBot, 3);
  f[FRAME_OFFSETS.uAmbK] = X.ambK;
  put(f, FRAME_OFFSETS.uFogCol, X.fog, 3);
  f[FRAME_OFFSETS.uFogStart] = X.fogStart;
  f[FRAME_OFFSETS.uFogD] = X.fogD;
  f[FRAME_OFFSETS.uFogSun] = X.fogSun || 0;
  put(f, FRAME_OFFSETS.uTint, X.tint, 3);
  f[FRAME_OFFSETS.uTintAmt] = X.tintAmt;
  if (X.roomB) put(f, FRAME_OFFSETS.uRoomB, X.roomB, 4);
  f[FRAME_OFFSETS.uRoomDim] = X.roomDim || 0;
  f[FRAME_OFFSETS.uMist] = X.mist;
  f[FRAME_OFFSETS.uMistY] = X.mistY;
  if (X.valley) put(f, FRAME_OFFSETS.uValley, X.valley, 2);
  if (X.season) put(f, FRAME_OFFSETS.uSeason, X.season, 4);
  f[FRAME_OFFSETS.uTime] = X.time;
  f[FRAME_OFFSETS.uShStr] = X.shStr;
  put(f, FRAME_OFFSETS.uShTint, X.shTint, 3);
  f[FRAME_OFFSETS.uCloudSh] = X.cloudSh;
  f[FRAME_OFFSETS.uCloudSpd] = X.cloudSpd;
  f[FRAME_OFFSETS.uCloudCov] = X.cloudCov ?? 0.45;
  f[FRAME_OFFSETS.uContact] = X.contact;
  f[FRAME_OFFSETS.uShPx] = X.shPx || 0;
  f[FRAME_OFFSETS.uShSteps] = X.shSteps ?? 2;
  if (X.shLift) put(f, FRAME_OFFSETS.uShLift, X.shLift, 3);
}

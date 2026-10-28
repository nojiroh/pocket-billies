'use strict';
/* ================= BATTLE EFFECTS IN ONE DRAW (VFX track VFX-9) =================
   The battle's move and ambient particles (icon sprites, dust, rings, beams; battle-3d.js battle3dFrame lists them)
   as instances of one quad over one atlas, in two draws: a cutout draw (each pixel kept whole or discarded, depth
   written, so nothing is sorted and depth of field reads each particle's own depth; a fade is erosion, a hard step
   against a 4x4 Bayer pattern on the effect's own texels; alpha 0 out, so the ink outlines skip it as they skip the
   ground), then the glowing ones' white cores added on top. Copied from the weather's batch (walk/effects.js
   weatherBatch). The atlas packs icons.png's cells (logic/kit-assemble.js kitPack) with a white block for the flat
   kinds and (VFX-10) the effect strips (art/battle/anims, battleAnims.json sprites) and the ramps, one row of 8 texels
   each: a strip is 8 greys, and its sprite reads its grey's colour from its ramp's row (index 7, the white core, is
   its glow). A strip's texel is a stage pixel at its depth, so its pixels are the rig pixels' size beside it. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { BATTLE_ANIMS, TYPE_GLOW, provide } from '../hooks.js';
import { kitBlank } from '../logic/kit-pixels.js';
import { kitPack } from '../logic/kit-assemble.js';
import { BATTLE_ANIM_ART_DIR, battleRampColors } from '../logic/battle-anims.js';
import { gpuTag } from '../engine/gpu-counters.js';
import { ART_CACHE, ICON_ATLAS, artLoad, artReady, hexToRgb, makeCanvas } from '../art.js';
import {
  LIGHT_GLSL,
  bindQuad,
  ensurePrograms,
  gpuBuffer,
  gpuFree,
  gpuSized,
  gpuState,
  gpuTexture,
  gpuVao,
  setTextureParams,
} from '../engine/webgl.js';
import { useWalkProgram, worldCurveDrop } from './draw-common.js';
/* eslint-disable no-func-assign */
expose({
  BATTLE_FX_ATLAS_WIDTH: [() => BATTLE_FX_ATLAS_WIDTH],
  BATTLE_FX_FLOATS: [() => BATTLE_FX_FLOATS],
  BATTLE_FX_GLOW: [() => BATTLE_FX_GLOW],
  BATTLE_FX_GROUND_PX_M: [() => BATTLE_FX_GROUND_PX_M],
  BATTLE_FX_KIND: [() => BATTLE_FX_KIND],
  BATTLE_FX_LIT: [() => BATTLE_FX_LIT],
  BATTLE_FX_ONE: [() => BATTLE_FX_ONE],
  BATTLE_FX_RAMP: [() => BATTLE_FX_RAMP],
  BATTLE_FX_SHADERS: [() => BATTLE_FX_SHADERS],
  BATTLE_FX_UV: [() => BATTLE_FX_UV],
  STAGE_PIXELS_PER_METRE_AT_1M: [() => STAGE_PIXELS_PER_METRE_AT_1M],
  battleFxAnimAsked: [() => battleFxAnimAsked, v => (battleFxAnimAsked = v)],
  battleFxAnimPictures: [() => battleFxAnimPictures, v => (battleFxAnimPictures = v)],
  battleFxAtlas: [() => battleFxAtlas],
  battleFxAtlasSheet: [() => battleFxAtlasSheet, v => (battleFxAtlasSheet = v)],
  battleFxAtlasStale: [() => battleFxAtlasStale, v => (battleFxAtlasStale = v)],
  battleFxBatch: [() => battleFxBatch],
  battleFxHasAnim: [() => battleFxHasAnim, v => (battleFxHasAnim = v)],
  battleFxPass: [() => battleFxPass, v => ((battleFxPass = v), provide({ battleFxPass }))],
  battleFxPut: [() => battleFxPut, v => (battleFxPut = v)],
  battleFxRampRows: [() => battleFxRampRows, v => (battleFxRampRows = v)],
  battleFxRect: [() => battleFxRect, v => (battleFxRect = v)],
  battleFxTexture: [() => battleFxTexture, v => (battleFxTexture = v)],
  battleRampRgb: [() => battleRampRgb, v => (battleRampRgb = v)],
});
/* eslint-enable no-func-assign */
provide({ battleFxPass });
/* to-module: end */
/* per instance: place (3), its two half axes (3 + 3), atlas rect (4), colour and the share still shown (4), kind,
   cells across, ring width in cells, flags (4) */
const BATTLE_FX_FLOATS = 21;
/* the kinds */
export const BATTLE_FX_KIND = { sprite: 0, square: 1, ring: 2, beam: 3 };
const BATTLE_FX_LIT = 1,
  BATTLE_FX_GLOW = 2,
  /* VFX-10: a strip coloured by a ramp; the ramp's row is the flags over 8 */
  BATTLE_FX_RAMP = 4;
/* VFX-10: a mark on the ground keeps the world's 32 px/m */
const BATTLE_FX_GROUND_PX_M = 32;
/* a stage pixel at depth z is z / 170 m (the rigs' size rule, battle-stage.js STAGE_FRAME_WIDTH and the focal length) */
const STAGE_PIXELS_PER_METRE_AT_1M = 170;
export const BATTLE_FX_SHADERS = {
  battleFx: [
    `#version 300 es
precision highp float;layout(location=0) in vec2 aC;layout(location=1) in vec3 iP;layout(location=2) in vec3 iA;layout(location=3) in vec3 iB;layout(location=4) in vec4 iUV;layout(location=5) in vec4 iCol;layout(location=6) in vec4 iK;
uniform mat4 uVP;uniform float uCore;out vec2 vC;out vec2 vUV;out vec3 vW;flat out vec4 vCol;flat out vec4 vK;flat out vec4 vR;
void main(){vec2 c=aC*2.-1.;vec3 p=iP+iA*c.x+iB*(-c.y);vW=p;vC=aC;vUV=vec2(iUV.x+aC.x*iUV.z,iUV.y+aC.y*iUV.w);vCol=iCol;vK=iK;vR=iUV;
 gl_Position=uCore>.5&&mod(floor(iK.w/2.),2.)<.5?vec4(2.,2.,2.,1.):uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec2 vC;in vec2 vUV;in vec3 vW;flat in vec4 vCol;flat in vec4 vK;flat in vec4 vR;out vec4 o;uniform sampler2D uTex;uniform float uCore;uniform vec2 uRamp;${LIGHT_GLSL}
float fxBayer(vec2 p){ivec2 i=ivec2(mod(p,4.));int b[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return (float(b[i.y*4+i.x])+.5)/16.;}
void main(){int k=int(vK.x+.5),fl=int(vK.w+.5),gi=-1;vec3 c=vCol.rgb;bool core=false;vec2 cell=gl_FragCoord.xy;
 /* VFX-10: a strip's grey (8 greys, 36..255) picks its colour from its ramp's row */
 if(k==0){vec2 ts=vec2(textureSize(uTex,0));vec4 t=texture(uTex,vUV);if(t.a<.5)discard;cell=floor(vUV*ts);
  if((fl&4)!=0){gi=clamp(int(floor((t.r*255.-32.)/32.+.5)),0,7);core=gi==7;c*=texelFetch(uTex,ivec2(uRamp)+ivec2(gi,fl>>3),0).rgb;}
  else{core=min(t.r,min(t.g,t.b))>.75;c*=t.rgb;}}
 else if(k==2){float n=max(vK.y,1.);vec2 q=floor(vC*n);vec2 g=(q+.5)/n*2.-1.;float d=length(g);if(d>1.||d<1.-2.*max(vK.z,1.)/n)discard;cell=q;}
 /* VFX-11: a ray's strip, tiled vK.y times along it (its frame's rect in vR), coloured by its ramp as a strip is */
 else if(k==3&&(fl&4)!=0){vec2 ts=vec2(textureSize(uTex,0));vec2 uv=vec2(vR.x+fract(vC.x*max(vK.y,1.))*vR.z,vR.y+vC.y*vR.w);vec4 t=texture(uTex,uv);if(t.a<.5)discard;cell=floor(uv*ts);
  gi=clamp(int(floor((t.r*255.-32.)/32.+.5)),0,7);core=gi==7;c*=texelFetch(uTex,ivec2(uRamp)+ivec2(gi,fl>>3),0).rgb;}
 else if(k==3){core=abs(vC.y*2.-1.)<.35;if(core)c=vec3(1.);}
 else core=true;
 float bv=fxBayer(cell);if(bv>=vCol.a)discard;
 /* VFX-10: the eroding edge's texels (just under the threshold) are a rim, brighter: a strip two greys up its ramp */
 if(vCol.a<1.&&bv>vCol.a-.19){if(gi>=0)c=vCol.rgb*texelFetch(uTex,ivec2(uRamp)+ivec2(min(gi+2,7),fl>>3),0).rgb;else c=min(c*1.4+.12,vec3(1.));}
 bool glow=(fl&2)!=0;
 if(uCore>.5){if(!core)discard;o=vec4(fogit(c*.6,vW),0.);return;}
 if(!glow&&(fl&1)!=0)c*=mix(uAmbTop,vec3(1.),.5)+uSunCol*.4+points(vW,vec3(0.,1.,0.))*.6;
 o=vec4(fogit(c,vW),0.);}`,
  ],
};
/* the atlas: made once from icons.png when it has loaded (the sheet kept, so a new context only uploads it again) */
const battleFxAtlas = {
  sheet: null,
  rects: null,
  white: null,
  t: null,
  gl: null,
  gen: -1,
  w: 1,
  h: 1,
  /* VFX-10: the strips' places ({x, y, w, h, n} by sprite id), the ramps' rows by id and where the ramp block sits;
     the pictures and the ramps the sheet was made from, so a repainted strip (the Studio) or edited ramps make it
     again; up: bumped each time the sheet is made, so the texture uploads it */
  anims: {},
  rampRow: {},
  rampAt: [0, 0],
  made: null,
  up: 0,
  tUp: -1,
};
/* the widest strip is 8 frames of 32 px */
const BATTLE_FX_ATLAS_WIDTH = 260;
/* VFX-10: the effect strips' pictures (asked for on the first call; null until every one has loaded or failed).
   Through artLoad, so the Studio's unsaved pictures stay (it puts a repainted strip's canvas in ART_CACHE, marked
   complete, and the atlas is made again with it) */
let battleFxAnimAsked = false;
function battleFxAnimPictures() {
  const S = (BATTLE_ANIMS && BATTLE_ANIMS.sprites) || {},
    ids = Object.keys(S),
    path = id => `${BATTLE_ANIM_ART_DIR}${id}.png`;
  if (!battleFxAnimAsked) {
    battleFxAnimAsked = true;
    artLoad(ids.map(path));
  }
  const out = [];
  for (const id of ids) {
    const im = ART_CACHE.img[path(id)];
    if (!im) {
      /* a sprite added since (the Studio): ask for it */
      artLoad([path(id)]);
      return null;
    }
    if (!im.complete) return null;
    if (im.naturalWidth) out.push({ id, im, S: S[id] });
  }
  return out;
}
/* the ramps' colours (rows of 8), white for a ramp that doesn't resolve */
function battleFxRampRows() {
  const R = (BATTLE_ANIMS && BATTLE_ANIMS.ramps) || {},
    pal = (typeof window !== 'undefined' && window.NW_PALETTE && window.NW_PALETTE.ramps) || {},
    white = (BATTLE_ANIMS && BATTLE_ANIMS.colors && BATTLE_ANIMS.colors.white) || [255, 255, 255];
  return Object.keys(R).map(id => {
    const C = battleRampColors(R[id], pal, white, TYPE_GLOW && TYPE_GLOW[id]);
    return { id, rgb: (C ? C.steps : Array(8).fill(white)).map(h => hexToRgb(h)) };
  });
}
/* whether the sheet must be made again: the strips loaded since, a strip repainted, the ramps edited */
function battleFxAtlasStale(A, pics) {
  const M = A.made;
  if (!M) return true;
  if (pics && !M.pics) return true;
  if (pics && (pics.length !== M.pics.length || pics.some((p, i) => p.im !== M.pics[i].im || p.S !== M.pics[i].S)))
    return true;
  return !!(BATTLE_ANIMS && BATTLE_ANIMS.ramps !== M.ramps);
}
function battleFxAtlasSheet() {
  const A = battleFxAtlas;
  if (typeof ARTMAN === 'undefined' || !ARTMAN.icons || !artReady(ICON_ATLAS)) return A.sheet ? A : null;
  const pics0 = battleFxAnimPictures();
  if (A.sheet && !battleFxAtlasStale(A, pics0)) return A;
  const im = ART_CACHE.img[ICON_ATLAS],
    cv = makeCanvas(im.naturalWidth || im.width, im.naturalHeight || im.height),
    x = cv.getContext('2d');
  x.drawImage(im, 0, 0);
  const all = x.getImageData(0, 0, cv.width, cv.height),
    keys = Object.keys(ARTMAN.icons),
    pics = keys.map(k => {
      const [rx, ry, rw, rh] = ARTMAN.icons[k],
        p = kitBlank(rw, rh);
      for (let y = 0; y < rh; y++)
        for (let xx = 0; xx < rw; xx++) {
          const s = ((ry + y) * all.width + rx + xx) * 4,
            d = (y * rw + xx) * 4;
          for (let j = 0; j < 4; j++) p.data[d + j] = all.data[s + j];
        }
      return p;
    }),
    white = kitBlank(4, 4);
  white.data.fill(255);
  pics.push(white);
  /* VFX-10: the strips after the icons, then the ramps' block (8 texels a row) */
  const strips = pics0 || [],
    ramps = battleFxRampRows(),
    block = kitBlank(8, Math.max(1, ramps.length));
  for (const { im } of strips) {
    const c = makeCanvas(im.naturalWidth, im.naturalHeight),
      cx = c.getContext('2d');
    cx.drawImage(im, 0, 0);
    const d = cx.getImageData(0, 0, c.width, c.height),
      p = kitBlank(c.width, c.height);
    p.data.set(d.data);
    pics.push(p);
  }
  ramps.forEach((r, j) =>
    r.rgb.forEach((c, i) => {
      const o = (j * 8 + i) * 4;
      block.data[o] = c[0];
      block.data[o + 1] = c[1];
      block.data[o + 2] = c[2];
      block.data[o + 3] = 255;
    })
  );
  pics.push(block);
  const { sheet, spots } = kitPack(pics, BATTLE_FX_ATLAS_WIDTH);
  A.rects = {};
  keys.forEach((k, i) => (A.rects[k] = [spots[i][0], spots[i][1], pics[i].width, pics[i].height]));
  const ws = spots[keys.length];
  /* the white block's middle, so a flat kind's texture reads are all white */
  A.white = [(ws[0] + 1) / sheet.width, (ws[1] + 1) / sheet.height, 2 / sheet.width, 2 / sheet.height];
  A.anims = {};
  strips.forEach(({ id, S }, i) => {
    const at = spots[keys.length + 1 + i];
    A.anims[id] = { x: at[0], y: at[1], w: S.cell[0], h: S.cell[1], n: S.frames, S };
  });
  A.rampRow = {};
  ramps.forEach((r, j) => (A.rampRow[r.id] = j));
  A.rampAt = spots[spots.length - 1];
  A.made = { pics: pics0, ramps: BATTLE_ANIMS && BATTLE_ANIMS.ramps };
  A.sheet = sheet;
  A.w = sheet.width;
  A.h = sheet.height;
  A.up++;
  return A;
}
/* VFX-10: whether a strip is in the atlas (until the strips have loaded the stage keeps the old icons) */
export function battleFxHasAnim(id) {
  const A = battleFxAtlasSheet();
  return !!(A && A.anims[id]);
}
/* VFX-10: a ramp's 8 colours as [r, g, b] (0-255), index 7 the white core, for whoever colours a strip of its own
   (VFX-15's scars); null for an id with no ramp */
export function battleRampRgb(id) {
  const r = battleFxRampRows().find(x => x.id === id);
  return r ? r.rgb : null;
}
/* the atlas texture, made again on a new context (gpuState.gen) */
function battleFxTexture() {
  const A = battleFxAtlasSheet();
  if (!A) return null;
  const gl = gpuState.gl;
  if (A.t && A.gl === gl && A.gen === gpuState.gen && A.tUp === A.up) return A;
  /* a new context, or the sheet made again (VFX-10: the strips loaded, a strip repainted): a texture of its size */
  if (A.t && A.gl === gl && A.gen === gpuState.gen) gpuFree(A.t);
  A.t = gpuTexture('other', A.w * A.h * 4);
  /* on unit 0, which the pass uses (another unit may hold a texture another pass counts on) */
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, A.t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, A.w, A.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, A.sheet.data);
  setTextureParams({});
  A.gl = gl;
  A.gen = gpuState.gen;
  A.tUp = A.up;
  return A;
}
/* an icon's rect in the atlas (null for a key it hasn't) */
function battleFxRect(key) {
  const A = battleFxAtlasSheet();
  return A && A.rects[key] ? A.rects[key] : null;
}
const battleFxBatch = { n: 0, d: new Float32Array(BATTLE_FX_FLOATS * 64), glow: 0 };
function battleFxPut(px, py, pz, ax, ay, az, bx, by, bz, uv, col, a, kind, n, th, flags) {
  const B = battleFxBatch;
  if ((B.n + 1) * BATTLE_FX_FLOATS > B.d.length) {
    const d = new Float32Array(B.d.length * 2);
    d.set(B.d);
    B.d = d;
  }
  const d = B.d,
    o = B.n++ * BATTLE_FX_FLOATS;
  d[o] = px;
  d[o + 1] = py + worldCurveDrop(px, pz);
  d[o + 2] = pz;
  d[o + 3] = ax;
  d[o + 4] = ay;
  d[o + 5] = az;
  d[o + 6] = bx;
  d[o + 7] = by;
  d[o + 8] = bz;
  d[o + 9] = uv[0];
  d[o + 10] = uv[1];
  d[o + 11] = uv[2];
  d[o + 12] = uv[3];
  d[o + 13] = col[0];
  d[o + 14] = col[1];
  d[o + 15] = col[2];
  d[o + 16] = a;
  d[o + 17] = kind;
  d[o + 18] = n;
  d[o + 19] = th;
  d[o + 20] = flags;
  if (flags & BATTLE_FX_GLOW) B.glow++;
}
const BATTLE_FX_UV = [0, 0, 0, 0],
  BATTLE_FX_ONE = [1, 1, 1];
/* the battle's particles (battle-3d.js: {k, x, y, z, a (shown share), glow, ...} in the walk scene's metres) in the
   pool's two draws; returns the draws made. Called from inside the effects pass (walk/effects.js), before its glows,
   which puts its own state back after: drawn as the frame's last thing before the post pass instead, it spoiled the
   reflection and shadow maps the next frame reuses (seen headless in SwiftShader, every other frame; not understood,
   the GL state after it was the same) */
function battleFxPass(C, F, X) {
  if (!F || !F.length) return 0;
  const A = battleFxTexture();
  if (!A) return 0;
  const gl = gpuState.gl,
    R = C.right,
    E = C.eye,
    W = C.fwd,
    B = battleFxBatch,
    S = STAGE_PIXELS_PER_METRE_AT_1M,
    S0 = STAGE_PIXELS_PER_METRE_AT_1M;
  B.n = 0;
  B.glow = 0;
  for (const q of F) {
    const fl = (q.glow ? BATTLE_FX_GLOW : 0) | (q.lit === false ? 0 : BATTLE_FX_LIT),
      a = Math.min(1, Math.max(0, q.a));
    if (a <= 0.01) continue;
    if (q.k === BATTLE_FX_KIND.sprite && q.anim && A.anims[q.anim]) {
      /* VFX-10: a strip's frame, coloured by its ramp's row, its anchor on its place: a texel is a stage pixel at its
         depth (the rig pixels' size beside it), or on the ground the world's 32 px/m, times a whole number */
      const N = A.anims[q.anim],
        S = N.S,
        z = Math.max(0.3, (q.x - E[0]) * W[0] + (q.y - E[1]) * W[1] + (q.z - E[2]) * W[2]),
        k = Math.max(1, Math.round(q.scale || 1)),
        px = S.ground ? k / BATTLE_FX_GROUND_PX_M : (z / S0) * k,
        f = Math.min(N.n - 1, Math.max(0, q.f | 0)),
        hw = (N.w * px) / 2,
        hh = (N.h * px) / 2,
        ox = (N.w / 2 - S.anchor[0] - 0.5) * px,
        oy = (S.anchor[1] + 0.5 - N.h / 2) * px,
        row = A.rampRow[q.ramp] ?? A.rampRow.None ?? 0,
        fr = fl | BATTLE_FX_RAMP | (row << 3),
        uv = BATTLE_FX_UV;
      uv[0] = (N.x + f * N.w) / A.w;
      uv[1] = N.y / A.h;
      uv[2] = N.w / A.w;
      uv[3] = N.h / A.h;
      /* on the ground: flat, its top row the far side. VFX-11: a flipped strip (q.flip -1) is mirrored across */
      const fw = q.flip === -1 ? -1 : 1;
      if (S.ground) battleFxPut(q.x + ox, q.y + 0.02, q.z - oy, hw, 0, 0, 0, 0, -hh, uv, BATTLE_FX_ONE, a, 0, 1, 0, fr);
      else
        battleFxPut(
          q.x + R[0] * ox * fw,
          q.y + R[1] * ox * fw + oy,
          q.z + R[2] * ox * fw,
          R[0] * hw * fw,
          R[1] * hw * fw,
          R[2] * hw * fw,
          0,
          hh,
          0,
          uv,
          BATTLE_FX_ONE,
          a,
          0,
          1,
          0,
          fr
        );
    } else if (q.k === BATTLE_FX_KIND.sprite) {
      const r = A.rects[q.key];
      if (!r) continue;
      const hw = (r[2] * q.s) / 2,
        hh = (r[3] * q.s) / 2,
        uv = BATTLE_FX_UV;
      uv[0] = r[0] / A.w;
      uv[1] = r[1] / A.h;
      uv[2] = r[2] / A.w;
      uv[3] = r[3] / A.h;
      battleFxPut(q.x, q.y, q.z, R[0] * hw, R[1] * hw, R[2] * hw, 0, hh, 0, uv, q.col || BATTLE_FX_ONE, a, 0, 1, 0, fl);
    } else if (q.k === BATTLE_FX_KIND.square) {
      const h = q.size / 2;
      battleFxPut(q.x, q.y, q.z, R[0] * h, R[1] * h, R[2] * h, 0, h, 0, A.white, q.col, a, 1, 1, 0, fl);
    } else if (q.k === BATTLE_FX_KIND.ring) {
      /* a ring of whole stage pixels at its depth: n cells across, th cells wide */
      const z = Math.max(0.3, (q.x - E[0]) * W[0] + (q.y - E[1]) * W[1] + (q.z - E[2]) * W[2]),
        px = z / S,
        n = Math.max(4, Math.round((2 * q.r) / px));
      if (q.ground)
        battleFxPut(q.x, q.y, q.z, q.r, 0, 0, 0, 0, -q.r * (q.flat ?? 1), A.white, q.col, a, 2, n, q.th, fl);
      else battleFxPut(q.x, q.y, q.z, R[0] * q.r, R[1] * q.r, R[2] * q.r, 0, q.r, 0, A.white, q.col, a, 2, n, q.th, fl);
    } else if (q.k === BATTLE_FX_KIND.beam) {
      /* a strip from one end to the other, its width across the line of sight */
      const dx = q.x2 - q.x,
        dy = q.y2 - q.y,
        dz = q.z2 - q.z,
        mx = (q.x + q.x2) / 2,
        my = (q.y + q.y2) / 2,
        mz = (q.z + q.z2) / 2,
        vx = mx - E[0],
        vy = my - E[1],
        vz = mz - E[2];
      let cx = dy * vz - dz * vy,
        cy = dz * vx - dx * vz,
        cz = dx * vy - dy * vx;
      const cl = Math.hypot(cx, cy, cz) || 1,
        N = q.anim ? A.anims[q.anim] : null;
      if (N) {
        /* VFX-11: a ray's strip: as wide as its cell at the stage pixel's size at its depth (the texel rule), its
           frame tiled along its length */
        const z = Math.max(0.3, vx * W[0] + vy * W[1] + vz * W[2]),
          px = (z / S0) * Math.max(1, Math.round(q.scale || 1)),
          h = (N.h * px) / 2 / cl,
          f = Math.min(N.n - 1, Math.max(0, q.f | 0)),
          uv = BATTLE_FX_UV,
          row = A.rampRow[q.ramp] ?? A.rampRow.None ?? 0;
        uv[0] = (N.x + f * N.w) / A.w;
        uv[1] = N.y / A.h;
        uv[2] = N.w / A.w;
        uv[3] = N.h / A.h;
        const tiles = Math.max(1, Math.round(Math.hypot(dx, dy, dz) / (N.w * px)));
        battleFxPut(
          mx,
          my,
          mz,
          dx / 2,
          dy / 2,
          dz / 2,
          cx * h,
          cy * h,
          cz * h,
          uv,
          BATTLE_FX_ONE,
          a,
          3,
          tiles,
          0,
          fl | BATTLE_FX_RAMP | (row << 3)
        );
        continue;
      }
      const h = q.w / 2 / cl;
      cx *= h;
      cy *= h;
      cz *= h;
      battleFxPut(mx, my, mz, dx / 2, dy / 2, dz / 2, cx, cy, cz, A.white, q.col, a, 3, 1, 0, fl);
    }
  }
  const n = B.n;
  if (!n) return 0;
  ensurePrograms(BATTLE_FX_SHADERS);
  const p = useWalkProgram('battleFx', C, X);
  if (!p.bfx) {
    /* made with the program, so a new context (initWebgl empties gpuState.P) makes them again */
    const vao = gpuVao('instances'),
      buf = gpuBuffer('instances'),
      St = BATTLE_FX_FLOATS * 4;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gpuState.quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    [
      [1, 3, 0],
      [2, 3, 3],
      [3, 3, 6],
      [4, 4, 9],
      [5, 4, 13],
      [6, 4, 17],
    ].forEach(([l, k, o]) => {
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, k, gl.FLOAT, false, St, o * 4);
      gl.vertexAttribDivisor(l, 1);
    });
    gl.bindVertexArray(null);
    p.bfx = { vao, buf };
  }
  gl.uniform1i(p.U.uTex, 0);
  if (p.U.uRamp) gl.uniform2f(p.U.uRamp, A.rampAt[0], A.rampAt[1]);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, A.t);
  gl.bindBuffer(gl.ARRAY_BUFFER, p.bfx.buf);
  gl.bufferData(gl.ARRAY_BUFFER, B.d.subarray(0, n * BATTLE_FX_FLOATS), gl.DYNAMIC_DRAW);
  gpuSized(p.bfx.buf, n * BATTLE_FX_FLOATS * 4);
  gl.bindVertexArray(p.bfx.vao);
  gl.disable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  /* the cutout draw */
  gl.disable(gl.BLEND);
  gl.depthMask(true);
  gl.uniform1f(p.U.uCore, 0);
  gpuTag('battleFx');
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
  let draws = 1;
  /* the glowing ones' white cores, added (HDR: the bloom spreads them) */
  gl.enable(gl.BLEND);
  gl.depthMask(false);
  if (B.glow) {
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.uniform1f(p.U.uCore, 1);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    draws++;
  }
  gpuTag(0);
  gl.bindVertexArray(null);
  bindQuad();
  return draws;
}

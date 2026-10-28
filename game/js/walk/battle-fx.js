'use strict';
/* ================= BATTLE EFFECTS IN ONE DRAW (VFX track VFX-9) =================
   The battle's move and ambient particles (icon sprites, dust, rings, beams; battle-3d.js battle3dFrame lists them)
   as instances of one quad over one atlas, in two draws: a cutout draw (each pixel kept whole or discarded, depth
   written, so nothing is sorted and depth of field reads each particle's own depth; a fade is erosion, a hard step
   against a 4x4 Bayer pattern on the effect's own texels; alpha 0 out, so the ink outlines skip it as they skip the
   ground), then the glowing ones' white cores added on top. Copied from the weather's batch (walk/effects.js
   weatherBatch). The atlas packs icons.png's cells (logic/kit-assemble.js kitPack) with a white block for the flat
   kinds; VFX-10 adds the effect strips. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import { kitBlank } from '../logic/kit-pixels.js';
import { kitPack } from '../logic/kit-assemble.js';
import { gpuTag } from '../engine/gpu-counters.js';
import { ART_CACHE, ICON_ATLAS, artReady, makeCanvas } from '../art.js';
import {
  LIGHT_GLSL,
  bindQuad,
  ensurePrograms,
  gpuBuffer,
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
  BATTLE_FX_KIND: [() => BATTLE_FX_KIND],
  BATTLE_FX_LIT: [() => BATTLE_FX_LIT],
  BATTLE_FX_ONE: [() => BATTLE_FX_ONE],
  BATTLE_FX_SHADERS: [() => BATTLE_FX_SHADERS],
  BATTLE_FX_UV: [() => BATTLE_FX_UV],
  STAGE_PIXELS_PER_METRE_AT_1M: [() => STAGE_PIXELS_PER_METRE_AT_1M],
  battleFxAtlas: [() => battleFxAtlas],
  battleFxAtlasSheet: [() => battleFxAtlasSheet, v => (battleFxAtlasSheet = v)],
  battleFxBatch: [() => battleFxBatch],
  battleFxPass: [() => battleFxPass, v => ((battleFxPass = v), provide({ battleFxPass }))],
  battleFxPut: [() => battleFxPut, v => (battleFxPut = v)],
  battleFxRect: [() => battleFxRect, v => (battleFxRect = v)],
  battleFxTexture: [() => battleFxTexture, v => (battleFxTexture = v)],
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
  BATTLE_FX_GLOW = 2;
/* a stage pixel at depth z is z / 170 m (the rigs' size rule, battle-stage.js STAGE_FRAME_WIDTH and the focal length) */
const STAGE_PIXELS_PER_METRE_AT_1M = 170;
export const BATTLE_FX_SHADERS = {
  battleFx: [
    `#version 300 es
precision highp float;layout(location=0) in vec2 aC;layout(location=1) in vec3 iP;layout(location=2) in vec3 iA;layout(location=3) in vec3 iB;layout(location=4) in vec4 iUV;layout(location=5) in vec4 iCol;layout(location=6) in vec4 iK;
uniform mat4 uVP;uniform float uCore;out vec2 vC;out vec2 vUV;out vec3 vW;flat out vec4 vCol;flat out vec4 vK;
void main(){vec2 c=aC*2.-1.;vec3 p=iP+iA*c.x+iB*(-c.y);vW=p;vC=aC;vUV=vec2(iUV.x+aC.x*iUV.z,iUV.y+aC.y*iUV.w);vCol=iCol;vK=iK;
 gl_Position=uCore>.5&&mod(floor(iK.w/2.),2.)<.5?vec4(2.,2.,2.,1.):uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec2 vC;in vec2 vUV;in vec3 vW;flat in vec4 vCol;flat in vec4 vK;out vec4 o;uniform sampler2D uTex;uniform float uCore;${LIGHT_GLSL}
float fxBayer(vec2 p){ivec2 i=ivec2(mod(p,4.));int b[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return (float(b[i.y*4+i.x])+.5)/16.;}
void main(){int k=int(vK.x+.5);vec3 c=vCol.rgb;bool core=false;vec2 cell=gl_FragCoord.xy;
 if(k==0){vec2 ts=vec2(textureSize(uTex,0));vec4 t=texture(uTex,vUV);if(t.a<.5)discard;cell=floor(vUV*ts);core=min(t.r,min(t.g,t.b))>.75;c*=t.rgb;}
 else if(k==2){float n=max(vK.y,1.);vec2 q=floor(vC*n);vec2 g=(q+.5)/n*2.-1.;float d=length(g);if(d>1.||d<1.-2.*max(vK.z,1.)/n)discard;cell=q;}
 else if(k==3){core=abs(vC.y*2.-1.)<.35;if(core)c=vec3(1.);}
 else core=true;
 if(fxBayer(cell)>=vCol.a)discard;
 float fl=vK.w;bool glow=mod(floor(fl/2.),2.)>.5;
 if(uCore>.5){if(!core)discard;o=vec4(fogit(c*.6,vW),0.);return;}
 if(!glow&&mod(fl,2.)>.5)c*=mix(uAmbTop,vec3(1.),.5)+uSunCol*.4+points(vW,vec3(0.,1.,0.))*.6;
 o=vec4(fogit(c,vW),0.);}`,
  ],
};
/* the atlas: made once from icons.png when it has loaded (the sheet kept, so a new context only uploads it again) */
const battleFxAtlas = { sheet: null, rects: null, white: null, t: null, gl: null, gen: -1, w: 1, h: 1 };
const BATTLE_FX_ATLAS_WIDTH = 128;
function battleFxAtlasSheet() {
  const A = battleFxAtlas;
  if (A.sheet) return A;
  if (typeof ARTMAN === 'undefined' || !ARTMAN.icons || !artReady(ICON_ATLAS)) return null;
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
  const { sheet, spots } = kitPack(pics, BATTLE_FX_ATLAS_WIDTH);
  A.rects = {};
  keys.forEach((k, i) => (A.rects[k] = [spots[i][0], spots[i][1], pics[i].width, pics[i].height]));
  const ws = spots[spots.length - 1];
  /* the white block's middle, so a flat kind's texture reads are all white */
  A.white = [(ws[0] + 1) / sheet.width, (ws[1] + 1) / sheet.height, 2 / sheet.width, 2 / sheet.height];
  A.sheet = sheet;
  A.w = sheet.width;
  A.h = sheet.height;
  return A;
}
/* the atlas texture, made again on a new context (gpuState.gen) */
function battleFxTexture() {
  const A = battleFxAtlasSheet();
  if (!A) return null;
  const gl = gpuState.gl;
  if (A.t && A.gl === gl && A.gen === gpuState.gen) return A;
  A.t = gpuTexture('other', A.w * A.h * 4);
  /* on unit 0, which the pass uses (another unit may hold a texture another pass counts on) */
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, A.t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, A.w, A.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, A.sheet.data);
  setTextureParams({});
  A.gl = gl;
  A.gen = gpuState.gen;
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
    S = STAGE_PIXELS_PER_METRE_AT_1M;
  B.n = 0;
  B.glow = 0;
  for (const q of F) {
    const fl = (q.glow ? BATTLE_FX_GLOW : 0) | (q.lit === false ? 0 : BATTLE_FX_LIT),
      a = Math.min(1, Math.max(0, q.a));
    if (a <= 0.01) continue;
    if (q.k === BATTLE_FX_KIND.sprite) {
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
        h = q.w / 2 / cl;
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

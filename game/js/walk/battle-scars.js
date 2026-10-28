'use strict';
/* ================= BATTLE SCARS (VFX track VFX-15) =================
   Marks a battle leaves on the ground for as long as it lasts: a scorch, a puddle, a crack, leaf litter, a sand drift,
   a dent (battleAnims.json `scars`; battle-stage-look.js picks one per hit and one more on a KO). Each is a small
   patch of 3x3 vertices laid on the ground's height (standingHeightAt), lit as the face program lights a building's
   wall (sun, shade, contact shade, the point lights, fog), all of them in one draw from one small atlas. Drawn as
   cutout (each texel kept or not, alpha 0 out so the ink outlines skip it, as they skip the ground), never on water.
   At most 12 / 8 / 4 / 0 by the battle's quality, the oldest replaced; when the battle ends they go in four dithered
   steps over 400 ms (a hard step against a 4x4 Bayer pattern on their own texels).
   The art: VFX-10's six decals (game/art/battle/anims/scar_*.png, battleAnims.json sprites with `ground`, 32 px a
   metre, 8 greys), coloured by each kind's ramp (VFX-10's ramps; its `color` where the ramp doesn't resolve); a
   procedural stand-in (scarPlaceholder) only where a picture is missing. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { BATTLE_ANIMS, provide } from '../hooks.js';
import { kitBlank } from '../logic/kit-pixels.js';
import { kitPack } from '../logic/kit-assemble.js';
import { BATTLE_ANIM_ART_DIR } from '../logic/battle-anims.js';
import { scarAdd, scarCap, scarFadeShare, scarSize } from '../logic/battle-stage-look.js';
import { gpuTag } from '../engine/gpu-counters.js';
import { ART_CACHE, artLoad, hexToRgb, makeCanvas } from '../art.js';
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
import { standingHeightAt } from './heights.js';
import { useWalkProgram, worldCurveDrop } from './draw-common.js';
import { waterAt } from './water.js';
import { battleRampRgb } from './battle-fx.js';
/* eslint-disable no-func-assign */
expose({
  BATTLE_SCAR_SHADERS: [() => BATTLE_SCAR_SHADERS],
  SCAR_FLOATS: [() => SCAR_FLOATS],
  SCAR_GREYS: [() => SCAR_GREYS],
  SCAR_LIFT: [() => SCAR_LIFT],
  SCAR_PX_PER_M: [() => SCAR_PX_PER_M],
  SCAR_VERTS: [() => SCAR_VERTS],
  battleScarAdd: [() => battleScarAdd, v => ((battleScarAdd = v), provide({ battleScarAdd }))],
  battleScarPass: [() => battleScarPass, v => ((battleScarPass = v), provide({ battleScarPass }))],
  battleScars: [() => battleScars],
  battleScarsClear: [() => battleScarsClear, v => ((battleScarsClear = v), provide({ battleScarsClear }))],
  battleScarsEnd: [() => battleScarsEnd, v => (battleScarsEnd = v)],
  onWater: [() => onWater],
  scarArtPicture: [() => scarArtPicture, v => (scarArtPicture = v)],
  scarArtPixels: [() => scarArtPixels, v => (scarArtPixels = v)],
  scarAtlas: [() => scarAtlas],
  scarAtlasSheet: [() => scarAtlasSheet, v => (scarAtlasSheet = v)],
  scarHash: [() => scarHash],
  scarPlaceholder: [() => scarPlaceholder, v => (scarPlaceholder = v)],
  scarTexture: [() => scarTexture, v => (scarTexture = v)],
  scarVertices: [() => scarVertices, v => (scarVertices = v)],
});
/* eslint-enable no-func-assign */
provide({ battleScarAdd, battleScarPass, battleScarsClear });
/* to-module: end */
/* the world's texel size for marks on the ground (vfx-track.md, "How Part 2 fits the art", rule 2) */
const SCAR_PX_PER_M = 32;
/* per vertex: place (3), atlas uv (2), normal (3), tint (3), the share still shown (1) */
const SCAR_FLOATS = 12;
/* 4 quads of 2 triangles from the 3x3 grid */
const SCAR_VERTS = 24;
/* how far above the ground a scar lies, besides the depth offset */
const SCAR_LIFT = 0.02;
export const BATTLE_SCAR_SHADERS = {
  battleScar: [
    `#version 300 es
precision highp float;layout(location=0) in vec3 aP;layout(location=1) in vec2 aUV;layout(location=2) in vec3 aN;layout(location=3) in vec3 aCol;layout(location=4) in float aA;
uniform mat4 uVP;out vec2 vUV;out vec3 vW;out vec3 vN;flat out vec3 vCol;flat out float vA;
void main(){vW=aP;vUV=aUV;vN=aN;vCol=aCol;vA=aA;gl_Position=uVP*vec4(aP,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;in vec3 vW;in vec3 vN;flat in vec3 vCol;flat in float vA;out vec4 o;uniform sampler2D uTex;${LIGHT_GLSL}
float scarBayer(vec2 p){ivec2 i=ivec2(mod(p,4.));int b[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return (float(b[i.y*4+i.x])+.5)/16.;}
void main(){vec2 ts=vec2(textureSize(uTex,0));vec4 t=texture(uTex,vUV);if(t.a<.5)discard;if(scarBayer(floor(vUV*ts))>=vA)discard;
 vec3 c=clamp(t.rgb*vCol*2.,0.,1.),n=normalize(vN);float sh=shadowAtN(vW+n*.05,n,.0012),ao=contactAO(vW);
 o=vec4(fogit(shade(c,n,vW,sh,ao,vec4(0.,1.,0.,.2),0.),vW),0.);}`,
  ],
};
/** the battle's scars: each {kind, x, z, m, turn, flip, v (its 24 vertices)}; ended: when the battle ended (real
 * time), or 0 while it lasts */
const battleScars = {
  list: /** @type {any[]} */ ([]),
  ended: 0,
  d: new Float32Array(SCAR_FLOATS * SCAR_VERTS * 12),
};
provide({ battleScars }); /* to-module */
/* ---------- the art ---------- */
/* a small hash for the placeholders' pixels (the same every time) */
const scarHash = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ s) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
/** VFX-15: a stand-in for a kind's decal until VFX-10's is in: grey values round the middle (the kind's colour is
 * multiplied in at twice, so .5 is the colour itself), hard edges, px square */
function scarPlaceholder(kind, px) {
  const P = kitBlank(px, px),
    c = (px - 1) / 2,
    seed = [...kind].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7),
    put = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ v) => {
      if (x < 0 || y < 0 || x >= px || y >= px) return;
      const o = (y * px + x) * 4,
        g = Math.round(Math.max(0, Math.min(1, v)) * 255);
      P.data[o] = P.data[o + 1] = P.data[o + 2] = g;
      P.data[o + 3] = 255;
    };
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      const dx = (x - c) / (px / 2),
        dy = (y - c) / (px / 2),
        r = Math.hypot(dx, dy),
        n = scarHash(x, y, seed),
        a = Math.atan2(dy, dx),
        edge = 0.78 + 0.18 * Math.sin(a * 5 + seed) + (n - 0.5) * 0.18;
      if (kind === 'scorch') {
        if (r < edge) put(x, y, r < edge * 0.45 ? 0.25 + n * 0.1 : r < edge * 0.8 ? 0.4 + n * 0.12 : 0.55);
      } else if (kind === 'puddle') {
        if (r < edge * 0.85) put(x, y, r > edge * 0.7 ? 0.42 : n < 0.04 ? 0.95 : 0.55 + n * 0.06);
      } else if (kind === 'sand') {
        const e = Math.hypot(dx * 0.8, dy * 1.5);
        if (e < edge) put(x, y, 0.45 + 0.1 * ((y + Math.round(x / 3)) % 3 === 0 ? 1 : 0) + n * 0.06);
      } else if (kind === 'dent') {
        if (r < 0.9) put(x, y, r > 0.72 ? 0.7 : r > 0.55 ? 0.38 : 0.3 + n * 0.08);
      }
    }
  if (kind === 'crack') {
    /* five jagged lines out from the middle, a pixel wide, darker inside */
    for (let k = 0; k < 5; k++) {
      let a = (k / 5) * Math.PI * 2 + scarHash(k, 1, seed) * 0.9,
        x = c,
        y = c;
      const len = px * (0.3 + scarHash(k, 2, seed) * 0.2);
      for (let s = 0; s < len; s++) {
        a += (scarHash(k, s, seed) - 0.5) * 0.7;
        x += Math.cos(a);
        y += Math.sin(a);
        put(Math.round(x), Math.round(y), 0.2 + s / len / 4);
      }
    }
  } else if (kind === 'leaf') {
    /* leaves of 2x3 pixels scattered over a disc, light and dark */
    for (let k = 0; k < Math.round(px * 0.9); k++) {
      const a = scarHash(k, 3, seed) * Math.PI * 2,
        r = Math.sqrt(scarHash(k, 4, seed)) * (px / 2 - 2),
        x = Math.round(c + Math.cos(a) * r),
        y = Math.round(c + Math.sin(a) * r),
        v = scarHash(k, 5, seed) < 0.5 ? 0.42 : 0.62,
        w = scarHash(k, 6, seed) < 0.5;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) put(x + (w ? j : i), y + (w ? i : j), v);
    }
  }
  return P;
}
/* VFX-10's strips are 8 greys, darkest first (index 7 the white core) */
const SCAR_GREYS = [36, 64, 96, 128, 160, 192, 224, 255];
/** a kind's decal: VFX-10's picture (battleAnims.json sprites, a mark on the ground), loaded through artLoad (so a
 * repaint in the Studio's Art browser is the one used); undefined while it loads, null when there is none */
function scarArtPicture(kind) {
  const K = BATTLE_ANIMS.scars.kinds[kind],
    S = BATTLE_ANIMS.sprites && BATTLE_ANIMS.sprites[K.sprite];
  if (!S || !S.ground) return null;
  const path = `${BATTLE_ANIM_ART_DIR}${K.sprite}.png`,
    im = ART_CACHE.img[path];
  if (!im) {
    artLoad([path]);
    return undefined;
  }
  if (!im.complete) return undefined;
  return im.naturalWidth ? { im, S } : null;
}
/** a kind's decal pixels at 32 px a metre: VFX-10's picture, its greys coloured by the kind's ramp (baked: the tint is
 * then none), or by its colour where the ramp doesn't resolve; the stand-in (scarPlaceholder) where the picture is
 * missing; undefined while it loads */
function scarArtPixels(kind) {
  const S = BATTLE_ANIMS.scars,
    K = S.kinds[kind],
    a = scarArtPicture(kind);
  if (a === undefined) return undefined;
  if (!a) return { P: scarPlaceholder(kind, Math.max(4, Math.round(scarSize(S, kind) * SCAR_PX_PER_M))), baked: false };
  const [w, h] = a.S.cell,
    cv = makeCanvas(w, h),
    x = cv.getContext('2d');
  x.drawImage(a.im, 0, 0, w, h, 0, 0, w, h);
  const D = x.getImageData(0, 0, w, h),
    P = kitBlank(w, h),
    rgb = K.ramp && typeof battleRampRgb === 'function' ? battleRampRgb(K.ramp) : null;
  for (let i = 0; i < w * h; i++) {
    const o = i * 4,
      g = D.data[o];
    if (D.data[o + 3] < 128) continue;
    let best = 0;
    for (let j = 1; j < 8; j++) if (Math.abs(SCAR_GREYS[j] - g) < Math.abs(SCAR_GREYS[best] - g)) best = j;
    const c = rgb ? rgb[best] : [g, g, g];
    P.data[o] = c[0];
    P.data[o + 1] = c[1];
    P.data[o + 2] = c[2];
    P.data[o + 3] = 255;
  }
  return { P, baked: !!rgb };
}
/** the atlas: every kind's decal packed once its pictures have loaded (rects in texels: x, y, w, h; baked: coloured
 * by its ramp already) */
const scarAtlas = {
  sheet: null,
  rects: /** @type {Record<string, number[]>} */ ({}),
  baked: /** @type {Record<string, boolean>} */ ({}),
  t: null,
  gl: null,
  gen: -1,
};
function scarAtlasSheet() {
  if (scarAtlas.sheet) return scarAtlas;
  const S = BATTLE_ANIMS.scars;
  if (!S) return null;
  const kinds = Object.keys(S.kinds),
    arts = kinds.map(k => scarArtPixels(k));
  if (arts.some(a => !a)) return null;
  const { sheet, spots } = kitPack(
    arts.map(a => a.P),
    128
  );
  kinds.forEach((k, i) => {
    scarAtlas.rects[k] = [spots[i][0], spots[i][1], arts[i].P.width, arts[i].P.height];
    scarAtlas.baked[k] = arts[i].baked;
  });
  scarAtlas.sheet = sheet;
  return scarAtlas;
}
function scarTexture() {
  const A = scarAtlasSheet();
  if (!A) return null;
  const gl = gpuState.gl;
  if (A.t && A.gl === gl && A.gen === gpuState.gen) return A;
  A.t = gpuTexture('other', A.sheet.width * A.sheet.height * 4);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, A.t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, A.sheet.width, A.sheet.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, A.sheet.data);
  setTextureParams({});
  A.gl = gl;
  A.gen = gpuState.gen;
  return A;
}
/* ---------- the list ---------- */
const onWater = (/** @type {number} */ x, /** @type {number} */ z) => {
  const g = waterAt(x, z);
  return !!(g && g.dep > 0);
};
/** VFX-15: a scar of kind at (x, z) in the walk scene, quality q (its cap); turn (0-3 quarter turns) and flip from
 * the effects' random stream. Never on water (its middle or a corner); returns it, or null */
function battleScarAdd(kind, x, z, q, turn = 0, flip = false) {
  const S = BATTLE_ANIMS.scars;
  if (!S || !S.kinds[kind]) return null;
  const cap = scarCap(S, q),
    m = scarSize(S, kind),
    h = m / 2;
  if (!cap || !m) return null;
  for (const [ox, oz] of [
    [0, 0],
    [-h, -h],
    [h, -h],
    [-h, h],
    [h, h],
  ])
    if (onWater(x + ox, z + oz)) return null;
  if (battleScars.ended) {
    battleScars.list.length = 0;
    battleScars.ended = 0;
  }
  /* its vertices once the atlas is made (the decals may still be loading: battleScarPass) */
  scarAtlasSheet();
  const sc = { kind, x, z, m, turn: turn & 3, flip, v: null };
  scarAdd(battleScars.list, sc, cap);
  return sc;
}
/** VFX-15: the battle ended: its scars fade out (real time) */
export function battleScarsEnd() {
  if (battleScars.list.length && !battleScars.ended) battleScars.ended = performance.now();
}
/** VFX-15: a new battle: none from the last */
function battleScarsClear() {
  battleScars.list.length = 0;
  battleScars.ended = 0;
}
/* the 24 vertices of a scar's 3x3 grid, laid on the ground, without its shown share (filled each frame): its
   decal's size at 32 px a metre (at most maxM a side), its tint none when the ramp coloured it */
function scarVertices(sc, A) {
  const { kind, x, z, turn, flip } = sc,
    r = A.rects[kind],
    sheet = A.sheet,
    S = BATTLE_ANIMS.scars,
    mx = Math.min(S.maxM, r[2] / SCAR_PX_PER_M),
    mz = Math.min(S.maxM, r[3] / SCAR_PX_PER_M),
    c = A.baked[kind] ? [128, 128, 128] : hexToRgb(S.kinds[kind].color),
    col = [c[0] / 255, c[1] / 255, c[2] / 255],
    ca = [1, 0, -1, 0][turn],
    sa = [0, 1, 0, -1][turn],
    /* the grid's points: place, uv, normal */
    G = [];
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < 3; i++) {
      let lx = (i / 2 - 0.5) * mx,
        lz = (j / 2 - 0.5) * mz;
      if (flip) lx = -lx;
      const wx = x + lx * ca - lz * sa,
        wz = z + lx * sa + lz * ca,
        e = 0.12,
        hy = standingHeightAt(wx, wz),
        nx = standingHeightAt(wx - e, wz) - standingHeightAt(wx + e, wz),
        nz = standingHeightAt(wx, wz - e) - standingHeightAt(wx, wz + e),
        nl = Math.hypot(nx, 2 * e, nz);
      G.push({
        p: [wx, hy + SCAR_LIFT + worldCurveDrop(wx, wz), wz],
        uv: [(r[0] + (i / 2) * r[2]) / sheet.width, (r[1] + (j / 2) * r[3]) / sheet.height],
        n: [nx / nl, (2 * e) / nl, nz / nl],
      });
    }
  const v = new Float32Array(SCAR_VERTS * SCAR_FLOATS);
  let o = 0;
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const a = j * 3 + i,
        b = a + 1,
        cc = a + 3,
        d = a + 4;
      for (const k of [a, b, d, a, d, cc]) {
        const g = G[k];
        v.set(g.p, o);
        v.set(g.uv, o + 3);
        v.set(g.n, o + 5);
        v.set(col, o + 8);
        v[o + 11] = 1;
        o += SCAR_FLOATS;
      }
    }
  return v;
}
/* ---------- drawing ---------- */
/** VFX-15: the scars in one draw, inside the effects pass (walk/effects.js, before the battle's particles); it puts
 * the effects pass's state back. Returns the draws made (0 or 1) */
function battleScarPass(C, X) {
  const L = battleScars.list;
  if (!L.length) return 0;
  const S = BATTLE_ANIMS.scars;
  let share = 1;
  if (battleScars.ended) {
    share = scarFadeShare(performance.now() - battleScars.ended, S.fadeMs, S.fadeSteps);
    if (share <= 0) {
      battleScarsClear();
      return 0;
    }
  }
  const A = scarTexture();
  if (!A) return 0;
  const gl = gpuState.gl,
    n = L.length * SCAR_VERTS;
  if (battleScars.d.length < n * SCAR_FLOATS) battleScars.d = new Float32Array(n * SCAR_FLOATS * 2);
  const d = battleScars.d;
  L.forEach((sc, i) => {
    if (!sc.v) sc.v = scarVertices(sc, A);
    d.set(sc.v, i * SCAR_VERTS * SCAR_FLOATS);
    for (let k = 0; k < SCAR_VERTS; k++) d[(i * SCAR_VERTS + k) * SCAR_FLOATS + 11] = share;
  });
  ensurePrograms(BATTLE_SCAR_SHADERS);
  const p = useWalkProgram('battleScar', C, X);
  if (!p.scar) {
    /* made with the program, so a new context (initWebgl empties gpuState.P) makes them again */
    const vao = gpuVao('instances'),
      buf = gpuBuffer('instances'),
      St = SCAR_FLOATS * 4;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    [
      [0, 3, 0],
      [1, 2, 3],
      [2, 3, 5],
      [3, 3, 8],
      [4, 1, 11],
    ].forEach(([l, k, o]) => {
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, k, gl.FLOAT, false, St, o * 4);
      gl.vertexAttribDivisor(l, 0);
    });
    gl.bindVertexArray(null);
    p.scar = { vao, buf };
  }
  gl.uniform1i(p.U.uTex, 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, A.t);
  gl.bindBuffer(gl.ARRAY_BUFFER, p.scar.buf);
  gl.bufferData(gl.ARRAY_BUFFER, d.subarray(0, n * SCAR_FLOATS), gl.DYNAMIC_DRAW);
  gpuSized(p.scar.buf, n * SCAR_FLOATS * 4);
  gl.bindVertexArray(p.scar.vao);
  gl.disable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gl.depthMask(false);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(-1, -4);
  gpuTag('battleFx');
  gl.drawArrays(gl.TRIANGLES, 0, n);
  gpuTag(0);
  gl.disable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(0, 0);
  gl.enable(gl.BLEND);
  gl.bindVertexArray(null);
  bindQuad();
  return 1;
}

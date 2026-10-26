'use strict';
/* ================= WALK GROUND TEXTURES =================
   Phase 20 (stage B): the ground's shading (occlusion), its materials, normals and repeating textures, moved from
   walk-view-gl.js as they were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { groundOcclusionTexture, provide } from '../hooks.js';
import { clamp } from '../util.js';
import { pointInProp, turnedBounds } from '../logic/prop-turn.js';
import { GROUND_BORDER_M, imageReady, stepGrid, stepRaiseAt, walkData, walkView } from '../walk-view.js';
import { engineSetting } from '../engine/settings.js';
import { gpuSized, gpuState, gpuTexture, setTextureParams, smooth01 } from '../engine/webgl.js';
import { walkRenderer } from './walk-state.js';
/* eslint-disable no-func-assign */
expose({
  TERRAIN_MATERIALS: [() => TERRAIN_MATERIALS],
  groundNormalTexture: [() => groundNormalTexture, v => (groundNormalTexture = v)],
  groundOcclusion: [() => groundOcclusion, v => setGroundOcclusion(v)],
  groundOcclusionSteps: [() => groundOcclusionSteps, v => (groundOcclusionSteps = v)],
  groundOcclusionWork: [() => groundOcclusionWork, v => (groundOcclusionWork = v)],
  groundPixelNormal: [() => groundPixelNormal, v => (groundPixelNormal = v)],
  repeatingTexture: [() => repeatingTexture, v => (repeatingTexture = v)],
});
/* eslint-enable no-func-assign */
export function setGroundOcclusion(v) {
  groundOcclusion = v; // eslint-disable-line no-func-assign
  provide({ groundOcclusion });
}
/* to-module: end */
/* which kind each spot of water is: painted rectangles (sc.waters, Studio's water tool) win; then running water is a
   stream (except in a canal town, where canals flow slowly); then the scene's own kind (sc.waterKind), or a guess from the setting (caves have springs, towns have canals) */
/* v32: soft shade on the ground round the feet of buildings, trees, rocks and walls, worked out once per scene at
   four samples a metre (an R8 texture the ground shader multiplies its sky light by) */
/* v34: worked out a slice at a time (a few ms per frame) instead of all at once when a scene opens: it was the cause of
   almost every slow frame in the v33 log (up to 243 ms). The cliff-foot pass reads each spot's height once into a grid
   instead of asking the terrain nine times per texel. Until it's done the ground simply isn't darkened. */
export function groundOcclusion(sc) {
  const gl = gpuState.gl;
  if (walkRenderer.gaoTex) {
    walkRenderer.gaoTex = null;
  }
  walkRenderer.gaoJob = null;
  if ((engineSetting('shadows', 'groundAO') ?? 1) <= 0) return;
  walkRenderer.gaoJob = { sc, it: groundOcclusionSteps(sc) };
}
export function groundOcclusionWork(budget = 4) {
  const J = walkRenderer.gaoJob;
  if (!J) return;
  if (J.sc !== walkView.sc) {
    walkRenderer.gaoJob = null;
    return;
  }
  const t0 = performance.now();
  while (performance.now() - t0 < budget) {
    const r = J.it.next();
    if (r.done) {
      walkRenderer.gaoJob = null;
      if (r.value) walkRenderer.gaoTex = groundOcclusionTexture(r.value);
      return;
    }
  }
}
export function* groundOcclusionSteps(sc) {
  const W = sc.w,
    H = sc.h,
    R = 4,
    FW = W * R,
    FH = H * R,
    A = new Float32Array(FW * FH).fill(1),
    C0 = walkData().sc;
  const dark = (x0, z0, x1, z1, f) => {
    const i0 = Math.max(0, Math.floor(x0 * R)),
      i1 = Math.min(FW - 1, Math.ceil(x1 * R)),
      j0 = Math.max(0, Math.floor(z0 * R)),
      j1 = Math.min(FH - 1, Math.ceil(z1 * R));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const v = f((i + 0.5) / R, (j + 0.5) / R);
        if (v < A[j * FW + i]) A[j * FW + i] = v;
      }
  };
  let n = 0;
  for (const p of sc.props || []) {
    const M = C0.props[p.k];
    if (!M || M.flat) continue;
    const s = p.s || 1,
      g = (M.group || '') + ' ' + p.k;
    if (M.box) {
      const w = (M.box[0] * s) / 2,
        d = M.box[1] * s,
        k = /house|shop|clinic|lab|tower|apartment|hall|villa|chalet|mart|cafe|boutique|windmill/.test(g) ? 0.5 : 0.32,
        /* phase 09 batch 9: measured in the prop's own metres, so a turned prop darkens its turned footprint */
        T = turnedBounds(p, -w, -0.1, w, d);
      dark(T[0] - 1.2, T[1] - 1.2, T[2] + 1.2, T[3] + 1.2, (x, z) => {
        const [lx, lz] = pointInProp(p, x, z),
          dx = Math.max(-w - lx, 0, lx - w),
          dz = Math.max(-0.1 - lz, 0, lz - d),
          dd = Math.hypot(dx, dz);
        return 1 - k * (1 - smooth01(dd / 1.1));
      });
    } else {
      const sh = (M.shadow || 0) * s;
      if (sh < 0.15) continue;
      const tree = /tree|palm/.test(g),
        r = Math.max(0.3, sh * (tree ? 0.62 : 0.5)),
        k = tree ? 0.42 : /rock|boulder|stump|barrel|crate|well|fountain|statue/.test(g) ? 0.38 : 0.28;
      dark(p.x - r * 1.8, p.z - r * 1.8, p.x + r * 1.8, p.z + r * 1.8, (x, z) => {
        const dd = Math.hypot(x - p.x, (z - p.z) * 1.15);
        return 1 - k * (1 - smooth01((dd - r * 0.35) / (r * 1.35)));
      });
    }
    if (++n % 24 === 0) yield;
  }
  /* at the foot of cliffs, terrace walls and steps: heights read once per texel, neighbours looked up in the grid */
  const E = stepGrid(sc);
  if (E) {
    const S = new Float32Array(FW * FH);
    for (let j = 0; j < FH; j++) {
      for (let i = 0; i < FW; i++)
        S[j * FW + i] = stepRaiseAt(clamp((i + 0.5) / R, 0, W - 0.01), clamp((j + 0.5) / R, 0, H - 0.01), sc);
      if (j % 6 === 5) yield;
    }
    const at = (i, j) => S[clamp(j, 0, FH - 1) * FW + clamp(i, 0, FW - 1)],
      NB = [
        [2, 0, 1],
        [-2, 0, 1],
        [0, 2, 1],
        [0, -2, 1],
        [3, 0, 0.55],
        [-3, 0, 0.55],
        [0, 3, 0.55],
        [0, -3, 0.55],
      ];
    for (let j = 0; j < FH; j++) {
      for (let i = 0; i < FW; i++) {
        const h0 = S[j * FW + i];
        let best = 0;
        for (const [a, b, near] of NB) {
          const up = at(i + a, j + b) - h0;
          if (up > 0.35) best = Math.max(best, near * Math.min(1, up / 1.2));
        }
        if (best > 0) A[j * FW + i] = Math.min(A[j * FW + i], 1 - 0.4 * best);
      }
      if (j % 12 === 11) yield;
    }
  }
  /* one soft blur, then into an R8 texture */
  const d = new Uint8Array(FW * FH);
  for (let j = 0; j < FH; j++) {
    for (let i = 0; i < FW; i++) {
      let s2 = 0,
        c = 0;
      for (let b = -1; b <= 1; b++)
        for (let a = -1; a <= 1; a++) {
          const ii = i + a,
            jj = j + b;
          if (ii < 0 || jj < 0 || ii >= FW || jj >= FH) continue;
          s2 += A[jj * FW + ii];
          c++;
        }
      d[j * FW + i] = Math.round(clamp(s2 / c, 0, 1) * 255);
    }
    if (j % 24 === 23) yield;
  }
  return { FW, FH, d };
}
/* the ground's normal map and shine, from the painted ground: brighter pixels stand proud, by how bumpy each terrain
   is (cobbles and rock a lot, grass a little); shine in alpha (wet-looking plaza and mall floors, dull grass) */
/* [bumpiness, shine, built]: a built surface (boards, floors, slabs, bricks, steps, asphalt) is flat; only its seams
   catch the light (v31: planks used to look rounded, because the shading painted on each plank became a curve) */
/* v46: the twelve new kinds: clover, moss, mud, wet sand, pebbles, cobblestone, leaf litter, heather, marsh, marble, ice, crystal */
export const TERRAIN_MATERIALS = {
  C: [0.7, 0.02],
  M: [0.6, 0.06],
  D: [0.5, 0.35],
  S: [0.5, 0.3],
  P: [1.1, 0.12],
  K: [1, 0.1, 1],
  L: [0.8, 0.03],
  H: [0.75, 0.02],
  R: [0.6, 0.25],
  T: [0.6, 0.45, 1],
  I: [0.3, 0.7],
  X: [1, 0.35],
  g: [0.7, 0.02],
  G: [0.7, 0.02],
  f: [0.7, 0.03],
  t: [0.7, 0.02],
  p: [0.8, 0.05],
  o: [0.9, 0.04],
  s: [0.6, 0.08],
  c: [1, 0.22],
  b: [0.9, 0.14, 1],
  m: [0.35, 0.5, 1],
  r: [1.2, 0.12],
  k: [1, 0.18],
  x: [1, 0.28],
  n: [0.5, 0.32],
  w: [0, 0],
  d: [0, 0],
  a: [0.55, 0.1, 1],
  q: [0.9, 0.14, 1],
  h: [1.05, 0.1, 1],
  v: [1.15, 0.05],
  u: [0.8, 0.04],
  y: [0.85, 0.03],
  e: [1.1, 0.12, 1],
  l: [0.55, 0.03],
  /* v47: the 22 new kinds */
  A: [0.9, 0.04],
  B: [0.7, 0.02],
  E: [0.7, 0.03],
  F: [0.8, 0.03],
  J: [0.7, 0.08],
  N: [0.6, 0.08],
  U: [0.4, 0.15],
  V: [1, 0.14, 1],
  W: [1.1, 0.2],
  Y: [0.9, 0.14, 1],
  Z: [0.5, 0.06],
  i: [0.5, 0.08, 1],
  1: [0.4, 0.05, 1],
  2: [1, 0.3],
  3: [1.1, 0.22],
  4: [0.4, 0.2],
  5: [0.9, 0.14, 1],
  6: [0.3, 0, 1],
  7: [0.3, 0, 1],
  8: [0.6, 0.3, 1],
  9: [0.35, 0.5, 1],
  0: [0.4, 0.3, 1],
};
provide({ TERRAIN_MATERIALS }); /* to-module */
/* the tilt one ground pixel gets from the brightness around it */
function groundPixelNormal(gx, gy, m) {
  if (m[2]) {
    const g = Math.hypot(gx, gy);
    if (g < 0.07) return [0, 0];
    const k = (Math.min(1, (g - 0.07) * 6) * 0.45) / g;
    return [clamp(-gx * k, -0.45, 0.45), clamp(gy * k, -0.45, 0.45)];
  }
  return [clamp(-gx * m[0] * 1.4, -0.8, 0.8), clamp(gy * m[0] * 1.4, -0.8, 0.8)];
}
export function groundNormalTexture(G, old, sc = walkView.sc) {
  const gl = gpuState.gl,
    TP = G._TP || walkData().sc.tile || 16,
    P = GROUND_BORDER_M,
    w = G.width,
    h = G.height,
    rows = sc.tiles || [];
  let d;
  if (G._nrm) {
    const t = old && old !== gpuState.flatN ? old : gpuTexture('ground');
    gpuSized(t, Math.round(w * h * 4 * 1.34));
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, G._nrm);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    return t;
  }
  try {
    d = G._px || G.getContext('2d').getImageData(0, 0, w, h).data;
  } catch (e) {
    return old || gpuState.flatN;
  }
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
  const out = new Uint8Array(w * h * 4),
    mat = (X, Y) => {
      const i = Math.floor(X / TP) - P,
        j = Math.floor(Y / TP) - P,
        ch = i < 0 || j < 0 || i >= sc.w || j >= sc.h ? sc.edge : (rows[j] || '')[i] || sc.edge;
      return TERRAIN_MATERIALS[ch] || [1, 0.05];
    };
  for (let Y = 0; Y < h; Y++) {
    let m = mat(0, Y),
      mx = 0;
    for (let X = 0; X < w; X++) {
      if (X >= mx) {
        m = mat(X, Y);
        mx = (Math.floor(X / TP) + 1) * TP;
      }
      const i = Y * w + X,
        l = k => L[clamp(k, 0, w * h - 1)];
      const gx = (L[Y * w + Math.min(w - 1, X + 1)] - L[Y * w + Math.max(0, X - 1)]) * 0.5,
        gy = (L[Math.min(h - 1, Y + 1) * w + X] - L[Math.max(0, Y - 1) * w + X]) * 0.5;
      /* world x follows the picture's x; world z runs up the picture */
      const [nx, nz] = groundPixelNormal(gx, gy, m);
      out[i * 4] = (nx * 0.5 + 0.5) * 255;
      out[i * 4 + 1] = (nz * 0.5 + 0.5) * 255;
      out[i * 4 + 2] = 255;
      out[i * 4 + 3] = m[1] * 255;
    }
  }
  const t = old && old !== gpuState.flatN ? old : gpuTexture('ground');
  gpuSized(t, Math.round(w * h * 4 * 1.34));
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, out);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.generateMipmap(gl.TEXTURE_2D);
  return t;
}
export function repeatingTexture(im, old) {
  const gl = gpuState.gl;
  if (!imageReady(im)) return gpuState.white;
  const t = old && old !== gpuState.white ? old : gpuTexture('ground');
  gpuSized(t, (im.naturalWidth || im.width) * (im.naturalHeight || im.height) * 4);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
  setTextureParams({ repeat: true });
  return t;
}

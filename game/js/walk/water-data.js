'use strict';
/* ================= WALK WATER DATA =================
   Phase 20 (stage B): what each kind of water looks like and the shore and flow fields, moved from walk-view-gl.js as
   they were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { clamp } from '../util.js';
import { seaCentre } from '../logic/sea.js';
import { valueNoise2d, walkView } from '../walk-view.js';
import { engineSetting } from '../engine/settings.js';
import { gpuState } from '../engine/webgl.js';
import { environment } from '../environment.js';
import { walkRenderer } from './walk-state.js';
import { tideLevel } from './sea-tide.js';
/* eslint-disable no-func-assign */
expose({
  FALL_A: [() => FALL_A],
  FALL_B: [() => FALL_B],
  WATER_KIND_INDEX: [() => WATER_KIND_INDEX],
  WATER_KIND_LOOKS: [() => WATER_KIND_LOOKS],
  flowTexture: [() => flowTexture, v => (flowTexture = v)],
  setFallUniforms: [() => setFallUniforms, v => (setFallUniforms = v)],
  setFlowUniforms: [() => setFlowUniforms, v => (setFlowUniforms = v)],
  setPixelWaterUniform: [() => setPixelWaterUniform, v => (setPixelWaterUniform = v)],
  setShoreUniforms: [() => setShoreUniforms, v => (setShoreUniforms = v)],
  shoreAt: [() => shoreAt, v => (shoreAt = v)],
  shoreField: [() => shoreField, v => (shoreField = v)],
  waterKindLookup: [() => waterKindLookup, v => (waterKindLookup = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* v22: kinds of water. r = how quickly it deepens away from the shore (m), top = how deep the middle gets; colours multiply
   the Look's water colours; clarity = how much bed shows in the shallows; caus = light patterns on the bed */
export const WATER_KIND_LOOKS = [
  {
    k: 'pond',
    r: 1.6,
    top: 1,
    deep: [1, 1, 1],
    shal: [1, 1.02, 0.98],
    clar: 0.5,
    caus: 0.8,
    foam: 0.7,
    rip: 1,
    glow: 0,
    murk: 0,
    weed: 0,
    fish: 1,
  },
  {
    k: 'stream',
    r: 0.8,
    top: 0.7,
    deep: [0.86, 1.05, 1],
    shal: [1.08, 1.12, 1.06],
    clar: 0.42,
    caus: 1.1,
    foam: 1.5,
    rip: 1.7,
    glow: 0,
    murk: 0,
    weed: 0,
    fish: 0,
  },
  {
    k: 'canal',
    r: 0.6,
    top: 0.9,
    deep: [0.62, 0.8, 0.7],
    shal: [0.6, 0.78, 0.68],
    clar: 0.85,
    caus: 0.25,
    foam: 0.25,
    rip: 0.6,
    glow: 0,
    murk: 0.45,
    weed: 0.12,
    fish: 1,
  },
  {
    k: 'spring',
    r: 1.2,
    top: 0.85,
    deep: [0.36, 1.12, 1.18],
    shal: [0.42, 1.28, 1.2],
    clar: 0.32,
    caus: 1.3,
    foam: 0.25,
    rip: 0.45,
    glow: 0.3,
    murk: 0.1,
    weed: 0,
    fish: 0,
  },
  {
    k: 'swamp',
    r: 2.4,
    top: 0.7,
    deep: [0.42, 0.5, 0.24],
    shal: [0.5, 0.58, 0.3],
    clar: 0.92,
    caus: 0.05,
    foam: 0.12,
    rip: 0.35,
    glow: 0,
    murk: 0.85,
    weed: 0.75,
    fish: 0,
  },
  {
    k: 'lake',
    r: 2.6,
    top: 1,
    deep: [0.7, 0.82, 1.08],
    shal: [0.96, 1, 1.04],
    clar: 0.58,
    caus: 0.6,
    foam: 1,
    rip: 1.45,
    glow: 0,
    murk: 0,
    weed: 0,
    fish: 1,
  },
  /* v24: the open sea, molten lava (mode 1: glowing, crusted, no reflections) and ice (mode 2: frozen, cracked) */
  {
    k: 'sea',
    r: 3.2,
    top: 1,
    deep: [0.58, 0.72, 1.06],
    shal: [0.92, 1.06, 1.06],
    clar: 0.55,
    caus: 0.7,
    foam: 1.3,
    rip: 1.9,
    glow: 0,
    murk: 0,
    weed: 0,
    fish: 1,
  },
  {
    k: 'lava',
    r: 0.8,
    top: 1,
    deep: [2.6, 0.55, 0.12],
    shal: [3.1, 0.95, 0.22],
    clar: 1,
    caus: 0,
    foam: 0,
    rip: 0.25,
    glow: 1.4,
    murk: 1,
    weed: 0,
    fish: 0,
    mode: 1,
  },
  {
    k: 'ice',
    r: 1.5,
    top: 0.6,
    deep: [1.7, 1.2, 1.12],
    shal: [2.6, 1.42, 1.26],
    clar: 1,
    caus: 0,
    foam: 0,
    rip: 0,
    glow: 0,
    murk: 0.3,
    weed: 0,
    fish: 0,
    mode: 2,
  },
];
const WATER_KIND_INDEX = Object.fromEntries(WATER_KIND_LOOKS.map((w, i) => [w.k, i]));
/* 0.1.0 alpha: in steps (a generator, drained with yield*), so building a place's ground a slice at a time (map-cache.js
   prepareMapGround) doesn't stop here: a big place's field is millions of samples, about 0.4 s in one go */
/* water track WA-4: `tide` (walk/sea-tide.js tideCells: per tile, the land the high tide covers and the water the low
   tide leaves) adds two more shorelines in the texture's green (high water) and blue (low water); the shaders move the
   waterline between them (setShoreUniforms' uTide) */
export function* shoreField(sc, isW, T = walkRenderer, tide = null) {
  const gl = gpuState.gl,
    W = sc.w,
    H = sc.h,
    R = 8,
    FW = W * R,
    FH = H * R;
  let any = false;
  const m = new Float32Array(FW * FH);
  /* per tile, then filled in (v32: was asked per sample) */ for (let tj = 0; tj < H; tj++)
    for (let ti = 0; ti < W; ti++) {
      if (!isW(ti + 0.5, tj + 0.5)) continue;
      any = true;
      for (let j = tj * R; j < tj * R + R; j++) m.fill(1, j * FW + ti * R, j * FW + ti * R + R);
    }
  T.shoreF = null;
  if (!any || !(engineSetting('water', 'shore') ?? true)) {
    if (T.shoreTex) {
      gl.deleteTexture(T.shoreTex);
      T.shoreTex = null;
    }
    return;
  }
  /* two box blurs of 7 samples (about 0.4 m) each way: straight banks stay where they were, corners round off */
  const tmp = new Float32Array(FW * FH),
    r = 3,
    n = 2 * r + 1,
    blur = (src, dst, dx) => {
      /* a running sum along each row or column */ const L = dx ? FW : FH,
        M2 = dx ? FH : FW,
        at = dx ? (a, b) => b * FW + a : (a, b) => a * FW + b;
      for (let b = 0; b < M2; b++) {
        let sum = 0;
        for (let k = -r; k <= r; k++) sum += src[at(clamp(k, 0, L - 1), b)];
        for (let a2 = 0; a2 < L; a2++) {
          dst[at(a2, b)] = sum / n;
          sum += src[at(Math.min(L - 1, a2 + r + 1), b)] - src[at(Math.max(0, a2 - r), b)];
        }
      }
    };
  /* the tide's masks: the water plus the land it covers, the water less what it leaves */
  const tw = tide && (tide.nCover || tide.nDry) ? [new Float32Array(m), new Float32Array(m)] : null;
  if (tw)
    for (let tj = 0; tj < H; tj++)
      for (let ti = 0; ti < W; ti++) {
        const q = tj * W + ti;
        if (!tide.cover[q] && !tide.dry[q]) continue;
        const M = tide.cover[q] ? tw[0] : tw[1],
          v = tide.cover[q] ? 1 : 0;
        for (let j = tj * R; j < tj * R + R; j++) M.fill(v, j * FW + ti * R, j * FW + ti * R + R);
      }
  yield;
  for (const M of tw ? [m, ...tw] : [m])
    for (let n = 0; n < 2; n++) {
      blur(M, tmp, 1);
      yield;
      blur(tmp, M, 0);
      yield;
    }
  const d = new Uint8Array(FW * FH),
    dt = tw ? new Uint8Array(FW * FH * 4) : null;
  for (let j = 0; j < FH; j++) {
    if (j % 64 === 63) yield;
    for (let i = 0; i < FW; i++) {
      const q = j * FW + i,
        f = m[q],
        x = (i + 0.5) / R,
        z = (j + 0.5) / R;
      /* the bank wanders a little: only near the edge, so open water and dry land stay as they are */
      const e = f * (1 - f) * 4,
        nz = (valueNoise2d(x * 1.1 + 3.7, z * 1.1) - 0.5) * 0.34 + (valueNoise2d(x * 3.3, z * 3.3 + 9.1) - 0.5) * 0.12;
      d[q] = Math.round(clamp(f + nz * e, 0, 1) * 255);
      if (dt) {
        dt[q * 4] = d[q];
        for (let c = 0; c < 2; c++) {
          const g = tw[c][q];
          dt[q * 4 + 1 + c] = Math.round(clamp(g + nz * g * (1 - g) * 4, 0, 1) * 255);
        }
        dt[q * 4 + 3] = 255;
      }
    }
  }
  if (!T.shoreTex) T.shoreTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, T.shoreTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  if (dt) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, FW, FH, 0, gl.RGBA, gl.UNSIGNED_BYTE, dt);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, FW, FH, 0, gl.RED, gl.UNSIGNED_BYTE, d);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  T.shoreF = { W, H, d, FW, FH, tide: !!dt };
}
/* water track WA-1: the pixel water's switch, tones and steps (walk-shaders.js PIXEL_WATER_GLSL) */
export function setPixelWaterUniform(U) {
  if (!U.uPixW) return;
  gpuState.gl.uniform3f(
    U.uPixW,
    engineSetting('water', 'pixel') === false ? 0 : 1,
    clamp(Math.round(engineSetting('water', 'bands') ?? 5), 2, 8),
    clamp(engineSetting('water', 'frames') ?? 10, 0, 60)
  );
}
/* the shoreline value at a spot (0 dry ... 0.5 the water's edge ... 1 open water); 1 where there is no field */
export function setShoreUniforms(U, sc) {
  setPixelWaterUniform(U);
  setFallUniforms(U);
  if (!U.uShoreR) return;
  const gl = gpuState.gl,
    on = !!(walkRenderer.shoreF && walkRenderer.shoreTex);
  gl.activeTexture(gl.TEXTURE5);
  gl.bindTexture(gl.TEXTURE_2D, on ? walkRenderer.shoreTex : gpuState.white);
  gl.bindSampler(5, null);
  gl.uniform1i(U.uShore, 5);
  gl.uniform3f(U.uShoreR, 1 / sc.w, 1 / sc.h, on ? 1 : 0);
  /* island track IS-3: the sea all round: where its swell rolls in toward, and whether it is on */
  if (U.uSea) {
    const c = seaCentre(sc);
    gl.uniform4f(U.uSea, c[0], c[1], sc.flatFar ? 1 : 0, 0);
  }
  /* water track WA-4: the tide (1 high ... -1 low; 0 where the shore texture has no tide's lines or it is switched off)
     and the storm on the sea (0-1, the weather's, eased). walkRenderer.tideForce / stormForce pin them (pictures) */
  if (U.uTide) {
    const F = walkRenderer.shoreF,
      on = !!(sc.flatFar && F && F.tide && engineSetting('water', 'tide') !== false),
      td = walkRenderer.tideForce ?? tideLevel(environment.tod),
      st = walkRenderer.stormForce ?? environment.storm;
    /* w: the storm's heave's clock, the frame's (uTime) seconds wrapped on whole turns of the swell, so the two keep step */
    const turn = ((2 * Math.PI) / 1.3) * 64;
    gl.uniform4f(
      U.uTide,
      on ? clamp(td, -1, 1) : 0,
      sc.flatFar ? clamp(st, 0, 1) : 0,
      on ? 1 : 0,
      ((walkView.t || 0) / 1000) % turn
    );
  }
}
function shoreAt(x, z) {
  const F = walkRenderer.shoreF;
  if (!F) return 1;
  const i = clamp(Math.floor(x * 8), 0, F.FW - 1),
    j = clamp(Math.floor(z * 8), 0, F.FH - 1);
  return F.d[j * F.FW + i] / 255;
}
export function waterKindLookup(sc) {
  if (!engineSetting('water', 'kinds')) return () => 0;
  const R = sc.waters || [],
    def = WATER_KIND_INDEX[sc.waterKind] ?? (sc.indoor && sc.far === 'cave' ? 3 : sc.far === 'town' ? 2 : 0);
  return (x, z, run) => {
    for (let i = R.length - 1; i >= 0; i--) {
      const r = R[i];
      if (x >= r.x && z >= r.z && x < r.x + r.w && z < r.z + r.h) return WATER_KIND_INDEX[r.k] ?? def;
    }
    return run && def !== 2 && !WATER_KIND_LOOKS[def].mode ? 1 : def;
  };
}
/* water track WA-2a: the nearest four waterfalls (walk-shaders.js FALL_GLSL), for the ground's wet rock and thrown
   light and the plunge pools' churn and rings */
const FALL_A = new Float32Array(16),
  FALL_B = new Float32Array(16);
function setFallUniforms(U) {
  if (!U.uFallN) return;
  const F = walkRenderer.fallSets || [],
    P = walkView.pl,
    near =
      F.length > 4 && P
        ? [...F].sort((a, b) => Math.hypot(a.fx - P.x, a.fz - P.z) - Math.hypot(b.fx - P.x, b.fz - P.z))
        : F,
    n = Math.min(4, near.length),
    gl = gpuState.gl;
  for (let i = 0; i < n; i++) {
    const f = near[i];
    FALL_A.set([f.x, f.z, f.dx, f.dz], i * 4);
    FALL_B.set([f.w, f.h, f.pool, f.lipY], i * 4);
  }
  gl.uniform1i(U.uFallN, n);
  if (n) {
    gl.uniform4fv(U.uFallA, FALL_A);
    gl.uniform4fv(U.uFallB, FALL_B);
  }
}
/* water track WA-2a: the flow map on the card (walk/water-flow.js): flow in red and green, foam in blue, how far into
   its stream in alpha, one texel a half metre, half floats so still water reads exactly 0 */
export function flowTexture(T, F) {
  const gl = gpuState.gl;
  if (T.flowTex) gl.deleteTexture(T.flowTex);
  T.flowTex = null;
  if (!F || !F.d.some(v => v !== 0)) return;
  T.flowTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, T.flowTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, F.W2, F.H2, 0, gl.RGBA, gl.FLOAT, F.d);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}
/* the water shader's flow map (texture unit 7); off where the scene has none, and for the basins (on = false) */
export function setFlowUniforms(U, sc, on = true) {
  if (!U.uFlowR) return;
  const gl = gpuState.gl,
    t = on && walkRenderer.flowTex;
  gl.activeTexture(gl.TEXTURE7);
  gl.bindTexture(gl.TEXTURE_2D, t || gpuState.white);
  gl.bindSampler(7, null);
  gl.uniform1i(U.uFlowTex, 7);
  gl.uniform3f(U.uFlowR, 1 / sc.w, 1 / sc.h, t ? 1 : 0);
  gl.activeTexture(gl.TEXTURE0);
}

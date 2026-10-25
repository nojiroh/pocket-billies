'use strict';
/* ================= WALK WATER DATA =================
   Phase 20 (stage B): what each kind of water looks like and the shore and flow fields, moved from walk-view-gl.js as
   they were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { clamp } from '../util.js';
import { seaCentre } from '../logic/sea.js';
import { valueNoise2d } from '../walk-view.js';
import { engineSetting } from '../engine/settings.js';
import { gpuState } from '../engine/webgl.js';
import { walkRenderer } from './walk-state.js';
/* eslint-disable no-func-assign */
expose({
  WATER_KIND_INDEX: [() => WATER_KIND_INDEX],
  WATER_KIND_LOOKS: [() => WATER_KIND_LOOKS],
  setPixelWaterUniform: [() => setPixelWaterUniform, v => (setPixelWaterUniform = v)],
  setShoreUniforms: [() => setShoreUniforms, v => (setShoreUniforms = v)],
  shoreAt: [() => shoreAt, v => (shoreAt = v)],
  shoreField: [() => shoreField, v => (shoreField = v)],
  waterFlowField: [() => waterFlowField, v => (waterFlowField = v)],
  waterKindLookup: [() => waterKindLookup, v => (waterKindLookup = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* which way water flows: along the scene's streams (sc.streams: [{pts:[[x,z],…]}]), still everywhere else */
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
export function* shoreField(sc, isW, T = walkRenderer) {
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
  yield;
  for (let n = 0; n < 2; n++) {
    blur(m, tmp, 1);
    yield;
    blur(tmp, m, 0);
    yield;
  }
  const d = new Uint8Array(FW * FH);
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
    }
  }
  if (!T.shoreTex) T.shoreTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, T.shoreTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, FW, FH, 0, gl.RED, gl.UNSIGNED_BYTE, d);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  T.shoreF = { W, H, d, FW, FH };
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
export function waterFlowField(sc) {
  const S = sc.streams || [];
  if (!S.length) return () => [0, 0];
  return (x, z) => {
    let best = null,
      bd = 2.5;
    for (const st of S) {
      const p = st.pts || [];
      for (let k = 0; k < p.length - 1; k++) {
        const a = p[k],
          b = p[k + 1],
          vx = b[0] - a[0],
          vz = b[1] - a[1],
          l2 = vx * vx + vz * vz || 1e-9,
          t = clamp(((x - a[0]) * vx + (z - a[1]) * vz) / l2, 0, 1),
          d = Math.hypot(a[0] + vx * t - x, a[1] + vz * t - z);
        if (d < bd) {
          bd = d;
          const l = Math.sqrt(l2);
          best = [(vx / l) * (st.speed || 1), (vz / l) * (st.speed || 1)];
        }
      }
    }
    return best || [0, 0];
  };
}

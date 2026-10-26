'use strict';
/* ================= WALK GRASS BUILD =================
   Phase 20 (stage B): building the grass and the far props, moved from walk-view-gl.js as they were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import { clamp } from '../util.js';
import { hash2d, isWalkable, navGrid, stepRaiseAt, valueNoise2d, walkData, walkView } from '../walk-view.js';
import { engineSetting } from '../engine/settings.js';
import { gpuBuffer, gpuFree, gpuState, gpuVao } from '../engine/webgl.js';
import { walkRenderer } from './walk-state.js';
import { rawHeightAt } from './heights.js';
/* eslint-disable no-func-assign */
expose({
  GRASS_KINDS: [() => GRASS_KINDS],
  NEAR_DIRS: [() => NEAR_DIRS],
  buildFarProps: [() => buildFarProps, v => (buildFarProps = v)],
  buildGrass: [() => buildGrass, v => setBuildGrass(v)],
  grassWork: [() => grassWork, v => setGrassWork(v)],
});
/* eslint-enable no-func-assign */
export function setBuildGrass(v) {
  buildGrass = v; // eslint-disable-line no-func-assign
  provide({ buildGrass });
}
export function setGrassWork(v) {
  grassWork = v; // eslint-disable-line no-func-assign
  provide({ grassWork });
}
/* to-module: end */
/* grass blades: many little triangles on grassy tiles, denser in tall grass, none on paths or under things */
/* v22: grass with variety. Every blade has a kind (thin, broad, clover, dry straw, flower head, tall hiding grass) and
   a tint: patches of lush and dry grass follow a slow noise, it is darker and greener near water, shorter where paths
   and doors wear it down, taller round fences, rocks and tree trunks, and tufts creep onto the edges of paths */
const GRASS_KINDS = {
  g: [
    [0, 0.66],
    [1, 0.2],
    [2, 0.1],
    [4, 0.04],
  ],
  G: [
    [0, 0.55],
    [1, 0.3],
    [4, 0.08],
    [3, 0.07],
  ],
  f: [
    [0, 0.55],
    [4, 0.3],
    [2, 0.15],
  ],
  l: [
    [0, 0.68],
    [2, 0.3],
    [4, 0.02],
  ],
  y: [
    [1, 0.5],
    [0, 0.35],
    [3, 0.15],
  ],
  t: [[5, 1]],
  B: [
    [3, 0.6],
    [0, 0.3],
    [1, 0.1],
  ],
  E: [
    [0, 0.45],
    [4, 0.45],
    [1, 0.1],
  ],
}; /* v47: sunburnt grass (mostly dry straw), wildflower meadow (flower heads) */
/* the order the eight ways round a spot are tried in (as before: the four straight ones first) */
const NEAR_DIRS = [0, 4, 2, 6, 1, 3, 7, 5];
/* v39: planting is spread over frames: each frame plants rows for a few milliseconds (grassWork), and the blades
   appear when the last row is in, so a big meadow no longer costs one long frame when the scene opens */
export function buildGrass() {
  const gl = gpuState.gl,
    sc = walkView.sc;
  walkRenderer.grassDrawn = 0;
  /* v46: a room has none (the count used to carry over from the last place) */ if (walkRenderer.grass) {
    gpuFree(walkRenderer.grass.vao);
    gpuFree(walkRenderer.grass.ib);
    gpuFree(walkRenderer.grass.vb);
  }
  walkRenderer.grass = null;
  walkRenderer.grassJob = null;
  walkRenderer.grassKey = engineSetting('grass', 'density');
  if (sc.indoor && !sc.grass) return;
  /* alpha 0.4: the blades go straight into a growing Float32Array (8 numbers each) instead of a plain array of numbers:
    planting a big place made several MB of garbage, and a phone's clean-up of it was the worst hitch on arrival */
  const dk = engineSetting('grass', 'density'),
    rnd = (a, b) => hash2d(a * 7 + 3, b * 13 + 5),
    dens = { t: 30, g: 4, G: 7, f: 5, l: 3, y: 2, C: 5, H: 6, R: 9, M: 1, L: 1, B: 6, E: 7, F: 1 };
  navGrid();
  const J = { sc, j: 0, k: 0, I: new Float32Array(8 * 4096), n: 0 };
  const C0 = walkData().sc,
    rows = sc.tiles || [];
  const W2 = sc.w * 2,
    H2 = sc.h * 2,
    occ = new Uint8Array(W2 * H2 + W2 * 2),
    tall = new Uint8Array(W2 * H2 + W2 * 2);
  for (const p of sc.props || []) {
    const M = C0.props[p.k],
      g = ((M && M.group) || '') + ' ' + p.k,
      big = /fence|rock|boulder|tree|post|stump|log|sign|lamp|well|wall/.test(g);
    for (let a = -3; a <= 3; a++)
      for (let b = -3; b <= 3; b++) {
        const ii = Math.floor(p.x * 2) + a,
          jj = Math.floor(p.z * 2) + b;
        if (ii < 0 || jj < 0 || ii >= W2 || jj >= H2) continue;
        if (Math.abs(a) <= 1 && Math.abs(b) <= 1) occ[jj * W2 + ii] = 1;
        else if (big) tall[jj * W2 + ii] = 1;
      }
  }
  const ter = (x, z) => {
    const i = Math.floor(x),
      j = sc.h - 1 - Math.floor(z);
    return i < 0 || j < 0 || i >= sc.w || j >= sc.h ? sc.edge : (rows[j] || '')[i] || sc.edge;
  };
  /* which way (in eighths of a turn, 0 = east) there is ground of the set within r, or -1 */
  const nearDir = (x, z, r, set) => {
    for (const d of NEAR_DIRS) {
      const an = d * (Math.PI / 4);
      if (set.includes(ter(x + Math.cos(an) * r, z + Math.sin(an) * r))) return d;
    }
    return -1;
  };
  const near = (x, z, r, set) => nearDir(x, z, r, set) >= 0;
  const pick = (ch, r) => {
    const L = GRASS_KINDS[ch] || GRASS_KINDS.g;
    let a = 0;
    for (const [kk, w] of L) {
      a += w;
      if (r < a) return kk;
    }
    return L[0][0];
  };
  const add = (x, z, h, kind, tint) => {
    if ((J.n + 1) * 8 > J.I.length) {
      const b = new Float32Array(J.I.length * 2);
      b.set(J.I);
      J.I = b;
    }
    const I = J.I,
      o = J.n * 8;
    I[o] = x;
    I[o + 1] = z;
    I[o + 2] = h;
    I[o + 3] = rnd(J.k, 5);
    I[o + 4] = kind;
    I[o + 5] = rnd(J.k, 6);
    I[o + 6] = rawHeightAt(sc, x, z) + stepRaiseAt(x, z, sc);
    I[o + 7] = tint;
    J.n++;
  };
  J.row = j => {
    for (let i = 0; i < sc.w; i++) {
      const ch = (rows[j] || '')[i];
      const d = Math.round((dens[ch] || 0) * dk),
        z0 = sc.h - j - 1;
      if (!d) {
        /* tufts at the edge of a path next to grass */ if ('puv'.includes(ch)) {
          for (let n = 0; n < Math.round(3 * dk); n++) {
            J.k++;
            const x = i + rnd(J.k, 1),
              z = z0 + rnd(J.k, 2);
            const dir = nearDir(x, z, 0.35, 'gGflt');
            if (dir < 0) continue;
            if (!isWalkable(x, z) || occ[Math.floor(z * 2) * W2 + Math.floor(x * 2)]) continue;
            /* 0.1.0 alpha: the tuft takes its colour from the grass beside it (kind + 8 x (direction + 1)) */
            add(x, z, 0.08 + rnd(J.k, 4) * 0.1, 8 * (dir + 1), (valueNoise2d(x * 0.18, z * 0.18) - 0.5) * 1.2);
          }
        }
        continue;
      }
      for (let n = 0; n < d; n++) {
        J.k++;
        const x = i + rnd(J.k, 1),
          z = z0 + rnd(J.k, 2);
        if (!isWalkable(x, z) && ch !== 't') continue;
        const q = Math.floor(z * 2) * W2 + Math.floor(x * 2);
        if (occ[q]) continue;
        const kind = pick(ch, rnd(J.k, 7));
        let h =
          ch === 't' ? 0.45 + rnd(J.k, 3) * 0.35 : kind === 2 ? 0.06 + rnd(J.k, 4) * 0.06 : 0.12 + rnd(J.k, 4) * 0.18;
        if (ch !== 't' && near(x, z, 0.55, 'puvcqhab')) h *= 0.5;
        if (tall[q]) h *= 1.4;
        let tint = (valueNoise2d(x * 0.16 + 3, z * 0.16 + 7) - 0.45) * 1.5;
        if (near(x, z, 1.4, 'wd')) tint = Math.min(tint, 0) - 0.7;
        add(x, z, h, kind, clamp(tint, -1, 1));
      }
    }
  };
  J.done = () => {
    const N = J.n,
      A = J.I;
    if (!N) return;
    /* v32: blades sorted into 8 m squares, so only the squares in view are drawn (alpha 0.4: a counting sort into one
    typed array: two passes, no array per square) */
    const CS = 8,
      cw = Math.ceil(sc.w / CS) + 1,
      ch = Math.ceil(sc.h / CS) + 1,
      NB = cw * ch,
      key = new Int32Array(N),
      cnt = new Int32Array(NB),
      y0 = new Float32Array(NB).fill(1e9),
      y1 = new Float32Array(NB).fill(-1e9);
    for (let b = 0; b < N; b++) {
      const q = b * 8,
        ci = Math.min(cw - 1, Math.max(0, Math.floor(A[q] / CS))),
        cj = Math.min(ch - 1, Math.max(0, Math.floor(A[q + 1] / CS))),
        k = cj * cw + ci;
      key[b] = k;
      cnt[k]++;
      const y = A[q + 6];
      if (y < y0[k]) y0[k] = y;
      if (y + A[q + 2] > y1[k]) y1[k] = y + A[q + 2];
    }
    const start = new Int32Array(NB),
      chunks = [];
    let at = 0;
    for (let k = 0; k < NB; k++) {
      start[k] = at;
      if (cnt[k]) {
        const ci = k % cw,
          cj = (k - ci) / cw;
        chunks.push({
          x: (ci + 0.5) * CS,
          z: (cj + 0.5) * CS,
          y: (y0[k] + y1[k]) / 2,
          r: CS * 0.75 + (y1[k] - y0[k]) / 2 + 0.8,
          off: at,
          n: cnt[k],
        });
      }
      at += cnt[k];
    }
    const I = new Float32Array(N * 8);
    for (let b = 0; b < N; b++) {
      const k = key[b],
        d = start[k] * 8,
        q = b * 8;
      for (let t = 0; t < 8; t++) I[d + t] = A[q + t];
      start[k]++;
    }
    J.I = null;
    const vao = gpuVao('ground');
    gl.bindVertexArray(vao);
    const vb = gpuBuffer('ground', 48);
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    const ib = gpuBuffer('ground', I.byteLength);
    gl.bindBuffer(gl.ARRAY_BUFFER, ib);
    gl.bufferData(gl.ARRAY_BUFFER, I, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
    walkRenderer.grass = { vao, vb, ib, n: I.length / 8, chunks };
  };
  walkRenderer.grassJob = J;
  grassWork(12);
}
export function grassWork(ms = 4) {
  const J = walkRenderer.grassJob;
  if (!J) return;
  if (J.sc !== walkView.sc) {
    /* 0.1.0 alpha: the scene changed while planting; it is planted again for the one on screen (the key used to stay
       set, so the place kept no grass at all, also when it came back from the scene cache: the iPad's log) */
    walkRenderer.grassJob = null;
    walkRenderer.grassKey = null;
    return;
  }
  const t0 = performance.now(),
    sc = J.sc;
  while (J.j < sc.h && performance.now() - t0 < ms) {
    J.row(J.j);
    J.j++;
  }
  if (J.j >= sc.h) {
    walkRenderer.grassJob = null;
    J.done();
  }
}

/* distant trees, rocks or cacti scattered on the land around the scene (taken from the scene's own props) */
export function buildFarProps() {
  const sc = walkView.sc,
    C0 = walkData().sc,
    pool = [],
    count = Math.round(engineSetting('world', 'farProps'));
  walkRenderer.farKey = walkView.id + '|' + count;
  for (const p of sc.props || []) {
    const M = C0.props[p.k];
    if (!M || M.flat || M.box || M.door) continue;
    const g = M.group || p.k;
    if (
      /tree|pine|oak|birch|boulder|rock|cactus|stalag|mesa|crystal|mushroom_giant|scrap|tires/.test(g) ||
      /tree|cactus|mesa|stalag/.test(p.k)
    )
      pool.push(p.k);
  }
  walkRenderer.farProps = [];
  /* island track IS-3: past the edge of a scene with the sea all round there is only the sea */
  if (!pool.length || sc.flatFar) return;
  const W = sc.w,
    H = sc.h;
  let k = 0;
  for (let n = 0; n < (sc.indoor ? Math.min(40, count) : count); n++) {
    k++;
    const a = hash2d(k, 11),
      b = hash2d(k, 17),
      side = hash2d(k, 23);
    let x, z;
    if (side < 0.45) {
      x = -4 + a * (W + 8);
      z = H + 2 + b * b * 34;
    } else if (side < 0.72) {
      x = -3 - b * b * 30;
      z = -2 + a * (H + 30);
    } else {
      x = W + 3 + b * b * 30;
      z = -2 + a * (H + 30);
    }
    if (z < -1) continue;
    walkRenderer.farProps.push({
      k: pool[Math.floor(hash2d(k, 29) * pool.length) % pool.length],
      x,
      z,
      s: 0.9 + hash2d(k, 31) * 0.6,
      f: hash2d(k, 37) < 0.5 ? 1 : 0,
      far: 1,
    });
  }
}

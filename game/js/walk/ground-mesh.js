'use strict';
/* ================= WALK GROUND MESH =================
   Phase 20 (stage B): building the ground mesh and uploading its textures, moved from walk-view-gl.js as it was. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { freeNearRing, groundOcclusionTexture, provide } from '../hooks.js';
import { clamp } from '../util.js';
import { SEA_RAMP, seaCalmAt, seaSkirt, seaSmooth } from '../logic/sea.js';
import { stepGridCorners } from '../logic/step-grid.js';
import {
  GROUND_BORDER_M,
  artImage,
  bigTilePaths,
  bigTilesOn,
  imageReady,
  shapedStepCornerHeight,
  stepCellAt,
  stepEdgeShape,
  stepGrid,
  valueNoise2d,
  walkData,
  walkView,
} from '../walk-view.js';
import { engineSetting } from '../engine/settings.js';
import { freeMesh, gpuState, normalize3, smooth01, uploadMesh } from '../engine/webgl.js';
import { walkRenderer } from './walk-state.js';
import { defaultWallMaterial, rawHeightAt } from './heights.js';
import { flowMapAt, waterFlowMap } from './water-flow.js';
import { tideCells } from './sea-tide.js';
import { WATER_KIND_LOOKS, flowTexture, shoreField, waterKindLookup } from './water-data.js';
import { groundNormalTexture, groundOcclusion, groundOcclusionSteps, repeatingTexture } from './ground-textures.js';
import { buildGrass } from './grass-build.js';
/* eslint-disable no-func-assign */
expose({
  buildGroundMesh: [() => buildGroundMesh, v => setBuildGroundMesh(v)],
  buildGroundMeshSteps: [() => buildGroundMeshSteps, v => (buildGroundMeshSteps = v)],
  fallCovers: [() => fallCovers, v => (fallCovers = v)],
  fallSheet: [() => fallSheet, v => (fallSheet = v)],
  makeTextureMipmaps: [() => makeTextureMipmaps, v => (makeTextureMipmaps = v)],
  placeFalls: [() => placeFalls, v => (placeFalls = v)],
  uploadTextureStrips: [() => uploadTextureStrips, v => (uploadTextureStrips = v)],
});
/* eslint-enable no-func-assign */
export function setBuildGroundMesh(v) {
  buildGroundMesh = v; // eslint-disable-line no-func-assign
  provide({ buildGroundMesh });
}
/* to-module: end */
/* ---------- ground mesh: the scene at half-meter resolution, then a coarse ring of distant land curving up ---------- */
/* v46: the ground of a scene, built a slice at a time into T. With T = walkRenderer it runs to the end at once (opening a scene);
   with a fresh T it runs a few milliseconds a frame for the view that comes next (prepareMapGround), so walking from one view
   to the next finds everything ready: the textures go up to the card in strips, the mesh and water are built in slices */
export function* buildGroundMeshSteps(sc, G, T, bare) {
  const gl = gpuState.gl,
    W = sc.w,
    H = sc.h,
    P = bare ? 0 : GROUND_BORDER_M /* phase 08b: a room's floor over its place: the room alone, no land round it */,
    res = 0.5,
    ter = (x, z) => {
      const i = Math.floor(x),
        j = sc.h - 1 - Math.floor(z);
      return i < 0 || j < 0 || i >= sc.w || j >= sc.h ? sc.edge : ((sc.tiles || [])[j] || '')[i] || sc.edge;
    };
  walkRenderer.builds = (walkRenderer.builds || 0) + 1;
  if (T.gtex) gl.deleteTexture(T.gtex);
  T.gtex = null;
  T.gtex = yield* uploadTextureStrips(G.width, G.height, G._px || G, { nearest: true });
  if (T.ring) freeNearRing(T.ring);
  T.ring = null; /* v46: the near ring starts empty (updateNearRing, or the preparation fills it) */
  const C0 = walkData().sc,
    tile = k => {
      const T = C0.terrains[k];
      if (!T) return null;
      if (typeof bigTilesOn === 'function' && bigTilesOn()) {
        const n = artImage(bigTilePaths(T.tile)[0]);
        if (imageReady(n)) return n;
      }
      return artImage(T.tile);
    };
  const fe = tile(sc.edge) || tile('g'),
    cl = tile(sc.cliff || (sc.indoor ? 'k' : 'r')) || fe;
  T.ftex = repeatingTexture(fe, T.ftex);
  T.ctex = repeatingTexture(cl, T.ctex);
  if (T.gntex && T.gntex !== gpuState.flatN) gl.deleteTexture(T.gntex);
  T.gntex = null;
  T.gntex = G._nrm ? yield* uploadTextureStrips(G.width, G.height, G._nrm, {}) : groundNormalTexture(G, null, sc);
  yield;
  const water = (x, z) => {
      const c = ter(x, z);
      return c === 'w' || c === 'd';
    },
    hAt = (x, z) => {
      let h = rawHeightAt(sc, x, z);
      let n = 0;
      for (const [a, b] of [
        [-0.3, -0.3],
        [0.3, -0.3],
        [-0.3, 0.3],
        [0.3, 0.3],
      ])
        if (water(x + a, z + b)) n++;
      return h - n * 0.12;
    };
  const hk = engineSetting('world', 'farHills'),
    farH = (x, z) => {
      const dx = Math.max(0, -x, x - W),
        dz = Math.max(0, -z, z - H),
        out = Math.hypot(dx, dz);
      if (out <= 0) return rawHeightAt(sc, x, z);
      const e = rawHeightAt(sc, clamp(x, 0, W), clamp(z, 0, H));
      if (sc.flatFar) return e - 0.25 - smooth01(out / 30) * 0.3;
      const k = smooth01(out / 12),
        n = (valueNoise2d(x * 0.06, z * 0.06) - 0.4) * 7 + (valueNoise2d(x * 0.17 + 5, z * 0.17) - 0.5) * 2.5;
      if (sc.room && !sc.roomRect && z < 0 && x > -2 && x < W + 2) return e - 3.2;
      /* v31: a room's floor ends at its front edge (the door); below is the cut */ return sc.indoor && !sc.roomRect
        ? e + smooth01((out - 1.5) / 5) * 16 + n * 0.6 * k
        : e + n * k * hk * (sc.far === 'mountains' || sc.far === 'canyon' ? 2.2 : 1);
    };
  /* v18: one set of corners per half-metre cell, so cells on different terraces don't share corners; a vertical wall
    joins them (cliffs, terrace fronts, stair risers). Normals come from the smooth land. */
  const E = stepGrid(sc),
    stp = (x, z) => (E ? E.H[stepCellAt(clamp(x, 0, W - 0.01), clamp(z, 0, H - 0.01), E)] : 0),
    stm = (x, z) => (E ? E.M[stepCellAt(clamp(x, 0, W - 0.01), clamp(z, 0, H - 0.01), E)] & 15 : 0);
  const base = (x, z) => (x >= 0 && z >= 0 && x <= W && z <= H ? hAt(x, z) : farH(x, z));
  const x0 = -P,
    z0 = -P,
    nx = Math.round((W + 2 * P) / res),
    nz = Math.round((H + 2 * P) / res),
    CB = new Float32Array((nx + 1) * (nz + 1)),
    CN = new Float32Array((nx + 1) * (nz + 1) * 3);
  for (let j = 0; j <= nz; j++) {
    if (j % 12 === 11) yield;
    for (let i = 0; i <= nx; i++) {
      const x = x0 + i * res,
        z = z0 + j * res,
        q = j * (nx + 1) + i,
        e = 0.25;
      CB[q] = base(x, z);
      const gx = (base(x + e, z) - base(x - e, z)) / (2 * e),
        gz = (base(x, z + e) - base(x, z - e)) / (2 * e),
        n = normalize3([-gx, 1, -gz]);
      CN[q * 3] = n[0];
      CN[q * 3 + 1] = n[1];
      CN[q * 3 + 2] = n[2];
    }
  }
  const V = [],
    I = [];
  let nv = 0;
  const vtx = (x, y, z, n0, n1, n2, m, f, h) => {
    V.push(x, y, z, n0, n1, n2, m, f, h);
    return nv++;
  };
  const cst = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    if (j % 24 === 23) yield;
    for (let i = 0; i < nx; i++) cst[j * nx + i] = stp(x0 + (i + 0.5) * res, z0 + (j + 0.5) * res);
  }
  /* v23: a cell's corner height: ramps (step flag 32) lean between their neighbours, everything else is flat */
  if (E) stepGridCorners(E);
  const SHP = E ? stepEdgeShape(sc, E) : null,
    sl = !!(E && (E.sl || SHP)),
    cc = (i, j, ci, cj) => {
      if (!sl) return cst[j * nx + i];
      const ei = Math.floor((x0 + (i + 0.5) * res) * 2),
        ej = Math.floor((z0 + (j + 0.5) * res) * 2);
      return ei < 0 || ej < 0 || ei >= E.w || ej >= E.h
        ? cst[j * nx + i]
        : shapedStepCornerHeight(E, ej * E.w + ei, ci, cj, SHP);
    };
  /* alpha 0.2: natural cliffs. Where a terrace or cliff of rock (not a wall someone built: brick, dressed stone, boards,
    steps, concrete, hedge) drops away, its top edge is pulled back and rounded down a little and its foot pushed out,
    so the face leans like rock instead of standing as a straight wall; the line it follows wavers. Every corner moves
    by a rule of its own position and level only, so neighbouring cells and the wall between them stay joined.
    Walking still follows the half-metre cells (the moves are a quarter of a metre at most). */
  const NAT = new Set([1, 2, 3, 9, 11]),
    wdef = defaultWallMaterial(sc),
    cm = new Uint8Array(nx * nz),
    crf = new Uint8Array(nx * nz);
  if (E)
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const x = x0 + (i + 0.5) * res,
          z = z0 + (j + 0.5) * res,
          q = E.M[stepCellAt(clamp(x, 0, W - 0.01), clamp(z, 0, H - 0.01), E)];
        let m = q & 15;
        if (!m) m = wdef;
        cm[j * nx + i] = NAT.has(m) ? 1 : 0;
        crf[j * nx + i] = q & 32 || m === 8 ? 1 : 0;
      }
  const hsh = (a, b, s) => {
      const v = Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453;
      return v - Math.floor(v);
    },
    NO = [0, 0, 0, 0];
  const disp = (I, J, h) => {
    if (!E) return NO;
    let lo = 0,
      hi = 0,
      ldx = 0,
      ldz = 0,
      hdx = 0,
      hdz = 0,
      lmin = 1e9,
      hmax = -1e9,
      hcm = 0,
      rmp = 0;
    for (const [di, dj, ox, oz] of [
      [-1, -1, -1, -1],
      [0, -1, 1, -1],
      [-1, 0, -1, 1],
      [0, 0, 1, 1],
    ]) {
      const ci = I + di,
        cj = J + dj;
      if (ci < 0 || cj < 0 || ci >= nx || cj >= nz) continue;
      const q = cj * nx + ci,
        hk = cst[q];
      if (crf[q]) rmp = 1;
      if (hk < h - 0.3) {
        lo++;
        ldx += ox;
        ldz += oz;
        lmin = Math.min(lmin, hk);
      } else if (hk > h + 0.3) {
        hi++;
        hdx += ox;
        hdz += oz;
        if (hk > hmax) {
          hmax = hk;
          hcm = cm[q];
        }
      }
    }
    if (rmp || (!lo && !hi)) return NO;
    const own = (() => {
      for (const [di, dj] of [
        [-1, -1],
        [0, -1],
        [-1, 0],
        [0, 0],
      ]) {
        const ci = I + di,
          cj = J + dj;
        if (ci < 0 || cj < 0 || ci >= nx || cj >= nz) continue;
        const q = cj * nx + ci;
        if (Math.abs(cst[q] - h) <= 0.3) return cm[q];
      }
      return 0;
    })();
    const n1 = hsh(I, J, 1),
      wx = (hsh(I, J, 3) - 0.5) * 0.16,
      wz = (hsh(I, J, 4) - 0.5) * 0.16;
    if (lo) {
      if (!own) return NO;
      const L = Math.hypot(ldx, ldz);
      if (L < 0.01) return NO;
      const d = h - lmin,
        k = Math.min(0.24, 0.06 + 0.05 * d) * (0.75 + 0.5 * n1);
      return [(-ldx / L) * k + wx, (-ldz / L) * k + wz, -Math.min(0.16, 0.035 * d) * (0.6 + 0.8 * n1), 1];
    }
    if (!hcm) return NO;
    const L = Math.hypot(hdx, hdz);
    if (L < 0.01) return NO;
    const d = hmax - h,
      k = Math.min(0.26, 0.07 + 0.06 * d) * (0.75 + 0.5 * hsh(I, J, 2));
    return [(-hdx / L) * k + wx, (-hdz / L) * k + wz, 0, -1];
  };
  for (let j = 0; j < nz; j++) {
    if (j % 12 === 11) yield;
    for (let i = 0; i < nx; i++) {
      const q = [j * (nx + 1) + i, j * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i, (j + 1) * (nx + 1) + i + 1],
        xs = [0, 1, 0, 1],
        zs = [0, 0, 1, 1];
      const h0 = cst[j * nx + i],
        ids = q.map((c, k) => {
          const D = disp(i + xs[k], j + zs[k], h0);
          let n0 = CN[c * 3],
            n1 = CN[c * 3 + 1],
            n2 = CN[c * 3 + 2];
          if (D[3] > 0) {
            const L = Math.hypot(D[0], D[2]) || 1,
              nn = normalize3([n0 - (D[0] / L) * 0.45, n1, n2 - (D[1] / L) * 0.45]);
            n0 = nn[0];
            n1 = nn[1];
            n2 = nn[2];
          }
          return vtx(
            x0 + (i + xs[k]) * res + D[0],
            CB[c] + cc(i, j, xs[k], zs[k]) + D[2],
            z0 + (j + zs[k]) * res + D[1],
            n0,
            n1,
            n2,
            0,
            0,
            0
          );
        });
      I.push(ids[0], ids[2], ids[1], ids[1], ids[2], ids[3]);
    }
  }
  /* walls */
  /* a wall between two cells, from the lower to the higher corner at each end (they differ where a ramp meets a cliff) */
  const wall = (ax, az, bx, bz, ca, cb, la, ha, lb, hb, nrm, mat, IA, JA, IB, JB, hl, hh) => {
    const dl0 = disp(IA, JA, hl),
      dl1 = disp(IB, JB, hl),
      dh0 = disp(IA, JA, hh),
      dh1 = disp(IB, JB, hh);
    const P0 = [ax + dl0[0], CB[ca] + la + dl0[2], az + dl0[1]],
      P1 = [bx + dl1[0], CB[cb] + lb + dl1[2], bz + dl1[1]],
      P2 = [ax + dh0[0], CB[ca] + ha + dh0[2], az + dh0[1]],
      P3 = [bx + dh1[0], CB[cb] + hb + dh1[2], bz + dh1[1]];
    /* alpha 0.2: the face's own normal (it leans where the cliff is natural), facing the low side */
    let N = nrm;
    if (dl0 !== NO || dl1 !== NO || dh0 !== NO || dh1 !== NO) {
      const e1 = [P1[0] - P0[0], P1[1] - P0[1], P1[2] - P0[2]],
        e2 = [
          (P2[0] + P3[0] - P0[0] - P1[0]) / 2,
          (P2[1] + P3[1] - P0[1] - P1[1]) / 2,
          (P2[2] + P3[2] - P0[2] - P1[2]) / 2,
        ];
      let c = normalize3([e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]);
      if (c[0] * nrm[0] + c[2] * nrm[2] < 0) c = [-c[0], -c[1], -c[2]];
      if (Math.abs(c[0]) + Math.abs(c[2]) > 0.2) N = c;
    }
    const v0 = vtx(...P0, ...N, mat, 0, ha - la),
      v1 = vtx(...P1, ...N, mat, 0, hb - lb),
      v2 = vtx(...P2, ...N, mat, 1, ha - la),
      v3 = vtx(...P3, ...N, mat, 1, hb - lb);
    I.push(v0, v2, v1, v1, v2, v3);
  };
  for (let j = 0; j < nz; j++) {
    if (j % 12 === 11) yield;
    for (let i = 0; i < nx; i++) {
      const a = cst[j * nx + i],
        cx = x0 + (i + 0.5) * res,
        cz = z0 + (j + 0.5) * res;
      if (i < nx - 1) {
        const b = cst[j * nx + i + 1],
          A0 = cc(i, j, 1, 0),
          A1 = cc(i, j, 1, 1),
          B0 = cc(i + 1, j, 0, 0),
          B1 = cc(i + 1, j, 0, 1);
        if (Math.abs(A0 - B0) > 0.03 || Math.abs(A1 - B1) > 0.03) {
          const X = x0 + (i + 1) * res,
            za = z0 + j * res,
            zb = za + res,
            c0 = j * (nx + 1) + i + 1,
            c1 = (j + 1) * (nx + 1) + i + 1,
            hiA = a > b;
          wall(
            X,
            za,
            X,
            zb,
            c0,
            c1,
            Math.min(A0, B0),
            Math.max(A0, B0),
            Math.min(A1, B1),
            Math.max(A1, B1),
            hiA ? [1, 0, 0] : [-1, 0, 0],
            hiA ? stm(cx, cz) : stm(cx + res, cz),
            i + 1,
            j,
            i + 1,
            j + 1,
            Math.min(a, b),
            Math.max(a, b)
          );
        }
      }
      if (j < nz - 1) {
        const b = cst[(j + 1) * nx + i],
          A0 = cc(i, j, 0, 1),
          A1 = cc(i, j, 1, 1),
          B0 = cc(i, j + 1, 0, 0),
          B1 = cc(i, j + 1, 1, 0);
        if (Math.abs(A0 - B0) > 0.03 || Math.abs(A1 - B1) > 0.03) {
          const Z = z0 + (j + 1) * res,
            xa = x0 + i * res,
            xb = xa + res,
            c0 = (j + 1) * (nx + 1) + i,
            c1 = (j + 1) * (nx + 1) + i + 1,
            hiA = a > b;
          wall(
            xa,
            Z,
            xb,
            Z,
            c0,
            c1,
            Math.min(A0, B0),
            Math.max(A0, B0),
            Math.min(A1, B1),
            Math.max(A1, B1),
            hiA ? [0, 0, 1] : [0, 0, -1],
            hiA ? stm(cx, cz) : stm(cx, cz + res),
            i,
            j + 1,
            i + 1,
            j + 1,
            Math.min(a, b),
            Math.max(a, b)
          );
        }
      }
    }
  }
  /* the distant land around the scene, coarser */
  const R = 2,
    fx0 = -70,
    fx1 = W + 70,
    fz0 = -40,
    fz1 = H + 130,
    fnx = Math.round((fx1 - fx0) / R),
    fnz = Math.round((fz1 - fz0) / R),
    fb = nv;
  for (let j = 0; j <= fnz && !bare; j++) {
    if (j % 12 === 11) yield;
    for (let i = 0; i <= fnx; i++) {
      const x = fx0 + i * R,
        z = fz0 + j * R,
        h = farH(x, z) + stp(x, z) - 0.02,
        e = 1,
        gx = (farH(x + e, z) - farH(x - e, z)) / (2 * e),
        gz = (farH(x, z + e) - farH(x, z - e)) / (2 * e),
        n = normalize3([-gx, 1, -gz]);
      vtx(x, h, z, n[0], n[1], n[2], 0, 0, 0);
    }
  }
  for (let j = 0; j < fnz && !bare; j++)
    for (let i = 0; i < fnx; i++) {
      const x = fx0 + i * R,
        z = fz0 + j * R;
      if (x >= x0 && x + R <= x0 + nx * res && z >= z0 && z + R <= z0 + nz * res) continue;
      const a = fb + j * (fnx + 1) + i,
        b = a + 1,
        c = a + fnx + 1,
        d = c + 1;
      I.push(a, c, b, b, c, d);
    }
  yield;
  freeMesh(T.mesh);
  T.mesh = uploadMesh(
    new Float32Array(V),
    new Uint32Array(I),
    [
      ['aPos', 3, 0],
      ['aNrm', 3, 12],
      ['aUV', 3, 24],
    ],
    36
  );
  /* v23: a gorge or valley floor well below where you walk gathers mist (Engine: Air, Mist in low ground) */
  T.valley = null;
  if (E && !sc.indoor) {
    let lo = 1e9,
      sum = 0,
      n = 0;
    for (let j = 0; j < E.h; j += 2)
      for (let i = 0; i < E.w; i += 2) {
        const y = rawHeightAt(sc, (i + 0.5) / 2, (j + 0.5) / 2) + E.H[j * E.w + i];
        if (y < lo) lo = y;
        sum += y;
        n++;
      }
    const mean = sum / Math.max(1, n);
    if (mean - lo > 1.8) T.valley = [lo + Math.min(1.6, (mean - lo) * 0.45), 1];
  }
  /* water per half-metre cell at its own level: stepped pools, and a falling sheet wherever one pool spills into a lower one.
    v22: each cell also carries how deep it is (distance from the shore) and its kind of water, so the shader can show
    the bed through the shallows, darken the middle, and give ponds, streams, canals, springs, swamps and lakes their own look */
  const isW = (x, z) => {
      const c = ter(x, z);
      return c === 'w' || c === 'd';
    },
    wlev = (x, z) => rawHeightAt(sc, x, z) + stp(x, z) - 0.12,
    /* water track WA-2a: the scene's waterfalls (the contract's falls entries) placed on the ground, and which way the
       water runs and where it foams, a half-metre grid built once (walk/water-flow.js) */
    fallSets = bare ? [] : placeFalls(sc, isW, wlev, stp),
    flowMap = waterFlowMap(
      sc,
      fallSets.map(f => [f.fx, f.fz, Math.max(f.pool, f.w * 0.6)])
    ),
    flowAt = (x, z) => flowMapAt(flowMap, x, z);
  const W2 = W * 2,
    H2 = H * 2,
    wd = new Float32Array(W2 * H2).fill(-2),
    wk = new Uint8Array(W2 * H2),
    wy = new Float32Array(W2 * H2),
    kindAt = waterKindLookup(sc),
    Q = [];
  for (let j = 0; j < H2; j++) {
    if (j % 12 === 11) yield;
    for (let i = 0; i < W2; i++) {
      const cx = (i + 0.5) * 0.5,
        cz = (j + 0.5) * 0.5;
      if (!isW(cx, cz)) continue;
      const q = j * W2 + i;
      wd[q] = -1;
      wy[q] = wlev(cx, cz);
      const fw = flowAt(cx, cz);
      wk[q] = kindAt(cx, cz, fw[0] !== 0 || fw[1] !== 0);
      let edge = false;
      for (const [a, b] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const ii = i + a,
          jj = j + b;
        if (ii < 0 || jj < 0 || ii >= W2 || jj >= H2) continue;
        if (!isW((ii + 0.5) * 0.5, (jj + 0.5) * 0.5)) {
          edge = true;
          break;
        }
      }
      if (edge) {
        wd[q] = 1;
        Q.push(q);
      }
    }
  }
  /* v31: still water on one terrace lies at one level (cells at their own height left hairline seams on sloping beds) */
  {
    const seen = new Uint8Array(W2 * H2),
      still = q => {
        const i = q % W2,
          j = (q - i) / W2,
          f = flowAt((i + 0.5) * 0.5, (j + 0.5) * 0.5);
        return f[0] === 0 && f[1] === 0;
      };
    for (let q0 = 0; q0 < wd.length; q0++) {
      if (wd[q0] === -2 || seen[q0] || !still(q0)) continue;
      const comp = [q0],
        s0 = stp(((q0 % W2) + 0.5) * 0.5, (Math.floor(q0 / W2) + 0.5) * 0.5);
      seen[q0] = 1;
      let sum = 0;
      for (let h = 0; h < comp.length; h++) {
        const q = comp[h],
          i = q % W2,
          j = (q - i) / W2;
        sum += wy[q];
        for (const [a, b] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const ii = i + a,
            jj = j + b;
          if (ii < 0 || jj < 0 || ii >= W2 || jj >= H2) continue;
          const n = jj * W2 + ii;
          if (wd[n] === -2 || seen[n] || !still(n) || Math.abs(stp((ii + 0.5) * 0.5, (jj + 0.5) * 0.5) - s0) > 0.05)
            continue;
          seen[n] = 1;
          comp.push(n);
        }
      }
      const lv = sum / comp.length;
      for (const q of comp) wy[q] = lv;
    }
  }
  /* distance from the shore in half-metre steps */
  for (let h = 0; h < Q.length; h++) {
    const q = Q[h],
      i = q % W2,
      j = (q - i) / W2;
    for (const [a, b] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const ii = i + a,
        jj = j + b;
      if (ii < 0 || jj < 0 || ii >= W2 || jj >= H2) continue;
      const n = jj * W2 + ii;
      if (wd[n] === -1) {
        wd[n] = wd[q] + 1;
        Q.push(n);
      }
    }
  }
  for (let q = 0; q < wd.length; q++) if (wd[q] === -1) wd[q] = 8;
  const depth = q => {
    const d = wd[q];
    if (d < 0) return 0;
    const K = WATER_KIND_LOOKS[wk[q]],
      i = q % W2,
      j = (q - i) / W2,
      deep = ter((i + 0.5) * 0.5, (j + 0.5) * 0.5) === 'd' ? 0.3 : 0;
    return Math.min(1, (1 - Math.exp((-(d - 0.5) * 0.5) / K.r)) * K.top + deep);
  };
  const dep = new Float32Array(W2 * H2);
  for (let q = 0; q < dep.length; q++) dep[q] = depth(q);
  T.wgrid = { W2, H2, dep, kind: wk, y: wy };
  /* v31: the shoreline: the water mask at 8 samples a metre, softened twice and nudged by noise, so the water's edge
    curves round corners instead of following the tiles; the water shader fills to its 0.5 line, the ground shader
    darkens a wet rim just outside it and paints a bed under it */
  /* water track WA-4: on a sea all round, the tide's cells (walk/sea-tide.js): wet sand it covers, shallows it leaves */
  const tide =
    sc.flatFar && !bare
      ? tideCells(
          W,
          H,
          (i, j) => ter(i + 0.5, j + 0.5),
          (i, j) => !!WATER_KIND_LOOKS[kindAt(i + 0.5, j + 0.5, false)].sea
        )
      : null;
  yield* shoreField(sc, isW, T, tide);
  yield;
  if (T === walkRenderer) groundOcclusion(sc);
  else {
    const r = yield* groundOcclusionSteps(sc);
    if (r) T.gaoTex = groundOcclusionTexture(r);
  }
  /* rocks standing in the water throw foam around themselves */
  /* water track WA-5b: what a kind does read from its look's flags, not its index: `sea` (the sea's family: swell, tide,
     surf, its shallows' share), `run` (running: leaves, a rock's full foam), `steam`, a rock's foam on `foam` 0.7 up */
  const SEA_KIND = WATER_KIND_LOOKS.findIndex(k => k.k === 'sea'),
    isSea = WATER_KIND_LOOKS.map(k => !!k.sea),
    C1 = walkData().sc,
    rocks = [];
  for (const p of sc.props || []) {
    const M = C1.props[p.k];
    if (!M) continue;
    if (/rock|boulder|stone|pebble/.test(p.k + ' ' + (M.group || '')) && isW(p.x, p.z))
      rocks.push([p.x, p.z, 0.45 + (0.25 * (M.w || 32)) / 32]);
  }
  /* WA-4: in the sea the foam reaches further (`reach` metres; its shader turns it into rings that come and go with the swell) */
  const rockFoam = (x, z, reach = 0.6) => {
    let f = 0;
    for (const r of rocks) {
      const d = Math.hypot(x - r[0], z - r[1]);
      if (d < r[2] + reach) f = Math.max(f, 1 - Math.max(0, d - r[2]) / reach);
    }
    return f;
  };
  const wv = [],
    wi = [],
    lvC = new Map(),
    fv = [],
    fi = [];
  T.falls = [];
  let wn = 0;
  const sea = !!(sc.flatFar && !bare),
    /* IS-3: a cove's calm rides in the kind (kind + calm * 0.4; the water shader takes it apart) */
    cove = sea && (sc.zones || []).some(zn => zn && zn.k === 'cove'),
    calmK = (kd, x, z) => (cove && isSea[kd] ? seaCalmAt(sc, x, z) * 0.4 : 0);
  /* WA-4: the sea's level, for the tide's skins and pools: the commonest level of its cells */
  let seaY = -0.12;
  /* the high tide's skin lies just over the sand; the sea's own corners beside it rise to meet it (no step between) */
  const tideY = (x, z) => Math.max(seaY, rawHeightAt(sc, x, z) + stp(x, z) + 0.03),
    nearCover = (x, z) => {
      if (!tide || !tide.nCover) return false;
      for (const [p, q2] of [
        [-0.25, -0.25],
        [0.25, -0.25],
        [-0.25, 0.25],
        [0.25, 0.25],
      ]) {
        const i = Math.floor(x + p),
          j = Math.floor(z + q2);
        if (i >= 0 && j >= 0 && i < W && j < H && tide.cover[j * W + i]) return true;
      }
      return false;
    };
  if (tide && (tide.nCover || tide.nPool)) {
    const lv = new Map();
    let best = 0;
    for (let q = 0; q < wk.length; q++) if (wd[q] !== -2 && isSea[wk[q]]) lv.set(wy[q], (lv.get(wy[q]) || 0) + 1);
    for (const [v, n] of lv)
      if (n > best) {
        best = n;
        seaY = v;
      }
  }
  const stream = [],
    spring = [];
  for (let j = 0; j < H2; j++) {
    if (j % 12 === 11) yield;
    for (let i = 0; i < W2; i++) {
      const cx = (i + 0.5) * 0.5,
        cz = (j + 0.5) * 0.5;
      if (!isW(cx, cz)) continue;
      const q = j * W2 + i,
        y = wy[q],
        kd = wk[q],
        KL = WATER_KIND_LOOKS[kd];
      wn++;
      const key = Math.round(y * 10);
      {
        const e = lvC.get(key) || [0, 0, 1e9, 1e9, -1e9, -1e9];
        e[0]++;
        e[1] += y;
        e[2] = Math.min(e[2], cx);
        e[3] = Math.min(e[3], cz);
        e[4] = Math.max(e[4], cx);
        e[5] = Math.max(e[5], cz);
        lvC.set(key, e);
      }
      const b0 = wv.length / 8,
        fw = flowAt(cx, cz);
      if (KL.run && (i + j * 3) % 2 === 0) stream.push([cx, cz]);
      if (KL.steam) spring.push([cx, cz, dep[q] * KL.steam]);
      /* running water follows the slope of its bed (one smooth surface down a stream); still water lies level. WA-4: a
         tide pool is calm and brims at the level of the high tide's skin, so the two meet when the sea comes in */
      const pool = !!(tide && tide.pool[Math.floor(cz) * W + Math.floor(cx)]),
        run = fw[0] !== 0 || fw[1] !== 0,
        sc0 = stp(cx, cz);
      for (const [a, c] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ]) {
        const vx = i * 0.5 + a * 0.5,
          vz = j * 0.5 + c * 0.5;
        let sh = 0,
          dd = 0,
          rs = 0;
        for (const [p, q2] of [
          [-0.25, -0.25],
          [0.25, -0.25],
          [-0.25, 0.25],
          [0.25, 0.25],
        ]) {
          /* IS-3: a sea that runs on past the edge counts the edge cell again, not nothing (it was half as deep) */
          const ii = sea ? clamp(Math.floor((vx + p) * 2), 0, W2 - 1) : Math.floor((vx + p) * 2),
            jj = sea ? clamp(Math.floor((vz + q2) * 2), 0, H2 - 1) : Math.floor((vz + q2) * 2);
          if (!isW(vx + p, vz + q2)) sh++;
          else if (ii >= 0 && jj >= 0 && ii < W2 && jj < H2) {
            dd += dep[jj * W2 + ii];
            if (ter((ii + 0.5) * 0.5, (jj + 0.5) * 0.5) === 'w') rs++;
          }
        }
        /* water track WA-4: the sea's shallows (w, wadeable) ride below the kind (kind - shallows * 0.45) for the reef's
           turquoise; a calm cove or a tide pool (above the kind) keeps its calm instead */
        const calm = pool ? 0.4 : calmK(kd, vx, vz);
        const rf = !rocks.length
          ? 0
          : KL.foam >= 0.7 && !KL.sea
            ? rockFoam(vx, vz)
            : KL.sea
              ? rockFoam(vx, vz, 1.4)
              : 0;
        wv.push(
          vx,
          run
            ? rawHeightAt(sc, vx, vz) + sc0 - 0.12
            : pool || (KL.sea && nearCover(vx, vz))
              ? Math.max(y, tideY(vx, vz))
              : y,
          vz,
          T.shoreF ? rf * (KL.run ? 1 : 0.6) : Math.max(Math.min(1, sh / 2), rf * (KL.run ? 1 : 0.6)),
          fw[0],
          fw[1],
          dd / 4,
          kd + (calm || (KL.sea ? (-0.45 * rs) / 4 : 0))
        );
      }
      wi.push(b0, b0 + 2, b0 + 1, b0 + 1, b0 + 2, b0 + 3);
      /* spilling into a lower neighbour: a sheet of falling water down the step */
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx2 = cx + di * 0.5,
          nz2 = cz + dj * 0.5;
        if (!isW(nx2, nz2)) continue;
        const nq2 = (j + dj) * W2 + (i + di);
        let yt = y,
          y2 = i + di >= 0 && j + dj >= 0 && i + di < W2 && j + dj < H2 ? wy[nq2] : wlev(nx2, nz2);
        if (run) {
          if (sc0 - stp(nx2, nz2) < 0.15) continue;
          const eh = rawHeightAt(sc, cx + di * 0.25, cz + dj * 0.25);
          yt = eh + sc0 - 0.12;
          y2 = eh + stp(nx2, nz2) - 0.12;
        } else if (y - y2 < 0.15) continue;
        const ex = cx + di * 0.25,
          ez = cz + dj * 0.25,
          px = -dj,
          pz = di,
          fb0 = fv.length / 8;
        /* WA-2a: a falls entry replaces the automatic sheets across its width */
        if (fallSets.some(f => fallCovers(f, ex, ez))) continue;
        for (const [s2, t2] of [
          [-1, 0],
          [1, 0],
          [-1, 1],
          [1, 1],
        ]) {
          fv.push(ex + px * 0.25 * s2, t2 ? y2 : yt + 0.02, ez + pz * 0.25 * s2, t2, yt - y2, s2 * 0.5 + 0.5, 0.5, 0);
        }
        fi.push(fb0, fb0 + 2, fb0 + 1, fb0 + 1, fb0 + 2, fb0 + 3);
        T.falls.push([ex + di * 0.12, y2 + 0.05, ez + dj * 0.12, yt - y2, di, dj]);
      }
    }
  }
  /* v31: the half-metre land cells around the water get a skin at their neighbour's level, so a rounded shoreline can
    reach past the tile edge (the shader keeps only what lies inside the line; the bank hides the rest) */
  if (wn && T.shoreF)
    for (let j = 0; j < H2; j++) {
      if (j % 12 === 11) yield;
      for (let i = 0; i < W2; i++) {
        const cx = (i + 0.5) * 0.5,
          cz = (j + 0.5) * 0.5;
        if (isW(cx, cz)) continue;
        let nq = -1;
        for (const [a, b] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
        ]) {
          const ii = i + a,
            jj = j + b;
          if (ii < 0 || jj < 0 || ii >= W2 || jj >= H2) continue;
          if (wd[jj * W2 + ii] > 0) {
            nq = jj * W2 + ii;
            break;
          }
        }
        /* water track WA-4: wet sand the high tide covers gets a skin of sea just over the sand, however far from the
           water, and half a metre past it so the rounded line never ends at a tile's edge (the shaders keep it only
           while the tide's line lies past it) */
        let tc = false;
        if (tide && tide.nCover)
          for (let b = -1; b <= 1 && !tc; b++)
            for (let a = -1; a <= 1; a++) {
              const ti = Math.floor(cx + a * 0.5),
                tj = Math.floor(cz + b * 0.5);
              if (ti >= 0 && tj >= 0 && ti < W && tj < H && tide.cover[tj * W + ti]) {
                tc = true;
                break;
              }
            }
        if (tc) {
          const b0 = wv.length / 8;
          for (const [a, c] of [
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
          ]) {
            const vx = i * 0.5 + a * 0.5,
              vz = j * 0.5 + c * 0.5;
            wv.push(vx, tideY(vx, vz), vz, 0, 0, 0, 0, SEA_KIND + (calmK(SEA_KIND, vx, vz) || -0.45));
          }
          wi.push(b0, b0 + 2, b0 + 1, b0 + 1, b0 + 2, b0 + 3);
          continue;
        }
        if (nq < 0) continue;
        const ni = nq % W2,
          nj = (nq - ni) / W2,
          ncx = (ni + 0.5) * 0.5,
          ncz = (nj + 0.5) * 0.5,
          s0 = stp(ncx, ncz);
        if (stp(cx, cz) < s0 - 0.05) continue;
        const fw = flowAt(ncx, ncz),
          run = fw[0] !== 0 || fw[1] !== 0,
          b0 = wv.length / 8;
        for (const [a, c] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ]) {
          const vx = i * 0.5 + a * 0.5,
            vz = j * 0.5 + c * 0.5;
          wv.push(
            vx,
            run ? rawHeightAt(sc, vx, vz) + s0 - 0.12 : wy[nq],
            vz,
            0,
            fw[0],
            fw[1],
            0,
            wk[nq] + calmK(wk[nq], vx, vz)
          );
        }
        wi.push(b0, b0 + 2, b0 + 1, b0 + 1, b0 + 2, b0 + 3);
      }
    }
  /* v24: out at sea the water runs on past the edges of the scene to the horizon. IS-3: one skirt of rings
    (logic/sea.js) from the scene's edge out to 400 m, at the level of the sea along the edge, its first ring as deep
    as the water beside it, so the two meet without a seam */
  T.seaSkirt = null;
  if (sea && wn) {
    const kd = kindAt(-1, -1, false),
      lvN = new Map();
    /* the sea's level: the commonest level of the water cells along the edge */
    for (let i = 0; i < W2; i++)
      for (const j of [0, H2 - 1])
        if (wd[j * W2 + i] !== -2) lvN.set(wy[j * W2 + i], (lvN.get(wy[j * W2 + i]) || 0) + 1);
    for (let j = 0; j < H2; j++)
      for (const i of [0, W2 - 1])
        if (wd[j * W2 + i] !== -2) lvN.set(wy[j * W2 + i], (lvN.get(wy[j * W2 + i]) || 0) + 1);
    let y = -0.12,
      best = 0;
    for (const [v, n] of lvN)
      if (n > best) {
        best = n;
        y = v;
      }
    /* the depth at a point on the edge: as the scene's water vertex there works it out (the edge cells counted twice) */
    const edgeDep = (vx, vz) => {
        let dd = 0;
        for (const [p, q2] of [
          [-0.25, -0.25],
          [0.25, -0.25],
          [-0.25, 0.25],
          [0.25, 0.25],
        ]) {
          if (!isW(vx + p, vz + q2)) continue;
          dd += dep[clamp(Math.floor((vz + q2) * 2), 0, H2 - 1) * W2 + clamp(Math.floor((vx + p) * 2), 0, W2 - 1)];
        }
        return dd / 4;
      },
      S = seaSkirt(W, H, edgeDep),
      b0 = wv.length / 8;
    /* WA-4: the shallows' share at a point on the edge, as the scene's water vertex there works it out, fading out
       over the skirt's ramp, so the reef's turquoise meets the skirt without a seam */
    const edgeReef = (vx, vz) => {
        let rs = 0;
        for (const [p, q2] of [
          [-0.25, -0.25],
          [0.25, -0.25],
          [-0.25, 0.25],
          [0.25, 0.25],
        ]) {
          const ii = clamp(Math.floor((vx + p) * 2), 0, W2 - 1),
            jj = clamp(Math.floor((vz + q2) * 2), 0, H2 - 1);
          if (isW(vx + p, vz + q2) && ter((ii + 0.5) * 0.5, (jj + 0.5) * 0.5) === 'w') rs++;
        }
        return rs / 4;
      },
      r0 = isSea[kd] ? Array.from({ length: S.n }, (_, i) => edgeReef(S.x[i], S.z[i])) : null;
    for (let q = 0; q < S.x.length; q++) {
      const cm = calmK(kd, S.x[q], S.z[q]),
        rf = r0 ? r0[q % S.n] * (1 - seaSmooth(S.o[q] / SEA_RAMP)) : 0;
      wv.push(S.x[q], y, S.z[q], 0, 0, 0, S.dep[q], kd + (cm || -0.45 * rf));
    }
    for (let m = 0; m < S.idx.length; m++) wi.push(b0 + S.idx[m]);
    T.seaSkirt = { level: y, rings: S.rings, n: S.n, out: S.o[S.o.length - 1] };
  }
  freeMesh(T.water);
  T.water = wn
    ? uploadMesh(
        new Float32Array(wv),
        new Uint32Array(wi),
        [
          ['aPos', 3, 0],
          ['aShore', 1, 12],
          ['aUV', 2, 16],
          ['aDK', 2, 24],
        ],
        32
      )
    : null;
  /* fish live where the water is deep all round; leaves start on streams; springs steam */
  const homes = [];
  /* IS-5: only the first four are kept, so the search stops there (it compared every deep cell of a sea with every
     home found so far: seconds on the island hub) */
  for (let j = 0; j < H2 && homes.length < 4; j++)
    for (let i = 0; i < W2 && homes.length < 4; i++) {
      const q = j * W2 + i;
      if (wd[q] < 4 || !WATER_KIND_LOOKS[wk[q]].fish) continue;
      const x = (i + 0.5) * 0.5,
        z = (j + 0.5) * 0.5;
      if (homes.every(h => Math.hypot(h[0] - x, h[1] - z) > 3.2))
        homes.push([x, z, wy[q], Math.min(1.3, (wd[q] - 2.5) * 0.5)]);
    }
  T.fishHomes = homes.slice(0, 4);
  T.streamCells = stream;
  T.springCells = spring.filter((_, i) => i % 3 === 0).slice(0, 10);
  T.flowAt = flowAt;
  T.flowMap = flowMap;
  flowTexture(T, bare ? null : flowMap);
  T.leaves = null;
  T.rings = [];
  /* v22: one mirror plane per body of water level (buckets a few cm apart that overlap are one pool); the reflections use
    the one nearest you, so a high canal doesn't steal the mirror from the pond you're standing by */
  const lv = [...lvC.values()]
      .map(e => ({ n: e[0], y: e[1] / e[0], b: [e[2], e[3], e[4], e[5]] }))
      .sort((a, b) => a.y - b.y),
    grp = [];
  for (const e of lv) {
    const g = grp[grp.length - 1],
      ov = g && e.b[0] <= g.b[2] + 1 && e.b[2] >= g.b[0] - 1 && e.b[1] <= g.b[3] + 1 && e.b[3] >= g.b[1] - 1;
    if (g && ov && e.y - g.y < 0.25) {
      g.y = (g.y * g.n + e.y * e.n) / (g.n + e.n);
      g.n += e.n;
      g.b = [Math.min(g.b[0], e.b[0]), Math.min(g.b[1], e.b[1]), Math.max(g.b[2], e.b[2]), Math.max(g.b[3], e.b[3])];
    } else grp.push({ ...e, b: [...e.b] });
  }
  T.wlevels = grp;
  let bk = 0;
  T.wlevel = 0;
  for (const g of grp)
    if (g.n > bk) {
      bk = g.n;
      T.wlevel = g.y;
    }
  T.wlevelR = T.wlevel;
  for (const f of fallSets) fallSheet(f, fv, fi);
  T.fallSets = fallSets;
  freeMesh(T.fallMesh);
  T.fallMesh = fv.length
    ? uploadMesh(
        new Float32Array(fv),
        new Uint32Array(fi),
        [
          ['aPos', 3, 0],
          ['aShore', 1, 12],
          ['aUV', 2, 16],
          ['aDK', 2, 24] /* WA-2a: the fall shader's aBig (location 3): width and big */,
        ],
        32
      )
    : null;
  if (T === walkRenderer) {
    buildGrass();
    T.farKey = '';
  }
}
/* water track WA-2a: a scene's waterfalls (the contract: falls [{x, z, dir, w, h, pool, k, climb}], written by lane G).
   Each is placed on the ground here: its lip at the water's level just upstream, its drop `h` (or, missing, down to the
   lowest water or ground within 2 m beyond the lip), how far out the sheet lands (the water leaves the lip moving, so
   it lands further out the higher it falls) and its foot. Entries that drop less than 0.3 m are left to the automatic
   sheets. */
function placeFalls(sc, isW, wlev, stp) {
  const out = [],
    level = (x, z) => (isW(x, z) ? wlev(x, z) : rawHeightAt(sc, x, z) + stp(x, z));
  for (const e of sc.falls || []) {
    const d = e.dir || [0, 1],
      dl = Math.hypot(d[0], d[1]) || 1,
      dx = d[0] / dl,
      dz = d[1] / dl,
      w = clamp(+e.w || 1.5, 0.5, 30),
      lipY = level(e.x - dx * 0.3, e.z - dz * 0.3);
    let h = +e.h || 0;
    if (!h) {
      let lo = lipY;
      for (let k = 0.5; k <= 2.01; k += 0.25) lo = Math.min(lo, level(e.x + dx * k, e.z + dz * k));
      h = lipY - lo;
    }
    if (!(h >= 0.3)) continue;
    const reach = Math.min(1.8, 0.25 + 0.45 * Math.sqrt(h)),
      curl = clamp(0.08 + 0.03 * h, 0.1, 0.3);
    out.push({
      x: e.x,
      z: e.z,
      dx,
      dz,
      w,
      h,
      pool: Math.max(0, +e.pool || 0),
      lipY,
      reach,
      curl,
      fx: e.x + dx * reach,
      fz: e.z + dz * reach,
      footY: lipY - h,
    });
  }
  return out;
}
/* an automatic sheet's edge (x, z) lies across a falls entry's width, at its lip or below it */
function fallCovers(f, x, z) {
  const rx = x - f.x,
    rz = z - f.z,
    along = rx * f.dx + rz * f.dz,
    lat = Math.abs(-rx * f.dz + rz * f.dx);
  return lat <= f.w / 2 + 0.35 && along > -1 && along < f.reach + 1;
}
/* a falls entry's sheet: a curled lip (a quarter turn over the edge), then the sheet falling and leaning out as the
   water does (out with the square root of the drop), a little wider at the foot, sunk 0.1 m into the pool. Its
   vertices as the automatic sheets' (position, the way down 0-1, the length, across 0-1) plus its width and 1 (big) */
function fallSheet(f, fv, fi) {
  const nC = Math.max(2, Math.ceil(f.w / 0.25)),
    nF = Math.max(4, Math.ceil(f.h / 0.5)),
    rows = [];
  for (let k = 0; k <= 3; k++) {
    const a = (k / 3) * Math.PI * 0.5;
    rows.push([f.curl * Math.sin(a), f.lipY + 0.02 - f.curl * (1 - Math.cos(a)), 0]);
  }
  for (let k = 1; k <= nF; k++) {
    const s = k / nF,
      top = f.lipY + 0.02 - f.curl;
    rows.push([f.curl + (f.reach - f.curl) * Math.sqrt(s), top - (top - f.footY + 0.1) * s, s]);
  }
  const len = [0];
  for (let k = 1; k < rows.length; k++)
    len.push(len[k - 1] + Math.hypot(rows[k][0] - rows[k - 1][0], rows[k][1] - rows[k - 1][1]));
  const L = len[len.length - 1],
    b0 = fv.length / 8,
    px = -f.dz,
    pz = f.dx;
  rows.forEach(([o, y, s], k) => {
    const hw = (f.w / 2) * (0.94 + 0.16 * s);
    for (let c = 0; c <= nC; c++) {
      const u = c / nC,
        a = (u - 0.5) * 2 * hw;
      fv.push(f.x + f.dx * o + px * a, y, f.z + f.dz * o + pz * a, len[k] / L, L, u, f.w, 1);
    }
  });
  for (let k = 0; k < rows.length - 1; k++)
    for (let c = 0; c < nC; c++) {
      const q = b0 + k * (nC + 1) + c;
      fi.push(q, q + nC + 1, q + 1, q + 1, q + nC + 1, q + nC + 2);
    }
}
export function buildGroundMesh() {
  const it = buildGroundMeshSteps(walkView.sc.groundOf || walkView.sc, walkView.ground, walkRenderer);
  let r = it.next();
  while (!r.done) r = it.next();
}
/* v46: a big texture goes up to the card a strip at a time (about 1 MB a strip), then its mipmaps are made on the card */
function* uploadTextureStrips(w, h, data, o = {}) {
  const gl = gpuState.gl,
    t = gl.createTexture();
  if (!(data instanceof Uint8Array)) {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
    makeTextureMipmaps(t, o);
    return t;
  }
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texStorage2D(gl.TEXTURE_2D, Math.floor(Math.log2(Math.max(w, h))) + 1, gl.RGBA8, w, h);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  const rows = Math.max(8, Math.floor(262144 / w));
  for (let y = 0; y < h; y += rows) {
    const n = Math.min(rows, h - y);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      y,
      w,
      n,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data.subarray(y * w * 4, (y + n) * w * 4)
    );
    if (y + n < h) yield;
  }
  makeTextureMipmaps(t, o);
  return t;
}
function makeTextureMipmaps(t, o) {
  const gl = gpuState.gl;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    o.nearest ? gl.NEAREST_MIPMAP_LINEAR : gl.LINEAR_MIPMAP_LINEAR
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, o.nearest ? gl.NEAREST : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.generateMipmap(gl.TEXTURE_2D);
}

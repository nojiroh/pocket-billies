'use strict';
/* ================= WALK MAP CACHE =================
   Phase 20 (stage B): the near ring of painted ground, preparing a place's ground, and the cache of recent places,
   moved from walk-view-gl.js as they were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import {
  flushPropModelMeshes,
  flushSolidPropMeshes,
  paintGroundRect,
  paintGroundTogether,
  paintWorkerOn,
  provide,
} from '../hooks.js';
import {
  GROUND_BORDER_M,
  GROUND_CACHE,
  PAINT_WORKER_WAIT,
  bigTilesOn,
  groundKey,
  navKept,
  paintGroundSteps,
  walkView,
} from '../walk-view.js';
import { engineSetting } from '../engine/settings.js';
import { freeMesh, gpuFree, gpuState, gpuTexture, setTextureParams } from '../engine/webgl.js';
import { walkRenderer } from './walk-state.js';
import { groundOcclusion } from './ground-textures.js';
import { grassJob, grassStep } from './grass-build.js';
import { buildGroundMesh, buildGroundMeshSteps } from './ground-mesh.js';
/* eslint-disable no-func-assign */
expose({
  MAP_CACHE_FIELDS: [() => MAP_CACHE_FIELDS],
  MAP_KEY_MEMO: [() => MAP_KEY_MEMO],
  NEAR_RING_CHUNK_M: [() => NEAR_RING_CHUNK_M],
  NEAR_RING_SIZE: [() => NEAR_RING_SIZE],
  abortGroundPrep: [() => abortGroundPrep, v => (abortGroundPrep = v)],
  freeMapCacheEntry: [() => freeMapCacheEntry, v => (freeMapCacheEntry = v)],
  freeNearRing: [() => freeNearRing, v => ((freeNearRing = v), provide({ freeNearRing }))],
  grassAheadStart: [() => grassAheadStart, v => (grassAheadStart = v)],
  grassAheadWork: [() => grassAheadWork, v => (grassAheadWork = v)],
  groundOcclusionTexture: [
    () => groundOcclusionTexture,
    v => ((groundOcclusionTexture = v), provide({ groundOcclusionTexture })),
  ],
  groundPrepWork: [() => groundPrepWork, v => (groundPrepWork = v)],
  isGroundPrepared: [() => isGroundPrepared, v => (isGroundPrepared = v)],
  keyMix: [() => keyMix, v => (keyMix = v)],
  mapCacheKey: [() => mapCacheKey, v => (mapCacheKey = v)],
  mapCacheKeyMade: [() => mapCacheKeyMade, v => (mapCacheKeyMade = v)],
  mapKeyRest: [() => mapKeyRest, v => (mapKeyRest = v)],
  navGridOf: [() => navGridOf, v => (navGridOf = v)],
  nearRingHasChunk: [() => nearRingHasChunk, v => (nearRingHasChunk = v)],
  nearRingMissingCount: [() => nearRingMissingCount, v => (nearRingMissingCount = v)],
  nearRingSlot: [() => nearRingSlot],
  newNearRing: [() => newNearRing, v => (newNearRing = v)],
  paintNearRingChunk: [() => paintNearRingChunk, v => (paintNearRingChunk = v)],
  prepareMapGround: [() => prepareMapGround, v => (prepareMapGround = v)],
  rebuildFromSettings: [() => rebuildFromSettings, v => ((rebuildFromSettings = v), provide({ rebuildFromSettings }))],
  setNearRingUniforms: [() => setNearRingUniforms, v => (setNearRingUniforms = v)],
  stopGrassAhead: [() => stopGrassAhead, v => (stopGrassAhead = v)],
  swapMapCache: [() => swapMapCache, v => setSwapMapCache(v)],
  updateNearRing: [() => updateNearRing, v => setUpdateNearRing(v)],
  wantedNearRingChunks: [() => wantedNearRingChunks, v => (wantedNearRingChunks = v)],
});
/* eslint-enable no-func-assign */
provide({ freeNearRing, groundOcclusionTexture, rebuildFromSettings });
export function setSwapMapCache(v) {
  swapMapCache = v; // eslint-disable-line no-func-assign
  provide({ swapMapCache });
}
export function setUpdateNearRing(v) {
  updateNearRing = v; // eslint-disable-line no-func-assign
  provide({ updateNearRing });
}
/* to-module: end */
/* v46: the near ring. The ground under and round you is painted at full size (32 px a metre) in 16 m squares, a few
   ms a frame, nearest first, as you walk; the 4 x 4 squares round the camera's focus sit in one texture (2048 px), each
   in the slot its position mod 4 gives, so moving on repaints only the row or column that comes into range. Beyond it
   the view's small distant picture (8 px a metre) shows, faded in over the ring's last 3 m. */
const NEAR_RING_SIZE = 4,
  NEAR_RING_CHUNK_M = 16;
function newNearRing() {
  const gl = gpuState.gl,
    TP = bigTilesOn() ? 32 : 16,
    S = NEAR_RING_SIZE * NEAR_RING_CHUNK_M * TP,
    mk = (sz, lin) => {
      const t = gpuTexture('ring', Math.round(sz * sz * 4 * 1.34));
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, Math.log2(sz) + 1, gl.RGBA8, sz, sz);
      /* alpha 0.4: a square's small sizes are made with it (on the helper thread) and only those of a square are used, so
     the whole texture's mipmaps aren't rebuilt for every square */ gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MAX_LEVEL,
        Math.log2(sz / NEAR_RING_SIZE)
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, lin ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, lin ? gl.LINEAR : gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
  return {
    TP,
    S,
    tex: mk(S, 0),
    ntex: mk(S / 2, 1),
    C: new Float32Array(32).fill(-9999),
    box: [0, 0, 0, 0],
    c0: null,
    job: null,
    want: [],
    n: 0,
  };
}
function freeNearRing(R) {
  if (!R) return;
  const gl = gpuState.gl;
  for (const J of R.jobs || [])
    try {
      J.it.return();
    } catch (e) {}
  R.jobs = [];
  gpuFree(R.tex);
  gpuFree(R.ntex);
  R.tex = R.ntex = null;
}
/* which squares are wanted: the 4 x 4 round the focus (a little ahead of it, the way the camera looks) */
function wantedNearRingChunks(R, sc, fx, fz) {
  const P = GROUND_BORDER_M,
    cx = fx + P,
    cy = sc.h + P - fz,
    tx = cx / NEAR_RING_CHUNK_M,
    ty = cy / NEAR_RING_CHUNK_M - 0.4,
    nx = Math.ceil((sc.w + 2 * P) / NEAR_RING_CHUNK_M),
    ny = Math.ceil((sc.h + 2 * P) / NEAR_RING_CHUNK_M);
  let c0 = [Math.round(tx - 2), Math.round(ty - 2)];
  if (R.c0 && Math.abs(tx - 2 - R.c0[0]) < 0.75 && Math.abs(ty - 2 - R.c0[1]) < 0.75) c0 = R.c0;
  if (!R.c0 || R.c0[0] !== c0[0] || R.c0[1] !== c0[1]) {
    R.c0 = c0;
    R.box = [
      c0[0] * NEAR_RING_CHUNK_M,
      c0[1] * NEAR_RING_CHUNK_M,
      (c0[0] + NEAR_RING_SIZE) * NEAR_RING_CHUNK_M,
      (c0[1] + NEAR_RING_SIZE) * NEAR_RING_CHUNK_M,
    ];
    const L = [];
    for (let j = c0[1]; j < c0[1] + NEAR_RING_SIZE; j++)
      for (let i = c0[0]; i < c0[0] + NEAR_RING_SIZE; i++) {
        if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
        L.push([i, j, Math.hypot(i + 0.5 - tx, j + 0.5 - ty)]);
      }
    L.sort((a, b) => a[2] - b[2]);
    R.want = L;
    /* squares that left the ring are dropped at once (their slot is someone else's now) */ for (
      let s = 0;
      s < 16;
      s++
    ) {
      const ci = R.C[s * 2],
        cj = R.C[s * 2 + 1];
      if (ci < -999) continue;
      if (ci < c0[0] || cj < c0[1] || ci >= c0[0] + NEAR_RING_SIZE || cj >= c0[1] + NEAR_RING_SIZE) {
        R.C[s * 2] = -9999;
        R.C[s * 2 + 1] = -9999;
      }
    }
  }
  return R.want;
}
const nearRingSlot = (ci, cj) =>
  (((ci % NEAR_RING_SIZE) + NEAR_RING_SIZE) % NEAR_RING_SIZE) +
  (((cj % NEAR_RING_SIZE) + NEAR_RING_SIZE) % NEAR_RING_SIZE) * NEAR_RING_SIZE;
function nearRingHasChunk(R, ci, cj) {
  const s = nearRingSlot(ci, cj);
  return R.C[s * 2] === ci && R.C[s * 2 + 1] === cj;
}
function nearRingMissingCount(R) {
  let n = 0;
  for (const [i, j] of R.want) if (!nearRingHasChunk(R, i, j)) n++;
  return n;
}
/* paint and upload one square (a generator: the painting is sliced; the upload is at the end) */
function* paintNearRingChunk(R, sc, ci, cj, pr) {
  const s = nearRingSlot(ci, cj);
  R.C[s * 2] = -9999;
  R.C[s * 2 + 1] = -9999;
  const o = {
    TP: R.TP,
    rect: [ci * NEAR_RING_CHUNK_M, cj * NEAR_RING_CHUNK_M, NEAR_RING_CHUNK_M, NEAR_RING_CHUNK_M],
    margin: 2,
    nhalf: true,
    mips: 1,
    pr: pr || 0,
  };
  const r = yield* typeof paintGroundRect === 'function' ? paintGroundRect(sc, o) : paintGroundSteps(sc, o);
  if (!R.tex) return;
  const gl = gpuState.gl,
    px = R.TP * NEAR_RING_CHUNK_M,
    sx = s % NEAR_RING_SIZE,
    sy = (s / NEAR_RING_SIZE) | 0;
  gl.bindTexture(gl.TEXTURE_2D, R.tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, sx * px, sy * px, px, px, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(r.px.buffer));
  /* alpha 0.4: the square's own small sizes, made with it on the helper thread (else the texture's, here) */
  if (r.mips)
    r.mips.forEach((L, k) => {
      const q = px >> (k + 1);
      if (q >= 1) gl.texSubImage2D(gl.TEXTURE_2D, k + 1, sx * q, sy * q, q, q, gl.RGBA, gl.UNSIGNED_BYTE, L);
    });
  else gl.generateMipmap(gl.TEXTURE_2D);
  if (r.nrm) {
    const h = px >> 1;
    gl.bindTexture(gl.TEXTURE_2D, R.ntex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, sx * h, sy * h, h, h, gl.RGBA, gl.UNSIGNED_BYTE, r.nrm);
    if (r.nmips)
      r.nmips.forEach((L, k) => {
        const q = h >> (k + 1);
        if (q >= 1) gl.texSubImage2D(gl.TEXTURE_2D, k + 1, sx * q, sy * q, q, q, gl.RGBA, gl.UNSIGNED_BYTE, L);
      });
    else gl.generateMipmap(gl.TEXTURE_2D);
  }
  R.C[s * 2] = ci;
  R.C[s * 2 + 1] = cj;
  R.n++;
}
/* each frame: keep the ring round the camera's focus, painting what is missing a few ms at a time (more while the
   squares right round you are still missing, so a scene never opens blurred for long) */
export function updateNearRing(sc, fx, fz, budget) {
  if (!walkRenderer.on || !sc) return;
  let R = walkRenderer.ring;
  if (!R) {
    if (!walkRenderer.gtex) return;
    R = walkRenderer.ring = newNearRing();
  }
  const W = wantedNearRingChunks(R, sc, fx, fz);
  const t0 = performance.now();
  const near = W.slice(0, 4).some(([i, j]) => !nearRingHasChunk(R, i, j));
  if (near) budget = Math.max(budget, R.n === 0 ? 30 : 12);
  /* alpha 0.4: with the helper thread painting, a few squares are asked for at once (nearest first) and this frame only
    puts the finished ones on the card; without it, one square at a time, painted here a slice at a time */
  const K = typeof paintWorkerOn === 'function' && paintWorkerOn() ? 3 : 1;
  R.jobs = (R.jobs || []).filter(J => {
    if (W.some(([i, j]) => i === J.ci && j === J.cj)) return true;
    try {
      J.it.return();
    } catch (e) {}
    return false;
  }); /* (squares that left the ring before they were done) */
  while (performance.now() - t0 < budget) {
    for (; R.jobs.length < K;) {
      const nx = W.find(([i, j]) => !nearRingHasChunk(R, i, j) && !R.jobs.some(J => J.ci === i && J.cj === j));
      if (!nx) break;
      R.jobs.push({ ci: nx[0], cj: nx[1], it: paintNearRingChunk(R, sc, nx[0], nx[1], nx[2]) });
    }
    if (!R.jobs.length) break;
    let moved = false;
    for (let k = R.jobs.length - 1; k >= 0; k--) {
      const r = R.jobs[k].it.next();
      if (r.done) {
        R.jobs.splice(k, 1);
        moved = true;
      } else if (r.value !== PAINT_WORKER_WAIT) moved = true;
    }
    if (!moved) break;
  }
}
export function setNearRingUniforms(U, sc) {
  if (!U.uRing) return;
  const gl = gpuState.gl,
    R = walkRenderer.ring,
    on = !!(R && R.tex);
  gl.activeTexture(gl.TEXTURE9);
  gl.bindTexture(gl.TEXTURE_2D, on ? R.tex : gpuState.white);
  gl.bindSampler(9, null);
  gl.uniform1i(U.uRing, 9);
  gl.activeTexture(gl.TEXTURE14);
  gl.bindTexture(gl.TEXTURE_2D, on ? R.ntex : gpuState.flatN);
  gl.bindSampler(14, null);
  gl.uniform1i(U.uRingN, 14);
  gl.activeTexture(gl.TEXTURE0);
  const P = GROUND_BORDER_M;
  gl.uniform3f(U.uCanvas, sc.w + 2 * P, sc.h + 2 * P, on ? 1 : 0);
  if (on) {
    gl.uniform2fv(U.uRingC, R.C);
    gl.uniform4f(U.uRingBox, R.box[0], R.box[1], R.box[2], R.box[3]);
  }
}
function groundOcclusionTexture(r) {
  const gl = gpuState.gl,
    { FW, FH, d } = r,
    t = gpuTexture('ground', FW * FH);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, FW, FH, 0, gl.RED, gl.UNSIGNED_BYTE, d);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  setTextureParams({ linear: true });
  return t;
}
/* v46: the frame's key for a view's ground (its mesh, water and textures are kept under it, swapMapCache).
   FL-4: asked every frame, it was a new string every frame (the ground key holds the whole tile map) and compared
   in full with the last one; now the last key is given back while what it is made from is the same (the ground key
   the same string, the waters' contents by a number), so the frame's comparison is one of the same string */
const MAP_KEY_MEMO = { id: null, sc: null, gkey: null, rest: NaN, key: '' };
export function mapCacheKey(id, sc, gkey) {
  if (sc.groundOf) return mapCacheKey(sc.roomBase, sc.groundOf, gkey); /* phase 08b: a room keeps its place's ground */
  const m = MAP_KEY_MEMO,
    rest = mapKeyRest(sc);
  if (m.id === id && m.sc === sc && m.gkey === gkey && m.rest === rest) return m.key;
  m.id = id;
  m.sc = sc;
  m.gkey = gkey;
  m.rest = rest;
  return (m.key = mapCacheKeyMade(id, sc, gkey));
}
/* everything but the id, the scene and the ground key that the key reads, as one number (no string made) */
function mapKeyRest(sc) {
  let h = keyMix(0x811c9dc5 | 0, (sc.props || []).length);
  h = keyMix(h, sc.heights ? sc.heights.length : 0);
  h = keyMix(h, sc.waters || 0);
  h = keyMix(h, sc.waterKind || '');
  h = keyMix(h, engineSetting('water', 'kinds') ? 1 : 0);
  h = keyMix(h, sc.flatFar ? 1 : 0);
  h = keyMix(h, sc.ride ? 1 : 0);
  return h;
}
/* a value's contents into the number h, as JSON.stringify would tell them apart (numbers, strings, arrays, objects) */
function keyMix(h, v) {
  if (typeof v === 'number') {
    h = Math.imul(h ^ (v | 0), 0x01000193);
    return Math.imul(h ^ (((v - (v | 0)) * 1e6) | 0), 0x01000193) | 0;
  }
  if (typeof v === 'string') {
    h = Math.imul(h ^ 0x73, 0x01000193);
    for (let i = 0; i < v.length; i++) h = Math.imul(h ^ v.charCodeAt(i), 0x01000193);
    return h | 0;
  }
  if (typeof v === 'boolean') return Math.imul(h ^ (v ? 0x74 : 0x66), 0x01000193) | 0;
  if (Array.isArray(v)) {
    h = Math.imul(h ^ 0x5b, 0x01000193);
    for (const x of v) h = keyMix(h, x);
    return Math.imul(h ^ v.length, 0x01000193) | 0;
  }
  if (v && typeof v === 'object') {
    h = Math.imul(h ^ 0x7b, 0x01000193);
    for (const k in v) {
      h = keyMix(h, k);
      h = keyMix(h, v[k]);
    }
    return h | 0;
  }
  return Math.imul(h ^ (v === null ? 0x6e : 0x75), 0x01000193) | 0;
}
function mapCacheKeyMade(id, sc, gkey) {
  return (
    id +
    '|' +
    gkey +
    '|' +
    (sc.props || []).length +
    '|' +
    (sc.heights ? sc.heights.length : 0) +
    '|' +
    JSON.stringify(sc.waters || 0) +
    (sc.waterKind || '') +
    (engineSetting('water', 'kinds') ? 1 : 0) +
    (sc.flatFar ? 'F' : '') +
    (sc.ride ? 'R' : '')
  );
}
/* v46: get a view's ground ready before it is shown: built a few ms a frame (groundPrepWork) and kept with the scenes you
   left (walkRenderer.sceneCache), so the switch to it is a swap of a few references. Returns true when it is ready. */
export function isGroundPrepared(id, sc, gkey) {
  const M = walkRenderer.sceneCache,
    k = mapCacheKey(id, sc, gkey || groundKey(sc));
  return k === walkRenderer.hkey || !!(M && M.has(k)); /* (phase 08b: or it is the one on screen: out of a room) */
}
export function prepareMapGround(id, sc, G, urgent, focus) {
  if (!walkRenderer.on || !G) return false;
  const gkey = groundKey(sc),
    hk = mapCacheKey(id, sc, gkey);
  if (walkRenderer.sceneCache && walkRenderer.sceneCache.has(hk)) return true;
  if (walkRenderer.hkey === hk) return true;
  if (walkRenderer.prep) {
    if (walkRenderer.prep.hk === hk) {
      if (urgent) walkRenderer.prep.urgent = 1;
      return false;
    }
    if (!urgent || walkRenderer.prep.urgent) return false;
    abortGroundPrep();
  }
  /* a view needed now goes first; one only looked ahead to waits its turn */ const T = {
    prepared: 1,
    grass: null,
    grassKey: null,
  };
  walkRenderer.prep = {
    hk,
    id,
    sc,
    gkey,
    T,
    it: (function* () {
      yield* buildGroundMeshSteps(sc, G, T);
      /* v46: and the squares round where you will come in */ if (focus) {
        T.ring = newNearRing();
        const W = wantedNearRingChunks(T.ring, sc, focus[0], focus[1]),
          Q = W.slice(0, 9).map(([i, j, d]) => paintNearRingChunk(T.ring, sc, i, j, 6 + d));
        /* alpha 0.4: all nine on the helper together; painted here, one after another */ if (
          typeof paintWorkerOn === 'function' &&
          paintWorkerOn()
        )
          yield* paintGroundTogether(Q);
        else for (const g of Q) yield* g;
      }
    })(),
    t0: performance.now(),
    ms: 0,
    urgent: urgent ? 1 : 0,
  };
  return false;
}
/* FL-4 (quality.grassAhead): a view prepared ahead plants its grass while it waits in the cache, on its own walking
   grid once that is built (walk-view.js navPrepare), in what is left of the ground's budget; swapped in before it is
   done, the job goes on for the view on screen (swapMapCache) */
function grassAheadStart(J) {
  stopGrassAhead();
  if (!engineSetting('quality', 'grassAhead') || (J.sc.indoor && !J.sc.grass)) return;
  walkRenderer.grassAhead = { hk: J.hk, T: J.T, sc: J.sc, gkey: J.gkey, J: null, t0: performance.now(), ms: 0 };
}
function stopGrassAhead() {
  const A = walkRenderer.grassAhead;
  walkRenderer.grassAhead = null;
  if (A && A.J) A.J.abort();
}
/* view sc's walking grid for ground key G, if it is ready (on screen, kept from before or built ahead) */
function navGridOf(sc, G) {
  if (!navKept(sc, G) && !(walkView.nav && walkView.navSc === sc && walkView.navG === G)) return null;
  if (walkView.nav && walkView.navSc === sc && walkView.navG === G) return walkView.nav;
  const P = (sc.props || []).length,
    K = (walkView.navKeep || []).find(k => k.sc === sc && k.G === G && k.P === P),
    A = (walkView.navAhead || []).find(a => a.sc === sc && a.G === G && a.nav);
  return (K && K.nav) || (A && A.nav) || null;
}
function grassAheadWork(budget) {
  const A = walkRenderer.grassAhead;
  if (!A || !(budget > 0)) return;
  const M = walkRenderer.sceneCache;
  if (!M || M.get(A.hk) !== A.T) {
    stopGrassAhead();
    return;
  }
  const t0 = performance.now();
  if (!A.J) {
    const G = navGridOf(A.sc, A.gkey);
    if (!G) return;
    A.J = grassJob(A.sc, G, A.T);
  }
  const done = grassStep(A.J, budget);
  A.ms += performance.now() - t0;
  if (!done) return;
  A.T.grassKey = A.J.dk;
  walkRenderer.grassAhead = null;
  walkRenderer.grassAheadDone = (walkRenderer.grassAheadDone || 0) + 1;
  if (typeof debugLog !== 'undefined')
    debugLog.add(
      'scene',
      `planted ${A.hk.split('|')[0]}'s grass ahead (${Math.round(A.ms)} ms of work over ${Math.round(performance.now() - A.t0)} ms)`
    );
}
function abortGroundPrep() {
  const J = walkRenderer.prep;
  if (!J) return;
  walkRenderer.prep = null;
  try {
    J.it.return();
  } catch (e) {}
  freeMapCacheEntry(J.T);
}
export function groundPrepWork(budget) {
  const J = walkRenderer.prep;
  if (!J) {
    grassAheadWork(budget);
    return;
  }
  if (walkRenderer.hkey === J.hk) {
    abortGroundPrep();
    return;
  }
  if (J.urgent && budget) budget *= 2 * (walkRenderer.prepBoost || 1);
  const t0 = performance.now();
  try {
    while (performance.now() - t0 < budget) {
      const r = J.it.next();
      if (!r.done && r.value === PAINT_WORKER_WAIT) break;
      /* (waiting on the helper thread) */ if (r.done) {
        walkRenderer.prep = null;
        J.ms += performance.now() - t0;
        const M = walkRenderer.sceneCache || (walkRenderer.sceneCache = new Map()),
          keep = engineSetting('quality', 'keepScenes') ?? 3;
        M.delete(J.hk);
        M.set(J.hk, J.T);
        for (const k of [...M.keys()]) {
          if (M.size <= Math.max(1, keep - 1)) break;
          if (k !== J.hk) {
            freeMapCacheEntry(M.get(k));
            M.delete(k);
          }
        }
        grassAheadStart(J);
        if (typeof debugLog !== 'undefined')
          debugLog.add(
            'scene',
            `prepared ${J.id} on the card (${Math.round(J.ms)} ms of work over ${Math.round(performance.now() - J.t0)} ms)`
          );
        return;
      }
    }
  } catch (e) {
    walkRenderer.prep = null;
    freeMapCacheEntry(J.T);
    if (typeof debugLog !== 'undefined')
      debugLog.add('webgl', 'preparing ' + J.id + ' failed: ' + ((e && e.message) || e));
    return;
  }
  J.ms += performance.now() - t0;
}
/* v32: the last few scenes' ground, water and grass stay on the graphics card, so walking out of a house (or back
   from a trip) doesn't rebuild them; the oldest is let go when a fourth arrives */
export const MAP_CACHE_FIELDS = [
  'ring',
  'gaoTex',
  'gtex',
  'ftex',
  'ctex',
  'gntex',
  'mesh',
  'valley',
  'wgrid',
  'shoreF',
  'shoreTex',
  'water',
  'fallMesh',
  'falls',
  'fallSets',
  'fishHomes',
  'streamCells',
  'springCells',
  'flowAt',
  'flowMap',
  'flowTex',
  'wlevels',
  'wlevel',
  /* 0.1.0 alpha: the sea's skirt out to the horizon (it stayed behind when a view prepared ahead was swapped in) */
  'seaSkirt',
  'grass',
  'grassKey',
];
/* alpha 0.4.1: everything built from the settings once (the ground and its relief, the grass, far props, solid props and
   trees) made again, for a dial changed in the Studio (or Settings) that those depend on */
export function rebuildFromSettings() {
  if (typeof walkRenderer === 'undefined' || !walkRenderer.on) return;
  try {
    if (walkRenderer.sceneCache) {
      for (const e of walkRenderer.sceneCache.values()) freeMapCacheEntry(e);
      walkRenderer.sceneCache.clear();
    }
    if (walkRenderer.mesh) {
      const e = {};
      for (const k of MAP_CACHE_FIELDS) {
        e[k] = walkRenderer[k];
        walkRenderer[k] = null;
      }
      freeMapCacheEntry(e);
    }
    if (walkRenderer.prep) abortGroundPrep();
    stopGrassAhead();
  } catch (e) {
    console.warn(e);
  }
  walkRenderer.hkey = '';
  walkRenderer.gkey = '';
  walkRenderer.farKey = '';
  walkRenderer.grass = null;
  walkRenderer.grassKey = null;
  walkRenderer.itemGen = (walkRenderer.itemGen || 0) + 1;
  walkView.gkey = '';
  if (typeof GROUND_CACHE !== 'undefined') GROUND_CACHE.clear();
  if (typeof flushSolidPropMeshes === 'function') flushSolidPropMeshes();
  if (typeof flushPropModelMeshes === 'function') flushPropModelMeshes();
}
export function swapMapCache(oldKey, key) {
  walkRenderer.swapT = performance.now();
  const M = walkRenderer.sceneCache || (walkRenderer.sceneCache = new Map()),
    keep = engineSetting('quality', 'keepScenes') ?? 3;
  if (oldKey && walkRenderer.mesh && keep > 0) {
    const e = {};
    for (const k of MAP_CACHE_FIELDS) {
      e[k] = walkRenderer[k];
      walkRenderer[k] = null;
    }
    if (e.ring) {
      freeNearRing(e.ring);
      e.ring = null;
    }
    /* v46: a view you left keeps its ground but not its near ring (26 MB); it is painted again if you come back */ M.delete(
      oldKey
    );
    M.set(oldKey, e);
  } else if (walkRenderer.ring) {
    freeNearRing(walkRenderer.ring);
    walkRenderer.ring = null;
  }
  const hit = M.get(key);
  if (walkRenderer.prep && walkRenderer.prep.hk === key) abortGroundPrep(); /* v46: about to build it anyway */
  if (hit && (hit.prepared || hit.grassKey === engineSetting('grass', 'density'))) {
    M.delete(key);
    for (const k of MAP_CACHE_FIELDS) walkRenderer[k] = hit[k];
    walkRenderer.rings = [];
    walkRenderer.wake = [];
    walkRenderer.leaves = null;
    walkRenderer.wlevelR = null;
    walkRenderer.farKey = '';
    walkRenderer.basinKey = null;
    if (!walkRenderer.gaoTex && walkView.sc) groundOcclusion(walkView.sc);
    /* v46: a view prepared ahead plants its grass now (sliced, a few ms a frame) */ if (hit.prepared) {
      const dk = engineSetting('grass', 'density'),
        A = walkRenderer.grassAhead;
      /* FL-4 (quality.grassAhead): planted ahead, it is kept; still being planted, the job goes on for this view */
      if (hit.grass && hit.grassKey === dk) walkRenderer.grassKey = dk;
      else if (A && A.hk === key && A.J && A.J.dk === dk && A.sc === walkView.sc) {
        walkRenderer.grassAhead = null;
        if (walkRenderer.grassJob) walkRenderer.grassJob.abort();
        A.J.target = walkRenderer;
        walkRenderer.grass = null;
        walkRenderer.grassJob = A.J;
        walkRenderer.grassKey = dk;
      } else {
        if (A && A.hk === key) stopGrassAhead();
        if (hit.grass) {
          gpuFree(hit.grass.vao);
          gpuFree(hit.grass.ib);
          gpuFree(hit.grass.vb);
        }
        walkRenderer.grass = null;
        walkRenderer.grassKey = null;
      }
    } else if (!walkRenderer.grass) {
      /* 0.1.0 alpha: a view left while its grass was still being planted kept none (marked planted); planted now */
      walkRenderer.grassKey = null;
    }
  } else {
    if (hit) {
      M.delete(key);
      freeMapCacheEntry(hit);
    }
    buildGroundMesh();
  }
  while (M.size > Math.max(0, keep - 1)) {
    const k0 = M.keys().next().value;
    freeMapCacheEntry(M.get(k0));
    M.delete(k0);
  }
}
export function freeMapCacheEntry(e) {
  const gl = gpuState.gl;
  if (!e) return;
  if (e.ring) {
    freeNearRing(e.ring);
    e.ring = null;
  }
  for (const k of ['gtex', 'ftex', 'ctex', 'gntex', 'shoreTex', 'gaoTex', 'flowTex'])
    if (e[k] && e[k] !== gpuState.white && e[k] !== gpuState.flatN) gpuFree(e[k]);
  for (const k of ['mesh', 'water', 'fallMesh']) if (e[k]) freeMesh(e[k]);
  if (e.grass) {
    gpuFree(e.grass.vao);
    gpuFree(e.grass.ib);
    gpuFree(e.grass.vb);
  }
}

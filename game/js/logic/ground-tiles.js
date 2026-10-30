'use strict';
/* ================= GROUND TILES =================
   Fluid track FL-5b (quality.groundTiles): the walk's ground is one mesh of the whole place at 0.5 m (Copperleaf: about
   316k triangles with its far land), drawn whole by the scene and by every shadow pass. Here its indices are put in
   order by 16 m tile, in three groups that keep their order (the floors, the walls, the far land), so FL-5a's walls
   stay one range; each tile keeps its index range and its box. A pass then draws only the tiles its view matrix can
   see, neighbouring tiles' ranges merged into one draw. The vertices are untouched: the same triangles, in another
   order. Pure functions, no graphics (tools/test/ground-tiles.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
/* eslint-disable no-func-assign */
expose({
  GROUND_TILE_M: [() => GROUND_TILE_M],
  groundBoxSeen: [() => groundBoxSeen, v => (groundBoxSeen = v)],
  groundCurveLift: [() => groundCurveLift, v => ((groundCurveLift = v), provide({ groundCurveLift }))],
  groundTileOrder: [() => groundTileOrder, v => ((groundTileOrder = v), provide({ groundTileOrder }))],
  groundTileRuns: [() => groundTileRuns, v => ((groundTileRuns = v), provide({ groundTileRuns }))],
});
/* eslint-enable no-func-assign */
provide({ groundCurveLift, groundTileOrder, groundTileRuns });
/* to-module: end */
/** the tiles' size (m) */
export const GROUND_TILE_M = 16;

/**
 * The index list in tile order. The groups are consecutive ranges of whole quads (6 indices each, two triangles); each
 * quad goes to the tile under its middle (the mean of its six indices' corners, x and z), the quads of a tile keep
 * their order, the tiles go row by row (z, then x), the groups stay in their order.
 * @param {ArrayLike<number>} V the vertices, `stride` floats each, x y z first
 * @param {ArrayLike<number>} I the indices
 * @param {number[]} ends where each group ends in I (the last is I.length); a group starts where the one before ends
 * @param {number} [stride] floats a vertex
 * @param {number} [tileM] the tile's size (m)
 * @returns {{I: Uint32Array, ends: number[], tiles: {g: number, tx: number, tz: number, a: number, n: number}[], box: Float32Array}}
 *   the indices in tile order, the groups' new ends (the same numbers), the tiles in draw order (group, row, column:
 *   first index and count) and each tile's box (x0 y0 z0 x1 y1 z1, six floats a tile)
 */
export function groundTileOrder(V, I, ends, stride = 9, tileM = GROUND_TILE_M) {
  const nq = Math.floor(I.length / 6);
  let mx = Infinity,
    mz = Infinity;
  const qx = new Float32Array(nq),
    qz = new Float32Array(nq);
  for (let q = 0; q < nq; q++) {
    let sx = 0,
      sz = 0;
    for (let k = 0; k < 6; k++) {
      const v = I[q * 6 + k] * stride;
      sx += V[v];
      sz += V[v + 2];
    }
    qx[q] = sx / 6;
    qz[q] = sz / 6;
    if (qx[q] < mx) mx = qx[q];
    if (qz[q] < mz) mz = qz[q];
  }
  const x0 = Math.floor(mx / tileM) * tileM,
    z0 = Math.floor(mz / tileM) * tileM;
  let ncx = 1;
  for (let q = 0; q < nq; q++) ncx = Math.max(ncx, Math.floor((qx[q] - x0) / tileM) + 1);
  /* each quad's key: group, row, column */
  const key = new Int32Array(nq);
  let g = 0;
  for (let q = 0; q < nq; q++) {
    while (g < ends.length - 1 && q * 6 >= ends[g]) g++;
    const tx = Math.floor((qx[q] - x0) / tileM),
      tz = Math.floor((qz[q] - z0) / tileM);
    key[q] = (g * 4096 + tz) * ncx + tx;
  }
  /* a counting sort by key, stable */
  const keys = Array.from(new Set(key)).sort((a, b) => a - b),
    slot = new Map(keys.map((k, i) => [k, i])),
    count = new Int32Array(keys.length + 1);
  for (let q = 0; q < nq; q++) count[slot.get(key[q]) + 1]++;
  for (let i = 1; i <= keys.length; i++) count[i] += count[i - 1];
  const at = count.slice(0, keys.length),
    out = new Uint32Array(I.length),
    box = new Float32Array(keys.length * 6);
  for (let t = 0; t < keys.length; t++) box.set([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], t * 6);
  for (let q = 0; q < nq; q++) {
    const t = slot.get(key[q]),
      d = at[t]++ * 6;
    for (let k = 0; k < 6; k++) {
      const i = I[q * 6 + k],
        v = i * stride;
      out[d + k] = i;
      for (let c = 0; c < 3; c++) {
        if (V[v + c] < box[t * 6 + c]) box[t * 6 + c] = V[v + c];
        if (V[v + c] > box[t * 6 + 3 + c]) box[t * 6 + 3 + c] = V[v + c];
      }
    }
  }
  /* (a tail that isn't a whole quad stays at the end, in the last group) */
  for (let i = nq * 6; i < I.length; i++) out[i] = I[i];
  const tiles = keys.map((k, t) => {
    const tx = k % ncx,
      r = (k - tx) / ncx;
    return { g: Math.floor(r / 4096), tz: r % 4096, tx, a: count[t] * 6, n: (count[t + 1] - count[t]) * 6 };
  });
  if (I.length > nq * 6 && tiles.length) tiles[tiles.length - 1].n += I.length - nq * 6;
  return { I: out, ends: ends.slice(), tiles, box };
}

/**
 * Is a box in a view matrix's clip volume? False only when all eight corners are outside the same clip plane, so a
 * tile the matrix can see is never left out (column-major, as the shaders read uVP).
 * @param {ArrayLike<number>} m the view matrix (16 floats)
 * @param {ArrayLike<number>} b the boxes (six floats each)
 * @param {number} o the box's first float
 * @param {number} [dy] how far the world's curve can move the box up or down (m)
 */
export function groundBoxSeen(m, b, o, dy = 0) {
  let out = 63;
  for (let c = 0; c < 8 && out; c++) {
    const x = b[o + (c & 1 ? 3 : 0)],
      y = c & 2 ? b[o + 4] + dy : b[o + 1] - dy,
      z = b[o + (c & 4 ? 5 : 2)],
      X = m[0] * x + m[4] * y + m[8] * z + m[12],
      Y = m[1] * x + m[5] * y + m[9] * z + m[13],
      Z = m[2] * x + m[6] * y + m[10] * z + m[14],
      W = m[3] * x + m[7] * y + m[11] * z + m[15];
    out &=
      (X < -W ? 1 : 0) | (X > W ? 2 : 0) | (Y < -W ? 4 : 0) | (Y > W ? 8 : 0) | (Z < -W ? 16 : 0) | (Z > W ? 32 : 0);
  }
  return !out;
}

/**
 * The draws for one pass: the tiles of the groups asked for that the matrix can see, neighbouring ranges merged.
 * @param {{tiles: {g: number, a: number, n: number}[], box: Float32Array}} T groundTileOrder's tiles and boxes
 * @param {ArrayLike<number>} m the pass's view matrix
 * @param {number} groups which groups (bit 1 the floors, 2 the walls, 4 the far land)
 * @param {(o: number) => number} [lift] how far the world's curve can move tile o's box (m)
 * @param {number[]} [runs] filled with [first index, count] pairs (reused)
 * @returns {{runs: number[], tiles: number, seen: number}} the runs, how many tiles were asked and how many are drawn
 */
export function groundTileRuns(T, m, groups, lift, runs = []) {
  runs.length = 0;
  let asked = 0,
    seen = 0;
  for (let t = 0; t < T.tiles.length; t++) {
    const tl = T.tiles[t];
    if (!((groups >> tl.g) & 1) || !tl.n) continue;
    asked++;
    if (!groundBoxSeen(m, T.box, t * 6, lift ? lift(t * 6) : 0)) continue;
    seen++;
    const k = runs.length;
    if (k && runs[k - 2] + runs[k - 1] === tl.a) runs[k - 1] += tl.n;
    else runs.push(tl.a, tl.n);
  }
  return { runs, tiles: asked, seen };
}

/**
 * How far the world's curve (the shaders' curveY: k times the square of the distance past d0 from the middle) can
 * move a box: at its corner farthest from the middle.
 * @param {ArrayLike<number>} b the boxes
 * @param {number} o the box's first float
 * @param {number[]} ca worldCurveArgs: middle x, middle z, k, d0
 */
export function groundCurveLift(b, o, ca) {
  const dx = Math.max(Math.abs(b[o] - ca[0]), Math.abs(b[o + 3] - ca[0])),
    dz = Math.max(Math.abs(b[o + 2] - ca[1]), Math.abs(b[o + 5] - ca[1])),
    d = Math.max(0, Math.hypot(dx, dz) - ca[3]);
  return Math.abs(ca[2]) * d * d;
}

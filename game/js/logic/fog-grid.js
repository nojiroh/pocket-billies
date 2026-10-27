// @ts-check
'use strict';
/* ================= FOG GRID (air track AIR-2) =================
   The low fog's density round the player as a grid of cells (about 1 m), plain numbers here
   (tools/test/fog-grid.test.mjs); walk/fog-grid.js keeps it round the player and uploads it as a 3D texture that the
   light-in-air march reads (AIR-3). Nothing reads it before AIR-3.
   - The fog lies on a much smoothed ground: each column's fog top is the mean ground in a ring round it (FOG_RING m)
     plus a layer that thickens with fog weather. A hollow sits below its ring, so it fills up to its rim; a hilltop
     stands above its ring, so its top stays clear. Near water the fog rises to the water level plus the mist
     height. A valley's mist (walkRenderer.valley) fills below its level as in fogit.
   - How much fog: the scene's mist (or the Low mist dial) plus the weather's fog (environment.fog already holds the
     dawn mist: the larger of the two). Indoors there is none.
   - A drifting value noise breaks it into banks: world-anchored, moved by the wind's drift, so a row filled later
     carries the drift of its time (walk/fog-grid.js refreshes the rows a few at a time, so neighbours match).
   - The grid is a ring in x and z: world cell (ix, iy, iz) lives at texel (ix mod nx, iy - oy, iz mod nz), so a step
     of one cell refills one slab, and the 3D texture is read with repeat in x and z (clamp in y). */
/* the grid's cells: 48 x 12 x 48 of 1 m, 32 x 8 x 32 on phones; how far below the player's ground the grid starts */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  FOG_EDGE: [() => FOG_EDGE],
  FOG_FALL: [() => FOG_FALL],
  FOG_GRID_BELOW: [() => FOG_GRID_BELOW],
  FOG_GRID_SIZES: [() => FOG_GRID_SIZES],
  FOG_LAYER: [() => FOG_LAYER],
  FOG_MARCH_STEPS: [() => FOG_MARCH_STEPS],
  FOG_NOISE_K: [() => FOG_NOISE_K],
  FOG_NOISE_M: [() => FOG_NOISE_M],
  FOG_NOISE_TOP: [() => FOG_NOISE_TOP],
  FOG_RING: [() => FOG_RING],
  FOG_RING_AT: [() => FOG_RING_AT],
  // @ts-expect-error -- replaced on purpose
  fogAmount: [() => fogAmount, v => (fogAmount = v)],
  fogClamp: [() => fogClamp],
  // @ts-expect-error -- replaced on purpose
  fogColumn: [() => fogColumn, v => (fogColumn = v)],
  // @ts-expect-error -- replaced on purpose
  fogDensityAt: [() => fogDensityAt, v => (fogDensityAt = v)],
  // @ts-expect-error -- replaced on purpose
  fogGridAt: [() => fogGridAt, v => (fogGridAt = v)],
  // @ts-expect-error -- replaced on purpose
  fogGridBox: [() => fogGridBox, v => (fogGridBox = v)],
  // @ts-expect-error -- replaced on purpose
  fogGridBuild: [() => fogGridBuild, v => (fogGridBuild = v)],
  // @ts-expect-error -- replaced on purpose
  fogGridColumns: [() => fogGridColumns, v => (fogGridColumns = v)],
  // @ts-expect-error -- replaced on purpose
  fogGridFill: [() => fogGridFill, v => (fogGridFill = v)],
  // @ts-expect-error -- replaced on purpose
  fogGridInside: [() => fogGridInside, v => (fogGridInside = v)],
  // @ts-expect-error -- replaced on purpose
  fogGridMake: [() => fogGridMake, v => (fogGridMake = v)],
  // @ts-expect-error -- replaced on purpose
  fogGridOrigin: [() => fogGridOrigin, v => (fogGridOrigin = v)],
  // @ts-expect-error -- replaced on purpose
  fogGridRoll: [() => fogGridRoll, v => (fogGridRoll = v)],
  // @ts-expect-error -- replaced on purpose
  fogHash: [() => fogHash, v => (fogHash = v)],
  // @ts-expect-error -- replaced on purpose
  fogMarchOn: [() => fogMarchOn, v => (fogMarchOn = v)],
  // @ts-expect-error -- replaced on purpose
  fogNoise: [() => fogNoise, v => (fogNoise = v)],
  // @ts-expect-error -- replaced on purpose
  fogRayBox: [() => fogRayBox, v => (fogRayBox = v)],
  fogSmooth: [() => fogSmooth],
  ringIndex: [() => ringIndex],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const FOG_GRID_SIZES = { full: [48, 12, 48], phone: [32, 8, 32] };
export const FOG_GRID_BELOW = { full: 4, phone: 3 };
/* the ring round a column whose mean ground sets the fog's top: 8 samples about 6 m out, on whole metres so that on
   a grid of 1 m cells they fall on cell middles and the columns share them (fogGridColumns keeps each cell's height) */
export const FOG_RING = 6;
export const FOG_RING_AT = [
  [6, 0],
  [-6, 0],
  [0, 6],
  [0, -6],
  [4, 4],
  [4, -4],
  [-4, 4],
  [-4, -4],
];
/* the fog's layer over the smoothed ground (m): thin when calm, deep in fog weather */
export const FOG_LAYER = [0.5, 2];
/* how fast the density falls above the fog's top (per m), as fogit's mist */
export const FOG_FALL = 1.4;
/* the noise: its size (m), how much it takes away, how far it lifts and lowers the top (m) */
export const FOG_NOISE_M = 5;
export const FOG_NOISE_K = 0.45;
export const FOG_NOISE_TOP = 0.5;

/** @param {number} v */
export const fogClamp = v => (v < 0 ? 0 : v > 1 ? 1 : v);
/** @param {number} a @param {number} b @param {number} v */
export const fogSmooth = (a, b, v) => {
  const t = fogClamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/* a lattice point's value, 0-1 (an integer hash) */
/** @param {number} x @param {number} y @param {number} z */
export function fogHash(x, y, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** smooth value noise in 3D, 0-1 @param {number} x @param {number} y @param {number} z */
export function fogNoise(x, y, z) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  let fx = x - ix,
    fy = y - iy,
    fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const L = (/** @type {number} */ a, /** @type {number} */ b, /** @type {number} */ t) => a + (b - a) * t;
  const c = (/** @type {number} */ dx, /** @type {number} */ dy, /** @type {number} */ dz) =>
    fogHash(ix + dx, iy + dy, iz + dz);
  return L(
    L(L(c(0, 0, 0), c(1, 0, 0), fx), L(c(0, 1, 0), c(1, 1, 0), fx), fy),
    L(L(c(0, 0, 1), c(1, 0, 1), fx), L(c(0, 1, 1), c(1, 1, 1), fx), fy),
    fz
  );
}

/**
 * What the fog is made of this frame (walk/fog-grid.js builds it from the scene, the weather and the Air dials).
 * @typedef {object} FogInputs
 * @property {(x: number, z: number) => number} heightAt the visible ground (walk/heights.js groundHeightAt)
 * @property {number | null} water the water level, or null on a map without water
 * @property {number} mistH the mist's height over the water (Air: Mist height)
 * @property {number} mist the scene's mist (or the Low mist dial), 0-1
 * @property {number} fog the weather's fog with the dawn mist (environment.fog), 0-1
 * @property {[number, number] | null} valley a valley's mist: its level and amount, or null
 * @property {boolean} indoor indoors: no fog
 * @property {[number, number]} drift how far the noise has drifted with the wind (m)
 */

/**
 * How much fog there is overall (0-1); 0 means the grid can stay empty.
 * @param {FogInputs} F
 */
export function fogAmount(F) {
  if (F.indoor) return 0;
  return fogClamp(F.mist + F.fog * 0.85);
}

/**
 * A column's ground and its fog top before the noise (m): the mean ground on the ring round it, so a hollow fills to
 * about its rim and a hilltop's top lies below its ground.
 * @param {FogInputs} F @param {number} x @param {number} z @param {(x: number, z: number) => number} [h] the heights
 * @returns {[number, number]}
 */
export function fogColumn(F, x, z, h = F.heightAt) {
  let m = 0;
  for (const [dx, dz] of FOG_RING_AT) m += h(x + dx, z + dz);
  return [h(x, z), m / FOG_RING_AT.length];
}

/**
 * The fog's density at a point (0-1), given its column's ground and fog top (fogColumn).
 * @param {FogInputs} F @param {number} x @param {number} y @param {number} z @param {number} g @param {number} top0
 */
export function fogDensityAt(F, x, y, z, g, top0) {
  const A = fogAmount(F);
  const vk = F.valley && !F.indoor ? F.valley[1] : 0;
  if (A <= 0 && vk <= 0) return 0;
  const n = fogNoise((x + F.drift[0]) / FOG_NOISE_M, y / (FOG_NOISE_M * 0.6), (z + F.drift[1]) / FOG_NOISE_M);
  const layer = FOG_LAYER[0] + (FOG_LAYER[1] - FOG_LAYER[0]) * fogClamp(F.fog);
  let top = top0 + layer + (n - 0.5) * 2 * FOG_NOISE_TOP;
  if (F.water != null) top = Math.max(top, F.water + F.mistH + layer * 0.5);
  /* under the ground the cell takes the ground's density, so the texture's filtering doesn't darken the floor */
  const yy = Math.max(y, g);
  let d = A * (yy <= top ? 1 : Math.exp(-(yy - top) * FOG_FALL));
  if (vk > 0 && F.valley) d = Math.max(d, vk * 0.6 * fogSmooth(0, 1.4, F.valley[0] - yy));
  return fogClamp(d * (1 - FOG_NOISE_K + FOG_NOISE_K * n));
}

/**
 * A grid of fog cells round a point, as a ring buffer in x and z.
 * @typedef {object} FogGrid
 * @property {number} nx @property {number} ny @property {number} nz
 * @property {number} cell the cell's size (m)
 * @property {number} ox the first world cell in x (its column is ox * cell)
 * @property {number} oy the lowest world cell in y
 * @property {number} oz the first world cell in z
 * @property {Uint8Array} data the density, 0-255, at texel x + nx * (y + ny * z)
 * @property {Float32Array} ground each ring column's ground (m), at x + nx * z
 * @property {Float32Array} top each ring column's fog top before the noise (m)
 * @property {Map<number, number>} hc the heights read, by cell middle (fogGridColumns)
 * @property {number} cols columns measured since made
 * @property {number} reads heights read since made
 * @property {number} cells cells filled since made
 */

/**
 * @param {number} nx @param {number} ny @param {number} nz @param {number} [cell]
 * @returns {FogGrid}
 */
export function fogGridMake(nx, ny, nz, cell = 1) {
  return {
    nx,
    ny,
    nz,
    cell,
    ox: 0,
    oy: 0,
    oz: 0,
    data: new Uint8Array(nx * ny * nz),
    ground: new Float32Array(nx * nz),
    top: new Float32Array(nx * nz),
    hc: new Map(),
    cols: 0,
    reads: 0,
    cells: 0,
  };
}

/** a world cell's ring index (x or z) @param {number} i @param {number} n */
export const ringIndex = (i, n) => ((i % n) + n) % n;

/**
 * The origin that puts a point in the grid's middle (x, z) and the ground under it FOG_GRID_BELOW cells up.
 * @param {FogGrid} G @param {number} x @param {number} z @param {number} ground @param {number} below
 * @returns {[number, number, number]}
 */
export function fogGridOrigin(G, x, z, ground, below) {
  return [
    Math.floor(x / G.cell) - (G.nx >> 1),
    Math.floor(ground / G.cell) - below,
    Math.floor(z / G.cell) - (G.nz >> 1),
  ];
}

/**
 * Measure the columns of world x cells [ix0, ix1) and z cells [iz0, iz1) (heights only).
 * @param {FogGrid} G @param {FogInputs} F @param {number} ix0 @param {number} ix1 @param {number} iz0 @param {number} iz1
 */
export function fogGridColumns(G, F, ix0, ix1, iz0, iz1) {
  const c = G.cell,
    H = G.hc;
  /* the kept heights: more than the grid and its ring hold, and the oldest go */
  const most = (G.nx + 16) * (G.nz + 16) * 2;
  if (H.size > most) for (const k of [...H.keys()].slice(0, H.size - (most >> 1))) H.delete(k);
  /** @param {number} x @param {number} z */
  const h = (x, z) => {
    const k = Math.round(x * 2) * 1048576 + Math.round(z * 2);
    let v = H.get(k);
    if (v === undefined) {
      v = F.heightAt(x, z);
      H.set(k, v);
      G.reads++;
    }
    return v;
  };
  for (let iz = iz0; iz < iz1; iz++)
    for (let ix = ix0; ix < ix1; ix++) {
      const k = ringIndex(ix, G.nx) + G.nx * ringIndex(iz, G.nz),
        [g, t] = fogColumn(F, (ix + 0.5) * c, (iz + 0.5) * c, h);
      G.ground[k] = g;
      G.top[k] = t;
      G.cols++;
    }
}

/**
 * Fill the density of world x cells [ix0, ix1) and z cells [iz0, iz1), every height (columns measured before).
 * @param {FogGrid} G @param {FogInputs} F @param {number} ix0 @param {number} ix1 @param {number} iz0 @param {number} iz1
 */
export function fogGridFill(G, F, ix0, ix1, iz0, iz1) {
  const c = G.cell,
    { nx, ny, nz, data } = G,
    empty = fogAmount(F) <= 0 && !(F.valley && F.valley[1] > 0 && !F.indoor);
  for (let iz = iz0; iz < iz1; iz++) {
    const tz = ringIndex(iz, nz),
      z = (iz + 0.5) * c;
    for (let ix = ix0; ix < ix1; ix++) {
      const tx = ringIndex(ix, nx),
        k = tx + nx * tz,
        x = (ix + 0.5) * c,
        g = G.ground[k],
        t = G.top[k];
      for (let iy = 0; iy < ny; iy++)
        data[tx + nx * (iy + ny * tz)] = empty
          ? 0
          : Math.round(fogDensityAt(F, x, (G.oy + iy + 0.5) * c, z, g, t) * 255);
    }
  }
  G.cells += (ix1 - ix0) * (iz1 - iz0) * ny;
}

/**
 * Build the whole grid round an origin (columns and density).
 * @param {FogGrid} G @param {FogInputs} F @param {[number, number, number]} o
 */
export function fogGridBuild(G, F, o) {
  [G.ox, G.oy, G.oz] = o;
  fogGridColumns(G, F, G.ox, G.ox + G.nx, G.oz, G.oz + G.nz);
  fogGridFill(G, F, G.ox, G.ox + G.nx, G.oz, G.oz + G.nz);
}

/**
 * Move the grid to a new x/z origin (same height), refilling only the slabs that came in. Returns the slabs as
 * [axis, world cell] pairs ('x': a slab of constant x, 'z': of constant z); null when the move is too far for slabs
 * (then the caller builds the grid anew).
 * @param {FogGrid} G @param {FogInputs} F @param {number} ox @param {number} oz @param {number} [most]
 * @returns {Array<['x' | 'z', number]> | null}
 */
export function fogGridRoll(G, F, ox, oz, most = 4) {
  const dx = ox - G.ox,
    dz = oz - G.oz;
  if (Math.abs(dx) > most || Math.abs(dz) > most) return null;
  /** @type {Array<['x' | 'z', number]>} */
  const out = [];
  /* x first, on the old z range; then z, on the new x range (so a diagonal step fills every new cell once) */
  if (dx) {
    const a = dx > 0 ? G.ox + G.nx : ox,
      b = dx > 0 ? ox + G.nx : G.ox;
    G.ox = ox;
    fogGridColumns(G, F, a, b, G.oz, G.oz + G.nz);
    fogGridFill(G, F, a, b, G.oz, G.oz + G.nz);
    for (let i = a; i < b; i++) out.push(['x', i]);
  }
  if (dz) {
    const a = dz > 0 ? G.oz + G.nz : oz,
      b = dz > 0 ? oz + G.nz : G.oz;
    G.oz = oz;
    fogGridColumns(G, F, G.ox, G.ox + G.nx, a, b);
    fogGridFill(G, F, G.ox, G.ox + G.nx, a, b);
    for (let i = a; i < b; i++) out.push(['z', i]);
  }
  return out;
}

/**
 * The density at a world point read from the grid (nearest cell; 0 outside it), as the texture holds it.
 * @param {FogGrid} G @param {number} x @param {number} y @param {number} z
 */
export function fogGridAt(G, x, y, z) {
  const ix = Math.floor(x / G.cell),
    iy = Math.floor(y / G.cell) - G.oy,
    iz = Math.floor(z / G.cell);
  if (ix < G.ox || ix >= G.ox + G.nx || iz < G.oz || iz >= G.oz + G.nz || iy < 0 || iy >= G.ny) return 0;
  return G.data[ringIndex(ix, G.nx) + G.nx * (iy + G.ny * ringIndex(iz, G.nz))] / 255;
}

/* ---------- AIR-3: what the light-in-air march needs from the grid ---------- */
/* the march's steps when it reads the grid (desktop, phone); without the grid it keeps its 14 */
export const FOG_MARCH_STEPS = { full: 14, phone: 10 };
/* the grid's edge: the march's fog fades out and fogit's mist fades in between these fractions of its half size, so
   the fog has no seam where the grid ends */
export const FOG_EDGE = [0.7, 0.95];

/**
 * Whether the march reads the grid this frame: a grid, not a battle (the grid stays where you walked), below quality
 * step 3 (the ladder drops the march there) and the Fog in the air dial up. Not gated on the light shafts' dials or a
 * shadow map: the fog must not vanish with them. When it is off, fogit's low mist works as before.
 * @param {{ grid: boolean, battle: boolean, qe: number, k: number }} s
 */
export function fogMarchOn(s) {
  return !!s.grid && !s.battle && s.qe < 3 && s.k > 0.01;
}

/**
 * The grid's box in the world (m), its square's middle and half size.
 * @param {FogGrid} G
 */
export function fogGridBox(G) {
  const c = G.cell;
  return {
    x0: G.ox * c,
    y0: G.oy * c,
    z0: G.oz * c,
    x1: (G.ox + G.nx) * c,
    y1: (G.oy + G.ny) * c,
    z1: (G.oz + G.nz) * c,
    cx: (G.ox + G.nx / 2) * c,
    cz: (G.oz + G.nz / 2) * c,
    r: (Math.min(G.nx, G.nz) * c) / 2,
  };
}

/**
 * How much of the low fog the grid holds at (x, z), 1 well inside, 0 past its edge (FOG_EDGE); fogit's mist takes
 * 1 minus this. JS twin of the march's and fogit's GLSL.
 * @param {{ cx: number, cz: number, r: number }} B fogGridBox @param {number} x @param {number} z
 */
export function fogGridInside(B, x, z) {
  const d = Math.max(Math.abs(x - B.cx), Math.abs(z - B.cz));
  return 1 - fogSmooth(B.r * FOG_EDGE[0], B.r * FOG_EDGE[1], d);
}

/**
 * Where a ray from e along unit direction v runs inside the box, clipped to [0, L]; null when it misses. JS twin of
 * the march's GLSL (engine/post-effects.js).
 * @param {{ x0: number, y0: number, z0: number, x1: number, y1: number, z1: number }} B
 * @param {number[]} e @param {number[]} v @param {number} L
 * @returns {[number, number] | null}
 */
export function fogRayBox(B, e, v, L) {
  const lo = [B.x0, B.y0, B.z0],
    hi = [B.x1, B.y1, B.z1];
  let a = 0,
    b = L;
  for (let i = 0; i < 3; i++) {
    const iv = 1 / (Math.abs(v[i]) < 1e-6 ? (v[i] < 0 ? -1e-6 : 1e-6) : v[i]),
      t0 = (lo[i] - e[i]) * iv,
      t1 = (hi[i] - e[i]) * iv;
    a = Math.max(a, Math.min(t0, t1));
    b = Math.min(b, Math.max(t0, t1));
  }
  return a < b ? [a, b] : null;
}

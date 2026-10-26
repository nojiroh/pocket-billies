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
  FOG_FALL: [() => FOG_FALL],
  FOG_GRID_BELOW: [() => FOG_GRID_BELOW],
  FOG_GRID_SIZES: [() => FOG_GRID_SIZES],
  FOG_LAYER: [() => FOG_LAYER],
  FOG_NOISE_K: [() => FOG_NOISE_K],
  FOG_NOISE_M: [() => FOG_NOISE_M],
  FOG_NOISE_TOP: [() => FOG_NOISE_TOP],
  FOG_RING: [() => FOG_RING],
  FOG_RING_N: [() => FOG_RING_N],
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
  fogGridBuild: [() => fogGridBuild, v => (fogGridBuild = v)],
  // @ts-expect-error -- replaced on purpose
  fogGridColumns: [() => fogGridColumns, v => (fogGridColumns = v)],
  // @ts-expect-error -- replaced on purpose
  fogGridFill: [() => fogGridFill, v => (fogGridFill = v)],
  // @ts-expect-error -- replaced on purpose
  fogGridMake: [() => fogGridMake, v => (fogGridMake = v)],
  // @ts-expect-error -- replaced on purpose
  fogGridOrigin: [() => fogGridOrigin, v => (fogGridOrigin = v)],
  // @ts-expect-error -- replaced on purpose
  fogGridRoll: [() => fogGridRoll, v => (fogGridRoll = v)],
  // @ts-expect-error -- replaced on purpose
  fogHash: [() => fogHash, v => (fogHash = v)],
  // @ts-expect-error -- replaced on purpose
  fogNoise: [() => fogNoise, v => (fogNoise = v)],
  fogSmooth: [() => fogSmooth],
  ringIndex: [() => ringIndex],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const FOG_GRID_SIZES = { full: [48, 12, 48], phone: [32, 8, 32] };
export const FOG_GRID_BELOW = { full: 4, phone: 3 };
/* the ring round a column whose mean ground sets the fog's top (m), and how many samples on it */
export const FOG_RING = 6;
export const FOG_RING_N = 8;
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
 * A column's ground and its fog top before the noise (m).
 * @param {FogInputs} F @param {number} x @param {number} z
 * @returns {[number, number]}
 */
export function fogColumn(F, x, z) {
  const g = F.heightAt(x, z);
  let m = 0;
  for (let i = 0; i < FOG_RING_N; i++) {
    const a = (i / FOG_RING_N) * Math.PI * 2;
    m += F.heightAt(x + Math.cos(a) * FOG_RING, z + Math.sin(a) * FOG_RING);
  }
  m /= FOG_RING_N;
  /* the ground's mean round the column, but never above the ground and its ring's highest pull: a hollow fills to
     about its rim, a slope or a hilltop gets the thin layer at most */
  const top = Math.min(m, g + FOG_RING);
  return [g, top];
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
 * @property {number} cols columns measured (heights read) since made
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
    cols: 0,
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
  const c = G.cell;
  for (let iz = iz0; iz < iz1; iz++)
    for (let ix = ix0; ix < ix1; ix++) {
      const k = ringIndex(ix, G.nx) + G.nx * ringIndex(iz, G.nz),
        [g, t] = fogColumn(F, (ix + 0.5) * c, (iz + 0.5) * c);
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

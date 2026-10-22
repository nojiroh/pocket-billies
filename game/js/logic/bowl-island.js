// @ts-check
'use strict';
/* ================= THE HUB'S ISLAND ON THE BOWL (island track IS-7) =================
   The hub's world map draws the real island: its coast (island.coast) as the outline, its ground, its hills and
   mountain, and its town close in. Which map that is, by its fields: the place's own map when it has a coast (since
   IS-5 the hub's, copperleaf); else, for the hub (world node 0), the biggest map with a coast and building plots
   (test_island has no plots). Its buildings: the
   map's own building props, and on every plot no building stands on yet a model of the plot's kind.
   Logic only: no DOM, runs in Node; world-bowl.js draws with it. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  BOWL_ISLAND_CELL: [() => BOWL_ISLAND_CELL],
  BOWL_ISLAND_HEIGHTS: [() => BOWL_ISLAND_HEIGHTS],
  BOWL_PLOT_PROPS: [() => BOWL_PLOT_PROPS],
  // @ts-expect-error -- replaced on purpose
  bowlBase64: [() => bowlBase64, v => (bowlBase64 = v)],
  // @ts-expect-error -- replaced on purpose
  bowlCoastArea: [() => bowlCoastArea, v => (bowlCoastArea = v)],
  bowlHasCoast: [() => bowlHasCoast],
  // @ts-expect-error -- replaced on purpose
  bowlIslandHeights: [() => bowlIslandHeights, v => (bowlIslandHeights = v)],
  // @ts-expect-error -- replaced on purpose
  bowlIslandMapId: [() => bowlIslandMapId, v => (bowlIslandMapId = v)],
  // @ts-expect-error -- replaced on purpose
  bowlIslandPlotThings: [() => bowlIslandPlotThings, v => (bowlIslandPlotThings = v)],
  // @ts-expect-error -- replaced on purpose
  bowlIslandRadius: [() => bowlIslandRadius, v => (bowlIslandRadius = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @import { LocationData } from '../../types/game-data' */

/** an island map: a coast of 3 points or more @param {any} M */
export const bowlHasCoast = M => !!(M && M.island && Array.isArray(M.island.coast) && M.island.coast.length >= 3);

/** a polygon's area ([x, z] points) @param {number[][]} C */
export function bowlCoastArea(C) {
  let a = 0;
  for (let k = 0, q = C.length - 1; k < C.length; q = k++) a += (C[q][0] + C[k][0]) * (C[k][1] - C[q][1]);
  return Math.abs(a) / 2;
}

/** the map the bowl draws for place i: its own, or for the hub (world node 0) whose own map has no coast, the biggest
 * map with a coast and plots. By fields, never by id. @param {LocationData[]} places @param {number} i
 * @param {Record<string, any>} maps @returns {string | null} */
export function bowlIslandMapId(places, i, maps) {
  const own = (places[i] && places[i].mapId) || null;
  if (i !== 0 || !maps || bowlHasCoast(own && maps[own])) return own;
  let best = own,
    area = 0;
  for (const id of Object.keys(maps).sort()) {
    const M = maps[id];
    if (!bowlHasCoast(M) || !(Array.isArray(M.plots) && M.plots.length)) continue;
    const a = bowlCoastArea(M.island.coast);
    if (a > area) {
      area = a;
      best = id;
    }
  }
  return best;
}

/** how far the coast reaches from the island's middle (island.c, else the map's middle), in metres @param {any} M */
export function bowlIslandRadius(M) {
  if (!bowlHasCoast(M)) return 0;
  const [cx, cz] = (M.island.c && M.island.c.length === 2 && M.island.c) || [M.w / 2, M.h / 2];
  return Math.max(...M.island.coast.map((/** @type {number[]} */ [x, z]) => Math.hypot(x - cx, z - cz)));
}

/** base64 to bytes (a map's steps and step flags) @param {string} s */
export function bowlBase64(s) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
    n = s.replace(/=+$/, '').length,
    out = new Uint8Array(Math.floor((n * 3) / 4));
  let o = 0;
  for (let i = 0; i < n; i += 4) {
    const v =
      (A.indexOf(s[i]) << 18) |
      (A.indexOf(s[i + 1]) << 12) |
      (Math.max(0, A.indexOf(s[i + 2] || 'A')) << 6) |
      Math.max(0, A.indexOf(s[i + 3] || 'A'));
    out[o++] = (v >> 16) & 255;
    if (o < out.length) out[o++] = (v >> 8) & 255;
    if (o < out.length) out[o++] = v & 255;
  }
  return out;
}

/** the ground's height raster: one value every BOWL_ISLAND_CELL metres, the mean of the smooth land (heights) plus
 * the step raises (steps, a twentieth of a metre a unit, as walk-view.js stepGrid reads them) over the cell */
export const BOWL_ISLAND_CELL = 2;
/** @type {WeakMap<object, { key: string, f: (mx: number, mz: number) => number }>} */
export const BOWL_ISLAND_HEIGHTS = new WeakMap();
/** a map's ground height in metres at a point (mx east, mz north from its south-west corner); null while the map has
 * no heights (a lite map, before its file is in). Read every BOWL_ISLAND_CELL metres and smoothed between.
 * @param {any} M @returns {((mx: number, mz: number) => number) | null} */
export function bowlIslandHeights(M) {
  if (!M || !Array.isArray(M.heights) || !M.heights.length) return null;
  const key = `${M.w}x${M.h}:${(M.steps || '').length}:${M.heights.length}`,
    had = BOWL_ISLAND_HEIGHTS.get(M);
  if (had && had.key === key) return had.f;
  const w = M.w,
    h = M.h,
    corner = (/** @type {number} */ x, /** @type {number} */ z) =>
      +((M.heights[h - Math.min(h, Math.max(0, z))] || [])[Math.min(w, Math.max(0, x))] || 0),
    w2 = w * 2;
  let S = /** @type {Int16Array | null} */ (null);
  if (typeof M.steps === 'string' && M.steps) {
    const u = bowlBase64(M.steps);
    S = new Int16Array(u.buffer, 0, u.length >> 1);
    if (S.length !== 4 * w * h) S = null;
  }
  const C = BOWL_ISLAND_CELL,
    gw = Math.ceil(w / C),
    gh = Math.ceil(h / C),
    R = new Float32Array(gw * gh);
  for (let J = 0; J < gh; J++)
    for (let I = 0; I < gw; I++) {
      let sum = 0,
        cnt = 0;
      for (let z = J * C; z < Math.min(h, (J + 1) * C); z += 0.5)
        for (let x = I * C; x < Math.min(w, (I + 1) * C); x += 0.5) {
          const i = Math.floor(x),
            j = Math.floor(z),
            u = x + 0.25 - i,
            v = z + 0.25 - j,
            base =
              corner(i, j) * (1 - u) * (1 - v) +
              corner(i + 1, j) * u * (1 - v) +
              corner(i, j + 1) * (1 - u) * v +
              corner(i + 1, j + 1) * u * v;
          sum += base + (S ? S[Math.floor(z * 2) * w2 + Math.floor(x * 2)] / 20 : 0);
          cnt++;
        }
      R[J * gw + I] = cnt ? sum / cnt : 0;
    }
  const at = (/** @type {number} */ I, /** @type {number} */ J) =>
    R[Math.min(gh - 1, Math.max(0, J)) * gw + Math.min(gw - 1, Math.max(0, I))];
  /** @param {number} mx @param {number} mz */
  const f = (mx, mz) => {
    if (!(mx >= 0 && mz >= 0 && mx <= w && mz <= h)) return 0;
    const fx = mx / C - 0.5,
      fz = mz / C - 0.5,
      I = Math.floor(fx),
      J = Math.floor(fz),
      u = fx - I,
      v = fz - J;
    return (
      at(I, J) * (1 - u) * (1 - v) + at(I + 1, J) * u * (1 - v) + at(I, J + 1) * (1 - u) * v + at(I + 1, J + 1) * u * v
    );
  };
  BOWL_ISLAND_HEIGHTS.set(M, { key, f });
  return f;
}

/** the model each plot kind gets on the bowl until a building stands on it (props with a low-poly model; a house
 * picks one of its list by where it is) */
export const BOWL_PLOT_PROPS = {
  house: ['cottage_moss', 'cottage_solar', 'house_cottage'],
  home: ['cottage_juniper'],
  lab: ['lab'],
  mast: ['airship_station'],
  shop: ['shop'],
  well: ['well'],
  farmhouse: ['house_cottage'],
  barn: ['barn'],
};
/** @typedef {{ k: string, x: number, z: number, turn: number }} BowlPlotThing */
/** the buildings the bowl adds to an island map: one on every plot no building prop stands on yet, and the barn in the
 * barn zone when there is none. x, z in the map's metres; turn in degrees counter-clockwise (0: the model's front to
 * the south, as a prop stands). isBuilding says whether a prop is a building (bowl-things.js bowlPropClass); the
 * models are drawn whatever their class (a well, an airship station).
 * @param {any} M @param {(p: { k: string }) => boolean} isBuilding @returns {BowlPlotThing[]} */
export function bowlIslandPlotThings(M, isBuilding) {
  if (!M || !bowlHasCoast(M)) return [];
  /* what already stands: buildings, and any prop of a plot's own kinds (a well or an airship station is no building) */
  const own = new Set(Object.values(BOWL_PLOT_PROPS).flat()),
    built = (M.props || [])
      .filter((/** @type {any} */ p) => own.has(p.k) || isBuilding(p))
      .map((/** @type {any} */ p) => [p.x, p.z, p.k]),
    near = (/** @type {number} */ x, /** @type {number} */ z, /** @type {number} */ r, /** @type {RegExp} */ re) =>
      built.some(([bx, bz, k]) => Math.hypot(bx - x, bz - z) <= r && (!re || re.test(k))),
    pick = (/** @type {string[]} */ L, /** @type {number} */ x, /** @type {number} */ z) =>
      L[Math.floor((Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1) * L.length) % L.length],
    /** @type {BowlPlotThing[]} */ out = [];
  for (const p of M.plots || []) {
    const L = /** @type {Record<string, string[]>} */ (BOWL_PLOT_PROPS)[p.k];
    if (!L || near(p.x, p.z, Math.max(p.w || 0, p.d || 0) / 2 + 1, /./)) continue;
    /* a plot's a: the way its front faces (degrees, 0 east, 90 north); a prop's front faces south (-90) */
    out.push({ k: pick(L, p.x, p.z), x: p.x, z: p.z, turn: (p.a || 0) + 90 });
  }
  const barn = (M.zones || []).find((/** @type {any} */ z) => z.k === 'barn' && Array.isArray(z.poly) && z.poly.length);
  if (barn) {
    const n = barn.poly.length,
      x = barn.poly.reduce((/** @type {number} */ a, /** @type {number[]} */ q) => a + q[0], 0) / n,
      z = barn.poly.reduce((/** @type {number} */ a, /** @type {number[]} */ q) => a + q[1], 0) / n,
      [cx, cz] = (M.island.c && M.island.c.length === 2 && M.island.c) || [M.w / 2, M.h / 2];
    /* its front to the sea, away from the island's middle */
    if (!near(x, z, 20, /barn/)) out.push({ k: 'barn', x, z, turn: (Math.atan2(z - cz, x - cx) * 180) / Math.PI + 90 });
  }
  return out;
}

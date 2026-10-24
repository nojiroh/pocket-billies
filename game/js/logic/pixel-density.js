// @ts-check
'use strict';
/* ================= PIXEL DENSITY (Studio plan Phase 5, T5.7: measure before changing anything) =================
   How many of a Billie's pixels go into a metre, path by path, against the grids it stands among: the world's art
   grid (68 px a metre, the props' pixels), the ground (32 px a metre), and for a kit Billie how much each part was
   scaled against its torso when it was baked (a part scaled more or less than its body shows its pixels at another
   density). world-billies.js sizes a Billie in the world with densityWorldMpp. Nothing here changes the art: the owner
   sets a target density first (an art direction call).
   Logic only: no DOM, runs in Node. */
/* to-module: start */
/* to-module: end */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { formSpeciesId } from './forms.js';
/* eslint-disable no-func-assign */
expose({
  DENSITY: [() => DENSITY],
  // @ts-expect-error -- replaced on purpose
  densityHeights: [() => densityHeights, v => (densityHeights = v)],
  // @ts-expect-error -- replaced on purpose
  densityKitParts: [() => densityKitParts, v => (densityKitParts = v)],
  // @ts-expect-error -- replaced on purpose
  densityReport: [() => densityReport, v => (densityReport = v)],
  // @ts-expect-error -- replaced on purpose
  densityWorld: [() => densityWorld, v => (densityWorld = v)],
  // @ts-expect-error -- replaced on purpose
  densityWorldMpp: [() => densityWorldMpp, v => (densityWorldMpp = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the grids a Billie stands among, in pixels a metre, and how far a part may differ from its body before it is flagged */
export const DENSITY = Object.freeze({ artGrid: 68, ground: 32, spread: 0.25 });

/**
 * Metres per rig pixel in the world (world-billies.js): a Billie stands about 0.9 of its listed height (0.6 to 2 m,
 * times `big`), measured from its geo top to the ground line; v34: sized so one art pixel (1/68 m) holds a whole
 * number of quarter rig pixels when that is within 6% of the height it would otherwise have.
 * @param {number | undefined} ht the species' listed height (m) @param {{ base: number, top: number }} geo
 * @param {number} BH the rig's box height @param {number} [big]
 */
export function densityWorldMpp(ht, geo, BH, big = 1) {
  const h = Math.max(0.6, Math.min(2, (ht || 1) * 0.9)) * big,
    px = Math.max(20, geo.base - geo.top || BH * 0.7),
    m = h / px;
  const r = 1 / (m * 68),
    rq = r >= 1 ? Math.round(r * 4) / 4 : 1 / (Math.round(4 / r) / 4),
    mq = 1 / (rq * 68);
  return Math.abs(mq / m - 1) <= 0.06 ? mq : m;
}

/**
 * One species in the world: rig pixels a metre, rig pixels per art pixel (68 a metre) and per ground pixel (32), and
 * how they sit on the art grid: 'whole' (a whole number of rig pixels per art pixel), 'quarter' (v34's quarters),
 * 'off grid' (neither: the 6% rule let the height win).
 * @param {number | undefined} ht @param {{ base: number, top: number }} geo @param {number} BH
 */
export function densityWorld(ht, geo, BH) {
  const mpp = densityWorldMpp(ht, geo, BH),
    perArt = 1 / (mpp * DENSITY.artGrid),
    /* the game snaps r >= 1 to quarters of r, r < 1 to quarters of 1 / r */
    steps = perArt >= 1 ? perArt : 1 / perArt,
    on = (/** @type {number} */ v) => Math.abs(v - Math.round(v)) < 1e-6,
    grid = on(steps) ? 'whole' : on(steps * 4) ? 'quarter' : 'off grid';
  return {
    pxPerM: +(1 / mpp).toFixed(2),
    perArtPx: +perArt.toFixed(3),
    perGroundPx: +(1 / (mpp * DENSITY.ground)).toFixed(3),
    grid,
  };
}

/**
 * A kit Billie's parts against its torso: each bone kind's and extra's scale when baked (its size times the form's
 * stage scale) and that against the torso's; `flag` when it differs by more than DENSITY.spread.
 * @param {{ scale: number, parts: Record<string, [string, number, unknown]>, extras?: any[][] }} form
 */
export function densityKitParts(form) {
  const torso = form.parts.torso ? form.parts.torso[1] : 1,
    row = (/** @type {string} */ what, /** @type {string} */ part, /** @type {number} */ size) => {
      const vs = size / torso;
      return {
        what,
        part,
        scale: +(size * form.scale).toFixed(3),
        vsBody: +vs.toFixed(3),
        flag: Math.abs(vs - 1) > DENSITY.spread,
      };
    };
  return [
    ...Object.entries(form.parts).map(([kind, [pid, size]]) => row(kind, pid, size)),
    ...(form.extras || []).map(([pid, anchor, size]) => row(`extra (${anchor})`, pid, size)),
  ];
}

/** each species' listed height by its id (line + stage, then each regional form's stages), as game-data.js gives it:
 * the line's `ht` at its stage (the last one when the list is shorter), else 1 (a form keeps its base stage's height)
 * @param {any[]} lines @returns {Record<string, { ht: number }>} */
export function densityHeights(lines) {
  /** @type {Record<string, { ht: number }>} */
  const out = {};
  for (const L of lines || [])
    (L.names || []).forEach((/** @type {string} */ _, /** @type {number} */ i) => {
      const a = L.ht;
      const ht = { ht: Array.isArray(a) && a.length ? a[Math.min(i, a.length - 1)] : 1 };
      out[L.id + i] = ht;
      for (const F of L.forms || []) out[formSpeciesId(L.id, F.id, i)] = { ...ht };
    });
  return out;
}
/**
 * The report: one row per species with a rig (its world numbers; a kit Billie's parts too), and the scalings every
 * Billie gets that are not whole numbers (rules.json part sizes S and L, drawn nearest-neighbour).
 * @param {any} D the game data (lines, kitBuilds, rules) @param {Record<string, any>} rigs
 * @param {Record<string, { ht?: number }>} species by id (the game's SPECIES: line + stage)
 */
export function densityReport(D, rigs, species) {
  const kit = new Map((D.kitBuilds?.forms || []).map((/** @type {any} */ f) => [f.rig, f])),
    rows = [];
  for (const [sp, R] of Object.entries(rigs || {})) {
    const M = R && R.front;
    if (!M || !M.geo || !species[sp]) continue;
    const f = kit.get(sp),
      parts = f ? densityKitParts(f) : [];
    rows.push({
      sp,
      ...densityWorld(species[sp].ht, M.geo, M.BH),
      kit: f ? f.name : '',
      fit: f ? f.scale : null,
      parts,
      flagged: parts.filter(p => p.flag).length,
    });
  }
  const sizes = Object.entries(D.rules?.parts?.sizes || {})
    .filter(([, s]) => !Number.isInteger(/** @type {any} */ (s).scale))
    .map(([k, s]) => `${k} ${/** @type {any} */ (s).scale}`);
  return { rows, nonInteger: sizes, grids: DENSITY };
}

// @ts-check
'use strict';
/* ================= THE BOWL (phase 10) =================
   The world map is the lower half of the Hollow Earth: a bowl seen from above, the Inner Sun hanging over its centre.
   A place's spot (locations.json "bowl") is { a, r }: a in degrees counter-clockwise from east seen from above, r from
   0 at the centre of the floor to 1 at the rim. A place reached only by lift sits under another: { under: id }.
   The walkable maps keep their own compass. On the bowl each map turns with the curve: its north faces the centre and
   its east runs counter-clockwise, so the seams between maps line up all the way round (docs/phases/10-world-map-bowl.md).
   Shape (owner, 2026-10-19: only curves inside): a part of a sphere, lowest at the centre and curving up to 45 degrees
   at the rim, where the land ends against the sky (no flat floor, no land beyond the rim).
   Logic only: no DOM, runs in Node. The renderer, the Studio and the tests read the same numbers. */
/** @import { BowlSpot, LocationData } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  BOWL_GROUND_CELLS: [() => BOWL_GROUND_CELLS],
  BOWL_GROUND_EXTENT: [() => BOWL_GROUND_EXTENT],
  BOWL_RELIEF_DEFAULT: [() => BOWL_RELIEF_DEFAULT],
  BOWL_RELIEF_KINDS: [() => BOWL_RELIEF_KINDS],
  BOWL_RELIEF_MAX: [() => BOWL_RELIEF_MAX],
  BOWL_RIM_HEIGHT: [() => BOWL_RIM_HEIGHT],
  BOWL_SPHERE: [() => BOWL_SPHERE],
  EXIT: [() => EXIT],
  // @ts-expect-error -- replaced on purpose
  bowlBaseHeight: [() => bowlBaseHeight, v => (bowlBaseHeight = v)],
  // @ts-expect-error -- replaced on purpose
  bowlCompass: [() => bowlCompass, v => (bowlCompass = v)],
  // @ts-expect-error -- replaced on purpose
  bowlExitSide: [() => bowlExitSide, v => (bowlExitSide = v)],
  // @ts-expect-error -- replaced on purpose
  bowlGridHeight: [() => bowlGridHeight, v => (bowlGridHeight = v)],
  // @ts-expect-error -- replaced on purpose
  bowlGround: [() => bowlGround, v => (bowlGround = v)],
  // @ts-expect-error -- replaced on purpose
  bowlGroundGrid: [() => bowlGroundGrid, v => (bowlGroundGrid = v)],
  // @ts-expect-error -- replaced on purpose
  bowlHeight: [() => bowlHeight, v => (bowlHeight = v)],
  // @ts-expect-error -- replaced on purpose
  bowlRelief: [() => bowlRelief, v => (bowlRelief = v)],
  // @ts-expect-error -- replaced on purpose
  bowlReliefFeatures: [() => bowlReliefFeatures, v => (bowlReliefFeatures = v)],
  // @ts-expect-error -- replaced on purpose
  bowlRoad: [() => bowlRoad, v => (bowlRoad = v)],
  // @ts-expect-error -- replaced on purpose
  bowlRoll: [() => bowlRoll, v => (bowlRoll = v)],
  // @ts-expect-error -- replaced on purpose
  bowlSeamTurn: [() => bowlSeamTurn, v => (bowlSeamTurn = v)],
  // @ts-expect-error -- replaced on purpose
  bowlSpotOf: [() => bowlSpotOf, v => (bowlSpotOf = v)],
  // @ts-expect-error -- replaced on purpose
  bowlXY: [() => bowlXY, v => (bowlXY = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the flat floor's radius, as a share of the bowl's */
/** the sphere the bowl is part of: its radius, in bowl radii (the slope reaches 45 degrees at the rim) */
export const BOWL_SPHERE = Math.SQRT2;
/** the rim's height above the bowl's lowest point, as a share of its radius */
export const BOWL_RIM_HEIGHT = BOWL_SPHERE - 1;

/** the ground's height at r (0 centre to 1 rim): a curve all the way, no flat part @param {number} r
 * @returns {number} */
export function bowlHeight(r) {
  const k = Math.min(1, Math.abs(r));
  return BOWL_SPHERE - Math.sqrt(BOWL_SPHERE * BOWL_SPHERE - k * k);
}

/** a spot's place seen from above, x east and y north of the bowl @param {number} a @param {number} r
 * @returns {[number, number]} */
export function bowlXY(a, r) {
  const w = (a * Math.PI) / 180;
  return [r * Math.cos(w), r * Math.sin(w)];
}

/** a place's spot, following "under" to the place it hangs below (and how many levels it went down)
 * @param {LocationData} place @param {(id: string) => LocationData | undefined} byId
 * @returns {{ a: number, r: number, under: number }} */
export function bowlSpotOf(place, byId) {
  /** @type {BowlSpot} */
  let s = place.bowl,
    under = 0;
  while ('under' in s) {
    const p = byId(s.under);
    if (!p || ++under > 4) throw new Error(`${place.id}: its bowl spot hangs under ${s.under}, which has none`);
    s = p.bowl;
  }
  return { a: s.a, r: s.r, under };
}

/** a point on the ground: [x east, y north, h up] @param {number} x @param {number} y
 * @returns {[number, number, number]} */
export function bowlGround(x, y) {
  return [x, y, bowlHeight(Math.hypot(x, y))];
}

/** a map's compass where it sits on the bowl: its north faces the centre, its east runs counter-clockwise. Unit
 * vectors seen from above. At the very centre north is the bowl's north. @param {number} x @param {number} y
 * @returns {{ north: [number, number], east: [number, number] }} */
export function bowlCompass(x, y) {
  const r = Math.hypot(x, y);
  /** @type {[number, number]} */
  const north = r < 1e-6 ? [0, 1] : [-x / r, -y / r];
  return { north, east: [north[1], -north[0]] };
}

/** @type {Record<string, [number, number]>} */
export const EXIT = { east: [1, 0], west: [-1, 0], north: [0, 1], south: [0, -1] };
/** a map exit's side, without its number ('south2' is on the south side) @param {string} exit
 * @returns {[number, number]} */
export function bowlExitSide(exit) {
  const v = EXIT[exit.replace(/\d+$/, '')];
  if (!v) throw new Error(`no such map side: ${exit}`);
  return v;
}

/** how far, in degrees, a seam on the bowl turns from its two exits: 0 when the road leaves A the way A's exit
 * faces and reaches B the way B's exit faces back. The compass is taken at the road's midpoint.
 * @param {[number, number]} A @param {[number, number]} B @param {string} exitA @param {string} exitB
 * @returns {number} */
export function bowlSeamTurn(A, B, exitA, exitB) {
  const sa = bowlExitSide(exitA),
    sb = bowlExitSide(exitB);
  let dx = sa[0] - sb[0],
    dy = sa[1] - sb[1];
  const n = Math.hypot(dx, dy) || 1;
  dx /= n;
  dy /= n;
  const { north, east } = bowlCompass((A[0] + B[0]) / 2, (A[1] + B[1]) / 2),
    want = [dx * east[0] + dy * north[0], dx * east[1] + dy * north[1]],
    ex = B[0] - A[0],
    ey = B[1] - A[1],
    len = Math.hypot(ex, ey) || 1,
    c = (ex * want[0] + ey * want[1]) / len;
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

/** a road on the ground between two spots seen from above: points [x, y, h] along it, and its length over the
 * ground (in bowl radii) @param {[number, number]} A @param {[number, number]} B @param {number} [steps]
 * @returns {{ pts: [number, number, number][], length: number }} */
export function bowlRoad(A, B, steps = 24) {
  /** @type {[number, number, number][]} */
  const pts = [];
  let length = 0;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps,
      p = bowlGround(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t);
    if (k) {
      const q = pts[k - 1];
      length += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    }
    pts.push(p);
  }
  return { pts, length };
}

/* ---------- the ground's relief (phase 10, session E-map-4) ----------
   Gentle and readable (owner, 2026-10-19): low hills and dips, a few clear landmarks (the peak by Frostcrown, the
   volcano, the canyon cut, the trench), never tall enough to hide a pin. Each place shapes the ground around it by its
   kind (locations.json "t"): a bump or a dip, [height, reach], both in bowl radii. Places reached by lift add nothing. */
/** @type {Record<string, [number, number]>} */
export const BOWL_RELIEF_KINDS = {
  summit: [0.075, 0.11],
  pass: [0.045, 0.08],
  ridge: [0.035, 0.08],
  volcano: [0.065, 0.07],
  canyon: [-0.03, 0.05],
  sea: [-0.03, 0.12],
  island: [-0.012, 0.07],
  lake: [-0.022, 0.06],
  pond: [-0.014, 0.05],
  trench: [-0.04, 0.07],
  spire: [0.03, 0.06],
  sun: [0.03, 0.06],
  vault: [0.018, 0.07],
  silicon: [0.014, 0.06],
  spore: [0.01, 0.07],
};
/** a gentle rolling bump for every other kind */
export const BOWL_RELIEF_DEFAULT = /** @type {[number, number]} */ ([0.006, 0.06]);
/** the most the relief may add or take, so pins and roads stay readable */
export const BOWL_RELIEF_MAX = 0.08;

/** @typedef {{ x: number, y: number, h: number, r: number }} BowlFeature */
/** each place's bump or dip @param {LocationData[]} places @returns {BowlFeature[]} */
export function bowlReliefFeatures(places) {
  const byId = (/** @type {string} */ id) => places.find(p => p.id === id);
  /** @type {BowlFeature[]} */
  const out = [];
  for (const p of places) {
    if (!p.bowl || 'under' in p.bowl) continue;
    const s = bowlSpotOf(p, byId),
      [x, y] = bowlXY(s.a, s.r),
      [h, r] = BOWL_RELIEF_KINDS[p.t] || BOWL_RELIEF_DEFAULT;
    out.push({ x, y, h, r });
  }
  return out;
}
/** a small deterministic roll so open ground isn't flat (value noise on a coarse lattice) @param {number} x
 * @param {number} y */
export function bowlRoll(x, y) {
  const hash = (/** @type {number} */ i, /** @type {number} */ j) => {
      const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
      return s - Math.floor(s);
    },
    u = x * 9,
    v = y * 9,
    i = Math.floor(u),
    j = Math.floor(v),
    fu = u - i,
    fv = v - j,
    a = hash(i, j),
    b = hash(i + 1, j),
    c = hash(i, j + 1),
    d = hash(i + 1, j + 1);
  return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv - 0.5;
}
/** the relief at a point: the places' bumps and dips, a little roll, kept within BOWL_RELIEF_MAX and fading out
 * beyond the rim @param {BowlFeature[]} F @param {number} x @param {number} y */
export function bowlRelief(F, x, y) {
  let h = 0;
  for (const f of F) {
    const d2 = ((x - f.x) ** 2 + (y - f.y) ** 2) / (f.r * f.r);
    if (d2 < 9) h += f.h * Math.exp(-d2);
  }
  h += bowlRoll(x, y) * 0.008;
  const r = Math.hypot(x, y),
    fade = r <= 1 ? 1 : Math.max(0, 1 - (r - 1) / 0.08);
  return Math.max(-BOWL_RELIEF_MAX, Math.min(BOWL_RELIEF_MAX, h)) * fade || 0;
}

/* ---------- the ground as a grid ----------
   The map draws the ground as a low-poly mesh over a square grid (two triangles a cell, split from the cell's
   south-west to its north-east corner); the camera, the pins and a tap read the height the same way, so everything
   agrees with what is drawn. Beyond the rim the land runs on flat for a short way. */
/** @typedef {{ n: number, e: number, h: Float32Array }} BowlGround */
/** how far the grid reaches from the centre (the rim: the land ends there) and its cells across */
export const BOWL_GROUND_EXTENT = 1;
export const BOWL_GROUND_CELLS = 320;
/** the ground's height with no relief: the bowl inside the rim, flat land beyond @param {number} x @param {number} y */
export function bowlBaseHeight(x, y) {
  const r = Math.hypot(x, y);
  return r <= 1 ? bowlHeight(r) : BOWL_RIM_HEIGHT;
}
/** the grid's heights for these features @param {BowlFeature[]} F @param {number} [n] cells across
 * @returns {BowlGround} */
export function bowlGroundGrid(F, n = BOWL_GROUND_CELLS) {
  const e = BOWL_GROUND_EXTENT,
    h = new Float32Array((n + 1) * (n + 1));
  for (let j = 0; j <= n; j++)
    for (let i = 0; i <= n; i++) {
      const x = -e + (2 * e * i) / n,
        y = -e + (2 * e * j) / n;
      h[j * (n + 1) + i] = bowlBaseHeight(x, y) + bowlRelief(F, x, y);
    }
  return { n, e, h };
}
/** the height of the drawn ground at a point (the triangle it falls in) @param {BowlGround} G @param {number} x
 * @param {number} y */
export function bowlGridHeight(G, x, y) {
  const { n, e, h } = G,
    u = Math.max(0, Math.min(n - 1e-9, ((x + e) / (2 * e)) * n)),
    v = Math.max(0, Math.min(n - 1e-9, ((y + e) / (2 * e)) * n)),
    i = Math.floor(u),
    j = Math.floor(v),
    fu = u - i,
    fv = v - j,
    w = n + 1,
    a = h[j * w + i],
    b = h[j * w + i + 1],
    c = h[(j + 1) * w + i],
    d = h[(j + 1) * w + i + 1];
  /* split along the diagonal from (i, j) to (i + 1, j + 1) */
  return fu >= fv ? a + (b - a) * fu + (d - b) * fv : a + (d - c) * fu + (c - a) * fv;
}

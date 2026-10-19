// @ts-check
'use strict';
/* ================= THE BOWL (phase 10) =================
   The world map is the lower half of the Hollow Earth: a bowl seen from above, the Inner Sun hanging over its centre.
   A place's spot (locations.json "bowl") is { a, r }: a in degrees counter-clockwise from east seen from above, r from
   0 at the centre of the floor to 1 at the rim. A place reached only by lift sits under another: { under: id }.
   The walkable maps keep their own compass. On the bowl each map turns with the curve: its north faces the centre and
   its east runs counter-clockwise, so the seams between maps line up all the way round (docs/phases/10-world-map-bowl.md).
   Depth (medium): a flat floor out to BOWL_FLOOR, then walls rising to 45 degrees at the rim.
   Logic only: no DOM, runs in Node. The renderer, the Studio and the tests read the same numbers. */
/** @import { BowlSpot, LocationData } from '../../types/game-data' */

/** the flat floor's radius, as a share of the bowl's */
export const BOWL_FLOOR = 0.35;
/** the rim's height above the floor, as a share of the bowl's radius (the walls reach 45 degrees at the rim) */
export const BOWL_RIM_HEIGHT = (1 - BOWL_FLOOR) / 2;

/** the ground's height at r (0 centre to 1 rim) @param {number} r @returns {number} */
export function bowlHeight(r) {
  const k = Math.max(0, r - BOWL_FLOOR);
  return (k * k) / (2 * (1 - BOWL_FLOOR));
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
const EXIT = { east: [1, 0], west: [-1, 0], north: [0, 1], south: [0, -1] };
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

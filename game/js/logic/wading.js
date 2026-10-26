// @ts-check
'use strict';
/* ================= WADING (water track WA-6a) =================
   Shallow water (`w` tiles) is waded: walkable, slower, and you stand on its bed with your legs under the surface.
   Deep water (`d`) still blocks (Surf is WA-6b); a kind's play decides the rest (logic/water-kinds.js, WA-5a): lava
   and rapids are never entered, ice is walked on top (its `d` too, no wading), the marsh and the bog slow you more.
   A scene with `ride` (v24 riding) keeps crossing all its water on a
   mount, and a terrain's own `walk` (scenery.json) still decides first. The kind comes from the scene's data
   (`waters` rectangles, else `waterKind`), not the renderer's lookup, so a graphics setting never opens lava.
   Only the walk grid reads this (walk-view.js navGrid): the map generator's reach check (mapgen.js mapgenReach) and
   the seam rules (seam-rules.js) keep water dry, so a generated map still has a dry way to every exit.
   Logic only: no DOM, runs in Node (tools/test/wading.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { WATER_KIND_PLAY, waterKindShut, waterKindSlow, waterKindWalkOn } from './water-kinds.js';
/* eslint-disable no-func-assign */
expose({
  WADE_COST: [() => WADE_COST],
  WADE_DEPTH: [() => WADE_DEPTH],
  WADE_EASE: [() => WADE_EASE],
  WADE_SHUT_KINDS: [() => WADE_SHUT_KINDS],
  WADE_SLOW: [() => WADE_SLOW],
  // @ts-expect-error -- replaced on purpose
  wadeDepthAt: [() => wadeDepthAt, v => (wadeDepthAt = v)],
  // @ts-expect-error -- replaced on purpose
  wadeHere: [() => wadeHere, v => (wadeHere = v)],
  // @ts-expect-error -- replaced on purpose
  wadeKindAt: [() => wadeKindAt, v => (wadeKindAt = v)],
  // @ts-expect-error -- replaced on purpose
  wadeSpeed: [() => wadeSpeed, v => (wadeSpeed = v)],
  // @ts-expect-error -- replaced on purpose
  wadeTileAt: [() => wadeTileAt, v => (wadeTileAt = v)],
  // @ts-expect-error -- replaced on purpose
  wadeWalkable: [() => wadeWalkable, v => (wadeWalkable = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const WADE_DEPTH = 0.3; /* metres under the surface you stand at in open shallows (knee deep) */
export const WADE_EASE = 0.6; /* metres in from the bank over which you sink to WADE_DEPTH */
export const WADE_SLOW = 0.6; /* your speed at WADE_DEPTH, as a share of walking on land */
export const WADE_COST = 2; /* the walk grid's path cost in shallows: people and tap-to-walk keep to land when they can */
/** the kinds never waded (WA-5a: the kinds' play, logic/water-kinds.js; ice is walked on top instead) */
export const WADE_SHUT_KINDS = Object.keys(WATER_KIND_PLAY).filter(k => waterKindShut(k) || waterKindWalkOn(k));

/** the scene's tile at (x, z) in metres (z from the near edge), the scene's edge outside it */
export function wadeTileAt(sc, x, z) {
  return ((sc.tiles || [])[sc.h - 1 - Math.floor(z)] || '')[Math.floor(x)] || sc.edge || 'g';
}
/** the water kind at (x, z) from the scene's data: the last `waters` rectangle holding it, else the scene's own */
export function wadeKindAt(sc, x, z) {
  const R = sc.waters || [];
  for (let i = R.length - 1; i >= 0; i--) {
    const r = R[i];
    if (x >= r.x && z >= r.z && x < r.x + r.w && z < r.z + r.h) return r.k || sc.waterKind || 'pond';
  }
  return sc.waterKind || 'pond';
}
/** can the ground at (x, z) be walked on, by the water rule (ch: the tile there, T: its scenery.json terrain) */
export function wadeWalkable(sc, ch, T, x, z) {
  if (T && T.walk != null) return !!T.walk;
  if (ch !== 'w' && ch !== 'd') return true;
  if (sc.ride) return true;
  const k = wadeKindAt(sc, x, z);
  return waterKindWalkOn(k) || (ch === 'w' && !WADE_SHUT_KINDS.includes(k));
}
/** is (x, z) shallows you wade in (not a riding scene, not lava, rapids or ice) */
export function wadeHere(sc, x, z) {
  return (
    !!sc &&
    !sc.ride &&
    wadeTileAt(sc, x, z) === 'w' &&
    !WADE_SHUT_KINDS.includes(wadeKindAt(sc, x, z)) &&
    wadeWalkable(sc, 'w', null, x, z)
  );
}
/** how far under the surface you stand at (x, z): 0 out of the shallows, easing to WADE_DEPTH over the first
 * WADE_EASE metres from the nearest dry tile (so stepping in and out never jumps) */
export function wadeDepthAt(sc, x, z) {
  if (!wadeHere(sc, x, z)) return 0;
  const i = Math.floor(x),
    j = Math.floor(z);
  let d = WADE_EASE;
  for (let dj = -1; dj <= 1; dj++)
    for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const c = wadeTileAt(sc, i + di + 0.5, j + dj + 0.5);
      if (c === 'w' || c === 'd') continue;
      /* the distance from the point to that dry tile's square */
      const ex = Math.max(i + di - x, 0, x - (i + di + 1)),
        ez = Math.max(j + dj - z, 0, z - (j + dj + 1));
      d = Math.min(d, Math.hypot(ex, ez));
    }
  const k = Math.min(1, d / WADE_EASE);
  return WADE_DEPTH * k * k * (3 - 2 * k);
}
/** your speed in water this deep, as a share of walking on land; k the kind (WA-5a: the marsh and the bog slow you
 * more, logic/water-kinds.js) @param {number} depth @param {string} [k] */
export function wadeSpeed(depth, k) {
  const d = Math.min(1, Math.max(0, depth) / WADE_DEPTH);
  return 1 - (1 - WADE_SLOW * (k ? waterKindSlow(k) : 1)) * d;
}

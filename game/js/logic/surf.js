// @ts-check
'use strict';
/* ================= SURF AND THE WATERFALL CLIMB (water track WA-6b) =================
   Surf: deep water (`d` tiles) is ridden on a Water Billie, cell by cell. With the Water Badge kept and a Water Billie
   standing (RL-R2's rule for the Surf obstacle, logic/run-side.js fieldMoveState; the owner, WA-6b: no height floor)
   you wade out through the shallows (logic/wading.js), mount at the edge of the deep water and get off at the first
   shallows or shore. Lava and ice are never surfed; a terrain's own `walk` (scenery.json) still decides first; a
   scene with `ride` (v24, RL-R2's Surf side areas) keeps crossing all its water as before, so this is for the rest.
   Only the player surfs: the walk grid keeps deep water blocked for everyone else (walk-view.js navGrid's `surf`
   cells), and the map generator's reach check and the seam rules keep it dry.
   The Waterfall climb: a scene's `falls` entry with `climb: 1` (the data contract, docs/phases/water-track.md) is
   climbed from the water at its foot, pushing against it, with every badge of fieldMoves.json `waterfall` kept
   (the owner: Water and Steel) and a Billie of its type standing; you come out on the water or ground at its top.
   Logic only: no DOM, runs in Node (tools/test/surf.test.mjs). Every table comes in as an argument. */
/** @import { FieldClimb, FieldMove } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { WADE_SHUT_KINDS, wadeKindAt } from './wading.js';
import { fieldBadgeKey, fieldMoveState } from './run-side.js';
/* eslint-disable no-func-assign */
expose({
  CLIMB_FOOT: [() => CLIMB_FOOT],
  CLIMB_TOP: [() => CLIMB_TOP],
  SURF_COST: [() => SURF_COST],
  SURF_SPEED: [() => SURF_SPEED],
  badgeKey: [() => badgeKey],
  // @ts-expect-error -- replaced on purpose
  climbAt: [() => climbAt, v => (climbAt = v)],
  // @ts-expect-error -- replaced on purpose
  climbState: [() => climbState, v => (climbState = v)],
  // @ts-expect-error -- replaced on purpose
  climbText: [() => climbText, v => (climbText = v)],
  // @ts-expect-error -- replaced on purpose
  fallDir: [() => fallDir, v => (fallDir = v)],
  // @ts-expect-error -- replaced on purpose
  fallFoot: [() => fallFoot, v => (fallFoot = v)],
  // @ts-expect-error -- replaced on purpose
  fallTop: [() => fallTop, v => (fallTop = v)],
  fallsClimbable: [() => fallsClimbable],
  // @ts-expect-error -- replaced on purpose
  surfCan: [() => surfCan, v => (surfCan = v)],
  // @ts-expect-error -- replaced on purpose
  surfable: [() => surfable, v => (surfable = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the walk grid's path cost on deep water you surf (tap-to-walk keeps to land and shallows when it can) */
export const SURF_COST = 1.5;
/** your speed on the mount, as a share of walking on land */
export const SURF_SPEED = 0.9;
/** the foot of a fall: how far out from its lip (m) along the way it falls you stand to climb it, from against its
 * wall (a little behind the lip's line: the wall stops you about there) to out in its pool */
export const CLIMB_FOOT = [-0.25, 1.6];
/** where you come out at the top: this far back from the lip (m), against the way it falls */
export const CLIMB_TOP = 0.7;

/** may the player Surf here and now: RL-R2's Surf obstacle rule (logic/run-side.js fieldMoveState: the move's type's
 * badge kept and a Billie of its type standing) @param {FieldMove | undefined} M fieldMoves.json moves.surf
 * @param {Record<string, number> | undefined} badges meta.badges
 * @param {{ name: string, types: string[] }[]} team the team's Billies standing */
export function surfCan(M, badges, team) {
  return !!M && fieldMoveState(M, badges, team).state === 'ask';
}
/** is (x, z) deep water the player may Surf on (ch: the tile there, T: its scenery.json terrain): a `d` tile with no
 * terrain `walk` of its own, not lava or ice (logic/wading.js), in a scene that isn't a whole riding scene (those are
 * walkable already) @param {any} sc @param {string} ch @param {any} T @param {number} x @param {number} z */
export function surfable(sc, ch, T, x, z) {
  if (ch !== 'd' || sc.ride || (T && T.walk != null)) return false;
  return !WADE_SHUT_KINDS.includes(wadeKindAt(sc, x, z));
}
/** a fall's `dir` as a unit [dx, dz] (south, [0, -1], when it has none) @param {any} F */
export function fallDir(F) {
  const d = Array.isArray(F.dir) ? F.dir : [0, -1],
    l = Math.hypot(d[0], d[1]);
  return l > 1e-6 ? [d[0] / l, d[1] / l] : [0, -1];
}
/** the falls of a scene the Waterfall climb climbs (`climb: 1`) @param {any} sc @returns {any[]} */
export const fallsClimbable = sc => (Array.isArray(sc && sc.falls) ? sc.falls : []).filter(F => F && F.climb);
/** where you stand to climb a fall: in the water at its foot, out from its lip's middle along the way it falls
 * @param {any} F @returns {number[]} */
export function fallFoot(F) {
  const [dx, dz] = fallDir(F),
    a = (CLIMB_FOOT[0] + CLIMB_FOOT[1]) / 2;
  return [F.x + dx * a, F.z + dz * a];
}
/** where you come out on top: CLIMB_TOP back from the lip's middle @param {any} F @returns {number[]} */
export function fallTop(F) {
  const [dx, dz] = fallDir(F);
  return [F.x - dx * CLIMB_TOP, F.z - dz * CLIMB_TOP];
}
/** the climbable fall whose foot (x, z) is at, when the push (px, pz) goes up it (against the way it falls), or null
 * @param {any} sc @param {number} x @param {number} z @param {number} px @param {number} pz */
export function climbAt(sc, x, z, px, pz) {
  const pl = Math.hypot(px, pz);
  if (pl < 1e-6) return null;
  for (const F of fallsClimbable(sc)) {
    const [dx, dz] = fallDir(F),
      ox = x - F.x,
      oz = z - F.z,
      along = ox * dx + oz * dz,
      across = Math.abs(ox * dz - oz * dx);
    if (along < CLIMB_FOOT[0] || along > CLIMB_FOOT[1] || across > Math.max(0.3, (F.w || 1) / 2)) continue;
    if ((px * dx + pz * dz) / pl < -0.5) return F;
  }
  return null;
}
/** a badge's key in meta.badges: the type's id in lower case (as logic/run-side.js fieldBadgeKey) @param {string} t */
export const badgeKey = t => String(t).toLowerCase();
/** the Waterfall climb's state, as fieldMoveState's: without every badge kept, needBadge; with them but no Billie of
 * its type standing, needType; else ask (and `billie`, the team's first of the type, climbs)
 * @param {FieldClimb} W fieldMoves.json waterfall @param {Record<string, number> | undefined} badges meta.badges
 * @param {{ name: string, types: string[] }[]} team the team's Billies standing
 * @returns {{ state: 'needBadge' | 'needType' | 'ask', billie: string }} */
export function climbState(W, badges, team) {
  if (!(W.badges || []).every(t => (badges || {})[fieldBadgeKey(t)])) return { state: 'needBadge', billie: '' };
  const B = team.find(m => m.types.includes(W.type));
  return B ? { state: 'ask', billie: B.name } : { state: 'needType', billie: '' };
}
/** a Waterfall line with its {badges} ("the Water Badge and the Steel Badge") and {billie} filled in
 * @param {FieldClimb} W @param {'look' | 'needBadge' | 'needType' | 'ask' | 'used' | 'top'} which @param {string} [billie] */
export function climbText(W, which, billie = '') {
  const B = (W.badges || []).map(t => `the ${t} Badge`),
    badges = B.length > 1 ? `${B.slice(0, -1).join(', ')} and ${B[B.length - 1]}` : B[0] || '';
  return String(W[which] || '')
    .replaceAll('{badges}', badges)
    .replaceAll('{billie}', billie);
}

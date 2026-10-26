// @ts-check
'use strict';
/* ================= THE UNLOCK GRAPH (Studio plan Phase 4, T4.2) =================
   What the Studio's Unlocks & hub section draws and checks, from the unlock table (unlocks.json), the hub's buildings
   (buildings.json) and the run rules (rules.json run):
   - unlockGraph: a column per building (the rows sold there, by how deep their `requires` go) and one for the earned
     rows (`when`), with an edge from each row a row needs to it;
   - unlockCycle: the circle a row's new `requires` would close, as a path (the editor refuses that edit and names it);
   - unlockSaveAfter: what a new save has after some runs and wins: the earned rows unlocks.js unlockAuto grants (the
     game's own call, in the hub), the buildings' levels, what each row says to a purchase (unlockReady) and what a
     run's map and shops can draw (runUnlocks, unlockOpen).
   Logic only: no DOM, runs in Node (tools/test/unlock-graph.test.mjs). */
/** @import { Unlock, HubBuilding } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { newMeta } from './meta-state.js';
import { buildingLevel, runUnlocks, unlockAuto, unlockDoor, unlockOpen, unlockReady } from './unlocks.js';
/* eslint-disable no-func-assign */
expose({
  UNLOCK_EARNED: [() => UNLOCK_EARNED],
  // @ts-expect-error -- replaced on purpose
  unlockCycle: [() => unlockCycle, v => (unlockCycle = v)],
  // @ts-expect-error -- replaced on purpose
  unlockDepths: [() => unlockDepths, v => (unlockDepths = v)],
  // @ts-expect-error -- replaced on purpose
  unlockGraph: [() => unlockGraph, v => (unlockGraph = v)],
  // @ts-expect-error -- replaced on purpose
  unlockSaveAfter: [() => unlockSaveAfter, v => (unlockSaveAfter = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the column of the earned rows */
export const UNLOCK_EARNED = 'earned';

/** how many rows of needs stand below each row (0: needs none); a circle counts once round
 * @param {Record<string, Unlock>} U @returns {Record<string, number>} */
export function unlockDepths(U) {
  /** @type {Record<string, number>} */
  const depth = {},
    on = new Set();
  /** @param {string} k @returns {number} */
  const go = k => {
    if (k in depth) return depth[k];
    if (on.has(k) || !U[k]) return 0;
    on.add(k);
    const d = Math.max(-1, ...(U[k].requires || []).map(r => go(r))) + 1;
    on.delete(k);
    return (depth[k] = d);
  };
  for (const k of Object.keys(U)) go(k);
  return depth;
}

/**
 * The graph: columns (each building in buildings.json order, then the earned rows), nodes (a row each: its column,
 * depth, place in its column, door, currency, cost and grant) and edges (from a row it needs to the row).
 * @param {{ unlocks: Record<string, Unlock>, buildings: Record<string, HubBuilding> }} D
 */
export function unlockGraph(D) {
  const U = D.unlocks || {},
    B = D.buildings || {},
    depth = unlockDepths(U),
    cols = [
      ...Object.entries(B).map(([id, b]) => ({ id, name: b.name || id, currency: b.currency, soon: !!b.soon })),
      { id: UNLOCK_EARNED, name: 'Earned', currency: null, soon: false },
    ],
    colOf = (/** @type {Unlock} */ R) => (R.when ? UNLOCK_EARNED : R.at && B[R.at] ? R.at : UNLOCK_EARNED),
    /** @type {Record<string, number>} */
    slot = {};
  const nodes = Object.entries(U)
    .map(([id, R]) => ({
      id,
      name: R.name || id,
      col: colOf(R),
      depth: depth[id] || 0,
      door: unlockDoor(R),
      currency: R.when ? null : (B[/** @type {string} */ (R.at)] || {}).currency || null,
      cost: R.when ? 0 : R.cost || 0,
      grant: R.grant || {},
      lost: !R.when && !(R.at && B[R.at]),
    }))
    .sort((a, b) => a.depth - b.depth)
    .map(n => {
      const key = n.col + ':' + n.depth;
      return { ...n, at: (slot[key] = (slot[key] ?? -1) + 1) };
    });
  const edges = Object.entries(U).flatMap(([id, R]) =>
    (R.requires || []).filter(r => U[r]).map(r => ({ from: r, to: id }))
  );
  return { cols, nodes, edges };
}

/**
 * The circle that giving row `id` the needs `requires` would close, as a path from `id` back to it (['a', 'b', 'a']),
 * or null when there is none. A row that needs itself is a circle of one.
 * @param {Record<string, Unlock>} U @param {string} id @param {string[]} requires
 * @returns {string[] | null}
 */
export function unlockCycle(U, id, requires) {
  const T = { ...U, [id]: { ...U[id], requires } },
    seen = new Set();
  /** @param {string} k @param {string[]} path @returns {string[] | null} */
  const walk = (k, path) => {
    if (k === id) return [...path, k];
    if (seen.has(k) || !T[k]) return null;
    seen.add(k);
    for (const r of T[k].requires || []) {
      const p = walk(r, [...path, k]);
      if (p) return p;
    }
    return null;
  };
  for (const r of requires) {
    const p = walk(r, [id]);
    if (p) return p;
  }
  return null;
}

/**
 * What a new save has after `runs` runs and `wins` wins (in the hub, nothing bought): the earned rows the game grants
 * (unlockAuto) and so the currencies they give, each building's level, why each row can't be bought now (null: it
 * can), and the biomes and shop wares a run can draw.
 * @param {{ unlocks: Record<string, Unlock>, buildings: Record<string, HubBuilding>, rules?: any }} D
 * @param {{ runs?: number, wins?: number, caught?: number }} [o]
 */
export function unlockSaveAfter(D, o = {}) {
  const meta = newMeta();
  meta.runs = o.runs || 0;
  meta.wins = o.wins || 0;
  const UD = { unlocks: D.unlocks || {}, buildings: D.buildings || {} },
    caught = Object.fromEntries(Array.from({ length: o.caught || 0 }, (_, k) => ['c' + k, 1])),
    s = /** @type {any} */ ({ meta, run: null, story: {}, caught, team: [], box: [] }),
    earned = unlockAuto(s, UD),
    run = runUnlocks(s, UD),
    R = (D.rules && D.rules.run) || {};
  return {
    earned,
    owned: Object.keys(meta.unlocks),
    currencies: { research: meta.research, scrap: meta.scrap, crests: meta.crests, dna: meta.dna },
    buildings: Object.fromEntries(Object.keys(UD.buildings).map(b => [b, buildingLevel(s, b)])),
    why: Object.fromEntries(Object.keys(UD.unlocks).map(id => [id, unlockReady(s, id, UD)])),
    biomes: Object.keys(unlockOpen((R.map && R.map.biomes) || {}, 'biome', run, UD)),
    shop: Object.keys(unlockOpen((R.shop && R.shop.pick) || {}, 'shop', run, UD)),
  };
}

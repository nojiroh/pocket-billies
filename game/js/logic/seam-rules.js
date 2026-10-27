// @ts-check
'use strict';
/* ================= SEAM RULES (phase 08b's link checks, one copy since map generator MG-2) =================
   How two places' maps must meet for the walk to join them (seamless-world.js seamlessJoin): a seam's two exits face
   each other (east to west, north to south), are as wide, and meet within half a metre once the view puts the second
   map on whole metres; the ground at each exit is walkable (the walk's own rule: water only where the place is
   ridden). Every edge exit of a place's map is used by exactly one link; a side has at most two exits, 44 m apart or
   more. A lift: a lift prop at each end goes to the other. A link that joins nothing walkable is an error, not a road
   the game draws.
   Logic only: no DOM, no game data of its own, runs in Node. tools/check-data.mjs runs it on the game's data, the map
   generator's tests on generated pairs (tools/test/seam-rules.test.mjs plants each fault). What a problem says is
   [where, what], in the words check-data has always used. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  SEAM_EXIT_GAP: [() => SEAM_EXIT_GAP],
  SEAM_OPPOSITE: [() => SEAM_OPPOSITE],
  SEAM_SIDE_MOST: [() => SEAM_SIDE_MOST],
  seamRulesAlong: [() => seamRulesAlong],
  // @ts-expect-error -- replaced on purpose
  seamRulesExitPoint: [() => seamRulesExitPoint, v => (seamRulesExitPoint = v)],
  // @ts-expect-error -- replaced on purpose
  seamRulesLinks: [() => seamRulesLinks, v => (seamRulesLinks = v)],
  // @ts-expect-error -- replaced on purpose
  seamRulesPair: [() => seamRulesPair, v => (seamRulesPair = v)],
  // @ts-expect-error -- replaced on purpose
  seamRulesPlaces: [() => seamRulesPlaces, v => (seamRulesPlaces = v)],
  // @ts-expect-error -- replaced on purpose
  seamRulesSides: [() => seamRulesSides, v => (seamRulesSides = v)],
  // @ts-expect-error -- replaced on purpose
  seamRulesWalkable: [() => seamRulesWalkable, v => (seamRulesWalkable = v)],
  seamSideMost: [() => seamSideMost],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const SEAM_OPPOSITE = { E: 'W', W: 'E', N: 'S', S: 'N' };
export const SEAM_SIDE_MOST = 2; /* exits on a side of a map up to 64 m long, at most (WM-3: a longer side holds one more each 44 m) */
export const SEAM_EXIT_GAP = 44; /* metres between two exits on one side, at least */

/** WM-3: how many exits a side `len` metres long may hold: two up to 64 m, one more for each 44 m past it (three on
 * a 128 m side, four on 192 m) @param {number} len */
export const seamSideMost = len => SEAM_SIDE_MOST + Math.max(0, Math.floor((len - 64) / SEAM_EXIT_GAP));
/** where along its side an exit is, in metres to the hundredth */
export const seamRulesAlong = (sc, e) => Math.round(e.t * (e.side === 'N' || e.side === 'S' ? sc.w : sc.h) * 100) / 100;
/** the point an exit stands on (as walk-view.js exitPoint works it out) */
export function seamRulesExitPoint(sc, e) {
  const n = e.in == null ? 1.1 : e.in;
  return e.side === 'N'
    ? [e.t * sc.w, sc.h - n]
    : e.side === 'S'
      ? [e.t * sc.w, n]
      : e.side === 'E'
        ? [sc.w - n, e.t * sc.h]
        : [n, e.t * sc.h];
}
/** can the ground at this point be walked on (terrains: scenery.json's) @param {any} sc @param {number[]} pt @param {Record<string, any>} terrains */
export function seamRulesWalkable(sc, pt, terrains) {
  const [x, z] = pt,
    ch = ((sc.tiles || [])[sc.h - 1 - Math.floor(z)] || '')[Math.floor(x)] || sc.edge || 'g',
    t = terrains[ch];
  return t && t.walk != null ? !!t.walk : !'wd'.includes(ch) || !!sc.ride;
}

/**
 * the links' problems, and which exit each link uses (for seamRulesPlaces).
 * roads: roads.json's entries; roadOf: data-files.js PB_DATA.road (an entry with its places as nodes);
 * locations: the places in order; maps: by id; terrains: scenery.json's.
 * @param {{ roads: any[], roadOf: (L: any) => any, locations: any[], maps: Record<string, any>, terrains: Record<string, any> }} o
 * @returns {{ problems: string[][], used: Map<string, string[]> }}
 */
export function seamRulesLinks({ roads, roadOf, locations, maps, terrains }) {
  const problems = [],
    problem = (where, what) => problems.push([where, what]),
    used = new Map(),
    ids = new Set();
  (roads || []).forEach((L, i) => {
    const l = roadOf(L),
      name = l.id || `link ${i}`;
    if (!locations[l.a] || !locations[l.b])
      return problem('roads.json', `${name} joins ${L.a && L.a.map} and ${L.b && L.b.map}, not two places`);
    if (l.a === l.b) problem('roads.json', `${name} joins ${locations[l.a].id} to itself`);
    if (ids.has(l.id)) problem('roads.json', `two links are ${l.id}`);
    ids.add(l.id);
    const ends = [
      [l.a, l.exitA],
      [l.b, l.exitB],
    ].map(([n, x]) => {
      const sc = maps[locations[n].mapId];
      return {
        place: locations[n].id,
        mapId: locations[n].mapId,
        sc,
        x,
        e: sc && x ? (sc.edgeExits || []).find(q => q.id === x) : null,
      };
    });
    if (l.kind === 'lift') {
      for (const [E, O] of [ends, [...ends].reverse()])
        if (!E.sc || !(E.sc.props || []).some(p => p.act === 'lift' && p.to === O.place))
          problem('roads.json', `${name}: ${E.mapId} has no lift going to ${O.place}`);
      return;
    }
    for (const E of ends) {
      if (!E.e) {
        problem('roads.json', `${name}: ${E.mapId} has no exit ${E.x} (a road that joins nothing)`);
        continue;
      }
      used.set(`${E.mapId}:${E.e.id}`, (used.get(`${E.mapId}:${E.e.id}`) || []).concat(name));
      if (!seamRulesWalkable(E.sc, seamRulesExitPoint(E.sc, E.e), terrains))
        problem('roads.json', `${name}: the ground at ${E.mapId}'s exit ${E.e.id} can't be walked on`);
    }
    const [A, B] = ends;
    if (!A.e || !B.e) return;
    for (const what of seamRulesPair(A.sc, A.e, B.sc, B.e, A.mapId, B.mapId)) problem('roads.json', `${name}: ${what}`);
  });
  return { problems, used };
}
/** what is wrong with two exits meeting (faces, width, offset), in check-data's words */
export function seamRulesPair(scA, eA, scB, eB, idA = 'A', idB = 'B') {
  const out = [];
  if (SEAM_OPPOSITE[eA.side] !== eB.side)
    out.push(`the exits don't face each other (${idA} ${eA.side}, ${idB} ${eB.side})`);
  if ((eA.width || 2) !== (eB.width || 2)) out.push(`the exits are ${eA.width || 2} m and ${eB.width || 2} m wide`);
  const d = seamRulesAlong(scA, eA) - seamRulesAlong(scB, eB);
  if (Math.abs(d - Math.round(d)) >= 0.5)
    out.push(`the exits miss each other by ${Math.abs(d - Math.round(d)).toFixed(2)} m`);
  return out;
}
/**
 * the places' problems: every edge exit used by exactly one link (used: from seamRulesLinks), and the exits on each
 * side of a map (seamRulesSides)
 * @param {{ locations: any[], maps: Record<string, any>, used: Map<string, string[]> }} o
 * @returns {string[][]}
 */
export function seamRulesPlaces({ locations, maps, used }) {
  const problems = [];
  for (const r of locations) {
    const sc = maps[r.mapId];
    if (!sc) continue;
    for (const e of sc.edgeExits || []) {
      const u = used.get(`${r.mapId}:${e.id}`) || [];
      if (u.length !== 1)
        problems.push([`maps/${r.mapId}.json`, `exit ${e.id} is used by ${u.length ? u.join(' and ') : 'no link'}`]);
    }
    for (const what of seamRulesSides(sc)) problems.push([`maps/${r.mapId}.json`, what]);
  }
  return problems;
}
/** what is wrong with the exits on each side of one map (two at most on a side up to 64 m, more on a longer one:
 * seamSideMost; 44 m apart) */
export function seamRulesSides(sc) {
  const out = [],
    E = sc.edgeExits || [];
  for (const side of ['N', 'S', 'E', 'W']) {
    const xs = E.filter(e => e.side === side)
      .map(e => seamRulesAlong(sc, e))
      .sort((a, b) => a - b);
    const most = seamSideMost(side === 'N' || side === 'S' ? sc.w : sc.h);
    if (xs.length > most) out.push(`${xs.length} exits on its ${side} side (${most} at most)`);
    for (let k = 1; k < xs.length; k++)
      if (xs[k] - xs[k - 1] < SEAM_EXIT_GAP)
        out.push(`two exits on its ${side} side ${(xs[k] - xs[k - 1]).toFixed(1)} m apart (44 m at least)`);
  }
  return out;
}

// @ts-check
'use strict';
/* ================= THE RUN MAP (roguelite track RL-6) =================
   A run's node map, made from its seed (roguelite-track.md 2e): rows from the landing (row 0, where the airship sets
   you down) to the boss (the last row), one or two nodes a row, links only to the next row, so every path is as long
   as the map has rows. Mini-boss rows and the boss row hold one node, so every path meets them, and the row before
   each mini-boss is a town (rules.json run.map). The other rows take a filler type by weight (nodeTypes.json).
   A link leaves its node by the north side and arrives by the next node's south: one link at t 0.5, two at 0.25 and
   0.75 (the seam rules allow two exits a side, 44 m apart; logic/seam-rules.js), so a node has at most two links each
   way. Two lanes run straight, split, merge, or switch once (one diagonal, never two, so links never cross).
   On the bowl every map's north faces the centre (logic/bowl.js), so a run's rows go from the rim towards it, on the
   bowl's south side, and each node's exits run west to east in the order of its neighbours.
   Numbering: the map's nodes are 0..n-1, row by row, west to east (run.path, a node's `to`, the seeds); the run's world
   puts Copperleaf first, so map node i is world node i + 1 (saveData.trip.node, run.forecast).
   Logic only: no DOM, runs in Node (tools/test/run-map.test.mjs). It reads no game data: every table comes in as an
   argument, so the data check can use it too. */
/** @import { RunMap, RunNode } from '../../types/save-data' */
/** @import { NodeType, RunMapRules } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { rngFrom } from './rng.js';
/* eslint-disable no-func-assign */
expose({
  RUN_BOWL: [() => RUN_BOWL],
  RUN_EXIT_T: [() => RUN_EXIT_T],
  runBack: [() => runBack],
  // @ts-expect-error -- replaced on purpose
  runExits: [() => runExits, v => (runExits = v)],
  // @ts-expect-error -- replaced on purpose
  runMapMake: [() => runMapMake, v => (runMapMake = v)],
  runMapNode: [() => runMapNode],
  // @ts-expect-error -- replaced on purpose
  runMapRows: [() => runMapRows, v => (runMapRows = v)],
  // @ts-expect-error -- replaced on purpose
  runMapRowsFit: [() => runMapRowsFit, v => (runMapRowsFit = v)],
  runNext: [() => runNext],
  // @ts-expect-error -- replaced on purpose
  runSpot: [() => runSpot, v => (runSpot = v)],
  runWorldNode: [() => runWorldNode],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** what a row holds: the landing ('first'), the boss ('last'), a mini-boss ('guard'), the town before one ('rest'), or
 * a filler ('') @param {RunMapRules} M @returns {string[]} */
export function runMapRows(M) {
  const rows = /** @type {string[]} */ (Array(M.rows).fill(''));
  for (let k = 1; k <= M.minibosses; k++) rows[Math.round((k * M.rows) / (M.minibosses + 1))] = 'guard';
  rows.forEach((role, g) => {
    if (role === 'guard' && g >= 2 && rows[g - 1] === '') rows[g - 1] = 'rest';
  });
  rows[0] = 'first';
  rows[M.rows - 1] = 'last';
  return rows;
}
/** whether the rows can be laid out: every mini-boss on a row of its own with a town before it, after the landing's
 * row and before the boss's @param {RunMapRules} M @returns {boolean} */
export function runMapRowsFit(M) {
  const rows = runMapRows(M);
  return (
    rows.length === M.rows &&
    rows.filter(r => r === 'guard').length === M.minibosses &&
    rows.every((r, g) => r !== 'guard' || rows[g - 1] === 'rest')
  );
}
/** the map for a seed. Each choice draws from a stream of its own (a row's shape, a node's type, a node's biome, keyed
 * by row and lane), so changing one rule moves only what it rules
 * @param {string} seed @param {Record<string, NodeType>} nodeTypes @param {RunMapRules} M @returns {RunMap} */
export function runMapMake(seed, nodeTypes, M) {
  if (!runMapRowsFit(M)) throw new Error(`runMapMake: ${M.rows} rows can't hold ${M.minibosses} mini-bosses`);
  const roles = runMapRows(M),
    fill = Object.fromEntries(Object.entries(nodeTypes).map(([k, t]) => [k, t.weight || 0])),
    byRole = { first: M.first, last: M.last, guard: M.guard, rest: M.rest };
  if (!Object.values(fill).some(w => w > 0)) throw new Error('runMapMake: no node type has a weight');
  /* each row's shape: [width, its switch to the next row] (a draw each, whatever the rules, so every row's stream
     stays the same when another row changes) */
  const shape = roles.map((role, row) => {
    const g = rngFrom(seed, 'map|shape|' + row),
      wide = g.next() < M.wide,
      cross = g.next() < M.cross,
      west = g.next() < 0.5;
    return { width: (role === '' || role === 'rest') && wide ? 2 : 1, cross, west };
  });
  /** @type {number[][]} */
  const at = [];
  /** @type {RunNode[]} */
  const nodes = [];
  shape.forEach(({ width }, row) => {
    at.push([]);
    for (let lane = 0; lane < width; lane++) {
      const role = roles[row],
        type = role
          ? byRole[/** @type {keyof typeof byRole} */ (role)]
          : rngFrom(seed, `map|type|${row}|${lane}`).pick(fill),
        biome = rngFrom(seed, `map|biome|${row}|${lane}`).pick(M.biomes);
      at[row].push(nodes.length);
      nodes.push({ type, row, lane, to: [], seen: 0, biome });
    }
  });
  for (let row = 0; row + 1 < at.length; row++) {
    const here = at[row],
      next = at[row + 1],
      link = (/** @type {number} */ a, /** @type {number} */ b) => nodes[here[a]].to.push(next[b]);
    if (here.length === 1) next.forEach((_, b) => link(0, b));
    else if (next.length === 1) here.forEach((_, a) => link(a, 0));
    else {
      link(0, 0);
      link(1, 1);
      if (shape[row].cross) shape[row].west ? link(1, 0) : link(0, 1);
    }
  }
  for (const n of nodes) n.to.sort((a, b) => a - b);
  return { nodes };
}
/** the nodes a node leads to (forward, by its north side) @param {RunMap} map @param {number} i @returns {number[]} */
export const runNext = (map, i) => map.nodes[i].to.slice();
/** the nodes that lead to a node (back, by its south side) @param {RunMap} map @param {number} i @returns {number[]} */
export const runBack = (map, i) => map.nodes.flatMap((n, j) => (n.to.includes(i) ? [j] : []));
/** where links meet a side of a scene: one in the middle, two at a quarter and three quarters (56 m apart on a 112 m
 * run scene; the seam rules want 44 m) */
export const RUN_EXIT_T = [[], [0.5], [0.25, 0.75]];
/** a node's exits, west to east: north to the nodes it leads to, south to the ones that lead to it
 * @param {RunMap} map @param {number} i
 * @returns {{ north: { to: number, t: number }[], south: { from: number, t: number }[] }} */
export function runExits(map, i) {
  const byLane = (/** @type {number[]} */ js) => js.slice().sort((a, b) => map.nodes[a].lane - map.nodes[b].lane),
    ahead = byLane(runNext(map, i)),
    back = byLane(runBack(map, i));
  if (ahead.length > 2 || back.length > 2) throw new Error(`runExits: node ${i} has more than two links a side`);
  return {
    north: ahead.map((to, k) => ({ to, t: RUN_EXIT_T[ahead.length][k] })),
    south: back.map((from, k) => ({ from, t: RUN_EXIT_T[back.length][k] })),
  };
}
/** where a run's map sits on the bowl: its rows from the rim (the landing) towards the centre (the boss), on the
 * bowl's south side, two lanes a fixed distance apart (in bowl radii) */
export const RUN_BOWL = { a: 270, outer: 0.94, inner: 0.12, lane: 0.07 };
/** a node's spot on the bowl ({a, r} as locations.json "bowl"), worked out from its row and lane, never stored
 * @param {RunMap} map @param {number} i @returns {{ a: number, r: number }} */
export function runSpot(map, i) {
  const node = map.nodes[i],
    rows = 1 + Math.max(...map.nodes.map(n => n.row)),
    width = map.nodes.filter(n => n.row === node.row).length,
    r = rows > 1 ? RUN_BOWL.outer - (node.row * (RUN_BOWL.outer - RUN_BOWL.inner)) / (rows - 1) : RUN_BOWL.outer,
    side = (node.lane - (width - 1) / 2) * RUN_BOWL.lane;
  /* lanes `lane` apart in a straight line: half of it either side of the middle, on the row's circle */
  return { a: RUN_BOWL.a + (Math.asin(side / r) * 180) / Math.PI, r };
}
/** the run's world node of a map node (Copperleaf is world node 0) @param {number} i */
export const runWorldNode = i => i + 1;
/** the map node of a run's world node (-1 for Copperleaf) @param {number} node */
export const runMapNode = node => node - 1;

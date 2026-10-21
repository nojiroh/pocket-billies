// @ts-check
'use strict';
/* ================= THE RUN MAP AND ITS CLOCK (roguelite track RL-6) =================
   A run's node map, made from its seed (roguelite-track.md 2e): rows from the landing (row 0, where the airship sets
   you down) to the boss (the last row), one or two nodes a row, links only to the next row, so every path is as long
   as the map has rows. Mini-boss rows and the boss row hold one node, so every path meets them, and the row before
   each mini-boss is a town (rules.json run.map). The other rows take a filler type by weight (nodeTypes.json).
   A link leaves its node by the west side and arrives by the next node's east (the owner: runs go east to west): one
   link at t 0.5, two at 0.15625 and 0.84375, 10 m and 54 m along (the seam rules allow two exits a side, 44 m apart, logic/seam-rules.js, and an
   east or west edge is 64 m), so a node has at most two links each way. runExits' `ahead` is the way west,
   `back` the way east. Two lanes run straight, split, merge, or switch once (one diagonal, never two, so links never cross).
   On the bowl every map's north faces the centre (logic/bowl.js), so west is clockwise round it: a run's rows go
   clockwise along an arc on the bowl's south side, lane 0 outermost (a map's south), and each node's exits run south
   to north in the order of its neighbours.
   The clock (owner, 8.10): a day per arrival, backtracking included; the landing is day 1; the deadline is the
   shortest walk to the boss plus a slack (rules.json run.clock), past which RL-13 hardens the world. The map shows the
   next row from where you stand, the row after as '?', and the boss always (run.reveal). Each node has a forecast by
   day, rolled from its biome's climate on a stream of its own per day (logic/weather.js weatherPick).
   Numbering: the map's nodes are 0..n-1, row by row, lane by lane (run.path, a node's `to`, the seeds); the run's world
   puts Copperleaf first, so map node i is world node i + 1 (saveData.trip.node, run.forecast).
   Logic only: no DOM, runs in Node (tools/test/run-map.test.mjs). It reads no game data: every table comes in as an
   argument, so the data check can use it too. */
/** @import { Run, RunMap, RunNode, SaveData } from '../../types/save-data' */
/** @import { NodeType, RunMapRules } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import { rngFrom } from './rng.js';
import { weatherPick } from './weather.js';
import { RUN_DAYS } from './run-state.js';
/* eslint-disable no-func-assign */
expose({
  RUN_BOWL: [() => RUN_BOWL],
  RUN_EXIT_T: [() => RUN_EXIT_T],
  // @ts-expect-error -- replaced on purpose
  runArrive: [() => runArrive, v => (runArrive = v)],
  runBack: [() => runBack],
  runDeadline: [() => runDeadline],
  // @ts-expect-error -- replaced on purpose
  runExits: [() => runExits, v => (runExits = v)],
  // @ts-expect-error -- replaced on purpose
  runForecastFill: [() => runForecastFill, v => (runForecastFill = v)],
  // @ts-expect-error -- replaced on purpose
  runMapMake: [() => runMapMake, v => (runMapMake = v)],
  runMapNode: [() => runMapNode],
  // @ts-expect-error -- replaced on purpose
  runMapRows: [() => runMapRows, v => (runMapRows = v)],
  // @ts-expect-error -- replaced on purpose
  runMapRowsFit: [() => runMapRowsFit, v => (runMapRowsFit = v)],
  // @ts-expect-error -- replaced on purpose
  runMapStart: [() => runMapStart, v => (runMapStart = v)],
  runNext: [() => runNext],
  runNodeSeed: [() => runNodeSeed],
  runOverdue: [() => runOverdue],
  // @ts-expect-error -- replaced on purpose
  runReveal: [() => runReveal, v => (runReveal = v)],
  // @ts-expect-error -- replaced on purpose
  runSpot: [() => runSpot, v => (runSpot = v)],
  runWeather: [() => runWeather],
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
export const RUN_EXIT_T = [
  [],
  [0.5],
  [0.15625, 0.84375],
]; /* 10 m and 54 m along a 64 m edge: whole metres, 44 m apart */
/** a node's exits, west to east: north to the nodes it leads to, south to the ones that lead to it
 * @param {RunMap} map @param {number} i
 * @returns {{ ahead: { to: number, t: number }[], back: { from: number, t: number }[] }} */
export function runExits(map, i) {
  const byLane = (/** @type {number[]} */ js) => js.slice().sort((a, b) => map.nodes[a].lane - map.nodes[b].lane),
    ahead = byLane(runNext(map, i)),
    back = byLane(runBack(map, i));
  if (ahead.length > 2 || back.length > 2) throw new Error(`runExits: node ${i} has more than two links a side`);
  return {
    ahead: ahead.map((to, k) => ({ to, t: RUN_EXIT_T[ahead.length][k] })),
    back: back.map((from, k) => ({ from, t: RUN_EXIT_T[back.length][k] })),
  };
}
/** where a run's map sits on the bowl: its rows clockwise (westward) along an arc at radius r, centred on angle a
 * (the bowl's south side) and `span` degrees long, from the landing in the south-east to the boss in the south-west;
 * two lanes a fixed distance apart across it (in bowl radii), lane 0 outermost */
export const RUN_BOWL = { a: 270, span: 120, r: 0.62, lane: 0.07 };
/** a node's spot on the bowl ({a, r} as locations.json "bowl"), worked out from its row and lane, never stored
 * @param {RunMap} map @param {number} i @returns {{ a: number, r: number }} */
export function runSpot(map, i) {
  const node = map.nodes[i],
    rows = 1 + Math.max(...map.nodes.map(n => n.row)),
    width = map.nodes.filter(n => n.row === node.row).length,
    a = rows > 1 ? RUN_BOWL.a + RUN_BOWL.span / 2 - (node.row * RUN_BOWL.span) / (rows - 1) : RUN_BOWL.a,
    side = (node.lane - (width - 1) / 2) * RUN_BOWL.lane;
  /* lanes `lane` apart across the arc: half of it either side of its circle, the higher lane nearer the centre */
  return { a, r: RUN_BOWL.r - side };
}
/** the run's world node of a map node (Copperleaf is world node 0) @param {number} i */
export const runWorldNode = i => i + 1;
/** the map node of a run's world node (-1 for Copperleaf) @param {number} node */
export const runMapNode = node => node - 1;

/* ---------- the clock (owner, 8.10): a day per arrival, backtracking included; the landing is day 1 ---------- */
/** the deadline day: the shortest walk to the boss in days (one row a day from the landing's day 1) and the slack
 * @param {RunMap} map @param {number} slack @returns {number} */
export const runDeadline = (map, slack) => 1 + Math.max(...map.nodes.map(n => n.row)) + slack;
/** days past the deadline (0 on or before it, and while no deadline is set) @param {Run} run @returns {number} */
export const runOverdue = run => (run.deadline ? Math.max(0, run.clock - run.deadline) : 0);
/** show the map from a row: the rows up to `icons` ahead with their type, the rows up to `unknown` ahead as '?', the
 * boss always (the goal). What was shown stays shown @param {RunMap} map @param {number} row
 * @param {{ icons: number, unknown: number }} reveal */
export function runReveal(map, row, reveal) {
  const last = Math.max(...map.nodes.map(n => n.row));
  for (const n of map.nodes) {
    const want = n.row <= row + reveal.icons || n.row === last ? 2 : n.row <= row + reveal.unknown ? 1 : 0;
    n.seen = Math.max(n.seen || 0, want);
  }
}
/** a map node's seed, which its scene, wild stock, shop and weather streams are salted from (roguelite-track.md 2c:
 * the map's numbering) @param {string} seed @param {number} i */
export const runNodeSeed = (seed, i) => `${seed}|n${i}`;
provide({ runNodeSeed }); /* to-module */
/** each node's weather by day, rolled up to a day (forecast[world node][day - 1]; Copperleaf, world node 0, has none:
 * the hub keeps the real clock's weather). Each node and day rolls from a stream of its own, so filling later gives
 * the days a longer fill would have. A node's climate is its biome's
 * @param {Run} run @param {Record<string, { climate?: string }>} biomes @param {number} toDay */
export function runForecastFill(run, biomes, toDay) {
  if (!run.map) return;
  const map = run.map,
    last = Math.min(toDay, RUN_DAYS);
  while (run.forecast.length < map.nodes.length + 1) run.forecast.push([]);
  map.nodes.forEach((node, i) => {
    const days = run.forecast[runWorldNode(i)],
      climate = (biomes[node.biome || ''] || {}).climate || 'mild';
    for (let day = days.length + 1; day <= last; day++)
      days.push(weatherPick(climate, rngFrom(runNodeSeed(run.seed, i), 'weather|' + day).next()));
  });
}
/** a node's weather on a day ('' when not rolled) @param {Run} run @param {number} i @param {number} day */
export const runWeather = (run, i, day) => (run.forecast[runWorldNode(i)] || [])[day - 1] || '';
provide({ runWeather }); /* to-module */
/**
 * @typedef {{ nodeTypes: Record<string, NodeType>, biomes: Record<string, { climate?: string }>,
 *   rules: { map: RunMapRules, clock: { slack: number, ahead: number }, reveal: { icons: number, unknown: number } } }} RunMapData
 */
/** give a new run its map (at the mast, before the flight): the map from the seed, the deadline, the landing's view
 * and the forecast a week ahead @param {Run} run @param {RunMapData} data @returns {RunMap} */
export function runMapStart(run, data) {
  run.map = runMapMake(run.seed, data.nodeTypes, data.rules.map);
  run.deadline = runDeadline(run.map, data.rules.clock.slack);
  run.forecast = [];
  runReveal(run.map, 0, data.rules.reveal);
  runForecastFill(run, data.biomes, run.clock + data.rules.clock.ahead);
  return run.map;
}
/** arrive at map node i: the landing first (day 1), then only a node linked to where you stand, forward or back, a day
 * each. Where you stand is saveData.trip.node (RL-3: the one copy of the position; a debug jump or a test sets it
 * alone), Copperleaf before the landing. Moves trip.node with the run, shows the map from there and keeps the
 * forecast a week ahead. Returns the day, or 0 when i can't be reached from here (nothing changes)
 * @param {SaveData} s @param {number} i @param {RunMapData} data @returns {number} */
export function runArrive(s, i, data) {
  const run = s.run;
  if (!run || !run.map || !run.map.nodes[i]) return 0;
  const map = run.map,
    at = runMapNode(s.trip ? s.trip.node : 0),
    here = map.nodes[at] ? at : -1,
    linked = here < 0 ? map.nodes[i].row === 0 : runNext(map, here).includes(i) || runBack(map, here).includes(i);
  if (!linked) return 0;
  /* the run's first arrival is day 1; every later one costs a day */
  if (run.path.length) run.clock = Math.min(RUN_DAYS, run.clock + 1);
  run.path.push(i);
  s.trip.node = runWorldNode(i);
  runReveal(map, map.nodes[i].row, data.rules.reveal);
  runForecastFill(run, data.biomes, run.clock + data.rules.clock.ahead);
  return run.clock;
}

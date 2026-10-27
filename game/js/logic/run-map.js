// @ts-check
'use strict';
/* ================= THE RUN MAP AND ITS CLOCK (roguelite track RL-6) =================
   A run's node map, made from its seed (roguelite-track.md 2e): rows from the landing (row 0, where the airship sets
   you down) to the boss (the last row), one or two nodes a row, links only to the next row, so every path is as long
   as the map has rows. Mini-boss rows and the boss row hold one node, so every path meets them, and the row before
   each mini-boss is a town (rules.json run.map). The other rows take a filler type by weight (nodeTypes.json); RL-14:
   a type with a chance instead (a scrapyard) takes a free node by it, from its fromRow on.
   A link leaves its node by the east side and arrives by the next node's west (the owner, WM-1: runs go west to east,
   reversing TR-2's east to west): one
   link at t 0.5, two at 0.15625 and 0.84375, 10 m and 54 m along (the seam rules allow two exits a side, 44 m apart, logic/seam-rules.js, and an
   east or west edge is 64 m), so a node has at most two links each way. runExits' `ahead` is the way east,
   `back` the way west. Two lanes run straight, split, merge, or switch once (one diagonal, never two, so links never cross).
   On the bowl (RUN_BOWL) the rows run straight across from the landing near the west rim to the boss near the east,
   every place's map facing the bowl's north (up 90), lane 0 the southern, and each node's exits run south to north
   in the order of its neighbours.
   The clock (owner, 8.10): a day per arrival, backtracking included; the landing is day 1 (RL-R2: the owner dropped
   the deadline; the day still drives the forecast and the shops' stock). The map shows the
   next row from where you stand, the row after as '?', and the boss always (run.reveal). Each node has a forecast by
   day, rolled from its biome's climate on a stream of its own per day (logic/weather.js weatherPick).
   Numbering: the map's nodes are 0..n-1, row by row, lane by lane (run.path, a node's `to`, the seeds); the run's world
   puts Copperleaf first, so map node i is world node i + 1 (saveData.trip.node, run.forecast).
   Logic only: no DOM, runs in Node (tools/test/run-map.test.mjs). It reads no game data: every table comes in as an
   argument, so the data check can use it too. */
/** @import { Run, RunMap, RunNode, SaveData } from '../../types/save-data' */
/** @import { NodeType, RivalRules, RunMapRules } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import { rngFrom } from './rng.js';
import { weatherPick } from './weather.js';
import { RUN_DAYS } from './run-state.js';
import { runZoneOf } from './run-region.js';
import { runSideAdd, runSideLinked, runSideMain } from './run-side.js';
/* eslint-disable no-func-assign */
expose({
  RUN_BOWL: [() => RUN_BOWL],
  RUN_EXIT_T: [() => RUN_EXIT_T],
  // @ts-expect-error -- replaced on purpose
  runArrive: [() => runArrive, v => (runArrive = v)],
  runBack: [() => runBack],
  // @ts-expect-error -- replaced on purpose
  runExits: [() => runExits, v => (runExits = v)],
  // @ts-expect-error -- replaced on purpose
  runForecastFill: [() => runForecastFill, v => (runForecastFill = v)],
  // @ts-expect-error -- replaced on purpose
  runMapMake: [() => runMapMake, v => (runMapMake = v)],
  // @ts-expect-error -- replaced on purpose
  runMapNoTwoShops: [() => runMapNoTwoShops, v => (runMapNoTwoShops = v)],
  runMapNode: [() => runMapNode],
  // @ts-expect-error -- replaced on purpose
  runMapRival: [() => runMapRival, v => (runMapRival = v)],
  // @ts-expect-error -- replaced on purpose
  runMapRows: [() => runMapRows, v => (runMapRows = v)],
  // @ts-expect-error -- replaced on purpose
  runMapRowsFit: [() => runMapRowsFit, v => (runMapRowsFit = v)],
  // @ts-expect-error -- replaced on purpose
  runMapStart: [() => runMapStart, v => (runMapStart = v)],
  runNext: [() => runNext],
  runNodeSeed: [() => runNodeSeed],
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
 * by row and lane), so changing one rule moves only what it rules. RL-R1: with the region's zones in the rules (M.zones,
 * logic/run-region.js), each row is its zone's biome on both lanes and each node knows its zone; the links are the same
 * across a zone's edge as inside it, so every place of a zone's last row leads into the next zone
 * @param {string} seed @param {Record<string, NodeType>} nodeTypes @param {RunMapRules} M @returns {RunMap} */
export function runMapMake(seed, nodeTypes, M) {
  if (!runMapRowsFit(M)) throw new Error(`runMapMake: ${M.rows} rows can't hold ${M.minibosses} mini-bosses`);
  /* RL-R1: the region's zones, when it has them, give each row its biome (and the rows add up to the map's) */
  const zones = M.zones && M.zones.length ? M.zones : null;
  if (zones && zones.reduce((n, z) => n + z.rows, 0) !== M.rows)
    throw new Error(`runMapMake: the zones' rows don't add up to the map's ${M.rows}`);
  const roles = runMapRows(M),
    fill = Object.fromEntries(Object.entries(nodeTypes).map(([k, t]) => [k, t.weight || 0])),
    /* RL-14: the types a free node becomes by a chance of their own (a scrapyard), in order */
    rare = Object.keys(nodeTypes)
      .sort()
      .filter(k => (nodeTypes[k].chance || 0) > 0),
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
        drawn = role
          ? byRole[/** @type {keyof typeof byRole} */ (role)]
          : rngFrom(seed, `map|type|${row}|${lane}`).pick(fill),
        /* RL-14: a free node from a type's row on becomes it by its chance, each on a stream of its own, so every
           other node keeps the type it drew */
        type =
          (!role &&
            rare.find(
              k =>
                row >= (nodeTypes[k].fromRow || 0) &&
                rngFrom(seed, `map|${k}|${row}|${lane}`).chance(/** @type {number} */ (nodeTypes[k].chance))
            )) ||
          drawn,
        zone = zones ? runZoneOf(zones, row) : -1,
        biome = zones ? zones[zone].biome : rngFrom(seed, `map|biome|${row}|${lane}`).pick(M.biomes);
      at[row].push(nodes.length);
      nodes.push(
        zones ? { type, row, lane, to: [], seen: 0, biome, zone } : { type, row, lane, to: [], seen: 0, biome }
      );
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
  runMapNoTwoShops(seed, nodeTypes, roles, nodes);
  return { nodes };
}
/** RL-12b: never two places that sell things (nodeTypes' `shop`: a town, a stall) one after the other. Going row by row,
 * a shop led to from a shop is drawn again from the types that don't sell (its own stream, 'map|calm|row|lane'); when
 * it is a role row's town (before a mini-boss), the free row's shop before it is drawn again instead. Role rows' shops
 * never meet (a town row is followed by its mini-boss) @param {string} seed @param {Record<string, NodeType>} nodeTypes
 * @param {string[]} roles @param {RunNode[]} nodes */
export function runMapNoTwoShops(seed, nodeTypes, roles, nodes) {
  const shop = (/** @type {string} */ k) => !!(nodeTypes[k] && nodeTypes[k].shop),
    calm = Object.fromEntries(
      Object.entries(nodeTypes)
        .filter(([k, t]) => !shop(k) && (t.weight || 0) > 0)
        .map(([k, t]) => [k, /** @type {number} */ (t.weight)])
    );
  if (!Object.keys(calm).length) return;
  const redraw = (/** @type {RunNode} */ n) => {
    n.type = rngFrom(seed, `map|calm|${n.row}|${n.lane}`).pick(calm);
  };
  nodes.forEach((n, j) => {
    if (!shop(n.type)) return;
    for (const i of nodes.flatMap((p, k) => (p.to.includes(j) ? [k] : []))) {
      if (!shop(nodes[i].type)) continue;
      if (roles[n.row] === '') {
        redraw(n);
        return;
      }
      if (roles[nodes[i].row] === '') redraw(nodes[i]);
    }
  });
}
/** RL-S2: where Blake waits (rules.json run.rival): `meet` meetings a run by Expedition (index 0 = Expedition I; past
 * the end, the last), meeting k on a main-path place in band k of the first type in `on` the band has (a route, else a waystation) (the row's share of the map, [from, to)), one meeting a
 * row (the side area's places too may hold him: the main path stays the same with or without a side area). Each meeting draws on its own stream, 'map|rival|k';
 * a band with no route has no meeting. Turns the nodes' type to 'rival' and returns their indices
 * @param {string} seed @param {RunMap} map @param {RivalRules} R @param {number} expedition @returns {number[]} */
export function runMapRival(seed, map, R, expedition) {
  const n = R.meet[Math.min(Math.max(1, expedition || 1), R.meet.length) - 1] || 0,
    nodes = map.nodes,
    main = nodes.filter(nd => !nd.side),
    rows = main.reduce((m, nd) => Math.max(m, nd.row), 0) + 1,
    /** @type {number[]} */
    out = [];
  for (let k = 0; k < n && k < R.bands.length; k++) {
    const [lo, hi] = R.bands[k],
      at = (/** @type {string} */ type) =>
        nodes.flatMap((nd, i) =>
          !nd.side &&
          nd.type === type &&
          nd.row / rows >= lo &&
          nd.row / rows < hi &&
          !out.some(j => nodes[j].row === nd.row)
            ? [i]
            : []
        ),
      can = R.on.map(at).find(c => c.length) || [];
    if (!can.length) continue;
    const i = can[rngFrom(seed, 'map|rival|' + k).int(0, can.length - 1)];
    nodes[i].type = 'rival';
    out.push(i);
  }
  return out;
}
/** the nodes a node leads to (forward, by its east side) @param {RunMap} map @param {number} i @returns {number[]} */
export const runNext = (map, i) => map.nodes[i].to.slice();
/** the nodes that lead to a node (back, by its west side) @param {RunMap} map @param {number} i @returns {number[]} */
export const runBack = (map, i) => map.nodes.flatMap((n, j) => (n.to.includes(i) ? [j] : []));
/** where links meet a side of a scene: one in the middle, two at a quarter and three quarters (56 m apart on a 112 m
 * run scene; the seam rules want 44 m) */
export const RUN_EXIT_T = [
  [],
  [0.5],
  [0.15625, 0.84375],
]; /* 10 m and 54 m along a 64 m edge: whole metres, 44 m apart */
/** a node's exits, by lane (south first): ahead to the nodes it leads to, back to the ones that lead to it
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
/** where a run's map sits on the bowl (RL-8b, the owner: the run across the whole bowl, on land of its own; Copperleaf
 * isn't on it): its rows from the landing at -x west of the centre to the boss at x east of it (WM-1: runs go west to
 * east), `step` apart at most
 * (bowl radii; a 9-row map spans the whole width), the line bowed `bend` north in the middle; two lanes `lane` apart
 * north and south of it, lane 0 the southern. Every place's map faces the bowl's north (up 90), so a run's places read
 * west to east on the map as they are walked. RL-R2: a side area's places `side` lanes north of the line */
export const RUN_BOWL = { x: 0.72, step: 0.18, lane: 0.1, bend: 0.06, side: 2 };
/** a node's spot on the bowl ({a, r, up} as locations.json "bowl"), worked out from its row and lane, never stored
 * @param {RunMap} map @param {number} i @returns {{ a: number, r: number, up: number }} */
export function runSpot(map, i) {
  const node = map.nodes[i],
    main = map.nodes.filter(runSideMain),
    rows = 1 + Math.max(...main.map(n => n.row)),
    step = rows > 1 ? Math.min(RUN_BOWL.step, (2 * RUN_BOWL.x) / (rows - 1)) : 0,
    S = map.side;
  /* RL-R2: a side area's places north of the main path: a detour's spread between its obstacle's row and the next,
     an alternate path's on their own rows, RUN_BOWL.side lanes north of the line */
  let x, y;
  if (node.side && S) {
    const k = S.nodes.indexOf(i),
      from = map.nodes[S.from],
      x0 = (from.row - (rows - 1) / 2) * step;
    x = S.kind === 'detour' ? x0 + ((k + 1) * step) / (S.nodes.length + 1) : (node.row - (rows - 1) / 2) * step;
    y = RUN_BOWL.bend * Math.cos((x / RUN_BOWL.x) * (Math.PI / 2)) + RUN_BOWL.side * RUN_BOWL.lane;
  } else {
    const width = main.filter(n => n.row === node.row).length;
    x = (node.row - (rows - 1) / 2) * step;
    y = RUN_BOWL.bend * Math.cos((x / RUN_BOWL.x) * (Math.PI / 2)) + (node.lane - (width - 1) / 2) * RUN_BOWL.lane;
  }
  const a = (Math.atan2(y, x) * 180) / Math.PI;
  return { a: Math.round((a < 0 ? a + 360 : a) * 1e9) / 1e9, r: Math.hypot(x, y), up: 90 };
}
/** the run's world node of a map node (Copperleaf is world node 0) @param {number} i */
export const runWorldNode = i => i + 1;
/** the map node of a run's world node (-1 for Copperleaf) @param {number} node */
export const runMapNode = node => node - 1;

/* ---------- the clock (owner, 8.10): a day per arrival, backtracking included; the landing is day 1 ---------- */
/** show the map from a row: the rows up to `icons` ahead with their type, the rows up to `unknown` ahead as '?', the
 * boss always (the goal). What was shown stays shown @param {RunMap} map @param {number} row
 * @param {{ icons: number, unknown: number }} reveal */
export function runReveal(map, row, reveal) {
  const last = Math.max(...map.nodes.map(n => n.row));
  /* RL-R2: a side area's places show once its obstacle is open (run-side.js runSideOpen), not by row */
  for (const n of map.nodes.filter(runSideMain)) {
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
 *   rules: { map: RunMapRules, clock: { ahead: number }, reveal: { icons: number, unknown: number }, rival?: RivalRules },
 *   side?: import('./run-side.js').RunSideData | null }} RunMapData
 * RL-R2: side, what the run's side area is made from (run-start.js; none: no side area)
 */
/** give a new run its map (at the mast, before the flight): the map from the seed, the landing's view and the
 * forecast a week ahead @param {Run} run @param {RunMapData} data @returns {RunMap} */
export function runMapStart(run, data) {
  run.map = runMapMake(run.seed, data.nodeTypes, data.rules.map);
  /* RL-R2: its side area, from streams of its own after the main map (run-side.js) */
  if (data.side) runSideAdd(run.seed, run.map, data.side);
  /* RL-S2: Blake, on streams of his own after the side area, so neither moves */
  if (data.rules.rival) runMapRival(run.seed, run.map, data.rules.rival, run.expedition);
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
    linked =
      here < 0
        ? map.nodes[i].row === 0 && runSideMain(map.nodes[i])
        : runNext(map, here).includes(i) || runBack(map, here).includes(i) || runSideLinked(map, here, i);
  if (!linked) return 0;
  /* the run's first arrival is day 1; every later one costs a day */
  if (run.path.length) run.clock = Math.min(RUN_DAYS, run.clock + 1);
  run.path.push(i);
  s.trip.node = runWorldNode(i);
  /* RL-R2: in a side area the main path shows as from the row it comes back to */
  runReveal(
    map,
    map.nodes[i].side && map.side && map.side.to >= 0 ? map.nodes[map.side.to].row - 1 : map.nodes[i].row,
    data.rules.reveal
  );
  runForecastFill(run, data.biomes, run.clock + data.rules.clock.ahead);
  return run.clock;
}

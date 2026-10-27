// @ts-check
'use strict';
/* ================= THE RUN MAP AND ITS CLOCK (roguelite track RL-6; region map track WM-2) =================
   A run's node map, made from its seed (roguelite-track.md 2e; worldmap-track.md WM-2): steps (`row`) from the landing
   (row 0, where the airship sets you down) to the boss (the last row), one or two nodes a step, links only to the next
   step, so every path is as long as the map has rows. WM-2: how long that is comes from the rules (rules.json
   run.map.path by Expedition, runMapLength), and so do the leaders: as many mini-bosses as fit within run.map.towns,
   each with a town right after it (the town is the reward), at least one free step before each mini-boss and before
   the boss. The free step right before a mini-boss is route-like on every lane (nodeTypes.json routeLike: a route,
   the rival's, a scrapyard; a mini-boss counts too), so every path has at least two route-like places between towns.
   Mini-boss rows and the boss row hold one node, so every path meets them. The other rows take a filler type by
   weight (nodeTypes.json; WM-2: towns weigh nothing, they come after leaders only); RL-14: a type with a chance
   instead (a scrapyard) takes a free node by it, from its fromRow on.
   WM-2, the region grid: every main node also has a footprint on a coarse grid (RUN_GRID: cells about 64 m, x east, y
   north), `at` its south-west cell and `size` its cells (every place 2 x 1, a route's, until WM-3). A link joins two
   footprints that share an edge, going east, north or south from the node to the one it leads to, never west
   (runLinkDir); the landing's two links go one north (up) and one east (right). Links can't cross, as footprints
   don't overlap. Until WM-3 the scenes and the bowl don't read the grid: a link still leaves its node by the east side
   and arrives by the next node's west (the owner, WM-1: runs go west to east), one
   link at t 0.5, two at 0.15625 and 0.84375, 10 m and 54 m along (the seam rules allow two exits a side, 44 m apart, logic/seam-rules.js, and an
   east or west edge is 64 m), so a node has at most two links each way. runExits' `ahead` is the way east,
   `back` the way west. Two lanes run straight, split, merge, or switch once (one diagonal, never two).
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
/** @import { GhostRules, NodeType, RivalRules, RunMapRules } from '../../types/game-data' */
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
  RUN_GRID: [() => RUN_GRID],
  // @ts-expect-error -- replaced on purpose
  runArrive: [() => runArrive, v => (runArrive = v)],
  runBack: [() => runBack],
  // @ts-expect-error -- replaced on purpose
  runExits: [() => runExits, v => (runExits = v)],
  // @ts-expect-error -- replaced on purpose
  runForecastFill: [() => runForecastFill, v => (runForecastFill = v)],
  runGridOverlap: [() => runGridOverlap],
  // @ts-expect-error -- replaced on purpose
  runGridSide: [() => runGridSide, v => (runGridSide = v)],
  // @ts-expect-error -- replaced on purpose
  runLinkDir: [() => runLinkDir, v => (runLinkDir = v)],
  // @ts-expect-error -- replaced on purpose
  runMapGhost: [() => runMapGhost, v => (runMapGhost = v)],
  // @ts-expect-error -- replaced on purpose
  runMapGrid: [() => runMapGrid, v => (runMapGrid = v)],
  // @ts-expect-error -- replaced on purpose
  runMapLength: [() => runMapLength, v => (runMapLength = v)],
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
/** what a row holds: the landing ('first'), the boss ('last'), a mini-boss ('guard'), the town right after one
 * ('rest'; WM-2: the leader first, the town its reward), or a filler (''). The free rows are shared out evenly between
 * the gaps before each mini-boss and before the boss, one at least each (runMapRowsFit says whether they can be)
 * @param {RunMapRules} M @returns {string[]} */
export function runMapRows(M) {
  const rows = /** @type {string[]} */ (Array(M.rows).fill('')),
    T = M.minibosses,
    free = M.rows - 2 - 2 * T;
  if (T > 0 && free >= T + 1)
    for (let k = 0, at = 0; k < T; k++) {
      at += Math.round(((k + 1) * free) / (T + 1)) - Math.round((k * free) / (T + 1));
      rows[at + 1] = 'guard';
      rows[at + 2] = 'rest';
      at += 2;
    }
  rows[0] = 'first';
  rows[M.rows - 1] = 'last';
  return rows;
}
/** whether the rows can be laid out: every mini-boss on a row of its own with its town right after, a free row at
 * least after the landing's, before each mini-boss and before the boss @param {RunMapRules} M @returns {boolean} */
export function runMapRowsFit(M) {
  return (
    Number.isInteger(M.rows) &&
    Number.isInteger(M.minibosses) &&
    M.minibosses >= 0 &&
    M.rows >= 3 &&
    M.rows - 2 - 2 * M.minibosses >= M.minibosses + 1
  );
}
/** WM-2: a run's places a path and its mini-bosses: the rows drawn from run.map.path's range for the Expedition
 * (index 0 = Expedition I; past the end, the last) on the stream 'map|path', unless the rules give them (the debug
 * menu's short map); as many mini-bosses (each with its town) as fit them, within run.map.towns, unless given
 * @param {string} seed @param {RunMapRules} M @param {number} [expedition] @returns {{ rows: number, minibosses: number }} */
export function runMapLength(seed, M, expedition) {
  const P = M.path || [],
    span = P[Math.min(Math.max(1, expedition || 1), P.length) - 1],
    rows = M.rows || (span ? rngFrom(seed, 'map|path').int(span[0], span[1]) : 0),
    [lo, hi] = M.towns || [0, 0],
    minibosses = M.minibosses !== undefined ? M.minibosses : Math.max(lo, Math.min(hi, Math.floor((rows - 3) / 3)));
  return { rows, minibosses };
}
/** WM-2: the region grid: cells `cell` metres square (x east, y north), a place's footprint `place` cells (every one
 * a route's 2 x 1 until WM-3), the main path within `half` cells north and south of the landing's row; `tries`, how
 * many footprints the layout search may try before it gives up on a map's lane switches */
export const RUN_GRID = { cell: 64, place: [2, 1], half: 3, tries: 4000 };
/** the side footprint b lies on from footprint a: 'E', 'W', 'N' or 'S' when they share an edge (a cell of it at
 * least), '' when they don't touch @param {{ at: number[], size: number[] }} a @param {{ at: number[], size: number[] }} b */
export function runGridSide(a, b) {
  const [ax, ay] = a.at,
    [aw, ah] = a.size,
    [bx, by] = b.at,
    [bw, bh] = b.size,
    xs = bx < ax + aw && ax < bx + bw,
    ys = by < ay + ah && ay < by + bh;
  if (ys && bx === ax + aw) return 'E';
  if (ys && bx + bw === ax) return 'W';
  if (xs && by === ay + ah) return 'N';
  if (xs && by + bh === ay) return 'S';
  return '';
}
/** whether two footprints overlap @param {{ at: number[], size: number[] }} a @param {{ at: number[], size: number[] }} b */
export const runGridOverlap = (a, b) =>
  a.at[0] < b.at[0] + b.size[0] &&
  b.at[0] < a.at[0] + a.size[0] &&
  a.at[1] < b.at[1] + b.size[1] &&
  b.at[1] < a.at[1] + a.size[1];
/** the way a link leaves node i for node j on the grid ('E', 'N' or 'S'; '' for a place with no footprint: a side
 * area's, or a run's from before WM-2) @param {RunMap} map @param {number} i @param {number} j */
export function runLinkDir(map, i, j) {
  const a = map.nodes[i],
    b = map.nodes[j];
  return a && b && a.at && a.size && b.at && b.size ? runGridSide(/** @type {any} */ (a), /** @type {any} */ (b)) : '';
}
/** WM-2: lay the main path's nodes out on the grid: the landing at (0, 0), then each node, row by row and lane by
 * lane, on a footprint by every node that leads to it (east, north or south of each, never west of its west edge),
 * on none already taken, within RUN_GRID.half of the landing's row, lane 0 south of lane 1; the landing's two links
 * one east (lane 0) and one north (lane 1). A seeded search: each node tries its spots in an order drawn on the stream
 * 'map|grid|row|lane|spot' (east twice as likely as north or south, half as likely again away from the landing's row)
 * and steps back when the next can't be placed.
 * Sets `at` and `size` on the nodes and returns true, or false (nothing set) when the search gives up
 * @param {string} seed @param {RunNode[]} nodes @returns {boolean} */
export function runMapGrid(seed, nodes) {
  const size = RUN_GRID.place,
    H = RUN_GRID.half,
    from = nodes.map((_, i) => nodes.flatMap((p, k) => (p.to.includes(i) ? [k] : []))),
    /** @type {({ at: number[], size: number[] } | null)[]} */
    put = nodes.map(() => null),
    W = { E: 2, N: 1, S: 1 };
  let tries = 0;
  /** the spots node i can take, best first @param {number} i */
  const spots = i => {
    const n = nodes[i];
    if (!from[i].length) return [[0, 0]];
    const p = /** @type {{ at: number[], size: number[] }} */ (put[from[i][0]]),
      [px, py] = p.at,
      [pw, ph] = p.size,
      [w, h] = size,
      /** @type {[string, number, number][]} */
      can = [];
    for (let y = py - h + 1; y <= py + ph - 1; y++) can.push(['E', px + pw, y]);
    for (let x = px; x <= px + pw - 1; x++) can.push(['N', x, py + ph], ['S', x, py - h]);
    return can
      .map(([d, x, y]) => ({
        x,
        y,
        k:
          rngFrom(seed, `map|grid|${n.row}|${n.lane}|${d}|${x - px}|${y - py}`).next() **
          (1 / (W[/** @type {'E'} */ (d)] * (d === 'N' && py > 0 ? 0.5 : d === 'S' && py < 0 ? 0.5 : 1))),
      }))
      .sort((a, b) => b.k - a.k)
      .map(c => [c.x, c.y]);
  };
  /** whether node i may stand on f @param {number} i @param {{ at: number[], size: number[] }} f */
  const fits = (i, f) => {
    const n = nodes[i];
    if (f.at[1] < -H || f.at[1] + f.size[1] - 1 > H) return false;
    for (let j = 0; j < i; j++) if (put[j] && runGridOverlap(/** @type {any} */ (put[j]), f)) return false;
    for (const k of from[i]) {
      const p = /** @type {{ at: number[], size: number[] }} */ (put[k]),
        side = runGridSide(p, f);
      if (!side || side === 'W' || f.at[0] < p.at[0]) return false;
      if (nodes[k].row === 0 && side !== (n.lane === 0 ? 'E' : 'N')) return false;
    }
    const south = nodes.findIndex((m, j) => j < i && m.row === n.row && m.lane === n.lane - 1);
    return !(south >= 0 && put[south] && /** @type {any} */ (put[south]).at[1] >= f.at[1]);
  };
  /** @param {number} i @returns {boolean} */
  const place = i => {
    if (i >= nodes.length) return true;
    for (const [x, y] of spots(i)) {
      if (++tries > RUN_GRID.tries) return false;
      const f = { at: [x, y], size: size.slice() };
      if (!fits(i, f)) continue;
      put[i] = f;
      if (place(i + 1)) return true;
      put[i] = null;
    }
    return false;
  };
  if (!place(0)) return false;
  nodes.forEach((n, i) => {
    const f = /** @type {{ at: number[], size: number[] }} */ (put[i]);
    n.at = /** @type {[number, number]} */ (f.at);
    n.size = /** @type {[number, number]} */ (f.size);
  });
  return true;
}
/** the map for a seed. Each choice draws from a stream of its own (a row's shape, a node's type, a node's biome, keyed
 * by row and lane), so changing one rule moves only what it rules. RL-R1: with the region's zones in the rules (M.zones,
 * logic/run-region.js), each row is its zone's biome on both lanes and each node knows its zone; the links are the same
 * across a zone's edge as inside it, so every place of a zone's last row leads into the next zone. WM-2: every main
 * node's footprint on the grid (runMapGrid). M.rows and M.minibosses are the run's (runMapLength); rules without rows
 * (rules.json's own) draw them as Expedition I's
 * @param {string} seed @param {Record<string, NodeType>} nodeTypes @param {RunMapRules} rules @returns {RunMap} */
export function runMapMake(seed, nodeTypes, rules) {
  const M = rules.rows ? rules : { ...rules, ...runMapLength(seed, rules, 1) };
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
    /* WM-2: the row after the landing has both lanes (the landing's two exits, north and east) */
    return { width: (role === '' || role === 'rest') && (wide || row === 1) ? 2 : 1, cross, west };
  });
  /* WM-2: the types that count as a route between towns, by weight (every lane of the free row before a mini-boss
     is one) */
  const road = Object.fromEntries(Object.entries(fill).filter(([k]) => nodeTypes[k].routeLike));
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
        /* WM-2: on the free row before a mini-boss, a type that isn't route-like is drawn again from those that
           are (its own stream), so every path has two route-like places at least between towns */
        kind =
          !role &&
          roles[row + 1] === 'guard' &&
          !(nodeTypes[type] || {}).routeLike &&
          Object.values(road).some(w => w > 0)
            ? rngFrom(seed, `map|road|${row}|${lane}`).pick(road)
            : type,
        zone = zones ? runZoneOf(zones, row) : -1,
        biome = zones ? zones[zone].biome : rngFrom(seed, `map|biome|${row}|${lane}`).pick(M.biomes);
      at[row].push(nodes.length);
      nodes.push(
        zones
          ? { type: kind, row, lane, to: [], seen: 0, biome, zone }
          : { type: kind, row, lane, to: [], seen: 0, biome }
      );
    }
  });
  /* the links, then their layout on the grid (WM-2); when the grid can't hold the map's lane switches, the map is
     linked again without them (nothing else changes) */
  for (const switches of [true, false]) {
    for (const n of nodes) n.to = [];
    for (let row = 0; row + 1 < at.length; row++) {
      const here = at[row],
        next = at[row + 1],
        link = (/** @type {number} */ a, /** @type {number} */ b) => nodes[here[a]].to.push(next[b]);
      if (here.length === 1) next.forEach((_, b) => link(0, b));
      else if (next.length === 1) here.forEach((_, a) => link(a, 0));
      else {
        link(0, 0);
        link(1, 1);
        if (switches && shape[row].cross) shape[row].west ? link(1, 0) : link(0, 1);
      }
    }
    for (const n of nodes) n.to.sort((a, b) => a - b);
    if (runMapGrid(seed, nodes)) break;
    if (!switches) throw new Error(`runMapMake: seed ${seed}'s map doesn't fit the grid`);
  }
  runMapNoTwoShops(seed, nodeTypes, roles, nodes);
  return { nodes };
}
/** RL-12b: never two places that sell things (nodeTypes' `shop`: a town, a stall) one after the other. Going row by row,
 * a shop led to from a shop is drawn again from the types that don't sell (its own stream, 'map|calm|row|lane'); when
 * it is a role row's town, the free row's shop before it is drawn again instead (WM-2: a town comes after its
 * mini-boss, so that is a free row's shop after it). Role rows' shops never meet (a town row follows a mini-boss) @param {string} seed @param {Record<string, NodeType>} nodeTypes
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
/** ON-2: where a friend's ghost waits (rules.json run.ghost): one main-path place of the first type in `on` the band
 * has (the band a share of the map's rows, [from, to)), else one of the `spare` type on a row that keeps another
 * (a town beside a town: the road through the ghost skips that town), drawn on its own stream 'map|ghost'. Blake keeps his places;
 * the ghost may stand beside him on a row (the road picks one). Turns the node's type to 'ghost' and returns its
 * index (-1: no place fits)
 * @param {string} seed @param {RunMap} map @param {GhostRules} R @returns {number} */
export function runMapGhost(seed, map, R) {
  const nodes = map.nodes,
    rows = nodes.filter(nd => !nd.side).reduce((m, nd) => Math.max(m, nd.row), 0) + 1,
    at = (/** @type {string} */ type) =>
      nodes.flatMap((nd, i) =>
        !nd.side && nd.type === type && nd.row / rows >= R.band[0] && nd.row / rows < R.band[1] ? [i] : []
      ),
    /* none: a place of the `spare` type on a row that keeps another of it (a town beside a town) */
    spare = R.spare
      ? at(R.spare).filter(i =>
          nodes.some((nd, j) => j !== i && !nd.side && nd.row === nodes[i].row && nd.type === R.spare)
        )
      : [],
    can = R.on.map(at).find(c => c.length) || spare;
  if (!can.length) return -1;
  const i = can[rngFrom(seed, 'map|ghost').int(0, can.length - 1)];
  nodes[i].type = 'ghost';
  return i;
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
 *   rules: { map: RunMapRules, clock: { ahead: number }, reveal: { icons: number, unknown: number }, rival?: RivalRules,
 *     ghost?: GhostRules },
 *   side?: import('./run-side.js').RunSideData | null, ghost?: boolean }} RunMapData
 * RL-R2: side, what the run's side area is made from (run-start.js; none: no side area); ON-2: ghost, whether a
 * friend's ghost waits on the map (run-start.js; then rules.ghost places it)
 */
/** give a new run its map (at the mast, before the flight): the map from the seed, the landing's view and the
 * forecast a week ahead @param {Run} run @param {RunMapData} data @returns {RunMap} */
export function runMapStart(run, data) {
  run.map = runMapMake(run.seed, data.nodeTypes, data.rules.map);
  /* RL-R2: its side area, from streams of its own after the main map (run-side.js) */
  if (data.side) runSideAdd(run.seed, run.map, data.side);
  /* RL-S2: Blake, on streams of his own after the side area, so neither moves */
  if (data.rules.rival) runMapRival(run.seed, run.map, data.rules.rival, run.expedition);
  /* ON-2: a friend's ghost, after Blake, on a stream of its own: a run without one has the same map */
  if (data.ghost && data.rules.ghost) runMapGhost(run.seed, run.map, data.rules.ghost);
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

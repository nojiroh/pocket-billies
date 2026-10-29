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
   WM-2, the region grid: every main node also has a footprint on a coarse grid (RUN_GRID: 64 m cells, x east, y
   north), `at` its south-west cell and `size` its cells. A link joins two footprints that share an edge, going east,
   north or south from the node to the one it leads to, never west (runLinkDir); the landing's two links go one north
   (up) and one east (right). Links can't cross, as footprints don't overlap. WM-3: a footprint's size is its type's
   shape (nodeTypes.json `shapes`: a route 2 x 1, 3 x 1, a north-going 1 x 2 or 1 x 3, or an L; a waystation 1 x 1),
   and each link crosses its edge at a spot of its own (`ways`, runGridWays: a whole metre on the cells both share, 12
   m from their ends, 44 m from another exit on either side, the seam rules' gap); an L is two by two with the corner
   its road turns away from walled off (`cut`, runGridCut). A place is made at its footprint's size with its exits
   where its links cross (runGridExits; logic/run-scenes.js), so the walk's joins are the grid's. A run's map from
   before WM-3 has no `ways`: its links leave by the east side and arrive by the next node's west (WM-1: runs go west
   to east), one at t 0.5, two at 0.15625 and 0.84375 (runExits), its places 112 x 64. A node has at most two links
   each way. Two lanes run straight, split, merge, or switch once (one diagonal, never two).
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
import { fxRunRule, provide } from '../hooks.js';
import { rngFirst, rngFrom } from './rng.js';
import { weatherPick } from './weather.js';
import { RUN_DAYS } from './run-state.js';
import { runZoneOf } from './run-region.js';
import { runSideAdd, runSideLinked, runSideMain } from './run-side.js';
/* eslint-disable no-func-assign */
expose({
  RUN_BOWL: [() => RUN_BOWL],
  RUN_BOWL_GRID: [() => RUN_BOWL_GRID],
  RUN_EXIT_T: [() => RUN_EXIT_T],
  RUN_GRID: [() => RUN_GRID],
  // @ts-expect-error -- replaced on purpose
  runArrive: [() => runArrive, v => (runArrive = v)],
  runBack: [() => runBack],
  // @ts-expect-error -- replaced on purpose
  runExits: [() => runExits, v => (runExits = v)],
  // @ts-expect-error -- replaced on purpose
  runForecastDays: [() => runForecastDays, v => (runForecastDays = v)],
  // @ts-expect-error -- replaced on purpose
  runForecastFill: [() => runForecastFill, v => (runForecastFill = v)],
  // @ts-expect-error -- replaced on purpose
  runGridCut: [() => runGridCut, v => (runGridCut = v)],
  // @ts-expect-error -- replaced on purpose
  runGridExits: [() => runGridExits, v => (runGridExits = v)],
  // @ts-expect-error -- replaced on purpose
  runGridLinks: [() => runGridLinks, v => (runGridLinks = v)],
  runGridOverlap: [() => runGridOverlap],
  runGridPoint: [() => runGridPoint],
  // @ts-expect-error -- replaced on purpose
  runGridShared: [() => runGridShared, v => (runGridShared = v)],
  // @ts-expect-error -- replaced on purpose
  runGridSide: [() => runGridSide, v => (runGridSide = v)],
  // @ts-expect-error -- replaced on purpose
  runGridTurn: [() => runGridTurn, v => (runGridTurn = v)],
  // @ts-expect-error -- replaced on purpose
  runGridWays: [() => runGridWays, v => (runGridWays = v)],
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
  runRevealAll: [() => runRevealAll, v => (runRevealAll = v)],
  runSegDist: [() => runSegDist],
  // @ts-expect-error -- replaced on purpose
  runShapeSize: [() => runShapeSize, v => (runShapeSize = v)],
  // @ts-expect-error -- replaced on purpose
  runSideLay: [() => runSideLay, v => (runSideLay = v)],
  // @ts-expect-error -- replaced on purpose
  runSpot: [() => runSpot, v => (runSpot = v)],
  // @ts-expect-error -- replaced on purpose
  runSpotAt: [() => runSpotAt, v => (runSpotAt = v)],
  // @ts-expect-error -- replaced on purpose
  runSpotBoxes: [() => runSpotBoxes, v => (runSpotBoxes = v)],
  // @ts-expect-error -- replaced on purpose
  runSpotCells: [() => runSpotCells, v => (runSpotCells = v)],
  // @ts-expect-error -- replaced on purpose
  runSpotOutline: [() => runSpotOutline, v => (runSpotOutline = v)],
  // @ts-expect-error -- replaced on purpose
  runTownSize: [() => runTownSize, v => (runTownSize = v)],
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
 * menu's short map); as many mini-bosses (each with its town) as fit them, within run.map.towns, unless given; WM-5:
 * and their towns' sizes in order (run.map.townSizes by Expedition and town count; none without the table)
 * @param {string} seed @param {RunMapRules} M @param {number} [expedition]
 * @returns {{ rows: number, minibosses: number, sizes?: string[] }} */
export function runMapLength(seed, M, expedition) {
  const P = M.path || [],
    span = P[Math.min(Math.max(1, expedition || 1), P.length) - 1],
    rows = M.rows || (span ? rngFrom(seed, 'map|path').int(span[0], span[1]) : 0),
    [lo, hi] = M.towns || [0, 0],
    minibosses = M.minibosses !== undefined ? M.minibosses : Math.max(lo, Math.min(hi, Math.floor((rows - 3) / 3)));
  /* WM-5: the towns' sizes in order (run.map.townSizes by Expedition and how many towns), unless given */
  const O = M.townSizes && M.townSizes.order,
    by = O && O.length ? O[Math.min(Math.max(1, expedition || 1), O.length) - 1] : null,
    sizes = M.sizes || (by && by[String(minibosses)]);
  return sizes ? { rows, minibosses, sizes: sizes.slice() } : { rows, minibosses };
}
/** WM-5: a town node's size (a name of run.map.townSizes.cells, smallest first): the one whose cells its footprint
 * has, else the smallest (a side area's town, which has no footprint, or a run's from before WM-5b: 2 x 1); '' without
 * the table @param {RunNode} node @param {RunMapRules['townSizes']} [T] */
export function runTownSize(node, T) {
  const C = T && T.cells;
  if (!C) return '';
  const names = Object.keys(C),
    s = node.size;
  return (s && names.find(k => C[k][0] === s[0] && C[k][1] === s[1])) || names[0] || '';
}
/** WM-2: the region grid: cells `cell` metres square (x east, y north), the main path within `half` cells north and
 * south of the landing's row; `tries`, how many footprints the layout search may try before it gives up on a map's
 * lane switches. WM-3: a place's footprint is its type's shape (nodeTypes.json `shapes`, runShapeSize), `place` cells
 * when it has none or its shape doesn't fit; an exit stands `edge` metres at least from a corner of its side and `gap`
 * metres at least from another exit on that side (the seam rules' 44 m, logic/seam-rules.js) */
export const RUN_GRID = { cell: 64, place: [2, 1], half: 3, tries: 6000, edge: 12, gap: 44 };
/** WM-3: a shape's cells: 'WxH' (wide x tall), or 'L', two by two with a corner cut off (runGridCut) @param {string} id
 * @returns {[number, number]} */
export function runShapeSize(id) {
  if (id === 'L') return [2, 2];
  const m = /^([1-4])x([1-4])$/.exec(id || '');
  return m ? [+m[1], +m[2]] : /** @type {[number, number]} */ (RUN_GRID.place.slice());
}
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
/** WM-3: the cells along the edge footprints a and b share, [from, to) on the grid's axis along it (y on an east or
 * west side, x on a north or south one), or null when they share none @param {{ at: number[], size: number[] }} a
 * @param {{ at: number[], size: number[] }} b @returns {[number, number] | null} */
export function runGridShared(a, b) {
  const d = runGridSide(a, b);
  if (!d) return null;
  const k = d === 'E' || d === 'W' ? 1 : 0;
  return [Math.max(a.at[k], b.at[k]), Math.min(a.at[k] + a.size[k], b.at[k] + b.size[k])];
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
 * and steps back when the next can't be placed. WM-3: each node's footprint is its type's shape (nodeTypes.json
 * `shapes`, drawn on 'map|size|row|lane'), tried at every spot before RUN_GRID.place is; then every link's exit
 * along the edge it crosses (runGridWays) and an L's cut corner (runGridCut). WM-5: `want`, the cells a node must
 * take (a town's size), with no shape drawn and no fallback.
 * Sets `at`, `size`, `ways` (and an L's `cut`) on the nodes and returns true, or false (nothing set) when the search
 * gives up
 * @param {string} seed @param {RunNode[]} nodes @param {Record<string, NodeType>} [nodeTypes]
 * @param {(number[] | null)[]} [want] @returns {boolean} */
export function runMapGrid(seed, nodes, nodeTypes = {}, want = []) {
  const H = RUN_GRID.half,
    from = nodes.map((_, i) => nodes.flatMap((p, k) => (p.to.includes(i) ? [k] : []))),
    /** @type {({ at: number[], size: number[] } | null)[]} */
    put = nodes.map(() => null),
    /* each node's shape, and the sizes it tries in turn */
    shape = nodes.map((n, i) => {
      const S = (nodeTypes[n.type] || {}).shapes;
      if (want[i]) return '';
      return S && Object.values(S).some(w => w > 0) ? rngFrom(seed, `map|size|${n.row}|${n.lane}`).pick(S) : '';
    }),
    /* WM-5: a node given its cells (a town's size) takes them or nothing (no 2 x 1 to fall back on) */
    sizes = shape.map((s, i) => {
      const f = want[i];
      if (f) return [/** @type {[number, number]} */ ([f[0], f[1]])];
      const a = runShapeSize(s),
        b = RUN_GRID.place;
      return a[0] === b[0] && a[1] === b[1] ? [a] : [a, /** @type {[number, number]} */ (b.slice())];
    }),
    W = { E: 2, N: 1, S: 1 };
  let tries = 0;
  /** a spot's draw on 'map|grid|row|lane|spot', made once (the search asks again as it steps back) */
  const drawn = /** @type {Map<string, number>} */ (new Map()),
    draw = (/** @type {string} */ k) => {
      let v = drawn.get(k);
      if (v === undefined) drawn.set(k, (v = rngFirst(seed, `map|grid|${k}`)));
      return v;
    };
  /** the spots node i of size [w, h] can take, best first @param {number} i @param {number[]} size */
  const spots = (i, size) => {
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
    /* WM-3: after an L, the spots its road can bend to first (touching a cell diagonal to the one it comes in by) */
    const bendTo = from[i].flatMap(l =>
      shape[l] === 'L' && /** @type {any} */ (put[l]).size[0] === 2 && /** @type {any} */ (put[l]).size[1] === 2
        ? lCells(l)
        : []
    );
    return can
      .map(([d, x, y]) => ({
        x,
        y,
        k:
          draw(`${n.row}|${n.lane}|${d}|${x - px}|${y - py}`) **
            (1 /
              (W[/** @type {'E'} */ (d)] *
                (d === 'N' && py > 0 ? 0.5 : d === 'S' && py < 0 ? 0.5 : 1) *
                (d === 'E' && townish(i) ? 8 : 1))) +
          (bendTo.some(c => runGridSide({ at: c, size: [1, 1] }, { at: [x, y], size })) ? 1 : 0) +
          (shape[i] === 'L' && w === 2 && h === 2 && lIn(p, x, y, d) ? 1 : 0),
      }))
      .sort((a, b) => b.k - a.k)
      .map(c => [c.x, c.y]);
  };
  /** WM-3: does an L at (x, y) come in from p by one cell only, its south-west (from the west or the south) or its
   * north-west (from the north), so the way on (mostly east or north) can leave from the cell diagonal to it?
   * @param {{ at: number[], size: number[] }} p @param {number} x @param {number} y @param {string} d */
  const lIn = (p, x, y, d) => {
    const s = runGridShared(p, { at: [x, y], size: [2, 2] });
    return !!s && s[1] - s[0] === 1 && s[0] === (d === 'E' ? y : x);
  };
  /** WM-3: a town or a place a town leads to: its links lean east (a town's through road and its street want a
   * straight run west to east until the town sessions) @param {number} i */
  const townish = i => nodes[i].type === 'town' || from[i].some(k => nodes[k].type === 'town');
  /** the cells of L node l (placed 2 x 2) diagonal to a cell its first parent touches @param {number} l */
  const lCells = l => {
    const p = /** @type {{ at: number[], size: number[] }} */ (put[from[l][0]]),
      f = /** @type {{ at: number[], size: number[] }} */ (put[l]),
      ins = [0, 1].flatMap(dx =>
        [0, 1].flatMap(dy => {
          const c = [f.at[0] + dx, f.at[1] + dy];
          return runGridSide(p, { at: c, size: [1, 1] }) ? [c] : [];
        })
      );
    return ins.map(c => [2 * f.at[0] + 1 - c[0], 2 * f.at[1] + 1 - c[1]]);
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
  /** WM-5b: spots(i, size) kept by all it reads (where node i's parents stand and their sizes, and an L parent's own
   * parent), so stepping back doesn't build and sort them again (bigger towns step back more) @type {Map<string,
   * number[][]>} */
  const spotsKept = new Map(),
    at = (/** @type {number} */ j) => {
      const f = /** @type {any} */ (put[j]);
      return f ? `${f.at}/${f.size}` : '-';
    },
    spotsOf = (/** @type {number} */ i, /** @type {number[]} */ size) => {
      const k = `${i}|${size}|${from[i].map(j => at(j) + (shape[j] === 'L' && from[j].length ? ':' + at(from[j][0]) : '')).join('|')}`;
      let v = spotsKept.get(k);
      if (!v) spotsKept.set(k, (v = spots(i, size)));
      return v;
    };
  /** @param {number} i @returns {boolean} */
  const place = i => {
    if (i >= nodes.length) return true;
    for (const size of sizes[i])
      for (const [x, y] of spotsOf(i, size)) {
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
    delete n.cut;
  });
  runGridWays(
    seed,
    nodes,
    new Set(nodes.flatMap((n, i) => (shape[i] === 'L' && n.size && n.size[0] === 2 && n.size[1] === 2 ? [i] : [])))
  );
  nodes.forEach((n, i) => {
    if (shape[i] !== 'L' || /** @type {number[]} */ (n.size)[0] !== 2 || /** @type {number[]} */ (n.size)[1] !== 2)
      return;
    const c = runGridCut(nodes, i);
    if (c) n.cut = c;
  });
  return true;
}
/** the node's links both ways in a place's exit order: the first back (the nodes that lead to it, by lane), the first
 * ahead (the ones it leads to, by lane; the main road runs between those two), then the rest, back before ahead
 * @param {RunNode[]} nodes @param {number} i @returns {{ node: number, ahead: boolean }[]} */
export function runGridLinks(nodes, i) {
  const byLane = (/** @type {number[]} */ js) => js.slice().sort((a, b) => nodes[a].lane - nodes[b].lane),
    back = byLane(nodes.flatMap((p, k) => (p.to.includes(i) ? [k] : []))).map(node => ({ node, ahead: false })),
    ahead = byLane(nodes[i].to).map(node => ({ node, ahead: true }));
  return [back[0], ahead[0], ...back.slice(1), ...ahead.slice(1)].filter(e => !!e);
}
/** a point on the grid in metres (x east, y north) at `u` metres along the edge footprint a shares on side d @param
 * {{ at: number[], size: number[] }} a @param {string} d @param {number} u */
export const runGridPoint = (a, d, u) => {
  const C = RUN_GRID.cell;
  return d === 'E'
    ? [(a.at[0] + a.size[0]) * C, u]
    : d === 'W'
      ? [a.at[0] * C, u]
      : d === 'N'
        ? [u, (a.at[1] + a.size[1]) * C]
        : [u, a.at[1] * C];
};
/** the distance from point p to the segment a-b @param {number[]} p @param {number[]} a @param {number[]} b */
export const runSegDist = (p, a, b) => {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    L = dx * dx + dy * dy,
    t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
};
/** WM-3: an L's cut: the corner cell of node i's 2 x 2 footprint off its main road's bend. Only where the road bends:
 * its first two exits (runGridLinks, where they cross: `ways`) open into cells diagonal to each other, so the road
 * turns through one of the other two (the one nearer the corner where the two run-ins meet) and the last is cut, 32 m
 * at least from the road's line (in, that corner, out) and with no exit of its own; null when the road doesn't bend
 * (the place stays square). The cut is walled off in the place (mapgen's `cut` dial) and stays its own on the grid
 * (no other place stands on it). Needs the nodes' `ways` (runGridWays)
 * @param {RunNode[]} nodes @param {number} i @returns {[number, number] | null} */
export function runGridCut(nodes, i) {
  const n = /** @type {{ at: number[], size: number[], to: number[], ways: number[] }} */ (
      /** @type {any} */ (nodes[i])
    ),
    [ax, ay] = n.at,
    C = RUN_GRID.cell,
    ends = runGridLinks(nodes, i).map(e => {
      const b = /** @type {any} */ (nodes[e.node]),
        d = runGridSide(n, b),
        u = e.ahead ? n.ways[n.to.indexOf(e.node)] : b.ways[b.to.indexOf(i)],
        p = runGridPoint(n, d, u),
        /* the footprint's cell the exit opens into */
        cell =
          d === 'E' || d === 'W'
            ? [d === 'E' ? ax + 1 : ax, Math.floor(u / C)]
            : [Math.floor(u / C), d === 'N' ? ay + 1 : ay];
      return { d, p, cell };
    });
  if (ends.length < 2) return null;
  const [A, B] = ends;
  if (A.cell[0] === B.cell[0] || A.cell[1] === B.cell[1]) return null;
  const across = (/** @type {string} */ d) => d === 'N' || d === 'S',
    bend = across(A.d) !== across(B.d) ? (across(A.d) ? [A.p[0], B.p[1]] : [B.p[0], A.p[1]]) : null,
    line = bend ? [A.p, bend, B.p] : [A.p, B.p],
    /* the two cells the road may turn through, the bend's first */
    other = [
      [A.cell[0], B.cell[1]],
      [B.cell[0], A.cell[1]],
    ].sort((p, q) =>
      bend
        ? Math.hypot((p[0] + 0.5) * C - bend[0], (p[1] + 0.5) * C - bend[1]) -
          Math.hypot((q[0] + 0.5) * C - bend[0], (q[1] + 0.5) * C - bend[1])
        : 0
    );
  /* the cut: the second when the road bends through the first; with no bend (an S through the middle), whichever lies
     further from the road's line */
  const cands = bend ? [other[1]] : other,
    far = (/** @type {number[]} */ c) => {
      const m = [(c[0] + 0.5) * C, (c[1] + 0.5) * C];
      let d = 1e9;
      for (let k = 0; k + 1 < line.length; k++) d = Math.min(d, runSegDist(m, line[k], line[k + 1]));
      return d;
    };
  let best = /** @type {[number, number] | null} */ (null),
    most = 32;
  for (const c of cands) {
    if (ends.some(e => e.cell[0] === c[0] && e.cell[1] === c[1])) continue;
    const d = far(c);
    if (d > most) {
      most = d;
      best = /** @type {[number, number]} */ (c.slice());
    }
  }
  return best;
}
/** WM-3: where each link crosses its edge: `ways`, beside `to`, the metres along the grid (y for a link east, x for
 * one north or south) of its exit, a whole metre on the cells both footprints share, RUN_GRID.edge from their ends at
 * least and RUN_GRID.gap from another exit of either place's side; drawn on 'map|way|i|j' among the spots that fit
 * (the one furthest from the others when none does: the seam check names it). Links are settled in node order. An L
 * (`bend`: its node indices) takes its first way ahead, where it can, in the cell diagonal to the one its first way
 * in opens into, so its road bends round the corner runGridCut walls off
 * @param {string} seed @param {RunNode[]} nodes @param {Set<number>} [bend] */
export function runGridWays(seed, nodes, bend = new Set()) {
  const C = RUN_GRID.cell,
    E = RUN_GRID.edge,
    /** @type {Record<string, number[]>} the exits settled on each node's side, 'i|d' */
    on = {},
    opp = /** @type {Record<string, string>} */ ({ E: 'W', W: 'E', N: 'S', S: 'N' }),
    links = nodes.map((_, i) => runGridLinks(nodes, i));
  nodes.forEach((n, i) => {
    const L = links[i],
      first = L.find(e => e.ahead)?.node,
      inn = L.find(e => !e.ahead),
      din = inn ? runGridSide(/** @type {any} */ (n), /** @type {any} */ (nodes[inn.node])) : '';
    n.ways = n.to.map(j => {
      const a = /** @type {any} */ (n),
        b = /** @type {any} */ (nodes[j]),
        d = runGridSide(a, b),
        s = /** @type {[number, number]} */ (runGridShared(a, b)),
        mine = (on[`${i}|${d}`] = on[`${i}|${d}`] || []),
        theirs = (on[`${j}|${opp[d]}`] = on[`${j}|${opp[d]}`] || []),
        taken = mine.concat(theirs),
        all = /** @type {number[]} */ ([]);
      for (let u = s[0] * C + E; u <= s[1] * C - E; u++) all.push(u);
      const room = (/** @type {number} */ u) => {
          let m = 1e9;
          for (const v of taken) m = Math.min(m, Math.abs(u - v));
          return m;
        },
        spaced = taken.length ? all.filter(u => room(u) >= RUN_GRID.gap) : all,
        main = j === first,
        turn = bend.has(i) && main ? runGridTurn(nodes, i, d) : null,
        bent = turn ? spaced.filter(turn) : [],
        fit = bent.length ? bent : spaced,
        /* the main road's way out on a side square to its way in: the far half of the edge from the way in's side,
           so the road runs long (in from the west or south: east or north; from the north: south); the landing's
           two ways on, the south and west halves (the road between them across the place) */
        sq = (/** @type {string} */ x, /** @type {string} */ y) =>
          (x === 'N' || x === 'S') !== (y === 'N' || y === 'S'),
        far = main && din && sq(din, d) ? (din === 'N' ? -1 : 1) : !inn ? -1 : 0,
        half = Math.ceil(fit.length / 2),
        mine2 = far > 0 ? fit.slice(fit.length - half) : far < 0 ? fit.slice(0, half) : fit,
        /* and the way into j when it is j's first way in and j's road turns: the half that makes j's road run long
           (in by its west and on north: the south half; on south: the north; in by its south or north and on east:
           the west half) */
        jl = links[j],
        jOn = jl.find(e => e.ahead),
        jd = jOn && jl.find(e => !e.ahead)?.node === i ? runGridSide(b, /** @type {any} */ (nodes[jOn.node])) : '',
        jin = opp[d],
        lean = !jd || !sq(jin, jd) ? 0 : jin === 'W' ? (jd === 'N' ? -1 : 1) : jd === 'E' ? -1 : 0,
        /* a town's turn first (its street and square want the room), else the leaving place's */
        base = b.type === 'town' && lean ? fit : mine2,
        h2 = Math.ceil(base.length / 2),
        theirs2 = lean > 0 ? base.slice(base.length - h2) : lean < 0 ? base.slice(0, h2) : base,
        ok = theirs2.length ? theirs2 : mine2,
        u = ok.length
          ? ok[rngFrom(seed, `map|way|${i}|${j}`).int(0, ok.length - 1)]
          : all.reduce((m, v) => (room(v) > room(m) ? v : m), all[0]);
      mine.push(u);
      theirs.push(u);
      return u;
    });
  });
}
/** WM-3: for an L (node i, 2 x 2) whose first way in is settled: which spots u (metres along the grid) on its side d
 * open into a cell diagonal to the one that way in opens into; null when it has no way in yet
 * @param {RunNode[]} nodes @param {number} i @param {string} d @returns {((u: number) => boolean) | null} */
export function runGridTurn(nodes, i, d) {
  const n = /** @type {any} */ (nodes[i]),
    C = RUN_GRID.cell,
    first = runGridLinks(nodes, i).find(e => !e.ahead);
  if (!first) return null;
  const p = /** @type {any} */ (nodes[first.node]),
    k = p.to.indexOf(i);
  if (!p.ways || p.ways[k] === undefined) return null;
  const pd = runGridSide(n, p),
    pu = p.ways[k],
    cellOf = (/** @type {string} */ s, /** @type {number} */ u) =>
      s === 'E' || s === 'W'
        ? [s === 'E' ? n.at[0] + 1 : n.at[0], Math.floor(u / C)]
        : [Math.floor(u / C), s === 'N' ? n.at[1] + 1 : n.at[1]],
    a = cellOf(pd, pu);
  return u => {
    const b = cellOf(d, u);
    return a[0] !== b[0] && a[1] !== b[1];
  };
}
/** WM-3: node i's exits on the grid, in its place's exit order (runGridLinks): each one's side, where along it (t, 0
 * to 1 from its south or west end), the node it leads to and whether that is ahead; null for a map or a neighbour
 * with no footprint or no `ways` (a run's from before WM-3: runExits' east and west) @param {RunMap} map
 * @param {number} i @returns {{ side: 'E' | 'W' | 'N' | 'S', t: number, node: number, ahead: boolean }[] | null} */
export function runGridExits(map, i) {
  const N = map.nodes,
    n = N[i],
    L = runGridLinks(N, i);
  if (!n.at || !n.size || !n.ways || L.some(e => !N[e.node].at || !N[e.node].ways)) return null;
  const C = RUN_GRID.cell;
  return L.map(e => {
    const b = N[e.node],
      d = /** @type {'E' | 'W' | 'N' | 'S'} */ (runLinkDir(map, i, e.node)),
      u = e.ahead
        ? /** @type {number[]} */ (n.ways)[n.to.indexOf(e.node)]
        : /** @type {number[]} */ (b.ways)[b.to.indexOf(i)],
      k = d === 'E' || d === 'W' ? 1 : 0,
      along = u - /** @type {number[]} */ (n.at)[k] * C,
      len = /** @type {number[]} */ (n.size)[k] * C;
    return { side: d, t: along / len, node: e.node, ahead: e.ahead };
  });
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
     linked again without them (nothing else changes). WM-3: no two shops in a row is settled before the grid, as a
     place's type gives its shape (each try starts from the types drawn) */
  const drawn = nodes.map(n => n.type),
    /* WM-5: each town's size (M.sizes, in order of the town rows: two towns on a row share one), its cells from
       M.townSizes.cells; stepped down a size at a time (every town at once, the smallest kept) when the grid can't
       hold the map even without its lane switches */
    C = M.townSizes && M.townSizes.cells,
    names = C ? Object.keys(C) : [],
    townRows = roles.flatMap((r, row) => (r === 'rest' ? [row] : [])),
    sizeAt = (/** @type {number} */ row) => {
      const S = /** @type {string[]} */ (M.sizes),
        k = names.indexOf(S[Math.min(townRows.indexOf(row), S.length - 1)]);
      return k < 0 ? 0 : k;
    },
    sized = !!(C && M.sizes && M.sizes.length && townRows.length),
    most = sized ? Math.max(0, ...townRows.map(sizeAt)) : 0;
  grid: for (let down = 0; down <= most; down++) {
    const want = nodes.map(n =>
      sized && roles[n.row] === 'rest'
        ? /** @type {[number, number]} */ (C[names[Math.max(0, sizeAt(n.row) - down)]])
        : null
    );
    for (const switches of [true, false]) {
      nodes.forEach((n, i) => {
        n.to = [];
        n.type = drawn[i];
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
          if (switches && shape[row].cross) shape[row].west ? link(1, 0) : link(0, 1);
        }
      }
      for (const n of nodes) n.to.sort((a, b) => a - b);
      runMapNoTwoShops(seed, nodeTypes, roles, nodes);
      if (runMapGrid(seed, nodes, nodeTypes, want)) break grid;
    }
    if (down === most) throw new Error(`runMapMake: seed ${seed}'s map doesn't fit the grid`);
  }
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
/** WM-4: a run's places on the bowl at their region-grid cells (RUN_GRID), at the walk's own scale (`metres` to a
 * bowl radius, as world-bowl.js BOWL_METRES), so their maps lie side by side as the walk joins them; the region's
 * cells centred on the bowl. A side area's places (no footprint of their own) are laid by runSideLay */
export const RUN_BOWL_GRID = { metres: 1000 };
/** WM-4b: a side area laid on the region grid, worked out, never stored, so the walk and the world map agree: each of
 * its places on two free cells (RUN_GRID.place) touching the one before, and the obstacle's door into the first on
 * the edge they share. The first lies north of its obstacle's place (else south) on the cells whose shared edge has
 * the door spot furthest from the side's other exits (a whole metre, RUN_GRID.edge from the ends of that edge and of
 * the side, off an L's cut cell), the north's when it has RUN_GRID.gap of room, nearest the side's middle on a tie;
 * each next place east of the one before, else north, else south, each link in the middle of the edge it crosses.
 * When no cells touch (a crowded corner of the region): a step further north while those are taken, the door then in
 * the north side's best spot (the walk lays such a place by its exits, off its cells). null for a map without a side
 * area or without footprints
 * @param {RunMap} map @returns {{ cells: { at: [number, number], size: [number, number] }[], door: { side: 'N' | 'S', t: number } } | null} */
export function runSideLay(map) {
  const S = map.side,
    N = map.nodes;
  if (!S || !S.nodes.length) return null;
  const f = N[S.from];
  if (!f || !f.at || !f.size || N.some(n => runSideMain(n) && !(n.at && n.size))) return null;
  const C = RUN_GRID.cell,
    E = RUN_GRID.edge,
    size = /** @type {[number, number]} */ ([...RUN_GRID.place]),
    fx = f.at[0],
    fy = f.at[1],
    L = f.size[0] * C,
    main = N.filter(n => runSideMain(n) && n.at && n.size).map(n => ({
      at: /** @type {number[]} */ (n.at),
      size: /** @type {number[]} */ (n.size),
    })),
    /** @type {{ at: [number, number], size: [number, number] }[]} */
    cells = [],
    taken = (/** @type {{ at: number[], size: number[] }} */ c) =>
      main.some(m => runGridOverlap(m, c)) || cells.some(m => runGridOverlap(m, c)),
    /* the obstacle's other exits on its north and south sides (metres from its west end) */
    G = N.some(n => n.ways) ? runGridExits(map, S.from) : null;
  /** @type {{ side: 'N' | 'S', t: number, room: number, at: [number, number] | null }[]} */
  const best = [];
  for (const side of /** @type {('N' | 'S')[]} */ (['N', 'S'])) {
    const y = side === 'N' ? fy + f.size[1] : fy - size[1],
      others = (G || []).filter(e => e.side === side).map(e => e.t * L),
      cut = f.cut && f.cut[1] === (side === 'N' ? fy + f.size[1] - 1 : fy) ? (f.cut[0] - fx) * C : null;
    /** @type {{ side: 'N' | 'S', t: number, room: number, at: [number, number] | null }} */
    let pick = { side, t: 0.5, room: -1, at: null };
    for (let k = 1 - size[0]; k < f.size[0]; k++) {
      const at = /** @type {[number, number]} */ ([fx + k, y]);
      if (taken({ at, size })) continue;
      const lo = Math.max(E, Math.max(0, k) * C + E),
        hi = Math.min(L - E, Math.min(f.size[0], k + size[0]) * C - E);
      for (let u = lo; u <= hi; u++) {
        if (cut !== null && u > cut - E && u < cut + C + E) continue;
        const room = Math.min(1e9, ...others.map(v => Math.abs(u - v))),
          better =
            !pick.at || room > pick.room || (room === pick.room && Math.abs(u - L / 2) < Math.abs(pick.t * L - L / 2));
        if (better) pick = { side, t: u / L, room, at };
      }
    }
    best.push(pick);
  }
  const ok = best.filter(p => p.at),
    door = ok.find(p => p.room >= RUN_GRID.gap) || ok[0];
  if (door && door.at) cells.push({ at: door.at, size });
  else {
    /* nothing touches: the north side's best spot and a cell further north */
    const others = (G || []).filter(e => e.side === 'N').map(e => e.t * L);
    let t = 0.5,
      room = -1;
    for (let u = E; u <= L - E; u++) {
      const r = Math.min(1e9, ...others.map(v => Math.abs(u - v)));
      if (r > room || (r === room && Math.abs(u - L / 2) < Math.abs(t * L - L / 2))) [t, room] = [u / L, r];
    }
    best[0] = { side: 'N', t, room, at: null };
    let d = 1;
    while (d < 64 && taken({ at: [fx, fy + f.size[1] + d], size })) d++;
    cells.push({ at: [fx, fy + f.size[1] + d], size });
  }
  for (let k = 1; k < S.nodes.length; k++) {
    const p = cells[k - 1],
      north = (/** @type {number} */ d) => ({
        at: /** @type {[number, number]} */ ([p.at[0], p.at[1] + p.size[1] + d]),
        size,
      }),
      tries = [
        { at: /** @type {[number, number]} */ ([p.at[0] + p.size[0], p.at[1]]), size },
        north(0),
        { at: /** @type {[number, number]} */ ([p.at[0], p.at[1] - size[1]]), size },
      ];
    let c = tries.find(t => !taken(t));
    for (let d = 1; !c && d < 64; d++) if (!taken(north(d))) c = north(d);
    cells.push(c || north(64));
  }
  const D = door && door.at ? door : best[0];
  return { cells, door: { side: D.side, t: D.t } };
}
/** each node's footprint on the region grid ({ at, size } in cells), a side area's places' laid by runSideLay; null
 * when the map's main places have none (a run from before WM-2)
 * @param {RunMap} map @returns {{ at: [number, number], size: [number, number] }[] | null} */
export function runSpotCells(map) {
  const nodes = map.nodes;
  if (!nodes.length || nodes.some(n => runSideMain(n) && !(n.at && n.size))) return null;
  /** @type {({ at: [number, number], size: [number, number] } | null)[]} */
  const cells = nodes.map(n =>
      n.at && n.size && runSideMain(n)
        ? { at: /** @type {[number, number]} */ ([...n.at]), size: /** @type {[number, number]} */ ([...n.size]) }
        : null
    ),
    lay = runSideLay(map);
  if (lay && map.side)
    map.side.nodes.forEach((i, k) => (cells[i] = { at: [...lay.cells[k].at], size: [...lay.cells[k].size] }));
  return cells.every(Boolean) ? /** @type {{ at: [number, number], size: [number, number] }[]} */ (cells) : null;
}
/** WM-4: a node's place on the bowl from the region grid: its middle and its size (bowl radii, x east, y north), the
 * region's cells centred on the bowl; WM-4b: an L's `cut`, the corner its walled-off cell is in ([sx, sy], -1 west or
 * south, 1 east or north), else null; null for a map without footprints @param {RunMap} map
 * @returns {{ x: number, y: number, w: number, h: number, cut: [number, number] | null }[] | null} */
export function runSpotBoxes(map) {
  const cells = runSpotCells(map);
  if (!cells) return null;
  const c = RUN_GRID.cell / RUN_BOWL_GRID.metres,
    x0 = Math.min(...cells.map(f => f.at[0])),
    x1 = Math.max(...cells.map(f => f.at[0] + f.size[0])),
    y0 = Math.min(...cells.map(f => f.at[1])),
    y1 = Math.max(...cells.map(f => f.at[1] + f.size[1]));
  return cells.map((f, i) => {
    const cut = map.nodes[i].cut;
    return {
      x: (f.at[0] + f.size[0] / 2 - (x0 + x1) / 2) * c,
      y: (f.at[1] + f.size[1] / 2 - (y0 + y1) / 2) * c,
      w: f.size[0] * c,
      h: f.size[1] * c,
      cut: cut ? /** @type {[number, number]} */ ([cut[0] > f.at[0] ? 1 : -1, cut[1] > f.at[1] ? 1 : -1]) : null,
    };
  });
}
/** WM-4b: a place's outline on the bowl, corner by corner anticlockwise from its south-west (bowl radii): its box's
 * four, an L's six (its cut cell, RUN_GRID.cell square, left out) @param {{ x: number, y: number, w: number,
 * h: number, cut?: [number, number] | null }} b @returns {[number, number][]} */
export function runSpotOutline(b) {
  const c = RUN_GRID.cell / RUN_BOWL_GRID.metres,
    /** @type {[number, number][]} */
    out = [];
  /** @type {[number, number][]} */ ([
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]).forEach(([sx, sy], k) => {
    const x = b.x + (sx * b.w) / 2,
      y = b.y + (sy * b.h) / 2;
    if (!b.cut || b.cut[0] !== sx || b.cut[1] !== sy) return void out.push([x, y]);
    /* the cut corner: in along the edge we came by, round the cell, out along the next */
    const along = /** @type {[number, number]} */ ([x - sx * c, y]),
      up = /** @type {[number, number]} */ ([x, y - sy * c]),
      inner = /** @type {[number, number]} */ ([x - sx * c, y - sy * c]);
    out.push(...(k % 2 ? [along, inner, up] : [up, inner, along]));
  });
  return out;
}
/** a node's spot on the bowl ({a, r, up} as locations.json "bowl"), worked out, never stored: WM-4, from the region
 * grid (runSpotBoxes); a run from before WM-2, from its row and lane (RUN_BOWL)
 * @param {RunMap} map @param {number} i @returns {{ a: number, r: number, up: number }} */
export function runSpot(map, i) {
  const B = runSpotBoxes(map);
  if (B) return runSpotAt(B[i].x, B[i].y);
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
  return runSpotAt(x, y);
}
/** a spot on the bowl at x east and y north (bowl radii), facing the bowl's north @param {number} x @param {number} y */
export function runSpotAt(x, y) {
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
/** PK-5: a run's mapReveal rule rows (Tour Brochure): every place of the main map shows what it is (its type), as
 * the map is made, at each arrival and when such a Perk is taken (logic/perks.js perkTake); a side area still shows
 * once its obstacle is open. Nothing without a row @param {Run} run @param {Record<string, any>} [perks] */
export function runRevealAll(run, perks) {
  if (!run || !run.map || typeof fxRunRule !== 'function' || !(fxRunRule(run, 'mapReveal', perks) > 0)) return;
  for (const n of run.map.nodes.filter(runSideMain)) n.seen = 2;
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
/** PK-4: how many days ahead a run's forecast is rolled and shown: `ahead` (rules.json run.clock.ahead) and the run's
 * forecastDays rule rows (Barometer: effects.js fxRunRule). The forecast is filled that far (the days a later fill
 * would give, each from its own stream), so a Perk taken mid-run shows its days at once @param {Run} run
 * @param {Record<string, { climate?: string }>} biomes @param {number} ahead @returns {number} the days shown */
export function runForecastDays(run, biomes, ahead) {
  /* the effects aren't loaded where the map is made alone (a test of this file): no rows then */
  const n = Math.max(1, ahead + (typeof fxRunRule === 'function' ? fxRunRule(run, 'forecastDays') : 0));
  runForecastFill(run, biomes, run.clock + n);
  return n;
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
  runRevealAll(run);
  runForecastDays(run, data.biomes, data.rules.clock.ahead);
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
  runRevealAll(run);
  runForecastDays(run, data.biomes, data.rules.clock.ahead);
  return run.clock;
}

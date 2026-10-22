// @ts-check
'use strict';
/* ================= DATA CHECKS (Studio plan Phase 1, T1.3: one set of data checks for CI and the Studio) =================
   Pure checks on the game data, run by tools/check-data.mjs (CI). T1.3 moves check-data's other checks here so the
   Studio's Check runs the same ones. Logic only: no DOM, runs in Node (tools/test/data-checks.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { runMapMake, runMapRows } from './run-map.js';
/* eslint-disable no-func-assign */
expose({
  RUN_MAP_ROLE_NAMES: [() => RUN_MAP_ROLE_NAMES],
  RUN_MAP_ROLE_TYPES: [() => RUN_MAP_ROLE_TYPES],
  // @ts-expect-error -- replaced on purpose
  dataUnderscoreKeys: [() => dataUnderscoreKeys, v => (dataUnderscoreKeys = v)],
  // @ts-expect-error -- replaced on purpose
  runMapProblems: [() => runMapProblems, v => (runMapProblems = v)],
  // @ts-expect-error -- replaced on purpose
  runMapSweep: [() => runMapSweep, v => (runMapSweep = v)],
  // @ts-expect-error -- replaced on purpose
  runMapTownsPerPath: [() => runMapTownsPerPath, v => (runMapTownsPerPath = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** T1.6 (plan F7): the paths of keys starting with `_` (and longer than `_`) in a data file's value. The Studio
 * leaves such keys out of every save (they are its in-memory caches), so one in a file would vanish on the next
 * proposal @param {unknown} v @param {string} [at] @returns {string[]} */
export function dataUnderscoreKeys(v, at = '') {
  if (!v || typeof v !== 'object') return [];
  const out = [];
  for (const [k, x] of Object.entries(v)) {
    const p = at ? `${at}.${k}` : k;
    if (!Array.isArray(v) && k[0] === '_' && k.length > 1) out.push(p);
    else out.push(...dataUnderscoreKeys(x, p));
  }
  return out;
}

/* ---------- Studio plan T2.3: a run map's structure, and a sweep over many seeds ---------- */
/** the node type ids the game's code looks for on a map's role rows (run-loop.js runFoes: 'miniboss' and 'boss';
 * run-scenes.js: a 'town' has the clinic and shop, the 'landing' the mast) */
export const RUN_MAP_ROLE_TYPES = { first: 'landing', rest: 'town', guard: 'miniboss', last: 'boss' };
export const RUN_MAP_ROLE_NAMES = { first: 'landing', rest: 'rest', guard: 'mini-boss', last: 'last' };

/** what is wrong with one run map (run-map.js runMapMake's), as sentences: a place the landing can't reach, a place
 * that leads nowhere or skips a row, a role row without the type the game looks for, a deadline before the shortest
 * walk ends @param {any} map @param {any} M rules.json run.map @param {{ slack: number }} clock @returns {string[]} */
export function runMapProblems(map, M, clock) {
  const out = [],
    nodes = map.nodes,
    last = Math.max(...nodes.map((/** @type {any} */ n) => n.row)),
    roles = runMapRows(M),
    seen = new Set([0]),
    todo = [0];
  while (todo.length)
    for (const j of nodes[/** @type {number} */ (todo.pop())].to)
      if (!seen.has(j)) {
        seen.add(j);
        todo.push(j);
      }
  nodes.forEach((/** @type {any} */ n, /** @type {number} */ i) => {
    if (!seen.has(i)) out.push(`place ${i} can’t be reached from the landing`);
    if (n.row < last && !n.to.length) out.push(`place ${i} leads nowhere (row ${n.row + 1} of ${last + 1})`);
    if (n.to.some((/** @type {number} */ j) => !nodes[j] || nodes[j].row !== n.row + 1))
      out.push(`place ${i} skips a row`);
    const role = /** @type {keyof typeof RUN_MAP_ROLE_TYPES} */ (roles[n.row]),
      want = RUN_MAP_ROLE_TYPES[role];
    if (want && n.type !== want)
      out.push(
        role === 'last'
          ? `the last row is a ${n.type}, not the boss`
          : `a ${RUN_MAP_ROLE_NAMES[role]} row (row ${n.row + 1}) is a ${n.type}, not a ${want === 'town' ? 'town' : want}`
      );
  });
  if (!(clock.slack >= 0))
    out.push(`the deadline (slack ${clock.slack}) comes before the shortest walk reaches the boss`);
  return [...new Set(out)];
}

/** the fewest and most towns on a walk from the landing to the last row (over every path) @param {any} map */
export function runMapTownsPerPath(map) {
  const nodes = map.nodes,
    lo = nodes.map(() => Infinity),
    hi = nodes.map(() => -Infinity),
    last = Math.max(...nodes.map((/** @type {any} */ n) => n.row));
  for (let i = nodes.length - 1; i >= 0; i--) {
    const t = nodes[i].type === 'town' ? 1 : 0;
    if (nodes[i].row === last) lo[i] = hi[i] = t;
    else
      for (const j of nodes[i].to) {
        lo[i] = Math.min(lo[i], t + lo[j]);
        hi[i] = Math.max(hi[i], t + hi[j]);
      }
  }
  return [lo[0], hi[0]];
}

/**
 * a sweep of n seeds (`${prefix}${k}`): the problems (each with how many maps have it and a seed that shows it), and
 * the figures a designer weighs: places per map, places by type, towns on a walk, biomes, the towns made against the
 * routes (rest rows are always towns, so the ratio isn't the weights'), and outlying seeds to open
 * @param {Record<string, any>} nodeTypes @param {any} M rules.json run.map (its biomes as the run's unlocks leave them)
 * @param {{ slack: number }} clock @param {{ n?: number, prefix?: string }} [o]
 */
export function runMapSweep(nodeTypes, M, clock, o = {}) {
  const n = o.n || 1000,
    prefix = o.prefix || 'SWEEP',
    /** @type {Map<string, { text: string, seed: string, count: number }>} */
    problems = new Map(),
    /** @type {Record<string, number>} */ types = {},
    /** @type {Record<string, number>} */ biomes = {},
    sizes = [],
    towns = [],
    /** @type {{ seed: string, why: string }[]} */ outliers = [];
  let maps = 0,
    lo = Infinity,
    hi = -Infinity;
  const note = (/** @type {string} */ text, /** @type {string} */ seed) => {
    const p = problems.get(text);
    if (p) p.count++;
    else problems.set(text, { text, seed, count: 1 });
  };
  for (let k = 0; k < n; k++) {
    const seed = prefix + k;
    let map;
    try {
      map = runMapMake(seed, nodeTypes, M);
    } catch (e) {
      note(`these rules can’t make a map: ${/** @type {Error} */ (e).message}`, seed);
      continue;
    }
    maps++;
    for (const p of runMapProblems(map, M, clock)) note(p, seed);
    sizes.push([map.nodes.length, seed]);
    for (const x of map.nodes) {
      types[x.type] = (types[x.type] || 0) + 1;
      biomes[x.biome] = (biomes[x.biome] || 0) + 1;
    }
    const [a, b] = runMapTownsPerPath(map);
    towns.push([a, seed]);
    lo = Math.min(lo, a);
    hi = Math.max(hi, b);
  }
  const stat = (/** @type {any[]} */ xs) =>
    xs.length
      ? {
          min: Math.min(...xs.map(x => x[0])),
          max: Math.max(...xs.map(x => x[0])),
          avg: xs.reduce((s, x) => s + x[0], 0) / xs.length,
        }
      : { min: 0, max: 0, avg: 0 };
  const nodes = stat(sizes),
    tp = stat(towns);
  if (maps) {
    outliers.push({
      seed: /** @type {any} */ (sizes.find(x => x[0] === nodes.min))[1],
      why: `fewest places (${nodes.min})`,
    });
    outliers.push({
      seed: /** @type {any} */ (sizes.find(x => x[0] === nodes.max))[1],
      why: `most places (${nodes.max})`,
    });
    outliers.push({
      seed: /** @type {any} */ (towns.find(x => x[0] === tp.min))[1],
      why: `fewest towns on a walk (${tp.min})`,
    });
  }
  return {
    maps,
    problems: [...problems.values()],
    nodes,
    types,
    biomes,
    townsPerPath: { min: maps ? lo : 0, max: maps ? hi : 0, avg: tp.avg },
    ratio: {
      towns: types.town || 0,
      routes: types.route || 0,
      weights: { town: (nodeTypes.town || {}).weight || 0, route: (nodeTypes.route || {}).weight || 0 },
    },
    outliers,
  };
}

// @ts-check
'use strict';
/* ================= THE SIMULATION'S NUMBERS AND THEIR COMPARE (Studio plan T3.4) =================
   What the run simulation (logic/run-sim.js) reports over a list of seeds, and how two reports of the same seeds
   compare: Base (the data as loaded, or a saved report) against Draft. The same seeds on both sides make every
   difference a paired one (seed by seed), so the noise is much smaller than two separate samples'.
   - simWilson: a share with its 95% Wilson interval (sound near 0 and 1, where the plain one is not);
   - simPaired: the mean of seed-by-seed differences with its 95% interval (normal approximation);
   - simSummary: one report's numbers from its runs;
   - simCompare: two reports of the same seeds: each side's summary, the paired differences, the runs that flipped.
   The CLI (tools/test/sim/run-sim.mjs --compare) and the Run Lab's Simulate card both use these, so their JSON is the
   same. Every number here measures a bot policy (the report names it), not a player. Pure: no DOM, no Node, no
   Math.random (tools/test/sim-compare.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* to-module: end */
/** z for a two-sided 95% interval */
export const SIM_Z95 = 1.959964;
/** the per-run numbers simPaired compares, in the order the tables show them */
export const SIM_METRICS = Object.freeze([
  'won',
  'days',
  'places',
  'battles',
  'caught',
  'healed',
  'spent',
  'moneyLeft',
  'capital',
  'relics',
  'topLevel',
]);
/** a round to a tenth, or a thousandth for shares @param {number} x @param {number} [k] */
const round = (x, k = 10) => Math.round(x * k) / k;

/**
 * k of n as a share with its Wilson interval (z: 1.96 for 95%): { k, n, p, lo, hi }; n = 0 gives 0 in [0, 1]
 * @param {number} k @param {number} n @param {number} [z]
 */
export function simWilson(k, n, z = SIM_Z95) {
  if (!(n > 0)) return { k: 0, n: 0, p: 0, lo: 0, hi: 1 };
  const p = k / n,
    z2 = z * z,
    mid = (p + z2 / (2 * n)) / (1 + z2 / n),
    half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return {
    k,
    n,
    p: round(p, 1000),
    lo: round(Math.max(0, mid - half), 1000),
    hi: round(Math.min(1, mid + half), 1000),
  };
}

/**
 * The mean of paired differences (draft - base, seed by seed) with its interval: { n, mean, lo, hi, changed }, where
 * changed counts the seeds that differ at all. With every difference 0 the interval is [0, 0].
 * @param {number[]} d @param {number} [z]
 */
export function simPaired(d, z = SIM_Z95) {
  const n = d.length;
  if (!n) return { n: 0, mean: 0, lo: 0, hi: 0, changed: 0 };
  const mean = d.reduce((a, x) => a + x, 0) / n,
    sd = n > 1 ? Math.sqrt(d.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1)) : 0,
    half = (z * sd) / Math.sqrt(n);
  return {
    n,
    mean: round(mean, 1000),
    lo: round(mean - half, 1000),
    hi: round(mean + half, 1000),
    changed: d.filter(x => x !== 0).length,
  };
}

/** a run's value of a metric (simulation stats, as runSim returns them) @param {any} r @param {string} k */
export function simValue(r, k) {
  if (k === 'won') return r.won ? 1 : 0;
  if (k === 'moneyLeft') return r.se || 0;
  if (k === 'relics') return (r.relics || []).length;
  if (k === 'topLevel') return r.top || 0;
  return r[k] || 0;
}

/**
 * One report's numbers from its runs (runSim's stats, one per seed): win rate with its interval, where runs were lost
 * (by node type and by row), the averages, money in and out, the Loopholes taken, and each leader's record.
 * @param {any[]} runs
 */
export function simSummary(runs) {
  const n = runs.length,
    avg = (/** @type {string} */ k) => (n ? round(runs.reduce((a, r) => a + simValue(r, k), 0) / n) : 0),
    /** @type {Record<string, number>} */ lostAt = {},
    /** @type {Record<string, number>} */ lostRow = {},
    /** @type {Record<string, number>} */ relics = {},
    /** @type {Record<string, { fought: number, beaten: number }>} */ leaders = {},
    /** @type {Record<string, number>} */ moneyIn = {},
    /** @type {Record<string, number>} */ moneyOut = {};
  for (const r of runs) {
    if (!r.won) {
      const at = r.lostAt || 'end';
      lostAt[at] = (lostAt[at] || 0) + 1;
      if (r.lostRow != null) lostRow[r.lostRow] = (lostRow[r.lostRow] || 0) + 1;
    }
    for (const id of r.relics || []) relics[id] = (relics[id] || 0) + 1;
    for (const f of r.foes || []) {
      const L = leaders[f.leader] || (leaders[f.leader] = { fought: 0, beaten: 0 });
      L.fought++;
      if (f.won) L.beaten++;
    }
    for (const [k, v] of Object.entries(r.moneyIn || {})) moneyIn[k] = (moneyIn[k] || 0) + v;
    for (const [k, v] of Object.entries(r.moneyOut || {})) moneyOut[k] = (moneyOut[k] || 0) + v;
  }
  const per = (/** @type {Record<string, number>} */ o) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, n ? round(v / n) : 0]));
  return {
    runs: n,
    won: simWilson(runs.filter(r => r.won).length, n),
    lostAt,
    lostRow,
    avg: Object.fromEntries(SIM_METRICS.filter(k => k !== 'won').map(k => [k, avg(k)])),
    moneyIn: per(moneyIn),
    moneyOut: per(moneyOut),
    relics,
    leaders: Object.fromEntries(
      Object.entries(leaders)
        .sort()
        .map(([id, L]) => [id, { ...L, won: simWilson(L.beaten, L.fought) }])
    ),
  };
}

/**
 * Two reports of the same seeds compared: each side's summary, every metric's paired difference (draft - base), the
 * runs won on one side only (flips), and whether the two are the same run for run. Throws when the seeds differ (a
 * paired compare needs the same list).
 * @param {{ seeds: string[], results: any[] }} base @param {{ seeds: string[], results: any[] }} draft
 */
export function simCompare(base, draft) {
  if (base.seeds.length !== draft.seeds.length || base.seeds.some((s, i) => s !== draft.seeds[i]))
    throw new Error('simCompare: the two reports have different seeds');
  const pairs = base.seeds.map((s, i) => [base.results[i], draft.results[i]]),
    flips = {
      /** @type {string[]} */ won: [],
      /** @type {string[]} */ lost: [],
    };
  pairs.forEach(([b, d], i) => {
    if (!b.won && d.won) flips.won.push(base.seeds[i]);
    if (b.won && !d.won) flips.lost.push(base.seeds[i]);
  });
  return {
    seeds: base.seeds.length,
    same: pairs.every(([b, d]) => JSON.stringify(b) === JSON.stringify(d)),
    base: simSummary(base.results),
    draft: simSummary(draft.results),
    diff: Object.fromEntries(
      SIM_METRICS.map(k => [k, simPaired(pairs.map(([b, d]) => simValue(d, k) - simValue(b, k)))])
    ),
    flips,
  };
}

/** the fixed seed list of n runs: SIM0, SIM1, ... (the same list everywhere, so reports pair) @param {number} n */
export const simSeeds = n => Array.from({ length: n }, (_x, k) => `SIM${k}`);

/**
 * Two reports (runSimOn's runReport, or a saved one) compared as the CLI's --compare and the Run Lab's Simulate card
 * show it: the policy banner, both data hashes, and simCompare's numbers. Throws when the seeds, the options or the
 * policy differ (then it isn't a paired compare of data).
 * @param {any} base @param {any} draft
 */
export function simCompareReports(base, draft) {
  for (const k of ['options', 'policy'])
    if (JSON.stringify(base[k]) !== JSON.stringify(draft[k]))
      throw new Error(`simCompare: the two reports were run with different ${k}`);
  return {
    kind: 'pb-sim-compare',
    version: 1,
    banner: simBanner(base.policy),
    note: base.note,
    options: base.options,
    policy: base.policy,
    policyDriven: base.policyDriven,
    hash: { base: base.dataHash, draft: draft.dataHash },
    ...simCompare(base, draft),
  };
}

/** every table's banner: what the numbers measure @param {{ name: string }} policy */
export const simBanner = policy => `Bot policy ${policy.name}: a lower bound on a careful player, not a prediction`;

/** a short hash of the data a report was made on (FNV-1a of its JSON, keys in order, the maps left out: the
 * simulation reads none of them), shown beside every report so two reports on the same data can be told apart from
 * two on different data @param {any} data */
export function simDataHash(data) {
  let h = 0x811c9dc5;
  const s = JSON.stringify(data, (k, x) =>
    k === 'maps' && x && x === data.maps
      ? undefined
      : x && typeof x === 'object' && !Array.isArray(x)
        ? Object.fromEntries(
            Object.keys(x)
              .sort()
              .map(k2 => [k2, x[k2]])
          )
        : x
  );
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

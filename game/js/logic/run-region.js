// @ts-check
'use strict';
/* ================= A RUN'S REGION (roguelite track RL-R1) =================
   Each seed makes a small region, Pokémon style (roguelite-track.md 9.2): a theme from regions.json, its name built
   from parts ("Pendingvale", "Beta Basin"), its zones in order (each one biome over 2-3 rows of the run's map, the
   next biome taken from the biome graph), a regional dex (whole lines, each as its base or one of its regional
   forms, 15-25 species) and its leaders, picked by the theme's types (the mini-bosses, then the boss).
   - Only the biomes the run can use are drawn (rules.json run.map.biomes, cut by the unlocks: logic/unlocks.js
     unlockOpen), and a theme rolls only when its start biome and one more of its biomes are open.
   - The zones' rows add up to the run map's rows (logic/run-map.js reads them as `zones` in its rules); a map with its
     rows given (the debug menu's short map) gets as many zones as fit them.
   - The dex lists the species of the region's variety of each line; `swap` turns every other variety of those lines
     into it, so a biome pool's Billie of a line in the dex is met as the region's own (logic/wild-pool.js).
   Every choice draws from a stream of its own, salted by what it picks, so the same seed and data make the same
   region. Logic only: no DOM, no game data (every table comes in as an argument): tools/test/run-region.test.mjs. */
/** @import { RegionsData, RegionTheme } from '../../types/game-data' */
/** @import { RunRegion } from '../../types/save-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { formSpeciesId, formTypes } from './forms.js';
import { rngFrom } from './rng.js';
/* eslint-disable no-func-assign */
expose({
  lineStages: [() => lineStages],
  // @ts-expect-error -- replaced on purpose
  lineVariety: [() => lineVariety, v => (lineVariety = v)],
  // @ts-expect-error -- replaced on purpose
  regionDex: [() => regionDex, v => (regionDex = v)],
  // @ts-expect-error -- replaced on purpose
  regionLeaders: [() => regionLeaders, v => (regionLeaders = v)],
  // @ts-expect-error -- replaced on purpose
  runRegionData: [() => runRegionData, v => (runRegionData = v)],
  // @ts-expect-error -- replaced on purpose
  runRegionMake: [() => runRegionMake, v => (runRegionMake = v)],
  // @ts-expect-error -- replaced on purpose
  runRegionName: [() => runRegionName, v => (runRegionName = v)],
  // @ts-expect-error -- replaced on purpose
  runRegionThemes: [() => runRegionThemes, v => (runRegionThemes = v)],
  runRegionZoneCount: [() => runRegionZoneCount],
  // @ts-expect-error -- replaced on purpose
  runZoneOf: [() => runZoneOf, v => (runZoneOf = v)],
  runZoneRegion: [() => runZoneRegion],
  // @ts-expect-error -- replaced on purpose
  zoneBiomes: [() => zoneBiomes, v => (zoneBiomes = v)],
  // @ts-expect-error -- replaced on purpose
  zoneRows: [() => zoneRows, v => (zoneRows = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/**
 * @typedef {{ id: string, names: string[], types: string[][], forms?: { id: string, swap: Record<string, string> }[] }} RegionLine
 * @typedef {{ id: string, type: string }} RegionLeader
 * @typedef {{ regions: RegionsData, lines: RegionLine[], leaders: RegionLeader[] }} RunRegionData
 * what a region is made from: regions.json, the lines (lines/*.json, in their order) and the leaders (the mini-boss
 * trainers and their type)
 */

/** what a region is made from, out of the game's tables (gameData-like: regions, lines) and its trainers
 * @param {{ regions: RegionsData, lines: RegionLine[] }} G @param {Record<string, any>} trainers @returns {RunRegionData} */
export function runRegionData(G, trainers) {
  return {
    regions: G.regions,
    lines: G.lines.map(L => ({ id: L.id, names: L.names, types: L.types, forms: L.forms || [] })),
    leaders: Object.entries(trainers)
      .filter(([, T]) => T && T.miniboss && T.type && T.team && T.team.length)
      .map(([id, T]) => ({ id, type: T.type }))
      .sort((a, b) => (a.id < b.id ? -1 : 1)),
  };
}

/** how many zones a region has at an Expedition (regions.json zones, one per Expedition; past the last, the last)
 * @param {RegionsData} R @param {number} expedition */
export const runRegionZoneCount = (R, expedition) =>
  R.zones[Math.max(0, Math.min(R.zones.length - 1, (expedition || 1) - 1))];

/** the themes that can roll with these biomes open: the start biome and one more of its biomes
 * @param {RegionsData} R @param {string[]} open @returns {Record<string, number>} a weight each */
export function runRegionThemes(R, open) {
  const has = new Set(open);
  return Object.fromEntries(
    Object.entries(R.themes)
      .filter(([, T]) => {
        const mine = Object.keys(T.biomes).filter(b => has.has(b) && T.biomes[b] > 0);
        return mine.length >= 2 && Object.keys(T.start).some(b => has.has(b) && T.start[b] > 0);
      })
      .map(([k, T]) => [k, T.weight ?? 1])
  );
}

/** a region's name from parts: a part with an ending joined on ("Pending" + "vale") or a part and a noun ("Beta
 * Basin"); a part of two words only takes a noun. The theme's endings and nouns come first, the shared ones after
 * @param {string} seed @param {RegionsData} R @param {RegionTheme} T */
export function runRegionName(seed, R, T) {
  const g = rngFrom(seed, 'region|name'),
    N = R.names,
    part = N.parts[g.int(0, N.parts.length - 1)],
    ends = (T.ends || []).concat(N.ends),
    nouns = (T.nouns || []).concat(N.nouns),
    joined = g.next() < N.joined && !part.includes(' ') && ends.length > 0,
    end = ends[g.int(0, Math.max(0, ends.length - 1))],
    noun = nouns[g.int(0, Math.max(0, nouns.length - 1))];
  return joined || !noun ? part + end : `${part} ${noun}`;
}

/** each zone's rows: `count` zones of rows[0]..rows[1] rows each, drawn; with `fit` rows given, as many zones as fit
 * them (one at least, at most `count`), each rows[0] rows, the extra rows given out from the first zone on
 * @param {string} seed @param {[number, number]} rows @param {number} count @param {number} [fit] @returns {number[]} */
export function zoneRows(seed, rows, count, fit) {
  const [lo, hi] = rows;
  if (!fit) {
    const g = rngFrom(seed, 'region|rows');
    return Array.from({ length: count }, () => g.int(lo, hi));
  }
  const n = Math.max(1, Math.min(count, Math.floor(fit / lo), fit)),
    out = Array(n).fill(Math.min(lo, Math.floor(fit / n)));
  for (let left = fit - out.reduce((a, b) => a + b, 0), k = 0; left > 0; k = (k + 1) % n, left--) out[k]++;
  return out;
}

/** the zones' biomes: the first from the theme's start, each next one from the graph (its weight times the theme's),
 * never the one before; when nothing in the theme fits, any open biome but the one before; with one biome open, it
 * @param {string} seed @param {RegionsData} R @param {RegionTheme} T @param {string[]} open @param {number} n */
export function zoneBiomes(seed, R, T, open, n) {
  const has = new Set(open),
    first = Object.fromEntries(Object.entries(T.start).filter(([b]) => has.has(b))),
    out = [rngFrom(seed, 'region|zone|0').pick(first)];
  for (let k = 1; k < n; k++) {
    const prev = out[k - 1],
      G = R.graph[prev] || {},
      /** @type {Record<string, number>} */ W = {};
    for (const b of open) if (b !== prev) W[b] = (G[b] || 0) * (T.biomes[b] || 0);
    if (!Object.values(W).some(w => w > 0)) for (const b of open) if (b !== prev) W[b] = T.biomes[b] || 1;
    out.push(Object.keys(W).length ? rngFrom(seed, 'region|zone|' + k).pick(W) : prev);
  }
  return out;
}

/** a line's best variety for a theme: its base ('') or a form, by how much the theme leans to its types (summed over
 * its stages, each type once a stage); a tie keeps the base. Returns the variety and its score
 * @param {RegionLine} L @param {Record<string, number>} lean @returns {[string, number]} */
export function lineVariety(L, lean) {
  const score = (/** @type {string[][]} */ types) =>
    types.reduce((s, ts) => s + ts.reduce((a, t) => a + (lean[t] || 0), 0), 0);
  /** @type {[string, number]} */
  let best = ['', score(L.types)];
  for (const F of L.forms || []) {
    const v = score(L.types.map(ts => formTypes(ts, F.swap)));
    if (v > best[1]) best = [F.id, v];
  }
  return best;
}

/** a line's species at each stage in a variety ('' its base) @param {RegionLine} L @param {string} form */
export const lineStages = (L, form) => L.names.map((_, st) => (form ? formSpeciesId(L.id, form, st) : L.id + st));

/** the regional dex: lines drawn by how much the theme leans to their best variety's types (weight 1 + that),
 * without repeats, each taken whole while the dex stays within dex[1] species, until it holds dex[0] or more; then
 * in the lines' own order. swap: every other variety's stage of a line in the dex, to the region's
 * @param {string} seed @param {RegionsData} R @param {RegionTheme} T @param {RegionLine[]} lines */
export function regionDex(seed, R, T, lines) {
  const [lo, hi] = R.dex,
    g = rngFrom(seed, 'region|dex'),
    picks = lines.map(L => ({ L, v: lineVariety(L, T.types) })),
    /** @type {Set<string>} */ chosen = new Set();
  let size = 0;
  for (let left = picks.filter(p => p.L.names.length <= hi); left.length && size < lo;) {
    const W = Object.fromEntries(left.map(p => [p.L.id, 1 + p.v[1]])),
      id = g.pick(W),
      p = /** @type {typeof picks[number]} */ (left.find(q => q.L.id === id));
    left = left.filter(q => q !== p);
    if (size + p.L.names.length > hi) continue;
    chosen.add(id);
    size += p.L.names.length;
  }
  /** @type {string[]} */
  const dex = [],
    /** @type {Record<string, string>} */ swap = {},
    /** @type {Record<string, string>} */ forms = {};
  for (const { L, v } of picks) {
    if (!chosen.has(L.id)) continue;
    const mine = lineStages(L, v[0]);
    dex.push(...mine);
    if (v[0]) forms[L.id] = v[0];
    for (const other of ['', ...(L.forms || []).map(F => F.id)])
      if (other !== v[0]) lineStages(L, other).forEach((sp, st) => (swap[sp] = mine[st]));
  }
  return { dex, swap, forms };
}

/** the leaders: `n` of them (the mini-bosses in order, then the boss), each drawn by how much the theme leans to its
 * type, no leader twice; when no leader left has a type the theme leans to, any leader left; with none left, again
 * from all of them @param {string} seed @param {RegionTheme} T @param {RegionLeader[]} leaders @param {number} n */
export function regionLeaders(seed, T, leaders, n) {
  /** @type {string[]} */
  const out = [];
  if (!leaders.length) return out;
  for (let k = 0; k < n; k++) {
    let left = leaders.filter(L => !out.includes(L.id));
    if (!left.length) left = leaders;
    /** @type {Record<string, number>} */
    let W = Object.fromEntries(left.map(L => [L.id, T.types[L.type] || 0]));
    if (!Object.values(W).some(w => w > 0)) W = Object.fromEntries(left.map(L => [L.id, 1]));
    out.push(rngFrom(seed, 'region|leader|' + k).pick(W));
  }
  return out;
}

/**
 * a seed's region. open: the biomes the run can use (rules.json run.map.biomes as the unlocks leave it), expedition: the
 * Expedition, guards: the map's mini-bosses (the leaders are one more: the boss), rows: the map's rows when they are
 * given (the debug menu's short map), else the zones decide them. Null when no theme can roll with these biomes
 * @param {string} seed @param {RunRegionData} data
 * @param {{ open: string[], expedition?: number, guards: number, rows?: number }} o @returns {RunRegion | null}
 */
export function runRegionMake(seed, data, o) {
  const R = data.regions,
    open = o.open.filter(b => R.graph[b]),
    themes = runRegionThemes(R, open);
  if (!Object.keys(themes).length) return null;
  const theme = rngFrom(seed, 'region|theme').pick(themes),
    T = R.themes[theme],
    rows = zoneRows(seed, R.rows, runRegionZoneCount(R, o.expedition || 1), o.rows),
    biomes = zoneBiomes(seed, R, T, open, rows.length),
    { dex, swap, forms } = regionDex(seed, R, T, data.lines);
  return {
    theme,
    name: runRegionName(seed, R, T),
    zones: rows.map((n, k) => ({ biome: biomes[k], rows: n })),
    dex,
    swap,
    forms,
    leaders: regionLeaders(seed, T, data.leaders, o.guards + 1),
  };
}

/** RL-R1: a zone's region on the run's world map (logic/run-bowl.js gives it the zone's biome's ground and trees; a
 * run place's `region`) @param {number} k */
export const runZoneRegion = k => `zone${k}`;

/** the zone a map row is in (the zones' rows in order; past the last, the last) @param {{ rows: number }[]} zones
 * @param {number} row */
export function runZoneOf(zones, row) {
  let at = 0;
  for (let k = 0; k < zones.length; k++) {
    at += zones[k].rows;
    if (row < at) return k;
  }
  return Math.max(0, zones.length - 1);
}

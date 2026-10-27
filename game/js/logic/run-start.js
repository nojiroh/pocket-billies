// @ts-check
'use strict';
/* ================= HOW A RUN STARTS (Studio plan Phase 2, T2.1) =================
   One start for every run, so the same seed and unlocks make the same run wherever it starts: the mast (run.js
   runTakeOff), the run fixtures (fixture.js), the self-test, the run simulation (tools/test/sim/run-sim.mjs) and the
   Studio's Run Lab. runStartPlan decides it without a save: what the run is given (rules.json run.start), the unlocks
   it carries, its map rules with only the biomes those unlocks open (unlocks.js unlockOpen; the debug menu's short map
   overrides rows), its places a path and mini-bosses (WM-2, run-map.js runMapLength: drawn by Expedition), the region
   (RL-R1, run-region.js: its zones fitted to those rows give the map its biomes), and the map they make
   (run-map.js runMapStart: what the landing shows, the forecast).
   runStartOn puts a plan on a save (run-state.js runBegin). What the page does around it (heal, the ranch, the world,
   the flight) stays in run.js. Logic only: no DOM, no Date, no Math.random (tools/test/run-start.test.mjs). */
/** @import { Run, RunBoard, RunGhost, RunMap, RunRegion, SaveData } from '../../types/save-data' */
/** @import { NodeType, RunMapRules, Unlock, HubBuilding } from '../../types/game-data' */
/**
 * @typedef {{ nodeTypes: Record<string, NodeType>, biomes: Record<string, { climate?: string }>,
 *   rules: any, unlockData: { unlocks: Record<string, Unlock>, buildings: Record<string, HubBuilding> },
 *   region?: import('./run-region.js').RunRegionData,
 *   fieldMoves?: Record<string, import('../../types/game-data').FieldMove> }} RunStartData
 * rules is rules.json run (start, map, clock, reveal, ...); region what a run's region is made from (RL-R1,
 * logic/run-region.js runRegionData): without it a run has no region and its map rolls each place's biome; RL-R2:
 * fieldMoves (fieldMoves.json moves) with rules.side make the run's side area (run-side.js; without them, none)
 * @typedef {{ give: ReturnType<typeof runGive>, unlocks: string[], mods: string[],
 *   data: { nodeTypes: Record<string, NodeType>, biomes: Record<string, { climate?: string }>, rules: any },
 *   map: RunMap, forecast: string[][], region: RunRegion | null, board: RunBoard | null,
 *   ghost: RunGhost | null }} RunStartPlan
 * ON-2: board, a daily's or weekly's day or week (logic/daily.js); ghost, the friend's ghost team on the map's ghost
 * node (logic/run-record.js ghostPick; null when none, or no place fits it)
 */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { RELATIONS, RULES, wishTakeoff } from '../hooks.js';
import { relTakeoff } from './relations.js';
import { copyOf, newRun, runBegin } from './run-state.js';
import { runRegionMake } from './run-region.js';
import { runSideForce } from './run-side.js';
import { runMapLength, runMapStart } from './run-map.js';
import { MAPGEN_VERSION } from './mapgen.js';
import { unlockOpen } from './unlocks.js';
/* eslint-disable no-func-assign */
expose({
  runGive: [() => runGive],
  // @ts-expect-error -- replaced on purpose
  runStartOn: [() => runStartOn, v => (runStartOn = v)],
  // @ts-expect-error -- replaced on purpose
  runStartPlan: [() => runStartPlan, v => (runStartPlan = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** what runBegin is given: the run's seed, expedition and generator version, and its money, pyramids and items (run.start)
 * @param {string} seed @param {number} expedition @param {number} mapgenV
 * @param {{ se: number, pyramids: Record<string, number>, items: Record<string, number> }} start */
export const runGive = (seed, expedition, mapgenV, start) => ({
  seed,
  expedition,
  mapgenV,
  se: start.se,
  pyramids: { ...start.pyramids },
  items: { ...start.items },
});

/**
 * a run's start from its seed, before anything touches a save. `unlocks` is what the run carries (unlocks.js
 * runUnlocks of the save; [] a fresh save's), `map` overrides rules.json run.map (the debug menu's short map), `mods`
 * the run's mods (they don't change the map); ON-2: `board` a daily's or weekly's (the caller gives its seed,
 * Expedition, challenges and every unlock: logic/daily.js boardPlan), `ghost` a friend's ghost team (its node on the map)
 * @param {string} seed @param {RunStartData} data
 * @param {{ unlocks?: string[], map?: Partial<RunMapRules>, mods?: string[], expedition?: number,
 *   board?: RunBoard | null, ghost?: RunGhost | null }} [o]
 * @returns {RunStartPlan}
 */
export function runStartPlan(seed, data, o = {}) {
  const expedition = o.expedition || 1,
    unlocks = (o.unlocks || []).slice(),
    given = { ...data.rules.map, ...(o.map || {}) },
    /* WM-2: the run's places a path and its mini-bosses (run.map.path and towns, unless given) */
    rules = { ...given, ...runMapLength(seed, given, expedition) },
    biomes = unlockOpen(rules.biomes, 'biome', unlocks, data.unlockData),
    /* RL-R1: the region, from the biomes open to the run; its zones fit the map's rows (WM-2: the path's) */
    region = data.region
      ? runRegionMake(seed, data.region, {
          open: Object.keys(biomes).filter(b => biomes[b] > 0),
          expedition,
          guards: rules.minibosses,
          rows: rules.rows,
        })
      : null,
    zoned = region ? { rows: region.zones.reduce((n, z) => n + z.rows, 0), zones: region.zones } : {},
    /* RL-R2: the side area, leaning to the region's types, its species the lines the region left out, its leader one
       the region didn't pick; the debug menu's mod can force one */
    theme = region && data.region ? data.region.regions.themes[region.theme] : null,
    side =
      data.fieldMoves && data.rules.side
        ? {
            rules: data.rules.side,
            moves: data.fieldMoves,
            lean: theme ? theme.types : {},
            lines: data.region ? data.region.lines : undefined,
            dex: region ? region.dex : undefined,
            leaders: data.region ? data.region.leaders : [],
            used: region ? region.leaders : [],
            force: runSideForce(o.mods || []),
          }
        : null,
    mapData = {
      nodeTypes: data.nodeTypes,
      biomes: data.biomes,
      rules: { ...data.rules, map: { ...rules, biomes, ...zoned } },
      side,
      ghost: !!o.ghost,
    },
    scratch = newRun(seed, expedition, MAPGEN_VERSION, /** @type {any} */ ({}));
  runMapStart(scratch, mapData);
  return {
    give: runGive(seed, expedition, MAPGEN_VERSION, data.rules.start),
    unlocks,
    mods: (o.mods || []).slice(),
    data: mapData,
    map: /** @type {RunMap} */ (scratch.map),
    forecast: scratch.forecast,
    region,
    board: o.board ? { k: o.board.k, n: o.board.n } : null,
    ghost: o.ghost && scratch.map && scratch.map.nodes.some(nd => nd.type === 'ghost') ? copyOf(o.ghost) : null,
  };
}

/** put a plan on a save: the run begins (runBegin: who travels from home, the packed bag) with the plan's money,
 * items, unlocks, mods, map and forecast. Returns the run
 * @param {SaveData} s @param {RunStartPlan} plan
 * @param {{ home?: string[], pack?: { items: Record<string, number>, pyramids: Record<string, number> } }} [pick]
 * @returns {Run} */
export function runStartOn(s, plan, pick = {}) {
  const run = runBegin(s, { ...plan.give, home: pick.home, pack: pick.pack });
  if (plan.mods.length) run.mods = plan.mods.slice();
  run.unlocks = plan.unlocks.slice();
  run.map = copyOf(plan.map);
  run.forecast = copyOf(plan.forecast);
  if (plan.region) run.region = copyOf(plan.region);
  if (plan.ghost) run.ghost = copyOf(plan.ghost);
  /* ON-2: a daily or weekly is the same for everyone: Blake meets you for the first time, and no hub person's
     bonus or gift rides along */
  if (plan.board) {
    run.board = { ...plan.board };
    if (run.rival) run.rival.past = 0;
    return run;
  }
  /* RL-S2: the hub folk's levels ride along (their run bonuses), and their gifts go into the bag (logic/relations.js) */
  if (RELATIONS) relTakeoff(s, RELATIONS);
  /* HB-10d: a boon or curse from the square's fountain joins this run, an item from it goes into the bag */
  if (RULES && RULES.square && RULES.square.wish) wishTakeoff(s, RULES.square.wish);
  return run;
}

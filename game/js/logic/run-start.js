// @ts-check
'use strict';
/* ================= HOW A RUN STARTS (Studio plan Phase 2, T2.1) =================
   One start for every run, so the same seed and unlocks make the same run wherever it starts: the mast (run.js
   runTakeOff), the run fixtures (fixture.js), the self-test, the run simulation (tools/test/sim/run-sim.mjs) and the
   Studio's Run Lab. runStartPlan decides it without a save: what the run is given (rules.json run.start), the unlocks
   it carries, its map rules with only the biomes those unlocks open (unlocks.js unlockOpen; the debug menu's short map
   overrides rows), and the map they make (run-map.js runMapStart: the deadline, what the landing shows, the forecast).
   runStartOn puts a plan on a save (run-state.js runBegin). What the page does around it (heal, the ranch, the world,
   the flight) stays in run.js. Logic only: no DOM, no Date, no Math.random (tools/test/run-start.test.mjs). */
/** @import { Run, RunMap, SaveData } from '../../types/save-data' */
/** @import { NodeType, RunMapRules, Unlock, HubBuilding } from '../../types/game-data' */
/**
 * @typedef {{ nodeTypes: Record<string, NodeType>, biomes: Record<string, { climate?: string }>,
 *   rules: any, unlockData: { unlocks: Record<string, Unlock>, buildings: Record<string, HubBuilding> } }} RunStartData
 * rules is rules.json run (start, map, clock, reveal, ...)
 * @typedef {{ give: ReturnType<typeof runGive>, unlocks: string[], mods: string[],
 *   data: { nodeTypes: Record<string, NodeType>, biomes: Record<string, { climate?: string }>, rules: any },
 *   map: RunMap, deadline: number, forecast: string[][] }} RunStartPlan
 */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { copyOf, newRun, runBegin } from './run-state.js';
import { runMapStart } from './run-map.js';
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
/** what runBegin is given: the run's seed, tier and generator version, and its money, coins and items (run.start)
 * @param {string} seed @param {number} tier @param {number} mapgenV
 * @param {{ se: number, coins: Record<string, number>, items: Record<string, number> }} start */
export const runGive = (seed, tier, mapgenV, start) => ({
  seed,
  tier,
  mapgenV,
  se: start.se,
  coins: { ...start.coins },
  items: { ...start.items },
});

/**
 * a run's start from its seed, before anything touches a save. `unlocks` is what the run carries (unlocks.js
 * runUnlocks of the save; [] a fresh save's), `map` overrides rules.json run.map (the debug menu's short map), `mods`
 * the run's mods (they don't change the map)
 * @param {string} seed @param {RunStartData} data
 * @param {{ unlocks?: string[], map?: Partial<RunMapRules>, mods?: string[], tier?: number }} [o]
 * @returns {RunStartPlan}
 */
export function runStartPlan(seed, data, o = {}) {
  const tier = o.tier || 1,
    unlocks = (o.unlocks || []).slice(),
    rules = { ...data.rules.map, ...(o.map || {}) },
    mapData = {
      nodeTypes: data.nodeTypes,
      biomes: data.biomes,
      rules: { ...data.rules, map: { ...rules, biomes: unlockOpen(rules.biomes, 'biome', unlocks, data.unlockData) } },
    },
    scratch = newRun(seed, tier, MAPGEN_VERSION, /** @type {any} */ ({}));
  runMapStart(scratch, mapData);
  return {
    give: runGive(seed, tier, MAPGEN_VERSION, data.rules.start),
    unlocks,
    mods: (o.mods || []).slice(),
    data: mapData,
    map: /** @type {RunMap} */ (scratch.map),
    deadline: scratch.deadline,
    forecast: scratch.forecast,
  };
}

/** put a plan on a save: the run begins (runBegin: who travels from home, the packed bag) with the plan's money,
 * items, unlocks, mods, map, deadline and forecast. Returns the run
 * @param {SaveData} s @param {RunStartPlan} plan
 * @param {{ home?: string[], pack?: { items: Record<string, number>, coins: Record<string, number> } }} [pick]
 * @returns {Run} */
export function runStartOn(s, plan, pick = {}) {
  const run = runBegin(s, { ...plan.give, home: pick.home, pack: pick.pack });
  if (plan.mods.length) run.mods = plan.mods.slice();
  run.unlocks = plan.unlocks.slice();
  run.map = copyOf(plan.map);
  run.deadline = plan.deadline;
  run.forecast = copyOf(plan.forecast);
  return run;
}

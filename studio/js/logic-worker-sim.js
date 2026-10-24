'use strict';
/* ================= THE RUN SIMULATION IN THE LOGIC WORKER (Studio plan T3.4) =================
   The simulator's core (game/js/logic/run-sim.js runSimOn) wants the logic by module name and by function name, as
   tools/test/load-logic.mjs hands it in Node. Here those come from the modules the worker has already loaded
   (logic-worker-modules.js imports them first, in their order; these imports only name them). The Run Lab's Simulate
   card asks for runSimReport on both workers (Base and Draft) with the same seeds and options.
   In Node, tools/test/logic-worker.test.mjs checks that this gives the CLI's own report. */
import * as hooks from '../../game/js/hooks.js';
import * as data from '../../game/js/game-data.js';
import * as battleEngine from '../../game/js/logic/battle-engine.js';
import * as battleRewards from '../../game/js/logic/battle-rewards.js';
import * as effects from '../../game/js/logic/effects.js';
import * as fighters from '../../game/js/logic/fighters.js';
import * as perks from '../../game/js/logic/perks.js';
import * as rng from '../../game/js/logic/rng.js';
import * as rules from '../../game/js/logic/rules.js';
import * as runLoop from '../../game/js/logic/run-loop.js';
import * as runMap from '../../game/js/logic/run-map.js';
import * as runRegion from '../../game/js/logic/run-region.js';
import * as runScenes from '../../game/js/logic/run-scenes.js';
import * as runSide from '../../game/js/logic/run-side.js';
import * as runSim from '../../game/js/logic/run-sim.js';
import * as runStart from '../../game/js/logic/run-start.js';
import * as runState from '../../game/js/logic/run-state.js';
import * as saves from '../../game/js/logic/saves.js';
import * as simCompare from '../../game/js/logic/sim-compare.js';
import * as unlocks from '../../game/js/logic/unlocks.js';

/** the simulator's env from the loaded modules (run-sim.js SimEnv) */
export function simWorkerEnv() {
  const modules = {
      'battle-engine': battleEngine,
      'battle-rewards': battleRewards,
      effects,
      fighters,
      perks,
      rng,
      rules,
      'run-loop': runLoop,
      'run-map': runMap,
      'run-region': runRegion,
      'run-scenes': runScenes,
      'run-side': runSide,
      'run-sim': runSim,
      'run-start': runStart,
      'run-state': runState,
      saves,
      'sim-compare': simCompare,
      unlocks,
    },
    logic = Object.assign({}, data, ...Object.values(modules)),
    fn = (/** @type {string} */ name) => {
      if (typeof logic[name] !== 'function') throw new Error(`no logic module exports ${name}`);
      return logic[name];
    };
  return { modules, fn, hooks, data, gameData: globalThis.GAMEDATA, logic };
}

/** the simulator on this worker's data, made on the first ask @type {any} */
let simOnWorker = null;
/**
 * A report over the seeds (run-sim.js runReport) on this worker's data; at most SIM_BROWSER_CAP seeds (the CLI does
 * more) @param {string[]} seeds @param {any} o the runs' options
 */
export function runSimReport(seeds, o) {
  if (seeds.length > simCompare.SIM_BROWSER_CAP)
    throw new Error(`at most ${simCompare.SIM_BROWSER_CAP} seeds in the browser (the CLI runs more)`);
  simOnWorker = simOnWorker || runSim.runSimOn(simWorkerEnv());
  return simOnWorker.runReport(seeds, o);
}

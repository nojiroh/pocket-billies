// @ts-check
'use strict';
/* ========== WHAT A RUN'S WORLD IS MADE FROM (roguelite track RL-7; load track LD-4 moved it here) ==========
   The game data's tables a run's scenes and tables are made from (logic/run-scenes.js), in one place for the page
   (run-world.js) and the run's helper thread (run-worker.js), which loads the same game data.
   Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { ARENAS, FIELD_MOVES, NODE_TYPES, POOLS, RULES, SET_PIECES, TRAINERS, gameData } from '../game-data.js';
import { runRegionData } from './run-region.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  runWorldData: [() => runWorldData, v => (runWorldData = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** what the run's scenes and tables are made from: the game data as the page holds it (POOLS with stand-ins); RL-R1:
 * and its region (logic/run-region.js: regions.json, the lines, the leaders) */
/** @returns {any} */
export function runWorldData() {
  return {
    nodeTypes: NODE_TYPES,
    biomes: gameData.biomes,
    pools: POOLS,
    scenery: gameData.scenery,
    rules: RULES.run,
    region: runRegionData(gameData, TRAINERS),
    /* RL-R2: the field moves that open a run's side area (logic/run-side.js) */
    fieldMoves: FIELD_MOVES,
    /* RT-3: the set pieces a laid-out place is dressed with (logic/mapgen.js mapgenStagePieces) */
    setPieces: SET_PIECES,
    /* WM-7: the leaders' arenas (logic/arena-gen.js) */
    arenas: ARENAS,
  };
}

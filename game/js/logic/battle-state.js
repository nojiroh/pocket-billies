// @ts-check
'use strict';
/* ================= BATTLE STATE (roguelite track RL-4) =================
   The battle as data: what a fighter's place on the field holds (newFieldState) and the battle object itself
   (makeBattle), apart from the engine that plays it (battle-engine.js). Logic only: no DOM, runs in Node
   (tools/test/battle-state.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { STAT_IDS } from '../game-data.js';
expose({ newFieldState: [() => newFieldState] });
/* to-module: end */
/* a fighter's place on the field, fresh: stat stages, turns in, a type override, protection, the last move */
export const newFieldState = () => ({
  st: Object.fromEntries(STAT_IDS.filter(k => k !== 'hp').map(k => [k, 0])),
  turnsIn: 0,
  ov: null,
  ovT: 0,
  protect: false,
  last: null,
  holdN: 0,
  hyped: 0,
  down: false,
});

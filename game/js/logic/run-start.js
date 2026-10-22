// @ts-check
'use strict';
/* ================= HOW A RUN STARTS (Studio plan Phase 2, T2.1) =================
   What a run starts with (rules.json run.start), the hub's team travelling as it is. Logic only: no DOM, no Date, no
   Math.random (tools/test/run-start.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
expose({ runGive: [() => runGive] });
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

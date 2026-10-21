// @ts-check
'use strict';
/* ================= WEATHER ODDS (roguelite track RL-6) =================
   The odds of each weather by kind of place (a climate), moved out of environment.js so a run's forecast can be
   rolled in logic from a seeded stream (logic/run-map.js) and the page's real-clock weather reads the same table.
   Logic only: no DOM, runs in Node (tools/test/weather.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
expose({ CLIMATE_WEATHER_ODDS: [() => CLIMATE_WEATHER_ODDS] });
/* to-module: end */
/* the odds of each weather by kind of place */
/** @type {Record<string, Record<string, number>>} */
export const CLIMATE_WEATHER_ODDS = {
  mild: { clear: 50, cloudy: 22, rain: 16, fog: 8, storm: 4 },
  coast: { clear: 46, cloudy: 20, rain: 18, fog: 10, storm: 6 },
  alpine: { clear: 34, cloudy: 16, snow: 40, fog: 10 },
  volcano: { clear: 40, cloudy: 20, ash: 40 },
  dry: { clear: 80, cloudy: 20 },
  none: { clear: 100 },
};

// @ts-check
'use strict';
/* ================= WEATHER ODDS (roguelite track RL-6) =================
   The odds of each weather by kind of place (a climate), moved out of environment.js so a run's forecast can be
   rolled in logic from a seeded stream (logic/run-map.js) and the page's real-clock weather reads the same table.
   weatherPick turns a roll into a weather: environment.js rolls with a hash of the climate, the day and the 3-hour block,
   a run rolls from its node's stream for the day.
   Logic only: no DOM, runs in Node (tools/test/weather.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  CLIMATE_WEATHER_ODDS: [() => CLIMATE_WEATHER_ODDS],
  // @ts-expect-error -- replaced on purpose
  weatherPick: [() => weatherPick, v => (weatherPick = v)],
});
/* eslint-enable no-func-assign */
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

/** the weather a roll gives a kind of place. roll is in [0, 1); the season changes the mild odds (in winter most rain
 * falls as snow, summer is sunnier with more storms). A climate without odds reads as mild, without the season's change.
 * @param {string} climate @param {number} roll @param {string} [season] @returns {string} */
export function weatherPick(climate, roll, season) {
  const odds = Object.assign({}, CLIMATE_WEATHER_ODDS[climate] || CLIMATE_WEATHER_ODDS.mild);
  if (climate === 'mild' && season === 'winter') {
    odds.snow = (odds.rain || 0) * 0.7;
    odds.rain = (odds.rain || 0) * 0.3;
  }
  if (climate === 'mild' && season === 'summer') {
    odds.clear += 12;
    odds.storm = (odds.storm || 0) + 3;
  }
  const r = roll * Object.values(odds).reduce((a, b) => a + b, 0);
  let acc = 0;
  for (const [k, w] of Object.entries(odds)) {
    acc += w;
    if (r < acc) return k;
  }
  return 'clear';
}

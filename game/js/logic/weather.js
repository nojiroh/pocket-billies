// @ts-check
'use strict';
/* ================= WEATHER ODDS (roguelite track RL-6) =================
   The odds of each weather by kind of place (a climate), moved out of environment.js so a run's forecast can be
   rolled in logic from a seeded stream (logic/run-map.js) and the page's real-clock weather reads the same table.
   weatherPick turns a roll into a weather: environment.js rolls with a hash of the climate, the day and the 3-hour block,
   a run rolls from its node's stream for the day.
   What a weather does in a battle (WEATHER_TYPE_BOOSTS, moved here from things-to-do.js in RL-8) is here too, so a
   run's battle can take its forecast's weather and a run's simulation can play it.
   Logic only: no DOM, runs in Node (tools/test/weather.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  CLIMATE_WEATHER_ODDS: [() => CLIMATE_WEATHER_ODDS],
  WEATHER_TYPE_BOOSTS: [() => WEATHER_TYPE_BOOSTS],
  WILD_TYPE_BOOSTS: [() => WILD_TYPE_BOOSTS],
  // @ts-expect-error -- replaced on purpose
  battleWeatherOf: [() => battleWeatherOf, v => (battleWeatherOf = v)],
  // @ts-expect-error -- replaced on purpose
  weatherPick: [() => weatherPick, v => (weatherPick = v)],
  // @ts-expect-error -- replaced on purpose
  wildLikes: [() => wildLikes, v => (wildLikes = v)],
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

/* ---------- battles feel the weather (moved from things-to-do.js, RL-8) ---------- */
/* each battle weather's move type multipliers ('sunny' and 'night' are clear weather by day and by night) */
/** @type {Record<string, Record<string, number>>} */
export const WEATHER_TYPE_BOOSTS = {
  rain: { Water: 1.2, Fire: 0.8 },
  storm: { Electric: 1.25, Water: 1.15, Fire: 0.8 },
  snow: { Steel: 1.1, Grass: 0.9 },
  fog: { Psychic: 1.1 },
  ash: { Fire: 1.15, Ground: 1.15, Water: 0.9 },
  sunny: { Fire: 1.15, Grass: 1.1, Water: 0.95 },
  night: { Psychic: 1.15, Dragon: 1.1 },
};
/** a battle's weather ({k, m}: its name and its move type multipliers, as battle.wx holds it), with the rules' own
 * changes (rules.json env.battle) laid over; null when it changes nothing
 * @param {string} k @param {{ battle?: Record<string, Record<string, number>> }} [env]
 * @returns {{ k: string, m: Record<string, number> } | null} */
export function battleWeatherOf(k, env) {
  const m = Object.assign({}, WEATHER_TYPE_BOOSTS[k] || {}, ((env || {}).battle || {})[k] || {});
  return Object.keys(m).length ? { k, m } : null;
}

/* ---------- who comes out in what weather (moved from environment.js, RL-8) ---------- */
/* each time of day's and weather's move type multipliers for the wild odds ('sunny' is clear by day) */
/** @type {Record<string, Record<string, number>>} */
export const WILD_TYPE_BOOSTS = {
  night: { Psychic: 2, Dragon: 1.6, Steel: 1.2, Grass: 0.8 },
  dusk: { Flying: 1.4, Psychic: 1.2 },
  sunny: { Grass: 1.25, Fire: 1.2 },
  rain: { Water: 1.8, Electric: 1.3, Fire: 0.6 },
  storm: { Electric: 2.2, Water: 1.6, Flying: 0.6 },
  snow: { Steel: 1.5, Water: 1.2, Grass: 0.7 },
  fog: { Psychic: 1.6, Dragon: 1.3 },
  ash: { Fire: 1.8, Ground: 1.4, Water: 0.7 },
};
/** the wild odds' multipliers with the rules' own likes (rules.json env.likes) laid over
 * @param {Record<string, Record<string, number>>} [likes] @returns {Record<string, Record<string, number>>} */
export function wildLikes(likes) {
  const L = Object.assign({}, WILD_TYPE_BOOSTS);
  for (const k in likes || {}) L[k] = Object.assign({}, L[k] || {}, /** @type {any} */ (likes)[k]);
  return L;
}

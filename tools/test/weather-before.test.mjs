// RL-6: weatherPick (game/js/logic/weather.js) gives the pick environment.js's environmentWeatherFor made before it
// moved out, at every roll its hash can give. The slow tier (tools/unit-tests.mjs SLOW_TESTS): 3.5 million picks.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLIMATE_WEATHER_ODDS, weatherPick } from '../../game/js/logic/weather.js';

/** environmentWeatherFor's pick as it was before RL-6 (environment.js at 2a47ee1), with the hash's value as the roll */
function pickBefore(climate, roll, ss) {
  const odds = Object.assign({}, CLIMATE_WEATHER_ODDS[climate] || CLIMATE_WEATHER_ODDS.mild);
  if (climate === 'mild' && ss === 'winter') {
    odds.snow = (odds.rain || 0) * 0.7;
    odds.rain = (odds.rain || 0) * 0.3;
  }
  if (climate === 'mild' && ss === 'summer') {
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

test('the same pick as the page made before, for every roll its hash can give (k / 100000)', () => {
  const climates = [...Object.keys(CLIMATE_WEATHER_ODDS), 'nowhere'],
    seasons = [undefined, 'spring', 'summer', 'autumn', 'winter'];
  let n = 0;
  for (const c of climates)
    for (const ss of seasons)
      for (let k = 0; k < 100000; k++) {
        const roll = k / 100000;
        if (weatherPick(c, roll, ss) !== pickBefore(c, roll, ss))
          assert.fail(`${c}, ${ss}, roll ${roll}: ${weatherPick(c, roll, ss)} (was ${pickBefore(c, roll, ss)})`);
        n++;
      }
  assert.equal(n, 7 * 5 * 100000);
});

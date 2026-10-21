// RL-6: the weather a roll gives a kind of place (game/js/logic/weather.js), taken out of environment.js
// environmentWeatherFor, which rolls with a hash of the climate, the day and the 3-hour block; a run's forecast rolls
// from its node's stream (logic/run-map.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CLIMATE_WEATHER_ODDS,
  WEATHER_TYPE_BOOSTS,
  WILD_TYPE_BOOSTS,
  battleWeatherOf,
  weatherPick,
  wildLikes,
  wildOddsBy,
} from '../../game/js/logic/weather.js';

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

test('the odds by roll: mild, a mild winter and summer, none, an unknown climate', () => {
  // mild: clear [0, 50), cloudy [50, 72), rain [72, 88), fog [88, 96), storm [96, 100)
  assert.deepEqual(
    [0, 0.49999, 0.5, 0.71999, 0.72, 0.88, 0.96, 0.99999].map(r => weatherPick('mild', r)),
    ['clear', 'clear', 'cloudy', 'cloudy', 'rain', 'fog', 'storm', 'storm']
  );
  // a mild winter: rain 4.8 after cloudy, snow 11.2 last
  assert.deepEqual(
    [0.75, 0.8, 0.95].map(r => weatherPick('mild', r, 'winter')),
    ['rain', 'fog', 'snow']
  );
  // a mild summer: clear 62 of 115, storm 7
  assert.equal(weatherPick('mild', 61.9 / 115, 'summer'), 'clear');
  assert.equal(weatherPick('mild', 0.9999, 'summer'), 'storm');
  for (let k = 0; k < 100; k++) assert.equal(weatherPick('none', k / 100), 'clear');
  // an unknown climate reads as mild, without the season's change
  assert.equal(weatherPick('nowhere', 0.75, 'winter'), 'rain');
  assert.equal(weatherPick('nowhere', 0.95, 'winter'), 'fog');
});

test('every pick is a weather the climate has', () => {
  for (const [c, odds] of Object.entries(CLIMATE_WEATHER_ODDS))
    for (let k = 0; k < 1000; k++) assert.ok(Object.hasOwn(odds, weatherPick(c, k / 1000)), c);
});

test('battle weather (RL-8, moved from things-to-do.js): the same multipliers, the rules laid over, none for cloudy', () => {
  /* things-to-do.js's table before the move (at 78f813d) */
  const BEFORE = {
    rain: { Water: 1.2, Fire: 0.8 },
    storm: { Electric: 1.25, Water: 1.15, Fire: 0.8 },
    snow: { Steel: 1.1, Grass: 0.9 },
    fog: { Psychic: 1.1 },
    ash: { Fire: 1.15, Ground: 1.15, Water: 0.9 },
    sunny: { Fire: 1.15, Grass: 1.1, Water: 0.95 },
    night: { Psychic: 1.15, Dragon: 1.1 },
  };
  assert.deepEqual(WEATHER_TYPE_BOOSTS, BEFORE);
  for (const k of Object.keys(BEFORE)) assert.deepEqual(battleWeatherOf(k), { k, m: BEFORE[k] });
  assert.equal(battleWeatherOf('cloudy'), null);
  assert.equal(battleWeatherOf('clear'), null);
  assert.deepEqual(battleWeatherOf('rain', { battle: { rain: { Fire: 0.5, Grass: 1.1 } } }), {
    k: 'rain',
    m: { Water: 1.2, Fire: 0.5, Grass: 1.1 },
  });
  assert.deepEqual(battleWeatherOf('cloudy', { battle: { cloudy: { Ghost: 1.1 } } }), {
    k: 'cloudy',
    m: { Ghost: 1.1 },
  });
});

test("the wild odds by weather (RL-8, moved from environment.js): the same table, the rules' likes laid over", () => {
  /* environment.js's table before the move (at 93c0ee8) */
  const BEFORE = {
    night: { Psychic: 2, Dragon: 1.6, Steel: 1.2, Grass: 0.8 },
    dusk: { Flying: 1.4, Psychic: 1.2 },
    sunny: { Grass: 1.25, Fire: 1.2 },
    rain: { Water: 1.8, Electric: 1.3, Fire: 0.6 },
    storm: { Electric: 2.2, Water: 1.6, Flying: 0.6 },
    snow: { Steel: 1.5, Water: 1.2, Grass: 0.7 },
    fog: { Psychic: 1.6, Dragon: 1.3 },
    ash: { Fire: 1.8, Ground: 1.4, Water: 0.7 },
  };
  assert.deepEqual(WILD_TYPE_BOOSTS, BEFORE);
  assert.deepEqual(wildLikes(), BEFORE);
  const L = wildLikes({ rain: { Fire: 1 }, cloudy: { Ghost: 2 } });
  assert.deepEqual(L.rain, { Water: 1.8, Electric: 1.3, Fire: 1 });
  assert.deepEqual(L.cloudy, { Ghost: 2 });
  assert.deepEqual(WILD_TYPE_BOOSTS.rain, BEFORE.rain, 'the table itself unchanged');
});

test("a run place's wild odds by its forecast alone (RL-8): clear is sunny, a type's multipliers, no change otherwise", () => {
  const types = { a: ['Water'], b: ['Fire', 'Grass'], c: ['Normal'] },
    list = [
      ['a', 4],
      ['b', 2],
      ['c', 1],
    ],
    of = id => types[id];
  assert.deepEqual(wildOddsBy(list, 'rain', undefined, of), [
    ['a', 4 * 1.8],
    ['b', 2 * 0.6],
    ['c', 1],
  ]);
  assert.deepEqual(wildOddsBy(list, 'clear', undefined, of), [
    ['a', 4],
    ['b', 2 * 1.2 * 1.25],
    ['c', 1],
  ]);
  assert.equal(wildOddsBy(list, 'cloudy', undefined, of), list);
  assert.deepEqual(wildOddsBy(list, 'cloudy', { cloudy: { Normal: 3 } }, of)[2], ['c', 3]);
});

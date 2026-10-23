// The five looks of the time of day (game/js/logic/time-of-day.js): where each sits, that a look is exact at its hour,
// that the blend moves one way between two looks, wraps round midnight and follows the season. No graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIME_OF_DAY_DEFAULTS,
  TIME_OF_DAY_KEYS,
  timeOfDayHours,
  timeOfDayLook,
  todHexRgb,
} from '../../game/js/logic/time-of-day.js';

const T = {
  dawn: { skyTop: '#ff0000' },
  day: {},
  golden: { sunColor: '#ffaa00' },
  dusk: { skyTop: '#0000ff' },
  night: { skyTop: '#000010', sunColor: '#8090ff' },
};
const rise = 6,
  set = 20;
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m || ''} ${a} vs ${b}`);
const nearRgb = (a, b) => a.forEach((v, i) => near(v, b[i]));

test('each look sits at its anchor plus its own offset, in the day’s order', () => {
  const H = timeOfDayHours(T, rise, set);
  assert.deepEqual(
    H.map(e => e.k),
    TIME_OF_DAY_KEYS
  );
  const at = Object.fromEntries(H.map(e => [e.k, e.at]));
  near(at.dawn, rise + TIME_OF_DAY_DEFAULTS.dawn.at);
  near(at.day, (rise + set) / 2);
  near(at.golden, set + TIME_OF_DAY_DEFAULTS.golden.at);
  near(at.dusk, set + TIME_OF_DAY_DEFAULTS.dusk.at);
  near(at.night, (set + TIME_OF_DAY_DEFAULTS.night.at) % 24);
});

test('at a look’s own hour the blend is that look exactly', () => {
  for (const e of timeOfDayHours(T, rise, set)) {
    const L = timeOfDayLook(T, e.at, rise, set);
    assert.equal(L.w[e.k], 1, e.k);
    assert.equal(L.exposure, TIME_OF_DAY_DEFAULTS[e.k].exposure, e.k);
  }
});

test('the previous look holds until the next one’s blend starts, then moves one way', () => {
  const H = Object.fromEntries(timeOfDayHours(T, rise, set).map(e => [e.k, e]));
  const before = timeOfDayLook(T, H.golden.at - H.golden.blend - 0.1, rise, set);
  assert.equal(before.w.day, 1);
  let last = -1;
  for (let x = H.golden.at - H.golden.blend; x <= H.golden.at; x += 0.1) {
    const w = timeOfDayLook(T, x, rise, set).w.golden;
    assert.ok(w >= last - 1e-12, `golden at ${x}: ${w} < ${last}`);
    last = w;
  }
});

test('night wraps round midnight and gives way to dawn before sunrise', () => {
  assert.equal(timeOfDayLook(T, 0, rise, set).w.night, 1);
  assert.equal(timeOfDayLook(T, 3, rise, set).w.night, 1);
  const H = Object.fromEntries(timeOfDayHours(T, rise, set).map(e => [e.k, e]));
  const mid = timeOfDayLook(T, H.dawn.at - H.dawn.blend / 2, rise, set);
  assert.ok(mid.w.night > 0.4 && mid.w.dawn > 0.4);
});

test('the season moves the looks with sunrise and sunset', () => {
  const winter = timeOfDayHours(T, 7.1, 18.4),
    summer = timeOfDayHours(T, 5.3, 21.3);
  assert.ok(winter[0].at > summer[0].at);
  assert.ok(winter[3].at < summer[3].at);
});

test('colours blend in linear light; a look without one uses the other’s (sky) or white light', () => {
  const H = Object.fromEntries(timeOfDayHours(T, rise, set).map(e => [e.k, e]));
  const L = timeOfDayLook(T, H.dusk.at, rise, set);
  nearRgb(L.skyTop, todHexRgb('#0000ff'));
  const d = timeOfDayLook(T, H.day.at, rise, set);
  assert.equal(d.skyMix, 0);
  nearRgb(d.sunColor, [1, 1, 1]);
  assert.equal(todHexRgb('nope'), null);
});

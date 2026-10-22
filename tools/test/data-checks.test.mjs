// Studio plan Phase 1: the shared data checks (game/js/logic/data-checks.js). T1.6: a key starting with `_` in a data
// file is found wherever it is (the Studio's save would drop it).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const C = modules['data-checks'];

test('keys starting with _ are found at any depth; a lone _ and array items are not keys', () => {
  assert.deepEqual(C.dataUnderscoreKeys({ a: 1, _b: 2, c: { _d: { e: 1 }, f: [{ _g: 1 }, '_h'] }, _: 3 }), [
    '_b',
    'c._d',
    'c.f.0._g',
  ]);
  assert.deepEqual(C.dataUnderscoreKeys(['_x', 2, null]), []);
  assert.deepEqual(C.dataUnderscoreKeys(null), []);
});

test('the game data has none', () => {
  assert.deepEqual(C.dataUnderscoreKeys(GAME_DATA), []);
});

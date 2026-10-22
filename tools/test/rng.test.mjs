// RL-2: logic/rng.js, the one seedable random source for game outcomes (roguelite-track.md 2c). The frozen values
// below were taken from logic/mapgen.js before the generator moved out of it (commit c66bf2b), so they prove the move
// changed nothing: the same seed still gives the same numbers and the same generated scene.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const { hashString, rngFrom, rngFn, dailySeed } = modules.rng;
const five = R => [R.next(), R.next(), R.next(), R.next(), R.next()];

test('rng: the same seed and salt give the same stream', () => {
  assert.deepEqual(five(rngFrom('run-a', 'wild|0')), five(rngFrom('run-a', 'wild|0')));
  assert.deepEqual(five(rngFrom(7)), five(rngFrom(7, '')), 'the salt defaults to empty');
});

test('rng: another salt or seed gives an independent stream', () => {
  const a = five(rngFrom('run-a', 'wild|0'));
  assert.notDeepEqual(five(rngFrom('run-a', 'wild|1')), a);
  assert.notDeepEqual(five(rngFrom('run-a', 'shop|0')), a);
  assert.notDeepEqual(five(rngFrom('run-b', 'wild|0')), a);
  // drawing from one stream does not move another
  const w = rngFrom('run-a', 'wild|0'),
    s = rngFrom('run-a', 'shop|0');
  s.next();
  s.next();
  assert.deepEqual(five(w), a);
});

test('rng: the first five values and the hashes are frozen (taken before the move out of mapgen.js)', () => {
  assert.deepEqual(
    five(rngFrom('rl2', 'golden')),
    [0.17132023302838206, 0.33266762970015407, 0.4274886443745345, 0.11666552815586329, 0.8307540505193174]
  );
  assert.equal(hashString('Pocket Billies'), 2667735671);
});

test('rng: a generated scene hashes the same as before the move', () => {
  const sc = modules.mapgen.mapgenScene({ seed: 4242 }, { scenery: GAME_DATA.scenery, biomes: GAME_DATA.biomes }).scene;
  // a change to the scenery or biome data changes this too; then remake it on purpose, said in the commit.
  // MG-2: 301195872 until MAPGEN_VERSION became 2 (the scene is the same but for gen.v), then 2111299369 until the
  // props dials gained mast, clinic and shop (gen.params; the scene is the same)
  // (and 3312083804 until MAPGEN_VERSION 3: pictures no longer scaled, plants given drawn variants)
  // (and 2974976760 until MAPGEN_VERSION 4, RL-8: bridges cross the water; this scene has none, so only gen.v)
  // (and 3214287923 until MAPGEN_VERSION 5: a run's scenes go east to west; this scene is the same but for gen.v)
  // (and 2783618042 until MAPGEN_VERSION 6, TR-2c: tall grass in patches, one across the way west)
  // (and 2339577951 until phase 09 batch 10: the autumn rowan became a model, so it keeps its size, s)
  assert.equal(hashString(JSON.stringify(sc)), 2053084956);
});

test('rng: the helpers stay in their ranges', () => {
  const R = rngFrom('ranges');
  for (let i = 0; i < 500; i++) {
    const v = R.next(),
      n = R.int(2, 5),
      r = R.range(-1, 1);
    assert.ok(v >= 0 && v < 1);
    assert.ok(Number.isInteger(n) && n >= 2 && n <= 5);
    assert.ok(r >= -1 && r < 1);
    assert.ok(['a', 'b'].includes(R.pick({ a: 1, b: 2, c: 0 })), 'a zero weight is never picked');
  }
});

test('rng: rngFn is the stream as a plain function', () => {
  const f = rngFn('run-a', 'battle0');
  assert.equal(typeof f, 'function');
  assert.deepEqual([f(), f(), f(), f(), f()], five(rngFrom('run-a', 'battle0')));
});

test('rng: the daily seed is the UTC date, the same all day everywhere', () => {
  assert.equal(dailySeed(Date.UTC(2026, 9, 21, 0, 0, 0)), 'd2026-10-21');
  assert.equal(dailySeed(Date.UTC(2026, 9, 21, 23, 59, 59, 999)), 'd2026-10-21');
  assert.equal(dailySeed(Date.UTC(2026, 9, 22, 0, 0, 0)), 'd2026-10-22');
  assert.equal(dailySeed(new Date('2026-10-21T23:30:00-05:00')), 'd2026-10-22', 'late evening west of UTC is tomorrow');
  assert.match(dailySeed(), /^d\d{4}-\d{2}-\d{2}$/);
});

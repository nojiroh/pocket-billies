// RL-3: logic/meta-state.js, what lasts between runs (saveData.meta, roguelite-track.md 2a): a new one, the strict
// load check, and filling out a stored one.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-fixture.mjs';

const { newMeta, validMeta, metaFill } = modules['meta-state'];

test('meta: a new one is empty, Expedition I open, and passes the check', () => {
  const m = newMeta();
  assert.deepEqual(m, {
    research: 0,
    scrap: 0,
    crests: 0,
    dna: 0,
    genes: [],
    unlocks: {},
    buildings: {},
    runs: 0,
    wins: 0,
    expedition: 1,
    badges: {},
    history: [],
  });
  assert.equal(validMeta(m), true);
  assert.notEqual(newMeta(), m, 'a fresh object each time');
});

test('meta: broken or tampered shapes are refused', () => {
  const ok = { ...newMeta(), research: 120, runs: 3, wins: 1, unlocks: { lab_board: 1 }, buildings: { ranch: 2 } };
  assert.equal(validMeta(ok), true);
  for (const bad of [
    null,
    [],
    'meta',
    { ...ok, research: -1 },
    { ...ok, scrap: 1.5 },
    { ...ok, crests: '3' },
    { ...ok, research: 1e13 },
    { ...ok, wins: 4 }, // more wins than runs
    { ...ok, expedition: 0 },
    { ...ok, expedition: 10 },
    { ...ok, unlocks: [] },
    { ...ok, unlocks: { lab_board: 2 } },
    { ...ok, unlocks: { 'Bad Key': 1 } },
    { ...ok, buildings: { ranch: 100 } },
    { ...ok, buildings: { ranch: -1 } },
    { ...ok, runs: undefined },
    { ...ok, badges: undefined }, // RL-R2: metaFill gives an old one {}
    { ...ok, badges: { water: 2 } },
    { ...ok, badges: { Water: 1 } },
    { ...ok, badges: ['water'] },
  ])
    assert.equal(validMeta(bad), false, JSON.stringify(bad));
  assert.equal(validMeta(JSON.parse(JSON.stringify(ok).replace('"unlocks":{', '"unlocks":{"__proto__":1,'))), false);
  const many = { ...ok, unlocks: Object.fromEntries(Array.from({ length: 201 }, (_, i) => ['u' + i, 1])) };
  assert.equal(validMeta(many), false);
});

test('meta: a stored one is filled out with new fields; one still broken starts again', () => {
  assert.deepEqual(metaFill({ research: 50, runs: 2 }), { ...newMeta(), research: 50, runs: 2 });
  assert.deepEqual(metaFill(undefined), newMeta());
  assert.deepEqual(metaFill([1]), newMeta());
  assert.deepEqual(metaFill({ research: -5 }), newMeta());
  const kept = { ...newMeta(), crests: 2, expedition: 3, badges: { water: 1, grass: 1 } };
  assert.deepEqual(metaFill(JSON.parse(JSON.stringify(kept))), kept);
});

test('meta: RL-R2: a meta from before badges gets none; badges are kept by type', () => {
  const old = { ...newMeta(), research: 7 };
  delete (/** @type {any} */ (old).badges);
  assert.deepEqual(metaFill(old).badges, {});
  assert.equal(metaFill(old).research, 7);
  assert.deepEqual(newMeta().badges, {});
});

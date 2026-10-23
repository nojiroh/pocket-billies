// RL-3: logic/meta-state.js, what lasts between runs (saveData.meta, roguelite-track.md 2a): a new one, the strict
// load check, and filling out a stored one.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-fixture.mjs';

const { newMeta, validMeta, metaFill } = modules['meta-state'];

test('meta: a new one is empty, Expedition I open, and passes the check', () => {
  const m = newMeta();
  assert.deepEqual(m, { capital: 0, scrap: 0, seals: 0, unlocks: {}, buildings: {}, runs: 0, wins: 0, tier: 1 });
  assert.equal(validMeta(m), true);
  assert.notEqual(newMeta(), m, 'a fresh object each time');
});

test('meta: broken or tampered shapes are refused', () => {
  const ok = { ...newMeta(), capital: 120, runs: 3, wins: 1, unlocks: { lab_board: 1 }, buildings: { ranch: 2 } };
  assert.equal(validMeta(ok), true);
  for (const bad of [
    null,
    [],
    'meta',
    { ...ok, capital: -1 },
    { ...ok, scrap: 1.5 },
    { ...ok, seals: '3' },
    { ...ok, capital: 1e13 },
    { ...ok, wins: 4 }, // more wins than runs
    { ...ok, tier: 0 },
    { ...ok, tier: 10 },
    { ...ok, unlocks: [] },
    { ...ok, unlocks: { lab_board: 2 } },
    { ...ok, unlocks: { 'Bad Key': 1 } },
    { ...ok, buildings: { ranch: 100 } },
    { ...ok, buildings: { ranch: -1 } },
    { ...ok, runs: undefined },
  ])
    assert.equal(validMeta(bad), false, JSON.stringify(bad));
  assert.equal(validMeta(JSON.parse(JSON.stringify(ok).replace('"unlocks":{', '"unlocks":{"__proto__":1,'))), false);
  const many = { ...ok, unlocks: Object.fromEntries(Array.from({ length: 201 }, (_, i) => ['u' + i, 1])) };
  assert.equal(validMeta(many), false);
});

test('meta: a stored one is filled out with new fields; one still broken starts again', () => {
  assert.deepEqual(metaFill({ capital: 50, runs: 2 }), { ...newMeta(), capital: 50, runs: 2 });
  assert.deepEqual(metaFill(undefined), newMeta());
  assert.deepEqual(metaFill([1]), newMeta());
  assert.deepEqual(metaFill({ capital: -5 }), newMeta());
  const kept = { ...newMeta(), seals: 2, tier: 3 };
  assert.deepEqual(metaFill(JSON.parse(JSON.stringify(kept))), kept);
});

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
    beans: 0,
    rel: {},
    gifted: {},
    dna: 0,
    genes: [],
    unlocks: {},
    buildings: {},
    runs: 0,
    wins: 0,
    expedition: 1,
    chapter: 1,
    badges: {},
    history: [],
    residents: {},
    boards: { d: 0, w: 0 },
    show: { s: [], v: [], rw: 0, rib: [] },
    bosses: {},
  });
  assert.equal(validMeta(m), true);
  /* ON-3: the Showcase record */
  const slot = { i: 0, k: 1700000000000, w: 2913, th: 'splice', b: 'b1' },
    rib = { w: 2912, th: 'abom', p: 0, sp: 'bezos0', nick: 'Jeff' };
  assert.equal(validMeta({ ...m, show: { s: [slot], v: ['ann_0_1'], rw: 2912, rib: [rib] } }), true);
  assert.equal(validMeta({ ...m, show: { s: [slot, slot], v: [], rw: 0, rib: [] } }), false);
  assert.equal(validMeta({ ...m, show: { s: [{ ...slot, i: 3 }], v: [], rw: 0, rib: [] } }), false);
  assert.equal(validMeta({ ...m, show: { s: [], v: [], rw: 0, rib: [{ ...rib, p: 10 }] } }), false);
  assert.equal(validMeta({ ...m, show: { s: [], v: [1], rw: 0, rib: [] } }), false);
  assert.equal(metaFill({ ...m, show: 'junk' }).show.s.length, 0, 'a broken Showcase record goes alone');
  assert.equal(metaFill({ ...m, runs: 4, show: 'junk' }).runs, 4);
  /* RL-14b: the bosses.json bosses beaten, how many times */
  assert.equal(validMeta({ ...m, bosses: { retrieval: 3 } }), true);
  assert.equal(validMeta({ ...m, bosses: { retrieval: 1.5 } }), false);
  /* a meta saved before RL-14b is filled out */
  const { bosses, ...old } = m;
  assert.deepEqual(metaFill(old).bosses, {});
  /* ON-2: the last daily and weekly taken off on */
  assert.equal(validMeta({ ...m, boards: { d: 20387, w: 2913 } }), true);
  assert.equal(validMeta({ ...m, boards: { d: -1, w: 0 } }), false);
  assert.equal(validMeta({ ...m, boards: { d: 0, w: 0, x: 1 } }), false);
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
    { ...ok, beans: -1 },
    { ...ok, chapter: 0 },
    { ...ok, rel: { kappi: -1 } },
    { ...ok, gifted: { kappi: 1.5 } },
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
    { ...ok, residents: undefined }, // RS-1: metaFill gives an old one {}
    { ...ok, residents: { dottie: 0 } },
    { ...ok, residents: { dottie: 1.5 } },
    { ...ok, residents: { Dottie: 1 } },
    { ...ok, residents: ['dottie'] },
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

test('meta: RS-1: a meta from before residents gets none; residents are kept with their run', () => {
  const old = { ...newMeta(), runs: 4 };
  delete (/** @type {any} */ (old).residents);
  assert.deepEqual(metaFill(old).residents, {});
  const kept = { ...newMeta(), runs: 4, residents: { dottie: 1, mo: 4 } };
  assert.equal(validMeta(kept), true);
  assert.deepEqual(metaFill(JSON.parse(JSON.stringify(kept))), kept);
});

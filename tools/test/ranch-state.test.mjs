// RL-3: logic/ranch-state.js, the ranch's place in the save (saveData.ranch; the ranch itself is RL-9 and RL-10):
// a new one, the strict load check, and filling out a stored one.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-fixture.mjs';

const { newRanch, validRanch, ranchFill } = modules['ranch-state'];

test('ranch: a new one is empty and passes the check', () => {
  const r = newRanch();
  assert.deepEqual(r, { pens: [], trainees: [], nursery: [], bred: 0, income: { bank: 0, lastAt: 0 }, seen: 0 });
  assert.equal(validRanch(r), true);
});

test('ranch: a filled one passes; broken or tampered shapes are refused', () => {
  const ok = {
    pens: ['u1', 'u2'],
    trainees: [{ uid: 'u1', at: 1000 }],
    nursery: [{ a: 'u1', b: 'u2', mode: 'risky', at: 1000, ready: 5000, egg: { uid: 'e1' } }],
    bred: 3,
    income: { bank: 40, lastAt: 1000 },
    seen: 2000,
  };
  assert.equal(validRanch(ok), true);
  const nurse = ok.nursery[0];
  for (const bad of [
    null,
    [],
    { ...ok, pens: 'u1' },
    { ...ok, pens: ['u1', 'u1'] },
    { ...ok, pens: [''] },
    { ...ok, pens: [7] },
    { ...ok, trainees: [{ uid: 'u1', at: -1 }] },
    { ...ok, trainees: [{ at: 1 }] },
    { ...ok, nursery: [{ ...nurse, mode: 'wild' }] },
    { ...ok, nursery: [{ ...nurse, b: 'u1' }] }, // a Billie can't breed with itself
    { ...ok, nursery: [{ ...nurse, ready: 10 }] }, // ready before it started
    { ...ok, nursery: [{ ...nurse, egg: null }] }, // RL-10: a pair without its egg (validSave checks the egg itself)
    { ...ok, bred: -1 },
    { ...ok, bred: 1.5 },
    { ...ok, seen: -1 },
    { ...ok, seen: 1.5 },
    { ...ok, seen: null },
    { ...ok, income: { ...ok.income, bank: 0.5 } },
    { ...ok, income: { ...ok.income, lastAt: null } },
    { ...ok, income: null },
    { ...ok, pens: Array.from({ length: 501 }, (_, i) => 'u' + i) },
  ])
    assert.equal(validRanch(bad), false, JSON.stringify(bad));
  assert.equal(validRanch(JSON.parse(JSON.stringify(ok).replace('"income":{', '"income":{"__proto__":1,'))), false);
});

test('ranch: a stored one is filled out with new fields; one still broken starts again', () => {
  assert.deepEqual(ranchFill({ pens: ['u1'] }), { ...newRanch(), pens: ['u1'] });
  assert.deepEqual(ranchFill({ income: { bank: 3 } }), { ...newRanch(), income: { bank: 3, lastAt: 0 } });
  // RL-10b: a stored rate (before the rate came from rules.json) is dropped
  assert.deepEqual(ranchFill({ income: { rate: 2, bank: 3, lastAt: 9 } }), {
    ...newRanch(),
    income: { bank: 3, lastAt: 9 },
  });
  assert.deepEqual(ranchFill(null), newRanch());
  assert.deepEqual(ranchFill({ pens: 'all' }), newRanch());
});

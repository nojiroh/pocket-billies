// RS-1: logic/residents.js, the people a run can invite to Copperleaf: this run's one candidate (the free first one,
// then a seeded pick among those left), the invite (one a run), moving in when the run ends, won or lost.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-fixture.mjs';

const { residentCandidate, residentInvite, residentSettle, residentsHere } = modules.residents;
const { newMeta } = modules['meta-state'];
const R = {
  ada: {
    name: 'Ada',
    role: 'Archivist',
    home: 'library',
    first: true,
    meet: { where: ['town'], weight: 1 },
    levels: [],
    about: 'a',
  },
  bo: { name: 'Bo', role: 'Shopkeeper', home: 'shop', meet: { where: ['town'], weight: 2 }, levels: [], about: 'b' },
  cy: {
    name: 'Cy',
    role: 'Innkeeper',
    home: 'inn',
    meet: { where: ['town', 'event'], weight: 1 },
    levels: [],
    about: 'c',
  },
  di: {
    name: 'Di',
    role: 'Geneticist',
    home: 'gene_bank',
    meet: { where: ['town'], weight: 0 },
    levels: [],
    about: 'd',
  },
};
/** a save on a run with this seed, these residents living in Copperleaf @param {string} seed @param {Record<string, number>} [here] */
const onRun = (seed, here = {}) => ({ meta: { ...newMeta(), runs: 3, residents: { ...here } }, run: { seed } });

test('residents: the free first one comes first, then a seeded pick of those left, never one living there', () => {
  assert.equal(residentCandidate(onRun('S1'), R), 'ada');
  assert.equal(residentCandidate(onRun('S1'), R, 'event'), null, 'the first is met in a town only');
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    const c = residentCandidate(onRun(`seed${i}`, { ada: 1 }), R);
    assert.ok(c === 'bo' || c === 'cy', `${c}: one left with a weight`);
    assert.equal(residentCandidate(onRun(`seed${i}`, { ada: 1 }), R), c, 'the same seed, the same one');
    seen.add(c);
  }
  assert.equal(seen.size, 2, 'both are drawn over many seeds');
  assert.equal(residentCandidate(onRun('S1', { ada: 1, bo: 2 }), R, 'event'), 'cy');
  assert.equal(residentCandidate(onRun('S1', { ada: 1, bo: 2, cy: 3 }), R), null, 'nobody with a weight is left');
  assert.equal(residentCandidate({ meta: newMeta(), run: null }, R), null, 'no run, no candidate');
});

test('residents: one invite a run, never for someone living there or not in the table', () => {
  const s = onRun('S1', { bo: 1 });
  assert.equal(residentInvite(s, 'nobody', R), false);
  assert.equal(residentInvite(s, 'bo', R), false, 'lives there already');
  assert.equal(residentInvite(s, 'cy', R), true);
  assert.equal(s.run.invited, 'cy');
  assert.equal(residentInvite(s, 'ada', R), false, 'one a run');
  assert.equal(residentCandidate(s, R), null, 'no other candidate once one is invited');
  assert.equal(residentInvite({ meta: newMeta(), run: null }, 'ada', R), false);
});

test('residents: the invited one moves in at the run’s end, in the order they came', () => {
  const meta = { ...newMeta(), runs: 4, residents: { ada: 2 } };
  assert.equal(residentSettle(meta, { seed: 'x' }), null, 'nobody invited');
  assert.equal(residentSettle(meta, { seed: 'x', invited: 'cy' }), 'cy');
  assert.deepEqual(meta.residents, { ada: 2, cy: 4 });
  assert.equal(residentSettle(meta, { seed: 'x', invited: 'ada' }), null, 'nobody moves in twice');
  assert.deepEqual(meta.residents, { ada: 2, cy: 4 });
  assert.deepEqual(residentsHere({ meta: { ...meta, residents: { cy: 4, bo: 1, ada: 2 } } }), ['bo', 'ada', 'cy']);
  assert.deepEqual(residentsHere({}), []);
});

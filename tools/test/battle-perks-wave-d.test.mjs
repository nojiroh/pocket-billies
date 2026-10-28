// PK-6: Wave D's effect kinds (perks-track.md 5.5 and section 7): the run rules cap, sideOpen, eventHurt and
// sideFind, copy and give, each with test-only Perks first; then the 11 Wave D Perks of perks.json, each working,
// growth and copy over a simulated run, and every Perk of Waves A-D held at once staying finite.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { GAME_DATA, data, fn, hooks, modules, reseed, said, startedSave } from './setup-real.mjs';

const { SPECIES } = data;
/** a species of type T (one of that type alone when there is one) */
const ofType = T => {
  const ids = Object.keys(SPECIES).filter(k => (SPECIES[k].types || []).includes(T));
  return ids.find(k => SPECIES[k].types.length === 1) || ids[0];
};

beforeEach(() => {
  hooks.provide({ activeBattle: null });
  said.length = 0;
});

/** made-up Perks (test-only: never in perks.json) */
const perks = (...defs) => {
  const P = Object.fromEntries(defs.map((d, i) => [d.id || 'test' + i, { name: d.name || 'Test ' + i, ...d }]));
  return { P, fx: fn('fxOfRun')({ perks: Object.keys(P) }, P) };
};
const withPerks = (P, run) => {
  const old = { ...data.PERKS };
  Object.assign(data.PERKS, P);
  try {
    return run();
  } finally {
    for (const k of Object.keys(P)) if (!(k in old)) delete data.PERKS[k];
  }
};
const RULE = GAME_DATA.rules.run.perks;
/** a run holding these Perks (its other Perks fillers of perks.json's first ones) */
const runOf = (...ids) => {
  const r = modules['run-state'].newRun('WAVEDRUN01', 1, 1, { team: [] });
  r.perks = ids;
  return r;
};

/* ---------- rule cap ---------- */

test('PK-6 rule cap: n more Perks held; letting the cap Perk go never leaves more than the cap', () => {
  const PK = modules.perks,
    { P } = perks({ id: 'test_file', fx: [{ kind: 'rule', rule: 'cap', n: 1 }] });
  withPerks(P, () => {
    const fill = Object.keys(data.PERKS).filter(k => !k.startsWith('test')),
      r = runOf();
    assert.equal(PK.perkCap(r, RULE, data.PERKS), RULE.cap);
    for (const id of fill.slice(0, RULE.cap)) assert.equal(PK.perkTake(r, id, data.PERKS, RULE), '');
    assert.equal(PK.perkTake(r, 'test_file', data.PERKS, RULE), 'full');
    assert.equal(PK.perkTake(r, 'test_file', data.PERKS, RULE, fill[0]), '');
    assert.equal(PK.perkCap(r, RULE, data.PERKS), RULE.cap + 1);
    /* one more fits now */
    assert.equal(PK.perkTake(r, fill[RULE.cap], data.PERKS, RULE), '');
    assert.equal(r.perks.length, RULE.cap + 1);
    assert.equal(PK.perkTake(r, fill[RULE.cap + 1], data.PERKS, RULE), 'full');
    /* the file can't be let go at the cap it raises; another can */
    assert.equal(PK.perkDropOk(r, 'test_file', fill[RULE.cap + 1], data.PERKS, RULE), false);
    assert.equal(PK.perkTake(r, fill[RULE.cap + 1], data.PERKS, RULE, 'test_file'), 'cap');
    assert.ok(r.perks.includes('test_file'));
    assert.equal(PK.perkTake(r, fill[RULE.cap + 1], data.PERKS, RULE, fill[1]), '');
    /* a pick's preview order takes up to the raised cap too */
    assert.equal(PK.perkCap(null, RULE, data.PERKS), RULE.cap);
  });
});

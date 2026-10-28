// PK-5: Wave C's effect kinds (perks-track.md 5.4 and section 7): catchLevel, refund, inflict at a battle's start,
// a money share on arrival, free, salvage and the run rules rewardPick, rerollFree and mapReveal, each with test-only
// Perks first; then the 12 Wave C Perks of perks.json, each working, and every Perk of Waves A-C held at once staying
// finite.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { data, fn, hooks, reseed, said, startedSave } from './setup-real.mjs';

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

/** rows of made-up Perks, as fxOfRun gives them (test-only: never in perks.json) */
const perks = (...defs) => {
  const P = Object.fromEntries(defs.map((d, i) => [d.id || 'test' + i, { name: d.name || 'Test ' + i, ...d }]));
  return { P, fx: fn('fxOfRun')({ perks: Object.keys(P) }, P) };
};
/** a seeded wild battle with a team of these species (the first leads), holding these rows; extra laid over */
function battle(fx, team, extra = {}, lvl = 20, foeSp = ofType('Grass')) {
  reseed(7);
  const s = startedSave(team[0], lvl);
  for (const sp of team.slice(1)) s.team.push(fn('makeBilly')(sp, lvl));
  const foe = fn('makeBilly')(foeSp, lvl);
  assert.ok(fn('newBattle')('wild', [foe], { fmt: 'single', seed: 'perk-test-c', ...(fx ? { fx } : {}), ...extra }));
  return hooks.activeBattle;
}
const lines = b => b.events.map(e => e.t || '').filter(Boolean);
const foe = b => b.sides[1].team[0];
const withPerks = (P, run) => {
  const old = { ...data.PERKS };
  Object.assign(data.PERKS, P);
  try {
    return run();
  } finally {
    for (const k of Object.keys(P)) if (!(k in old)) delete data.PERKS[k];
  }
};

/* ---------- catchLevel ---------- */

test('PK-5 catchLevel: a caught Billie joins n levels higher, learning on the way; none without the row', () => {
  const { P, fx } = perks({ id: 'test_tags', name: 'Test Tags', fx: [{ kind: 'catchLevel', n: 2 }] });
  withPerks(P, () => {
    const b = battle(fx, [ofType('Fire')], {}, 20),
      e = foe(b),
      lvl = e.lvl;
    e.hp = 1;
    fn('catchKeep')(e);
    assert.equal(e.lvl, lvl + 2);
    assert.ok(e.hp > 1, 'its HP rose with the levels');
    assert.ok(lines(b).includes(`Test Tags: ${fn('billyName')(e)} joins at level ${lvl + 2}.`), lines(b).join(' | '));
    assert.ok(!lines(b).some(t => t.includes('grew to level')), 'no line a level');
  });
  const c = battle(null, [ofType('Fire')], {}, 20),
    e2 = foe(c);
  fn('catchKeep')(e2);
  assert.equal(e2.lvl, 20);
  /* a condition that doesn't hold: no levels */
  const { fx: fx2 } = perks({ fx: [{ kind: 'catchLevel', n: 3, if: 'foe:spliced' }] });
  const d = battle(fx2, [ofType('Fire')], {}, 20),
    e3 = foe(d);
  fn('catchKeep')(e3);
  assert.equal(e3.lvl, 20);
  assert.equal(
    fn('fxCatchLevel')([
      { kind: 'catchLevel', n: 8 },
      { kind: 'catchLevel', n: 8 },
    ]),
    10
  );
});

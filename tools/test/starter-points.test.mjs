// RL-13: starter points (logic/starter-points.js) on the game's own data: what a Billie costs by rarity, stage and
// levels, the budget by Expedition, what may join a pick (the team's size, the points left, a mono-type run) and the
// default pick the mast and the run sim start with.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, data, fn, modules } from './setup-real.mjs';

const P = modules['starter-points'],
  R = GAME_DATA.rules.run.points,
  SPECIES = data.SPECIES,
  cost = (sp, lvl) => P.pointCost({ sp, lvl }, SPECIES, R);

test('starter points: a Billie costs by rarity, stage and its levels, within the cap', () => {
  /* a starter's first stage at the level a run starts from: the rarity alone */
  assert.equal(cost('musk0', 5), R.rarity.starter);
  assert.equal(cost('kardashian0', 5), R.rarity.uncommon);
  /* a stage higher costs more, each stage up to `most` */
  assert.ok(cost('musk1', 5) > cost('musk0', 5));
  assert.ok(cost('musk2', 5) <= R.most);
  for (const sp of Object.keys(SPECIES)) assert.ok(cost(sp, 1) <= R.most, sp);
  /* RO-2: a final form is priced as one: a two-stage line's final (Sharktank) as a three-stage line's (Aviatorgoose),
     and a Billie with no evolutions (Altmowl, final-stage stats) as its rarity's final (Gigajenzard) */
  assert.equal(cost('cuban1', 5), cost('hughes2', 5), 'Sharktank and Aviatorgoose, both common finals');
  assert.equal(cost('altman0', 5), cost('huang2', 5), 'Altmowl and Gigajenzard, both rare finals');
  assert.ok(cost('altman0', 5) > cost('huang0', 5), 'Altmowl dearer than Siliclet, a first stage');
  assert.equal(cost('hughes1', 5), cost('hughes0', 5) + R.stage, 'a middle stage, one step');
  /* levels cost: one more per perLevels above levelsFrom, wherever they came from (the ranch or a won run) */
  assert.equal(cost('musk0', R.levelsFrom + R.perLevels), cost('musk0', R.levelsFrom) + 1);
  assert.equal(cost('musk0', R.levelsFrom + R.perLevels * 5), cost('musk0', R.levelsFrom) + 5);
  assert.equal(cost('musk0', 1), cost('musk0', R.levelsFrom), 'below levelsFrom costs the same');
  assert.equal(cost('nosuchspecies0', 5), Math.min(...Object.values(R.rarity)), 'an unknown species: the cheapest');
});

test('starter points: the budget by Expedition, and what a pick costs', () => {
  assert.equal(P.pointBudget(R, 1), R.budget[0]);
  assert.equal(P.pointBudget(R, 9), R.budget[R.budget.length - 1], 'past the list: its last');
  const team = [
    { sp: 'musk0', lvl: 5, uid: 'a' },
    { sp: 'kardashian0', lvl: 5, uid: 'b' },
  ];
  assert.equal(P.pointSpend(team, SPECIES, R), cost('musk0', 5) + cost('kardashian0', 5));
  assert.equal(P.pointSpend([], SPECIES, R), 0);
});

test('starter points: what may join a pick, and why not in words', () => {
  const budget = P.pointBudget(R, 1),
    m = { sp: 'musk0', lvl: 5, uid: 'a' },
    ok = P.pointStartable(m, [], SPECIES, R, budget);
  assert.deepEqual([ok.ok, ok.why, ok.cost], [true, '', cost('musk0', 5)]);
  /* the points run out */
  const dear = Array.from({ length: 9 }, (_, k) => ({ sp: 'musk2', lvl: 90, uid: `d${k}` })),
    full = P.pointStartable(m, dear.slice(0, 2), SPECIES, R, 4);
  assert.ok(!full.ok && /point/.test(full.why), full.why);
  /* the team is full */
  const many = Array.from({ length: R.team }, (_, k) => ({ sp: 'musk0', lvl: 1, uid: `m${k}` })),
    crowded = P.pointStartable(m, many, SPECIES, R, 999);
  assert.ok(!crowded.ok && /can go/.test(crowded.why), crowded.why);
  /* one already picked stays in */
  assert.ok(P.pointStartable(m, [m], SPECIES, R, 0).ok);
  /* a mono-type run takes only its type */
  const mono = { mods: modules.modifiers.modsMake(['mono'], 'Water') };
  assert.ok(!P.pointStartable(m, [], SPECIES, R, budget, mono).ok, 'a Fire Billie on a Water run');
  assert.ok(P.pointStartable({ sp: 'bezos0', lvl: 5, uid: 'w' }, [], SPECIES, R, budget, mono).ok);
});

test('starter points: the default pick spends the budget, the buddy first, within the challenges', () => {
  const budget = P.pointBudget(R, 1),
    all = [
      { sp: 'musk0', lvl: 5, uid: 'starter' },
      { sp: 'musk2', lvl: 60, uid: 'trained' },
      { sp: 'bezos0', lvl: 5, uid: 'water' },
      { sp: 'kardashian0', lvl: 5, uid: 'psychic' },
    ],
    pick = P.pointPick(all, SPECIES, R, budget),
    dearest = cost('musk2', 60);
  assert.ok(pick.length >= 1);
  assert.ok(P.pointSpend(pick, SPECIES, R) <= budget, 'never over the budget');
  assert.ok(pick.length <= R.team);
  /* the dearest the budget affords comes first; one too dear for the whole budget is passed over */
  if (dearest <= budget) assert.equal(pick[0].uid, 'trained', `the dearest (${dearest} of ${budget}) first`);
  else assert.ok(!pick.some(m => m.uid === 'trained'), `too dear at ${dearest} points of ${budget}`);
  /* nothing left behind could still have come: the budget is spent down to what is left over */
  const left = budget - P.pointSpend(pick, SPECIES, R);
  for (const m of all)
    if (!pick.includes(m))
      assert.ok(
        P.pointCost(m, SPECIES, R) > left || pick.length >= R.team,
        `${m.uid} costs ${P.pointCost(m, SPECIES, R)} and ${left} was left`
      );
  /* the buddy goes first when it fits */
  assert.equal(P.pointPick(all, SPECIES, R, budget, null, 'water')[0].uid, 'water');
  /* a mono-type run picks only its type */
  const mono = { mods: modules.modifiers.modsMake(['mono'], 'Water') };
  assert.deepEqual(
    P.pointPick(all, SPECIES, R, budget, mono).map(m => m.uid),
    ['water']
  );
  /* one Billie too dear for the budget: nobody goes (the mast's Take off stays off) */
  assert.deepEqual(P.pointPick([{ sp: 'musk2', lvl: 100, uid: 'big' }], SPECIES, R, 1), []);
});

test('RL-13: speciesStep: how far along its line a species is (a final form is a final form)', () => {
  const step = sp => fn('speciesStep')(SPECIES[sp]);
  assert.deepEqual(['hughes0', 'hughes1', 'hughes2'].map(step), [0, 1, 2], 'a three-stage line');
  assert.deepEqual(['cuban0', 'cuban1'].map(step), [0, 2], 'a two-stage line: its second stage is its final');
  assert.equal(step('altman0'), 2, 'a Billie with no evolutions is a final form');
  assert.equal(step('musk3'), 2, 'a split line: both finals');
  assert.equal(fn('speciesStep')(undefined), 0);
});

test('starter points: SP-4 a spliced Billie costs one more per run.points.perStability of Stability its splice spends', () => {
  const far = { front: 'bear_arm@musk3', back: 'bear_leg@musk3' },
    spent = fn('billySpliceCost')({ sp: 'swift0', graft: far });
  assert.ok(spent >= R.perStability, `the splice spends ${spent}`);
  assert.equal(
    P.pointCost({ sp: 'swift0', lvl: 5, graft: far }, SPECIES, R),
    cost('swift0', 5) + Math.floor(spent / R.perStability)
  );
  assert.equal(
    P.pointCost({ sp: 'swift0', lvl: 5, graft: far }, SPECIES, { ...R, perStability: undefined }),
    cost('swift0', 5)
  );
  assert.equal(fn('billySpliceCost')({ sp: 'swift0' }), 0);
});

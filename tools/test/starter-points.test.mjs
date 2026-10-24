// RL-13: starter points (logic/starter-points.js) on the game's own data: what a Billie costs by rarity, stage and
// levels, the budget by Expedition, what may join a pick (the team's size, the points left, a mono-type run) and the
// default pick the mast and the run sim start with.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, data, modules } from './setup-real.mjs';

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

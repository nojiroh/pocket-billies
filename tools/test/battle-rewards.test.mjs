// RL-8: what the end of a battle pays and costs (game/js/logic/battle-rewards.js), moved out of battle.js endBattle.
// The first test is the move's proof: the numbers endBattle worked out inline before the move (copied below as it was)
// against battleRewards, over every outcome, both kinds of battle and many seeded egg rolls.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fn, reseed } from './setup-fixture.mjs';

const battleRewards = fn('battleRewards'),
  wildPrize = fn('wildPrize'),
  pickWeighted = fn('pickWeighted');
const RULES_HERE = { battle: { loseFee: 0.1 }, eggs: { dropChance: 0.12, dropTiers: { 2: 0.6, 5: 0.3, 10: 0.1 } } },
  EGGS_HERE = { 2: {}, 5: {}, 10: {} },
  TIERS_HERE = [2, 5, 10];

/** endBattle's arithmetic before RL-8, as it was (the save and the sheets left out) */
function before(b, s, roll) {
  const kind = b.kind,
    o = b.over === 'draw' ? (kind === 'wild' ? 'ran' : 'lose') : b.over,
    out = { o, fee: 0, prize: 0, egg: 0, reward: 0, first: false, seat: null };
  if (o === 'lose') out.fee = Math.floor(s.se * RULES_HERE.battle.loseFee);
  if (kind === 'wild' && o === 'win') out.prize = b.foe.reduce((a, m) => a + wildPrize(m.lvl), 0);
  const E = RULES_HERE.eggs;
  if (kind === 'wild' && o === 'win' && roll() < E.dropChance) {
    const tiers = Object.entries(E.dropTiers)
      .filter(([t]) => EGGS_HERE[t])
      .map(([t, w]) => [+t, w]);
    out.egg = tiers.length ? pickWeighted(tiers, roll) : TIERS_HERE[0];
  }
  if (kind === 'trainer' && o === 'win') {
    out.reward = b.T.reward || 0;
    out.first = !s.flags[b.tid];
    const st = b.T.seat;
    if (st) out.seat = { id: st.id, nu: !s.seats.includes(st.id), coins: st.coins || {}, items: st.items || {} };
  }
  return out;
}
/** a seeded stream (Park-Miller), so both sides draw the same rolls */
const stream = n => () => (n = (n * 16807) % 2147483647) / 2147483647;

test('battle rewards: the same numbers endBattle worked out before the move', () => {
  reseed();
  const T = { reward: 1200, seat: { id: 'oil', coins: { silver: 3 }, items: { bell: 1 } } },
    plain = { reward: 300 },
    cases = [];
  for (const kind of ['wild', 'trainer'])
    for (const over of ['win', 'lose', 'ran', 'caught', 'bribed', 'draw'])
      for (const se of [0, 7, 600, 12345])
        for (const tr of [T, plain])
          for (const beaten of [false, true])
            cases.push({
              b: { kind, over, T: tr, tid: 'crude', foe: [{ lvl: 3 }, { lvl: 17 }] },
              s: { se, flags: beaten ? { crude: 1 } : {}, seats: beaten ? ['oil'] : [] },
            });
  let eggs = 0;
  for (const [i, { b, s }] of cases.entries())
    for (let k = 0; k < 8; k++) {
      const want = before(b, s, stream(1 + i * 97 + k)),
        got = battleRewards(b, s, stream(1 + i * 97 + k), RULES_HERE, EGGS_HERE, TIERS_HERE);
      assert.deepEqual(got, want, JSON.stringify({ b, s, k }));
      if (got.egg) eggs++;
    }
  assert.ok(eggs > 10, `the seeds should drop some eggs (${eggs})`);
});

test('battle rewards: a lose costs a tenth of the money, a wild win pays $20 a level, a trainer its reward', () => {
  const R = (b, s) => battleRewards(b, s, () => 0.99, RULES_HERE, EGGS_HERE, TIERS_HERE);
  assert.equal(R({ kind: 'wild', over: 'lose', foe: [] }, { se: 995, flags: {}, seats: [] }).fee, 99);
  assert.equal(R({ kind: 'wild', over: 'win', foe: [{ lvl: 5 }] }, { se: 0, flags: {}, seats: [] }).prize, 100);
  assert.equal(R({ kind: 'wild', over: 'draw', foe: [] }, { se: 50, flags: {}, seats: [] }).o, 'ran');
  const t = R({ kind: 'trainer', over: 'draw', T: { reward: 9 }, tid: 'x', foe: [] }, { se: 50, flags: {}, seats: [] });
  assert.equal(t.o, 'lose');
  assert.equal(t.fee, 5);
  const w = R({ kind: 'trainer', over: 'win', T: { reward: 9 }, tid: 'x', foe: [] }, { se: 0, flags: {}, seats: [] });
  assert.deepEqual([w.reward, w.first, w.seat], [9, true, null]);
});

test('battle rewards on a run (RL-8): no lose fee, no egg, no badge; the prize and the reward as in the hub', () => {
  const T = { reward: 300, seat: { id: 'oil', coins: { silver: 3 }, items: {} } },
    s = { se: 1000, flags: {}, seats: [], run: {} };
  let rolls = 0;
  const roll = () => (rolls++, 0);
  const R = b => battleRewards(b, s, roll, RULES_HERE, EGGS_HERE, TIERS_HERE);
  assert.equal(R({ kind: 'wild', over: 'lose', foe: [] }).fee, 0);
  assert.equal(R({ kind: 'trainer', over: 'draw', T, tid: 't', foe: [] }).fee, 0);
  const w = R({ kind: 'wild', over: 'win', foe: [{ lvl: 5 }] });
  assert.deepEqual([w.prize, w.egg, rolls], [100, 0, 0]);
  const t = R({ kind: 'trainer', over: 'win', T, tid: 't', foe: [] });
  assert.deepEqual([t.reward, t.first, t.seat], [300, true, null]);
});

// RL-8: what the end of a battle pays and costs (game/js/logic/battle-rewards.js), moved out of battle.js endBattle.
// The first test is the move's proof: the numbers endBattle worked out inline before the move (copied below as it was)
// against battleRewards, over every outcome and both kinds of battle. RL-10 (on purpose): wild wins drop no eggs any
// more, so the egg's roll and field are gone from both sides and battleRewards takes no chance.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fn, reseed } from './setup-fixture.mjs';

const battleRewards = fn('battleRewards'),
  wildPrize = fn('wildPrize');
const RULES_HERE = { battle: { loseFee: 0.1 } };

/** endBattle's arithmetic before RL-8, as it was (the save and the sheets left out) */
function before(b, s) {
  const kind = b.kind,
    o = b.over === 'draw' ? (kind === 'wild' ? 'ran' : 'lose') : b.over,
    out = { o, fee: 0, prize: 0, reward: 0, first: false, seat: null };
  if (o === 'lose') out.fee = Math.floor(s.se * RULES_HERE.battle.loseFee);
  if (kind === 'wild' && o === 'win') out.prize = b.foe.reduce((a, m) => a + wildPrize(m.lvl), 0);
  if (kind === 'trainer' && o === 'win') {
    out.reward = b.T.reward || 0;
    out.first = !s.flags[b.tid];
    const st = b.T.seat;
    if (st) out.seat = { id: st.id, nu: !s.seats.includes(st.id), coins: st.coins || {}, items: st.items || {} };
  }
  return out;
}
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
  for (const { b, s } of cases)
    assert.deepEqual(
      battleRewards(b, s, () => 0.5, RULES_HERE),
      before(b, s),
      JSON.stringify({ b, s })
    );
});

test('battle rewards: a lose costs a tenth of the money, a wild win pays $20 a level, a trainer its reward', () => {
  const R = (b, s) => battleRewards(b, s, () => 0.5, RULES_HERE);
  assert.equal(R({ kind: 'wild', over: 'lose', foe: [] }, { se: 995, flags: {}, seats: [] }).fee, 99);
  assert.equal(R({ kind: 'wild', over: 'win', foe: [{ lvl: 5 }] }, { se: 0, flags: {}, seats: [] }).prize, 100);
  assert.equal(R({ kind: 'wild', over: 'draw', foe: [] }, { se: 50, flags: {}, seats: [] }).o, 'ran');
  const t = R({ kind: 'trainer', over: 'draw', T: { reward: 9 }, tid: 'x', foe: [] }, { se: 50, flags: {}, seats: [] });
  assert.equal(t.o, 'lose');
  assert.equal(t.fee, 5);
  const w = R({ kind: 'trainer', over: 'win', T: { reward: 9 }, tid: 'x', foe: [] }, { se: 0, flags: {}, seats: [] });
  assert.deepEqual([w.reward, w.first, w.seat], [9, true, null]);
});

test('battle rewards on a run (RL-8): no lose fee, no badge; the prize and the reward as in the hub', () => {
  const T = { reward: 300, seat: { id: 'oil', coins: { silver: 3 }, items: {} } },
    s = { se: 1000, flags: {}, seats: [], run: {} };
  const R = b => battleRewards(b, s, () => 0.5, RULES_HERE);
  assert.equal(R({ kind: 'wild', over: 'lose', foe: [] }).fee, 0);
  assert.equal(R({ kind: 'trainer', over: 'draw', T, tid: 't', foe: [] }).fee, 0);
  const w = R({ kind: 'wild', over: 'win', foe: [{ lvl: 5 }] });
  assert.deepEqual([w.prize, 'egg' in w], [100, false]);
  const t = R({ kind: 'trainer', over: 'win', T, tid: 't', foe: [] });
  assert.deepEqual([t.reward, t.first, t.seat], [300, true, null]);
});

// RL-8: what the end of a battle pays and costs (game/js/logic/battle-rewards.js), moved out of battle.js endBattle.
// RL-10 (on purpose): wild wins drop no eggs any more, so battleRewards takes no chance.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fn } from './setup-fixture.mjs';

const battleRewards = fn('battleRewards');
const RULES_HERE = { battle: { loseFee: 0.1 } };

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
  const seat = { id: 'oil', coins: { step_pyramid: 3 } },
    again = R(
      { kind: 'trainer', over: 'win', T: { reward: 9, seat }, tid: 'x', foe: [] },
      { se: 0, flags: { x: 1 }, seats: ['oil'] }
    );
  assert.deepEqual([again.first, again.seat], [false, { id: 'oil', nu: false, coins: { step_pyramid: 3 }, items: {} }]);
});

test('battle rewards on a run (RL-8): no lose fee, no badge; the prize and the reward as in the hub', () => {
  const T = { reward: 300, seat: { id: 'oil', coins: { step_pyramid: 3 }, items: {} } },
    s = { se: 1000, flags: {}, seats: [], run: {} };
  const R = b => battleRewards(b, s, () => 0.5, RULES_HERE);
  assert.equal(R({ kind: 'wild', over: 'lose', foe: [] }).fee, 0);
  assert.equal(R({ kind: 'trainer', over: 'draw', T, tid: 't', foe: [] }).fee, 0);
  const w = R({ kind: 'wild', over: 'win', foe: [{ lvl: 5 }] });
  assert.deepEqual([w.prize, 'egg' in w], [100, false]);
  const t = R({ kind: 'trainer', over: 'win', T, tid: 't', foe: [] });
  assert.deepEqual([t.reward, t.first, t.seat], [300, true, null]);
});

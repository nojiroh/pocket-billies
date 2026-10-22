// RL-8: the run simulation (tools/test/sim/run-sim.mjs) plays a whole run from its seed with the logic in plain Node.
// The replay: the same seed played twice comes out the same, even with util.js random seeded differently, so nothing
// a run decides hangs on Math.random (roguelite-track.md 2c). The statistics are the owner's to judge (report only):
// run node tools/test/sim/run-sim.mjs for the numbers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSim, runStats } from './sim/run-sim.mjs';

test('run sim: a seed played twice is the same run, whatever util.js random draws meanwhile', () => {
  for (const seed of ['SIMREPLAY0', 'SIMREPLAY1']) {
    const a = runSim(seed, { random: 1, team: 3 }),
      b = runSim(seed, { random: 4242, team: 3 });
    assert.deepEqual(b.log, a.log, seed);
    assert.ok(a.log.places.length >= 1 && a.stats.battles >= 1, JSON.stringify(a.stats));
  }
  const c = runSim('SIMREPLAY2', { team: 3 });
  assert.notDeepEqual(c.log, runSim('SIMREPLAY0', { team: 3 }).log, 'another seed, another run');
});

test('run sim: the report has its numbers', () => {
  const R = runStats(3, { team: 3 });
  assert.equal(R.runs, 3);
  for (const k of ['days', 'places', 'battles', 'turnsPerBattle', 'capital']) assert.ok(R[k] >= 0, k);
  assert.ok(R.won >= 0 && R.won <= 3);
});

test('run sim: a run starts as the mast starts it, with no unlocks or every one', () => {
  const none = runSim('SIMUNLOCK0', { team: 3 }),
    all = runSim('SIMUNLOCK0', { team: 3, unlocks: 'all' });
  assert.deepEqual(none.log.unlocks, []);
  assert.ok(all.log.unlocks.includes('biome_ridge') && all.log.unlocks.includes('shop_settlement'));
});

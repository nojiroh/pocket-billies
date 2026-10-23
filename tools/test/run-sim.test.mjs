// RL-8: the run simulation (tools/test/sim/run-sim.mjs) plays a whole run from its seed with the logic in plain Node.
// The replay: the same seed played twice comes out the same, even with util.js random seeded differently, so nothing
// a run decides hangs on Math.random (roguelite-track.md 2c). The statistics are the owner's to judge (report only):
// run node tools/test/sim/run-sim.mjs for the numbers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSim, runStats } from './sim/run-sim.mjs';
import { GAME_DATA, modules } from './setup-real.mjs';

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
  // Studio plan T3.2: every report names its bot policy, its settings and the numbers it drives
  assert.equal(R.policy.name, 'greedy-forward');
  assert.equal(R.policy.fights, 2);
  assert.equal(runStats(1, { team: 3, fights: 4 }).policy.fights, 4);
  assert.ok(R.policyDriven.includes('caught') && /not a balance oracle/.test(R.note));
});

test('run sim: a run starts as the mast starts it, with no unlocks or every one', () => {
  const none = runSim('SIMUNLOCK0', { team: 3 }),
    all = runSim('SIMUNLOCK0', { team: 3, unlocks: 'all' });
  assert.deepEqual(none.log.unlocks, []);
  assert.ok(all.log.unlocks.includes('biome_ridge') && all.log.unlocks.includes('shop_settlement'));
});

test("run sim: a run town's shop stocks only what the run has unlocked (Studio plan T3.3)", () => {
  const locked = ['settlement', 'appeal', 'bailout'];
  let towns = 0;
  for (let k = 0; k < 12; k++)
    for (const at of runSim(`SIMSHOP${k}`, { team: 3 }).log.places)
      if (at.shop) {
        towns++;
        assert.ok(!at.shop.some(w => locked.includes(w)), `SIMSHOP${k} node ${at.i}: ${at.shop}`);
      }
  assert.ok(towns >= 2, `${towns} towns`);
});

test('run sim: the policy answers a Loophole on offer: greedy takes the rarest, never takes none (Studio plan T3.3)', () => {
  const { simRelicChoice, SIM_POLICIES } = modules['run-sim'],
    RELICS = GAME_DATA.relics,
    rule = GAME_DATA.rules.run.relics,
    greedy = SIM_POLICIES['greedy-forward'],
    never = SIM_POLICIES['never-pick'];
  assert.deepEqual(simRelicChoice(['offshore', 'hedge', 'insider'], [], RELICS, rule, greedy), { id: 'hedge' });
  assert.deepEqual(simRelicChoice(['shelter', 'offshore'], [], RELICS, rule, greedy), { id: 'offshore' }, 'then by id');
  assert.equal(simRelicChoice(['hedge'], [], RELICS, rule, never), null);
  const full = ['offshore', 'shelter', 'lobbyist', 'fineprint', 'insider', 'severance'];
  assert.equal(full.length, rule.cap);
  assert.deepEqual(
    simRelicChoice(['hedge'], full, RELICS, rule, greedy),
    { id: 'hedge', drop: 'shelter' },
    'past the cap'
  );
  assert.equal(
    simRelicChoice(
      ['offshore'],
      ['insider', 'takeover', 'hedge', 'severance', 'options', 'writeoff'],
      RELICS,
      rule,
      greedy
    ),
    null,
    'no rarer'
  );
  /* and on a run: the pick answered through relics.js relicChoose, as relic-screen.js does */
  const run = { seed: 'P', relics: [], offer: ['offshore', 'hedge', 'insider'] },
    c = simRelicChoice(run.offer, run.relics, RELICS, rule, greedy);
  assert.equal(modules.relics.relicChoose(run, c.id, RELICS, rule, c.drop), '');
  assert.deepEqual(run.relics, ['hedge']);
  assert.equal(run.offer, null);
});

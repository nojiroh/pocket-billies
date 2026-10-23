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

test('run sim: a town shop’s Loophole is bought under greedy-forward and never under never-pick (Studio plan T3.3)', () => {
  let bought = 0,
    shelves = 0;
  for (let k = 0; k < 12; k++) {
    const g = runSim(`SIMSHOP${k}`, { team: 3 }),
      n = runSim(`SIMSHOP${k}`, { team: 3, policy: 'never-pick' });
    for (const at of g.log.places) if (at.relic) (shelves++, at.relic.bought && bought++);
    assert.ok(!n.log.places.some(at => at.relic && at.relic.bought), 'never-pick buys none');
  }
  assert.ok(shelves >= 2 && bought >= 1, `${bought} bought of ${shelves} on a shelf`);
  assert.throws(() => runSim('X', { policy: 'nobody' }), /no simulation policy nobody/);
});

test("run sim: the run's map is runStartPlan's for the save's unlocks: no locked biome without them (Studio plan T3.3)", () => {
  const { runStartPlan } = modules['run-start'],
    R = GAME_DATA.rules.run,
    D = {
      nodeTypes: GAME_DATA.nodeTypes,
      biomes: GAME_DATA.biomes,
      rules: R,
      unlockData: { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings },
    },
    nodes = plan => plan.map.nodes.map(n => `${n.type}:${n.biome}`);
  for (const seed of ['SIMPLAN0', 'SIMPLAN1', 'SIMPLAN2']) {
    const none = runSim(seed, { team: 3 }).log,
      all = runSim(seed, { team: 3, unlocks: 'all' }).log;
    assert.deepEqual(none.nodes, nodes(runStartPlan(seed, D, { unlocks: [] })), seed);
    assert.deepEqual(all.nodes, nodes(runStartPlan(seed, D, { unlocks: all.unlocks })), seed);
    assert.ok(!none.nodes.some(n => /:(ridge|autumn)$/.test(n)), `${seed}: ${none.nodes}`);
  }
});

test('run sim: money in and out add up to what is left; a loss names its row; foes and Loopholes are listed (T3.4)', () => {
  const start = GAME_DATA.rules.run.start.se,
    sum = o => Object.values(o).reduce((a, x) => a + x, 0);
  let towns = 0;
  for (let k = 0; k < 10; k++) {
    const { stats: x, log } = runSim(`SIMMONEY${k}`, { team: 3 });
    assert.equal(start + sum(x.moneyIn) - sum(x.moneyOut), x.se, `SIMMONEY${k}`);
    assert.equal(x.spent, x.moneyOut.shop + x.moneyOut.relics);
    assert.equal(x.healed, x.moneyOut.heal);
    if (!x.won && x.lostAt) {
      const at = log.places[log.places.length - 1];
      assert.ok(Number.isInteger(x.lostRow) && x.lostRow >= 0, `${x.lostRow} at node ${at.i}`);
    }
    assert.ok(Array.isArray(x.relics) && Array.isArray(x.foes));
    towns += log.places.filter(p => p.shop).length;
  }
  assert.ok(towns >= 1);
});

test('run sim: balance mode (no scenes) plays every seed as the full mode does (Studio plan T3.3)', () => {
  const strip = log => ({ ...log, scenes: undefined, mode: undefined });
  for (const o of [{ team: 3 }, { team: 3, unlocks: 'all', pack: 5, fights: 4 }])
    for (let k = 0; k < 6; k++) {
      const full = runSim(`SIMBAL${k}`, o),
        fast = runSim(`SIMBAL${k}`, { ...o, scenes: 'skip' });
      assert.deepEqual(strip(fast.log), strip(full.log), `SIMBAL${k} ${JSON.stringify(o)}`);
      assert.deepEqual(fast.stats, full.stats);
      assert.equal(fast.log.mode, 'balance');
      assert.equal(fast.log.scenes, null, 'no scenes were made');
    }
});

test('run sim: balance mode is at least 20 times faster; its stand-in (tall grass in every place) holds on real scenes', () => {
  const time = o => {
    const t0 = performance.now();
    for (let k = 0; k < 3; k++) runSim(`SIMFAST${k}`, { team: 3, ...o });
    return performance.now() - t0;
  };
  time({ scenes: 'skip' });
  const full = time({}),
    fast = time({ scenes: 'skip' });
  assert.ok(full / fast >= 20, `full ${Math.round(full)} ms, balance ${Math.round(fast)} ms`);
  /* the one thing balance mode stands in for: every run place's ground has tall grass (rules.js encounterStock) */
  const { runStartPlan } = modules['run-start'],
    { runScenesMake } = modules['run-scenes'],
    R = GAME_DATA.rules.run,
    D = { nodeTypes: GAME_DATA.nodeTypes, biomes: GAME_DATA.biomes, rules: R },
    world = { ...D, pools: GAME_DATA.pools, scenery: GAME_DATA.scenery };
  for (let k = 0; k < 4; k++) {
    const plan = runStartPlan(`SIMGRASS${k}`, { ...D, unlockData: { unlocks: {}, buildings: {} } }, {}),
      scenes = runScenesMake({ seed: `SIMGRASS${k}`, map: plan.map, mods: [] }, world);
    scenes.forEach((sc, i) =>
      assert.ok(sc.tiles.join('').includes(modules['run-sim'].SIM_LITE_PLACE.tiles), `SIMGRASS${k} node ${i}`)
    );
  }
});

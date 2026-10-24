// RL-8: the run simulation (tools/test/sim/run-sim.mjs) plays a whole run from its seed with the logic in plain Node.
// The replay: the same seed played twice comes out the same, even with util.js random seeded differently, so nothing
// a run decides hangs on Math.random (roguelite-track.md 2c). The statistics are the owner's to judge (report only):
// run node tools/test/sim/run-sim.mjs for the numbers.
// The runs here are in balance mode (no scenes made): run-sim-scenes.test.mjs (the slow tier) plays seeds in both
// modes and checks they come out the same, so what a run decides is checked here at a fraction of the time.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runReport, runSim, runStats, simSideNext } from './sim/run-sim.mjs';
import { data, GAME_DATA, modules } from './setup-real.mjs';

const B = { team: 3, scenes: 'skip' };

test('run sim: a seed played twice is the same run, whatever util.js random draws meanwhile (balance mode)', () => {
  for (const seed of ['SIMREPLAY0', 'SIMREPLAY1']) {
    const a = runSim(seed, { random: 1, ...B }),
      b = runSim(seed, { random: 4242, ...B });
    assert.deepEqual(b.log, a.log, seed);
    assert.ok(a.log.places.length >= 1 && a.stats.battles >= 1, JSON.stringify(a.stats));
  }
  const c = runSim('SIMREPLAY2', B);
  assert.notDeepEqual(c.log, runSim('SIMREPLAY0', B).log, 'another seed, another run');
});

test('run sim: the report has its numbers', () => {
  const R = runStats(3, B);
  assert.equal(R.runs, 3);
  for (const k of ['days', 'places', 'battles', 'turnsPerBattle', 'research']) assert.ok(R[k] >= 0, k);
  assert.ok(R.won >= 0 && R.won <= 3);
  // Studio plan T3.2: every report names its bot policy, its settings and the numbers it drives
  assert.equal(R.policy.name, 'greedy-forward');
  assert.equal(R.policy.fights, 2);
  assert.equal(runStats(1, { ...B, fights: 4 }).policy.fights, 4);
  assert.ok(R.policyDriven.includes('caught') && /not a balance oracle/.test(R.note));
  assert.ok(R.policyDriven.includes('spent') && R.policyDriven.includes('perks'), 'what the policy buys');
});

test('run sim: a run starts as the mast starts it, with no unlocks or every one', () => {
  const none = runSim('SIMUNLOCK0', B),
    all = runSim('SIMUNLOCK0', { ...B, unlocks: 'all' });
  assert.deepEqual(none.log.unlocks, []);
  assert.ok(all.log.unlocks.includes('biome_ridge') && all.log.unlocks.includes('shop_nerve_tonic'));
});

test("run sim: a run town's shop stocks only what the run has unlocked (Studio plan T3.3)", () => {
  const locked = ['nerve_tonic', 'wake_tea', 'revive'];
  let towns = 0;
  for (let k = 0; k < 12; k++)
    for (const at of runSim(`SIMSHOP${k}`, B).log.places)
      if (at.shop) {
        towns++;
        assert.ok(!at.shop.some(w => locked.includes(w)), `SIMSHOP${k} node ${at.i}: ${at.shop}`);
      }
  assert.ok(towns >= 2, `${towns} towns`);
});

test('run sim: the policy answers a Perk on offer: greedy takes the rarest, never takes none (Studio plan T3.3)', () => {
  const { simPerkChoice, SIM_POLICIES } = modules['run-sim'],
    PERKS = GAME_DATA.perks,
    rule = GAME_DATA.rules.run.perks,
    greedy = SIM_POLICIES['greedy-forward'],
    never = SIM_POLICIES['never-pick'];
  assert.deepEqual(simPerkChoice(['lucky_charm', 'bubble_wrap', 'running_shoes'], [], PERKS, rule, greedy), {
    id: 'bubble_wrap',
  });
  assert.deepEqual(
    simPerkChoice(['clinic_card', 'lucky_charm'], [], PERKS, rule, greedy),
    { id: 'lucky_charm' },
    'then in perks.json order'
  );
  assert.equal(simPerkChoice(['bubble_wrap'], [], PERKS, rule, never), null);
  const full = ['lucky_charm', 'clinic_card', 'coupon_book', 'steady_hand', 'running_shoes', 'trail_snacks'];
  assert.equal(full.length, rule.cap);
  assert.deepEqual(
    simPerkChoice(['bubble_wrap'], full, PERKS, rule, greedy),
    { id: 'bubble_wrap', drop: 'steady_hand' },
    'past the cap: the last common one in perks.json'
  );
  assert.equal(
    simPerkChoice(
      ['lucky_charm'],
      ['running_shoes', 'power_gloves', 'bubble_wrap', 'trail_snacks', 'field_notebook', 'lost_property'],
      PERKS,
      rule,
      greedy
    ),
    null,
    'no rarer'
  );
  /* and on a run: the pick answered through perks.js perkChoose, as perk-screen.js does */
  const run = { seed: 'P', perks: [], offer: ['lucky_charm', 'bubble_wrap', 'running_shoes'] },
    c = simPerkChoice(run.offer, run.perks, PERKS, rule, greedy);
  assert.equal(modules.perks.perkChoose(run, c.id, PERKS, rule, c.drop), '');
  assert.deepEqual(run.perks, ['bubble_wrap']);
  assert.equal(run.offer, null);
});

test('run sim: a town shop’s Perk is bought under greedy-forward and never under never-pick (Studio plan T3.3)', () => {
  let bought = 0,
    shelves = 0;
  for (let k = 0; k < 12; k++) {
    const g = runSim(`SIMSHOP${k}`, B),
      n = runSim(`SIMSHOP${k}`, { ...B, policy: 'never-pick' });
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
      region: modules['run-region'].runRegionData(GAME_DATA, data.TRAINERS),
      fieldMoves: GAME_DATA.fieldMoves.moves,
    },
    nodes = plan => plan.map.nodes.map(n => `${n.type}:${n.biome}`);
  for (const seed of ['SIMPLAN0', 'SIMPLAN1', 'SIMPLAN2']) {
    const none = runSim(seed, B).log,
      all = runSim(seed, { ...B, unlocks: 'all' }).log;
    assert.deepEqual(none.nodes, nodes(runStartPlan(seed, D, { unlocks: [] })), seed);
    assert.deepEqual(all.nodes, nodes(runStartPlan(seed, D, { unlocks: all.unlocks })), seed);
    assert.ok(!none.nodes.some(n => /:(ridge|autumn)$/.test(n)), `${seed}: ${none.nodes}`);
  }
});

test('run sim: money in and out add up to what is left; a loss names its row; foes and Perks are listed (T3.4)', () => {
  const start = GAME_DATA.rules.run.start.se,
    sum = o => Object.values(o).reduce((a, x) => a + x, 0);
  let towns = 0;
  for (let k = 0; k < 10; k++) {
    const { stats: x, log } = runSim(`SIMMONEY${k}`, B);
    assert.equal(start + sum(x.moneyIn) - sum(x.moneyOut), x.se, `SIMMONEY${k}`);
    assert.equal(x.spent, x.moneyOut.shop + x.moneyOut.perks);
    assert.equal(x.healed, x.moneyOut.heal);
    if (!x.won && x.lostAt) {
      const at = log.places[log.places.length - 1];
      assert.ok(Number.isInteger(x.lostRow) && x.lostRow >= 0, `${x.lostRow} at node ${at.i}`);
    }
    assert.ok(Array.isArray(x.perks) && Array.isArray(x.foes));
    towns += log.places.filter(p => p.shop).length;
  }
  assert.ok(towns >= 1);
});

test('run sim: a report over a seed list; the same data compares as the same runs, a dearer clinic as a paired difference (T3.4)', () => {
  const C = modules['sim-compare'],
    seeds = C.simSeeds(40),
    o = { team: 3, scenes: 'skip' },
    base = runReport(seeds, o);
  assert.equal(base.kind, 'pb-sim-report');
  assert.deepEqual(base.seeds, seeds);
  assert.equal(base.results.length, 40);
  assert.equal(base.mode, 'balance');
  assert.match(base.dataHash, /^[0-9a-f]{8}$/);
  assert.equal(base.banner, C.simBanner(base.policy));
  assert.deepEqual(runReport(seeds, o), base, 'a re-run matches exactly');
  const same = C.simCompareReports(base, runReport(seeds, o));
  assert.equal(same.same, true);
  for (const k of C.SIM_METRICS) assert.equal(same.diff[k].changed, 0, k);
  const R = data.RULES.run,
    was = R.healCost;
  R.healCost = was * 2;
  let dear;
  try {
    dear = C.simCompareReports(base, runReport(seeds, o));
  } finally {
    R.healCost = was;
  }
  assert.notEqual(dear.hash.draft, dear.hash.base, 'the data hash moves with the data');
  assert.ok(dear.diff.healed.mean > 0 && dear.diff.healed.lo > 0, JSON.stringify(dear.diff.healed));
  /* RL-R1: no more money left. Its interval below 0 held only for this seed list (on main before RL-R1, 80 seeds gave
     hi 6.6); every run is lost on the placeholders (HANDOFF RL-8), so the clinic's price shows in healed, above. RF-4:
     with Perks drawn in perks.json's order the 40 seeds' mean is +4.5 (lo -21.9): no significant gain, which is the
     claim, so the interval must reach 0 or below */
  assert.ok(dear.diff.moneyLeft.lo <= 0, JSON.stringify(dear.diff.moneyLeft));
});

test('run sim: the side area (RL-R2b): shut with no badge kept; the policy goes in when the move can be used', () => {
  for (let k = 0; k < 8; k++)
    assert.equal(runSim(`SIMSIDE${k}`, B).log.side, undefined, `SIMSIDE${k}: no badge, no side`);
  const map = { side: { kind: 'detour', move: 'cut', from: 3, to: 4, nodes: [11, 12, 13] } },
    leafy = [{ name: 'Leafy', types: ['Grass'] }],
    hot = [{ name: 'Hot', types: ['Fire'] }];
  assert.deepEqual(simSideNext(map, 3, { grass: 1 }, leafy), { to: 11, open: true });
  assert.equal(simSideNext(map, 3, {}, leafy), null, 'no badge');
  assert.equal(simSideNext(map, 3, { grass: 1 }, hot), null, 'no Grass Billie');
  assert.equal(simSideNext(map, 11, { grass: 1 }, leafy), null, 'along the chain: the lane');
  assert.deepEqual(simSideNext(map, 13, {}, hot), { to: 4 }, 'the way out');
  assert.equal(simSideNext({ side: { ...map.side, to: -1 } }, 13, {}, hot), null, 'past its own boss: none');
  assert.equal(simSideNext({}, 3, { grass: 1 }, leafy), null, 'no side area');
});

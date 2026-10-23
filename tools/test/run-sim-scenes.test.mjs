// RL-8: the run simulation with its scenes (the full mode: every place's map made, as the game makes it). The slow
// tier (tools/unit-tests.mjs SLOW_TESTS): each run here makes whole maps. run-sim.test.mjs checks what a run decides,
// in balance mode; the second test here is what lets it: balance mode plays every seed as the full mode does.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSim } from './sim/run-sim.mjs';
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

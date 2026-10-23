// RL-12b: logic/route-trainers.js, the trainers who stand by a run route and walk up on sight: how many on each route
// (rules.json run.trainers.perRoute), of different classes, the region's Billies at the place's level, the same for the
// same run; where they stand (along the road to the way ahead, by turns to each side, facing it); what they see.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fn, GAME_DATA, hooks, modules, reseed } from './setup-real.mjs';

const RT = modules['route-trainers'],
  X = modules.encounters,
  { runStartOn, runStartPlan } = modules['run-start'],
  { runUnlocks } = modules.unlocks,
  RUN = GAME_DATA.rules.run,
  UNLOCK_DATA = { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings },
  DATA = {
    nodeTypes: GAME_DATA.nodeTypes,
    biomes: GAME_DATA.biomes,
    pools: GAME_DATA.pools,
    scenery: GAME_DATA.scenery,
    rules: RUN,
    unlockData: UNLOCK_DATA,
    region: modules['run-region'].runRegionData(GAME_DATA, GAME_DATA.trainers),
  },
  TD = { classes: GAME_DATA.events.classes, species: hooks.SPECIES, rules: RUN };

function run(seed) {
  reseed(1);
  const s = fn('newSave')();
  s.started = true;
  s.starter = GAME_DATA.rules.start.starters[0];
  s.team.push(fn('makeBilly')(s.starter + '0', 12));
  hooks.provide({ saveData: s });
  runStartOn(s, runStartPlan(seed, DATA, { unlocks: runUnlocks(s, UNLOCK_DATA) }), { home: [s.team[0].uid] });
  return s.run;
}

test('route trainers: perRoute on every route, of different classes, the region’s Billies, the same for the same run', () => {
  let routes = 0;
  for (let k = 0; k < 30; k++) {
    const seed = 'ROUTE' + k.toString(36).toUpperCase().padStart(5, '0'),
      a = run(seed),
      T = RT.runRouteTrainers(a, TD);
    assert.deepEqual(T, RT.runRouteTrainers(run(seed), TD));
    a.map.nodes.forEach((node, i) => {
      const here = Object.values(T).filter(t => t.runNode === i);
      if (node.type !== 'route') return assert.equal(here.length, 0, `${seed}: none on a ${node.type}`);
      routes++;
      assert.ok(
        here.length >= RUN.trainers.perRoute[0] && here.length <= RUN.trainers.perRoute[1],
        `${seed} node ${i}`
      );
      assert.equal(new Set(here.map(t => t.cls)).size, here.length, 'no class twice on a route');
      for (const t of here) {
        assert.equal(t.runFoe, 'route');
        assert.equal(t.reward, RUN.trainers.reward);
        assert.deepEqual(t.script, [`“${t.sight}”`, `battle ${t.id}`]);
        assert.equal(t.team.at(-1).lvl, Math.min(100, X.encPlaceLevel(a, i, RUN) + RUN.trainers.up));
        for (const b of t.team) assert.ok(a.region.dex.includes(b.sp), b.sp);
        assert.ok(!t.blocks, 'they never block the way');
      }
    });
  }
  assert.ok(routes > 0, 'some seed has a route');
});

test('route trainers: spread along the road to the way ahead, to either side by turns, facing it', () => {
  const hub = [56, 32],
    exits = [
      [111, 32],
      [1, 32],
    ];
  const a = RT.routeTrainerSpot(hub, exits, 0, 2),
    b = RT.routeTrainerSpot(hub, exits, 1, 2);
  assert.ok(a.road[0] < hub[0] && b.road[0] < a.road[0], 'west of the hub, the second further on');
  assert.equal(a.at[0], a.road[0]);
  assert.equal(Math.sign(a.at[1] - a.road[1]), -Math.sign(b.at[1] - b.road[1]), 'one each side');
  assert.equal(Math.abs(a.at[1] - a.road[1]), 3);
  assert.equal(RT.routeTrainerSpot(hub, [], 0, 1), null);
});

test('route trainers: they see a straight line ahead, sight metres long and a little wide', () => {
  const at = [10, 10],
    look = [10, 13],
    see = p => RT.routeInSight(at, look, p, 6);
  assert.equal(see([10, 13]), true);
  assert.equal(see([10.8, 15.9]), true);
  assert.equal(see([10, 16.5]), false, 'too far');
  assert.equal(see([11.2, 12]), false, 'too far to the side');
  assert.equal(see([10, 8]), false, 'behind it');
  assert.equal(RT.routeInSight(at, at, [10, 11], 6), false, 'facing nowhere');
});

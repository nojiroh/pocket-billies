// Routes track RT-2: route trainers on real runs' places (logic/route-trainers.js routeTrainersPlace on the scenes
// logic/run-scenes.js makes from the run's seed, the game's own data): every trainer stands where you can walk to and
// faces ground you can walk on; the required ones' sight crosses the road (you can't pass them unseen); a required
// one stands by the road, an optional one aside, with few left to fall back on; a pair's second stands where you can
// walk too; the same run, the same spots.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fn, GAME_DATA, hooks, modules, reseed } from './setup-real.mjs';

const RT = modules['route-trainers'],
  M = modules.mapgen,
  { runScenesMake } = modules['run-scenes'],
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

test('RT-2: route trainers on real runs stand where you walk, face open ground, and the required ones see the road', () => {
  const C = GAME_DATA.scenery;
  let n = 0,
    off = 0,
    mates = 0,
    matesOK = 0;
  for (let k = 0; k < 5; k++) {
    const seed = 'RT2SPOT' + k,
      a = run(seed),
      scenes = runScenesMake(a, DATA),
      T = RT.runRouteTrainers(a, TD);
    RT.routeTrainersPlace(a, T, scenes, TD.classes);
    const again = RT.runRouteTrainers(a, TD);
    RT.routeTrainersPlace(a, again, scenes, TD.classes);
    assert.deepEqual(again, T, `${seed}: the same spots`);
    /** @type {Record<number, any>} */
    const reach = {};
    for (const t of Object.values(T)) {
      const sc = scenes[t.runNode],
        where = `${seed} ${t.id} (${t.route.spot})`,
        R = (reach[t.runNode] ||= M.mapgenReach(sc, C, sc.hub, { slope: true }));
      n++;
      assert.ok(t.route.at && t.route.look, `${where}: nowhere to stand`);
      assert.ok(M.mapgenReached(R, ...t.route.at), `${where}: at ${t.route.at} can't be walked to`);
      const fx = t.route.look[0] - t.route.at[0],
        fz = t.route.look[1] - t.route.at[1],
        l = Math.hypot(fx, fz);
      assert.ok(M.mapgenReached(R, t.route.at[0] + fx / l, t.route.at[1] + fz / l), `${where}: faces a wall`);
      if (t.route.opt ? !RT.ROUTE_SPOTS.aside.includes(t.route.spot) : !RT.ROUTE_SPOTS.road.includes(t.route.spot))
        off++;
      if (!t.route.opt) {
        const road = (sc.edgeExits || []).flatMap(e => (e.path ? M.mapgenResample(e.path, 0.5) : []));
        assert.ok(
          road.some(p => RT.routeInSight(t.route.at, t.route.look, p, RUN.trainers.sight)),
          `${where}: its sight never crosses the road`
        );
      }
      if (t.mate) {
        mates++;
        if (M.mapgenReached(R, ...t.route.mate)) matesOK++;
      }
    }
  }
  assert.ok(n > 20, `${n} trainers`);
  assert.ok(off / n < 0.1, `${off} of ${n} not on their own kind of spot`);
  /* the game stands the second at the walkable point nearest (walk/frame-items.js walkablePointNear) */
  assert.ok(!mates || matesOK / mates >= 0.75, `${matesOK} of ${mates} pairs' seconds stand where you walk`);
});

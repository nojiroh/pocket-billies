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
    /* RL-S2: Blake kept off, so the samples are the same runs' route places as before his (a rival place has no
       route trainers; the rarer-spot shares below were tuned on these seeds) */
    rules: { ...RUN, rival: { ...RUN.rival, meet: [0] } },
    /* RT-3: the set pieces take spots before the trainers do, as in the game */
    setPieces: GAME_DATA.setPieces,
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

test('RT-4: a route’s rarer one waits on a free pocket, dead end or clearing, clear of its trainers; the same run, the same spot', () => {
  const C = GAME_DATA.scenery;
  let places = 0,
    held = 0;
  /** @type {Record<string, number>} */
  const kinds = {};
  for (let k = 0; k < 15; k++) {
    const a = run('RT2SPOT' + k),
      scenes = runScenesMake(a, DATA),
      T = RT.runRouteTrainers(a, TD);
    RT.routeTrainersPlace(a, T, scenes, TD.classes);
    const S = RT.routeRareSpots(a, T, scenes);
    assert.deepEqual(RT.routeRareSpots(a, T, scenes), S, 'the same spots');
    const nodes = new Set(Object.values(T).map(t => t.runNode));
    places += nodes.size;
    for (const [ni, at] of Object.entries(S)) {
      const sc = scenes[+ni],
        where = `RT2SPOT${k} node ${ni} at ${at}`,
        spot = (sc.spots || []).find((/** @type {any} */ p) => p.x === at[0] && p.z === at[1]);
      assert.ok(nodes.has(+ni), `${where}: a place with no route trainers`);
      assert.ok(spot && RT.ROUTE_RARE_SPOTS.includes(spot.kind), `${where}: not on a pocket, dead end or clearing`);
      kinds[spot.kind] = (kinds[spot.kind] || 0) + 1;
      assert.ok(
        sc.props.every((/** @type {any} */ q) => !/canopy/.test(q.k) || !RT.routeUnderCanopy(q, spot)),
        `${where}: under a forest's canopy`
      );
      assert.ok(M.mapgenReached(M.mapgenReach(sc, C, sc.hub, { slope: true }), ...at), `${where}: can't be walked to`);
      for (const t of Object.values(T))
        if (t.runNode === +ni)
          assert.ok(Math.hypot(t.route.at[0] - at[0], t.route.at[1] - at[1]) > 6, `${where}: by ${t.id}`);
      held++;
    }
  }
  assert.ok(held / places >= 0.75, `${held} of ${places} route places have a spot for their rarer one`);
  /* about 3 in 4 over 30 seeds, before and after the water track's rivers (WA-3a); 5 seeds land either side of 0.8.
     WM-1 (runs west to east, the same spots a place on average): 0.90 over 90 seeds (0.95 before); 5 seeds swing
     0.67-0.78, so 15 now (0.84) */
  assert.ok(
    (kinds.pocket || 0) + (kinds.deadend || 0) >= held * 0.7,
    `mostly pockets and dead ends: ${JSON.stringify(kinds)}`
  );
});

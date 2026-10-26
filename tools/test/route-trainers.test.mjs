// RL-12b: logic/route-trainers.js, the trainers who stand by a run route and walk up on sight: how many on each route
// (rules.json run.trainers.perRoute by row; RT-2), of different classes, the region's Billies at the place's level, the
// same for the same run; about half optional, a pair now and then fought as a double; where they stand (RT-2: on the
// generator's spots, the kinds their class likes first, facing the way the spot faces); what they see. The real runs'
// spots: route-trainer-spots.test.mjs.
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

/** the [fewest, most] of a route node's row (rules.json run.trainers.perRoute by row) */
const rowRange = node => RUN.trainers.perRoute[Math.max(0, Math.min(RUN.trainers.perRoute.length - 1, node.row - 1))];

test('route trainers: perRoute by row on every route, of different classes, the region’s Billies, the same run alike', () => {
  let routes = 0,
    pairs = 0,
    opt = 0,
    all = 0,
    bots_ = 0;
  for (let k = 0; k < 30; k++) {
    const seed = 'ROUTE' + k.toString(36).toUpperCase().padStart(5, '0'),
      a = run(seed),
      T = RT.runRouteTrainers(a, TD);
    assert.deepEqual(T, RT.runRouteTrainers(run(seed), TD));
    a.map.nodes.forEach((node, i) => {
      const here = Object.values(T).filter(t => t.runNode === i);
      /* RL-14: a scrapyard's agents have their own test below */
      if (node.type === 'scrapyard') return;
      if (node.type !== 'route') return assert.equal(here.length, 0, `${seed}: none on a ${node.type}`);
      routes++;
      /* a pair counts as two */
      const count = here.reduce((n, t) => n + (t.mate ? 2 : 1), 0),
        [lo, hi] = rowRange(node);
      assert.ok(count >= lo && count <= hi, `${seed} node ${i} (row ${node.row}): ${count}`);
      const cls = here.flatMap(t => (t.mate ? [t.cls, t.mate.cls] : [t.cls]));
      assert.equal(new Set(cls).size, cls.length, 'no class twice on a route');
      assert.ok(
        here.some(t => !t.route.opt),
        `${seed} node ${i}: someone stands by the road`
      );
      assert.ok(here.filter(t => t.mate).length <= 1, 'one pair a place at most');
      for (const t of here) {
        all += t.mate ? 2 : 1;
        if (t.route.opt) opt += t.mate ? 2 : 1;
        assert.equal(t.runFoe, 'route');
        assert.equal(t.team.at(-1).lvl, Math.min(100, X.encPlaceLevel(a, i, RUN) + RUN.trainers.up));
        /* RL-14: a Bureau agent's bots (factions.json) come after its Billies; nobody else fields one */
        for (const b of t.team) assert.ok(b.sp === 'robot' || a.region.dex.includes(b.sp), b.sp);
        const bots = t.team.filter(b => b.sp === 'robot').length;
        if (!t.bureau && !(t.mate && GAME_DATA.events.classes[t.mate.cls].bureau))
          assert.equal(bots, 0, `${t.id}: no bots`);
        else if (!t.mate) {
          bots_++;
          assert.ok(bots >= 1 && bots <= 2, `${t.id}: ${bots} bots`);
          assert.deepEqual(
            t.team.map(b => b.sp === 'robot'),
            t.team.map((_, k) => k >= t.team.length - bots),
            'its bots last'
          );
        }
        assert.ok(!t.blocks, 'they never block the way');
        if (!t.mate) {
          assert.equal(t.reward, RUN.trainers.reward);
          /* RL-S1: a Bureau agent's line is picked by the run history */
          assert.deepEqual(t.script, [t.bureau ? 'pick bureau' : `“${t.sight}”`, `battle ${t.id}`]);
          continue;
        }
        /* RT-2: a pair is one entry fought as a double: two Billies each at most, both rewards, both lines */
        pairs++;
        assert.equal(t.double, true);
        assert.ok(t.team.length >= 2 && t.team.length <= 4, `${t.id}: ${t.team.length} Billies`);
        assert.equal(t.reward, RUN.trainers.reward * 2);
        assert.equal(t.script.length, 3);
        assert.equal(t.script[0], t.bureau ? 'pick bureau' : `“${t.sight}”`);
        assert.match(t.script[1], new RegExp(`^${t.mate.who}: `));
        assert.equal(t.script[2], `battle ${t.id}`);
      }
    });
  }
  assert.ok(routes > 0, 'some seed has a route');
  /* now and then: about one route place in three */
  assert.ok(pairs / routes > 0.15 && pairs / routes < 0.55, `pairs on ${pairs} of ${routes} places`);
  /* about half optional */
  assert.ok(opt / all > 0.35 && opt / all < 0.6, `optional ${opt} of ${all}`);
  assert.ok(bots_ > 0, 'some Bureau agent fields bots');
});

test('route trainers: on the spots, the liked kinds first, by the road if required, facing the way the spot faces', () => {
  const spot = (kind, x, z, face, more = {}) => ({ kind, x, z, y: 0, face, ...more }),
    sc = {
      spots: [
        spot('roadside', 20, 30, 90),
        spot('roadside', 40, 34, -90),
        spot('bridge', 60, 30, 0),
        spot('pinch', 80, 32, undefined, { dir: 180, r: 2, stand: [80, 30], face: 90 }),
        spot('pinch', 90, 32, undefined, { dir: 180, r: 2 }),
        spot('clearing', 30, 10, 45),
        spot('deadend', 50, 55, 180),
        spot('pocket', 70, 50, 270),
        spot('summit', 10, 10, 0),
      ],
      edgeExits: [
        {
          side: 'W',
          path: [
            [56, 32],
            [0, 32],
          ],
        },
      ],
    },
    classes = { a: { likes: ['bridge'] }, b: { likes: ['deadend'] }, c: {}, d: {} },
    T = {
      t0: { cls: 'a', runNode: 1, route: { k: 0, n: 4, opt: false } },
      t1: { cls: 'b', runNode: 1, route: { k: 1, n: 4, opt: true } },
      t2: { cls: 'c', runNode: 1, route: { k: 2, n: 4, opt: false }, mate: { cls: 'd' } },
      t3: { cls: 'c', runNode: 1, route: { k: 3, n: 4, opt: true } },
    },
    R = { seed: 'SPOTS', map: { nodes: [{}, {}] } };
  RT.routeTrainersPlace(R, T, [null, sc], classes);
  assert.equal(T.t0.route.spot, 'bridge', 'a class takes the kind it likes');
  assert.equal(T.t1.route.spot, 'deadend');
  assert.ok(RT.ROUTE_SPOTS.road.includes(T.t2.route.spot), 'a required one stands by the road');
  assert.ok(RT.ROUTE_SPOTS.aside.includes(T.t3.route.spot), 'an optional one aside');
  assert.deepEqual(T.t0.route.at, [60, 30]);
  assert.deepEqual(T.t0.route.look, [62, 30], 'two metres the way the spot faces');
  for (const t of Object.values(T)) assert.notDeepEqual(t.route.at, [90, 32], 'never a pinch with nowhere to stand');
  assert.ok(T.t2.route.mate, 'a pair’s second stands beside the first');
  const m = T.t2.route.mate,
    d = Math.hypot(m[0] - T.t2.route.at[0], m[1] - T.t2.route.at[1]);
  assert.ok(Math.abs(d - 1.2) < 0.02, `1.2 m apart (${d})`);
  /* the same run, the same spots */
  const U = JSON.parse(JSON.stringify(T));
  for (const t of Object.values(U)) for (const k of ['at', 'look', 'spot', 'mate']) delete t.route[k];
  RT.routeTrainersPlace(R, U, [null, sc], classes);
  assert.deepEqual(U, T);
  /* a place with no spots: on the way west, 3 m to one side, facing it */
  const V = { v: { cls: 'c', runNode: 1, route: { k: 0, n: 1, opt: false } } };
  RT.routeTrainersPlace(R, V, [null, { edgeExits: sc.edgeExits }], classes);
  assert.equal(V.v.route.spot, 'way');
  assert.deepEqual(V.v.route.at, [28, 35]);
  assert.deepEqual(V.v.route.look, [28, 32]);
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

test('RL-14: a scrapyard has its faction’s agents by the road, each with its bots; the same run alike', () => {
  const Y = GAME_DATA.factions.factions.bureau.scrapyard;
  let yards = 0;
  for (let k = 0; k < 40 && yards < 4; k++) {
    const seed = 'YARD' + k,
      a = run(seed),
      T = RT.runRouteTrainers(a, TD);
    assert.deepEqual(T, RT.runRouteTrainers(run(seed), TD));
    a.map.nodes.forEach((node, i) => {
      if (node.type !== 'scrapyard') return;
      yards++;
      const here = Object.values(T).filter(t => t.runNode === i);
      assert.ok(here.length >= Y.trainers[0] && here.length <= Y.trainers[1], `${seed} node ${i}: ${here.length}`);
      for (const t of here) {
        assert.ok(Y.classes.includes(t.cls), t.cls);
        assert.equal(t.route.opt, false, 'by the road');
        assert.ok(!t.mate, 'no pairs');
        assert.ok(
          t.team.some(b => b.sp === 'robot'),
          `${t.id} fields bots`
        );
        assert.deepEqual(t.script, ['pick bureau', `battle ${t.id}`]);
      }
    });
  }
  assert.ok(yards > 0, 'some seed has a scrapyard');
});

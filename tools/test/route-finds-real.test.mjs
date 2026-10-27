// Routes track RT-4b: finds and Cut bramble rows on real runs' places (logic/route-finds.js routeFindsPlace on the
// scenes logic/run-scenes.js makes from the run's seed, after the trainers and the rarer ones, the game's own data):
// the same run gives the same finds and rows, and placing them again changes nothing; a find lies on a dead end or a
// pocket (a clearing when none is free) you walk to, 6 m from every trainer, never on the rarer one's spot, perRoute at most a place; a bramble row
// shuts its spot off (the rarer one's or a find's) while every exit, the hub, every trainer and every other find can
// still be walked to and no ledge traps you; cut, the spot is reached again.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fn, GAME_DATA, hooks, modules, reseed } from './setup-real.mjs';

const RT = modules['route-trainers'],
  RF = modules['route-finds'],
  M = modules.mapgen,
  { runScenesMake } = modules['run-scenes'],
  { runStartOn, runStartPlan } = modules['run-start'],
  { runUnlocks } = modules.unlocks,
  RUN = GAME_DATA.rules.run,
  C = GAME_DATA.scenery,
  UNLOCK_DATA = { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings },
  DATA = {
    nodeTypes: GAME_DATA.nodeTypes,
    biomes: GAME_DATA.biomes,
    pools: GAME_DATA.pools,
    scenery: C,
    rules: RUN,
    setPieces: GAME_DATA.setPieces,
    unlockData: UNLOCK_DATA,
    region: modules['run-region'].runRegionData(GAME_DATA, GAME_DATA.trainers),
  },
  TD = { classes: GAME_DATA.events.classes, species: hooks.SPECIES, rules: RUN },
  FD = { rules: RUN.finds, cards: GAME_DATA.rewards };

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
/** a run's scenes with its trainers, rarer ones' spots, finds and rows, as run-world.js puts them @param {string} seed */
function world(seed) {
  const a = run(seed),
    scenes = runScenesMake(a, DATA),
    T = RT.runRouteTrainers(a, TD);
  RT.routeTrainersPlace(a, T, scenes, TD.classes);
  const rare = RT.routeRareSpots(a, T, scenes),
    got = RF.routeFindsPlace(a, T, scenes, rare, FD);
  return { a, scenes, T, rare, got };
}
const ours = (/** @type {any} */ sc) => JSON.stringify((sc.props || []).filter((/** @type {any} */ p) => p.rt4b));

test('RT-4b: the same run, the same finds and bramble rows; placing them again changes nothing', () => {
  const A = world('RT4BSAME0'),
    B = world('RT4BSAME0');
  assert.deepEqual(B.got, A.got);
  A.scenes.forEach((sc, i) => assert.equal(ours(B.scenes[i]), ours(sc), `place ${i}`));
  const before = A.scenes.map(sc => (sc.props || []).length);
  RF.routeFindsPlace(A.a, A.T, A.scenes, A.rare, FD);
  assert.deepEqual(
    A.scenes.map(sc => (sc.props || []).length),
    before,
    'placed twice, still one set'
  );
});

test('RT-4b: finds on free dead ends and pockets; a bramble row shuts its spot off and nothing that must stay open', () => {
  let places = 0,
    finds = 0,
    rows = 0,
    rare = 0;
  const kinds = /** @type {Record<string, number>} */ ({});
  for (let k = 0; k < 6; k++) {
    const seed = 'RT4BREAL' + k,
      W = world(seed);
    for (const [ni, G] of Object.entries(W.got)) {
      const i = +ni,
        sc = W.scenes[i],
        where = `${seed} place ${i}`,
        stand = Object.values(W.T)
          .filter(t => t.runNode === i && t.route && t.route.at)
          .flatMap(t => [t.route.at, ...(t.route.mate ? [t.route.mate] : [])]),
        F = sc.props.filter((/** @type {any} */ p) => p.find),
        row = sc.props.filter((/** @type {any} */ p) => p.cut);
      places++;
      finds += F.length;
      assert.ok(F.length <= RUN.finds.perRoute[1], `${where}: ${F.length} finds`);
      assert.equal(G.finds.length, F.length);
      for (const p of F) {
        const sp = (sc.spots || []).find((/** @type {any} */ o) => o.x === p.x && o.z === p.z);
        assert.ok(sp && RF.ROUTE_FIND_SPOTS.includes(sp.kind), `${where}: a find off a dead end, pocket or clearing`);
        kinds[sp.kind] = (kinds[sp.kind] || 0) + 1;
        assert.ok(GAME_DATA.rewards[p.card], `${where}: no card ${p.card}`);
        if (RUN.finds.rareCards.includes(p.card)) rare++;
        assert.ok(
          stand.every(t => Math.hypot(t[0] - p.x, t[1] - p.z) > 6),
          `${where}: a find by a trainer`
        );
        const R = W.rare[i];
        assert.ok(!R || Math.hypot(R[0] - p.x, R[1] - p.z) > 0.5, `${where}: a find on the rarer one's spot`);
      }
      /* cut (no row up): every find walked to */
      const open = { ...sc, props: sc.props.filter((/** @type {any} */ p) => !p.cut) },
        R0 = M.mapgenReach(open, C, open.hub, { slope: true });
      for (const p of F) assert.ok(M.mapgenReached(R0, p.x, p.z), `${where}: a find can't be walked to`);
      if (!row.length) continue;
      rows++;
      assert.ok(row.every((/** @type {any} */ p) => p.cut === G.cut && p.act === 'field' && p.move === 'cut'));
      assert.equal(row.filter((/** @type {any} */ p) => p.label).length, 1, `${where}: one label on the row`);
      const sp = sc.spots[+G.cut.split('.')[2]];
      assert.ok(sp && sp.mouth, `${where}: the row's spot has a mouth`);
      const guarded = F.filter((/** @type {any} */ p) => p.x === sp.x && p.z === sp.z);
      assert.ok(
        guarded.length || (W.rare[i] && W.rare[i][0] === sp.x && W.rare[i][1] === sp.z),
        `${where}: the row guards neither a find nor the rarer one`
      );
      assert.ok(M.mapgenReached(R0, sp.x, sp.z), `${where}: cut, the spot is reached`);
      /* the row up */
      const R1 = M.mapgenReach(sc, C, sc.hub, { slope: true });
      assert.ok(!M.mapgenReached(R1, sp.x, sp.z), `${where}: the row doesn't shut its spot off`);
      assert.deepEqual(M.mapgenUnreachable(sc, C, { slope: true }), [], `${where}: an exit shut off`);
      for (const t of stand) assert.ok(M.mapgenReached(R1, t[0], t[1]), `${where}: a trainer shut off`);
      for (const p of F)
        if (!guarded.includes(p)) assert.ok(M.mapgenReached(R1, p.x, p.z), `${where}: another find shut off`);
      assert.ok(M.mapgenTraps(sc, C).n <= M.mapgenTraps(open, C).n, `${where}: the row makes a trap`);
    }
  }
  console.log(
    `RT-4b: ${places} route places, ${finds} finds (${rare} rare, ${JSON.stringify(kinds)}), ${rows} bramble rows`
  );
  assert.ok(places >= 10, `${places} route places`);
  assert.ok(finds >= places, `${finds} finds on ${places} places`);
  assert.ok(rows >= 2, `${rows} bramble rows`);
});

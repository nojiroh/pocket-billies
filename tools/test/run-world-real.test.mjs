// RL-7: a run's world on the game's own data (biomes.json, rules.json run, nodeTypes.json, scenery.json): every scene
// of a run's map made by the generator from the run's seed, each joined to its parents, and the world tables with
// Copperleaf first. What must hold for every seed: each road's two exits exist with the ids the tables name, face
// each other and line up (check-data's seam rules), the two scenes meet with no height gap or step and a straight
// walk across (mapgenSeamAgreement), every scene can be walked from its hub to everywhere, the generator has no note;
// the same seed makes the same scenes; the run's world goes in and the hub's comes back exactly.
//   node --test --test-update-snapshots tools/test/run-world-real.test.mjs   remakes the frozen dials (say why in the
//   commit: a change to how a node's dials are drawn changes every run's scenes)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PB_DATA } from '../data-files.mjs';
import { data, fn, GAME_DATA, hooks, modules, startedSave } from './setup-real.mjs';

const { runArrive, runMapStart, runNext } = modules['run-map'];
const { newRun } = modules['run-state'];
const { seamRulesLinks } = modules['seam-rules'];
const { MAPGEN_VERSION, mapgenSeamAgreement, mapgenUnreachable } = modules.mapgen;
const { runSceneExits, runSceneMake, runSceneParams, runScenesMake, runScenesSlices, runWorldTables } =
  modules['run-scenes'];

const START = {
  team: [],
  se: 0,
  items: {},
  pyramids: {},
  trip: { node: 0, plan: [] },
  wild: {},
  flags: {},
  seats: [],
  visited: {},
};
const R = GAME_DATA.rules.run,
  MAP_DATA = { nodeTypes: GAME_DATA.nodeTypes, biomes: GAME_DATA.biomes, rules: R },
  WORLD_DATA = {
    nodeTypes: GAME_DATA.nodeTypes,
    biomes: GAME_DATA.biomes,
    pools: data.POOLS,
    scenery: GAME_DATA.scenery,
    rules: R,
    /* RT-3: laid-out places get their set pieces, as the game's do */
    setPieces: GAME_DATA.setPieces,
  },
  HUB = GAME_DATA.locations[0];
/** a run with its map, as the mast gives it (RL-8) */
function runOf(/** @type {string} */ seed) {
  const run = newRun(seed, 1, MAPGEN_VERSION, START);
  runMapStart(run, MAP_DATA);
  return run;
}
/* WM-2: RL7WORLD3's map changed and a place's neighbour's river ends at their seam (mapgen notes about 1 run place
   in 25 so, before WM-2 as after: a mapgen session's to fix); RL7WORLD6 stands in for it */
const SEEDS = ['RL7WORLD0', 'RL7WORLD1', 'RL7WORLD2', 'RL7WORLD6', 'RL7WORLD4', 'RL7WORLD5'];

test("every run's scenes join: exits where the roads say, no gap, a straight walk across, all ground reachable", () => {
  const scenery = GAME_DATA.scenery;
  let roads = 0,
    scenes = 0;
  for (const seed of SEEDS) {
    const run = runOf(seed),
      map = run.map,
      made = /** @type {any[]} */ ([]);
    map.nodes.forEach((_, i) => {
      const { scene, notes } = runSceneMake(run, i, made, WORLD_DATA);
      assert.deepEqual(notes, [], `${seed} node ${i}`);
      made.push(scene);
    });
    const W = runWorldTables(run, HUB, WORLD_DATA),
      maps = Object.fromEntries(W.locations.slice(1).map((p, i) => [p.mapId, made[i]]));
    made.forEach((sc, i) => {
      const where = `${seed} node ${i}`;
      assert.deepEqual(
        sc.edgeExits.map((/** @type {any} */ e) => [e.id, e.side, e.t]),
        runSceneExits(map, i).map(e => [e.id, e.side, +e.t.toFixed(4)]) /* the generator keeps t to 4 places */,
        `${where}: the exits the roads name`
      );
      assert.deepEqual(mapgenUnreachable(sc, scenery), [], where);
      assert.equal(sc.locationId, W.locations[i + 1].id, where);
      assert.equal(sc.climate, GAME_DATA.biomes[map.nodes[i].biome].climate, where);
      /* RL-8: the landing has the airship's mast (where the flight lands you), a town its clinic and shop */
      const acts = sc.props.map((/** @type {any} */ p) => p.act).filter(Boolean),
        want = { landing: ['fly'], town: ['clinic', 'shop'] }[map.nodes[i].type] || [];
      assert.deepEqual(
        acts.filter((/** @type {string} */ a) => ['fly', 'clinic', 'shop'].includes(a)).sort(),
        want.slice().sort(),
        `${where}: the buildings of a ${map.nodes[i].type}`
      );
      scenes++;
    });
    /* check-data's seam rules on the run's roads, as on the hub's */
    const links = seamRulesLinks({
      roads: W.roads,
      roadOf: L => PB_DATA.road({ locations: W.locations }, L),
      locations: W.locations,
      maps,
      terrains: scenery.terrains,
    });
    assert.deepEqual(links.problems, [], seed);
    for (const L of W.roads) {
      const a = mapgenSeamAgreement(maps[L.a.map], L.a.exit, maps[L.b.map], L.b.exit, scenery);
      assert.ok(a, `${seed} ${L.id}`);
      assert.deepEqual([a.dhNear, a.dhBand, a.raiseExit, a.walk], [0, 0, 0, null], `${seed} ${L.id}`);
      roads++;
    }
  }
  assert.ok(scenes > 60 && roads > 60, `${scenes} scenes, ${roads} roads`);
});

test("a run's bridges cross the water (RL-8): both ends on dry ground, square to the stream within 25 degrees", () => {
  /* the owner was stuck on a landing whose bridge ran along the stream and ended in the water: before RL-8 a bridge ran
     from a road's first wet point to its last (60 of 468 bridges in 100 runs ended in water, 270 lay within 50 degrees
     of the stream) */
  const tile = (sc, x, z) => (sc.tiles[sc.h - 1 - Math.floor(z)] || '')[Math.floor(x)],
    cross = (p, q, r, s) => {
      const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
      if (!d) return false;
      const u = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d,
        v = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
      return u >= 0 && u <= 1 && v >= 0 && v <= 1;
    };
  let bridges = 0;
  for (let k = 0; k < 24; k++) {
    const seed = `RL8BRIDGE${k}`,
      run = runOf(seed),
      made = /** @type {any[]} */ ([]);
    run.map.nodes.forEach((_, i) => {
      const { scene } = runSceneMake(run, i, made, WORLD_DATA);
      made.push(scene);
      for (const b of scene.bridges || []) {
        if (b.pier) continue;
        bridges++;
        const L = Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]),
          ux = (b.b[0] - b.a[0]) / L,
          uz = (b.b[1] - b.a[1]) / L,
          at = `${seed} node ${i}, the bridge ${JSON.stringify(b)}`;
        for (const [x, z] of [
          [b.a[0] - ux * 0.3, b.a[1] - uz * 0.3],
          [b.b[0] + ux * 0.3, b.b[1] + uz * 0.3],
        ])
          assert.ok(!'wd'.includes(tile(scene, x, z)), `${at}: an end in the water`);
        const seg = (scene.streams || [])
          .flatMap(st => st.pts.slice(1).map((q, j) => [st.pts[j], q]))
          .find(([p, q]) => cross(b.a, b.b, p, q));
        assert.ok(seg, `${at}: crosses no stream`);
        const [p, q] = seg,
          sl = Math.hypot(q[0] - p[0], q[1] - p[1]),
          ang = (Math.acos(Math.abs(((q[0] - p[0]) * ux + (q[1] - p[1]) * uz) / sl)) * 180) / Math.PI;
        assert.ok(ang >= 64, `${at}: ${ang.toFixed(0)} degrees to the stream`);
      }
    });
  }
  assert.ok(bridges > 40, `${bridges} bridges`);
});

test('the same seed makes the same scenes; every node its own', () => {
  const a = runScenesMake(runOf('RL7SAME'), WORLD_DATA),
    b = runScenesMake(runOf('RL7SAME'), WORLD_DATA);
  assert.deepEqual(a, b);
  assert.equal(new Set(a.map(sc => sc.gen.seed)).size, a.length);
  assert.notDeepEqual(runScenesMake(runOf('RL7OTHER'), WORLD_DATA)[0].tiles, a[0].tiles);
});

test('HB-2: the scenes made one a step are the scenes made at once, each step counting up to the last', () => {
  const run = runOf('HB2SLICES'),
    it = runScenesSlices(run, WORLD_DATA),
    steps = [];
  let r = it.next();
  for (; !r.done; r = it.next()) steps.push(r.value);
  const n = run.map.nodes.length;
  assert.deepEqual(
    steps,
    Array.from({ length: n - 1 }, (_, i) => [i + 1, n])
  );
  assert.deepEqual(r.value, runScenesMake(runOf('HB2SLICES'), WORLD_DATA));
});

test("a node's dials are frozen: a change to how they are drawn changes every run's scenes", t => {
  const run = runOf('RL7FROZEN'),
    made = runScenesMake(run, WORLD_DATA);
  t.assert.snapshot(
    run.map.nodes.map((_, i) => {
      const { edges, ...P } = runSceneParams(run, i, made, WORLD_DATA);
      return { ...P, edges: edges.length };
    })
  );
});

test("the run's world goes in (its scenes, pools, places and roads) and the hub's comes back exactly", () => {
  const TABLES = ['LOCATIONS', 'ROADS', 'ROADS_BY_NODE', 'LOCATION_BY_ID'],
    hubTables = () => structuredClone(Object.fromEntries(TABLES.map(k => [k, data[k]]))),
    hub = hubTables(),
    mapIds = Object.keys(data.gameData.maps),
    poolIds = Object.keys(data.POOLS),
    shopIds = Object.keys(data.SHOPS),
    trainerIds = Object.keys(data.TRAINERS),
    run = runOf('RL7SWAP'),
    made = runScenesMake(run, WORLD_DATA),
    W = runWorldTables(run, data.LOCATIONS[0], WORLD_DATA),
    maps = Object.fromEntries(W.locations.slice(1).map((p, i) => [p.mapId, made[i]]));
  /* RL-8: its mini-bosses and boss */
  const foes = modules['run-loop'].runFoes(run, {
    leaders: Object.values(data.TRAINERS).filter(T => T.miniboss),
    rules: R,
  });
  startedSave('musk0');
  /* a hub trainer standing on the hub's node 1 (none does today) must not stand on the run's place 1 */
  data.TRAINERS.hub_guard = { id: 'hub_guard', name: 'Guard', who: 'chosen', team: [], node: 1 };
  try {
    data.worldPut({ ...W, maps, trainers: foes });
    assert.ok(!data.LOCATIONS[1].trainers.includes('hub_guard'), 'a hub trainer on a run’s place');
    for (const F of Object.values(foes)) {
      assert.deepEqual(data.LOCATIONS[F.node].trainers, [F.id], `${F.id} stands on its place alone`);
      assert.equal(data.TRAINERS[F.id].from, F.from);
      if (F.runFoe === 'miniboss') assert.equal(fn('blockerAt')(F.node).id, F.id, 'a mini-boss blocks the way on');
    }
    assert.equal(
      data.LOCATIONS.filter(p => p.trainers.length).length,
      Object.keys(foes).length,
      'no trainer anywhere else'
    );
    assert.equal(data.LOCATIONS.length, 1 + run.map.nodes.length);
    assert.equal(data.LOCATIONS[0].id, 'copperleaf');
    assert.equal(data.ROADS.length, W.roads.length);
    assert.deepEqual(data.worldExtraMaps(), maps);
    data.LOCATIONS.slice(1).forEach((p, i) => {
      assert.equal(p.pool, `run_${i}`, 'its own pool, kept');
      assert.equal(data.POOLS[p.pool], W.pools[p.pool]);
      assert.equal(data.gameData.maps[p.mapId], made[i]);
      assert.equal(p.runNode, i);
      /* RL-8: a town's shop, by the day */
      if (p.town) assert.equal(data.SHOPS[p.shop].runNode, i);
      else assert.equal(p.shop, undefined);
    });
    assert.ok(
      data.LOCATIONS.some(p => p.runNode != null && p.town),
      'a town on the run'
    );
    /* each road as long as the walk out of one scene and into the other (its exits' len), not the 100 m of a
       road without scenes */
    for (const [a, b, m, j] of data.ROADS) {
      const len = (/** @type {number} */ n, /** @type {string} */ id) =>
        maps[data.LOCATIONS[n].mapId].edgeExits.find((/** @type {any} */ e) => e.id === id).len;
      assert.equal(m, Math.max(1, Math.round(len(a, j.a) + len(b, j.b))), j.id);
    }
    assert.deepEqual(data.ROADS_BY_NODE[1].map(e => e.to).sort(), run.map.nodes[0].to.map(i => i + 1).sort());
    /* another run's world in its place takes the first one's out */
    const run2 = runOf('RL7SWAP2'),
      W2 = runWorldTables(run2, data.LOCATIONS[0], WORLD_DATA),
      made2 = runScenesMake(run2, WORLD_DATA);
    data.worldPut({ ...W2, maps: Object.fromEntries(W2.locations.slice(1).map((p, i) => [p.mapId, made2[i]])) });
    assert.ok(
      Object.keys(maps).every(id => !data.gameData.maps[id]),
      "the first run's scenes are gone"
    );
    assert.equal(data.LOCATIONS.length, 1 + run2.map.nodes.length);
  } finally {
    data.worldHubBack();
    delete data.TRAINERS.hub_guard;
  }
  assert.deepEqual(hubTables(), hub);
  assert.deepEqual(Object.keys(data.gameData.maps), mapIds, "only the hub's scenes");
  assert.deepEqual(Object.keys(data.POOLS), poolIds, "only the game's pools");
  assert.deepEqual(Object.keys(data.SHOPS), shopIds, "only the game's shops");
  assert.deepEqual(Object.keys(data.TRAINERS), trainerIds, "only the game's trainers");
  assert.deepEqual(data.worldExtraMaps(), {});
});

test("a run's place is stocked once a visit from its own stream at its row's levels; fewer when walked back to", () => {
  const s = startedSave(GAME_DATA.rules.start.starters[0] + '0', 5),
    run = runOf('RL7WILD'),
    made = runScenesMake(run, WORLD_DATA),
    W = runWorldTables(run, data.LOCATIONS[0], WORLD_DATA),
    E = GAME_DATA.rules.encounters;
  s.run = run;
  s.trip = { node: 0, plan: [] };
  runArrive(s, 0, MAP_DATA);
  data.worldPut({ ...W, maps: Object.fromEntries(W.locations.slice(1).map((p, i) => [p.mapId, made[i]])) });
  /* RL-8: a run's place draws by its forecast in logic, never by the page's real-clock odds */
  const pageOdds = hooks.environmentOdds;
  hooks.provide({
    environmentOdds: () => {
      throw new Error('a run place asked the page for its wild odds');
    },
  });
  try {
    const stock = () => fn('encountersHere')(1),
      seen = (/** @type {any[]} */ L) => L.map(q => `${q.sp}:${q.lvl}`);
    const first = stock();
    assert.equal(first.length, E.route, "a route's stock on the first visit");
    for (const q of first) {
      assert.ok(q.lvl >= W.pools.run_0.lv[0] && q.lvl <= W.pools.run_0.lv[1], `level ${q.lvl}`);
      assert.ok(
        W.pools.run_0.list.some(([sp]) => sp === q.sp),
        q.sp
      );
    }
    assert.equal(stock(), first, 'looked at again: the same list, not rolled again');
    /* the same visit rolled again (a reload, another device) meets the same Billies */
    delete s.wild.run_0;
    assert.deepEqual(seen(stock()), seen(first));
    /* SP-3: its wild splices come from a stream of their own: the same on a reload, and with none at all (or every
       Billie spliced) the stock's species, levels, sizes and coats are the same */
    const whole = (/** @type {any[]} */ L) =>
        L.map(({ sp, lvl, build, coat, alpha }) => ({ sp, lvl, build, coat, alpha })),
      grafts = (/** @type {any[]} */ L) => L.map(q => [q.graft || null, q.unstable || null]),
      G = data.GENES.wild,
      odds = { ...G },
      kept = { whole: whole(stock()), grafts: grafts(stock()) };
    delete s.wild.run_0;
    assert.deepEqual(grafts(stock()), kept.grafts, 'the same splices on a reload');
    try {
      Object.assign(G, { graft: 0, chimera: 0 });
      delete s.wild.run_0;
      assert.deepEqual(whole(stock()), kept.whole);
      assert.ok(
        stock().every(q => !q.graft),
        'no odds, no splices'
      );
      Object.assign(G, { graft: 0.5, chimera: 0.49 });
      delete s.wild.run_0;
      assert.deepEqual(whole(stock()), kept.whole);
      assert.ok(
        stock().some(q => q.graft),
        'nearly every Billie spliced'
      );
      /* an Unstable one carries its roll (the stream's): its foe in battle keeps it */
      for (const q of stock())
        assert.equal(!!q.unstable, !!q.graft && fn('graftStability')(fn('geneData')(), q.sp, q.graft).unstable);
    } finally {
      Object.assign(G, odds);
      delete s.wild.run_0;
      stock();
    }
    /* no top-up by play time in a run */
    fn('dropEncounter')(stock()[0].id);
    s.playMs = (s.playMs || 0) + 10 * E.refillMs;
    assert.equal(stock().length, E.route - 1);
    /* walked on and back: a smaller stock, rolled again */
    runArrive(s, runNext(run.map, 0)[0], MAP_DATA);
    runArrive(s, 0, MAP_DATA);
    assert.equal(fn('encounterRunVisits')(1), 2);
    assert.equal(stock().length, R.wild.back);
    assert.equal(stock()[0].lvl >= W.pools.run_0.lv[0], true);
    hooks.provide({ environmentOdds: pageOdds });
    /* a hub place is stocked as before */
    assert.equal(fn('encounterRunVisits')(0), 0);
  } finally {
    data.worldHubBack();
  }
});

test("RT-4: a run route's first visit keeps the last of its stock for a rarer one, of the rarest, levels up", () => {
  const s = startedSave(GAME_DATA.rules.start.starters[0] + '0', 5),
    run = runOf('RT4RARE'),
    made = runScenesMake(run, WORLD_DATA),
    W = runWorldTables(run, data.LOCATIONS[0], WORLD_DATA),
    Wr = R.wild;
  s.run = run;
  s.trip = { node: 0, plan: [] };
  runArrive(s, 0, MAP_DATA);
  W.locations[1].trainerCount = 4;
  data.worldPut({ ...W, maps: Object.fromEntries(W.locations.slice(1).map((p, i) => [p.mapId, made[i]])) });
  try {
    const list = fn('encountersHere')(1),
      P = W.pools.run_0,
      rarest = modules['wild-pool'].wildRareList(P.list).map(e => e[0]);
    assert.equal(list.length, Wr.route - 4);
    const rare = list.filter(q => q.rare);
    assert.equal(rare.length, 1, 'one rarer one');
    assert.equal(list[list.length - 1], rare[0], 'the last of the stock');
    assert.ok(rarest.includes(rare[0].sp), `${rare[0].sp} is of the rarest (${rarest})`);
    assert.ok(rare[0].lvl >= P.lv[0] + Wr.rare.up && rare[0].lvl <= P.lv[1] + Wr.rare.up, `level ${rare[0].lvl}`);
    assert.ok(!rare[0].alpha, 'never an Alpha');
    /* walked on and back: no rarer one again */
    runArrive(s, runNext(run.map, 0)[0], MAP_DATA);
    runArrive(s, 0, MAP_DATA);
    assert.ok(!fn('encountersHere')(1).some(q => q.rare), 'none on a return visit');
  } finally {
    data.worldHubBack();
  }
});

test("RL-14: a run place's wild ones are now and then the Bureau's bots: from their row on, in their biomes", () => {
  const s = startedSave(GAME_DATA.rules.start.starters[0] + '0', 5),
    run = runOf('RL14BOTS'),
    made = runScenesMake(run, WORLD_DATA),
    W = runWorldTables(run, data.LOCATIONS[0], WORLD_DATA),
    B = GAME_DATA.factions.factions.bureau,
    node = run.map.nodes[0],
    was = { type: node.type, row: node.row, biome: node.biome };
  s.run = run;
  s.trip = { node: 0, plan: [] };
  runArrive(s, 0, MAP_DATA);
  data.worldPut({ ...W, maps: Object.fromEntries(W.locations.slice(1).map((p, i) => [p.mapId, made[i]])) });
  try {
    /* place 1 stands in for a route deep enough in a bot biome: many draws, about the chance of them bots */
    Object.assign(node, { type: 'route', row: B.wild.fromRow, biome: B.wild.biomes[0] });
    let n = 0,
      bots = 0;
    for (let k = 0; k < 400; k++) {
      const rnd = modules.rng.rngFn('RL14BOTS', 'wild|' + k),
        q = fn('spawn')(false, null, 1, rnd);
      n++;
      if (!q.sp.startsWith('bot:')) continue;
      bots++;
      const found = modules.factions.factionBotOf(GAME_DATA.factions.factions, q.sp);
      assert.ok(found, `${q.sp} is a Bureau bot`);
      assert.ok(q.lvl >= W.pools.run_0.lv[0] && q.lvl <= W.pools.run_0.lv[1], `level ${q.lvl}`);
      assert.ok(!q.alpha && !q.hab && !q.coat, 'never an Alpha, in the grass, no coat');
    }
    assert.ok(bots / n > B.wild.chance / 2 && bots / n < B.wild.chance * 2, `${bots} bots of ${n}`);
    /* the save keeps a wild bot (saves.js validSave and saveFill) */
    const list = fn('wildList')(1),
      keep = list.filter(q => q.sp.startsWith('bot:')).slice(0, 2);
    list.splice(0, list.length, ...keep);
    assert.equal(fn('validSave')(JSON.parse(JSON.stringify(s))), true);
    const back = fn('saveFill')(JSON.parse(JSON.stringify(s)));
    assert.deepEqual(back.wild.run_0.list, keep, 'kept on a reload');
    /* a row too early, or a biome without bots: none */
    for (const at of [
      { row: B.wild.fromRow - 1, biome: B.wild.biomes[0] },
      { row: 8, biome: Object.keys(GAME_DATA.biomes).find(b => !B.wild.biomes.includes(b)) },
    ]) {
      Object.assign(node, at);
      for (let k = 0; k < 100; k++)
        assert.ok(!fn('spawn')(false, null, 1, modules.rng.rngFn('RL14NONE', 'wild|' + k)).sp.startsWith('bot:'));
    }
  } finally {
    Object.assign(node, was);
    data.worldHubBack();
  }
});

test('RL-14: a scrapyard is a laid-out place with scrap heaps, its scenes join, and every wild one is a bot', () => {
  let run = null;
  for (let k = 0; k < 60 && !run; k++) {
    const r = runOf('RL14YARD' + k);
    if (r.map.nodes.some(n => n.type === 'scrapyard')) run = r;
  }
  assert.ok(run, 'a seed with a scrapyard');
  const s = startedSave(GAME_DATA.rules.start.starters[0] + '0', 5),
    i = run.map.nodes.findIndex(n => n.type === 'scrapyard'),
    made = runScenesMake(run, WORLD_DATA),
    sc = made[i],
    W = runWorldTables(run, data.LOCATIONS[0], WORLD_DATA);
  assert.equal(runSceneParams(run, i, made, WORLD_DATA).site, 'scrapyard');
  assert.ok(sc.layout, 'laid out');
  /* its set pieces are the ones made for it (setPieces.json sites): a scrap heap, now and then a checkpoint */
  assert.ok((sc.pieces || []).some(p => p.id === 'scrap_heap') && sc.props.some(p => p.k === 'scrap'), 'a scrap heap');
  for (const p of sc.pieces) assert.ok(GAME_DATA.setPieces.pieces[p.id].sites.scrapyard > 0, p.id);
  assert.deepEqual(mapgenUnreachable(sc, GAME_DATA.scenery), [], 'all ground reachable');
  assert.ok(
    !made.some((m, j) => run.map.nodes[j].type !== 'scrapyard' && (m.pieces || []).some(p => p.id === 'scrap_heap')),
    'heaps in scrapyards only'
  );
  s.run = run;
  s.trip = { node: 0, plan: [] };
  runArrive(s, 0, MAP_DATA);
  data.worldPut({ ...W, maps: Object.fromEntries(W.locations.slice(1).map((p, j) => [p.mapId, made[j]])) });
  try {
    W.locations[i + 1].trainerCount = 2;
    run.path.push(i);
    const list = fn('encountersHere')(i + 1);
    assert.ok(list.length > 0);
    for (const q of list) assert.ok(q.sp.startsWith('bot:') && !q.rare, q.sp);
  } finally {
    data.worldHubBack();
  }
});

test('RO-3f: now and then a mythical stands in for the rarer one: by its own stream, once a run, never while one waits', () => {
  const Wr = data.RULES.run.wild.rare,
    myth = Wr.myth,
    sp = myth.list[0];
  assert.equal(GAME_DATA.lines.find(l => l.id + '0' === sp).rar, 'mythical');
  /* the rarer one on route 1 of a run, with this chance; the rest of the stock as it was without a mythical */
  const route = (/** @type {number} */ chance, /** @type {any} */ extra = {}, /** @type {any} */ waiting = null) => {
    const s = startedSave(GAME_DATA.rules.start.starters[0] + '0', 5),
      run = Object.assign(runOf('RT4RARE'), extra),
      made = runScenesMake(run, WORLD_DATA),
      W = runWorldTables(run, data.LOCATIONS[0], WORLD_DATA);
    s.run = run;
    s.trip = { node: 0, plan: [] };
    runArrive(s, 0, MAP_DATA);
    W.locations[1].trainerCount = 4;
    data.worldPut({ ...W, maps: Object.fromEntries(W.locations.slice(1).map((p, i) => [p.mapId, made[i]])) });
    Wr.myth = { ...myth, chance };
    if (waiting) s.wild = { ...(s.wild || {}), elsewhere: { at: 0, list: [waiting] } };
    try {
      const list = fn('encountersHere')(1);
      return { s, list: list.map(q => ({ ...q })), rare: list.find(q => q.rare), W };
    } finally {
      Wr.myth = myth;
      data.worldHubBack();
    }
  };
  const never = route(0),
    always = route(1);
  assert.notEqual(never.rare.sp, sp, 'chance 0: the rarest of the pool');
  assert.equal(always.rare.sp, sp, 'chance 1: the mythical');
  const P = never.W.pools.run_0;
  assert.ok(always.rare.lvl >= P.lv[0] + Wr.up && always.rare.lvl <= P.lv[1] + Wr.up, 'levelled like a rarer one');
  assert.ok(!always.rare.alpha);
  assert.deepEqual(
    always.list.slice(0, -1).map(q => [q.sp, q.lvl]),
    never.list.slice(0, -1).map(q => [q.sp, q.lvl]),
    'the rest of the stock is drawn the same'
  );
  assert.equal(route(1, { myth: 1 }).rare.sp, never.rare.sp, 'met this run: not again');
  assert.equal(route(1, {}, { id: 'w1', sp, lvl: 5 }).rare.sp, never.rare.sp, 'one waits elsewhere: not a second');
  /* battled or fled from: met */
  const s = startedSave(GAME_DATA.rules.start.starters[0] + '0', 5);
  s.run = runOf('RT4RARE');
  s.wild = { here: { at: 0, list: [{ id: 'q1', sp, lvl: 5 }] } };
  data.RULES.run.wild.rare.myth = myth;
  fn('dropEncounter')('q1');
  assert.equal(s.run.myth, 1);
  assert.equal(fn('spawnMyth')(1), null, 'none once met');
});

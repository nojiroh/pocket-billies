// Terrain TR-2a: mountains (game/js/logic/mapgen.js mapgenMountains, the land.mountains and land.massif dials). A
// scene made without the dials is the scene it always was; with them, ridges rise on the chosen sides up to 15 m and
// more, as smooth land you can walk plus step-grid shelves and cliffs, and still every exit can be walked to from the
// hub with the game's own rules (a step over 0.34 m or a slope over 1.05 stops you); nothing is planted across a
// cliff; a run with the debug menu's mountains mod makes scenes that join as every run's do. TR-2b: a footpath climbs
// each massif to a summit you can walk to (switchbacks, stone steps where steep).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, data, modules } from './setup-real.mjs';

const G = modules.mapgen;
const { runMapStart } = modules['run-map'];
const { newRun, validRun } = modules['run-state'];
const { RUN_MOD_MOUNTAINS, runSceneMake, runSceneParams, runWorldTables } = modules['run-scenes'];
const C = GAME_DATA.scenery,
  ctx = { scenery: C, biomes: GAME_DATA.biomes };

/** the tallest ground you could stand on in a scene: the smooth land plus its cell's step raise */
function top(sc) {
  const W = G.mapgenWalkGrid(sc, C);
  let t = -1e9;
  for (let j = 0; j < W.gh; j++)
    for (let i = 0; i < W.gw; i++)
      t = Math.max(t, G.mapgenSceneGround(sc, (i + 0.5) / 2, (j + 0.5) / 2) + (W.S ? W.S[j * W.gw + i] / 20 : 0));
  return t;
}
/** dial sets with mountains: every biome, every side choice, two and three exits, water, terraces, buildings */
function mountainous(n, seed0) {
  const biomes = Object.keys(GAME_DATA.biomes),
    sides = Object.keys(G.MAPGEN_MASSIF),
    out = [];
  for (let i = 0; i < n; i++)
    out.push({
      seed: seed0 + i,
      biome: biomes[i % biomes.length],
      land: {
        hills: (i % 5) / 5,
        terraces: (i % 3) / 3,
        cliffs: (i % 4) / 3,
        water: ['none', 'stream', 'pond'][i % 3],
        mountains: 0.5 + (0.5 * ((i * 7) % 5)) / 4,
        massif: sides[i % sides.length],
      },
      road: {
        exits:
          i % 2
            ? [
                { side: 'S', t: 0.5 },
                { side: 'N', t: 0.5 },
              ]
            : [
                { side: 'S', t: 0.3 },
                { side: 'N', t: 0.25 },
                { side: 'N', t: 0.75 },
              ],
        shape: ['winding', 'scurve', 'straight', 'switchback'][i % 4],
      },
      props: { mast: i % 3 === 0 ? 1 : 0, clinic: i % 4 === 0 ? 1 : 0, shop: i % 4 === 0 ? 1 : 0 },
    });
  return out;
}

test('without the mountains dials a scene is the one it always was (the dials stored as before)', () => {
  const p = { seed: 77, biome: 'ridge', land: { hills: 0.5, terraces: 0.6 } },
    a = G.mapgenScene(p, ctx).scene,
    b = G.mapgenScene({ ...p, land: { ...p.land, mountains: 0 } }, ctx).scene;
  assert.equal(Object.hasOwn(a.gen.params.land, 'mountains'), false);
  assert.equal(Object.hasOwn(a.gen.params.land, 'massif'), false);
  assert.deepEqual({ ...b, gen: null }, { ...a, gen: null }, 'mountains 0 makes no mountains');
});

test('the dials are kept in range: mountains 0-1, an unknown side choice is east and west', () => {
  const P = G.mapgenParams({ land: { mountains: 3, massif: 'up' } });
  assert.equal(P.land.mountains, 1);
  assert.equal(P.land.massif, 'EW');
  assert.equal(Object.hasOwn(G.mapgenParams({ land: { mountains: 'x' } }).land, 'mountains'), false);
});

test('40 dial sets with mountains: every exit walked to from the hub (steps and slopes as the game has them)', () => {
  const tall = [];
  for (const p of mountainous(40, 2000)) {
    const { scene: sc, notes } = G.mapgenScene(p, ctx),
      where = JSON.stringify(p);
    assert.deepEqual(G.mapgenUnreachable(sc, C, { slope: true }), [], where);
    /* (these exits are north and south: mountains asked for only there are kept off the exits' edges) */
    if (/[EW]/.test(p.land.massif)) assert.ok(sc.steps && sc.stepm, `${where}: mountains are step-grid shelves`);
    if (p.props.mast)
      assert.ok(
        sc.props.some(q => q.act === 'fly'),
        `${where}: the mast`
      );
    assert.deepEqual(notes, [], where);
    /* at the dial's top, mountains on a side with no exit reach 12 m at least (water keeps them back), most 15 m */
    if (p.land.mountains === 1 && /[EW]/.test(p.land.massif)) {
      const t = top(sc);
      assert.ok(t >= 12, `${where}: ${t.toFixed(1)} m`);
      tall.push(t);
    }
  }
  assert.ok(tall.length >= 4, `${tall.length} scenes at the dial's top`);
  assert.ok(tall.filter(t => t >= 15).length >= tall.length / 2, `tops ${tall.map(t => t.toFixed(1))}`);
});

test('at the top of the dial the mountains reach 15 m and more, on the sides asked for, the road left low', () => {
  const p = {
      seed: 7,
      biome: 'ridge',
      land: { hills: 0.4, mountains: 1, massif: 'W' },
      road: {
        exits: [
          { side: 'S', t: 0.5 },
          { side: 'N', t: 0.5 },
        ],
      },
    },
    sc = G.mapgenScene(p, ctx).scene,
    W = G.mapgenWalkGrid(sc, C),
    lv = (x, z) =>
      G.mapgenSceneGround(sc, x, z) +
      (W.S ? W.S[G.mapgenBetween(Math.floor(z * 2), 0, W.gh - 1) * W.gw + Math.floor(x * 2)] / 20 : 0);
  let west = 0,
    east = 0;
  for (let z = 1; z < sc.h; z += 1) {
    for (let x = 0.5; x < 20; x += 1) west = Math.max(west, lv(x, z));
    for (let x = sc.w - 20; x < sc.w; x += 1) east = Math.max(east, lv(x, z));
  }
  assert.ok(west >= 15, `the west reaches ${west.toFixed(1)} m`);
  assert.ok(east < 4, `the east stays at ${east.toFixed(1)} m`);
  /* the road: every point of the walks to the exits within a metre and a half of the hub's height */
  const h0 = lv(...sc.hub);
  for (const e of sc.edgeExits)
    for (const [x, z] of e.path) assert.ok(Math.abs(lv(x, z) - h0) < 3, `${e.id} ${x},${z}`);
});

test('nothing is planted across a cliff; mountains follow their own seed (relief) and leave the road alone', () => {
  const p = { seed: 31, biome: 'ridge', land: { mountains: 1, massif: 'EW' }, nature: { trees: 1, growth: 1 } },
    sc = G.mapgenScene(p, ctx).scene,
    W = G.mapgenWalkGrid(sc, C),
    raise = (x, z) =>
      W.S[G.mapgenBetween(Math.floor(z * 2), 0, W.gh - 1) * W.gw + G.mapgenBetween(Math.floor(x * 2), 0, W.gw - 1)];
  for (const q of sc.props) {
    if (!q.g || q.act) continue;
    const r = Math.min(1.5, Math.max(0.5, G.mapgenRadius(C.props[q.k], q.s || 1)));
    let lo = 1e9,
      hi = -1e9;
    for (let z = q.z - r; z <= q.z + r; z += 0.5)
      for (let x = q.x - r; x <= q.x + r; x += 0.5) {
        lo = Math.min(lo, raise(x, z));
        hi = Math.max(hi, raise(x, z));
      }
    assert.ok((hi - lo) / 20 <= 0.31, `${q.k} at ${q.x},${q.z} stands across ${(hi - lo) / 20} m`);
  }
  const b = G.mapgenScene({ ...p, seeds: { relief: 999 } }, ctx).scene;
  assert.notEqual(b.steps, sc.steps, 'another relief seed: other mountains');
  assert.deepEqual(
    b.edgeExits.map(e => e.path),
    sc.edgeExits.map(e => e.path),
    'the same road'
  );
  assert.deepEqual(G.mapgenScene(p, ctx).scene, sc, 'the same dials make the same scene');
});

test("the debug menu's mountains run: a valid run whose every place has mountains, joined as every run's are", () => {
  const R = GAME_DATA.rules.run,
    WORLD = {
      nodeTypes: GAME_DATA.nodeTypes,
      biomes: GAME_DATA.biomes,
      pools: data.POOLS,
      scenery: C,
      rules: R,
    },
    start = {
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
  /* WM-1: TR2MTN1 swapped for TR2MTN2. Known, before and after WM-1: about 1 place in 50 of this debug run has a
     north summit you can walk down from but not up to (a one-way ledge across its trail; seeds TR2MTN1, 3, 7, 9, 11
     over the two directions); recorded in HANDOFF for a terrain session. WM-3: the maps changed, TR2MTN1 is clean
     again and TR2MTN2 meets it (3 of 158 places over TR2MTN0-11, the same share). WM-5b: towns at their sizes moved
     the maps: TR2MTN0's village (node 7) has a river note now, so TR2MTN4 (clean) stands in; over 700 places of
     ordinary runs the notes are as many as before (11 and 12). TR-5: 8 of 158 places then had a summit cut off (a
     town's lot levelled a street a terrace up, or ledges and cliffs all round a tier); mapgenStairsUp cuts a flight
     to it, so TR2MTN5 (two cut off before) joins in, every summit reached */
  for (const seed of ['TR2MTN4', 'TR2MTN1', 'TR2MTN5']) {
    const run = newRun(seed, 1, G.MAPGEN_VERSION, start);
    run.mods = [RUN_MOD_MOUNTAINS];
    runMapStart(run, { nodeTypes: GAME_DATA.nodeTypes, biomes: GAME_DATA.biomes, rules: R });
    assert.equal(validRun(run), true, `${seed}: the save keeps it`);
    const made = [];
    run.map.nodes.forEach((_, i) => {
      assert.equal(runSceneParams(run, i, made, WORLD).land.mountains, 1);
      const { scene, notes } = runSceneMake(run, i, made, WORLD);
      assert.deepEqual(notes, [], `${seed} node ${i}`);
      assert.deepEqual(G.mapgenUnreachable(scene, C, { slope: true }), [], `${seed} node ${i}`);
      const R = G.mapgenReach(scene, C, scene.hub, { slope: true });
      /* TW-1: a town's spots (its square, its board) are not summits */
      for (const s of (scene.spots || []).filter(q => q.kind === 'summit'))
        assert.ok(G.mapgenReached(R, s.x, s.z), `${seed} node ${i}: its summit`);
      made.push(scene);
    });
    assert.ok(Math.max(...made.map(top)) >= 15, `${seed}: 15 m somewhere`);
    const W = runWorldTables(run, GAME_DATA.locations[0], WORLD),
      maps = Object.fromEntries(W.locations.slice(1).map((p, i) => [p.mapId, made[i]]));
    for (const L of W.roads) {
      const a = G.mapgenSeamAgreement(maps[L.a.map], L.a.exit, maps[L.b.map], L.b.exit, C);
      assert.deepEqual([a.dhNear, a.dhBand, a.raiseExit, a.walk], [0, 0, 0, null], `${seed} ${L.id}`);
    }
  }
});

/** TR-2b: dial sets as a run's scenes are made now: exits east and west, mountains at the back or front and back */
function trailed(n, seed0) {
  const biomes = Object.keys(GAME_DATA.biomes),
    out = [];
  for (let i = 0; i < n; i++)
    out.push({
      seed: seed0 + i,
      biome: biomes[i % biomes.length],
      land: {
        hills: (i % 5) / 5,
        terraces: (i % 3) / 3,
        cliffs: (i % 4) / 3,
        water: ['none', 'stream', 'pond'][i % 3],
        mountains: 0.6 + (0.4 * (i % 3)) / 2,
        massif: i % 2 ? 'NS' : 'N',
      },
      road: {
        exits:
          i % 2
            ? [
                { side: 'E', t: 0.5 },
                { side: 'W', t: 0.5 },
              ]
            : [
                { side: 'E', t: 0.15625 },
                { side: 'W', t: 0.5 },
                { side: 'E', t: 0.84375 },
              ],
        shape: ['winding', 'scurve', 'straight', 'switchback'][i % 4],
      },
    });
  return out;
}

test('trails: a footpath from the road climbs each massif to a summit you can walk to (40 dial sets)', () => {
  let scenes = 0,
    summits = 0,
    high = 0,
    top = 0,
    stairs = 0;
  for (const p of trailed(40, 7000)) {
    const sc = G.mapgenScene(p, ctx).scene,
      where = JSON.stringify(p),
      R = G.mapgenReach(sc, C, sc.hub, { slope: true });
    assert.deepEqual(G.mapgenUnreachable(sc, C, { slope: true }), [], where);
    for (const s of sc.spots || []) {
      assert.equal(s.kind, 'summit', where);
      assert.ok(G.mapgenReached(R, s.x, s.z), `${where}: the summit at ${s.x}, ${s.z} (${s.y} m)`);
      summits++;
      if (s.y >= 12) high++;
      top = Math.max(top, s.y);
    }
    if ((sc.spots || []).length) scenes++;
    const M = G.mapgenDecodeBase64(sc.stepm);
    if (M.some(f => (f & 15) === 8)) stairs++;
  }
  /* what it does today (40 of 40 with a trail, 60 summits, 19 at 12 m or more, the best 15 m and up): a floor, not a
     goal; the trail stops short of the highest ground (TR-2b's HANDOFF) */
  assert.ok(scenes >= 36, `${scenes} of 40 scenes have a trail`);
  assert.ok(summits >= 50, `${summits} summits`);
  assert.ok(high >= 12, `${high} summits at 12 m or more`);
  assert.ok(top >= 15, `the highest summit ${top} m`);
  assert.ok(stairs >= scenes, `${stairs} scenes with stone steps`);
});

test('a trail is the same for the same dials, follows the relief seed, and leaves the road and exits as they were', () => {
  const p = trailed(1, 7004)[0],
    a = G.mapgenScene(p, ctx).scene,
    b = G.mapgenScene(p, ctx).scene,
    c = G.mapgenScene({ ...p, seeds: { relief: 4242 } }, ctx).scene;
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.spots, c.spots);
  assert.deepEqual(
    a.edgeExits.map(e => e.path),
    c.edgeExits.map(e => e.path)
  );
});

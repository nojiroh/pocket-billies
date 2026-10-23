// Terrain TR-2c: ledges and pockets (game/js/logic/mapgen.js mapgenLedges, mapgenUntrap, mapgenPockets; the
// land.ledges dial). Inspired by Gen 3, where short ledges cut a route into bands you cross one way: the terraces'
// south fronts become ledges you hop down (stepm flag 16), never climb, with flights of stairs between them; no ledge
// drops you anywhere you can't walk back from (mapgenTraps, judged with the game's own rules: walk-view.js
// canStepBetween); the far corners get marked pockets. A scene made without the dial is the one it always was.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, data, modules } from './setup-real.mjs';

const G = modules.mapgen;
const { runMapStart } = modules['run-map'];
const { newRun } = modules['run-state'];
const { RUN_MOD_MOUNTAINS, runSceneMake, runWorldTables } = modules['run-scenes'];
const C = GAME_DATA.scenery,
  ctx = { scenery: C, biomes: GAME_DATA.biomes };

/** terraced dial sets with ledges, laid as a run's scenes are (exits east and west), some with mountains */
function ledged(n, seed0) {
  const biomes = Object.keys(GAME_DATA.biomes),
    out = [];
  for (let i = 0; i < n; i++)
    out.push({
      seed: seed0 + i,
      biome: biomes[i % biomes.length],
      land: {
        hills: (i % 5) / 5,
        terraces: 0.4 + (0.6 * (i % 3)) / 2,
        cliffs: (i % 4) / 3,
        water: ['none', 'stream', 'pond'][i % 3],
        ledges: i % 5 === 4 ? 0.5 : 1,
        ...(i % 4 === 3 ? { mountains: 0.8, massif: 'N' } : {}),
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

test('without the ledges dial a scene is the one it always was', () => {
  const p = { seed: 61, biome: 'meadow', land: { terraces: 0.7, cliffs: 0.5 } },
    a = G.mapgenScene(p, ctx).scene,
    b = G.mapgenScene({ ...p, land: { ...p.land, ledges: 0 } }, ctx).scene;
  assert.equal(Object.hasOwn(a.gen.params.land, 'ledges'), false);
  assert.deepEqual({ ...b, gen: null }, { ...a, gen: null });
  assert.equal(a.spots, undefined);
});

test('40 dial sets with ledges: every exit reached, no trap, ledges and stairs, pockets you can walk to', () => {
  let ledgeScenes = 0,
    stairScenes = 0,
    pockets = 0;
  for (const p of ledged(40, 8000)) {
    const sc = G.mapgenScene(p, ctx).scene,
      where = JSON.stringify(p),
      M = G.mapgenDecodeBase64(sc.stepm),
      R = G.mapgenReach(sc, C, sc.hub, { slope: true });
    assert.deepEqual(G.mapgenUnreachable(sc, C, { slope: true }), [], where);
    const T = G.mapgenTraps(sc, C);
    assert.equal(T.n, 0, `${where}: trapped at ${JSON.stringify(T.at)}`);
    if (M.some(f => f & 16)) ledgeScenes++;
    if (M.some(f => (f & 15) === 8)) stairScenes++;
    for (const s of (sc.spots || []).filter(s => s.kind === 'pocket')) {
      assert.ok(G.mapgenReached(R, s.x, s.z), `${where}: the pocket at ${s.x}, ${s.z}`);
      pockets++;
    }
  }
  assert.ok(ledgeScenes >= 38, `${ledgeScenes} of 40 scenes with ledges`);
  assert.ok(stairScenes >= 30, `${stairScenes} of 40 with stairs`);
  assert.ok(pockets >= 60, `${pockets} pockets`);
});

test('a ledge is one way: you hop down off it, you never climb it', () => {
  const sc = G.mapgenScene(ledged(1, 8001)[0], ctx).scene,
    R = G.mapgenReach(sc, C, sc.hub, { slope: true }),
    M = G.mapgenDecodeBase64(sc.stepm),
    { gw, gh, step } = R;
  let checked = 0;
  for (let q = gw; q < gw * gh && checked < 50; q++) {
    if (!(M[q] & 16) || M[q - gw] & 16) continue;
    const lv = r => G.mapgenSceneGround(sc, ((r % gw) + 0.5) / 2, (Math.floor(r / gw) + 0.5) / 2) + R.S[r] / 20,
      d = lv(q) - lv(q - gw);
    if (d <= 0.34 || R.blk[q] || R.blk[q - gw]) continue;
    assert.equal(step(q, q - gw), true, 'down off the ledge');
    assert.equal(step(q - gw, q), false, 'not up it');
    checked++;
  }
  assert.ok(checked > 10, `${checked} ledge cells checked`);
});

test('ledges are the same for the same dials and keep to their own stream', () => {
  const p = ledged(1, 8004)[0],
    a = G.mapgenScene(p, ctx).scene;
  assert.deepEqual(G.mapgenScene(p, ctx).scene, a);
  const b = G.mapgenScene({ ...p, land: { ...p.land, ledges: 0.5 } }, ctx).scene;
  assert.deepEqual(
    b.edgeExits.map(e => e.path),
    a.edgeExits.map(e => e.path),
    'the road stays'
  );
});

test("the debug menu's mountains run has ledges, no trap anywhere, and its scenes still join", () => {
  const R0 = GAME_DATA.rules.run,
    WORLD = { nodeTypes: GAME_DATA.nodeTypes, biomes: GAME_DATA.biomes, pools: data.POOLS, scenery: C, rules: R0 },
    start = {
      team: [],
      se: 0,
      items: {},
      pyramids: {},
      trip: { node: 0, plan: [] },
      wild: {},
      eggs: [],
      flags: {},
      seats: [],
      visited: {},
    };
  const run = newRun('TR2CLEDGE', 1, G.MAPGEN_VERSION, start);
  run.mods = [RUN_MOD_MOUNTAINS];
  runMapStart(run, { nodeTypes: GAME_DATA.nodeTypes, biomes: GAME_DATA.biomes, rules: R0 });
  const made = [];
  let ledges = 0;
  run.map.nodes.forEach((_, i) => {
    const { scene, notes } = runSceneMake(run, i, made, WORLD);
    assert.deepEqual(notes, [], `node ${i}`);
    assert.deepEqual(G.mapgenUnreachable(scene, C, { slope: true }), [], `node ${i}`);
    assert.equal(G.mapgenTraps(scene, C).n, 0, `node ${i}: no trap`);
    if (G.mapgenDecodeBase64(scene.stepm).some(f => f & 16)) ledges++;
    made.push(scene);
  });
  assert.ok(ledges >= made.length - 1, `${ledges} of ${made.length} places with ledges`);
  const W = runWorldTables(run, GAME_DATA.locations[0], WORLD),
    maps = Object.fromEntries(W.locations.slice(1).map((p, i) => [p.mapId, made[i]]));
  for (const L of W.roads) {
    const a = G.mapgenSeamAgreement(maps[L.a.map], L.a.exit, maps[L.b.map], L.b.exit, C);
    assert.deepEqual([a.dhNear, a.dhBand, a.raiseExit, a.walk], [0, 0, 0, null], L.id);
  }
});

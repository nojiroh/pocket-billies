// Region map track WM-6: a run's route numbers (run-scenes.js runRouteNumbers) and its signposts at the seams
// (runSignposts): numbers 1 to n on the main path's route-like places, by step from the landing; every exit's sign
// shows its place's number or name and says where its way goes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, GAME_DATA, modules } from './setup-real.mjs';

const G = modules.mapgen;
const { runMapStart } = modules['run-map'];
const { newRun } = modules['run-state'];
const { runSceneMake, runSceneExits, runRouteNumbers, runPlaceSign, runPlaceName, RUN_SIGN_SIDES } =
  modules['run-scenes'];
const C = GAME_DATA.scenery,
  R = GAME_DATA.rules.run,
  MAP_DATA = { nodeTypes: GAME_DATA.nodeTypes, biomes: GAME_DATA.biomes, rules: R },
  WORLD_DATA = { nodeTypes: GAME_DATA.nodeTypes, biomes: GAME_DATA.biomes, pools: data.POOLS, scenery: C, rules: R },
  START = {
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

/** a run's map @param {string} seed */
function runMap(seed) {
  const run = newRun(seed, 1, G.MAPGEN_VERSION, START);
  runMapStart(run, MAP_DATA);
  return run;
}

test('route numbers run 1 to n over the main path, by step from the landing', () => {
  for (let s = 0; s < 40; s++) {
    const map = runMap(`WM6NO${s}`).map,
      nos = runRouteNumbers(map, WORLD_DATA),
      where = `WM6NO${s}`;
    const got = nos.filter(n => n > 0).sort((a, b) => a - b);
    assert.ok(got.length >= 4, `${where}: ${got.length} routes`);
    assert.deepEqual(
      got,
      got.map((_, k) => k + 1),
      `${where}: no gaps`
    );
    map.nodes.forEach((n, i) => {
      const like = !!(GAME_DATA.nodeTypes[n.type] || {}).routeLike && !n.side;
      assert.equal(nos[i] > 0, like, `${where} node ${i} (${n.type})`);
      assert.equal(runPlaceSign(map, i, WORLD_DATA, nos), like ? `Route ${nos[i]}` : runPlaceName(map, i, WORLD_DATA));
    });
    /* a later step never has a lower number */
    for (const a of map.nodes.keys())
      for (const b of map.nodes.keys())
        if (nos[a] && nos[b] && (map.nodes[a].row || 0) < (map.nodes[b].row || 0))
          assert.ok(nos[a] < nos[b], `${where}: node ${a} before ${b}`);
  }
});

test("every exit's signpost shows its place and says where its way goes", () => {
  let signs = 0,
    named = 0;
  for (const seed of ['WM6SIGNA', 'WM6SIGNB', 'WM6SIGNC']) {
    const run = runMap(seed),
      map = run.map,
      nos = runRouteNumbers(map, WORLD_DATA),
      made = /** @type {any[]} */ ([]);
    map.nodes.forEach((node, i) => {
      const { scene } = runSceneMake(run, i, made, WORLD_DATA);
      made[i] = scene;
      const here = runPlaceSign(map, i, WORLD_DATA, nos),
        exits = runSceneExits(map, i);
      for (const p of scene.props.filter((/** @type {any} */ q) => q.act === 'sign' && q.exit)) {
        const where = `${seed} node ${i} ${p.exit}`,
          e = exits.find(x => x.id === p.exit);
        signs++;
        assert.ok(e, `${where}: its exit`);
        assert.equal(p.label, here, where);
        assert.ok(p.say.startsWith(nos[i] ? `${here}, ${scene.name}.` : `${here}.`), `${where}: ${p.say}`);
        if (!map.nodes[e.node].side === !node.side) {
          assert.ok(
            p.say.endsWith(` ${RUN_SIGN_SIDES[e.side]}: ${runPlaceSign(map, e.node, WORLD_DATA, nos)}.`),
            `${where}: ${p.say}`
          );
          named++;
        }
      }
    });
  }
  assert.ok(signs >= 30 && named >= signs * 0.8, `${named} of ${signs} signs name their way`);
});

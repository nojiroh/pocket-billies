// Routes track RT-1: route layouts (game/js/logic/mapgen.js mapgenStageLayout) on the game's own scenery and biomes.
// For each plan over a sweep of seeds and biomes: the same dials give the same scene; the walkable share from the
// hub is 55-65%; every exit is reached, nothing traps you, every spot stands where you can walk; no blocker on the
// road, in an exit's straight run-in or on the east and west seams; a forest mass can't be walked into; a scene
// without the dial is the one it always was.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const G = modules.mapgen;
const ctx = { scenery: GAME_DATA.scenery, biomes: GAME_DATA.biomes },
  C = GAME_DATA.scenery;
const PLANS = Object.keys(G.MAPGEN_LAYOUTS).filter(k => k !== 'none'),
  BIOMES = ['meadow', 'lake', 'thicket', 'ridge', 'autumn', 'canyon'],
  ROAD = {
    exits: [
      { side: 'E', t: 0.5 },
      { side: 'W', t: 0.5 },
    ],
  };
const params = (/** @type {string} */ layout, /** @type {number} */ k) => ({
  seed: 100 + k,
  biome: BIOMES[k % BIOMES.length],
  layout,
  pin: 'EW',
  road: { ...ROAD, shape: ['winding', 'scurve', 'straight'][k % 3] },
  land: { water: k % 4 === 0 ? 'stream' : 'none' },
});
const SWEEP = 8;

test('RT-1: every plan lands 55-65% walkable, reaches every exit and spot, traps no one', () => {
  for (const layout of PLANS)
    for (let k = 0; k < SWEEP; k++) {
      const P = params(layout, k),
        where = `${layout} ${P.biome} seed ${P.seed}`,
        { scene, notes } = G.mapgenScene(P, ctx);
      assert.deepEqual(notes, [], where);
      assert.equal(scene.layout.plan, layout, where);
      const R = G.mapgenReach(scene, C, scene.hub, { slope: true }),
        share = G.mapgenWalkShare(R);
      assert.ok(
        share >= G.MAPGEN_WALKABLE[0] && share <= G.MAPGEN_WALKABLE[1],
        `${where}: walkable ${share.toFixed(3)}`
      );
      assert.equal(share.toFixed(3), scene.layout.walk.toFixed(3), where);
      assert.deepEqual(G.mapgenUnreachable(scene, C, { slope: true }), [], where);
      assert.equal(G.mapgenTraps(scene, C).n, 0, `${where}: a trap`);
      const kinds = new Set();
      for (const s of scene.spots || []) {
        kinds.add(s.kind);
        if (s.kind === 'summit') continue;
        assert.ok(G.mapgenReached(R, s.x, s.z), `${where}: ${s.kind} at ${s.x}, ${s.z} can't be walked to`);
      }
      assert.ok(kinds.has('clearing') || kinds.has('deadend'), `${where}: no spots`);
    }
});

test('RT-1: blockers keep off the road, the exits run-in and the seams; a forest mass is solid', () => {
  for (const layout of PLANS)
    for (let k = 0; k < SWEEP; k += 2) {
      const P = params(layout, k),
        where = `${layout} ${P.biome} seed ${P.seed}`,
        { scene } = G.mapgenScene(P, ctx),
        W = G.mapgenWalkGrid(scene, C),
        tile = (/** @type {number} */ x, /** @type {number} */ z) =>
          scene.tiles[scene.h - 1 - Math.floor(z)][Math.floor(x)];
      for (const p of scene.props) {
        const M = C.props[p.k];
        if (!/canopy/.test(p.k) && !(M && M.box && /fence|hedge|wall/.test(p.k))) continue;
        assert.ok(p.x > 4 && p.x < scene.w - 4, `${where}: ${p.k} on a seam at ${p.x}`);
        assert.ok(!'pvKq'.includes(tile(p.x, p.z)), `${where}: ${p.k} on the road at ${p.x}, ${p.z}`);
      }
      /* the straight run-in from each exit can be walked */
      for (const e of scene.edgeExits) {
        const [x, z] = G.mapgenExitPoint(scene.w, scene.h, e),
          n = G.MAPGEN_INWARD[e.side];
        for (let t = 0; t < G.MAPGEN_STRAIGHT_IN; t += 0.5) {
          const q = Math.floor((z + n[1] * t) * W.N) * W.gw + Math.floor((x + n[0] * t) * W.N);
          assert.equal(W.blk[q], 0, `${where}: exit ${e.id} blocked ${t} m in`);
        }
      }
      /* deep forest is never walkable, and some of the scene is forest (but for the farmland's own blockers) */
      let deep = 0;
      for (let j = 0; j < W.gh; j++)
        for (let i = 0; i < W.gw; i++)
          if (tile((i + 0.5) / W.N, (j + 0.5) / W.N) === G.MAPGEN_DEEP) {
            deep++;
            assert.equal(W.blk[j * W.gw + i], 1, where);
          }
      if (GAME_DATA.biomes[P.biome].canopy) assert.ok(deep > 0, `${where}: no forest`);
    }
});

test('RT-1: the same dials make the same laid-out scene; the layout has its own stream', () => {
  for (const layout of PLANS) {
    const P = params(layout, 3),
      a = JSON.stringify(G.mapgenScene(P, ctx).scene),
      b = JSON.stringify(G.mapgenScene(P, ctx).scene);
    assert.equal(a, b, layout);
    const c = JSON.stringify(G.mapgenScene({ ...P, seeds: { layout: 999 } }, ctx).scene);
    assert.notEqual(a, c, `${layout}: the layout's own seed changes nothing`);
  }
});

test("RT-1: without the dial (or with 'none') a scene is the one it always was", () => {
  for (let k = 0; k < 4; k++) {
    const P = { ...params('none', k) },
      { layout, ...bare } = P;
    void layout;
    const a = G.mapgenScene(bare, ctx).scene,
      b = G.mapgenScene(P, ctx).scene;
    assert.equal(b.layout, undefined);
    assert.equal(JSON.stringify(a.props), JSON.stringify(b.props));
    assert.equal(JSON.stringify(a.tiles), JSON.stringify(b.tiles));
    assert.ok(!a.tiles.join('').includes(G.MAPGEN_DEEP));
  }
});

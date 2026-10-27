// Region map track WM-3: places of any size with exits on any side (game/js/logic/mapgen.js), on the game's own scenery
// and biomes. An L (a two by two with a corner walled off, the `cut` dial): the walled corner takes no building or
// lookout and can hardly be walked, the rest lands in the walkable band, every exit is reached. A north-going strip:
// tall grass across its way on, no notes. A north/south seam: the child made from the parent's edge strip at the grid's
// offset meets it with no gap and a straight walk across, laid where the grid says.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const G = modules.mapgen;
const ctx = { scenery: GAME_DATA.scenery, biomes: GAME_DATA.biomes },
  C = GAME_DATA.scenery,
  BIOMES = ['meadow', 'thicket', 'autumn', 'ridge'],
  PLANS = Object.keys(G.MAPGEN_LAYOUTS).filter(k => k !== 'none');

test('WM-3: an L: the cut corner walled off, the rest walkable as a route, every exit reached', () => {
  assert.ok(PLANS.length >= 2, PLANS.join());
  /* in by the west of the south-west cell, out by the north of the north-east: the north-west is cut */
  const cut = [0, 64, 64, 128];
  for (let k = 0; k < 6; k++) {
    const P = {
        seed: 300 + k,
        biome: BIOMES[k % BIOMES.length],
        layout: PLANS[k % PLANS.length],
        w: 128,
        h: 128,
        pin: 'EWN',
        ahead: 'N',
        cut,
        road: {
          exits: [
            { side: 'W', t: 0.25, width: 2 },
            { side: 'N', t: 0.75, width: 2 },
          ],
        },
      },
      where = `${P.layout} ${P.biome} seed ${P.seed}`,
      { scene, notes } = G.mapgenScene(P, ctx);
    assert.deepEqual(notes, [], where);
    assert.deepEqual(scene.gen.params.cut, cut, where);
    const R = G.mapgenReach(scene, C, scene.hub, { slope: true }),
      share = G.mapgenWalkShare(R, cut);
    assert.ok(share >= G.MAPGEN_WALKABLE[0] - 0.03 && share <= G.MAPGEN_WALKABLE[1] + 0.03, `${where}: ${share}`);
    assert.equal(share.toFixed(3), scene.layout.walk.toFixed(3), where);
    assert.deepEqual(G.mapgenUnreachable(scene, C, { slope: true }), [], where);
    /* the corner: little of it walked (the road's run-ins may brush it), nothing built on it */
    let inCut = 0,
      walked = 0;
    for (let q = 0; q < R.seen.length; q++) {
      const x = ((q % R.gw) + 0.5) / R.N,
        z = (Math.floor(q / R.gw) + 0.5) / R.N;
      if (!G.mapgenInCut(cut, x, z)) continue;
      inCut++;
      if (R.seen[q]) walked++;
    }
    assert.ok(walked / inCut < 0.25, `${where}: ${((100 * walked) / inCut).toFixed(0)}% of the cut corner walked`);
    for (const p of scene.props)
      if (p.act || p.k === 'lookout_tower') assert.ok(!G.mapgenInCut(cut, p.x, p.z), `${where}: ${p.k} in the cut`);
  }
});

test('WM-3: the cut dial: kept only inside the scene; a scene without it is the one it always was', () => {
  assert.deepEqual(G.mapgenParams({ w: 128, h: 128, cut: [0, 64, 64, 128] }).cut, [0, 64, 64, 128]);
  for (const bad of [[0, 64, 64, 200], [10, 10, 5, 20], 'x', [1, 2, 3]])
    assert.equal(G.mapgenParams({ w: 128, h: 128, cut: bad }).cut, undefined, JSON.stringify(bad));
  assert.equal('cut' in G.mapgenParams({}), false);
});

test('WM-3: a north-going strip: its way on north, tall grass across it, no notes', () => {
  for (let k = 0; k < 4; k++) {
    const P = {
        seed: 400 + k,
        biome: BIOMES[k % BIOMES.length],
        layout: PLANS[k % PLANS.length],
        w: 64,
        h: 128 + 64 * (k % 2),
        pin: 'EWNS',
        ahead: 'N',
        road: {
          exits: [
            { side: 'S', t: 0.3, width: 2 },
            { side: 'N', t: 0.6, width: 2 },
          ],
        },
      },
      where = `${P.layout} ${P.biome} ${P.w} x ${P.h}`,
      { scene, notes } = G.mapgenScene(P, ctx);
    assert.deepEqual(notes, [], where);
    assert.ok(
      (scene.grassPatches || []).some((/** @type {any} */ g) => g.across),
      `${where}: no tall grass across the road`
    );
    assert.deepEqual(G.mapgenUnreachable(scene, C, { slope: true }), [], where);
  }
});

test('WM-3: a north/south seam: the child made from the parent’s strip meets it, laid at the grid’s offset', () => {
  for (let k = 0; k < 4; k++) {
    /* the parent 128 x 64 on cells (0, 0) and (1, 0), its exit north 84 m along; the child 64 x 128 on cell (1, 1):
       64 m east of the parent's west edge, so the exit is 20 m along its south side */
    const parent = G.mapgenScene(
        {
          seed: 500 + k,
          biome: BIOMES[k % BIOMES.length],
          w: 128,
          h: 64,
          pin: 'EWN',
          ahead: 'N',
          road: {
            exits: [
              { side: 'W', t: 0.5, width: 2 },
              { side: 'N', t: 84 / 128, width: 2 },
            ],
          },
        },
        ctx
      ).scene,
      strip = G.mapgenEdgeStrip(parent, 'north', { w: 64, h: 128 }, 20 / 64),
      child = G.mapgenScene(
        {
          seed: 600 + k,
          biome: BIOMES[(k + 1) % BIOMES.length],
          w: 64,
          h: 128,
          pin: 'EWNS',
          ahead: 'N',
          road: {
            exits: [
              { side: 'S', t: 20 / 64, width: 2 },
              { side: 'N', t: 0.5, width: 2 },
            ],
          },
          edges: [strip],
        },
        ctx
      );
    const where = `seed ${500 + k}`;
    assert.deepEqual(child.notes, [], where);
    assert.equal(strip.side, 'S', where);
    const a = G.mapgenSeamAgreement(parent, 'north', child.scene, 'south', C);
    assert.ok(a, where);
    assert.deepEqual([a.dhNear, a.dhBand, a.raiseExit, a.walk], [0, 0, 0, null], where);
    const xa = G.mapgenExitOf(parent, 'north'),
      xb = G.mapgenExitOf(child.scene, 'south');
    assert.deepEqual(G.mapgenJoinOffset(parent, xa, child.scene, xb), [64, 64], `${where}: laid where the grid says`);
  }
});

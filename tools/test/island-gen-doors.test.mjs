// Hub track HB-4a: the island generator's door dials. town.face 'out' keeps a plot only on the street side whose front
// faces out from the orbit's pivot (the summit) within town.tol degrees, so the orbit camera sees the doors. The
// defaults leave the hub's island as it is (island-gen.test.mjs checks the game's map is the generator's own output).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';
import { islandAngleDiff, islandGenerate } from '../../game/js/logic/island-gen.js';

const D = readGameData(),
  ctx = { scenery: D.scenery },
  hub = D.maps.copperleaf.islandGen;
/** the hub's own dials with some town dials changed */
const withTown = town => ({ ...structuredClone(hub.dials), town: { ...hub.dials.town, ...town } });
/** each building plot's front against facing out from the orbit's pivot, in degrees */
const offOut = sc => {
  const [cx, cz] = sc.cam.orbit.c;
  return sc.plots
    .filter(L => L.k !== 'well')
    .map(L => ({ L, off: islandAngleDiff(L.a, (Math.atan2(L.z - cz, L.x - cx) * 180) / Math.PI) }));
};

test("town.face 'out': every town plot's front faces out from the pivot within tol", () => {
  for (const tol of [50, 35]) {
    const { scene } = islandGenerate(withTown({ face: 'out', tol }), hub.seed, ctx),
      town = offOut(scene).filter(o => o.L.k !== 'farmhouse');
    assert.ok(town.length >= 5, `${town.length} town plots`);
    /* measured at the plot's middle, the dial at the street's edge in front of it: a few degrees apart */
    for (const o of town) assert.ok(Math.abs(o.off) <= tol + 8, `${o.L.k} at ${o.L.x}, ${o.L.z}: ${o.off}`);
  }
});

test("town.face 'street' (the default) still puts plots facing away from the pivot", () => {
  const { scene } = islandGenerate(hub.dials, hub.seed, ctx);
  assert.ok(offOut(scene).some(o => Math.abs(o.off) > 90));
});

test('town.quarter 1: every building plot stands on the quarter turn nearest to facing out, none overlapping', () => {
  for (const face of ['out', 'street']) {
    const { scene } = islandGenerate(withTown({ face, quarter: 1 }), hub.seed, ctx),
      all = offOut(scene);
    assert.ok(all.length >= 5, `${all.length} plots`);
    for (const o of all) {
      assert.equal(((o.L.a % 90) + 90) % 90, 0, `${o.L.k} at ${o.L.a}`);
      /* the pivot is the summit spot, the dials turn from the peak's middle a few metres away: a few degrees apart */
      assert.ok(Math.abs(o.off) <= 50, `${o.L.k} at ${o.L.x}, ${o.L.z}: ${o.off}`);
    }
    /* no two plots' rectangles overlap */
    const corners = L => {
      const a = (L.a * Math.PI) / 180,
        ca = Math.cos(a),
        sa = Math.sin(a);
      return [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([u, v]) => [L.x - sa * u * (L.w / 2) + ca * v * (L.d / 2), L.z + ca * u * (L.w / 2) + sa * v * (L.d / 2)]);
    };
    const apart = (A, B) =>
      [A, B].some(P =>
        P.some((p, i) => {
          const q = P[(i + 1) % 4],
            nx = q[1] - p[1],
            nz = p[0] - q[0],
            pr = R => R.map(r => r[0] * nx + r[1] * nz);
          return Math.max(...pr(A)) <= Math.min(...pr(B)) || Math.max(...pr(B)) <= Math.min(...pr(A));
        })
      );
    for (let i = 0; i < scene.plots.length; i++)
      for (let j = i + 1; j < scene.plots.length; j++)
        assert.ok(apart(corners(scene.plots[i]), corners(scene.plots[j])), `${scene.plots[i].k} / ${scene.plots[j].k}`);
  }
});

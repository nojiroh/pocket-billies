// Island track IS-7: the hub's world map draws the real island (game/js/logic/bowl.js's coast from a polygon and an
// island's own heights; game/js/logic/bowl-island.js: which map, its heights, its buildings).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BOWL_ISLAND_BASE,
  BOWL_ISLAND_LIFT,
  bowlBaseHeight,
  bowlCoastAt,
  bowlCompass,
  bowlGridHeight,
  bowlGroundGrid,
  bowlIsles,
  bowlIslandPoly,
  bowlPolyDistance,
  bowlReliefFeatures,
  bowlSeaInput,
} from '../../game/js/logic/bowl.js';

/* a made-up island map: 200 x 200 m, a round coast 80 m from (100, 100), a 30 m cone in the middle */
const ROUND = Array.from({ length: 72 }, (_, k) => {
  const a = (k / 72) * Math.PI * 2;
  return [100 + Math.cos(a) * 80, 100 + Math.sin(a) * 80];
});
const ISLE_MAP = { w: 200, h: 200, island: { c: [100, 100], coast: ROUND } };
const cone = (mx, mz) => Math.max(0, 30 - Math.hypot(mx - 100, mz - 100) * 0.5);
const place = (id, a, r) => ({ id, mapId: id, bowl: { a, r } });
const SEA = { share: 0.4, depth: 0.035, rimLand: 0.45, rough: 0.8, seed: 0, island: 0.2 };
const N = 320;
const grid = (places, sea = SEA, maps = { hub: ISLE_MAP }, heights = true) =>
  bowlGroundGrid(
    bowlReliefFeatures(places),
    N,
    bowlSeaInput(
      places,
      [],
      l => maps[l.mapId] || null,
      1000,
      sea,
      heights ? l => (maps[l.mapId] === ISLE_MAP ? cone : null) : null
    )
  );

test('a polygon: distance below 0 inside, the distance to its edge outside', () => {
  const P = Float64Array.from([0, 0, 1, 0, 1, 1, 0, 1]);
  assert.ok(Math.abs(bowlPolyDistance(P, 0.5, 0.5) + 0.5) < 1e-9);
  assert.ok(Math.abs(bowlPolyDistance(P, 2, 0.5) - 1) < 1e-9);
  assert.ok(Math.abs(bowlPolyDistance(P, 0.5, -0.25) - 0.25) < 1e-9);
});

test('an island map lies on the bowl as the terrain stamps it: its middle on the spot, its north to the centre', () => {
  const spot = { x: 0.3, y: 0.4 },
    P = bowlIslandPoly(spot, {
      w: 200,
      h: 200,
      island: {
        coast: [
          [100, 100],
          [200, 100],
          [100, 200],
        ],
      },
    });
  const { north, east } = bowlCompass(spot.x, spot.y);
  assert.ok(Math.abs(P[0] - 0.3) < 1e-9 && Math.abs(P[1] - 0.4) < 1e-9, 'the map’s middle on the spot');
  assert.ok(Math.abs(P[2] - (0.3 + east[0] * 0.1)) < 1e-9 && Math.abs(P[3] - (0.4 + east[1] * 0.1)) < 1e-9, 'east');
  assert.ok(Math.abs(P[4] - (0.3 + north[0] * 0.1)) < 1e-9 && Math.abs(P[5] - (0.4 + north[1] * 0.1)) < 1e-9, 'north');
  assert.equal(bowlIslandPoly(spot, { w: 10, h: 10 }), null, 'no coast, no polygon');
});

test('the coast is exactly the island’s: land just inside, sea just outside, all round, whatever the seed', () => {
  for (const [a, r] of [
    [0, 0],
    [40, 0.3],
  ])
    for (const seed of [0, 7]) {
      const P = [place('hub', a, r)],
        G = grid(P, { ...SEA, seed }),
        S = bowlSeaInput(P, [], () => ISLE_MAP, 1000, SEA),
        poly = S.places[0].poly;
      for (let k = 0; k < poly.length; k += 6) {
        const x = poly[k],
          y = poly[k + 1],
          cx = S.places[0].x,
          cy = S.places[0].y,
          L = Math.hypot(x - cx, y - cy);
        /* 12 m in and out: the grid's corners are 6.25 m apart */
        const ix = cx + ((x - cx) * (L - 0.012)) / L,
          iy = cy + ((y - cy) * (L - 0.012)) / L,
          ox = cx + ((x - cx) * (L + 0.012)) / L,
          oy = cy + ((y - cy) * (L + 0.012)) / L;
        assert.ok(bowlCoastAt(G, ix, iy) < 0, `land inside at ${ix.toFixed(3)},${iy.toFixed(3)} (seed ${seed})`);
        assert.ok(bowlCoastAt(G, ox, oy) > 0, `sea outside at ${ox.toFixed(3)},${oy.toFixed(3)} (seed ${seed})`);
      }
      /* the map's own sea (its square past the coast) stays sea: no land forced over the whole map */
      const [cx, cy] = [S.places[0].x, S.places[0].y];
      assert.ok(bowlCoastAt(G, cx + 0.095, cy + 0.095) > 0, 'the map’s corner is sea');
      assert.ok(bowlCoastAt(G, cx + 0.3, cy) > 0, 'no round of land (sea.island) round it');
    }
});

test('an island world still: sea to the rim; the sea.island round only without an island map', () => {
  const P = [place('hub', 0, 0)],
    S = bowlSeaInput(P, [], () => ISLE_MAP, 1000, SEA),
    T = bowlSeaInput(P, [], () => ({ w: 88, h: 76 }), 1000, SEA);
  assert.deepEqual(bowlIsles(S), [], 'an island world, its land the island itself');
  assert.equal(bowlIsles(T).length, 1, 'no coast: the round of sea.island as before');
  assert.equal(bowlIsles(T)[0].r, 0.2);
});

test('the island’s own heights, lifted, replace the bump of its kind; flat until its map is in', () => {
  const P = [place('hub', 0, 0)],
    G = grid(P),
    flat = grid(P, SEA, { hub: ISLE_MAP }, false),
    top = bowlGridHeight(G, 0, 0) - bowlBaseHeight(0, 0),
    want = BOWL_ISLAND_BASE + (30 * BOWL_ISLAND_LIFT) / 1000;
  assert.ok(Math.abs(top - want) < 0.002, `the cone's top ${top.toFixed(4)} (want ${want.toFixed(4)})`);
  /* half way out the cone is 10 m high */
  const half = bowlGridHeight(G, 0.04, 0) - bowlBaseHeight(0.04, 0);
  assert.ok(Math.abs(half - (BOWL_ISLAND_BASE + (10 * BOWL_ISLAND_LIFT) / 1000)) < 0.002, `half way ${half}`);
  const lo = bowlGridHeight(flat, 0, 0) - bowlBaseHeight(0, 0);
  assert.ok(Math.abs(lo - BOWL_ISLAND_BASE) < 1e-4, `flat without heights (${lo})`);
  /* no rivers cut across it: its streams are its own map's */
  assert.equal((G.rivers || []).length, 0);
});

test('a map without a coast is drawn as before', () => {
  const P = [place('hub', 0, 0)],
    maps = { hub: { w: 88, h: 76 } },
    a = grid(P, SEA, maps),
    S = bowlSeaInput(P, [], l => maps[l.mapId], 1000, SEA);
  assert.equal(S.places[0].poly, undefined);
  const b = bowlGroundGrid(
    bowlReliefFeatures(P),
    N,
    bowlSeaInput(P, [], l => maps[l.mapId], 1000, SEA)
  );
  assert.deepEqual(a.h, b.h);
});

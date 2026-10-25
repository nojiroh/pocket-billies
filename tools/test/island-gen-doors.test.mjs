// Hub track HB-4a: the island generator's sketch dials. town.face 'out' keeps a plot only on the street side whose
// front faces out from the orbit's pivot (the summit) within town.tol degrees, so the orbit camera sees the doors;
// town.quarter turns every building plot to the quarter turn nearest to facing out; town.second a second built-up
// street; town.scale the house plots' size; town.extra the town's other buildings; landmarks the station with its sky
// rail and portal, the lighthouse and the windmill. The defaults leave the hub's island as it is (island-gen.test.mjs
// checks the game's map is the generator's own output).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';
import { islandAngleDiff, islandGenerate } from '../../game/js/logic/island-gen.js';
import { islandPointIn } from '../../game/js/logic/island.js';
import { mapgenReach } from '../../game/js/logic/mapgen.js';

const D = readGameData(),
  ctx = { scenery: D.scenery },
  hub = D.maps.copperleaf.islandGen;
/** the hub's own dials with some town dials changed */
const withTown = (town, more = {}) => ({
  ...structuredClone(hub.dials),
  town: { ...hub.dials.town, ...town },
  ...more,
});
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

/** the walk grid's cell of a point reached from the square */
const reached = (sc, R, p) => R.dist[Math.floor(p[1] * R.N) * R.gw + Math.floor(p[0] * R.N)] >= 0;
const near = (L, pts, m) => pts.some(q => Math.hypot(q[0] - L.x, q[1] - L.z) < m);

test('town.second: a second street beside the main street, walked to from the square, houses along it', () => {
  const { scene, paths } = islandGenerate(
      withTown({
        face: 'out',
        tol: 100,
        quarter: 1,
        houses: 16,
        scale: 0.7,
        second: { on: 1, along: 'main', side: 'out', off: 13 },
      }),
      hub.seed,
      ctx
    ),
    st = paths.filter(p => p.name === 'town second street');
  assert.equal(st.length, 1);
  const R = mapgenReach(scene, D.scenery, scene.hub, { slope: true }),
    pts = st[0].pts;
  assert.ok(pts.length >= 32, `${pts.length} points`);
  for (const q of [pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1]])
    assert.ok(reached(scene, R, q), `${q} not walked to from the square`);
  assert.ok(scene.plots.filter(L => L.k === 'house' && near(L, pts, 10)).length >= 2, 'houses along it');
});

test("town.second 'arc': pieces of a street round the pivot, each joined to the town", () => {
  const { scene, paths } = islandGenerate(
      withTown({ face: 'out', quarter: 1, second: { on: 1, along: 'arc', side: 'in', off: 9, span: 110, at: 40 } }),
      hub.seed,
      ctx
    ),
    pieces = paths.filter(p => /^town second street( \d+)?$/.test(p.name)),
    [cx, cz] = scene.cam.orbit.c,
    R = mapgenReach(scene, D.scenery, scene.hub, { slope: true });
  assert.ok(pieces.length >= 1);
  assert.ok(paths.some(p => p.name === 'town second street, a join'));
  for (const P of pieces) {
    const rs = P.pts.map(q => Math.hypot(q[0] - cx, q[1] - cz));
    /* round the peak (the pivot is the summit spot on it, a metre or so off) */
    assert.ok(Math.max(...rs) - Math.min(...rs) < 4, `${P.name}: ${Math.min(...rs)} - ${Math.max(...rs)} m out`);
    assert.ok(reached(scene, R, P.pts[Math.floor(P.pts.length / 2)]), `${P.name} not walked to`);
  }
});

test('town.scale: smaller house plots, more of them', () => {
  const big = islandGenerate(withTown({ houses: 30 }), hub.seed, ctx).scene.plots.filter(L => L.k === 'house'),
    small = islandGenerate(withTown({ houses: 30, scale: 0.7 }), hub.seed, ctx).scene.plots.filter(
      L => L.k === 'house'
    );
  for (const L of small) assert.ok(L.w <= 9 * 0.7 + 0.01 && L.d <= 7 * 0.7 + 0.01, `${L.w} x ${L.d}`);
  assert.ok(small.length > big.length, `${small.length} small, ${big.length} big`);
});

const sketchA = more =>
  islandGenerate(
    withTown(
      {
        face: 'out',
        tol: 100,
        quarter: 1,
        houses: 16,
        scale: 0.7,
        extra: ['inn', 'workshop', 'genebank', 'library'],
        second: { on: 1, along: 'main', side: 'out', off: 13 },
      },
      more
    ),
    hub.seed,
    ctx
  );
const only = (sc, k) => {
  const L = sc.plots.filter(P => P.k === k);
  assert.equal(L.length, 1, `${k}: ${L.length}`);
  return L[0];
};

test('town.extra: the inn, the Workshop, the Gene Bank and the library each get a plot in the town', () => {
  const { scene } = sketchA();
  for (const k of ['inn', 'workshop', 'genebank', 'library']) only(scene, k);
});

test('landmarks: the station with its rail out to sea and up to the portal, the lighthouse on the cove, the windmill by the farm', () => {
  const res = sketchA({ landmarks: { on: 1 } }),
    sc = res.scene,
    coast = sc.island.coast,
    st = only(sc, 'station'),
    { rail, portal } = res.landmarks;
  assert.ok(Math.hypot(rail[0][0] - st.x, rail[0][1] - st.z) < 1, 'the rail starts at the station');
  assert.ok(!islandPointIn(coast, portal[0], portal[1]), 'the portal is out over the sea');
  for (let i = 1; i < rail.length; i++) assert.ok(rail[i][2] >= rail[i - 1][2], 'the rail climbs all the way');
  assert.ok(portal[2] - rail[0][2] >= 40, `climbs ${portal[2] - rail[0][2]} m`);
  const lh = only(sc, 'lighthouse'),
    cove = hub.dials.cove,
    [ix, iz] = sc.island.c,
    lhA = (Math.atan2(lh.z - iz, lh.x - ix) * 180) / Math.PI;
  assert.ok(Math.abs(islandAngleDiff(lhA, cove.a)) <= cove.span / 2 + 14, `lighthouse at ${lhA}`);
  const wm = only(sc, 'windmill'),
    barn = sc.zones.find(Z => Z.k === 'barn'),
    bc = barn.poly.reduce((m, p) => [m[0] + p[0] / barn.poly.length, m[1] + p[1] / barn.poly.length], [0, 0]);
  assert.ok(Math.hypot(wm.x - bc[0], wm.z - bc[1]) < 45, 'the windmill by the barn');
  /* every landmark on the island, its door turned out on a quarter turn */
  for (const L of [st, lh, wm]) {
    assert.ok(islandPointIn(coast, L.x, L.z), `${L.k} on the island`);
    assert.equal(((L.a % 90) + 90) % 90, 0, `${L.k} at ${L.a}`);
  }
  /* off by default */
  assert.equal(islandGenerate(hub.dials, hub.seed, ctx).landmarks, undefined);
});

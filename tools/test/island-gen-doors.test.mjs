// Hub track HB-4a: the island generator's sketch dials. town.face 'out' keeps a plot only on the street side whose
// front faces out from the orbit's pivot (the summit) within town.tol degrees, so the orbit camera sees the doors;
// town.quarter turns every building plot to the quarter turn nearest to facing out; town.second a second built-up
// street; town.scale the house plots' size; town.extra the town's other buildings; landmarks the station with its sky
// rail and portal, the lighthouse and the windmill. The defaults leave the hub's island as it is (island-gen.test.mjs
// checks the game's map is the generator's own output).
// HB-4b: town.square (the square's radius, how far it stands back from the main street, the buildings round it), the
// house plots' floor and the quarter turn seen from the summit spot.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';
import { islandAngleDiff, islandGenerate } from '../../game/js/logic/island-gen.js';
import { islandPointIn } from '../../game/js/logic/island.js';
import { mapgenReach, mapgenReached } from '../../game/js/logic/mapgen.js';

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
      /* the pivot is the summit spot, a few metres from the peak the dials turn from: plots keep clear of the
         diagonals by as much (HB-4b), so the quarter turn holds from the summit spot too */
      assert.ok(Math.abs(o.off) <= 45, `${o.L.k} at ${o.L.x}, ${o.L.z}: ${o.off}`);
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
  /* landmarks.shore (3 m) from the water: room for the water track's tide and wading shallows */
  const wet = (x, z) => 'wd'.includes(sc.tiles[sc.h - 1 - Math.floor(z)][Math.floor(x)]);
  for (const L of [st, lh, wm])
    for (const [u, v] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ])
      for (let n = 0; n < 8; n++) {
        const a = (L.a * Math.PI) / 180,
          x = L.x - Math.sin(a) * u * (L.w / 2) + Math.cos(a) * v * (L.d / 2),
          z = L.z + Math.cos(a) * u * (L.w / 2) + Math.sin(a) * v * (L.d / 2);
        assert.ok(
          !wet(x + Math.cos((n * Math.PI) / 4) * 2.9, z + Math.sin((n * Math.PI) / 4) * 2.9),
          `${L.k} by the water`
        );
      }
  /* off by default */
  assert.equal(islandGenerate(hub.dials, hub.seed, ctx).landmarks, undefined);
});

/* ---------- HB-4b: the town square (town.square), the plot floor, the quarter turn seen from the summit spot ---------- */
/** B with a town square (tools/data/hub-sketches.json b2's town dials) and the square's dials changed */
const sketchB2 = (square, town = {}) =>
  islandGenerate(
    withTown(
      {
        face: 'out',
        tol: 90,
        quarter: 1,
        houses: 20,
        lanes: 3,
        scale: 0.6,
        extra: ['library', 'inn', 'workshop', 'genebank'],
        second: { on: 1, along: 'arc', side: 'in', off: 15, span: 140, at: 40 },
        square,
        ...town,
      },
      { landmarks: { on: 1 } }
    ),
    hub.seed,
    ctx
  );
const plaza = (sc, W, r) => {
  let n = 0;
  for (let j = Math.floor(W.z - r - 2); j <= W.z + r + 2; j++)
    for (let i = Math.floor(W.x - r - 2); i <= W.x + r + 2; i++)
      if (Math.hypot(i + 0.5 - W.x, j + 0.5 - W.z) <= r && sc.tiles[sc.h - 1 - j][i] === 'c') n++;
  return n;
};

test('town.square r: the paved square that wide round the well; off: further from the main street', () => {
  const near = (sc, W) =>
    Math.min(
      ...sc.paths
        .filter(p => p.name === 'town main street')
        .flatMap(p => p.pts)
        .map(p => Math.hypot(p[0] - W.x, p[1] - W.z))
    );
  const seen = [];
  for (const [r, off] of [
    [7.5, 0],
    [12, 0],
    [12, 6],
  ]) {
    const { scene: sc, paths } = sketchB2({ r, off, front: 0 }),
      W = only(sc, 'well');
    /* most of the disc paved (the streets that cross it keep their own ground) */
    assert.ok(plaza(sc, W, r) >= Math.PI * r * r * 0.6, `r ${r}: ${plaza(sc, W, r)} paved cells`);
    seen.push(near({ paths }, W));
  }
  assert.ok(seen[1] - seen[0] > 3.5, `r 12 stands further out than 7.5: ${seen}`);
  assert.ok(seen[2] - seen[1] > 5, `off 6 sets it 6 m further back: ${seen}`);
  /* the default is today's square */
  const { scene } = islandGenerate(hub.dials, hub.seed, ctx);
  assert.equal(
    islandGenerate(withTown({ square: { r: 7.5, off: 0, front: 0 } }), hub.seed, ctx).scene.plots.length,
    scene.plots.length
  );
});

test('town.square front: buildings round the square, by its rim, one facing into it, every door out on a quarter turn', () => {
  const r = 12,
    { scene: sc } = sketchB2({ r, off: 6, front: 6 }),
    W = only(sc, 'well'),
    /* how far a plot's nearest edge stands from the square's rim */
    gap = L => {
      const a = (L.a * Math.PI) / 180,
        dx = W.x - L.x,
        dz = W.z - L.z,
        u = Math.max(0, Math.abs(dx * Math.cos(a) + dz * Math.sin(a)) - L.d / 2),
        v = Math.max(0, Math.abs(-dx * Math.sin(a) + dz * Math.cos(a)) - L.w / 2);
      return Math.hypot(u, v) - r;
    },
    round = sc.plots.filter(L => L.k !== 'well' && gap(L) < 4);
  assert.ok(round.length >= 3, `${round.length} plots by the square: ${round.map(L => L.k)}`);
  /* a plot keeps off paving as off a street: sampled 0.6 m inside its edge, the paving per metre cell (island-gen.js
     plotFits) */
  for (const L of round) assert.ok(gap(L) > -1.2, `${L.k} stands on the square: ${gap(L)}`);
  const facing = round.filter(L => {
    const a = (L.a * Math.PI) / 180;
    return Math.cos(a) * (W.x - L.x) + Math.sin(a) * (W.z - L.z) > 0.7 * Math.hypot(W.x - L.x, W.z - L.z);
  });
  assert.ok(facing.length >= 1, 'one of them faces into the square');
  for (const o of offOut(sc)) {
    assert.equal(((o.L.a % 90) + 90) % 90, 0, `${o.L.k} at ${o.L.a}`);
    assert.ok(Math.abs(o.off) <= 45, `${o.L.k} at ${o.L.x}, ${o.L.z}: ${o.off}`);
  }
  /* B2: at least 8 cottages, and every one of the town's buildings */
  assert.ok(sc.plots.filter(L => L.k === 'house').length >= 8, 'houses');
  for (const k of ['lab', 'shop', 'home', 'mast', 'inn', 'library', 'workshop', 'genebank', 'station']) only(sc, k);
});

test("town.scale: a house plot is never smaller than a cottage's footprint (3.4 x 2.4 m) and 0.2 m round", () => {
  for (const scale of [0.6, 0.7]) {
    const { scene } = islandGenerate(withTown({ face: 'out', tol: 90, quarter: 1, houses: 20, scale }), hub.seed, ctx),
      houses = scene.plots.filter(L => L.k === 'house');
    assert.ok(houses.length >= 5);
    for (const L of houses) assert.ok(L.w >= 3.8 - 1e-9 && L.d >= 2.8 - 1e-9, `${L.w} x ${L.d}`);
  }
});

test('town.quarter: within 45 degrees of facing out from the summit spot itself (cam.orbit.c), on other seeds too', () => {
  for (const seed of [hub.seed, 'another', 's1']) {
    const { scene } = islandGenerate(withTown({ face: 'out', tol: 90, quarter: 1, houses: 16, scale: 0.7 }), seed, ctx);
    for (const o of offOut(scene))
      assert.ok(Math.abs(o.off) <= 45, `${seed}: ${o.L.k} at ${o.L.x}, ${o.L.z}: ${o.off}`);
  }
});

test('landmarks: the coast road goes round the station plot, which stands where it did', () => {
  const { scene: sc, paths, notes } = sketchB2({ r: 12, off: 6, front: 6 }),
    st = only(sc, 'station'),
    a = (st.a * Math.PI) / 180,
    on = (p, m) => {
      const dx = p[0] - st.x,
        dz = p[1] - st.z;
      return (
        Math.abs(dx * Math.cos(a) + dz * Math.sin(a)) <= st.d / 2 + m &&
        Math.abs(-dx * Math.sin(a) + dz * Math.cos(a)) <= st.w / 2 + m
      );
    };
  assert.ok(notes.includes('loop goes round the station'), notes.join('; '));
  for (const p of paths) assert.ok(!p.pts.some(q => on(q, p.width / 2)), `${p.name} through the station`);
  /* no path tile under it */
  for (let z = Math.floor(st.z - 8); z < st.z + 8; z++)
    for (let x = Math.floor(st.x - 8); x < st.x + 8; x++)
      if (on([x + 0.5, z + 0.5], 0)) assert.ok(!'pvc'.includes(sc.tiles[sc.h - 1 - z][x]), `a path at ${x}, ${z}`);
  /* the summit, the dock and every plot's front still walked to from the hub */
  const R = mapgenReach(sc, sc.scenery, sc.hub, { slope: true });
  for (const S of sc.spots.filter(S => ['summit', 'dock'].includes(S.kind)))
    assert.ok(mapgenReached(R, S.x, S.z), S.kind);
  for (const L of sc.plots.filter(L => L.k !== 'well')) {
    const b = (L.a * Math.PI) / 180;
    assert.ok(
      mapgenReached(R, L.x + Math.cos(b) * (L.d / 2 + 0.9), L.z + Math.sin(b) * (L.d / 2 + 0.9)),
      `${L.k} at ${L.x}, ${L.z}`
    );
  }
});

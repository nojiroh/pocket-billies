// Hub track HB-10a: Copperleaf's town square as tools/patch-copperleaf-square.mjs leaves it: paved to its lobed rim
// (about 10 m out), the fountain in the middle where the well stood, the signpost and the hub's spot clear of its basin,
// no plot on the paving. HB-10b: what stands round its edge (tools/square-props.mjs). Reads the built map.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';
import { SQUARE_EDGE, SQUARE_R, VIEW, WALK_R, squareHubSpot, squareRim } from '../square-props.mjs';
import { mapgenReach } from '../../game/js/logic/mapgen.js';

const D = readGameData(),
  C = D.scenery.props,
  M = D.maps.copperleaf,
  { w, h } = M,
  tile = (i, j) => (M.tiles[h - 1 - j] || '')[i],
  well = M.plots.find(L => L.k === 'well');

test('the rim: about 10 m on average, between 8.2 and 11.8 m, furthest toward the north-east (the portal)', () => {
  const rs = Array.from({ length: 360 }, (_, d) => squareRim((d * Math.PI) / 180)),
    mean = rs.reduce((a, b) => a + b, 0) / rs.length,
    far = rs.indexOf(Math.max(...rs));
  assert.ok(Math.abs(mean - SQUARE_R) < 0.15, `mean rim ${mean}`);
  assert.ok(Math.min(...rs) >= 8.2 && Math.max(...rs) <= 11.8);
  assert.ok(far > 0 && far < 90, `furthest at ${far} degrees`);
});

test('the square is paved to its rim and no further', () => {
  let bad = 0;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const x = i + 0.5,
        z = j + 0.5,
        r = Math.hypot(x - well.x, z - well.z);
      if (r > 12) continue;
      const inside = r <= squareRim(Math.atan2(z - well.z, x - well.x));
      if (inside !== (tile(i, j) === 'c')) bad++;
    }
  assert.equal(bad, 0, `${bad} tiles off the rim`);
});

test('no plot stands on the paving', () => {
  for (const L of M.plots.filter(L => L.k !== 'well')) {
    const a = (L.a * Math.PI) / 180;
    for (let j = Math.floor(L.z - 10); j <= L.z + 10; j++)
      for (let i = Math.floor(L.x - 10); i <= L.x + 10; i++) {
        const dx = i + 0.5 - L.x,
          dz = j + 0.5 - L.z,
          u = Math.abs(dx * Math.cos(a) + dz * Math.sin(a)),
          v = Math.abs(-dx * Math.sin(a) + dz * Math.cos(a));
        if (u <= L.d / 2 && v <= L.w / 2) assert.notEqual(tile(i, j), 'c', `${L.k} plot at ${L.x}, ${L.z}`);
      }
  }
});

test('the fountain in the middle, no well; the signpost and the hub spot clear of its basin', () => {
  const F = M.props.filter(p => p.k === 'fountain');
  assert.equal(F.length, 1);
  assert.deepEqual([F[0].x, F[0].z], [well.x, well.z]);
  assert.equal(M.props.filter(p => p.k === 'well').length, 0);
  const basin = C.fountain.solid,
    S = M.props.find(p => p.k === 'signpost');
  assert.ok(Math.hypot(S.x - well.x, S.z - well.z) >= basin + 1, 'the signpost');
  assert.ok(Math.hypot(M.hub[0] - well.x, M.hub[1] - well.z) >= basin + 0.6, 'the hub spot');
  assert.equal(tile(Math.floor(M.hub[0]), Math.floor(M.hub[1])), 'c', 'the hub spot on the square');
});

test('round the edge: every prop of the layout on the paving, none in the walk round the fountain', () => {
  const E = M.props.filter(p => p.sq);
  assert.equal(E.length, SQUARE_EDGE.length);
  for (const p of E) {
    const r = Math.hypot(p.x - well.x, p.z - well.z);
    assert.equal(tile(Math.floor(p.x), Math.floor(p.z)), 'c', `${p.k} at ${p.x}, ${p.z} off the paving`);
    assert.ok(r >= WALK_R, `${p.k} at ${p.x}, ${p.z}: ${r.toFixed(1)} m from the middle`);
    assert.ok(Math.hypot(p.x - M.hub[0], p.z - M.hub[1]) >= 1.5, `${p.k} on the hub spot`);
  }
});

test('the view toward the sky rail and the portal stays low: only planters in it', () => {
  for (const p of M.props.filter(p => p.sq)) {
    const deg = (Math.atan2(p.z - well.z, p.x - well.x) * 180) / Math.PI;
    if (deg >= VIEW[0] && deg <= VIEW[1]) assert.equal(p.k, 'planter_round', `${p.k} at ${Math.round(deg)} degrees`);
  }
});

test('round the edge shuts nothing in: every cell walkable from the hub without it still is', () => {
  const a = mapgenReach({ ...M, props: M.props.filter(p => !p.sq) }, D.scenery, M.hub, { slope: true }),
    b = mapgenReach(M, D.scenery, M.hub, { slope: true });
  let lost = 0;
  for (let q = 0; q < a.dist.length; q++) if (a.dist[q] >= 0 && b.dist[q] < 0 && !b.blk[q]) lost++;
  assert.equal(lost, 0, `${lost} half-metre cells shut in`);
});

test("the hub's spot: a push up runs past the fountain on paving, with nothing in the way (the quick check's Running)", () => {
  assert.deepEqual(M.hub, squareHubSpot(M));
  assert.ok(
    !M.checks.some(c => c.from && Math.hypot(c.from[0] - 151.63, c.from[1] - 59.36) < 0.01),
    'a check left at the old spot'
  );
  /* the orbit camera points up toward cam.orbit.c; a run there and back is about 3.5 m each way */
  const O = M.cam.orbit.c,
    L = Math.hypot(O[0] - M.hub[0], O[1] - M.hub[1]),
    u = [(O[0] - M.hub[0]) / L, (O[1] - M.hub[1]) / L],
    at = s => [M.hub[0] + s * u[0], M.hub[1] + s * u[1]];
  for (let s = -4; s <= 4; s += 0.25) {
    const [x, z] = at(s);
    assert.equal(tile(Math.floor(x), Math.floor(z)), 'c', `off the paving ${s} m along`);
    assert.ok(Math.hypot(x - well.x, z - well.z) >= C.fountain.solid + 1, `by the fountain ${s} m along`);
    for (const p of M.props)
      if (p.k !== 'fountain') assert.ok(Math.hypot(x - p.x, z - p.z) >= 1.5, `${p.k} in the way ${s} m along`);
  }
  assert.ok((well.x - M.hub[0]) * u[0] + (well.z - M.hub[1]) * u[1] > 1.5, 'the fountain ahead');
});

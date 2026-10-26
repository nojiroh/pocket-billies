// Hub track HB-10a: Copperleaf's town square as tools/patch-copperleaf-square.mjs leaves it: paved to its lobed rim
// (about 10 m out), the fountain in the middle where the well stood, the signpost and the hub's spot clear of its basin,
// no plot on the paving. Reads the built map.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';
import { SQUARE_R, squareRim } from '../patch-copperleaf-square.mjs';

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

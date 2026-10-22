// Island track IS-3: the sea all round (game/js/logic/sea.js). The skirt past a scene's edges leaves no gap in any
// direction out to the horizon, starts exactly on the scene's edge with the depth of the water there, is the open
// sea's depth by SEA_RAMP metres out, and turns its triangles the way the scene's water quads do. A cove zone is calm.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SEA_RAMP, SEA_RINGS, seaCalmAt, seaCentre, seaRamp, seaSkirt } from '../../game/js/logic/sea.js';

const W = 40,
  H = 30,
  edgeDep = (x, z) => (x < 10 && z === 0 ? 0 : 0.3 + (x + z) / 400);
const S = seaSkirt(W, H, edgeDep);

test('the inner ring lies on the scene edge, a vertex at least every half metre', () => {
  const pts = [];
  for (let i = 0; i < S.n; i++) {
    const x = S.x[i],
      z = S.z[i];
    assert.ok(x === 0 || z === 0 || Math.abs(x - W) < 1e-6 || Math.abs(z - H) < 1e-6, `(${x}, ${z}) is off the edge`);
    pts.push([x, z]);
  }
  for (let i = 0; i < pts.length; i++) {
    const [a, b] = pts[i],
      [c, d] = pts[(i + 1) % pts.length];
    assert.ok(Math.hypot(c - a, d - b) <= 0.5 + 1e-6, `a gap of ${Math.hypot(c - a, d - b)} m after (${a}, ${b})`);
  }
  for (const [x, z] of [
    [0, 0],
    [W, 0],
    [W, H],
    [0, H],
  ])
    assert.ok(
      pts.some(p => p[0] === x && p[1] === z),
      `the corner (${x}, ${z}) is on the ring`
    );
});

test('the depth at the edge is the water beside it; by SEA_RAMP metres out it is the open sea', () => {
  for (let i = 0; i < S.n; i++) assert.ok(Math.abs(S.dep[i] - edgeDep(S.x[i], S.z[i])) < 1e-6);
  const r = SEA_RINGS.findIndex(o => o >= SEA_RAMP);
  for (let i = 0; i < S.n; i++) assert.ok(S.dep[r * S.n + i] > 0.999);
  for (let i = 0; i < S.n; i++)
    for (let k = 1; k < S.rings; k++)
      assert.ok(S.dep[k * S.n + i] >= S.dep[(k - 1) * S.n + i] - 1e-6, 'deepens outward');
  assert.equal(seaRamp(0.4, 0), 0.4);
  assert.equal(seaRamp(0.4, SEA_RAMP), 1);
  assert.ok(seaRamp(0, SEA_RAMP / 2) > 0.4 && seaRamp(0, SEA_RAMP / 2) < 0.6);
});

test('no gap in any direction out to 400 m: every ray from the middle crosses the skirt to its last ring', () => {
  const last = SEA_RINGS[SEA_RINGS.length - 1];
  assert.ok(last >= 380, 'the skirt reaches the fog');
  const cx = W / 2,
    cz = H / 2,
    tri = (q, a, b, c) => {
      const s = (p, u, v) => (p[0] - v[0]) * (u[1] - v[1]) - (u[0] - v[0]) * (p[1] - v[1]),
        d1 = s(q, a, b),
        d2 = s(q, b, c),
        d3 = s(q, c, a);
      return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
    };
  const P = i => [S.x[i], S.z[i]];
  for (let a = 0; a < 360; a += 7.5) {
    const dx = Math.cos((a * Math.PI) / 180),
      dz = Math.sin((a * Math.PI) / 180);
    /* from just outside the scene to just inside the last ring, every metre lies in some triangle */
    const t0 = Math.min(
      Math.abs(dx) > 1e-9 ? W / 2 / Math.abs(dx) : 1e9,
      Math.abs(dz) > 1e-9 ? H / 2 / Math.abs(dz) : 1e9
    );
    for (let t = t0 + 0.2; t < t0 + last - 1; t += t < t0 + 30 ? 1 : 17) {
      const q = [cx + dx * t, cz + dz * t];
      let hit = false;
      for (let m = 0; m < S.idx.length && !hit; m += 3) hit = tri(q, P(S.idx[m]), P(S.idx[m + 1]), P(S.idx[m + 2]));
      assert.ok(hit, `a hole at ${a} degrees, ${(t - t0).toFixed(1)} m out`);
    }
  }
});

test('every triangle turns the way the scene water quads do', () => {
  /* ground-mesh.js: (x0,z0) -> (x0,z1) -> (x1,z0), a negative cross in x, z */
  let flat = 0;
  for (let m = 0; m < S.idx.length; m += 3) {
    const [a, b, c] = [S.idx[m], S.idx[m + 1], S.idx[m + 2]],
      cr = (S.x[b] - S.x[a]) * (S.z[c] - S.z[a]) - (S.z[b] - S.z[a]) * (S.x[c] - S.x[a]);
    if (Math.abs(cr) < 1e-9) flat++;
    else assert.ok(cr < 0, `triangle ${m / 3} turns the other way`);
  }
  assert.ok(flat < S.idx.length / 30, 'only the corner fans of the inner ring are flat');
});

test('the swell centre, and a cove is calm', () => {
  assert.deepEqual(seaCentre({ w: 40, h: 30 }), [20, 15]);
  assert.deepEqual(seaCentre({ w: 40, h: 30, cam: { orbit: { c: [5, 6] } } }), [5, 6]);
  assert.deepEqual(
    seaCentre({ w: 40, h: 30, island: { c: [7, 8], coast: [] }, cam: { orbit: { c: [5, 6] } } }),
    [7, 8]
  );
  const sc = {
    w: 100,
    h: 100,
    zones: [
      {
        k: 'beach',
        poly: [
          [0, 0],
          [50, 0],
          [50, 50],
        ],
      },
      {
        k: 'cove',
        poly: [
          [60, 40],
          [90, 40],
          [90, 70],
          [60, 70],
        ],
      },
    ],
  };
  assert.equal(seaCalmAt(sc, 75, 55), 1);
  assert.equal(seaCalmAt(sc, 20, 20), 0, 'far from a cove (a beach is not calm)');
  const near = seaCalmAt(sc, 93, 55);
  assert.ok(near > 0 && near < 1, 'easing off just outside');
  assert.ok(seaCalmAt(sc, 91, 55) > seaCalmAt(sc, 94, 55), 'smooth');
  assert.equal(seaCalmAt({ w: 10, h: 10 }, 5, 5), 0, 'no zones');
});

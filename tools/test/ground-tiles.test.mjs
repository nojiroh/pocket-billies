// Fluid track FL-5b (quality.groundTiles): the ground's indices put in 16 m tiles (game/js/logic/ground-tiles.js).
// The same triangles in another order, the groups (floors, walls, far land) kept as consecutive ranges, each tile's
// range and box right; a pass's view matrix keeps every tile it can see and merges neighbours. No graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groundTileOrder, groundTileRuns, groundBoxSeen, groundCurveLift } from '../../game/js/logic/ground-tiles.js';

/** a flat grid of quads (n x n cells of size s), vertices shared as the ground's are not (four a quad) */
function grid(n, s, y = 0, x0 = 0, z0 = 0) {
  const V = [],
    I = [];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const b = V.length / 9;
      for (const [dx, dz] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ])
        V.push(x0 + (i + dx) * s, y, z0 + (j + dz) * s, 0, 1, 0, 0, 0, 0);
      I.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
  return { V, I };
}
/** the triangles as sorted strings (their corners' indices), to compare sets */
const tris = I => {
  const out = [];
  for (let i = 0; i < I.length; i += 3) out.push([I[i], I[i + 1], I[i + 2]].join(','));
  return out.sort();
};
/** an orthographic matrix looking straight down at x0..x1, z0..z1 (column-major) */
function topDown(x0, x1, z0, z1) {
  const m = new Float32Array(16);
  m[0] = 2 / (x1 - x0);
  m[12] = -(x1 + x0) / (x1 - x0);
  m[9] = 2 / (z1 - z0);
  m[13] = -(z1 + z0) / (z1 - z0);
  m[6] = -0.01;
  m[15] = 1;
  return m;
}

test('the same triangles, each group still one consecutive range', () => {
  const A = grid(40, 0.5),
    B = grid(10, 2, 0, -20, -20),
    V = [...A.V, ...B.V],
    off = A.V.length / 9,
    I = [...A.I, ...A.I.slice(0, 60), ...B.I.map(i => i + off)],
    ends = [A.I.length, A.I.length + 60, I.length];
  const T = groundTileOrder(V, I, ends);
  assert.deepEqual(tris(T.I), tris(I));
  for (let g = 0; g < 3; g++) {
    const a = g ? ends[g - 1] : 0;
    assert.deepEqual(tris(T.I.slice(a, ends[g])), tris(I.slice(a, ends[g])), `group ${g}`);
  }
  let at = 0;
  for (const t of T.tiles) {
    assert.equal(t.a, at, 'tiles follow each other');
    at += t.n;
    assert.ok(t.a >= (t.g ? ends[t.g - 1] : 0) && t.a + t.n <= ends[t.g], 'a tile inside its group');
  }
  assert.equal(at, I.length);
});

test('a tile holds the quads under it, and its box bounds them', () => {
  const G = grid(64, 0.5); /* 32 m: 2 x 2 tiles */
  const T = groundTileOrder(G.V, G.I, [G.I.length]);
  assert.equal(T.tiles.length, 4);
  for (let t = 0; t < 4; t++) {
    const tl = T.tiles[t];
    assert.equal(tl.n, 32 * 32 * 6);
    for (let k = tl.a; k < tl.a + tl.n; k++) {
      const v = T.I[k] * 9;
      for (let c = 0; c < 3; c++) {
        assert.ok(G.V[v + c] >= T.box[t * 6 + c] && G.V[v + c] <= T.box[t * 6 + 3 + c]);
      }
    }
    assert.equal(T.box[t * 6], tl.tx * 16);
    assert.equal(T.box[t * 6 + 2], tl.tz * 16);
  }
});

test('a view keeps only the tiles it sees, neighbours in one draw', () => {
  const G = grid(128, 0.5); /* 64 m: 4 x 4 tiles */
  const T = groundTileOrder(G.V, G.I, [G.I.length]);
  const all = groundTileRuns(T, topDown(-1, 65, -1, 65), 1);
  assert.equal(all.seen, 16);
  assert.deepEqual(all.runs, [0, G.I.length]);
  /* the two middle columns of tiles in the first two rows: two runs (one a row) */
  const part = groundTileRuns(T, topDown(17, 47, 1, 30), 1);
  assert.equal(part.seen, 4);
  assert.equal(part.runs.length, 4);
  /* the other groups aren't drawn */
  assert.equal(groundTileRuns(T, topDown(-1, 65, -1, 65), 2).seen, 0);
});

test('every triangle that lands in the view is drawn (no tile wrongly left out)', () => {
  const G = grid(96, 0.5);
  const T = groundTileOrder(G.V, G.I, [G.I.length]);
  for (const [x0, x1, z0, z1] of [
    [3, 9, 3, 9],
    [15.9, 16.1, 31.9, 32.2],
    [40, 47.9, 0, 5],
  ]) {
    const m = topDown(x0, x1, z0, z1),
      r = groundTileRuns(T, m, 1),
      drawn = new Set();
    for (let i = 0; i < r.runs.length; i += 2) for (let k = r.runs[i]; k < r.runs[i] + r.runs[i + 1]; k++) drawn.add(k);
    for (let k = 0; k < T.I.length; k++) {
      const v = T.I[k] * 9,
        x = G.V[v],
        z = G.V[v + 2];
      if (x > x0 && x < x1 && z > z0 && z < z1) assert.ok(drawn.has(k), `index ${k} at ${x},${z}`);
    }
  }
});

test('a box behind a perspective camera is left out, one around it kept; the curve widens the box', () => {
  /* a camera at the origin looking down -z (a standard perspective, column-major) */
  const n = 0.5,
    f = 100,
    m = new Float32Array(16);
  m[0] = 1;
  m[5] = 1;
  m[10] = (f + n) / (n - f);
  m[11] = -1;
  m[14] = (2 * f * n) / (n - f);
  const behind = [-1, -1, 5, 1, 1, 9],
    ahead = [-1, -1, -9, 1, 1, -5],
    around = [-1, -1, -1, 1, 1, 1];
  assert.equal(groundBoxSeen(m, behind, 0), false);
  assert.equal(groundBoxSeen(m, ahead, 0), true);
  assert.equal(groundBoxSeen(m, around, 0), true);
  /* below the view, brought into it by the world's curve */
  const low = [-1, -40, -11, 1, -30, -9];
  assert.equal(groundBoxSeen(m, low, 0), false);
  assert.equal(groundBoxSeen(m, low, 0, 30), true);
  assert.equal(groundCurveLift([0, 0, 0, 10, 0, 10], 0, [0, 0, 0.01, 4]), 0.01 * (Math.hypot(10, 10) - 4) ** 2);
  assert.equal(groundCurveLift([0, 0, 0, 1, 0, 1], 0, [0, 0, 0.01, 4]), 0);
});

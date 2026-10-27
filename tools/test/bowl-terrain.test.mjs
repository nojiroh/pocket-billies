// LD-5 (cutscenes session): logic/bowl-terrain.js bowlTerrainRows, the world map's ground squares: a band of rows
// worked out on its own (the helper thread's, its first row at 0) is the same as those rows of the whole map.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-real.mjs';

const { bowlTerrainRows } = modules['bowl-terrain'];

test('bowl terrain: a band of rows matches the same rows worked out whole', () => {
  const N = 64,
    C = 16,
    g = 9,
    h = new Float32Array(g * g).map((_, k) => 0.02 * Math.sin(k)),
    P = {
      N,
      C,
      near: new Uint8Array(C * C).map((_, k) => k % 2),
      lists: [
        { r: [1, 2], k: [3], wet: [4], dry: [5], high: [6] },
        { r: [7], k: [], wet: [], dry: [8], high: [] },
      ],
      S: [
        { x: -0.3, y: 0.2 },
        { x: 0.4, y: -0.1 },
      ],
      G: { n: g - 1, e: 1.05, h, wet: null, c: null },
      slopeG: { n: g - 1, e: 1.05, h: new Float32Array(g * g) },
      L: { r: 9, n: 10, s: 11, S: 12, N: 13, P: 14 },
      ox: 3,
      oy: 5,
      i0: 0,
      i1: N,
      metres: 1000,
    };
  const whole = new Uint8Array(N * N);
  bowlTerrainRows(P, 0, N, whole);
  assert.ok(
    whole.some(v => v > 0),
    'something worked out'
  );
  const j0 = 20,
    j1 = 37,
    band = new Uint8Array((j1 - j0) * N);
  bowlTerrainRows(P, j0, j1, band, j0);
  assert.deepEqual(band, whole.slice(j0 * N, j1 * N));
});

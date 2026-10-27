// Air track AIR-4: the light-in-air march's blue-noise tile (game/js/logic/blue-noise.js). The baked table is what the
// maker makes, every value comes up equally often, and the tile has next to no low frequencies (white noise has them
// as much as any other). Plain numbers, no graphics.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BLUE_NOISE_64, blueNoiseMake, blueNoiseTable } from '../../game/js/logic/blue-noise.js';

const N = 64;
/* the mean power at the frequencies within radius r (not 0), as a share of what white noise of the same spread has */
function lowPower(t, r) {
  let m = 0;
  for (const v of t) m += v;
  m /= t.length;
  let vr = 0;
  for (const v of t) vr += (v - m) ** 2;
  let p = 0,
    c = 0;
  for (let ky = -r; ky <= r; ky++)
    for (let kx = -r; kx <= r; kx++) {
      if ((!kx && !ky) || kx * kx + ky * ky > r * r) continue;
      let re = 0,
        im = 0;
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const a = (2 * Math.PI * (kx * x + ky * y)) / N,
            v = t[y * N + x] - m;
          re += v * Math.cos(a);
          im -= v * Math.sin(a);
        }
      p += re * re + im * im;
      c++;
    }
  return p / c / vr;
}

test('the baked tile is the one blueNoiseMake makes (64 x 64, seed 1)', () => {
  assert.equal(BLUE_NOISE_64.length, 5464);
  assert.deepEqual(blueNoiseTable(), blueNoiseMake(64, 1));
});

test('every value 0..255 comes up 16 times', () => {
  const h = new Array(256).fill(0);
  for (const v of blueNoiseTable()) h[v]++;
  assert.ok(h.every(c => c === 16));
});

test('blue: almost no low frequencies, unlike white noise', () => {
  const t = blueNoiseTable();
  let s = 7;
  const w = Uint8Array.from({ length: N * N }, () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 16) & 255);
  const b = lowPower(t, 4),
    wn = lowPower(w, 4);
  assert.ok(b < 0.05, `blue low power ${b.toFixed(3)}`);
  assert.ok(wn > 0.4, `white low power ${wn.toFixed(3)}`);
});

test('neighbours differ: no two side by side within 4 steps of 256 more than rarely', () => {
  const t = blueNoiseTable();
  let close = 0;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) if (Math.abs(t[y * N + x] - t[y * N + ((x + 1) % N)]) < 4) close++;
  /* white noise: about 3% of pairs */
  assert.ok(close / (N * N) < 0.015, `close pairs ${close}`);
});

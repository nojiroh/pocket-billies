// Studio track ST-3: pixel art drawn big back to true scale (game/js/logic/pixel-snap.js): the size of the big
// pixels and their grid found in a noisy upscale, each cell's most common colour, clear cells kept clear.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-real.mjs';

const P = modules['pixel-snap'];
const COLOURS = [
  [0, 0, 0, 0],
  [214, 60, 40, 255],
  [40, 90, 200, 255],
  [250, 220, 120, 255],
  [30, 30, 30, 255],
];
/* a 9 x 7 sprite of colour numbers, made with a fixed seed */
let seed = 7;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const sprite = Array.from({ length: 7 }, () => Array.from({ length: 9 }, () => Math.floor(rnd() * COLOURS.length)));
/* drawn at `s` px a pixel, starting `ox`, `oy` in, with noise of up to `noise` a channel */
function upscale(s, ox, oy, noise) {
  const w = 9 * s + ox + 3,
    h = 7 * s + oy + 2,
    data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = Math.floor((x - ox) / s),
        sy = Math.floor((y - oy) / s),
        c = sx >= 0 && sy >= 0 && sx < 9 && sy < 7 ? COLOURS[sprite[sy][sx]] : COLOURS[0];
      const i = (y * w + x) * 4;
      for (let k = 0; k < 3; k++) data[i + k] = c[k] + (c[3] ? Math.round((rnd() * 2 - 1) * noise) : 0);
      data[i + 3] = c[3];
    }
  return { width: w, height: h, data };
}

test('finds the size and grid of the big pixels, not a multiple of it', () => {
  for (const [s, ox, oy] of [
    [4, 2, 1],
    [3, 0, 0],
    [6, 5, 3],
  ]) {
    const d = P.snapDetect(upscale(s, ox, oy, 6));
    assert.deepEqual([d.scale, d.ox, d.oy], [s, ox, oy], `${s}x at ${ox}, ${oy}`);
  }
  // on a noisy opaque background (an AI image): the noise is not taken for edges
  const im = upscale(4, 3, 2, 6);
  for (let i = 0; i < im.data.length; i += 4)
    if (!im.data[i + 3]) im.data.set([238, 232, 214].map(v => v + Math.round((rnd() * 2 - 1) * 5)).concat(255), i);
  const d = P.snapDetect(im);
  assert.deepEqual([d.scale, d.ox, d.oy], [4, 3, 2], 'on a background');
  // true-scale art has no grid to find
  assert.equal(P.snapDetect(upscale(1, 0, 0, 0)).scale, 1);
});

test('each cell gets its most common colour; clear cells stay clear', () => {
  const out = P.snapToPixels(upscale(4, 2, 1, 6), 4, 2, 1);
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 9; x++) {
      const c = COLOURS[sprite[y][x]],
        i = ((y + 1) * out.width + x + 1) * 4; // one cell of margin before the grid's start
      assert.equal(out.data[i + 3], c[3], `alpha at ${x}, ${y}`);
      if (c[3]) for (let k = 0; k < 3; k++) assert.ok(Math.abs(out.data[i + k] - c[k]) <= 3, `colour at ${x}, ${y}`);
    }
  // a cell half covered by a stray pixel of another colour keeps the colour most of it has
  const im = {
    width: 2,
    height: 2,
    data: Uint8ClampedArray.from([9, 9, 9, 255, 200, 0, 0, 255, 200, 0, 0, 255, 200, 0, 0, 255]),
  };
  assert.deepEqual([...P.snapToPixels(im, 2).data], [200, 0, 0, 255]);
});

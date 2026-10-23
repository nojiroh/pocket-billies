// Studio plan Phase 5, T5.1: the picture steps of the kit baker (game/js/logic/kit-pixels.js) against values Python,
// colorsys and Pillow give. kit-bake-parity.test.mjs checks them all together on the 24 kit Billies.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-real.mjs';

const P = modules['kit-pixels'];
const img = (w, h, px) => ({ width: w, height: h, data: new Uint8ClampedArray(px.flat()) });

test("Python's round(x, n): a half goes to the even neighbour", () => {
  assert.equal(P.kitRoundDigits(0.0625, 3), 0.062);
  assert.equal(P.kitRoundDigits(0.03125, 4), 0.0312);
  assert.equal(P.kitRoundDigits(0.96 * 0.62, 4), 0.5952);
  assert.equal(P.kitRoundDigits(-1.23456, 3), -1.235);
});

test("colorsys's HSV both ways, and Pillow's saturation and value", () => {
  assert.deepEqual(P.kitRgbToHsv(0.2, 0.4, 0.6), [0.5833333333333334, 0.6666666666666666, 0.6]);
  assert.deepEqual(P.kitRgbToHsv(0.6, 0.2, 0.4), [0.9166666666666666, 0.6666666666666666, 0.6]);
  assert.deepEqual(P.kitHsvToRgb(0.95, 0.5, 0.8), [0.8, 0.4, 0.5200000000000004]);
  assert.deepEqual(P.kitPilSatVal(200, 60, 90), [178, 200]);
});

test('mirrors, widths and pasting keep hard alpha', () => {
  const a = img(3, 1, [
    [1, 2, 3, 255],
    [0, 0, 0, 0],
    [7, 8, 9, 255],
  ]);
  assert.deepEqual([...P.kitFlipX(a).data], [7, 8, 9, 255, 0, 0, 0, 0, 1, 2, 3, 255]);
  assert.equal(P.kitOpaqueWidth(a), 3);
  const c = P.kitBlank(4, 2);
  P.kitPaste(c, a, 1, 1);
  assert.deepEqual([...c.data.subarray(20, 32)], [1, 2, 3, 255, 0, 0, 0, 0, 7, 8, 9, 255]);
});

test('recolouring leaves outlines and white highlights, and a head keeps its face', () => {
  const a = img(3, 1, [
    [20, 20, 20, 255],
    [250, 250, 250, 255],
    [120, 160, 200, 255],
  ]);
  const r = P.kitRecolour(a, [0, 1, 1]);
  assert.deepEqual([...r.data.subarray(0, 8)], [20, 20, 20, 255, 250, 250, 250, 255]);
  assert.notDeepEqual([...r.data.subarray(8, 12)], [120, 160, 200, 255]);
  assert.equal(P.kitRecolour(a, null), a);
});

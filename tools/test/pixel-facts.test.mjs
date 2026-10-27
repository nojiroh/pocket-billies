// Load track LD-1: what the game reads out of a picture's pixels (game/js/logic/pixel-facts.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leafCutKey,
  leafCutName,
  leafCutPixels,
  leafOutlineColour,
  pixelLightness,
} from '../../game/js/logic/pixel-facts.js';

/** a W x H picture, every pixel from f(x, y) -> [r, g, b, a] */
const pic = (W, H, f) => {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) d.set(f(x, y), (y * W + x) * 4);
  return d;
};

test('lightness: the mean over opaque pixels only, the middle when none is', () => {
  const d = pic(2, 1, x => (x ? [255, 255, 255, 255] : [0, 0, 0, 0]));
  assert.equal(pixelLightness(d), 1);
  assert.equal(pixelLightness(pic(2, 2, () => [9, 9, 9, 0])), 0.5);
});

test('the outline colour is the darkest colour used more than 15 times', () => {
  const d = pic(8, 8, (x, y) => (y < 2 ? [10, 10, 10, 255] : y < 3 ? [0, 0, 0, 255] : [200, 100, 50, 255]));
  assert.deepEqual(leafOutlineColour(d), [10, 10, 10]);
});

test('a cut: the whole picture darkened, a box, a circle with its lower rim outlined', () => {
  const d = pic(8, 8, () => [100, 200, 50, 255]);
  const whole = leafCutPixels(8, 8, d, [0, 0, 0], { shade: 0.5 });
  assert.deepEqual([whole.w, whole.h, ...whole.data.slice(0, 4)], [8, 8, 50, 100, 25, 255]);
  const box = leafCutPixels(8, 8, d, [0, 0, 0], { clip: [2, 2, 5, 4] });
  assert.deepEqual([box.w, box.h], [3, 2]);
  const c = leafCutPixels(8, 8, d, [1, 2, 3], { clip: [4, 4, 2] });
  assert.deepEqual([c.w, c.h], [4, 4]);
  const at = (x, y) => [...c.data.slice((y * 4 + x) * 4, (y * 4 + x) * 4 + 4)];
  assert.deepEqual(at(0, 0), [0, 0, 0, 0], 'outside the circle');
  assert.deepEqual(at(1, 1), [100, 200, 50, 255], 'inside, above the rim');
  assert.deepEqual(at(1, 3), [1, 2, 3, 255], 'the lower rim');
});

test('a cut is named by its picture, clip and shade', () => {
  assert.equal(leafCutKey('a.png', { clip: [1, 2, 3] }), 'a.png|1,2,3|1');
  assert.match(leafCutName('a.png|1,2,3|1'), /^[0-9a-f]{8}$/);
  assert.notEqual(leafCutName('a.png|1,2,3|1'), leafCutName('a.png|1,2,3|0.8'));
});

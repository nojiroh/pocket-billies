// Characters track CH-1: how a person is seen (game/js/logic/person-view.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copiedAnchor } from '../../game/js/logic/person-view.js';

/* a person's walk frame as person-art.js personFrame tags it: 64 px wide, feet at (30, 112), 66.5 px a metre */
const FRAME = { width: 64, height: 120, ax: 30, ay: 112, ppm: 66.5, noNormal: true };
/* where walk/frame-items.js personItem stands a picture: its offsets and metres a pixel, with the old fallbacks */
const stood = im => ({ ox: -(im.ax ?? 16), oy: -(im.ay ?? 40), mpp: 1 / (im.ppm || 42) });

test('person view: a dark copy stands where the person stands, the same size', () => {
  const copy = { width: 64, height: 120, ...copiedAnchor(FRAME) };
  assert.deepEqual(stood(copy), stood(FRAME));
  assert.equal(copy.noNormal, true);
  /* without it the copy falls back to (16, 40) at 42 px a metre: 1.58 times too tall, its feet 72 px too high */
  assert.ok(stood({ width: 64 }).mpp / stood(FRAME).mpp > 1.58);
});

test('person view: a mirrored copy has its anchor mirrored across the picture', () => {
  assert.deepEqual(copiedAnchor(FRAME, true), { ax: 34, ay: 112, ppm: 66.5, noNormal: true });
  /* an image (not a canvas) has its width as naturalWidth */
  assert.equal(copiedAnchor({ naturalWidth: 50, ax: 20 }, true).ax, 30);
  /* mirrored twice is the original */
  const once = { width: 64, ...copiedAnchor(FRAME, true) };
  assert.equal(copiedAnchor(once, true).ax, FRAME.ax);
});

test('person view: only what the original has is copied', () => {
  assert.deepEqual(copiedAnchor({ width: 8 }), {});
  assert.deepEqual(copiedAnchor({ width: 8, ppm: 32 }), { ppm: 32 });
  assert.deepEqual(copiedAnchor({ width: 8, ax: 0, ay: 0 }), { ax: 0, ay: 0 });
});

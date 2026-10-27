// Characters track CH-1: how a person is seen (game/js/logic/person-view.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WORD_HEADING,
  copiedAnchor,
  faceToward,
  faceWay,
  faceWord,
  facingWord,
} from '../../game/js/logic/person-view.js';

/* the walk view's rule as it was written in walk-view.js directionOf before CH-1 */
const oldDirectionOf = (mx, mz) =>
  Math.abs(mx) > Math.abs(mz) * 1.1 ? (mx > 0 ? 'sideR' : 'side') : mz > 0 ? 'up' : 'down';

test('person view: facingWord is the walk view’s old rule, everywhere', () => {
  for (let i = -40; i <= 40; i++)
    for (let j = -40; j <= 40; j++)
      assert.equal(facingWord(i / 7, j / 7), oldDirectionOf(i / 7, j / 7), `(${i}, ${j})`);
  /* the edges: sideways only past 1.1 times as sideways as not; standing still faces down */
  assert.equal(facingWord(1.1, 1), 'up');
  assert.equal(facingWord(1.11, 1), 'sideR');
  assert.equal(facingWord(-1.11, -1), 'side');
  assert.equal(facingWord(0, 0), 'down');
});

test('person view: faceToward gives the walk view’s word and keeps the heading', () => {
  const o = {};
  assert.equal(faceToward(o, 3, 0.5), 'sideR');
  assert.deepEqual(o, { dir: 'sideR', head: Math.atan2(3, 0.5), headDir: 'sideR' });
  for (let i = 0; i < 360; i++) {
    const a = (i * Math.PI) / 180,
      mx = Math.sin(a) * 2.5,
      mz = Math.cos(a) * 2.5;
    assert.equal(faceToward(o, mx, mz), oldDirectionOf(mx, mz), `${i} degrees`);
    assert.ok(Math.abs(o.head - Math.atan2(mx, mz)) < 1e-12);
  }
  /* standing on the spot faces down, as directionOf(0, 0) does, with down's heading */
  assert.equal(faceToward(o, 0, 0), 'down');
  assert.equal(o.head, Math.PI);
});

test('person view: faceWay is a world word with its heading; faceWord a plain word with none', () => {
  const o = {};
  for (const w of ['up', 'sideR', 'down', 'side']) {
    assert.equal(faceWay(o, w), w);
    assert.deepEqual(o, { dir: w, head: WORD_HEADING[w], headDir: w });
    /* a word's heading turns back into the word */
    assert.equal(facingWord(Math.sin(o.head), Math.cos(o.head)), w);
  }
  faceToward(o, 1, 1);
  assert.equal(faceWord(o, 'down'), 'down');
  assert.deepEqual(o, { dir: 'down', head: null, headDir: null });
});

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

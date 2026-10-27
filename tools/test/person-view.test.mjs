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
  personHeading,
  seenFacing,
  seenToward,
  seenWord,
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

const deg = d => (d * Math.PI) / 180;
const WORDS = ['up', 'sideR', 'down', 'side'];

test('person view: seen from a camera at yaw 0, every heading is the word it was made from', () => {
  for (let i = 0; i < 3600; i++) {
    const a = deg(i / 10),
      mx = Math.sin(a),
      mz = Math.cos(a);
    assert.equal(seenFacing(Math.atan2(mx, mz), 0), oldDirectionOf(mx, mz), `${i / 10} degrees`);
    assert.ok(WORDS.includes(seenFacing(a, deg(i % 360))), 'a frame key');
  }
  for (const w of WORDS) assert.equal(seenFacing(WORD_HEADING[w], 0), w);
});

test('person view: a turned camera sees the side that faces it', () => {
  /* camera.js: yaw 0 looks along +z with +x on the right; yaw 90 looks along +x with -z on the right */
  const east = Math.PI / 2,
    north = 0;
  assert.equal(seenFacing(east, deg(90)), 'up'); /* walking away from the camera: your back */
  assert.equal(seenFacing(north, deg(90)), 'side'); /* +z is on the camera's left */
  assert.equal(seenFacing(east, deg(-90)), 'down'); /* walking at the camera: your front */
  assert.equal(seenFacing(north, deg(180)), 'down');
  assert.equal(seenFacing(east, deg(180)), 'side');
  /* your own turn (up to 35 degrees each way) keeps a side view until the heading is past the line */
  assert.equal(seenFacing(east, deg(35)), 'sideR');
  assert.equal(seenFacing(east, deg(-35)), 'sideR');
  assert.equal(seenFacing(east, deg(45)), 'up');
  /* standing on the spot is down's heading, seen as the camera turns */
  assert.equal(seenToward(0, 0, 0), 'down');
  assert.equal(seenToward(0, 0, deg(90)), 'sideR');
  assert.equal(seenToward(2, 0, deg(90)), 'up');
});

test('person view: a plain word stays on the screen; a heading only while it goes with the word', () => {
  const o = {};
  faceWord(o, 'down');
  for (const y of [0, 1, -2.5, Math.PI]) assert.equal(seenWord(o, y), 'down');
  faceToward(o, 1, 0);
  assert.equal(seenWord(o, 0), 'sideR');
  assert.equal(seenWord(o, deg(90)), 'up');
  /* a plain write of dir alone (not through faceWord) leaves the heading behind: the word wins */
  o.dir = 'side';
  assert.equal(seenWord(o, deg(90)), 'side');
  /* an unknown word is left for the frames' fallback (fr[word] || fr.down) */
  assert.equal(seenWord({ dir: 'left' }, 1), 'left');
  assert.equal(seenWord({}, 1), undefined);
});

test('person view: personHeading is always a heading, and shows the word seenWord draws', () => {
  for (const y of [0, deg(35), deg(-90), deg(161), 3])
    for (const w of WORDS) {
      const plain = {},
        world = {};
      faceWord(plain, w);
      faceWay(world, w);
      assert.equal(seenFacing(personHeading(plain, y), y), w, `plain ${w} at ${y}`);
      assert.equal(seenFacing(personHeading(world, y), y), seenWord(world, y), `world ${w} at ${y}`);
      assert.equal(personHeading(world, y), WORD_HEADING[w]);
    }
});

test('person view: a set piece’s face (degrees from +x toward +z) is the heading pi/2 - face', () => {
  for (let f = -180; f <= 360; f += 15) {
    const o = {};
    faceToward(o, Math.cos(deg(f)), Math.sin(deg(f)));
    const d = o.head - (Math.PI / 2 - deg(f)),
      wrapped = Math.atan2(Math.sin(d), Math.cos(d));
    assert.ok(Math.abs(wrapped) < 1e-9, `face ${f}`);
  }
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

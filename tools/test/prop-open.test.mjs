// Intro track IN-3: an opening prop's frames (game/js/logic/prop-open.js, the Bureau's portal): a line pulled open
// into a square over its time, played back when it shuts, then gone; reduced motion skips the frames. And the portal's
// row in scenery.json names its frames, smallest first, each centred on its base point.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { openingFrame } from '../../game/js/logic/prop-open.js';

const O = { ms: 600, frames: [{}, {}, {}] };

test('no open time: its own picture', () => {
  assert.equal(openingFrame(O, {}, 5000), -1);
});

test('opening: the frames in order over ms, then its own picture', () => {
  const p = { open: 1000 };
  assert.equal(openingFrame(O, p, 1000), 0);
  assert.equal(openingFrame(O, p, 1250), 1);
  assert.equal(openingFrame(O, p, 1599), 2);
  assert.equal(openingFrame(O, p, 1600), -1);
  assert.equal(openingFrame(O, p, 900), 0, 'an open time ahead: the first frame (a line) till then');
});

test('shutting: the frames backwards, then nothing', () => {
  const p = { open: 0, shut: 2000 };
  assert.equal(openingFrame(O, p, 1999), -1, 'before it shuts: open');
  assert.equal(openingFrame(O, p, 2000), 2);
  assert.equal(openingFrame(O, p, 2450), 0);
  assert.equal(openingFrame(O, p, 2600), null);
});

test('reduced motion: just open, or just gone', () => {
  assert.equal(openingFrame(O, { open: 0 }, 10, true), -1);
  assert.equal(openingFrame(O, { open: 0, shut: 5 }, 10, true), null);
});

test('the Bureau portal: flat, unlit, its frames growing from a line, all centred', () => {
  const P = JSON.parse(readFileSync(new URL('../../game/data/scenery.json', import.meta.url), 'utf8')).props
    .bureau_portal;
  assert.ok(P && P.flat && P.emit && P.opens && P.opens.frames.length >= 3);
  const ys = P.opens.frames.map(f => f.oy);
  assert.deepEqual(
    [...ys].sort((a, b) => b - a),
    ys,
    'each frame deeper than the one before'
  );
  assert.ok(ys.at(-1) > P.oy, 'the full square is deepest');
  for (const f of [...P.opens.frames, P]) assert.ok(f.ox < 0 && f.oy < 0 && f.img.startsWith('scene/next/intro/'));
});

// Studio track ST-2: what the shared pixel canvas does to a picture (game/js/logic/pixel-ops.js): lines, fill inside a
// part, flips and quarter turns, symmetry, the palette lock, patches for the undo and the keys.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-real.mjs';

const P = modules['pixel-ops'];
const RED = [255, 0, 0, 255],
  BLUE = [0, 0, 255, 255];
/* a picture from rows of letters: . clear, r red, b blue */
const pic = rows => {
  const im = P.pxNew(rows[0].length, rows.length);
  rows.forEach((s, y) => [...s].forEach((ch, x) => ch !== '.' && P.pxSet(im, x, y, ch === 'r' ? RED : BLUE)));
  return im;
};
const rowsOf = im =>
  Array.from({ length: im.height }, (_, y) =>
    Array.from({ length: im.width }, (_, x) => {
      const c = P.pxGet(im, x, y);
      return !c[3] ? '.' : c[0] ? 'r' : 'b';
    }).join('')
  );

test('colours read and write as hex', () => {
  assert.deepEqual(P.pxRgba('#ff8000'), [255, 128, 0, 255]);
  assert.deepEqual(P.pxRgba('#f80'), [255, 136, 0, 255]);
  assert.equal(P.pxHex(255, 128, 0), '#FF8000');
  assert.equal(P.pxGet(P.pxNew(2, 2), 5, 0), null);
  assert.equal(P.pxSet(P.pxNew(2, 2), -1, 0, RED), false);
});

test('a line has both ends and no gaps', () => {
  const l = P.pxLine([0, 0], [4, 2]);
  assert.deepEqual(l[0], [0, 0]);
  assert.deepEqual(l.at(-1), [4, 2]);
  assert.equal(l.length, 5);
  assert.deepEqual(P.pxLine([3, 3], [3, 3]), [[3, 3]]);
});

test('fill stays inside the part and treats every clear pixel as one colour', () => {
  const im = pic(['....', '.bb.', '....']);
  im.data[1] = 9; /* a clear pixel with another hidden colour still fills */
  assert.equal(P.pxFill(im, 0, 0, RED, [0, 0, 2, 3]), 5);
  assert.deepEqual(rowsOf(im), ['rr..', 'rbb.', 'rr..']);
  assert.equal(P.pxFill(im, 0, 0, RED), 0, 'the same colour changes nothing');
  assert.equal(P.pxFill(im, 3, 0, RED, [0, 0, 2, 3]), 0, 'outside the part does nothing');
  assert.equal(P.pxFill(im, 1, 1, null), 2, 'null clears');
  assert.deepEqual(rowsOf(im), ['rr..', 'r...', 'rr..']);
});

test('symmetry mirrors about the middle of a box', () => {
  const s = P.pxSymmetryFor('v', [0, 0, 4, 3]);
  assert.deepEqual(P.pxMirrored(0, 0, s), [
    [0, 0],
    [3, 0],
  ]);
  assert.deepEqual(
    P.pxMirrored(1, 1, P.pxSymmetryFor('both', [0, 0, 3, 3])),
    [[1, 1]],
    'the middle pixel of an odd box is its own mirror'
  );
  assert.equal(P.pxMirrored(0, 0, P.pxSymmetryFor('both', [0, 0, 4, 4])).length, 4);
  assert.deepEqual(P.pxMirrored(2, 0, P.pxSymmetryFor('h', [0, 0, 4, 4])), [
    [2, 0],
    [2, 3],
  ]);
  assert.equal(P.pxMirrored(2, 2, null).length, 1);
});

test('a flip and a quarter turn move only the box', () => {
  const im = pic(['rb..', 'b...', '....']);
  P.pxFlip(im, [0, 0, 2, 2], 'h');
  assert.deepEqual(rowsOf(im), ['br..', '.b..', '....']);
  P.pxFlip(im, [0, 0, 2, 2], 'v');
  assert.deepEqual(rowsOf(im), ['.b..', 'br..', '....']);
  const sq = pic(['rb', '..']);
  P.pxRotate(sq, null, 1);
  assert.deepEqual(rowsOf(sq), ['.r', '.b']);
  P.pxRotate(sq, null, -1);
  assert.deepEqual(rowsOf(sq), ['rb', '..'], 'turning back undoes it');
  const wide = pic(['.....', '.rrb.', '.....']);
  const box = P.pxRotate(wide, [1, 1, 3, 1], 1);
  assert.deepEqual(box, [2, 0, 1, 3], 'a 3x1 box turns into a 1x3 one on the same middle');
  assert.deepEqual(rowsOf(wide), ['..r..', '..r..', '..b..']);
});

test('a patch is the box that changed, and puts it back', () => {
  const a = pic(['....', '....', '....']),
    b = pic(['....', '.r..', '..b.']);
  const box = P.pxDiffBox(a, b);
  assert.deepEqual(box, [1, 1, 2, 2]);
  assert.equal(P.pxDiffBox(a, P.pxNew(4, 3)), null);
  const before = P.pxCopy(a, box),
    after = P.pxCopy(b, box);
  assert.equal(before.data.length, 16);
  P.pxPaste(a, after);
  assert.deepEqual(rowsOf(a), rowsOf(b));
  P.pxPaste(a, before);
  assert.deepEqual(rowsOf(a), ['....', '....', '....']);
  assert.deepEqual(P.pxClip(a, [-2, -2, 4, 4]), [0, 0, 2, 2]);
  assert.equal(P.pxClip(a, [9, 9, 1, 1]), null);
});

test('the palette lock snaps to the nearest game colour and finds what is off it', () => {
  const cols = P.paletteColors({ ember: ['#200000', '#ff0000'], ink: '#101010', notes: 7 });
  assert.deepEqual(cols, ['#200000', '#FF0000', '#101010']);
  assert.equal(P.paletteNearest('#ee1111', cols), '#FF0000');
  assert.equal(P.paletteNearest('#121212', cols), '#101010');
  const im = pic(['rb']);
  assert.deepEqual([...P.offPalette(im, cols)], [0, 1]);
  assert.deepEqual(P.pxTopColors(pic(['rrb.'])), ['#FF0000', '#0000FF']);
  const real = P.paletteColors(globalThis.NW_PALETTE ? globalThis.NW_PALETTE.ramps : { a: ['#000000'] });
  assert.ok(real.length >= 1);
});

test('the keys: tools, Shift for flips, Ctrl for undo and redo, numbers for zoom', () => {
  const k = (key, o = {}) => P.pixelKeyAction({ key, ...o });
  assert.equal(k('b'), 'tool:pen');
  assert.equal(k('P'), 'tool:pen');
  assert.equal(k('H', { shiftKey: true }), 'flipH');
  assert.equal(k('h'), null);
  assert.equal(k('z', { ctrlKey: true }), 'undo');
  assert.equal(k('Z', { metaKey: true, shiftKey: true }), 'redo');
  assert.equal(k('y', { ctrlKey: true }), 'redo');
  assert.equal(k('y'), 'symmetry');
  assert.equal(k('3'), 'zoom:4');
  assert.equal(k('+', { shiftKey: true }), 'zoomIn');
  assert.equal(k("'", { ctrlKey: true }), 'grid');
  assert.equal(k('Escape'), 'deselect');
  for (const e of P.PIXEL_KEYS) assert.ok(e.keys && e.label && e.act, e.act);
});

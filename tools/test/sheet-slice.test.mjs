// Studio track ST-3: cutting a sheet into parts (game/js/logic/sheet-slice.js): Python's rounding, the masks and
// islands, rows, the template grid, trimming, names, front/back matching, Aseprite JSON and Pillow's box filter.
// The kits' parity with tools/slice-part-kit.py is in sheet-slice-parity.test.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-real.mjs';

const S = modules['sheet-slice'];
/* a picture from rows of letters: . background (magenta), anything else art (dark grey) */
const MAGENTA = [255, 0, 255, 255],
  ART = [40, 40, 40, 255];
const pic = rows => {
  const w = rows[0].length,
    h = rows.length,
    data = new Uint8ClampedArray(w * h * 4);
  rows.forEach((s, y) => [...s].forEach((ch, x) => data.set(ch === '.' ? MAGENTA : ART, (y * w + x) * 4)));
  return { width: w, height: h, data };
};
const maskRows = (m, w) => Array.from({ length: m.length / w }, (_, y) => [...m.subarray(y * w, y * w + w)].join(''));

test("Python's rounding: halves to even, thousandths exactly as round(x, 3)", () => {
  assert.deepEqual([0.5, 1.5, 2.5, 3.49, -0.5].map(S.roundHalfEven), [0, 2, 2, 3, 0]);
  assert.equal(S.roundThousandths(0.0625), 0.062); // an exact half: to even
  assert.equal(S.roundThousandths(0.1875), 0.188);
  assert.equal(S.roundThousandths(1 / 3), 0.333);
  assert.equal(S.roundThousandths(0.0005), 0.001); // not exactly a half as a double: nearest
});

test('masks: the magenta key, a colour key, clear pixels; erosion and dilation with a cross', () => {
  const im = pic(['.....', '.###.', '.###.', '.###.', '.....']);
  const m = S.sheetMask(im, 'magenta');
  assert.deepEqual(maskRows(m, 5), ['00000', '01110', '01110', '01110', '00000']);
  assert.deepEqual(maskRows(S.sheetMask(im, { rgb: [255, 0, 255], tol: 10 }), 5), maskRows(m, 5));
  assert.deepEqual(maskRows(S.maskErode(m, 5, 5), 5), ['00000', '00000', '00100', '00000', '00000']);
  assert.deepEqual(maskRows(S.maskDilate(S.maskErode(m, 5, 5), 5, 5), 5), [
    '00000',
    '00100',
    '01110',
    '00100',
    '00000',
  ]);
  assert.deepEqual(maskRows(S.maskDilate(S.maskErode(m, 5, 5), 5, 5, 1, true), 5), maskRows(m, 5));
  // the picture's edge counts as background when eroding (scipy's border_value 0)
  assert.deepEqual(maskRows(S.maskErode(new Uint8Array(9).fill(1), 3, 3), 3), ['000', '010', '000']);
  assert.deepEqual(S.sheetEdgeColor(im), [255, 0, 255]);
  // background colour inside the art stays art when only background joining the edge counts
  const ring = pic(['.....', '.###.', '.#.#.', '.###.', '.....']);
  assert.deepEqual(maskRows(S.sheetMask(ring, 'magenta'), 5)[2], '01010');
  assert.deepEqual(maskRows(S.sheetMask(ring, 'magenta', true), 5)[2], '01110');
});

test('islands: numbered in scan order, 4- or 8-connected, joined across a gap, specks dropped', () => {
  const im = pic(['#.....#', '.#.....', '.......', '...##..', '...##..']);
  const m = S.sheetMask(im, 'magenta');
  assert.equal(S.maskLabel(m, 7, 5, 4).count, 4);
  assert.equal(S.maskLabel(m, 7, 5, 8).count, 3);
  const { labels } = S.maskLabel(m, 7, 5, 4);
  assert.deepEqual([labels[0], labels[6], labels[8], labels[24]], [1, 2, 3, 4]);
  const isl = S.sheetIslands(im, { key: 'magenta', conn: 8, minArea: 2 });
  assert.deepEqual(
    isl.map(i => [i.x, i.y, i.w, i.h, i.area]),
    [
      [0, 0, 2, 2, 2],
      [3, 3, 2, 2, 4],
    ]
  );
  const joined = S.sheetIslands(im, { key: 'magenta', gap: 1, minArea: 1 });
  assert.equal(joined.length, 3); // the two diagonal pixels join; the box is the joined area's
  assert.equal(joined[0].area, 2);
  assert.deepEqual([joined[0].cx, joined[0].cy], [1.5, 1.5]); // the middle of the area grown by the gap
});

test('rows: split at the biggest gaps, left to right in each', () => {
  const at = (cx, cy) => ({ cx, cy });
  const rows = S.sheetRows([at(5, 10), at(1, 11), at(3, 40), at(9, 41), at(2, 42)], 2);
  assert.deepEqual(
    rows.map(r => r.map(i => i.cx)),
    [
      [1, 5],
      [2, 3, 9],
    ]
  );
});

test('the template grid, a cell trimmed to its art, trimming a piece', () => {
  const boxes = S.sheetGridBoxes({ cols: 2, rows: 2, x: 1, y: 2, cellW: 4, cellH: 3, gapX: 1, gapY: 0 });
  assert.deepEqual(
    boxes.map(b => [b.x, b.y, b.row, b.col]),
    [
      [1, 2, 0, 0],
      [6, 2, 0, 1],
      [1, 5, 1, 0],
      [6, 5, 1, 1],
    ]
  );
  const im = pic(['......', '..##..', '..#...', '......']);
  const c = S.sheetCellIsland(im, { x: 0, y: 0, w: 6, h: 4 }, 'magenta');
  assert.deepEqual([c.x, c.y, c.w, c.h, c.area], [2, 1, 2, 2, 3]);
  assert.equal(S.sheetCellIsland(im, { x: 4, y: 0, w: 2, h: 4 }, 'magenta'), null);
  const piece = S.sheetPiece(im, c);
  assert.deepEqual([...piece.data.filter((_, i) => i % 4 === 3)], [255, 255, 255, 0]);
  const t = S.sheetTrim(
    S.sheetPiece(im, {
      ...c,
      x: 1,
      y: 0,
      w: 4,
      h: 4,
      mask: S.sheetMask(S.sheetCrop(im, { x: 1, y: 0, w: 4, h: 4 }), 'magenta'),
    })
  );
  assert.deepEqual([t.width, t.height], [2, 2]);
});

test('names from a template; front and back matched by name, then by position', () => {
  assert.equal(S.sheetName('{animal}_{row}', { animal: 'Cat', row: 'head' }), 'cat_head');
  assert.equal(S.sheetName('{name}', { name: 'Left Arm.png' }), 'left_arm');
  assert.equal(S.sheetName('{n}', { n: 3 }), 'p3');
  const pairs = S.sheetMatchViews(
    [
      { id: 'a', cx: 0, cy: 0 },
      { id: 'b', cx: 10, cy: 0 },
      { id: 'c', cx: 20, cy: 0 },
    ],
    [
      { id: 'c', cx: 0, cy: 0 },
      { id: 'x', cx: 5, cy: 0 },
      { id: 'y', cx: 9, cy: 0 },
      { id: 'z', cx: 9, cy: 9 },
    ]
  );
  assert.deepEqual(
    pairs.map(p => [p.id, p.back && p.back.id, p.by]),
    [
      ['c', 'c', 'name'],
      ['a', 'x', 'position'],
      ['b', 'y', 'position'],
      ['z', 'z', 'none'],
    ]
  );
});

test('Aseprite JSON: slices first, else frames (hash or array)', () => {
  const frame = (x, y) => ({ frame: { x, y, w: 8, h: 9 } });
  assert.deepEqual(
    S.asepriteBoxes({ frames: { 'head.png': frame(0, 0), 'arm.aseprite': frame(8, 0) } }).map(b => [b.name, b.x]),
    [
      ['head', 0],
      ['arm', 8],
    ]
  );
  assert.deepEqual(S.asepriteBoxes({ frames: [{ filename: 'leg 0', ...frame(1, 2) }] })[0], {
    name: 'leg 0',
    x: 1,
    y: 2,
    w: 8,
    h: 9,
  });
  const sl = S.asepriteBoxes({
    frames: [frame(0, 0)],
    meta: { slices: [{ name: 'torso', keys: [{ frame: 0, bounds: { x: 3, y: 4, w: 5, h: 6 } }] }] },
  });
  assert.deepEqual(sl, [{ name: 'torso', x: 3, y: 4, w: 5, h: 6 }]);
});

// made by Pillow 12.3: Image.fromarray(A, 'RGBA').resize(size, Image.BOX), with half-clear pixels (premultiplied
// inside Pillow) and a size kept on one side (one pass only)
const A = [
  248, 194, 190, 0, 147, 26, 237, 128, 245, 211, 239, 128, 5, 157, 159, 128, 54, 236, 109, 37, 199, 82, 32, 37, 36, 7,
  134, 0, 57, 146, 8, 128, 14, 15, 22, 128, 144, 208, 24, 0, 7, 41, 11, 255, 59, 104, 225, 255, 226, 201, 8, 128, 26,
  27, 163, 255, 33, 41, 201, 128, 70, 166, 228, 128, 50, 179, 0, 0, 137, 63, 13, 255, 255, 64, 94, 37, 8, 156, 25, 37,
  157, 146, 190, 128, 219, 135, 39, 0, 237, 127, 72, 128, 168, 21, 73, 0, 16, 153, 140, 37, 80, 163, 61, 37, 47, 229,
  148, 255, 97, 110, 56, 37, 74, 193, 62, 37, 238, 239, 226, 255, 14, 205, 185, 37, 73, 238, 205, 255, 160, 110, 68, 0,
  79, 104, 193, 128, 88, 197, 234, 37, 148, 48, 7, 128, 149, 40, 126, 255, 40, 54, 59, 37, 13, 153, 135, 255, 59, 191,
  239, 255, 193, 154, 82, 0, 115, 167, 97, 0, 185, 210, 176, 128, 76, 177, 52, 37, 109, 94, 162, 255, 197, 5, 100, 128,
  50, 247, 166, 37, 250, 98, 97, 0, 103, 193, 8, 255, 61, 45, 71, 128, 29, 90, 164, 128, 9, 61, 205, 255, 231, 18, 163,
  255, 14, 192, 167, 0, 115, 81, 186, 128, 107, 123, 245, 37, 52, 123, 119, 0, 134, 193, 196, 37, 127, 86, 33, 0, 29,
  170, 251, 0, 39, 55, 11, 128, 161, 113, 206, 0, 94, 225, 238, 37,
];
test("Pillow's box filter, number for number", () => {
  const im = { width: 9, height: 7, data: Uint8ClampedArray.from(A) };
  assert.deepEqual(
    [...S.sheetBoxResize(im, 4, 3).data],
    [
      55, 37, 87, 96, 91, 122, 166, 156, 72, 99, 192, 74, 87, 73, 15, 128, 129, 73, 101, 73, 113, 192, 186, 146, 119,
      156, 176, 49, 91, 144, 124, 125, 138, 76, 156, 83, 94, 149, 43, 70, 21, 67, 147, 128, 213, 44, 172, 74,
    ]
  );
  assert.deepEqual(
    [...S.sheetBoxResize(im, 9, 2).data],
    [
      174, 80, 80, 19, 51, 58, 80, 114, 166, 173, 221, 192, 104, 185, 97, 73, 86, 137, 158, 169, 74, 49, 167, 41, 66,
      136, 202, 73, 70, 160, 60, 51, 87, 107, 58, 192, 153, 42, 135, 170, 68, 144, 158, 37, 12, 153, 135, 85, 84, 191,
      128, 182, 59, 47, 71, 43, 29, 88, 160, 43, 61, 97, 150, 170, 212, 39, 149, 97, 107, 110, 173, 97,
    ]
  );
});

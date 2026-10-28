// Water track WA-4: the tide's cells (game/js/walk/sea-tide.js), read from a sea scene's tiles
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tideCells, tideLevel } from '../../game/js/walk/sea-tide.js';

/* a map from rows of tile letters, the first row the south (j 0), every water tile the sea's kind */
const map = rows => {
  const h = rows.length,
    w = rows[0].length;
  return [w, h, (i, j) => rows[j][i], (i, j) => rows[j][i] === 'w' || rows[j][i] === 'd'];
};
const at = (R, w, i, j) => R[j * w + i];

test('wet sand joined to the sea is covered at high tide; wet sand cut off by dry land is not', () => {
  const [w, h, ter, sea] = map(['ddddddd', 'wwwwwww', 'SSSSSSS', 'sssssss', 'sSSsssS']);
  const T = tideCells(w, h, ter, sea);
  for (let i = 0; i < w; i++) assert.equal(at(T.cover, w, i, 2), 1);
  assert.equal(at(T.cover, w, 1, 4), 0);
  assert.equal(at(T.cover, w, 6, 4), 0);
  assert.equal(T.nCover, 7);
});

test('the open sea leaves its shallows beside land at low tide, not its deep water or the shallows out at sea', () => {
  const [w, h, ter, sea] = map(['ddddddd', 'ddwwwdd', 'wwwwwww', 'wwwwwww', 'sssssss']);
  const T = tideCells(w, h, ter, sea);
  for (let i = 0; i < w; i++) assert.equal(at(T.dry, w, i, 3), 1, 'the row beside the sand');
  for (let i = 0; i < w; i++) assert.equal(at(T.dry, w, i, 2), 0, 'a row further out');
  assert.equal(at(T.dry, w, 3, 1), 0);
  assert.equal(T.nPool, 0);
});

test('sea water that joins neither the edge nor deep water is a tide pool, kept at low tide', () => {
  const [w, h, ter, sea] = map(['ddddddddd', 'wwwwwwwww', 'SSSSSSSSS', 'SSwSSSwwS', 'SSSSSSSSS', 'sssssssss']);
  const T = tideCells(w, h, ter, sea);
  assert.equal(T.nPool, 3);
  assert.equal(at(T.pool, w, 2, 3), 1);
  assert.equal(at(T.dry, w, 2, 3), 0, 'a pool never dries');
  assert.equal(at(T.dry, w, 6, 3), 0);
  /* the sand round the pools joins the sea: the high tide covers it all */
  assert.equal(T.nCover, 9 * 3 - 3);
});

test('a sandbar out in the sea is covered at high tide', () => {
  const [w, h, ter, sea] = map(['ddddddd', 'ddSSSdd', 'ddddddd', 'wwwwwww', 'sssssss']);
  const T = tideCells(w, h, ter, sea);
  assert.equal(T.nCover, 3);
  assert.equal(at(T.cover, w, 3, 1), 1);
});

test('water that is not the sea has no tide', () => {
  const rows = ['wwwww', 'wSSSw', 'wwwww'],
    w = 5,
    h = 3;
  const T = tideCells(
    w,
    h,
    (i, j) => rows[j][i],
    () => false
  );
  assert.equal(T.nCover + T.nDry + T.nPool, 0);
});

test('two high tides a day at the same hours every day, low between, never a jump at midnight', () => {
  const highs = [];
  for (let k = 0; k < 24 * 60; k++) {
    const h = k / 60,
      a = tideLevel(h - 1 / 60),
      b = tideLevel(h),
      c = tideLevel(h + 1 / 60);
    if (b > a && b >= c) highs.push(h);
  }
  assert.equal(highs.length, 2);
  assert.ok(Math.abs(tideLevel(0) - tideLevel(24)) < 1e-9);
  for (let h = 0; h < 24; h += 0.25) assert.ok(tideLevel(h) >= -1 && tideLevel(h) <= 1);
  assert.ok(Math.min(...[0, 3, 6, 9, 12, 15, 18, 21].map(tideLevel)) < -0.99, 'it goes all the way out');
});

test('a river running into the sea is never the sea: the tide neither dries it nor covers its sandy banks', () => {
  /* a river (column 3) runs down from the north into the open sea through the beach; wet sand lines its banks
     upstream, joined to the sea only through the river */
  const rows = ['ddddddd', 'wwwwwww', 'SSSwSSS', 'sssw sss'.replace(' ', ''), 'sSSwSSs', 'ssSwSss'];
  const [w, h, ter, sea] = map(rows);
  const run = (i, j) => i === 3 && j >= 2;
  const T = tideCells(w, h, ter, sea, run);
  for (let j = 2; j < h; j++) assert.equal(at(T.dry, w, 3, j), 0, `the river at row ${j} keeps its water`);
  for (let j = 4; j < h; j++)
    for (let i = 0; i < w; i++) assert.equal(at(T.cover, w, i, j), 0, `the bank at ${i}, ${j} stays above the tide`);
  /* the shore's own sand, joined to the sea, still floods */
  assert.equal(at(T.cover, w, 0, 2), 1);
  /* without the river rule, the river was the sea's: its bed dried and its banks flooded */
  const old = tideCells(w, h, ter, sea);
  assert.equal(at(old.dry, w, 3, 4), 1);
  assert.equal(at(old.cover, w, 2, 4), 1);
});

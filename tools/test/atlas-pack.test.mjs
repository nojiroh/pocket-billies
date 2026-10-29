// Characters track CH-4: the figures' atlas's cells (game/js/logic/atlas-pack.js): no two cells overlap or touch, a
// freed cell's room is taken again, and a full atlas says so
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ATLAS_SHELF_STEP,
  atlasPackAdd,
  atlasPackFree,
  atlasPackNew,
  atlasPackUse,
} from '../../game/js/logic/atlas-pack.js';

/* no cell overlaps another's room (its pixels and its pad), and every cell is inside the atlas */
function apart(P, cells) {
  for (const c of cells) {
    assert.ok(c.x >= 0 && c.y >= 0 && c.x + c.w + P.pad <= P.w && c.y + c.h + P.pad <= P.h, 'inside');
    for (const d of cells)
      if (c !== d)
        assert.ok(
          c.x + c.w + P.pad <= d.x || d.x + d.w + P.pad <= c.x || c.y + c.h + P.pad <= d.y || d.y + d.h + P.pad <= c.y,
          `${JSON.stringify([c.x, c.y, c.w, c.h])} and ${JSON.stringify([d.x, d.y, d.w, d.h])}`
        );
  }
}

test('atlas cells: figures of several sizes fit apart, shelves by height', () => {
  /* a phone's atlas; figures at 24 to 48 px a metre are about 30-70 px wide and 50-120 tall */
  const P = atlasPackNew(2048, 1024),
    cells = [];
  let s = 7;
  for (let i = 0; i < 120; i++) {
    s = (s * 48271) % 2147483647;
    const c = atlasPackAdd(P, 30 + (s % 41), 50 + ((s >> 8) % 71));
    assert.ok(c, `cell ${i}`);
    cells.push(c);
  }
  apart(P, cells);
  for (const S of P.shelves) assert.equal(S.h % ATLAS_SHELF_STEP, 0);
  assert.equal(P.cells, 120);
  assert.ok(atlasPackUse(P) <= 1);
});

test('atlas cells: a freed cell is taken again, joined spans fit a wider one, the top shelf goes when empty', () => {
  const P = atlasPackNew(100, 64),
    a = atlasPackAdd(P, 30, 20),
    b = atlasPackAdd(P, 30, 20),
    c = atlasPackAdd(P, 30, 20);
  assert.deepEqual([a.x, b.x, c.x], [0, 31, 62]);
  assert.equal(atlasPackAdd(P, 30, 20).shelf === a.shelf, false, 'a full shelf: a new one');
  atlasPackFree(P, a);
  atlasPackFree(P, b);
  const w = atlasPackAdd(P, 60, 18);
  assert.equal(w.x, 0, 'the two freed spans joined');
  assert.equal(w.shelf, a.shelf);
  /* the top shelf, emptied, goes; the room above is whole again */
  const top = P.shelves[P.shelves.length - 1],
    t = top.y;
  atlasPackFree(P, { x: 0, y: t, w: 30, h: 20, shelf: top });
  assert.equal(P.top, t);
});

test('atlas cells: a full atlas says so; one too big never fits', () => {
  const P = atlasPackNew(64, 64);
  assert.equal(atlasPackAdd(P, 64, 10), null, 'wider than the atlas with its pad');
  let n = 0;
  while (atlasPackAdd(P, 20, 20)) n++;
  assert.equal(n, 6, 'three a shelf, two shelves of 24');
  assert.equal(atlasPackAdd(P, 20, 20), null);
});

// Studio art track SA-2b: the icon atlas's rectangles (game/js/logic/atlas-rects.js): art/manifest.js read and written
// back as it is, the problems a sheet can have, a free spot, a rename keeping the order, and what in the data names a key.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT, GAME_DATA, modules } from './setup-real.mjs';

const A = modules['atlas-rects'];
const TEXT = readFileSync(join(ROOT, 'game/art/manifest.js'), 'utf8');
/* the sheet's size from its PNG header */
const png = readFileSync(join(ROOT, 'game/art/icons/icons.png')),
  W = png.readUInt32BE(16),
  H = png.readUInt32BE(20);

test('art/manifest.js reads and writes back to the same text', () => {
  const man = A.manifestParse(TEXT);
  assert.equal(A.manifestText(man), TEXT);
  assert.ok(Object.keys(man.icons).length > 100);
  assert.throws(() => A.manifestParse('window.X={}'));
  assert.throws(() => A.manifestParse('window.ARTMAN={"battle":{}};'));
});

test('the committed rectangles all sit on the sheet, apart', () => {
  assert.deepEqual(A.atlasProblems(A.manifestParse(TEXT).icons, W, H), []);
});

test('problems: off the sheet, no size, not whole numbers, overlaps', () => {
  const P = A.atlasProblems(
    { a: [0, 0, 4, 4], b: [2, 2, 4, 4], c: [30, 0, 4, 4], d: [0, 10, 0, 3], e: [0, 20, 1.5, 2] },
    32,
    32
  );
  assert.deepEqual(
    P.map(p => p.key + ' ' + p.msg),
    ['c leaves the 32×32 sheet', 'd has no size', 'e is not four whole numbers', 'b overlaps a']
  );
});

test('a free spot keeps a pixel from the others; none when the sheet is full', () => {
  assert.deepEqual(A.atlasFreeSpot({ a: [0, 0, 10, 10] }, 32, 32, 4, 4), [11, 1]);
  assert.equal(A.atlasFreeSpot({ a: [0, 0, 32, 32] }, 32, 32, 4, 4), null);
  const icons = A.manifestParse(TEXT).icons,
    at = A.atlasFreeSpot(icons, W, H, 8, 8);
  assert.ok(at);
  assert.deepEqual(A.atlasProblems({ ...icons, n: [at[0], at[1], 8, 8] }, W, H), []);
});

test('a rename keeps the order; the data’s item icons and type particles follow', () => {
  assert.deepEqual(Object.keys(A.atlasRename({ a: [0, 0, 1, 1], b: [2, 0, 1, 1], c: [4, 0, 1, 1] }, 'b', 'z')), [
    'a',
    'z',
    'c',
  ]);
  const D = structuredClone({ items: GAME_DATA.items, types: GAME_DATA.types }),
    icons = A.manifestParse(TEXT).icons,
    item = Object.keys(D.items).find(k => !D.items[k].img && icons['i_' + (D.items[k].icon || k)]),
    key = 'i_' + (D.items[item].icon || item),
    type = D.types.find(t => (t.fx || []).length);
  assert.ok(item && type);
  const users = A.atlasUses(key, D);
  assert.ok(users.some(u => u.at === 'items/' + item && u.kind === 'item icon'));
  assert.equal(A.atlasRenameData(D, key, 'plain'), -1);
  assert.equal(A.atlasRenameData(D, key, 'i_renamed'), users.length);
  assert.equal(D.items[item].icon, 'renamed');
  assert.deepEqual(A.atlasUses(key, D), []);
  const fx = type.fx[0],
    n = A.atlasUses(fx, D).length;
  assert.ok(n >= 1);
  assert.equal(A.atlasRenameData(D, fx, 'fx_renamed'), n);
  assert.ok(D.types.find(t => t.id === type.id).fx.includes('fx_renamed'));
  assert.ok(A.atlasKeyOk('i_potion') && !A.atlasKeyOk('a-b') && !A.atlasKeyOk('1a'));
});

test('PK-11: an item with its own picture uses no atlas key, its icon or not', () => {
  const D = { items: { a: { icon: 'x' }, b: { icon: 'x', img: 'items/b.svg' }, c: { img: 'items/c.svg' } } };
  assert.deepEqual(
    A.atlasUses('i_x', D).map(u => u.at),
    ['items/a']
  );
  assert.deepEqual(A.atlasUses('i_c', D), []);
});

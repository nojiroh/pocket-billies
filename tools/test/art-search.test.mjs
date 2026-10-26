// Studio art track SA-1: the Art browser's search and folders (game/js/logic/art-search.js): the tokens and their
// chips, what a query keeps, the folders from the file list, a PNG's size from its header.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { modules, ROOT } from './setup-real.mjs';

const S = modules['art-search'];
const PATHS = [
  'art/app/icon.png',
  'art/scene/props/house.png',
  'art/scene/props/layers/house_roof.png',
  'art/scene/tiles/grass.png',
  'art/next/tiles47/grass_0.png',
  'art/ui/bag.svg',
];

test('words: every word is in the path, any case', () => {
  const Q = S.artQueryParse('  House  PROPS ');
  assert.deepEqual(Q.words, ['house', 'props']);
  assert.deepEqual(Q.chips, []);
  assert.deepEqual(
    PATHS.filter(p => S.artMatch(p, {}, Q) === true),
    ['art/scene/props/house.png', 'art/scene/props/layers/house_roof.png']
  );
});

test('dir: a folder path or any part of one, with or without art/ and slashes', () => {
  const keep = q => PATHS.filter(p => S.artMatch(p, {}, S.artQueryParse(q)) === true);
  assert.deepEqual(keep('dir:scene/props'), ['art/scene/props/house.png', 'art/scene/props/layers/house_roof.png']);
  assert.deepEqual(keep('dir:/art/scene/props/'), keep('dir:scene/props'));
  assert.deepEqual(keep('dir:layers'), ['art/scene/props/layers/house_roof.png']);
  assert.deepEqual(keep('dir:tiles'), ['art/scene/tiles/grass.png']);
  assert.deepEqual(keep('dir:tile'), [], 'a folder name is whole');
  assert.deepEqual(keep('dir:scene dir:tiles'), ['art/scene/tiles/grass.png'], 'two dirs: both');
  assert.deepEqual(S.artQueryParse('dir:').words, ['dir:'], 'nothing after the colon: a word');
});

test('w: and h: rules: equal, more, at most, from-to; not a number is a word', () => {
  const r = s => S.sizeRuleParse(s);
  assert.deepEqual(r('32'), { op: '=', a: 32 });
  assert.deepEqual(r('>32'), { op: '>', a: 32 });
  assert.deepEqual(r('<=64'), { op: '<=', a: 64 });
  assert.deepEqual(r('64-16'), { op: '-', a: 16, b: 64 });
  assert.equal(r('big'), null);
  const T = (s, v) => S.sizeRuleTest(r(s), v);
  assert.deepEqual(
    [T('32', 32), T('32', 33), T('>32', 33), T('>32', 32), T('>=32', 32)],
    [true, false, true, false, true]
  );
  assert.deepEqual(
    [T('<16', 15), T('<16', 16), T('<=16', 16), T('16-64', 16), T('16-64', 64), T('16-64', 65)],
    [true, false, true, true, true, false]
  );
  const Q = S.artQueryParse('w:16-64 h:>8 w:big');
  assert.deepEqual(Q.words, ['w:big']);
  assert.deepEqual(
    Q.chips.map(c => c.text),
    ['Width 16–64', 'Height >8']
  );
});

test('a size rule on a picture of unknown size asks for its size', () => {
  const Q = S.artQueryParse('w:32');
  assert.equal(S.artQueryNeedsSize(Q), true);
  assert.equal(S.artQueryNeedsSize(S.artQueryParse('house')), false);
  assert.equal(S.artMatch('art/a.png', undefined, Q), 'size');
  assert.equal(S.artMatch('art/a.png', { w: 32 }, Q), 'size');
  assert.equal(S.artMatch('art/a.png', { w: 32, h: 8 }, Q), true);
  assert.equal(S.artMatch('art/a.png', { w: 16, h: 8 }, Q), false);
  assert.equal(S.artMatch('art/b.png', { w: 32, h: 8 }, S.artQueryParse('zz w:32')), false, 'words first');
});

test('unused and legacy read the reference state', () => {
  const U = S.artQueryParse('unused'),
    L = S.artQueryParse('LEGACY');
  assert.deepEqual([U.unused, L.legacy], [true, true]);
  assert.equal(S.artMatch('art/a.png', { state: 'unused' }, U), true);
  assert.equal(S.artMatch('art/a.png', { state: 'used' }, U), false);
  assert.equal(S.artMatch('art/a.png', undefined, U), false, 'no index yet: nothing is called unused');
  assert.equal(S.artMatch('art/a.png', { state: 'legacy' }, L), true);
  assert.equal(S.artMatch('art/a.png', { state: 'unused' }, L), false);
});

test('a chip comes off the text it was made from; an empty query keeps the folder view', () => {
  const q = 'house dir:scene w:>8 unused',
    Q = S.artQueryParse(q);
  assert.deepEqual(
    Q.chips.map(c => c.key),
    ['dir', 'w', 'unused']
  );
  assert.equal(S.artQueryWithout(q, Q.chips[1]), 'house dir:scene unused');
  assert.equal(S.artQueryEmpty(S.artQueryParse('  ')), true);
  assert.equal(S.artQueryEmpty(Q), false);
});

test('folders: from the paths, with counts all the way down, breadcrumbs, the folder’s own files', () => {
  const top = S.artFolderView(PATHS, '');
  assert.deepEqual(top.crumbs, [{ name: 'art', at: '' }]);
  assert.deepEqual(
    top.folders.map(f => [f.name, f.count]),
    [
      ['app', 1],
      ['next', 1],
      ['scene', 3],
      ['ui', 1],
    ]
  );
  assert.deepEqual(top.files, []);
  const props = S.artFolderView(PATHS, '/scene/props/');
  assert.equal(props.at, 'scene/props');
  assert.deepEqual(props.crumbs, [
    { name: 'art', at: '' },
    { name: 'scene', at: 'scene' },
    { name: 'props', at: 'scene/props' },
  ]);
  assert.deepEqual(props.folders, [{ name: 'layers', at: 'scene/props/layers', count: 1 }]);
  assert.deepEqual(props.files, ['art/scene/props/house.png']);
  assert.deepEqual(S.artFolderView(PATHS, 'scene/prop').folders, [], 'no partial folder names');
  assert.equal(S.artFolderOf('art/scene/props/house.png'), 'scene/props');
  assert.equal(S.artFolderOf('art/x.png'), '');
});

test('pictures only: png, webp, jpg and svg', () => {
  assert.deepEqual(['a.png', 'a.PNG', 'a.webp', 'a.svg', 'a.jpg', 'a.json', 'a.js'].map(S.isArtPicture), [
    true,
    true,
    true,
    true,
    true,
    false,
    false,
  ]);
});

test('pngSize reads a real PNG’s header; anything else is null', () => {
  const b = new Uint8Array(readFileSync(join(ROOT, 'game/art/app/icon-192.png')).subarray(0, 33));
  assert.deepEqual(S.pngSize(b), { w: 192, h: 192 });
  assert.equal(S.pngSize(b.subarray(0, 20)), null);
  assert.equal(S.pngSize(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
});

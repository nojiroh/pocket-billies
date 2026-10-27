// Studio art track SA-1: the Art browser's reference index (game/js/logic/art-refs.js): art paths found anywhere in the
// data, the code's patterns, legacy-only references, and the index on the game's own data and code.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { artCodeRefs, artCodeRefsText, artRecipeRefs, OUT } from '../art-code-refs.mjs';
import { GAME_DATA, modules, ROOT } from './setup-real.mjs';

const R = modules['art-refs'];
const PATHS = [
  'art/scene/props/house.png',
  'art/scene/flags/copperleaf.png',
  'art/scene/flags/marigold.png',
  'art/scene/flags/default.png',
  'art/postcards/marigold.webp',
  'art/robots/arm.png',
  'art/people/old.png',
];

test('artPathOf: with or without art/, ../game/ and a query; a path with no file is nothing', () => {
  const K = new Set(PATHS);
  assert.equal(R.artPathOf('scene/props/house.png', K), 'art/scene/props/house.png');
  assert.equal(R.artPathOf('art/scene/props/house.png?v=3', K), 'art/scene/props/house.png');
  assert.equal(R.artPathOf('../game/art/robots/arm.png', K), 'art/robots/arm.png');
  assert.equal(R.artPathOf('robots/arm', K), 'art/robots/arm.png', 'no extension: the PNG');
  assert.equal(R.artPathOf('robots/leg.png', K), '');
  assert.equal(R.artPathOf('house', K), '', 'a bare name is no path');
  assert.equal(R.artPathOf(/** @type {any} */ (3), K), '');
});

test('artPathsInData: any depth, arrays and objects, with the keys to it', () => {
  const K = new Set(PATHS);
  assert.deepEqual(
    R.artPathsInData(
      { props: { house: { img: 'scene/props/house.png', n: 'Cottage' } }, parts: [{}, { pic: 'robots/arm.png' }] },
      K
    ),
    [
      ['art/scene/props/house.png', 'props/house/img'],
      ['art/robots/arm.png', 'parts/1/pic'],
    ]
  );
});

test('a code pattern: * is one name, never a slash, and hands the names back', () => {
  const t = R.artPatternTest('scene/flags/*.png');
  assert.deepEqual(t('scene/flags/marigold.png'), ['marigold']);
  assert.equal(t('scene/flags/old/marigold.png'), null);
  assert.equal(t('scene/flagsXmarigold.png'), null, 'the dot is a dot');
  assert.deepEqual(R.artPatternTest('postcards/*')('postcards/marigold.webp'), ['marigold.webp']);
});

test('the index: data and code; a name only legacy places have makes a code reference legacy', () => {
  const ix = R.artRefIndex(PATHS, {
    data: [
      { from: 'scenery', value: { props: { house: { img: 'scene/props/house.png' } } } },
      { from: 'legacy robots', value: { arm: 'robots/arm.png' }, legacy: true },
    ],
    code: [
      { p: 'scene/flags/*.png', at: ['game/js/walk-view.js:493'] },
      { p: 'postcards/*', at: ['game/js/postcards.js:45'] },
    ],
    ids: { live: ['copperleaf'], legacy: ['marigold', 'copperleaf'] },
  });
  const state = p => R.artRefState(ix.get(p));
  assert.deepEqual(ix.get('art/scene/props/house.png'), [
    { kind: 'data', from: 'scenery', at: 'props/house/img', legacy: false },
  ]);
  assert.equal(state('art/scene/props/house.png'), 'used');
  assert.equal(state('art/scene/flags/copperleaf.png'), 'used', 'live and legacy: live wins');
  assert.equal(state('art/scene/flags/marigold.png'), 'legacy');
  assert.equal(state('art/postcards/marigold.webp'), 'legacy', 'the extension is not part of the name');
  assert.equal(state('art/scene/flags/default.png'), 'used', 'a name no place has: the code may still use it');
  assert.equal(state('art/robots/arm.png'), 'legacy');
  assert.equal(state('art/people/old.png'), 'unused');
  assert.equal(R.artRefState([]), 'unused');
});

test('a recipe names a file: one reference per recipe file', () => {
  const ix = R.artRefIndex(PATHS, {
    recipes: [
      { p: 'robots/arm.png', at: ['game/art/scene/next/models/a.json', 'game/art/scene/vox/b.json'] },
      { p: 'gone.png', at: ['x.json'] },
    ],
  });
  assert.deepEqual(
    ix.get('art/robots/arm.png').map(r => [r.kind, r.from]),
    [
      ['recipe', 'game/art/scene/next/models/a.json'],
      ['recipe', 'game/art/scene/vox/b.json'],
    ]
  );
  assert.equal(ix.size, 1);
});

test('extra references count; one for a file not in the list is dropped', () => {
  const ref = { kind: 'rig', from: 'rigs', at: 'musk0', legacy: false };
  const ix = R.artRefIndex(PATHS, {
    extra: [
      { path: 'art/people/old.png', ref },
      { path: 'art/nope.png', ref },
    ],
  });
  assert.equal(R.artRefState(ix.get('art/people/old.png')), 'used');
  assert.equal(ix.has('art/nope.png'), false);
});

test('studio/art-code-refs.json is what tools/art-code-refs.mjs makes from the code now', () => {
  assert.equal(readFileSync(join(ROOT, OUT), 'utf8'), artCodeRefsText());
});

test('on the game: the code’s patterns and the data name most of the art; known cases come out right', () => {
  const art = join(ROOT, 'game/art'),
    walk = d =>
      readdirSync(d, { withFileTypes: true }).flatMap(e =>
        e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]
      );
  const paths = walk(art)
    .map(f => 'art/' + relative(art, f).split('\\').join('/'))
    .filter(p => /\.(png|webp|jpg|svg)$/.test(p));
  const legacyIx = JSON.parse(readFileSync(join(ROOT, 'game/data/legacy/index.json'), 'utf8'));
  const ix = R.artRefIndex(paths, {
    data: Object.entries(GAME_DATA).map(([from, value]) => ({ from, value })),
    code: artCodeRefs(),
    recipes: artRecipeRefs(),
    ids: { live: Object.keys(GAME_DATA.maps || {}), legacy: legacyIx.split.maps.ids },
  });
  const state = p => R.artRefState(ix.get(p));
  const prop = Object.values(GAME_DATA.scenery.props).find(p => p.img).img;
  assert.equal(state('art/' + prop), 'used', prop);
  assert.equal(state('art/postcards/copperleaf.webp'), 'used');
  assert.equal(state('art/postcards/marigold.webp'), 'legacy');
  assert.equal(state('art/app/icon-512.png'), 'used', 'the web manifest names it');
  assert.equal(state('art/scene/next/decals/bakery_word.png'), 'used', 'the bakery recipe names it');
  assert.equal(state('art/ui/bag.svg') === 'unused', !paths.includes('art/ui/bag.svg'));
  for (const p of paths.filter(p => p.startsWith('art/people/'))) assert.equal(state(p), 'unused', p);
  const used = paths.filter(p => state(p) !== 'unused').length;
  assert.ok(used > paths.length / 2, `${used} of ${paths.length} named`);
});

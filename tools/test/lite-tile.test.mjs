// Studio art track SA-2a: the 16 px Lite tiles made from the 32 px ground (game/js/logic/lite-tile.js), with the
// game's own soft patches (walk-view.js groundToneAt, applyGroundTone). tools/build-terrain-v47.py made the committed
// ones; the Studio makes them now, so every kind's six must come out as they are on disk.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import './walk-renderer.mjs';
import { readPng } from './png.mjs';
import { GAME_DATA, modules, ROOT } from './setup-real.mjs';

const L = modules['lite-tile'];
const W = await import('../../game/js/walk-view.js');
const TONE = { toneAt: W.groundToneAt, applyTone: W.applyGroundTone };
const art = (/** @type {string} */ p) => join(ROOT, 'game', 'art', p);
const SC = GAME_DATA.scenery;
const KINDS = [...new Map(Object.values(SC.terrains).map(t => [t.tile, t])).values()].filter(t =>
  existsSync(art(W.bigTilePaths(t.tile, SC.tileSet)[0]))
);

test('the plan: the base from tile 1, the five variants from tiles 2-6, paths from the catalogue', () => {
  const t = { tile: 'scene/tiles/grass.png', vars: [1, 2, 3, 4, 5].map(k => `scene/tiles/grass_${k}.png`) },
    big = W.bigTilePaths(t.tile, 'tiles47');
  assert.deepEqual(
    L.liteTilePlan(t, big).map(p => [p.from, p.to, p.k]),
    [
      ['next/tiles47/grass_1.png', 'scene/tiles/grass.png', 0],
      ['next/tiles47/grass_2.png', 'scene/tiles/grass_1.png', 1],
      ['next/tiles47/grass_3.png', 'scene/tiles/grass_2.png', 2],
      ['next/tiles47/grass_4.png', 'scene/tiles/grass_3.png', 3],
      ['next/tiles47/grass_5.png', 'scene/tiles/grass_4.png', 4],
      ['next/tiles47/grass_6.png', 'scene/tiles/grass_5.png', 5],
    ]
  );
  assert.equal(L.liteTileOf(t, big, 7), null);
  assert.equal(L.liteTileOf(t, big, 3).to, 'scene/tiles/grass_2.png');
});

test('the tone: the catalogue`s, else none on paving and full elsewhere', () => {
  assert.equal(L.liteToneK({ tone: 0.6 }), 0.6);
  assert.equal(L.liteToneK({ paved: true }), 0);
  assert.equal(L.liteToneK({}), 1);
  assert.equal(L.liteToneK(null), 0);
});

/* the kinds tools/build-terrain-v47.py added (its NEW47): their Lite tiles were made from the 32 px ones. The older
   kinds' Lite tiles are the v46 16 px tiles, drawn apart from the 32 px set (the builder never wrote over them) */
const MADE =
  'brickfloor carpetblue carpetred cloudfloor concrete coralsand corktiles dryearth duckboards emberash epoxy goldrock goldterrazzo granite herringbone hextiles labfloor linoleum marblecheck mushroommat neontiles oakboards paintedboards parquet pineboards pineneedles rubber salt seaweedrock skystone slateflags strawfloor sunburnt sunstone teakdeck tidepool tilesgreen tilesterra vinylcheck wildflowers'.split(
    ' '
  );

test(`the Lite tiles of every kind the builder made come out as the committed ones (${MADE.length} kinds)`, () => {
  const made = KINDS.filter(t => MADE.includes(L.liteKindName(t.tile)));
  assert.equal(made.length, MADE.length);
  let worst = 0,
    where = '',
    n = 0;
  for (const t of made)
    for (const p of L.liteTilePlan(t, W.bigTilePaths(t.tile, SC.tileSet))) {
      const got = L.liteTile(readPng(art(p.from)), p.k, L.liteToneK(t), TONE),
        want = readPng(art(p.to));
      assert.equal(got.width, want.width, p.to);
      assert.equal(got.height, want.height, p.to);
      const d = L.liteDiff(got, want);
      if (d > worst) [worst, where] = [d, p.to];
      n++;
    }
  assert.equal(n, MADE.length * 6);
  assert.ok(worst <= L.LITE_SAME, `${n} tiles; the worst channel is ${worst} off, in ${where}`);
});

test('a kind drawn by hand at 16 px is told apart from a made one', () => {
  const kindOf = (/** @type {string} */ name) => KINDS.find(t => L.liteKindName(t.tile) === name),
    made = (/** @type {any} */ t) => {
      const p = L.liteTilePlan(t, W.bigTilePaths(t.tile, SC.tileSet))[0];
      return L.liteDiff(L.liteTile(readPng(art(p.from)), 0, L.liteToneK(t), TONE), readPng(art(p.to))) <= L.LITE_SAME;
    };
  assert.equal(made(kindOf('granite')), true);
  assert.equal(made(kindOf('grass')), false);
});

test('the same tiles twice are found', () => {
  const a = { width: 1, height: 1, data: new Uint8Array([1, 2, 3, 255]) },
    b = { width: 1, height: 1, data: new Uint8Array([9, 2, 3, 255]) };
  assert.deepEqual(L.sameTiles([a, b, a, null, b]), [
    [1, 3],
    [2, 5],
  ]);
});

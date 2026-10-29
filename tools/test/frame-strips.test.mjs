// Studio art track SA-2a: which pictures are frame strips (game/js/logic/frame-strips.js): the walk effects from
// walk-view.js EFFECT_FRAMES, the animals and cars from the data's scenery.life, each against its picture's real size.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import './walk-renderer.mjs';
import { GAME_DATA, modules, ROOT } from './setup-real.mjs';

const S = modules['frame-strips'],
  A = modules['art-search'];
const W = await import('../../game/js/walk-view.js');
const TABLES = { effects: W.EFFECT_FRAMES, life: GAME_DATA.scenery.life };
const sizeOf = (/** @type {string} */ p) => A.pngSize(readFileSync(join(ROOT, 'game', 'art', p)));

test('the walk effects are strips, read from the code`s table', () => {
  const s = S.stripOf('art/scene/fx/bee.png', TABLES);
  assert.deepEqual(s, { w: 5, h: 4, n: 2, from: 'effects' });
  assert.equal(S.stripOf('scene/fx/nothing.png', TABLES), null);
  assert.equal(S.stripOf('scene/props/house.png', TABLES), null);
});

test('the animals and cars are strips, read from the data, with their names', () => {
  const s = S.stripOf('scene/life/duck.png', TABLES);
  assert.equal(s.from, 'life');
  assert.equal(s.n, GAME_DATA.scenery.life.duck.frames);
  assert.equal(s.name, 'Duck');
});

test('every effect and every animal fits its picture', () => {
  const paths = [
    ...Object.keys(W.EFFECT_FRAMES).map(k => `scene/fx/${k}.png`),
    ...Object.values(GAME_DATA.scenery.life).map(r => r.img),
  ];
  let n = 0;
  for (const p of paths) {
    const s = S.stripOf(p, TABLES);
    assert.ok(s, p);
    assert.equal(S.stripProblem(s, sizeOf(p)), '', p);
    n++;
  }
  assert.ok(n >= 25, `${n} strips`);
});

test('the frame at a time, and a strip that doesn`t fit', () => {
  assert.equal(S.stripFrameAt(0, 8, 4), 0);
  assert.equal(S.stripFrameAt(0.13, 8, 4), 1);
  assert.equal(S.stripFrameAt(0.5, 8, 4), 0);
  assert.equal(S.stripFrameAt(1, 8, 1), 0);
  assert.match(S.stripProblem({ w: 5, h: 4, n: 2, from: 'effects' }, { w: 12, h: 4 }), /12 px wide/);
  assert.match(S.stripProblem({ w: 5, h: 4, n: 2, from: 'effects' }, { w: 10, h: 5 }), /4 px high/);
});

test('VFX-10: the battle effect strips are strips, read from battleAnims.json sprites, and fit their pictures', () => {
  const T = { ...TABLES, anims: GAME_DATA.battleAnims.sprites };
  assert.deepEqual(S.stripOf('art/battle/anims/burst.png', T), {
    w: 16,
    h: 16,
    n: GAME_DATA.battleAnims.sprites.burst.frames,
    from: 'battleAnims',
    name: 'burst',
    fps: 12,
  });
  assert.equal(S.stripOf('battle/anims/scar_dent.png', T), null, 'a one-frame mark on the ground is no strip');
  for (const [id, sp] of Object.entries(GAME_DATA.battleAnims.sprites)) {
    const s = S.stripOf(`battle/anims/${id}.png`, T);
    if (s) assert.equal(S.stripProblem(s, sizeOf(`battle/anims/${id}.png`)), '', id);
    else assert.equal(sp.frames, 1, id);
  }
  assert.equal(A.artMadeBy('art/battle/anims/spark.png'), 'tools/build-battle-anims.py');
});

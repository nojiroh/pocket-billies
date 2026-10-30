// Buildings track BD-3: the look sketches (tools/build-look-sketches.py): one house body and the shop, each in three
// directions A, B, C. Each builds, stays under the house kit's budget (6,000 triangles, the owner's answer), and the
// directions grow in detail and wonk from A to C; the test kind's variants name all six.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

await import('./walk-renderer.mjs');
const { lowPolyFromRecipe } = await import('../../game/js/prop-models.js');
const DIR = new URL('../../game/art/scene/next/models/', import.meta.url);
const read = n => JSON.parse(fs.readFileSync(new URL(`${n}.json`, DIR), 'utf8'));
const lean = r => Math.hypot(...((r.warp && r.warp.lean) || [0, 0]));

for (const body of ['house', 'shop'])
  test(`the ${body} sketches build, under 6,000 triangles, and grow from A to C`, () => {
    const R = ['a', 'b', 'c'].map(v => read(`look_${body}_${v}`)),
      M = R.map(r => lowPolyFromRecipe(r));
    for (const m of M) assert.ok(m.tris > 0 && m.tris <= 6000, `${m.tris} triangles`);
    assert.ok(M[0].tris < M[1].tris && M[1].tris < M[2].tris, 'more detail from A to C');
    assert.ok(lean(R[0]) <= lean(R[1]) && lean(R[1]) <= lean(R[2]), 'more lean from A to C');
  });

test('the look_sketch kind names all six sketches', () => {
  const S = JSON.parse(fs.readFileSync(new URL('../../game/data/scenery.json', import.meta.url), 'utf8'));
  const K = S.props.look_sketch,
    models = [K.model, ...K.variants.map(v => v.model)];
  assert.deepEqual(
    models,
    ['house', 'shop'].flatMap(b => ['a', 'b', 'c'].map(v => `scene/next/models/look_${b}_${v}.json`))
  );
});

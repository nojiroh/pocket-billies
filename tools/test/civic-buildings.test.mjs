// Buildings track BD-5: Copperleaf's civic buildings (tools/build-civic.py): the shop, the inn, the library and the
// lab, on BD-3's look B with look C's showpieces (the owner's pick). Each builds under the house budget (6,000
// triangles), keeps its old footprint and door (BD-7 has nothing to move for them), has its signature parts, numbered
// window glass and night glows, lettering as front-facing decals, a lean of at most 1.5 degrees (tidy civic
// buildings), and a picture baked from its model.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

await import('./walk-renderer.mjs');
const { lowPolyFromRecipe } = await import('../../game/js/logic/low-poly.js');
const ART = new URL('../../game/art/', import.meta.url);
const S = JSON.parse(fs.readFileSync(new URL('../../game/data/scenery.json', import.meta.url), 'utf8'));

const CIVIC = {
  shop: {
    box: [3.8, 2.4],
    door: 32,
    parts: [
      'round corner',
      'speed line',
      'striped awning',
      'starburst',
      'leaf emblem',
      'Googie canopy',
      'string light',
    ],
  },
  inn: {
    box: [5.6, 3.4],
    door: 0,
    parts: ['first floor', 'top floor', 'teacup', 'balcony rail', 'orbit ring', 'string light', 'blossom crown'],
  },
  library: {
    box: [5.4, 3.4],
    door: 0,
    parts: ['rotunda', 'drawer', 'book', 'clock face', 'ivy', 'glowing tube'],
  },
  lab: {
    box: [6, 3],
    door: 66,
    parts: [
      'observatory dome',
      'dome slit',
      'telescope',
      'radio dish',
      'copper tower',
      'glowing ring',
      "Kappi's bench",
      'rocket chimney',
    ],
  },
};

for (const [key, want] of Object.entries(CIVIC))
  test(`the ${key}: under 6,000 triangles, its old footprint and door, its parts, glass, glows and lettering`, () => {
    const P = S.props[key],
      R = JSON.parse(fs.readFileSync(new URL(P.model, ART), 'utf8')),
      M = lowPolyFromRecipe(R),
      L = R.layers,
      names = new Set(L.map(l => l.name));
    assert.ok(M.tris > 0 && M.tris <= 6000, `${M.tris} triangles`);
    assert.deepEqual(P.box, want.box);
    assert.equal(P.door.x, want.door);
    for (const n of want.parts) assert.ok(names.has(n), `no ${n}`);
    const glass = new Set(L.filter(l => l.glass > 0).map(l => l.glass));
    assert.ok(glass.size >= 3, 'its windows are numbered glass');
    assert.ok(
      L.some(l => l.glow),
      'something glows at night'
    );
    assert.ok(
      L.some(l => l.roof),
      'its roof is marked'
    );
    for (const l of L.filter(l => l.k === 'img')) assert.equal(l.face, 'fixed', `${l.name} faces the front`);
    /* the lean: the warp's metres at the top, over the model's height */
    const lean = Math.hypot(...((R.warp && R.warp.lean) || [0, 0])),
      h = M.box[4] - M.box[1];
    assert.ok(Math.atan(lean / h) <= (1.5 * Math.PI) / 180, `lean ${lean} m over ${h} m`);
    assert.ok(
      P.img.startsWith('scene/next/hub/') && fs.existsSync(new URL(P.img, ART)),
      'a picture baked from the model'
    );
  });

test("the inn's floors are turned against each other", () => {
  const R = JSON.parse(fs.readFileSync(new URL(S.props.inn.model, ART), 'utf8')),
    turn = n => R.layers.find(l => l.name === n).rot || 0;
  assert.ok(turn('first floor') > 0 && turn('top floor') < 0);
});

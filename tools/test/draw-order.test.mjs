// Fluid track FL-5a (quality.drawOrder): the discard-free variants of the opaque programs. Each is its program's
// fragment text with every cut taken out by an exact-once edit (game/js/engine/shader-precision.js solidFragment) and
// nothing else changed; the vertex shader is the same. Which models take them (whole, not stretched, no own texture),
// nearest first. Whether a variant builds on a device is the precompile list's and the in-game test's. No graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './walk-renderer.mjs';
await import('../../game/js/prop-models.js');

const G = globalThis;
const {
  solidFragment,
  WALK_SHADERS,
  GROUND_SOLID_EDITS,
  groundSolidShaders,
  propModelShaders,
  propModelSolidShaders,
  modelSolidItem,
  modelsNearestFirst,
} = G;

const DISCARD = /\bdiscard\b/;
// the variant is the original with exactly the edits' texts gone: nothing else differs
function sameBut(orig, solid, edits) {
  let s = orig;
  for (const [a, b] of edits) {
    assert.equal(orig.split(a).length, 2, `once: ${a}`);
    s = s.replace(a, () => b);
  }
  assert.equal(solid, s);
}

test('solidFragment: null when an edit is missing or a discard is left; the edits applied otherwise', () => {
  const fs = 'void main(){if(a)discard;if(b)discard;o=vec4(1.);}';
  assert.equal(solidFragment(fs, [['if(a)discard;', '']]), null);
  assert.equal(solidFragment(fs, [['if(c)discard;', '']]), null);
  assert.equal(
    solidFragment(fs + fs, [
      ['if(a)discard;', ''],
      ['if(b)discard;', ''],
    ]),
    null
  );
  assert.equal(
    solidFragment(fs, [
      ['if(a)discard;', ''],
      ['if(b)discard;', ''],
    ]),
    'void main(){o=vec4(1.);}'
  );
});

test('the ground: groundS is the ground with its hole, wall-thinning and rock cuts gone, the same vertex shader', () => {
  const D = groundSolidShaders();
  assert.ok(D.groundS, 'the edits fit the ground');
  assert.ok(DISCARD.test(WALK_SHADERS.ground[1]));
  assert.ok(!DISCARD.test(D.groundS[1]));
  assert.equal(D.groundS[0], WALK_SHADERS.ground[0]);
  sameBut(WALK_SHADERS.ground[1], D.groundS[1], GROUND_SOLID_EDITS);
});

test('the instanced models: voxIS and mdlIS hold no discard and are voxI and mdlI otherwise', () => {
  const P = propModelShaders(),
    D = propModelSolidShaders();
  assert.ok(P.voxI && P.mdlI, 'the buildings shaders are loaded in the test page');
  assert.deepEqual(Object.keys(D).sort(), ['mdlIS', 'voxIS']);
  for (const [k, s] of [
    ['voxI', 'voxIS'],
    ['mdlI', 'mdlIS'],
  ]) {
    assert.ok(DISCARD.test(P[k][1]), k);
    assert.ok(!DISCARD.test(D[s][1]), s);
    assert.equal(D[s][0], P[k][0], s + ': the vertex shader');
    assert.equal(P[k][1].length - D[s][1].length > 0, true);
  }
  // only the cut statements went: every line but the cut ones is the same
  const strip = t => t.replace(/if\([^;]*\)discard;/g, '');
  assert.equal(strip(P.voxI[1]), D.voxIS[1]);
  assert.equal(strip(P.mdlI[1]), D.mdlIS[1]);
  assert.equal(propModelSolidShaders(), D, 'made once');
});

test('which models the variants draw: whole, not stretched, not with their own texture', () => {
  const D = { voxIS: [], mdlIS: [] },
    vox = { q: 1 },
    mdl = { model: true },
    own = { model: true, own: true };
  assert.equal(modelSolidItem({}, vox, D), true);
  assert.equal(modelSolidItem({ fade: 1 }, mdl, D), true);
  assert.equal(modelSolidItem({ fade: 0.995 }, mdl, D), true);
  assert.equal(modelSolidItem({ fade: 0.5 }, vox, D), false, 'a fading item dithers');
  assert.equal(modelSolidItem({ smear: { d: [0, 0, 0] } }, vox, D), false, 'a stretched one goes one at a time');
  assert.equal(modelSolidItem({}, own, D), false, 'its own texture is cut where clear');
  assert.equal(modelSolidItem({}, mdl, { voxIS: [] }), false, 'no mdlIS made');
  assert.equal(modelSolidItem({}, vox, {}), false, 'no voxIS made');
});

test('nearest first: by distance from the eye, so the batches come nearest first', () => {
  const m = {},
    L = [
      [{ x: 10, y: 0, z: 0 }, m],
      [{ x: 1, y: 0, z: 0 }, m],
      [{ x: 0, y: 0, z: -5 }, m],
    ],
    out = modelsNearestFirst(L, { eye: [0, 0, 0] });
  assert.deepEqual(
    out.map(e => e[0].x + e[0].z),
    [1, -5, 10]
  );
  const one = [[{ x: 3, y: 0, z: 0 }, m]];
  assert.equal(modelsNearestFirst(one, { eye: [0, 0, 0] }), one);
  assert.equal(modelsNearestFirst(L, {}), L, 'no eye: as it was');
});

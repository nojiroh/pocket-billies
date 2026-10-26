// Phase 20 R3 (shadows lane): what the shadow maps (game/js/walk/shadows.js: the sun's near and far maps, the far
// map's cache missed and hit, the lamps' maps) send to the card, recorded on a stand-in WebGL context for a fixture
// that takes every branch of the shadow pictures: a picture facing the sun, one standing fixed (straight and turned),
// a 3D building's front, a box building's slices (straight and turned), a box's layer (skipped), someone wading,
// flip -1, a picture not loaded yet, and the kinds that cast no picture shadow (flat, far, vol, flag, a model, a prop
// with no shadow). The ground, buildings, structures, solid props and models are stand-ins that note their turn.
//   node --test --test-update-snapshots tools/test/shadow-passes.test.mjs   remakes it (say why in the commit)
import { test } from 'node:test';
import { record, shadowFixture, shadowSetup } from './shadow-fixture.mjs';

const G = globalThis;
const { engineContext } = G;
const SUN = { travel: [0.4, -0.8, 0.45] };
const lamps = () => [
  { p: [2, 3, 2], r: 8 },
  { p: [6, 2.5, 5], r: 6 },
  { p: [20, 0.5, 20], r: 4 },
];

test('the sun: near map, far map missed then hit; every call in order', t => {
  const gl = shadowSetup(),
    L = shadowFixture();
  G.shadowPass(L, SUN, null);
  G.shadowPass(L, SUN, null);
  t.assert.snapshot(record(gl));
});

test('the sun straight overhead, no cache, one cascade', t => {
  const gl = shadowSetup();
  engineContext.look.quality.shadowCache = false;
  engineContext.look.shadows.cascades = false;
  G.shadowPass(shadowFixture(), { travel: [0, -1, 0.01] }, null);
  t.assert.snapshot(record(gl));
});

test("the lamps' maps: every call in order", t => {
  const gl = shadowSetup(),
    X = { lights: lamps() };
  G.LAMP_SHADOWED.length = 0;
  G.lampShadowMaps(shadowFixture(), X, 1);
  t.assert.snapshot(record(gl));
});

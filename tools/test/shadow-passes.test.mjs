// Phase 20 R3 (shadows lane): what the shadow maps (game/js/walk/shadows.js: the sun's near and far maps, the far
// map's cache missed and hit, the lamps' maps) send to the card, recorded on a stand-in WebGL context for a fixture
// that takes every branch of the shadow pictures: a picture facing the sun, one standing fixed (straight and turned),
// a 3D building's front, a box building's slices (straight and turned), a box's layer (skipped), someone wading,
// flip -1, a picture not loaded yet, and the kinds that cast no picture shadow (flat, far, vol, flag, a model, a prop
// with no shadow). The ground, buildings, structures, solid props and models are stand-ins that note their turn.
//   node --test --test-update-snapshots tools/test/shadow-passes.test.mjs   remakes it (say why in the commit)
import { test } from 'node:test';
import { recordingGL } from './walk-renderer.mjs';

const G = globalThis;
const { gpuState, walkView, walkRenderer, engineContext, WALK_SHADERS } = G;
const { provide } = await import('../../game/js/hooks.js');

const uniformNames = src => {
  const names = new Set();
  for (const s of src)
    for (const m of s.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/uniform\s+(?:highp\s+)?\w+\s+([^;{]+);/g))
      for (const part of m[1].split(',')) names.add(part.trim().replace(/\[.*$/, ''));
  return [...names];
};
const program = (name, src) => ({ p: name, U: Object.fromEntries(uniformNames(src).map(n => [n, n])) });

let texN = 0;
const pic = (w = 32, h = 48) => ({ width: w, height: h, T: { t: 'tex' + ++texN } });
export function shadowFixture() {
  texN = 0;
  const grass = pic(16, 16),
    bush = pic(32, 24),
    base = (id, im, x, z, o = {}) => ({
      k: 'prop',
      id,
      im,
      x,
      y: 0.1 * x,
      z,
      mpp: 1 / 32,
      ox: -im.width / 2,
      oy: -im.height,
      w: im.width,
      h: im.height,
      flip: 1,
      sh: 1,
      shear: 0,
      p: { k: id, x, z },
      M: {},
      ...o,
    });
  return [
    base('grassA', grass, 1, 2, { shear: 0.05, still: false }),
    base('bush', bush, 2, 3, { still: true }),
    base('grassB', grass, 3, 1, { shear: -0.03, flip: -1 }),
    base('sign', pic(), 4, 4, { fixed: true, plane: true, still: true }),
    base('signTurned', pic(), 5, 2, { fixed: true, plane: true, p: { k: 's', x: 5, z: 2, rot: 30 }, still: true }),
    base('board', pic(), 6, 1, { plane: true, still: true }),
    base('front', pic(64, 64), 7, 6, { bld3: true, M: { build: { a: 1 }, box: [4, 3, 5] }, plane: true, still: true }),
    base('box', pic(48, 64), 9, 3, { M: { box: [3, 2, 4] }, plane: true, still: true }),
    base('boxTurned', pic(48, 64), 11, 5, {
      M: { box: [3, 2.5, 4] },
      plane: true,
      p: { k: 'b', x: 11, z: 5, rot: 90, s: 1.5 },
      still: true,
    }),
    base('boxLayer', pic(), 9, 3.5, { M: { box: [3, 2, 4] }, layer: { img: 'l' }, still: true }),
    base('leaf', bush, 2.5, 2.5, { voxImg: 1, fixed: true, plane: true, shear: 0.02 }),
    { ...base('wader', pic(32, 48), 3, 5, { cut: 12, M: null }), k: 'npc' },
    base('grassC', grass, 0.5, 0.5, { shear: 0.01 }),
    base('noPic', { width: 8, height: 8 }, 1.5, 1.5, {}),
    base('noPicLayer', { width: 8, height: 8 }, 1.6, 1.6, { M: { box: [1, 1, 1] }, layer: { img: 'x' }, still: true }),
    base('flat', pic(), 1, 1, { flat: true }),
    base('far', pic(), 1, 1, { far: true }),
    base('vol', pic(), 1, 1, { vol: true }),
    base('flagCloth', pic(), 1, 1, { k: 'flag' }),
    base('model', pic(), 1, 1, { vox: { a: 1 }, still: true }),
    base('noShadow', pic(), 1, 1, { sh: 0 }),
    { ...base('enc2', pic(), 1, 1), k: 'enc2' },
    base('farAway', grass, 60, 60, { still: true }),
  ];
}
const SUN = { travel: [0.4, -0.8, 0.45] };

export function shadowSetup() {
  const gl = recordingGL(),
    note = (...a) => gl.calls.push(a);
  gpuState.gl = gl;
  gpuState.P = {
    shadow: program('shadow', WALK_SHADERS.shadow),
    shadowG: program('shadowG', WALK_SHADERS.shadowG),
  };
  if (G.SHADOW_INSTANCE_SHADERS) gpuState.P.shadowI = program('shadowI', G.SHADOW_INSTANCE_SHADERS.shadowI);
  gpuState.fb = { shadow: { f: 'shadowFB' } };
  walkView.sc = { w: 64, h: 64, wind: 1 };
  walkView.pl = { x: 3, z: 3, yv: 0 };
  walkView.id = 'test';
  walkView.R = 1;
  walkRenderer.q = 0;
  walkRenderer.bt = null;
  walkRenderer.shKey = null;
  walkRenderer.mesh = null;
  walkRenderer.itemGen = 1;
  engineContext.look = {
    shadows: { cascades: true, nearRadius: 13, buildings: true, fit: false, lampShadows: 2 },
    quality: { shadowMap: 2048, shadowCache: true },
    world: { curve: 0.002 },
  };
  G.imageTexture = im => (im && im.T) || null;
  G.renderTarget = (name, w) => (note('target', name, w), (gpuState.fb.shadowS = { f: name + 'FB', w }));
  G.beginSunShadow = (x, z, r, sun, res, name = 'shadow') => (
    note('sun', name, x, z, r, res),
    { vp: [name], size: res }
  );
  G.beginLampShadow = (p, res, name) => (note('lamp', name, ...p, res), { vp: [name], size: res, lamp: true });
  G.endShadow = () => note('end');
  G.frameBlockStale = () => note('stale');
  provide({
    drawGroundDepth: () => note('ground'),
    buildingFrontPicture: im => ({ T: { t: 'front:' + im.T.t } }),
    buildingGuard: f => f(),
    buildingsOn: () => true,
    buildingState: { made: 3 },
    roomFloorOf: () => null,
    drawBuildingShadows: (SH, L) => note('buildings', SH.vp[0], L.length),
    drawStructureShadows: SH => note('structures', SH.vp[0]),
    drawSolidPropShadows: (SH, L) => note('solid', SH.vp[0], L.length),
    drawPropModelShadows: (SH, L) => note('models', SH.vp[0], L.filter(it => it.vox).length),
  });
  return gl;
}
const round = v => (typeof v === 'number' ? +v.toFixed(6) : Array.isArray(v) ? v.map(round) : v);
export const record = gl => gl.calls.map(c => c.map(round).join(' '));
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

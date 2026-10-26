// Phase 20 E1-E2: what the sprite pass (walk/sprites.js drawSprites) and the reflection's pictures (walk/water.js
// reflectionPass) send to the card, recorded on a stand-in WebGL context for a fixture that takes every branch: a
// model (vox) and its picture layers, a 3D building front, a flag (wave), a crossed tree, far and layer pictures, a
// glow, a person, a turned picture, noRecv, flip -1, the title's town rise, someone wading (cut), turning blades and
// clock hands, flat things. The hit targets, blades, hands and flat things are stand-ins that only note their turn in
// the same record, so the order of everything the pass does is frozen. No graphics.
//   node --test --test-update-snapshots tools/test/sprite-records.test.mjs   remakes it (say why in the commit)
import { test } from 'node:test';
import { recordingGL } from './walk-renderer.mjs';

const G = globalThis;
const { gpuState, walkView, walkRenderer, engineContext, WALK_SHADERS } = G;
const { provide } = await import('../../game/js/hooks.js');

// the program stand-in: every uniform the sprite shaders declare, each location its own name
const names = new Set();
for (const s of WALK_SHADERS.sprite)
  for (const m of s.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/uniform\s+(?:highp\s+)?\w+\s+([^;{]+);/g))
    for (const part of m[1].split(',')) names.add(part.trim().replace(/\[.*$/, ''));
const program = () => ({ p: 'sprite', U: Object.fromEntries([...names].map(n => [n, n])) });

// a picture with its texture and normal map (imageTexture is a stand-in that reads them off it)
let texN = 0;
const pic = (w = 32, h = 48) => {
  const n = ++texN;
  return { width: w, height: h, T: { t: 'tex' + n, n: 'nrm' + n } };
};
const M = o => ({ group: '', ...o });
// the fixture: built fresh for each run (the passes keep caches on M and the items)
function fixture() {
  texN = 0;
  const oak = pic(64, 96),
    leaf = pic(24, 24),
    flag = pic(40, 20),
    sign = pic(32, 32),
    man = pic(32, 48),
    lamp = pic(16, 64),
    mill = pic(48, 80),
    tree = M({ group: 'tree_oak' }),
    base = (k, im, x, z, o = {}) => ({
      k: 'prop',
      id: k,
      im,
      x,
      y: 0,
      z,
      mpp: 1 / 32,
      ox: -im.width / 2,
      oy: -im.height,
      w: im.width,
      h: im.height,
      flip: 1,
      p: { k, x, z },
      M: M({}),
      ...o,
    });
  return [
    base('oak', oak, 1, 2, {
      M: tree,
      cross: true,
      lk: { hsv: [0.1, -0.2, 0.05, 1], wear: [0.2, 0.3, 0, 0.1], tint: [0.9, 0.8, 0.7, 0.4], mask: [0.25, 0.1] },
      shear: 0.04,
      mat: 'foliage',
    }),
    base('lamp', lamp, 3, 1, { glow: 0.6, mat: 'metal', p: { k: 'lamp', x: 3, z: 1 } }),
    base('leafA', leaf, 2, 4, {
      voxImg: true,
      fixed: true,
      plane: true,
      noRecv: true,
      eyeward: 0.05,
      M: tree,
      layer: true,
    }),
    base('sign', sign, 5, 5, { fixed: true, plane: true, yaw: 0.7, mat: 'wood', slope: 0.12 }),
    base('house', pic(), 8, 3, { vox: true, M: M({ hands: [{ img: 'hand' }] }) }),
    base('front', pic(), 9, 9, { bld3: true, fade: 0.5 }),
    base('flag', flag, 4, 7, { wave: [0.3, 1.2, 0], mat: 'cloth' }),
    base('leafB', leaf, 6, 2, { voxImg: true, fixed: true, plane: true, noRecv: true, M: tree, layer: true, flip: -1 }),
    { ...base('man', man, 2, 6, { person: true, fade: 0.7, cut: 12, M: null }), k: 'npc' },
    base('farOak', oak, 30, 40, { M: tree, far: true, cross: true, flip: -1 }),
    base('mill', mill, 7, 8, { M: M({ blades: { img: 'blade', x: 0, y: 60, w: 40 } }), mat: 'stone' }),
    base('clock', sign, 10, 10, { M: M({ hands: [{ img: 'hand', per: 60 }] }) }),
    base('hidden', sign, 1, 1, { vis: false }),
    base('puddle', pic(), 3, 3, { flat: true }),
    base('vol', sign, 3, 3, { vol: true }),
    base('sapling', leaf, 11, 1, { M: tree, risen: 0.001 }),
    base('rising', sign, 12, 2, { risen: 0.5 }),
    base('nopic', { width: 8, height: 8 }, 0, 0, {}),
  ];
}
const camera = () => ({
  vp: Array.from({ length: 16 }, (_, i) => (i % 5 ? 0.01 * i : 1)),
  right: [0.8, 0, 0.6],
  back: [0.6, 0, -0.8],
  fwd: [-0.6, 0, 0.8],
  yaw: 0.6,
  eye: [0, 10, -10],
  rw: 400,
  rh: 300,
});
const X = { sun: { dir: [0.3, 0.8, 0.5] }, shadow: 'map' };

// the passes' helpers it calls but that are not the sprite pass's own uniforms: each notes its turn in the record
function stubs(gl) {
  const note = (...a) => gl.calls.push(a);
  G.setLightUniforms = (p, X2) => note('lights', p.p, X2.shadow ?? null);
  G.imageTexture = im => (im && im.T) || null;
  G.artImage = name => ({ width: 8, height: 8, T: { t: name, n: name + 'N' } });
  G.addHitTarget = it => note('hit', it.id);
  G.drawClockHands = (p, it) => note('hands', it.id);
  G.drawRotatingBlades = (p, it, b, BT) => note('blades', it.id, BT.t);
  G.useFxProgram = () => (note('fx'), { p: 'fx', U: {} });
  G.drawFlatItem = (fp, it, T) => note('flat', it.id, T.t);
  G.townRiseAmount = it => it.risen ?? 1;
  G.waterNear = () => true;
  G.mirrorInView = () => true;
  G.reflectionLevel = () => 0.25;
  G.computeFrustum = () => null;
  G.renderTarget = () => ({ f: 'refl' });
  provide({
    drawPropModels: (C, L) =>
      note(
        'models',
        L.map(it => it.id)
      ),
  });
}
function setup() {
  const gl = recordingGL();
  gpuState.gl = gl;
  gpuState.P = { sprite: program() };
  gpuState.gridN = 96;
  walkView.sc = { w: 64, h: 64, wind: 1 };
  walkView.pl = null;
  walkView.t = 5000;
  walkRenderer.rise = null;
  walkRenderer.bfade = null;
  // the dials the pass reads, pinned (a changed default must not move this record)
  engineContext.look = {
    color: { outlines: 1 },
    shadows: { selfShade: 0.7, strength: 0.6 },
    grass: { wind: 1 },
    quality: { cull: true },
    world: { curve: 0 },
  };
  stubs(gl);
  return gl;
}
const round = v => (typeof v === 'number' ? +v.toFixed(6) : Array.isArray(v) ? v.map(round) : v);
const record = gl => gl.calls.map(c => c.map(round).join(' '));

test('the sprite pass: every call it makes, in order', t => {
  const gl = setup();
  G.drawSprites(camera(), fixture(), X, [], [], 32);
  t.assert.snapshot(record(gl));
  t.assert.snapshot([...walkRenderer.bfade].map(([it, f]) => [it.id, f]));
});

test('the sprite pass while the title town rises', t => {
  const gl = setup();
  walkRenderer.rise = { t0: 0 };
  G.drawSprites(camera(), fixture(), X, [], [], 32);
  t.assert.snapshot(record(gl));
});

test("the reflection's pictures: every call, in order", t => {
  const gl = setup();
  G.reflectionPass(fixture(), camera(), 400, 300, X);
  t.assert.snapshot(record(gl));
});

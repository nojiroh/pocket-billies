// Phase 20 E1-E2: what the sprite pass (walk/sprites.js drawSprites) and the reflection's pictures (walk/water.js
// reflectionPass) send to the card, recorded on a stand-in WebGL context for a fixture that takes every branch: a
// model (vox) and its picture layers, a 3D building front, a flag (wave), a crossed tree, far and layer pictures, a
// glow, a person, a turned picture, noRecv, flip -1, the title's town rise, someone wading (cut), turning blades and
// clock hands, flat things. The hit targets, blades, hands and flat things are stand-ins that only note their turn in
// the same record, so the order of everything the pass does is frozen. No graphics.
//   node --test --test-update-snapshots tools/test/sprite-records.test.mjs   remakes it (say why in the commit)
import { test } from 'node:test';
import assert from 'node:assert/strict';
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
    quality: { cull: true, spriteInstances: false },
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

// a record as plain numbers (its item by id, its texture by name)
const plainRecord = r => ({
  id: r.it.id,
  mode: r.mode,
  ...(r.mode === 'quad' || r.mode === 'wave'
    ? {
        tex: r.T.t,
        at: round([r.x, r.y, r.z]),
        off: round([r.ox, r.oy, r.w, r.h]),
        uv: round([...r.uv]),
        flip: r.flip,
        slope: r.slope,
        shear: r.shear,
        right: round([...r.right]),
        back: round([...r.back]),
        fixed: r.fixed,
        noRecv: r.noRecv,
        flipN: r.flipN,
        mat: Object.keys(G.SURFACE_MATERIALS).find(k => G.SURFACE_MATERIALS[k] === r.mt),
        fol: round(r.fol),
        self: round(r.self),
        emit: round(r.emit),
        fade: round(r.fade),
        rim: r.rim,
        lit: round(r.lit),
        shade: r.shade,
        dz: r.dz,
        wave: r.wave,
        cross: r.crossOn ? plainRecord(r.cr) : null,
      }
    : {}),
});

test('spriteDrawList and spriteRecord: the list grouped by picture, and each record', t => {
  setup();
  const C = camera(),
    F = G.spriteFrame(C, X.sun),
    L = G.spriteDrawList(fixture());
  t.assert.snapshot(L.map((it, i) => plainRecord((G.spriteRecord(it, F, G.spriteRecordAt(i)), G.spriteRecordAt(i)))));
});

// ---------- phase 20 E7-E8: the same pass as instances ----------
const iNames = new Set();
for (const s of G.SPRITE_INSTANCE_SHADERS.spriteI)
  for (const m of s.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/uniform\s+(?:highp\s+)?\w+\s+([^;{]+);/g))
    for (const part of m[1].split(',')) iNames.add(part.trim().replace(/\[.*$/, ''));
function setupInstanced() {
  const gl = setup();
  gpuState.P.spriteI = { p: 'spriteI', U: Object.fromEntries([...iNames].map(n => [n, n])) };
  engineContext.look.quality.spriteInstances = true;
  return gl;
}
// the pictures' draws of a record: [texture, instances], with the blades and hands where they come; and the hits
function draws(calls) {
  const out = [],
    hits = [];
  let tex = null;
  for (const c of calls) {
    if (c[0] === 'bindTexture' && c[2] && String(c[2]).startsWith('tex')) tex = c[2];
    else if (c[0] === 'drawArrays' && c[3] === 6) out.push([tex, 1]);
    else if (c[0] === 'drawArrays') out.push([tex, 'grid']);
    else if (c[0] === 'drawArraysInstanced') out.push([tex, c[4]]);
    else if (c[0] === 'blades' || c[0] === 'hands') out.push([c[0], c[1]]);
    else if (c[0] === 'hit') hits.push(c[1]);
  }
  return { out, hits };
}
// consecutive draws of one texture as one run (a grid draw and the blades or hands stand alone)
function runs(list) {
  const out = [];
  for (const d of list) {
    const last = out[out.length - 1];
    if (d[1] === 1 && last && last[0] === d[0] && typeof last[1] === 'number' && !last.closed) last[1]++;
    else out.push([...d]);
    if (d[0] === 'blades' || d[0] === 'hands') if (out.length > 1) out[out.length - 2].closed = true;
  }
  return out.map(d => d.slice(0, 2));
}

for (const rise of [false, true])
  test(`as instances${rise ? ' while the town rises' : ''}: the runs are the old draws grouped by picture, in order; the same hits`, t => {
    let gl = setup();
    if (rise) walkRenderer.rise = { t0: 0 };
    G.drawSprites(camera(), fixture(), X, [], [], 32);
    const old = draws(gl.calls);
    gl = setupInstanced();
    if (rise) walkRenderer.rise = { t0: 0 };
    G.drawSprites(camera(), fixture(), X, [], [], 32);
    const now = draws(gl.calls);
    assert.deepEqual(now.out, runs(old.out));
    assert.deepEqual(now.hits, old.hits);
    assert.ok(now.out.length < old.out.length);
    if (!rise) t.assert.snapshot(record(gl));
  });

test("as instances: each instance holds its record, a tree's crossing picture right after it", () => {
  setupInstanced();
  const C = camera(),
    items = fixture();
  G.drawSprites(C, items, X, [], [], 32);
  const F = G.spriteFrame(C, X.sun),
    L = G.spriteDrawList(items);
  let k = 0;
  const H = 2 ** -10;
  L.forEach((it, i) => {
    const r = G.spriteRecordAt(i);
    G.spriteRecord(it, F, r);
    if (r.mode !== 'quad') return;
    for (const q of r.crossOn ? [r, r.cr] : [r]) {
      const u = G.unpackSpriteInstance(k++);
      assert.deepEqual([u.x, u.y, u.z, u.ox, u.oy, u.w, u.h], [q.x, q.y, q.z, q.ox, q.oy, q.w, q.h].map(Math.fround));
      assert.equal(u.cam, q === r && !it.fixed, `${it.id} faces the camera`);
      if (!u.cam)
        for (const j of [0, 2])
          assert.ok(Math.abs(u.right[j] - q.right[j]) <= H && Math.abs(u.back[j] - q.back[j]) <= H);
      for (const [a, b] of [
        [u.fade, q.fade],
        [u.emit, q.emit],
        [u.lit, q.lit],
        [u.rim, q.rim],
        [u.shade, q.shade],
        [u.shear, q.shear],
        [u.slope, q.slope],
        [u.dz, q.dz],
        [u.shown, q.uv[3]],
        [u.self[0], q.self[0]],
        [u.fol[0], q.fol[0]],
      ])
        assert.ok(Math.abs(a - b) <= Math.abs(b) * H + 1e-6, `${it.id}: ${a} against ${b}`);
      assert.equal(G.SURFACE_MATERIALS[u.mat], q.mt);
      assert.equal(u.flip, q.flip < 0 ? -1 : 1);
      assert.equal(u.fixed, q.fixed);
    }
  });
});

test('the instanced fragment shader: every per-picture uniform read from a varying, within 15 varying rows', () => {
  const [vs, fs] = G.SPRITE_INSTANCE_SHADERS.spriteI,
    main = fs.slice(fs.indexOf('\nvoid main(){'));
  for (const u of [
    'uRight',
    'uBack',
    'uBaseP',
    'uFade',
    'uRim',
    'uLit',
    'uShade',
    'uEmit',
    'uMat',
    'uSelf',
    'uUV',
    'uFlipN',
    'uFixed',
    'uNoRecv',
    'uCAO',
  ])
    assert.match(fs, new RegExp(`#define ${u} `), u);
  for (const f of ['lookOn(', 'seasonal(', 'snowOn(']) assert.ok(main.includes(f), f);
  // the vertex shader's outputs: one row each at worst (no packing)
  const outs = [...vs.matchAll(/(?:flat )?out\s+(\w+)\s+([^;]+);/g)].flatMap(m => m[2].split(','));
  assert.ok(outs.length <= 15, `${outs.length} varyings`);
  for (const v of ['vUV', 'vW', 'vH', 'vPx', 'vRip']) assert.ok(outs.includes(v), v);
});

test('the reflection as instances: the runs are its old draws grouped by picture, with the old values', t => {
  let gl = setup();
  G.reflectionPass(fixture(), camera(), 400, 300, X);
  const old = draws(gl.calls),
    // the old loop's per-picture values, in order: right (as sent), uSelf, uFol, uNoRecv
    sent = [];
  for (const c of gl.calls) {
    if (c[0] === 'uniform3fv' && c[1] === 'uRight') sent.push({ right: c[2] });
    else if (c[0] === 'uniform3f' && c[1] === 'uSelf') sent[sent.length - 1].self = c.slice(2);
    else if (c[0] === 'uniform2f' && c[1] === 'uFol') sent[sent.length - 1].fol = c.slice(2);
    else if (c[0] === 'uniform1f' && c[1] === 'uNoRecv') sent[sent.length - 1].noRecv = c[2];
  }
  sent.shift(); // the pass's own uRight before the pictures
  gl = setupInstanced();
  G.reflectionPass(fixture(), camera(), 400, 300, X);
  const now = draws(gl.calls);
  assert.deepEqual(now.out, runs(old.out));
  assert.equal(sent.length, old.out.filter(d => d[1] === 1).length);
  const C = camera(),
    H = 2 ** -10;
  sent.forEach((v, i) => {
    const u = G.unpackSpriteInstance(i),
      R = u.cam ? C.right : u.right;
    for (const j of [0, 2]) assert.ok(Math.abs(R[j] - v.right[j]) <= H, `right of ${i}`);
    if (!u.cam) for (const j of [0, 2]) assert.ok(Math.abs(u.back[j] - C.back[j]) <= H, `back of ${i}`);
    for (let j = 0; j < 3; j++) assert.ok(Math.abs(u.self[j] - v.self[j]) <= H, `self of ${i}`);
    assert.deepEqual([...u.fol.map(round), u.noRecv], [...v.fol.map(round), v.noRecv]);
    assert.deepEqual([u.fade, u.rim, u.emit, u.lit, u.flipN, u.fixed, u.dz], [1, 0, 0, 1, 1, 0, 0]);
    assert.ok(Math.abs(u.shade - 0.3) < H);
  });
  t.assert.snapshot(record(gl).filter(c => !c.startsWith('bufferSubData')));
});

// characters track CH-1: people's draws are counted apart (engine/gpu-counters.js `person`, for the debug log's people):
// a person's picture carries its size (ppm, person-art.js); the fixture's man is one, and a Billie beside him (`person`
// for its light, like the man) is not
for (const instanced of [false, true])
  test(`CH-1: a person's picture counts as a person draw in the sprites and the reflection${instanced ? ', as instances' : ''}; a Billie's doesn't`, () => {
    const gl = instanced ? setupInstanced() : setup(),
      L = fixture(),
      man = L.find(it => it.id === 'man');
    man.im.ppm = 66.5;
    L.push({ ...man, id: 'billie', k: 'wild', im: pic(32, 32) });
    G.countersOn(gl);
    G.gpuPass('sprites');
    G.drawSprites(camera(), L, X, [], [], 32);
    G.gpuPass('reflection');
    G.reflectionPass(L, camera(), 400, 300, X);
    G.countersOff();
    G.gpuFrameDone(1e9);
    const s = G.gpuCountSummary();
    assert.equal(s.dct.sprites.person, 1);
    assert.equal(s.dct.reflection.person, 1);
    assert.ok(s.dcp.sprites > 1 && s.dcp.reflection > 1, 'the rest of each pass is counted untagged');
  });

// style track SY-6: a coated Billie while its foil's band crosses it (item.foil) is drawn on its own on the sprite
// program with uFoil, put back to 0 right after; in both passes, the instanced one leaving its run for it
// the style and VFX tracks met (SY-6's foil, VFX-9's uHit): a coated Billie that is also flashing is drawn once with
// both, and uHit is put back to 0 before the next picture, in both passes
for (const inst of [false, true])
  test(`a coated Billie's hit flash${inst ? ' as instances' : ''}: uFoil and uHit on one draw, uHit back to 0 after`, () => {
    const gl = inst ? setupInstanced() : setup(),
      im = pic(32, 48),
      man = (id, x, foil, hit) => ({
        k: 'npc',
        id,
        im,
        x,
        y: 0,
        z: 6,
        mpp: 1 / 32,
        ox: -16,
        oy: -48,
        w: 32,
        h: 48,
        flip: 1,
        person: true,
        foil,
        hit,
      }),
      F = [0.55, 0.7, 0.2, 0.3],
      H = [1, 1, 1, 0.5];
    G.drawSprites(camera(), [man('a', 1, F, H), man('b', 2, null, null)], X, [], [], 32);
    const c = gl.calls.map(q => q.map(round).join(' ')),
      hitOn = c.indexOf('uniform4fv uHit ' + H.join(',')),
      foilOn = c.indexOf('uniform4fv uFoil ' + F.join(',')),
      hitOff = c.indexOf('uniform4f uHit 0 0 0 0');
    assert.ok(hitOn >= 0 && foilOn >= 0, 'uHit and uFoil set');
    assert.equal(
      c.slice(Math.max(hitOn, foilOn), hitOff).filter(q => q.startsWith('drawArrays ')).length,
      1,
      'one draw with both'
    );
    assert.ok(hitOff > Math.max(hitOn, foilOn), 'uHit put back');
    const next = c.findIndex((q, j) => j > hitOff && q.startsWith('drawArrays'));
    assert.ok(next > hitOff, 'the next picture is drawn after uHit is back to 0');
  });

for (const inst of [false, true])
  test(`the coat's foil${inst ? ' as instances' : ''}: the Billie drawn alone with uFoil, then uFoil back to 0`, () => {
    const gl = inst ? setupInstanced() : setup(),
      im = pic(32, 48),
      man = (id, x, foil) => ({
        k: 'npc',
        id,
        im,
        x,
        y: 0,
        z: 6,
        mpp: 1 / 32,
        ox: -16,
        oy: -48,
        w: 32,
        h: 48,
        flip: 1,
        person: true,
        foil,
      }),
      F = [0.55, 0.7, 0.2, 0.3];
    G.drawSprites(camera(), [man('a', 1, null), man('b', 2, F), man('c', 3, null)], X, [], [], 32);
    const c = gl.calls.map(q => q.map(round).join(' ')),
      on = c.indexOf('uniform4fv uFoil ' + F.join(',')),
      off = c.indexOf('uniform4f uFoil 0 0 0 0');
    assert.ok(on >= 0, 'uFoil set');
    assert.ok(off > on, 'and put back');
    const between = c.slice(on, off);
    assert.equal(between.filter(q => q.startsWith('drawArrays ')).length, 1, 'one draw with the foil');
    assert.ok(!between.some(q => q.startsWith('drawArraysInstanced')), 'never an instanced draw');
    assert.equal(c.filter(q => q.startsWith('uniform4fv uFoil')).length, 1, 'only the coated one');
    if (inst) {
      const { out } = draws(gl.calls);
      assert.deepEqual(out, [
        [out[0][0], 1],
        [out[0][0], 1],
        [out[0][0], 1],
      ]);
    }
  });

// ---------- fluid track FL-2a: the three fixes found in review ----------
// (a) the pass always knows which program is bound: a picture with blades or hands puts the sprite program in use before
// them, even when none is drawn (a model's blades: no blades drawn for a model), so a picture after it that leaves the
// run (a hit flash) is drawn on the sprite program, not the instanced one
test('FL-2a (a): after a model with blades, a flashing picture is drawn on the sprite program', () => {
  const gl = setupInstanced(),
    sign = fixture().find(it => it.id === 'sign'),
    L = [
      { ...sign, id: 'bladed', vox: true, M: M({ blades: { img: 'blade', x: 0, y: 0, w: 8 } }) },
      { ...sign, id: 'flash', x: 20, hit: [1, 1, 1, 0.5] },
    ];
  G.drawSprites(camera(), L, X, [], [], 32);
  let prog = null;
  const at = [];
  for (const c of gl.calls) {
    if (c[0] === 'useProgram') prog = c[1];
    else if (c[0] === 'drawArrays') at.push(prog);
  }
  assert.ok(at.length > 0);
  assert.deepEqual([...new Set(at)], ['sprite']);
  assert.equal(prog, 'sprite', 'the pass ends on the sprite program');
});
// (b) a crossing tree that flashes or dithers in keeps its crossing picture, as on the plain path
for (const what of ['hit', 'rise'])
  test(`FL-2a (b): a crossing tree with ${what === 'hit' ? 'a hit flash' : 'its rise dither'} keeps its crossing picture`, () => {
    const one = inst => {
      const gl = inst ? setupInstanced() : setup(),
        L = fixture().filter(it => it.id === 'oak');
      L[0][what] = what === 'hit' ? [1, 1, 1, 0.5] : [0.4, 0, 1];
      G.drawSprites(camera(), L, X, [], [], 32);
      return draws(gl.calls).out;
    };
    assert.deepEqual(one(false), [
      ['tex1', 1],
      ['tex1', 1],
    ]);
    assert.deepEqual(one(true), one(false));
  });
// (c) the reflection of a figure's cell of the live atlas: its rect (im.uv) and the figure flag, plain and batched
test("FL-2a (c): a figure's reflection draws its cell of the atlas, lit as a figure, in both paths", () => {
  const cell = [0.25, 0.5, 0.125, 0.25],
    L = () => {
      const man = fixture().find(it => it.id === 'man');
      return [{ ...man, cut: 0, im: { ...man.im, uv: cell, figAtlas: true } }];
    };
  let gl = setup();
  G.reflectionPass(L(), camera(), 400, 300, X);
  const c = gl.calls.map(q => q.map(round).join(' '));
  assert.ok(c.includes('uniform4fv uUV ' + cell.join(',')), 'the plain reflection sends the cell');
  assert.ok(c.includes('uniform1f uFig 1'), 'and the figure flag');
  gl = setupInstanced();
  G.reflectionPass(L(), camera(), 400, 300, X);
  const u = G.unpackSpriteInstance(0);
  assert.equal(u.fig, 1);
  assert.deepEqual(
    u.cell.map(v => Math.round(v * 1e4) / 1e4),
    cell
  );
});

// FL-2a: the contact shade at a picture's base, once per picture: the plain pass sends it as uCAO, the batched one
// packs the same value (to a 65535th), a crossing picture the same as its tree; no patches or the dial at 0 give 1
test("FL-2a: each picture's contact shade, as uCAO and in its instance", () => {
  const XA = {
      ...X,
      ao: [
        [1, 2, 1.5, 1.2],
        [5, 5, 0.5, 0.5],
      ],
      contact: 0.6,
    },
    want = it => G.contactShade(XA.ao, XA.contact, it.x, it.z);
  let gl = setup();
  const items = fixture();
  G.drawSprites(camera(), items, XA, [], [], 32);
  const sent = gl.calls.filter(c => c[0] === 'uniform1f' && c[1] === 'uCAO').map(c => c[2]);
  const L = G.spriteDrawList(items);
  assert.ok(sent.length > 5);
  assert.ok(
    sent.some(v => v < 0.99),
    'the oak stands in a patch'
  );
  assert.deepEqual(
    sent.map(round),
    L.filter((it, i) => ['quad', 'wave'].includes(G.spriteRecordAt(i).mode)).map(it => round(want(it)))
  );
  gl = setupInstanced();
  G.drawSprites(camera(), fixture(), XA, [], [], 32);
  const F = G.spriteFrame(camera(), XA.sun, XA);
  let k = 0;
  G.spriteDrawList(fixture()).forEach((it, i) => {
    const r = G.spriteRecordAt(i);
    G.spriteRecord(it, F, r);
    if (r.mode !== 'quad') return;
    for (let n = r.crossOn ? 2 : 1; n > 0; n--)
      assert.ok(Math.abs(G.unpackSpriteInstance(k++).cao - want(it)) <= 1 / 65535, it.id);
  });
  setup();
  G.drawSprites(camera(), fixture(), { ...XA, contact: 0 }, [], [], 32);
  assert.ok(gpuState.gl.calls.filter(c => c[1] === 'uCAO').every(c => c[2] === 1));
});

// FL-2a: the automatic fallback. The first frame in batches on a context ends with a getError; an error there turns
// batches off for the page (the next frame draws one picture a draw), an error raised before it is not blamed on it
for (const when of ['during', 'before'])
  test(`FL-2a: a GL error ${when} the first frame in batches ${when === 'during' ? 'turns batches off' : 'leaves them on'}`, () => {
    const gl = setupInstanced(),
      errs = when === 'during' ? [0, 1282] : [1282, 0];
    G.spriteInstanceState.bad = null;
    gl.getError = () => errs.shift() ?? 0;
    const logged = [];
    const wasLog = G.debugLog;
    G.debugLog = { add: (k, m) => logged.push(k + ': ' + m) };
    const was = console.error;
    console.error = () => {};
    G.drawSprites(camera(), fixture(), X, [], [], 32);
    console.error = was;
    const n = gl.calls.filter(c => c[0] === 'drawArraysInstanced').length;
    assert.ok(n > 0, 'the first frame drew in batches');
    gl.calls.length = 0;
    G.drawSprites(camera(), fixture(), X, [], [], 32);
    const again = gl.calls.filter(c => c[0] === 'drawArraysInstanced').length;
    if (when === 'during') {
      assert.equal(again, 0, 'the old path after the error');
      assert.ok(
        logged.some(m => /pictures in batches off: GL error 1282/.test(m)),
        logged.join('; ')
      );
    } else {
      assert.equal(again, n, 'still in batches');
      assert.ok(
        logged.some(m => /GL error 1282 before the first sprites in batches/.test(m)),
        logged.join('; ')
      );
    }
    G.spriteInstanceState.bad = null;
    G.debugLog = wasLog;
  });

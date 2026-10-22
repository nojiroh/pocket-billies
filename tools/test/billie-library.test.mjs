// Exercise the staged library transaction without a browser. Pixel rendering still needs browser QA.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../../studio/js/workbench-species.js', import.meta.url), 'utf8');
const start = source.indexOf('const wbsLibrary = ');
const end = source.indexOf('\nACTIONS.wbsLibraryOpen', start);
assert.ok(start >= 0 && end > start);
const code = source.slice(start, end) + '\nwbsLibrary;';

function fixture() {
  const canvas = (width, height) => ({ width, height, getContext: () => ({ drawImage() {} }) });
  const sheet = canvas(64, 40);
  const meta = () => ({
    k: 1,
    sheet: 'test.png',
    size: [64, 40],
    imgs: [{ ox: -4, oy: -1, f: { main: [1, 1, 8, 12] } }],
    bones: [
      { n: 'armL', par: 'torso', at: [-5, 0], i: 0, z: 8, a: 'armL' },
      { n: 'armR', par: 'torso', at: [5, 0], i: 0, z: 8, a: 'armR' },
    ],
  });
  const rigs = { test: { front: meta(), back: meta() } };
  const state = { D: {}, rigs, rigVer: 0, artDirty: new Map() };
  state.last = JSON.stringify({ D: state.D, R: rigs });
  let group;
  const context = {
    studioState: state,
    wbPart: { id: 'armL' },
    window: {},
    WB_VIEWS: ['front', 'back'],
    wbsSp: () => 'test',
    wbsRig: () => state.rigs.test,
    boneSlot: b => (b.n.startsWith('arm') ? 'front' : b.n === 'tail' ? 'sig' : null),
    makeCanvas: canvas,
    atlasPath: () => 'art/test.png',
    loadedAtlas: path => state.artDirty.get(path) || sheet,
    pictureImage: c => ({ width: c.width, height: c.height, data: new Uint8ClampedArray(c.width * c.height * 4) }),
    markArt: (path, c) => state.artDirty.set(path, c),
    commit() {},
    render() {},
    toast() {},
    changed() {
      state.rigVer++;
      state.rigsDirty = true;
    },
    artSteps: (steps, snapshot) => {
      group = { steps, snapshot };
      state.last = snapshot.after;
    },
  };
  const lib = vm.runInNewContext(code, context);
  lib.state = {
    sp: 'test',
    bone: 'armL',
    version: 0,
    rig: rigs.test,
    busy: false,
    prepared: [
      { view: 'front', bone: 'armL', path: 'art/test.png', sheet, c: canvas(10, 14), ox: -5, oy: -2 },
      { view: 'back', bone: 'armL', path: 'art/test.png', sheet, c: canvas(11, 15), ox: -6, oy: -3 },
    ],
  };
  return { lib, state, sheet, context, group: () => group };
}

test('library matches size groups and detects only existing paired siblings', () => {
  const { lib, state } = fixture();
  assert.equal(lib.slot({ n: 'armL' }), 'front');
  assert.equal(lib.slot({ n: 'tail' }), 'sig');
  assert.equal(lib.slot({ n: 'earL' }), 'head-extra');
  assert.equal(lib.pair(state.rigs.test.front, 'armL').n, 'armR');
  state.rigs.test.front.bones[1].par = 'other';
  assert.equal(lib.pair(state.rigs.test.front, 'armL'), null);
});

test('preview changes only copied bones; cancel leaves data and pixels untouched', () => {
  const { lib, state, sheet } = fixture();
  const before = JSON.stringify(state.rigs);
  const R = { bones: state.rigs.test.front.bones.map(b => ({ ...b, img: { c: sheet } })) };
  const preview = lib.preview(R, 'front');
  assert.notEqual(preview.bones[0], R.bones[0]);
  assert.equal(preview.bones[1], R.bones[1]);
  assert.equal(preview.bones[0].img.c.width, 10);
  assert.equal(lib.preview(R, 'back').bones[0].img.c.width, 11);
  lib.state = null;
  assert.equal(lib.preview(R, 'front'), R);
  assert.equal(JSON.stringify(state.rigs), before);
  assert.equal(state.artDirty.size, 0);
});

test('Apply packs both views sharing a sheet and isolates shared images in one transaction', () => {
  const { lib, state, group } = fixture();
  const old = state.rigs.test;
  lib.apply();
  assert.equal(group().steps.length, 1, 'one shared sheet');
  assert.equal(JSON.parse(group().snapshot.before).R.test.front.bones[0].i, 0);
  const next = JSON.parse(group().snapshot.after).R.test;
  for (const view of ['front', 'back']) {
    assert.equal(next[view].bones[0].i, 1);
    assert.equal(next[view].bones[1].i, 0, 'unselected sibling keeps its picture');
    assert.equal(next[view].bones[0].a, 'armL');
    assert.deepEqual(next[view].bones[0].at, [-5, 0]);
    assert.deepEqual(next[view].size, [64, 73]);
  }
  assert.equal(old.front.imgs.length, 1, 'original snapshot not mutated');
  assert.deepEqual(next.front.imgs[1].f.main, [1, 41, 10, 14]);
  assert.deepEqual(next.back.imgs[1].f.main, [1, 57, 11, 15]);
  assert.equal(lib.state, null);
});

test('Apply refuses stale pixels and a restored or different species rig', () => {
  const { lib, state, sheet, group } = fixture();
  sheet._ver = 1;
  lib.apply();
  assert.equal(group(), undefined);
  assert.equal(state.artDirty.size, 0);
  state.rigs = JSON.parse(JSON.stringify(state.rigs));
  assert.equal(lib.active(), null);
});

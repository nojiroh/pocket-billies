// Studio plan Phase 5, T5.2: the Parts Library's swap as one change (logic/rig-swap.js; it used to cut the Studio's
// workbench-species.js apart as a string). A small rig whose two arms share one picture and whose views share one
// sheet: the slots and pairs, both views packed below the shared sheet in one go, the sibling keeping its picture, the
// inputs untouched. The real species are in rig-swap.test.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rigSwapApply, rigSwapPair, rigSwapSlot } from '../../game/js/logic/rig-swap.js';

const boneSlot = b => (b.n.startsWith('arm') ? 'front' : b.n === 'tail' ? 'sig' : null);
const blank = (w, h, v = 0) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(v) });
const meta = () => ({
  k: 1,
  sheet: 'test.png',
  size: [64, 40],
  geo: { top: 10, mid: 20, cy: 20, hw: 8 },
  imgs: [{ ox: -4, oy: -1, f: { main: [1, 1, 8, 12] } }],
  bones: [
    { n: 'armL', par: 'torso', at: [-5, 0], i: 0, z: 8, a: 'armL' },
    { n: 'armR', par: 'torso', at: [5, 0], i: 0, z: 8, a: 'armR' },
  ],
});
const fixture = () => ({ rig: { front: meta(), back: meta() }, sheets: new Map([['art/test.png', blank(64, 40, 7)]]) });
const geoOf = M => ({ top: 0, mid: 0, cy: 0, hw: M.imgs.length });

test('the library files bones by slot and pairs only an existing sibling', () => {
  const { rig } = fixture();
  assert.equal(rigSwapSlot({ n: 'armL' }, boneSlot), 'front');
  assert.equal(rigSwapSlot({ n: 'tail' }, boneSlot), 'sig');
  assert.equal(rigSwapSlot({ n: 'earL' }, boneSlot), 'headExtra');
  assert.equal(rigSwapSlot({ n: 'shell' }, boneSlot), 'bodyExtra');
  assert.equal(rigSwapPair(rig.front, 'armL').n, 'armR');
  rig.front.bones[1].par = 'other';
  assert.equal(rigSwapPair(rig.front, 'armL'), null);
  assert.equal(
    rigSwapPair(
      {
        bones: [
          { n: 'legBN', par: 't', i: 0 },
          { n: 'legBF', par: 't', i: 0 },
        ],
      },
      'legBN'
    ).n,
    'legBF'
  );
});

test('one swap packs both views below their shared sheet, isolates the shared picture and leaves the inputs', () => {
  const { rig, sheets } = fixture(),
    before = JSON.stringify(rig),
    { rig: next, sheets: out } = rigSwapApply(
      rig,
      sheets,
      () => 'art/test.png',
      [
        { view: 'front', bone: 'armL', frames: { main: blank(10, 14, 200) }, ox: -5, oy: -2, at: {}, needs: [] },
        { view: 'back', bone: 'armL', frames: { main: blank(11, 15, 100) }, ox: -6, oy: -3, at: {}, needs: [] },
      ],
      geoOf
    );
  assert.equal(JSON.stringify(rig), before, 'the input rig is not changed');
  assert.equal(sheets.get('art/test.png').height, 40, 'the input sheet is not changed');
  for (const view of ['front', 'back']) {
    assert.equal(next[view].bones[0].i, 1);
    assert.equal(next[view].bones[1].i, 0, 'the sibling keeps its picture');
    assert.equal(next[view].bones[0].a, 'armL');
    assert.deepEqual(next[view].size, [64, 73]);
    assert.equal(next[view].geo.hw, 9, 'geo moves by what changed (one picture more)');
  }
  assert.deepEqual(next.front.imgs[1].f.main, [1, 41, 10, 14]);
  assert.deepEqual(next.back.imgs[1].f.main, [1, 57, 11, 15]);
  const S = out.get('art/test.png');
  assert.deepEqual([S.width, S.height], [64, 73]);
  assert.equal(S.data[(41 * 64 + 1) * 4], 200);
  assert.equal(S.data[(57 * 64 + 1) * 4], 100);
  assert.equal(S.data[(5 * 64 + 5) * 4], 7, 'the old pixels stay');
});

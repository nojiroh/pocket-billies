// Studio plan Phase 5, T5.3: the rig consistency checks (logic/data-checks.js dataRigs), which check-data and the
// Studio's Check both run: none on the game's rigs; each planted fault on a real rig (musk0) is named.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { dataRigs } from '../../game/js/logic/data-checks.js';
import { RIG_NEUTRAL_POSE, rigGeo } from '../../game/js/logic/rig-joints.js';
import { animFor } from '../../game/js/body-plan-animation.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const src = readFileSync(join(ROOT, 'game/art/next/rigs-next.js'), 'utf8');
const RIGS = JSON.parse(src.slice(src.indexOf('RIGS_NEXT=') + 10).replace(/;\s*$/, ''));
const sheetSize = sheet => {
  const b = readFileSync(join(ROOT, 'game/art', sheet)).subarray(16, 24);
  return [b.readUInt32BE(0), b.readUInt32BE(4)];
};
const geoOf = (M, view) =>
  rigGeo(M, view, animFor(M.plan, M.q || {})(RIG_NEUTRAL_POSE, view === 'back') || {}, RIG_NEUTRAL_POSE);
const one = plant => {
  const R = JSON.parse(JSON.stringify(RIGS.musk0));
  plant(R);
  return dataRigs({ musk0: R }, sheetSize, geoOf).map(([f, m]) => `${f}: ${m}`);
};

test("the game's rigs hold together", () => {
  assert.deepEqual(dataRigs(RIGS, sheetSize, geoOf), []);
});

test('each planted fault is named, and only it', () => {
  const cases = [
    [R => (R.front.imgs[0].f.main[0] = 9999), 'musk0 front: picture 0 main [9999,'],
    [R => (R.front.size = [10, 10]), 'musk0 size is 10,10 in front and'],
    [R => (R.back.bones.find(b => b.n === 'head').par = 'neck'), 'musk0 back: head hangs from neck, no such bone'],
    [R => R.back.bones.pop(), 'musk0 front and back have different bones'],
    [R => (R.front.bones[0].i = 99), 'musk0 front: torso shows picture 99'],
    [R => (R.front.geo.mid += 3), 'musk0 front: geo mid'],
    [
      R => ((R.front.geo.top = 0), (R.front.geo.mid = R.front.geo.cy = R.front.base / 2)),
      'musk0 front: geo top 0 is above every picture',
    ],
    [R => (R.back.geo.cx += 1), 'musk0 back: geo cx, base, k are'],
    [R => delete R.front.geo, 'musk0 front: has no geo'],
  ];
  for (const [plant, want] of cases) {
    const got = one(plant);
    assert.ok(got.length >= 1 && got.every(m => m.startsWith('art/next/rigs-next.js: ')), `${want}: ${got}`);
    assert.ok(
      got.some(m => m.includes(want)),
      `${want}: ${got}`
    );
  }
  const sz = one(R => (R.front.size = R.back.size = [10, 10]));
  assert.ok(
    sz.some(m => m.includes('musk0 front: size 10,10, but its sheet next/billionaires/emberox.png is')),
    sz.join('\n')
  );
});

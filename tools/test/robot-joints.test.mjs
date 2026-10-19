// Studio track ST-5: robot joints. robotRig places every robot as it did before sockets could be stored (all 972
// builds, with their pictures and as stand-ins, front and back), and stored joints move the pictures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { robotArt, setPictures, robotBuilds, rigHash } from './robot-rig-node.mjs';

const BEFORE = JSON.parse(readFileSync(new URL('./robot-rig-before.json', import.meta.url), 'utf8'));
const clone = o => JSON.parse(JSON.stringify(o));
const bare = D => {
  const out = clone(D);
  for (const p of Object.values(out.parts)) for (const k of ['img', 'imgB', 'head', 'headB']) delete p.art[k];
  for (const g of Object.values(out.gems)) delete g.img;
  return out;
};
/* the builds whose rig differs from before, in a view */
function changed(D, sizes, want, k) {
  setPictures(sizes);
  return robotBuilds(D).filter(sp => rigHash(robotArt.robotRig(sp, D, k)) !== want[sp]);
}

test('robotRig with nothing stored places every build as before, with pictures and as stand-ins, front and back', () => {
  assert.equal(robotBuilds(BEFORE.data).length, 972);
  for (const k of [1, 2]) {
    assert.deepEqual(changed(BEFORE.data, BEFORE.sizes, BEFORE.pictures, k), []);
    assert.deepEqual(changed(bare(BEFORE.data), {}, BEFORE.standIns, k), []);
  }
});

// The ground painter's helper thread (game/js/ground-paint-worker.js): its source is the painter's functions sent as
// text (paintWorkerSource), so a helper the painter calls that isn't in the list is a ReferenceError on every job and
// every square of ground is painted on the page instead (e89c8131 moved the tile pick into groundTileRole and the
// helper lost it). Run the source in a sandbox and ask for every walk-view.js name its functions use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import './walk-renderer.mjs';

const walkView = await import('../../game/js/walk-view.js');
await import('../../game/js/ground-paint-worker.js');
// not exported: the test globals' bridge (game/js/test-globals.js) has it
const { paintWorkerSource } = /** @type {any} */ (globalThis);

test('the painter helper source defines every walk-view.js name its functions use', () => {
  const src = paintWorkerSource();
  const box = { postMessage() {}, setTimeout() {}, performance: { now: () => 0 } };
  vm.createContext(box);
  vm.runInContext(
    src + '\n;globalThis.__has=n=>{try{return typeof eval(n)!=="undefined"}catch(e){return false}};',
    box
  );
  const words = new Set(src.match(/[A-Za-z_$][\w$]*/g)),
    /* a name behind `typeof name` is optional there (cliffEdgeLook: the main thread sends its result as `ce`) */
    guarded = new Set([...src.matchAll(/typeof ([A-Za-z_$][\w$]*)/g)].map(m => m[1])),
    missing = Object.keys(walkView).filter(k => words.has(k) && !guarded.has(k) && !box.__has(k));
  assert.deepEqual(missing, [], 'walk-view.js names the helper uses but its source leaves out');
  assert.equal(box.__has('groundTileRole'), true, 'the tile pick (groundTileRole)');
  assert.equal(box.__has('GROUND_DETAIL_TILES'), true);
});

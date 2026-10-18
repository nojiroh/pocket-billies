// Phase 17: the robot balance simulation (tools/test/sim/robot-sim.mjs) runs on a sample of builds and reports what
// the full run reports. Its bounds are the owner's call (docs/phases/17-robots.md), so this checks that it works,
// not the balance: run node tools/test/sim/robot-sim.mjs for the numbers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allBuilds, simulate } from './sim/robot-sim.mjs';

test('robot sim: every build the data allows, a sample of them fought to the end, a report per build and part', () => {
  assert.equal(allBuilds().length, 3 * 3 * 6 * 6 * 3);
  const R = simulate({ every: 97 });
  assert.equal(R.builds, 11);
  for (const [, x, y] of [...R.best, ...R.worst]) assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1);
  assert.ok(R.robotsVsBillies > 0, 'robots never beat a Billie');
  assert.ok(Object.keys(R.parts).length >= 10);
});

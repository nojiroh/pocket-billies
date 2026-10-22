// RL-10: the breeding simulation (tools/test/sim/breeding-sim.mjs) runs on a few eggs a pair and reports what the full
// run reports. Its bounds are the owner's call (roguelite-track.md, RL-10), so this checks that it works, not the
// balance: run node tools/test/sim/breeding-sim.mjs for the numbers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { simulate } from './sim/breeding-sim.mjs';

test('breeding sim: every pair of lines breeds, risky eggs come out as all three kinds, the battles are fought', () => {
  const R = simulate({ eggs: 6, battles: 1 });
  assert.equal(R.risky, R.pairs * 6);
  assert.ok(R.got.safe > 0 && R.got.quirk > 0 && R.got.abom > 0, JSON.stringify(R.got));
  assert.ok(Math.abs(R.got.safe + R.got.quirk + R.got.abom - 1) < 0.01);
  for (const k of ['control', 'abomVsPlain', 'abomVsTwin', 'quirkVsPlain', 'quirkVsTwin'])
    assert.ok(R.wins[k] >= 0 && R.wins[k] <= 1, k);
  assert.ok(R.wins.battles > 0 && R.abomNames > 0);
});

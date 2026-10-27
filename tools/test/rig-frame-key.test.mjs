// Phase 20 R3 (the battle lane): skeleton-rig.js rigFrameKey, the key battle-stage.js keeps a rig's
// canvas by. Two battle frames with the same key must get the same pose from rigFrame (a reused canvas never shows a
// stale pose), and an idle rig at 60 frames a second must change key far less often than every frame (or there is
// nothing to reuse). Numbers only: rigFrame's pose objects, no drawing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './robot-rig-node.mjs';

globalThis.requestAnimationFrame ??= () => 0;
const { rigFrame, rigFrameKey } = await import('../../game/js/skeleton-rig.js');

const RIGS = {
  'clock 12, lagging': { clock: 12, lag: true },
  'clock 12': { clock: 12, lag: false },
  'no clock': { clock: 0 },
};
const ACTS = [null, 'attack', 'hurt', 'faint', 'cast', 'cheer', 'buff', 'dizzy', 'walk'];
/* a battle's frames as actorBuffer sees them: 60 a second, the time in 16 ms steps, an action starting at 700 ms */
function frames(act, ms = 4000) {
  const out = [];
  for (let bt = 0; bt < ms; bt += 1000 / 60) {
    const tau = act && bt >= 700 ? bt - 700 : 0;
    out.push({ act: act && bt >= 700 ? act : null, tau, t: Math.floor(bt / 16) * 16 });
  }
  return out;
}

test('frames with the same key get the same pose from rigFrame', () => {
  for (const [name, R] of Object.entries(RIGS))
    for (const act of ACTS)
      for (const seed of [0, 7]) {
        const seen = new Map();
        for (const f of frames(act)) {
          const key = rigFrameKey(R, f.act, f.tau, f.t, seed),
            pose = JSON.stringify(rigFrame(R, f.act, f.tau, f.t, seed));
          if (!seen.has(key)) seen.set(key, pose);
          else assert.equal(pose, seen.get(key), `${name}, ${act}, seed ${seed}: key ${key} at t ${f.t}`);
        }
      }
});

test('an idle rig with a clock changes key about 10 times a second, not 60', () => {
  for (const R of [RIGS['clock 12'], RIGS['clock 12, lagging']]) {
    const F = frames(null, 6000),
      keys = new Set(F.map(f => rigFrameKey(R, f.act, f.tau, f.t, 3)));
    assert.ok(keys.size < F.length / 4, `${keys.size} keys for ${F.length} frames`);
    assert.ok(keys.size >= 6 * 6, `${keys.size} keys in 6 s: the pose (every 167 ms) and the face (every 250 ms) move`);
  }
});

test('the key differs between actions, seeds and rigs with different clocks', () => {
  const R = RIGS['clock 12'];
  assert.notEqual(rigFrameKey(R, 'attack', 100, 800, 1), rigFrameKey(R, 'hurt', 100, 800, 1));
  assert.notEqual(rigFrameKey(R, null, 0, 800, 1), rigFrameKey(R, null, 0, 800, 2));
  assert.notEqual(rigFrameKey(R, null, 0, 800, 1), rigFrameKey({ clock: 0 }, null, 0, 800, 1));
  assert.notEqual(rigFrameKey({ clock: 0 }, null, 0, 800, 1), rigFrameKey({ clock: 0 }, null, 0, 816, 1));
});

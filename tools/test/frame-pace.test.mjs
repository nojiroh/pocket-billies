// Fluid track FL-1a: the frame scheduler's pacing (game/js/logic/frame-pace.js) and the automatic quality's feed,
// against a made-up screen: ticks come on the screen's refreshes (vsync), a tick that draws takes its work, and the
// next tick is the first refresh after the work ends (as a browser's requestAnimationFrame does). No graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ladderFeed,
  ladderTake,
  paceDue,
  paceSlot,
  paceTask,
  phoneAgent,
  refreshPeriod,
  refreshTick,
  refreshTracker,
} from '../../game/js/logic/frame-pace.js';
import { qualityStep } from '../../game/js/logic/quality-step.js';

/**
 * Run the scheduler on a screen.
 * @param {object} o
 * @param {number|((t: number) => number)} o.hz the screen's rate (a function of time for a change)
 * @param {number|((t: number) => number)} o.cap the task's rate asked
 * @param {(n: number, t: number) => number} o.work a drawn frame's work (ms), by its number and time
 * @param {number} o.ms how long (ms)
 * @param {(f: object) => void} [o.onFrame] each drawn frame: { t, dt, shown, missed, V, cap, work }
 * @param {boolean} [o.half]
 */
function simulate(o) {
  const hzAt = typeof o.hz === 'function' ? o.hz : () => o.hz,
    capAt = typeof o.cap === 'function' ? o.cap : () => o.cap,
    R = refreshTracker(),
    T = paceTask(),
    frames = [];
  let t = 0,
    vs = 0,
    work = 0,
    n = 0;
  while (t < o.ms) {
    refreshTick(R, t, work);
    const cap = capAt(t),
      dt = paceDue(T, t, cap, R.V, o.half);
    work = 0.1;
    if (dt >= 0) {
      work = o.work(n++, t);
      const f = { t, dt, shown: T.shown, missed: T.missed, V: R.V, cap, work };
      frames.push(f);
      if (o.onFrame) o.onFrame(f);
    }
    // the next tick: the first refresh after the work ends
    const end = t + work;
    do {
      vs += 1000 / hzAt(vs);
    } while (vs <= end);
    t = vs;
  }
  return { frames, R, T };
}
const near = (a, b, e = 0.05) => Math.abs(a - b) <= e;

test('the refresh period: a low quarter of the deltas, near ones averaged; none snapped to a list', () => {
  assert.ok(near(refreshPeriod([16.39, 16.39, 16.4, 32.8, 16.38]), 16.39, 0.02));
  assert.ok(near(refreshPeriod([8.33, 8.33, 16.67, 8.33, 25, 8.33]), 8.33, 0.01));
  assert.equal(refreshPeriod([]), 0);
});

test('a rate as whole refreshes: 60 on 120 is 2, on 165 is 3, on 61 is 1; the half rate doubles it', () => {
  assert.equal(paceSlot(60, 1000 / 120), 2);
  assert.equal(paceSlot(60, 1000 / 165), 3);
  assert.equal(paceSlot(60, 1000 / 61), 1);
  assert.equal(paceSlot(120, 1000 / 60), 1);
  assert.equal(paceSlot(1, 1000 / 60), 60);
  assert.equal(paceSlot(60, 1000 / 60, true), 2);
  assert.equal(paceSlot(60, 1000 / 120, true), 4);
});

test('gate: 120 Hz, cap 60, one miss gives 16.7 / 25 / 16.7, never 8.3', () => {
  let missAt = -1;
  const { frames } = simulate({
    hz: 120,
    cap: 60,
    ms: 3000,
    work: (n, t) => (t > 2000 && missAt < 0 ? ((missAt = n), 20) : 5),
  });
  const after = frames.filter(f => f.t > 1000).map(f => f.dt);
  assert.ok(missAt > 0);
  assert.ok(
    after.every(d => d > 12),
    `an interval under a slot: ${after.filter(d => d <= 12)}`
  );
  assert.equal(after.filter(d => near(d, 25, 0.1)).length, 1, 'one 25 ms interval');
  assert.ok(
    after.filter(d => !near(d, 25, 0.1)).every(d => near(d, 1000 / 60, 0.1)),
    'the rest 16.7 ms'
  );
  const late = frames.find(f => f.t > 1000 && near(f.dt, 25, 0.1));
  assert.equal(late.shown, 3);
  assert.equal(late.missed, true);
});

test('gate: a 61 Hz panel drops no frame in 10 s', () => {
  const { frames, R } = simulate({ hz: 61, cap: 60, ms: 10000, work: () => 6 });
  assert.ok(near(1000 / R.V, 61, 0.05), `read ${1000 / R.V} Hz`);
  const late = frames.filter(f => f.t > 500 && f.dt > 1000 / 61 + 1);
  assert.equal(late.length, 0, `${late.length} drops`);
});

test('gate: a 120 -> 60 change (the browser halving the page) is read again within 1 s', () => {
  let seen = 0;
  const { R } = simulate({
    hz: t => (t < 3000 ? 120 : 60),
    cap: 60,
    ms: 6000,
    work: () => 5,
    onFrame: f => {
      if (!seen && f.t >= 3000 && near(f.V, 1000 / 60, 0.2)) seen = f.t;
    },
  });
  assert.ok(seen > 0 && seen - 3000 < 1000, `read at ${seen - 3000} ms`);
  assert.ok(near(R.V, 1000 / 60, 0.1));
  assert.equal(R.hz, 60);
});

test('the refresh is read at 120 Hz even when every tick draws (the old reading froze)', () => {
  const { R } = simulate({ hz: 120, cap: 120, ms: 2000, work: () => 6 });
  assert.equal(R.hz, 120);
});

test('gate: every frame 40 ms of work gives a steady interval (a whole divisor), the refresh kept', () => {
  const { frames, R } = simulate({ hz: 60, cap: 60, ms: 5000, work: () => 40 });
  const d = frames.filter(f => f.t > 500).map(f => f.dt);
  assert.ok(
    d.every(x => near(x, 50, 0.1)),
    `intervals ${[...new Set(d.map(x => x.toFixed(1)))]}`
  );
  assert.equal(R.hz, 60);
});

test('a change of rate starts the beat at once (the screen 1 a second, then back)', () => {
  const T = paceTask(),
    V = 1000 / 60;
  assert.ok(paceDue(T, 0, 1, V) >= 0);
  assert.equal(paceDue(T, 100, 1, V), -1);
  assert.ok(paceDue(T, 116.7, 60, V) >= 0, 'due at once after the cap lifts');
});

/** the walk view's automatic quality, fed as walk/quality-cull.js adaptQuality feeds it */
function ladderRun({ hz, ms, work, cap, phone }) {
  const s = { q: 0, R: 1 },
    feed = ladderFeed(),
    steps = [];
  simulate({
    hz,
    cap,
    ms,
    work: () => work,
    onFrame: f => {
      const took = ladderTake(feed, { cap: f.cap, aim: 60, V: f.V, now: f.t, dtm: f.dt, work: f.work });
      if (!took || f.cap < 30) return;
      const q0 = s.q,
        r0 = s.R;
      qualityStep(s, { ...took, now: f.t, phone });
      if (s.q !== q0 || s.R !== r0) steps.push([f.t, s.q, s.R]);
    },
  });
  return { s, steps };
}

test('gate: 8 window and screen open/close cycles at 11 ms of work leave q and R alone', () => {
  for (const phone of [false, true]) {
    // each cycle: 4 s walking, 3 s behind a window (20), 4 s walking, 5 s behind a screen (24, then 1 after 0.8 s)
    const cyc = 16000,
      cap = t => {
        const c = t % cyc;
        if (c < 4000) return 60;
        if (c < 7000) return 20;
        if (c < 11000) return 60;
        return c < 11800 ? 24 : 1;
      };
    const { s, steps } = ladderRun({ hz: 60, ms: cyc * 8, work: 11, cap, phone });
    assert.deepEqual(steps, [], `${phone ? 'phone' : 'desktop'} stepped: ${JSON.stringify(steps)}`);
    assert.equal(s.q, 0);
    assert.equal(s.R, 1);
  }
});

test('gate: 60 on a 90 Hz screen at 5 ms of work takes no step in 60 s', () => {
  const { s, steps } = ladderRun({ hz: 90, ms: 60000, work: 5, cap: () => 60, phone: true });
  assert.deepEqual(steps, []);
  assert.equal(s.q, 0);
});

test('a slow frame is still read as slow (the feed hides only what it should)', () => {
  const { s } = ladderRun({ hz: 60, ms: 30000, work: 30, cap: () => 60, phone: false });
  assert.ok(s.q > 0, `q ${s.q}`);
});

test('the counted tick is not fed to the automatic quality', () => {
  const f = ladderFeed(),
    i = { cap: 60, aim: 60, V: 1000 / 60, dtm: 16.7, work: 5 };
  ladderTake(f, { ...i, now: 0 });
  assert.ok(ladderTake(f, { ...i, now: 2000 }));
  assert.equal(ladderTake(f, { ...i, now: 2016, counted: true, work: 50 }), null);
  assert.ok(f.slow < 6);
});

test('one phone test: Android, iPhone, iPad and an iPad that says it is a Mac', () => {
  assert.equal(phoneAgent('Mozilla/5.0 (Linux; Android 14)'), true);
  assert.equal(phoneAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), true);
  assert.equal(phoneAgent('Mozilla/5.0 (iPad; CPU OS 12_0)'), true);
  assert.equal(phoneAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5), true);
  assert.equal(phoneAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0), false);
  assert.equal(phoneAgent('Mozilla/5.0 (Windows NT 10.0)'), false);
});

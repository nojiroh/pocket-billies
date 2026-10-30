// Fluid track FL-3a: the automatic quality's controller (game/js/logic/frame-control.js) on made-up traces. A frame's
// cost is split into main-thread work and graphics-chip time, each lowered by the levers the way the game's are meant
// to (q and the resolution lower the chip's time, c the main thread's); a frame shows on the first refresh of its
// slot that both have finished by, and the fence lag says how far the chip is behind. No graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  controlBottleneck,
  controlFrame,
  controlQuantile,
  controlRestore,
  controlSaved,
  frameControl,
} from '../../game/js/logic/frame-control.js';

/**
 * @param {object} o
 * @param {number} [o.hz] the screen's refresh (60)
 * @param {number} [o.fps] the set rate (60)
 * @param {number} o.ms how long (ms)
 * @param {(t: number, n: number) => number} o.cpu the frame's main-thread work at the top levels (ms)
 * @param {(t: number, n: number) => number} o.gpu the frame's graphics time at the top levels (ms)
 * @param {boolean} [o.phone]
 * @param {boolean} [o.noLag] the fence lag unknown
 * @param {object} [o.state]
 */
function play(o) {
  const V = 1000 / (o.hz || 60),
    s = o.state || frameControl(),
    steps = [];
  let t = 0,
    n = 0,
    last = 0;
  while (t < o.ms) {
    const lv = s.lv,
      k = Math.max(1, Math.round((o.hz || 60) / (o.fps || 60))) * (lv.half ? 2 : 1),
      slot = k * V,
      cpu = o.cpu(t, n) * (1 - 0.12 * lv.c),
      gpu = o.gpu(t, n) * (1 - 0.1 * lv.q) * lv.R * lv.R,
      cost = Math.max(cpu, gpu),
      gap = Math.max(slot, Math.ceil((cost - 0.5) / V) * V),
      lag = gpu > slot * 0.95 ? 2 : gpu > slot * 0.6 ? 1 : 0;
    t += gap;
    const dt = n ? gap : slot;
    const r = controlFrame(s, {
      now: t,
      dt,
      work: o.phone ? cost : cpu,
      lag: o.noLag ? -1 : lag,
      slot,
      V,
      phone: o.phone,
      floorR: o.phone ? 0.6 : 0.5,
    });
    if (r) steps.push({ t, ...r, lv: { ...s.lv } });
    last = t;
    n++;
  }
  return { s, steps, ms: last };
}

test('one-off spikes take no step', () => {
  const { steps } = play({
    ms: 60000,
    cpu: (t, n) => (n % 120 === 60 ? 45 : 7),
    gpu: () => 8,
  });
  assert.deepEqual(
    steps.filter(x => x.act !== 'up'),
    []
  );
});

test('two spikes close together are still one-offs at most once a second', () => {
  const { steps } = play({
    ms: 30000,
    cpu: (t, n) => (n % 90 === 10 || n % 90 === 40 ? 30 : 7),
    gpu: () => 8,
  });
  assert.equal(steps.filter(x => x.act === 'down').length, 0);
});

test('a sustained miss takes a step within 1 s', () => {
  for (const [cpu, gpu] of [
    [22, 6],
    [6, 24],
    [20, 20],
  ]) {
    const { steps } = play({ ms: 8000, cpu: t => (t < 5000 ? 6 : cpu), gpu: t => (t < 5000 ? 6 : gpu) });
    const first = steps.find(x => x.act === 'down');
    assert.ok(first, `a step for cpu ${cpu} gpu ${gpu}`);
    assert.ok(first.t - 5000 <= 1000, `within 1 s: ${first.t - 5000} ms (cpu ${cpu} gpu ${gpu})`);
  }
});

test('at most one revert in 30 s when the top level just misses', () => {
  /* the chip at q0 needs 18 ms (misses at 60), at q1 16.2 (fits); the main thread is light */
  const { s, steps } = play({ ms: 180000, cpu: () => 5, gpu: () => 18 });
  const reverts = steps.filter(x => x.act === 'revert').map(x => x.t);
  for (const r of reverts) assert.ok(reverts.filter(x => x >= r && x < r + 30000).length <= 1, String(reverts));
  assert.ok(s.lv.q >= 1, 'holds the level that fits');
  /* the hold doubles: the reverts get further apart */
  for (let k = 2; k < reverts.length; k++) assert.ok(reverts[k] - reverts[k - 1] > reverts[k - 1] - reverts[k - 2]);
});

test('a GPU-bound trace moves only GPU levers', () => {
  const { s, steps } = play({ ms: 60000, cpu: () => 5, gpu: () => 34 });
  assert.equal(s.lv.c, 0);
  assert.ok(
    steps.some(x => x.lever === 'R'),
    'the resolution goes down'
  );
  assert.ok(steps.every(x => x.lever !== 'c'));
});

test('a CPU-bound trace leaves the resolution alone', () => {
  for (const phone of [false, true]) {
    const { s, steps } = play({ ms: 60000, cpu: () => 26, gpu: () => 6, phone });
    assert.equal(s.lv.R, 1, `phone ${phone}`);
    assert.ok(steps.every(x => x.lever !== 'R'));
    assert.ok(s.lv.c > 0, 'the CPU level goes down');
  }
});

test('at the floor and still missing: the steady half rate, and back when there is room', () => {
  const { s, steps } = play({ ms: 40000, cpu: t => (t < 20000 ? 40 : 6), gpu: () => 6 });
  const on = steps.find(x => x.lever === 'half' && x.act === 'down');
  assert.ok(on, 'half rate on');
  assert.ok(on.t < 15000);
  assert.equal(s.lv.half, false, 'off again once the work drops');
  /* while the half rate holds, frames come on a steady 33.3 ms */
  const r = play({ ms: 20000, cpu: () => 28, gpu: () => 6, state: frameControl({ c: 3, q: 2, half: true }) });
  assert.equal(r.s.lv.half, true);
  assert.equal(r.steps.filter(x => x.act === 'revert' || x.act === 'down').length, 0);
});

test('a light frame climbs back to the top, slowly', () => {
  const { s, steps } = play({ ms: 60000, cpu: () => 4, gpu: () => 4, state: controlRestore({ q: 4, c: 3, R: 0.7 }) });
  assert.deepEqual({ q: s.lv.q, c: s.lv.c, R: s.lv.R }, { q: 0, c: 0, R: 1 });
  const ups = steps.filter(x => x.act === 'up').map(x => x.t);
  for (let k = 1; k < ups.length; k++) assert.ok(ups[k] - ups[k - 1] >= 4000);
});

test('the thermal hold: two late step-downs within 2 minutes freeze climbing', () => {
  const { s } = play({
    ms: 100000,
    cpu: () => 5,
    /* the chip slows down at 20 s, again after a calm spell at 55 s, then cools at 80 s */
    gpu: t => (t < 20000 ? 10 : t < 55000 ? 18 : t < 80000 ? 20 : 8),
  });
  assert.ok(s.thermalT > 200000, 'held for 3 minutes from the second');
  assert.ok(s.lv.q >= 2, 'no climb during the hold');
});

test('the bottleneck from the ring', () => {
  const s = frameControl();
  for (let k = 0; k < 40; k++) controlFrame(s, { now: k * 16.7, dt: 16.7, work: 4, lag: 2, slot: 16.7, V: 16.7 });
  assert.equal(controlBottleneck(s, 16.7), 'gpu');
  const c = frameControl();
  for (let k = 0; k < 40; k++) controlFrame(c, { now: k * 16.7, dt: 16.7, work: 15, lag: 0, slot: 16.7, V: 16.7 });
  assert.equal(controlBottleneck(c, 16.7), 'cpu');
  /* a phone with no fence: high work may be the chip's wait */
  const p = frameControl();
  for (let k = 0; k < 40; k++) controlFrame(p, { now: k * 16.7, dt: 16.7, work: 15, lag: -1, slot: 16.7, V: 16.7 });
  assert.equal(controlBottleneck(p, 16.7, true), 'mixed');
  assert.equal(controlBottleneck(p, 16.7, false), 'cpu');
});

test('frames with a one-off job and the frame after are left out', () => {
  const s = frameControl();
  let t = 0;
  for (let k = 0; k < 600; k++) {
    const one = k % 10 === 0;
    t += one ? 16.7 : k % 10 === 1 ? 70 : 16.7;
    controlFrame(s, {
      now: t,
      dt: k % 10 === 1 ? 70 : 16.7,
      work: one ? 60 : 5,
      lag: 0,
      slot: 16.7,
      V: 16.7,
      skip: one,
    });
  }
  assert.equal(s.downs, 0);
});

test('the levels kept per place kind come back with a stack to climb', () => {
  const s = frameControl();
  s.lv = { q: 3, c: 1, R: 0.8, half: true };
  s.taken = ['q', 'q', 'c', 'q', 'R', 'R', 'half'];
  const kept = JSON.parse(JSON.stringify(controlSaved(s)));
  const r = controlRestore(kept);
  assert.deepEqual(r.lv, { q: 3, c: 1, R: 0.8, half: false });
  assert.deepEqual(r.taken, ['q', 'q', 'c', 'q', 'R', 'R']);
  /* a stack that doesn't match the levels is made to */
  const b = controlRestore({ q: 2, c: 0, R: 0.9, taken: ['c', 'c', 'q'] });
  assert.equal(b.taken.filter(x => x === 'q').length, 2);
  assert.equal(b.taken.filter(x => x === 'R').length, 1);
  assert.equal(b.taken.filter(x => x === 'c').length, 0);
  /* rubbish in: the top */
  assert.deepEqual(controlRestore('x').lv, { q: 0, c: 0, R: 1, half: false });
  assert.deepEqual(controlRestore({ q: 99, R: -3 }).lv, { q: 4, c: 0, R: 0.5, half: false });
});

test('controlQuantile', () => {
  const a = new Float32Array([5, 1, -1, 3]);
  assert.equal(controlQuantile(a, 4, 0.5), 3);
  assert.equal(controlQuantile(a, 4, 0, true), 1);
  assert.equal(controlQuantile(a, 0, 0.5), -1);
});

test('the battle ladder: one lever list, then the half rate', () => {
  const s = frameControl();
  let t = 0;
  const seen = [];
  for (let k = 0; k < 1500; k++) {
    const slot = s.lv.half ? 33.3 : 16.7,
      cost = 30 * (1 - 0.1 * s.lv.q),
      gap = Math.max(slot, Math.ceil(cost / 16.7) * 16.7);
    t += gap;
    const r = controlFrame(s, { now: t, dt: gap, work: cost, slot, V: 16.7, levers: 'one' });
    if (r) seen.push(r.lever);
  }
  assert.ok(seen.every(l => l === 'q' || l === 'half' || l === ''));
  assert.equal(s.lv.half, true);
  assert.equal(s.lv.R, 1);
});

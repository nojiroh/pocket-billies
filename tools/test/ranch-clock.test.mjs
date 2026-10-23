// RL-10b: logic/ranch-clock.js, the one clock every ranch timer reads: the high-water mark, a clock turned back
// (time stands still at the mark), the cloud save's server time raising the mark, and the phone clock's skew.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-fixture.mjs';

const { ranchNow, ranchAnchor, clockSkew } = modules['ranch-clock'],
  R = { guardMs: 60000 },
  H = 3600000;
const save = (seen = 0) => ({ ranch: { seen } });

test('ranch clock: the phone time counts and raises the mark', () => {
  const s = save();
  assert.deepEqual(ranchNow(s, 5 * H, R), { now: 5 * H, back: false });
  assert.equal(s.ranch.seen, 5 * H);
  assert.deepEqual(ranchNow(s, 6 * H, R), { now: 6 * H, back: false });
  assert.equal(s.ranch.seen, 6 * H);
});

test('ranch clock: within guardMs behind the mark is the phone time, the mark kept', () => {
  const s = save(10 * H);
  assert.deepEqual(ranchNow(s, 10 * H - 30000, R), { now: 10 * H - 30000, back: false });
  assert.equal(s.ranch.seen, 10 * H, 'the mark never falls');
});

test('ranch clock: turned back further, time stands still at the mark until the clock passes it', () => {
  const s = save(10 * H);
  assert.deepEqual(ranchNow(s, 2 * H, R), { now: 10 * H, back: true });
  assert.equal(s.ranch.seen, 10 * H);
  // forward again: only the real time past the mark counts
  assert.deepEqual(ranchNow(s, 10 * H + 5, R), { now: 10 * H + 5, back: false });
});

test('ranch clock: the server time on the cloud save raises the mark, never lowers it', () => {
  const s = save(3 * H);
  ranchAnchor(s, 8 * H);
  assert.equal(s.ranch.seen, 8 * H);
  ranchAnchor(s, 4 * H);
  assert.equal(s.ranch.seen, 8 * H);
  for (const bad of [NaN, -1, 0, Infinity, undefined]) ranchAnchor(s, bad);
  assert.equal(s.ranch.seen, 8 * H);
  // a phone behind the server's last write is turned back
  assert.equal(ranchNow(s, 5 * H, R).back, true);
});

test('ranch clock: a phone set ahead counts at the server pace once the skew is known', () => {
  const s = save(),
    skew = clockSkew(30 * H, 30 * H + 400, 6 * H, R); // the phone 24 h ahead
  assert.equal(skew, 24 * H + 200);
  assert.equal(ranchNow(s, 30 * H + 1000, R, skew).now, 6 * H + 800);
  // and a phone behind the server counts forward to it
  assert.equal(clockSkew(H, H + 200, 3 * H, R), -2 * H + 100);
});

test('ranch clock: a skew under guardMs (the round trip) counts as none; nonsense counts as none', () => {
  assert.equal(clockSkew(1000, 1400, 1100, R), 0);
  assert.equal(clockSkew(1000, 1400, 1000 + 50000, R), 0);
  assert.equal(clockSkew(1000, 500, 1000 + 9 * H, R), 0, 'after before before');
  assert.equal(clockSkew(NaN, 1, 1, R), 0);
  assert.equal(ranchNow(save(), 7 * H, R, NaN).now, 7 * H);
});

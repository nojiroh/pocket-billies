// The automatic quality's step (game/js/logic/quality-step.js), fed the frame patterns of the owner's debug logs of
// 2026-10-23: the Android phone (frames 50-60 ms, nearly all of it main-thread time, as the GPU process's wait shows up
// there), the iPad (frames slow, main thread light), a fast desktop. No graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { propDrawFade, qualityStep } from '../../game/js/logic/quality-step.js';

const T = 1000 / 60;
/** run the step once a second for n seconds with the same numbers; returns the state */
function run(input, n, s = { q: 0, R: 1 }) {
  for (let k = 1; k <= n; k++) qualityStep(s, { target: T, now: k * 1300, ...input });
  return s;
}

test('a light frame on a fast machine keeps everything on', () => {
  const s = run({ int: 16.7, slow: 6 }, 30);
  assert.equal(s.q, 0);
  assert.equal(s.R, 1);
});

test('a slow frame with a light main thread (the iPad) takes the effects first, then the resolution', () => {
  const s = run({ int: 40, slow: 8 }, 30);
  assert.equal(s.q, 4);
  assert.ok(s.R < 1, `R ${s.R}`);
  assert.ok(s.R >= 0.5);
});

test('a slow frame with a busy main thread on a computer keeps the resolution and stops at step 2', () => {
  const s = run({ int: 40, slow: 30 }, 30, { q: 0, R: 0.8 });
  assert.equal(s.q, 2);
  assert.equal(s.R, 1);
});

test('it never steps more than once in 1.2 s', () => {
  const s = { q: 0, R: 1 };
  qualityStep(s, { int: 40, slow: 8, target: T, now: 5000 });
  qualityStep(s, { int: 40, slow: 8, target: T, now: 5500 });
  assert.equal(s.q, 1);
});

test('with room to spare it climbs back: resolution first, then the effects', () => {
  const s = run({ int: 16, slow: 4 }, 3, { q: 3, R: 0.7 });
  assert.ok(s.R > 0.7);
  assert.equal(s.q, 3);
  run({ int: 16, slow: 4 }, 30, s);
  assert.equal(s.R, 1);
  assert.equal(s.q, 0);
});

test('a phone whose frames look busy on the main thread (the Android phone) goes on to the graphics steps and the resolution', () => {
  const s = run({ int: 55, slow: 45, phone: true }, 40);
  assert.equal(s.q, 4);
  assert.ok(Math.abs(s.R - 0.6) < 1e-9, `R ${s.R}`);
});

test('on a phone the resolution is never raised just because the main thread looks busy', () => {
  const s = run({ int: 55, slow: 45, phone: true }, 3, { q: 1, R: 0.7 });
  assert.equal(s.R, 0.7);
});

test('a thing too small to see on screen is skipped everywhere', () => {
  const o = { minPx: 3, phoneDistance: 0, phone: false };
  assert.equal(propDrawFade({ r: 0.2, depth: 90, px: 2 }, o), 0);
  assert.equal(propDrawFade({ r: 0.2, depth: 20, px: 12 }, o), 1);
});

test('on a phone small things fade out over the last 8 m before the distance; big things and computers are untouched', () => {
  const o = { minPx: 3, phoneDistance: 48, phone: true };
  assert.equal(propDrawFade({ r: 0.4, depth: 30, px: 20 }, o), 1);
  assert.equal(propDrawFade({ r: 0.4, depth: 44, px: 10 }, o), 0.5);
  assert.equal(propDrawFade({ r: 0.4, depth: 60, px: 8 }, o), 0);
  assert.equal(propDrawFade({ r: 2.5, depth: 60, px: 40 }, o), 1);
  assert.equal(propDrawFade({ r: 0.4, depth: 60, px: 8 }, { ...o, phone: false }), 1);
  assert.equal(propDrawFade({ r: 0.4, depth: 60, px: 8 }, { ...o, phoneDistance: 0 }), 1);
});

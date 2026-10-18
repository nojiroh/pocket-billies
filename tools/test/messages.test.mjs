// Phase 06: how toasts queue, merge and time out (game/js/logic/messages.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fn, modules } from './setup-fixture.mjs';

const { TOAST_MS, TOAST_MS_BUSY, TOAST_MERGE_MS } = modules.messages;

const add = fn('toastAdd');

test('a new message queues; the same one again while it shows joins it', () => {
  const q = [];
  assert.equal(add(false, q, 'Saved', 0), 'new');
  const showing = q.shift();
  assert.equal(add(showing, q, 'Saved', 1000), 'showing');
  assert.equal(showing.count, 2);
  assert.equal(q.length, 0);
  assert.equal(fn('toastText')(showing), 'Saved ×2');
});

test('the same message after the merge window is a new toast', () => {
  const q = [];
  add(false, q, 'Saved', 0);
  const showing = q.shift();
  assert.equal(add(showing, q, 'Saved', TOAST_MERGE_MS + 1), 'new');
  assert.equal(q.length, 1);
});

test('a message joins the waiting one with the same text, not a different one', () => {
  const q = [];
  add(false, q, 'Found an item', 0);
  add(false, q, 'Kidling learned Leaf Toss', 10);
  assert.equal(add(false, q, 'Found an item', 20), 'queued');
  assert.equal(q.length, 2);
  assert.equal(fn('toastText')(q[0]), 'Found an item ×2');
  assert.equal(fn('toastText')(q[1]), 'Kidling learned Leaf Toss');
});

test('plain strings from older code still work, and toasts get shorter when many wait', () => {
  assert.deepEqual(fn('toastItem')('Hi', 5), { text: 'Hi', count: 1, at: 5 });
  assert.equal(fn('toastTime')(0), TOAST_MS);
  assert.equal(fn('toastTime')(3), TOAST_MS_BUSY);
});

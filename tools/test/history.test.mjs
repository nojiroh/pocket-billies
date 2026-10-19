// Studio track ST-2: the Studio's one undo (game/js/logic/history.js): data snapshots and picture patches in one
// order, the caps.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-real.mjs';

const H = modules.history;
const fresh = () => ({ undo: [], redo: [], last: null });
const patch = n => ({ x: 0, y: 0, width: 1, height: 1, data: new Uint8ClampedArray(n) });
const art = (name, n = 4) => ({ art: name, before: patch(n), after: patch(n) });

test('data steps undo and redo as before', () => {
  const h = fresh();
  assert.equal(H.historyCommit(h, 'a'), true);
  assert.equal(H.historyCommit(h, 'a'), false, 'no change, no step');
  H.historyCommit(h, 'b');
  assert.deepEqual(h.undo, ['a']);
  assert.deepEqual(H.historyUndo(h), { kind: 'data', snap: 'a' });
  assert.equal(h.last, 'a');
  assert.deepEqual(H.historyRedo(h), { kind: 'data', snap: 'b' });
  assert.equal(H.historyRedo(h), null);
  H.historyUndo(h);
  assert.equal(H.historyUndo(h), null, 'nothing before the first snapshot');
});

test('art and data steps come back in the order they were made', () => {
  const h = fresh(),
    p = art('sheet.png');
  H.historyCommit(h, 's0');
  H.historyCommit(h, 's1');
  H.historyArt(h, p);
  H.historyCommit(h, 's2');
  const u = [H.historyUndo(h), H.historyUndo(h), H.historyUndo(h)];
  assert.deepEqual(u[0], { kind: 'data', snap: 's1' });
  assert.equal(u[1].kind, 'art');
  assert.equal(u[1].put, p.before);
  assert.deepEqual(u[2], { kind: 'data', snap: 's0' });
  assert.equal(h.last, 's0');
  const r = [H.historyRedo(h), H.historyRedo(h), H.historyRedo(h)];
  assert.deepEqual(r[0], { kind: 'data', snap: 's1' });
  assert.equal(r[1].put, p.after);
  assert.deepEqual(r[2], { kind: 'data', snap: 's2' });
  assert.equal(h.last, 's2');
});

test('a new step drops the redo; the caps drop the oldest', () => {
  const h = fresh();
  H.historyCommit(h, 's0');
  H.historyArt(h, art('a'));
  H.historyUndo(h);
  assert.equal(h.redo.length, 1);
  H.historyArt(h, art('b'));
  assert.equal(h.redo.length, 0);
  for (let i = 0; i < 200; i++) H.historyCommit(h, 'x' + i);
  assert.equal(h.undo.length, H.HISTORY_STEPS);
  const big = fresh();
  for (let i = 0; i < 5; i++) H.historyArt(big, art('p' + i, H.HISTORY_ART_BYTES / 4));
  assert.equal(big.undo.length, 2, 'two steps of a quarter each fit, a third goes over');
  assert.equal(big.undo[1].art, 'p4');
});

test('a group of picture steps is one step, and counts all its pictures', () => {
  const h = { undo: [], redo: [], last: null },
    px = n => ({ x: 0, y: 0, width: n, height: 1, data: new Uint8ClampedArray(n * 4) }),
    a = { art: 'art/a.png', before: px(1), after: px(1) },
    b = { art: 'art/b.png', before: px(0), after: px(2), whole: true, made: true };
  H.historyArtGroup(h, [a, b]);
  H.historyArtGroup(h, []);
  assert.equal(h.undo.length, 1, 'an empty group is no step');
  assert.equal(H.historyBytes(h.undo[0]), 4 + 4 + 0 + 8);
  const u = H.historyUndo(h);
  assert.deepEqual(u.step.group, [a, b]);
  assert.equal(u.put, u.step.before);
  const r = H.historyRedo(h);
  assert.equal(r.step.group.length, 2);
  assert.equal(r.put, r.step.after);
  assert.notEqual(r.step.before, r.step.after, 'undo and redo can tell which way they go');
});

// Studio track ST-2 and Studio plan T1.2: the Studio's one undo (game/js/logic/history.js): data steps that hold only
// the parts an edit changed, picture patches in one order with them, the caps by steps and by bytes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-real.mjs';

const H = modules.history;
const fresh = () => ({ undo: [], redo: [], last: null });
const patch = n => ({ x: 0, y: 0, width: 1, height: 1, data: new Uint8ClampedArray(n) });
const art = (name, n = 4) => ({ art: name, before: patch(n), after: patch(n) });
const whole = (D, R) => JSON.stringify({ D, R }, (k, v) => (k[0] === '_' && k.length > 1 ? undefined : v));
const data = () => ({
  meta: { version: '0.1.0', name: 'Pocket Billies' },
  lines: [{ id: 'a', n: 1 }, { id: 'b' }],
  maps: { town: { w: 4, _clock: 9 }, cave: { w: 8 } },
  title: 'Copperleaf',
  empty: {},
  none: [],
  _cache: 1,
});
const rigs = () => ({ sp1: { bones: [1] }, sp2: { bones: [] } });

test('parts: one per second-level entry, one per rig, and the order; they give the same data back', () => {
  const D = data(),
    R = rigs(),
    P = H.historyParts(D, R);
  assert.deepEqual([...P.keys()].sort(), [
    '@order',
    'D/lines/0',
    'D/lines/1',
    'D/maps/cave',
    'D/maps/town',
    'D/meta/name',
    'D/meta/version',
    'D/title',
    'R/sp1',
    'R/sp2',
  ]);
  assert.equal(P.get('D/maps/town'), '{"w":4}', 'a cache key is left out');
  const back = H.historyPartsData(P);
  assert.equal(whole(back.D, back.R), whole(D, R), 'the same JSON as the whole data, in the same order');
  assert.deepEqual(back.D.empty, {});
  assert.deepEqual(back.D.none, []);
  assert.equal(H.historyPartsData(H.historyParts(D, null)).R, null);
});

test('a data step holds only the parts that changed, before and after; null for added or removed parts', () => {
  const D = data(),
    a = H.historyParts(D, rigs());
  D.maps.cave.w = 9;
  D.maps.new = { w: 1 };
  delete D.meta.name;
  const b = H.historyParts(D, rigs()),
    d = H.historyDiff(a, b);
  assert.deepEqual(Object.keys(d).sort(), ['@order', 'D/maps/cave', 'D/maps/new', 'D/meta/name']);
  assert.deepEqual(d['D/maps/cave'], ['{"w":8}', '{"w":9}']);
  assert.deepEqual(d['D/maps/new'], [null, '{"w":1}']);
  assert.deepEqual(d['D/meta/name'], ['"Pocket Billies"', null]);
  assert.equal(H.historyDiff(a, H.historyParts(data(), rigs())), null, 'the same data: no diff');
});

test('data steps undo and redo, putting back only the parts they hold', () => {
  const h = fresh(),
    D = data(),
    R = rigs();
  assert.equal(H.historyCommit(h, H.historyParts(D, R)), true, 'the first: kept as last, no step');
  assert.equal(h.undo.length, 0);
  assert.equal(H.historyCommit(h, H.historyParts(D, R)), false, 'no change, no step');
  D.maps.town.w = 5;
  H.historyCommit(h, H.historyParts(D, R));
  R.sp1.bones.push(2);
  H.historyCommit(h, H.historyParts(D, R));
  assert.equal(h.undo.length, 2);
  assert.deepEqual(Object.keys(h.undo[0].parts), ['D/maps/town']);
  assert.deepEqual(H.historyUndo(h), { kind: 'data', put: { 'R/sp1': '{"bones":[1]}' } });
  assert.deepEqual(H.historyUndo(h), { kind: 'data', put: { 'D/maps/town': '{"w":4}' } });
  assert.equal(h.last.get('D/maps/town'), '{"w":4}', 'last follows the undo');
  assert.equal(H.historyUndo(h), null, 'nothing before the first');
  assert.deepEqual(H.historyRedo(h), { kind: 'data', put: { 'D/maps/town': '{"w":5}' } });
  assert.deepEqual(H.historyRedo(h).put, { 'R/sp1': '{"bones":[1,2]}' });
  assert.equal(H.historyRedo(h), null);
  assert.equal(whole(...Object.values(H.historyPartsData(h.last))), whole(D, R));
});

test('bytes: 2 a character for data, the pixels for art; a data step only counts its own parts', () => {
  const s = { parts: { 'D/a/b': ['abc', 'abcd'], 'D/a/c': [null, 'x'] } };
  assert.equal(H.historyBytes(s), 2 * (3 + 4 + 1));
  assert.equal(H.historyBytes(s, 'art'), 0);
  assert.equal(H.historyBytes(s, 'data'), 16);
  const a = art('p', 4);
  assert.equal(H.historyBytes(a), 8);
  assert.equal(H.historyBytes(a, 'data'), 0);
  assert.equal(H.historyPartsBytes(new Map([['ab', 'cde']])), 10);
  assert.equal(H.historyPartsBytes(null), 0);
});

test('art and data steps come back in the order they were made', () => {
  const h = fresh(),
    D = data(),
    p = art('sheet.png');
  H.historyCommit(h, H.historyParts(D, null));
  D.title = 's1';
  H.historyCommit(h, H.historyParts(D, null));
  H.historyArt(h, p);
  D.title = 's2';
  H.historyCommit(h, H.historyParts(D, null));
  const u = [H.historyUndo(h), H.historyUndo(h), H.historyUndo(h)];
  assert.deepEqual(u[0].put, { 'D/title': '"s1"' });
  assert.equal(u[1].kind, 'art');
  assert.equal(u[1].put, p.before);
  assert.deepEqual(u[2].put, { 'D/title': '"Copperleaf"' });
  const r = [H.historyRedo(h), H.historyRedo(h), H.historyRedo(h)];
  assert.deepEqual(r[0].put, { 'D/title': '"s1"' });
  assert.equal(r[1].put, p.after);
  assert.deepEqual(r[2].put, { 'D/title': '"s2"' });
  assert.equal(h.last.get('D/title'), '"s2"');
});

test('a new step drops the redo; the caps drop the oldest, by steps and by bytes', () => {
  const h = fresh(),
    D = data();
  H.historyCommit(h, H.historyParts(D, null));
  H.historyArt(h, art('a'));
  H.historyUndo(h);
  assert.equal(h.redo.length, 1);
  H.historyArt(h, art('b'));
  assert.equal(h.redo.length, 0);
  for (let i = 0; i < 200; i++) {
    D.title = 'x' + i;
    H.historyCommit(h, H.historyParts(D, null));
  }
  assert.equal(h.undo.length, H.HISTORY_STEPS);
  const big = fresh();
  for (let i = 0; i < 5; i++) H.historyArt(big, art('p' + i, H.HISTORY_ART_BYTES / 4));
  assert.equal(big.undo.length, 2, 'two steps of a quarter each fit, a third goes over');
  assert.equal(big.undo[1].art, 'p4');
});

test('data steps are trimmed by their bytes, oldest first, and art does not count against them', () => {
  const h = fresh(),
    D = { a: { s: '' } },
    chars = H.HISTORY_DATA_BYTES / 2 / 4; /* a text this long is a quarter of the cap; a step holds two */
  H.historyCommit(h, H.historyParts(D, null));
  H.historyArt(h, art('small'));
  for (let i = 0; i < 4; i++) {
    D.a.s = String(i).repeat(chars - 2);
    H.historyCommit(h, H.historyParts(D, null));
  }
  const dataBytes = () => h.undo.reduce((n, s) => n + H.historyBytes(s, 'data'), 0);
  assert.ok(dataBytes() <= H.HISTORY_DATA_BYTES, 'under the cap');
  assert.equal(h.undo[0].art, undefined, 'the picture step, oldest, went first');
  assert.equal(h.undo.length, 2, 'the first two data steps went too');
  assert.equal(JSON.parse(h.undo.at(-1).parts['D/a/s'][1]), '3'.repeat(chars - 2), 'the newest is kept');
});

test('a group of picture steps is one step, and counts all its pictures', () => {
  const h = fresh(),
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
  assert.equal(u.parts, undefined, 'no data in it');
  const r = H.historyRedo(h);
  assert.equal(r.step.group.length, 2);
  assert.equal(r.put, r.step.after);
  assert.notEqual(r.step.before, r.step.after, 'undo and redo can tell which way they go');
});

test('a replacement undoes pixels and the rigs together, as a data diff, between other edits', () => {
  const h = fresh(),
    D = data(),
    R = rigs();
  H.historyCommit(h, H.historyParts(D, R));
  R.sp2.bones.push(7);
  const parts = H.historyParts(D, R);
  H.historyArtGroup(h, [art('sheet.png')], parts);
  assert.equal(h.undo.length, 1);
  assert.equal(h.last, parts);
  assert.deepEqual(h.undo[0].snapshot, { 'R/sp2': ['{"bones":[]}', '{"bones":[7]}'] });
  assert.equal(H.historyBytes(h.undo[0], 'data'), 2 * ('{"bones":[]}'.length + '{"bones":[7]}'.length));
  assert.equal(H.historyCommit(h, H.historyParts(D, R)), false, 'no extra metadata step');
  D.title = 'later';
  H.historyCommit(h, H.historyParts(D, R));
  assert.deepEqual(H.historyUndo(h).put, { 'D/title': '"Copperleaf"' });
  const u = H.historyUndo(h);
  assert.equal(u.kind, 'art');
  assert.equal(u.put, u.step.before);
  assert.deepEqual(u.parts, { 'R/sp2': '{"bones":[]}' });
  assert.equal(h.last.get('R/sp2'), '{"bones":[]}');
  const r = H.historyRedo(h);
  assert.equal(r.put, r.step.after);
  assert.deepEqual(r.parts, { 'R/sp2': '{"bones":[7]}' });
  assert.deepEqual(H.historyRedo(h).put, { 'D/title': '"later"' });
});

test('an empty replacement group never advances the data', () => {
  const h = fresh(),
    D = data();
  const first = H.historyParts(D, null);
  H.historyCommit(h, first);
  D.title = 'unused';
  H.historyArtGroup(h, [], H.historyParts(D, null));
  assert.equal(h.last, first);
  assert.equal(h.undo.length, 0);
});

test('every step, undo and redo moves the version on', () => {
  const h = fresh(),
    D = data();
  H.historyCommit(h, H.historyParts(D, null));
  const v0 = h.ver || 0;
  D.title = 'b';
  H.historyCommit(h, H.historyParts(D, null));
  H.historyArt(h, art('x'));
  H.historyUndo(h);
  H.historyRedo(h);
  assert.equal(h.ver, v0 + 4);
});

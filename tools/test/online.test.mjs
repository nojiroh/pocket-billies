// The online track's pure parts (game/js/logic/online.js): who is a friend from the two sides' requests (each
// pair's newest request decides), block lists as stored, and when a reported target is hidden.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BLOCKS_MOST,
  ONLINE_HIDE_AT,
  blockListClean,
  friendListFrom,
  reportHidden,
  reportTarget,
} from '../../game/js/logic/online.js';

const req = (from, to, status, t) => ({ from, to, status, t });

test('an accepted request either way makes a friend; a pending one changes nothing', () => {
  assert.deepEqual(friendListFrom([], 'me', [req('a', 'me', 'accepted', 1)], []), ['a']);
  assert.deepEqual(friendListFrom([], 'me', [], [req('me', 'b', 'accepted', 1)]), ['b']);
  assert.deepEqual(friendListFrom([], 'me', [req('a', 'me', 'pending', 1)], []), []);
  assert.deepEqual(friendListFrom(['a'], 'me', [req('a', 'me', 'pending', 5)], []), ['a']);
});

test('making friends again the other way round after a removal keeps them (SECURITY.md bug)', () => {
  /* I once asked, they accepted, one of us removed it; later they asked and I accepted */
  const out = [req('me', 'a', 'removed', 10)],
    inc = [req('a', 'me', 'accepted', 20)];
  assert.deepEqual(friendListFrom([], 'me', inc, out), ['a']);
  /* and the newer removal still wins over the older acceptance */
  assert.deepEqual(friendListFrom(['a'], 'me', [req('a', 'me', 'accepted', 10)], [req('me', 'a', 'removed', 20)]), []);
});

test('a declined request of mine drops them; one I declined leaves the list as it is', () => {
  assert.deepEqual(friendListFrom(['b'], 'me', [], [req('me', 'b', 'declined', 3)]), []);
  assert.deepEqual(friendListFrom([], 'me', [req('a', 'me', 'declined', 3)], []), []);
});

test('never myself, never empty, at most 50', () => {
  const inc = Array.from({ length: 60 }, (_, i) => req('p' + i, 'me', 'accepted', i));
  const L = friendListFrom(['me', ''], 'me', inc, []);
  assert.equal(L.length, 50);
  assert.ok(!L.includes('me') && !L.includes(''));
});

test('a block list keeps uids only, once each, up to the most', () => {
  assert.deepEqual(blockListClean(['a', 'a', 3, '', null, 'b']), ['a', 'b']);
  assert.deepEqual(blockListClean('a'), []);
  assert.equal(blockListClean(Array.from({ length: 300 }, (_, i) => 'u' + i)).length, BLOCKS_MOST);
});

test('a target is hidden at the third report past what the moderator cleared', () => {
  assert.equal(reportTarget('user', 'abc'), 'user_abc');
  assert.equal(reportHidden(null), false);
  assert.equal(reportHidden({ n: ONLINE_HIDE_AT - 1 }), false);
  assert.equal(reportHidden({ n: ONLINE_HIDE_AT }), true);
  assert.equal(reportHidden({ n: 4, ok: 4 }), false);
  assert.equal(reportHidden({ n: 4 + ONLINE_HIDE_AT, ok: 4 }), true);
});

// RL-1: a save this version can't load is set aside once, in the one shape Settings > Save reads
// ({json, from, at}; account.js used to write that shape and game-state.js a bare copy, which the box never showed).
// game-state.js runs here on a stand-in browser: a storage object, matchMedia and document.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './setup-fixture.mjs';

const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
globalThis.matchMedia = () => ({ matches: false });
globalThis.document = { addEventListener() {}, visibilityState: 'visible' };

const KEY = 'networth-save-v1';
const old = JSON.stringify({ saveVersion: 1, avatar: { name: 'Old Trainer' }, team: [] });
store.set(KEY, old);
const gs = await import('../../game/js/game-state.js');

test('an older save is set aside in the shape the restore box reads', () => {
  assert.equal(gs.SAVE_FOUND, 'old');
  const A = gs.accountSetAsideRead();
  assert.ok(A, 'the restore box finds it');
  assert.equal(A.json, old);
  assert.equal(A.from, 'an older version of the game');
  assert.equal(typeof A.at, 'number');
  assert.deepEqual(Object.keys(JSON.parse(store.get(KEY + '-set-aside'))).sort(), ['at', 'from', 'json']);
});

test('the one writer keeps the latest set-aside save', () => {
  gs.accountSetAside('{"saveVersion":3}', 'this browser');
  assert.equal(gs.accountSetAsideRead().from, 'this browser');
  assert.equal(gs.accountSetAsideRead().json, '{"saveVersion":3}');
});

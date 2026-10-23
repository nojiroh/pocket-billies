// Test cleanup TC-1 (the owner, 2026-10-23): a save from a newer version is refused and never written over; nothing
// sets it aside. The set-aside slot stays for the account's two-games choice (account.js): one writer, one shape
// ({json, from, at}) that Settings > Save reads. game-state.js runs here on a stand-in browser: a storage object,
// matchMedia and document.
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
const newer = JSON.stringify({ saveVersion: 99, started: true, avatar: { name: 'Future Trainer' }, team: [] });
store.set(KEY, newer);
const gs = await import('../../game/js/game-state.js');

test('a newer save is refused, held and never written over; nothing is set aside', () => {
  assert.equal(gs.SAVE_FOUND, 'new');
  assert.equal(gs.saveHold, true);
  assert.equal(gs.saveData.started, false, 'a new game in memory');
  gs.writeStoredSave(gs.saveData);
  assert.equal(store.get(KEY), newer);
  assert.equal(gs.accountSetAsideRead(), null);
  assert.equal(store.has(KEY + '-set-aside'), false);
});

test('the set-aside slot: one writer, the latest kept, in the shape the restore box reads', () => {
  gs.accountSetAside('{"saveVersion":4}', 'your account');
  gs.accountSetAside('{"saveVersion":4,"t":2}', 'this browser');
  const A = gs.accountSetAsideRead();
  assert.deepEqual([A.json, A.from, typeof A.at], ['{"saveVersion":4,"t":2}', 'this browser', 'number']);
  assert.deepEqual(Object.keys(JSON.parse(store.get(KEY + '-set-aside'))).sort(), ['at', 'from', 'json']);
});

// RL-3: a save this version can't load replaces an older set-aside save (the one slot holds the latest). Before, the
// slot kept the first one, so a second unloadable save (a format 3 save on a phone that already had an alpha 0.5 one
// set aside) was written over by the new game. game-state.js runs here on a stand-in browser, as in set-aside.test.mjs.
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
const older = JSON.stringify({ json: '{"saveVersion":1}', from: 'an older version of the game', at: 1 });
const format3 = JSON.stringify({ saveVersion: 3, avatar: { name: 'Phone Trainer' }, team: [] });
store.set(KEY + '-set-aside', older);
store.set(KEY, format3);
const gs = await import('../../game/js/game-state.js');

test('a save that can no longer be loaded replaces an older set-aside one', () => {
  assert.equal(gs.SAVE_FOUND, 'old');
  const A = gs.accountSetAsideRead();
  assert.equal(A.json, format3);
  assert.equal(A.from, 'an older version of the game');
  assert.ok(A.at > 1);
});

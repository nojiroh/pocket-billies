// Studio plan T2.6: "Play this seed", the game's address for a test run on a seed (logic/run-test.js runTestOf). Only
// behind ?debug; the seed cleaned as the debug menu cleans it; unlocks none, all or ids; the party as species@level;
// Perks by id, no more than the cap; anything the data doesn't know is left out and named.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const { runTestOf, RUN_TEST_SHORT } = modules['run-test'];
const D = {
    species: Object.fromEntries(GAME_DATA.lines.flatMap(L => L.names.map((_, i) => [L.id + i, 1]))),
    unlocks: GAME_DATA.unlocks,
    perks: GAME_DATA.perks,
    cap: GAME_DATA.rules.run.perks.cap,
  },
  of = (/** @type {string} */ q) => runTestOf(new URLSearchParams(q), D);

test('runTestOf: only behind ?debug, and only with a seed', () => {
  assert.equal(of('?run=ABC'), null);
  assert.equal(of('?debugger&run=ABC'), null);
  assert.equal(of('?debug'), null);
  assert.equal(of('?debug&run=%20%21%21'), null);
  assert.deepEqual(of('?debug&run=ABC'), {
    seed: 'ABC',
    unlocks: [],
    short: false,
    party: [],
    perks: [],
    draft: false,
    left: [],
  });
  assert.equal(of('?x=1&debug=1&run=ABC').seed, 'ABC');
});

test('runTestOf: the seed as the debug menu cleans it, the short map, the Studio’s draft', () => {
  const R = of('?debug&run=  a b!c_d-E%2F0123456789012345678&short=1&draft=1');
  assert.equal(R.seed, 'abc_d-E0123456789012');
  assert.equal(R.short, true);
  assert.equal(R.draft, true);
  assert.deepEqual(RUN_TEST_SHORT, { rows: 5, minibosses: 1 });
});

test('runTestOf: unlocks none, all or a list; the party and the Perks; what the data lacks is named', () => {
  assert.deepEqual(of('?debug&run=A&unlocks=all').unlocks, Object.keys(GAME_DATA.unlocks));
  assert.deepEqual(of('?debug&run=A&unlocks=none').unlocks, []);
  const R = of(
    '?debug&run=A&unlocks=biome_ridge,nope&party=musk2@30,bezos0@0,ghost1@5,gates1@250&relics=clinic_card,zzz'
  );
  assert.deepEqual(R.unlocks, ['biome_ridge']);
  assert.deepEqual(R.party, [
    { sp: 'musk2', lv: 30 },
    { sp: 'bezos0', lv: 1 },
    { sp: 'gates1', lv: 100 },
  ]);
  assert.deepEqual(R.perks, ['clinic_card']);
  assert.deepEqual(R.left, ['unlock nope', 'Billie ghost1', 'Perk zzz']);
  const many = of(`?debug&run=A&relics=${Object.keys(GAME_DATA.perks).join(',')}`);
  assert.equal(many.perks.length, Math.min(D.cap, Object.keys(GAME_DATA.perks).length));
});

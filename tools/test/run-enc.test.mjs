// RL-12b: logic/run-enc.js, a run's encounter state: an event's boons last their place and `left` more, read beside
// the Perks' rows (effects.js fxOfRun), counted down on walking in (run-loop.js runArriveFx); validRun's check of run.enc.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const { encOf, encBoon, encArrive, encBoonRows } = modules['run-enc'],
  { fxOfRun, fxRunPrice } = modules.effects,
  { newRun, validRun } = modules['run-state'];

const run = () =>
  newRun('ENCTEST001', 1, 1, {
    team: [],
    se: 0,
    items: {},
    pyramids: {},
    trip: { node: 0, plan: [] },
    wild: {},
    flags: {},
    seats: [],
    visited: {},
  });

test('run-enc: a run from before has no state until asked; a fresh one validates', () => {
  const r = run();
  assert.equal(r.enc, undefined);
  assert.equal(validRun(r), true);
  encOf(r);
  assert.deepEqual(r.enc, { n: 0, node: {}, seen: [], boons: [], rewardN: 0, reward: null });
  assert.equal(validRun(r), true);
});

test('run-enc: a boon lasts its place and `left` more, beside the Perks', () => {
  const r = run();
  assert.equal(fxOfRun(r, GAME_DATA.perks), null);
  encBoon(r, [{ kind: 'price', what: 'shop', mult: 1.25 }], 1, 'terms_of_service');
  assert.equal(fxRunPrice(r, GAME_DATA.perks, 'shop', 100), 125);
  assert.equal(encBoonRows(r)[0].src, 'event:terms_of_service');
  encArrive(r); // the next place: still on
  assert.equal(fxRunPrice(r, GAME_DATA.perks, 'shop', 100), 125);
  encArrive(r); // the one after: gone
  assert.equal(fxRunPrice(r, GAME_DATA.perks, 'shop', 100), 100);
  assert.deepEqual(r.enc.boons, []);
  /* with a Perk held, the Perk's rows come first */
  r.perks.push(Object.keys(GAME_DATA.perks)[0]);
  encBoon(r, [{ kind: 'catch', mult: 2 }], 0, 'x');
  const fx = fxOfRun(r, GAME_DATA.perks);
  assert.equal(fx[fx.length - 1].src, 'event:x');
});

test('run-enc: validRun refuses a broken encounter state', () => {
  const good = run();
  encOf(good);
  good.enc.reward = { cards: [{ id: 'potion', kind: 'item', item: 'potion', n: 2 }], rolls: 0, from: 'run_3_t0' };
  assert.equal(validRun(good), true);
  for (const bad of [
    { n: -1 },
    { node: { x: 'a' } },
    { seen: ['Bad Id'] },
    { boons: [{ fx: [{ kind: 'price', what: 'shop', mult: 'x'.repeat(30) }], left: 1, src: 'a' }] },
    { reward: { cards: [], rolls: 0, from: '' } },
    { reward: { cards: [{ id: 'a', kind: 'gift' }], rolls: 0, from: '' } },
    { extra: 1 },
  ]) {
    const r = JSON.parse(JSON.stringify(good));
    Object.assign(r.enc, bad);
    assert.equal(validRun(r), false, JSON.stringify(bad));
  }
});

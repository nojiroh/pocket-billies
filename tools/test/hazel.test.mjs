// Phase 06-2b: Professor Hazel's lines and rules in the new opening (game/js/logic/hazel.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fn, modules, data } from './setup-real.mjs';

const { HAZEL, TIP_MAX, FAST_PICK_MS, FAST_PICKS, FAST_SKIP_MS, FAST_SKIPS } = modules.hazel;

test('every starter has hot takes, and tapping on runs into the annoyed ones and stays there', () => {
  for (const l of data.RULES.start.starters) assert.ok(HAZEL.hotTakes[l]?.length, `no hot takes for ${l}`);
  const own = HAZEL.hotTakes.musk;
  assert.equal(fn('hotTake')('musk', 0), own[0]);
  assert.equal(fn('hotTake')('musk', own.length), HAZEL.annoyed[0]);
  assert.equal(fn('hotTake')('musk', 99), HAZEL.annoyed.at(-1));
  assert.equal(fn('hotTake')('nobody', 0), HAZEL.annoyed[0]);
});

test('her tips: the meta line first, then the matchup flipped, then the bad ones, never more than TIP_MAX', () => {
  const m = { weak: 'Grass', strong: 'Fire' };
  assert.equal(fn('hazelTip')(0, m), HAZEL.meta);
  assert.equal(fn('hazelTip')(1, m), 'Grass beats Fire. Trust me, I’m a doctor.');
  assert.equal(fn('hazelTip')(2, m), HAZEL.badTips[0]);
  assert.equal(fn('hazelTip')(TIP_MAX, m), null);
  assert.equal(fn('hazelTip')(1, null), HAZEL.badTips[0]);
});

test('too fast: a comment only after enough fast ones in a row; a slow one starts over; each comment once', () => {
  const w = fn('speedWatch')(FAST_PICK_MS, FAST_PICKS, HAZEL.tooFastPicks);
  const fast = FAST_PICK_MS - 1,
    slow = FAST_PICK_MS + 1;
  for (let i = 1; i < FAST_PICKS; i++) assert.equal(w.record(fast), null);
  assert.equal(w.record(slow), null, 'a slow pick starts over');
  for (let i = 1; i < FAST_PICKS; i++) assert.equal(w.record(fast), null);
  assert.equal(w.record(fast), HAZEL.tooFastPicks[0]);
  for (let i = 1; i < FAST_PICKS; i++) w.record(fast);
  assert.equal(w.record(fast), HAZEL.tooFastPicks[1]);
  for (let i = 0; i < FAST_PICKS * 3; i++) assert.equal(w.record(fast), null, 'out of comments');
  const s = fn('speedWatch')(FAST_SKIP_MS, FAST_SKIPS, HAZEL.tooFastSkips);
  for (let i = 1; i < FAST_SKIPS; i++) assert.equal(s.record(10), null);
  assert.equal(s.record(10), HAZEL.tooFastSkips[0]);
});

test('placeholders fill, and unknown ones stay', () => {
  assert.equal(fn('fillLine')('Go, {foe}! {x}', { foe: 'Gildlet' }), 'Go, Gildlet! {x}');
});

// Phase 06-2b: the professor's lines and rules in the new opening (game/js/logic/chosen.js); since 2026-10-23 the
// professor is the Chosen.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fn, modules, data } from './setup-real.mjs';

const { CHOSEN, TIP_MAX, FAST_PICK_MS, FAST_PICKS, FAST_SKIP_MS, FAST_SKIPS } = modules.chosen;

test('every starter has hot takes, and tapping on runs into the annoyed ones and stays there', () => {
  for (const l of data.RULES.start.starters) assert.ok(CHOSEN.hotTakes[l]?.length, `no hot takes for ${l}`);
  const own = CHOSEN.hotTakes.musk;
  assert.equal(fn('hotTake')('musk', 0), own[0]);
  assert.equal(fn('hotTake')('musk', own.length), CHOSEN.annoyed[0]);
  assert.equal(fn('hotTake')('musk', 99), CHOSEN.annoyed.at(-1));
  assert.equal(fn('hotTake')('nobody', 0), CHOSEN.annoyed[0]);
});

test('his tips: the meta line first, then the matchup flipped, then the bad ones, never more than TIP_MAX', () => {
  const m = { weak: 'Grass', strong: 'Fire' };
  assert.equal(fn('chosenTip')(0, m), CHOSEN.meta);
  assert.equal(fn('chosenTip')(1, m), 'Grass beats Fire. It was foretold. In a forum post.');
  assert.equal(fn('chosenTip')(2, m), CHOSEN.badTips[0]);
  assert.equal(fn('chosenTip')(TIP_MAX, m), null);
  assert.equal(fn('chosenTip')(1, null), CHOSEN.badTips[0]);
});

test('too fast: a comment only after enough fast ones in a row; a slow one starts over; each comment once', () => {
  const w = fn('speedWatch')(FAST_PICK_MS, FAST_PICKS, CHOSEN.tooFastPicks);
  const fast = FAST_PICK_MS - 1,
    slow = FAST_PICK_MS + 1;
  for (let i = 1; i < FAST_PICKS; i++) assert.equal(w.record(fast), null);
  assert.equal(w.record(slow), null, 'a slow pick starts over');
  for (let i = 1; i < FAST_PICKS; i++) assert.equal(w.record(fast), null);
  assert.equal(w.record(fast), CHOSEN.tooFastPicks[0]);
  for (let i = 1; i < FAST_PICKS; i++) w.record(fast);
  assert.equal(w.record(fast), CHOSEN.tooFastPicks[1]);
  for (let i = 0; i < FAST_PICKS * 3; i++) assert.equal(w.record(fast), null, 'out of comments');
  const s = fn('speedWatch')(FAST_SKIP_MS, FAST_SKIPS, CHOSEN.tooFastSkips);
  for (let i = 1; i < FAST_SKIPS; i++) assert.equal(s.record(10), null);
  assert.equal(s.record(10), CHOSEN.tooFastSkips[0]);
});

test('placeholders fill, and unknown ones stay', () => {
  assert.equal(fn('fillLine')('Go, {foe}! {x}', { foe: 'Gildlet' }), 'Go, Gildlet! {x}');
});

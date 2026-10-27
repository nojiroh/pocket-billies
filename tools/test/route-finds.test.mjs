// Routes track RT-4b: the finds' cards and the pick-up (game/js/logic/route-finds.js), and the condition a bramble row's
// `unless` reads (logic/conditions.js openedOf): a find's card is a small item or candy card by weight, a rare card
// about `rare` of the time; walking within reach finds the first one not taken; its card goes into the bag (an item,
// or pyramids); opened:cut.<node>.<spot> and opened:find.<node>.<k> hold once the run's flag is set, and only in a run.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const F = modules['route-finds'],
  C = modules.conditions,
  RULES = GAME_DATA.rules.run.finds,
  CARDS = GAME_DATA.rewards;

/** a seeded draw (Park-Miller) @param {number} s */
const gen = s => ({ next: () => (s = (s * 16807) % 2147483647) / 2147483647 });

test('RT-4b: rules.json run.finds names cards of the reward pick', () => {
  assert.ok(RULES, 'run.finds is in rules.json');
  for (const k of RULES.rareCards) assert.ok(CARDS[k], `no reward card ${k}`);
  assert.ok(RULES.perRoute[0] >= 1 && RULES.perRoute[1] >= RULES.perRoute[0]);
});

test('RT-4b: a find is a small item or candy card by weight, a rare card about `rare` of the time', () => {
  const g = gen(7),
    seen = /** @type {Record<string, number>} */ ({});
  let rare = 0;
  const N = 6000;
  for (let n = 0; n < N; n++) {
    const k = F.routeFindCard(g, CARDS, RULES);
    seen[k] = (seen[k] || 0) + 1;
    if (RULES.rareCards.includes(k)) rare++;
    else assert.ok(['item', 'candy'].includes(CARDS[k].kind), `${k} is a ${CARDS[k].kind} card`);
  }
  assert.ok(Math.abs(rare / N - RULES.rare) < 0.015, `rare share ${(rare / N).toFixed(3)}`);
  assert.ok(!seen.tutor && !seen.held, 'never a tutor or a held card');
  for (const k of RULES.rareCards) assert.ok(seen[k], `the rare card ${k} comes up`);
  /* the weights: potions (6) more often than trail mix (2) */
  assert.ok(seen.potions > seen.trailmix * 2, `potions ${seen.potions}, trail mix ${seen.trailmix}`);
});

test('RT-4b: walking within reach finds the first find not taken; its card goes into the bag', () => {
  const sc = {
    props: [
      { k: 'find_pyramid', x: 5, z: 5, find: 'find.2.0', card: 'gold_pyramid' },
      { k: 'find_pyramid', x: 5.3, z: 5, find: 'find.2.1', card: 'potions' },
    ],
  };
  assert.equal(F.routeFindAt(sc, 7, 5, {}), null, 'out of reach');
  assert.deepEqual(F.routeFindAt(sc, 5.2, 5, {}), { card: 'gold_pyramid', flag: 'find.2.0' });
  assert.deepEqual(F.routeFindAt(sc, 5.2, 5, { 'find.2.0': 1 }), { card: 'potions', flag: 'find.2.1' });
  assert.equal(F.routeFindAt(sc, 5.2, 5, { 'find.2.0': 1, 'find.2.1': 1 }), null);
  const s = { items: { potion: 1 }, pyramids: {} };
  assert.deepEqual(F.routeFindGive(s, CARDS.potions), { id: 'potion', pyramid: false, n: 2 });
  assert.deepEqual(F.routeFindGive(s, CARDS.gold_pyramid), { id: 'gold_pyramid', pyramid: true, n: 1 });
  assert.deepEqual(F.routeFindGive(s, CARDS.shining_stone), { id: 'bell', pyramid: false, n: 1 });
  assert.deepEqual(s, { items: { potion: 3, bell: 1 }, pyramids: { gold_pyramid: 1 } });
  assert.equal(F.routeFindGive(s, CARDS.tutor), null, 'a card with nothing to give');
});

test('RT-4b: opened:cut.<node>.<spot> holds once the run flag is set, in a run only; the side area’s still works', () => {
  const T = C.conditionTree('opened:cut.3.1'),
    save = (/** @type {any} */ o) => C.storyStateOf({ flags: {}, team: [], ...o }),
    run = { map: { nodes: [] } };
  assert.equal(C.conditionHolds(T, save({ run })), false);
  assert.equal(C.conditionHolds(T, save({ run, flags: { 'cut.3.1': 1 } })), true);
  assert.equal(C.conditionHolds(T, save({ flags: { 'cut.3.1': 1 } })), false, 'not out of a run');
  assert.equal(C.conditionHolds(C.conditionTree('opened:find.3.0'), save({ run, flags: { 'find.3.0': 1 } })), true);
  const side = { map: { nodes: [], side: { move: 'cut', open: 1 } } };
  assert.equal(C.conditionHolds(C.conditionTree('opened:cut'), save({ run: side })), true);
  assert.equal(C.conditionHolds(T, save({ run: side })), false);
});

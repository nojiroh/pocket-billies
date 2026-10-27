// Hub track HB-10d: the square's talk after a run (game/js/logic/square-talk.js): the mood from the run history, the
// game's square_won / square_lost lines (banter.json) as the story's conditions read them.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';
import { squareMood, squareTalk } from '../../game/js/logic/square-talk.js';

const { conditionHolds, storyStateOf } = modules.conditions;
/* a history entry (logic/run-history.js historyEntry's fields) */
const run = (end, more = {}) => ({
  seed: 's',
  theme: '',
  region: 'R',
  exp: 1,
  end,
  by: null,
  row: 6,
  days: 9,
  team: [],
  perks: [],
  leaders: [],
  rival: null,
  ...more,
});
const talk = history => {
  const S = storyStateOf({ meta: { runs: history.length, history }, story: {} });
  return squareTalk(GAME_DATA.banter, squareMood(history), c => conditionHolds(c, S));
};

test('the mood: the last run won or lost (a run given up is a loss), none before the first', () => {
  assert.equal(squareMood([]), null);
  assert.equal(squareMood(undefined), null);
  assert.equal(squareMood([run('lost'), run('won')]), 'won');
  assert.equal(squareMood([run('won'), run('lost')]), 'lost');
  assert.equal(squareMood([run('quit')]), 'lost');
});

test('before any run the square says nothing about one', () => {
  assert.deepEqual(talk([]), []);
});

test('a loss: gossip, the most fitting first; a loss to the Bureau names the clerk', () => {
  const plain = talk([run('lost', { by: { kind: 'wild' } })]);
  assert.ok(plain.length >= 3 && plain.includes('The train came home smoking again.'));
  assert.ok(!plain.some(l => /clerk/.test(l)));
  const B = talk([run('lost', { by: { kind: 'trainer', bureau: 1 } })]);
  assert.match(B[0], /clerk|stamp/, B[0]);
  assert.ok(!B.some(l => /gold/i.test(l)), 'no cheering after a loss');
});

test('a win: cheers, none of the gossip; three in a row runs out of bunting', () => {
  const W = talk([run('won')]);
  assert.ok(W.includes('The train came home gold! Gold!'));
  assert.ok(!W.some(l => /smoking/.test(l)));
  const three = talk([run('won'), run('won'), run('won')]);
  assert.match(three[0], /bunting/);
});

test('every line a bubble: no line id, no speaker', () => {
  for (const H of [[run('won')], [run('lost')], [run('quit')]])
    for (const l of talk(H)) assert.ok(!/#l:|^[A-Z]\w*:\s/.test(l), l);
});

test('HB-10e: on a festival the square says its own lines (square_fest), each naming its festival, none on another', () => {
  const fest = id => {
    const S = { ...storyStateOf({ meta: { runs: 3, history: [] }, story: {} }), festival: { [id]: 1 } };
    return squareTalk(GAME_DATA.banter, 'fest', c => conditionHolds(c, S));
  };
  const ids = Object.keys(GAME_DATA.festivals.festivals),
    said = ids.map(fest);
  for (const [i, L] of said.entries()) {
    assert.ok(L.length >= 2, `${ids[i]}: ${L.length} lines`);
    for (const l of L) assert.ok(l.length <= 70 && !/#l:/.test(l), l);
  }
  /* no line is shared between two festivals */
  assert.equal(new Set(said.flat()).size, said.flat().length);
});

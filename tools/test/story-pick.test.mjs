// RL-S1: the story director (game/js/logic/story-pick.js): which banter line is picked for who (when, once, cooldown,
// must, priority, a steady tie), what saying it marks, the script command `pick`, and the game's own lines.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const { storyPick, storyPickSaid, BANTER_WHO } = modules['story-pick'];
const { parseScript } = modules['script-parse'];
const { runScript } = modules.script;
const { conditionHolds, storyStateOf } = modules.conditions;

const B = {
  a_low: { who: 'hazel', priority: 1, script: ['Low.'] },
  b_won: { who: 'hazel', when: 'flag_won', priority: 5, script: ['Won.'] },
  c_won: { who: 'hazel', when: 'flag_won', priority: 5, script: ['Also won.'] },
  d_once: { who: 'hazel', when: 'flag_first', priority: 2, must: true, once: true, script: ['First!'] },
  e_cool: { who: 'chosen', priority: 3, cooldown: 2, script: ['Cool.'] },
  f_plain: { who: 'chosen', priority: 1, script: ['Plain.'] },
};
const holdsOf = (/** @type {Record<string, any>} */ flags) => (/** @type {string} */ c) => !!flags[c];

test('pick: the highest priority whose when holds; a must line first; nothing for a who without lines', () => {
  assert.equal(storyPick('hazel', B, holdsOf({}), {}, 0), 'a_low');
  const won = storyPick('hazel', B, holdsOf({ flag_won: 1 }), {}, 0);
  assert.ok(['b_won', 'c_won'].includes(won));
  assert.equal(storyPick('hazel', B, holdsOf({ flag_won: 1 }), {}, 0), won, 'the same save picks the same line');
  const draws = new Set([0, 1, 2, 3, 4, 5, 6, 7].map(r => storyPick('hazel', B, holdsOf({ flag_won: 1 }), {}, r)));
  assert.deepEqual([...draws].sort(), ['b_won', 'c_won'], 'a tie is drawn by the runs ended');
  assert.equal(storyPick('hazel', B, holdsOf({ flag_won: 1, flag_first: 1 }), {}, 0), 'd_once', 'must beats priority');
  assert.equal(storyPick('juniper', B, holdsOf({}), {}, 0), null);
});

test('pick: once lines are said once; a cooldown counts the runs ended since', () => {
  const story = {};
  storyPickSaid('d_once', B, story, 1);
  assert.deepEqual(story, { said: { d_once: 1 }, once: { 'banter:d_once': 1 } });
  assert.equal(storyPick('hazel', B, holdsOf({ flag_first: 1 }), story, 2), 'a_low');
  storyPickSaid('e_cool', B, story, 3);
  assert.equal(storyPick('chosen', B, holdsOf({}), story, 3), 'f_plain');
  assert.equal(storyPick('chosen', B, holdsOf({}), story, 4), 'f_plain');
  assert.equal(storyPick('chosen', B, holdsOf({}), story, 5), 'e_cool', 'two runs later');
});

test('the script command pick plays the picked line inline, with the speaker of the script', async () => {
  const said = [];
  const stage = { say: l => said.push(`${l.who}: ${l.text}`), choose: () => 0 };
  const save = { story: {}, items: {}, pyramids: {} };
  await runScript(parseScript(['Before.', 'pick hazel', 'pick juniper', 'After.']), stage, {
    save,
    id: 'test',
    speaker: 'hazel',
    pick: who => (who === 'hazel' ? parseScript(['Picked.', 'Chosen: Me too.']) : null),
  });
  assert.deepEqual(said, ['hazel: Before.', 'hazel: Picked.', 'Chosen: Me too.', 'hazel: After.']);
});

test("the game's lines: each who has lines, leaders and agents always have one, every when reads", () => {
  const G = GAME_DATA.banter;
  for (const who of BANTER_WHO)
    assert.ok(
      Object.values(G).some(b => b.who === who),
      who
    );
  // a fresh save with no runs: the leader and the agent still have their plain line
  const S = storyStateOf({ meta: { runs: 0, history: [] }, story: {} });
  const holds = c => conditionHolds(c, S);
  assert.equal(storyPick('leader', G, holds, {}, 0), 'leader_badge');
  assert.equal(storyPick('bureau', G, holds, {}, 0), 'bureau_lost');
  assert.equal(storyPick('chosen', G, holds, {}, 0), null, 'nothing to react to before the first run');
  // after a first lost run: Chosen's must line
  const first = {
    seed: 'S',
    theme: '',
    region: '',
    exp: 1,
    end: 'lost',
    by: { kind: 'boss', id: 'marina' },
    row: 5,
    days: 6,
    team: [],
    perks: [],
    leaders: [],
    rival: null,
  };
  const T = storyStateOf({ meta: { runs: 1, history: [first] }, story: { met_juniper: 1 } });
  const h = c => conditionHolds(c, T);
  assert.equal(storyPick('chosen', G, h, {}, 1), 'chosen_first');
  assert.equal(storyPick('hazel', G, h, {}, 1), 'hazel_rounder');
  assert.equal(storyPick('juniper', G, h, {}, 1), 'juniper_lost');
  assert.ok(['lost_rescued', 'lost_reflexes'].includes(storyPick('back_lost', G, h, {}, 1)));
});

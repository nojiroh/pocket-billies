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
  assert.equal(storyPick('rival', G, holds, {}, 0), 'rival_first', 'Blake introduces himself first');
  assert.equal(storyPick('rival', G, holds, { once: { 'banter:rival_first': 1 } }, 0), 'rival_built');
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

test('the lost run scene: the first time in full (and marked), later a picked pair', async () => {
  const lines = GAME_DATA.story.scripts['back-lost'].script,
    G = GAME_DATA.banter;
  const play = async story => {
    const said = [];
    const save = { story, items: {}, pyramids: {}, meta: { runs: 2, history: [] } };
    const S = storyStateOf(save);
    await runScript(
      parseScript(lines),
      { say: l => said.push(`${l.who}: ${l.text}`), choose: () => 0 },
      {
        save,
        id: 'story:back-lost',
        speaker: 'chosen',
        pick: who => {
          const k = storyPick(who, G, c => conditionHolds(c, S), story, 2);
          return k ? parseScript(G[k].script) : null;
        },
      }
    );
    return said;
  };
  const story = {};
  const first = await play(story);
  assert.equal(first.length, 7);
  assert.match(first[0], /^Chosen: There you are!/);
  assert.equal(story.firstLoss, 1);
  const later = await play(story);
  assert.equal(later.length, 2);
  assert.match(later[0], /^Chosen: /);
  assert.match(later[1], /^Hazel: /);
});

test('RL-S2 part B: a thank-you is its hub person’s line; a leader’s, an agent’s and Blake’s name their speakers', () => {
  const { banterOwner } = modules['story-pick'];
  assert.deepEqual(
    ['chosen', 'thanks_hazel', 'thanks_juniper', 'leader', 'rival', 'back_lost', 'thanks_blake'].map(banterOwner),
    ['chosen', 'hazel', 'juniper', null, null, null, null]
  );
});

test("RL-S2 part B: a gift's thank-you: the level just reached first, once; then their plain thanks", () => {
  const G = GAME_DATA.banter,
    story = {};
  const pick = rel => {
    const S = storyStateOf({ meta: { runs: 2, history: [], rel: { hazel: rel } }, story });
    const k = storyPick('thanks_hazel', G, c => conditionHolds(c, S), story, 2);
    if (k) storyPickSaid(k, G, story, 2);
    return k;
  };
  assert.equal(pick(1), 'thanks_hazel_1');
  assert.equal(pick(1), 'thanks_hazel');
  assert.equal(pick(4), 'thanks_hazel_3', 'a jump of two levels: the higher one first');
  assert.equal(pick(4), 'thanks_hazel_2');
  assert.equal(pick(4), 'thanks_hazel');
});

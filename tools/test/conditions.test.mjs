// Project Story S1: the conditions the story's scripts and gates are written in (game/js/logic/conditions.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-real.mjs';

const { conditionHolds, conditionProblem, conditionNames, conditionTree, storyStateOf } = modules.conditions;

const state = (o = {}) => ({
  flags: { met_juniper: 1, rival0: 'win', talks: 3 },
  beaten: { chad: 1 },
  items: { honey: 3, potion: 0 },
  coins: { gold: 2 },
  quests: { ledger: 'asked' },
  visits: { juniper: 2 },
  visited: { copperleaf: 1 },
  lines: { musk: 1, musk0: 1 },
  robots: 0,
  badges: 1,
  caught: 6,
  questStages: { ledger: ['found', 'asked', 'paid'] },
  ...o,
});

test('every term reads the state it names', () => {
  const S = state();
  const yes = [
    'met_juniper',
    '!met_cass',
    'not met_cass',
    'rival0 = win',
    'rival0 != lose',
    'beat:chad',
    '!beat:cass',
    'item:honey >= 3',
    'item:honey',
    '!item:potion',
    'coin:gold > 1',
    'coin:gold == 2',
    'quest:ledger = asked',
    'quest:ledger >= found',
    'quest:ledger < paid',
    'quest:nacre = none',
    'visits:juniper >= 2',
    'visits:juniper',
    '!visits:nacre',
    'visited:copperleaf',
    '!visited:pearlantis',
    'billie:musk',
    'billie:musk0',
    '!billie:bezos',
    '!robot',
    'robot = 0',
    'badges',
    'badges >= 1',
    'badges < 2',
    'caught',
    'caught >= 5',
    'caught < 15',
  ];
  for (const c of yes) assert.equal(conditionHolds(c, S), true, c);
  for (const c of yes.slice(1)) assert.equal(conditionHolds('not (' + c + ')', S), false, 'not ' + c);
});

test('and binds tighter than or; parentheses and not group', () => {
  const S = state();
  assert.equal(conditionHolds('met_cass and beat:chad or badges', S), true);
  assert.equal(conditionHolds('met_cass and (beat:chad or badges)', S), false);
  assert.equal(conditionHolds('!met_cass and !(robot or beat:cass)', S), true);
  assert.equal(conditionHolds('not not met_juniper', S), true);
  assert.deepEqual(conditionTree('a or b and c'), {
    t: 'or',
    a: { t: 'term', kind: 'flag', id: 'a', op: null, val: null },
    b: {
      t: 'and',
      a: { t: 'term', kind: 'flag', id: 'b', op: null, val: null },
      b: { t: 'term', kind: 'flag', id: 'c', op: null, val: null },
    },
  });
});

test('mistakes are errors with a column and, for a typo, a "did you mean"', () => {
  const cases = [
    ['itme:honey', 'unknown term "itme:", did you mean "item:"?', 0],
    ['met_juniper and vist:juniper', 'unknown term "vist:", did you mean "visits:"?', 16],
    ['zzzz:x', 'unknown term "zzzz:"', 0],
    ['met_juniper beat:chad', '"and" or "or" expected before "beat:chad"', 12],
    ['(met_juniper', '")" expected at the end', 12],
    ['met_juniper and', 'a flag or a term expected at the end', 15],
    ['item:honey >= lots', '"item" is a count: a number expected after ">="', 14],
    ['beat:chad >= 2', '"beat:" is yes or no; it takes no ">="', 10],
    ['rival0 > win', '">" compares numbers; a flag\'s word takes = or !=', 7],
    ['quest:ledger', '"quest:ledger" needs a stage (quest:ledger = <stage>)', 0],
    ['robot:big', '"robot" takes no name (write "robot >= 1")', 0],
    ['met_juniper & beat:chad', 'unexpected "&"', 12],
  ];
  for (const [src, message, col] of cases) assert.deepEqual(conditionProblem(src), { message, col }, src);
  assert.equal(conditionProblem('met_juniper and (beat:chad or badges >= 2)'), null);
});

test('conditionNames lists what a condition reads, for the story checks', () => {
  const n = conditionNames(conditionTree('met_juniper and (beat:chad or item:honey >= 2) and !met_cass'));
  assert.deepEqual(Object.fromEntries(Object.entries(n).map(([k, v]) => [k, [...v].sort()])), {
    flag: ['met_cass', 'met_juniper'],
    beat: ['chad'],
    item: ['honey'],
  });
});

test('storyStateOf reads a save: places by id, Billie lines, robots, badges, talks', () => {
  const save = {
    story: { met_juniper: 1, talks: { juniper: 4 }, quests: { ledger: 'found' } },
    flags: { chad: 1 },
    items: { honey: 1 },
    coins: { gold: 0 },
    visited: { 1: 1 },
    caught: { musk1: 1 },
    team: [{ kind: 'robot' }, {}],
    box: [],
    seats: ['a', 'b'],
  };
  const S = storyStateOf(save, { locations: [{ id: 'marigold' }, { id: 'copperleaf' }] });
  assert.equal(S.flags, save.story, 'story flags are the save’s own object, so a script’s set shows at once');
  for (const c of [
    'met_juniper',
    'beat:chad',
    'item:honey',
    '!coin:gold',
    'visited:copperleaf',
    '!visited:marigold',
    'billie:musk',
    'billie:musk1',
    'robot',
    'badges = 2',
    'visits:juniper = 4',
    'quest:ledger = found',
  ])
    assert.equal(conditionHolds(c, S), true, c);
});

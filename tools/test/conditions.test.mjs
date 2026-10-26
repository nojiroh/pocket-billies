// Project Story S1: the conditions the story's scripts and gates are written in (game/js/logic/conditions.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-real.mjs';

const { conditionHolds, conditionProblem, conditionNames, conditionTree, storyStateOf } = modules.conditions;

const state = (o = {}) => ({
  flags: { met_juniper: 1, rival0: 'win', talks: 3 },
  beaten: { chad: 1 },
  items: { honey: 3, potion: 0 },
  pyramids: { gold_pyramid: 2 },
  quests: { ledger: 'asked' },
  visits: { juniper: 2 },
  visited: { copperleaf: 1 },
  lines: { musk: 1, musk0: 1 },
  robots: 0,
  badges: 1,
  caught: 6,
  unlocks: { ranch_2: 1 },
  runs: 3,
  wins: 0,
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
    'coin:gold_pyramid > 1',
    'coin:gold_pyramid == 2',
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
    pyramids: { gold_pyramid: 0 },
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
    '!coin:gold_pyramid',
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

test('RL-11: unlock:, runs and wins read what lasts between runs (saveData.meta), in the hub and on a run', () => {
  const S = state();
  for (const c of ['unlock:ranch_2', '!unlock:ranch_3', 'runs >= 3', 'runs', '!wins', 'wins = 0', 'runs > 2 and !wins'])
    assert.equal(conditionHolds(c, S), true, c);
  for (const c of ['unlock:ranch_3', 'runs > 3', 'wins', 'wins >= 1']) assert.equal(conditionHolds(c, S), false, c);
  assert.equal(conditionProblem('unlock:shop_revive and wins >= 1'), null);
  assert.deepEqual([...conditionNames(conditionTree('unlock:a or unlock:b and runs')).unlock], ['a', 'b']);
  const save = { meta: { unlocks: { shop_revive: 1 }, runs: 2, wins: 1 }, run: { seed: 'x' } };
  const M = storyStateOf(save);
  for (const c of ['unlock:shop_revive', 'runs = 2', 'wins >= 1', 'expedition = 1'])
    assert.equal(conditionHolds(c, M), true, c);
  /* RL-13: the highest Expedition open */
  assert.equal(conditionHolds('expedition >= 3', storyStateOf({ meta: { expedition: 3 } })), true);
  assert.equal(conditionHolds('expedition >= 2', storyStateOf({})), false);
  const none = storyStateOf({});
  for (const c of ['!unlock:shop_revive', '!runs', '!wins'])
    assert.equal(conditionHolds(c, none), true, `no meta: ${c}`);
});

test('RS-1: resident: and residents read who lives in Copperleaf (saveData.meta), in the hub and on a run', () => {
  for (const run of [null, { seed: 'x' }]) {
    const S = storyStateOf({ meta: { unlocks: {}, runs: 2, wins: 0, residents: { dottie: 1, mo: 2 } }, run });
    for (const c of ['resident:dottie', '!resident:gus', 'residents >= 2', 'residents', 'residents < 3'])
      assert.equal(conditionHolds(c, S), true, c);
    for (const c of ['resident:gus', 'residents >= 3']) assert.equal(conditionHolds(c, S), false, c);
  }
  assert.equal(conditionHolds('residents', storyStateOf({ meta: {} })), false, 'a meta from before: nobody');
  assert.equal(conditionProblem('resident:dottie and residents >= 3'), null);
  assert.deepEqual([...conditionNames(conditionTree('resident:a or resident:b')).resident], ['a', 'b']);
});

test('RL-12b: type:, money and badge: read the team, the Moneys on hand and the badges won', () => {
  const save = {
    se: 250,
    team: [
      { sp: 'a', types: ['Water', 'Flying'] },
      { sp: 'b', types: ['Water'] },
      { sp: 'c', types: ['Fire'] },
    ],
    seats: ['haven'],
    meta: { badges: ['Ground'] },
  };
  const S = storyStateOf(save, { badgeTypes: { haven: 'Water' } });
  for (const c of ['type:Water >= 2', 'type:water', 'type:Fire', '!type:Grass', 'money >= 250', 'money < 251'])
    assert.equal(conditionHolds(c, S), true, c);
  for (const c of ['badge:Water', 'badge:Ground', '!badge:Grass']) assert.equal(conditionHolds(c, S), true, c);
  /* a robot or a Billie without its own types: the caller's lookup */
  const T = storyStateOf({ team: [{ sp: 'x' }] }, { typesOf: () => ['Steel'] });
  assert.equal(conditionHolds('type:Steel', T), true);
  /* meta.badges as keys (RL-R2 may write an object), a leader id mapped to its type */
  const K = storyStateOf(
    { meta: { badges: { marina: 1, rocco: 0 } } },
    { badgeTypes: { marina: 'Water', rocco: 'Ground' } }
  );
  assert.equal(conditionHolds('badge:Water and !badge:Ground', K), true);
  assert.equal(conditionHolds('money or type:Fire or badge:Fire', storyStateOf({})), false);
  assert.ok(conditionProblem('badge: and money'), 'badge: needs a type');
  assert.ok(conditionProblem('badge:Water >= 1'), 'badge: is yes or no');
  assert.ok(conditionProblem('money:gold'), 'money takes no name');
});

test("RL-12b: the game reads a team Billie's types from its species, and the leaders' types from their files", () => {
  const { storyTeamLookups } = modules.script;
  const L = storyTeamLookups();
  assert.equal(L.badgeTypes.marina, 'Water');
  assert.ok(Object.values(L.badgeTypes).includes('Water'));
  assert.deepEqual(L.typesOf({ sp: 'zuck1' }), ['Electric', 'Water']);
});

test('RL-S1: last:, lastby:, history: and rematch read the runs kept (meta.history)', () => {
  const run = (end, by = null, o = {}) => ({
    seed: 'S',
    theme: '',
    region: '',
    exp: 1,
    end,
    by,
    row: 3,
    days: 9,
    team: ['musk0'],
    perks: [],
    leaders: [],
    rival: null,
    ...o,
  });
  const history = [
    run('won'),
    run('lost', { kind: 'miniboss', id: 'marina' }),
    run('lost', { kind: 'route', id: 'bureau_clerk', sp: 'musk0', bureau: 1 }, { row: 2 }),
  ];
  const S = storyStateOf({ meta: { history } }, { foe: 'marina' });
  for (const [c, want] of [
    ['last:lost', true],
    ['last:won', false],
    ['last:row <= 2', true],
    ['last:days = 9', true],
    ['lastby:bureau', true],
    ['lastby:route and lastby:musk0', true],
    ['lastby:boss', false],
    ['history:losses >= 2', true],
    ['history:lstreak = 2', true],
    ['history:streak', false],
    ['history:bureau = 1', true],
    ['rematch = 1', true],
  ])
    assert.equal(conditionHolds(c, S), want, c);
  const none = storyStateOf({ meta: {} });
  assert.equal(conditionHolds('last:won or last:lost or history:runs or rematch', none), false, 'no runs yet');
  assert.match(conditionProblem('lastby:boss >= 1').message, /yes or no/);
  assert.match(conditionProblem('rematch:marina').message, /takes no name/);
  assert.equal(conditionProblem('history:runs >= 5'), null);
});

test('RL-S2: lastteam: reads the team the last run ended with, by type, line and species', () => {
  const entry = team => ({
    seed: 'S',
    theme: '',
    region: '',
    exp: 1,
    end: 'won',
    by: null,
    row: 3,
    days: 9,
    team,
    perks: [],
    leaders: [],
    rival: null,
  });
  const typesOf = m => ({ musk0: ['Steel'], musk1: ['Steel', 'Fire'], bezos0: ['Grass'] })[m.sp] || [];
  const S = storyStateOf(
    { team: [{ sp: 'bezos0' }], meta: { history: [entry(['bezos0']), entry(['musk0', 'musk1'])] } },
    { typesOf }
  );
  for (const [c, want] of [
    ['lastteam:Steel = 2', true],
    ['lastteam:steel = 2', true],
    ['lastteam:Fire', true],
    ['lastteam:musk >= 2', true],
    ['lastteam:musk1', true],
    ['lastteam:Grass', false],
    ['lastteam:bezos', false],
    ['type:Grass', true],
  ])
    assert.equal(conditionHolds(c, S), want, c);
  assert.equal(conditionHolds('lastteam:Steel', storyStateOf({ meta: {} }, { typesOf })), false, 'no runs yet');
  assert.equal(conditionProblem('lastteam:Grass >= 1'), null);
});

test('RL-S2 part B: rival reads the meetings with Blake on the run so far (0 off a run)', () => {
  assert.equal(conditionHolds('rival', storyStateOf({ meta: {} })), false);
  const S = storyStateOf({ meta: {}, run: { rival: { lead: 'musk0', past: 3, met: 1, won: 0 } } });
  assert.equal(conditionHolds('rival >= 1', S), true);
  assert.equal(conditionHolds('rival >= 2', S), false);
  assert.equal(
    conditionHolds('rival0 = win', storyStateOf({ story: { rival0: 'win' }, meta: {} })),
    true,
    'the flag rival0 is still a flag'
  );
});

// Project Story S2: the story checks (tools/story-checks.mjs, run by check-data.mjs): the game's data passes them, and
// a fault planted for each check makes that check speak.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, fn } from './setup-real.mjs';
import { storyChecks } from '../story-checks.mjs';

const L = Object.fromEntries(
  ['parseScript', 'conditionTree', 'conditionProblem', 'conditionNames'].map(k => [k, fn(k)])
);
const copy = () => structuredClone(GAME_DATA);
const run = G => storyChecks(G, L);

test('the game’s scripts pass the story checks, with no warnings', () => {
  assert.deepEqual(run(copy()), { problems: [], warnings: [] });
});

test('each planted fault is found', () => {
  /** [what the fault is, how to plant it, 'problems' or 'warnings', a word the message holds] */
  const cases = [
    ['a script that doesn’t read', G => G.trainers.crude.script.push('sett met_x'), 'problems', 'did you mean "set"'],
    ['a line without an id', G => G.trainers.crude.script.splice(1, 0, '  Hi.'), 'problems', 'has no line id'],
    ['an id used twice', G => G.trainers.crude.script.push(G.trainers.chad.script[1].trim()), 'problems', 'is also'],
    ['an unknown speaker', G => G.trainers.crude.script.push('Nobody: Hi. #l:zz01'), 'problems', 'speaker Nobody'],
    ['an unknown trainer', G => G.trainers.crude.script.push('battle nobody'), 'problems', 'battle nobody'],
    ['an unknown item', G => G.trainers.crude.script.push('give unobtainium'), 'problems', 'no such item'],
    ['an unknown place', G => G.trainers.crude.script.push('go nowhere'), 'problems', 'go nowhere'],
    ['an unknown script', G => G.trainers.crude.script.push('call story:nope'), 'problems', 'call story:nope'],
    ['a condition that names no trainer', G => (G.trainers.crude.when = 'beat:nobody'), 'problems', 'beat:nobody'],
    [
      'a stage the quest lacks',
      G => ((G.story.quests.q = { stages: ['a'] }), G.trainers.crude.script.push('quest q b')),
      'problems',
      'no stage b',
    ],
    [
      'a flag read but set nowhere',
      G => G.trainers.crude.script.push('if made_up_flag', '  Hm. #l:zz02'),
      'warnings',
      'made_up_flag, set nowhere',
    ],
    [
      'a flag set that story.json lacks',
      G => G.trainers.crude.script.push('set another_flag'),
      'warnings',
      'not in story.json',
    ],
    ['items taken, never given', G => G.trainers.crude.script.push('take taxbreak'), 'warnings', 'given nowhere'],
    [
      'a once key two scripts share',
      G => (
        G.trainers.crude.script.push('once k1', '  A. #l:zz03'),
        G.trainers.alta.script.push('once k1', '  B. #l:zz04')
      ),
      'warnings',
      'once key k1',
    ],
    ['a quest stage nothing reaches', G => (G.story.quests.q = { stages: ['a'] }), 'warnings', 'moves it to a'],
    [
      'a gate that can never open',
      G => (G.locations.find(l => l.id === 'marigold').requires = 'never_set_flag'),
      'problems',
      "can't come true",
    ],
  ];
  for (const [what, plant, kind, word] of cases) {
    const G = copy();
    plant(G);
    const R = run(G);
    assert.ok(
      R[kind].some(m => m.includes(word)),
      `${what}: ${JSON.stringify(R)}`
    );
  }
});

test('the reach check: a gate opens when a script the player can get to sets its flag', () => {
  const G = copy();
  G.story.flags.gate_open = 'test';
  G.locations.find(l => l.id === 'marigold').requires = 'gate_open';
  assert.deepEqual(run(G).problems, [], 'a flag story.json lists counts as one the game sets');
  delete G.story.flags.gate_open;
  G.maps.copperleaf.people[0].script.push('set gate_open');
  assert.deepEqual(run(G).problems, [], 'set by Juniper, in Copperleaf, where the game starts');
});

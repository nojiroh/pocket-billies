// Project Story S2: the story checks (tools/story-checks.mjs, run by check-data.mjs): the game's data passes them, and
// a fault planted for each check makes that check speak.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, fn, modules } from './setup-real.mjs';
import { storyChecks, storyFindings } from '../story-checks.mjs';

const L = Object.fromEntries(
  ['parseScript', 'conditionTree', 'conditionProblem', 'conditionNames'].map(k => [k, fn(k)])
);
const copy = () => structuredClone(GAME_DATA);
/* RL-5: a place behind a gate, joined to the start by a road (on the test map test_tiny), planted in a copy: the
   game's own places outside the start are parked */
const gated = (G, requires) => {
  G.locations.push({ ...G.locations[0], id: 'gate_test', name: 'Gate test', mapId: 'test_tiny', requires });
  G.roads.push({
    id: 'road:start-gate_test',
    kind: 'seam',
    a: { map: G.rules.start.locationId, exit: 'x' },
    b: { map: 'test_tiny', exit: 'y' },
  });
  return G;
};
const run = G => storyChecks(G, L);

test('the game’s scripts pass the story checks, with no warnings', () => {
  assert.deepEqual(run(copy()), { problems: [], warnings: [] });
});

test('each planted fault is found', () => {
  /** [what the fault is, how to plant it, 'problems' or 'warnings', a word the message holds] */
  const cases = [
    ['a script that doesn’t read', G => G.trainers.crude.script.push('sett met_x'), 'problems', 'did you mean "set"'],
    ['a line without an id', G => G.trainers.crude.script.splice(1, 0, '  Hi.'), 'problems', 'has no line id'],
    [
      'an id used twice',
      G => G.trainers.crude.script.push(G.story.scripts.chosen.script[0].trim()),
      'problems',
      'is also',
    ],
    ['an unknown speaker', G => G.trainers.crude.script.push('Nobody: Hi. #l:zz01'), 'problems', 'speaker Nobody'],
    ['an unknown trainer', G => G.trainers.crude.script.push('battle nobody'), 'problems', 'battle nobody'],
    ['an unknown item', G => G.trainers.crude.script.push('give unobtainium'), 'problems', 'no such item'],
    ['an unknown place', G => G.trainers.crude.script.push('go nowhere'), 'problems', 'go nowhere'],
    ['an unknown script', G => G.trainers.crude.script.push('call story:nope'), 'problems', 'call story:nope'],
    ['a condition that names no trainer', G => (G.trainers.crude.when = 'beat:nobody'), 'problems', 'beat:nobody'],
    [
      'a favour whose quest story.json lacks (RL-S2)',
      G =>
        (G.relations = { gift: {}, people: { kappi: { levels: [], favour: { quest: 'nope', check: 'last:won' } } } }),
      'problems',
      'quest nope, no such quest',
    ],
    [
      'a favour whose quest has no stage done, and a check that names no fact (RL-S2)',
      G => (
        (G.story.quests.q = { stages: ['asked'] }),
        (G.relations = { gift: {}, people: { kappi: { levels: [], favour: { quest: 'q', check: 'last:wins' } } } })
      ),
      'problems',
      'quest q has no stage done',
    ],
    [
      'a favour check that names no fact (RL-S2)',
      G => (
        (G.story.quests.q = { stages: ['asked', 'done'] }),
        (G.relations = { gift: {}, people: { kappi: { levels: [], favour: { quest: 'q', check: 'last:wins' } } } })
      ),
      'problems',
      'last:wins, no such fact',
    ],
    [
      'a last team that names no type nor Billie (RL-S2)',
      G => (G.trainers.crude.when = 'lastteam:Plaid'),
      'problems',
      'lastteam:Plaid, not a type',
    ],
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
    ['items taken, never given', G => G.trainers.crude.script.push('take potion'), 'warnings', 'given nowhere'],
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
    ['a gate that can never open', G => gated(G, 'never_set_flag'), 'problems', "can't come true"],
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
  gated(G, 'gate_open');
  assert.deepEqual(run(G).problems, [], 'a flag story.json lists counts as one the game sets');
  delete G.story.flags.gate_open;
  G.maps.copperleaf.people[0].script.push('set gate_open');
  assert.deepEqual(run(G).problems, [], 'set by Juniper, in Copperleaf, where the game starts');
});

test('a finding says where it is: file, script and line, or the thing and field', () => {
  const G = copy();
  G.trainers.crude.script.push('sett met_x');
  G.maps.copperleaf.people[0].when = 'beat:nobody';
  gated(G, 'item:nope');
  const F = storyFindings(G, L);
  const at = word => F.find(f => f.message.includes(word));
  const n = G.trainers.crude.script.length - 1;
  assert.deepEqual(
    { ...at('did you mean "set"') },
    {
      level: 'problem',
      file: 'trainers/crude.json',
      script: 'trainer:crude',
      line: n,
      message: 'unknown command "sett", did you mean "set"?',
      text: `trainers/crude.json trainer:crude, line ${n + 1}: unknown command "sett", did you mean "set"?`,
    }
  );
  assert.deepEqual(
    [at('beat:nobody').file, at('beat:nobody').thing, at('beat:nobody').field],
    ['maps/copperleaf.json', 'person:' + G.maps.copperleaf.people[0].id, 'when']
  );
  assert.deepEqual([at('item:nope').thing, at('item:nope').field], ['place:gate_test', 'requires']);
  assert.deepEqual(
    run(G).problems,
    F.filter(f => f.level === 'problem').map(f => f.text),
    'the strings are the findings’ texts'
  );
});

test('a requires that doesn’t read is a problem, not a crash of the reach check', () => {
  const G = gated(copy(), 'itme:x');
  assert.ok(run(G).problems.some(m => m.includes('did you mean "item:"')));
});

test('the Studio’s story preview reads a preset as the game does after applyStoryPreset', () => {
  const { storyPreviewSave, storyPreviewAllows, storyNamesIn } = modules['story-checks'];
  const conds = [
    'rival0 = win',
    'met_blake0',
    '!met_chad',
    'beat:chad',
    'beat:blake0 and !beat:chad',
    'badges >= 3',
    'visited:copperleaf',
    'visited:vinyl_works',
    'billie:musk',
    'billie:swift1',
    'coin:gold_pyramid >= 3',
  ];
  for (const preset of Object.keys(GAME_DATA.story.presets)) {
    const game = fn('newSave')();
    game.story = {};
    fn('applyStoryPreset')(game, preset);
    const pv = storyPreviewSave(GAME_DATA, { preset });
    for (const c of conds)
      assert.equal(
        storyPreviewAllows(GAME_DATA, { when: c }, pv),
        fn('storyAllows')({ when: c }, game),
        `${preset}: ${c}`
      );
  }
  const pv = storyPreviewSave(GAME_DATA, {
    preset: 'after-opening',
    flags: { met_blake0: false, x: true, 'beat:crude': true },
  });
  assert.deepEqual([pv.story.met_blake0, pv.story.x, pv.flags.crude], [undefined, 1, 1]);
  assert.equal(storyPreviewAllows(GAME_DATA, { when: 'beat:crude', unless: 'x' }, pv), false);
  assert.equal(storyPreviewAllows(GAME_DATA, { when: 'itme:x' }, pv), false, 'a when that doesn’t read hides it');
  assert.deepEqual(storyNamesIn([{ when: 'a and beat:crude' }, { unless: '!b or a' }, {}]), {
    flags: ['a', 'b'],
    beat: ['crude'],
  });
});

test('Play from here: the switches go through the address and into a save as the preview reads them', () => {
  const { storySwitches, storySwitchesText, storySwitchesOf } = modules['story-checks'];
  const F = { met_x: true, rival0: false, 'beat:crude': true };
  assert.equal(storySwitchesText(F), 'met_x,!rival0,beat:crude');
  assert.deepEqual(storySwitchesOf('met_x,!rival0,beat:crude, ,<b>,'), F);
  const save = storySwitches({ story: { rival0: 'win' } }, GAME_DATA, F);
  assert.deepEqual([save.story.met_x, save.story.rival0, save.flags.crude], [1, undefined, 1]);
  assert.ok(save.seats.includes(GAME_DATA.trainers.crude.seat.id), 'and the badge');
});

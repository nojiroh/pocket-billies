// Project Story S1: the story's scripts, read (game/js/logic/script-parse.js) and played with a stub stage
// (game/js/logic/script.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-real.mjs';

const { parseScript, scriptProblem } = modules['script-parse'];
const { runScript } = modules.script;

/** a stage that writes down what it is asked to play; choose() takes the answers given, in order */
function stub(answers = []) {
  const said = [];
  const stage = {
    said,
    say: l => said.push(`${l.who ? l.who + ': ' : ''}${l.expr ? `[${l.expr}] ` : ''}${l.text}`),
    choose: ops => {
      said.push('? ' + ops.map(o => o.text).join(' | '));
      return answers.shift() ?? 0;
    },
  };
  for (const c of ['battle', 'heal', 'walk', 'face', 'camera', 'wait', 'fade', 'go', 'dressing-room', 'music'])
    stage[c] = args => said.push(`<${c}${args && args.length ? ' ' + args.join(' ') : ''}>`);
  return stage;
}
const play = async (lines, o = {}) => {
  const stage = stub(o.answers);
  const save = o.save || { story: {}, items: {}, pyramids: {} };
  await runScript(parseScript(lines), stage, { save, id: 'test', ...o });
  return { said: stage.said, save };
};

test('a line: [expression], Name: and the text, each optional', () => {
  assert.deepEqual(parseScript(['[happy] Juniper: There you are, dear.', 'Hello.', 'chosen: Hi.', '[sad] Oh.']), [
    { k: 'say', line: 0, who: 'Juniper', expr: 'happy', text: 'There you are, dear.' },
    { k: 'say', line: 1, who: null, expr: null, text: 'Hello.' },
    { k: 'say', line: 2, who: 'chosen', expr: null, text: 'Hi.' },
    { k: 'say', line: 3, who: null, expr: 'sad', text: 'Oh.' },
  ]);
});

test('mistakes are errors on their line, with "did you mean" for a command', () => {
  const cases = [
    [['Hi.', 'sett met_x'], 'unknown command "sett", did you mean "set"?', 1],
    [['oh no.'], 'unknown command "oh" (a line of dialogue starts with a capital, [expression] or Name:)', 0],
    [['gve honey'], 'unknown command "gve", did you mean "give"?', 0],
    [['Hi.', '   Bye.'], 'indented by an odd number of spaces (two per level)', 1],
    [['Hi.', '  Bye.'], 'indented further than the line above allows', 1],
    [['if met_x'], 'nothing under it (indent the lines it holds by two more spaces)', 0],
    [['if met_x and', '  Hi.'], 'a flag or a term expected at the end (in "met_x and", at 10)', 0],
    [['else', '  Hi.'], '"else" without an "if" above it', 0],
    [['if a', '  Hi.', 'else', '  Ho.', 'else', '  Hu.'], '"else" after "else"', 4],
    [['choice'], 'a choice needs options ("> ..." under it)', 0],
    [['choice', '  Hi.'], 'only options ("> ...") go under a choice', 1],
    [['> Yes'], 'an option ("> ...") belongs right under a choice', 0],
    [['cycle', '  Hi.'], 'only entries ("- ...") go under cycle', 1],
    [['give honey lots'], '"give": n is a number, not "lots"', 0],
    [['battle'], '"battle" takes trainer', 0],
    [['heal now'], '"heal" takes nothing', 0],
    [['choice', '  > [if itme:x] Hm'], 'unknown term "itme:", did you mean "item:"? (in "itme:x", at 1)', 1],
    [['Hi, {nmae}.'], 'unknown slot "{nmae}", did you mean "{name}"?', 0],
    [['music'], '"music" takes piece', 0],
  ];
  for (const [lines, message, line] of cases)
    assert.deepEqual(scriptProblem(lines), { message, line }, lines.join(' / '));
});

test('if / elif / else, set, clear, give, take, quest, end', async () => {
  const lines = [
    'if met_juniper',
    '  Juniper: Back again.',
    'elif item:honey >= 2',
    '  Juniper: Honey!',
    'else',
    '  Juniper: Who are you?',
    '  set met_juniper',
    'set rival0 win',
    'give honey 2',
    'give coin:gold_pyramid',
    'take potion 5',
    'quest ledger asked',
    'clear gone',
    'end',
    'Never said.',
  ];
  const { said, save } = await play(lines, { save: { story: { gone: 1 }, items: { potion: 1 }, pyramids: {} } });
  assert.deepEqual(said, ['Juniper: Who are you?']);
  assert.deepEqual(save.story, { met_juniper: 1, rival0: 'win', quests: { ledger: 'asked' } });
  assert.deepEqual(save.items, { potion: 0, honey: 2 });
  assert.deepEqual(save.pyramids, { gold_pyramid: 1 });
  assert.deepEqual((await play(lines, { save })).said, ['Juniper: Back again.']);
});

test('choice: options with [if], [once], and the lines under each', async () => {
  const lines = [
    'Nacre: Well?',
    'choice',
    '  > Tell me about the pipes.',
    '    Nacre: They carry gold.',
    '  > [if item:ledger] Show her the ledger.',
    '    Nacre: So it’s true.',
    '  > [once] Who are you?',
    '    Nacre: The curator.',
    'Nacre: Go on, then.',
  ];
  const save = { story: {}, items: {}, pyramids: {} };
  let r = await play(lines, { save, answers: [1] });
  assert.deepEqual(r.said, [
    'Nacre: Well?',
    '? Tell me about the pipes. | Who are you?',
    'Nacre: The curator.',
    'Nacre: Go on, then.',
  ]);
  save.items.ledger = 1;
  r = await play(lines, { save, answers: [1] });
  assert.deepEqual(r.said, [
    'Nacre: Well?',
    '? Tell me about the pipes. | Show her the ledger.',
    'Nacre: So it’s true.',
    'Nacre: Go on, then.',
  ]);
});

test('once, cycle and seq remember, by key or by script and line', async () => {
  const lines = [
    'once hello',
    '  Hi, new face.',
    'cycle',
    '  - One.',
    '  - Two.',
    '    And a half.',
    'seq',
    '  - A.',
    '  - B.',
  ];
  const save = { story: {}, items: {}, pyramids: {} };
  const runs = [];
  for (let i = 0; i < 4; i++) runs.push((await play(lines, { save })).said.join(' '));
  assert.deepEqual(runs, ['Hi, new face. One. A.', 'Two. And a half. B.', 'One. B.', 'Two. And a half. B.']);
  assert.deepEqual(save.story, { once: { hello: 1 }, cycles: { 'test@2': 0, 'test@6': 1 } });
});

test('slots: {name} from the stage, {caught} and {badges} from the save; music is played', async () => {
  const save = { story: {}, items: {}, pyramids: {}, caught: { musk0: 1, swift0: 1 }, seats: ['a'] };
  const lines = ['music rival', '{name}! {caught} caught, {badges} badge.'];
  assert.deepEqual((await play(lines, { save, slots: { name: () => 'Rae' } })).said, [
    '<music rival>',
    'Rae! 2 caught, 1 badge.',
  ]);
  assert.equal((await play(['Hi, {name}.'], { save })).said[0], 'Hi, Trainer.');
});

test('call plays another script; the speaker comes from the run when a line names none', async () => {
  const other = parseScript(['From the other one.', 'heal']);
  const { said } = await play(['call other', 'Done.'], {
    speaker: 'juniper',
    scripts: id => (id === 'other' ? other : null),
  });
  assert.deepEqual(said, ['juniper: From the other one.', '<heal>', 'juniper: Done.']);
  await assert.rejects(play(['call nope']), /no script "nope" to call/);
});

test('a checkpoint hands over where to carry on, and a resumed run asks nothing twice', async () => {
  const lines = [
    'Blake: Hey!',
    'if !beat:chad',
    '  choice',
    '    > Fine.',
    '      battle chad',
    '      Blake: Again!',
    '    > No.',
    'Blake: Bye.',
  ];
  const marks = [];
  const first = await play(lines, { onCheckpoint: p => marks.push(p) });
  assert.deepEqual(first.said, ['Blake: Hey!', '? Fine. | No.', '<battle chad>', 'Blake: Again!', 'Blake: Bye.']);
  assert.deepEqual(marks, [[1, 0, 0, 0, 1]], 'after the battle: line 1 (if), clause 0, choice, option 0, its 2nd line');
  /* the battle won (beat:chad now holds); a resume still goes on inside the branch it was in */
  const save = { story: {}, items: {}, pyramids: {}, flags: { chad: 1 } };
  const again = await play(lines, { save, resume: marks[0] });
  assert.deepEqual(again.said, ['Blake: Again!', 'Blake: Bye.']);
});

test('skipping: lines and camera work are skipped, every change is still made, a battle stops the skip', async () => {
  const control = { skipping: true };
  const lines = [
    'Hi.',
    'camera far',
    'set a',
    'choice',
    '  > First.',
    '    give honey',
    '  > Second.',
    'battle chad',
    'After.',
  ];
  const { said, save } = await play(lines, { control });
  assert.deepEqual(said, ['<battle chad>', 'After.']);
  assert.deepEqual(save.story.a, 1);
  assert.deepEqual(save.items.honey, 1);
  assert.equal(control.skipping, false);
});

test('line ids: kept apart from the text; once, cycle and [once] remember by them, so lines added above move nothing', async () => {
  assert.deepEqual(parseScript(['[happy] Juniper: Hi. #l:3fa9'])[0], {
    k: 'say',
    line: 0,
    who: 'Juniper',
    expr: 'happy',
    text: 'Hi.',
    id: '3fa9',
  });
  const v1 = [
    'once',
    '  First time. #l:aa01',
    'cycle',
    '  - One. #l:aa02',
    '  - Two. #l:aa03',
    'choice',
    '  > [once] Ask. #l:aa04',
    '  > Go. #l:aa05',
  ];
  const v2 = ['Something new above. #l:bb01', ...v1];
  const save = { story: {}, items: {}, pyramids: {} };
  assert.deepEqual((await play(v1, { save })).said, ['First time.', 'One.', '? Ask. | Go.']);
  assert.deepEqual((await play(v2, { save })).said, ['Something new above.', 'Two.', '? Go.']);
});

test('the Studio’s reference is built from the tables: every command, keyword, slot and condition kind', () => {
  const { scriptReference, SCRIPT_COMMANDS, KEYWORDS, SCRIPT_SLOTS } = modules['script-parse'];
  const { CONDITION_KINDS } = modules.conditions;
  const R = scriptReference(),
    uses = R.flatMap(s => s.rows.map(r => r.use.split(/[\s:]/)[0]));
  for (const k of [...Object.keys(SCRIPT_COMMANDS), ...KEYWORDS, ...Object.keys(CONDITION_KINDS)])
    assert.ok(uses.includes(k), k);
  for (const k of Object.keys(SCRIPT_SLOTS)) assert.ok(uses.includes(`{${k}}`), k);
  assert.ok(
    R.flatMap(s => s.rows).every(r => r.about),
    'each row says what it does'
  );
  const set = R.find(s => s.title === 'Commands').rows.find(r => r.use.startsWith('set '));
  assert.equal(set.use, 'set flag [value]');
  assert.equal(R.find(s => s.title === 'Commands').rows.find(r => r.use.startsWith('battle')).tag, 'checkpoint');
});

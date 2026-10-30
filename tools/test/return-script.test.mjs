// Intro track IN-4, the way back: the Bureau's pickup after the first run (story.json pickup-won, pickup-lost) and
// the lab scene (game/data/cutscenes/return.json). Each says its lines in order with its own commands between
// (return-said.json: drafts for the owner, changed on purpose with the words), the lab scene is filmed on the
// opening's set (tools/build-copperleaf.mjs keeps the two the same), the way back says nothing of the Hollow Earth (the
// owner: none in the intro), and a run on its way back is a run that is over and still loads (a reload goes to the lab).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const { parseScript, SCRIPT_COMMANDS } = modules['script-parse'];
const { runScript } = modules.script;
const { cutsceneNames } = modules['cutscene-set'];
const { storyFindings } = modules['story-checks'];
const { plainOf, parseLine } = modules['line-markup'];
const { talkSkinOf } = modules['talk-skins'];
const { runEnded } = modules['run-state'];
const SAID = JSON.parse(readFileSync(new URL('./return-said.json', import.meta.url), 'utf8'));
const RETURN = GAME_DATA.cutscenes.return;
const OPENING = GAME_DATA.cutscenes.opening;
const SPEAKERS = GAME_DATA.story.speakers;
const OWN = ['dressing-room', 'payout', 'portal', 'camera', 'walk'];

/** plays a script on a stage that writes down the lines (plain text), the stamps and its own commands */
async function play(lines, id, slots = {}) {
  const said = [];
  const stage = new Proxy(
    {
      say: l => {
        const P = parseLine(l.text),
          stamp = P.events.filter(e => e.kind === 'stamp').map(e => e.v)[0];
        said.push({ who: SPEAKERS[l.who] || l.who, expr: l.expr, text: plainOf(l.text), ...(stamp ? { stamp } : {}) });
      },
      choose: () => 0,
    },
    {
      get: (t, k) =>
        t[k] ||
        (args => {
          if (!OWN.includes(k)) return;
          /* the story stage's run-up and walks over; a cutscene's own camera and walks aren't written down */
          if (k === 'camera' && args[0] !== 'run-up') return;
          if (k === 'walk' && args.join(' ') !== `${args[0]} beside me`) return;
          said.push({ cmd: [k, ...args].join(' ') });
        }),
    }
  );
  await runScript(parseScript(lines), stage, {
    save: { story: {} },
    id,
    speaker: null,
    slots: Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, () => v])),
  });
  return said;
}
const story = id => GAME_DATA.story.scripts[id];

test('the lab scene says its lines, in order, with the dressing room and the payout between', async () => {
  const said = await play(RETURN.script, 'cutscene:return', { name: 'Pat', place: 'Copperleaf Town' });
  assert.deepEqual(said, SAID.return);
  const cmds = said.filter(s => s.cmd).map(s => s.cmd);
  assert.deepEqual(cmds, ['dressing-room', 'payout'], 'you make yourself up, then Kappi tallies the run');
  /* Kappi names the square portal as the Bureau's (the crash's "square of light" paid off), after the payout */
  const after = said.slice(said.findIndex(s => s.cmd === 'payout'));
  assert.ok(
    after.some(s => s.who === 'kappi' && /square/.test(s.text) && /Bureau/.test(s.text)),
    'Kappi names the portal'
  );
  /* the expeditions: Skyline Station, a new region every trip, what you keep: about 4-6 lines after the payout */
  const lines = after.filter(s => s.text);
  assert.ok(lines.length >= 4 && lines.length <= 8, `${lines.length} lines after the payout`);
  for (const re of [/Skyline Station/, /new region/, /comes? home|stays/])
    assert.ok(
      lines.some(s => re.test(s.text)),
      `the expeditions: ${re}`
    );
});

test('the pickup: two Bureau clerks run up, the stamp, the square portal, won or lost', async () => {
  for (const [id, stamp] of [
    ['pickup-lost', 'returned'],
    ['pickup-won', 'recovered'],
  ]) {
    const S = story(id),
      said = await play(S.script, 'story:' + id);
    assert.deepEqual(said, SAID[id], id);
    assert.equal(S.who, 'bureau_clerk_a');
    assert.deepEqual(
      said.filter(s => s.cmd).map(s => s.cmd),
      ['camera run-up', 'walk Intake beside me', 'walk Outtake beside me', 'portal'],
      id
    );
    assert.equal(
      said
        .filter(s => s.stamp)
        .map(s => s.stamp)
        .join(),
      stamp,
      `${id} stamps ${stamp}`
    );
    /* both clerks speak in the Bureau's bubble, the one that takes stamps */
    for (const who of ['bureau_clerk_a', 'bureau_clerk_b'])
      assert.equal(talkSkinOf(GAME_DATA.talkSkins, who), 'bureau', who);
    assert.ok(GAME_DATA.people.bureau_clerk_a && GAME_DATA.people.bureau_clerk_b, 'the clerks are people with a look');
  }
});

test('the way back says nothing of the Hollow Earth, the crust or the airship (the owner: none in the intro)', () => {
  const all = [...RETURN.script, ...story('pickup-lost').script, ...story('pickup-won').script].join('\n');
  for (const re of [/Hollow Earth/i, /Inner Sun/i, /crust/i, /airship/i, /caption/]) assert.doesNotMatch(all, re);
});

test('the lab scene is filmed on the opening’s set, outside the lab door, and names only its own spots and shots', () => {
  assert.equal(RETURN.map, 'copperleaf');
  assert.deepEqual(RETURN.spots, OPENING.spots, 'build-copperleaf.mjs moves both with the lab door');
  assert.deepEqual(RETURN.shots, OPENING.shots);
  assert.deepEqual(RETURN.clear, OPENING.clear);
  const N = cutsceneNames(parseScript(RETURN.script));
  for (const n of N.filter(x => x.kind === 'shot')) assert.ok(RETURN.shots[n.name], `shot ${n.name}`);
  for (const n of N.filter(x => x.kind === 'spot'))
    assert.ok(RETURN.spots[n.name] || n.name in SPEAKERS || n.name === 'you', n.name);
  const src = readFileSync(new URL('../build-copperleaf.mjs', import.meta.url), 'utf8');
  assert.match(src, /D\.cutscenes\.return/, 'build-copperleaf.mjs keeps the lab scene on the set');
});

test('the way back’s commands: payout is a cutscene’s, portal the story stage’s; the stamps read', () => {
  assert.equal(SCRIPT_COMMANDS.payout.group, 'opening');
  assert.ok(SCRIPT_COMMANDS.payout.checkpoint, 'skipping stops at the payout');
  assert.equal(SCRIPT_COMMANDS.portal.group, undefined);
  for (const w of ['returned', 'recovered'])
    assert.deepEqual(
      parseLine(`Done.[stamp=${w}]`).events.map(e => [e.kind, e.v]),
      [['stamp', w]]
    );
  const G = structuredClone(GAME_DATA);
  G.story.scripts['pickup-lost'].script = ['payout', ...G.story.scripts['pickup-lost'].script];
  const F = storyFindings(G).filter(f => f.level === 'problem');
  assert.ok(
    F.some(f => f.script === 'story:pickup-lost' && /payout plays only in a cutscene/.test(f.message)),
    'payout outside a cutscene is a problem'
  );
});

test('a run on its way back is over: no battle starts, no giving up, no second ending (a reload goes to the lab)', () => {
  assert.equal(runEnded({ at: { phase: 'return', battle: -1, won: 0 } }), true);
  assert.equal(runEnded({ at: { phase: 'payout', battle: -1, won: 1 } }), true);
  assert.equal(runEnded({ at: { phase: 'walk', battle: -1 } }), false);
});

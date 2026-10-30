// Intro track IN-5, the cold open: game/data/cutscenes/crash.json, New game's crash scene on the prepared first run's
// landing. It says its lines in order with its own commands between (crash-said.json: drafts for the owner, changed on
// purpose with the words), it is filmed on the landing (its spots are the crash site's, game/data/firstRun.json), it
// names only its own spots, shots and people (the story checks), it says nothing of the Hollow Earth (the owner: none
// in the intro), and the run waiting for it at phase 'crash' is a valid run that isn't over.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const { parseScript } = modules['script-parse'];
const { runScript } = modules.script;
const { storyFindings } = modules['story-checks'];
const { plainOf } = modules['line-markup'];
const { RUN_PHASES, runEnded } = modules['run-state'];
const SAID = JSON.parse(readFileSync(new URL('./crash-said.json', import.meta.url), 'utf8'));
const CRASH = GAME_DATA.cutscenes.crash;
const SPEAKERS = GAME_DATA.story.speakers;
const OWN = ['throw-coins', 'pick-starter'];

/** plays the script on a stage that writes down the lines (plain text) and its own commands */
async function play(lines, slots = {}) {
  const said = [];
  const stage = new Proxy(
    { say: l => said.push({ who: SPEAKERS[l.who] || l.who, expr: l.expr, text: plainOf(l.text) }), choose: () => 0 },
    { get: (t, k) => t[k] || (args => (OWN.includes(k) ? said.push({ cmd: [k, ...args].join(' ') }) : undefined)) }
  );
  await runScript(parseScript(lines), stage, {
    save: { story: {} },
    id: 'cutscene:crash',
    speaker: null,
    slots: Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, () => v])),
  });
  return said;
}

test('the crash says its lines, in order, with the coins and the pick between', async () => {
  assert.deepEqual(await play(CRASH.script, { starter: 'Emberox' }), SAID);
});

test('it is filmed on the prepared landing, on the crash site’s spots', () => {
  assert.equal(CRASH.landing, true);
  assert.equal(CRASH.map, 'first_run');
  assert.deepEqual(CRASH.spots, GAME_DATA.firstRun.crash.spots);
  for (const k of ['me', 'chosen', 'kappi', 'star1', 'star2', 'star3', 'wreck']) assert.ok(CRASH.spots[k], k);
});

test('the story checks find nothing wrong in it, and it never mentions the Hollow Earth', () => {
  const mine = G => storyFindings(G).filter(f => f.script === 'cutscene:crash' && f.level === 'problem');
  assert.deepEqual(mine(GAME_DATA), []);
  /* and they do read it: a shot and a spot it doesn't have are found */
  const G = structuredClone(GAME_DATA);
  G.cutscenes.crash.script = ['camera nowhere', 'walk Kappi attic', ...G.cutscenes.crash.script];
  const P = mine(G)
    .map(f => f.message)
    .join(' | ');
  assert.ok(/nowhere/.test(P) && /attic/.test(P), P);
  assert.ok(!/hollow earth|the crust|inner sun/i.test(CRASH.script.join('\n')));
});

test('the run waiting for the crash scene is at phase crash: valid, and not over', () => {
  assert.ok(RUN_PHASES.includes('crash'));
  assert.equal(runEnded({ at: { phase: 'crash' } }), false);
});

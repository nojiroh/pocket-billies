// Project Story S2: every conversation, played from its script on a stub, says what the game said before the move
// (talk-before-scripts.json, recorded in the game from personTalk, trainerTalk, rivalScene, talkChosen,
// storyAfterRival and storyEnding): the same words, expressions, speakers and order, and the same battle.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { data, fn } from './setup-real.mjs';

const BEFORE = JSON.parse(readFileSync(new URL('./talk-before-scripts.json', import.meta.url), 'utf8'));
const { parseScript, runScript } = Object.fromEntries(['parseScript', 'runScript'].map(n => [n, fn(n)]));
const STORY = data.STORY_DATA,
  people = Object.values(data.gameData.maps).flatMap(sc => sc.people || []);
const NAME = 'Rae';

/** plays a script on a stub: what is said as { who, expr, text }, battles and healing as { cmd } */
async function play(id, lines, owner, save) {
  const said = [];
  const stage = {
    say: l => said.push({ who: STORY.speakers[l.who] || l.who, expr: l.expr, text: l.text }),
    choose: () => 0,
    battle: ([t]) => said.push({ cmd: 'battle ' + t }),
    heal: () => said.push({ cmd: 'heal' }),
  };
  for (const c of ['camera', 'walk', 'face', 'music', 'fade', 'wait']) stage[c] = () => {};
  await runScript(parseScript(lines), stage, { save, id, speaker: owner, slots: { name: () => NAME } });
  return said;
}
const blank = () => ({ story: {}, flags: {}, items: {}, coins: {}, caught: {}, seats: [] });

test('people: the first meeting, then visit after visit', async () => {
  for (const P of people) {
    const save = blank(),
      visits = [];
    for (const _ of BEFORE['person:' + P.id]) visits.push(await play('person:' + P.id, P.script, P.who, save));
    assert.deepEqual(visits, BEFORE['person:' + P.id], P.id);
  }
});

test('trainers: the first meeting (a run-up scene for some), met, beaten; then the battle', async () => {
  for (const [id, T] of Object.entries(data.TRAINERS)) {
    const save = blank(),
      first = await play('trainer:' + id, T.script, T.who, save);
    save.story['met_' + id] = 1;
    const met = await play('trainer:' + id, T.script, T.who, save);
    save.flags[id] = 1;
    const beaten = await play('trainer:' + id, T.script, T.who, save);
    assert.deepEqual([first, met, beaten], BEFORE['trainer:' + id], id);
  }
});

test('Hazel in the lab: the Index, badges and where Blake went', async () => {
  const H = STORY.scripts.chosen;
  for (const c of BEFORE.hazel) {
    const save = blank();
    save.caught = Object.fromEntries(
      Object.keys(data.SPECIES)
        .slice(0, c.caught)
        .map(k => [k, 1])
    );
    save.seats = ['a', 'b', 'c'].slice(0, c.badges);
    if (c.blake !== 'none') save.flags.chad = 1;
    if (c.blake === 'chad2') save.flags.chad2 = 1;
    assert.deepEqual(await play('story:chosen', H.script, H.who, save), c.said, JSON.stringify(c));
  }
});

test('after Blake’s first battle (won, lost, skipped) and the ending', async () => {
  const A = STORY.scripts['blake-first-battle'];
  for (const o of ['win', 'lose', null]) {
    const save = blank();
    save.story.rival0 = o === null ? 'skip' : o;
    assert.deepEqual(await play('story:blake-first-battle', A.script, A.who, save), BEFORE['after-rival:' + o][0], o);
  }
  const E = STORY.scripts.ending;
  assert.deepEqual(await play('story:ending', E.script, E.who, blank()), BEFORE['ending:vinylla2'][0]);
});

test('the trainers who run up to you are the ones whose first meeting differed from the next', () => {
  for (const [id, T] of Object.entries(data.TRAINERS)) {
    const [first, met] = BEFORE['trainer:' + id];
    assert.equal(!!T.runsUp, JSON.stringify(first) !== JSON.stringify(met), id);
  }
});

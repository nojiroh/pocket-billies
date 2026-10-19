// Project Story S1: story.json, the one list of story flags (game/data/story.json, logic/script.js setStoryFlag).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, fn, hooks, startedSave } from './setup-real.mjs';

test('a flag is known by name, by pattern (met_<id>) or as a record the story keeps', () => {
  const known = fn('storyFlagKnown');
  for (const k of ['rival0', 'met_juniper', 'read_coin_standard', 'legend_x0', 'talks', 'once']) assert.ok(known(k), k);
  for (const k of ['met_', 'rival1', 'zzz']) assert.ok(!known(k), k);
});

test('every flag the lore unlocks with is in story.json', () => {
  const L = data.gameData.lore;
  const unlocks = [...L.clues, ...L.world, ...L.story, ...L.legends, ...Object.values(L.people)]
    .map(e => e.unlock || '')
    .filter(u => u.startsWith('flag:'));
  assert.ok(unlocks.length > 5);
  for (const u of unlocks) assert.ok(fn('storyFlagKnown')(u.slice(5)), `${u} is not in story.json`);
});

test('setStoryFlag sets the flag in the save; one story.json lacks is a data warning, once', () => {
  const s = startedSave('musk0');
  const before = data.DATA_WARN.length;
  fn('setStoryFlag')('met_juniper');
  fn('setStoryFlag')('rival0', 'win');
  assert.equal(data.DATA_WARN.length, before);
  fn('setStoryFlag')('made_up_flag');
  fn('setStoryFlag')('made_up_flag', 2);
  assert.deepEqual(data.DATA_WARN.slice(before), ['story flag made_up_flag is not in story.json']);
  assert.deepEqual(hooks.saveData.story, { met_juniper: 1, rival0: 'win', made_up_flag: 2 });
  assert.equal(s, hooks.saveData);
});

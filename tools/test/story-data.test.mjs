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

test('when / unless and chapters read the save', () => {
  const allows = fn('storyAllows'),
    chapterMap = fn('chapterMap'),
    s = { story: { met_cass: 1 }, flags: { chad: 1 }, items: {}, coins: {}, caught: {}, seats: [] };
  assert.equal(allows({}, s), true);
  assert.equal(allows({ when: 'met_cass' }, s), true);
  assert.equal(allows({ when: 'met_cass', unless: 'beat:chad' }, s), false);
  assert.equal(allows({ unless: 'beat:chad2' }, s), true);
  assert.equal(allows(null, s), false);
  const S = data.STORY_DATA,
    was = S.chapters;
  S.chapters = { two: { when: 'beat:chad', maps: { copperleaf: 'copperleaf@two' } } };
  try {
    assert.equal(chapterMap('copperleaf', s), 'copperleaf@two');
    assert.equal(chapterMap('marigold', s), 'marigold');
    assert.equal(chapterMap('copperleaf', { ...s, flags: {} }), 'copperleaf');
  } finally {
    S.chapters = was;
  }
});

test('a place with requires is closed until it holds, with its locked line', () => {
  const s = startedSave('musk0'),
    L = data.LOCATIONS,
    i = L.findIndex(l => !l.gate && !l.ride);
  Object.assign(L[i], { requires: 'met_cass', locked: 'The gate is shut.' });
  try {
    assert.equal(fn('canEnter')(i), false);
    assert.equal(fn('gateText')(L[i]), 'The gate is shut.');
    s.story.met_cass = 1;
    assert.equal(fn('canEnter')(i), true);
  } finally {
    delete L[i].requires;
    delete L[i].locked;
  }
});

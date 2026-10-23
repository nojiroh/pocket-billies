// Sound track SND-6: the buttons' four sounds (game/js/logic/ui-sounds.js): which one a button makes, from its data-a
// and classes, and the notes each plays.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { UI_SOUND_NAMES, uiSoundFor, uiSoundVoices } from '../../game/js/logic/ui-sounds.js';

const UI = JSON.parse(readFileSync(new URL('../../game/data/music.json', import.meta.url), 'utf8')).ui;

test('a disabled button buzzes; cancel and confirm by class or data-a; anything else selects', () => {
  assert.equal(uiSoundFor({ a: 'mb', cls: ['pb', 'gold', 'wide'], disabled: true }, UI), 'cant');
  assert.equal(uiSoundFor({ a: 'mb', cls: ['pb', 'gold', 'wide'] }, UI), 'confirm');
  assert.equal(uiSoundFor({ a: 'mb', cls: ['pb', 'quiet', 'wide'] }, UI), 'cancel');
  assert.equal(uiSoundFor({ a: 'bback', cls: ['bt', 'back', 'wide'] }, UI), 'cancel');
  assert.equal(uiSoundFor({ a: 'scrim', cls: [] }, UI), 'cancel');
  assert.equal(uiSoundFor({ a: 'shopbuy', cls: [] }, UI), 'confirm');
  assert.equal(uiSoundFor({ a: 'tab', cls: [] }, UI), 'select');
  assert.equal(uiSoundFor({ a: 'mb', cls: ['pb', 'red', 'wide'] }, UI), 'select');
  assert.equal(uiSoundFor({ cls: ['gold'] }, null), 'select');
});

test('every sound has notes; the tick is as before (1320 Hz-ish, 25 ms)', () => {
  for (const k of UI_SOUND_NAMES) assert.ok(uiSoundVoices(UI.sounds[k]).length >= 1, k);
  assert.deepEqual(
    uiSoundVoices(UI.sounds.select).map(v => [v.at, v.midi, v.type, v.dur]),
    [[0, 88, 'p50', 0.025]]
  );
  const [a, b] = uiSoundVoices(UI.sounds.confirm);
  assert.equal(b.midi - a.midi, 7, 'confirm rises a fifth');
  const [c, d] = uiSoundVoices(UI.sounds.cancel);
  assert.equal(c.midi - d.midi, 7, 'cancel falls a fifth');
});

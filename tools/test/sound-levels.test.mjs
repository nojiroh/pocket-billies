// Sound track SND-1: the gain each sound bus gets from Settings → Sound (game/js/audio/levels.js). The module is pure,
// so it loads in plain Node; sound.js applies these numbers to the Web Audio buses. No audio here.
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window ??= globalThis;
const { bedDuck, mixTrim, soundLevel, soundLevels } = await import('../../game/js/audio/levels.js');
const MIX = JSON.parse(
  (await import('node:fs')).readFileSync(new URL('../../game/data/music.json', import.meta.url), 'utf8')
).mix;

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);

test('with no preferences each bus has the level the sliders show by default', () => {
  for (const prefs of [undefined, null, {}]) {
    const L = soundLevels(prefs);
    near(L.master, 0.9);
    near(L.music, 0.55 * 0.55);
    near(L.sfx, 0.8 * 0.8);
    near(L.world, 0.25);
    near(L.amb, 0.25 * 0.9);
  }
  assert.equal(soundLevel({}, 'music'), 0.55);
});

test('a slider value is squared, and 0 is silent', () => {
  const L = soundLevels({ master: 0.5, music: 0.5, sfx: 0.5, world: 0.5, amb: 0.5 });
  near(L.master, 0.9 * 0.25);
  near(L.music, 0.25);
  near(L.sfx, 0.25);
  near(L.world, 0.25);
  near(L.amb, 0.25 * 0.9);
  const Z = soundLevels({ master: 1, music: 0, sfx: 0, world: 0, amb: 0 });
  assert.deepEqual([Z.music, Z.sfx, Z.world, Z.amb], [0, 0, 0, 0]);
  near(Z.master, 0.9);
});

test('mute silences the master bus and keeps every level', () => {
  const prefs = { master: 0.7, music: 0.3, sfx: 0.6, world: 0.2, amb: 0.4 },
    on = soundLevels(prefs),
    off = soundLevels({ ...prefs, mute: true });
  assert.equal(off.master, 0);
  for (const k of ['music', 'sfx', 'world', 'amb']) assert.equal(off[k], on[k], k);
  assert.equal(soundLevel({ ...prefs, mute: true }, 'master'), 0.7);
});

test('a level stored as text, as a slider hands it over, reads as its number', () => {
  near(soundLevels({ music: '0.4' }).music, 0.16);
  assert.equal(soundLevel({ sfx: '0' }, 'sfx'), 0);
});

test("SND-6: the trims are music.json's mix; the data's mix is today's trims, so nothing sounds different", () => {
  for (const prefs of [undefined, { master: 0.7, music: 0.3, amb: 0.9 }, { mute: 1 }]) {
    const A = soundLevels(prefs),
      B = soundLevels(prefs, MIX);
    for (const k of ['master', 'music', 'sfx', 'world', 'amb']) near(A[k], B[k]);
  }
  near(soundLevels({}, { music: 0.5 }).music, 0.55 * 0.55 * 0.5);
  near(soundLevels({}, { master: 1 }).master, 1);
  assert.equal(mixTrim({}, 'amb'), 0.9);
  assert.equal(mixTrim(null, 'master'), 0.9);
});

test("SND-6: the beds come down by the mix's dB while a four-voice song plays, not otherwise", () => {
  near(bedDuck({ bedsUnderSong: -3 }, true), Math.pow(10, -3 / 20));
  near(bedDuck({ bedsUnderSong: -3 }, false), 1);
  near(bedDuck({}, true), 1);
  near(bedDuck(MIX, true), Math.pow(10, MIX.bedsUnderSong / 20));
  assert.ok(MIX.bedsUnderSong === -3);
});

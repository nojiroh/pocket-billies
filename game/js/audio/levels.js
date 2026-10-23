'use strict';
/* ================= SOUND LEVELS =================
   The gain each sound bus gets from Settings → Sound (sound track SND-1). A slider's value (0 to 1, stored in the
   save's preferences) is squared, so half way along sounds about half as loud; 0 is silent. Mute silences the master
   bus and keeps every level for later; UI-7a: each other bus has its own mute too (preferences.mutes), which keeps
   its level the same way. The master bus leaves a little headroom for the compressor after it, and the ambience bed
   sits a little under the world sounds. SND-6: those trims are music.json's mix (the Studio sets them); without one,
   the values below. Pure: no audio and no page, so the unit tests run it in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  AMBIENCE_TRIM: [() => AMBIENCE_TRIM],
  MASTER_HEADROOM: [() => MASTER_HEADROOM],
  MIX_DEFAULTS: [() => MIX_DEFAULTS],
  SOUND_DEFAULTS: [() => SOUND_DEFAULTS],
  bedDuck: [() => bedDuck, v => (bedDuck = v)],
  mixTrim: [() => mixTrim, v => (mixTrim = v)],
  soundLevel: [() => soundLevel, v => (soundLevel = v)],
  soundLevels: [() => soundLevels, v => (soundLevels = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const SOUND_DEFAULTS = { master: 1, music: 0.55, sfx: 0.8, world: 0.5, amb: 0.5 };
const MASTER_HEADROOM = 0.9;
const AMBIENCE_TRIM = 0.9;
/* SND-6: music.json mix when it leaves a bus out: today's trims (master's headroom, the ambience a little under) */
const MIX_DEFAULTS = { master: MASTER_HEADROOM, music: 1, sfx: 1, world: 1, amb: AMBIENCE_TRIM };
/* one slider's value: the preference when there is one, else its default */
export function soundLevel(prefs, k) {
  const p = prefs || {};
  return p[k] == null ? SOUND_DEFAULTS[k] : +p[k];
}
/* SND-6: a bus's trim from music.json mix, else its default */
export function mixTrim(mix, k) {
  const v = mix && mix[k];
  return typeof v === 'number' ? v : MIX_DEFAULTS[k];
}
/* SND-6: what the world and ambience beds are multiplied by: music.json mix bedsUnderSong (dB) while a four-voice song
   plays, else 1 */
export function bedDuck(mix, songOn) {
  const db = mix && typeof mix.bedsUnderSong === 'number' ? mix.bedsUnderSong : 0;
  return songOn ? Math.pow(10, db / 20) : 1;
}
/* every bus's gain: the slider squared, times the mix's trim (SND-6); world and ambience are multiplied by their
   fade-in where they are applied */
export function soundLevels(prefs, mix) {
  const p = prefs || {},
    mutes = p.mutes || {},
    sq = k => (mutes[k] ? 0 : soundLevel(p, k) * soundLevel(p, k) * mixTrim(mix, k));
  return {
    master: p.mute ? 0 : sq('master'),
    music: sq('music'),
    sfx: sq('sfx'),
    world: sq('world'),
    amb: sq('amb'),
  };
}

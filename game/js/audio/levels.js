'use strict';
/* ================= SOUND LEVELS =================
   The gain each sound bus gets from Settings → Sound (sound track SND-1). A slider's value (0 to 1, stored in the
   save's preferences) is squared, so half way along sounds about half as loud; 0 is silent. Mute silences the master
   bus and keeps every level for later. The master bus leaves a little headroom for the compressor after it, and the
   ambience bed sits a little under the world sounds. Pure: no audio and no page, so the unit tests run it in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  AMBIENCE_TRIM: [() => AMBIENCE_TRIM],
  MASTER_HEADROOM: [() => MASTER_HEADROOM],
  SOUND_DEFAULTS: [() => SOUND_DEFAULTS],
  soundLevel: [() => soundLevel, v => (soundLevel = v)],
  soundLevels: [() => soundLevels, v => (soundLevels = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const SOUND_DEFAULTS = { master: 1, music: 0.55, sfx: 0.8, world: 0.5, amb: 0.5 };
const MASTER_HEADROOM = 0.9;
const AMBIENCE_TRIM = 0.9;
/* one slider's value: the preference when there is one, else its default */
export function soundLevel(prefs, k) {
  const p = prefs || {};
  return p[k] == null ? SOUND_DEFAULTS[k] : +p[k];
}
/* every bus's gain; world and ambience are multiplied by their fade-in where they are applied */
export function soundLevels(prefs) {
  const p = prefs || {},
    sq = k => soundLevel(p, k) * soundLevel(p, k);
  return {
    master: p.mute ? 0 : MASTER_HEADROOM * sq('master'),
    music: sq('music'),
    sfx: sq('sfx'),
    world: sq('world'),
    amb: sq('amb') * AMBIENCE_TRIM,
  };
}

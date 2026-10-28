// @ts-check
'use strict';
/* ================= UI SOUNDS (sound track SND-6) =================
   Four sounds for the buttons instead of one tick: select (the tick), confirm (a rising fifth), cancel (a falling
   one), can't (a dull buzz, for a disabled button). Which one a button makes is decided from what it already says
   about itself, its data-a and its classes (music.json ui: confirm and cancel each list classes and actions), so no
   screen changes. Each sound is a few notes (at, midi, len in s; wave, vol, slide). sound.js plays them. Logic only:
   no sound; runs in Node (tools/test/ui-sounds.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  UI_SOUND_NAMES: [() => UI_SOUND_NAMES],
  // @ts-expect-error -- replaced on purpose
  uiSoundFor: [() => uiSoundFor, v => (uiSoundFor = v)],
  // @ts-expect-error -- replaced on purpose
  uiSoundVoices: [() => uiSoundVoices, v => (uiSoundVoices = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the four, in the order the Studio shows them; UI-16a: then the UI's own four (a sheet opening, a card flip, a
 * count-up's end, a toast), which ui-motion.js and overlay.js play through sound.js's uiSound */
export const UI_SOUND_NAMES = ['select', 'confirm', 'cancel', 'cant', 'sheet', 'flip', 'count', 'toast'];

/**
 * which sound a pressed button makes
 * @param {{a?: string | null, cls?: string[], disabled?: boolean}} b its data-a, its classes (and a kit button's kind)
 * @param {{confirm?: {classes?: string[], actions?: string[]}, cancel?: {classes?: string[], actions?: string[]}}} rules music.json ui
 * @returns {string}
 */
export function uiSoundFor(b, rules) {
  if (b.disabled) return 'cant';
  const R = rules || {},
    cls = b.cls || [],
    is = (/** @type {{classes?: string[], actions?: string[]} | undefined} */ k) =>
      !!k && ((!!b.a && (k.actions || []).includes(b.a)) || cls.some(c => (k.classes || []).includes(c)));
  if (is(R.cancel)) return 'cancel';
  if (is(R.confirm)) return 'confirm';
  return 'select';
}

/**
 * the voices a UI sound plays: when each starts (s), its note, wave, length (s), volume, slide
 * @param {{notes: {at: number, midi: number, len: number, wave?: string, vol?: number, slide?: number}[]}} S
 */
export function uiSoundVoices(S) {
  return ((S && S.notes) || []).map(n => ({
    at: n.at,
    midi: n.midi,
    type: n.wave || 'p50',
    dur: n.len,
    vol: n.vol ?? 0.05,
    slide: n.slide ?? 0,
  }));
}

// @ts-check
'use strict';
/* ================= CRIES (sound track SND-3, SND-6) =================
   A Billy's cry, as Gen 1 made 151 from a few base cries: a base, a pitch and a length. SND-6: the bases are eight
   kinds (music.json cries.bases: beast, bird, slime, machine, fish, insect, ghost, suit), each its own few notes. A
   species sets base, pitch and length per stage (lines/*.json `cry`); what it leaves out comes from its id (a hash
   picks the kind and a pitch from 48 to 71). The low-HP cry is the same cry faster and a third down. sound.js plays
   cryVoices; the Studio's Billies page plays the same. RL-14: a bot's cry is the machine base, pitched by its build
   (cryOfBot). Logic only: no sound; runs in Node (tools/test/cries.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  CRY_LOW: [() => CRY_LOW],
  // @ts-expect-error -- replaced on purpose
  cryHash: [() => cryHash, v => (cryHash = v)],
  // @ts-expect-error -- replaced on purpose
  cryLowHealth: [() => cryLowHealth, v => (cryLowHealth = v)],
  // @ts-expect-error -- replaced on purpose
  cryOfBot: [() => cryOfBot, v => (cryOfBot = v)],
  // @ts-expect-error -- replaced on purpose
  cryRecipe: [() => cryRecipe, v => (cryRecipe = v)],
  // @ts-expect-error -- replaced on purpose
  cryVoices: [() => cryVoices, v => (cryVoices = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/**
 * the hash every cry came from before species set their own (the species id, e.g. bezos0)
 * @param {string} id
 */
export function cryHash(id) {
  let h = 0;
  for (const ch of String(id || '')) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return h;
}

/** @typedef {{at: number, note: number, len: number, wave?: string, vol?: number, slide?: number, vib?: number}} CryNote */
/** @typedef {{name?: string, wave: string, voices: CryNote[]}} CryBase */
/** @typedef {{base: string, wave: string, voices: CryNote[], pitch: number, length: number}} Cry */

/**
 * a species' cry: what it sets, the rest from its id
 * @param {string} id the species id
 * @param {{base?: string, pitch?: number, length?: number} | null | undefined} set the stage's `cry`
 * @param {Record<string, CryBase>} bases music.json cries.bases
 * @returns {Cry}
 */
export function cryRecipe(id, set, bases) {
  const h = cryHash(id),
    kinds = Object.keys(bases || {}),
    S = set || {};
  const base = S.base && bases[S.base] ? S.base : kinds[h % (kinds.length || 1)] || '';
  const B = (bases || {})[base] || { wave: 'p25', voices: [{ at: 0, note: 0, len: 0.18 }] };
  return {
    base,
    wave: B.wave,
    voices: B.voices,
    pitch: typeof S.pitch === 'number' ? S.pitch : 48 + (h % 24),
    length: typeof S.length === 'number' ? S.length : 1,
  };
}

/**
 * the voices a cry plays: when each starts after the cry does (s), its note, wave, length (s), volume, slide, vibrato
 * @param {Cry} C
 */
export function cryVoices(C) {
  return C.voices.map(v => ({
    at: v.at * C.length,
    type: v.wave || C.wave,
    midi: C.pitch + v.note,
    dur: v.len * C.length,
    vol: v.vol ?? 0.06,
    slide: v.slide ?? 1,
    vib: v.vib ?? 0,
  }));
}

/** SND-6: how the low-HP cry differs: a minor third down, a quarter faster */
export const CRY_LOW = { down: 3, speed: 0.75 };
/**
 * the cry when its Billy is low on health (the red zone): the same cry faster and a third down
 * @param {Cry} C
 * @returns {Cry}
 */
export function cryLowHealth(C) {
  return { ...C, pitch: C.pitch - CRY_LOW.down, length: C.length * CRY_LOW.speed };
}

/** RL-14: a bot's cry (what a species' `cry` sets): the machine base, a heavier torso lower (5 kg a semitone below 64),
 * a few semitones more from its sp's hash so two builds differ, the gem's length (a Volt gem quicker)
 * @param {string} sp a robot's sp ('bot:<gem>.<torso>.<armL>.<armR>.<legs>')
 * @param {{ parts: Record<string, { wt?: number }> }} robots robots.json
 * @returns {{ base: string, pitch: number, length: number }} */
export function cryOfBot(sp, robots) {
  const ids = String(sp || '')
      .slice(4)
      .split('.'),
    T = robots && robots.parts[ids[1]],
    wt = T && typeof T.wt === 'number' ? T.wt : 40;
  return {
    base: 'machine',
    pitch: Math.max(36, Math.min(76, 64 - Math.round(wt / 5) + (cryHash(sp) % 5))),
    length: ids[0] === 'volt' ? 0.8 : ids[0] === 'tide' ? 1.15 : 1,
  };
}

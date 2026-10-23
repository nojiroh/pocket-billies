// @ts-check
'use strict';
/* ================= CRIES (sound track SND-3) =================
   A Billy's cry, as Gen 1 made 151 from a few base cries: a base (music.json cries.bases: its wave), a pitch and a
   length. A species may set them per stage (lines/*.json `cry`); what it leaves out comes from its id, as every cry
   did before (a hash picks the base, a pitch from 48 to 71 and the slide). The cry is two notes: the base's wave
   sliding up, then a 25 % pulse a fourth higher sliding down. sound.js plays cryVoices; the Studio's Billies page
   plays the same. Logic only: no sound; runs in Node (tools/test/cries.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  cryHash: [() => cryHash, v => (cryHash = v)],
  // @ts-expect-error -- replaced on purpose
  cryLowHealth: [() => cryLowHealth, v => (cryLowHealth = v)],
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

/**
 * a species' cry: what it sets, the rest from its id
 * @param {string} id the species id
 * @param {{base?: number, pitch?: number, length?: number} | null | undefined} set the stage's `cry`
 * @param {{wave: string}[]} bases music.json cries.bases
 */
export function cryRecipe(id, set, bases) {
  const h = cryHash(id),
    n = (bases && bases.length) || 1,
    S = set || {};
  const base =
    Number.isInteger(S.base) && /** @type {number} */ (S.base) >= 0 && /** @type {number} */ (S.base) < n
      ? /** @type {number} */ (S.base)
      : h % n;
  return {
    base,
    wave: ((bases || [])[base] || {}).wave || 'p25',
    pitch: typeof S.pitch === 'number' ? S.pitch : 48 + (h % 24),
    length: typeof S.length === 'number' ? S.length : 1,
    slide: 1.5 + (h % 5) * 0.2,
  };
}

/**
 * the voices a cry plays: when each starts after the cry does (s), its note, wave, length (s), volume, slide, vibrato
 * @param {{wave: string, pitch: number, length: number, slide: number}} C
 */
export function cryVoices(C) {
  return [
    { at: 0, type: C.wave, midi: C.pitch, dur: 0.18 * C.length, vol: 0.07, slide: C.slide, vib: 2 },
    { at: 0.17 * C.length, type: 'p25', midi: C.pitch + 5, dur: 0.2 * C.length, vol: 0.06, slide: 0.6, vib: 0 },
  ];
}

/**
 * the cry when its Billy is low on health, for the Studio to preview (SND-6 decides what the game does): lower,
 * slower and shakier
 * @param {{wave: string, pitch: number, length: number, slide: number}} C
 */
export function cryLowHealth(C) {
  return { ...C, pitch: C.pitch - 3, length: C.length * 1.6, slide: 0.85 + (C.slide - 1.5) * 0.2 };
}

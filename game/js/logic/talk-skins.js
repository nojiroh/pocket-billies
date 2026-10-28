// @ts-check
'use strict';
/* ================= TALK SKINS (dialogue track DL-3) =================
   Who wears which speech bubble, and the numbers a bubble draws from its line (docs/phases/dialogue-track.md, "Every
   character has their own bubble" and "Motion with a cause"). The skins are data (game/data/talkSkins.json); talk.js
   puts the answer on the box, css/talk-skins.css draws it. Logic only: no DOM, runs in Node
   (tools/test/talk-skins.test.mjs). */

/** the skin a line wears: the caller's own (o.skin), the speaker's, a run trainer's class's, else the default
 * @param {any} data talkSkins.json @param {string} who the speaker id @param {{ skin?: string, cls?: string }} [o]
 * @returns {string} */
export function talkSkinOf(data, who, o = {}) {
  const D = data || {},
    S = D.skins || {},
    pick = (/** @type {any} */ id) => (typeof id === 'string' && S[id] ? id : '');
  return (
    pick(o.skin) ||
    pick((D.speakers || {})[who]) ||
    pick(o.cls && (D.classes || {})[o.cls]) ||
    pick(D.default) ||
    Object.keys(S)[0] ||
    'folk'
  );
}

/** a line's seed: a small whole number from its text and its speaker, the same every time it is said
 * @param {string} text @param {string} [who] */
export function talkSeed(text, who = '') {
  let h = 2166136261;
  for (const ch of `${who}|${text}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/** the bubble's tilt in degrees from its seed: up to ±max, never quite flat (at least a third of max either way)
 * @param {number} seed @param {number} max the Motion dial's tilt (degrees) @param {number} [strength] the skin's */
export function talkTilt(seed, max, strength = 1) {
  const m = Math.max(0, Number(max) || 0) * Math.max(0, Number.isFinite(strength) ? strength : 1);
  if (!m) return 0;
  const u = ((seed >>> 8) % 1000) / 999,
    side = seed & 1 ? 1 : -1;
  return Math.round(side * m * (1 / 3 + (2 / 3) * u) * 100) / 100;
}

/** which held variant of a jagged burst a line shows @param {number} seed @param {number} n how many there are */
export const talkVariant = (seed, n) => (n > 1 ? (seed >>> 4) % n : 0);

/** a folk speaker's seeded accent hue (degrees on the colour wheel), so each townsperson's bubble has its own colour
 * @param {string} who */
export const talkAccentHue = who => talkSeed('', who) % 360;

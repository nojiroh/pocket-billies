// @ts-check
'use strict';
/* ================= HOW A PERSON IS SEEN (characters track CH-1) =================
   What decides how a person's picture stands in a scene, apart from drawing it (person-art.js draws it).
   - Facing: a person's walk frames are drawn for four words (person-art.js personWalkFrames): 'up' (their back:
     walking away from a camera that looks along +z), 'down' (their front), 'side' (walking left) and 'sideR' (walking
     right). facingWord is the rule that picks one for a way across the screen and into it.
     A person turned by something in the world (walking, turning to someone, a trainer's spot) keeps a heading: radians
     about the up axis, 0 along +z, π/2 along +x (Math.atan2(x, z)), set with faceToward or faceWay. A plain word (a
     map's 'down', a cutscene's `face Chosen down`) has none: faceWord. People are only ever turned on runtime records
     (the player, a townsperson, a cutscene actor, a frame's record of a map person), never on a scene's own data.
   - A copy of a person's picture (the cutscene director's flat dark silhouette, or its mirrored reach) keeps the
     original's anchor and size: copiedAnchor.
   Logic only: no DOM, runs in Node (tools/test/person-view.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  WORD_HEADING: [() => WORD_HEADING],
  // @ts-expect-error -- replaced on purpose
  copiedAnchor: [() => copiedAnchor, v => (copiedAnchor = v)],
  // @ts-expect-error -- replaced on purpose
  faceToward: [() => faceToward, v => (faceToward = v)],
  // @ts-expect-error -- replaced on purpose
  faceWay: [() => faceWay, v => (faceWay = v)],
  // @ts-expect-error -- replaced on purpose
  faceWord: [() => faceWord, v => (faceWord = v)],
  // @ts-expect-error -- replaced on purpose
  facingWord: [() => facingWord, v => (facingWord = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/**
 * the word for a way across the screen and into it (`sx`: to the right, `az`: away from the camera); the walk view's
 * rule since alpha 0.1 (walk-view.js directionOf): sideways only when clearly more sideways than not, so a walk a
 * little off straight up or down keeps its back or front view
 * @param {number} sx @param {number} az @returns {'up' | 'down' | 'side' | 'sideR'}
 */
export function facingWord(sx, az) {
  return Math.abs(sx) > Math.abs(az) * 1.1 ? (sx > 0 ? 'sideR' : 'side') : az > 0 ? 'up' : 'down';
}

/** each word as a heading in the world, seen by a camera at yaw 0 (walk/camera.js: it looks along +z) */
export const WORD_HEADING = Object.freeze({ up: 0, sideR: Math.PI / 2, down: Math.PI, side: -Math.PI / 2 });

/** @typedef {{ dir?: string, head?: number | null, headDir?: string | null }} Facing a runtime record that faces */

/**
 * turn a person to face along (mx, mz) in the world: `dir` the word (what logic reads: fishing's cast, the minimap),
 * `head` the heading itself and `headDir` the word it was set with, so a later plain write of `dir` alone leaves a
 * `head` that no longer counts. Standing on the spot (no way at all) faces down, as directionOf(0, 0) always has.
 * @param {Facing} o @param {number} mx @param {number} mz @returns {string} the word
 */
export function faceToward(o, mx, mz) {
  if (!(Math.abs(mx) > 1e-9 || Math.abs(mz) > 1e-9)) return faceWay(o, 'down');
  o.dir = facingWord(mx, mz);
  o.head = Math.atan2(mx, mz);
  o.headDir = o.dir;
  return o.dir;
}

/**
 * turn a person to a world way given as a word (a ladder's wall, the way a fishing spot faces): the word and its
 * heading (WORD_HEADING)
 * @param {Facing} o @param {string} word @returns {string}
 */
export function faceWay(o, word) {
  o.dir = word;
  o.head = WORD_HEADING[/** @type {keyof typeof WORD_HEADING} */ (word)] ?? Math.PI;
  o.headDir = word;
  return word;
}

/**
 * give a person a plain word, shown as it is on the screen whichever way the camera looks (a map's or a keeper's
 * 'down', a cutscene's `face Chosen down`, a fresh view's 'down'): no heading
 * @param {Facing} o @param {string} word @returns {string}
 */
export function faceWord(o, word) {
  o.dir = word;
  o.head = null;
  o.headDir = null;
  return word;
}

/**
 * where a copy of a person's picture stands and how big it is. A person's picture carries its anchor (`ax`, `ay`:
 * the point between the feet, in its own pixels), its size (`ppm`: pixels a metre) and its flat light (`noNormal`)
 * (person-art.js personFrame, creatureFrame). A copy without them falls back to the old anchor (16, 40) and 42 px a
 * metre (walk/frame-items.js personItem): today's people (66.5 px a metre) come out 1.58 times too tall and sunk into
 * the ground. A mirrored copy's anchor is mirrored across the picture. Only what the original has is copied.
 * @param {{ width?: number, naturalWidth?: number, ax?: number, ay?: number, ppm?: number, noNormal?: boolean }} src
 * @param {boolean} [mirror] the copy is the original flipped left to right
 * @returns {{ ax?: number, ay?: number, ppm?: number, noNormal?: boolean }}
 */
export function copiedAnchor(src, mirror = false) {
  /** @type {{ ax?: number, ay?: number, ppm?: number, noNormal?: boolean }} */
  const out = {};
  if (src.ax != null) out.ax = mirror ? (src.width || src.naturalWidth || 0) - src.ax : src.ax;
  if (src.ay != null) out.ay = src.ay;
  if (src.ppm != null) out.ppm = src.ppm;
  if (src.noNormal) out.noNormal = true;
  return out;
}

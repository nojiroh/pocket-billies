// @ts-check
'use strict';
/* ================= HOW A PERSON IS SEEN (characters track CH-1) =================
   What decides how a person's picture stands in a scene, apart from drawing it (person-art.js draws it).
   - Facing: a person's walk frames are drawn for four words (person-art.js personWalkFrames): 'up' (their back:
     walking away from a camera that looks along +z), 'down' (their front), 'side' (walking left) and 'sideR' (walking
     right). facingWord is the rule that picks one for a way across the screen and into it.
   - A copy of a person's picture (the cutscene director's flat dark silhouette, or its mirrored reach) keeps the
     original's anchor and size: copiedAnchor.
   Logic only: no DOM, runs in Node (tools/test/person-view.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  copiedAnchor: [() => copiedAnchor, v => (copiedAnchor = v)],
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

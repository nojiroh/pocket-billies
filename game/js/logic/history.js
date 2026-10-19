// @ts-check
'use strict';
/* ================= HISTORY (studio track ST-2) =================
   The Studio's one undo, as a stack. Two kinds of step share one order:
   - data: the snapshot of the data (a JSON string) before an edit. The current snapshot is `last`.
   - art: a patch of a picture, `{ art: path, before, after }`, each a box of pixels `{ x, y, width, height, data }`
     (or the whole picture when its size changed, `whole: true`). Art does not change `last`.
   Undoing a data step swaps `last` with it; undoing art hands the step back to put `before` on the picture. Logic
   only: no DOM, runs in Node (tools/test/history.test.mjs). studio/js/studio-app.js keeps it in studioState. */
/** @typedef {{ x: number, y: number, width: number, height: number, data: Uint8ClampedArray }} Patch */
/** @typedef {{ art: string, before: Patch, after: Patch, whole?: boolean }} ArtStep */
/** @typedef {{ undo: (string | ArtStep)[], redo: (string | ArtStep)[], last: string | null }} History */
/** @typedef {{ kind: 'data', snap: string } | { kind: 'art', step: ArtStep, put: Patch }} Undone */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  HISTORY_ART_BYTES: [() => HISTORY_ART_BYTES],
  HISTORY_STEPS: [() => HISTORY_STEPS],
  // @ts-expect-error -- replaced on purpose
  historyArt: [() => historyArt, v => (historyArt = v)],
  historyBytes: [() => historyBytes],
  // @ts-expect-error -- replaced on purpose
  historyCommit: [() => historyCommit, v => (historyCommit = v)],
  // @ts-expect-error -- replaced on purpose
  historyRedo: [() => historyRedo, v => (historyRedo = v)],
  // @ts-expect-error -- replaced on purpose
  historyTrim: [() => historyTrim, v => (historyTrim = v)],
  // @ts-expect-error -- replaced on purpose
  historyUndo: [() => historyUndo, v => (historyUndo = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** at most this many steps, and at most this many bytes of pictures in them; the oldest go first */
export const HISTORY_STEPS = 80;
export const HISTORY_ART_BYTES = 64 * 1024 * 1024;

export const historyBytes = (/** @type {string | ArtStep} */ s) =>
  typeof s === 'string' ? 0 : s.before.data.length + s.after.data.length;
export function historyTrim(/** @type {History} */ H) {
  let bytes = H.undo.reduce((n, s) => n + historyBytes(s), 0);
  while (H.undo.length > HISTORY_STEPS || (bytes > HISTORY_ART_BYTES && H.undo.length > 1))
    bytes -= historyBytes(/** @type {string | ArtStep} */ (H.undo.shift()));
}
/** the data now (a snapshot): a step when it differs from the last one. True when one was added */
export function historyCommit(/** @type {History} */ H, /** @type {string} */ snap) {
  if (snap === H.last) return false;
  if (H.last) H.undo.push(H.last);
  H.redo = [];
  H.last = snap;
  historyTrim(H);
  return true;
}
/** a picture changed: a step */
export function historyArt(/** @type {History} */ H, /** @type {ArtStep} */ step) {
  H.undo.push(step);
  H.redo = [];
  historyTrim(H);
}
/** one step back: what to put back (data: the snapshot to restore; art: the patch to put on the picture), or null */
export function historyUndo(/** @type {History} */ H) {
  const s = H.undo.pop();
  if (s == null) return null;
  if (typeof s !== 'string') {
    H.redo.push(s);
    return /** @type {Undone} */ ({ kind: 'art', step: s, put: s.before });
  }
  if (H.last != null) H.redo.push(H.last);
  H.last = s;
  return /** @type {Undone} */ ({ kind: 'data', snap: s });
}
/** one step forward again, as historyUndo */
export function historyRedo(/** @type {History} */ H) {
  const s = H.redo.pop();
  if (s == null) return null;
  if (typeof s !== 'string') {
    H.undo.push(s);
    return /** @type {Undone} */ ({ kind: 'art', step: s, put: s.after });
  }
  if (H.last != null) H.undo.push(H.last);
  H.last = s;
  return /** @type {Undone} */ ({ kind: 'data', snap: s });
}

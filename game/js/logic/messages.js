// @ts-check
'use strict';
/* ================= MESSAGES (phase 06) =================
   How toasts queue, merge and time out, and which pending windows are real choices. The rules from
   docs/phases/06-plan.md "Messages": one toast at a time; the same message again while it shows, or while it waits,
   becomes one toast with a count ("Found an item ×3") instead of a second one; a toast shows for TOAST_MS, less when
   several wait. Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  TOAST_MERGE_MS: [() => TOAST_MERGE_MS],
  TOAST_MS: [() => TOAST_MS],
  TOAST_MS_BUSY: [() => TOAST_MS_BUSY],
  // @ts-expect-error -- replaced on purpose
  toastAdd: [() => toastAdd, v => (toastAdd = v)],
  // @ts-expect-error -- replaced on purpose
  toastItem: [() => toastItem, v => (toastItem = v)],
  // @ts-expect-error -- replaced on purpose
  toastText: [() => toastText, v => (toastText = v)],
  // @ts-expect-error -- replaced on purpose
  toastTime: [() => toastTime, v => (toastTime = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @typedef {{ text: string, count: number, at: number }} Toast */

export const TOAST_MS = 2500;
export const TOAST_MS_BUSY = 1300;
/** the same message within this time of the last one joins it */
export const TOAST_MERGE_MS = 3000;

/** a toast as the queue keeps it; older code and the checks push plain strings, which count once
 * @param {Toast | string} t @param {number} now @returns {Toast} */
export function toastItem(t, now) {
  return typeof t === 'string' ? { text: t, count: 1, at: now } : t;
}

/** adds text to the queue, or joins the toast on screen or waiting with the same text
 * @param {Toast | false | string} showing @param {Array<Toast | string>} queue @param {string} text @param {number} now
 * @returns {'showing' | 'queued' | 'new'} where it went: joined the one on screen, joined a waiting one, or queued */
export function toastAdd(showing, queue, text, now) {
  if (showing && typeof showing === 'object' && showing.text === text && now - showing.at < TOAST_MERGE_MS) {
    showing.count++;
    showing.at = now;
    return 'showing';
  }
  for (let i = queue.length - 1; i >= 0; i--) {
    const q = queue[i];
    if (typeof q === 'object' && q.text === text) {
      q.count++;
      q.at = now;
      return 'queued';
    }
  }
  queue.push({ text, count: 1, at: now });
  return 'new';
}

/** how long a toast stays, by how many wait behind it @param {number} waiting */
export function toastTime(waiting) {
  return waiting > 2 ? TOAST_MS_BUSY : TOAST_MS;
}

/** what the pill says @param {Toast} t */
export function toastText(t) {
  return t.count > 1 ? `${t.text} ×${t.count}` : t.text;
}

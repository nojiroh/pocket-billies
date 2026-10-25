// @ts-check
'use strict';
/* ================= HELD ITEMS (roguelite track RL-12c) =================
   One held-item slot per Billie (roguelite-track.md 9.6 27; PokeRogue-like). A held item is an items.json item with
   `hold` effect rows (logic/effects.js fxOfBillie reads them in battle). It comes from the bag and goes back to it:
   giving one takes it out of the bag (the one held before goes back), taking it off puts it back, and a run's end takes
   every held item off first, so the payout counts them like the bag's other items (the owner, 2026-10-25: held items
   last one run). Logic only: no DOM (tools/test/held.test.mjs). */
/** @import { Billy } from '../../types/save-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  heldAllOff: [() => heldAllOff],
  // @ts-expect-error -- replaced on purpose
  heldGive: [() => heldGive, v => (heldGive = v)],
  heldIds: [() => heldIds],
  // @ts-expect-error -- replaced on purpose
  heldTake: [() => heldTake, v => (heldTake = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @typedef {Record<string, { hold?: unknown[] }>} HeldItems */

/** the held items of items.json, by id @param {HeldItems} items */
export const heldIds = items =>
  Object.keys(items)
    .filter(k => Array.isArray(items[k].hold) && items[k].hold.length)
    .sort();

/** take a Billie's held item off, back into the bag; false when it holds none
 * @param {{ items: Record<string, number> }} s @param {Billy} m */
export function heldTake(s, m) {
  if (!m.held) return false;
  s.items[m.held] = (s.items[m.held] || 0) + 1;
  delete m.held;
  return true;
}

/** give a Billie a held item from the bag (the one it held before goes back); false when the bag has none or it isn't
 * a held item @param {{ items: Record<string, number> }} s @param {Billy} m @param {string} id @param {HeldItems} items */
export function heldGive(s, m, id, items) {
  if (!heldIds(items).includes(id) || !(s.items[id] > 0) || m.held === id) return false;
  heldTake(s, m);
  s.items[id]--;
  m.held = id;
  return true;
}

/** take every held item off these Billies, into the bag (a run's end); how many came off
 * @param {{ items: Record<string, number> }} s @param {Billy[]} list */
export const heldAllOff = (s, list) => list.reduce((n, m) => n + (heldTake(s, m) ? 1 : 0), 0);

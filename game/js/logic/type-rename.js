// @ts-check
'use strict';
/* ================= TYPE RENAME (Studio plan Phase 6, T6.6, docs/plans/studio-roguelite-improvement-plan.md) =================
   A type's id is written wherever the data names a type. Renaming a type in the Studio's Types section (or deleting
   it, to = null) rewrites every one of those places, so the data stays whole and check-data stays green.
   Logic only: no DOM, runs in Node (tools/test/type-rename.test.mjs). studio/js/data-editors.js uses it. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  renameTypeIn: [() => renameTypeIn, v => (renameTypeIn = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** renames type `from` to `to` everywhere the data names it; `to` null removes it (a move or robot part becomes Normal, a
 * Billie loses it, a rule takes the first type left, a Loophole's damage row counts for any type)
 * @param {any} D the game data @param {string} from @param {string | null} to */
export function renameTypeIn(D, from, to) {
  D.types.forEach((/** @type {any} */ t) => {
    t.strong = t.strong.map((/** @type {string} */ x) => (x === from ? to : x)).filter(Boolean);
    t.weak = t.weak.map((/** @type {string} */ x) => (x === from ? to : x)).filter(Boolean);
  });
  Object.values(D.moves).forEach((/** @type {any} */ m) => {
    if (m.t === from) m.t = to || 'None';
  });
  D.lines.forEach((/** @type {any} */ L) => {
    L.types = L.types.map((/** @type {string[]} */ a) => {
      const r = a.map(x => (x === from ? to : x)).filter(Boolean);
      return r.length ? r : ['None'];
    });
    /* RO-1: a regional form's swap names types as keys and values; a swap from or to a deleted type goes */
    for (const F of L.forms || []) {
      /** @type {Record<string, string>} */
      const swap = {};
      for (const [a, b] of Object.entries(F.swap || {})) {
        const a2 = a === from ? to : a,
          b2 = b === from ? to : b;
        if (a2 && b2) swap[a2] = b2;
      }
      F.swap = swap;
    }
  });
  /* Studio plan F17: the robots' parts and gems, the roster board, the types that ride on water and a Loophole's
     damage row name types too */
  const robots = D.robots || {};
  for (const P of [...Object.values(robots.parts || {}), ...Object.values(robots.gems || {})])
    if (/** @type {any} */ (P).type === from) /** @type {any} */ (P).type = to || 'None';
  for (const r of D.roster || [])
    if (Array.isArray(r.types))
      r.types = r.types.map((/** @type {string} */ x) => (x === from ? to : x)).filter(Boolean);
  const ride = D.rules.ride;
  if (ride && Array.isArray(ride.types))
    ride.types = ride.types.map((/** @type {string} */ x) => (x === from ? to : x)).filter(Boolean);
  for (const L of Object.values(D.relics || {}))
    for (const f of /** @type {any} */ (L).fx || [])
      if (f.type === from) {
        if (to) f.type = to;
        else delete f.type; /* a damage row for any type */
      }
  /* a deleted type is still in D.types here (the Studio removes it after): the rules take the first other one */
  const R = D.rules.battle,
    left = to || (D.types.find((/** @type {any} */ t) => t.id !== from) || { id: 'None' }).id;
  if (R.shockType === from) R.shockType = left;
  if (R.spinType === from) R.spinType = left;
  /* RL-R1: a mini-boss leader's type (its badge's: a region picks its leaders by it) takes the first other one too, and
     a region theme's lean goes with its type */
  for (const T of Object.values(D.trainers || {}))
    if (T && /** @type {any} */ (T).type === from) /** @type {any} */ (T).type = left;
  for (const T of Object.values((D.regions && D.regions.themes) || {})) {
    const lean = /** @type {any} */ (T).types || {};
    if (!Object.hasOwn(lean, from)) continue;
    /** @type {Record<string, number>} */
    const out = {};
    for (const [k, w] of Object.entries(lean))
      if (k !== from) out[k] = w;
      else if (to) out[to] = w;
    /** @type {any} */ (T).types = out;
  }
}

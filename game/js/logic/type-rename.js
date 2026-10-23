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
/** renames type `from` to `to` everywhere the data names it; `to` null removes it (a move becomes Normal, a Billie
 * loses it, a rule takes the first type left)
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
  });
  const R = D.rules.battle;
  if (R.shockType === from) R.shockType = to || D.types[0].id;
  if (R.spinType === from) R.spinType = to || D.types[0].id;
}

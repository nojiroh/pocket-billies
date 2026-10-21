// @ts-check
'use strict';
/* ================= RANCH STATE (roguelite track RL-3) =================
   The ranch, a hub building, kept in the save as saveData.ranch: the Billies kept there (by uid; they stay in
   saveData.box), the ones training between runs, the breeding pairs and the passive income. RL-3 fixes the shape and
   the load check only; the ranch itself comes in RL-9 (store, keep, train) and RL-10 (breeding, income). Logic only:
   no DOM, runs in Node (tools/test/ranch-state.test.mjs). */
/** @import { Ranch } from '../../types/save-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { META_MAX, wholeIn } from './meta-state.js';
/* eslint-disable no-func-assign */
expose({
  RANCH_MOST: [() => RANCH_MOST],
  RANCH_TIME: [() => RANCH_TIME],
  // @ts-expect-error -- replaced on purpose
  newRanch: [() => newRanch, v => (newRanch = v)],
  // @ts-expect-error -- replaced on purpose
  ranchFill: [() => ranchFill, v => (ranchFill = v)],
  // @ts-expect-error -- replaced on purpose
  validRanch: [() => validRanch, v => (validRanch = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @returns {Ranch} */
export function newRanch() {
  return { pens: [], trainees: [], nursery: [], income: { rate: 0, bank: 0, lastAt: 0 } };
}
export const RANCH_MOST = 500,
  RANCH_TIME = 1e13;
/** the load check for saveData.ranch: strict, like validSave */
/** @param {any} o @returns {boolean} */
export function validRanch(o) {
  const uid = v => typeof v === 'string' && v.length > 0 && v.length <= 64,
    plain = v => !!v && typeof v === 'object' && !Array.isArray(v) && !Object.hasOwn(v, '__proto__'),
    list = v => Array.isArray(v) && v.length <= RANCH_MOST;
  if (!plain(o) || !list(o.pens) || !list(o.trainees) || !list(o.nursery) || !plain(o.income)) return false;
  if (!o.pens.every(uid) || new Set(o.pens).size !== o.pens.length) return false;
  if (!o.trainees.every(t => plain(t) && uid(t.uid) && wholeIn(t.at, 0, RANCH_TIME))) return false;
  if (
    !o.nursery.every(
      n =>
        plain(n) &&
        uid(n.a) &&
        uid(n.b) &&
        n.a !== n.b &&
        (n.mode === 'safe' || n.mode === 'risky') &&
        wholeIn(n.at, 0, RANCH_TIME) &&
        wholeIn(n.ready, n.at, RANCH_TIME)
    )
  )
    return false;
  const i = o.income;
  return (
    Number.isFinite(i.rate) &&
    i.rate >= 0 &&
    i.rate <= 1e9 &&
    wholeIn(i.bank, 0, META_MAX) &&
    wholeIn(i.lastAt, 0, RANCH_TIME)
  );
}
/** a stored ranch filled out with anything new; one that still fails the check starts again */
/** @param {any} o @returns {Ranch} */
export function ranchFill(o) {
  const base = newRanch(),
    given = o && typeof o === 'object' && !Array.isArray(o) ? o : {},
    filled = Object.assign(base, given, { income: Object.assign(base.income, given.income || {}) });
  return validRanch(filled) ? filled : newRanch();
}

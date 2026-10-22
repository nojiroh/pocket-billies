// @ts-check
'use strict';
/* ================= DATA CHECKS (Studio plan Phase 1, T1.3: one set of data checks for CI and the Studio) =================
   Pure checks on the game data, run by tools/check-data.mjs (CI). T1.3 moves check-data's other checks here so the
   Studio's Check runs the same ones. Logic only: no DOM, runs in Node (tools/test/data-checks.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  dataUnderscoreKeys: [() => dataUnderscoreKeys, v => (dataUnderscoreKeys = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** T1.6 (plan F7): the paths of keys starting with `_` (and longer than `_`) in a data file's value. The Studio
 * leaves such keys out of every save (they are its in-memory caches), so one in a file would vanish on the next
 * proposal @param {unknown} v @param {string} [at] @returns {string[]} */
export function dataUnderscoreKeys(v, at = '') {
  if (!v || typeof v !== 'object') return [];
  const out = [];
  for (const [k, x] of Object.entries(v)) {
    const p = at ? `${at}.${k}` : k;
    if (!Array.isArray(v) && k[0] === '_' && k.length > 1) out.push(p);
    else out.push(...dataUnderscoreKeys(x, p));
  }
  return out;
}

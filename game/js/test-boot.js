// @ts-check
'use strict';
/* ================= TEST BOOT (phase 16, 2026-10-18) =================
   While this is on, the game skips the title and the opening and boots straight into starter selection. Nothing is
   loaded from or saved to this browser or an account, and accounts and friends stay off, so every load starts fresh.
   Nothing is removed: set TEST_BOOT_ON to false to get the normal game back, or open the game with ?boot=normal
   (the checks and art tools do); a ?fixture=<name> address (tools/check-fast.py) gets the normal game too. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
expose({ TEST_BOOT: [() => TEST_BOOT], TEST_BOOT_ON: [() => TEST_BOOT_ON] });
/* to-module: end */
const TEST_BOOT_ON = true;
export const TEST_BOOT = (() => {
  if (!TEST_BOOT_ON) return false;
  try {
    const q = new URLSearchParams(location.search);
    /* the checks' fixtures (js/fixture.js) and ?boot=normal get the normal game */
    return q.get('boot') !== 'normal' && !q.has('fixture');
  } catch (e) {
    return true;
  }
})();

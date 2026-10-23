// @ts-check
'use strict';
/* ================= TEST BOOT (phase 16, 2026-10-18) =================
   Off since 2026-10-19 (the owner: the title with accounts is back): open the game with ?boot=test to get it.
   While it is on, the game skips the title and the fall and opens on the opening cutscene with Professor Chosen
   (the dressing room keeps a random look on its own), which goes on to the pyramids and the starter pick. Nothing is
   loaded from or saved to this browser or an account, and accounts and friends stay off, so every load starts fresh.
   Nothing is removed: TEST_BOOT_ON = true makes it the default again (then ?boot=normal gets the normal game, as the
   checks and art tools still ask for); a ?fixture=<name> address (tools/check-fast.py) always gets the normal game. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
expose({ TEST_BOOT: [() => TEST_BOOT], TEST_BOOT_ON: [() => TEST_BOOT_ON] });
/* to-module: end */
const TEST_BOOT_ON = false;
export const TEST_BOOT = (() => {
  try {
    const q = new URLSearchParams(location.search);
    /* the checks' fixtures (js/fixture.js) get the normal game; ?boot=test the test boot, ?boot=normal the normal game */
    if (q.has('fixture')) return false;
    return q.get('boot') === 'test' || (TEST_BOOT_ON && q.get('boot') !== 'normal');
  } catch (e) {
    return TEST_BOOT_ON;
  }
})();

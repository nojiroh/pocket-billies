// The test globals (phase 04c's window bridge, renamed in 04d). Every module calls expose({...}) with its top-level
// names (the generated part at the top of each module, tools/to-module.mjs), as a getter and a setter of the module's
// own variable.
// Phase 04d: the modules reach each other only through imports, game/js/hooks.js and the setters, and the debug log
// through game/js/debug-log-names.js, so nothing in the game or the Studio needs these globals any more. They are put on
// window only when asked, for the checks' page.evaluate() calls and the console:
// - window.PB_TEST_GLOBALS = true before the page loads (the checks' init script), or
// - ?globals in the address (on a phone: game/index.html?globals).
// Setting a name changes the module's own variable, and hands it to hooks.js if other modules read it from there.
const testGlobalsOn = (() => {
  try {
    return !!window.PB_TEST_GLOBALS || new URLSearchParams(location.search).has('globals');
  } catch (e) {
    return false;
  }
})();
const seen = new Set();
export function expose(names) {
  if (!testGlobalsOn) return;
  for (const [k, [get, set]] of Object.entries(names)) {
    if (seen.has(k)) console.error(`Pocket Billies: two modules define ${k}; the later one wins`);
    seen.add(k);
    try {
      Object.defineProperty(window, k, {
        get,
        set:
          set ||
          (() => {
            throw new TypeError(`Assignment to constant variable ${k}`);
          }),
        configurable: true,
        enumerable: true,
      });
    } catch (e) {
      console.error(`Pocket Billies: can't put ${k} on window`, e);
    }
  }
}

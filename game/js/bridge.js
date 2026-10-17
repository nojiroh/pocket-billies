// Phase 04c: the window bridge. Every module puts its top-level names on window (the generated expose({...}) at the
// top of each module, tools/to-module.mjs), as a getter and a setter of the module's own variable, so whatever still
// reaches a name as a global works as it did with classic scripts: the classic scripts, a module's reference to a
// later file, the Studio's stand-ins, the quick check, the console and the debug log's wrappers (setting
// window.render replaces `render` for the module and for every module that imports it). Phase 04d replaces the
// globals that are left with imports and explicit hooks, then this goes.
const seen = new Set();
export function expose(names) {
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

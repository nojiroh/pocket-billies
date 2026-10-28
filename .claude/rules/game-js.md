---
paths:
  - "game/js/**/*.js"
---

# Game code (game/js)

From CLAUDE.md, docs/NAMING.md and docs/TESTING.md:
- Modules share names through the generated game/js/hooks.js (tools/to-module.mjs). A new module-level value other
  modules use needs a setter, `set` + the name, that calls `provide`; then `npm run modules`. `npm run check:modules`
  also checks the load order. Check for name clashes before and after a move. Only real setters start with `set` + a
  capital letter.
- game/js/logic/ runs without a browser: no browser globals; it imports only from logic/, game-data.js, util.js,
  hooks.js and test-globals.js, and reaches the page through the seams in hooks.js. A rule, number or data change
  there gets a unit test in tools/test/ (`<area>.test.mjs`, or `<area>-real.test.mjs` on the game's own data).
- kebab-case file names (tools/check-names.mjs); no top-level name of one or two characters, except `$` and `$$`.
- Files that start with `// @ts-check` are type-checked (`npm run typecheck`).
- Many lines exceed 300 characters: reformat only in separate no-op commits.
- Renames are internal names only and one per commit, never mixed with a behavior change (tools/rename.mjs).
- Don't break Start-Game, phone mode, the Studio, the in-game full test or the exported debug log; debug and
  self-test code never sends save data, names or step history anywhere.

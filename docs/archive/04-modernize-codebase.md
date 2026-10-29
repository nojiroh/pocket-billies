# Phase 04 - Modernize the codebase

## Goal
A standard, modular, tool-checked project. Only code that survives phase 03 is converted.

## Verify first
- ~1.3 MB of plain JS in ~50 script tags in a fixed order (no modules, no bundler). Largest: diorama-gl.js (~214 KB), diorama.js (~124 KB), ui.js (~95 KB). Studio ~454 KB.
- gamedata.js is ~13 MB; `scenes` is ~8.2 MB (109 entries); also 117 species, 58 lines, 109 moves.
- ~361 lines over 300 characters. tools/ has ~75 one-off scripts.

## Tasks
1. Add package.json, Vite, ESLint and Prettier. First commit: a no-op reformat of the dense files.
2. Convert the remaining script tags to ES modules one folder at a time, keeping the quick check green after each.
3. Split gamedata.js into per-entity JSON files (one per location, one per species, and so on) with a schema and a validation script. Update the Studio's save path. Load location data lazily. Report phone load time before and after.
4. Add TypeScript gradually (allowJs), starting with data and save formats.
5. Rewrite the README for GitHub (play, build, contribute) for the new game and version. Archive or remove one-off build scripts that are no longer needed.

6. Draw clear module boundaries so most code can be tested without a browser: pure logic (battle, rules, saves, encounter tables, breeding) with no DOM or WebGL imports; data loading; rendering behind a renderer interface (with a no-op "null renderer" for tests); UI. Only split where a boundary is not already clean. Do not create modules for their own sake.

## Ask me before
The module conversion order; the data-split layout.

## Done when
Game runs from the Vite build and from GitHub Pages, quick check passes, data is split and validated, README in place, tag `phase-04-done`.

## First reply
Same four items as phase 01, plus the proposed folder order for the module conversion.

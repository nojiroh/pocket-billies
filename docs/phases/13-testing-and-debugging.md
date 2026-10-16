# Phase 13 - Testing and debugging

## Goal
Fast logic tests, safer debug tooling, a less brittle test suite. Keep what is already excellent: the in-game full test, diagnostics test, exported debug log and the per-cause slow-frame table.

## Verify first
- tools/check-quick.py is ~2,000 lines (~189 KB) in one file; there are only end-to-end and screenshot tests, no unit tests for pure logic.
- selftest.js (~46 KB), debug.js and log.js ship to every player.
- Problems are reported only when I send a log manually.

## Tasks
1. Add fast unit tests (Vitest) for pure logic: battle damage and type matchups, evolution rules, save handling, and the new breeding rules. They must run in seconds in CI with no browser.
2. Breeding simulation test: run thousands of crosses and check stat distributions and abomination frequency stay within agreed bounds. This MUST exist before phase 16 is built. Do the same for robot battles: simulate thousands of random builds against each other and check no build dominates; this MUST exist before phase 17 is built beyond its prototype.
3. Lazy-load selftest.js, debug.js and log.js so normal players do not download them.
4. Add opt-in automatic error reporting (for example to Firestore). It must be clearly opt-in and must never send save data, names or step history, matching the existing debug log's privacy rules.
5. Split tools/check-quick.py into modules, keeping the same command-line options.
6. Make screenshot baselines less brittle: add comparison tolerances, and keep logic checks separate from visual checks so a pixel difference cannot hide a logic result.

7. Update the full test and debug log for the new game (maps and rooms, ranch, portraits; no step tracking) once those exist, and keep them free of private data.
8. Add unit tests for portrait tag-to-expression mapping and for the world-map graph (locations, routes and gates unchanged).

### Speed work (make checks and tests quick)
Biggest wins first. Modularity helps only by making logic testable without the browser; extra splitting for its own sake does not.
9. Measure first: use the per-step timing from phase 01, list the slowest steps, and attack those before anything else. Report numbers before and after.
10. Fixtures: add a debug `?fixture=<name>` (or a CLI flag) that loads a ready-made save and jumps straight to a given map, room, battle or screen, so no test replays the opening or walks there. Keep fixtures versioned with `saveVersion`.
11. Make sure the logic modules (battle, rules, saves, encounters, breeding, trades) import and run in plain Node with no DOM or WebGL, and cover them with the unit tests from task 1.
12. Null renderer: put rendering behind an interface with a no-op implementation so logic, UI and data tests can run without WebGL.
13. Parallelism: split the end-to-end suite into independent groups (each with its own browser context and fixture) and run them in parallel workers locally and as a CI matrix.
14. Tags and tiers: tag every test by area. Tiers: (a) lint and type-check, (b) unit tests, (c) smoke, (d) full end-to-end. Run (a)-(b) after every edit, (c) before every commit, and (d) at the end of a phase or nightly. Changed-area tests run per change.
15. Replace fixed sleeps with waits on explicit ready events (renderer ready, map loaded, text finished, transition done).
16. Screenshots: keep a small set of key shots at reduced size with tolerances; logic checks never depend on a screenshot.
17. Speed budget: lint and type-check under 10 s, unit tests under 30 s, smoke 1-2 min, full end-to-end about 10 min. Report where each tier stands and what blocks it. Set up Claude Code hooks so tiers (a) and (b) run automatically after edits (propose, then add after I approve).

## Ask me before
The privacy wording and storage for error reports; the tolerances for screenshot comparison.

## Done when
Unit tests run in CI, debug code is lazy-loaded, check-quick.py is modular and green, the speed budget is met or each miss is documented with a reason, tag `phase-13-done`.

## First reply
Same four items as phase 01.

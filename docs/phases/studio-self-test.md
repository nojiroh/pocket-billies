# Studio self-test (studio track, side session ST-T)

Approved by the owner on 2026-10-21. A test of the Studio itself, not the game: it opens and edits every section,
times every part of the Studio's own work and lists the slowest spots first, so later sessions know what to make
faster. About 90 seconds. Runs on a desktop browser (and maybe an iPad); phone width is not a target.

## Decisions (the owner)
- Measure only. What it finds is fixed in later sessions, one cause per commit, the undo first.
- About 90 s for a run.
- Desktop and iPad only.

## What was found by reading, before the test existed (the test measures each)
- Every edit turns all the game data (about 8.5 MB on disk) into one JSON string for the undo
  (`studio/js/studio-app.js`, `snapshot`). The undo's 64 MB cap counts pictures only (`historyBytes` is 0 for a data
  step), so 80 steps can hold 80 copies of the data.
- Every edit also posts the maps, scenery, engine, story, trainers and world map to an open game tab
  (`studioBroadcast`, BroadcastChannel) and runs the whole Check half a second later (`scheduleCheck`).
- A redraw rebuilds the whole section's HTML (`renderPane`).
- Several previews run their own animation loops (robots, skeleton, workbench, sprite previews): the test lists any
  loop still running after its section is left.
- The Check is one long function (`runCheck`), so it can only be timed as a whole.

## What a run does
1. Loading (already done when the test starts, so read from the marks boot leaves and the browser's resource
   timing): the data files, assembling them, the first draw; the page's scripts and their size.
2. Every section, in the first pane: the time to open it, split into building the HTML, putting it on the page,
   the after-draw steps and the previews; elements on the page; then about a second of frames (p50, p95, worst,
   which animation loops and frame tasks ran, draw calls when a 3D view is up) and the time of the Connections
   drawer's work for it. In the second pane too, for the sections that open there.
3. An edit in each section that has a field: one number or text field changed through the Studio's own field code
   (the same path a person's edit takes), then the snapshot (time, size), Check, live update, redraw, undo, redo
   and undo again. The data must come back exactly.
4. Tools: Find's index and a search, the pixel editor and skeleton builder opening, a map generated from fixed dials,
   a sheet sliced, the Check, and Save and Propose built as a dry run (nothing is sent or written).
5. Leaks: every section opened a second time; memory, elements, animation loops and timers compared.

While it runs, Save, Propose and every server call that writes are refused; at the end the data, undo history,
unsaved marks, open sections and selection are put back. The report holds numbers, section ids and data paths only:
no token, no GitHub name. A last row checks that.

## The report
The slowest sections and steps, a "Look here first" list made by fixed rules (game/js/logic/studio-test-report.js),
a JSON download, and the change from the last run in this browser.

## First runs (headless, 2026-10-21; software drawing, so the times only rank, the 3D frames mean nothing)
Passed in about 110 s: 24 sections, 16 edits undone, everything put back. What the list put first:
- The undo would hold about 640 MB when full (80 copies of 8 MB of data).
- An edit takes about 330 ms in the middle section (up to 650 ms, Walk scenes): the undo copy (100-190 ms), and while
  the undo is empty the top bar makes up to three more copies (up to 400 ms). The live update to a game tab costs up
  to 150 ms and the Check about 50-170 ms, half a second later.
- Undo in the Wardrobe takes about 1 s; Types takes about 650 ms to open the first time (building its HTML; 30 ms the
  second time); the Wardrobe takes 900 ms to open in the second pane.
- Opening People changes the data with no undo step of its own: the next undo takes that back with the person's edit.
  A bug to fix with the rest.
- Loading the data from GitHub (222 files, the stand-in) about 11 s; no leaks found (memory, elements, loops, timers
  the same after the second pass).

## Files
- `game/js/logic/studio-test-report.js`: the rules (numbers to findings), the comparison, the privacy check.
  Unit tests: `tools/test/studio-test-report.test.mjs`.
- `studio/js/studio-app.js`, `check.js`: `studioProbe`, timings recorded only while a test runs.
- `studio/js/studio-test.js`: the run, on no page: loaded when it starts, handed what it reads.
- `studio/js/studio-test-start.js`: the Check section's button and `studio/?selftest`.
- `tools/check-studio-github.py`: runs it headless and fails on errors or data that doesn't come back, never on
  times (a headless browser draws in software).

## Done when
Unit tests, lint, typecheck, check:modules, format:check pass; check-studio-github.py runs the test; STUDIO.md,
TESTING.md and HANDOFF.md updated.

# Test cleanup track (TC) - checks and tests that fit the game as it is

A side track, like the camera track. The owner asked (2026-10-23) how much work it would be to make every check and
test fit the current game, and which are outdated or useless. This file is the answer as a plan: four sessions, about
one phase, most of it deleting. Each session is tagged `tc-N-done` (the owner pushes tags). It finishes what phase 13b
set out to do (docs/phases/13-testing-and-debugging.md, tasks 9-17) for the roguelite game.

Before proposing anything in a session: read the latest HANDOFF.md entries and recent merges, then check the facts
below against main and report what differs. They come from a read-only audit on 2026-10-23 (main at 29e66011).

## Verified facts (2026-10-23)

### State of CI
- Every nightly from 19 to 23 Oct ended red. The full check (`check-quick.py`) took 2070 s on the 23 Oct nightly
  (54 steps, 41 passed, 13 problems); HANDOFF records 2265 s with the sound steps. Budget: about 10 min.
- The fast check (`check-fast.py`, every push) took 694 s in CI (25 checks, 2 workers); its docstring and TESTING.md
  say 1-3 min.
- No picture baseline: no `baseline-0.1.0-alpha` release (the only release is `Baseline`, 16 Oct, no assets), so the
  nightly compares no pictures ("No baseline for 0.1.0-alpha yet").
- The nightly's "Upload pictures and results" fails: the Scenes step saves `scene-{walkView.id}`, which gives
  `scene-w:copperleaf*.webp`, and upload-artifact rejects `:` and `*`. Only the selftest artifact uploads.
- `npm test` (quick tier): 783 tests, about 47 s in a cloud container (budget 30 s).
- `game/data/locations.json` holds only `copperleaf` and `roads.json` is `[]`, so tests and checks that loop over
  places or roads pass while checking almost nothing.

### Unit tests (`tools/test/`, 147 files): 125 keep, 12 outdated, 10 useless
Outdated (they read the parked old world through `old-world.mjs`, or test old saves):
- `bowl-ground`, `bowl-things`: live code, data from `oldWorld()` (Frostcrown, the trench, marigold, "40 places have a
  landmark"). Rewrite on a run's bowl and the hub island. M each.
- `bowl-sea`, `bowl-land`: the Phase-10 continent (about 40% sea, rivers); the game draws the hub island or a run's
  isle look. Keep the generic tests, move the rest onto run worlds. M each.
- `bowl-layout`: the locations.json layout, near empty with one place; run layout is covered in run-map. Keep "curves
  only, 45 degrees at the rim", delete the rest. S.
- `world-graph`: hub-only graph; its last test checks only the legacy world. Cut to one hub test plus the snapshot. S.
- `world-tables-real`: one-place snapshot, overlaps world-graph and run-world-real. Merge or delete. S.
- `saves-real` test 3 (wild stock on tallgrass_meadow, marigold, fizzwell): rewrite on a run's route and town. S.
- `saves` "RL-5: a save from before the hub stood alone": delete with the RL-5 block in `logic/saves.js`. S.
- `set-aside`, `set-aside-latest`: the box that keeps a save this version can't load (alpha 0.5, format 3). Ask.
- `story-scripts` "Curator Nacre" (a parked Pearlantis person): delete; the save-during-script test moves to Juniper. S.
- `music-studio` "every song is played" reads `legacy/locations.json`. Use the game's places. S.

Useless (proofs that a finished refactor changed nothing, kept long after):
- `rng-baseline` (RL-1; covered by battle-golden and battle-engine-state), `rig-calls` (ST-0 Golden switch guard).
- `story-snapshot` + `talk-before-scripts.json` (49 KB, 41 of 57 entries parked): delete, or a plain snapshot of the
  current scripts.
- `opening-script` test 1 + `opening-before-scripts.json`: make test 1 a plain snapshot; tests 2-5 stay.
- `robot-joints` test 1 + `robot-rig-before.json` (123 KB): delete; tests 2-4 stay.
- `battle-rewards` test 1 (an inline copy of the old endBattle maths): delete; tests 2-3 stay.
- `frame-allocations`, `fx-group` (Phase 20: compare with old code kept inside the test): delete when the renderer
  work is settled.
- `sheet-slice-parity` (JS slicer vs the retired Python one): delete, or rename to `sheet-slice-real` if the "source
  sheets = committed parts" half is wanted.
- After the rewrites `old-world.mjs` has no users and goes.
- `tracker.test.mjs` is the music tracker (live). No test touches real-world step tracking.

### `check-quick.py` (62 steps, 2588 lines): 29 keep, 18 outdated, 15 redundant
- 10 of the 13 standing failures are in outdated steps: v31 bowl camera, v34 walk cycle, v35/v38/v39 roster counts
  (117/61/58, the legacy roster), v44 light lab (pass/fail from screenshot brightness), v46 legacy building kinds,
  alpha 0.4 bush recipes, alpha 0.2 terraces, phase 08 running (`float division by zero`). RL-7, RL-8 and postcards
  fail only inside the full run (state left by earlier steps).
- Outdated: alpha 0.4 old place names (imports `rename-places.py`), water/jetties (imports `fix-marigold-stream.py`,
  `fix-piers.py`), mast in every town, postcard/solarpunk every town, Things to do (ask), v31, v32, v34, v35, v36
  (slim), v37, v38, v39/v40, v42, v43, v44, v46, v47.
- Redundant: Code parses (ESLint, build, check:modules), Data (check-data.mjs; imports `migrate-places.py`), Messages,
  Team, Studio opens, Shaders (the in-game Shaders phase), Paths, Scenes (also breaks the upload), Crowd (a frame-rate
  ratio under software drawing), Time/weather/rooms (night decided by brightness), v36 split evolution, RL-7 run roads,
  alpha 0.4.1 joystick, Battles (fast `battle` covers it), the dead helper `cross_to`.
- Slowest kept steps: alpha 0.4 low-poly props 329 s (the budget maths is pure, move to Node), v33 223 s, phase 08
  running 149 s, Phone 113 s, in-game test one step 111 s (mostly boot and `play()`).
- 120 `time.sleep` calls (about 190 s nominal); `play()` replays the game start instead of a fixture.
- Helpers copied between check-quick and check-fast (`CLOCK`, `NO_ACCOUNTS`, `TEST_GLOBALS`, `free_port`, `serve`,
  `console_text`, `log`, `go_scene`, two `until`s and `open_game`s); `serve` again in check-ui-gallery, check-sound and
  check-studio-github. style-diff, look-blur, look-tall-ground, island-perf and island-shots import check-fast.

### `check-fast.py` (30 checks): 24 keep, 6 misplaced, 0 outdated
- "Game data is valid" and "World-map graph unchanged" repeat the lint job and `npm test`.
- `island` (test_island and the orbit, 114 s): Copperleaf is the island; `hub_island` checks the orbit.
- Studio Hub island IS-6a (118 s) and IS-6b dials (77 s) run on every push; they belong in check-studio-github.
- `bowl_map`: the Copperleaf to Copperleaf flight and "old map opened" message are RL-5 leftovers.

### In-game tests
- `self-test.js` "Walk: <every scene>": 25 scenes, about 18 the game can't reach: `city_opening` (not played since
  RL-8) and 16 rooms only legacy maps lead to (assay_office, bakery, bank, bullion_exchange, cap_market, chandlery,
  fire_station, greenhouse, inn, library, mansion, market_hall, night_market, school, ski_lodge, twinpetal_market).
- `diagnosticsMaps()` looks for a route, a cave, a ride and an a04 place; today it picks Copperleaf and one room.
- `runQuickTest` is an alias of `runFullTest`. The header still mentions Blake's first battle and a road.
- `bowl-map-test.js`: `s.under` (Pearlantis) and the non-island branches can't happen any more.
- `graphics-test.js` opens `marigold` if it exists (legacy), repeats the Shaders phase and overlaps the bench test.
- Debug menu: "Walk 1 km" mentions eggs (ranch eggs since RL-10); "Earn every badge" and "Reset trainer wins" are
  from the gym era.

### Studio check, static checks, Firebase
- `check-studio-github.py` `generate_steps` copies legacy tallgrass_meadow in and joins to it, so the final proposal
  carries a legacy map back into the game. `split_steps` waits for `legacyView.data`. `story_steps` uses
  `met_blake0`. About 20 step sets run only by hand.
- `check-names.mjs` + `retired-names.json` (1,743 names): guards the finished phase-05 rename; it imports `units()`
  from the one-off `tools/rename.mjs`.
- `check-data.mjs`: the bowl `under` rule only served Pearlantis; the `game/data/legacy` block protects the Studio's
  Copy into game (keep while the Legacy section stays).
- `tools/story-checks.mjs` is a 3-line re-export. `tools/unused-css.mjs` is wired to nothing; it reports 6 rules, all
  `egg-e` (the old km-egg UI).
- ESLint still lints the one-off rename tools (`rename*.mjs`, `move-names.mjs`, `split-data.mjs`).
- Firebase rules tests: keep (saves, users, codes, requests are live).
- Legacy save code: in `logic/saves.js` `migrate` (really the save filler; refusal of old formats is `saveAge`) the
  RL-12 `offerN`/`shelf` defaults, the 06-3 `battleStage`/`battleHud` deletes and the RL-5 pruning; `lookFromOld` and
  the boy/girl conversion in settings-screen.js; the km-egg code (`saveData.eggs`, `eggKm`, egg slots in rules.js).
- Not tests, but blocks deleting the stand-ins: 100 pool entries and 31 trainer team entries use legacy species ids
  (`standInSpecies` in game-data.js, `legacyLines` in check-data). Out of this track's scope; see "Not in this track".

## Sessions

### TC-1 - Delete (1 session, all small)
1. Unit tests: delete `rng-baseline`, `rig-calls`, `story-snapshot` and `talk-before-scripts.json`, the parity test 1
   of `opening-script` (now a plain snapshot), `robot-joints` and `battle-rewards`, the two JSON records, and (if the
   owner agrees) `frame-allocations`, `fx-group`, `sheet-slice-parity`. Delete the RL-5 saves test with its code.
2. `check-quick.py`: delete the redundant steps and the clearly outdated ones (old place names, v34, v35, v37, v38,
   v39/v40, v44, v47, the dead `cross_to`). Each step's still-useful part, if any, moves first (its own commit).
3. `check-fast.py`: drop "Game data is valid" and "World-map graph unchanged".
4. Lint: delete `retired-names.json` and the names rule (keep the length and kebab-case rules; move `units()` in);
   delete the one-off rename tools and the legacy Python helpers only check-quick used (`rename-places.py`,
   `migrate-places.py`, `fix-marigold-stream.py`) after a grep shows no other users.
5. CI: fix the shot name so the nightly upload works; drop smoke's copies of check:data and the world-graph test.
6. Legacy save code: the RL-12, 06-3 and RL-5 branches of `migrate`, `lookFromOld`. (Renaming `migrate` is a separate
   rename commit, per CLAUDE.md.)
Done when: lint, typecheck, `npm test`, check:fast green; the nightly uploads its artifact.

### TC-2 - Rewrite on the current game (1 session)
1. `bowl-ground`, `bowl-things`, `bowl-sea`, `bowl-land` on a run's bowl (`runBowlLook`, run-map spots) and the hub
   island; `bowl-layout`, `world-graph`, `world-tables-real` cut down; `saves-real` test 3, `story-scripts`,
   `music-studio` off the old world. Then delete `old-world.mjs`.
2. In-game full test: the "Walk:" list worked out from door links (Copperleaf and the rooms the game reaches);
   `diagnosticsMaps()` picks the hub and one generated run scene; drop `runQuickTest`; fix the header.
3. `bowl-map-test.js`: drop the `under` and non-island branches. `graphics-test.js`: open test_graphics or Copperleaf.
4. `check-studio-github.py`: `generate_steps` joins a Copperleaf exit or a second draft; `split_steps` without the
   legacy view; `story_steps` without `met_blake0`.
5. `check-data.mjs`: drop the `under` rule. `unused-css.mjs`: delete the `egg-e` rules, then wire it into lint or drop it.
Done when: no test or check imports `old-world.mjs` or reads `game/data/legacy` except the Studio's own Legacy
section checks; `--selftest` passes headless.

### TC-3 - Rename, move and fix what stays in check-quick (1 session)
1. Rename the version-stamped steps it keeps (v31, v32, v33, v36, v42, v43, v46, alpha 0.2/0.4/0.4.1, phase 08) to
   say what they check (docs/NAMING.md), one rename per commit.
2. Move pure logic into Node or check-data: the low-poly props budget, Version, Copperleaf hub data, room wall
   height and floors, water/jetties, the postcard files, test-scene walking rules if `testMapChecks` is pure.
3. Fix the real failures in kept steps: terraces, phase 08 running (division by zero), and the RL-7/RL-8/postcards
   steps that fail only after other steps (each step resets what it needs).
4. Time/weather/rooms reads `environment` state instead of brightness.
Done when: the full check has no red step that is not a real bug, and no step decides logic from a picture.

### TC-4 - Speed (1-2 sessions)
1. One shared module for the browser checks' helpers (serve, ports, clock, accounts, `until`, `open_game`), used by
   check-quick, check-fast, check-ui-gallery, check-sound and check-studio-github; style-diff and the look tools keep
   working.
2. check-quick on check-fast's model: fixtures instead of `play()`, parallel pages, `until` instead of the 120 sleeps
   (a sleep only where the wait is the point, with a comment).
3. check-fast: `island` folds into `hub_island`; the IS-6a/IS-6b Studio checks move to check-studio-github.
4. `npm test` back under 30 s (measure the slowest files; move scene sweeps to the slow tier).
5. Make the picture baseline (`baseline-0.1.0-alpha`, Run workflow with "Make the picture baseline").
6. Update TESTING.md's tiers table and the docstrings with measured times.
Done when: full check about 10 min (or each miss documented), fast check in its stated time, `npm test` under 30 s,
nightly green with pictures compared.

## Ask me before
- Delete Things to do (the open-world challenges, request, gold stamp, home room, photo) and its check step?
- Remove the old-save set-aside box (and its two tests), or keep it?
- Move the 16 unreachable rooms (and `city_opening`, if the story isn't bringing it back soon) into `game/data/legacy`?
- The gym-era debug buttons ("Earn every badge", "Reset trainer wins") and "Walk 1 km": keep, relabel or drop?
- Merge the Graphics test into the graphics bench test?
- The `city` and `mall` songs are only used by legacy places: keep their sound fingerprints?
- Keep `frame-allocations`, `fx-group` and `sheet-slice-parity` while renderer and art work goes on?

## Not in this track
- Remapping the 131 pool and trainer entries that use legacy species ids, so `standInSpecies` and `legacyLines` can
  go. It is a data job (L) for the Studio or Phase 16 roster work.
- Firebase rules for ghost teams (RL-15).

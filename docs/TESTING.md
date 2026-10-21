# Testing: what every phase does

Phase 13 reworks the tests (docs/phases/13-testing-and-debugging.md; sub-sessions 13a, 13b, 13c, see
docs/HANDOFF.md). This file is the contract for every later phase: where a new test goes, what a phase updates when
it changes or removes a system, and what must pass before a phase ends. Parts marked **(13b)** or **(13c)** arrive with
those sessions; until then, follow the rule next to them.

## The tiers

| Tier | Command | Now | Budget | When |
|---|---|---|---|---|
| (a) lint, types | `npm run lint`, `npm run typecheck` | 4 s warm (9 s cold) + 0.6 s | under 10 s | after every edit (the Claude Code hook runs it) |
| (b) unit tests | `npm test` | about 1 s | under 30 s | after every edit to logic, data or tests (the hook) |
| before a commit | `npm run check:modules`, `npm run format:check`, `npm run check:data`, `npm run build` | about 15 s | none | every commit |
| UI pictures (UI-2) | `npm run check:ui` | about 1.5 min | none | after a change to the kit, its CSS, uiTheme.json or studio/gallery.html |
| (c) smoke | `npm run check:smoke` | about 2.5 min | 1-2 min | before every commit that touches game/, tools/check-quick.py, vite.config.js or tools/to-module.mjs |
| (d) full | `npm run check:quick` | about 32 min | about 10 min | at the end of a phase, nightly in CI |
| (e) in-game test | `python3 tools/check-quick.py --selftest` | about 25 min | outside the budget | nightly in CI; at the end of a phase that touched what it plays |
| rules | `cd firebase && npm test` | about 1 min | none | when firestore.rules or what the game writes changes |

The quick check needs Python Playwright matching the installed Chromium (tools/requirements-check.txt). Smoke and the
full check are over budget today; 13b brings them down (parallel groups, fixtures, waits instead of sleeps, fewer
legacy steps). A phase that makes a tier slower says by how much and why in its HANDOFF entry.

## Where a new test goes

Pick the first that fits:
1. **Rules, numbers, data that is right or wrong**: a unit test in `tools/test/` (Node, no browser).
   - The code under test belongs in `game/js/logic/` (no DOM, reaches the page only through `hooks.js`). If the logic
     you want to test lives in a browser file, move it into logic first (a move commit of its own), then test it.
   - `setup-fixture.mjs`: the tests' small data set, for how a rule behaves. `setup-real.mjs`: the game's own data,
     for whether the data is right (the world-map graph, expressions in dialogue, saves against the data).
   - File names: `<area>.test.mjs`, or `<area>-real.test.mjs` on the game's data (docs/NAMING.md).
2. **The shape of a data file or what refers to what**: `tools/check-data.mjs` and the schemas in `game/data/schema/`.
3. **Something only the page can show, but not a picture** (a screen opens, a battle reaches the move menu, a room
   opens in place): a quick-check step that reads the page's state through `page.evaluate`.
4. **How it looks**: a visual check, kept apart from the logic. Pixel differences are notes, never failures
   (the owner's choice); a key shot **(13b)** at 320 px with tolerances.
5. **How it runs on a real phone** (frame rate, memory, a real graphics chip): a step of the in-game full test
   (`game/js/self-test.js`).

Two rules hold everywhere:
- **A logic result never depends on a picture.** A pixel read may only decide a visual check.
- **One check in one place.** When a check moves (into Node, into another step), the old copy is deleted in its own
  commit right after the new one passes.

## Unit tests (`tools/test/`)

- Each file runs in its own process (`node --test`): the data tables are read once per process, and there is one save
  and one battle per process (`hooks.js`). Tests in one file run in order and share that state.
- Random numbers are seeded. A test that draws them calls `reseed()` first (or in `beforeEach`), so its result doesn't
  depend on the tests before it.
- How randomness works today (RL-1 `tools/test/rng-baseline.test.mjs`, RL-2 `tools/test/rng.test.mjs`):
  `game/js/util.js`'s `random` is `Math.random` as it is when util.js loads. On the page that is the browser's, so
  nothing in a real game is seedable yet; in Node, `load-logic.mjs` puts a Park-Miller stand-in on `Math.random`
  first, so the logic (the battle engine's ~16 rolls, `pickWeighted`) follows `reseed()` and two battles from one seed
  play out the same. The seedable source for game outcomes is `logic/rng.js` (RL-2, moved out of mapgen.js
  unchanged): `rngFrom(seed, salt)` gives a stream (`next, range, int, chance, pick, gauss`), `rngFn(seed, salt)` the
  same as a plain `() => number`, `hashString` the FNV-1a hash, `dailySeed(now)` `'d'` + the UTC date. `pickWeighted`,
  `rollPartSize`, `rollBuild` and `spawn` take an optional `rnd` (default util.js `random`); nothing passes one yet
  (runs will, RL-6/7). A battle with a seed (`makeBattle(…, {seed})`) draws every chance from its own stream (`b.rng`,
  RL-4, `battleRoll()` in the engine); without one it draws `util.random` as before. 172 direct `Math.random` (counted at RL-1)
  calls in game/ and studio/ are mostly drawing, sound and ambient life, but `battle.js` (bribes, egg drops) and
  `things-to-do.js` (rewards) decide outcomes with them; `newUid` and `met` read `Date.now()`, battle weather the
  real clock.
- The battle golden record (`tools/test/battle-golden.test.mjs`, RL-2): four seeded fights on the game's data
  (single, double, Alpha, robot), both sides played by `chooseAI`, every event and the end state snapshotted. It
  must stay unchanged through RL-4's engine work; a battle data change or a change meant to alter battles remakes it
  (`--test-update-snapshots`), said in the commit. A planted +1 damage turns all four red.
- A battle off the page (RL-4, `battle-state.test.mjs`, `battle-engine-state.test.mjs`): `makeBattle(kind, team,
  foe, extra)` makes a battle without installing it; pass it last to `runTurn`, `chooseAI`, `benchCandidates`,
  `canUse`, `applyItem` and the other entry points. `SILENT_HOST` (`extra.host`) shows, saves and plays nothing; a
  copied team brings `bag` and `buddy` and leaves the save as it was. Use both for a simulation or a ghost (the robot
  simulation does). The battle object's shape is snapshotted; a seeded battle must replay the same with other draws
  in between; the turn cap is tested with the cap lowered inside the test.
- The save's run state (RL-3: `meta-state`, `ranch-state`, `run-state` and `saves.test.mjs`): run on the fixture's
  three locations, so a save from a run sits at node 4, past `LOCATIONS`, to prove `migrate` keeps a run's trip by the
  run's map and not by today's places. Switching that branch off turns the run-save test red.
- On the game's data, test what must hold whatever the content (every road has its exits, every gate its trainer),
  not counts a content change legitimately alters. Where the whole shape matters, use a snapshot
  (`t.assert.snapshot`): remake it with `node --test --test-update-snapshots tools/test/<file>` in the commit that
  means the change, and say so in the commit message.
- A test proves something only if it fails when the thing breaks: plant the fault once (a typo, a wrong exit) and see
  it fail before trusting it.
- Simulations (`tools/test/sim/`, from 13a's second session): seeded trials with summary statistics. A small sample
  runs in `npm test`; the full run is nightly. Bounds are agreed with the owner before they are asserted; until then
  the simulation only reports.

## Quick-check steps (`tools/check-quick.py`)

- `@step(name, limit)`: the name says what is checked, with no version stamp for new steps (docs/NAMING.md; the old
  `v31`..`alpha 0.4.1` names are retired or renamed in 13b).
- Wait on the game's state with `until()` and check what it returns; a fixed `time.sleep` only for a deliberate wait,
  with a comment saying why. Explicit ready events arrive in **(13b)**.
- Clean up in `finally`, and don't rely on what an earlier step left (13b gives each group its own page; until then,
  reset what your step needs at its start).
- **(13b)** Each step gets `areas=(...)` tags and joins a run group with a fixture instead of replaying the opening.
- The checks never reach accounts or the network (`NO_ACCOUNTS`), and nothing they do is saved for real.

## The in-game full test and the debug log

The owner runs the full test (Settings → Help) and sends the debug log from a phone; both must keep working
(CLAUDE.md). When a phase adds, changes or removes a system the full test plays, it updates the full test in the
same phase:
- A new system or screen gets a step: `phase(name, task, fn, sec, maxSec)` in `runFullTest`. Wait with
  `selfTestSleep` and frame counts, not fixed real-time deadlines; a deadline is multiplied by `selfTest.slow` (the
  headless runs use 3).
- A removed system loses its step in the same commit as the system.
- The test never writes the save: it pauses saving (`pauseSaving`/`resumeSaving`, game-state.js) and puts the save
  back. Don't call `writeStoredSave` or the account directly from a step.
- `--selftest` (headless) must pass at the end of the phase. A step that only runs out of time there is a note; a real
  failure is not.
- Privacy: the debug log and the test's report never hold the save, a name (trainer, Billie, friend, account), step
  history or anything that identifies the player. Text that can carry a name (speech, labels) stays out of the
  log's picture. Smoke plants a trainer name and a Billie nickname and fails if either reaches the exported log; a
  new field in the log must keep it passing. **(13c)** Opt-in error reports follow the same rules, from an allowlist.
- **(Phase 20)** Each second's sample in the debug log also holds what one frame asked of the graphics card
  (game/js/engine/gpu-counters.js, counted once a second on whichever screen is open): `dc` [draws, instances,
  program switches, texture binds, uniform calls], `dcp` (draws per render pass: sky, ground, grass, sprites, solid,
  models, box, buildings, structures, water, effects, post, shadowNear, shadowFar, lamp0, lamp1, reflection, other),
  `up` [KB of textures, KB of buffers uploaded], `lit` [point lights, lamp shadow maps], `pcl` [programs compiled at
  once, started in the background] once a place has settled (a second after it is ready; counted since the page
  loaded, and the per-dial graphics test's shader check adds to it), `alloc` [hitches, MB freed]: ticks more than
  45 ms apart while the heap shrank (Chrome only, a rough sign of garbage collection). Numbers only.
- **(Phase 20 C3)** The full test's Shaders step also builds every program with the light code with the Frame uniform
  block (`frameBlockCheck`, engine/webgl.js) and checks the block's size and each member's offset, as this device's
  driver lays them out, against what engine/frame-block.js packs; smoke shows "N shaders; 14 with the Frame block".
- **(13c)** The full test and the debug menu load on demand; the recording part of the debug log stays loaded.
- The graphics test (Settings → Help → Run the graphics test, and the debug menu; `game/js/graphics-test.js`, loaded on
  demand) is run only by a person, by hand, on their own device: never from Claude Code, CI, a headless browser or
  a script, and no command-line runner, CI job or hook. It tries the shaders, each engine dial on its own (ENGINE_SPEC,
  moved away from its default), Balanced, Beautiful and each engine preset, in one scene, and saves a short .json
  report. A new dial in ENGINE_SPEC is tested with no change; a new kind of dial needs a value in
  `graphicsDialValue`. Its rules (the dial values, the report's planted-name check) are unit tests in
  `tools/test/graphics-test.test.mjs`.

## What each phase does

- **06 UI structure**: the smoke phone flow clicks real buttons (`[data-a=intro]`, the dressing room, `cs-next`,
  `cs-choose`, `cs-yes`, the five tabs, the shop) and the Help buttons `quicktest`, `diagtest` and `dbglog` start
  the in-game test and the log export: keep them, or change the checks in the same commit. Pure UI logic that
  moves out of a screen (prices, sorting, text building) gets unit tests.
- **07 Portraits**: `tools/test/expressions.test.mjs` checks that every expression asked for has face pieces;
  replace it with the real tag-to-expression mapping test (task 8's second half). Add a portrait to the full test.
- **08 Step tracking removed, maps and rooms (Part A and B)**: remove or replace everything driven by steps:
  - the full test's Road step (it switches travel to steps for its run since 13a);
  - check-quick's `play()` (it sets `RULES.travel='steps'` and adds 2,400 steps) and the steps in the steps
    Walking, v36 (split evolution by `bsteps`), v37 (party steps), v43 (steps along a road), alpha 0.4 Copperleaf
    (the trip cost) and alpha 0.4.1 walk yourself ("steps counted");
  - `tools/test/rules.test.mjs` 'steps, trips and gates, encounters' (`earningsBetween`, the trip's steps) and the
    step fields `validSave` checks (`totalSteps`, `day.steps`);
  - the debug menu's step buttons and the debug log's trip progress.
  Part B: rooms that open in place are checked by the full test's room step (since 08b-2: the doorway within 0.1 m
  of the door, nothing of the room walkable or walled outside it, out exactly at the door facing out with the camera
  as it was, the town's walking grid unchanged), v46 (every door of Copperleaf, Verdigris and Marigold: its room's
  doorway within 0.1 m) and alpha 0.1's library; check-data checks that every door opens a room.
  `tools/measure-rooms.py` times walking into seven sample doors, cold and warm (headless; compare runs). The
  world-map graph test must still pass (same places, roads and gates); if a road's exits move on purpose, remake the
  snapshot and say so.
- **09 Props and terrain**: the data steps (windows, water and jetties, masts, ground tiles, low-poly recipes) count
  today's kit; update them with the new one in the same commits. Pictures change on purpose: remake the picture
  baseline afterwards (Actions → Check → Run workflow → "Make the picture baseline").
- **10 World-map bowl**: `tools/test/world-graph.test.mjs` must pass unchanged (positions may move, connections may
  not). Replace the full test's two World map steps, v32's miniatures and the airship step with checks of the bowl.
- **11 Opening**: the smoke phone flow and the full test's two Opening steps play the opening; update them with it.
- **12 Ranch**: a full-test step for the ranch, a quick-check step that edits it, and its save fields in the save
  tests (`saves.test.mjs`, `validSave`).
- **14 Studio**: `tools/check-studio-github.py` and smoke's "Studio opens" keep passing; `--studio` follows the
  Studio local mode decision.
- **15 Design and story**: write down the balance bounds the simulations will assert (with the owner).
- **16 Billies**: write the breeding simulation first, against the prototype, before the full build (the owner
  agreed in 13a's plan); agree its bounds. The roster steps (v35, v38, v39/v40) count today's 117 Billies: update
  them with the slimmed roster, and move what is data into unit tests.
- **17 Robots**: the robot battle rules live in `game/js/logic/` with unit tests (`tools/test/robots.test.mjs`); the
  simulation (no build dominates) comes before the full build: `node tools/test/sim/robot-sim.mjs` fights every build
  the data allows against a reference set of robots and Billies and reports win rates per build and part
  (`--quick` for a sample; `robot-sim.test.mjs` checks it runs). Its bounds are still to be agreed with the owner.
- **UI track** (docs/phases/ui-track.md): `npm run lint:ui` (tools/ui-lint.mjs, UI-1) counts raw values per UI rule
  and file next to the token uses (corners, space, shadows, keyframes, times, fonts, colours, `!important`, layers,
  blur rules; colours, `innerHTML` and `style="` in game JS). A report until UI-6 makes it fail when a count rises.
  Smoke's phone step ends with the blurred surfaces on each screen it visits (`uiBlurCount()`, budget 3). The look
  comes from game/data/uiTheme.json (`tools/test/ui-theme.test.mjs`; check-data checks text reads at 4.5:1). A look
  change moves the pictures: remake the baseline on purpose afterwards.
  UI-2: `npm run check:ui` (tools/check-ui-gallery.py) takes a picture of every `[data-shot]` section of
  studio/gallery.html at 320 and 390 px, light and dark, plus the shaped parts with the stepped preset (73 pictures),
  and compares each with the committed baseline in validation/ui-gallery/ (fails above 0.05% of a picture; a 2 px
  change to a cut is caught). A new kit part or state goes into the gallery as a section with `data-shot`; a look
  change on purpose is `python3 tools/check-ui-gallery.py --update`, said in the commit. Not in CI: the baseline is
  this container's Chromium and fonts. `tools/test/ui-theme.test.mjs` also checks the shape polygons (tokens.css's
  copy equals the generator's) and `tools/test/ui-icons.test.mjs` keeps game/art/ui/*.svg equal to the grids in
  tools/build-ui-icons.py.
- **18 Trading and battles with friends**: every new Firestore rule gets emulator tests in `firebase/test/`;
  trade validation is logic with unit tests.

## Before a phase ends

1. Tiers (a), (b) and the before-commit checks pass; smoke passed before each game commit.
2. The full quick check passes (or each failure is explained in HANDOFF).
3. `--selftest` passes if the phase touched anything the in-game test plays.
4. HANDOFF lists the tiers' times if they changed, and anything this file asked the phase to update.

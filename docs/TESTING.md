# Testing: what every phase does

Phase 13 reworks the tests (docs/phases/13-testing-and-debugging.md; sub-sessions 13a, 13b, 13c, see
docs/HANDOFF.md). This file is the contract for every later phase: where a new test goes, what a phase updates when
it changes or removes a system, and what must pass before a phase ends. Parts marked **(13b)** or **(13c)** arrive with
those sessions; until then, follow the rule next to them.

## The tiers

| Tier | Command | Now | Budget | When |
|---|---|---|---|---|
| (a) lint, types | `npm run lint`, `npm run typecheck` | 4 s warm (9 s cold) + 0.6 s | under 10 s | after every edit (the Claude Code hook runs it) |
| (b) unit tests | `npm test` | about 47 s in a cloud container (Studio plan Phase 1: 635 tests; the scene sweeps take most): over budget | under 30 s | after every edit to logic, data or tests (the hook) |
| before a commit | `npm run check:modules`, `npm run format:check`, `npm run check:data`, `npm run build` | about 15 s | none | every commit |
| UI pictures (UI-2) | `npm run check:ui` | about 1.5 min | none | after a change to the kit, its CSS, uiTheme.json or studio/gallery.html |
| style diff (UI-5) | `python3 tools/style-diff.py` (`--only=<screens>`, `--ref=<rev>`) | about 8 min (16 screens, 2 browsers) | none | a commit that moves CSS or screen code and must change nothing on screen: 0 differences against HEAD |
| (c) smoke | `npm run check:smoke` | about 2.5 min | 1-2 min | before every commit that touches game/, tools/check-quick.py, vite.config.js or tools/to-module.mjs |
| (d) full | `npm run check:quick` | about 32 min | about 10 min | at the end of a phase, nightly in CI |
| (e) in-game test | `python3 tools/check-quick.py --selftest` | about 25 min | outside the budget | nightly in CI; at the end of a phase that touched what it plays |
| rules | `cd firebase && npm test` | about 1 min | none | when firestore.rules or what the game writes changes |

The quick check needs Python Playwright matching the installed Chromium (tools/requirements-check.txt). Smoke and the
full check are over budget today; 13b brings them down (parallel groups, fixtures, waits instead of sleeps, fewer
legacy steps). A phase that makes a tier slower says by how much and why in its HANDOFF entry.

The update check (update-check.js, the owner 2026-10-22) works only on the built site (`npm run build`, then serve
`dist/game`): no check runs it, since the checks serve the repository, where PB_BUILD is '' and it is off. To try it,
load the built game, build again while it runs, and bring the page back to the front: it loads the new build.

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
- The run map and clock (RL-6: `run-map.test.mjs`, `run-map-real.test.mjs`, `weather.test.mjs`): run-map.test on
  small tables of its own (five node types, the five biomes as mild), run-map-real on the game's (nodeTypes.json,
  rules.json `run`, biomes.json). A map is frozen in `run-map.test.mjs.snapshot`: a change meant to change maps remakes
  it (`--test-update-snapshots`) and says so in the commit; each choice has its own stream (`map|shape|<row>`,
  `map|type|<row>|<lane>`, `map|biome|<row>|<lane>`, a node's `weather|<day>`), so a rule's change moves only what it
  rules (tested for `cross`). The structure rules run over 1,300 maps of 5 to 12 rows; the bowl's are the hub's
  (`bowl-layout.test.mjs`: pins apart, roads within 30 degrees of their exits) but 0.1 apart and 45 degrees for a
  lane switch, which the rows' spacing can't keep within 30. RL-8b: the run runs east to west across the bowl, maps
  facing north, no two places' maps overlapping; `run-bowl.test.mjs` checks a run's own map (land under every place's
  whole map, sea at the rim, the same seed the same look), `bowl-seed.test.mjs` the seed's noise (0 moves nothing) and
  `bowl-sea.test.mjs` the island world (one island round Copperleaf, the game's hub an island). weather.test checks `weatherPick` against the page's old
  pick for every roll its hash can give: a change to the weather's odds or its order fails it on purpose.
- The run's world (RL-7: `run-scenes.test.mjs`, `run-world-real.test.mjs`): run-scenes.test on small tables of its
  own (a node's exits in the order its scene is made with them and the ids the generator gives them, the dials drawn
  from `run.scene` within their ranges and by weight, the levels by row, the world's rows, pools and roads);
  run-world-real on the game's data: every scene of six runs made by the generator, each joined to its parents, every
  road's exits where it says, check-data's seam rules clean, no height gap or step and a straight walk across
  (`mapgenSeamAgreement`), all ground reachable, no generator note (about 4 s); the same seed the same scenes; a run's
  world through `worldPut` and the hub's back through `worldHubBack` exactly; a run place stocked once a visit from its
  own stream. A node's dials are frozen in `run-world-real.test.mjs.snapshot`: a change to how they are drawn changes
  every run's scenes, so remake it (`--test-update-snapshots`) only on purpose and say so in the commit. A change to
  the generator itself shows in the mapgen tests first.
- The run loop (RL-8): `battle-rewards.test.mjs` proves `battleRewards` gives what `endBattle` worked out before the
  move (every outcome, both kinds, seeded egg rolls); `run-loop.test.mjs` the start's give, the heal price, a town's
  stock for a day (the same after a reload), the run's foes (none twice, levels by row, the boss an Alpha), battle
  seeds, release pay, the payout rows and a run's ids; `run-sim.test.mjs` plays whole runs with
  `tools/test/sim/run-sim.mjs` (one seed twice the same whatever util.js random does; the report's numbers and its
  bot policy). Studio plan Phase 3: the simulation itself is `game/js/logic/run-sim.js` (`runSimOn`, handed the logic
  and data); the CLI is its Node host. It plays the game's own rules (`runBattleExtra`, `runClinic`, `fxRunPrice`,
  `startWild`/`startTrainer`, `catchKeep`/`catchOffer`, `battleSettle`, `runEnd`); what the player does is
  `SIM_POLICY` (battle-formats and run-loop test those rules). The
  simulation's full report: `node tools/test/sim/run-sim.mjs --runs=50 --team=1` (validation/sim/runs.json; it reports,
  bounds wait for the owner). Studio plan Phase 3b: the bot answers a Loophole pick and buys a shop's (`relics` in the
  policy; `--policy=never-pick` is the baseline that takes none), walking in heals by the held Loopholes
  (`runArriveFx`) and a town's wares come through the run's unlocks (`runShopOpen`). `--balance` makes no scenes
  (each place a lite map with tall grass: ~250 times faster, the same outcomes; `run-sim.test.mjs` plays seeds in both
  modes and checks the stand-in on real scenes). `--out=base.json` writes the report with every run's stats;
  `--compare=base.json` plays its seeds with its options on the data as it is now and writes the paired compare
  (validation/sim/compare.json; `logic/sim-compare.js`: Wilson intervals, paired differences, flips, a data hash,
  tested in `sim-compare.test.mjs`). The habit for a change that may move the numbers:
  `node tools/test/sim/run-sim.mjs --runs=200 --balance --out=base.json` before, `--compare=base.json` after. `run-world-real.test.mjs` also checks a run's buildings (the landing's mast, a town's
  clinic and shop), its trainers in their own world and its bridges (both ends dry, a stream crossed square within
  25 degrees).
- The world (RL-5): the game's world is Copperleaf alone; the old one is parked in `game/data/legacy` (its own
  `legacy/index.json`, read by `readLegacyData()` in `tools/data-files.mjs`, null without one). A test that uses the
  old places as test data (the bowl's ground and landmarks, scripts said there) reads `oldWorld()`
  (`tools/test/old-world.mjs`: the game's places, roads, maps and trainers plus the parked ones), so parking or
  bringing back a place doesn't change it. `world-tables-real.test.mjs` snapshots the tables `worldSetGraph` works out
  on the game's data; `world-graph-set.test.mjs` puts a 3-place world in and the hub back (every table deep-equal, the
  same objects); `saves-real` puts the old world in through `worldSetGraph` for its wild-stock cases and the hub back
  after. A test that swaps the world puts the hub back in `finally`.
- The map generator (MG-1, MG-2, TR-1; `tools/test/mapgen*.test.mjs`): `mapgen.test.mjs` the MG-1 invariants (format,
  determinism, a stage's own seed, the hub reaches every exit, nothing grows on paths or in water); `mapgen-golden`
  a hash per part of five unjoined scenes (`gen` left out), so a change says which part moved: remake it on purpose
  (`--test-update-snapshots`) and say so; `mapgen-seams` joined pairs (`mapgenEdgeStrip`, `mapgenSeamAgreement`: no
  height gap over the neighbour band, no step, a straight walk across; terraces at ground level by exits; a node
  with two parents; the pair laid as one scene); `mapgen-roads` roads measured with the game's own riser rule
  (`logic/step-grid.js`, moved from walk-view.js so a test sees the road as the game draws it); `mapgen-lots` the
  hub's buildings; `mapgen-mountains` (TR-2) the mountains and their trails: without the dials a scene is unchanged,
  dial sets reach every exit and every summit with `{ slope: true }` (the game's slope rule and whole standing heights,
  a bridge's deck walked), the dial's top reaches 15 m, nothing planted across a cliff, the relief seed moves only the
  mountains, a mountains run (`dbg_mountains`) joins; `mapgen-ledges` (TR-2c) ledges one way, no trap (`mapgenTraps`, the game's
  canStepBetween rule), stairs and reachable pockets, a scene without the dial unchanged. `mapgen-grass` (TR-2c) the tall grass
  patches: 3-6 of 15-70 m² by the dial, one across the way west (the westmost exit's path goes through tall grass),
  none within 7 m of the hub or an exit, every exit reached and no trap, the road unchanged by the dial. MAPGEN_VERSION
  6 remade the golden scenes and the scene hash (rng.test). TR-3 (the camera on tall
  ground): `camera-rise.test.mjs` the tilt that clears the line from the eye to your head (logic/camera-rise.js: none
  on flat ground or for ground behind you, capped, follows the camera's turn); `tall-ground-draw.test.mjs`, on the
  walk renderer with a recording WebGL stand-in (`walk-renderer.mjs`), the rock fade's uniforms (off on flat ground,
  in battle and for a reflection camera), the silhouette's one draw (depth GREATER, no depth writes, the state put
  back; none on flat ground, in battle, indoors) and the near shadow map centred at your height. The fast check's
  `mountains` fixture is the run fixture with `dbg_mountains`; its step "Tall ground" stands you at the foot of the
  most rock on the camera's side and checks the rise, the fade and the silhouette are on, and off on flat ground. Its
  pictures come from `python3 tools/look-tall-ground.py` (five, settings off to all on, in validation/tall-ground/;
  `--full` with the game's graphics). `rng.test.mjs` freezes the default scene's hash, `gen` included: a new dial or version changes it
  (remade on purpose, said in the commit). The seam rules are `logic/seam-rules.js` (`seam-rules.test.mjs` freezes
  each fault's words); check-data runs the same module.
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
- The Road phase was removed in RL-5 (the hub has no road); RL-7 brought it back as "A run's road" (a run put on a
  copy of the save, its world made, the landing's north seam walked a step at a time, the next place on day 2, the
  save and the hub's world put back). RL-8 added "A run: airship, nodes, payout" (a short run taken off from the mast
  on a copy of the save, the flight, a battle, a paid heal, the Alpha boss, the payout, home). The Room phase walks into Hazel's lab; the night, Billies-in-the-world and
  Stress phases run on the hub's map. The scenes of a run's world are not in the "Walk:" list.
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
  `cs-choose`, `cs-yes`, and since RL-8 the mast's `runstart`); it switches the tabs, opens the shop and starts
  the in-game test and the log export by script (corrected in RL-8: this line said it tapped them). The Help buttons
  `quicktest`, `diagtest` and `dbglog` are how the owner starts them on the phone: keep them, or change the checks in
  the same commit. Pure UI logic that
  moves out of a screen (prices, sorting, text building) gets unit tests. UI-5: the bottom bar is the kit's
  `<pb-nav-bar id="nav">` (Map, Team, Bag; no Walk or Guide tab), its tabs in its shadow tree with `data-t`
  (check-fast.py `nav_tap`); the fast check's "Every screen opens with its parts" opens each screen by the buttons a
  player taps, and a move that must change nothing on screen proves it with `tools/style-diff.py` (0 differences
  against HEAD).
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
  tests (`saves.test.mjs`, `validSave`). RL-9: `tools/test/ranch.test.mjs` (training's logic on the game's rules),
  check-fast's ranch step on `?fixture=ranch` (Train, a level with the page's clock moved on, the cap, a clock turned
  back, a reload) and the in-game test's "The ranch: training between runs". RL-9b: check-fast's "Packing for a run"
  on `?fixture=ranch` (a trainee from storage picked, two Potions packed; kept on a loss, back in storage once; a win
  brings the bag home; a reload), run-state tests for the pick, the pack and the storage trap, the in-game run phase's
  party of one. RL-10a: `tools/test/breeding.test.mjs` (the mark, the reasons a pair can't breed, safe and risky eggs,
  paying, hatching, a clock turned back, the save's checks), check-fast's "Breeding" on `?fixture=ranch` (the safe
  egg shown is the one bred, hatched through the hatch window after `breed.hours`; a risky pair; the clock turned
  back; a reload), the in-game test's "The ranch: breeding a pair", and the breeding sim (`tools/test/sim/
  breeding-sim.mjs`, report only; `breeding-sim.test.mjs` runs it small).
- **RL-11 Unlocks**: `tools/test/unlocks.test.mjs` (doors and currencies, buying once, refusals, milestones never on a
  run, the tidy-up on load, a run's copy making the same map and stock), the new condition kinds in
  `conditions.test.mjs`, `run.unlocks` in `run-state.test.mjs`; check-data's blocks for `currencies`, `buildings` and
  `unlocks` (planted faults in the commits); check-fast's Lab step on `?fixture=lab` (a milestone on load, the board,
  buying at the Lab, the ranch and the mast, a reload) and the in-game test's "The Lab: unlocks".
- **RL-12 Loopholes**: `effects.test.mjs` (each effect kind, stacking in any order, every Loophole at once finite, no
  rows change nothing), `relics.test.mjs` (offers from the seed, the cap, a shop's shelf, validRun, a run saved
  before), `battle-fx.test.mjs` (stages, damage, catch, win money), `run-fx.test.mjs` (arrival heal, the payout row),
  a fifth golden battle holding three Loopholes; check-fast's "Loopholes" on `?fixture=relics`; the in-game run
  phase and quick check's RL-8 step buy a shop's Loophole or take a mini-boss's pick and see the boss's battle carry
  it.
- **14 Studio**: `tools/check-studio-github.py` and smoke's "Studio opens" keep passing (local mode and
  `check-quick.py --studio` were dropped, Studio plan T1.4). A new Studio feature adds a step function to its `STEPS`
  (UI-3), so it can also run alone with `--only=<name>`. Since T1.4 CI's smoke job runs
  `--only=sections,publish,drafts,studio_test,checks` on every pull request that touches `studio/` or
  `game/js/logic/` (about 6 minutes here).
- **Data checks (Studio plan T1.3)**: check-data and the Studio's Check share `game/js/logic/data-checks.js`. A new
  rule goes there as a pure function of the data, with a unit test in `data-checks.test.mjs`; an `error` fails
  check-data and blocks the Studio's Propose, a `warn` is shown and never blocks. `check-data-snapshot.test.mjs` holds
  check-data's whole output on the game data and on two planted copies (in a temp copy made with `PB_DATA_DIR`): a
  change meant to alter its words remakes it with `--test-update-snapshots`, said in the commit.
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
  studio/gallery.html at 320 and 390 px, light and dark, plus the shaped parts with the stepped preset (73 pictures;
  89 since UI-4's run parts),
  and compares each with the committed baseline in validation/ui-gallery/ (fails above 0.05% of a picture; a 2 px
  change to a cut is caught). A new kit part or state goes into the gallery as a section with `data-shot`; a look
  change on purpose is `python3 tools/check-ui-gallery.py --update`, said in the commit. Not in CI: the baseline is
  this container's Chromium and fonts. `tools/test/ui-theme.test.mjs` also checks the shape polygons (tokens.css's
  copy equals the generator's) and `tools/test/ui-icons.test.mjs` keeps game/art/ui/*.svg equal to the grids in
  tools/build-ui-icons.py.
  UI-4: `tools/test/run-marks.test.mjs` checks the run map's node outlines (logic/run-marks.js: the plan's shapes,
  inside their box, clockwise, distinct; hidden reads "?"; the canvas painter draws whole pixels in the role
  colours). The run parts (js/ui-run-kit.js) are in the gallery's run-hud, run-nodes, picks and payout sections; the
  pictures take them at their end (reduced motion), and the gallery's buttons play the motions.
  UI-3: uiTheme.json is version 2 (every group the Studio's dials edit). `ui-theme.test.mjs` keeps tokens.css's
  scales (space, text sizes, motion, drop shadows) equal to the data's defaults and the variables a screen override
  declares again (`UI_DERIVED`) equal to tokens.css and polish.css; `ui-dials.test.mjs` keeps every Studio dial on a
  place in the schema with the schema's range, and every schema value with a dial. The contrast check (text 4.5:1,
  danger and primary 3:1; overrides too) is `uiThemeContrast` in logic/ui-theme.js, run by check-data and the
  Studio's Check. `tools/check-studio-github.py`'s `ui` step drives the Studio's UI look section (a dial previewed and
  undone, a screen override, a preset, Find, the Check, Hold to compare, the proposal carrying uiTheme.json); run it
  alone with `python3 tools/check-studio-github.py --only=ui` (about a minute; `--only=` takes any names from its
  `STEPS`, plus `sections` and `art` for the two blocks before them). A new uiTheme.json group needs its schema,
  its dials in logic/ui-dials.js and its writer in logic/ui-theme.js together, or the tests fail.
- **Roguelite track** (docs/phases/roguelite-track.md): RL-5 parked every place but Copperleaf. The fast check
  (`tools/check-fast.py`, CI) and its fixtures start there (`town`, `room` = Hazel's lab, `battle` = Leader Rocco); the
  `route` and `cave` fixtures and checks, the full check's road walks, seams, close-ups and the flight to another town
  were retired with their places (each change is marked RL-5 in tools/check-quick.py). RL-7 brought a run's world
  back into the checks: the `run` fixture (the fixture's team on a run with the seed RL7FIXTURE, landed on day 1; its
  world is made at boot), the fast check's run page (the landing drawing, every place on the bowl, a seam walked a
  day later; about 50 s), the full check's step "RL-7: a run's roads" (a run swapped in, a seam walked each way with
  `cross()`, the hub swapped back) and the in-game test's "A run's road". `cross()` walks `run.seamIn` metres further
  in a run, where a crossing counts that far in. RL-8: smoke's phone flow taps Copperleaf's mast and opens the run's
  sheet; the fast check's second run page holds a run battle, reloads (`?fixture=stored`) into the same battle, loses,
  reloads at the payout, keeps one Billie and flies home; the full check's step "RL-8: a run from the mast" plays a run
  from the mast to home (the flight, a battle, a seam, a paid heal, the shop, a mini-boss in doubles, the Alpha boss,
  the payout). Smoke's shop steps open `CHECK_SHOP`, a shop the check makes for itself (the game has none
  now). check-data checks `game/data/legacy` only for being readable: every listed file is there, nothing unlisted,
  maps and trainers against their schemas; the Unused report counts props the parked maps place as used.
  UI-3b: the lint's rules are game/js/logic/ui-lint.js (the Studio runs them; `node tools/ui-lint.mjs --lines` lists
  every raw value with its line); `ui-lint.test.mjs` keeps the files the Studio finds by following the pages equal to
  the ones the command line walks (a new logic file must be on a page). `ui-dials.test.mjs` checks every dial writes
  a CSS variable (`uiDialVars`); `ui-inspect.test.mjs` the inspect and overlay rules. The fixtures `team`, `bag` and
  `talk` (game/js/fixture.js) open those screens for the Studio's preview. The Studio check's `ui_tools` step (rule
  report, inspect, Connections, overlays; about 30 s) and `ui_screens` (each real screen and before/after; about 4
  min, as each screen boots the game) run with `--only=ui_tools,ui_screens`.
- **Sound track** (docs/phases/sound-track.md): the volume maths is pure (`game/js/audio/levels.js`) and tested in
  Node (`sound-levels.test.mjs`). The full check's "Sound settings" step (SND-1; alone with `--steps="sound
  settings"`, about 1 min) opens Settings → Sound on a phone page in the town, starts the audio with a touch, and
  reads only connections and the targets the gains are given: each Test button reaches its own bus (a wrapper on
  `AudioNode.connect`), each slider sets its bus while dragged (a wrapper on `AudioParam.setTargetAtTime`; the wanted
  level comes from where the slider stands), the header mute silences the master and keeps the levels. Don't read
  `gain.value` for this: Chrome stops working out a gain no sound goes through, so an idle bus's value stops part
  way. A browser that won't start audio is reported, not failed.
  SND-2: **song fingerprints**. `python3 tools/check-sound.py` (about 1 min; `--only=meadow,victory` for some) renders
  8 bars of every song (by day, and at night with the pad), every jingle and every species' cry through an
  `OfflineAudioContext`, through the game's own `initSound`, `music`, `jingle` and `soundEffect`, and compares the
  loudness of each 50 ms window with `validation/sound-baseline/` (committed; 1% or 0.0001 per window). Run it after
  any change to `sound.js`, `audio/tracker.js` or `music.json`: a refactor that changes a fingerprint is a bug.
  `--baseline` writes it again, only when a change to the sound is on purpose (SND-4, SND-5), in its own commit.
  It seeds `Math.random` (the drums' noise uses it) and holds the context's clock still while one tick schedules all 8
  bars. The full check runs it as "Song fingerprints". Which song plays where is `logic/music-where.js` `songFor`,
  tested in Node on the real table (`sound.test.mjs`); the full check's "Run music" step (alone with `--steps="run
  music"`, about 20 s) opens the run fixture and checks each place's pick and that the sync asks for a biome's song
  (`soundEngine.want`: nothing is heard). The Unused report lists songs nothing plays.
  SND-4: the night fingerprint is the song's night version (sound.js `musicVariant`, `trackerNight`), rendered as long
  as that recipe; songs with `night: false` render by day with the pad as before. The baseline was written again on
  purpose (four voices, the hooks, the night versions). Night versions by day/night level: `songVariant` in
  `sound.test.mjs`; the composer's answer and `trackerNight` in `tracker.test.mjs`; placeholders in
  `music-studio.test.mjs`.
  SND-5: a song also renders its intro (`intro`), a battle song its tense version (`tense`), a biome's song its arc
  bands (`mid`, `late`) and a run's song its deadline version (`deadline`): sound.js `musicParts` names them, each
  rendered as long as `trackerRecipe` makes it (109 fingerprints). To check a commit against the one before (not the
  baseline), render the earlier commit's fingerprints in a worktree with `--baseline` and compare against those.
  Full-check steps: "Run music" also expects each node's arc band and, on the deadline day, the deadline version;
  "Battle music" (alone with `--steps="battle music"`, about 30 s) taps sound on in the run fixture, starts a wild
  battle and the first mini-boss and reads `soundEngine.log` (the music's battle cues, in memory, never sent): the
  song with its intro on the flash, the drums held, then in on the first throw (not the 8 s fallback), the mini-boss
  on the leader song; "Run map music" (`--steps="run map music"`, about 20 s) sets today's forecast to storm, rain and
  clear on the map tab and reads the low-pass each gives (a wrapper on `setTargetAtTime`). Unit tests:
  `tracker.test.mjs` (the intro, the hold and `restart`, `trackerTense`, `trackerArc`, `counterAuto`,
  `trackerDeadline`, `trackerRecipe`), `sound.test.mjs` (`musicBattleKind`, `musicRedZone`, `musicArcBand`, the
  deadline, `musicWeatherCut`, `songVariant`'s order: battle tense; else deadline; else band then night).
  `check-studio-github.py --only=music` also draws an intro note, plays wild on its intro and as wild@tense, and sets
  an arc band's drums, all undone; it reads the where rules' places from the table.
  SND-3: the cry fingerprints are the 24 species by id (bezos0), as the game asks for them (they were the roster's
  names, which the game never passes). The Studio's **Music & sound** section: `python3 tools/check-studio-github.py
  --only=music` (about a minute) plays a song with a real click (the context running, the bar shown), changes its tempo
  and a chord while it plays and undoes them, draws a hook and a counter note on the roll and hears them, moves,
  adds and undoes where-rules with Try a place following, plays and lengthens a jingle, sets and empties a Billy's
  cry, checks the Check's music findings and Show me, and that leaving the section stops the song; each part ends with
  nothing left to propose. The Studio self-test has a `music` tool row (a song for a second, no timer left; a context
  that won't run is failed only when the test was started by a click). Unit tests: `music-studio.test.mjs` (numerals,
  rules in words, where songs play, the findings, the schema's choices, jingles as notes and back),
  `tracker.test.mjs` (the hook and counter; the tracker is a page module, so it is read through the test globals),
  `cries.test.mjs`.
- **18 Trading and battles with friends**: every new Firestore rule gets emulator tests in `firebase/test/`;
  trade validation is logic with unit tests.

## Before a phase ends

1. Tiers (a), (b) and the before-commit checks pass; smoke passed before each game commit.
2. The full quick check passes (or each failure is explained in HANDOFF).
3. `--selftest` passes if the phase touched anything the in-game test plays.
4. HANDOFF lists the tiers' times if they changed, and anything this file asked the phase to update.

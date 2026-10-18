# Handoff log

Newest entry on top. Every phase session ends by adding an entry here and tagging the commit `phase-NN-done`.

## Entry template
### Phase NN - <name> - <date>
- Changed: 
- Risky or unfinished: 
- Verified (what ran, what passed): 
- Decisions I made (and why): 
- Questions waiting for the owner: 
- Next session starts with: 

### Phase 16 prep - Billies rework plan, part kits, test boot - 2026-10-18
- Changed: docs/phases/16 rewritten (7-line roster, parts, sizes, weight, Prime, decisions and open questions);
  placeholder part kits (beasts, birds, fish; 120 parts) sliced by tools/slice-part-kit.py into game/art/next/parts
  from tools/art-source/part-kit; recolour placeholders in game/art/next/placeholders.
- **Test boot (on):** game/js/test-boot.js. While `TEST_BOOT_ON` is true the game skips the title and the opening and
  opens on the starter pick; nothing is read from or written to storage (game-state.js), accounts and friends stay off
  (account.js), the title is skipped (title.js). Turn it off by setting `TEST_BOOT_ON = false`, or open the game with
  `?boot=normal`. The quick check, check-game.py and the art tools open `?boot=normal`, so they test the normal game.
  Nothing was removed.
- Verified: lint, type-check, module check, unit tests (25), format check; a headless boot reaches the starter pick in
  about 10 s with no title, no Firebase, an existing save untouched and no storage writes after picking and saving; a
  reload goes back to the pick; `?boot=normal` reaches the title. The full quick check was not run.
- Next: the phase 16 prototype (parts on wild Billies, Studio support), after the plan is approved.

### Phase 04e - Modernize: TypeScript and the logic boundary - 2026-10-18
Owner's choices (from phase 05): the recommended 04e choices made for you; no full quick check. Plan approved at the start.
- Changed (33 commits on top of phase 05, this entry included):
  - The 22 prepared commits (docs/phases/04e/patches), applied with `git am`, no conflict: TypeScript 7.0.2
    (`npm run typecheck`, JSDoc and game/types/*.d.ts, no compile step), data-files.js, game-data.js, map-files.js and
    game-state.js checked, the type check in CI, dist/ without game/types, tools/move-names.mjs, and the four moves into
    game/js/logic/ (rules.js, saves.js, battle-engine.js; game-state.js 930 -> 172 lines, battle.js 2320 -> 1299).
  - tools/check-logic.mjs (`npm run check:logic`, 7 tests, 0.2 s, in the CI lint job): the logic loads and runs in
    plain Node with a data set of its own.
  - `// @ts-check` on the three logic modules (one commit each). 14 errors, all fixed with JSDoc only: the type imports
    that stayed behind in game-state.js, three optional battle rules the code reads with a fallback (alphaShieldMult,
    alphaPhaseAt, alphaShieldTurns, set by no data), and two casts with their reason.
  - tsconfig.logic.json: the logic checked again with no DOM lib (in `npm run typecheck`, 0.6 s for both). A planted
    document.title and localStorage in rules.js fail there.
  - Deleted: roadsOf() (always returned []); the always-false artCacheVersion branches in ground-paint-worker.js and
    world-map-gl.js; the Studio's hidden "With its neighbours" preview (seamlessHubMap); both names left eslint.config.js's
    OPTIONAL list (only firebase is left).
  - `npm run lint` caches ESLint's results by content (.eslintcache, ignored): 2.4 s warm instead of 7.3 s cold.
  - Docs: README (typecheck, check:logic, game/js/logic/), NAMING.md (a line for game/js/logic/), CHANGELOG.
- Risky or unfinished:
  - The known risks in docs/phases/04e-plan.md still hold: hooks.js's slots are untyped (any), noImplicitAny is off,
    the .d.ts types repeat the JSON schemas (a field added in the Studio needs both), TypeScript 7 is a native binary per
    platform (an optional dependency), and a stored trip plan is only checked for its first hop.
  - The no-DOM check covers the checked files only: util.js, hooks.js and test-globals.js are read, not checked. ESLint's
    no-browser-globals rule for game/js/logic/ still covers the rest.
  - The Studio has no joined-neighbours preview now (it had none in practice since 04d). Bringing it back means loading
    seamless-world.js in the Studio: phase 14.
  - The ESLint cache is safe for this config (it hashes the computed config per file; a planted undefined name was
    still caught warm). If lint ever looks wrong, delete .eslintcache.
- Verified:
  - Every commit: typecheck, lint, check:modules, format:check, build; from the check-logic commit on, check:logic.
    The two intermediate ts-check commits also pass on their own.
  - Smoke 14/14 after each move on its own (0019, 0020, 0021, 0022) and at the end; check-studio-github.py (18
    sections, a change proposed) after the moves and at the end.
  - A planted `newSave().route.plan` in saves.js is refused (TS2339: 'route' does not exist on 'SaveData').
  - A debug log exported headless on `?test=1&scene=marigold` has the same keys and sections (two levels deep) and
    event kinds as at the end of phase 05, with no page errors.
  - Not done: the full quick check (your call), the in-game full test on a phone.
- Decisions I made (and why):
  - I first thought the artCacheVersion branches were a 04d regression to fix by importing the name from hooks.js.
    Wrong: the Studio, the only page that defines it, loads neither file, so deleting them (the prepared plan) was right.
  - The logic-only tsconfig was cheap (one small .d.ts for console), so it went in.
  - Python Playwright here needed the version that matches the preinstalled Chromium (1.56.0); tools/requirements-check.txt
    is unchanged.
- Questions waiting for the owner:
  - Push the tags `phase-05-done` (on 0c62318) and `phase-04-done` (on the commit that adds this entry): my tag push is
    refused again (HTTP 403). Both exist locally only in this container. The tag push also makes the CI picture baseline.
  - Still open: check-studio-github.py in CI? Studio local mode; tags phase-01/02/03-done and legacy-final.
- Next session starts with: on your phone, a new game, the in-game full test and a debug log from this build; then the
  look at the game the roadmap asks for before phase 06, and phase 06 (or 08/13, your call).

### Phase 05 - Internal renaming - 2026-10-18
Owner's choices: phase 05 first, then 04e; "one rename" means one rename rule per commit (one name, one prefix family,
one file, one data key or section); no confirmations, so I made the "Ask me before" calls myself (listed under
Decisions); no full quick check for either phase; 04e starts in a new session from a plan and patches committed here.
- Changed (295 commits; the old -> new list is docs/archive/phase-05-renames.md, the rules docs/NAMING.md):
  - Tools, each with a proof that a rename changed nothing else: tools/rename.mjs (a name, a prefix family, a file or
    a property, across the game, the Studio, the Node and Python tools and the current docs; `verify` compares the
    syntax trees before and after), tools/rename-data.mjs (a data key or section; the proof is at the JSON level),
    tools/rename-strings.py (the code names inside the Python tools' strings and comments), tools/rename-ids.mjs
    (the location ids, with the art named by an id).
  - 44 files: diorama -> walk-view, diorama-gl -> walk-view-gl, scene -> battle-stage, map -> world-map, owmon ->
    world-billies, world -> seamless-world, core -> game-state, data -> game-data, log -> debug-log, selftest ->
    self-test, props3d -> solid-props, vox -> prop-models, engine/core -> engine/webgl, and the Studio's (core ->
    studio-app, scenes -> map-editor, voxedit -> model-editor...).
  - 1,743 code names in 248 rename commits: the cryptic globals (S saveData, U uiState, B activeBattle, GD gameData,
    RM reducedMotion, SC battleStage, DIO walkView, DGL walkRenderer, MAP worldMap, WORLD seamlessWorld, ST
    studioState, NWLOG debugLog, tw, at...), the prefix families (dio, dgl, egl, mgl, mm, ow, wr, bld, p3d, vox,
    sc, ...), and the vocabulary in NAMING.md order.
  - Data: sections route -> locations, links -> roads, backdrops -> battleStages, scenes -> maps; keys place ->
    locationId (maps, rules.start, legends), scene -> mapId (locations), area -> battleStage (locations, trainers),
    vox -> model (the prop catalogue, placed props, and game/art/scene/props.json); lore.places -> lore.locations and
    its unlocks place:<id> -> location:<id>.
  - Save format 2 (its own commit), then saveData.route -> saveData.trip.
  - The location ids match their names: 43 locations and their maps (sundown -> marigold, longgrass ->
    tallgrass_meadow, grotto -> fizzwell...) and one room (int_twofold_market -> int_twinpetal_market), with their
    roads, pools, shops, lore, map files, miniatures, postcards and flags.
  - Lint: ESLint `camelcase`, and tools/check-names.mjs in `npm run lint` (no top-level name of one or two characters
    but $ and $$, no retired name or prefix, kebab-case files).
  - Not renames, each in its own commit: the debug log says when a function it should wrap or time is missing (a
    missed rename used to drop events in silence); the diagnostics' pass timers work again without the test globals
    (broken since 04d: the report's frame budget was empty on a phone; 10 of 13 passes timed); Puffcap Woods and
    Russetwood get their flower colours (the table named them by ids that never existed); four unused Studio names
    and two unused game names deleted, two aliases folded (BORDER_M, PROP_MATERIALS); the old-place-name check reads
    game/js/engine and studio/js too; the colour mood setting's text (shown in the Studio's Engine section) names
    Marigold Town, Thornberry Wood and Stepstone Canyon instead of the legacy "Sundown".
  - Docs: NAMING.md final, the rename table, README (tools), CHANGELOG, and docs/phases/04e-plan.md with its 22
    prepared commits (docs/phases/04e/patches).
- Risky or unfinished:
  - Your saves from earlier 0.1.0 builds don't load (format 2): a new game starts and the old save is kept aside.
  - Ids that leave the game: a friend on an older build sees your presence by the old map id; old `?scene=` links,
    debug logs and Studio exports name places the old way. Reload an open Studio tab before you propose a change
    (an old tab would send the old keys; the data check refuses them).
  - The 43 places with a new id look a little different: the pattern of their ground, their countryside, townsfolk
    and stamps are picked from the id. Accepted (see Decisions); the local baseline pictures were renamed with the
    ids and compared.
  - Not renamed on purpose: generic prop fields (ox, oy, img, fx, box, group, k, s), the properties of in-memory
    state, CSS and DOM ids, Billie line/species/move/item/coin ids, battle stage and pool ids, version-stamped data
    markers, and every format something else reads (Firestore, localStorage, the debug log's keys, URL parameters,
    Studio section ids, art folders). NAMING.md says where each goes.
  - The Python art and scene builders had their strings renamed by tokenizer and pass py_compile, but they were not
    run end to end (they redraw the art).
  - Bundle: 1,618 KB (475 KB gzipped), 84 KB more than 04d raw (longer names) and the same gzipped.
  - Pre-existing, not fixed: in a check run, "walk the world yourself" finds no D-pad when it runs right after the
    postcards step or a failed step (it passes alone).
  - Follow-ups worth doing: rules.legends[].scene and lore.clues[].at.scene are map ids and could be mapId; the
    title picture art/background/sundown.png; tools/build-interiors.py's text 'Inside Twofold Market'; stale battle
    stage and pool ids (shell, esc, clear, food); duplicates unitVector3, hexChannels/hexToRgb, imageLoaded/imageReady;
    the AREAS alias (kept: the Studio's battle preview captures it at load); roadsOf() always returns [] (04e plan).
- Verified:
  - Every rename commit: rename verify ("a pure rename": the syntax trees differ only by the rule), ESLint, Prettier,
    check:modules, check:data, build and py_compile; data commits: rename-data verify (JSON equal but for the key);
    the id commit: rename-ids verify (the old data with the id map applied equals the new data, art only moved).
  - After each batch: smoke 14/14, check-studio-github.py (18 sections, a change proposed), the paint worker check;
    adversarial reviews after each batch found missed references, fixed in follow-up rules.
  - Full quick check: 48/48 at ee0e06f (after the code renames). On the location id commit, all 48 steps ran: 46
    passed; "the road east" failed on three `[...S.seats]` the S rename missed in check-quick.py (fixed, 156c092), and
    the D-pad step after it; both passed when re-run with the fix. Not run end to end after that (your call).
  - At the end: lint, check-names, format, check:modules, check:data and build pass; a debug log exported headless on
    `?test=1&scene=marigold` has the same sections, keys and event kinds as the one from before phase 05, with no
    page errors.
  - Not done: the picture baseline in CI (made when the phase-05-done tag is pushed, or by hand), the in-game full
    test on a phone.
- Decisions I made (and why):
  - road, not route, for a link between locations (pushing back on the phase file): `route` already names the
    route-kind locations and their "Route 2" label, which players read as the area, so it stays for those. `trip`
    for the player's travel along roads.
  - seam for the shared strip between two maps (`border` is a CSS word everywhere).
  - battleStage for the battle stage, BATTLE_STAGES for its data; vox -> model (prop recipes make low-poly meshes;
    `voxel` stays for real voxels and the .vox format, and art/scene/vox/ keeps its name).
  - Location ids from the player-facing names (a town without "Town", other places their own word, or the whole
    name where the word alone is an everyday word or already a game name), and the new look of those places that
    follows from the ids.
  - Save format 2 before the first save-field rename, so old saves are set aside cleanly instead of loading half
    renamed.
  - Kept: the formats listed under Risky, prop fields (04e types or phase 09), roster ids (phases 15-16). The phase
    file asked for prop fields and species/item/line ids in this pass; renaming them now would be done twice.
  - The colour mood text in engine/settings.js (player-facing in the Studio) names the current places: you had asked
    about "Sundown" there in 04d.
  - No full quick check at the end, and 04e in a new session, as you asked.
- Questions waiting for the owner:
  - Push the tag `phase-05-done`: my push was refused (the remote hangs up on tag pushes). It goes on the commit that
    adds this line ("Docs: HANDOFF, phase 05: the tag to push"), the branch head at the end of the session. The tag
    push also makes the CI picture baseline; without it, run the check workflow by hand with "Make the picture
    baseline".
  - Still open from before: check-studio-github.py in CI (about a minute)? Studio local mode (start-studio.py); tags
    phase-01/02/03-done and legacy-final.
- Claims checked (CLAUDE.md asks me to treat figures as claims):
  - gamedata.js is generated (not in git) and 0.7 MB, not ~13 MB: the maps are fetched one file each when needed.
  - "Duplicate global functions silently override each other (camTo, dioTileHalf)": stale. camTo was defined once
    already at the start (scene.js, now battle-stage.js) and dioTileHalf didn't exist; ESLint and the module clash
    check refuse a duplicate.
  - "owmon" is a file (now world-billies.js), not a prefix; the prefixes were ow/owm.
  - The data is a file per map, Billie line, trainer and person and one per other section, not one per entity of
    every kind.
  - No picture baseline existed at the start of the phase; a local one was made (113 pictures) to compare against.
- Next session starts with: 04e (docs/phases/04e-plan.md: `git am docs/phases/04e/patches/*.patch`, then step 2),
  then `phase-04-done`. On your phone first: a new game (your save is set aside), the in-game full test and a debug
  log from this build.

### Phase 04d - Modernize: the window bridge removed - 2026-10-18
Owner's choices: generated hooks instead of forward imports (after the first plan failed, see Decisions); opt-in test
globals; JSDoc + .d.ts for TypeScript; this session is the bridge only, TypeScript and boundaries are 04e, which ends
with `phase-04-done`.
- Changed:
  - Nothing in the game or the Studio reaches a module's names as globals any more. A module imports from EARLIER
    modules directly; what it reads from a LATER module (154 names), or from whichever module the page has (the
    renderer shared with the Studio reading S, GD, RM, MOVES, sfx...; 64), it imports from game/js/hooks.js, a slot
    per name that the declaring module fills with provide(): functions at the top, other values right after their
    declaration (the timing the bridge had). 212 names in all. Page order and script tags are unchanged.
  - Setters for everything one module changes in another (an imported name can't be assigned): core.js setS, setB,
    setRM, setSaveHold, setNoSaving (the test mode); diorama.js and map.js for the 3D versions diorama-gl.js and
    map-gl.js put in place; battle.js and talk.js for extras.js's wraps; core.js setSave and map-gl.js setMglRender
    for the in-game full test; the Studio's swaps (engine source, dglAdapt, dioMount, rigParts, dioData, dioImg,
    artLoad, api, saveAll, toast, render, getP/setP, pedDraw). Each setter also updates hooks.js. Nothing renamed.
  - The Studio's inline shim script (S, U, B, RM, esc, the live data tables) is a module, studio/js/shims.js.
  - The debug log: log.js (classic, runs first) reads GAME.x instead of 25 module names, and NWLOG.hook wraps through
    GAME[name] instead of window[name]. game/js/log-names.js (generated, the last module of the game's page) fills
    GAME with getters and with setters for the ~45 functions the log wraps or times; the tool writes a setter into
    a module's generated part where it has none.
  - game/js/bridge.js is game/js/test-globals.js and puts the modules' names on window only with
    window.PB_TEST_GLOBALS = true (check-quick, check-game, check-studio-github and the art builders set it with an
    init script; their page.evaluate calls are unchanged) or ?globals in the address (the phone console).
  - tools/to-module.mjs: writes hooks.js and log-names.js, refuses a name it can't route without the bridge, and
    checks the load order (nothing a module reads while it loads, directly or through what it calls then, may come
    from a module that hasn't run). It caught a real case: boot.js calls accInit() at load, which reads NW_TEST.
  - ESLint lints every script with only the classic scripts' names as globals: a module name used without an import
    (or by a classic script) is a no-undef error. Planted toast() in tapdebug.js: caught.
- Risky or unfinished:
  - hooks.js holds copies. A module that reassigns a name others read from there must do it in a setter that calls
    provide(); the tool refuses anything else, but code that mutates through another path (eval, Function) is not
    seen (none found).
  - The load-order check is a static safety net (it follows direct calls and callbacks run at once, not functions
    stored in objects).
  - The cycles are not removed, only made explicit: most forward names are X -> ui.js (toast, render, modal,
    closeModal, sceneIdAt) and diorama-gl.js -> the renderer parts. Untangling them fits phase 06 (UI per screen).
  - The overrides keep their two-step shape (diorama-gl.js keeps the 2D function and calls setDioNav with the 3D
    one); a single definition would need renames (phase 05).
  - Bundle: 1,534 KB (476 KB gzipped), 16 KB more than 04c (hooks.js, setters, log-names.js); bundler renames
    (`DIO$1`) in the bundle fell from 4,030 to 941.
  - Opening the console on a phone: names are only there with ?globals now.
- Verified:
  - After each commit: lint, format:check, check:modules, build, smoke 14/14 (120-133 s, base 131 s), and
    check-studio-github.py after the Studio changes (18 sections, an edit proposed).
  - Debug log, headless on ?test=1, against the commit before the change: same sections, state, events and timing
    names; render, dioMount, save, openBattle, mglRender, renderOv and dglGround still wrapped.
  - Without the flag: the title, a walk scene and the Studio load with no errors and no module names on window.
  - Full quick check: NOT run end to end; the owner skipped it. Stopped inside Scenes after 16 steps, all passed.
    The nightly CI run on main covers it once this is merged.
  - In-game diagnostics test without the test globals (headless): not run yet, after the full check.
  - Phone load, emulated (CPU ×4, gzip, 4G 9 Mbit/40 ms), 04c vs 04d: not measured yet, after the full check.
- Decisions I made (and why): the approved plan (real forward imports) failed: an imported module runs before its
  importer, so 120 forward file pairs reorder the whole page (core.js would run before data.js); a chain of imports
  kept the Studio's order but not the game's. Asked again; you chose generated hooks. No main.js entry module (the
  page's module tags share one module map and keep their order). Setters instead of single definitions (no renames
  in a behaviour commit). The test globals keep the generated expose() in each module, off unless asked (a separate
  test-names module would have needed `export` on every top-level declaration). The bridge's file was renamed in its
  own commit.
- Questions waiting for the owner: still open from before: run check-studio-github.py in CI (about a minute)? The
  "Sundown" text in engine/settings.js and the old-name check on engine/ (phase 05)? Studio local mode
  (start-studio.py); tags phase-01/02/03-done and legacy-final.
- Next session starts with: 04e (TypeScript with JSDoc + .d.ts, starting with data and save formats; module
  boundaries for pure logic), then `phase-04-done`. On your phone first: the in-game full test and a debug log from
  this build (and ?globals if you use the console).

### Phase 04c - Modernize: ES modules - 2026-10-17
Owner's choices: conversion tool applied backwards from boot.js in batches; keep a window bridge through 04c; no
minifying.
- Changed:
  - Every game and Studio script is an ES module (74, plus game/js/bridge.js), except the classic ones on purpose:
    version.js (sw.js importScripts it), the art manifests and gamedata.js (generated data), data-files.js (the Node
    tools run it too), data-fallback.js (the synchronous data read), log.js and tapdebug.js (they catch errors before
    the modules run, and still work if a module fails to load on a phone).
  - tools/to-module.mjs (`npm run modules`; `npm run check:modules` in CI) writes the top of each module between the
    to-module markers: imports of what it reads from EARLIER modules of its page(s), `export` on what others import,
    and expose({...}). It imports a name only if every page loading the file loads the same module earlier, and the
    file never assigns it. Imports only point back, so modules run in the page's order, as the scripts did.
  - The window bridge (game/js/bridge.js): every module's top-level names are on window as a getter and a setter of
    the module's own variable. That is how a module reaches a LATER file's names (the cycles), names it assigns (S, B,
    RM, SAVE_HOLD, map-gl.js replacing map.js's functions, diorama-gl.js replacing dioNav/dioStop/dioProj/dioUnproject,
    extras.js wrapping openBattle/endBattle/talkFolk, the Studio's swaps) and names each page defines its own way
    (S, U, B, RM, esc, the Studio's live tables, the battle HUD hooks). The debug log's and the diagnostics' wrappers
    (`window.render = wrapped`) change the module's own variable, so calls inside and between modules are still timed.
    198 game names and 107 Studio names are still reached this way (the bundle renames their module variable, e.g.
    `DIO$1`); everything else is imported (569 import lines).
  - `$`, `$$`, `rnd`, `clamp` moved to game/js/util.js, loaded first by both pages (they were in core.js and the
    Studio's inline stand-ins). Reached through the bridge, `clamp` couldn't be inlined into the ground height code:
    the loader took ~5 s (17%) longer on an emulated phone. Now on par.
  - `npm run build` bundles each page's modules into one file (dist/game/js/game-<hash>.js, 1.5 MB, 470 KB gzipped;
    dist/studio/js/studio-<hash>.js), not minified, with a source map; one file per page so the
    order is the page's. The module sources are left out of dist/. The dev server serves every script as on disk.
  - ESLint lints module scripts as modules and refuses a name a module shares with another script of its page (in a
    module, no-redeclare can't see that). check-quick's duplicate-function check reads module tags and `export`.
  - check-quick v35 no longer counts art/next/tiles (deleted in phase 03; it failed "tiles: 0 variants" on the base).
  - tools/check-studio-github.py: the Studio in GitHub mode against a local stand-in for the API (sign-in, the data
    files, every section, an edit proposed as a pull request). Not in CI yet.
- Risky or unfinished:
  - Opening game/index.html from disk (file://) no longer works at all (modules need a server); before, only battles
    and the map failed. boot.js's file:// hint can't show any more.
  - Old phones: module scripts need Safari 11+ / Chrome 61+; WebGL 2 already needed more.
  - Script errors in a debug log now point into the bundle (line numbers differ from the sources; names are the same,
    sometimes with `$1`). The source map is next to the bundle for desktop devtools.
  - Strict mode: paint.js, world.js and account-config.js weren't strict before (every other file was). No scope
    differences found (all references resolve the same in script and module mode); smoke and the full check passed.
  - A bridge name a module assigns before the defining module has run would throw (strict); none found.
  - Pre-existing, found by testing dist: the old-name check reads game/js/*.js but not engine/; engine/settings.js
    still says "Sundown" in a setting description the Studio's Engine section shows.
- Verified:
  - Base commit, full quick check: 47 of 48 (v35 tiles, fixed above). After each batch: lint, check:modules, smoke
    14/14, a headless boot. Batch 2: Battles, v31, v33, airships, Walking: all pass but "walk the world yourself"
    (the known order-dependent D-pad failure, also on base). Batch 4: Shaders, Scenes, v32, v35, v43, v44, props made
    of shapes, Crowd: all pass. Studio (check-studio-github.py) after batches 3, 4, 5 and on dist: 18 sections, an
    edit proposed, no errors. dist/ with check-quick's smoke: the phone flow and debug log export pass (only the
    old-name note above, from reading the bundle).
  - Debug log: NWLOG.hook wraps `render` and the renderer timers inside modules (checked render.__nwT, dglGround.__nwP).
  - Phone load, emulated (CPU ×4, gzip, 4G 9 Mbit/40 ms), three runs each, before (04b build) → after: scripts done
    1.10 s → 1.13-1.22 s; loader done 28.5/32.9/29.2 s → 29.5/29.1/28.4 s; JS 62 files 751 KB → 10 files 643 KB.
    Slow 4G (1.6 Mbit/150 ms): scripts 5.1 → 4.5-4.9 s. Steady state on the title view: no bridge getter shows.
  - Full quick check on the final code: NOT run end to end; the owner skipped it. It was stopped after 16 steps
    (all passed), inside Scenes. The nightly CI run on main covers it once this is merged.
- Decisions I made (and why): kept the seven classic scripts above (reasons listed); explicit setters for the
  cross-file writes were not needed for 04c (the bridge setter does it) and go to 04d with the other globals; each
  page is bundled alone (a shared chunk could change the run order); helpers moved to util.js only where both copies
  were identical (esc differs: the Studio's turns null into '').
- Questions waiting for the owner: run tools/check-studio-github.py in CI (about a minute)? Fix the "Sundown" text and
  widen the old-name check to engine/ (phase 05)? Still open from before: Pages → GitHub Actions; Studio local mode
  (start-studio.py); tags phase-01/02/03-done and legacy-final.
- Next session starts with: 04d (TypeScript and boundaries). On your phone first: the in-game full test and a debug
  log from this build. 04d's first job is the bridge: replace the 198 bridge names with imports, setters and explicit
  hooks (the debug log's wrappers, the Studio's swaps, map-gl/diorama-gl/extras' overrides), then remove bridge.js
  (the quick check's page.evaluate calls need a test hook in its place).

### Phase 04b - Modernize: data split - 2026-10-17
Owner's choices: layout A, the build makes the start file and Pages deploys it from Actions, lazy maps this session,
delete the one-off scripts.
- Changed:
  - The game data is 257 JSON files in game/data: index.json (the order of everything), a file per map (scenes/, 91),
    Billie line (lines/, 58), trainer (trainers/, 48) and person (people/, 34), one file per other section. Same data,
    same order (checked when splitting). Layout and format in game/js/data-files.js, shared by the build, the game and
    the Studio: one-space JSON, lists of numbers and short values on one line (7.7 MB instead of 11.9 MB).
  - gamedata.js is generated (tools/build-data.mjs, `npm run data`; dev, build and check-quick make it) and not in git.
    Without it (the repository served as it is) js/data-fallback.js reads the files one by one and says so in the log.
  - Lazy maps: gamedata.js has every map except rooms without its ground and props (`_lite` lists what it uses).
    js/scene-files.js fetches data/scenes/<id>.json when needed: the maps two roads round you at start, the rest in the
    background after the loader, two roads ahead wherever you go. dioPrepare waits for a view's maps; the airship and
    the glass lift wait for the destination's; the full test waits for all of them.
  - world.js wrAdj looks only at its own place's seams (it worked out every link's; same result, checked for all 49).
  - Studio on GitHub reads the files (262 requests) and a proposal sends only changed files (deletes removed ones).
  - Bug found and fixed: every Studio save dropped the terrain `_` (the greenhouse floor), because the save strips
    keys starting with `_`. A key that is only `_` is kept now.
  - Schemas (game/data/schema) and tools/check-data.mjs (`npm run check:data`, CI lint job): files listed, layout,
    schemas (Ajv 8.17.1), references, map sizes.
  - Python tools: tools/gamedata.py load()/save() (save goes through tools/write-data.mjs, same format as the Studio);
    every build and fix script ported. Deleted only room-floors-v47, join-places and build-gallery: the other "one-off"
    scripts draw art or are imported by other scripts or check-quick (my count of ~32 in the plan was wrong).
  - .github/workflows/pages.yml deploys dist/ from main.
- Risky or unfinished:
  - Pages: until Settings → Pages → Source is "GitHub Actions", Pages serves the repository: no gamedata.js, so the
    game uses the slow fallback (one request per file, a 404 in the console), and the Pages workflow fails on main.
  - Studio local mode: start-studio.py (not in the repo) still reads and writes the single gamedata.js.
  - Lazy maps change load timing: code that reads a far map's ground synchronously sees a lite map until it loads
    (the world map's miniatures fill in when it does). Rare on a phone; the full quick check has not run on it.
  - build-test-scenes.py is out of date with the data (it would drop the gallery and test_windows scenes).
  - A pre-existing order-dependent failure: "walk the world yourself" fails with "no D-pad when the D-pad is chosen"
    after the earlier desktop steps, on the base commit too; it passes alone.
- Verified: smoke 14/14 after each stage (131-134 s); targeted full steps (Paths, Walking, Time/weather/rooms, Things
  to do, v43, alpha 0.2 terraces and seams, airship, lamps) all pass except the D-pad one above; in-game diagnostics
  test passed (12/12, no errors); Studio GitHub mode against a stand-in for the API (load, propose, delete); fallback
  boots; lint, format, build, check:data clean. Phone load, emulated (CPU ×4, gzip), original → now: data before start
  1006 KB → 191 KB; scripts done 3.0 s → 1.75 s on 4G, 10.6 s → 5.1 s on slow 4G; loader done 52 s → 33 s (slow 4G).
- Decisions I made (and why): rooms stay whole in the start file (laid into a place's view at once); the touched/stale
  rule rebuilds views only when a map was used before its file came (no hitches in the normal case); Python saves go
  through Node so there is one formatter.
- Questions waiting for the owner: switch Pages to GitHub Actions; keep or drop Studio local mode (start-studio.py);
  tags phase-03-done, legacy-final, phase-01-done, phase-02-done still not pushed.
- Next session starts with: 04c (ES modules). Ask the module conversion order first. Run the full quick check and the
  in-game full test on the phone once.

### Phase 04a - Modernize: tooling - 2026-10-16
Phase 04 is split into four sessions (04a tooling, 04b data split, 04c ES modules, 04d TypeScript and boundaries);
`phase-04-done` is tagged after 04d. Started without `phase-03-done` on the owner's go-ahead ("Start 04a").
- Changed:
  - package.json (no version: game/version.js stays the only place), package-lock.json, Node 22+. Tools pinned to
    releases at least two weeks old: Vite 8.3.2, ESLint 10.12.0, Prettier 3.9.9.
  - Vite (vite.config.js): `npm run dev` serves the repo with the classic scripts exactly as on disk (Vite's own
    transform turned gamedata.js into 75 MB with an inline source map); `npm run build` copies index.html, game/ and
    studio/ into dist/ unchanged; `npm run preview` serves it. Nothing is bundled until 04c.
  - Prettier (.prettierrc.json: width 120, single quotes, template strings untouched) over game/ and studio/ JS and
    CSS; game/data, game/art and HTML are left alone. The reformat is its own commit (adb27c9), listed in
    .git-blame-ignore-revs.
  - ESLint (eslint.config.js): each script is linted with the top-level names of the other scripts of its page as
    globals (parsed from index.html's order, inline scripts and window./self. assignments included), so no-undef and
    no-redeclare work across files. Plus the recommended bug rules. It replaces tools/check-globals.py (deleted).
  - Lint findings fixed, each its own no-behaviour-change commit: 16 duplicate keys in props3d.js P3D_AUTO (the later
    'lathe' entries always won; resulting object identical), the dead `STR_SH` shader warm-up entry in diorama-gl.js.
    Two commented exceptions (cleanName's control-character regex, the Studio wrapping pedDraw).
  - CI: new `lint` job on every push and PR (npm ci, lint, format:check, build). The full job's version step used a sed
    that the reformat broke (`self.PB_VERSION = '...'` now has spaces); it now runs version.js in Node.
  - README rewritten for GitHub (play on Pages, npm scripts, Studio, contribute, layout). The Studio's section guide
    moved to docs/STUDIO.md.
- Risky or unfinished:
  - The reformat touched every JS and CSS file (75k lines). Proven no-op: syntax trees identical for all 77 JS files
    (empty statements and a||(b||c) regrouping aside), the CSS minifies the same (whitespace in custom properties and
    calc() aside), smoke pictures differ only by animation timing. The full quick check has not run on it; its
    source-reading steps are in smoke and gave the same results.
  - Open branches made before the reformat (e.g. a Studio "Save to game" PR) touch only data and art, so they merge
    cleanly; any branch that edits game/js or studio/js will conflict everywhere. Re-apply such edits on the new base.
  - `format:check` in CI fails if JS or CSS is pushed unformatted: run `npm run format` first.
  - Leftover hooks ESLint flagged as optional on purpose: dioArtVer (Studio), wrHubScene (game), firebase (CDN).
- Verified: smoke 14/14 before (121 s) and after the reformat and at the end; `npm run lint`, `format:check`,
  `build` clean; dist/ identical to game/ and studio/; the game and the Studio boot headless from `npm run dev` and
  from `npm run preview` with no errors; ESLint catches a planted cross-file duplicate function, a duplicate const, a
  same-file duplicate and a typo.
- Decisions I made (and why): the build is a copy for now (Vite can't bundle classic scripts; hashing the CSS would
  have downloaded the fonts twice next to the preloads). ESLint over check-globals (a parser, not line patterns; the
  line check missed a second declarator on a line). Dead stores, unused variables and error causes are off: noise
  until modules. Markdown and HTML are not formatted.
- Questions waiting for the owner: tag `phase-03-done` (2b1f86f); the phase 04 questions still open: data-split layout
  (A: a file per map, species, trainer and person, one file per small table; or B: a file per entity everywhere),
  Pages from an Actions deploy of dist/ (needs Settings → Pages → Source: GitHub Actions), Studio local mode
  (upload start-studio.py or drop it), module conversion order (backwards from boot.js, or one generated conversion).
- Next session starts with: 04b, the data split, once the layout question is answered. First measure the phone load
  (gzip transfer of gamedata.js on Pages).

### Phase 03 - Fresh base and scope reset - 2026-10-16
- Changed:
  - Legacy: branch `legacy` pushed at 0314a22 (alpha 0.5 + phases 01-02). The tag `legacy-final` (same commit) was
    refused like every tag push from this session: the owner adds it, and attaches a `git archive` zip of it to a release
    if a zip is wanted.
  - Version 0.1.0 alpha in one file, game/version.js (`PB_VERSION`, `PB_VERSION_ID`). Read by the game (title screen
    corner), the Studio (top bar), sw.js (cache `pocketbillies-0.1.0-alpha-*`), the debug log and diagnostics (`build`),
    saves (`gameVersion`; `SAVE_VERSION` stays 1). check-quick step "Version" compares README.md and CHANGELOG.md.
    Scheme: 0.MINOR.PATCH alpha (owner approved).
  - CHANGELOG.md started; the old changelog (2160 lines) is docs/archive/LEGACY-CHANGELOG.md; README is 180 lines.
  - Deleted (each its own commit): pedometer and demo step buttons; Lite mode (Battery saver, every lite branch, the 2D
    walk painter in diorama.js, the Lite clue timer, the 16 px canvas ground, art/next/tiles); the Claude-artifact cloud
    mode and tools/build-artifact.py with check-quick's --page step; the `station` prop and its 4 pictures; dioTileHalf;
    the 19 `*@v45` scenes (1.5 MB) and the Studio's "Open its v45 layout"; the 'Net Worth' backup import; the v36 save
    migration check; tools/retired; the tools/src toolchain (build-art.cjs, runtime.cjs, export.js, vendor/); 16 one-off
    tools nothing imports.
  - New: without WebGL 2 the game shows "This device can't run Pocket Billies" (Try again, Export debug log), at start and
    when the walk view's WebGL fails for good. The Studio says there is no preview.
  - CI: the picture baseline is the release asset `baseline-<version>/quick-baseline.zip`, made on phase-* tags or by hand
    (Run workflow, "Make the picture baseline"); other full runs download it and compare. The full job gets
    `contents: write` for that.
- Not deleted, though the audit listed them (the audit was wrong): background/sundown.png (the Studio's "rebuild the web
  picture" reads it), scene/build/detail-a04.png (tools/build-airship.py's source), the `airship_mast` prop (the mast
  check and build-airship use it), migrate() (fills defaults; not a format converter), lookFromOld (NPC looks).
- Kept on purpose: the picture intro (it is also the cutscene's fallback on abort and reduced motion); `RULES.travel =
  'steps'` and the joystick step pipeline (phase 08); the debug step buttons; tapdebug.js; art/scene/tiles (Studio
  tile editor); map.js's 2D map (only after a lost WebGL context; phase 10 rewrites the map).
- Risky or unfinished:
  - The owner skipped the full quick check for this phase. The partial run passed 16 steps, none failed (phone flow,
    shaders, paths, test scenes, all data checks); "Scenes" and everything after it did not run. No picture baseline
    yet: the first phase-* tag (or Run workflow with "Make the picture baseline") makes it.
  - The 2D painter removal was found by a call-graph script; one name it got wrong (DIO_FX) broke the opening and was
    caught by smoke. The full Scenes/walking steps are the real proof and have not run.
  - Leftovers for later rewrites: `effects` preference field (always 'full'), `.demo-note` and other step CSS, `_dioProj2D`
    fallback in diorama-gl.js, build-tiles.py/build-terrain.py still write art/next/tiles if run.
- Verified: smoke 14/14 after every change (about 110 s), CI smoke green on every push; check-globals 0 duplicates;
  headless probes: version shown on the title, Studio, cache names, log and save; the no-WebGL screen and its debug log
  download.
- Decisions I made (and why): the version also shows on screen (title corner, Studio top bar) so a phone screenshot
  says which build it is; the baseline is a release asset (persists, no repo bloat) rather than an artifact (expires).
- Questions waiting for the owner: add the tags `legacy-final` (0314a22), `phase-01-done`, `phase-02-done`; OK that an
  old account save is replaced once the player plays on (from phase 02)?
- Next session starts with: phase 04. Tag `phase-03-done` on this phase's last commit first (the tag's full run also
  makes the picture baseline); if that run finds problems in Scenes or walking, fix them before phase 04 work.

### Phase 02 - Security - 2026-10-16
- Changed:
  - Firestore rules moved out of the README into firebase/firestore.rules (the only copy) with 13 emulator tests
    (firebase/test/rules.test.mjs; `cd firebase && npm ci && npm test`; CI job `rules` on every push). Friends are found
    by code only: users/ and codes/ can't be listed (the old `allow read` let any signed-in player download everyone's
    page and place), a page is readable by its owner and the friends on the owner's own list, only the receiver accepts
    a request (the old rules let a sender accept their own), writes are checked for shape and size.
  - friends.js: a friend's page that isn't shared back yet is retried every minute (no error); friend pages and request
    names are cleaned before drawing (frClean).
  - Names: cleanName() strips < > " & ` and control characters where names enter (nickname box, cleanLook, migrate), so
    the ~60 templates that put N(m) into HTML unescaped are safe. tools/check-data-text.py (CI) guards game data text.
  - saveVersion (core.js SAVE_VERSION = 1): saves without it are refused with "This save is from an older version of
    the game and can't be loaded in this one", a new game starts, the old save is kept aside in the browser
    (`<key>-set-aside`, `-cloud-set-aside`). A newer save is never written over (SAVE_HOLD). Backups from other versions
    are refused. Account saves carry saveVersion.
  - docs/SECURITY.md: the review (claims, rules, API key, App Check, Studio token options, innerHTML table, phase 18
    data design, one friends bug found).
- Risky or unfinished:
  - The new rules are NOT live until the owner publishes them (Firebase console). The game works with old and new rules.
  - Old account saves are replaced on the account once the player plays on in this version (a copy stays in that
    browser). That is a cloud-data wipe in slow motion: owner to confirm (question below).
  - phase-01-done and phase-02-done tags: this session can't push tags (the push is refused); the owner adds them.
  - Friends: making friends again "the other way round" after a removal fails (pre-existing, not security; SECURITY.md).
- Verified (what ran, what passed):
  - Rules tests: 13/13 on the new rules; 8 of 13 fail on the old README rules (the tests catch what was open).
  - Headless probes on the real page: cleanName/frClean/migrate strip markup and keep apostrophes; no save, an old save,
    a current save and a newer save each start, keep aside, load or hold as intended, with the message showing.
  - check-globals: 0 duplicates. check-data-text: clean. `--smoke`: 13/13 (114 s). Full check: not run for phase 02 (owner: run it once at the end of phase 03).
- Decisions I made (and why): rules live in firebase/ (testable, one copy) and the README points there; names are
  cleaned at the way in rather than escaping 60 templates now (phase 06 replaces the rendering); saveVersion is a save
  FORMAT number (1), not the game version: it should only change when old saves can't be read, which is rarer than
  releases (phase 03 reads it from the version file next to the game version); a newer save is held, never overwritten.
- Questions waiting for the owner: OK that an old account save is replaced once the player plays on (or keep it under
  another document)? Studio sign-in: apply options A (fine-grained token for this repo) and B (session-only by
  default)? Publish the rules and restrict the API key (steps in SECURITY.md)? Tag phase-01-done (8b03829) and
  phase-02-done.
- Next session starts with: phase 03 (first reply: claims, KEEP / REWRITE / DELETE list, version scheme and name).

### Phase 01 - Baseline and bug fixes - 2026-10-16
- Changed:
  - Game: two duplicate globals removed. `camTo` (scene.js) keeps the first copy, the one that honours reduced motion (`RM`); the later copy won before and ignored it, so with Motion = reduced the camera now snaps instead of gliding. `dioTileHalf` (diorama.js) keeps the later copy (`dioTileScale(t,2)`, same result); nothing calls it, so the function goes on the phase 03 delete list.
  - tools/ is in the repo (113 files, unchanged from the alpha 0.5 project zip, scanned for secrets first). New: tools/check-globals.py (duplicate global names across each app's script load order, also run by CI), tools/requirements-check.txt.
  - tools/check-quick.py: the six stale tests fixed, one cause per commit, none was a game bug (v31 settings tabs read from SET_TABS and waiting messages cleared; v32 wear measured with dglLookOf2, the per-frame look cache hid the dial; v42 skips `test: true` scenes such as the Graphics gallery; v46 no longer expects a room for the retired train station; postcards step marks Blake's first battle as played, the pcFree gate; v39/v40 v36 save migration skipped unless --legacy-saves). New `--smoke` (data and code checks, Start-Game on a phone ending with a debug log export, the Studio opening in GitHub mode). Every run ends with the total time and the 10 slowest steps (also `slowest` in results.json).
  - .gitignore; .github/workflows/check.yml: smoke on every push and pull request (incl. the Studio's "Save to game" PRs), the full check nightly, by hand and on `phase-*` tags; validation/quick/ uploaded as an artifact every run; pip and Chromium cached.
- Risky or unfinished:
  - The full check has not run end to end since the fixes (stopped by agreement; each fixed step passed on its own). The first full run is the GitHub one: nightly or by hand works only once the workflow is on main.
  - Picture differences are notes, never failures, until phase 03 makes a baseline on the CI runner. There is no baseline in CI yet, so nothing is compared.
  - start-game.py and start-studio.py are not in the repo, so `--studio` (the Studio round trip) can't run here or in CI; smoke only checks that the Studio opens.
  - tools/ and docs/ are public on the Pages site (the repo root is served).
- Verified (what ran, what passed):
  - Targeted run of the six old failures (`--steps=v31,v32,v39,v42,v46,postcards`): all pass. v31's place card and map camera checks, which never ran in phase 00, pass too.
  - `--smoke`: 13 of 13 steps pass in 111 s here (phone flow 97 s of it). On GitHub the first smoke job passed in 3 min 46 s including setup (before caching).
  - check-globals.py: finds camTo and dioTileHalf on the pre-fix code, none now (a false hit on paint.js's worker source text is skipped).
  - Game and Studio load headless to their title / sign-in screens; the only error is the container's ERR_TUNNEL_CONNECTION_FAILED.
  - Slowest steps (phase 00 full run, owner's zip): Scenes 606 s, v33 226 s, v44 180 s, Phone 135 s, Time/weather/rooms 92 s, v38 92 s, v32 91 s, v47 81 s, Things to do 76 s, v34 74 s. Here: v32 130 s, phone 97 s.
  - Walking camera, Hedgerow Lane -> Sundown: reproduced as a delay, not a failure. S.route.node switches on the crossing; the view stays `w:hedgerow*` for about 80 frames (48 s at about 2 fps in software), then becomes `w:sundown*`. The view is swapped only once the next one is prepared a slice per frame, so phase 00's test most likely gave up first. At 60 fps that is about 1.3 s.
- Decisions I made (and why): CI runs smoke per push, not the 39-minute full check (owner agreed). Pictures out of git and out of LFS: generate the baseline on the CI runner and keep it as an artifact or release asset (renderer-specific; Pages can't serve LFS files). The legacy migration check is skipped, not deleted, so phase 03 owns the deletion. The debug log is exported from the phone page in smoke (how the owner uses it; 134 s -> 111 s).
- Proposals waiting for approval:
  - Repo layout (task 5): tools/ stays in git as normal files; validation/ pictures stay out (CI artifact / release asset `baseline-<version>`); gamedata.js and sundown.png stay in git until the phase 04 data split; no LFS. Later (phase 04, ask first): deploy Pages from an Actions build of game/ and studio/ only, so tools/ and docs/ stop being public.
  - Claude Code hooks (task 6): after an Edit/Write of a .js file run tools/check-globals.py (seconds); at the end of a turn that changed .js or data run `--smoke` (about 2 min). No auto-formatter until phase 04: CLAUDE.md wants reformatting in separate no-op commits.
- Questions waiting for the owner: tag 406ad30 as `phase-00-done` too? Upload start-game.py and start-studio.py for the Studio round trip in CI? Do you see a pause on your phone walking from Hedgerow Lane into Sundown? Approve the two proposals above? Phase order: do the Firestore rules first, then 03, then the rest of 02 (my suggestion), or keep 02 then 03?
- Next session starts with: phase 02 (or 03, see the question above). The phase 03 delete list already has: dioTileHalf, the `station` prop, migrate() and the v36/v38 migration checks.

### Phase 00 - Finish current work - 2026-10-16
- Changed: nothing in the game. Added the fresh-base brief (CLAUDE.md, docs/). Tagged `Baseline` (capital B, as published on GitHub) on commit 718320c: alpha 0.5 (d6b8441) plus the brief.
- Baseline contains: alpha 0.5. Since alpha 0.4.1: new look (glass panels, portrait in the top bar), Bag tab, battle restyle, wide side panel, Graphics gallery, friends, postcard and walking fixes, the tap tracer (?tapdebug=1), quieter sign-in failure.
- Repo vs project: the repo holds game/, studio/, README.md and ART-NOTES.md only. tools/ (115 files, incl. check-quick.py), retired/, the Start-Game/Start-Studio scripts, start-game.py, start-studio.py, STYLE-GUIDE.md and validation/ live only in the owner's project zip. game/, studio/ and README.md in the zip are identical to the repo. Where they should live is a phase 01 decision.
- Verified: `python3 tools/check-quick.py` on the owner's alpha 0.5 project zip, against the owner's validation/quick-baseline (110 pictures). Headless Chromium 141, software WebGL, Playwright 1.56. 2355 s (39 min), 47 steps: 41 passed, 6 failed.
  - Stale test: v31 settings tabs. The test clicks game, look, sound, controls, save, help; 0.5 has sound, graphics, game, save, help. The place card and map camera checks after it did not run.
  - Stale test, or delete the model: v46 "kinds without a room: station". The building list still names `station`; alpha 0.4 replaced train stations with airship masts and no scene places one.
  - Stale test, probably: alpha 0.4 postcards. 0.5 added pcFree() (no postcard until the opening, story, unmet rival and trainer intros are done, plus 3 s of calm walking); the test drops the player in Marigold Town without meeting Blake. Confirm which gate held it.
  - Legacy, delete in phase 03: v39/v40 "v36 save migration" returns an empty save.
  - Not diagnosed: v32 "Wear and tear at 0 still leaves wear" (world.wear = 0 no longer zeroes building wear).
  - Not diagnosed: v42 "wild growth: gallery: not grown" (most likely the 0.5 Graphics gallery scene is outdoor but not wild-grown; exclude it or grow it).
  - Pictures: 50 of 110 differ from the baseline. Spot checks (phone-team, env-day, battle-3d) show the baseline predates the 0.5 new look, so the differences are expected. The owner's last recorded run (2026-10-15) was a 2-step partial run.
  - Slowest steps: Scenes 606 s, v33 226 s, v44 180 s, Phone 135 s, Time/weather/rooms 92 s, v38 92 s, v32 91 s, v47 81 s, Things to do 76 s, v34 74 s.
  - Separately, game and Studio load headless to their title screens. Only error: ERR_TUNNEL_CONNECTION_FAILED (the test machine's network).
- Unfinished list (parked, not dropped):
  1. The six failures above (four stale tests or legacy, two to diagnose).
  2. Regenerate validation/quick-baseline from alpha 0.5 so picture comparisons mean something again.
  3. Walking camera: the owner's walk-crossing-test.log shows Hedgerow Lane -> Sundown crossed but "the view followed: False" (held for w:sundown*). Reproduce.
- Decisions I made (and why): kept the check's WebGL run rather than Lite mode, because the baseline and the phone both use WebGL; Lite mode is proposed for the phase 01 `--smoke` set. Did not commit tools/ or validation/ (about 50 MB with pictures) because repo layout and Git LFS are the owner's call in phase 01.
- Owner decided: regenerate the picture baseline at phase 03, not now. Still open: how tools/ and validation/ should live in the repo (phase 01).
- Next session starts with: phase 01. Fix the stale tests first so the check is green, then --smoke (Lite mode for the flows), CI, .gitignore, duplicate functions.

---

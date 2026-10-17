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
  - Full quick check on the final code: NOT run end to end. It was stopped after 16 steps (all passed), inside
    Scenes. Run it once before tagging.
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

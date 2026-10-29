# Phase 03 audit notes (prepared 2026-10-16, at the end of the phase 02 session)

Read-only audits made for phase 03's first reply, so the phase 03 session doesn't search the code again. They are
findings, not decisions: the KEEP / REWRITE / DELETE list, the version scheme and the game name are the owner's call.
Line numbers are from commit 70ce345 and move as soon as code changes. Spot-check a finding before acting on it.

## 1. Version and name

### Where a version is stored or reported (nothing shows one to the player)
- game/sw.js:3 `const V='pocketbillies-alpha-0.5'`: the cache name. Caches not starting with V are deleted on activate.
- game/js/log.js:8 `NW_BUILD='alpha-0.5'`. The debug log header (log.js:88) is `{game:'Pocket Billies', kind:'debug-log',
  format:1, build:NW_BUILD, dataVersion:GD.meta.version, artVersion:GD.meta.artVersion, ...}`. The file name is
  `pocket-billies-debug-YYYYMMDD-HHMM.json`.
- game/js/selftest.js:268: the diagnostics report, with the same `build:NW_BUILD`.
- Saves (core.js): `v:4` (old field) and `saveVersion` (`SAVE_VERSION=1`, phase 02). Account saves write
  `saveVersion` and `game:'Pocket Billies'`. The export (profile.js:9) is `{game:'Pocket Billies', format:1, save:S}`.
- gamedata.js meta: `"title": "Pocket Billies"`, `"version": 10`, `"dataVersion": 1`. artVersion is bumped by the Studio
  and read in boot.js:7 (localStorage `networth-artv`).
- README.md:1 `# Pocket Billies: Gotta tax 'em all! — alpha 0.5`. Lines 3-21 are an intro listing old versions.
- Studio help text mentions v45/v46/v47 (engine/settings.js ~29-31, studio/js/scenes.js:57 "Open its v45 layout").
  gamedata.js has 49 `"v46": 46` keys.
- Historic `/* vNN: */` comments: hundreds (diorama-gl.js 161 lines, check-quick.py 94, diorama.js 73, ...). Leave them,
  or strip them in no-op commits.
- No test asserts a version string.

### Names
- "Pocket Billies" is already the only player-facing name (index.html, manifest, title.js:17, battle.js:159, story.js,
  share titles in log.js and selftest.js, the Studio). check-quick.py:1579-1580 asserts the title, the title screen's
  POCKET / BILLIES and `GD.meta.title`.
- "Net Worth" is left in: profile.js:31 (a backup import accepts `game:'Net Worth'`, legacy), README:3-5, ART-NOTES:16,
  and CSS and build-script comments.
- Internal ids (rename in phase 05, but the storage keys matter now): `networth-save-v1` (+ `-u-<id>`, `-set-aside`,
  `-cloud-set-aside`), `networth-artv`, `nw-opening-done`, `pb-account`, `pb-offer-guest`, `pb-studio-gh-token`,
  `studio-fold`, the BroadcastChannel `networth-studio`, the window name `networth-game`, the env var
  `NETWORTH_STUDIO_PORT`. Global counts: NWLOG 259, NW_TEST 18, NW_ART 10, NW_ARTIFACT 9, NW_LINK 5, NW_BUILD 4.

### One version file: suggested mechanism (no build step)
- `game/version.js` sets `self.PB_VERSION = '0.1.0 alpha'` (`self`, so a worker can read it too). It is the first
  `<script>` in game/index.html and is loaded by studio/index.html as `../game/version.js` (the Studio already loads
  game files that way). sw.js does `importScripts('version.js')` and names its cache from it. A changed imported script
  updates the worker.
- log.js and selftest.js use it as `build`. Saves keep `SAVE_VERSION` as a separate format number (it changes only
  when old saves can't be read) and may also record the game version.
- README and CHANGELOG can't read a file: add a check-quick step that compares them with version.js.
- build-artifact.py inlines every script, so it picks the file up. check-globals.py follows the script tags.

### Changelog
There is no CHANGELOG file. README.md has 2356 lines; lines 103-2262 are the old changelog (alpha 0.5 down to v7),
followed by "Project layout" (2263-2335) and "Notes and limits" (2336-2356).

## 2. Step tracking and Lite mode

### The finding that changes the plan
**Joystick walking is a step source.** diorama.js:639: in walk mode, every metre walked adds 14.1 to `P.stepAcc`, and
every 300 it calls `addSteps(n, true)`. `addSteps` (core.js ~182-195) is the hub for money, wild encounters (the only
`spawn()` source apart from the starter, debug and tests), egg hatching, jobs, buddy XP and the step dailies. So
"delete step tracking" in phase 03 would also remove income, encounters and hatching from joystick walking, and
phase 08 is where the owner decides what replaces each one.

**Suggestion:** phase 03 deletes only the real-world parts: the pedometer, the "Demo +N steps" buttons and the step
counters in the UI. It keeps the internal "distance walked" pipeline that joystick walking feeds until phase 08
replaces each mechanic. Ask the owner.

### Real-world machinery (deletable in phase 03)
- Pedometer: ui.js ~476-488 (`mot`, `onMotion` on devicemotion, `toggleMotion` with the iOS permission and timers,
  `stopMotion`), `U.walking`, `U.motionMsg`. Actions `'motion'` and `'test'` (`addSteps(+d.n)`, ui.js ~504-508).
  `stopMotion` is also called from ui.js:467, debug.js:77 and profile.js:31.
- `RULES.travel = 'steps'` (legacy: real steps move you along roads) vs `'walk'` (the default): `walkMode()` and
  `traveling()` at core.js ~152-156, plus `tripTo`/`setTrip`/`stopTrip`/`gateMsg`, `tripLeft`/`tripStatus`/`stepsTo`
  (ui.js ~94-107), the 'turnback' action, `mePos` (map.js:18), `onStepsAdded` (map.js:89), owmon.js:92.

### Mechanics fed by steps (phase 08 decides the replacements)
- Money: `S.se += taxed(...)` with the daily brackets `BR` (8k / 15k steps; core.js ~136-140, `rollDay`).
- Encounters: `S.meter` up to `encounterEverySE`, then `spawn()`.
- Eggs: `e.prog` up to `EGGS[tier].need`. Jobs: `j.acc` with `JOB_STEPS`. Buddy XP: `buddyRem`, `buddyStepsPerXp`;
  `bsteps`/`psteps` feed `splitPath` and the 'buddy' evolution kind (no data uses `k:'buddy'`; 3 lines use `split`).
- Dailies: challenge `k:'steps'` and the "letter walk" request (extras.js ~18-62). Rest stop: `RULES.steps.restCost`.
  Airship fares are money, which today comes from steps.
- Game data: `rules.steps` {stepsPerKm, brackets, encounterEverySE, maxEncounters, goldOdds, restCost, alphaOdds},
  `rules.progression.buddyStepsPerXp`, `rules.jobs.stepsPerPay`, `rules.travel`, `eggs` (3 tiers with `need`),
  `links` (56, `[a,b,cost,…]`), `route` (49 nodes, 43 with `cost`), trainer `egg` drops, and lore and tips that mention
  steps. **The 67 `"steps"` keys inside `scenes` are terrain step grids (cliffs, stairs): keep them.**
- Studio: world.js (brackets, steps per km, steps to hatch, link km), sections.js:41,227, check.js:33.

### Couplings that must survive
1. `linkCost` is also road length (world.js `wrRoadLen`: 40 m per 500 cost) and path weight (`routeDists`, core.js
   ~164, used by the gold arrows and the map). Keep it as a distance.
2. `RULES.steps.goldOdds`, `alphaOdds` and `maxEncounters` are used by battles, spawning, owmon, the UI and the save
   check. Move them out of `steps`; don't delete them.
3. The backup check `validSave` (profile.js ~20-27) requires `day.steps`, `totalSteps`, `seFrac`, `buddyRem`, `meter`
   and `route.prog`. Removing those fields breaks every restore unless it changes too.
4. Airship fares and rest stops need a money source once steps stop paying.

### Step UI
- The 'walk' tab is the main world screen: keep it. Inside, `renderWalk` (ui.js ~144-155) shows steps today, the
  bracket bars, the motion button, "Demo +500 / +2,000 steps" and "next one in N steps". There is also a "+500 steps"
  footer button and the `.wh-steps` counter (ui.js ~130,143).
- Cards: hereCard, eggSlots, buddyCard, exitPrompt, mapCardHTML, jobSlots, hireFlow, evoMethod, bag eggs.
- Trainer card (ui.js ~408-413): steps today, total, distance, buddy km. Also profile.js:77, account.js:35 (the merge
  prompt) and profile.js:20,31 (restore).
- Debug: `'st1'`, `'st10'` (debug.js:15,41), plus `'newday'`, `'hatch'`, `'fillq'`.
- Text: the startGame egg text, boot tips, Gini's "Every step counts" (cutscene.js:164, story.js:87), talk.js:34-35,
  profile.js:79, battle.js:371, i18n.js:57,85-86, airship.js:17.

### Tests touching steps
- check-quick.py: `play()` (~478-484) calls `addSteps(2400)` and then sets `RULES.travel='steps'`, so every browser
  step after it runs in the legacy steps mode (also line ~1860).
- Steps that travel by `addSteps`: "Walking: tap to walk, then a trip along two roads" (~657), v36 split evolution
  (~1074, bsteps), v37 party steps (~1107), "v43: the seamless world" (~1290), "alpha 0.4: Copperleaf … Route 1"
  (~1702), "alpha 0.4.1: walk the world yourself" (~1828-1860). The seamless-road and Route 1 checks need rewriting to
  walk across edges (`walkCross`).
- check-game.py:111,164 use the same patterns.
- selftest.js: "Road: Marigold Town to Tallgrass Meadow on the ground" (~124-129) uses `setTrip` + `addSteps` without
  setting `RULES.travel='steps'`; in walk mode `addSteps` doesn't move the route. **It may already be failing: check
  the in-game full test.**

### Lite mode
- On when `S.preferences.effects==='lite'` (Settings → Graphics → "Battery saver", profile.js ~72-84), and forced when
  WebGL fails (`EGL.fail`, `eglOK()`). **That fallback matters: without Lite, a phone without WebGL2 gets no game.**
- What it changes:
  - Walking uses the 2D canvas painter in diorama.js (`DIO.lite`) with 16 px tiles from art/scene/tiles.
  - Battles use the painted classic stage.
  - There is no 3D map.
  - The intro is pictures instead of the cutscene.
  - It drops moods, the ring, outlines, weather and the lore glint.
  - It sets `data-fx=lite` on the page.
- Art only Lite needs: art/scene/tiles (1.9M, also used by the Studio tile editor), probably art/next/tiles (1.9M). The
  painted battle stage (art/battle, art/background) is also the `battleStage:'classic'` preference, so it isn't
  Lite-only.
- Tests: none turn Lite on. Several use `battleStage='classic'`. selftest.js:171 has the "Lite shows the fall as
  pictures" fallback.
- Options for the owner: (a) remove Lite and show a clear "this phone can't run the game" screen when WebGL2 fails;
  (b) keep it as a fallback only (no setting), frozen; (c) keep it as is. Recommendation: (a). The new art targets
  (low-poly 32 px/m, the bowl map) can't be done in the 2D painter, so Lite would drift further from the game every
  phase.

### Legacy save code
- core.js `migrate()` fills in defaults and drops unknown ids. It is not a format converter: keep it, it is also the
  data-change safety net. No v36/v38 converters exist, only test names.
- trainer.js `lookFromOld` is **not** only for old saves: `cleanTrainer` and NPC looks (9 of 34 people have no `look`)
  depend on it. Rename it, don't delete it.
- tools/src/core.js has its own `addSteps` copy (used by build-art.cjs, the toolchain marked DELETE above).

## 3. Inventory: KEEP / REWRITE / DELETE suggestions

### Folders
| Folder | Size | Suggestion and evidence |
|---|---|---|
| game/art/next/tiles47 | 3.7M, 936 | KEEP: `scenery.tileSet:"tiles47"`; the check's Ground step reads it. |
| game/art/next/tiles | 1.9M, 456 | DELETE: v46 tiles, only a fallback in `dioTileFolder()` (diorama.js:46). |
| game/art/scene/tiles | 1.9M, 468 | DELETE with Lite mode / REWRITE: 16 px tiles used by Lite mode and the Studio tile editor; every terrain's `tile` still points here. |
| game/art/scene/props | 3.5M, 631 | KEEP: the 145 `*_vN` files are colour variants named in the data, not old versions. |
| game/art/background/sundown.png | 2.7M | DELETE: only sundown.webp is used (the README calls the png a source picture). |
| game/art (the rest), game/fonts | | KEEP. scene/build/detail-a04.png and the props `airship_mast`, `station` are unused. |
| game/css | 204K, 6 | REWRITE into one stylesheet (see Other baggage). |
| game/data/gamedata.js | 13.4M | REWRITE: split it (phase 04). |
| tools/retired | 832K, 19 | DELETE (retired/backup holds old world_v16/v23 pictures). |
| tools/src, export.js, build-art.cjs, runtime.cjs, vendor/tiny-inflate.js | 284K+ | DELETE: the v4 procedural toolchain; only build-artifact, build-trainer-art, v47-cleanup and export refer to it. |
| tools/trainer_gen | 84K | KEEP (build-trainer-art). |

### game/js
- KEEP: core, data, ui, boot, frame, art, battle, battle-gl, scene, rig, anim, trainer, dressing, the engine/ renderer,
  world, buildings, props3d, vox, structures, life, env, paint, cutscene, opening, title, story, talk, lore, sound,
  i18n, extras, fishing, owmon, shop, bag, postcards, airship, joystick, friends, account, account-config, gallery,
  log, debug, selftest.
- REWRITE: diorama.js (scene logic mixed with the Lite 2D painter); map.js + map-gl.js (map-gl uses 18 of map.js's
  definitions; merge them; the world map is rewritten in phase 10 anyway); profile.js (theme, artifact host, export
  and backups mixed together).
- DELETE candidates:
  - The Claude-artifact cloud mode: `initCloud`/`window.claude` in core.js, the window.claude download paths in log.js,
    profile.js and selftest.js, `NW_ARTIFACT` in ui, boot, profile and account, and tools/build-artifact.py. check-quick
    `--page` uses build-artifact.py, so remove that step with it.
  - tapdebug.js (URL-gated, no callers; the README documents `?tapdebug=1`: ask).
  - Legacy import: profile.js:31 `'Net Worth'`, and `lookFromOld` in trainer.js (see section 2).
  - The phase 01 list: dioTileHalf, the `station` prop, migrate()'s old-format leftovers, the v36/v38 migration checks.
- studio/js: all KEEP or REWRITE. roster.js (the v35 roster board), lore.js and viewport.js register themselves.

### tools/
- Used by CI or the check: check-globals.py, check-data-text.py, check-quick.py, requirements-check.txt.
  check-quick.py imports migrate-places.py (l.191), rename-places.py (l.204), fix-marigold-stream.py and fix-piers.py
  (l.275-276) and clear-windows.py (l.349), and runs build-artifact.py and prop-sheet.py. These can't be deleted
  without changing the check. check-game.py is the long manual play-test.
- Generators still meaningful: build-scene-props.py (`exec`s scene_props_v17/v24/v26/v27/v28.py, so those stay unless
  it is refactored), build-terrain-v47 (retired in SA-2a), build-tiles, build-scenes, build-test-scenes, build-interiors, build-buildings
  (+ -v46), build-vox-props, build-nature-props, build-prop-layers, build-flags, build-walls, build-map-minis,
  build-postcards, build-airship, build-world-relief, build-trainer-art, build-roster-sheets, build-starter-sheets,
  pixkit, build-palette, build-landmarks-v47, build-region-props-v47, build-props-a04, build-solarpunk, build-life-v47,
  build-fx-v47, build-furniture-v46, build-gallery, grow-wild, groundkeys, balance-report.
- One-off migrations (DELETE once their imports are untangled): add-icons-v9, build-v28 (imported by
  build-places-v46), build-places-v46 (imported by regions-v47), build-regions-v47 (imported by copperleaf and
  pearlantis), build-copperleaf, build-pearlantis, build-masts, build-lore-v47, build-story-v47, build-moods-v47,
  build-roster-data, build-loader-v47, build-landmarks-3d, build-prop-variants-v32, build-ui-icons-v26,
  build-starter-studies, build-battle-props, build-terrain (v46), build-scene-tiles, room-floors-v47, turn-buildings,
  expand-places, v47-cleanup, jrpgkit.

### Unused-art step: unreliable
validation/quick/unused.txt lists only detail-a04.png, `airship_mast` and `station`, but the step (check-quick.py
~404-435) has blind spots:
- It skips folders whose name contains "tiles".
- It counts a file as used if its stem appears anywhere (so sundown.png passes because of sundown.webp).
- It treats any folder the code builds paths into as fully used.
Fix it before trusting "nothing unused".

### Other baggage
- **gamedata.js:** `scenes` is 9.0M of 13.4M (110 scenes; heights 3.2M, steps 2.3M, props 1.6M, stepm 1.2M; "steps"
  here are terrain steps, not walking). 19 `*@v45` backup scenes take 1.16M: DELETE. 19 `test_*` scenes take 0.44M:
  move them to their own file. Pretty-printing adds about 4M.
- **CSS:** 6 files, all loaded (loader 6K, style 73K, battle 5K, polish 25K, screens 58K, v05 24K). They redefine the
  same selectors (style∩polish 67, style∩v05 41, screens∩v05 22, polish∩v05 18). REWRITE into one (phase 04 or 06).
- **README.md:** move about 2250 lines of changelog to docs/archive/LEGACY-CHANGELOG.md (phase 03 task 3).
- **Duplicates:** game/js/anim.js and tools/src/anim.js.

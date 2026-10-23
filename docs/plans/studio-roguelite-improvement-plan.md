# Studio roguelite improvement plan

Planning only (2026-10-22). Nothing in the Studio or the game was changed to write this. Reviewed at `main`
5a30303d (PR #130 merged), on branch `ccr-81011a25-lf3exv`, which was identical to `origin/main` when the review
started.

How to read it:
- Part 1 is the short version.
- Part 2 lists every finding with its evidence.
- Parts 4, 5 and 7 are what a coding session executes.
- Each ticket follows the house rules in CLAUDE.md:
  - Plan Mode first.
  - One cause per commit; renames on their own.
  - Unit tests, lint, typecheck, `check:modules` and `format:check` after each change.
  - `check-studio-github.py` for any Studio change; the full quick check at the end of a phase.
  - A HANDOFF entry.

Evidence tags used below:
- **[run]**: reproduced or measured by running code in this review.
- **[read]**: verified by reading the code at the cited lines.
- **[inf]**: inferred, not proven; the ticket that touches it must verify it first.

Line numbers are at 5a30303d and will drift.

---

## Part 1 - Executive assessment

### What the Studio does well
- **It is real, broad and used.**
  - 27 sections and 42 modules (~27.5k lines).
  - Art tools that match the art commitments: a shared pixel canvas, the Art workbench with Sheet and Part modes, a
    skeleton builder, a robot joint editor, coats, wardrobe, the hub island editor and mapgen previews.
- **It already reuses game logic.**
  - The pure modules in `game/js/logic/` (rng, mapgen, island, part-joints, rig-joints, robot-joints, story-checks,
    ui-theme, history) are loaded by the Studio page and unit-tested in Node.
  - This is the right foundation, and the plan below extends it rather than replacing it.
- **A safe publishing model.**
  - Publishing goes through a GitHub pull request: nothing reaches the game until the owner merges it, and CI runs
    `check:data` on the PR.
- **Unusually good self-measurement.**
  - The Studio self-test (`studio/js/studio-test.js`) opens every section, edits a field in each, undoes and redoes
    it, times everything and lists findings.
  - `tools/check-studio-github.py` drives a whole GitHub-mode session against a local stand-in for the API.
- **Deterministic run logic.**
  - The run map is a pure function of a seed and data tables (`logic/run-map.js`, `rngFrom(seed, salt)` streams).
  - A headless run simulator already runs real battles on real data (`tools/test/sim/run-sim.mjs`).
  - Building a Run Lab and a balance dashboard is mostly plumbing, not new game logic.

### What is fragile or incomplete
1. **Publishing can silently lose art and rig changes [run].**
   - After one failed "Propose changes", the retry opened a pull request with `meta.json` only. The PNG and both rig
     files were dropped.
   - The Studio then showed nothing unsaved.
   - Related problems:
     - A mid-save error can publish a partial pull request.
     - A proposal is built on the newest `main` while its file contents come from the version loaded earlier, so it
       can silently revert other people's merged work.
2. **No draft recovery.**
   - A closed tab, a crash or an expired token loses everything not yet proposed.
   - Signing out to fix an expired token says outright that unsaved changes "will be lost".
3. **Undo memory.**
   - Every data edit stores a full 2.7 MB JSON copy of the game data plus rigs (~5.4 MB in memory), up to 81 of them,
     counted as 0 bytes against the 64 MB cap.
   - The self-test reports "fullMB: 216". By the string encoding it is ~440 MB.
4. **The Studio cannot see the roguelite.**
   - The Studio loads none of the run logic (`run-map`, `run-state`, `run-loop`, `run-scenes`, `relics`, `effects`,
     `unlocks`).
   - It has no editor for `nodeTypes`, `relics`, `unlocks`, `currencies`, `buildings`, `rules.run` or
     `rules.ranch`, and its Check validates none of them.
   - Those checks exist only in the Node CLI `tools/check-data.mjs`.
5. **Two sources of truth for kit-built Billies.**
   - Part-mode metadata (z, turn limits, sides, S/L sizes, mirrors) is never read by the game.
   - Re-running `tools/build-kit-billies.py` overwrites the baked sheets and rigs that the Studio edits.

### How suitable it is for roguelite development today
- **Low.** It is a capable *RPG content and art* tool with a GitHub publish button.
- A designer cannot see a run, tune its structure, or measure a change's effect without editing JSON by hand,
  pushing a pull request and playing on a phone.
- The navigation still leads with Town shops and Jobs; both data files are `{}` and do nothing in the roguelite.
- Every redraw of a 3D section (Walk scenes, Engine, Hub island) makes a new WebGL context, and its cached meshes
  go stale (F18, F19).

### Most serious engineering risks, in order
1. Silent loss and silent reverts on publish (P0).
2. No crash or expiry recovery (P1).
3. Validation drift: the Studio Check, `check-data.mjs` and the game disagree. One example: a typo'd species id is a
   Studio warning, a CI error, and a silent stand-in in the game.
4. Four different "start a run" code paths: the game, the `run` fixture, the self-test and the simulator. They give
   different maps for the same seed.
5. Undo memory growth on long sessions.

### Most important missing workflows
1. See and reproduce a run from a seed, with the real generator and the draft data (Run Lab).
2. Change a run rule and see its effect on structure and outcomes before publishing (simulation compare).
3. Edit relics, unlocks and run rules with their constraints visible.
4. Swap a library part onto a Billie without hand-repairing frames, positions and bounds.

### Overall maturity
- **Art and RPG content:** "beta".
- **Data safety:** "alpha with a known data-loss bug".
- **Roguelite design:** "not started".

---

## Part 2 - Verified findings

### Verified defects

#### F1. A failed proposal drops art and rig changes from every later proposal - P0 [run]
**Evidence**
- `studio/js/studio-app.js` `saveAll` (296-345):
  - stages each art canvas, then `artDirty.clear()` (321);
  - stages rigs, then `rigsDirty = false` (327);
  - stages data, then `dirty = false` (335).
- In GitHub mode the wrapper (`studio/js/github.js` 378-439) runs this as `save0()`, *then* calls `proposeOnGithub`
  (346-376).
- On any error it restores only `studioState.dirty = true` (427).

**Reproduced** with a scratch Playwright script against the stand-in API:
- One art canvas, one rig and one data change were pending; the injected failure was a 502 on `git/refs`.
- After the failure: `{dirty: true, rigsDirty: false, art: []}`.
- The retry succeeded and its tree held only `game/data/meta.json`. `art/...png`, `art/rigs.js` and
  `art/next/rigs-next.js` were gone.
- After the retry the Studio showed no unsaved marker, and `beforeunload` (`studio-app.js` 664) no longer warns.
  Closing the tab loses the art for good.
- `meta.artVersion` is bumped (322) before the publish succeeds, so the published pull request says the art changed
  when no art was sent.

**Triggers in normal use**
- A network blip.
- An expired 90-day token (401).
- A missing pull-request permission (403/422).
- Two proposals in the same minute: the branch name is `studio/<login>-YYYYMMDDHHMM` (`github.js` 359-360), so the
  second gets "Reference already exists" after its blobs and commit were made.

**Impact.** Lost pixel work and rig edits, with the UI saying everything is fine.

**Why it matters here.** Art is the most expensive content in the game, and the owner works across phone and desktop
sessions.

**Approach.** T0.1.

#### F2. A mid-save error publishes a partial pull request - P0 [read]
**Evidence**
- `saveAll` catches its own errors and only toasts (340-342).
- The GitHub wrapper then sees a non-empty batch and proposes it (`github.js` 409-414).
- Example: `PB_DATA.split` throws on a bad or duplicated id (`game/js/data-files.js` 71-72).
  - Art and rigs are already staged and their flags cleared.
  - The data is not staged.
  - The PR is opened anyway, and the user sees "Save failed" *and* "Sent for approval".

**Approach.** T0.1: staging is all-or-nothing, and an error aborts the proposal.

#### F3. Proposals can silently revert work merged since the Studio loaded - P0/P1 [read]
**Evidence**
- `readGithubData` reads the files at `ref=main` (the branch name) at load (`github.js` 233-252).
- `changedDataFiles` compares against those texts (254-264).
- `proposeOnGithub` takes the *current* head of main as both `base_tree` and parent (349-365), and writes whole
  files.
- If another PR changed one of those files after the Studio loaded, the Studio's file still holds the old content,
  so the proposal reverts it.
- The PR diff does show it, but buried in a large JSON diff.
- The same applies to `rigs-next.js` (327 KB). The Studio gets `RIGS_NEXT` from the page's own `<script>`
  (`studio/index.html` 35, the deployed site), not from the branch. Any rig edit writes it back wholesale
  (`github.js` 307-320).
- Separately, the 145 data files are read 12 at a time by branch name. A merge landing during the read gives a mixed
  snapshot.

**Why it matters here.** Parallel coding sessions merge to main many times a day: PRs #122-#130 landed in one day.

**Approach.** T0.2: pin the commit the Studio loaded and use it as the parent, so Git reports a conflict instead of
silently reverting.

#### F4. An expired token cannot be fixed without losing work - P1 [read]
**Evidence**
- A 401 during a proposal is shown as "Couldn't send the changes: Bad credentials".
- The only route to a new token is Sign out, which says the changes "will be lost" and reloads (`github.js` 211-221).
- The token page suggests a 90-day expiry (`github.js` 133).

**Approach.** T0.3: sign in again in place and retry.

#### F5. No draft persistence at all - P1 [read]
**Evidence**
- `localStorage` is used only for layout, folds, the token and the self-test's last report (grep `studio/js`).
- `beforeunload` is the only guard.
- Mobile browsers and tab discards skip it.
- After F1 it is not even armed.

**Approach.** T1.1: local drafts in IndexedDB.

#### F6. Publishing is not guarded against double submit or edits during the send - P2 [read]
**Evidence**
- `save0`'s `finally` re-enables `#saveBtn` (343-344) before `proposeOnGithub` runs.
- A second Ctrl+S can start a second proposal while the first is sending.
- The first proposal's `finally` sets `githubMode.batch = null` (420), which can break the second midway.
- An art stroke made while `toBlob` is awaited (316-319) is cleared by `artDirty.clear()` without being sent.

**Approach.** Folded into T0.1: an operation lock and change counters.

#### F7. Data keys starting with `_` are stripped on every save - P3 [read]
**Evidence**
- Both the snapshot and `saveAll` drop keys whose name starts with `_` and has more than one character
  (`studio-app.js` 182-183, 333).
- The studio-track notes (ST-4) record that this deleted `_help` from partKits, portraits, robots and rules.
- No `_` key remains in `game/data` today, so the loss already happened.

**Approach.** Document it as a rule (runtime caches only) and add a `check-data` error for `_` keys in data files
(T1.6).

#### F8. Undo memory is unbounded in practice - P1 [run]
**Evidence**
- `snapshot()` (`studio-app.js` 182) stringifies `{D, rigs}`. Measured with Node on the real data: 2,702,323 chars
  (maps 1.91 M, scenery 0.20 M, rigs 0.33 M).
- 217 characters are above U+00FF, so V8 stores it as a two-byte string: ~5.4 MB.
- `HISTORY_STEPS = 80` (`game/js/logic/history.js` 40). `historyBytes` returns 0 for data steps (43-48), so the
  64 MB cap never applies to them.
- Art groups with a `snapshot` carry two full copies, also counted as 0.
- The self-test reports `snapMB 2.7`, `fullMB 216` (it counts 1 byte per char).
- Each commit costs 29-71 ms of stringify per edit (self-test `snapMs`), and the field handler's edits are debounced
  450 ms, so typing is fine.
- The slow cases are elsewhere: the self-test measured a Walk scenes edit at 973 ms, and wardrobe undo and redo at
  ~900 ms each.

**Approach.** T1.2.

#### F9. Studio, CLI and game validation disagree - P1 [read]
**Evidence**
- `studio/js/check.js` `runCheck` (44-496) has no checks for relics, unlocks, currencies, nodeTypes, buildings,
  robots, partKits, coats, portraits, meta, roster, `rules.run` or `rules.ranch`.
- `tools/check-data.mjs` checks most of these (225-657), inline in a Node CLI.
- Species ids drift:
  - check.js:57 treats any `/^[a-z]+\d+$/` id outside the current lines as "legacy" and only warns.
  - check-data.mjs:155-161 accepts only ids that exist in `legacy/lines` and fails CI.
  - The game stands in silently (`game-data.js` 245).
- Seam facing is implemented twice: check.js 424-450, and the shared `logic/seam-rules.js` used by check-data.
- Hard-coded enums repeat data:
  - relic `fx.stat` vs stats.json;
  - currency ids in three places;
  - the `rules.run` key list (check-data.mjs:331).
- Studio "errors" never block a proposal: "Save anyway" is one click (`studio-app.js` 302-312). CI then fails the PR
  on errors the Studio did not show.

**Approach.** T1.3, T1.4.

#### F10. The Studio's species preview animates differently from the game - P2 [read]
**Evidence**
- `studio/js/sprites.js` `rigFor` (156-191) re-implements `skeleton-rig.js` `rigParts` (500-540) without `clock` and
  `lag`.
- Studio previews animate at frame rate with no tail lag.
- The game uses `rigFrame` on a 12 fps clock (`skeleton-rig.js` ~401).

**Approach.** T5.6.

#### F11. "Replace from Parts Library" leaves the Billie inconsistent - P1 for the parts workflow [read]
**Evidence**: `studio/js/workbench-species.js` 485-898.
- It drops the bone's expression and squash frames (blink, happy, hurt) and only warns (786).
- It does not refit children to the new part's sockets: they keep their old `at`.
- It never recomputes `geo`: `skeletonFraming` (`studio/js/skeleton.js` 324) is called only by the skeleton
  builder. `geo` drives world sprite size, shadows and rings (`world-billies.js` ~131).
- It appends pixels below the sheet and never reclaims the old ones, so sheets only grow.
- It filters by slot only, through its own `slot()` mapping (487-493), because the slot vocabularies disagree: rules
  and lines use `sig`; partKits uses `signature`, `head-extra` and `body-extra`.

**Approach.** T5.2, T5.3, T5.4.

#### F12. Kit Billies have two sources of truth - P1 decision, P2 work [read]
**Evidence**
- `tools/build-kit-billies.py` bakes the 24 kit Billies' sheets and rigs from
  `tools/art-source/part-kit/builds.json`. It overwrites `rigs[form.rig]` and the sheet (555-582).
- It ignores Part-mode metadata. It hard-codes:
  - z (257-320);
  - mirroring with `FLIP_LEFT_RIGHT`;
  - `TAIL_AIM` and `ARM_OUT`.
- The game never reads `partKits.json`: only logic/sheet-slice, part-joints, rig-joints and robot-joints do (grep).
- Studio work on a baked sheet is wiped by the next rebuild, and Part-mode work never reaches the game.

**Approach.** A decision for the owner (Part 8, "Ask me before"), then T5.1.

#### F13. Four run starts disagree - P1 for Run Lab correctness [read]
**Evidence**
- Only `runTakeOff` (`game/js/run.js` 353-380) does all of these:
  - applies `runGive` (start items);
  - applies `runUnlocks` and `unlockOpen` (biome filtering);
  - heals;
  - stops the ranch.
- The `run` fixture (`game/js/fixture.js` 120-139, fixed seed `RL7FIXTURE`), the game self-test (`self-test.js`
  ~902) and the simulator (`run-sim.mjs`) each build a run their own way.
- So the same seed yields different biomes and shop stock. HANDOFF notes this at ~817.
- The simulator also re-implements page rules: the town heal path, the potion use, a catch-quality number and the
  boss team.

**Approach.** T2.1 extracts one `runStartPlan` that all four call. The Run Lab must not become a fifth.

#### F14. The self-test failed once on an undo in Rules - P2 [run, not reproduced alone]
**Evidence**
- A full headless self-test run (170 s) reported `passed: false`: "rules: an edit and its undo did not bring the
  data back" (`rules.start.se`).
- Edit, undo, redo, undo on the Rules section *alone* restores the data exactly.
- So the failure depends on what ran before it. Likely an earlier section writes to the data from a timer or a
  preview without a commit [inf].

**Approach.** T1.5.

#### F15. Game-side bugs found in passing (outside the Studio; reported, not planned here)
- `battle-stage.js` 1234 divides by `R.k2`, which `rigParts` never sets (its return at `skeleton-rig.js` 525-538 has
  only `k`). The ring radius is NaN, so the battle target ring likely never draws [read; on-screen effect inf].
- `nodeTypes.*.engine` is required by the schema but never read [read].
- `runOverdue` is never called by page code; tier and bracket are hard-coded to 1 (`run.js` 237, 298, 364) [read].
  These are already RL-13's.

#### F16. Second-pane edits run the left section's hook - P2 [read + run]
- `onField` calls `studioState.hooks[studioState.sec]` (`studio-app.js` 469), the *left* section.
- Renaming a move in the right pane does not update that pane's list. The same edit in the left pane does.
- **Approach:** T6.6. Find the field's pane, then use that pane's section.

#### F17. Type rename misses robots - P2 [read]
- `renameType` (`studio/js/data-editors.js` 1015-1032) updates types, moves, lines and `rules.battle`.
- It does not update robots.json's 15 `type` fields, although STUDIO.md says every use is updated.
- After a rename, the robots point to a type that no longer exists. check-data would then fail the PR.
- **Approach:** T6.6. Shared rename helpers in logic, with a test that walks every id field.

#### F18. Every redraw of a 3D section creates a new WebGL2 context - P2 [run]
- `ensureWalkGl` (`game/js/walk-view-gl.js` 217) builds a new context and recompiles every shader whenever the
  canvas element is new.
- A redraw replaces the canvas, and so does any of ~40 scene tool or prop actions, undo or redo.
- Nothing calls `loseContext`.
- 18 tool switches in Walk scenes made 20 contexts. After each, the preview took 11-20 s (software GL) to be ready.
- Browsers drop the oldest contexts at about 16. That is a crash risk on the owner's iPad [inf].

#### F19. Stale GPU objects after a 3D redraw - P2 [run]
- After a redraw, the console logs "bindVertexArray: object does not belong to this context".
- The stale objects are meshes cached by scene key but not by GL context:
  - `structureState.mesh` (`game/js/structures.js` 43, 542, 582, 609);
  - `solidPropState.meshes` (`game/js/solid-props.js` 86, 289, 1309, 1353).
- Buildings and solid props likely stop drawing in the Studio preview after a redraw [inf].
- These are game files, but the problem only shows in the Studio, where the canvas is replaced.

#### F20. `@lines.` path collision - P3 [read, latent]
- Two path rewriters claim the `@lines.` prefix:
  - data-editors.js (1171, 1207-1225) uses it for a shop keeper's lines;
  - lore-editor.js (55-75) also uses it, and wraps later, so it wins.
- Result: the shop field reads `D[<shopKey>]`, shows empty, and typing writes a new top-level key.
- Latent today because shops.json is `{}`.

#### F21. Smaller defects from the rendering audit [run unless noted]
- **Focus:** a `data-rr` select change redraws the pane and moves focus to `<body>`.
- **Lazy listener cleanup:** the pixel canvas removes its `document` listeners only on the next key or `studio-art`
  event after it is detached (pixel-canvas.js 122-129, 671-683; sprites.js 711). Until then each one keeps a detached
  canvas alive: +20 listeners after opening the pixel editor 5 times.
- **Sheet mode in the second pane:** it still finds its elements with `paneRoot()` in code that runs after loading
  (workbench.js 453, 487, 537, 554, 568). Known since ST-5.
- **Dead backups UI:** in GitHub mode, backups are an empty list and restore throws (github.js 297, 329), but the side
  footer still says "backups in backups/" [read].
- **Proxy rebuilds:** the `TYPE_COLORS` and `HIT_EFFECTS_BY_TYPE` stand-ins (`studio/js/game-stand-ins.js`) rebuild
  the whole object on every property read [read].

### Architectural risks (not bugs today)

#### A1. Rendering
**How it draws**
- A section is a function returning an HTML string. `renderPane` (`studio-app.js` 588-608) assigns it to the pane's
  `innerHTML`, then runs `studioState.after` and `mountPreviews` [read].
- Listeners are delegated on `document` (`studio-app.js` ~618-647 for `data-act`, `onField` for inputs), so section
  redraws do not leak handlers [read].
- The self-test's leak pass agrees: heap 33.5 → 33.5 MB, 326 → 327 nodes, no loops left running [run].
- The exception is the pixel canvas; see F21.
- `render()` is wrapped by layout.js (319) and connections.js (630), so **every redraw also rebuilds the second
  pane**, reapplies the layout and remounts the resize handles [read].

**Where the cost actually is** [run: self-test, headless]
- **Typing in a plain field does not redraw.** `onField` writes the value in place.
- **Buttons redraw the whole pane.** 306 `render();` calls across `studio/js`: data-editors 53, map-editor 36,
  prop-editor 26, workbench-part 21, world-rules-art 20 [read]. Every add, remove, toggle or matrix click rebuilds
  the section and its previews. Examples: Types' matchup cell `ACTIONS.mx`, data-editors 974-985.
- **Section hooks can be expensive.** They run on every `input` event without a debounce.
  - Walk scenes' hook (`map-editor.js` 1809-1818) clears `walkView.nav` and redraws the editor map on each input.
  - The self-test measured one Walk scenes edit at **973 ms**.
- **Undo and redo always re-render the whole section** (`restore`). Wardrobe undo and redo took **~900 ms** each.
- **Slow first opens.**
  - Types opens in **0.5-2.7 s** on first open and in 0.5 ms afterwards. A profile points to the cold icon cache:
    `iconURL` → `toDataURL` (`game/js/art.js` 166), once per FX icon per type.
  - Trainers takes 0.8 s on a cold first open.
  - Wardrobe opens in the second pane in **2.5 s**.
- **Data load.** In GitHub mode, 145 files are fetched 12 at a time: 7.7 s against the local stand-in. On real
  GitHub this depends on the network.
- **3D sections are frame-bound.** Hub island has 15 long tasks totalling 3.7 s; Engine has 2 long tasks totalling
  16 s; Walk scenes' p95 frame is 750 ms. These are software-rendered headless timings, so they show which sections
  to look at, not real frame times.

**Conclusion**
- The string-template pattern is not the problem for typing.
- The problems are four specific things: whole-pane redraws on actions, undebounced heavy hooks, whole-pane undo,
  and a few slow builders.
- None justifies a framework.

**Second audit [run]: Node Playwright with the stand-in, software GL.**
- **One keystroke:**
  - 2.6 ms normally.
  - **68 ms while the undo stack is empty.** `updateTopBar` (`studio-app.js` 292) calls `snapshot()` to decide
    whether Undo is enabled.
- **After the 450 ms debounce:**
  - snapshot 29-77 ms;
  - the whole `runCheck` 13 ms;
  - a ~2 MB BroadcastChannel post 10 ms, even with no game tab open.
- **Undo memory:** 30 edits grew the JS heap by 144 MB, about 4.8 MB per step, which confirms F8.
- **Largest DOMs:** Walk scenes 3,349 elements, Props 1,823, Billies 1,755.
- **No list virtualization anywhere.** It is not needed at today's sizes: 24 species, 121 moves, 450 props, 52 maps.
- **No global `error` or `unhandledrejection` handler** outside the self-test. `renderPane` has `try/finally` with no
  `catch`, so a section that throws leaves the old pane on screen with only a console error.
- The 3D defects are F18 and F19.

**Monkey-patching by load order** is the riskiest pattern.
- `render`, `readPath`/`writePath` (story-editor 75 → data-editors 1207 → lore-editor 55), `api`, `saveAll` and
  `toast` are swapped in `<script>` order.
- F20 is a latent bug that comes from it.

#### A2. Single global state and setter bridge
- `studioState` (`studio-app.js` 86-102) holds the whole data model.
- Modules share names through the generated `game/js/hooks.js` (317 names, `npm run check:modules`).
- This works and is checked, so it should not be replaced.
- New Studio subsystems (publish ledger, drafts, Run Lab) should live in their own modules with narrow interfaces,
  not add more names to `studioState`.

#### A3. Testing gaps for the Studio
- No unit test touches `github.js`, `saveAll` or `fetch`.
- `check-studio-github.py`:
  - is happy-path only: every POST gets 200 (1015-1026);
  - is not in CI (HANDOFF ~4186, still an open owner question).
- `check-quick.py --studio` is broken: it copies `start-studio.py`, which has never been in the repo (2271).
- Studio JS is not type-checked (0 of 42 files have `// @ts-check`; tsconfig includes `game/` only).
- `tools/*.mjs`, including check-data, is not linted.
- The unit-test tier is 618 tests in 80 s against a documented 30 s budget (docs/TESTING.md:13 is stale).

#### A4. Local mode is a ghost
- STUDIO.md and the boot error text (`studio-app.js` 711-713) tell people to run `start-studio.py`, which is not in
  the repository.
- GitHub mode is the only working save path.
- That raises F1-F3 from "one of two paths" to "the only path".

#### A5. Data that the Studio edits but the roguelite ignores
- `shops.json` and `jobs.json` are `{}`. "Town shops" and "Jobs" edit nothing that runs.
- Run shops come from `rules.run.shop`.
- Leader trainers' `reward` and absolute levels are replaced in runs (`run-loop.js` 119-151, `rules.run.foes`), but
  the Trainers editor shows them as if they applied.
- 213 of 250 pool entries and all 28 egg species are legacy ids that the game stands in for.
- Simulator balance numbers therefore measure stand-ins.

#### A6. The simulator is not trustworthy for economy work yet
- It has no relics, no unlock filtering, no backtracking and no keep-one rule.
- It uses a fixed greedy policy.
- Measured, 50 runs at defaults: 0 wins; losses at landing 31, town 11, route 7, mini-boss 1.
- It is useful as a regression detector, not as a balance oracle, until A5 and T3.3 are done.

### What the earlier review got wrong or overstated
- **"Ordinary edits cause full innerHTML redraws."**
  - Not for plain fields: `onField` (`studio-app.js` 448-470) writes the value in place and redraws only for fields
    marked `data-rr`, on `change`.
  - The real costs are listed under A1.
- **"saveAll stages content and clears flags before publishing."** True. But in local mode the flags are cleared only
  after each write succeeds, which is correct. The defect is GitHub mode only, and that is the only working mode.
- **"Undo snapshots are not counted."** True, and worse than stated: two-byte strings and art groups carry two
  copies.

---

## Part 3 - Target architecture

The aim is a few narrow modules beside today's code, not a rewrite. Arrows are "calls" or "reads".

```
 studio/index.html (sections, unchanged shell)
   │
   ├─ studio-app.js ── field helpers, render, undo UI
   │     │ changed(path)
   │     ▼
   ├─ studio/js/pending.js  (NEW) ── the pending-change ledger: data files, rigs, art, each with a change counter
   │     │                          + drafts.js (NEW): IndexedDB copy of the ledger, keyed by base commit
   │     ▼
   ├─ studio/js/publish.js (NEW, logic in game/js/logic/publish-plan.js) ── stage → send → confirm, resumable;
   │     clears only what the server confirmed; github.js becomes a transport (fetch wrapper + stand-in friendly)
   │
   ├─ game/js/logic/data-checks.js (NEW, pure) ── the validators moved out of tools/check-data.mjs
   │     used by: tools/check-data.mjs (CLI, CI) ── studio/js/check.js (Studio) ── unit tests
   │
   ├─ studio/js/run-lab.js (NEW section) ── seed → runStartPlan → runMapMake (main thread, pure, ~0.05 ms)
   │     │ heavier questions (foes, stock, pools, simulate)
   │     ▼
   └─ studio/js/logic-worker.js (NEW Web Worker) ── sets GAMEDATA = draft data, imports game-data.js + logic/*
         (the same modules Node's load-logic.mjs loads), answers: runPreview(seed), simulate(seeds, policy)
         one worker per draft version; a second worker on the base commit gives "before" for comparisons
```

### Editor modules
- Keep every existing section.
- Add a **Runs** group: Run Lab, Run rules, Relics, Unlocks & hub, Economy (read-mostly).
- Move Town shops and Jobs into the Legacy group.
- New editors reuse the field helpers (`numberField`, `selectField`, `card`) and the delegated `onField` handler.
- No framework and no schema-driven mega-form.

### Shared data model
- `studioState.D` stays the single in-memory model.
- What changes is change tracking: `changed(path)` already gets a path from `onField`. Map it to the `PB_DATA` file
  it belongs to (index.json `split`), and keep a counter per file.
- Callers that do not pass a path fall back to "compare all files", as today.

### Save and drafts
- The ledger is the only source of "unsaved".
- Publish stages from the ledger, sends, and clears an entry only if its counter did not move since staging and the
  server confirmed the commit.
- Every step is idempotent and resumable: a branch or commit made before a failure is reused.
- Drafts mirror the ledger to IndexedDB, with art as PNG blobs.

### Validation
- One pure module of checks, each returning `{lvl: 'error'|'warn', code, msg, path}`.
- CI fails on `error`. The Studio blocks publishing on the same `error` set and shows `warn` inline.
- The Studio's own "the game works around it" problems become `warn`, so one word means one thing everywhere.

### Game-logic integration
- Pure logic loads directly on the Studio page (as today).
- Logic that needs `GAMEDATA` (rules.js, run-loop.js, battle-engine) runs only in the worker, never next to the
  Studio's stand-ins (`studio/js/game-stand-ins.js`).
- The worker imports the same files the game imports. No copies.

### Run Lab and simulation
- Both call `runStartPlan` (T2.1) and the same `runSim` core.
- The CLI (`tools/test/sim/run-sim.mjs`) keeps working on top of the same core with a Node loader.

### Assets and rigs
- After the owner's decision, kit Billies come from a recipe baked by JS (`partFit` grown to cover what
  `build_view` does), with a parity test against the Python builder, which then retires (as `slice-part-kit.py` did).
- Rig checks join `data-checks.js`.

---

## Part 4 - Phased roadmap

Phases are ordered by risk, not by appeal. Phases 2, 4 and 5 can run in parallel once Phase 0 is merged; Phase 3
needs T2.1 and T2.4.

| Phase | Goal | Tickets | Sessions (est.) | Parallel with |
|---|---|---|---|---|
| 0 Reliability and data safety | No silent loss or revert on publish; regression tests that fail on today's code | T0.1-T0.4 | 2 | - |
| 1 Foundation and validation | Drafts, small undo, one validator, Studio tests in CI | T1.1-T1.6 | 3-4 | 2, 5 (after T1.3 for check work) |
| 2 Run Lab | See, inspect and reproduce a run from a seed with draft data; edit run rules beside it | T2.1-T2.6 | 3-4 | 1, 4, 5 |
| 3 Simulation and balance | Many seeds, metrics with uncertainty, before/after compare | T3.1-T3.5 | 3 | 4, 5 |
| 4 Roguelite content editors | Relics, unlocks/hub, leaders and economy views; navigation | T4.1-T4.5 | 3 | 3, 5 |
| 5 Parts and rigs | One source of truth for kit Billies; part swap that keeps the Billie whole | T5.1-T5.7 | 4-5 | 2, 3, 4 |
| 6 Performance, polish, docs | Measured bottlenecks; 3D view kept across redraws; small correctness fixes; docs | T6.1-T6.8 | 3-4 | after 1 (T6.6 any time) |

Every phase ends with the Studio working and publishing, the full quick check, a HANDOFF entry and a tag
`sr-N-done` (the owner pushes tags).

---

## Part 5 - Implementation tickets

Effort uses the repo's own unit, one Claude working session: S ≤ ½ session, M ≈ 1, L ≈ 2, XL ≥ 3. Every ticket's
"automated tests" also means the standard set: unit tests, lint, typecheck, `check:modules`, `format:check`, and
`check-studio-github.py` when Studio files change.

### Phase 0 - Reliability and data safety

#### T0.1 Publish never drops pending changes (the pending ledger)
- **Priority:** P0.
- **Problem:** F1, F2, F6.
- **Approach**
  1. New pure module `game/js/logic/publish-plan.js` (in `logic/` so Node tests it; no DOM):
     - **Ledger shape:**
       - `{ data: Map<filePath, rev>, rigs: rev|0, art: Map<artPath, rev> }`, plus a monotonically increasing `rev`.
       - `ledgerMark(L, kind, key)` bumps it.
       - `ledgerStage(L)` returns a frozen list `[{kind, key, rev}]`.
       - `ledgerConfirm(L, staged)` removes an entry only if its `rev` still equals the staged `rev`.
     - **Publish plan:** `planPublish(staged, readers)` returns the file list or throws as a whole. It never returns
       a partial plan.
  2. `studio-app.js`:
     - `changed(rigs)`, `markArt` and `restore` call `ledgerMark`; the boolean flags become getters over the ledger,
       so existing readers keep working.
     - `artVersion` is bumped inside the plan (only when art is in it), not in `D` before success.
  3. `github.js`:
     - The wrapper stages, builds the whole batch (any error aborts with nothing sent), sends, and on success calls
       `ledgerConfirm`. On failure it changes nothing.
     - One lock covers the whole operation; `#saveBtn` stays disabled until it ends.
     - `save0`'s swallowed `catch` is removed from the GitHub path, so the wrapper sees the error.
  4. Local mode (`saveAll` without GitHub): same ledger; confirm per file after each successful POST.
- **Main files:** `game/js/logic/publish-plan.js` (new), `studio/js/studio-app.js`, `studio/js/github.js`,
  `studio/js/sprites.js` (`markArt`), `game/js/hooks.js` (regenerated).
- **Dependencies:** none.
- **Effort:** M, assuming the flag getters keep the ~15 readers of `dirty`/`rigsDirty`/`artDirty` unchanged.
- **Risk:** medium. This is the save path, so ship it behind tests that fail on today's code first.
- **Acceptance**
  - Any injected failure at blobs, trees, commits, refs or pulls leaves every pending entry pending.
  - The retry's tree contains all of them.
  - An error while building the batch sends nothing and says what failed.
  - An edit made during a send stays pending after the send succeeds.
  - A second Ctrl+S during a send does nothing.
  - `meta.artVersion` changes only in a proposal that carries art.
- **Automated tests**
  - `tools/test/publish-plan.test.mjs`: mark, stage, confirm with a moved rev; plan all-or-nothing; artVersion only
    with art.
  - `check-studio-github.py` gains a `publish_failures` step, built from the scratch repro used in this review:
    - a 502 on `refs`, then success, with the art and both rig files in the second tree;
    - a 401 on `pulls`, then retry;
    - a planted bad id in a split section, with no POST sent.
- **Manual:** none (the stand-in covers it).

#### T0.2 Pin the base commit; read and write against it
- **Priority:** P0/P1.
- **Problem:** F3.
- **Approach**
  1. At load, resolve `git/ref/heads/main` to a SHA once. Read `index.json`, every data file, `art/rigs.js` **and**
     `art/next/rigs-next.js` at `?ref=<sha>`. Stop merging the page's `window.RIGS_NEXT` in GitHub mode.
  2. `proposeOnGithub` uses the loaded SHA as parent and its tree as `base_tree`. Git then reports a merge conflict
     on the PR instead of silently reverting.
  3. Before sending, compare main's current SHA with the loaded one. If main moved, list the files that changed on
     main *and* are in this proposal (`compare` API), and ask: "These files changed on main since you opened the
     Studio: … Propose anyway (the PR will show conflicts) / Cancel". Files changed on main but not in the proposal
     need no warning.
  4. After a successful proposal, keep the base. `githubMode.data` stays the base texts, so proposals stay
     cumulative, as today; say so in the success dialog.
     - Optional, owner's call: "Continue from my proposal" re-bases the Studio on the PR branch.
- **Main files:** `studio/js/github.js`, `studio/js/studio-app.js` (boot reads rigs-next via api).
- **Dependencies:** T0.1, to land on top of the ledger without conflicts.
- **Effort:** M.
- **Risk:** medium. Reading rigs-next from the repository instead of the page changes the load path.
  `check-studio-github.py`'s stand-in must serve `contents/` at a SHA, which is a small stand-in change.
- **Acceptance**
  - Commit parent = the loaded SHA.
  - With main moved and a shared file changed, the dialog names it.
  - With main moved and nothing shared, no dialog.
  - Rigs come from the repository at the SHA.
- **Automated tests:** stand-in steps for "main moved, same file" and "main moved, other file"; a unit test for the
  file-overlap function (pure).
- **Manual:** one real proposal on GitHub against a branch with a deliberate conflict (owner).

#### T0.3 Resumable proposals and in-place re-sign-in
- **Priority:** P1.
- **Problem:** F1's triggers; F4.
- **Approach**
  - The branch name gets seconds and 4 random base32 characters.
  - The publish operation records `{branch, commitSha, prNumber}` as each step succeeds. A retry skips completed
    steps: a ref that exists with our commit means "go on to pulls".
  - On 401 or 403, the sign-in card opens as a modal *over* the Studio (reuse `githubLoginHTML`). After it, the same
    staged operation resumes.
  - Sign out with pending changes offers "Save a draft first" once T1.1 exists.
- **Main files:** `studio/js/github.js`.
- **Dependencies:** T0.1.
- **Effort:** S-M.
- **Risk:** low.
- **Acceptance**
  - A 422 "Reference already exists" for our own commit resumes.
  - A 401 shows sign-in, and after it the PR is created with every pending file.
  - No reload anywhere on these paths.
- **Automated tests:** stand-in: a 401 on blobs, then a fresh token, then success; refs 422 with the same SHA, then
  resume.
- **Manual:** sign in with an expired fine-grained token (owner, once).

#### T0.4 Document the publish model and its failure states
- **Priority:** P1.
- **Problem:** A4. Users need to know what "Propose" guarantees.
- **Approach**
  - STUDIO.md: a short "What Propose does / what happens on failure" section.
  - Remove the `start-studio.py` instructions from the boot error, or mark local mode "not in this repository"
    until the owner decides (ask).
- **Effort:** S. **Risk:** none.
- **Acceptance:** the docs match the behavior; the boot error names the GitHub route.
- **Tests:** none beyond lint.

### Phase 1 - Foundation and validation

#### T1.1 Local drafts (IndexedDB) with recovery on open
- **Priority:** P1.
- **Problem:** F5.
- **Approach**
  - `studio/js/drafts.js` mirrors the ledger 2 s after the last change:
    - the changed data files' text;
    - the rigs text, if pending;
    - each pending art PNG as a Blob;
    - the base SHA, the login and a time.
  - A draft is not a backup of the whole model; it stores pending files only, typically KBs.
  - On boot after data loads, if a draft exists:
    - same base SHA: offer "Restore your unsent changes (N files, time)".
    - different base SHA: offer restore with the T0.2 overlap warning.
  - The draft is deleted on confirmed publish, or by explicit discard.
  - `localStorage` is not used for data: 5 MB limit, strings only.
  - Never sent anywhere (SECURITY rule).
- **Main files:** `studio/js/drafts.js` (new), `studio/js/studio-app.js` (boot hook), `studio/index.html`,
  `hooks.js`.
- **Dependencies:** T0.1. T0.2 for the SHA.
- **Effort:** M.
- **Risk:** medium. IndexedDB can be unavailable (private mode): degrade to a warning banner.
- **Acceptance**
  - Kill the page with one data, one rig and one art change.
  - Reopen: one prompt; Restore brings all three back, pending again, and undo starts empty.
  - Discard removes it.
  - A restored draft proposes correctly.
- **Automated tests:**
  - A unit test for the draft record's (de)serialization as a pure function.
  - A stand-in step: edit, `page.close()`, new page, restore, propose, tree has all three.
- **Manual:** on an iPad/desktop browser, close the tab without saving, reopen.

#### T1.2 Undo stores changed files, not the whole model
- **Priority:** P1.
- **Problem:** F8.
- **Approach**
  - `snapshot()` becomes per file: a `Map<filePath, string>` built with `PB_DATA.split`'s layout (≈145 entries) plus
    `@rigs`.
  - `historyCommit` stores only entries whose text differs from `last`, as `{files: {path: [before, after]}}`.
  - `historyBytes` counts `2 × length` for strings.
  - Undo and redo replace only those sections in `D` (reassemble that file's section), and then `render()`.
  - CPU stays the same (one stringify per file). With `changed(path)` hints, only the hinted files are re-stringified
    and the full scan runs every Nth commit as a guard [inf: measure].
  - Keep `history.js`'s API shape so `pixel-canvas.js` art steps are untouched.
  - Art groups with a `snapshot` use the same file diff.
- **Main files:** `game/js/logic/history.js` (+ tests), `studio/js/studio-app.js` (`snapshot`, `commit`,
  `restore`), `studio/js/pixel-canvas.js` (group snapshot).
- **Dependencies:** none. It can go before or after T0.1 (separate files mostly; merge with care in
  `studio-app.js`).
- **Effort:** M.
- **Risk:** medium. The self-test's 18 edit/undo/redo checks guard it.
- **Acceptance**
  - The self-test's `fullMB` estimate for 80 steps of single-field edits is under 10 MB.
  - Every self-test edit comes back.
  - A map edit's undo restores only that map.
- **Automated tests:**
  - `history.test.mjs`: file diffs, byte accounting, trim by bytes for data steps, mixed art and data order.
  - The self-test.
- **Manual:** a long editing session; watch memory in DevTools.

#### T1.3 One validator module shared by CLI, Studio and tests
- **Priority:** P1.
- **Problem:** F9.
- **Approach**, in several commits, one cause each:
  1. Move check-data's run, relics, unlocks, currencies, buildings, nodeTypes and robots checks (225-603, 437-461)
     into `game/js/logic/data-checks.js` as pure functions of `D`. `check-data.mjs` calls them; its output stays
     byte-identical (snapshot test).
  2. The Studio Check calls the same functions (load the module on the Studio page).
  3. Unify the legacy-species rule on check-data's stricter version. The Studio passes the legacy line ids it
     already reads for the Legacy section.
  4. Replace the hard-coded enums with data:
     - relic `fx.stat` checked against stats.json in code, the schema enum removed;
     - currency ids from currencies.json;
     - the run keys list from a single exported constant.
  5. Move the Studio-only checks that CI lacks (scenes, roads) into the module too, so CI gains them.
- **Severity model:** `error` = CI fails = the Studio blocks Propose (with "Show me"); `warn` = shown, never blocks.
  - Today's Studio "errors the game works around" are reviewed one by one. Most become `warn`.
  - Ask the owner before turning any into a block.
- **Main files:** `tools/check-data.mjs`, `studio/js/check.js`, `game/js/logic/data-checks.js` (new),
  `game/data/schema/relics.schema.json`, `tools/test/data-checks.test.mjs` (new).
- **Dependencies:** none.
- **Effort:** L (two sessions: the move, then the Studio side and the severity review).
- **Risk:** medium. CI behavior must not loosen; the snapshot of check-data output guards it.
- **Acceptance**
  - `npm run check:data` gives the same result before and after the move.
  - The Studio Check lists relic, unlock, run and robot problems.
  - A planted pool typo is an error in both.
  - Propose is refused on an `error`.
- **Automated tests:** unit tests per check family with planted bad data; check-data output snapshot; a stand-in
  step where an error blocks Propose.
- **Manual:** none.

#### T1.4 Studio tests in CI, with failure paths
- **Priority:** P1.
- **Problem:** A3.
- **Approach**
  - Add `check-studio-github.py --only=sections,publish_failures,studio_test` to the CI `smoke` job (~2-3 min).
  - Fix or remove `check-quick.py --studio` (it needs a file that doesn't exist).
  - Ask the owner (HANDOFF lists this as open).
- **Effort:** S. **Risk:** CI time.
- **Acceptance:** CI runs it on PRs that touch `studio/` or `game/js/logic/`.

#### T1.5 Find the order-dependent undo failure
- **Priority:** P2.
- **Problem:** F14.
- **Approach**
  - Run the self-test with the probe logging every data write outside `changed()`: wrap `studioState.D` in a
    development-only Proxy, behind `?selftest`.
  - Find the writer and fix it (one cause per commit).
- **Effort:** S-M. **Risk:** low.
- **Acceptance:** three consecutive full self-test runs pass.

#### T1.6 Small hygiene
- **Priority:** P3. One commit each.
- **Changes**
  - `check-data` error for `_` keys in data files (F7).
  - TESTING.md's unit-tier numbers.
  - Lint `tools/*.mjs`.
- **Effort:** S.

### Phase 2 - Roguelite Run Lab

#### T2.1 One shared run start: `runStartPlan`
- **Priority:** P1.
- **Problem:** F13. A Run Lab built on today's code would be a fifth way to start a run.
- **Approach**
  - New pure function `runStartPlan(seed, data, {unlockState, mapOverride, mods, tier})` in `logic/run-state.js`, or
    a new `logic/run-start.js`.
  - It returns:
    - the map rules after `unlockOpen`;
    - start money and items (`runGive`);
    - the generated map (`runMapMake`, deadline, reveal, forecast).
  - `runTakeOff` calls it and keeps the side effects (heal, ranch stop, UI).
  - Then, each in its own commit: the `run` fixture, the game self-test and the simulator.
  - Changing the fixture changes its pictures (biomes now follow unlocks). Regenerate that baseline in its own
    commit.
- **Main files:** `game/js/logic/run-state.js`/`run-map.js`, `game/js/run.js`, `game/js/fixture.js`,
  `game/js/self-test.js`, `tools/test/sim/run-sim.mjs`.
- **Dependencies:** none.
- **Effort:** M.
- **Risk:** medium. This is game code; `run-map.test.mjs`'s snapshot and `run-world-real` guard it.
- **Acceptance:** for 200 seeds and a fixed unlock state, `runStartPlan` equals what `runTakeOff` installs.
- **Automated tests:** a new unit test comparing the plan with a recorded `runTakeOff` result; the existing run
  tests unchanged.
- **Manual:** play the run fixture once on the phone (owner).

#### T2.2 Run Lab v1: seed → map, on the Studio page
- **Priority:** P1.
- **Problem:** the missing workflow "see and reproduce a run".
- **Approach**
  - Load `logic/run-map.js` and `run-state.js` on the Studio page. They are pure: their imports are rng, weather and
    test-globals. Check load order with `check:modules`.
  - New section "Run Lab" (Runs group). Inputs:
    - seed (typed, 🎲, or pasted from a debug log);
    - unlock preset (none / all / the save's from a pasted debug export);
    - tier.
  - The map is drawn as SVG rows and lanes with node type icons, biome colours and links. That is cheap, and no
    WebGL context is needed.
  - Clicking a node shows its type, biome, weather by day, row role, deadline effect, and its node seed
    (`runNodeSeed`).
  - Draft data is used live. A "Base" toggle shows the same seed on the loaded commit's data, side by side.
  - Copy "seed + data version" for bug reports.
- **Main files:** `studio/js/run-lab.js` (new), `studio/index.html`, `studio/js/studio-app.js` (`SECTION_LIST`,
  groups), `hooks.js`.
- **Dependencies:** T2.1.
- **Effort:** M.
- **Risk:** low (read-only).
- **Acceptance**
  - Any seed shows the same map, node for node, as the game's debug menu run with the same seed and unlocks.
  - Editing `nodeTypes` weights redraws within 100 ms.
- **Automated tests**
  - A unit test that `runStartPlan` (used by the Lab) equals the game's for N seeds (shared with T2.1).
  - A stand-in step: open the Run Lab, type a seed, assert the node count and types against the Node result.
- **Manual:** compare one seed with the game's debug menu run on the phone.

#### T2.3 Map diagnostics and seed sweeps
- **Priority:** P2.
- **Problem:** "detect impossible or degenerate generation".
- **Approach**
  - Structural invariants as `data-checks` (reused by CLI and Studio), run on 1,000 seeds in the Lab (~50 ms):
    - every node reachable from the start;
    - every path reaches the last row;
    - rest rows are towns;
    - guard rows are mini-bosses;
    - the deadline is reachable;
    - `runMapRowsFit` (it exists in check-data).
  - Show distributions: node count, nodes by type, towns per path, biome mix.
  - Show the town:route ratio actually produced versus the weights (measured: towns 44,138 vs routes 40,798 over
    10,000 maps, against a 1:4 weight, because rest rows are forced towns).
  - Flag outliers with "open this seed".
- **Dependencies:** T2.2, T1.3.
- **Effort:** M. **Risk:** low.
- **Acceptance:** a planted bad rule (a guard row on the last row) shows an error with an example seed.
- **Automated tests:** invariant unit tests over 1,000 seeds in Node (under 1 s).

#### T2.4 Logic worker: the game's own logic on draft data
- **Priority:** P1 (Phase 3 needs it).
- **Problem:** `run-loop.js`, `rules.js` and the battle engine need `GAMEDATA`, and must not load beside the Studio's
  stand-ins.
- **Approach**
  - `studio/js/logic-worker.js` is a module worker. It receives the draft `D` (structured clone) and sets
    `globalThis.GAMEDATA`, then imports `game-data.js` and the logic modules in the order `tools/test/load-logic.mjs`
    uses.
  - It answers `{runPreview(seed, opts)}` with foes per node (`runFoes`), shop stock per day, wild tables per node
    and relic offer order.
  - A new worker per data version, created lazily and terminated on the next edit.
  - Start with a **spike**: list what in `game-data.js`, `rules.js` and `battle-engine.js` touches `window`,
    `document` or `localStorage`. The Node loader runs them in a `vm` context with given globals, so a worker should
    work [inf].
- **Main files:** `studio/js/logic-worker.js` (new), `studio/js/run-lab.js`.
- **Dependencies:** T2.2.
- **Effort:** M (+S spike).
- **Risk:** medium. Module workers are fine in desktop Chrome, Safari and Firefox; the owner's iPad must be checked.
- **Acceptance:** the Lab's node panel lists the same leaders and shop stock as the game for the same seed and day.
- **Automated tests:** a Node test that the worker's handler module (pure part) returns the same as direct calls; a
  stand-in step that opens the panel.

#### T2.5 Run rules editor beside the map
- **Priority:** P2.
- **Problem:** `rules.run.*` and `nodeTypes` have no editor.
- **Approach**
  - A card in the Run Lab with:
    - `map` (rows, minibosses, widths, biomes);
    - `clock`;
    - `reveal`;
    - `wild`;
    - `foes`;
    - `shop`;
    - `healCost`;
    - `payout`;
    - `nodeTypes` weights and names.
  - It uses the standard field helpers.
- **Why dedicated and not a generic form:** each change immediately redraws the map and the seed-sweep
  distributions (T2.3), which is the feedback a designer needs. A form elsewhere cannot show it.
  - Fields read in code but hard-coded (lanes = 2, the cross-link 0.5, `RUN_BUILDINGS`) are shown read-only with
    "in code: run-map.js:102". The rule against hidden magic numbers applies, but moving them into data is a
    separate game ticket.
- **Dependencies:** T2.2, T1.3.
- **Effort:** M. **Risk:** low.
- **Acceptance:** each field round-trips through Propose; invalid values show the `data-checks` message inline.

#### T2.6 "Play this seed" in the game
- **Priority:** P2.
- **Problem:** launch a generated run in a usable test environment.
- **Approach**
  - Game side, behind `?debug` only:
    - `?run=<seed>&tier=&unlocks=all|none&party=<species@lv,…>&relics=<ids>`;
    - it starts a fresh test save (like fixtures, never the player's save) through `runTakeOff`/`runStartPlan`.
  - Studio side:
    - "Play this seed" opens it;
    - extend `studioBroadcast` to carry `rules`, `nodeTypes`, `relics`, `unlocks`, `items` and `trainers`;
    - extend `boot.js studioLive` to apply them before the run starts.
  - Privacy: nothing from a save is sent; only Studio data travels, on the same-origin BroadcastChannel.
- **Main files:** `game/js/boot.js`, `game/js/fixture.js` or `run.js`, `studio/js/studio-app.js`
  (`studioBroadcast`).
- **Dependencies:** T2.1.
- **Effort:** M.
- **Risk:** medium. This is game boot code: no player path may change, so add a check-fast step.
- **Acceptance**
  - The seed, party and relics given are what the run shows.
  - An unsaved Studio change to `rules.run.healCost` shows in the town clinic.
- **Automated tests:** a check-fast step with `?run=TESTSEED&party=…` that asserts the run's map equals
  `runStartPlan`'s.
- **Manual:** on the phone (owner).

### Phase 3 - Simulation and balance

#### T3.1 Split the simulator core from its Node loader
- **Priority:** P1 (for Phase 3).
- **Problem:** `run-sim.mjs` imports `node:fs`, `node:path` and `setup-real.mjs` (`node:vm`).
- **Approach**
  - Move the body of `runSim` and `runStats` into `game/js/logic/run-sim.js`, which takes `{modules, fn, hooks,
    data}`.
  - The CLI and its test keep their output byte-identical (`run-sim.test.mjs` replays a seed).
  - The `Math.random` reseed stays in the host: the CLI or the worker.
- **Effort:** M. **Risk:** low with the determinism test.
- **Acceptance:** `validation/sim/runs.json` from the CLI is identical before and after for 50 fixed seeds.

#### T3.2 Remove simulator re-implementations
- **Priority:** P1.
- **Problem:** F13's second half.
- **Approach**
  - For each rule the sim re-implements (town heal, potion use, catch quality, boss team), extract the game's own
    rule into logic and call it from both sides.
  - One rule per commit, each with a unit test.
  - Where the game has no pure version (catch quality is a player's ring timing), keep it as an explicit **policy
    parameter**, named as such in the output.
- **Effort:** M-L. **Risk:** medium (game code).
- **Acceptance:** no constant in `run-sim.js` duplicates a game rule; every remaining number is a named policy
  setting.

#### T3.3 Close the simulator's gaps before trusting economy numbers
- **Priority:** P1.
- **Problem:** A6.
- **Approach**
  - Relic offers and picks: a greedy policy plus a "never pick" baseline.
  - Shop Loopholes.
  - `fx` in battles and payout.
  - Unlock filtering through `runStartPlan`.
  - `runEnd` keep-one.
  - A balance-only mode that skips `runScenesMake`. Measured: 433 ms of a ~440 ms run is scene generation; needs
    `worldPut` to tolerate absent maps [inf].
- **Effort:** L. **Risk:** medium.
- **Acceptance**
  - A seed's outcome equals the full mode's outcome when scenes do not matter (encounters read tables, not scenes;
    verify).
  - Balance mode runs at least 20× faster.

#### T3.4 Balance dashboard with before/after compare
- **Priority:** P2.
- **Approach**
  - A "Simulate" card in the Run Lab:
    - N seeds (default 200, from a fixed list so results are reproducible);
    - policy (greedy-forward / cautious / never-catch);
    - party preset;
    - unlock preset.
  - Two workers: **Base**, the loaded commit's data, and **Draft**. Both run the *same* seed list, so differences
    are paired and the noise is much smaller.
  - Metrics, from `runStats` plus:
    - win rate with a 95% Wilson interval;
    - loss by node type and row;
    - days and places;
    - money in versus out (payout, shop, heal);
    - catches;
    - relics taken;
    - foe win rates by leader.
  - Every table carries a banner: "Bot policy X: a lower bound on a careful player, not a prediction". Metrics that
    depend mostly on the policy (catch rate) are marked "policy-driven".
  - Results can be exported as JSON, and the CLI produces the same JSON with `--compare base.json`.
  - Determinism: seeds are listed, workers report their data hash, and a re-run must match exactly; the UI shows a
    hash.
- **Dependencies:** T2.4, T3.1-T3.3.
- **Effort:** L.
- **Risk:** medium (CPU on the iPad). Cap at 200 seeds in the browser; the CLI does more.
- **Acceptance:** changing `healCost` 60→120 shows a paired difference with intervals. Identical drafts show zero
  difference.
- **Automated tests:** Node test of the paired comparison and Wilson interval (pure); a stand-in step running 5
  seeds.
- **Manual:** the owner reads one compare and says whether it is understandable.

#### T3.5 Retire or fix `tools/balance-report.py`
- **Priority:** P3.
- **Problem:** it re-implements damage with STAB hard-coded to 1.5 instead of `rules.battle.stab`.
- **Approach:** replace it with a CLI mode of the shared sim, or delete it (owner).
- **Effort:** S.

### Phase 4 - Roguelite content editors

General rule: each editor must show something the JSON cannot, such as:
- an effect preview;
- a graph;
- a value that is overridden at runtime;
- a link to the Run Lab.

Otherwise the field goes into an existing generic card.

#### T4.1 Relics (Loopholes) editor
- **Priority:** P2.
- **Why dedicated**
  - Effects are typed rows (7 kinds) with limits that live in code (`effects.js` `FX_LIMIT 0.1-4`, `FX_STAGES 6`).
  - A row's meaning depends on its kind.
  - The useful preview is the effect on a sample build: `fxMult` and `fxRows` on a chosen Billie, with stats before
    and after, using the real logic (pure).
- **Approach**
  - A list with rarity and weight.
  - A row editor per kind.
  - Limits shown.
  - The rarity table coverage (check-data 525) shown inline.
  - "Offer order for seed" via the worker.
- **Dependencies:** T1.3, T2.4 (offer order only).
- **Effort:** M.
- **Acceptance:** every relic field round-trips; an out-of-limit factor is a `data-checks` error shown on the row.

#### T4.2 Unlocks, buildings and currencies: graph and editor
- **Priority:** P2.
- **Why dedicated**
  - `requires` and `when` form a dependency graph with cycle rules.
  - Grants touch shops and biomes, which must stay consistent with `rules.run` (check-data 553-603).
  - A graph shows reachability and order; a form cannot.
- **Approach**
  - An SVG graph: buildings by level, with unlock nodes and edges, and their currency.
  - Click a node to edit it.
  - "What does a new save have / after N runs" uses `unlockReady` and `unlockAuto` (pure).
- **Effort:** M-L.
- **Acceptance:** a planted cycle is refused with the path named; the graph matches `unlocks.test.mjs`'s
  expectations.

#### T4.3 Leaders and encounters: show the run's effective values
- **Priority:** P2.
- **Problem:** A5.
- **Approach**
  - In Trainers, for `miniboss: true` leaders: an editable `miniboss` checkbox, and the effective run reward and
    level range from `rules.run.foes`, labelled "overridden in runs".
  - In World & encounters, mark legacy stand-in species, and show the stand-in the game will use.
  - An encounter preview of a node's wild table uses the worker.
- **Effort:** M.
- **Acceptance:** a designer can no longer edit a leader's reward believing it changes runs.

#### T4.4 Economy view (read-mostly)
- **Priority:** P3.
- **Why dedicated:** sources and sinks are spread over:
  - `rules.run.payout`;
  - `healCost`;
  - `shop`;
  - items prices;
  - foes rewards;
  - relic prices;
  - the currencies' `kept` rule.

  One page that lists them with links to their fields, plus T3.4's money-in/out numbers, is the "economy editor".
  Building a separate economy data model would be the complexity to avoid.
- **Dependencies:** T3.4 for numbers.
- **Effort:** S-M.

#### T4.5 Navigation for roguelite work
- **Priority:** P2.
- **Approach**
  - New group "Runs": Run Lab, Relics, Unlocks & hub, Economy.
  - "Rules" keeps the non-run numbers.
  - Move Town shops and Jobs (both `{}`) to the Legacy group, with a note.
  - "World & encounters" says which parts the run reads (pools by biome) and which are legacy (eggs).
  - No other section moves (no cosmetic churn).
- **Effort:** S.
- **Acceptance:** `SECTION_GROUPS` updated, Find still finds everything, `studio-layout` tests pass.

### Phase 5 - Billie and robot parts

#### T5.1 One source of truth for kit Billies (after the owner's decision)
- **Priority:** P1 decision, L-XL work.
- **Problem:** F12.
- **Recommended option:** the recipe is the truth.
  - Port `build_view`'s assembly to JS by extending `logic/part-joints.js` `partFit`:
    - joints by sockets;
    - z from partKits (the builder's constants become data defaults);
    - mirroring through `sides` and `mirrorOf`;
    - the stage scale;
    - generated blink.
  - A parity test against the Python output on all 24 kit Billies (pixel-equal sheets and rig-equal JSON), like
    `sheet-slice-parity`.
  - Then the Studio bakes on "Write Billie", and the Python builder retires.
  - The baked sheet stays the game's runtime format: no runtime assembly, so no renderer change.
- **Alternative:** keep Python as the truth and make Studio edits to kit Billies write back to `builds.json`. Cheaper
  now, but the two assemblers stay.
- **Effort:** XL (3 sessions: assembly, parity, Studio flow).
- **Risk:** high (art output). Parity first, behaviour second.
- **Acceptance:** parity test green; editing a recipe part and writing reproduces the old sheet when nothing
  changed.

#### T5.2 Part swap keeps the Billie whole
- **Priority:** P1 for the parts workflow.
- **Problem:** F11. Can start before T5.1 for legacy rigs.
- **Approach**
  - **After a swap:**
    - Recompute `geo` (call `skeletonFraming`'s logic, moved into `logic/rig-joints.js` so it is testable).
    - Refit children by socket. Map the old bone's child `at` to the new part's named socket of the same role (neck,
      shoulderL…) through the shared slot table, T5.5.
    - Keep blink and squash: regenerate blink with the builder's rule (pure, from T5.1's port, or a small `blinkOf`
      first) and keep the old frame if the user chooses.
  - **Compatibility filter:** a library part must have every socket the bone's children need. Incompatible parts
    stay visible, grey, with the reason.
  - **Before and after:** front and back, idle, blink, happy and hurt, side by side, through `rigParts`/`rigFrame`
    (the game's path; T5.6).
- **Effort:** L. **Risk:** medium.
- **Acceptance:**
  - A head swap on a kit Billie keeps a blink.
  - Its crest stays on the new head's crest socket.
  - `geo` equals what the skeleton builder computes.
  - The world sprite height is unchanged for an equal-size part.
- **Automated tests:** unit tests for refit and `geo` on 3 real species; `billie-library.test.mjs` moves off its
  string-cut harness to the logic module.

#### T5.3 Rig consistency checks
- **Priority:** P2.
- **Approach:** add to `data-checks` (T1.3):
  - boxes inside the sheet PNG;
  - sizes match;
  - parents exist;
  - front and back bone sets match;
  - `geo` up to date (recompute and compare);
  - `meta.size` the same for both views.
- An auditor's script found 0 problems in today's data, so this is a guard against regressions.
- **Dependencies:** T1.3. **Effort:** S-M.

#### T5.4 Sheet compaction
- **Priority:** P3.
- **Approach:** a "Repack sheet" action that drops unreferenced pixels and rewrites `f` boxes, as one undo step,
  with a parity check that the drawn frames are pixel-identical.
- **Effort:** M.

#### T5.5 One slot vocabulary (rename-only commits)
- **Priority:** P2.
- **Problem:** `sig` vs `signature`, `head-extra`/`body-extra` vs bone slots, `mane` and `shell` disagree.
- **Approach**
  - The owner picks the words (Ask).
  - Then one rename per commit through `tools/rename-data.mjs`, per NAMING.md.
- **Effort:** S-M.

#### T5.6 Studio previews use the game's rig path
- **Priority:** P2.
- **Problem:** F10.
- **Approach**
  - Replace `sprites.js` `rigFor` with `rigParts`.
  - Drive previews with `rigFrame` (12 fps clock, lag) so the Studio shows what the game shows.
- **Effort:** S-M.
- **Acceptance:** with a fixed clock, a canvas from the Studio preview is pixel-equal to the game's.

#### T5.7 Pixel-density report (measure before changing anything)
- **Priority:** P3.
- **Problem:** density differs per path and per part:
  - battle ≈ 65 px/m for the player's Billie and ≈ 30 for the foe [inf];
  - the world uses a 1/68 m grid;
  - ground is 32 px/m;
  - kit parts are re-filtered twice at varying scales;
  - S and L draw at 0.85 and 1.2 with nearest-neighbour;
  - cards are scaled by CSS at non-integer factors.
- **Approach**
  - A Studio report: per species and path, the on-screen px per source px and per metre.
  - It flags non-integer scaling and parts whose density differs by more than X% from their body.
  - **No resolution change** until the owner sets a target density for Billies. This is an art direction call.
- **Effort:** S-M.

### Phase 6 - Performance, polish and documentation

Each ticket starts by re-running the self-test on a desktop browser (not headless) to get a real baseline, and ends
with the self-test's comparison to the last run, which the self-test already provides.

#### T6.1 Debounce and narrow heavy section hooks
- **Priority:** P2.
- **Problem:** a Walk scenes field edit costs ~1 s.
- **Approach**
  - The hook keeps cheap work on `input` (redraw the 2D map) and moves `walkView.nav = null` and other rebuilds to
    `change` or a 300 ms debounce.
  - Audit the other hooks the same way: coats, robots, wardrobe, engine and people.
- **Effort:** S-M.
- **Acceptance:** the self-test's scenes edit time is under 150 ms on a desktop; the walk view still updates after
  the field settles.

#### T6.2 Partial redraws for list actions
- **Priority:** P2.
- **Approach**
  - A small `renderCard(id)` helper: re-run a section's card function and replace that card's element only.
  - Use it in the five busiest action files, starting with the matrix and toggle actions.
  - Undo and redo after T1.2 know which files changed. A section can declare which files it shows
    (`SECTION_FILES`), and undo re-renders only when the visible section shows a changed file.
- **Effort:** M.
- **Acceptance:** wardrobe undo is under 200 ms; focus and scroll are kept after a matrix click.

#### T6.3 Profile and fix the slow first opens
- **Priority:** P3.
- **Approach:** a DevTools profile of Types (1.9 s HTML build) and Wardrobe (2.5 s), then one fix per cause.
- **Effort:** S each.

#### T6.4 Test-tier hygiene
- **Priority:** P3.
- **Approach**
  - Find the slow unit tests (80 s against a 30 s budget; the real-scene tests dominate) and move them to a
    `test:slow` tier that CI runs.
  - Update docs/TESTING.md.
  - Add `// @ts-check` to the new Studio modules (`publish`, `drafts`, `run-lab`, `logic-worker`) from day one.
- **Effort:** S-M.

#### T6.6 Small correctness fixes from the rendering audit
- **Priority:** P2.
- **Commits, one cause each:**
  - F16: `onField` finds the field's pane and uses that pane's section hook.
  - F17: robots in `renameType`. Then move the rename helpers into logic, with a unit test that walks every
    type-id field of the real data.
  - F20: one ordered registry of path prefixes instead of chained `setReadPath` wrappers, with a test that no two
    claim one prefix.
  - D5 (from the second audit): `updateTopBar` keeps a "changed since load" flag instead of calling `snapshot()`.
  - A `catch` in `renderPane`, plus global `error` and `unhandledrejection` toasts.
  - Pixel-canvas listeners removed on close.
  - The dead backups text goes.
- **Effort:** M in all. **Risk:** low.
- **Acceptance:**
  - A second-pane rename updates its own list.
  - Renaming a type keeps check-data green.
  - The listener count is flat after opening the pixel editor 5 times.

#### T6.7 Keep the 3D view across redraws
- **Priority:** P2.
- **Problem:** F18 and F19.
- **Approach, in order of preference:**
  1. Keep the 3D view alive across redraws:
     - the section's HTML holds a placeholder;
     - `renderPane` moves the existing `<canvas>` into it (re-parenting keeps the context);
     - stale state is cleared only when the scene really changes.
  2. If re-parenting proves fragile:
     - call `loseContext()` on the old canvas;
     - key the structure and solid-prop mesh caches by the GL context.
  - Either way, the game's own paths (one canvas for the page's life) do not change. These are game files, so a
    check-fast run is needed.
- **Effort:** M. **Risk:** medium (renderer). The "Leave alone" list in roguelite-track.md covers the renderer:
  touch only cache keys and canvas ownership.
- **Acceptance:**
  - 20 tool switches in Walk scenes make 1 context.
  - No `INVALID_OPERATION` in the console.
  - Buildings stay drawn after undo.

#### T6.8 Navigation clean-up beyond T4.5
- **Priority:** P3.
- **Approach:** one meaning per word.
  - Rename only the *labels* "People" (looks) and "Parts" (size rules) to say what they are. Player-facing words do
    not change. Labels are Studio UI, not game text.
  - Update STUDIO.md's stale entries, such as "Map art".
- **Effort:** S.

#### T6.5 Docs
- **Priority:** P3.
- **Approach**
  - STUDIO.md sections for Publish, Drafts, Run Lab, Simulate, Relics and Unlocks.
  - A "where does the game read this" note per Runs editor.
  - HANDOFF entries per phase, as the house rules require.
- **Effort:** S.

---

## Part 6 - Testing and migration strategy

### Compatibility of assets and data
- No ticket changes a data file's shape except:
  - T5.5 (renames through `rename-data.mjs`, one per commit);
  - T1.3 (schema enum removed, which loosens the schema, never tightens it).
- The baked sheets and `rigs-next.js` stay the runtime format.
- Old saves do not matter (CLAUDE.md). Nothing in this plan touches the save format.

### Protecting unpublished work
- From T0.1 on, the ledger is the only "unsaved" truth and is cleared only on server confirmation.
- From T1.1 on, it is mirrored to IndexedDB.
- The self-test already refuses writes and puts the data back; it must keep doing so with the ledger.
- Its privacy row ("no token in the report") is extended to the draft store: no token or login in a draft that could
  be exported.

### Testing GitHub publishing failures
- **Pure logic:** the ledger and the publish plan are pure (`publish-plan.js`) and Node-tested.
- **Browser:** the GitHub stand-in in `check-studio-github.py` gains a failure table, driven per step:

  | Inject | At | Expect |
  |---|---|---|
  | 502 | blobs, trees, commits, refs, pulls | everything still pending; retry sends all |
  | 401 | any | sign-in modal; resume; one PR |
  | 422 ref exists (own SHA) | refs | resume to pulls |
  | main moved, file shared | before send | overlap dialog names the file |
  | bad id in a split section | staging | nothing sent; message |

### Procedural generation, deterministically
- Every random draw already goes through `rngFrom(seed, salt)`.
- **Tests:**
  - snapshot tests (`run-map.test.mjs.snapshot`);
  - a cross-path equality test: game start = fixture = sim = Run Lab, through `runStartPlan`, over 200 seeds;
  - invariant tests over 1,000 seeds (T2.3).
- **The Studio shows a data hash** next to every seed, so a bug report pins both.

### Validating balance changes
- Paired before/after on fixed seed lists, with intervals (T3.4).
- A change is "real" only if the interval excludes 0, and the policy banner says what the bot does.
- The CLI writes the same JSON, so a PR can include a compare file when a session tunes numbers.

### Preventing Studio/game drift
- **One implementation per rule:**
  - validators in `data-checks.js`;
  - run start in `runStartPlan`;
  - the sim core in logic;
  - rig drawing through `rigParts`/`rigFrame`;
  - kit assembly in JS after T5.1.
- Parity tests guard every place where two implementations must exist for a while: Python builder vs JS, CLI vs
  worker.
- `check:modules` guards the load order.

### Test tiers
| Tier | What | Where |
|---|---|---|
| Unit (Node) | ledger, publish plan, history diffs, data checks, runStartPlan equality, map invariants, sim core, refit and geo, Wilson/paired stats | `tools/test/*.test.mjs` |
| Integration (Node) | check-data output snapshot; CLI sim determinism | `tools/test/` |
| Browser (stand-in) | publish failures, drafts restore, Run Lab seed, worker panel, propose blocked by an error, self-test | `check-studio-github.py` (in CI after T1.4) |
| Game browser | `?run=` start equals plan | `check-fast.py` |
| Manual (owner) | phone run of a Lab seed; one real PR with a conflict; iPad worker | per ticket |

The unit tier is already 80 s against a 30 s budget. New tests must stay fast; T6.4 looks at the slow ones.

---

## Part 7 - Recommended first sprint

**Scope:** T0.1 → T0.2 → T0.3, then T1.1. That is Phase 0 plus drafts, about 3-4 sessions.

**Why first**
- F1-F3 are the only defects that lose or revert work silently, and they sit on the only working save path.
- Drafts (T1.1) close the remaining "tab closed" and "token expired" holes, and need the ledger from T0.1.
- Everything else, including the Run Lab, is worth less if publishing it can drop changes.

**How to split the work**
- Session 1 (T0.1):
  - first commit, the failing stand-in step (`publish_failures`, from this review's repro);
  - then the ledger module and tests;
  - then the wiring.
  - One PR.
- Session 2 (T0.2 + T0.3): separate commits, one PR. The stand-in needs to serve contents at a SHA.
- Session 3 (T1.1): its own PR.
- T0.4 (docs) rides with session 2.
- **Do not combine** with T1.2 (undo). It touches the same `studio-app.js` functions and should follow, not ride
  along.

**Complexity:** M + M + S-M + M.

**Demonstrable after the sprint**
- The stand-in can fail any GitHub step, and the retry carries every change.
- A proposal names files that changed on main since load.
- An expired token is fixed without losing work.
- A closed tab offers to restore unsent work.

**First ticket:** T0.1, "Publish never drops pending changes".

---

## Part 8 - Explicitly deferred

| Item | Why not now |
|---|---|
| A UI framework or a rewrite of the section renderer | The measured costs are specific (Part 2, A1); the field path already edits in place. Targeted fixes are cheaper. |
| Real-time sync, CRDTs, multi-user editing | One owner and occasional admins; pinned base plus PR conflicts (T0.2) covers it. |
| A schema-driven generic editor for every data file | It would be harder to use than the JSON for the small tables, and it hides the runtime meaning that the dedicated editors exist to show. |
| Runtime part assembly in the game (dress Billies from parts at runtime) | The baked sheet works with every draw path; T5.1 gets the benefits (one source of truth) without renderer work. Revisit if part swapping becomes a player feature. |
| Changing Billie source resolution or display scale | Needs an art-direction target first (T5.7 measures). Touches battle, world, cards and the builder. |
| Balance tuning from simulator numbers | 0 wins in 50 runs with legacy stand-in species; the simulator lacks relics and unlocks (A6). Tune after T3.3 and real roster lines. |
| A player-model AI for the simulator | A good bot is a project; named policies with honest banners are enough to compare drafts. |
| Moving every hard-coded run constant into data | Do it per constant when a designer needs it (the Run Lab shows which are in code). Bulk moves are churn. |
| Studio local mode (`start-studio.py`) | Not in the repository; GitHub mode works. The owner decides keep or drop (open since phase 04). |
| Type-checking all Studio JS at once | Add `// @ts-check` file by file as tickets touch them (T6). |
| Content packs (`mergeInto`, RL-16) | Belongs to RL-16. This plan's editors should land first, so RL-16 only adds the pack filter. |

## Decisions (owner, 2026-10-22)
The owner took the recommendation on every open question:
1. **T5.1:** the recipe is the truth. Kit Billies are baked by a JS port of the builder, with a parity test against
   the Python builder, which then retires.
2. **T1.3:** only what CI's `check:data` fails on blocks Propose; everything else is a warning.
3. **T1.4:** `check-studio-github.py` runs in CI on PRs that touch `studio/` or `game/js/logic/`.
4. **T0.2:** "Continue from my proposal branch" comes later; proposals stay cumulative.
5. **T5.5:** the game's words win (`rules.json`, `lines`, `boneSlot`). partKits kinds map onto them, and the Phase 5
   session proposes the exact mapping in its plan.
6. **RL-16:** Phase 4 replaces RL-16's generic editors for the new sections; RL-16 keeps content packs.
7. **Local mode:** dropped. The `start-studio.py` docs and text go, and so does `check-quick.py --studio`.
8. **F14** (raised in Phase 1):
   - Convert the 9 old-style people to `look` in one data-only commit.
   - Remove the convert-on-open.
   - Make `look` required.
9. **Phase 6** (recommended options taken under the owner's standing instruction, 2026-10-23):
   - F20: a shop keeper's thank-you lines take the prefix `@thanks.`; lore keeps `@lines.`. The registry throws on a
     clashing claim at load (a page error the checks catch) rather than warning.
   - F17: a deleted type makes a robot part or gem Normal (`None`, which check-data accepts) and a Loophole's damage
     row count for any type; the roster board and `rules.ride.types` drop it.
   - D5 skipped: T1.2 already stopped `updateTopBar` stringifying the data.
   - Backups: the Check's Backups card and Restore go with the side-footer line (local mode is dropped); the section is
     labelled "Check".
   - T6.7: option 1, re-parenting, generalised: `renderPane` moves any `data-keep` element into its placeholder, and
     the five 3D placeholders share one key, so one WebGL context lasts the session. No renderer file changed; the
     battle preview keeps its own canvas.
   - T6.1: drawing a hook asks for runs once per frame (`drawSoon`); Walk scenes' walk-view rebuild waits for 300 ms
     of stillness. Engine already debounced; coats and robots cost about 25 ms and stay.
   - T6.2: no per-section `SECTION_FILES` list. A section's code reads data through many helpers, so a list would be
     a guess, and a wrong guess shows stale data after undo; the slow undo (Wardrobe) changes a part its own section
     shows, so skipping redraws would not help it. Instead: a redraw keeps focus and scroll, and an undo of text-only
     data keeps the picture caches. Wardrobe undo's real cost is person-art's cache key (the global `atlasVersion`,
     bumped by every undo and by every picture change): see HANDOFF for the proposed fix.

## Ask me before (owner decisions this plan needs)
1. **T5.1:** recipe as the truth with a JS baker (recommended), or Python stays and Studio writes recipes.
2. **T1.3:** which of today's Studio "errors" may block Propose. Recommended: only what CI already fails on.
3. **T1.4:** `check-studio-github.py` in CI on Studio/logic PRs (recommended, about 2-3 min).
4. **T0.2:** after a successful proposal, should the Studio offer "continue from my proposal branch"? Recommended:
   later. Keep cumulative proposals and say so.
5. **T5.5:** the slot words.
6. **RL-16:** this plan's Phase 4 replaces RL-16's "generic data editors for the new sections". Recommended: yes;
   RL-16 keeps packs.
7. **Local mode:** drop the docs and boot text for `start-studio.py`, or add the server to the repo.

## Appendix - What was run and what was only read
- **Run in this review**
  - The GitHub-mode failure repro (F1), headless.
  - Undo snapshot size and encoding (F8), in Node on the real data.
  - The full Studio self-test, headless (170 s; F14 and A1 numbers).
  - Rules undo in isolation (not reproduced).
  - `npm test`: 618 pass, 80 s. `lint`, `typecheck`, `check:modules`, `format:check` and `check:data` all pass.
  - The run-logic test files (91 pass).
  - 10,000 run maps in Node (distributions).
  - 50 and 30 simulator runs.
  - The parts tests (62 pass).
  - A rig consistency script and a palette conformance measurement.
- **Read only (not executed)**
  - F2, F3, F4, F6 paths.
  - The `R.k2` NaN's on-screen effect.
  - Worker feasibility (T2.4 spike).
  - The balance-mode speedup (T3.3).
  - Battle and world pixel densities.
- **Not run:** the full quick check (40 min) and the phone checks, because no code was changed.
- **Headless timings are software-rendered:** frame-time findings from the self-test are only relative. HTML-build
  and data timings are CPU and meaningful.

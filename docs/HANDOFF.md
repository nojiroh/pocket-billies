# Handoff log

Newest entry on top. Every phase session ends by adding an entry here and tagging the commit `phase-NN-done`.

### Studio plan Phase 5, session 3 - The Studio bakes kit Billies ("Write Billie"), the Python builder retires, then T5.2 - 2026-10-23
Branch `claude/sr-5-parts`, draft PR #139. Plan pre-approved with its recommended options (decision 9's standing
instruction, relayed by the parent session); this session's choices are decision 11 in the plan doc. First merged
`origin/ccr-81011a25-lf3exv` (Phase 1 sessions B-D: the moved checks, CI), conflicts in docs and the checks only.

**Plan** (commit and push after every ticket)
1. **T5.1 step 3, the Studio bakes.**
   - `kitBakeWhole` in kit-assemble.js: one form's sheet, layout, rig and native parts from the data, shared by
     `npm run bake:kits` and the Studio (the CLI moves onto it, no output change).
   - The kit Billies' piece layouts (`game/art/next/billionaires/<kit form>.json`) retire: the game never reads them,
     Propose has no way to send a JSON beside the art, and the one reader (the Roster board's silhouette) falls back to
     the rig. The bake CLI and the parity test stop writing and comparing them (the rig is still compared whole).
   - `studio/js/kit-recipe.js`: Part mode on a kit Billie shows its recipe (scale; per bone kind the part, size and
     colour; the extras). A change bakes at once in the browser (part pictures through canvas ImageData, the game's
     baker): the recipe, the sheet (a Studio picture), the rig and the line's native parts change together as one
     undo step. "Write Billie" bakes the shown recipe again (after a part picture was repainted); nothing changes when
     it bakes as it is. Propose then carries the PNG, rigs-next.js, kitBuilds.json and the line.
   - check-studio-github.py `kit_write`: a recipe part edited in the Studio; Propose's batch has the sheet, the rigs,
     kitBuilds.json and the line; the proposed sheet is pixel-equal to the Node bake of the same recipe and the rig
     equal; Write Billie on an unedited recipe changes nothing; undo takes the recipe and its bake back together.
2. **The Python builder retires** (tools/build-kit-billies.py and its preview sheet docs/samples/kit-billies.png),
   once step 1 holds parity. The parity test compares with the committed art, so no Python fixture is needed.
3. **T5.2** (part swap keeps the Billie whole): `skeletonFraming`'s `geo` maths into logic/rig-joints.js; refit the
   children to the new part's sockets; keep or regenerate the blink frame; the compatibility filter with reasons; a
   before/after preview through rigParts/rigFrame; unit tests on 3 real species.
4. **T5.3** rig consistency checks into data-checks.js; then T5.4 and T5.7 if time allows.

**Changed** (one cause per commit; the plan's choices are decisions 11-14 in the plan doc)
- **T5.1 step 3, the Studio bakes.**
  - `kitBakeWhole` (kit-assemble.js): one form's sheet, rig and native parts from the data; `npm run bake:kits`, the
    parity test and the Studio all bake through it.
  - The kit Billies' piece layouts (24 `game/art/next/billionaires/<kit form>.json`) retired: nothing in the game read
    them and Propose can't send them. The Roster silhouette draws kit Billies from the rig; the full quick check asks
    for each starter sheet to be drawn by a rig.
  - `studio/js/kit-recipe.js`: Part mode on a kit Billie shows **Kit recipe** (scale, each bone kind's part, size,
    colour, the extras). A change bakes at once in the browser: recipe, sheet, rig and native parts as one undo step,
    so a recipe never leaves without its bake. **Write Billie** re-bakes it as it is (nothing changes when baked).
  - check-studio-github.py `kit_write` (in CI): all 24 baked in the browser as committed; an edit proposed carries the
    sheet (pixel-equal to the Node bake), rigs-next.js, kitBuilds.json and the line.
- **The Python builder retired:** tools/build-kit-billies.py and docs/samples/kit-billies.png deleted. The parity test
  needs no Python fixture (it compares with the committed art, which was the builder's output byte for byte).
- **T5.2, part swap keeps the Billie whole.**
  - `rigGeo` (rig-joints.js): skeletonFraming's maths moved, equal on every view.
  - `logic/rig-swap.js`: which parts fit (the sockets the children need, with the reason), children refit (named
    socket, else in proportion), frames (blink made again or old frames kept; torso squash again), the sheet grown
    below, geo moved by what changed. The Studio's **Replace from Parts Library** uses it, greys misfits, and shows a
    before/after strip (front and back × idle, blink, happy, hurt, through rigFromMeta/rigFrame).
  - Tests: rig-swap.test.mjs on musk0, huang0, trump0; billie-library.test.mjs moved onto the logic;
    check-studio-github.py `library_swap`.
- **T5.3, rig checks:** `dataRigs` in data-checks.js, run by check-data and the Studio's Check (an error: blocks
  Propose). 0 problems on today's rigs. The skeleton builder now writes `mid = cy = (top + base) / 2`.
- **T5.4:** `rigRepack` and **Repack sheet** in Part mode (one undo step; refuses kit Billies and coat-own sheets).
- **T5.7:** `logic/pixel-density.js` (the world's metres per pixel moved there from world-billies.js) and the Roster
  board's **Pixel density** report. Measure only.
- Merged `origin/ccr-81011a25-lf3exv` (Phase 1 sessions B-D) first.

**Where the plan doc was wrong or short**
- "Propose carries the PNG, rigs-next.js and the recipe": a bake also writes the line's native parts and (until now)
  a piece layout; the layout had no way through Propose, so it retired (decision 11).
- "geo equals what the skeleton builder computes": no stored geo does (all 258 views differ, up to 20 px): every
  builder measured drawn pixels and took mid from the ground line. A swap moves geo by its change instead (decision
  12), and T5.3 checks geo as far as the data agrees (decision 13).
- "Its crest stays on the new head's crest socket": no library head has a socket for extras (heads have only `chin`;
  only torsos have named child sockets). Horns, ears and crests keep their place in proportion, as the baker's anchors.
- "Refit by socket through the shared slot table": partKits `socketRules` already maps sockets to slots; sides come
  from the bone names (quad legs: near = L).
- T5.3 "geo up to date (recompute and compare)" can't be literal (above); hw can't be checked per view (the builders
  copied the front's to the back).
- T5.7 battle density depends on the camera, so the report covers the world and the kit parts only.
- **Found, not fixed (owner's call):** the skeleton builder rewrites geo's top and hw from picture boxes on every drag,
  so an edit there changes a Billie's world height by up to 20 px. Recommended: move geo by the change, as the swap.

**Verified**
- Unit tests 665 pass; lint, typecheck, `check:modules`, `format:check`, `check:data` (0 rig problems).
- Parity green at every commit; `bake-kit-billies.mjs --check`: every form as committed.
- `check:fast`: every check ok (after the world-billies move).
- `check-studio-github.py --only=publish,workbench,part_mode,robot_joints,species_parts,wardrobe,rig_preview`: 0
  problems, with kit_write, library_swap, repack, density, and CI's list (sections, publish, drafts, studio_test,
  checks). Planted faults failed each new check (a wrong native part, a one-pixel sheet, a refit, a geo, a one-pixel
  repack move, nine rig faults).
- **Full quick check** (end of Phase 5, about 40 min): 14 problems, none from this work. 10 fail the same way on the
  session's starting commit f9c5080 (roster counts that expect the legacy 117 Billies, the bowl map camera, walk
  cycles, the light lab's props, buildings without a plan, shaped terraces, bush recipes, phase 08's division by zero).
  RL-7, RL-8 and the postcard step fail only inside the full run; on their own they pass on this branch's head (and
  on f9c5080), so they depend on what earlier steps leave behind. Those 14 need their own session (scope reset tests).
- CI's Studio list (sections, publish, drafts, studio_test, checks, kit_write, library_swap, repack, density): ok.

**Risky**
- Browser decoding: the Studio bake reads part pictures through canvas; exact today (no part or kit sheet has a
  semi-transparent pixel, and kit_write proves the 24 equal). A part repainted with soft edges could break exactness.
- A swap or a pixel edit on a kit Billie by hand is lost at its next bake (documented in STUDIO.md).
- The new Check errors (rigs) block Propose; a rig made broken elsewhere would now stop proposals until fixed.
- studio/index.html gained three script tags (kit-recipe, rig-swap, pixel-density) and check-studio-github.py five
  groups: expect merges with the Phase 4 and 6 sessions there and in workbench-species.js / check.js.
- **Not tested on a real phone or a real GitHub** (stand-in only).

**Next**
- Owner decisions: the skeleton builder's geo (above); whether to repack the 122 sheets; a target density (T5.7).
- Phase 5 is done (`sr-5-done`). T1.4 note: CI's Studio list grew by kit_write, library_swap, repack and density.

### Studio plan Phase 5, session 2 - The recipe in game/data, a Node bake CLI, the slot words (T5.1, T5.5) - 2026-10-22
Branch `claude/sr-5-parts`, draft PR #139 (base `ccr-81011a25-lf3exv`). Plan pre-approved with its recommended options
(decision 9's standing instruction); this session's choices are decision 10 in the plan doc.

**Plan**
1. Rename-only: `tools/art-source/part-kit/builds.json` -> `game/data/kitBuilds.json`, listed in index.json, written
   in the data files' layout (PB_DATA.text); the parity test and the Python builder read the new path.
2. `game/data/schema/kitBuilds.schema.json`, its type in game-data.d.ts, and check-data coverage (parts, colours,
   anchors, rigs, lines and stages). In tools/check-data.mjs (Phase 1c has not moved the checks yet).
3. `KIT_BAKE` moves into kitBuilds.json `bake` (box, margins, squash, tail aims, arm rest, foot gap, chin drop,
   anchors). Parity green.
4. `tools/bake-kit-billies.mjs`: bakes every recipe (or `--only`) and writes what changed (sheet PNG, layout, rig in
   rigs-next.js, the line's `parts`); `--check` only reports. On today's tree it writes nothing.
5. `tools/rename-data.mjs` value mode (its own commit), then `signature` -> `sig`, `head-extra` -> `headExtra`,
   `body-extra` -> `bodyExtra`, one per commit (data, schema, types, Studio, tests together).
6. The baker's slot table gives way to partKits `slots` and rules.json `parts.slots`. Parity green.
7. Docs: NAMING.md, the plan's decisions, CHANGELOG, this entry.
If time allows: session 3's first step (the Studio bakes on "Write Billie"). (Not done: there is no "Write Billie"
yet, it is a new Studio flow, and decision 9 gives it to session 3.) Steps 2 and 3 ran in the order 3, 2, so the schema
covers `bake` from the start.

**Changed** (one cause per commit):
- `game/data/kitBuilds.json` (was `tools/art-source/part-kit/builds.json`), in index.json, with `bake` (the builder's
  constants), `colours`, `forms`. Schema `kitBuilds.schema.json`; types `KitBuilds`, `KitBake`, `KitBuildForm`.
- check-data (tools/check-data.mjs, **for Phase 1c's successor to move into data-checks.js**): the parts, colours,
  anchors, tail aims and slots a recipe names; its line and stage; one recipe per stage of a line; each stage's
  `parts` equal to what its recipe gives. 11 planted faults, each named.
- kit-assemble.js: every function takes `bake` (`D`) as an argument; `kitNativeParts(form, kindSlot, slotList)` gets
  partKits `slots` and rules.json `parts.slots`. `KIT_BAKE` and the slot table are gone.
- `tools/bake-kit-billies.mjs` (`npm run bake:kits`, `--only=`, `--check`): bakes and writes only what changed.
  png.mjs gains `encodePng` (round-trip test). About 1 s for all 24.
- rename-data: `value` mode; and a bug fix: its save deleted `game/data/legacy/` (any rename did; caught before
  commit).
- T5.5: `signature` -> `sig` (28 places), `head-extra` -> `headExtra` (33), `body-extra` -> `bodyExtra` (7), each its
  own commit with the schema, `PartSlot`, the Studio's slot buttons and library mapping, tests.
- rigs-next.js reformatted as the Studio writes it (no-op), then the kit rigs' and layouts' `kit` value
  `builds.json` -> `kitBuilds.json` (parse-level proof that nothing else changed).
- Docs: NAMING.md (slot words, kitBuilds, rename-data value), decision 10, CHANGELOG.

**Where the plan or session 1 was wrong or short**
- "Tail aims per part in partKits": kept in the recipe (decision 10): the Workbench rebuilds partKits entries.
- rename-data's save deleted the legacy world: a latent bug since RL-5, now fixed.
- partKits had no other readers of the slot words in game code: the renames touched only the Studio, types and tests.

**Verified**
- Unit tests 634 pass; lint, typecheck, `check:modules`, `format:check`, `check:data`.
- Parity green at every commit; `bake-kit-billies.mjs --check`: every form as committed.
- The Python builder, re-run in a scratch worktree after the move: byte for byte the committed art.
- `check:fast`: rc 0, every check ok.
- `check-studio-github.py --only=publish,workbench,part_mode,robot_joints,species_parts,wardrobe,rig_preview`: 0
  problems.
- **Not run:** the full quick check (end of the phase).

**Risky**
- The Python builder keeps its own constants (with a note) until it retires; editing `bake` and then running Python
  would disagree. Parity would show it.
- check-data now fails when a recipe is edited without a bake: intended, but the Studio cannot bake yet (session 3).
- The bake CLI rewrites rigs-next.js whole when a rig changes (as the Studio's Propose does).
- check-data.mjs gained a block that Phase 1c is moving; expect a merge there.

**Next (session 3)**
- The Studio bakes kit Billies (a browser bake equal to the Node one: pictures through canvas ImageData, the sheet as
  a Studio picture, rig and lines through the model, one undo step), then retire `tools/build-kit-billies.py` once
  parity has held through the Studio flow. The preview sheet docs/samples/kit-billies.png goes with it unless wanted.

### Studio plan Phase 5, session 1 - Previews on the game's rig path (T5.6) and the JS kit baker with parity (T5.1, step 1) - 2026-10-22
Branch `claude/sr-5-parts`, from `ccr-81011a25-lf3exv` (the plan's PR #131, not merged yet); its own draft PR. The plan
was approved with its recommended options (the owner told the plan's parent session to approve the Phase sessions'
plans that way; recorded as decision 9 in docs/plans/studio-roguelite-improvement-plan.md, with the split over 5
sessions, the recipe moving to `game/data/kitBuilds.json`, and the T5.5 slot words).

**Changed** (one cause per commit):
- **T5.6 (F10).**
  - `skeleton-rig.js` `rigFromMeta(meta, atlas)`: the rig put together from one view's metadata and its sheet (cut
    pieces, bones with pictures, `clock`, `lag`). `rigParts` uses it (no change in the game: every rig has `q`, none
    has an empty box).
  - The Studio's `rigFor` builds through it, from the Studio's own rigs and pictures, so its rigs have `clock` and `lag`.
  - The animated sprite previews and Parts' "As drawn" use `rigFrame` (12 fps, lagging tails). The skeleton builder
    keeps `rigPose`: it has its own 12 fps grid, pause and frame steps.
  - `check-studio-github.py --only=rig_preview`: a kit Billie, front and back, 7 fixed clocks: the Studio preview is
    pixel-equal to the game's drawing. Before the fix it reported 7 of 7 frames differing in both views.
- **T5.1, step 1 (F12).**
  - `game/js/logic/kit-pixels.js`: the builder's picture steps, number for number with Pillow 12.3.0, numpy and
    colorsys (part scaling with Pillow's double premultiply, recolour and face mask, blink, squash frames, mirrors,
    Pillow's nearest affine in its scaling and 16.16 fixed-point paths). Reuses sheet-slice.js's box filter and
    Python rounding. 4 unit tests; a scratch fuzz of 300 random cases against Pillow was all equal (not committed:
    it needs Python and Pillow).
  - `game/js/logic/kit-assemble.js`: `build_view`, `fit_form`, `build_form`, `native_parts` ported. Mirroring comes
    from partKits `sides` (`partForSide`), the main bones' z from partKits `z` (`partZ`). The extras' anchors, the tail
    aims and the rest are in `KIT_BAKE` for now.
  - `tools/test/kit-bake-parity.test.mjs`: all 24 recipes baked and compared with the committed sheet (alpha exact,
    colour where shown), rig (values and key order), layout and the line's `parts`. **Green on the first run** (under
    1 s), so it never failed "first"; instead five planted faults (arm angle, chin drop, tail sweep, an ear's z, the
    blink frame) each failed it with the form and pixel named.

**Where the plan doc was wrong or short**
- "z from partKits": true for head, torso, limbs and tail; the extras' z comes from where they sit (ear 8 vs partKits
  10, crest 11 vs 10, beard 10/4, pack 4/6, collar 8.5), so the anchors carry their own z.
- "Grow `partFit`": the builder lays out a whole figure (leg length sets the torso's height, the hip gap, the chin
  drop, anchors that are not sockets, rest tilts from pixels). That is kit-assemble.js; `partFit` gets only per-socket
  maths, later.
- "Replace `rigFor` with `rigParts`": `rigParts` reads the game's globals and caches forever; the Studio must draw its
  unsaved rigs. Both now share `rigFromMeta`.
- `tools/rename-data.mjs` renames keys and sections, not values; T5.5 needs a value mode first.
- `logic/pixel-ops.js` already exists, so the new module is `kit-pixels.js`.
- The committed kit art is exactly what the Python builder writes today (re-run in a scratch worktree: every sheet,
  layout, rig and line byte for byte), so the parity test compares against the repository, not a Python run.

**Verified**
- Unit tests 633 pass (the parity test about 1 s); lint, typecheck, `check:modules`, `format:check`.
- `check:fast`: every check passes.
- `check-studio-github.py --only=publish,workbench,part_mode,robot_joints,species_parts,wardrobe,rig_preview`:
  0 problems (rig_preview pixel-equal on 7 clocks, front and back; publish 0).
- **Not run:** the full quick check (at the end of the phase).

**Risky**
- The parity rests on Pillow 12.3.0's arithmetic. If the builder is re-run with another Pillow before it retires, the
  committed art may move and the test with it; re-check then.
- Previews now step at 12 fps: a designer may read that as the Studio being slower. It is what the game shows.
- `studio/index.html` gained two script tags (`kit-pixels.js`, `kit-assemble.js`) beside Phase 1's; expect a merge there.

**Next (session 2)**
- Move `KIT_BAKE` and builds.json into data (`game/data/kitBuilds.json` with a schema and check-data; the tail aims
  per part in partKits), parity still green; a Node CLI that bakes and writes (sheet PNG, layout, rigs-next.js, lines).
- Then T5.5: the `rename-data` value mode, then `signature` → `sig`, `head-extra` → `headExtra`, `body-extra` →
  `bodyExtra`, one per commit.

### Studio plan Phase 1, session B - Undo per entry (T1.2) and the F14 hunt (T1.5) - 2026-10-22
Branch `ccr-81011a25-lf3exv` (PR #131), on top of session A. Plan written by the previous Phase 1 session and
reviewed by the parent session; further decisions took the recommended option and are in the plan doc's
"Decisions" (items 9-13).

**T1.2 has landed: the parent can start Phase 6.**

**Changed** (one cause per commit):
- **Self-test guard (T1.5).** After each section opens and settles, with no commit pending, the data must be the last
  undo state; otherwise the run fails with "opening <section> changed the data outside an edit: <paths>"
  (`studioTestChangedPaths` in studio-test-report.js, 1 unit test). The difference is then committed so each cause
  is named once. On the old code it named `D.people.boy`. `commit()` now clears `snapT` when it runs, so "a commit is
  pending" can be read.
- **F14's cause, two writes on opening People:**
  - The convert-on-open of old-style people (`personLook`, with `dirty` and no `changed()`). Data-only commit: boy,
    broker, clerk, concierge, crude, girl, intern, markdown and miner converted once with the Studio's own
    `personLook` in the headless Studio, written with `PB_DATA.text`, old keys dropped. Their person frames (3 views,
    idle and walk, 4 phases, mirrored: 48 each) are the same pixels before and after. Then the convert-on-open went;
    `personLook` stays for + New look.
  - Found by the guard after the plan was written: People filled `look.colors` for the selected person on every
    open (every look-style person lacked some). The colour fields now show those colours as a default
    (`colorField` `o.def`) and write only on a change.
  - person.schema.json: `look` is required (types too). The old colour keys beside a look stay allowed: 25 people
    still carry them and the game ignores them (decision 10).
- **Undo per entry (T1.2).** `game/js/logic/history.js` holds the data as parts: one text per second-level entry
  (`D/maps/<id>`, `D/lines/<i>`, `D/meta/<key>`, `D/<key>` for a value), one per rig (`R/<species>`) and `@order`.
  `last` is the parts, held once; a data step is `{ parts: { name: [before, after] } }`, null for an added or removed
  part. Bytes count 2 a character; data steps have their own 64 MB cap (`HISTORY_DATA_BYTES`). API names unchanged;
  art steps unchanged; a group's `snapshot` is the same diff. 11 unit tests (diffs, round trip, bytes, trim by
  bytes, mixed order, a group with a data diff, the counter).
  - studio-app.js: `snapshotParts`, `restoreParts` (only those parts, then `render()`; an `@order` change rebuilds
    the whole data from `last`). The undo button reads "a commit is pending" instead of stringifying the data on
    every top-bar update.
  - pixel-canvas `artSteps` and the workbench's Apply hand parts; drafts.js and boot keep `last` as parts; Find's
    index key is `last` plus the history's counter (`ver`). billie-library.test.mjs's stub follows.
  - The self-test keeps `snapshot()` / `restore(text)` for its own checks and copies `last` (undo changes it in
    place).
- **`fullMB` is a measurement**: the data held once plus each self-test edit's step, as if all were kept, texts
  counted as the browser stores them (1 byte a character unless one is past U+00FF). Report format 2.
- check-studio-github.py: the guard's problems; a map edit's step holds only that map and its undo leaves the other
  51 maps the same objects (`===`); the undo's size with the three biggest edits.
- Docs: STUDIO.md "Undo", studio-self-test.md, CHANGELOG, TESTING.md (635 tests, about 47 s), the plan's decisions.

**Where the plan was wrong or short**
- The People section had a second write on opening (the colours), not only the convert.
- "Make `look` required, so old-style people can't come back": done, but old keys beside a look are still legal.
- Per entry, one entry still dominates: the **Copperleaf map is one part of
  about 1.25 M characters**, so a Scenes edit there costs about 5 MB per step (both sides, two-byte text). Every other
  self-test edit is 13 kB or less. With the 64 MB data cap that is about 12 Copperleaf steps (before: 80 whole copies
  of 5.4 MB, uncapped).

**Verified**
- Unit tests 635 pass; lint, typecheck, `check:modules`, `format:check`, `check:data` after each commit.
- The guard fails before the People fix ("opening people changed the data outside an edit: D.people.boy") and passes
  after; with it gone, the Rules edit comes back with undo (F14 closed).
- Three self-test runs in a row pass (`--only=studio_test`), and so did two more later.
- `check-studio-github.py --only=sections,studio_test,publish,drafts`: 27 sections open, every edit comes back,
  publish 0 problems, drafts 0 problems, ok.
- The undo measures 9.3 MB after the self-test's 14 edits (under 10 MB): the data once 4.2 MB, the steps 5.0 MB.
- An undo of a Copperleaf map edit puts back only `D/maps/copperleaf`; the other 51 maps stay the same objects.
- A planted old-style `boy.json`: check-data fails it ("must have required property 'look'").
- `check:fast`: all pass.
- **Not run:** the full quick check (planned at the end of Phase 1) and the full chain of `check-studio-github.py`.

**Risky**
- **Undo replaces entries in place.** Code that holds a reference to a part of the data across an undo (a map, a
  move) now keeps a live object for every entry the undo didn't touch, and a stale one for the entry it did. Before,
  every undo replaced everything, so all references went stale together. The 27-section self-test and its 14 edits
  pass; watch the map editor and the workbench on undo.
- **An `@order` change rebuilds all**, as before (adding or deleting an entry). Its cost is the old restore's.
- **Copperleaf edits are 5 MB a step** (above). Follow-up if it matters: split `maps` one level deeper.
- `game/data/gamedata.js` is built, not in git: in a fresh clone the Roster section asks for it and
  check-studio-github.py reports a 404 until `npm run data` has run.
- **Not tested on a real phone or a real GitHub** (stand-in only). Manual: a long editing session on the iPad, watch
  memory (Safari Web Inspector); undo and redo across Scenes, Rules and the workbench.

**Next**
- Phase 1 is complete: T1.3 (the shared validator; it unblocks Phase 4) and T1.4 (CI) landed in parallel on this
  branch (sessions C+D, entry below) and were merged here. Their CI job runs `check-studio-github.py` with
  `studio_test`, which now also fails on a section that writes outside an edit. Tag `sr-1-done` is the owner's.
- Optional follow-ups: drop the old colour keys of the 25 people and make the schema strict; split big maps deeper.
### Studio plan Phase 1, sessions C+D - One validator for CI and the Studio (T1.3) and Studio checks in CI (T1.4) - 2026-10-22
Branch `ccr-81011a25-lf3exv` (PR #131). Plan pre-approved by the owner's standing instruction (recommended options
taken; recorded under the plan doc's "Decisions"). Phase 1b (T1.2 undo, T1.5, People) works on the same branch at the
same time: this session stays out of history.js, studio-app.js's undo, studio-test.js, studio-test-report.js,
data-editors.js and the person schema, and merges (never rebases) before every push.

**Plan** (one cause per commit, checks after each):
1. `tools/data-files.mjs` reads `PB_DATA_DIR` when set (so a test can run check-data on a planted copy).
2. Snapshot test first: `tools/test/check-data-snapshot.test.mjs` plants bad data in every family T1.3 moves (in a
   temp copy of game/data) and compares check-data's whole output with a committed snapshot, made on the old code.
3. The move: check-data's battle.turnCap, run (payout, map, clock, reveal, scene, wild, seamIn, start, home, pack,
   healCost, shop, foes, relics), ranch, robots, biomes, nodeTypes, relics, currencies, buildings and unlocks checks go
   to `game/js/logic/data-checks.js` as pure functions of the data that return `[file, message]` pairs; schema checks
   stay in check-data (passed in as a callback, so the order of lines is kept). Snapshot identical; unit tests per
   family with planted bad data.
4. The Studio's Check runs the same functions (a family that throws on malformed data reports that it stopped).
5. One legacy-species rule (check-data's: a species is known when its line is loaded or is a line in
   game/data/legacy), in the module; the Studio passes the legacy line ids its Legacy section reads.
6. Enums to data: relic `fx.stat` against stats.json (schema enum removed); currency ids from currencies.json
   (buildings' and unlock costs' enums removed); one exported `RUN_RULE_KEYS`.
7. The Studio-only scene and road checks move into the module (same words); check-data runs them, so CI gains them.
8. Severity: `error` = check:data fails = Propose is blocked; the Studio's other "errors" become warnings. check-data
   prints the warnings and never fails on them.
9. Propose refuses while the Check has an error ("Show me" opens the Check); a stand-in step `checks` in
   check-studio-github.py (planted pool typo blocks, a warning does not).
10. CI: the smoke job runs `check-studio-github.py --only=sections,publish,drafts,studio_test,checks` on pull requests
    that touch `studio/` or `game/js/logic/`.
11. Local mode dropped: `check-quick.py --studio` and the remaining start-studio.py text go.
12. Docs: STUDIO.md, TESTING.md, CHANGELOG, the plan's Decisions, this entry.

**Status for the parent session: `game/js/logic/data-checks.js` has the moved checks and is pushed** (step 3 above,
commit "Move: check-data's run, ranch, ..."). Phase 4 (content editors) can start on it: each family is
`dataX(D, valid?)` returning `[file, message]` pairs (dataRunPayout, dataRanchRules, dataRunMapRules, dataRunClock,
dataRunScene, dataRunLoop, dataRobots, dataUiTheme, dataBiomes, dataNodeTypes, dataRelics, dataCurrencies,
dataBuildings, dataUnlocks, dataBattleRules; dataRobotProblems for a trainer's robot). The later steps here add
families (scenes, roads) and change some words (fx.stat, currencies), not the shape.

**Changed** (one cause per commit; all 12 steps done):
- **Shared checks (T1.3).** `game/js/logic/data-checks.js` holds check-data's battle, run, ranch, robot, UI look,
  biome, node type, relic, currency, building and unlock families (moved verbatim; the snapshot test, made first on the
  old code, stayed byte-identical), `dataRobotProblems`, `dataSpeciesKind`, `RUN_RULE_KEYS`, and the Studio's scene and
  road checks (`dataSceneFindings`, `dataRoadFindings`, which return `{lvl, where, msg, go, sel}`).
  - check-data calls them in its old order and hands in its schema check; it now also runs the scene and road
    checks: errors fail, warnings are printed (`  warning: maps/…: …`; two today, bridges ending in water).
  - The Studio's Check runs the same families (in check-data's words, file first; Show me via `CHECK_FILE_SECTIONS`,
    which Phase 4 extends for its new sections) and a trainer's robot.
  - The Studio page now loads run-marks, meta-state, run-state and run-map (data-checks.js needs run-map's
    `runMapRowsFit` and run-marks' list); data-checks.js moved after mapgen.js.
- **One legacy-species rule**: check-data's. The Studio passes the legacy line ids from `legacy-view.js`
  (`legacyLineIds`, `legacyLineIdsRead`); any stage of a parked line counts there (it reads only legacy/index.json),
  while check-data counts the exact stages. Until the ids are read, the old pattern rule holds and a note says so;
  Propose waits for the read.
- **Enums to data**: relic `fx.stat` against stats.json (not hp; the schema enum went), a building's and an unlock
  grant's currency against currencies.json (kept between runs), `RUN_RULE_KEYS`; a scene's life against
  scenery.json's `life` (the old list of five called Copperleaf's rabbit, squirrel and cat unknown).
- **Severity** (owner's decision): an error is only what check-data already refused. Stay errors: a line's stages and
  names, a move a line learns, wild pool and trainer species, a stop's map and named pool, a trainer's stop and team,
  the world map look's ground, a scene's kind, ground, props and islands, the roads (seam-rules), the UI look's
  contrast, the story, every data-checks.js family. Became warnings: types, moves, line ids, skeletons and art,
  rarity, evolution items, fishing and egg species, backdrops, shops, gates, badges, jobs, starters, part sizes, the
  weather types, a scene's kind against its stop's, a stop's kind, a room's keeper, the UI rules over their ceiling.
- **Propose refuses on an error** (`checkBeforeSave` in studio-app.js; github.js asks it before the summary box):
  a dialog names the first five, Show me opens the Check. "Save anyway" is gone. Also fixed: the Check called a
  trainer's robot "a species that doesn't exist" (it blocked Propose on the real data once errors blocked).
- **Tests**: `check-data-snapshot.test.mjs` (+ `PB_DATA_DIR` in tools/data-files.mjs), 9 new unit tests in
  `data-checks.test.mjs`, `check-studio-github.py --only=checks` (6 problems on the old code, 0 now). The publish
  checks' "cannot be built" case steps past the Check, which now refuses its planted map first.
- **CI (T1.4)**: the smoke job compares a pull request's files with its base commit and, when `studio/` or
  `game/js/logic/` changed, runs `npm run data` and `check-studio-github.py --only=sections,publish,drafts,
  studio_test,checks`. The smoke job's limit is 30 minutes (was 20).
- **Local mode dropped**: `check-quick.py --studio` (`studio_round_trip`) and the start-studio.py text in STUDIO.md,
  github.js and the Studio's load error.
- Docs: STUDIO.md "The Check", TESTING.md (Studio tier, data checks), CHANGELOG, the plan's Decisions 9-11.

**Where the plan doc was wrong or short**
- The Studio has no sections yet for relics, unlocks, buildings, currencies, node types or biomes: their problems show
  in the Check without Show me until Phase 4 adds editors.
- "Currency ids in three places": the third was an unlock's grant (not a cost); currencies.schema.json stays the list.
- Every Studio-only scene and road check that became shared is a warning, so CI gained notes, not new failures; the
  scene and road errors duplicate check-data rules, so a fault there prints two lines in CI.
- The Check's Backups card is local mode's: on GitHub it is always empty. Left for the owner (drop it, or show the
  repository's history).

**Verified**
- Unit tests 645 pass (about 42 s); lint, typecheck, `check:modules`, `format:check`, `check:data`, `build`.
- `check-studio-github.py --only=sections,publish,drafts,studio_test,checks` (CI's command): 0 problems, 5 min 42 s.
  `--only=publish,drafts`: 0 problems.
- `check:fast`: 25 of 25 pass.
- Not run: the full quick check, and CI itself (the new step runs on the PR's next push).

**Risky**
- **Propose can now be refused.** Any error the Check finds blocks it, including a family that stops on data in a
  shape it doesn't expect. If a real proposal is refused for something that looks wrong, the message names it; the
  rule to relax is in data-checks.js or check.js.
- **Phase 1b and this session both touched studio-app.js** (undo there, `checkBeforeSave` here): merged without
  conflict so far.
- **The parallel Run Lab session** may add run-map.js to the Studio page too: its merge must keep one tag, before
  data-checks.js.
- **CI time**: Studio and logic pull requests take about 6 minutes more.

**Next**
- Phase 4 (content editors) on data-checks.js: add each new section to `CHECK_FILE_SECTIONS`.
- Tag `sr-1-done` once Phase 1b's entry is in (the owner's).

### Studio plan Phase 1, session A - Local drafts (T1.1) and hygiene (T1.6) - 2026-10-22
Branch `ccr-81011a25-lf3exv`, on top of Phase 0 (PR #131, not merged yet). Approved in Plan Mode with Phase 1 split
over four sessions: **A** T1.1 + T1.6 (this one); **B** T1.2 undo per file + T1.5 the F14 hunt; **C** T1.3 part 1 (move
check-data's checks into `game/js/logic/data-checks.js`, output byte-identical); **D** T1.3 part 2 (the Studio's Check
uses them, the severity review) + T1.4 CI, then tag `sr-1-done`. Owner's decision: a draft made on an older commit is
restored **at that commit** (not laid over today's main).

**Changed** (one cause per commit):
- **Drafts (T1.1).** `studio/js/drafts.js` (new) and `game/js/logic/draft-record.js` (new, 4 unit tests).
  - Written to IndexedDB (`pb-studio-drafts`, one record per `owner/repo@branch`) 2 s after the last change
    (`updateTopBar` calls `draftSoon`) and when the tab is hidden. Holds only what is pending: the data files whose
    text differs from the loaded commit (`changedDataFiles`, index.json included, so deletions come back), the rigs
    when they differ from what loaded, each unsaved picture as a Blob (re-encoded only when its `_ver` changes), the
    base commit, the login, the time. No token.
  - `confirmStaged` writes at once: the draft goes when a proposal took everything, or keeps what changed meanwhile.
    A failed proposal leaves it.
  - Boot (github.js): sign-in → `draftOffer` (Restore / Later / Discard, before any data is read) → boot → `draftStart`.
    Restore sets `githubMode.baseP` to the draft's commit, so every read and the proposal use it and T0.2's question
    names files main changed since. The draft is applied all or nothing; undo starts empty. Later keeps the draft and
    writes nothing over it this session; Discard asks again, then deletes.
  - No IndexedDB (private window, blocked storage): the Studio works and the top bar shows "⚠ Not kept if the tab
    closes".
- **check-studio-github.py `drafts_checks`** (`--only=drafts`): restore of a data, a rig and a picture edit after
  `page.close()`; the restored draft proposes all four files and the draft goes; a failed proposal keeps it; main
  moved (the question says so, every read at the draft's commit, Propose names meta.json); Later; Discard; a browser
  without IndexedDB. With the restore turned off it reports 6 problems; as committed, 0.
- **T1.6.**
  - check-data: a `_` key in a data file listed by index.json is an error (F7). The rule is the first function of
    `game/js/logic/data-checks.js`, T1.3's module (2 unit tests; it is on the Studio page so the page lint test is
    happy).
  - TESTING.md: the unit tier is 628 tests in about 42 s here, over its 30 s budget.
  - ESLint now lints `tools/*.mjs` with the unit tests' rules: 0 findings, so no code changed.
- Docs: STUDIO.md "Unsent changes are kept in this browser", CHANGELOG.

**Where the plan doc was wrong or short**
- "Mirrors the ledger": there is no ledger since Phase 0; the draft is built from the same per-file diff Propose uses.
- "Different base: restore with the overlap warning" would put back main's older text in the shared files; restoring at
  the draft's commit avoids that (owner approved).
- T1.2's acceptance uses `fullMB`, which studio-test.js computes as `snapMB x 80` (an estimate). Session B must make
  it a measurement first. `updateTopBar` also stringifies the whole model on every call (`last === snapshot()`).
- T1.4: `check-quick.py --studio` needs `start-studio.py`, which is not in the repository.
- T1.6 `_` keys: only schema/ (`_help`) and legacy/README.json (`_world`) have them, neither listed in index.json.

**Verified**
- Unit tests 628 pass; lint, typecheck, `check:modules`, `format:check`, `check:data`.
- `check-studio-github.py --only=publish`: 0 problems (Phase 0's regression check). `--only=drafts`: 0 problems.
- A planted `_planted` key in meta.json: check-data names it.
- `check:fast`: 25 of 25 pass.
- `check-studio-github.py --only=sections,studio_test,publish,drafts`: 27 sections open, publish 0, drafts 0 (a write
  took 63 ms in that run). One problem: "the edit in rules did not come back with undo", the plan's F14, which Phase 0
  also saw on unchanged main; session B (T1.5) hunts it.
- **Not run:** the full quick check (planned at the end of Phase 1, session D) and the full chain of
  `check-studio-github.py` (it stalls at the story preview in this container, as noted in Phase 0).

**Risky**
- **Cost of a write.** A draft write takes 84-208 ms in headless Chromium here (stringify, split and format of the
  data, then IndexedDB), once per pause in editing. On a phone it may be a visible hitch. Measure on the iPad.
- **Two Studio tabs** on the same browser share one draft: the last to write wins. Each tab's own memory is unaffected.
- **Proposals add up.** After a proposal the data still differs from the loaded commit; an undo marks it unsaved and
  the draft then keeps those files too (as the next proposal would send them).
- **Not tested on a real phone or a real GitHub** (stand-in only). Manual check: edit, close the tab, reopen.

**Next**
- Session B: T1.2 (undo per file; first make `fullMB` a measurement) and T1.5 (F14).
- Owner decisions still open for C/D: T1.3 which Studio errors may block Propose (recommended: only what CI fails on);
  T1.4 CI time (recommended: yes); local mode and `--studio` (recommended: drop).

### Studio plan Phase 0 - Reliability and data safety on publish - 2026-10-22
Branch `ccr-81011a25-lf3exv`, PR #131. The PR also carries the plan itself,
`docs/plans/studio-roguelite-improvement-plan.md`: a review of the Studio at 5a30303d with Phases 0-6 and tickets.
The plan was approved in Plan Mode as written: tickets T0.1-T0.4 with a smaller design than the plan doc's "ledger".

**Changed** (one cause per commit; the test came first and failed on the old code):
- **check-studio-github.py `publish_checks`.** It runs on its own page with an injectable stand-in, after the main
  flow, or alone with `--only=publish`. The cases:
  - a 502 at blobs, trees, commits, refs and pulls (retry);
  - a proposal that can't be built;
  - a held send (a second Ctrl+S, and an edit made meanwhile);
  - every read at the loaded commit;
  - main moved on, sharing a file or not;
  - branch reuse and branch names;
  - a 401, with cancel or with a new token.

  On the old code it reported **14 problems**: art and rigs dropped after every failure, and a partial proposal sent.
  Now it reports 0.
- **`game/js/logic/publish-plan.js`** (4 unit tests): `publishConfirm`, `publishEmpty`, `publishOverlap`,
  `publishBranchName`.
- **`studio/js/studio-app.js`.** `saveAll` is now `checkBeforeSave` → `stageChanges` → `writeStaged` → `confirmStaged`:
  - Nothing is marked saved before the server answers.
  - Then only what is unchanged is marked saved: pictures are matched by `c._ver`, which `markArt` already bumps;
    data and rigs by their text.
  - `meta.artVersion` goes up in the sent text and is set in `D` on confirm.
- **`studio/js/github.js`.**
  - **One proposal at a time.** The batch is built whole before anything is sent; an error sends nothing.
  - **Pinned reads.** Everything is read at the commit main was on when the Studio loaded (`githubBase`), including
    rigs-next.js, which used to come from the deployed page and was then written back whole.
  - **Pinned proposal.** The proposal's parent is that commit. If main changed files the proposal also writes, a
    question names them (Propose anyway / Cancel).
  - **Branches.** Names are `studio/<login>-<date>-<time>-<4 letters>`. A branch left by a failed pull request is
    reused (PATCH), and a 422 on pulls finds the PR that is already open.
  - **Expired sign-in.** A 401 opens the sign-in card (now with Cancel) over the Studio, then resends the same
    changes. A new token replaces an expired one kept in the other browser store.
- **Docs.**
  - STUDIO.md: "Propose changes: what it does, and what happens when it fails".
  - Local mode is marked "not in this repository", in STUDIO.md and in the Studio's load-error text.
  - CHANGELOG.

**Where the plan doc was wrong or short**
- `artDirty` is read in about 12 places as "the unsaved picture", so it stays. The ledger became a stage plus a
  confirm-by-version-or-text.
- The local-mode path could not be tested: there is no server in the repository.

**Verified**
- Unit tests: 622 pass.
- lint, typecheck, `check:modules`, `format:check`.
- `check-studio-github.py --only=publish`: 0 problems.
- `check:fast`: 25 of 25 pass.
- The full `check-studio-github.py` stopped in `story_steps`:
  - First at `#scStoryOn`, then at the "Play from here" click.
  - The same step fails on unchanged origin/main in this container, at the wait for the game's tab. This is the known
    stall noted beside `--only`, not this phase.
  - Every other step was run with `--only`:
    - The publish checks, the UI steps, the uiTheme proposal and the self-test's restore all pass.
    - Two problems, both also on origin/main:
      - free camera "the ground under the pointer moved"; origin/main fails the same step alone in this container;
      - the self-test's Rules edit not coming back with undo. That is the plan's F14, seen on main during the review;
        the plan's T1.5 tracks it.
- **Not run:** the full quick check. It was stopped at the owner's word, so the next session starts without waiting
  for it.

**Risky**
- **Undo and confirm.** Undoing a change after it was proposed marks it unsaved again, as before; that is fine. A
  restore (undo) during a send can make data differ from the sent text, so it stays unsaved: the safe direction.
- **New requests.** GitHub mode now makes one extra request at load (the ref) and one or two at proposal time (the
  ref, and compare when main moved).
- **Tested only against the stand-in.** The API paths used are GitHub's documented ones: `git/ref/heads`,
  `compare/a...b`, `PATCH git/refs/heads/<branch>`, `pulls?head=owner:branch`. One real proposal from the Pages Studio
  is the owner's check.

**Next**
- Phase 1 (T1.1 drafts in IndexedDB first; then T1.2 undo per file, T1.3 shared checks, T1.4 Studio checks in CI).
- Tag `sr-0-done` is the owner's.

### Island track IS-6b - Hub editor dials - 2026-10-22
Branch `claude/is-6b-hub-dials`, from the wave-2 base `claude/new-session-3qlesh` (main plus IS-2, IS-3, IS-4 and IS-6a,
PRs #122, #124, #123, #126, not merged yet); the PR goes against main, so its diff shrinks as those merge (then merge
main into the branch). Ran beside IS-5 (copperleaf.json) and IS-7 (the world map): Studio files only, plus
logic/hub-island.js, the pages' script lists and check-fast. Plan approved in Plan Mode with the recommended answers:
the draft made on the page (not in a worker), a locked ground's dials read-only, props at sea named not moved, no
"new island" button.
- Changed (one cause per commit):
  - **island-gen.js moved** from the game's page to the Studio's, after mapgen.js (IS-2's suggestion; the game never
    calls it: only build-island.mjs, its unit test and now the Studio do).
  - **logic/hub-island.js** (5 new unit tests): `hubGenStart` (the map's own islandGen dials and seed, a copy; else
    the defaults and the map's id), `hubGenRefusal` (no coast, or a locked ground), `hubUseIsland` (copies
    `HUB_GEN_GROUND`: size, sea fields, island, zones, islandGen, hub, tiles, heights, plots, streams, bridges, spots,
    steps; a field the draft lacks goes; the orbit's pivot follows, its dead zone, lag and turn stay; returns the
    props now past the coast), `hubGenWalkProblems` (IS-2's walking checks: every zone, the summit, the dock, every
    plot's front from the hub; no traps), `hubGenStats`. It imports mapgen.js now, so it loads after island-gen.js
    on the Studio's page.
  - **The Dials card** (studio/js/hub-island.js): every generator dial in folding groups (↺ and Reset), the flat zones
    and the beach and cliff arcs as rows, a seed (typed or 🎲) and a 🎲 per stage (Alt-click clears it). A draft is
    made 0.5 s after a dial stops ("Generating…" first), shown in the orbit view as `_hubgen` (walkData chained, as
    Walk scenes' `_gen` draft) and on the map; its figures, the generator's notes, the island's own problems and a
    "Check the walks" button. The map's tools are off while a draft shows (it isn't the map). **Use this island**: one
    undo step, refused while locked (the button isn't offered and the logic throws); the toast names props now at sea
    and says the map's in-game checks were written for the old ground. A locked ground opens its dials read-only and
    makes no draft. Picking another map drops the draft; a draft finishing after the section is left draws nothing.
  - **check-fast**: "The Studio's Hub island dials" on IS-6a's page, after its step (it loads the Studio itself when
    run alone).
  - Docs: STUDIO.md (the Hub island part, the table row), the track file ("Done in IS-6b"), CHANGELOG.
- Where the plan (the track file) was wrong or short:
  - The dials listed were a third of the generator's; all are shown.
  - "Live preview": one island is 1.75 s in Node, 2.5-3.6 s in the headless browser (copperleaf_island's own dials:
    2.5 s), and the walk check another 1.2 s, so the draft comes after the dial stops and the walk check is a button.
  - **A new seed often doesn't fit.** With a previous map the generator keeps its middle (so nothing on the map
    moves) and grows the scene east and north only; a coast that would cross the west or south edge throws. 5 of 12
    whole new seeds fit round copperleaf_island's middle (a larger open sea makes it worse: 0 of 12 at 20 m); a stage's
    own seed fitted for coast, land, mountain, paths and ground once each, but a random one can miss too. The card
    says so with what to try. test_island (120 m) only takes islands of about 30 m radius.
  - **Small islands make a forest zone that crosses itself** (island-gen.js, radius ~30 m, every seed tried): the
    draft lists it and Lock the ground refuses it until the zone's points are moved. Not fixed (IS-2's file).
- Verified: unit tests 604 (5 new); lint, typecheck, check:modules, format:check; check-fast's Hub island steps (IS-6a
  and IS-6b) pass; headless pictures at 1600 x 1000 (copperleaf_island: its own dials give back its tiles exactly,
  the draft drawn, a mountain reroll). check-fast 24 of 24; smoke no problems; full quick check (40 min): 10 problems, the
  9 old ones on main (roster counts 117/61, empty voxel bushes, buildings without a plan, the biped walk cycle, the
  running step's "float division by zero"; see IS-6a's entry) and RL-8's run (Meadow Town's view never showed) while
  other browser checks ran beside it; RL-8 alone passes on the merged branch. After merging main (IS-7 and the rest):
  unit tests 614, lint, typecheck, modules, format, check-data, both Hub island steps pass.
- Risky:
  - The page pauses 2-4 s while a draft is made (no worker). Fine on a desktop; slow on a phone.
  - "Use this island" leaves the map's in-game `checks` (copperleaf_island's walking legs from build-island) as they
    were: they can fail on the new ground. Rerun tools/build-island.mjs, or edit them, before relying on them.
  - The draft rides walkData through an Object.create view, like Walk scenes' draft. The prop editor's wrapper copies
    own keys only; with a prop open in Walk scenes and a draft here, the hub view would still find its draft.
  - Props past a new coast stay in the sea until moved (named in the toast).
- Not done: a new island from the dials (a new map id); shifting the scene so any seed fits; copperleaf (no coast
  until IS-5).
- Next: IS-5 makes copperleaf the island (then its dials open here); the generator's "doesn't fit" and the small
  forest zone are IS-2 follow-ups. Tag `is-6b-done` is the owner's.

### Island track IS-5 - Copperleaf moves onto the island - 2026-10-22
Branch `claude/is-5-copperleaf-island`, from the wave-2 base `claude/new-session-3qlesh` (main with IS-0, IS-1 merged
plus IS-2, IS-3, IS-4, IS-6a merged in; PRs #122, #124, #123, #126 not in main yet). PR against main; main gets merged
in when those land. Wave 2 beside IS-6b (the editor's dials) and IS-7 (the world map's island). Plan approved in Plan
Mode with the owner's answers: the fall lands in the **town square** (question 11); the shop plot gets the **General
store, closed**; **cottages on every house plot** and the farmhouse plot; **gardens travel with their houses**, free
nature left to IS-9; **rooms face four ways**; **wild grass in patches** by the woods and on the heath. Question 4 is
moot (the generator lays the town out).
- Changed (one cause per commit):
  - **findPath's budget** grows with the map (`max(30000, the nav grid's cells)`): the island is ~220,000 cells; the
    old cap stopped a tap a third of the way across. Every other map is under 30000, so unchanged.
  - **Rooms that face four ways** (logic/room-turn.js, unit-tested): a room is made in its own metres as before
    (door south, back wall +z), then its tiles, heights, step grid, floor scene and things are turned by quarter turns
    about a point on whole metres by the door and stamped in; the view keeps `roomFrame {q, p, rect}`. Readers:
    rooms.js (box, lamps, window light, front cut), the ground shader (`uRoomT`: skirting, corner trim, wall shading),
    the room's walking margins (walk-view.js), the camera (base yaw `roomYaw`; in and out the base yaw eases the short
    way over 0.7 s of wall time instead of jumping; this also smooths going from the orbit into a south room),
    walk-control.js (walk in and out along the door's own way; the door array gains `[q, middle z]` for a turned
    building, so a south door's id is unchanged), self-test's room step (doorway along the front, the way out).
  - **Island generator stage `wild`** (version 3, dial `wild.n` 5): ragged tall-grass ovals of 15-70 m² on open meadow
    and heath with a fifth of forest or heath within 9 m, 8 m clear of the town, hamlet, barn and pasture, never on the
    beach, mountain, a path or a slope; written as `grassPatches`, so encounters use the run maps' patch rule (they
    waited within 13 m of the hub: the square). Own seed stream; only 174 cells of the island changed.
  - **tools/build-copperleaf.mjs** (new, rerunnable) and **tools/data/copperleaf-town.json** (the old town as it stood:
    props, people, life, chat, place fields, the opening's spots and shots). Each building in the middle of its plot,
    `rot = a + 90`: lab, airship station + airship (mast), Juniper's home, the General store (no act), the well, the
    five cottages on the town house plots nearest the square, 14 more cottages in turn on the other house plots and
    the farmhouse plot; the barn in its zone, doors toward the farmhouse, its crops with it. A building's garden moves
    in its own metres (models turn with it, pictures keep facing you); what lands on a street (`p v c`), water, a
    bridge, another plot or before a door is left out (25). The great oak with its swing (the world map's landmark) on
    open ground nearest the square, 8 town trees. A pier from the dock spot along the channel. Juniper by her door;
    npcSpots at the lab, mast, square, shop, home; life in areas (ducks pond, chickens farmhouse, rabbits pasture,
    squirrels forest, cats town). The opening's spots, shots and stage move and turn with the lab's door. A walking
    check that ended inside a building (the barn zone's middle) ends at its door.
  - **The swap**: `copperleaf.json` is the island with the town (235 x 237 m, 25 buildings, 127 props, 7 bridges);
    `copperleaf_island` is gone. build-island.mjs makes the hub's ground by default and keeps a place's own fields and
    their order (a rerun that changes nothing writes nothing; then rerun build-copperleaf to follow new plots).
  - **Re-pointed**: island-gen.test reads `copperleaf` (the pier left out); `standByMast` turns with the station; the
    hub's view carries `island` and `zones` (the sea's middle, the cove's calm); check-quick's opening stage, room
    doorway and lab-room checks work in the building's frame, its v42 "grown" check leaves out a generated island;
    check-fast's new step "Copperleaf is the island" (walking checks, every door a tap from the square, wild spots in
    the patches, the orbit); postcards look at the square; the Hub island editor's view-only words.
- Where the plan (the track file) was wrong or short: see the track file's "Checked in IS-5". Mine: the turned rooms
  were more than "a third of the session" (the room's front cut, window light, lamps and the ground shader all assumed
  a south door); a south-facing room was proven unchanged field by field (all 8 of the old Copperleaf's rooms, step
  grids and floors, against the base). Juniper's lavender garden (10 m behind her old cottage) mostly didn't fit her
  plot: the plot is 7.5 x 6.2 m among streets.
- Verified: unit tests 603; lint, typecheck, check:modules, format:check, check:data (144 files); both tools rerun to
  the identical file; check-fast 22 of 23 on the full run (the Studio world-map look wanted the great oak: fixed; that step and the new hub step pass alone); smoke 15 of 15 (New game: the fall, Hazel, the starters on the
  square); check-fast 24 of 24 after the ground-build fixes (CI green); full quick check: besides the
  failures main has too (roster counts, biped walk, voxel bushes, buildings without plans, the props scene), two
  findings: (1) "shaped terraces change where you can walk: copperleaf": 5,979 half-metre cells (all on the mountain's
  shelves off the trail) are reachable with unrounded terraces but not rounded ones; the trail, summit and every zone
  stay reachable (the island's walking checks pass); IS-2's mountain meeting the engine's terrace rounding, left open
  for the owner (terrain); (2) after that step runs in the same page, RL-7's and RL-8's first road walk on a run start
  from the hub's spot (off the landing's map: "no path to the exit"), and the mast and postcard steps after them
  fail in turn; RL-7 + RL-8 together, and RL-7 alone, pass, so it is something the terrace step leaves on the page
  with the big hub; not found yet. Headless: the lab, a cottage, Juniper's home and the barn turned each of
  the four ways (doorway 0.02 m from the door, nothing walkable outside, pictures squared to the camera); pictures of
  the square from four sides, the barn and pasture, the pier, the hamlet, the island from above. Longest tap search on
  the island headless: 18 ms.
- Risky:
  - Turned rooms are new everywhere a building faces away from south (all of the island's but a few). Worth a feel on
    the phone: going into the lab (it faces west) and out, the camera's turn in and out.
  - The hub is 1.2 MB (was 73 KB) and loads at boot; phone frame times are IS-9's.
  - A tap to an unreachable spot now searches the whole reachable island (~220k cells) before giving up.
  - Rerunning build-copperleaf rewrites every prop: hand edits to Copperleaf's props in the Studio are lost unless
    folded into tools/data/copperleaf-town.json or the tool. After the owner places things by hand, stop rerunning it.
  - The orbit's pivot in the hub's view isn't shifted by the view's offset (0 for an island with no neighbours).
  - The first frame on the hub builds the whole island's ground mesh at once: ~6.7 s headless after the fixes (was
    13 s; the old town ~7 s with shader compiles). On a phone it is a boot hitch to measure (IS-9).
  - check-quick v31 now waits for frames in rooms and starts the bowl camera check from Home.
- For the sessions alongside: **IS-6b**: "Use this island" must keep the hub's town (build-island.mjs's `GROUND` list
  is the split; then build-copperleaf.mjs re-places the town on new plots); hub-island.js only had its view-only
  words changed. **IS-7**: the town's buildings are props now (`plots` stay). **IS-8**: the barn stands in its zone,
  doors east toward the farmhouse; the pasture zone is free. **IS-9**: 357 old props belonged to no building and
  were not brought over (the old meadow's flowers, trees, reeds); the island needs dressing.
- Next: IS-8 (after RL-10), IS-9. Tag `is-5-done` is the owner's to push.


### Island track IS-7 - The world map's island - 2026-10-22
Branch `claude/is-7-world-map-island`, from the wave-2 base `claude/new-session-3qlesh` (fcda361: main with IS-0 and
IS-1, plus the IS-2, IS-3, IS-4 and IS-6a branches, PRs #122, #124, #123, #126, not merged yet); the PR goes against
main and shrinks once those merge (merge main in then). Ran beside IS-6b (the Studio's dials). Plan approved in Plan
Mode; its three "ask me" items went with the recommendations: the island at its true size, its relief lifted x3 like
the bowl's buildings and trees, the buildings at the usual 3x.
- Changed (one cause per commit):
  - **logic/bowl.js**: a place whose map has `island.coast` keeps exactly that coast on the bowl (`bowlIslandPoly`,
    `bowlPolyDistance`): land inside, sea outside, no coast noise, the map's own sea stays sea, no `sea.island` round
    round it (`bowlIsles` gives `[]`: still an island world). With `heightOf` its ground's own heights replace the
    bump of its kind and the hills between places (`BOWL_ISLAND_LIFT` 3, `BOWL_ISLAND_BASE` 0.004). Out to 80 m the
    coast's distance is read exactly (the box's distance from 30 m out made a square in the water's depth).
  - **logic/bowl-island.js** (new, game page after bowl-things.js): `bowlIslandMapId` (the map by its fields: the
    place's own when it has a coast; else for the hub, world node 0, the biggest map with a coast and plots, so
    `copperleaf_island` now and `copperleaf` after IS-5's rename, never `test_island`); `bowlIslandHeights` (smooth
    land plus step raises, every 2 m); `bowlIslandRadius`; `bowlIslandPlotThings` (a model per plot kind,
    `BOWL_PLOT_PROPS`, turned to face where the plot does, and the barn in its zone; skipped where a building or a
    prop of the plot's kinds stands).
  - **world-bowl.js**: every read of a place's map goes through the resolver (the sea input, the route mask, the
    stamps, the things, the clumps); the island's file is fetched once (not during a run) and the ground worked out
    again with its heights (`worldBowlReset`); stamped only where the bowl has land; plot models drawn; the landmark
    still from copperleaf.json; `ground.islandMap` names the map drawn.
  - **worldmap.json** `sea.island` 0.2 to **0.12** (the coast reaches 120 m from `island.c`); a unit test keeps it
    within 10% of the coast's reach. The schema's description says so.
  - **The World map test** (Bowl map test) step "The hub's island": 24 points round the coast, land 12 m in and sea
    12 m out; the highest ground drawn where it is (24.9 m, drawn 23.6 m); a model on every free plot; ground laid on.
  - Checks changed on purpose: no bowl river is made on an island drawn from its map (its stream is its own), so the
    fast check's and the World map test's river count want 0 there (1 on an island world without one, 4 elsewhere).
- Where the plan or the docs were wrong: phase 10's "1.5 m a pixel" ground is ~1 m (2048 pixels over 2000 m); the
  camera's zoom limit stays (the plan offered distMin 0.45 to 0.3: at 0.45 the island already fills a phone's width
  and the town reads, pictures in the PR); `test_island` does have `islandGen` (no seed, no plots). Also the well and
  the airship station never showed on the bowl (not "buildings" by bowl-things.js's rule); on the plots they do.
- Not touched (other sessions own them): copperleaf.json (IS-5), the Studio (IS-6b; its World map look's Island
  dial help still says "0.2 is 200 m", still true), walk/camera.js, the sea and sky, prop data and art, mapgen.js.
- Verified: unit tests 609 (bowl-island.test.mjs new, 10 tests; a planted fault in the resolver seen to fail), lint,
  typecheck, check:modules, check:data (145 files), format; check-fast's world map check (with the run's world beside
  it); the in-game World map test headless: every step passes but "The Map tab opens" (9 frames in 4 s: software
  drawing at ~3 fps; the base fcda361 fails it the same way), the new step "copperleaf_island: its coast (240
  points; 48 land and sea checks hold), its top 24.9 m drawn 23.6 m (x3), 25 plot buildings"; pictures at 390 x 760
  (home, close, close from above, the whole bowl). The whole fast check 23 of 23. Smoke: one problem, the in-game
  full test's step timing out at 60 s on a slow run (the Studio step took 94 s in the same run); run alone it passes
  here (65 s) as on the base (57 s).
- Risky:
  - **The fetch**: the island's file (1.2 MB, 52 KB gzipped) is fetched when the map first opens if `loadAllMaps`
    hasn't brought it yet, and the ground is worked out a second time (headless ~200-260 ms, the hub's before 160-210).
    The outline is right from the first frame; the mountain and the ground come a moment later.
  - **Size on screen**: at true size the island is about half the old round blob; the home view shows it with a lot
    of sea. If the phone says it's too small, the fix is the home view's zoom for the hub, not a bigger island.
  - **The town at 3x on its plots**: the plots are laid out for buildings at 1x, so at 3x the houses stand close; in
    the headless pictures they read as separate buildings. One number (`BOWL_THING_SCALE`, shared with every place)
    if the phone shows them crowded.
  - **IS-5**: when the town's buildings become props on the plots, the plot models step aside by themselves (tested);
    the barn's zone model too once a barn prop stands within 20 m of the zone's middle. After the rename the resolver
    takes copperleaf by its own coast; nothing here names an id. `sea.island` must follow any reshaping (the test says).
  - Headless the landmark (the oak) is still the red block seen since RL-7 (its picture not loaded): look on the phone.
- For the sessions alongside: **IS-5** see above; **IS-6b**: a reshaped island trips the `sea.island` unit test on
  purpose (set it to the coast's reach / 1000); the Studio's World map look could show that number next to its dial.
- Next: the owner's phone look (the Map tab in Copperleaf, zoomed out and in; the Bowl map test from the debug menu;
  export the debug log); tag `is-7-done` is the owner's to push. Then IS-8 and IS-9 (wave 3).

### Island track IS-2 - Island ground generator - 2026-10-22
Branch `claude/is-2-island-gen`, from IS-0's `claude/new-session-3qlesh` (PR #119, not merged yet: the owner started
wave 1 before `is-0-done`); the PR goes against main, so its diff shrinks once #119 merges. The session grew with the
owner's direction: a natural layout, five direction sketches (scratch, not committed), then the town in the generator. Wave 1 ran alongside: IS-1
(orbit camera), IS-3 (sea), IS-4 (island props), IS-6a (the Hub island editor). Plan approved in Plan Mode with the
owner's answers: question 1 ~150 m (the town and barn fit as they are), 6 a dock landing and a deep channel, 7 the
mountain climbable, 9 the stream with a pond; 10 was answered before (reusable).
- Changed (one cause per commit):
  - **logic/island-gen.js** (new; on the game page after island.js, see "Risky"): `islandGenerate(dials, seed, ctx,
    prev)` returns `{ scene, notes, paths }`. Pure, seeded (each stage its own stream; `dials.seeds[stage]` rerolls one
    stage), Node-runnable. `ISLAND_GEN_DEFAULTS` (the dials IS-6b shows: size, mountain, hills, cove, shore,
    beaches, cliffs, dunes, heath, forest, stream, paths, zones, level, seeds), `islandGenDials` (fills in and
    clamps), `islandZoneRect`, `ISLAND_GEN_STAGES`, `ISLAND_GEN_BUILT` (town, barn, pasture). Nothing Copperleaf's in
    it: the town, barn and pasture are dial-placed rectangles (angle, distance, width, depth) turned to face out.
  - The stages: the coast (a radius per degree with noise, pushed out round every flat zone, the cove cut in), the
    heights (beaches, hills, foot hills, cliffs with a 2.2 m face, the zones flat with a 7 m blend), the mountain
    (TR-2's smooth quarter plus step-grid shelves, a flat top 3.5 m round), the water (the sea past the coast, a
    pond at the mountain's foot, a stream to one side of the cove's back with a small fall, the cove's deep channel
    out from the dock), the paths (a loop round the coast inland of the beach, spokes from each flat zone to it,
    from the town up to the mountain's foot, from the loop to the dock; a wooden bridge where a path crosses water;
    mapgen's road flattening), TR-2b's trail from the mountain spoke to a summit lookout, the built zones made level
    again, the terrain kinds (see the track file's "Checked in IS-2"), the shelves' rock edges, the water lowered
    under its banks. Spots for the later sessions: `summit`, `dock` (the landing, IS-4's dock runs out from it),
    `pond`, `fall`.
  - **Locks**: a map whose `islandGen.lock` is set is refused (throws; the tool exits). With `prev`, its locked zones
    keep their polygons, ground letters, corner heights and steps exactly, and the scene keeps its middle (and grows
    only if the coast needs it); a kept zone's surroundings blend to its own level.
  - **tools/build-island.mjs** (new): writes `game/data/maps/copperleaf_island.json` through write-data.mjs: the map's
    own dials and seed when it exists (default seed "copperleaf"), `--seed`, `--dials file.json`, `--id`, `--fresh`
    (drop the kept zones). Copperleaf's look; a test map (`kind: test`, `test: 1`) until IS-5. The walking checks for
    the in-game test. Prints the size, the lap and the notes.
  - **A natural layout** (the owner, mid-session: "make the layout and terrain more natural and dynamic"; generator
    version 2): a new dial `organic` (0-1, default 0.7; 0 gives plain geometry back: round coast, rectangles, a cone,
    straight spokes). Rounded, uneven zones round the dial's rectangle (the rectangle always fits inside; zones that meet
    are turned apart round the island, the biggest stays); headlands and bays on a warped coast; warped hills and a few
    knolls, uneven cliffs; the mountain a massif along a ridge kept clear of the biggest zone and the cove
    (`mountain.stretch`, `mountain.shoulder`), its peak a little off the middle, a shoulder peak, shelf edges that
    wander instead of rings, a 5 m apron of open ground between it and any zone; curved spokes, a loop that wanders;
    ragged arc edges, groves and clearings, rock outcrops, lush moss and clover by the pond and stream, more meadow kinds.
  - **A more dynamic island** (the owner, after five direction sketches; dials `size.stretch`, `size.lobes`,
    `mountain.range`, `cove.shape`, `paths.wander`): a longer island with big lobes and a peninsula; spurs running out
    from the mountain; the cove a wide bay with a headland on each arm; the coast road across headlands and inland.
  - **The town in the generator** (the owner chose a mix of the sketches C, D and E and approved the plan; question 1
    re-answered: ~220 m): a market town where the stream comes down into the bay: the main street along one bank, a
    paved square with a bridge for the cross street, an east-bank street and a lower bridge, the quay, side lanes,
    links to the coast road. **Plots** facing their streets: the well and the lab at the square, the airship station
    by the harbour (else any town street), the shop, Juniper's home, houses, cottages where a house won't go; each on a
    level pad at its street's height, eased into the land over 3 m; the rest of the town keeps its slopes. A **hamlet**
    (4 houses round a green under the mountains, 70 m or more from the town) and a **farmhouse** by the barn. The town
    and hamlet zones are outlines (the town's the hull round its streets, plots and links), locked. A rerun that keeps
    them reproduces the map exactly: their plots, bridges and the `trailhead` spot come through, and they join the zone
    list at the end as new ones do. The old flat town is still there when the dials ask for a town rectangle.
  - **The contract grew** (additions only): zone kind `hamlet`; the map field `plots [{ k, x, z, w, d, a, y }]` (k:
    house, home, lab, mast, shop, well, farmhouse; a the angle the front faces, y the pad's level), in the schema, the
    types and `islandProblems`; contract tests with three planted plot faults.
  - **build-island**: `--defaults`; the in-game checks walk in legs of about 40 m along the way the walk grid finds
    (the game's findPath gives up after 30000 cells), each leg checked by the game.
  - **copperleaf_island** (new data, index.json's maps list): 235 x 237 m scene, land 213 x 216 m, the coast loop 580 m
    (170 s walking), 6 bridges, 14 town houses, 4 in the hamlet; `cam.orbit` pivot on the summit, `dead` 3, `lag` 0.6, `turn` 30 (IS-1 tunes them);
    `edge: "w"`, `waterKind: "sea"`, `far: "sea"`, `farH` 5, `flatFar` 1 (IS-3's skirt); no props (IS-4, IS-9).
- Where the plan (the track file) was wrong or short: see the track file's "Checked in IS-2" (the town didn't fit
  135 m; the lap is ~139 s, not ~90 or the ~105 I estimated in the plan; the sharp peak blocked every trail; findPath's
  30000-cell cap; a new game/js file has to be on a page; the terrain kinds without a letter). Also: CLAUDE.md's
  `gamedata.js` gotcha still holds (it is built from the data files by tools/build-data.mjs and ignored by git).
- Verified: unit tests 575 (8 new in island-gen.test.mjs, each with a planted fault seen to fail); lint, typecheck,
  check:modules, format:check, check:data (144 files); 24 seeds (s0-s23) each pass the contract, reach the summit and
  the dock, have no traps, every zone reached, one bridge, the town's path to the mountain, no notes; in a headless game
  `?test=1&scene=copperleaf_island` opens and draws with no page errors and its 7 walking checks hold; pictures at
  390 x 760 (the trail's stairs on the shelves; the coast barely reads under today's camera and haze). On version 1:
  check-fast 22 of 22; smoke one problem, the bridge's jetty flag (fixed in version 2). Version 2: check-fast 22 of 22,
  smoke no problems. With the town: unit tests 575; 24 seeds each place the well, lab, airship station, shop, home and
  farmhouse with 5-11 houses (plus the hamlet's), every plot's front walked to, every zone reached, no traps; the
  game's 21 walking legs hold headless; check-fast and smoke: see the PR.
- Risky:
  - **findPath's cap**: tap-to-walk from the town to the summit (102 m) fails with the default 30000 cells; the
    joystick isn't affected. When `copperleaf_island` becomes the hub (IS-5), long taps across it will stop short.
  - **On the game page**: island-gen.js loads in the game (about 57 KB, unused there) because every game/js file must
    be on a page; IS-6b can move it to the Studio's page (then the unit test's crawl reaches it from there).
  - **The size** (the owner's ~220 m): 1.2 MB (52 KB gzipped; Copperleaf's 73 KB, 14 KB gzipped), about 8.5 times
    Copperleaf's ground; the steps grid is stored whole. `loadAllMaps` fetches it in the background after boot. The
    phone's frame times are IS-9's to measure; the fallback is a smaller `size.r`.
  - **A kept town under a new seed**: its ground comes back exactly, but the new river or coast road may meet it at
    another place (a seam at its outline). IS-6b's preview should show the walk checks after a rerun.
  - The lock compares exact numbers: a later generator version (ISLAND_GEN_VERSION 2) changes unlocked ground freely;
    a locked one is never touched.
  - The coast in the headless pictures barely reads under today's fixed north camera and the haze; the orbit (IS-1)
    and the sea (IS-3) are what make it an island on screen.
- For the sessions alongside:
  - **IS-1**: test on `?test=1&scene=copperleaf_island` too; the pivot is the summit spot, the island's middle
    `island.c` is within a few metres.
  - **IS-3**: the map carries the coast biome's sea fields; the cove's water is shallow (`w`) except its channel.
  - **IS-4**: the spots `dock` (a landing at the waterline facing the cove), `summit` (the lookout's pocket, 2.5 m
    round), `pond`, `fall`; `test_props_island` stays yours.
  - **IS-6a/6b**: `islandGenerate(dials, seed, { scenery }, prev)` is the call; it throws on a locked ground; `notes`
    say what didn't fit; `paths` are the loop and spokes as lines. The defaults' `zones` are dial rectangles; a kept
    (locked) zone in `prev` wins over its dial.
  - **IS-5**: its job changes: put Copperleaf's buildings on the plots (`plots`: the lab, the airship station on
    `mast`, Juniper's home, the shop, the well; cottages on `house`), the barn in the barn zone, the people and life in
    the town; the hub is by the well. The town is no longer one flat box, so a building's footprint must stay on its
    plot (pads are level only there).
  - **IS-4**: the spots `trailhead`, plus a well and a farmhouse are wanted (plot kinds).
  - **IS-7**: the world map can draw the plots as the town's buildings until IS-5 places them.
- Next: IS-5 (needs IS-1 and IS-2) and IS-6b, IS-7 (need IS-2). Tag `is-2-done` is the owner's to push (after
  `is-0-done`).

### Island track IS-6a - Hub island editor - 2026-10-22
Branch `claude/is-6a-hub-island-editor`, made from IS-0's branch `claude/new-session-3qlesh` (PR #119, not merged yet;
the owner asked to start wave 1 before `is-0-done`), PR against main (its diff shrinks once #119 merges). Ran beside
IS-1..IS-4; kept to Studio files plus the guard in map-editor.js. Plan approved in Plan Mode with the owner's four
answers: Walk the coast under the game's own walk camera; props only in Walk scenes; Copperleaf view-only until IS-5;
the coast hand-editable.
- Changed (one cause per commit):
  - **map-editor.js, no behaviour change**: `paintGroundBrush` (the round ground brush, out of bindEditorMap) and
    `sculptHeights(sc, m, o)` taking its settings; Walk scenes passes its own.
  - **game/js/logic/hub-island.js** (Studio page only; 9 unit tests): the orbit view's frame (the whole island from
    the south, `FREE_CAM`'s field of view), sides S/W/N/E (yaw 0 looks north, so the camera is south), a drag's turn
    and tilt; the coast's and zones' points (nearest, insert on the nearest edge including the closing one, move on
    the scene, remove never under three; a new zone a 12 m square); lock, unlock, `groundLockRefusal`; the maps listed
    (Copperleaf first, then every map with an island; view-only without a coast); `hubCoastLap`, the walk round.
    logic/island.js joins the Studio's page too.
  - **The Hub island section** (studio/js/hub-island.js; World & places after Walk scenes; left pane only, like the
    other 3D views): the orbit view (mountWalkView with its own `look`, the pointer caught before the walk view's as
    the free camera does: drag turns, Shift-drag or right button tilts, wheel or pinch zooms; Auto-orbit, S W N E,
    Whole island, Walk the coast); the map (each ground letter's average colour, heights with a 2 m contour, coast,
    zones by kind with locked ones hatched, pivot and dead zone, the island's middle, where the camera stands, on a
    layer of its own so it moves without redrawing the ground); tools Paint ground, Shape the land, Coast & zones
    (kind, lock, add, remove), Pivot (Shift-drag: the island's middle; the dead zone); the Ground lock card.
  - **The guard** in Walk scenes: on a locked island Paint, Fill, Shape the land, Cliffs & stairs, Curved road,
    Resize and Flatten refuse with the reason; the Map card says so. Props, water, exits stay free.
  - **The Studio's Check** lists `islandProblems` for every map (as check-data); "Show me" opens Hub island.
  - **check-fast**: "The Studio's Hub island", a Studio page of its own (see Verified).
  - **Fixes found reviewing the diff**: the height brush clamped every stroke to -8..12 m (Walk scenes' limit), which
    would cut test_island's 16 m peak (and IS-2's ~22 m one) to 12; its floor and ceiling are settings now, the hub
    editor -8..40 m, Walk scenes unchanged. Walk the coast's button resets after a walk that ended away.
  - **After merging main (IS-0, IS-1)**: IS-1's `orbitOf` is off whenever `walkView.opt.freeCam` is set, and the
    Studio sets it on every 3D preview (viewport.js), so Walk the coast still showed the fixed camera. The hub view
    takes the mark off while it walks (`hubWalkCamera`) and puts it back after; on test_island's east side the camera's
    yaw read -1.58 rad (looking west at the middle).
  - **CI's first run** failed the new step ("the orbit view never looked at the island"); reproduced locally with
    runs side by side: the island's frames take seconds each in headless software GL and come back to back, which
    starves the page timers that until() polls on (the camera was set a moment after the wait gave up). The step
    polls from Python now (`poll()` in check-fast) with drawing()'s waits; five runs side by side pass.
  - Docs: STUDIO.md (a Hub island section, the table row, the left-pane list), the track file ("Done in IS-6a"),
    CHANGELOG.
- Where the plan (the track file) was wrong or short:
  - "Walk the coast (IS-1's logic/camera-orbit.js once merged)": not needed. The game's walk camera reads the map's
    `cam.orbit`, so the walk shows IS-1's orbit (once the free-camera mark is off, above).
  - "one guard in map-editor.js": one helper, asked in seven places (the ground tools, Resize, Flatten); the Curved
    road (map-editor-tools.js) paints ground too. map-generate.js only makes new maps and needs none.
  - "the 2D map ... (map-editor.js's brush functions, exported, not copied)": the height brush read Walk scenes'
    settings and clamp; it takes them as an argument now (see Fixes).
  - Planned as three commits (section, map, lock bar); landed as one, since the section's card holds all three.
- Verified: unit tests 576 (9 new); lint, typecheck, check:modules, format:check; check-fast 23 of 23 (the new step
  67 s on a page of its own, beside the others; the island's 3D view draws about one frame in 3 s in headless
  software GL, so it is not on the other Studio checks' page); smoke: no problems (171 s); full quick check (39 min): 9 problems, the same 9 old steps
  that fail on main (roster counts 117/61, empty voxel bushes, buildings without a plan, the biped walk cycle, the
  running step's "float division by zero"; see RL-8b's and TR-2's entries), none in what this branch touches.
  Headless pictures at 1600 x 1000 (orbit from the south and the east, the map with zones and handles, locked,
  walking the coast, Copperleaf view-only): no page errors.
- Risky:
  - Walk scenes' own height brush still clamps to -8..12 m: one stroke on a TR-2 mountain (up to 20 m) or on the
    island's mountain in Walk scenes cuts it to 12 (pre-existing; left as it was; a one-line change if wanted).
  - The orbit view and Walk scenes share the one walk view; leaving the section mid-walk leaves the walker's route in
    place until the section is opened again.
  - Locking stores the hash of the ground as the Studio holds it; Save writes it. A hand edit of the file afterwards
    fails check-data, as intended.
  - hooks.js unchanged (317 names); a merge with IS-1..IS-4 can still need `npm run modules`.
- Not done: the dials and live preview (IS-6b, after IS-2); copperleaf editing (after IS-5).
- Next: IS-6b once IS-2 lands (the dials beside logic/hub-island.js; "Use this island" refused while locked: the
  check is `hubGroundLocked`). Tag `is-6a-done` is the owner's.

### Island track IS-4 - Island props (phase 09 batch 11's barn folded in) - 2026-10-22
Branch `claude/is-4-island-props`, from the IS-0 branch `claude/new-session-3qlesh` (PR #119, not merged yet; the
owner asked to start wave 1 before `is-0-done`). PR against main; its diff shrinks once #119 merges. Wave 1 beside
IS-1, IS-2, IS-3 and IS-6a. Plan approved in Plan Mode as proposed (defaults 1-5 taken). This session owns the prop
data and art; no map but the showcase is touched.
- Changed (one cause per commit; tools/build-props-island.py, rerunnable, in steps `new barn scree forest`):
  - **New props**, every one finished on every side for the orbit camera: pasture `fence_gate` (matches
    `fence_wood`, 2.2 m), `water_trough`, `hay_round`, `hay_feeder`; beach `driftwood` (3 shapes as variants),
    `shore_rocks` (3), `tidepool_rim`, `beach_grass` (flat on purpose: 4 forms, sways) and `shells` (a ground decal,
    3 forms); cove `fishing_boat` (moored: `bob`) and `net_rack`; mountain `boulder_granite` (3), `cairn`,
    `summit_lookout` (a stone platform with a rail, scope, flag and bench; a landmark); `forest_litter` (a ground
    decal, 3 forms). Tags `island` plus their place. Each model's fallback picture is **baked from the model** by the
    builder (a small rasterizer, scene/next/island/*.png): seen from the front and above, cel-lit, outlined.
  - **The barn** (batch 11's) as a model under its key, batch 7's way: the House kit with a **gambrel** roof, red
    board walls, braced sliding doors, the hay loft door and its hoist, a lamp, a weather vane, side windows, a back
    door, a loft window, a woodpile under a lean-to. Its five looks are colour swaps; `room: int_barn`, the door at the
    big doors, name and tags kept; footprint 5.5 x 4.1 m (was 5.4 x 4).
  - **Swapped in** as models under their keys: `scree` (base and four forms) and `log_mossy`, `stump_mossy`; their
    old pictures stay the fallbacks. **Golden scenes remade on purpose**: scree moves the props hash of `feature`
    and `terraced` (only that part; a model's placement keeps its size, `s`).
  - **Showcase** `test_props_island` (64 x 58 m): sea and a walkable pier (a `bridges` entry, `pier: 1`) to the south,
    the beach, a fenced paddock with the gate, the barn three times (a look and a turned one), a mountain corner and
    forest floor; seven `shots`; `cam.orbit` set for IS-1's camera.
- Where the plan was wrong or short:
  - Many of the track's "new" props already were models: `fence_wood` and its post, `haybale`, `rowboat`,
    `dock_post`, `buoy`, rocks, `boulder_lichen`, `stone_wall`, `waystone`, `log`, `stump`. Reused, not duplicated.
  - **The walkable dock is a map field**, not a prop: `bridges` with `pier: 1` (Copperleaf's wood bridge is one).
    IS-5/IS-9 place the island's; the showcase has one.
  - **The barn's old `build` plan said a gable**; its picture is a gambrel. The model follows the picture.
  - A roof made by the kit's 4-sided cone has closed ends: the gable's loft door and window go on the roof's end face,
    as the kit's gableF does, or the roof hides them.
  - `lookout_tower` stays batch 11's; the summit has its own prop.
- Verified: unit tests 567 (2 golden scenes remade on purpose); lint, typecheck, check:modules, format:check,
  check:data (144 files); a full rerun of the builder writes nothing; check-fast 22 of 22; smoke no problems. Headless
  pictures (390 x 760, low graphics) of the showcase at 8 camera turns a full circle (the free camera) and close-ups
  of the barn (front, both sides, back, a look, turned), the boats and pier, the paddock, the lookout, beach,
  mountain and forest; Copperleaf's barn in the town. No page errors.
- Risky:
  - Triangles (from the builder's mesh): barn ~3,400, fishing boat ~3,700, net rack ~1,600, lookout ~1,400, the rest
    under 1,000 (scree 230-360). Not measured on a phone; IS-9 measures.
  - Scree is placed widely on runs (ridge, snow, canyon): every placement is a model now. Small, but many.
  - The baked pictures are a flat-lit approximation (rocks without their lumps); they show only with models off or
    as the far view of a neighbouring scene.
  - The fishing boat bobs (`bob` 0.09) on water tiles only; on land it sits still.
  - The barn's footprint grew 0.1 m each way; Copperleaf's barn has room round it (checked in the picture).
- Not run: the full quick check's picture compare (CI makes its baseline); the new map's `shots` join it.
- Phone check wanted: `?test=1&scene=test_props_island` (turn the camera round the barn, the boats, the lookout);
  Copperleaf's barn and its door into the ranch; a run with a ridge node (scree); export the debug log.
- Next: IS-5 places these on `copperleaf_island` (the barn in its zone, the pier at the cove); IS-8 the pasture with
  `fence_wood` and `fence_gate`; batch 11's remaining list: boulder_mossy, campfire, lookout_tower, wind_sail_flower
  and the rooms' 20 furniture props. Tag `is-4-done` is the owner's to push.

### Island track IS-3 - Sea all round - 2026-10-22
Branch `claude/is-3-sea-all-round`, from IS-0's `claude/new-session-3qlesh` (PR #119, not merged yet; started before
`is-0-done` at the owner's word). Wave 1, beside IS-1 (camera.js), IS-2 (generator), IS-4 (props), IS-6a (Studio).
Plan approved in Plan Mode as proposed. Owns water and sky: touched no camera, mapgen, Studio or world-bowl code.
- Changed (one cause per commit):
  - **logic/sea.js** (new, on the page): `seaSkirt` (rings round the scene out to 400 m, the inner ring on the edge
    every half metre with rounded corners), `seaRamp` (the edge's water depth to the open sea's over 25 m),
    `seaCentre` (`island.c`, else `cam.orbit.c`, else the middle), `seaCalmAt` (a `cove` zone's calm, soft 6 m edge).
  - **The skirt** (walk/ground-mesh.js, the `flatFar` block): the four quads 90 m out became one ring mesh at the
    sea's level along the edge (the commonest edge water level, not a hard -0.12), its first ring as deep as the
    scene's water beside it; the scene's edge vertices count the edge cell twice instead of nothing (they were half
    as deep: part of the seam). Opaque past the 8 m border of land. ~23k vertices on test_island (23 rings x 992).
  - **No far props on a `flatFar` map** (grass-build.js): the trees scattered past the edge stood on the sea.
  - **The bowl's far wall** (sky shader only): outline averaged over 5 texels (no stair steps), a soft top, its foot
    hazed into the horizon.
  - **The coast** (water shader, uniform `uSea` from water-data.js `setShoreUniforms`, so the ground shader has it
    too): whitecaps and a long swell roll in toward `seaCentre` from every side (they were stretched along x, streaks
    from the east and west); surf lines over the shallows breaking on the whole coast; a bigger swash; wet sand above
    the line on the same clock; past 140 m no fish, rings or caustics (cost). A cove's calm rides in the vertex's
    kind (kind + calm * 0.4; `int(k + .5)` still gives the kind; the shader takes the rest apart). Only K = sea on a
    `flatFar` map changes; other maps' water is as it was.
  - **test_island**: a stand-in `cove` zone over the east shore's water (zone only, no ground change), via
    tools/build-test-island.py.
  - **check-fast island step**: the skirt reaches 400 m at the sea's level; draws from 8 angles through the free
    camera hook (`walkView.opt.look`). Planted fault (no skirt) seen to fail.
- Where the plan was wrong or short:
  - The "turquoise band" from above was the scene's own shallow edge water, not land: the seam was depth, as planned,
    plus the half-depth edge vertices (new).
  - Step 3's extra fade of the far sea into the sky wasn't needed: the fog already takes it to the haze by 400 m
    with no edge; only the cheap far path went in.
  - The bowl wall's colour is the far bowl's own (phase 10), a pale cream; I softened it, didn't recolour it.
  - With full graphics the sky looking south washes white (bloom and glare into the 12:30 sun): direction dependent,
    so it belongs to the sun question (3) of IS-1, not changed here. The diagonal glints on the sea are the existing
    glint pattern, not the whitecaps.
- Verified: unit tests 572 (5 new: no gap at 48 angles out to 400 m, the inner ring on the edge, the depth at the
  edge and by 25 m, the triangles' turn, calm); lint, typecheck, check:modules, format:check, check:data (143 files);
  check-fast 22 of 22; smoke before the shader work and at the end; headless pictures at 390 x 760 from S, E, N, W, SE,
  low S, three outward views and three coast close-ups, before and after (in the PR).
- Risky:
  - Phone cost: the skirt covers much of the screen when looking out; its far fragments skip the small things, but
    the reflection sample and fog remain. Needs the frame times on the phone (`?fixture=island`).
  - `gamedata.js` is generated (`npm run data`); a stale one hides data changes in local pictures.
  - The calm-in-the-kind trick: anything new that reads the water mesh's kind must round, not truncate.
  - Every `flatFar` map gets the new sea: test_island, five legacy maps, Studio-made coast scenes. Runs don't use the
    coast biome.
- Not run: the full quick check's picture compare (its baseline is made by CI).
- Next: switch the pictures to `copperleaf_island` when IS-2 lands (its real cove gets the calm from its zone); IS-1's
  sun choice (question 3) decides the backlit side. Tag `is-3-done` is the owner's to push.

### Island track IS-1 - Orbit camera - 2026-10-22
Branch `claude/is-1-orbit-camera`, from IS-0's `claude/new-session-3qlesh` (PR #119, not merged yet: the owner started
wave 1 before `is-0-done`); the PR goes against main and shrinks once #119 merges. Ran beside IS-2, IS-3, IS-4 and IS-6a.
Plan approved in Plan Mode; the owner's answers: question 2, the camera **holds still on the summit** (your own turn
still works); question 3, the **sun stays put in the world**, with an Engine toggle to compare; the tree picture fix
in sprites.js done here.
- Changed (one cause per commit):
  - **logic/camera-orbit.js** (pure, unit-tested; on the game and Studio pages, for IS-6a's "Walk the coast"):
    `orbitYawAt` (the yaw that looks from you at `c`; 0 from the south, so the first view is today's), `orbitStart`,
    `orbitStep` (the lag as a time constant of `lag` s; inside `dead` the target holds; the yaw kept unwrapped so the
    easing always takes the short way past +/-180; trimmed back near 0 every 8 laps), `orbitStickYaw` (the joystick's
    frame, below), `orbitWalkStep` (a step taken round the middle: the part across the radius moves you along your
    circle), `wrapAngle`.
  - **walk/camera.js**: `orbitOf(sc)`: the orbit applies outdoors, not in a room, not in the Studio's free camera,
    with Engine > Camera > Orbit on. The base yaw is the orbit's and your turn (`walkRenderer.yaw`) is added on top,
    limited to the map's `turn` (`cameraTurnLimit()`). No scene clamps on the target while orbiting. Four spots that
    assumed a north view now use the base yaw (all equal to before at yaw 0, so every other map is unchanged): TR-3's
    ground-ahead for the rise, the lean ahead of you (`rw > rh ? 2 : 1`), the swoop's offset, `landmarkTilt`. A new
    scene, a cut (`camT` cleared, `opt.instant`) or a jump of over 8 m starts the orbit where it belongs.
    `walkRenderer.orbit` holds the state. A turn kept from a map with a wider limit (Copperleaf's 35) is clamped to
    the island's on arrival. The battle, cutscene and Studio cameras don't go through it.
  - **walk-view.js** (joystick and keys): on an orbiting island the stick walks by `orbitStickYaw` (plus your turn)
    and steps with `orbitWalkStep`; elsewhere it is unchanged (the camera's right).
  - **sprites.js**: `landmarkTilt(P, sc, yaw = 0)`; a tree's crossing picture fades by `|sin yaw|`, not `|yaw|`.
  - **Engine > Camera**: `orbit` (on) and `sunTurns` (off; on turns the sun with the camera in engine/light.js
    `sunLight`).
  - **Debug log**: the scene line's `orbit` (yaw, your turn, `hold` on the summit, `stickLocked`; degrees).
  - **check-fast's island step**: 8 places round the coast (the camera looks at the middle within 0.06 rad and aims
    within 4 m of you), the summit holds, the turn limit is 30 degrees, holding right goes an eighth of the way round
    and stays within 1 m of its 44 m circle with no yaw jump.
- Where the plan was wrong or short:
  - **The walk drift fix needed more than "steer by the target yaw"**: a step straight along the tangent still adds
    s^2/2r to the radius every frame (0.5 m a lap at 20 fps running, more on slow frames), and last frame's target is
    stale by a frame. The stick reads the way to the middle from where you stand now, and the step goes round the
    middle: a lap ends on its circle to 1e-13 m in Node (8, 20, 60 fps), 45.0 m of 45 in the browser.
  - **Crossing the summit holding up** would bounce you at the dead zone's edge with any stick frame that follows
    the orbit (the way to the middle flips half a turn as you step out the far side). So while the stick is held its
    frame stays locked from the moment you are inside the dead zone until you let go. Leaving the summit northward
    holding up, you keep walking north while the camera swings round behind you (lag 0.6 s); push again and up is
    toward the middle.
  - Shadows and culling needed nothing: both work from the camera's own view (screen rays, the frustum), not a
    facing. The shadow map stops 6 m past the scene, where only sea is.
  - The sun was already fixed in the world (Engine > Sun > angle); question 3's "fixed" option was free.
- Verified: unit tests 577 (10 new); lint, typecheck, check:modules, format:check, check:data (143 files);
  check-fast 22 of 22 (the island step 48 s with two browsers); smoke all fine. In a 390 x 760 page with full graphics
  at 8 angles: the camera looks at the cone from every side, no page errors, TR-3's rise and rock fade 0 everywhere
  on the ring; a full lap holding right (194 s of software drawing) ended at 45.0 m. Copperleaf's camera is unchanged
  (no orbit; every changed spot is identical at yaw 0).
- **Found for IS-3 (not fixed: water is IS-3's)**: from the west and east the far sea floats over the near ground.
  The `flatFar` skirt (walk/ground-mesh.js ~775) is four quads of 4 corners each, and the world's bowl curve
  (`curveY`, about 0.0012 x d^2 past 70 m from the scene's middle on test_island) lifts each corner by its own
  distance. The west and east quads run 300 m long, so their inner edge at x 0 is lifted ~10 m (the corners at z -90
  and 210) and the water sheet covers the sand and the ring up to ~20 m in. The north-facing camera never stood past
  those edges, so it never showed. Fix: cut the skirt into a grid (e.g. 10 m cells) so the curve bends it like the
  ground. From the south and north it looks right.
- Risky:
  - The stick's locked frame (above) is new behaviour; worth a feel on the phone at the summit.
  - With "Sun turns with the camera" on, the shadow cache redraws every frame you turn (the sun moves): a
    comparison setting, not for the phone's frame times.
  - studio/index.html gained a script line next to camera-rise.js; IS-6a may add the same line (keep one when merging).
  - Phone frame times at 8 angles are IS-9's; nothing here measured a phone.
- Next: IS-3 (the sea skirt above), IS-6a can call `orbitStep`/`orbitStart` for "Walk the coast", IS-5 when IS-2
  lands. Tag `is-1-done` is the owner's to push (after `is-0-done`).

### Island track IS-0 - Contract and test island - 2026-10-22
Branch `claude/new-session-3qlesh`, from main a10bfc6 (PR #118). The owner's brief (docs/phases/island-track.md,
uploaded in chat): Copperleaf becomes a real island, one map, an orbit camera. IS-0 runs first and alone so wave 1
(IS-1..IS-4) can run side by side without meeting in the schema and types. Plan approved in Plan Mode as proposed.
- Changed (one cause per commit):
  - **Docs**: the track file in docs/phases (with an "Checked in IS-0" note), ROADMAP's Island track bullet.
  - **logic/island.js** (on the game page; nothing calls it yet): `ISLAND_ZONE_KINDS`, `islandPointIn` (point in a
    polygon, for IS-2/5/7) and `islandProblems(sc)`: `cam.orbit` (pivot on the scene, `dead` under half the shorter
    side, `lag` 0-10 s, `turn` 0-180), `island` (the coast 3+ points, on the scene, closed without repeating its first
    point, never crossing itself, `c` inside it, the map's `edge` water), `zones` (a known kind, a sound polygon).
  - **The contract fields** in map.schema.json and game-data.d.ts, all optional: `cam` (pitch, h, fov, `orbit {c,
    dead, lag, turn}`), `island {c, coast}`, `zones [{k, poly, lock}]`, `islandGen {v, seed, dials}` (the dials an
    open object: IS-2 owns them) and `waterKind` (enum = the renderer's nine kinds). check-data runs `islandProblems`
    on every map.
  - **test_island** (tools/build-test-island.py, rerunnable): 120 x 120 m; a cone 16 m high at (60, 60), flat top
    r 3, foot r 27 (steepest 0.65, the walk allows 1.05); grass ring to r 48; sand, wet sand to r 52; sea past it
    (`edge: "w"`, `waterKind: "sea"`, the coast biome's `far: "sea"`, `farH: 5`, `flatFar: 1`); `cam.orbit {c [60,
    60], dead 3, lag 0.6, turn 30}`; zones mountain, town (locked, south), beach (south arc); six props (a sign,
    a house, a bench, a lamp, two oaks) to judge turned standees by in IS-1. Hub (60, 30), the south side.
  - **`?fixture=island`** opens it; check-fast's island step: it draws, the fields reach the scene, its walking checks
    hold (hub open, the top and the north side reachable, the sea not).
  - **The owner's direction, after the first push** (chat, 2026-10-22): "The starting map will not be a node. It will
    be the main hub. Make a separate editor for it in Studio with an orbiting cam. It will be locked after it's
    right." Answers: the lock freezes the ground (props, people, buildings stay free; unlocking is deliberate); dials
    then hand edits; the generator reusable (question 10). So: **the ground lock joined the contract**
    (`islandGen.lock`, `islandGen.hash`, `islandGroundHash` over ground letters, heights, steps, coast and zones; a
    changed locked ground or a lock without a hash fails check-data), and the track file splits IS-6 into **IS-6a,
    the Hub island editor** (a Studio section of its own: an orbit view through `mountWalkView` with its own look
    from logic/free-camera.js, a 2D map with coast, zones and pivot, map-editor.js's paint and height brushes, the
    lock bar; wave 1, Studio files only) and **IS-6b**, its dials (after IS-2). No Studio code in this session.
- Where the plan (the track file) was wrong or short:
  - "The sea's water kind" already existed: `waterKind` (mapgen wrote `'sea'`; environment.js and sound.js read it).
    It is typed and in the schema now, no new field.
  - `edge: "w"` alone is not a sea: it paints the land past the edge with a water texture. The sea skirt that exists
    is `flatFar: 1` (walk/ground-mesh.js:774-794: water quads 90 m out round the scene, the far land lowered). IS-3
    should extend it rather than start a new one.
  - `?test=1&scene=<id>` already opened any test map; the fixture is for check-fast (fixture pages only).
  - Map rows are north first and z grows northward from the near (south) edge (mapgen.js's header): the track's
    "town in the south" means small z. IS-2 and IS-5 keep to it.
  - "an export" in IS-0's line taken as logic/island.js, the module the checks and later sessions share.
- Verified: unit tests 535 (8 new: every game map passes, test_island has every field, the schema refuses 7 bad
  shapes, 11 planted faults each give their words, the schema's water kinds and zone kinds match the renderer's and
  the module's, the lock: props free, five ground changes refused); lint, typecheck, check:modules, format:check,
  check:data (142 files); check-fast 19 of 20 with two browsers (the island step 27 s; RL-9b's packing step timed
  out at "Take off" under load, then passed alone in 42 s: its 30 s wait is tight with two browsers, nothing this
  branch touches); smoke 15 of 15; headless pictures at 390 x 760 from the south, the top and the north: the cone, ring, sand and sea
  draw, no page errors. From the north the cone stands between the camera and you: the reason for IS-1.
- Risky:
  - The orbit fields do nothing yet: the camera is today's (fixed yaw, scene clamps) until IS-1.
  - The `flatFar` skirt starts 90 m out with the far land between; low angles may show a seam (IS-3).
  - `cam` is in the schema for the first time (only pitch, h, fov were ever used; all 142 files pass).
  - logic/island.js is on the game page; IS-6a adds it to the Studio's page.
  - The lock's hash trips on any rewrite of the ground, rounding included (a tool that re-rounds heights would need
    an unlock and relock); intended, and the message says how.
- Not run: the full quick check's picture compare (its baseline is made by CI, not in git); a new test map adds its
  `shots` (island-south, island-top) to it.
- Next: wave 1, up to five sessions side by side: IS-1 orbit camera (owns walk/camera.js), IS-2 island generator
  (owns logic/island-gen.js, not mapgen.js while TR-2c part 2 is open), IS-3 sea all round (water and sky), IS-4
  island props (prop data and art), IS-6a the Hub island editor (Studio files). The track's "Ask me before" 1-12 are all still open; each session asks its own
  (IS-1: 2 and 3; IS-2: 1, 6, 7, 9; IS-5: 4, 11; IS-8: 8; IS-9: 5); 10 is answered (reusable). Tag `is-0-done` is the owner's to push.

### Roguelite track RL-12a - Relics and effects, first half: Loopholes, picks, shops - 2026-10-22
Branch `claude/dazzling-keller-qyw5vq` (PR #117), from main 6a8a3e7; main merged in twice: RL-9b and UI-6a mid-session,
then RL-11 (PR #115, bb51f13) at the end. Plan approved in
Plan Mode with the owner's answers: RL-12 may go before RL-11 (every Loophole on offer from the first run); split in
two (RL-12a here: effects, Loopholes, picks, shops; RL-12b: events and the event and shop places); 8.6 the
waystation; 8.14 a cap of 6. RL-9b, RL-10 and RL-11 ran at the same time (see "Merging" below).
- Changed (one cause per commit):
  - **UI lint was red on main** (RL-9's ranch card margin): fixed with tokens; main fixed it too, so the merge kept
    main's and lowered the space ceiling back to 1033.
  - **Data**: `relics.json` (ten Loopholes: Offshore Account, Tax Shelter, Lobbyist, Fine Print, Insider Tip, Hostile
    Takeover, Hedge Fund, Severance Package, Stock Options, Write-off), schema, types, `RELICS`, check-data;
    rules.json `run.relics` (cap 6, pick 3, rarity weights 6/3/1, prices $150/250/400; placeholders).
  - **logic/effects.js**: held Loopholes as effect rows; kinds `money`, `price` (shop, heal), `catch`, `stat`,
    `damage` (deal/take, by category or type), `heal` (walking in), `payout` (Capital, the items' share). Rows of a
    kind combine in any order, within limits; no rows change nothing.
  - **Battles**: a run battle carries `b.fx`; stat stages for yours on the field as it starts (a line says so);
    `calcDamage` and `catchOdds` multiply by their rows; a win's $ through the money rows. Golden battles unchanged;
    a fifth holds three Loopholes.
  - **The walk**: a run shop's prices and a run clinic through the price rows; walking in heals by the heal rows;
    the payout through the payout rows (a "Loopholes" row keeps the rows adding up to the total).
  - **logic/relics.js** and the save: `run.offerN` (the offers' stream) and `run.shelf` (a shop's Loophole by node and
    day); `migrate` fills them for a run saved before (it carries on).
  - **Screens** (relic-screen.js): beating a mini-boss stores a pick with the battle's end; "Pick a Loophole" opens it
    (cards one to a row, Take it / Take none, locked, reopened by a reload); past the cap, "Let one go"; a run shop's
    first row is the day's Loophole; the run bar's fourth tab (hidden since UI-4) opens as "Loopholes".
  - **Debug**: Runs section "Give a Loophole", "A mini-boss's pick", the list held; the debug log's run line has the
    ids held (no names), the pick waiting and offers made.
  - **Checks**: `?fixture=relics`; check-fast "Loopholes"; the in-game run phase and the quick check's RL-8 step buy a
    shop's Loophole, take a mini-boss's pick and see the boss's battle carry it; unit tests effects (7), relics (8),
    battle-fx (4), run-fx (3).
- Where the plan was wrong: see roguelite-track.md section 0, "Corrected in RL-12" (the save needed `offerN` and
  `shelf`; UI-4 had built the tab and pick card; "tiny" waystations can't be, every run scene is 112 x 64 m; Write-off
  only counts on a loss since RL-9b; four effect kinds wait for RL-13/14).
- Verified: unit tests 542 after the merge with main; lint, typecheck, modules, format, check-data; check-fast 19 of 19
  on this branch; the Loopholes step's planted fault (no pick after a mini-boss) seen to fail; the in-game run and
  ranch phases alone headless; the quick check's RL-8 step alone; smoke 15 of 15 before the work and at the end. Headless pictures
  (390 x 760) of the pick, the tab, the shop row and "Let one go". The full quick check: see the PR.
- Merging with the sessions running beside this one (test merges in scratch copies, not pushed):
  - **RL-9b** (PR #114, merged): merged into this branch; conflicts were both-sides additions.
  - **RL-11** (PR #115, merged into main and then into this branch at the end; first test-merged in a scratch copy):
    the code conflicts were all two additions in the same place (index.json keys,
    game-data exports, types, check-data blocks, check-fast pages, run-state checks, ui.js tabs: keep both, both tabs
    shown, `NAV_HIDDEN` empty; shop.js: RL-11's unlocked stock then RL-12's `relicShelf`); generated imports remade by
    `npm run modules`. Combined: unit tests 550, lint, typecheck, modules, data all pass; check-fast 19 of 20, the 20th
    passing alone (below). After the real merge: unit tests 550, lint, typecheck, modules, data, check-data-text.
  - **RL-10** (draft, `claude/pensive-brahmagupta-5rjlgf`): one conflict (check-fast, both add a step). Combined: unit
    tests 550, all fast checks; check-fast 20 of 20 on the second full run.
  - **A flaky check on main**: RL-9b's "Packing for a run" sometimes fails in a full check-fast with 20 pages ("Take
    off didn't start a run" within 30 s) and passes alone and on the next full run; not caused by RL-10, 11 or 12.
- Risky / open:
  - Every number is a placeholder (prices, rarities, multipliers); the run sim doesn't pick Loopholes yet.
  - A shop's Loophole depends on what you held the first time it opened that day (drawn once, then kept).
  - The pick sheet's three tall cards need a scroll on a small phone to reach "Take it".
- Phone check wanted: `?fixture=relics` (or the debug menu's Runs: "A mini-boss's pick"): pick a Loophole, look at the
  Loopholes tab; walk into a town (prices lower, clinic half, the Loophole row; buy at the cap); a battle with Insider
  Tip (the line at the start); export the debug log.
- Next: RL-12b (events.json with `relic` and `wager`, the event and shop waystations, no two shops side by side),
  then the tag `rl-12-done`.

### Roguelite track RL-10a - Ranch B, first half: breeding and hatching - 2026-10-22
Branch `claude/pensive-brahmagupta-5rjlgf`, from main fb43358 (PR #114), main (RL-11, PR #115) merged in at the end.
Draft PR #116. Plan approved in Plan Mode; the owner split RL-10 in two (RL-10a breeding, RL-10b income and the cloud
anchor) and took every recommendation: you pick the parents and the ranch picks the parts (phase 16's 5.1: both); an
abomination wears one parent's art with its own name and a stat swing; the old walking eggs are retired; the parents
stay free while their egg waits. `rl-9-done` was not on the remote at the start (sessions can't push tags); the owner
said to go ahead. Mid-session the owner asked to check the other sessions merge cleanly (below).
- Changed (one cause per commit):
  - **Rules**: `rules.ranch.breed` (nests 1/2/3 by ranch level, 10 Scrap a safe pair and 5 a risky one, 4 h to hatch, Lv
    5, risky odds 60/30/10, an abomination's x1.3 and x0.75; placeholders); types and check-data.
  - **A bred Billie's mark** `m.mut`: a quirk, or an abomination (`name`, `up`, `down`); `stat()` applies the swing
    after the build, `billyName` shows the name unless nicknamed, `billiesOk` checks it, `migrate` cleans the name.
  - **logic/breeding.js**: `breedCan` (why not: run, parent, same, line, full, scrap), `breedRoll` (the egg from the
    parents' uids and `ranch.bred`: shown before paying, the same however often asked), `breedStart` (pays, fills a
    nest with the rolled Billie), `breedHatch` (team, or storage when full; met at the ranch, caught, `hatched` +1).
    An egg's ready time never moves. The save: nursery entries hold `egg` (checked with the team and storage as one
    set of uids), `ranch.bred`.
  - **The ranch's sheet**: Nursery (eggs, time left, Hatch) and "Breed a pair" (Safe/Risky, pick cards, the safe egg
    previewed, the risky odds spelled out). Hatch opens the old hatch window (`hatchModal`, now the ranch's): "Hatch it",
    the shake, the Billie with a line for a quirk or an abomination; "Welcome aboard" brings the sheet back.
  - **The old eggs retired**: no drops (battleRewards draws no chance; its `roll` stays, unused, so callers keep their
    places), no trainer or starter eggs, walking hatches nothing; the incubators, the Bag's Eggs pocket, the debug
    menu's egg buttons, the Guide's egg sizes and the walking tip are gone.
  - **Checks and debug**: `breeding.test.mjs` (8), check-fast "Breeding", the in-game "The ranch: breeding a pair",
    the debug menu's "Eggs ready now", the debug log's `eggs` and `bred` (numbers only).
  - **The sim** `tools/test/sim/breeding-sim.mjs` (report only) and `breeding-sim.test.mjs`.
- Where the plan was wrong (roguelite-track.md section 0): eggs hatched by metres walked, not time; `eggs.json` lists
  legacy species (stand-ins play them); no Billie has a passive of its own, so a quirk's or abomination's passive waits
  for RL-12's effects (RL-10a uses a stat swing); an abomination can't look mixed (art is built per species offline);
  the cloud save is written in two places in `account.js`, not one. **A bug found in RL-9's training guard**: a clock
  turned back moves a trainee's start back with it, so turning the clock forward again pays the gap. Eggs avoid it (the
  ready time never moves); training's fix belongs to RL-10b's shared guard.
- Merging with the other sessions (the owner's ask): RL-11 (PR #115) and RL-12 both branched before RL-9b and each
  conflicted with main on its own (8 and 11 files); both sessions were told what conflicts and why. RL-11 merged first;
  main was merged here (both sides kept in the ranch sheet, saves.js, the debug menu, self-test, check-fast and the
  docs). RL-12 meets RL-10a in battle.js, debug-menu.js and battle-rewards.js; to keep that merge safe RL-10a kept
  `battleRewards(b, s, roll, rules)`'s order (RL-12 changes it too and passes a roll), and RL-12 was told how to
  resolve it (keep `fxMoney`, drop the egg block).
- Verified: unit tests 536 after the merge (breeding 8, breeding-sim 1; battle-rewards, rules and ranch-state changed
  on purpose); lint, typecheck, modules, format, check-data (planted faults caught); check-fast 20 of 20 after the
  merge (Breeding seen failing with Breed not paying); the in-game "The ranch" phases alone (breeding seen failing with
  eggs always ready); headless pictures (390 x 760) of the sheet. The full quick check after the merge (a0df71b, 24
  min): 45 of 54; the 9 red are the stale steps red on main too (v34 biped walk cycle, v35/v38/v39 roster counts 117/61,
  v43 and alpha 0.4 empty bush recipes, v44 props scene, v46 buildings without a plan, phase 08 running). CI's smoke
  was red on this PR as on main (#114, #115) in RL-9b's "Packing for a run": a race in the check (the flight landed
  before the wait looked); RL-11's session found it and its fix (fbdb456) is ported here, reproduced with the page's
  CPU slowed 6x (old fails, new passes).
- Sim (49 pairs x 40 eggs, report only): risky eggs 59 / 31 / 11 % (odds 60/30/10), an abomination for about 47
  Scrap. Battles at Lv 30 (the duel's control, plain against plain, is 0.43): an abomination against its unmarked twin
  0.44, a quirk 0.46 (the mark about even); against a plain all-M Billie 0.17 and 0.11, since mixed part sizes lose
  phase 16's Prime bonus. A safe pair of two Prime parents breeds a Prime Billie; the owner's play decides the numbers.
- Risky / open:
  - The dormant egg data stays: `eggs.json`, `saveData.eggs`, `RULES.eggs`, trainers' `egg`, the Studio's egg editors
    (world rules, data editors, check), the incubators' CSS and i18n lines. A cleanup session removes them.
  - An abomination looks like its body parent with odd part sizes; a real mix of parts is a renderer job.
  - Eggs trust the device clock forward (an egg hatches early if the clock is set ahead); RL-10b's anchor.
  - Closing the hatch window lets any waiting window (an evolution) show before the ranch's sheet comes back.
  - The sheet lists every Billie at home as a pick card; with many in storage it is long.
- Phone check wanted: at the ranch, +50 Scrap from the debug menu if needed; Safe: pick two of one line, see the egg,
  Breed; "Eggs ready now"; Hatch (the window, the Billie); Risky with two lines (try a few for an abomination); the
  Bag has no Eggs pocket; the Trainer card's Eggs hatched; export the debug log (`eggs`, `bred`).
- Next: RL-10b (passive income with its cap, the shared rollback guard fixing training's, offline, the cloud `t`
  anchor and the `saves/{uid}` key whitelist, 8.12, emulator first); the owner pushes `rl-9-done` and `rl-11-done`.

### Phase 09 batch 10 - every run tree a model; the _deep trees merged - 2026-10-22
Branch `props/batch10-trees`, from main 6493ed4 (PR #113). Owner's request in chat: make sure all trees are 3D props in
the style used, and list what else still needs converting. Plan approved with the owner's answers: only what the
roguelite loads (the hub, its rooms, run towns and the five run biomes; the legacy trees stay parked); the pines keep
how they look now, adapted as 3D props; this first batch the trees only.
- Changed (one cause per commit):
  - **Engine** (c230457): a leaf clip may be a band, a box `[left, top, right, bottom]` in the leaf picture cut without
    the clump's rim outline (prop-models.js `leafCut`), and a model's picture layer may be pulled toward the eye
    (`front`, metres: walk/sprites.js passes it as `uDZ`, which the sprite shader had but nothing used). The Studio's
    leaves part draws a band as a dashed box; its picture layer has the band's four fields.
  - **Trees** (tools/build-props-batch10.py, swapped in under their own keys): tree_pine, tree_pine_b, tree_pine_small
    and tree_cypress (ridge), tree_rowan_autumn and tree_giant_autumn (autumn). Conifers: batch 1's trunk, mast and
    roots, the mast straight; each drawn tier a band of its own (tiers found from the crown's width, `tiers_of`) that
    sways on its own, the cypress's lobes as clumps; every part centred on the mast and pulled toward the eye by a
    little more than the mast is thick. The autumn rowan is the rowan's model with its own leaves (as the autumn hazel);
    the great autumn oak is built as Copperleaf's great oak from its own drawing, without the swing. **tree_larch**
    (batch 2's) rebuilt the same way: its crown was one picture and its mast showed through it. Showcase map
    `test_props_wild`. Golden scenes and the frozen scene hash remade on purpose (models keep their size, `s`).
  - **_deep trees merged** (tools/merge-deep-trees.py, phase 09 task 4): the ten `*_deep` entries go; their placements
    (10 in the game's maps, 68 in the legacy thicket) and the thicket biome's weights name the base tree; their 20
    layer pictures (scene/props/layers/*_back, *_front) are deleted. The in-game test's tree pool and build-places-v46.py
    name the bases. Golden 'feature' (thicket) remade: 582 props -> 581.
- Where the plan was wrong: the circle clip can't cut a pine's tier (a wide, short band with its own hem), so the
  band clip was needed. Clumps standing off the mast in depth (the broadleaf way) made a pine zigzag when the camera
  turned, and the mast showed through camera-facing tiers (the larch already did), hence `front`. tools/prop-sheet.py
  draws model trees without their leaves (they load after its capture; the game draws them): its pictures can't judge
  trees.
- Verified: unit tests 515 (all pass after the remade goldens); headless pictures of `test_props_wild` (front and
  turned 1.2 rad) and of generated ridge, thicket and autumn scenes (front and turned 1.0 rad): no mast through a
  crown, no zigzag; no page errors. Every tree and shrub the hub, its rooms and the run biomes place is a model
  (bush_flower is a flat flower plant, flat on purpose). check-fast 16 of 17 (the one left, "Game data is valid",
  needs ajv; check-data with its schema step stubbed: 138 files, all fine); smoke 15 of 15. **Not run here:** lint
  (ESLint's packages), typecheck (the session's tsc is 6.0, the project's 7.0; it reports battle-engine.js errors
  that aren't from this branch), check:modules and check:data (missing packages: the npm registry is unreachable from
  this session). CI runs them.
- Risky:
  - Sprites per tree: pines 5-9 (were 3 as pictures), cypress 6 (1), larch 5 (1), autumn rowan 7 (1), great autumn
    oak 18 (3). A ridge route places about 90 conifers. Not measured on a phone.
  - Trees moved from 34 to 32 px/m are about 6% bigger (batch 1 noted the same for its trees).
  - The tiers sway separately (the top most); in strong wind check they don't come apart at the hems.
  - The old pines' depth pictures (scene/props/layers/tree_pine*_lb/_lf.png) and the tree pictures themselves stay:
    the pictures are the fallback when 3D models are off and the far view.
- Phone check wanted: a run with a ridge node (pines, larches, cypresses) and an autumn node (rowans, the great oak);
  turn the camera round a pine; Copperleaf's larches; export the debug log.
- Next: batch 11, the other standing pictures the roguelite shows: boulder_mossy (thicket), campfire and lookout_tower
  (the generator places them), the barn (the ranch), wind_sail_flower (Copperleaf), then the six live rooms' 20
  furniture props (plant_tall, bookshelf, sack, crate_goods, shop_counter, shop_shelf, wall_clock, wall_painting,
  wall_window, sofa, fireplace, barrel, blackboard, clinic_bed, counter_white, fridge_drinks, haybale_stack, lab_desk,
  lab_machine, privacy_screen). The flat plants (54) and ground decals (11) stay flat unless the owner says otherwise.

### Roguelite track RL-11 - Hub upgrades, currencies, unlocks - 2026-10-22
Branch `claude/hopeful-cannon-o98ywr`, from main 6a8a3e7 (PR #112). Plan approved in Plan Mode with the owner's
answers: **8.5** $ / Capital / Scrap / Audit Seals, Lab = Capital, Ranch and Workshop = Scrap, Airship = Seals; the first
unlocks: ranch levels, run shop wares, new biomes, milestones; the Workshop shown as coming later; a building's level in
its label (art later). RL-9b (PR #114, the mast's home Billie and packed bag) merged while RL-11 ran; main merged in
(both changed runTakeOff, validRun and the run's type: kept both).
- Changed (one cause per commit):
  - **main was red**: PRs #110 and #112 each stayed under the ratchet's spacing ceiling, together 2 over (1033 ->
    1035); the ceiling set to main's count, as UI-6 did after its merge.
  - **Three data sections** (file, index key, schema, type, check-data block, export): `currencies.json` (four rows,
    a fifth refused), `buildings.json` (Lab, Airship 2 levels, Ranch 3, Workshop coming later), `unlocks.json` (12
    rows: Nerve Tonic, Wake-Up Tea, Revives in run shops for 60/60/150 Capital; Airship Lv 2, ridge and autumn lands
    for 1 Seal each; Ranch Lv 2 and 3 for 40/120 Scrap; milestones: first run +10 Scrap, five runs +50 Capital, first
    win +1 Seal, fifteen kinds caught +100 Capital). All prices are placeholders. check-data refuses 16 planted faults.
  - **Conditions** `unlock:<id>`, `runs`, `wins` (read `saveData.meta`; the story checks refuse an unknown unlock).
  - **logic/unlocks.js**: `unlockReady` (why not), `unlockBuy`, `unlockAuto` (milestones, hub only, chained),
    `unlockTidy` (on load: lost ids dropped, `meta.buildings` rebuilt from the owned rows), `runUnlocks` and
    `unlockOpen` (a weight table filtered by a run's copy), `unlockRows`.
  - **A run's copy** `run.unlocks` (optional in `validRun`: a run from before keeps everything open, no save set aside).
    `runTakeOff` sets it and makes the map from the open biomes; a run town's shop draws from the open wares.
  - **Milestones** granted after the payout and when the world shows at boot (hub only), a toast each.
  - **The Lab board** (`lab-board.js`, `lab.css` on tokens only): the hub's Lab tab is shown; chips, a section per
    building with its level, the Workshop coming later, the milestones. Hazel's lab machine is the "Unlock board"
    (act `board`, also in build-interiors.py and the Studio's act list) and opens the tab.
  - **Upgrades at their buildings**: the ranch's sheet sells its levels, the Copperleaf mast's sheet the airship's
    rows; labels read "Ranch · Lv 2", "Airship station · Lv 2".
  - **Checks and debug**: `?fixture=lab`; check-fast's Lab step; the in-game test's "The Lab: unlocks";
    `unlocks.test.mjs` (7); debug menu "+500 Capital, +2 Seals"; the debug log's meta line has the unlock ids and
    buildings' levels (no names).
- Where the plan was wrong: no `hub.js` (the board is the Lab tab UI-5 kept hidden for it); `won:bracket_N` can't be
  built before Brackets (RL-13), so `runs`/`wins` instead; no `door` field (a row's `at` or `when` is its door); no
  building art per level (labels instead); grants needed no effect system (RL-12). The quick check's picture baseline
  is not in git (CI makes it), so there was no baseline commit to make: the hub's pictures change (the bar's Lab tab).
- Verified: unit tests 523; lint, typecheck, modules, format, check-data; smoke 15 of 15; check-fast 18 of 18 (its
  screens step updated for the Lab tab); the in-game phases "The Lab: unlocks" and the ranch's alone in a browser,
  nothing written while they ran; headless at 390 x 760: the board, the ranch's and the mast's upgrades, the lab's
  machine. After merging main (RL-9b): unit tests 527, smoke 15 of 15, check-fast 19 of 19 (one earlier full run
  failed RL-9b's "Packing for a run" when its take-off took over the step's 30 s wait on a loaded machine; it passes
  alone in 26 s and in the next full run). **Not run**: the full quick check (the PR was asked for first).
- Risky / open:
  - **New players lose wares and lands until unlocked**: Nerve Tonic, Wake-Up Tea and Revives left run shops, and
    ridge and autumn left run maps. Runs were already lost on the placeholders (the run sim, RL-8); without Revives
    they may be harder. Prices and milestones need a play.
  - A Seal comes only from a win (and the first-win milestone), so the airship's rows are far away for now.
  - The run sim, the fixture's run and the in-game test's run are made without `runTakeOff`, so they keep everything
    open: they don't test the locked shop or map. unlocks.test does.
  - Milestones met mid-session in the hub (e.g. the fifteenth kind caught in Copperleaf) pay after the next run or the
    next load.
- Phone check wanted: open the Lab tab (+500 Capital, +2 Seals in the debug menu if needed), buy Revives; at the
  ranch's sheet buy Ranch Lv 2 (a third slot; the barn's label says Lv 2); at the mast buy Airship Lv 2, then Ridge
  lands; start a run and find Revives in a town's shop and a ridge place on the map (not always: drawn by weight);
  tap the machine in Hazel's lab; export the debug log.
- Next: the owner pushes `rl-11-done` (sessions can't push tags); RL-10 and RL-12 are under way in other sessions.
### Roguelite track RL-9b - Ranch A, second half: 1 home Billie and a packed bag - 2026-10-22
Branch `claude/dazzling-darwin-jvooys`, from main 6a8a3e7 (PR #112). Plan approved in Plan Mode with the owner's
answers: the pack holds items and coins, 5 in all at Bracket I, on top of the run's gift; on a win the run's bag goes
home and pays no Capital (a loss pays it as before); the home Billie from the team or storage (a trainee stops, the
traveller leaves healed); the run fixture and the debug runs follow the rule. No `rl-*-done` tag is on the remote yet
(sessions can't push tags).
- Changed (one cause per commit):
  - **UI lint was red on main**: RL-9's ranch card CSS (`margin: 2px 4px 0`) merged after UI-6 set the ceilings
    (space 1035 > 1033); now `var(--s1) var(--s1) 0` (its top gap 2 -> 4 px).
  - **Rules**: `run.home` [1] and `run.pack` [5] by Bracket (placeholders); types, check-data.
  - **Logic** (run-state.js, run-loop.js): `runBegin` takes `home` (uids from the team or storage) and `pack` (taken
    from the hub's bag, never more than it holds; added to the gift); `run.home`, `run.pack`, the buddy a run field (the
    traveller walks with you, the hub's comes back). `runEnd` puts a kept Billie back where it lives, team **or
    storage** (the trap RL-9 found), and on a win adds the run's items and coins to the hub's bag; the payout's items
    line is 0 on a win and its row left out. `runReleasePays` reads `runHome` (a storage traveller released pays
    nothing). `runByTier` reads the Bracket lists. A run saved before RL-9b reads its home as `run.start.team`.
  - **The mast's start sheet** (run.js): "Who comes from home" (pick cards: team, then storage, "training" named; the
    buddy picked first) and "Pack the bag" (each item and coin with − and +, "n of 5"); it opens again in place on a
    tap, its scroll kept. `runTakeOff(seed, map, mods, pick)`: without a pick (the debug menu, tests) the default pick
    and nothing packed; a trainee's training stops first (`ranchStop`), everyone at home is healed (`healAll`).
  - **Fixture**: `?fixture=run`/`mountains` take the lead alone.
  - **Run sim**: the policy picks as the mast does; `--team` is Billies at home, `--pack=N` packs Potions.
  - **Checks and debug**: check-fast "Packing for a run" (ranch fixture); the in-game run phase checks a party of one
    and the hub's team untouched; the debug log's run line has `home` and `packed` (counts only).
- Where the plan was wrong: the trap had two more faces than HANDOFF said: the release payment and the payout's
  "from Copperleaf" read `run.start.team`, and the buddy wasn't a run field (with one traveller the hub's buddy would
  have been missing on the run). Nothing in `ranch.js` needed to change: a trainee picked is simply stopped.
- Verified: unit tests 519 (4 new run-state tests; the payout test changed on purpose); lint, typecheck, modules,
  format, check-data (planted faults caught); check-fast 17 of 17 after the fixture change and the new step alone (it
  turns red with the old trap planted); smoke 15 of 15; the in-game phases "A run's road", "A run: airship, nodes,
  payout" and "The ranch" alone; headless pictures (390 x 760) of the start sheet. The full quick check: running at this commit (its result in the next commit).
- Sim (50 runs, report only): one Lv 5 starter wins none and loses on the landing in 31 (as on main); three at home
  is now the same as one (main's three-starter party also won none, losing at the mini-boss 20 times); five Potions
  packed: lost on the landing 31, route 9, town 9, mini-boss 1, Capital 121.5 (82.3 without).
- Risky / open:
  - Balance: one Lv 5 Billie a run is hard (the sim's crude policy loses most runs on the landing). The owner's play
    decides `run.home`, `run.pack` and the gift; all are placeholders in rules.json.
  - Take-off now heals everyone at home and plays the heal sound.
  - A run saved before this update keeps going with its whole team (its home read as `run.start.team`).
  - The sheet re-renders on every tap (as the payout's picker does); on a phone with many Billies in storage it is a
    long sheet: the cards come first, the bag below.
- Phone check wanted: at the mast, "Start a run": pick a Billie from storage, pack two things, take off (a party of
  one, the bag); give up, keep it: it is back in storage with its run's levels; a short debug run won: the bag in
  Copperleaf's; export the debug log (`home`, `packed`).
- Next: the owner pushes `rl-9-done` (the end of RL-9); then RL-10 (Ranch B) or the balance pass with these numbers.

### Roguelite track RL-9 (first half) - Ranch A: the building, storage, training - 2026-10-22
Branch `claude/great-hamilton-bj2wsa`, from main 9760857 (PR #108, TR-3). Plan approved in Plan Mode with the owner's
answers: **8.2** 1 home Billie a run at Bracket I; **a packed bag**: at the mast you pack a limited bag from
Copperleaf's bag, which keeps everything you've gathered; the ranch's sheet trains and shows storage (the Team tab
keeps storage too); Scrap from a payout row; training by slots, a level cap and real time. Split in two: this half is
the ranch; **RL-9b** is the run's start (the pick of 1 home Billie and the packed bag). Mid-session asks: rooms a
little smaller (done); the deleted art/background left to another session (not touched here).
- Changed (one cause per commit):
  - **update-check.js's generated imports** remade (`toast` moved to overlay.js in UI-5): typecheck and
    check:modules were red on main and the module failed to load.
  - **Rules** (rules.json `ranch`: slots 2/3/4 by ranch level, cap 15 + 10 a level, 8 h banked, a level every 2 h,
    5 Scrap to start, a minute's clock slack; `run.payout.scrapNode` 2, `scrapWin` 10; all placeholders): types and
    check-data blocks.
  - **logic/ranch.js**: `ranchLevel/Slots/Cap`, `ranchCanTrain`, `ranchTrainStart` (pays), `ranchXp` (each level its
    own size of XP, never past the cap), `ranchBanked`, `ranchCollect` (through `gainXp`: levels, HP, moves, and the
    evolution offer as in battle), `ranchStop`, `ranchTidy`. The clock is passed in; a clock more than `guardMs`
    behind a trainee's start pays nothing and starts it again. `toTeam` collects and stops a trainee; `migrate`
    tidies trainees that left storage.
  - **Scrap from a run**: `payoutOf` pays it, `runEnd` adds it to `meta.scrap`; a chip on the payout screen (not a row:
    the rows add up to Capital), the toast home, the Map header, the debug log.
  - **Rooms smaller**: 14 x 11 m → 12 x 10, 18 x 12 → 16 x 11. tools/build-interiors.py builds the new sizes (`SIZE`,
    `fit()`); `--shrink` remade every stored room's walls and floor and kept its own props (moved in), lines and keeper
    spot, so the Studio's edits stay. Granny Juniper's furniture spots moved the same way; one window cleared.
  - **The ranch**: a barn in Copperleaf (x 22, z 41.5, the meadow by the farm patch; act `ranch`, label Ranch) into
    `int_barn` (`ROOM_BY_USE.ranch`), open at all hours; inside, a "Training board" (the blackboard) and the rancher
    open the new **ranch-screen.js** sheet: Scrap, level, cap; trainees with their way to the next level and Stop;
    storage with Train and To team. Opening it collects. The Studio's act list has `ranch`.
  - **Checks**: `?fixture=ranch`; check-fast's ranch step; the in-game test's "The ranch: training between runs";
    `tools/test/ranch.test.mjs` (6).
  - **Debug**: "Age the ranch by an hour", "+50 Scrap"; the debug log's `ranch` line (numbers only).
- Where the plan was wrong: Copperleaf had no barn and `int_barn` no acts, and the barn's opening hours would have
  closed the ranch at night. Scrap and `meta.buildings` were never used. No `buildings.json` stub (RL-11 designs it with
  the costs). Pens and the walkable yard are not built (8.16's first cut). The "quick-check step that edits it"
  (TESTING phase 12) is check-fast's ranch step: it edits, moves the clock and reloads.
- Verified: unit tests 510; lint, typecheck, modules, format, check-data; smoke 15 of 15; check-fast 17 of 17; the
  in-game phase alone in a browser; headless pictures (390 x 760) of the barn, the room, the sheet and the smaller lab.
  The full quick check: see the PR. Browser checks ran with art/background put back locally (not committed), since
  main still loads it.
- Risky / open:
  - Training's numbers are placeholders; a Billie in storage gains about four levels in 8 h at Lv 5-15.
  - A level-up in training can open the evolution offer when the ranch opens (as in battle).
  - The home's furniture spots and the shrunk rooms were looked at headless only.
  - main still loads the deleted `art/background` pictures (another session is on it).
- Phone check wanted: walk to the barn (west of the lab, by the crops), in, tap the board; Train a Billie from storage
  (+50 Scrap in the debug menu if you have none); "Age the ranch by an hour" twice and open the sheet again (a level);
  a run's payout shows Scrap; rooms feel smaller; export the debug log.
- Next: RL-9b (the mast's pick of 1 home Billie, the packed bag of `run.pack` items, a kept storage Billie on a loss,
  items home on a win, the run sim's policy), then the tag `rl-9-done`.
### Terrain track TR-2c part 1 - Grass patches, wild Billies in them, the dust puff - 2026-10-22
Branch `terrain-generation`, restarted from main 9760857 (PR #108, TR-3, was already merged). Plan approved in Plan
Mode with the owner's answers: remove what loads the deleted art/background (not restore it); TR-2c in two sessions
(this one: grass, encounters, dust puff; next: road pathfinder and the four mountain route types); wild Billies in any
patch; grass patches in runs now.
- Changed (one cause per commit):
  - **update-check.js** imports toast from overlay.js (npm run modules regenerated it; main had ui.js).
  - **No art/background** (main deleted the folder): the pixel sky draws its gradient in code (the old pictures'
    colours, no clouds); the title, Trainer card, route card and wide-screen backdrop use a gradient in sundown's
    colours. The fast check's 404 on every page is gone. The Studio's Art section still has a "Rebuild sundown.webp"
    card for the background group (harmless: no files there).
  - **Grass patches** (mapgen.js `mapgenGrassPatches`, terrain-track.md "TR-2c part 1 as built"): 3-6 ragged ovals of
    15-70 m², the first across the road on the way west, road cells under it too; `scene.grassPatches`.
    MAPGEN_VERSION 6; golden scenes and the scene hash remade on purpose.
  - **Encounters**: on a place with `grassPatches`, wild Billies wait in any patch (no 13 m or path rule there);
    seamless-world.js copies the patches into the drawn scene. Copperleaf unchanged.
  - **Dust puff** where you land off a ledge (six puffs, none with reduced motion).
- Where the plan was wrong: `grass` was already a scene key (a room's grass blades, a seamless look key), so the
  patches are `grassPatches`. A version bump has no "left" path: `run.mapgenV` is never compared, so a run already
  going remakes its scenes with patches on its next load. "One patch a ledge or side path skips" isn't built: routes
  are open, so any off-road patch can be walked round.
- Verified: unit tests 507 (new mapgen-grass.test); lint, typecheck, modules, format. Sweep of 120 dial sets: every
  one has a patch across, 4-6 patches, 15-70 m² (median 43), every exit reached, no trap. In the page (run fixture
  landing): 241 encounter spots, all in patches, up to 55 m from the middle; its 4 wild Billies all in patches; a 1.2 m
  drop hops and puffs, no errors. check-fast 16 of 16 after the art fix and again after the grass work.
- **Not verified**: smoke had 2 timeouts (the in-game full test, the Studio's screenshot) while the fast check ran
  alongside on the same machine; see the PR for the re-run alone. The full quick check was not run.
- Risky:
  - Much less tall grass: about 220 m² a scene (was 770) and 80 grass props (was 315); 517 props a scene (was 755).
    Cheaper on the phone; the land may look barer. The dial's floor (3 patches) and sizes are `MAPGEN_GRASS_PATCH`.
  - Wild Billies can now stand far from the middle (55 m): the spread is for the phone test to judge.
  - The patch across the road turns a few metres of road into tall grass (Gen 3's look); on the phone it may read as a
    gap in the road.
  - The sky behind the menus has no clouds now.
- Phone check wanted: start a run, walk west from the landing through the grass across the road, find the wild
  Billies in the patches; the debug run "Mountains and ledges": hop down a ledge (the dust puff); the title and the
  Trainer card (the gradients); export the debug log.
- Next: the owner pushes `tr-2c-1-done` (sessions can't push tags); TR-2c part 2 (the road pathfinder through tiers
  and the massif, reusing mapgenTrailSearch, for 15 m+ summits; the four mountain route types; generated gorges with
  rope bridges: structures.js already draws `kind: 'rope'`).

### Terrain track TR-3 - The camera on tall ground - 2026-10-22
Branch `terrain-generation` (the owner's name for it), from main dcced21 (PR #105, TR-2), main (UI-5) merged in at
the end. The owner chose: TR-3 now, the rest of TR-2c next on the same branch in a new session, one PR. Plan approved
in Plan Mode (silhouette a dark blue tint about 55% dithered, rise capped at 18 degrees on top of the old 9).
- Changed (one cause per commit):
  - **Camera rise** (walk/camera.js, new logic/camera-rise.js `cameraRiseNeeded`): the line from the eye to your head
    tested against the standing height at ten points 1.2-27 m back; the camera tilts down further until it clears by
    0.4 m, up to Engine > Camera > "Rise on tall ground" (18 degrees, 0 off), and comes up to 15% closer; quick up,
    slow down; none indoors, in rooms, with the free camera or a focus. The debug log's run line has `camRise`.
  - **Rock fade** (walk-shaders.js `ROCK_GLSL`, draw-common.js `setRockUniforms` from `useWalkProgram`): ground, walls,
    sprites, grass, water, waterfalls, solid props and trees, voxel props and low-poly models nearer the camera than
    you and 0.5 m above your feet thin out in a soft circle round you (up to 80%). On only while ground cuts the line
    (the camera's `rockK`). Buildings keep their own fade. Setting "Rock fades in front of you".
  - **Silhouette** (sprites.js `drawPlayerSilhouette`, gpuPass and debug-log timer `silhouette`): the player drawn again
    after the structures, depth GREATER, no depth writes, pulled 0.6 m toward the eye along each corner's line of sight
    (sprite shader `uGhostV`), a dark blue dithered tint (`uGhost`). Setting "Your silhouette through rock".
  - **Shadows**: the near shadow map is centred at your height (engine/light.js `beginSunShadow` cy).
  - **Debug**: the mountains run (`dbg_mountains`) has massif `NS` (was `N`); the debug log's `mountains` read the drawn
    scene (no `gen`, always 0) and now reads the place's map.
  - **Checks**: `?fixture=mountains`; check-fast's "Tall ground" step; `tools/look-tall-ground.py` (five pictures,
    validation/tall-ground/, ignored); tests camera-rise and tall-ground-draw.
- Where the plan was wrong: rise alone can't clear a massif 3-14 m away (17 m of rock would need about 80 degrees):
  the fade and the silhouette carry the worst spots. The fade had to reach trees and models too, not only "steep smooth
  ground", and it had to switch on only when ground cuts the line, else trees and signs in front of you would thin out
  in Copperleaf. check-fast takes no pictures by design, so its new step checks the state and the pictures come from
  the separate script. Walls aren't a separate index block (terrain-track.md "TR-3 as built").
- Verified: unit tests 496; lint, typecheck, modules, format; smoke 15 of 15 after each step; check-fast 14 of 14
  before the merge (Tall ground: 16.9 m of rock, rise 18 degrees, fade and silhouette on, off on flat ground); no
  walkable cell of Copperleaf (4,670) or of a normal run's landing (4,070) turns any of it on; pictures of the five
  settings at the worst spot of the fixture's landing.
- **Not verified**: the full quick check (stopped for the merge, never finished). **After the merge check-fast fails on
  every page because main's last commit (6f7ae74, "Delete game/art/background directory") removed pictures the game
  still loads** (art/background/sky_light.png, cloud_light_*.png: 404, then the loading screen never goes). Not this
  branch's; main fails the same way. The owner decides: bring the folder back, or remove what loads it.
- Risky / open:
  - Phone cost not measured: about a 4x4 matrix product more per pixel in the drawn shaders while the fade is on (a
    uniform early-out when off), one extra player draw, ten height samples a frame. The owner's debug log from the
    Mountains run (frame times, `camRise`) answers it.
  - The fade's circle is fixed on screen (0.3-0.46 of the height); on a wide screen the hole may look small.
  - The far shadow map and the mist still sit at absolute heights.
- Next: the owner pushes the tag `tr-3-done` (sessions can't push tags) and plays the Mountains run on the phone. Next
  session on this branch: the rest of TR-2c (the hop arc already exists in walk-view.js updatePlayerHeight, only the
  dust puff is left; tall grass patches, waiting on wild Billies beyond 13 m of a place's middle; the main-road
  pathfinder through the massif, reusing mapgenTrailSearch; the four mountain route types; generated rope bridges,
  which the renderer already draws). Then the PR to main.

### Roguelite track RL-8b - Run look - 2026-10-22
Branch `ccr-b71dfee2-w5pwgh`, from main dcced21 (PR #105, TR-2). Proposed in RL-8's "Next"; the owner asked about
combining it with RL-9 (advised against: different areas, 4 sessions), then "Start RL-8b". Plan approved in Plan Mode,
with the owner's answers: rooms by lowering the shared dials (data only); a medium island (about a fifth of the
bowl's radius); a run laid across the bowl, no hub on it. Started without `rl-*-done` tags on the remote (the owner
knew; sessions can't push tags).
- Changed (one cause per commit):
  - **Rooms darker** (a807353): all 22 `int_*` rooms and `test_light_room` share one look from
    `tools/build-interiors.py`, with the sky light (`sun.ambient`) at 1.75 where the game's default is 0.2: now 0.5,
    exposure 1 (was 1.12); the builder writes the same, so `--force` won't bring the old light back. `roomLight`
    stays off (the owner's Studio choice of 2026-10-20). Headless, the lab at 13:00: brightness 146 (washed out) to
    105, the town outside 142.
  - **An island world for the bowl** (c3e7808, logic/bowl.js): the sea's settings take `island` (a radius, worldmap.json)
    or `isles` (rounds of land, from code); then no share quantile and no land rising to the rim: land is the places,
    roads and rounds, the coast where the distance past them plus the seeded noise crosses 0, sea always past
    `BOWL_ISLE_RIM` 0.86. Without them nothing changes.
  - **A seed for the bowl's noise** (749ca4e): the look's `seed` moves the hills, headlands, ground patches, tree
    clumps and clouds (`bowlSeedShift`); 0 moves nothing (the hub's picture is as before).
  - **The hub is Copperleaf's island alone** (f2e9eb1): worldmap.json `sea.island` 0.2, rough 0.8. Checks changed on
    purpose: bowl-sea's game-data sea test (now one island, 90-99% sea), the fast check's and the Bowl map test's
    rivers (1+ on an island) and sea share (70%+), the Studio Check's 30-50% warning (not on an island); the Studio's
    World map look has an Island dial. The camera is unchanged: its home view already frames the island.
  - **A run laid across the bowl** (c4c5370): `RUN_BOWL` is a line from the landing near the east rim to the boss near
    the west (x 0.72, rows 0.18 apart at most, lanes 0.1, bowed 0.06 north). A bowl spot can carry `up` (the way its
    map's north faces): `bowlCompass`, `bowlSeamTurn`, `bowlMapPoint`, `bowlMapTurn` take it, and the bowl's stamps,
    things and walk-scene horizon read their compass from `bowlCompass` (three copies of "north to the centre" gone).
    Run places are `up` 90, so their maps sit square east to west.
  - **Copperleaf off a run's map** (6bbd485): a spot can be `off`: no land, relief, ground, stamp, things, routes,
    weather, pin, tap or list row. Copperleaf stays world node 0 in a run (flying home, the save's checks).
  - **A run's own world map** (e4fff0f, new logic/run-bowl.js `runBowlLook`): from the seed (stream 'bowl'): a round of
    land under each place (its whole map on land), 3-5 lobes along the way, 3-6 islets; its own coast and noise
    seeds; near each place its biome's ground (biomes.json), between them the run's commonest biome's ground and
    trees. `worldPut` takes it (`worldExtra.look`), `worldHubBack` drops it, `worldMapLook` reads it.
  - **The latest deploy, always** (a1faf85, the owner's ask mid-session): sw.js asks past the browser's cache
    (no-cache; GitHub Pages lets files be kept 10 minutes, so a load right after a deploy could mix two builds), the
    worker registers with updateViaCache 'none'; the build names each deploy (vite.config.js stampBuild: the commit,
    in dist's version.js PB_BUILD and build.json); new update-check.js asks for build.json at start, on coming back
    to the screen and every 10 minutes, and on a new build saves and reloads when nothing is going on (no battle,
    cutscene, flight or window), after the worker updates; once a session per build. The debug log says which deploy
    (`deploy`). Off without a build (Start-Game, the checks).
- Risky:
  - The update reload is new behaviour on the phone: it was tried only in headless Chromium against the built site
    on a plain local server (no 10-minute cache there). If a reload ever lands at a bad moment, `updateSafe` in
    update-check.js is the list of moments it waits for. Art can still show one load late after it changes (it comes
    from the cache first, refreshed behind).
  - Every run already going moves its pins and land on the map (spots are never stored); nothing saved changes.
  - The run's land is worked out at run start and on resume as before (headless about 190 ms, the hub's 160-210 ms);
    the phone's time is in the debug log only if the Bowl map test is run.
  - Run places' red blocks on the headless map are the landmark standees drawn without their pictures (the old
    "red block" seen on Copperleaf since RL-7, headless only as far as known): a run now shows one per place. Look on
    the phone; if they are red there too, that's a fix of its own.
  - The airship flight and the walk scenes' far horizon draw the same bowl: in the hub they now show sea all round
    Copperleaf. The fast check's flight lands; nobody has looked at the horizon on a phone.
  - Rooms' light is tuned by eye on headless shots (software drawing); the owner's phone decides. The Studio's Engine
    section, "This scene", sets one room's look; the 23 share the builder's.
- Verified: unit tests (495), lint, typecheck, modules, check-data, format on the touched files, the whole fast check
  (13 of 13) and smoke (15 of 15) after the last code commit; the full quick check (run during the docs, 31 min): 45 of 54, the 9 that fail are
  the 9 stale steps that fail on main too (v34, v35, v38, v39/40, v43, v44's props scene, v46, alpha 0.4's shapes,
  phase 08's running after the alpha steps); "Time, weather and rooms" passes with the new room light (the lab's
  brightness 105 by day, inside the light lab's 40-215). Pictures (headless, 390 x 760): the
  lab before and after; the hub's map (one island, sea to the rim); runs from two seeds (two maps) and one seed twice
  (the same map).
- Phone check wanted: after this deploys, keep the game open in the background, let the next deploy go out, switch
  back: it should reload by itself (the debug log's `deploy` is the new commit); the Map tab in Copperleaf (the island); start a run and open the map (its own land, the landing
  in the east); walk a seam and look again; Fly home (the island again); the lab and Granny Juniper's cottage by day
  and at night; export the debug log.
- Next: the owner pushes the tags (`rl-1-done` .. `rl-8-done`, `tr-2c-done`, `rl-8b-done`) and plays the phone check;
  then RL-9 (Ranch A; open questions 8.2's per-run cap on ranch Billies, 8.16, 8.17). Left from the first play: the
  balance tuning with the run simulation's numbers.
### UI track UI-5 - Every screen onto the kit - 2026-10-22
Branch `ccr-0284fd60-fx7dki`, from main ca9aa54 (RL-8 merged and played); main merged in twice since (RL-8's
follow-ups, then TR-2: mountains, trails, ledges, runs east to west). Plan approved in Plan Mode; the owner's
answers: RL-8 played; one session (not split); per screen move, then reshape; swap the bottom bar now (my
recommendation for it taken: no Walk tab, the Guide from the Trainer card).
- Changed (one cause per commit; about 50 commits):
  - Setup: the dead gender pop-up deleted; tools/style-diff.py (computed styles of 33
    screens and states, light and dark, against a git revision; the proof that a move changed nothing); the fast
    check's "Every screen opens with its parts" (by the buttons a player taps) and a run town's shop; the icon test
    reads every game script; the fast check's world map step no longer tripped on a postcard (it failed ~1 run in
    3; TR-2 fixed the same flake by waiting for the postcard to close, and the merge keeps that fix alone).
  - JS: ui.js 3,048 -> 441 lines (about 170 of them the generated header): ui-bits, overlay, pending-windows,
    pixel-sky, profile, guide, team, billie-sheet, map-tab, walk-tab, walk-control, battle-input; openSettings into
    settings-screen.js. A screen's click cases became `<screen>Action(a, d)`, called from the switch at the same place.
    ui.js keeps the router (render, the top bar, the bottom bar, openTab, startGame) and the input listeners.
  - CSS: the old layers (style, battle, polish, screens, v05) 10,602 -> 4,117 lines: one file per screen (shell,
    walk-tab, map-tab, team, billie-sheet, guide, profile, bag, shop, settings, battle-screen, talk, dressing-room,
    debug-menu, title, things-to-do, friends), loaded after v05.css and before the kit; every move shown the same by
    style-diff; rules a later old rule overrode at equal specificity stay put. 75 rules nothing used deleted: the
    unused-CSS list 72 -> 2 (both the kit's motion.css).
  - Reshape: ui-kit.css .k-panel/.k-card/.k-btn/.k-action/.k-tab (the family outlines from uiTheme.json, the edge
    line in ::after); every .pb button (gold: the long hexagon), the top bar (a clipped ::before, the portrait breaks
    out), title boxes and section panels, Walk, Map, the Trainer card, the Guide, Team's storage, Bag, shops, Settings'
    presets, tabs, segmented choices and pick rows.
  - The bottom bar: <pb-nav-bar id="nav">, the hub's or a run's set (Map, Team, Bag; Lab and Relics hidden until
    RL-11/RL-12); no Walk tab (the open tab again, or Esc); the Guide from the Trainer card; the kit's labels through
    i18n.js i18nText. Checks changed with it.
  - Docs: ui-track.md ("UI-5 found", row done), ROADMAP, TESTING, CHANGELOG.
- Where the plan was wrong: see ui-track.md "UI-5 found" (the cascade makes a CSS move not a move; the target files;
  "moves only" vs a visible change; one test per screen didn't exist).
- ui-lint (start -> end): radii 167 -> 155, spacing 1,098 -> 1,033, shadows 195 -> 179, times 281 -> 269, CSS
  colours 745 -> 663, !important 207 -> 196, blurred rules 30 -> 29, innerHTML writes 57 -> 56; keyframes 77, fonts
  18, layers 61 and style= strings 43 unchanged. Report only; UI-6 enforces.
- Verified: the fast tier at every commit (lint, typecheck, 473 unit tests, modules, format, data, build); smoke
  (15 of 15) and the new screens check before every game commit; the UI gallery's 89 pictures after every CSS or kit
  change (remade once, on purpose, when .pb took the button shape); tools/style-diff.py 0 differences on every move
  (33 of 33 screens at the end of the moves); the style diff, the screens check and the icon test each seen to fail
  on a planted fault. Phase end: the whole fast check (15 of 15); the full quick check in parts (the container
  restarted during one whole run): every step passes except v34, v35, v38, v39/v40, v43, v44, v46, "alpha 0.4:
  props made of shapes" and, when run after the alpha steps, "phase 08: running" (it passes alone) - each red the
  same way on main ca9aa54 (the roster of 24, props and buildings data, the step order); the Studio check's ui,
  ui_tools and ui_screens; --selftest: 12 of 13 steps, the in-game test red on "Light lab" and "Opening: falling",
  both the same on main. The debug log's privacy check after the overlay move. Seen on headless pictures: every
  reshaped screen, light and dark; the bar in the hub and on a run; Dutch tab labels.
- Risky: the reshape is judged on headless pictures only; the phone is the judge. A clipped part loses its outer
  shadow (as UI-2's old sheets did). Inset frames (the Trainer card's gold) stay rectangular inside the cuts. The
  kit's outline rule carries one !important (square corners) against v05's own; it goes with v05. Moving the nav to a
  shadow tree: the tap-target and safety steps no longer see its buttons (the kit sizes them). Screens the style diff
  has no view of kept their CSS where it was (the opening, the postcard pop-up, the flight, joystick, photo mode,
  workshop, fishing). Parts given a kit class become position: relative unless their own rules place them (the place
  card and the Walk sheet among them; their children looked right in the pictures).
- Found for UI-6: the Studio's overlays on the gallery count 15 tap targets under 44 px and 45 texts under their
  contrast; Team now blurs 2 surfaces (UI-3b: 4).
- Phone check wanted: every tab and the world, light and dark; the bar in the hub and on a run (`?fixture=run`); the
  open tab tapped again; the Guide from the Trainer card; a sheet, the shop and Settings; text size large.
- Next: the owner merges and pushes `ui-5-done` (and `rl-8-done`); UI-6 (old layers gone, lint enforced,
  accessibility) or RL-9.

### Terrain track TR-2 (TR-2a mountains, TR-2b trails, TR-2c ledges) and runs east to west - 2026-10-21/22
Branch `ccr-526699d5-vjfbk5`, from main ca9aa54 (PR #103, RL-8's last commits; the owner: "RL-8 is done"). Plan
approved in the session ("Start"), then changed twice by the owner mid-session: "take way more inspiration from how
routes are built in Pokémon Gen 3-5" (research, then the plan adapted) and "runs should go from east to west".
- Changed (one cause per commit):
  - **TR-2a, mountains** (mapgen.js): `land.mountains` (0-1, up to 20 m) and `land.massif` (east and west, one side,
    back, north and south, back and sides, all round), kept in the dials only when given, so scenes made without them
    are byte for byte the same (no MAPGEN_VERSION bump for it). Ridged noise on warped ground under a massif mask with
    a ragged foot, its own `relief` seed; none near the road, hub, exits' stretch of edge or water. A quarter of the
    height is smooth land, the rest step-grid shelves a terrace's height apart, so steep ground is cliffs with scree;
    nothing planted across a cliff. Studio Generate card: the two dials and a "Mountains" reroll.
  - **TR-2b, mountain trails** (mapgen.js mapgenTrails, mapgenTrailSearch, mapgenCarveTrail): a footpath from the road
    up each massif side to a summit (highest gentle corner, 4 m in, 7 m from pinned or joined edges). Searched on a
    2 m grid with its heading (turns cost, hairpins most) within a 0.56 grade, avoiding water and smooth land steeper
    than 0.8; carved 1.8 m wide, starting level with the road cell, each cell's height from where it falls on the line,
    landings at hairpins, cuts below the land as negative raises (hand-made maps have them), stone steps where steep,
    ramps where gentle; a flat summit pocket, a marked spot `scene.spots: [{ kind: 'summit', x, z, y }]`.
  - **The reach check** (`mapgenWalkGrid/Reach/Unreachable`) takes `{ slope: true }`: the game's slope rule (over 1.05
    blocks) and steps measured on the whole standing height (smooth land plus raise), a bridge's deck walked. Off by
    default, so the old tests keep their meaning.
  - **Runs go east to west** (the owner): runSceneExits gives `east`/`east2` back and `west`/`west2` ahead; two links a
    side at 10 m and 54 m along the 64 m edge (t 0.15625, 0.84375: whole metres, the seam rules' 44 m); every run
    scene's east and west edges pinned to height 0 (new mapgen `pin`), since two parents' strips overlap on a 64 m edge
    (a 0.63 m step before); the run on the bowl is an arc on the south side, clockwise (RUN_BOWL a 270, span 120, r
    0.62). MAPGEN_VERSION 5 after merging main, where RL-8 took 4 (a run saved going north is left). Then, alone, the rename runExits `north/south` ->
    `ahead/back`.
  - **Debug**: the debug menu's Runs section has a "Mountains" box (the run's mod `dbg_mountains` in `run.mods`, so a
    reload makes the same scenes: mountains 1 on each scene's north side, with trails); the debug log's run line has
    `mods`, the place's `mountains` dial and `groundTris`.
  - **TR-2c, ledges and pockets** (the owner: "be inspired by how the routes work, don't copy them"): a `land.ledges`
    dial (kept only when given). The terraces' south fronts (toward the camera) dropping 0.35-1.8 m are walked as
    whole fronts (they zigzag) and cut into 3-10 m pieces, ledges by the dial's share (stepm flag 16: hop down, never
    climb), with a flight of stone steps now and then (a third of the time, at least every 24 m) as the way back up:
    the shelf above is a lane beside the road you drop off anywhere. `mapgenTraps` / `mapgenUntrap`: on the finished
    scene no ledge drops you where you can't walk back from. Pockets: two marked spots (`scene.spots` kind
    `pocket`) at the end of the longest walk, raised shelves first. `mapgenReach` with `{ slope: true }` honours ledges
    and returns walk distances. The debug run is now "Mountains and ledges"; the Studio has a Ledges dial.
  - Docs: terrain-track.md (the Gen 3-5 research with numbers and sources, what it changes, the owner's answers, TR-2
    split into 2a/2b/2c, ledges moved from TR-5 to TR-2c), roguelite-track.md (east to west), ROADMAP, TESTING,
    STUDIO, CHANGELOG.
- **The research** (terrain-track.md "How Pokémon Gen 3-5 build their routes"): wikis refused direct reads, so the
  numbers come from the Emerald decompilation's own map data (pret/pokeemerald), decoded for 13 land routes: 31-65%
  walkable (median 47%), 1-3 walkable levels, 10-80 ledge tiles (mostly jumping south), 3-6 grass patches of 15-70
  tiles, 4-17 trainers seeing 1-7 tiles (median 3), 1-9 items and 0-5 hidden ones, a gimmick a route. The owner chose:
  walkable to 15 m+ in one scene, routes stay open (70%+), ledges jump south.
- Where the plan was wrong: TR-2 was far too big for one session (split 2a/2b/2c). The terrain track's "big relief on
  the free E/W sides" is now north/south (runs east to west). A massif side with an exit gets no mountains (by design:
  exits' edges stay low), so on a run the free sides are north and south only. My first 15 m sweep bound was wrong
  (the probe had exits on the mountain sides).
- Verified (TR-2c): unit tests 486 (new mapgen-ledges.test); 80 ledge dial sets: no trap, every exit reached, stairs in
  74, two pockets each, about 25 ms more a scene; check-fast 13 of 13; smoke 15 of 15; in the page a ledge reads as
  a low bank across the meadow. **The full quick check: 9 problems, the same 9 steps fail on main** (old roster
  counts 117/61, empty voxel bushes, buildings without a plan, a biped walk cycle, the running-controls step: on main
  "copperleaf didn't open", here "float division by zero"): stale checks from before the fresh base, not this work.
- Verified (TR-2a/b): unit tests 481 pass (new mapgen-mountains.test; run-map, run-scenes, run-world-real, rng updated: the
  frozen dials snapshot remade with the same dials, the scene hash remade for gen.v only); lint, typecheck, modules,
  format, data. Sweeps: 160 trail dial sets reach every exit and every summit (237 summits); 240 mountain scenes at the
  dial's top with mountains on a side without exits: 96% reach 15 m, the lowest 12.3 m. check-fast: 12 of 13, the
  world-map bowl check failed once and passed on a rerun; it fails the same way on main (a flaky tap, not this work).
  Smoke 15 of 15. In the page (run fixture): the landing's sign points west; the mountains run draws shelves and
  cliffs at the back; the game's own findPath walks to a summit and stands at 10.4 m. The full quick check: see below.
- Risky / open:
  - **Summit height:** trails stop short of the highest ground: at the dial's top summits are about 11 m (median),
    15-19 m at best, while the ground reaches 17 m. The owner wants 15 m+: TR-2c's main-road pathfinder and longer
    trails along the 112 m axis should lift them.
  - **Phone cost:** a mountains scene's ground has about 167k triangles against about 82k flat (the shelves' walls).
    Not measured on a phone yet: the owner starts a test run with the debug menu's "Mountains" box and sends the log.
  - South mountains (toward the camera) hide the player until TR-3's rock fade and silhouette; the debug run uses the
    north side only. There is no "south only" massif choice yet.
  - A coast scene (seed 508701) has the sea's lowered bank cutting its road under the slope rule; it predates this and
    runs never use coast.
  - Ledges and pockets are generator features: runs don't use terraces or ledges yet (rules.json run.scene has no
    terraces). Turning them on for runs changes every run's scenes (MAPGEN_VERSION, the frozen dials): the owner's call
    after playing the debug run.
  - The quick check's 9 stale steps (above) want their own fix session (phase 13 style).
  - Summit height: two tries this session (the massif full height 4 m in; more summit candidates) gave nothing or
    broke trails and were reverted.
- Next: the owner plays a run with the debug menu's "Mountains and ledges" box on the phone and sends the debug log
  (frame times, groundTris); decides whether runs get terraces, ledges and mountains; pushes `tr-2c-done`. Left of
  TR-2: the main-road pathfinder, the four mountain route types, higher summits; grass patches along the route wait
  until wild Billies appear beyond 13 m of a place's middle (an RL change).

### Roguelite track RL-8 - Run loop and payout - 2026-10-21
Branch `ccr-0f465f3f-hh2rq2`, from main 1d35666 (RL-7 merged). PR #103 went up at the owner's "Push pr" before the
phase's end and was merged at 3f6f1c8; the owner played that build on the phone the same day. The rest (the full-check
step, the in-game phase, the fixes from the owner's play, the docs) followed on the same branch, with main (ca9aa54)
merged in (e18a604), for a new PR. Plan approved at the start ("Start rl8", the plan in Plan Mode). The owner's answers: the full 9-row map (8.8), with a 5-row short run in the debug menu; wild battles single,
a mini-boss a leader in doubles, the boss a third leader's strongest Billie as an Alpha, the 40-turn cap kept (8.9);
a wipe (or a trainer battle at the turn cap) ends the run, keep 1 Billie on a loss and the whole party on a win,
Billies from Copperleaf come back as they left; the opening is the fall only (8.20), Blake cut from it, Hazel's new
lines send you to the mast. The plan's decisions 1-13 were taken as written.
- Changed (one cause per commit):
  - Moves, no change in play, each proven against the code before it: `endBattle`'s arithmetic into
    `logic/battle-rewards.js` (`battleRewards`); battle weather (`WEATHER_TYPE_BOOSTS`, `battleWeatherOf`) and the wild
    odds by weather (`WILD_TYPE_BOOSTS`, `wildLikes`) into `logic/weather.js`.
  - Data: rules.json `run.start` ($600, 5 Copper Coins, 2 Potions), `run.healCost` (60), `run.shop` (2 always, 2 more
    drawn a day), `run.foes` (mini-boss +3 levels, $300; boss +5, $600); types, check-data, planted faults.
  - New `logic/run-loop.js`: the start's give, the heal price, a town's stock for a day, the run's foes (a leader per
    mini-boss node and the boss from the node's stream, none twice, own ids `run_<i>_foe`, no script, badge, egg or
    story conditions), a battle's seed, release pay (only Billies caught on the run), the payout's rows.
  - Leaks closed: today's challenges and the friends list's Map button stay in the hub; storage stays in Copperleaf
    (a 7th catch waits outside the team until one is released: `validSave` refuses a team of 7).
  - New `game/js/run.js` and `game/js/run-payout.js`: "Start a run" at Copperleaf's mast (a free flight: airship.js
    `startAirshipFlight(i, {free, from})`), landing beside the landing's mast (`standByMast`), arrivals saved to the
    account at once (game-state.js `saveNow`), "Give up the run" in the Map tab and "Fly home" at the landing's mast,
    `runOver(won)` (the payout phase, saved at once), the payout screen (rows, Capital, Seals on a win, a keep-one card
    per Billie on a loss), `runEndHome` (healed, by Copperleaf's mast), resume at boot (`runResume`), first-run hints.
  - Run scenes get buildings by node type (mapgen's `mast`, `clinic`, `shop` dials through `runSceneParams`): the
    landing's mast, a town's clinic and shop. The dials snapshot was remade on purpose.
  - Run battles: one seam in `newBattle` (hooks `runBattleStart`) gives every run battle a seed (`<node seed>|battle|k`)
    and the forecast's weather, and saves a checkpoint (`run.at`: phase `battle`, its number, the whole foe) to the
    account at once; saving is then held (`saveHeld()`, worked out from the save and the battle on screen) until the
    battle ends; a reload restarts it from its seed. Run rewards: no lose fee, egg or badge. A loss ends the run.
  - Run towns: one `clinicHeal` for every clinic path charges `healCost` a hurt Billie after a yes (free in the hub);
    each town's shop sells the day's stock; no rest stop; opening hours don't apply on a run.
  - Mini-bosses block the way north (the existing blocker rule) and fight doubles; the boss fights alone as an Alpha
    (`startTrainer` with `T.alpha`); beating it offers "On to the payout". `worldSetGraph` attaches a trainer only in
    its own world.
  - Determinism: on a run, wild odds by the forecast alone (`wildOddsBy`; a run has no hour, clear counts as sunny)
    and new ids from the run's counter (`r<runs>-<run.uidN>`).
  - `tools/test/sim/run-sim.mjs`: a whole run from its seed in Node (battles played by the AI on both sides, a fixed
    player policy), the same twice; `runStats` reports to validation/sim/runs.json; a sample in `npm test`.
  - The opening: New game plays the fall from the crust (the city scene no longer plays); Blake's entrance, Hazel's
    staged fight and his battle are cut (beats 37-60 and 75-83; his trainer, script and shots stay in the data);
    three new lines from Hazel after the starter pick send you to the mast; the welcome sheet mentions it. Postcards
    wait for the opening's end, not Blake's flags.
  - Debug menu "Runs": start a seeded run (short or full), win or lose the run. Debug log: the run line's phase,
    battles, hold, party size and money; a `meta` line (runs, wins, Capital, Seals). Numbers only.
  - Checks: `battle-rewards.test`, `run-loop.test`, `run-sim.test`, more cases in `run-state`, `run-world-real`,
    `weather` and `opening-script` tests; the fast check's run page "a run's battle held and started again after a
    reload; a loss, the payout (again after a reload) and home"; smoke's phone flow taps the mast and opens the run's
    sheet; the full check's step "RL-8: a run from the mast"; the in-game test's phase "A run: airship, nodes,
    payout". The in-game test's "Opening: Blake's first battle" went with the battle.
  - Docs: roguelite-track.md (section 0 "Corrected in RL-8", section 5 as built, section 8's 8, 9 and 20 answered,
    RL-8 done), ROADMAP, VISION (the opening), TESTING, NAMING, CHANGELOG.
  - Fixes from the owner's first play (their diagnostics log: "Autumn wood Landing: can't walk to: an exit, across a
    bridge"; "It got stuck"; "The bridge was turned the wrong way"): walk/heights.js blocked the steep ground under a
    bridge's deck, so a run's bridges over steep stream banks couldn't be walked (11 of 18 landings with bridges
    couldn't be left; the same on the RL-7 base); and mapgen laid a bridge from a road's first wet point to its last,
    so where the road ran beside a stream the bridge lay along the water and often ended in it. Now bridges go only
    where the road crosses a stream, square to it (within 25 degrees), dry at both ends, and the road is kept out of
    the water elsewhere (`mapgenRoadOverWater`, MAPGEN_VERSION 4).
- Where the plan was wrong: roguelite-track.md section 0 "Corrected in RL-8".
- Verified:
  - The fast tier at every commit (lint, typecheck, unit tests 455 -> 474, check:modules, format:check, check:data,
    build). New tests seen to fail on planted faults (each commit says which).
  - Smoke (15 steps) passed on 78f813d, 68d9020, 64b29f5, 94cbaf3, 37eb839, 6d2f257, ae67d51, 93c0ee8, a92382e,
    27f9acd, bf0a027, 3729b6a, 6265a88 and 1576dbc, each in a checkout of its own, and on the working tree for 3f6f1c8
    and 6e9bb2a. 4b0e984's smoke ran out of time twice while Chromium probes ran beside it; 93c0ee8 passed with it.
    Not smoked alone (each inside the next smoked commit): 27a3168, 7cad9ce, 4fa8257, 7b9c848, 6d8f70e, 6474fbe,
    7c4a81b, 1caf7c9, 78ca212, f23fc55.
  - In Chromium: the fast check's run pages (`--only=run`); the full check's step "RL-8: a run from the mast" alone
    (83 s); the in-game phase "A run: airship, nodes, payout" alone (10 s, nothing written while it ran); probes of
    the mast start and flight, a reload mid-flight, mid-battle (the same seed and first roll) and at the payout, the
    clinic ($120 for 2 hurt Billies, refused when short), the shop's stock, the mini-boss blocking and in doubles, the
    Alpha boss, the payout won and lost, Copperleaf after; the in-game walk check on every place of 10 runs (126
    places, 92 bridges) after the bridge fixes: every exit reachable, every bridge crossable.
  - Node sweeps: 200 runs, 2,500 scenes with the buildings: all placed, every seam joined, no new generator note;
    100 runs after the bridge fix: 421 bridges, none ending in water, all at 65 degrees or more to the stream.
  - End of the phase: FULLCHECK
- Run simulation (report only; the bounds are the owner's): on the placeholders a lone level-5 starter loses 50 of 50
  runs (31 on the landing, about 1.6 places); three level-5 starters lose 50 of 50 too (20 at the first mini-boss,
  levels 9-11 in doubles). No run reaches the boss.
- Risky or unfinished:
  - Balance is untuned (above); a bribe pays $600-900, more than a run's starting $600; leaders at low levels still
    field evolved species; the boss is a stand-in until the Voltron (RL-14).
  - Saving is held during a run battle by design: a kill after the result but before you tap past it replays the
    battle (accepted).
  - Robots are rebuilt from `saveData.parts`, which isn't a run field (only the debug menu gives robots today).
  - The debug menu's "Go there" walks past a mini-boss that blocks (a test tool).
  - The debug menu's "after the opening" story preset still mentions Blake; Blake's trainer, script and shots stay
    in the data, unplayed. Hazel's joke "hot tips" left with his battle.
  - Every run's scenes changed twice (buildings, then bridges); a run started before keeps its map and gets the new
    scenes.
  - One kind of bridge trap is left in principle: a deck end beside a terrace riser more than 0.34 m off the deck
    (seen once, BR20, before the bridge rework; not seen after it in 126 places).
  - Not in RL-8: relics, route trainers, event nodes, the return flight's animation, deadline hardening. Capital shows
    in the Map header (the Lab's board is RL-11). The phone's cost of making a run's scenes is still only in the debug
    log (`run.makeMs`).
- Phone check wanted: a new game (the fall, Hazel, the starter, the mast lines); a run from the mast; a landing or
  route with a stream (walk over the bridge); a town (paid heal, shop) and a mini-boss; kill the app mid-battle and
  reopen; win or give up, the payout, Copperleaf; export the debug log (the run and meta lines).
- Next: the owner merges this branch's PR and pushes `rl-8-done` (and the earlier tags). The owner's other notes from
  the first play are new work waiting for their choices (roguelite-track.md section 5): rooms too bright; routes wider
  than long (an HD-2D diorama); Copperleaf's world map its island alone; a run's own world map from its seed. My
  proposal: one phase before RL-9, "RL-8b Run look": routes laid east to west across the screen (wide and shallow,
  joined at their east and west edges), a run's world map generated from its seed, the hub's map Copperleaf's island
  alone, and the rooms' light; 2 sessions; the balance tuning after it, with the simulation's numbers.

### Roguelite track RL-7 - Run world - 2026-10-21
Branch `ccr-b5ce394e-4jhzbp`, from main dfc9d68 (RL-6 merged). Plan approved at the start ("Start rl7", then the plan
in Plan Mode); its decisions A-J were taken at my recommendations (none answered otherwise). Done in one session,
parts A and B both (the plan's split point wasn't needed).
- Changed (one cause per commit):
  - The game page loads `logic/mapgen.js` and the new pure `logic/run-scenes.js`: a run node's generator dials
    (`runSceneParams`: the run's seed, its biome, a 112 x 64 route, its exits as runExits places them with the ids the
    generator gives (south, north, south2, north2), the dials drawn from rules.json `run.scene` on its own stream, an
    edge strip from each parent's scene), its scene (`runSceneMake`: plus `locationId`, name, `mood`, `climate`), a
    run's scenes in order (`runScenesMake`), and the run's world tables (`runWorldTables`: Copperleaf at 0, a place
    `run_<i>` per node with `runNode`, map id `run_<i>_<tag of the seed>`, its own pool with its row's levels, the seam
    roads).
  - New `game/js/run-world.js` `runWorldSync`: the world follows the save. A run's world makes all its scenes at once,
    then game-data.js `worldPut` (scenes into gameData.maps, pools into POOLS, then `worldSetGraph`), then everything
    holding a node or place lets go in the same tick (seamless views and caches, the walk view, the bowl's spots,
    ground, sky, pick and pins, rooms and roam spot, a flight, the weather's scene); in the hub `worldHubBack`. Boot
    calls it before map look-ahead, `setSaveData` once boot has; a run whose world can't be made is left. The Studio's
    live edit keeps a run's scenes; the full test's walk list leaves them out.
  - Fixes found on the way: `runArrive` reads where you stand from `trip.node` (RL-6 read `run.path`); a hub save is
    checked against the hub's own places (`HUB_LOCATIONS`, `hubRoadCost`), whatever world is in.
  - Data: biomes.json `pool`, `battleStage`, `mood` (from each biome's legacy place); rules.json `run.scene` (dial
    ranges and choice weights; tried first on 40 runs, 501 scenes, all joined), `run.wild` (lv 3-5, +1 a row, back 2),
    `run.seamIn` (6). Schema, type, check-data, planted faults.
  - A crossing in a run is an arrival (`walkCross` -> `runArrive`: a day, the path, the reveal, the forecast) counting
    6 m in. Kept to the hub: things-to-do's visits and requests, postcards, friends' presence (node 0, "a run").
  - A run place's weather is its forecast for today (environment.js via `runPlaceWeather`; a forced weather and your
    setting first; no hourly forecast line; the walked view copies a scene's `climate`).
  - The bowl shows the run: pins as run-marks.js outlines (current gold, walked faded, '?' for the row after the next),
    nothing for places not shown yet (no pin, pick, list row, label, or name on a card), the day chip in the Map
    header, a week's forecast on a place's card.
  - A run place is stocked once a visit from its own stream (`encountersHere`, `encounterRunVisits`), no top-up by
    play time, 2 on a walk back.
  - Checks: the `run` fixture, the fast check's run page, the full check's step "RL-7: a run's roads", the in-game
    test's "A run's road", the debug log's `run` line (seed, day, deadline, node, arrivals, scenes, make ms; no names).
  - Docs: roguelite-track.md (section 0 "Corrected in RL-7", RL-7 done), ROADMAP, TESTING, NAMING, CHANGELOG.
- Where the plan was wrong (roguelite-track.md section 0): a scene takes ~30 ms in Node, not 136-451, so all of a
  run's scenes are made at once (0.4-0.9 s in headless Chromium); generation can't be "one hop ahead" per node (a
  child needs every parent); the world must follow every save swap, not just boot; `runArrive` and the hub save checks
  (above); run trainers, the landing's mast and towns' clinic and shop moved to RL-8 with their behaviour; 2a's
  "abandon a run made by another generator version" became "keep it" (J).
- Verified: the fast tier at every commit (lint, typecheck, unit tests 443 -> 455, check:modules, format:check,
  check:data, build). Smoke (15 steps) passed on every game commit through 6443bbe, each in a checkout of its own;
  the last two commits (encounters, the test phase and log line) weren't smoked on their own. New tests seen to fail
  on planted faults (a swapped exit id, a child without its parent's edge, the run's pools left behind, the position
  from the path, a hub save bounded by a run's world, the run's stocking taken out). In Chromium: the fast check's run
  page (12 scenes in 867 ms at boot, a seam walked to day 2), its battle page, the quick-check step "RL-7: a run's
  roads" (13 scenes in 707 ms, the next view ready on the way, day 2 and back to day 3, the hub back), the in-game
  test's "A run's road" alone (26 s, nothing written while it ran), the debug log's privacy check on the run fixture;
  probes: a run swapped into a live page and back, 3 m over a seam (no day) and 12 m (day 2), each place's weather
  = its forecast, the Map tab's pins, chip, cards and list. **Not finished when the PR went up:** the full quick check and `--selftest` (base
  dfc9d68 first, then the tip); their results follow in a later commit.
- Risky: the scenes' cost on a phone is unmeasured (the debug log's `run.makeMs` says; the plan guessed 1-1.5 s for a
  run, at boot or a save swap, with the loader frozen meanwhile). Two lanes 70 m apart on the bowl and scenes 112 m
  wide: their ground stamps overlap where they meet (F, judged on the phone), and the ground shows places whose pins
  are still hidden. The species a run place meets still follow the real hour (the wild odds by time of day), so a run
  isn't fully reproducible from its seed (RL-8's run-sim decides). The card's "Rest stop, $100" shows on run routes as
  on any route (RL-8's paid healing). Names ("Meadow Route", "Autumn wood Route") are placeholders (E).
- Found, not this phase's: on the bowl a place's landmark picture draws as a red block in headless Chromium,
  Copperleaf's in the plain hub too (the standee atlas holds the picture; not root-caused). Check it on the phone's
  map: if it shows there, it's a bug for the phase 10 look.
- Phone check wanted: `game/index.html?fixture=run` (its own save slot): the landing, a walk over the north seam
  (day 2) and back (day 3), a step over and back (no day), the Map tab (pins, '?', the boss, the day chip, a card's
  forecast), the weather, the debug log's `run.makeMs`.
- Next: the owner merges and pushes `rl-1-done` .. `rl-7-done`; then RL-8 (the run loop and payout: the airship
  start, a town with paid healing, the mini-boss, the payout, resume; the first playable cut).

### Roguelite track RL-6 - Run map and clock logic - 2026-10-21
Branch `ccr-86f70f38-ax8pda`, from main 3ab03d4 (UI-4 merged).

**Plan and answers.** The plan was approved at the start, with the owner's answers:
- 8.10: a day per arrival, backtracking included; deadline = the shortest walk + 3; no tick for healing or waiting.
- 8.18: 9 rows with lane switches.
- Reveal: the next row, '?' on the row after, the boss always.
- Biomes: the five with finished plants, each node its own.

The design was reviewed before the work started. From that review: every table is passed in, each choice draws from
its own stream, `runArrive` moves `trip.node` with the run, the payout fix lands first, and weather is proven
exhaustively in Node.

**Changed** (one cause per commit; nothing in the game calls the new code yet):
- **Weather**
  - `CLIMATE_WEATHER_ODDS` moved unchanged from environment.js into the new `logic/weather.js`, which both pages load
    before environment.js.
  - Then `weatherPick(climate, roll, season)` was taken out of `environmentWeatherFor`, same steps in the same order.
- **run-state**
  - The payout counts each node once (`runEnd` had used `path.length`, which counts backtracks).
  - `validRun` takes an optional node `biome`.
  - The types got `RunMap` and `RunNode.biome`. The forecast index is `[world node][day - 1]`.
- **Data**
  - Each biome got a `climate` (schema, type, check: an outdoor climate).
  - New data section `nodeTypes`: landing, route, town, miniboss, boss, each `{name, mark?, engine, weight?}`, with its
    schema, type, check and the `NODE_TYPES` export.
- **`logic/run-map.js`** (on the game page; it reads no game data):
  - The map: `runMapRows`, `runMapRowsFit`, `runMapMake`, `runNext`, `runBack`, `runExits`, `runSpot`, `RUN_BOWL`,
    `runWorldNode`, `runMapNode`, with `rules.json run.map`.
  - The clock: `runDeadline`, `runOverdue`, `runReveal`, `runNodeSeed`, `runForecastFill`, `runWeather`,
    `runMapStart`, `runArrive`, with `run.clock` and `run.reveal`.
  - Types and data checks for all three blocks.
- **Docs:** NAMING (the run map's words), TESTING, ROADMAP, roguelite-track.md (section 0 "Corrected in RL-6", 2e, the
  RL-6 paragraph, 8.10 and 8.18), CHANGELOG.

**How it works, for RL-7 and RL-8:**
- **Calls.** `runMapStart(run, {nodeTypes, biomes, rules: RULES.run})` at the mast, then `runArrive(saveData, i, same)`
  on each arrival. The first call takes the landing. It returns the day, or 0 if refused.
- **Numbering.** Map node i is world node i + 1. `path`, `to` and `runNodeSeed` count map nodes; `trip.node` and
  `forecast` count world nodes.
- **Exits.** `runExits(map, i)` gives each side's links west to east, with the t to put in `params.road.exits` and
  `mapgenEdgeStrip`.
- **The bowl.** `runSpot(map, i)` gives the `bowl` spot for the location row.
- **Weather.** `runWeather(run, i, day)` gives the day's weather for `environment.force.weather` and `extra.wx`, which
  is `{k, m}` built like things-to-do.js `battleWeather`.
- **Streams.** The map's are `map|shape|<row>`, `map|type|<row>|<lane>` and `map|biome|<row>|<lane>`. A node's
  weather is `<seed>|n<i>`, salted `weather|<day>`.

**Where the plan was wrong** (roguelite-track.md section 0):
- No climate existed anywhere, so a forecast had nothing to roll from. Biomes got one; RL-7 writes `scene.climate`
  from it.
- `weatherPick` needs the season, for the page.
- `runMapMake` takes no tier.
- The seam rules cap a node at two links each way.
- The run goes from the bowl's rim inward (every map's north faces the centre). A lane switch can't keep the hub's
  30°.
- The payout counted backtracks.
- **"About 14 nodes" and 70% two lanes disagree.** 70% gives 12.5 on average, 9 to 14. I kept the 70% the owner
  picked; 0.9 would give about 13.5.

**Map report** (1,000 seeds on the game's rules, 0.34 s with forecasts):
- **Nodes:** 9 to 14 (12.5 on average). Each map has about 4 routes, 4.4 towns, 2 mini-bosses and the boss.
- **Choices:** 2.75 forks a map; 23% of maps have a lane switch.
- **On the bowl:** roads turn at most 22° from their exits, a switch 34°.
- **Biomes:** meadow 33%, thicket 23%, lake 22%, autumn 12%, ridge 11%.
- **Weather** (all mild): clear 50%, cloudy 22%, rain 16%, fog 8%, storm 4%.

**Verified:**
- **Fast tier** green at every commit: lint, typecheck, check:modules, format:check, check:data, build, unit tests
  (425 -> 443).
- **Smoke** passed after every commit that touched the page (1, 2, the map, the clock).
- **Weather** is the same as before:
  - In the page, 61,320 picks (three years of 3-hour blocks, every climate) are identical on the base, after the move
    and after the extraction.
  - weather.test checks all 100,000 rolls against the old code, for 7 climates × 5 seasons.
- **Climates.** The biome climates were read off each biome's generated scene in the Studio page (8 seeds each).
- **Planted faults.** Every new test and data rule was seen to fail on one:
  - weather: `<=` for `<`;
  - the payout's old count, and validRun without the biome check (the first try at that test passed for another
    reason: fixed before pushing);
  - an unknown or `none` climate;
  - a bad marker, or no weights;
  - crossing links, swapped exits, mirrored lanes;
  - walking back free, one forecast stream, a shrinking reveal, the boss hidden, an unlinked arrival;
  - 13 rows, 4 mini-bosses, bad chances, stray keys.
- **The game and the Studio** open with no page errors.
- **The fast check:** 11/11 on the tip and on the base when rerun. Its first run on the tip had one red step: "the
  world map opens as the bowl: a touch on the map lands on IMG#". That is the step UI-4 saw fail in 2 of 5 CI runs on
  #80's commits, and nothing here touches the page's layout. Not root-caused: watch it on main.
- **The full quick check** was still running when the PR went up; its result is added below when it finishes.

**Risky:**
- environment.js now reads the odds and the pick from a logic module on both pages. It is proven the same, but every
  weather in the game goes through it.
- Towns are almost half the nodes: two town rows, plus a filler weight of 1 against route's 4. Tune `town.weight` in
  nodeTypes.json or `wide` after the first play.
- `run.path` keeps every arrival (validRun allows 5,000); unrealistic to reach.

**Not done (as planned):**
- RL-7: installing scenes, `scene.climate`, the pins and day chip.
- RL-8: calling it at the mast, the five-row first cut (`rows: 5, minibosses: 1` fits).
- RL-12: shops and `apart`.
- RL-13: tiers and hardening.

**Next:** the owner merges and pushes `rl-6-done` (sessions can't push tags); then RL-7 (run world).

### Phase 16 side work - every Billie from the part kits - 2026-10-21
Branch `art/kit-billies` (owner's request in chat: rework the existing Billies with parts from the kit). Plan approved;
the owner's answers: all 24 (starters too), phase 16's part table with gaps filled by me, kit parts as each stage's
native parts, per-line recolours plus kit extras. Taken as approved with my recommendations: starters become upright
bipeds, the gear goes, the hand-drawn art is kept. The preview was shown before the art was written. No tag.
- Changed (one cause per commit): tools/build-rework-placeholders.py renamed to tools/build-kit-billies.py (and its
  mentions); the builder now makes every form from tools/art-source/part-kit/builds.json (a part per bone kind with
  size and colour, extras on brow/ears/crown/chin/back/collar, slot overrides, arm rest angle), with squash and
  stretch torso frames, a blink found on each front head, and a fit to the 128 px stage box; `parts` on lines
  (schema, type, check-data: a kit part per slot per stage); the 12 hand-drawn starter sheets, layouts and rigs kept
  in game/art/next/billionaires/hand (rigs-hand.json) and the studies moved there from art/next/starters (the Studio's
  silhouette check no longer falls back to them); the 24 sheets, layouts and rigs rebuilt; every line's `parts`;
  roster.json (sheet, rig, silhouette ticked; `placeholder` dropped). Preview: docs/samples/kit-billies.png.
- Verified: 410 unit tests; check-data (schema step stubbed: the npm registry was unreachable; the lines validated
  against line.schema.json with Python's jsonschema; a planted unknown part was reported); smoke 15/15 (323 s);
  v36 green (12 starter rigs draw, the hurt pose squashes the torso, every piece moves, legs walk, heads flinch, the
  split at 32); v33 (double and Alpha battles, Billies in the world) and the 3D battle with a trainer fight won.
  **v34 red**, as on main: on main its walk-cycle probe finds quad, biped and bird still; here only biped (every
  Billie is a biped now). v36's motion audit shows the legs do walk, so the probe itself looks wrong; not fixed here.
  NOT run: lint, typecheck, format:check (packages unreachable); the full quick check and `--selftest`.
- Risky: five finals were shrunk to fit the box (Marsox 0.71, Everyotter 0.80, Harvestgoat 0.74, Kardashleon and
  Tremendoslug 0.84 of their recipe), so they stand about as tall as their middle stage; a taller box for finals
  would touch battle and menu placement. The Midnight coat swaps palette ramps, which the kit colours don't use, so
  it may barely show. Kontourlet's and Gildlet's eyes are too small to find, so they don't blink. Bios and the
  roster's design lines still mention boosters, boxes, the sweater and the hat (player-facing words left as they
  are). The 4-legged walk is gone for Musk and Gates; check it reads on the phone.
- Nothing reads `parts` yet: the Prime check still looks at sizes only; abominations and breeding will compare a
  Billie's parts with its stage's set.
- Next: the owner looks at the Billies on the phone (team, a battle, the grass, the Studio's Parts preview); then the
  bios without gear, and a decision on a taller box for finals.


### UI track UI-4 - Run parts - 2026-10-21
Branch `claude/ui-4-run-parts`, from main 167cc96, beside UI-3b (owner's choice). Before it, by the owner's ask, the
three open PRs were brought up to main and merged: #92 (the dialogue bubble: rewritten as a shape family in UI-3a's
format), #90 (flat plant variants: MAPGEN_VERSION 3, as MG-2 had also taken 2; the frozen scene hash and MG-2's
golden scenes remade, only props differ) and #80 (turned props: merged with one smoke run red, see Risky). Plan
approved by "start with ui4"; its three questions were taken at my recommendations (a canvas painter for the bowl,
the shapes below, the placeholder currency names as attributes).
- Changed (one cause per commit): logic/run-marks.js (an outline per node type: diamond boss, notched diamond
  mini-boss, hexagon town, chevron route, slanted event and shop, cut square landing, small diamond "?"; tone and
  state; SVG points, clip-path; `runMarkDraw` for the bowl's canvas, not called yet) with run-marks.test.mjs; six
  icons (capital, scrap, seal, clock, relic, check); motion.css `m-slam` and `m-flip`; game/js/ui-run-kit.js
  (`pb-day-chip`, `pb-forecast`, `pb-node`, `pb-coin`, `pb-pick-card`, `pb-payout`, `pb-nav-bar`, with
  `RUN_NAV_SETS`, `RUN_CURRENCY_ICONS`, `RUN_WEATHER_ICONS`), loaded after ui-kit.js; the gallery's run-hud,
  run-nodes, picks and payout sections; the picture baseline (89). Docs: ui-track.md ("UI-4 found"), ROADMAP,
  TESTING, CHANGELOG.
- Where the plan was wrong: see ui-track.md "UI-4 found" (the bowl's pins are canvas; no data to read yet).
- Verified: lint, typecheck, check:modules, format:check, check:data, unit tests (409) green; run-marks.test seen to
  fail with the boss drawn anticlockwise; picture tests 89 pass, and fail with the boss's top point moved; in the
  gallery, with motion on, the payout's rows come in one at a time and the total counts to 1,180, a currency chip
  counts, the face-down card flips, the bar sends pb-change; with reduced motion everything is at its end at once; no
  page errors. With UI-3b (#96) merged in: 425 unit tests, the Studio check's ui, ui_tools and ui_screens steps
  pass (one run stalled on the container's real-click issue, the next passed whole); UI-3b's overlay rules found
  four faint texts in the run parts (white on the dark side's light red, the payout's red, the bar's labels read over
  its hidden highlight), fixed: none left. The gallery's sticky bar lay over tall sections in the pictures and made
  payout's flaky; in the pictures it now stays at the top (11 pictures remade, the whole set stable over two runs).
  Not run (owner: skip checks): smoke on this branch, the full quick check, a phone look.
- Risky: nothing in the game uses the parts yet, so the page cost is one more module. The four remade light pictures
  (panels, cards) moved because the page grew, proven by taking the sections out. #80's smoke step "the world map
  opens as the bowl" failed in 2 of 5 CI runs on the same commits (a page element over the map at the tap points),
  passed in the others and here; main never showed it. Not root-caused: watch for it on main.
- Phone check wanted (the plan's "done when" is the gallery): the gallery's four new sections, light and dark, 320.
- Next: the owner merges and pushes `ui-4-done`; RL-7 draws the bowl's pins with `runMarkDraw` and the day chip and
  forecast on the Map tab; RL-8 builds the payout, pick and keep-one screens and the bottom bar's sets from these.

### Phase 09 batch 9, part 1 - turned props - 2026-10-21
Plan approved by the owner (free angles, Studio steps of 15°; rotation as its own PR before the 20 new props).
- Changed: a placement's `rot` (degrees, about its base point, the middle of its front) existed since alpha 0.4 for
  buildings only (bld3 walls, nav footprint, door). Every prop now turns: models (and their spinning parts), their
  decals and leaf clumps, model and sprite shadows, building-slice shadows, reflections, still pictures (standees),
  picture layers and flags, the nav footprint and posts, ground pads and ground shading, sunken footprints, the walk-to
  spot, lamp, window and smoke points, the AO patch, rooms laid in mirrored, mirrored blocks. One logic module holds
  the maths (game/js/logic/prop-turn.js, unit tested). Studio: [ and ] turn the selection 15° (Shift 90°, Alt 1°;
  R was already the road tool), several props turn together about their middle, a Turn box and buttons on the card,
  a facing arrow and turned footprint on the map. Schema: `rot` -180 to 180. Test map `test_props_turn`
  (tools/build-turn-test-map.py).
- Side fixes that come with it: a model's fixed decals now follow its few random degrees (they stayed square), and a
  model layer's shadow and reflection face its yaw (tower windows' shadows were square to the street).
- Risky or unfinished: a building you walk into still lays its room in square to the map; the Studio warns past 15°.
  The picture-box faces (models off, old building pictures) are skipped past 5°; the standee turns instead. The 3D
  battle's lane clearing still uses the unturned footprint (rough by design). Camera-facing pictures never turn.
- Verified: 291 unit tests (6 new). Headless Chromium renders of test_props_turn: models, leaves, fences, stalls and
  houses turn; walking checks on turned footprints. NOT run here: lint, typecheck, check:modules, format:check,
  check:data (the npm registry is blocked in this session, so eslint, TypeScript, prettier, espree and ajv could not be
  installed); the to-module blocks and expose lists were written by hand to match the tool. CI runs them.
- Next session starts with: CI results on the PR, then batch 9 part 2, the 20 solarpunk props.

### Phase 09 side work - flat plant variants and the generator - 2026-10-21
Branch `props/flat-sizes` (owner's request in chat, no phase file). No tag.
- Changed: tools/build-flat-variants.py draws four variants of each of the 60 flat plants the first cut uses
  (Copperleaf, its five rooms, the routes of meadow, lake, thicket, ridge and autumn), with the scene-prop kit itself:
  flowers from their own flower_bed / flower_patch call (sprig, cluster, drift, tall or scatter), grasses and reeds
  (tuft, clump, windswept, meadow), ferns (fiddlehead, clump, spread, tall), pads and ground cover (single, pair, raft,
  trail), low things (small, pair, row, big). Each is a `variants` row with form, weight and span; the props get
  `vary.size: 0` and ppm 32. mapgen.js (MAPGEN_VERSION 3 after merging main; 2 is MG-2's): a picture is never scaled (only models keep `s`), a prop
  with weighted variants gets one (`v`) from its own stream (`plants|variants`), and its footprint is the variant's.
- Left out on purpose: trees, shrubs, the mossy boulder, campfire, lookout tower, wind-sail flower and room furniture
  (they become models); crops (one design, place at 1) and flowers_meadow (no drawing code); rugs, wall clock,
  painting, window and chalk sun (always placed at 1; the wall things and rugs are still 34 px/m).
- Verified: the kit draws today's 60 pictures exactly (checked on every run); 240 pictures without soft edges,
  anchors as the prop tools set them; 353 unit tests (two new: pictures never scaled, the weighted pick); data check
  (schema step stubbed: the registry was unreachable); type check unchanged (14 errors before and after, none in
  mapgen); a generated meadow route seen in the game (headless Chromium, ?fixture=route with the route swapped in a
  throwaway copy): 679 variants drawn, no page errors. ESLint and Prettier could not run (packages unreachable).
- Risky: rng.test.mjs's frozen scene hash was remade on purpose (MAPGEN_VERSION 3). Copperleaf still places 52
  pictures at a scale (hand-placed; not touched). Picture trees in thicket and ridge (planned as models) now all
  stand at size 1 in generated routes.
- Next: Copperleaf's scaled plants to variants (one-off), the turn and lean of flowers (owner to decide), then the
  plants of the other biomes the same way once their kits are converted.


### Roguelite track RL-5 - Legacy parking and the world setter - 2026-10-21
Branch `ccr-ad41ba43-cf2age`, from main 3479f01 (RL-4 merged). Plan approved at the start with the owner's answers:
Copperleaf alone (its south exit and Route 1 gone), the other places moved to `game/data/legacy` with a read-only
Studio list, the bowl shows Copperleaf alone, Hazel's lines lose only the directions to parked places.
- Changed (one cause per commit):
  - The world setter: a snapshot of the tables game-data.js works out (`world-tables-real.test.mjs`) before anything
    moved; then `worldSetGraph(locations, roads)` (a move): `LOCATIONS`, `ROADS`, `ROADS_BY_NODE`, `LOCATION_BY_ID`
    filled in place, each place's fix-ups, trainers and boards attached, called once at import;
    `world-graph-set.test.mjs` puts a 3-place world in and the hub back (deep-equal, same objects). A world with no
    roads has none (an empty list used to make up a chain).
  - Mini-bosses: a trainer with `miniboss: true` stands on no stop (game-data.js, the schema, check-data, the Studio's
    check and its trainer editor's box); the eight leaders are mini-bosses with no `node`.
  - Directions cut (the owner's answer): Hazel's Hedgerow, Fizzwell-arena, Clovercrest and Tallgrass lines; Blake's
    "good as new" line keeps its id; Copperleaf's signpost, a townsfolk line and one of Granny Juniper's (all pointed
    at Marigold). `talk-before-scripts.json` re-recorded by hand.
  - `migrate` (no run on) drops what an old save names past the hub's places (visited, wild by place, requests,
    letters, today's visits). The golden record's double fight names Leader Rocco (crude) and was remade on purpose
    (the other three fights unchanged). Tests that use the old places as data read `oldWorld()`
    (tools/test/old-world.mjs).
  - check-data reads `legacy/index.json` (every listed file there and readable, nothing unlisted, maps and trainers
    against their schemas). A place without exits gets its hub view, so its rooms open in place (Pearlantis's didn't;
    Copperleaf's wouldn't have). The fast check and its fixtures start from Copperleaf (the room is Hazel's lab, the
    battle Leader Rocco).
  - The parking (one commit): 48 maps and 39 trainers `git mv`d; legacy/locations.json (48 places, old order),
    roads.json (all 57), the `before-cass` preset, README.json (what is here, the old stops, the leaders' old arenas);
    the game's locations.json is Copperleaf alone (node 0), roads.json `[]`, Copperleaf's exits and edge exits empty;
    the checks that need parked places retired in the same commit (the fast check's route, cave and flight; the
    `route`/`cave` fixtures; the full test's Road phase, back in RL-7). Then shops (18), jobs (4), the one region and
    the place-bound lore (48 places' pages, 22 chat lists, 5 legends, 2 clues), one commit each.
  - The full check's steps no longer need parked places (each change marked RL-5 in tools/check-quick.py); smoke's
    shop steps use a shop the check makes (`CHECK_SHOP`); the Unused report counts props the parked maps place.
  - The Studio's Legacy section (studio/js/legacy-view.js, group Legacy): the 48 places with their old stops, trainers
    and roads (named by the place at the other end), read-only, never in `studioState.D`; Copy into game brings a map
    back as a scene of its own in one undo step. The world map's card no longer says "Roads to ." when a place has none.
  - Docs: roguelite-track.md section 0 (below) and 2e, CHANGELOG, ROADMAP, TESTING, NAMING, STUDIO, SCRIPTS.
- Where the plan was wrong (roguelite-track.md section 0): 48 places and maps, not 47 (Copperleaf was index 46);
  trainers name their place by number, so the leaders needed the mini-boss branch (and neither check exempted
  tutorials: they passed because node 0 existed); more of story.json named parked places (lines 47-49, 67, the
  `before-cass` preset), and so did Copperleaf's own signpost and two people; a place with no exits opened as its
  plain map, where no room opens; `worldSetGraph` can't bump `seamlessWorld.gen` or reset the bowl (game-data.js is
  logic): RL-7's install does, plus the list of what holds a node; `gamedata.js` was 0.76 MB, not 13 MB (CLAUDE.md's
  gotcha is stale). Pushed back: fishing.json stays (keyed by water, Copperleaf has water); the postcard pictures
  stay. Not done from the plan: walk-view.js's `mapMoodName` still reads `gameData.locations` (shared with the Studio;
  a run scene should carry its own `mood`, RL-7).
- Verified: fast tier green at every commit (lint, typecheck, check:modules, format:check, check:data, build; unit
  tests 341 -> 358). Smoke passed before each game commit and on the last one, 7c35815 (15 steps, 200 s: the opening,
  Blake's first battle, a phone battle, the debug log with no names); the fast check (CI) 11/11 there (the town, the
  lab, a battle, the bowl with one place and a card on tap, the flight from Copperleaf to itself). The new tests were
  seen to fail on planted faults (the world swap, migrate's clean-up taken out). Probed in a browser: Pearlantis's
  door did nothing and now opens its room; Copperleaf without exits opens the lab, a house and Juniper's room in
  place; the Studio's Legacy section lists 48 places, Copy into game and Undo work, the Studio's data keys and what
  Save compares are unchanged, no page error; the Studio's Check has nothing new (8 findings not about Billie art, 95
  on the base). Sizes: `gamedata.js` 756 KB -> 557 KB, game/data/maps 7.3 MB -> 0.8 MB (legacy 6.9 MB, never fetched
  by the game; the service worker caches only what the game fetches). **Not run:** the full quick check and
  `--selftest` on the tip (the final run was stopped after smoke and the fast check passed). The base full check
  (3479f01) had 11 of 54 steps red (Walking's second road, v31, v34, v35, v38, v39/40, v43, v44, v46, alpha 0.4, phase
  08 running); the retargeted steps (da87295) were written from reading the code and checked only statically (the file
  parses, every name resolves), never run in a browser; the least sure are v32 via test_tiny, v37's building budget
  via test_hilltown, the rabbit that bolts, v43's flag and alpha 0.1's lab window. Run both before or after merging; a
  step red there and green on the base is RL-5's.
- Risky: the game now starts and stays in one place; the opening, the first battle and the hub were played by smoke
  and the fast check, not by hand on the phone. The bowl's land fills about 60% of the bowl whatever the places, so it
  doesn't read as an island until the sea share is raised in the Studio (picture sent). The leaders have no arena
  until RL-13 (debug menu and fixtures only). A backup file exported before RL-5 is refused on import (it holds old
  stop numbers); saves on the phone and account load and are cleaned. The CI checks lose routes, caves, road walks and
  flights to another town until RL-7/RL-8 bring run worlds. The daily "visit places" challenge can't be done with one
  place.
- Left as is (noted, not moved): the Guide's story pages "Route 1" and "The four arenas", three loading tips, the
  Marigold charter book and three people's lore name parked places (RL-8 rewrites the hub's directions); `rules.json
  legends[].scene`, `scenery.json` town flags, `biomes.json from` and the parked places' pools are dead data; "Rest at
  the clinic, free" shows for Copperleaf (it did before; RL-8's paid healing); check-data's seam offset rule rejects
  only an offset of exactly x.5 m (now logic/seam-rules.js:122, since MG-2; a small fix for later).
- Next: the owner pushes `rl-1-done` .. `rl-5-done` (sessions can't push tags); checks the bowl and Copperleaf on the
  phone; then RL-6 (run map and clock logic; MG-2 is merged).

### UI track UI-3b - Studio UI section, tools - 2026-10-21
Branch `ccr-dc41c006-00p8dj`, from main 00be53b (UI-3a merged). Owner's answers at the plan: real screens as the game
in a frame; before/after live side by side; the rule check as one report line, not in the Check badge. Mid-session
the owner started UI-4 in a parallel session and asked to skip the remaining checks.
- Changed (one cause per commit): the missing UI-3a entry; ui-lint's `RULES` renamed `UI_LINT_RULES`, then moved to
  game/js/logic/ui-lint.js (counts byte for byte the same); lines for every raw value (`--lines`); the file list found
  by following the pages (`uiLintCrawl`); the rule report in the Studio's Check (studio/js/ui-rules.js); which
  variables a dial writes (`uiDialVars`, by moving the dial and comparing sheets); Inspect (studio/js/ui-inspect.js,
  helpers in logic/ui-inspect.js); Connections on a UI dial; overlays (studio/js/ui-overlays.js: tap targets,
  layered contrast with gradients, glass depth and the blur budget); fixtures `team`, `bag`, `talk` with a `uiLook`
  message only a fixture listens to; real screens in the preview with the frame kept across redraws; before/after;
  Find and the ? sheet. The Studio check's `ui_tools` and `ui_screens` steps.
- Where the plan was wrong: see ui-track.md "UI-3b found" (Ctrl+L taken; the lint's lines; no fixtures; no DOM capture).
- Verified: fast tier at every commit up to the real screens (lint, typecheck, unit tests 371 -> 381, modules,
  format, data); each new test and Studio step seen to fail on a planted fault (lines one off, comments deleted, the
  `:host` rules left out, Connections not knowing UI dials, the fixture ignoring the look). `check:fast` green after
  the fixtures (2.5 min). `--only=ui,ui_tools,ui_screens` green after before/after. Skipped at the owner's word: the
  Studio check after the last commit (Find and the ? sheet: lint, typecheck, modules and format only), smoke, the
  73 gallery pictures (`check:ui`), the full quick check and `--selftest`. Run `check:ui` and smoke before merging.
- Risky: game/js/fixture.js and its message listener (fixtures only; check-fast passed). A game screen boots the
  whole game in the frame (25-45 s in this container; quicker on a desktop); before/after on a game screen runs two.
  The kept frame lies over the pane (position fixed, clipped): check it on the iPad. Contrast is a scan of computed
  styles: text shadows, filters and images aren't counted. Merging with UI-4: regenerate hooks.js (`npm run modules`).
- Found for later (UI-5/6): 45 texts under their contrast on the gallery (white on type pills, move tiles), 12 tap
  targets under 44 px, the Team screen blurs 4 surfaces.
- Next: the owner merges and pushes `ui-3b-done`; UI-4 is running in its own session.

### UI track UI-3a - Studio UI section, core - 2026-10-21 (entry written in UI-3b)
The UI-3a session (PR #93, branch `claude/ui-3-start-3q234o`) updated STUDIO.md, TESTING.md, ui-track.md, ROADMAP and
CHANGELOG but left no entry here; this one is put together from its commits (85bc555..203ac13) and those docs.
- Changed (one cause per commit): uiTheme.json version 2 (the surface split into light and dark, each shape family's
  cut, corners and radius as data, new groups depth, drop, space and motion, type scale and line height, preset
  names; the sheet it writes the same text, byte for byte, for the defaults and both presets); the theme sheet writes
  the new groups (every custom property on the gallery resolving the same); per-screen overrides read (`UI_SCREENS`,
  `UI_DERIVED`) and the contrast check moved into logic/ui-theme.js (`uiThemeContrast`); the dials as data
  (logic/ui-dials.js, `UI_DIALS`); the gallery takes a look from the Studio (`gallery.html?studio=1`,
  `galleryLook`); the Studio's UI look section (studio/js/ui-editor.js: every dial group, the whole game or one
  screen, ↺ and Reset, presets with + Save as preset, Hold to compare, the gallery as the preview, Find); the
  contrast check in the Studio's Check with Show me; `studioBroadcast` sends the look to an open game tab; the Studio
  check's `ui` step and `--only`.
- Decided by the owner: UI-3 split into UI-3a and UI-3b; "Save as" means + Save as preset (no Studio-wide Save as).
- Found: see ui-track.md, "UI-3 found" (the look's data held only colours, glass, cuts and fonts; overrides unread;
  the Studio's own CSS names clash with the game's, so the preview is the gallery in a frame).
- Verified (from the commit messages): the Studio check's `ui` step seen to fail on a planted fault (the gallery
  ignoring the look: five problems); the 73 gallery pictures matched for the no-op data commits.
- Next: UI-3b (the section's tools).

### UI track UI-2 - Kit v2: angular shapes - 2026-10-21
Branch `ccr-00069345-2zok4t`, from main 3479f01 (RL-4 merged, UI-1 in). The owner asked for the whole of UI-2 in one
session (no split). Two calls I made without asking (my plan's recommendations): the old `.pb` buttons and every
screen not on the kit keep their shapes until UI-5; the gallery's picture baseline is committed.
- Changed (one cause per commit): the missing UI-1 entry below; the shapes as data (logic/ui-theme.js makes each
  family's clip-path outline, 1 px edge ring and shadow ring; `shape.families` cut/rounded/square, `shape.stepped`;
  presets `stepped`, and `alpha05` now rounded; tokens.css holds the defaults, the edge and drop-shadow tokens);
  tools/check-ui-gallery.py; kit v2 (`pb-panel`, `pb-button` with the gold long hexagon, `pb-sheet` floating with two
  cuts, `pb-toast` a hexagon; new `pb-card`, `pb-tabs`, `pb-stat-bar`, `pb-field`; focus as a gold line round the
  outline); page side: sheets, the diamond inbox dot, `.pb-sel`, `hr.pb-rule`, `.pb-portrait`; team rows as solid cut
  cards with angular ten-cell HP and portraits breaking their circle; battle text, menu, move tiles, buttons and
  plates cut; the dialogue box cut with its portrait breaking the circle and a slanted name tag; diagonal wipes
  (`m-wipe`, `m-wipe-r`) for `.screen.enter` and sheets; the 40 icons from tools/build-ui-icons.py (the rounded ones
  redrawn); type glyphs (ui-kit.js table; `typeBadgeHTML` in ui.js, one line, the only ui.js change); the shared bot
  plate (`limbPipsHTML` in unit-card.js; battle plates and bot rows in steel, the old limb bars and their CSS gone);
  the gallery's baseline (73 pictures), `npm run check:ui`; `--z-below` for the new layers. Docs: TESTING, ROADMAP,
  ui-track.md ("UI-2 found"), CHANGELOG.
- Where the plan was wrong: see ui-track.md "UI-2 found" (few screens were on the kit; no picture tests existed; how
  clip-path, shadows and blur had to be layered).
- Verified: fast tier green at every commit (lint, typecheck, check:modules, format:check, check:data; unit tests
  351 -> 357, new: the shape polygons, tokens.css equal to the generator, the icons equal to their grids, each seen
  to fail on a planted fault). Picture tests: 73 pictures, two runs match exactly; a 2 px change to the card cut fails
  all five card pictures. Smoke: green after the page-side commits (280 s); after the last code commit one run had
  two timeouts (the full-test step and the Studio screenshot, both on 40 s software frame read-backs under load), the
  re-run straight after was green (205 s). Blurred surfaces: team 6 -> 4 (rows no longer blur); the others as before
  (walk 6, map 12, ledger 5, profile 4, shop 8, battle 3). Not run: the full quick check and `--selftest`; the
  graphics bench (needs a phone). I looked at every gallery section in light and dark and the wipes paused mid-way.
- Lint report at the end (report only): corners 167 raw / 45 token uses, space 1,098 / 219, shadows 195 / 16,
  keyframes 77 (11 in motion.css), times 278 / 28, fonts 18 / 215, colours 745 in CSS (was 709: the new edge,
  steel and limb colours) and 571 in game JS (was 561: ui-kit.js), `!important` 207, layers 61 / 8, blurred rules 30,
  `innerHTML` 57, `style="` 41.
- Risky: clip-path, drop-shadow filters and masks on many parts can cost frames on phones (the plan's risk): please
  run the Graphics bench on the team screen and a battle. The battle menu's card no longer scrolls itself (what it
  holds does, at the same 72vh). Old sheets lost their shadow (the scrim sets them apart). Jersey 15 at 10-12 px on
  the plates and limb pips: check them on the phone. The picture baseline is this container's Chromium; on another
  machine fonts may differ (remake it there with --update).
- Phone check wanted (the plan's "done when"): team (rows, a bot if you have one), a battle (plates, menu, tiles,
  the wipe into it), a sheet; light and dark.
- Not done: the Studio's dials for the shapes (UI-3), the run parts (UI-4), every other screen (UI-5).
- Follow-up asked by the owner in the same session: the dialogue box became a speech bubble (a `bubble` shape family
  with a tail; the bubble alone floats, wiggles and breathes, each new line pops it; still with reduced motion).
  Unit test for the tail, the dialogue pictures remade on purpose, smoke green (220 s). Check on the phone that the
  motion reads as subtle, not seasick, and that the tail doesn't meet a choice's buttons.
- Next: the owner merges and pushes `ui-2-done`; then "start UI-3" (the Studio's UI section) in a new session.

### Roguelite track RL-4 - Battle state injected - 2026-10-21
Branch `ccr-e32acdb2-oy1bny`, from main dcde38b (RL-3 merged). Plan approved at the start with the owner's answers:
turn cap 40 ending in a draw (8.9), a killed battle restarts from its seed (8.7, built in RL-8), Lullaby's text fixed.
- Changed (one cause per commit): the missing RL-3 entry below; a snapshot of the battle object `newBattle` installs
  (`battle-state.test.mjs`) before anything moved; `newFieldState` moved into the new `logic/battle-state.js`, then
  `makeBattle(kind, team, foe, extra)` (the same object); the engine reads its battle through `battleNow()` (the
  page's `activeBattle` unless `withBattle(b, f)` plays another), and `runTurn`, `enemyOnly`, `chooseAI`, `doSwitch`,
  `benchCandidates`, `catchOdds`, `catchRoll` take an optional battle last; the page calls (toast, save, open, play,
  sure catch, weather) go through the battle's host, `SILENT_HOST` doing none (the robot sim uses it); a battle on a
  copied team keeps its own `seen`, `bag`, `buddy` and leaves the save alone (`canUse`, `teamNeedsHp`, `applyItem`
  take a battle); every chance through `battleRoll()` (`b.rng` from `b.seed`, else `util.random`), the bribe and the
  egg drop included; `rules.battle.turnCap` (40) with type and data check; `turnCapCheck` ends a battle as `'draw'`,
  which `endBattle` treats as walking away (wild) or a loss (trainer); Lullaby's text 2-4 turns. Docs: TESTING,
  roguelite-track section 0, ROADMAP, CHANGELOG.
- Where the plan was wrong (roguelite-track.md section 0): 64 engine reads, not 56; 18 draws, not 16 (two
  `pickWeighted`); items and the buddy were save writes too; `B()` breaks the naming rule (`battleNow()`); no change
  to `setActiveBattle` and no `seen` copy in `endBattle` were needed.
- Verified: fast tier green at every commit (lint, typecheck, check:modules, format:check, check:data, unit tests,
  331 -> 341); the golden record unchanged at every commit (it plays with no seed, so on `util.random` as before).
  Each new test was seen to fail on a planted fault (a direct playTurnEvents, a save write of items, a crit on
  `random`, the cap check removed, a cap of 4 in the data). Smoke 15/15 (210 s: the opening, Blake's first battle,
  a phone battle, the debug log). The robot sim (`--quick`) matches the base commit exactly once the turn cap is
  lifted; with the cap a few long robot stalls end as draws (part win rates move by under a point). Not run: the
  in-game full test (`--selftest`, its double, Alpha and catch phases) and the full quick check, skipped at the
  owner's word; run `--selftest` before or after merging.
- Risky: every battle runs through the new paths; the unseeded play is proven the same by the golden record, not by
  hand on the phone. A draw is new to the battle screen ('A draw.' on the end button). `withBattle` sets a module
  value for the length of a call: a battle passed in must not open the page's battle screen (use `SILENT_HOST`).
- Not done (as planned): formats by node type and `extra.seed` from the run (RL-8), the effect-handler table
  (RL-12), the replay log (RL-15). Project Story S6 (Hazel vs Blake as a real battle) may proceed.
- Next: the owner pushes `rl-1-done` .. `rl-4-done`; then RL-5 (legacy parking and the world setter) or MG-2.

### Roguelite track RL-3 - State separation - 2026-10-21 (entry written in RL-4)
The RL-3 session (PR #85, branch `ccr-c4c4609f-eqjopt`) updated CHANGELOG, ROADMAP, TESTING, SECURITY and
roguelite-track.md section 0 but left no entry here; this one is put together from its commits and those docs.
- Changed (one cause per commit): the unused save field `v` dropped; `logic/meta-state.js`, `logic/ranch-state.js`,
  `logic/run-state.js` (`newRun`, `validRun`, `runBegin`, `runEnd`, `runRestore`, `payoutOf`, `runNodeCount`) with
  types and tests, loaded by the game page and not used yet; `rules.json run.payout` (placeholders, 8.18) with a
  check-data rule; `validSave`'s Billie checks moved into `billiesOk` (no-op); SAVE_VERSION 4 (`meta`, `run` null in
  the hub, `ranch`; `migrate` keeps a run's trip, plan and visited places bounded by the run's map); the set-aside slot
  keeps the latest unloadable save (it kept the first); the new-game notice says where to download a set-aside save.
- Decisions by the owner: every format 3 save is set aside (8.12).
- Risky: every save on the phone and account is set aside on first load of this version (intended). The account's
  older save goes to `-cloud-set-aside`, which nothing reads (one slot, two saves: owner's call).
- Verified: not written down by RL-3. RL-4 ran the fast tier on its merge commit dcde38b: lint, typecheck,
  check:modules, format:check, check:data and 331 unit tests, all green.
- Next: RL-4 (battle state injected) or RL-5 (legacy parking).

### UI track UI-1 - Theme as data, rules as a check - 2026-10-21
(Written by the UI-1 session after its merge; it replaces the entry UI-2 put together from the commits.)
Branch `ccr-901f764c-bv0rc7`, from 29834ca (the UI-0 plan on top of main 072f993); merged as PR #87, then RL-4 (#88)
on top. Plan approved at the start with the owner's answers: the uiTheme.json draft as shown, Jersey 15 scaled by
its font face (118%), the palette through variables only (raw colours wait for UI-5/6).
- Changed (one cause per commit): tools/ui-lint.mjs (`npm run lint:ui`, a report) with a fixture test;
  `var(--disp)`/`var(--body)` folded into `var(--font-voice)` (a no-op: v05 already set both to Pixelify Sans);
  tokens.css gains `--cut-sm/md/lg`, `--slant`, `--shape-*`, a `--z-*` scale on today's values and the `--c-*` colour
  roles on today's variables; the HP bars (battle plate, hpmini, pbar.hpb, unit card) read `--c-hp-*` with today's
  colours as fallbacks; game/data/uiTheme.json + schema + types + check-data (text and quiet text at 4.5:1 on ground
  and surface, every preset, both sides); Jersey 15 and Oxanium woff2 (Fontsource, OFL lines in OFL.txt);
  logic/ui-theme.js makes the sheet and theme-sheet.js writes it as `<style id="ui-theme">` after every stylesheet
  (the three light/dark selectors the CSS uses, so Settings' theme switch still works), the Studio's live draft
  rewrites it, both fonts preloaded; the UI gallery loads the data and gets a Copper Grove / alpha 0.5 switch; smoke
  logs the blurred surfaces per screen (`uiBlurCount()`). Side PR #86 (merged): `npm run build` had failed on main
  since PR #83 (the Studio self-test's lazy import made a second bundle).
- Differs from the plan: Pixelify Sans stays (36 KB) so preset `alpha05` really shows the old look; the dark side's
  highlight and shadows stay v05.css's (the surface dials split by mode in UI-3); `alpha05` is close to today, not
  exact (`--panel-s` and `--g-solid` became one surface); the theme-color meta is unchanged; only the latin font
  subsets ship (letters beyond Latin-1 fall back). Where the plan text was wrong is in ui-track.md (the fonts in use,
  the two colour sets, the counts).
- Verified: 324 unit tests on the branch (351 on main after RL-4), lint, typecheck, check:modules, format:check,
  check:data, build; smoke green before every game commit and on main after RL-4. The four no-op commits: the team,
  shop, ledger and profile pictures matched ones taken before (the others differ by capture timing: a camera pan, a
  fade). A headless probe: the sheet is there, `--text` #22301f, the plate's HP gradient teal, Jersey 15 and Oxanium
  loaded, `font-synthesis-weight: none`, no console errors; the gallery in both looks and both sides. Full quick
  check (50 min): 11 problems, the 10 known since RL-1 (v31 fountain, v34, v35, v38, v39/40, v43, v44, v46, alpha 0.4,
  phase 08 running) plus Crowd at 0.6 fps while other browsers ran here; Crowd alone passed (1.2 → 1.2 fps).
  Not run: `--selftest` (UI-1 changes looks, not play; smoke's one in-game step passed).
- Lint report (`npm run lint:ui`; it counts every length in a shorthand, so space and radii differ from the plan's
  table):

| Rule | Raw | Token uses | Worst files |
| --- | --- | --- | --- |
| Corners on the radius tokens | 168 | 59 | style.css 55, screens.css 53, v05.css 28 |
| Space on the --s scale | 1093 | 214 | style.css 462, screens.css 393, v05.css 101 |
| Shadows on the depth tokens | 189 | 22 | style.css 49, v05.css 40, polish.css 37 |
| Keyframes in motion.css only | 77 | 9 in motion.css | style.css 38, polish.css 12, screens.css 11 |
| Times on the motion tokens | 279 | 22 | style.css 89, polish.css 79, screens.css 47 |
| Fonts by token | 18 | 215 | loader.css 7, style.css 5, v05.css 4 |
| Colours as variables (CSS rules) | 709 | - | style.css 228, screens.css 166, v05.css 105 |
| !important | 205 | - | v05.css 107, screens.css 23, style.css 23 |
| Layers on the --z scale | 60 | 0 | style.css 24, screens.css 18, polish.css 6 |
| Blurred surfaces (backdrop-filter rules) | 31 | - | style.css 10, screens.css 7, v05.css 7 |
| Colours in game JS | 561 | - | dressing-room.js 96, opening-fall.js 81, battle-stage.js 64 |
| innerHTML writes in game JS | 57 | - | battle.js 13, ui.js 9, dressing-room.js 6 |
| style="..." strings in game JS | 39 | - | ui.js 15, unit-card.js 9, battle.js 6 |

  Blurred surfaces per screen (smoke): walk 6, map 12, team 6, ledger 5, profile 4, shop 8, battle 3 (budget 3).
- Risky: the look is mixed until UI-5/6 (purple raw colours in button gradients and shadows sit beside Copper
  Grove); Jersey 15 at 12-13 px labels needs the owner's phone look; the loader paints in the old fonts for a moment
  before the sheet loads; a look change moves every picture: remake the baseline (Actions → Check → "Make the picture
  baseline"). The repo has no picture baseline yet, so the full check compared nothing.
- Next: the owner looks on the phone, pushes `ui-1-done` and remakes the picture baseline. UI-2 came next (its
  entry above).

### UI track UI-0 - the plan - 2026-10-21
Planning only, in a chat session with the owner (the plan, the owner's answers to 36 questions, a Design mockup);
nothing built. Docs only, one cause per commit.
- Changed: docs/phases/ui-track.md (the plan: where it fits in the RL track, an audit of the code against the 06
  rules, the look, building notes, the Studio's UI section, UI-1..UI-6, risks, "Ask me before"); docs/ROADMAP.md (the
  UI track under Tracks alongside; phase 06's 06-5 absorbed into UI-5 and UI-6).
- Found (read at 072f993, pattern scans, not runs): raw values outnumber tokens about 4 to 1 in game CSS (200 raw
  radii vs 81 tokens, 746 raw spacing values vs 152, 91 keyframes, 205 `!important`); ui.js 2,952 lines; the Studio
  shares no tokens with the game.
- Decided by the owner: chamfered cuts (two opposite corners on panels), smooth with a stepped preset, a bit less
  blur, the Copper Grove palette with teal healthy HP, Jersey 15 + Oxanium, BW2 menus with Medabots bot plates, the
  round list, one bottom bar whose tabs change, showy rewards, diagonal wipes, uiTheme.json with colour and shape
  overrides, all four Studio tool groups, every screen reshaped in UI-5, 06-5 absorbed, lint report-only then enforced,
  start now beside RL-3.
- Risky: nothing ran against the code; every count is a scan. The mockup's sprites were assembled by hand from the
  rig sheets (draw order guessed). Jersey 15 has one weight: check small labels on the phone.
- Next session starts with: "start UI-1" (docs/phases/ui-track.md), in Plan Mode, beside RL-3.

### Roguelite track RL-2 - Golden record and RNG module - 2026-10-21
Branch `ccr-a09a396b-vfdptc`, started from main c66bf2b (RL-1 merged; `rl-1-done` not yet on the remote).
- Changed (one cause per commit): `tools/test/battle-golden.test.mjs` + snapshot first (single wild, double trainer,
  Alpha, robot vs Billie on the game's data, both sides played by `chooseAI`, every event without uids and the end
  state); `mapgenHashString`/`mapgenRandom` moved unchanged into the new `game/js/logic/rng.js` (both pages load it
  first among the logic modules), then renamed `hashString` and `rngFrom` (one rename per commit, `rename.mjs
  verify`: pure renames); `rngFn(seed, salt)` and `dailySeed(now)` (`'d'` + UTC date) added with
  `tools/test/rng.test.mjs`; `pickWeighted`, `rollPartSize`, `rollBuild`, `spawn` take an optional `rnd` (default
  util.js `random`, so play is unchanged; nothing passes one yet). Docs: TESTING.md, roguelite-track.md section 0
  (where the plan text was wrong), ROADMAP.
- Verified: 302 unit tests, lint, typecheck, check:modules, format:check, check:data, smoke (all green, 203 s).
  The golden record passes unchanged at every commit after the first, and a planted fault (+1 damage on every hit)
  turned all four fights red. `rng.test.mjs`'s frozen values (first five draws, a string hash, a generated scene's
  hash) were taken from mapgen.js at c66bf2b, before the move. The Studio's Generate card: the GitHub check's
  generate step passed in a temporary copy that skipped the steps before it (the unchanged script still stalls at the
  story preview click, as in RL-1).
- Risky: the golden record and the scene hash read the game's data, so a content edit to moves, species, trainers,
  robots, scenery or biomes turns them red; remake on purpose (`--test-update-snapshots`) and say so in the commit.
  The full quick check (47 min) was not run; nothing on the page changed apart from one more module tag.
- Not done: `spawn`'s species odds still go through `environmentOdds` (real-clock weather), so a seeded spawn is only
  reproducible while the weather is the same; RL-6/7 feed it the run's forecast. Battles still draw `Math.random`
  (RL-4's `b.rng`).
- Next: the owner pushes `rl-1-done` and `rl-2-done` and answers RL-1's tools question; then RL-3 (state separation)
  or RL-4 (battle state injected), both unblocked.

### Roguelite track RL-1 - Hardening - 2026-10-21
Branch `claude/rl-1-start-enwmnf`. Every tier could run this time: `npm ci` works, and Playwright works once the pinned
`pip install -r tools/requirements-check.txt` (1.56.0) is used (the newest one wants a browser the container lacks).
- Changed (one cause per commit): PR #78's leftovers (`npm run modules`, prettier); the world map's `mthing` shader puts
  aCol on the standard location 2 (was 7: the full test's shader check, the smoke check's one red step, from phase 10);
  the set-aside fix (writer and reader moved to game-state.js in a move-only commit, then one writer and one shape
  `{json, from, at}`; Settings > Save now shows an older or newer save it can't load, with Download only); the Studio
  sign-in links a fine-grained single-repo token (SECURITY A) and Remember me starts unticked (B); eslint.config.js
  header and SECURITY.md brought up to date; `rng-baseline.test.mjs` + a TESTING.md paragraph on where randomness
  comes from; roguelite-track.md section 0 corrected.
- Not done, waiting for the owner: deleting the 16 version-stamped tools. The plan was wrong: most are live
  (`build-scene-props.py` execs the 5 `scene_props_v*.py`, `build-props-a04.py` imports `build-buildings-v46.py`,
  `build-terrain-v47.py` is the ground generator). Only `build-regions-v47.py` and `build-loader-v47.py` are clean
  one-offs; `build-places-v46.py` (+ `build-v28.py`, which it imports) was kept on purpose in MG-1.
- Verified: 290 unit tests (2 new files; the set-aside test fails on the old code), lint, typecheck, check:modules,
  format:check, check:data; smoke 15/15 after the shader fix. `check-studio-github.py`: sign-in and all 24 sections
  pass, then it times out clicking the story preview checkbox; the same at the base commit c2d51d6 (a real mouse click
  never completes while the preview draws with software GL here; a script click works). Not in CI.
- Risky: the full quick check (47 min) has 10 red steps of 54: the v31 fountain, v34 walk cycles, v35/v38/v39 roster
  counts (117 wanted, 24 now), v43/alpha 0.4 empty bush voxel recipes, v44 props scene, v46 buildings without a plan,
  phase 08 running speeds. They look like checks for content the scope reset removed or changed, not RL-1 changes;
  a base-commit run is the comparison (see the next entry or the PR).
- Next: the owner answers the tools question and pushes `rl-1-done` (and the old tags); then "start RL-2".

### Roguelite track RL-0 - the plan - 2026-10-20
Planning only (the owner's brief, in Plan Mode); approved by the owner; nothing built. Branch `claude/new-session-qv8ou7`.
- Changed (docs only, one cause per commit): docs/phases/roguelite-track.md (the plan: findings, the old phases'
  status, the RL-1..RL-16 table, architecture decisions, design answers, each session's files and tests, the first
  playable cut, what to leave alone, risks, the 20 "Ask me before" items); docs/ROADMAP.md rewritten around the track
  (old phases marked done, parked or absorbed); docs/VISION.md "How the game plays" rewritten for the roguelite;
  CLAUDE.md gains the roguelite ground rule and loses the stale camTo/dioTileHalf gotcha (replaced by the hooks.js rule).
- What was found (verified at e3df43a): PR #78's HANDOFF entry says its validation never ran; the remote holds one
  tag, `Baseline` (no phase, Studio or map-generator tag ever reached GitHub, so CI's tag-triggered full run has never
  fired); `util.js random` is `Math.random` (only the tests seed it); the engine reads `activeBattle` from hooks 56
  times and shares `saveData.team` by reference; node indices are identity everywhere and `migrate()` resets the trip
  at load; mapgen is Node-safe but not loaded by the game page and makes routes only; phase 19 (battle core: seeded,
  replayable, two-sided) exists only on `plan/engine-phases-19-21` and is adopted as RL-2/RL-4; a set-aside key
  collision between game-state.js and account.js; the brief's `startGame` 574 lines is 40 (ui.js:2263-2302).
- Risky or unfinished: nothing in this session was executed against the code (no node_modules, no Playwright in the
  container); every line number is a read, not a run. The old-phase status table was read from HANDOFF alone, not
  re-verified in the code. The seam layout (exits at t 0.25/0.5/0.75 on the 112 m side) and the run's timings are
  design reasoning until MG-2 and the run sim prove them.
- Verified: docs only; the plan's factual claims were checked by three code-reading passes and one spot check of
  the synthesis (weather seam, the pinned Date in check-quick, fixture places, encounterStock, story.json:38/66,
  condition kinds, mapgenPutProp, coatRoll, the 26 m seam bands, no serverTimestamp).
- Decisions the owner made this session: the rework is a track (RL-N, `rl-N-done`) rather than phases 23+; parked
  phases stay in the roadmap marked parked; the first playable cut is RL-8; the order after it follows the brief
  (ranch, hub upgrades, relics, modifiers, bots, online).
- Questions waiting for the owner: the 20 items in roguelite-track.md section 8 (answer the RL-1 ones first: the
  Studio token options A and B, deleting the 16 version-stamped tools); push the outstanding tags from your machine.
- Next session starts with: "start RL-1" (roguelite-track.md, section 4, RL-1 Hardening), in Plan Mode, beginning
  with PR #78's unrun checks.

### Parts fixes, step 1 - 2026-10-20
- Changed: DOM rig previews select front/back metadata consistently with the requested view. Bot refits and equipped upgrades capture maximum HP before mutation and preserve the HP fraction afterward; fainted bots stay fainted.
- Verified: all 279 unit tests pass (16 new cases); the new tests fail in 9 cases against the original code. Lint/naming and module consistency pass; changed-file formatting and diff whitespace checked.
- Verification limits: browser smoke could not start because Playwright is unavailable. Typecheck was attempted but TypeScript 7 crashes because /proc/self/exe is unavailable in this environment. CI/browser verification remains required.
- Next: step 2, a compatible-parts library picker in the Billie editor. No part-swapping UI changes in this patch.

### Parts fixes, step 2 - staged Billie part replacement - 2026-10-20
- Changed: Billies Part mode has Replace from Parts Library, body-group/kit/type filters, thumbnails, front/back comparison, staged assembled previews, paired limbs, scale/rotation/offset controls, palette matching, and motion selection.
- Apply appends new crops, preserves existing bones/roles, isolates shared images, and groups pixel changes with metadata in one undo/redo step. Missing views keep their old art; static-frame loss and unchanged children/portrait are explained in the picker.
- Fixed Studio rig cache keys to include species and view: shared sheets must not reuse the front skeleton for the back preview.
- Verification: source syntax and four transaction checks plus compound-history checks passed in an isolated JavaScript runtime. Node suite, generated-module consistency, formatting, typecheck, and browser QA could not run locally because the execution environment is unavailable. This is a draft pending CI and browser verification, not a completed validation claim.
- Next: run full validation and exercise save/reopen, undo/redo, front/back motion and phone-width layout; then step 3 socket-based child positioning and step 4 assembly recipes.

## Entry template
### Phase NN - <name> - <date>
- Changed: 
- Risky or unfinished: 
- Verified (what ran, what passed): 
- Decisions I made (and why): 
- Questions waiting for the owner: 
- Next session starts with: 

### Studio track ST-6 - species sheets in Part mode, skeleton builder and wardrobe on the shared canvas - 2026-10-20
Plan approved at the start (owner: "Ask questions and continue"), with my recommendations picked: the builder keeps its
posed stage, a Grow piece button, frames move together, split off the wardrobe if the session ran long (it did not).
- Changed (one cause per commit):
  - logic/rig-joints.js + the skeleton tests (tools/test/rig-joints.test.mjs, every species).
  - Skeleton builder: its pivot drag calls rigSetPivot (the same rig, by the tests); then whole-step zoom fitted to
    its stage, the pixel canvas's view keys (+, −, 0, 1-6, O), Paint pixels with the part picked, Parts on the
    workbench.
  - Part mode's Billies source (workbench-species.js): a species' pictures on the sheet, pivot, sockets (children),
    the box's edges, frames, z per view, the species as drawn; opened from the Billies section and the builder.
  - Pixel canvas: `companions` (other pictures changed by a stroke, one undo step).
  - Wardrobe on the pixel canvas: the item's picture with the trainer faint behind the piece, the mask following each
    stroke, the Colour area brush (mask only), Grow piece, adding a piece undoable; its own 30-step undo is gone.
  - Studio check steps (species in Part mode, the builder's zoom keys, the wardrobe); STUDIO.md, CHANGELOG, track.
- Risky or unfinished:
  - Tags still can't be pushed (HTTP 403). `st-5-done` (on 33a2cd4) and `st-6-done` (this branch's last commit) exist
    only in this container; please tag them after merging.
  - The wardrobe is no longer painted right on the trainer: the trainer shows faint behind the piece on the picture,
    and the pieces on the body sit beside it (drag there to move one). Please try it; it is the biggest change in feel.
  - Grow piece copies the piece to the bottom of the pictures (the old place stays, unused), as growing did before.
  - A pivot moved keeps the figure still in the neutral pose (as the builder always did); a bone its body plan turns
    even in the neutral pose turns about the new point in other poses, as it should.
  - Part mode shows the back sheet as it is; the game draws the back view mirrored (said in the inspector).
  - An undone picture stays marked unsaved with its old pixels (every painter, older than ST-6).
  - Sheet mode (workbench.js) still uses paneRoot() in code that runs after drawing (from ST-5).
- Verified: npm test 253 pass (10 new rig-joints tests); lint, typecheck, check:modules, format, check:data clean. The
  full Studio check passes (all steps, new: the builder's zoom keys; Parts on the workbench from Billies, the head's
  pivot dragged and nudged with the figure drawn the same, an edge, a back z, all undone; the wardrobe's stroke and
  mask as one undo step, undone and redone, the Colour area brush, Grow piece, all undone; a proposed PR). Pictures
  at 1400, 1600 and 3440 px wide (headless). check:smoke: 1 problem, the same mthing shader location as ST-5 (on main
  too). Not tried by hand on a tablet or the 3440 screen.
- Questions waiting for the owner: is painting beside the trainer (not on it) fine for the wardrobe? Should Grow
  piece grow in place when the space around a piece is empty? ST-5's three questions are still open (turn limits in
  the game's poses, gem points, the mthing shader).
- Next session starts with: ST-7, Model mode import.

### Studio track ST-5 - robots on the workbench - 2026-10-19
Plan approved at the start (owner: "Sounds good"), with my recommendations: sockets per part in robots.json `art`,
stand-ins always computed, draw order and turn limits stored too, the ST-4 entry and tag first.
- Changed (one cause per commit):
  - The missing ST-4 handoff entry; tag `st-4-done` made locally (see Risky).
  - A parity test before any change: tools/test/robot-rig-before.json, a hash of every build's rig as robotRig made
    it (972 builds, with pictures and as stand-ins, front and back), its data and picture sizes frozen inside.
  - robots.json schema, types and data check: optional `art.joints` / `art.headJoints` (per view pivot, a torso's
    sockets by the socket standard, z), `turn`, `headTurn`. No data changed.
  - game/js/logic/robot-joints.js (+ tests): computed joints (today's numbers), stored-or-computed per view, robots.json
    as a part kit for Part mode, setting one point.
  - robot-art.js `robotRig(sp, D, k)`: the pictures join at their joints; view k's joints place the bones
    (skeleton-rig.js passes k). Identical to before for every build, also with every point stored.
  - Part mode: a Robots source (drag or nudge in whole pixels, Back to computed, turn and z, test fit on a torso,
    never mirrored); the robots redraw after each change. Part mode now works in the second pane (it looked its
    elements up in the left pane after loading pictures; an ST-4 bug).
  - Battle preview: robots can fight (the Robots section's Try a build and the trainers' robots); before, its
    pickers took Billies only and it loaded Billie sheets for any fighter.
  - Robots section: where each part's pictures join, and "Edit joints on the workbench" / "The head's joints".
  - Studio check step (robots in Part mode beside the battle preview); STUDIO.md, CHANGELOG, track file.
- Risky or unfinished:
  - Tags can't be pushed from these sessions (git push of a tag gets HTTP 403; only the session branch is
    allowed). `st-4-done` and `st-5-done` exist only in this container; please tag them yourself (st-4-done on the
    ST-4 handoff commit, st-5-done on this branch's last commit after merging, or tell me which commit). The other
    st-N-done tags were never pushed either.
  - Turn limits are stored and used by the test fit only; the game's biped poses don't read them.
  - The back view's `at` used to be the front's; it now comes from the back view's joints (the same numbers unless
    a back point is stored). geo.top stays from the front view.
  - Sheet mode (workbench.js) still uses paneRoot() in code that runs after drawing; untested in the second pane.
  - A gem's point is always its centre (nothing stored).
- Verified: npm test 243 pass (the robot build tests in robots.test.mjs, the new robot-joints tests including the
  972-build parity, also with every point stored); lint, typecheck, check:modules, format, check:data clean. The full
  Studio check passes (all steps, the new robot step: opened from Robots, two robots in the battle preview, bulwark's
  shoulder dragged and nudged moves the arm the stage draws front and back, the test fit, back to computed, all
  undone; a proposed PR). It had been hanging: the workbench step left its blobs sheet in, so Part mode's step
  stopped at a "replace?" question; the workbench step now drops its sheets. check:smoke: 1 problem, the in-game full
  test's "Shaders: mthing: aCol sets location 7, the engine's standard is 2" (world-bowl.js); main 9b731cf fails the
  same way, so it is not from this session and not fixed here. Not tried by hand on a tablet or the 3440 screen.
- Questions waiting for the owner: should the game's poses respect the turn limits? Do you want gems' points
  editable too? Should I fix the mthing shader location (phase 10) in its own session?
- Next session starts with: ST-6, species sheets in Part mode.

### Studio track ST-4 - the Art workbench, Part mode - 2026-10-19
Written at the start of ST-5 (the ST-4 session merged as PR #71 without this entry or its tag); taken from its commits
and the track file's ST-4 notes, not from that session's own report.
- Changed: partKits.json room for joints (per view pivot, S/L pictures, z, turns, sides, socket rules, mirrorOf; all
  optional) and kind defaults; logic/part-joints.js (+ tests); pixel-canvas host tools follow a drag; Sheet mode's
  Write keeps Part mode's work; studio/js/workbench-part.js (Part mode); a Studio check step on cat_leg; STUDIO.md,
  CHANGELOG, track file.
- Risky or unfinished: any Studio save drops `_help` from partKits.json, portraits.json, robots.json and rules.json
  (the undo snapshot and Save leave out `_` keys; older than ST-4, not fixed).
- Verified: per its commits, unit tests and the Studio check's Part mode step. Re-checked at ST-5's start: 236 unit
  tests pass on 9b731cf.
- Next session starts with: ST-5, robots on the workbench.

### Studio track ST-3 - the Art workbench, Sheet mode - 2026-10-19
Plan approved at the start. Owner's picks: the part list becomes data (game/data/partKits.json); kit sources stay in
tools/art-source and are sliced again by dropping them (settings kept per kit).
- Changed (one cause per commit):
  - Moved game/art/next/parts/parts.json to game/data/partKits.json (key `partKits`); schema, types, data check (every
    picture there at its size, in its view's folder); kits.json's kits, slots, pivots and sockets moved into it.
  - logic/sheet-slice.js (+ tests, a PNG reader for Node tests): keys, masks, islands, rows, grid, trim, names,
    front/back matching, Aseprite JSON, and the kits' steps as the Python slicer ran them (scipy, Pillow's box filter).
    logic/pixel-snap.js (+ tests): pixel size and grid of art drawn big, most common colour per cell.
  - The parity test: all 6 kit sheets give the committed 120 parts exactly (240 pictures, sockets, manifest order).
  - Undo: a group of picture steps is one step; undoing a new picture drops it (pixel-canvas.js `artSteps`,
    history.js `historyArtGroup`, sprites.js `forgetArt`). A first version had before and after as one object, so
    a redo of a group undid it; fixed and tested.
  - studio/js/workbench.js: the Art workbench section (Sheet mode; Part, Pixels, Model shown but off), drop anywhere,
    Write to game. The Studio check drops sheets on it. tools/slice-part-kit.py retired (README in the kit folder).
  - STUDIO.md, CHANGELOG, phase 16 and the track file.
- Risky or unfinished:
  - Writing is two undo steps (pictures, then parts), not one.
  - A part that disappears from a sheet is not deleted from partKits.json or art/ (rename or remove by hand for now).
  - Dropped sheets live in the tab only; a reload loses them (by design: sources are kept outside the game).
  - Big sheets show at 1x at least (the canvas zooms by whole numbers); a 1161 px kit sheet scrolls on a tablet.
  - Islands are numbered in reading order of their first pixel, not by rows; use names or Aseprite for exact names.
  - Snap detection needs a clean grid; heavy AI blur may need the size and start typed in.
  - Generic parts get kind `head` (or a kind found in the name) and animal `any`; pick the kind per part.
  - Not tried on a tablet or the 3440 screen by hand; headless pictures only (validation/st3, not in git).
- Verified: lint, typecheck, check:modules, format, check:data, 202 unit tests (sheet-slice, pixel-snap, history,
  the parity test), the Python slicer re-run before deleting it (same data, same pixels, also after the kits moved),
  check-studio-github (all steps, the new workbench step: the beasts kit written again changes nothing in the
  browser; a 4x sheet on a flat background snaps to 8x9, 11x6, 6x10, writes, undoes and redoes; a proposed PR),
  pictures at 1024, 1920, 3440. A noisy 4x sheet of three real parts came back with the same shapes (colours within
  3 of the art). check:smoke (no problems). The full quick check was not run (this session's gate is the parity test).
- Decisions I made (and why): kit sheets slice by the old steps exactly (parity; their parts keep the old margin),
  everything else trims; "only background that joins the edge" is on by default outside the kits (a cream belly on a
  cream AI sheet stayed a hole otherwise); a back part matched by position takes its front part's name; writing the
  kits stores no settings (so writing them again changes no data), other kits store theirs in `kits.<kit>.slice`.
  Environment note: Playwright's sync route handlers only answer while the script is inside a Playwright call, so a
  `time.sleep` wait stalls the GitHub stand-in (my own scripts; the checks poll often enough).
- Questions waiting for the owner: try dropping a real AI sheet and an Aseprite export; should Write also remove
  parts of the kit that are no longer on the sheets? Should islands be named row by row instead of by first pixel?
- Next session starts with: ST-4, Part mode (start from partKits.json parts and the workbench's pieces).

### Phase 10 - World map: fixes for the weird textures - 2026-10-19
Owner: "the map textures look weird on main". Found with small low-graphics pictures of the map (lite page, no
graphics test); branch `world-map-fix` on top of `world-map-look-5`. Only #62 (sessions 1-2) had reached main; #65,
#66 and #68 merged into their stacked bases, so this branch's PR to main carries sessions 3-5 too.
- Fixed:
  - **Camouflage ground**: ground patches were about 9 m with an outline ring of a second ground, and wet, dry and high
    ground switched in 6 m blocks (nearest grid corner). Now a list's first ground with others in patches about 40 m
    across, no rings, wetness and steepness read smoothly between corners. Single-square specks in the middle of the
    map: 9.5% before, 4.5% after (the fast check fails above 7%).
  - **Striped sea glare from far**: each wave fades out once it is under about two pixels; the sun's glint fades with
    distance and is weaker; foam bands blur into a steady edge from far.
  - **Town water as a tile**: a place's own water and the rivers (terrain w and d) are drawn as water (colours,
    a slow ripple, foam where they meet land); far away their colour is water's.
  - **Black trees and buildings** (sessions 3-5, found on the way): some shapes' normals pointed inward, so the facets
    were lit from behind. Each facet is now lit from the side we see.
  - Shadow lookups are offset along the surface's normal (less self-shadowing).
- Verified: npm test 214; lint, types, format clean; full lite fast check 13 of 13 (the battle step passed on its own
  rerun; it sticks at "playing" under load now and then, as before).
- Next: the owner's phone look; then tag `phase-10-done`.

### Phase 10 - World map, the look, session 5: the Studio and the finish - 2026-10-19
Owner's answers: **worldmap.json**, the sea with **sliders and a brush**, the preview **both** (2D in the Studio, a
button for the 3D bowl in the game). Branch `world-map-look-5`, on top of `world-map-look-4` (PR #66); main (studio
track ST-0 to ST-2) merged into the chain first (only HANDOFF.md conflicted; both entries kept).
- Changed:
  - `logic/bowl.js`: the sea's settings travel with the sea input (`bowlSeaInput(..., opt)`: share, depth, rimLand,
    rough, seed, paint); `bowlPaintStroke` (a brush stroke on the coast, applied after the line is drawn, then the
    places and routes are kept dry); `bowlReliefFeatures(places, relief)` (kinds, default, max). `bowlClumps(...,
    trees)` takes each region's trees.
  - New `game/data/worldmap.json` (+ schema, data check: terrain keys, regions; types `WorldMapLook`): the sea, the
    relief, each region's ground/wet/dry/high/trees, each kind's own ground. The map reads it through
    `worldMapLook()` (the code's tables are the fallback). Moving it was a no-op: the same heights and coast to the
    corner (checked before committing).
  - Studio, World & encounters → **World map look** (`studio/js/worldmap-look.js`): the bowl from above (2D, the
    game's own logic, cached), land/sea brush, remove strokes, sizes; sea sliders; relief per kind with its own
    ground; region grounds as tile chips (✎ opens the tile in the ST-2 pixel canvas, + add) and tree kinds; "Open the
    3D bowl" (`?test=1&place=copperleaf&tab=map&draft=1`). Route stops → **Landmark on the world map** (Auto shows what
    it picks, the choices from the stop's scene, a thumbnail). Keys V L W X [ ] in the `?` sheet, only over the
    picture. Check: a landmark not in its scene, a region without ground, a terrain key that doesn't exist, the sea
    outside 30-50%.
  - Game: `&tab=map` for a test run; the Studio's live data now carries `worldmap` and the places' landmarks, and the
    bowl is worked out again (`worldBowlReset`).
  - Tests: two sea tests (settings, brush); fast check "The Studio's world map look" (the bowl drawn, a brush stroke
    and its undo, the landmark field offering Auto (Windmill) at Clovercrest).
- How it fits ST-2: every edit (a slider, a chip, a brush stroke) is a data edit through `changed()`/`commit()`, so it
  is one step of the one undo in order with pixel strokes; brush strokes are data, not picture patches. The tab has
  no 3D view and its ids are `wml*`, so it opens in either pane; `.pane[data-w='narrow']` stacks the picture.
- Risky or unfinished:
  - The 2D picture and the 3D map share the logic but not the colours (the picture is a sketch palette).
  - Working out the picture takes about 100-300 ms when the data changed (the time is shown under it).
- Verified: npm test 214 pass; lint, types, modules, data, format clean; full lite fast check 13 of 13.
- Next: the owner's phone test of the whole look (world map test in Settings > Help), then tag `phase-10-done`.

### Phase 10 - World map, the look, session 4: landmarks, buildings, trees, town lights - 2026-10-19
Owner's answers: **bigger buildings** (about 3x, today's zoom kept), landmarks as **pixel-art standees**, trees
**from the maps plus clumps**. Branch `world-map-look-4`, on top of `world-map-look-3` (PR #65).
- Changed:
  - New `logic/bowl-things.js` (page script added): `BOWL_THING_SCALE` 3; `bowlMapPoint` and `bowlMapTurn` (a walk
    map's point on the bowl, as the terrain stamps it); `bowlPropClass` (tree, building or nothing); `bowlLandmarkPick`
    (locations.json `landmark` if set, else the biggest landmark prop in the map by picture size, else the biggest
    building; 47 of 49 places get one); `bowlTreeStyle`; `bowlClumps` (forest patches on dry land between places, off
    the routes and the places' ground, each region's kinds, deterministic).
  - `world-bowl.js`: things built a place at a time as its map file comes in. Far out: each place's landmark as a
    standee of its own picture, at least 46 px tall on screen. Close in (camera nearer than about 0.95, fully at
    0.7, when the pins turn to tags): each map's buildings (19 kinds as their low-poly recipe, simplified: small parts
    dropped, 8 sides at most; the rest as picture standees), its landmark props, its trees (8 low-poly tree styles),
    all 3x size, fading in with a pixel dither. Clumps always. Everything instanced (one draw per shape), lit by the
    sun and clouds, casting into the shadow map (drawn again at most every 2 s while things come in). Night: building
    models' walls get lit windows, coming on one by one (environmentLitFraction). Atlas of pictures: 2048 px, each
    scaled down by whole steps to at most 192 px high, sharp.
  - `prop-models.js`: `lowPolyFromRecipe` is now exported (made by the module tool; no behaviour change).
  - Tests: `tools/test/bowl-things.test.mjs`; world map test step "Landmarks, buildings and trees" (counts, update
    time, triangles); the fast check zooms over Marigold Town and asks for landmarks, models and trees, then for no
    GPU error.
- Risky or unfinished:
  - Not seen on a screen: tree colours and sizes, standee lighting, where 3x buildings overlap in dense towns.
  - Picture standees don't light their windows at night (only the models do).
  - Cost: about 4,700 map trees and 365 buildings drawn instanced when close; the world map test reports triangles.
- Verified: npm test 197 pass; lint, types, modules, format clean; full lite fast check 12 of 12.
- Next session starts with: session 5, Studio landmark picker, sea and region terrain editing, the phone test, tag.

### Phase 10 - World map, the look, session 3: clouds, weather, the Inner Sun's day - 2026-10-19
Owner's answers: night **circles and dims**; clouds **as proposed** (Low 12 in one layer, High 40 in two with full
rain, snow, ash and lightning, Off none). Branch `world-map-look-3`, on top of `world-map-look-2` (PR #64).
- Changed:
  - New `logic/bowl-weather.js` (page script added to game/index.html): each place's weather spread over the bowl
    and blended (`bowlSkyAt`, `bowlSkyGrid`), the cloud layout per setting (`BOWL_CLOUD_LEVELS`, `bowlCloudLayout`,
    deterministic), clouds circling the bowl with the wind (`bowlCloudAt`), shown by local cover (`bowlCloudShow`),
    the Inner Sun's day (`bowlSunAt`: once round a day, 135 degrees at 13:00, dims to 15% red at night), the setting
    (`bowlCloudLevel`: Auto follows Beautiful/Balanced).
  - `world-bowl.js`: the weather from `environmentState` for every place's scene every 5 s, eased so fronts build;
    a 32 x 32 weather map for the shaders (fog in the low ground and over the water, snow dusting the tops, light
    dimmed under cloud); low-poly cloud puffs (instanced icosahedra) with moving shadows on land and sea; rain, snow
    and ash as falling lines under the clouds that carry them; lightning flashes in storms (High); night: dusk-blue
    ambient, dark sky, the sun a red ember, red glints. The shadow map is drawn again when the sun has moved 1.5
    degrees (about every 6 minutes). Clouds clear away when the camera zooms in.
  - Settings > Graphics: "World map clouds" (Auto, Off, Low, High; `preferences.mapClouds`).
  - Tests: `tools/test/bowl-sky.test.mjs`; world map test step "Clouds and weather" (setting, clouds showing, drops,
    weather by place, the sun); the fast check switches Off and High, forces a storm (clouds and rain must show) and
    checks for GPU errors.
- Risky or unfinished:
  - Not seen on a screen: cloud colours, sizes, rain density, night darkness are first guesses.
  - Cloud shadows loop over up to 40 clouds per pixel (12 on Low); watch the frame time on High.
  - The map follows "My clock": in the evening it is night on the map now (owner's choice).
- Verified: npm test 193 pass; lint, types, modules, format clean; full lite fast check 12 of 12 (with a forced storm).
- Next session starts with: session 4, landmarks, buildings, trees (and town lights at night).

### Phase 10 - World map, the look, session 2: the land, the routes, the light - 2026-10-19
Owner's request: "Next session"; light option **A** (the Inner Sun off the centre, the light from where it hangs).
Branch `world-map-look-2`, on top of `world-map-look` (PR #62, not merged yet).
- Changed:
  - `logic/bowl.js`: relief about 40% taller (limit 0.115) with broad hills between places; land never sinks below
    the water (dips flatten into low ground); headland stretches of coast stand up and drop to the sea as cliffs,
    low coasts slope to beaches. Rivers (`bowlRivers`): a priority flood from the sea over the height above the
    water, springs on the highest land, up to 10 courses, each falling all the way, ending in the sea, clear of the
    places' ground and the rim, beds cut 2 m. Wetness (`bowlWetness`, `bowlWetAt`). The sun: `bowlSun` (40 degrees
    slant, azimuth 135 for now, hanging inside the hollow sphere).
  - `world-bowl.js`: ground lit by the slanted sun with a sky fill and cast shadows (`mshadow`, a 2048 shadow map
    drawn once, the ground never moves); the water takes the shadows and the glint follows the sun. A line map
    (`worldBowlLineMap`, RGBA 1024): routes drawn as bold cream paths with a dark outline that stay a few pixels wide
    at any zoom (hidden up close inside a place's own ground, where its paths show), rivers as blue lines when far.
    Terrain: region borders wander and dither; wet lowland, dry slopes, high ground per region (`BOWL_REGION_SHADE`),
    rock on steep ground and cliffs, snow higher than before; rivers painted with muddy and sandy banks; routes
    painted over them as fords.
  - `opening-fall.js`: the fall passes close by the Inner Sun where it now hangs.
  - Tests: `tools/test/bowl-land.test.mjs` (rivers, cliffs and beaches, land above water, wetness, the sun); world
    map test step "Light, shadows, routes and rivers"; the fast check asks for the shadow map, line map, rivers and no
    GPU error.
- Risky or unfinished:
  - Not seen on a screen: colours, shadow softness, route width and river colour are first guesses.
  - The ground now takes about 250-300 ms to work out here (sea, relief, rivers), once per session; maybe 0.6 s on
    a phone, on first opening the map or the first far wall. If it shows, it can move to idle time.
  - Shadow map: 2048 x 2048 depth, drawn once (time shown in the world map test).
- Verified: npm test 187 pass; lint, types, modules, format clean; full lite fast check 12 of 12.
- Decisions I made: the sun stays at azimuth 135 until session 3 ties it to the time of day; rivers avoid the places'
  ground entirely and the rim; routes cross rivers as fords (painted over them).
- Next session starts with: session 3, clouds and weather (and the sun moving with the time of day).

### Phase 10 - World map, the look, session 1: sea and coasts - 2026-10-19
Owner's request: the living diorama look (B), an inland sea with bays, about 40% of the bowl water; "Go" for session 1.
Branch `world-map-look`.
- Changed:
  - `logic/bowl.js`: the sea. `bowlSeaInput` (each place with its walk map's half-diagonal, each road),
    `bowlCoastGrid` (distance past the nearest place or road, plus a three-octave noise, minus a rise towards the rim
    so the land wraps round the sea; the line drawn at the 60% quantile, so 40.0% of the bowl is sea), then a hard
    margin so every place's map and every road stays dry. `bowlGroundGrid(F, n, sea)` returns the coast as `c`: the
    land's relief fades to the water's edge, the sea floor sinks up to `BOWL_SEA_DEPTH` (0.035) below it.
    `bowlWaterLevel` is the bowl's own curve (things fall towards the shell, so water lies on the bowl).
  - `world-bowl.js`: a water sheet over every sea cell (`worldBowlWaterMesh`, each corner with its depth and coast
    value) and its shader `mwater`: shallow, mid and deep colours, four moving waves, the sky reflected at glancing
    angles, the sun's glint, foam at the shore, see-through shallows. The terrain map gets beaches (sand, then wet sand)
    and a sea floor (sand or coral sand in the shallows, pebbles and rock further out). The map redraws at about 30
    frames a second while the sea shows (600 ms beats with reduced motion, waves still). The walk scenes' far wall
    sees the water's level and colour.
  - Tests: `tools/test/bowl-sea.test.mjs` (sea 35-45%; every square of every place's walk map and every road on land;
    the sea floor below the water and not too deep). The world map test (Settings > Help) has a new step "The sea and
    the coasts" (share, places dry, triangles, how long it took). The fast check asks for the water sheet.
- Risky or unfinished:
  - Not seen on a screen (no headless graphics): the water's colours, foam width and wave strength are first guesses.
  - Working out the coast takes about 120 ms on this machine once per session when the map or the far wall first
    needs the ground; on a phone maybe 300 ms. The world map test reports it.
  - Redrawing at 30 fps while the map is open costs battery; the draw was about 1 ms a frame on the owner's phone.
  - `check-fast.py --only=map` on its own fails its touch check (a canvas without an id on top) on main as well; in the
    full run it passes. Not from this work.
- Verified: npm test 180 pass; lint, types, modules, format clean; full lite fast check: the world map step passes
  (the battle step stuck at "playing" once under load, as before, and passed in the other run).
- Decisions I made (and why): the land rises towards the rim so the sea is an inland sea, not a ring along the edge
  (owner's choice); a few small islands and lakes are kept, they read as natural. The highlight uses the overhead sun
  for now; the slanted sun comes in session 2 with the shadows.
- Questions waiting for the owner: on the phone, does the water read as water, and is 30 fps animation fine?
- Next session starts with: session 2, the look and the routes (cliffs, rivers, bold routes, slanted sun, shadows).
### Studio track ST-2 - the shared pixel canvas - 2026-10-19
Plan approved at the start. Owner's pick: the Walk scenes prop and tile painter moves onto the canvas now too.
- Changed (one cause per commit):
  - logic/pixel-ops.js (+ tests; then a rename commit: `px*` is a retired prefix, so `pixel*`) and logic/history.js
    (+ tests): the Studio's undo stack, data snapshots and picture patches in one order.
  - studio/js/pixel-canvas.js; the sheet editor draws through it (same look: element boxes compared at 1024, 1920,
    3440), then: strokes as patch steps of the Studio's undo (uploads and reverts too; its own undo gone); grid from
    8x, zoom on the pointer, Space/middle-button pan; line and box selection; flips and quarter turns; symmetry;
    palette lock and off-palette pixels; onion skin; Aseprite-style keys from one table; the `?` key sheet
    (studio/js/shortcuts.js); the prop and tile painter on the canvas.
  - A fix found on the way: the undo snapshot kept `_` caches (a map's `_hg` height cache with a clock), so in Walk
    scenes every Ctrl+Z only took back the cache's clock. Snapshots now leave `_` keys out, as saving does.
  - The Studio check paints (strokes and a bone undone and redone in order across Front/Back, line, flips and turns,
    selection, symmetry, palette lock, keys, `?`, the tile painter). STUDIO.md, CHANGELOG, studio-track.md.
- Risky or unfinished:
  - Wardrobe still paints on its own and Ctrl+Z there reverts its pieces but not its art (ST-6).
  - A resize or a new PNG for a prop is two undo steps (the picture, then the base point).
  - A quarter turn of a box that is not square can cover a neighbour's art (clear pixels don't); a turn that runs off
    the sheet is clipped. Undo brings either back.
  - Onion skin is centred on the part's box (pivots differ between views; lining them up looked wrong).
  - Each redraw of Walk scenes makes a new canvas; old listeners go on their next event (no build-up seen).
  - Headless only: not seen on a tablet, a phone or the 3440 screen. Swiftshader makes the Walk scenes preview slow
    in the checks (the painter's step waits up to 2 minutes).
- Verified: lint, typecheck, check:modules, format, 190 unit tests (pixel-ops, history), check:smoke after the undo
  change, check-studio-github (all steps, new pixel and tile painter steps, a proposed PR), element boxes of the
  pixel editor before/after the move. The full quick check was skipped on the owner's word (it had passed its phone step).
- Decisions I made (and why): `?` lists every key, the open tool's first (one place to look); the canvas's keys work
  in the tile painter only while the pointer is over it (B and E also paint the map); K and O for the palette lock
  and onion skin (Aseprite has none); flips and turns act on the part under the pointer in a sheet, never the whole
  sheet (it would scramble every part).
- Questions waiting for the owner: try painting on the tablet (Space-pan has no touch twin yet: a two-finger pan?);
  is the onion skin useful centred, or should it mirror the back view?
- Next session starts with: ST-3, Workbench Sheet mode (build it on `pixelCanvas`).

### Studio track ST-1 - the layout shell - 2026-10-19
Plan approved at the start. Owner's picks: the second pane is "light" (no 3D sections there; one undo and save for
both); PR #61's merge conflict left to its own branch (it has since merged; see below).
- Changed (one cause per commit):
  - No-op: the nav, list and side-panel widths read custom properties (element boxes unchanged at 1000-3440 px).
  - `#main` is a pane; sections draw through `renderPane(root, sec)`; `paneRoot()` for afterRender; lookups and the
    field listeners match `.pane`.
  - Pane width classes (`data-w` narrow / wide / ultra, from a ResizeObserver; logic/studio-layout.js). Not CSS
    container queries: those make the pane the containing box of the big 3D view and the story reference.
  - Handles (drag, keys, double-click/Delete resets) on the section list, a section's list and the battle preview's
    panel; sizes saved per section (localStorage `studio-layout`).
  - The 1180 px cap is gone; the battle stage keeps 16:10 by its height.
  - Wide and ultrawide layouts (wider lists and panels; an ultrawide editor's cards in two columns; the battle
    preview's controls in columns beside a full-height stage; wider skeleton builder and pixel editor).
  - `sectionShown()` for the robots animation, wardrobe preview and Check list; the second pane (`#main2`,
    `studioState.sec2`): ⇥ / Shift-click, Swap, Close, a handle between panes, restored after a reload.
  - Layout presets in the top bar (Auto, Compact, Wide, Ultrawide, Split), hidden below 1200 px so Save stays on a
    tablet's top bar.
  - tools/studio-shots.py (pictures and element boxes at any widths; `--compare`); the Studio check's split steps;
    tools/test/studio-layout.test.mjs. STUDIO.md, CHANGELOG, studio-track.md.
- Risky or unfinished:
  - The Connections drawer still follows the left pane only, and overlays the right pane when open.
  - The skeleton builder and pixel editor have no handles (wider defaults only) and the skeleton zoom stays 2.5x on
    a big screen: ST-2's shared canvas.
  - An ultrawide editor's two card columns leave gaps under short cards (grid rows); fine to read, not a masonry.
  - A light section on a sub-tab not covered by the id check could still share an id with another section.
  - Not seen on a device or a real 3440 screen; headless pictures only.
- Verified: lint, typecheck, check:modules, format, 178 unit tests, check:smoke (no problems), check-studio-github
  (23 sections, art tools, story, free camera, the new split steps, a proposed PR), pictures at 1024, 1920 and 3440
  (tools/studio-shots.py validation/st1: Billies, Moves, World, Rules, battle preview, skeleton, pixel editor, split).
  The full quick check: see the next entry line (running when this was written).
- Merge conflicts: PR #61 (project-story-city) conflicted with main only in docs/HANDOFF.md (ST-0 and #61 each added
  a top entry). #61 was then merged by its owner; merging main into this branch hit the same file only, kept both
  entries (this one on top). world-rules-art.js (#61's What's new, this session's `paneRoot()`) merged by itself.
  The current world map branch, world-map-look (6 commits on main c865974: the inland sea), touches bowl.js,
  world-bowl.js, bowl-map-test.js, check-fast.py and its own test, none of which this track touches; a trial merge
  of it onto this branch conflicts in docs/HANDOFF.md only (each adds a top entry). Whichever lands second keeps
  both entries. The cutscene tools' Studio session (#61's session 2) should build its section to fit a pane.
- Decisions I made (and why): a preset clears the per-section sizes (a fresh layout; "adjusted" plus Reset sizes make
  it clear); non-split presets close the right pane (a preset sets the split too); the second pane's section is
  saved with the layout, not in the URL hash (the hash stays one section, as links and the checks use it); a section
  opened on the left that is on the right swaps them.
- Questions waiting for the owner: try it on the 3440 screen (Layout → Ultrawide or Split; drag the edges); the
  ultrawide two-column cards in Billies: keep, or prefer one wide column?
- Next session starts with: ST-2, the shared pixel canvas.

### Cutscene tools, session 3 - the city opening; the title with accounts back - 2026-10-19
Owner's request: "begin session 3 now, explain session 2 in handoff"; then the title with the account, on the new UI
direction, Continue pressing itself when signed in (answers in the questions of this session, listed below).
Branch `project-story-city`, from `project-story-opening` (PR #59) with PR #52 (batch 8) merged in.
- **Session 2 (not built; next):** the Studio's cutscene tools. A Cutscenes section listing game/data/cutscenes;
  in its preview (the Walk scenes 3D view with the free camera), **Save as shot** (name it; eye, target, field of
  view from the free camera), a Shots list (look through, retake, rename, field of view, delete), **spots as pins**
  (click the map or the 3D view to drop a named pin, drag to move), the clear areas drawn on the map; the script field
  (S3's) with a **step list** beside it (each step with its time, click to jump the camera there) and **▶ Preview**
  playing the cutscene in the Studio (the director and stage.js on the preview's view, lines in a box); insert buttons
  (this camera as a shot, walk to a pin, a line); Play from here for a cutscene. Its checks are the same reading
  (logic/cutscene-set.js) and story checks. Start from docs/CUTSCENES.md and studio/js/free-camera.js.
- Changed (one cause per commit):
  - Merge PR #52; fix hazel.js's generated module block (also pushed to PR #59).
  - Engine: a placement may float (`lift`, metres up) and move (`moving`: shadow drawn each frame).
  - Cutscene commands: `actor ... silhouette`, `act <who> reach`, `hide/show prop <spot>`, `show <who>`,
    `traffic <lane> <prop> <s> [n]`; a cutscene's `look` (time, weather) holds while it plays.
  - `game/data/cutscenes/city.json`: the city's spots, shots and lanes (out of the map's block), night and rain, the
    beat sheet's script; New game plays it before the fall, which then starts in the crust (the street under the
    billboard only when the city can't). The batch 8 builder no longer writes a cutscene block.
  - Test boot off (`?boot=test` turns it on): the title, saves and accounts are back.
  - Accounts: saves more than a minute apart: you choose which to keep (two cards); the other is set aside in this
    browser; Settings > Save brings it back or downloads it.
  - Title on the new look: signed out a glass sign-in card (Sign in with Google / Play without an account); signed in
    an account chip (tap: email, Sign out); the Continue card's ring fills for 4 s and it continues unless you touch
    anything (also right after signing in); new players see the city at night behind the title, returning ones
    Copperleaf; the version and What's new (meta.json whatsNew, the Studio's World page). The New game warning no
    longer mentions save slots (there are none).
  - Docs: CUTSCENES.md, city-opening-beats.md (built), CHANGELOG.
- Owner's answers this session: test boot off with ?boot=test; a sign-in card whenever signed out; 4 s with a ring,
  any touch stops it; signed-in only, also right after signing in; city behind the title for new players, Copperleaf
  for returning ones; Continue card plus a quiet row; account chip with a sign-out sheet; ask which save to keep, the
  other set aside (no slots exist); "other device played since" = saved more than a minute apart; the city title
  camera drifts down the avenue; What's new from meta.json; version and What's new on the title.
- Risky or unfinished:
  - Not seen on a phone: the city (look, traffic, the silhouette, the reach pose is the throw's wind-up held), the
    title's new look, the ring. Traffic moves placements each frame; watch for stray shadows or flicker.
  - Sign-in, auto-continue and the which-save sheet need Firebase, which this sandbox can't reach: untested.
  - The city has no lite version yet and no rain or hum sounds (the fall's music plays).
  - tools/check-studio-github.py still stops at the story preview switch, as on main (see session 1).
- Verified: lint, typecheck, 164 unit tests (the city: commands, names, it runs through, length), check:data,
  check:modules, format, build. A headless look at phone size (360 x 640, pixel ratio 1; the page's state only, no
  pictures): the title shows the sign-in card (sign-in unreachable here) and What's new; New game plays the city, the
  fall from the crust, then Hazel's lines, no errors. **Not run: the smoke check on the final code** (stopped by the
  owner; the last smoke, after session 1, passed 15/15).
- Next session starts with: your look at the city and the title on your phone (and a sign-in test); then session 2,
  the Studio's cutscene tools.
### Studio track ST-0 - the plan, Golden removed, coats - 2026-10-19
Owner asked for a more intuitive Studio (ultrawide, 3D import/export, a sprite-sheet parts tool, a combined tool),
answered about 30 questions and approved the plan (docs/phases/studio-track.md, ST-0 to ST-9). ST-0 removes Golden
(owner: "Golden are dropped but keep room for other potential new variants") and adds coats in its place.
- Changed:
  - docs/phases/studio-track.md: decisions, sessions, verified facts (corrections to phase 14), the list of Golden uses.
    ROADMAP links it.
  - Golden removed, one cause per commit: the rolls and odds (encounters, eggs, fishing; rules.json, the Studio's
    fields, the test fixture); the words, the rumour, the Golden tag and ribbon; the battle shimmer and grass glints;
    the `gold` switch in rigAtlas/rigParts/rigPreload/rigCanvasHTML/bustHTML and every caller, and `gold` on Billies,
    encounters and friends' partners; the Studio's Golden tabs, rebuild panel, preview switches and goldFrom; the 129
    `_gold.png` sheets (1.3 MB) and the builders' gold output (pixkit gold_recolour).
  - Coats (owner named them; "variant" is taken by the Variants and by prop variants): game/data/coats.json + schema +
    data check; logic/coats.js (ramp swaps step for step, exact swaps, nearest palette shade within 24, rolls only when
    a coat has odds, hand-painted sheets); the game draws coats everywhere a Billie is drawn, rolls them for wild,
    egg and fishing, names them ("A wild Midnight Emberox appeared.") and tags them on the card; debug menu coat
    picker. palette.js now loads on both pages. Studio: the Coats section, coat pickers in Billies and the battle
    preview. One sample coat, Midnight, with no odds (never appears in play; debug menu only).
  - NAMING.md: `coat`. STUDIO.md, ART-NOTES, CHANGELOG updated.
  - Tests: coats.test.mjs, coats-game.test.mjs, rig-calls.test.mjs (fails on any rig call still passing the old
    Golden switch: it found one I had missed in the opening's preload, and #59's two moved calls).
    check-studio-github.py now also opens the pixel editor (both views), the skeleton builder, the battle preview and
    the Coats section (the coat preview must differ from the normal one; a ramp swap is an edit).
  - Merged main twice (#57 story editor and free camera; #58 world map terrain; #59 cutscene tools): kept both sides
    of the Studio check and studio/index.html; took cutscene.js's deletion and fixed its two moved calls.
- Risky or unfinished:
  - Nothing seen on a device. Coats are drawn by recolouring a sheet once per coat (cached); the four placeholder
    lines' sheets are 0% on the palette, so a ramp coat changes little on them until they get real art.
  - A friend on an older build sends partners without `coat`; fine. Old saves with `gold: true` just lose it.
  - The full quick check was not run end to end (owner said not to). Its v38 and v39 steps fail on species counts on
    main too (the roster is 7 lines since phase 16): stale tests, not this branch.
- Verified: lint, typecheck, check:data, check:modules, 174 unit tests; check-fast 12 of 12; check-studio-github ok
  (23 sections, art tools, coats, a proposed PR) on the merge with main; quick check steps v36 pass. Headless
  pictures of three sheets recoloured as Midnight looked right (straw to mint, ember to indigo).
- Decisions I made (and why): a coat's name goes before the Billie's in messages and on its card (Golden did the same);
  the coat picker in the debug menu replaces the Golden box; a hand-painted coat sheet is edited by download/upload
  for now (ST-2's shared pixel canvas will paint it in place).
- Questions waiting for the owner: try a Midnight Billie on the phone (debug menu, Billies, coat Midnight, Give it to
  me); set odds for coats when you want them in play.
- Next session starts with: ST-1, the layout shell (resizable panes, wide layouts, presets, two sections at once).

### Cutscene tools, session 1 - cutscenes as data; the opening plays from its file - 2026-10-19
Plan approved at the start (the owner's picks: both intros in order, Hazel's opening moved with today's words first, a
script and step list in the Studio, one file per cutscene, a cutscene/ folder, lines and walks wait, map coordinates).
Branch `project-story-opening`, from main at 88fadcf (S3 merged).
- Changed (one cause per commit):
  - Move only: cutscene.js split into `game/js/cutscene/` (director, starter-pick, staged-fight, opening).
  - Story layer: cutscene commands, read once by `game/js/logic/cutscene-set.js` for the stage, the checks and the
    Studio (actor, act, caption, blink, screen, effect, hide, sound; camera <shot> [s] [on ...], walk <who> <spot>
    [s] [nowait], wait <who>; the opening's dressing-room, throw-coins, pick-starter, staged-fight, rival-battle).
    Slots in commands; {place} {starter} {counter} {foe}. The story checks read cutscene scripts and their names.
    S1's unused placeholders shot, hot-take and tip are gone.
  - Data: `game/data/cutscenes/<id>.json` (schema, check-data, line ids): `opening.json` holds Copperleaf's spots and
    shots (moved from the lab-door offsets to map coordinates), what is cleared while filming, and the script.
  - The opening plays from its file (`cutscene/stage.js`); cutsceneScript, CUTSCENE_SPOTS and Hazel's moved tables
    (blakeArrives, afterFight, blakeTakes) are gone; the starters and coins are the opening's own drawing layer.
  - docs/CUTSCENES.md; SCRIPTS.md; stale headers (Sundown, the step-by-step intro) fixed.
- Risky or unfinished:
  - Camera heights are now above the ground under each point, not above the lab door's ground: a shot whose eye
    stands on higher or lower ground than the door sits a little differently. Look at the opening on your phone.
  - The staged fight's shot moved into the script (`camera coins 0.9` before `staged-fight`), same as before.
  - The no-Blake ending branch of the old code (blake0 missing) is gone; blake0 is in the data.
  - tools/check-studio-github.py stops at the story preview switch (#scStoryOn): the same on main 88fadcf, not from
    this session (likely the free camera covering it); not fixed here.
- Verified: lint, typecheck, unit tests (163; new tools/test/opening-script.test.mjs: the opening says what the old
  code said, word for word and in order, recorded from it; commands; the set's maths; planted faults), check:data,
  check:modules, format, build; smoke 15/15 after the split and again on the final code. No headless renders.
- Questions waiting for the owner: play the opening on your phone (New game) and send a debug log.
- Next session starts with: session 2, the Studio's cutscene tools (Save as shot, spot pins, the step list and Preview).

### Project Story S3 - the Studio story editor, Play from here; and a free camera for the scene preview - 2026-10-19
Plan approved at the start (S3 of docs/phases/project-story.md); the free camera was asked for during the session and
planned and approved separately (estimate given: one session, 3-5 h, 250-450k tokens). Branch `ccr-aa8542b9-r8vfua`,
from main at c7c5ad3 (S2 merged).
- Changed:
  - Moves first, no behaviour change: the parser and the format's tables into `logic/script-parse.js` (the runner
    stays in `logic/script.js`); the story checks and the line id rules into `logic/story-checks.js` (browser-safe;
    tools/story-checks.mjs and tools/story-ids.mjs keep their exports; check:data printed the same, story:ids gives
    the same ids).
  - One check for the Studio and the command line: `storyFindings` gives each finding its file, script, line, thing
    and field; `storyChecks` makes the same strings from it.
  - Fix: a place's `requires` that doesn't read was a crash of the reach check; now it is reported.
  - `scriptReference()` builds the command reference from SCRIPT_COMMANDS, KEYWORD_ABOUT, SCRIPT_SLOTS and
    CONDITION_KINDS (which now say what each does).
  - Studio (`studio/js/story-editor.js`): one script field for every script (trainer Dialogue, a scene's People card,
    story.json's), the parser's error at once and the story checks a moment later, each on its line (click to go
    there); Tab / Shift+Tab / Enter keep the indent; Add line ids (same rule as npm run story:ids); Commands panel
    (finder, a row puts itself in the script). Condition fields check as you type: a trainer's and a person's `when` /
    `unless`, a place's `requires` and `locked` line (World). New section Story scripts (story.json scripts: add,
    rename, remove, edit; flags, presets with ▶ Play, quests to read). The Check lists the story findings; Show me opens
    the script with the line selected.
  - The scene editor's People card edits today's data (id, look, name, spot, facing, when, unless, script); the dead
    `first` / `lines` editor is gone.
  - Story preview (Walk scenes → Preview): a start preset plus flags and beaten trainers switched; hidden people and
    props are left out of the 3D preview and drawn faded with a red dashed outline on the map. People now show on the
    map and in the 3D preview. The Studio gives the walk view its `storyAllows` (a prop with `when` would have thrown
    in the Studio before).
  - Play from here: the game in the scene's place (people, trainers, exits), on the spot you pick (Pick the spot, the
    free camera's spot, the walker's, or the hub), at the preview's preset and switches, with the unsaved draft:
    `?test=1&story=<p>&place=<loc>&at=x,z&flags=a,!b,beat:t&draft=1`; the game waits up to 2 s for the Studio's data.
    The live channel now carries the story and the trainers (replaced in place). Nothing is saved in that tab.
  - Free camera (`game/js/logic/free-camera.js` maths, `studio/js/free-camera.js`): leaves the walker and flies like
    a map app: drag moves (the ground stays under the pointer), right-drag turns and tilts, wheel zooms towards the
    pointer, double-click looks there; one finger, pinch, twist, two-finger tilt on a phone; W A S D, Q E, R F, Page
    Up/Down; Top view, ▲ ▼, Walker here, Back to the walker; each scene keeps its camera. The walk view draws through
    a view's own camera when its options pass `look()` (walk-view-gl.js; nothing in the game passes it).
- Where the plan or the phase file was wrong (checked in the code):
  - The Studio could not import the parser at all (script.js needs the game's data and save), and story-checks.mjs
    could not load in a browser (Node imports through story-ids.mjs): hence the two moves.
  - The scene People card still edited `first` / `lines`, which S2 had removed from the data.
  - The live channel sent only maps, scenery and engine; `?test=1&scene=` starts a bench with no people or exits, so
    Play from here starts in the place itself instead.
  - The preview's old "free camera" only turned round the walker.
- Risky or unfinished:
  - Play from here puts you in a place: a scene no stop uses (rooms, test scenes) opens as the old scene test run at
    its hub, not on the spot.
  - The draft carries maps, scenery, engine, story and trainers; a change to locations (a place's `requires`) reaches
    the game only after saving.
  - Story presets are read-only in the Studio (story.json by hand), as planned; ask if you want an editor.
  - Free camera: from straight above, standing pictures (trees, people) look flat, as billboards do; flying far from
    the walker relies on the near ring following the camera (it does); a click without a drag still walks the walker.
  - The tag `project-story-s1-done` (S2's note) is still only in that session's clone, if the proxy refuses tags
    again it will be the same for `project-story-s3-done` (see below).
- Verified:
  - After each change: lint, typecheck, unit tests (152, new: the reference, findings with their place, the requires
    fix, the preview against the game's applyStoryPreset / storyAllows, the switches, the free camera's maths),
    check:data (same output as before the moves), check:modules, format.
  - tools/check-studio-github.py (GitHub mode, fake API): types `sett` in a trainer's script and sees "did you mean
    set" on its line, Add line ids, the reference finds and inserts `heal`, the People and Story fields, the Check's
    Show me selects the line, the story preview hides and shows Juniper, Play from here opens a game tab in
    Copperleaf on the picked spot at after-opening with chad beaten and the draft script, no save written; the free
    camera by mouse, keys and two fingers (the ground stays under the pointer within 0.75 m). Green twice in a row.
  - Smoke 15/15 (twice). Full quick check: 45 of 54 steps; the 9 red are the same known ones as S2 (v35, v38, v39/v40
    roster counts; v46 building plans; v31 fountain wait; v44 props scene; alpha 0.4 bush recipes; phase 08 running),
    none from this session. It ran while the free camera was being written in the tree (the game page only gained an
    unused `look` hook then).
  - Not done: anything on a phone (touch feel of the free camera, the Studio on a phone).
- Decisions I made: free camera's left-drag flies the camera while it is on (the plan's recommendation; walking stays
  with it off or by click); key C switches it; story presets stay read-only.
- Questions waiting for the owner: try the Studio (S3's "Needs from you"): a script with a mistake, the story preview,
  Play from here, the free camera on your phone. Tag project-story-s1-done if it still isn't on GitHub.
- Next session starts with: Project Story S4, the story bible and parody fixes (writing, no code; every naming and
  lore choice is yours).

### Phase 10 (world map: the bowl) - curves only, real terrain - 2026-10-19
Owner's asks: no grey edge; the inside only curves; high-resolution real terrain.
- Changed:
  - Shape (`logic/bowl.js`): part of a sphere (radius sqrt 2), lowest at the centre, curving up to 45 degrees at the
    rim (rim height sqrt 2 - 1); no flat floor. The ground ends at the rim: no land beyond it (the grey edge is gone);
    the mesh's corners past the rim are pulled onto it, so the edge is a clean circle. 320 cells.
  - Terrain (`world-bowl.js`): a 2048 x 2048 map of terrain kinds (about a metre a square at 1000 m to the radius)
    drawn with the walk scenes' own terrain pictures (all 78, 16 px each, sharp, mipmapped), and their average colours
    from far away (1024 x 1024) so it doesn't shimmer. Between places each region's own grounds in patches with a
    dithered edge (from what its maps are made of), some kinds' own round them (sea, volcano, summit, canyon...), snow
    on the highest tops, rock at the rim, paths along the roads. Each place's own walk map is laid on it square by
    square, turned the way it sits (north to the centre), as its map file comes in (one at a time while the map is
    open). Filled 96 rows a frame; uploads at most twice a second.
  - Pins: close in (zoom under 0.62) other places are small tags; the picked place and yours keep their pins.
  - World map test: a new step times the terrain map and the places' own ground.
  - Studio: the floor circle is gone from the bowl editor.
- Risky: not seen on a device. The 2048 terrain map is 4 MB on the GPU plus the 1024 colours; the first opening fills
  it over about 21 frames. Places' maps load in the background while the map is open.
- Verified: lint, typecheck, check:data, check:modules, format:check, npm test (158 pass); the shaders compile
  headless; check-fast 12 of 12 (the bowl step waits for the terrain); a lite page lays all 48 places' ground and
  Marigold's centre square on the bowl is its map's centre square (cobblestone).
- Next: landmarks far out, real buildings close in, tree clumps; then clouds.

### Phase 10 (world map: the bowl) - fixes from the owner's phone test - 2026-10-19
From the owner's world map test report (Adreno 750, 60 fps, 1.6 ms a frame) and notes.
- Changed:
  - Touch didn't move the map: the Map tab's screen kept its slide-in animation's end transform (v05.css,
    fill-mode both), which made the fixed `.map-full` size itself to `.screen`, 0 px high, so the touch and pin layer
    had no height (the bowl itself draws on #dio, full screen, so it looked fine). `.screen.s-map` no longer animates;
    #dio also lets touches through on the Map tab.
  - The walk camera stayed zoomed out after the map: the zoom out now remembers the walk zoom, and coming back to the
    walk scene eases back in from far out to it.
  - The world map test's "shaders compile" step looked for the old program name; it now checks every bowl program,
    and its opening step checks that touches reach the map.
  - Fast check: the bowl step checks the map layer fills the screen and takes touches (on a phone-sized page), and that
    the walk zoom comes back. It fails without the CSS fix (checked).
- Verified: lint, typecheck, check:modules, format:check, npm test (148 pass); check-fast bowl step; a lite touch
  drag (CDP touch events, graphics off) moves the camera.
- Next: the terrain and buildings plan (docs/phases/10-world-map-bowl.md, "Ground and landmarks").

### Phase 10 (world map: the bowl), session E-map-4 - ground and routes; the old map gone - 2026-10-19
Plan approved ("Go"). Owner chose: the walk sky shows the bowl's far wall; the opening falls into the bowl; gentle
relief. Owner's asks: lose the old map, a fluid zoom out from the walk scene into the map, the world map test in
Settings.
- Changed:
  - Ground: `logic/bowl.js` relief (each place's kind a gentle bump or dip, a little roll, at most 0.08 of the radius,
    gone beyond the rim) and a 160-cell grid; `world-bowl.js` draws it as one low-poly mesh (faceted light from the
    Inner Sun) painted from above: region colours mixed between places, water, sand by water, snow on the highest
    tops, roads as paths with edges, a clearing at each place. The camera, pins, taps and the flight read the same
    heights (`bowlCamUseGround`).
  - The old sphere map is deleted: `world-map.js`, `world-map-gl.js` (renderer, CPU fallback, Flat view, 3D and 2D
    miniatures, landmark stamps), `art/map/world.png`, `world_h.png`, `map/mini/`, `tools/build-world-relief.py`,
    `tools/build-map-minis.py`, `studio/js/world-map-painter.js`, and lon/lat from locations.json and its type.
    `world-bowl.js` now holds the map's API (`worldMapMount`, `worldMapSelect`, `worldMapZoom`, `worldMapReset`,
    `worldMapFit`, `worldMapAction`, `worldMapWanted`, the Places list). Without WebGL the Map tab is the Places list.
  - Airship flight on the bowl: 2-3 s by distance, the ship on an arc with its shadow and trail, the camera keeping
    it in view, tap to skip. Fares now by bowl distance (60 + 540 per radius, rounded, at least 60).
  - Opening fall: past the Inner Sun and down into the bowl to Copperleaf (`fallCamera` builds a look-at view,
    `bowlCamLookView`; `worldBowlFilm` draws it).
  - Walk sky: the far wall round the horizon (`bowlWallTexture`: per direction how high the land rises and its colour,
    from where you stand; the sky shader draws it under the clouds). Replaces the painted far side overhead.
  - Zoom out from the walk scene: the Map tab from walk zooms the walk camera out (0.38 s) under a haze veil, then the
    bowl starts right above you and pulls back to the usual view in 1.3 s (eased). Off with reduced motion.
  - Settings -> Help: "Run the world map test (1 min)" (the debug menu's Bowl map test).
  - Studio: World -> the bowl seen from above (rim and floor circles, roads); drag a place to set its spot; fields for
    the angle and the distance out; the Map art tab is gone. The map editor's fallback exit direction uses the bowl
    compass.
  - Full test: the World map step turns round the bowl and comes back; the fall is timed on the bowl; the miniatures
    step is gone. Quick check: old-map branches and the miniature pictures' check removed. Fast check: the bowl step
    now opens from the walk scene's tab, waits for the zoom out, films a fall frame and flies to Copperleaf.
- Risky or unfinished: nothing here is seen on a device (no graphics run). Clouds (E-map-5) and the Studio's region
  terrain editing (E-map-6) are still to do. tools/build-scenes.py and build-regions-v47.py still read lon/lat (legacy
  generators; they fall back to 0).
- Verified: lint, typecheck, check:data, check:modules, format:check, npm test (138 pass; new bowl-ground tests);
  the bowl's two shaders compile headless; check-fast 12 of 12 (small page, graphics off, no pictures). The Studio's
  bowl editor renders 48 draggable places and 56 roads and a drag moves a place (headless, no pictures).
- Questions waiting for the owner: run "the world map test" in Settings on the phone and send the report; look at the
  zoom out, the fall and the far wall.
- Next session starts with: E-map-5, clouds.

### Phase 10 (world map: the bowl), E-map-3 follow-up - the bowl always on, pins, the bowl map test - 2026-10-19
Owner's request: "Have it activated always. Lose the miniatures for now. Make a debug test specific for it."
- Changed:
  - The bowl is the world map (no switch). The old sphere map still draws only with no WebGL and during an airship
    flight (the flight is drawn over the old map until E-map-5); the debug menu's preview switch is gone.
  - Places are pins (stalk and head; a house for towns; gold here, grey locked, white picked; a pink dot when new);
    no miniatures, no map/mini pictures loaded by the bowl. Pearlantis stays a small marker under Kelpport.
  - `game/js/bowl-map-test.js`, debug menu (Trainers and world) -> "Bowl map test": on the device, shaders, the Map
    tab opening as the bowl, every place on the bowl, a tap on each of the 49 pins opens that card, 48 camera moves
    never below the rim line, Home, frame rate (whole bowl turning, close up turning, panning: fps, worst gap, draw
    ms), errors. Saves nothing; puts the map back; "Save the report" (JSON, no save data or names).
  - Fast check: new "The world map opens as the bowl" (small page, graphics off, no pictures): opens, every place
    has a spot, a tap opens Tallgrass Meadow's card, Home comes back.
  - Quick check v31 drives the bowl camera when the bowl is on; v32 and the full test's miniatures step skip with
    "the bowl map has no miniatures yet".
- Risky or unfinished: not seen on a device (no graphics run). The airship flight still shows the old map.
- Verified: lint, typecheck, check:data, check:modules, format:check, npm test (132 pass); the ground shader compiles
  headless; check-fast 11 of 12, the new bowl check passes. "A battle plays to the end" fails the same way on main
  (stuck at playing in a full parallel run, passes alone): not from this change.
- Questions waiting for the owner: run the Bowl map test on the phone and send the report or debug log.
- Next session starts with: E-map-4, the ground and routes.

### Project Story S2 - every conversation in scripts, the story-dependent world, line ids, story checks - 2026-10-19
Plan approved at the start (S2 of docs/phases/project-story.md). Branch `claude/busy-edison-qm2u0l`, from main at
20c94e1. Owner answers: the S1 line format is agreed (tag `project-story-s1-done` made on 6c4664f, see Risky);
townsfolk chatter and favours stay lists.
- Changed (one cause per commit, 30 commits):
  - Fix first: lint was red on main (engine/frame-block.js `FB`, a two-letter top-level name): renamed `FRAME_FLOAT_AT`;
    main fixed it at the same time as `FRAME_OFFSETS`, and the merge keeps main's.
  - Deleted legacy: Blake's `intro0`, `storyMovedCheck` and the `copperleafNote` flag, the `askLongGrass` flag.
  - A recording of what every conversation said before the move (`tools/test/talk-before-scripts.json`: made in the
    game, headless, with the dialogue box and battle start swapped for recorders): 2 people visit after visit, 49
    trainers met / again / beaten, 27 Hazel lab states, Blake's after-battle talk won / lost / skipped, the ending.
    `story-snapshot.test.mjs` plays every script against it: same words, expressions, speakers, order, battle.
  - Every conversation is a script: each trainer's `script` (ends with `battle <id>`; `runsUp: true` for the six who
    run up to you: chad, chad2, chad3, cass, vinylla1, vinylla2), the people's (Juniper's and Nacre's cycles start
    where today's code started: visit 2 says lines[1]), story.json `scripts`: `hazel`, `blake-first-battle`, `ending`.
    `trainerTalk`, `personTalk`, `talkHazel`, `storyAfterRival`, `storyEnding` only start them; `storyCheck` starts a
    `runsUp` trainer's. `rivalScene` is gone: the stage plays its staging (`camera run-up`, `walk Blake beside me`,
    `face Blake me`, `music rival`; a battle ends the scene with the cheer and the fade, as before).
  - Story layer: `caught` condition, slots `{name}` `{caught}` `{badges}`, `music`, `story:<id>` scripts, a script
    started during another plays inside it, lines wait for open windows (a battle's result), `visits:` counted.
  - Old fields deleted: trainers' `lines`, `intro`, `endLines`; people's `first`, `lines`. The Studio's trainer
    Dialogue card edits the script (one text, indent kept) and a "Runs up to you" box. Fixture, postcards and the
    quick check read `runsUp`. story.json: `talk_<person>` gone (visits replaced it).
  - The story-dependent world: `when` / `unless` on people (walkState), trainers (trainersAt) and props (propShown:
    drawn, solid and the nav grid); `requires` / `locked` on a place (canEnter and gateText: walking in, the world
    map, the airship, route finding); story.json `chapters` (a map loads its variant file's props and people while
    the chapter holds; variant files `<map>__<chapter>.json`, not in index.json).
  - Line ids: `npm run story:ids` (tools/story-ids.mjs) gave 183 lines and options an id (` #l:3fa9`); the parser
    keeps it apart; keyless once / cycle / seq / [once] remember by it; the debug log names it when a script stops or
    is skipped.
  - Story checks in check:data (tools/story-checks.mjs, with the game's own parser): problems and warnings as in
    docs/SCRIPTS.md, the reach check for `requires`; `story-checks.test.mjs` plants a fault for each (16).
  - Data types, schemas (trainer `script` / `runsUp` / `when` / `unless`, map `people`, story `scripts` /
    `chapters`), docs/SCRIPTS.md, CHANGELOG, project-story.md ("After S2").
- Where the phase file or S1 was wrong (checked in the code):
  - There are only 2 people with lines in all 94 maps, 49 trainers, and three hard-coded talks (Hazel's lab, after
    Blake's first battle, the ending); no sign or event data type exists.
  - `nw-opening-done` is not legacy: it is the per-device "seen Blake's first battle, offer Skip" key, and NAMING.md
    keeps localStorage key values. Kept.
  - `copperleaf@ch2` can't be a map id (data ids are `[a-z0-9_]`, and `@` already marks view ids): `copperleaf__ch2`.
  - Doors have no `requires` of their own (a door prop can carry `when`); places do.
- Behaviour that changed on purpose (small):
  - A battle started without talking (debug menu, `?fixture=battle`) no longer prints the trainer's two opening lines
    into the battle log (they live in the script now).
  - A run-up trainer met when the walk scene isn't ready says the run-up lines in the box (before: the short lines).
  - The rival scene's first line now shows in the scene's box style (cutsceneSay) like the rest of it.
- Risky or unfinished:
  - The tag `project-story-s1-done` exists only in this session's clone: the git proxy refused to push a tag. Please
    tag 6c4664f yourself (or tell me to try again).
  - A script's safe run keeps a battle's result only once the battle is over (the checkpoint comes when activeBattle
    clears); closing the app on the battle screen of a scripted battle means the battle plays again on Continue.
  - Chapters are chosen when a map loads (once per start); nothing ships with one yet.
  - New lines written in the Studio's Script field have no id until `npm run story:ids` runs; check:data says so.
  - Story text still has the old plot (you were Vinylla's sound engineer, Cass dropped you): S4's business.
- Verified:
  - Every commit: lint, typecheck, unit tests (118 -> 128), check:data, check:modules, format:check.
  - Smoke (`--smoke`) after the legacy deletions, after wiring the trainers / people / Hazel / after-battle / ending,
    and after deleting the old fields: 15/15 each (the phone flow plays the opening, Blake's first battle and the talk
    after, now from story.json). Not before every single game commit (several small ones shared a run).
  - Headless, lowest graphics, `?story=after-opening`: Juniper (first meeting, then her lines in turn), Hazel's lab,
    Blake on the golf course (the run-up scene with you and Blake on it, his lines, then his battle; the scene closed
    after), holding the box skips to the battle, a save mid-talk writes `resume`, visits counted; no console errors;
    no line id shows on screen. A chapter swap tested in the page (a map loaded another file's props and people).
  - Planted faults: each story check (unit test), and one through `npm run check:data` (a misspelt command fails).
  - Full quick check: 45 of 54 steps passed. The 9 red: v35, v38, v39/v40 (roster counts, known since phase 16), v46
    (building plans, known since 08b-2), v31's fountain wait (known to time out in a full run; green alone), v44
    props scene, alpha 0.4 shapes (bush recipes empty), phase 08 running: these three are red on main 20c94e1 too
    (ran there alone), from the props batches, not this session. Every story step is green (Juniper, the lab).
  - In-game full test (`--selftest`, headless, 18 min): played whole; one red step, "Light lab: props in view: 0 of
    0 buildings" (no buildings in its props scene), the same as the full check's v44 props scene, which is red on
    main too. Nothing in it is from the story.
  - Not run: anything on a phone.
- Questions waiting for the owner:
  - Tag `project-story-s1-done` (6c4664f) and, once you agree, `project-story-s2-done`.
  - Try on your phone: Blake at Old Fairway (the run-up), Granny Juniper,
    Hazel in the lab, a plain trainer; send a debug log.
- Next session starts with: S3, the Studio story editor (the Script field with errors and the command reference,
  story preview, Play from here; it should also give new lines their ids).

### Phase 10 (world map: the bowl), session E-map-3 - camera and controls (preview) - 2026-10-19
Plan approved ("Go"); owner chose: opening tilt about 50 degrees, zoom from the whole bowl down to about one region.
- Changed:
  - `game/js/logic/bowl-camera.js` (no DOM): the camera circles a target on the ground (yaw, tilt, dist); limits
    (never below the rim line, target inside the bowl, zoom 0.45-2.6 radii, tilt 35-89.5 degrees, rising when zoomed
    in so the eye stays above the rim); view and GPU matrix; projection; ground pick under a tap; pan (the land follows
    the finger), zoom, turn, ease, Home (centred on a place, looking outward at the wall) and the whole-bowl view.
  - `game/js/world-bowl.js`: the bowl map as a **preview**, switched per device in the debug menu (Trainers and world
    -> "Bowl world map"; browser storage, not the save). It wraps the map's mount, zoom, Home and labels; the old map
    runs unchanged when the switch is off, when WebGL is missing, or while an airship flight is showing.
    Placeholder ground (one full-screen pass: floor and walls, tinted by the nearest places' regions, water blue, lit
    from the Inner Sun overhead, faint height lines); the 2D miniatures standing on their spots (greyed when locked);
    roads, your trip in gold, labels (towns always, others when picked or zoomed in), here / picked rings, lock and
    "new" marks, Pearlantis as a small marker under Kelpport, you beside your place. Turn left / whole bowl / turn
    right buttons; the Places list stays; Flat view and the old turn/tilt bar are hidden.
  - Controls: one finger drags; two pinch (zoom), twist (turn), slide up or down (tilt); mouse wheel zooms, right
    button or Shift turns and tilts; arrows / WASD pan, Q and E turn, + and - zoom. Tap a miniature (or the ground
    near a place) for its card; picking from the card or the Places list brings the camera over it.
- Risky or unfinished: not seen on a device yet (no graphics run here). Ground, routes in the ground and 3D
  miniatures are session E-map-4; clouds and the airship hop E-map-5. The ground pass loops over 48 places per pixel
  once it hits the ground (fine on a PC; watch the phone frame time).
- Verified: lint, typecheck, check:data, check:modules, format:check, npm test (132 pass; 7 new camera tests: limits
  over 2000 random states, matrix = projection, a tap finds the ground it shows, the land stays under the finger,
  easing takes the short way). The two new shaders compile and link in a headless WebGL2 context (no drawing).
  check-fast: 10 of 11 at once; "A battle plays to the end" stuck once under load and passed twice on its own (this
  change does not touch battles).
- Decisions I made (and why): a preview switch rather than replacing the map now, so the game never has a half-built
  map; the camera looks outward from the place it centres on, so the rising wall behind reads at once.
- Questions waiting for the owner: how the preview feels on the phone (drag, pinch, twist, tilt, Home, tap).
- Next session starts with: E-map-4, the ground and routes.

### Phase 10 (world map: the bowl), sessions E-map-1 and E-map-2 - layout and bowl data - 2026-10-19
Plan in docs/phases/10-world-map-bowl.md (rewritten with the owner's answers). Branch `world-map-bowl-plan`, PR #53.
- Changed:
  - E-map-1: two top-down layouts (docs/phases/10-bowl/, made by tools/layout/). Owner chose layout 1, the spiral.
    Proposed region links (5 roads, 2 Copperleaf specials) are notes only: docs/phases/10-proposed-links.md.
  - E-map-2: every place in locations.json has `bowl: {a, r}` (Pearlantis `{under: "kelpport"}`), type `BowlSpot`.
    New `game/js/logic/bowl.js` (no DOM): depth profile (flat floor to 0.35, 45 degrees at the rim), spots, a map's
    compass on the bowl (north faces the centre, east counter-clockwise), seam turn, roads over the ground.
    `tools/check-data.mjs` checks every spot. The Studio's "add stop" gives a new stop a bowl spot.
- Risky or unfinished: nothing reads `bowl` in the game yet; the sphere map still runs on lon/lat. lon/lat go when
  E-map-3/4 replace the renderer. bowl.js is not loaded by any page yet (the renderer will import it).
- Verified: lint, typecheck, check:data, check:modules, format:check, npm test (125 pass, 7 new in
  tools/test/bowl-layout.test.mjs: every seam within 30 degrees (largest 20.8), no road crossings, places 0.08 apart,
  Copperleaf on the floor's centre). The test fails a mirrored layout (25 seams off). check-fast: data, graph, Studio
  loads. No graphics run.
- Decisions I made (and why): the place data keeps lon/lat until the old map is deleted, so the game never breaks in
  between; spots are stored as angle and radius (stable when the bowl's size or depth changes).
- Questions waiting for the owner: zoom range and default tilt (before E-map-3).
- Next session starts with: E-map-3, camera and controls over the bowl.
### Phase 09 batch 8, part 3 - the owner's answers to the beat sheet - 2026-10-19
- Changed: docs/city-opening-beats.md now 21 s with the owner's decisions (the city replaces the fall's first leg,
  done in S8 so the opening keeps working until then; the figure reaches toward the light; the billboard's advert
  stays open); project-story.md's decisions table points to it. Map `city_opening`: the spot `stumble` is now
  `reach`; one billboard placed opposite the alley as the ad slot (its advert is one picture,
  city_billboard_holo.png, swapped to change it).
- Verified: the script in the beat sheet parses (parseScript, no problems); the billboard clears the towers (from
  the data); data check.
- Next session starts with: S7's remaining owner checks on the phone (the set at night in the rain), then S8.

### Phase 09 batch 8, part 2 - towers lit on every side; the city opening's draft set and beat sheet - 2026-10-19
Owner's request: "the 3D version of the building and a small map for the cutscene", keeping Project Story's system
in mind. Chosen: lit windows on every side, the portal in a side alley, the rift, the layout plus a draft beat sheet.
- Changed (one cause per commit):
  - Engine: a fixed picture layer on a model can face any way (`yaw`, radians: pi/2 the right side, pi the back), in
    the sprite pass and in water reflections (prop-models.js, walk/sprites.js, walk/water.js). Nothing used it
    before, so nothing else changes.
  - The towers' window pictures and neon strips on all four faces (front and back share a picture, the sides
    another); the hero needle's eight faces in two pictures, its crown strip all round.
  - Map `city_opening` (a draft, test: 1, not joined to the world): one avenue between 15 towers, the hero needle
    closing the view, street lights, signs, hovering cars, a 5 m alley on the right two thirds up with the BAR sign,
    puddles, a vending machine, the rift and a new `city_sign_blank` (the organization's logo spot, blank until S4).
    You start at the near end. A `cutscene` block holds what the opening's script will name: spots (walkFrom,
    alleyMouth, lean, stumble, rift, logo), camera shots (above, canyon, street, alleyMouth, rift, through: eye and
    target as [x, height, z], fov) and two car lanes. Nothing reads it yet (camera and walk play from S2).
  - docs/city-opening-beats.md: a 26 s beat sheet, the beats as a script in the story layer's format (it parses with
    today's parseScript, no problems), and the decisions it needs from you.
- Risky or unfinished:
  - Fill rate: each tower now draws about 10 large window pictures and the set has 16 towers. Not measured on a
    phone; walk the avenue at night and send a debug log.
  - The rift stands there always; appearing on a beat needs `when` / `unless` on props (S2) or a show/hide command.
  - Part 1's notes about front-only windows are superseded by this entry; the low-poly setting note still holds.
- Verified: each recipe meshed in Node (city_sign_blank 58 triangles, towers unchanged), the layout checked from the
  data (no tower overlaps another, no prop inside a tower), data check, lint (the frame-block.js note from main),
  type-check, 118 unit tests, format, modules, build, smoke check ("no problems"; its unused note again names one picture and one prop, the same as part 1). No headless renders.
- Questions waiting for the owner: the four in docs/city-opening-beats.md ("For you to decide"); how the set and the
  lit sides look on your phone (Settings > Time of day: night, Weather: rain).
- Next session starts with: your answers to the beat sheet; then S7's script and the scene's commands once S2 is in.

### Phase 09 batch 8 - city opening mockups: towers, signs, street things, portals (provisional) - 2026-10-19
Owner's request: start the city opening's buildings and props, as mockups to judge before S4 and S7-S8 (Project
Story's "Ask me before": the city mockups before S8 builds the scene). Look chosen 2026-10-19: only tall buildings
(Cyberpunk 2077, Blade Runner), sleek tops over grimy bottoms, neon in pink, cyan and amber. Then: "make various
portal shapes".
- Changed (tools/build-props-batch8.py, independent of batches 1-7, rerunnable; new keys only, nothing places them
  outside the new showcase map `test_props_city`):
  - Towers from one kit (grimy base: concrete, slabs, shopfront with a neon strip, pipes, AC units, fire escape,
    small windows with grime runs; sleek shaft: glass, chrome bands, corner fins, lit curtain wall):
    city_tower_slab (90 m), city_tower_mega (95 m, balcony cages, two setbacks, a landing pad), city_tower_hero
    (125 m octagonal needle on a podium, edge light strips, a holo-ad band, the organization's logo panel **blank**).
  - Signs with generic words only (no brands, those are S4's): city_sign_hotel (vertical blade), city_sign_bar,
    city_sign_open (arrow), city_billboard (holo panel on a truss, no text).
  - Street: city_streetlight (cyan bar), city_vending, city_flying_car (hovering at 2.4 m, lights; still, the lanes
    and splines are S8's).
  - Portals, five shapes, each in two colourways (variant 0 violet, the city's side; variant 1 gold-green, the Hollow
    Earth's light): portal_ring (with floating shards), portal_rift (a jagged tear), portal_door (a door that wasn't
    there, on a scorched threshold), portal_gate (a machine-built octagon gate with a generator), portal_hole (the
    pavement gives way: broken slabs, a glowing hole, a beam of light rising). The swirls are still pictures.
  - Each prop has a front picture (for when models are off) and a coloured halo (`glow`) at night.
- Risky or unfinished:
  - Only picture layers glow (the model shader has no emission), so lit windows are a picture on each tower's FRONT
    face only; the sides are unlit glass with bands and fins. Fine for a scripted camera; say if the sides need light.
  - With Settings "Props as low-poly" off, a 125 m tower would be built as voxels at 32 to the metre: too big. Nothing
    turns it off but that setting; S8 should keep the city's towers low-poly always.
  - Triangles (meshed in Node, no rendering): towers 714 / 2,536 / 848, everything else under 330. Not measured on a
    phone; the largest window picture is 378 x 1,699 px (the slab's glass).
- Verified: data check, lint (one naming note in game/js/engine/frame-block.js, already on main), type-check, 118
  unit tests, module and format checks, smoke check (15 of 15; its unused note names detail-a04.png and airship_mast, both from before); each recipe meshed in Node; the generated pictures looked at as
  flat sheets. No headless renders of the props (graphics are for your devices).
- Decisions I made (and why): towers 90-125 m so they read as megacity at street level; sign words kept generic;
  steady glow, no flicker (no engine change; flicker can come with S8).
- Questions waiting for the owner: on your phone, open `test_props_city` with Settings → Time of day at night: the
  look of the towers and signs, which portal shape (or shapes) and which colourway.
- Next session starts with: the owner's picks; then the full kit after S4 (names, logo, surface/interior contrast).

### Phase 20 stage C, session C-2 - One light block per frame (C3), flat things and blades (C4) - 2026-10-19
Plan approved at the start ("Yes, let's go"), after sorting out the branches. Branch `ccr-9d72271f-j72y94`.
- Branches first (nothing of stage B or C-1 was in main at the start):
  - Stage B and the A8 decisions had been pushed onto stage A's branch after #39 merged, so no PR showed them.
    Main had changed walk-view-gl.js since: merged into B with each change put in the game/js/walk/ file its code
    moved to (the 38 changed lines match main's exactly). Merged as **PR #43**.
  - C-1 reached main through #45 (its own branch, ported onto the split by another session). My own port of it
    (#44) merged into B's branch, not main, and is superseded. This session's commits were then replayed onto main
    by themselves: the 6 code commits applied with no conflict.
- Changed (one cause per commit):
  - No-op: LIGHT_GLSL's declarations grouped (samplers and uFol first, then the light values), the sky terms read
    through `SHV(i)`. The same 54 uniforms before and after.
  - **C3** `game/js/engine/frame-block.js` (no WebGL): `FRAME_BLOCK_GLSL`, the std140 offsets worked out from that
    text (2208 bytes), `packFrameBlock` (a light context into the block, with setLightUniforms' values and defaults).
  - **C3** `quality.frameBlock` (off by default; Studio Quality "One light block per frame"): the 14 lit programs
    compile with `PB_FRAME_BLOCK` and read the Frame block on binding point 0. setLightUniforms packs a light context
    and sends it once (one of four slots of one buffer; the reflection's copy takes its own slot) and binds a slot only
    when another was in use; lampShadowMaps marks a packed context stale. Switching it compiles the lit programs again
    at the start of the next frame (a stall of a few frames, only then).
  - **C3** The full test's Shaders step builds each lit program with the block and checks the block's size and each
    member's offset as the device lays them out (smoke: "27 shaders; 14 with the Frame block"). Smoke's line for the
    in-game test now shows each step's note.
  - **C3** Graphics test: the switch off and on at the Lamp square and the Depth corridor (120 steps over 20 settings),
    kept out of "everything lowest / highest".
  - **C4** Flat things: one group on the fx program (bound once, the sprite program again once after). Blades and clock
    hands: the fx program's camera and light sent once per frame and light context, then only switched to.
- Where the phase file was wrong or I went another way (checked in the code):
  - `uCurve`/`uCurveD0` are not in the block: only the vertex shaders read them (COMMON_GLSL), and the shadow passes
    set them before the frame's light context exists. The block is 2208 bytes, not 2224, and has `uShSteps` (the
    file's layout missed it). No vertex shader declares a light value, so only fragment shaders hold the block.
  - The file's program list: `shadow`, `shadowG`, `p3dS`, `voxS`, `bshadow` don't take the block (no light code).
  - C4: blades and clock hands are not moved into a group after the sprites. Each shares a plane with its own picture
    and with any picture at the same depth (billboards at the same z), where the later draw wins, so moving them
    would change the look in places. They still switch programs; the light re-send was most of their cost.
  - The sampler units are still set per program bind (the file says once at link): unchanged here.
- Risky:
  - With the switch on, a light context changed after its first lit draw would show last state; only lampShadowMaps
    changes it, before any lit draw, and it marks it stale. A new caller that changes a context mid-frame must call
    `frameBlockStale(X)`.
  - useFxProgram skips the light re-send by the identity of the camera and the light context; both are made new
    every frame. Code that binds a texture to units 6-13 between lit draws (only setLightUniforms does today) would
    break it.
  - Off by default: what the phone draws is unchanged until you switch it on.
- Verified: after every commit lint, typecheck, unit tests (86 -> 94), check:modules, format:check; check:data and
  build; smoke 15/15 for every commit touching game/. Off sends exactly what it sent before (setLightUniforms' calls
  recorded for three light contexts and three program shapes: identical). All programs compile and link in both
  modes (headless compile only, no drawing). Planted faults fail each new test, and a planted layout fault fails
  smoke's in-game Shaders step. No headless graphics test was run.
- Questions waiting for the owner:
  - Merge this session's PR (C-2 only, from main).
  - On your phones: the Graphics test's two "One light block per frame" steps (Lamp square, Depth corridor), and does
    it look the same switched on? If it holds up, it becomes the default and the old path goes (its own commit).
  - Tags `phase-20a-done` / `phase-20b-done` (and C) once merged?
- Next session starts with: C5 (light picking: stable keys, a persistent lit set with fades, partial top-k every
  ~200 ms, view test, hysteresis, `quality.lights` 16 / 8 on phones), or stage D (pixels) if the numbers say so.
### Phase 08b-2 - rooms in their own space, drawn at the door - 2026-10-19
Plan approved at the start (Part B tasks 7, 8 and the doors half of 2). Branch `ccr-4fc4790e-8depsm`, from main at
d2f9721.
- Changed (one cause per commit):
  - **Fix first:** main's `check:modules` was red (an `engineSetting` import 08b-1 left unused in seamless-world.js).
  - Door link: `doorOf(p)` (door point, way out, the front's middle) and `doorLinkOf(p, act, map)` in the links' shape
    `{kind: 'door', a: {map, exit}, b: {map: room, exit: 0}}`. A kind's room is now `room` in scenery.json (11 kinds;
    the table in ui.js and the Studio's two copies, int_station included, are gone); the choice is
    `PB_DATA.doorRooms` (data-files.js), shared by the game, the Studio and check-data. A turned building's door turns
    with it (257 doors move 9 cm at most). check-data: every door opens a room, the room has its doorway at the front,
    the door is on the building's front.
  - **Rooms over the place:** a room's view (seamlessRoomMap, same ids) is the place's own view with the room's tiles,
    heights, walls and things laid in, but its ground is the place's (`groundOf`: same picture, mesh and near ring;
    groundKey and the scene cache follow it). The place's ground, grass, water and their shadows leave a hole where
    the room is; the room's floor and walls, built from the room alone (`roomScene`, painted at the near ring's size),
    are drawn there at the floor's height (walk/ground-draw.js roomHole, roomFloorReady; three rooms' floors kept).
    Nothing is cropped any more (roomCut is gone).
  - Speed: in a room the walking grid works out heights for the room only; the heights grid is the place's with the
    floor laid in; the last two views' walking grids are kept (coming out is a swap).
  - Out of a room: 0.6 m in front of the door, facing the way the building faces, the camera as it was.
  - One path: no 9 s fallback (after 2 s at the door the floor is painted at once), no room shown on its own (a door
    needs a building; Marigold's two signs lead into the building they stand by), no "Shops and houses: Counter", no
    `seamlessRooms` switch, the `roomDim` setting is a constant (ROOM_DIM 0.68).
  - Tests: the full test's room step (doorway within 0.1 m, nothing of the room outside it, exact exit and camera,
    the town's walking grid unchanged); v46 (all 92 doors of Copperleaf, Verdigris, Marigold); v31 walks in through a
    house's door; the room fixture (check-fast) walks into the shop; `tools/measure-rooms.py` (new).
- Room open times, headless (software drawing, from tap at the door to the room shown; cold / warm):

  | Door | Before | After |
  |---|---|---|
  | Marigold shop | 9.8-13.1 s / 13-31 ms | 0.9-1.2 s / 28-209 ms |
  | Marigold market hall | 6.1-8.1 s | 0.7-1.4 s |
  | Marigold house_red | 6.2-7.6 s | 0.3-1.6 s |
  | Copperleaf, your room | 4.4-4.8 s | 0.7-1.1 s |
  | Verdigris mansion | 5.3-6.3 s | 1.9-2.7 s |
  | Verdigris townhouse_red | 5.3-6.3 s | 0.3-0.9 s |

  The wait itself ("waited N ms" in the log) went from 2.5-8.8 s to 0.1-1.0 s. Coming out costs about 0.2 s of
  drawing (it was a walking-grid and heights rebuild). The sign_shop row now includes walking to the shop's door.
- Risky or unfinished:
  - The first frames inside still gather the room's things and, the first time, cut tree leaves for any tree picture
    not seen yet (about 0.7 s headless, once); on a phone this should be small. Your phone log's "inside ... (waited
    N ms)" lines are the real numbers.
  - The town's structures (bridges, rails, arches) and far props are rebuilt for the room's view as before (cheap so
    far); bridges or arches crossing a room's rectangle are not hidden by the hole.
  - The near ring is painted from the place's own view while you're in a room; flat props under the room stay painted
    on the place's ground (hidden by the hole).
  - 303 of 342 room footprints cover another building's footprint (from the 08a audit); those buildings are left out
    while you're inside, as before.
- Verified: every commit lint, typecheck, unit tests (72), check:data, check:modules, format:check. Before merging
  main: smoke 15/15, check-fast 11/11, the quick check's room steps (rooms, time and weather and rooms, things to do,
  v31, v46, v47, alpha 0.1's windows) all green. After merging main (phase 20 stage B's walk/ split, props batches
  4-7): smoke 15/15, check-fast 11/11, the full test's room step (in 0.7 s; doorway 0.02 m along from the door), v31
  green (alone; in a run after other steps its 90 s wait for the fountain's water timed out once), **v46 red on main
  too**: "buildings without a plan: bakery, inn, market_hall, library, greenhouse" (props batch 7 made them models
  from the house kit; the step still expects build plans). Not fixed here. The full quick check and the in-game full
  test whole were not run (08b-3 ends the phase with them).
- Questions waiting for the owner:
  - Try rooms on your phone (the Marigold shop, your room, a mansion) and send a debug log.
  - Merge this branch to main, then "start 08b-3" (tasks 9 and 10: room templates and slot sets, home from the save,
    build-interiors.py retired; the Studio edits links and doors; the full quick check, the first picture baseline,
    `phase-08-done`).
- Next session starts with: "start 08b-3".

### Phase 08b-1 - roads as typed links, seam checks, prefetch (recap) - 2026-10-19
Written in 08b-2 from the commits (13e96a7 to 0e5c20c); that session left no entry. Not re-verified beyond what
08b-2's checks cover.
- Changed: one road accessor for the Studio and the tools (PB_DATA.road, setRoadEnd, addRoad; gamedata.py the same);
  roads.json as typed links by map id `{id, name, kind: 'seam' | 'lift', a: {map, exit}, b: {map, exit}}` with a
  schema; the glass lift is a `lift` link; check-data validates the links (facing, widths, at most two exits a side,
  44 m apart, walkable ground at each exit, every exit used once); the Studio errors on a road without both exits or
  with exits that don't face each other; the compass-bearing fallback, the "Seamless world" and 'joined' switches
  deleted; the debug log's 'world' section (map files, views kept, crossings); the quick check's seam walk (the six
  hardest, all 56 with --seams=all) and v43 composing every place's view; the next place's view prepared about 40 m
  before an exit.
- Left: tasks 7-10 (07-08 done in 08b-2).

### Project Story S1 - the story layer - 2026-10-19
Plan approved at the start (S1 of docs/phases/project-story.md). Branch `ccr-f321762c-zuw15s`, from main at d2f9721.
- Changed (one cause per commit):
  - Fix first: check:modules was red on main (an unused import in seamless-world.js since PR #41); regenerated.
  - `game/js/logic/conditions.js`: the condition grammar (flag, !flag, flag = word, beat:, item:, coin:, quest:,
    visits:, visited:, billie:, robot, badges; and/or/not, parentheses), parsed once, never run as code; errors
    with a column and "did you mean"; `storyStateOf(save)`.
  - `game/js/logic/script.js`: the script parser (lines with [expression] and Name:, choice with [if]/[once] options,
    if/elif/else, once, cycle, seq, a command table `SCRIPT_COMMANDS`), the runner on a stage interface (runs in
    Node with a stub), checkpoints and resume paths, skipping, `setStoryFlag`, safe-run saves, start presets.
  - `game/data/story.json` (+ schema, check-data): every story flag and what it means, flag patterns, the story's own
    records, speakers, quests (none yet), presets. Every place the game sets a story flag goes through
    `setStoryFlag` (same keys in the save); a flag story.json lacks is a data warning in the debug log.
  - `game/js/story-stage.js`: the game's stage (lines in the dialogue box, a new choice box in talk.js and
    css/dialogue.css, wait, heal, battle), safe runs (while a script plays, JSON.stringify(saveData) writes the state
    from before it plus `story.resume`; `storyResumeCheck` plays it again on Continue), hold the box 0.6 s to skip.
  - `?story=<preset>`: a test run (nothing saved) at `after-opening` or `before-cass`.
  - Three scripts in the data, next to the old fields, not played by the game on its own: Granny Juniper
    (copperleaf.json people), Blake on the golf course (trainers/chad.json), Curator Nacre (pearlantis.json people,
    with a choice once the Pearl ledger is read). Debug menu > Story scripts plays them.
  - docs/SCRIPTS.md (the format), CHANGELOG.
- Where the phase file was wrong or thin (checked in the code):
  - `saveData.flags` is trainers beaten, not story flags; it stays, read as `beat:<id>`. `saveData.story` is the one
    story-flag object (`storyFlags()` and `loreFlags()` are the same object).
  - Coins aren't items: `coin:gold`, not `item:coin_gold`.
  - `visits:` had nothing behind it (`talk_<id>` is a line index): `story.talks` is reserved for it; S2 counts.
  - No sign or event data type exists; books are lore.json `books`. Scripts live on people and trainers for now.
  - `stage:id >= found` folded into `quest:id >= found`; `badge:n` is `badges >= n`.
  - `walk who x z`: the rival scene walks relative to you, so walk takes free arguments; S2 settles them.
- Found while listing the flags: lore.json unlocks entries with `planKnown`, `metVariants` and `region:*`, which
  nothing sets (those entries never open); `askLongGrass` is set and read nowhere. Juniper today starts her second
  visit on her second line (personTalk counts up before it reads); the script starts on the first.
- Legacy to delete in S2 (deletion-only commits): `intro0`, `storyMovedCheck` / `copperleafNote`, the
  `nw-opening-done` key.
- Risky or unfinished:
  - The game plays no script by itself yet; S2 wires people, trainers and rival scenes to them.
  - walk, face, camera, fade and shot do nothing yet (a debug-log note); go and the openings' other commands stop a
    script with an error.
  - A safe run keeps aside the story, items, coins and trainers beaten; team changes (heal, battle XP) are kept as
    they happen. A battle is a checkpoint, so a save after it keeps the battle's result.
  - `once`/`cycle`/`[once]` without a key are remembered by script and line number: editing lines above one moves it
    (S2's line ids fix that).
  - The choice box is new UI; look at it on your phone (debug menu > Story scripts > person:nacre, after reading the
    Pearl ledger in Pearlantis, or set the flag with the debug console).
- Verified:
  - Every commit: lint, typecheck, unit tests (72 -> 94: conditions, script, story-data, story-scripts), check:data,
    check:modules, format:check. Planted faults: a bad species, place and speaker in story.json each fail check:data.
  - The three scripts play on a stub with today's words (Juniper's first meeting and lines, Blake's intro then the
    battle, Nacre's first meeting and lines); Nacre's choice appears once the ledger is read, its [once] option goes.
  - Headless (lowest graphics): `?story=after-opening` opens in Copperleaf with Blake beaten; Juniper, Nacre (choice
    box, tap an option) and Blake (lines, then his battle starts) play from the stage; a save while Nacre's choice is
    open writes `resume` and the live save keeps none; holding the box skips the rest; a saved `resume` plays again
    from its line. No console errors (only gamedata.js 404, expected when it isn't built). One screenshot of the
    choice box at 390 px.
  - Smoke (`check-quick.py --smoke`) on the final code: 15/15, the opening and Blake's battle as before, debug log
    with no names.
  - Not run: the full quick check, the in-game full test whole, anything on a phone.
- Questions waiting for the owner ("Ask me before"): the line format, from the three scripts (docs/SCRIPTS.md and the
  data). Tag `project-story-s1-done` once you agree.
- Next session starts with: S2, after the format is agreed: every person, trainer and rival scene moved into scripts.
### Phase 06-4 - the last screens, floating sheets, gallery, dead CSS, accessibility, safety - 2026-10-19
Branch `phase-06-4`, based on main as of 2026-10-19 (main and `phase-07-portraits` merged in, both clean).
- Changed:
  - Every sheet floats (one `.scrim .sheet` rule in ui-kit.css; the per-sheet copies are gone). New `menus.css`: the
    Field Guide (84 px rows, sideways filter chips, prose font for notes), Trainer card, friends, Settings, shop and
    dressing room on the tokens.
  - Dialogue portrait drawn at 1.5× (64 → 96 px) in whole device pixels (talk.js). This answers 07's open question
    "how the 64 px portrait fills the 96×96 slot": the new renderer only has to draw a 64 px picture.
  - Battle: the classic corner cards' code removed; what they showed that the plates did not (stat stages, robot
    limb HP, party dots, the low-HP glow) moved onto the plates. Wide screens (owner, 2026-10-19): the message and
    menu cards sit in a right-hand column, clear of the edge, centred top to bottom. Fixes cards off screen on iPad
    and against the right edge on laptops: style.css zooms the dock 1.18 / 1.35 on big screens, and floatTick now
    allows for that zoom.
  - Studio "UI gallery" (studio/gallery.html): every kit component, theme / width (320, 390, wide) / reduced-motion
    switches, built from the game's own CSS and ui-kit.js.
  - Dead CSS: about 840 lines removed (old team cards, Stats tab, old pick card, step intro, old Workshop list, hcard
    family). `tools/unused-css.mjs` lists the rest: 36 older candidates, left on purpose (each needs a look).
  - Accessibility: every control ≥ 40 px or an icon with a 14 px larger tap area; type pills darkened just enough
    for 4.5:1 contrast (`logic/colors.js`, unit-tested on every type colour); arrow keys, Home and End on tab rows.
  - Safety: the friend code is escaped; new full-check step "Safety" puts a hostile name in every player-written
    field and opens 13 screens (fails on a planted fault); new step "Tap targets" measures 9 screens.
- Risky or unfinished:
  - **The 06 plan is not fully met.** Every screen is on the tokens, but the plan also said "one module per screen"
    and "old CSS files deleted when empty". Not done: `ui.js` is still ~3,000 lines (pop-ups, top bar, walk and
    rooms, world map, Team, Guide, Trainer card, the button switch), and ~10,000 of 12,600 CSS lines sit in
    style.css, screens.css, polish.css and v05.css, which override each other in layers.
  - The Walking seam step fails, as it does on untouched main (not from this work).
  - Animations and the wide-screen battle layout are untested on real devices.
- Verified: lint, type-check, 74 unit tests, module check, format, data check, build, after both merges. Smoke and
  the Messages, Team, Safety and Tap-target steps: see the PR. Battle cards measured (low render) at 390×844,
  820×1180, 1180×820, 1440×900 and 1600×1050: both cards fully on screen, right margins 35-48 px in landscape.
- Decisions I made: kept the big-screen zoom (bigger text on big screens) and corrected for it rather than removing
  it; left the 36 unused-CSS candidates for a hand check rather than deleting them blind.
- Questions waiting for the owner: (1) Is splitting ui.js and the four old CSS files part of phase 06 (a session
  06-5, before the tag) or a later phase? Recommendation: 06-5, before phase-06-done. (2) Tag phase-06-done once
  that's settled (tag pushes are refused from here). (3) Delete `codex/playable-ui-graphics-poc` on GitHub.
- Next session starts with: the owner's answer to (1). If 06-5: one commit per screen moved out of ui.js into its own
  module, its CSS moved out of the old files with it, moves only, smoke after each.

### Phase 07 part 1 (in progress) - portrait kit, slicer, portraits.json - 2026-10-19
Branch `phase-07-portraits` (not merged, no PR yet). Plan agreed in chat with the owner; written up in
docs/phases/07-plan.md (decisions, data format, status, next steps).
- Owner's decisions: portraits are 64×64; the face kit is cut from AI-drawn part sheets; the body stays still and the
  head moves freely (sub-pixel and rotating, NOT on the pixel grid: this replaces the phase file's whole-pixel
  motion); everything is placed by data so it can be edited in a Studio "Portraits" section; the old portrait
  system stays until the owner says otherwise.
- Changed:
  - `tools/art-source/portrait-kit/`: the 15 source sheets and `kit.json`; `prototype/`: the prototype renderer and
    test page, reference only (eslint now ignores `tools/art-source/`).
  - `tools/slice-portrait-kit.py`: cuts the sheets into 311 pictures in `game/art/next/portraits/` and seeds or
    merges `game/data/portraits.json` (keeps existing data; `--reset` starts over), written in the Studio's layout.
  - `game/data/portraits.json` (12 heads, 93 parts, 13 eye styles, 2 mouth sets, 7 expressions, motion, palettes,
    4 sample faces), listed in `index.json` after `wardrobe`; `game/data/schema/portraits.schema.json`;
    `PortraitData` and friends in `game/types/game-data.d.ts`.
  - `tools/check-data.mjs`: validates portraits.json and checks every head, part, eye frame, mouth frame and face it
    names exists (tried: removing one picture is reported).
  - Docs: docs/phases/07-plan.md (new), a pointer at the top of 07-portraits.md, an ART-NOTES section.
- Nothing in the game or the Studio uses the portraits yet: the data loads into GAMEDATA.portraits and is unused.
- Risky or unfinished: no renderer, no Studio section, no tests of the portraits themselves yet. The cut art has known
  rough spots (07-plan.md, last section). The source sheets add about 20 MB to the repository.
- Verified: lint, typecheck, unit tests (72 pass), check:data (212 files), format:check. Not run: smoke (a data
  section only; the owner prefers no headless graphics runs).
- Questions waiting for the owner: none now. Later: deleting the old system; how the 64 px portrait fills 06's
  96×96 slot (1×, 2× or a canvas at device pixels).
- Next session starts with: 07-plan.md "What is left", step 1 (the renderer: logic/portrait-layout.js and
  portrait-art.js), then step 2 (the Studio section), then step 3 (tests).
### Phase 20 stage C, session C-1 - Frame settings and allocations (C1, C2) - 2026-10-19
Plan approved at the start with "continue" on my recommendation: C1 and C2 now (no look change), before stage A's A8
numbers and before phase 19, which the phase file puts first. Branch `ccr-ca9ccdfe-oyecc9`, from main at d2f9721.
- Merged with main after stage B (2026-10-19): this session's changes to walk-view-gl.js now sit where stage B moved
  each function: worldCurveDrop and setSpriteUniforms in walk/draw-common.js, walkLightContext in walk/lighting.js,
  the shadow passes in walk/shadows.js, the grass trail and flowers in walk/ground-draw.js, drawSprites in
  walk/sprites.js; beginFrameSettings/endFrameSettings stay in walk-view-gl.js. Same code, moved; checks green.
- Changed (one cause per commit):
  - Main's last merge (#41) left an unused import in seamless-world.js, so `check:modules` failed on main. Regenerated.
  - **C1** Defaults for the four dials the code read with none (the phase file named two): `quality.keepScenes` 3,
    `quality.paintWorker` true, `world.roomDim` 0.68, `world.seamlessRooms` true, each at the code's own fallback.
  - **C1** `FRAME_SETTINGS` (engine/settings.js): `beginFrameSettings()` runs once per walk frame, after the
    environment update and the seamless look. It looks every dial up once (11 groups, 149 keys), and `engineSetting`
    answers from that table while the frame is open, but only if the look and the environment flag are still the ones it
    was filled with, and never while the Studio's defaults switch is on. Unknown keys, other screens and code between
    frames take the full lookup. `drawWalkFrame`'s finally closes it.
  - **C2**, one commit each:
    - Sprite uniforms take a slice's depth and a rising picture's height share as arguments. Before, the shadow passes
      made 6 item copies per building, and the sprite pass made 1 per rising picture.
    - `worldCurveDrop` no longer makes an array (it runs per grid cell and item).
    - Contact-shadow blobs come from a pool. The same sort keeps the same order, ties included.
    - The shadow passes filter into kept lists.
    - The sprite pass's list, its building-fade map and a turned picture's axes are kept between frames.
    - The grass trail buffer and each flower set's colours are kept.
    - New module `game/js/engine/frame-lists.js` (no WebGL): `pooledQuad`, `nearestFirst`, `filterInto`. Its script
      tag is on both pages.
  - Tests: `tools/test/frame-settings.test.mjs` checks every key, fast path against full lookup, with player, look,
    game-data and environment sources and the Studio switch. `tools/test/frame-allocations.test.mjs` checks each C2
    change against the old code, kept in the test. `tools/test/walk-renderer.mjs` loads walk-view-gl.js in Node with a
    stand-in GL that records calls.
- Not done from C1 and C2, and why:
  - **gatherFrameItems item pool:** I'm pushing back on this one. About 20 functions in several modules add fields to
    the items (vol, vox, bld3, cross, layer, wave...) and some splice the list. A pool would carry stale fields from
    the previous frame unless every field is reset, and items of mixed shapes in one pool slow V8 down. The items live
    for one frame, which is the cheap case for V8's young-generation collector. Do it only if your `alloc` numbers
    (stage A) show garbage-collection hitches.
  - Hot derived values in a frame table (curve args, wind, brightness): with FRAME_SETTINGS a dial is a property read,
    so this saves little.
  - `matrix4` writing into a given array, and the reflection's two `Object.assign` calls: about 15 small objects a
    frame in total.
  - The basin key: a few strings a frame, only where there are fountains. Its `toFixed(2)` rounding is the
    behaviour, so comparing by numbers would change it slightly.
  - The light lists in `walkLightContext` and `pickPointLights`: those get rewritten in C5.
- Risky:
  - A dial changed in the middle of a frame is seen next frame. Nothing does that today: the environment changes only
    in `environmentFrame`, before the table fills, and the graphics tests, the Studio and Settings change dials between
    frames. Code that starts doing it must call `beginFrameSettings()` again.
  - The kept lists are only safe while each function runs once per frame and nobody keeps the list (checked:
    `walkLightContext` and `drawSprites` have one caller each, and the shadow drawers don't store what they get).
- Verified: lint, typecheck, unit tests (72 -> 86), check:modules, check:data and format:check after every commit.
  Smoke 15/15 after C1 (248 s) and on the final code (231 s). No headless graphics test was run (as the phase file
  says).
- Questions waiting for the owner:
  - Your phone: does the walk view look and run the same? The diagnostics' long frames and the log's `alloc`, before
    and after (main vs this branch), would show whether C2 helped.
  - Still open from stage A: the A8 numbers, the budgets, the `phase-20a-done` tag.
- Next session starts with: C-2 (C3, the Frame uniform block, behind `quality.frameBlock`; C4, flat items and blades
  grouped by program). Or stage D first, if the A8 numbers say pixels.

### Phase 20 stage B - walk-view-gl.js split into game/js/walk/ (moves only) - 2026-10-19
Plan approved at the start (the file list was the "Ask me before"). Branch `ccr-9b6f14fb-6t1w6i`.
- Changed (12 move commits, leaves first as in the phase file's B2, plus one tool fix and this docs commit):
  - walk-view-gl.js 8,196 -> 570 lines (the canvas, mounting a place, the context restore, the walk view's overrides,
    drawWalkFrame and drawWalkFrameInner). 23 new files in game/js/walk/, in page order before it: walk-state,
    heights, walk-shaders, draw-common, water-data, ground-textures, grass-build, ground-mesh (918 lines, the largest),
    map-cache, quality-cull, sky, rooms, water, prop-look, frame-items, sprites, camera, lighting, shadows,
    ground-draw, fountains-weather, effects, input. Script tags in game/index.html and studio/index.html.
  - Each statement moved byte for byte with the comments before it (a scratch script cut them out; npm run modules
    wrote the imports, exports and setters). Proof, after every commit: the top-level statements of walk-view-gl.js
    and game/js/walk/ together are the same 186 statements and 233 comments as before, plus one banner per new file.
  - hooks.js 234 -> 238 names, each a call at run time into code that loads later: groundOcclusionTexture (ground
    textures -> near ring), freeNearRing (ground mesh -> near ring, the one the phase file named), setPropLookUniforms
    (rooms, water -> prop looks), propBaseHeight (into frame items). No load-time read crosses a file.
  - vite.config.js removes the emptied game/js/walk folder after bundling (like game/js/engine); tools/rename-ids.mjs
    points at FLOWER_SET_BY_LOCATION in walk/ground-draw.js.
  - Tool fix (own commit): to-module writes the no-func-assign comment round expose() only where an entry assigns a
    function itself; effects.js (one function with a setter) got an unused one and a lint warning. No other
    generated file changed.
  - Docs and comments that named walk-view-gl.js for code that moved: README's file guide, ART-NOTES (wall colours,
    the town rise), NAMING (walkRenderer), and comments in seamless-world.js, walk-view.js, build-flags.py.
- Risky: nothing should behave differently; the risk is a module order problem that only shows on a page or a path
  the checks don't open. The game, the Studio and the build all load.
- Verified, after every move commit: lint, typecheck, 72 unit tests, check:data, check:modules, format:check, no new
  duplicate top-level name (the 18 game/Studio pairs from before stay), smoke 15/15. Build after commits 1 and 12
  (no walk folder left in dist). At the end: check-studio-github.py (21 sections, the proposal goes through); the
  smoke run's debug log has the same sections and fields, every timed pass (models, box faces, structures included)
  and the same 104 entries in its error list.
- Not done: no line was reformatted (long lines stay; CLAUDE.md wants that in its own no-op commit).
- Questions waiting for the owner: on your phone, the game should look and run as before (a Graphics test step off by
  more than its noise would mean something went wrong). Tags `phase-20a-done` / `phase-20b-done`?
- Next session starts with: stage C (CPU per frame: frame settings, allocations, one uniform block, flat items and
  blades grouped, light picking) in Plan Mode; or D first if you'd rather go at the pixels, given the 60 fps aim.

### Phase 20 stage A - Measure (GPU counters) - 2026-10-19
Plan approved at the start (Stage A only: phase 19 is not done, and the phase file lets only Stage A run early).
Branch `ccr-9b6f14fb-6t1w6i`, from main at 09ae2ba. The phase file is now docs/phases/20-renderer-batching.md.
- Changed (one cause per commit):
  - **Fix (A6):** the diagnostics' and the Graphics test's pass timers skipped drawPropModels, drawBoxFaces and
    drawStructures. Cause: tools/to-module.mjs fills the debug log's GAME object only from debug-log.js's own lists, and
    self-test.js's DIAGNOSTICS_PASSES is not one. They are in debug-log.js's renderer list now (so they also get a
    per-second time in `prof`). A Node test fails if a pass named there is missing from GAME.
  - `game/js/engine/gpu-counters.js` (A1): own-property wrappers on the context for the draws (instances counted),
    useProgram (real switches only), bindTexture, bindVertexArray, every uniform setter, texImage2D/texSubImage2D and
    bufferData/bufferSubData (bytes). Off puts each method back exactly as it was (a test's own wrapper included).
  - Passes (A2): a gpuPass() mark before each pass of drawWalkFrameInner, and inside shadowPass (far, near) and
    lampShadowMaps (lamp0, lamp1). Screens other than the walk view (world map, battle stage canvas) count as `other`.
  - When (A3): the frame scheduler counts one tick a second, every tick while a test measures; on and off in the same
    tick, so the full test's light lab (which wraps the draws itself, from async code) never meets them half-way.
    A counted tick that drew nothing is not kept.
  - Log fields (A4, A5, A7): `dc`, `dcp`, `up`, `lit`, `pcl`, `alloc` in each second's sample (docs/TESTING.md says
    what each holds). `pcl` counts from a second after a walk scene is ready; opening a place, or the world map for
    the first time, resets the "settled" flag.
  - Tests: the diagnostics' frame budget line and every Graphics test step carry draws, instances, program switches
    and draws per pass; a Draws column in both graphics tests' tables.
- Where the phase file was wrong (checked in the code): the commit it names (3ac5b5b) is not in this repository and its
  lines are off by about 2; A6's cause (above); there are two graphics tests (the bench and the older per-dial one);
  the battle has no separate mount, so `pcl` is not reset at battle start (a battle compiling a program counts, which
  is what H5 wants to see).
- First number (headless, so the count only, not the speed): Marigold in the smoke run makes about **2,250 draws a
  frame** (sprites ~1,260, far sun shadow ~450, effects ~330, models ~90, reflection ~48, buildings ~45), not the
  phase file's "about 400". Draw counts don't depend on the resolution, but the smoke run's settings differ from the
  game's own values; your phone's log will say.
- Risky or unfinished:
  - While a test measures, every frame is counted, which adds some processor time to each (every step alike).
  - `alloc` is Chrome-only and coarse (Chrome rounds and delays the heap figure); the iPad has none.
  - `pcl` counts since the page loaded; the per-dial graphics test's shader check adds to it.
  - A8 is yours: the baseline on the iPad and the Android phone.
- Verified: every commit lint, typecheck, unit tests (65 -> 72), check:data, check:modules, format:check; smoke at the
  end 15/15 green; its exported phone log has `dc`/`dcp`/`up`/`lit` in 69 of 85 samples and the same 104 entries in
  its error list as before (all phase 16 "is in legacy" warnings). No headless graphics test was run.
- **A8 baseline, iPad** (Graphics test, 2026-10-19 04:47, Chrome on iPadOS 26.7, Apple GPU, 1366x886 at DPR 2,
  60 Hz, no GPU timers; 116 steps, no errors). The station's untouched look, per frame:

  | Station | fps | CPU ms | Draws | Shadow + lamp draws | Biggest passes |
  |---|---|---|---|---|---|
  | Control pad | 51.5 | 4.2 | 471 | 215 | far sun 173, effects 86, models 44, sprites 43 |
  | Shadow court | 46 | 5.0 | 633 | 270 | far sun 236, effects 106, sprites 85 |
  | Pond | 50.5 | 3.5 | 429 | 136 | far sun 96, sprites 91, effects 82, reflection 47 |
  | Sun gap | 42 | 6.0 | 955 | 343 | sprites 360, far sun 195, near sun 148, effects 96 |
  | Lamp square (night) | 37.5 | 5.4 | 789 | 410 | far sun 235, sprites 116, effects 114, near 105, lamps 70 |
  | Meadow | 50.5 | 3.5 | 436 | 160 | sprites 116, far sun 96, effects 70 |
  | Depth corridor | 45 | 4.8 | 699 | 343 | far sun 233, sprites 143, near sun 110, effects 100 |
  | Open sky | 51 | 3.9 | 500 | 171 | sprites 165, far sun 108, effects 88 |
  | Everything: own values / lowest / highest | 40 / 60 / 39.5 | 6.1 / 5.4 / 6.7 | 1006 / 733 / 1039 | 363 / 187 / 363 | sprites 395-428 |

  What it says:
  - The iPad is not held back by draw calls: about 1,000 draws cost 6-7 ms of processor time, and "everything
    lowest" runs 60 fps with 733 draws. Its frames (19-25 ms) wait on the graphics chip. Sharpness 0.4-0.55 holds 60
    fps; 1.0 gives 50.5.
  - The shadow maps are 35-52% of all draws. The far sun map draws 96-236 a frame even though it is meant to be
    cached for what never moves: the swaying props miss the cache (the phase file's claim, confirmed). Stages E11
    (sway in the shader) and F (casters) aim at this.
  - "Effects" makes 70-114 draws at every station: the flat items and blades drawn one by one (C4).
  - The Sun gap's 360 sprite draws are the grove itself (the phase file's claim, confirmed).
  - Same frame rates as the earlier iPad report (38.5 / 57.5 / 37 then; 40 / 60 / 39.5 now), so counting every frame
    during the test costs no visible speed here.
  - One odd step: Film grain at 0.15 cost 3.5 ms where 0.11 cost 0.6 ms; grain is one uniform in the final pass, so
    this is probably a one-off hitch in that 3 s window (its worst fps was 39). Watch for it on the next run.
  - The headless smoke run's 2,250 draws were Marigold, a full town; the bench places are smaller. A real town by
    night (Copperleaf) is still to be measured on the devices.
- **A8 baseline, Android phone** (Graphics test 05:04 and diagnostics 05:05, 2026-10-19; Adreno 750, Opera on
  Chromium 152, 411x727 at DPR 3.5, 60 Hz, no GPU timers; 116 steps, no errors; diagnostics passed).

  | Station | fps | frame ms | CPU ms | Draws | Shadow + lamp draws | Biggest passes |
  |---|---|---|---|---|---|---|
  | Control pad | 52 | 19.2 | 7.5 | 630 | 200 | sprites 232, far sun 158, effects 69 |
  | Shadow court | 47.5 | 21.1 | 8.2 | 470 | 230 | far sun 196, effects 99, sprites 52 |
  | Pond | 53 | 18.9 | 6.5 | 347 | 123 | far sun 83, sprites 78, effects 49, reflection 47 |
  | Sun gap | 32.5 | 30.8 | 13.1 | 883 | 317 | sprites 346, far sun 171, near sun 146, effects 82 |
  | Lamp square (night) | 33.5 | 29.9 | 10.7 | 685 | 378 | far sun 203, effects 113, near 105, sprites 102, lamps 70 |
  | Meadow | 49 | 20.4 | 6.2 | 368 | 145 | sprites 85, far sun 81, near sun 64 |
  | Depth corridor | 42 | 23.8 | 8.7 | 579 | 306 | far sun 196, near sun 110, sprites 103, effects 99 |
  | Open sky | 49 | 20.4 | 6.8 | 383 | 152 | sprites 97, far sun 89, near sun 63 |
  | Everything: own values / lowest / highest | 24 / 60 / 25.5 | 41.7 / 16.7 / 39.2 | 14.9 / 7.3 / 15.7 | 884 / 637 / 905 | 332 / 158 / 332 | sprites 325-371 |

  Diagnostics (automatic quality on, resolution 0.9, level 2): Clovercrest 27 fps (998 props), Thornberry Wood 28,
  the shop 60, Fizzwell 27, Driftwreck Bay 32, Pearlantis 28.5. Frame budget in the busiest town (Clovercrest, at
  05:05, so after dark): 378 draws, 6,163 instances, 41 program switches, 403 texture binds, **4,093 uniform calls**
  a frame (about 11 per draw); processor time in the passes about 4 ms. Clear day 35 fps, **rain 25**, night 29.
  Battle 36.8 fps, one 701 ms hitch (drawing x3, setting up the ground). 79 MB of pictures on the card.

  What it says:
  - The phone waits on its graphics chip almost everywhere: frames of 19-42 ms against 6-15 ms of processor time.
    The same scene with everything lowest runs 60 fps with 637 draws, and at the game's own values 24 fps with 884
    draws: the gap is pixels and effects, not draws. The phase file's order (pixels first, stage D) holds.
  - Draws still cost this phone's processor about twice the iPad's: roughly 1.1-1.5 ms per 100 draws (883 draws ->
    13 ms at the Sun gap). At the Sun gap and the lamp square the processor time (11-13 ms) is close to a 60 fps
    frame, so draws become the limit as soon as the pixel cost comes down.
  - Shadow maps are again 30-55% of all draws; "effects" 47-113; the Sun gap's sprites 346.
  - Uniform calls (~11 per draw) are a CPU cost of their own: C3 (one uniform block) and E (instancing) cut them.
  - Rain costs 10 fps in town; worth a look in stage D (it is not a Graphics test setting).
  - Better than the format 1 Android report on the same chip (own values 15.5 -> 24, lowest 42 -> 60, highest 16.5 ->
    25.5; Sharpness 1.0 at the control pad 29.5 -> 51.5). Not explained by this phase (it changed no drawing); the
    browser differs (Chrome then, Opera now), format 1's settling was flawed, and phases 08a/09 came in between. A
    run in Chrome would separate the browser from the rest.
- Still missing for A8: the debug logs (a walk in Copperleaf at night on each device) and the iPad's diagnostics test.
  Neither blocks the budgets.
- Decided by the owner (A8, 2026-10-19): at most **400 draws a frame on phones** (shadow passes included); **60 fps in
  towns on the Android phone at the game's own values**; next stage **B**. Also in the phase file's "Decided".
  - My caution on 60 fps: towns run 27-28 fps today with automatic quality already lowering things, and the phone
    waits on its graphics chip. Stage D (sky last, mediump, invalidate, phone pixel budget, grove overdraw) is
    unlikely to double the frame rate on its own; expect to also need cheaper effects at the game's own values on
    phones, which changes the look. Each such change is yours to approve on the phone.
- Still to send (not blocking): a debug log from a walk in Copperleaf at night on each device; the iPad's diagnostics.
- Tag: `phase-20a-done` not set (no answer yet).
- Next session starts with: stage B in Plan Mode, the file list first ("Ask me before"), then the moves one commit
  each, leaves first (phase file B2).

### Phase 08a-3 - UI, text, Studio, running - 2026-10-19
Plan approved at the start (docs/phases/08a-plan.md, section 08a-3, now marked done with the corrections found).
Branch `ccr-72e8ad56-lpn1x3`, from main.
- Changed (24 commits after the merge, this one included; one cause each, renames apart):
  - Base: 08a-2 (`ccr-24f4b29c-s6oe4h`) was never merged to main. Merged into this branch; conflicts in HANDOFF (both
    sides kept) and settings-screen.js (main's gameData import, 08a-2's metresToKm).
  - Dead CSS deleted (.brackets, .brk-l, .wh-steps, .jobs/.job/.jt, .tm-jobs, .job-spr, .job-ic; .today/.mid/.se kept),
    `uiState.disp.steps`, three i18n rows.
  - Text without steps, one commit per group: the tagline ("A classic RPG", page, manifest, title), load tips, four
    folk lines, the not-enough-money toasts ("Win a few battles first"), the place card, walk note, starter egg
    ("hatches after 2 km of walking outdoors"), How to play, the airship sheet, Hazel's parting line (same in both
    openings), room and town chat (and the generators' copies), lore as coins (world entry "Money down here", Route 1,
    Verdigris, Mirrormere, airships, "The Coin Standard", loading lines, a chat line). Renames: lore world id
    steps -> money, book steps -> coin_standard (and the library shelf). Physical steps (stairs, canyon) stay.
  - Studio: **fix**, the Jobs section threw on opening (`rules.jobs.stepsPerPay`, gone since 08a-2; confirmed by
    putting the old line back); Rest stop price moved to the Battle card; "Step sway" -> "Walk bob" (key `sway`
    stays); the "road has no step count" warning removed; Find's example; STUDIO.md.
  - Debug log header, README and the graphics test's note: the log holds no save data, names or positions, only which
    places opened and when (it does log scene mounts and guide trips, so "no movement history" would be wrong).
  - Run: past the joystick's rim (56 px) into an outer ring (84 px, gold while running), the D-pad's centre held by a
    second finger, or Shift. Settings > Moving about > "Always run" (off by default; a full push, the keys and
    tap-to-walk run). Speeds: light push x0.6, full push 3.4 m/s, run x1.7 (`RUN_FACTOR`); keys and D-pad x1 (were
    x1.3). A load tip and the help say how.
  - The walk cycle, footsteps and camera bob follow the metres walked (`walkView.pl.gait`; ladders included, view
    jumps not): same timings as before at walking speed. Townsfolk keep their clock.
  - Tests: a quick-check step "phase 08: running" (each speed, gait against distance, the ring and the D-pad centre
    from pointer events); the phone step keeps its exported log as validation/quick/phone-debug-log.json.
- Risky or unfinished:
  - The full quick check and the first picture baseline were NOT run (owner's call). The known red full-check steps
    from phase 16 (v35, v38, v39 roster counts) are unchanged, as far as anyone knows.
  - The in-game full test was not run whole headless (smoke runs one step of it: green).
  - The Studio's --studio round trip can't run: start-studio.py is not in the repository (STUDIO.md says so).
    tools/check-studio-github.py (every section, GitHub mode) is the Studio check that works: green.
  - The D-pad's run needs two fingers (direction + centre). If that's awkward on your phone, "Always run" covers it.
  - A full push now walks at 3.4 m/s (it gave 4.4 before): moving feels slower until you use the ring.
  - trainers' blockTitle/blockText kept, shown nowhere (phase 15 decides).
  - Your phone and cloud saves start over (save format 3, from 08a-2).
- Verified:
  - Every commit: lint, typecheck, unit tests (65), check:data, check:modules, format:check.
  - Smoke after the merge, after the text batch and on the final commit: 15/15 green.
  - The running step: full push 3.48 m/s; light push 0.59x, ring 1.71x, keys 1.00x, Shift 1.71x, Always run 1.71x;
    gait grows with distance; the ring and D-pad centre set and clear the run.
  - check-studio-github.py: 21 sections open with no errors, the proposal goes through.
  - Debug log, start of session vs final (headless phone flow): same sections, state fields and event kinds, the same
    104 entries in its error list (all phase 16 "is in legacy; X stands in" warnings).
- Questions waiting for the owner:
  - Should 08a-2's branch and this one go to main now (one PR from this branch carries both)?
  - On your phone: try the run ring and "Always run", and send a debug log.
  - Tags `phase-04-done` and `phase-05-done` still need pushing from your machine.
- Next session starts with: "start 08b" (docs/phases/08a-plan.md, Part B), after this branch is merged; the full quick
  check and a picture baseline first, since none exists yet.

### Phase 09 batches 6 and 7 - Marigold, parts 2 and 3: the rest of the town - 2026-10-19
Owner's request: do the remaining props of Marigold, in the clinic and market's style. Keep the old pine trees.
- Changed (tools/build-props-batch6.py and batch7.py; run batch1 to 7 in order; showcase rows on
  `test_props_marigold`):
  - Nature: bush_box (a clipped ball), bush_hawthorn_autumn (the hawthorn model with autumn leaves), dry_grass,
    pebbles and puddle (flat, only the scale). The three pines stay as drawn, by request.
  - Made: clock_tower (brick, quoins, a clock stage with four faces, an open belfry with a bell, a verdigris spire and
    vane; it now has a 2.3 x 2.3 m footprint with its front at its base point, where the game draws its moving hands),
    fountain, solar_canopy, solar_tree, vertical_garden, streetlamp and streetlamp_b (globe lamps under verdigris hoods
    with solar cells), bin (now a three-bin recycling station under a solar roof), flag_pole (the town's flag kept),
    bike_rack (two modelled bikes), sign_shop (a twin of the clinic's sign).
  - Buildings, from one kit of parts (class House in batch 7): the five houses, both townhouses, bakery, shop, inn,
    library and greenhouse. Plinth, walls with corner posts, floor bands, hip / gable / front-gable roofs with a
    wall-coloured gable, square windows with crossed frames, sills, shutters and flower boxes, roof windows under
    hoods, round plank doors and panelled doors under canopies, lamps, chimneys with smoke, copper gutters. Shop,
    bakery, library and inn have their name in the chunky lettering. Each keeps its town colour looks (the old
    variants' wall, roof and trim colours, as colour swaps).
  - Engine (two separate commits): a modelled clock tower keeps its moving hands; a placement's roof style (moss,
    solar, chrome) now also restyles a modelled building's roof parts (layers marked roof: 1).
  - Data (separate commit): a double street lamp in Palmhaven moved 0.2 m off the new shop's window
    (tools/clear-windows.py --fix).
- Risky: these are the most used buildings in the game (house_cottage 46 placements, house_red 27, the townhouses 39,
  shops 12, inns 10); door positions moved a little with the new fronts. Check towns on your phone, at night too
  (window glows and smoke were placed anew).
- Verified: data check, lint, unit tests, smoke check (after the lamp move, the windows step again); a few
  low-resolution looks at the showcase and at Marigold.
- Marigold is now all in the new style except the pines.

### Phase 09 batch 5 - Marigold, part 1: the clinic and the market, redesigned - 2026-10-19
Owner's request: begin Marigold; rework the clinic and the market to be more Unova (Pokémon gen 5) inspired, keeping
the retro-futuristic solarpunk vibe. Original designs: no emblem, sign or shape copied.
- Changed (tools/build-props-batch5.py; run batch1 to 5 in order; its own showcase map `test_props_marigold`, since
  `test_props_next` is full):
  - clinic: the same in every town, so it is known at a glance (its old per-town colour looks are dropped). A rounded
    white two-storey block under a thick coral eave with mint lines; a glass lobby with sliding doors under a solar
    canopy on brass posts with globe lamps; a coral name band reading CLINIC; a ribbon window with flower boxes;
    portholes; a roof garden with a glass dome on brass ribs, solar panels and a little turning wind turbine; the
    emblem (a mint plus on white in a copper ring) standing over the door. Footprint 4.6 x 2.6 m (was 4 x 2.6).
  - sign_clinic: the emblem hanging from a brass post, a globe lamp on top, a planter at its foot.
  - market_hall: a brick arcade with stone quoins and cornice, three arches with iron fanlights and produce counters,
    globe lamps and hanging baskets, a verdigris barrel vault with iron ribs and a solar-glass ridge, a weathervane,
    a clock pediment and a MARKET board. Its four town looks are now colour swaps of the model (variants).
  - stall, market_cart, bread_rack: a striped tent awning with scallops over crates of fruit, a chalkboard and a scale;
    a rounded cream-and-verdigris cart on spoked wheels under a striped parasol with a solar cell; a bread rack.
  - Lettering (CLINIC, MARKET) is drawn in a chunky 7 px capital font made by the script; the globe lamps glow at night.
  - Separate commit: the quick check's in-game full test now waits for the save write-back (up to 12 s) instead of a
    fixed 2.5 s; it failed about one run in three on these branches because the write's timer ran late headless.
- Risky: these props are in many towns and rooms (clinics in 15 towns; stalls and carts in the market rooms). The
  clinic is wider by 0.6 m; check Marigold and Pepperpot on your phone. Interiors are not redesigned.
- Verified: data check, lint, unit tests, smoke check (the full-test step 3 of 3 after the fix); a few low-resolution
  looks at the showcase map.
- Next in Marigold: the houses (one kit of parts for the five types), the other buildings, the made things, nature.

### Phase 09 batch 4 - the last made things of Copperleaf and Route 1 - 2026-10-19
Owner's request: finish the rest of Copperleaf and Route 1.
- Changed (tools/build-props-batch4.py; run batch1, 2, 3, 4 in that order): 18 props modelled and swapped in under
  their own keys, so every placement in every scene draws the new one (they are used well beyond Copperleaf: signposts
  in nearly every scene, fences, planters, benches and barrels in most towns):
  barrel_wood, beehive, bench_wood, birdhouse, dock_post, fence_wood, flowerpot, garden_gnome, picket_fence,
  planter_box, planter_round, rowboat, scarecrow, signpost, waystone, well, wheelbarrow, banner_bunting.
  Only the bunting's pennants are drawn (they flutter); all else is modelled. Fences, benches, planters, signposts,
  the well, the waystone, the boat and the bunting no longer turn or lean at random (vary rot/lean 0).
  - Gable roofs (birdhouse, well) use the hip-roof cone with its top drawn out to a full ridge; no engine change.
  - The showcase map has two new rows (made-small, made-big); the map may be at most 400 tiles deep, so it is full.
- Not changed: the airship and its station were already models; their pictures and effects are at 34 px/m, so they
  keep the scenery's scale. The old voxel recipes in game/art/scene/vox for the nine converted props are no longer
  used; delete them in a separate commit if you agree.
- Risky: fence lengths now have a post at each end and the middle, so two lengths side by side show a double post (as
  the old picture did). The rowboat and dock posts sit on the ground plane; check them on the water in Willowmere,
  Copperleaf and Palmhaven on your phone.
- Verified: data check, lint, type-check, unit tests, smoke check; a few low-resolution looks at the new rows.
- Copperleaf and Route 1 are now all in the new style. Next: the pixel-art and wind plan for 3D props (waiting for
  your go-ahead), or Route 2.

### Phase 09 batch 3 - the buildings of Copperleaf and Route 1 - 2026-10-19
Owner's request: the buildings next, in the art style and setting, learning from the cottage.
- Changed (tools/build-props-batch3.py; run batch1, batch2, batch3 in that order, each rebuilds the showcase map):
  - cottage_moss: a smaller cousin of Juniper's: mossy dome with tufts, thatch edge and copper gutter, a dormer roof
    window, a green round door in a stone surround, a porthole with a flower box, a lamp, a chimney with a copper hat,
    a bench and a water butt round the side, a potted plant, side and back portholes.
  - cottage_solar: pale green board-and-batten walls, a hip roof of solar panels with copper fascia and ridge, a brick
    chimney, a little vertical wind turbine turning on the ridge, a coral round door, a porthole, a window with
    frame, mullions and a flower box, a copper lamp, a vine climbing the corner, a rain barrel under a downpipe.
  - lab (Professor Hazel's): white wall panels with a teal band and trim on a lavender plinth, a checkered roof
    edge, teal double glass doors under a lamp with plants either side, side and back windows; on the roof a cooling
    unit, an antenna with a red beacon, a tipped-up satellite dish, solar panels and planters. The big window keeps
    its drawn view inside (desk, plant, machines) behind a modelled frame.
  - Engine: a cone can be turned (rot) and narrow differently in depth (ry1), so a 4-sided cone is a hip roof with a
    ridge; models can use the building sheet's own materials by name (plaster, siding, brick, battens, panels,
    corrugated, tilewall, rooftiles, shingles, slate, solar). Both in the Studio's model editor.
  - Fix: props with a footprint (box) now have their front at the base point and their body behind it, as the
    building pictures always did, so walls and the footprint people walk round match: Juniper's cottage, the hedge
    and the log were centred and are moved back.
- Verified: data check, lint, type-check, unit tests, smoke check; one low-resolution look at each building.

### Phase 09 batch 2, parts 1 and 2 - Copperleaf and Route 1: flat plants, 14 trees - 2026-10-19
Owner's request: start on the rest of Copperleaf and Route 1 (Hedgerow Lane), the first 10%, then another 10%.
- Changed (tools/build-props-batch2.py, swapped in under their own keys like batch 1):
  - the 54 flat plants of the two places stay flat and move to 32 px/m;
  - trees with the tree tool: rowan, blossom, elm, chestnut, maple, fruit, birch, birch_gold, poplar; the hazel and
    birch_b as shrubs of several stems (a new stems mode: each limb a stem from the ground, no trunk or roots);
    autumn hazel, autumn poplar and autumn beech as their summer tree with the leaves recoloured.
  - Their rows are on the showcase map test_props_next.
- Part 3 (owner: do the rest of the nature now): willow; larch (a new 0-clump mode: the tiered crown stays whole
  on a modelled trunk); the 7 bushes (berry, holly, juniper, bramble, rosemary, hawthorn, rhododendron) as clumps;
  modelled from shapes: the hedge, the fallen tree, the log, the stump, the lichen boulder, the flat rock and the
  stepping stones (still flat and walkable; a flat prop with a model no longer also draws its picture on the ground).
  All the nature in Copperleaf and Hedgerow Lane is now in the new style.
- Left in the two places: 23 man-made props (fences, benches, planters, flowerpots, wheelbarrow, barrel, dock post,
  beehive, signpost, scarecrow, well, birdhouse, gnome, bunting, rowboat, waystone), two cottages and the lab.
- Verified: data check, lint, type-check, unit tests, the smoke check; low-resolution shots of the new rows.

### Phase 09 batch 1 swapped in - 2026-10-19
Owner's go-ahead: replace the finished props in the game.
- Changed: the 24 old props the batch covers now are the new ones, under their own keys (tools/build-props-batch1.py
  swap_in), so all 4,801 placements in 62 scenes draw them without any placement changing: tree_beech; tree_oak,
  tree_oak_b, tree_oak_small, tree_oak_autumn; tree_giant_swing; bush_roses; bush_round, _b, _c; rocks, _b, _c,
  _mossy, _snow; mushroom, _brown, _blue; cottage_juniper; lantern; laundry_line; tallgrass, _b, _c. Each keeps its
  old name, group, tags, the scene builders' fields and its collision radius; its picture stays as the fallback (3D
  models off, far view). The next_* entries are gone; test_props_next is now a showcase of the swapped props.
- Risky: these props now draw at 32 px/m, about 6% bigger than before (tall grass included), until the rest of the
  catalogue moves to 32. Trees cost 10 to 18 sprites each and are now on every route that has them; not measured on a
  phone. The old depth layers of the oaks and round bushes (scene/props/layers/*_lb/_lf.png) are no longer used.
- Verified: data check, lint, type-check, modules, 59 unit tests, check-quick.py --smoke (no problems).

### Phase 09 batch 1, part 2 - natural trunks, editable leaves, the great oak, a Props section - 2026-10-19
Owner's requests: stop the rest of the batch; rework the trees' trunks to look natural; leaves easy to edit in the
Studio; redo the great oak with the swing (Copperleaf); a clear prop part in the Studio with all its tools; no graphic
effects when looking at props.
- Trunks: a `limb` can be a bent line of points (`pts`: [x, y, z, radius] each). The tool traces each trunk and arm
  from the drawing (its lean, curve and taper), bends it a little in depth, flares the foot, adds five roots going into
  the ground, lets the arms grow out of the trunk's narrowing top, and curves the branches up into the clumps.
- Leaves: one picture per tree or bush (game/art/scene/next/leaves/<key>.png, the crown as drawn). Each clump is a
  picture layer with `clip` [x, y, r] (a circle in that picture, cut at run time, outline on its lower rim), the core
  is the same picture with `shade` 0.78. Painting it changes every clump. The autumn oak is one recoloured picture.
- Great oak: next_tree_giant_swing (16 clumps, the knot hole as a picture on the trunk, the swing's branch modelled,
  ropes and seat that swing together: a `spin` may have `swing`, radians to and fro). On the test map's last row.
- Plain look: a scene with `plain: 1` draws without depth of field, bloom, grade, grain, vignette, haze, mist, clouds,
  shafts, weather, time of day or season (engine/settings.js PLAIN_LOOK). The props test map and the Studio's prop
  turntable use it.
- Studio: a Props section (World & places → Props, studio/js/props-editor.js): every prop, searchable, filtered by
  New style / Trees / Bushes & plants / Rocks / Buildings / Lamps & furniture / Flat, with 3D, 32 px/m and looks badges
  and how often each is placed; for the picked prop: its looks (variants) on the turntable one by one, paint a look's
  picture, add a look from another prop, remove one; where it stands (jump to the scene); the full prop editor; the
  model editor with a Leaves part (each leaf picture with its clump circles drawn on it, Paint the leaves, Replace from
  PNG) and per-layer clump circle, darker, shadow, sway and glow fields; the pixel editor.
- Variants: a variant's swapped pictures load with the place (the autumn oak showed late).
- Verified: lint, type-check, modules, format, data check, 32 unit tests; headless shots of the trees and great oak;
  the Studio (GitHub stand-in): the Props list and filter, the Leaves part lists both oak pictures, painting a leaf
  picture marks it changed and bumps its version. Not done: a screenshot of the Props section with the turntable
  running (the software renderer is too slow for it), the smoke check after this part.
- Cottage redone in the airship's manner (owner's request): fully modelled, few polygons, the sheet's materials and
  the airship's palette. Stone footing, plaster walls with honey-wood corner posts and wall plate, a thatch skirt under
  a 16-sided mossy dome, a round plank door (planks stepped to the circle, iron hinges, brass knob), copper-ringed
  portholes with brass crosses (front, both sides, back, two on the roof), a square window with frame, mullions and a
  flower box, a stone chimney with a verdigris hat, a copper stove pipe, a brass weathervane, a door lamp that lights
  with the lamps. Only the shop sign stays a drawing. Its window, lamp and smoke effects are placed for the new model,
  and it no longer carries the old picture's building plan. Checked with one low-resolution shot.
- Cottage, second pass (owner: more polygons, less chunky, more like the fifth-generation Pokémon games, more detail):
  smooth 32-sided dome with moss tufts and flowers, a copper gutter and turned-out thatch lip, thatched dormer hoods
  round the roof windows, slim posts and frames, half-timbered side walls, a stone surround and canopy on brackets
  round the door, eight planks with iron straps, a knocker, verdigris shutters, a stone sill with honey jars, a
  flower bed and stepping stones, a rain barrel under a copper downpipe, a woodpile and Granny Juniper's straw skep.
  About 200 parts. One low-resolution check shot; not measured on a phone.
- Variants count: the 11 new props have 22 looks in all: beech 1, oak 4 (oak, spreading, sapling, autumn), great oak
  1, wild roses 1, round bush 3, rocks 5 (3 shapes, mossy, snowy), mushrooms 3, cottage 1, lantern 1, washing line 1,
  tall grass 3.

### Phase 09 batch 1 - ten props in the new style, test map - 2026-10-18
Owner's choices: trees as a low-poly trunk and branches with flat leaf clumps, in one model; a first batch of ten props
covering every technique, shown on a test map. Started straight from the owner's go-ahead in chat (no Plan Mode step).
- Changed: prop-models.js: a `limb` shape (tapered branch, point to point) and a `dome`; round shapes take `sides`,
  `rings`, `lump`, `facet`; textures `bark` and `rock` (cells 22 and 23 of detail-a04b.png, painted by the tool);
  picture layers take `shadow`, `recv: 0` (no shadow-map lookup, so a crown's clumps don't stripe each other), `sway`
  and `glow` (on with the lamps), the recipe takes `ppm`; picture layers no longer inherit the footprint `box` (it drew
  a cottage's door pushed back inside its walls); a variant can `swap` colours and pictures. walk-view.js: plain prop
  `variants` picked by a placement's `v`. walk-view-gl.js: a prop's own `ppm`; `lampLit` exported; the sprite shader
  skips the shadow map for `noRecv` items. Studio model editor: Limb and Dome, their fields, sides/bands/lumpy/flat
  faces, and a picture layer's shadow/shadows-on-it/sway/glow.
- New: tools/build-props-batch1.py builds everything below from the old pictures, rerunnable: game/art/scene/next
  (leaves, decals, models), the `next_*` catalogue entries in scenery.json and game/data/maps/test_props_next.json.
  Props: next_beech; next_oak (variants: spreading, sapling, autumn = the oak with recoloured leaves); next_bush_roses;
  next_bush_round (3 shapes); next_rocks (3 shapes, mossy, snowy = mossy with a colour swap); next_mushroom (red,
  brown, blue by swap); next_cottage_juniper; next_lantern; next_laundry_line; next_tallgrass (stays flat, 32 px/m,
  3 shapes). The test map has each old prop just left of its new version; debug menu > Test scenes, or
  game/index.html?test=1&scene=test_props_next.
- Risky or unfinished: no route uses the new props yet (swap-in waits for approval). Cottage pictures stand 0.16 m out
  from the wall (a picture's depth is coarser than a model's; nearer, it hides), visible from a steep side angle.
  tools/build-airship.py rewrites detail-a04b.png from detail-a04.png and would drop bark and rock: rerun
  build-props-batch1.py after it. The new cottage keeps the old `door` (interior) and window fx. Trees cost about 10
  sprites each (core + clumps); instancing is still to do. Not measured on a phone.
- Verified: lint, type-check, module check, format check, data check, 32 unit tests, the smoke check (see the PR);
  headless shots of every row by day, the trees turned, the lanterns and cottage at night.
- Correction to my earlier count: 76 recipe files exist in scene/vox, but only 32 props link one (`model`); the
  lantern, stump, beehive, signpost and others on the first routes still draw their picture.
- Questions waiting for the owner: approve the batch (or which props to redo)? Then swap them in on Copperleaf,
  Hedgerow Lane and Tallgrass Meadow, keyed as the old props (so placements keep working) or as next_* with
  placements rewritten?
- Next session starts with: the owner's notes on the batch.
### Phase 13 (part) - The fast check and the in-game graphics test - 2026-10-18
Two parts, plans approved by the owner. Part 1 on branch ccr-5f324dee-5mgqdn (merged as PR #16), Part 2 on top of it.
- Changed:
  - Part 1: `tools/check-fast.py` (`npm run check:fast`), the fast check, only what must never break: the data, the
    world-map graph, a town, a route, a cave and a room open and draw, a save round-trips, a battle plays to the end,
    the game boots with no errors, the Studio loads, and the exported debug log holds no names. `game/js/fixture.js`:
    `?fixture=<name>` (title, town, route, cave, room, battle, stored) starts a ready-made game with its own save key,
    never signed in, with the planted names in FIXTURE_NAMES (trainer "Quillonda", nickname "Zorblax"). The CI push
    job runs check-fast.py instead of the smoke set.
  - Part 2: `game/js/graphics-test.js`, the in-game graphics test. A button in Settings → Help ("Run the graphics
    test", `data-a="gfxtest"`) and one in the debug menu's Performance row. settings-screen.js (`startGraphicsTest`)
    loads it on demand (`import()` of `js/graphics-test.js` against the page's address, so the build leaves it as its
    own file in dist/game/js/) and hands it what it reads, so the module has no imports. Steps, all in Marigold Town:
    the shaders (the same check as check-quick.py's Shaders step, which is unchanged), the game defaults to compare
    with, each of the 144 ENGINE_SPEC dials on its own (through the player's expert dials, which come before a scene's
    look; a number at the top of its range or the bottom if that is its default, on/off flipped, a choice at another
    option, a colour at #FF4080, the light dials at night), Balanced and Beautiful, and the five ENGINE_PRESETS. Each
    step opens the scene from scratch and counts frames for 2 s: frame rate, longest frame, time to open, errors. An
    OK/Problem table and "Save the report" (a .json file: steps, numbers, errors, the graphics chip, screen and cores;
    not the browser, language or time zone). The last row is the planted-name check: the planted names, the trainer's
    name and every nickname in the save; any found is taken out and the row is a Problem.
  - Saving paused and the save put back as in self-test.js; the save copy also brings back the player's graphics
    settings (aim, expert dials), and the scene is made again with them, when the test ends, is stopped or fails.
    selfTest.on is set while it runs, so the story, postcards and the full test stay out of the way.
  - `tools/test/graphics-test.test.mjs` (6 tests): every dial gets a step at a value other than its default, the
    names list, a clean report passes, a planted name is taken out and fails the check, the report's fields.
  - eslint.config.js: a block for graphics-test.js (it is on no page). to-module put ENGINE_*, FIXTURE_NAMES, the
    shader sets, gpuState, compileProgram and attributeClashes through hooks.js for settings-screen.js.
  - Docs: TESTING.md (the graphics test and its rules), CHANGELOG.
- Risky or unfinished:
  - **The graphics test has never run.** As the owner asked, Claude ran it in no browser at all, not even software
    rendering. It must be run on a real device; the first run is the owner's. The likeliest trouble: a scene that
    takes long to open from scratch on a phone (the step limit is 30 s), and the whole run's length (153 steps, about
    3-4 s each: probably 8-10 minutes, not measured).
  - The spec's "Saver" preset doesn't exist: the Graphics tab has Balanced and Beautiful only (Battery saver was
    removed in phase 03). Both are tested; Beautiful is the same look as the game defaults row.
  - Dials a scene doesn't use (water with no water in view, lamp shadows by day) show OK without showing much.
  - The steps read the frame count of the walk view only; the battle stage and the world map aren't in it.
- Verified (what ran, what passed): `npm run lint`, `npm run typecheck`, `npm test` (31 tests), `npm run
  check:modules`, `npm run format:check`, `npm run check:data`, `npm run build` (graphics-test.js in dist/game/js,
  the bundle keeps the import as written), and `python3 tools/check-fast.py`: 11 of 11 passed in 112 s on 2 browsers
  in this container. A planted fault (the name check turned off) fails its unit test; a planted undefined name in
  graphics-test.js fails lint. Part 1, from its session: check-fast takes about 85 s on 2 browsers (1 browser 94.5 s,
  4 browsers 110.8 s), and all 11 planted faults were caught.
- Decisions I made (and why): the dials go through the player's expert dials, because a scene's own look comes
  before the game-wide defaults and would hide some dials. Each dial moves away from its default, so every step
  changes something. Each step opens the scene from scratch, so dials read while a scene is made count. Device
  details are cut to the graphics chip and the screen, because the user agent, language and time zone say more
  about the player than a graphics report needs.
- Questions waiting for the owner: the first run on a phone, and the report it saves.
- Next session starts with: the report from that run; then the rest of phase 13 (13b, 13c).
### Phase 08a-2 - the step mechanics replaced - 2026-10-18
Plan approved at the start (docs/phases/08a-plan.md, section 08a-2, now marked done with the corrections found).
- Changed (21 commits on a331fbb, one cause each; renames apart):
  - Test fix first: merge d991d0b had put `addSteps(2400)` back into check-quick's play() and `prog/hold` into the
    3D-battle trip literal (HANDOFF 08a-1 said both were gone). Restored.
  - Encounters live on each place's map (`saveData.wild` by location id; `rules.encounters`): route 4, town with
    tall grass 2, other towns and rooms 0; full on the first visit, then one more per minute of play time (time a
    place stands full doesn't count). Starter's 3 gentle ones in the start map; legends join the map they appear on.
    Walk card: "Encounters here N/stock". Debug: fill / clear here. `queue`, `meter` gone.
  - Challenges: "Visit 2/3/4 different places today" in the steps challenge's slot (daily picks unchanged). The
    letter goes to the 1st/2nd/3rd nearest town by roads and back (Pearlantis, no roads, asks something else).
    Both run on `arrivedAt(node)` (walkCross, airship, glass lift).
  - Money: a wild win pays level x $20 (`rules.encounters.prizePerLevel`, a toast). Step money, brackets, `day`,
    `seFrac`, rollDay gone; with them the step chips, the Today card's steps and brackets (it shows the money) and
    the trainer card's "Steps today" tile. Debug "Start a new day" gone.
  - Buddy: no walking XP; the buddy gets the full XP of a win even when it sat out (if not fainted).
  - Split at 32: the evolution window offers "Build: <name>" / "Hype: <name>" / "Not yet"; `evolve(m, path)`;
    splitPath, bsteps, psteps gone. Buddy-km evolution kind deleted (no species used it).
  - Jobs removed (Team screen panel, hiring, pay, `saveData.jobs`, `m.job` and every "not at work" check,
    `rules.jobs`, the debug button, the Studio rules card). jobs.json and the Studio's Jobs editor stay for phase 12.
  - Eggs hatch by metres walked outdoors (`addWalked`, `saveData.stats.walked`; not rooms, benches or view jumps):
    2 / 4 / 8 km (eggs.json need in metres); saves every 20 m and opens the hatch window when one is ready. Eggs are
    named from `need` ("4 km egg", was "5 km"). Play time saves itself every minute. Debug: "Walk 1 km".
  - addSteps, the step accumulator, totalSteps and the step debug buttons deleted. Restore / account-merge /
    Settings lines say km walked; the trainer card lost "Total steps" ("Distance walked" is real km now).
  - Data: goldOdds and alphaOdds moved to `rules.encounters`, restCost to `rules.battle` (rename commits);
    `rules.steps` deleted; locations' `cost` deleted (and its writer in build-regions-v47.py). Roads are measured
    at load from the two exits' `len` (game-data.js roadMetres): 56 roads, 82-153 m, 6,560 m in all; roads.json's
    third value is no longer read. The guide routes by metres; road chips, Places list and card say "90 m"/"1.2 km";
    the Studio road table shows the measured length (read-only). `tripTo().steps` renamed `metres`.
  - Save format 3. The migrate lines for step-era fields went with it (a format 2 save is never migrated now).
- Risky or unfinished:
  - **The UI phase (06) is being built at the same time, on its own branch.** This session changed screen code it
    will also touch: ui.js (about 240 lines: walk card and Today card, Encounters section, buddy card, evolution
    window, team screen without the Day jobs panel, trainer card tiles, map card), things-to-do.js (challenges,
    letter), battle.js (prize toast, switch list), bag.js (egg rows), settings-screen.js, world-map-gl.js (Places
    list, road chips), debug-menu.js. Whichever branch merges second must merge, not overwrite: keep 06's structure
    and carry 08a-2's content into it (no steps, "Encounters here N/stock", the Build/Hype buttons, no jobs, km
    walked, "N m" road lengths). 08a-3 (step widgets, CSS, text) touches the same screens, so start it on top of
    06 if 06 lands first, or agree the order with the owner.
  - Your phone and cloud saves start over. A save is kept aside only if no set-aside copy exists yet: a phone that
    kept one at the phase 05 bump does not keep this one (old saves don't matter, CLAUDE.md).
  - The walk card's encounter count updates when the screen redraws; the play-time tick (every 15 s) redraws it
    when the count here changed. The tufts in the scene update every frame.
  - The prize is a toast after the battle, not a line in a sheet (a sheet on every wild win felt heavy). Say if you
    want it in the sheet.
  - Encounters are refilled when read (lazy): a place you never look at doesn't grow. A town's stock reads the
    map's tiles (`_lite.tiles` before its file loads).
  - Left for 08a-3: step text (load tips boot.js:163/169, airship.js:75, NPC lines, "Walk a bit first" toasts,
    Settings "How to play", the welcome's "every step you walk helps it hatch", lore), dead CSS (.wh-steps,
    .brackets, .jobs/.job), the Studio's "Rest stop price" field (it sits in the Encounters card).
  - Known red full-check steps from phase 16 (v35, v38, v39 roster counts; --studio checko0) are unchanged.
- Verified:
  - Every commit: lint, typecheck, unit tests (now 38, new: per-map stock and refill, wild prize, buddy XP, split
    by choice, eggs by metres, every road's length against its exits), check:data, check:modules, format:check.
  - Smoke after each group (1-4, 5-7, 8, 9-10, 11): no problems. The base smoke run overlapped my first edits, so
    only its phone step counts (green).
  - Headless probes: Tallgrass Meadow 4/4, Fizzwell 0 with its note, +1 after a minute of play; a level 12 win pays
    $240; the visit challenge goes 1/2 -> 2/2 on arriving; a letter Marigold -> Copperleaf turns into a reply on
    arrival with its toast; walking 4.32 m outdoors adds 4.32 m, 2.83 m inside a house adds 0; at 2 km the hatch
    window opens ("A 2 km egg is hatching"); the world map says "90 m", Copperleaf -> Marigold "200 m".
  - Full-check steps v36 and v37 (split window, both paths): ok. The other steps this session touched, run together on the final code (693 s): Walking (218 m over two roads), Things to do ("Visit 3 different places today" among the challenges, a ladder, rain in battle), v33 (4 wild Billies in the grass, double and Alpha battles), v43, the terraces, the joystick and edge crossing, Battles (3D stage, a trainer battle won): all ok. v38 and v39/v40 fail as before (they count the old roster, phase 16).
- Questions waiting for the owner:
  - The tags `phase-05-done` and `phase-04-done` still need pushing from your machine (08a-1).
  - On your phone: a new game (format 3), walk a route (encounters fill, a win pays), the debug "Walk 1 km" twice
    for the starter egg, and a debug log.
- Merged in afterwards (owner's request): phase-06-3 (with 06-1, 06-2, 06-2b and phase 17 robots) and
  docs/phase-06-plan. 21 conflicts in 7 files: 06's structure kept, 08a-2's mechanics carried into it (unit cards
  without Day jobs, speciesOf in the split evolution, no job checks, check-quick on per-map encounters). Fast checks
  and smoke green after the merge; headless: walk card "Encounters here 4/4", team screen without Day jobs, the
  evolution window's Build/Hype buttons. Not merged: graphics-bench and props-batch-1 (separate work, still moving).
- Next session starts with: "start 08a-3" (docs/phases/08a-plan.md, section 08a-3), on top of this branch, which
  now holds phase 06 up to 06-3.
### Phase 17 - Robots, prototype (in progress, not tagged) - 2026-10-18
Plan agreed in chat (docs/phases/17-robots.md, rewritten first: robots battle in the same system as Billies, mixed
teams, body HP + breakable parts, moves from parts, torso + legs types, some moves aim, gem levels + part upgrades,
parts healed like HP). Branch `phase-17-robots` (from `phase-17-plan`).
- Changed:
  - Refactor first, no behaviour change: every species read for a team member goes through `speciesOf(m)`
    (`logic/fighters.js`); tests identical.
  - Robots as team members (`kind: 'robot'`, `gem`, `fit`, `partDmg`; `sp` made from the gem and parts, e.g.
    `bot:volt.vane.tesla.auger.striders`, so art and screens can draw one from its sp). Species data worked out from
    the parts (`robotSpeciesFor`), arithmetic in `logic/robot-math.js` (shared with the Studio, like parts.js).
  - Battle: hits land on a part (rules.json robots.hitWeights; aimed moves pick), limbs break, broken arm = no move,
    broken legs = half Speed, gem-type moves x1.2, Self-Repair, Repair Kit, AI aims at the weakest limb and skips
    broken moves. Robots aren't added to the Guide's seen/caught.
  - Screens: `robot-art.js` (rig from part pictures, stand-ins without), stage dims broken parts and sparks on a
    break, HUD limb bars, part picker, Workshop panel + refit sheet (`workshop.js`), robot parts in the details sheet.
  - Studio: Robots section (`studio/js/robots-editor.js`), robot fields in Moves, Items, Trainers; the battle
    preview draws robots (`robotRigParts`).
  - Data: robots.json + schema, rules.json robots, 12 moves, Repair Kit, trainer `tinker`, art in game/art/robots/.
- Risky or unfinished: no in-world way to get robots yet (debug menu only); 3D assembly preview, paint, loadouts,
  crafting, sourcing from chests/trainers, wild robots, the socket standard for the low-poly art: not built. Robots
  as your walking buddy don't show in the world (world-billies.js only knows Billies). Hazel's battle tips say
  "Billies" for robots. The sim bounds are not agreed.
- Verified: lint, typecheck, `npm test` (44 pass: 11 robot tests, 1 sim test), check:data, modules --check, smoke
  (`check-quick.py --smoke`, all 15 steps). A headless phone run: kit, workshop refit, Tinker Rho's mixed battle with
  an aimed move breaking an arm, no console errors. The Studio's Robots and Trainers sections in a headless browser.
  Full sim: robots 48% against Billies of the same level after raising the stat floor 15 -> 38.
- Decisions I made (and why): 6 generic arms (the socket standard says any arm fits any torso, so left and right
  arms needn't differ); torso hits (25%) so parts don't break every other hit; new robots at your strongest member's
  level; free upgrades until the workshop has a place.
- Questions waiting for the owner: the "Ask me before" list in docs/phases/17-robots.md, plus how the first robot
  is found, and the balance bounds.
- Next session starts with: the owner plays the prototype (debug menu -> Give the robot kit, battle Tinker Rho)
  and answers the open questions; then sourcing, the workshop's place, and the art pipeline.

### Phase 08a-1 - tests off the steps mode, the dead steps travel mode deleted - 2026-10-18
Plan approved at the start (docs/phases/08a-plan.md, section 08a-1, now marked done with the corrections found).
- Changed (15 commits on c3b5de9):
  - Smoke was red on the base since phase 16: check-quick named species now in legacy (`ek1` in play(), `knight1`
    in three wild battles). Fixed first, two commits (Versewift, a Bezos line one).
  - Bug fixed: phantom metres. A fresh view put you at its spawn point after movePlayer had saved your old position,
    so every start, Continue, airship landing and debug jump counted 650-940 steps as walked (measured headless).
    That jump is not counted now; a real walk still is (14.1 a metre, until 08a-2).
  - Tests walk instead of paying steps: `cross()` / `cross_to()` in check-quick (a path to just past the exit, the
    player put along it 0.8 m at a time, walkCross after each, unready frames counted). Walking (two roads to
    Willowmere, 218 m), v43 (Marigold -> Tallgrass Meadow, 78 m, never unready), Copperleaf -> Marigold (141 m),
    a041 use it. The in-game full test's Road phase walks the same way in JS and now also fails when the meadow's
    view never shows. play() no longer switches to the steps mode or pays 2,400 steps: it gives the money, four
    encounters, egg progress and buddy XP directly. The whole quick check now runs in walk mode.
  - tools/check-game.py deleted (stale, not in CI). The duplicate a02_ground() call removed.
  - Deleted (deletion only): rules.travel and the Studio select, walkMode/traveling, gateMsg, canLeave, resumeTrip,
    the trip part of addSteps, uiState.arrive and the arrival hurry, the 'road'/'path' walk modes and their hurry
    and teleports, seamlessTripView/seamlessJoinTrip/seamlessPrefetch(+View), the go/hold/blocked trip status and
    bars, the walker icon, the stay/resume/turn-back actions, exitPrompt's steps modal, tripLeft, stepsTo,
    onStepsAdded, the steps-only "prepare the next stop" timer, trip.prog and trip.hold everywhere (save, check,
    type, literals in game, fixture, debug menu, tests), the debug log's tripProgress, four i18n rows, the CSS.
    Kept: trip.node and trip.plan (the gold arrows, "Stop guiding me").
- Visible changes: the place card says "In X" (not "Staying in X"); the walk sheet always shows the "Walk with the
  joystick" note; the trip card's text is unchanged ("Steps still earn money...": 08a-3 rewrites the text).
- Risky or unfinished:
  - No save format change: migrate drops trip.prog/hold from an older save (a unit test checks it). SAVE_VERSION 3
    comes once, in 08a-2.
  - The full quick check has known red steps that are NOT from this phase: v35, v38, v39 (they count the old roster,
    phase 16 moved it to legacy); the Studio round trip (--studio, not run) names checko0, also legacy. They need
    the phase 16 rework.
  - The Walking step now walks 218 m over two roads: 107-116 s alone, 220 s inside the full run (a note against its
    150 s budget, not a failure).
  - Intermittent, seen once each, both passed on re-run: "Things to do: standing on a gold stamp didn't pick it up"
    (full run), and the in-game test step's "written while the test ran: account ['users']" (a friends presence
    write racing the test; smoke). Worth a look if they come back.
  - trainers' blockTitle/blockText are shown nowhere now (they were only shown by the steps mode's blocked card;
    walking shows "X is blocking the way. Beat them first."). Data kept; 08a-3 or phase 15 decides.
  - The roads' step costs (tripTo, the map card's "N steps to go") stay until 08a-2 step 10 (metres).
- Verified:
  - Every commit: lint, typecheck, unit tests (npm test, 32 + one new assertion), check:data, check:modules,
    format:check. check-fast 11/11 and smoke green after each batch (smoke on the base: 2 red, see above).
  - Targeted full-check steps on the final deletion: Walking, Things to do, v43, Copperleaf, airships, a041: all ok.
  - The in-game Road phase headless: Marigold -> Tallgrass Meadow, 1 view change, prepared ahead, never unready.
  - The full quick check ran once on c3bff8f (tests in walk mode, before the deletions): only the problems listed
    above. Not re-run on the final commit (the plan keeps the full run for the end of 08a-3).
  - A debug log built headless at the base and now: same sections and event kinds, same errors (all phase 16
    stand-in warnings); only state.tripProgress is gone.
- Questions waiting for the owner:
  - Tags: `phase-05-done` (0c62318) and `phase-04-done` (12a3b58) recreated locally; my push was refused again
    (the remote hangs up on tag pushes). Please push them from your machine.
  - On your phone: the in-game full test (its Road phase now walks) and a debug log from this build.
- Next session starts with: "start 08a-2" (docs/phases/08a-plan.md, section 08a-2: encounters first).
### Graphics test and the Graphics bench - 2026-10-19
Not a phase; plan approved in chat (5 steps per setting, Expert dials plus five hidden ones, a new place apart from the
Graphics gallery, the frame cap kept and costs read in ms). Spec: docs/graphics-bench.md.
- Changed (7 commits):
  - New place test_graphics (tools/build-test-scenes.py t_graphics): nine stations with a spot each in `bench`.
    build-test-scenes.py has --only=<ids>, which writes just those scenes (the full rebuild is still out of date).
  - New game/js/graphics-test.js: runGraphicsTest, 125 steps (105 setting steps, two untouched looks per station for
    drift, everything lowest and highest). Holds automatic quality off, resolution ×1, time and weather forced, the
    camera on the spot; measures fps, processor ms (debug log) and graphics-chip ms (the diagnostics' pass timers).
    Saves nothing and restores the save (as the full test). Report: pocket-billies-graphics-….json, format 1.
  - self-test.js: report saving moved into shareReportFile (no change in behaviour), used by both reports.
  - Buttons: Settings → Help "Run the graphics test (10 min)", debug menu "Graphics test".
  - tools/check-quick.py graphics_test_ready (in the smoke's in-game test step): never runs or draws the test; builds the
    step list, checks every setting key and station spot from the data, saves a report from made-up numbers and checks
    it holds no name.
- Risky:
  - Not run on any real device yet, and never rendered here (the owner's rule: no headless drawing with graphics on).
    The station spots, camera turns and zooms are untested by eye. The sun gap's "sun ahead" assumes angle -90 points
    the sun along +z, toward where the camera looks; if the rays don't show there, change that station's `sun`.
  - Shadow detail and the near shadow map change without a rebuild; if a change only shows after a rebuild, its curve
    reads flat.
  - Phones without EXT_disjoint_timer_query_webgl2 get processor ms only; the table then says to read the fps.
- Verified: lint, typecheck, check:modules, 32 unit tests, format, check:data, build; smoke 15 of 15 (302 s).
- Next:
  - The owner runs the graphics test on the phone and the PC and sends both reports. Check the stations look right
    (each one's effect is in view) and which settings cost most.
  - If a station is wrong, adjust its spot (`bench` in t_graphics) and rebuild with --only=test_graphics.

### Debug session - the two diagnostics logs of 18 Oct (PC 19:43, phone 19:47) - 2026-10-18
Not a phase; plan approved at the start. Both runs passed with no errors; the phone (Adreno 750) ran Clovercrest at 24 fps.
- Changed (6 commits, each passes lint, typecheck, check:modules, unit tests and format on its own):
  - tools/check-quick.py names current Billies (swift0/swift1) where it named legacy ek1/knight1/kroc0. Smoke had been
    failing since phase 16 ("reading 'line'").
  - Diagnostics format 2 (self-test.js, debug-log.js):
    - A place's fps, worst fps and slow frames count whole seconds from 0.5 s after it opened.
    - The opening hitch is apart: openHitchMs, openHitchCause.
    - The other steps drop their first and last second. The old battle "worst 5 fps" was a partial second.
    - battle and memory also export worstFps and worstFrameMs. Samples carry dt.
  - walk-view-gl.js: stillPropState and propLook rechecked every prop in the same frame every 500 ms. Each prop now
    rechecks on its own half-second beat (propCheckedAt).
    - Measured headless on Clovercrest: 452 props in one frame (+8 ms on this CPU, 3.7 -> 12 ms) became about 15 a frame.
  - propGrid no longer rebuilds every 2 s. It rebuilds on a prop signature change (now every prop) or on itemGen.
    - itemGen now also goes up when the ground's height key changes, so Studio height edits still refresh the props.
  - self-test.js: pauseSaving() before loadAllMaps(), not after. The friends timer could write 'users' while the maps
    loaded (seen once in 4 smoke runs).
  - debug-log.js: new marks "setting up the ground", "building the ground mesh", "working out where you can walk" and
    "reading the picture back"; module glue regenerated.
    - A headless CPU profile put the per-place opening hitch ("outside the marked steps") in swapMapCache ->
      buildGroundMesh, about 0.8-1.2 s in software.
- Risky:
  - propGrid now trusts its signature. A Studio edit that moves terrain under props without changing the height key
    (a bridge edit, say) keeps old cell heights. The cull has 8 m of slack.
  - The 500 ms freshness is unchanged, only spread.
  - Auto quality was not touched. The phone sat at level 4 and 80% resolution because of these spikes; it should settle
    lower on its own, which needs a phone log to confirm.
- Verified: lint, typecheck, check:modules, 32 unit tests and format at every commit; smoke after each code change (the
  full-test step 4 times after the save fix); headless counts and timings of gatherFrameItems before and after; a CPU
  profile of a place opening.
  - The full quick check: 46 of 49 steps passed. The 3 failures are the old roster-count steps (v35, v38, v39/v40 want
    117 species and the data has 24 after phase 16). They come from phase 16, not from this session, and need
    replacing.
  - There is no validation/quick-baseline, so no screenshots were compared.
- Not verified: real-device frame rates (headless draws in software at 1-3 fps).
- Next:
  - The owner re-runs Diagnostics on the phone and the PC and sends both logs. Look at openHitchCause, Clovercrest fps
    and the auto level.
  - If the ground build is the hitch, spread buildGroundMesh over frames (it already has a steps version,
    buildGroundMeshSteps) or prepare it before the door opens (prepareMapGround).
  - If the phone is still slow, the next renderer work is: reuse per-frame item objects, instance static sprites,
    group solid props by mesh. That is a phase of its own.

### Phase 06, session 06-3 - Robots merged, battles on the 3D stage only, UI in the scene - 2026-10-19
Owner's asks: merge what's on GitHub for the bots; remove the painted battle stage (3D in rooms too, wait for the
scene, the classic HUD too); the battle UI lives in the 3D scene and ignores its lighting so it stays readable.
Owner's choices: the portrait inside the dialogue box; moves on the first battle menu; robot builds as slot rows with
a carry meter; battle cards floating in the scene, a calm camera while choosing, readable and thumb-reachable first.
- Merged: `main` (phase 16 rework, 08a-1, PRs #19, #20, #22, #23) and `phase-17-robots` (robot data, engine,
  fighters, workshop, Studio Robots section, sims; it had no PR). Conflicts kept 06-2's screens (no step-by-step
  intro, the shared unit card) and gave robots a place in them: `billyUnit` reads `speciesOf`, knows a robot's weight;
  the Build tab shows a robot's build; the Workshop section stays on the Team screen.
- Changed:
  - **Painted stage removed.** Every battle is on the 3D stage, rooms included. A battle that starts before the scene
    is ready waits behind its wipe and joins it (`battleStageJoin3d`); `walkMapSync` keeps or opens the walk scene for
    a battle, even from the Map tab. Gone: the painted drawing (floor, blur, painted props, clouds, light shafts,
    sprites), its backgrounds (grounds, foregrounds, walls, far land: `game/art/battle/*_ground` etc.), the manifest's
    `battle.areas` and `tools/build-battle-props.py`; the Settings rows "Battles happen" and "Battle panels" and their
    preferences (deleted from old saves); the corner-card HUD (plates always); the in-game test's painted battle.
    Kept: the battle props and clouds (the walking world uses them). A battle stage is now a name, indoors or not and
    its ambient particles (`battleStages.json`, the Studio card and preview to match).
  - **Battle UI in the scene** (`floatTick` in battle.js, `css/battle-ui.css`): on the 3D stage the text and the
    menu are cards anchored in the world, a column under the one choosing (its feet, the text, the menu), following
    the camera, which holds still while you choose (`battleStage.calm`). Page elements, so the scene's lighting never
    touches them. The action is framed in a fixed share of the screen above them.
  - **Moves on the first menu**: four type-coloured tiles, then Tax it, Bag, Team, Run; 1-4 pick a move; Back goes
    to the first menu. The checks and the in-game test no longer expect a Fight button.
  - **Dialogue box** (`css/dialogue.css`): the portrait in a 96×96 slot inside the box, a gold name tag, the line in
    the reading font. `talkBox.onType`: a typing hook per character for phase 07's mouths.
  - **Robots**: a Build tab of slot rows (part, type, move, Broken/Damaged) and a weight-against-legs meter; the
    Workshop refit sheet on the new look; the Workshop section as unit rows. **Bag**: a screen title, roomy rows, a
    floating use panel.
- Verified: lint, type-check, modules, format, data, build; unit tests 53/53 (the robot tests and sims included);
  smoke 15/15 (208 s; it was about 200 s with the painted stage); full-check steps Messages and Team pass. Headless:
  a battle in a room (the shop) and one started from the Map tab both run on the 3D stage; the floating cards keep
  clear of the fighters; screens looked at in both themes at 390 px.
- Risky: the full check (not run whole) and the in-game test now play every battle in 3D, so they are slower on the
  test machine. The leftover classic HUD code (`paintBoxes`, `.hcard`) is hidden, not deleted (06-4 cleanup).
  Look on your phone at the floating battle cards while moves play out (the test machine freezes animations).
- Next session starts with: 06-4 (Guide, Trainer card, Settings, shops, dressing room, friends; Studio gallery;
  delete the emptied CSS and the hidden HUD code; accessibility pass; tag `phase-06-done`).

### Phase 06, session 06-2b - The new opening - 2026-10-18
Owner's choices (docs/phases/06-plan.md "The new opening"): Blake comes before you have a starter; Hazel fights him
herself, without a Billie, in battle-screen style, absurdly overpowered, you only watch and tap; then the pick, where
tapping Hazel gives biased hot takes; Blake's battle has no tutorial, only Hazel's meta line and wrong type tips as a
HOT TIP over everything (the move buttons too) until tapped; she comments on lines skipped fast and on instant picks.
Script approved in chat before building.
- Changed:
  - `game/js/logic/hazel.js`: every line of the new opening in one table (`HAZEL`), `hotTake`, `hazelTip` (meta, the
    real matchup flipped, the canned bad tips; at most 4), `speedWatch` (n fast in a row: one comment each, then none),
    `fillLine`. Unit tested (`tools/test/hazel.test.mjs`).
  - Opening (cutscene.js): after "three of them right here", Blake runs in (4b), then Hazel's fight: Blake throws a
    coin, Gildlet pops out (Blake's first Billie: the slug line's first form; any common first form if missing), the
    plates (Prof. Hazel Lv ??? 9,999 HP; Gildlet Lv 4), her four moves, one hit, Gildlet drains to 0, flashes and
    goes. Staged inside the opening rather than the battle engine (which needs a Billie team); it looks like the
    battle screen (the 3D spot, plates, moves, a log to tap). Then the coins and the pick as before; Blake, already
    there, takes the counter with the new lines. `blakeHello` and the talk-first path went with the old intro.
  - Pick: a note on the card; tapping Hazel in the scene (nearer than any starter) shows the next hot take in a bubble
    over her head (three per starter, then annoyed ones).
  - Too fast: a tap that cuts a line short (under 0.7 s), or a fight line tapped away that fast, three times in a row
    → a comment after the line. In Blake's battle a move picked within 1 s of the menu (or of closing her tip), twice in
    a row → a HOT TIP comment (`tutorPicked`, from ui.js `bmove`; `activeBattle.menuT` set in battle.js).
  - Blake's battle: `battleTutor` shows `hazelTip` each turn as a HOT TIP (`#btip.hot`): big, tilted card with a
    wobbling badge over a dimmed screen; blocks everything until tapped. Returning players keep "Skip this battle".
  - Styles: `game/css/opening.css`.
- Verified: lint, type-check, modules, format, data, build; unit tests 41/41; smoke 15/15 (207 s), and the phone flow
  now also checks that Hazel's fight ran and that Blake's battle opens on a HOT TIP (141 s). A headless play-through
  saw every line in order, four hot takes on tapping Hazel, the HOT TIP covering the move buttons, the flipped tip
  ("Fire beats Water") and, with instant scripted picks, "Instant picks. Bold. Reckless. Very Sterling of you."
- Risky: on the test machine scripted clicks are slow (about 2 frames a second), so "instant" picks only fire with
  script clicks there; on a phone they fire as designed. Try tapping through fast on your phone.
- Next session starts with: 06-3 (dialogue box with the portrait slot, battle menus and text, Bag, the robot builder
  shell, removing the painted battle stage and the classic HUD).

### Phase 06, session 06-2 - Team, details and the starter pick - 2026-10-18
Built on 06-1 (PR #24) and the test boot fix (PR #19, cherry-picked). Owner's choices (docs/phases/06-plan.md):
the lead big and the rest as rows; parts as slot rows on an S·M·L dial; weight as a Speed–Attack balance meter; a Build
tab; the card and details shared by Billies and bots; the fallback starter list removed; screens before the new opening.
- Changed:
  - `game/js/unit-card.js` + `game/css/units.css`: one "unit" model (billyUnit now; a botUnit in phase 17) drawn by
    unitHeroHTML (the lead), unitRowHTML (everyone else), unitOpenRowHTML (open spots) and unitBuildHTML (the Build
    tab). Markup in the page (the rig canvases need it), names escaped, tokens only.
  - Team screen: the lead's card, then one roomy row per Billie (sprite, name, level, types, HP); tap for details.
    Day jobs and Storage are unchanged below (jobs go with phase 08).
  - Details sheet: a floating card clear of the edges; tabs Summary · Build · Moves · Evolves (the Stats tab's numbers
    were the same as the Summary's bars, minus "base"). Build: each slot's size on S·M·L (off-size in gold), weight
    and class, the Speed–Attack meter with its percentages, and Prime or how many parts are off.
  - `buildLean` (rules.js, from `partsLean` in logic/parts.js): attack and speed change, lean, parts off, Prime; unit
    tested against the stat factors.
  - The opening's starter pick card redone: arrows either side of the name, position dots, the blurb in the reading
    font, "Strong against / Weak to" as type pills, one gold button (Not yet / Yes on confirm). Same data-a buttons.
  - Removed: the step-by-step intro (stills, Hazel's lines, trainer step, the starter list) and `fallStill`. If the
    opening can't start or breaks, a Try again screen with Export debug log (`uiState.openingFailed`).
  - The step toast no longer repeats the money ("+$" rises from the money chip instead).
- Verified: lint, type-check, modules, format, data, build; unit tests 37/37 (new Build balance test); smoke 15/15
  (203 s; the phone flow plays the opening through the new card). New full-check step "Team" passes (31 s). Screens
  looked at in both themes at 390 px (sent in chat).
- Not cleaned yet: the CSS of the old intro, team cards and Stats tab (`.talk`, `.tr-*`, `.starters`, `.tm-*`,
  `.ms-stats`, `.ms-parts`) is unused now; 06-4 deletes emptied CSS.
- Next session starts with: 06-2b, the new opening (Hazel fights Blake herself, tap Hazel for hot takes during the
  pick, Blake's battle with her bad, obtrusive tips and "too fast" comments).

### Phase 06, session 06-1 - UI foundation and calmer messages - 2026-10-18
Plan: docs/phases/06-plan.md (PR #20). Owner's choices: Lit components, Chakra Petch for long text, an inbox dot for
notices, delete the codex prototype branch, start 06-1 now.
- Changed:
  - **Lit**: `tools/vendor-lit.mjs` bundles the npm package (lit 3.3.3, devDependency) into `game/vendor/lit.js`, a
    classic script that sets `self.PB_LIT` (14 KB minified). Classic, not an import, because tools/to-module.mjs only
    allows imports between the game's own modules; it also keeps `python3 -m http.server` working. `--check` tells
    when it doesn't match the installed version. Ignored by ESLint and Prettier.
  - **Tokens and motion**: `game/css/tokens.css` (space, corners, depth, type sizes, timings; colours stay in v05.css),
    `game/css/motion.css` (the eight motions as `m-*` classes; reduced motion from the phone or `[data-motion=reduced]`
    becomes a short fade). Loaded last; nothing older uses them yet except the bottom bar.
  - **Components** (`game/js/ui-kit.js`): `pb-panel`, `pb-pill`, `pb-button`, `pb-sheet`, `pb-toast`, plus `pbFloat`
    and the inbox dot. Shadow DOM with slots; a `data-a` on a `pb-button` reaches the page's click handler as before.
    Paths differ from the plan's `game/ui/`: new code sits in game/js and game/css so lint, type and module checks
    cover it.
  - **Messages** (`game/js/logic/messages.js`, ui.js): toasts are a `<pb-toast id="toast">` under the top bar,
    2.5 s, tap or swipe up to dismiss; the same text again joins the one showing or waiting ("Saved ×2"). The checks'
    `uiState.toastQ / toastOn / renderOverlay()` still work (plain strings too). `notice()` puts a notice behind a
    dot on the portrait (`data-a="inbox"` opens them in one sheet): the boot's "A new game / A newer save" and the
    Copperleaf Town note (its flag is now set when read). `whenWorldShows()` holds the boot's waiting choices
    (hatch, learn a move, evolve) until the loader, title and opening are gone and the world has shown for 1.2 s.
    Money earned rises as "+$120" from the money chip.
  - **Bottom bar** on the tokens: 8 px padding, 44 px buttons, press .96, tokens for corners, depth and timing.
- Not done, on purpose: the loader tips about real steps are still true (phase 08 Part A hasn't removed steps), so
  they stay for phase 08. The codex branch: saved as `archive/codex-playable-ui-graphics-poc`; deleting branches and
  pushing tags are refused from Claude's sessions, so **delete `codex/playable-ui-graphics-poc` on GitHub** yourself.
- Verified: lint, type-check, module check, format, data check, build (vendor/lit.js ships before the bundle), unit
  tests 36/36 (new `messages.test.mjs`, fault planted once), smoke 15/15 (187 s, unchanged). New full-check step
  "Messages" (24.7 s, not in smoke) passes, and fails with a planted inbox fault. Components checked on a scratch page
  in both themes at 390 px (screenshots sent in chat).
- Risky: headless software rendering freezes the page's animation clock while the 3D town draws, so the checks can't
  see entrance animations finish (the toast reads opacity 0 there); look on your phone. Toasts that announce money
  (for example "+$1,571 steps…") still show alongside the new "+$" float; 06-2 can trim them.
- Questions waiting for the owner: delete the codex branch on GitHub; merge PR #19 (test boot opening) and PR #20 (plan).
- Next session starts with: 06-2 (Billie card, details sheet with parts, sizes, weight and Prime, Team, starter pick).

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

### Phase 16 prototype, part 1 - parts, roster trim, Studio - 2026-10-18
Owner's choices: wild Billies get their own parts at random sizes; the weight formula as proposed (±20%); Prime about
1 in 12 (M 60%); old lines to a legacy folder; the 4 new lines now with placeholder art; only the starting area's pools.
- Changed: parts on every Billie (rules.js, logic/parts.js, rules.json "parts"); drawn at size by the rig
  (skeleton-rig.js) wherever a Billie shows; a Parts panel and Prime ribbon in a Billie's details; 55 lines to
  game/data/legacy (roster tracker too); swift, kardashian, trump, zuck lines with placeholder sheets and rigs
  (tools/build-rework-placeholders.py); starting-area pools use the 7 lines; legacy species named elsewhere get a
  same-stage stand-in at load; Studio Parts section, Part slot picker, build previews and Check rules.
- Risky: every area past Fizzwell and all trainers still name legacy species, so they show stand-ins (one of the four new
  lines) until redone. Trainers, starters and the rival are Prime, so they are 10% stronger than before. The kit-built
  rigs (Trump, Zuckerberg) are rough; the Studio can fix their sockets.
- Verified: lint, type-check, module and data checks, 32 unit tests (7 new, with a 20,000-roll simulation); headless:
  wild spawns roll builds, a wild battle carries the build to the stage and stats, the details panel shows it, sizes
  draw with the feet on the ground; check-studio-github.py (19 sections, a save proposed, no errors); the Studio's
  Parts section, its live readouts and checks, and the slot picker. The full quick check was not run.
- Next: the starter split by body size, the 7 passives, quirks and Prime moves, a breed function and one abomination.

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

# Clean-up track (CU) - a tidy main, laid out like a game repo; no "placeholder" or "AI" in the Studio

Branch: track/cleanup

A side track. The owner asked (2026-10-28): "Clean up the main branch of documents and files that are useless and
unneeded. Research online how game development repos normally look like. Also remove all mentions of placeholder and
ai in the studio. Make sure this plan can be run in simultaneous sessions." CU-0 (this file, docs only) was written on
`ccr-4d35b293-6rc24z`; every later session works on `track/cleanup`.

This is the second clean-up. The first (PR #283, merged 2026-10-28 from `claude/pensive-albattani-99s7l6`) deleted 17
tools (4 dead ones, 13 legacy-era generators), moved 13 finished briefs into docs/archive/ and deleted the 04e
patches, a kit-starter sample and 7 bowl pictures. The Studio art track's SA-5 (2026-10-27) cleared unused art.

**Status:** CU-0 and round 1 (lanes S, D, R, T) done 2026-10-28; round 2 done 2026-10-29 (PR #328). What is left is in
section 7, each item with its blocker: a later session (CU-3) does them once the blockers are gone. Tag `cleanup-done`
when section 7 is empty.

Before editing, every lane checks the facts it relies on against main and says in its HANDOFF entry what differs:
they come from read-only audits on 2026-10-28 (main at 4423a457, re-checked at 3f559c3b). Line numbers drift; find
lines by their text.

## Contents
1. The owner's answers
2. Research: how game repos are laid out
3. Running the lanes at the same time
4. Facts every lane needs
5. Round 1: lanes S, D, R, T
6. Round 2: close-out
7. Waiting (blocked items and what unblocks them)
8. Not in this track
9. Checks

## 1. The owner's answers (2026-10-28)
Lanes act on these without asking again.
- **HANDOFF.md**: keep the newest 3 entries of every track; move the rest, word for word, to one file in
  docs/archive/.
- **Old docs**: docs about the legacy build are deleted (the `legacy` branch and tag keep them); finished track plans
  are archived (moved to docs/archive/, since they hold the owner's answers).
- **Sound names**: plain names ("a growl that rises into a bark"); the Check stops listing them as not yet named. This
  replaces SND-4's choice of "placeholder" hook names (docs/phases/sound-track.md, SND-4).
- **Licence**: a LICENSE saying "all rights reserved", plus CREDITS.md for the outside fonts, models and libraries.
- **Placeholder Billies** are renamed **Sketch Billies**.
- **Scope of the words**: everywhere: the Studio's words and help, the data names it shows, and the code behind it
  (file, function and folder names, the npm script), and the Studio guide (docs/STUDIO.md). HTML's own `placeholder`
  attribute (the grey hint in an empty box) stays: it is the browser's name for it, not a word anyone sees.
- **The region word "Placeholder"** (regions.json, makes run names like "Placeholder Basin") becomes **"Untitled"**,
  in the same slot of the list, so every other seed keeps its region name.
- **Portrait kit sources** (tools/art-source/portrait-kit/, 20.5 MB): deleted. The 311 cut portraits stay.
- **Orphan art** (40 layer PNGs, 53 voxel recipes nothing loads): deleted, and the unused-art count stops counting the
  build lists the game never loads.
- **game/data/maps/test_props_city.json**: deleted.

## 2. Research: how game repos are laid out
Looked at (2026-10-28): [PokeRogue](https://github.com/pagefaultgames/pokerogue) (a web game: Vite, TypeScript),
[Mindustry](https://github.com/Anuken/Mindustry), [Endless Sky](https://github.com/endless-sky/endless-sky),
[Shattered Pixel Dungeon](https://github.com/00-Evan/shattered-pixel-dungeon),
[Cataclysm DDA](https://github.com/CleverRaven/Cataclysm-DDA), [PlayCanvas](https://github.com/playcanvas/engine),
Godot's [Project organization](https://docs.godotengine.org/en/stable/tutorials/best_practices/project_organization.html)
page, a Claude Code game-studio template ([Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)),
GitHub's [community health files](https://github.com/github/docs/blob/main/content/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file.md),
and two short guides on [folders](https://bugnet.io/blog/how-to-organize-your-game-projects-folders) and
[Git LFS](https://bugnet.io/blog/git-lfs-for-game-projects-when-you-need-it) for games.

| What they do | Here, after this track |
|---|---|
| A short root: README, LICENSE, CHANGELOG, CONTRIBUTING, build and lint configs. Every one of the six repos has a LICENSE; credits for outside work sit at the root too (PokeRogue CREDITS.md + LICENSES/, Endless Sky credits.txt + copyright, Cataclysm LICENSE-*-Font.txt). | LICENSE and CREDITS.md added; README's "Contribute" becomes CONTRIBUTING.md (PokeRogue, Mindustry and Cataclysm keep one at the root, Endless Sky in docs/). ART-NOTES.md moves into docs/ (round 2). |
| One folder per kind: code (src/, core/), tools or scripts (tools/, scripts/, utils/), tests (test/, tests/), docs (docs/, doc/). | Kept as is: game/ and studio/ are the site's URLs; tools/, tools/test/, docs/. |
| docs/ holds what people use now (build, contribute, style, design). Plans and roadmaps often live in a wiki or tracker; history lives in git. | Finished plans move to docs/archive/; docs about the legacy build go; HANDOFF.md keeps only each track's newest entries. |
| Raw art sources apart from shipped assets (Mindustry's assets-raw; "raw working files never live in the engine's asset folder"). | Already so: tools/art-source/ beside game/art/. |
| .editorconfig and .gitattributes (PokeRogue, Endless Sky, Cataclysm, PlayCanvas). | Both added. Every tracked text file is LF already, so .gitattributes renormalises nothing. |
| Git LFS for big binaries (common in engine projects). | Not used, on purpose: GitHub Pages can't serve LFS files and the Studio saves pictures through GitHub's API (phase 01's decision, HANDOFF archive). The repo is 105 MB packed. |
| Issue and PR templates in .github/. | A PR template with the HANDOFF entry's headings. |

Not adopted, on purpose: moving tools/test/ to tests/, or docs/phases/ to another folder. Both are named in CLAUDE.md,
the skills, rename.mjs's history rule and the tools, and edited by most open branches: every live session would pay a
conflict for a tidier tree.

## 3. Running the lanes at the same time
- **One branch.** Every CU session works on `track/cleanup` (a cloud session can only push to the branch it was
  started on). At the start: `git branch --show-current` must say `track/cleanup` (if not, say so and stop); then
  `git fetch origin main && git merge origin/main` (a merge, never a rebase) and push.
- **Before every push**: `git pull --no-rebase origin track/cleanup`. A push refused as not fast-forward: pull again,
  then push. Never rebase, amend a pushed commit or force-push.
- **Each lane edits only its own paths** (listed per lane). A change it needs elsewhere goes in its HANDOFF entry,
  under "For round 2".
- **Shared files**: docs/HANDOFF.md takes each lane's entry at the top, in one commit right before its last push (a
  conflict there is two entries: keep both). CHANGELOG.md: lane S adds one bullet, lane D edits only the header's
  links. docs/NAMING.md: lane S adds one vocabulary row, lane D edits its link line and the `worldMap` row.
  docs/ROADMAP.md and docs/BRANCHES.md: only CU-0 and round 2.
- **Other tracks' open work.** "Live" branches are the heads of open pull requests plus every `track/*` branch with
  commits not in main. At lane start, and again before deleting, moving or editing a file, run:

  ```bash
  git fetch origin --quiet
  LIVE="<the heads of the open PRs (GitHub's PR list or the GitHub tools)> $(git for-each-ref --format='%(refname:short)' 'refs/remotes/origin/track/*' | sed 's#^origin/##')"
  F=<file>
  for b in $LIVE; do
    [ "$(git rev-list --count origin/main..origin/$b)" = 0 ] && continue
    mb=$(git merge-base origin/main origin/$b) || continue
    git diff -U0 "$mb" "origin/$b" -- "$F" | grep '^@@' | sed "s#^#$b #"
  done
  ```

  Each `@@ -a,b` names lines the branch changed, counted in the file as it was at the merge base (find them in main by
  their text). Rules: never delete or move a file a live branch changes; never edit a line within 3 lines of a live
  hunk. Such an item goes to section 7 (Waiting) and the HANDOFF entry. Branches that share no history with main
  (`legacy`, `archive/*`, `track/reflavour`, `track/reflavour-rf-5`, `track/towns`, `claude/ui-15-less-clutter`) and
  branches whose work reached main another way (the UI-8c..UI-14b and WM-6 branches) can't conflict: ignore them.
- **Proving a deletion.** Before: `git grep -n -e '<path>' -e '<file name>' -- . ':!docs/HANDOFF.md' ':!docs/archive'`
  (code, data, tools, tests, CI, skills, docs). In the same commit: remove or repoint every live mention. After: the
  checks of section 9. One cause per commit.
- **Renames** use tools/rename.mjs (`name|prefix|file|prop`) and tools/rename-data.mjs (`key|section|value`), each
  followed by its `verify`; one rename per commit, never mixed with a behaviour change (CLAUDE.md, NAMING.md).
- **Generated files** are regenerated, never hand-merged: game/js/hooks.js and debug-log-names.js (`npm run modules`),
  studio/art-code-refs.json (`node tools/art-code-refs.mjs`), game/art/next/rigs-next.js (the bake, after lane S's
  rename `npm run bake:sketches`), test snapshots (the test's own update, docs/TESTING.md). After a pull that
  conflicts in one: take either side, regenerate, commit.
- **The pull request**: one draft PR from `track/cleanup` into main, opened by the first lane to push (if none is
  open). Each lane's HANDOFF entry says its part is pushed. The owner merges when round 2 says so, or earlier.
- **The tag**: `cleanup-done` when the track is finished (CLAUDE.md: no per-session tags).

## 4. Facts every lane needs
**Guards (break these and a check goes red):**
- tools/test/version-source.test.mjs: README.md's **line 1** must end with " 0.1.0 alpha"; the **first**
  `## <word> <word>` heading of CHANGELOG.md must be `0.1.0 alpha`.
- tools/rename.mjs's `HISTORY` (line ~54): it never rewrites docs/HANDOFF.md, docs/NAMING.md, docs/archive/**,
  docs/phases/**, CHANGELOG.md or CLAUDE.md, and rewrites old names in every other text file (README, ART-NOTES,
  STUDIO, TESTING, SCRIPTS, ROADMAP, BRANCHES...). So archives go inside docs/archive/, and nothing leaves
  docs/phases/ except into docs/archive/.
- Docs named in text people see: docs/SCRIPTS.md (Studio help in data-editors.js, map-editor.js, unlocks-editor.js; 7
  schema descriptions) and docs/phases/06-plan.md (the Studio's UI rules help, ui-rules.js): their paths stay.
- Never delete: game/fonts/*.txt (the fonts' licences ship with the game), validation/cc0-src/LICENSES.md (the CC0
  record), tools/requirements-check.txt (CI installs from it).
- Nothing parses HANDOFF, ROADMAP, BRANCHES, TESTING, NAMING or a plan's `Branch:` line; the skills grep HANDOFF's
  `### ` headings (start-session) and edit above the first one (handoff).

**Open pull requests on 2026-10-28** (the live set's core): #326 `ccr-57f31de3-t3zmha` (VFX into main), #325
`claude/vfx-19-move-sounds` and #324 `claude/vfx-17-scenes-1` (into track/vfx), #323 `track/perks`, #322
`track/dialogue`, #314 `claude/laughing-tesla-roy32r` (into track/characters), #308 `claude/new-session-bcxme1`, #295
`track/vfx`, #292 `track/sound`, #291 `ccr-24be55e6-2bmqci` (PK-0's plan and eight sample icons; superseded by
track/perks: the owner may close it, or merging it would bring docs/samples/perk-icons.* back). Plus `track/perks-items`.
Files they change that this track also touches: HANDOFF (11 branches), ROADMAP (11), BRANCHES (8), studio/index.html
(9), studio/art-code-refs.json (10), tools/check-studio-github.py (8), docs/STUDIO.md (6), .gitignore (5),
docs/TESTING.md (3), ART-NOTES.md (2), game/data/music.json and studio/js/music-editor.js (2: track/sound and the
VFX move sounds), CHANGELOG.md, docs/SCRIPTS.md, game/data/index.json, eslint.config.js,
docs/samples/perk-icons.* (1 each).

## 5. Round 1: four lanes at once
Each lane is one session, started on `track/cleanup` with the prompt "Clean-up track, lane <S|D|R|T>". Sizes: S is the
largest (a long session), D a full session, T and R short ones.

### Lane S - the Studio's words: no "placeholder", no "AI"
**Owns:** studio/**; docs/STUDIO.md and docs/phases/studio-self-test.md; the files of the sketch rename (step 4);
package.json; the cry names in game/data/lines/*.json; game/data/robots.json's part texts, regions.json's name parts,
quests.json's `about`, bodyPlans.json's note and the schema descriptions of these; game/js/logic/pixel-snap.js and
game/js/prop-models.js (one comment each); the new guard test; one NAMING.md row; one CHANGELOG bullet; and the
one-word rewrites rename.mjs makes in any non-history doc or tool (other lanes leave those lines alone).

**Stays on purpose** (the audit counted them): HTML's `placeholder=` attribute and the `ph:` field option, the grey
hint in an empty box (36 attributes in 21 files plus gallery.html's pb-field, 44 `ph:` options; none of their values
says placeholder, AI or Claude); the battle engine's opponent logic (`chooseAI`, `aiScore`, rules.json `aiSmart`,
which the Studio labels "Trainer smarts": game AI, never shown as "AI"); "CLAUDE.md" in two comments (a file's name,
logic/camera-readout.js, boards.js); the plain word in game-only comments the Studio never shows (e.g. "placeholder
numbers" in game/types/game-data.d.ts).

Steps, in this order, each grepped before and checked after:
1. **Words, no behaviour change.**
   - studio/js/workbench-model.js, the model drop zone: "Blender, Blockbench, MagicaVoxel and AI generators all
     export glTF." -> "Blender, Blockbench and MagicaVoxel all export glTF."; its header comment ("...or an AI
     generator...") likewise.
   - studio/js/genes-editor.js: "Every number below is a placeholder." -> "Every number below is a first guess.";
     "Placeholders." -> "First-guess numbers."; the header comment's "Every number is a placeholder until the owner
     sets it" -> "...a first guess until the owner sets it".
   - Comments: studio-app.js ("the new HTML's placeholder with the same key" -> "...empty slot..."),
     economy-page.js ("a placeholder says so" -> "a notice says so"), logic/pixel-snap.js ("an AI image" -> "a
     painted image"), prop-models.js ("inside the Claude app a fetch of it is refused" -> "inside some apps' web views
     ...").
   - docs/STUDIO.md: "an AI image" and "an AI generator" (two lines).
2. **Text that reaches players** (found in the audit).
   - robots.json `parts.{intake,seizer,franker,conveyor}.d` read "RL-14b: the Retrieval Unit's leader bot, a filing
     cabinet that walks. Placeholder art." and show on the salvage card (reward-screen.js) and a robot's blurb
     (fighters.js -> billie-sheet.js). The "RL-14b: " and " Placeholder art." go; the description stays.
   - regions.json `names.parts`: "Placeholder" -> "Untitled" in the same slot (logic/run-region.js builds the names;
     run-loading.js, map-tab.js and run-card.js show them). tools/test/run-start.test.mjs.snapshot changes only if one
     of its seeds drew the word.
   - quests.json `about`: "Texts drafted by Claude, approved by the owner (2026-10-25)." -> "Texts approved by the
     owner (2026-10-25)." (not shown; the Studio's data, so it goes).
3. **The 53 cry names** in 22 lines/*.json files: "placeholder: a hoot that sounds sure of itself (Claude's draft)" ->
   "a hoot that sounds sure of itself". Spacing varies (`"name":"..."` and `"name": "..."`) and hastings.json uses a
   curly apostrophe (Claude’s). line.schema.json's `name` description loses "Claude's drafts start with
   "placeholder" (the Studio's Check lists them)". The game never reads these names and the sound baselines key on ids
   (no audio changes). The Check's "Billie cries" note simply has nothing left to list.
4. **The sketch rename** (~417 lines in 31 files plus 130 rig keys), one rename per commit, rename.mjs and its verify;
   `npm run modules` and `node tools/art-code-refs.mjs` in each commit that needs them:
   1. skeleton.js `placeholderPart` -> `blankPart` first (the lilac oval behind "+ Blank part": a different thing,
      and it must not catch the prefix rename).
   2. File game/js/logic/placeholder-art.js -> sketch-art.js (game/index.html, studio/index.html,
      studio/js/logic-worker-modules.js, which keeps its imports in name order (logic-worker.test.mjs), and
      game/types/game-data.d.ts's `import('../js/logic/placeholder-art.js')`). Then its test file
      tools/test/placeholder-art.test.mjs -> sketch-art.test.mjs (tools/after-edit.mjs maps a module to
      `<name>.test.mjs`).
   3. The prefix `placeholder` -> `sketch` and `Placeholder` -> `Sketch` (27 exports and 5 typedefs:
      placeholderBake, placeholderSheet, placeholderSheetCut, placeholderCellsWith, placeholderFormOf,
      placeholderPanelHTML, placeholderUi, PlaceholderBone, PlaceholderForm...). Then `graftPlaceholder*` and
      `PlaceholderBaked` (logic/graft-art.js), `graftBakePlaceholder`, `graftPlaceholderForm`, `graftPlaceholderRig`
      (skeleton-rig.js) -> `graftSketch*`, `SketchBaked`, `graftBakeSketch`...; the test file
      graft-placeholder.test.mjs -> graft-sketch.test.mjs. rename-strings.py carries the names inside
      check-studio-github.py (it calls `placeholderFormOf` in the page).
   4. File studio/js/placeholder-sheets.js -> sketch-sheets.js; inside it the `ph` short forms (`PH_DRAWN`,
      `PH_SHEET`, `phCanvas`, `phCells`, `phDownload`, `phFormFrom`, `phPixels`, `phSheetForms`, `phUpload`,
      `phWrite`), its actions (`phDownload`, `phUpload`, `phWrite`, `phPlanDownload`, `phPlanUpload`), attributes
      (`data-ph`, `data-ph-sp`) and class (`placeholder-sheets`) -> `sketch*` / `SKETCH_*` / `data-sketch*` /
      `sketch-sheets`.
   5. tools/bake-placeholders.mjs -> bake-sketches.mjs, `npm run bake:placeholders` -> `bake:sketches`, its default
      export folder tools/art-source/placeholders -> tools/art-source/sketches (lane T ignores it). The header line of
      game/art/next/rigs-next.js and the header string in studio/js/github.js (which writes that line when the Studio
      saves rigs) must stay identical: both say `npm run bake:sketches`.
   6. The rig key `placeholder: "bodyPlans.json"` -> `sketch` (130 in rigs-next.js, 65 Billies x front and back):
      written by sketch-art.js, read by skeleton-rig.js, debug-menu.js and studio/js/roster.js. Re-bake rigs-next.js
      in the same commit; "every committed sketch Billie bakes as committed" (sketch-art.test.mjs) must pass.
   7. logic/pixel-density.js's report row key `placeholder` -> `sketch` (roster.js and pixel-density.test.mjs read it).
   8. The art folder game/art/next/placeholders/ -> game/art/next/sketches/ (kappi.png; studio/art-keep.json,
      tools/paint-kappi.mjs, sketch-sheets.js's drawn-sheet path).
   9. Debug log words: skeleton-rig.js "a kit Billie and a placeholder one, or no placeholder form" and debug-menu.js's
      lines -> "sketch".
5. **"Sketch Billie" in the words**: the Part mode heading "Placeholder Billie <name>" -> "Sketch Billie <name>" and
   its help ("a cell left magenta keeps its placeholder" -> "...keeps its sketch"); workbench-species.js's toast "A
   placeholder Billie’s sheet is baked from its body plan: Write Billie packs it." -> "A sketch Billie’s sheet...",
   keeping "baked from its body plan" (check-studio-github.py looks for it); kit-recipe.js "this Billie is on its
   placeholder (bodyPlans.json)" -> "this Billie is a sketch (bodyPlans.json)"; the roster's density table ("quad
   placeholder" -> "quad sketch"); bodyPlans.json's note and bodyPlans.schema.json; game-data.d.ts's comment; the
   concept's lines in docs/STUDIO.md (about 12); tools/check-data.mjs's comment; a NAMING.md vocabulary row: "A Billie
   whose pictures are painted from its body plan, to be drawn over: a sketch Billie (`sketch*`, logic/sketch-art.js,
   art/next/sketches/, `npm run bake:sketches`) | was placeholder".
6. **docs/phases/studio-self-test.md into docs/STUDIO.md** as its "Self-test" section (it specs a shipped tool, and
   STUDIO.md cites "the self-test's X row" without explaining it); the comments in studio-test.js,
   studio-test-start.js and studio-test-report.js point at the section; the file goes.
7. **The guard**: tools/test/studio-words.test.mjs fails when studio/**, docs/STUDIO.md or a name the Studio shows
   (lines/*.json cries, robots.json `d`, regions.json name parts, bodyPlans.json) says `placeholder(s)`, `AI` (as a
   word) or `Claude`, after removing `placeholder=` attributes, `placeholder:` keys and `.placeholder` properties.
   music.json, music-editor.js and logic/music-studio.js are skipped until the music step (a comment points here).
8. CHANGELOG: one bullet (the Studio's words, Sketch Billies, the robots' blurbs, "Untitled"). Last:
   `git grep -n -i -w -e placeholder -e placeholders -e AI -e Claude -- studio docs/STUDIO.md game/data` shows only the
   kept items and the music step's lines.

**The music step (waits; section 7):** the 40 names in game/data/music.json (17 `songs.*.hookName`, 7
`jingles.*.name`, 8 `cries.bases.*.name`, 8 `ui.sounds.*.name`) -> plain; the marker goes: `isMusicPlaceholder` and
the Check's four notes in game/js/logic/music-studio.js (and its "Claude's drafts" comment), music-editor.js's three
help texts ("Claude’s drafts start with “placeholder”; the Check lists them until you rename them.") and its match on
the note's text (`/^placeholder Billie cries/`), tools/test/music-studio.test.mjs's marker tests,
music.schema.json's four descriptions, game-data.d.ts's two comments, docs/STUDIO.md's line, docs/TESTING.md's two
lines; the guard's music exclusions removed; sound-track.md's SND-4 note gets "replaced by plain names (CU, the owner
2026-10-28)". track/sound (#292) and `claude/vfx-19-move-sounds` (#325) change these very lines today (21 and 38
changed lines with the marker in music.json), so it runs only when both are in main.

### Lane D - docs
**Owns:** docs/** except docs/STUDIO.md and docs/phases/studio-self-test.md; ART-NOTES.md; CLAUDE.md lines 20-22;
.claude/skills/start-session/SKILL.md's HANDOFF sentence; comment lines elsewhere that only cite a doc this lane moves
or deletes, when no other lane's step touches that file (else: round 2).
1. **The HANDOFF archive.** Group the `### ` entries by track (the heading up to "track", e.g. "UI track", "Perks
   track"; "Phase 20" style for phases; else the first word: "Fix", "Tooling"...). Keep the newest 3 of each group
   (the file is mostly newest first; trust the heading's date when they disagree) and every entry a live branch
   changes (the section 3 script on docs/HANDOFF.md; map each hunk to its entry by heading text). Move the rest, in
   their order and word for word, to docs/archive/HANDOFF-2026-10.md (a one-line header saying what it is). Drop the
   stray old "## Entry template" (the handoff skill holds the entry's shape) and fix the header line (it asks for a
   `phase-NN-done` tag; CLAUDE.md says no per-session tags). Dry run at 3f559c3b: 350 headings; 145 entries stay
   (about 7,640 lines), 205 move (about 10,390 lines). Then CLAUDE.md line 20 ("never the whole file: over 14,000
   lines") and start-session's "it is over 14,000 lines" say: never read it whole; older entries are in
   docs/archive/HANDOFF-2026-10.md. Live branches insert at the top, so the cut merges cleanly.
2. **Delete the legacy docs** (the `legacy` branch keeps them):
   - docs/archive/LEGACY-CHANGELOG.md (168 KB; the legacy branch's README holds the same sections). Repoint
     CHANGELOG.md's header and docs/phases/characters-track.md:42 (a quote's source: "the legacy build's changelog, on
     the `legacy` branch"); README's link is lane R's.
   - docs/archive/phase-05-renames.md (100 KB, old -> new names of phase 05). Repoint NAMING.md:6 and CHANGELOG.
   - ART-NOTES.md lines 1-490: the legacy art log (Net Worth v7 to v47, alpha 0.4/0.4.1, an image prompt). Keep the
     title, one line ("Art rules for the fresh base; the legacy build's art log is ART-NOTES.md on the `legacy`
     branch") and the current sections from "## Robots (phase 17, placeholder)" on. In "## Portraits (phase 07, in
     progress)" the kit's two lines say the sources were deleted on 2026-10-28 (lane T) and
     `git log --diff-filter=D --oneline -- tools/art-source/portrait-kit` finds them. ART-NOTES.md stays at the root
     until round 2 (track/perks-items appends to it; trimming and moving at once would turn that into a conflict).
3. **Archive finished plans** (`git mv`, then fix every pointer the grep finds):
   - to docs/archive/tracks/: camera-track.md (tag camera-done), route-props-track.md (route-props-done),
     routes-track.md (RT-1..4b done), studio-art-track.md ("the track is done"), test-cleanup-track.md
     (test-cleanup-done), towns-track.md (towns-done), and docs/plans/studio-roguelite-improvement-plan.md (done:
     Phases 0-6 and SA-4's T4.5/T6.8; docs/plans/ is left empty and goes). Its three code pointers
     (logic/draft-record.js, publish-plan.js, type-rename.js) wait for round 2 if lane S touches those files.
   - to docs/archive/ (the numbered briefs live there): 13-testing-and-debugging.md (absorbed: 13a done, 13b done by
     the TC track, 13c parked; CLAUDE.md l.22, TESTING.md's first lines, tools/after-edit.mjs's comment and
     test-cleanup-track point at it) and 14-studio.md (absorbed by the Studio track and the Studio plan).
   - Not yet: style-track.md (done, but gallery.html, ui-run-kit.js and two CSS files cite it in code comments: round
     2); air-track (waits for the owner's phone check); every active track.
4. **Delete superseded and duplicate docs:**
   - docs/phases/10-proposed-links.md (the legacy world's roads; every map but Copperleaf is parked since RL-5) and its
     two mentions in 10-world-map-bowl.md.
   - docs/phases/10-bowl/ (option-atlas.png, option-diorama.png, option-pixel.png, layouts.json; about 1 MB; only the
     bowl doc names them, nothing reads layouts.json) and the bowl doc's lines that show them.
   - docs/phases/style-track-sessions.md (the done style track's prompt template) and style-track.md's one line.
   - docs/samples/perk-icons.png and perk-icon-samples.json (all eight samples are real grids in
     tools/art/icon-grids/perks.json now) and perks-track.md's lines 359-360 (if not within 3 lines of a live hunk).
     The folder stays: track/dialogue adds docs/samples/dialogue-mockup.html.
   - docs/phases/07-portraits.md merged into 07-plan.md (07-plan already holds its decisions; its "What exists (on the
     branch)" means main; the kit table says the sources were deleted, as in step 2); ROADMAP's row is round 2's.
5. **Superseded sections nobody edits:**
   - roguelite-track.md: "## 0. What the repo says today (verified at HEAD e3df43a, 2026-10-20)" with Findings A-D,
     "## 0b. Old phases..." with "### 0c", "## 1. The reworked roadmap (what docs/ROADMAP.md becomes...)" and "### 9.5
     The organization: three name options (superseded...)": about 550 of its 1,337 lines, 22 dead paths. Reword the
     file's own references to them; section 8's answers stay.
   - TESTING.md: the opening paragraph's phase-13 "(13b)/(13c) arrive with those sessions" lines become one sentence;
     in "What each phase does", the entries for phases absorbed or never built (07, 11, 12, 15, 16, 17, 18: check each
     against ROADMAP's old-phases table) go, if no live hunk is near them.
   - ROADMAP.md, only outside the track rows: the header's per-session tag sentence (CLAUDE.md says no per-session
     tags), the duplicate RL-8 row (keep "(done 2026-10-21, played)"), RL-12's "RL-12b next", "## If the scope is too
     big" (all of it done), the repeated items in "## Questions I want to be asked".
6. **Stale pointers:** CLAUDE.md l.21 (the phase-03 baseline sentence) and l.22 ("the smoke subset once it exists
   (phase 01)"; "Tiers and budgets are in docs/phases/13" -> docs/TESTING.md); NAMING.md's `worldMap` row (world-map.js
   and world-map-gl.js are gone: the world map is world-bowl.js and logic/bowl*.js); SCRIPTS.md's
   `maps/copperleaf__ch2.json`; project-story.md's Hazel files (logic/hazel.js, hazel.test.mjs, docs/STORY.md don't
   exist); hub-track.md's island-sketches tool line (lane T deletes the tool); then a dead-path check over every doc
   this lane owns: count before and after in the HANDOFF entry.
**Leaves alone:** VISION.md (the owner's: its "airship", "brackets" and "relics" are now the sky train, Expeditions
and Perks; listed for the owner in the HANDOFF entry); CHANGELOG's shape (rewritten as a summary at release time, with
the version test); 06-plan.md; the parked plans (07, 09, 16, 17); every active track file beyond the lines above.

### Lane R - the root, like a game repo's
**Owns:** README.md, and the new LICENSE, CREDITS.md, CONTRIBUTING.md, .editorconfig, .gitattributes,
.github/pull_request_template.md; the two game messages below.
1. **LICENSE**: "Copyright (c) 2026 nojiroh. All rights reserved." and a short paragraph: the repository is public so
   the game can be played and followed; no licence to copy, change or share its code, art, data or text is given,
   except for the outside parts listed in CREDITS.md under their own licences. (The repo is public and has no licence
   today: GitHub's API says `license: null`.)
2. **CREDITS.md**: the fonts in game/fonts/ (Caveat, Chakra Petch, Jersey 15, Oxanium, Pixelify Sans, Tiny5: SIL Open
   Font License 1.1, whose texts ship as game/fonts/OFL.txt and PIXELIFY-SANS-OFL.txt; check each font's copyright
   line there); Lit 3.3.3 (BSD-3-Clause, bundled into game/vendor/lit.js by tools/vendor-lit.mjs); the KayKit models by
   Kay Lousberg (CC0, sources and record in validation/cc0-src/LICENSES.md; the game draws recipes made from them);
   anything else a `git grep -i -e licen -e copyright -- game studio tools` finds.
3. **CONTRIBUTING.md**: README's "## Contribute" section moved whole (modules and hooks.js, the checks before a push,
   one rename per commit, reformatting in no-op commits), plus where things are decided: docs/BRANCHES.md,
   docs/TESTING.md, docs/NAMING.md, CLAUDE.md. README keeps two lines pointing at it.
4. **README.md**: line 1 untouched (the version test). Fix: the Studio's button is "Propose changes" (studio/js/
   github.js), not "Save to game"; `npm test` takes about two minutes in a cloud container now (docs/TESTING.md), not
   20 s; the legacy changelog's link (lane D deletes the file) becomes "the `legacy` branch (its README holds the old
   changelog)"; re-check every path in "## Project layout" (all 60 existed on 2026-10-28) and add the new root files;
   link CONTRIBUTING.md, CREDITS.md and LICENSE.
5. **Two game messages** that point at README sections that don't exist (player-visible, stale since the fresh base):
   game/js/boot.js, opened from disk: "Battles and the map need a local web server. Open the game with Start-Game (see
   README)." -> "...need a local web server (README: Run it from the source)."; game/js/friends.js: "Friends need the
   updated database rules (see README → Friends)." -> "...the updated database rules (firebase/firestore.rules)."
6. **.editorconfig**: utf-8, LF, a final newline; 2 spaces for js, mjs, css, html, json, ts; 4 for py; no trailing
   whitespace trimming in md. Matches .prettierrc.json (printWidth 120).
7. **.gitattributes**: `* text=auto eol=lf`; `binary` for png, webp, jpg, gif, ico, woff2, bin, glb, vox. Proof:
   `git add --renormalize . && git status --porcelain` shows nothing (on 2026-10-28: 1,866 LF text files, 0 CRLF).
8. **.github/pull_request_template.md** with the HANDOFF entry's headings: Changed, Found (not changed), Risky,
   Verified, For the owner on the phone, Next.
**Leaves alone:** index.html (the site's start page, copied by the build), .mcp.json, .git-blame-ignore-revs, the
configs.

### Lane T - files: tools, art, data, validation
**Owns:** tools/** except bake-placeholders.mjs and the one-word rewrites lane S's renames make
(check-studio-github.py, bake-kit-billies.mjs, paint-kappi.mjs, check-data.mjs); game/art/scene/layers.json,
game/art/scene/props/layers/, game/art/scene/vox/; game/data/maps/test_props_city.json and its line in
game/data/index.json; validation/**; .gitignore; the tests and snapshots its deletions need.
1. **Scratch and one-offs:** tools/trainer_gen/pv.py, pv2.py, preview.py (preview scripts: build-trainer-art.py
   imports body, items and items2; pv2.py writes into a dead session's scratchpad); tools/island-sketches.mjs and
   island-sketches.py (HB-4a's direction sketches; the pick, B2, was made 2026-10-25; they only reference each other).
   tools/data/hub-sketches.json stays (island-gen-doors.test.mjs reads it).
2. **The portrait kit** (the owner's answer): tools/art-source/portrait-kit/ (15 sheets, kit.json, prototype/) and
   tools/slice-portrait-kit.py (its only input). game/art/next/portraits/ (311, kept on purpose in
   studio/art-keep.json) and game/data/portraits.json stay; any text that names the slicer as how to remake them says
   the sources are in git history. eslint.config.js's `tools/art-source/` ignore (it was for the prototype) waits for
   round 2 (eslint.config.js is live on #314).
3. **Orphan art.** tools/art-code-refs.mjs counts every JSON file in game/art as a "recipe" that names pictures, but
   four of them are build lists only the Python tools read (scene/props.json, scene/layers.json, scene/life.json,
   scene/build.json: check each is never fetched by game/ or studio/). Make it skip those, regenerate
   studio/art-code-refs.json, run `node tools/art-unused.mjs`: the audit's recount found 40 of the 57 PNGs in
   game/art/scene/props/layers/ (20 tree and bush pairs, 189 KB) named only by layers.json. Delete them with their keys
   in layers.json. Separately (art-unused covers pictures only), 53 of the 76 game/art/scene/vox/*.json recipes are
   named by nothing (30 of those props have low-poly models now, 12 props are gone, 11 have no model): grep each
   name, delete. Then `node tools/art-unused.mjs --check`: 0 unused, 0 missing; update the art tests' counts.
4. **The test map:** game/data/maps/test_props_city.json ("city opening mockups, provisional"; its builder went in PR
   #283) and its line in game/data/index.json (a live branch edits index.json elsewhere: check the distance);
   tools/test/check-data-snapshot.test.mjs.snapshot if its file count changes.
5. **.gitignore**: drop `validation/rooms/` and `validation/st3/` (nothing writes them); add `validation/look-air/`,
   `validation/look-opening/`, `validation/look-run-screens/` (those tools' default output), `island-shots/` and
   `look-worldmap/` (island-shots.py and look-worldmap.py write at the repo root), `tools/art-source/sketches/` (lane
   S's bake export). Add them inside the existing blocks, not at the end (live branches append there). The rewrite to
   `validation/*` plus `!validation/{cc0-src,icon-sheets,sound-baseline,ui-gallery}/` waits for round 2.
**Kept, with the reason** (the HANDOFF entry repeats this list so nobody re-audits it): every chained generator
(build-scene-props runs scene_props_v17..v28 with exec; build-props-a04 loads build-buildings-v46; the batch files
load each other; build-props-island is loaded by eight tools; the owner's 2026-10-27 call keeps the version-stamped
ones), build-solarpunk.py (its pictures half redraws committed solar props), mark-cottage-roofs.py (the owner kept it
on 2026-10-27), every look-*.py (all documented or named in HANDOFF; cheap), tools/art-source/part-kit/ (10.8 MB: CI
and sheet-slice-real.test.mjs read it), tools/art-source/terrain-v47/README.md, validation/cc0-src/ (glb-to-recipe,
the model import test and check-fast read it; moving it touches check-fast.py, live on 3 branches),
validation/icon-sheets/ (the perks track remakes them each session), validation/sound-baseline/ and ui-gallery/
(check baselines).

## 6. Round 2: close-out (one session, alone, after the four lanes have pushed)
1. Start as section 3 says; read the four lanes' HANDOFF entries ("For round 2").
2. Re-run the live-branch check, then do what section 7 lists whose blocker is gone: the music step (lane S's
   recipe), ART-NOTES.md -> docs/ART.md (and the look skill, ui-track.md, perks-track.md pointers), the .gitignore
   rewrite, eslint.config.js's ignore line, style-track.md to the archive (with its code comments), the Studio plan's
   code pointers, ROADMAP's row for 07, and whatever the lanes deferred.
3. docs/BRANCHES.md: the rows of branches gone from GitHub (32 of 89 on 2026-10-28, e.g. `sound`, `RL-10b`,
   `tools/rl-1-renames`), only where no live hunk is near; a row for `track/cleanup`'s state.
4. A dead-path check over every current doc (repo paths and file names that don't exist, history files excepted);
   fix or list.
5. The checks of section 9, the full quick check included; ROADMAP's CU row; the HANDOFF entry; the PR marked ready.
   Anything still blocked stays in section 7 with its blocker for a later session (CU-3). When nothing is left: the
   owner tags `cleanup-done` and the branch goes (docs/BRANCHES.md).

## 7. Waiting (blocked items and what unblocks them)
Re-checked in round 2 (2026-10-29, after main took #331 VFX, #322 Dialogue, #308, #291 and #327). Done then:
ART-NOTES.md -> docs/ART.md, style-track.md to the archive with its code comments, ROADMAP's 07 and Camera rows and
lane S's link, 30 gone branches' rows, `validation/st3/`, the deferred pointers. #291's merge kept
docs/samples/perk-icons.* deleted. Live now: track/characters (with #314), track/sound (#292), track/roster. Still
waiting:

| Item | Lane | Waits for |
|---|---|---|
| The music step: 40 names, the marker, its tests, schemas, docs; then the guard's MUSIC and MUSIC_LINES go | S | track/sound (#292) merged into main (the VFX move sounds are in) |
| .gitignore: drop `validation/rooms/`, then the rewrite to `validation/*` with exceptions | T | track/characters merged (its line after `validation/fast/` is within 3 lines) |
| eslint.config.js's `tools/art-source/` ignore (its comment names the deleted portrait prototype) | T | track/characters merged |
| HANDOFF.md's header line (it asks for a `phase-NN-done` tag) | D | no live branch inserting at HANDOFF's top (track/characters and track/sound do) |
| BRANCHES: the rows of `ccr-c0505a05-bzef90` and `ccr-3df446bb-9jvdvq` (gone from GitHub); the two style rows' path into docs/archive/tracks/ | round 2 | track/characters merged (its row insertion is next to them) |

## 8. Not in this track
- **Code that keeps old saves loading** (saves older than format 5, which `loadSave` already refuses):
  logic/run-state.js, logic/unlocks.js, logic/saves.js, person-art.js `lookFromOld` (also used for old people data),
  logic/rules.js. CLAUDE.md lets it go, but it is a behaviour change in files live branches edit: a later session.
- **A wrong credit in the Studio's builder map**: it credits scene/life/*.png to build-life-v47, which draws nothing
  (scene_props_v17/v27 through build-scene-props, and build-bureau-forms, draw them); art-search.test.mjs asserts it.
  A bug, not clutter; art-search.js is live on 5 VFX branches.
- VISION.md's words, CHANGELOG's shape, Git LFS, moving tools/test/ or docs/phases/, renaming the version-stamped
  generators, the game AI's names, deleting stale branches (the owner's Repo admin workflow).

## 9. Checks
- **Every lane**: the after-edit hook after each change; before its last push `npm run lint`, `npm run typecheck`,
  `npm test`, `npm run check:modules`, `npm run format:check`, `npm run check:data`, `npm run build`; numbers in the
  HANDOFF entry.
- **S**: each rename's `verify`; sketch-art.test.mjs (the committed bake), pixel-density, rig-swap and
  kit-bake-parity tests; `npm run check:smoke`; `python3 tools/check-studio-github.py
  --only=sections,studio_test,art_browser`; the guard test; the final grep.
- **D**: the dead-path counts before and after; version-source.test.mjs; every moved or deleted path grepped to zero
  live mentions.
- **R**: version-source.test.mjs; `git add --renormalize .` changes nothing; `npm run build`.
- **T**: `node tools/art-unused.mjs --check` (0 unused, 0 missing); `npm run check:smoke`; check-data's snapshot.
- **Round 2**: all of the above on the merged branch, `npm run test:slow`, and the full quick check
  (`npm run check:quick`, about 21 minutes).
- **For the owner on the phone** (after the merge): start a run (a region may be called "Untitled ..."); win the
  Bureau boss and look at a salvage card (no "Placeholder art."); in the Studio, Part mode on a sketch Billie ("Sketch
  Billie"), Genes' cards, the Model drop zone, a Billie's Cry card (plain names).

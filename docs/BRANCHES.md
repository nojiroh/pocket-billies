# Branches

What each branch on GitHub is for. Written 2026-10-21 in a clean-up session; update it when a branch is added or merged.

## Naming and long plans

Every new branch has a name that says what it holds. A plan that takes more than one session lives on **one** branch
for its whole life, and every session of that plan works on that branch.

| Kind | Name | Lives | Example |
|---|---|---|---|
| The game | `main` | always | |
| The old build | `legacy` | always, reference only | |
| A plan that takes several sessions (a track or a long phase) | `track/<plan>`, `<plan>` = the plan file's name without `-track.md` or `.md` | until the plan is done | `track/sound` (docs/phases/sound-track.md) |
| One session's work, not part of a plan | `<area>/<what>`, area one of `fix`, `tools`, `docs`, `art`, `props`, `studio` | until its PR merges | `fix/battle-hp-bar` |
| The Studio's "Propose changes" | `studio/<login>-<YYYYMMDDHHMM>` (made by the Studio) | until its PR merges | |
| Parked work | `archive/<what>` | until you delete it | `archive/phase-17-robots` |

Lowercase, digits and dashes, one `/`. `claude/<words>` and `ccr-<id>` names are given to a session automatically:
they say nothing about the work, so plan work never stays on one. Names are internal; player-facing words don't change.

### How a long plan stays on its branch
1. **Planning session.** The plan file says which branch it lives on, in a line under its title:
   `Branch: track/<plan>`. The branch starts from main; the owner makes it (GitHub: the branch menu, type the name,
   "Create branch") and starts the planning session on it, so the plan file is written there.
2. **Every later session of the plan is started on that branch.** A cloud session can only push to the branch it was
   started on (the git proxy refuses any other, HTTP 403). So it can't move its work to the right branch itself.
3. **At the start of a session** (in the plan, before any edit): check `git branch --show-current` against the plan
   file's `Branch:` line. If they differ, say so and stop: don't start the plan's work on another branch. Then merge
   main into the branch (a merge, not a rebase: other sessions' clones stay valid) and push.
4. **Milestones go to main by pull request** from `track/<plan>`, merged with a merge commit (not squash, so the next
   merge has no conflicts). After the merge **the branch stays**: don't press "Delete branch", and keep GitHub's
   "Automatically delete head branches" off, since it would delete the branch on every merge. The Repo admin workflow
   never deletes `track/*`.
5. **Each session's HANDOFF entry** names the branch and the session's part of the plan (e.g. `SND-6`). The tag
   `<id>-done` marks where each part ended.
6. **When the plan is done** (its file and ROADMAP say so, the last PR is merged): tag `<plan>-done`, then delete the
   branch by hand on GitHub's Branches page. Unfinished work that is being parked goes to `archive/<plan>` instead.

The branches made before this rule (`sound`, `RL-10b`, `terrain-generation`, `CAM*`, `claude/sr-*`, ...) keep their
names until their plans end: renaming a branch breaks the sessions working on it. A plan that starts after
2026-10-23 uses `track/<plan>`.

## Keep

| Branch | What it is |
|---|---|
| `main` | The game. |
| `terrain-generation` | Terrain track: TR-3 (the camera on tall ground) merged as PR #108; restarted from main for TR-2c part 1 (grass patches, dust puff, 2026-10-22); part 2 (road pathfinder, the four mountain route types) next. |
| `legacy` | The old build (Net Worth v47.x / alpha 0.5), reference only (CLAUDE.md). The `legacy` tag is missing on GitHub: only `Baseline` is there. |
| `ui/ui-3-studio-section` | UI track UI-3a/3b: the Studio's UI section (look preview, real screens, inspect, overlays). Was `ccr-dc41c006-00p8dj`. |
| `terrain/tr-1-roads` | Terrain TR-1: road gradient cap and switchbacks (includes the mapgen terrace move). Was `ccr-be1fe0b2-8j7yqr`. |
| `studio/st-t-followup` | Studio self-test follow-up after PR #83, and the `test_battle` scene for the Battle preview. Was `ccr-f4c5aa48-ofajfu`. |
| `tools/rl-1-renames` | RL-1 tools follow-up: version-stamped tools renamed, legacy generators moved to tools/legacy/. 135 commits behind main: needs a merge. Was `ccr-a09a396b-vfdptc`. |
| `props/placement-rotation` | Phase 09 batch 9 part 1, turned props (PR #80, open). |
| `props/flat-sizes` | Flat plant variants and the map generator picking them (PR #90, open). |
| `design/expedition-punk-prototype` | Standalone UI prototype ("Hollow Signal" shell). Not wired into the game. |

## Archive (unmerged work from before the roguelite pivot, kept but parked)

| Branch | What it is |
|---|---|
| `archive/phase-17-robots` | Phase 17: robots battling in the Billie system, balance sim (includes the phase 17 plan). ~3,400 lines never merged. |
| `archive/phase-20-c1-walk-perf` | Phase 20 stage C-1: walk view reuses buffers per frame. |
| `archive/phase-20-c3-lamp-shadows` | Phase 20 stage C-3: steady lamp shadows, light picking. |
| `archive/debug-log-autosend` | Phase 13 part: send debug logs automatically, firebase reader. Check against CLAUDE.md's no-save-data rule before reviving. |
| `archive/debug-opening-hitch` | Debug log names the opening hitch (ground build, walk grid, read back). |
| `archive/plan-engine-19-21` | Docs: engine phases 19-21 plan. |
| `archive/roadmap-whats-left` | Docs: the old "what's left" roadmap (phases A-E). |
| `archive/codex-playable-ui-graphics-poc` | The old Codex UI/graphics prototype on alpha 0.5 (pre-rewrite history). `codex/playable-ui-graphics-poc` is the same commit. |
| `archive/st-4-check-fix` | ST-4 HANDOFF entry and a Studio check fix for Part mode. |

## To delete

Sessions can't delete branches or push tags through git (the git proxy only allows the session's own branch, HTTP 403). They use the **Repo admin** workflow instead (.github/workflows/repo-admin.yml: Actions -> Repo admin -> Run workflow): `delete-branches` never touches main, legacy, archive/* or a branch with an open pull request, and writes each deleted branch's last commit in the run summary; `create-tag` makes `legacy` or `<name>-done` tags and never moves one. Both have a dry run, on by default. The owner can still run the commands below by hand. The commit id is kept so any branch can be brought back: `git push origin <id>:refs/heads/<name>`.

### 1. Already in main (nothing lost)

| Branch | Last commit | |
|---|---|---|
| `ccr-00069345-2zok4t` | `3c14da1369` | merged |
| `ccr-ad41ba43-cf2age` | `842c5b2d6e` | merged |
| `ccr-901f764c-bv0rc7` | `007da2ad2a` | merged |
| `ccr-e32acdb2-oy1bny` | `0fe459cba0` | merged |
| `fix/build-studio-self-test` | `ae82b82770` | merged |
| `claude/ui-track-plan` | `29834ca5e9` | merged |
| `claude/new-session-qv8ou7` | `f100cff024` | merged |
| `studio/billie-library-picker` | `f71b64cb13` | merged |
| `fix/parts-back-view-hp` | `797c342510` | merged |
| `studio/nojiroh-202610201129` | `8971bddda5` | merged |
| `ccr-7e655ca9-42xt31` | `10ce375b0f` | merged |
| `ccr-a79debb1-atq7zs` | `4f05ca0943` | merged |
| `ccr-c6b168b6-nas45y` | `f4ece5b332` | merged |
| `world-map-fix` | `92dc9f17fd` | merged |
| `world-map-look-5` | `8d455184cd` | merged |
| `ccr-30e59e06-8e7dt1` | `17088af6b4` | merged |
| `world-map-look-2` | `3a9ee97d34` | merged |
| `project-story-city` | `272b65868f` | merged |
| `ccr-463855ac-a1e06r` | `05c7df466d` | merged |
| `project-story-opening` | `5dcd561e02` | merged |
| `world-map-terrain` | `ae973630c5` | merged |
| `ccr-aa8542b9-r8vfua` | `97fd8fdd70` | merged |
| `world-map-touch-fix` | `5957b4e73a` | merged |
| `world-map-bowl-plan` | `9540975523` | merged |
| `claude/busy-edison-qm2u0l` | `aeb3057a39` | merged |
| `phase-09-batch8-city-mockups` | `d9852ad853` | merged |
| `ccr-9d72271f-j72y94` | `cd4089284d` | merged |
| `ccr-756c70ed-eny79z` | `c2ab3b31f8` | merged |
| `ccr-4fc4790e-8depsm` | `6c4664f916` | merged |
| `ccr-f321762c-zuw15s` | `731661cdb2` | merged |
| `phase-06-4` | `f6b2ac3adc` | merged |
| `ccr-ca9ccdfe-oyecc9` | `2023aada6c` | merged |
| `phase-07-portraits` | `2d6a299de5` | merged |
| `props-finish` | `7da9ae9ecb` | merged |
| `props-marigold` | `5dbf1c6c3e` | merged |
| `project-story` | `93a04f9654` | merged |
| `props-batch-2` | `36de5a09c8` | merged |
| `claude/new-session-gkqvtr` | `3e66fed387` | merged |
| `ccr-72e8ad56-lpn1x3` | `409f33b1cf` | merged |
| `props-cottage-airship` | `99d0da9246` | merged |
| `graphics-bench` | `858d4828b3` | merged |
| `phase-06-3` | `a7e7da0d33` | merged |
| `phase-06-2b-opening` | `f667d358bc` | merged |
| `phase-06-2-cards` | `b1c6844436` | merged |
| `props-batch-1` | `5ad04caf3b` | merged |
| `phase-06-1-foundation` | `9d7cf5611d` | merged |
| `claude/project-thread-yec5ca` | `1eda591bd5` | merged |
| `ccr-2e47d81f-5hmicj` | `d991d0b823` | merged |
| `phase-16-billies-rework` | `c08b14d198` | merged |
| `props-buildings` | `113d989cc2` | same changes already in main (merged another way) |
| `world-map-look` | `c715c43f43` | same changes already in main (merged another way) |
| `world-map-look-3` | `c300e55f6e` | same changes already in main (merged another way) |
| `world-map-look-4` | `ad9d1ac145` | same changes already in main (merged another way) |

### 2. From before the history rewrite (no shared history with main)

| Branch | Last commit | |
|---|---|---|
| `ccr-cf517ce3-cgugzl` | `f53cf009f8` | pre-rewrite |
| `ccr-5f324dee-5mgqdn` | `5c330e2190` | pre-rewrite |
| `ccr-28344a6d-3lan40` | `336e55cb23` | pre-rewrite |
| `ccr-cadb30d4-ylw1rb` | `12a3b5882c` | pre-rewrite |
| `ccr-e2d01bf2-enqqxw` | `0c6231893e` | pre-rewrite |
| `roadmap-new-order` | `5b5dd1be4b` | pre-rewrite |
| `ccr-e40913e5-t0x9sl` | `11351c825a` | pre-rewrite |
| `claude/start-04c-99dqxx` | `15f1cae93c` | pre-rewrite |
| `ccr-919fc88c-7fwq9o` | `7b58c84cf2` | pre-rewrite |
| `ccr-3ecc9e0d-kht521` | `2f33145b9d` | pre-rewrite |
| `ccr-e3377747-102zkt` | `4423b28eb0` | pre-rewrite |
| `ccr-930478ad-i2zv7w` | `1a116b5113` | pre-rewrite |
| `ccr-de810ad2-0l0gvs` | `821edcdc38` | pre-rewrite |
| `claude/new-session-ys8na9` | `406ad30575` | pre-rewrite |
| `codex/playable-ui-graphics-poc` | `553ebf7d49` | pre-rewrite |

### 3. Superseded or copied to a new name

| Branch | Last commit | Why |
|---|---|---|
| `ccr-6af12a30-kpc5m1` | `77ea970087` | inside terrain/tr-1-roads |
| `claude/ui-3-start-3q234o` | `3efb86a344` | UI-3a HANDOFF entry is on ui/ui-3-studio-section |
| `ccr-c4c4609f-eqjopt` | `c6f591d605` | main has the RL-3 entry |
| `claude/rl-1-start-enwmnf` | `fed3d0cb53` | 3-line HANDOFF note on RL-1's base check |
| `ccr-7908554c-m7ed0w` | `c0fd278b7b` | MG-1 HANDOFF entry (main mentions MG-1; entry not merged) |
| `ccr-d452250e-2z8ocr` | `69259e219e` | ST-1 HANDOFF note |
| `ccr-3a403694-qsnzxg` | `5a7a1368de` | 08b-1 HANDOFF entry, pre-pivot |
| `ccr-24f4b29c-s6oe4h` | `ccdb659d8d` | 08a-2 / phase 06 plan, pre-pivot |
| `docs/phase-06-plan` | `98009fd6a1` | inside ccr-24f4b29c |
| `phase-17-plan` | `6fbfcc44cc` | inside archive/phase-17-robots |
| `phase-17-robots` | `40eaecad58` | copied to archive/ |
| `ccr-9b6f14fb-6t1w6i` | `719d8321c7` | copied to archive/ |
| `claude/confident-bardeen-ipoyjg` | `08bea27163` | copied to archive/ |
| `claude/vibrant-feynman-j50n6s` | `ce8d601793` | copied to archive/ |
| `ccr-30639e76-07ekma` | `9c09faf62e` | copied to archive/ |
| `plan/engine-phases-19-21` | `8260a03e58` | copied to archive/ |
| `roadmap-whats-left` | `aea26f2806` | copied to archive/ |
| `ccr-c07e2274-g01cko` | `6023df616a` | copied to archive/ |
| `fix/test-boot-opening` | `e96958999b` | pre-pivot: test boot opens on the old opening cutscene; the rest is pre-rewrite history |

### 4. Old names of the current work (delete once their sessions are finished)

| Branch | Last commit | New name |
|---|---|---|
| `ccr-dc41c006-00p8dj` | `5ac1de2d7c` | ui/ui-3-studio-section |
| `ccr-be1fe0b2-8j7yqr` | `bcf2951fe5` | terrain/tr-1-roads |
| `ccr-f4c5aa48-ofajfu` | `4baaf83a4d` | studio/st-t-followup |
| `ccr-a09a396b-vfdptc` | `580d2df312` | tools/rl-1-renames |

## Commands

Groups 1-3 (safe now):

```sh
git push origin --delete \
  ccr-00069345-2zok4t \
  ccr-ad41ba43-cf2age \
  ccr-901f764c-bv0rc7 \
  ccr-e32acdb2-oy1bny \
  fix/build-studio-self-test \
  claude/ui-track-plan \
  claude/new-session-qv8ou7 \
  studio/billie-library-picker \
  fix/parts-back-view-hp \
  studio/nojiroh-202610201129 \
  ccr-7e655ca9-42xt31 \
  ccr-a79debb1-atq7zs \
  ccr-c6b168b6-nas45y \
  world-map-fix \
  world-map-look-5 \
  ccr-30e59e06-8e7dt1 \
  world-map-look-2 \
  project-story-city \
  ccr-463855ac-a1e06r \
  project-story-opening \
  world-map-terrain \
  ccr-aa8542b9-r8vfua \
  world-map-touch-fix \
  world-map-bowl-plan \
  claude/busy-edison-qm2u0l \
  phase-09-batch8-city-mockups \
  ccr-9d72271f-j72y94 \
  ccr-756c70ed-eny79z \
  ccr-4fc4790e-8depsm \
  ccr-f321762c-zuw15s \
  phase-06-4 \
  ccr-ca9ccdfe-oyecc9 \
  phase-07-portraits \
  props-finish \
  props-marigold \
  project-story \
  props-batch-2 \
  claude/new-session-gkqvtr \
  ccr-72e8ad56-lpn1x3 \
  props-cottage-airship \
  graphics-bench \
  phase-06-3 \
  phase-06-2b-opening \
  phase-06-2-cards \
  props-batch-1 \
  phase-06-1-foundation \
  claude/project-thread-yec5ca \
  ccr-2e47d81f-5hmicj \
  phase-16-billies-rework \
  ccr-cf517ce3-cgugzl \
  ccr-5f324dee-5mgqdn \
  ccr-28344a6d-3lan40 \
  ccr-cadb30d4-ylw1rb \
  ccr-e2d01bf2-enqqxw \
  roadmap-new-order \
  ccr-e40913e5-t0x9sl \
  claude/start-04c-99dqxx \
  ccr-919fc88c-7fwq9o \
  ccr-3ecc9e0d-kht521 \
  ccr-e3377747-102zkt \
  ccr-930478ad-i2zv7w \
  ccr-de810ad2-0l0gvs \
  claude/new-session-ys8na9 \
  codex/playable-ui-graphics-poc \
  ccr-6af12a30-kpc5m1 \
  claude/ui-3-start-3q234o \
  ccr-c4c4609f-eqjopt \
  claude/rl-1-start-enwmnf \
  ccr-7908554c-m7ed0w \
  ccr-d452250e-2z8ocr \
  ccr-3a403694-qsnzxg \
  ccr-24f4b29c-s6oe4h \
  docs/phase-06-plan \
  phase-17-plan \
  phase-17-robots \
  ccr-9b6f14fb-6t1w6i \
  claude/confident-bardeen-ipoyjg \
  claude/vibrant-feynman-j50n6s \
  ccr-30639e76-07ekma \
  plan/engine-phases-19-21 \
  roadmap-whats-left \
  ccr-c07e2274-g01cko \
  props-buildings world-map-look world-map-look-3 world-map-look-4 fix/test-boot-opening
```

Group 4 (after the UI-3, TR-1, ST-T and RL-1 sessions are done; check first that each old name still points at the same commit as its new name, or a session pushed more):

```sh
git push origin --delete ccr-dc41c006-00p8dj ccr-be1fe0b2-8j7yqr ccr-f4c5aa48-ofajfu ccr-a09a396b-vfdptc
```

Tags still waiting to be made (with the Repo admin workflow, or from your machine; see HANDOFF): `legacy`, `phase-04-done`, `phase-05-done`, `rl-1-done` .. `rl-5-done`, `ui-2-done`, the `st-N-done` tags.

Keep GitHub's Settings > General > "Automatically delete head branches" off: it would also delete a `track/*` branch
each time one of its pull requests merges. Merged one-session branches are cleared with the Repo admin workflow instead.

# Branches

What each branch on GitHub is for. Written 2026-10-21, cleaned up 2026-10-23; update it when a branch is added or merged.

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

Updated 2026-10-23 after the clean-up (157 branches down to 22). The deleted branches' last commits are in the Repo
admin runs' summaries (Actions -> Repo admin), so any of them can be brought back.

| Branch | What it is |
|---|---|
| `main` | The game. |
| `legacy` | The old build (Net Worth v47.x / alpha 0.5), reference only (CLAUDE.md). Tag `legacy` on 0314a22. |
| `sound` | Sound track. SND-6 (cries, UI sounds, jingles, the mix, the Studio's Sounds tab) is here, 13 commits, **not merged into main** and with no pull request. |
| `RL-10b` | RL-10b, Ranch B second half (PR #144, open). |
| `ccr-9023a485-qr0fhf` | Project Story: Professor Chosen replaces Hazel (PR #142, open). |
| `ccr-305ae8d3-6ivodu` | UI track UI-7b (14 commits, no pull request yet). |
| `track/encounters` | Encounter sessions of the roguelite track (RL-12b's two parts, then RL-12c held items; roguelite-track.md 9.4): RL-12b part 1 (events, reward picks, route trainers) done 2026-10-23; part 2 (waystations, stalls, no two shops) done 2026-10-24. RL-12c (held items) was built on `claude/project-thread-ka73c4` from main (2026-10-25, the owner's answer: a cloud session pushes only to its own branch; this one was merged into main). |
| `track/expeditions` | RL-13 of the roguelite track (Expeditions I-V, challenges, starter points, leader teams; roguelite-track.md 9.4): made from main 2026-10-24 at the owner's word. |
| `track/story` | Story sessions of the roguelite track (RL-S1, RL-S2; roguelite-track.md 9.4): made from main 2026-10-25 at the owner's word. RL-S1 (story director: run history, banter.json, the hub's lines, the lost run's scene) done 2026-10-25. |
| `track/regions` | Region sessions of the roguelite track (RL-R1, RL-R2; roguelite-track.md 9.4): RL-R1 (region generator) done 2026-10-23, merged; RL-R2a (side areas, field moves, the deadline dropped) done 2026-10-23, merged (PR #176); RL-R2b (a cave, an islet town, the way-out moment, side areas in the Run Lab, preview and sim) done 2026-10-24, PR open. |
| `track/roster` | Roster track (RO-1, RO-2..; roguelite-track.md section 9.4): every RO session works here. RO-1 (forms, biome pools) done 2026-10-23. |
| `track/reflavour` | Reflavour track (docs/phases/reflavour-track.md): RF-1..RF-6 work here; RF-2 (pyramids) pushed 2026-10-23. |
| `track/towns` | Towns track (docs/phases/towns-track.md): TW-1..TW-3 (town layout, townsfolk, run quests) work here. TW-1 (the town layout) done 2026-10-24. |
| `track/routes` | Routes track (docs/phases/routes-track.md): RT-1..RT-4 (route layouts, trainers, set pieces, Billies and finds) work here. |
| `track/test-cleanup` | Test clean-up track (docs/phases/test-cleanup-track.md): every lane of TC-1..TC-4 works here; round 1 in PR #155. |
| `terrain-generation` | Terrain track: TR-2c part 1 merged; one leftover HANDOFF note on top. Part 2 next. |
| `terrain/tr-1-roads` | Terrain TR-1: road gradient cap and switchbacks. Not merged. |
| `ccr-be1fe0b2-8j7yqr` | The TR-1 session's own branch: 9 commits not in main, 4 of them not in `terrain/tr-1-roads` either (MAPGEN_VERSION 3, stairs, walls). Check against `terrain/tr-1-roads` before deleting. |
| `studio/st-t-followup` | Studio self-test follow-up after PR #83, and the `test_battle` scene. Not merged. |
| `tools/rl-1-renames` | RL-1 tools follow-up: version-stamped tools renamed, legacy generators moved to tools/legacy/. Not merged; far behind main. |
| `design/expedition-punk-prototype` | Standalone UI prototype ("Hollow Signal" shell), PR #76 closed unmerged. Not wired into the game. |

## Archive (unmerged work from before the roguelite pivot, kept but parked)

| Branch | What it is |
|---|---|
| `archive/phase-17-robots` | Phase 17: robots battling in the Billie system, balance sim (includes the phase 17 plan). |
| `archive/phase-20-c1-walk-perf` | Phase 20 stage C-1: walk view reuses buffers per frame. |
| `archive/phase-20-c3-lamp-shadows` | Phase 20 stage C-3: steady lamp shadows, light picking. |
| `archive/debug-log-autosend` | Phase 13 part: send debug logs automatically, firebase reader. Check against CLAUDE.md's no-save-data rule before reviving. |
| `archive/debug-opening-hitch` | Debug log names the opening hitch (ground build, walk grid, read back). |
| `archive/plan-engine-19-21` | Docs: engine phases 19-21 plan. |
| `archive/roadmap-whats-left` | Docs: the old "what's left" roadmap (phases A-E). |
| `archive/codex-playable-ui-graphics-poc` | The old Codex UI/graphics prototype on alpha 0.5 (pre-rewrite history). |
| `archive/st-4-check-fix` | ST-4 HANDOFF entry and a Studio check fix for Part mode. |

## Clean-up of 2026-10-23
- Deleted: every branch whose commits were all in main (including old session names, merged tracks such as `CAM*`,
  `claude/is-*`, `claude/sr-*`, and pre-rewrite branches); exact copies of an `archive/*` branch or of a renamed
  branch; branches whose changes were already in main by other commits; and 12 branches that held only a leftover
  HANDOFF or ROADMAP note from a finished session (`ccr-0f465f3f`, `ccr-28344a6d`, `ccr-3a403694`, `ccr-7908554c`,
  `ccr-86f70f38`, `ccr-c4c4609f`, `ccr-d452250e`, `claude/dazzling-darwin-jvooys`, `claude/great-hamilton-bj2wsa`,
  `claude/rl-1-start-enwmnf`, `claude/ui-3-start-3q234o`, `roadmap-new-order`) and the pre-rewrite CI tweak
  `ccr-930478ad`.
- Tagged: `legacy`. Other tags still waiting (with the Repo admin workflow; see HANDOFF for each commit):
  `phase-04-done`, `phase-05-done`, `rl-1-done` .. `rl-5-done`, `ui-2-done`, the `st-N-done` and `snd-N-done` tags.

Keep GitHub's Settings > General > "Automatically delete head branches" off: it would also delete a `track/*` branch
each time one of its pull requests merges. Merged one-session branches are cleared with the Repo admin workflow instead.

# Roadmap

The game is being reworked into a roguelite: a hub (Copperleaf Town) and runs on a generated node map, with the
walkable world, the seamless maps and the rooms kept (docs/VISION.md, "How the game plays"). The plan is
docs/phases/roguelite-track.md (approved 2026-10-20). That track is the spine of this roadmap; the Studio, Map
generator and Project Story tracks run alongside; the old numbered phases are listed below as done, parked or
absorbed. Every session starts in Plan Mode, follows docs/TESTING.md, and ends with a docs/HANDOFF.md entry and a
tag (`rl-N-done`, `st-N-done`, `mg-N-done`). Sessions can't push tags: the owner pushes them. Work-time estimates
are sessions of Claude's working time, not calendar time, and exclude the owner's testing.

## The roguelite track (RL)

| # | Session | Goal | Depends on | Sessions | Playable |
|---|---|---|---|---|---|
| RL-1 | Hardening (done 2026-10-21, tools question open) | Studio token options, versioned tools, stale docs, the set-aside key bug, PR #78 verified, RNG facts written down | none | 1 | no |
| RL-2 | Golden record and RNG module (done 2026-10-21) | a battle golden snapshot; `logic/rng.js` (mapgen's seeded generator moved); seeded `pickWeighted`/`spawn` | RL-1 | 1 | no |
| RL-3 | State separation (done 2026-10-21) | SAVE_VERSION 4; `meta`, `run`, `ranch` in the save; validators; `migrate` keeps a run's trip | RL-2 | 1 | no |
| RL-4 | Battle state injected (done 2026-10-21) | phase 19's core: engine context, no save writes, a silent host, `b.rng`, a turn cap | RL-2 | 1-2 | no |
| RL-5 | Legacy parking and the world setter (done 2026-10-21) | the other maps and places under `game/data/legacy/`; `worldSetGraph`; fixtures and checks retargeted | RL-3 | 1-2 | no |
| MG-2 | Seam agreement in mapgen (+ TR-1 smooth roads) | generated parent/child scenes pass the seam rules; roads ramp with no risers | none | 1-2 | no |
| RL-6 | Run map and clock logic (done 2026-10-21) | `logic/run-map.js`, `nodeTypes.json`, forecast, deadline; no UI | RL-3, MG-2 | 1 | no |
| RL-7 | Run world (done 2026-10-21) | generated scenes installed and walkable; the bowl shows the run | RL-5, RL-6 | 1-2 | no |
| RL-8 | Run loop and payout (done 2026-10-21) | airship start, a town with paid healing, a mini-boss, the payout screen, resume: **the first playable cut** | RL-4, RL-7 | 2 | yes |
| RL-8b | Run look (done 2026-10-22) | the owner's notes from the first play: rooms darker, the hub's world map Copperleaf's island alone, a run's own world map from its seed, laid across the bowl east to west | RL-8, played | 1 | yes |
| RL-9 | Ranch A | the building, store and keep, train between runs, the keep-one rule | RL-8, played | 2 | yes |
| RL-10 | Ranch B | breed safe/risky with abominations, hatch, passive income (cap, rollback guard, offline, server anchor) | RL-9 | 2 | yes |
| RL-11 | Hub upgrades, currencies, unlocks | `currencies/buildings/unlocks.json`, the Lab board, one unlock registry | RL-8 | 1-2 | yes |
| RL-12 | Relics and effects | `relics.json`, `events.json`, `logic/effects.js`, picks | RL-11 | 1-2 | yes |
| RL-13 | Modifiers, tiers, mini-boss leaders | `modifiers.json`, the bracket pick, the 8 leaders as the pool | RL-12 | 1 | yes |
| RL-14 | Bots as enemies, salvage, the Voltron | `factions.json`, `bosses.json`, data-driven `alphaPhase`, a robot phase in the full test | RL-13 | 2 | yes |
| RL-15 | Online | the run record, friend ghosts, daily seeds, rules and emulator tests | RL-14 | 2 | yes |
| RL-16 | Content packs and Studio editors | pack merge and checks, editors for the new sections | RL-11 | 1-2 | yes |

About 22-28 sessions in all; the first playable cut (RL-1..RL-8 plus MG-2) about 10-13. **Nothing after RL-8 starts
before the owner has played the first cut on the phone.** MG-3 (towns from the generator) joins the path when a
town node needs it.

## Tracks alongside
- **Studio track** (docs/phases/studio-track.md): ST-0..ST-6 done; ST-7 (Model mode import) next. Independent of the
  rework; the editors for the new data sections come with their sessions (RL-11..RL-16). Side session ST-T, the
  Studio self-test (docs/phases/studio-self-test.md, approved 2026-10-21): measure the Studio; fixes come after.
- **UI track** (docs/phases/ui-track.md, planned 2026-10-21): Semigloss Angular, the Studio's UI section and phase
  06's leftover. UI-1..UI-4 run beside RL-3..RL-7 (UI-4 before RL-7, so the run screens use the new parts); UI-5 and
  UI-6 after the RL-8 play test. Tags `ui-N-done`. UI-1 (theme as data, rules as a check) and UI-2 (kit v2, angular
  shapes, done whole, not split) done 2026-10-21; UI-3 split by the owner: UI-3a (the Studio's UI section, core) done
  2026-10-21; UI-3b (its tools) and UI-4 (the run parts, beside it at the owner's word) done 2026-10-21; UI-5 next, after the
  RL-8 play test.
- **Map generator track** (docs/phases/mapgen-track.md): MG-1 done; MG-2 is on the RL path (before RL-6), the
  roguelite version (seam agreement), with terrain TR-1 folded in; MG-3 when a town node needs it; MG-4 and MG-5
  after RL-8.
- **Terrain track** (docs/phases/terrain-track.md, the owner's brief 2026-10-21): smooth roads, mountains, height as
  gameplay, terrain features. TR-1 (smooth roads) is folded into MG-2, before RL-7; TR-2a (mountains as the border) and
  TR-2b (mountain trails) done 2026-10-21, after the Gen 3-5 route research; TR-2c next. Runs now go east to west (the
  owner, TR-2 session). TR-3..TR-7 alongside RL-9..RL-11
  after the first cut; the gameplay sessions TR-8..TR-11 wait for their RL parts. Tags `tr-N-done`.
- **Project Story** (docs/phases/project-story.md): S1-S3 and S7 done, S8 partly (RL-8: New game plays the fall only; the city's files stay).
  S6 (Hazel vs Blake as a real battle) is unblocked by RL-4; S4, S5 and S8's leftovers wait until the first cut has
  been played. RL-8 (the owner's answer): the opening is the fall only, Blake cut from it (his data kept), and Hazel's
  new lines send the player to the airship mast.

## The old phases (status from docs/HANDOFF.md, 2026-10-20)

No `phase-NN-done` tag was ever pushed; "done" means the HANDOFF entry says the work is finished.

| # | File | Status | In the rework |
|---|---|---|---|
| 00 | 00-finish-current-work | done (`Baseline` is the one tag on GitHub) | keep |
| 01 | 01-baseline-and-bug-fixes | done | keep |
| 02 | 02-security | done; the Studio token options A and B were left "ask before" | absorbed: RL-1 |
| 03 | 03-fresh-base-and-scope-reset | done; no picture baseline yet | keep |
| 04 | 04-modernize-codebase | done (04a-04e) | keep |
| 05 | 05-internal-renaming | done | keep |
| 06 | 06-ui-structure | mostly done (06-1..06-4); ui.js not split, old CSS layers not emptied | absorbed: UI-5 and UI-6 (docs/phases/ui-track.md); `phase-06-done` when UI-6 ends |
| 07 | 07-portraits | part 1 only (kit, slicer, portraits.json; nothing uses them) | parked: after the first cut is fun |
| 08 | 08-classic-movement-seamless-maps-rooms | 08a-1..3 and 08b-1..2 done; 08b-3 not | absorbed: the run world uses 08b's seam model; 08b-3 templates parked |
| 09 | 09-props-and-terrain | partly: Copperleaf, Route 1, Marigold and the city set redone | parked: the other towns are legacy; run biomes reuse the done kits |
| 10 | 10-world-map-bowl | done, waiting on the owner's phone look and the tag | absorbed: RL-7 makes the bowl show a run |
| 11 | archive/11-opening-sequence | moved to Project Story S7-S8; since RL-8 New game plays the fall only | absorbed: RL-8 (the fall only, Hazel's mast lines) |
| 12 | 12-ranch | not started | absorbed: RL-9, RL-10 |
| 13 | 13-testing-and-debugging | 13a done; 13b, 13c not | absorbed in part (fixtures for runs, RL-7/8); 13c parked |
| 14 | 14-studio | partly, through the Studio track | absorbed: editors come with their sections (RL-16) |
| 15 | archive/15-game-design-and-story | archived; the design half is the roguelite track; the story half is Project Story S4 | superseded |
| 16 | 16-billies-monster-system | prep and prototype part 1 (parts, 7 lines, Studio Parts) | absorbed: breeding and abominations in RL-10; the rest parked |
| 17 | 17-robots | prototype built, unapproved, untagged, debug-only | absorbed: RL-14 (bots as enemies, the Voltron); playable bots much later |
| 18 | 18-friend-trading-and-battles | not started | absorbed: RL-15 (ghosts, daily seeds); trading out of scope |
| 19 | 19-battle-core (branch `plan/engine-phases-19-21`) | plan only | absorbed: RL-2, RL-4 (core), RL-12 (effect handlers), RL-15 (replay) |
| 20 | 20-renderer-batching | stages A, B, C-1, C-2 done; C5 and stage D not | parked: when the phone numbers ask for it |
| 21 | 21-texture-atlases-and-ktx2 (branch `plan/engine-phases-19-21`) | plan only | parked: after phase 20 |

## If the scope is too big
RL-1, RL-2, RL-3, RL-4, RL-5, MG-2, RL-6, RL-7, RL-8, then play. After that: RL-9, RL-10, RL-11, RL-12, RL-13, RL-14,
RL-15, RL-16. Inside the ranch milestone cut the server timestamp first, then risky breeding, then the walkable yard;
never store/keep or training.

## Questions I want to be asked (do not decide these alone)
The 20 "Ask me before" items in docs/phases/roguelite-track.md, section 8: the run's internal key (RL-3); keep-one vs
ranch levels (RL-9); the hub's extent and Copperleaf's south exit (answered in RL-5: Copperleaf alone, its south exit gone); legacy by
moving files (answered in RL-5: moved to game/data/legacy, a read-only Studio list); currency
names and the building mapping (RL-11); menu nodes (RL-12); the first cut's shape (answered in RL-8: the full 9-row map); battle formats by node type
(answered in RL-8: wild single, mini-boss doubles, an Alpha boss; the turn cap was answered in RL-4: 40, a draw; a killed battle restarts from its seed); the clock's numbers (answered in
RL-6: a day per arrival, backtracking included, deadline = the shortest walk + 3, no tick for healing or waiting); the token link, Remember me and deleting the
versioned tools (RL-1); SAVE_VERSION 4 and the cloud key whitelist (RL-3, RL-10); the dex's place (RL-3); the relic
cap (RL-12); the hub island's look (answered in RL-5: the bowl shows Copperleaf alone; its sea share is set in the Studio); the ranch cut order (RL-9); the order after the first cut; the tuning
placeholders (RL-6 took the map's: 9 rows, 2 mini-bosses, two lanes on 70% of free and town rows, a lane switch on 25%
of lane pairs, the five biomes with finished plants; reveal the next row, '?' on the row after, the boss always; RL-7
took the scenes': dial ranges in `run.scene`, wild levels 3-5 on the landing +1 a row, 2 on a walk back, a crossing
counting 6 m in, a run kept across a new generator version, places named biome + type; the rest wait for their
sessions); pushing the tags; the opening (answered in RL-8: the fall only). New from the owner's first play (2026-10-21,
roguelite-track.md section 5): rooms too bright; routes wider than long (an HD-2D diorama); Copperleaf's world map its
island alone; a run's own world map generated from its seed. Still open from the old phases: phase 17's prototype
approval and ask list (RL-14), phase 16's breeding mode (RL-10),
phase 10's phone look, phase 06's 06-5.

## Where the old brief went
The old brief's numbering (phases 01-18 and their renames) is kept in the old phase files; the fresh-base vision is
docs/VISION.md. The roguelite plan supersedes the "design half" of phase 15 and the remaining order of phases 12,
16, 17 and 18.

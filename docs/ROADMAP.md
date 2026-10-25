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
| RL-8 | Run loop and payout (done 2026-10-21, played) | airship start, a town with paid healing, a mini-boss, the payout screen, resume: **the first playable cut** | RL-4, RL-7 | 2 | yes |
| RL-9 | Ranch A (done 2026-10-22: the building, training, Scrap; RL-9b the mast's pick of 1 home Billie and the packed bag) | the building, store and keep, train between runs, the keep-one rule (8.2: 1 home Billie a run; a packed bag) | RL-8, played | 2 | yes |
| RL-10 | Ranch B (RL-10a done 2026-10-22: breeding safe/risky, abominations and quirks, hatching at the ranch, the walking eggs retired; RL-10b done 2026-10-23: passive income, one ranch clock with the rollback guard, the cloud `t` anchor and skew, the saves whitelist) | breed safe/risky with abominations, hatch, passive income (cap, rollback guard, offline, server anchor) | RL-9 | 2 | yes |
| RL-11 | Hub upgrades, currencies, unlocks (done 2026-10-22) | `currencies/buildings/unlocks.json`, the Lab board, one unlock registry | RL-8 | 1-2 | yes |
| RL-12 | Relics and effects (RL-12a done 2026-10-22: effects, Loopholes, picks, shops; RL-12b next) | `relics.json`, `events.json`, `logic/effects.js`, picks | RL-11 (the owner: may go first, every Loophole on offer) | 1-2 | yes |
| RO-1 | Roster: real pools and regional forms (done 2026-10-23, branch `track/roster`) | every run pool lists real lines, no stand-ins; `forms` on lines | none (alongside) | 1 | yes |
| RL-R1 | Region generator (done 2026-10-23, branch `track/regions`) | a themed region per seed: zones on a biome graph, a regional dex, leaders by type, the region's name | RO-1 | 1-2 | yes |
| RL-R2 | Side areas and field moves (RL-R2a done 2026-10-23 on `track/regions`: detours and alternate paths, Surf, Rock Smash and Cut, `meta.badges`, the deadline dropped; RL-R2b done 2026-10-24: a cave biome for Rock Smash, an islet town for Surf, the way-out moment, side areas in the Run Lab, preview and sim) | detours and rare alternate paths behind Surf, Rock Smash and Cut (type + a kept badge) | RL-R1 | 2 | yes |
| RL-12b | Encounters (done 2026-10-24 on `track/encounters`: part 1 events, the reward pick, route trainers; part 2 waystations, stalls, no two shops) | `events.json` with options and requirements, waystations, reward picks after trainer battles, route trainers | RL-R1 | 2 | yes |
| RL-12c | Held items | one held-item slot per Billie (the owner's answer, 9.6 27): the data section, the slot in the save and the Team tab, effect rows at the battle hooks; the reward pick's `held` cards switched on | RL-12b | 1 | yes |
| RL-S1 | Story director | `meta.history`, `lines.json`, the hub's line pick, the return-from-a-loss scene | RL-12b | 1-2 | yes |
| RL-S2 | Rival and relationships | Blake as a rival node countering your starter, `meta.rel`, Chapter 1 | RL-S1 | 1-2 | yes |
| RL-13 | Expeditions, challenges, starter points (done 2026-10-24, branch `track/expeditions`) | `modifiers.json` Expeditions I-V, four challenges, starter points at the mast, leaders of their own type, the sim tuned to its first wins | RL-R2 | 1-2 | yes |
| RL-14 | The organization's bots, salvage, the Voltron | `factions.json`, `bosses.json`, data-driven `alphaPhase`, the bots as the organization's army | RL-13, RL-S1 | 2 | yes |
| RL-15 | Online | the run record, friend ghosts, daily seeds, rules and emulator tests | RL-14 | 2 | yes |
| RL-16 | Content packs and Studio editors | pack merge and checks, editors for the new sections | RL-11 | 1-2 | yes |
| RO-2.. | Roster: new lines (**done** 2026-10-24, branch `track/roster`: RO-2a Hughes, Kamprad, Cuban, Altman; RO-2b Yiming, Woods, Arnault; RO-2c Huang, five regional forms and a balance pass, 40 species) | from 24 to 40 species through the Studio's kit bake; plan in roguelite-track.md (RO-2.. plan) | RO-1 | 3 | done |
| RL-E | Endless mode | after online | RL-15 | 1 | yes |

**Restructured 2026-10-23** (roguelite-track.md section 9, the owner's answers): after RL-12a the order is the
table's from RO-1 down (region → encounters → story, then brackets, bots, online); RL-12b became Encounters. About
14-19 sessions after RL-12a plus the roster sessions. The original estimate: about 22-28 sessions in all; the first playable cut (RL-1..RL-8 plus MG-2) about 10-13. **Nothing after RL-8 starts
before the owner has played the first cut on the phone.** MG-3 (towns from the generator) joins the path when a
town node needs it.

## Tracks alongside
- **Routes track** (docs/phases/routes-track.md, the owner's brief 2026-10-24): run routes planned like a Pokémon
  route: RT-1 (layouts: forest masses, fences, 55-65% walkable, marked spots; done 2026-10-24), RT-2 (battle spots, 4-6 trainers,
  pairs), RT-3 (set pieces for a lived-in feel), RT-4 (more Billies, items, Cut shortcuts, animals). Tags `rt-N-done`.
  Branch `track/routes`.
- **Towns track** (docs/phases/towns-track.md, the owner's brief 2026-10-24): run towns that feel alive. TW-0 (walk
  out of any room's doorway; "Go outside" stays with the card closed) done 2026-10-24; TW-1 (a town layout: street,
  square, houses with gardens, mapgen's `town` kind) done 2026-10-24; TW-2 (townsfolk, animals, chat, named locals)
  done 2026-10-25; TW-3 (run quests paid at a later town's notice board with the reward pick) next, alongside RL-12b part 2 and RL-R2b. Tags
  `tw-N-done`. Branch `track/towns`.
- **Reflavour track** (docs/phases/reflavour-track.md, the owner's brief 2026-10-23): less finance, more Pokémon. The
  Billies stay billionaire clones; catching with pyramids, Perks (was Loopholes), Expeditions (was Brackets), Moneys,
  Research, Scrap and Crests, new type passives, internal renames one per commit, the new tone in the text, the new name Pocket B&B² (a raised B), the Bureau of Lost, Found and
  Beans. RF-1 and RF-2 before RO-1, RF-3 before RL-12b, RF-4 before RL-S1. Tags `rf-N-done`. Branch `track/reflavour`.
  RF-1 (the words players see), RF-2 (pyramids: names, icons, the 3D throw, its sounds) and RF-3 (type passives) done
  2026-10-23. RF-4 (internal renames, SAVE_VERSION 5) and RF-5 (the new tone in text) done 2026-10-23; RF-6 (the game's name) next.
- **Studio track** (docs/phases/studio-track.md): ST-0..ST-6 done; ST-7 (Model mode import) next. Independent of the
  rework; the editors for the new data sections come with their sessions (RL-11..RL-16). Side session ST-T, the
  Studio self-test (docs/phases/studio-self-test.md, approved 2026-10-21): measure the Studio; fixes come after.
- **UI track** (docs/phases/ui-track.md, planned 2026-10-21): Semigloss Angular, the Studio's UI section and phase
  06's leftover. UI-1..UI-4 run beside RL-3..RL-7 (UI-4 before RL-7, so the run screens use the new parts); UI-5 and
  UI-6 after the RL-8 play test. Tags `ui-N-done`. UI-1 (theme as data, rules as a check) and UI-2 (kit v2, angular
  shapes, done whole, not split) done 2026-10-21; UI-3 split by the owner: UI-3a (the Studio's UI section, core) done
  2026-10-21; UI-3b (its tools) and UI-4 (the run parts, beside it at the owner's word) done 2026-10-21; UI-5 (every screen
  onto the kit, one session at the owner's word, the bottom bar swapped) done 2026-10-22; UI-6 (old layers gone)
  next. UI-7 (settings and the debug menu made clearer, asked for by the owner 2026-10-23) in three steps: UI-7a
  (Sound: row mutes, a sound on release) done 2026-10-23; UI-7b (the settings tabs) done 2026-10-23; UI-7c (the debug menu) done 2026-10-23.
- **Map generator track** (docs/phases/mapgen-track.md): MG-1 done; MG-2 is on the RL path (before RL-6), the
  roguelite version (seam agreement), with terrain TR-1 folded in; MG-3 when a town node needs it; MG-4 and MG-5
  after RL-8.
- **Terrain track** (docs/phases/terrain-track.md, the owner's brief 2026-10-21): smooth roads, mountains, height as
  gameplay, terrain features. TR-1 (smooth roads) is folded into MG-2, before RL-7; TR-2a (mountains as the border) and
  TR-2b (mountain trails) done 2026-10-21, after the Gen 3-5 route research; TR-2c next. Runs now go east to west (the
  owner, TR-2 session). TR-3 (the camera on tall ground) done 2026-10-22 (PR #108). TR-2c split by the owner: part 1 (grass patches, wild Billies in any patch, the dust puff) done 2026-10-22; part 2 (the road pathfinder through tiers and the massif, the four mountain route types) next. TR-4..TR-7 alongside RL-9..RL-11
  after the first cut; the gameplay sessions TR-8..TR-11 wait for their RL parts. Tags `tr-N-done`.
- **Sound track** (docs/phases/sound-track.md, planned 2026-10-21): settings fixes, the tracker as data, a Studio
  section for music and cries, then a Pokémon-style rework (four voices, written hooks, battle intros, a cry per
  species). SND-1 to SND-3 beside RL-8; SND-4 to SND-6 after the RL-8 play test. Tags `snd-N-done`. SND-1 (settings
  and routing), SND-2 (the tracker as data, biome music in a run) and SND-3 (the Studio's Music & sound section, a cry
  per stage) done 2026-10-22; SND-4 (the themes: four voices, hooks answered, the motif, Copperleaf as Pallet Town,
  night versions; placeholder hooks for the owner to edit) done 2026-10-22 at the owner's word; SND-5 (battle and run
  music: intros timed to the throw, leader and boss songs, the red zone's tense version, the run's arc by row, the
  deadline version, the map song's forecast) done 2026-10-22; SND-6 (a cry per Billie from eight kinds with a low-HP
  cry, four UI sounds, jingles for the run's beats, the mix as data; every new sound a placeholder) done 2026-10-23.
  The track's planned sessions are done; what's next is the owner's listening pass.
- **Camera track** (docs/phases/camera-track.md, the owner's brief and answers 2026-10-22): a follow with dead and
  soft zones and a joystick look-ahead (CAM-1), zooms for moments of interest (CAM-2), a diorama tilt-shift blur with
  a player slider (CAM-3); each session brings its Studio dials and preview overlays. Runs now, beside the RL track.
  CAM-1 (the follow) done 2026-10-22 (PR #127); CAM-2 (moments of interest) done 2026-10-22 (PR #132); CAM-3 (the
  diorama blur) done 2026-10-22 (PR #134): the track is done. Tags `cam-N-done`.
- **Test cleanup track** (docs/phases/test-cleanup-track.md, planned 2026-10-23): make every check and test fit the
  roguelite game. TC-1 delete the outdated and useless ones, TC-2 rewrite the rest onto the hub and run worlds (off
  the parked old world), TC-3 rename and fix what stays in check-quick, TC-4 speed (shared helpers, fixtures, the
  budgets, the picture baseline). About 4-5 sessions; seven "Ask me before" items, all answered 2026-10-23. Tags `tc-N-done`. First, alone:
  fix the three camera checks main's fast check fails. Can also run as lanes A-E in three rounds (the file's
  "Running sessions in parallel"). Done 2026-10-23 (rounds 1-3; round 3 is TC-4 items 1, 2, 5, 6): the full check
  about 21 min (41 before), smoke about 3, the fast check about 11, `npm test` 20 s; the 10- and 3-minute budgets are
  missed for reasons docs/TESTING.md gives. Tag `tc-done`.
- **Island track** (docs/phases/island-track.md, the owner's brief 2026-10-22): Copperleaf becomes a real island, one
  map with an orbit camera round a mountain, forest, cove, beaches, room for the town and the barn's pasture. IS-0
  (contract and test island) first and alone; then wave 1 (IS-1 orbit camera, IS-2 island generator, IS-3 sea all
  round, IS-4 island props, IS-6a the hub's own Studio editor with an orbiting camera and the ground lock), wave 2
  (IS-5 Copperleaf moves on, IS-6b the editor's dials, IS-7 the world map's island), wave 3 (IS-8 barn and pasture
  after RL-10, IS-9 dressing and the phone pass). The owner (2026-10-22): the island is the hub, never a run node,
  and is locked once it is right. IS-2 (the island ground generator, `copperleaf_island`) done 2026-10-22. IS-7 (the world map's island: its coast,
  ground, mountain and town on the hub's bowl) done 2026-10-22. IS-5 (Copperleaf moves onto the island; rooms face four ways)
  done 2026-10-22. IS-8 (the barn's fenced pasture, the ranch's Billies wandering in it) done 2026-10-22. IS-9 (dressing,
  the forest, gulls and crabs, the phone pass) done 2026-10-22 headless, waiting on the owner's phone test; then the
  ground is locked. Tags `is-N-done`.
- **Project Story** (docs/phases/project-story.md): S1-S3 and S7 done, S8 partly (RL-8: New game plays the fall only; the city's files stay).
  2026-10-23 (the owner): the professor is Professor Chosen, with Hazel as his assistant; lines, names and ids done
  (PR #142); his wolf shirt and katana art are next.
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
| 09 | 09-props-and-terrain | partly: Copperleaf, Route 1, Marigold and the city set redone; every tree of the run biomes a model (batch 10) | parked: the other towns are legacy; run biomes reuse the done kits (left: the rooms' furniture, the barn, the mossy boulder, campfire, lookout tower, wind-sail flower) |
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
ranch levels (answered in RL-9: 1 home Billie a run at Bracket I, and a bag packed at the mast from Copperleaf's); the hub's extent and Copperleaf's south exit (answered in RL-5: Copperleaf alone, its south exit gone); legacy by
moving files (answered in RL-5: moved to game/data/legacy, a read-only Studio list); currency
names and the building mapping (answered in RL-11: $ / Capital / Scrap / Audit Seals; Lab = Capital, Ranch and
Workshop = Scrap, Airship = Seals); menu nodes (answered in RL-12: a normal-sized waystation place with a stand, built in RL-12b); the first cut's shape (answered in RL-8: the full 9-row map); battle formats by node type
(answered in RL-8: wild single, mini-boss doubles, an Alpha boss; the turn cap was answered in RL-4: 40, a draw; a killed battle restarts from its seed); the clock's numbers (answered in
RL-6: a day per arrival, backtracking included, deadline = the shortest walk + 3, no tick for healing or waiting; RL-R2: the owner dropped the deadline, the day clock stays); the token link, Remember me and deleting the
versioned tools (RL-1); SAVE_VERSION 4 and the cloud key whitelist (RL-3; answered in RL-10b: yes, published after the build is live); the dex's place (RL-3); the relic
cap (answered in RL-12: 6); the hub island's look (answered in RL-5: the bowl shows Copperleaf alone; its sea share is set in the Studio); the ranch cut order (answered in RL-9: the walkable yard and pens wait); the order after the first cut; the tuning
cap (RL-12); the hub island's look (answered in RL-5: the bowl shows Copperleaf alone; RL-8b: as an island, worldmap.json sea.island); the ranch cut order (RL-9); the order after the first cut; the tuning
placeholders (RL-6 took the map's: 9 rows, 2 mini-bosses, two lanes on 70% of free and town rows, a lane switch on 25%
of lane pairs, the five biomes with finished plants; reveal the next row, '?' on the row after, the boss always; RL-7
took the scenes': dial ranges in `run.scene`, wild levels 3-5 on the landing +1 a row, 2 on a walk back, a crossing
counting 6 m in, a run kept across a new generator version, places named biome + type; the rest wait for their
sessions); pushing the tags; the opening (answered in RL-8: the fall only). New from the owner's first play (2026-10-21,
roguelite-track.md section 5): rooms too bright; routes wider than long (an HD-2D diorama); Copperleaf's world map its
island alone; a run's own world map generated from its seed. Still open from the old phases: phase 17's prototype
approval and ask list (RL-14), phase 16's breeding mode (answered in RL-10a: both, you pick the parents, the ranch the parts),
phase 10's phone look, phase 06's 06-5.

## Where the old brief went
The old brief's numbering (phases 01-18 and their renames) is kept in the old phase files; the fresh-base vision is
docs/VISION.md. The roguelite plan supersedes the "design half" of phase 15 and the remaining order of phases 12,
16, 17 and 18.

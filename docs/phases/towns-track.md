# Towns track (TW) - run towns that feel alive

Branch: track/towns

The owner asked (2026-10-24) for run towns that "feel alive and natural": a real layout, people walking about, and
some of them giving quests that can be finished on the current run. Also: "clinics have a problem that you can't walk
out of them" and "there's no button to exit". Planned in Plan Mode on 2026-10-24 and approved. TW-0 (the rooms fix) was
done in the planning session itself (its own branch, a one-session fix); TW-1..TW-3 live on `track/towns`, which the
owner makes from main. Tags `tw-N-done`. It runs alongside RL-12b part 2 and RL-R2b (the owner's choice).

Before proposing anything in a session: read the latest HANDOFF.md entries and recent merges, then check the facts
below against main and report what differs.

## Verified facts (2026-10-24, main at 1d68991b)

- **A run town is a route.** `logic/run-scenes.js runSceneParams` gives every node `kind: 'route'` at the route size
  (112 x 64; the seams need it, roguelite-track.md 8 item 6) and a town only adds `props: { clinic: 1, shop: 1 }`
  (`RUN_BUILDINGS`), placed by `mapgen.js mapgenStageLots` (MG-2's "first take on MG-3's lots") north of the road,
  facing south. No street, square, houses, fences or gardens. `MAPGEN_SIZES.small_town` / `big_town` exist, unused.
- **Towns per run:** rules.json `run.map` forces a town on the row before each mini-boss (rows 2 and 5) and filler
  rows roll town at weight 1 of 5: about 2-3 towns on the path you walk.
- **Townsfolk already exist, switched off.** `walk-view.js initFolk/stepFolk` (about :3690-3960) give `sc.folk`
  people a day plan in a town (`folkTown`: homes, work places, benches, fountains, stalls, `sc.npcSpots`), walking by
  `findPath`, in and out of doors, waving and talking (`talk.js talkFolk`). Generated scenes set `folk: 0`
  (`mapgen.js` :3185) and `kind: 'route'` makes `folkTown` false. Copperleaf has `folk: 5`.
- **Named people** (`people: [{ id, who, name, x, z, script, when, unless }]`) stand still and talk through story
  scripts (`story.js personTalk`); they don't walk. Nothing blocks the player on people.
- **Quests:** there is none for a run. `things-to-do.js` was deleted on 2026-10-23; the story layer's `quest id stage`
  is kept in `saveData.story` (not run-scoped) and `story.json quests` is empty. Run-scoped state is `saveData.run`
  (`logic/run-state.js`, `validRun` rejects unknown keys), `run.enc` (events, the reward pick) and the run's own copy
  of `flags`. No counters of catches or trainers beaten exist (`battleN` counts battles begun).
- **Reusable:** `logic/island-gen.js` (IS-2) already lays streets, a level square and plots along a street
  (`plotFits`, `addPlot`, `plotsAlong`, `plotRing`); `logic/route-trainers.js` places seeded people per node; the reward
  pick (`reward-screen.js`, `logic/rewards.js`) is the quest's payout.
- **Checks a town must pass:** `mapgen-lots.test.mjs` (each building placed or noted, faces the camera, door step
  reachable), `run-world-real.test.mjs` (no notes, exits match roads, nothing unreachable, seams agree),
  `check-data.mjs` doors lead to rooms, MAPGEN_VERSION's golden snapshots. The Studio's balance mode assumes every run
  town has tall grass (docs/plans/studio-roguelite-improvement-plan.md, 344/344).
- **Phone cost:** towns ran at 27-28 fps on the owner's phone (HANDOFF, phase 09): the folk count is capped.

## The owner's answers (2026-10-24)

| Question | Answer |
|---|---|
| The clinic | You can't walk out (the doorway is a dead end) and with the card closed there's no button |
| Quest kinds | All four: catch a Billie of a type, beat N route trainers, carry a parcel to the next town, beat the mini-boss with nobody fainting |
| Hand-in | At any later town (a notice board on its square, Claude's suggestion; confirm in TW-3's Plan Mode) |
| How many | One quest giver per town; at most three quests held |
| Reward | The pick of 1 of 3, as after trainer battles |
| Houses | None open: only the clinic and the shop have rooms |
| Givers' looks | Seeded, like the townsfolk, with a quest marker |
| Order | Alongside the other sessions, on its own branch; the rooms fix first |

## Sessions

| # | Session | Goal | Depends on | Sessions |
|---|---|---|---|---|
| TW-0 | Rooms fix (done 2026-10-24) | walking out of a room's doorway leaves it (every room); "Go outside" stays on screen with the card closed | none | in the planning session |
| TW-1 | Town layout (done 2026-10-24) | a `town` scene kind in mapgen at the route size: a main street off the through road, a small level square (fountain or well, the clinic and shop on it, the notice board's spot), 4-7 house plots both sides with fences, gardens, lamps and benches, building sets by biome; a tall-grass patch kept at the edge; MAPGEN_VERSION bump | none | 1-2 |
| TW-2 | Life (done 2026-10-25) | `folk` on in run towns (capped, by town size and the graphics setting), town detection by the scene's kind, homes and work places from TW-1's plots, animals (`sc.life`: chickens, cats, birds by biome), chat lines by biome and region, 1-2 named locals | TW-1 | 1 |
| TW-3 | Run quests (done 2026-10-25) | `quests.json` + schema (kind, goal, text, reward), `run.quests` (held, progress, done) in `validRun`, a quest giver per town (seeded look, marker, offer and accept), progress hooks (catch, trainer win, arrival, mini-boss result), the notice board pays done quests with the reward pick, a quest list on the run's screen, unfinished quests end with the run | TW-2, RL-12b part 1 | 1-2 |

**Each session's shape**, for its own Plan Mode:
- **TW-1.** Files: `logic/mapgen.js` (the town kind, a `square` and `plots` stage reusing island-gen's plot helpers
  where they fit; lots turned along the street need `mapgen-lots.test.mjs`'s "faces the camera" relaxed only if
  doors stay reachable), `logic/run-scenes.js` (towns ask for the town kind; `RUN_BUILDINGS` on the square),
  scenery.json props only (no new art unless the owner asks). Tests: same seed same town; every door step reachable;
  no notes; seams unchanged (the east and west edges still pinned); a grass patch in every town; the golden snapshot
  remade on purpose. Could break: run-world-real, the run sim's scenes, the Studio's balance stand-in, phone fps.
- **TW-2.** Files: `mapgen.js` (`folk`, `life`, `npcSpots` for towns), `walk-view.js` folk (only if the town test
  needs the kind), `talk.js` / data for chat lines. Tests: a town's folk walk and go indoors (a check-fast step on the
  run fixture's town), the cap holds, routes have none. Could break: frame rate (measure on the owner's phone),
  the camera's moments (talk two-shot).
- **TW-3.** Files: new `game/data/quests.json` + schema, type, check; new `logic/run-quests.js` (offer from the town's
  seed stream, progress, done; pure, Node-tested); `run-state.js` (`quests` in `validRun`), the hooks in
  `battle-rewards.js` / catch / `run-map.js` arrival, the giver and the board as `people` and a prop act, the quest
  list (ui kit). Tests: same seed same offers; each kind's progress; the cap of three; a parcel only to a later town;
  a reload keeps quests; the run's end clears them; an in-game test step. Could break: the run sim, the save's
  validator, the reward pick.

## Ask me before (recommendation first)

1. TW-1: towns bigger than a route (better towns, but the seams and the bowl layout would need work). Recommendation:
   keep the route size. **Answered 2026-10-24: the route size. Also: every house faces the camera (not turned to its
   street); south of the through road stays gardens and grass; a well or a fountain by biome.** Since WM-5
   (worldmap-track.md, 2026-10-27): towns of three sizes, and streets may grow south of a through road that runs high.
2. TW-3: hand-in at a notice board (recommended) or by talking to any quest giver. **Answered 2026-10-25: the notice
   board (a new low-poly prop); the quest list on the Map tab.**
3. TW-3: the first quests' texts (Claude drafts 12-16, the owner approves). **Answered 2026-10-25: the 16 drafted,
   approved with the plan (quests.json).**
4. TW-3: a quest kind that needs a side area or a field move (later).

## Noticed, not in scope

- The room card in a run's clinic says "Tap the desk and your team is patched up, free." while a run's clinic charges
  `healCost` (walk-tab.js roomHero). A words fix for the owner to approve.

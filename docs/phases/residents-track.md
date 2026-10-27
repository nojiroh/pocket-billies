# Residents track (RS) - invite run NPCs to Copperleaf; they open services you upgrade

Branch: track/residents

The owner's brief (2026-10-26): during a run you can invite NPCs back to the hub island to get more things on it.
These things (professions, services, buildings) can be upgraded. Planned in Plan Mode on 2026-10-26 with online
research (below) and approved; the planning session ran on `ccr-65e11839-9p92dx` (RS-0). The owner makes
`track/residents` from main and every later RS session works there (docs/BRANCHES.md). Tags `rs-N-done` (the owner
pushes them). Every session starts in Plan Mode and ends with a HANDOFF entry.

Before proposing anything in a session: read the latest HANDOFF.md entries and recent merges, then check the facts
below against main and report what differs.

## Decided (the owner, 2026-10-26)
- **Inviting is a quest.** A run NPC asks for a favour through TW-3's quest system; finishing it is the invite (in
  place of the reward pick). The first resident is free, so the system is taught.
- **Win or lose**: an NPC invited during a run moves in when the run ends, whatever the result.
- **Half and half**: each resident has exactly **one** small, capped power level (marked *P* in the roster); every
  other level adds options (stock, services, rerolls, previews, lore, outfits), not raw strength.
- **The existing four currencies** pay for residents' upgrades, one per building as RL-11 decided (Moneys, Research,
  Scrap, Crests). No new currency. The Gene Bank's own currency is the splicing track's (DNA), not this track's.

## Verified facts (2026-10-26, main at 2314da82)
Every figure is a claim from a read of the code: check it again at the start of each session.
- **Buildings waiting for someone to run them.** `game/data/maps/copperleaf.json` has the General store
  (`act: shop`; `game/data/shops.json` is `{}`), the inn, library, Workshop and Gene Bank (`act: enter`; rooms
  int_inn, int_library, int_workshop, int_gene_bank, HB-5) and **10 cottages with `act: house`**. Its `people` holds
  one named person (Granny Juniper); `folk: 5`.
- **One upgrade system** (RL-11): `game/data/buildings.json` (`name`, `currency`, `act`, `levels`, `soon`; lab,
  station, ranch, workshop with `soon: true`), `game/data/unlocks.json` rows (`at: <building>`, `cost`, `requires`,
  `grant: {building, level}` / `{shop}` / `{biome}`), `logic/unlocks.js` (`buildingLevel` :54, the building grant
  :73, `meta.buildings` rebuilt from owned rows), `lab-board.js` (the board, levels in labels),
  `logic/unlock-graph.js`, `logic/data-checks.js` (:1395 checks a grant's building exists).
- **Currencies** (`game/data/currencies.json`): `money` (kept: run), `research`, `scrap`, `crests` (kept: meta).
- **Run NPCs**: TW-2's townsfolk and 1-2 named locals per run town; TW-3's quest givers, notice board and
  `quests.json` / `logic/run-quests.js` / `run.quests`; RL-12b's events (`game/data/events.json` `events`: 19, each
  `options` with `text`, `need`, `then` command lists such as `loot common`, `perk`, `hurt 0.1`); route trainers.
- **Story**: RL-S1's `meta.history` and `game/data/banter.json` (rows `{who, priority, script}`); RL-S2 (not built)
  plans `meta.rel` and the `rel:` condition.
- `game/data/jobs.json` is `{}` (unused; check what read it before using the name).

## Research: how other games do it
| Game | Mechanism | What we take |
|---|---|---|
| Suikoden I-II | Recruits gather at the HQ castle; non-fighters each open a facility (tavern, tool shop, inn, blacksmith); the castle grows | **One resident = one service**, and the island visibly filling up is the reward |
| Enter the Gungeon | NPCs caged in the dungeon, freed with a key; in the Breach they run shops whose buys join the run's loot pool; some then show up in runs | **Met in a run, a small cost there, the payoff for good.** Their stock widens runs (side-grades) |
| Animal Crossing: New Horizons | Meet a villager on a random island, talk, invite; Resident Services grows once enough villagers live there | **A plain "Come to Copperleaf?" moment** and **headcount milestones** |
| Dragon Quest Builders 2 | Residents from story islands bring their recipes back, ask for rooms, pay gratitude | **Residents ask for things**: small requests gate some levels |
| Cult of the Lamb | Followers rescued on crusades, or bought one a day; they work and make devotion; reviews say the loop fades late | Rescue as one way to meet them; **a light passive trickle** at most (the ranch's clock); **no upkeep or needs** |
| Ni no Kuni II | Citizens recruited by side quests, then assigned to facilities | **Recruit through a quest** (decided) |
| Rogue Legacy 2, Moonlighter, Heroes of Hammerwatch II | Pay to build or upgrade; an NPC (blacksmith, witch) unlocks after a blueprint or a build | **Upgrade costs in the currencies we have**; meeting the NPC is the "blueprint" |
| Hades | Hub characters react to runs; relationships unlock lines and small bonuses | Residents' **banter from `meta.history`**, a hook for RL-S2's `meta.rel` |

**Pitfalls**: meta progression made mostly of stat boosts blurs what a loss teaches and turns into a grind; players
praise side-grades (new options, variety) over flat power. Hence the half-and-half rule, one power level each, capped.
No upkeep, no happiness meter, and a resident can't be lost (the owner plays in short phone sessions).

Sources: [Enter the Gungeon wiki, Ox and Cadence](https://enterthegungeon.wiki.gg/wiki/Ox_and_Cadence),
[Doug](https://enterthegungeon.wiki.gg/wiki/Doug); [Suikoden recruitment, RPG Site](https://www.rpgsite.net/guide/16941-suikoden-1-recruitment-guide);
[Animal Crossing islanders, Nintendo Life](https://nintendolife.com/guides/animal-crossing-new-horizons-island-residents-how-to-get-more-villagers-living-on-your-island),
[Resident Services, iMore](https://imore.com/animal-crossing-new-horizons-how-upgrade-resident-services-tent-building);
[Isle of Awakening](https://dragon-quest.org/wiki/Isle_of_Awakening), [DQB2 rooms, LadiesGamers](https://ladiesgamers.com/mini-guide-dragon-quest-builders-2-rooms-and-sets/);
[Cult of the Lamb followers, TechRaptor](https://Techraptor.net/gaming/guides/cult-of-lamb-followers-guide),
[a review on the loop fading](https://www.patreon.com/ProblemMachine/posts/sheeple-72215966);
[Ni no Kuni II kingdom, Prima](https://primagames.com/tips/ni-no-kuni-2-kingdom-building);
[Rogue Legacy 2 skill tree, GGRecon](https://www.ggrecon.com/guides/rogue-legacy-2-skill-tree/);
[Moonlighter, Indiecator](https://indiecator.org/2019/07/24/indietail-moonlighter/);
[Heroes of Hammerwatch II](https://www.vgdb.co/games/heroes-of-hammerwatch-ii);
[players on meta progression](https://piefed.keyboardvagabond.com/c/games/p/232999/meta-progression-in-roguelites-was-fun-for-a-while-but-it-s-starting-to-f).
Guides and forum posts, not design papers: read as examples, not facts.

## Design (RS-1..RS-5 build it)
1. **Data, not code** (VISION's "modular"): a new `game/data/residents.json` with a schema:
   `{ id: { name, who, role, home, meet: {where, weight, needs?}, quest, levels: [unlock ids], about } }`.
   `home` is a building key (`shop`, `inn`, `library`, `workshop`, `gene_bank`, `ranch`, `station`) or `house` (a
   free cottage). A resident's levels are ordinary `unlocks.json` rows with `at: <their building>` and
   `requires: ["resident:<id>"]`, so the board, `requires`, `meta.buildings` and `run.fx` stay as they are.
2. **Meeting them**: a named local in a run town (TW-2's spot) or an RL-12b event offers a favour. One candidate a run
   at most, from the run's seed stream; never someone who already lives in Copperleaf. The favour is a TW-3 quest of
   the resident's own (`quest`); its payout is the invite. The first resident is free and offered on the first run
   that reaches a town.
3. **Moving in**: the invite sets `run.invited`; when the run ends (win or lose) `logic/residents.js` settles it into
   `meta.residents: { id: { since } }` (validators updated; no old-save migration, CLAUDE.md). The payout screen says
   who is moving in; `meta.history` gets an entry.
4. **In the hub**: the resident is a named `people` entry at their building (or their cottage), their door's act
   becomes their service, and their room card offers their upgrades. A building with nobody stays as now.
5. **Upgrades**: up to 3 levels each, sold at their building in its currency. Some levels also wait on a small
   request (a condition kind that exists or is added: "reach Expedition II", "a Fire Billie at the ranch").
   **Headcount milestones** at 3, 6 and 10 residents (`auto` rows) dress the town square and the station.
6. **First roster** (a draft for the owner: names and lines are written in RS-1's Plan Mode). *P* = the one power level.

   | Role | Home | Lv 1 | Lv 2 | Lv 3 |
   |---|---|---|---|---|
   | Shopkeeper | General store | a hub stock to buy before a run | more stock | *P* one reroll of a run shop's stock per run |
   | Innkeeper | Inn | rumours: one node's type shown early | *P* each run starts with a small healing item | rumours point at a side area |
   | Archivist | Library | lore pages (`lore.json`) | region dex hints | a Bureau file chapter |
   | Mechanic | Workshop (drops `soon`) | a Scrap trickle (the ranch's clock) | the robots hook (RL-14) | *P* part upgrades |
   | Rancher's hand | Ranch | *P* one more training slot | faster hatching | |
   | Cartographer | Station | *P* one more node row revealed | | |
   | Tailor | a cottage | outfits (`wardrobe.json`) | | |
   | Geneticist | Gene Bank | waits for the splicing track (its DNA currency) | | |
7. **Story**: residents' lines in `banter.json` by `who`, reacting to `meta.history`; RL-S2's `meta.rel` can add to
   them later (not built here).

## Sessions
| # | Session | Goal | Depends on | Sessions |
|---|---|---|---|---|
| RS-0 | The plan (done 2026-10-26) | this file, ROADMAP, BRANCHES, HANDOFF | none | in the planning session |
| RS-1 | Data and save (done 2026-10-26, on `ccr-65e11839-9p92dx` at the owner's word) | `residents.json` + schema, type, `check-data.mjs` rule (home and level rows exist); `meta.residents` and `run.invited` in the validators; `logic/residents.js` (pure: the run's candidate from its seed, invite, settle at the run's end); the `resident:` condition kind; Node tests | none | 1 |
| RS-2 | Meeting in a run (done 2026-10-26, on `ccr-65e11839-9p92dx` at the owner's word) | the favour from a run town's named local and one event; quest payout = invite; the payout screen's line; candidates in the Run Lab and the sim; an in-game test step | RS-1 | 1 |
| RS-3 | Living in Copperleaf (done 2026-10-26, on `ccr-65e11839-9p92dx` at the owner's word) | residents as people at their buildings or cottages, door acts switched, the room card's upgrades, banter lines; the Studio's hub editor shows them | RS-1 | 1-2 |
| RS-4a | Services, part 1 (done 2026-10-27 on `track/residents`) | the service machinery (`{resident, level}` rows, Lv 1 free on moving in, `service` in residents.json, the takeoff), Mo and Bertha, the room card, the sim's `--residents` | RS-2, RS-3 | 1 |
| RS-4b | Services, part 2 | Dottie and Gus, the headcount milestones, the in-game full test's step | RS-4a | 1 |
| RS-5 | The rest of the roster | the other residents, request gates, the look pass on the phone | RS-4 | 1 |

About 5-7 sessions. RS-2 and RS-3 can run side by side after RS-1 (different files; `copperleaf.json` is RS-3's only).

**Each session's shape**, for its own Plan Mode:
- **RS-1.** Files: new `game/data/residents.json`, its schema and type, `logic/residents.js`, `logic/data-checks.js`,
  `run-state.js` (`invited` in `validRun`), the meta validator, `logic/unlocks.js` / `conditions.js` (`resident:`),
  `hooks.js` through `npm run modules` if a module-level value is shared. Tests: same seed same candidate; nobody
  twice; settle on a win and on a loss; unknown keys rejected; the condition. Could break: save validation, the run
  sim, check:modules.
- **RS-2.** Files: `logic/run-quests.js` (the invite payout), `quests.json` (one quest per resident), the named-local
  code of TW-2, `events.json` (one event), `run-payout.js`. Tests: offer, progress, done, invited; a reload keeps it;
  the in-game step. Could break: TW-3's quests, the reward pick, the sim.
- **RS-3.** Files: the hub's people (data or a placing step at load, not hand edits to the locked ground),
  `ROOM_BY_USE` / door acts, the room card (walk-tab.js), `banter.json`. Tests: a resident appears after settling,
  their door opens their card; Juniper unchanged. Could break: Copperleaf's walk checks, the quick-check baseline
  (remade on purpose), phone fps (people count).
- **RS-4/5.** Files: `unlocks.json`, `buildings.json` (`soon` off the Workshop), `shops.json`, `logic/effects.js`
  rows. Tests: each grant's effect; caps; the sim's win rates move by no more than the owner allows.

**Done in RS-1** (2026-10-26, from main 2314da82; the owner's answers: build on the session's branch since
`track/residents` doesn't exist yet, the drafted names, the word "residents"):
- `game/data/residents.json`: Dottie Filewell (Archivist, library, the free first one), Mo Stockley (Shopkeeper,
  `shop`), Bertha Brew (Innkeeper, inn), Gus Gasket (Mechanic, Workshop), Hayden Bales (Rancher's hand, ranch),
  Compass Rosa (Cartographer, station), Seamus Stitch (Tailor, a cottage), Dr. Helix (Geneticist, Gene Bank, weight 0
  until the splicing track). Rows: `name, role, home, first?, meet {where: town|event, weight}, levels, about`;
  `levels` empty until RS-4. Its schema, the `Resident` type, `RESIDENTS` (game-data.js), `dataResidents` (a home is
  a buildings.json key, a Copperleaf prop's `k` or `house`; one `first` at most; a level is a row sold at the home),
  wired into check-data and the Studio's check.
- The save: `meta.residents` (id -> the run, by `meta.runs`, they moved in after; `metaFill` gives an older meta `{}`)
  and `run.invited` (one id), in `validMeta`, `validRun` and the types.
- `game/js/logic/residents.js`: `residentCandidate(s, R, where)` (the `first` one while nobody lives there, else the
  run's 'resident' stream by weight among those left; null once someone is invited), `residentInvite(s, id, R)`,
  `residentSettle(meta, run)` (called in `runEnd` after `meta.runs` counts the run, won or lost),
  `residentsHere(s)`. Loaded before run-state.js on both pages and in the Studio's logic worker.
- Conditions `resident:<id>` and `residents` (a count); unlocks.json's check refuses a `resident:` nobody has.
- The debug log lists the residents' ids (no names).
- **For RS-2**: `runEnd` doesn't return who moved in (the payout's line needs it): read `run.invited` before
  `runEnd`, or return it with the payout. The unlock rows of RS-4 need buildings.json rows for the store, inn and
  library (today an unlock is sold only `at` a buildings.json key).

**Done in RS-2** (2026-10-26, on `ccr-65e11839-9p92dx` from RS-1's c3677eb; the owner's answers: one invite a run;
the event's favour done on the spot; a favour held over the quest cap; anyone after the first in one seeded town;
Dottie in every town of the first all-town row):
- **Where RS-1 and the code differed:** `residentCandidate(s, R, where)` drew among those met *there*, so a town and
  an event could offer two different people in one run. Now `residentDrawn` draws once among everyone left (the same
  stream, 'resident') and `where` only says whether they can be met there. `runEnd` needs no change for the payout's
  line: the payout screen is drawn while `run.at.phase` is 'payout', before `runEnd`, and reads `run.invited`.
- `logic/residents.js`: `residentDrawn` (the run's one, invited or not, so a reload still places them),
  `residentFirstTowns` (the first map row made only of towns: rules.json `rest`, so every way walks into one).
- `quests.json`: `favours` (one per resident, a kind each but the free first one's; lines drafted, for the owner) and
  `invite` (the lines when met, the board's, the payout's); schema, type, `dataQuests` (a favour for every resident).
- `logic/run-quests.js`: `questCan` (questOffer's checks, the same draws), `favourTowns`, `favourAt` (the run's
  'resident|town' stream), `favourOffer` (the node's 'favour' stream), `favourTake` (held over the cap, the town's own
  offer untouched), `favourHeld`, `questsHeld` (the cap's count), `questDataOf` (boards from scenes, trainers by
  node), `residentPlan` (who, which towns). `RunQuest.res`, in `validRunQuests`.
- The page: `run-world.js runWorldPutRun` places the resident (`run-scenes.js runTownResident`: scene.people id
  `resident`, on a free local spot, a look seeded by their id) once the route trainers are placed. `quest-board.js
  residentTalk` (Dottie: her line, "Is there room for me in Copperleaf?", Yes invites; anyone else: their favour,
  Yes takes it); the gold "!" while they can be met; the notice board hands a favour in for the invite in place of
  the reward pick; the Map tab's list names a favour and counts only the capped quests. `story.js personTalk` routes
  to it. Debug log: ids only.
- **The event** `stranded_cart` (`resident: true`, weight 2): `eventPool`/`eventAt` take `meet`, so it is drawn only
  while the run's resident can be met at an event (Bertha, Gus, Rosa); a Ground Billie digs the cart out, or 150
  Moneys for a wheel, then `invite` (a new event command: SCRIPT_COMMANDS, docs/SCRIPTS.md, the events check: only in
  a resident event, and every resident event has one). It names them ("The traveller is Bertha Brew, an innkeeper.")
  and drops a favour of theirs held from a town.
- **The payout** says "<name> is moving to Copperleaf."; the run's history entry keeps `res` (for RS-3's banter).
- **Run Lab**: `runPreview` returns `residents: { first, next }` (on a first run, and once the first one lives there):
  who, the favour's kind, their towns (every town counted as having its board), the waystations whose event would be
  theirs. **Run sim**: the log's `resident` and each place's, stats `resident`/`metResident`, the Simulate card's
  "Walked into their resident's town" (SIM_METRICS). The bot does no favour: win rates don't move.
- **In-game full test** ("A run: airship, nodes, payout"): the copy's `meta.residents` emptied, Dottie stands in the
  first town row with her "!", talking to her (lines tapped, Yes) invites her, the payout names her, she moves in and
  the history keeps her.
- Tests: residents (one draw whatever the place, `residentDrawn`, `residentFirstTowns`), run-quests (favour towns,
  offers, over the cap, a reload, a parcel favour handed in, `residentPlan`), new slow `resident-towns.test.mjs` (real
  scenes: a free local spot, nobody else on it, the same run the same place), encounters, data-checks, check-data's
  planted favours, run-state (history `res`), run-preview, run-sim.
- **For RS-3**: the resident's look is a seeded townsfolk one (`folk:<n>` from their id) until the owner picks looks.
  A failed mini-boss favour (Gus) is dropped like any quest; walking back to their town offers it again.

**Done in RS-3** (2026-10-26, on `ccr-65e11839-9p92dx` from RS-2's c4d564e with main 2314da8..bc106c4, HB-8, merged
in first; the owner's answers: wardrobe looks; residents near their house or walking round town; no cottage cap):
- **Where the plan and the code differed:** the doors needed no new acts. HB-5 already opens every resident's room
  (`shop`, `enter`, `house`, `ranch`; the station's sheet), so `copperleaf.json` is untouched and the change is what
  a room's card says and what tapping a resident does. Banter's `who` was a closed list (schema and `BANTER_WHO`), and
  nothing read the history's `res` yet. Copperleaf is a `town`, so its townsfolk already keep a day (walk-view.js
  `initFolk`: out, work, the square at noon, the streets, home, indoors at night): residents join it.
- `logic/prop-turn.js propDoor` (walk-view.js `doorOf`'s maths, pure); `logic/residents.js residentHomes(map, ids, R,
  buildings, catalogue)`: each resident's building (the prop whose `k` is their home, else the one whose act is their
  buildings.json row's: the barn, Skyline Station) or, for a `house` resident, a cottage of their own (nearest the
  town's middle first, in the order they moved in, so nobody's changes; Juniper's never), and the spot by its door.
- **Looks**: `people/<id>.json` for all eight (wardrobe parts that fit the role, like Juniper's); a run town's resident
  wears it too (`runTownResident`); check-data asks every resident for one.
- **Walking**: walk-view.js `hubResidentWalkers` (only in Copperleaf's own view; the game's tables, or a preview's
  `opt.residents`): residents come after the townsfolk in `initFolk` with their look, name, and their door as home and
  work (never out all night); the drawing uses their look (`f.who`); tapped, `talkFolk` hands them to story.js
  `residentHomeTalk`, which plays the story director's line for them.
- **Lines**: banter.json lines with a resident's id as `who` (Claude's drafts, for the owner: one that always holds,
  one on moving in (`must`, `once`), a win's, a loss's, and one more each but Dr. Helix's); the schema takes a
  resident's id and check-data refuses anyone else and asks each resident for a line that always holds; the new
  condition `lastres:<id>` (the last run brought them; run-history.js facts `lastres`, docs/SCRIPTS.md); story-stage.js
  `storyOwner` makes a resident's line theirs.
- **Room card** (walk-tab.js `roomHero`): in a resident's building or cottage (`uiState.inside.res`, walk-view.js
  `residentAt`) the card says "<name>, the <role>, lives here.", Talk, and their upgrades (`buildingRowsHTML` of their
  home; none until RS-4: "<name>'s first upgrades come soon"). The station's sheet says Rosa works there, the ranch's
  that Hayden helps there. Juniper, her cottage and the five townsfolk are as they were; a building with nobody too.
- **Studio** (hub editor): the Map marks where each resident in residents.json would live, with their names; the
  orbit view's "Residents" button previews everyone moved in, walking the town (the Studio's stand-in save, never
  written).
- **In-game full test** ("A run: the train, nodes, payout"): home after the run, Dottie walks Copperleaf from the
  library in her own look and her first word there is her moving-in line.
- Tests: new hub-residents.test.mjs (the real map: everyone's building, the barn and the station by act, cottages kept
  as more move in, unknown ones left out; their lines in order); conditions (`lastres:`), run-history (facts),
  check-data's planted residents (no look) and story director lines (a line for nobody, a resident with no line that
  always holds).
- **For RS-4**: a resident's upgrades are rows `at` their home; a `house` resident's (Seamus's) home is `house`, which
  no building or row uses yet: decide where his are sold. The store, inn and library still need buildings.json rows
  before rows can be sold there (unchanged from RS-1). Residents have no portraits yet (the talk box shows an empty
  face): RS-5's look pass.

**Done in RS-4a** (2026-10-27, on `track/residents` from main 2e74c89d with AIR-3 merged in; the owner's answers: the
store, inn and library charge Research; Lv 1 comes free with moving in; Dottie's power level is Lv 2 (Research at the
payout x1.1) and Gus's Lv 3 (Augments break half as often); RS-4 in two sessions):
- **Where the plan and the code differed:** `shops.json` is gone (SA-3; `SHOPS` is filled by a run's towns only).
  Moneys are `kept: run` (reset at takeoff), so they can't pay hub upgrades. The store, inn and library weren't
  buildings.json rows. The Workshop already sells 3 levels (SP-5), so a resident's service can't be its building's
  level, and Gus's planned "part upgrades" duplicated `workshop_3`. Dr. Helix's home is `gene_bank` (the prop's `k`)
  while the building is `genebank`: left for RS-5 (nobody can meet her yet). Building levels gave no run effects;
  the pattern copied is RL-S2's `relTakeoff`. No `run.fx` exists (effects are built on demand by `fxOfRun`).
- **Machinery:** buildings.json `shop` (General store), `inn`, `library` (Research, level 1). An unlocks.json grant
  `{resident, level}` raises a resident's service: `resLevel(s, id, U)` is 0 until they move in, 1 then, else the
  highest owned row (derived from `meta.unlocks`: no save change). `unlockReady` refuses such a row (`resident`) while
  they don't live there. residents.json `levels` lists those rows (Lv 2, 3, ...) and `service` says what each level
  does (`about`, `power`, `stock`, `reroll`, `rumour`, `items`, `fx`). Checks: a row sold at their home, once a
  level, after the level below, listed in order; one service entry a level; exactly one power level; items, pyramids
  and effect kinds that exist. The Studio's unlock editor knows the new grant.
- **The takeoff:** `resTakeoff` (after `relTakeoff` in `runStartOn`; not on a daily or weekly) puts `run.res` (each
  resident's level) on the run and their items in the bag; `resFxRows` joins `fxOfRun` (tagged `res:<id>`); validRun
  takes `res`, `reshop` and `rumour`.
- **Mo** (General store): Lv 1 the store opens in Copperleaf (`shop.js residentShop`, `res_mo`, registered when his
  building is entered): Potions 15, Pretzels 8, Pyramids 30 Research, into the hub bag (packed into a run as before);
  Lv 2 (100 Research) Hi-Potions 40, Full Remedies 32, Revives 60; Lv 3 (200, *P*) once a run a run shop fetches a
  fresh stock (`run-loop.js runShopReroll`: its `more` wares drawn again from `shop|<day>|r1`, the always-stocked
  kept; `run.reshop`). A shop with a `currency` is paid from `saveData.meta`.
- **Bertha** (inn): Lv 1 a rumour at takeoff (`resRumour`): one hidden main place two rows on or more (an event,
  stall, scrapyard, rival or mini-boss first) shown on the map, from the run's 'rumour' stream; Lv 2 (120, *P*) a
  Pretzel in the bag at each takeoff; Lv 3 (150) the place hiding the side area shown and named, nothing opened.
  `run.rumour`; the map card says "Bertha heard about this place." / "Bertha heard a side path starts here."
- **Room card:** a resident's card shows their service level, what each held level does, "Tap the counter to shop"
  where they sell, and only their own rows, bought there.
- **Run sim:** `--residents=all` (everyone with a service at their top level). 1000 seeds in balance mode: no change
  in wins (`--team=3 --lvl=20 --pack=5 --unlocks=all` 128 both; `--lvl=30 --fights=4` 264 both); Research at the
  payout +3 a run. The bot drinks only Potions and never asks for a fresh stock, so neither power level reaches its
  fights: their size is a judgement until played (a Pretzel is 35 HP once a run; one fresh stock is 2 wares redrawn).
- Tests: new resident-services.test.mjs (takeoff, items, effect rows, Mo's stock, the restock, the rumours, validRun,
  a daily takes none); residents (`resLevel`), unlocks (the refusal), data-checks (planted services and rows);
  check-data snapshot remade on purpose twice.
- **For RS-4b:** Dottie's and Gus's `service` and rows; Gus's rows are sold at the Workshop beside SP-5's (his card
  lists only his; the Workshop's sheet lists every row `at` it, so check it); his Scrap trickle reads `resLevel` in
  `ranch-income.js incomeRate`; the milestones are `when: "residents >= 3"` rows. The Lab board now has General
  store, Inn and Library sections with their rows priced (bought only at the building).

## Ask me before (recommendation first)
1. The roster's looks and lines (names approved in RS-1). **Looks answered in RS-3: wardrobe looks
   (people/<id>.json); portraits wait for RS-5. Lines: Claude's drafts in banter.json and quests.json, waiting for the
   owner.**
2. Pace: one invite per run (rec) / two; residents capped by the 10 cottages (rec: no cap, the building residents
   don't need one). **Answered in RS-2: one invite per run.** **Answered in RS-3: no cottage cap.**
3. The player-facing word: **answered in RS-1: "residents"**.
4. The power level's size per resident (RS-4 proposes numbers from the sim). **RS-4a: the owner chose the power
   levels (Dottie's x1.1 Research, Gus's fewer breaks); the sim can't see Mo's or Bertha's (the bot never uses
   them), so their prices and sizes are placeholders until played.**

## Risks
- **Copperleaf's data**: the island's ground is locked (IS-6a); residents only add people and change door acts.
  One session owns `copperleaf.json` at a time (the hub track's HB-8/HB-9 too).
- **The quick-check baseline** changes when people appear in the hub: remake it on purpose, in its own commit.
- **The splicing track** owns the Gene Bank; RL-14 owns the robots: the Mechanic's levels wait for it.
- **Debug log**: export `meta.residents` ids only (never player names or save data off the device).

## Done when
A run offers an NPC's favour, finishing it invites them, they move in after the run whatever its result, they stand at
their building in Copperleaf with their service and upgrades, the checks are green and the owner has played it on the
phone.

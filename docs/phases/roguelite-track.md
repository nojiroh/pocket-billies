# Roguelite track (RL) - Pocket Billies as a run-based game

The owner's brief (2026-10-20) reworks the game from a classic RPG into a roguelite in the vein of Slay the Spire,
Darkest Dungeon and Balatro while keeping the Pokémon-style walkable world: a hub (Copperleaf Town), runs on a
branching node map of short walkable scenes reached by airship, mini-bosses and a "Voltron" bot final boss fought
as an Alpha, four currencies, relics, difficulty tiers, a ranch between runs, data-driven unlocks and content packs,
and later friend ghost teams and daily seeds. This file is the plan, approved by the owner on 2026-10-20 (session
RL-0, planning only; nothing was built). It is a track like the Studio and Map generator tracks: one session per
row of the table in section 1, each in Plan Mode first, one cause per commit, the quick check tiers of
docs/TESTING.md after every change, a docs/HANDOFF.md entry and a tag `rl-N-done` at the end (tags are pushed from
the owner's machine; sessions can't push them). Every number and line below was read at HEAD e3df43a; verify again
before each session and correct this file where the code disagrees.

## 0. What the repo says today (verified at HEAD e3df43a, 2026-10-20)

**State of the repo.** Latest merges: PR #78 (Studio Billie part-library picker) and PR #77 (back-view rig and bot HP
fixes), both 2026-10-20. The #78 HANDOFF entry says its validation could not run (no Node suite, no browser), so it is
unverified work sitting on main. Before that: map generator MG-1 (routes only; towns MG-3 not built), Studio track
ST-6, Project Story S1-S3 and the city opening, world-map bowl done, phase 17 robots prototype "in progress, not
tagged", phase 16 prototype part 1, phase 12 ranch and phase 18 friends not started.

**Tags.** The remote holds no `phase-NN-done` tag at all, only `Baseline`; every HANDOFF since phase 03 says tag pushes
get HTTP 403 from these sessions. The `legacy` branch exists at 0314a22. So "never start a phase from an untagged state"
has not held for a while, and the CI full run "on phase-* tags" never fires. (The plan asks the owner to push tags.)

**Tools in this container.** No `node_modules`, no Python Playwright: `npm test`, lint, typecheck and the quick check
could not be run here. The audit's "263 tests pass" is now 279 per HANDOFF (52 files, ~280 `test(` calls).

**Corrected in RL-1 (2026-10-20, read and run at c2d51d6).** `npm ci` and `pip install -r tools/requirements-check.txt`
work in the container (the pinned `playwright==1.56.0` matches /opt/pw-browsers; the newest Playwright does not), so
every tier ran. 285 tests passed before RL-1 (290 after). PR #78 left `check:modules` and `format:check` red (fixed);
the smoke check's one red step was older than #78 (the world map's `mthing` shader, aCol on location 7, from phase
10; fixed). `CLAUDE.md:30` had already been corrected in RL-0. The "16 version-stamped tools" are **not** dead weight:
`build-scene-props.py` execs the five `scene_props_v*.py`, `build-props-a04.py` imports `build-buildings-v46.py`,
`build-terrain-v47.py` is the ground generator the game's painter mirrors, and 03-audit-notes lists most of the rest
as live generators; only a few are one-off migrations (owner's decision pending, HANDOFF RL-1). Direct `Math.random`
calls: 172, not 177.

**Corrected in RL-2 (2026-10-21).** `dailySeed` went into `logic/rng.js`, not rules.js (it is seed code; rules.js
has none). No old-name re-export from mapgen: only mapgen.js and its test called `mapgenHashString`/`mapgenRandom`, and
the hash is the same wherever it lives (`rng.test.mjs` freezes values taken before the move, a generated scene's hash
included). `rng-baseline.test.mjs` does not change in RL-2: `util.random` stays `Math.random` until RL-4's `b.rng`.
`game/index.html` did not load mapgen.js; both pages now load `rng.js` first among the logic modules. Battles at
equal-ish levels last 2-5 turns, so the golden record's seeds and levels were picked to include a crit, the Alpha's
shield and a robot part breaking. `spawn`'s species odds also pass through `environmentOdds` (the real-clock weather):
a run's spawn needs `extra.wx`-style weather from `run.forecast` too (RL-6/7).

**Corrected in RL-3 (2026-10-21).** The save already had a field `v: 4` (read nowhere, apart from `saveVersion`):
deleted first, so "format 4" means one thing. The trip reset is one line (`saves.js:146`), not 146-148. `rules.json`
had no `run` block: RL-3 adds `run.payout` (placeholders). The run does not store its own position (`run.at` holds the
phase and the battle only): `trip.node` is the position, one copy. `trip.node` in a run counts Copperleaf as 0 and map
node i as i + 1, as 2e says, so `run.path` holds map indices. The set-aside slot kept the *first* unloadable save, so
SAVE_VERSION 4 would have lost a format 3 save on a phone that already had one set aside: fixed (the latest wins).
The account's older save goes to `-cloud-set-aside`, which nothing reads (not fixed: one slot, two saves; owner's
call). Keep-one in `runEnd` follows option 3 of 8.2 by shape (travellers come back as they left, kept ones keep their
gains); how many are kept on a win or a loss is still the owner's call.

**Corrected in RL-4 (2026-10-21).** The engine read `activeBattle` 64 times (68 with the import and comments), not 56.
It drew chances in 18 places, not 16: two `pickWeighted` calls (the AI's weighted pick, the limb a hit lands on)
used the default `random`. "No save writes" covered items too (`applyItem` spent `saveData.items`, `award` read
`saveData.buddy` and the save's team). `B()` breaks the naming rule (no top-level name of one or two characters):
the engine reads `battleNow()`, and `withBattle(b, f)` plays a battle given to an entry point. `setActiveBattle` did
not need to call anything: `battleNow()` falls back to the page's `activeBattle`. `seen` is not copied by `endBattle`:
a battle on the save's own team (every battle the page starts) marks the save as before, a battle on a copied team
keeps `b.seen`, `b.bag`, `b.buddy`. `b.rng` is made by `makeBattle` from `b.seed` (`rngFn(seed, 'battle')`); with no
seed the engine still draws `util.random`, so ordinary play and the golden record are unchanged. Owner's answers:
turn cap 40, a draw (wild = walked away, trainer = loss) (8.9); a killed battle restarts from its seed (8.7, built in
RL-8); Lullaby's text fixed to 2-4 turns.

**Corrected in MG-2 (2026-10-21).** "Seams decided by the code" holds: run scenes 112×64, forward links N to S at t
0.25/0.5/0.75 join with whole-metre offsets, and a child generated from its parent's strip (`mapgenEdgeStrip` into
`params.edges`) meets it with no height gap or step and a straight walk across (docs/phases/mapgen-track.md, MG-2). Two
things the plan didn't say: terraces must stay at ground level by every exit's edge, not only joined ones (a parent is
made before its children), and a node with two parents shares its south side at the midpoint between the exits.
`logic/seam-rules.js` is check-data's seam rules moved into one module (check-data is already Node), not a
re-implementation; a02_joins compares views, so on raw data the numbers are heights, step and the walk. The hub's
buildings for RL-8's towns are the props dials `mast`, `clinic`, `shop` (a lot beside the main road facing the camera,
level, with a path to the door). The terrain track's TR-1 (smooth roads) was folded in by the owner.
**Corrected in RL-5 (2026-10-21).** 48 places and 48 maps were parked, not 47 (49 locations, Copperleaf index 46,
now 0); 39 trainers moved, 10 stayed (the 8 leaders, now `miniboss: true` with no `node`, and the tutorials blake0
and tinker). Trainers name their place by a numeric `node`, so a leader without one needed the `miniboss` branch in
`worldSetGraph`, the schema (`node` only for a trainer that stands somewhere) and both checks (check-data and the
Studio's; neither exempted tutorials: they passed because node 0 existed). More of story.json named parked things
than lines 38 and 66: 47 (Fizzwell), 48-49 (`beat:chad`, `!beat:chad2`, Clovercrest), 67 (Tallgrass), and the
`before-cass` preset (moved to legacy); Copperleaf's own signpost, a townsfolk line and one of Granny Juniper's
pointed at Marigold too (cut, the owner's answer). A place with no exits opened as its plain map, where no room
opens in place (`roomLayIn` needs a hub view's parts): Pearlantis had that bug, and Copperleaf would have; fixed in
`seamlessRoamView`. `worldSetGraph` is pure (game-data.js is logic): it does **not** bump `seamlessWorld.gen` or call
`worldBowlReset()` (2e said so); RL-7's install does that, and must also reset what holds a node or a place:
`worldBowl.sel`/`marks`, `uiState.mapSel`, `airshipFlight.a/b`, the walk view's composite (a `gen` bump with the same
view id keeps it), `watchMapsAhead`'s cached node, things-to-do's node keys (`saveData.x` is not a run field),
`mapIdAt`'s fallback to the first map (Copperleaf, listed first since RL-5), and `walk-view.js mapMoodName`, which
reads `gameData.locations` (the hub's; shared with the Studio, so a run scene should carry its own `mood`). Hub
trainers attach by node number in whatever world is in (none stand anywhere after RL-5; a run puts its trainers in
`TRAINERS` first). A world without roads now has none (an empty list made up a chain). check-data's seam offset
rule rejects only an offset of exactly x.5 m (now `logic/seam-rules.js:122`, moved there by MG-2): a small fix for later.
`gamedata.js` was 0.76 MB (lite maps), not 13 MB (CLAUDE.md's gotcha is stale): 0.59 MB after; game/data/maps 7.3 MB
-> 0.8 MB. Kept, against this plan: fishing.json (keyed by water, not place; Copperleaf has water) and the postcard
pictures (loaded only on arrival). Left dead in the data: `rules.json legends[].scene` (cinderpeak, frostcrown),
`scenery.json` flags (parked towns), `biomes.json from`, the parked places' pools.
**Corrected in RL-6 (2026-10-21).** The climate odds can't make a forecast alone: no place, map or biome had a climate
(`environmentClimate` guesses one from a scene's fields, and a node's weather is needed before its scene exists), so
biomes.json rows got `climate` (today's guess for each biome's generated scene, default dials; a map with coast water
guesses coast whatever its biome, so RL-7 writes `scene.climate` from the biome). `weatherPick(climate, rnd)` became
`weatherPick(climate, roll, season)`: the page's pick changes the mild odds by season first; environment.js is on the
Studio page too, so logic/weather.js loads on both. `runMapMake` takes no tier (tiers change nothing until RL-13).
The seam rules cap a node at two links each way (two exits a side, 44 m apart: t 0.5, or 0.25 and 0.75). On the bowl
every map's north faces the centre, so a run's rows go from the rim (r 0.94) towards it (0.12), on the south side;
the hub's 30-degree seam rule holds for straight links and splits, not for a lane switch (45 is tested; 34 seen on the
game's rules). `runEnd` paid per node cleared from the path's length, which counts backtracks: now distinct nodes.
`forecast[node][day]` is `forecast[world node][day - 1]`; the node seed uses the map's numbering. "About 14 nodes"
needs two lanes on almost every free or town row: with the 70% chosen, a map has 12.5 on average (9 to 14), and towns
are 4.4 of them (the two rows before the mini-boss rows, plus a filler at weight 1 of 5).
**Corrected in RL-7 (2026-10-21).** A scene takes about 30 ms to make in Node, not 136-451 ms (MG-1's numbers, before
MG-2); a run's 12-14 took 0.4-0.9 s in headless Chromium, so a run's world makes all its scenes when it goes in,
not "lazily one hop ahead" (which can't work per node anyway: a child is made from every parent's edge, so the order
is row by row). 501 scenes of 40 runs with the scene dials varied all joined with no gap and a straight walk, all
reachable. The world follows the save, not boot alone: the save is swapped in many places (New game, an account or
backup restore, the debug menu, the in-game test), so `setSaveData` calls `runWorldSync` once boot has (RL-8's run
start calls it too). `runArrive` took where you stand from `run.path`; `trip.node` is the one copy (RL-3), so it reads
that. `migrate`/`validSave` bounded a hub save by the installed world's places: the hub's own now (`HUB_LOCATIONS`).
Not in 2e: a crossing counts `run.seamIn` (6) metres in, so a step over a seam and back costs no day; a run place's
pool is its own (its biome's species at its row's levels: the source places' pools carry old levels, Russetwood
41-45); biomes.json rows got `pool`, `battleStage`, `mood`. 2a's "a run made by another generator version is
abandoned" became "kept" (the owner's J: the map and position don't depend on the generator). The walked view copies
a scene's `climate` (LOOK_KEYS). Things that would misfire on run nodes were kept to the hub: postcards, things-to-do's
visits and requests, friends' presence (node 0, "a run"). Run trainers, the landing's mast and towns' clinic and shop
moved to RL-8 with their behaviour; RL-7's scenes are plain routes. A place's landmark picture on the bowl draws as a
red block in headless Chromium, Copperleaf's in the hub too (not RL-7's; HANDOFF).

**Corrected in RL-8 (2026-10-21).** No battle had a seed and `extra.wx` didn't exist; battle weather already
followed the forecast (RL-7) except sunny and night (the real hour); a run's battles now take the forecast alone (clear
counts as sunny). Run towns offered a free clinic on the place card, and no run scene had a mast, clinic or shop
building (mapgen's MG-2 dials make them, by node type). "You hurried back to the clinic" healed where you stood. The
in-game test had no airship step (a04's model check was the only one). The debug menu's "Go there" skipped the run's
arrival. Leaks the plan didn't list: storage (`box`) isn't a run field, so a 7th catch or a move to or from storage
leaked Billies into Copperleaf (storage is closed on a run; a 7th catch waits until one is released, as `validSave`
refuses a team of 7); today's challenges kept counting and paid into the run's money; releasing a Billie from
Copperleaf would have been paid though it comes home; moves waiting to be learned are kept by Billie id (cleared at a
run's start and end). The account upload runs about 5 s after a save, so a checkpoint is uploaded at once (`saveNow`).
No trainer stood anywhere; the leaders have `blocks: false` and scripts that fight the real leader (badge included),
so a run copies them with ids of its own and no script, badge, egg or story conditions. The wild odds followed the real
hour and new ids came from the clock (a run wasn't reproducible from its seed): both now come from the run. Section 5
put Capital "in the Lab": the Lab's board is RL-11, so Capital shows in the Map header. `pb-payout` has one total and
no Seals line, and there is no keep-one component: the payout lays out `pb-pick-card`s. The owner's answers: the full
9-row map (8.8; the debug menu has a 5-row short run), formats by node type with an Alpha boss and the 40-turn cap
(8.9), and the opening is the fall only (8.20). The owner's play found a trap RL-7 had left: a run's bridges couldn't be
walked where a stream's banks are steep (walk/heights.js blocked the steep ground under the deck), and mapgen laid a
bridge along a stream where the road ran beside it, often ending in the water; both fixed (MAPGEN_VERSION 4).

### Findings A: battle, state, randomness, saves (verified)

- `game/js/hooks.js` is generated by `tools/to-module.mjs` (one `export let` slot per name, ~274 slots, `provide()`
  fills them). `saveData` and `activeBattle` live in `game-state.js:115-128` with `setSaveData`/`setActiveBattle`,
  which assign and re-`provide`. Each name therefore exists as two live bindings (hooks.js and game-state.js), in sync
  only through the setters.
- `logic/battle-engine.js` reads `activeBattle` as a module global from hooks (56 references), never as an argument.
  `newBattle(kind, foe, extra)` (line 876) installs it with `setActiveBattle`. Side 0's team **is `saveData.team` by
  reference** (line 906): damage and XP land on the save directly. The engine also calls UI seams (`toast`, `save`,
  `openBattle`, `playTurnEvents`, `uiState.dbgCatch`). Battle-end rewards, the lose fee, egg drops and badges live in
  `battle.js endBattle`/`finishThrow`, not in logic/.
- Logic files reading hooks: battle-engine (10 names), rules (14), saves (`saveData`), script, coats, game-data.
  `tools/test/logic.test.mjs:12-29` lists the allowed seams.
- **Randomness: `util.js:11` is `export const random = Math.random`.** Not seedable. The unit tests seed by replacing
  `Math.random` with Park-Miller in `tools/test/load-logic.mjs` *before* util.js loads. The engine calls `random()`
  ~16 times (crit 286, damage 288-289, sleep, retarget, paralysis, confusion, accuracy, effects, AI pick, speed
  tiebreak, catch rolls); `rules.js pickWeighted` too. 177 direct `Math.random` calls in game/+studio/ (rendering,
  sound, ambient life mostly; also `battle.js` bribe/egg drops and `things-to-do.js` rewards, which are game outcomes).
  `logic/mapgen.js` has its own pure sfc32 (`mapgenRandom(seed, salt)` from an FNV-1a string hash, per-stage streams).
  Logic is also not deterministic for other reasons: `newUid` and `met` use `Date.now()`, battle weather follows the
  real clock, wild refill uses `playMs`.
- **Saves:** `SAVE_VERSION = 3` (`saves.js:161`); `migrate()` fills same-version defaults and drops stale ids (not a
  format converter); `validSave` (174-250) is strict (team 1..6, box ≤ 5000, species/uid/lvl/moves checks, `trip.node`
  an index, `se` money, coins/items records, `wild`, `seen`, `caught`, `flags`, `seats`). Top-level keys of
  `newSave()`: `saveVersion, gameVersion, avatar, preferences, started, gender, starter, team, box, parts, seen, caught,
  se (money), coins, items, trip{node,plan}, wild, buddy, flags, seats (badges), visited, serial, eggs, savedAt, tid,
  since, hatched` plus `playMs, story, stats, x, cards, wardrobe` added by other modules. No `unlocks`, no ranch, no
  run, no `day`. Storage key `networth-save-v1[-u-<account>]` in localStorage; cloud copy at Firestore `saves/<uid>`
  (`{json, savedAt, saveVersion, name, game}`, < 1 MB). Save is event-driven (~95 `save()` sites) plus a minute tick.
- **Alpha fights:** actors 0,2,4 vs 1 (`SIDE_ACTORS`), `alphaTeam = 3`, the Alpha acts twice a turn, `makeAlpha`
  sets `m.boss = {hp: 3, st: 1.3}` and +3 levels; `alphaPhase` at 50% HP raises a 2-turn shield and +1 Atk/SpA.
  Wild only today (1/45 with ≥ 2 members). Formats `single|double|alpha` are hard-coded (not in rules.json).
- **Robot parts:** `kind:'robot'`, `gem`, `fit {torso, armL, armR, legs}`, `partDmg` per limb, limb HP = maxHp × 0.4
  × dur, every hit also calls `hitPart` (weights 0.25 each incl. torso), 3 aimed moves, broken limb disables its
  moves, broken legs halve Speed, `aiAimPart` targets the weakest limb.
- **Weather:** `battleWeatherMultiplier` is in `things-to-do.js:705` (reached by the engine through hooks as an
  optional function, line 304). It reads `environmentState(map)` = place climate × the real clock (3-hour blocks,
  hashed, deterministic from wall time). `environmentForecast` exists in environment.js. `logic/bowl-weather.js` is
  bowl visuals only (sky blend, clouds, wind, the Inner Sun); `walk/fountains-weather.js` is rendering only.
- Statuses are `aud` (Paralyzed, "audit"), `sub` (Asleep, "subpoena"), `scn` (Burned, "scandal"). 9 types, 6 stats.
- **Economy:** money is `saveData.se` (start $600). Sources: wild win lvl × $20, trainer reward, bribe after a failed
  catch, things-to-do rewards. Sinks: shops, 10% lose fee, $100 rest stop, airship tickets, clothes. **Healing at the
  clinic is free.** `jobs.json` is dead data. 18 shops (per location, `stock: [{item|coin, price}]`), 12 items, 4 catch
  coins (silver/gold need badges), eggs hatch by metres walked (2/4/8 km) from wild wins (12%) and trainer firsts.
- **Roster:** the game reads `game/data/lines/*.json`: 7 lines, 24 species (roster.json is not read). Legacy ids in
  pools/trainers are stood in by hash onto the 4 uncommon lines, so the effective wild roster is small. 121 moves.
- **Battle length:** no telemetry; an AI-vs-AI simulation (run in memory by the explorer) gave a median of 2 turns
  for equal-level 1v1, with rare 70-190-turn stalls. Playback paces 820 ms per event. So a battle is well under the
  2-3 minute target; a turn cap is advisable for ghost replays.
- **Bug found:** `game-state.js:109-112` and `account.js:304-319` both write `SAVE_KEY-set-aside` with different
  shapes; the account overwrites the game-state copy and the restore UI never shows the game-state one.

### Findings B: world, hub, flow, map generator, content pipeline (verified)

- **Seamless world** (`seamless-world.js`): a place's own map plus a band of each neighbour, built on the fly as a
  composite view (`seamlessHubMap(node)`, view ids `w:<scene>*`); crossing shifts the player by the view-origin
  difference (`shiftWalkView`). Neighbours come from `ROADS`/`ROADS_BY_NODE` derived **once at import** in
  `game-data.js:288-358` (only `kind:'seam'` roads; lifts dropped), looked up by `LOCATIONS.findIndex(mapId)`.
  Caches key on `seamlessWorld.gen`; `boot.js studioLive` already swaps `gameData.maps` live and bumps `gen`. There is
  **no API to swap the location/road graph**; `LOCATION_BY_ID`, `START_NODE`, trainer→node attach are frozen copies.
- **Node indices are identity everywhere**: `trip.node`, `trip.plan`, `visited`, trainer `node`, ROADS entries, the
  world-graph snapshot. `validSave` rejects `trip.node >= LOCATIONS.length` (`saves.js:146, 204`). One location per map
  is assumed (`mapIdAt` falls back to the first map).
- **Data counts:** 96 map files (49 location maps, 23 `int_*` rooms, 22 `test_*`, `gallery`, `city_opening`); 49
  locations; 57 roads (56 seam + 1 lift). **Copperleaf** is index 46, bowl `{a:0, r:0}` (the centre), kind town,
  88×76, **one exit (south)** → `road:hedgerow-copperleaf` ("Route 1") → Hedgerow Lane → Marigold. Props: 5 houses,
  Juniper's home, `lab`, `sign`, `airship_station` (act `fly`). `rules.start.locationId = "copperleaf"`. **No islands**:
  `regions.json` has one entry; the location field `region` groups 28 of 49 places, Copperleaf has none.
- **Map loading:** `build-data.mjs` writes one `gamedata.js` with "lite" maps; `map-files.js loadMapFile(id)` fetches
  `data/maps/<id>.json` lazily (2 roads ahead, then all). A map injected at runtime with no `_lite` is never fetched
  (good for generated scenes). `game/data/legacy/` holds the 55 old Billie lines, not maps.
- **Rooms** open from `ui.js enterRoom` (not walk/rooms.js, which only draws): `seamlessRoomMap(view, roomId, door)`.
- **Travel:** walking across seams (`walkCross`, ui.js:1388) sets `trip.node` and calls `arrivedAt`. "Travel here"
  only sets a guide plan. Glass lift is a prop `act:'lift'`. **No day/step clock remains**; `today()` is the real date;
  weather and time of day follow the real clock.
- **Bowl:** a place's spot is `locations.json bowl {a, r}`; pins from `LOCATIONS` (`world-bowl.js:507, 2409`); the
  module imports `LOCATIONS, LOCATION_BY_ID, ROADS, gameData` and uses them in ~10 places; the logic layer
  (`bowlSeaInput(places, roads, mapOf)`, `bowlReliefFeatures(places)`, `bowlClumps`) is parametric;
  `worldBowlReset()` rebuilds spots and ground. Weather on the bowl: every 5 s per place from `environmentState`.
- **Airship** (`airship.js`): masts are props `act:'fly'`; `flyMenu` lists visited towns with a fare from bowl
  distance; `startAirshipFlight(i)` **sets `trip.node` immediately**, switches to the Map tab and animates a **2D
  sprite** (`map/airship.png`) along a parabola for 2-3 s on the bowl overlay; `flyLand` puts you by the `fly` prop.
  The 3D airship is only the mast prop model.
- **`startGame` is 40 lines (ui.js:2263-2302)**, not 574 (the audit's number spans the global click handler):
  new save keeping preferences, starter at `RULES.start.starterLevel`, `trip = {node: START_NODE}`, starter
  encounters and egg, save, walk tab, welcome modal or `storyRivalBattle`. Boot: `boot.js:905-951`. Tabs:
  `walk, map, team, ledger (Guide), bag` + profile; Settings, shop, dressing room, things-to-do, fishing, talk,
  gallery, friends are overlays.
- **Opening today:** `cutsceneStart` → `openingCity` (cutscenes/city.json, 21 s) → `fallPlay` (crust to Copperleaf)
  → cutscenes/opening.json on Copperleaf (wake, Hazel, dressing room, Blake, staged fight, coins, `pick-starter`,
  `rival-battle`) → `startGame`. `nw-opening-done` (story.js:161-172) is a per-device "offer Skip" flag, **kept on
  purpose** (HANDOFF 740); only its prefix is legacy (so is the save key `networth-save-v1`).
- **Story layer:** flags in `saveData.story` (`storyFlags()`), trainers beaten in `saveData.flags`, badges in
  `saveData.seats`; scripts, `when`/`unless`, `requires`/`locked`, chapters, presets (`?story=`), story checks.
- **Badges/gates:** 8 leaders with `trainer.seat` (oil, retail, haven, peak, bloom, vault, morel, carat); 11
  locations carry `gate: <seat>`, 4 `ride: 1`; `canEnter` (rules.js:629). `world-graph.test.mjs` snapshots places,
  roads, exits, gates, lifts and requires `map.locationId === location.id`.
- **Map generator** (`logic/mapgen.js`, imports only test-globals, Node-safe, **not loaded by the game page**):
  `mapgenParams`, `mapgenScene(params, {scenery, biomes}) → {scene, notes}`, `mapgenRandom`, `mapgenNoise`,
  `mapgenUnreachable`. Output: a full route scene with `edgeExits [{id, side, t, in, width, len, path}]`, `hub`,
  `gen {v, params, seed}` (seeds inside params). **Routes only**: the `lots` stage and town kinds are named but
  missing (MG-3 not started); no `locationId`; no seam alignment to a neighbour (MG-2 not started). Measured here:
  136 ms (112×64), 184 ms (128×96), 451 ms (200×200). 11 biomes. A seam join must satisfy check-data (opposite
  sides, equal width, integer `t` offset, walkable ground, ≤ 2 exits a side 44 m apart) and a02_joins (heights within
  5 cm and identical tiles within ±6 m, a straight walk across).
- **Adding a data section** (pattern of commit 2457957, biomes): `game/data/<key>.json`, `index.json keys`, a
  schema in `game/data/schema/`, a type in `game/types/game-data.d.ts`, a check in `tools/check-data.mjs`; an export
  in `game-data.js` to use it; `data-files.js SPLIT` only for a per-id folder. Data is one generated `gamedata.js`
  (+ lazy map files); `data-fallback.js` loads files one by one when it is missing.
- Candidates to park: `jobs.json` (unused), `fishing.json` (water encounters), lore, postcards, `regions.json`
  (one entry), story.json `quests` (empty), location `requires` (unused).

### Findings C: robots, Alpha, online, security, tests, eggs (verified)

- **Robots:** 4 slots `torso, armL, armR, legs` + `gem` (**no head slot**; the head is torso art). Data: 3 torsos, 6
  arms (either side), 3 legs, 3 gems = 972 builds; 12 robot moves (`fx.aim`, `fx.breaker`, `fx.repair`); moves from
  parts (`robotMathMoves`); `makeRobot(gem, fit, lvl)` → `kind:'robot', sp:'bot:…'`; everything else via
  `speciesOf(m)`. Gem = stat bonus, signature move, type affinity, keeps level across bodies; **no personality/passive
  trait**, "personality core" appears nowhere. Reachable only via the debug menu (`giveRobotKit`, Tinker Rho). No wild
  robots, no repair kits in shops. `robot-art.js robotRig` draws parts on the biped skeleton. The phase 17 prototype
  is unapproved and untagged.
- **Alpha:** one fighter, one HP pool, `m.boss = {hp:3, st:1.3}`, foe side capped at 2 actors (`SIDE_ACTORS`,
  `allSnapshots` hard-coded 0..4), `alphaPhase` once at 50%. **A Voltron as one robot with `m.boss`** gets boss HP,
  3 breakable limbs, aimed hits, the shield phase and double actions with no engine change; limbs are part ids, not
  whole bots. Separate bots would need the foe side widened (formations, snapshots). Visuals: scale 1.6 for boss,
  alpha formation, red glow, shield light, screen shake, broken limbs drawn faint.
- **Online:** Firebase Auth **Google only** (no anonymous); compat SDK loaded from jsdelivr with no SRI; cloud save
  `saves/{uid}` `{json, savedAt, saveVersion, name, game}` (< 1 MB, no key whitelist); friends: codes, requests,
  presence (`users/{uid}`: name, avatar, partner, `at {node, place, sid, x, z, t}`), friends drawn walking in the
  world; **no trading, battling or visiting**. Rules: 4 match blocks, default deny; new collections need their own
  blocks + emulator tests (13 today, Java 21, `firebase emulators:exec`). Rules can check shape and size only; a
  legal team can't be checked without server code (SECURITY.md). Known friend bugs: re-adding from the other side,
  `friendWorldItems` reads `p.build` which `cleanFriend` drops, `codes/` never deletable.
- **Security/dead weight:** `studio/js/github.js:131` links a classic `public_repo` token, `:137` ticks Remember me
  (localStorage); SECURITY.md recommends A (fine-grained single-repo token) and B (session-only default), marked
  "ask before changing". `cleanName` is in `logic/rules.js:210` (SECURITY.md says game-state.js: stale; it also says
  `esc`, `N(m)`, SAVE_VERSION 1). `escapeHtml` (game-state.js:53) used 299 times; 58 `innerHTML` in game/js, 73 in
  studio; `modal()` and `toast` put titles in unescaped, so safety rests on callers + `cleanName`. Version-stamped
  tools: 10 `*-v46/v47.py` + `build-v28.py` + 5 `scene_props_v*.py` (most are live generators, not dead: RL-1); `eslint.config.js:2-3` and `CLAUDE.md:30` still
  describe shared globals (README is current). `account-config.js` is committed (normal for Firebase; header stale).
- **to-module.mjs:** new module state = `export let x` + `export function setX(v) { x = v; provide({ x }); }`, then
  `npm run modules`; `check:modules` also checks load order. The edit hook does **not** run check:modules or format.
- **Tests/CI:** 52 test files, 266 literal `test(` calls (279 cases with loops); fixture vs real data setups;
  `sim/` holds only robot-sim. CI: lint job (lint, typecheck, test, data, modules, format, build), smoke job
  (check-fast in Playwright), rules job, nightly full + selftest; `check-quick --smoke` is **not** in CI.
  `runFullTest` phases include Alpha, double, opening, world map; **no robot phase**. Debug log: counts and
  preferences only + small scene screenshots; check-fast plants names and checks the export. Typing: 34/129 game
  files (all 29 logic files), 0/34 Studio files.
- **Eggs:** tiers 2/5/10, `need` in metres (2000/4000/8000), capacity 8, 2 incubator slots, 12% drop after wild wins,
  `addWalked` outdoors only; `hatchEgg` picks by weight and rolls a coat. **No breeding code exists.** Dex: `seen`,
  `caught` records of species id → 1. Billie "parts" are size builds `{head, body, front, back, sig}` S/M/L
  (`logic/parts.js`: weight, stat factor, Prime +10%); not swappable in game; `partKits.json` is a Studio art kit.

### Findings D: plans that already exist for what the brief asks (verified)

- **Phase 19 "Battle core: seeded, replayable, two-sided, effect handlers"** exists only on the branch
  `plan/engine-phases-19-21` (docs/phases/19-battle-core.md, 12 KB), decided by the owner on 2026-10-19 to come
  **before** phases 18, 20 and 21. It designs exactly what brief section 4.2 asks: a battle-owned seeded PRNG
  (`logic/prng.js`, `b.rng`, cosmetic `fxRandom` apart), `createBattle({sides, seed, rules, kind})` on a JSON-safe copy
  of the fighters, `battleResult`/`applyBattleResult` so the engine never calls `save()`/`toast()`, two-sided inputs
  with controllers (`player | ai | remote`), a replayable input log with an engine version and a rules hash, an
  effect-handler table (`logic/effects.js`), seeded wild encounters (place id + a counter in the save), scripted
  battles for Project Story S6, a golden-record test first. Its "Ask me before": mid-battle quit (recommends keeping
  the battle in the save and resuming), Lullaby turns, and finishing/tagging the phase 17 prototype first. **Nothing
  of it is in main** (no prng.js, no effects.js, no golden record; `random` is still `Math.random`).
- **Phase 21 "Texture atlases and KTX2"** (same branch): after phase 20; not needed by the roguelite.
- **Phase 20** (renderer batching) is in main with stages A, B, C-1, C-2 done; its later stages wait on phase 19.
- Numbering: 19 and 21 are taken on that branch, 22 (story layer) was absorbed into Project Story, so **23 is the
  first free phase number**; the tracks use prefixes (ST-N, MG-N, PS-SN).

## 0b. Old phases: where they stand (read from docs/HANDOFF.md only)

No `phase-NN-done` tag was ever pushed (every session's tag push got HTTP 403), so "done" below means the HANDOFF
entry says the phase's work is finished, not that a tag or the tag-triggered CI full run exists. "Open" lists what
the entry itself left undone or asked the owner.

| Phase | Status | Open (from HANDOFF) | In the rework |
|---|---|---|---|
| 00 Finish current work | done (`Baseline` tag is the one tag on GitHub) | — | keep |
| 01 Baseline and bug fixes | done 10-16 | tag; Studio round trip in CI | keep |
| 02 Security | done 10-16 | owner console steps (publish rules, restrict the key); Studio token options A/B "ask before" | absorb: hardening phase does A and B |
| 03 Fresh base | done 10-16 | full quick check skipped; no picture baseline (made by the first phase tag) | keep |
| 04 Modernize (04a-04e) | done 10-18 | tag; check-studio-github in CI?; Studio local mode | keep |
| 05 Internal renaming | done 10-18 | tag | keep |
| 06 UI structure (06-1..06-4) | mostly done 10-19 | plan not fully met: ui.js ~3,000 lines not split, old CSS layers not emptied; owner's answer on a 06-5 session; tag | park 06-5; the run screens are new modules anyway |
| 07 Portraits | part 1 only (kit, slicer, portraits.json; nothing uses them) | renderer, Studio section, tests, old system removal | park (not needed by the loop) |
| 08 Movement, maps, rooms | 08a-1..3 and 08b-1..2 done; 08b-3 not | room templates and slot sets, Studio edits links/doors, the full quick check, the first picture baseline, tag | absorb: the run-loop phase composes generated maps on 08b's seam model; 08b-3 templates parked |
| 09 Props and terrain | partly: Copperleaf, Route 1, Marigold and the city set redone (batches 1-8) | the rest of the world's props; duplicates and unused props; baseline; tag | park: the other towns move to legacy anyway; run biomes reuse the done kits |
| 10 World-map bowl | done pending the owner's phone look (E-map-1..4, look s1-5, fixes) | phone look, then tag; the mthing shader location (ST-5/6 note) | absorb: the bowl must show a run's node map |
| 11 Opening | moved to Project Story S7-S8: the city plays from New game before the fall | lite version, sounds, logo, show-once skip (beat sheet "Still to do") | absorb: the first run starts from the airship (see opening decision) |
| 12 Ranch | not started (plan doc only) | everything | absorb: the ranch milestone |
| 13 Testing | 13a done (unit tests, check-fast, fixtures, graphics test, edit hook); 13b, 13c not | fixtures per group, parallel groups, waits, key shots; lazy debug code; opt-in error reports; smoke and full over budget | absorb: 13b's fixtures are what run tests need; 13c parked |
| 14 Studio | partly, early, through the Studio track (ST-0..ST-6) | performance, new editors for new formats, local mode | absorb: run-content editors come with their data sections |
| 15 Design and story | archived; story half → Project Story S4 (not done); design half (core loop, tax mechanics) never written | — | superseded: this plan is the design half |
| 16 Billies | prep + prototype part 1 (parts, 7 lines, Studio Parts) | starter split by body, passives, quirks, Prime moves, breed function, abominations, breeding sim, full roster | absorb: breeding/abominations in the ranch milestone; the rest parked |
| 17 Robots | prototype built, unapproved, untagged, debug-only | the "Ask me" list, first robot in play, balance bounds, 3D preview, paint, loadouts, crafting, wild robots | absorb: bots-as-enemies phase (sourcing from runs, the Voltron) |
| 18 Friends trading and battles | not started | everything | absorb: online phase (ghosts, daily seeds); trading stays out of scope |
| 19 Battle core | plan only, on branch `plan/engine-phases-19-21` | the whole phase; asks: mid-battle quit, Lullaby, finish 17's prototype first | absorb: it IS the state-separation phase |
| 20 Renderer batching | stages A, B, C-1, C-2 done; C5 and stage D not; frameBlock off by default | owner's phone check of the Frame block; tags 20a/20b | park |
| 21 Atlases and KTX2 | plan only, on the branch | — | park |
| Project Story | S1-S3 done; cutscene tools s1, s3 done (s2 not); S7 built; S8 partly (city before the fall) | S4 story bible, S5 Hazel's opening rewrite, S6 (waits for 19), S8's rest, cutscene tools s2 | absorb S5/S8 into the opening decision; S4, S6 parked |
| Studio track | ST-0..ST-6 done; ST-7 next | st-N-done tags local only; ST-5/6 questions | keep running alongside |
| Map generator | MG-1 done (routes); MG-2..MG-5 not | linking (MG-2), towns (MG-3), presets/regenerate (MG-4), checks (MG-5) | absorb: MG-2 and MG-3 are prerequisites of the run map |
| Other | Graphics test and bench done; debug session; Parts fixes 1-2 (PR #77, #78) | **PR #78's entry says its validation could not run** | hardening phase verifies #78 first |

Owner questions still open in HANDOFF that touch the rework: tags for 01-05, 06, 10, 20, ST-4..6, PS-S1/S2; phase 06's
06-5; phase 10's phone look; phase 17's prototype approval and ask list; phase 16's breeding mode (5.1); phase 19's
three asks; whether old account saves may be replaced (02).

### 0c. Old work the roguelite does not need (parked) and what it does need

Owner's decisions (this session): the rework is a **track**, `docs/phases/roguelite-track.md`, sessions **RL-1..RL-N**
tagged `rl-N-done` (like the Studio and Map generator tracks; 19 and 21 stay reserved on `plan/engine-phases-19-21`);
parked phases are **marked parked in docs/ROADMAP.md** with a note saying what brings them back.

**Parked (nothing in the rework depends on them):** 06-5 (ui.js split, old CSS); 07's remainder (portrait renderer,
Studio section, old system removal); 08b-3 (room templates, slot sets, Studio door editing); 09's remainder (the other
towns' props, dedupe, unused props: those maps go to legacy); 13c (lazy debug code, error reports); 14's remainder
(Studio performance, local mode); Project Story S4, S5, S6, S8's leftovers and cutscene tools s2; 16's remainder except
breeding (starter split by body, passives, quirks, Prime moves, full roster); 17's remainder except enemies (3D
preview, paint, loadouts, crafting, the workshop's place); 18's trading half; 20 C5 and stage D; 21; ST-7 and the rest
of the Studio track (runs alongside); MG-4, MG-5; the mthing shader location (a fix, not a dependency).

**On the path (remaining work the rework absorbs):** 02's Studio token options A and B (RL hardening); 10's bowl
showing a run's node map; 12 the ranch (all four functions); 13b's fixtures for starting inside a run; 16's breeding
and abominations (ranch milestone); 17's bots as enemies (trainer bots in runs, the Voltron, salvage); 18's async
battle half (ghosts, daily seeds); **19 battle core as the state-separation session**; MG-2 linking and MG-3 towns
(prerequisites of the run map); S7/S8's city opening (where it sits once the first run starts from the airship).
Count: 14 parked items, 10 on the path.

## 1. The reworked roadmap (what docs/ROADMAP.md becomes when the plan is approved)

- The roguelite rework is the spine: one track, `docs/phases/roguelite-track.md`, sessions **RL-1..RL-16** (plus
  MG-2 pulled onto the path), each one session unless marked, tagged `rl-N-done`, a HANDOFF entry per session, Plan
  Mode first, one cause per commit, the quick check tiers of docs/TESTING.md after every change.
- Tracks alongside: Studio (ST-7+), Map generator (MG-2 on the path; MG-3 when a town node needs it; MG-4/5 after
  the first cut), Project Story (S6 unblocked by RL-4; S4, S5, S8's leftovers parked until the first cut is played).
- Old phases stay in the roadmap in one table (section 0b): done in one line each, parked with what brings them back,
  absorbed with their RL session. docs/VISION.md gets a rewritten "How the game plays"; CLAUDE.md gains one ground
  rule ("a roguelite: hub + runs; every map outside the hub is legacy") and loses the stale camTo/dioTileHalf gotcha.
- Order after the first cut follows the brief (ranch, hub upgrades, relics, modifiers, bots, online).

| # | Session | Goal | Sessions | Playable |
|---|---|---|---|---|
| RL-1 | Hardening | brief 2.6-2.8, PR #78 verified, the set-aside bug, RNG facts written down | 1 | no |
| RL-2 | Golden record and RNG module | battle golden snapshot; `logic/rng.js` (mapgen's sfc32 moved); seeded `pickWeighted`/`spawn` | 1 | no |
| RL-3 | State separation | SAVE_VERSION 4; `meta`, `run`, `ranch` in the save; validators; `migrate` keeps a run's trip | 1 | no |
| RL-4 | Battle state injected (phase 19's core) | engine context `useBattle`, no save writes, silent host, `b.rng`, turn cap | 1-2 | no |
| RL-5 | Legacy parking and the world setter | 47 maps and their places to `game/data/legacy/`, `worldSetGraph`, fixtures and checks retargeted | 1-2 | no |
| MG-2 | Seam agreement in mapgen | generated parent/child pairs pass check-data's seam rules and a02_joins' numbers | 1 | no |
| RL-6 | Run map and clock logic | `logic/run-map.js`, `nodeTypes.json`, forecast, deadline; no UI | 1 | no |
| RL-7 | Run world | generated scenes installed and walkable, the bowl shows the run | 1-2 | no |
| RL-8 | Run loop and payout | airship start, town with paid healing, mini-boss, payout, resume: **first playable cut** | 2 | yes |
| RL-9 | Ranch A | the building, store and keep, train between runs, the keep-one rule | 2 | yes |
| RL-10 | Ranch B | breed safe/risky with abominations, hatch, passive income (cap, rollback guard, offline, server anchor) | 2 | yes |
| RL-11 | Hub upgrades, currencies, unlocks | `currencies/buildings/unlocks.json`, the Lab board, one unlock registry | 1-2 | yes |
| RL-12 | Relics and effects | `relics.json`, `events.json`, `logic/effects.js` (phase 19's handler table), picks | 1-2 | yes |
| RL-13 | Modifiers, tiers, mini-boss leaders | `modifiers.json`, bracket pick at the mast, the 8 leaders, overdue hardening | 1 | yes |
| RL-14 | Bots as enemies, salvage, the Voltron | `factions.json`, `bosses.json`, data-driven `alphaPhase`, a robot phase in the full test | 2 | yes |
| RL-15 | Online | run record, friend ghosts, daily seeds, rules and emulator tests | 2 | yes |
| RL-16 | Content packs and Studio editors | `mergeInto`, pack checks, editors for the new sections | 1-2 | yes |

Total about 22-28 sessions; the first cut (RL-1..RL-8 plus MG-2) about 10-13. If the scope is too big: RL-1..RL-8 with
MG-2, then play; then RL-9, RL-10, RL-11, RL-12, RL-13, RL-14, RL-15, RL-16. Cut order inside the ranch milestone: the
server timestamp first (keep the local guard), then risky breeding, then the walkable yard; never store/keep or train.

## 2. Architecture decisions (recommendations; options are in section 8 where the owner decides)

**2a. Where run, meta and ranch state live.** One save, three sub-objects: `saveData.meta` (capital, scrap, seals,
unlocks, building levels, run counts, tier), `saveData.run` (null in the hub: seed, tier, mapgen version, the node
map, position `{node, phase, battle}`, clock, deadline, forecast, relics, the saved relic offer, modifiers, the
hub snapshot, uid counter, battle counter, choice log, released Billies, hints) and `saveData.ranch` (pens, trainees,
nursery, income). `team, se, items, coins, trip, wild, eggs, flags, seats, visited` stay the **working fields**: the
run's live state while `run` is set, the hub's otherwise; `runStart()` snapshots them into `run.start`, `runEnd()`
converts and restores. Every engine and UI read stays as it is. Scenes are never saved; they regenerate from the seed.
SAVE_VERSION 3 → 4 with no migration (old saves set aside, as CLAUDE.md allows). Saved at run start, every node
arrival, every purchase, event choice and battle end (`save(); flushSave()`). Resume: `migrate()` must stop resetting
the trip when `run` is set (`saves.js:146-148`), both `migrate` and `validSave` bound `trip.node` by the run map;
`runWorldInstall(saveData.run)` runs in `boot.js` before `loadMapsAhead`; a run whose `mapgenV` differs from
`MAPGEN_VERSION` is abandoned with a message. Rejected: three stored documents (triples the set-aside/cloud code),
and "seed + choice log replayed on load" (the online architecture, not the first cut; the choice log is still kept).

**2b. Battle state as an argument, in green commits.** A module-local current battle in the engine
(`useBattle(b)`, `B()`), entry points (`runTurn`, `enemyOnly`, `catchRoll`, `applyItem`, `doSwitch`, `chooseAI`,
`benchCandidates`, `teamNeedsHp`) take an optional last `b` and default to the hooks value, so the UI's 165 reads of
`activeBattle` are untouched. Steps: golden-record test first (RL-2); `logic/battle-state.js makeBattle` returning
exactly today's object, proven by a snapshot; `B()` everywhere in the engine; the engine stops writing `saveData`
(XP to `B().sides[0].team`, `seen` to `B().seen`, copied by `endBattle`); `extra.host` with hook defaults for headless
fights; `b.rng` behind one `roll()` for the 16 draws; a turn cap (`rules.battle.turnCap`, 40). Side 0's team stays
`saveData.team` by reference in ordinary play (the Team tab sees live HP); a ghost fight or a sim passes a copy.
Phase 19's effect-handler table and replay log come later (RL-12, RL-15), when relics and ghosts need them.

**2c. One seedable RNG.** `logic/rng.js` = `mapgenHashString` and `mapgenRandom` moved unchanged (`rngFrom(seed,
salt)` → `{next, range, int, chance, pick, gauss}`, `rngFn` for `() => number`, `hashString`), re-exported by mapgen so
Studio drafts hash the same. Only `run.seed` is stored (10 base32 chars rolled at run start; `'d' + UTC date` for a
daily; a friend's seed for a ghost). Derived streams: `nodeSeed(i) = run.seed + '|n' + i`; scene `hash(nodeSeed +
'|scene')`; wild `rngFrom(nodeSeed, 'wild|' + visits)`; shop and event `rngFrom(nodeSeed, 'shop|' + day)`; weather
`rngFrom(nodeSeed, 'weather|' + day)`; battle k `rngFrom(nodeSeed, 'battle' + k)` as `b.rng`; relic offers
`rngFrom(run.seed, 'relic|' + n)`. Counters live in `run`, so a resume continues the streams. Onto the stream: the
bribe (`battle.js:937`), the egg drop (`:999`), `hatchEgg`'s coat (`coatRoll` already takes `rnd`). Stays on
`Math.random`: particles, ambient life, sound, clouds, `tid`, hub-only rewards. `newUid` in a run becomes
`'r' + meta.runs + '-' + run.uidN`; weather in a run comes from `run.forecast` through `extra.wx`, never `Date`.
Proof: `tools/test/sim/run-sim.mjs` plays one seed twice and asserts equal maps, scene hashes, encounters, shops and
battle events (sample in `npm test`, full nightly). Rejected: seeding `util.random` itself (visuals would eat draws).

**2d. Modular feature registration.** A feature is a data section following the biomes pattern (file, `index.json`
key, schema, type, check-data block, `game-data.js` export), added when its session needs it: `nodeTypes` (RL-6),
`currencies`, `buildings`, `unlocks` (RL-11), `relics`, `events` (RL-12), `modifiers` (RL-13), `factions`, `bosses`
(RL-14). Code grows only **effect kinds** (`logic/effects.js`: `rule`, `stat`, `price`, `heal`, `money`, `catch`,
`clock`, `start`, `boss`, applied at named hooks: `battleStart`, `damage`, `catchOdds`, `shopPrice`, `heal`, `payout`,
`nodeArrive`; relics, brackets, badges, perks and building levels compile into `run.fx`) and two **node engines**
(`scene`: a walkable map; `menu`: a story script or shop sheet; new script commands `relic`, `wager`, `breed`).
`currencies.json` has four rows and check-data fails on a fifth. `unlocks.json` is one table with three doors (`cost`
on the board, `shop` at a building, `auto` by condition) and `requires` drawing it as a tree; new condition kinds
`unlock:` and `won:`. Content packs: `game/data/packs/<pack>/index.json` in the same `{keys, split}` format merged by
`PB_DATA.mergeInto` (build, Studio, fallback), ids prefixed `<pack>_`, duplicates a check-data error, text escaped on
output; no code in packs, no remote loader (RL-16). Rejected: a JS plugin registry (packs would ship code), a DSL.

**2e. The node map, clock, bowl, seamless world, airship.** (Built in RL-6 as section 0 says: `runMapMake(seed,
nodeTypes, rules.run.map)`, `runMapStart`, `runArrive`; the rows' roles are rules.json `run.map`'s, fillers are
nodeTypes.json weights; shops and their apart rule come with RL-12.) `run.map` from `logic/run-map.js runMapMake(seed, tier,
nodeTypes, rules.run)`: a layered DAG, row 0 the landing, rows 1..R-2 of one or two nodes (two lanes, a merge every
2-3 rows), the boss last; R = 9 (estimate) gives about 14 nodes with 9 walked. Row rules in `rules.run` (a town
before each mini-boss, mini-bosses near R/3 and 2R/3, no two shops adjacent). Reveal: on arrival at row r, row r+1
becomes `seen` with its type icon, row r+2 shows "?" pins. First node types: `landing`, `route`, `town` (clinic door
= paid heal, shop door, one event NPC), `miniboss`, `boss`; `event` and `shop` menu nodes later as tiny generated
waystation scenes whose hub prop opens the menu (one mechanism: every node is a location). **Seams decided by the
code:** every run scene 112×64; forward links leave by N and arrive by S at `t ∈ {0.25, 0.5, 0.75}` (28, 56, 84 m:
integer offsets, 56 m apart ≥ check-data's 44 m, bands 52 m wide after the composer's midpoint clip); MG-2 gives
`mapgenScene` a `params.edges` strip copied from the parent's edge and eased inward; scenes generate lazily one hop
ahead (136-451 ms each in Node). **Node indices:** `worldSetGraph(locations, roads)` (a move of the import-time
derivation in `game-data.js:288-358` into a function, RL-5) mutates the exported tables in place; the run's install
(RL-7) bumps `seamlessWorld.gen` and calls `worldBowlReset()` (game-data.js is logic and can't); the run table is
**Copperleaf at index 0 plus the run's nodes**, so `START_NODE` stays, the airship has an origin, and `trip.node = i +
1`. Run nodes are ordinary location rows (`id: 'run_<i>'`, `mapId`, kind, biome, pool, battleStage, bowl spot from row
and lane); run trainers are runtime `TRAINERS` entries removed at run end; scenes go into `gameData.maps` without
`_lite` (never fetched); friends see `place: 'On a run'`, node 0. **Clock:** `run.clock` counts days; entering any
node, forward or back, costs one day; the day drives (1) `run.forecast[i][day]` (seeded per node and day from the
climate odds moved into `logic/weather.js`; `environment.force.weather` on arrival; every battle gets `extra.wx`), (2)
`run.deadline = shortest path + slack (3)`, past which each day adds levels to foes and prices to shops through effect
rows, (3) shop and event rolls keyed by the day. The player sees "Day N · deadline day M" on the Map tab and walk HUD,
weather icons on seen pins, a red chip past the deadline. Backtracking costs one day and a smaller re-rolled wild
stock. **Bowl:** no change beyond the swapped tables; hidden nodes carry a gate the run's `canEnter` refuses.
**Airship:** `startAirshipFlight(1)` unchanged except a `free` flag; the landing scene places an `airship_station`
prop at its hub with `mapgenPutProp`, so `flyLand` works; a kill mid-flight resumes at the landing because `trip.node`
is set first.

**2f. Parking the legacy maps.** Move the 47 location maps with their locations, roads, trainers, shops, jobs,
fishing, regions, lore and postcards under `game/data/legacy/` with their own `legacy/index.json`, read by the Studio
as a read-only Legacy group with "Copy into game"; `index.json` keeps `copperleaf`, every `int_*`, every `test_*`,
`gallery`, `city_opening`. Parked locations leave `locations.json` (Copperleaf becomes index 0; the world-graph
snapshot is remade on purpose). The 8 badge leaders stay in `trainers/` with `miniboss: true`, handled by the
"waits on no location" branch next to `tutorial`. Copperleaf's south exit is removed (owner's call, 8.3). Retargeted:
`fixture.js:34-40`, the check-quick and self-test lines naming parked places, `story.json:38,66`. check-data validates
legacy maps against `map.schema.json` only. Rejected: a `world: 'legacy'` flag (13 MB and 47 map fetches would stay,
against "not loaded in the new flow") and deleting them (the Studio would lose them).

## 3. Design answers

- **Four currencies** (`currencies.json`; names are placeholders, 8.5): **$** (`se`, run; wild prizes, trainer
  rewards, bribes, events, releasing a run Billy → healing in towns, run shops, wagers; converts at run end).
  **Capital** (`meta.capital`, the unlock currency; payout = money at a rate + items at half price + released Billies +
  per node cleared + a win bonus, plus milestones → the Lab's board and shop-style unlock rows). **Scrap**
  (`meta.scrap`, the building material; bot salvage, scrapyard nodes, ranch income → Ranch and Workshop levels,
  breeding fees, part upgrades). **Audit Seals** (`meta.seals`, rare; 1 per final-boss win, 1 per first mini-boss kill
  per tier → the Airship: new areas and node types, the next tier's starting perk, a one-off second keep on a loss).
  One currency per building as decided: Lab = Capital, Ranch and Workshop = Scrap, Airship = Seals, town shops = $.
  The Platinum Coin is not reused.
- **Relics ("Loopholes"; data section `relics`, since `loophole` is an item id):** about 6-8 a run: a pick of 3 at
  each of 2 mini-bosses, 1 for $ in each shop, 0-1 from events; held cap 6 (8.14). Shown as three face-up rows (the
  `flyMenu` pickrow pattern); the offer is saved before it is shown.
- **Difficulty tiers:** "Brackets" I-V in `modifiers.json`: foe levels +2 each, deadline slack −1 from III, boss HP
  ×(1 + 0.15N), prices +10%N, a bot trainer in the pool from III. Winning N unlocks N+1 (`auto: 'won:bracket_N'`).
- **Battle formats:** by node type: routes single, town and mini-boss trainers double, the final boss an Alpha fought
  by three; a 40-turn cap on every battle (the sim saw 70-190-turn stalls). No engine change.
- **Keep-one vs ranch levels (owner's call, 8.2):** recommended: ranch Billies travel and return on a loss at the
  level they left with (the run's gains are lost); run-caught and bought Billies are lost except the one you choose,
  which keeps its gains (choosing a ranch Billy keeps its gains too); a per-tier cap on ranch Billies per run (1 at
  Bracket I) so most of the party is run-caught. Both sentences hold and a trained Billy is never wiped out.
- **Party of 6:** no box in a run; a seventh replaces one or is released into `run.released`, paid as Capital at the
  payout; more can be released on the payout screen. Wager stakes: an item or a run-caught Billy, never a ranch one.
- **Healing:** run towns' clinic charges `rules.run.healCost` (flat $60, estimate) per injured Billy; free only in
  the hub; items heal anywhere; `restCost` retired.
- **First final boss, a Voltron as an Alpha:** `bosses.json {id, fighter: {kind: 'robot', gem, torso, armL, armR,
  legs}, boss: {hp, st, levels}, phases: [{at, shield, stages, say, breaks}], join: '<cutscene>', rewards}`;
  `makeBossRobot(def)` = `makeRobot` + `m.boss`; `fmt: 'alpha'` gives boss HP, double actions, aimed hits, limb
  breaks unchanged; the four slots **are** the four bots (a leader torso, two arm-bots, a leg-bot), each a boss-rarity
  part with art in `robots.json`. One engine change: `alphaPhase` reads `m.boss.phases` from data (today's 50 % rule
  as the default) and a phase may break a limb ("a bot tears loose"). Visuals: a join cutscene (four rigs walk in, a
  flash, one rig at Alpha scale 1.6), broken limbs faint with the bot dropping. Several separate bots would widen the
  foe side: rejected for the first boss.
- **Mini-bosses as gym leaders with badges as relics:** accepted, changed: the 8 seat holders become the mini-boss
  pool ("Auditors"), rescaled by `trainerTeam`; a win offers the badge as a run relic and records the seat for
  `badges >= n` conditions; no node is gated by badges.
- **Pokédex as meta:** accepted as `unlocks.json` rows with `auto: 'caught >= 15'` or `billie:<line>`.
- **One unlock system:** one table, three doors (board, sold at a building, milestone), one `meta.unlocks` record,
  one screen with three looks.
- **Breeding (RL-10):** safe: two parents of one line, parts by rule from the parents' uids, coat by `coatRoll('egg')`,
  Scrap plus a real-time timer, the result shown before confirming. Risky: any two lines, half the Scrap, seeded:
  60 % as safe, 30 % a quirk (a passive and a parent move, a coat or size swing), 10 % an **abomination** (mixed S/L
  parts through `logic/parts.js`, a portmanteau name, a stat spike with a drawback passive, a "???" Index page). Good
  for: a unique passive, double Capital on release, wager bait, some relic conditions. The breeding sim reports before
  any bound is asserted. Hatchery node: after the ranch, as a `breed` event command.
- **Ranch passive income (RL-10):** `ranch.income = {rate, cap: 24 h, lastAt, bank}`; on opening, `gain = clamp(now −
  lastAt, 0, cap) × rate`; if `now < lastAt − 60 s` nothing pays and `lastAt` only moves forward; offline is the same
  computation from device time within the cap; signed in, the cloud save gains `t: serverTimestamp()` with a rule
  (`t == request.time` and a key whitelist on `saves/{uid}`, a behaviour change: 8.12) and `lastAt = max(lastAt, t)`
  on load. Emulator test for the rule; unit tests for cap, rollback, anchor.
- **A new player's first run:** the opening stays as built (city → fall → Hazel → starter → Blake); Hazel's last
  lines send you to the mast, replacing `story.json:38` and `:66`; the first run is normal with `hintOnce` toasts
  (first node, forecast, paid heal, relic, payout); no scripted three-node run (a `?story=firstrun` test preset instead).
- **Bots as an enemy faction first (RL-14):** `factions.json bots` with a wild pool of `'bot:<torso>'` entries built
  by `makeRobot`, bot trainers ("Collectors") at route nodes, a scrapyard node type, robots never taxable, salvage
  after a win (1 of 3 parts into `saveData.parts`, or Scrap), the Voltron. Kept possible for playable bots: the part
  library, `saveData.parts`, `buildRobot`, the Workshop as a hub building later.
- **Online (RL-15):** `logic/run-record.js` `{v, seed, tier, days, result, score, party ≤ 6 (sp, kind, gem, fit,
  lvl, moves, coat, nick), relics ≤ 6, path, name, hash}` under 8 KB, `validRunRecord` strict like `validSave`,
  `cleanName` on nicks. Firestore: `ghosts/{uid}` (owner writes with a key whitelist and sizes; friends read through
  the `users/{uid}.friends` pattern) and `daily/{date}_{uid}` (create-only, `uid == me()`); no listing. A ghost fight
  is the friend's party as an AI trainer at a `rival` node (no turn replay needed); a daily is the same seed for
  everyone with friends' scores on the payout screen. Rules check shape and size only.
- **Suggestions:** tax-bracket tiers accepted; loophole relics accepted (player word); part salvage accepted
  (RL-14); wager nodes accepted after relics as an event command; hatchery node changed to after the ranch; save at
  every node accepted as a requirement; scripted three-node first run rejected (hints instead).

## 4. Phases in detail

**RL-1 Hardening.** Goal: brief 2.6-2.8, PR #78 verified, RNG facts written down. Files: `studio/js/github.js:131,
137` (SECURITY A and B), the 16 version-stamped tools (delete, 8.11), `eslint.config.js:2-5`, `CLAUDE.md:30`,
`docs/SECURITY.md` (`cleanName` is `rules.js:210`; SAVE_VERSION 3), `game-state.js:106-113` + `account.js:304-310`
(one set-aside shape, one writer). Tests: `tools/test/rng-baseline.test.mjs` (`util.random === Math.random`; two
seeded battles identical); first run #78's unrun checks (`npm test`, typecheck, smoke) and fix or revert. Could break:
Studio sign-in (`check-studio-github.py`), the set-aside restore UI, check steps importing deleted tools. Verify:
tiers (a), (b), before-commit, smoke. 1 session. The owner pushes the outstanding tags.

**RL-2 Golden record and RNG module.** Files: new `tools/test/battle-golden.test.mjs` (single, double, alpha,
robot; a planted fault seen to fail), new `logic/rng.js` (one move commit, one rename commit; mapgen imports it
back), `logic/rules.js` (`pickWeighted(list, rnd)`, `spawn(…, rnd)`, `dailySeed(now)`), `game/index.html` +
`npm run modules`. Tests: `rng.test.mjs` (same seed same stream, salts independent, first five values frozen, the
UTC daily seed, a known mapgen scene hashes the same), `mapgen.test.mjs` unchanged. Could break: Studio drafts,
encounter spawning. Verify: (a), (b), smoke. 1 session.

**RL-3 State separation.** Files: `logic/saves.js` (SAVE_VERSION 4, `newSave` with `meta`, `run: null`, `ranch`;
`migrate`/`validSave` bounded by the run map, no trip reset while `run` is set), new `logic/run-state.js` (`newRun`,
`validRun`, the pure parts of `runStart`/`runEnd`, `payoutOf`), `logic/meta-state.js`, `logic/ranch-state.js`
(validator only), `game/types/save-data.d.ts`, the title's set-aside message. Tests: `saves.test.mjs` (a run-shaped
save keeps trip, plan, visited through `migrate` with a one-entry LOCATIONS; bad run shapes refused), new
`run-state.test.mjs`, `meta-state.test.mjs`. Could break: every save on the owner's phone and account is set aside
(intended, 8.12), cloud restore, backup import. Verify: (a), (b), check:data, smoke (Start-Game, save round trip,
debug log export). 1 session.

**RL-4 Battle state injected.** Files: new `logic/battle-state.js`, `logic/battle-engine.js`, `game-state.js`
(`setActiveBattle` calls `useBattle`), `battle.js endBattle` (copies `B().seen`; bribe and egg rolls onto `b.rng`),
`tools/test/sim/robot-sim.mjs` (silent host), `rules.json battle.turnCap`. Tests: `battle-state.test.mjs` (snapshot
equality incl. the `act` getters, copied team untouched, replay equality, headless `said` empty),
`battle-engine-state.test.mjs` (two battles in one process), turn-cap test; the golden record unchanged at every
commit. Could break: every battle, the opening's Blake battle, the full test's double and Alpha phases, the catch
flow. Verify: (a), (b), smoke, the full check's battle steps, `--selftest` battle phases. 1-2 sessions. HANDOFF says
Project Story S6 may proceed.

**RL-5 Legacy parking and the world setter.** Files: `game/data/maps/*` → `game/data/legacy/maps/` (one move commit),
`legacy/index.json`, `index.json`, `locations.json`, `roads.json`, `trainers/*` (8 leaders `miniboss: true`),
`shops.json`, jobs/fishing/regions/lore/postcards (one commit each), `maps/copperleaf.json` (south exit),
`story.json:38,66`, `game-data.js` (`worldSetGraph` move commit; the `miniboss` branch at 393-396),
`tools/check-data.mjs` (legacy schema-only; miniboss skip), `studio/js/check.js:223`, the Studio Legacy group,
`fixture.js:34-40`, `tools/check-quick.py` and `self-test.js` lines naming parked places, the world-graph snapshot
(remade on purpose, said in the commit). Tests: world-graph on the hub alone; new `world-graph-set.test.mjs`
(`worldSetGraph` rebuilds and restores exactly). Could break: Start-Game (`START_NODE` 0), the bowl with one place,
map look-ahead, the smoke phone flow, postcards. Verify: (a), (b), check:data, smoke, Studio check; full check and
`--selftest` at the end. 1-2 sessions.

**MG-2 Seam agreement.** Files: `logic/mapgen.js` (`params.edges` strip copy and inward easing; `mast`/`clinic`/
`shop` props at the hub by params), `studio/js/map-generate.js`. Tests: `mapgen.test.mjs` (a parent/child pair
passes `logic/seam-rules.js`, the check-data rules re-implemented once in Node, and a02_joins' numbers). Could
break: the Studio's Generate card. 1 session.

**RL-6 Run map and clock logic.** Files: new `logic/run-map.js` (`runMapMake`, `runReveal`, `runNext`, `runArrive`,
`runOverdue`, bowl spots), `logic/weather.js` (move of `CLIMATE_WEATHER_ODDS`; `weatherPick(climate, rnd)`),
`data/nodeTypes.json` + schema + type + check + export, `rules.json run`. Tests: `run-map.test.mjs` (same seed same
snapshot, every node reachable, 8-12 nodes on every path, row rules, reveal, backtrack ticks, forecast determinism,
deadline maths). Could break: nothing in the page. 1 session. Done 2026-10-21 (HANDOFF; section 0 for what changed
from this paragraph): also `runMapRows`, `runMapStart`, `runBack`, `runExits`, `runSpot`, `runForecastFill`, biome
climates, the payout's distinct nodes; `run-map-real.test.mjs` and `weather.test.mjs`.

**RL-7 Run world.** Files: `game/index.html` (+ mapgen), new `run-world.js` (`runWorldInstall`/`runWorldRestore`,
lazy generation, run trainers, `seamlessWorld.gen++`, `worldBowlReset()`), `boot.js` (install before
`loadMapsAhead`), `world-bowl.js` (locked pins, day chip, forecast icons), `rules.js encounterStock` (`stock`),
`environment.js` (forced weather on arrival). Tests: `run-world.test.mjs` on real data (every run road's exits face
and align; restore leaves the hub tables as before). Could break: the walk view when tables change mid-session,
seamless caches, name-free debug log. Verify: (a), (b), smoke, a quick-check step on `?fixture=run` (install, open the
map, walk one seam). 1-2 sessions. Done 2026-10-21 in one session (HANDOFF; section 0 for what changed from this
paragraph): `logic/run-scenes.js` and `game/js/run-world.js` (`runWorldSync`, all scenes at once), `worldPut` and
`worldHubBack`, the weather from the forecast, the bowl's run pins and day chip, a run place's wild stock; tested by
`run-scenes.test.mjs`, `run-world-real.test.mjs`, the `run` fixture, a fast-check page, a quick-check step and an
in-game test phase. Run trainers moved to RL-8.

**RL-8 Run loop and payout (first playable cut).** Files: `logic/battle-rewards.js` (move of `endBattle`'s arithmetic
first, with a fixture test that the numbers match), new `run.js` (start from the mast, arrival checkpoints,
`hintOnce`, abandon), `run-payout.js` (payout screen, keep-one picker), `airship.js` (`free`), `ui.js` (clinic cost in
run towns, the mast act), `shop.js` (seeded stock), `things-to-do.js` (`extra.wx`), `friends.js` (node 0 in a run),
`story.json` (Hazel's mast lines), `fixture.js` (`run`), `self-test.js` (phase "A run: airship, nodes, payout"),
`debug-menu.js` (start a seeded run). Tests: `run-state.test.mjs` (payout, release, keep-one, resume),
`battle-rewards.test.mjs`, `sim/run-sim.mjs` (replay equality; run-length statistics reported), a quick-check group on
the `run` fixture (mast → flight → node → battle → town heal → mini-boss → payout; reload mid-run resumes), the
smoke phone flow extended by the mast tap. Could break: Start-Game, the opening's end, the phone flow, the full
test's airship step, the debug log export. Verify: all tiers, `--selftest`, then the owner's phone. 2 sessions. Done 2026-10-21 in one session (HANDOFF;
section 0 for what changed from this paragraph): `logic/battle-rewards.js`, `logic/run-loop.js`, `run.js`,
`run-payout.js`, the run's buildings, battles (seed, forecast weather, checkpoint and restart), towns (paid clinic, the
day's shop), mini-bosses and the Alpha boss, the payout and resume, `sim/run-sim.mjs`, the fall-only opening, hints, the
debug menu's runs; tested by `battle-rewards`, `run-loop` and `run-sim` tests, a fast-check page, a quick-check step and
an in-game test phase. The owner played it the same day (section 5's notes).
**Nothing below starts before the owner has played.**

**RL-9 Ranch A.** The ranch as a hub building (a barn room via `enterRoom`; `int_barn` exists; the walkable yard is
cut first if time is short), store and keep (the box behind it), train (Scrap + real time → levels through
`gainXp`, capped by building level, the rollback guard shared with income), the keep-one rule as decided. Files:
`logic/ranch.js`, `ranch.js`, `scenery.json` props, `buildings.json` stub, `self-test.js` (ranch step),
`check-quick.py` (edit-and-reload step, TESTING.md phase 12). Tests: `ranch.test.mjs`. Could break: team/box screens.
2 sessions.

**RL-10 Ranch B.** Breeding safe/risky with abominations, hatching on ranch time, passive income with cap, rollback
guard, offline, the cloud `t` anchor and its rule. Files: `logic/breeding.js`, `logic/ranch.js`, `logic/rules.js`
(eggs), `account.js:331-351`, `firebase/firestore.rules` + `firebase/test/rules.test.mjs`,
`tools/test/sim/breeding-sim.mjs` (reports only until bounds are agreed). Could break: cloud saves (publish the rule
after the emulator passes). 2 sessions.

**RL-11 Hub upgrades, currencies, unlock board.** `currencies.json`, `buildings.json` (Lab, Ranch, Workshop, Airship),
`unlocks.json` with the three doors, `logic/unlocks.js` (`unlockReady`, buy, auto at payout and on load),
`conditions.js` (`unlock:`, `won:`), `hub.js` board screen, `copperleaf.json` building variants per level. Tests:
`unlocks.test.mjs`, `conditions.test.mjs`, check-data (a fifth currency fails, every grant exists). 1-2 sessions.

**RL-12 Relics and effects.** `relics.json`, `events.json` (scripts with `relic`, `wager`), `logic/effects.js` (kinds,
hooks, `B().fx`; phase 19's handler idea), one hook call each in `calcDamage`, `catchOdds`, `newBattle`, the pick
sheet, the Bag's relic list, the waystation node engine. Tests: `effects.test.mjs` (each kind, stacking order, a run
with every relic stays finite), a golden battle with a relic, story checks on events. 1-2 sessions.

**RL-13 Modifiers, tiers, mini-boss leaders.** `modifiers.json`, the bracket pick at the mast, the 8 leaders as the
pool with badge relics, overdue hardening as effect rows. Tests: tier effects on levels, prices, deadline; leader
teams rescale within 1..100. 1 session.

**RL-14 Bots as enemies, salvage, the Voltron.** `factions.json`, `bosses.json`, boss parts and art in `robots.json`,
`rules.js spawn` (`bot:` entries, never taxed), `battle-engine.js` (`alphaPhase` from data, `makeBossRobot`),
`battle-stage.js` (join intro, limb drop), the salvage sheet, `self-test.js` (a robot phase). Tests: `robots.test.mjs`
(boss build, phases, limb loss, never caught), robot-sim with boss builds, the golden snapshot extended. 2 sessions.

**RL-15 Online.** `logic/run-record.js`, `friends.js` (ghost source, `rival` node type), `daily.js`,
`firestore.rules` (`ghosts`, `daily`) + emulator tests (owner writes, friends read, size, key whitelist, no listing),
`account.js`. Tests: `run-record.test.mjs` (shape, size, hostile names, a deterministic ghost fight), a planted-name
check on the record. Could break: friend presence. Verify: rules job, smoke's debug-log privacy check. 2 sessions.

**RL-16 Content packs and Studio editors.** `data-files.js mergeInto`, `build-data.mjs`, `check-data.mjs`, the Studio's
pack filter, generic data editors for the new sections, `docs/CONTENT-PACKS.md`. Tests: `packs.test.mjs` (merge,
duplicate id refused). 1-2 sessions.

## 5. First playable cut (after RL-8)

As built in RL-8 (the owner's answers to 8.8, 8.9 and 8.20): New game plays the fall from the crust → Copperleaf
(Hazel, the dressing room, the coins, the starter) → Hazel's last lines point at the airship mast → the mast's "Start a
run (Bracket I)" (your team as a copy, $600, 5 Copper Coins, 2 Potions; storage stays home) → a free flight to the
landing, day 1, beside the landing's mast → the run's map (9 rows, 9-14 places, about 9 walked; the next row shown,
'?' after, the boss always) → wild battles one on one, each seeded and checkpointed → towns: a clinic at $60 a hurt
Billie and a shop with the day's stock → two mini-bosses (a leader copied to the row's level + 3, doubles, blocking the
way north) → the boss (a third leader's top Billie as an Alpha at + 5, fought by up to three) → win, or wipe → the
payout (Capital from money, items and released Billies; Seals on a win; on a loss pick one Billie to keep) →
Copperleaf by the mast, healed, Capital and Seals in the Map header. "Give up the run" in the Map tab, "Fly home" at the
landing's mast. Killing the app anywhere reopens there: at the place, mid-battle (the battle starts again from its
seed), mid-flight (on the landing) or at the payout.

Stubbed: relics, modifiers (Bracket I = no effects), event nodes, route trainers, bots (the boss fields a Billie, not
the Voltron), the ranch, the unlock board (Capital is a balance only), deadline hardening, the return flight's
animation, online, hub trainers. Balance is untuned: the run simulation (`tools/test/sim/run-sim.mjs`) loses every run
on the placeholders (HANDOFF RL-8).

**The owner's notes after the first play (2026-10-21), for the plan:**
- It got stuck: a run's landing couldn't be left (fixed in RL-8: bridges walkable over steep banks; bridges only where
  the road crosses a stream, square to it, dry at both ends).
- "The bridge was turned the wrong way" (the same fix).
- Rooms are too bright.
- Routes should be wider than they are long: it's an HD-2D diorama.
- Copperleaf's world map should be Copperleaf's island alone.
- A run gets its own world map, generated from its seed.
The last four are new work, waiting for the owner's choices (HANDOFF RL-8, "Next").

## 6. Leave alone (no refactor without evidence)

The renderer (`engine/`, `walk/`, `walk-view.js`, `world-bowl.js`'s GPU half, `battle-stage.js`): the run reaches
them through tables and entry points they already read. `seamlessCompose` and the room composer. The giant functions
(`runFullTest`, `battleStagePlay`, `makeBuildingModel`, `setBuildGroundMesh`, ui.js's click handler): add steps, don't
split (06-5 is parked). `hooks.js`/`to-module.mjs`: the bridge stays; the UI keeps reading `activeBattle` from hooks.
Explicit battle parameters everywhere and id-based node identity: not without a second concurrent battle or two
worlds at once. `environment.js`'s real-clock day/night in the hub. The story layer and opening structure. `validSave`'s
strictness, the set-aside policy, the one-string cloud shape (only `t` is added). `innerHTML` + `escapeHtml` +
`cleanName` (new screens follow the rule; ghost names go through `cleanName`). Studio editors beyond a Legacy group,
a pack filter and the new sections' editors.

## 7. Risks and unknowns

**Verified facts:** everything in sections 0, 0b-0c and the spot checks: `random` unseedable at runtime; the engine's
16 draws and three page-side outcome rolls; `mapgenRandom` pure and versioned; the engine shares `saveData.team` by
reference and writes XP and `seen`; weather enters battles only through `activeBattle.wx` and `environmentWeatherFor`
short-circuits on force/preferences and uses local time; `migrate` resets the trip at load; node indices are identity;
`LOCATIONS` is the raw array; `START_NODE` is a const; injected non-lite maps are never fetched; the seamless cache
keys on `gen`; `startAirshipFlight` sets `trip.node` first; the 44 m exit rule and 26 m bands; `check-quick.py` pins
`Date`; `CLIMATE_WEATHER_ODDS`/`WEATHER_TYPE_BOOSTS` live in browser files; mapgen is not loaded by the game page;
trainers already field robots; `loophole` is an item id; `fixture.js` names four parked places; `story.json:38,66`
point at Hedgerow and Marigold; no server timestamp is used; 13 rules tests; no phase tag on the remote; PR #78 is
unverified; no Node modules or Playwright here, so nothing in this plan was executed.

**Inferences and estimates:** phone cost of generating scenes (2-4× Node's 136-451 ms; lazy generation and the
ground-paint worker as fallback); MG-2's edge strip being enough for a02_joins on generated pairs; a 112×64 scene at
20-40 KB; battle length (an in-memory sim, not telemetry); 25-40 minutes per run and the deadline numbers; the bowl's
look with one hub place and a 14-node fan; `serverTimestamp()` from the compat SDK as loaded; where the clinic's heal
triggers (RL-8 finds it); run-map constraints yielding good maps (the sim and the first play decide); the ghost record
under 8 KB; every payout rate, cap and bracket number is a placeholder in `rules.run`; `tsc` may need the owner's
machine or CI (it crashed in the #78 container).

## 8. Ask me before (the owner's decisions; recommendation first)

Decided this session: the rework is a track RL-N (`rl-N-done`); parked phases are marked in the roadmap.

1. **Internal key for the run:** `run` as is (recommended; `storyRun`, `runBase`, `runTurn` are functions, no save-key
   clash) / `run` after renaming the story layer's `runBase/saveDuringRun/storyRun` / `voyage`. Player word "run".
2. **Keep-one vs ranch levels:** option 3 in section 3 (recommended) / ranch Billies never at risk with a per-tier cap /
   everything at risk, the ranch only trains.
3. **Hub extent:** Copperleaf alone with the south exit removed (recommended) / Copperleaf + Hedgerow Lane as a practice
   route / the exit kept behind a fence (check-data needs a `closed` exit).
4. **Legacy parking:** move under `game/data/legacy/` with a read-only Studio group (recommended) / a `world: 'legacy'`
   flag (nothing moves; 13 MB and 47 map fetches stay).
5. **Currency names and buildings:** $ / Capital / Scrap / Audit Seals with Lab = Capital, Ranch and Workshop = Scrap,
   Airship = Seals (recommended) / Money/Capital/Scrap/Seal / $/Ledger/Copper/Bonds / the Platinum Coin reused (no).
6. **Menu nodes on a walked map:** tiny generated waystation scenes whose hub prop opens the menu (recommended, from
   RL-12) / a gate prop at the previous seam / events and shops folded into towns (the first cut has only this).
7. **Mid-battle kill:** restart the battle at the node from the same seed and battle index (recommended for the first
   cut) / save the battle object every turn and resume it (phase 19's recommendation; later option).
8. **First-cut shape:** five nodes made, four walked, one branch (recommended) / four in a line / the full ~14-node map.
   **Answered in RL-8: the full map** (9 rows), with a 5-row short run in the debug menu.
9. **Battle formats and turn cap:** by node type with a 40-turn cap (recommended) / singles everywhere / cap 30.
   **Answered in RL-8: by node type** (wild single, a mini-boss a leader in doubles, the boss a leader's top Billie as
   an Alpha fought by up to three), the cap 40; a wipe or a trainer battle at the cap ends the run; keep 1 Billie on a
   loss, all on a win.
10. **Clock numbers:** a day per arrival including backtracking, deadline = shortest path + 3, no tick for healing or
    waiting until the first play (recommended) / + 5 / healing +1 and waiting +2. **Answered in RL-6: the
    recommendation** (rules.json `run.clock`).
11. **Hardening items that change behaviour:** SECURITY A and B, delete the 16 version-stamped tools (recommended) /
    move the tools to `tools/legacy/`.
12. **SAVE_VERSION 4** sets aside every current save on your phone and account; and the `saves/{uid}` key whitelist
    with `t` in RL-10 (recommended yes to both).
13. **`seen`/`caught`:** stay top level (recommended) / move to `meta.dex` now (14 reader files).
14. **Relic cap:** 6 held (recommended) / 8.
15. **Hub island look after parking:** only Copperleaf on the terrain (recommended) / parked places as bowl-only pins
    (both world-graph tests change on purpose).
16. **Ranch cut order if RL-9/10 overrun:** server timestamp, then risky breeding, then the walkable yard (recommended).
17. **Order after the first cut:** the brief's (ranch, hub upgrades, relics, modifiers, bots, online; recommended) /
    relics and currencies before the ranch.
18. **Tuning placeholders in `rules.run`:** rows 9, slack 3, healCost 60, the Capital rate, relic cap 6, turnCap 40,
    income cap 24 h, as starting values. **RL-6 took the map's:** 9 rows, 2 mini-bosses, two lanes on 70% of free
    and town rows, a lane switch on 25% of lane pairs, the five biomes with finished plants (meadow 3, lake 2, thicket
    2, ridge 1, autumn 1, each node its own); reveal the next row, '?' on the row after, the boss always.
19. **Tags:** push the outstanding `phase-*`, `st-*`, `mg-*` tags from your machine so CI's full run can fire on
    `rl-*`.
20. **Opening:** keep city → fall → Hazel/Blake and add Hazel's "the airship is waiting" lines (recommended) / shorten
    to the fall only for a faster first run. **Answered in RL-8: the fall only**, Blake cut from it (his data kept),
    Hazel's new lines send you to the mast.

# Naming

Internal names only: files, functions, variables, constants, data sections, data keys and ids. Player-facing words
(and the Studio's labels, the debug log's words, URL parameters) stay as they are unless a phase says otherwise.
Lint enforces what it can (see the end). Every old -> new name of phase 05 is in
[archive/phase-05-renames.md](archive/phase-05-renames.md), for reading old debug logs, branches and notes.

## Vocabulary

| Concept | Name in code and data | Notes |
|---------|-----------------------|-------|
| The 3D overview of the whole world | `worldMap` (world-map.js, world-map-gl.js, `worldMap*`, `worldMapGl*`, `worldMapMini*`) | was map, MAP, mgl, mm |
| A walkable area: a town, a route area, a room | `map` (data section `maps`, files `maps/<id>.json`, `mapById`, a location's `mapId`) | was scene |
| The view of a map you walk in | `walkView` (walk-view.js) | was DIO, dio*, diorama |
| Its WebGL renderer | `walkRenderer` (walk/walk-state.js) and descriptive names (`drawGround`, `shadowPass`) | was DGL, dgl* |
| The renderer's 3D scene, a cutscene or story scene | `scene` | the only meanings `scene` keeps |
| A named place on the world map | `location` (data section `locations`, `LOCATIONS`, `LOCATION_BY_ID`, a map's `locationId`) | was place, stop, route.json; never a bare top-level `location` (that is window.location) |
| A location's position in LOCATIONS | `node` | saves (`saveData.trip.node`) and trainers refer to locations by node (roads by map since phase 08b) |
| Putting a world's places and roads in | `worldSetGraph(locations, roads)` (game-data.js) | RL-5: fills `LOCATIONS`, `ROADS`, `ROADS_BY_NODE`, `LOCATION_BY_ID` in place, attaches trainers and boards; the game calls it with the hub's, RL-7 with a run's |
| A link between two locations | `road` (data section `roads`, `ROADS`, ids `road:<a>-<b>`); its kind `seam` (edges meet at the exits) or `lift` (the glass lift, ids `lift:<a>-<b>`) | was link, LINKS; NOT route (see below). roads.json: `{id, name, kind, a: {map, exit}, b: {map, exit}}`, read through `PB_DATA.road` (Studio, tools) and `ROADS` (game) |
| A building's way into its room | `door` (`doorOf(p)`: the door point, the way out, the front's middle; `doorLinkOf(p, act, map)`: the same link shape as a road, `{kind: 'door', a: {map, exit}, b: {map: room, exit: 0}}`) | the room is the prop's `room`, else its kind's `room` in scenery.json, else the one for what it does (`PB_DATA.doorRooms`, `ROOM_BY_USE`) |
| A route-kind location and its "Route N" label | `route` (kind `route`, a road's `name`) | kept: players read "Route 2" as the area |
| The player's position and travel along roads | `trip` (`saveData.trip`: node, plan) | was saveData.route |
| The shared strip where two maps join | `seam` | not border: CSS uses that word everywhere |
| The seamless world: maps and roads drawn as one ground | `seamlessWorld`, `seamless*` | was WORLD, wr* |
| The battle stage | `battleStage` (battle-stage.js; a location's or trainer's `battleStage` id) | was SC, sc*, scene.js, area |
| Battle stage backdrops | `BATTLE_STAGES` (data section `battleStages`) | was backdrops, BACKDROPS, AREAS |
| Prop recipes made into meshes | `propModel*`, a prop's data key `model` | was vox; `voxel` stays for real voxels and the .vox file format, and the art folder `art/scene/vox/` keeps its name |
| Low-poly meshes made from a recipe | `lowPoly*` (`lowPolyFromRecipe`) | |
| Solid props made from a prop's picture | `solidProp*` (solid-props.js) | was p3d, props3d.js |
| Creatures | `billy`, `billies` (`billyName`, `worldBillies`, `buddyBilly`) | was mon, owm, ow, owmon.js |
| A Billie's recolour | `coat` (data section `coats`, `COATS`, a Billie's or encounter's `coat` id, logic/coats.js `coat*`) | studio track ST-0, in place of Golden (`gold`); not `variant`: the Variants are a group of people, and props have `variants` |
| Phase 16 part kits | `partKits` (data section, game/data/partKits.json; a part is a `KitPart`), logic/sheet-slice.js `sheet*` | studio track ST-3; was game/art/next/parts/parts.json. Not `parts`: rules.json `parts` are the part sizes and robots.json `parts` the robot parts |

| The world map's look | `worldmap` (data section `worldmap`: `sea`, `relief`, `regions`, `kinds`; a place's `landmark` prop key; Studio `wml*`) | phase 10; the map itself is the bowl (`bowl*` in logic/bowl*.js, `worldBowl*` in world-bowl.js) |
| Drawn people | `person*` (person-art.js) | was tr*, trainer.js |
| The save | `saveData` (`setSaveData`) | was S |
| UI state | `uiState` | was U |
| The battle in progress | `activeBattle` (`setActiveBattle`) | was B |
| The game data | `gameData` | was GD |
| Reduced motion | `reducedMotion` (`setReducedMotion`) | was RM |
| The Studio's state | `studioState` | was ST |
| The debug log | `debugLog` (debug-log.js) | was NWLOG, log.js |
| Lore: a location's history, landmark and legend | `lore.locations`; an unlock `location:<id>` | was lore.places, `place:<id>` |
| Customizable home | `ranch` | phase 12 |
| The old world outside the hub | `legacy` (folder `game/data/legacy`, its own `legacy/index.json`; `readLegacyData()`, `oldWorld()` in tests; the Studio's `legacyView`) | RL-5: kept for the Studio, never loaded by the game |
| A leader who stands on no stop | `miniboss` (a trainer's `miniboss: true`, no `node`) | RL-5: the eight badge leaders; RL-13 makes them the runs' mini-boss pool. A `tutorial` trainer stands nowhere too |
| A run's node map | `run.map` (`{nodes}`), made by logic/run-map.js `runMapMake` (`runMap*`, `run*`); a node's `type` (data section `nodeTypes`), `row`, `lane`, `to`, `seen`, `biome`; its rows' plan `runMapRows` (`first`, `rest`, `guard`, `last`, as rules.json `run.map` names them) | RL-6. Map node i is world node i + 1 (`runWorldNode`, `runMapNode`): `run.path`, `to` and `runNodeSeed` count map nodes, `trip.node` and `run.forecast` the world's. Not `route` (a kind of place) or `road` (a seam between two) |
| The run's day and deadline | `run.clock` (the day), `run.deadline`, `runOverdue` (days past it) | RL-6: a day per arrival, backtracking included |
| A node's weather by day | `run.forecast` (`forecast[world node][day - 1]`, `runForecastFill`, `runWeather`); a biome's `climate`; logic/weather.js `CLIMATE_WEATHER_ODDS`, `weatherPick` | RL-6; the hub's real-clock weather is still `environment*` |
| The run's world | the world a run walks: Copperleaf (world node 0) and a **run place** per map node; game/js/run-world.js `runWorldSync` (installs or restores to match the save), `runWorld` (`seed`, `scenes`, `ms`); game-data.js `worldPut` / `worldHubBack` / `worldExtraMaps`; the hub's own rows `HUB_LOCATIONS`, `hubRoadCost` | RL-7. "Install" a world, not "load" (nothing is fetched). The hub's world is the game data's |
| A run place and its scene | a place row with `runNode` (its map node), id `run_<i>` (`runPlaceId`; its wild Billies in `saveData.wild` and its pool in `POOLS`), map id `run_<i>_<tag of the seed>` (`runMapIdOf`); its scene made by logic/run-scenes.js (`runSceneParams`, `runSceneMake`, `runScenesMake`, `runSceneExits` with the ids south, north, south2, north2; `runWorldTables`), dials from rules.json `run.scene`, levels from `run.wild` (`runWildLevels`) | RL-7. Scenes are never saved: the seed makes them again |
| A run place's weather today, a visit | `runPlaceWeather` (run-world.js; environment.js reads it); `encounterRunVisits` (arrivals at a run place), a wild record's `v` (the visit it was stocked on); rules.json `run.seamIn` (metres past a seam before a run's crossing counts) | RL-7 |
| Starting and ending a run | `runTakeOff` (run.js: the mast's "Take off"), `runGive` (logic/run-loop.js: rules.json `run.start`), `runOver(won)` (the payout phase), `runEndHome`; "Give up the run" `runGiveUp`; `runResume` at boot | RL-8. Player words: "Start a run", "Take off", "Fly home", "Give up the run" |
| Where a run stands | `run.at.phase`: `fly`, `walk`, `battle`, `payout` (with `run.at.won`); a battle's checkpoint `run.at.battle` (its number, `run.battleN` counts them) and `run.at.foe` (`runFoeRef`); `saveHeld()` (no save while it holds), `saveNow()` (written and sent at once) | RL-8. The hold is worked out, never stored |
| A run's foes | `runFoes` (a leader per mini-boss node and the boss, `runFoeId` = `run_<i>_foe`); a trainer's `runFoe` (`miniboss`, `boss`), `runNode`, `from` (the leader copied), `alpha` | RL-8; rules.json `run.foes` |
| A run town's clinic and shop | `clinicHeal` (ui.js, every clinic), `runHealCost`, rules.json `run.healCost`; `runShopStock` (the day's stock), `runShopId`, rules.json `run.shop` | RL-8. Free in the hub |
| The payout | `runPayoutOpen` (run-payout.js), `runPayoutRows`, `runRelease`, `runReleasePays` (only Billies caught on the run), the keep-one pick `uiState.runKeep` | RL-8. "Capital", "Seals" as before |
| Robot pieces | `part` (torso, leftArm, rightArm, legs), `gem` | phase 17 |
| Hidden organization | `organization` | final name in phase 15 |

## Ids

- Data ids are lowercase `[a-z0-9_]` (game/js/data-files.js refuses anything else).
- A location's id is made from its player-facing name, and its map has the same id: a town or city is its name without
  Town or City (`marigold` for Marigold Town, `verdigris` for Verdigris City); any other place is its own word
  (`kitewind` for Kitewind Ridge, `willowmere`), or its whole name where that word alone is an everyday word or
  already a name in the game (`tallgrass_meadow`: `tallgrass` is the tall grass prop; `old_fairway`,
  `stepstone_canyon`). An id that already reads as its name stays.
- Rooms are `int_<what>` (`int_twinpetal_market`), test maps `test_<what>`.
- Ids built from others: `road:<from>-<to>` for a road; the runtime builds its own (`w:<id>...`).

## Conventions

- camelCase for functions and variables. A state object that changes is a variable: camelCase (`walkView`,
  `battleStage`, `worldMap`; a module's mutable state may end in `State`: `propModelState`, `paintWorkerState`).
- UPPER_SNAKE for true constants only: fixed lookup tables, numbers, caches made once, tables read from the game data
  (`SPECIES`, `LOCATIONS`, `TONE_DARK`).
- PascalCase for classes and types.
- kebab-case file names in game/ and studio/ (`walk-view-gl.js`, `game-state.js`). Data files are named after their
  section key (`battleStages.json`, `maps/`). Python modules other tools import by name keep snake_case
  (`gamedata.py`, `pixkit.py`, `trainer_gen/`).
- Data keys are camelCase (`locationId`, `mapId`, `battleStage`).
- Descriptive names. No top-level name of one or two characters, except `$` and `$$` (querySelector and
  querySelectorAll, as in the browser console).
- A family of names in one module may share a descriptive prefix (`worldMapMount`, `battleStageStart`), or have
  descriptive names without one when that reads better (`findPath`, `drawWater`). The cryptic prefixes phase 05
  retired (dio, dgl, egl, mgl, mm, ow, wr, bld, p3d, vox, sc, ...) don't come back.
- A setter that swaps a module's value is `set` + the name (`setSaveData`, `setNavGrid`); tools/to-module.mjs treats
  every `set[A-Z]` function as one, so other functions don't start with `set` + a capital.
- `game/js/logic/` holds the logic that runs without a browser (`rules.js`, `saves.js`, `battle-engine.js`): no
  browser globals, imports only from logic/, `game-data.js`, `util.js`, `hooks.js` and `test-globals.js`, and it
  reaches the page only through the seams in `hooks.js` (`tools/test/logic.test.mjs` lists them). Code that draws,
  plays sound or reads the page stays outside it.
- `tools/test/` holds the unit tests (`npm test`): `<area>.test.mjs`, one file per area and one process each;
  `<area>-real.test.mjs` (or a name about the data, like `world-graph`) when it runs on the game's own data
  (`setup-real.mjs`) instead of the tests' small data set (`setup-fixture.mjs`). A snapshot sits next to its test as
  `<file>.snapshot`.
- No version stamps in names (`v46`, `47`, `a04`, `x28`, a `0` or `2` suffix meaning an older or newer copy).

## Kept on purpose (not internal names, or not now)

- Player-facing text, Studio labels and section ids, the debug log's keys, event kinds, labels and frame task names,
  URL parameters (`?test=1&scene=`), localStorage key values, Firestore collections and keys (a friend's presence
  `place`), the service worker's name and cache names, art folders, `GAMEDATA`, `RIGS`, `RIGS_NEXT`, `ARTMAN`,
  `STUDIO_KEY`, `NW_ARTDIR`, `PB_VERSION`: formats other things read.
- Object properties of in-memory state (`walkView.sc`, `uiState.tab`), CSS classes and ids, DOM ids, data-act keys:
  phase 06 (one module per screen) is the place for those.
- Generic prop fields (`ox`, `oy`, `img`, `fx`, `box`, `group`, `k`, `s`): the same short names mean other things in
  the battle sprites and in-memory items, so a search can't separate them; rename them with the 04e types, or in
  phase 09 when the prop format changes.
- Billie line, species, move, stat, status, item and coin ids, and battle stage and wild pool ids: phases 15 and 16
  redesign the roster and the battle and money rules.
- The version-stamped markers the build tools write into the data (`v47region`, `a04place`...): only those tools read
  them.

## Enforced by lint (`npm run lint`)

- ESLint's `camelcase` (eslint.config.js; properties may be anything: they are data keys).
- tools/check-names.mjs: no top-level name of one or two characters (`$`, `$$` allowed); no top-level name phase 05
  retired (tools/retired-names.json) and none with a retired prefix; kebab-case file names under game/js, game/css,
  game/*.js, game/*.html and studio.

## Renaming tools

- `node tools/rename.mjs name|prefix|file|prop ... [--dry]`, then `node tools/rename.mjs verify --expect ...`: renames
  across the game, the Studio, the Node and Python tools and the current docs, and proves the syntax trees differ by
  the rename only. Read its header first.
- `node tools/rename-data.mjs key|section ...` and its `verify`: a data key or section, with a JSON-level proof.
- `python3 tools/rename-strings.py`: the code names inside the Python tools' strings and comments (rename.mjs calls
  it).
- `node tools/rename-ids.mjs map|apply|verify`: the location ids (the art named by an id moves with it).
- One rename rule per commit (one name, one prefix family, one file, one data key or section), never mixed with a
  behaviour change.

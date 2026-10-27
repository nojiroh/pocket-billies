# Region map track (WM) - runs as a small Pokémon region

Branch: track/worldmap

The owner asked (2026-10-27) for a better world map, routes and towns for runs: a town only after at least 2 routes;
the first choices after landing go up or right; runs go west to east; routes of various shapes and sizes; towns with
branching roads, more sprawling, like a Pokémon region; the world map opening the right way for the player; routes
seamlessly joined on the world map; a clear arena where a route's leader is fought before going on. Planned in Plan
Mode on 2026-10-27 with online research and approved the same day. The plan was written on
`claude/worldmap-routes-towns-design-l31z1j` (the session's branch) and WM-1 built there; the owner makes
`track/worldmap` from it. Tags `wm-N-done`.

Before proposing anything in a session: read the latest HANDOFF.md entries and recent merges, then check the facts
below against main and report what differs.

## Verified facts (2026-10-27, before WM-1)

- **Direction:** east to west (the owner in TR-2, roguelite-track.md:250; run-map.js header). `runSceneExits`
  (run-scenes.js) gives `east`/`east2` back and `west`/`west2` ahead; `RUN_BOWL` (run-map.js) puts the landing at
  x +0.72 (east rim) and the boss at -0.72; every run place is `up` 90.
- **Node map:** rows from the region's zones (6-9 at Expedition I, 10-15 at V), at most 2 nodes a row
  (`runMapMake`), links only to the next row, never crossing. Row roles (`runMapRows`): a guard (mini-boss) at
  `round(k*rows/3)`, the row before it a town (`rest`), so on 9 rows the first town is row 2, one place after the
  landing. Filler rows draw a town at weight 1 of 8 (nodeTypes.json). No "routes before a town" rule.
- **Shapes:** every run place is 112 x 64 m (`MAPGEN_SIZES.route`), towns included; exits only east and west, at most
  2 a side at t 0.15625 / 0.5 / 0.84375 (`RUN_EXIT_T`). Side areas use N/S.
- **Towns (TW-1, `mapgenStageTown`):** one short street north off a straight through road to a square (clinic, shop);
  4-7 houses on the main road's north side only, stepping out from the square.
- **Leaders:** `runFoes` (run-loop.js) puts a leader on a `miniboss` node with `blocks`; walk-control.js locks every
  unvisited exit and draws the leader on the exit point. No arena; the node is an ordinary route. Message
  "A mini-boss blocks the way north" (run.js).
- **World map:** `worldMapMount` (world-bowl.js) opens with `bowlCamHome`, which looks radially outward from the
  bowl's centre (bowl-camera.js); at the east landing that faces east, the way ahead behind the camera. The yaw
  persists between opens. Places are separate stamps with straight 3-square roads between, about 68 m apart; at 15
  rows the stamps overlap (the crowding the owner left out, roguelite-track.md:1167).

## Research (2026-10-27)

- Pokémon towns: Pallet and New Bark about 2x2 Game Boy screens, Viridian, Cerulean and Goldenrod about 4x4;
  Goldenrod feels big from back alleys (46 walked cells to a door 14 away in a line); the Pokémon Center is usually
  the first door. A town wants junctions, back lanes and a landmark, not more houses on one road.
- Pokémon routes: long, narrow, often winding strips with tree walls; leaders and trainers as deliberate roadblocks;
  some trainer lines look like walls but can be walked round (Red/Blue Route 8).
- Region maps (RPG Maker Essentials, fan region generators): towns and routes on one grid, so the region map is the
  maps placed side by side.
- Slay the Spire's map: paths grown on a 7x15 grid that never cross; rules as constraints on paths (no rest sites or
  elites early, no two of the same kind in a row). PokéRogue: fixed first biomes, a leader every 10 floors.
- Village generators (Watabou, Parish-Müller road growth): grow roads from a main road with T-junctions, bends and
  dead ends, lots along every road, a square where roads meet.
- Map orientation: a map that opens the way the player looks in the walk saves a mental turn; maps that keep
  turning distract. Open aligned, then leave it.

## The owner's answers (2026-10-27)

| Question | Answer |
|---|---|
| Direction | West to east (reverses TR-2). After the landing: one exit north (up), one east (right) |
| South | Later routes may go north or south, never west |
| World map opening | Centred on you, matching the walk camera: north up, the run reads left to right; Home resets to it |
| Unreached places | Fogged outlines |
| Leader and town | Leader's arena on the route right before a town; the town is the reward |
| What counts as a route | Normal routes, the rival's and leaders' routes; not events, stalls or the landing |
| Towns a run | 2-3, by length |
| Route shapes | Rectangles of different sizes, north-going strips, L-bends, ledges and loops |
| Town size | A mix up to 3x2 cells: hamlet 2x1 (3-5 houses), village 2x2 (6-10), town 3x2 (10-16); the last before the boss the biggest |
| Houses | Streets branch, but houses mostly face the camera (side streets mostly run east to west) |
| Arena | A raised, fenced ring themed by the leader's type; a gate or Bureau barrier opens after the win |
| Extras | Route names and signposts, town landmarks, a line of trainers before the arena. No gatehouses |
| Final boss | Its own arena place |
| Landmarks | Built from existing props first |
| Run length | Keep 8-12 places a path; runs may go to 40-45 minutes |
| Branch, order | `track/worldmap`, WM-1 first |

## Sessions

| # | Session | Goal | Depends on | Sessions |
|---|---|---|---|---|
| WM-1 | Direction and map facing (done 2026-10-27) | runs go west to east (exits, the bowl line, wording); the world map opens centred on you looking north like the walk camera, and Home resets to it | none | 1 |
| WM-2 | The region grid (logic) (done 2026-10-27) | a coarse grid (about 64 m cells) replaces the rows: nodes get footprints, links go east, north or south; the landing's exits north and east; at least 2 routes between towns; leader then town; 2-3 towns; 8-12 places a path; the data checks, sim and the Run Lab's 2D preview | WM-1 | 1-2 |
| WM-3 | Shapes and sizes | mapgen takes a footprint: any width and height, L-masks walled by mountain or forest, exits on any edge (more than 2 on long edges), roads that bend to a north exit; seam rules for north/south joins; a phone-time measurement | WM-2 | 1-2 |
| WM-4 | The seamless region on the world map (done 2026-10-27: WM-4a, WM-4b on `claude/wm-4b-seamless-region`) | places stamped at their grid positions, region filler between, the run's real roads, fogged outlines for unreached places; ends the crowding | WM-3 | 1-2 |
| WM-5 | Town streets | street growth from the through road (T-junctions, bends, dead ends, a square at the main junction), side streets mostly east to west, lots along every street, houses mostly facing the camera; the three town sizes | WM-3 | 1-2 |
| WM-6 | A region's look | districts (square, homes, park or pond, farm edge), a landmark per town from existing props, route numbers and town names on signposts at seams and on the world map | WM-4, WM-5 | 1 |
| WM-7 | Leader arenas (done 2026-10-27, `claude/wm-7-leader-arenas`) | a raised, fenced ring by the leader's type on the road, a gate or Bureau barrier opening after the win, a line of trainers before it, the camera framing it; the final boss's own arena place | WM-2 | 1 |
| WM-8 | Ledges and loops | one-way ledges and shortcuts that loop between routes | WM-3 | 1 |

About 9-11 sessions. Most change test snapshots (run-map, run-scenes, run-world-real, run-bowl, bowl-camera,
mapgen-golden, mapgen-town) and check-fast's run pages.

## WM-2's answers and what it found (2026-10-27)

- The owner's answers: places a path by Expedition, I 9-10, II 9-11, III 10-11, IV 10-12, V 11-12 (rules.json
  run.map.path), a free place at least before the boss, so 2 towns at 9-11 places and 3 at 12 (run.map.towns [2, 3]);
  no filler towns (a town comes only after its leader); the scrapyard counts as a route; side areas flipped too
  (leader, then town); the grid in the logic only until WM-3; cells 64 m square, every place 2 x 1 cells, so WM-3
  makes places at their footprint's size (a route 128 x 64 m, 16 m longer than today's).
- Corrected facts: paths were 6-15 places (6-9 at Expeditions I-II, 8-12 at III-IV, 10-15 at V), not 8-12; side
  areas already had north/south joins (the obstacle's north exit), the main path none.
- What follows from the rules: at 9-10 places (Expedition I) every free step is right before a leader (route-like)
  or right after a town (no stall: never two shops in a row), so short runs have no stalls and few waystations; runs
  have about three times the route places they had (more route trainers).
- Until WM-3: `row` is a node's step from the landing (every link to the next step) and the scenes and the bowl
  read rows and lanes as before; `at`, `size` and `runLinkDir` are for WM-3 and WM-4.

## Risks

- Bigger places cost generation time on the phone (18-600 ms a place in Node today); LD-4's helper thread covers the
  take-off. Measure on the phone after WM-3 before the town sessions.
- The seams (MG-2) were built for east-west joins on a 64 m edge; north/south and longer edges are new.
- Saves with a run in progress from before WM-1 have the old direction. Old saves don't matter (CLAUDE.md), but a
  resumed run must not crash: the run's places are remade from its seed.

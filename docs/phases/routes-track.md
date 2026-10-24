# Routes track (RT) - run routes planned like a Pokémon route

Branch: track/routes

The owner asked (2026-10-24) to make the run's route places "more fun and engaging": trainers with areas that are
perfect for battles, less empty, planned out like a Pokémon route, more props for a lived-in feel, more Billies, and
not everything walkable (fences, dense forests). Planned in Plan Mode on 2026-10-24 and approved. RT-1..RT-4 live on
`track/routes`, made from main. Tags `rt-N-done`. It runs alongside the towns track (TW) and the region and encounter
sessions.

Before proposing anything in a session: read the latest HANDOFF.md entries and recent merges, then check the facts
below against main and report what differs.

## Verified facts (2026-10-24, main at 8ef38782)

Measured on 5 seeds (20 route places) with the game's own data, `runSceneMake` and `mapgenWalkGrid` (props included):
- **A route is an open field.** About **96%** of a route's 112 x 64 m can be walked. One road crosses it east to west
  (`mapgenStageRoad`); the generator's stages are heights, relief, ground, road, exits, lots, plants, feature, props
  (`MAPGEN_STAGES`).
- **Many props, all nature.** About 600 props a route: shrubs (~85), wild flowers (~84), tall grass (~77), ground
  plants (~70), rocks (~63), ~100 trees. Trees come as noise groves plus a belt along the edges
  (`mapgenStagePlants`), each tree a lone 0.45 m pillar, so no tree mass blocks anything. Things people made: ~2
  signposts and ~0.4 benches a route. **No fence, wall, hedge, camp or farm** is ever placed, though the props exist
  and block walking (`fence_wood`, `stone_wall`, `picket_fence`, `hedge` have a `box`; `tent`, `campfire`, `scarecrow`,
  `cart`, `crate*`, `barrel*`, `log`, `stump`, `well`, `mailbox*`, `dock_post`, `rowboat`, lamps and benches exist).
- **Route trainers** (`logic/route-trainers.js`, RL-12b part 1): `rules.json run.trainers.perRoute` [1, 2], only on
  `route` nodes (20 of 58 places on those seeds: about 4 a run, so about 6 trainers a run), sight 6 m, reward 150.
  Where they stand (`routeTrainerSpot`, used by `walk-control.js`): on the straight line from the hub to the westmost
  exit at (k + 1) / (n + 1), 3 m to one side, facing that line. It ignores the road's curve and what stands there, so
  a trainer can be off the road, in a bush or by a pond. 7 classes (`events.json classes`), none tied to a place.
- **The battle engine has doubles** (`battle-state.js` `fmt: 'double'`, the foe AI's double logic in
  `battle-engine.js`), not used by route trainers.
- **Wild Billies are visible on the map** (phase 08): `rules.json encounters.route` 4 a route place, `run.wild.back`
  2 on a return visit, `run.wild.waystation` 2. They wait in the tall grass patches (`sc.grassPatches`, TR-2c;
  `walk-view.js encounterSpot`). One pool a place: its biome's, cut to the region's dex (`runWorldTables`).
- **Reach and checks a route must pass:** `mapgenReach` / `mapgenUnreachable` / `mapgenTraps`, `run-world-real.test.mjs`
  (no notes, seams agree, nothing unreachable), `mapgen-golden.test.mjs` snapshots (MAPGEN_VERSION 6), the mapgen
  grass, ledges, roads, seams and lots tests, the run sim.
- **Pocket spots exist in part:** TR-2b/2c mark summit pockets and ledges; `G.npcSpots` and `G.keep` hold folk spots
  (folk are off on generated scenes). Cut exists as a field move (`fieldMoves.json`, `thorns` -> `bush_bramble`,
  RL-R2a) but only at a side area's entrance.
- **Phone cost:** towns ran at 27-28 fps on the owner's phone (phase 09). Routes already carry ~600 props.

## The owner's answers (2026-10-24)

| Question | Answer |
|---|---|
| Walkable share | **55-65%** of a route (was 96%). This replaces the 2026-10-21 terrain decision "routes stay open, 70%+ walkable" (terrain-track.md) for run routes |
| Trainers | **Many: 4-6 a route place.** Claude's recommendation, taken with the approval: about half of them optional (in pockets, behind a Cut shortcut), trainers count toward a place's encounters so the wild stock stays near 6, the run sim checks run length (~30 minutes) and difficulty in RT-2 |
| Extras | **All four:** items in pockets, trainer pairs (doubles), Cut shortcuts, ambient animals |
| Dense forest | **A tree wall plus a canopy fill:** real trees along a forest's edge, a cheaper canopy inside, solid as a whole; fps measured in RT-1 |
| Order | RT-1 layout, RT-2 trainers, RT-3 set pieces, RT-4 Billies and finds; one session each |

## Sessions

| # | Session | Goal | Depends on | Sessions |
|---|---|---|---|---|
| RT-1 | Route layouts | a `layout` stage after the road: a seeded route plan (forest trail, farmland, lakeside, ledge drop, two lanes with a grass detour) that lays blockers (forest masses, fence and hedge runs with gaps and gates, rock outcrops, water) to 55-65% walkable; marked spots (pockets, dead ends, corridor pinches, clearings) in `scene.spots`; MAPGEN_VERSION bump | none | 1-2 |
| RT-2 | Battle spots and trainers | trainers stand on RT-1's spots (a clearing, a bridge, a fence gap, a ledge top, a jetty) facing the path along the real road; 4-6 a route place by row, about half optional; trainer pairs as doubles; a class likes some spots; run sim for length and difficulty | RT-1 | 1 |
| RT-3 | Set pieces | `setPieces.json` + schema: small hand-designed prop groups (campsite, farm pen and scarecrow, rest stop, woodcutter's clearing, fishing jetty, ruins, a Bureau checkpoint) placed as a unit, 2-4 a route by biome; a signpost with the route's name at each entrance; existing props only; shared with TW-1 | RT-1 | 1 |
| RT-4 | Billies and finds | 6-8 visible wild Billies (counting trainers, see above); habitats (water edge, woods, grass) each draw from part of the region's dex; a rarer one in a hard pocket; items at dead ends; Cut bramble shortcuts (Grass badge); ambient animals (shared with TW-2) | RT-1, RT-2 | 1-2 |

**Each session's shape**, for its own Plan Mode:
- **RT-1.** Files: `logic/mapgen.js` (the `layout` stage between `road` and `plants`, its own stream; plants keep off
  the blockers; the walk grid counts forest masses as solid), a forest-mass prop or draw (a canopy model or a solid
  area: measure both against plain trees on the phone fixture before choosing), `logic/run-scenes.js` (route places
  ask for a plan; towns and waystations keep theirs), `rules.json run.scene` (plan weights by biome). Tests: same seed
  same layout; walkable 55-65% over a seed sweep; every exit, spot and lot reachable (`mapgenUnreachable`, the trap
  check); seams unchanged (east and west edges pinned, the blockers kept off the seam bands and the exits' straight
  run-in); the road never blocked; golden snapshots remade on purpose. Could break: run-world-real, mapgen grass and
  ledges tests (a patch on a blocker), the run sim's scenes, the Studio's Generate card (a new dial), phone fps.
- **RT-2.** Files: `logic/route-trainers.js` (spots from `scene.spots`, sight along the road; perRoute by row; pairs),
  `walk-control.js` (placement from the scene, not the straight line), `rules.json run.trainers`, `events.json`
  classes (liked spots), battle start for a pair (`fmt: 'double'`). Tests: every trainer on a walkable spot facing a
  walkable line; the required ones' sight crosses the road; same seed same trainers; a pair starts a double; run sim
  length and win rate before and after. Could break: route-sight, the reward pick count, the in-game test's run phase.
- **RT-3.** Files: new `game/data/setPieces.json` + schema, type, check, export; `logic/mapgen.js` (placing a piece on a
  spot or a clearing, turned to the road, all its props or none); the Studio's Generate card (a pieces dial). Tests:
  a piece never blocks the road or a spot; every piece's props exist in scenery.json; same seed same pieces. Could
  break: the walk grid, fps.
- **RT-4.** Files: `logic/rules.js` (`encounterStock`), `rules.json` (`encounters.route`), `run-scenes.js` (habitat pools),
  `walk-view.js encounterSpot` (spots by habitat), items on spots (the run's bag), Cut shortcuts (a bramble prop with
  act `field` on a spot, as RL-R2a's obstacle), `sc.life` animals. Tests: the stock; habitats draw only their part
  of the dex; a shortcut refused without the type or badge; items once a run. Could break: run-sim balance, the catch
  flow, fps (animals).

## Ask me before (recommendation first)

1. RT-1: the route plan names and how many (recommended: the five above, more later).
2. RT-1: forest mass look, if neither the canopy model nor the solid area looks right on the phone.
3. RT-2: trainer count vs run length, if the run sim says runs go past ~35 minutes (recommended: more optional
   trainers, not fewer).
4. RT-3: the set pieces list, and whether the Bureau checkpoint carries story (a line, an agent).
5. RT-4: what items lie in pockets (recommended: the reward pick's small items, a Bean as a rare find).

## Noticed, not in scope

- `rules.json run.trainers.sight` is 6 m; Emerald's median is 3 tiles. Worth a look in RT-2 once spots face the path.
- The terrain track's TR-8 (trainers on ledges, items on terraces) and TR-11 (boulders, fallen trees) overlap RT-2
  and RT-4; RT builds the spot system they can reuse.

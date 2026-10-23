# Island track (IS) - Copperleaf becomes a real island

The owner's brief (2026-10-22): the starter town becomes a real island. A mountain in the middle and a forest. You can
walk round the island a full circle and the camera keeps the diorama; the pivot is the middle of the island. A cove and
beaches; several terrain kinds. Room is left for the small town and the barn; the barn gets a pasture.

Written from main a10bfc6 (PR #118). Every figure below is a claim: verify it against the code (CLAUDE.md).
Tags `is-N-done` (the owner pushes them). Every session starts in Plan Mode and ends with a HANDOFF entry.

## Decided (owner)
- **One map.** The whole island is one walkable scene, `copperleaf`. No seams, no sectors.
- **Orbit camera.** The camera sits out over the sea and looks in at the island's middle. Walking round the coast
  turns it a full 360 degrees. The mountain stays behind you; the sea and coast frame the bottom of the screen.
- **Mountain** in the middle, **forest**, a **cove**, **beaches**, several terrain kinds.
- **Room left for the town and the barn**, the barn with a **pasture**.
- **The hub, not a node** (the owner, 2026-10-22, after IS-0): the island is the main hub, never a run node. It gets
  **its own editor in the Studio, with an orbiting camera** (IS-6a), and is **locked once it is right**. Answers in
  chat: the lock freezes the **ground** (coast, heights, ground letters, steps, zones; a change fails the data
  check; props, people and buildings stay free; unlocking is a deliberate toggle); the island is shaped by **dials,
  then hand edits**, then locked; the generator is built **reusable** (question 10).

## What exists today (read from main a10bfc6)
- `game/data/maps/copperleaf.json`: 88 x 76 m, 1 m tiles and heights, `edge: "g"` (grass past the edge), no exits,
  485 props, 42 wild grass patches, a wood bridge, `life` (ducks, chickens, rabbits, squirrels, cats). Buildings: the
  lab, 6 cottages (Juniper's home is `act: home`), the barn (`act: ranch`, RL-9) at 22, 41.5, the airship station and
  airship (`act: fly`) at 56.5, 36.6, the well. The town faces south (the camera looks north).
- `game/js/walk/camera.js` `walkCamera`: a fixed yaw (0) plus the player's turn (`yawT`, limited by
  `cameraTurnLimit()` from Engine > Camera > turn), the target clamped to the scene (`tx = clamp(... sc.w ...)`,
  `tz = clamp(... sc.h ...)`), TR-3's rise on tall ground and the rock fade, the indoor and room framing.
- The joystick already walks along the camera's own right and forward (`walk-view.js`, ~line 3480): up is into the
  screen. With an orbit camera, holding right walks round the island by itself.
- `WALK_SPEED` 3.4 m/s (`walk-view.js`). A coast path at 50 m from the middle is ~314 m: ~90 s walking.
- The ground past the scene edge is the `edge` tile (`ground-mesh.js`, `ground-textures.js`, `grass-build.js`).
- mapgen already paints a coast (`mapgenPaintCoast`, water kind `coast`) and TR-2 builds walkable mountains and
  trails. TR-2c part 2 (the road pathfinder, the mountain route types) is open on `terrain-generation`.
- Props can be turned (`p.rot`, phase 09 batch 9; sprites.js treats a picture turned > 5 degrees as a standee).
- The barn is still a standing picture (phase 09 batch 11's list). The walkable ranch yard and pens were cut from RL-9.
- The hub's world map is "Copperleaf's island alone" (`worldmap.json` `sea.island` 0.2, RL-8b), not yet its real shape.

**Checked in IS-0** (against main a10bfc6): the figures above hold (the airship station is at 56.49, 36.64). Three
things the list missed:
- A map's water kind already exists: `waterKind` (walk/water-data.js `WATER_KIND_LOOKS`; mapgen writes `'sea'` for a
  coast; environment.js and sound.js read `'sea'` as the coast). The contract's "sea's water kind" is `waterKind: "sea"`.
- `edge: "w"` alone paints the land past the edge with a water texture; it is not a water surface. A sea skirt
  already exists: `flatFar: 1` (walk/ground-mesh.js, "out at sea the water runs on past the edges of the scene") adds
  water quads 90 m out and lowers the far land; the coast biome sets it (`far: "sea"`, `farH: 5`). IS-3 builds on it.
- `?test=1&scene=<id>` already opens any test map; `?fixture=island` is for the fast check.

**Checked in IS-2** (logic/island-gen.js, tools/build-island.mjs, `copperleaf_island`):
- The town does not fit a 135 m island: today's buildings span about 72 x 46 m with the barn (60 x 34 m without); with a
  45 m mountain foot the town box's south corners fell in the sea. The owner chose ~150 m (question 1). The generator
  pushes the coast out round every flat zone (a beach, the loop path and a margin past it), so a zone always fits.
- The lap is longer than "~90 s": the coast loop is 472 m, about 139 s walking (it bends round the cove and bulges
  round the town and barn). A smaller `size.r` dial shortens it.
- mapgen's helpers do the work read-only: its working state (`mapgenNewWork`), TR-2b's trail search and carving, the
  stream painter, the road flattening, the water lowering, the shelves' rock edges. No export was added to mapgen.js.
- TR-2's mountain shape needed a flat top: a sharp peak drops more than the trail's grade on every side, so no trail
  could leave it (15 of 24 seeds had no trail before; 24 of 24 after).
- The game's `findPath` gives up after 30000 cells, under a third of a 174 x 167 m map: the 102 m way from the town to
  the summit is found only with a bigger budget. Walking with the joystick is not affected; tap-to-walk across the
  island is (IS-5 and IS-9 should look at it). The map's in-game checks test the summit from the trail's foot.
- A plain shape reads as made by a program (the owner, after the first look): generator version 2 adds the `organic`
  dial (rounded zones, headlands and bays, a ridged massif with a shoulder, wandering shelves and paths, groves,
  outcrops, wet ground). The massif's ridge has to stay clear of the cove as well as the town, or the stream has no room.
- A bridge must not carry `pier: 1`: that marks a jetty (a deck ending over water), and the smoke's water rule fails it.
- A new file under game/js must be on a page (a unit test follows the pages): island-gen.js was on the game page after
  island.js until IS-6b moved it to the Studio's.
- Terrain kinds with no letter of their own: dunes are sand with sunburnt grass (`s`, `B`), scree is pebbles (`P`),
  alpine grass is clover (`C`), the stream bed pebbles (`P`). The rest as listed: `w`/`d` sea, `S` wet sand, `s` sand,
  `2` tide pools, `3` seaweed rock, `j` basalt cliffs, `G`/`E`/`g` meadow, `l` pasture, `y`/`L`/`M`/`F` forest floor,
  `H` heath, `r` rock, `p` paths, `v` the trail. Farmland waits for IS-5 (Copperleaf's farm patch moves with the barn).

## The proposed island (starting dials; IS-2 confirms them)

```
                         N
              . . . forest . . . . .
           .  pines, beech, clearings  .
         .     \                  /      .     cliffs
   W   beach   (    MOUNTAIN      )   COVE    E
  long sand     \ summit lookout /   dock, fishing
         .   stream ------------>   inner beach
           .  BARN + PASTURE          .
              .    TOWN (+ mast)   .  dunes, heath
                         S   <- first view: town in front, mountain behind
```
- **Scene** ~160 x 160 m, `edge` sea; land ~135 m across (radius ~66 m) with a wobbly coast.
- **Mountain**: ~45 m across at the foot, peak ~22 m (TR-2's walkable 15 m+), a switchback trail to a summit lookout.
- **Town in the south.** The camera looks north at the south side of the island, so the town looks as it does today
  from its main angle. Buildings at the sector's ends turn a little to face outward (see question 4).
- **Barn and pasture** in the south-west beside the town (Copperleaf's farm patch moves with it).
- **Forest** belt from north-west to north-east round the mountain's foot.
- **Cove** in the east: a horseshoe bay, a sandy inner beach, a dock, cliffs either side.
- **Beaches**: a long one in the west, the cove's inner one; dunes and heath in the south-east.
- **Paths**: one coast path round the whole island (the full circle), spokes to the town square and up the mountain.
- **Stream** from the mountain to the cove, with a small fall and a pond.

**Terrain kinds** (existing ground textures only, the fixed art commitment): dry sand, wet sand at the waterline,
dunes with beach grass, rocky shore and cliffs, meadow, farmland, pasture grass, forest floor (moss, leaves), heath and
heather, mountain rock, scree, alpine grass, stream bed, tide pools. IS-2 lists the tile letters from
`ground-textures.js` and maps each kind to one.

## The contract (IS-0 writes it; every later session reads it)
So the parallel sessions mesh, the new map fields are fixed first, in the schema and the types, all optional:
- `cam.orbit`: `{ c: [x, z], dead: m, lag: s, turn: deg }`. The pivot, the radius inside which the camera stops
  turning (the mountain top), how slowly the yaw follows, how far the player may turn it on top.
- `island`: `{ c: [x, z], coast: [[x, z], ...] }`. The coastline as a closed polygon (the world map reads it).
- `zones`: `[{ k, poly, lock }]` with `k` one of town, barn, pasture, forest, mountain, cove, beach, path. A `lock`ed
  zone's ground and props are never touched when the island is generated again (the hand-placed town survives).
- `islandGen`: the generator's dials and seed, kept in the map so the ground can be made again; `lock` and `hash`
  freeze the ground (logic/island.js `islandGroundHash`; added in IS-0 after the owner's direction).
- `edge: "w"` and the sea's water kind.
- **Added in IS-2**: zone kind `hamlet`; `plots: [{ k, x, z, w, d, a, y }]`, building plots the generator lays out (k one
  of house, home, lab, mast, shop, well, farmhouse; a the angle the front faces; y the pad's level).
- A crude `test_island` map (a cone, a flat ring, sea round it) so IS-1 and IS-3 have an island on day one.

## Sessions and waves

| # | Session | Goal | Depends on | Sessions | Wave |
|---|---|---|---|---|---|
| IS-0 | Contract and test island | this file in the repo, ROADMAP row, the fields above in schema/types/check-data, `test_island` | none | 0.5 | 0 |
| IS-1 | Orbit camera | the orbit mode in `walkCamera`, no scene clamp when orbiting, dead zone, smooth wrap past 180 degrees, player turn on top, cull and shadows checked at every angle | IS-0 | 1-2 | 1 |
| IS-2 | Island ground generator | `logic/island-gen.js` + a Node tool: coast, mountain, trail, forest mask, cove, beaches, stream, coast path, terrain kinds, zones; writes `copperleaf_island` (a new file) | IS-0 | 1-2 | 1 |
| IS-3 | Sea all round | sea past the edge to the horizon on every side, waves and foam on the whole coast, the far backdrop and sky from every angle, wet sand | IS-0 | 1 | 1 |
| IS-4 | Island props (batch 11 folded in) | the barn as a model, pasture fence, gate, trough, hay; beach (driftwood, shells, beach grass, rocks), the dock, mountain (boulders, scree, cairn, lookout), forest floor | IS-0 | 1-2 | 1 |
| IS-5 | Copperleaf moves onto the island | the town, barn, mast and people moved into their zones; `copperleaf_island` becomes `copperleaf`; acts, npcSpots, life, wild, fixtures, tests, goldens | IS-1, IS-2 | 1-2 | 2 |
| IS-6a | Hub island editor | a Studio section of its own for the hub: the orbit view, the 2D map with coast, zones and pivot, hand edits (paint, height), the ground lock | IS-0 | 1-2 | 1 |
| IS-6b | Hub editor dials | the generator's dials in the hub editor, live preview, "Use this island" leaving locked zones alone, refused while locked | IS-2, IS-6a | 1 | 2 |
| IS-7 | The world map's island | the hub's bowl map draws the real island from `island.coast` and its ground | IS-2 | 1 | 2 |
| IS-8 | Barn and pasture | the fenced pasture by the barn; ranch Billies wander in it; tap one to open the ranch | IS-4, IS-5, RL-10 | 1 | 3 |
| IS-9 | Dressing, variety and phone pass | forest density, the terrain kinds placed, ambient life (gulls, crabs), wild patches, phone frame times, the play test | IS-3, IS-4, IS-5 | 1-2 | 3 |

About 11-15 sessions. Up to five at once in wave 1, three in wave 2, two in wave 3.

### IS-0 Contract and test island (do first, alone)
Add this file, the ROADMAP row and the contract fields (schema, types, check-data, an export). Make `test_island`
with a 50-line script (no generator yet): 120 x 120 m, a cone 16 m high in the middle, a flat ring, sand at the edge,
sea past it, `cam.orbit` set. A quick fixture `?fixture=island` that boots into it. Unit and fast checks green.

### IS-1 Orbit camera
- Pure maths in `logic/camera-orbit.js` (unit-tested): yaw from the player's angle round `c`, the lag, the dead zone
  (inside `dead` the yaw holds its last value), the shortest way round past +/-180 degrees (no spin), the player's turn
  added on top within `turn`.
- In `walkCamera`: when `sc.cam.orbit` is set, use that yaw and skip the scene clamps on `tx`/`tz`. Indoors, rooms,
  `st.focus`, the swoop and cutscenes keep their own framing.
- **Walk drift**: the joystick reads the camera's right (`walkView.C.right`), which lags the orbit; holding right
  then spirals out slowly. Steer by the orbit's target yaw instead. Test: holding right for a full lap ends within
  1 m of the start radius.
- Check at 8 angles on `test_island`: culling (`quality-cull.js`), the shadow map's coverage, TR-3's rise and rock
  fade (the mountain is behind you, so it should rarely trigger), turned standees and signs, landmark tilt, pixel
  grid.
- Not in scope: the island itself, the sea past the edge (IS-3).

### IS-2 Island ground generator
- `logic/island-gen.js`, seeded (`logic/rng.js`), a Node tool `tools/build-island.mjs` that writes
  `game/data/maps/copperleaf_island.json`. Does **not** edit `logic/mapgen.js` while TR-2c part 2 is open; import its
  helpers read-only (if one must be exported, one tiny commit, named in HANDOFF).
- Order: coast polygon (radius plus noise, the cove cut in), heights (mountain, foot hills, coast fall-off, cliffs
  where the dials say), the trail (reuse TR-2b's trail logic), the stream, the coast path as a closed loop plus spokes,
  the terrain kinds by height, slope, wetness and zone, the forest mask, the zones (town, barn and pasture flat and
  left empty, `lock: true`).
- Node tests: the same seed makes the same map; the coast is closed; the coast path is one loop you can walk;
  every zone is reachable on foot from the town zone (the walk grid); nothing but sea past the coast; locked zones
  untouched by a second run; the town and barn zones are flat enough to build on.

### IS-3 Sea all round
- The sea past the scene edge on every side, out to the horizon (one large water skirt, not tiles), joined to the
  coast's water without a seam.
- Waves, foam and shallows on the whole coastline, wet sand at the waterline, the cove calmer.
- The far backdrop (`far`, `farH`, sky.js's bowl wall) checked from every angle: the bowl's wall over the sea.
- Tested on `test_island`; switch to `copperleaf_island` when IS-2 lands.

**Checked in IS-3** (pictures of `?fixture=island` from 8 sides through the Studio's free-camera hook):
- The old skirt (four quads 90 m out) met the scene's sea with a seam: it started fully deep while the scene's edge
  water is shallow and see-through, and the scene's own edge vertices were half as deep (cells past the edge counted
  as nothing). Its far edge showed from high up. Now one skirt of rings (logic/sea.js) out to 400 m.
- Whitecaps were stretched along x, streaks from the east and west: they now roll in toward `island.c`.
- There was no surf on a sea coast: the foam came from `aShore`, which is 0 at sea.
- `far: "sea"` only preloads `scene/far/sea.png`; nothing draws it. `farH` is read by nothing. Both left alone.
- Far props (trees, rocks scattered past the edge) stood on the water of any `flatFar` map: off there now.
- The bowl's far wall (the sky shader, from world-bowl.js's `bowlWallTexture`) already goes all the way round; it
  reads as a pale cream band because of the far bowl's own colours (phase 10's look; softened in IS-3, not recoloured).
- Looking south (into the noon sun) the sky washes white with bloom and glare: the sun question (3) for IS-1.
- A cove is calm by its zone (`zones[].k = "cove"`); IS-2's real cove gets it for free.

### IS-4 Island props
- Phase 09 batch 11's barn (now a picture) becomes a model; the rest of batch 11 stays its own batch.
- New, in the existing low-poly 32 px/m style, duplicates as variants: pasture fence and gate, trough, hay bales,
  feeder; driftwood, shells, beach grass, shore rocks, tide pool rims; the dock and a moored boat (scenery); boulders,
  scree, a cairn, the summit lookout; forest floor bits. A showcase map `test_props_island`.
- Owns the prop files and their art; touches no map but the showcase.

- **Checked in IS-4**: many listed props already were models (fence_wood and its post, haybale, rowboat, dock_post,
  buoy, rocks, boulder_lichen, stone_wall, waystone, log, stump) and are reused. The walkable dock is a map's
  `bridges` entry with `pier: 1`, not a prop: IS-5 places it at the cove. The barn's picture is a gambrel (its old
  `build` said a gable); the model follows the picture. The summit has its own `summit_lookout`; `lookout_tower`
  stays batch 11's.

### IS-5 Copperleaf moves onto the island
**Changed in IS-2** (the owner: the town in the generator): the generator lays the town out itself (streets, a square,
bridges, a quay) and leaves `plots` for the buildings: put the lab, the airship station (`mast`), Juniper's home, the
shop and the well on theirs and the cottages on `house` plots, the barn in its zone; the hub is by the well. The town's
ground is not flat: a building stays on its plot's level pad. The list below still holds for everything that names a
Copperleaf position.
- The one session that edits `copperleaf.json`. Move the town, the barn, the mast and airship, the well, the great
  oak and the people into their zones on `copperleaf_island`, keeping their layout where it fits; turn the buildings
  at the sector's ends to face outward. Then `copperleaf_island` replaces `copperleaf` (same id).
- Re-point everything that names a Copperleaf position: `hub`, `npcSpots`, people, `life` areas, `wild`, the bridge,
  fixtures (`?fixture=lab`, `ranch`, `run`), check-fast steps, the in-game full test, the golden scene and the frozen
  scene hash (remade on purpose), the opening fall's landing, the quick check's picture baseline (CI makes it).
- A saved hub position that is now sea or rock moves to the nearest walkable spot on load (one small rule).

**Checked in IS-5** (the owner's answers: the fall lands in the town square (11); the shop plot gets the General store,
closed; cottages on every house plot and the farmhouse plot; gardens travel with their houses, free nature left to IS-9;
rooms face four ways; wild grass in patches by the woods. Question 4 is moot: the generator lays the town out.)
- **Rooms opened in place only behind a south-facing door**: the room was laid north of the door, you walked in
  northward, the camera, the room's front cut, its lamps, window light and wall shading all assumed it. The island's
  plots face every way (the lab's west, onto the square), so rooms now face four ways (logic/room-turn.js): made in
  their own metres as before, turned by quarter turns about a point on whole metres by the door; what draws the room
  reads the frame (`roomFrame`). A south room is laid in exactly as before.
- **No hub position is saved across a reload** (only `trip.node`): "a saved hub position that is now sea" can't happen.
  In a session the spot already goes through `walkablePointNear` when the walk starts; `standByMast` now turns with
  the station.
- **No golden scene or frozen hash covers Copperleaf** (they are run maps); the one that does is island-gen.test's "the
  game's island is the generator's own output", now reading `copperleaf`.
- **The opening's landing** is the opening cutscene's spots and shots, absolute metres by the lab's door: they move
  and turn with the lab (tools/build-copperleaf.mjs).
- `wild: 42` was still read, by check-quick's v42 "grown" step (it now leaves out a generated island); `grown`,
  `grown2`, `v46` by nothing.
- Hub wild Billies waited in tall grass within 13 m of the hub: the square on the island. The generator's new stage
  `wild` lays `grassPatches` (the run maps' rule then applies).
- The hub's view (`w:copperleaf*`) didn't carry `island` and `zones`: the sea's middle and the cove's calm need them.

### IS-6a Hub island editor (the owner, 2026-10-22)
A Studio section of its own ("Hub island", not inside Walk scenes), editing the hub's map (`copperleaf`; a picker for
`test_island` until IS-5). Studio files only, plus one guard in map-editor.js.
- **Orbit view**: the game's renderer (`mountWalkView`) with its own `look` from logic/free-camera.js, the target the
  island's middle (`island.c`). Drag turns round it, wheel or pinch zooms, Shift-drag tilts; auto-orbit, snap to
  N/E/S/W, "Walk the coast" (IS-1's logic/camera-orbit.js once merged).
- **2D map** beside it: the coast, zones by kind (locked ones hatched), the pivot and its dead-zone circle. Tools:
  Paint ground and Height (map-editor.js's brush functions, exported, not copied), Zones (move, add, remove points;
  kind and lock), Pivot (`cam.orbit.c`, `dead`).
- **Lock**: "Lock the ground" stores `islandGen.lock` and `islandGen.hash`; the ground tools, zones and pivot go
  read-only (props stay editable here and in Walk scenes, whose ground brushes refuse a locked map too). "Unlock"
  asks first and clears the hash. check-data refuses a changed locked ground (IS-0).
- Check: a check-fast Studio step (the section opens and draws, a drag turns the orbit, locking disables the brushes).

**Done in IS-6a** (2026-10-22, the owner's answers in chat): "Walk the coast" uses the game's own walk camera (it
orbits since IS-1 merged; no import of camera-orbit.js. IS-1's orbitOf is off in a Studio free-camera preview, so
the hub view takes that mark off while it walks); no prop tools in the editor
("Props in Walk scenes" opens the map there); Copperleaf view-only until it has a coast (IS-5 owns copperleaf.json);
the coast is hand-editable with the zones' point tool. Checked against the code: the ground the lock covers is
changed in Walk scenes by Paint, Fill, Shape the land, Cliffs & stairs, Curved road (map-editor-tools.js), Resize and
Flatten, so the guard is one helper (logic/hub-island.js `groundLockRefusal`) asked in those places; map-generate.js
only makes new maps and needed none. The editor's logic is game/js/logic/hub-island.js (unit-tested); IS-6b adds the
dials beside it.

### IS-6b Hub editor dials
The generator's dials in the hub editor: size, coast wobble, mountain size and height, forest arc and density, cove
angle and depth, beach arcs, cliffs, stream on/off, seed. Live preview (map-generate.js's draft pattern); "Use this
island" leaves locked zones alone and is refused while the ground is locked.

**Done in IS-6b** (2026-10-22; the owner approved the plan with the recommended answers: the draft made on the page
half a second after a dial stops, not in a worker; a locked ground's dials read-only; props at sea named, not moved;
no "new island" button). Studio files plus logic/hub-island.js (the dials' logic, unit-tested) and check-fast's step.
island-gen.js moved from the game's page to the Studio's (the game never calls it). Checked against the code:
- The generator has more dials than listed above (`organic`, `size.stretch`/`lobes`, `mountain.range`/`shoulder`,
  `cove.shape`/`channel`, the town, the hamlet, `paths`, `level`, the flat zones' rectangles, a seed per stage); the
  editor shows them all.
- One island takes about 1.75 s in Node (2-3 s in the browser); the walking checks another 1.2 s, so they are a
  button ("Check the walks"), not run on every draft.
- With a previous map the generator keeps its middle (so props and people stay put) and grows the scene only east
  and north. A whole new seed's coast often crosses the west or south edge: 5 of 12 seeds fit round
  copperleaf_island's middle, while a stage's own seed (coast, land, mountain, paths, ground) fits. The editor says
  so and suggests another seed or a smaller island. Making the generator shift the scene would mean moving every
  position on the map (props, people, exits, checks); not done.
- Small islands (land radius ~30 m, as on test_island) make a forest zone that crosses itself (island-gen.js); the
  draft lists it as a problem and Lock the ground refuses it. Not fixed here (IS-2's file).

### IS-7 The world map's island
The hub's bowl map draws the real island: `island.coast` as the outline, its ground painted as each place's ground
is (phase 10's 1.5 m pixel ground), the mountain's relief, the town's buildings close in. `worldmap.json`
`sea.island` from the real size. World map test step.

**Checked in IS-7** (world-bowl.js, logic/bowl.js, the new logic/bowl-island.js):
- The bowl is 1000 m to its radius; its ground grid is 6.25 m a corner and its terrain picture ~1 m a pixel (phase 10
  says 1.5 m). Nothing of a map's `heights` reached the bowl: a place's relief was one bump by its kind.
- An island world's land was each place's circle of its map's half-diagonal plus the `sea.island` round and noise;
  for a 235 x 237 m scene that made the whole square (its sea too) land. The hub's island now keeps exactly its coast.
- The hub place still points at copperleaf.json (no coast). The bowl finds the island map by its fields: the place's
  own map when it has a coast (after IS-5), else for the hub (world node 0) the biggest map with a coast and plots.
- The map's own sea squares stamped on the sea floor showed through the water as a box: the island is stamped only
  where the bowl has land. Bowl rivers would cut across the island's own ground: none is made on it (its stream is
  its own map's); the checks that wanted one river on an island world want none there.
- `copperleaf_island` has no props: the town is drawn from its `plots` (a model per kind) plus the barn in its zone
  until IS-5 puts buildings on them; a plot with a building on it is skipped then. The landmark (the oak) still comes
  from copperleaf.json until IS-5.
- The well and the airship station are not "buildings" by the bowl's own rule (too small, no door), so Copperleaf's
  were never on the bowl; on the plots they are.

### IS-8 Barn and pasture
The fenced pasture beside the barn (IS-4's fence and gate), up to ~6 ranch Billies wandering in it (from storage and
trainees, RL-10's data), tap one or the gate to open the ranch sheet. Waits for RL-10 to merge.

### IS-9 Dressing, variety and phone pass
Forest density and clearings, the terrain kinds dressed with props, gulls and crabs on the beach, the wild patches
placed (question 5), the phone's frame times at 8 angles round the coast, then the owner's play test.

### Look pass (before wave 3; the owner's feedback rounds)
The owner looks at headless phone pictures each round (tools/island-shots.py: 8 coast views with the game's orbit
camera, the square, the summit, from above, a ground map) and asks for changes; the island is rebuilt with the tools
(build-island, then build-copperleaf), never by hand. One draft PR for the whole pass.

**Round 1** (the owner: too big, the sea too low, the river into the bay at a logical point, no hamlet, a better
mountain from the run maps' generator, two bridges at most, apart). Answers in chat: ~150 m, a 2-minute lap; the sea up
to the beach (and the run maps' coasts too); a long craggy ridge, shelves with ragged edges, forest up its foot; the
river from the pond into the bay's head; the bridges at the square and upstream, the pier not counted; 6-8 cottages on
both banks; the barn and pasture inland beside the town; the generator copies the run maps' recipe (mapgen.js not
shared). Checked against the code:
- **The sea's 1.8 m** was a mapgen bug, not a dial: `mapgenLowerWater` lowered a corner once for each of its (up to
  four) water cells, so a stream's water, and a sea joined to a stream, sank up to 1.8 m under its banks. Fixed for
  every map (run maps' rivers too; the golden water scene remade on purpose). The island's open sea then lies at
  `ISLAND_SEA_BED` (-0.1 m), its surface about 0.2 m under the sand at the waterline.
- **A ~150 m island with the old mountain finds no trail on most seeds**: a 19 m foot under a 28 m peak is too steep for
  the switchback search. The mountain keeps a 22 m foot and a 24 m peak; the craggy look cuts down from the smooth
  shape the trail climbs (`G.mtnE` is the smooth one), so the trail is found on every seed tried.
- **The river is short** on a 150 m island (the mountain's foot to the bay's head is ~30 m in a straight line). The
  pond sits 60 degrees round the foot and the river curves (41-52 m); the square moved two thirds of the way down the
  main street, so the second bridge (a footbridge path upstream, when no path crosses there) can be 25 m away, not 40.
- Many seeds miss a plot or the second bridge (the generator notes it); the seed is `copperleaf-13`, which places
  everything. The lab, the airship station, the shop and the home fall back to the coast road near the square.
- The flat barn zone, laid over the river, wiped it out (a zone resets its cells): the barn and pasture moved west.
- **Five directions** (relief maps from the generator, the owner's ask): A as built, B the bay facing the first view,
  C a big mountain with a rocky north, D a forest island, E a beach island. **The owner picked E**: two beaches (west,
  wide with dunes; north-east), one short cliff, the forest north of the mountain; seed `copperleaf-e9`, the barn at
  205 degrees 46 m, the pasture at 185 degrees 50 m (closer in, the town's outline from the first run covered the
  barn's zone on a rerun). Copperleaf's own dials are in its `islandGen`; the generator's defaults stay option A.
- **A game bug the island showed**: `navGrid` blocked a turned building's unturned box a second time on any map with
  bridges, which for some angles lies over its own door (the barn's and Juniper's home's checks failed). Fixed.

## Running sessions side by side
- **One owner per file at a time.** `copperleaf.json`: IS-5 only. `logic/mapgen.js`: nobody here while TR-2c part 2
  is open. `walk/camera.js`: IS-1 only. Water and sky: IS-3 only. Prop data and art: IS-4 only. Studio: IS-6a/6b only.
- **Shared files merge by keeping both**: HANDOFF.md entries (newest on top), CHANGELOG.
- **Never hand-merge `game/js/hooks.js`**: after a merge run `npm run modules` and commit what it makes.
- **Ratchet ceilings** (lint's spacing count): two branches each under the ceiling can go over it together (PRs
  #110 and #112 did). After a merge, set the ceiling to main's count in its own commit.
- **Schema and types**: IS-0 adds every new field, so wave 1 doesn't collide there.
- Other work open now: RL-10 (ranch B), RL-12, TR-2c part 2, UI-6, batch 11. IS-4 takes the barn from batch 11; IS-8
  waits for RL-10.

## Ask me before (recommendation first)
1. **Size**: ~135 m across, a lap ~90 s walking, ~50 s running (rec) / ~180 m, ~2 min walking / ~110 m, ~70 s.
   **Answered in IS-2: ~150 m, then ~220 m** (after the sketches: room for the river town, the hamlet and the
   mountains; the coast loop 580 m, ~170 s walking).
2. **On the mountain top** (inside the dead zone): the camera holds still (rec) / you turn it freely there.
   **Answered 2026-10-22 (IS-1): holds still; your own turn (`turn`) still works on top.**
3. **The sun**: fixed in the world, shadows stay put as you circle (rec) / locked to the camera, the same slant on
   screen everywhere (shadows swim). A Studio toggle to compare both.
   **Answered 2026-10-22 (IS-1): fixed in the world; the toggle is Engine > Camera > Sun turns with the camera (off).**
4. **The town**: kept as it is in the south, end buildings turned outward (rec) / relaid as a ring facing the sea.
5. **Wild Billies in the hub**: tall grass in the forest and heath, low levels, as Copperleaf has now (rec) / none.
6. **The cove**: dock and fishing now, boats to other islands later (rec) / scenery only. **Answered in IS-2: a dock
   landing and a deep channel** (the dock itself is IS-4's).
7. **The mountain**: climbable, summit lookout (rec) / scenery only. **Answered in IS-2: climbable.**
8. **The pasture**: ranch Billies roam in it, up to ~6 (rec) / fence and props only for now.
9. **The stream and fall** from the mountain to the cove: yes (rec) / no. **Answered in IS-2: yes, with a pond.**
10. **The generator for later islands**: built reusable now, a Studio "island" kind later (rec) / one-off tool.
    **Answered 2026-10-22: reusable.**
11. **New game's fall** lands in the town square (rec) / on the beach.
12. **Rooms** stay as they are, bigger inside (rec, no change).

## Risks
- **Phone cost**: ~160 x 160 m is ~3.8x today's ground (88 x 76) in tiles, heights, grass and shadows. IS-1 and IS-9
  measure; the fallback is a smaller scene, not sectors (one map is decided).
- Pictures that face one way (standees, signs, the barn until IS-4) will be seen from the side or behind.
- Camera code that assumes a north-facing view: the scene clamps, the `rw > rh` z offsets, the swoop, landmark tilt.
- The shadow map has to cover the whole island or follow the camera.
- Many fixtures and tests name Copperleaf positions; IS-5 has to find them all (grep for the coordinates and `hub`).

## Done when
You can walk the coast path a full circle with the camera turning round the mountain and no jump, every zone is in
place, the barn has its pasture, the world map shows the real island, the checks are green, and the owner has played
it on the phone and sent the frame times.

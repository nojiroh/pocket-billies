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

### IS-4 Island props
- Phase 09 batch 11's barn (now a picture) becomes a model; the rest of batch 11 stays its own batch.
- New, in the existing low-poly 32 px/m style, duplicates as variants: pasture fence and gate, trough, hay bales,
  feeder; driftwood, shells, beach grass, shore rocks, tide pool rims; the dock and a moored boat (scenery); boulders,
  scree, a cairn, the summit lookout; forest floor bits. A showcase map `test_props_island`.
- Owns the prop files and their art; touches no map but the showcase.

### IS-5 Copperleaf moves onto the island
- The one session that edits `copperleaf.json`. Move the town, the barn, the mast and airship, the well, the great
  oak and the people into their zones on `copperleaf_island`, keeping their layout where it fits; turn the buildings
  at the sector's ends to face outward. Then `copperleaf_island` replaces `copperleaf` (same id).
- Re-point everything that names a Copperleaf position: `hub`, `npcSpots`, people, `life` areas, `wild`, the bridge,
  fixtures (`?fixture=lab`, `ranch`, `run`), check-fast steps, the in-game full test, the golden scene and the frozen
  scene hash (remade on purpose), the opening fall's landing, the quick check's picture baseline (CI makes it).
- A saved hub position that is now sea or rock moves to the nearest walkable spot on load (one small rule).

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

### IS-6b Hub editor dials
The generator's dials in the hub editor: size, coast wobble, mountain size and height, forest arc and density, cove
angle and depth, beach arcs, cliffs, stream on/off, seed. Live preview (map-generate.js's draft pattern); "Use this
island" leaves locked zones alone and is refused while the ground is locked.

### IS-7 The world map's island
The hub's bowl map draws the real island: `island.coast` as the outline, its ground painted as each place's ground
is (phase 10's 1.5 m pixel ground), the mountain's relief, the town's buildings close in. `worldmap.json`
`sea.island` from the real size. World map test step.

### IS-8 Barn and pasture
The fenced pasture beside the barn (IS-4's fence and gate), up to ~6 ranch Billies wandering in it (from storage and
trainees, RL-10's data), tap one or the gate to open the ranch sheet. Waits for RL-10 to merge.

### IS-9 Dressing, variety and phone pass
Forest density and clearings, the terrain kinds dressed with props, gulls and crabs on the beach, the wild patches
placed (question 5), the phone's frame times at 8 angles round the coast, then the owner's play test.

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
2. **On the mountain top** (inside the dead zone): the camera holds still (rec) / you turn it freely there.
3. **The sun**: fixed in the world, shadows stay put as you circle (rec) / locked to the camera, the same slant on
   screen everywhere (shadows swim). A Studio toggle to compare both.
4. **The town**: kept as it is in the south, end buildings turned outward (rec) / relaid as a ring facing the sea.
5. **Wild Billies in the hub**: tall grass in the forest and heath, low levels, as Copperleaf has now (rec) / none.
6. **The cove**: dock and fishing now, boats to other islands later (rec) / scenery only.
7. **The mountain**: climbable, summit lookout (rec) / scenery only.
8. **The pasture**: ranch Billies roam in it, up to ~6 (rec) / fence and props only for now.
9. **The stream and fall** from the mountain to the cove: yes (rec) / no.
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

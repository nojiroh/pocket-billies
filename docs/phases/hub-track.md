# Hub track (HB) - Copperleaf island revamp, the train station and the run's loading screen

Branch: track/hub

The owner's brief (2026-10-25): revamp the hub island. The floating world map shows the ocean, but not too much; the
player's spot is shown in the right place; the map is more detailed and looks like a version of the real island.
Building doors are placed so the orbit camera sees them. More variety in building types. The building and prop decal
system works. The ranch's fence looks naturally placed. Runs (Expeditions) start from a train station with varying
retro-futuristic flying trains that fly into the sky through a portal, and a loading screen makes sure everything is
loaded in. Planned in Plan Mode on 2026-10-25 (session branch `claude/hub-island-revamp-4fskxy`); the owner makes
`track/hub` from main and every HB session works there (docs/BRANCHES.md). Tags `hb-N-done` (the owner pushes them).
Every session starts in Plan Mode and ends with a HANDOFF entry.

Before proposing anything in a session: read the latest HANDOFF.md entries and recent merges, then check the facts
below against main and report what differs.

## Decided (the owner, 2026-10-25)
- **World map ocean**: a shallow lagoon ring round the floating island (about 1.3x its radius) fading into the
  clouds, with **waterfalls** spilling off the rock's rim.
- **World map relief at real height** (1x, matching the life-size buildings and trees; today 3x).
- **Doors**: each building takes the quarter turn (0/90/180/270) nearest to facing outward from the orbit pivot (at
  most 45 degrees off), so its room stays square with its walls.
- **The island is not locked and is open to be reimagined**, with today's island as the base. Same size, a denser
  town (a second street). **Sketch options first** (HB-4a), like the island track's look pass.
- **Remove the summit lookout.**
- **New buildings**: the General store opens; an inn/cafe; a Workshop; a Gene Bank (splicing track); a library /
  the Bureau's archive; a lighthouse at the cove and a windmill by the farm (scenery landmarks).
- **Fence**: weathered post-and-rail on a gently bending line (today's fence model).
- **The station**: on a headland by the town, the sky rail running out over the sea and climbing to the portal.
- **Trains**: one retro-futuristic flying train per **region theme**.
- **Loading screen**: inside the carriage, the portal tunnel streaming past the windows, the region's name, a tip and
  a progress bar.
- **Coming home**: the train comes back out of the portal: gold-trimmed after a win, a battered, smoking carriage
  after a loss.
- **The airship** stays in the hub as **scenery only**: "Start a run" and the Crest upgrades move to the station.
- **During a run** you walk between nodes seamlessly, as now (no train on the run map).
- **Order**: the pin and decal fixes first, then the loading screen.

## Verified facts (2026-10-25, main at f779581)
Every figure is a claim from a read of the code: check it again at the start of each session.

**World map (floating island)**
- The "you are here" pin, ring and walking sprite are drawn at the location's spot (`world-bowl.js` ~2926-3022,
  `worldBowl.spots[saveData.trip.node]`), which `bowlMapPoint` (logic/bowl-things.js:48) makes the island map's
  middle (w/2, h/2 = 95, 77), not the player: ~50 m from the town (hub 141.5, 56.6). Its height is the coarse 6 m
  grid's (`bowlGridHeight`), not the fine ground (`worldBowlSkyFloor`); the sprite is drawn 18 px to the side. The
  right transform already exists: `bowlMapPoint(s, M, walkView.pl.x, walkView.pl.z, BOWL_METRES)`
  (`worldBowlFloatHome`, and the lab). The landmark with no prop of its own is also put at the middle.
- `BOWL_ISLAND_LIFT = 3` (logic/bowl.js ~562): the 24 m peak reads as 72 m beside life-size things.
- The ground is `floatGroundMesh` (logic/float-island.js ~270), 1.5 m squares cut to the coast; the map's tile
  letters are stamped into the bowl's index texture (~1 m a texel) but clipped by the coarse grid (`bowlCoastAt`, ~6 m:
  a blocky coast). Heights are averaged per 2 m (logic/bowl-island.js ~93).
- The sea is gone in two places: `g.water = worldBowlFloats() ? null : ...` (world-bowl.js ~1969) and the ground
  shader's discard below the water line (~332, `uIsle`). The map rectangle has only ~10 m of sea past the coast.
- Drawn: trees as generic style shapes (`bowlTreeStyle`, not their models), buildings and landmarks with models,
  structures, plot fillers. Not drawn (`bowlPropClass`): fences (58), bushes, flowers, crops, hay, cairns, scree,
  driftwood, stumps, bridges; the map's `streams` and `bridges`. Generic bowl clumps may still be added round the
  island (unverified). Flat pictures still use `BOWL_THING_SCALE` (3x).

**Buildings and doors** (`copperleaf.json`: 190 x 154, 606 props; `cam.orbit.c` = [85, 95], `island.c` = [98, 81])
- rot 0 faces south (-z) (logic/prop-turn.js). island-gen turns every plot to face its street (`plotsAlong`,
  `plotRing`); `build-copperleaf.mjs place()` sets `rot = a + 90`. Nothing looks at the camera.
- Off from outward (from `cam.orbit.c`): lab 94, Juniper's home 111, General store 127, barn 108, cottages 132, 179,
  106, 7, 41, 141, 93, 49. Only 3 of 12 within 50 degrees.
- Rooms turn by quarter turns only (logic/room-turn.js `roomTurnOf`): a building at -29 (the lab) or +33 (Juniper's
  home) already has a crooked room. The Studio's warning (studio/js/map-editor.js ~328) still says "15 degrees from 0".
- The hub uses 6 building kinds. Unused models: house_red/blue/green/large, townhouse_red/yellow, bakery, inn,
  market_hall, library, greenhouse, clinic. 20 more buildings are pictures only.
- The cottages' `v: 1-3` do nothing: cottage_moss and cottage_solar have no `variants` and no `roof: 1` layers.
- `islandGen` has no `lock` and no `hash`: the ground is not locked.
- The summit lookout is placed by tools/island-dress.mjs (~415); tools/test/island-dress.test.mjs (~44) expects it.

**Decals** (picture layers in a model recipe: `{k:'img', img:'scene/next/decals/*.png', face:'fixed', yaw}`)
- Drawn by `propModelImageItems` (prop-models.js ~1515). The model draws at `p.s * lk.size` (~1729); the decals use
  `p.s` only: they drift and mis-scale on anything with a size wobble (laundry_line x6 on the hub, cottage_juniper,
  banner_bunting, giant trees).
- A flipped prop mirrors the decal's x and picture but not its `yaw`: side decals face the wrong way, lettering reads
  mirrored.
- `mooredBob` moves the model, not its decals.
- Only test: tools/test/prop-turn.test.mjs (the yaw passthrough). Nothing tests decal position, size or flip.

**Pasture fence** (logic/pasture.js, tools/build-pasture.mjs)
- A closed Douglas-Peucker (1.4 m) then a 1.2 m inset: 9 corners, sides of 18-24 m dead straight.
- `fence_wood` copies spaced evenly, never resized: short sides overlap (doubled posts), the stub by the gate pokes
  ~0.4 m into the gap, long sides leave hairline gaps; every post rot 0; every rail on a side the same rot.
- A boxed prop sits at the ground height of its middle, no tilt (frame-items.js `propBaseHeight`); the zone is
  flattened, so nothing floats today, but a fence off the flat would.

**Run start** (airship.js, run.js, run-world.js)
- `flyMenu` → `runStartSheet` → "Take off" → `runTakeOff`: `runWorldSync` makes all 12-14 run scenes in one tick
  (~30 ms each in Node, more on a phone): the page freezes with the sheet closed. `runWorldLetGo` resets the bowl.
- `startAirshipFlight` preloads the landing map (`prepareMap`); the run's bowl is never prewarmed
  (`worldMapPrewarm` runs only in the hub and the fall). The map is covered (`worldMapFade`) until ready or 5 s; the
  2-3 s flight can end hidden, or the cover lifts unready. Model recipes load lazily (`loadPropModelRecipe`): pop-in.
- The only loading screen is the boot's (`#loader`, boot.js `loadingScreen`).
- No train, rail or track exists. Portal models exist unused: `portal_ring`, `portal_rift`, `portal_door`,
  `portal_gate`, `portal_hole` (scene/next/models, tags `test`, `city`). The glass lift's veil (`rideGlassLift`) is
  a usable transition pattern.

## Sessions

| # | Session | Goal | Depends on | Sessions |
|---|---|---|---|---|
| HB-1 | Pin and decals | The pin at the player's real spot and ground height; decal size, flip and bob fixed; unit tests; a Studio decal overlay | none | 1 |
| HB-2 | Loading screen | Run scenes made in slices behind a loading screen that waits for the run bowl, the landing map's art, models and ground | none | 1-2 |
| HB-3 | World map: ocean and detail | Lagoon ring and waterfalls; relief 1x; real tree models, fences, bridges, stream and pond, paths; a smooth coast; no stray clumps; phone frame times | HB-1 | 1-2 |
| HB-4a | Island sketches | 3-4 relief-map directions from today's island for the owner to pick | none | 1 |
| HB-4b | The island rebuilt | The picked direction through the tools: second street, doors to the camera, station headland, plots for the new buildings, no lookout, fixtures re-pointed | HB-4a | 1-2 |
| HB-5 | Building variety | Cottage variants that work; the new buildings from existing models; new models where none fits (Workshop, Gene Bank, lighthouse, windmill) | HB-4b | 1-2 |
| HB-6 | Natural fence | The bending post-and-rail fence | HB-4b | 1 |
| HB-7 | Station and trains | The station, platform and sky rail models; one train per region theme; the station's sheet takes "Start a run" and the Crest upgrades; the airship scenery only | HB-4b | 1-2 |
| HB-8 | Departure and return | Board, climb the rail, the portal opens, the train flies in, the carriage loading screen; the return out of the portal (win and loss) | HB-2, HB-7 | 1-2 |
| HB-9 | Look pass on the phone | Headless phone pictures each round, then the owner's play test and debug log | all | 1 |

About 10-15 sessions. HB-1, HB-2 and HB-4a can run side by side; then HB-3 beside HB-4b; then HB-5, HB-6 and HB-7.

### HB-1 Pin and decals
- Pin: when the walk view is on the island map, the pin, the "here" ring and the walker use
  `bowlMapPoint(spot, M, walkView.pl.x, walkView.pl.z)`, else the map's `hub` point; the height from
  `worldBowlSkyFloor`; the sprite on the pin, not beside it. The landmark at its own prop. Unit test of the
  transform (logic/), check-fast's map check reads the pin's spot.
- Decals: one helper gives a decal's place, size and facing from the item (size `p.s * lk.size`, the turn, the flip
  mirrors the yaw too, the bob added); `propModelImageItems` uses it. Lettering on a flipped prop: mirror the place,
  never the picture (or refuse flip on models with lettering; ask). Unit tests: position, size, flip, turn. A Studio
  overlay "Decals" drawing each decal's frame. Headless pictures of every model with a fixed decal (tools/).
- Fix the Studio's room warning to "15 degrees from a quarter turn".

### HB-2 Loading screen
- A loading screen (UI kit, `pb-*`) with a progress bar and a list of stages; reused by HB-8 with the carriage view.
- `runTakeOff` stops being one tick: the scenes are made one per frame (or in idle time) behind the screen, then the
  run's bowl is prewarmed (`worldMapPrewarm` for the run world), the landing map prepared (`prepareMap`, the ground
  built), the model recipes of the landing scene and its neighbours fetched (`loadPropModelRecipe`), the pictures in.
  The screen lifts only when every stage says ready; a time cap (the owner's number; rec 20 s) lifts it anyway and
  writes which stage was late to the debug log (timings only, never save data or names).
- Resume of a run (a reload mid-run) goes through the same screen.
- Checks: check-fast's run start step waits on the ready signal; the in-game full test and Start-Game unbroken.

### HB-3 World map: ocean and detail
- Lagoon: a water disc round the island at sea level (~1.3x the coast's radius, the `mwater` program), a soft fade
  at its rim into the cloud sea; the shallows from the map's own sea letters inside it; the rock starts under the
  water line. Waterfalls: 2-4 falls where the lagoon's rim is nearest the coast, a falling sheet and mist into the
  clouds (no new texture; the existing water and foam).
- `BOWL_ISLAND_LIFT` 1 for the floating island (runs' bowl unchanged). The coast stamp from the fine map, not the
  6 m grid. Trees as their models (far ones flat if the phone asks), fences, bridges, the stream and the pond, paths.
  No bowl clumps off the island.
- Phone frame times at 4 orbit angles; the fallbacks are Engine settings.

### HB-4a Island sketches
- 3-4 directions from today's island (`copperleaf-e9`), relief maps and from-above pictures with the town, the second
  street, the station headland with its rail out to sea, the lighthouse, the windmill, the pasture and the new
  buildings marked. Same size. The owner picks one (or mixes).

### HB-4b The island rebuilt
- The picked direction through the generator's dials and the build tools (build-island, build-copperleaf, the
  dressing), never by hand. Plots pick the street side whose front faces out from `cam.orbit.c`, then snap to the
  nearest quarter turn. The summit lookout leaves the dressing (its test too); the model stays in the Studio.
- Re-point every hub position: `hub`, `npcSpots`, people, life, wild, fixtures (`lab`, `ranch`, `run`), check-fast
  steps, the opening fall's landing, island-gen.test, the quick check's pictures.
- A check: every building's door within 45 degrees of outward and on a quarter turn.

### HB-5 Building variety
- Cottages: `roof: 1` layers and `variants` colour swaps so `v` and `roof` work; mixed with the coloured houses and
  townhouses.
- Open the General store (shop room). The inn/cafe (inn model), the library as the archive (library model). New
  low-poly models (32 px/m) for the Workshop, the Gene Bank, the lighthouse and the windmill (turning sails).
  Rooms: which get one (ask: rec the store, inn, library, Workshop; the Gene Bank waits for the splicing track).

### HB-6 Natural fence
- The line follows the zone with gentle bends (a light smoothing, not Douglas-Peucker to straight sides); rails cut
  to fit each span (a stretched or shortened rail, never overlapping); posts with a small seeded lean and turn; each
  post at its own ground height and the rail tilted between posts (the field may then be gently uneven); a few
  weathered or broken rails; the gate where the path arrives. Pasture tests: no gaps, no overlaps, the Billies' roam
  line inside, the gate reachable.

### HB-7 Station and trains
- Models: the station (platform, canopy, a departures board), the sky rail (pylons out over the sea, climbing), and
  one train per region theme (the run's region from RL-R1), retro-futuristic, low-poly 32 px/m. A portal ring at the
  rail's top (from the unused portal models).
- The station's act opens a sheet with "Start a run" (today's `runStartSheet`) and the Crest upgrades. The airship
  stays moored as scenery: no act.
- Player-facing words: the station's name and lines (ask; this phase changes them).

### HB-8 Departure and return
- Departure: the train glides in, you board, the camera follows it up the rail, the portal opens, the train flies in,
  a white-out into the loading screen (HB-2) shown as the carriage's inside with the portal tunnel past the windows,
  the region's name and a tip. Tap to skip the flight, never the loading.
- Return: the train comes out of the portal and down the rail to the station; gold trim after a win, a battered,
  smoking carriage after a loss. Then the payout as now.
- Reduced motion: a short fade version. Checks: check-fast's run start and return steps.

### HB-9 Look pass on the phone
The owner looks at headless phone pictures (tools/island-shots.py extended: the station, the departure, the loading
screen, the world map at a few hours) and plays it on the phone; the debug log carries the loading screen's timings.

## Ask me before (recommendation first)
1. The loading screen's time cap: 20 s (rec) / 30 s / none.
2. Lettering on a flipped model: mirror its place only (rec) / never flip models with lettering.
3. Which new buildings get rooms: store, inn, library, Workshop (rec) / all / none yet.
4. The station's and trains' player-facing names.
5. The number of waterfalls and whether they sound (rec: 3, quiet on the map).

## Risks
- **Phone cost**: the lagoon, waterfalls and real trees on the world map; HB-3 measures.
- **Positions**: HB-4b moves the town; fixtures, checks and the fall's landing name its positions (grep for the
  coordinates, `hub`).
- **Start-Game, resume and the in-game full test** go through the new loading screen (HB-2).
- **One owner per file at a time**: `copperleaf.json` and the island tools HB-4b only, then HB-5/HB-6/HB-7 one at a
  time on it; world-bowl.js HB-1 then HB-3; run.js and airship.js HB-2 then HB-8.

## Done when
The world map shows the island as it is, with its lagoon and falls and your pin where you stand; every door faces the
camera; the new buildings stand; the fence looks laid by hand; a run starts at the station, the train flies through
the portal and the loading screen lifts only when everything is in; the return comes home through the portal; the
checks are green and the owner has played it on the phone.

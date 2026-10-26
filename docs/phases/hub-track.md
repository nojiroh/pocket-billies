# Hub track (HB) - Copperleaf island revamp, the train station and the run's loading screen

Branch: track/hub

The owner's brief (2026-10-25): revamp the hub island. The floating world map shows the ocean, but not too much; the
player's spot is shown in the right place; the map is more detailed and looks like a version of the real island.
Building doors are placed so the orbit camera sees them. More variety in building types. The building and prop decal
system works. The ranch's fence looks naturally placed. Runs (Expeditions) start from a train station with varying
retro-futuristic flying trains that fly into the sky through a portal, and a loading screen makes sure everything is
loaded in. Planned in Plan Mode on 2026-10-25 (session branch `claude/hub-island-revamp-4fskxy`, where HB-1 was built too at
the owner's word); the owner makes `track/hub` from main and every later HB session works there (docs/BRANCHES.md). Tags `hb-N-done` (the owner pushes them).
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
- (HB-6, rechecked) `fence_wood` is a 2.2 m section with three posts of its own, and the corner post is an 8 vox/m
  model. Low-poly models ignore `wear`/`tint`/lean. The model shaders' spin (RF-2) was unused by the walk view.
  Done in HB-6 below.

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
| HB-10a | Square: shape and fountain | The lobed ~12 m outline as a rerunnable patch (town locked), the fountain in place of the well, the streets entering in a pinwheel, a framed view of the sky rail and the portal; headless pictures | HB-4b | 1 |
| HB-10b | Square: edges and market | Benches, planters, streetlamps, stalls, awnings, crates round the edge (existing models, remade where weak); lit windows, string lights, fireflies, the lit fountain | HB-10a | 1-2 |
| HB-10c | Square: people | Stop points and time-of-day schedules for the townsfolk, 6-10 at once (an Engine setting), your ranch Billies visiting; phone frame times | HB-10b | 1 |
| HB-10d | Square: reactions and things to do | Win banners, loss gossip, the fountain's chapter changes, the notice board, the fountain's coin gamble, the busker's slot (a resident: RS-3/RS-4) | HB-10c | 1-2 |
| HB-10e | Square: festivals | Market days and festivals by run count, real dates (clock-safe, offline) and milestones, with a festival market | HB-10d | 1 |
| HB-10f | Town rebuild reproducible | An unlocked town rebuild that makes the same town from its dials; then the store, inn and library brought to front the square, doors still to the camera | HB-10a | 1-2 |
| HB-9 | Look pass on the phone | Headless phone pictures each round, then the owner's play test and debug log | all | 1 |

About 10-15 sessions. HB-1, HB-2 and HB-4a can run side by side; then HB-3 beside HB-4b; then HB-5, HB-6 and HB-7.

**Merged together** (2026-10-25, on `track/hub-merge`, for one PR into main): `track/hub` (HB-4a, HB-4b),
`art/hub-station-trains` (HB-7's art), `art/hub-buildings` (HB-5's art half), `props/hub-fence` (HB-6), a merge
commit each. Copperleaf rebuilt by the tools (build-copperleaf, then one round of build-island and build-copperleaf so
the ground meets HB-6's swell); see HANDOFF. The placing half (the station on its headland with the rail and portal,
the new buildings on their plots, the doors' acts) followed on `props/hub-placing`; still to do: HB-3, HB-8, HB-9.

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

**Done in HB-1** (2026-10-25, on `claude/hub-island-revamp-4fskxy` at the owner's word: `track/hub` didn't exist
yet). Answers: a mirrored model's lettering is never mirrored (it moves and faces the mirrored way); a pictures tool
(tools/look-decals.py), no Studio overlay. Checked against the code:
- The walk on the island was never found by the world map: the hub's walk view is `w:copperleaf*`, not the map's
  id, so the map's "opens from where you stand" never did either. Both read `worldBowlWalkOnIsland` now.
- `decalPlace` (logic/prop-turn.js) is tested against the model shaders' own transform, so a decal can't drift from
  its model again without a test failing.
- Left for HB-3: a flat landmark picture with no prop of its own still stands at the map's middle.

### HB-2 Loading screen
- A loading screen (UI kit, `pb-*`) with a progress bar and a list of stages; reused by HB-8 with the carriage view.
- `runTakeOff` stops being one tick: the scenes are made one per frame (or in idle time) behind the screen, then the
  run's bowl is prewarmed (`worldMapPrewarm` for the run world), the landing map prepared (`prepareMap`, the ground
  built), the model recipes of the landing scene and its neighbours fetched (`loadPropModelRecipe`), the pictures in.
  The screen lifts only when every stage says ready; a time cap (the owner's number; rec 20 s) lifts it anyway and
  writes which stage was late to the debug log (timings only, never save data or names).
- Resume of a run (a reload mid-run) goes through the same screen.
- Checks: check-fast's run start step waits on the ready signal; the in-game full test and Start-Game unbroken.

**Done in HB-2** (2026-10-25, branch `track/hub`; tag `hb-2-done` for the owner). The owner's answers: a 20 s cap;
**fly, then load** (the flight crosses the run's own map, so its places are made before it; the loading screen comes
at the landing).
- `logic/run-load.js` (stages, share, cap, the log line; unit-tested), `rules.json run.load.capMs` 20000 (check-data
  checks it).
- `pb-loading` in ui-run-kit.js (heading, sub, tip, bar, stages; slot `view` for HB-8's carriage; `contained` for the
  gallery's "loading" section, baseline taken).
- `runScenesSlices` (logic/run-scenes.js) and `runWorldMake` (run-world.js): the scenes made one a frame
  (requestAnimationFrame then a timer), the put shared with `runWorldSync` (which stays for the hub's world back and a
  save swapped in). The swap is one tick as before.
- Take-off: the save part at once; the start sheet stays (inert) and Take off counts the scenes ("Readying the
  airship… 6/14"); then the arrival, the flight and `run-loading.js` from the flight's start: the landing map
  (`prepareMap`), its models' recipes (landing and joined places, from the composed view) then their decal pictures,
  the run's world map prewarm (`worldMapPrewarm(done, eager)`: on a timer, its share from the terrain's rows), the walk
  view drawn a few frames (not the GPU's normal-map queue: it drains a few a second in software drawing). `flyLand`
  shows the screen if the landing isn't ready; it lifts when every stage is, or at the cap.
- Resume: boot makes the run's world with `runWorldMake` behind the boot's loader ("Making the run's places 6/14"),
  then begins the landing's loading and shows the screen as the loader goes. `runResume` finishes a take-off a reload
  stopped before the arrival (phase 'fly', no path).
- Debug log: one `load` line, e.g. `run take-off 11042 ms: map 2361, models 2899, bowl 11037, walk 6052; scenes 14,
  work 2030, wall 4212, shown 1` (`late NN%` and `capped` when the cap lifted it). No seed, name or save.
- Checks: check-fast run_pack (Take off counts; no task as long as the scenes' work; the screen lifts; a take-off line
  without the seed), run_world (a resume line); check-quick's run step and the self-test's run phase wait on
  `runLoad.ready`.
- Not done: the Take off button filling as a bar (tried; the fill didn't show in headless pictures, so it counts in
  its label instead); the screen isn't shown on a save swapped in mid-game (cloud restore: the sync build, rare).

### HB-3 World map: ocean and detail
- Lagoon: a water disc round the island at sea level (~1.3x the coast's radius, the `mwater` program), a soft fade
  at its rim into the cloud sea; the shallows from the map's own sea letters inside it; the rock starts under the
  water line. Waterfalls: 2-4 falls where the lagoon's rim is nearest the coast, a falling sheet and mist into the
  clouds (no new texture; the existing water and foam).
- `BOWL_ISLAND_LIFT` 1 for the floating island (runs' bowl unchanged). The coast stamp from the fine map, not the
  6 m grid. Trees as their models (far ones flat if the phone asks), fences, bridges, the stream and the pond, paths.
  No bowl clumps off the island.
- Phone frame times at 4 orbit angles; the fallbacks are Engine settings.

**Done in HB-3** (2026-10-25, branch `art/hub-world-map` at the owner's word, beside HB-4b on `track/hub`; tag
`hb-3-done` for the owner). The owner's answers: 3 falls, silent; the lagoon on the bowl's own water (`mwater`), WA-7
swaps in the water track's pixel look after this merges. Checked against main at f691ce9:
- Already true on main: no bowl clumps on the floating island (0) and no landmark picture at its middle (0 standees):
  Copperleaf's landmark is a prop with a model. Both are now guarded in code all the same.
- Not true: every map model ignored its placement's `rot` (only the plots' fill-ins turned); fixed. The tree models
  are limbs and leaf picture cards, both of which the map's model builder drops: they are made again for the map
  (`bowlTreeFromRecipe`). Flat pictures on the floating island were still 3x (`BOWL_THING_SCALE`); now life size.
  The Bowl map test's sea, landmark and rim steps failed on the floating island since IS-7; they know it now.
- Real height: `bowlSeaInput(…, lift)`, 1 on the hub's floating island (`worldBowlIslandLift`), `BOWL_ISLAND_LIFT` (3)
  on a run's bowl. The mountain is drawn 20.6 m for its 21.9 m (the Bowl map test reads it).
- Lagoon (logic/float-island.js, tests): `floatLagoonRing` (the coast's reach at 128 angles, smoothed, pushed out 0.3x
  the mean radius: 1.3x), the bed `floatLagoonDepth` (a shelf, a 3.2 m basin, a 0.35 m sill), the fine ground runs out
  to the ring with the land meeting the water at the beach (no 4 m step), `floatLagoonWater` (depth and a rim fade in
  the bowl sea's mesh layout), the rock under the ring, `floatMistPuffs` (the clouds' puffs along the rim). The coast
  is where the water meets the 1.5 m ground, and the ground's letters are clipped by the map's own coast.
- Falls: `floatFallSpots` (the rim nearest the coast, spread a quarter turn apart), `floatFallMesh`, the `mfallw`
  shader (streak columns in the lagoon's tones, white lip, thinning into the cloud colour). Silent.
- Trees as their models (`bowlTreeFromRecipe`: trunk and main limbs as five-sided tubes, a crown blob per leaf card,
  placed and sized as the walk cuts it, in the leaf picture's average colour; a prop's `swap` for autumn trees; a
  mushroom with no leaves through the normal model builder). Fences as their models; bridges and the pier as plank
  decks (`bowlBridgeShape`, from the higher end). The stream and the pond show as the stamped water letters (painted
  water with foam, as before); paths as before, now clipped by the fine coast.
- World map settings (engine/settings.js `worldMap`, Engine panel): `lagoon`, `falls` (0-4), `treeModels`, `treeFar`
  (simple shapes past that many metres, switched in the shader; 0 never), `fences`, `bridges`. A change makes the
  island again (`worldBowlMapSettingsKey`).
- The orbit stands 1.25x further back with the lagoon (`worldBowlFloatFrame`), so the ring fits a phone's width.
- Numbers (headless, Copperleaf): 14.4k triangles of things before, ~44k after (193 trees as models); the lagoon
  10.3k triangles; 72 mist puffs; 3 falls of 96 triangles.
- Frame times: the debug menu's Bowl map test, step "The floating island's frame times": fps, worst gap and CPU draw
  time at 0/90/180/270 degrees, then at 0 degrees with no lagoon, no falls and simple trees. Headless numbers are
  software drawing; the phone's are the owner's.
- Not done: the picture standees (`mstandee`) draw red squares on the floating island (the atlas is right; the cause
  is not found), so the far-tree fallback is simple shapes, not flat pictures. The stream and pond are not a water
  surface of their own. The falls have no plunge or splash (they fade into the clouds).

### HB-4a Island sketches
- 3-4 directions from today's island (`copperleaf-e9`), relief maps and from-above pictures with the town, the second
  street, the station headland with its rail out to sea, the lighthouse, the windmill, the pasture and the new
  buildings marked. Same size. The owner picks one (or mixes).

**Done in HB-4a** (2026-10-25, branch `art/hub-island-sketches`, not `track/hub`: a one-session art branch at the
owner's word; HB-4b merges it into `track/hub`). **The owner's pick: a version of B (East crescent) with more of a
town square; the hub waterfall above the pond.**
- Facts that differed: the orbit pivot `cam.orbit.c` is the **summit spot** (island-gen.js `orbit.c = summit`), not
  the island's middle: "outward" is away from the mountain top. Off-outward figures hold (3 of 12 props within 50; 2 of
  12 plots within 45). The generator's dials use 0 = east, 90 = north (x = cos, z = sin); island-shots' compass is 0
  north, clockwise. The town already had three streets (main, cross, east bank) plus the quay; the doors miss because
  the main street and east bank run toward the mountain (radial): a side facing its street faces 90 off outward.
- New generator dials (all off by default; the hub's island unchanged, island-gen.test checks it): `town.face`
  ('out': only the street side within `town.tol` of outward), `town.quarter` (plots on the quarter turn nearest
  outward, stepped back up to 3 m from the street), `town.second` (a second built-up street; `along: 'arc'` runs round
  the pivot, in pieces where other streets cut it), `town.scale` (house plot size), `town.extra` (inn, workshop,
  genebank, library: `ISLAND_TOWN_EXTRA`), `landmarks` (the station on the headland that stands out most within 80
  degrees of the square, its rail out to sea climbing `rise` m to the portal, returned as `landmarks: {rail, portal}`
  beside the scene; the lighthouse on the cove's arm further from the station; the windmill by the barn; `shore` 3 m
  from the water, for the water track's tide and wading). Tests: tools/test/island-gen-doors.test.mjs (slow tier).
- **B's dials** (tools/data/hub-sketches.json `b`, on copperleaf-e9): `town: {houses: 16, quarter: 1, face: 'out',
  scale: 0.8, extra: [inn, workshop, genebank, library], second: {on: 1, along: 'arc', side: 'in', off: 9, span: 110,
  at: 40}}, landmarks: {on: 1}`: 17 buildings, all 17 doors within 45 of outward on a quarter turn.
- For HB-4b: **"more of a town square"** needs a new dial: the square's radius is fixed at 7.5 m (island-gen.js
  `sqR`), and B's square is the grey patch by the bay, ringed by streets, with no buildings fronting it. A square dial
  (radius, and plots round it facing in where that is outward, or on its outer side) is HB-4b's first generator change.
  Landmark plots ignore the coast path's margins (a headland is narrower than a 14 m station allows): the path through
  the station needs re-routing. The sky rail and the portal stand past the map's edge (the map holds 10 m of sea):
  props in the sea skirt, or a bigger `size.sea`. The tall grass falls to 3 of 6 patches with these dials.
- **The hub waterfall** (water track WA-2b, the owner: above the pond): copperleaf-e9 has no drop of 4 m or more on
  its stream; the only one is the 5 m north-west sea cliff. The site: 16 m up from the pond toward the summit, where
  the ground first stands 4 m over the pond (`falls` contract draft `{x: 92.79, z: 89.67, dir: [0.83, -0.56], w: 3, h:
  4.15, pool: 4}` on B); a shelf has to be cut there (the generator's or the water track's, WA-2b decides which). Tell
  the water track's lane G.
- Sketch tool: `python3 tools/island-sketches.py [OUT] [ids] [--above]` (relief maps, a sheet; `--above` the game's
  own pictures from draft maps `hb4a_<id>` put in the game data and removed after). Output in validation/hub-sketches/.

### HB-4b The island rebuilt
- The picked direction through the generator's dials and the build tools (build-island, build-copperleaf, the
  dressing), never by hand. Plots pick the street side whose front faces out from `cam.orbit.c`, then snap to the
  nearest quarter turn. The summit lookout leaves the dressing (its test too); the model stays in the Studio.
- Re-point every hub position: `hub`, `npcSpots`, people, life, wild, fixtures (`lab`, `ranch`, `run`), check-fast
  steps, the opening fall's landing, island-gen.test, the quick check's pictures.
- A check: every building's door within 45 degrees of outward and on a quarter turn.

**Done in HB-4b** (2026-10-25, branch `track/hub`; tag `hb-4b-done` for the owner). The owner's answers: the rail
and portal as data now, drawn in the sea's skirt by HB-7 (`size.sea` stays 10); the inn and the library models on
their plots, the other new plots bare pads; a 12 m square; at least 8 cottages. Merged main (HB-1) and
`art/hub-island-sketches` (HB-4a) first.
- Facts that differed: B made 5 house plots, not 16 (fewer than today's 7); `cam.orbit.c` is the summit spot, up to
  5 m from the peak the plots turned from, so a quarter-turned door could stand 47 degrees off (now guarded); the hub's
  positions are almost all derived (npcSpots, people, life, checks, fixtures, the fall's landing, the opening's spots
  rewritten by build-copperleaf from the lab's door); RF-1's "catch" never reached tools/data/copperleaf-town.json
  (a rebuild put "tax" back: fixed); HB-4a missed `npm run modules`; islandProblems and the map schema didn't know the
  new plot kinds.
- Generator (island-gen.js; each its own commit, unit tests in tools/test/island-gen-doors.test.mjs, slow tier):
  `town.square {r, off, front}` (radius; set back from the main street, room for a row facing in; plots round its rim,
  the shop, the home, the extras, then houses, the side open toward the camera left free, rectangles kept 0.6 m apart);
  a house plot never under a cottage (3.8 x 2.8 m); the quarter turn keeps clear of the diagonals by asin(5.5/d) so it
  holds from the summit spot; the station's headland chosen before the paths are painted and every path on its plot
  pushed inland round it (the same headland as HB-4a's); the opening's stage in front of the lab kept clear; no plot
  facing the airship's mast from 16 m behind (with `town.quarter`; smoke's window check found the airship hiding a
  cottage window). `STATION_PLOT`, `landmarkFits`.
- The hub is **B2** (tools/data/hub-sketches.json `b2`: B with `town {tol: 90, scale: 0.6, lanes: 3, houses: 20,
  extra: [library, inn, workshop, genebank], second.off: 15, span: 140, square: {r: 12, off: 6, front: 6}}`), built with
  `build-island --dials <hub+b2> --fresh`, `build-copperleaf`, then both again with the new town zone kept (a rerun's
  output; island-gen.test checks it). 18 buildings (10 cottages, the inn, the library), plots for the Workshop, the
  Gene Bank, the station, the lighthouse and the windmill; the lab, the library and the Workshop round the square;
  every door within 34 degrees of outward on a quarter turn (tools/test/hub-doors.test.mjs, quick tier). `hub`
  [151.63, 59.36] (was [141.49, 56.63]). `landmarks: {rail, portal}` kept by both tools (schema too): the portal at
  [243.5, 128.3], 50 m up, 53 m past the map's east edge. hub-sketches.json `base` holds the pre-HB-4b dials (the
  sketches and the dial tests start from it).
- Dressing: no summit lookout (island-dress.mjs and its test); the summit spot stays free.
- World map: the inn and the library drawn on their plots (bowl-island.js `BOWL_PLOT_PROPS`); the kinds with no
  model yet are skipped.
- **The hub waterfall, for the water track (lane G, WA-2b)**: the site is unchanged by B2 (the mountain and pond
  didn't move): `falls: [{x: 92.79, z: 89.67, dir: [0.83, -0.56], w: 3, h: 4.14, pool: 4}]` on copperleaf, 16 m up
  from the pond toward the summit; a shelf has to be cut there. Not written into the map (the scene's `falls` are lane
  G's).
- Not done / for later: Juniper's home lands 54 m south-west of the square (by the lighthouse), the inn 41 m and the
  store 27 m away up the arc street (the square's ring had no room left facing out); the tall grass has 3 patches of 6
  (the arc street takes the heath; `wild.n` 6); the Studio's Hub island card doesn't show the new dials;
  tools/build-postcards.py's view (3 m off the hub) not looked at.


### HB-5 Building variety
- Cottages: `roof: 1` layers and `variants` colour swaps so `v` and `roof` work; mixed with the coloured houses and
  townhouses.
- Open the General store (shop room). The inn/cafe (inn model), the library as the archive (library model). New
  low-poly models (32 px/m) for the Workshop, the Gene Bank, the lighthouse and the windmill (turning sails).
  Rooms: which get one (ask: rec the store, inn, library, Workshop; the Gene Bank waits for the splicing track).

**Done in HB-5, the art half** (2026-10-25, on `art/hub-buildings` at the owner's word). Answers: all five new
buildings get a room (the Gene Bank too); their doors open with a new act `enter` (the room set on the building or its
kind); the Gene Bank is a solarpunk lab-vault. Checked against the code:
- The cottages' `v` did nothing because no model building had catalogue `variants` (barn aside); the roof layers were
  missing too. Now: `roof: 1` on the cottages' roofs, `roof: 2` on their moss tufts (hidden under another roof style),
  colour-swap variants on the cottages, the coloured houses and the townhouses (tools/add-building-variants.py).
- A door opens a room only through its act (`ROOM_BY_USE`): the General store has no act at all, so it is not just
  closed. `enter` was added (data-files.js `opensRoom`). The store's stock (shops.json is `{}`) and its `act: 'shop'`
  on Copperleaf wait for the placing half.
- `lighthouse` and `windmill` were already catalogue keys (old pictures, legacy maps only): the models are swapped in
  under them. New keys: `workshop`, `gene_bank`. Rooms: int_inn and int_library back from legacy, int_workshop and
  int_gene_bank new.
- Rooms open only in a seamless world (`roomLayIn` needs the place's parts): the showcase map (test_hub_buildings)
  shows the buildings, the walk-ins are checked on Copperleaf (tools/look-hub-buildings.py).
- Left for the placing half: place them on the HB-4b island (doors on quarter turns), the store's act and stock, the
  Gene Bank's place (splicing track's Ask me before).

### HB-6 Natural fence
- The line follows the zone with gentle bends (a light smoothing, not Douglas-Peucker to straight sides); rails cut
  to fit each span (a stretched or shortened rail, never overlapping); posts with a small seeded lean and turn; each
  post at its own ground height and the rail tilted between posts (the field may then be gently uneven); a few
  weathered or broken rails; the gate where the path arrives. Pasture tests: no gaps, no overlaps, the Billies' roam
  line inside, the gate reachable.

**Done in HB-6** (2026-10-25, on `props/hub-fence`, the session's brief). Answers: the gate where the island's path
arrives; the field swells up to 0.5 m; fixed rails, not an engine stretch. Checked against the code:
- Rail tilt needed engine support, though not a new shader. The model shaders already apply RF-2's `it.spin`. The
  walk view now sets it (`logic/prop-turn.js spanFit`, `tiltSpin`; `walk/prop-look.js`): a catalogue model with
  `restEnds` rests on the ground at both ends of its width, and a placement's `tilt` leans a model.
- One rail model fits every span. The posts are evenly spaced round the line, so the spans come out nearly equal, and
  the 2 m rail (`fence_rail`) takes its span's size (`s`, within 2% on the hub, the tool refuses more than 8%).
  Weathered and broken are its variants. Every part is made from `fence_wood`'s own layers by
  tools/make-fence-parts.mjs.
- The gate is where island-gen's spoke crosses the fence: the west side, on the coast path. It hangs on its own post.
- The ground swell belongs to tools/build-pasture.mjs (`pastureGround`): level at the zone's edge and round the gate,
  so HB-4b's rebuilt island gets it again from `build-copperleaf.mjs`.

### HB-7 Station and trains
- Models: the station (platform, canopy, a departures board), the sky rail (pylons out over the sea, climbing), and
  one train per region theme (the run's region from RL-R1), retro-futuristic, low-poly 32 px/m. A portal ring at the
  rail's top (from the unused portal models).
- The station's act opens a sheet with "Start a run" (today's `runStartSheet`) and the Crest upgrades. The airship
  stays moored as scenery: no act.
- Player-facing words: the station's name and lines (ask; this phase changes them).

**Done in HB-7** (2026-10-25, on `art/hub-station-trains` from main with HB-1 merged in, at the owner's word). Answers
(Ask me before 4): **Skyline Station**; the trains **the Lakeland Clipper, the Greenbelt Sunrunner, the Wildwood
Zephyr, the Highland Arrow, the Harvest Comet**. The owner's notes on the first pictures: the trains have rocket
engines; the portal is a tear floating in the sky, retro-futuristic (not a ring on a gantry). Checked against the code:
- Region themes: 5 (`lakeland`, `greenbelt`, `wildwood`, `highland`, `harvest`); a run keeps `run.region.theme`;
  `runRegionMake` can return null, so HB-8 needs a fallback train (rec: the Sunrunner). regions.json
  `themes.<id>.train` names each theme's train (`{k, name}`), checked by check-data.
- The portal models didn't fit: `portal_ring` is shards and a flat picture, `portal_gate` 3.3 m. `sky_portal` is new.
- A model can't stand above the ground (`propBaseHeight`), so each `sky_rail` piece carries its own pylon; nothing
  moves a prop along a path (HB-8's engine work). Pieces chain 12 m apart on one heading: flat (out of the station's
  right end), bend, rise, rise high, crest (15.5 m), then `sky_portal` (the launch lip at its x -1.4, the tear at x 2).
- The airship's act was read in more places than the plan listed: `standByMast` (run end, resume, landing: now the
  station first), check-data's `dataBuildings` (a building's act must stand in Copperleaf), airship-data.test (every
  town needs act `fly`, and no prop of kind `station`: the new kind is `train_station`), check-quick's phone step,
  RL-8 and airship_moored, check-fast's Lab step.
- Copperleaf is generated: build-copperleaf.mjs places the station on the open ground nearest the mast (now 118.9,
  93.2, turned -64.5, 13 m from it). HB-4b moves it to the headland and lays the rail out to sea.
- The run still sets off on the airship's flight over the world map and the run sheet still says so: HB-8.

**Done in the placing half of HB-5 and HB-7** (2026-10-25, on `props/hub-placing` from main after PR #201, the
session's brief). The owner's answers: the station side-on (its rail straight out to sea, no new art); the Gene
Bank's door opens its room now (its machines wait for the splicing track); the General store opens with no stock.
Checked against the code:
- `landmarks.rail` didn't match HB-7's art: it started at the plot's middle on the island's spoke and climbed 45 m over
  85 m; the art is five 12 m pieces from the station's right-hand end, 0.13 m to 15.13 m, then the portal. HB-4b's
  plot faced the station out to sea, so a rail out of its right-hand end would have run along the coast over land.
  Now island-gen turns the station's plot a quarter turn clockwise from facing out (`STATION_TURN`) and lays
  `landmarks.rail` as the pieces do (`SKY_RAIL`, `skyRailHeight`): every 2 m from the right-hand end to the portal's
  launch lip, its height over the plot's level; `portal` is the tear (17.05 m up). The dials' `len` and `rise` are
  no longer read. A fresh B2 now has room for 6 house plots, not 9 (the coast road goes round the station's longer
  inland end); the hub keeps its town zone and its 10 cottages.
- The headland is low (0.91 m) and the sea about a metre under it: a placement's `y` (new, walk/frame-items.js
  `propBaseHeight`) stands each piece and the portal level with the station; the rail's piers and pylons reach 2.5 m
  under their base (build-station-trains.py `SINK`). seamless-world.js dropped props more than 2 m outside the place's
  box, which took the last three pieces and the portal (past the east edge): a placement with `y` now stays.
- build-copperleaf.mjs puts the station on its plot (rot 0 on the hub, facing south, its rail east), the five pieces
  (one per look) and `sky_portal` 12 m apart behind its right-hand end; the Workshop, the Gene Bank, the lighthouse
  and the windmill on their plots; the store's act `shop` (int_shop; its counter says it's closed: shops.json is
  empty), the inn's, library's, Workshop's and Gene Bank's act `enter` with their names. The world map's plot models
  know the new kinds (bowl-island.js `BOWL_PLOT_PROPS`). Tests: hub-doors.test (the buildings on their plots, the
  acts, the rail against the station and `landmarks.rail`), island-gen-doors (the side-on plot, the rail data),
  hub-data (Copperleaf sells nothing, rather than has no shop).
- Left for later: the walk view draws the ground and sea only 8 m past the map's edge (`GROUND_BORDER_M`), so the
  last pieces' pylons and the portal stand over the haze, not the sea (the orbit camera faces inland, so this shows
  from free cameras and will in HB-8's departure: HB-8 or HB-3 widens the sea there). `flyMenu`'s hub branch stays
  for HB-8.

### HB-8 Departure and return
- Departure: the train glides in, you board, the camera follows it up the rail, the portal opens, the train flies in,
  a white-out into the loading screen (HB-2) shown as the carriage's inside with the portal tunnel past the windows,
  the region's name and a tip. Tap to skip the flight, never the loading.
- Return: the train comes out of the portal and down the rail to the station; gold trim after a win, a battered,
  smoking carriage after a loss. Then the payout as now.
- Reduced motion: a short fade version. Checks: check-fast's run start and return steps.

**Done in HB-8** (2026-10-26, on `art/hub-departure` at the owner's word, from main after PR #205). The owner's
answers: **climb, white-out, load** (Take off closes the sheet, the ride plays in the hub, the carriage screen comes up
behind the white-out while the run's places are made, you land straight on the first place: no airship flight for
runs); **payout, then return** (the payout screen as before, its button "Ride home", then the train home, then the
toasts and the lost run's scene); the words as proposed. Checked against the code:
- A prop could already move along a path: the cutscene director's traffic (`cutsceneTraffic`: a placement with `lift`
  and `moving`) and the walk view's director hook (`walkView.director.frame`: its own camera, items and lights). The
  ride uses both patterns (train-ride.js), not the cutscene system (its teardown stops the walk view).
- "The walk view draws the sea only 8 m past the edge" was not so: on a `flatFar` map the sea skirt runs to 400 m
  (ground-mesh.js `seaSkirt`); `GROUND_BORDER_M` is the land's border. What stood "over haze" was the map's haze
  (`hazeD` 40) and the walk camera's lens blur focused on the player. The ride's frames focus on their own target, and
  the shots out over the sea see further (`hazeK` 1.8, a director frame's new haze factor: walk/lighting.js). The
  level shots over the town keep the walk's haze: stretched there, the far sea shows the world's curve as a band in
  the sky.
- The 20 s cap started with the loading: with the places made behind the screen it could have gone off before the run
  had a world. logic/run-load.js has `hard` stages now (never late; the cap counts from when they are ready).
- The run's region, and so its train, isn't known on the start sheet (the seed is rolled at Take off): the sheet says
  "A sky train flies you…"; the payout names the run's train.
- The self-test, check-fast's run_pack and run_loop and check-quick's RL-8 waited on `airshipFlight`.
- Built: `logic/train-path.js` (the way: the station's track bed, `landmarks.rail`, the tear; the glide in; the
  placement: in front of the rail by half the train's width, turned, lifted, nose up), tools/test/train-path.test.mjs;
  `train-ride.js` (departure ~9.4 s: glide in over the town, you board, the chase up the rail, the tear swells and
  flashes, the train shrinks into it, the white veil; home ~7 s: the tear opens (gold after a win), the train out of it
  facing west and down the rail, you step off where `standByMast` stands you; the train stays at the platform, still;
  a tap skips; reduced motion or no hub view: a 400 ms white fade, the train parked); `train-carriage.js` (a ~144 px
  pixel canvas: seat backs, the rack and its bags, windows with the tunnel's streaks and rings, faded into the screen's
  colour under its text); the trains' looks v 1 gold trim and v 2 battered with smoke fx, their carriage colours and
  the portal's tunnel colours (build-station-trains.py); the take-off's `places` stage; postcards, the update check and
  the story's waiting scene hold off while the train rides; one debug log line a ride (`train ride departure
  train_greenbelt 9440 ms`, `(skipped)` when tapped).
- Removed: `flyMenu`'s hub branch (tickets, Start a run, its upgrades), flyLand's run landing, the Take off button's
  "Readying the airship" count. The airship flight itself stays (nothing in the game starts one; check-fast flies it).
- Words beyond the list: Chosen's line after a win "came home by train", the Crest "spent at Skyline Station".
- Checks: check-fast "The train ride" (played out, both returns), run_pack/run_loop through the ride (skipped), the
  self-test's run phase "A run: the train, nodes, payout". Pictures: `python3 tools/look-train-ride.py`
  (validation/look-train-ride/).
- Not done: the station's own door/boarding animation (you walk to the train and vanish); the train has no sound of
  its own (the take-off motif and a whoosh at the tear); a save swapped in mid-ride is not handled specially.

### HB-10 The square alive
Planned 2026-10-26 in Plan Mode with online research (session branch `ccr-144f3c08-vf09lo`). The owner's brief: the
town square is empty and the layout dull; make the hub island feel more alive. WA-10 left a natural outline, 3D props
and the front plots here (the old HB-10 row).

**Verified facts** (main at b87b818d; check again each session)
- The square's middle is the well plot (148.63, 59.36), paved to about 8 m by WA-10 (`patch-copperleaf-water.mjs
  --square`); dials `town.square {r: 8, off: 6, front: 6}`. Within 18 m stand 8 props: the well, one lantern, a
  signpost, a fruit tree, the giant swing tree, bracken, the Workshop, one cottage.
- From the well: Workshop 16 m, lab 19, library 22, General store 27, inn 41, station 43, Juniper's home 54. No
  building fronts the square.
- People: Juniper only (at her cottage), `folk: 5` wandering; animals in `life`. No day schedules found.
- Models in game/art/scene/next/models never placed on the hub: fountain, bench_wood, stall, market_cart,
  market_hall, streetlamp(_b), notice_board, clock_tower, flag_pole, banner_bunting, planter_round, crate_goods, sack,
  tent, campfire, bike_rack, bin (low-poly or picture not yet checked).
- An unlocked town rebuild is not reproducible (WA-10): layout changes are hand patches with the town locked until
  HB-10f.

**Research** (what we take)
- Whyte, *The Social Life of Small Urban Spaces*: sittable space, food, water, trees and "triangulation" (a
  performer or feature that gets strangers talking). → the fountain, the busker, the stalls.
- Gehl, the edge effect: people stop along edges and facades first; the middle fills last. → edges before middle;
  the middle stays walkable for the orbit camera.
- Sitte: irregular but rule-bound squares, streets entering at T-joins or as a pinwheel, bent lines, changing views.
  → the lobed outline and pinwheel entries.
- Hades (small hub changes after runs), Animal Crossing (the plaza upgraded at headcount milestones), Stardew
  (festivals in the square), Lumiose (one landmark per plaza, its use changing). → reactions, festivals, growth by
  residents.
- Solarpunk squares: a market, a water feature, outdoor dining, seed exchange, tool library. → the market mood.

**Decided** (the owner, 2026-10-26)
- Mood: a busy solarpunk market. Bureau: hints only (a notice, a closed kiosk, a watcher).
- The middle: a **fountain** (the well goes), lit from below at night, changing per chapter.
- About **12 m with a lobed outline** (WA-10 had made it ~8 m at the owner's earlier word; confirm in HB-10a).
- Layout in two steps: hand patches now (the square moves toward the buildings), then HB-10f's reproducible rebuild
  brings the store, inn and library to front it.
- A framed view from the square to the sky rail and the portal.
- People: stop points and time of day (morning market, busy midday, quiet lantern evening), 6-10 at once, measured
  and scaled by an Engine setting; your ranch Billies visit.
- Growth: residents add stalls (RS-3/RS-4); the square reacts to runs (win banners, loss gossip, the fountain's
  chapter changes); festivals by run count, real dates and milestones (all three).
- Interactions: the fountain's coin toss as a **gamble**; a notice board (quests, daily seeds, ghost teams); a busker
  who is an invited resident and plays your last run's region theme.
- Night: lit windows, string lights, fireflies, the lit fountain.
- Art: reuse the existing models, remade low-poly (32 px/m) only where they miss the airship style.
- Sound: later, by the sound track; leave hooks (fountain, chatter, busker).
- Order: look first (HB-10a, b), then people, then reactions, festivals, and the rebuild.

**Ask me before** (recommendation first, in the session that needs it)
- HB-10a: the square's size, 12 m (rec, as chosen) / ~8 m (WA-10's).
- HB-10d: the coin gamble's cost, odds and effects (rec: a small stake, mostly small boons or a joke, a rare big win
  or a small curse, once per return).
- HB-10d: the fountain's look per chapter.
- HB-10e: the festival calendar and names (player-facing words).

**Risks**: phone cost of 6-10 people and the night lights (HB-10c measures); positions (hub, npcSpots, fixtures,
checks, the fall's landing) when the square or buildings move; the locked town zone (hand patches only until
HB-10f); one owner per file (`copperleaf.json` with the water track's patches).

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

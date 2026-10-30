# Assets track (AS) - every asset looks better, in seven lanes at once

Branch: track/assets

The owner asked (2026-10-29): "Make a plan to up the quality and style of all assets in the game. The artstyle of
everything can be upped. Look at the cowork session for inspiration. The 3d props should look a lot nicer but still
fit into the artstyle. The island should also feel a lot more natural, the same with routes. The vegetation should
have a lot of variety, no ugly blocky things. Make sure leaves come through. Replace the air station at the beginning
of the runs with a train station. Make sure the flying train car cutscene looks right. The windows are flickery and the
fire from the jet engines looks weird. Do research online. Make sure all of these things can run simultaneously."
Then: "you can automatically open the lanes when done".

AS-0 (this file, the shared scatter module, the flora contract) was written on `track/assets`, made from main 73b2f8b1
on 2026-10-29. The "cowork session" is the Godot port's coordinator session in `D:\Pocket BBB` (the port lives in
`D:\Pocket BBB\pocket-bb`); its README's "The HD-2D look", "Atmosphere" and "Tuning: subtle air, steady light, every
time of day" sections are the inspiration this track borrows from.

**Status:** AS-0 done (2026-10-29). Wave 1 (AS-1 to AS-7) runs at once, each on its own side branch
`claude/as-<n>-<words>` with a draft PR into `track/assets`. Then AS-8 brings it together and AS-9 is the owner's
phone play.

Before editing, every session checks the facts it relies on against `track/assets` and says in its HANDOFF entry what
differs: they come from read-only audits on 2026-10-29 (main 73b2f8b1). Line numbers drift; find lines by text.

## Contents
1. The owner's answers
2. What the code does today (audit)
3. The research, in short
4. The shared pieces (AS-0)
5. Sessions
6. Who owns which files
7. Ask me before
8. Not in this track
9. Risks
10. Pictures and numbers: how each lane checks itself
11. Sources

## 1. The owner's answers (Plan Mode, 2026-10-29)
Sessions act on these without asking again.
- **Leaves:** "the leaf art becomes better looking and less ugly and round". The crowns' art itself must improve, and
  nothing may read as a ball or a cut-out circle.
- **Trees and bushes: smooth painted blobs** (the Ghibli / Breath of the Wild way): crowns are low-poly lumps with a
  painted texture, not flat picture clumps facing the camera. With the answer above, never spheres: lobed, uneven,
  with a leafy edge.
- **Copperleaf: a full regenerate.** The island generator may move buildings, streets and the square, not only the
  land. (Rooms are inside buildings and don't change.)
- **The phone: a bit slower is fine.** The floor sessions keep to: Balanced on the phone loses at most about 15% of
  today's frame rate on the Graphics test's benchmark path (docs/TESTING.md); Beautiful has no floor.
- **The style** (the owner, after the plan): "The style should feel like professional high resolution painterly pixel
  art." Section 1.1 is the rule every lane paints to.
- **48 px/m** (asked after that answer): new and remade model, prop, vegetation, halt and train textures are painted
  at 48 pixels a metre (today 32, some props 34). The terrain tiles stay at 32 px/m: they are a fixed visual target
  (CLAUDE.md) and no lane repaints them. AS-4 makes the model shader and the prop builders take 48 px/m textures (UV
  scale per texture or atlas) in its first commits, so AS-2 and AS-3 can paint at 48 from the start.
- **Sessions run on their own** (the owner, "you can automatically open the lanes when done"): every wave-1 session
  plans and builds without waiting, stops only on an item in section 7, and lists its drafts (words, looks) in its
  HANDOFF entry for the owner to change afterwards.

### 1.1 The style rule: professional, high-resolution, painterly pixel art
Every texture, model colour and leaf picture in this track is judged against this. It is hand-painted light in crisp
pixels, the HD-2D way: the engine adds the moving light, the art carries the form and the material.
- **Crisp pixels at 48 px/m**, sampled nearest, never resampled or blurred when in focus. One pixel size per object:
  no mixed densities on one prop.
- **Painted, not generated:** shapes are drawn by light. Each surface has a lit plane, a mid tone, a shadow and a
  bounced light, laid as clusters of pixels (brush strokes: leaf masses, plank grain, stone faces), never noise, never
  stray single pixels, never flat fills. Ordered dithering only for soft gradients (sky, glow), sparingly.
- **Hue-shifted ramps:** every material has a ramp of 4-6 tones that shifts hue along its length, shadows cooler,
  lights warmer. Brightness-only ramps read as dull. Ramps are shared per material family, so a scene holds together.
- **Selective outlines:** dark lines only where a form must separate from what is behind it. A lit edge gets a
  coloured light line, not black. No outline round every shape.
- **Readable at phone size:** big shapes first, detail second. A prop reads from its silhouette and its two or three
  biggest light planes at the camera's usual 40 m; the detail rewards a closer look.
- **Organic forms:** no cube canopies, no perfect circles or spheres, no machine-straight rows in nature. Crowns are
  lobed, rocks faceted, coasts and paths wander.
- **Fits the world:** the retro-futuristic solarpunk palette of the Hollow Earth: warm sunlit greens and golds,
  verdigris copper, cream stone, clean solar glass.
- References for the feel (never to copy): Octopath Traveler II's maps, Eastward, Sea of Stars, and the Godot port's
  HD-2D look.

## 2. What the code does today (audit, 2026-10-29, main 73b2f8b1)

### 2.1 Props
- 250 JSON recipes in `game/art/scene/next/models/` (plus 23 in `scene/vox/`, 3 airship ones in `scene/models/`),
  written by `tools/build-props-batch*.py`, `build-vox-props.py`, `build-airship.py`, `build-station-trains.py` and the
  Studio. `game/data/scenery.json` has 499 props: 269 models, 24 `flat`, about 42 picture bodies (`vol`). No glTF at run
  time (the Studio's `logic/model-gltf.js` imports).
- Shapes (`prop-models.js` near `lowPolyFromRecipe`): box, cyl, sphere, cone, barrel, limb, dome, `raw` voxels, `img`
  picture layers; six recipes are prebuilt meshes (`kind:"mesh"`, base64 vertices: the train wrecks, the sky rail).
- Low segment counts by a perimeter rule: limbs 5-10 sides, round shapes 6-20 sides with 8 rings; leafy spheres get a
  hash "lump". Three-tone cel light (`uCel` .75) gives hard bands on round parts.
- One shared building sheet `scene/build/detail.png` of 24 cells at 32 px; UVs in metres (32 px/m), colour = vertex
  colour × cell. Props are drawn at 34 px/m (`ppu`) in places, not 32.
- `LOOK_GLSL` (`engine/webgl.js`): wear, moss, dirt as pixel-space noise. Model bumps off (`world.buildingBumps` 0).
- Pictures get automatic "pillow" normal maps (`webgl.js` worker) and `SURFACE_MATERIALS` (foliage: transl .7,
  wrap .45).
- Models are instanced per mesh (`engine/model-instances.js`); picture instancing (`quality.spriteInstances`) is off.

### 2.2 Vegetation
- Trees: modelled bark trunks, roots and branches (`limb`, 5-7 sides), the crown a painted picture
  (`scene/next/leaves/*.png`, 47) cut into circular clumps with a dark lower rim (`leafCut`), facing the camera
  (`propModelImageItems`), plus a darkened "crown core". Conifers: drawn tiers as bands on a mast. Bushes: pictures
  only (`bush_round.json`: a core and 3 clumps).
- Each clump is its own draw (plus shadow, reflection and crossing copies): trees are three quarters of a dressed
  island's draws, the grove by the Sun gap the bench's slowest place (docs/graphics-bench.md).
- Leaf light (`walk/walk-shaders.js` sprite shader): alpha cut at .5, pillow normals, wrap, a back-light term
  `uMat.z*(pow(dot(-v,sun),2)*.8+max(-nl,0)*.35)`, a self-shadow march. No translucency on 3D parts.
- 26 vegetation keys have no model (tree_fruit_b, tree_giant, tree_willow_lean, tree_mangrove, the ferns, the
  flowers...). The old "solid tree" path (`solid-props.js`, picture split into clumps within 20 m) still exists.
- Grass blades (`walk/grass-build.js`): 6 kinds, pixel-staircase quads, ground-coloured, trails and pushes; one wind
  field (`windBend`/`windGust`, `webgl.js`).
- Variety (`walk/prop-look.js`): trees ±14% size, 9° hue, no turn; bushes ±16% and 10°; rocks ±18% and 22°.

### 2.3 Copperleaf (the hub island)
- `game/data/maps/copperleaf.json`, 190 × 154 m, made by `logic/island-gen.js` v4 (seed `copperleaf-e9`) and the chain
  `tools/build-island.mjs` → `build-copperleaf.mjs` → `patch-copperleaf-water/square/terrain.mjs` →
  `patch-station.mjs` → `clear-windows.py --fix` (hub-track.md "The chain"); `islandGen.patched` lists hand patches.
- The coast is a radius per degree plus noise (cove, headlands, lobes); zones and kinds (beaches, a forest arc from
  120° spanning 200°, dunes, heath, cliffs) are `{a, span}` arcs round the middle, so they lie in rings and wedges.
- About 40% of the land sits at 1.0-1.5 m: the town, barn and pasture zones flatten to level 1.2 and buildings sit on
  levelled pads, turned in quarter turns facing out from a pivot. 29% of the land is dead flat.
- Cliffs: vertical walls between half-metre cells (`walk/ground-mesh.js` `buildGroundMeshSteps`); `stepEdgeShape`
  (`walk-view.js`) moves corners at most about 0.25 m.
- Dressing (`tools/island-dress.mjs`): jittered square grids with a keep chance; 309 props, only 109 trees.
- `tools/test/island-gen.test.mjs` requires the map to be the generator's exact output minus the patches.

### 2.4 Run places ("routes")
- Places on a grid of 64 m cells (`logic/run-map.js`), every side with an exit pinned to height 0
  (`logic/run-scenes.js`), heights from 26 m and 8 m noise at ±2.6 × hills (`logic/mapgen.js`).
- Roads: a cubic curve between 7 m straight run-ins. Fields: axis-aligned boxes on whole metres. Hedgerows: offset
  copies of the road. Forest masses lean to the north and south edges; inside, a jittered grid 5.2 m apart. Places
  without a layout get a tree belt along the rectangle. Shrubs, rocks, wild plants: uniform random.
- Countryside beyond the place (`seamless-world.js`): trees on a 2 m grid only 1.6-8 m out.
- 12 biomes in `biomes.json`; runs roll 5 (meadow 3, lake 2, thicket 2, ridge 1, autumn 1).
- `MAPGEN_VERSION` 27; every output change remakes the golden snapshots (`mapgen-golden`, `run-world-real`) and the
  rng hash (`rng.test.mjs`).

### 2.5 The landing's airship mast
- `RUN_BUILDINGS.landing = { mast: 1 }` (`logic/run-scenes.js`), placed by mapgen's
  `['mast', 'airship_station', 'fly', 'Airship station']` with a landing spot beside it ("no room for the airship's
  mast"). Catalogue `airship_station` (scenery.json, model `scene/models/airship_station.json`, act `fly`), the moored
  `airship` above it (`bob` .09).
- Tapping it: `walk-control.js` → `airship.js` `flyMenu` ("Airship mast", "The airship waits here for the end of the
  run. Flying home now gives the run up.", "Fly home"). `standByMast` puts you by the station prop or the mast.
- The prepared first run's crash is anchored to the mast: `logic/first-run.js` `firstRunMast`, `firstRun.json`
  (`train_wreck` 14 m west, 6.5 m south of it).
- Player words that say airship: mapgen's "Airship station", airship.js's lines, lore.json "Airship timetable",
  story.json "Face-down by the mast.", int_shop.json "every time an airship lands", run-rules-code.js "the airship's
  mast", VISION.md "the airship flies you from the hub". Skyline Station's own words are train words already.
- Copperleaf has both: the `airship_station` and moored `airship` (scenery only) and `train_station` ("Skyline
  Station", act `station`). Checks: `check-quick.py` `rl8_run_from_mast`, `airship_moored`.

### 2.6 The sky train's ride
- `game/js/train-ride.js` (glide, board, lift, turn, dash; home: open, out, turn, down, off), timed in
  `logic/train-path.js`; five trains from `tools/build-station-trains.py` (hover skids, rocket engines; the Wildwood
  Zephyr under a gasbag). `tools/look-train-ride.py` holds fixed moments (`trainRide.hold`).
- **Window flicker (confirmed by reading the code).** The glass shader (`prop-models.js` `GLASS_GLSL`) picks a lit
  window's colour with `fract(id*.618+uWinSeed)`; `uWinSeed` is hashed from `it.x`, `it.z`, the item's live world
  position, on every draw (`setItemSpin` block, and again in the batched path). Its lit bits come from
  `modelWindowLight` (`walk/lighting.js`) → `windowLit(world x, z)`, recomputed each frame. On a building those never
  change; on the moving train every centimetre re-rolls each window's colour (blue TV, warm lamp, kitchen) and on/off
  state, by day too (window light .15, about 18% lit), so the windows strobe. Not z-fighting: 24-bit depth, near 0.3,
  far 420, glass 2 cm proud. Minor: the sun glint `pow(...,80.)` flashes on turning flat glass.
- **Jet fire.** Each rocket's plume is one 64×20 picture (`flame()`), hard alpha, a fixed pattern, no animation, no
  additive blend, shown as two upright cards 2 cm apart along the train: slivers from the chase shot behind, pointing
  backward even in the straight-up lift; "pictures don't tip" (`walk/prop-look.js`, `logic/prop-turn.js` `decalPlace`
  has no tilt), so in the climbing beats the flames, headlamp and name boards slide off the nozzles; the glow is
  multiplied by `lampLit`, about 0 by day (cardboard flames) and switched by a position hash at dusk.

### 2.7 Light and air
- The air track is done (haze follows the sky, a fog density grid, the lit march, depth-aware edges). The Godot port
  found these flicker causes in the maths it ported from the web; none has been checked on the web yet: the sun's
  shadow reach following the camera's distance (rescaling the splits, so shadow edges swim), the 8th light switching
  off when a 9th comes nearer, lamp-glass flicker driving the lamps' thrown light, mist offsets changing per frame,
  the sun creeping and re-laying the shadow grid. Its look notes: haze capped so far trees keep their shape, a gentler
  blur in front, cool sky fill in shade and a warmer sun, shade keeping about 14% of the light.

## 3. The research, in short (sources in section 11)
- **Painted foliage:** a crown as a cloud of noise-displaced lobes; normals projected from an inner "bubble" (or the
  crown's centre) so the crown shades as one soft volume and the cards and lobes don't band (Airborn's trees,
  Breath of the Wild foliage notes); a cheap back-light term so leaves glow with the sun behind them (Overgrowth:
  nearness to the sun's image, angle to the sun, per-part translucency); AO baked into vertex colours; a random value
  per lobe for colour; a short alpha-cut leaf fringe on the silhouette so edges read as leaves, not circles.
- **Natural land:** domain warping bends ridges and coasts off the grid; a low-frequency high-power noise for the big
  shape, higher-frequency noise for the coast's detail (two passes); a radial falloff into the sea; zones from height,
  moisture and slope, not angles.
- **Scatter:** Poisson-disc sampling (no two closer than a spacing, no empty gaps), variable radius for density,
  seed-spread clumps (dense round a parent, falling off), layers (canopy, understory, shrubs, ground cover) each with
  its spacing and slope limits.
- **Jet exhaust:** a cone (or crossed quads) along the nozzle, scrolling noise through a colour ramp, additive blend,
  fading along its length, shock diamonds scaled by throttle; here stepped and pixel-quantised (the VFX track's
  rule: stepped and dithered, never blurred).
- **Depth:** WebGL2 reversed-Z needs `EXT_clip_control` (not everywhere); not needed, the flicker is the hash.
- **HD-2D:** dynamic light on pixel art, depth of field and tilt-shift; Octopath II raised map resolution for a more
  organic look.
- **Painterly pixel art:** hue-shifted ramps (shadows cooler, lights warmer; brightness-only ramps look dull), the
  outline used as the darkest shade, generated ramps as a starting point only.

## 4. The shared pieces (AS-0, done)
Both terrain lanes and the vegetation lane meet here, so no lane waits on another.
- **`game/js/logic/scatter.js`** (tests: `tools/test/scatter.test.mjs`, `scatter-real.test.mjs`). Pure, seeded
  (`rngFrom`), usable from tools and the game:
  - `scatterPoisson({x0,z0,w,h, r | radiusAt+rMin+rMax, keep, avoid, max, seed, salt})`: Poisson-disc points.
  - `scatterClusters({..., apart, spread, size, gap, parentKeep, thin})`: seed-spread clumps.
  - `scatterLayers({..., layers:[{name, kinds, r|clumps, clear, keep}]})`: layers in order, each clear of the
    earlier ones' footprints, kinds by weight.
  - `scatterFlora(biome, {x0,z0,w,h, seed, salt, keep, avoid, density(layer,x,z), only})`: a biome's `flora`.
  - `scatterPick(list, u)`.
- **The flora contract: `flora` in each biome of `game/data/biomes.json`** (schema `biomes.schema.json`, type
  `BiomeFloraLayer` in `game-data.d.ts`, checked by `dataBiomes`). An ordered list of layers:
  `{layer, from, clear?, r?: [dense, sparse] | clumps?: {apart, spread, size: [lo, hi], gap}}`. `from` names one of the
  biome's own lists (`trees`, `shrubs`, `plants`, `rocks`, `waterPlants`, `canopy`, `tall`): **the species stay in
  those lists**, so the vegetation lane (AS-3) adds kinds there and the terrain lanes (AS-5, AS-6) read the layers.
  All 12 biomes have flora (2026-10-29: first values by the biome's character; the terrain lanes tune them).
- **Baselines:** `validation/assets-baseline/routes/` (not in git) on the owner's PC: 30 route pictures, six each of
  the layouts none, farmland, forest, lakeside and ledges (`check-perf.py --routes --shots`; the lanes plan timed out
  with four browsers drawing at once). Every lane makes its own "before" set from `track/assets` at its start (section
  10), one browser tool at a time: several software-drawn pages at once time out ("the walk view never got ready").
  What the route pictures show already: flat painted clumps for crowns, and a milky haze that hides everything past
  about 15 m (the Godot port's "fog too much" note; AS-7).

## 5. Sessions

### Wave 1 (parallel, all at once)
Each lane is its own session in its own worktree, cut from `track/assets`, on a branch `claude/as-<n>-<words>`,
ending in a draft PR into `track/assets` (not main). Its brief is one line: "You are lane AS-<n> of
docs/phases/assets-track.md: read CLAUDE.md, VISION, ART 'The style', this file's sections 1, 1.1, 2, 5 AS-<n>, 6, 7,
9, 10 and the newest HANDOFF entry, then plan and build on your own". Before any edit it checks its branch, makes its
"before" pictures (section 10), and never edits another lane's files (section 6).


#### AS-1 The sky train's ride looks right
- **Windows:** a moving prop's windows are seeded by its own key (the placement id) and the windows' model-space
  positions, never by world x/z; lit state and colour are worked out once per ride. The sun glint on a turning model
  is capped so it doesn't strobe. Buildings look exactly as before (look-windows.py before/after).
- **Jet fire:** each nozzle's two cards become a plume drawn in its own additive pass (new `walk/plume.js`): crossed
  quads plus a cone along the nozzle, oriented by the train's full pose (pitch included); scrolling noise through a
  stepped ramp (white-blue core, orange, clear), quantised to 48 px/m; length and flicker by beat (long and down in the
  lift, short in the glide, a puff at "board"); lit by day and night alike (no `lampLit`); heat shimmer on Beautiful
  only. Smoke and sparks at lift-off from `walk/effects.js` (`plume`, `smoke`).
- **Pictures tip with their model**, so the headlamp and name boards stay on the train (`decalPlace` takes the
  model's tilt).
- **The check:** every beat both ways (`look-train-ride.py`) at day, dusk and night, and a frame-by-frame window test:
  hold each beat for several frames and compare the windows' colours (none may change). Screenshots in HANDOFF.

#### AS-2 A train halt at every run's start
- **The halt:** a low-poly country halt painted at 48 px/m in the props' style (AS-4's rules, section 5 AS-4): platform,
  canopy, kiosk, lamp, sign, bench, buffer stop, and a short curve of rail off the place's edge, a parked sky train at
  the platform. A new `tools/build-halt.py` writes it (the station trains' builder style).
- **In the game:** `RUN_BUILDINGS.landing` gets `halt` instead of `mast`; mapgen's landing block places it with its
  spot; `standByMast` and the landing's act find it; `firstRunMast` and the crash offsets anchor to the halt and IN-5's
  crash cameras are checked again (intro-track.md); the run's first arrival plays the ride's "down" and "off" frames
  into the halt.
- **Words (drafts, the owner may change them):** "Airship station" / "Airship mast" → "Sky train halt"; "The airship
  waits here for the end of the run. Flying home now gives the run up." → "The sky train waits here for the end of the
  run. Riding home now gives the run up."; "Fly home" → "Ride home"; "Airship timetable" → "Sky train timetable"; the
  lines in story.json, int_shop.json and run-rules-code.js to match; VISION.md's "the airship flies you" line.
- **Checks:** `rl8_run_from_mast` and `airship_moored` follow the halt.
- **Internal names stay** (`airship.js`, `flyMenu`, act `fly`, `firstRunMast`): AS-8 renames them, one per commit.

#### AS-3 Vegetation: painted blob crowns, many species
- **The builder:** a new `tools/build-flora.mjs` writes deterministic mesh recipes (`kind:"mesh"`) per species and
  variant: crowns of 3-9 uneven lobes (flattened, offset, noise-displaced; never a sphere), a short alpha-cut leaf
  fringe along the silhouette; a painted 48 px/m texture per species family (section 1.1: leaf-mass clusters, a lit
  warm top, a cool dark underside, hue-shifted ramps, no pixel noise); normals spherical from the crown's centre, AO baked into vertex colours, a colour shift
  per lobe; trunks 8-12 sides with branches showing in the gaps.
- **The light:** a foliage shader chunk: the back-light (the sun through the leaves, brighter at the rim), soft wrap
  (no hard cel band across a crown), wind sway weighted by height and distance from the trunk (the one wind field),
  alpha-tested shadows.
- **Species, 3-4 variants each:** oak, birch, maple, willow, pine/fir, palm, fruit, giant, mangrove, snag; bushes
  (lumpy, flowering, berry, hedge); ferns, reeds, grass clumps. Flat flowers stay flat (the owner's list) with new art.
  The 26 keys without a model get one.
- **In place:** upgraded under the existing scenery ids, so maps keep working; new ids go into the biomes' lists
  (section 4). Far trees: a lighter mesh or a baked picture from the new mesh.
- **A sample board first:** a test scene with three crown looks side by side, pictures in the session's first HANDOFF
  note, so the owner can redirect early; the lane carries on with its recommendation meanwhile.
- **Clean-up:** the "solid tree" path is retired in its own commit once no tree uses it.
- **Budget:** a tree becomes one instanced mesh instead of a draw per clump; measure the grove and the bench.

#### AS-4 Props that look made, not boxed
- **The builder:** a minimum side count by size; a 1-2 texel bevel on box edges so edges catch the light; smooth
  normals on round parts with softer cel bands; every prop at 48 px/m (first: the model
  shader and the builders take 48 px/m textures, pushed early, since AS-2 and AS-3 paint at 48 too).
- **Textures:** a bigger 48 px/m atlas painted to section 1.1, with matching normal maps (planks, painted wood, stone block, brick, metal
  plate, rust, thatch, roof tile, glass, cloth, solar panel, verdigris copper for the solarpunk look); moss and wear
  as painted masks in texel space, not noise; bumps on at Balanced.
- **Remodels, the most seen first:** lamps, fences, benches, crates, barrels, signs, wells, carts, rocks (faceted,
  layered), bridges, solar panels, wind turbines, planters.
- **Writes the style rules** into docs/ART.md ("Props and models"), which AS-2's halt and AS-3's trunks follow.

#### AS-5 Copperleaf regenerated (island generator v5)
- **The coast:** domain-warped, from a two-scale noise shape: bays, spits, offshore rocks; beaches that slope.
- **The land:** zones from height, moisture and slope, not angle arcs; hills and a stream valley; nothing flattened
  wholesale.
- **The town:** a gently sloping site with terraces, retaining walls and steps where needed; streets along the
  contours; buildings facing their street.
- **Cliffs:** natural faces with shoulders, scree and lean (finishing `stepEdgeShape` and the cliff lean the Godot
  port's README lists as not done).
- **Dressing:** `island-dress.mjs` on `scatterFlora`: forest edges, glades, lone meadow trees, two to three times
  today's trees.
- **The rebuild:** the chain run again; the old hand patches become generator features; every door, villager and
  resident route, wild grass spot, animal area and story spot checked; the exactness test follows.
- **Ask first:** 2-3 seeds as pictures for the owner's pick (section 7). The lane builds everything else meanwhile.

#### AS-6 Routes that feel like countryside
- **The land:** the walkable edge inside the 64 m cells shaped by noise; exits pinned only near the exit, so the
  middle has real hills and valleys; the countryside 8 m → about 30 m deep, with layered hills beyond.
- **Roads:** wander along cheap slopes, varied width, worn edges and verges.
- **Fields and forests:** fields turned with the road and the contours, hedges with gaps; the rectangle tree belt
  deleted; forest masses from noise, not the north and south edges.
- **Scatter:** `scatterFlora` with a density from the layout (forest core, edge, clearing), rock outcrops, flower
  drifts.
- **Biomes:** every fitting biome of the 12 rolls (rules.json), each with its flora.
- **Version:** `MAPGEN_VERSION` up, golden snapshots and the rng hash remade.

#### AS-7 Steady light and subtle air
- **Flicker:** test each cause in section 2.7 on the web build (frame-to-frame picture differences while walking and
  standing) and fix the real ones: the shadow reach set per camera in steps; lamps past the limit fading out over
  2.5 m; only fires flicker; mist offsets fixed per pixel (interleaved gradient noise or the blue-noise tile); the sun's
  direction in small steps.
- **The look:** haze capped so far trees keep their shape; a gentler blur in front; cool sky fill in shade, a warmer
  sun, shade keeping about 14% of the light.
- **Every time of day and weather** tuned against picture sets (dawn, noon, golden hour, dusk, night, rain, fog).

### Wave 2 (after wave 1 is merged into `track/assets`)

#### AS-8 Together
Merge the lanes; dress the hub and the routes with every new species; settle the mapgen snapshots; the internal
renames from AS-2, one per commit (`tools/rename.mjs`); the full quick check; the perf baseline remade on purpose
(section 10); the baselines remade with the owner's OK; the docs (VISION, ART, ROADMAP, BRANCHES); one draft PR into
main.

#### AS-9 The owner's phone play
The in-game full test and the debug log (the debug-log skill); fixes; the owner merges.

## 6. Who owns which files
Each lane edits only its own files; a lane that needs a change in another's sends it to that lane's session (or
leaves a note in its HANDOFF entry). Line numbers drift: find by name.

| Lane | Owns | Touches only these parts of shared files |
|---|---|---|
| AS-1 | `train-ride.js`, `logic/train-path.js`, `tools/build-station-trains.py` and the train models, new `walk/plume.js` | `prop-models.js`: the window-seed lines (`uWinSeed`) only; `walk/lighting.js`: `modelWindowLight` only; `logic/prop-turn.js` `decalPlace`; `walk/prop-look.js` the "pictures don't tip" block |
| AS-2 | new `tools/build-halt.py` and its models, `airship.js`, `logic/first-run.js`, `firstRun.json`, lore.json, story.json, int_shop.json, `run-rules-code.js` lines named in 2.5 | `run-scenes.js` `RUN_BUILDINGS`; `mapgen.js` the landing block (`airship_station` placement and its spot); `scenery.json` new halt entries; `check-quick.py` the two landing checks |
| AS-3 | new `tools/build-flora.mjs`, the foliage shader chunk (a new file), tree/bush/fern/reed models and leaf art, `solid-props.js` | `prop-models.js`: the `kind:"mesh"` loader and the foliage hook; `walk/prop-look.js` tree and bush rules; `biomes.json` species lists (trees, shrubs, plants); `scenery.json` vegetation entries; `studio/js/model-editor.js` |
| AS-4 | `tools/build-props-batch*.py` and the other prop builders, non-flora models, `scene/build/detail.png` and its normal map, docs/ART.md "Props and models" | `prop-models.js`: `lowPolyFromRecipe` and `LOW_POLY_TEXTURE_CELLS`; `engine/webgl.js` `LOOK_GLSL`; `engine/settings.js` model defaults; `scenery.json` non-flora entries |
| AS-5 | `logic/island-gen.js`, `tools/island-dress.mjs`, the build chain (`build-island`, `build-copperleaf`, `patch-*.mjs`), `game/data/maps/copperleaf.json`, `logic/hub-island.js`, `studio/js/hub-island.js` | `walk-view.js` `stepEdgeShape`; `walk/ground-mesh.js` cliff faces (shared with AS-6: AS-5 owns them, AS-6 asks) |
| AS-6 | `logic/mapgen.js` (all but the landing block), `seamless-world.js` countryside, `logic/water-gen.js` | `run-scenes.js` all but `RUN_BUILDINGS`; `rules.json` `run.scene` and `run.map.biomes`; `biomes.json` flora layers and fields other than species lists |
| AS-7 | `walk/shadows.js`, `engine/post-effects.js`, `game/data/engine.json` | `walk/lighting.js` all but `modelWindowLight`; `engine/webgl.js` `shade()` and `fogit` (not `LOOK_GLSL`) |

Everyone: `game/js/hooks.js` is only regenerated (`npm run modules`); `game-data.d.ts`, `data-checks.js`, the
`check-*.py` files, `studio/art-code-refs.json` (regenerated) and docs/HANDOFF.md are shared: add your own entries,
change nobody else's. Whoever merges into `track/assets` after another lane that changed mapgen output remakes the
golden snapshots and the rng hash.

## 7. Ask me before
- **The regenerated Copperleaf** (AS-5): 2-3 seeds as pictures from the same spots; the owner picks one before it is
  locked in. The lane builds the generator meanwhile.
- **The hub's moored airship** stays as scenery (hub-track.md) unless the owner says otherwise.
- **The halt's final words and look** (AS-2) and **the tree look** if the sample board misses (AS-3): the work goes
  on with the drafts meanwhile.
- **Baselines:** remaking `validation/quick-baseline/` and `validation/perf-baseline.json` for the release (AS-8).

## 8. Not in this track
- People, portraits and Billies' art (the characters track and phase 07).
- Battle effects (the VFX track) and the battle stages' backdrops, except the flora they pick up from biomes.
- The world map's floating island (`logic/float-island.js`): it follows the regenerated map on its own; a look pass
  there is a later item.
- Rooms' interiors.

## 9. Risks
- **The full regenerate** is the biggest lane: residents' routes, story spots, wild grass, animal areas, the station,
  rooms' doors and many checks hang on Copperleaf's layout. AS-5 lists every check it moved.
- **`mapgen.js`** is shared by AS-2 (the landing block) and AS-6: the snapshot remake happens at merge.
- **`prop-models.js`** is shared by AS-1, AS-3 and AS-4, each in separate functions: small hunks, careful merges.
- **The phone's budget:** alpha-tested leaves in the shadow pass and more trees cost GPU time; the floor is section 1.
  The owner's last phone log already showed the run's walk at 23-31 fps with quality stepped down and 307-322 MB
  against the 300 MB budget (HANDOFF, Kappi's stall clock): AS-3 and AS-6 measure memory as well as draws.
- **The perf gate** (`tools/check-perf.py`, +10% draws or memory against `validation/perf-baseline.json`) will go red
  when the vegetation and routes change on purpose: rewrite it with `--baseline` in the lane that changes it and say
  why in HANDOFF.
- **Windows PCs:** `python3` is the Store stub on the owner's PC; use `python`. If `git push` hangs (the Windows credential
  manager's prompt), push with `git -c credential.helper= -c "credential.helper=!gh auth git-credential" push`. Two unit tests (check-data-snapshot's
  symlinks, data-rigs' and faces' paths) fail on Windows on main too; CI runs them.

## 10. Pictures and numbers: how each lane checks itself
- After each change: `npm run lint`, `npm run typecheck`, `npm test` (the after-edit hook runs the relevant ones),
  then `npm run check:smoke`.
- At the lane's start, a "before" set from `track/assets` into `validation/<lane>-before/` with the tools below, and the
  same "after" at its end; pictures in the HANDOFF entry.
  - The hub: `python tools/island-shots.py DIR` (`--hour=21` for night).
  - The ride: `python tools/look-train-ride.py --out=DIR`; windows: `python tools/look-windows.py --out=DIR`.
  - Skyline Station and the halt: `python tools/look-station.py --hub --out=DIR`.
  - Routes: `python tools/check-perf.py --routes --shots=DIR --out=FILE`; places: `tools/look-places.py`.
  - Cliffs: `python tools/look-terrain.py`; light: `tools/look-air.py`, `tools/look-blur.py`.
  - Numbers: `python tools/check-perf.py` (the bench path's draws, instances, memory).
- Software drawing can't judge frame rates or `mediump`: the owner's phone does (AS-9).
- At the end of a lane: the full `tools/check-quick.py`; Start-Game, phone mode, the Studio, the in-game full test and
  the exported debug log still work.

## 11. Sources
- Airborn trees, normals from a bubble mesh: https://simonschreibt.de/gat/airborn-trees
- Foliage normals by bounding centre (SideFX forum): https://www.sidefx.com/forum/topic/54917
- Breath of the Wild-style foliage and edited normals (Polycount): https://polycount.com/discussion/comment/2677432
- Leaf translucency (Overgrowth, Game Developer): https://www.gamedeveloper.com/art/leaf-translucency
- Real-time translucent leaves, Habel et al. 2007: https://cg.tuwien.ac.at/research/publications/2007/Habel_2007_RTT
- Island and terrain with domain warping (2026): https://app.cinevva.com/blog/2026-05-13-open-world-browser-part-27-island-and-terrain
- Islands from perturbed circles and two noise passes (GameDev.net): https://www.gamedev.net/blog/33/entry-1765059-more-islands/
- Poisson-disc vegetation, clusters, layers: https://www.strayspark.studio/blog/building-believable-biomes-procedural-scatter ;
  https://arxiv.org/pdf/2008.05567 ; https://github.com/GrandPiaf/Biome-and-Vegetation-PCG
- Engine exhaust effects: https://forum.kerbalspaceprogram.com/topic/204884-developer-insights-11-%E2%80%93-engine-exhaust-visual-effects ;
  https://godotshaders.com/shader/engine-flame/ ; https://litedictteam.itch.io/ignition/devlog/337852/jet-engine-exhaust-visual-effects
- EXT_clip_control for WebGL: https://registry.khronos.org/webgl/extensions/EXT_clip_control/
- Colour ramps and hue shifting: https://www.slynyrd.com/blog/2018/1/10/pixelblog-1-color-palettes ;
  https://feuniverse.us/t/gba-custom-portrait-tutorial-wip/10927/ ; https://github.com/Exerionius/ColorRampGenerator
- HD-2D: https://en.wikipedia.org/wiki/HD-2D ;
  https://www.unrealengine.com/en-US/developer-interviews/octopath-traveler-ii-builds-a-bigger-bolder-world-in-its-stunning-hd-2d-style
- The Godot port's tuning notes: `D:\Pocket BBB\pocket-bb\README.md` ("The HD-2D look", "Atmosphere", "Tuning: subtle
  air, steady light, every time of day").

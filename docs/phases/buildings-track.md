# Buildings track (BD) - Copperleaf's buildings redone: storybook shapes, new surfaces, a modular house kit

Branch: track/buildings

The owner's brief (2026-10-29): "Redo the 3D buildings of the main hub island. They should have more dynamic shapes and
playful stylized details. Add more building textures and normal maps if that helps. Go for cozy whimsical retro
futuristic. Do online research. Make suggestions. Ask questions for clarification." Then, in the same talk: "All
houses look way too similar now, add a lot of modular variety." BD-0 (this file and a suggestion page, docs only) was
written on `ccr-d224d90d-qlnty6`; `track/buildings` was made from it by BD-0's session at the owner's word
(2026-10-29), and every later session works there or on a side branch of it (section 6, "How the sessions run").

**Status:** BD-0 done (2026-10-29). Wave 1 started 2026-10-29: BD-1, BD-2a and BD-F at once. BD-1 done 2026-10-30.

The suggestion page (sketches of every building, a house roller, the new surfaces; private to the owner):
https://claude.ai/artifact/3NF2Qp28uncV7fiCH5yP5b . Its sketches are 2D drawings of shapes and details, not the
models' final colours or proportions.

Before editing, every session checks the facts it relies on against main and says in its HANDOFF entry what differs:
they come from read-only audits on 2026-10-29 (main at 73b2f8b1). Line numbers drift; find lines by their text.

## Contents
1. The owner's answers
2. What the buildings are made of today (audit)
3. What depends on a footprint and a door (audit)
4. The research, in short
5. The look: a vocabulary
6. Sessions
7. Ask me before
8. Not in this track
9. Risks
10. Done when
11. Sources

## 1. The owner's answers (2026-10-29, in Plan Mode)
Sessions act on these without asking again.
- **Scope: all 15 building kinds** on the hub: lab, Granny Juniper's cottage, the cottages (6 `cottage_moss`, 4
  `cottage_solar`), shop, inn, library, Workshop, Gene Bank, lighthouse, windmill, barn, Skyline Station
  (`train_station`). The airship and its mast stay as they are (scenery).
- **Flavour: the cozy mix.** Storybook homes in the Ghibli spirit (crooked chimneys, stacked rooms, round doors)
  dressed with copper, portholes and glowing tubes; Googie upswept roofs and starbursts on the civic buildings (shop,
  station, inn).
- **Wonk: storybook.** Clear leans (3-6 degrees), tapered walls, bulging roofs, jettied upper floors, oversized
  chimneys and doors. Still walkable; doors line up with the rooms.
- **Footprints may change** (size and shape). BD-7 carries the town's knock-on work in one place.
- **Houses: a lot of modular variety** (they all look alike now).
- **Hub first.** The new house kit goes under new keys; run towns (biomes.json `town.houses`) keep today's houses
  until a later step outside this track.
- **Palette: copper, cream, verdigris teal, terracotta**, with brass and warm wood; neon accents only at night.
- **More Pokémon generation 5** (Black and White) in the style (the owner, after the first sketches, 2026-10-29: "The
  sketches look great. Put a little more Pokemon generation 5 in the style"). Section 5 says what that means here;
  the sketch page shows it. Original designs only: no copied buildings, logos or names.
- **A little more nature, a bit more retro-futurism** (the owner, 2026-10-29, after the second sketches). Section 5.
- **More windmill variety and variants, more retro-futurism** (the owner, 2026-10-29, after the fourth sketches):
  windmills become a kit of their own (BD-6, "The windmill kit"); the house kit gains a saucer pod body, a butterfly
  roof and starburst wall lamps.
- **Ask me before, answered** (2026-10-29): the normal sheet **on above Low** graphics; signs keep the **pixel-font
  decals**; **6,000 triangles** per kit house.
- **Sessions run on their own** (the owner, 2026-10-29: "Continue with the next steps when done. All plans approved.
  Automatically start next steps in new session. Plans auto approved. Run simultaneously when you can."): each
  session writes its plan in Plan Mode's shape in its first reply, then builds without waiting for approval (this
  answer is the approval), and at its end starts the next session(s) by section 6's rules. Sessions in one wave run
  at the same time. BD-3's look pick is the owner's: the chain pauses there until they answer. A new "Ask me before"
  a session meets is still asked: it ends its turn with the question and options, and the chain waits.

## 2. What the buildings are made of today (audit, 2026-10-29)
- **Recipes.** Each building is a JSON recipe in game/art/scene/next/models/<key>.json (`{ppm: 32, cel, layers}`),
  written by Python tools: cottage_juniper by build-props-batch1.py `cottage_recipe`; cottage_moss, cottage_solar and
  lab by build-props-batch3.py; shop, inn, library by build-props-batch7.py (the `House` class kit); workshop,
  gene_bank, lighthouse, windmill by build-props-hub.py; barn by build-props-island.py `make_barn`; train_station by
  build-station-trains.py. Post-passes: add-building-variants.py (colour swaps by hex), mark-cottage-roofs.py (`roof`
  1/2 by layer name), mark-window-glass.py (`glass` by layer name).
- **Seven solid shapes** (prop-models.js `PROP_MODEL_SHAPES`): box, cyl, cone, dome, sphere, barrel, limb; plus `img`
  (decals, sprites) and `raw` (.vox). **A box has no rotation at all**; round shapes turn about the vertical only
  (`rot`); only `limb` points any way. No wedge, prism, arch, lathe or extrusion. Every hip or gable roof is a 4-sided
  cone with `rot: pi/4` and `ry1` for the ridge (`House.roof_parts`, build-props-batch7.py).
- **Two meshes for ten houses.** The 6 moss and 4 solar cottages are two recipes with catalogue colour `variants`; a
  placement's `roof` (moss, solar, chrome) swaps the roof's colour and texture (walk-view.js `ROOF_MODEL`).
- **Textures.** One tone sheet, game/art/scene/build/detail-a04b.png, 512x192 = 8x3 cells of 64 px (2 m a cell, 32
  px/m). The red channel is a shade level 0-4; all colour comes from a layer's `col` through `rampC` (buildings.js),
  a 5-tone ramp with purple shadows and cream lights. Cells by name: prop-models.js `LOW_POLY_TEXTURE_CELLS` (plaster,
  siding, brick, stone, battens, panels, corrugated, tilewall, rooftiles, shingles, slate, hay, metal, wood, plain,
  leaves, solar, cloth, rust, stripes, rings, bark, rock). Painted by Python (build-props-batch1.py `paint_textures`,
  build-airship.py, build-props-a04.py). UVs are world-metre planar per face, no per-layer offset, scale or turn.
- **Shading.** `lowPolyFragmentShader` (prop-models.js) patches the buildings' shader: sky ambient, wrapped Lambert,
  `cel` banding to three tones, a weak Blinn-Phong, 16 point lights, stepped pixel shadows, contact AO, the post ink
  outline, height haze. Flat normals on boxes and `facet` layers, smooth on round shapes.
- **No normal maps on models.** A bump derived from the sheet's shade level by screen derivatives (`bldBump`,
  buildings.js) exists but is off by default (`world.buildingBumps` 0, engine/settings.js). Normal maps exist
  elsewhere, all computed, none authored: sprites (webgl.js "pillow + detail"), the ground (`groundPixelNormal`),
  water.
- **Glow.** Only `glass` windows (lit at night per window by walk/lighting.js `modelWindowLight`) and img `glow`.
  No emissive solid layer.
- **Drawing.** Instanced (`drawPropModels`, engine/model-instances.js): one draw per mesh part for every placement of
  that mesh. The world map reruns `lowPolyFromRecipe` on a simplified recipe (`worldBowlModelShape`, world-bowl.js:
  no img or limbs, parts under 0.35 m dropped, at most 8 sides).
- **Size** (estimated from the recipes, not measured): lighthouse ~1.2k triangles, workshop 1.6k, shop 1.7k, station
  1.7k, windmill 2.1k, library 2.3k, lab 2.7k, cottage_solar 2.9k, barn 3.1k, cottage_moss 4.1k, inn 4.4k, gene_bank
  4.8k, cottage_juniper 7.5k. lowpoly-props.test.mjs allows 10k for a building (`build` or `door`), 4k for a prop.
  Phones: at most 400 draws a frame (docs/phases/20-renderer-batching.md).

## 3. What depends on a footprint and a door (audit, 2026-10-29)
- **Catalogue** (game/data/scenery.json, `ppu` 34): `box: [w, d]` (metres), `door: {x}` (picture pixels; `y` is
  never read), `room`, `act`, `fx` (window, glow, smoke in picture pixels), `variants`. The base point is the middle
  of the front; the footprint runs x +-w/2, z -0.1..d; recipe y=0 is the front (prop-turn.js).
- **`box` feeds**: the walking grid (walk-view.js `navGridSteps`), ground pads (walk/heights.js `buildingPads`), the
  minimap, AO, shadow depth, tap width, Billie avoidance, battle arenas, the props hidden while you are in a room
  (seamless-world.js), rooms' window copies (`seamlessBuildingWindows`), run towns (mapgen.js), the dressing
  (island-dress.mjs).
- **`door` feeds** `doorOf`, `actionSpot` (0.55 m out), residents, rooms (`roomLayIn`, `seamlessRoomPlacement`). Rooms
  are 12x10 whatever the footprint (bigger inside), laid on quarter turns (`roomTurnOf`).
- **Plots are hard-coded**, not from `box`: logic/island-gen.js (`STATION_PLOT` [14, 8], `ISLAND_TOWN_EXTRA`, the
  `plotsAlong`/`plotRing` sizes, house plots never under 3.8x2.8). `build-copperleaf.mjs place()` throws when a box
  outgrows its plot. The town, barn and pasture zones are `lock: true`: a rebuild keeps their plots, so plots change
  by editing `plots` in copperleaf.json. House plots today: 3.8-4.6 x 2.8-3.44 m.
- **The chain** after a box or door change (hub-track.md, "The hub island polish"): build-copperleaf, patch-station,
  `clear-windows.py --fix` (and the square and terrain steps the starting map needs; the terrain patch refuses a map
  that already has the pond's fall).
- **Tests and checks that pin them**: hub-doors (doors to the camera, buildings near their plots, the station's
  rail), island-dress, hub-data (the opening's stage from the lab's door), hub-residents, hub-square, check-quick's
  rooms and room windows, the full test's walk to every door (self-test.js).
- **Found, to fix in BD-7:**
  - Doors are written at 32 px/m (`round(m * 32)`) but read at ppu 34: about 6% short (the lab's door 1.94 m in the
    model, 1.82 m in the game; the shop 0.94 -> 0.88).
  - tools/clear-windows.py ignores `rot`: most hub buildings are at rot 90, so it measures the wrong faces. Fixed by
    BD-F (2026-10-29): windows, the cover test and the footprint test turn with the building; Copperleaf still clear.
  - The lighthouse and the station have no `door`: hub-doors skips them and the triangle test gives them 4k.
  - cottage_juniper has no `vary.size` and "cottage" is not in prop-look.js's building pattern: it gets a random
    +-6% size while its footprint stays fixed.
  - Only workshop, gene_bank and train_station have pictures baked from their models; the rest keep old pictures,
    which `clear-windows` and the room check read.

## 4. The research, in short
- **Read as icons.** Buildings seen from a distance read by silhouette; exaggerated proportions and one bold shape per
  building beat realism (Creative Bloq on low-poly buildings; stylized pack notes on "strong silhouettes from any
  angle").
- **Round is friendly.** Shape language: circles and soft curves read approachable, squares stable, sharp triangles
  hostile. Cozy towns lean round, with a few sharp accents.
- **Wonky by rule.** Townscaper and Tiny Glade look hand-made because small rules add details where pieces meet
  (arches where a path meets a wall, shutters when windows sit together, towers merging) and nothing is perfectly
  regular. Our kit does the same with seeded picks and placement rules.
- **Ghibli's homes** mix styles in one building (cottage, industrial, chimneys, pipes, add-ons stacked over time):
  a building that tells you it grew.
- **Retro-futurism has a ready vocabulary.** Googie (1940s-60s roadside California): upswept and boomerang roofs,
  cantilevered eaves, starbursts, big glass, neon. Streamline Moderne (1930s): rounded corners, porthole windows,
  horizontal speed lines, ship details. Raygun Gothic blends both with Art Deco.
- **Trim sheets.** One texture of reusable strips (trims, panels, edges) serves many buildings; keep its contrast low so
  repetition doesn't show; swapping a sheet with the same layout restyles everything. Our tone sheet already works
  this way (colour from `col`), so new cells extend it.
- **Normal maps** add per-pixel detail to low-poly shapes (a TBN per face), but a default Blinn-Phong hides painted
  detail: the look comes from the shader, and painted height should vary per element (a brick, a shingle) rather
  than lie flat. Our pixel look wants stepped (quantised) light from them.

## 5. The look: a vocabulary
Each building gets **one signature silhouette** that reads from the orbit camera, then details at walking distance.
- **Shapes**: leaning walls, tapers, bulges and sagging ridges; jettied upper floors; extruded roof profiles (gambrel,
  saltbox, upswept, swoop, arch); bulb and onion domes, flared chimneys, finned towers from turned profiles; bevelled
  chunky edges.
- **Retro-futurist details**: copper standing-seam roofs gone verdigris, brass portholes, rounded corners with speed
  lines on civic fronts, starburst signs, antennas, weathervanes and wind spinners, bubble greenhouses, solar sails,
  glowing tubes along eaves at night.
- **Cozy details**: round and Dutch doors, flower boxes, crooked chimneys with smoke, lean-tos, outside stairs, lamps
  by doors, laundry, rain barrels (many exist as props already).
- **Palette**: walls cream, butter and terracotta plaster, warm wood; roofs copper, verdigris teal, terracotta and
  moss; trims brass and cream; night neon in teal, pink and amber.
- **A little more Black and White** (the owner, 2026-10-29). The builders already aim at "Unova-style town crossed
  with retro-futuristic solarpunk" (tools/build-props-batch7.py:3); the redo leans into it:
  - **The high three-quarter view**: roofs and a side wall always show, so every house reads as a chunky block from
    the orbit camera; designs are judged from that camera, not head-on.
  - **Clean, bold shapes**: thick eaves with a dark underside, a glossy band along the roof (the normal sheet and a
    stronger spec on roof cells), bold red, navy and teal roofs on white walls among the copper ones, less texture
    noise (trim-sheet contrast kept low).
  - **A New York streak** (Unova's own inspiration): a brick townhouse body (arched windows, a cornice, a stoop),
    fire escapes, rooftop water towers and striped awnings as kit add-ons; Nacrene-like brick and arched windows for the
    Workshop or the archive if BD-3 likes them.
  - **Big readable signs**: a rounded board and a round emblem on the shop and the station; Copperleaf gets its own
    leaf emblem.
  - **Tidier civic buildings**: the storybook lean stays on homes and is turned down on the square's buildings.
- **More nature** (the owner, 2026-10-29): every house plot has a garden. Round, pine and blossom trees behind it,
  shrubs and flowers along the walls, ivy up a corner, hanging baskets, flower boxes, roof gardens, moss. Ivy, flower
  boxes, baskets and moss are model layers in the house recipe; trees and bushes are the island's existing prop
  models, placed with the plot by the town tools (BD-7, island-dress.mjs), not baked into the house. Civic buildings
  get street trees and planters; ivy on the archive, blossom by the inn.
- **More retro-futurism** (the owner, 2026-10-29): every house carries at least one retro-future touch (atomic
  finial with orbit rings, satellite dish, antenna with a glowing tip, wind spinner, solar sail, bubble greenhouse,
  pneumatic tube that glows at night, copper rocket chimney); neon tubes under the eaves on about two thirds of
  houses; chrome and brass trims. Bubble cars hovering by the shop and the station (new scenery props, BD-6).
- **Surfaces** (BD-2a, BD-2b): fish-scale shingles, copper standing seam, barrel tiles, cob/stucco, half-timber, riveted
  panels, glass block, mosaic tile; each with a normal cell.

## 6. Sessions

| # | Session | Goal | Depends on | Sessions |
|---|---|---|---|---|
| BD-0 | The plan (done 2026-10-29) | This file; the suggestion page; ROADMAP and BRANCHES rows | none | 1 |
| BD-1 | New shapes (done 2026-10-30) | The recipe shapes the look needs, in the mesher and the world map; unit tests; a shapes showcase map | BD-0 | 1-2 |
| BD-2a | Surfaces painted | The sheet to 8x4 with the new cells and their height maps, painted in Python (no shader work) | BD-0 | 1 |
| BD-2b | Normal maps | The normal sheet sampled in the model shader; a graphics setting; phone cost measured | BD-1, BD-2a | 1 |
| BD-3 | Look sketches | 3 directions on one house and the shop, as pictures; the owner picks | BD-2b | 1 |
| BD-4a | The house kit | tools/build-house-kit.py: ~24 houses from modules, one catalogue kind with `variants`; a contact sheet | BD-3 | 1-2 |
| BD-4b | Houses placed | Every hub house a different variant (a neighbour rule); Granny Juniper's cottage a one-off | BD-4a, BD-7 | 1 |
| BD-5 | Civic | Shop, inn, library, lab | BD-3 | 1-2 |
| BD-6 | Landmarks | Workshop, Gene Bank, lighthouse, windmill, barn, Skyline Station | BD-3 | 1-2 |
| BD-7 | The town re-laid | New footprints and doors through the town tools; the fixes in section 3; tests | BD-4a, BD-5, BD-6 | 1-2 |
| BD-F | Window check fix | tools/clear-windows.py reads `rot` (section 3); a tools-only fix with its own test | none | part of 1 |
| BD-8 | Phone pass | Pictures day and night; the owner's play test and debug log; frame times | all | 1 |

About 10-14 sessions, in five waves. Sessions in one wave run at the same time; side sessions work on their own
`claude/bd-<n>-<words>` branch with a draft PR into `track/buildings` (the intro track's way), and the wave's last
session merges them.

| Wave | At the same time | Why they don't collide |
|---|---|---|
| 1 | BD-1 new shapes; BD-2a surfaces painted; BD-F the window check fix | BD-1 owns prop-models.js; BD-2a only paints PNGs in Python (the sheet and its height maps); BD-F only tools/clear-windows.py |
| 2 | BD-2b normal maps | the model shader is in prop-models.js and buildings.js, BD-1's files: after BD-1 |
| 3 | BD-3 look sketches | needs the shapes and the surfaces; the owner's pick sets the ranges for wave 4 |
| 4 | BD-4a the house kit; BD-5 civic; BD-6 landmarks | separate builders (a new build-house-kit.py; batch 7 and 3; build-props-hub, -island, build-station-trains). They all write game/data/scenery.json, but different keys: merge one at a time and rebuild data (`npm run data`) after each |
| 5 | BD-7 the town re-laid (with BD-4b's placing), then BD-8 the phone pass | BD-7 alone owns copperleaf.json and the island tools; BD-8 needs everything |

Not at the same time: BD-1 and BD-2b (the same shader files); anything with BD-7 (copperleaf.json); BD-3 before
wave 4 (its pick changes their ranges).

### How the sessions run (the owner's answer, section 1)
- **Branches.** The main line works on `track/buildings`: BD-1, BD-2b, BD-3, BD-4a, BD-7 (with BD-4b), BD-8. Side
  sessions work on their own branch from `track/buildings` and open a draft PR into it: BD-2a
  `claude/bd-2a-surfaces`, BD-F `claude/bd-f-window-check`, BD-5 `claude/bd-5-civic`, BD-6 `claude/bd-6-landmarks`.
  A cloud session pushes only to the branch it was started on: each is started with that branch.
- **The start of a wave's main-line session** merges the last wave's side branches into `track/buildings`
  (`git fetch origin <branch>`, `git merge origin/<branch>`, never a rebase; HANDOFF.md conflicts keep both entries,
  newest on top; scenery.json conflicts are settled by rerunning the builders, then `npm run data`), merges main in,
  pushes, then plans and builds.
- **The end of every session**: the handoff skill (HANDOFF entry, ROADMAP, BRANCHES), push, its PR (a side
  session's draft PR into `track/buildings`; the main line keeps one draft PR from `track/buildings` into main, made
  by BD-1 and updated after), then the chain:
  1. Is the wave done? A wave is done when every session in it has its HANDOFF entry on its own branch
     (`git fetch origin <branch>` and look for `### Buildings track BD-<n>` in its docs/HANDOFF.md).
  2. If not, stop: the last session of the wave to finish starts the next.
  3. If so, check that the next wave's sessions don't already exist (list your sessions; titles start "Buildings
     BD-<n>"), then start each with `create_session` (the repository, its branch as both `source_revision` and
     `outcome_branch`, title "Buildings BD-<n>: <goal>", no plan permission mode) and a prompt that says: the session's ID
     and branch, "read CLAUDE.md, then docs/phases/buildings-track.md section 1 and 6 and the session's own section;
     use the start-session skill but do not wait for approval (section 1); at the end follow 'How the sessions run'".
     Side branches that don't exist yet are made from `track/buildings` first (the GitHub tools' create_branch).
  4. BD-3 ends its turn with the look pick (pictures sent to the owner, options, a recommendation) and starts wave 4
     only after the owner answers in that session. BD-8 starts nothing; it says the track is done.
- **Failures**: a session that cannot finish (red checks it cannot fix, a blocker) says so at the top of its HANDOFF
  entry and in its final message, and starts nothing.

### BD-1 New shapes
In `lowPolyFromRecipe` (prop-models.js), each a new field or kind with its own unit test (bounds, normals pointing
out, triangle count, a stable vertex hash):
- `rot` (yaw) and `tilt: [about x, about y]` on every solid kind, boxes included; the box's UVs follow its faces.
- `prism`: a 2D profile `pts: [[x, z], ...]` in the front plane, extruded `d` deep (optional `bend`): gambrel,
  saltbox, upswept, swoop and arch roofs, gables, bays, steps, Googie canopies.
- `lathe`: a profile `pts: [[r, z], ...]` turned round the vertical (`sides`, optional `ry` for ovals): bulb and
  onion domes, flared chimneys, finned rockets, tanks, finials, mushroom caps.
- box `taper: [top w, top d]`, `lean: [dx, dy]` (the top's offset), `bevel` (a chamfer, one segment).
- a recipe-level `warp: {lean: [dx, dy], bulge, sag, twist}` applied to every vertex by its height, after the parts
  are merged: the storybook wonk, baked into the mesh (no cost a frame). Glass bounds and spin pivots follow it.
- `glow` on solid layers (a colour lit at night, `day` for by day too), through the mesh's vertex data (check where
  a flag fits in the 24-byte vertex) and the window-light hour rules; bloom picks it up.
- The world map: `worldBowlModelShape` keeps prisms and lathes (fewer sides), drops bevels, applies the warp.
- A showcase map of every new shape (like test_hub_buildings), pictures with tools/look-hub-buildings.py.
- The Studio's model editor reads the new fields (shows them; editing them can wait).

### BD-2a Surfaces painted, BD-2b normal maps
BD-2a paints (Python, no shader): the new cells and a height map per cell. BD-2b wires the normal sheet into the
shader and measures it.
- The tone sheet grows from 8x3 to 8x4 cells (512x256): fish-scale shingles, copper standing seam, barrel tiles,
  cob/stucco, half-timber, riveted panels, glass block, mosaic tile; painted in Python in the same five shade levels,
  low contrast (trim-sheet rule). New names in `LOW_POLY_TEXTURE_CELLS` and `BUILDING_TEXTURE_NAMES`.
- **The normal sheet**: same layout, painted from per-cell height maps (each brick, shingle and seam its own height),
  stored as a PNG beside the tone sheet. The model shader samples it with a tangent frame from the face's UV axes
  (planar per face, so boxes, prisms and caps know theirs; round shapes use the arc direction), and the light from it
  is stepped to the pixel look. It replaces the derived `bldBump`.
- A graphics setting (Engine settings, the presets): on above Low by default (Ask 1). Measured with the graphics
  bench and tools on the emulated phone: shader cost, memory (TD's phone budget is 300 MB).

### BD-3 Look sketches
Three directions on one house body and the shop, built with BD-1, BD-2a and BD-2b, as headless phone pictures at noon and
dusk: (A) gentle wonk, sparse details; (B) storybook wonk, medium details (the answers' default); (C) strong wonk,
dense details. The owner picks or mixes; the pick sets the kit's ranges.

### BD-4a The house kit
tools/build-house-kit.py, beside batch 7's `House` (reuse its windows, doors, lamps, chimneys where they fit):
- **Slots, picked by a seed** with style rules (one dominant shape per house; at most one round body part; the shared
  palette; add-ons on free walls only; the door on the front, on a quarter turn):
  - Bodies: narrow tall, wide low, L-shape, round tower-house, jettied two-storey, A-frame, half-dome cob, brick
    townhouse (with its cornice roof and stoop), saucer pod (a space-age pod on legs, oval windows, a fold-down stair,
    a glow under it at night; its door is the stair's foot).
  - Roofs: steep gable, low-pitch slab (Unova's wide thick eaves), butterfly (Googie's V roof), gambrel, saltbox, upswept, bulb dome, mushroom
    thatch, mansard, flat with a roof garden.
  - Add-ons, 0-3: turret, bay window, dormer, lean-to, balcony, porch canopy, bubble greenhouse, solar sail, water
    tower, fire escape, striped awning, antenna or weathervane, wind spinner, outside stair, atomic finial,
    satellite dish, pneumatic tube, starburst wall lamp (lit at night). At least one retro-future add-on on every house; one rooftop ornament at most.
  - A nature pass on every house: flower boxes, ivy (60% of tall bodies), hanging baskets, moss; the plot's trees and
    shrubs are listed with the variant (`garden` hints for the town tools: tree kinds and sides).
  - Chimneys: crooked brick, stovepipe, copper rocket. Doors: round, arched, porthole, Dutch. Windows: porthole,
    round-top, bay, crossed square, ribbon.
  - 8-10 palettes from section 5 (the copper ones and white walls with red, navy or teal roofs); wonk (lean, sag, bulge) from the seed within BD-3's ranges.
- It writes ~24 house recipes and one catalogue kind (name per docs/NAMING.md, e.g. `house_kit`) whose `variants`
  swap `model`, `box`, `door` and `fx` (walk-view.js `plainPropVariant` already lets a variant replace any field), in
  small, medium and large footprints so plots can take them. Glass and roof marks written by the kit itself.
- A contact sheet of all houses (a picture tool), and a test that no two variants share body + roof + palette.
- Triangle budget per house: 6,000 (the owner's answer). Each variant is its own mesh (about 11 more draws than today's 2 shared meshes;
  far under 400).

### BD-4b Houses placed
Every house on the hub a different variant, with a neighbour rule (no two adjacent share body or roof), chosen by a
tool rather than by hand; Granny Juniper's cottage as a hand-made one-off (cob walls, a teapot chimney, her garden
kept). The Studio's variant picker shows the kit's variants by name.

### BD-5 Civic
- Shop: a Streamline corner store: rounded corner, speed lines, a big front window, a starburst sign, a striped awning.
- Inn / cafe: floors stacked and each slightly turned, a teacup sign, balconies, string lights.
- Library / the Bureau's archive: a rotunda with a filing-drawer front, an upswept book-fan roof, a clock.
- The lab: an observatory dome that reads from the orbit camera, a radio dish, a copper tower, Kappi's corner.
Lettering stays fixed decals, never mirrored (HB-1).

### BD-6 Landmarks
- Workshop: a quonset hut (half-cylinder), a big gear over the door, the crane kept.
- Gene Bank: the lab-vault with bubble domes and the helix, rounder.
- Lighthouse: a finned rocket shape; its light room and turning shutter kept.
- **The windmill kit** (the owner: "more windmill variety and variants"): windmills become one catalogue kind
  (`windmill`, its old key) whose `variants` swap the model: nine designs times three colourways (copper and cream;
  white, red and navy; brass and teal), each rotor a `spin` layer. Designs (the sketch page draws each):
  copper tower mill (today's, redone), Googie needle (a spire on boomerang fins, a saucer pod, a starburst rotor, a
  halo ring), helix turbine (a twisted vertical scoop, a glowing core), solar-sail post mill (a wooden body on a
  trestle, lattice sails of solar cloth), rocket mill (a finned rocket, a nose propeller, a glowing exhaust ring),
  farm windpump (a lattice tower, a many-bladed wheel, a tail vane, a water tower), saucer tower (a flying-saucer
  lookout, two rotors turning opposite ways), sky kite turbine (a ring turbine flying on a tether over a mooring hut;
  the tether and ring are model layers, the ring bobs like `mooredBob`), tree mill (a rotor bolted to a great tree,
  a cabin in its branches). BD-7 places three to five round the island (by the farm, on the hill, at the coast, on the
  square's edge), no two the same design; the old `wind_turbine_small` stays or becomes a helix. Spinning parts are
  instanced spins (one draw each per mesh): measured with the phone frame times.
- Barn: a gambrel roof with solar shingles and a domed silo.
- Bubble cars: a small hovering retro car prop (two or three colour variants, a glow under it at night), parked by
  the shop and the station.
- Skyline Station: a Googie boomerang canopy over the platform, a starburst clock; the rail, its offset and the
  portal unchanged (station-place.mjs reads `box[1]`: keep the depth or move the rail with it, tested by hub-doors).

### BD-7 The town re-laid
- New `box`, `door` and `fx` (smoke at the new chimneys, glows at the new lamps) into the catalogue from the builders
  (their reruns overwrite hand edits, so the builders own them).
- `plots` edited in copperleaf.json where a building outgrew its plot; the chain rerun from the committed map; doors
  to the camera (hub-doors).
- The fixes in section 3: the door's px/m, clear-windows' `rot`, doors for the lighthouse and station (or their own
  budget), cottage_juniper's size.
- Pictures baked from the models for every building (build-props-island.py `bake`).
- Tests updated: hub-doors, island-dress, hub-data, hub-residents, lowpoly-props budgets, check-quick's rooms and room
  windows; the full test walks every door.

### BD-8 Phone pass
tools/island-shots.py and look-hub-buildings.py pictures at noon, dusk and night; the owner plays on the phone and
sends a debug log; frame times against the last log's.

## 7. Ask me before
Answered 2026-10-29 (section 1): the normal sheet on above Low; pixel-font decals; 6,000 triangles a house. Still the
owner's: BD-3's look pick. Anything new a session meets that only the owner should decide is asked the same way
(options, a recommendation, the chain waits).

## 8. Not in this track
- Run towns' houses (biomes.json `town.houses`): a later step swaps them to the kit per biome palette.
- Rooms' insides (rooms stay 12x10 and as they are).
- The airship and its mast, the portal, the sky rail, props (benches, lamps, stalls).

## 9. Risks
- **Phone cost**: the normal sheet (one more texture read a pixel), more triangles, more meshes. BD-2b and BD-8 measure.
- **Footprints** ripple through the town tools, locked zones, rooms, the opening's spots and ~8 checks: held in BD-7.
- **One owner per file**: copperleaf.json and the island tools in BD-7 only; prop-models.js in BD-1, then BD-2b.
- **Builders overwrite**: a builder's rerun replaces hand edits of its recipes and catalogue entries; edit the tools.
- **Colour swaps**: add-building-variants.py swaps by hex; the new builders write their own variants instead.

## 10. Done when
Every hub building has its own silhouette in the new style; no two houses look alike; the new surfaces and normal
sheet are in and cheap enough on the phone; doors, rooms and walking work; the checks are green and the owner has
played it on the phone.

## 11. Sources
- [Creative Bloq: how to make low-poly buildings for games](https://www.creativebloq.com/how-make-low-poly-buildings-games-10123111)
- [Googie architecture (Wikipedia)](https://Www.Wikipedia.org/wiki/Googie)
- [Streamline Moderne (Wikipedia)](https://en.wikipedia.org/wiki/Streamline_Moderne)
- [How Townscaper works (Game Developer)](https://www.gamedeveloper.com/blogs/how-townscaper-works-a-story-four-games-in-the-making)
- [Hayao Miyazaki's architecture (Domus)](https://domusweb.it/en/architecture/2023/05/30/hayao-miyazakis-architecture-balancing-humanity-and-nature.html)
- [Studio Ghibli architectural details (The Architects Diary)](https://thearchitectsdiary.com/studio-ghibli-movies-10-most-inspiring-architectural-details-to-know/)
- [Working with trim sheets (80.lv)](https://80.lv/articles/arabian-afternoon-working-with-trim-sheets-efficiently)
- [WebGL normal map (Song Ho Ahn)](https://songho.ca/webgl/webgl_normalmap.html)
- [Hand-painted textures and normal maps (Polycount)](https://polycount.com/discussion/comment/971525)

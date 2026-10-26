# Water track (WA) - pixel water, waterfalls, rivers, the sea, wading and surfing

Branch: track/water

The owner's brief (2026-10-25): improve and expand the water system, "waterfalls, ocean, rivers, everything", with
good graphic fidelity in the pixel-art style; research first; run sessions at the same time where they can. Planned in
one session (WA-0, branch `ccr-4ae7bdc4-46vu9r`, because `track/water` did not exist yet: the owner makes it from
that branch's merge or from main, and every later session starts on it). Tags `wa-N-done`.

This track takes over from the terrain track (terrain-track.md): TR-6's waterfalls off terrace edges, TR-10's water
parts (waterfalls, rapids, hot springs, oases, marsh and bog, floods) and "Rivers flowing downhill" (its Later row).
TR-6 keeps vines and cave doors; TR-10 keeps the ground surfaces (mud, cracking ice on land, lava's edge damage).

## The owner's answers (2026-10-25, Plan Mode)
| Question | Answer |
|---|---|
| How strong a pixel look | **Hybrid**: the surface, foam, highlights and falls on the 32 texels a metre grid, 4-5 tones a kind, a dither between shallow and deep; reflections and the slow swell stay smooth |
| Animation | **Stepped, about 10 frames a second** for ripples, foam and fall streaks; the swell and the water's level stay smooth |
| Moving through water | **Wading** in shallows, **Surf** on a Billie, a **Waterfall climb** field move |
| Waterfalls | **Big set pieces** (4-15 m, a plunge pool, mist, sound), **small cascades** (the automatic sheets, improved), **in caves**, and **one on the hub island** (ask again in WA-2b: the island is locked once right) |
| Sessions at once | **3 lanes** (renderer, generation, play); a fourth, B, in round 3 (asked after WA-0: yes) |
| Where it lives | **Its own track**, `track/water` |
| Mapgen | **A new module**, `logic/water-gen.js`, with one small hook in `mapgen.js` |
| Extras | **Water sounds, Studio tools, weather on water, water life** |

Lane B (WA-7, the world map's and battles' water) runs in round 3 as a fourth lane: four sessions at once for that
round (the owner, 2026-10-25, after WA-0).

## Verified facts (main f779581, 2026-10-25)
- **Nine kinds** (`walk/water-data.js WATER_KIND_LOOKS`: pond, stream, canal, spring, swamp, lake, sea, lava, ice), each
  with colours, clarity, caustics, foam, ripple, glow, murk, weed and fish. The water shader's arrays are fixed at 9
  (`walk/walk-shaders.js:173`, `uKD[9]` ...; `walk/water.js WATER_KIND_UNIFORMS` 27/36 floats): a tenth kind means
  growing them (WA-5b moves them into a small texture instead).
- **The surface**: a quad per half-metre water cell (`walk/ground-mesh.js` from :467): still water lies level per
  terrace, running water follows its bed; each vertex carries shore, flow, depth and kind. The shoreline is a mask at 8
  samples a metre, blurred twice and nudged by noise (`shoreField`); the ground shader paints the bed, pebbles and a
  wet rim from it.
- **The water is not on the pixel grid**: it snaps at 16 texels a metre (`walk-shaders.js:186`,
  `floor(vW.xz*16.)/16.`; the ground's shore and puddles too) while the grass and the bed's pebbles use 32. Its
  colours are smooth mixes and it moves every frame. The "pixel-water patch" (`water.bands` / `water.frames`) that
  terrain-track.md asks to merge first was never in the repository (checked again: no such keys).
- **Waterfalls are only automatic**: a 0.5 m sheet wherever a water cell spills 0.15 m or more into a lower one
  (`ground-mesh.js:692`), drawn by the `fall` shader (`walk-shaders.js:231`: two noise layers, a white foot, not on the
  pixel grid, alpha 0.82); spray and mist quads for up to about 40 of them (`walk/effects.js:300`). In test_water a
  1.6 m stream off a 6 m cliff gives one 0.5 m sheet that ends in a point (validation/look-water, WA-0).
- **Rivers are lines**: `mapgenStreamLine` (`logic/mapgen.js:1360`) draws a noisy line across the map,
  `mapgenPaintStream` (:1391) paints it, `streams: [{pts, speed}]` carries it; the flow at a vertex is the nearest
  segment's direction within 2.5 m (`water-data.js waterFlowField`, a loop over every segment per vertex). Nothing
  makes water run downhill. The coast is `mapgenPaintCoast` (:1481, chosen at :2435).
- **The sea all round** (IS-3, `logic/sea.js`): one skirt of rings out to 400 m on `flatFar` maps, swell rolling in
  toward the island's middle, surf bands over the shallows, a calm cove by zone. The hub's world map shows the island
  in open sky (no sea, VISION).
- **Reflections**: one half-size pass of the scene's pictures (`water.js reflectionPass`, the sprite program), at the
  level of the nearest body of water. Whether low-poly models (every game-flow building now) show in it: to check in
  WA-1.
- **Riding already exists** (v24, legacy, kept): in a scene with `ride` set, water is walkable (`walk-view.js:2722`)
  and you sit on your biggest Water Billie at least 1.5 m tall (`rules.json ride`, `logic/rules.js riderOf`), drawn
  from its rig, bobbing, leaving rings (`walk/prop-look.js rideMountItem`). Run side areas whose field move has `ride`
  set it (`logic/run-scenes.js:270`). Everywhere else `w` and `d` tiles block walking. So Surf (WA-6b) grows riding
  from a whole-scene flag into per-cell water you mount and leave at the shore; it is not new.
- **Water sounds already exist**: beds near running water, falls, the sea and ponds (`sound.js:769`, the sea at
  :1050). SND-6 (unmerged, branch `sound`) changes the mix: water sounds wait for it (WA-8).
- **Busy files**: `logic/mapgen.js` had 15 commits in the week before this plan (routes, towns, terrain, regions);
  the water renderer's files had 1-4 each.

## Research (2026-10-25)
- **Pixel water** comes from flat, colour-reduced shading, posterised to a few tones with an ordered (Bayer 4x4)
  dither between them ([GameDev.net palette filter](https://gamedev.net/shaderlab/39-pixel-art-palette-filter/),
  [pixel water](https://estivalbloom.itch.io/pixel-water), [dddpix](https://store.godotengine.org/asset/wing888/dddpix/)).
  A screen-space dither shimmers as the camera moves; a world-space one fixed to the ground's own grid does not swim
  when the grid is the art's ([world-space dither](https://godotshaders.com/shader/qos-style-world-space-blue-noise-dither-effect/)).
  Our grid is 32 texels a metre in world space, already used by the grass and the bed: the water joins it. The pixel
  water demo keeps its refraction finer than the pixel grid: the hybrid answer.
- **A Short Hike** (players' accounts, not the developer's): a small render target and a colour grade that cuts the
  palette ([itch.io](https://itch.io/post/2065934)). **Sea of Stars**: no technical write-up of its water found; Unity
  with a custom 2D pipeline ([Niche Gamer](https://nichegamer.com/2020/03/19/the-messenger-prequel-rpg-sea-of-stars-enters-kickstarter-launches-2020-for-pc/)).
  A look reference only.
- **Classic tiles**: water held 2-5 colours of its own and animated by swapping tile frames or cycling the palette
  ([colour cycling](https://en.wikipedia.org/wiki/Color_cycling), [GB dev forum](https://gbdev.gg8.se/forums/viewtopic.php?pid=3219),
  [itch.io](https://itch.io/post/2842319)): 4-5 tones a kind, stepped frames. Pokémon's exact waterfall frame count
  was not found.
- **Waterfalls**: five parts, cascade, splash, white water, foam and mist
  ([Roblox](https://create.roblox.com/docs/en-us/tutorials/use-case-tutorials/vfx/create-waterfalls.md)); a slow large
  noise over a fast small one for streams within the sheet, foam strength in a vertex channel
  ([Unity](https://unity.com/blog/engine-platform/nature-shaders-with-shader-graph-in-2022-lts)); foam at the pool by
  depth ([Godot stylized water](https://store.godotengine.org/asset/emace-art/stylized-water-shader/)), which our shore
  field already gives.
- **Rivers**: fill the dips, send each cell downhill, add up the flow, carve where it is high
  ([Red Blob Games](https://www.redblobgames.com/maps/rivers/), [Procedural Riverscapes](https://diglib.eg.org/handle/10.1111/cgf13814),
  [GaiaGreen](https://github.com/kthecoder/GaiaGreen)); the known trap is water pooling in dips, so the fill matters.
- **Flow maps**: a texture of directions read by the shader, two phases blended so the loop never pops
  ([Yudiz](https://blog.yudiz.com/?p=20835), [Waterways](https://github.com/Arnklit/WaterGenGodot): flow in red and
  green, foam in blue). It replaces the per-vertex search over every stream segment.
- **Surf on a coast**: foam from depth or contact with the shore, a noise that forms and fades in place
  ([toon water](https://openupm.com/packages/net.roystan.toonwatershader/), [Unity thread](https://discussions.unity.com/t/water-shader-814446/814446)).
  IS-3's surf bands are close: they get hard edges and steps.

## The data contract (WA-0; every lane builds on it)
Nothing here is built in WA-0; this is what the lanes agree on so they can work at once.
- **Waterfalls**: a scene's `falls: [{x, z, dir, w, h, pool, k, climb}]`. `x, z` the lip's middle (metres);
  `dir` the way it falls, a unit `[dx, dz]`; `w` its width (m); `h` the drop (m; when missing, from the ground);
  `pool` the plunge pool's radius (m, 0 none; WA-2b: its middle lies `pool + 0.25` m past the lip along `dir`); `k` the water kind at the lip (default `stream`); `climb: 1` when the
  Waterfall field move climbs it. An entry replaces the automatic sheets across its width; steps without one keep
  the automatic sheets (the small cascades).
- **Rivers**: no new key. `streams` stays `[{pts, speed}]` and gains optional `w` (a width per point, m), `src`
  (`spring` | `edge` | `lake`), `mouth` (`sea` | `lake` | `edge` | `pool`) and `rapids` (`[[t0, t1], ...]`, fractions
  along the line). The renderer's flow field reads `pts` and `speed` as now, so a lane G scene draws before lane R
  reads the new fields.
- **Tiles**: `w` (shallow) becomes wadeable (WA-6a); `d` (deep) becomes surfable (WA-6b). A scene's `ride` stays as a
  whole-scene "surf anywhere" for the existing side areas.
- **Kinds**: appended, never reordered (the index is built into a scene's water mesh each time it is built; maps
  name kinds by their key): `rapids`, `hotspring`, `oasis`, `bog`, `reef`, `cave` (WA-5; the owner confirmed the six in
  WA-5a). `swamp` stays the marsh. The list and each kind's play live in `logic/water-kinds.js` (`WATER_KINDS`,
  `WATER_KIND_PLAY`; WA-5a): lava and rapids are never entered (neither waded nor surfed); ice is walked on, its `d`
  too (the slip waits for TR-10's cracking ice); the marsh (0.8) and the bog (0.6) slow wading; a hot spring heals.
  Until WA-5b draws them, a new kind borrows an old look (`WATER_KIND_BASE`: rapids stream, hotspring spring, oasis
  pond, bog swamp, reef sea, cave spring); generated scenes keep their `waterKind` and lay the new kinds as `waters`
  rectangles, so the renderer (an unknown rectangle draws as the scene's kind) shows the right old look meanwhile.
- **Settings** (engine.json `water`): `pixel` (on/off, default on after WA-1), `bands` (tones a kind, 2-8, default
  5), `frames` (animation steps a second, 0 = smooth, default 10). The names follow the old patch's.
- **Shared shader code**: WA-1 puts the pixel water's colour bands, dither and stepped time in one GLSL snippet in
  `walk/walk-shaders.js`; lane B (WA-7) reads it and does not edit it.

## Lanes: who owns which files
All lanes work on `track/water` (a cloud session can only push to the branch it started on). Before every push:
`git pull --no-rebase origin track/water` (a merge, never a rebase or force push). A lane never edits another lane's
files; a change it needs there goes in its HANDOFF entry for the owner lane. HANDOFF: add yours at the top in one
commit right before your last push. `game/js/hooks.js` is generated: on a conflict run `npm run modules` again, never
merge it by hand. Pictures: lanes run the smoke check only; the quick-check baseline is made once, in WA-8.

| Lane | Owns |
|---|---|
| **R, renderer** | `walk/walk-shaders.js` (water, fall, the ground's shore parts), `walk/water.js`, `walk/water-data.js`, `walk/ground-mesh.js` (the water and fall parts), `walk/effects.js` (spray, mist, steam, leaves), the `water` group of `engine/settings.js` and `game/data/engine.json` |
| **G, generation** | `logic/water-gen.js` (new), its one hook in `logic/mapgen.js`, `logic/sea.js`, the scene data's `falls` and `streams`, the test scenes' water (`tools/build-test-scenes.py t_water`), the Studio's water tools |
| **P, play** | `walk-control.js`, the walk grid's water rule (`walk-view.js:2722`), `walk/prop-look.js rideMountItem`, `walk/sprites.js` (the waterline cut), `field-moves.js`, `game/data/fieldMoves.json`, `logic/rules.js` (riding), `fishing.js` hooks |
| **B, world map and battles** (round 3) | `world-bowl.js` (its water and rivers), `battle-stage.js` (water backdrops) |

The renderer lane's sessions run one after another (one shader file, one mesh builder); the track's length is that
lane. Lane G lands its `mapgen.js` hook while no other track has a mapgen session open (routes, towns, TR-2c part 2,
regions), and bumps `MAPGEN_VERSION` when generated scenes change.

## Sessions
| Round | # | Lane | Session | Checks before the tag |
|---|---|---|---|---|
| 0 | WA-0 | (alone) | (**done** 2026-10-25) This file, the contract, the lanes; test_water grown with a 6 m fall into a plunge pool, lava, ice and a strip of sea; `tools/look-water.py` (pictures and the water's numbers, before and after). | check:data, smoke |
| 1 | WA-1 | R | (**done** 2026-10-25, notes below) **Pixel water.** Water, shore and falls on the 32 texels a metre grid; `bands` (a kind's tones, dithered between shallow and deep on the world grid), `frames` (stepped time for ripples, foam, caustics, glints); hard 1-pixel foam lines at the shore; reflections offset by whole pixels; the shared snippet; models in the reflection (check); the `pixel` switch. | look-water before and after (every shot, noon and night), bench Pond station cost, smoke |
| 1 | WA-3a | G | (**done** 2026-10-25, notes below) **Rivers that run downhill.** In `water-gen.js`: fill the dips, flow and its sum on the height grid, a source (spring, edge, lake) to a mouth (sea, lake, edge, a plunge pool), carved banks, wider downstream, meanders on flat ground, rapids on steep stretches; seams match the neighbour's river; joins mapgen's existing water stage and bridges. | unit tests (same seed same river; every cell of a river lower than the one before; mouths reached), the mapgenUnreachable sweep, golden water scene remade on purpose |
| 1 | WA-6a | P | **Wading.** `w` tiles walkable, slower; the player and Billies cut at the waterline; splashes and a wake (`addRipple`); deep `d` still blocks; Studio and quick-check walking checks updated. | unit tests (the walk grid), a walking check in test_water, smoke |
| 2 | WA-2a | R | (**done** 2026-10-25, notes below) **Waterfalls drawn.** Each `falls` entry: a curled lip, a sheet of streaks in pixel columns over a slower large pattern, white water at the foot, a churning foam ring and rings on the plunge pool, mist that rises and drifts, wet dark rock beside it, the light it throws; the small automatic sheets the same style; the flow map (a texture of flow and foam) replacing the per-vertex segment search. | look-water (tall-fall, stream-and-falls), bench cost, smoke |
| 2 | WA-2b | G | (**done** 2026-10-25, notes below) **Waterfalls placed.** Off terrace and cliff edges where a river meets a drop, in caves (rooms), as a route's set piece; `climb` on some (the Waterfall move's way up); the hub island's fall only with the owner's yes. | unit tests (a fall's lip and foot on its river; its pool reached), sweep |
| 2 | WA-6b | P | **Surf and Waterfall climb.** Riding per cell: walk into `d` with a rider (`rules.ride`) and the Water badge, mount and leave at the shore; the mount's bob, wake and rings; encounters on water (the region's water pool); the Waterfall field move (badge: ask) climbing a `climb` fall. Builds on the contract while WA-2b lands. | unit tests (riding rules, badge), a surf walk check, smoke |
| 3 | WA-4 | R | (**done** 2026-10-25, notes below) **The sea and the coast.** Surf as hard stepped bands breaking along the coast, foam round rocks, a slow tide (the waterline and wet sand move, tide pools), reef shallows (turquoise, see-through), kelp, sandbars, a sun and a moon path on the open sea, a storm sea from the forecast. | look-water --scene=test_island, island-shots, smoke |
| 3 | WA-5a | G | (**done** 2026-10-25, notes below) **New kinds' play and weather on water.** Hot springs heal the party, oases, marsh and bog slow you (their encounter pools, hidden items in reeds), rapids block, floods in storms keep the main path open, ponds freeze in snow, rain rings (exist). | unit tests (a flooded path keeps the main path open; heal once a run), smoke |
| 3 | WA-7 | B | (**done** 2026-10-26, notes below) **World map and battles.** The bowl's rivers and seas in the same tones and steps (the shared snippet); water backdrops on battle stages by a node's biome. | bowl map test, battle stage pictures, smoke |
| 4 | WA-5b | R | (**done** 2026-10-26, notes below) **Kinds as a texture and water life.** Kind looks in a small texture (no cap at 9), the new kinds drawn (steam on hot springs, rapids' white water, bog's scum, reef, cave water lit by its own glow); lily pads that bob, reeds that sway, frogs, fish that jump (sprites), birds that dive. | look-water, smoke |
| 4 | WA-9 | G | (**done** 2026-10-26, notes below) **Studio tools.** A river brush (source to mouth, regenerates its bed), a waterfall placer (lip, width, pool, climb), a water-kind painter, a live preview; STUDIO.md. | Studio check, a hand-placed fall survives a regenerate |
| 5 | WA-8 | (alone) | **Phone pass, sounds, baseline.** Quality tiers for water (bands, mist, reflections) measured at the bench; the owner's phone frame time; water sound beds (falls by height, rapids, surf, lapping, the plunge pool) with SND-6's mix; the quick-check baseline made again on purpose. | full quick check, the owner's phone |

## Ask me before
- The hub island's waterfall (WA-2b): the island is locked once right. (Answered in WA-2b: after HB-4b rebuilds the
  island, from the same `falls` contract.)
- Surf's details (WA-6b): which badge (the Water badge, as VISION's side areas), encounters while surfing, whether
  the existing "1.5 m tall Water Billie" rule stays.
- The Waterfall climb's badge (WA-6b).
- The new kinds list before WA-5a (the six above are a proposal). (Answered in WA-5a: all six, in that order.)
- Water sounds after SND-6 merges (WA-8).

## WA-0 notes (2026-10-25)
- test_water (58 x 28 m, was 40 x 28): the old west half unchanged; east of x 42 a 6 m cliff (rock) with a 1.6 m
  stream falling into a plunge pool, and pools of lava, ice and a strip of sea (water rectangles). New shots
  `tall-fall`, `lava`, `ice`, `sea-strip`; a walking check from the hub to the fall's foot.
- `tools/look-water.py` at noon on test_water (software drawing, a look note only): 258 water tiles, 3,344 water
  triangles, 10 fall sheets (20 triangles, the tallest 6 m), half-metre cells by kind (pond 359, stream 317, sea 88,
  canal 60, lake 60, swamp 48, lava 44, ice 44, spring 12), 8 mirror levels, 4 fish homes. The pictures are in
  validation/look-water/ (not committed); WA-1 makes its "before" set with `--out=` from the `wa-0-done` commit.
- What the before pictures show: the tall fall is a narrow sheet (about a third of its stream) ending in a point; the
  sea strip and the canal look tile-edged where they are rectangles; at phone size the depth of field blurs the near
  water.

## WA-3a notes (2026-10-25)
- `logic/water-gen.js` (lane G): `waterGenRiver` from mapgen's water stage, `waterGenCarve` after the water is
  lowered. Sources: a free side (`edge`), a `spring` (high ground away from the road), a pond (`lake`), or a joined
  edge where the neighbour's river comes in. Mouths: the `sea` (a coast), a pond (`lake`), a side (`edge`), a `pool`
  it fills. Up to 12 source and mouth pairs are tried, each with the land flooded from the mouth (priority flood);
  the longest that fits is kept, and the old line only when none does (a note).
- What a river keeps clear of: the exits' straight road runs, the main road's middle (the hub's place), a town's
  street and lots (24 m either side of the road's middle, from 8 m south of it to 32 m north), other water, and the
  sides it neither starts nor ends at. It crosses a road nearly square (ground by a road counts 0.6 m higher in the
  flood), at most twice, once at least with the bridge feature. A river that would cut 25 cells or more off from the
  road is ended in a pool partway (one end inland cuts nothing off).
- Its shape: straight for 8 m across a side, smoothed, meandering where the slope is under 2%, 1.5 m wide at least
  and 0.6-1.2 times the dial's width by the square root of the flow, never narrower downstream. The level is 0.15 m
  under the bank, never higher than the point before. The bed is 0.3 m deeper within 0.75 m of the line (more on a
  wide river), so the level read along the line never rises. Banks eased. Rapids where the level drops more than
  6% over 3 m.
- Seams (the owner: a river may cross a joined edge and carry on): a crossing of a side with an exit lies within 16 m
  of the exit (`WATERGEN_SEAM_REACH`; two exits on a side may be 44 m apart, so the other exit's 26 m band starts
  18 m away), clear of the exit's road run. A joined edge is never a mouth. The child finds the parent's water in
  its edge strip, starts its river there (`src: 'edge'`) even when its own dial has no stream, copies the cells and
  corners exactly, and `mapgenPinSides` leaves the crossing's corners (`G.riverKeep`), so a run scene's east and west
  edges are 0 except where a river crosses.
- Numbers (50 pinned run-like routes with the stream dial, 7 of them coast): 42 rivers; 24 edge to edge, 12 spring
  to edge, 4 edge to pool, 2 edge to lake; no fallback; 78-218 m long (136 on average), dropping 0.7 m on average
  (1.73 m at most), widest 3.5 m on average, 15 with rapids, 37 bridges. A river scene takes about 60 ms in Node
  against 24 ms without one (the old line: 22 ms).
- Not done here: lava keeps the old line (the owner); the hub island's river (`island-gen.js`) is untouched (the
  island is locked); test_water keeps its hand-made streams. The renderer still reads only `pts` and `speed`.

## WA-1 notes (2026-10-25)
- Settings (engine/settings.js `water`, panel rows): `pixel` (on), `bands` (5, 2-8), `frames` (10, 0-20; 0 smooth).
  One uniform, `uPixW = (on, bands, frames)`, set by `water-data.js setPixelWaterUniform` (through
  `setShoreUniforms` for the ground and the water, and by `drawWater` for the falls): switching is live, no rebuild.
  `pixel` off draws the look of before (pictures with it off differ from the before set no more than two before
  runs differ from each other: the clock and the wind).
- **The shared snippet** (lane B reads it, never edits it): `walk-shaders.js PIXEL_WATER_GLSL` declares
  `uniform vec3 uPixW` and gives `pwRes()` (32 or 16 texels a metre), `pwCell(xz)` / `pwSnap(xz)` (the texel and its
  corner), `pwBayer(cell)` (4x4 ordered dither fixed to the world grid), `pwStep(t)` (stepped seconds),
  `pwQ(v, n, cell)` (v in n dithered tones), `pwBand(v, cell)` (water.bands tones), `pwTone(shal, deep, d, cell)` (a
  kind's ramp) and `pwHard(e0, e1, x)` (a hard edge, smoothstep when off). A shader that includes it sets `uPixW` with
  `setPixelWaterUniform(U)`.
- What moved to the grid and steps: the surface, its shoreline (it steps in whole texels), ripples, rings (hard, one
  texel wide), foam (three tones), caustics and glints (hard pixels), duckweed, whitecaps, the surf's foam lines,
  lava's crust (three tones), ice's cracks and sheen; the ground's bed, wet rim (three tones), the sea's swash, the
  light thrown up on walls and puddles; the fall sheets (pixel columns, three tones, a hard foot and lip). Smooth: the
  swell, the lap of the level, the swash, the reflection picture and the Fresnel mix.
- **The shore's foam line**: a kept texel with a neighbour (one texel away) the shoreline cuts off; white on clear
  water, a pale scum on murky, its strength the kind's foam. Four more shore reads, only near the edge.
- **Reflections**: the ripple offset is the same over a texel and steps in time, then rounded to whole screen pixels;
  the mirrored picture stays smooth.
- **Models in the reflection (the check)**: they were missing. The reflection pass drew every prop's picture, and a
  prop drawn as a model (`it.vox`: every game-flow building, the hub's trees) has none the main pass shows; in
  Copperleaf the moss cottage by the sea was not in the water. Now those props are drawn as models with the mirrored
  camera (`drawPropModels`, no shadows); `walkRenderer.reflModels` counts them (5 at that spot). Cost: those models
  twice (the reflection already runs every other frame on a struggling device).
- Bench: `water.pixel` joins the Pond station (off and on); its cost is the owner's phone run (a headless browser
  draws in software).
- What the pictures show (validation/look-water-before*, -after*, not committed): at phone size with the depth of
  field the change is small (the hard shore line, the fall's columns, finer shorelines); close up (camera pitched
  down, blur off) the pond has a world-grid dither, a one-texel foam line and sparser hard glints; ice keeps its
  sheen patches with dithered edges and its outline steps at 32 instead of 16. In test_water's haze the pond's tones
  between shallow and deep read faintly: the sky's reflection mixes over them (unchanged, the hybrid answer).
- Not in WA-1: spray and mist (`effects.js`) and the falls' shape (WA-2a), the surf's hard bands (WA-4).

## WA-2b notes (2026-10-25)
- The owner's answers: the hub island's fall waits for HB-4b's rebuild (then from the same contract); WA-6a's
  "shallows for others" goes to a later lane G session; the river steps with the land; "caves" are the generated
  cave biome (Rock Smash's side area), not rooms; the run dials stay as they are (below).
- `logic/water-gen.js` `waterGenFalls` (one call after mapgen's land stage) and `waterGenClimbs` (one call on the
  finished scene); `sc.falls` written beside `sc.streams`. MAPGEN_VERSION 16.
- **Found**: the terraces and a massif's shelves leave the ground under water at 0 (`mapgenTerraces`, "water lies at
  the bottom"; the mountain field fades to nothing within 1-4 m of water), so a river crossing them ran in a trench and
  never met a drop. Now its water is lifted to the step raise of its lower bank (the lowest over 1.5 m either way, 0
  by a pinned or joined side, by a road or a bridge's deck, at a sea or lake mouth), never higher than the point
  before; dry ground right beside it lower than it comes up to it. A drop of 0.6 m or more (`WATERGEN_FALL_MIN`) is a
  fall; smaller ones stay the automatic cascades.
- **Why river falls are rare**: the level can only go down from the source, and WA-3a's rivers follow the smooth
  ground, which the terraces (made later) don't know: a river often runs toward higher terraces (they rise toward the
  back) and stays in its trench. Falls come where a river runs from the back terraces to the front. In a sweep of 60
  stream scenes with terraces, 4 rivers had a fall (0.7-1.3 m). Making the water stage see the terraces' levels (or
  turning a river round when its banks rise downstream) is a later lane G job in mapgen.js's busy water stage.
- **Runs have no terraces or mountains** (rules.json `run.scene` sets hills, cliffs and water only; mountains come
  from Rock Smash's cave land or the debug mod): in a run, falls show only in the Rock Smash cave. The owner's call:
  the dials stay; the roguelite and routes tracks may add an occasional terraces or massif dial to run nodes.
- **Set pieces** (4-15 m, `WATERGEN_SET_PIECE`): a spring on a massif's shelf spilling off its edge, on a route or a
  cave with mountains (chance 0.4, a cave 0.7; never a town). The massif makes staircases of 0.8-2 m shelves, not
  sheer cliffs (a 4 m drop within 1.5 m almost never), so the set piece cuts a notch down the shelves (up to 6 m) to
  the lowest one and a pool there. Most places are refused because the notch would split a shelf that is only walked
  along its length (more than 25 half-metre cells cut off from the road, `WATERGEN_LOST_MAX`): about 1 cave in 8 gets
  one (6 of 80 mountain scenes, 4.1-7.6 m). The spring's run is a stream (`src: 'spring'`, `mouth: 'pool'`).
- **Plunge pools**: whole cells round a point `pool + 0.25` m past the lip, 1.4-3 m, on dry ground at the foot's raise
  (within 0.4 m; a set piece cuts higher ground down), clear of roads, bridges, jetties, a town's square, the hub and
  the map's last 6 m; painted like a river (deep more than 1.1 m from the edge), its bed carved. Only where its rim is
  walked to and it cuts off no more than 25 half-metre cells; else the fall has `pool: 0`.
- **`climb: 1`**: a fall of 2 m or more with a pool whose top (4 m back from the lip) and foot the game's own reach
  (`mapgenReach`, with props and slopes) walks to, so the Waterfall move is a short cut, never the only way. Decided
  on the finished scene: a reach worked out before the props were placed said yes where the game said no. River
  falls are under 2 m so far; set pieces are climbable about a third of the time.
- test_water: the 6 m fall is a `falls` entry (`{x 50, z 17, dir [0,-1], w 1.6, h 6, pool 2.2, climb 1}`); its pond
  moved 1.9 m north to the cliff's foot, so its middle lies where the contract says. The data check warns on a fall
  off the map, with no direction, no width or drop, or its lip off water.
- Numbers (a sweep of 120 terrace, mountain and cave scenes): 11 falls, 5 set pieces, 6 pools, 1 climbable; every
  exit reached, no generator note; every pool walked to. Cost: about 15% more on a mountain scene in Node (224 to
  258 ms), 13 ms on a river over terraces.

## WA-2a notes (2026-10-25)
- **The flow map** (`walk/water-flow.js`, new, Node-testable): flow (x, z), foam and how far into its stream, on the
  water mesh's half-metre grid, built once with the mesh. Each stream segment visits only the cells within its reach
  (2.5 m, or `w/2 + 1` on a wide river), the nearest segment winning as before: a plain `{pts, speed}` stream gives
  exactly the old flow at every cell (tools/test/water-flow.test.mjs). It reads WA-3a's `w` (reach), `rapids` (1.6
  times faster, white water along the middle), `mouth` (churn into a `pool`, `lake` or `sea`), `src` (`spring`
  bubbles) and each fall's foot (churn). `waterFlowField` (water-data.js) is gone; `flowAt` and the leaves read the
  map. Build cost in Node, flow map against the old search over every water cell three times (as the mesh asks):
  58 x 28 m 3 against 6 ms, 120 x 80 m 6 against 37 ms, 180 x 90 m with a 120-point river 3 against 124 ms.
- On the card: a half-float RGBA texture (unit 7, `water-data.js flowTexture` / `setFlowUniforms`), off for the
  basins. With pixel water the surface pattern is carried down the flow in two phases half a loop (2 s) apart and
  blended, so it never drifts without end (it did before; pixel off keeps that old drift); the foam channel boils in
  place in steps.
- **Falls entries** (`ground-mesh.js placeFalls`, `fallSheet`): the lip at the water's level 0.3 m upstream; `h`, or
  the drop to the lowest water or ground 0.5-2 m past the lip (an entry under 0.3 m is left to the automatic sheets);
  the sheet lands `min(1.8, 0.25 + 0.45 sqrt(h))` m out (the water leaves the lip moving); a quarter-turn curl over
  the lip, rows leaning out with the square root of the drop, 6% narrower at the lip and 10% wider at the foot, sunk
  0.1 m into the pool; columns every 0.25 m, rows every 0.5 m. An automatic sheet whose edge lies within the entry's
  width (+0.35 m) from 1 m behind the lip to 1 m past its landing is left out. `T.fallSets` holds the placed entries
  (kept by map-cache.js with the fall mesh).
- **The fall shader** with pixel water: the 32 grid's texels across the sheet in metres and down it along the water;
  each pixel column its own streaks stepping down at its own speed (1.4-2.7 m/s) over a slow large pattern; four
  tones (the shallow colour to white); a glassy lip with one highlight row; white water at the foot with a broken top
  edge (0.3 m + 9% of the length, at most 1.1 m; a cascade's 0.18 m); a pale veil over the last 1.6 m of a big one;
  the outer columns ragged. Lit mostly grey (the warm sun turned it tan) and kept bright in a cliff's shade. The
  automatic sheets (cascades) use the same code at 0.5 m wide. Pixel water off: the sheet of before.
- **Pool, rock and light** (`walk-shaders.js FALL_GLSL`, `water-data.js setFallUniforms`: the four entries nearest
  you): the water churns white round the foot (a line as wide as the fall) and rings one texel wide spread across the
  plunge pool (every 0.67 m, outward, stepped); the rock beside and under the lip is dark, cool and shiny with
  trickles stepping down in pixel columns; the ground round the foot is wet; the white water's light is a stepped
  shimmer on rock and ground (faint by day, stronger at night). Not a real light (the owner's choice).
- **Spray and mist** (`effects.js`): with pixel water on the 32 grid and in `water.frames` steps. A cascade's mist
  sits out from its step (the automatic sheets carry their direction now), so the cliff no longer cuts it into the
  half-disc WA-6b saw. An entry: spray along its width at the foot (6-24 droplets), droplets off the lip, 3-8 mist
  puffs rising from the pool and drifting with the wind.
- **Wading** (WA-6a's asks): splashes (`walkView.parts` kind `splash`) are the spray's droplets; the wake's rings
  have their own pool (`addWakeRipple`, 4 kept; the shader's 8 slots take up to 3 of them first), so wading no longer
  pushes out the scene's rings. The one call in walk-view.js switched (lane P's file, the owner's yes).
- **Cost**: per frame, the ground and water shaders loop over up to 4 falls (a box test first; nothing when a scene
  has none, `uFallN` 0), the water shader reads the flow map once and its ripple and glint noise twice on running
  water (the two phases); an entry's sheet is (w/0.25) x (h/0.5 + 3) quads (test_water's 6 m: 210 triangles) and
  9-40 effect quads. The headless browser draws in software (0.4-2 s a frame, swinging more between runs than
  between settings): no numbers here. The phone should compare the frame time standing at test_water's tall fall
  with Pixel water on and off, and by a river (the flow map's two phases).
- Not in WA-2a: the Surf mount's wake (`prop-look.js rideMountItem`, lane P) still uses `addRipple`; the climb's
  spray on the rider (WA-6b's ask); look-water's numbers count only the automatic sheets (`fallSheets`), not entries.

## WA-5a notes (2026-10-25)
- The owner's answers: all six kinds; WA-6a's "shallows for others" taken here; small hooks in lane P's files allowed
  (lane P has no round-3 session; the rules live in lane G modules); hot springs about one run in two.
- **Kinds and their play** (`logic/water-kinds.js`): the list above; `wading.js` and `surf.js` read the play table
  (`WADE_SHUT_KINDS` is now lava, rapids and ice for wading; ice is walked on instead); `wadeSpeed(depth, kind)`
  takes the marsh's and the bog's slow (`walk-view.js wadeSpeedHere`); fishing fishes a new kind as its look; the data
  check, the map and biome schemas and the Studio's water painter know the six.
- **Placed** (`water-gen.js waterGenKinds`, one call after `waterGenFalls`; `waterGenReeds` on the finished scene;
  MAPGEN_VERSION 17): rapids rectangles over a river's steep stretches (WA-3a's `rapids`), clear of roads, bridges
  and jetties by 2 m; a hot spring on 8% of routes (never a town), a round pool of shallows 1.2-1.7 m in radius
  2-7 m off the road's middle, 3 m from other water, placed as a plunge pool (it cuts nothing off); a marsh biome's
  pond a bog 40% of the time; a dry place's pond an oasis (badlands, canyon: no run biome is dry, so not in runs yet);
  a cave's water cave water (a whole-map rectangle under the rest); a reed or two in a marsh hides an item (`hide`:
  potion, trail mix, pretzel, hi-potion, burn salve, nerve tonic, revive).
- **Play** (`logic/water-play.js`): stepping into a hot spring with someone hurt heals the whole team, once a run
  (`saveData.flags.hotspring`, a run's own copy); passing within 0.9 m of a hiding reed gives its item once a run (its
  flag in world metres, so a reed seen across a seam is one find); a run place with marsh or bog water weights its
  wild odds by type (marsh Water and Grass 1.8; bog Ground 2, Water 1.5, Grass 1.3: the game has no Bug or Poison),
  through the place's row (`marsh`, set by `run-world.js`) in `rules.js spawn`.
- **Shallows for others**: boulders, rocks and flat stones (`WATERGEN_SHALLOW_PROP`) and folk spots may stand in
  shallows you wade (`waterGenShallows`: not lava, rapids, ice or a hot spring), never in deep water; wild Billies
  may wait in shallows inside a grass patch (2 m further in a marsh), never in a hot spring (`walk-view.js
  encounterCandidates`). Route trainers stand where `route-trainers.js` puts them (unchanged: it never checks water).
- **Weather on water** (`logic/water-weather.js`, run places only): snow lays `ice` rectangles over still water (a
  stream's line keeps flowing); a storm floods the cells beside floodable water and runs a river's middle deep, never
  a road surface or the cells beside it, a door, the hub, an exit or a bridge's end, checked with `mapgenUnreachable`
  (dry water) and held back 4 m from the road, then left out, when it would cut an exit off; a kept dry copy so the
  next day starts from the scene as made. `run-world.js runWaterWeatherSync` lays it when the world is put in and on
  each new run day (the walk frame asks; nothing to do on the same day), then remakes the views and the walk view.
- Numbers: 200 run-like routes over eight biomes: 18 hot springs (9%), rapids on 32, 10 bogs, 10 oases, 20 cave
  scenes, finds in 40; every exit reached, no generator note; about 45 ms a scene in Node (unchanged within noise). A
  storm on 93 wet routes: 90 flood (135 more water cells on average), none cuts an exit off, 6 ms a place; snow
  freezes 28 (the ponds). In the page (the run fixture, a forced forecast, a seam walked): the debug log's `water by
  the weather` line, flooded and frozen places, 239 of 240 ice cells walkable in a frozen town (a prop on the last).
- Not done here: the new kinds' looks (WA-5b), reef shallows on a coast (WA-4's coast; the kind and its rules are in),
  the slip on ice (TR-10), rain rings that skip ice and lava (lane R), the flood's look on raised banks (lane R).

## WA-4 notes (2026-10-25)
- The owner's answers: test_island gets a coast to picture (two sea rocks, a sandbar, a reef shelf, a wet flat with two
  tide pools, all north and west of the town; `tools/build-test-island.py`); a subtle tide; reef shallows by depth
  until the `reef` kind is drawn (WA-5b); the tide on Copperleaf too (its look only, its data untouched).
- Everything new is drawn with pixel water on; pixel water off keeps the look of before (the tide has its own switch).
- **The tide** (`walk/sea-tide.js`, new, Node-tested): read from the tiles on a scene with the sea all round
  (`flatFar`). Wet sand (`S`) joined to the sea is covered at high tide (sandbars and flats too); the open sea's
  shallows (`w`) touching dry land go dry at low tide; sea water joined neither to the map's edge nor to deep water is
  a tide pool (kept at low tide, calm, brimming at the high tide's skin). Two highs a day at 9:00 and 21:00 (a 12-hour
  cycle, so a day repeats and midnight never jumps). The shore texture carries the high and low water's lines in
  green and blue (RGBA when the scene has a tide, R8 as before otherwise); `TIDE_GLSL tideSF` moves the waterline
  between them. The covered sand gets a skin of sea 3 cm over the ground, reaching half a metre past it so the rounded
  line never stops at a tile's edge; the sea's own corners beside it rise to meet it. The shallows the low tide leaves
  draw as wet sand on the water's own surface (the bed under water lies low between steep banks: shown, it read as a
  trench); the sand below the high water's line stays darker, drying as the tide goes out. Setting `water.tide` (on).
  Not moved: the water's level (only the line moves, so the skirt and the scene's sea stay level with each other).
- **Surf** in hard stepped bands: a white crest on each wave's shore side, a broken lace trailing out to sea, the
  crest thickening as the water shallows, white water washing at the waterline (it follows the tide's line); nothing
  depth-driven over the flooded sand (the skin's depth is 0: it drew triangles).
- **Foam round sea rocks**: the rock foam the ponds had (`rockFoam`), reaching 1.4 m in the sea, drawn as a white
  collar that swells and shrinks with the swell and rings stepping out from it.
- **Reef shallows** (by depth): the mesh carries the sea's wadeable shallows below the kind's index (`kind - 0.45 *
  share`; a cove's calm and a tide pool ride above it), matched on the skirt's first ring and fading over its ramp.
  The shader turns those and the sea near the shore a clear turquoise, the bed's light stronger. The depth itself is
  unchanged (the surf's phase and the walk read it). Coral patches wait for the `reef` kind (WA-5b): today a `reef`
  rectangle draws as the scene's default kind (`waterKindLookup` knows only the nine looks).
- **Kelp**: dark fronds just under the surface at middle depth, out of the reef's shallows, in about 45% of 2.6 m
  cells, three fronds swaying in steps; laid partly over the reflection (else the sky's mirror hid them).
- **The sun's path** (by night the moon's: the light's direction then is the moon's): the swell's facets that mirror
  the light, a soft smooth glow under hard sparkling pixels that come and go in steps, kept bright enough at night.
- **The storm sea**: the weather's storm (`environment.storm`, eased; a run's forecast drives it) in `uTide.y`: a
  swell 3.5 times as strong, a heave of up to 0.2 m out where it is deep (only up: dipping, the ground at the scene's
  border showed through; fading past the scene's edge, so the skirt's widening rings never show it; its clock in
  `uTide.w`, the frame's seconds wrapped on whole turns of the swell), more whitecaps further in, more and wider
  surf bands, a darker and greyer sea.
- The skirt (IS-3, `logic/sea.js` untouched) still meets the scene's sea without a seam: the tide moves only the
  line, the shallows' share is matched on the first ring, the heave is the same formula on both.
- **Cost**: building a scene, the tide's cells 5 ms and the two extra shoreline fields about 88 ms on Copperleaf (190
  x 154 m; Node, in the existing slices); its shore texture 7.5 MB instead of 1.9 (RGBA). Per sea pixel: the shore
  texel read once more for the line (four more for the foam line near the edge, as before), the surf bands, three
  kelp fronds (skipped past 140 m and outside their depth), the path's two noises, the rock foam where a rock is near.
  The headless browser draws in software: no frame times. The phone should compare the frame time on Copperleaf's
  beach with Pixel water on and off, and Tide on and off.

## WA-7 notes (2026-10-26)
- The owner's answers (Plan Mode): `PIXEL_WATER_GLSL` exported from walk-shaders.js by this lane (one word; `npm run
  modules` drops an export nothing imports, so it landed with its first use, the world map's sea); battles turn to face
  nearby water (a small change in battle-3d.js) plus water effects in battle-stage.js; the `lake` biome's battle stage
  (`golf`, though a `lake` stage exists in battleStages.json) only noted, for whoever owns biomes.json.
- **The world map** (world-bowl.js): `BOWL_PIXEL_GLSL` is the shared snippet plus the bowl's grid: the ground pictures'
  16 texels a metre close up, coarser by powers of two further out so a texel stays at least about 2 screen pixels
  (`bwK`), and `bwFix` (a smooth value read at the texel's middle from its screen derivatives, so the shoreline steps
  in whole texels). The sea (`mwater`, `bowlWaterPixel`): five dithered tones from shallow to deep, the waves read per
  texel in stepped time, the light in 4 steps, hard glints, foam bands and a hard line at the land in whole texels, a
  dithered second line; the sky's mirror and its Fresnel mix smooth. A place's own water tiles and the rivers
  stamped in the index (the ground shader): a 3-tone stepped shimmer, foam a line one texel wide (a dithered second)
  along each side of the map's square that meets land. The rivers' lines far out: a hard edge, a paler middle in
  dithered tones. HB-3's lagoon (same program, `uRim`): its foam by the beach and sill, its rim fading into the
  clouds' colour in dithered steps; its falls (`mfallw`): stepped streaks with hard ends, three tones, a hard lip,
  dithered edges and fade. `BOWL_SEA_FAR` left as it was (the pictures showed no clash). The hub's island still has
  no sea (only HB-3's lagoon). Pixel water off runs each shader's old code unchanged.
- **Battles**: `logic/battle-facing.js` (new, Node-tested) tries 16 turns round the middle of the action and keeps the
  one that shows clearly more water (nearer tiles count more; water behind a tree or a house is not counted) when water
  lies within 12 m, never one that puts a fighter, a trainer or the camera in water or off the map; never indoors.
  battle-3d.js turns everything it puts in the scene and the battle camera with it; battle-stage.js works in battle
  space as before. Glints on the water in view and rings round a fighter standing in water (battle-stage.js).
- Found: 20 m (the first reach) was too far: a pond 15-19 m away from the battle camera's 1.6 m is a thin line under
  the depth of field. Even at 12 m, in the headless pictures the run's pond (0.5 m under its banks, reeds round it,
  haze) reads faintly after the turn (208 water tiles in the frame against none before). The phone should judge it;
  if still weak: lift the battle camera a little when it faces water, or count only water at about the fighters' level.
- Pictures: `tools/look-bowl-water.py` (the run's bowl: whole, coast, coast-low, river, river-low, place; the hub's
  island; `--battle`: a battle with water 7-11 m away in clear view and none ahead; each with Pixel water on and off),
  validation/look-water-bowl-before/ and -after/ (not committed). On the hub zoom the lagoon's dither between its
  first two tones reads as scattered dots: the phone should say if it wants fewer tones there.

## WA-5b notes (2026-10-26)
- The owner's answers: the small hooks outside lane R allowed (prop-look.js, frame-items.js, sprites.js, and
  ambient-life.js, which no lane owns); the `reef` kind takes the full turquoise and the sea's own `w` shallows a softer,
  paler one; water life fills the gaps (ducks, frogs that leap in, gulls, jumping fish and bobbing lily pads already
  existed), frogs stay as they are.
- **Kinds as a texture** (`walk/water.js kindTexture`): an RGBA16F texture, a column a kind (its index in
  `WATER_KIND_LOOKS`), six rows (0 deep and scum, 1 shallow, 2 clarity caustics foam ripples, 3 glow murk weed mode,
  4 sea white coral bubbles, 5 the glow's colour), read with `texelFetch` on unit 15 (units 0-14 are taken by the walk
  draws). No cap: a new kind is a new entry in `WATER_KIND_LOOKS`. What a kind does is a flag on its look, not its
  index: `sea` (the swell, the storm's heave, surf, whitecaps, kelp, the sun's path, the tide, the shallows' share),
  `run` (leaves, a rock's full foam), `steam` (2.2 a hot spring), `swim: 0` (no ducks, no frog dives), `white`,
  `bub`, `coral`, `scum`, `glowC`.
- `waterKindLookup` knows the fifteen (it was the nine), so a `reef` or any new kind's rectangle draws as its own kind.
  `WATER_KIND_BASE` (logic/water-kinds.js) is now only what a kind fishes as (fishing.js).
- **The six**: rapids (white water over the whole surface, carried down the flow; WA-3a's `rapids` stretches keep the
  flow map's white water); hot spring (milky turquoise, bubbles opening as one-texel rings, three steam puffs a cell
  and thicker); oasis (clear green over the bed, fish); bog (dark olive water with drifting rafts of brown scum in
  three tones and slow gas bubbles; the first try read as tilled mud); reef (the full turquoise, a clear bed, coral
  clumps in pink, orange, violet and yellow on its shallow bed with their fans' edges swaying in steps, the sea's swell,
  surf and tide, no kelp); cave (deep blue-black, lit from below in its own cyan, little sky in it, its light thrown up
  the walls by it as the sun's shimmer is: `uWGlow`, the brightest glowing kind in the scene).
- **Rain rings** skip lava and ice. **Ducks** swim and frogs dive only where a duck could (not lava, ice, rapids, a hot
  spring): before, the test scene's ducks sat on the ice pool.
- **A storm's flood** (WA-5a's ask: "banks above the water's level"): the flooded cells sat at their bank's ground less
  0.12 m and joined a pond's one level, so the pond rose into a raised slab, each bank edge spilled as a cascade and
  the grass under them was painted as a stream bed. Now they stay out of the pond's level and the cascades, meet the
  water they rose from at its level, the shoreline (and so the grass and the wet rim) is the dry scene's, and they draw
  as pixel-edged standing puddles over the grass: a muddy, see-through film with little sky (depth -1 in the mesh marks
  them). Read from `logic/water-weather.js waterWeatherDry`, nothing changed there.
- **Water life**: a bird (the fx sheet's `bird`, never used before) now and then circles over water deep enough for fish
  near you by day (none indoors, at night or in a storm), dives in with a splash and flies off low; spray bursts round
  you while you climb a waterfall (`P.climb.fall`); steam, splashes and the birds on the 32 grid in `water.frames`
  steps; lotus and duckweed bob as lily pads do, in steps; reeds, cattails and bulrushes bend away as you pass;
  wild Billies waiting in shallows are cut at the waterline (`frame-items.js wadeItemLift`); the Surf mount's wake uses
  the wake's own rings (`addWakeRipple`).
- **Cost** (the headless browser draws in software: no frame times): every water pixel does seven texture fetches for
  its kind instead of uniform reads (a 15 x 6 texture, in the cache); the coral, bubble and white-water passes run
  only on their kinds; the vertex shader's fetch only on a stormy sea. The ground shader adds one uniform to its wall
  shimmer. Building a flooded scene: a mask the size of the water grid. The phone should compare the frame time at
  test_water's hot spring and rapids and on Copperleaf's beach (the reef shallows) with Pixel water on and off, and in
  a run's cave with cave water.

## WA-9 notes (2026-10-26)
- The owner's answers (Plan Mode): "survives a regenerate" means the Generate card's remakes of a draft, with the hand
  water kept in its dials (`params.hand`) and in a scene's `gen` when added (no regenerate of a saved scene: MG-4's);
  a brushed river is an **extra** river; the hub island refuses the whole Kinds of water tool.
- **Found**: MG-4 and TR-7 (regenerate only what was generated, a ground mask, the keep lock) were never built, so
  there was no hand edit that survives a regenerate to copy. The map editor's painter lacked `sea`, `lava` and `ice`
  (its own list; now `WATER_KINDS`). The hub island's water rectangles were free (IS-6a locked only the ground).
- **Generation** (`logic/water-gen.js`, no mapgen.js edit: `mapgenParams` keeps unknown keys and every hook has `G.P`):
  `waterGenHand` checks the dials' hand water (at most 8 rivers and 8 falls, inside the map, known kinds);
  `waterGenHandRivers` (first in `waterGenRiver`) shapes each drawn line through `waterGenShape` (no meanders) and
  `waterGenPaint`; the scene's rivers are a list (`G.rivers`; carve, step with the land, river falls and rapids loop
  over it; `G.river` the first); `waterGenHandFalls` (last in `waterGenFalls`) writes `falls` entries with their pools
  (`waterGenPlungePool`, carve on, refused where it cuts ground off) and replaces a generated fall within 2 m;
  `waterGenClimbs` keeps a hand climb only where WA-2b's rule passes and never adds one to a fall placed without;
  hand kinds are laid last in `waterGenKinds`. A scene without hand water is made exactly as before (unit test, whole
  scenes): **no MAPGEN_VERSION bump** (still 17), rng.test's hash, the run-start snapshot and the golden scenes
  unchanged.
- `waterGenSceneRiver` (the map editor's Carve the bed): the same shaping, painting and carving on a saved scene's
  tiles and heights, its level read from the banks (wet corners filled from the dry ground first); carved again, its
  bed moves 0.12 m at most on test_water.
- **Studio** (`studio/js/water-tools.js`, new; hooks in map-generate.js's From above card and map-editor.js's water
  tool): the Generate card's river brush, waterfall placer and kind painter with an overlay (lines, lips, the way they
  fall, pools, climbs, rectangles), the picked item's fields and what the draft made of it, Look at it; the map
  editor's Rivers and Falls modes and Carve the bed (one undo step each). STUDIO.md, "Water tools".
- Numbers (Node, five seeds of a 112 x 64 m meadow): 64 ms a scene without hand water, 74 ms with one hand river.
- Not done here: a regenerate of a saved scene (MG-4); several rivers joining (a hand river ending in another is a
  `lake` mouth); the hub island's fall (HB-4b).

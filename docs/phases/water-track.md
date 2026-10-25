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
  `pool` the plunge pool's radius (m, 0 none); `k` the water kind at the lip (default `stream`); `climb: 1` when the
  Waterfall field move climbs it. An entry replaces the automatic sheets across its width; steps without one keep
  the automatic sheets (the small cascades).
- **Rivers**: no new key. `streams` stays `[{pts, speed}]` and gains optional `w` (a width per point, m), `src`
  (`spring` | `edge` | `lake`), `mouth` (`sea` | `lake` | `edge` | `pool`) and `rapids` (`[[t0, t1], ...]`, fractions
  along the line). The renderer's flow field reads `pts` and `speed` as now, so a lane G scene draws before lane R
  reads the new fields.
- **Tiles**: `w` (shallow) becomes wadeable (WA-6a); `d` (deep) becomes surfable (WA-6b). A scene's `ride` stays as a
  whole-scene "surf anywhere" for the existing side areas.
- **Kinds**: appended, never reordered (the index is built into a scene's water mesh each time it is built; maps
  name kinds by their key): `rapids`, `hotspring`, `oasis`, `bog`, `reef`, `cave` (WA-5). `swamp` stays the marsh.
  Lava is never entered; ice is walked on (WA-5a, the slip with TR-10's cracking ice).
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
| 1 | WA-1 | R | **Pixel water.** Water, shore and falls on the 32 texels a metre grid; `bands` (a kind's tones, dithered between shallow and deep on the world grid), `frames` (stepped time for ripples, foam, caustics, glints); hard 1-pixel foam lines at the shore; reflections offset by whole pixels; the shared snippet; models in the reflection (check); the `pixel` switch. | look-water before and after (every shot, noon and night), bench Pond station cost, smoke |
| 1 | WA-3a | G | (**done** 2026-10-25, notes below) **Rivers that run downhill.** In `water-gen.js`: fill the dips, flow and its sum on the height grid, a source (spring, edge, lake) to a mouth (sea, lake, edge, a plunge pool), carved banks, wider downstream, meanders on flat ground, rapids on steep stretches; seams match the neighbour's river; joins mapgen's existing water stage and bridges. | unit tests (same seed same river; every cell of a river lower than the one before; mouths reached), the mapgenUnreachable sweep, golden water scene remade on purpose |
| 1 | WA-6a | P | **Wading.** `w` tiles walkable, slower; the player and Billies cut at the waterline; splashes and a wake (`addRipple`); deep `d` still blocks; Studio and quick-check walking checks updated. | unit tests (the walk grid), a walking check in test_water, smoke |
| 2 | WA-2a | R | **Waterfalls drawn.** Each `falls` entry: a curled lip, a sheet of streaks in pixel columns over a slower large pattern, white water at the foot, a churning foam ring and rings on the plunge pool, mist that rises and drifts, wet dark rock beside it, the light it throws; the small automatic sheets the same style; the flow map (a texture of flow and foam) replacing the per-vertex segment search. | look-water (tall-fall, stream-and-falls), bench cost, smoke |
| 2 | WA-2b | G | **Waterfalls placed.** Off terrace and cliff edges where a river meets a drop, in caves (rooms), as a route's set piece; `climb` on some (the Waterfall move's way up); the hub island's fall only with the owner's yes. | unit tests (a fall's lip and foot on its river; its pool reached), sweep |
| 2 | WA-6b | P | **Surf and Waterfall climb.** Riding per cell: walk into `d` with a rider (`rules.ride`) and the Water badge, mount and leave at the shore; the mount's bob, wake and rings; encounters on water (the region's water pool); the Waterfall field move (badge: ask) climbing a `climb` fall. Builds on the contract while WA-2b lands. | unit tests (riding rules, badge), a surf walk check, smoke |
| 3 | WA-4 | R | **The sea and the coast.** Surf as hard stepped bands breaking along the coast, foam round rocks, a slow tide (the waterline and wet sand move, tide pools), reef shallows (turquoise, see-through), kelp, sandbars, a sun and a moon path on the open sea, a storm sea from the forecast. | look-water --scene=test_island, island-shots, smoke |
| 3 | WA-5a | G | **New kinds' play and weather on water.** Hot springs heal the party, oases, marsh and bog slow you (their encounter pools, hidden items in reeds), rapids block, floods in storms keep the main path open, ponds freeze in snow, rain rings (exist). | unit tests (a flooded path keeps the main path open; heal once a run), smoke |
| 3 | WA-7 | B | **World map and battles.** The bowl's rivers and seas in the same tones and steps (the shared snippet); water backdrops on battle stages by a node's biome. | bowl map test, battle stage pictures, smoke |
| 4 | WA-5b | R | **Kinds as a texture and water life.** Kind looks in a small texture (no cap at 9), the new kinds drawn (steam on hot springs, rapids' white water, bog's scum, reef, cave water lit by its own glow); lily pads that bob, reeds that sway, frogs, fish that jump (sprites), birds that dive. | look-water, smoke |
| 4 | WA-9 | G | **Studio tools.** A river brush (source to mouth, regenerates its bed), a waterfall placer (lip, width, pool, climb), a water-kind painter, a live preview; STUDIO.md. | Studio check, a hand-placed fall survives a regenerate |
| 5 | WA-8 | (alone) | **Phone pass, sounds, baseline.** Quality tiers for water (bands, mist, reflections) measured at the bench; the owner's phone frame time; water sound beds (falls by height, rapids, surf, lapping, the plunge pool) with SND-6's mix; the quick-check baseline made again on purpose. | full quick check, the owner's phone |

## Ask me before
- The hub island's waterfall (WA-2b): the island is locked once right.
- Surf's details (WA-6b): which badge (the Water badge, as VISION's side areas), encounters while surfing, whether
  the existing "1.5 m tall Water Billie" rule stays.
- The Waterfall climb's badge (WA-6b).
- The new kinds list before WA-5a (the six above are a proposal).
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

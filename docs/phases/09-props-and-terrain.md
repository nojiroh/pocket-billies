# Phase 09 - Props and terrain (low-poly 32 px/m)

## Goal
My firm art commitments: terrain textures and the airship style (low-poly models textured at 32 px/m). This phase builds that library for the world map, the walkable maps and rooms, the opening city and the ranch. Props that read better flat STAY flat, on purpose.

## Verify first (reviewer figures from alpha 0.4.1; compared by image bytes and data, with pictures of different sizes not comparable pixel by pixel)
- 430 props in 338 groups: 170 flat billboards, 126 "solid" (extruded from a picture), 59 "vol" (volumetric from a picture), 38 buildings with a 3D plan, 37 low-poly models (the `vox` recipes and the airship). The airship is a baked mesh (~5,100 vertices) stored as ~190 KB of base64 JSON.
- 12 "_deep" trees share a byte-identical main picture with their base tree (only back/front layers differ; ~70 placements). Colour families: house_*, townhouse_*, car_*, mailbox_*, lotus_*, iris_*, mushroom_*, crystal_*, tulips_*, flowers_*; seasonal: tree_pine_snow, tree_oak_autumn, tree_blossom. Shape-variant sets with different silhouettes: tallgrass, rocks, bush_round, boulder, apartment a/b/c, streetlamp_b, lantern_b, palm_tree_b, chalet_b and ~17 others. 145 building colour files (_vN) and 8 _pearl files.
- `station` is placed nowhere. Pictures no prop entry names (clock_tower_hm, clock_tower_hh, flag_pole, windmill_blades, wind_sail_flower_blades) may be loaded by code directly.

## Status (2026-10-18)
- Checked: the game's catalogue (game/data/scenery.json `props`) has 429 props after phase 03 removed `station`
  (game/art/scene/props.json is a separate art-side list of 395). Props are drawn at 34 px/m (`ppu`); the ground tiles
  are already 32 px/m (16 px a cell, 2 cells a metre).
- Batch 1 done, waiting for approval: ten props in the new style on the test map `test_props_next`, built by
  tools/build-props-batch1.py (see HANDOFF.md). Trees are a low-poly trunk and branches with flat leaf clumps cut
  from the old picture, in one model; the recipe format, variants and the Studio's model editor grew what that needed.
- Batches 1-4 (2026-10-19): every prop of Copperleaf Town and Route 1 is in the new style and swapped in under its
  own key (tools/build-props-batch1.py to batch4.py, run in order). See HANDOFF.md.
- Batch 10 (2026-10-22): every tree the runs place is a model (tools/build-props-batch10.py): the ridge's pines and
  cypress, the autumn rowan and great autumn oak, and the larch rebuilt to match. Conifers keep their drawn tiers as
  bands (a box clip) centred on a modelled mast and pulled toward the eye (a picture layer's `front`). Task 4 begun:
  the ten `_deep` trees merged into their bases (tools/merge-deep-trees.py). Standing pictures the roguelite still
  shows: the six live rooms' furniture (20 props), the barn, boulder_mossy, campfire, lookout_tower, wind_sail_flower.

- Island track IS-4 (2026-10-22): batch 11's barn is a model (tools/build-props-island.py), with scree, log_mossy and
  stump_mossy, and the island's new props (see HANDOFF.md). Batch 11 left: boulder_mossy, campfire, lookout_tower,
  wind_sail_flower and the six live rooms' 20 furniture props.
- Batch 11 part 1 (2026-10-25): the rooms' 20 furniture props and the generator's campfire, lookout_tower, tent and
  mine_entrance are models (tools/build-props-batch11.py; showcase `test_props_rooms`). wind_sail_flower is placed
  nowhere now. Part 2, the 23 standing pictures the run biomes still place: boulder_mossy; the trees tree_pine_snow
  (and _b, _small), tree_jungle, tree_olive, tree_dead, palm_tree, palm_small; the rocks boulder, boulder_b,
  boulder_snow, boulder_basalt, rocks_basalt, lava_rock, basalt_columns; the cave's stalagmite, stalagmite_b, crystal,
  crystal_purple, crystal_cluster, crystal_spire, cave_house. Flat on purpose (the owner): the 11 ground decals and the
  flat plants, with sunflowers, crops, molehill and roots counted as flat.
- Batch 11 part 2 (2026-10-25): those 23 are models (tools/build-props-batch11b.py; showcase `test_props_biomes`).
  Every standing prop the game flow shows is now a model; what stays a picture is flat on purpose. Batch 11 is done,
  waiting for the owner's phone check. Next in this phase: task 10 (a cheap far version and instancing: the jungle's
  broadleaf trees cost the most draws, see HANDOFF.md), then tasks 3, 5-7, 9 and 11.

## Tasks: scope first
1. List which props the maps, rooms, the opening, the ranch and the world map still use. Delete the unused ones.
2. Define the style references (the airship and the terrain textures) and write a short art-direction note: low-poly shapes, 32 px/m, retro-futuristic solarpunk for the Hollow Earth, cyberpunk for the opening city.

## Tasks: terrain
3. Build a terrain texture library for the biomes (grass, sand, rock, water, snow, jungle, farmland, garden, plus city ground for the opening) at 32 px/m, used by the world map bowl and the walkable maps.

## Tasks: variants and deduplication
4. Merge each `_deep` pair into one prop. Merge colour families into one base prop with palette variants; seasonal versions become variants. Shape-variant sets become one prop with several shapes (shape index or seeded pick); do not merge blindly.
5. Replace the building colour files and pearl files with palette swaps. Introduce a `variants` list (palette, material, season, shape index) starting from the group field. Flat props get colour variants from a masked tint.
6. Verify, then remove, `station` and unused pictures. Report how many entries and files this removes.

## Tasks: models
7. One pipeline: recipe -> baked compact binary mesh (GLB or similar, quantized vertices) sharing one texture atlas at 32 px/m. Replace the base64 JSON format.
8. Rebuild picture-based props as models in order: most-seen props, landmarks, then the long tail. List the props that stay flat and ask me.
9. Build the cyberpunk opening set (tall buildings, neon signs, street furniture, flying cars) in the airship style and the solarpunk Hollow Earth set (garden towers, wind turbines, solar sails, ranch items).
10. Add instancing for repeated props and a cheap far version (LOD). Report draw calls and frame times on a phone before and after. (2026-10-26: moved to phase 20, round R2's models lane.)
11. Delete the picture-extrusion and volumetric code. Make the Studio's Prop builder the single prop editor (3D turntable, variant tools).

## Ask me before
The flat-vs-model list; each batch of visual changes (approve in batches).

## Done when
Terrain textures and the model pipeline are in use, duplicates merged, unused props removed, tag `phase-09-done`.

## First reply
Same four items as phase 01, plus the list of props the new design still needs.

## Testing (phase 13)
Follow docs/TESTING.md: where new tests go, what must pass before the phase ends, and its section for phase 09.

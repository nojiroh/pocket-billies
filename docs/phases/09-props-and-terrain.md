# Phase 09 - Props and terrain (low-poly 32 px/m)

## Goal
My firm art commitments: terrain textures and the airship style (low-poly models textured at 32 px/m). This phase builds that library for the world map, the walkable maps and rooms, the opening city and the ranch. Props that read better flat STAY flat, on purpose.

## Verify first (reviewer figures from alpha 0.4.1; compared by image bytes and data, with pictures of different sizes not comparable pixel by pixel)
- 430 props in 338 groups: 170 flat billboards, 126 "solid" (extruded from a picture), 59 "vol" (volumetric from a picture), 38 buildings with a 3D plan, 37 low-poly models (the `vox` recipes and the airship). The airship is a baked mesh (~5,100 vertices) stored as ~190 KB of base64 JSON.
- 12 "_deep" trees share a byte-identical main picture with their base tree (only back/front layers differ; ~70 placements). Colour families: house_*, townhouse_*, car_*, mailbox_*, lotus_*, iris_*, mushroom_*, crystal_*, tulips_*, flowers_*; seasonal: tree_pine_snow, tree_oak_autumn, tree_blossom. Shape-variant sets with different silhouettes: tallgrass, rocks, bush_round, boulder, apartment a/b/c, streetlamp_b, lantern_b, palm_tree_b, chalet_b and ~17 others. 145 building colour files (_vN) and 8 _pearl files.
- `station` is placed nowhere. Pictures no prop entry names (clock_tower_hm, clock_tower_hh, flag_pole, windmill_blades, wind_sail_flower_blades) may be loaded by code directly.

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
10. Add instancing for repeated props and a cheap far version (LOD). Report draw calls and frame times on a phone before and after.
11. Delete the picture-extrusion and volumetric code. Make the Studio's Prop builder the single prop editor (3D turntable, variant tools).

## Ask me before
The flat-vs-model list; each batch of visual changes (approve in batches).

## Done when
Terrain textures and the model pipeline are in use, duplicates merged, unused props removed, tag `phase-09-done`.

## First reply
Same four items as phase 01, plus the list of props the new design still needs.

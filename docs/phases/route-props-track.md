# Route props track (RP) - more 3D props for the run routes

Branch: track/route-props

The owner asked (2026-10-26) for more 3D props for the routes, researched online. Planned in Plan Mode on 2026-10-26
and approved with the owner's answers below. RP-1 and RP-2 were built on the session's own branch `ccr-5d98165a-i1ustq` (a cloud
session can push only to the branch it was started on; BRANCHES.md); later sessions start on `track/route-props`,
made from it by the owner. Tags `rp-1-done`, `rp-2-done`.

## Verified facts (2026-10-26, main at b87b818d)

- **How a model is made:** a Python recipe of shapes (box, cyl, cone, dome, sphere, barrel, limb, and `img` cut-outs
  from a picture), coloured, with one of the 24 procedural textures at 32 px/m (prop-models.js
  `PROP_MODEL_TEXTURES`, among them wood, stone, metal, hay, corrugated, battens and solar), written to
  `game/art/scene/next/models/<key>.json`. Boxes stand square (no turn); a slanted beam is a 4-sided limb. A new
  prop gets a picture baked from its model (tools/build-props-island.py `bake`), the fallback with 3D props off
  and the far view.
- **The plan's first count was wrong:** of the props the set pieces place, 6 were still pictures, not 16
  (firewood, firewood_b, scrap, statue, tires, tollbooth). stone_wall, crate, crates, barrels, haybale,
  mailbox_red and bollard are already models; rocks_snow and the mushrooms are batch 1's models with a colour
  swap. `fence` is the battle stages' picket fence, not placed on routes. What the biomes still show as pictures
  is flowers, grasses and ground cover, flat on purpose (phase 09).
- **No stream crossing on a route lacks a bridge:** the road's bridges are drawn (`sc.bridges`), and a `bridge`
  spot is a trainer's stand beside one. So the footbridge has no place in today's generator; it is in the
  catalogue and on the showcase map for a later stream feature or a town.
- **A water prop in a piece** must stand on water or the whole piece is not placed; the landing stage needed
  measuring (below).
- **Online sources** (CC0, as references only): Kenney's Nature Kit (330+ models: camping, fences, rocks),
  KayKit Forest, Quaternius's packs and Medieval Village MegaKit, padadu's CC0 voxel farm, the Environmental
  Suburbia pack (a small solar panel, a wind turbine, a vegetable patch: the solarpunk look). Their GLB/FBX meshes
  don't fit the recipe format or the palette. **This container can't reach kenney.nl, opengameart.org,
  quaternius.com or itch.io** (only github.com answers), so the converter test waits for files the owner uploads.

## The owner's answers (2026-10-26)

| Question | Answer |
|---|---|
| Order | All in one go (12a, 12b, 12c in one session, one approval at the end on the test map) |
| Recipes or packs | A mix: recipes for most; a GLB-to-recipe converter tried on 2-3 complex props (the wind turbine, the footbridge, the ruined arch), side by side with the recipes, the owner picks |
| New props | All four groups: crossings and ruins, wayside and farm, solarpunk, the Bureau |
| Shrine | A solarpunk niche: stone, a solar cell on its roof, moss, a glowing seed |
| Phone budget | The same draws as today: the pieces clear the plants under them |
| Branch | A track branch, `track/route-props` |

## Sessions

| # | Session | Goal |
|---|---|---|
| RP-1 | Models and pieces (**done** 2026-10-26) | the 6 set-piece pictures as models; 20 new props; the pieces use them; two new pieces |
| RP-2 | Structures in the props' style (**done** 2026-10-26) | bridges, jetties, rails, arches and tunnels (game/js/structures.js) restyled; wood bridges get a gentle hump. The owner asked after RP-1 |
| RP-3 | The converter test | `tools/glb-to-recipe.py`: a CC0 GLB to a recipe (simplified, our palette, our textures) for the wind turbine, the footbridge and the ruined arch, side by side with RP-1's on the showcase map. Needs the CC0 files uploaded (`validation/cc0-src/`, with a LICENSES.md) |

## RP-1: what was built (tools/build-props-routes.py, rerunnable)

- Swapped in under their own keys: firewood, firewood_b, scrap, statue, tires, tollbooth (its FLAT TAX board is
  the picture's own lettering on the model, as the cottage signs are).
- New, each with a baked picture (`game/art/scene/next/routes/`): footbridge_wood, stile (not solid: you walk
  through it), pier_deck, pillar_broken, arch_ruin (two posts: you walk under it), wall_ruin_corner, milestone,
  waymarker_post, shrine_small, haystack, rain_barrel, water_pump, beehive_stand, tool_shed, veg_patch_frame,
  wind_turbine_small (blades still), solar_post_light and shrine_small (lamps that glow after dark),
  seed_library_box, bureau_barrier, bureau_crate (slate and mustard, no logo).
- Set pieces (setPieces.json): ruins rebuilt round the arch (statue in front, a wall corner, broken columns);
  the farm pen's back fence has a stile, a pump and a haystack outside; the rest stop's lantern is a solar path
  light, with a seed library; the woodcutter has a tool shed; the fishing jetty a landing stage (the rowboat moved
  to the other side, r 5 -> 5.5); the Bureau checkpoint a barrier and an evidence crate. New: `wayside_shrine`
  (shrine, milestone, trail post, roses) and `solar_garden` (turbine, vegetable bed, rain barrel, beehives, seed
  library, path light; farmland plans x2). MAPGEN_VERSION 18.

## RP-2: structures in the props' style (the owner's answers, 2026-10-26)

| Question | Answer |
|---|---|
| Approach | Restyle in structures.js (same renderer; the code that fits any length, width and bank height stays) |
| Scope | Bridges and jetties, rails, arches and tunnels (not the city's escalators) |
| Wood deck | A gentle hump (`BRIDGE_ARCH.wood` 0.12 -> 0.35; walking follows it) |
| Stone | The ruins' cool grey, with a little moss |

Verified facts: the structures already used the props' texture sheet and the buildings' shader; what differed was
their shapes (half-metre deck slabs, posts without caps, smooth parapets) and their colours. Triangles a scene, main
-> RP-2: Copperleaf 1040 -> 2296, test_bridges 1646 -> 3818, test_stairs 1130 -> 1904, test_hilltown 800 -> 1416;
draws the same (one mesh, the same parts).

## Ask me before

1. The Bureau's logo or mark on its props (none yet).
2. Turning the turbine's blades (a spinning part, as the windmill's sails) - costs a draw a turbine each frame.
3. Where the footbridge goes (a stream feature on routes, or towns).

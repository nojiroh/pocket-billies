# Art notes

Creature art preserves the original 70 designs and skeletal part structure.
Parts are rasterized from the existing editable geometry at double density,
with four lighting bands, reduced dithering, clearer eye shapes, restrained
rim light and stronger outline colors. These are new rasterizations, not simple
nearest-neighbor enlargement of the old PNGs.

Trainer art uses a shared code-native pixel renderer, with semantic palettes
and distinct hair/accessory geometry. Default PNGs are exported for inspection;
the game uses cached personalized frames so previews and gameplay stay aligned.

The new scenic image is `game/art/background/sundown.png`, generated with the
built-in image generation tool. Prompt:

> Use case: stylized-concept. Create a beautiful finished pixel-art environment illustration for the existing game Net Worth, a playful creature-collecting walking RPG on the INSIDE of a hollow earth. Asset is a wide 3:2 landscape background without UI or lettering. View from a grassy route above a warm inviting small town with cream houses, teal roofs, a little research lab, golden path, lush sculptural trees, wild flowers, distant lavender mountains. The geography curves UP at the horizon into the inside of a huge sphere, with very distant upside-down land high in the sky and one small warm central sun. Inspired by the adventurous warmth and readable pixel-art environments of Pokemon DS-era games, original world. Professional crisp pixel clusters, 384x256-style logical pixel grid rendered large, strong coherent silhouettes, selective outlines, cel-shaded 4-tone materials, no dithering noise, no photorealism, no smooth painterly brushwork. Rich mint, turquoise, sunflower gold, lavender shadows. Interesting foreground grass corners frame the view. Central path flows toward town. Welcoming slice-of-life feel, very high quality. No people, no creatures, no text, no logos, no border.

## Version 7

Your v6 art is unchanged pixel for pixel. The PNGs were losslessly recompressed: alpha
and every visible pixel are identical, and only the stored color of fully transparent
pixels may differ. `background/sundown.webp` is a 1280-pixel web copy of `sundown.png`,
used by the menus. Rebuild it from the Studio's Art files section after replacing the
PNG.

New interface icons are in `ui/` (12×12 masks). The app icons are in `app/`. The new
shopkeepers are drawn by the shared trainer renderer from looks in the game data, so
they have no image files. Edit them in the Studio's People section.

Billionaire sheets can be edited in the Studio. (Studio track ST-0, 2026-10-19: the Gold-Plated sheets are gone.
A coat, game/data/coats.json, recolours a sheet as it is drawn: whole palette ramps swapped step for step, then exact
colours, or a hand-painted sheet at `art/next/coats/<species>_<coat>[_back].png`. The notes below about gold sheets
are history.)

## Version 8

No art changed. The Studio can now change three more things, all saved into `game/art`:

- `map/world.png`, from World & encounters → Map art. The trail colors it looks for are
  `#8A6A3E` (trail), `#E2C48A` (markings) and `#F0E6C8` (path ahead). Add more under
  "Trail and patches" if you paint the trail in other colors.
- Billionaire sheets, from the skeleton builder. New parts are added in a strip at the
  bottom of the sheet, in the normal and Gold-Plated sheets at the same place.
- Blank bodies are drawn by the Studio as shaded ellipses with a dark outline, a simple
  face on the front view. Their Gold-Plated sheets are drawn the same way in gold.

## Version 9

- `scene/props/*.png`: 47 new props for the walk scenes, drawn in the style of the battle props
  (34 pixels per meter, outlines in a dark plum, light from the top-left), and
  `scene/props.json` with their names, base points, shadows and sway. `scene/tiles/*.png`: 16
  seamless 16×16 ground tiles. They were drawn by `tools/build-scene-props.py` and
  `tools/build-scene-tiles.py`; edit them in the Studio under Walk scenes.
- `icons/icons.png` gained a row: pictures for the renamed items (potions, salve, tonic, tea,
  revives, stone, trail mix, pretzel, remedy) and particles for the new types (leaf, pebble,
  feather, cog, scale). `tools/add-icons-v9.py` adds them; the existing icons are unchanged.
- No billionaire, trainer, battle or map art changed.

## Version 10

- `scene/props/*.png`: 64 more props, mostly variants of the v9 ones (three more oaks including an
  autumn one, pines, birches, a blossom tree, a second fruit tree, bushes, five flower beds, cottages
  in blue, green and thatch and a large house, rail fences and posts, barrels, sacks, a bench,
  flowerpots, a mailbox, shop and clinic signs, planters, lamps, a market cart, a fountain, a
  windmill tower and separate blades, cattails and lily flowers, crystals, stalagmites, cacti and dry
  bushes). Same style and scale as v9 (34 px per meter). `scene/props.json` now also records each
  prop's variant group, solid footprint, door, light and smoke points.
- `scene/far/*.png`: eight 640×120 seamless distant layers (hills, forest, mountains, canyon, cave,
  mall, town, farm), listed in `scene/far.json`.
- `scene/fx/*.png`: small animated sprites (butterfly, bird, leaf, smoke, spray, sparkle), listed in
  `scene/fx.json`.
- `map/world.png`: the painted trail was redrawn along the new roads, with patches for Willow Pond,
  Hillside Farm and Lookout Ridge (`tools/repaint-world-trails.py --patches`).
- `battle/props/*`: battle stages place more of the existing props (`tools/build-battle-props.py`).
- No billionaire or trainer art changed.

## Version 11

- `ui/profile.svg`: a pixel ID-card icon for the Trainer tab, in the style of the other UI icons.
- The sky islands are no longer used anywhere (menus, loading screen, walk scenes). Their files stay
  in `background/` in case you want them back.
- No other art changed. The 3D look (shading, shadows, reflections, grass blades) is computed from
  the existing pixel art at load time.

## Version 13

- **Prop layers.** A prop in `scenery.props` can list extra pictures in `layers`:
  `{"img":"scene/props/house_layer1.png","dz":-0.3,"dx":0,"dy":0,"face":"fixed","glow":0,"sway":1}`.
  `dz` is meters behind the main picture (negative: in front), `dx`/`dy` shift it right and up in
  pixels, `ox`/`oy` give it its own base point if its canvas differs from the main picture's.
  `face` is empty (faces the camera), `fixed` (stays put as the camera turns) or `flat` (lies on the
  ground). `glow` makes it light itself. The main picture can use `"face":"fixed"` too.
  Effects (`fx`), the glow, the door, labels and the building shadow stay with the main picture.
- New pixel icons in `art/ui/`: `house`, `lock`, `flag`, `leaf`, `list`, `globe` (12×12, same
  style as the others), used by the map pins and buttons.
- Nothing in the existing art was changed or split; layers are added in the Studio's prop editor.

## Version 14

- **Trainers are new art.** `art/trainer/body.png` (+ `body_m.png`) holds the body pieces; each
  wardrobe item has `art/trainer/items/<id>.png` and a colour-area mask `<id>_m.png` (red, green
  and blue mark areas 1, 2 and 3, recoloured by keeping each pixel's shading). The pieces were
  drawn by code (`tools/trainer_gen/`, `tools/build-trainer-art.py`): 116 px tall standing figures,
  about 3.4 heads, with front, back and side views, outlines, three-to-four tone shading, folds,
  seams and expression variants of eyes, brows and mouths. The old trainer renderer and its PNGs
  are no longer used. Edit pieces in the Studio's Wardrobe section; `build-trainer-art.py` without
  `--force` never overwrites them.
- The data is `wardrobe` in `data/gamedata.js`: `skeleton` (joints per view), `body`, `slots`,
  `sliders`, `palettes`, `crops` (thumbnail and portrait frames) and `items`. A piece is
  `{"v":"front","b":"head","r":[x,y,w,h],"o":[ox,oy],"z":0.7,"x":"happy"}`: view, bone, its
  rectangle in the item's picture, its offset from the joint, an optional layer and an optional
  expression (`blink`, `happy`, `surprised`, `sad`, `angry`, `talk`). When a face makes an
  expression, an item that has pieces for it shows those instead of its normal ones.
- People keep a `look` (`name`, `body` sliders, `skin`, `hair`, `eyes`, `wear` per slot, `colors`
  per item). Old looks without `wear` are converted when loaded.
- Round and square glasses were redrawn with bigger frames and a glint so they don't read as
  sunglasses.
- `art/map/world_h.png`: the land's height for the world map's mountains, made from `world.png` by
  `tools/build-world-relief.py` (sea 0, coasts low, meadows rolling, forests and sand uplands as
  hills, snow highest, plus ridged noise).
- `art/scene/props/layers/<tree>_back.png` and `_front.png`: the "deep" trees' canopy layers, cut
  from the existing tree pictures by `tools/build-prop-layers.py` (the original tree PNGs are
  unchanged; the deep trees are new props that use them).

## Version 15

- No pictures changed. Props have an optional `"mat"` in `scenery.props` (`plain`, `foliage`, `wood`,
  `stone`, `metal`, `building`, `cloth`, `crystal`); without it the material is guessed from the
  prop's name. Normal maps are still made by the game from each picture; the material decides how
  rounded they are and how much the pixels' own brightness adds bumps.
- A prop's `face` now defaults to staying put in the world. `"billboard"` makes a picture turn to
  face the camera as before; `"fixed"` (from v13) still means stays put; `"flat"` lies on the ground.

## Version 16

- No new image files. Buildings' side walls and roof tops are made at run time from each building
  picture (the wall colour just inside its left and right edges, the roof colour at the eaves).
- Blake (`people.chad`) has a wardrobe look: spiky blond hair, orange tank top, track jacket and
  pants, runners and a headset.
- There are no audio files: songs are defined in `game/js/sound.js` (`SONGS`: key, tempo, scale,
  chord progression and style; the melody is composed from a seed) and effects are synth recipes.

## Version 17

All existing pictures are unchanged. New files only:
- `scene/tiles/asphalt|pavers|bricks|gravel|dirt|forest|steps|lawn.png` and `<tile>_1…_5.png` for
  every ground type: variants drawn in each tile's own colours (cracks, pebbles, clover, puddles,
  moss, knots…). The tile generator never overwrites a tile unless asked with `--force`.
- `scene/props/*.png`: 56 new props (see the README), drawn by `tools/scene_props_v17.py` in the same
  style as the v10 props (1-pixel outlines, 5-tone ramps lit from the top left, 34 px per metre).
- `scene/props/layers/<prop>_lb.png` and `<prop>_lf.png`: back and front crowns for every tree and
  bush, cut from the props' own pictures (the back one grown two pixels and darkened, the front one
  the sunlit clumps with their own dark edge).
- `scene/build/detail.png`: 16 tileable wall and roof textures stored as five shade levels; the game
  colours them with each building's colours through the same 5-tone ramp the props use.
- `scene/build/rooms.png`: eight little rooms (living room, kitchen, bedroom, shop, office, clinic,
  lab, stairs), each a back wall, side wall, floor and ceiling.
- `scene/life/*.png`: frame strips for ducks, pigeons, chickens, sheep and four cars (side, front and
  back views).
- `map/world.png`: the stop patches moved with their stops, a new city patch and repainted trails
  (the version 16 map is kept as `tools/backup/world_v16.png`), and `map/world_h.png` rebuilt from it.

## Version 18

All existing pictures are unchanged. One new file:
- `scene/build/walls.png`: the faces of cliffs, terraces, stair risers and ravines, a 4 × 3 atlas of
  64 px cells (one cell covers 2 m of wall, so about 32 px per metre, close to the props' 34). Left to
  right, top to bottom: rock (the scene's own default), rock, layered sandstone, cave rock, brick,
  dressed stone, hedge, wooden boards, stone stair risers, mossy rock, concrete, dark slate. Each cell
  tiles seamlessly and is stored as five grey levels (0, 64, 128, 191, 255); the game colours each
  level through the props' 5-tone ramp in the face's colour (set per scene in `wallCol`, or the
  defaults in `walk/heights.js`), so one drawing serves every biome. Repaint it in any editor that keeps
  those five greys; `tools/build-walls.py --force` redraws the original. The scenery catalog points to
  it as `wallArt`.
- Bridges, railings, arches and escalators are models made at run time; they use the 3D buildings'
  `detail.png` textures (planks, stone, metal seams, slate) in their own colours.

## Version 19

No new image files. Props get solid bodies made at run time from their own pictures (`game/js/solid-props.js`):
- The front (and the back, seen from behind) is the picture itself; the edges of slabs and blocks take the
  colour one pixel inside the outline, so keep the 1-pixel dark outline: it is what tells the body's edge
  colour apart. A shape only one pixel thick uses its outline colour.
- Turned (lathe) props are read row by row: each row's width becomes a ring. Draw them centred and
  symmetric, seen from the front; a top drawn in three-quarter view becomes part of the rings.
- Rounded props bulge by their distance from the outline, so a wide part bulges more than a thin one.
- A prop's shape can be set in the Studio (Props → prop editor → Solid shape) or in the scenery catalog
  as `vol` (`card`, `slab`, `block`, `puff`, `lathe`) and `volDepth` in metres.

## Version 24

- `map/world.png`: the known world stretched around Sundown (1.6× east-west over the half the journey crosses,
  1.4× north-south between the 50th parallels; the far side and the ice caps squeezed to make room), then the
  new areas painted on it: the island of Tax Haven with Mount Margin Call, sandbars along the sea lane, a chain
  of snowy peaks around Bull Run Pass and Summit Capital, and Liquidity Lake (`tools/build-world-v24.py
  stretch|biomes`). Trails were repainted, with dotted lanes for water crossings
  (`tools/repaint-world-trails.py`), and `map/world_h.png` rebuilt with rock, volcanic slopes and lava standing
  high (`tools/build-world-relief.py`). The v23 map is kept as `tools/backup/world_v23.png`.
- `map/mini/<scene>.png`: a miniature of every stop's walk scene for the world map, drawn by the game's renderer
  and cut out with a slice of earth underneath (`tools/build-map-minis.py`; run it again after editing a scene).
- `scene/props/`: palms, villa, lighthouse, buoy, beach umbrella, deck chair, sailboat, shells, snowy pines,
  chalets, snowman, snowy rocks and boulder, trail sign, charred tree, basalt rocks, boulder and columns,
  obsidian, steam vent, lava rock and vent, danger sign (`tools/scene_props_v24.py`, loaded by
  `tools/build-scene-props.py`, which only writes missing files). `scene/far/volcano.png` and `scene/far/sea.png`.
- `scene/tiles/ash*.png`, `scene/tiles/basalt*.png`: volcanic ground (`tools/build-scene-tiles.py`).
- `battle/beach_*`, `battle/volcano_*`, `battle/snow_*`, `battle/far_snow.png`, `battle/far_volcano.png`,
  `battle/far_sea.png`: classic battle backdrops for the new places, recoloured from the sand, cave and grass ones.
- `ui/drop.svg`, `ui/fish.svg`, `ui/camera.svg`, `ui/boat.svg`: new interface icons.

## Version 25

- `billionaires/yacht*`, `gill*`, `carp*`, `shellco*`, `magma*`, `alpaca*` (each with `_back`, `_gold`,
  `_back_gold`): six new lines drawn from their designs in `tools/src/design.js` by `tools/build-art-species.py`,
  which writes only the species you name and merges their skeletons into `rigs.js`.

## Version 26

- `scene/props/`: furniture for the rooms you walk into: shop counter, reception desk, shelves of goods, drinks
  fridge, clinic bed, privacy screen, bookcase, desk with a computer, the lab's evolution machine, round table,
  wooden chair, sofa, fireplace, tall potted plant, round and runner rugs, crate of goods, and three things that
  hang on the back wall (a painting, a clock, a window; their pictures keep the empty space below them so they
  hang at the right height). Drawn by `tools/scene_props_v26.py`, loaded by `tools/build-scene-props.py`, which
  only writes files that don't exist yet.
- `ui/sun.svg`, `moon.svg`, `cloud.svg`, `rain.svg`, `snow.svg`, `fog.svg`, `ash.svg`, `door.svg`: icons for the
  hour and the weather on the walk card, and for going outside (`tools/build-ui-icons-v26.py`, new files only).
- No picture changes for night, weather or seasons: the renderer does those from the existing art (autumn
  colour, spring green and winter frost on leaves and grass, snow settling on whatever faces up).

## Version 27

- `scene/life/rabbit.png`, `squirrel.png`, `frog.png`, `gull.png`, `goat.png`, `cat.png`, `crab.png`, `lizard.png`:
  frame strips for the new animals, all facing left like the duck (the game mirrors them): standing, two moving
  frames and (where there is one) grazing, nibbling, loafing or flying (`tools/scene_props_v27.py`, loaded by
  `tools/build-scene-props.py`, which only writes files that don't exist yet).
- `scene/fx/print.png`: a footprint and a paw print seen from above, pale so the ground colour tints them.

## Version 28

- `scene/props/ladder.png`: a wooden ladder with rope lashings, scaled in each scene to the cliff it leans on
  (`tools/scene_props_v28.py`, new files only).
- Gold stamps, the eyes in the grass and photo mode use the existing sparkle and glow effects; no new pictures.

## Version 31

No picture files were changed or added; your art is untouched.
- The new districts and route stretches use existing props and ground tiles (`tools/build-v31.py` adds them to
  the scenes in `game/data/gamedata.js`).
- Wall lamps, the window light patch, the light shaft, the glass tint at night and the room's front wall are drawn
  by the renderer from tiny pictures it makes itself (a few pixels each), so there is nothing to edit in `art/`.
- The map miniatures in `art/map/mini/` still show the scenes as they were; `python3 tools/build-map-minis.py
  sundown taxhaven summit` (and any route) redraws them, replacing those files.

## Version 32

No existing picture was changed; your art is untouched.
- Ten new prop pictures in `scene/props/`, each put together from existing prop pictures by
  `tools/build-prop-variants-v32.py` (it never writes over a file that's there, and only adds catalog entries that
  are missing): `barrels`, `haybale_stack`, `stump_mossy`, `log_mossy`, `mushroom_ring`, `flowers_meadow`, `rocks_c`,
  `crate_stack`, `cactus_pair`, `firewood_b`. The mossy stump and log are painted over copies of `stump.png` and
  `log.png` (only the colour changes; the light and dark in your pixels stay). Edit or replace them like any other
  prop picture.
- Wear and tear (dirt streaks, moss, faded paint, cracks), the tint, prop variety, wood grain, stone grit and the
  tops of solid props are all worked out by the renderer from your pictures as they're drawn, so there is nothing
  extra to edit in `art/`.
- The 3D map miniatures are built from each scene's ground, buildings and trees, so `art/map/mini/` is only used when
  Engine → World → *3D miniatures on the map* is off.
- The beehive picture (`beehive.png`) has its lid drawn floating a few pixels above the box. It's left as you have
  it; close the gap in the Studio if that isn't intended.

## Version 33

No picture files were changed or added.
- Billionaires out in the world (the wild ones in the grass, your buddy, trainers' companions) are drawn from the same
  rig pictures as in battle (`billionaires/*.png`), so editing a billionaire in the Studio changes it everywhere.
- Alphas are the normal billionaire drawn bigger, with a glow and red sparks made by the renderer; there's no separate
  Alpha art.
- Nameplates, rings and aim markers in battles are drawn by the game; ink outlines and sun glare are part of the
  renderer's final pass.

## Version 34

New picture files only; no existing picture was changed.
- `art/hd/<same path>.png`: a 2x copy of every picture in `scene/props`, `scene/props/layers`, `scene/tiles`,
  `scene/life` and `battle/props` (475 pictures), made by `tools/build-hd-art.py` from the originals. The game measures
  everything (sizes, anchors, hit areas, building cut-outs) by the original and only swaps in the 2x picture when it
  draws, so nothing moves. A 2x copy whose size no longer matches twice its original is ignored.
- `art/hd/palette.png`: the shared master palette (128 colours taken from all the art). Delete it to have the tool
  take a fresh one.
- `art/hd/made.json`: what the tool made last time (a fingerprint of each original and of its 2x copy). A 2x copy that
  differs from what the tool made is treated as painted by hand and kept.
- `data/hdart.js`: the list of 2x pictures (generated; edit the pictures, not the list).
- You can paint over any 2x picture by hand in the Studio or any editor: it is then kept, even when its original
  changes. To redo one from its original: `python3 tools/build-hd-art.py --only scene/props/crate.png --force`.
- Billionaire walk cycles are poses of the existing rigs (`skeleton-rig.js` walk pose, per body plan in `body-plan-animation.js`): no new
  billionaire pictures, and no side views.

## Version 35

New files only, all under `art/next/` (the game doesn't load them yet):
- `palette.png`, `palette-big.png`, `palette.js`: the master palette (`tools/build-palette.py`).
- `tiles/master/<terrain>.png`: 26 master tiles at 32×32; `tiles/<terrain>_1..6.png` variants; `tiles/edge/<terrain>_<n>.png`
  edge masks; `tiles/tiles.json`. Made by `tools/build-tiles.py`; a master you repaint is kept (`--force` remakes it).
- `starters/<id>.png` and `<id>_sil.png`: blocked colour studies and 24 px silhouettes of the 12 starter species.
- Piece sheets for the new billionaires go in `art/next/billionaires/<id>.png` with `<id>.json` (see STYLE-GUIDE.md §7).

## alpha 0.4

New files only; a picture you repaint is kept (each tool writes only what is missing; `--force` makes its own again).
Props are still 34 px a metre (`scenery.ppu`); the building sheet and everything painted from it are 32 px a metre.

- **Copperleaf** (`tools/build-props-a04.py`): `scene/props/cottage_moss.png`, `cottage_solar.png` (and their colour
  variants `_v1`…), `cottage_juniper.png`, `wind_sail_flower.png` with its turning petals `wind_sail_flower_blades.png`,
  `banner_bunting.png`, `sky_lift.png`; the great oak's swing `scene/props/layers/tree_giant_swing.png`; the moss and
  solar-shingle roof textures, cells 16 and 17 of `scene/build/detail-a04.png`.
- **The airship** (`tools/build-airship.py`): the mast and its airship as a low-poly model, `scene/models/airship_mast.json`
  (positions, normals, texture coordinates, the sheet's cell and the colour of every corner, packed; the two propellers
  as parts that turn). Its picture `scene/props/airship_mast.png` and the map's `map/airship.png` are rendered
  from the model by the tool. `scene/build/detail-a04b.png` is the building sheet with four more cells: balloon cloth
  (18), rivets (19), stripes (20) and a cut log's rings (21). `--views out.png` draws the model from four sides.
- **Props made of shapes** (the voxel recipes in `scene/vox/`) are drawn low-poly in the game, painted from that sheet:
  wood is planks, stone is stone blocks, hay is thatch, leaves are moss, metal is metal seams, cloth is balloon cloth,
  rust is rivets, stripes and rings their own cells. The recipes did not change.
- **The solarpunk kit** (`tools/build-solarpunk.py`): `solar_tree.png`, `vertical_garden.png`, `solar_canopy.png`,
  `heat_dome.png` (its glass is mixed with what grows inside, no soft alpha), `floating_solar.png` (lies flat on the
  water), `light_pipe.png`. Roofs: a building prop's `roof` ('moss', 'solar', 'chrome') changes its 3D roof's texture
  and colour; its picture is untouched.
- **Pearlantis** (`tools/build-pearlantis.py`): `pearl_tower.png`, `bubble_tram.png`, `mirror_shaft.png` (its shaft of
  light is soft alpha, drawn by the tool above the dish: a glow), `glass_lift.png`, `pearl_lamp.png`, and pearl-and-chrome
  colours of six building kinds as new variants (`villa_pearl.png`, `office_tower_pearl.png`, `apartment_a_pearl.png`,
  `mansion_pearl.png`, `shop_boutique_pearl.png`, `clinic_pearl.png`), appended to each kind's variants.
- **Postcards** (`tools/build-postcards.py`): `postcards/<scene>.webp`, 480×320, the town drawn by the game's own
  renderer at its hour, with nothing tall in front. The lettering and the stamp are laid over them by the game.
- **Fire**: `scene/fx/flame.png`, four hand-drawn frames of 12×18 (looped with a little variation above every fire).
- **Tall props in 3D** (`tools/build-landmarks-3d.py`): 45 landmarks and tall props get a body from their own picture
  (`vol`: block, lathe, puff or slab, `volDepth` in metres); no picture changed.

## Version 47
Everything new is in new files, and no picture was changed except the map miniatures, which were redrawn (the old
ones are kept in `retired/map-mini-v46/`). The tools below only write what's missing
(`--force` redraws), and they draw with the scene-prop kit: dark coloured outlines, lit from the top left, 34 px to
the metre for props and 32 px to the metre for the ground.

### Part 1: the ground
- **Ground** (`tools/build-terrain-v47.py`, retired in SA-2a: the tiles are painted in the Studio, tools/art-source/terrain-v47): 78 kinds (the 38 from before, 22 new and part 4's 18 room floors), each
  with twelve 32 px tiles in `art/next/tiles47/<name>_1..12.png`
  (the v46 set in `art/next/tiles/` is untouched). `_1`, `_7`, `_8` plain; `_2`–`_6` and `_10` details; `_9` the damp
  patch in the kind's own colours; `_11`, `_12` worn (fewer details: the painter lays the trodden track itself). The
  soft light and shade are laid by the painter in world metres, not drawn in the tiles. The new kinds also get 16 px
  tiles (`scene/tiles/<name>.png` and `_1`–`_5`) for the Studio. `--preview --sheet out.png` shows them.

### Part 2: the opening
- **The loading screen** (`tools/build-loader-v47.py`): the runner and the coins, as data in `css/loader.css` and as
  pictures in `art/ui/`.

### Part 3: a living world
- **Landmarks and chalk** (`tools/build-landmarks-v47.py`): `clock_tower` (with `clock_tower_hh` / `_hm`, the hands the
  game turns), `tree_giant`, `tree_willow_lean`, `crane`, `neon_sign` (and its lit layer), `lookout_tower`, `shipwreck`,
  `waystone`, `golden_cushion`, `lighthouse_small`, `bridge_broken`, `chalk_hopscotch`, `chalk_sun`. A landmark has
  `landmark: 1` in the catalogue, so the camera looks up at it.
- **Small life** (`tools/build-fx-v47.py`): `scene/fx/bee.png`, `fish.png`, `moth.png` and `scene/life/crow.png`.

### Part 4: the seven regions
- **Region props** (`tools/build-region-props-v47.py`, 52): the Meadowlands (`tree_mangrove festival_stage stall_merch
  billboard_tour portaloo_vip sunflower_giant tree_blossom_great stilt_hut`), Golden Hills (`vineyard_row vault_door_hill
  statue_goldbull tollbooth salt_pile bear_rock mine_headframe minecart`), Spore Forest (`mushroom_house
  mushroom_colossal treehouse spore_mill tree_giant_autumn tree_jungle jungle_fern unicorn_statue`), Crystal Caverns
  (`crystal_cluster crystal_cluster_violet ice_spikes crystal_spire geode_great needle_works crystal_beacon
  ice_block_safe mine_entrance`), Coral Trench (`yacht_super yacht_small coral_tower shell_company kelp_tall
  pressing_plant record_crates`), Cloud Spire (`spire_tower night_stall server_rack solar_panel cloud_server
  ferris_wheel carousel_broken bubble_gate penthouse_gate`) and the Inner Sun (`ticker_column closing_bell sun_press`).
  The big trees have leaf layers in `scene/props/layers/`. The hillside vault door is `vault_door_hill`; `vault_door`
  is still the bank's, inside.
- **Room floors:** eighteen new indoor kinds (`vinylcheck labfloor oakboards marblecheck herringbone linoleum granite
  epoxy strawfloor brickfloor pineboards hextiles`, and for the region towns' shops `paintedboards goldterrazzo
  corktiles slateflags teakdeck neontiles`) with the two carpets, the parquet and the two tiles from part 1: one per
  room (`tools/room-floors-v47.py` lays the first twelve; the six shops are built with theirs). Their keys are signs
  (`O Q ! # % : ; = ~ _ + *` and `$ ( ) - [ ]`) because every letter and digit is taken. The dark floors (terrazzo,
  neon) use stains and glints for their detail tiles, not the light and dark patches, which show as blotches on them.
- **The six shop rooms** (`tools/build-interiors.py`) are furnished from the room kit and the region props
  (`stall_merch`, `record_crates`, `crystal_cluster`, `minecart`, `night_stall`); they keep their own wall colours
  (`"vary": 0`).
- **Map miniatures:** all redrawn at noon on a clear spring day (`tools/build-map-minis.py --all`); the old ones are in
  `retired/map-mini-v46/`.

## Version 46
- **Ground**: 12 tiles per kind in `art/next/tiles/<name>_1..12.png`. `_1`, `_7` and `_8` are plain; `_2`–`_6`,
  `_9` and `_10` are detail patches the painter puts where a slow noise is high; `_11` and `_12` are worn, used along
  the lines between the hub and the exits. The 12 new kinds (clover, moss, mud, wet sand, pebbles,
  cobbles, leaf litter, heather, marsh, marble, ice, crystal floor) are drawn 32 px/m by `tools/build-terrain.py`,
  which only writes missing files (`--force` remakes; `--sheet out.png` shows them all).
- **Buildings**: 12 new kinds (`bakery inn market_hall bank library school station fire_station mansion barn greenhouse
  ski_lodge`) drawn with the same walls, roofs, windows and doors as the houses, each with a 3D plan. Colour variants
  are new files next to the original, `scene/props/<name>_v1.png` ... `_v5.png`: the original's wall, roof and trim tones
  are moved to a new palette, and sometimes shutters, window boxes or an awning are added. The catalogue lists them
  under `build.variants`, and a placed building picks one with `v`. `tools/build-buildings-v46.py` never touches an
  existing picture (`<name> --force` redraws one; `--sheet` shows them all).
- **Furniture** for the new rooms: bakery oven, bread rack, bed, bar counter, bank counter, vault door, reading desk,
  school desk, blackboard, wall map, ticket window, departures board, piano, armchair, chest of drawers, glass cabinet,
  ski rack, potting bench and fire pole (`tools/build-furniture-v46.py`, missing files only). Things that hang on the
  back wall (vault door, blackboard, map, departures board) are drawn like the clock and the window: picture at the
  top, empty space below.
- Room layouts for the new kinds are in `tools/build-interiors.py` (it only adds rooms that are missing).

## Version 44

- No new art. The street lights, the drinks fridge, vending machines, billboards, newsstand, food truck, phone
  booth, bus shelter, coin statue, ski sign, market cart, stall, tent, signposts, goods crates, birdhouses and
  traffic lights draw as their pictures again (their recipes stay in `art/scene/vox/` for the Studio); the voxel
  catalogue is 33 props.
- The ground normal map (made with the ground picture) now has a coarse relief term: the picture's brightness
  blurred over about half a metre, so a painted path reads as slightly sunken and a brighter patch as raised.
  Paint ground tiles with that in mind: darker = lower.
- Four light-lab test scenes (`tools/build-test-scenes.py`): `test_light_terrain`, `test_light_room`,
  `test_light_props`, `test_light_air`.

## Version 43

- `art/scene/flags/<town>.png` (48×32, six towns and `default.png`, `tools/build-flags.py`) and
  `art/scene/props/flag_mast.png` (the bare pole). The cloth hangs from the top of the mast 0.06 m right of it, 1.41
  × 0.94 m, and waves in the sprite shader (`uWave`); paint a flag by editing its PNG, keep the hoist edge dark.
- `art/scene/vox/<key>.json`: voxel recipes (`tools/build-vox-props.py`), the shapes-in-metres format the Studio's
  Prop builder edits. Colours are the props' own ramps (the base tone, with the texture dithering lighter and darker
  voxels); a picture layer can set any 2D art into a model. `--force` rewrites one you want from the tool again.
- The wind now bends sprites quadratically (more at the top); nothing in the pictures changed.

## Version 42

Nature props (new files only, `art/scene/props/`), made by `tools/build-nature-props.py`, which imports the
scene-prop kit and adds seventeen flower heads (`bloom()`: star, cup, daisy, pom, disc, bell, spike, poppy, seed,
drop), a leafy base (`leaf_base`), berries and blossom over foliage (`dots`), round trees and shrubs from blob
layouts, and tufts with heads (wheat, thistle). A few new ramps live only there: olive, sage, dry, rustleaf,
goldleaf, deep (a dark green for water-edge plants), lime, plum, snowc (snow white), brown, lichen, duck (duckweed),
mud. The review sheet is `validation/v42-nature.png`; `--force <key>` redraws one you want from the generator again.
Each prop's `family`, `grow` (ground letters) and `weight` sit in the catalogue beside its picture; the growth pass
and the Studio's family brush read them, so a hand-added plant joins the growth by getting those three fields.

## Version 39 and 40

- `art/next/billionaires/`: all 117 sheets (`<name>.png`, `.json`, `_gold.png`), rigs in `art/next/rigs-next.js`
  with a `portrait` rectangle each (the 64×64 bust the Guide crops). The old `art/billionaires/` and its atlases are
  gone; `art/rigs.js` is empty and takes only rigs the Studio makes without a sheet.
- Review sheets: `validation/v38-roster.png` (the first 61), `validation/v39-roster.png` (all 117 at rest).
- The people keep the v31 wardrobe art (`art/trainer/`, 66.5 px a metre, rigged): v40 changed how it is chosen, not
  how it is drawn. A 32 px/m layer-sheet redraw of the people is the one plan item not done; see the plan doc.

## Version 38

New files only, under `art/next/billionaires/`: 61 sheets (`<name>.png`, `<name>.json`, `<name>_gold.png`) for the 23
roster lines, by `tools/build-roster-sheets.py` from the specs in that file; the rigs are merged into
`art/next/rigs-next.js` (species id = line + stage, `huang0` … `saylor1`). A sheet you repaint is kept; `--force`
remakes it; `--only huang,ellison` limits the lines. Body-plan templates and the spec vocabulary are documented at the
top of the file; `make_head` holds the head shapes, ears, horns, crests and markings; `tail`, `wings` and `extras` the
loose pieces (a cloud, a puddle, birds, sparks, a pebble, a leaf, a mound or a crown of leaves carried on the back).

## Version 37

- `art/next/tiles/<terrain>_1..6.png`: the 26 terrains at 32×32, six variants each, by the new `tools/build-tiles.py`
  (the v35 masters, edge masks and `tiles.json` are gone; the painter never used the edges). A tile you repaint is kept;
  `--force` redraws all; `--sheet out.png` makes a contact sheet with the 16 px tile above its six.
- Colours: the base, light and dark of each 16 px tile (`tools/build-scene-tiles.py`), plus the prop ramp's deep shade
  and highlight. Water keeps the 2×2 checker between its two blues; nothing else dithers.
- Removed: `art/hd/` and `data/hdart.js` (the v34 2× copies). `tools/build-hd-art.py` is in `tools/backup/`.
- Props, buildings, people, animals and effects: unchanged, still 34 px a metre (`scenery.ppu`).

## Version 36

New files only:
- `art/next/billionaires/<name>.png`: one puppet sheet per starter species (emberox … harvestgoat): front pieces, four
  face pieces, four face-composited heads, a three-step torso, back pieces and a 64×64 portrait. `<name>.json` is the
  layout (where each piece sits on the sheet, where it rests on the 96/128 canvas, its pivot and parent, its group);
  `<name>_gold.png` the Golden recolour. Made by `tools/build-starter-sheets.py`; a sheet you repaint is kept.
- `art/next/rigs-next.js`: the rigs for those sheets (`k:1`, `clock:12`, `sheet` path, `lag` on tail/spark/hat/cloud).
  The game merges them into `RIGS` at load; species ids are line + stage (`musk0`…`musk3`), sheets keep the names.
- To repaint a piece: edit the pixels inside its rectangle on the sheet (the JSON has the rectangles), keep the size.
  To re-rig: Studio → Billionaires → Skeleton builder on the species, or Import piece sheet with an edited JSON.
- v36b: `tools/pixkit.py` holds the painting primitives (blob, fringe, strokes, horn_arc, eye, face, box, screen …); the
  species recipes in `build-starter-sheets.py` are the pattern for the other 105 (a `musk`/`bezos`/`gates` function each).

## alpha 0.4.1

- The title no longer shows the painted `background/sundown.webp`; the first town (Copperleaf) is drawn by the 3D
  renderer and builds itself in behind the logo while the game loads (`js/boot.js`, `townRiseAmount` in `js/walk/sprites.js`).
  The painting stays as the wide-screen page background behind the menus.
- Without 3D graphics the loading screen draws a small isometric island by hand on a 256 × 168 canvas (no art files):
  ground tiles, trees, houses, lamps and an airship station, in the game's palette.
- Airship stations (`tools/build-airship.py`): the mast, the station and the airship are three separate low-poly models
  sharing the mast's foot as their base point; the airship bobs (`bob` in the catalogue).
- Buildings gain sills and lintels at the side and back windows, corner posts and a plinth, all in the building's own
  trim and base colours (`js/buildings.js`).

## Robots (phase 17, placeholder)

`game/art/robots/` holds one picture per robot part and view (`<part>.png`, `<part>_back.png`; a torso's head as
`<torso>_head.png`; a gem as `gem_<gem>.png`, front only: the back of a torso hides it), sliced from the owner's placeholder sheet at its pixel grid (about 5
sheet pixels to one, a gem 9) with the alpha cut at half. robots.json names them per part (`art.img`, `art.imgB`,
`art.head`, `art.headB`; a gem's `img`). `game/js/robot-art.js` stacks them on the biped skeleton at their sockets:
the legs' hip knob under the torso, the head's neck on the torso's top, each arm's shoulder knob at the torso's side
(about 62% up), the gem in the chest socket (half way up, front only). Any arm fits either side. A part without a
picture is drawn as a stand-in from its colour and shape. They are stand-ins for the modular low-poly parts of the
art pipeline (phase 17 task 11).

## Portraits (phase 07, in progress)
- Talking heads, 64×64 art pixels: a still body and a head that moves (sub-pixel, rotating round the neck). Details and
  the data format: docs/phases/07-plan.md.
- `tools/art-source/portrait-kit/`: the 15 AI-drawn part sheets on magenta (heads, hair short/long front/long back,
  hats, clothes, lashes eye frames, eye styles, brows, noses, two mouth sets, face marks, accessories) and `kit.json`
  (each sheet's kind, grid and cell ids). Never shipped.
- `tools/slice-portrait-kit.py` cuts them into `game/art/next/portraits/<id>.png` (311 pictures), resampling the
  sheets' uneven "pixels" to one grid: skull 30 px wide, an eye about 9, a mouth about 11. Clothes are cut three times
  (shoulders 53, 59 and 64 px; a head's `top` picks one). Pairs (eyes, brows, earrings...) are split into `_l`/`_r`.
  Single-frame eye styles get half, closed and happy frames drawn from their darkest colour.
- Placement lives in `game/data/portraits.json` (edited in the Studio once its Portraits section exists). Running the
  tool again re-cuts the pictures and keeps the data; `--reset` starts the data over.
- Parts are drawn in neutral colours (greys, a mid brown for hair) and tinted in the game; heads keep their own skin
  unless a face sets one.

## Phase 10 (2026-10-19): the bowl world map
- `map/world.png`, `map/world_h.png` and `map/mini/` are gone, with `tools/build-world-relief.py`,
  `tools/build-map-minis.py` and the Studio's map painter. The world map's ground is made in code from the places'
  bowl spots and kinds (game/js/logic/bowl.js, game/js/world-bowl.js); the walk scenes' sky shows the bowl's far wall
  worked out from the same ground. `map/airship.png` stays (the flight over the bowl).


## UI icons, 36×36 "block and split" (2026-10-23)
- All 49 interface icons in `game/art/ui/*.svg` are redrawn as 36×36 pixel art in fixed colours (they were 12×12
  one-colour masks tinted by the text colour). The owner picked the look from samples: "P5", a mix of an extruded
  block and a diagonal split.
- `tools/build-ui-icons.py` holds each icon as a 34×34 grid of colour letters (its `PALETTE`: the light theme's
  colours from `uiTheme.json` plus blue, ice, paper, cream, stone, steel, slate, wood, violet and cloud). The tool
  adds the same treatment to every icon: a 2 px block side to the lower right in a darker shade of each colour, the
  front split on the 45° line through its middle (paler above), a lit top/left edge and a darker seam where two
  colours meet. Edit a grid and run the tool; `--check` (run by `tools/test/ui-icons.test.mjs`) fails if a file
  differs.
- Icons are objects: the same colours on both themes; shadows are always dark (never the theme's text colour,
  which is light on the dark theme). The darkest colour is slate `#4A5544`, so nothing vanishes on dark panels.
- Shapes keep the UI track's 45° rule: straight lines and 45° steps, octagons for circles. Strokes are 3 px or
  more so the icons hold up at the 14–22 px the game mostly draws them.

## UI icons in one colour: the bottom bar, controls and stats (2026-10-26)
- An icon in `MONO` (tools/build-ui-icons.py) names one colour from `RAMP` (gold, red, green, steel, blue, teal,
  violet) and draws with the digits 1-4: that colour's light, mid, dark and ink shades. Letters in its grid are
  accents (map's cream pin hole, sound-off's red cross). Shades of one colour get no seam between them, so the
  tones read as one block; the block side, the lit edge and the pale top half are the same as every other icon.
  Ink is for details inside a shape only (the bag's clasp): it is too dark to read on the dark theme's panels.
- One colour each: bottom bar map (red), bag (gold), relic (violet), spark (gold); controls back, chev (gold),
  close, minus (red), plus, check, bug (green; check was cream, faint on the light theme), list, gear, sound,
  sound-off (steel); stats heart (red), bolt (gold), drop (blue), scrap (steel), mint (teal). Coin and pyramid were
  already gold-only and keep their seams (the coin's inner ring is drawn by one).
- `team` (the Team tab and the battle's Team button) is two pyramids, sand (gold and wood) behind and blue in
  front, tilted 12 and 10 degrees: the owner asked for playful angles, so this one breaks the 45-degree rule.
  The far one is sand, not gold: the pale top half washed a gold one out to near white.
- Weather icons are unchanged (offered, not picked).

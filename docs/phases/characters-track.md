# Characters track (CH): people that look like they belong and move like they're alive

Branch: track/characters

The owner's brief (2026-10-27): "Make a plan to improve the character sprite and their artstyle. Would higher
resolution work? You can completely rework if you must. How could you animate them better. Do a lot of research
online. Make suggestions. It has to be unique but look very nice." Planned and researched in one session (CH-0,
approved in Plan Mode 2026-10-27), written on `ccr-ffb6bdf7-fya7yi` because `track/characters` didn't exist yet;
CH-1 on works on `track/characters`, made 2026-10-27 from that branch by the CH-0 session at the owner's word.

"Characters" here means people: the player, townsfolk, trainers, residents, shopkeepers, Chosen and Blake. Billies,
Kappi (a creature person, `creatureFrame`) and the bots keep their 2D rigs.

## In short
- **Higher resolution would not help in the world.** People are already *too* fine for the phone: at the Normal zoom
  a person is 39 CSS px tall and each of their art pixels is drawn at 0.74 of a scene-buffer pixel, so the GPU
  shrinks them (mipmaps) and they blur, while the ground and props are drawn at about 1.6. More resolution makes it
  worse and quadruples the drawing. In battle and close-ups it is the other way round: there, more pixels show.
- **Recommendation: "3D-driven pixel puppets" (C).** Each person becomes a small low-poly figure of jointed rigid
  parts (the airship style; the Studio's model rule "spinning and jointed parts; no skinning"), rendered into a pixel
  sprite on the world's own grid: 32 px/m in the world, 64 in battle, more in menus. It reads as hand-made pixel
  art, yet faces any way, takes real light and plays a whole animation library. Precedents: Dead Cells (3D animation
  rendered to pixel art), Hades II (moved to real-time 3D characters, kept its 2D look), Octopath (its pixel people
  are jointed rigs, cleaned by hand).
- **The look is proven before anything big is built.** Two spike sessions (CH-2, CH-3) bake the new figures into
  today's sprite path and show them beside today's people and a Billie on the owner's phone, with a density dial
  (16-64 px/m). The owner picks. If they don't read as pixel art, the classic 2D redraw (A) is laid out below.
- **The style.** Toy-like proportions (about 2.75 heads), big eyes in the portrait kit's style, the props' plum
  outline and master palette, springy hair and scarves; costumes that tell the story: the player as the neon outsider
  from the cyberpunk city among solarpunk locals and beige Bureau clerks.

## Would higher resolution work? The numbers (a 390×844 phone, DPR 3, portrait)
| Where | Person on screen | Drawn px per art px today (66.5 px/m) | Proposed |
|---|---|---|---|
| Close zoom (0.55) | 77 CSS px | 1.45 | 3.0 at 32 px/m |
| **Normal zoom (default)** | **39 CSS px** | **0.74: shrunk and blurred by mipmaps** | **1.55 at 32 px/m (props 1.56, ground 1.66)** |
| Far zoom (1.7) | 20 CSS px | 0.39 | 0.8 at 32 px/m |
| Battle, the player's trainer | 147 CSS px | 3.8 (device px) | about 4.9 at 64 px/m |

"Drawn px" are the scene buffer's pixels: the scene draws at about 0.73 of the device's pixels (860×1861 here) and
is stretched to the screen (camera.js:306, walk-view-gl.js:513-524). The arithmetic is in the CH-0 HANDOFF entry.
The old style guide already had the rule: "32 px/m in the world, 64 in battle" (docs/archive/LEGACY-CHANGELOG.md:858).

## What the game has (checked in the code, 2026-10-27)
1. **Too fine, so blurred:** people are 66.5 px/m (wardrobe.json `ppm`; 116.4 px for 1.75 m) in a 32-34 px/m world
   (ground 32, props `scenery.ppu` 34, buildings and models 32), so one screen mixes pixel sizes ("mixels").
2. **Drawn by code from blobs** (tools/trainer_gen: polygons and ellipses, a normal from a blurred mask cut into 4
   tones): generic, few deliberate clusters; faces are 6×7 patterns on a body 3.4 heads tall.
3. **Jagged motion:** limbs are pixel pieces rotated with nearest sampling (skeleton-rig.js:205 `drawRig`); body
   sliders stretch pieces by uneven amounts (person-art.js:515-575 `scaleCanvas`, `boneScale`).
4. **Flat light:** person frames set `noNormal`, so they get a flat normal and skip the edge bleed; the rim term
   comes out at about 0.0004 (a camera-facing normal at a 26° tilt). They look pasted onto a lit world.
5. **Thin animation:** 4 facings from 3 views (side mirrored), instant turns; a 6-frame walk at 110 ms where the
   front and back views barely move the legs (the thighs only squash); the stand frame never breathes or blinks in
   the world; no run, talk, sit or turn; map people, trainers and keepers always show their stand frame, and a route
   trainer slides over on it (route-sight.js:76-88); the townsfolk wave is the front view's cheer whatever way they
   face.
6. **Facing bugs:** facing comes from world-space movement and ignores the camera's turn (the orbit camera, turned
   rooms, the ±35° turn); `leaveRoom` sets `P.dir` to `'right'`/`'left'`, which don't exist, so the player faces down
   (walk-control.js:306); the director's dark and mirrored copies lose `ax`/`ay`/`ppm` (director.js:172-199), so
   they fall back to anchor (16, 40) and 42 px/m. All fixed in CH-1 (people are seen from the camera's turn; a plain
   word such as a map's `down` or a cutscene's `face X down` stays a screen word).
7. **Cost:** every frame is its own canvas texture (no atlas), so people never batch; each sprite costs up to 6
   draws (main, two sun shadow maps, two lamp shadows, reflection); the person cache holds up to 2,000 pictures
   (about 40 MB) on phones. Copperleaf drew 1,770 calls a frame against the 400 budget (20-renderer-batching.md:91).
8. **Tools:** tools/export-trainer-sprite-sheets.py (the owner's, 2026-10-24) read `game/data/gamedata.js`, which
   isn't gone but built by `npm run data` and gitignored, so its CI workflow never found it and failed all 30 runs
   (CH-0 had the cause wrong); deleting `game/art/people/` in SA-5 broke nothing. Retired in CH-1 at the owner's word,
   with its workflow and docs/EDIT-TRAINER-SPRITES.md.
9. **Battle:** the player's trainer is the back view at 1.42 m, the rival the front view at 1.7 m (battle-stage.js
   1234-1245); 2 breathing frames, the throw in 7 steps, cheer and react in 4 frames at 90 ms.
10. **Engine facts for C:** no skinning anywhere; `renderTarget` exists (webgl.js:1274, LINEAR by default);
    `uUV` exists in the sprite and shadow vertex shaders, but the instanced programs hard-code the full picture and
    "shadows in batches" is on (settings.js:380); there is no 2D fallback for people (WebGL2 is required).

## The research, in short
- **Octopath Traveler (HD-2D):** people are **18×32 px**; the team split base poses at the joints, posed them with
  Photoshop's Puppet Warp and cleaned the results by hand ([CGWORLD](https://cgworld.jp/feature/201908-gg2019-oct.html),
  [Denfaminicogamer](https://news.denfaminicogamer.jp/kikakuthetower/231218g)). Octopath II made bodies taller,
  testing one pixel at a time, because small characters limited what animation could express
  ([Dengeki](https://dengekionline.com/articles/151745/)). A point light makes the sprites cast shadows
  ([Wikipedia](https://en.wikipedia.org/wiki/HD-2D)).
- **Dead Cells:** 3D models posed key to key, rendered about 50 px tall with no anti-aliasing, a toon shader and
  normal maps; retakes take minutes and animations are reused; flickering pixels were never fully solved
  ([Game Developer](https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-)).
- **Hades II** moved from an all-2D workflow to real-time 3D characters and kept the painted look: twice the
  characters, less memory, real turn animations and lean blends
  ([DigiPen](https://www.digipen.edu/showcase/news/hades-2-graphic-programmer)).
- **t3ssel8r (3D pixel art):** big actions as smears, small ones as held and duplicated frames, keeping a
  low-framerate look ([Cascadeur](https://cascadeur.com/blog/general/making-an-animation-for-a-3d-pixel-art-game)).
- **Snapping:** under an orthographic camera, snapping to the texel grid stops pixel crawl; under perspective it
  can't ([Texel Splatting, 2026](https://arxiv.org/abs/2603.14587)). So each figure gets its own snapped ortho view.
- **Walk cycles:** 8 frames is the sweet spot, 4 feels lacking, and the work grows steeply with sprite size
  ([Slynyrd, Pixelblog 50](https://www.slynyrd.com/blog/2024/5/24/pixelblog-50-human-walk-cycle)).
- **Cassette Beasts:** world sprites about half the size of battle sprites, 4 directions with idle and run, lit from
  directly above ([modding guide](https://wiki.cassettebeasts.com/wiki/Modding:Monster_Making_Guide_Part_1)).
- **Breath of Fire IV:** praised for its many sprite frames; its 2D people in a turning 3D world drew criticism when
  the camera circles ([RPGFan](https://www.rpgfan.com/review/breath-of-fire-iv-2/)). Our orbit camera has that problem.
- **Pokémon BDSP:** some reviewers called its chibi 3D figures "emotionless" and "toy-like"
  ([Nintendo Life](https://www.nintendolife.com/reviews/nintendo-switch/pokemon-brilliant-diamond-and-shining-pearl)):
  3D figures need expressive faces and snappy poses.
- **Bug Fables / Paper Mario:** thick dark outlines make flat characters stand out from a 3D world
  ([Cubed3](https://www.cubed3.com/games/reviews/nintendo-switch/bug-fables-the-everlasting-sapling)).
- **Mixels:** don't mix pixel sizes ([pixnote](https://pixnote.net/en/learn/resolution)). Rotating pixel art in
  skeletal tools looks bad ([Spine forum](https://ru.esotericsoftware.com/forum/d/13789-spine-needs-rotsprite)).
- **Customisation in pixel art stays small:** Octopath 0 offers 8 hairstyles and 8 eye colours
  ([guide](https://hacktheminotaur.com/octopath-traveler-0/octopath-traveler-0-character-creation-ultimate-guide/)).
- **AI sprite tools** ([PixelLab](https://pixellab.ai/): 8-way turns, skeleton animation, an MCP server) suit
  concepts; they don't keep layers pixel-aligned, which phase 07 also found.
- **Free parts and tools:** KayKit's Adventurers are CC0 with 75 animations, on GitHub, which this container reaches
  ([itch](https://kaylousberg.itch.io/kaykit-adventurers)); Quaternius' animation library has 120+ clips, CC0 on its
  page, though a guide says the site's newer packs use its own licence: check each pack
  ([quaternius.com](https://quaternius.com/packs/universalanimationlibrary.html)); Blockbench makes jointed models
  with pixel textures and exports glTF with animations
  ([Luanti docs](https://docs.luanti.org/for-creators/models/using-blockbench/)).

## Directions considered
- **A. Classic 2D, redrawn:** people at 32 px/m with bigger heads, 5 drawn views (8 facings with mirrors), limbs posed
  by swapping drawings instead of rotating pixels. For: the most hand-made; edited in Aseprite or the Studio; matches
  the 2D Billies. Against: all 84 items in 5 views, a second 64 px/m set for battles, new drawings for every
  animation.
- **B. 3D figurines without the pixel pass:** smooth edges that don't match the pixel props, and the BDSP "toy" risk.
  The spike shows it anyway, at no extra cost.
- **C. 3D-driven pixel puppets (recommended):** B's figures rendered through a pixel pass.
- Not taken: higher-resolution 2D (it blurs in the world); voxel people (stiff); AI sprite sheets as the source (not
  aligned).

## Why C, and when A is better
1. **One asset, every size:** 32 px/m in the world, 64 in battle, 96-128 in the dressing room. No mixels.
2. **Any facing**, relative to the camera's turn, so the orbit camera stops showing the wrong side; yaw stepped in
   8-16 for the pixel look.
3. **Animation becomes cheap:** a clip library plus layers in code (lean, look-at, springs). Sitting, carrying and
   waving are within reach.
4. **Sliders and recolours** scale bones and swap palettes, never stretching pixels.
5. **Real light** (once CH-4 is in): toon bands from the world's sun and lamps, a rim from the strongest light.
6. **Cheaper on the phone** (with CH-4's live atlas): one shared texture for all people, so they batch; redrawn at
   12 fps; the 40 MB frame cache goes.
7. **It fits the owner's rules:** the Studio's decisions of 2026-10-19 (studio-track.md): models are low-poly with
   32 px/m textures, made in Blender, Blockbench, MagicaVoxel or an AI generator, with "spinning and jointed parts;
   no skinning". Portraits stay 32-bit pixel art (phase 07).

**A is better if** the spike's figures don't read as pixel art after tuning; if the owner wants clothing drawn in 2D
(AI sheets through the Studio's Sheet and Part modes); or if people should match the 2D Billies. Outside the island
and rooms the camera barely turns (base yaw 0, camera.js:229), so 5 drawn views would do there.

## Risks, and how the spike answers them
- **Pixel boil** as limbs turn at 56 px tall (the same jaggedness, now in 3D): poses on the 12 fps clock, held key
  poses, chunky limbs (2 px and up), the outline drawn in the low-res buffer, yaw and pitch in steps, the root
  snapped to whole texels.
- **Faces about 15×15 px:** bigger heads and hand-made face decals; the density dial checks it.
- **Double squash:** a view rendered at the camera's 26° tilt and stood upright is squashed again (cos² = 0.81 at
  Normal, 0.66 at Far). The answer is an oblique projection onto the upright card, its axes from the camera's
  `right`/`back` (the camera mirrors X, camera.js:491).
- **Two kinds of pixel art:** people at 32 px/m beside Billies on their 68 grid. The spike shows them together.
- **Live-atlas plumbing** (CH-4, after the pick): shadow batches would cast the whole atlas, so the instance layout
  needs a cell rect (`uvRect`, sprite-instances.js:50-63, its stride test); render targets have no mipmaps, so
  density drops with distance; the light comes after the shadow passes, so the atlas is drawn unlit (colour plus
  normals) and lit in the sprite shader with a cel band; the atlas is keyed by `gpuState.gen` and survives context
  loss; render-target rows are bottom-up (flip clip-y); sel-out samples ±1 texel, so cells need a 2-px gutter.
- **Depth:** a flat card can't show sitting knees or forward arms against counters and stairs: a depth offset in the
  normal texture's alpha and `gl_FragDepth` in a people-only sprite variant, decided in CH-11.
- **Double outlines:** the post pass already inks from depth jumps (post-effects.js:248-250); the spike toggles one.
- **The size of the job:** about 3-4 renderer sessions and 10+ content sessions.

## The art direction (whichever way the owner picks)
- **Shape:** about 2.75 heads for adults (2.25 kids, 3.25 tall people), slightly big hands and shoes, one signature
  silhouette piece each (hair, hat, bag, coat). Every person passes the silhouette test at the Normal zoom.
- **Faces:** the portrait kit's eye, brow and mouth styles at walk size, with a 1-px glint; blinks, talking mouths
  and expressions in the world, so people match their portraits.
- **Pixels and colour:** the world's grid, the master palette (164 colours), lavender shadows and warm lights, the
  props' dark plum outline (36,25,54) with sel-out, no dithering.
- **Light:** 3 toon bands and a 1-px rim from the scene's actual sun and lamps.
- **Costumes tell the story:** the player in dark city techwear with neon trims that glow faintly at night, the only
  neon in the Hollow Earth, so you always spot yourself; locals in solarpunk linen, cork and terracotta, leaf greens,
  sun-yellow, straw hats, tool belts and solar visors; the Bureau of Lost, Found and Beans in beige-grey suits,
  lanyards and ID cards, clipboards, red tape and bean pins; Chosen's wolf tee, lab coat and katana; Blake's track
  jacket and headset.
- **Motion personality:** stepped at 12 fps with hits on 24; gaits by role (clerks shuffle stiffly, kids bounce,
  Chosen swaggers); springy hair, scarves, coat tails and lanyards.

## How they will move
- **Clock:** the Billies' 12 fps clock; key poses held; the VFX track's smears on big moves.
- **Getting around:** idle with breathing, blinks and fidgets; walk (8 frames) and run synced to distance (no foot
  slide); start and stop; smooth turns; leaning on slopes; stairs, ledge hops, wading, Surf, ladders, ride mounts.
- **Everyone alive:** map people and keepers idle and turn to you; route trainers run over; friends wave; townsfolk
  wave the way they face.
- **Acting:** talk gestures; nod, wave, point, cheer, "oh no", think, shrug, laugh, angry, sad, a surprised "!" hop;
  sitting on benches and chairs (HB-10c: "nobody sits"), sleeping, eating, giving, doors; the throw; cutscene acts.
- **Life:** spring bones on hair, scarves, coats, lanyards and backpacks (fixed step, off under Reduced motion);
  squash on landing; heads that look at whoever is talking; dust and footsteps.

## Sessions
- **CH-0** the plan (this file), ROADMAP, BRANCHES, HANDOFF. Docs only. Done 2026-10-27 on `ccr-ffb6bdf7-fya7yi`.
- **CH-1 The bench and the fixes.** Done 2026-10-27 on `track/characters` (HANDOFF has the numbers):
  - the `test_people` map (tools/build-test-scenes.py `t_people`) with a draw-only `lineup`, a new key for test maps;
  - `tools/look-people.py` for headless pictures and draw counts at every zoom stop, by day and night, turned;
  - debug-log counters for people (`people`, `ppl`, a `person` draw tag);
  - facing relative to the camera's turn, and a heading per person (game/js/logic/person-view.js; `personHeading`
    is what CH-2's figures turn to);
  - the room-exit facing, the cutscene copies and the reach's mirror fixed;
  - the sprite-sheet exporter retired, at the owner's word.
- **CH-2 Spike 1: the figure baker.** Done 2026-10-28 on `track/characters` (HANDOFF has the numbers):
  - the switch Engine > People > Figures (`people.figures`, off), with its density (16-64, 32), turns and outline;
  - game/js/figures.js, the baker, in its own small WebGL2 context (the owner's pick): jointed rigid parts, one joint
    a vertex; toon bands from a top-left light in the props' ramps; the plum outline and a lighter line inside where
    a part stands in front of another, drawn at the bake's own pixels; pictures kept by view (at most 600), at most 4
    baked a frame; a lost context bakes nothing until it is back;
  - game/js/logic/figure-pose.js: the oblique projection onto the upright card (no double squash), the heading seen
    from the camera in steps, the tilt in 2-degree steps, the lift snapped to whole texels, the 12 fps clock;
  - the baked canvases go down today's sprite path tagged `ax`/`ay`/`ppm`, so shadows, AO, fog, reflections,
    batching and the person counters take them unchanged;
  - the code-built mannequin with idle and walk, made rounder and more charming at the owner's word ("less boxy"): an
    egg of a head with a hair cap, fringe and cowlick, a bean body with a scarf, capsule limbs, mitten hands, bean
    shoes, smooth toon shading; its face painted in whole pixels (eyes with a glint, mouth, blush);
  - the bench: the mannequins on test_people, look-people `--figures`, `--lose` and `--sheet`.
- **CH-3 Spike 2: one figure, side by side.** Done 2026-10-28 on `track/characters` (HANDOFF has the pictures and
  counts):
  - `tools/gltf-figure.mjs`: a rigged .glb to a figure (the strongest joint a vertex; what a hand holds left out;
    clips sampled on the 12 fps clock, calm ones on twos; x flipped for the game's mirrored camera; the texture
    point-sampled to 128 x 128 and snapped to the master palette);
  - the stand-in: KayKit's Rogue (Adventurers 1.0, CC0; validation/cc0-src/LICENSES.md), game/art/figures/rogue.*,
    with idle, walk, run, cheer, throw and sit; its own painted face reads at 32 px a metre (its head is about 26 px
    wide), so the wardrobe's face pixels were not laid over it (the owner: the new people don't have to look like
    today's);
  - the plain 3D figure (B) as a style of the same figure (smooth, no outline, 128 px a metre, smoothed by the GPU);
  - test_people: the mannequin, today's person, the stand-in as C and as B and a Billie side by side, the stand-in
    turned eight ways, walking, running, cheering and throwing; look-people `--battle`, dusk and density lists;
  - you as your figure anywhere, townsfolk as figures (a dial), and in battle the trainers at 64 px a metre;
  - the debug menu's figure switches, to try every dial on the phone; the debug log says which look was on.
  - Waiting: **the owner's phone** (its milliseconds) and **the owner's pick** ("Ask me before" 1).
- **After the pick (C):**
  - **CH-4 The live atlas:** figures drawn on each 12 fps step into one shared, unlit atlas (colour plus normals)
    before the shadow passes, lit in the sprite shader with a cel band; cell rects in sprite and shadow batches; one
    texture for all people; density by distance; context-loss restore; a snapshot service for UI pictures
    (`readPixels`, after `screenSnapshot`). **Phone gate.**
  - **CH-5 The figure format and tools:** the importer for Blockbench and Blender glTF (jointed parts); the runtime
    format; a per-look bake (one merged mesh plus a recoloured texture, keyed by the look); the Studio's figure
    preview (turntable, palette, colour masks).
  - **CH-6** the base body and faces: the 8 body sliders as bone scales, with shells fitted at their extremes; skin
    ramps; faces from the portrait kit with blinks, talking and every dialogue expression tag.
  - **CH-7** wardrobe I: item shells with 32 px/m textures and RGB colour masks; all 84 item ids kept with shops,
    saved outfits and the dressing room; UI pictures from snapshots; half the items.
  - **CH-8** wardrobe II: the rest; Chosen, Blake, residents and folk looks; the old pieces to `art/legacy`.
  - **CH-9** getting around: walk, run, start and stop, turns; slopes (lean as a spine bone), stairs, hops, wading,
    Surf, mounts; every NPC alive; the train ride, friends and the world-map pin. **Phone gate.**
  - **CH-10** battle and close-ups: trainers at 64 px/m, intros, the throw, the dressing room turntable.
  - **CH-11** acting: talk and emotes; sitting (sit spots in the data, the depth decision); sleeping, eating,
    giving, doors; cutscene acts and copies; emote bubbles.
  - **CH-12** life: spring bones, squash, look-at, gaits by role, dust and footsteps, VFX smear hooks.
  - **CH-13** the Studio's Characters workspace: shells, texture painting, faces, clips, a density preview, sheet
    export for hand touch-ups.
  - **CH-14** the switch-over: the old canvas path and `PERSON_ART_CACHE` removed; screenshot baselines regenerated
    in their own commit; docs; **the final phone pass.**
- **If A instead**, CH-4 to CH-14 become: the base body redrawn at 32 px/m in 5 views; limbs posed by swapping
  drawings; the 84 items redrawn; normal maps from the generator's shapes; a 64 px/m battle set; an 8-frame walk, a
  6-frame run, idles, blinks, talking and emotes. The art drawn by `trainer_gen` plus the owner's edits.

Tags `ch-N-done` (the owner pushes them).

## Ask me before
1. The pick after CH-3: C, B, A or more tuning. **Open: the owner's, after the phone.**
2. Jointed parts stay (the Studio's rule). Skinning only if bending joints prove necessary; not expected at 56 px.
   **Answered 2026-10-27: jointed rigid parts** (CH-2).
3. Density: 32 px/m in the world (faces about 15 px), 40 or 48 if faces need it; 64 in battle. **Answered
   2026-10-27: 32, with a 16-64 dial** (CH-2); battle 64 (CH-3).
4. People beside 2D Billies: two kinds of pixel art. A later track could bring the Billies to 32 px/m.
5. Proportions (2.75 heads), and whether people grow a little against the world. **Answered 2026-10-27: 2.75 heads
   at 1.75 m** (CH-2; the KayKit stand-in is about 2.2 heads, a stand-in only).
6. The default zoom: people are 39 CSS px at Normal. The camera track's call, but it shapes readability.
7. Where models come from: CC0 stand-ins for the spike, then the owner's Blockbench or Blender models, or bodies
   built in code; which CC0 clip packs. **Answered 2026-10-27 for the spike: a code-built mannequin first** (CH-2),
   then KayKit's Rogue (CH-3, the track's plan); later models are still open.
8. The player's design (the neon outsider) and the Bureau's look.
9. Hand touch-ups on baked sheets for named people.
10. The sprite-sheet exporter: mend or retire. **Answered 2026-10-27: retired** (CH-1).

## Key files
- Today's people: game/js/person-art.js, game/js/walk/frame-items.js (`personItem`, the player, folk, map people),
  game/js/walk-view.js (`directionOf`, the lean), game/js/walk-control.js:306, game/js/director.js,
  game/js/dressing-room.js, game/js/battle-stage.js and game/js/battle-3d.js, game/data/wardrobe.json,
  studio/js/wardrobe.js.
- Renderer: game/js/walk-view-gl.js (the pass order: the atlas after `coverItems`, before `shadowPass`),
  game/js/engine/webgl.js (`renderTarget`, `imageTexture`), game/js/walk/draw-common.js,
  game/js/walk/walk-shaders.js, game/js/engine/sprite-instances.js, game/js/walk/shadows.js,
  game/js/engine/gpu-counters.js, game/js/self-test.js (the Diagnostics groups).
- The bench (CH-1): game/js/logic/person-view.js (facing, headings, which pictures are people's),
  game/data/maps/test_people.json (its `lineup`), tools/look-people.py, walk-view-gl.js `peopleReport`.
- The spike (CH-2, CH-3): game/js/figures.js (the baker, on both pages), game/js/logic/figure-pose.js (the
  mannequin, poses, the view and the clock), tools/gltf-figure.mjs (the importer), game/art/figures/ (the stand-in;
  not game/data/figures.json, as first planned: a model's file is fetched only when the figures are on), the debug
  menu's figure switches (debug-menu.js FIGURE_SWITCHES), battle-stage.js trainerBattleFrame.

## Verification
- Every session: lint, typecheck and unit tests; smoke before each game commit; check:fast in CI; the full quick
  check and `--selftest` at CH-3, CH-9 and CH-14.
- The quick check with the switch off keeps today's baseline; a forced context loss with the switch on.
- New unit tests: the figure format; the projection and snap maths; facing relative to the camera; the 12 fps
  sampling; the GL stand-in (tools/test/walk-renderer.mjs) counting the figures' draws; every wardrobe id and saved
  outfit surviving the conversion.
- Headless runs give pictures and draw counts only (docs/graphics-bench.md); milliseconds come from the owner's
  phone (the Diagnostics test).
- Don't break: Start-Game, phone mode, the Studio, the in-game full test and the debug log.

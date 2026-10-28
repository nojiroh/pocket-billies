# Art notes

Art rules for the fresh base; the legacy build's art log is ART-NOTES.md on the `legacy` branch.

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
- The kit's sources (`tools/art-source/portrait-kit/`: 15 part sheets and `kit.json`) and its slicer
  (`tools/slice-portrait-kit.py`) were deleted on 2026-10-28 (clean-up track, lane T);
  `git log --diff-filter=D --oneline -- tools/art-source/portrait-kit` finds them. The slicer cut them into
  `game/art/next/portraits/<id>.png` (311 pictures, kept), resampling the sheets' uneven "pixels" to one grid: skull
  30 px wide, an eye about 9, a mouth about 11. Clothes were cut three times (shoulders 53, 59 and 64 px; a head's
  `top` picks one). Pairs (eyes, brows, earrings...) were split into `_l`/`_r`.
  Single-frame eye styles got half, closed and happy frames drawn from their darkest colour.
- Placement lives in `game/data/portraits.json` (edited in the Studio once its Portraits section exists).
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
- Each icon was drawn as a 34×34 grid of colour letters (the `PALETTE`: the light theme's colours from
  `uiTheme.json` plus blue, ice, paper, cream, stone, steel, slate, wood, violet and cloud), and the same treatment
  is added to every icon: a 2 px block side to the lower right in a darker shade of each colour, the front split on
  the 45° line through its middle (paler above), a lit top/left edge and a darker seam where two colours meet.
- Since SA-2b (Studio art track, decision 6) **the SVG files are the source**: `tools/build-ui-icons.py` retired.
  The Studio's icon editor paints an icon's pixels (or edits its text) and writes the same SVG format
  (`game/js/logic/svg-pixels.js`); **Shade as a block** adds the treatment above to a front painted flat
  (`game/js/logic/icon-block.js`, the builder's rules and colours, `ICON_PALETTE` and `ICON_RAMPS`). The builder's
  grids are kept as a test fixture (`tools/test/fixtures/ui-icon-grids.json`).
- Icons are objects: the same colours on both themes; shadows are always dark (never the theme's text colour,
  which is light on the dark theme). The darkest colour is slate `#4A5544`, so nothing vanishes on dark panels.
- Shapes keep the UI track's 45° rule: straight lines and 45° steps, octagons for circles. Strokes are 3 px or
  more so the icons hold up at the 14–22 px the game mostly draws them.

## UI icons in one colour: the bottom bar, controls and stats (2026-10-26)
- A one-colour icon (the builder's `MONO`; the icon editor's "One colour") names one colour from `RAMP` (gold, red,
  green, steel, blue, teal, violet; `ICON_RAMPS` in icon-block.js) and draws with that colour's light, mid, dark
  and ink shades (the builder's digits 1-4). Letters in its grid are
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

## Perk pictures, 36x36 (Perks track PK-2, 2026-10-28)
- Every Perk has its own picture in the UI icons' look: `game/art/perks/<id>.svg`, named by the Perk's `img`. Same
  rules as the UI icons above (fixed colours on both themes, nothing darker than slate, 45-degree lines, octagons for
  circles, strokes of 3 px), plus docs/phases/perks-track.md section 6: one object, a silhouette that reads filled with
  one colour, at most 4-5 colour letters, and no cream or pale shape alone on the background.
- Drawn as flat 34x34 grids in `tools/art/icon-grids/perks.json` (the fixture format: `about`, `mono`, `icons`) and
  written by `node tools/build-icons.mjs perks`, which shades each with `iconBlockKeyed` and writes it with
  `pixelsToSvg` once perks.json names it (grids drawn ahead of their wave wait). The SVG is the source from then on
  (the Studio's icon editor); the tool never writes over one without `--force`. `--check` also refuses two pictures
  whose shapes overlap 90% or more (intersection over union), `--sheet` renders
  `validation/icon-sheets/perks-{light,dark}.png`.
- Shown at whole multiples only: 72 px on a pick card, 36 px in the Perks tab, a shop's row and the "Let one go"
  sheet (`artIconHTML`, `.art-ic` pixelated). The card's back and the bar's Perks tab keep the `relic` icon.
- In a one-colour (`mono`) picture the ramp's shades get no seam between them, so a detail in a darker shade can vanish
  in the pale top half. To part two areas of one colour, draw one of them with the matching letter (the letter `r` is
  the red ramp's mid): a letter is its own block, so a seam is drawn between them (Power Gloves' thumb).

## Terrain TR-4 (2026-10-26): the biomes' cliff faces
- `scene/build/walls.png` is now a 4 x 4 atlas (256 x 256). The first three rows are the 12 cells from before, kept
  pixel for pixel; the fourth row is new, drawn by `python3 tools/build-walls.py --extend` (from its own seed, so it
  never touches the first three rows; `--force` still redraws everything): 12 columnar basalt (volcano), 13 limestone
  (sea, tundra), 14 crystal-veined rock (cave), 15 speckled granite (ridge). Same rules as the other cells: 64 px = 2 m
  (32 px/m), five grey levels, tiling, lit from the top left. Repaint them freely; `--extend` does nothing once the
  file has four rows.
- The game reads how many rows the atlas has from its height, so a scene with its own 4 x 3 `wallArt` still works.
- Each biome's colours for its faces are data, not art: `biomes.json` `cliff.strata` (three colours, one per band,
  `cliff.band` metres tall). They are used only with Engine > World > Biome cliffs on.

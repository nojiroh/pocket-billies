# Pocket Billies: Gotta tax 'em all! — 0.1.0 alpha

A classic RPG inside the Hollow Earth, where the Billies are the wildlife. You walk the seamless maps yourself with a
joystick, step into rooms that are bigger on the inside, battle, make friends, and edit everything in
**Pocket Billies Studio**.

0.1.0 alpha is a fresh base: numbering starts over here and old saves don't carry over. What changes from release to
release is in [CHANGELOG.md](CHANGELOG.md). The earlier build (Net Worth, then Pocket Billies alpha 0.1 to 0.5) is
kept on the `legacy` branch, and its changelog in [docs/archive/LEGACY-CHANGELOG.md](docs/archive/LEGACY-CHANGELOG.md).

## Play

1. Extract the whole ZIP.
2. With Python 3 installed, double-click `Start-Game.bat` (Windows) or
   `Start-Game.command` (macOS), or run `python3 start-game.py`.
   The game opens at **http://localhost:8000**. Keep the window open while you play.
3. Don't open `game/index.html` straight from disk: battles and the world map need
   the local web server.

Saves stay in the browser for that address, so earlier progress carries over when you use
the same browser and port. Settings → Export save / Import save moves a save between
browsers or devices. On a phone you can add the game to your home screen; it then
opens like an app.

## Play on your phone

1. On your computer, double-click `Start-Game-Phone.bat` (Windows) or `Start-Game-Phone.command`
   (macOS), or run `python3 start-game.py --phone`.
2. The window shows an address like `http://192.168.1.23:8000`. Open it on your phone, which must
   be on the same Wi-Fi. If the computer asks whether to allow incoming connections, allow it on
   private networks.
3. Over this local address, phones block motion sensors, so step counting and tilting the scene are
   off; use the demo step buttons. Everything else works.

## Sending a debug log

If something looks wrong or runs slowly, open **Settings** (the gear) and use:
- **Run the full test**: about nine minutes on a phone (it walks through all 49 places and 23 rooms), then battles, the map, the opening,
  the dressing room and shops, then a stress test that shows how much load the device handles. A
  table marks each part OK or Problem. Your save isn't changed. It asks to keep the screen on; if the app goes to the
  background anyway (the screen locks, another app comes up), the test waits for you and runs that step again.
- **Run the diagnostics test**: about two minutes, for when the game runs slowly. It looks at your device and how
  the automatic quality chose its level, opens six places picked to cover the hardest cases, measures where a frame's
  time goes, what rain and night cost and how a battle starts, and ends with **Save the report**: a short
  `pocket-billies-diagnostics-….json` to send.
- **Export debug log**: one `.json` file with frame rates per screen and scene, slow frames,
  errors, loading times, your device and graphics chip, and a small picture of the scene. On a
  phone it opens the share sheet (send it to yourself or save it to Files); on a computer it goes
  to your downloads. It contains no save data, names or step history.

Both are also in the debug menu (add `?debug` to the address).

## Pocket Billies Studio

Double-click `Start-Studio.bat` / `Start-Studio.command`, or run
`python3 start-studio.py`. It opens at **http://localhost:8001**.

| Section | What you can do |
|---|---|
| **Billies** | Names, Field Guide text, types, height and weight per stage; stat profile or exact stats; moves learned and when; how and when each stage evolves; where it appears. Animated front/back preview with every action, normal or Golden. |
| **Edit pixels and skeleton** | Pixel editor on the real sprite sheets: pencil, eraser, fill, color picker, palette from the sheet, zoom, grid, part outlines, undo/redo, live animated preview. Rebuild the Golden sheet from the normal one. Download a sheet, edit it in another app, upload it back. Nudge where each body part attaches and how parts stack. |
| **Skeleton builder** | Build or reshape a body: add parts (blank or from a PNG), drag parts and pivots, tilt, re-parent, mirror a limb with everything attached to it, choose which motion each part follows, switch the body plan, and copy a layout between the front and back views. |
| **+ New Billie** | Start from a blank body (biped, four-legged, flyer, fish, blob or worm) in a color you pick, or copy an existing Billie's skeleton and recolored art. Either way it works in the game immediately. Add or remove evolution stages, duplicate, recolor or reorder lines. |
| **Battle preview** | The game's battle stage with your unsaved changes. Pick any two Billies (normal or Golden) and a backdrop, then play any move with any outcome, status effects, wild and trainer intros, taxes, faints, sandstorms and camera moves at ½×, 1× or 2× speed. Sky and haze colors change live. |
| **Moves** | Name, type, kind, power, accuracy, priority, description and an effects builder (status, stat changes, healing, draining, hedging, hype, rent, market shock, delayed delivery and more). |
| **Types** | Colors, the full matchup chart (click to cycle 2× / ½×), each type's battle ability and particle effects. Renaming a type updates everything that uses it. |
| **Items & coins, Town shops, Day Jobs** | Prices, effects, icons (or upload your own), what each shop sells, keepers, greetings, job pay. |
| **World & encounters** | Stops on a drag-and-drop world map and the **roads** between them (add, remove, re-point, set how many steps each road is); gates, shops, backdrops; wild encounter tables; eggs; regions ahead; which walk scene each stop uses; battle backdrop colors and ambience. |
| **Prop editor** (in Walk scenes) | Open any prop and edit everything about it on its picture: drag the base point, click to add lamp glows, lit windows, fires, smoke, water spray and sparkles exactly where they belong (drag to move, Delete to remove), set the door, see the footprint. Add **layers** (from a PNG or a copy of the main picture) and place each one in front of or behind the main picture in meters, shift it, make it face the camera, stay put as the world turns, or lie flat, and let it glow. A 3D turntable shows the prop in the game's renderer while you work. |
| **Walk scenes** | The scene for each stop: shape the land (raise, lower, smooth, flatten); paint the ground tiles; place, move, resize and mirror props; drag the **hub** (where you stand when you stay) and the **exits** roads leave through; choose what a prop does when tapped (shop, clinic, a message), its label and its words; distant hills, townsfolk and what they say, wind, sun rays, sky, haze, shade, tilt-shift blur and camera. The live preview runs the game's renderer: walk around in it and tap things. Paint prop pictures and ground tiles pixel by pixel; set a prop's shadow, sway, solid footprint, door and walkable area; add new props (blank or from a PNG) and new ground types. |
| **Engine** | Every dial of the 3D renderer, with a live preview of any walk scene: lens (sharp band, blur in front and behind, round highlights, chromatic aberration, vignette, grain, sharpen), color (exposure, highlight roll-off, contrast, saturation, warmth, bloom), sun and sky (direction, height, color, real-clock sun, sky light, ground bounce, clouds and their shadows, light shafts), shadows (strength, softness, color, contact shadows, solid building shadows, ambient occlusion), lights, haze and mist, horizon curve, ground bumpiness and shine, world map mountains, grass and wind, water, camera (including distance and tilt) and quality, plus colour grades. Set them for the **whole game**, override them for **one scene** (battles there follow it) or for the **world map**; ↺ puts back a single dial. Ready-made presets (Sunny, Overcast, Golden hour, Cave, Mall), your own presets, a "Hold to compare" button that shows the built-in look, and a frame meter. |
| **Map art** (under World) | Paint `world.png` with a brush, fill, color picker, clone and "fill with terrain". Remove the painted trail and repaint it along the stops in the exact path the game walks. Drag a stop and its painted patch moves with it, with the old spot filled from the terrain around it. A preview shows the stop from the game's map camera. |
| **Trainers, People** | Trainer teams, dialogue, rewards, badges, sandstorms; trainer and shopkeeper looks with a live preview. |
| **Rules** | How you travel (walk the world yourself, or real-world steps), and every number that tunes the game: starting items, starters and rival, daily step rate, encounter rate, leveling curve, team size, eggs, jobs, damage, critical hits, type abilities, taxing, bargains. |
| **Art files** | Browse, download and replace any image. |
| **Check & backups** | Lists problems with "Show me" links; restores earlier versions. |
| **Find and Connections** | Ctrl+K finds any setting or thing and takes you to it; Ctrl+L shows what the thing you're editing uses and what uses it, or, for an engine dial, where its value comes from and what it depends on. |

**Save to game** (Ctrl+S) writes into `game/data/gamedata.js`, `game/art/rigs.js` and the
changed images. Each save keeps the previous file in `backups/`. Undo/redo cover every
edit in the session. **Play test** opens the game with the debug menu at
`localhost:8001`, which keeps a separate save from your normal game. Reload the game tab
to see saved changes.

The Studio only listens on your own computer, only writes inside `game/data` and
`game/art`, and only accepts requests carrying the key it puts into its own page.

You can also edit `game/data/gamedata.js` by hand: it is JSON after `window.GAMEDATA=`.
The game tolerates mistakes. It skips anything it can't use and lists it in the debug
menu.

## Project layout

- `game/`: the game. `index.html`, `sw.js` (offline cache), `manifest.webmanifest`.
  - `data/gamedata.js`: all game data and rules, edited by the Studio.
  - `js/`: game code. `data.js` builds everything from the data file. `frame.js` is the
    scheduler, `scene.js` the battle stage, `battle.js` battle rules and HUD, `shop.js`
    shops, `debug.js` the debug menu, `log.js` the debug log and quick test, `map.js` the world map, `boot.js` loading and the
    art check. `css/loader.css` is the loading screen, `css/battle.css` the full-screen battle,
    `css/polish.css` the interface details and animations, `css/screens.css` the Team and Trainer
    screens over the live scene.
  - `art/`: your v6 art (unchanged pixels), `rigs.js` skeletons, `manifest.js` atlas rects.
  - `fonts/`: bundled fonts (SIL Open Font License, see `fonts/OFL.txt`).
- `game/js/engine/`: the 3D engine (v12). `settings.js` lists every dial with its default, range and
  presets; `core.js` sets up WebGL, compiles shaders and loads textures; `light.js` the sun, shadow
  map and lights; `post.js` depth of field, bloom and color grading.
- `game/js/trainer.js`: trainers on the skeleton system (looks, colours, poses, portraits);
  `game/js/dressing.js` the dressing room and boutiques; `game/js/cutscene.js` the opening cutscene;
  `game/js/selftest.js` the full test; `game/js/sound.js` sound and music; `game/js/talk.js`
  conversations; `game/js/story.js` story scenes in the walk scenes (Blake); `game/js/buildings.js` the 3D
  buildings (walls, roofs, see-through windows with rooms); `game/js/structures.js` bridges,
  railings, arches and escalators (v18); `game/js/props3d.js` solid props, parts and trees (v19–v21); `game/js/life.js`
  ducks, pigeons, chickens, sheep and traffic.
  Wardrobe data is `wardrobe` in `data/gamedata.js`, pictures in `art/trainer/`. `tools/trainer_gen/`
  and `tools/build-trainer-art.py` drew them.
- `game/js/battle-gl.js`: battles on the engine (moves the scene canvas into the battle stage and
  hands the engine the billionaires and trainers). `game/js/map-gl.js`: the map on the engine, its
  pins, step counts, Places list and flat view.
- `game/js/diorama-gl.js`: the walk scene on the engine: heights, ground, grass, water, props,
  people, camera and effects. It reuses the walking and scene logic in `diorama.js`.
- `game/js/diorama.js`: the canvas walk scene renderer (used for Lite), walking (a half-meter grid with path finding),
  townsfolk, shadows and effects. Scenes, the prop catalog and the roads (`links`) are in
  `data/gamedata.js` (`scenes`, `scenery`, `links`); pictures in `art/scene/props`,
  `art/scene/tiles`, `art/scene/far` and `art/scene/fx`.
- `tools/build-scene-props.py`, `tools/build-scene-tiles.py`, `tools/build-scenes.py`: the
  generators that made the props, tiles and scenes. `build-scenes.py --force` rebuilds every scene
  from scratch (your scene edits are lost); `--scenes` rebuilds the scenes but keeps your catalog;
  `--catalog` only refreshes the prop catalog. `tools/build-test-scenes.py` builds the test scenes.
  `tools/build-walls.py` draws the cliff and wall
  textures (`--force` to redraw them). `tools/repaint-world-trails.py` repaints the map trail along the roads. Use the Studio once
  you've made changes.
- v47 tools (the top of each file says what it writes and what it leaves alone):
  `tools/build-terrain-v47.py` the ground (twelve tiles per kind in `art/next/tiles47/`, the 22 new kinds and the 12
  room floors), `tools/room-floors-v47.py` a floor of its own for every room (`--dry` says what would change),
  `tools/build-loader-v47.py` the loading screen's runner and coins, `tools/build-landmarks-v47.py` the landmarks, `tools/build-life-v47.py` signs of people,
  `tools/build-fx-v47.py` bees, fish and moths, `tools/build-regions-v47.py` the 27 places of the seven regions and
  `tools/build-region-props-v47.py` their props, `tools/build-map-minis.py` the map's miniatures (`--all` redraws
  them).
- alpha 0.1 tools: `tools/clear-windows.py` finds the props that stand in front of a window (on a building's front
  or a room's wall) as the walk camera sees them, and `--fix` moves them aside; the place builders run it on every
  place they make.
- One-time migration tools that already ran, and `retired/`, are on the `legacy` branch only.
- `studio/`: Pocket Billies Studio (web app). `js/skeleton.js` is the skeleton builder,
  `js/preview.js` the battle preview (it loads the game's `scene.js`), `js/mappaint.js`
  the map painter, `js/engine.js` the Engine section, `js/propedit.js` the prop editor, `js/wardrobe.js` the Wardrobe section. `start-studio.py`: its local server.
- `backups/`: created by the Studio on first save.
- `tools/check-quick.py`: the quick check (about 6–9 minutes even without a graphics chip): code and
  data, shaders, walkable paths in every scene, every scene drawn once, the opening, a walk, a trip and
  two battles; `--studio` adds a Studio round trip, `--closeups` close-ups of the cliffs and water,
  `--scenes=city,pond` limits it to some scenes. Results in `validation/quick/`.
- `tools/check-game.py`: the long play-test in a real browser at four screen sizes, plus a Studio
  round trip on a temporary copy (`--studio`). Best on a computer with a graphics chip. Run
  `pip install playwright && python3 -m playwright install chromium` first. Screenshots and
  `results.json` go to `validation/`.
- The game's own **full test** (the debug menu: Settings → Debug, or Ctrl+Shift+D → Full test) measures frame rates and stress-tests
  the renderer, which only means something on real hardware, so neither script runs it: run it on
  your phone or computer and send the debug log.
- `tools/build-art.*`, `tools/src/`: the procedural art generator from earlier versions.
  **Running it regenerates the art and overwrites your hand-edited sheets.** Use the
  Studio for art changes.

## Notes and limits

- Step counting uses motion sensors while the page is open. Apple Health and Health
  Connect are not connected.
- Moving a stop under Route stops moves only its marker and the walking path. Move it
  under Map art to carry its painted patch along, then repaint the trail. Patch moving
  keeps the colors that stand out from the ring around the stop, so a patch larger than
  the patch-size setting is only partly carried.
- Blank bodies are simple colored shapes meant to be painted over. Removing the trail
  and moving patches fill holes from the surrounding terrain, which suits the map's flat
  color areas; touch up with the brush or clone tool where needed.
- New parts make sheets taller. They are never packed tighter automatically, so a
  heavily edited billionaire's sheet can grow a little each time you add parts.
- Checked in Chromium at phone, tablet, desktop and phone-landscape sizes, in light,
  dark and Lite modes. The checks covered every screen, every battle backdrop, trainer
  battles, shops, evolution, hatching, broken game data and a full Studio save
  round trip. Version 8 adds checks of the skeleton builder (moving, tilting, renaming,
  adding, mirroring, deleting, undo), blank bodies in every body plan, the battle
  preview and map painting, each saved and loaded in the game. Version 14 adds the opening cutscene (skip, dressing room, starter
  pick) on phone and desktop and the Studio's Wardrobe section. Real phone motion sensors, touch throws and vibration still need a
  device check.

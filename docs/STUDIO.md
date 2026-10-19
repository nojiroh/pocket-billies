# Pocket Billies Studio

The Studio edits the game's data, skeletons and art. It runs from the game's site (`…/studio/`): sign in with a GitHub
token, and **Save to game** puts your changes on a new branch with a pull request, so nothing changes in the game
until the owner merges it. Started from `start-studio.py` on your own computer (not in this repository yet), saves go
straight into `game/data` and `game/art`.

## Local mode (start-studio.py)

Double-click `Start-Studio.bat` / `Start-Studio.command`, or run
`python3 start-studio.py`. It opens at **http://localhost:8001**.

## Sections

| Section | What you can do |
|---|---|
| **Billies** | Names, Field Guide text, types, height and weight per stage; stat profile or exact stats; moves learned and when; how and when each stage evolves; where it appears. Animated front/back preview with every action, normal or Golden. |
| **Edit pixels and skeleton** | Pixel editor on the real sprite sheets: pencil, eraser, fill, color picker, palette from the sheet, zoom, grid, part outlines, undo/redo, live animated preview. Rebuild the Golden sheet from the normal one. Download a sheet, edit it in another app, upload it back. Nudge where each body part attaches and how parts stack. |
| **Skeleton builder** | Build or reshape a body: add parts (blank or from a PNG), drag parts and pivots, tilt, re-parent, mirror a limb with everything attached to it, choose which motion each part follows, switch the body plan, and copy a layout between the front and back views. |
| **+ New Billie** | Start from a blank body (biped, four-legged, flyer, fish, blob or worm) in a color you pick, or copy an existing Billie's skeleton and recolored art. Either way it works in the game immediately. Add or remove evolution stages, duplicate, recolor or reorder lines. |
| **Battle preview** | The game's battle stage with your unsaved changes. Pick any two Billies (normal or Golden) and a backdrop, then play any move with any outcome, status effects, wild and trainer intros, taxes, faints, sandstorms and camera moves at ½×, 1× or 2× speed. Sky and haze colors change live. |
| **Robots** | Phase 17. Torsos, arms, legs and gems: names, types, weight, toughness, what the legs carry, the move each part gives, stats, and pictures (front and back, a torso's head, a gem's chest picture), with a colour and shape for the stand-in when a part has no picture. Rules: the stat floor, upgrades, the gem's type bonus, weight, part HP and where hits land. **Try a build** draws any gem and parts as the game does and shows its types, weight, stats and moves. A trainer's team entry can be a robot (Trainers). |
| **Moves** | Name, type, kind, power, accuracy, priority, description and an effects builder (status, stat changes, healing, draining, hedging, hype, rent, market shock, delayed delivery and more). |
| **Types** | Colors, the full matchup chart (click to cycle 2× / ½×), each type's battle ability and particle effects. Renaming a type updates everything that uses it. |
| **Items & coins, Town shops, Day Jobs** | Prices, effects, icons (or upload your own), what each shop sells, keepers, greetings, job pay (jobs are kept for the ranch, phase 12, and unused for now). |
| **World & encounters** | Stops on a drag-and-drop world map and the **roads** between them (add, remove, re-point, pick the exit it leaves by at each end: both must face each other, or the Check lists it as an error; a road's length is measured from its two exits; the glass lift is set on its lift props); gates, shops, backdrops; wild encounter tables; eggs; regions ahead; which walk scene each stop uses; battle backdrop colors and ambience. |
| **Prop editor** (in Walk scenes) | Open any prop and edit everything about it on its picture: drag the base point, click to add lamp glows, lit windows, fires, smoke, water spray and sparkles exactly where they belong (drag to move, Delete to remove), set the door, see the footprint. Add **layers** (from a PNG or a copy of the main picture) and place each one in front of or behind the main picture in meters, shift it, make it face the camera, stay put as the world turns, or lie flat, and let it glow. A 3D turntable shows the prop in the game's renderer while you work. |
| **Walk scenes** | The scene for each stop: shape the land (raise, lower, smooth, flatten); paint the ground tiles; place, move, resize and mirror props; drag the **hub** (where you stand when you stay) and the **exits** roads leave through; choose what a prop does when tapped (shop, clinic, a message), its label and its words; distant hills, townsfolk and what they say, wind, sun rays, sky, haze, shade, tilt-shift blur and camera. The live preview runs the game's renderer: walk around in it and tap things. Paint prop pictures and ground tiles pixel by pixel; set a prop's shadow, sway, solid footprint, door and walkable area; add new props (blank or from a PNG) and new ground types. **People who talk** edit each person's id, spot, facing, `when` / `unless` and script. **Story preview**: pick a start preset and switch flags; who isn't there for them is hidden in the 3D preview and faded on the map. **Play from here** opens the game in this place on the spot you pick (Pick the spot, or where the preview's walker stands), at the preview's preset and flags, with your unsaved changes. |
| **Engine** | Every dial of the 3D renderer, with a live preview of any walk scene: lens (sharp band, blur in front and behind, round highlights, chromatic aberration, vignette, grain, sharpen), color (exposure, highlight roll-off, contrast, saturation, warmth, bloom), sun and sky (direction, height, color, real-clock sun, sky light, ground bounce, clouds and their shadows, light shafts), shadows (strength, softness, color, contact shadows, solid building shadows, ambient occlusion), lights, haze and mist, horizon curve, ground bumpiness and shine, world map mountains, grass and wind, water, camera (including distance and tilt) and quality, plus colour grades. Set them for the **whole game**, override them for **one scene** (battles there follow it) or for the **world map**; ↺ puts back a single dial. Ready-made presets (Sunny, Overcast, Golden hour, Cave, Mall), your own presets, a "Hold to compare" button that shows the built-in look, and a frame meter. |
| **Map art** (under World) | Paint `world.png` with a brush, fill, color picker, clone and "fill with terrain". Remove the painted trail and repaint it along the stops in the exact path the game walks. Drag a stop and its painted patch moves with it, with the old spot filled from the terrain around it. A preview shows the stop from the game's map camera. |
| **Trainers, People** | Trainer teams, their script (checked as you type), when they're there, rewards, badges, sandstorms; trainer and shopkeeper looks with a live preview. |
| **Story scripts** | Project Story S3: story.json's own scripts (Hazel's lab, after Blake's first battle, the ending): add, rename, remove and edit them in the script field; the story's flags, start presets (with ▶ Play) and quests to read. |
| **Scripts everywhere** | Every script field (a trainer's, a person's, story.json's) shows the parser's error at once and the story checks a moment later, each on its line (click to go there); **Add line ids**; **Commands**, a reference built from the parser's own tables that puts a command in the script. Condition fields (when, unless, a place's requires) are checked the same way, and the Check lists every story finding. docs/SCRIPTS.md. |
| **Rules** | Every number that tunes the game: starting items, starters and rival, wild Billies per place and how fast they come back, prize money, leveling curve, team size, eggs, damage, critical hits, type abilities, taxing, bargains. |
| **Art files** | Browse, download and replace any image. |
| **Check & backups** | Lists problems with "Show me" links; restores earlier versions. |
| **Find and Connections** | Ctrl+K finds any setting or thing and takes you to it; Ctrl+L shows what the thing you're editing uses and what uses it, or, for an engine dial, where its value comes from and what it depends on. |

## Saving in local mode

**Save to game** (Ctrl+S) writes the game data, `game/art/rigs.js` and the
changed images. Each save keeps the previous file in `backups/`. Undo/redo cover every
edit in the session. **Play test** opens the game with the debug menu at
`localhost:8001`, which keeps a separate save from your normal game. Reload the game tab
to see saved changes.

The Studio only listens on your own computer, only writes inside `game/data` and
`game/art`, and only accepts requests carrying the key it puts into its own page.

The game data is JSON files in `game/data/` (a file per map, line, trainer and person, one per
other section; `index.json` lists them). On GitHub, **Propose changes** sends only the files
you changed. You can also edit them by hand; `npm run check:data` checks them (and
`node tools/check-data.mjs --fix` lays a hand-edited file out the way the Studio writes it).
The game tolerates mistakes. It skips anything it can't use and lists it in the debug
menu.

Local mode needs `start-studio.py`, which is not in the repository; it still reads and writes
the old single `gamedata.js` and would have to be changed to the data files (phase 04b).


## Notes and limits

- Moving a stop under Route stops moves only its marker and the walking path. Move it
  under Map art to carry its painted patch along, then repaint the trail. Patch moving
  keeps the colors that stand out from the ring around the stop, so a patch larger than
  the patch-size setting is only partly carried.
- Blank bodies are simple colored shapes meant to be painted over. Removing the trail
  and moving patches fill holes from the surrounding terrain, which suits the map's flat
  color areas; touch up with the brush or clone tool where needed.
- New parts make sheets taller. They are never packed tighter automatically, so a
  heavily edited billionaire's sheet can grow a little each time you add parts.
- Checked in Chromium at phone, tablet, desktop and phone-landscape sizes, in light
  and dark modes. The checks covered every screen, every battle backdrop, trainer
  battles, shops, evolution, hatching, broken game data and a full Studio save
  round trip. Version 8 adds checks of the skeleton builder (moving, tilting, renaming,
  adding, mirroring, deleting, undo), blank bodies in every body plan, the battle
  preview and map painting, each saved and loaded in the game. Version 14 adds the opening cutscene (skip, dressing room, starter
  pick) on phone and desktop and the Studio's Wardrobe section. Real phone motion sensors, touch throws and vibration still need a
  device check.

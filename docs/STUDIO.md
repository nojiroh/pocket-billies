# Pocket Billies Studio

The Studio edits the game's data, skeletons and art. It runs from the game's site (`…/studio/`): sign in with a GitHub
token, and **Save to game** puts your changes on a new branch with a pull request, so nothing changes in the game
until the owner merges it. Started from `start-studio.py` on your own computer (not in this repository yet), saves go
straight into `game/data` and `game/art`.

## Local mode (start-studio.py)

Double-click `Start-Studio.bat` / `Start-Studio.command`, or run
`python3 start-studio.py`. It opens at **http://localhost:8001**.

## Layout (studio track ST-1)

The Studio is built for wide screens (up to 3440 x 1440) and still works on a tablet.

- **Handles.** Drag the edge of the section list, of a section's list (Billies, Moves, Props and the others with a
  list) and of the battle preview's side panel. A handle also takes the keyboard: Tab to it, then the arrow keys (8 px,
  Shift 32 px), Home and End for the smallest and largest, Delete or a double-click to go back. Each section keeps its
  own sizes (in this browser).
- **Wide screens.** On a window of about 1920 px lists and side panels get wider; from about 2560 px an editor beside
  its list puts its cards in two columns, and the battle preview's stage fills the height with the controls beside it.
- **Two sections side by side.** The ⇥ button next to a section in the list (or Shift-click) opens it on the right.
  Drag the line between the two panes; **Swap** or **Close** on the right pane's bar. Walk scenes, Props, Engine and the
  Battle preview have a 3D view (there is one), so they only open on the left. Undo and Save cover both panes. The
  split comes back when you open the Studio again; below 1000 px the right pane hides.
- **Layout presets** (top bar, from 1200 px): Auto (sizes follow the window), Compact, Wide, Ultrawide and Split (two
  sections). A preset sets every section's sizes; after a drag it says "adjusted", and Reset sizes goes back to it.

## The pixel canvas (studio track ST-2)

One canvas paints the Billies' sheets (Edit pixels) and props and ground tiles (Walk scenes and Props → Edit pixels).

- **Tools.** Pencil (B), eraser (E), fill (G, stays inside the part), pick a colour (I, or hold Alt), line (L, or
  Shift-click with the pencil from where the last stroke ended), select a box (M).
- **Flip ↔, Flip ↕ and Turn ⟳** (Shift+H, Shift+V, Shift+R) act on the selection, else on the part under the pointer
  (on a prop or tile, the whole picture). A box that is not square turns into one the other way round on the same
  middle; art turned onto a neighbour's pixels covers them.
- **Symmetry** (Y, or the side panel): left-right, top-bottom or both, about the middle of the selection, else of the
  part under the pointer; the axis is drawn and can be moved by half pixels.
- **Game palette.** Lock to it (K) and every colour snaps to its nearest shade; its ramps become swatches. "Show
  colours not on it" paints the pixels that are off it in magenta and counts them.
- **Onion skin** (O, sheets only): the same part of the other view (Front or Back), faint under the part you point at.
- **View.** Whole-number zoom (+ and −, 1 to 6 for 1x to 32x, 0 to fit, Ctrl+wheel; it keeps the pixel under the
  pointer), the grid from 8x (Ctrl+'), Space-drag or the middle button to move the view.
- **Undo.** Each stroke, flip, turn, upload, revert and resize is one step of the Studio's undo, in order with every
  other edit (a skeleton number, a field). Switching Front/Back or closing the editor keeps them.
- **`?`** anywhere outside a text field lists every key in the Studio, the open tool's first.

## Art workbench: Sheet mode (studio track ST-3)

Cuts a sheet of art into parts (Billies & battles → Art workbench). Part mode is below; Pixels and Model come later.

- **Drop sheets anywhere** on the Studio (or Open sheets…); several at once, with an Aseprite JSON beside its PNG
  (same name). A name ending in front or back sets the sheet's view; the list beside each sheet changes it. Dropped
  sheets stay in this tab only and are never saved: keep the sources yourself (the kits' are in
  tools/art-source/part-kit).
- **Kit.** Parts go in a kit (partKits.json `kits`). A kit's own sheet (`beasts-front.png`) takes its settings: the
  phase 16 kits slice by **kit rows** (magenta, one animal a column, one kind a row, then the extras, a quarter of the
  size), exactly as tools/slice-part-kit.py did, so writing them again changes nothing.
- **Other ways to find parts.** Islands of art (touching at edges and corners or edges only, pieces closer than a gap
  joined, specks under a size left out), a template grid (columns, rows, cell size, start, gaps; optional trim), or
  an Aseprite JSON's slices (else its frames), named by them.
- **Background.** The colour around the edge (guessed), clear pixels, magenta, or a colour you pick on the sheet; with
  how close a colour counts. "Only background that joins the edge" keeps background colour inside a part.
- **Snap to pixels.** Art drawn big (an AI image at about 4x) is found on dropping: its pixel size and where the grid
  starts, drawn over the sheet and nudgeable. Each cell becomes one pixel of its most common colour.
- **Names.** A template: {kit} {n} {row} {col} {name} {view}; a name ending in _front or _back puts the part in that
  view (front and back on one sheet). Click a part (on the sheet or in the list) to rename it or pick its kind. Back
  parts take the name of the front part they match by position.
- **Write N parts to the game** puts the pictures in art/next/parts/<view>/<id>.png and the parts in partKits.json
  (kind, slot, pivot, size M, sockets worked out from the outline; a view not on these sheets stays as it was). Then
  Save. One undo takes the pictures back (new ones go away), one more the parts.

## Art workbench: Part mode (studio track ST-4)

Art workbench → **Part**: a part written by Sheet mode, its joints. The numbers are in game/js/logic/part-joints.js.

- **The list** filters by kit and kind, or finds a part by name; front and back thumbnails.
- **Front and back side by side**, each on the shared pixel canvas. The **pivot** is the crosshair; until moved it is
  the joint (a limb), chin (a head) or base (a tail) socket, else the part's pivot. **Sockets** are coloured dots,
  labelled with the slots they take. Drag one, or click it and nudge it with the arrow keys (1 px; Shift ¼ px). Each
  view has its own pivot. Every drag or nudge is one undo step. Moved sockets are kept in partKits.json `sockets`, so
  slicing the sheet again doesn't move them back.
- **Sockets** (side panel): rename, remove, add (it starts on the pivot in both views); the slots each one takes. A
  part starts with the kit's rule for that socket name (`socketRules`); changing it makes the part's own (`accepts`,
  ↺ goes back).
- **Turn and draw order**: how far the part turns about its pivot (degrees, clockwise positive) and its z per view
  (higher in front; from behind, arms go under the body). Each kind has defaults (`turns`, `z`); ↺ goes back to them.
- **Test fit**: the part on a body (the same animal's torso first) at a socket that takes it, both views, at the size
  shown (S, M, L). The turn slider stays inside the limits; Swing moves it back and forth. A body part picks a part
  to hang on itself instead. On the other side of the body the part is mirrored, or its copy is used.
- **Mirror to other side** makes `<id>_r`: the pictures (and painted sizes) flipped, the pivot and sockets mirrored,
  L and R names swapped (shoulderL ↔ shoulderR), turn limits mirrored. Mirroring the copy gives the part back.
  `sides` says which side each kind's art is drawn for (arms right, legs left, as the rework placeholders draw them).
- **S, M, L**: S and L are M scaled about the pivot (rules.json `parts.sizes`). **Paint S/L** makes its own picture
  beside M (`<id>_s.png`, `_l.png`), starting from M scaled: Points, Pencil, Eraser, Fill and Pick in the bar, and a
  colour. Points moved there belong to that size. **Back to scaled** stops using it (the picture stays in art/).

## Art workbench: robots in Part mode (studio track ST-5)

Part mode's **Robots** source (beside **Kits** above the list) shows robots.json the same way; the numbers are in
game/js/logic/robot-joints.js. The Robots section's **Edit joints on the workbench** (and, for a torso, **The head's
joints**) opens it on that part, in the pane the Robots section is in.

- **The list**: every robot part with a picture, a torso's head as `<torso>:head`, each gem as `gem:<id>`.
- **Points** are where the game joins the pictures. A torso's sockets follow the socket standard: `neck` (the head),
  `shoulderL`, `shoulderR` (arms), `hipL`, `hipR` (legs), `hip` (treads and hover), `gem`. An arm, legs or head has a
  pivot only: the point it hangs from and turns around. Until moved they are worked out from the picture, as the game
  always placed them; a back point not moved keeps the front's offset from the pivot.
- Drag or nudge (1 px; robots are whole pixels) and the point is stored in the part's `art.joints` (a head's in its
  torso's `art.headJoints`), per view; every drag or nudge is one undo step. **Back to computed** drops a view's
  stored points. Draw order per view and turn limits (for the test fit only: the game's poses don't read them yet)
  are stored too (`turn`, `headTurn`). Gems sit on their centre and store nothing.
- **Test fit**: arms and legs are drawn the same on both sides, not mirrored. The battle preview (and the Robots
  section) redraw the robots after every change.
- Stored points belong to the part's own pictures; a stand-in (a part without a picture) always uses computed points.
  Socket names, socket rules, S/L and Mirror are kit-only.

The battle preview offers robots too: the Robots section's Try a build and every trainer's robots.

## World map look (phase 10)

World & encounters → **World map look** edits game/data/worldmap.json, the world map's look.

- **The bowl from above.** A picture worked out with the game's own code as you edit: sea and land, rivers, routes,
  trees in clumps, places (▲: it has a landmark). **Open the 3D bowl** opens the game's world map with your unsaved
  changes (nothing there is saved).
- **Brush.** Land brush (L) and Sea brush (W) force land or sea where a stroke passes; Remove strokes (X) takes away
  the strokes you click; Look (V) does nothing; [ and ] change the size. The keys work while the pointer is over the
  picture. A place's own ground and the routes always stay dry. Each stroke is one step of Undo.
- **The sea.** How much of the bowl is sea (before painting), how rough the coast is, how much the land rises towards
  the rim (high: an inland sea), how deep it is, and a seed for another coast. The Check warns outside 30-50% sea.
- **Relief.** How much each kind of place lifts or lowers the ground round it, and its own ground there.
- **Regions.** Each region's ground between places, its wet lowland, dry slopes and high ground (the game's terrain
  tiles; ✎ opens one in the pixel canvas), and the trees in its clumps.
- **Landmarks.** On a stop (Route stops), **Landmark on the world map**: Auto (the biggest landmark in its walk scene)
  or one of its scene's landmarks and buildings; far out the map shows it standing up as its own picture.

## Sections

| Section | What you can do |
|---|---|
| **Billies** | Names, Field Guide text, types, height and weight per stage; stat profile or exact stats; moves learned and when; how and when each stage evolves; where it appears. Animated front/back preview with every action, in any coat. |
| **Coats** | A coat recolours a Billie's art (in place of the old Golden sheets). Swap whole palette ramps (every shade of one becomes the same shade of another), then exact colours; art a little off the palette follows the nearest shade. How often each coat turns up in the wild, from eggs and on the line (empty: never). Give one Billie its own hand-painted sheet for a coat: it starts as the recolour; download it, paint it, upload it back. A before/after preview on any Billie. |
| **Edit pixels and skeleton** | Pixel editor on the real sprite sheets (the pixel canvas, above): every tool, part outlines, an onion skin of the other view, a live animated preview. Download a sheet, edit it in another app, upload it back. Nudge where each body part attaches and how parts stack. |
| **Skeleton builder** | Build or reshape a body: add parts (blank or from a PNG), drag parts and pivots, tilt, re-parent, mirror a limb with everything attached to it, choose which motion each part follows, switch the body plan, and copy a layout between the front and back views. |
| **+ New Billie** | Start from a blank body (biped, four-legged, flyer, fish, blob or worm) in a color you pick, or copy an existing Billie's skeleton and recolored art. Either way it works in the game immediately. Add or remove evolution stages, duplicate, recolor or reorder lines. |
| **Battle preview** | The game's battle stage with your unsaved changes. Pick any two Billies (each in any coat) and a backdrop, then play any move with any outcome, status effects, wild and trainer intros, taxes, faints, sandstorms and camera moves at ½×, 1× or 2× speed. Sky and haze colors change live. |
| **Robots** | Phase 17. Torsos, arms, legs and gems: names, types, weight, toughness, what the legs carry, the move each part gives, stats, and pictures (front and back, a torso's head, a gem's chest picture), with a colour and shape for the stand-in when a part has no picture. Rules: the stat floor, upgrades, the gem's type bonus, weight, part HP and where hits land. **Try a build** draws any gem and parts as the game does and shows its types, weight, stats and moves. A trainer's team entry can be a robot (Trainers). |
| **Moves** | Name, type, kind, power, accuracy, priority, description and an effects builder (status, stat changes, healing, draining, hedging, hype, rent, market shock, delayed delivery and more). |
| **Types** | Colors, the full matchup chart (click to cycle 2× / ½×), each type's battle ability and particle effects. Renaming a type updates everything that uses it. |
| **Items & coins, Town shops, Day Jobs** | Prices, effects, icons (or upload your own), what each shop sells, keepers, greetings, job pay (jobs are kept for the ranch, phase 12, and unused for now). |
| **World & encounters** | Stops on a drag-and-drop world map and the **roads** between them (add, remove, re-point, pick the exit it leaves by at each end: both must face each other, or the Check lists it as an error; a road's length is measured from its two exits; the glass lift is set on its lift props); gates, shops, backdrops; wild encounter tables; eggs; regions ahead; which walk scene each stop uses; battle backdrop colors and ambience. |
| **Prop editor** (in Walk scenes) | Open any prop and edit everything about it on its picture: drag the base point, click to add lamp glows, lit windows, fires, smoke, water spray and sparkles exactly where they belong (drag to move, Delete to remove), set the door, see the footprint. Add **layers** (from a PNG or a copy of the main picture) and place each one in front of or behind the main picture in meters, shift it, make it face the camera, stay put as the world turns, or lie flat, and let it glow. A 3D turntable shows the prop in the game's renderer while you work. |
| **Walk scenes** | The scene for each stop: shape the land (raise, lower, smooth, flatten); paint the ground tiles; place, move, resize and mirror props; drag the **hub** (where you stand when you stay) and the **exits** roads leave through; choose what a prop does when tapped (shop, clinic, a message), its label and its words; distant hills, townsfolk and what they say, wind, sun rays, sky, haze, shade, tilt-shift blur and camera. The live preview runs the game's renderer: walk around in it and tap things. Paint prop pictures and ground tiles pixel by pixel; set a prop's shadow, sway, solid footprint, door and walkable area; add new props (blank or from a PNG) and new ground types. **People who talk** edit each person's id, spot, facing, `when` / `unless` and script. **Story preview**: pick a start preset and switch flags; who isn't there for them is hidden in the 3D preview and faded on the map. **Play from here** opens the game in this place on the spot you pick (Pick the spot, or where the preview's walker stands), at the preview's preset and flags, with your unsaved changes. **Free camera** (🎥 under the preview, or C): the camera leaves the walker and flies over the scene like a map app: drag to move (the ground stays under the pointer), right-drag to turn and tilt, the wheel to zoom towards the pointer, double-click to look at a spot; on a phone one finger moves, pinch zooms, twist turns, two fingers up or down tilt; W A S D, Q E, R F and Page Up/Down too. **Top view**, ▲ ▼, **Walker here** and **Back to the walker**; each scene keeps its camera while the Studio is open, and Play from here starts where it looks. |
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

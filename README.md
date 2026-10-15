# Pocket Billies: Gotta tax 'em all! — alpha 0.4.1

A walking RPG inside the Hollow Earth, where the Billies are the wildlife. This is the game that was called
**Net Worth**: alpha 0.1 is the first release under its new name, and releases are numbered afresh from here (Net
Worth's last was v47.1). Alpha 0.4 joins the places edge to edge, gives every town its own character (a new start
in Copperleaf Town, airships, Pearlantis City under the sea, postcards) and brings weather fronts, flowers in the grass,
fire, and windows and lamps that light properly. Alpha 0.4.1 lets you walk the world yourself with a joystick, like a
classic RPG, and makes the Studio easier to find your way in.
Version 47 gives the game its whole story: a new opening (you fall through the crust and wake in Sundown with no
memory), a world that keeps its own hours, and the seven regions east of the Mall, from the Meadowlands to the
Inner Sun, where the story ends.
Version 18 gives the walk scenes real shape: sheer cliffs and terrace walls, stairs with railings,
ledges you hop down, bridges over streams and ravines, waterfalls, arches and the Mall's escalators.
Version 17 made the world bigger and more alive: the stops sit farther apart, every walk scene is
larger and more natural, with raised terraces, ramps and stone steps, and a new **big city,
Capital Gains**, stands in the middle of the map with traffic, pigeons, shops and a clothes outlet.
Houses, shops and towers are now real **3D buildings** with pitched roofs and windows you can look
into; trees and bushes have layered crowns; the ground has five variants of every texture and eight
new ground types. Version 16 added sound, music, conversations and your rival Blake. Everything is
editable in **Pocket Billies Studio**.

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

## What changed in alpha 0.4.1 (walk it yourself, and a Studio that's easier to find your way in)

### Moving about
- **Walk the world yourself, like a classic RPG.** You walk through the towns and along the roads between them; walk
  over the edge of a town and you are on the road, walk on and you are in the next town. Every few metres you walk
  count as steps, which still earn money, hatch eggs and train your buddy. The old way (real-world steps carrying you
  along the route) is kept: Studio → Rules → **How you travel**.
- **A joystick.** Drag anywhere on the scene and a stick appears under your thumb; you walk where you push, relative to
  the camera. Settings → Controls → **Moving about** offers a fixed **D-pad** instead, or tap only. Tapping the ground
  still walks you there in every mode.
- Picking a place on the map makes it a **guide**: gold arrows lead you there, and "Stop guiding me" ends it.
- Touching near an airship now picks what's under it (the ship itself can't be tapped; its station can).

### Airships and stations
- The old train stations are gone. Every town has an **airship station** in the open, with the mast, a lift cage,
  a canopy, a ticket kiosk, benches and lamps; no room inside. The airship is a separate prop moored at the mast and it
  **bobs in the wind**, swinging a little round the mast.

### Buildings
- Roofs no longer show walls poking through on buildings turned along their street (the front picture turns with the
  building now).
- More depth: sills and lintels at the side and back windows, posts at the corners and a plinth round the foot.
- An edit to a building in the Studio (its roof, colours, kind) shows in the preview at once.

### Light and the graphics settings
- Every engine setting was checked for a visible effect, from the game's camera. Those that did nothing from above now do:
  - **Light shafts**: when the sun is off the picture (nearly always, looking down), rays stream from bright places
    toward the side the sun shines from.
  - **Glare**: with the sun off the picture, a soft light leak on that edge.
  - **God rays**: the air near the ground, under trees and roofs, now shows light and shadow columns.
  - **Clouds** sets how much of the ground the cloud shadows cover.
  - **Bloom** starts a little lower, so bright sunlit things glow too.
- **Trees shade themselves**: the crown puts its trunk and its lower and inner leaves in shade, from the side the sun
  shines (Engine → Shadows → Trees shade themselves).
- On devices where the processor, not the graphics chip, is the slow part, automatic quality no longer turns god rays
  and light shafts off for nothing.

### Settings
- Look → **Graphics** is one choice now (Best, Balanced, Battery saver) instead of two overlapping ones.
- **Moving about** moved to the Controls tab; the help text describes the joystick and D-pad.
- Saves only need to work with this version: old save formats are no longer converted (the old species table is gone).

### Pocket Billies Studio
- **Find (Ctrl+K or /)**: one search box for every engine dial, every setting on the Rules, Types, Items and Jobs pages,
  every section and every Billy, move, item, trainer, shop, place, route stop and prop. Pick a result: the Studio
  opens it, scrolls to the setting and makes it blink.
- **Connections (Ctrl+L)**: a drawer that maps how the thing you're editing hangs together with the rest of the game.
  For a Billy, move, place or prop: what it uses and what uses it. For an engine dial: where its value comes from
  (built in → the whole game → a place's own look), the dials it needs, the dials that only matter when it is on, and
  when automatic quality turns it off. Click any box to go there.
- **The 3D previews** (Walk scenes, Engine, Battle preview) have a bar for zoom, turning, reset and a **bigger view**
  (Esc goes back). The plain wheel zooms, the camera turns all the way round, and W A S D walks while the pointer is
  over the preview (map shortcuts wait meanwhile).
- The previews always show the engine at full quality (the game's automatic quality used to turn effects off in a slow
  preview, so dials seemed to do nothing), and the ground, grass, water and quality dials rebuild the preview.
- The sections sit in five groups that fold away.

## What changed in alpha 0.4 (one world, places with character, weather and light)

The three parts planned after alpha 0.1 come together in one big update. Your save carries over: every place keeps its
number, the new ones are added after them, and a game you have already started stays where it is (only a new game
starts in Copperleaf).

**The world's shape**
- **Places joined edge to edge.** There are no roads between places any more: a route's ends are the edges of the
  places it links, so you walk out of one place straight into the next. Each side where two places meet grew a 12 m
  strip whose ground, height and plants carry one into the other, the path crosses the seam at the same spot, width
  and height, and the sky, haze and camera ease from one place to the next as you cross. Places under the ground (Fizzwell
  Town, Gloomwater Pool, Glimmershaft) are a mountain with tunnel mouths from outside.
- **How steps move you.** A route's length is its step cost (14.1 steps a metre): as your steps come in, your trainer
  walks the route and on into the next place. Marigold Town to the Inner Sun stays about 51,600 steps.
- **Buildings turned a little** along curved streets and toward their squares; their footprint, door and room turn
  with them. Smoother hills, level ground under buildings and benches, and paving that ends in uneven stones where it
  meets grass.
- **Lighter Cloud Spire and smoother arrivals**: its towers are cheaper to draw, and planting the grass when you arrive
  is spread over several frames instead of one long hitch.
- **Jetties are flat**, a wooden deck on posts with the water under it, instead of boards that followed the pond's
  bed down and up. No house stands in water: Marigold Town's stream now bends round the houses on its west side.

**Places with character**
- **Copperleaf Town, the new start.** A cosy hamlet one short lane north of Marigold Town: round doors under moss and
  solar-shingle roofs, crooked chimneys, a flower-shaped wind sail, a pond with a jetty, the great oak with a swing.
  Professor Hazel's lab is here now, the opening ends here, and your room is in **Granny Juniper's** cottage among her
  beehives (tap her to talk). **Route 1 · Hedgerow Lane** runs down to Marigold Town between hedgerows, over a stream
  on stepping stones. Like Pallet Town, Copperleaf has no shop or clinic.
- **A solarpunk touch in every town**, each in its own way: green moss roofs and solar shingles on some houses, solar
  trees, garden walls of herbs and flowers, benches under solar canopies, glass heat domes in snowy Frostcrown,
  floating solar gardens in the harbours, and light pipes bringing daylight down into the towns under the ground.
- **Verdigris Park**, the big city's new central park between the plaza and the canal: a duck pond, a gravel loop with
  benches and lamps, flower beds, solar trees and its old trees.
- **Airships.** Every town has an airship station with its mast (under the ground, a sky lift up to the mooring).
  Tap a station to fly to any town you have been to, for money rather than steps:
  the flight crosses the world map and you step off by the next town's mast. The airship is a wooden ship hung under a
  banded balloon, with a turbine either side of the stern whose propellers turn.
- **Pearlantis City**, the old money's city under a glass dome at the bottom of the trench: chrome and pearl towers,
  bubble trams, kelp gardens and the mirror shafts that bring the Inner Sun's light down. A glass lift in Kelpport's
  harbour takes you down (and back up); it is off the main road. Curator Nacre at the Pearl Exchange has something to
  tell you about where the city's gold has been going, and the ledger to prove it.
- **Postcards.** The first time you walk into a town its postcard slides in: the town at its best hour, "Greetings
  from …" and a stamp. It goes into the Guide's new **Postcards** page (tap a card there to see it again); later
  visits show a small stamp.
- **Townsfolk spread out** over a town's workplaces and homes (in a town with five workplaces they all went to the
  same door).
- **Tall props made properly 3D**: the clock tower, the lighthouses, the giant mushroom, the Spire and the other
  landmarks and tall structures (45 kinds) get a body made from their own picture, so they keep their look and gain their depth.
- **The props made of shapes are low-poly**, painted with the same 32-pixels-a-metre textures as the houses (planks
  on crates and barrels, thatch on hay bales, stripes on awnings), so they sit at the art's own scale. Engine → World
  → *Props as low-poly* switches them back to voxels, now one voxel to an art pixel (*Chunky voxels* for slow phones).

**Weather, grass, fire and light**
- **Weather comes in fronts.** When the weather changes while you are somewhere, the clouds build and the light dims
  first, then the rain (or snow, or ash) sweeps across the place as a curtain you can see coming; when it clears, its
  back edge passes the same way, and after rain in daylight a rainbow stands in the sky for a few minutes. Valleys
  fill with mist at dawn in the mild and coastal places. The walk card says what's coming ("rain from 15:00").
- **One wind** moves every blade of grass, every swaying prop and every tree in a place, so they bend together, and
  the grass has **flowers** chosen by the place: daisies and clover by the towns, poppies and cornflowers in the
  meadows, heather on the hills, teal and pink in the Meadowlands, glowing caps in the Spore Forest.
- **Fire** has hand-drawn flames that flicker above every campfire, hearth and oven, with a small heat shimmer just
  above them; the heat haze over lava and hot ground is lighter and stylized.
- **Windows and lamps lit properly.** A test place holding every kind of building and lamp, shot by day, at dusk and
  by night, found the causes: big windows lit up as confetti (each pixel decided for itself whether its room was lit),
  every halo was cut down to an off-centre square, a lantern with four glasses took four of the sixteen lights so the
  lamps farther off went dark, lamp posts turned black in their own light's shadow, and white rooms burned to white.
  Now a window is lit or dark as a whole, with a warm glow in the glass and a soft pool of light on the ground in front
  of the house; every lamp lights its glass, a gentle halo and a pool of light under it; and as the light fails each
  lamp comes on at its own moment, as the windows do.

**Tests**
- **The diagnostics test** (Settings, next to the full test, about two minutes): your device and how the automatic
  quality chose its level, six places picked to cover the hardest cases (time to the first frame, the worst frame),
  where a frame's time goes (with the graphics chip's own timers where it has them), what rain and night cost, a
  battle's start, memory and errors. **Save the report** at the end saves a short `pocket-billies-diagnostics-….json`.
- **The quick check** learned the new rules: Copperleaf and Route 1, no building in water and flat jetties, a mast in
  every town and a flight, the glass lift, the low-poly props, postcards, the solarpunk touch and the park, and the
  windows and lamps by night (every lamp on, some windows lit and some dark) with a rain front coming in.

**In the Studio**: a building's roof (its own, moss, solar or chrome) and how far it is turned; a jetty bridge; the
people who stand in a place and talk; where a new game starts; 3D layers that turn (propellers, sails, wheels); new
3D props start at 32 voxels a metre and imported `.vox` models are taken as one voxel to an art pixel.

## What changed in alpha 0.1 (Pocket Billies)

Net Worth is now **Pocket Billies: Gotta tax 'em all!**. Your saves, settings and the Studio carry over as they are.
- **The new name** on the loading screen and the title screen, as the page and app name (add the game to your home
  screen again to see it there), in the Studio, the debug log and save backups (`pocket-billies-save-….json`; older
  Net Worth backups still import).
- **Billies, and taxing them.** The creatures are Billies in everything the game and the Studio say, and catching is
  taxing: the battle button is **Tax!** (key X, or C as before), a coin shows its chance as a tax rate ("~40% tax"),
  and the Guide counts the Billies you've **taxed**. The menus' translations follow.
- **A sharper picture.** The automatic quality aimed at your screen's full speed (120 frames a second on your phone),
  so it dropped to its lowest step and as little as half the resolution. It now aims at 60 frames a second and gives up
  sharpness only below that. Settings → Look → **Sharp or smooth** → *Smoothest* brings back the old behaviour. A frame
  rate of 90 is no longer reset to 60 when the game loads.
- **Trainer levels on the old map.** Every trainer is now at least as strong as the wild Billies where they stand,
  and the leaders and Vinylla three levels above them: Leader Alta 25–26 → 36–37, Skipper Sam 18–19 → 33–34, Hiker Hal
  19–20 → 31–32, Broker Bea 14–16 → 22–24, Intern Ollie 13–14 → 23–24, Diver Dee 20–21 → 25–26, Geologist Gail
  24–25 → 29–30, Leader Marina 26–28 → 29–31, Leader Rocco 11–14 → 12–15, Blake 14–17 → 16–19 at Hillside Farm,
  Vinylla 57–59 → 61–63 on the Spire and 60–63 → 64–67 at the Inner Sun, and 25 others by one to four levels. The
  hints that tell you a team's level say the new numbers.
- **Badge numbers** follow the order you meet the leaders: Marina's Water Badge is now "3 of 8" and Alta's Flying
  Badge "4 of 8".
- **The Night Market's stalls** glow less in the dark room, so their bulbs and striped awnings show instead of a white
  blaze (a new prop setting, `glowK`, scales a prop's lights and glow).
- **Windows.** A room now shows its building's own windows: as many as the front has (two close together become one
  wide window), in the same places along the wall as you saw them from the street, a shop window wider. Furniture
  against the back wall moves aside for them and pictures and clocks make room, and the library's middle bookcases
  now stand in the room as stacks so all four of its windows show. A room with more than two windows shares their
  daylight, so its back wall doesn't wash out to white. A room set to `winMatch: 0` keeps its own windows.
  Outside, 12 trees, lamps and lanterns that stood in front of a window moved a step to the side.
- **The quick check** takes its pictures on a fixed day at half past twelve, so comparing them with the reference set
  means something (the reference set is new), and it now checks the windows, the new name and the taxing words.

## What changed in v47.1 (the full test and the background)

From your v47 log: everything passed except three walk steps in a row (Bottom Line Trench, the Pressing Plant and the
Server Farm). The app was in the background for 54 seconds just then, and nothing is drawn while it is, so those
steps measured nothing. Everything else is unchanged from v47.
- The full test now notices when the app goes to the background during a step. It waits until you're back, then runs
  that step again (twice more at most). A step that never got to run in the foreground shows as **Not measured**,
  not as a problem, and the stress test measures a load again the same way.
- It asks the phone to keep the screen on while it runs (where the browser allows that), so the screen doesn't lock
  partway through the nine minutes.
- The rest of the log looked good: the places that were in the v47 preview open a little faster than they did then
  (half of all places in about half a second, 41 of 43 measured under a second), the JS heap was 28 MB after the run
  (87 MB in the preview's log), and the other 24 new places, the 23 rooms, the battles, the opening and the map passed.

## What changed in v47 (the story, a living world and the seven regions)

Everything from the v47 plan ("Net Worth: v47 plan"), built in four parts and released together: a clean-up and the
ground redrawn, the story and a new opening, a world that looks lived in, and the seven regions the map has promised
since v24. With them the game has a beginning, a road through 15 more places and an ending.

### Part 1: foundation
- **Room corners.** The back corners of every room stood twice the wall's height (the back and side walls overlapped).
  The room builder now stops the side walls at the back wall, a plain post closes the joint, and the 17 rooms were
  repaired in place without touching the furniture. A check fails if any room wall is taller than the room.
- **Clean-up.** Catalogue entries placed nowhere and replaced long ago (`flowers`, `bush`, `rock`, `escal`) and the
  one-time migration tools are gone (tools move to `tools/retired/`; pictures the battle stages use stay). The quick
  check lists anything nothing names, so it doesn't build up again. Kept on purpose: Lite mode, the painted battle
  stage, the `@v45` place backups and every test scene.
- **The ground, redrawn.** Every kind has twelve fresh 32 px tiles in `art/next/tiles47/` (the v46 set is left as it
  was). The grey smudge that repeated in every kind is gone; each kind's damp tile is its own colour; kinds that looked
  like another got their own features (heather spikes, leaf-litter leaves, wet-sand sheen, glossy mud, round pebbles,
  ice streaks, meadow seed heads, clover, flower clumps, cracked plates). Light and shade and the trodden track are laid
  by the painter across the whole ground in world metres, so nothing repeats and nothing stops at a tile's edge.
- **22 new ground kinds:** dry earth, sunburnt grass, wildflower meadow, pine needles, mushroom mat, coral sand, cloud
  floor, sky stone, gold-veined rock, sun-baked stone, ember ash, concrete, rubber matting, tide pools, seaweed rock,
  salt crust, duckboards, two carpets, parquet and two kinds of floor tiles (`tools/build-terrain-v47.py`).
- **One art style.** One outline rule (a darker shade of the thing's own colour on props, buildings and people; none on
  the ground), and water with pebbles on the bed, rings round whatever stands in it and whitecaps out at sea.

### Part 2: the story and the opening
- **The story, written down once** (`lore` in the game data, `tools/build-lore-v47.py`; the Studio's Lore section edits
  it): the Hollow Earth, the billionaires, the people, every place's history, landmark and legend, the main thread from
  Sundown to the Inner Sun, books and papers in rooms, the clues to who you were, the loading screen's lines and what
  people say at each stage of the story. A **Lore page** in the Guide fills in as you go.
- **A new title screen and loading screen** (a little runner and a trail of coins that fill with gold as the game
  loads, drawn into `css/loader.css` so they show before anything else).
- **The opening:** the pavement gives way, you fall through the crust past the Inner Sun, wake in Sundown with no
  memory and one coin, Professor Hazel finds you, you make your trainer in the dressing room, choose your starter,
  and Blake takes the one that beats yours and battles you on the spot, with Hazel's tips. It can be skipped at any
  time; Lite mode gets it as pictures.
- **Story scenes in the walk scenes:** a trainer with "intro" lines runs up and talks before the battle (Blake,
  Cass Flow, Vinylla). Clues to who you were lie along the way.

### Part 3: a living world
- **A landmark for every place** (`tools/build-landmarks-v47.py`): Sundown's clock tower (its hands show the time on
  your device), a giant tree in the Long Grass, the broken bridge in the canyon, the shipwreck at the Offshore, the
  lookout tower on the ridge, a neon sign in the city and more. The camera looks up at a landmark ahead of you and
  settles back as you pass.
- **Signs of people** (`tools/build-life-v47.py`): washing lines, crates and barrels by shops, bins, bikes, planters
  and gnomes, chalk drawings on the paving (gone in the rain), cats, worn shortcuts across the grass, market day in
  Sundown, raked leaves in autumn, crops that grow and are harvested.
- **Daily life:** shops keep opening hours (the sign says Closed after hours), townsfolk keep a routine, windows light
  one at a time in the evening, people wave, ducks paddle away from you, dust kicks up on dry paths.
- **Animals:** bees at hives, fish jumping, fireflies, glowing moths in Spore Forest, crows in the scrap yard.
- **Sound:** birds that differ by place and hour, a rooster at the farm at first light, the town muffled when you're
  in a room, a song and a mood (colour grade) for every place.

### Part 4: the seven regions
27 new places east of the Mall, each built with the v46 rules (towns with a heart, streets and lanes;
routes with a winding path, tall grass in drifts and one feature), with their own trainers, wild billionaires, shop,
songs, mood, landmark and map miniature (`tools/build-regions-v47.py`, props in `tools/build-region-props-v47.py`).

| Region | Places | Leader / boss |
|---|---|---|
| The Meadowlands | Festival Fields · **Twofold** · Blossom Vale · Mangrove Margins | Leader Poppy (Grass, badge 5) |
| Golden Hills | Vintage Rows · **Bullion Hill** · Flat Tax Flats · Bear Market Badlands | Baron Vault (Fire, badge 6) |
| Spore Forest | Sporeholder Woods · **Market Cap** · Fall Quarter · Hypergrowth | Mother Morel (Psychic, badge 7) |
| Crystal Caverns | The Spread · **Mintshaft** · The Dark Pool · Frozen Assets | Leader Carat (Electric, badge 8) |
| Coral Trench | Shell Company Shoals · **Port Folio** · Bottom Line Trench · The Pressing Plant | Cass Flow |
| Cloud Spire | The Server Farm · **Upside City** · Bubbleland · Upper Bracket Walk | Blake, then Vinylla |
| The Inner Sun | All-Time High · The Closing Bell · The Inner Sun | Vinylla, the last battle |

- **Getting there:** the Mall of the Deep has a new way out on its east side, to Festival Fields, which opens once you
  hold Marina's Water Badge (the third you earn). The regions follow one road, and in the first four the last route opens with
  that region's badge, so Frozen Assets, and everything after it, needs six badges: Ground, Water, Grass, Fire, Psychic
  and Electric (Iris's Steel Badge opens Bull Run Pass, and Alta's Flying Badge opens no road). The Spread's chasms are crossed on
  rope bridges; Bottom Line Trench and the Pressing Plant are ridden on a Water billionaire.
- **The story to its end:** the festival recruiting Variants, the vaults, the spore mill, the crystal needle, the
  pressing plant where Cass Flow recognises you, Blake's last battle in Upside City, Vinylla on the Upper Bracket Walk
  at the top of the Spire, and the press at the Inner Sun. Beat her there and the ending plays, with the last clue to
  who you were.
- **New props:** 52 for the regions (landmarks such as the festival stage, the giant sunflower, the golden bull,
  Bear Rock, the colossal mushroom, the crystal spire, the Great Geode, the superyacht, the coral tower, the pressing
  plant, the Spire, the Ferris wheel, the Closing Bell and the press), six new songs, and a mood for every place (two
  new presets, In bloom and Gilded).
- **Wild plants where they can grow:** none on the trench's ridden lanes, only dune grass and stones on the
  beaches, moss and stones in the caverns, and dry grass and thistles on the road to the Inner Sun (the builder
  takes out what the nature pass put where it doesn't belong).
- **A room of its own for each new town's shop:** Twofold Market (merch stalls and record crates), the Bullion
  Exchange (gold in the display cases, the vault behind the counter), the Cap Market, the Assay Office (crystals and a
  minecart), the Chandlery and the Night Market, each with its keeper and its own things to say. They open in place
  like every other room (`tools/build-interiors.py`; the towns' shops point at them).
- **A floor of its own in every room:** eighteen new indoor floors (checked vinyl, lab resin, oak boards, marble
  checks, herringbone parquet, linoleum, granite flags, red epoxy, straw, brick basket weave, pine boards, hexagon
  tiles, and for the six new shops painted boards, gold terrazzo, cork, slate, a teak deck and neon-lit tiles) join the
  two carpets, the parquet and the two tiles, so no two of the 23 rooms share a floor (`tools/room-floors-v47.py`).
- **Somewhere to sit and something alive in every place:** a bench, a log or a deck chair near where you arrive in
  the places that had none (a log and a campfire in Frozen Assets), and lizards, pigeons or the like where nothing
  moved.

### Checks
- The quick check (`tools/check-quick.py`) has new steps: no room wall taller than its room; twelve tiles of their own
  for every ground kind; a list of the art and props nothing names (`validation/quick/unused.txt`); the opening to
  the end of Blake's first battle; and a v47 step: every place reachable along the roads from Sundown, the 27 new
  places with their mood, lore, landmark, somewhere to sit and animals, each new town's shop opening into a room of
  its own, the gates (Festival Fields with Marina's badge, Frozen Assets with Carat's), shops closed at night and
  open at noon, the Lore page, Cass Flow's clue, Vinylla's last battle and the ending, and a floor of its own in
  every room.
- The code step also fails when two scripts declare a function of the same name (the later one silently replaces the
  other). The shop hours' helper had hidden `placeKind(id)`, the v46 helper that says what kind of place an id is; it
  is now `openKind`.
- The full test walks through every place and room, the new ones too, so it takes about nine minutes on a phone.
- The quick check's light lab waits for frames after moving you, not a fixed time, and always takes its draw-error
  check off again (when the lab failed, the check stayed on and slowed every later step to a crawl).

### Fixes from your logs
- The full test's room phase failed after dark: the shop was closed for the night. The test now sets noon for it.

### Other fixes
- The map asked for miniature pictures of places that had none. Every place has one, and the quick check now fails
  if a stop has no miniature or a file fails to load (and says which file).
- `tools/build-map-minis.py` draws at noon whatever the clock says, and starts the game the way the game does.
  All the miniatures were redrawn; the old pictures are in `retired/map-mini-v46/`.
- The single-page build packs the game data without its indentation and without the `@v45` backups (which only the
  Studio uses), and can split the pictures into scripts beside the page (`--split`) for hosts that cap file sizes.
- The ground painter decodes tiles only for the kinds a place actually shows. With 78 kinds, decoding all of them held
  up the first frames of every place (the quick check caught it: the light lab's camera hadn't settled in time).
- Every letter and digit is now a ground kind, so the Studio's **New ground type** offers a free sign as its key
  (`$`, `(`, `-`, `?` and so on) and accepts any sign except a space, quotes, a backslash and `<>&`.

## What changed in v46 (the world update)

Everything from the v46 plan ("Net Worth: the World Update"), plus the two problems in the v45 debug log.

### Fixes from the v45 log
- **Voxel props now show on the phone.** In the single-page build every voxel recipe is inlined as a `data:` link,
  and inside the Claude app fetching one is refused, so every recipe came back empty and the prop quietly showed its
  picture instead. The recipes are now decoded directly. The quick check's single-page step fails if any recipe
  can't be read.
- **No more freeze between places.** The 1.6 s stall going from Sundown's road into the Long Grass came from the
  next view's ground being built all in one frame. See "Smooth seamless world" below.

### Wild billionaires stay put
Each one keeps its spot in the tall grass until you battle it. It still idles in place: it bobs, the grass sways
round it, it peeks up and turns to look at you, and it rustles when you come within 4 m. The quick check and the
full test both require that none of them move in 8 s.

### Smooth seamless world
- A place's view is now the place plus the first 36 m of every road leaving it. You walk around a place and up to
  its exits without the view ever changing. Long roads get a few views along their middle.
- The next view is prepared ahead in small slices (4 ms a frame on a phone, 6 ms elsewhere): its ground picture is
  painted, its textures are uploaded strip by strip and its mesh is built. You stay in the current view, which
  overlaps the next one, until the next is ready. The closer you get to the edge, the bigger the slices.
- The ground near you is painted at 32 px/m in a moving ring of 16 m squares. The distant ground is one picture at
  8 px/m. Each spot's ground pattern comes from the place's own coordinates, so it looks the same in every view.
- If your walking falls behind your steps, you hurry (up to 4× walking speed) instead of jumping ahead.
- One change from the plan: rather than streaming everything in chunks, the views are prepared in slices ahead of
  time and only the ground near you streams. The world-map regions were left out of the place data, because they
  don't line up with the places.

### Places and roads say what they are (game data)
Every place has an `id`, a `kind` (`town` or `route`), a `biome` and, for routes, a `routeName`. Every scene has a
`kind` (`town`, `route`, `room` or `test`) and the place it belongs to; rooms also say what building they're the
inside of. Every road has an `id`, a `name`, `from` and `to`. The Studio shows kind badges and has a filter.
`tools/migrate-places.py --check` reports anything missing or inconsistent.

### Ground: 12 variants of every kind, 12 new kinds
There are 38 ground kinds, each with 12 tiles (`art/next/tiles/<name>_1..12.png`). The painter uses them as plain
variants, detail patches, and worn tiles along the lines people walk. Where two kinds meet, the border is a soft
dithered fringe instead of a hard edge. The new kinds are clover, moss, mud, wet sand, pebbles, cobbles, leaf litter,
heather, marsh, marble, ice and crystal floor (`tools/build-terrain.py`, which only draws tiles that are missing).

### Buildings: 12 new kinds, colours for every building
- New kinds: bakery, inn, market hall, bank (Savings & Loan), library, school, train station, fire station,
  mansion, barn, greenhouse and ski lodge. Each has a 3D plan, so it has real walls and a roof like the town houses.
- Colour variants: every one of the 35 buildings has 3 to 5 colour sets, 138 in all. A placed building picks one
  with `v` (Studio: the *Colours* swatches under a selected building). The shape, the roof and the rooms behind the
  windows stay the same, and a building without `v` looks exactly as before. Variant pictures are new files
  (`<name>_v1.png`...); your painted fronts are untouched (`tools/build-buildings-v46.py`).
- A building whose 3D model isn't made yet shows its picture in the meantime, not nothing.

### Walking inside: rooms open in place
- Tap a building with a door and you walk up to it and step in. The room opens right where the building stands, as
  part of the same view: there's no scene switch, and the room is larger than the building, as in classic RPGs. The
  town around it stays visible, dimmed to about a third and slightly greyed. The camera glides down a little.
  Walking out plays it backwards and leaves you at the door you came in by.
- **The doors match.** The room's doorway lies exactly at the building's door, at the same spot along the front:
  a door left of centre outside is left of centre inside. It's as wide as the door (2 m for houses and shops, about
  3 m for the station, fire station, barn and market hall). Nothing in the room stands in the doorway. The quick
  check measures the gap between the shop's door and its room's doorway (0.0 m).
- Lamps and windows outside keep the outdoor hour while you're inside.
- **Rooms of their own.** There are 12 new rooms, one for each new kind of building (a bakery with ovens and bread
  racks, an inn where you can rest your team, a bank with a vault, a library, a school, a station, a fire station,
  a mansion with a piano, a barn, a greenhouse, a ski lodge, a market hall), with 19 new pieces of furniture. Each
  building's room is mirrored or not, and given a wall colour, according to where its door is, so no two houses are
  quite the same inside. Your own room stays your room.
- In the Studio, a selected building has a *Room inside* field, *Open its room* and *Give it a room of its own*,
  which copies the room so you can furnish it.
- If a room isn't ready within 9 s (a very slow device), it opens on its own as before. *Settings → rooms: quick*
  still skips rooms.

### All 19 places, rebuilt bigger
- Towns are now 80×60 to 128×96 m and routes 112×64 m. They were laid out again with the new ground and buildings
  (`tools/build-places-v46.py`):
  - **Towns** have a square with a landmark, a main street through it, lanes of buildings facing the streets with
    gardens, fences and lamps, and edges that fade into countryside.
  - **Routes** have paths that wind between the exits, tall grass in drifts beside them, one feature each (a stream
    and bridge, a mushroom glade, a lookout, a jetty, a lava flow, red-rock terraces...), clearings, and plants
    grown in families.
- Everything the game relies on is kept: which shop is where, the clinic, the lab, your house, ladders, the
  fountain in Sundown, and each place's sky, music, weather, people and what they say. The roads keep their names,
  and the road table now points at the rebuilt exits. The opening scene follows the lab to its new spot.
- **Your old layouts are kept.** Each place as it was in v45 is saved as `<id>@v45` (Studio: *Open its v45
  layout*). Tick *Keep this layout* on a place and the tool will never rebuild it.
- The map miniature pictures (used when *3D miniatures on the map* is off) still show the v45 layouts:
  `tools/build-map-minis.py --all` redraws them.

### Checks
`tools/check-quick.py` has a new *v46* step. It checks the 12 tiles of every ground kind, that the buildings,
their colours and rooms load, and that a room opens in place at its door with the town dimmed and the floor the
only place you can walk. It then walks back out. The room and walking steps now start at the door and close to
where you stand, because the places are bigger.

## What changed in v45 (a fix to the full test)

From the v44 phone log: the full test's *Light lab* step reported "1 building, 0 voxel props" in the props scene.
Nothing was missing on screen. The step judged the scene 1.4 s after it opened, while the voxel recipes were still
arriving (their pictures stand in meanwhile), and it expected all three buildings, though a phone held upright sees
only the middle of the scene. The step now waits until the scene is ready, every voxel recipe it uses has arrived
and 20 more frames have been drawn, and it counts only the placed things whose foot is on screen: each building and
voxel prop in view must be drawn by its renderer. Checked on a 411×757 screen: passes, with 1 of 1 buildings and 6 of
6 voxel props in view drawn. (`STEST.only=['light']` runs single steps of the full test, for diagnosis.)

## What changed in v44 (the light, reworked and measured)

From the v43 debug log and what was seen on the phone: props that didn't show, rooms that looked wrong, terrain that
looked flat.

### Why things went missing (all fixed)
- **A draw refused by WebGL.** Every lit shader samples five shadow maps (the near and far cascades, their blocker
  maps, two lamp maps). Before the first shadow pass, or with shadows off, some of those sampler units held an
  ordinary colour texture, and WebGL refuses the whole draw ("mismatch between texture format and sampler type") —
  the ground, a building or a prop simply isn't drawn that frame. Now a 1×1 "lit everywhere" depth stub sits on
  every shadow unit until a real map exists, the light code binds all five on every program that has them, and it
  leaves the active texture unit at 0 so a picture uploaded afterwards can't land on a shadow unit. The quick check
  wraps every draw call and fails on a refused one.
- **A solid prop made before its picture had loaded** cached an empty model and then drew nothing, forever. The
  picture draws until it has loaded; a prop whose solid can't be made keeps its picture.
- **A voxel prop whose recipe hadn't arrived** (or was empty) drew neither its picture nor a solid. The picture now
  stands in until the model is meshed.
- **A building meshed before its art had loaded** kept an empty mesh; the mesh is remade when the picture's size changes.

### The light itself
- One `shade()` for everything (ground, walls, sprites, solid props, voxels, buildings): the sky-shaped ambient
  (spherical harmonics) × occlusion, the sun with a per-material wrap and a cel option, the lamps, the specular. The
  ambient default is 0.27 (the old 0.3 came from a bug: `engHex` divided plain numbers by 255, so the ambient had
  been zero since v19 and v43 over-corrected).
- **Rooms** are lit by the day outside their windows: a slanted "sun" from the window side, coloured and dimmed by
  the hour and the weather (`Lights > Daylight through windows`), warm walls and a dark floor as the ambient, no
  sun lobe; the pendant lamps lay pools after dark. The painted drinks fridge and goods crates are back (they had
  turned into white voxel boxes).
- **Terrain relief.** The ground normal map now carries a coarser relief under the fine grain: the picture's
  brightness blurred over half a metre, so paths sit a little below the grass, patches and terrace lips roll and
  a low sun shows it (`World > Ground bumps` scales both).
- **Pictures kept.** The street lights (all five), the drinks fridge, vending machines, billboards, the newsstand,
  the food truck, the phone booth, the bus shelter, the coin statue, the ski sign, the market cart, the stall, the
  tent, signposts, goods crates, birdhouses and traffic lights draw as their painted pictures again; 33 props stay
  voxel solids (benches, planters, crates, barrels, fences, bollards, hydrants, mailboxes, bins, tables, chairs...).

### The light lab (test scenes you can stand in)
Debug menu → Test scenes: **light on the land** (a ridge facing the afternoon sun, rolling ground, a brick block
and a strip of every ground kind), **light in a room** (window, pendant lamps, a lit fridge), **light on props**
(a picture prop, a tree, voxels, solids, three buildings, a lamp, a flag, side by side), **light in the air** (a
misty wood with the sun behind the trees, for the god rays). `tools/check-quick.py` opens them and measures the
picture: the normal map changes it, the sunward slope is brighter, the block's shadow darkens the ground, every
kind of prop draws, the room floor stays in range by day and the lamps pool at night, the god rays add light, the
lamps in *lights at night* pool, and no draw call is refused.

## What changed in v43 (the big one: the seamless world, roads, light, shadows, god rays, voxel props)

Everything from the two plans in one update, plus the wind, the flags and a phone bug.

### The seamless world (plans v43 and v44)
- **One ground.** Near an exit the road leaving it is in view past the scene's edge; a trip is a walk along that
  road on real ground (40 m per 500 steps of the road's cost: 67 m for the shortest, 290 m for the longest), and you
  arrive at the far scene's exit with the road still behind you. Scenes stay separate files. How: every road lives
  in a frame of its own in which it leaves the first scene's exit at right angles, runs straight, turns at right
  angles when the far exit looks another way (so the 18 roads whose exits don't face each other simply bend, and no
  exit had to move), and the far scene is placed so that its exit sits on the road's end. What the walk screen shows
  is a window of that frame made into an ordinary scene on the fly (tiles, heights, cliffs, props, water, rails, life
  — a "composite"), so the renderer, the navigation grid, the encounters and the folk need to know nothing. Moving to
  the next window is a translation of everything on screen (`dioShift`): no cut, no fade, no remount; the next
  window's ground is painted in the background before it is needed. `game/js/world.js`.
- **Roads are generated, never stored**: a path with wobbly verges of grass and tall grass (encounters hide there
  too), countryside of the nearer scene's edge terrain beyond, trees, shrubs, flowers and rocks from the growth
  families of v42, a sign at each end, a bench or a stone now and then; sandy causeways where a scene's edge is sea;
  nothing in lava or under ice. Same seed, same road.
- **Steps stay the currency**: your place on the road is your progress along the link; the map, holds, gates,
  blockers and the rival are untouched; saves need no migration. On arrival you walk in from the exit to the hub.
- The 3D battle stage takes whatever is on screen, road included. A composite's ground is at most 116 m wide (the
  limit one picture can hold); phones keep two ground pictures as before.
- Dial: Engine → World → **Seamless world** (off: the walk-out line of before). The Studio's resize dialog now says
  "the road bends to join them" instead of warning about facing; the Check panel's 18 warnings are gone.

### Wind, flags, the phone
- **Every plant sways.** One wind for all of them: a slow lean drifting across the scene, a faster flutter and the
  gust bands of the grass; the bend grows toward the top like a stem (it was a straight shear); the amplitude is
  about twice what it was. The hidden-encounter grass takes the same wind (it used to jitter at 11 Hz, which read as
  standing still) and rustles only while something moves inside it. Mushrooms, cacti and planted things tremble.
- **Flags.** The flag pole is rigid (a new bare mast picture, `flag_mast.png`); the cloth is a separate picture
  draped from the top and waved by the wind in the sprite shader (a 16×4 grid that lifts, dips and trails, shaded
  by its own ripples). **Only towns have a flag**: Sundown (sun), the Food Court (fork), the Mall (shell), Capital
  Gains (coin), Tax Haven (palm), Summit Capital (star) — `art/scene/flags/`, made by `tools/build-flags.py`; every
  other pole flies the coin ring. The Lookout Ridge's two poles went (it's a lookout). Studio: Walk scenes → Look →
  Town flag.
- **The 3D battle stage on phones**: the full test on your phone said "3D stage not available here". The stage
  required the walk scene on screen to be the stop's own scene, which fails on the second half of a road and when
  the scene hadn't opened yet. It now takes whatever walk scene is on screen.

### The light (plans v45–v47)
- **Sky-shaped ambient**: the ambient light is nine spherical-harmonic terms of the sky (zenith colour overhead
  easing to the horizon colour), the ground's bounce below and a broad warm lobe on the sun's side, evaluated per
  pixel for every surface (`shAmb` in the shared lighting GLSL, `eglSH` in light.js). A face turned to the sky is
  sky-blue, one turned down takes the ground's bounce, one turned toward the sun is warmer even in shade. Found on
  the way: the old two-colour ambient had been divided by 255 by mistake since v19 (`engHex` with a numeric
  fallback) and was effectively zero — the look was tuned around it; the ambient strength dial is now 0.5 to keep
  the scenes' brightness where it was. Dial: Sun → Sky-shaped ambient.
- **Two shadow cascades**: a near map (13 m round you, 1024², drawn every frame) and the fitted far map of before
  (cached for what never moves); every lookup takes the near map when it is inside it. Dials: Shadows → Near shadow
  map, radius.
- **Lamps that cast shadows**: after dark the two nearest lamps get a 512² shadow map of their own (a wide camera
  at the lamp looking down); people, trees and props throw shadows away from the lamp on the ground. Dial: Shadows →
  Lamps that cast shadows.
- **Horizon-based ambient occlusion** replaces the crease AO: each pixel looks along four directions for what rises
  above it, the way light from the sky is blocked. Dial: Shadows → Ambient occlusion (the old one is still there).
- **God rays and lamps in the air**: a march through the air at quarter size from the camera to what each pixel
  shows, twelve steps, each asking the shadow maps whether the air there is sunlit and the nearest lamps how much
  they glow; forward scattering makes rays toward the sun bright, the air is thickest low down, fog and rain thicken
  it. Blurred and added to the frame. Dials: Air → God rays, Lamps in the air. Eased off with the other extras when
  a device struggles (quality level 2).
- **Sunlit haze**: the haze takes the sun's colour where you look toward the sun. Dial: Air → Sunlit haze.

### Voxel props (plan v48)
- **54 props have a voxel model** (76 recipes made; the rest stay painted because wood grain, water and characters read better drawn): benches, planters, lamps, crates, barrels, tables, chairs, fences, signs, mail
  boxes, bins, the hydrant, bollards, the bike rack, birdhouse, wheelbarrow, market cart, phone booth, vending
  machines, bus shelter, hay bales, ladders, deck chairs, umbrellas, buoys, dock posts,
  traffic lights, the coin statue, newsstand, food truck, stall, tent,
  flag mast. **Buildings are untouched** (walls, roofs, windows as before), and so is every prop without a
  model; a placed prop can keep its picture with `vox: 'card'`. Dial: World → Voxel props.
- A model is a **recipe**: layers of shapes (box, cylinder, sphere, cone, barrel) in metres with a colour and a
  texture (grain, wood, stone, metal, cloth, hay, leaves, rust, stripes, rings), raw voxels imported from a
  MagicaVoxel .vox, and picture layers (a 2D sprite set in the model). `tools/build-vox-props.py` wrote the first
  64 as `art/scene/vox/<key>.json`; `game/js/vox.js` turns a recipe into voxels at eight to the metre, greedy-meshes
  them and draws them cel-shaded (the sun in three tones) in the scene's light, with the sky ambient, the shadow
  maps and the lamps; they sit in the shadow maps too. Thin poles are a single column of voxels.
- **Studio: the Prop builder.** Open a prop (Walk scenes → Props → the pencil) and under *Voxel model*: start a
  model from the picture (a box its size), add a box / cylinder / sphere / cone / barrel / picture, drag the sliders
  (across, depth, up, sizes), pick a colour and a texture, hide, duplicate, reorder, remove; import a .vox; add a
  picture layer and pick a PNG for it; everything shows on the turntable as you drag (the game's own renderer). The
  recipe is saved in the prop's catalogue entry with the game data.

### Tests
- Quick check: a v43 step (every road composes at both ends and in the middle with the scene tiles carried over
  exactly and sizes a card can hold; a walk from Sundown to the Long Grass on the ground without a remount; the town
  flags; every plant sways; 54 voxel props mesh; the SH ambient, cascades, god rays, horizon AO and lamp maps run).
- Full test: a new phase *Road: Sundown to the Long Grass on the ground* (view changes, unready frames, the slowest
  stretch), and the memory phase also counts voxel meshes and road views kept.

## What changed in v42 (the Seamless World, part 1: nature and exits)

The first of the three seamless-world updates ("Net Worth: the Seamless World" doc): the world gets its plants, and
scenes get exits that know which edge they are on and which road leaves by them, so a scene can change size and the
next update can stand two scenes side by side.

- **Seventy nature props** in `art/scene/props/`, drawn by `tools/build-nature-props.py` with the same ramps,
  outline and light as the rest (review sheet: `validation/v42-nature.png`): eighteen flowers (tulips in three
  colours, daisies, bluebells, poppies, sunflowers, lavender, foxgloves, lupins, dandelions and their clocks, white
  clover, buttercups, cornflowers, marigolds, snowdrops, crocuses), twelve kinds of ground cover (tussock, sedge, wild
  wheat, dry grass, bracken, thistles, heather, a moss patch, a clover patch, nettles, horsetail, snowy grass), eight
  shrubs (hawthorn, bramble, juniper, a box ball, holly, rhododendron, rosemary, wild roses), ten trees (rowan, poplar,
  beech, hazel, olive, cypress, elm, horse chestnut, larch, a fallen tree), nine water plants (yellow and purple iris,
  bulrushes, duckweed, a lily pad, pink and white lotus, marsh marigolds, water mint), five rocks and ground things
  (a lichen boulder, flat stones, scree, a molehill, exposed roots) and eight season variants (rowan, beech, poplar,
  hazel and birch in autumn, hawthorn with haws, dry seed heads, rust tussock). Every one has a **family**, the
  **ground letters it grows on** and a **weight** (how common it is) in the catalogue; a picture on disk is never
  redrawn, so paint over any of them.
- **The wild-growth pass**, `tools/grow-wild.py`: scatters them over the seventeen outdoor scenes by family and
  ground (about one plant per 40 m², 997 in all, a fixed seed per scene so the same scene always grows the same way).
  It keeps off paths and paved ground, the hub, the exits, bridges, rails, arches, streams, the strip in front of
  every door and every prop already placed, never moves a hand-placed prop, grows nothing in the sea, in lava or
  under ice, and marks what it adds (`"w": 42`) so `--regrow` can take only its own props out and grow again.
  `--density` makes it thicker or thinner; `--dry` reports.
- **Studio: scatter a whole family.** With a nature prop picked, the scatter brush has "Whole … family, by ground":
  it puts down every plant of that family that grows on the ground under the brush, weighted by how common it is
  (water plants in water, snowdrops on snow, nothing on a path).
- **Edge-relative exits.** Every scene with exits now has `edgeExits`: `{id, side, t, in, width}` — the edge it is on
  (N/S/E/W), how far along that edge, how far in from it, and how wide the opening is. The points everything else
  reads (`exits`) are rebuilt from them, so **every exit is exactly where it was** (`tools/migrate-exits.py` refuses
  to move one). Resizing a scene in the Studio keeps the exits on their edges (an exit on the north or east edge
  moves out with that edge, like the roads and cliffs already did), then a dialog runs **three checks on every
  exit** — it stands on walkable ground, the hub can walk to it, and the exit it is joined to on the far side faces
  this one — and offers to undo the resize.
- **The join table.** A road may now name the exit it uses at each end: the fourth entry of a link,
  `[a, b, steps, {a: 'east', b: 'south'}]`, with the ids under "Leaves by" in the Studio's road table. The game reads
  the table first and falls back to the old compass match for a road without one; the migration filled the table
  from that very match, so nothing changed hands, and the quick check compares the two matchings on every stop.
  Exit ids are named by side (north, south, east, west; south2 when a side has two). The Check panel notes when the
  two ends of a road don't face each other (18 of 23 roads today — they were matched by compass bearing, not by
  side; v43 is where that starts to matter and where they get fixed).
- Quick check: a v42 step (the seventy props and their files, every outdoor scene grown with nothing on a path or in
  the sea, edge exits agree with the points, the join table agrees with the bearing match on every road, a resized
  scene keeps its exits on their edges).
- Frame time: in the software-rendered check the median frame of the Long Grass and the Pond is unchanged with the
  growth (the plants are small sprites, flat ones cost nothing in 3D); the full test on a phone is the real measure.

## What changed in v41

The full test crashed the game on a phone during its battle phase; v41 fixes what it found and reworks the test so a
log answers the questions I actually ask of it.

- **The battle foe.** Since v39 the test's wild foe was "the first stage-1 species that isn't a starter", which is now
  Oilympus, the legendary, at level 5 (with its 128 px rig and hover pieces) in every battle of the test, including as
  an Alpha at 1.6×. The foe is now an ordinary common species.
- **Memory on phones.** Three caps that grew with the 32 px ground and the 117 sheets: the ground pictures kept for
  instant revisits are two on phones (each is 15–25 MB; they were four), evicted ones are freed, the pictures on the
  graphics card are trimmed past 128 MB (was 192), and the people-picture cache holds 2,000 on phones (was 6,000, which
  at ~20 KB each could pass 100 MB). The most likely cause of the crash was the browser killing the page for memory
  after the test had opened every scene; these make that much less likely, and the test now reports the numbers.
- **The full test, reworked** (Settings → Debug → Full test). It measures, and only measures: shaders link; every
  walk scene opens (open time, props, 3D buildings, solid props, grass, frame rate, slow frames and their causes);
  night, storm, snow, autumn, a room and the cave; the 3D and painted battle through a move, a double and an Alpha
  turn; the billionaires in the world; the map and its miniatures; **memory after the run** (pictures on the card,
  ground pictures kept, JS heap, people pictures, and whether the WebGL context was lost); then the stress ladder. Gone,
  because the quick check already covers them without a phone and they measured nothing: the test scenes' walking
  rules, the city traffic check, animals and sounds, challenges/stamps/ladders, the opening cutscene, the dressing
  room, shops, conversations, sound, the Team/Guide/Trainer screens, the off-screen skip count, the prop audit and
  the facing check. About three minutes on a phone instead of six.
- Nameplates in the team battles are waited for (they show once their fighter is drawn), so a slow device no longer
  fails that phase for a late plate.
- **The graphics plan** is a doc: "Net Worth: the Graphics Update" (v42 light, v43 shadows, v44 god rays and air,
  v45 voxel props), with costs, dials and gates.

## What changed in v39 and v40 (one update)

The big art update is complete: every billionaire in the game is one of the 117 new ones, the old roster is gone,
and the people and the polish the plan kept for the end are in.

**The roster (v39)**

- **All 117 drawn, rigged and in the data.** The last 12 two-stage lines (Scullet, Jaylet, Cublet, Cubron,
  Clapperbeaver, Snufflet, Flatpackrat, Canlet, Orelet, Sacklet, Clawlet, Portcrane and their evolutions), the 18
  singles (Mittalion, Dalhog, Citagriffin, Sirenbucks, Cheskycrab, Bingebat, Altmowl, Gabenwalrus, Tiktokferret,
  Tencentaur, Delldeer, Ballmerilla, Federswan, Siucock, Forrestick, Scottelican, Hersheymoose, Vanderbolt) and the
  two legendaries, Oilympus and Aurumansa, by the same spec-and-template tool as v38 (the legendaries with the
  richest specs: horns of steel, a smoke cloud and a slick of black gold; gold wings, a double hump and a puddle of
  coins). The review sheet is `validation/v39-roster.png`; everything is tool art to paint over, as before.
- **Signature moves.** One per line, 55 in all, named for the parody (CUDA Call, Open Sesame, Rollback, One More
  Thing, Just Do It, Tower Drop, Library Slam, Buy the Dip, The Decision, Gives Wings, Developers!, Siu!, Standard Oil,
  Golden Caravan …), learned after the line's last evolution (at 30 by the singles, 50 by the legendaries). A
  signature move is only ever learned by its own line; the Studio's move editor shows them with their `sig` tag.
- **The old roster has left the game.** The 30 old lines, `art/billionaires/` and the old `rigs.js` atlases are
  gone. Every pool, egg tier, fishing spot and trainer team is cast from the new roster; the six last regions switched over, so all 18 are new.
- **Saves come through.** `rules.migrate.species` maps all 88 old species: the old starters to the new (Hoodini's
  line → Emberox's, Gushlet's → Cartotter's, Scooplet's → Kidling's), the mythical to Aurumansa, the rest to the
  new species in their pool slot or the first new line of their type, at the same level, with the Guide's marks
  following. The quick check runs a v36-shaped save through it.
- **The legendary encounters.** Oilympus waits under the volcano, Aurumansa on the summit (`rules.legends`): arriving
  there once a day brings a short scene and the choice to face it, at level 42 and 45, until it is caught.
- **Singles are final stages.** A species with no evolutions has the stat total and XP yield of a final stage and the
  catch rate of a middle one.

**People and polish (v40)**

- **The dressing room has six choices**: Body, Face, Hair, Outfit, Hat, Accessory. Body leads with the seven builds
  and the skin colours; Face with twelve ready faces (eyes, brows, mouth and facial hair as one pick) and the eye
  colour; Outfit with sixteen outfits (top, bottom, shoes, a jacket when it wants one) in three colourways each, the
  saved outfits under them; Hat and Accessory as before. A "More" under Body, Face and Outfit opens every slider, piece
  and colour the wardrobe always had, so nothing is lost. The boutiques work the same way: an outfit you don't own
  shows its price and buys as one. "Create your trainer" uses the same six tabs with the ready-made looks first.
- **Busts.** Every species' 64×64 bust from its piece sheet (the rig carries where it sits) is what the Guide's list
  and the battle switch menu show, cropped straight from the sheet; the rest-pose rig stays everywhere a whole
  creature is wanted.
- **A balance pass.** `tools/balance-report.py` rates every species from the data (best hit before it evolves, bulk,
  speed) and lists what sits more than 25% from its stage's median; `validation/v40-balance.md` is the report. It found
  two things worth fixing and they are: the big hits (95+ power) in the generated learn sets now come at 34 or later,
  and no line learns another line's signature move. No outliers remain.
- **Towns and meadows open without the long frame.** Grass is planted a few milliseconds a frame and appears when the
  last row is in (this was the "planting the grass" stall in every log since v32); building models were already spread
  in v37. What's left at a scene's opening is the once-per-session build of a prop's 3D body (up to ~250 ms for a big
  tree); it is cached for the rest of the session.
- **The zip is split.** The game zip no longer carries `validation/` except the quick check's baseline pictures; the
  review sheets come with the update as images. The game is about 11 MB zipped.
- Studio: the roster board shows all 117 drawn and rigged; the Skeleton builder opens any of them; rigs save to
  `rigs-next.js`, and a billionaire made in the Studio without a sheet goes to `rigs.js` as before.
- Quick check: a v39/v40 step (117 species with sheets, rigs and busts; no old species anywhere; signature moves;
  the v36 save migration; the legendary at the volcano; the six-tab dressing room; busts in the Guide).

## What changed in v38

The fourth step of the big art update: the first sixty-one of the new roster, drawn, rigged, in the data and in the
wild.

- **23 new lines, 61 species, numbered 13 to 73 in the Guide.** All fifteen three-stage lines (Siliclet → Jenzard →
  Gigajenzard, Ternlet → Regatern → Islatern, Sesamander, Pupcart, Tickerbud, Seedpip, Laceling, Frylet, Tuskling,
  Spoolspider, Gosling, Rivetle, Polofoal, Foalt, Cordlet and their evolutions) and the first eight two-stage lines
  (Pupfin, Sniffpup, Seerlet, Tweetfinch, Shufflet, Softpup, Etherfoal, Hodlcalf). Each has its types, a six-number
  stat profile, a learn set built from its types' moves plus one move of its parody's taste, categories, heights,
  weights, habitats, diets, two sentences of bio and a note per stage, and evolution levels. `tools/build-roster-data.py`
  writes them into `gamedata.js` after the three starter lines (a line already there is left to the Studio).
- **Drawn as puppet piece sheets** by the new `tools/build-roster-sheets.py`: one short spec per line (ramps, head
  shape, ears, horns, tail, feet, crest, wings, markings, extras) and a body-plan template (quad, biped, bird, lizard,
  serpent, shell, insect, fish, hopper, plant, blob, crab, flyer) paint the ~20 pieces, four faces, three torsos, the
  back view and a portrait on one sheet in `game/art/next/billionaires/`, with the layout JSON, the Golden recolour
  and the rig in `rigs-next.js`. Animals only: the leather jacket, sailing gear, vest, turtleneck, jersey, goggles,
  sash and the rest of the roster's wardrobe became markings, rings round the eyes, a blue patch on the chest, a dark
  ring of shell round the neck. Like the starters, this is tool art meant to be painted over piece by piece: a sheet
  you repaint is kept, and a rig the Studio edited is kept too. The review sheet is `validation/v38-roster.png`.
- **The first twelve regions are filled with the new roster** (Sundown's grass, the golf course, the thicket, the
  grotto, the canyon, the scrap yard, the food court, the mall, the pond, the farm, the ridge and Capital Gains): their
  pools hold only new species, the six regions beyond only old ones, so the Guide never shows a mix on one route. The
  old lines stay in the data for existing teams until v40.
- **Save migration is in place.** `rules.migrate.species` maps each old species to the new one in its slot of its
  region's pool (84 mapped); when a species is no longer in the game, a team member, a boxed one or a queued encounter
  becomes its replacement at the same level, and the Guide's seen and caught marks follow. The quick check runs it on a
  save with a species that doesn't exist.
- Fish and fliers hang from a hover bone with no picture; the motion audit skips it.
- Quick check: a v38 step (61 species and sheets, every rig draws front and back and every piece moves, the pools,
  the migration, a wild Frylet on the 3D stage).

## What changed in v37

The third step of the big art update: the world's ground at 32 px a metre, and the 2× pipeline of v34 retired.

- **The ground is redrawn at 32 px a metre.** All 26 terrains (grass, meadow, flowers, tall grass, path, plaza, sand,
  water, deep water, rock, cave floor, mall floor, farm soil, boards, scrap ground, snow, asphalt, pavers, brick
  paving, gravel, dirt, forest floor, stone steps, lawn, ash, basalt) have six 32×32 variants each in
  `game/art/next/tiles/`, drawn by the new `tools/build-tiles.py` **in the colours the 16 px tiles already had**, so the
  props, buildings and people sit on the new ground exactly as before, with the detail those colours only hinted at:
  blades with lit tips, clover, pebbles with a lit top and a dark underside, cracks, cobbles with mortar, plank grain
  and knots, nails, furrows, wave crests with the 2×2 water dither, cinders and embers, slate plates. Shade and light
  steps come from the prop ramp (shadows toward lavender, lights toward cream), so ground and props share one light.
  The ground painter mixes the six per metre and wobbles the natural edges itself, so there are no edge pieces.
- **On by default.** Engine → World → "32 px ground tiles" (on). Off paints the 16 px tiles of v36 and before, which
  stay in `game/art/scene/tiles/` for that; the lite renderer keeps using them.
- **The v34 2× pipeline is gone.** `art/hd/`, `data/hdart.js`, the "Detailed pixel art" dial and the code that swapped
  2× pictures in are removed (the new ground makes the doubled tiles pointless and the doubled props were only
  resampled); `tools/build-hd-art.py` moved to `tools/backup/`. The zip is 4 MB smaller.
- **Props, buildings, animals and effects stay as they are.** They are drawn at 34 px a metre, with the sel-out outline,
  the top-left light and the cel tones the style guide asks for, and most have been touched up by hand, so v37 keeps
  them instead of regenerating them (the plan's "redraw" would have been a lateral move). Buildings already have
  3D sides and roofs. When new props are drawn at 32 px a metre, a `ppu` field per prop is the way to mix the two.
- **Towns open smoothly.** Building a 3D building's model and cutting its front is spread over frames (the first of a
  frame always goes ahead, the rest only while the frame has under 5 ms spent on them); the sun shadow cache redraws
  as each one appears. This was the cause of the slow frames at Sundown's mount in the v36 log.
- **The split evolution counts the party.** For the Build path, kilometres walked with the species in the party (not as
  buddy) count at half weight; the sheet's path line shows them.
- **Studio saves the new rigs to their own file.** A rig whose pieces come from a sheet under `art/next` is written
  back to `art/next/rigs-next.js`; the rest to `art/rigs.js` as before.
- Quick check: the v34 step no longer needs the 2× art; the v35 step checks the 156 tiles are 32×32 with 40 colours or
  fewer; a v37 step checks the default, the classic dial, the building budget, the party steps and the rig split.

## What changed in v36

The second step of the big art update: the three starter lines, end to end, in the new style.

- **New starters.** Emberox, Cartotter and Kidling replace Hoodini, Gushlet and Scooplet as the starting three (the old
  lines stay in the game for existing saves). Each line has four species: stage 1, stage 2 and **two finals**: at level
  32 the middle stage takes the **Build** path (Marsox, Orbitotter, Harvestgoat) if the kilometres it walked as your
  buddy outweigh the battles it won (1 km counts as one win), or the **Hype** path (Memeox, Everyotter, Windowgoat)
  otherwise. The sheet says which path is ahead. Dex numbers 1 to 12.
- **v36b: the twelve redrawn with character.** `tools/pixkit.py` is the new pixel kit every billionaire from here on is
  built with: four-tone cel shading with a rim light, fur fringes and strokes, big anime eyes with two highlights and
  brows that carry the expression, muzzles, noses, ears, cheeks, curled and straight horns, hooves, and props drawn
  with care (boosters with a flame, a cardboard box with tape and arrow, a cowboy hat, a rocket shell with porthole
  and fins, a warehouse with drones, a sweater with a ribbed hem, a floppy disk, a window with a sheen, a tyre collar,
  a toy tractor). Each line has its own anatomy: the muskox its horn boss, mantle and pale undercoat; the otter its
  bib, whiskers, webbed feet and flat tail; the goat its long face, sideways ears, beard and split hooves.
- **v36c: natural bodies, nothing worn.** Bodies are built from overlapping forms (a shoulder hump, a belly, a rump,
  haunches, a neck that tucks under the head) and the legs tuck up into the body instead of hanging below it; the far
  legs are a tone darker. Being animals, they wear nothing: the sweater, hat and goggles are gone. What they are is in
  their bodies: Boostox has flame vents on its shoulders, Marsox crater-rock plates along its back, Orbitotter a sleek
  night-blue coat, a pale streak and a jet-flame tail, Harvestgoat a green crop-fleece with furrows; what they carry
  (a toy rocket, boxes, a phone) is carried.
- **v36d: animals only, and more animal types.** The toy rocket, phone, boxes, drones, floppy disk, screens and tractor
  are gone; Emberox chews nothing, Memeox has three little birds, the otters hold river pebbles and have a smile
  marking across the chest (Primotter a shoulder ruff and a ringed tail), Kidling chews a leaf, Billgoat has a round
  sky-blue patch in its wool, Windowgoat glowing crystal horns. Stage 2 of each line is drawn 12% bigger than stage 1.
  The rig system gains five body plans (bird, insect, crab, hopper, plant) beside the nine it had, piece roles for
  pieces named otherwise, and a **Motion check** in the Skeleton builder that lists what moves in each pose and flags
  pieces that never move; the quick check runs the same audit on all twelve.
- **Puppet piece sheets.** The twelve are drawn as Black/White-style puppets: one sheet per species in
  `game/art/next/billionaires/` (about 20 pieces, four face pieces, a three-step torso for squash and stretch, the back
  view and a portrait), a layout JSON beside it, a Golden variant, and rigs in `art/next/rigs-next.js`. They are made
  by `tools/build-starter-sheets.py` from short shape recipes: tool art, blocky and on the grid, meant to be painted
  over piece by piece (a sheet you repaint is kept). The review sheet is `validation/v36-starters.png`.
- **The 12 fps puppet clock.** Rigs with a clock step their poses on a 12 fps grid (calm poses on twos, hits on ones),
  the face cycles at 4 fps, tagged pieces (tail, spark, hat, cloud) lag one tick, and the torso swaps to its squashed
  piece on a hit and its stretched piece on a jump. Old rigs animate exactly as before.
- **Scale.** The new sheets are 64 px a metre in battle (96 px canvas; 128 for the finals); the stage, the team cards
  and the world draw a rig by its own scale, so old and new billionaires stand side by side at the right sizes.
- **Next ground tiles** (Engine → World → Next ground tiles, off): a preview of the v35 master tiles painting the
  ground at 32 px a metre under the current props.
- Studio: the new species open in the Skeleton builder from their sheets; the roster board's silhouettes use them.
- Quick check: a v36 step (species and rigs, pixels drawn front and back, clock, squash, split evolution, a 3D-stage
  battle with a new starter, the Next ground dial).

## What changed in v35

Version 35 is the first step of the big art update (the plan: "Net Worth: the Big Art Update"). Nothing the player
sees changes yet; everything is tools, data and studies for the versions that follow.

- **`STYLE-GUIDE.md`**: the one page every new picture is checked against: 32 px/m in the world, 64 in battle, the
  master palette, light from the top left, sel-out outlines, anime faces, the silhouette test, the puppet pieces
  (Black/White style: ~20 pieces per billionaire on one sheet), the 12 fps motion clock.
- **Master palette**: `game/art/next/palette.png` (20 ramps × 8 steps, hue-shifted shading) with `palette.js` and a
  blown-up `palette-big.png`; `tools/build-palette.py` makes it.
- **Master tiles at 32 px**: `tools/build-tiles.py` paints one master per terrain (26) into `game/art/next/tiles/master/`,
  six variants of each and the wobbly-edge masks for natural terrains. Masters you paint over by hand are kept.
- **Roster board** (Studio → Roster board): the 117 new billionaires as cards (name, line, stage, parody target,
  types, design line, four progress boxes), search and filters, a CSV export and a silhouette sheet (every species
  black at 24 px). The roster lives in `gamedata.roster`; the game ignores it until v38.
- **Skeleton builder**: a 12 fps clock (poses step on ticks), Pause and a tick scrubber, Onion skin (the two ticks
  before as ghosts), and **Import piece sheet** (a PNG plus a layout JSON become parts, with face pieces as the head's
  expressions).
- **Starter studies**: `tools/build-starter-studies.py` blocks out the 12 starter species in palette colours at the
  battle scale, with their 24 px silhouettes (`game/art/next/starters/`, review sheet in `validation/v35-starters.png`).
  They are shape and colour studies, not finished art: the drawn piece sheets are v36.
- **Pixel-grid camera** (Engine → Camera → Pixel grid, off): standing still, the camera settles onto the 1/32 m grid.
- Quick check: a v35 step (roster shape and ids, palette, tiles only in palette colours, studies, the camera dial).

## What changed in v34

**Detailed pixel art.** Every prop, prop layer, ground tile, animal and car and battle prop has a second picture at
twice the pixels: 68 a metre, the same as the people. They live in `game/art/hd/` (the originals are untouched) and
are made from the current pictures by `tools/build-hd-art.py`: diagonals doubled smoothly, outlines thinned to one
fine pixel and coloured from what they enclose (darker on the shadow side, lighter toward the sun), inner lines
thinned, small material detail on flat areas only (leaves, wood grain, stone pits, metal sheen, weave), and one shared
palette with the same hue-shifted shading ramp for every set. The ground is painted from the 2x tiles at 32 pixels a
metre; 3D buildings wear the 2x fronts. **Engine → Quality → Detailed pixel art**: *Auto* (default) uses them where
the screen has the pixels to show them (phones and high-density screens; on a 1x desktop screen they would only be
shrunk again), *On* always, *Off* never. Saving a picture in the Studio remakes its 2x copy, unless you painted the 2x
copy yourself (the tool keeps track and leaves hand-painted 2x pictures alone; `--force` remakes them anyway).

**Billionaires walk.** Your buddy and the wild ones in the grass now walk with a cycle made for their body plan, seen
from the front or the back only (no side views): two-legged ones lift a foot at a time, four-legged ones move their
legs in diagonal pairs, fliers flap harder, fish swish, snakes and worms ripple, octopuses stride, blobs bounce,
shelled ones scuttle. They're sized so their pixels sit on the art grid. Your buddy shakes off the rain, hunkers down
at night and cheers by the water now and then; a Golden one in the grass gives itself away with rising gold glints.

**Battles.** Below half its HP an Alpha gets furious: a golden shield (half damage for two turns) and stronger attacks.
In double battles the second foe knows what its partner is doing (no piling onto a billionaire that's already going
down). Hits land as hard as they hurt: a scratch barely nudges the camera, a big hit shakes it and knocks the target
back. With three or more fighters out, a turn order bar shows who moves first. **Settings → Battle speed**: Normal,
Fast or Faster.

**Engine.** Smoother walking: shading the ground (the main cause of hitches in your last log) is worked out a slice at
a time; still props keep what they worked out between frames; props in 6 m squares well off screen are skipped
outright; shadows of things that never move are drawn once and kept (only moving things are drawn each frame); a
battle's pictures load while you walk, and the next stop is prepared on the way. A cap on pictures kept on the
graphics card (192 MB on phones, 384 MB elsewhere) lets the least recently seen go. Frame rates are held to an even
beat of your screen, and **90** joins 30, 60 and 120. Where the browser allows it, the debug overlay and log show
how long the graphics card takes per frame. Lights: street lamps lay a pool of light on the ground after dark
(Engine → Lights → *Lamp light on the ground*), storms gust harder, rooms are darker on grey days, and a fine dither
removes banding from the sky and fog.

**Not in this version** (from the list of possible improvements): WebGPU (the WebGL2 renderer stays; WebGPU would mean
a second renderer, and the gains above came without it), texture atlases (draws are already grouped by picture),
FXAA on 3D edges, bounce light, wet reflections, distant terrain, drawn building sides, new pixel icons, diagonal
walking, folk routines, the evolution scene in the world, signature move animations, wild double battles, layered
music and spatial sound, and the Node battle tests. They remain on the list.

**Checks.** `tools/check-quick.py --steps=v34` runs only the steps you name; a v34 step checks the 2x art (on and
off), the shadow cache, walk cycles for every body plan, the Alpha shield and turn order bar, and the partner AI.

## What changed in v33

**Double battles.** Some trainers now fight two against two: Blake's rematch, Broker Bea, Geologist Gail and Leader
Iris (tick *Double battle* on any trainer in the Studio). Your first two billionaires go out together. Each one picks
its move in turn ("What will Scooplet do? (1 of 2)"), and a move aimed at a foe asks which one: tap its nameplate or
the billionaire itself, or pick from the list. *Back* returns to the previous pick. When one of yours faints you choose
who takes its place. Four wave and storm moves (Surge Wave, Petal Storm, Sand Squall and Cyclone) hit every foe at
three quarters of their power; any move can do this (Studio → Moves → *Hits every foe*).

**Alphas.** Now and then (about 1 in 45 encounters, once you have two billionaires) an Alpha hides in the grass. It's
bigger, glows red, has a red marker, and three of your team face it together. It has three times the HP, stronger
stats and a few extra levels, it acts twice every turn, and it often shrugs off sleep. It gives three times the XP.
You can catch it with a coin once it's worn down, though the odds are lower; a caught Alpha keeps a little of its
size and strength. Every number is under Studio → Rules → *Alphas and team battles*.

**Battle panels in the scene.** Each billionaire carries a small nameplate (name, level, HP, status; your own also
show HP numbers and XP) that floats above it and follows the camera, instead of the corner cards. Plates move apart
when they would overlap. The billionaire choosing stands in a gold ring under a warm light; while you aim, the foes
you can pick pulse red. Settings → Game → *Battle panels* brings back the corner cards for one-on-one battles (double
and Alpha battles always use the plates).

**Billionaires in the world.**
- The wild ones in the tall grass now show themselves: they peek out of the grass, scurry from tuft to tuft, part the
  blades as they go, and now and then hop up for a look round. Tap one (or its marker) to battle it.
- Your buddy (*Make buddy* on a billionaire's sheet; your lead if you haven't picked one) walks with you. It follows
  your path a step behind, hops along when you walk and potters about when you stop. Tap it and it reacts and tells
  you how it's doing: tired, poisoned, itching for a fight, or that something is rustling in the grass. Settings →
  Game → *Buddy walks with you* turns it off.
- Many trainers out in the world have their first billionaire standing beside them (Studio → Trainers → *Companion*).

**Graphics.**
- Ink outlines: a thin dark line where one thing stands in front of another, for a crisper, drawn look (Engine →
  Colour → *Ink outlines*; 0 turns it off).
- Sun glare: a soft halo and lens ghosts when the sun is in view and nothing blocks it (Engine → Sun → *Sun glare*).
- Your buddy, folk and the wild billionaires part the grass as they move, and so do the billionaires in a battle on
  the 3D stage.
- An Alpha's entrance shakes the stage with a burst of red sparks, and it glows from below throughout the fight.

**Tests that explain themselves.**
- Every step of the full test now reports what it measured:
  - how long it took and its frame rate;
  - how many frames were slow, how slow, and what the game was busy with at the time;
  - how many things were skipped off screen, and how much memory it used;
  - for walk scenes, how long the scene took to open and what it drew (3D buildings, solid props, grass, folk,
    buddy).
- A step with a problem says why, and where: what was on screen, the renderer state, and the first error with the
  line it came from.
- A new table, *What made frames slow*, adds up every slow frame by cause: opening a scene, compiling shaders,
  building the ground, drawing the menus, uploading pictures, and so on.
- New steps: *Double battle with a trainer*, *Alpha battle: your team against one* and *Billionaires in the world*.
- The debug log records the same causes: `more.slowFramesBy`, `more.slowFrames`, long tasks with their cause, and
  per-second timings of each part of a frame (`samples[].prof`: items, shadows, sprites, grass, solid props,
  buildings, post).
- Quick check (`tools/check-quick.py`): every step prints its slow frames and their causes. A problem prints the line
  of the check that failed, the screen, scene and renderer state and the game's last errors, and saves a picture
  (`validation/quick/fail-<step>.webp`). New step: *v33* covers double and Alpha battles end to end (nameplates,
  aiming, a full turn, catching an Alpha), the wild ones moving in the grass, the buddy keeping up and talking, and
  trainers' companions.

`tools/build-v33.py` sets the four double-battle trainers, the four moves that hit every foe and the new rules. It only
fills in what isn't there yet.

## What changed in v32

**The world map shows towns and routes in 3D.** Zoom the map in and each stop's miniature is a little model
of its scene instead of a flat picture: the ground at its real heights with terraces and cliff sides, houses
and shops as boxes with pitched roofs in their own wall and roof colours, trees as round crowns or pines on
trunks, and boulders as stones. Routes get the same treatment. The models are made from the scene itself, so
Studio edits and v31's new districts show up without redrawing anything. (Engine → World → *3D miniatures on
the map* switches back to the painted pictures.)

**Smoother, with fewer freezes.** From your debug log:
- Only what's on screen is drawn. In a big town about four out of five things are off screen at any moment
  and are now skipped, for the shadows too. Grass is drawn in 8 m patches, and patches out of view are skipped.
- No more long freezes when a scene opens. Bump maps are worked out in the background, shaders are compiled
  ahead of time, and building trees, people and buildings is spread over several frames: anything not ready
  yet shows its flat picture for a moment.
- The last three scenes you visited are kept ready, so going back and forth along a road is quick (about
  1.8 s instead of 10 s here).
- Pictures that are the same are drawn together, and shadows and reflections are reused every other frame
  when the game has to ease off.
- *Ease off when slow* now has five steps. It drops the costliest extras one at a time (ambient occlusion,
  then sun shafts and some glow, then depth of field) before lowering the resolution, and it times real
  seconds, so a slow device no longer confuses it. Battles on the 3D stage start a step lighter (Engine →
  Quality → *Lighter battles*).
- The debug log says when a frame rate was held back on purpose (a window open, another tab, the scene
  scrolled away) and leaves those seconds out of the averages, so a 10 fps reading isn't mistaken for a slow
  device.

**Richer pictures.**
- Shade at the feet of walls, props, trees and terraces, baked into the ground once per scene.
- After rain the streets darken and puddles collect in low spots and on paving, with rings while it rains.
- A fuller sky: a second layer of clouds, bright rims on clouds toward the sun and a glow along the horizon.
- New Engine → Colour → *Tone curve*: Soft (as before), Film or Punchy film; and three new colour grades:
  Pastel, Crisp morning and Moonlit.
- Leaves let sunlight through, and each clump sways on its own.
- Heat shimmer over lava, volcanoes and hot, dry places by day.
- Light dances on walls and rocks next to water.
- At night windows are lit at random, in different warm and cool colours, and fewer stay lit late at night.

**Wear and tear on buildings.** Every building and prop can show dirt streaks, moss low on shady sides,
faded paint, cracks and a colour tint. Each one gets its own amount from its position, so a street of the
same house no longer looks copy-pasted.
- Engine → World → *Wear and tear* sets it for the whole game.
- Walk scenes → scene settings: *Wear and tear*, *Prop variety* and *Look seed* (change the seed to reshuffle
  the whole scene).
- Prop editor → *Variety and wear*: how much this kind of prop varies in size, colour and turn, which colours
  of its picture may change (a hue window, so a house's walls can change and its roof and windows stay put),
  and how much dirt, moss, fading and cracking it gets. ↺ puts back the defaults.
- A placed prop's *Look* section: a tint and its strength, a wear multiplier, and *Exactly as drawn* to switch
  all of it off for that one prop.

**Props feel more alive.** Trees, bushes, rocks, crates, barrels, signs and the like are turned and leaned a
little, and vary a little in size and colour (only within their colour window, so a red mailbox stays red).
Buildings, doors and anything you walk through are never leaned. Engine → World → *Prop variety* and *Prop
turning* set how much; 0 makes everything exactly as drawn.

**Every prop checked.** All 240 props were rendered in the game's 3D renderer from two sides and gone through one by
one (the sheets are in `validation/props/`: `before-after-*.webp`, `all-props-*.webp` and `new-variants.webp`). What was fixed:
- Walls turned away from the sun were nearly black on houses, shops, stalls, tents, kiosks, counters, sofas and
  windmills. Sky light and light bounced off the ground now reach them, so they read as shade, not holes.
- Boxy props (sofas, counters, kiosks, stalls, tents) had black tops. Their tops now show the picture's own top band:
  cushions, counter tops, awning stripes.
- Solid props grown from a picture (benches, picnic tables, planters, bins, cars, crates) smeared one pixel row
  across their whole top. The top now runs over the rows just inside the outline, where a three-quarter drawing
  shows its top: the picnic cloth, the flowers in a planter.
- The small mushrooms (red, brown, blue) are clusters, which a lathe could twist into a dark tangle from some angles;
  they are rounded now. The box beehive is a solid block instead of a turned shape.
- Wide boulders and rock piles looked like thin wedges from the side; they are now at least half as deep as they
  are wide.

**Prop textures.** The sides, tops and backs a solid prop grows now get surface detail in the art's own pixel size:
wood grain along planks and logs, rings on cut stumps and barrel tops, grit and dark flecks on stone, a fine streak
on metal. The drawn front only gets a light touch, so your art stays as drawn. Pictures seen at a slant (stepping
stones, paths, signs side-on, roofs far off) stay sharp instead of going blurry, and far-off props no longer get a dark
fringe round their outline. Engine → World → *Prop surface detail* (0 shows plain colour); Quality → *Sharp at a
slant*, *Clean edges far off*.

**New prop variants** (new pictures made from your existing ones; nothing you drew was changed): barrels, stacked
hay bales, a mossy stump, a mossy log, a mushroom ring, meadow flowers, rocks and pebbles, a crate stack, a cactus pair,
and a woodpile with a chopping stump. They're in the Studio's prop list. About a third of the stumps and logs in a
scene are now drawn with their mossy twin (same size and footprint), unless *Prop variety* is 0 or the prop is set to
*Exactly as drawn*. `python3 tools/build-prop-variants-v32.py` makes them; it only adds what's missing.

**Quick check** (`tools/check-quick.py`): a new step checks what's skipped off screen in Capital Gains, that
going back to a scene uses the kept copy, that wear and variety change the picture and switch off cleanly, and
takes pictures of a worn building and the 3D map miniatures. `python3 tools/check-quick.py --props` makes the
prop contact sheets.

**Full test** (yours): new steps *World map: 3D miniatures up close* and *Skipping what's off screen, wear and
variety*.

New Engine dials: World → *3D miniatures on the map*, *Prop variety*, *Wear and tear*, *Prop turning*, *Prop
surface detail*; Quality → *Skip what's off screen*, *Lighter battles*, *Sharp at a slant*, *Clean edges far off*; Colour → *Tone curve*; Shadows → *Shade at the feet of
things*; Air → *Heat shimmer*, *Wet ground after rain*; Water → *Light from water on walls*.

## What changed in v31

**Bigger towns, longer routes.** Sundown, Tax Haven and Summit Capital each have a new district, and every route
has a longer stretch, all added beside and behind what was there (nothing existing moved, so your Studio edits
stay). Sundown's **Maple Row** is a lane of cottages under maples with a little orchard, beehives and a green;
Tax Haven's **Marina** has a seafront promenade, piers with sailboats, umbrellas, villas with pools up the hill and
the **Offshore Bank**; Summit Capital's **Upper Village** has chalets round a frozen pond, a cocoa stall and a
lookout. Routes get more tall grass, a grove, a resting spot with a bench and a sign, and a wooded back, in their
own trees and rocks; the open-water routes get a small island. Exits on a grown edge moved out to the new edge
and their roads and signposts went with them. (`tools/build-v31.py` does this; it only grows a scene once. The
map miniatures are unchanged; `python3 tools/build-map-minis.py sundown taxhaven summit` redraws them if you
want the new districts on the map.)

**Water looks natural.** Shorelines curve round corners and wander a little instead of following the square
tiles, with a thin line of foam, a wet rim on the bank and a sandy bed under the shallows. Still water on one
level lies flat (the hairline seams on sloping beds are gone).

**Fountains and wells** hold real moving water with ripples: a jet rising from the top, arcs falling into the
upper bowl, a curtain spilling over each bowl's lip with splashes where it lands. A well's water lies dark,
down inside it. The basins are round now (no square corners).

**Rooms are lit from outside.** The town's hour and weather fall through each window as a bright patch on the
floor with the panes' cross in it, moving with the sun: warm by day, long and golden at sunset, faint and blue
under the moon, dim when it's grey. A dusty shaft hangs in the air, the glass darkens at night, daylight spills
in at the door, and wall lamps come on in the evening. Walls have a skirting board and the floor darkens toward
the corners. A room's floor now ends at its front edge: a low cut-away front wall with the doorway open where you
leave.

**Fixes from your notes.** Walking left showed the right-facing picture; it's mirrored now (in the dressing room
too). Plank, stone and other built floors are flat instead of looking rounded (only their seams show).
Autumn no longer turns the grass orange: grass gets a light dry gold and only trees and bushes change colour,
each tree its own mix.

**Settings in tabs**: Game, Look, Sound, Controls, Save and Help. Every option is a row with one line saying what
it does, and buttons or a switch showing its setting at a glance. Sound has a **Test** button per slider and a
new **Ambience** slider.

**Calmer, richer sound.** World sounds start at half the loudness they had, fade in over a few seconds when you
arrive somewhere, and animals call less often (never two within three seconds). New ambience: birdsong by day,
crickets and the odd owl at night, leaves in the wind near trees, a town's murmur, a cave's hum, and a room's
quiet with its clock ticking.

**The place card** is compact: where you are, the hour and weather, staying or walking, one main button and the
rest under *More*. Close it with ×; tap the place's name in the top bar to bring it back. Closed stays closed.

**Look around the world map.** Drag the land to move across it (the drag used to be swallowed by the name
labels), pinch to zoom right down to the miniatures, twist two fingers to turn and slide them up or down to
tilt. With a mouse: drag to move, right-drag (or Shift-drag) to turn and tilt, wheel to zoom, Shift+wheel to
turn; arrow keys move, Q/E turn. The new ⟲ ⦨ ⟳ buttons turn and tilt; the walker button brings you back.

**Battles start where you stand.** On the 3D stage the camera swoops toward the spot, the billionaire bursts out
of the grass in a spray of leaves, and the battle panels slide up over the same picture, no wipe. At the end the
panels slide away and the camera pulls back out. The classic painted stage keeps its wipe.

**Full test.** The stress test's "Normal" step and the screens step read about 10 fps because a window was open
or another screen was showing, and the scene behind is held back then on purpose. The test now closes anything
that pops up before measuring, and says so on the screens step. New step: *Walking faces the way you go*.

**Quick check** (`tools/check-quick.py`): a new step covers the facing fix, the shoreline field at Willow Pond,
the fountain and well water, autumn, a room by day and by night, every settings tab (and that nothing is wider
than the sheet), a switch, closing and reopening the place card, and the map camera (drag, turn, zoom to the
miniatures). Its pictures join the baseline comparison.

New Engine dials: Water → *Natural shorelines*, *Bed color*, *Fountain water*; Lights → *Light through room
windows*.

## What changed in v30

**Three save slots.** Settings → *Save slots* lists them with the trainer, steps, catches, badges, place and date.
Play another slot, start a new game in an empty one, copy your current game into a slot, or clear one.
Switching reloads the page. Your existing save is slot 1. (In the single-page version each slot also syncs
separately.)

**Accessibility.** Settings: *Text size* (normal, large, larger), *Contrast* (high contrast makes panels solid,
grey text full strength and focus outlines bold), *Flashes* (no lightning, no evolution or hatching flash) and
*Buttons* (bigger, easier to tap).

**Languages.** Settings → *Language*: Nederlands, Deutsch, Español or Français for menus, buttons, headings and
settings (stories, names and descriptions stay in English). `game/js/i18n.js` holds the words; adding a
language is one more column.

**Phones.** From your debug log: the crowd freeze is fixed (v25), and each frame now packs the lights and
shadow helpers once instead of once per shader, which saves a lot of small allocations on phones.

**Smaller download.** The single-page version stores its pictures as lossless WebP (every pixel the same, about
half the size): 9.3 MB instead of 12.

**Richer debug log.** It now also records the hour, weather and season; every setting; the save slot and save
size; what's in the scene (props, animals, people, water, ladders); the caches; memory use; long tasks (with
times); how long frames take (a histogram); the sound state; today's challenges and stamps; and the graphics
extensions your phone supports.

**The quick check** compares every picture it takes with a baseline (`validation/quick-baseline/`, made with
`--baseline`) and lists the ones that look different, side by side in `validation/quick/compare/`. New steps:
*Settings* (slots, a language, text size, contrast) and, with `--page`, *Single page* (builds the one-file
version, checks it's under 16 MB, opens it and draws a scene).

## What changed in v29 (Pocket Billies Studio)

**Select several props.** With *Place & move props*, shift-drag a box around props (or shift-click them) to
select several. Drag one to move them all. **Ctrl/Cmd+C** copies them, **Ctrl/Cmd+V** pastes them where the
mouse is (in this scene or another), **Delete** removes them, **Escape** clears the selection.

**Building blocks.** *Save as a building block* keeps a selection (a market stall with its crates and lamps, a
garden, a dock) under a name. The new **Stamp a block** tool (K) puts it anywhere, in any scene; shift-click
stamps it mirrored. Blocks are saved with the game data.

**Scatter brush** (S). Pick a prop in the Props card and drag across the map to sprinkle it, mixed with the
rest of its group if you like (all the bushes, all the flowers…), with a density and size variety you set. It
keeps clear of water and of other props. Alt-drag clears them again.

**Curves.** The **Curved road** tool (R): click points, double-click or press Enter, and the chosen ground is
laid along a smooth curve as wide as the brush. With *Edit the path*, **Smooth the path into a curve** turns the
walker's path into a gentle bend.

**Test runs.** *Test run in the game* (under the scene preview) opens the game in a new tab, straight into the
scene you're editing, with a throwaway game that never touches your save.

**Live update.** A game tab opened from the same Studio address (a test run, or the game itself) shows your
edits to scenes, props and engine settings half a second after you make them, before you save.

**Look previews.** Engine → *Preview every look* draws the scene with each preset (and your own) and shows them
side by side; click one to apply it.

**Ladders and your house** are in the *When tapped* list for props.

## What changed in v28

**Billionaires move in the grass.** The ones hiding nearby wander about the long grass: the blades part where
they go, you hear them rustle, and now and then a pair of eyes peeks out. You still only see their level until
the battle starts.

**Today's challenges.** Three a day on the Walk tab (walk so many steps, catch some billionaires or one of a
type, win battles, land a fish, find a gold stamp). Claim each one for money and an item or coins.

**Townsfolk ask for help.** In every town one person has a gold **!** over their head. They might want to see a
billionaire of a certain type, ask you to walk a letter a few thousand steps, or hope you'll catch one for them.
Requests you've taken on are listed on the Walk tab; go back and talk to them when it's done for a reward.

**Gold stamps.** Two are hidden in every place, glinting on the ground. Walk over one to pick it up. The Trainer
screen counts them, and every third one brings a new piece of furniture for…

**…your own room.** The house nearest the square in Sundown is yours. Walk in and tap **Decorate** to place
rugs, plants, chairs, a table, a sofa, bookcases, pictures, a clock, a window, a fireplace and more. You start
with four pieces.

**Photo mode.** The camera button on the Walk tab hides everything but the scene. Turn and zoom, pick a look
(natural, warm, black and white, old photo, vivid, dreamy), hide the labels, and take a picture to save.

**Battles feel the weather.** In the rain Water moves hit harder and Fire moves fizzle; in a storm Electric and
Water are stronger; snow helps Steel; fog helps Psychic; falling ash helps Fire and Ground; a sunny day helps
Fire and Grass; at night Psychic and Dragon are stronger. The battle says so when it starts, and ▲ / ▼ on a move
shows it. The painted battle stage gets rain, snow, ash, fog or the night drawn over it.

**Ladders.** Lookout Ridge, Stairstep Canyon, Bull Run Pass, Summit Capital, Mount Margin Call and the Bramble
Thicket have ladders up their cliffs. Tap one: you walk to its foot (or top) and climb.

**Studio.** Rules → Time and weather: *Weather doesn't change battles*. Ladders are props (`ladder`, with
`act: climb`, `to`: the landing on top, `h`: the height); `tools/build-v28.py` places them and makes the Sundown
house yours. Your room is the walk scene `int_home`.

**The full test** gained *Challenges, stamps, your room and ladders*; **the quick check** gained *Things to do*
(challenges, a request, picking up a stamp, decorating your room, a photo, climbing a ladder, rain in battle).

New tools: `tools/build-v28.py`, `tools/scene_props_v28.py` (the ladder).

## What changed in v27

**More animals.** Rabbits graze the meadows and bound away when you come close, squirrels dart about the woods,
frogs sit on the banks of ponds and lakes and leap into the water with a plop (they climb back out a few seconds
later), seagulls wheel over the coast and the lake, crabs scuttle sideways on the beaches, mountain goats pick
their way along the ridge and the pass, cats sun themselves in town, and lizards bask on the canyon and the
volcano. Now and then a fish jumps clear of the water.

**Things move.** Boats and buoys bob and roll on the water; flags, banners, beach umbrellas and washing flutter
in the wind (more in a storm).

**Footprints.** You leave a trail of footprints in snow, sand, ash and mud, and on any ground after the rain;
animals leave paw prints. They fade after half a minute.

**Sounds of the world.** Streams babble, waterfalls roar, the sea breaks on the shore, ponds lap, fountains
splash, fires and lava crackle and rumble, rain hisses and the wind blows, all louder as you get close and placed
left or right of you; thunder follows the lightning. Animals call from where they are (ducks, pigeons,
chickens, sheep, goats, cats, gulls, frogs) and scurry off when startled. Footsteps crunch in snow and splash
after rain. Settings → **World sounds** sets their volume.

**The music listens.** Its drums soften while you stand still and at night, a soft pad hums under the night
sky, and in the rain it sounds a little muffled.

**Fixed:** ducks (and now frogs) went missing when you came back to a place you'd already seen: the game
forgot where its water was when the ground came from its cache.

**Studio.** Walk scenes → Life takes the new animals: `rabbit`, `squirrel`, `frog`, `gull`, `goat`, `cat`, `crab`,
`lizard` (with a number, and an area if you like, as before).

New tools: `tools/scene_props_v27.py` (the animals' frame strips and the footprint), `tools/build-v27.py` (puts
the animals in the scenes; only adds kinds a scene doesn't have yet).

## What changed in v26

**Day and night.** The walk scenes follow your clock. Mornings are cool and fresh, the evening sun hangs low and
warm, and after sunset the sky turns deep blue with stars and a moon, lamps and windows light up and you carry a
lantern. Sunrise and sunset move with the season (long summer evenings, short winter days).

**Weather.** Each kind of place has its own: mild towns and routes get sun, cloud, rain, fog and the odd
thunderstorm; the coast more rain and fog; the mountains snow; Mount Margin Call falling ash and embers. It
changes every three hours and is the same for everyone in the same kind of place. Rain falls in streaks,
splashes on the ground, rings the water and makes paving shine; snow drifts; storms flash; fog closes in.

**Seasons** follow the calendar: fresh greens in spring, gold and red leaves and grass in autumn, frost in
winter, with snow settling on roofs, trees and the ground when it snows.

**Who's about changes too.** Psychic and Dragon billionaires come out more at night, Water and Electric ones in
the rain (Electric even more in a storm), Fire and Ground ones in volcanic ash, and so on. The walk card shows
the hour, the weather and the season, and who's about. The battle ticker's INNER SUN line now tells the truth.

**Dark caves.** The Bubbling Grotto is dark away from your lantern, its lamps and its glowing crystals.

**Walk-in shops.** Walk up to a shop, the clinic, the lab or a house and you step inside: a general store with
shelves and a counter, a clinic with beds and a reception desk, the lab with its evolution machine, and a cosy
house with a fireplace. Tap whoever's behind the counter to shop, heal, talk to the professor or chat. The door
(or **Go outside**) takes you back to where you came in.

**Settings** (the gear): *Time of day* (follow my clock, or always morning, midday, evening or night),
*Weather* (changes, always fair, always rain, snow or fog), *Season* (the calendar or any season) and *Shops and
houses* (walk inside, or open the counter right away).

**Studio.**
- Walk scenes: *Weather here* (mild, coast, mountains, volcano, dry, always fair; empty guesses from the
  place) and *Darkness away from lights*. The preview has selects for the time of day, the weather and the
  season, to see a scene at night or in the snow (the game itself follows the clock).
- The four rooms are ordinary walk scenes (`int_shop`, `int_clinic`, `int_lab`, `int_house`); a room has *Who
  stands behind the counter*.
- Rules → *Time and weather*: switch the effect on encounters off, or change how much more often each type
  turns up at night, at dusk, on a fair day, in rain, a storm, snow, fog or ash.
- Engine → Air: *Dark caves* and *Rain and snow* (how many drops and flakes).
- The Check warns when a room is missing or its keeper isn't in People.

**The full test** in the game gained *Night, weather, seasons and rooms*. **The quick check**
(`tools/check-quick.py`) gained *Time, weather and rooms*: it draws Sundown by day, at night, in a storm, in
snow and in autumn (night must be darker than day), the dark cave, then walks into the shop, buys from the
shopkeeper and goes back out to the same door.

**Smaller download.** The single-page version leaves out `background/sundown.png`, a 2.8 MB source picture
the game never loads (it uses `sundown.webp`), so it's 12 MB instead of 16 MB.

New tools: `tools/build-interiors.py` (the rooms), `tools/scene_props_v26.py` (their furniture),
`tools/build-ui-icons-v26.py` (the new icons).

## What changed in v25

**Fishing.** Walk up to any water in a walk scene and a **Fish** button appears. Cast, then wait: tapping
before the float goes under scares the fish away. When it dives, tap at once to strike. Then reel: hold
(the screen, the button or the space bar) to lift the green band and keep the fish inside it until the line
fills up; let it slip out too long and it gets away. Whatever you land comes out for a battle like any
wild billionaire, and you can catch it.

**What bites depends on the water**: ponds, streams, lakes, the sea, canals, swamps, springs and holes in
the ice each have their own catches, at the level of the place you're in plus a little. Nothing lives in
lava. Studio: World & encounters → **Fishing**.

**Six new billionaire lines.**
- **Dinghoy → Yachtsman → Gigayacht** (Water, then Water/Steel). From Yachtsman on, it's big enough to
  ride across lakes and seas, and riding picks the biggest Water billionaire in your team.
- **Gillet → Gill Gates → Gillanthropist** (Water, then Water/Electric).
- **Carplet → Carp Icahn → Corporate Raider** (Water, then Water/Dragon).
- **Shellcorp → Shell Company → Holding Crabpany** (Water, then Water/Steel). These hermit crabs live
  around Tax Haven.
- **Cinderlet → Magmagnate → Krakatycoon** (Fire, then Fire/Ground). They live on Mount Margin Call.
- **Alpacash → Alpacapital → Alpacamogul** (Ground, then Ground/Flying). They live on Bull Run Pass and
  in Summit Capital.

They're in the Field Guide, in the wild pools of the new places and on the end of your line.
`tools/build-art-species.py` draws just the billionaires you name, so pictures you've edited by hand stay as
they are.

**Crowds no longer freeze the game (from your debug log).** On your phone, the stress test's crowd of 40
people took 3–4 seconds per frame, and the Mall, Capital Gains, Willow Pond and the Food Court stuttered for
seconds after opening. The cause: the store of drawn people threw everything away once it held 400
pictures, and 40 people need about 1,300, so every person was redrawn every frame. It now keeps up to
6,000 and only lets go of the ones used longest ago. In the check environment a crowd of 40 now draws as
fast as the usual handful of people.

**The quick check** (`tools/check-quick.py`) gained a crowd step (forty people in town must draw about as
fast as a few), and its walking step now lets the camera settle before tapping and taps again if the first
tap missed.

## What changed in v24

**A bigger world, same walking.** The places you know now stand farther apart on the map, about 1.6 times
east to west and 1.4 times north to south, while every road still takes exactly as many steps as before.
The land was stretched with them, so every stop still sits in its own landscape.

**Miniature towns on the map.** Every stop stands on the globe as a little diorama of its own walk scene,
drawn by the game itself from above: the plaza, the houses, the trees, with a slice of earth underneath.
The pins sit on top of them.

**New places.**
- **The Offshore**, a sea route west of Sundown with sandbars, buoys, a lighthouse and sailboats.
- **Tax Haven**, an island town of white villas, palms, yachts and a bank with no doors. **Leader Marina**
  gives out the Water Badge (4 of 8).
- **Mount Margin Call**, a volcano on Tax Haven's north shore with lava rivers, a crater lake of lava,
  obsidian, basalt columns, steam vents and charred trees. It opens with the Water Badge.
- **Bull Run Pass**, a snowy pass north of Capital Gains with frozen ponds, snowy pines, a misty gorge and a
  hikers' hut. It opens with the Steel Badge.
- **Summit Capital**, a mountain town of chalets on three streets climbing the slope, joined by ramps and
  stairs. **Leader Alta** gives out the Flying Badge (3 of 8).
- **Liquidity Lake**, a lake crossing between Hillside Farm and Summit Capital with reedy islands, ducks and
  a floating market.

Each place has its own wild billionaires (levels 16 to 26), a trainer, and its own battle backdrop.
Tax Haven and Summit Capital have a shop and a clinic.

**Riding a billionaire.** The Offshore and Liquidity Lake are crossings: you need a Water billionaire at
least 1.5 m tall in your team (Quant and Billigator are big enough; Studio: Rules → Riding across water). In their walk scenes you
ride across the water on it, bobbing, with ripples spreading behind. On the map, crossings are dotted
lines over the water, and the place card says who carries you.

**Lava and ice.** Two new kinds of water: lava glows under a drifting, cracked crust, and ice is
white-blue with cracks and a sheen. The open sea runs on to the horizon.

**Studio.** Stops have a "Water crossing: you ride a billionaire" box and the new map landmark kinds. Walk
scenes have "You ride over the water here" and "Open water to the horizon". There are new props: palms,
villas, a lighthouse, buoys, beach umbrellas, deck chairs, sailboats, shells, snowy pines, chalets, a
snowman, snowy rocks, trail signs, charred trees, basalt rocks and columns, obsidian, steam vents, lava
rocks and vents. There are also two new grounds (ash and basalt) and two new horizons (volcano, open sea).
`tools/build-map-minis.py` redraws the miniatures after you change a scene.

## What changed in v23

**Ramps.** The ground can now lean: a ramp is a smooth slope between two levels with no steps, meeting
the ground above and below it without a ledge, with its side walls following the slope. You walk up it
like any path. The Capital Gains streets now climb the hill on smooth ramps, and a new **Test: ramps and a
hill town** scene has a long ramp, a short one, a half-metre platform with its own little ramp, a ramp too
steep to climb (you can't), a town on three levels joined by ramps and stairs, and a gorge with a bridge.

**Walking uphill.** When you steer (arrow keys, or tap to walk), you slow down going up a ramp or stairs,
by up to 40% on the steepest, and go a little quicker downhill. You lean into a climb and back when going
down. Walks driven by your real steps keep their pace.

**Props follow the slope.** Fences, benches, logs, rocks, hedges and planters lean with the ground they
stand on, so both ends touch it, on pictures and solid props alike. Trees, lamps, signs, people and
buildings stay upright. Engine section, World: **Props follow slopes**.

**Cliffs.** Natural rock faces (not dressed walls or brick) get a ragged lip of grass hanging over the top
edge with a line of shade under it, and pebbles fallen at the foot.

**Mist in low ground.** A gorge or valley floor well below where you walk fills with drifting mist.
Engine section, Air: **Mist in low ground**.

**Studio: Ramp** (Walk scenes → Cliffs & stairs). Drag from the low ground to the high ground for a
smooth ramp as wide as the brush. It warns when the ramp is too steep to walk (more than about 60 cm per
metre). Ramp cells show a white slash on the map.

## What changed in v22

**Grass with variety.** The grass is now six kinds of blade mixed by ground type: thin and broad blades,
low clover, dry straw, blades with a small flower head (white, yellow, pink, blue or violet) and tall
grass. It grows shorter beside paths and plazas and taller around rocks, trees and fences, which mowers
miss; it is greener and darker near water and drier in patches. Short tufts line the edges of paths.
Where you walk, the blades lie down and stand back up over a few seconds, so you leave a trail. Gusts
brighten the grass as they pass.

**Kinds of water.** Every pool now knows how deep it is (it deepens away from the shore) and what kind
of water it is:
- **Pond**: clear at the edges where you see the bed, darker in the middle, with fish shadows circling in
  the deep part.
- **Stream**: quick ripples, lots of foam, white water around rocks standing in it, and leaves floating
  down with the current.
- **Canal**: green-grey and still, hardly see-through, a few specks of weed; fish too.
- **Spring**: bright turquoise and very clear, glowing a little, with steam rising off it.
- **Swamp**: dark, murky and covered in drifting patches of duckweed; barely reflects.
- **Lake**: deeper blue, wider waves, fish.

Sunlight focused by the ripples plays over the bed of shallow water. Ducks leave ripple rings as they
swim, fish now and then break the surface, and insects land on still water. Lily pads bob and turn.
Reflections now use the water nearest you, so a canal up on a terrace no longer takes the mirror away
from the pond you're standing by. The ground along the shore is darker and wetter.

Caves get springs and towns get canals unless a scene says otherwise; running water is a stream (a town's canal stays a canal); the
Bramble Thicket's pool is a swamp. Engine section, Water: **Kinds of water**, **Light on the bed**,
**See-through shallows**, **Fish in ponds**, **Ripple rings**, **Leaves on streams** and **Steam over
springs**.

**Studio: Kinds of water** (Walk scenes, map tool **Q**). Drag a rectangle over water to make it a pond,
stream, canal, spring, swamp or lake; later rectangles win where they overlap, right-click removes one.
**The rest of the water** sets the kind for everything else in the scene. Check warns about a rectangle
that covers no water.

The **Test: water** scene now has one of each kind side by side.

## What changed in v21

**Trees in 3D.** Trees keep their hand-drawn pictures but are now built in 3D from them: the trunk (the
narrow part at the bottom) is turned round and runs on up inside the crown, and the crown is split into
5 to 14 leaf clumps, each a small rounded piece at its own depth on an egg-shaped crown, with a copy
behind and a darker core in the middle. From the front a tree looks exactly like its picture; turn the
camera and it has a full, round crown. Each clump sways on its own in the wind, the crown is lit as one
mass (with a little shading per clump) and sunlight shines through thin leaves. Pines are turned whole,
so their tiers make a cone. Bushes get leaf clumps without a trunk. Every tree, bush and rock also gets
a slight turn, lean and shade of its own, so no two stand exactly alike.

**Detail by distance.** Solid trees are used for the nearest 40 within about 20 m of you, other solid
props within about 32 m; farther ones stay pictures, which look the same from there. Engine section,
World: **Solid trees** (on or off), **Solid trees within (m)** and **Most solid trees at once**.

**Flowers, ferns, tall grass and reeds** get a second picture crossing the first when the camera
turns, so they don't turn into a line edge-on.

People and townsfolk always face the camera, so they never look paper-thin and are unchanged.

## What changed in v20

**Props built from parts.** A prop can now be made of several parts, each a rectangle of its picture
with its own shape: round (turned), laid flat, thin slab, solid block, rounded or flat picture. "Laid
flat" turns a band drawn in three-quarter view into a level surface, so the fountains now have real
round basins with flat water in them and round columns, and the well has a round wall, posts and a
roof that covers it. Anything outside the parts (the fountain's falling streams) stays a picture. In
the Studio's prop editor, **Build it from parts…** shows the parts as coloured rectangles on the
picture, with their shape, position, depth, the row a flat part lies at and an open top for basins.

**Test scenes.** Thirteen small places, each putting one tricky situation in front of the renderer and
the walking rules: stairs of every height (and at an angle, and under an arch), ledges right at the
limits (a 30 cm step you can walk up, a 40 cm one you can only hop down, 1.75 m you can still hop,
1.9 m you can't, an 0.8 m gap between cliffs), bridges of every kind (with banks at different
heights and a bend onto one), water of every kind, shadows with a low sun, every prop in rows, slopes
from gentle to too steep, the camera in tight spots, lights at night, a dense forest, a tiny and a
huge map, and traffic with animals. Each has **walking checks** (what must and mustn't be reachable)
and camera spots for pictures. Open them in the game from the debug menu, **Test scenes**; the walk
card then names the test scene and has a button back to the game. The game's full test opens every
test scene and runs its checks; `tools/check-quick.py` always runs the checks and, with `--tests`,
draws every test scene and takes its pictures. They are built by `tools/build-test-scenes.py`, live
with the other scenes (ids starting with `test_`) and are listed at the bottom of the Studio's walk
scenes. A prop placed with `"vol": "card"` in a scene stays a flat picture (the shadow test shows a
crate both ways).

## What changed in v19

**Pixel-art shadows.** Shadow edges now step in whole pixels, on the same grid as the ground's pixels,
instead of a smooth blur, and the soft edge of a shadow is shaded in three dithered tones the way a
pixel artist would draw it. Shadows also stand still while the camera moves (the shadow map moves in
whole texels), and the map now covers just the ground the camera can see, so shadows near you are
sharper. Engine section: **Pixel-art shadow edges** and **Sharper shadows around the camera**
turn either off.

**Coloured shadows.** Shade now takes on the shadow colour (a cool blue-violet by default, like the
darkest tones in the art) with a little coloured bounce light, so shaded ground and walls look painted
rather than greyed out. Engine section: **Colour in the shadows** sets how strong it is; the existing
**Shadow color** still picks the colour.

**Solid props.** Props keep their hand-drawn picture as their front and get a body made from that same
picture's pixels:
- **thin slabs** for signs, fences, poles, traffic lights and flags: turn the camera and they have
  edges instead of paper-thin sides;
- **solid blocks** for crates, benches, bins, cars, vending machines, the food truck and stalls;
- **rounded shapes** for rocks, boulders, cacti, logs, sacks and hay, bulging most where they are widest;
- **turned shapes** for round things (barrels, bins, pots, stumps, mushrooms, umbrella tables, posts
  and street lamps), round from every side.
Edge faces take the colour just inside the art's dark outline. Every solid prop is lit by the sun on
its own surfaces, casts a shadow of its real shape and receives shadows. Trees, bushes, flowers and
grass stay pictures (with their layered crowns), and buildings keep their 3D models. Engine section,
World: **Solid props** turns them off. In the Studio's prop editor, **Solid shape** picks the shape for
a prop (automatic, flat picture, slab, block, rounded or turned) and its depth.

## What changed in v18.1

**A quick check for test machines.** `tools/check-quick.py` replaces the half-hour validation run for
everyday checks. It is built for a browser without a graphics chip: walkable paths, doors, bridges and
stairs are checked straight from the scene data without drawing anything, each scene is drawn only
until its first frames appear (at a third of the resolution), battles play at four times the speed,
and every step has a time limit. It takes about 6–9 minutes and writes `validation/quick/`.
`tools/check-game.py` no longer runs the game's own full test: that test measures real frame rates, so
it belongs on your phone or computer (the debug menu: Settings → Debug, or Ctrl+Shift+D → Full test), with the debug log sent back.
The game itself is unchanged from v18.

## What changed in v18

**Cliffs and terraces.** The land now has steps in it. Every scene carries a height grid at half-metre
resolution on top of its rolling ground, so a terrace ends in a vertical face instead of a ramp: rock
on the routes, layered sandstone in Stairstep Canyon, cave rock in the Grotto, dressed stone in Sundown
and Capital Gains, brick at the Food Court, concrete in the Scrap Yard and the Mall, dark slate on
Lookout Ridge, timber round the Farm's raised fields. Each face has its own tiled pixel texture
(`art/scene/build/walls.png`), a lit lip along the top and a shadow at the foot. Anything more than
30 cm up is too tall to step onto, so you walk round it or take the stairs.

**Stairs.** Wherever a road or a door path meets a cliff, a straight flight of stairs is built into the
step: stone steps with iron railings in the towns, timber steps on the routes, carved sandstone in the
canyon. Capital Gains has a grand stair up to the town hall and gentle ramps for its streets. Your
trainer climbs them step by step, and footsteps sound like stone on stairs and like hollow boards on
wooden bridges.

**Ledges.** The Long Grass, the golf course's raised green and Lookout Ridge have low ledges you can hop
down from anywhere along the edge (with a little jump and a thud), but only climb at their stairs.
The golf bunkers are sunk into the ground.

**Bridges, ravines and water at different heights.** Bramble Thicket has a mossy ravine with a stream
and a wooden bridge; Lookout Ridge a deep gorge crossed by rope bridges on the way to a lookout; Capital
Gains a stone-walled canal through the park with a stone bridge; Willow Pond a boardwalk across the
pond; the Farm a footbridge over its brook; the Grotto a hot-spring cascade of stepped pools. Water lies
level in ponds and follows the slope in streams, and wherever it drops over a step it falls in a
sheet with spray and mist (steam in the Grotto).

**Arches and escalators.** A brick gate stands at the top of Sundown's stairs to the lab, a rock portal
at the top of the Grotto's, and a natural rock arch over the road in Stairstep Canyon; you walk under
them and they turn see-through while you're beneath. The Mall's stairs to the mezzanine are escalators
with moving steps, glass sides and black hand rails.

**The camera.** A cliff between the camera and you thins out so you stay in view, and the camera tilts
up a little when high ground rises behind you.

**Smoother loading.** The ground picture for a scene is now built in small slices between frames
instead of all at once, with faster noise, and the last few scenes are kept, so walking into a scene
(or back into one you just left) no longer stalls the game for a few seconds.

**Pocket Billies Studio.** Walk scenes have a new map tool, **Cliffs & stairs** (key C): paint a cliff or
terrace to a height with the face material of your choice (Shift-click picks up a height), drag a
flight of stairs from low ground to high ground, paint ledges, drag bridges from bank to bank (wooden,
stone arch or rope), or erase. The map shows the steps, faces too tall to climb, ledges, bridges,
railings, arches and escalators, and **Can I walk there?** shades everything you can't reach. Resizing
a map keeps its cliffs. Check & backups warns about bridges that end in the water or run off the map
and cliffs made for a different map size. The Lite renderer paints terrace faces and bridge decks.

**For scene data:** `steps` and `stepm` (the height grid and face materials, base64), `bridges`,
`rails`, `arches`, `escalators` and `streams` are new optional fields of a scene; scenes without them
look and play as before. `tools/build-scenes.py` builds them (`--scenes` rebuilds every scene but keeps
your prop and ground catalog); `tools/build-walls.py` draws the face textures. The full test checks in
every scene that each exit, door and bridge can be walked to and that bridges and railings are drawn,
and the validation run takes close-ups of the new places.

## What changed in v17.1

**Black scenes fixed.** On some phones (Adreno graphics, for example the Galaxy S24 Ultra) the new 3D
buildings' shader wouldn't load: two of its inputs asked for the same slot, which most graphics chips
forgive and these refuse. Every scene with a building (Sundown, the Food Court, the Mall, the Farm and
the city) then stopped drawing. The shader now uses its own input slots, the engine only assigns its
standard slots to inputs that don't choose their own, and if a device still can't draw the models the
building pictures stand in instead of a black screen (the debug log says why).

**The full test no longer hangs.** Every step has a time limit; a step that runs over is marked as a
problem with the reason and the test moves on (a step left behind stops itself). A scene that isn't
drawing is reported as “the scene isn't drawing (black screen)”, and the stress test is skipped with
that note instead of measuring nothing for 40 seconds. A new first step, **Shaders**, checks every
shader for clashing input slots, the problem behind the black scenes. Closing a battle during its
opening wipe no longer causes an error.

**Validation run.** `tools/check-game.py` prints each step with the time as it goes, renders at half
resolution in the test browser and runs the game's full test in a smaller window, so a run takes about
half an hour instead of an hour; it waits at most 25 minutes for the full test and now fails the run if
the full test finds a problem.

## What changed in v17

**A bigger world.** The stops stand farther apart on the world map (east to west by about a fifth,
north to south by about two thirds), and every road takes 40% more steps. The painted patches on the
map moved with their stops, the trails were repainted and the 3D relief rebuilt. Every walk scene is
bigger (44 × 34 m for routes, 46 × 34 m for towns, the city 64 × 48 m), so exits are farther from
where you stand.

**Capital Gains, the central city.** A new town between the two routes, with roads to Hillside
Farm, the Bubbling Grotto and the Scrap Yard. (The Scrap Yard now also needs Leader Rocco's Ground
Badge, so the city is no shortcut past the canyon steps.) Avenues and streets with pavements,
crossings and traffic lights; a brick plaza with a fountain, a golden coin sculpture, flags, a food
truck and café tables; a park with two duck ponds; brick townhouses, pastel apartments, Capital
Tower and Capital Hall on a raised upper street. Shops: **Capital Mart** (a general store), the
**Capital Outlet** (it sells the clothes of every other boutique) and a clinic. Two trainers,
Broker Bea and Intern Ollie, wait in town, ten townsfolk walk about, and the city has its own song.

**3D buildings.** Every house, shop, clinic, lab and city building is drawn as a small 3D model:
the front is the building's own picture (so a repainted picture shows up), with side and back walls,
a stone foundation, and a roof at its real pitch: hip, gable, front gable, flat behind a parapet,
or lean-to, with an overhang, fascia boards, a ridge cap and tiled clay, shingle, slate, thatch or
flat-roof textures in the building's own colours. Chimneys are real, and the smoke comes out of
them. **Windows are see-through**: behind every pane is a simple room (back wall with furniture,
side walls, floor and ceiling) that shifts with your view like a real room and lights up at night;
the glass reflects the sky. The models cast and receive shadows. Studio → Engine → World turns the
models or the rooms off; the Lite renderer still uses the pictures.

**Heights, terraces and ramps.** Scenes now have raised terraces with steep fronts: the upper town
of Sundown with the lab, the canyon's three stair-steps, the Grotto's upper ledge, the Mall's
mezzanine, the farm's field terraces, the city's upper street. Paths that climb become ramps with
stone steps; you can't walk up a cliff. Town terraces get a stone retaining wall.

**More natural scenes.** Ground patches of meadow, flowers, dirt and gravel follow soft noise
instead of ellipses; trees grow in groves with forest floor, ferns, mushrooms and fallen leaves
under them; flowers grow in drifts; worn dirt runs along path edges; ground types meet along
wobbly lines (paved ground keeps crisp edges and curbs); houses have lawns, picket fences, gnomes,
birdhouses and washing lines.

**New props.** 56 new props: city buildings (3 townhouses, 3 apartment blocks, Capital Tower,
Capital Hall, a café, a boutique, a mart), street furniture (traffic lights, hydrants, phone booth,
food truck, newsstand, bus shelter, bollards, bike rack, benches, litter bins, street trees,
planters, banner lamps, billboard, crossings, manholes, café tables, vending machine, post box,
flag poles, coin sculpture, plaza fountain, four cars) and nature and farm props (ferns, fallen
leaves, pebbles, puddles, flat stones, weeping willow, red maple, birdhouse, beehives, scarecrow,
wheelbarrow, firewood, rowboat, washing line, garden gnome, picket fence, stone wall, mooring post).

**Life.** Ducks paddle on the ponds, pigeons peck on the plazas and fly off when you come close,
chickens and sheep wander the farm (the chickens scurry away from you), and cars drive round the
city's streets, stopping for you and for each other. A scene lists its life in game data; the Studio
edits it as text (Walk scenes → Life).

**Layered trees and bushes.** Every tree and bush now has a darker back crown set behind it and its
sunlit front clumps set in front, so crowns look round as the camera moves (v13 only had this for a
few trees near Sundown's square). Trees also keep their crossing picture.

**More ground textures.** Eight new ground types (asphalt, pavers, brick paving, gravel, dirt, forest
floor, stone steps, lawn) and five variants of every ground type, picked per tile and mirrored now
and then, with large soft patches of warmer and cooler colour, so big fields no longer repeat.

**Studio.** The prop editor has a **3D building** section (roof kind, pitch, eave and walls drawn as
guides on the picture, overhang, storeys, colours, wall and roof textures, side windows, rooms; or
“Make it a 3D building” for any prop with a footprint). Walk scenes get a **Life** card. The check
warns about cars without a road, shop doors for missing shops and outlets that sell unknown shops.

**Full test.** Also checks the city: 3D buildings drawn, cars moving, pigeons present, and that
every exit and every door can be walked to.

**Tools.** `tools/build-scene-tiles.py` (new ground types and variants), `tools/build-buildings.py`
(textures, rooms and 3D plans), `tools/scene_props_v17.py` (new props and life, loaded by
`build-scene-props.py`), `tools/build-prop-layers.py` (layered crowns for all trees and bushes),
`tools/build-world-v17.py` (spreads the stops, adds the city, moves the map patches) and a
rewritten `tools/build-scenes.py`.

## What changed in v16

**Sound and music.** Every sound is synthesized in the browser, so the game is no bigger. Each kind
of place has its own song: Sundown and the towns, the routes, caves, the malls, the world map, and
Professor Hazel's theme for the opening. Battles have wild, trainer and rival music; winning,
catching, levelling up, evolving and hatching play short tunes. Moves hit, crit, miss and fizzle
audibly, billionaires have cries, coins pop, footsteps change with the ground, shops ring up your
purchases and every button ticks. People talk in little voice blips at their own pitch.
**Settings → Music** and **Sound effects** set the volumes (all the way down mutes). As in every
browser game, sound starts after your first tap.

**Your rival, Blake.** The first time you reach the Overgrown Golf Course, Blake runs up to you in a
short scene with his portrait and expressions, then battles you with the starter that beats yours.
Beat him and he turns up again at **Hillside Farm** for a rematch, his starter evolved and two more
on his team. Professor Hazel mentions where he went. (The opening called him Chad by mistake; he is
Blake everywhere now.) Trainers with an `intro` in the game data get a scene like his.

**Conversations.** Tap a townsperson and you walk up to them; they stop, turn to you and talk in the
dialogue box with their portrait, name and voice. Professor Hazel at the lab talks about your Index,
your badges and where to go next. Trainers say their piece before a battle starts. Shopkeepers in
the shop and the boutiques are shown as talking portraits. One dialogue box is used everywhere,
including the opening.

**Buildings and trees in 3D.** When you turn the camera, buildings show side walls and a roof top
made from their own picture's colours, instead of looking like cut-outs. Trees get a second picture
crossing the first, so a turned camera sees a crown. Benches, fences and signs stay flat.

**Fixes.**
- On a slow device the move menu could appear before your billionaire had landed from its coin.
  Battle messages now wait for the animation on the scene's own clock.
- The hanging lanterns in the Bubbling Grotto glowed as big white rectangles; a prop with several
  lamps now shares its light between them.
- A crowd appearing no longer stalls the game: each person's walk frames are drawn one by one when
  first needed, and in the background before that.

**Full test.** Now also checks conversations and sound.

## What changed in v15

**Camera.** The walk-scene camera stands about twice as far back with a narrower lens, so the view
is just as wide but far less distorted: lamp posts stand straight, buildings face you instead of
leaning back, and more of the town fits above you. It also looks a little less steeply down.
Indoor scenes (caves, the mall) keep the camera inside the room. Engine → Camera has the new
**Distance** and **Tilt adjustment** dials.

**Horizon and blur.** The Hollow Earth still curves up in the distance, but about a third as much.
Depth of field is half as strong with a wider sharp band, everywhere: walk scenes, battles and the
map.

**Props stay in the world.** Trees, buildings, lamps, fences and everything else now keep their
place and orientation in the world when you turn the camera, like cut-outs standing in a model
town; only people and billionaires turn to face you. The Studio's prop editor can still make a
picture face the camera ("Turns to face the camera"), and its turntable now turns only as far as
the game camera can.

**Materials and normal maps.** Every prop is made of a material, chosen from its name or set in the
prop editor: leaves and plants (light glows through them from behind, soft wrap-around light),
wood, stone, metal (a sharp shine), buildings (flat walls, glinting windows), cloth, and crystal and
glass. Each material shapes its normal map differently (rounded from the outline, plus bumps from
the pixels themselves) and takes light differently. The ground has a normal and shine map too, made
from the painted tiles: cobbles, rock and paths catch the light pixel by pixel, the mall floor and
plazas gleam, grass stays matte. Engine → World: Ground bumpiness, Ground shine.

**Shadows.**
- The shadow map now bends with the horizon curve like everything else, so shadows on distant hills
  line up with what casts them.
- Flat things (buildings, fences, signs, benches) cast the shadow of their real shape and receive
  shadows exactly on their surface: a tree's shadow falls across a house front.
- Round things (trees, rocks, lamps) cast a full silhouette toward the sun at every camera angle.

**Full test.** Settings → **Run the full test** (about two minutes) replaces the quick test. It walks
through every walk scene turning and zooming the camera, fights a battle on the 3D stage and one on
a painted stage, opens the world map in 3D and flat, plays the opening cutscene (without starting a
new game), goes through every tab of the dressing room, a shop and a boutique, and the Team, Guide
and Trainer screens. Each part is marked OK or Problem, with any errors it caused. Then a **stress
test** in Sundown keeps adding load (a crowd of 40, 600 particles, 150 more trees and rocks, maximum
quality) and reports the frame rate at each step and how far the device keeps up. Saving is paused
during the test and your save is put back exactly as it was. Everything goes into the debug log.

## What changed in v14

**New trainers.** Every person in the game (you, rivals, arena leaders, shopkeepers, townsfolk and
Professor Hazel) is now built like the billionaires: a skeleton of body parts with pictures on each
bone, seen from the front, back and side. Clothes, hair and faces are pieces on the same bones, so
they move with the body in every pose: a six-frame walk, throwing a coin, cheering, reacting. The
look sits between realistic and stylized: about three and a half heads tall, bigger expressive
eyes, shaded clothes with folds, seams and buttons. Faces have expressions (blink, happy,
surprised, sad, angry and talking), used by the new portraits.

**Your body, your way.** Boy and girl are gone. Sliders set height, leg length, arm length, body
size, shoulders, hips, chest and head size, with one-tap builds (Slim, Sturdy, Athletic, Curvy,
Tall, Petite). Skin, hair and eye colours come from palettes or any colour you pick.

**The dressing room.** Opened from your Trainer card (Edit look). Tabs for body, face, hair, tops,
bottoms, shoes, hats and extras (glasses, neck, bags), with pictures of each piece on you, colour
swatches for every coloured area of an item, a preview you can turn around, walk and pose,
Surprise me, undo and redo, and three saved outfits you can switch between with one tap. Old saves
keep their look: it is converted to the new pieces.

**Boutiques.** 84 pieces in all; 37 are yours from the start. The rest are sold in three shops,
each the same dressing room with a till: try anything on, then **Buy and wear**.
- **Second Chance Threads** in Sundown (Dolly Hemline): thrift basics, sweaters, denim, caps.
- **Personal Best Sports** at the Food Court (Coach Rhonda Sprint): jerseys, track suits,
  runners, headsets, sunglasses.
- **Maison Margin** in the Mall of the Deep (Monsieur Markup): blazers, trench coats, top hats,
  monocles, crowns.
Items you're trying on that are sold elsewhere tell you which boutique has them.

**The opening.** Press Start and the camera comes down over the rooftops of Sundown to the lab.
Professor Hazel walks out and talks to you (a dialogue box with her talking portrait; tap to go
on, Skip jumps ahead). She asks who you are and the dressing room opens, with six ready-made looks
to start from; your trainer then walks in. Hazel throws three coins and the starters pop out of
them. Flip through them (or tap one in the scene): the camera moves in on each, with its type, what
it's good and bad against and its Field Guide line. Choose, confirm, and the game begins. Without
WebGL, or in Lite mode, the previous step-by-step intro is used.

**Portraits.** Trainers talk with their portrait in the battle message box; beaten trainers show
theirs; tapping the lab in Sundown has Hazel answer in person.

**Engine.**
- **Mountains on the world map**: the land rises from a height map (`art/map/world_h.png`, made
  from the painted map by `tools/build-world-relief.py`); the map is ray-marched so hills hide what's
  behind them, with hill shading in the 3D and flat views. Engine → World: World map mountains,
  hill shading.
- **Ambient occlusion**: soft darkening where things meet the ground and in creases, from the
  depth of the picture. Engine → Shadows: Ambient occlusion, Occlusion size.
- **Light shafts** from the sun (and from the Inner Sun on the map) when it's in or near the view.
  Engine → Sun and sky: Light shafts, Shaft length.
- **Colour grades**: Warm film (default), Teal and orange, Storybook, Faded photo, Dusk, Cold
  morning, with a strength dial (Engine → Color). The ready-made presets now choose a grade too.
- **One wind**: grass, trees, bushes and falling leaves follow the same gusts, so a gust rolls
  across the meadow and through the trees together.
- **Layered trees**: "deep" versions of the trees (`tree_oak_deep` and so on) with a back canopy
  and a front canopy that sways more, so crowns look round as the camera turns. The trees around
  Sundown's square use them; use them anywhere in the Studio's Walk scenes. Made by
  `tools/build-prop-layers.py`.
- The cutscene camera is part of the engine: any script can fly a free camera through a walk scene.

**Studio.**
- **Wardrobe** section: the list of every piece by slot; per item its name, slot, price, boutique,
  whether you own it from the start, and its colour areas (name and default colour). The piece
  editor paints each view and bone on top of the body (pencil, eraser, fill, picker, zoom), with
  a colour-area brush that marks which pixels follow which colour; add a piece fitted to a bone,
  blank or copied from another view, grow it, undo. Expressions are pieces too. A body and
  skeleton editor moves the joints. The preview shows any look with all the sliders.
- **People** pick their looks from the wardrobe with a live preview; **Town shops** has boutiques
  (a new boutique in one click) and World puts a boutique at a stop.
- **Battle preview**: a Stage choice runs the battle inside a walk scene, like the game.
- **Prop editor**: a split tool cuts part of a prop's picture into a new layer.
- `python3 tools/build-trainer-art.py --only=hat_cap,tee` redraws just those items (art and data);
  without options it only adds what's missing and never touches art you've edited.

## What changed in v13

**Battles in the walk scene.** When a billionaire jumps out, the fight happens where you are
standing: the camera drops to the battle view inside the same 3D scene, props standing in the way
step aside, and both billionaires and trainers are lit by the scene's sun and lamps, cast real
shadows and sit in its haze and depth of field. Glowing moves light up the ground around them. The
battle camera still pushes in, shakes and orbits like before, and when the battle ends you are back
on the Walk screen without a reload. Settings → Battle stage switches back to the classic painted
stages; those are also used in Lite mode, without WebGL, or at a stop without a walk scene.

**A clearer map, drawn by the graphics card.** The map uses the same canvas as the walk scene, at
full resolution, with soft focus around the place you look at, the Inner Sun glowing and clouds
casting shadows.
- Every stop has a pin with an icon: where you are, your destination (flag), towns (house),
  routes (leaf), locked stops (padlock), and a "new" tag on places you haven't been. Pins that
  would overlap shrink to their icon.
- Your trip is a moving gold line; picking a place shows the route there as a white line and puts
  step counts on the roads around it.
- **Places** (list button) lists every stop with how many steps away it is, grouped into here,
  visited, not visited yet and locked.
- **Flat** (globe button) unrolls the whole world into one flat map you can pan and zoom.
- Opening the map from the Walk screen starts close to you and pulls back.
- Lite mode and devices without WebGL keep the previous map.
- The Studio's Engine section has a **World map** scope for the map's own lens and color.

**Prop editor and layered props.** See the Studio table above. In the game, each layer is its own
sprite at its own depth, so a porch, a sign or a canopy given some depth moves against the
building behind it as the camera turns. Layers can face the camera, stay put (they turn with the
world, like a cut-out) or lie flat, and can glow. The existing props were left exactly as they were
(no art was split automatically); add layers where you want them.

## What changed in v12

Built from the two debug logs (an Android phone and a Windows PC with Intel graphics).

**Lights and shadows**
- The sun now comes from the top left, the side the pixel art is painted from, so shadows fall back
  and to the right and agree with the shading on buildings and people. The canvas (Lite) renderer
  follows the same sun.
- Buildings cast solid shadows with their real roof line instead of a flat cut-out.
- Shadows are softer the farther they fall from what casts them, take a cool tint instead of plain
  grey, and combine with the soft contact darkening under things instead of stacking on it.
- Lamps, windows and fires no longer draw big white discs. The scene is drawn in high dynamic range
  and bright pixels bloom softly; very bright colors roll off gently instead of clipping to white.
- Window light only falls in front of a building, not through its walls. Street lamps are dim in
  daylight. When more than 16 lights are near, the farthest fade out instead of popping.
- Caves and the mall are lit evenly from the room instead of by a weak sun.
- Drifting cloud shadows on sunny scenes.

**Speed**
- Path finding rebuilt its walk map on every lookup (50–150 ms hitches on the phone log); it is now
  cached and takes about 2 ms.
- The scene runs at 10 frames a second while a window is open over it; the blurred glass behind a
  window was halving the frame rate.
- The map limits how many pixels it draws on wide screens (the PC log spent 33 ms per map frame).
- The first, slow frame of a scene happens behind the loading screen ("Setting the scene").
- Very wide screens draw at most about 1.6 million pixels before scaling up, and when the game
  lowers resolution to keep up it also uses cheaper soft shadows and depth of field.
- The debug log takes its scene picture once a minute instead of every 15 seconds (reading a
  picture back stalls the graphics card for a frame), plus a fresh one when you export.

**Engine and Studio**
- The renderer is split into a shared engine (`game/js/engine/`): settings, core, light and post.
  Battles and the map move onto it in the next versions.
- New **Engine** section in the Studio (see the table above). Game-wide values are saved in
  `gamedata.js` under `engine.defaults`, a scene's own values under `scenes.<id>.look`, your presets
  under `engine.presets`.

## What changed in v11.1

A debug log you can export from Settings, a 30-second quick test that measures how smoothly the
game runs on your device, and a launcher for playing on a phone over Wi-Fi (see above).

## What changed in v11

**Walk scenes in 3D.** The scenes are now drawn with WebGL:
- **Height.** Every scene has hills, banks and slopes; the canyon has a mesa you climb up to, the
  grotto a raised ledge, the farm terraced fields and a windmill hill, Lookout Ridge rises toward the
  back and drops off a cliff at the front, and Willow Pond sits in a bowl. Roads climb gently; slopes
  that are too steep are cliffs (with rock faces) that nobody walks up.
- **Light.** Sun shadows from a shadow map: trees, houses and people cast their real outlines across
  hills and over each other. Every sprite gets automatic surface shading, so light wraps round it and
  catches its edges. Lanterns, fires, windows and crystals light the ground and people near them,
  strongest in caves and the mall. Soft contact shadows where things touch the ground. The Inner Sun
  leans and warms a little through the day.
- **Life.** Ponds reflect the reeds, trees and you, with ripples, foam at the bank and glints. Grass
  blades sway in rolling gusts and bend away as you walk through. Low mist gathers in hollows.
  Buildings turn see-through when you walk behind them.
- **The Hollow Earth.** Land, trees and rocks stretch out past every scene and the world curves
  *up* in the distance; above, the far side of the world shows faintly around the Inner Sun.
- **Camera.** It leads your walk a little, sways with your steps, tilts with your phone (Settings →
  Scene tilt) or the mouse, turns with two fingers, right-drag or Q/E, and zooms with a pinch or
  Ctrl+wheel (R resets). Depth of field comes from real distance, with round highlights, and the
  focus follows what you tap for a moment.
- Visual effects: Lite (or a browser without WebGL2) uses the v10 canvas renderer. The renderer
  lowers its resolution by itself on slow devices.

**The scene behind everything.** Team, Guide and Trainer now float over your live surroundings
(softened so the panels stay readable). Only the world map has its own full-screen view. The sky
islands are gone.

**Trainer card.** The Shop tab is now **Trainer**: your portrait and look, money, where you are,
when you started, your buddy, badges (with empty slots for the ones to come), records (steps today
and in total, distance, places visited, Field Guide, trainers beaten, eggs) and your bag. Settings
is a button there and on the top bar.

**Shops are in towns.** Walk into a town's shop (or use its Actions). Every coin and item the old
Shop tab sold is still in a town shop; the shop sheet now shows the coins in your bag.

**Team screen.** A hero card for your lead (big sprite, types, HP and XP, Heal, Make buddy,
Details), the party as cards with one-tap Make lead and Heal, open spots that let you add from
storage, day jobs with pay progress, and storage with sorting and type filters. The billionaire
sheet puts its actions first (Make lead, Make buddy, Heal, Move to storage / team, evolution
actions), then moves, stats and the nickname.

**Studio.** A *Shape the land* tool with a height map overlay, the walk-around preview uses the new
renderer, and `tools/build-scenes.py` now shapes each scene's land.

## What changed in v10

**Choose where to go.** The stops are no longer one straight line. Roads branch and loop between
twelve places, including three new ones: **Willow Pond**, a quiet pond between the Long Grass and
the golf course; **Hillside Farm**, a farming hamlet with a windmill and a clinic; and **Lookout
Ridge**, high above the canyon. The world map is now full screen: drag to look around, tap a place
to see how far it is, which way the road goes and who lives there, then **Travel here**. Your steps
walk you along the roads, through the places in between. You can stop on the way, turn back, change
plans, or **stay** where you are: staying still earns money, hatches eggs and brings encounters.
The path you'll take is drawn on the map. Locked roads (badges, a trainer blocking the way) say why.

**Walk around.** In every town and route you can walk: tap the ground to go there (or use the arrow
keys / WASD). Tap a building to walk to its door: the shop opens, the clinic heals your team,
houses and signs have something to say. Road signs at the edge of each scene show where each road
leads; tap one to set off. Tap a **?** in the grass to walk over and battle it, or a trainer to
challenge them. Townsfolk stroll around and chat. When you travel, you walk out of town along the
road, and the next scene starts with you walking in from its edge.

**Deeper scenes.** Soft sun shadows that follow each sprite's shape, contact shadows, distance haze
on everything, distant hills, forests, mountains, mesas or cave walls standing behind each scene,
sunlight and gentle vignetting, and sun rays in the woods. Chimneys smoke, fountains splash, fires
crackle, windows glow in caves and malls, crystals sparkle, windmills turn, butterflies circle
flowers, leaves fall, birds cross the sky, and tall grass rustles as you walk through it. The
scenes were rebuilt with natural layouts: towns around a plaza with doors facing it and little
paths to each door, gardens, fences and mailboxes, forest edges with mixed trees, ponds with reeds
and lilies, crop fields, and roads curving out to each exit. 64 new prop variants (oaks, pines,
birches, blossom and fruit trees, bushes, flowers, cottages in four colors, fences, benches,
planters, signs, lamps, a fountain, a windmill with turning blades and more), eight distant-hill
layers and six small animated effects.

**Livelier battles.** The battle camera moves: it settles in, drifts slowly around the field,
pushes in on attacks and pulls back on big hits. Each backdrop has more scenery, the battle fills
the screen, and the depth-of-field blur now keeps both fighters sharp while softening only what's
far away or close to the lens.

**Loading screen.** The game now loads every piece of art at the start (about 540 files) behind an
animated loading screen with your trainer walking along the progress bar and tips. Anything that
fails to load is listed by name with **Try again** and **Play anyway**, so a missing file is found
right away instead of showing up as a blank later. After the first visit it loads from the cache.

**Interface.** Pixel buttons that sink when pressed, a little sparkle on section headers, cards with
a faint pixel texture, a hopping tab bar, toasts with a spinning coin, softer sheets and staggered
entrances. Motion follows the reduced-motion setting.

**Studio.** Roads editor, hub and exits tool, prop actions, scene life (hills, townsfolk, wind, sun
rays), prop footprints, a walk-around preview, and new checks: roads to missing stops, stops no road
reaches, and scenes with fewer exits than roads. `tools/build-scenes.py` rebuilds every scene
(`--force`) or only the catalog (`--catalog`).

## What changed in v9

**Plain names everywhere except the billionaires.** The billionaires keep their parody names and
Field Guide notes. Everything else now reads like a normal creature RPG:
- Nine types: Fire, Water, Grass, Electric, Ground, Flying, Psychic, Steel and Dragon, plus
  Normal for untyped moves. Fire beats Grass, Grass beats Water, Water beats Fire, and so on. Every
  billionaire line got types that fit its look, and the three starters (Hoodini, Gushlet,
  Scooplet) are now Water, Fire and Grass. Your rival still picks the one that beats yours.
- Each type has one ability: Kindling (Fire), Regrowth (Grass), Keen (Electric), Sure-footed
  (Ground), Swift (Flying), Erratic (Psychic), Alloy (Steel) and Legacy (Dragon).
- Moves were renamed and retyped (Tackle, Cinders, Splash Shot, Vine Lash, Static Wave,
  Boulder Toss, Wing Strike, Mind Pulse, Heavy Press, Wyrm Breath and so on), and every
  billionaire learns moves of its own types. Saved billionaires keep the moves they know.
- Stats are HP, Attack, Defense, Sp. Atk, Sp. Def and Speed. Statuses are Paralyzed, Asleep and
  Burned. Levels show as “Lv 12”. Money is shown in dollars.
- Items: Potion, Hi-Potion, Burn Salve, Nerve Tonic, Wake-Up Tea, Revive, Max Revive, Full Remedy,
  Trail Mix, Pretzel and the Shining Stone, with new icons. Coins: Copper, Silver, Gold and
  Platinum.
- Badges from arena leaders (Leader Rocco's Ground arena, Leader Iris's Steel arena), eggs and
  incubators, storage, the Field Guide, the Shop, Professor Hazel, and your rival Blake. The arena
  sandstorm replaces the market shock, sharp stones replace rent, confusion replaces hype.
- Places: Bramble Thicket, Bubbling Grotto, Stairstep Canyon, Scrap Yard, and the Meadowlands,
  Crystal Caverns, Spore Forest, Coral Trench, Golden Hills and Cloud Spire ahead.

**Walk scenes.** The Walk screen opens on a full-screen tilt-shift diorama of the stop you're
at: ground tiles in perspective, upright pixel props with shadows and swaying leaves, drifting
clouds and their shadows, sparkling water, lantern and crystal glows in caves and the mall, and a
blur that grows toward the top and bottom of the screen. Your trainer walks the path as your steps
come in, and the scene changes when you reach the next stop. Trainers stand in the scene; tap one
to battle. Scroll down (or tap Actions) for everything that was on the Walk screen before.
- Nine scenes ship, one per stop, built from 47 new props (cottages, the shop, clinic and lab,
  trees, bushes, tall grass, wells, lanterns, market stalls, tents, crystals, stalagmites, scrap
  piles, a windmill and more) plus the battle props, and 16 ground tiles.
- The renderer lowers its resolution on slow devices and drops to a few frames a second while you
  read the actions below. Visual effects: Lite turns the blur off.

**Hidden encounters.** Wild billionaires waiting for you appear as rustling grass with a “? Lv 7”
tag, in the scene and in the Encounters list. You only find out who it is when the battle starts.

**Studio.** A new Walk scenes section (see the table above), a Walk scene picker for each route
stop, and checks for broken scenes. All Studio wording uses the new names.

## Note on older versions

The notes for v9 and before describe earlier versions and use the names those versions had.

## What changed in v8

**Skeleton builder** (Billionaires → Skeleton builder, or from the pixel editor)
- Click a part or pick it from the list. Drag to move it, drag its dot to move only the
  pivot, Shift-drag to tilt. Ctrl+Z / Ctrl+Y undo and redo, Delete removes the part.
- **+ Blank part** adds a placeholder to paint. **+ Part from PNG** imports a picture.
  New pictures go in a new strip at the bottom of the normal and Gold-Plated sheets, and
  by default the part is added to the back view too, scaled to fit.
- Each part has a name, a parent, a position, a tilt, a draw layer (separate for the
  back view, where it can also be hidden) and **Moves like**: the motion it borrows
  from the body plan. A part called `fin` can wag like a tail, flap like a wing or stay
  still.
- **Mirror copy** flips a part and all its children to the other side, swapping left
  and right in their names and motions. **Duplicate**, **+ Child part**, **Give it its
  own copy** (for pictures shared between parts), **Replace from PNG**, **Resize** and
  **Add the missing expression pictures** (blink, happy, hurt, shout) are on the same
  panel.
- **Body plan** switches how the whole body animates (biped, four-legged, flyer, fish,
  serpent, worm, octopus, blob, shell), with its settings such as hover height or wing
  beat. Preview any action with **Animate**, attack, cast, hurt, cheer and faint.
- Battle framing (shadow width, height, body center) is recalculated when you finish.

**Blank bodies.** **+ New billionaire** can start from a blank body in a color you pick,
with one to three evolution stages that grow in size. It gets moves of its type, joins
the first wild pool, and opens in the skeleton builder so you can paint and reshape it.

**Battle preview.** A new Studio section that runs the game's own battle stage on your
unsaved data. **▶ Preview animation** on any move and **▶ Preview** on any battle backdrop
open it directly. It stops drawing when you leave the section.

**Map art.** A new tab under World & encounters, described in the table above. Keys:
B brush, I pick, F fill, C clone, T fill with terrain, E erase trail, R trail brush,
Ctrl+wheel zoom, Ctrl+Z / Ctrl+Y undo and redo. The flat map is turned so the route sits
in the middle instead of across the left and right edges. The Route stops tab shows the
painted map before you save.

**Fixes**
- Dialogs no longer close the pixel editor or skeleton builder behind them.
- Undo right after typing in a field now undoes that edit.
- Options hidden in a dialog (like the color shift for blank bodies) stay hidden.

## What changed in v7

**Battles**
- The battle fills the whole screen at any size or orientation. The two billionaires are
  framed in the space the HUD leaves free, and the world continues behind frosted glass.
- Phones in portrait get a bottom dock. Landscape and desktop get a side panel. Tablets
  get a centered dock.
- Depth of field is computed in the canvas per row of ground and per sprite, with focus
  pulls between attacker and target.
- New feedback: floating damage and heal numbers, "Super effective" and "Critical hit"
  tags, HP bars with a trailing damage ghost, stat-change badges, a red low-health
  vignette, a turn log while a turn plays out, catch odds on each coin, and vibration
  on supported phones.
- New effects: contact shadows, cloud shadows sliding across the ground, swaying
  foreground grass, reflections on indoor floors, status fizz above affected
  billionaires, sparkles around Gold-Plated ones, and speed lines on critical hits.
- Desktop shortcuts: F fight, 1–4 moves, C coin, I items, T team, R run, Esc back,
  Space/Enter continue.

**Performance and loading**
- Settings → Frame rate: 30, 60 or 120 FPS. 120 needs a 120 Hz screen; Settings shows
  what your screen supports. Visual effects: Full or Lite (no glass blur or depth of field,
  for older phones). Vibration on/off.
- One scheduler drives every animation. The ground is redrawn only when the camera or
  focus moves, and rows hidden behind the dock are drawn at half detail. If frames run
  long, battle detail drops automatically and comes back when there's headroom.
- Images shrank from 4.5 MB to 2.0 MB with lossless recompression. Every visible pixel
  is identical. The title picture loads as a 266 KB WebP instead of a 2.8 MB PNG.
  `sundown.png` is kept.
- Fonts are bundled, so nothing loads from the internet. A service worker caches art
  for instant repeat visits and offline play. Code and data always load fresh, so Studio
  edits show up. While you read the menus, the next battle's art and sprites load in the
  background.

**Interface**
- A sticky status bar shows where you are, your Sweat Equity and today's steps.
  Navigation is a floating glass bar, or a side rail on wide screens.
- Two-column layouts on desktop. Bottom sheets on phones, centered dialogs on desktop.
- Dark mode, reduced motion and keyboard focus still work throughout.

**Town shops**
- Sundown General Store, Grotto Supply Co., Pretzel Pavilion and the Mall's Concierge Desk.
  Each has a keeper, a greeting, local prices and quantity buying.
- New goods: Trail Mix (heals the whole team), Pretzel, Spill Kit (cures any status and
  heals) and Golden Parachute (full revive).
- The Mint still sells the everyday coins and items.

**Debug menu**
- Open it from Settings → Debug menu, with Ctrl+Shift+D, or by adding `?debug` to the
  address.
- It can add steps, Sweat Equity, coins and items; give any billionaire at any level;
  start any wild or trainer battle; jump along the route; earn or reset Board Seats; add
  or hatch Seed Rounds; pay jobs; win, lose or force a catch in battle; set battle speed
  to 2× or 4×; show an FPS meter; lock quality; and list game-data warnings.

**Fixes**
- The world map no longer overflows its frame. Map controls moved where the info card
  can't cover them.
- Encounter names no longer overlap their sprites.
- Battles used to fill only half the screen.

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
  `tools/build-lore-v47.py` the story text (`lore`), `tools/build-story-v47.py` the opening's trainers and story
  data, `tools/build-loader-v47.py` the loading screen's runner and coins, `tools/build-moods-v47.py` a mood per
  place, `tools/build-landmarks-v47.py` the landmarks, `tools/build-life-v47.py` signs of people,
  `tools/build-fx-v47.py` bees, fish and moths, `tools/build-regions-v47.py` the 27 places of the seven regions and
  `tools/build-region-props-v47.py` their props, `tools/build-map-minis.py` the map's miniatures (`--all` redraws
  them). `tools/v47-cleanup.py` was the one-time clean-up.
- alpha 0.1 tools: `tools/clear-windows.py` finds the props that stand in front of a window (on a building's front
  or a room's wall) as the walk camera sees them, and `--fix` moves them aside; the place builders run it on every
  place they make.
- `retired/`: kept for reference, not used by the game (the v46 map miniatures). `tools/retired/` holds one-time
  migration tools that already ran.
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

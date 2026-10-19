# Changelog

Pocket Billies, from the fresh base on. Versions are `0.MINOR.PATCH alpha`: MINOR for a finished phase or a batch of
new features, PATCH for fix-only releases; "alpha" becomes "beta" once the planned features are all in. The version is
written in one place, game/version.js. The legacy build's changelog is in docs/archive/LEGACY-CHANGELOG.md.

## 0.1.0 alpha (unreleased)

The fresh base. Numbering starts over; saves from the legacy build don't load (a new game starts and the old save is
kept aside in the browser).

- Story scripts (Project Story S1, S2): every conversation is written as lines in the data, with choices,
  conditions, once-only and rotating lines, and commands (docs/SCRIPTS.md): people, trainers before a battle, Blake,
  Cass and Vinylla running up to you, Hazel in the lab, the talk after Blake's first battle and the ending. Same words
  as before. Hold the dialogue box to skip. A save taken mid-conversation keeps the state from before it and plays it
  again on Continue. Test runs can start at a point in the story (`?story=after-opening`, `?story=before-cass`).
  People, trainers and props can appear only at some points of the story, places can stay closed until a point, and a
  chapter can swap a map for another version. Every line has an id the debug log names. The data check checks the
  story (names, flags, line ids, places that could never open). A battle started from the debug menu no longer shows
  the trainer's opening lines.
- Cutscenes are data (cutscene tools, sessions 1 and 3): each is one file, game/data/cutscenes/<id>.json, with the
  map it is filmed on, named camera shots and spots, traffic lanes, its own time of day and weather, and a script
  (docs/CUTSCENES.md). The opening with Professor Hazel and Blake plays from its file, same words as before.
- A new start (Project Story S7): New game opens in a city at night in the rain; a figure walks up a neon street,
  sees a violet light in an alley, reaches for the rift and falls; the fall goes on from the crust to Copperleaf.
- The title is back (the test boot is off; `?boot=test` gives the quick start): signed out, a card to sign in with
  Google or play without an account; signed in, your account in the corner (tap to sign out) and Continue presses
  itself after 4 s unless you touch anything. A new player sees the city behind the title, a returning one Copperleaf.
  What's new opens the latest notes (meta.json, the Studio's World page). When your account and this browser have
  different games, you choose which to keep; the other is set aside (Settings → Save brings it back or downloads it).
- The Studio writes the story (Project Story S3): every script (trainers, people in a scene, the story's own) in one
  field that shows mistakes as you type, on their line, with a command reference and line ids; a Story scripts
  section; a story preview in the scene editor (pick a point in the story: who is there and who isn't); **Play from
  here** opens the game in that place, on a spot you pick, at that point in the story, with your unsaved changes.
  The scene editor's People card edits today's people (script, when, unless), and the Check lists the story checks.
- Golden Billies are gone (Studio track ST-0). In their place, coats: a recolour of a Billie's art, made in the
  Studio's new Coats section from palette ramp and colour swaps or a hand-painted sheet, each with its own odds in the
  wild, from eggs and on the line (none yet: the sample coat, Midnight, only comes from the debug menu). A coat's name
  goes before the Billie's ("A wild Midnight Emberox appeared.") and shows on its card. The Studio's pixel editor
  loses its Golden tabs; the Billies section and the battle preview pick a coat instead.
- The Studio on wide screens (Studio track ST-1): drag the edges of the section list, a section's list and the battle
  preview's panel (or use the keys), and each section keeps its sizes; wider layouts at 1920 and 2560 px and up, and
  no more 1180 px cap; two sections side by side (Shift-click a section, or its ⇥ button); layout presets in the top
  bar (Auto, Compact, Wide, Ultrawide, Split).
- The Studio paints pixels on one shared canvas (Studio track ST-2), in the sheet editor and the prop and ground tile
  painter: whole-number zoom that keeps the pixel under the pointer, a grid from 8x, Space-drag to move the view, a
  line tool, box selection, flip left-right or upside down and quarter turns of the selection or the part under the
  pointer, symmetry drawing, a lock to the game palette (and the pixels off it shown in magenta), an onion skin of
  the other view, and Aseprite's keys. Painting is in the Studio's one undo, in order with every other edit, and stays
  undoable after switching Front/Back. `?` lists every key. An undo in Walk scenes no longer only takes back a
  height cache the map kept.
- The Studio's Art workbench (Studio track ST-3), Sheet mode: drop sheets anywhere on the Studio and cut them into
  parts by a kit's rows, islands of art, a template grid or an Aseprite JSON's frames and slices; art drawn big (an AI
  image at about 4x) snaps back to its pixels; names from a template; front and back matched by name, then by
  position; Write puts the pictures and the parts in the game (one undo each). The phase 16 kits slice exactly as
  before, so tools/slice-part-kit.py is retired; the part list is now game/data/partKits.json.
- The Studio's scene preview has a free camera: fly over the scene and look at any corner from any angle, with the
  mouse, the keys or two fingers on a phone; a top view; put the walker where you look.
- Robots (phase 17 prototype): build your own from a gem and four parts (torso with head, left arm, right arm,
  legs). They join the same team and the same battles as Billies. Their moves come from their parts; a hit on a robot
  also lands on a part, aimed moves pick the part, a broken arm loses its move and broken legs are slow; healing and
  the new Repair Kit fix them. A Workshop panel on the Team screen refits them. Placeholder art. In the Studio: a
  Robots section, robot options in Moves, Items and Trainers.
- One version, 0.1.0 alpha, read everywhere from game/version.js: the title screen, the Studio's top bar, the offline
  cache, the debug log, the diagnostics report and saves.
- Friends are safer: friends find each other by code only, only friends see a player's page, and only the receiver
  can accept a friend request. Names lose characters that could break the screen.
- The game needs WebGL 2. Without it, a screen says this device can't run the game, with Try again and Export debug
  log. Lite mode and Settings → Graphics → Battery saver are gone (a save with it on comes back at full effects).
- Steps are gone (phase 08 Part A). Nothing counts steps any more, real or in the game:
  - Wild Billies live on each map: 4 on a route, 2 in a town with tall grass, none in other towns and rooms; full on
    your first visit, then one more a minute of play.
  - Money: a wild win pays level x $20; trainers, bribes and challenges pay as before.
  - Eggs hatch by the real metres you walk outdoors: 2 / 4 / 8 km eggs. Distance walked on the trainer card is real km.
  - Your buddy gets the full XP of a win even when it sat out. At level 32 a starter's evolution asks you: Build or
    Hype. Day jobs are gone until the ranch.
  - The daily challenge is "Visit N different places today"; a letter goes to a town 1 to 3 roads away and back.
  - Roads are measured in metres from the maps ("90 m"); the gold arrows guide by metres.
  - All the step text is rewritten (tips, people, Hazel, rooms, lore: money is coins now).
  - Saves of format 2 start over (save format 3).
- Rooms open at once (phase 08 Part B): the room is drawn over its town at the door, the town dimmed round it, and
  nothing of the town is painted or built again, so stepping in no longer waits (the Marigold shop took up to 11 s
  headless, now under 1.2 s; your phone's debug log says "inside ... (waited N ms)"). There is one way in: through a
  building's door. The 9 s fallback that showed a room on its own and Settings → "Shops and houses: Counter" are gone
  (a door with no room still goes straight to the counter). Coming out, you stand just in front of the door facing
  out, and the camera is as it was. A turned building's door turns with it. Marigold's shop and clinic signs lead
  into their buildings.
- Run: push the joystick past its rim into the outer ring (it turns gold), hold the D-pad's centre, or hold Shift.
  Settings → Moving about → Always run makes a full push, the keys and tapping the ground run. The keys and the D-pad
  walk at walking speed (they were a little faster). The walk cycle, footsteps and camera bob keep pace with your
  speed.
- Studio: the Jobs section opens again (it broke when the jobs' rules went); Rest stop price is in the Battle card;
  the camera dial "Step sway" is called "Walk bob".
- Removed: the single-file Claude-artifact version, the old train station prop, the v45 backup scenes in the game data
  (1.5 MB), importing a legacy Net Worth backup.
- Smoother towns on phones: props no longer all recheck their height and look in the same frame twice a second, and
  the props' culling grid is no longer rebuilt every 2 s (both were regular hitches in big towns like Clovercrest).
- Diagnostics report format 2: a place's fps counts from once it is open, its opening hitch is reported apart
  (`openHitchMs`, `openHitchCause`), and the first and last second of the other steps are left out (they read low).
  The debug log now names the opening hitch (setting up the ground, building the ground mesh, the walk grid, reading
  the picture back) instead of "outside the marked steps".
- Draw counts (phase 20, stage A): the debug log says, once a second, how many draw calls, instances, program
  switches, texture binds and uniform calls a frame made, and how many draws each render pass made (shadow maps,
  lamps and the reflection apart); also the lights in the frame, programs compiled after a place had settled, and a
  rough sign of garbage-collection hitches (Chrome). The graphics test and the diagnostics report the draws per step
  (a Draws column). Fix: their pass timers had skipped the 3D models, box faces and structures.
- Less work per frame (phase 20, stage C, first part): the graphics settings are looked up once a frame instead of
  thousands of times, and the walk view stops making new lists and arrays every frame for the shadow passes, the
  contact shadows, the sprites and the grass, which leaves less for the browser's garbage collector. Nothing looks
  different.
- Less work per frame (phase 20, stage C, second part): a test switch, Studio → Quality → "One light block per frame"
  (off for now), sends the frame's light (sun, sky, fog, shadow maps, lamps) to the graphics card once a frame instead
  of again for each kind of thing drawn; the graphics test compares it off and on at the Lamp square and the Depth
  corridor. Rugs, lily pads and other flat things are drawn as one group, and windmill sails and clock hands no longer
  send the light again each. Nothing looks different.
- New: the **graphics test** (Settings → Help, and the debug menu), about ten minutes on a new test place, the Graphics
  bench. It measures what each graphics setting costs on your device: the 17 Expert dials and five hidden ones, five
  steps each, then everything at its lowest and highest. It ends with a table, costliest first, and Save the report.
- Fix: the full test could let the friends list publish your name and place while the maps loaded at its start.
- Fixes: with Motion set to reduced, the camera snaps instead of gliding. Puffcap Woods and Russetwood get their own
  flower colours (they had the default ones).
- Under the hood: the game's and the Studio's code are ES modules, and the published game loads them as one file.
  The game needs a web server (opening index.html from disk no longer works at all).
- Under the hood: the modules no longer put their names on `window` (the game and the Studio reach each other's
  code through imports); for the console, add `?globals` to the address.
- Under the hood: the code, the data and the files have descriptive names (docs/NAMING.md; the old -> new list is in
  docs/archive/phase-05-renames.md). The places' ids match their names (Marigold Town is `marigold`, no longer
  `sundown`), so a debug log, a `?scene=` link or a Studio export from an earlier build names places the old way.
  The save format is 2: a save from an earlier 0.1.0 build doesn't load (a new game starts and the old save is kept
  aside, as with legacy saves). No text changed, but the 43 places with a new id look a little different: the
  pattern of their ground, their countryside, townsfolk and stamps are picked from the id.
- Under the hood: the rules, the save format and the battle engine are in game/js/logic/, which runs without a
  browser (the page reaches it only through hooks.js; `npm run check:logic` runs it in plain Node). TypeScript checks
  the data, the save and the logic from JSDoc comments (`npm run typecheck`); nothing is compiled.
- Studio: the hidden "With its neighbours" preview button is gone (it hadn't shown since the modules change).
- The debug log's picture of the scene no longer shows what your buddy says (it could name your Billie).
- Settings → Help → Run the graphics test (also in the debug menu): every graphics setting on its own, then the
  graphics presets, each checked for frames, frame rate and errors, in an OK/Problem table. "Save the report" saves a
  short file with no save data or names. Your save and your graphics settings are put back afterwards.
- The full test saves nothing while it runs, in this browser, to your account or to your friends, and puts your save
  back after (a signed-in player's account could get the test's changed save before). Its Road step arrives again
  (it never did since walking became the default), and its room step works on a slow device. Settings → Help says
  what it really covers and that it takes a few minutes.
- Under the hood: unit tests (`npm test`, tools/test/, in plain Node, about a second): the logic on a small data set
  and on the game's own data (battles, double and Alpha battles, catching, the AI, evolution, encounters, saves), the
  world-map graph (places, roads, exits, gates, lifts) and the expressions in dialogue. The quick check runs the
  game's own full test one step at a time, and whole every night (`check-quick.py --selftest`); smoke checks that the
  exported debug log holds no names. A Claude Code hook runs the fast checks after each edit.

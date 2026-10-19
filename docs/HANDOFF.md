# Handoff log

Newest entry on top. Every phase session ends by adding an entry here and tagging the commit `phase-NN-done`.

## Entry template
### Phase NN - <name> - <date>
- Changed: 
- Risky or unfinished: 
- Verified (what ran, what passed): 
- Decisions I made (and why): 
- Questions waiting for the owner: 
- Next session starts with: 

### Phase 09 batch 8, part 3 - the owner's answers to the beat sheet - 2026-10-19
- Changed: docs/city-opening-beats.md now 21 s with the owner's decisions (the city replaces the fall's first leg,
  done in S8 so the opening keeps working until then; the figure reaches toward the light; the billboard's advert
  stays open); project-story.md's decisions table points to it. Map `city_opening`: the spot `stumble` is now
  `reach`; one billboard placed opposite the alley as the ad slot (its advert is one picture,
  city_billboard_holo.png, swapped to change it).
- Verified: the script in the beat sheet parses (parseScript, no problems); the billboard clears the towers (from
  the data); data check.
- Next session starts with: S7's remaining owner checks on the phone (the set at night in the rain), then S8.

### Phase 09 batch 8, part 2 - towers lit on every side; the city opening's draft set and beat sheet - 2026-10-19
Owner's request: "the 3D version of the building and a small map for the cutscene", keeping Project Story's system
in mind. Chosen: lit windows on every side, the portal in a side alley, the rift, the layout plus a draft beat sheet.
- Changed (one cause per commit):
  - Engine: a fixed picture layer on a model can face any way (`yaw`, radians: pi/2 the right side, pi the back), in
    the sprite pass and in water reflections (prop-models.js, walk/sprites.js, walk/water.js). Nothing used it
    before, so nothing else changes.
  - The towers' window pictures and neon strips on all four faces (front and back share a picture, the sides
    another); the hero needle's eight faces in two pictures, its crown strip all round.
  - Map `city_opening` (a draft, test: 1, not joined to the world): one avenue between 15 towers, the hero needle
    closing the view, street lights, signs, hovering cars, a 5 m alley on the right two thirds up with the BAR sign,
    puddles, a vending machine, the rift and a new `city_sign_blank` (the organization's logo spot, blank until S4).
    You start at the near end. A `cutscene` block holds what the opening's script will name: spots (walkFrom,
    alleyMouth, lean, stumble, rift, logo), camera shots (above, canyon, street, alleyMouth, rift, through: eye and
    target as [x, height, z], fov) and two car lanes. Nothing reads it yet (camera and walk play from S2).
  - docs/city-opening-beats.md: a 26 s beat sheet, the beats as a script in the story layer's format (it parses with
    today's parseScript, no problems), and the decisions it needs from you.
- Risky or unfinished:
  - Fill rate: each tower now draws about 10 large window pictures and the set has 16 towers. Not measured on a
    phone; walk the avenue at night and send a debug log.
  - The rift stands there always; appearing on a beat needs `when` / `unless` on props (S2) or a show/hide command.
  - Part 1's notes about front-only windows are superseded by this entry; the low-poly setting note still holds.
- Verified: each recipe meshed in Node (city_sign_blank 58 triangles, towers unchanged), the layout checked from the
  data (no tower overlaps another, no prop inside a tower), data check, lint (the frame-block.js note from main),
  type-check, 118 unit tests, format, modules, build, smoke check ("no problems"; its unused note again names one picture and one prop, the same as part 1). No headless renders.
- Questions waiting for the owner: the four in docs/city-opening-beats.md ("For you to decide"); how the set and the
  lit sides look on your phone (Settings > Time of day: night, Weather: rain).
- Next session starts with: your answers to the beat sheet; then S7's script and the scene's commands once S2 is in.

### Phase 09 batch 8 - city opening mockups: towers, signs, street things, portals (provisional) - 2026-10-19
Owner's request: start the city opening's buildings and props, as mockups to judge before S4 and S7-S8 (Project
Story's "Ask me before": the city mockups before S8 builds the scene). Look chosen 2026-10-19: only tall buildings
(Cyberpunk 2077, Blade Runner), sleek tops over grimy bottoms, neon in pink, cyan and amber. Then: "make various
portal shapes".
- Changed (tools/build-props-batch8.py, independent of batches 1-7, rerunnable; new keys only, nothing places them
  outside the new showcase map `test_props_city`):
  - Towers from one kit (grimy base: concrete, slabs, shopfront with a neon strip, pipes, AC units, fire escape,
    small windows with grime runs; sleek shaft: glass, chrome bands, corner fins, lit curtain wall):
    city_tower_slab (90 m), city_tower_mega (95 m, balcony cages, two setbacks, a landing pad), city_tower_hero
    (125 m octagonal needle on a podium, edge light strips, a holo-ad band, the organization's logo panel **blank**).
  - Signs with generic words only (no brands, those are S4's): city_sign_hotel (vertical blade), city_sign_bar,
    city_sign_open (arrow), city_billboard (holo panel on a truss, no text).
  - Street: city_streetlight (cyan bar), city_vending, city_flying_car (hovering at 2.4 m, lights; still, the lanes
    and splines are S8's).
  - Portals, five shapes, each in two colourways (variant 0 violet, the city's side; variant 1 gold-green, the Hollow
    Earth's light): portal_ring (with floating shards), portal_rift (a jagged tear), portal_door (a door that wasn't
    there, on a scorched threshold), portal_gate (a machine-built octagon gate with a generator), portal_hole (the
    pavement gives way: broken slabs, a glowing hole, a beam of light rising). The swirls are still pictures.
  - Each prop has a front picture (for when models are off) and a coloured halo (`glow`) at night.
- Risky or unfinished:
  - Only picture layers glow (the model shader has no emission), so lit windows are a picture on each tower's FRONT
    face only; the sides are unlit glass with bands and fins. Fine for a scripted camera; say if the sides need light.
  - With Settings "Props as low-poly" off, a 125 m tower would be built as voxels at 32 to the metre: too big. Nothing
    turns it off but that setting; S8 should keep the city's towers low-poly always.
  - Triangles (meshed in Node, no rendering): towers 714 / 2,536 / 848, everything else under 330. Not measured on a
    phone; the largest window picture is 378 x 1,699 px (the slab's glass).
- Verified: data check, lint (one naming note in game/js/engine/frame-block.js, already on main), type-check, 118
  unit tests, module and format checks, smoke check (15 of 15; its unused note names detail-a04.png and airship_mast, both from before); each recipe meshed in Node; the generated pictures looked at as
  flat sheets. No headless renders of the props (graphics are for your devices).
- Decisions I made (and why): towers 90-125 m so they read as megacity at street level; sign words kept generic;
  steady glow, no flicker (no engine change; flicker can come with S8).
- Questions waiting for the owner: on your phone, open `test_props_city` with Settings → Time of day at night: the
  look of the towers and signs, which portal shape (or shapes) and which colourway.
- Next session starts with: the owner's picks; then the full kit after S4 (names, logo, surface/interior contrast).

### Phase 20 stage C, session C-2 - One light block per frame (C3), flat things and blades (C4) - 2026-10-19
Plan approved at the start ("Yes, let's go"), after sorting out the branches. Branch `ccr-9d72271f-j72y94`.
- Branches first (nothing of stage B or C-1 was in main at the start):
  - Stage B and the A8 decisions had been pushed onto stage A's branch after #39 merged, so no PR showed them.
    Main had changed walk-view-gl.js since: merged into B with each change put in the game/js/walk/ file its code
    moved to (the 38 changed lines match main's exactly). Merged as **PR #43**.
  - C-1 reached main through #45 (its own branch, ported onto the split by another session). My own port of it
    (#44) merged into B's branch, not main, and is superseded. This session's commits were then replayed onto main
    by themselves: the 6 code commits applied with no conflict.
- Changed (one cause per commit):
  - No-op: LIGHT_GLSL's declarations grouped (samplers and uFol first, then the light values), the sky terms read
    through `SHV(i)`. The same 54 uniforms before and after.
  - **C3** `game/js/engine/frame-block.js` (no WebGL): `FRAME_BLOCK_GLSL`, the std140 offsets worked out from that
    text (2208 bytes), `packFrameBlock` (a light context into the block, with setLightUniforms' values and defaults).
  - **C3** `quality.frameBlock` (off by default; Studio Quality "One light block per frame"): the 14 lit programs
    compile with `PB_FRAME_BLOCK` and read the Frame block on binding point 0. setLightUniforms packs a light context
    and sends it once (one of four slots of one buffer; the reflection's copy takes its own slot) and binds a slot only
    when another was in use; lampShadowMaps marks a packed context stale. Switching it compiles the lit programs again
    at the start of the next frame (a stall of a few frames, only then).
  - **C3** The full test's Shaders step builds each lit program with the block and checks the block's size and each
    member's offset as the device lays them out (smoke: "27 shaders; 14 with the Frame block"). Smoke's line for the
    in-game test now shows each step's note.
  - **C3** Graphics test: the switch off and on at the Lamp square and the Depth corridor (120 steps over 20 settings),
    kept out of "everything lowest / highest".
  - **C4** Flat things: one group on the fx program (bound once, the sprite program again once after). Blades and clock
    hands: the fx program's camera and light sent once per frame and light context, then only switched to.
- Where the phase file was wrong or I went another way (checked in the code):
  - `uCurve`/`uCurveD0` are not in the block: only the vertex shaders read them (COMMON_GLSL), and the shadow passes
    set them before the frame's light context exists. The block is 2208 bytes, not 2224, and has `uShSteps` (the
    file's layout missed it). No vertex shader declares a light value, so only fragment shaders hold the block.
  - The file's program list: `shadow`, `shadowG`, `p3dS`, `voxS`, `bshadow` don't take the block (no light code).
  - C4: blades and clock hands are not moved into a group after the sprites. Each shares a plane with its own picture
    and with any picture at the same depth (billboards at the same z), where the later draw wins, so moving them
    would change the look in places. They still switch programs; the light re-send was most of their cost.
  - The sampler units are still set per program bind (the file says once at link): unchanged here.
- Risky:
  - With the switch on, a light context changed after its first lit draw would show last state; only lampShadowMaps
    changes it, before any lit draw, and it marks it stale. A new caller that changes a context mid-frame must call
    `frameBlockStale(X)`.
  - useFxProgram skips the light re-send by the identity of the camera and the light context; both are made new
    every frame. Code that binds a texture to units 6-13 between lit draws (only setLightUniforms does today) would
    break it.
  - Off by default: what the phone draws is unchanged until you switch it on.
- Verified: after every commit lint, typecheck, unit tests (86 -> 94), check:modules, format:check; check:data and
  build; smoke 15/15 for every commit touching game/. Off sends exactly what it sent before (setLightUniforms' calls
  recorded for three light contexts and three program shapes: identical). All programs compile and link in both
  modes (headless compile only, no drawing). Planted faults fail each new test, and a planted layout fault fails
  smoke's in-game Shaders step. No headless graphics test was run.
- Questions waiting for the owner:
  - Merge this session's PR (C-2 only, from main).
  - On your phones: the Graphics test's two "One light block per frame" steps (Lamp square, Depth corridor), and does
    it look the same switched on? If it holds up, it becomes the default and the old path goes (its own commit).
  - Tags `phase-20a-done` / `phase-20b-done` (and C) once merged?
- Next session starts with: C5 (light picking: stable keys, a persistent lit set with fades, partial top-k every
  ~200 ms, view test, hysteresis, `quality.lights` 16 / 8 on phones), or stage D (pixels) if the numbers say so.
### Phase 08b-2 - rooms in their own space, drawn at the door - 2026-10-19
Plan approved at the start (Part B tasks 7, 8 and the doors half of 2). Branch `ccr-4fc4790e-8depsm`, from main at
d2f9721.
- Changed (one cause per commit):
  - **Fix first:** main's `check:modules` was red (an `engineSetting` import 08b-1 left unused in seamless-world.js).
  - Door link: `doorOf(p)` (door point, way out, the front's middle) and `doorLinkOf(p, act, map)` in the links' shape
    `{kind: 'door', a: {map, exit}, b: {map: room, exit: 0}}`. A kind's room is now `room` in scenery.json (11 kinds;
    the table in ui.js and the Studio's two copies, int_station included, are gone); the choice is
    `PB_DATA.doorRooms` (data-files.js), shared by the game, the Studio and check-data. A turned building's door turns
    with it (257 doors move 9 cm at most). check-data: every door opens a room, the room has its doorway at the front,
    the door is on the building's front.
  - **Rooms over the place:** a room's view (seamlessRoomMap, same ids) is the place's own view with the room's tiles,
    heights, walls and things laid in, but its ground is the place's (`groundOf`: same picture, mesh and near ring;
    groundKey and the scene cache follow it). The place's ground, grass, water and their shadows leave a hole where
    the room is; the room's floor and walls, built from the room alone (`roomScene`, painted at the near ring's size),
    are drawn there at the floor's height (walk/ground-draw.js roomHole, roomFloorReady; three rooms' floors kept).
    Nothing is cropped any more (roomCut is gone).
  - Speed: in a room the walking grid works out heights for the room only; the heights grid is the place's with the
    floor laid in; the last two views' walking grids are kept (coming out is a swap).
  - Out of a room: 0.6 m in front of the door, facing the way the building faces, the camera as it was.
  - One path: no 9 s fallback (after 2 s at the door the floor is painted at once), no room shown on its own (a door
    needs a building; Marigold's two signs lead into the building they stand by), no "Shops and houses: Counter", no
    `seamlessRooms` switch, the `roomDim` setting is a constant (ROOM_DIM 0.68).
  - Tests: the full test's room step (doorway within 0.1 m, nothing of the room outside it, exact exit and camera,
    the town's walking grid unchanged); v46 (all 92 doors of Copperleaf, Verdigris, Marigold); v31 walks in through a
    house's door; the room fixture (check-fast) walks into the shop; `tools/measure-rooms.py` (new).
- Room open times, headless (software drawing, from tap at the door to the room shown; cold / warm):

  | Door | Before | After |
  |---|---|---|
  | Marigold shop | 9.8-13.1 s / 13-31 ms | 0.9-1.2 s / 28-209 ms |
  | Marigold market hall | 6.1-8.1 s | 0.7-1.4 s |
  | Marigold house_red | 6.2-7.6 s | 0.3-1.6 s |
  | Copperleaf, your room | 4.4-4.8 s | 0.7-1.1 s |
  | Verdigris mansion | 5.3-6.3 s | 1.9-2.7 s |
  | Verdigris townhouse_red | 5.3-6.3 s | 0.3-0.9 s |

  The wait itself ("waited N ms" in the log) went from 2.5-8.8 s to 0.1-1.0 s. Coming out costs about 0.2 s of
  drawing (it was a walking-grid and heights rebuild). The sign_shop row now includes walking to the shop's door.
- Risky or unfinished:
  - The first frames inside still gather the room's things and, the first time, cut tree leaves for any tree picture
    not seen yet (about 0.7 s headless, once); on a phone this should be small. Your phone log's "inside ... (waited
    N ms)" lines are the real numbers.
  - The town's structures (bridges, rails, arches) and far props are rebuilt for the room's view as before (cheap so
    far); bridges or arches crossing a room's rectangle are not hidden by the hole.
  - The near ring is painted from the place's own view while you're in a room; flat props under the room stay painted
    on the place's ground (hidden by the hole).
  - 303 of 342 room footprints cover another building's footprint (from the 08a audit); those buildings are left out
    while you're inside, as before.
- Verified: every commit lint, typecheck, unit tests (72), check:data, check:modules, format:check. Before merging
  main: smoke 15/15, check-fast 11/11, the quick check's room steps (rooms, time and weather and rooms, things to do,
  v31, v46, v47, alpha 0.1's windows) all green. After merging main (phase 20 stage B's walk/ split, props batches
  4-7): smoke 15/15, check-fast 11/11, the full test's room step (in 0.7 s; doorway 0.02 m along from the door), v31
  green (alone; in a run after other steps its 90 s wait for the fountain's water timed out once), **v46 red on main
  too**: "buildings without a plan: bakery, inn, market_hall, library, greenhouse" (props batch 7 made them models
  from the house kit; the step still expects build plans). Not fixed here. The full quick check and the in-game full
  test whole were not run (08b-3 ends the phase with them).
- Questions waiting for the owner:
  - Try rooms on your phone (the Marigold shop, your room, a mansion) and send a debug log.
  - Merge this branch to main, then "start 08b-3" (tasks 9 and 10: room templates and slot sets, home from the save,
    build-interiors.py retired; the Studio edits links and doors; the full quick check, the first picture baseline,
    `phase-08-done`).
- Next session starts with: "start 08b-3".

### Phase 08b-1 - roads as typed links, seam checks, prefetch (recap) - 2026-10-19
Written in 08b-2 from the commits (13e96a7 to 0e5c20c); that session left no entry. Not re-verified beyond what
08b-2's checks cover.
- Changed: one road accessor for the Studio and the tools (PB_DATA.road, setRoadEnd, addRoad; gamedata.py the same);
  roads.json as typed links by map id `{id, name, kind: 'seam' | 'lift', a: {map, exit}, b: {map, exit}}` with a
  schema; the glass lift is a `lift` link; check-data validates the links (facing, widths, at most two exits a side,
  44 m apart, walkable ground at each exit, every exit used once); the Studio errors on a road without both exits or
  with exits that don't face each other; the compass-bearing fallback, the "Seamless world" and 'joined' switches
  deleted; the debug log's 'world' section (map files, views kept, crossings); the quick check's seam walk (the six
  hardest, all 56 with --seams=all) and v43 composing every place's view; the next place's view prepared about 40 m
  before an exit.
- Left: tasks 7-10 (07-08 done in 08b-2).

### Project Story S1 - the story layer - 2026-10-19
Plan approved at the start (S1 of docs/phases/project-story.md). Branch `ccr-f321762c-zuw15s`, from main at d2f9721.
- Changed (one cause per commit):
  - Fix first: check:modules was red on main (an unused import in seamless-world.js since PR #41); regenerated.
  - `game/js/logic/conditions.js`: the condition grammar (flag, !flag, flag = word, beat:, item:, coin:, quest:,
    visits:, visited:, billie:, robot, badges; and/or/not, parentheses), parsed once, never run as code; errors
    with a column and "did you mean"; `storyStateOf(save)`.
  - `game/js/logic/script.js`: the script parser (lines with [expression] and Name:, choice with [if]/[once] options,
    if/elif/else, once, cycle, seq, a command table `SCRIPT_COMMANDS`), the runner on a stage interface (runs in
    Node with a stub), checkpoints and resume paths, skipping, `setStoryFlag`, safe-run saves, start presets.
  - `game/data/story.json` (+ schema, check-data): every story flag and what it means, flag patterns, the story's own
    records, speakers, quests (none yet), presets. Every place the game sets a story flag goes through
    `setStoryFlag` (same keys in the save); a flag story.json lacks is a data warning in the debug log.
  - `game/js/story-stage.js`: the game's stage (lines in the dialogue box, a new choice box in talk.js and
    css/dialogue.css, wait, heal, battle), safe runs (while a script plays, JSON.stringify(saveData) writes the state
    from before it plus `story.resume`; `storyResumeCheck` plays it again on Continue), hold the box 0.6 s to skip.
  - `?story=<preset>`: a test run (nothing saved) at `after-opening` or `before-cass`.
  - Three scripts in the data, next to the old fields, not played by the game on its own: Granny Juniper
    (copperleaf.json people), Blake on the golf course (trainers/chad.json), Curator Nacre (pearlantis.json people,
    with a choice once the Pearl ledger is read). Debug menu > Story scripts plays them.
  - docs/SCRIPTS.md (the format), CHANGELOG.
- Where the phase file was wrong or thin (checked in the code):
  - `saveData.flags` is trainers beaten, not story flags; it stays, read as `beat:<id>`. `saveData.story` is the one
    story-flag object (`storyFlags()` and `loreFlags()` are the same object).
  - Coins aren't items: `coin:gold`, not `item:coin_gold`.
  - `visits:` had nothing behind it (`talk_<id>` is a line index): `story.talks` is reserved for it; S2 counts.
  - No sign or event data type exists; books are lore.json `books`. Scripts live on people and trainers for now.
  - `stage:id >= found` folded into `quest:id >= found`; `badge:n` is `badges >= n`.
  - `walk who x z`: the rival scene walks relative to you, so walk takes free arguments; S2 settles them.
- Found while listing the flags: lore.json unlocks entries with `planKnown`, `metVariants` and `region:*`, which
  nothing sets (those entries never open); `askLongGrass` is set and read nowhere. Juniper today starts her second
  visit on her second line (personTalk counts up before it reads); the script starts on the first.
- Legacy to delete in S2 (deletion-only commits): `intro0`, `storyMovedCheck` / `copperleafNote`, the
  `nw-opening-done` key.
- Risky or unfinished:
  - The game plays no script by itself yet; S2 wires people, trainers and rival scenes to them.
  - walk, face, camera, fade and shot do nothing yet (a debug-log note); go and the openings' other commands stop a
    script with an error.
  - A safe run keeps aside the story, items, coins and trainers beaten; team changes (heal, battle XP) are kept as
    they happen. A battle is a checkpoint, so a save after it keeps the battle's result.
  - `once`/`cycle`/`[once]` without a key are remembered by script and line number: editing lines above one moves it
    (S2's line ids fix that).
  - The choice box is new UI; look at it on your phone (debug menu > Story scripts > person:nacre, after reading the
    Pearl ledger in Pearlantis, or set the flag with the debug console).
- Verified:
  - Every commit: lint, typecheck, unit tests (72 -> 94: conditions, script, story-data, story-scripts), check:data,
    check:modules, format:check. Planted faults: a bad species, place and speaker in story.json each fail check:data.
  - The three scripts play on a stub with today's words (Juniper's first meeting and lines, Blake's intro then the
    battle, Nacre's first meeting and lines); Nacre's choice appears once the ledger is read, its [once] option goes.
  - Headless (lowest graphics): `?story=after-opening` opens in Copperleaf with Blake beaten; Juniper, Nacre (choice
    box, tap an option) and Blake (lines, then his battle starts) play from the stage; a save while Nacre's choice is
    open writes `resume` and the live save keeps none; holding the box skips the rest; a saved `resume` plays again
    from its line. No console errors (only gamedata.js 404, expected when it isn't built). One screenshot of the
    choice box at 390 px.
  - Smoke (`check-quick.py --smoke`) on the final code: 15/15, the opening and Blake's battle as before, debug log
    with no names.
  - Not run: the full quick check, the in-game full test whole, anything on a phone.
- Questions waiting for the owner ("Ask me before"): the line format, from the three scripts (docs/SCRIPTS.md and the
  data). Tag `project-story-s1-done` once you agree.
- Next session starts with: S2, after the format is agreed: every person, trainer and rival scene moved into scripts.
### Phase 06-4 - the last screens, floating sheets, gallery, dead CSS, accessibility, safety - 2026-10-19
Branch `phase-06-4`, based on main as of 2026-10-19 (main and `phase-07-portraits` merged in, both clean).
- Changed:
  - Every sheet floats (one `.scrim .sheet` rule in ui-kit.css; the per-sheet copies are gone). New `menus.css`: the
    Field Guide (84 px rows, sideways filter chips, prose font for notes), Trainer card, friends, Settings, shop and
    dressing room on the tokens.
  - Dialogue portrait drawn at 1.5× (64 → 96 px) in whole device pixels (talk.js). This answers 07's open question
    "how the 64 px portrait fills the 96×96 slot": the new renderer only has to draw a 64 px picture.
  - Battle: the classic corner cards' code removed; what they showed that the plates did not (stat stages, robot
    limb HP, party dots, the low-HP glow) moved onto the plates. Wide screens (owner, 2026-10-19): the message and
    menu cards sit in a right-hand column, clear of the edge, centred top to bottom. Fixes cards off screen on iPad
    and against the right edge on laptops: style.css zooms the dock 1.18 / 1.35 on big screens, and floatTick now
    allows for that zoom.
  - Studio "UI gallery" (studio/gallery.html): every kit component, theme / width (320, 390, wide) / reduced-motion
    switches, built from the game's own CSS and ui-kit.js.
  - Dead CSS: about 840 lines removed (old team cards, Stats tab, old pick card, step intro, old Workshop list, hcard
    family). `tools/unused-css.mjs` lists the rest: 36 older candidates, left on purpose (each needs a look).
  - Accessibility: every control ≥ 40 px or an icon with a 14 px larger tap area; type pills darkened just enough
    for 4.5:1 contrast (`logic/colors.js`, unit-tested on every type colour); arrow keys, Home and End on tab rows.
  - Safety: the friend code is escaped; new full-check step "Safety" puts a hostile name in every player-written
    field and opens 13 screens (fails on a planted fault); new step "Tap targets" measures 9 screens.
- Risky or unfinished:
  - **The 06 plan is not fully met.** Every screen is on the tokens, but the plan also said "one module per screen"
    and "old CSS files deleted when empty". Not done: `ui.js` is still ~3,000 lines (pop-ups, top bar, walk and
    rooms, world map, Team, Guide, Trainer card, the button switch), and ~10,000 of 12,600 CSS lines sit in
    style.css, screens.css, polish.css and v05.css, which override each other in layers.
  - The Walking seam step fails, as it does on untouched main (not from this work).
  - Animations and the wide-screen battle layout are untested on real devices.
- Verified: lint, type-check, 74 unit tests, module check, format, data check, build, after both merges. Smoke and
  the Messages, Team, Safety and Tap-target steps: see the PR. Battle cards measured (low render) at 390×844,
  820×1180, 1180×820, 1440×900 and 1600×1050: both cards fully on screen, right margins 35-48 px in landscape.
- Decisions I made: kept the big-screen zoom (bigger text on big screens) and corrected for it rather than removing
  it; left the 36 unused-CSS candidates for a hand check rather than deleting them blind.
- Questions waiting for the owner: (1) Is splitting ui.js and the four old CSS files part of phase 06 (a session
  06-5, before the tag) or a later phase? Recommendation: 06-5, before phase-06-done. (2) Tag phase-06-done once
  that's settled (tag pushes are refused from here). (3) Delete `codex/playable-ui-graphics-poc` on GitHub.
- Next session starts with: the owner's answer to (1). If 06-5: one commit per screen moved out of ui.js into its own
  module, its CSS moved out of the old files with it, moves only, smoke after each.

### Phase 07 part 1 (in progress) - portrait kit, slicer, portraits.json - 2026-10-19
Branch `phase-07-portraits` (not merged, no PR yet). Plan agreed in chat with the owner; written up in
docs/phases/07-plan.md (decisions, data format, status, next steps).
- Owner's decisions: portraits are 64×64; the face kit is cut from AI-drawn part sheets; the body stays still and the
  head moves freely (sub-pixel and rotating, NOT on the pixel grid: this replaces the phase file's whole-pixel
  motion); everything is placed by data so it can be edited in a Studio "Portraits" section; the old portrait
  system stays until the owner says otherwise.
- Changed:
  - `tools/art-source/portrait-kit/`: the 15 source sheets and `kit.json`; `prototype/`: the prototype renderer and
    test page, reference only (eslint now ignores `tools/art-source/`).
  - `tools/slice-portrait-kit.py`: cuts the sheets into 311 pictures in `game/art/next/portraits/` and seeds or
    merges `game/data/portraits.json` (keeps existing data; `--reset` starts over), written in the Studio's layout.
  - `game/data/portraits.json` (12 heads, 93 parts, 13 eye styles, 2 mouth sets, 7 expressions, motion, palettes,
    4 sample faces), listed in `index.json` after `wardrobe`; `game/data/schema/portraits.schema.json`;
    `PortraitData` and friends in `game/types/game-data.d.ts`.
  - `tools/check-data.mjs`: validates portraits.json and checks every head, part, eye frame, mouth frame and face it
    names exists (tried: removing one picture is reported).
  - Docs: docs/phases/07-plan.md (new), a pointer at the top of 07-portraits.md, an ART-NOTES section.
- Nothing in the game or the Studio uses the portraits yet: the data loads into GAMEDATA.portraits and is unused.
- Risky or unfinished: no renderer, no Studio section, no tests of the portraits themselves yet. The cut art has known
  rough spots (07-plan.md, last section). The source sheets add about 20 MB to the repository.
- Verified: lint, typecheck, unit tests (72 pass), check:data (212 files), format:check. Not run: smoke (a data
  section only; the owner prefers no headless graphics runs).
- Questions waiting for the owner: none now. Later: deleting the old system; how the 64 px portrait fills 06's
  96×96 slot (1×, 2× or a canvas at device pixels).
- Next session starts with: 07-plan.md "What is left", step 1 (the renderer: logic/portrait-layout.js and
  portrait-art.js), then step 2 (the Studio section), then step 3 (tests).
### Phase 20 stage C, session C-1 - Frame settings and allocations (C1, C2) - 2026-10-19
Plan approved at the start with "continue" on my recommendation: C1 and C2 now (no look change), before stage A's A8
numbers and before phase 19, which the phase file puts first. Branch `ccr-ca9ccdfe-oyecc9`, from main at d2f9721.
- Merged with main after stage B (2026-10-19): this session's changes to walk-view-gl.js now sit where stage B moved
  each function: worldCurveDrop and setSpriteUniforms in walk/draw-common.js, walkLightContext in walk/lighting.js,
  the shadow passes in walk/shadows.js, the grass trail and flowers in walk/ground-draw.js, drawSprites in
  walk/sprites.js; beginFrameSettings/endFrameSettings stay in walk-view-gl.js. Same code, moved; checks green.
- Changed (one cause per commit):
  - Main's last merge (#41) left an unused import in seamless-world.js, so `check:modules` failed on main. Regenerated.
  - **C1** Defaults for the four dials the code read with none (the phase file named two): `quality.keepScenes` 3,
    `quality.paintWorker` true, `world.roomDim` 0.68, `world.seamlessRooms` true, each at the code's own fallback.
  - **C1** `FRAME_SETTINGS` (engine/settings.js): `beginFrameSettings()` runs once per walk frame, after the
    environment update and the seamless look. It looks every dial up once (11 groups, 149 keys), and `engineSetting`
    answers from that table while the frame is open, but only if the look and the environment flag are still the ones it
    was filled with, and never while the Studio's defaults switch is on. Unknown keys, other screens and code between
    frames take the full lookup. `drawWalkFrame`'s finally closes it.
  - **C2**, one commit each:
    - Sprite uniforms take a slice's depth and a rising picture's height share as arguments. Before, the shadow passes
      made 6 item copies per building, and the sprite pass made 1 per rising picture.
    - `worldCurveDrop` no longer makes an array (it runs per grid cell and item).
    - Contact-shadow blobs come from a pool. The same sort keeps the same order, ties included.
    - The shadow passes filter into kept lists.
    - The sprite pass's list, its building-fade map and a turned picture's axes are kept between frames.
    - The grass trail buffer and each flower set's colours are kept.
    - New module `game/js/engine/frame-lists.js` (no WebGL): `pooledQuad`, `nearestFirst`, `filterInto`. Its script
      tag is on both pages.
  - Tests: `tools/test/frame-settings.test.mjs` checks every key, fast path against full lookup, with player, look,
    game-data and environment sources and the Studio switch. `tools/test/frame-allocations.test.mjs` checks each C2
    change against the old code, kept in the test. `tools/test/walk-renderer.mjs` loads walk-view-gl.js in Node with a
    stand-in GL that records calls.
- Not done from C1 and C2, and why:
  - **gatherFrameItems item pool:** I'm pushing back on this one. About 20 functions in several modules add fields to
    the items (vol, vox, bld3, cross, layer, wave...) and some splice the list. A pool would carry stale fields from
    the previous frame unless every field is reset, and items of mixed shapes in one pool slow V8 down. The items live
    for one frame, which is the cheap case for V8's young-generation collector. Do it only if your `alloc` numbers
    (stage A) show garbage-collection hitches.
  - Hot derived values in a frame table (curve args, wind, brightness): with FRAME_SETTINGS a dial is a property read,
    so this saves little.
  - `matrix4` writing into a given array, and the reflection's two `Object.assign` calls: about 15 small objects a
    frame in total.
  - The basin key: a few strings a frame, only where there are fountains. Its `toFixed(2)` rounding is the
    behaviour, so comparing by numbers would change it slightly.
  - The light lists in `walkLightContext` and `pickPointLights`: those get rewritten in C5.
- Risky:
  - A dial changed in the middle of a frame is seen next frame. Nothing does that today: the environment changes only
    in `environmentFrame`, before the table fills, and the graphics tests, the Studio and Settings change dials between
    frames. Code that starts doing it must call `beginFrameSettings()` again.
  - The kept lists are only safe while each function runs once per frame and nobody keeps the list (checked:
    `walkLightContext` and `drawSprites` have one caller each, and the shadow drawers don't store what they get).
- Verified: lint, typecheck, unit tests (72 -> 86), check:modules, check:data and format:check after every commit.
  Smoke 15/15 after C1 (248 s) and on the final code (231 s). No headless graphics test was run (as the phase file
  says).
- Questions waiting for the owner:
  - Your phone: does the walk view look and run the same? The diagnostics' long frames and the log's `alloc`, before
    and after (main vs this branch), would show whether C2 helped.
  - Still open from stage A: the A8 numbers, the budgets, the `phase-20a-done` tag.
- Next session starts with: C-2 (C3, the Frame uniform block, behind `quality.frameBlock`; C4, flat items and blades
  grouped by program). Or stage D first, if the A8 numbers say pixels.

### Phase 20 stage B - walk-view-gl.js split into game/js/walk/ (moves only) - 2026-10-19
Plan approved at the start (the file list was the "Ask me before"). Branch `ccr-9b6f14fb-6t1w6i`.
- Changed (12 move commits, leaves first as in the phase file's B2, plus one tool fix and this docs commit):
  - walk-view-gl.js 8,196 -> 570 lines (the canvas, mounting a place, the context restore, the walk view's overrides,
    drawWalkFrame and drawWalkFrameInner). 23 new files in game/js/walk/, in page order before it: walk-state,
    heights, walk-shaders, draw-common, water-data, ground-textures, grass-build, ground-mesh (918 lines, the largest),
    map-cache, quality-cull, sky, rooms, water, prop-look, frame-items, sprites, camera, lighting, shadows,
    ground-draw, fountains-weather, effects, input. Script tags in game/index.html and studio/index.html.
  - Each statement moved byte for byte with the comments before it (a scratch script cut them out; npm run modules
    wrote the imports, exports and setters). Proof, after every commit: the top-level statements of walk-view-gl.js
    and game/js/walk/ together are the same 186 statements and 233 comments as before, plus one banner per new file.
  - hooks.js 234 -> 238 names, each a call at run time into code that loads later: groundOcclusionTexture (ground
    textures -> near ring), freeNearRing (ground mesh -> near ring, the one the phase file named), setPropLookUniforms
    (rooms, water -> prop looks), propBaseHeight (into frame items). No load-time read crosses a file.
  - vite.config.js removes the emptied game/js/walk folder after bundling (like game/js/engine); tools/rename-ids.mjs
    points at FLOWER_SET_BY_LOCATION in walk/ground-draw.js.
  - Tool fix (own commit): to-module writes the no-func-assign comment round expose() only where an entry assigns a
    function itself; effects.js (one function with a setter) got an unused one and a lint warning. No other
    generated file changed.
  - Docs and comments that named walk-view-gl.js for code that moved: README's file guide, ART-NOTES (wall colours,
    the town rise), NAMING (walkRenderer), and comments in seamless-world.js, walk-view.js, build-flags.py.
- Risky: nothing should behave differently; the risk is a module order problem that only shows on a page or a path
  the checks don't open. The game, the Studio and the build all load.
- Verified, after every move commit: lint, typecheck, 72 unit tests, check:data, check:modules, format:check, no new
  duplicate top-level name (the 18 game/Studio pairs from before stay), smoke 15/15. Build after commits 1 and 12
  (no walk folder left in dist). At the end: check-studio-github.py (21 sections, the proposal goes through); the
  smoke run's debug log has the same sections and fields, every timed pass (models, box faces, structures included)
  and the same 104 entries in its error list.
- Not done: no line was reformatted (long lines stay; CLAUDE.md wants that in its own no-op commit).
- Questions waiting for the owner: on your phone, the game should look and run as before (a Graphics test step off by
  more than its noise would mean something went wrong). Tags `phase-20a-done` / `phase-20b-done`?
- Next session starts with: stage C (CPU per frame: frame settings, allocations, one uniform block, flat items and
  blades grouped, light picking) in Plan Mode; or D first if you'd rather go at the pixels, given the 60 fps aim.

### Phase 20 stage A - Measure (GPU counters) - 2026-10-19
Plan approved at the start (Stage A only: phase 19 is not done, and the phase file lets only Stage A run early).
Branch `ccr-9b6f14fb-6t1w6i`, from main at 09ae2ba. The phase file is now docs/phases/20-renderer-batching.md.
- Changed (one cause per commit):
  - **Fix (A6):** the diagnostics' and the Graphics test's pass timers skipped drawPropModels, drawBoxFaces and
    drawStructures. Cause: tools/to-module.mjs fills the debug log's GAME object only from debug-log.js's own lists, and
    self-test.js's DIAGNOSTICS_PASSES is not one. They are in debug-log.js's renderer list now (so they also get a
    per-second time in `prof`). A Node test fails if a pass named there is missing from GAME.
  - `game/js/engine/gpu-counters.js` (A1): own-property wrappers on the context for the draws (instances counted),
    useProgram (real switches only), bindTexture, bindVertexArray, every uniform setter, texImage2D/texSubImage2D and
    bufferData/bufferSubData (bytes). Off puts each method back exactly as it was (a test's own wrapper included).
  - Passes (A2): a gpuPass() mark before each pass of drawWalkFrameInner, and inside shadowPass (far, near) and
    lampShadowMaps (lamp0, lamp1). Screens other than the walk view (world map, battle stage canvas) count as `other`.
  - When (A3): the frame scheduler counts one tick a second, every tick while a test measures; on and off in the same
    tick, so the full test's light lab (which wraps the draws itself, from async code) never meets them half-way.
    A counted tick that drew nothing is not kept.
  - Log fields (A4, A5, A7): `dc`, `dcp`, `up`, `lit`, `pcl`, `alloc` in each second's sample (docs/TESTING.md says
    what each holds). `pcl` counts from a second after a walk scene is ready; opening a place, or the world map for
    the first time, resets the "settled" flag.
  - Tests: the diagnostics' frame budget line and every Graphics test step carry draws, instances, program switches
    and draws per pass; a Draws column in both graphics tests' tables.
- Where the phase file was wrong (checked in the code): the commit it names (3ac5b5b) is not in this repository and its
  lines are off by about 2; A6's cause (above); there are two graphics tests (the bench and the older per-dial one);
  the battle has no separate mount, so `pcl` is not reset at battle start (a battle compiling a program counts, which
  is what H5 wants to see).
- First number (headless, so the count only, not the speed): Marigold in the smoke run makes about **2,250 draws a
  frame** (sprites ~1,260, far sun shadow ~450, effects ~330, models ~90, reflection ~48, buildings ~45), not the
  phase file's "about 400". Draw counts don't depend on the resolution, but the smoke run's settings differ from the
  game's own values; your phone's log will say.
- Risky or unfinished:
  - While a test measures, every frame is counted, which adds some processor time to each (every step alike).
  - `alloc` is Chrome-only and coarse (Chrome rounds and delays the heap figure); the iPad has none.
  - `pcl` counts since the page loaded; the per-dial graphics test's shader check adds to it.
  - A8 is yours: the baseline on the iPad and the Android phone.
- Verified: every commit lint, typecheck, unit tests (65 -> 72), check:data, check:modules, format:check; smoke at the
  end 15/15 green; its exported phone log has `dc`/`dcp`/`up`/`lit` in 69 of 85 samples and the same 104 entries in
  its error list as before (all phase 16 "is in legacy" warnings). No headless graphics test was run.
- **A8 baseline, iPad** (Graphics test, 2026-10-19 04:47, Chrome on iPadOS 26.7, Apple GPU, 1366x886 at DPR 2,
  60 Hz, no GPU timers; 116 steps, no errors). The station's untouched look, per frame:

  | Station | fps | CPU ms | Draws | Shadow + lamp draws | Biggest passes |
  |---|---|---|---|---|---|
  | Control pad | 51.5 | 4.2 | 471 | 215 | far sun 173, effects 86, models 44, sprites 43 |
  | Shadow court | 46 | 5.0 | 633 | 270 | far sun 236, effects 106, sprites 85 |
  | Pond | 50.5 | 3.5 | 429 | 136 | far sun 96, sprites 91, effects 82, reflection 47 |
  | Sun gap | 42 | 6.0 | 955 | 343 | sprites 360, far sun 195, near sun 148, effects 96 |
  | Lamp square (night) | 37.5 | 5.4 | 789 | 410 | far sun 235, sprites 116, effects 114, near 105, lamps 70 |
  | Meadow | 50.5 | 3.5 | 436 | 160 | sprites 116, far sun 96, effects 70 |
  | Depth corridor | 45 | 4.8 | 699 | 343 | far sun 233, sprites 143, near sun 110, effects 100 |
  | Open sky | 51 | 3.9 | 500 | 171 | sprites 165, far sun 108, effects 88 |
  | Everything: own values / lowest / highest | 40 / 60 / 39.5 | 6.1 / 5.4 / 6.7 | 1006 / 733 / 1039 | 363 / 187 / 363 | sprites 395-428 |

  What it says:
  - The iPad is not held back by draw calls: about 1,000 draws cost 6-7 ms of processor time, and "everything
    lowest" runs 60 fps with 733 draws. Its frames (19-25 ms) wait on the graphics chip. Sharpness 0.4-0.55 holds 60
    fps; 1.0 gives 50.5.
  - The shadow maps are 35-52% of all draws. The far sun map draws 96-236 a frame even though it is meant to be
    cached for what never moves: the swaying props miss the cache (the phase file's claim, confirmed). Stages E11
    (sway in the shader) and F (casters) aim at this.
  - "Effects" makes 70-114 draws at every station: the flat items and blades drawn one by one (C4).
  - The Sun gap's 360 sprite draws are the grove itself (the phase file's claim, confirmed).
  - Same frame rates as the earlier iPad report (38.5 / 57.5 / 37 then; 40 / 60 / 39.5 now), so counting every frame
    during the test costs no visible speed here.
  - One odd step: Film grain at 0.15 cost 3.5 ms where 0.11 cost 0.6 ms; grain is one uniform in the final pass, so
    this is probably a one-off hitch in that 3 s window (its worst fps was 39). Watch for it on the next run.
  - The headless smoke run's 2,250 draws were Marigold, a full town; the bench places are smaller. A real town by
    night (Copperleaf) is still to be measured on the devices.
- **A8 baseline, Android phone** (Graphics test 05:04 and diagnostics 05:05, 2026-10-19; Adreno 750, Opera on
  Chromium 152, 411x727 at DPR 3.5, 60 Hz, no GPU timers; 116 steps, no errors; diagnostics passed).

  | Station | fps | frame ms | CPU ms | Draws | Shadow + lamp draws | Biggest passes |
  |---|---|---|---|---|---|---|
  | Control pad | 52 | 19.2 | 7.5 | 630 | 200 | sprites 232, far sun 158, effects 69 |
  | Shadow court | 47.5 | 21.1 | 8.2 | 470 | 230 | far sun 196, effects 99, sprites 52 |
  | Pond | 53 | 18.9 | 6.5 | 347 | 123 | far sun 83, sprites 78, effects 49, reflection 47 |
  | Sun gap | 32.5 | 30.8 | 13.1 | 883 | 317 | sprites 346, far sun 171, near sun 146, effects 82 |
  | Lamp square (night) | 33.5 | 29.9 | 10.7 | 685 | 378 | far sun 203, effects 113, near 105, sprites 102, lamps 70 |
  | Meadow | 49 | 20.4 | 6.2 | 368 | 145 | sprites 85, far sun 81, near sun 64 |
  | Depth corridor | 42 | 23.8 | 8.7 | 579 | 306 | far sun 196, near sun 110, sprites 103, effects 99 |
  | Open sky | 49 | 20.4 | 6.8 | 383 | 152 | sprites 97, far sun 89, near sun 63 |
  | Everything: own values / lowest / highest | 24 / 60 / 25.5 | 41.7 / 16.7 / 39.2 | 14.9 / 7.3 / 15.7 | 884 / 637 / 905 | 332 / 158 / 332 | sprites 325-371 |

  Diagnostics (automatic quality on, resolution 0.9, level 2): Clovercrest 27 fps (998 props), Thornberry Wood 28,
  the shop 60, Fizzwell 27, Driftwreck Bay 32, Pearlantis 28.5. Frame budget in the busiest town (Clovercrest, at
  05:05, so after dark): 378 draws, 6,163 instances, 41 program switches, 403 texture binds, **4,093 uniform calls**
  a frame (about 11 per draw); processor time in the passes about 4 ms. Clear day 35 fps, **rain 25**, night 29.
  Battle 36.8 fps, one 701 ms hitch (drawing x3, setting up the ground). 79 MB of pictures on the card.

  What it says:
  - The phone waits on its graphics chip almost everywhere: frames of 19-42 ms against 6-15 ms of processor time.
    The same scene with everything lowest runs 60 fps with 637 draws, and at the game's own values 24 fps with 884
    draws: the gap is pixels and effects, not draws. The phase file's order (pixels first, stage D) holds.
  - Draws still cost this phone's processor about twice the iPad's: roughly 1.1-1.5 ms per 100 draws (883 draws ->
    13 ms at the Sun gap). At the Sun gap and the lamp square the processor time (11-13 ms) is close to a 60 fps
    frame, so draws become the limit as soon as the pixel cost comes down.
  - Shadow maps are again 30-55% of all draws; "effects" 47-113; the Sun gap's sprites 346.
  - Uniform calls (~11 per draw) are a CPU cost of their own: C3 (one uniform block) and E (instancing) cut them.
  - Rain costs 10 fps in town; worth a look in stage D (it is not a Graphics test setting).
  - Better than the format 1 Android report on the same chip (own values 15.5 -> 24, lowest 42 -> 60, highest 16.5 ->
    25.5; Sharpness 1.0 at the control pad 29.5 -> 51.5). Not explained by this phase (it changed no drawing); the
    browser differs (Chrome then, Opera now), format 1's settling was flawed, and phases 08a/09 came in between. A
    run in Chrome would separate the browser from the rest.
- Still missing for A8: the debug logs (a walk in Copperleaf at night on each device) and the iPad's diagnostics test.
  Neither blocks the budgets.
- Decided by the owner (A8, 2026-10-19): at most **400 draws a frame on phones** (shadow passes included); **60 fps in
  towns on the Android phone at the game's own values**; next stage **B**. Also in the phase file's "Decided".
  - My caution on 60 fps: towns run 27-28 fps today with automatic quality already lowering things, and the phone
    waits on its graphics chip. Stage D (sky last, mediump, invalidate, phone pixel budget, grove overdraw) is
    unlikely to double the frame rate on its own; expect to also need cheaper effects at the game's own values on
    phones, which changes the look. Each such change is yours to approve on the phone.
- Still to send (not blocking): a debug log from a walk in Copperleaf at night on each device; the iPad's diagnostics.
- Tag: `phase-20a-done` not set (no answer yet).
- Next session starts with: stage B in Plan Mode, the file list first ("Ask me before"), then the moves one commit
  each, leaves first (phase file B2).

### Phase 08a-3 - UI, text, Studio, running - 2026-10-19
Plan approved at the start (docs/phases/08a-plan.md, section 08a-3, now marked done with the corrections found).
Branch `ccr-72e8ad56-lpn1x3`, from main.
- Changed (24 commits after the merge, this one included; one cause each, renames apart):
  - Base: 08a-2 (`ccr-24f4b29c-s6oe4h`) was never merged to main. Merged into this branch; conflicts in HANDOFF (both
    sides kept) and settings-screen.js (main's gameData import, 08a-2's metresToKm).
  - Dead CSS deleted (.brackets, .brk-l, .wh-steps, .jobs/.job/.jt, .tm-jobs, .job-spr, .job-ic; .today/.mid/.se kept),
    `uiState.disp.steps`, three i18n rows.
  - Text without steps, one commit per group: the tagline ("A classic RPG", page, manifest, title), load tips, four
    folk lines, the not-enough-money toasts ("Win a few battles first"), the place card, walk note, starter egg
    ("hatches after 2 km of walking outdoors"), How to play, the airship sheet, Hazel's parting line (same in both
    openings), room and town chat (and the generators' copies), lore as coins (world entry "Money down here", Route 1,
    Verdigris, Mirrormere, airships, "The Coin Standard", loading lines, a chat line). Renames: lore world id
    steps -> money, book steps -> coin_standard (and the library shelf). Physical steps (stairs, canyon) stay.
  - Studio: **fix**, the Jobs section threw on opening (`rules.jobs.stepsPerPay`, gone since 08a-2; confirmed by
    putting the old line back); Rest stop price moved to the Battle card; "Step sway" -> "Walk bob" (key `sway`
    stays); the "road has no step count" warning removed; Find's example; STUDIO.md.
  - Debug log header, README and the graphics test's note: the log holds no save data, names or positions, only which
    places opened and when (it does log scene mounts and guide trips, so "no movement history" would be wrong).
  - Run: past the joystick's rim (56 px) into an outer ring (84 px, gold while running), the D-pad's centre held by a
    second finger, or Shift. Settings > Moving about > "Always run" (off by default; a full push, the keys and
    tap-to-walk run). Speeds: light push x0.6, full push 3.4 m/s, run x1.7 (`RUN_FACTOR`); keys and D-pad x1 (were
    x1.3). A load tip and the help say how.
  - The walk cycle, footsteps and camera bob follow the metres walked (`walkView.pl.gait`; ladders included, view
    jumps not): same timings as before at walking speed. Townsfolk keep their clock.
  - Tests: a quick-check step "phase 08: running" (each speed, gait against distance, the ring and the D-pad centre
    from pointer events); the phone step keeps its exported log as validation/quick/phone-debug-log.json.
- Risky or unfinished:
  - The full quick check and the first picture baseline were NOT run (owner's call). The known red full-check steps
    from phase 16 (v35, v38, v39 roster counts) are unchanged, as far as anyone knows.
  - The in-game full test was not run whole headless (smoke runs one step of it: green).
  - The Studio's --studio round trip can't run: start-studio.py is not in the repository (STUDIO.md says so).
    tools/check-studio-github.py (every section, GitHub mode) is the Studio check that works: green.
  - The D-pad's run needs two fingers (direction + centre). If that's awkward on your phone, "Always run" covers it.
  - A full push now walks at 3.4 m/s (it gave 4.4 before): moving feels slower until you use the ring.
  - trainers' blockTitle/blockText kept, shown nowhere (phase 15 decides).
  - Your phone and cloud saves start over (save format 3, from 08a-2).
- Verified:
  - Every commit: lint, typecheck, unit tests (65), check:data, check:modules, format:check.
  - Smoke after the merge, after the text batch and on the final commit: 15/15 green.
  - The running step: full push 3.48 m/s; light push 0.59x, ring 1.71x, keys 1.00x, Shift 1.71x, Always run 1.71x;
    gait grows with distance; the ring and D-pad centre set and clear the run.
  - check-studio-github.py: 21 sections open with no errors, the proposal goes through.
  - Debug log, start of session vs final (headless phone flow): same sections, state fields and event kinds, the same
    104 entries in its error list (all phase 16 "is in legacy; X stands in" warnings).
- Questions waiting for the owner:
  - Should 08a-2's branch and this one go to main now (one PR from this branch carries both)?
  - On your phone: try the run ring and "Always run", and send a debug log.
  - Tags `phase-04-done` and `phase-05-done` still need pushing from your machine.
- Next session starts with: "start 08b" (docs/phases/08a-plan.md, Part B), after this branch is merged; the full quick
  check and a picture baseline first, since none exists yet.

### Phase 09 batches 6 and 7 - Marigold, parts 2 and 3: the rest of the town - 2026-10-19
Owner's request: do the remaining props of Marigold, in the clinic and market's style. Keep the old pine trees.
- Changed (tools/build-props-batch6.py and batch7.py; run batch1 to 7 in order; showcase rows on
  `test_props_marigold`):
  - Nature: bush_box (a clipped ball), bush_hawthorn_autumn (the hawthorn model with autumn leaves), dry_grass,
    pebbles and puddle (flat, only the scale). The three pines stay as drawn, by request.
  - Made: clock_tower (brick, quoins, a clock stage with four faces, an open belfry with a bell, a verdigris spire and
    vane; it now has a 2.3 x 2.3 m footprint with its front at its base point, where the game draws its moving hands),
    fountain, solar_canopy, solar_tree, vertical_garden, streetlamp and streetlamp_b (globe lamps under verdigris hoods
    with solar cells), bin (now a three-bin recycling station under a solar roof), flag_pole (the town's flag kept),
    bike_rack (two modelled bikes), sign_shop (a twin of the clinic's sign).
  - Buildings, from one kit of parts (class House in batch 7): the five houses, both townhouses, bakery, shop, inn,
    library and greenhouse. Plinth, walls with corner posts, floor bands, hip / gable / front-gable roofs with a
    wall-coloured gable, square windows with crossed frames, sills, shutters and flower boxes, roof windows under
    hoods, round plank doors and panelled doors under canopies, lamps, chimneys with smoke, copper gutters. Shop,
    bakery, library and inn have their name in the chunky lettering. Each keeps its town colour looks (the old
    variants' wall, roof and trim colours, as colour swaps).
  - Engine (two separate commits): a modelled clock tower keeps its moving hands; a placement's roof style (moss,
    solar, chrome) now also restyles a modelled building's roof parts (layers marked roof: 1).
  - Data (separate commit): a double street lamp in Palmhaven moved 0.2 m off the new shop's window
    (tools/clear-windows.py --fix).
- Risky: these are the most used buildings in the game (house_cottage 46 placements, house_red 27, the townhouses 39,
  shops 12, inns 10); door positions moved a little with the new fronts. Check towns on your phone, at night too
  (window glows and smoke were placed anew).
- Verified: data check, lint, unit tests, smoke check (after the lamp move, the windows step again); a few
  low-resolution looks at the showcase and at Marigold.
- Marigold is now all in the new style except the pines.

### Phase 09 batch 5 - Marigold, part 1: the clinic and the market, redesigned - 2026-10-19
Owner's request: begin Marigold; rework the clinic and the market to be more Unova (Pokémon gen 5) inspired, keeping
the retro-futuristic solarpunk vibe. Original designs: no emblem, sign or shape copied.
- Changed (tools/build-props-batch5.py; run batch1 to 5 in order; its own showcase map `test_props_marigold`, since
  `test_props_next` is full):
  - clinic: the same in every town, so it is known at a glance (its old per-town colour looks are dropped). A rounded
    white two-storey block under a thick coral eave with mint lines; a glass lobby with sliding doors under a solar
    canopy on brass posts with globe lamps; a coral name band reading CLINIC; a ribbon window with flower boxes;
    portholes; a roof garden with a glass dome on brass ribs, solar panels and a little turning wind turbine; the
    emblem (a mint plus on white in a copper ring) standing over the door. Footprint 4.6 x 2.6 m (was 4 x 2.6).
  - sign_clinic: the emblem hanging from a brass post, a globe lamp on top, a planter at its foot.
  - market_hall: a brick arcade with stone quoins and cornice, three arches with iron fanlights and produce counters,
    globe lamps and hanging baskets, a verdigris barrel vault with iron ribs and a solar-glass ridge, a weathervane,
    a clock pediment and a MARKET board. Its four town looks are now colour swaps of the model (variants).
  - stall, market_cart, bread_rack: a striped tent awning with scallops over crates of fruit, a chalkboard and a scale;
    a rounded cream-and-verdigris cart on spoked wheels under a striped parasol with a solar cell; a bread rack.
  - Lettering (CLINIC, MARKET) is drawn in a chunky 7 px capital font made by the script; the globe lamps glow at night.
  - Separate commit: the quick check's in-game full test now waits for the save write-back (up to 12 s) instead of a
    fixed 2.5 s; it failed about one run in three on these branches because the write's timer ran late headless.
- Risky: these props are in many towns and rooms (clinics in 15 towns; stalls and carts in the market rooms). The
  clinic is wider by 0.6 m; check Marigold and Pepperpot on your phone. Interiors are not redesigned.
- Verified: data check, lint, unit tests, smoke check (the full-test step 3 of 3 after the fix); a few low-resolution
  looks at the showcase map.
- Next in Marigold: the houses (one kit of parts for the five types), the other buildings, the made things, nature.

### Phase 09 batch 4 - the last made things of Copperleaf and Route 1 - 2026-10-19
Owner's request: finish the rest of Copperleaf and Route 1.
- Changed (tools/build-props-batch4.py; run batch1, 2, 3, 4 in that order): 18 props modelled and swapped in under
  their own keys, so every placement in every scene draws the new one (they are used well beyond Copperleaf: signposts
  in nearly every scene, fences, planters, benches and barrels in most towns):
  barrel_wood, beehive, bench_wood, birdhouse, dock_post, fence_wood, flowerpot, garden_gnome, picket_fence,
  planter_box, planter_round, rowboat, scarecrow, signpost, waystone, well, wheelbarrow, banner_bunting.
  Only the bunting's pennants are drawn (they flutter); all else is modelled. Fences, benches, planters, signposts,
  the well, the waystone, the boat and the bunting no longer turn or lean at random (vary rot/lean 0).
  - Gable roofs (birdhouse, well) use the hip-roof cone with its top drawn out to a full ridge; no engine change.
  - The showcase map has two new rows (made-small, made-big); the map may be at most 400 tiles deep, so it is full.
- Not changed: the airship and its station were already models; their pictures and effects are at 34 px/m, so they
  keep the scenery's scale. The old voxel recipes in game/art/scene/vox for the nine converted props are no longer
  used; delete them in a separate commit if you agree.
- Risky: fence lengths now have a post at each end and the middle, so two lengths side by side show a double post (as
  the old picture did). The rowboat and dock posts sit on the ground plane; check them on the water in Willowmere,
  Copperleaf and Palmhaven on your phone.
- Verified: data check, lint, type-check, unit tests, smoke check; a few low-resolution looks at the new rows.
- Copperleaf and Route 1 are now all in the new style. Next: the pixel-art and wind plan for 3D props (waiting for
  your go-ahead), or Route 2.

### Phase 09 batch 3 - the buildings of Copperleaf and Route 1 - 2026-10-19
Owner's request: the buildings next, in the art style and setting, learning from the cottage.
- Changed (tools/build-props-batch3.py; run batch1, batch2, batch3 in that order, each rebuilds the showcase map):
  - cottage_moss: a smaller cousin of Juniper's: mossy dome with tufts, thatch edge and copper gutter, a dormer roof
    window, a green round door in a stone surround, a porthole with a flower box, a lamp, a chimney with a copper hat,
    a bench and a water butt round the side, a potted plant, side and back portholes.
  - cottage_solar: pale green board-and-batten walls, a hip roof of solar panels with copper fascia and ridge, a brick
    chimney, a little vertical wind turbine turning on the ridge, a coral round door, a porthole, a window with
    frame, mullions and a flower box, a copper lamp, a vine climbing the corner, a rain barrel under a downpipe.
  - lab (Professor Hazel's): white wall panels with a teal band and trim on a lavender plinth, a checkered roof
    edge, teal double glass doors under a lamp with plants either side, side and back windows; on the roof a cooling
    unit, an antenna with a red beacon, a tipped-up satellite dish, solar panels and planters. The big window keeps
    its drawn view inside (desk, plant, machines) behind a modelled frame.
  - Engine: a cone can be turned (rot) and narrow differently in depth (ry1), so a 4-sided cone is a hip roof with a
    ridge; models can use the building sheet's own materials by name (plaster, siding, brick, battens, panels,
    corrugated, tilewall, rooftiles, shingles, slate, solar). Both in the Studio's model editor.
  - Fix: props with a footprint (box) now have their front at the base point and their body behind it, as the
    building pictures always did, so walls and the footprint people walk round match: Juniper's cottage, the hedge
    and the log were centred and are moved back.
- Verified: data check, lint, type-check, unit tests, smoke check; one low-resolution look at each building.

### Phase 09 batch 2, parts 1 and 2 - Copperleaf and Route 1: flat plants, 14 trees - 2026-10-19
Owner's request: start on the rest of Copperleaf and Route 1 (Hedgerow Lane), the first 10%, then another 10%.
- Changed (tools/build-props-batch2.py, swapped in under their own keys like batch 1):
  - the 54 flat plants of the two places stay flat and move to 32 px/m;
  - trees with the tree tool: rowan, blossom, elm, chestnut, maple, fruit, birch, birch_gold, poplar; the hazel and
    birch_b as shrubs of several stems (a new stems mode: each limb a stem from the ground, no trunk or roots);
    autumn hazel, autumn poplar and autumn beech as their summer tree with the leaves recoloured.
  - Their rows are on the showcase map test_props_next.
- Part 3 (owner: do the rest of the nature now): willow; larch (a new 0-clump mode: the tiered crown stays whole
  on a modelled trunk); the 7 bushes (berry, holly, juniper, bramble, rosemary, hawthorn, rhododendron) as clumps;
  modelled from shapes: the hedge, the fallen tree, the log, the stump, the lichen boulder, the flat rock and the
  stepping stones (still flat and walkable; a flat prop with a model no longer also draws its picture on the ground).
  All the nature in Copperleaf and Hedgerow Lane is now in the new style.
- Left in the two places: 23 man-made props (fences, benches, planters, flowerpots, wheelbarrow, barrel, dock post,
  beehive, signpost, scarecrow, well, birdhouse, gnome, bunting, rowboat, waystone), two cottages and the lab.
- Verified: data check, lint, type-check, unit tests, the smoke check; low-resolution shots of the new rows.

### Phase 09 batch 1 swapped in - 2026-10-19
Owner's go-ahead: replace the finished props in the game.
- Changed: the 24 old props the batch covers now are the new ones, under their own keys (tools/build-props-batch1.py
  swap_in), so all 4,801 placements in 62 scenes draw them without any placement changing: tree_beech; tree_oak,
  tree_oak_b, tree_oak_small, tree_oak_autumn; tree_giant_swing; bush_roses; bush_round, _b, _c; rocks, _b, _c,
  _mossy, _snow; mushroom, _brown, _blue; cottage_juniper; lantern; laundry_line; tallgrass, _b, _c. Each keeps its
  old name, group, tags, the scene builders' fields and its collision radius; its picture stays as the fallback (3D
  models off, far view). The next_* entries are gone; test_props_next is now a showcase of the swapped props.
- Risky: these props now draw at 32 px/m, about 6% bigger than before (tall grass included), until the rest of the
  catalogue moves to 32. Trees cost 10 to 18 sprites each and are now on every route that has them; not measured on a
  phone. The old depth layers of the oaks and round bushes (scene/props/layers/*_lb/_lf.png) are no longer used.
- Verified: data check, lint, type-check, modules, 59 unit tests, check-quick.py --smoke (no problems).

### Phase 09 batch 1, part 2 - natural trunks, editable leaves, the great oak, a Props section - 2026-10-19
Owner's requests: stop the rest of the batch; rework the trees' trunks to look natural; leaves easy to edit in the
Studio; redo the great oak with the swing (Copperleaf); a clear prop part in the Studio with all its tools; no graphic
effects when looking at props.
- Trunks: a `limb` can be a bent line of points (`pts`: [x, y, z, radius] each). The tool traces each trunk and arm
  from the drawing (its lean, curve and taper), bends it a little in depth, flares the foot, adds five roots going into
  the ground, lets the arms grow out of the trunk's narrowing top, and curves the branches up into the clumps.
- Leaves: one picture per tree or bush (game/art/scene/next/leaves/<key>.png, the crown as drawn). Each clump is a
  picture layer with `clip` [x, y, r] (a circle in that picture, cut at run time, outline on its lower rim), the core
  is the same picture with `shade` 0.78. Painting it changes every clump. The autumn oak is one recoloured picture.
- Great oak: next_tree_giant_swing (16 clumps, the knot hole as a picture on the trunk, the swing's branch modelled,
  ropes and seat that swing together: a `spin` may have `swing`, radians to and fro). On the test map's last row.
- Plain look: a scene with `plain: 1` draws without depth of field, bloom, grade, grain, vignette, haze, mist, clouds,
  shafts, weather, time of day or season (engine/settings.js PLAIN_LOOK). The props test map and the Studio's prop
  turntable use it.
- Studio: a Props section (World & places → Props, studio/js/props-editor.js): every prop, searchable, filtered by
  New style / Trees / Bushes & plants / Rocks / Buildings / Lamps & furniture / Flat, with 3D, 32 px/m and looks badges
  and how often each is placed; for the picked prop: its looks (variants) on the turntable one by one, paint a look's
  picture, add a look from another prop, remove one; where it stands (jump to the scene); the full prop editor; the
  model editor with a Leaves part (each leaf picture with its clump circles drawn on it, Paint the leaves, Replace from
  PNG) and per-layer clump circle, darker, shadow, sway and glow fields; the pixel editor.
- Variants: a variant's swapped pictures load with the place (the autumn oak showed late).
- Verified: lint, type-check, modules, format, data check, 32 unit tests; headless shots of the trees and great oak;
  the Studio (GitHub stand-in): the Props list and filter, the Leaves part lists both oak pictures, painting a leaf
  picture marks it changed and bumps its version. Not done: a screenshot of the Props section with the turntable
  running (the software renderer is too slow for it), the smoke check after this part.
- Cottage redone in the airship's manner (owner's request): fully modelled, few polygons, the sheet's materials and
  the airship's palette. Stone footing, plaster walls with honey-wood corner posts and wall plate, a thatch skirt under
  a 16-sided mossy dome, a round plank door (planks stepped to the circle, iron hinges, brass knob), copper-ringed
  portholes with brass crosses (front, both sides, back, two on the roof), a square window with frame, mullions and a
  flower box, a stone chimney with a verdigris hat, a copper stove pipe, a brass weathervane, a door lamp that lights
  with the lamps. Only the shop sign stays a drawing. Its window, lamp and smoke effects are placed for the new model,
  and it no longer carries the old picture's building plan. Checked with one low-resolution shot.
- Cottage, second pass (owner: more polygons, less chunky, more like the fifth-generation Pokémon games, more detail):
  smooth 32-sided dome with moss tufts and flowers, a copper gutter and turned-out thatch lip, thatched dormer hoods
  round the roof windows, slim posts and frames, half-timbered side walls, a stone surround and canopy on brackets
  round the door, eight planks with iron straps, a knocker, verdigris shutters, a stone sill with honey jars, a
  flower bed and stepping stones, a rain barrel under a copper downpipe, a woodpile and Granny Juniper's straw skep.
  About 200 parts. One low-resolution check shot; not measured on a phone.
- Variants count: the 11 new props have 22 looks in all: beech 1, oak 4 (oak, spreading, sapling, autumn), great oak
  1, wild roses 1, round bush 3, rocks 5 (3 shapes, mossy, snowy), mushrooms 3, cottage 1, lantern 1, washing line 1,
  tall grass 3.

### Phase 09 batch 1 - ten props in the new style, test map - 2026-10-18
Owner's choices: trees as a low-poly trunk and branches with flat leaf clumps, in one model; a first batch of ten props
covering every technique, shown on a test map. Started straight from the owner's go-ahead in chat (no Plan Mode step).
- Changed: prop-models.js: a `limb` shape (tapered branch, point to point) and a `dome`; round shapes take `sides`,
  `rings`, `lump`, `facet`; textures `bark` and `rock` (cells 22 and 23 of detail-a04b.png, painted by the tool);
  picture layers take `shadow`, `recv: 0` (no shadow-map lookup, so a crown's clumps don't stripe each other), `sway`
  and `glow` (on with the lamps), the recipe takes `ppm`; picture layers no longer inherit the footprint `box` (it drew
  a cottage's door pushed back inside its walls); a variant can `swap` colours and pictures. walk-view.js: plain prop
  `variants` picked by a placement's `v`. walk-view-gl.js: a prop's own `ppm`; `lampLit` exported; the sprite shader
  skips the shadow map for `noRecv` items. Studio model editor: Limb and Dome, their fields, sides/bands/lumpy/flat
  faces, and a picture layer's shadow/shadows-on-it/sway/glow.
- New: tools/build-props-batch1.py builds everything below from the old pictures, rerunnable: game/art/scene/next
  (leaves, decals, models), the `next_*` catalogue entries in scenery.json and game/data/maps/test_props_next.json.
  Props: next_beech; next_oak (variants: spreading, sapling, autumn = the oak with recoloured leaves); next_bush_roses;
  next_bush_round (3 shapes); next_rocks (3 shapes, mossy, snowy = mossy with a colour swap); next_mushroom (red,
  brown, blue by swap); next_cottage_juniper; next_lantern; next_laundry_line; next_tallgrass (stays flat, 32 px/m,
  3 shapes). The test map has each old prop just left of its new version; debug menu > Test scenes, or
  game/index.html?test=1&scene=test_props_next.
- Risky or unfinished: no route uses the new props yet (swap-in waits for approval). Cottage pictures stand 0.16 m out
  from the wall (a picture's depth is coarser than a model's; nearer, it hides), visible from a steep side angle.
  tools/build-airship.py rewrites detail-a04b.png from detail-a04.png and would drop bark and rock: rerun
  build-props-batch1.py after it. The new cottage keeps the old `door` (interior) and window fx. Trees cost about 10
  sprites each (core + clumps); instancing is still to do. Not measured on a phone.
- Verified: lint, type-check, module check, format check, data check, 32 unit tests, the smoke check (see the PR);
  headless shots of every row by day, the trees turned, the lanterns and cottage at night.
- Correction to my earlier count: 76 recipe files exist in scene/vox, but only 32 props link one (`model`); the
  lantern, stump, beehive, signpost and others on the first routes still draw their picture.
- Questions waiting for the owner: approve the batch (or which props to redo)? Then swap them in on Copperleaf,
  Hedgerow Lane and Tallgrass Meadow, keyed as the old props (so placements keep working) or as next_* with
  placements rewritten?
- Next session starts with: the owner's notes on the batch.
### Phase 13 (part) - The fast check and the in-game graphics test - 2026-10-18
Two parts, plans approved by the owner. Part 1 on branch ccr-5f324dee-5mgqdn (merged as PR #16), Part 2 on top of it.
- Changed:
  - Part 1: `tools/check-fast.py` (`npm run check:fast`), the fast check, only what must never break: the data, the
    world-map graph, a town, a route, a cave and a room open and draw, a save round-trips, a battle plays to the end,
    the game boots with no errors, the Studio loads, and the exported debug log holds no names. `game/js/fixture.js`:
    `?fixture=<name>` (title, town, route, cave, room, battle, stored) starts a ready-made game with its own save key,
    never signed in, with the planted names in FIXTURE_NAMES (trainer "Quillonda", nickname "Zorblax"). The CI push
    job runs check-fast.py instead of the smoke set.
  - Part 2: `game/js/graphics-test.js`, the in-game graphics test. A button in Settings → Help ("Run the graphics
    test", `data-a="gfxtest"`) and one in the debug menu's Performance row. settings-screen.js (`startGraphicsTest`)
    loads it on demand (`import()` of `js/graphics-test.js` against the page's address, so the build leaves it as its
    own file in dist/game/js/) and hands it what it reads, so the module has no imports. Steps, all in Marigold Town:
    the shaders (the same check as check-quick.py's Shaders step, which is unchanged), the game defaults to compare
    with, each of the 144 ENGINE_SPEC dials on its own (through the player's expert dials, which come before a scene's
    look; a number at the top of its range or the bottom if that is its default, on/off flipped, a choice at another
    option, a colour at #FF4080, the light dials at night), Balanced and Beautiful, and the five ENGINE_PRESETS. Each
    step opens the scene from scratch and counts frames for 2 s: frame rate, longest frame, time to open, errors. An
    OK/Problem table and "Save the report" (a .json file: steps, numbers, errors, the graphics chip, screen and cores;
    not the browser, language or time zone). The last row is the planted-name check: the planted names, the trainer's
    name and every nickname in the save; any found is taken out and the row is a Problem.
  - Saving paused and the save put back as in self-test.js; the save copy also brings back the player's graphics
    settings (aim, expert dials), and the scene is made again with them, when the test ends, is stopped or fails.
    selfTest.on is set while it runs, so the story, postcards and the full test stay out of the way.
  - `tools/test/graphics-test.test.mjs` (6 tests): every dial gets a step at a value other than its default, the
    names list, a clean report passes, a planted name is taken out and fails the check, the report's fields.
  - eslint.config.js: a block for graphics-test.js (it is on no page). to-module put ENGINE_*, FIXTURE_NAMES, the
    shader sets, gpuState, compileProgram and attributeClashes through hooks.js for settings-screen.js.
  - Docs: TESTING.md (the graphics test and its rules), CHANGELOG.
- Risky or unfinished:
  - **The graphics test has never run.** As the owner asked, Claude ran it in no browser at all, not even software
    rendering. It must be run on a real device; the first run is the owner's. The likeliest trouble: a scene that
    takes long to open from scratch on a phone (the step limit is 30 s), and the whole run's length (153 steps, about
    3-4 s each: probably 8-10 minutes, not measured).
  - The spec's "Saver" preset doesn't exist: the Graphics tab has Balanced and Beautiful only (Battery saver was
    removed in phase 03). Both are tested; Beautiful is the same look as the game defaults row.
  - Dials a scene doesn't use (water with no water in view, lamp shadows by day) show OK without showing much.
  - The steps read the frame count of the walk view only; the battle stage and the world map aren't in it.
- Verified (what ran, what passed): `npm run lint`, `npm run typecheck`, `npm test` (31 tests), `npm run
  check:modules`, `npm run format:check`, `npm run check:data`, `npm run build` (graphics-test.js in dist/game/js,
  the bundle keeps the import as written), and `python3 tools/check-fast.py`: 11 of 11 passed in 112 s on 2 browsers
  in this container. A planted fault (the name check turned off) fails its unit test; a planted undefined name in
  graphics-test.js fails lint. Part 1, from its session: check-fast takes about 85 s on 2 browsers (1 browser 94.5 s,
  4 browsers 110.8 s), and all 11 planted faults were caught.
- Decisions I made (and why): the dials go through the player's expert dials, because a scene's own look comes
  before the game-wide defaults and would hide some dials. Each dial moves away from its default, so every step
  changes something. Each step opens the scene from scratch, so dials read while a scene is made count. Device
  details are cut to the graphics chip and the screen, because the user agent, language and time zone say more
  about the player than a graphics report needs.
- Questions waiting for the owner: the first run on a phone, and the report it saves.
- Next session starts with: the report from that run; then the rest of phase 13 (13b, 13c).
### Phase 08a-2 - the step mechanics replaced - 2026-10-18
Plan approved at the start (docs/phases/08a-plan.md, section 08a-2, now marked done with the corrections found).
- Changed (21 commits on a331fbb, one cause each; renames apart):
  - Test fix first: merge d991d0b had put `addSteps(2400)` back into check-quick's play() and `prog/hold` into the
    3D-battle trip literal (HANDOFF 08a-1 said both were gone). Restored.
  - Encounters live on each place's map (`saveData.wild` by location id; `rules.encounters`): route 4, town with
    tall grass 2, other towns and rooms 0; full on the first visit, then one more per minute of play time (time a
    place stands full doesn't count). Starter's 3 gentle ones in the start map; legends join the map they appear on.
    Walk card: "Encounters here N/stock". Debug: fill / clear here. `queue`, `meter` gone.
  - Challenges: "Visit 2/3/4 different places today" in the steps challenge's slot (daily picks unchanged). The
    letter goes to the 1st/2nd/3rd nearest town by roads and back (Pearlantis, no roads, asks something else).
    Both run on `arrivedAt(node)` (walkCross, airship, glass lift).
  - Money: a wild win pays level x $20 (`rules.encounters.prizePerLevel`, a toast). Step money, brackets, `day`,
    `seFrac`, rollDay gone; with them the step chips, the Today card's steps and brackets (it shows the money) and
    the trainer card's "Steps today" tile. Debug "Start a new day" gone.
  - Buddy: no walking XP; the buddy gets the full XP of a win even when it sat out (if not fainted).
  - Split at 32: the evolution window offers "Build: <name>" / "Hype: <name>" / "Not yet"; `evolve(m, path)`;
    splitPath, bsteps, psteps gone. Buddy-km evolution kind deleted (no species used it).
  - Jobs removed (Team screen panel, hiring, pay, `saveData.jobs`, `m.job` and every "not at work" check,
    `rules.jobs`, the debug button, the Studio rules card). jobs.json and the Studio's Jobs editor stay for phase 12.
  - Eggs hatch by metres walked outdoors (`addWalked`, `saveData.stats.walked`; not rooms, benches or view jumps):
    2 / 4 / 8 km (eggs.json need in metres); saves every 20 m and opens the hatch window when one is ready. Eggs are
    named from `need` ("4 km egg", was "5 km"). Play time saves itself every minute. Debug: "Walk 1 km".
  - addSteps, the step accumulator, totalSteps and the step debug buttons deleted. Restore / account-merge /
    Settings lines say km walked; the trainer card lost "Total steps" ("Distance walked" is real km now).
  - Data: goldOdds and alphaOdds moved to `rules.encounters`, restCost to `rules.battle` (rename commits);
    `rules.steps` deleted; locations' `cost` deleted (and its writer in build-regions-v47.py). Roads are measured
    at load from the two exits' `len` (game-data.js roadMetres): 56 roads, 82-153 m, 6,560 m in all; roads.json's
    third value is no longer read. The guide routes by metres; road chips, Places list and card say "90 m"/"1.2 km";
    the Studio road table shows the measured length (read-only). `tripTo().steps` renamed `metres`.
  - Save format 3. The migrate lines for step-era fields went with it (a format 2 save is never migrated now).
- Risky or unfinished:
  - **The UI phase (06) is being built at the same time, on its own branch.** This session changed screen code it
    will also touch: ui.js (about 240 lines: walk card and Today card, Encounters section, buddy card, evolution
    window, team screen without the Day jobs panel, trainer card tiles, map card), things-to-do.js (challenges,
    letter), battle.js (prize toast, switch list), bag.js (egg rows), settings-screen.js, world-map-gl.js (Places
    list, road chips), debug-menu.js. Whichever branch merges second must merge, not overwrite: keep 06's structure
    and carry 08a-2's content into it (no steps, "Encounters here N/stock", the Build/Hype buttons, no jobs, km
    walked, "N m" road lengths). 08a-3 (step widgets, CSS, text) touches the same screens, so start it on top of
    06 if 06 lands first, or agree the order with the owner.
  - Your phone and cloud saves start over. A save is kept aside only if no set-aside copy exists yet: a phone that
    kept one at the phase 05 bump does not keep this one (old saves don't matter, CLAUDE.md).
  - The walk card's encounter count updates when the screen redraws; the play-time tick (every 15 s) redraws it
    when the count here changed. The tufts in the scene update every frame.
  - The prize is a toast after the battle, not a line in a sheet (a sheet on every wild win felt heavy). Say if you
    want it in the sheet.
  - Encounters are refilled when read (lazy): a place you never look at doesn't grow. A town's stock reads the
    map's tiles (`_lite.tiles` before its file loads).
  - Left for 08a-3: step text (load tips boot.js:163/169, airship.js:75, NPC lines, "Walk a bit first" toasts,
    Settings "How to play", the welcome's "every step you walk helps it hatch", lore), dead CSS (.wh-steps,
    .brackets, .jobs/.job), the Studio's "Rest stop price" field (it sits in the Encounters card).
  - Known red full-check steps from phase 16 (v35, v38, v39 roster counts; --studio checko0) are unchanged.
- Verified:
  - Every commit: lint, typecheck, unit tests (now 38, new: per-map stock and refill, wild prize, buddy XP, split
    by choice, eggs by metres, every road's length against its exits), check:data, check:modules, format:check.
  - Smoke after each group (1-4, 5-7, 8, 9-10, 11): no problems. The base smoke run overlapped my first edits, so
    only its phone step counts (green).
  - Headless probes: Tallgrass Meadow 4/4, Fizzwell 0 with its note, +1 after a minute of play; a level 12 win pays
    $240; the visit challenge goes 1/2 -> 2/2 on arriving; a letter Marigold -> Copperleaf turns into a reply on
    arrival with its toast; walking 4.32 m outdoors adds 4.32 m, 2.83 m inside a house adds 0; at 2 km the hatch
    window opens ("A 2 km egg is hatching"); the world map says "90 m", Copperleaf -> Marigold "200 m".
  - Full-check steps v36 and v37 (split window, both paths): ok. The other steps this session touched, run together on the final code (693 s): Walking (218 m over two roads), Things to do ("Visit 3 different places today" among the challenges, a ladder, rain in battle), v33 (4 wild Billies in the grass, double and Alpha battles), v43, the terraces, the joystick and edge crossing, Battles (3D stage, a trainer battle won): all ok. v38 and v39/v40 fail as before (they count the old roster, phase 16).
- Questions waiting for the owner:
  - The tags `phase-05-done` and `phase-04-done` still need pushing from your machine (08a-1).
  - On your phone: a new game (format 3), walk a route (encounters fill, a win pays), the debug "Walk 1 km" twice
    for the starter egg, and a debug log.
- Merged in afterwards (owner's request): phase-06-3 (with 06-1, 06-2, 06-2b and phase 17 robots) and
  docs/phase-06-plan. 21 conflicts in 7 files: 06's structure kept, 08a-2's mechanics carried into it (unit cards
  without Day jobs, speciesOf in the split evolution, no job checks, check-quick on per-map encounters). Fast checks
  and smoke green after the merge; headless: walk card "Encounters here 4/4", team screen without Day jobs, the
  evolution window's Build/Hype buttons. Not merged: graphics-bench and props-batch-1 (separate work, still moving).
- Next session starts with: "start 08a-3" (docs/phases/08a-plan.md, section 08a-3), on top of this branch, which
  now holds phase 06 up to 06-3.
### Phase 17 - Robots, prototype (in progress, not tagged) - 2026-10-18
Plan agreed in chat (docs/phases/17-robots.md, rewritten first: robots battle in the same system as Billies, mixed
teams, body HP + breakable parts, moves from parts, torso + legs types, some moves aim, gem levels + part upgrades,
parts healed like HP). Branch `phase-17-robots` (from `phase-17-plan`).
- Changed:
  - Refactor first, no behaviour change: every species read for a team member goes through `speciesOf(m)`
    (`logic/fighters.js`); tests identical.
  - Robots as team members (`kind: 'robot'`, `gem`, `fit`, `partDmg`; `sp` made from the gem and parts, e.g.
    `bot:volt.vane.tesla.auger.striders`, so art and screens can draw one from its sp). Species data worked out from
    the parts (`robotSpeciesFor`), arithmetic in `logic/robot-math.js` (shared with the Studio, like parts.js).
  - Battle: hits land on a part (rules.json robots.hitWeights; aimed moves pick), limbs break, broken arm = no move,
    broken legs = half Speed, gem-type moves x1.2, Self-Repair, Repair Kit, AI aims at the weakest limb and skips
    broken moves. Robots aren't added to the Guide's seen/caught.
  - Screens: `robot-art.js` (rig from part pictures, stand-ins without), stage dims broken parts and sparks on a
    break, HUD limb bars, part picker, Workshop panel + refit sheet (`workshop.js`), robot parts in the details sheet.
  - Studio: Robots section (`studio/js/robots-editor.js`), robot fields in Moves, Items, Trainers; the battle
    preview draws robots (`robotRigParts`).
  - Data: robots.json + schema, rules.json robots, 12 moves, Repair Kit, trainer `tinker`, art in game/art/robots/.
- Risky or unfinished: no in-world way to get robots yet (debug menu only); 3D assembly preview, paint, loadouts,
  crafting, sourcing from chests/trainers, wild robots, the socket standard for the low-poly art: not built. Robots
  as your walking buddy don't show in the world (world-billies.js only knows Billies). Hazel's battle tips say
  "Billies" for robots. The sim bounds are not agreed.
- Verified: lint, typecheck, `npm test` (44 pass: 11 robot tests, 1 sim test), check:data, modules --check, smoke
  (`check-quick.py --smoke`, all 15 steps). A headless phone run: kit, workshop refit, Tinker Rho's mixed battle with
  an aimed move breaking an arm, no console errors. The Studio's Robots and Trainers sections in a headless browser.
  Full sim: robots 48% against Billies of the same level after raising the stat floor 15 -> 38.
- Decisions I made (and why): 6 generic arms (the socket standard says any arm fits any torso, so left and right
  arms needn't differ); torso hits (25%) so parts don't break every other hit; new robots at your strongest member's
  level; free upgrades until the workshop has a place.
- Questions waiting for the owner: the "Ask me before" list in docs/phases/17-robots.md, plus how the first robot
  is found, and the balance bounds.
- Next session starts with: the owner plays the prototype (debug menu -> Give the robot kit, battle Tinker Rho)
  and answers the open questions; then sourcing, the workshop's place, and the art pipeline.

### Phase 08a-1 - tests off the steps mode, the dead steps travel mode deleted - 2026-10-18
Plan approved at the start (docs/phases/08a-plan.md, section 08a-1, now marked done with the corrections found).
- Changed (15 commits on c3b5de9):
  - Smoke was red on the base since phase 16: check-quick named species now in legacy (`ek1` in play(), `knight1`
    in three wild battles). Fixed first, two commits (Versewift, a Bezos line one).
  - Bug fixed: phantom metres. A fresh view put you at its spawn point after movePlayer had saved your old position,
    so every start, Continue, airship landing and debug jump counted 650-940 steps as walked (measured headless).
    That jump is not counted now; a real walk still is (14.1 a metre, until 08a-2).
  - Tests walk instead of paying steps: `cross()` / `cross_to()` in check-quick (a path to just past the exit, the
    player put along it 0.8 m at a time, walkCross after each, unready frames counted). Walking (two roads to
    Willowmere, 218 m), v43 (Marigold -> Tallgrass Meadow, 78 m, never unready), Copperleaf -> Marigold (141 m),
    a041 use it. The in-game full test's Road phase walks the same way in JS and now also fails when the meadow's
    view never shows. play() no longer switches to the steps mode or pays 2,400 steps: it gives the money, four
    encounters, egg progress and buddy XP directly. The whole quick check now runs in walk mode.
  - tools/check-game.py deleted (stale, not in CI). The duplicate a02_ground() call removed.
  - Deleted (deletion only): rules.travel and the Studio select, walkMode/traveling, gateMsg, canLeave, resumeTrip,
    the trip part of addSteps, uiState.arrive and the arrival hurry, the 'road'/'path' walk modes and their hurry
    and teleports, seamlessTripView/seamlessJoinTrip/seamlessPrefetch(+View), the go/hold/blocked trip status and
    bars, the walker icon, the stay/resume/turn-back actions, exitPrompt's steps modal, tripLeft, stepsTo,
    onStepsAdded, the steps-only "prepare the next stop" timer, trip.prog and trip.hold everywhere (save, check,
    type, literals in game, fixture, debug menu, tests), the debug log's tripProgress, four i18n rows, the CSS.
    Kept: trip.node and trip.plan (the gold arrows, "Stop guiding me").
- Visible changes: the place card says "In X" (not "Staying in X"); the walk sheet always shows the "Walk with the
  joystick" note; the trip card's text is unchanged ("Steps still earn money...": 08a-3 rewrites the text).
- Risky or unfinished:
  - No save format change: migrate drops trip.prog/hold from an older save (a unit test checks it). SAVE_VERSION 3
    comes once, in 08a-2.
  - The full quick check has known red steps that are NOT from this phase: v35, v38, v39 (they count the old roster,
    phase 16 moved it to legacy); the Studio round trip (--studio, not run) names checko0, also legacy. They need
    the phase 16 rework.
  - The Walking step now walks 218 m over two roads: 107-116 s alone, 220 s inside the full run (a note against its
    150 s budget, not a failure).
  - Intermittent, seen once each, both passed on re-run: "Things to do: standing on a gold stamp didn't pick it up"
    (full run), and the in-game test step's "written while the test ran: account ['users']" (a friends presence
    write racing the test; smoke). Worth a look if they come back.
  - trainers' blockTitle/blockText are shown nowhere now (they were only shown by the steps mode's blocked card;
    walking shows "X is blocking the way. Beat them first."). Data kept; 08a-3 or phase 15 decides.
  - The roads' step costs (tripTo, the map card's "N steps to go") stay until 08a-2 step 10 (metres).
- Verified:
  - Every commit: lint, typecheck, unit tests (npm test, 32 + one new assertion), check:data, check:modules,
    format:check. check-fast 11/11 and smoke green after each batch (smoke on the base: 2 red, see above).
  - Targeted full-check steps on the final deletion: Walking, Things to do, v43, Copperleaf, airships, a041: all ok.
  - The in-game Road phase headless: Marigold -> Tallgrass Meadow, 1 view change, prepared ahead, never unready.
  - The full quick check ran once on c3bff8f (tests in walk mode, before the deletions): only the problems listed
    above. Not re-run on the final commit (the plan keeps the full run for the end of 08a-3).
  - A debug log built headless at the base and now: same sections and event kinds, same errors (all phase 16
    stand-in warnings); only state.tripProgress is gone.
- Questions waiting for the owner:
  - Tags: `phase-05-done` (0c62318) and `phase-04-done` (12a3b58) recreated locally; my push was refused again
    (the remote hangs up on tag pushes). Please push them from your machine.
  - On your phone: the in-game full test (its Road phase now walks) and a debug log from this build.
- Next session starts with: "start 08a-2" (docs/phases/08a-plan.md, section 08a-2: encounters first).
### Graphics test and the Graphics bench - 2026-10-19
Not a phase; plan approved in chat (5 steps per setting, Expert dials plus five hidden ones, a new place apart from the
Graphics gallery, the frame cap kept and costs read in ms). Spec: docs/graphics-bench.md.
- Changed (7 commits):
  - New place test_graphics (tools/build-test-scenes.py t_graphics): nine stations with a spot each in `bench`.
    build-test-scenes.py has --only=<ids>, which writes just those scenes (the full rebuild is still out of date).
  - New game/js/graphics-test.js: runGraphicsTest, 125 steps (105 setting steps, two untouched looks per station for
    drift, everything lowest and highest). Holds automatic quality off, resolution ×1, time and weather forced, the
    camera on the spot; measures fps, processor ms (debug log) and graphics-chip ms (the diagnostics' pass timers).
    Saves nothing and restores the save (as the full test). Report: pocket-billies-graphics-….json, format 1.
  - self-test.js: report saving moved into shareReportFile (no change in behaviour), used by both reports.
  - Buttons: Settings → Help "Run the graphics test (10 min)", debug menu "Graphics test".
  - tools/check-quick.py graphics_test_ready (in the smoke's in-game test step): never runs or draws the test; builds the
    step list, checks every setting key and station spot from the data, saves a report from made-up numbers and checks
    it holds no name.
- Risky:
  - Not run on any real device yet, and never rendered here (the owner's rule: no headless drawing with graphics on).
    The station spots, camera turns and zooms are untested by eye. The sun gap's "sun ahead" assumes angle -90 points
    the sun along +z, toward where the camera looks; if the rays don't show there, change that station's `sun`.
  - Shadow detail and the near shadow map change without a rebuild; if a change only shows after a rebuild, its curve
    reads flat.
  - Phones without EXT_disjoint_timer_query_webgl2 get processor ms only; the table then says to read the fps.
- Verified: lint, typecheck, check:modules, 32 unit tests, format, check:data, build; smoke 15 of 15 (302 s).
- Next:
  - The owner runs the graphics test on the phone and the PC and sends both reports. Check the stations look right
    (each one's effect is in view) and which settings cost most.
  - If a station is wrong, adjust its spot (`bench` in t_graphics) and rebuild with --only=test_graphics.

### Debug session - the two diagnostics logs of 18 Oct (PC 19:43, phone 19:47) - 2026-10-18
Not a phase; plan approved at the start. Both runs passed with no errors; the phone (Adreno 750) ran Clovercrest at 24 fps.
- Changed (6 commits, each passes lint, typecheck, check:modules, unit tests and format on its own):
  - tools/check-quick.py names current Billies (swift0/swift1) where it named legacy ek1/knight1/kroc0. Smoke had been
    failing since phase 16 ("reading 'line'").
  - Diagnostics format 2 (self-test.js, debug-log.js):
    - A place's fps, worst fps and slow frames count whole seconds from 0.5 s after it opened.
    - The opening hitch is apart: openHitchMs, openHitchCause.
    - The other steps drop their first and last second. The old battle "worst 5 fps" was a partial second.
    - battle and memory also export worstFps and worstFrameMs. Samples carry dt.
  - walk-view-gl.js: stillPropState and propLook rechecked every prop in the same frame every 500 ms. Each prop now
    rechecks on its own half-second beat (propCheckedAt).
    - Measured headless on Clovercrest: 452 props in one frame (+8 ms on this CPU, 3.7 -> 12 ms) became about 15 a frame.
  - propGrid no longer rebuilds every 2 s. It rebuilds on a prop signature change (now every prop) or on itemGen.
    - itemGen now also goes up when the ground's height key changes, so Studio height edits still refresh the props.
  - self-test.js: pauseSaving() before loadAllMaps(), not after. The friends timer could write 'users' while the maps
    loaded (seen once in 4 smoke runs).
  - debug-log.js: new marks "setting up the ground", "building the ground mesh", "working out where you can walk" and
    "reading the picture back"; module glue regenerated.
    - A headless CPU profile put the per-place opening hitch ("outside the marked steps") in swapMapCache ->
      buildGroundMesh, about 0.8-1.2 s in software.
- Risky:
  - propGrid now trusts its signature. A Studio edit that moves terrain under props without changing the height key
    (a bridge edit, say) keeps old cell heights. The cull has 8 m of slack.
  - The 500 ms freshness is unchanged, only spread.
  - Auto quality was not touched. The phone sat at level 4 and 80% resolution because of these spikes; it should settle
    lower on its own, which needs a phone log to confirm.
- Verified: lint, typecheck, check:modules, 32 unit tests and format at every commit; smoke after each code change (the
  full-test step 4 times after the save fix); headless counts and timings of gatherFrameItems before and after; a CPU
  profile of a place opening.
  - The full quick check: 46 of 49 steps passed. The 3 failures are the old roster-count steps (v35, v38, v39/v40 want
    117 species and the data has 24 after phase 16). They come from phase 16, not from this session, and need
    replacing.
  - There is no validation/quick-baseline, so no screenshots were compared.
- Not verified: real-device frame rates (headless draws in software at 1-3 fps).
- Next:
  - The owner re-runs Diagnostics on the phone and the PC and sends both logs. Look at openHitchCause, Clovercrest fps
    and the auto level.
  - If the ground build is the hitch, spread buildGroundMesh over frames (it already has a steps version,
    buildGroundMeshSteps) or prepare it before the door opens (prepareMapGround).
  - If the phone is still slow, the next renderer work is: reuse per-frame item objects, instance static sprites,
    group solid props by mesh. That is a phase of its own.

### Phase 06, session 06-3 - Robots merged, battles on the 3D stage only, UI in the scene - 2026-10-19
Owner's asks: merge what's on GitHub for the bots; remove the painted battle stage (3D in rooms too, wait for the
scene, the classic HUD too); the battle UI lives in the 3D scene and ignores its lighting so it stays readable.
Owner's choices: the portrait inside the dialogue box; moves on the first battle menu; robot builds as slot rows with
a carry meter; battle cards floating in the scene, a calm camera while choosing, readable and thumb-reachable first.
- Merged: `main` (phase 16 rework, 08a-1, PRs #19, #20, #22, #23) and `phase-17-robots` (robot data, engine,
  fighters, workshop, Studio Robots section, sims; it had no PR). Conflicts kept 06-2's screens (no step-by-step
  intro, the shared unit card) and gave robots a place in them: `billyUnit` reads `speciesOf`, knows a robot's weight;
  the Build tab shows a robot's build; the Workshop section stays on the Team screen.
- Changed:
  - **Painted stage removed.** Every battle is on the 3D stage, rooms included. A battle that starts before the scene
    is ready waits behind its wipe and joins it (`battleStageJoin3d`); `walkMapSync` keeps or opens the walk scene for
    a battle, even from the Map tab. Gone: the painted drawing (floor, blur, painted props, clouds, light shafts,
    sprites), its backgrounds (grounds, foregrounds, walls, far land: `game/art/battle/*_ground` etc.), the manifest's
    `battle.areas` and `tools/build-battle-props.py`; the Settings rows "Battles happen" and "Battle panels" and their
    preferences (deleted from old saves); the corner-card HUD (plates always); the in-game test's painted battle.
    Kept: the battle props and clouds (the walking world uses them). A battle stage is now a name, indoors or not and
    its ambient particles (`battleStages.json`, the Studio card and preview to match).
  - **Battle UI in the scene** (`floatTick` in battle.js, `css/battle-ui.css`): on the 3D stage the text and the
    menu are cards anchored in the world, a column under the one choosing (its feet, the text, the menu), following
    the camera, which holds still while you choose (`battleStage.calm`). Page elements, so the scene's lighting never
    touches them. The action is framed in a fixed share of the screen above them.
  - **Moves on the first menu**: four type-coloured tiles, then Tax it, Bag, Team, Run; 1-4 pick a move; Back goes
    to the first menu. The checks and the in-game test no longer expect a Fight button.
  - **Dialogue box** (`css/dialogue.css`): the portrait in a 96×96 slot inside the box, a gold name tag, the line in
    the reading font. `talkBox.onType`: a typing hook per character for phase 07's mouths.
  - **Robots**: a Build tab of slot rows (part, type, move, Broken/Damaged) and a weight-against-legs meter; the
    Workshop refit sheet on the new look; the Workshop section as unit rows. **Bag**: a screen title, roomy rows, a
    floating use panel.
- Verified: lint, type-check, modules, format, data, build; unit tests 53/53 (the robot tests and sims included);
  smoke 15/15 (208 s; it was about 200 s with the painted stage); full-check steps Messages and Team pass. Headless:
  a battle in a room (the shop) and one started from the Map tab both run on the 3D stage; the floating cards keep
  clear of the fighters; screens looked at in both themes at 390 px.
- Risky: the full check (not run whole) and the in-game test now play every battle in 3D, so they are slower on the
  test machine. The leftover classic HUD code (`paintBoxes`, `.hcard`) is hidden, not deleted (06-4 cleanup).
  Look on your phone at the floating battle cards while moves play out (the test machine freezes animations).
- Next session starts with: 06-4 (Guide, Trainer card, Settings, shops, dressing room, friends; Studio gallery;
  delete the emptied CSS and the hidden HUD code; accessibility pass; tag `phase-06-done`).

### Phase 06, session 06-2b - The new opening - 2026-10-18
Owner's choices (docs/phases/06-plan.md "The new opening"): Blake comes before you have a starter; Hazel fights him
herself, without a Billie, in battle-screen style, absurdly overpowered, you only watch and tap; then the pick, where
tapping Hazel gives biased hot takes; Blake's battle has no tutorial, only Hazel's meta line and wrong type tips as a
HOT TIP over everything (the move buttons too) until tapped; she comments on lines skipped fast and on instant picks.
Script approved in chat before building.
- Changed:
  - `game/js/logic/hazel.js`: every line of the new opening in one table (`HAZEL`), `hotTake`, `hazelTip` (meta, the
    real matchup flipped, the canned bad tips; at most 4), `speedWatch` (n fast in a row: one comment each, then none),
    `fillLine`. Unit tested (`tools/test/hazel.test.mjs`).
  - Opening (cutscene.js): after "three of them right here", Blake runs in (4b), then Hazel's fight: Blake throws a
    coin, Gildlet pops out (Blake's first Billie: the slug line's first form; any common first form if missing), the
    plates (Prof. Hazel Lv ??? 9,999 HP; Gildlet Lv 4), her four moves, one hit, Gildlet drains to 0, flashes and
    goes. Staged inside the opening rather than the battle engine (which needs a Billie team); it looks like the
    battle screen (the 3D spot, plates, moves, a log to tap). Then the coins and the pick as before; Blake, already
    there, takes the counter with the new lines. `blakeHello` and the talk-first path went with the old intro.
  - Pick: a note on the card; tapping Hazel in the scene (nearer than any starter) shows the next hot take in a bubble
    over her head (three per starter, then annoyed ones).
  - Too fast: a tap that cuts a line short (under 0.7 s), or a fight line tapped away that fast, three times in a row
    → a comment after the line. In Blake's battle a move picked within 1 s of the menu (or of closing her tip), twice in
    a row → a HOT TIP comment (`tutorPicked`, from ui.js `bmove`; `activeBattle.menuT` set in battle.js).
  - Blake's battle: `battleTutor` shows `hazelTip` each turn as a HOT TIP (`#btip.hot`): big, tilted card with a
    wobbling badge over a dimmed screen; blocks everything until tapped. Returning players keep "Skip this battle".
  - Styles: `game/css/opening.css`.
- Verified: lint, type-check, modules, format, data, build; unit tests 41/41; smoke 15/15 (207 s), and the phone flow
  now also checks that Hazel's fight ran and that Blake's battle opens on a HOT TIP (141 s). A headless play-through
  saw every line in order, four hot takes on tapping Hazel, the HOT TIP covering the move buttons, the flipped tip
  ("Fire beats Water") and, with instant scripted picks, "Instant picks. Bold. Reckless. Very Sterling of you."
- Risky: on the test machine scripted clicks are slow (about 2 frames a second), so "instant" picks only fire with
  script clicks there; on a phone they fire as designed. Try tapping through fast on your phone.
- Next session starts with: 06-3 (dialogue box with the portrait slot, battle menus and text, Bag, the robot builder
  shell, removing the painted battle stage and the classic HUD).

### Phase 06, session 06-2 - Team, details and the starter pick - 2026-10-18
Built on 06-1 (PR #24) and the test boot fix (PR #19, cherry-picked). Owner's choices (docs/phases/06-plan.md):
the lead big and the rest as rows; parts as slot rows on an S·M·L dial; weight as a Speed–Attack balance meter; a Build
tab; the card and details shared by Billies and bots; the fallback starter list removed; screens before the new opening.
- Changed:
  - `game/js/unit-card.js` + `game/css/units.css`: one "unit" model (billyUnit now; a botUnit in phase 17) drawn by
    unitHeroHTML (the lead), unitRowHTML (everyone else), unitOpenRowHTML (open spots) and unitBuildHTML (the Build
    tab). Markup in the page (the rig canvases need it), names escaped, tokens only.
  - Team screen: the lead's card, then one roomy row per Billie (sprite, name, level, types, HP); tap for details.
    Day jobs and Storage are unchanged below (jobs go with phase 08).
  - Details sheet: a floating card clear of the edges; tabs Summary · Build · Moves · Evolves (the Stats tab's numbers
    were the same as the Summary's bars, minus "base"). Build: each slot's size on S·M·L (off-size in gold), weight
    and class, the Speed–Attack meter with its percentages, and Prime or how many parts are off.
  - `buildLean` (rules.js, from `partsLean` in logic/parts.js): attack and speed change, lean, parts off, Prime; unit
    tested against the stat factors.
  - The opening's starter pick card redone: arrows either side of the name, position dots, the blurb in the reading
    font, "Strong against / Weak to" as type pills, one gold button (Not yet / Yes on confirm). Same data-a buttons.
  - Removed: the step-by-step intro (stills, Hazel's lines, trainer step, the starter list) and `fallStill`. If the
    opening can't start or breaks, a Try again screen with Export debug log (`uiState.openingFailed`).
  - The step toast no longer repeats the money ("+$" rises from the money chip instead).
- Verified: lint, type-check, modules, format, data, build; unit tests 37/37 (new Build balance test); smoke 15/15
  (203 s; the phone flow plays the opening through the new card). New full-check step "Team" passes (31 s). Screens
  looked at in both themes at 390 px (sent in chat).
- Not cleaned yet: the CSS of the old intro, team cards and Stats tab (`.talk`, `.tr-*`, `.starters`, `.tm-*`,
  `.ms-stats`, `.ms-parts`) is unused now; 06-4 deletes emptied CSS.
- Next session starts with: 06-2b, the new opening (Hazel fights Blake herself, tap Hazel for hot takes during the
  pick, Blake's battle with her bad, obtrusive tips and "too fast" comments).

### Phase 06, session 06-1 - UI foundation and calmer messages - 2026-10-18
Plan: docs/phases/06-plan.md (PR #20). Owner's choices: Lit components, Chakra Petch for long text, an inbox dot for
notices, delete the codex prototype branch, start 06-1 now.
- Changed:
  - **Lit**: `tools/vendor-lit.mjs` bundles the npm package (lit 3.3.3, devDependency) into `game/vendor/lit.js`, a
    classic script that sets `self.PB_LIT` (14 KB minified). Classic, not an import, because tools/to-module.mjs only
    allows imports between the game's own modules; it also keeps `python3 -m http.server` working. `--check` tells
    when it doesn't match the installed version. Ignored by ESLint and Prettier.
  - **Tokens and motion**: `game/css/tokens.css` (space, corners, depth, type sizes, timings; colours stay in v05.css),
    `game/css/motion.css` (the eight motions as `m-*` classes; reduced motion from the phone or `[data-motion=reduced]`
    becomes a short fade). Loaded last; nothing older uses them yet except the bottom bar.
  - **Components** (`game/js/ui-kit.js`): `pb-panel`, `pb-pill`, `pb-button`, `pb-sheet`, `pb-toast`, plus `pbFloat`
    and the inbox dot. Shadow DOM with slots; a `data-a` on a `pb-button` reaches the page's click handler as before.
    Paths differ from the plan's `game/ui/`: new code sits in game/js and game/css so lint, type and module checks
    cover it.
  - **Messages** (`game/js/logic/messages.js`, ui.js): toasts are a `<pb-toast id="toast">` under the top bar,
    2.5 s, tap or swipe up to dismiss; the same text again joins the one showing or waiting ("Saved ×2"). The checks'
    `uiState.toastQ / toastOn / renderOverlay()` still work (plain strings too). `notice()` puts a notice behind a
    dot on the portrait (`data-a="inbox"` opens them in one sheet): the boot's "A new game / A newer save" and the
    Copperleaf Town note (its flag is now set when read). `whenWorldShows()` holds the boot's waiting choices
    (hatch, learn a move, evolve) until the loader, title and opening are gone and the world has shown for 1.2 s.
    Money earned rises as "+$120" from the money chip.
  - **Bottom bar** on the tokens: 8 px padding, 44 px buttons, press .96, tokens for corners, depth and timing.
- Not done, on purpose: the loader tips about real steps are still true (phase 08 Part A hasn't removed steps), so
  they stay for phase 08. The codex branch: saved as `archive/codex-playable-ui-graphics-poc`; deleting branches and
  pushing tags are refused from Claude's sessions, so **delete `codex/playable-ui-graphics-poc` on GitHub** yourself.
- Verified: lint, type-check, module check, format, data check, build (vendor/lit.js ships before the bundle), unit
  tests 36/36 (new `messages.test.mjs`, fault planted once), smoke 15/15 (187 s, unchanged). New full-check step
  "Messages" (24.7 s, not in smoke) passes, and fails with a planted inbox fault. Components checked on a scratch page
  in both themes at 390 px (screenshots sent in chat).
- Risky: headless software rendering freezes the page's animation clock while the 3D town draws, so the checks can't
  see entrance animations finish (the toast reads opacity 0 there); look on your phone. Toasts that announce money
  (for example "+$1,571 steps…") still show alongside the new "+$" float; 06-2 can trim them.
- Questions waiting for the owner: delete the codex branch on GitHub; merge PR #19 (test boot opening) and PR #20 (plan).
- Next session starts with: 06-2 (Billie card, details sheet with parts, sizes, weight and Prime, Team, starter pick).

### Phase 16 prep - Billies rework plan, part kits, test boot - 2026-10-18
- Changed: docs/phases/16 rewritten (7-line roster, parts, sizes, weight, Prime, decisions and open questions);
  placeholder part kits (beasts, birds, fish; 120 parts) sliced by tools/slice-part-kit.py into game/art/next/parts
  from tools/art-source/part-kit; recolour placeholders in game/art/next/placeholders.
- **Test boot (on):** game/js/test-boot.js. While `TEST_BOOT_ON` is true the game skips the title and the opening and
  opens on the starter pick; nothing is read from or written to storage (game-state.js), accounts and friends stay off
  (account.js), the title is skipped (title.js). Turn it off by setting `TEST_BOOT_ON = false`, or open the game with
  `?boot=normal`. The quick check, check-game.py and the art tools open `?boot=normal`, so they test the normal game.
  Nothing was removed.
- Verified: lint, type-check, module check, unit tests (25), format check; a headless boot reaches the starter pick in
  about 10 s with no title, no Firebase, an existing save untouched and no storage writes after picking and saving; a
  reload goes back to the pick; `?boot=normal` reaches the title. The full quick check was not run.
- Next: the phase 16 prototype (parts on wild Billies, Studio support), after the plan is approved.

### Phase 16 prototype, part 1 - parts, roster trim, Studio - 2026-10-18
Owner's choices: wild Billies get their own parts at random sizes; the weight formula as proposed (±20%); Prime about
1 in 12 (M 60%); old lines to a legacy folder; the 4 new lines now with placeholder art; only the starting area's pools.
- Changed: parts on every Billie (rules.js, logic/parts.js, rules.json "parts"); drawn at size by the rig
  (skeleton-rig.js) wherever a Billie shows; a Parts panel and Prime ribbon in a Billie's details; 55 lines to
  game/data/legacy (roster tracker too); swift, kardashian, trump, zuck lines with placeholder sheets and rigs
  (tools/build-rework-placeholders.py); starting-area pools use the 7 lines; legacy species named elsewhere get a
  same-stage stand-in at load; Studio Parts section, Part slot picker, build previews and Check rules.
- Risky: every area past Fizzwell and all trainers still name legacy species, so they show stand-ins (one of the four new
  lines) until redone. Trainers, starters and the rival are Prime, so they are 10% stronger than before. The kit-built
  rigs (Trump, Zuckerberg) are rough; the Studio can fix their sockets.
- Verified: lint, type-check, module and data checks, 32 unit tests (7 new, with a 20,000-roll simulation); headless:
  wild spawns roll builds, a wild battle carries the build to the stage and stats, the details panel shows it, sizes
  draw with the feet on the ground; check-studio-github.py (19 sections, a save proposed, no errors); the Studio's
  Parts section, its live readouts and checks, and the slot picker. The full quick check was not run.
- Next: the starter split by body size, the 7 passives, quirks and Prime moves, a breed function and one abomination.

### Phase 04e - Modernize: TypeScript and the logic boundary - 2026-10-18
Owner's choices (from phase 05): the recommended 04e choices made for you; no full quick check. Plan approved at the start.
- Changed (33 commits on top of phase 05, this entry included):
  - The 22 prepared commits (docs/phases/04e/patches), applied with `git am`, no conflict: TypeScript 7.0.2
    (`npm run typecheck`, JSDoc and game/types/*.d.ts, no compile step), data-files.js, game-data.js, map-files.js and
    game-state.js checked, the type check in CI, dist/ without game/types, tools/move-names.mjs, and the four moves into
    game/js/logic/ (rules.js, saves.js, battle-engine.js; game-state.js 930 -> 172 lines, battle.js 2320 -> 1299).
  - tools/check-logic.mjs (`npm run check:logic`, 7 tests, 0.2 s, in the CI lint job): the logic loads and runs in
    plain Node with a data set of its own.
  - `// @ts-check` on the three logic modules (one commit each). 14 errors, all fixed with JSDoc only: the type imports
    that stayed behind in game-state.js, three optional battle rules the code reads with a fallback (alphaShieldMult,
    alphaPhaseAt, alphaShieldTurns, set by no data), and two casts with their reason.
  - tsconfig.logic.json: the logic checked again with no DOM lib (in `npm run typecheck`, 0.6 s for both). A planted
    document.title and localStorage in rules.js fail there.
  - Deleted: roadsOf() (always returned []); the always-false artCacheVersion branches in ground-paint-worker.js and
    world-map-gl.js; the Studio's hidden "With its neighbours" preview (seamlessHubMap); both names left eslint.config.js's
    OPTIONAL list (only firebase is left).
  - `npm run lint` caches ESLint's results by content (.eslintcache, ignored): 2.4 s warm instead of 7.3 s cold.
  - Docs: README (typecheck, check:logic, game/js/logic/), NAMING.md (a line for game/js/logic/), CHANGELOG.
- Risky or unfinished:
  - The known risks in docs/phases/04e-plan.md still hold: hooks.js's slots are untyped (any), noImplicitAny is off,
    the .d.ts types repeat the JSON schemas (a field added in the Studio needs both), TypeScript 7 is a native binary per
    platform (an optional dependency), and a stored trip plan is only checked for its first hop.
  - The no-DOM check covers the checked files only: util.js, hooks.js and test-globals.js are read, not checked. ESLint's
    no-browser-globals rule for game/js/logic/ still covers the rest.
  - The Studio has no joined-neighbours preview now (it had none in practice since 04d). Bringing it back means loading
    seamless-world.js in the Studio: phase 14.
  - The ESLint cache is safe for this config (it hashes the computed config per file; a planted undefined name was
    still caught warm). If lint ever looks wrong, delete .eslintcache.
- Verified:
  - Every commit: typecheck, lint, check:modules, format:check, build; from the check-logic commit on, check:logic.
    The two intermediate ts-check commits also pass on their own.
  - Smoke 14/14 after each move on its own (0019, 0020, 0021, 0022) and at the end; check-studio-github.py (18
    sections, a change proposed) after the moves and at the end.
  - A planted `newSave().route.plan` in saves.js is refused (TS2339: 'route' does not exist on 'SaveData').
  - A debug log exported headless on `?test=1&scene=marigold` has the same keys and sections (two levels deep) and
    event kinds as at the end of phase 05, with no page errors.
  - Not done: the full quick check (your call), the in-game full test on a phone.
- Decisions I made (and why):
  - I first thought the artCacheVersion branches were a 04d regression to fix by importing the name from hooks.js.
    Wrong: the Studio, the only page that defines it, loads neither file, so deleting them (the prepared plan) was right.
  - The logic-only tsconfig was cheap (one small .d.ts for console), so it went in.
  - Python Playwright here needed the version that matches the preinstalled Chromium (1.56.0); tools/requirements-check.txt
    is unchanged.
- Questions waiting for the owner:
  - Push the tags `phase-05-done` (on 0c62318) and `phase-04-done` (on the commit that adds this entry): my tag push is
    refused again (HTTP 403). Both exist locally only in this container. The tag push also makes the CI picture baseline.
  - Still open: check-studio-github.py in CI? Studio local mode; tags phase-01/02/03-done and legacy-final.
- Next session starts with: on your phone, a new game, the in-game full test and a debug log from this build; then the
  look at the game the roadmap asks for before phase 06, and phase 06 (or 08/13, your call).

### Phase 05 - Internal renaming - 2026-10-18
Owner's choices: phase 05 first, then 04e; "one rename" means one rename rule per commit (one name, one prefix family,
one file, one data key or section); no confirmations, so I made the "Ask me before" calls myself (listed under
Decisions); no full quick check for either phase; 04e starts in a new session from a plan and patches committed here.
- Changed (295 commits; the old -> new list is docs/archive/phase-05-renames.md, the rules docs/NAMING.md):
  - Tools, each with a proof that a rename changed nothing else: tools/rename.mjs (a name, a prefix family, a file or
    a property, across the game, the Studio, the Node and Python tools and the current docs; `verify` compares the
    syntax trees before and after), tools/rename-data.mjs (a data key or section; the proof is at the JSON level),
    tools/rename-strings.py (the code names inside the Python tools' strings and comments), tools/rename-ids.mjs
    (the location ids, with the art named by an id).
  - 44 files: diorama -> walk-view, diorama-gl -> walk-view-gl, scene -> battle-stage, map -> world-map, owmon ->
    world-billies, world -> seamless-world, core -> game-state, data -> game-data, log -> debug-log, selftest ->
    self-test, props3d -> solid-props, vox -> prop-models, engine/core -> engine/webgl, and the Studio's (core ->
    studio-app, scenes -> map-editor, voxedit -> model-editor...).
  - 1,743 code names in 248 rename commits: the cryptic globals (S saveData, U uiState, B activeBattle, GD gameData,
    RM reducedMotion, SC battleStage, DIO walkView, DGL walkRenderer, MAP worldMap, WORLD seamlessWorld, ST
    studioState, NWLOG debugLog, tw, at...), the prefix families (dio, dgl, egl, mgl, mm, ow, wr, bld, p3d, vox,
    sc, ...), and the vocabulary in NAMING.md order.
  - Data: sections route -> locations, links -> roads, backdrops -> battleStages, scenes -> maps; keys place ->
    locationId (maps, rules.start, legends), scene -> mapId (locations), area -> battleStage (locations, trainers),
    vox -> model (the prop catalogue, placed props, and game/art/scene/props.json); lore.places -> lore.locations and
    its unlocks place:<id> -> location:<id>.
  - Save format 2 (its own commit), then saveData.route -> saveData.trip.
  - The location ids match their names: 43 locations and their maps (sundown -> marigold, longgrass ->
    tallgrass_meadow, grotto -> fizzwell...) and one room (int_twofold_market -> int_twinpetal_market), with their
    roads, pools, shops, lore, map files, miniatures, postcards and flags.
  - Lint: ESLint `camelcase`, and tools/check-names.mjs in `npm run lint` (no top-level name of one or two characters
    but $ and $$, no retired name or prefix, kebab-case files).
  - Not renames, each in its own commit: the debug log says when a function it should wrap or time is missing (a
    missed rename used to drop events in silence); the diagnostics' pass timers work again without the test globals
    (broken since 04d: the report's frame budget was empty on a phone; 10 of 13 passes timed); Puffcap Woods and
    Russetwood get their flower colours (the table named them by ids that never existed); four unused Studio names
    and two unused game names deleted, two aliases folded (BORDER_M, PROP_MATERIALS); the old-place-name check reads
    game/js/engine and studio/js too; the colour mood setting's text (shown in the Studio's Engine section) names
    Marigold Town, Thornberry Wood and Stepstone Canyon instead of the legacy "Sundown".
  - Docs: NAMING.md final, the rename table, README (tools), CHANGELOG, and docs/phases/04e-plan.md with its 22
    prepared commits (docs/phases/04e/patches).
- Risky or unfinished:
  - Your saves from earlier 0.1.0 builds don't load (format 2): a new game starts and the old save is kept aside.
  - Ids that leave the game: a friend on an older build sees your presence by the old map id; old `?scene=` links,
    debug logs and Studio exports name places the old way. Reload an open Studio tab before you propose a change
    (an old tab would send the old keys; the data check refuses them).
  - The 43 places with a new id look a little different: the pattern of their ground, their countryside, townsfolk
    and stamps are picked from the id. Accepted (see Decisions); the local baseline pictures were renamed with the
    ids and compared.
  - Not renamed on purpose: generic prop fields (ox, oy, img, fx, box, group, k, s), the properties of in-memory
    state, CSS and DOM ids, Billie line/species/move/item/coin ids, battle stage and pool ids, version-stamped data
    markers, and every format something else reads (Firestore, localStorage, the debug log's keys, URL parameters,
    Studio section ids, art folders). NAMING.md says where each goes.
  - The Python art and scene builders had their strings renamed by tokenizer and pass py_compile, but they were not
    run end to end (they redraw the art).
  - Bundle: 1,618 KB (475 KB gzipped), 84 KB more than 04d raw (longer names) and the same gzipped.
  - Pre-existing, not fixed: in a check run, "walk the world yourself" finds no D-pad when it runs right after the
    postcards step or a failed step (it passes alone).
  - Follow-ups worth doing: rules.legends[].scene and lore.clues[].at.scene are map ids and could be mapId; the
    title picture art/background/sundown.png; tools/build-interiors.py's text 'Inside Twofold Market'; stale battle
    stage and pool ids (shell, esc, clear, food); duplicates unitVector3, hexChannels/hexToRgb, imageLoaded/imageReady;
    the AREAS alias (kept: the Studio's battle preview captures it at load); roadsOf() always returns [] (04e plan).
- Verified:
  - Every rename commit: rename verify ("a pure rename": the syntax trees differ only by the rule), ESLint, Prettier,
    check:modules, check:data, build and py_compile; data commits: rename-data verify (JSON equal but for the key);
    the id commit: rename-ids verify (the old data with the id map applied equals the new data, art only moved).
  - After each batch: smoke 14/14, check-studio-github.py (18 sections, a change proposed), the paint worker check;
    adversarial reviews after each batch found missed references, fixed in follow-up rules.
  - Full quick check: 48/48 at ee0e06f (after the code renames). On the location id commit, all 48 steps ran: 46
    passed; "the road east" failed on three `[...S.seats]` the S rename missed in check-quick.py (fixed, 156c092), and
    the D-pad step after it; both passed when re-run with the fix. Not run end to end after that (your call).
  - At the end: lint, check-names, format, check:modules, check:data and build pass; a debug log exported headless on
    `?test=1&scene=marigold` has the same sections, keys and event kinds as the one from before phase 05, with no
    page errors.
  - Not done: the picture baseline in CI (made when the phase-05-done tag is pushed, or by hand), the in-game full
    test on a phone.
- Decisions I made (and why):
  - road, not route, for a link between locations (pushing back on the phase file): `route` already names the
    route-kind locations and their "Route 2" label, which players read as the area, so it stays for those. `trip`
    for the player's travel along roads.
  - seam for the shared strip between two maps (`border` is a CSS word everywhere).
  - battleStage for the battle stage, BATTLE_STAGES for its data; vox -> model (prop recipes make low-poly meshes;
    `voxel` stays for real voxels and the .vox format, and art/scene/vox/ keeps its name).
  - Location ids from the player-facing names (a town without "Town", other places their own word, or the whole
    name where the word alone is an everyday word or already a game name), and the new look of those places that
    follows from the ids.
  - Save format 2 before the first save-field rename, so old saves are set aside cleanly instead of loading half
    renamed.
  - Kept: the formats listed under Risky, prop fields (04e types or phase 09), roster ids (phases 15-16). The phase
    file asked for prop fields and species/item/line ids in this pass; renaming them now would be done twice.
  - The colour mood text in engine/settings.js (player-facing in the Studio) names the current places: you had asked
    about "Sundown" there in 04d.
  - No full quick check at the end, and 04e in a new session, as you asked.
- Questions waiting for the owner:
  - Push the tag `phase-05-done`: my push was refused (the remote hangs up on tag pushes). It goes on the commit that
    adds this line ("Docs: HANDOFF, phase 05: the tag to push"), the branch head at the end of the session. The tag
    push also makes the CI picture baseline; without it, run the check workflow by hand with "Make the picture
    baseline".
  - Still open from before: check-studio-github.py in CI (about a minute)? Studio local mode (start-studio.py); tags
    phase-01/02/03-done and legacy-final.
- Claims checked (CLAUDE.md asks me to treat figures as claims):
  - gamedata.js is generated (not in git) and 0.7 MB, not ~13 MB: the maps are fetched one file each when needed.
  - "Duplicate global functions silently override each other (camTo, dioTileHalf)": stale. camTo was defined once
    already at the start (scene.js, now battle-stage.js) and dioTileHalf didn't exist; ESLint and the module clash
    check refuse a duplicate.
  - "owmon" is a file (now world-billies.js), not a prefix; the prefixes were ow/owm.
  - The data is a file per map, Billie line, trainer and person and one per other section, not one per entity of
    every kind.
  - No picture baseline existed at the start of the phase; a local one was made (113 pictures) to compare against.
- Next session starts with: 04e (docs/phases/04e-plan.md: `git am docs/phases/04e/patches/*.patch`, then step 2),
  then `phase-04-done`. On your phone first: a new game (your save is set aside), the in-game full test and a debug
  log from this build.

### Phase 04d - Modernize: the window bridge removed - 2026-10-18
Owner's choices: generated hooks instead of forward imports (after the first plan failed, see Decisions); opt-in test
globals; JSDoc + .d.ts for TypeScript; this session is the bridge only, TypeScript and boundaries are 04e, which ends
with `phase-04-done`.
- Changed:
  - Nothing in the game or the Studio reaches a module's names as globals any more. A module imports from EARLIER
    modules directly; what it reads from a LATER module (154 names), or from whichever module the page has (the
    renderer shared with the Studio reading S, GD, RM, MOVES, sfx...; 64), it imports from game/js/hooks.js, a slot
    per name that the declaring module fills with provide(): functions at the top, other values right after their
    declaration (the timing the bridge had). 212 names in all. Page order and script tags are unchanged.
  - Setters for everything one module changes in another (an imported name can't be assigned): core.js setS, setB,
    setRM, setSaveHold, setNoSaving (the test mode); diorama.js and map.js for the 3D versions diorama-gl.js and
    map-gl.js put in place; battle.js and talk.js for extras.js's wraps; core.js setSave and map-gl.js setMglRender
    for the in-game full test; the Studio's swaps (engine source, dglAdapt, dioMount, rigParts, dioData, dioImg,
    artLoad, api, saveAll, toast, render, getP/setP, pedDraw). Each setter also updates hooks.js. Nothing renamed.
  - The Studio's inline shim script (S, U, B, RM, esc, the live data tables) is a module, studio/js/shims.js.
  - The debug log: log.js (classic, runs first) reads GAME.x instead of 25 module names, and NWLOG.hook wraps through
    GAME[name] instead of window[name]. game/js/log-names.js (generated, the last module of the game's page) fills
    GAME with getters and with setters for the ~45 functions the log wraps or times; the tool writes a setter into
    a module's generated part where it has none.
  - game/js/bridge.js is game/js/test-globals.js and puts the modules' names on window only with
    window.PB_TEST_GLOBALS = true (check-quick, check-game, check-studio-github and the art builders set it with an
    init script; their page.evaluate calls are unchanged) or ?globals in the address (the phone console).
  - tools/to-module.mjs: writes hooks.js and log-names.js, refuses a name it can't route without the bridge, and
    checks the load order (nothing a module reads while it loads, directly or through what it calls then, may come
    from a module that hasn't run). It caught a real case: boot.js calls accInit() at load, which reads NW_TEST.
  - ESLint lints every script with only the classic scripts' names as globals: a module name used without an import
    (or by a classic script) is a no-undef error. Planted toast() in tapdebug.js: caught.
- Risky or unfinished:
  - hooks.js holds copies. A module that reassigns a name others read from there must do it in a setter that calls
    provide(); the tool refuses anything else, but code that mutates through another path (eval, Function) is not
    seen (none found).
  - The load-order check is a static safety net (it follows direct calls and callbacks run at once, not functions
    stored in objects).
  - The cycles are not removed, only made explicit: most forward names are X -> ui.js (toast, render, modal,
    closeModal, sceneIdAt) and diorama-gl.js -> the renderer parts. Untangling them fits phase 06 (UI per screen).
  - The overrides keep their two-step shape (diorama-gl.js keeps the 2D function and calls setDioNav with the 3D
    one); a single definition would need renames (phase 05).
  - Bundle: 1,534 KB (476 KB gzipped), 16 KB more than 04c (hooks.js, setters, log-names.js); bundler renames
    (`DIO$1`) in the bundle fell from 4,030 to 941.
  - Opening the console on a phone: names are only there with ?globals now.
- Verified:
  - After each commit: lint, format:check, check:modules, build, smoke 14/14 (120-133 s, base 131 s), and
    check-studio-github.py after the Studio changes (18 sections, an edit proposed).
  - Debug log, headless on ?test=1, against the commit before the change: same sections, state, events and timing
    names; render, dioMount, save, openBattle, mglRender, renderOv and dglGround still wrapped.
  - Without the flag: the title, a walk scene and the Studio load with no errors and no module names on window.
  - Full quick check: NOT run end to end; the owner skipped it. Stopped inside Scenes after 16 steps, all passed.
    The nightly CI run on main covers it once this is merged.
  - In-game diagnostics test without the test globals (headless): not run yet, after the full check.
  - Phone load, emulated (CPU ×4, gzip, 4G 9 Mbit/40 ms), 04c vs 04d: not measured yet, after the full check.
- Decisions I made (and why): the approved plan (real forward imports) failed: an imported module runs before its
  importer, so 120 forward file pairs reorder the whole page (core.js would run before data.js); a chain of imports
  kept the Studio's order but not the game's. Asked again; you chose generated hooks. No main.js entry module (the
  page's module tags share one module map and keep their order). Setters instead of single definitions (no renames
  in a behaviour commit). The test globals keep the generated expose() in each module, off unless asked (a separate
  test-names module would have needed `export` on every top-level declaration). The bridge's file was renamed in its
  own commit.
- Questions waiting for the owner: still open from before: run check-studio-github.py in CI (about a minute)? The
  "Sundown" text in engine/settings.js and the old-name check on engine/ (phase 05)? Studio local mode
  (start-studio.py); tags phase-01/02/03-done and legacy-final.
- Next session starts with: 04e (TypeScript with JSDoc + .d.ts, starting with data and save formats; module
  boundaries for pure logic), then `phase-04-done`. On your phone first: the in-game full test and a debug log from
  this build (and ?globals if you use the console).

### Phase 04c - Modernize: ES modules - 2026-10-17
Owner's choices: conversion tool applied backwards from boot.js in batches; keep a window bridge through 04c; no
minifying.
- Changed:
  - Every game and Studio script is an ES module (74, plus game/js/bridge.js), except the classic ones on purpose:
    version.js (sw.js importScripts it), the art manifests and gamedata.js (generated data), data-files.js (the Node
    tools run it too), data-fallback.js (the synchronous data read), log.js and tapdebug.js (they catch errors before
    the modules run, and still work if a module fails to load on a phone).
  - tools/to-module.mjs (`npm run modules`; `npm run check:modules` in CI) writes the top of each module between the
    to-module markers: imports of what it reads from EARLIER modules of its page(s), `export` on what others import,
    and expose({...}). It imports a name only if every page loading the file loads the same module earlier, and the
    file never assigns it. Imports only point back, so modules run in the page's order, as the scripts did.
  - The window bridge (game/js/bridge.js): every module's top-level names are on window as a getter and a setter of
    the module's own variable. That is how a module reaches a LATER file's names (the cycles), names it assigns (S, B,
    RM, SAVE_HOLD, map-gl.js replacing map.js's functions, diorama-gl.js replacing dioNav/dioStop/dioProj/dioUnproject,
    extras.js wrapping openBattle/endBattle/talkFolk, the Studio's swaps) and names each page defines its own way
    (S, U, B, RM, esc, the Studio's live tables, the battle HUD hooks). The debug log's and the diagnostics' wrappers
    (`window.render = wrapped`) change the module's own variable, so calls inside and between modules are still timed.
    198 game names and 107 Studio names are still reached this way (the bundle renames their module variable, e.g.
    `DIO$1`); everything else is imported (569 import lines).
  - `$`, `$$`, `rnd`, `clamp` moved to game/js/util.js, loaded first by both pages (they were in core.js and the
    Studio's inline stand-ins). Reached through the bridge, `clamp` couldn't be inlined into the ground height code:
    the loader took ~5 s (17%) longer on an emulated phone. Now on par.
  - `npm run build` bundles each page's modules into one file (dist/game/js/game-<hash>.js, 1.5 MB, 470 KB gzipped;
    dist/studio/js/studio-<hash>.js), not minified, with a source map; one file per page so the
    order is the page's. The module sources are left out of dist/. The dev server serves every script as on disk.
  - ESLint lints module scripts as modules and refuses a name a module shares with another script of its page (in a
    module, no-redeclare can't see that). check-quick's duplicate-function check reads module tags and `export`.
  - check-quick v35 no longer counts art/next/tiles (deleted in phase 03; it failed "tiles: 0 variants" on the base).
  - tools/check-studio-github.py: the Studio in GitHub mode against a local stand-in for the API (sign-in, the data
    files, every section, an edit proposed as a pull request). Not in CI yet.
- Risky or unfinished:
  - Opening game/index.html from disk (file://) no longer works at all (modules need a server); before, only battles
    and the map failed. boot.js's file:// hint can't show any more.
  - Old phones: module scripts need Safari 11+ / Chrome 61+; WebGL 2 already needed more.
  - Script errors in a debug log now point into the bundle (line numbers differ from the sources; names are the same,
    sometimes with `$1`). The source map is next to the bundle for desktop devtools.
  - Strict mode: paint.js, world.js and account-config.js weren't strict before (every other file was). No scope
    differences found (all references resolve the same in script and module mode); smoke and the full check passed.
  - A bridge name a module assigns before the defining module has run would throw (strict); none found.
  - Pre-existing, found by testing dist: the old-name check reads game/js/*.js but not engine/; engine/settings.js
    still says "Sundown" in a setting description the Studio's Engine section shows.
- Verified:
  - Base commit, full quick check: 47 of 48 (v35 tiles, fixed above). After each batch: lint, check:modules, smoke
    14/14, a headless boot. Batch 2: Battles, v31, v33, airships, Walking: all pass but "walk the world yourself"
    (the known order-dependent D-pad failure, also on base). Batch 4: Shaders, Scenes, v32, v35, v43, v44, props made
    of shapes, Crowd: all pass. Studio (check-studio-github.py) after batches 3, 4, 5 and on dist: 18 sections, an
    edit proposed, no errors. dist/ with check-quick's smoke: the phone flow and debug log export pass (only the
    old-name note above, from reading the bundle).
  - Debug log: NWLOG.hook wraps `render` and the renderer timers inside modules (checked render.__nwT, dglGround.__nwP).
  - Phone load, emulated (CPU ×4, gzip, 4G 9 Mbit/40 ms), three runs each, before (04b build) → after: scripts done
    1.10 s → 1.13-1.22 s; loader done 28.5/32.9/29.2 s → 29.5/29.1/28.4 s; JS 62 files 751 KB → 10 files 643 KB.
    Slow 4G (1.6 Mbit/150 ms): scripts 5.1 → 4.5-4.9 s. Steady state on the title view: no bridge getter shows.
  - Full quick check on the final code: NOT run end to end; the owner skipped it. It was stopped after 16 steps
    (all passed), inside Scenes. The nightly CI run on main covers it once this is merged.
- Decisions I made (and why): kept the seven classic scripts above (reasons listed); explicit setters for the
  cross-file writes were not needed for 04c (the bridge setter does it) and go to 04d with the other globals; each
  page is bundled alone (a shared chunk could change the run order); helpers moved to util.js only where both copies
  were identical (esc differs: the Studio's turns null into '').
- Questions waiting for the owner: run tools/check-studio-github.py in CI (about a minute)? Fix the "Sundown" text and
  widen the old-name check to engine/ (phase 05)? Still open from before: Pages → GitHub Actions; Studio local mode
  (start-studio.py); tags phase-01/02/03-done and legacy-final.
- Next session starts with: 04d (TypeScript and boundaries). On your phone first: the in-game full test and a debug
  log from this build. 04d's first job is the bridge: replace the 198 bridge names with imports, setters and explicit
  hooks (the debug log's wrappers, the Studio's swaps, map-gl/diorama-gl/extras' overrides), then remove bridge.js
  (the quick check's page.evaluate calls need a test hook in its place).

### Phase 04b - Modernize: data split - 2026-10-17
Owner's choices: layout A, the build makes the start file and Pages deploys it from Actions, lazy maps this session,
delete the one-off scripts.
- Changed:
  - The game data is 257 JSON files in game/data: index.json (the order of everything), a file per map (scenes/, 91),
    Billie line (lines/, 58), trainer (trainers/, 48) and person (people/, 34), one file per other section. Same data,
    same order (checked when splitting). Layout and format in game/js/data-files.js, shared by the build, the game and
    the Studio: one-space JSON, lists of numbers and short values on one line (7.7 MB instead of 11.9 MB).
  - gamedata.js is generated (tools/build-data.mjs, `npm run data`; dev, build and check-quick make it) and not in git.
    Without it (the repository served as it is) js/data-fallback.js reads the files one by one and says so in the log.
  - Lazy maps: gamedata.js has every map except rooms without its ground and props (`_lite` lists what it uses).
    js/scene-files.js fetches data/scenes/<id>.json when needed: the maps two roads round you at start, the rest in the
    background after the loader, two roads ahead wherever you go. dioPrepare waits for a view's maps; the airship and
    the glass lift wait for the destination's; the full test waits for all of them.
  - world.js wrAdj looks only at its own place's seams (it worked out every link's; same result, checked for all 49).
  - Studio on GitHub reads the files (262 requests) and a proposal sends only changed files (deletes removed ones).
  - Bug found and fixed: every Studio save dropped the terrain `_` (the greenhouse floor), because the save strips
    keys starting with `_`. A key that is only `_` is kept now.
  - Schemas (game/data/schema) and tools/check-data.mjs (`npm run check:data`, CI lint job): files listed, layout,
    schemas (Ajv 8.17.1), references, map sizes.
  - Python tools: tools/gamedata.py load()/save() (save goes through tools/write-data.mjs, same format as the Studio);
    every build and fix script ported. Deleted only room-floors-v47, join-places and build-gallery: the other "one-off"
    scripts draw art or are imported by other scripts or check-quick (my count of ~32 in the plan was wrong).
  - .github/workflows/pages.yml deploys dist/ from main.
- Risky or unfinished:
  - Pages: until Settings → Pages → Source is "GitHub Actions", Pages serves the repository: no gamedata.js, so the
    game uses the slow fallback (one request per file, a 404 in the console), and the Pages workflow fails on main.
  - Studio local mode: start-studio.py (not in the repo) still reads and writes the single gamedata.js.
  - Lazy maps change load timing: code that reads a far map's ground synchronously sees a lite map until it loads
    (the world map's miniatures fill in when it does). Rare on a phone; the full quick check has not run on it.
  - build-test-scenes.py is out of date with the data (it would drop the gallery and test_windows scenes).
  - A pre-existing order-dependent failure: "walk the world yourself" fails with "no D-pad when the D-pad is chosen"
    after the earlier desktop steps, on the base commit too; it passes alone.
- Verified: smoke 14/14 after each stage (131-134 s); targeted full steps (Paths, Walking, Time/weather/rooms, Things
  to do, v43, alpha 0.2 terraces and seams, airship, lamps) all pass except the D-pad one above; in-game diagnostics
  test passed (12/12, no errors); Studio GitHub mode against a stand-in for the API (load, propose, delete); fallback
  boots; lint, format, build, check:data clean. Phone load, emulated (CPU ×4, gzip), original → now: data before start
  1006 KB → 191 KB; scripts done 3.0 s → 1.75 s on 4G, 10.6 s → 5.1 s on slow 4G; loader done 52 s → 33 s (slow 4G).
- Decisions I made (and why): rooms stay whole in the start file (laid into a place's view at once); the touched/stale
  rule rebuilds views only when a map was used before its file came (no hitches in the normal case); Python saves go
  through Node so there is one formatter.
- Questions waiting for the owner: switch Pages to GitHub Actions; keep or drop Studio local mode (start-studio.py);
  tags phase-03-done, legacy-final, phase-01-done, phase-02-done still not pushed.
- Next session starts with: 04c (ES modules). Ask the module conversion order first. Run the full quick check and the
  in-game full test on the phone once.

### Phase 04a - Modernize: tooling - 2026-10-16
Phase 04 is split into four sessions (04a tooling, 04b data split, 04c ES modules, 04d TypeScript and boundaries);
`phase-04-done` is tagged after 04d. Started without `phase-03-done` on the owner's go-ahead ("Start 04a").
- Changed:
  - package.json (no version: game/version.js stays the only place), package-lock.json, Node 22+. Tools pinned to
    releases at least two weeks old: Vite 8.3.2, ESLint 10.12.0, Prettier 3.9.9.
  - Vite (vite.config.js): `npm run dev` serves the repo with the classic scripts exactly as on disk (Vite's own
    transform turned gamedata.js into 75 MB with an inline source map); `npm run build` copies index.html, game/ and
    studio/ into dist/ unchanged; `npm run preview` serves it. Nothing is bundled until 04c.
  - Prettier (.prettierrc.json: width 120, single quotes, template strings untouched) over game/ and studio/ JS and
    CSS; game/data, game/art and HTML are left alone. The reformat is its own commit (adb27c9), listed in
    .git-blame-ignore-revs.
  - ESLint (eslint.config.js): each script is linted with the top-level names of the other scripts of its page as
    globals (parsed from index.html's order, inline scripts and window./self. assignments included), so no-undef and
    no-redeclare work across files. Plus the recommended bug rules. It replaces tools/check-globals.py (deleted).
  - Lint findings fixed, each its own no-behaviour-change commit: 16 duplicate keys in props3d.js P3D_AUTO (the later
    'lathe' entries always won; resulting object identical), the dead `STR_SH` shader warm-up entry in diorama-gl.js.
    Two commented exceptions (cleanName's control-character regex, the Studio wrapping pedDraw).
  - CI: new `lint` job on every push and PR (npm ci, lint, format:check, build). The full job's version step used a sed
    that the reformat broke (`self.PB_VERSION = '...'` now has spaces); it now runs version.js in Node.
  - README rewritten for GitHub (play on Pages, npm scripts, Studio, contribute, layout). The Studio's section guide
    moved to docs/STUDIO.md.
- Risky or unfinished:
  - The reformat touched every JS and CSS file (75k lines). Proven no-op: syntax trees identical for all 77 JS files
    (empty statements and a||(b||c) regrouping aside), the CSS minifies the same (whitespace in custom properties and
    calc() aside), smoke pictures differ only by animation timing. The full quick check has not run on it; its
    source-reading steps are in smoke and gave the same results.
  - Open branches made before the reformat (e.g. a Studio "Save to game" PR) touch only data and art, so they merge
    cleanly; any branch that edits game/js or studio/js will conflict everywhere. Re-apply such edits on the new base.
  - `format:check` in CI fails if JS or CSS is pushed unformatted: run `npm run format` first.
  - Leftover hooks ESLint flagged as optional on purpose: dioArtVer (Studio), wrHubScene (game), firebase (CDN).
- Verified: smoke 14/14 before (121 s) and after the reformat and at the end; `npm run lint`, `format:check`,
  `build` clean; dist/ identical to game/ and studio/; the game and the Studio boot headless from `npm run dev` and
  from `npm run preview` with no errors; ESLint catches a planted cross-file duplicate function, a duplicate const, a
  same-file duplicate and a typo.
- Decisions I made (and why): the build is a copy for now (Vite can't bundle classic scripts; hashing the CSS would
  have downloaded the fonts twice next to the preloads). ESLint over check-globals (a parser, not line patterns; the
  line check missed a second declarator on a line). Dead stores, unused variables and error causes are off: noise
  until modules. Markdown and HTML are not formatted.
- Questions waiting for the owner: tag `phase-03-done` (2b1f86f); the phase 04 questions still open: data-split layout
  (A: a file per map, species, trainer and person, one file per small table; or B: a file per entity everywhere),
  Pages from an Actions deploy of dist/ (needs Settings → Pages → Source: GitHub Actions), Studio local mode
  (upload start-studio.py or drop it), module conversion order (backwards from boot.js, or one generated conversion).
- Next session starts with: 04b, the data split, once the layout question is answered. First measure the phone load
  (gzip transfer of gamedata.js on Pages).

### Phase 03 - Fresh base and scope reset - 2026-10-16
- Changed:
  - Legacy: branch `legacy` pushed at 0314a22 (alpha 0.5 + phases 01-02). The tag `legacy-final` (same commit) was
    refused like every tag push from this session: the owner adds it, and attaches a `git archive` zip of it to a release
    if a zip is wanted.
  - Version 0.1.0 alpha in one file, game/version.js (`PB_VERSION`, `PB_VERSION_ID`). Read by the game (title screen
    corner), the Studio (top bar), sw.js (cache `pocketbillies-0.1.0-alpha-*`), the debug log and diagnostics (`build`),
    saves (`gameVersion`; `SAVE_VERSION` stays 1). check-quick step "Version" compares README.md and CHANGELOG.md.
    Scheme: 0.MINOR.PATCH alpha (owner approved).
  - CHANGELOG.md started; the old changelog (2160 lines) is docs/archive/LEGACY-CHANGELOG.md; README is 180 lines.
  - Deleted (each its own commit): pedometer and demo step buttons; Lite mode (Battery saver, every lite branch, the 2D
    walk painter in diorama.js, the Lite clue timer, the 16 px canvas ground, art/next/tiles); the Claude-artifact cloud
    mode and tools/build-artifact.py with check-quick's --page step; the `station` prop and its 4 pictures; dioTileHalf;
    the 19 `*@v45` scenes (1.5 MB) and the Studio's "Open its v45 layout"; the 'Net Worth' backup import; the v36 save
    migration check; tools/retired; the tools/src toolchain (build-art.cjs, runtime.cjs, export.js, vendor/); 16 one-off
    tools nothing imports.
  - New: without WebGL 2 the game shows "This device can't run Pocket Billies" (Try again, Export debug log), at start and
    when the walk view's WebGL fails for good. The Studio says there is no preview.
  - CI: the picture baseline is the release asset `baseline-<version>/quick-baseline.zip`, made on phase-* tags or by hand
    (Run workflow, "Make the picture baseline"); other full runs download it and compare. The full job gets
    `contents: write` for that.
- Not deleted, though the audit listed them (the audit was wrong): background/sundown.png (the Studio's "rebuild the web
  picture" reads it), scene/build/detail-a04.png (tools/build-airship.py's source), the `airship_mast` prop (the mast
  check and build-airship use it), migrate() (fills defaults; not a format converter), lookFromOld (NPC looks).
- Kept on purpose: the picture intro (it is also the cutscene's fallback on abort and reduced motion); `RULES.travel =
  'steps'` and the joystick step pipeline (phase 08); the debug step buttons; tapdebug.js; art/scene/tiles (Studio
  tile editor); map.js's 2D map (only after a lost WebGL context; phase 10 rewrites the map).
- Risky or unfinished:
  - The owner skipped the full quick check for this phase. The partial run passed 16 steps, none failed (phone flow,
    shaders, paths, test scenes, all data checks); "Scenes" and everything after it did not run. No picture baseline
    yet: the first phase-* tag (or Run workflow with "Make the picture baseline") makes it.
  - The 2D painter removal was found by a call-graph script; one name it got wrong (DIO_FX) broke the opening and was
    caught by smoke. The full Scenes/walking steps are the real proof and have not run.
  - Leftovers for later rewrites: `effects` preference field (always 'full'), `.demo-note` and other step CSS, `_dioProj2D`
    fallback in diorama-gl.js, build-tiles.py/build-terrain.py still write art/next/tiles if run.
- Verified: smoke 14/14 after every change (about 110 s), CI smoke green on every push; check-globals 0 duplicates;
  headless probes: version shown on the title, Studio, cache names, log and save; the no-WebGL screen and its debug log
  download.
- Decisions I made (and why): the version also shows on screen (title corner, Studio top bar) so a phone screenshot
  says which build it is; the baseline is a release asset (persists, no repo bloat) rather than an artifact (expires).
- Questions waiting for the owner: add the tags `legacy-final` (0314a22), `phase-01-done`, `phase-02-done`; OK that an
  old account save is replaced once the player plays on (from phase 02)?
- Next session starts with: phase 04. Tag `phase-03-done` on this phase's last commit first (the tag's full run also
  makes the picture baseline); if that run finds problems in Scenes or walking, fix them before phase 04 work.

### Phase 02 - Security - 2026-10-16
- Changed:
  - Firestore rules moved out of the README into firebase/firestore.rules (the only copy) with 13 emulator tests
    (firebase/test/rules.test.mjs; `cd firebase && npm ci && npm test`; CI job `rules` on every push). Friends are found
    by code only: users/ and codes/ can't be listed (the old `allow read` let any signed-in player download everyone's
    page and place), a page is readable by its owner and the friends on the owner's own list, only the receiver accepts
    a request (the old rules let a sender accept their own), writes are checked for shape and size.
  - friends.js: a friend's page that isn't shared back yet is retried every minute (no error); friend pages and request
    names are cleaned before drawing (frClean).
  - Names: cleanName() strips < > " & ` and control characters where names enter (nickname box, cleanLook, migrate), so
    the ~60 templates that put N(m) into HTML unescaped are safe. tools/check-data-text.py (CI) guards game data text.
  - saveVersion (core.js SAVE_VERSION = 1): saves without it are refused with "This save is from an older version of
    the game and can't be loaded in this one", a new game starts, the old save is kept aside in the browser
    (`<key>-set-aside`, `-cloud-set-aside`). A newer save is never written over (SAVE_HOLD). Backups from other versions
    are refused. Account saves carry saveVersion.
  - docs/SECURITY.md: the review (claims, rules, API key, App Check, Studio token options, innerHTML table, phase 18
    data design, one friends bug found).
- Risky or unfinished:
  - The new rules are NOT live until the owner publishes them (Firebase console). The game works with old and new rules.
  - Old account saves are replaced on the account once the player plays on in this version (a copy stays in that
    browser). That is a cloud-data wipe in slow motion: owner to confirm (question below).
  - phase-01-done and phase-02-done tags: this session can't push tags (the push is refused); the owner adds them.
  - Friends: making friends again "the other way round" after a removal fails (pre-existing, not security; SECURITY.md).
- Verified (what ran, what passed):
  - Rules tests: 13/13 on the new rules; 8 of 13 fail on the old README rules (the tests catch what was open).
  - Headless probes on the real page: cleanName/frClean/migrate strip markup and keep apostrophes; no save, an old save,
    a current save and a newer save each start, keep aside, load or hold as intended, with the message showing.
  - check-globals: 0 duplicates. check-data-text: clean. `--smoke`: 13/13 (114 s). Full check: not run for phase 02 (owner: run it once at the end of phase 03).
- Decisions I made (and why): rules live in firebase/ (testable, one copy) and the README points there; names are
  cleaned at the way in rather than escaping 60 templates now (phase 06 replaces the rendering); saveVersion is a save
  FORMAT number (1), not the game version: it should only change when old saves can't be read, which is rarer than
  releases (phase 03 reads it from the version file next to the game version); a newer save is held, never overwritten.
- Questions waiting for the owner: OK that an old account save is replaced once the player plays on (or keep it under
  another document)? Studio sign-in: apply options A (fine-grained token for this repo) and B (session-only by
  default)? Publish the rules and restrict the API key (steps in SECURITY.md)? Tag phase-01-done (8b03829) and
  phase-02-done.
- Next session starts with: phase 03 (first reply: claims, KEEP / REWRITE / DELETE list, version scheme and name).

### Phase 01 - Baseline and bug fixes - 2026-10-16
- Changed:
  - Game: two duplicate globals removed. `camTo` (scene.js) keeps the first copy, the one that honours reduced motion (`RM`); the later copy won before and ignored it, so with Motion = reduced the camera now snaps instead of gliding. `dioTileHalf` (diorama.js) keeps the later copy (`dioTileScale(t,2)`, same result); nothing calls it, so the function goes on the phase 03 delete list.
  - tools/ is in the repo (113 files, unchanged from the alpha 0.5 project zip, scanned for secrets first). New: tools/check-globals.py (duplicate global names across each app's script load order, also run by CI), tools/requirements-check.txt.
  - tools/check-quick.py: the six stale tests fixed, one cause per commit, none was a game bug (v31 settings tabs read from SET_TABS and waiting messages cleared; v32 wear measured with dglLookOf2, the per-frame look cache hid the dial; v42 skips `test: true` scenes such as the Graphics gallery; v46 no longer expects a room for the retired train station; postcards step marks Blake's first battle as played, the pcFree gate; v39/v40 v36 save migration skipped unless --legacy-saves). New `--smoke` (data and code checks, Start-Game on a phone ending with a debug log export, the Studio opening in GitHub mode). Every run ends with the total time and the 10 slowest steps (also `slowest` in results.json).
  - .gitignore; .github/workflows/check.yml: smoke on every push and pull request (incl. the Studio's "Save to game" PRs), the full check nightly, by hand and on `phase-*` tags; validation/quick/ uploaded as an artifact every run; pip and Chromium cached.
- Risky or unfinished:
  - The full check has not run end to end since the fixes (stopped by agreement; each fixed step passed on its own). The first full run is the GitHub one: nightly or by hand works only once the workflow is on main.
  - Picture differences are notes, never failures, until phase 03 makes a baseline on the CI runner. There is no baseline in CI yet, so nothing is compared.
  - start-game.py and start-studio.py are not in the repo, so `--studio` (the Studio round trip) can't run here or in CI; smoke only checks that the Studio opens.
  - tools/ and docs/ are public on the Pages site (the repo root is served).
- Verified (what ran, what passed):
  - Targeted run of the six old failures (`--steps=v31,v32,v39,v42,v46,postcards`): all pass. v31's place card and map camera checks, which never ran in phase 00, pass too.
  - `--smoke`: 13 of 13 steps pass in 111 s here (phone flow 97 s of it). On GitHub the first smoke job passed in 3 min 46 s including setup (before caching).
  - check-globals.py: finds camTo and dioTileHalf on the pre-fix code, none now (a false hit on paint.js's worker source text is skipped).
  - Game and Studio load headless to their title / sign-in screens; the only error is the container's ERR_TUNNEL_CONNECTION_FAILED.
  - Slowest steps (phase 00 full run, owner's zip): Scenes 606 s, v33 226 s, v44 180 s, Phone 135 s, Time/weather/rooms 92 s, v38 92 s, v32 91 s, v47 81 s, Things to do 76 s, v34 74 s. Here: v32 130 s, phone 97 s.
  - Walking camera, Hedgerow Lane -> Sundown: reproduced as a delay, not a failure. S.route.node switches on the crossing; the view stays `w:hedgerow*` for about 80 frames (48 s at about 2 fps in software), then becomes `w:sundown*`. The view is swapped only once the next one is prepared a slice per frame, so phase 00's test most likely gave up first. At 60 fps that is about 1.3 s.
- Decisions I made (and why): CI runs smoke per push, not the 39-minute full check (owner agreed). Pictures out of git and out of LFS: generate the baseline on the CI runner and keep it as an artifact or release asset (renderer-specific; Pages can't serve LFS files). The legacy migration check is skipped, not deleted, so phase 03 owns the deletion. The debug log is exported from the phone page in smoke (how the owner uses it; 134 s -> 111 s).
- Proposals waiting for approval:
  - Repo layout (task 5): tools/ stays in git as normal files; validation/ pictures stay out (CI artifact / release asset `baseline-<version>`); gamedata.js and sundown.png stay in git until the phase 04 data split; no LFS. Later (phase 04, ask first): deploy Pages from an Actions build of game/ and studio/ only, so tools/ and docs/ stop being public.
  - Claude Code hooks (task 6): after an Edit/Write of a .js file run tools/check-globals.py (seconds); at the end of a turn that changed .js or data run `--smoke` (about 2 min). No auto-formatter until phase 04: CLAUDE.md wants reformatting in separate no-op commits.
- Questions waiting for the owner: tag 406ad30 as `phase-00-done` too? Upload start-game.py and start-studio.py for the Studio round trip in CI? Do you see a pause on your phone walking from Hedgerow Lane into Sundown? Approve the two proposals above? Phase order: do the Firestore rules first, then 03, then the rest of 02 (my suggestion), or keep 02 then 03?
- Next session starts with: phase 02 (or 03, see the question above). The phase 03 delete list already has: dioTileHalf, the `station` prop, migrate() and the v36/v38 migration checks.

### Phase 00 - Finish current work - 2026-10-16
- Changed: nothing in the game. Added the fresh-base brief (CLAUDE.md, docs/). Tagged `Baseline` (capital B, as published on GitHub) on commit 718320c: alpha 0.5 (d6b8441) plus the brief.
- Baseline contains: alpha 0.5. Since alpha 0.4.1: new look (glass panels, portrait in the top bar), Bag tab, battle restyle, wide side panel, Graphics gallery, friends, postcard and walking fixes, the tap tracer (?tapdebug=1), quieter sign-in failure.
- Repo vs project: the repo holds game/, studio/, README.md and ART-NOTES.md only. tools/ (115 files, incl. check-quick.py), retired/, the Start-Game/Start-Studio scripts, start-game.py, start-studio.py, STYLE-GUIDE.md and validation/ live only in the owner's project zip. game/, studio/ and README.md in the zip are identical to the repo. Where they should live is a phase 01 decision.
- Verified: `python3 tools/check-quick.py` on the owner's alpha 0.5 project zip, against the owner's validation/quick-baseline (110 pictures). Headless Chromium 141, software WebGL, Playwright 1.56. 2355 s (39 min), 47 steps: 41 passed, 6 failed.
  - Stale test: v31 settings tabs. The test clicks game, look, sound, controls, save, help; 0.5 has sound, graphics, game, save, help. The place card and map camera checks after it did not run.
  - Stale test, or delete the model: v46 "kinds without a room: station". The building list still names `station`; alpha 0.4 replaced train stations with airship masts and no scene places one.
  - Stale test, probably: alpha 0.4 postcards. 0.5 added pcFree() (no postcard until the opening, story, unmet rival and trainer intros are done, plus 3 s of calm walking); the test drops the player in Marigold Town without meeting Blake. Confirm which gate held it.
  - Legacy, delete in phase 03: v39/v40 "v36 save migration" returns an empty save.
  - Not diagnosed: v32 "Wear and tear at 0 still leaves wear" (world.wear = 0 no longer zeroes building wear).
  - Not diagnosed: v42 "wild growth: gallery: not grown" (most likely the 0.5 Graphics gallery scene is outdoor but not wild-grown; exclude it or grow it).
  - Pictures: 50 of 110 differ from the baseline. Spot checks (phone-team, env-day, battle-3d) show the baseline predates the 0.5 new look, so the differences are expected. The owner's last recorded run (2026-10-15) was a 2-step partial run.
  - Slowest steps: Scenes 606 s, v33 226 s, v44 180 s, Phone 135 s, Time/weather/rooms 92 s, v38 92 s, v32 91 s, v47 81 s, Things to do 76 s, v34 74 s.
  - Separately, game and Studio load headless to their title screens. Only error: ERR_TUNNEL_CONNECTION_FAILED (the test machine's network).
- Unfinished list (parked, not dropped):
  1. The six failures above (four stale tests or legacy, two to diagnose).
  2. Regenerate validation/quick-baseline from alpha 0.5 so picture comparisons mean something again.
  3. Walking camera: the owner's walk-crossing-test.log shows Hedgerow Lane -> Sundown crossed but "the view followed: False" (held for w:sundown*). Reproduce.
- Decisions I made (and why): kept the check's WebGL run rather than Lite mode, because the baseline and the phone both use WebGL; Lite mode is proposed for the phase 01 `--smoke` set. Did not commit tools/ or validation/ (about 50 MB with pictures) because repo layout and Git LFS are the owner's call in phase 01.
- Owner decided: regenerate the picture baseline at phase 03, not now. Still open: how tools/ and validation/ should live in the repo (phase 01).
- Next session starts with: phase 01. Fix the stale tests first so the check is green, then --smoke (Lite mode for the flows), CI, .gitignore, duplicate functions.

---

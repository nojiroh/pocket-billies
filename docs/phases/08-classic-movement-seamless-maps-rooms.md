# Phase 08 - Classic RPG movement: remove step tracking, seamless maps and rooms

## Goal
The game stops being a step-tracking "walking RPG" (real-world steps drive travel) and becomes a classic RPG: the player walks the maps themselves with a joystick or touch controls, maps blend seamlessly edge to edge, and rooms open in place at building doors. Real-world step tracking is removed completely. In-game walking STAYS.

## Important correction
An earlier version of this brief wrongly read "remove the walking" as removing in-game walking. I meant the fitness step tracking only. Do not remove the walk scenes, the joystick, the seamless maps or the rooms.

## This phase has two parts
Do Part A first (it may take its own session), then Part B.

# PART A - Remove step tracking

## Verify first (legacy figures; check all of it)
- The legacy README calls the game "a walking RPG": a route's length is its step cost (about 14.1 steps per metre), your trainer walks as your real steps come in, and if walking falls behind your steps the trainer hurries (up to 4x). Place data has a `cost` (for example 840) per stop. Steps are also tied to egg hatching, wild encounters, camera sway and tilt, Settings, saves and the debug log (which must never send step history). Alpha 0.4.1 added joystick walking "like a classic RPG".
- Find every place steps are read, stored, shown or used, and where they come from (a phone sensor, manual input, or a simulated rate).

## Tasks
1. Audit every use of steps. Produce a table: each mechanic that depends on steps -> proposed replacement.
2. Propose replacements and ask me: route and travel cost (distance walked, a fare for airships, time, or free), wild encounters (by distance walked in grass or random per area), egg hatching (battles won, in-game distance, time, a ranch incubator), movement pace (joystick speed plus a run button), any step-based unlocks, gates or goals, and any currency that steps used to earn.
3. Remove the step source, step storage, step history, step UI and settings, and step-driven camera sway. Delete step-related tests and update the full test and debug log.
4. Re-express old step costs and rewards in the new units. Propose a conversion table and ask me before applying it.
5. Update README and in-game text so the game is no longer described as a walking or fitness game.

# PART B - Seamless maps and rooms

## Verify first (reviewer read headers and searched, not every line)
- Edge-to-edge joining already exists: a "composite" window of a map plus its neighbours, with seams and shared edge exits, produced by tools/join-places.py.
- world.js still carries the older road-frame code and a switch that turns seamless mode off.
- Rooms open in place at the building's door with the town dimmed (keep this; it is good). The README mentions a 9-second timeout fallback that opens a room as a separate scene and a "rooms: quick" setting that skips rooms.
- 23 hand-furnished rooms; rooms are larger than their buildings.

## Tasks: maps
1. Remove the legacy road-frame path and the seamless on/off switch so there is exactly one way for maps to connect.
2. Store the neighbour graph in the data, for example `north: { neighbor: <mapId>, offset: <m> }`, instead of producing joins only through the build script. The Studio can view and edit it.
3. Name the shared strip consistently (`seam` or `border`) in code and data.
4. Validate in the quick check: every edge has a partner; partner exits face each other; ground height matches at the seam; nothing solid blocks a crossing; path width matches.
5. Stream maps per file: load the next map's data in the background as the player nears an edge, release far ones. Report phone memory and load numbers before and after.
6. Add a screenshot test that walks across each seam to look for visible pops (lighting, haze, grass, shadows, weather fronts).

## Tasks: rooms
7. Reduce room code to one path. If the timeout fallback and "rooms: quick" exist, remove them and make the in-place path fast enough. Tell me if a fallback is still needed on slow phones.
8. Rooms are intentionally BIGGER on the inside than the outside. Keep this. Treat a room as a map joined to the outdoor map at its door by a `door` link (not an edge seam) with an explicit alignment, using the same neighbour-graph data and validation wherever they apply.
9. Choose how bigger-inside works. Propose these and ask me: (a) separate space: the room lives in its own coordinate space and the exterior is dimmed or hidden while you are inside, so nothing overlaps and the two spaces never collide; (b) overlapped in place: the room is built over the town at the door with the exterior culled and its collision disabled while inside, which needs an overlap validation against neighbouring buildings and terrain; (c) optional portal view: looking through the doorway or windows from outside shows the larger interior (stencil or portal rendering) as a deliberate "bigger on the inside" effect, only if it fits the phone budget. Recommend (a), with (c) as later polish.
10. Validate rooms: door positions align; entering and leaving restores the exact outdoor position and camera; no room geometry or collision leaks into the outdoor map; for option (b), no overlap with neighbouring buildings or terrain.
11. Propose a room-template system (layout plus reusable furniture sets) so adding a room is cheap. Keep unique floors and furniture where they matter.

## Ask me before
What replaces each step-based mechanic (Part A); allowing several neighbours per side vs one exit per neighbour (recommend one); rooms as `kind: room` maps vs a separate `interiors` type; removing any room fallback; how bigger-inside rooms are implemented (a, b or c above).

## Done when
No step tracking remains anywhere (code, saves, UI, tests, logs), one connection model for maps, neighbour graph in data and Studio, seam and room validations in the quick check, tag `phase-08-done`.

## First reply
Same four items as phase 01, plus the table of mechanics that depended on steps with your proposed replacements.

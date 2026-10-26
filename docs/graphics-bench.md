# Graphics test and the Graphics bench

The **Graphics test** measures what each graphics setting costs on the device it runs on. It steps every setting
through a few values while everything else stays put, and reports the cost of each step. It is run by players only
(the debug menu's Performance section; Settings → Help had it until UI-7b): Claude's checks never run it, because a headless browser draws in software and
its numbers mean nothing. The checks never draw it either: the smoke check builds its step list, checks every setting
and station spot from the data, and saves a report made from made-up numbers (graphics_test_ready in
tools/check-quick.py); the full check walks the place's paths from the data.

Code: `game/js/graphics-bench-test.js`. Place: `test_graphics` ("Test: graphics bench"), built by
`python3 tools/build-test-scenes.py --only=test_graphics`.

## The place: Graphics bench (`test_graphics`, 60 × 46 m)

Three rows of three stations along a central path, plus two cross paths. Each station is built so one group of
settings has something to work on, and has a fixed spot to stand on, a camera turn and a zoom (`bench` in the map
data: `[x, z, turn, zoom]`). The same spots are the map's `shots`, so the quick check's test-scene step draws each
one at its low settings.

| Station | Where (x, z) | What is there | Settings it measures |
|---|---|---|---|
| Control pad | 10, 6 · zoom 0.6 | Bare pavers, nothing on them, seen close up | Sharpness (resolution), Dark corners, Film grain |
| Shadow court | 30, 5.5 | A plaza with trees, a lamp, a flag, a sign, crates, a bench, a boulder, a vending machine; three houses behind. Sun from the side | Shadows, Shadow detail (map size), Near shadow map (cascades), Ambient occlusion, Contact shadows |
| Pond | 50, 5 | A still pond; five trees and a house on the far bank to mirror | Water reflections, pixel water |
| Sun gap | 10.5, 20 | A tight grove with one path through it and two roofs in front; low sun straight ahead | Sun rays (`air.godRays`) |
| Lamp square | 30, 20 | Brick paving, ten lamps and lanterns, two fires, crystals, three houses with windows; measured at night | Glow (bloom), Lamps |
| Meadow | 50, 23.5 | Deep grass with flowers, open to the air | Grass (rebuilds), Particles, Low mist |
| Everything | 10, 32.5 · zoom 1.3 | A small grove, a pond, a grass patch, four lamps, a house | All settings at their lowest, at the game's own values and at their highest |
| Depth corridor | 30, 35.5 · zoom 1.3 | An avenue of trees from close by to the hills past the edge | Depth of field, Far trees and hills (rebuilds) |
| Open sky | 50, 33 · zoom 1.7 | A wide, empty plain (the walk camera looks down, so no sky is in the picture: the clouds show as their light and shadows on the plain) | Clouds, Cloud shadows |
| Sun gap, no god rays | the Sun gap's spot and sun | The grove with Sun rays at 0 for every step (phase 20 R2) | Cheap light shafts (`air.cheapShafts`) |
| Meadow in the rain | the Meadow's spot | The meadow with the weather forced to rain (phase 20 R2) | Rain in one go (`quality.rainBatch`) |

The map's own light is a mid sun (angle 35, height 40). A station that needs another light sets it for its steps:
the shadow court a side sun (angle 30, height 30), the sun gap a low sun ahead (angle -90, height 18), the lamp
square the night (22:00). Everything else is clear summer weather at 14:00.

## The settings

The 15 Expert dials (Settings → Display → Expert) and four hidden ones that cost the most:

- Expert: Shadows, Sun rays, Lamps, Low mist, Clouds, Cloud shadows,
  Particles, Grass, Far trees and hills, Water reflections, Depth of field, Glow, Dark corners, Film grain, Sharpness.
- Light shafts (`sun.shafts`) was a dial of its own until 2026-10-19: it smears only bright sky pixels, and the
  camera, looking down, never has the sky in the picture, so it showed nothing. Sun rays (`air.godRays`, the beams
  through the shadow maps) is the one dial for both now; `sun.shafts` stays an engine setting the looks can set.
- Trees shade themselves (`shadows.selfShade`) was a dial until 2026-10-19: only flat sprite trees read it, the
  solid trees within 20 m never do, and it showed no difference either way. It stays an engine setting.
- Hidden: Shadow detail (`quality.shadowMap`: 1024, 2048, 4096), Near shadow map (`shadows.cascades`: off, on),
  Ambient occlusion (`shadows.ao`), Contact shadows (`shadows.contact`). Glow size (`color.bloomSize`) was
  measured until 2026-10-19; it barely changes the picture even at full Glow, so it was dropped.

- Phase 20 R2 (pixels lane), each measured alone (off, on) and left out of "everything": Sky last
  (`quality.skyLast`: Sun gap, Open sky), Solid things first (`quality.solidFirst`: Sun gap), Drop spent pictures
  (`quality.invalidate`: Control pad, Lamp square), Phone lamps (`quality.phoneLamps`: Lamp square; only a phone
  changes), Rain in one go (Meadow in the rain), Cheap light shafts (0, 0.6; Sun gap, no god rays). Phone pixel
  budget (`quality.phonePixels`) is not here: the test pins resolution 1, which is under the phone's 1.2 MP either
  way; the diagnostics' Renderer baseline (`own`) shows it. A station may borrow another's spot (`spot`), force a
  weather (`weather`) and hold values under all its steps (`fixed`).

A dial with a range is measured at 5 steps: its lowest, 25 %, 50 %, 75 % and its highest. A choice is measured at
each of its values.

## How a step is measured

- **Held still:** while the test runs, automatic quality is off, the resolution is pinned (×1 unless the step is
  Sharpness), the time of day and the weather are forced, and the camera stands still on the station's spot. Only
  the setting being measured changes.
- **Frame cap kept:** the player's frame-rate cap stays. Frames per second stop at the cap, so a step's cost is read
  from the time the frame takes: the processor's time per frame, and the graphics chip's own time per frame where
  the chip has timers (EXT_disjoint_timer_query_webgl2).
- **Per step:** set the value, wait 1 s, then measure for 3 s.
- **Settling:** a station's first step and every step that rebuilds (and the step after one, which rebuilds back)
  first wait until nothing is left to prepare, plant (the grass) or paint (the ground’s helper thread included) and two whole seconds in
  a row agree within 10 %: at most 10 s, 12 s after a rebuild. Without it a station's first look came out slow while
  its ground was still painting, and the step after a rebuild was measured during the rebuild back.
- **Drift and noise:** each station measures its untouched look first, midway (stations with two or more settings)
  and last. When first and last differ by more than 15 % (a phone getting warm), the station is marked as drifting.
  The spread of the three is the station's noise: a cost no bigger than it is marked "within noise".
- **The cost of a step** is its time minus the time of that setting's lowest step, in ms per frame: the graphics
  chip's time where it has timers, else the whole frame's time worked out from the frame rate (1000 / fps). The
  processor's time is kept in the report but not used for the cost: the phones measured so far wait on their graphics
  chip (a frame of 25 ms with 3 ms of processor time), so it ranked the settings wrongly. Below the frame cap nothing
  shows: a setting that fits in the frame's spare time costs 0.
- **Background:** like the full test, it waits while the app is in the background and runs that station again.
- **Draw calls (phase 20):** while a step measures, every frame's graphics calls are counted
  (game/js/engine/gpu-counters.js): draws, instances, program switches, and the draws of each render pass. Counting
  wraps the context's methods for each counted frame, so it adds a little processor time to the frames it counts; every
  step pays it alike, so the costs between steps still compare.

## What it leaves behind

Nothing. It works on a copy of the player's settings, saves nothing (no save, no account, no friends), and puts
everything back when it ends or is stopped.

## The result

A table of settings sorted by cost (the highest step's cost), each with its curve, and **Save the report**:
`pocket-billies-graphics-YYYYMMDD-HHMM.json`. The report has the build, the device and its graphics chip, the
frame cap, and per setting each step's value, fps, frame ms, worst fps, processor ms, graphics-chip ms (or null), their
costs, the station's noise and whether the cost is within it (`unclear`). It has no save data and no names. Format 2
(October 2026) added frameMs, frameCost, noise and unclear, and the midway look. Phase 20 added, per step, `draws`,
`instances`, `programs` (switches) and `passDraws` (draws per pass) as averages per frame, and a Draws column to the
table (lowest step → highest).

## Time

116 measured steps (90 setting steps, two or three untouched looks per station, everything lowest and highest) at
about 4.5 s each, plus settling and rebuilds: about 11 to 12 minutes.

## The renderer baseline (diagnostics test, phase 20 R1)
The graphics test measures what each setting costs on the bench; the baseline measures what the game loads. It is a
step of the diagnostics test (Settings → Help → Diagnostics), "Renderer baseline", about 2-3 minutes on a phone:
- Five stops: Copperleaf by day (12:30) and by night (23:00), a jungle run place (seed `BASELINE1`, its first place
  forced to a jungle route: no run reaches the jungle yet), a run town (seed `BASELINE2`, its first place forced to a
  meadow town), a wild battle at the hub held at its move menu. The runs are made on a copy of the save.
- Each stop twice: `r1` at resolution 1 (as the bench's stations) and `own` at the game's own resolution; automatic
  quality off both times, the player's own dials set aside (the game's own values), clear summer weather, the player
  on the place's arrival spot, the camera straight. Each settles (up to 10 s) and is measured for 4 s.
- Each entry in the report's `baseline`: fps, worst fps, frame ms, CPU ms, GPU ms (where the chip has timers), draws,
  instances, program switches, texture binds, uniform calls, `passDraws` (draws per pass), `tagged` (per pass, the
  draws of low-poly models `model` and of models' picture layers `modelPic`: leaf clumps, vines, a clock's hands) and
  `kinds` (per pass, [distinct textures, distinct vertex arrays]: the fewest draws grouping could reach), and
  (phase 20 R3) `uploadKB` ([pictures, buffers] sent to the chip a frame).
- The battle (phase 20 R3): its CPU ms is the walk view's frame (`dio`, the world and the rigs) plus the battle
  stage's own (`scene`, the tweens and the effects canvas), each in `cpuTasks`; before R3 it was `scene` alone, which
  is why round 1 read 1 ms. Its `rigs`: ms redrawing the rig canvases, `calls` and `redraws` a frame (each redraw is
  one upload), `kb` redrawn a frame, `uploadMs` (one rig canvas sent 20 times and waited for: ms per upload). The
  battle is measured a third time, `ownRigReuse`: the game's own resolution with `quality.rigReuse` on. The full
  test's battle steps count `dio` in their CPU too.
- Numbers only. It saves nothing and sends nothing; the report is shared only when you export it.

## Findings so far (format 1 reports, 2026-10-19)

Two reports: an iPad (Apple GPU, Safari engine, 60 Hz) and an Android phone (Adreno 750, Chrome, screen at 3.5×).
Neither has graphics-chip timers, so these come from the frame rate. Format 1 had the two flaws fixed above (slow
first looks, the step after a rebuild), so small numbers are not sure; the Android phone's frame rate also jumps
between two levels at one setting (41 and 35, 27 and 23), about 15 %.

| | iPad | Android |
|---|---|---|
| Game's own values / everything lowest / highest | 38.5 / 57.5 / 37 fps | 15.5 / 42 / 16.5 fps |
| Sharpness 0.4 → 1 (bare pavers) | 60 → 60 | 55 → 29.5 |
| Grass 0 → 2 | no change | 46 → 32 |
| Ambient occlusion off → on | 56.5 → 53 | 42 → 35 |
| Depth of field off → on | not sure (slow first look) | 31 → 26 |
| Water reflections 0 → 0.5 and more | no change | 39 → 34 |
| Clouds 0 → 0.5 and more | no change | 41.5 → 35 |
| Far trees and hills 0 → 600 | 43.5 → 38 | 27.5 → 24 |
| Sun gap (Light shafts, God rays at any value) | about 40 | 16 to 23 |
| Lamp square at night (Glow at any value) | about 45 | about 23 |

- The game's own values are about the same as everything at its highest, on both devices: without automatic quality
  a phone gets the costliest look.
- The Android phone is held up by the number of pixels: the renderer draws at up to 1.75× the screen's pixel density
  (walk-view-gl.js, `R0`), and Sharpness alone halves its frame rate on bare ground.
- The Sun gap is the slowest place on both, whatever its two settings are: the cost is the grove itself (many trees
  of many sprites each, drawn over each other), not the light effects.
- Not found: the iPad's Lamps 1.15 to 1.55 dip (36 fps, then 43 at 2). Lamps only scales the lights' colours, the
  16 nearest lights are picked the same at any value, and the Android phone shows no dip.
- A rebuild from the settings left the solid props' vertex arrays and buffers behind (9 of each per rebuild on the
  bench); fixed. Draw calls per frame stay the same across rebuilds (about 400 at the depth corridor).

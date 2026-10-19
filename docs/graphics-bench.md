# Graphics test and the Graphics bench

The **Graphics test** measures what each graphics setting costs on the device it runs on. It steps every setting
through a few values while everything else stays put, and reports the cost of each step. It is run by players only
(Settings → Help, or the debug menu): Claude's checks never run it, because a headless browser draws in software and
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
| Pond | 50, 5 | A still pond; five trees and a house on the far bank to mirror | Water reflections |
| Sun gap | 10.5, 20 | A tight grove with one path through it and two roofs in front; low sun straight ahead | Sun rays (`air.godRays`) |
| Lamp square | 30, 20 | Brick paving, ten lamps and lanterns, two fires, crystals, three houses with windows; measured at night | Glow (bloom), Glow size, Lamps |
| Meadow | 50, 20 | Deep grass with flowers, open to the air | Grass (rebuilds), Particles, Low mist |
| Everything | 10, 32.5 · zoom 1.3 | A small grove, a pond, a grass patch, four lamps, a house | All settings at their lowest, at the game's own values and at their highest |
| Depth corridor | 30, 33 · zoom 1.6 | An avenue of trees from close by to the hills past the edge | Depth of field, Far trees and hills (rebuilds) |
| Open sky | 50, 33 · zoom 1.7 | A wide, empty plain | Clouds, Cloud shadows |

The map's own light is a mid sun (angle 35, height 40). A station that needs another light sets it for its steps:
the shadow court a side sun (angle 30, height 30), the sun gap a low sun ahead (angle -90, height 18), the lamp
square the night (22:00). Everything else is clear summer weather at 14:00.

## The settings

The 15 Expert dials (Settings → Graphics → Expert) and five hidden ones that cost the most:

- Expert: Shadows, Sun rays, Lamps, Low mist, Clouds, Cloud shadows,
  Particles, Grass, Far trees and hills, Water reflections, Depth of field, Glow, Dark corners, Film grain, Sharpness.
- Light shafts (`sun.shafts`) was a dial of its own until 2026-10-19: it smears only bright sky pixels, and the
  camera, looking down, never has the sky in the picture, so it showed nothing. Sun rays (`air.godRays`, the beams
  through the shadow maps) is the one dial for both now; `sun.shafts` stays an engine setting the looks can set.
- Trees shade themselves (`shadows.selfShade`) was a dial until 2026-10-19: only flat sprite trees read it, the
  solid trees within 20 m never do, and it showed no difference either way. It stays an engine setting.
- Hidden: Shadow detail (`quality.shadowMap`: 1024, 2048, 4096), Near shadow map (`shadows.cascades`: off, on),
  Ambient occlusion (`shadows.ao`), Contact shadows (`shadows.contact`), Glow size (`color.bloomSize`).

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

## What it leaves behind

Nothing. It works on a copy of the player's settings, saves nothing (no save, no account, no friends), and puts
everything back when it ends or is stopped.

## The result

A table of settings sorted by cost (the highest step's cost), each with its curve, and **Save the report**:
`pocket-billies-graphics-YYYYMMDD-HHMM.json`. The report has the build, the device and its graphics chip, the
frame cap, and per setting each step's value, fps, frame ms, worst fps, processor ms, graphics-chip ms (or null), their
costs, the station's noise and whether the cost is within it (`unclear`). It has no save data and no names. Format 2
(October 2026) added frameMs, frameCost, noise and unclear, and the midway look.

## Time

121 measured steps (95 setting steps, two or three untouched looks per station, everything lowest and highest) at
about 4.5 s each, plus settling and rebuilds: about 11 to 12 minutes.

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

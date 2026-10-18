# Graphics test and the Graphics bench

The **Graphics test** measures what each graphics setting costs on the device it runs on. It steps every setting
through a few values while everything else stays put, and reports the cost of each step. It is run by players only
(Settings → Help, or the debug menu): Claude's checks never run it, because a headless browser draws in software and
its numbers mean nothing. The checks only open its place and build its step list.

Code: `game/js/graphics-test.js`. Place: `test_graphics` ("Test: graphics bench"), built by
`python3 tools/build-test-scenes.py --only=test_graphics`.

## The place: Graphics bench (`test_graphics`, 60 × 46 m)

Three rows of three stations along a central path, plus two cross paths. Each station is built so one group of
settings has something to work on, and has a fixed spot to stand on, a camera turn and a zoom (`bench` in the map
data: `[x, z, turn, zoom]`). The same spots are the map's `shots`, so the quick check's test-scene step draws each
one at its low settings.

| Station | Where (x, z) | What is there | Settings it measures |
|---|---|---|---|
| Control pad | 10, 6 · zoom 0.6 | Bare pavers, nothing on them, seen close up | Sharpness (resolution), Dark corners, Film grain |
| Shadow court | 30, 5.5 | A plaza with trees, a lamp, a flag, a sign, crates, a bench, a boulder, a vending machine; three houses behind. Sun from the side | Shadows, Trees shade themselves, Shadow detail (map size), Near shadow map (cascades), Ambient occlusion, Contact shadows |
| Pond | 50, 5 | A still pond; five trees and a house on the far bank to mirror | Water reflections |
| Sun gap | 10.5, 20 | A tight grove with one path through it and two roofs in front; low sun straight ahead | Light shafts, God rays |
| Lamp square | 30, 20 | Brick paving, ten lamps and lanterns, two fires, crystals, three houses with windows; measured at night | Glow (bloom), Glow size, Lamps |
| Meadow | 50, 20 | Deep grass with flowers, open to the air | Grass (rebuilds), Particles, Low mist |
| Everything | 10, 32.5 · zoom 1.3 | A small grove, a pond, a grass patch, four lamps, a house | All settings at their lowest, at the game's own values and at their highest |
| Depth corridor | 30, 33 · zoom 1.6 | An avenue of trees from close by to the hills past the edge | Depth of field, Far trees and hills (rebuilds) |
| Open sky | 50, 33 · zoom 1.7 | A wide, empty plain | Clouds, Cloud shadows |

The map's own light is a mid sun (angle 35, height 40). A station that needs another light sets it for its steps:
the shadow court a side sun (angle 30, height 30), the sun gap a low sun ahead (angle -90, height 18), the lamp
square the night (22:00). Everything else is clear summer weather at 14:00.

## The settings

The 17 Expert dials (Settings → Graphics → Expert) and five hidden ones that cost the most:

- Expert: Shadows, Trees shade themselves, Light shafts, God rays, Lamps, Low mist, Clouds, Cloud shadows,
  Particles, Grass, Far trees and hills, Water reflections, Depth of field, Glow, Dark corners, Film grain, Sharpness.
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
- **Per step:** set the value, wait 1 s (a setting that rebuilds the ground or the grass waits until the rebuild is
  done, at most 8 s), then measure for 3 s.
- **Drift:** each station measures its untouched look first and last. When the two differ by more than 15 % (a phone
  getting warm), the station is marked as drifting.
- **The cost of a step** is its time minus the time of that setting's lowest step, in ms per frame.
- **Background:** like the full test, it waits while the app is in the background and runs that station again.

## What it leaves behind

Nothing. It works on a copy of the player's settings, saves nothing (no save, no account, no friends), and puts
everything back when it ends or is stopped.

## The result

A table of settings sorted by cost (the highest step's cost), each with its curve, and **Save the report**:
`pocket-billies-graphics-YYYYMMDD-HHMM.json`. The report has the build, the device and its graphics chip, the
frame cap, and per setting each step's value, fps, worst fps, processor ms, graphics-chip ms (or null) and cost. It
has no save data and no names.

## Time

About 108 measured steps at about 4.5 s each, plus moving between stations and rebuilds: about 9-10 minutes.

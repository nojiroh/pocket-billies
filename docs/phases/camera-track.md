# Camera track (CAM) - a camera that follows well, frames what matters, and a diorama blur

A side track of its own, like the terrain track. The owner's brief (2026-10-22): the camera should follow the player
more dynamically, zoom in when things of interest come up, and the blur should look like a diorama (tilt-shift). All of
it should be easy to tune in the Studio. Approved 2026-10-22 to run now, beside the RL track. Each session is tagged
`cam-N-done` (the owner pushes tags).

Before proposing anything in a session: read the latest HANDOFF.md entries and recent merges, then check the facts
below against main and report what differs.

## Verified facts (2026-10-22, read from the branch this plan was written on)
- **Follow** (game/js/walk/camera.js `walkCamera`): the target moves toward the player by `min(1, dt*3.2)` a frame
  (an approximation, not an exact exponential); the look-ahead is velocity-based (Engine > Camera > `lead`, 1.3 m),
  turned off above 12 m/s (which also hides the jump when the seamless world re-anchors: `walkRenderer.px/pz` are not
  shifted there, `camT` and `focusT` are; seamless-world.js ~1730).
- **Separate forces, each with its own smoothing**, all added on top of each other: TR-3 rise on tall ground
  (logic/camera-rise.js), landmark tilt (walk/sprites.js `landmarkTilt`, catalogue flag `landmark`), phone tilt and
  mouse, indoor +12 degrees, the room framing (`sc.room`), `st.focus`, the battle swoop, the pixel-grid snap and the
  walk bob (`sway`). Pitch, distance and field of view are changed independently by zoom (`(zoom-1)*14` degrees).
- **Talking** (talk.js:308) only sets `walkRenderer.focusT`, which moves the blur's focus for 2.6 s; the camera itself
  does not move. **Encounters** (battle.js `battleSwoop`) halve `zoomT` and hand over after a fixed 720 ms timeout.
- **Blur** (engine/post-effects.js, `dof`): already depth based, at half size, a golden-angle gather of 28 taps (14 on
  the fast path) with round highlights. The sharp zone is a slab parallel to the screen around the focus distance
  (`focusBand` 0.3, `blurFar` 1.5, `blurNear` 0.9 of a 16 m reference, walk-view-gl.js `dofRef`). The focus distance
  is smoothed by 0.12 per frame (frame-rate dependent). Composite: `mix(sharp, blurred, smoothstep(.02,.4,coc))` at
  full size from the half-size result. The header of walk-view.js still says the blur "grows toward the top and bottom
  of the screen"; that is no longer how it works.
- **Studio**: the Engine section (studio/js/engine-editor.js) has Lens and Camera dials with a live preview of any walk
  scene, scopes (game, scene, map), presets and hold-to-compare. Nothing shows where the camera aims, what is in focus,
  or why. The free camera (logic/free-camera.js, studio/js/free-camera.js) and the cutscene camera are separate and
  stay so.

## Research (outside sources, 2026-10-22)
- Cinemachine Position Composer: dead zone, soft zone, hard limit, damping, lookahead time and smoothing; Target Group
  (weight and radius per member, weights ramped rather than toggled); its game-view guides (the zones drawn on the live
  view and dragged there) are the model for the Studio overlays.
- Frame-rate-independent smoothing: `1 - exp(-lambda*dt)` (Rory Driscoll), or better a critically damped spring
  (Game Programming Gems 4 1.10, Unity SmoothDamp; smooth time about 0.15-0.35 s for a top-down follow).
- Itay Keren, "Scroll Back" (GDC 2015): camera window, position snapping, target focus (look-ahead from input),
  cue focus, region anchors, zoom to fit, edge snapping.
- John Nesky, "50 Game Camera Mistakes" (GDC 2014): one blended goal instead of competing forces (#8); pitch, distance
  and field of view from one zoom on a curve (#16); no hint right after a turn (#35); no walk bob (#44); no rapid
  zoom changes (#42, #46).
- Squirrel Eiserloh (GDC 2016): shake from "trauma" (0-1, decays linearly, shake = trauma squared, noise not random).
- Tilt-shift: a miniature reads from a very shallow, tilted plane of focus, a high viewpoint, strong blur above and
  below, and a little extra saturation and contrast. Blurring by screen rows fails for tall things and top-down
  cameras; a world-space focus plane works. Link's Awakening (2019) adds edge blur; players modded it out, so a player
  slider matters. Octopath Traveler keeps exploration yaw fixed because billboards break when turned.
- Blur kernels: Dennis Gustafsson's single-pass bokeh (golden angle, background samples clamped to stop halos);
  dual Kawase filtering (ARM, SIGGRAPH 2015) as the cheap mobile path.

## The owner's answers (2026-10-22)
- Run it now, as a side track.
- Moments that zoom in: talking, encounters and the boss gate, doors and landmarks, an idle drift in and a small
  ease-out when running. All four.
- Blur: medium by default, with a player slider in Settings.
- Look-ahead: from the joystick, smoothed.
- The Studio tools come with each session (no separate tools session).

## Sessions

### CAM-1 - The follow
- `logic/camera-follow.js` (no DOM, unit tested): a critically damped spring per axis (smooth time as a dial), exact
  at any frame rate; a dead zone and a soft zone as shares of the screen; a look-ahead from the joystick's direction,
  smoothed, larger sideways in portrait (runs go east to west on a narrow screen); ground height changes under about
  half a metre ignored.
- One camera goal: the landmark tilt, TR-3 rise, room framing, indoor tilt, phone tilt and swoop become weighted goals
  blended into one target and one zoom, instead of each adding its own smoothed offset. TR-3's behaviour must stay the
  same (its tests and pictures).
- The seamless world's re-anchor shifts the new spring state too.
- Fix the frame-rate-dependent focus smoothing (walk-view-gl.js, 0.12 a frame).
- Studio: Engine > Camera gets Follow dials (smooth time, dead zone, soft zone, look-ahead) and an overlay on the
  preview: the zones (dragged to resize) and the look-ahead arrow.
- Debug log: a camera line (mode, zoom, the goals in play). No save data or names.

### CAM-2 - Moments of interest
- One zoom value drives distance, tilt and field of view along curves (Studio dials for each end).
- Points of interest from data: the catalogue's `landmark` grows into `interest {weight, radius, zoom, pull}`;
  weights fade in by distance; the pull is capped (about 1.5 m).
- Camera zones in a scene (rectangle or circle: zoom, offset, tilt, priority, blend time), placed in the Walk scenes
  editor.
- Moments: talking (a two-shot of you and the speaker, zoomed in); an encounter (a proper shot in place of the 720 ms
  timeout); the boss gate (a reveal); shop and clinic doors and landmarks (a gentle pull); standing still a few seconds
  (a slow drift in); running (a small ease-out). None right after a turn; all off or reduced with reduced motion.
- Studio: point-of-interest rings and zones on the preview; "Play moment" buttons (talk, encounter, boss gate, idle).

### CAM-3 - The diorama blur
- A tilted plane of focus through the player (a Studio dial: 0 = today's slab, 1 = an upright plane, so whatever
  stands in the strip is sharp head to toe and the ground ahead and behind melts away), plus an optional edge blur.
- Quality: background samples clamped so sharp edges don't smear (Gustafsson); a blurred foreground over sharp things
  handled; a cleaner full-size blend (no blocky edges); a cheap blur for slow phones (a Kawase chain) instead of
  switching it off.
- A "Miniature" look preset (a little saturation, contrast and vignette tied to the blur strength).
- Settings: a player blur slider (default medium); the focus follows the moments (the speaker, the encounter).
- Studio: the sharp strip tinted on the ground and a blur heatmap on the preview.
- Measure on the phone with the GPU timer before and after.

## Ideas for later (not planned)
- Screen shake from trauma (hits, boss slams, landings), scaled by a setting, off with reduced motion.
- Walk bob off by default (Nesky #44).
- Drag to peek ahead, springing back.
- A gentle sway in battle while a move is chosen (Octopath).
- Letterbox bars in dialogue.
- Keep the turn limit (35 degrees): billboards break when turned further.

## Risks
- Every camera change moves every screenshot: each session regenerates validation/quick-baseline and says why.
- Self-test, graphics bench and fixtures set `zoomT`/`yawT` and use `walkView.opt.instant`; the new state must honour
  both.
- The phone's frame time: the blur already costs the most of the post chain.

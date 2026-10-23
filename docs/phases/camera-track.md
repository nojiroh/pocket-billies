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

- **Since this plan was written, main gained the island track's IS-1 orbit camera** (logic/camera-orbit.js, an orbit
  mode in `walkCamera` when `sc.cam.orbit` is set, with its own yaw lag and dead zone, new Engine > Camera dials in
  engine/settings.js). CAM-1 starts from main with it merged and builds on it: one dead zone and one smoothing model
  for both the follow and the orbit, not two; IS-1's tests stay green.

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

#### CAM-1 as built (2026-10-22)
- **Corrections to "Verified facts"** (checked against the code at the start of CAM-1):
  - The list of forces missed four: rising ground 3.5 m ahead tilted the camera down up to 9 degrees (`upT`, apart
    from TR-3); the scene's own tilt and height glided on changes (`cpe`); the aim was clamped inside the scene with a
    fixed +2 m (landscape) / +1 m (portrait) up the screen; indoors the camera came closer so it stayed inside the
    near wall.
  - `st.focus` and `st.focusY` were never set by the walking game (the `focus:` values in title.js and the director
    belong to the cutscene camera): dead code, removed from `walkCamera`.
  - `walkView.opt.instant` is never set by anything. The camera snaps when something sets `walkRenderer.camT = null`
    (title, battle-3d, story-stage, the director, a new scene); rooms save and restore the camera at the door and the
    self-test compares `camT` exactly.
  - The blur numbers quoted are the code's fallbacks; the game's engine.json sets `focusBand` 0.62 and `blurFar` 2.6
    (and the camera's `fov` 0.68, `pitchAdd` -8).
  - There is no `validation/quick-baseline` in the repo: CI fetches it from the release `baseline-<version>`, remade
    only on `phase-*` tags or by hand (Actions > Check > Run workflow > "Make the picture baseline").
  - The Studio's Engine preview has no joystick (click to walk, WASD), so the look-ahead also takes the walking
    direction.
- **The follow** (logic/camera-follow.js, 12 unit tests): `springStep` is a critically damped spring solved exactly
  for a target moving in a straight line during the step (30, 60 and 144 fps agree to 0.00001 m; a still target is
  never passed); `zoneAxis`/`zoneMetres` the dead and soft zones as shares of the screen, measured along the screen's
  axes on the ground; `followStep` (the dead zone closes over about 0.35 s when you stop, so a still picture is
  framed as before; a hard limit at the soft zone; a goal jump past the soft zone is a cut, not a move; ground
  changes under the band ignored while you walk); `leadStep` (its own spring; the sideways part x`leadSide` on a tall
  screen); `blendGoals` (weights ramp in and out, a goal no longer asked for fades as it last was; tilts add,
  distances multiply, aim points pull in order).
- **One goal** in walk/camera.js: `tilt` (phone and mouse, at once), `indoor` (+12 degrees), `ahead` (up to 9),
  `landmark` (up to -11), `room` (the room framed whole, 0.15 s), `swoop` (0.15 s). TR-3's rise keeps its own uneven
  ramp and code, fed the blended tilt: check-fast's Tall ground gives the same numbers as TR-3 (16.9 m of rock, 18.0
  degrees). The swoop still halves `zoomT` (one zoom curve is CAM-2). The scene's own tilt/height glide (`cpe`) stays
  as a glide of the base, not a goal. Yaw, zoom and `cpe` eases are exact exponentials now.
- **Dials** (Engine > Camera): Look-ahead 1.3 m (was "Leads your walk"), Look-ahead smoothing 0.6 s, sideways on a
  tall screen x1.5, Follow smoothing 0.3 s (the old follow's lag at a steady walk), Dead zone 10% x 8%, Soft zone 50%
  x 50%, Ignore ground changes under 0.5 m, Camera goals blend 0.4 s. Studio: "Camera guides" over the preview (soft
  zone tinted, dead zone outlined, the aim, you, the goal, the look-ahead arrow, a line with the mode, zoom and goals;
  drag a zone's edge to set its dial, one undo step).
- **State**: `walkRenderer.fol` (the follow; `camT` stays its aim, so every reset and the door's save/restore keep
  working; the door also saves `fol`), `walkRenderer.camInfo` (for the debug log and the guides). The seamless
  world's re-anchor shifts `camT`, the follow's last targets, the goals' aim points, the swoop and `px/pz`.
- **Debug log**: a `camera` section (mode, zoom, yaw, pitch, rise, goals, lead, off, moving).
- **Merged with main's IS-1 orbit camera** (after CAM-1 was built, before its PR merged): the orbit sets the base
  direction, and the follow's screen axes, the look-ahead from the stick, rising ground ahead, the landmark tilt, the
  swoop's offset and "a little up the screen" all turn with it; an orbiting camera isn't held inside the scene; the
  debug log's mode reads `orbit`. Not done yet: one smoothing model for both. The orbit still turns with its own
  yaw lag and dead zone (logic/camera-orbit.js) while the follow's spring and zones move the aim. Merging them changes
  how the island camera feels, so it waits for the owner's call (CAM-2 or a follow-up). check-fast 24 of 24 after
  the merge (IS-1's orbit step, the Hub island editor, Tall ground, Camera follow); unit tests 621.
- **Checks**: check-fast "Camera follow" (Copperleaf: settled standing, the look-ahead from the stick, inside the
  soft zone, settled again; a look-ahead that ignores the stick is caught); the debug log step wants the camera line.

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

#### CAM-2 as built (2026-10-22)
- **Corrections to the plan** (checked against `CAM` at the start of CAM-2):
  - There is no "boss gate" in the walk: a run's boss is a trainer (logic/run-loop.js `runFoes`, `runFoe: 'boss'`),
    placed like the other trainers. The reveal fires the first time you come near it in a place.
  - Nothing noticed a door you stand by (doors only worked when tapped), and nothing counted time standing still:
    both are new.
  - Talking has no "ended" hook: the moment follows `talkBox.on`, with the speaker stored when the talk starts
    (talk.js `talkFolk`, walk-control.js `walkPick` for trainers and people).
  - The landmark catalogue is scenery.json (`props`, 41 with `landmark`), which has no schema.
  - Zoom never changed the field of view: the distance and the width shown both scaled with it, so only distance and
    tilt moved (14 degrees a unit).
  - The swoop wrote your zoom (`zoomT` halved, restored after 720 ms) and leaving a battle set `zoom` to 0.55x; twelve
    other places write `zoomT`/`yawT`, so no moment does.
  - Copperleaf has no shop or clinic: the lab's and ranch's doors count as points of interest too.
  - The Engine preview runs a free camera (studio/js/viewport.js), which had no goals beyond the follow; it asks for
    the moments and zones now (`walkView.opt.moments`). The Studio's other previews don't.
- **One zoom** (logic/camera-zoom.js, 7 unit tests): `zoomShape` turns a zoom into tilt, distance and field of view
  along `t^curve` toward each end (Engine > Camera > Zoom curve: tilt, distance and field of view up close and far out,
  and the shape), carrying on along the slope past an end. The defaults give the zoom as before (-6.3/+9.8 degrees,
  0.55/1.7 distance at 0.55/1.7 zoom, field of view 1). The zoom used is your pinch zoom times the goals' zoom
  (`blendGoals` multiplies a goal's `zoom` like its `dist`); it is never clamped below or above your own.
- **Goals** gain `zoom` and `out` (a ramp time going out). New goals in walk/camera.js: `swoop` now with a zoom
  (Encounter shot: zoom 0.5, never so close that you and the spot don't both fit), `leave` (after a battle the camera
  starts at 0.55 and pulls back out over 0.2 s, as v31's jump of the zoom did), `zone:N`, and the moments'.
- **Encounter shot** (battle.js): the battle comes up once the camera has arrived (the swoop at weight 0.95 and the
  camera within 0.2 m of its aim), no sooner than 400 ms and no later than 900 ms (dials), instead of a fixed 720 ms.
  Your `zoomT` is untouched. The seamless world's re-anchor moves the swoop's points.
- **Points of interest** (logic/camera-interest.js, 6 unit tests; walk/sprites.js `interestPoints`): a catalogue
  entry's `interest {weight, radius, zoom, pull}`, else a landmark's default (0.5, 14 m, zoom 1, 1.5 m), else a shop,
  clinic, lab or ranch door (0.6, 3.5 m, zoom 0.92, 1 m). The weight fades in over the outer 60% of the radius; the
  strongest wins; the lean is capped (Interest: most lean, 1.5 m). The v47 landmark tilt is unchanged.
- **Moments** (logic/camera-moments.js, 9 unit tests): one a frame by priority: talk (a two-shot at the midpoint, zoom
  0.75), boss (2.2 s, lean up to 3 m, zoom 0.85; once per boss, kept across the seamless world's re-anchor),
  interest, idle (after 4 s still, in over 2 s to zoom 0.9, out in 0.3 s), run (zoom 1.06; `P.running` set where
  the walk picks the run speed). None starts within 0.5 s of a turn past 60 degrees; one already on carries on.
  Reduced motion: idle and run off, the others at half weight. A camera cut restarts the idle count.
- **Camera zones**: a scene's `camZones` (map.schema.json: rect or circle, zoom, aim offset `at`, tilt, priority,
  blend); the highest priority you stand in is a goal (`zoneAt`); the seamless world carries a place's zones. No scene
  has any yet. Studio: Walk scenes > Camera zones (shortcut J; studio/js/camera-zones-editor.js): drag a rectangle or
  a circle from its centre, click to pick and set its numbers, drag to move, right-click or Alt-click to remove.
- **Studio** (Engine): the dials above; Camera guides also draw the interest rings (the one that counts brighter),
  the zones (the one you stand in filled) and a played moment's spot, and the line names the moment and the zoom used;
  "Play moment": Talk, Encounter, Boss, Standing still.
- **Debug log**: the `camera` section adds `zoomEff`, `moment`, `interest` ([in reach, top weight]), `zone`, `still`.
- **Checks**: check-fast "Camera moments" (Copperleaf, from state: the drift in and out, a talk's two-shot, a played
  boss, the lab's door, the encounter shot keeping your zoom; a planted fault, the moments switched off, is caught);
  the debug log step wants the moment, zoom and zone.

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

#### CAM-3 as built (2026-10-22)
- **Corrections to the plan** (checked against `CAM-2` at the start of CAM-3):
  - A player blur control already existed: Settings > Graphics > Expert > "Depth of field" (`lens.blur`), shown only
    with Expert on, and it replaced the game's blur instead of scaling it. The new slider replaces it.
  - The slowest quality step (4) switched the blur off (`noDof`); steps 1-3 (or a render scale under 0.75) already
    used a 14-tap fast path.
  - The game's lens is `blur` 2 (built-in 0.5), `bokeh` 1.25 and `vignette` 0.72 as well as `focusBand` 0.62 and
    `blurFar` 2.6; `blurNear` is the built-in 0.9.
  - No background sample was ever clamped: a pixel blurred under 0.02 skipping the gather was the only halo guard.
    Near samples already bled outward (`max(cs, cc*.35)`).
  - The composite drew the half-size blur and its amount up bilinearly (the blocky edges).
  - Talking moved the blur's focus for 2.6 s only; the encounter's swoop never moved it.
  - No per-pass GPU time in play: only the whole frame's (debug overlay, debug log `gpu`); the diagnostics test
    timed every post effect as one "final pass".
  - The blur still read the dead `st.focusY` (x0.6); removed.
  - The plan's "prep pass" isn't needed: a pixel's distance from any plane is `z * (g0 + gx*u + gy*v) - h`, three
    numbers from the camera a frame (below).
- **The plane of focus** (logic/lens-focus.js, 9 unit tests): `focusPlane` from the inverse view-projection (eye, the
  view's axis, a ray per screen place); the normal leans from the view's axis (tilt 0) to the axis laid flat (tilt 1,
  upright); the plane passes through the focus point moved along the view so its depth is the eased focus (so tilt
  0 is exactly the old slab, and passes the old uniform: no picture moves). `focusBlur` is the shader's curve,
  `edgeBlur` its edge term, `focusAim` what the focus is on, `leanStep` the eased lean. Battles keep the slab.
- **The blur pass** (engine/post-effects.js `drawDepthOfField`, timed apart as "blur" in the diagnostics test and the
  debug log's pass timings; the rest is `drawPostRest`, "final pass"): samples count where their own blur reaches
  (Gustafsson): behind the focus a sample behind the pixel is held to twice the pixel's blur, a sharp thing in front
  never leaks into the blur behind it; in front of the focus everything behind counts as before (the near tree stays
  smooth). Four probes at the widest reach find a blurred thing in front, which then spills over sharp pixels beside
  it (the alpha carries only that spill). The composite works out each pixel's blur at full size from full-size
  depth with the same plane, so the sharp/blur edge follows the real edges. Quality step 4: two dual-Kawase steps
  down and one up (the bloom's own passes), blended by the same full-size amount (`cheapDof`, path "cheap").
- **Dials** (Engine > Lens): Tilt of the sharp zone (built-in 0), Edge blur (0), Miniature look (0: up to +25%
  saturation, +12% contrast, +0.2 vignette, times the blur in use), Focus moves in (0.35 s). Preset "Miniature" (tilt
  1, band 0.35, far 1.8, near 0.7, blur 2.2, miniature 0.8). The game's look (engine.json): tilt 0.7, chosen from tools/look-blur.py's pictures (at 1 a little
  sharper up the mast, at 0.7 gentler); band, ramps and strength unchanged, so Medium is the old strength.
- **The focus follows the moments** (walk-view-gl.js): the middle of you and who you talk to for the whole talk, the
  encounter's spot while the camera swoops, a boss as it is revealed, else a tapped spot (as before); camera.js
  records the speaker's and boss's spots (`walkRenderer.momSpots`, the Studio's Play moment included).
- **Settings > Graphics > Blur**: 0-150% (`preferences.blur`, 1 = Medium, the game's look), in walks and battles; Off
  skips the blur pass; the Miniature look follows it.
- **State, log, checks**: `walkRenderer.lensInfo` (path, what the focus is on, focus distance, the focus point, tilt,
  blur in use, slider), `lensPlane`, `focusLean`. Debug log: a `lens` section (no names, no places). check-fast "Blur
  focus" (from state; a planted fault caught); the debug log step wants `lens`. tools/look-blur.py: pictures.
- **Studio** (Engine preview): Blur guides (ground cells the blur keeps sharp, tinted; the focus point; a line with
  path, focus, tilt, strength) and Blur heatmap (the composite colours each pixel by its blur).

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

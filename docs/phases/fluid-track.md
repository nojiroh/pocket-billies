# Fluid track (FL) - hold the frame rate you set, and a fluid UI

Branch: track/fluid

A side track. The owner asked (2026-10-29): "Develop a plan to make the ui more fluid. It should always be the fps
that is set. Research render layering online and other necessary. Are assets currently batched correctly?" FL-0
(this file, docs only) was written on `ccr-36d73c36-2xv56p`; every later session works on `track/fluid`, which the
owner makes from that branch (docs/BRANCHES.md).

**Status:** FL-0 done (2026-10-29). Round 1 (FL-1a, FL-1b, FL-2a at once) started 2026-10-29; FL-1a done (2026-10-30);
FL-1b done (2026-10-30). FL-0b (the owner's phone run) runs beside it.

Before editing, every session checks the facts it relies on against main and says in its HANDOFF entry what differs.
They come from read-only studies on 2026-10-29 at main 73b2f8b1: nine studies (frame pacing, sprite batching, world
batching, render order, CPU stalls, DOM UI; web research on render layering, frame pacing and UI compositing), seven
verifiers that tried to refute the key claims, and a plan critic. Line numbers drift: find lines by their text.

## Contents
1. The owner's answers
2. The numbers that started it
3. Are assets batched correctly?
4. Render layering: the research and this game
5. Why the set fps isn't held
6. Sessions
7. Ask me before
8. Not in this track
9. Risks
10. Sources

## 1. The owner's answers (2026-10-29)
Sessions act on these without asking again.
- **Fallback.** When the set rate can't be held at the lowest automatic quality, the game runs at a **steady half
  rate** (60 → 30, 120 → 60) and climbs back by itself when there's room. The fps overlay and the debug log say so.
  (Today it keeps trying for the set rate and frames come unevenly, e.g. 23-31 fps.)
- **Look trades automatic quality may make on phones** (all four offered): fewer far small props and townsfolk; a
  **2048 far shadow map** instead of 4096; **tinted HUD glass** while walking (a tinted fill, no live blur over the
  moving 3D); **one-picture far trees** (one crown picture instead of about 9 leaf clumps).
- **Pictures in batches and Sky last: on by default** (phase 20's switches, held for the water check). First the
  three small fixes in FL-2a; the old paths stay one release as an automatic fallback.
- **Behind full menus (Team, Bag, Guide ...) and windows the world is frozen**: one last frame, then nothing until
  you return.

- **Sessions run on their own** (the owner, 2026-10-29: "Automatically start plan when reviewed. Start each new step
  in a new session. Plans are approved. Run things simultaneously if you can."): each session plans, then builds
  without waiting for approval (this answer is the approval), and its work goes in by rounds (below). An "Ask me
  before" item is still asked: the session ends its turn with the question, options and a recommendation instead of
  deciding, and the rest of its work goes on. The owner's standing answers above already settle the ones they cover.

### Rounds and lanes (parallel sessions)
Every lane works on `track/fluid` (each cloud session started with it as its push branch). Before every push:
`git pull --no-rebase origin track/fluid` (a merge, never a rebase or force push). A lane edits only its own files;
a change it needs in another lane's file goes in its HANDOFF entry for that lane. Shared files take additions only
and are merged by hand: engine/settings.js defaults, the precompile list in engine/webgl.js, HANDOFF (yours on top),
this file's Status line, CHANGELOG. Generated files (hooks.js, debug-log-names.js): after a merge run `npm run
modules`, never edit by hand. debug-log.js and tools/read-debug-log.py are shared with the test-data track:
additions only.

| Round | Lane | Owns |
|---|---|---|
| 1 | FL-1a pacer and ladder | frame-scheduler.js, walk/quality-cull.js, logic/quality-step.js (and a new logic/ pacing module), engine/gpu-counters.js, debug-menu.js's fps overlay; in walk-view-gl.js only the `work` timing and the adaptQuality call |
| 1 | FL-1b stalls and page | debug-log.js's getError (additions), walk-control.js cap(), pixel-sky.js, walk-tab.js/css, walk-view.js and walk-control.js `safe()`; in walk-view-gl.js the label canvas, the canvas size and the shadow/reflection parity |
| 1 | FL-2a pictures | walk/sprites.js, engine/sprite-instances.js, walk/water.js's reflection, walk/walk-shaders.js's sprite programs, the contactAO CPU twin (engine/light.js or a new logic/ module), the two defaults in engine/settings.js |
| 2 | FL-2b effects, spins, grass | walk/effects.js, walk/fountains-weather.js, prop-models.js, walk/shadows.js, walk/ground-draw.js, walk/frame-items.js |
| 2 | FL-3a controller | the controller module in logic/, walk/quality-cull.js, battle-stage.js's ladder, the world clock in walk-view-gl.js |
| 2 | FL-6 fluid UI | game/css/*, battle.js, minimap.js, ui-motion.js, bag.js, settings-screen.js, overlay.js, walk-control.js (after FL-1b) |
| 3 | FL-3b resolution | walk-view-gl.js's canvas and target sizing, engine/webgl.js renderTarget |
| 3 | FL-4 even frames | grass-build.js, map-cache.js, walk/shadows.js's far cache key, the timers |
| 4 | FL-5a draw order | the opaque programs' variants, the scene-pass order in walk-view-gl.js |
| 5 | FL-5b look trades | shadow map size, far trees (tools/bake-pixel-facts.mjs), ground tiles, post-effects.js |
| 6 | FL-7 close-out | everything, after the owner's phone run |
The last lane of a round to finish (it checks the round's other HANDOFF entries on `track/fluid`) starts the next
round's lanes, each in a new session (create_session, push branch `track/fluid`) with the same instructions. FL-7
waits for the owner's phone run. One draft pull request from `track/fluid` into main, updated by each round.

## 2. The numbers that started it
- Android, Adreno 750 (Opera, Chromium): Copperleaf **13-17 fps** by day, about 700 sprite draws of which 650 are model
  leaf pictures (Diagnostics 2026-10-28, HANDOFF CH-6 entry). The 2026-10-26 baseline: 17 fps at resolution 1, 12.5
  at the game's own values; 697 sprite draws, 20,857 uniform calls, 1,592 texture binds, about 28 ms of main-thread
  time a frame (docs/archive/HANDOFF-2026-10.md, R2 entry; on Android this time includes waits on the graphics chip).
  The A8 baseline (2026-10-19): 1.1-1.5 ms per 100 draws; "frames of 19-42 ms against 6-15 ms of processor time".
- The same phone, a run route (2026-10-29, HANDOFF "Kappi's stall clock"): 23-31 fps, automatic quality at its floor
  (q4, resolution 0.6) within 29 s; graphics memory estimate 307 MB, peak 322 MB (the phone budget is 300).
- Firefox 159, Adreno 650, battery saver on (test-data-track.md section 2): Copperleaf 15-18 fps, 10th percentile 2-7.
- Budgets (phase 20 A8, the owner): at most 400 draws a frame on phones, 60 fps in towns.

## 3. Are assets batched correctly? Partly.
| What | Today, default settings | Batched? | Better |
|---|---|---|---|
| Pictures, main pass | `quality.spriteInstances: false` (engine/settings.js). One `drawArrays` per picture with about 25 uniform calls, 2 `activeTexture`, 2 `bindTexture` (walk/sprites.js plain loop, setSpriteRecord; draw-common.js setSpriteGeometry). Sorted by `imageId`, so copies sit together, but nothing merges them. | **No** | The batched path is built (engine/sprite-instances.js, 100-byte instances, runs cut by texture). Headless, older commit: sprite pass 710 → 142, uniform calls 21,658 → 4,846. |
| Pictures, reflection | One draw each (water.js), about 15 in Copperleaf. | No | The batched reflection sends the same values (verified; only half-float rounding differs, and the Figures atlas case, Figures off by default). |
| Leaf clumps | 260 separate baked PNGs (pixelFacts.json cuts, 3-18 per crown), each its own RGBA8 texture with mips plus a normal-map texture (engine/webgl.js imageTexture). No atlas, texture array or KTX2 (phase 21 parked). | **No** | Even batched they stay about 94 runs (643 → 94 headless). An atlas per tree kind (or all clumps) brings them to about 10-15. |
| Shadow pictures | Instanced by texture in every shadow pass (walk/shadows.js, the only path since R4). | Yes | An atlas would merge these groups too. |
| Models | One instanced draw per mesh part (prop-models.js `voxI` / `mdlI`, engine/model-instances.js). | Yes | Instance records read from a texture would cut the 13 GL calls a draw (no base instance in WebGL2); later `WEBGL_multi_draw`. |
| Spinning parts | Every spin layer is its own mesh and draw (prop-models.js lowPolyFromRecipe / voxel spin paths), though a model's spin layers share pivot, axis, speed and swing. Copperleaf: windmill 37, gene_bank 30, workshop 10, cottage_solar 6 (2 colours), lighthouse 4, giant swing 3: 96 parts across the map where 7 would do (a frame draws the visible ones). Spinning models are never far-cached. | Partly | Merge spin layers by (pivot, axis, rps, swing) at mesh build (verified: no spin layer has hide, roof, lump or glass); far-cache the still body. |
| Effects | Almost every particle is its own `drawArrays` with 5 uniforms and a texture bind (walk/effects.js quad); each glow another draw. A fountain in view: 6 + 49 + 96 per bowl lip = 151-247 draws, plus 14 spray quads; Copperleaf has 2. Footprints up to 140, not culled. Only the weather uses the instanced `fxW` batch (`weatherBatch`). | **No** | Fountain spray uses the same picture as the weather and matches fxW's maths: one draw. Glows are additive, so instancing them is exact. 11 fx strips into one atlas for the rest. |
| Ground | One draw, but the whole place at 0.5 m: Copperleaf 412 × 340 cells = 280,160 triangles plus a 35,950-triangle far ring, about 587k vertices (corners not shared), never culled; drawn again by the near map, both lamp maps at night and the far map on a miss. About half is sea floor. | Draws yes, geometry no | 16 m tiles with boxes, culled per pass, neighbouring index ranges merged. |
| Grass | Instanced, one draw per visible 8 m chunk. | Partly | Neighbouring chunks are contiguous in the buffer: merge runs (exact). Tens of draws. |
| Townsfolk (Figures off) | Each walk frame its own canvas texture: one draw per person per pass; never culled in the main pass. | Partly | A per-place atlas pays off only with Pictures in batches on. |
| Structures | One buffer, one draw per part, not culled (3 bridges in Copperleaf). | Partly | Small. |
| World map | Land, roads, water one draw each; things instanced per kind; standees from an atlas. | Yes | - |
| Buildings (buildings.js) | One mesh per placement. Not in the game flow (Copperleaf has 0 `build` props). | n/a | - |
Headless Copperleaf (R4, 2026-10-26, an older commit): **853 draws a frame → 274** with every phase 20 switch on.
Turning Pictures in batches on is what gets under the 400 budget. FL-2a measures it again.

## 4. Render layering: the research and this game
**What engines and GPU vendors do.** Unity: Background → Geometry (front to back) → AlphaTest ("more efficient to
render alpha-tested objects after all solid ones") → skybox → Transparent (back to front) → Overlay. PlayCanvas:
World opaque → Depth → Skybox ("after World opaque to reduce overdraw") → transparent → UI. Babylon: depth pre-pass →
opaque → alpha-tested → sprites → particles → blended. three.js: opaque by program, material, then front to back;
transparent back to front. Sort keys (Ericson; Bitsquid): layer | pass | material before depth for opaque, depth
before material for translucent. State-change cost, highest first: render target > program > texture > vertex
format > uniforms.
**Tile GPUs.** Qualcomm (Adreno): a fragment shader that **contains** `discard` (the keyword, even inside an `if` on a
uniform; Mesa's `has_kill` is a compile-time flag) disables LRZ writes for that draw; the LRZ test stays on. Put
`discard` shaders "as near the end of the frame as possible"; opaque front to back; few bins and render passes;
post at lower resolution; D16 depth; `mediump` can double fragment throughput; each draw costs about 2-5 µs per bin.
A blended draw that writes depth disables LRZ writes for the rest of the pass. Arm (Mali): opaque front to back,
then transparent back to front; `discard` forces late depth tests; avoid depth pre-passes; fewer than 500 draws a
frame; clear or invalidate every attachment. PowerVR: opaque, then alpha-tested, then blended. Apple: hidden-surface
removal per tile; discard is slower on old chips.
**Foliage on phones.** Alpha-tested cards cost overdraw and early rejection; trim cards to the silhouette or split an
opaque core from a cut-out rim; one picture for far trees; atlases or texture arrays to batch different leaf
pictures (`MAX_ARRAY_TEXTURE_LAYERS` ≥ 256 on all Android; `WEBGL_multi_draw` on about 96% of Android).
**This game's walk frame today** (walk-view-gl.js drawWalkFrameInner): far shadow map (4096²), near map (1024²), lamp
maps at night (2 × 512²), reflection (half size), then the scene target (RGBA16F + DEPTH24): **sky first** over the
whole screen (`quality.skyLast` off), ground, room front, grass, **about 700 cut-out pictures**, solid props, models,
box faces, buildings, structures, silhouette (depth GREATER and an occlusion query), water, effects; then about 16
post passes (dof, bloom 1 + 4 + 4, AO, rays, fog march 3-4, grade); then a full-screen 2D label canvas.
- **Every depth-writing scene shader contains `discard`** (checked): ground (room hole, wall thinning that is always
  live, rock circle: walk-shaders.js), pictures (cut-out, fade dither, ghost, rise, rock), grass (blade shape), models
  (prop-models.js fade and rock, own-texture cut), solid props, box faces, the fx program. The sky writes no depth.
  So nothing in the scene pass writes LRZ, and phase 20's "Solid things first" (D5 a, +4.3 ms from one sample) could
  not gain: it is no evidence against opaque-first.
- Nothing is depth-sorted; cut-outs come before the opaque models.
- Page side: the WebGL canvas is opaque (`alpha: false`, right); the top bar (blur 12 px) and the bottom bar (7.5 px)
  blur over a canvas that changes every frame, re-done each frame by the compositor on the same GPU; the Actions
  button blurs behind an opaque gold fill (invisible); `#dioui`, a 2D canvas at render size, is cleared and redrawn
  every frame; a second WebGL context (the figure baker) and a never-released probe context exist.
**The better layering** (FL-5a): discard-free opaque (front to back by piece) → cut-outs (box faces, grass, pictures,
fading or rock-circle draws) → sky at the far plane → blended (water, effects; anything blended that writes depth
after every opaque draw) → silhouette and its query last → fewer, merged post passes on phones → the UI with no live
blur over the moving 3D (tinted on phones: the owner's answer).

## 5. Why the set fps isn't held (verified at 73b2f8b1)
1. **Platform caps.** Chrome (and Opera, a Chromium fork) on Android give a main-thread page every other refresh on
   screens above about 108 Hz: `kThrottleMainFrameTo60Hz`, enabled by default on Android (cc/base/features.cc), interval
   0.9 × 2 × vsync (scheduler_state_machine.cc): 120 → 60, 144 → 72, 165 → about 82; 90 Hz is not throttled. Every page,
   touch included; only pointer lock or a main-thread-painted scroll lifts it. Worker rAF with OffscreenCanvas is not
   throttled. iOS (every browser is WebKit): about 60 by default ("Prefer Page Rendering Updates near 60fps"), 30 in
   Low Power Mode, a thermal state or visual idleness. Android battery saver: ≤ 60 for every app. Firefox for Android
   adds no cap (Choreographer vsync as given). Desktop Chrome's Energy Saver: 30. So on the owner's Opera phone the 120
   option gives exactly 60, and Settings' "yours shows about N" is wrong in wording (the screen shows 120; the browser
   gives the page 60).
2. **Frames cost more than the slot, and nothing switches to a steady rate.** At 60, a 25-40 ms frame lands on 2 or 3
   refreshes at random.
3. **Automatic quality** (walk/quality-cull.js adaptQuality, logic/quality-step.js qualityStep):
   - aims at `1000 / min(cap, hz, smooth ? 999 : 60)`: 60 at most unless Balanced (`aim: 'smooth'`). Beautiful (`sharp`)
     is every save's default (logic/saves.js). At 30 or 60 the two presets run the same controller.
   - `work` is timed from the frame's start (walk-view-gl.js `w0`), so it includes normal-map jobs, program polls,
     ground and walking-grid preparation, grass, the near ring and builds, and on Android the graphics waits.
   - On a phone at q ≥ 2 a slow frame goes to the graphics steps and resolution down to 0.6, which can't fix CPU or
     draw-call cost. It steps up only with work under 60% of the slot and the interval under 110%; between those and
     the slow line (85% / 130%) it does nothing, so a phone settles at the floor.
   - Decisions every 0.9-1.2 s from moving averages; a 30 s hold after a failed raise.
4. **Closing a menu takes a quality step down.** While the cap is under 30 adaptQuality sets `int = 0`; the first frame
   after the cap lifts reads the raw gap (about 50 ms after a window, up to 1,000 ms after a screen) as slow. In a Node
   simulation with the real qualityStep, 8 open/close cycles at 11 ms of work ratchet a phone and a desktop to q4.
   The scheduler also keeps the screen's 1 fps `t.next` for up to a second after it closes.
5. **Pacing** (frame-scheduler.js):
   - `t.next = ts - t.next > iv * 2 ? ts + iv : t.next + iv` catches up after a late frame: at a 60 cap on 120 Hz one
     miss gives 16.7, 25, 8.3, 16.7 ms (simulated); three misses give a burst at 120. The tolerance is a fixed 1.2 ms;
     a 61 Hz panel read as 60 drops 5-10 frames in 10 s.
   - `framePace` uses `Math.round(hz / cap)`: 60 on a 90 Hz screen runs at 45, and the ladder (still aiming at 16.7 ms)
     reads every frame as slow and sinks to the floor within about 9 s; 60 on 165 Hz gives 55.
   - The refresh estimate uses only ticks after one with under 3 ms of work, starts at 60, snaps to a list, and freezes
     while every tick works; a later drop (battery saver, thermal) never updates it.
   - At q ≥ 2 (always in battle) shadows and the reflection are both drawn on even frames only: heavy/light frames.
   - Time steps are clamped at 60 ms (walk) and 50 ms (battle): under 16.7 fps the world runs slow (12.5 fps ≈ 75%).
6. **Stalls on the main thread.**
   - Once a second, for every player: `gl.getError` in debugLog.flush (TD-1's design; a flush and round trip), and the
     GPU counters wrap 44 WebGL methods for a whole tick (about 20k calls through a rest-args closure). The counters
     reset only on a tick that drew, so behind a screen every tick is wrapped. The counted frame's time is in `work`.
   - First-use picture uploads (`texImage2D`, `generateMipmap`) inside the sprite pass with no budget; the phone's
     128 MB texture cap evicts by frame count (600 frames) and counts every picture twice.
   - Grass: 12 ms on the first slice and a 4 MB `bufferData` in one frame; a prepared view plants its grass only after
     the swap (map-cache.js). A cache-miss swap runs `buildGroundMesh` in one frame (map-cache.js:521).
   - Each 0.1 resolution step resizes `#dio` and `#dioui` and reallocates the screen-sized targets.
   - Far shadow map 4096² from engine.json on phones (DEPTH24, 64 MiB) plus its 4096² cache copy, blitted back on
     every frame the sun shadow runs (q < 2 and R ≥ 0.8; always in battle, where the size check reads `q`, not the
     effective step): 128 MiB, and a 64 MiB depth copy a frame. Crossing q 2 or R 0.8 re-creates both maps.
   - The far cache's key follows which grid cells are in the view, so turning the camera misses; a miss redraws all.
   - About 1,000 item objects a frame (frame-items.js, prop-models.js leaf items, lighting.js closures): GC pauses.
   - About fifteen timers (audio tracker 25 ms, route sight, ambience, story checks, idle scan ...) and layout reads in
     the frame (`cv.clientWidth`; `safe()` with two `getBoundingClientRect` per exit label).
7. **UI.**
   - Behind full screens the world draws at 24 (20 on a 60 Hz screen) fps for 0.8 s, then 1 fps, each frame full cost;
     behind windows 20; a window over a screen goes back to 20 (walk-control.js cap()). The canvas gets a CSS
     `brightness() blur(0.8px)` and `scale(1.015)` with 0.5-0.6 s transitions (not compositor-only).
   - The theme sheet writes `--g-blur: blur(12px)` (uiTheme.json via ui-theme.js), beating base.css's phone 9 px.
     `prefers-reduced-transparency` clears only `--g-blur`.
   - List rows, `.px`, `.tpanel` and `pb-panel` each carry their own blur: a scroll re-blurs every row.
   - Opening a tab stacks a full `#app` `innerHTML` rebuild, a main-thread mask wipe, every row's entrance (off-screen
     ones too) and the canvas filter transition, while the 3D still draws.
   - Battle: floatTick / platesTick write styles, then read layout, every frame; that time is part of the battle 3D's
     `work`, so it lowers the battle's quality. Battle text is typed on `setInterval(16)`.
   - The bottom bar's shrink animates registered custom properties that drive layout (240 ms, each walk/stop).
   - Below the set fps on purpose: the minimap at 5 fps (its ground steps under the moving world), talk 30, rig
     portraits 20. The hitch counter's 36 ms threshold can't see a missed 60 fps frame.
   - Fine already: touch input (pointer events, `touch-action: none`, no blocking listeners), little `will-change`.

## 6. Sessions
Each session: Plan Mode first (CLAUDE.md), the tiers of docs/TESTING.md, a HANDOFF entry. A new path ships behind its
own switch, off, until the owner's phone run; then on, and the old path deleted in its own commit (phase 20's way).
Counts are checked headless; speed and look only on the owner's phone (the debug log, the Graphics test). Moves into
`logic/` are their own commits, then `npm run modules`.

### FL-0b The owner's phone run (no code)
The Graphics cost test and the Diagnostics on the Android phone with phase 20's remaining switches (Medium precision,
Steady lamps, Phone pixel budget), and a debug log of a Copperleaf walk by day. Says whether the phone is CPU- or
GPU-bound, which orders FL-2's work.

### FL-1a Pacer and ladder bugs (no look change)
1. The refresh period from every tick's delta (a robust minimum or mode; busy ticks still come at whole multiples),
   re-detected on change, not snapped to a list.
2. The setting as a whole number of refreshes; locked to the beat: `next = max(next + T, ts + T - V/2)`, tolerance
   half a refresh, no catch-up.
3. A cap change (window, screen, hidden, back) resets the schedule, the averages and a grace period (the ratchet bug).
4. `work` timed after the one-off jobs; the counted frame left out of the ladder; the counters wrap only ticks that draw.
5. The scheduler exposes each tick's shown interval (in refreshes) and a missed flag (interval > slot + half a
   refresh). TD-4 logs and reads them (no second histogram here).
6. The steady half-rate fallback (the owner's answer) at the pacing level, used by FL-3a's controller.
7. The fps overlay meters `dio` itself; `meter` stops when the overlay closes; a task that throws is retried before
   it is dropped.
8. One phone test for every caller (`/Android|iPhone/` and `/Android|iPhone|iPad/` disagree; iPads report a Mac).
Gates (Node, a vsync-aligned simulation in tools/test/): 120 Hz, cap 60, one miss → 16.7 / 25 / 16.7 with no 8.3; a
61 Hz panel → 0 drops in 10 s; a 120 → 60 change re-detected within 1 s; every frame 40 ms → a steady divisor; 8
open/close cycles at 11 ms → q and R unchanged; 90 Hz at 5 ms of work → no step in 60 s.

### FL-1b Stalls and page quick wins (no look change)
1. `getError`: its time logged per sample first; if it shows, kept to the tests, `?glerr` and the open debug menu.
   Agreed with the test-data track, which owns it (TD-1).
2. The 3D stops at once when a tab opens; a window over a screen stays at the screen's rate.
3. The pixel sky (`bg`) stops while hidden; the Actions button's invisible blur removed (walk-tab.js `.wh-down.glass`).
4. The canvas size from a ResizeObserver; `safe()` once a frame, not per label (its elements are rebuilt by render()).
5. `#dioui` cleared and redrawn only when something was drawn this frame or the last.
6. Shadows and reflection on opposite frame parities.
7. The hitch threshold relative to the slot.
Gates (headless): 5 s behind a screen → ≤ 6 `dio` runs and ≤ 6 wrapped ticks; hidden `bg` runs 0; blurred surfaces
while walking 2 (smoke's blur counter); label clears with no labels 0; quick-check screenshots unchanged.

### FL-2a Pictures: the draw budget
1. The three fixes found in review: (a) drawSpriteRuns sets `R.on = false` for a picture with blades or hands even
   when nothing was drawn, so the instanced program can stay bound; (b) a crossing tree with a hit flash or rise
   dither loses its crossing picture; (c) reflectionRecord has no `r.fig`, and the plain reflection ignores `it.im.uv`.
2. Pictures in batches and Sky last on by default (the owner's answer). Old paths kept one release: an automatic
   switch-off on a GL error after the first batched frame, and a debug-menu toggle (players have no Settings switch).
3. Sort by texture id (cached on the image) instead of `imageId`: fewer runs, and no WeakMap lookups in the sort.
4. `contactAO` once per picture on the CPU (a JS twin of webgl.js's 64-step loop over the frame's AO list), as a
   uniform in the plain path and an instance value in the batched one: same look, a CPU twin test. (Not in the vertex
   shader: the Frame block's precision differs between stages and would fail to link.)
Gates: Copperleaf by day ≤ 400 draws and a uniform-call ceiling (Copperleaf added to TD-3's check-perf, or the
Diagnostics station until it exists); quick-check screenshots unchanged.

### FL-2b Effects, spins, grass and same-look GPU cuts
1. Fountain spray and particles through the existing `weatherBatch` (instances draw in call order, so blending is the
   same); glows as one additive instanced draw; the 11 fx strips into one atlas.
2. Spin layers merged at mesh build; spinning models' still bodies in the far cache, only their spin parts drawn.
3. Neighbouring grass chunks merged into one draw.
4. The far map's 4096² copy skipped on frames when nothing in it moved; the reflection skipped when no water is on
   screen (a stub texture for the water).
5. `depth: false` on the canvas context, after checking the Studio draws nothing depth-tested to the canvas itself.
6. Per-frame item objects pooled with one fixed shape (phase 20 C2's item pool), leaf items made only for visible
   models; `mapCacheKey` without a string a frame.
Gates: effects at Copperleaf's square ≤ about 20 draws; one spin mesh per model (unit test); the log's `alloc` down;
screenshots unchanged.

### FL-3a The controller: aim at the set fps
A pure function in `logic/` (like quality-step.js) with Node tests on recorded and synthetic traces, behind the
existing `adaptQuality(dtm, work)` seam (the Studio swaps it with setAdaptQuality).
1. Target = the interval the scheduler delivers, for every preset; the preset only orders the levers.
2. Per-frame ring buffers (typed arrays, about 120 frames) of interval, render cost and fence lag; p90 and the missed
   share, not averages. Frames with a load, a compile, an upload burst or counting are left out.
3. Down fast: 2 missed in a row, more than 5% missed in 1 s, or p90 over 90% of the slot. Up slowly: 3-5 s with no
   misses and p95 under 70%. A raise that misses within 5 s is reverted and held, the hold doubling each time.
4. Bottleneck: GPU-bound when fence lag is 2 frames or more (bench-walk.js measures it), or misses with work p90 under
   60% of the slot; CPU-bound when work p90 is over 80% with low fence lag.
   - GPU levers: resolution, AO, blur, rays, fog march, bloom levels, then the 2048 far map.
   - CPU levers: far small props and townsfolk (`quality.phonePropDistance`, `minPropPx`, the folk cap), shadow-caster
     distance, grass, lamps, one-picture far trees once FL-5b has them. (The owner allowed these on phones.)
5. At the floor and still missing: the steady half rate; back up when the faster slot has room.
6. The level remembered per place kind, device-local (localStorage, never the save); a thermal hold (two step-downs in
   about 2 minutes freeze climbing for a few minutes).
7. The battle's ladder (battle-stage.js) joins it, with DOM time left out.
8. The world clock in fixed steps, so a slow frame doesn't slow the world.
Gates (Node): one-off spikes → no step; a sustained miss → a step within 1 s; at most 1 revert in 30 s; a GPU-bound
trace moves only GPU levers; a CPU-bound trace leaves resolution alone. Phone: Copperleaf by day and a run route hold
the set rate or the steady half rate with under 2% missed frames, on TD-2's path run with automatic quality on.

### FL-3b Resolution without hitches (behind a switch)
Fewer, larger resolution steps with hysteresis; the canvas resized only at fades or behind menus; render targets
reused while the size class holds. (A full-size canvas with a viewport inside would make the grade pass and the
compositor work at full size and hold targets at their largest against the 300 MB budget: not that.) Gate: 0
render-target reallocations from the ladder during a walk.

### FL-4 Even frames: arrivals and crossings (with the load track)
Grass planted with the prepared view and uploaded in strips (no 12 ms first slice); the cache-miss ground build
sliced; LD-5's one-off budget sized from the slot (today 8 ms on phones, 10 elsewhere, whatever the rate); the far
shadow cache keyed by the cells under its fit square, not the view; the periodic timers moved into free ticks; ground
painting slices on `scheduler.postTask` (background) with a fallback; picture texture age by time. Ask first: these
overlap LD-5's leftovers (model meshes in a worker, `createImageBitmap` and the upload queue, the next place's
warm-up).

### FL-5a Draw order and discard (behind a switch)
1. Discard-free variants of the opaque programs (a `#define` or the existing exact-once edit helpers:
   shader-precision.js, prop-models.js asFlatInputs, spriteInstanceFragment). The discard variant only for fading
   instances (split into their own draw), frames with the rock circle on, a room hole, and the ground's thinned walls
   (their own index range).
2. Order: discard-free opaque → cut-outs → sky → blended → silhouette and query last. Coplanar pictures on model faces
   and box-face edges checked against the old order.
3. Every variant in the precompile list. Gates: 0 new late compiles (TD-3); link time on iOS logged; ABAB on the phone
   with at least 3 runs per arm and per-pass timings.

### FL-5b Phone GPU look trades (the owner's answers)
1. The far shadow map at 2048 on phones from the first frame (brings the 307-322 MB estimate under 300 MB); the
   battle's far map follows the effective step without re-creating the maps at each battle.
2. One-picture far trees: a crown picture baked per tree kind (tools/bake-pixel-facts.mjs), drawn instead of its
   clumps past a distance, with a dithered crossfade.
3. The ground in 16 m tiles culled per pass.
4. The post chain merged on phones: AO's blur inside AO, the bright pass into the first downsample, linear depth once.

### FL-6 Fluid UI
1. The world frozen behind full menus and windows (the owner's answer): one last frame, then nothing until you
   return. The world's simulation runs inside the draw, so the game pauses while a window is open; any window that
   needs the world moving is listed in the plan and asked about.
2. The canvas's dim and blur baked into that last frame; no CSS filter transition on `#dio`.
3. On phones while walking, the top and bottom bars tinted with no backdrop blur (the owner's answer).
4. Battle plates: every read first, then every write; their time apart from the 3D's quality.
5. HP, XP and progress bars as an inner fill moved with `transform` inside its frame (not `scaleX`, which would
   squash the angular bars); visual check.
6. Only rows that start on screen animate in; `content-visibility: auto` on long lists; targeted updates on Bag and
   Settings taps instead of a full `#app` rebuild (with `track/ui`).
7. The minimap's ground panned by `transform` every frame, its marks at 5 fps; talk and battle text on the frame task.
8. Font preloads: Pixelify Sans preloaded, the unused jersey preload dropped.
9. Measured in the debug log: Event Timing (tap to paint) and LoAF render and style time, with TD-4.
Principle: compositor-only animations (transform, opacity) keep the full refresh rate even where Chrome holds the
page's own frames to 60, so UI motion can stay smooth while the 3D works.
Gates: battle frames ≤ 1 layout and style recalculation (CDP counters); tap to paint on Bag and Settings logged.

### FL-7 Close-out
The owner's phone runs; switches on and old paths deleted, one commit each; phase 20's remaining switches decided
(its tag `phase-20-done`); docs/TESTING.md and README; tag `fluid-done`.

About 11-12 sessions. Order: FL-0b → FL-1a → FL-1b → FL-2a → FL-2b → FL-3a → FL-3b → FL-4 → FL-5a → FL-5b → FL-6 →
FL-7; FL-6 may start after FL-1b. FL-2 and FL-4 share shadows.js and webgl.js: one after the other, not side by side.
With the test-data track: lane rules for debug-log.js and tools/read-debug-log.py (additions only, merged by hand).

**Honest expectation.** At 13-17 fps no controller can hold 60. FL-1 and FL-3 give a steady rate early (the setting
or half of it); 60 in Copperleaf on the phone needs FL-2's draw cuts and FL-5's GPU savings. 120 works only where the
browser gives 120: Firefox on Android without battery saver, desktop browsers on fast screens, iOS with Safari's flag
off.

## 7. Ask me before
- **The Settings wording for the rate the browser gives.** Recommendation: "Your browser gives the game about N a
  second" and, when N ≤ 60, a short note that this browser or battery saver holds pages to 60; 120 kept, not greyed
  (the estimate reads 60 until enough samples).
- **A setting between divisors** (60 on a 90 Hz screen: 45 or 90). Recommendation: the higher one while the controller
  holds it, else the lower.
- **Balanced vs Beautiful.** Recommendation: one target for both; the preset only orders the levers (Beautiful lowers
  resolution last).
- Fewer bloom levels on phones. Recommendation: 3 levels from quarter size, measured first.
- The leaf-clump atlas (phase 21's scope; memory against the 300 MB budget). Recommendation: one atlas per tree kind
  with 2-4 px gutters, normal maps baked with it.
- The bottom bar's shrink rebuilt on transforms (UI-8b's glide). Recommendation: measure its style and layout time
  first.
- HUD glass beyond the tinted bars: an engine-made blur under the bars from the bloom chain's small targets (keeps the
  frosted look at almost no cost); the 12 → 9 px phone blur fix; `prefers-reduced-transparency` clearing every blur.
  Recommendation: the 9 px fix and the reduced-transparency fix now, the engine-made glass later if tinted reads flat.
- FL-4's items to the load track (LD-5) or here. Recommendation: here, with LD-5's owner told, since the budget must
  follow the set rate.
- Phase 20's remaining decisions and its tag moving to `track/fluid`. Recommendation: yes, at FL-7.
- Whether FL sessions start each other in new sessions, as the test-data track's do. Recommendation: yes after FL-1b.

## 8. Not in this track
- OffscreenCanvas rendering in a worker: the only way past Chrome's 60 Hz cap on Android (worker rAF isn't throttled
  today), but a large change (hooks.js shared state, input, the DOM UI) and Chrome could throttle it too.
- Compressed textures (KTX2, ASTC) and atlases of every picture: phase 21.
- The headless perf gates themselves (TD-3) and the richer log and its reader (TD-4): the test-data track.

## 9. Risks
- Only the owner's phone shows speed; headless draws in software. Counts are gated headless, milliseconds are notes.
- Thermal drift (an Adreno 650 lost about 22% at equilibrium): ABAB runs with repeats.
- Discard-free variants double the opaque programs: compile time behind loaders, late compiles.
- Freezing the world behind windows pauses the game there; a window that shows the world must be found first.
- Pictures in batches has no Settings switch for players: the automatic fallback must work.
- Lowering the once-a-second debug costs could hide errors the owner relies on: measure first, agree with TD.
- The 853 → 274 and 643 → 94 counts are from an older commit (the instance stride was 92 bytes, now 100).

## 10. Sources
Render layering and tile GPUs:
[Qualcomm Adreno best practices](https://docs.qualcomm.com/bundle/publicresource/topics/80-78185-2/mobile_best_practices.html)
([Markdown](https://docs.qualcomm.com/bundle/publicresource/80-78185-2/topics/mobile_best_practices.md)),
[Mesa freedreno LRZ](https://docs.mesa3d.org/drivers/freedreno/hw/lrz.html),
[Igalia: Adreno LRZ](https://blogs.igalia.com/dpiliaiev/adreno-lrz/),
[Mesa MR 5298](https://gitlab.freedesktop.org/mesa/mesa/-/merge_requests/5298),
[Arm GPU best practices](https://documentation-service.arm.com/static/67a62b17091bfc3e0a947695),
[Arm: post-processing on mobile](https://developer.arm.com/community/arm-community-blogs/b/mobile-graphics-and-gaming-blog/posts/post-processing-effects-on-mobile-optimization-and-alternatives),
[PowerVR: do not use discard](https://docs.imgtec.com/starter-guides/powervr-architecture/html/topics/rules/do-not-use-discard.html),
[Meta: loads, stores and passes](https://developers.meta.com/horizon/blog/loads-stores-passes-and-advanced-gpu-pipelines/),
[MJP: to early-Z or not](https://therealmjp.github.io/posts/to-earlyz-or-not-to-earlyz/),
[Unity rendering order](https://docs.unity.com/en-us/engine/6000.0/manual/cameras/built-in-rendering-order.md),
[Unity SRP Batcher](https://docs.unity3d.com/2021.3/Documentation/Manual/SRPBatcher.html),
[PlayCanvas layers](https://developer.playcanvas.com/user-manual/graphics/layers/),
[three.js WebGLRenderLists](https://github.com/mrdoob/three.js/blob/dev/src/renderers/webgl/WebGLRenderLists.js),
[Ericson: order your draw calls](https://realtimecollisiondetection.net/blog/?p=86),
[Bitsquid sorting](https://bitsquid.blogspot.com/2017/02/stingray-renderer-walkthrough-4-sorting.html),
[Beyond Porting](http://media.steampowered.com/apps/steamdevdays/slides/beyondporting.pdf),
[Linux a7xx catalog (GMEM)](https://raw.githubusercontent.com/torvalds/linux/master/drivers/gpu/drm/msm/adreno/a7xx_catalog.c),
[MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices),
web3dsurvey: [multi_draw](https://web3dsurvey.com/webgl2/extensions/WEBGL_multi_draw),
[parallel shader compile](https://web3dsurvey.com/webgl2/extensions/KHR_parallel_shader_compile),
[timer query](https://web3dsurvey.com/webgl2/extensions/EXT_disjoint_timer_query_webgl2),
[array layers](https://web3dsurvey.com/webgl2/parameters/MAX_ARRAY_TEXTURE_LAYERS),
[ASTC](https://web3dsurvey.com/webgl2/extensions/WEBGL_compressed_texture_astc).
Frame pacing and caps:
[Chromium cc/base/features.cc](https://chromium.googlesource.com/chromium/src/+/main/cc/base/features.cc),
[features.h](https://chromium.googlesource.com/chromium/src/+/main/cc/base/features.h),
[scheduler-bugs thread](https://groups.google.com/a/chromium.org/g/scheduler-bugs/c/Aad5Qm3XbeE),
[WebKit 294338](https://www2.webkit.org/show_bug.cgi?id=294338), [WebKit 215745](https://bugs.webkit.org/show_bug.cgi?id=215745),
[Chrome Energy Saver](https://developer.chrome.com/blog/memory-and-energy-saver-mode),
[When browsers throttle rAF](https://motion.dev/blog/when-browsers-throttle-requestanimationframe),
[Android frame pacing](https://developer.android.com/games/sdk/frame-pacing),
[Android thermal (ADPF)](https://developer.android.com/games/optimize/adpf/thermal),
[Unity Adaptive Performance](https://docs.unity3d.com/Packages/com.unity.adaptiveperformance@4.0/manual/user-guide.html),
[Long Animation Frames](https://developer.chrome.com/docs/web-platform/long-animation-frames),
[V8 parallel scavenger](https://v8.dev/blog/orinoco-parallel-scavenger),
[WebGL 2 spec](https://raw.githubusercontent.com/KhronosGroup/WebGL/main/specs/latest/2.0/index.html),
[loading images without jank](https://webglfundamentals.org/webgl/lessons/webgl-qna-how-to-load-images-in-the-background-with-no-jank.html).
UI over a WebGL canvas:
[compositor-only properties](https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count),
[smoothness](https://web.dev/articles/smoothness), [backdrop-filter](https://web.dev/articles/backdrop-filter),
[animations and performance](https://web.dev/articles/animations-and-performance),
[content-visibility](https://web.dev/articles/content-visibility), [INP](https://web.dev/articles/optimize-inp),
[non-composited animations](https://developer.chrome.com/docs/lighthouse/performance/non-composited-animations),
[animated blur](https://developer.chrome.com/blog/animated-blur),
[aligning input events](https://developer.chrome.com/blog/aligning-input-events),
[GPU compositing in Chrome](https://www.chromium.org/developers/design-documents/gpu-accelerated-compositing-in-chrome/),
[backdrop-filter feature](https://github.com/mfreed7/backdrop-filter-feature),
[Mozilla bug 1828248](https://bugzilla.mozilla.org/show_bug.cgi?id=1828248),
[three.js rendering on demand](https://threejs.org/manual/en/rendering-on-demand),
[Unity on-demand rendering](https://unity.com/en/blog/technology/how-on-demand-rendering-can-improve-mobile-performance).

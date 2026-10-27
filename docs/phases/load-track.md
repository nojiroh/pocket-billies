# Load track: no hitching at the start and when loading

Branch: track/load

The owner's brief (2026-10-26): "Create a plan to speed up loading especially at the start of the game, the player
shouldn't notice any hitching. Do research online." Planned and researched in one session (LD-0 built in it too, on
`ccr-3df446bb-9jvdvq` at the owner's word, since `track/load` didn't exist yet); later sessions start on `track/load`.

## The owner's answers (2026-10-27)
- **The goal is 33 ms**: no frame over 33 ms anywhere once the title shows, loading screens included (not the
  plan's suggested 50 ms). So hiding work behind a fade isn't enough: heavy work moves to workers, or is cut into
  slices that fit a frame, and loading screens animate in ways a busy main thread can't freeze.
- Debug-log screenshots: **only when the log is exported** (no timed ones).
- The bundle: **test and debug code loads only when used**, and the bundle is **minified with its source map** (so a
  stack trace in a debug log can still be read back to the code).
- Picture facts (grass lightness, leaf cuts, outline colours): **baked at build time** from the art files.
- Pictures: **loaded per place, fetched ahead**, not every picture in the game at boot.
- A run's world: **generated in a worker, starting when the run is picked** at the mast.
- Branch `track/load`, made by the owner.

## What the game does today (measured and checked in the code, 2026-10-26, at 2bfe6cad)
Measured headless on the built site (`npm run build`, dist/), a phone-sized page with software drawing
(SwiftShader). Software drawing makes everything several times slower than a phone, so the milliseconds rank the
causes; the owner's phone log gives the real numbers (LD-0).
- The title shows after about 2 s. In the 25 s after that, sitting on the title: frames of 0.4, 4.0, 9.2 and 5.9 s.
- The CPU profile of that boot, by function (self time): `screenSnapshot` 5.2 s, `finishProgramCompile` 5.2 s,
  `pictureLightness` 4.6 s, the ground mesh steps 2.7 s (already sliced). A boot that resumes a run (`?fixture=run`):
  `leafCut` 5.7 s, `screenSnapshot` 3.8 s, `pictureLightness` 2.9 s, `portraitURL` 2.2 s, the run's scenes 1.3 s, the
  world map's terrain 1.2 s.

The causes, with where they are:
1. **The debug log's picture.** `debugLog` asks for a picture 15 s after boot and every 60 s after
   (debug-log.js 284-288); `screenSnapshot` (engine/post-effects.js 740) blits and `readPixels` in the frame (the GPU
   must finish everything first), then `toDataURL('image/jpeg')` on the main thread (walk-view-gl.js 854-862).
2. **Shaders.** The first walk mount compiles 20 programs on the spot (`WALK_SHADERS` 10, `POST_EFFECT_SHADERS` 10,
   walk-view-gl.js 315-316); `compileProgram` (engine/webgl.js 502) reads `COMPILE_STATUS` after each compile and
   `LINK_STATUS` after the link, and each read waits for the driver. About 22-24 more are started in the background
   and finished one a frame (`pollPendingPrograms`), which helps only where `KHR_parallel_shader_compile` really works:
   iOS exposes it, but its Metal backend still links on the calling thread (WebKit bug 251514). The opening fall
   (opening-fall.js 116-117, 658) and the world map (world-bowl.js 2567) compile on the spot too. About 43-46 in all.
3. **Pixel reads on first draw.** `pictureLightness` (walk/sprites.js 1066) and `leafCut` (prop-models.js 1706) draw a
   picture into a canvas and `getImageData` it the first time a grass prop or a tree is drawn; a GPU-backed canvas
   makes that a read-back. More `getImageData` without `willReadFrequently`: art.js 104, walk-view.js 796,
   walk/sprites.js 786, skeleton-rig.js 522 and 668, buildings.js 312, solid-props.js 317 and 789, person-art.js 410
   and 863, walk/ground-textures.js 265.
4. **Portraits as PNG text.** `portraitURL` (person-art.js 952) draws a portrait and `toDataURL()`s it (a PNG encode on
   the main thread) the first time the top bar shows that face.
5. **The loader loads every picture in the game.** `loadList` (boot.js 193-222) takes the icons, every species' rig
   sheets, `mapArtPaths` of all 43 maps (test maps too), every prop, terrain and wardrobe picture: about 1,150 PNGs,
   2.4 MB, each `decode()`d. The textures are then uploaded (with `generateMipmap`) on first use, so the first frames
   in a place upload many (engine/webgl.js 980-988).
6. **The run's scenes.** `runWorldMake` (run-world.js 125-170) checks its 8 ms budget only between whole scenes;
   `mapgenScene` takes 18-600 ms a scene in Node (0.95-1.5 s a run; the file's "about 30 ms each" is wrong), several
   times that on a phone. `runWorldPutRun` (216-276) then runs in one go.
7. **Several frame budgets that add up.** Ground prep 4 ms on phones (walk/walk-state.js 72, doubled when urgent),
   model meshes about 12 ms (prop-models.js 1590-1600, voxelised and greedy-meshed on the main thread), townsfolk
   frames 3 ms, solid props at least one a frame, buildings their own budget: together they can pass 33 ms.
8. **The page itself.** 37 blocking stylesheets (301 KB), 11 blocking classic scripts (484 KB without the data), the
   data (gamedata.js 794 KB), one bundle of 3.6 MB unminified that includes self-test.js (180 KB), the benches,
   fixtures and the debug menu. copperleaf.json (703 KB) is awaited before the loader's bar starts counting
   (boot.js 984). Firebase's three compat scripts load at boot (account.js). The service worker (sw.js) has no
   precache: the app is network-first.
9. **Unmarked boot.** `debugLog.hook()` runs after the loader (boot.js 987), so stalls while loading have no names;
   the longtask observer runs from the start but only counts.

Claims corrected: CLAUDE.md's "gamedata.js is a ~13 MB file, ~8 MB of it scenes" is out of date. It is 0.79 MB; the
maps' ground and props are in data/maps/<id>.json, fetched per map (map-files.js), and data/legacy isn't loaded. The
debug log's "f" frames in the profile are its timing wrappers (debug-log.js 962, 1040), not costs of their own.

Already done elsewhere and kept: phase 20's warm-up behind the place-load fade (H5, `quality.warmUp`), late-compile
counts (`gpuState.pcl`), the frame histogram (`walkRenderer.hist`), the normal-map and ground-paint workers. This
track owns loading and changing places; per-frame rendering cost stays in phase 20.

## The research, in short
- **Data**: `JSON.parse` of a string is 1.5-1.7x faster than the same object literal for data over about 10 KB (V8
  7.6). Small here now (0.79 MB); fetching the data as JSON does the same.
- **Shaders**: compile everything, then link everything, then check the link status only; read a compile log only
  when a link fails. With `KHR_parallel_shader_compile` poll `COMPLETION_STATUS_KHR` across frames. On iOS that still
  blocks, so compile while nothing animates on the main thread, one program a frame at most. Draw each program once
  before the player sees it (three.js `compileAsync` plus one render; Babylon `executeWhenReady`). Chrome keeps
  linked programs in its GPU disk cache, so a second visit is faster.
- **Textures**: decode with `createImageBitmap` (off the main thread, also in workers, Safari 15+), allocate with
  `texStorage2D`, upload a few a frame and draw them once behind the fade. Compressed GPU formats (KTX2/Basis) blur
  pixel art: not taken.
- **Main thread**: a job queue in `requestAnimationFrame` with a few ms a frame is the only scheduler that works the
  same on Safari (no `scheduler.yield`/`postTask`; `requestIdleCallback` unreliable). Workers with transferable
  `ArrayBuffer`s move meshes and generated data without copying (a posted object is copied again). OffscreenCanvas
  WebGL in a worker (the whole renderer) is too big a change, and buggy on Safari: not taken.
- **Loading screens that can't freeze**: CSS `transform` and `opacity` animations run on the compositor thread and
  keep moving while the main thread is busy (Chrome and Safari; LD-3 checks it on the owner's phone); a canvas drawn
  in `requestAnimationFrame` freezes.
- **Startup**: a service worker that precaches a versioned file list serves repeat visits with no network, and V8
  keeps a full code cache for scripts a service worker cached at install. GitHub Pages sends gzip (no Brotli, no
  custom cache headers, `max-age` 600), so the service worker is what controls caching. Measure with frame times
  from `requestAnimationFrame` (works on iOS) plus Long Animation Frames where Chrome has them.
- **Audio**: the synth's start is cheap here (no decoding); nothing to do unless the phone log says otherwise.

## Sessions
Each change ships behind its own setting (`load.*`, on in the game after the owner's phone check), so a bad one can
be switched off from the debug menu. Each session: lint, type-check, unit tests and smoke after each change, the load
check (LD-0), the full quick check at its end, a HANDOFF entry, tag `ld-N-done`.

- **LD-0 the plan and the measure** (this file, ROADMAP, BRANCHES). The debug log names stalls from page start (the
  boot's stages marked before `debugLog.hook`), keeps a **hitch list** (every frame over 33 ms from the title on,
  with its blame, the place and what was loading) and a **boot timeline** (page start, scripts run, data, maps,
  pictures, first frame, title, the loader gone) in its report. A headless load check
  (`tools/check-load.py`) boots the built site to the title and on a run, and prints the long frames, the late
  compiles and the timeline; picture-free, so it can run in CI as a note first and a gate once LD-1-LD-3 are in.
  The owner's phone baseline: Export debug log after a cold start (and once after a run start).
  **Done 2026-10-27** on `ccr-3df446bb-9jvdvq`: `debugLog.stage` and `debugLog.boot` (the stages: debug log, page
  parsed and loaded, modules ran, world in, maps ahead, each picture phase, title on, first walk frame, loader ready,
  scene ready, loader gone, run loading and run loaded), the hitch list (`debugLog.hitch`: a requestAnimationFrame of
  the log's own from page start; each held frame with its blame, screen, scene and stage; counts by 36-50, 50-100,
  100-250 and 250+ ms) and Chrome's long animation frames (`debugLog.loaf`, matched to the hitches in the export).
  The exported log has `boot` (the stages, the page's timings, files by kind: count, KB, from cache) and `hitches`.
  `debugLog.hook()` now runs before the loader (boot.js), so the loader's stalls have names. `tools/check-load.py`.
  First headless run (software drawing, 2026-10-27): a new player's boot, 28 held frames, 13 after the loader went
  (the longest 8.1 s, finishing a shader); a run's reload, 39 (the longest 7.4 s, drawing items and reading the
  picture back). Shaders compiled late: 0 (they are all on the list; they just block when finished).
- **LD-1 the quick wins** (no change in looks). The debug log's picture is taken only on export. A build step
  (tools/build-data.mjs or a new `tools/bake-pixel-facts.mjs`) bakes each grass picture's lightness, each leaf
  picture's outline colour and the leaf cuts' boxes into the data, so `pictureLightness` and `leafCut` read numbers
  (the Studio, editing pictures, keeps the old way for an edited picture). `willReadFrequently` on every canvas that
  is read back. Portraits drawn as `toBlob` object URLs (or the canvas itself), not PNG text.
  **Done 2026-10-27** on `ccr-3df446bb-9jvdvq`: the timed picture gone (exportDebugLog takes one); the maths moved to
  game/js/logic/pixel-facts.js; `npm run bake:pixels` (tools/bake-pixel-facts.mjs) writes the 260 leaf cuts to
  game/art/scene/next/cuts/ (456 KB: RGBA, larger than the 194 KB of crowns they come from, which the game no longer
  loads for them) and game/data/pixelFacts.json; prop-models.js `propModelImageItems` uses a baked cut before it
  needs the crown, walk/sprites.js `pictureLightness` the baked number; the Studio's painted (`_ver`) pictures and
  moved clumps still cut in the page. tools/test/pixel-facts-real.test.mjs fails on a stale bake. Claim corrected:
  most read-back canvases already had `willReadFrequently`; the four that didn't (both fallbacks, `coatAtlas`, the
  portrait's) have it. Headless after LD-1: a new player's boot 17 held frames (28 before), 7 after the loader;
  every long one is "finishing a shader".
- **LD-2 shaders.** Every program the game flow can need starts compiling at boot (one list, engine/webgl.js), status
  read only after the link and only if it failed; finished one a frame behind the loader; the opening fall's and the
  world map's programs join the list. Each finished program drawn once off screen. Goal: `pcl` stays 0 on a tour of
  the hub, a run, a battle and the Map tab.
- **LD-3 booting.** The loader's animation becomes compositor-only CSS (it can't freeze), its bar counts copperleaf.json
  too. Pictures: the hub's and the UI's only at boot, decoded with `createImageBitmap`; every other place's pictures
  load during its fade and are fetched ahead (the seams' and the run's next nodes); GPU uploads from one queue with a
  budget a frame. The bundle minified with its source map; self-test, the benches, fixtures and the debug menu's
  heavy parts behind a dynamic `import()` (vite.config.js's one-bundle rule kept for the rest). Firebase after the
  world shows. The service worker precaches the versioned app files and serves them cache-first (the cache named by
  the version, as now). Stylesheets: those the title doesn't need load after it.
- **LD-4 the run's start.** The run's scenes made in a worker (logic/ is plain code; the Studio already has a logic
  worker, studio/js/logic-worker-modules.js), starting when the run is picked at the mast, so they are often ready
  before the train reaches the tear; the results posted back as transferable arrays where they are big.
  `runWorldPutRun` split into steps under the frame budget. The carriage screen stays up only until the landing is
  ready.
- **LD-5 moving between places** (seams, rooms, battles, the Map tab). One frame budget shared by every job queue (the
  ground, models, people, solid props, buildings, uploads), so their sum stays under the 33 ms. Model meshes
  (voxelise, greedy mesh) in a worker, the buffers transferred. The next place's pictures, programs and meshes warmed
  before you reach its seam. The world map's terrain (2048x2048) built in a worker. Anything still over the budget
  in the hitch list after this gets its own fix here.
- **LD-6 the phone check.** The owner's phone runs (cold start, a run's start, a walk across seams, a battle, the Map
  tab); the hitch list empty or explained; the settings on by default; the load check a gate in CI; the quick check's
  baseline updated; HANDOFF; tag `load-done`.

About 6-8 sessions. LD-1 and LD-2 can run in parallel (different files); LD-4 and LD-5 too, after LD-3.

## Risks
- iOS links shaders on the main thread whatever we do: each program costs its link time once a boot. The fix is to
  do it while only CSS animates, one a frame, and to keep programs few. If one program alone passes 33 ms on the
  owner's phone, it has to be split or simplified (that goes to phase 20, asked first).
- Loading pictures per place makes a missing picture possible where all were loaded before: the load check walks
  the hub, a run and a battle and fails on a picture asked for but not loaded.
- A worker for the run's scenes must give exactly the same world as today's code for a seed (the golden record, RL-2,
  and the run fixture's checks prove it).

## Ask me before
- Changing the look of anything (none of this should; a session that finds it must, asks).
- Dropping a program or a graphics feature to fit the budget.
- Making the loader's look different from today's (LD-3 changes how it animates, not what it shows).
- Turning a `load.*` setting on by default before the owner's phone check.

## Sources
- https://v8.dev/blog/v8-release-76 (JSON.parse vs object literals)
- https://v8.dev/blog/code-caching-for-devs (code caching, service workers)
- https://registry.khronos.org/webgl/extensions/KHR_parallel_shader_compile/
- https://bugs.webkit.org/show_bug.cgi?id=251514 (iOS: parallel compile still blocks)
- https://discourse.threejs.org/t/reduce-first-render-lag-renderer-compileasync-is-not-doing-anything/86191
- https://forum.babylonjs.com/t/shader-pre-compilation-demo/53865
- https://discourse.threejs.org/t/is-there-a-way-to-await-webglrenderer-inittexture/26503
- https://bugs.webkit.org/show_bug.cgi?id=211484 (createImageBitmap options in Safari)
- https://developer.chrome.com/blog/use-scheduler-yield
- https://bugs.webkit.org/show_bug.cgi?id=268152 (requestIdleCallback in Safari)
- https://developer.chrome.com/docs/web-platform/long-animation-frames
- https://purplesyringa.moe/blog/webp-the-webpage-compression-format/ (GitHub Pages compression)
- https://developer.playcanvas.com/user-manual/assets/preloading-and-streaming
- https://threejs.org/docs/pages/KTX2Loader.html (why not compressed textures for pixel art)

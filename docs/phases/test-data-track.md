# Test data track (TD) - tests and logs that tell Claude what is wrong, on every device

Branch: track/test-data

A side track. The owner asked (2026-10-29), after a Firefox phone log with the page reloading in the middle of the
graphics test: "Check other things in the graphics test that could be better tested in a similar way. Rework all
tests to see what can be improved to give you actually useful test and debug data. Do extensive research online."
Earlier in the same talk: "The graphics test makes the character stand still and doesn't really test some things like
water while standing at water or see through while not standing behind things." TD-0 (this file, docs only) was
written on `ccr-b95ade74-f8w3vy`; every later session works on `track/test-data`, made from that branch by TD-0's
session at the owner's word (2026-10-29).

**Status:** TD-0 done (2026-10-29). Next: TD-1.

Before editing, every session checks the facts it relies on against main and says in its HANDOFF entry what differs:
they come from read-only audits on 2026-10-29 (main at a90c9301; this file written at 8e37809c). Line numbers drift;
find lines by their text.

## Contents
1. The owner's answers
2. The log that started it
3. What the tools do today (audit)
4. The research, in short
5. Sessions
6. Ask me before
7. Not in this track
8. Risks
9. Sources

## 1. The owner's answers (2026-10-29)
Sessions act on these without asking again.
- **Graphics memory budget on phones: 300 MB** (the game's own estimate, `gpuMemory()`). A preset or a test step that
  would go over it is lowered or skipped ("over budget"), never run into a reload.
- **Perf gates block**: a headless check fails when draw calls, instances, late shader compiles or estimated graphics
  memory rise more than **10%** over the committed baseline (late compiles: any rise). Milliseconds stay notes.
- **The test that reloaded** was the per-setting **Graphics test** (`game/js/graphics-test.js`), preset Beautiful,
  battery saver on.
- **Branch** `track/test-data`.
- **Sessions run on their own** (the owner, 2026-10-29: "Start TD-1 in a new session. Start every step after this
  automatically in a new session."): each session plans, then builds without waiting for approval (this answer is
  the approval), and at its end starts the next session (create_session, branch `track/test-data`) with the same
  instructions. An "Ask me before" item is still asked: the session ends its turn with the question and options
  instead of deciding. The last session (TD-5) starts none.

## 2. The log that started it
`pocket-billies-debug-20261029-0952.json` (kept out of git, docs/TESTING.md privacy). Firefox 159, Android 17, Adreno
650, DPR 4, 360x780, battery saver on, Beautiful, deploy a90c9301.
- Full test 44 of 45 ok. "Light lab: the land, a room, props, the air": 1 draw call refused by WebGL (drawArrays,
  1282 = INVALID_OPERATION). The step's context reads `w:copperleaf* (loading)`, which is wrong (section 3.3).
- Copperleaf walking 15-18 fps average, 10th percentile 2-7 fps; rooms 45-58 fps. Top slow-frame labels: "drawing
  items" (524 frames), "drawing sprites", "drawing silhouette", "working out where you can walk" (worst 1651 ms),
  "building the ground mesh" (worst 5070 ms), "outside the marked steps" (worst 2771 ms). 71 frames over 250 ms.
- Estimated graphics memory about 540 MB (ground 217, render targets 186, pictures 84, meshes 24). No heap figure
  (Firefox has no `performance.memory`). No GPU time (no timer queries on any phone browser, section 4).
- The page reloaded during the Graphics test; nothing of that run reached any log.
- `tools/read-debug-log.py` printed "Full test: no result" although the log holds all 45 steps (section 3.4).

## 3. What the tools do today (audit, 2026-10-29)

### 3.1 The per-setting Graphics test (`game/js/graphics-test.js`)
- About 392 steps: the shaders, one step per ENGINE_SPEC row (`graphicsDialSteps`, each at an extreme value such as
  resolution 1.5, shadowMap 4096, grass density 3), 2 graphics presets, 6 engine presets.
- Every step rebuilds `test_graphics` from scratch (`G.walkView.id = null`), stands on the arrival spot (30,3) facing
  north, waits 0.5 s and counts frames for 2 s. It records fps, worst gap, draws and open time: no CPU ms, no slow
  causes, no memory, no quality level or resolution.
- **Automatic quality stays on** (`setLook` sets aim, effects, expert, eng; only the cost test pins
  `quality: { auto: false, resolution: 1 }`). On a slow phone `adaptQuality` (walk/quality-cull.js) turns AO,
  shadows, reflections, shafts and DoF down during the run, so many steps compare features already off.
- Always 15:00, clear, summer; only the `lights` group runs at 22:00.
- Results live only in memory until "Save the report"; nothing goes to `debugLog`, nothing survives a reload. The
  report leaves the browser out of `device`, so Firefox and Chrome runs look alike.
- Likely cause of the reload (unverified): Beautiful plus a full rebuild per step at extreme values, old and new
  resources held at once at each rebuild.

**What the standing spot can't measure.** test_graphics (tools/build-test-scenes.py `t_graphics`) is 60x46, flat,
`folk: 0`, no streams, springs, fountains or cliffs; its pond is at (50,10), about 20 m to the side, likely off screen
in portrait. Roughly 180 of the 392 steps measure nothing:
| Needs | Dials (ENGINE_SPEC groups) |
|---|---|
| another time of day | the four todDawn/Golden/Dusk/Night groups (about 100 rows); `windowsDay` (tested at night, the opposite) |
| night lamps close by | `lampShadows`, `lampFix`, `lightsInAir`, `fogLamps`, `onWater` (a lamp by water), quality `lights`, bloom |
| sky in view | sun `shafts`, `glare`, `shaftLength`, `innerSun` |
| fog or rain | `fogVolume`, `weather`, `wetGround` |
| the player at water | most of the water group: `fish` (deep water), `rings`, `leaves` (streams), `steam` (springs), `fountains`, `wallLight`, `tide` |
| something between camera and player | camera `silhouette`, `outline`, `outlineFill`, `hideFade`, `hideSize`, `hideAmount`, `coverFade`, `rockFade` |
| motion or turning | camera lead/dead/soft/smooth/sway/turn, shadows `steadyEdges`, grass `bend`, people `yawSteps`, DoF focus moves |
| townsfolk | people `folk`, `density`, quality `townFolk` |
| slopes and cliffs | world `cliffFaces`, `cliffEdges`, `hugSlopes`; camera `rise` |
| a place or event | `caveDark`, `heat`, `snowLine`, `interiors`, `roomLight`, `battleLite`, camera enc/talk/boss/arena/int/leave, `orbit` |
| never in the walk view | `relief`, `reliefShade`, `mini3d`, the worldMap group |
| no-ops here | quality `warmUp` (programs already built), `phonePixels` (DPR cap 1.75 stays under the 1.2 MP budget) |

### 3.2 The Graphics cost test (`game/js/graphics-bench-test.js`)
11 stations in test_graphics (pond, lamps at night, meadow, depth, rain...), about 40 dials at 5 values, quality
pinned, settles then measures 3 s with cpu/gpu ms, draws, noise and drift. Camera still at each station. In memory
only. It sets `debugLog.bench = { step: 'graphics test', result: null }`, which **wipes an earlier full-test result**
from the debug log, and never updates the step per station.

### 3.3 The full test and diagnostics (`game/js/self-test.js`)
- Walk phases: about 0.9 s, then `walkAbout(3)`: random hops round the hub, about 3 per-second samples, no counters.
- Diagnostics: Frame budget (4 s), rain and night (3 s each), Renderer baseline (5 still stops x 4 settings).
- `phase()` takes `debugLog.diag(t0)` after the step's `finally` and a 300 ms sleep. The light lab's `finally` has
  already sent the game back to Copperleaf, so the failure's context names the wrong scene. GL errors are checked
  only in the light lab and the fog step, and record method and code only: no scene, pass or program (the pass name
  is free: `gpuCounters.pass`; the program via `CURRENT_PROGRAM`). Normal play never checks `getError`.

### 3.4 The debug log (`game/js/debug-log.js`) and its reader (`tools/read-debug-log.py`)
- Per-second samples (900 kept), events (400), slow frames (60), hitches (150). Memory only; export by hand. No
  `pagehide`, no breadcrumb, no reload detection (`bootReport` reads the navigation entry but not its `type`).
- `build()` stores the full test's result itself as `bench`; the reader reads `bench.result`, so it always says "no
  result" and never lists failed steps. The debug-log skill's `jq '.bench.result.phases'` has the same mistake.
- `summary()` averages every second of a screen, loading included: no ready/busy flag in `ctx`.
- Slow frames: only the top label counts. "drawing items" is `gatherFrameItems` (CPU gathering and sorting, not
  drawing); "drawing" is the fallback; "outside the marked steps" is GC, driver and IPC. A GPU-bound frame with CPU
  under 33 ms is never a slow frame, only an unlabelled hitch.
- Memory: `gpuMemory` counts GL objects only (not decoded pictures, ground canvases, walk grids, mesh arrays);
  `textureFromData` counts w x h x 4 with mipmaps (up to a third under). No per-scene peak.
- Refresh rate and fps cap only at export (`state`); no drift check in the per-setting test.
- The reader prints none of `prof`, `gmb`, `gpuMemory`, `q`, `dc`, visibility or context-lost events; nothing reads
  a Graphics test report.

### 3.5 The headless checks
- The counts that carry over to a phone (draws, instances, program switches, uploads, late compiles, estimated
  graphics memory) are measured by route-perf.py, island-perf.py, check-load.py and the Renderer baseline, but
  **nothing gates on them, keeps them or compares them**. route-perf names the 400-draw phone budget
  (20-renderer-batching.md) without asserting it. No tool reads `gmb` or `gpuMemory`.
- Every page uses `device_scale_factor=1`: no check sees DPR 2-4 or a preset matrix.
- `--selftest` keeps only name, ok and why per phase: the diagnostics' numbers are lost.
- results.json files hold no commit, branch, browser version or per-page boot time; no trend file; check-load's
  JSON is gitignored.
- CI: the fast check runs twice for a push to a branch with an open PR, and on docs-only pushes (about 11 min each).
- Overlaps: the run loop is covered three times (check-fast run_loop/run_world, check-quick rl8_run_from_mast, the
  in-game run phase); the full check's RT-2/3/4 steps repeat in-game phases `--selftest` runs nightly.
- `npm test` takes 104-148 s in the cloud (budget 30 s). One wall-clock assert (`ms < 1500`,
  run-map-checks.test.mjs) is a flake source.
- Chromium's SwiftShader WebGL needs `--enable-unsafe-swiftshader` from about M139: browser_check.py already passes
  it; no check asserts the renderer string, so a silent change of renderer would go unnoticed.

## 4. The research, in short
Full reports with more sources were made in TD-0's session; the points sessions act on:
- **No GPU timing on phones.** `EXT_disjoint_timer_query_webgl2` is desktop Chrome only; Firefox gates it behind a
  privileged pref, Chrome Android and Safari don't have it. On tile-based phone GPUs per-pass timers mean little even
  where they exist. Use: CPU ms per frame against the frame interval (well under the interval but below the refresh
  rate = GPU or compositor bound), and a fence per frame (`fenceSync`, polled in later frames) whose lag of 2+ frames
  says GPU-bound. `gl.finish` doesn't wait in Chrome; `readPixels` does but breaks pipelining (a probe segment only).
- **Frame timing.** rAF timestamps for intervals, `performance.now()` for CPU work. Firefox timers are 1 ms with
  jitter (20 us when cross-origin isolated), so report distributions. No refresh-rate API: measure the median rAF
  interval idle for 2 s, snap to 30/60/90/120..., before and after. Known caps: iOS Low Power Mode 30 fps, iOS 60 on
  ProMotion by default, Chrome Energy Saver; Android battery saver capping rAF is unverified. Report p50/p90/p99, max,
  missed-vsync frames (>1.5 x refresh), hitches over 50 and 100 ms, 1% lows (say which definition).
- **Benchmark design** (Unreal FPS charts and CSV profiler, Unity Performance Testing, 3DMark, Android Performance
  Tuner): one fixed path and seed on every device, split into named segments; an unmeasured warm-up pass, then 3+
  measured passes, median and spread; `performance.mark`/`measure` per segment so it shows in Firefox Profiler and
  Perfetto; mark a segment invalid on `visibilitychange`, context loss or a refresh-rate change. Thermal: repeat the
  path and compare worst to best loop (3DMark's 97% rule); an Adreno 650 lost about 22% at equilibrium in reviews.
- **Why the page reloaded.** GeckoView tells a crash (crash screen) from an Android low-memory kill (silent restore);
  a silent reload points to the kill (inference). On unified-memory phones textures and targets are system RAM.
  Practical reports put WebGL pages at roughly 300-500 MB before kills (rule of thumb, unverified).
- **Surviving a kill.** The only cross-browser way: breadcrumbs in localStorage (written each step start, every few
  seconds, on `pagehide`), a clean-exit flag, and on boot "previous page ended unexpectedly" with the last record.
  Checkpoint each benchmark step before allocating, yield a frame, and resume only on a tap (never automatically, or
  a killed step loops). `PerformanceNavigationTiming.type` after a kill is unverified; `document.wasDiscarded` is
  Chrome only; Reporting API crash reports need a server (out of scope, privacy).
- **Memory.** Free first, wait 1-2 frames, then build (a rebuild holding both doubles the peak). Budget by bytes.
  Render targets: pixels x bytes x samples; half-res effect chains, R11F_G11F_B10F where float is needed, shadow maps
  at most 2048 on phones. Ground and picture textures: KTX2/Basis to ASTC or ETC2 (Adreno and Mali have both) would
  cut 217 MB of ground to about 54 MB at the same 32 px/m. `texStorage2D`; close ImageBitmaps after upload.
  greggman's webgl-memory gives a second estimate in debug builds.
- **Headless gates.** Gate on counts, not time (three.js `renderer.info`, Chromium's rendering benchmarks on real
  devices, Bencher's argument). Pictures: freeze time and seed, mask animated parts, tolerant diffs, several approved
  baselines (Chromium's Skia Gold). Assert the WebGL renderer string so a fallback is caught.
- **Real GPUs.** Cheapest real signal is the owner's own phone over USB (Playwright `_android` or `adb forward` +
  `connectOverCDP` to Chrome; Firefox Profiler over about:debugging); device clouds and GPU runners cost money and
  are still not the owner's phone. Not in this track (section 7), but section 5's JSON is shaped so a USB run could
  feed it later.
- **Replay.** Record seed and joystick per fixed tick, checksum position every N ticks; a phone bug becomes a file
  Claude replays headless. Exploration bots (Unity Game Crawler style) find stuck spots and collision holes.

## 5. Sessions
One session each, in order (TD-2 and TD-3 can run at once after TD-1: different files). Each ends with the handoff
skill; tags `td-N-done`. Every new number in the log stays numbers only: no names, save or step history.

### TD-1 Quick fixes: read what we already have, survive a reload
1. `tools/read-debug-log.py`: read `bench` itself (keep a fallback for `.result`); fix the debug-log skill's jq line.
   Print the failed steps' note, why and ctx; `gpuMemory` by kind, `gmb` peak per screen, `q`/res timeline,
   visibility and context-lost events.
2. Crash breadcrumb (debug-log.js): every 2 s and at each test step start, a small numbers-only record in
   localStorage (uptime, scene, test and step, `gmb` and kinds, last fps, q/res, refresh rate); a clean flag on
   `pagehide`. On boot, a missing clean flag while visible adds `previousPage: { endedUnexpectedly, last }` and the
   navigation type to the log. A debug-menu "pretend the page was killed" to test it.
3. Loading apart from play: `ld:1` in `ctx` while the place isn't ready or a grass, prep or paint job runs;
   `summary()` reports loading seconds apart, the reader prints both.
4. Labels: "drawing items" becomes "gathering frame items"; slow frames count every overlapping cause by its share,
   not only the top one.
5. The light-lab failure: capture `diag` at the throw, not after `finally`; each refused draw records scene, hour,
   pass and program. Find and fix the refused draw (try `?glerr` in the five light scenes headless; Firefox is
   stricter than Chrome about feedback loops and incomplete textures, so check for those first).
6. The cost test stops wiping the full test's result from the debug log; both graphics tests write their step to
   `debugLog.bench.step`.
Done when: the reader shows the 2026-10-29 log's failed step; a forced reload in the middle of a test is reported on
the next boot; smoke and the unit tests pass.

### TD-2 The graphics test walks (the owner's ask)
One test from both graphics tests: **a benchmark path** walked by the player.
1. Pure data `game/js/logic/bench-path.js`: named segments, each with a route of points, a time of day, weather and
   season, and the dials it measures. Segments in test_graphics (tools/build-test-scenes.py `t_graphics` grows what
   it lacks): open ground; the pond's shore with a lamp by the water, a stream, a fountain and a spring; behind a
   house and a tree (camera behind, player hidden: silhouette, outline, fades); tall grass walked through (bend); a
   folk plaza (`folk > 0`); a slope and a cliff (cliff dials, camera rise); the square at 22:00 with lamps
   (lamp shadows, lights in the air, bloom); dawn fog; rain (wet ground); sky in view (sun shafts, glare); a turn and
   a run (camera feel, yawSteps); into a room and out (room light). Time-of-day groups run at their own hour.
2. Each ENGINE_SPEC row (engine/settings.js) gets a `needs` tag; the test sends a dial to a segment that has it, or
   reports it as "not measurable here" (world map dials, events, the tilt sensor), never as a meaningless OK.
   A unit test fails when a new row has no tag.
3. Measuring: quality auto off and resolution pinned (as the cost test does); each dial at its shipped value and one
   alternative, not extremes; one unmeasured warm-up walk; each segment walked by route (not time) and repeated;
   per segment fps p50/p90/p99, worst frame, CPU ms, fence lag, draws, `gmb`, slow causes.
4. Memory: free the old scene, wait two frames, then build; reuse targets and ground pictures that a dial doesn't
   touch; a step whose estimate would pass 300 MB is skipped as "over budget".
5. Saved after every step (localStorage, small) with "resume" or "save partial report" after a reload, on a tap.
6. Run conditions in the report: browser, measured refresh rate before and after, fps cap, DPR and resolution,
   preset, `crossOriginIsolated`, timer resolution, timer-query and LoAF support; a segment is invalid after a
   visibility change, context loss or a refresh-rate change. A baseline segment re-run every N steps for heat drift.
7. Segments wrapped in `performance.mark`/`measure`.
Done when: the test runs through on a phone without reloading at 300 MB, and every dial has a number or a reason.

### TD-3 The same path headless, and the gates
1. `tools/check-perf.py` (route-perf.py and island-perf.py folded in) walks the TD-2 path in headless Chromium and
   writes the same per-segment JSON (counts only count; milliseconds are notes).
2. A committed `validation/perf-baseline.json`; the check fails on draws, instances or graphics memory 10% over it, or
   any new late compile (the owner's answer). `--baseline` rewrites it on purpose; HANDOFF says why.
3. A memory matrix: presets (Balanced, Beautiful, the engine presets) x DPR 1, 2, 3, 4 x phone and desktop page sizes;
   anything over 300 MB on a phone size fails. `device_scale_factor` set per page.
4. The draw budget (400 a frame on a phone, phase 20) asserted per segment.
5. Assert the WebGL renderer string (SwiftShader expected) so a silent renderer change fails loudly.
6. `--selftest` keeps the diagnostics' numbers and the full bench result in `validation/quick/in-game-*.json`.
Done when: check-perf runs in CI (nightly or on PRs, whichever fits the budget), red on a planted regression.

### TD-4 A richer log, and comparing logs
1. Per segment and per screen: frame-time histogram (8, 12, 16.7, 20, 25, 33, 50, 100+ ms), p50/p90/p99, max,
   missed-vsync count, 1% low (by count), steady and loading apart.
2. "GPU-bound" signal per sample: fence lag and CPU-under-interval; refresh rate and fps cap per sample, not only at
   export.
3. Memory without `performance.memory`: a CPU-side estimate by kind (decoded pictures, ground canvases, walk grids,
   mesh arrays) beside `gpuMemory`; mipmaps counted; per-scene peak. `measureUserAgentSpecificMemory` where present.
4. GL error sampler (opt-in, debug menu): `getError` once per pass on counted frames, with pass and program.
5. Reader: `--compare` two logs (per screen and segment side by side) and a phone log against a check-perf run, key by
   key; reads Graphics test reports.
6. The debug-log skill updated to read all of it in a fixed order.

### TD-5 The test suite tidy-up
1. Every results.json gets commit, branch, browser version, cores and per-page boot time; each run appended to a
   trend file kept as a CI artifact; `tools/check-diff.py` names new failures, slower steps and moved counts.
2. CI: one fast-check run per push (no double run with an open PR), docs-only pushes skipped, the fast check split
   into a matrix if it saves time.
3. Remove the duplicates: the full check's RT-2/3/4 steps (the in-game test runs them nightly), the third run-loop
   check; the wall-clock unit assert becomes a note.
4. `npm test` back toward 30 s: per-file times from a JSON reporter; the slowest files to the slow tier.
5. docs/TESTING.md rewritten for the new tiers and tools; tag `test-data-done`.

### Then (not this track)
Speed and memory fixes with the new data: Copperleaf's frame items, sprites, silhouette and walk grid; the ground
build in pieces; Beautiful's render targets; compressed ground and picture textures. They belong to the load track
(LD-5, LD-6) and phase 20, or a new track the owner names.

## 6. Ask me before
- Making TD-3's check-perf a PR gate rather than nightly, if it adds more than 2 minutes to CI.
- Adding test props or a new place to test_graphics beyond section 5's list.
- Anything that changes what a player sees or the shipped default settings (this track measures; it doesn't retune).
- Cross-origin isolation (COOP/COEP headers on the deployed page): it gives finer timers and memory figures but can
  break loading things from other sites.

## 7. Not in this track
- Fixing the game's speed or memory (section 5, "Then").
- Device clouds, GPU CI runners, a USB phone runner, input replay and exploration bots: worth it later; the JSON
  formats here are shaped so they can feed in.
- Sending logs or crash reports to a server: logs stay manual and local (CLAUDE.md, docs/TESTING.md privacy).

## 8. Risks
- The breadcrumb writes localStorage every 2 s: keep it tiny and numbers only; never the save or names.
- Rebuilding test_graphics changes the cost test's stations and its pictures: update both checks in the same commit.
- Counted gates need a stable scene: auto quality off, time, weather and camera forced, or they flake.
- The 300 MB budget is the game's own estimate; real use may be higher (drivers, decoded copies). Compare with
  about:memory or `dumpsys meminfo` on the owner's phone once (section 9, profiling).
- The per-setting test's 392 steps walking a path take longer: cap the run (about 15 min), allow picking groups.

## 9. Sources
Measuring on phones: [timer query compat](https://github.com/mdn/browser-compat-data),
[Firefox WebGLExtensions.cpp](https://github.com/mozilla-firefox/firefox/blob/main/dom/canvas/WebGLExtensions.cpp),
[timer query spec](https://github.com/KhronosGroup/WebGL/blob/main/extensions/EXT_disjoint_timer_query_webgl2/extension.xml),
[Arm frame pipelining](https://developer.arm.com/community/arm-community-blogs/b/mobile-graphics-and-gaming-blog/posts/the-mali-gpu-an-abstract-machine-part-1---frame-pipelining),
[google/render-timing-for-unity](https://github.com/google/render-timing-for-unity),
[WebGL 2 spec (fences)](https://github.com/KhronosGroup/WebGL/blob/main/specs/latest/2.0/index.html),
[WebKit 235002 (finish)](https://bugs.webkit.org/show_bug.cgi?id=235002),
[Firefox timer precision](https://github.com/mozilla-firefox/firefox/blob/main/toolkit/components/resistfingerprinting/nsRFPService.cpp),
[WebKit 215745 (Low Power Mode)](https://bugs.webkit.org/show_bug.cgi?id=215745),
[WebKit 280183 (ProMotion)](https://bugs.webkit.org/show_bug.cgi?id=280183),
[Chrome energy saver](https://developer.chrome.com/blog/memory-and-energy-saver-mode),
[CapFrameX metrics](https://www.capframex.com/blog/post/Explanation%20of%20different%20performance%20metrics),
[3DMark stress test](https://support.benchmarks.ul.com/support/solutions/articles/44002134931-stress-test-result-screen),
[MotionMark 1.3](https://webkit.org/blog/14908/motionmark-1-3/),
[Long Animation Frames](https://developer.chrome.com/articles/long-animation-frames),
[Android Performance Tuner](https://developer.android.com/games/sdk/performance-tuner/custom-engine),
[Unreal CSV profiler](https://docs.unrealengine.com/4.27/TestingAndOptimization/PerformanceAndProfiling/CSVProfiler),
[Unity Performance Testing](https://docs.unity3d.com/Packages/com.unity.test-framework.performance@2.1/manual).
Memory and reloads: [GeckoView ContentDelegate](https://mozilla.github.io/geckoview/javadoc/mozilla-central/org/mozilla/geckoview/GeckoSession.ContentDelegate.html),
[bug 1969818](https://bugzilla.mozilla.org/show_bug.cgi?id=1969818),
[bug 1810097](https://bugzilla.mozilla.org/show_bug.cgi?id=1810097),
[WebKit 300782](https://bugs.webkit.org/show_bug.cgi?id=300782),
[Khronos: handling context lost](https://wikis.khronos.org/webgl/HandlingContextLost),
[webgl-memory](https://github.com/greggman/webgl-memory),
[ASTC support](https://caniuse.com/wf-webgl-compressed-texture-astc),
[KTX2/Basis](https://www.khronos.org/developers/linkto/compressed-texture-transmission-ktx2-basis-universal),
[MDN CrashReport](https://developer.mozilla.org/en-US/docs/Web/API/CrashReport).
Headless and automation: [three.js Info](https://threejs.org/docs/pages/Info.html),
[Spector.js](https://github.com/BabylonJS/Spector.js),
[Bencher](https://bencher.dev/docs/how-to/track-benchmarks),
[github-action-benchmark](https://github.com/seanmonstar/github-action-benchmark),
[Chromium rendering benchmarks](https://chromium.googlesource.com/chromium/src/+/ef290da170d481d1ef1c9ca4e11d156cfaf09afe/docs/speed/benchmark/harnesses/rendering.md),
[SwiftShader deprecation](https://groups.google.com/a/chromium.org/g/blink-dev/c/yhFguWS_3pM/m/oLrB5up_BwAJ),
[Skia Gold matching](https://chromium.googlesource.com/chromium/src/+/main/ui/base/test/skia_gold_matching_algorithm.h),
[Playwright Android](https://playwright.dev/docs/api/class-android),
[Playwright clock](https://playwright.dev/docs/clock),
[Unity Game Crawler](https://docs.unity3d.com/Packages/com.unity.automated-testing@0.7/manual/GameCrawler.html).
Profiling on the owner's phone: [Firefox Profiler on Android](https://github.com/firefox-devtools/profiler/blob/main/docs-user/guide-profiling-android-directly-on-device.md),
[remote profiling](https://github.com/firefox-devtools/profiler/blob/main/docs-user/guide-remote-profiling.md),
[about:memory](https://firefox-source-docs.mozilla.org/performance/memory/about_colon_memory.html),
[Perfetto for Chrome](https://perfetto.dev/docs/getting-started/chrome-tracing).

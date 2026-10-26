# Phase 20 - Renderer: measure, fewer pixels, fewer calls, sturdier, a directable light

Branch: track/renderer

## Restructure (owner, 2026-10-26): read this first
The stages below (A-I) were written on 2026-10-19 against the picture-prop renderer. Since then every standing prop the
game flow shows became a low-poly model (phase 09 batches 10-11), the game flow loads only the hub and run places, the
water track and the five times of day landed. This section is the plan now; the stage texts further down stay as the
detailed task list (task ids A1...I3) and their "what the renderer does today" notes are history: verify every claim.

### Status (checked in the code, 2026-10-26, at 2314da8)
| Task | Status |
|---|---|
| A1-A7 | Done (gpu-counters.js, gpuPass marks, `dc` `dcp` `up` `lit` `pcl` `alloc`, the A6 timer fix). |
| A8 | Budgets set (400 draws a frame on phones, 60 fps in towns); the baseline is stale (picture props, legacy towns). Redone in R1. |
| B | Done (walk/, now 25 files with the water track's sea-tide.js and water-flow.js). |
| C1, C2 | Done; C2's item pool, `matrix4` and basin key left on purpose (HANDOFF C-1). |
| C3 | Built behind `quality.frameBlock`, **off by default**, waiting on the owner's phone verdict. |
| C4 | Done. |
| C5 | Built on `archive/phase-20-c3-lamp-shadows`, never merged. That branch has **no merge base** with today's history: port it, don't merge it. |
| D1-D7 | Not done (the sky draws first, no `mediump`, no `invalidateFramebuffer`, pixel cap 1.75 DPR / 1.6 MP; the automatic quality can drop phones to 0.6 resolution since 2026-10-23). |
| E1-E13 | Not started; the E3 bug (reflection never sets `uSelf` / `uFol`, walk/water.js) is still there. |
| F1-F9 | Not started. Retargeted: the models (`vox`, `mdl`, `voxS` in prop-models.js) are now the solid geometry; `tagSolidProp` skips every model, so F3 (solid props instanced) is dropped unless R1's numbers show a real `solid` pass. |
| G | Not done (battle-stage.js still draws each rig on a canvas). Only if R1's battle numbers ask for it. |
| H | Not done. Restore re-mounts the walk view only; the world map is now world-bowl.js, which also calls `initWebgl`, so the listener pile-up holds. |
| I1 | Done another way: five looks, logic/time-of-day.js. |
| I2 | Partly done: model window glass glows by its own lamp (HANDOFF 2026-10-25). Left: lantern glass flicker with its lamp, unlit glass dimmed, a night fill for characters. Moved to a later look task (it changes the look). |

What the claims above got wrong, now: "Picture layers on models are unused (0 of 76)": model leaf clumps and vines are
picture layers drawn by the sprite pass (`propModelImageItems`), one draw each; trees of one kind share them, so
sprite instancing pays off far more than "about 3 instances per picture". Phase 09 task 10 (instancing and a far
version) is the same work as R2's models lane and is done here.

### New stages
1. **Close-out**: C3 decided (on by default and the old path deleted, after the owner's verdict), C5 ported, tags.
2. **Measure again**: a baseline on what the game loads (Copperleaf by day and night, a jungle run place, a run town, a
   battle); sprite draws split into model pictures and the rest. **Ask me before:** whether the A8 budgets still stand.
3. **Models instanced** (F1, F2, F4, F5 retargeted, plus phase 09 task 10's far version of the jungle broadleaf trees).
4. **Sprites instanced** (E1-E10, E12-E13; E3 asked first).
5. **Shadows** (F6-F8 on models, E11 if approved, lamp shadows for the nearest lamps).
6. **Pixels** (D1, D3-D7 and rain's cost; D2 `mediump` last and alone).
7. **Context loss and warm-up** (H; early part in R1, registry and warm-up in R3).
8. **Battle rigs** (G), by the numbers.

### Lanes and rounds
All lanes work on `track/renderer` (BRANCHES.md). Before every push: `git pull --no-rebase origin track/renderer` (a
merge, never a rebase or force push). A lane never edits another lane's files; a change it needs there goes in its
HANDOFF entry for the owning lane. Shared files take additions only and are merged by hand: engine/settings.js
defaults, the precompile list in engine/webgl.js, graphics-bench-test.js steps, HANDOFF (yours at the top), CHANGELOG.
Generated files (hooks.js, debug-log-names.js): after a merge run `npm run modules`, never edit by hand. Every new path
ships behind its own setting, off by default, so lanes never change each other's look. Each round ends with one owner
phone run (graphics test, diagnostics, debug log) covering every lane's switches.

| Round | Lane | Session | Owns |
|---|---|---|---|
| R1 | light | Stage 1: C5 ported behind `quality.stableLights` / `quality.lights`; C3 default and old-path deletion once the owner says so; tags asked | engine/light.js, engine/frame-block.js, (new) engine/light-pick.js, walk/lighting.js, walk/shadows.js, the battle stage's light keys |
| R1 | measure | Stage 2's code: the sprite pass's draws split (model pictures / the rest), stations or a diagnostics tour for the hub, a jungle run place, a run town and a battle | engine/gpu-counters.js, the gpuPass marks, self-test.js's diagnostics, debug-log.js's fields, the graphics test's stations and test maps |
| R1 | context | H-early: lost/restored listeners added once per canvas, the world map (world-bowl.js) rebuilt on restore, H4's force-loss button | the listener block of engine/webgl.js `initWebgl`, world-bowl.js, walk-view-gl.js `onGlContextRestored`, debug-menu.js |
| R2 | models | Stage 3 | prop-models.js, (new) engine/model-instances.js |
| R2 | sprites | Stage 4 | walk/sprites.js, walk/draw-common.js, the sprite programs in walk/walk-shaders.js, walk/water.js's reflection pass, (new) engine/sprite-instances.js |
| R2 | pixels | Stage 6 without D2 | walk-view-gl.js's frame, walk/sky.js, engine/post-effects.js, render targets, walk/effects.js (D7) |
| R3 | shadows | Stage 5 | walk/shadows.js, the shadow half of prop-models.js |
| R3 | context | H1-H3, H5 | engine/webgl.js's resources |
| R3 | battle | Stage 8, if wanted | battle-stage.js, battle-3d.js |
| R4 | - | D2 alone; old paths deleted after the owner's verdicts (one commit each); tag `phase-20-done` | every shader |

## Goal
Keep the custom WebGL 2 renderer and its look, and make it fast and sturdy on phones:
1. measure what a frame costs (draw calls, pixels, allocations) on the owner's own devices;
2. cut the per-pixel cost first, because the owner's Android phone is limited by pixels, not draw calls;
3. cut CPU cost per frame: allocations, settings lookups, uniform uploads, draw calls;
4. recover from a lost GPU context on every screen;
5. make the time-of-day light directable from one table, and let windows and lantern glass glow with their lamps.

No engine swap (CLAUDE.md). The look must not change except where a task says so and the owner approves it.

## Decided (owner, 2026-10-19)
- Runs after phase 19 (battle core). The draw counters (stage A) may be done earlier, on their own.
- Texture atlases and KTX2 compression are phase 21.
- Graphics and performance are judged by the owner on their own devices (the graphics test, the diagnostics test, the
  debug log). Claude never runs headless graphics tests; if a headless render is truly needed (a crash check), it uses
  the lite/low-render settings. Refactors are proven by Node data tests instead (section "How each step is proven").
- The lighting findings from Luminati go in this phase (stage I).
- Work in Claude Code, one stage per session or a few, Plan Mode first (CLAUDE.md).
- A8 budgets (owner, 2026-10-19, after the iPad and Android baselines in HANDOFF): **at most 400 draw calls a frame
  on phones, shadow passes included**; **60 fps in towns on the Android phone at the game's own values**. Next stage:
  **B** (the file split), then the rest.

## Update (2026-10-23, from the owner's debug logs; HANDOFF "Phone speed, calmer effects, five times of day")
- The Android phone in Copperleaf draws 1,770 calls a frame (864 of them sprites; a phone held upright sees about
  1,000 things), and its graphics waits show up as main-thread time: the calls now cost it more than the pixels.
  Stage E comes before stage D for it.
- Stage I is done in another form: five looks (dawn, day, golden hour, dusk, night) as engine groups todDawn ...
  todNight, Studio-editable, logic/time-of-day.js. I2 (glow that follows the light) is still open.

## What the owner's graphics test already says (docs/graphics-bench.md)
- Game's own values / everything lowest / highest: iPad 38.5 / 57.5 / 37 fps; Android 15.5 / 42 / 16.5 fps.
- The Android phone is held back by pixel count: Sharpness 0.4 -> 1 halves it on bare ground (55 -> 29.5); grass,
  AO, depth of field, reflections and clouds each cost it 5-14 fps; the iPad barely notices them.
- The slowest place (Sun gap) is slow because of the grove itself (many trees of many sprites drawn over each other),
  not the light effects.
- About 400 draw calls per frame at the depth corridor.
So the order is: pixels first (stage D), then CPU and draw calls (C, E, F). Stage A confirms this before anything
else changes.

## Research behind this file (2026-10-19)
- Engines: three.js, Babylon.js, PlayCanvas (instancing, batching, compressed textures, shader warm-up, clustered
  lights); Luminati, a three.js 2.5D pixel-art engine (no license: ideas only) with a 300-draw-call budget, batches
  split by count and size with box culling, shadow-only merged casters, sky drawn last, a fixed light pool, shader
  warm-up, a keyframed 24-hour palette, weather multipliers, emissive windows, billboard god rays.
- Mobile WebGL: draw-call ceilings of roughly 200-500 per frame before the CPU limits; fill rate and bandwidth limit
  phones; `mediump` in fragment shaders gives roughly 30-50% more fragment throughput on Adreno (Mali similar; Apple
  GPUs ignore it); every framebuffer switch on a tile-based GPU writes the tile out, and `invalidateFramebuffer` tells
  it what it may drop; a 5 ms garbage-collection pause is a visible hitch at 60 fps.
- `WEBGL_multi_draw` is on about 96% of Android and nearly all iOS browsers (web3dsurvey), absent in Firefox: usable
  only as an optional speed-up over a plain loop.
- Three read-only code studies of this repository (2026-10-19): the sprite path, the solid props / models / shadows,
  the frame flow / uniforms / settings / context loss. Their findings are below with file:line references (as of
  commit 3ac5b5b; verify again before starting, lines move).

## What the renderer does today

### The frame (walk-view-gl.js `drawWalkFrame` 3590-3638, `drawWalkFrameInner` 3640-3832)
Before the scene: `gatherFrameItems` (3690), battle filter, `cullItems`; `shadowPass` (3707, near map `shadowN` and the
fitted far map `shadow` with a static-caster cache; every other frame when R<0.7 or quality step >= 2);
`walkLightContext` (3710); `lampShadowMaps` (3712, up to 2 lamps, 512 px, when dark > 0.3); `reflectionPass` (3714,
half size, sprites only). Then into the `scene` target (RGBA16F + DEPTH24): sky (drawn first, full screen, no depth),
ground, room front, grass (instanced), sprites, solid props, prop models, box faces, buildings (walls, windows,
blended fronts), structures, water (blended), effects (blended), post effects (dof, bloom levels, ao, rays, vol, grade
to screen), 2D labels.

### Draws per object per frame (worst case: night, near water)
| Object | Main | Near sun | Far sun | Lamps x2 | Reflection | Total |
|---|---|---|---|---|---|---|
| Solid prop | 1 (+blades) | 1 | 1 (never cached) | 2 | 1 (as a picture) | 6 |
| Still model (k = 1 + parts + spins) | k | k | 0 (k on a cache miss) | 2k | 1 picture | 4k+1 |
| Building | 3 | 2 | 0 (2 on a miss) | 4 | 1 | 10 |
| Sprite | 1 (+1 cross) | 1 | 0-1 | 2 | 1 | up to 6 |

### Sprites (walk-view-gl.js `drawSprites` 5963-6080)
- 24 uniform calls, 2 texture binds and 1 draw per prop picture; sorted by `imageId` only (5998-6001).
- No sprite is alpha-blended: cut-out at a<.5 and a dither for fades. Order still matters where pictures share a
  plane (`depthFunc` LEQUAL: the later draw wins), so batches keep today's order: `imageId` first-seen order, then
  item order.
- Which items are pictures changes every frame (solid-prop distance switch, async meshes, `propShown` by hour and
  season, the mossy twin, battle hides, culling), so instance buffers must be filled per frame, not baked per cell.
- A place has about 3 instances per picture (Copperleaf: 484 props, 151 pictures; median map 167 props, 30 pictures),
  so grouping by picture alone gives modest savings until the atlases of phase 21; grouping by space would add draws.
- Every catalogue prop is "fixed" (no `face` key); `uUV` is always 0,0,1,1.
- Sway is computed on the CPU (4648); 77% of placed props sway (17,341 of 22,509), so they all miss the far shadow
  cache. `windBendAt` (webgl.js 217) matches the GLSL `windBend` exactly, so sway can move to the vertex shader.
- Flat items (`drawFlatItem` 6348) and turning blades (`drawRotatingBlades` 6292) switch to the `fx` program and back
  for every single item, re-sending the whole light set each time.
- **Bug:** the reflection pass (6488-6542) runs before `drawSprites` and never sets `uSelf` or `uNoRecv`: reflections
  use the last sprite's `uSelf` from the previous frame; `uFol` stays 0 there (no season colour in reflections).

### Solid props, models, buildings, structures
- Solid props (solid-props.js): one VAO per mesh, shared by every placement of the same picture and spec; one
  `drawArrays` and about 22 uniform calls per prop (loop 1258-1327, draw 1310); no bounding box kept; within 20 m
  (trees, max 40) or 32 m. Instancing compresses them about 2.5-3x (Copperleaf: 71 props of 27 kinds; trees 70 of 15).
- Prop models (prop-models.js): meshes cached per recipe path; voxel and low-poly; spins are separate meshes turned by
  time only; low-poly models share one texture. Instancing compresses them 3-6x (`picket_fence`: 14 of one model).
  Picture layers on models are unused in the data (0 of 76 recipes).
- Buildings (buildings.js): one mesh per placement, baked in world space; no sharing. Mergeable, not instanceable.
- Structures (structures.js): one VAO per scene, parts as index ranges. Not instanceable.
- Box culling: not found; `inFrustum` (3978) tests spheres; `pgrid` cells are 6 m.

### Uniforms and settings
- `useWalkProgram` (5291) calls `setLightUniforms` (light.js 169-295) on every program bind: about 40 uniform calls,
  3 large arrays (`uLP[16]`, `uLC[16]`, `uAO[64]`) and 6 texture binds each time.
- No uniform buffers. About 130 vec4s sit in each program's default uniform block; phones only guarantee 224 fragment
  uniform vectors.
- `engineSetting` (settings.js 815-830) walks the override chain (and reads `saveData.preferences`) on every call:
  about 5 calls per visible prop plus 150-250 fixed, 2,000-3,500 a frame in a big town.

### Allocations every frame (the main sources of garbage-collection hitches)
`gatherFrameItems` (a new object per prop, layer, flag, enc and life sprite; `Object.assign` per person; Set + filter
+ map); `walkLightContext` (arrays per light and AO entry, `.map` chains, `lightContext()` and a `Float32Array(27)` of
sky harmonics); the shadow passes (`filter` several times, `Object.assign` per slice of a thick sprite, the cache key
joined as a string); `drawSprites` (`new Map` bfade, new list + sort, arrays per rotated item); `reflectionPass`
(new Float32Array, `Object.assign` of camera and light context); `drawGrass` (`new Float32Array(F.c.flat())`);
`updateBasinMeshes` (a string key and a Set); `matrix4` maths (a new Float32Array(16) per call); `worldCurveArgs` (a
new array per call, called per item, cell and effect quad).

### Pixels
- Every shader uses `precision highp float`.
- `invalidateFramebuffer`: not used anywhere.
- The sky is drawn first over the whole screen (5646-5678).
- Point lights: `points()` (webgl.js 262) loops up to 16 lights per lit pixel in every lit program; the god-ray pass
  (`vol`, post-effects.js 104-130) walks 14 steps per quarter-size pixel, each with up to 2 shadow lookups and 6 lamps.
- `pickPointLights` (light.js 368-383) sorts every lamp every frame, from the player (not the camera), allocates, has
  no view test and no memory of which lamp was lit; lights are rebuilt as new objects each frame.
- Pixel cap (3610-3613): device pixel ratio capped at 1.75, then a 1.6 MP budget, then the adaptive scale down to
  0.5. A DPR 3 phone at 390x844 renders 683x1477 (1.01 MP). The budget is the same on every device.

### Context loss and resources
- `initWebgl` adds the lost/restored listeners on every call (webgl.js 535-546), so they pile up; the world map calls
  it too (world-map-gl.js 200).
- Restore re-mounts the walk view only (walk-view-gl.js 840-846). Not rebuilt: the world map, `buildingState.mesh`
  and `fac`, `propModelState.meshes`, `structureState.mesh`, `walkRenderer.basin`, the world map's textures and mesh.
- No program or shader is ever deleted. The texture budget counts pictures only (not render targets, ground, near
  ring of about 26 MB, meshes or canvases re-uploaded each frame).

### Debug log
- No draw-call counter. The diagnostics test's pass timers (self-test.js 1657-1665) list `drawPropModels`,
  `drawBoxFaces` and `drawStructures`, which are not in debug-log-names.js, so they are silently skipped (**bug**).
- No "recording" flag: the log samples all the time once hooked at boot.

### Light and air (for stage I)
- Fog (`fogit`, webgl.js 290-299): exponential from a fog start, height mist, valley mist, sun-coloured air toward the
  sun, room dimming. Ahead of Luminati's plain fog; keep it.
- God rays: a real march through the sun shadow maps (post-effects.js 104-130). Ahead of Luminati's billboards; keep it.
- Weather already works as multipliers on the engine dials (`ENVIRONMENT_ENGINE_MODIFIERS`, environment.js 466 on),
  with fronts, curtains and rainbows. Keep it.
- Time of day: dawn and dusk are bell curves around sunrise and sunset (environment.js 232-237); the sky mixes fixed
  palettes by those weights (`SKY_TINT_PALETTES` 97, `environmentSky` 439); sun strength and other values are adjusted
  by separate formulas. No single table says what golden hour or blue hour looks like.
- Windows: `environmentWindowLit` (256) lights a fraction of windows by hour; lamps have `lampK`.

## How each step is proven (no headless graphics)
1. **Pure functions, Node tests.** Each refactor first extracts the decision part into a module with no GL imports
   (`game/js/engine/batching.js` and similar), with the old code calling it. A Node test feeds fixture items and
   compares old and new output: the uniform values a draw would set (a fake `gl` that records calls), the batch lists,
   the instance bytes (pack, then unpack), the shadow caster vertices against a JavaScript reference transform.
   Snapshot hashes follow the pattern of `tools/test/world-graph.test.mjs`.
2. **Behind a setting.** New paths ship off by default behind an engine setting (`quality.instancing`, ...), so the
   owner can switch between old and new on the phone and compare look and speed.
3. **Counters.** Every stage ends with the owner running the graphics test and the diagnostics test; the numbers go
   into HANDOFF.
4. **Old path deleted** in its own commit once the owner approves the new one.

## Stages and tasks

### Stage A - Measure (can run before phase 19; a few hours)
A1. `game/js/engine/gpu-counters.js`: `countersOn(gl)` puts own-property wrappers on the context for `drawArrays`,
    `drawElements`, `drawArraysInstanced`, `drawElementsInstanced` (counting instances), `useProgram` (only on a real
    change), `bindTexture`, `bindVertexArray`, every `uniform*`/`uniformMatrix*`, `texImage2D`/`texSubImage2D` (bytes),
    `bufferData`/`bufferSubData` (bytes); counts go into an Int32Array slot per pass. `countersOff` deletes the own
    properties (prototype methods again, zero cost).
A2. Pass attribution: explicit `gpuPass('sky' | 'ground' | 'grass' | 'sprites' | 'solid' | 'models' | 'box' |
    'buildings' | 'structures' | 'water' | 'effects' | 'post' | 'shadowNear' | 'shadowFar' | 'lamp0' | 'lamp1' |
    'reflection')` calls in the frame and the pass functions.
A3. When counted: during the graphics and diagnostics tests, plus one counted frame per second for the regular log.
A4. Report fields: `debugLog.ctx` gets `dc: [draws, instances, programSwitches, textureBinds, uniformCalls]`,
    `dcp: {pass: draws}`, `lit: [lights, lampShadowLights]`, `pcl` (programs compiled after load), `alloc` (see A5);
    the graphics test's per-step measure gets average draws, instances and switches per frame. Numbers only; nothing
    sent anywhere (export stays player-initiated).
A5. Garbage-collection hitches: count frames over 45 ms that coincide with a drop in `performance.memory` where the
    browser has it (Chrome), as a rough sign; otherwise skip.
A6. Fix the diagnostics bug: export `drawPropModels`, `drawBoxFaces`, `drawStructures` through the generated names so
    their timers run.
A7. "Programs compiled after load": count compiles once a `gpuState.loaded` flag is set after the place-load fade.
A8. The owner records a baseline on the iPad and the Android phone (graphics test + diagnostics at the Sun gap, the
    depth corridor, Copperleaf by night). **Ask me before** going on: the draw-call and frame-time budgets to aim for
    (proposal: 150 draws per frame on phones including shadow passes; 30 fps on the Android phone at the game's own
    values).

### Stage B - Split walk-view-gl.js (moves only)
B1. Into `game/js/walk/` in this page order (from a reference analysis; one forward reference remains, ground-mesh to
    map-cache, solved by moving the near-ring block into ground-mesh or through hooks.js):
    `walk-state` (76 lines), `heights` (202), `walk-shaders` (236, 27 KB), `draw-common` (32), `water-data` (276),
    `ground-textures` (291), `grass-build` (306), `ground-mesh` (880), `map-cache` (459), `quality-cull` (180),
    `sky` (52), `rooms` (423), `water` (290), `prop-look` (504), `frame-items` (382), `sprites` (531), `camera`
    (213), `lighting` (254), `shadows` (330), `ground-draw` (220), `fountains-weather` (525), `effects` (480),
    `input` (134); walk-view-gl.js keeps the canvas, mount, restore and the frame (441).
B2. Commit order, leaves first: state/heights/shaders/draw-common; water-data/ground-textures/grass-build;
    ground-mesh/map-cache; quality-cull; sky/rooms/water; prop-look/frame-items; sprites; camera; lighting/shadows;
    ground-draw; fountains-weather/effects; input.
B3. Each commit: new `<script type="module">` tags in both game/index.html and studio/index.html; `npm run modules`
    (setters, hooks.js, debug-log-names.js); tools/rename-ids.mjs (points at the `FLOWER_SET_BY_LOCATION` block) in
    the commit that moves it; lint, type check, unit tests, smoke. No name clashes today (195 top-level names, none
    declared elsewhere).
**Ask me before:** the file list.

### Stage C - CPU per frame
C1. **Frame settings.** `FRAME_SETTINGS` holds one pre-made object per group (11 groups, 144 keys from
    `ENGINE_DEFAULTS`); `beginFrameSettings()` refills them in place after the environment update; `engineSetting`
    returns from it while a frame is open; unknown keys take the slow path. Add the two keys with no default
    (`quality.keepScenes`, `world.roomDim`). A frame table keeps hot derived values (curve args in one reused array,
    wind x scene wind, light brightness, glow, flicker). Test: for every key, the fast path equals the slow path.
C2. **Allocations,** in the order listed in "Allocations every frame": reuse item objects in `gatherFrameItems` (a
    pool reset per frame), reuse light-context arrays, filter shadow items into reused arrays, a slice view instead of
    `Object.assign` for thick sprites, `matrix4` functions that write into a given array, `worldCurveArgs` into a
    reused array, the basin key compared by numbers. Test: each function gives the same output as before on fixtures;
    the owner's diagnostics show fewer long frames.
C3. **One uniform block for the frame.** `FRAME_GLSL` in webgl.js, pulled into `COMMON_GLSL` and `LIGHT_GLSL`
    behind an `#ifndef PB_FRAME` guard:
    ```glsl
    layout(std140) uniform Frame{
     mat4 uShadowM; mat4 uShadowM2; mat4 uLampM0; mat4 uLampM1;   // 0-255
     vec4 uLP[16]; vec4 uLC[16]; vec4 uAO[64];                    // 256-1791
     vec4 uSH[9];                                                 // 1792 (was vec3[9]; shAmb reads .rgb)
     vec3 uEye;    float uTime;     vec3 uSunDir; float uFogStart;
     vec3 uSunCol; float uFogD;     vec3 uAmbTop; float uAmbK;
     vec3 uAmbBot; float uSHK;      vec3 uFogCol; float uFogSun;
     vec3 uTint;   float uTintAmt;  vec3 uShTint; float uShStr;
     vec3 uShLift; float uShPx;     vec3 uCurve;  float uCurveD0;
     vec4 uRoomB; vec4 uSeason;
     vec2 uValley; float uMist, uMistY;
     float uCloudSh, uCloudSpd, uCloudCov, uContact;
     float uShadowOn, uShadow2On, uShPen, uShPen2;
     vec2 uShadowTexel, uShadowTexel2;
     float uRoomDim, uShLite, uPadA, uPadB;
     int uNL, uNLS, uNAO, uPadI;
    };                                                            // 2224 bytes
    ```
    - Uploaded once per frame with `bufferSubData`; a second range (at an offset rounded up to
      `UNIFORM_BUFFER_OFFSET_ALIGNMENT`, plan for 256) for the reflection, which needs `uShadowOn = 0`, bound with
      `bindBufferRange`.
    - `uniformBlockBinding` in both compile paths (webgl.js 357 and 403).
    - Programs that get it: ground, sprite, water, fall, grass, face, fx, bld, bwin, bfac, p3d, vox, mdl, vol (through
      LIGHT_GLSL); shadow, shadowG, p3dS, voxS, bshadow (through COMMON_GLSL, for `uCurve`). Not: the world map, `sky`
      and the other post programs (`sky` and `grade` declare their own `uSunCol`/`uTime`).
    - Stay plain uniforms: `uFol` (per sprite), `uVP` (mirrored in the reflection, the light's in shadow passes), the
      shadow samplers (units set once at link time, textures bound once per frame).
    - Test: the packed bytes decode back to the values `setLightUniforms` sets today (fixture light context).
C4. **Flat items and blades** draw in one group per program instead of switching program per item.
C5. **Light picking** (light.js): stable keys (owner prop + kind); a persistent map of lit lights; positions and
    colours written into preallocated arrays every frame and a time fade (about 250 ms) instead of the distance band;
    re-ranking about every 200 ms by partial top-k with no sort and no allocation; skip lights outside the view
    (`inFrustum`); hysteresis (a lit lamp counts 1.5 m nearer); lamp-shadow candidates first. A new setting
    `quality.lights`: 16 on desktop, 8 on phones (the phone test used at walk-view-gl.js 475). The shader keeps its
    constant 16 and the `uNL` break. Test: no flicker between two equal lamps in a scripted walk (Node, positions
    only); the chosen set matches the old one where nothing is outside the view.

### Stage D - Pixels (the Android phone's real limit)
D1. **Sky last.** Draw the sky after `drawStructures` and before the blended building fronts, water and effects
    (fronts move after the sky, or `drawBuildings` splits); clip z exactly equal to w (depth 1.0) with depthFunc LEQUAL,
    depth test on and writes off (at .9999 the sky would beat anything farther than about 403 m); restore the blend and
    depth state after it. SSAO, rays and vol are unaffected (sky pixels keep depth 1.0). The dead `uMirror` path goes.
D2. **`mediump` where it is safe.** Colour, fog, grade, bloom and look maths in `mediump`; positions, depth, shadow
    comparisons, world-space noise and time stay `highp`. Per shader, a list of which variables keep `highp`. The owner
    compares the look on the phone (banding in the sky and fog, noise patterns, shadow acne). **Ask me before:** which
    shaders.
D3. **`invalidateFramebuffer`** after each pass whose depth (or colour) is not read again: the scene depth after the
    post passes that read it, each bloom level after use, the shadow maps' unused parts. A table of every render target,
    who reads it and when it can be dropped.
D4. **Phone pixel budget.** A separate budget for phones (proposal: 1.2 MP instead of 1.6 MP) and the adaptive scale
    starting one step lower on phones. **Ask me before:** the number.
D5. **Overdraw in groves.** Cut-out sprites (`discard`) stop the GPU from skipping hidden pixels early. Options, to be
    measured at the Sun gap with the counters and the owner's phone:
    (a) draw opaque solid geometry (solid props, models, buildings, structures) before the sprites, so leaves behind a
        trunk or roof are rejected by depth;
    (b) a depth-only pre-pass of the nearest big sprites (trees) with the alpha test, then the colour pass with
        `depthFunc EQUAL` and no discard;
    (c) fewer, larger leaf pictures for distant trees.
    Pick by measurement; (a) is nearly free if draw order allows it (coplanar pictures keep their order).
D6. **Lights per pixel:** with C5's phone limit of 8, and the god-ray pass checking at most 4 lamps on phones.
D7. **Cheap god rays for the lowest setting.** A few placed light shafts (one additive quad each, turned to face the
    camera, coloured by the sun, strongest at golden hour and dawn, fading when the sun is high, at night, close to the
    camera) used when the volumetric pass is off. Shafts are placed in the map data (a `shafts` list) or picked
    automatically at gaps in tree cover. The volumetric pass stays the default.

### Stage E - Sprites instanced
E1. Extract `spriteDrawList(items)` (filter and `imageId` sort) and `spriteRecord(item, frame)` (the exact uniform
    values of today plus a mode: quad, grid, skip, hit-only). `drawSprites` sets uniforms from the records. Test: a
    fixture covering every branch (vox, bld3, wave, cross, far, layer, glow, person, rotation, noRecv, flip -1, town
    rise), snapshot hash.
E2. Extract `spriteSideEffects` (hit targets, labels, `bfade`, blades, clock hands) in today's order. Test: same order.
E3. **Ask me before:** fix the reflection's stale `uSelf` / `uFol` (recommended) or reproduce it.
E4. `packSpriteInstances(records)` / `unpackSpriteInstance` and a float-to-half packer (no reliance on Float16Array).
    Layout, 56 bytes per instance (+8 for a UV rectangle after phase 21):
    | loc | attribute | format | offset |
    |---|---|---|---|
    | 0 | corner (per vertex) | float x2 | - |
    | 1 | base x, y, z | float32 x3 | 0 |
    | 2 | offset x, y, width, height (scaled) | half x4 | 12 |
    | 3 | wind sample dx, dz, lean, sway amount | half x4 | 20 |
    | 4 | slope, rotation | half x2 | 28 |
    | 5 | hue, saturation, value, on | half x4 | 32 |
    | 6 | wear | unorm8 x4 | 40 |
    | 7 | tint rgb, amount | unorm8 x4 | 44 |
    | 8 | mask low, mask width, foliage, glow | unorm8 x4 | 48 |
    | 9 | flags, material index, fade, spare | uint8 x4 (`vertexAttribIPointer`) | 52 |
    Flags: fixed, plane, noRecv, person, far, self-shadow, flip, cross, foliage. Rim, lit, shade, emit and flip are
    worked out in the shader from flags; the right and back vectors in the vertex shader (fixed: from rotation; else
    the camera's); materials from an 8-entry uniform table. Copperleaf at about 600 items is about 34 KB per frame.
    Test: pack-unpack round trip within half precision; stride 56.
E5. No-op GLSL commit: `LOOK_GLSL` and `uFol` split into declarations plus functions taking parameters, so the
    instanced program can feed them from varyings. Check the flat varyings stay under the WebGL2 minimum of 15 vec4.
E6. The instanced sprite program (its own VAO), off by default, in the precompile list.
E7. Draw path: pack the records into one buffer per frame (orphaned with `bufferData(null)` then `bufferSubData`), one
    `drawArraysInstanced` per run of the same picture, in today's order. Wave flags, blades, hands and the title's town
    rise keep the old path. Test: the runs equal grouping `spriteDrawList` by picture, in order.
E8. Cross sprites as instances (a flag and a yaw-fade uniform).
E9. Shadow sprites instanced (sun direction or lamp position as a uniform; box extrusion as 6 instances; bld3 fronts as
    their own group). Fix on the way: the texture bind before the skip (5449). Test: the instance list equals today's
    per-item list, skips included.
E10. Reflection sprites instanced.
E11. **Sway in the shader** (needs approval: it changes when the far shadow cache can keep swaying props): per-instance
     sample offset, lean and amount; `uTime`, wind and gusts per frame. Test: lean + amount x `windLeanAt(sample, t)`
     equals today's shear for several t; a check that the GLSL constants still match `windBendAt`.
E12. Optional, by the counters: the player-overlap fade in the shader; packed bytes cached per prop.
E13. After the owner's graphics test: on by default, old path deleted.
(Texture arrays as a way to group pictures before the atlases were studied and judged not worth it here: 2.5x memory
waste at Copperleaf; they move to phase 21 as an option.)

### Stage F - Solid props and models instanced, pieces, shadow casters
F1. Extract `solidPropInstanceRecord(it, M, frame)` and `propModelInstanceRecord` (the exact values set today). Test:
    a fake `gl` shows old == new on fixture items.
F2. `buildInstanceBatches(items, meshOf)` -> `[{key, mesh, items, data}]`, batch key (mesh, material). Test: same item
    set as the old loop; records equal F1's; snapshot hash.
F3. Instanced `p3d` and `p3dS` (solid props). The transform is not affine (height shear, clump wobble from the base,
    tilt, world curve), so per instance: `iA` (x, y, z, metres per pixel), `iB` (offset x, y, flip, shear), `iC`
    (rotation, tilt x, tilt z, wobble), `iD` (variant rgb, fade); the look data (14 floats) from an RGBA32F instance
    texture read with `texelFetch` by a flat instance index, to stay under 16 attributes. `drawArraysInstanced` (the
    meshes have no index buffer); no `baseInstance` in WebGL2, so each batch sets its attribute offset. Test: a
    JavaScript port of `p3dPos` decodes the instance data back to the records.
F4. The same for models (`vox`, `mdl`, `voxS`): per instance x, y + bob, z, scale, rotation, flip, fade, emit; spins and
    extra parts as their own instanced draws over the same instances.
F5. `boxInFrustum(planes, box)` and `splitPieces(items, {maxCount, maxExtent})` (split at the median along the longer
    side). Mesh boxes computed at build time (solid props keep none today). Tests: every item in exactly one piece;
    limits hold; every box contains its items; deterministic; the box test never shows a piece the sphere test hides
    unless the box is truly inside.
F6. `buildShadowCasters(meshCPU, placements)`: positions only, baked in world space per piece, the world curve baked
    in (and in the cache key). Only still, opaque geometry: still models (no alpha), building walls, structures, and
    still solid props **where a Node test shows their geometry equals the picture's alpha mask** (card parts are built
    from opaque pixel runs at the same threshold as the shader's test; puff fronts may cover transparent pixels; those
    keep UV + texture). Not baked: anything that sways, bobs, spins or swings; solid trees (clump alpha); building
    fronts (cut-out pictures); props that own a light (so a lamp never shadows itself). Tests: each vertex equals the
    JavaScript reference transform; the mask check per picture.
F7. Casters drawn in the near sun map and the two lamp maps (world-space buffers, only the projection changes), then
    the far map on a cache miss; the caster signature joins the far cache key. (The reflection is a colour pass of
    pictures, not a depth pass: casters don't apply there.)
F8. Still solid props allowed into the far shadow cache, with a signature of which items are 3D in the key (the
    distance switch at 20/32 m changes it).
F9. Optional: `WEBGL_multi_draw` for structure parts and merged building walls, with the plain loop as fallback (the
    self-test's draw wrapper must know the multi-draw calls).

### Stage G - Battle rigs on the GPU
G1. Today each battler is redrawn on a 2D canvas every frame (battle-stage.js 1086-1113) and uploaded again with
    `texImage2D` (webgl.js 585-596). Instead: bone transforms on the CPU, each rig part a quad from the rig picture,
    one instanced draw per battler, no canvas and no upload. Portraits (phase 07) and the Studio's skeleton editor
    preview are not touched.
G2. Test: the part quads (corners and UVs) for a pose equal the 2D canvas transforms of today (Node, numbers only).

### Stage H - Context loss, resources, warm-up
H1. A resource registry: every program, shader, buffer, texture, VAO and render target created through it, with a way
    to rebuild it. On restore, everything rebuilds: walk view, battle, world map, buildings, structures, models, solid
    props, basins, instance and caster buffers. Caches keyed by the old context are cleared (the list in "Context loss
    and resources"). Listeners added once.
H2. A replaced resource is freed one frame after its replacement has drawn. Programs that are replaced are deleted.
H3. The memory budget counts render targets, ground textures, the near ring, meshes and per-frame canvases, by kind, in
    the debug log.
H4. A debug-menu button that forces a context loss (`WEBGL_lose_context`), for the owner to test every screen.
H5. Warm-up: new programs (instanced, uniform-block, shadow-only) in the parallel precompile list; one or two frames
    drawn behind the place-load fade; restore runs the same warm-up; `pcl` (A7) should stay 0 after a tour.

### Stage I - A directable light (from Luminati, adapted)
I1. **Time-of-day table** in the game data (`game/data/light.json`, schema, Studio-editable later): named keyframes
    (night, pre-dawn, dawn, sunrise, morning, noon, afternoon, golden hour, sunset, dusk, blue hour), each with sun
    colour and strength, ambient top and bottom, fog colour and density, exposure, shadow strength, sky colours, cloud
    cover, glow. Interpolated in linear colour with a monotone cubic that wraps at midnight (no overshoot). It replaces
    the dawn/dusk bells and the palette mixing for these values; sunrise and sunset times per season stay as they are.
    Weather keeps working as multipliers on top (no change to `ENVIRONMENT_ENGINE_MODIFIERS` beyond reading the table).
    Starting values are made to reproduce today's look; the owner then tunes golden hour (Luminati: sun nearly twice
    noon's strength, a cooler fill so long shadows turn teal instead of brown) and blue hour. Test: at the hours where
    today's formulas are defined, the table gives the same values within a tolerance before any tuning.
I2. **Glow that follows the light.** Window panes and lantern glass get an emissive amount: dark by day, glowing at
    night, raised a little in grey weather, and flickering with their lamp from the same smooth noise (not random
    jitter). Unlit lantern glass is dimmed. Characters and Billies get a faint warm fill at night so they read.
I3. **Ask me before:** whether stage I lands with this phase or as its own small phase after it (it changes the look,
    so it needs the owner's eye).

## Bugs found while reading (fix in the stage named)
- Reflection pass: stale `uSelf`, no `uNoRecv`, `uFol` 0 (E3).
- Diagnostics timers skip `drawPropModels`, `drawBoxFaces`, `drawStructures` (A6).
- Context listeners pile up on every `initWebgl` (H1).
- Two engine settings in use have no default: `quality.keepScenes`, `world.roomDim` (C1).
- Shadow sprites bind a texture before deciding to skip the item (E9).

## Ask me before (all in one place)
- The budgets after the baseline (A8).
- The file split (B).
- Which shaders go to `mediump` (D2); the phone pixel budget (D4).
- The reflection fix (E3); sway in the shader (E11).
- Stage I in this phase or its own (I3); the look of golden hour and blue hour after the table reproduces today's.

## Done when
- All tiers pass; no headless graphics runs at full settings.
- The owner's graphics test and diagnostics on the Android phone and the iPad show, against the A8 baseline: fewer
  draw calls per frame (target set at A8), no fewer frames per second anywhere, and a higher frame rate at the game's
  own values on the Android phone.
- A forced context loss recovers on the walk view, a battle, the world map and the Studio.
- `pcl` stays 0 after a tour of a town, a route and a room.
- HANDOFF updated with the numbers; tag `phase-20-done`.

## First reply
A plan in Plan Mode for the stage being started, and anything in this file the code proves wrong (lines move).

## Testing (phase 13)
Follow docs/TESTING.md. Refactors are proven by Node data tests (tier b); look and speed by the owner on their devices
(tier 5, the in-game tests), never by pixel differences in headless runs.

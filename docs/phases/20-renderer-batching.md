# Phase 20 - Renderer: fewer draw calls, shared uniforms, sturdier

## Goal
Keep the custom WebGL 2 renderer and its look exactly as it is, but feed the GPU the way three.js, Babylon.js and
PlayCanvas do: instanced and batched draws, one shared block of per-frame uniforms, draws sorted by state, battle rigs
drawn on the GPU, and full recovery when a phone drops the GPU context. The aim is frame rate and battery on phones.
No engine swap (CLAUDE.md).

## Decided (owner, 2026-10-19)
- Runs after phase 19 (battle core). Texture atlases and KTX2 compression are phase 21.
- Graphics and performance are measured by the owner on their own devices (graphics test, diagnostics test, debug
  log). Claude does not run headless graphics tests; if a headless render is truly needed (a crash check), it uses
  the lite/low-render settings.

## What the renderer has today (read 2026-10-19, verify again before starting)
- No scene graph: `gatherFrameItems` (walk-view-gl.js about 4620) builds a flat list of item objects every frame;
  fixed draw functions run in order (3721-3733).
- One draw call per sprite: `drawSprites` sets about 20 uniforms, binds two textures and calls `drawArrays(6)` for
  each (6002-6078). Solid props are drawn one by one (solid-props.js 1272-1292). Only grass is instanced (5895, 5907).
  HANDOFF: "instancing is still to do"; the next renderer steps listed there are reusing per-frame item objects,
  instancing static sprites and grouping solid props by mesh.
- No uniform buffers: lights and AO are uniform arrays (`uLP[16]`, `uAO[64]`, webgl.js 233-235), set again for every
  program. Sprites are sorted by texture only (6001).
- No draw-call counter in the debug log (it logs culled/total, grid cells skipped, grass instances, GPU ms).
- Battle rigs are drawn on a 2D canvas every frame (battle-stage.js 1086-1113) and uploaded again with
  `texImage2D` (webgl.js 585-596).
- Context loss: the handler sets a flag (webgl.js 535-539); restore re-mounts the walk view only (walk-view-gl.js
  840-846); the world map is not restored; the listeners are added again on every `initWebgl`.
- `engineSetting` walks the override chain on each call and is called per draw.
- walk-view-gl.js is 8,162 lines: shaders, camera, culling, light, shadows, water, weather, rooms, labels.

## Design

### 1. Count first
Add to the debug log, diagnostics test and graphics test: draw calls, instanced instances, program switches, texture
binds and uniform uploads per frame, per draw function. A thin counter around `gl.draw*`, `useProgram`,
`bindTexture`, off unless the debug log is recording. Every later task is judged on these numbers from the owner's
phone.

### 2. Split walk-view-gl.js (moves only)
Before changing behaviour, move code into files under `game/js/engine/` and `game/js/walk/`: shaders, camera and
culling, shadows, water, weather, rooms, labels, sprite drawing. Pure move commits (`npm run modules` regenerates the
imports), one area per commit, no behaviour change, smoke after each. **Ask me before**: the file list.

### 3. Per-frame uniform block
One uniform buffer (std140) for camera, sun, fog, sky light, the 16 lights and 64 AO ellipses, bound once per frame at
binding 0 and declared in the shared GLSL chunk. Programs keep only per-object uniforms. Settings read by draws are
resolved once per frame into this block or a frame table (no `engineSetting` walk inside draw loops).

### 3b. Light picking
`pickPointLights` (engine/light.js) sorts every lamp every frame. Keep its distance fade; add: skip lamps whose
sphere is outside the view, a bonus for lamps already lit (no flicker between two lamps), re-ranking about five
times a second without allocating, and a lower limit on phones (8) since the per-pixel light loop is the real cost.

### 3c. Sky last
Draw the sky after the opaque scene, at the far plane, so its shader only runs on pixels nothing covered (Luminati
measured 0.6 ms down to 0.01 ms). Anything opaque that writes no depth moves after the sky.

### 4. Instanced sprites
- Static sprites (props drawn as pictures, leaf clumps, decals) are grouped per texture into instance buffers, built
  when a grid cell or scene loads and kept until it unloads. Per instance: position, size, UV rectangle, tint, sway,
  flags (shadow receive, glow, lamp-lit).
- Moving sprites (people, Billies, NPCs) stay one draw each at first; they are few.
- Reuse the per-frame item objects instead of creating them each frame.
- Groups are not the 6 m culling cells as they are: split a place's static sprites into pieces by count and size
  (split at the median along the longer side until each piece is under a limit), and cull each piece by its box,
  not a sphere: under a tilted camera a sphere round a flat, wide batch stays "visible" far too long. Luminati's
  first try with plain fixed chunks raised draw calls; budgets by count and size fixed it.
- After phase 21 the grouping key becomes the atlas page, so most of a place draws in a handful of calls.

### 5. Instanced solid props and models
Props sharing a mesh (solid-props.js, prop-models.js, structures) are drawn with `drawElementsInstanced`, one call
per mesh per pass (main, shadow, reflection). Per-instance transform and tint.

### 5b. Shadow-only merged casters
Solid props and building volumes in a piece are baked into one depth-only mesh (positions only), drawn by every depth
pass: the near and far sun maps, the lamp maps and the reflection. The props themselves stop casting one by one.
Pocket Billies has more shadow passes than Luminati, where this cut the shadow draws by about a third to a half.

### 6. Draw order
Opaque: by program, then texture/atlas page, then roughly front to back. Transparent: back to front, as now. The
draw order must not change how things look; any difference in the owner's screenshots is a bug.

### 7. Battle rigs on the GPU
Draw each rig part as a quad from the rig picture, with the bone transforms computed on the CPU (cheap) and the parts
drawn in one instanced call per battler. No 2D canvas, no texture upload per frame. The Studio's skeleton editor
keeps working (it may keep its canvas preview). Portraits are not touched (phase 07's own system).

### 8. Context loss and resources
A small registry: every GPU resource (programs, buffers, textures, render targets, instance buffers) is created
through it with a way to rebuild it. On restore, everything rebuilds, the walk view, battle and world map included.
Listeners are added once. The memory budget counts render targets, ground textures and meshes, not only pictures.
A replaced resource is freed one frame after its replacement has drawn. Restore runs the same warm-up as loading.

### 9. Warm-up
New programs (instanced, uniform block, shadow-only) join the parallel precompile list; one or two frames are drawn
behind the place-load fade; the debug log records "programs compiled after load" (should stay 0 after a tour).

### 10. Proving refactors without pictures
A Node unit test builds the batches for a fixture place and checks they hold exactly the items the unbatched path
would draw (same pictures, positions, tints), then snapshots a hash of them. Batching, sorting and atlas changes are
proven by data, never by headless screenshots.

## Tasks
1. Counters in the debug log and the graphics test (section 1), including shadow-pass draws, lights lit and programs
   compiled after load. The owner records a baseline on their phone. (Can be done early, on its own: see ROADMAP.)
1b. The batch equivalence test harness (section 10), before any batching.
2. Split walk-view-gl.js (section 2), moves only.
3. Per-frame uniform block and per-frame settings (section 3).
4. Reuse per-frame item objects.
5. Instanced static sprites (section 4).
6. Instanced solid props and models (section 5).
6b. Shadow-only merged casters (section 5b).
7. Draw order (section 6); sky last (3c); light picking (3b).
8. Battle rigs on the GPU (section 7).
9. Context loss and resource registry (section 8); a debug-menu button that forces a context loss
   (`WEBGL_lose_context`) to test it. Warm-up (section 9).
10. The owner runs the graphics test and the diagnostics test after tasks 3, 5, 6 and 8; numbers go into HANDOFF.

## Ask me before
- The file list for the split (task 2).
- Whether instanced sprites may change shadow or sway details where matching them exactly would cost much.
- A written budget for phones (for example 150 draw calls per frame including shadow passes), once the baseline is in.

## Done when
All tiers pass with no headless graphics runs at full settings; the owner's graphics test shows fewer draw calls and
an equal or better frame rate on their phone than the task 1 baseline; a forced context loss recovers on every
screen; HANDOFF updated; tag `phase-20-done`.

## First reply
A plan in Plan Mode: the counters, the proposed file split, and anything here the code proves wrong.

## Testing (phase 13)
Follow docs/TESTING.md. Graphics changes are judged by the owner on their devices (tier 5, the in-game test), never
by pixel differences in headless runs.

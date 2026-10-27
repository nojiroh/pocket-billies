# Air track (AIR) - volumetric low fog and better haze

Branch: track/air

The owner's brief (2026-10-26): "Could the low fog be more volumetric with simple voxels for a better fog and
lighting look?", then "do the same for haze and such". Researched and planned in one session (AIR-0, branch
`ccr-c0505a05-bzef90`, because `track/air` did not exist yet: the owner makes it from that branch's merge or from
main, and every later session starts on it). Tags `air-N-done` (the owner pushes tags).

## The owner's answers (2026-10-26, Plan Mode)
| Question | Answer |
|---|---|
| The look | **Soft volumetric**: a hidden density grid read by the light-in-air march. No visible cubes (the art commitments: low-poly at 32 px/m, the terrain textures) |
| Where it lives | **Its own track**, `track/air` |
| Scope | **All four**: haze upgrades, the fog grid and a lit march, a depth-aware blur, shadowed haze |
| Phones | **On, with a coarser grid** and fewer steps, inside the current frame budget |
| AIR-1: a place's own `haze` (asked in AIR-1, 2026-10-26) | **Keep it, the sky shapes it**: the haze is the place's colour below the horizon and leans to the sky's gradient above it (`uFogCol + skyGrad(view) - uSkyLow`) |

## Verified facts (branch `ccr-c0505a05-bzef90` on main b87b818d, 2026-10-26)
- **Haze and low mist are one function**, `fogit(c,p)` in the shared GLSL (`engine/webgl.js:327-336`), called by every
  lit shader on its final colour (ground, props, water, sprites, effects). It does:
  - distance haze: `1-exp(-max(0,d-uFogStart)/uFogD*1.6)`, one colour `uFogCol` for every direction;
  - low mist: `uMist*exp(-max(0,y-uMistY)*1.4)`, faded in from 4 to 22 m, wobbled by two sines; added to the haze;
  - valley mist (`uValley`, v23) the same way below a level;
  - the sunlit haze (v43): toward the sun the haze colour leans to the sun's, `pow(dot(view,sun),6)*uFogSun`.
  It is a colour fade per surface: no thickness across a view, no shadow in it, no lamp glow in it.
- **The haze colour** is `air.haze`, else the scene's `haze`, else the sky's third (horizon) colour, then
  `environmentHaze` for the weather (`walk/lighting.js:354-355`), darker in caves (389). Haze start
  `C.df*air.hazeStart` and distance `(air.hazeDistance ?? sc.hazeD ?? 34)*1.15`, both cut by fog, rain, snow, ash
  (392-428). Mist level: water level + `air.mistHeight` (0.25 m); mist amount from the scene's `mist` and fog weather.
- **The sky** is a three-colour gradient by view height (`walk-shaders.js:206-213`, `uSky0..2`, from
  `walk/sky.js skyColors`, after `environmentSky`). So the haze matches the sky only at the horizon.
- **A light-in-air pass already exists** (v43, alpha 0.4.1; `engine/post-effects.js:136-152`, run at 382-411):
  a march of 14 steps over the last 14 m before each pixel's surface, at a quarter of the screen (half of the half
  size), jittered by a fixed per-pixel hash. Each step samples the near and far sun shadow maps and up to 6 lamps
  (`airLamps`: 4 on phones with `quality.phoneLamps`). Henyey-Greenstein phase, g 0.45. Its density has a mist term
  (15%). Output: lit air (rgb) and shadowed air (alpha), then one plain blur (`down`, not depth-aware), added in the
  grade pass (187). It only adds shafts and darkening; it never paints the fog colour.
  - On when `air.godRays` (0.5) or `air.lightsInAir` (0.7) is above 0.01 and there is a shadow map.
  - Off (`noVol`, `walk-view-gl.js:731`) at quality step 3 or more (`QE`) and in lit rooms. The auto-quality ladder
    (`walk/quality-cull.js:212`) drops "light shafts" at step 3, so **a phone under load loses the march**: the
    `fogit` fog must stay as the fallback.
  - `volDens` (732): 1 + fog x 1.5 + rain x 0.4 outdoors, 0.5 indoors.
- **Frame data**: `uMist`, `uMistY`, `uFogCol`, `uFogSun`, `uFogStart`, `uFogD` are in the frame block
  (`engine/frame-block.js`), sent once a frame (phase 20).
- **Ground height** for a grid: `groundHeightAt(x,z)` (`walk/heights.js:179`); the water level `walkRenderer.wlevel`.
- **3D textures**: none in the walk renderer today (the bowl uses a 2D array, `world-bowl.js:2169`). WebGL2 has them
  natively; an R8 3D texture filters linearly everywhere.
- **Budgets** (phase 20, A8): 400 draw calls a frame on phones, 60 fps in towns; pixels cost first. Pixel cap: DPR 1.75,
  1.6 MP. The fog adds no draw calls beyond its passes (one march, one or two blurs).
- **Settings** (`engine/settings.js` `air`, 111-128; dials 346-349 and 656-680; the clean prop turntable zeroes them,
  1435-1451): `haze`, `hazeStart`, `hazeDistance`, `mist`, `mistHeight`, `valleyMist`, `sunFog`, `godRays`,
  `lightsInAir`, `cheapShafts`.

## Research (2026-10-26)
| Technique | Who | Take |
|---|---|---|
| Froxel grid (a 3D grid shaped to the view, lit in compute) | AC4 (Wronski 2014), Frostbite (Hillaire 2015), Godot 4, TLOU2 | Best looking; a Godot proposal calls it impractical on mobile, and WebGL2 has no compute. **No.** |
| Low-resolution per-pixel march, then a blur | Arm's mobile "clustered volumetric fog" (1/16 resolution), Godot's mobile proposal | **Yes**: what our pass already is |
| A 3D density texture read by the march | Qt's volumetric fog, a Frostbite-style WebGL2 renderer, Volumika | **Yes**: the "simple voxels" |
| Analytic height fog (the exact integral of an exponential along the ray) | Quilez; Unreal and Flax exponential height fog | **Yes**: in `fogit`, for haze and the phone fallback |
| Haze colour from the sky in the view direction | Uncharted 4 "Mip Sky Fog", Unity HDRP | **Yes**: our sky is three colours, so `fogit` can rebuild it |
| RGB extinction and in-scatter | Hoffman & Preetham 2002, Leonard's Cg aerial perspective; *The Blacksmith* uses an artist colour ramp | **Yes**, art-directed, not physical |
| Sky and aerial-perspective lookup textures | Hillaire 2020 (Unreal, Fortnite on phones) | **Later**: it would replace the hand sky and `environment.js` tinting |
| Fog cards with a depth fade | many stylised games | Optional, placed wisps only |

Pitfalls the sources agree on: blurring and upscaling must respect depth (or fog bleeds round edges), and the depth is
shrunk by its nearest value; blue-noise jitter beats a hash; temporal accumulation is cheap but ghosts (we have no
TAA: leave it out). A WebGL2 Frostbite-style renderer reports volume frames up to 100x slower: stay low resolution with
few steps. Rendering into 3D texture slices from a shader is fiddly in WebGL2: build the grid on the CPU.

Sources: [Arm](https://developer.arm.com/community/arm-community-blogs/b/mobile-graphics-and-gaming-blog/posts/clustered-volumetric-fog),
[Godot proposal 8580](https://github.com/godotengine/godot-proposals/issues/8580),
[Godot docs](https://docs.godotengine.org/es/4.4/tutorials/3d/volumetric_fog.html),
[Wronski AC4](https://bartwronski.com/wp-content/uploads/2014/03/ac4_gdc.pdf),
[Hillaire 2015](https://www.frostbite.com/2015/08/physically-based-unified-volumetric-rendering-in-frostbite/),
[Hillaire 2020](https://diglib.eg.org/handle/10.1111/cgf14050),
[Quilez fog](https://iquilezles.org/articles/fog/),
[Uncharted 4 tech art](https://advances.realtimerendering.com/other/2016/naughty_dog/index.html),
[Hoffman & Preetham](https://drivers.amd.com/developer/gdc/GDC02_HoffmanPreetham.pdf),
[The Blacksmith](https://unity.com/blog/technology/atmospheric-scattering-in-the-blacksmith),
[rms13 WebGL2 volumetrics](https://github.com/rms13/WebGL2-Volumetric-Renderer),
[The Dark Mod: depth-aware upsampling](https://bugs.thedarkmod.com/view.php?id=5850),
[Handmade: blue-noise jitter](https://handmade.network/p/75/monter/blog/p/7201-engine_optimization__fast_high-quality_cloudscape_through_noise_and_reprojection).

## Sessions
Each session starts on `track/air` (BRANCHES.md: check the branch, merge main, push), runs lint, typecheck and unit
tests after each change and the smoke check before its end, and ends with a HANDOFF entry and its tag. Behaviour
changes and renames never share a commit. New settings default to today's look unless the session says otherwise.

| # | Session | What | Done when |
|---|---|---|---|
| AIR-0 | Plan (done 2026-10-26) | this file, the research, the ROADMAP and BRANCHES rows | the owner approves |
| AIR-1 | Haze (done 2026-10-26: new dials at 0 keep today's look; HANDOFF has the proposed values) | `fogit`: the haze colour follows the sky gradient in the view direction (one shared GLSL sky function for the sky shader and `fogit`, so they can't drift apart); RGB extinction (`air.hazeTint`, red lost a little faster); height falloff with the analytic integral (`air.hazeFalloff`), also used for the low mist; separate dials for the broad sky glow and the sun glow (the `toSun` lobe softened) | unit tests for the shared JS twin of the haze maths; screenshots at dawn, noon, dusk and in fog weather before and after; the baseline changes only where intended |
| AIR-2 | Fog grid (done 2026-10-26: unread until AIR-3; the density in logic/fog-grid.js, the texture in walk/fog-grid.js) | new `walk/fog-grid.js`: a density grid round the player, 48x12x48 cells of about 1 m (32x8x32 on phones), from `groundHeightAt`, the water level, the weather's fog, the dawn mist, valley mist and a drifting noise; low ground and water fill first. An R8 3D texture, updated with `texSubImage3D` only when the player crosses a cell or the weather moves (a rolling origin, so a step uploads one slab); not built indoors. A debug view of the grid as blocks (debug menu only) | unit tests on the density (a hollow fills, a hilltop stays clear, no fog indoors); upload time in the debug log |
| AIR-3 | Lit march (done 2026-10-27: its own gate, `fogVolume`/`fogLamps` at 1; fogit's mist steps aside inside the grid; phone times from the owner's log still to come) | the march reads the grid: fog density x sun visibility (shadow maps) x phase + sky ambient + lamps; outputs the fog's colour and how much it hides (premultiplied), composited in the grade pass. The march starts nearer the camera inside the grid's box (not only the last 14 m). Phones: 10 steps. When the march runs, `fogit`'s low mist is off (`uMist` 0, one flag), so fog isn't counted twice; when it drops (quality step 3, lit rooms), `fogit` takes over | fog banks, sun shafts in fog and lamp glow at night in a fixture; the owner's phone frame times from the debug log within budget |
| AIR-4 | Edges and shadowed haze (done 2026-10-27: `hazeShade` 0.5 on by default; the picture baseline is CI's, remade after the merge) | a depth-aware blur and upscale replace `down` (nearest depth when shrinking); blue-noise jitter; the near haze (14-40 m) dims in shade from the march; Studio dials for every new `air` setting; a fog step in the in-game full test; the clean prop turntable zeroes the new settings; the baseline regenerated | the full quick check passes; no fog bleeding round the player, trees or roofs in screenshots |

About 4 sessions after AIR-0. AIR-1 and AIR-2 don't touch the same files and can run at the same time; AIR-3 needs
both; AIR-4 needs AIR-3.

## Ask the owner before
- ~~AIR-1: whether the haze colour should keep the scene's `haze` field where a place has one, or always follow the sky.~~
  Answered: keep it, shaped by the sky.
- After AIR-1: whether the proposed haze values (HANDOFF, AIR-1) become the game's defaults (engine.json `air`); that
  moves the quick-check baseline.
- ~~AIR-3: battles. They use the same march (`noVol` only at quality step 3); fog in battles is in scope only if the
  owner says so.~~ Answered (2026-10-26): not in AIR-3; battles keep fogit's mist. A grid round the battle stage is a
  later item.
- ~~AIR-3: if the phone frame times go over budget, which goes first: fewer steps, a smaller grid, or no lamps in fog.~~
  Answered: fewer steps (10 to 8) first, then no lamps in fog (`fogLamps` 0), then a smaller grid.
- AIR-3 (answered): fogit's mist steps aside only inside the grid, fading back in at its edge (`uMistBox`), not
  `uMist` 0 everywhere (the grid reaches 24 m, 16 on phones; the camera sees about 36).
- AIR-4 (answered by approving the plan, 2026-10-27): Shade in the haze **on by default** (`hazeShade` 0.5), since
  this session moves the baseline anyway. The CI picture baseline ("Make the picture baseline") is the owner's to run
  after the merge.
- Later (not planned): Hillaire's sky and aerial-perspective lookup textures to replace the hand-tuned sky.

## Risks
- Every lit shader calls `fogit`: a change there moves every screenshot. AIR-1 keeps the defaults on today's look and
  regenerates the baseline only where the owner accepts the change.
- The march today is gated on the shadow map existing and on `godRays`/`lightsInAir`; fog must not vanish when an
  owner sets light shafts to 0. AIR-3 gives the fog its own gate.
- Rooms, caves (`caveDark`), the bowl world map and the train ride's director frames (`BT.hazeK`) each change the haze:
  check each one in AIR-1 and AIR-3.
- A new module-level value needs a `setX` setter and `npm run modules` (CLAUDE.md gotcha).

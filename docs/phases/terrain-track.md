# Terrain track (TR) - smooth routes, mountains and height as gameplay

A track of its own, like the map generator track (owner's brief, 2026-10-21). It builds on MG-1 (game/js/logic/mapgen.js)
and the existing height layers; it adds no new scene format. Each session is tagged `tr-N-done`.

Before proposing anything: read the latest HANDOFF.md entries and recent merges (main was c2d51d6, PR #79, when this was
written) and check what MG-2 to MG-5 have already changed in mapgen.js. Report what is different from the facts below.

## Verified facts (2026-10-21, read from main)
- Two height layers. `scene.heights`: metre corners, Catmull-Rom between them kept within the four corners
  (walk/heights.js rawHeightAt), levelled under buildings (buildingPads). `scene.steps`: half-metre cells raised in 5 cm
  units (Int16, base64), with `stepm` per cell: wall material in the low 4 bits, 16 = one-way ledge, 32 = ramp
  (walk-view.js, steps v18 / slopes v23). MAX_STEP_RISE 0.34 m, MAX_HOP_DOWN 1.8 m.
- Ramps: stepGridCorners averages corner heights around ramp cells so a ramp meets the ground above and below with no
  riser. Natural edges (stepEdgeShape): rock drops of 0.7 m or more get a shoulder on top and scree below, at least
  0.45 m of face kept.
- Walking: the nav grid blocks smooth-land gradients over 1.05 (heights.js). Pace: up to 40% slower up steep ramps or
  stairs, up to 12% quicker down (walk-view.js v23). Ladders up cliffs exist (v28).
- Generator land: `mapgenStageHeights` is fbm at 26 m plus detail at 8 m, amplitude `hills * 2.6` (about ±2.5 m).
  `mapgenTerraces` makes bands across the depth rising toward the back (rise 0.4-1.6 m from `cliffs`).
- **The bug behind stepped roads:** in mapgenTerraces the road climbs a terrace by changing each half-metre cell's raise
  by up to 0.1 m, but mapgenScene writes `stepm` as all zeros (`new Uint8Array(G.S.length)`), so no road cell is a ramp.
  The road is a staircase of 5-10 cm risers every 50 cm. Also: the road corridor ends hard at `p.r + 0.75`, leaving raw
  walls of uneven height beside a cut, and the "lower until 0.25 m above a walkable neighbour" pass notches junctions
  and the hub round.

## Where this track sits on the roadmap (checked against main 072f993, 2026-10-21)
- The roguelite track is the spine (ROADMAP.md); nothing after RL-8 starts before the owner has played the first cut.
  This track follows the same rule: only TR-1 goes before RL-8.
- **TR-1 goes right after MG-2 and before RL-7** (or folded into MG-2, which touches the same mapgen code). RL-7 makes
  generated routes walkable, so without TR-1 the first playable cut shows stepped roads.
- **Merge the pixel-water patch first** (Engine water.bands / water.frames, 32 texels a metre; it applies cleanly to
  072f993). Every new surface, cliff face and water feature in this track follows that same 32 texels a metre grid
  with hard tones.
- The renderer already has nine water kinds (pond, stream, canal, spring, swamp, lake, sea, lava, ice) and a waterfall
  mesh (`fall`). TR-10 and TR-6 reuse them: marsh = swamp, lava and ice exist, waterfalls use `fall`. New kinds (hot
  spring with steam, oasis, rapids) mean growing the shader's kind arrays past 9.
- Run scenes are fixed at 112×64 with forward links N→S at t 0.25/0.5/0.75 (roguelite-track 2e), and MG-2 copies the
  parent's edge strip into the child. So big relief belongs on the free E/W sides (the massif mask), and N/S edges must
  match their neighbours. Climbing toward the boss comes from that continuity: each scene ends a little higher than it
  started.
- Any mapgen output change after RL-7 needs a `MAPGEN_VERSION` bump (a saved run with another version is abandoned)
  and a deliberate remake of rng.test's frozen scene hash. Batch changes into few version bumps.
- After the first cut: TR-2 to TR-7 alongside RL-9 to RL-11 (TR-2 starts with a phone measurement). The gameplay
  sessions wait for their RL parts: TR-8 needs RL-6 (forecast, clock), RL-11 (unlocks: climbing gear) and RL-12
  (effects: heal, damage). TR-10's weather-on-ground needs RL-6. TR-11's fossils need the ranch (RL-10), wrecks and
  salvage need RL-14, and rare features as unlocks need RL-11.
- Player UI: the dig minigame is a new screen (needs phase 06-5's split of ui.js, or one screen module); climbing gear
  sits on the Lab unlock board (RL-11); vines and ledges are walk interactions, no screen. The node map shows no
  terrain icons (owner's call). Studio dials and tools go on the Generate card (MG-4 owns presets and regenerate,
  so TR-7 comes after MG-4).

## Owner's decisions (2026-10-21)
- Walkable mountains go to **15 m or more**. The camera handles it with **all three**: rock in front of the player fades,
  the camera rises and looks down more steeply on tall ground, and a player silhouette shows through rock.
- Mountains are **both** a land dial usable in any biome and the default recipe of the `ridge` biome. Biomes may set
  their own default height recipe.
- Road cuts: **grassy banks in the wild, retaining walls in towns** (dressed stone; existing wall materials).
- Steep roads: **switchbacks for main roads, stairs for footpaths**.
- In mountains the road is laid by a **pathfinder** that avoids steep ground (the current curve shapes stay for gentle land).
- Mountain route types, all four: **valley floor, mountain pass, cliff ledge path, gorge with a rope bridge**.
- Generated cliff extras: **climbable vines, cave/mine entrances (doors into rooms), waterfalls off terrace edges**.
  **Vines replace ladders**: the generator places vines; existing ladders get converted or retired (propose which).
- **One-way ledges** are generated on routes (Pokémon style: shortcuts, loops), with a hop arc and a dust puff.
- Ground painting by height and steepness, all four: **rock on steep slopes, snow above a snow line, scree at cliff feet,
  a grass lip on terrace tops**. Cliff faces get **layered strata bands per biome**.
- Studio, all three: **a raise/lower brush that survives regenerating, a draw-a-ridge-line tool, feature presets**
  (crater, mesa, plateau, terraced farm, cliffside village...).
- Gameplay: **altitude encounter pools, trainers on ledges who spot you from above, items on hard-to-reach terraces,
  snow and storms by height**.
- Roguelite: **later nodes sit higher, the final boss on a peak**; **climbing gear is an unlock** that opens new paths in
  later runs. (Terrain icons on the node map and a separate mountain-pass node type were not chosen.)
- Battles on hilly ground use a **levelled arena** that keeps the local look.
- Towns get terrain (hillside towns, stairs between levels) **after the town generator (MG-3)**.
- Rivers that flow downhill come **after the mountains**.
- The smooth-road fix is applied to existing hand-made maps **only for the starting town (Copperleaf)**; everything else
  is legacy.
- Art stays HD-2D, 32px Pokémon-inspired pixel art; terrain textures are a committed style.

## Terrain features for variety (owner's decisions, 2026-10-21)
Features are **mostly gameplay**: each one changes encounters, pace, loot or the path, not only the scenery.
- **Land shapes, all:** mesas and plateaus, craters and sinkholes, natural arches and rock spires, dunes and rolling downs.
- **Water, all:**
  - waterfalls with a pool, and rapids you can't swim;
  - **hot springs and oases**: they heal your party (rare, a free heal on a route) and rare Billies gather nearby (fire and water types);
  - **marsh and bog**: they slow you down, have their own encounter pool (bug, poison, water) and hide items in the reeds;
  - **frozen lakes**: slightly slippery (hard to stop, no slide puzzles); the ice cracks, and if you fall in you respawn at the bank;
  - **lava**: you can't enter it, and walking right beside it drains your Billies' HP.
- **Ground surfaces, all:** ash, salt flats, cracked mud, moss, flower meadows, mushroom rings, crystal fields, mud after rain.
- **Weather changes the ground during a run, all:** rain makes mud (slower, different encounters), storms flood rivers
  (some paths close, others open), snow builds up over the run clock, heat dries marsh (shortcuts open).
- **Things on the land, all:**
  - boulders and fallen trees: obstacles, cover, places to hide items;
  - ruins and standing stones: lore, puzzles, rare Billies;
  - fossils and giant bones: dig on the route with a short dig minigame, then revive at the ranch;
  - robot and airship wrecks: wild bots guard them, they give salvage parts for later bot building, and they hold story clues about the bot faction.
- **Puzzle terrain:** currents and quicksand, pressure plates (open gates, drain water), dark caves that need light
  (a Billy or an item). No arrow or spin tiles.
- **Big landmarks, all:** giant tree, lighthouse, dam, wind farm, ruined tower, meteor crater.
- **Seasons:** each run rolls a season for the whole island (autumn leaves, spring blossom, winter snow...).
- **Density:** one big feature (the route's landmark) plus 2-3 small ones per route.
- **Biome fit:** mostly features that fit the biome, with rare surprises (a crystal field in a meadow now and then).
- **Roguelite:** rare features (ruins, wrecks, crystals and the like) enter the generator's pool as unlocks.

## Rules
- Deterministic and re-runnable as in the MG track (seeded streams; a new `seeds.relief` stream for mountain work).
- The scene format stays the game's own: heights, steps/stepm, tiles, props, bridges. Raise the heights range if the
  schema or the ground mesh needs it, and say so.
- Seams: heights pinned within 22 m of a joined edge, terraces at zero raise near a joined edge (MG-2's rule).
- Phone performance is the limit: measure ground triangles and frame time on 15 m mountains before and after.

## Sessions
| # | What | Checks before the tag |
|---|------|-----------------------|
| TR-1 | (folded into MG-2 by the owner, 2026-10-21) Smooth roads: road ramp cells flagged 32 in `stepm`; a graded shoulder beside cuts (bank in the wild, wall in towns, by biome/scene kind); a gradient cap with automatic switchbacks on main roads and stairs on footpaths; junctions and the hub round made with ramps instead of the lowering pass. One-off tool run on Copperleaf only. | unit test: no riser over 3 cm on any road cell; mapgenUnreachable sweep; a02_joins |
| TR-2 | Mountains: ridged noise plus domain warp, a massif mask (mountains on chosen sides), relief up to 15 m+; slopes too steep to walk become step-grid cliffs with scree; the mountain dial in every biome and as `ridge`'s default; the road pathfinder; the four route types (valley, pass, ledge path, gorge + rope bridge). | sweep of random dial sets reaching every exit; seam heights; phone frame time |
| TR-3 | Camera for tall ground: rock fade, camera rise on tall ground, player silhouette. | visual check steps, smoke |
| TR-4 | Look: painting by height and steepness (rock, snow line per biome, scree, grass lip), strata bands on cliff faces per biome. | picture notes, smoke |
| TR-5 | Terraces that follow the contours of the land (the old "rise toward the back" kept as a dial), edge styles; generated one-way ledges with hop and dust puff. | unit tests, unreachable check counts ledges as one-way |
| TR-6 | Cliff extras: climbable vines (ladders converted or retired), cave/mine entrances as room doors, waterfalls off terrace edges. | unit tests, room door check |
| TR-7 | Studio: raise/lower brush as a mask that survives regenerate, the ridge-line tool, feature presets. STUDIO.md. | MG-4 style test: a hand edit survives a regenerate |
| TR-8 | Height as gameplay: altitude encounter pools, trainers on ledges with sight down, items on hard-to-reach terraces, snow and storms by height; levelled battle arena. Roguelite hooks: node altitude rising toward a peak boss, climbing gear unlock gating paths. | unit tests, run sim |
| TR-9 | Feature framework: a feature catalogue in game data (biome weights, rarity, unlock id, size, gameplay hooks), placement of 1 big + 2-3 small per route, rare off-biome rolls, the run's season. Land shapes: mesas, plateaus, craters, sinkholes, arches, spires, dunes, downs. | unit tests, sweep: every exit still reachable with features placed |
| TR-10 | Water and surfaces: waterfalls, rapids, hot springs, oases (heal, rare Billies), marsh and bog (slow, pool, hidden items), cracking ice with a slight slip, lava (blocked, edge damage); the new ground surfaces; weather changing ground (mud, floods, snow build-up, drying marsh). | unit tests, a flooded-path check that keeps the main path open |
| TR-11 | Things on the land and puzzles: boulders, fallen trees, ruins, standing stones, fossils and bones (dig minigame, revive at the ranch), wrecks (bot guards, salvage, story clues); currents, quicksand, pressure plates, dark caves; the six landmarks. Rare features wired to the unlock pool. | unit tests, run sim |
| Later | Rivers flowing downhill (after TR-2); hillside towns (after MG-3). | |

## Checked at main 3479f01 (MG-2 session, 2026-10-21)
- Main had moved on from c2d51d6 and 072f993 (RL-2, RL-3, RL-4 and UI-1 merged). mapgen.js changed only by RL-2's move
  of its random numbers into logic/rng.js; MG-2..MG-5 had not started.
- The facts above hold: `stepm` is written as all zeros (mapgen.js:1592); ramp flag 32 (walk-view.js:2345,
  stepGridCorners); the road corridor ends at `p.r + 0.75` and the lowering pass notches (mapgen.js:1004, 1017-1046);
  slopes over 1.05 block walking (walk/heights.js:241); MAX_STEP_RISE 0.34 m, MAX_HOP_DOWN 1.8 m; wall materials 5
  (dressed stone) and 8 (stone steps) exist (walk/heights.js WALL_MATERIALS).
- **Copperleaf has no step grid** (no `steps` or `stepm`): TR-1's one-off run on it has nothing to convert. Its road
  grades are reported instead (HANDOFF, MG-2).
- **The pixel-water patch is not in the repository** (no branch or PR has `water.bands`). TR-1 adds no new surface,
  so it doesn't wait for it.
- MG-2 pins a joined edge's heights over the neighbour's whole band (the composer's NEIGHBOR_BAND_HALF_WIDTH, 26 m
  either side of the exit), which includes the 22 m above.

### The four questions, answered from the code (for TR-2 onward)
- **Heights for 15 m and more.** No schema or format limit: `heights` are plain numbers (map.schema.json), steps are
  Int16 in 5 cm units; test_slopes already reaches 14.4 m. What needs work: sun shadows aim at y = 0 with a 13 m near
  cascade (engine/light.js:377, walk/shadows.js:92), so the player leaves it at about 15 m up (centre it on the
  player's height, already worked out at shadows.js:52); the camera has no terrain collision and tilts up only 9°
  (walk/camera.js:76); ground textures are projected straight down and stretch on steep smooth slopes
  (walk-shaders.js:25); mist sits at an absolute height (lighting.js:296), so valleys fill and peaks stay clear.
  Cost does not grow with height: the ground is a uniform half-metre grid, about 82k triangles for a 112×64 scene
  with its border, one draw call, repeated in each shadow pass (walk/ground-mesh.js, walk/ground-draw.js).
- **Rock fade and silhouette.** Cliff walls already dither out near the player (walk-shaders.js:26, the player's
  screen spot from ground-draw.js:85); tall sprites, solid props and buildings fade; smooth slopes don't. There is
  no stencil and no depth pre-pass (webgl.js:576, 990): a silhouette is the player drawn again last with depth test
  GREATER and a flat tint, or a depth compare in the post pass (which already reads depth). Walls share the ground's
  draw call but sit in one block of indices (ground-mesh.js:294, 325), so they can be drawn or faded on their own.
- **Ladders.** One prop kind, `ladder`; climbing is walk-view.js:3325-3431 (`startClimb`, 0.9 + 0.55 s per metre).
  All 9 working ladders (`act: 'climb'` with `to`) are on legacy maps: cinderpeak, frostcrown, hornpass (2),
  kitewind (2), stepstone_canyon (2), thicket. int_barn and test_props have decorative ones. Vines can replace them
  with no live map to convert.
- **Altitude encounter pools.** In pools.json, the runtime table each place names (`{lv, list}`;
  game-data.js:252-259 copies only those two keys, so a new key must be kept there), not biomes.json (a generator
  recipe the game never loads). Wild encounters get their spot only when drawn, within 2.2-13 m of the hub
  (walk-view.js encounterCandidates), so height bands need the spot chosen when the encounter is made.

## Questions to answer in the first proposal
- How far the heights range and ground mesh stretch for 15 m+ relief, and the phone cost.
- How the silhouette and the rock fade are drawn in the current renderer.
- What happens to the existing ladder props and the scenes that use them.
- Where altitude encounter pools live in the data (pools.json or biomes.json).

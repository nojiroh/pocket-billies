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

## How Pokémon Gen 3-5 build their routes (research, TR-2 session, 2026-10-21)
The owner asked for routes much more like Gen 3-5 (Ruby/Sapphire/Emerald, Diamond/Pearl/Platinum, HeartGold/SoulSilver,
Black/White). Most wikis refused to be read from here, so the numbers come from the game's own map data: the Emerald
decompilation (github.com/pret/pokeemerald: `data/layouts/layouts.json`, each route's `map.bin` (metatile, collision
and level per tile) and `map.json` (trainers, their sight, items), the tilesets' behaviours), decoded for 13 land
routes (102-104, 110, 111, 113-116, 119-121, 123). Gen 4 and 5 facts are from wiki search summaries. A Gen 3 tile is
about the player's width, so one tile is read as about one metre here.

**What the data shows (Emerald)**
- **Size.** A route is a strip: 40 tiles wide and 60-140 long (north-south), or 20 tall and 50-140 long (east-west).
  A run scene (112 x 64 m) holds about two of the 40 x 80 routes' area.
- **Most of it is wall.** Only 31-65% of the tiles can be walked on (median 47%). The rest is a solid border: a tree
  wall, the "mountain top" rock (up to 1,200 tiles on Route 114) or water. A route is a network of corridors and
  pockets inside that border, not an open field with a road across it.
- **Few levels.** Walkable land has one ground level on most routes, two or three on the mountain ones (Routes 114 and
  115: levels 3, 4, 5 and 7), and a bridge level over water (110, 119, 120). Tall mountains are the border, not
  somewhere you walk: the climb happens a level at a time, by stairs, across several maps (Jagged Pass, Route 112).
- **Ledges everywhere.** 10-80 ledge tiles per route (0 on only two), in short runs of 3-10 tiles, mostly jumping
  south (toward the camera), some east or west, never north. They cut a route into bands you cross one way, make
  loops ("hop down to skip the grass"), keep the way back short and gate pockets you reach from above.
- **Grass in patches.** 3-6 patches of 15-70 tiles each (one route, 116, has many crumbs; 119 has one 475-tile field
  of long grass you can't see over). The way north usually runs through at least one patch; a ledge or a side path
  often lets you skip one in the other direction.
- **Trainers.** 0 on the first route, 4 on the second, 6-17 on later ones. Each looks one way and sees 1-7 tiles
  (median 3). They stand across the corridor or at a pocket's mouth, so most are hard to avoid, some are optional.
- **Things to find.** 1-9 visible items and 0-5 hidden ones per route, berry soil (2-18 spots), 1-11 signs. Items sit
  at dead ends, on ledged pockets and behind obstacles.
- **Each route has a gimmick:** ash on the grass (113), a sandstorm desert you need goggles for (111), long grass,
  rails and a waterfall (119), rain and puddles (120), a bridge level (110), muddy slopes only a fast bike climbs
  (111, 115).

**Gen 4 and 5 (search summaries)**
- Sinnoh: fog on the north of Route 210 and in Mt. Coronet; a winding series of bridges over rivers (210); Route 211
  split by the mountain, its east half a choice between grass and a flight of stairs up the mountainside; deep snow
  you can't run in and a blizzard that cuts the view (216, 217); a downhill cycling road (206); Rock Climb walls.
- Unova: seasons change routes. In winter snow banks reach ledges and item spots that are shut the rest of the year,
  and cover some cave mouths; in autumn fallen leaves show items. Big bridges are landmarks.
- Johto (HGSS): Route 45 is a descent down a ribbon of narrow cliff ledges; Route 38's lower path is a one-way express.

Sources: [pret/pokeemerald](https://github.com/pret/pokeemerald) (map data, decoded here);
[Bulbapedia: Ledge](https://bulbapedia.bulbagarden.net/wiki/Ledge), [Kanto Route 1](https://bulbapedia.bulbagarden.net/wiki/Kanto%20Route%201),
[Hoenn Route 113](https://bulbapedia.bulbagarden.net/wiki/Hoenn_Route_113), [Route 111](https://bulbapedia.bulbagarden.net/wiki/Route_111),
[Sinnoh Route 210](https://bulbapedia.bulbagarden.net/wiki/Sinnoh_Route_210), [Sinnoh Route 211](https://bulbapedia.bulbagarden.net/wiki/Sinnoh_Route_211),
[Sinnoh Route 216](https://bulbapedia.bulbagarden.net/wiki/Sinnoh_Route_216), [Bike obstacles](https://bulbapedia.bulbagarden.net/wiki/Bike_obstacles);
[Serebii: Black 2/White 2 seasons](https://serebii.net/black2white2/seasons.shtml);
[PokéCommunity: Mapping routes](https://daily.pokecommunity.com/2017/09/14/fangame-tutorials-mapping-routes/);
[RankedBoost: HGSS Route 45](https://rankedboost.com/pokemon/location/heartgold-soulsilver/route-45/).

**What it changes in this track**
1. **A route is corridors inside a border.** Today's generator makes an open field with a road across it and a belt
   of trees. Gen 3 walks about half the area and walls off the rest. The generator gets a walk mask: the road as a
   corridor 6-14 m wide with pockets, spurs and dead ends; the rest a solid border (a dense tree wall in the wild, the
   massif's rock, water, a town's walls). Target about 50-60% walkable for a run route (more than Gen 3, because
   the 3D camera sees further and a phone joystick needs room).
2. **Height comes in tiers, joined by stairs and ledges.** Walkable land sits on 1-3 tiers a cliff apart (the cliffs
   dial: 0.8-2 m, about one Gen 3 cliff). The road changes tier by a flight of stairs (stone steps, at most 0.3 m a
   step) or a ramp on main roads (TR-1); a ledge is the one-way way down. The tall massif (TR-2a's mountains, 15-20 m)
   is the border and the backdrop, walkable only on its foot. A run climbs a tier at a time across its scenes
   (later nodes higher, the boss on a peak), never 15 m inside one scene.
3. **Ledges move up from TR-5** into the route layout: short runs (3-10 m) that cut the route into bands, loops and
   pockets, counted one way by the reach check (TR-5's rule).
4. **Tall grass in patches across the path** (3-6 of 15-70 m², one the way north must cross, one a ledge or side path
   skips), instead of drifts beside the road.
5. **Pockets for things to find:** dead ends, ledged pockets and tier tops get marked spots that items, berry soil,
   hidden items and (TR-8) trainers use; a trainer's spot has a facing and a sight of 1-7 m across a corridor.
6. **One gimmick a route** from the biome and the feature catalogue (TR-9, TR-10): ash, sandstorm, long grass, fog,
   deep snow, puddles, a bridge level, a muddy slope only climbing gear climbs.
7. **Seasons open and close paths** (TR-10): winter snow banks reach a ledge or an item pocket, autumn leaves show
   items, snow covers a cave mouth.

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
| TR-2a | (done, TR-2 session) Mountains as the border: the `mountains` (0-1, up to 20 m) and `massif` (sides) dials, ridged noise plus domain warp under a massif mask, its own `relief` seed; steep ground as step-grid shelves and cliffs; kept off the road, hub, exits and water; the Studio dials; the debug menu's mountains run for the phone measurement. | sweep of random dial sets reaching every exit (with the slope rule); seams of a mountains run; phone frame time (owner) |
| TR-2b | Gen 3 route layout, part 1: the walk mask (corridors 6-14 m, pockets, spurs, dead ends, a solid border of tree wall, massif or water, about 50-60% walkable); tiers (1-3, a cliff apart) joined by stairs on footpaths and ramps on main roads; the massif's foot walkable by stairs to a pocket; marked spots (pocket, dead end, tier top, trainer spot with facing). | sweep: every exit reached, walkable share in range, every pocket reached; seams; picture notes |
| TR-2c | Gen 3 route layout, part 2: generated ledges (moved from TR-5: short runs, loops, one-way in the reach check, hop arc and dust puff); tall grass as 3-6 patches across the path; the road pathfinder through tiers and the massif; the four mountain route types (valley floor, pass, ledge path, gorge with a rope bridge) as recipes of these parts. | unreachable check counting ledges one way; grass on the way north; sweep; phone frame time |
| TR-3 | Camera for tall ground: rock fade, camera rise on tall ground, player silhouette. | visual check steps, smoke |
| TR-4 | Look: painting by height and steepness (rock, snow line per biome, scree, grass lip), strata bands on cliff faces per biome. | picture notes, smoke |
| TR-5 | Terraces that follow the contours of the land (the old "rise toward the back" kept as a dial), edge styles. (Generated ledges moved to TR-2c.) | unit tests |
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

## Ask me before (from the Gen 3-5 research, TR-2 session)
- **Walkable height.** The owner chose walkable mountains of 15 m or more. Gen 3 walks a few tiers per map and keeps
  tall mountains as the border. Proposed: 1-3 walkable tiers per scene, the massif above as border and backdrop, the
  run climbing a tier at a time across its scenes.
- **How much is walkable.** Gen 3: about 47%. Proposed for run routes: 50-60%, the rest a solid border.
- **Which way ledges jump.** A run goes north (away from the camera). Gen 3's ledges jump south, toward the camera
  (back toward where you came from): loops and quick ways back inside a scene. Or north: shortcuts forward.

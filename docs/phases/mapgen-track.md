# Map generator track (MG) - Generate in Studio → Walk scenes

A track of its own, like the Studio track (owner's brief, 2026-10-20). A Generate card in Walk scenes makes a whole
route or town from dials and a seed, live in the 3D preview, as a draft that becomes a scene only on Accept. Each
session is tagged `mg-N-done`.

## Rules (from the brief)
- Deterministic: the same params and seed give the same scene (a seeded RNG per stage, no Math.random).
- Re-runnable: the scene stores `gen: {v, params, seed, seeds}`; generated props carry `g: 1`; regenerating replaces
  only generated things and never hand-placed ones; `keep` locks the scene completely.
- Draft first: the output is a draft in the preview; nothing reaches D.maps until Accept; Accept is one undo step and
  saves with Ctrl+S / Propose changes as usual.
- The scene format is the game's own (tiles, heights, steps/stepm, props, hub, edgeExits with path and len, streams,
  bridges, the look keys). No new scene format.
- The logic is one module, game/js/logic/mapgen.js (no DOM, runs in Node), so the Studio and a batch tool share it.

## Decisions (owner, 2026-10-20)
- Biome recipes live in a new game/data/biomes.json (schema, data check): ground letters, the plants by family,
  trees, the look keys (sky, haze, far, amb...), default water kind.
- Named generator presets are game data (saved like the Engine presets), not localStorage.
- tools/build-places-v46.py stays, with a header warning (below); the batch tool becomes a Node CLI on mapgen.js.
- Linking to a neighbour with no free exit is refused, unless "add an exit to the neighbour" is ticked: that adds an
  edgeExit (and a short path stub) to the neighbour and touches nothing else of it.

## Sessions
| # | What | Checks before the tag |
|---|------|-----------------------|
| MG-1 | mapgen.js for routes: RNG, heights (hills, terraces), ground, road (straight, winding, S-curve, switchback; carve, flatten, pave, verges), exits and hub, growth (the grow-wild rules, fixed), one feature, props. biomes.json. The Generate card with its dials, a draft in the live preview. | unit tests, lint, types, data |
| MG-2 | Accept: the place (map file, index.json, locations.json with a bowl spot), link to neighbours (seam roads, exits facing and aligned, the neighbour's seam strip read), "Preview as seamless pair", save and propose. | unit tests, a Studio check step, a02_joins on the pair |
| MG-3 | Towns: main street, side lanes, square, landmark, lots (level, door to the street, clear footprint, turned along curves), kind mix, colour variants, gardens and fences, townsfolk spots. | unit tests, smoke |
| MG-4 | Presets, per-stage reroll, regenerate-only-generated (props by `g`, ground by a mask), the keep lock, dials restored from `gen`. | unit tests: a hand edit survives a regenerate |
| MG-5 | Check panel rules (hub reaches every exit, nothing in water, door gaps clear, exits face their neighbour), a quick-check step (generate, accept, save, reload, walk the seam), STUDIO.md. | full quick check, Studio check |

## Verified facts (2026-10-20; corrections to the brief)
- Roads have no step cost (phase 08): `{id, name, kind: 'seam', a: {map, exit}, b: {map, exit}}`; the length is the
  two exits' `len` in metres, worked out at load (game-data.js:270-315). A new exit needs `path` and `len`.
- The `@v45` backups are gone (19 deleted earlier); local Studio backups need start-studio.py, which is not in the
  repository. On GitHub "Propose changes" (a branch and a PR with only the changed files) is the safety net.
- There was no biome table: `biome` is a tag on locations (sounds, weather). Plants go by ground letter (`grow`,
  `family`, `weight` on 70 props); the look of each place was written by the build tools.
- The "12 m blend" is `grown2` (a marker of a legacy tool). The seam is eased at runtime (seamless-world.js: heights
  over 8-14 m within 22 m of the exit, tiles over 2.6 m, look over 14 m). What must line up is what check-data.mjs and
  check-quick's a02_joins test: opposite sides, equal width, the along-edge positions an integer apart (0.5 m), the
  same heights (5 cm) and tiles within 6 m of the exit, a straight walk across.
- `keep` was read by the Python builders only (build-places-v46, v47 regions, landmarks, life); grow-wild.py ignores
  it. No map has it.
- Encounters come from tall-grass ground `t` (walk-view.js encounterCandidates), not from the tall-grass props.
- build-places-v46.py: its exit bearings come from locations' lat/lon, which no location has any more (bowl instead),
  so every bearing is 0; a run would also drop the margins (grown2), worn and could rename road exits. Most of its
  layout code is the Scene class in build-scenes.py; its towns and routes are hand-placed coordinates.
- grow-wild.py: PAVED ('pcmbaqheo') doesn't know gravel or dirt paths, its steps test reads the base64 string as if it
  were cells (no effect), plants that grow on 'o' never grow. The port uses terrains' `paved`, the path letters and
  the distance to the road instead.
- Python's Mersenne Twister output can't be matched without porting it; mapgen.js has its own RNG and new output.
</content>
</invoke>
<invoke name="Bash">
<parameter name="command">cd /home/user/pocket-billies && sed -n 1,25p tools/build-places-v46.py
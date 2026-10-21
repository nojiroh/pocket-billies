# Legacy tools

Generators that built the old hand-made places and their art. The roguelite loads only the hub (Copperleaf Town);
every other map is legacy (CLAUDE.md, docs/VISION.md), and the map generator (game/js/logic/mapgen.js) replaces the
place builder. These are kept so the old maps can still be rebuilt or studied; nothing in the game flow, the checks
or CI runs them. Moved here in RL-1's follow-up (2026-10-21). Run them from the repo root, as before:
`python3 tools/legacy/<file>`. They still use the kits in tools/ (gamedata.py, build-scene-props.py, build-tiles.py...).

| File | What it made |
|---|---|
| `build-places-v46.py` | the v46 towns and routes from place rules. **Do not run without `--dry`**: see its header (no location has lat/lon any more). |
| `build-regions-v47.py` | the seven v47 regions' places, roads, trainers, shops and lore, with build-places-v46's rules |
| `build-region-props-v47.py` | the props for those regions |
| `build-landmarks-v47.py` | a landmark for every place whose lore names one (clock tower, giant tree, crane...) |
| `build-life-v47.py` | washing lines, crates, chalk, cats and worn shortcuts in the old towns |
| `build-v28.py` | ladders up the cliffs and the player's house in Sundown |
| `build-terrain.py` | the v46 ground tiles (art/next/tiles, now only on the `legacy` branch); the live ground tool is `tools/build-ground.py` |

Most write only what is missing, and several have `--dry` or `--preview`; read each header first.

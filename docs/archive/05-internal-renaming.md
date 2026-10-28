# Phase 05 - Internal renaming (clean break)

## Goal
Descriptive, consistent internal names with no compatibility baggage.

## Rules
- Internal names only. One rename per commit. No behavior change in a rename commit. No migration maps.

## Tasks
1. Code names: replace cryptic globals (SC, GD, ST, RM, tw, at) and cryptic files and prefixes (diorama, owmon, dio...) with descriptive names. camelCase functions, PascalCase types, kebab-case files.
2. Data ids and keys (species, location, item, lines, route; prop fields ox, oy, img, vol, vox, solid, box, fx, group) get final clear names in the same pass as the per-entity JSON files.
3. Apply the vocabulary in docs/NAMING.md as separate commits, in this order: `map` (the overview) -> `worldMap`; `scene` (a walkable area) -> `map`, keeping `scene` where it means the 3D renderer's scene; `place`/`stop` -> `location` (each map carries a `locationId`); `road`/`link` -> `route`; battle stage -> `battleStage`; `vox` -> `model`. Name the shared strip between two maps `seam`.
4. Finalize docs/NAMING.md and enforce it with lint rules where practical.
5. Regenerate the quick-check baseline once after the renames.

## Ask me before
The final names for the road/link and seam concepts; anything touching player-facing text.

## Done when
No cryptic globals remain, NAMING.md final, baseline regenerated, tag `phase-05-done`.

## First reply
Same four items as phase 01, plus a rename table (old -> new) for me to approve.

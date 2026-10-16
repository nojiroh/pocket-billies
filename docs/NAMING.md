# Naming (starter draft; finalize and enforce in phase 05)

Internal names only. Player-facing words stay unless a phase says otherwise.

## Concept vocabulary (proposed)
| Concept | Name | Meaning |
|---------|------|---------|
| The 3D bowl overview | `worldMap` | the new bowl-shaped world map (was `map`) |
| A walkable area (town, route, room) | `map` | was `scene` |
| A named place on the world map | `location` | was `place` / `stop`; owns one or more maps; each map carries a `locationId` |
| A link between locations | `route` | was `road` / `link` (`route` is also a place kind, so decide carefully) |
| The shared strip where two maps join | `seam` | or `border`; pick one |
| 3D renderer scene | `scene` | keep, it correctly means the 3D scene |
| Battle backdrop | `battleStage` | |
| Your customizable home | `ranch` | starting town |
| Creature kinds | `billy`, `robot` | |
| Robot pieces | `part` (slots: torso, leftArm, rightArm, legs), `gem` | |
| Hidden organization | `organization` | final name in phase 15 |
| Prop recipes (was `vox`) | `model` | they make low-poly meshes |

## Conventions
- camelCase for functions and variables, PascalCase for types and components, kebab-case for file names.
- Descriptive names. No new single-letter or two-letter globals.
- Replace cryptic globals (SC, GD, ST, RM, tw, at) and prefixes (dio..., owmon) with descriptive module names.
- Prop fields (ox, oy, img, vol, solid, box, fx, group) get clear names in phase 05.
- Data ids get their final names with no migration map.
- New ids follow this file. Lint rules enforce it where practical.

## Order of the concept renames (separate commits)
1. `map` -> `worldMap`   2. `scene` -> `map`   3. `place`/`stop` -> `location`   4. `road`/`link` -> `route`   5. battle stage -> `battleStage`

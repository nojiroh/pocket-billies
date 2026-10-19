# Phase 10 - Proposed links between regions (NOT in the game yet)

These roads do not exist. They are notes for later: each one needs its walkable-map edges built (phase 08 rules),
a story check deciding when it opens, and the world-graph test baseline updated in the same commit. Until then the
world graph stays exactly as it is (56 seams + 1 lift).

They were picked from layout 1 (the spiral): neighbours from different regions that sit close on the bowl, whose road
would cross no existing road, and whose land suits each other.

| # | Link | Why it feels natural | Exits (local compass on the bowl) | Story check before it opens |
|---|------|----------------------|-----------------------------------|-----------------------------|
| 1 | Capshade Town <-> Gloomwater Pool | Mushroom roots grow down into the cave pool; Spore Forest and Crystal Caverns meet underground | Capshade `east` (free) <-> Gloomwater `west` (free) | After Mother Morel's badge (7) |
| 2 | Frostcrown Town <-> Petalfall Vale | Meltwater runs from the summit down into the flower valley | Frostcrown `east` (free) <-> Petalfall `west` (free) | After Leader Poppy's badge (5), so the Meadowlands are not skipped |
| 3 | Twinpetal Town <-> Grapevine Hills | A vineyard lane from the meadow town into the hills | Twinpetal `south3` (south and south2 taken) <-> Grapevine `north` (free) | After Leader Poppy's badge (5) |
| 4 | Kelpport City <-> Skygarden Walk | A sky lift from the harbour up into Cloudspire | Kelpport `east` (free) <-> Skygarden `west` (free) | Post-game: once Cloudspire is open |
| 5 | Nimbus City <-> Zenith Steps | Cloudspire's town opens straight onto the climb to the Inner Sun | Nimbus `east` (free) <-> Zenith Steps `west2` (west taken) | Post-game: the Inner Sun story beat |

## Special links from Copperleaf (owner's request)
These are not walking roads. Like the existing glass lift (Kelpport <-> Pearlantis, `kind: lift`), they need no map
edges: each is a station you enter in one town and leave in the other. That keeps the seams and the bowl layout as they
are; on the bowl they show as a dotted arc, not a road.

| # | Link | Why it feels natural | Kind | Story check before it opens |
|---|------|----------------------|------|-----------------------------|
| 6 | Copperleaf Town <-> Kelpport City | Water runs down the walls to the floor; an old canal under Copperleaf leads up to the harbour by boat | `lift`-style (canal), station in each town | Post-game: once the Coral Trench is open; maybe needs the Ride rule |
| 7 | Copperleaf Town <-> Nimbus City | A sky lift (cable car) from home up to Cloudspire, a quick way back after the long climb | `lift`-style (sky lift), station in each town | Post-game: once Cloudspire is open |

More of this kind can be added the same way (a station in Copperleaf, one in the far town).

For each link, when it is added:
- Build the two edge strips on the walkable maps (the seam must line up, phase 08 checks).
- Add the road to `roads.json` with its gate or story flag.
- Update the world-graph test baseline in the same commit.
- Place the road on the bowl (layout positions already allow it; length 0.12-0.21 of the bowl radius).

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

For each link, when it is added:
- Build the two edge strips on the walkable maps (the seam must line up, phase 08 checks).
- Add the road to `roads.json` with its gate or story flag.
- Update the world-graph test baseline in the same commit.
- Place the road on the bowl (layout positions already allow it; length 0.12-0.21 of the bowl radius).

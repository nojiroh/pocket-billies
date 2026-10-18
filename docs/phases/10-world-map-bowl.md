# Phase 10 - World map: 3D bowl

## Goal
A new, always-3D world map shown as the inside of a half sphere (a bowl) with clouds and simplified terrain. It must feel intuitive on a phone. All existing towns and routes stay (same connections, gates, costs and airship stops); only their positions and the visuals change.

## Verify first (legacy figures from alpha 0.4.1)
- map.js (~17 KB) and map-gl.js (~38 KB) draw the current 3D map with miniatures of each stop. 49 places each have `lon` and `lat` (the start town "Marigold Town", id sundown, is at lon 0, lat 0). Roads branch and loop; each road has a step count; some places are under the ground; every town has an airship station.
- The Studio has a drag-and-drop world-map editor.

## Tasks
1. Audit the current map code, the place and route data, gates and regions.
2. Propose TWO layouts on the bowl (say where the start town sits, which direction progression runs, where each region goes and why), with a flat sketch of each, and ask me. Routes must not cross in confusing ways and distances should make sense.
3. Keep the graph identical. Add a test that the set of locations, routes, gates and requirements is exactly the same as before. The layout must also respect how the walkable maps join edge to edge (the neighbour graph from phase 08): if a bowl position would need a different adjacency or edge direction, tell me before changing anything.
4. Camera and controls (phone first): drag to orbit around the bowl, pinch to zoom, tap a location to open an info card with a Travel button, a Home button that recentres on the current location, smooth easing, limits so the camera never leaves the bowl or enters terrain; mouse support too (wheel zoom, drag). Ask me before locking the camera model.
5. Simplified terrain: low-poly heightfield per region using the terrain textures from phase 09 (32 px/m style); regions readable at a glance; routes drawn as clear paths; labels that stay readable; location markers as small low-poly miniatures (reuse the existing ones where they fit).
6. Clouds: layered low-poly or soft clouds drifting at several heights, fading when the camera is close. Quality setting (off, low, high) and a phone frame-time budget.
7. Travel: an animated airship hop along the route (the airship model exists), skippable, using the new travel cost decided in phase 08 (step costs are gone).
8. Retro-futuristic solarpunk look: greenery on structures, wind turbines, solar sails, rounded arches, warm and pastel colours. Ask me about the bowl's sky and any central light.
9. Replace the old map code and update the Studio's world-map editor so you drag locations on the bowl surface.
10. Tests: graph unchanged; every location reachable and tappable; travel works; screenshot baseline; phone frame-time numbers.

## Ask me before
The layout choice; camera limits; sky and central light; travel animation length.

## Done when
The new map replaces the old, graph test passes, phone frame times reported, Studio editor updated, tag `phase-10-done`.

## First reply
Same four items as phase 01, plus the two layout proposals.

## Testing (phase 13)
Follow docs/TESTING.md: where new tests go, what must pass before the phase ends, and its section for phase 10.

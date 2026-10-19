# Phase 10 - World map: the bowl

Part of roadmap Phase E. Sized in sessions; no hour estimates.

## Goal
Replace the full-sphere world map with the lower half of the Hollow Earth: a bowl, the Inner Sun hanging above its
centre, the ground generated from region terrain, seen from above like a diorama. All places and roads stay the same
(the graph does not change); only positions and visuals change. It must feel intuitive on a phone.

## Decided (owner, 2026-10-19)
- **Geometry:** lower half only. All land sits in the bowl; the upper half is sky.
- **Progression:** centre outward. Copperleaf (the start town) at the bottom centre; regions spiral outward and up the
  walls; the Inner Sun region ends at the rim.
- **Camera:** over the bowl. Orbit above it like a tabletop, zoom down towards a place, never below the rim line.
- **Ground:** generated from region terrain textures and heights. `art/map/world.png` and `world_h.png` are retired.
- **Light:** the Inner Sun overhead, always noon; soft bloom and cloud shadows as today.
- **Travel:** an airship hop of 2-3 s, scaled a little by distance, tap to skip.
- **Underground / sealed places:** Pearlantis is a small marker under Kelpport with a dashed lift line, not its own spot
  on the ground.
- **Kept from today's map:** the Places list.
- **Markers (2026-10-19):** pins for now, no miniatures; the bowl is always the map (without WebGL the Places list).
- **Walk-scene sky (2026-10-19):** the bowl's far wall rising round the horizon, sky above.
- **Opening fall:** past the Inner Sun and down into the bowl towards Copperleaf.
- **Relief:** gentle and readable.
- **Opening the map from a walk scene:** the walk camera rises, then the bowl pulls back from right above you.
- **Dropped:** Flat view; the CPU-drawn fallback (when the GPU context is lost, show the Places list and a "map
  reloading" note); the gold trip line and the pins.
- **Depth:** medium. A flat-ish floor, walls rising to about 45 degrees at the rim.
- **Relief:** each region has its own low-poly relief (volcano peak, canyon cut, trench dip, Cloudspire terraces).
- **Driftwreck:** Palmhaven is placed south of Driftwreck to match the walkable maps; no map data changes.
- **New links:** allowed, but only as notes for now (`10-proposed-links.md`). Each needs edges, a story check and a
  graph-test update before it enters the game.
- **Feel:** the layout should feel authentic and natural.

## E-map-1 result (2026-10-19): owner chose layout 1; the proposed links are kept as notes
Copperleaf also gets proposed special links (canal to Kelpport, sky lift to Nimbus); see `10-proposed-links.md`.
Sketches and data in `docs/phases/10-bowl/` (made by `tools/layout/`).
- **Layout 1, spiral (recommended).** On the bowl a map's north faces the centre and its east runs counter-clockwise.
  Today's order rolls round the bowl and rises up the wall; the Inner Sun ends high at the rim. All 56 seams point
  within 30 degrees of their exits; no roads cross. Frostcrown and Hornpass sit beside the start, so the floor gets a
  central peak (as in a crater). The empty lower third of the bowl becomes open sea around Driftwreck Bay.
- **Layout 2, natural basin.** North points up the wall instead (sea low, peaks high). Six seams end up 34-90 degrees
  off and eight roads cross; it would need walkable-map edits. Shown for comparison.

## What exists today (reuse)
- `game/js/world-map-gl.js` (1554 lines): GPU drawing on the walk scene's canvas, Inner Sun bloom, clouds and cloud
  shadows, 49 landmark miniatures, Places list, pinch and pan, camera easing.
- `game/js/world-map.js` (818 lines): camera, picking, road curves, cloud list; the CPU ray-cast renderer (to delete).
- `game/art/map/mini/` (49 miniatures): keep as the place markers.
- `game/js/airship.js`: the airship model and the flight arc over the map; retarget it to the bowl.
- `studio/js/world-map-painter.js` (880 lines): paints `world.png`; becomes the bowl editor (below).
- `tools/test/world-graph.test.mjs`: the graph test already runs in the fast check.
- Data: 49 places in `locations.json` (lon/lat today spans about 335 degrees, so it cannot simply be squeezed onto a
  half sphere), 56 seams and 1 lift in `roads.json`, 11 regions (by `region` / `t`).
- Known data issue: Driftwreck's south exit leads to Palmhaven, which sits mostly west on today's map. The new layout
  fixes this rather than copying it.

## Sessions

**E-map-1 Layouts (no code).** Two centre-outward variants (for example a spiral versus rings with spokes), each as a
flat top-down sketch: every region placed, Copperleaf at the centre, every seam's exit direction checked against the
layout, and any adjacency the bowl cannot honour listed. Owner picks one.

**E-map-2 Geometry and data (done 2026-10-19).** Bowl positions in `locations.json` (proposal: `bowl: { a, r }`, azimuth in degrees and
0-1 from centre to rim; lon/lat removed once nothing reads them). Road curves rebuilt on the bowl surface. New Node
test: every seam's exit direction agrees with the layout (within a tolerance). The graph test stays green.

**E-map-3 Camera and controls (done 2026-10-19; the bowl is always on, places are pins, debug menu → Bowl map test).** Drag to orbit, pinch or wheel to zoom, smooth easing, limits so the camera stays above
the rim line and out of the terrain, a Home button that recentres on the current place, tap a miniature to open the
card with a Travel button. Locked and visited states shown on the miniature and the card (pins are gone).

**E-map-4 Ground and routes (done 2026-10-19, with the old map deleted, the airship flight and the opening fall on the bowl, the walk sky's far wall, the zoom-out from the walk scene, and the world map test in Settings).** A low-poly heightfield per region generated from region data, using the chapter-09
terrain textures (32 px/m); regions readable at a glance; routes drawn as paths in the ground; labels that stay
readable; miniatures standing on the ground. Delete `world.png`, `world_h.png` and their loaders.

**E-map-5 Sky, clouds, travel (the airship hop is done; clouds remain).** Inner Sun above the centre; layered clouds at several heights that fade when the camera
is close; cloud quality setting (off, low, high) with a phone frame-time budget. The airship hop retargeted to the bowl,
2-3 s, skippable, using the metre-based trip from `tripTo`.

**E-map-6 Studio and clean-up (old map code, art and painter deleted; the Studio drags places on the bowl; region terrain editing remains).** The Studio world map becomes a bowl editor: drag places on the bowl surface, edit a
region's terrain and height settings, live preview. Delete the CPU renderer, Flat view, trip line, pins and the old
painter code. Node tests pass; then the owner's phone test.

## Owner's part
- Pick a layout after E-map-1.
- Phone frame times after E-map-4 and E-map-5 (graphics are tested only on the owner's devices; no headless graphics).

## Still open (ask before the session that needs it)
- E-map-5: cloud count and heights per quality level.

## Tests
Node only: graph unchanged; every place reachable; seam directions match the layout; every place has bowl coordinates
and a miniature; travel plans unchanged by the move. No screenshot baselines.

## Done when
The bowl replaces the old map, the Node tests pass, the owner has reported phone frame times, the Studio editor works
on the bowl, and the old map code is deleted.

## Ground and landmarks (planned 2026-10-19, owner's answers)
- **Each place's real ground** drawn on the bowl as pixel art at about 1.5 m a pixel, sharp (no blur), each walk map
  turned the way it sits on the bowl (north to the centre), so its roads, water, plazas and cliffs show where they are.
- **Between places:** each region's real ground textures (their average colours) with a pixel-art dither, not a soft
  blend. Mesh about 320 cells; each place's own hills and slopes from its map.
- **Buildings, by zoom (owner: both):** far out, one oversized landmark per place (Copperleaf's oak, the clinic dome,
  Verdigris' towers, windmills, airship masts, Cinderpeak's smoke, Frostcrown's snowy top), chosen per place and set in
  the Studio; closer in, each town's real buildings to scale from its walk map, using the low-poly prop models.
- **Trees (owner: clumps):** groups of low-poly trees where the walk maps have woods, in each region's kinds (pines,
  mushrooms in the Spore Forest, crystals in the caverns).
- **Pins (owner: fade when close):** pins far out; up close a small name tag and the buildings take over; the picked
  place and you always show.
- **World map test:** the new ground, models and draw time.


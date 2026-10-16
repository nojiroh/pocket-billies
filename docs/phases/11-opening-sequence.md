# Phase 11 - Opening sequence

## Goal
Rework the opening. It is a scripted cutscene (no player control): a map-like 3D scene of a cyberpunk city with tall buildings and flying cars; a silhouette walks along the street below; a strange portal suddenly opens; when the figure steps through, the game goes into the "falling through the air" sequence and arrives in the Hollow Earth. The story stays Hollow Earth, told as an alternative future.

## Verify first
- The legacy opening (opening.js ~23 KB, cutscene.js ~23 KB, with a FALL sequence and a "fall through the crust and wake" in the first town, id sundown / name Marigold Town) already includes a falling sequence. Reuse it where it fits.

## Tasks
1. Audit the current opening and list what to reuse, change and delete.
2. Write a beat sheet (target 30-60 seconds, skippable by tap, shown once then skippable always): city establishing shot, flying cars in lanes overhead, the silhouette on the street, the portal opens and swirls, the figure steps through, fall, arrival.
3. Build the city scene in the airship style: tall neon buildings, signs, rain or haze if it fits the budget, flying cars moving on splines (instanced), a portal effect (swirl shader). It is a camera-directed scene, not a walkable map.
4. Hide the player's identity in the silhouette; character creation happens later. Ask me when (after the fall, or at the ranch).
5. Place subtle hints of the shadowy organization in the city (a logo on a building or vehicle) to plant the background story (see phase 15).
6. Connect the fall to the arrival in the starting town and the first dialogue with a talking portrait (phase 07).
7. Phone budget: frame times and load time reported; a lighter version for weak devices.
8. Tests: the opening plays start to finish without errors, skip works, no console errors, screenshot checkpoints.

## Ask me before
When character creation happens; how dark or neon the city should look; the length of the sequence.

## Done when
New opening plays from first launch through the fall to the arrival, skippable, tag `phase-11-done`.

## First reply
Same four items as phase 01, plus a beat sheet with timings.

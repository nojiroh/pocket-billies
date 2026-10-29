# Phase 03 - Fresh base and scope reset

## Goal
Start over as a clean new base: version 0.1.0 alpha, the old game preserved, and only what the new design needs kept. Read docs/VISION.md first.

## Verify first
- The README mixes the names Net Worth (v47.x) and Pocket Billies (alpha 0.x). Where is the version stored? (game code, Studio, service worker cache name, saves, debug log header, README.)
- Which systems the new design drops: real-world step tracking and everything driven by steps (step costs, pacing, hatching by steps, step history, step UI). Walking, seamless maps and rooms STAY.

## Tasks
1. Preserve the legacy: tag the current state `legacy-final`, keep a `legacy` branch, and keep a zip of the last build. New main keeps only what is reused.
2. Reset versioning: the game is now **0.1.0 alpha**. Propose the scheme for later releases (for example 0.1.0 alpha, 0.1.1 alpha, 0.2.0 alpha) and ask me. Make the version a single source of truth (one file) read by the game, the Studio, the service worker cache name, saves (`saveVersion`), the debug log, the README and the changelog.
3. Start a new CHANGELOG.md with a 0.1.0 alpha entry. Move the old changelog to docs/archive/LEGACY-CHANGELOG.md. Do not carry the old version history into the new README.
4. Use one game name everywhere. Recommend one (the repo is called pocket-billies) and ask me.
5. Audit every system and folder and classify it KEEP, REWRITE or DELETE. Propose the list and wait for approval. Likely KEEP: WebGL2 renderer, Billy battle engine and rig, walking maps with the joystick, seamless maps and in-place rooms (cleaned up in phase 08), Studio core, Firebase accounts and friends, debug and test tools, save framework, UI shell, audio. Likely REWRITE: opening, world map, portraits, UI screens. Likely DELETE: real-world step tracking and every step-driven mechanic (replacements decided in phase 08), Lite mode (ask), legacy migration code, retired/ folders.
6. After I approve, remove the DELETE items from main (they remain on the legacy branch). Do the deletions in small commits.
7. Regenerate the quick-check baseline once. Remove or replace tests that targeted removed systems and keep CI green.

## Ask me before
The version scheme; the game name; the KEEP / REWRITE / DELETE list; deleting anything not on the approved list.

## Done when
Version 0.1.0 alpha shows everywhere from one source, legacy is tagged and branched, approved deletions are done, new baseline recorded, tag `phase-03-done`.

## First reply
Same four items as phase 01, plus the proposed KEEP / REWRITE / DELETE list.

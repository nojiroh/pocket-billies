# Phase 14 - Studio

## Goal
A faster, more professional Studio, extended with editors for the new systems. The reviewer only read the README and file sizes (~454 KB of JS), not the Studio code, so everything below is a direction to verify.

## Tasks: performance and polish
1. Performance: lazy-load sections; pause hidden 3D previews; virtualize long lists; patch-based undo instead of full snapshots; move heavy pixel and validation work to Web Workers.
2. Polish: forms generated from the schema, a live Check panel, autosave drafts to IndexedDB, an unsaved-changes indicator, loading states, a keyboard-shortcuts sheet, basic keyboard accessibility.
3. The per-entity data split should give clean pull request diffs. Check that "Propose changes" produces readable ones.
4. Apply the login and token decision from phase 02.
5. Extend Playwright coverage for edit, save, undo and propose-changes.

## Tasks: new editors
6. World map editor: drag locations on the bowl surface, edit routes (phase 10).
7. Map editor (the existing walk-scene editor, updated): terrain, props, characters, encounter tables, the neighbour graph and rooms (phase 08).
8. Portrait editor: import layers, drag anchors, preview expressions and animations (phase 07).
9. Prop and terrain editor with variants (phase 09).
10. Ranch catalog editor (phase 12).
11. Robot part editor with a 3D assembly preview, stats, abilities and gems (phase 17); Billy part libraries and breeding rules (phase 16).
12. Story editor for dialogue, expression tags and organization clues (phase 15).

## Ask me before
Anything that changes how I save or propose data from the Studio.

## Done when
Measured improvements reported, new editors work with the new data formats, tests pass, tag `phase-14-done`.

## First reply
Same four items as phase 01.

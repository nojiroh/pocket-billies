# Studio track (ST) - a more intuitive Studio

A track of its own, like Project Story: it runs alongside the numbered phases (owner, 2026-10-19). It does the
art-tool half of phase 14 early because phases 16 and 17 need the parts tool. Phase 14 keeps its performance and
polish tasks. Each session is tagged `st-N-done`.

## Decisions (owner, 2026-10-19)
- Screens: built for 3440 x 1440. Tablet and up must work; phones are not needed for the Studio.
- Layout: resizable panes with presets, no docking library. Extra width can show list + editor + inspector, front and
  back side by side, the game preview always open, and two sections at once.
- One **Art workbench** with modes Sheet, Part, Pixels and Model, opened from Billies, Robots and Props with the
  right thing loaded.
- 3D models: made in Blender, Blockbench, MagicaVoxel or AI generators. An import becomes a textured mesh (airship
  style, its own texture, a new mesh format version). The 32 px/m check warns and offers a resample. Warn above
  about 2,000 triangles. Export is for a Blender round trip (pivots, spins and joints survive). Models have spinning
  and jointed parts; no skinning.
- Robots stay 2D. Their sockets are stored per part instead of computed from picture sizes.
- Sheets: true-scale pixel art, AI images drawn at about 4x (snap-to-pixels step), Aseprite JSON or other apps. A
  template grid (like the kits' rows, now partKits.json `kits`) or free auto-detect. Front and back on one sheet or two,
  matched by name, then by position.
- Parts, in this order: phase 16 kits (parts.json), robots, the current species sheets (rigs-next.js). A joint holds
  a pivot, named sockets, turn limits, draw order per view and socket rules (which slots may attach).
- Flip: "Flip pixels" changes the art; "Mirror to other side" makes a mirrored copy (legL -> legR). Pivot and
  sockets follow in both.
- Pixel tools: symmetry drawing, lock to the game palette (next/palette.js), onion skin front/back. Size M is drawn;
  S and L are scaled, with an optional hand-painted override.
- Golden is dropped. In its place a general **variants** system that the Studio can extend without code.
- tools/slice-part-kit.py is retired once the Studio slices the existing kits the same way.
- New formats save through the same "Save to game" / "Propose changes".

## Sessions
| # | What | Checks before the tag |
|---|------|-----------------------|
| ST-0 | This file. Remove Golden (one cause per commit). Variants format, its Studio editor, and drawing a variant in the game. | unit tests, quick check, phone check by the owner |
| ST-1 | Layout shell: CSS grid columns from custom properties with drag/keyboard handles, container queries, wide layouts at >=1920 and >=2560 px, saved per section, presets, a two-section split. The 1180 px cap goes. | screenshots at 1024, 1920, 3440 |
| ST-2 | Shared pixel canvas (out of sprites.js): integer zoom, grid from 8x, tools, flip H/V, rotate 90, symmetry, palette lock, onion skin, patch undo inside the global undo, Aseprite-style keys, `?` shortcut sheet. | unit tests, Studio smoke |
| ST-3 | Workbench Sheet mode: drop anywhere; grid and auto-detect slicing (8-connected islands, merge gap, min area); snap to pixels (detect scale, nudgeable grid, most common colour per cell); trim; naming templates; Aseprite JSON; front/back matching. Writes parts.json. Parity test against slice-part-kit.py, then retire it. | parity test |
| ST-4 | Part mode: front and back side by side, pivot crosshair (drag, arrow-key nudge), labelled sockets, turn limits, draw order per view, socket rules, test fit onto a body, mirror to the other side, S/L override painting. | unit tests |
| ST-5 | Robots on the workbench: stored sockets, falling back to today's computed ones. | robot build test, battle preview |
| ST-6 | Species sheets in Part mode (rig rects, pivots, z). Skeleton builder and wardrobe painting move onto the shared canvas. | skeleton tests, full Studio check |
| ST-7 | Model mode import: hand-written GLB/glTF reader, OBJ, the existing .vox path; mesh format v2 (own texture, 0-1 UVs, joints, spins); texel density check (area-weighted px/m per face) with a resample fix; triangle warning; texture painting; preview in the game renderer. | unit tests on sample files |
| ST-8 | Model mode export: GLB/OBJ with pivots, spins and joints kept in node data (extras) for a Blender round trip; voxel props to meshes. | export -> import round trip test |
| ST-9 | Polish: art in the global undo everywhere, one unsaved marker per section, Check warnings next to their fields, hover help, STUDIO.md, tests. | full quick check |

## Verified facts (2026-10-19; corrections to phase 14)
- The Studio is about 690 KB of JS plus 57 KB of CSS (phase 14 said ~454 KB).
- parts-editor.js edits the part rules (rules.json `parts`), not art.
- Layout: `#studio` is `232px 1fr`; every media query is max-width (collapse only); `.ed-col.solo` caps at 1180 px;
  side panels are fixed 300-340 px; one container query.
- Models: voxel recipes (game/art/scene/vox, `.vox` import exists) and prebuilt meshes (airship, mast, station) made
  only by tools/build-airship.py, 24-byte vertices whose UVs are metres on the building sheet. No OBJ or glTF.
- Parts: three systems - species piece sheets + rigs-next.js, phase 16 kits (parts.json, sockets as fractions per
  view), robots (separate PNGs, sockets computed in robot-art.js `robotRig`, none stored).
- Pixel editing: three editors (sprites.js, wardrobe.js, skeleton painting), each with its own undo, art outside the
  global undo, no vertical flip, no symmetry.

## ST-5: robots on the workbench (2026-10-19)
- robots.json gained, all optional: a part's `art.joints` (per view `pivot`, a torso's `sockets`, `z`), a torso's
  `art.headJoints`, `turn`, `headTurn`. Points are fractions of the picture, stored in whole pixels (3 decimals).
  The socket standard (phase 17 task 11): neck, shoulderL, shoulderR, hipL, hipR, hip (treads, hover), gem.
- game/js/logic/robot-joints.js: `robotJointComputed` (today's numbers), `robotJoint` (stored, else computed; a back
  point not stored keeps the front's offset from the pivot; stand-ins ignore stored points), `robotKit` (robots.json
  as a part kit: `<torso>:head`, `gem:<id>`, hidden `<id>_r` copies so partForSide never mirrors a robot limb),
  `robotJointSet`. robot-art.js `robotRig(sp, D, k)` places the bones from view k's joints.
- Parity: tools/test/robot-rig-before.json holds a hash of every build's rig as robotRig made it on 9b731cf (972
  builds, pictures and stand-ins, front and back); the rig still matches, also with every point stored.
- Corrections: the back view always reused the front's positions (the front and back pictures differ by a pixel or
  two); that is kept as the fallback. The rig's `geo.top` is 2 px under the head's top; it is worked out from the
  front. The battle preview could not show robots (its pickers took Billies only, and it loaded Billie sheets).
- Found and fixed: Part mode in the second pane drew nothing; it looked its elements up with `paneRoot()` after
  loading pictures, which is the left pane outside a drawing (`wbpRoot` finds its own pane). Sheet mode
  (workbench.js) still uses `paneRoot()` in its drawn-later code (5 places): not fixed, untested in the second pane.
- For ST-6: the same pattern (a derived kit for Part mode, edits routed to the real data) fits the species rigs.

## ST-4: the Art workbench, Part mode (2026-10-19)
- partKits.json gained, all optional: per kind `z` (front/back), `turns`, `sides` (the side its art is drawn for);
  `socketRules` (socket name -> slots); per part `z`, `turn`, `accepts`, `mirrorOf`; per view `pivot` and `sizes`
  (S/L pictures beside M). Kind defaults: z from the rework placeholders' bones (arms 8/2, legs 7/7, tail 1/8, head
  9/9, crests 10/10), turns first guesses (arms ±60, legs ±35, tails ±30, heads ±20).
- game/js/logic/part-joints.js: `partJoint` (a view at a size), `partSocketsFor`, `partFit` (draw list), `partMirror`,
  `partScaledPixels`; tests in tools/test/part-joints.test.mjs. studio/js/workbench-part.js: the mode.
  pixel-canvas.js: `hostTool` may return `{ move, up }` to follow a drag (`pixelCanvasPointF`).
- Corrections: the kits' pivot per kind is not where the game joins parts; tools/build-rework-placeholders.py joins a
  limb by its joint socket, a head by its chin, a tail by its base. So an unmoved pivot is that socket. The kit draws
  arms for the right side and legs for the left (the placeholders mirror arms on the left shoulder, legs on the right
  hip), now `sides`. Write rebuilt every entry from scratch, which would have lost Part mode's work; it keeps it now.
- Found, not fixed: the Studio's undo snapshot and its Save leave out keys starting with `_`, so any Studio save drops
  `_help` from partKits.json, portraits.json, robots.json and rules.json (older than ST-4).
- For ST-5: robot sockets can be stored the same way (per view sockets, `socketRules`); `partFit` takes any part with
  views. For ST-6: Part mode's overlay and drag are the model for rig rects and pivots.

## ST-3: the Art workbench, Sheet mode (done 2026-10-19)
- The part list moved: game/art/next/parts/parts.json is now the data file game/data/partKits.json (key `partKits`,
  schema, data check), and kits.json's kits, slots, pivots and sockets moved into it. The Studio can save only pictures
  under art/ and start-studio.py is not in this repository, so the list had to become data (owner's pick).
- game/js/logic/sheet-slice.js: background keys (a colour, magenta, clear; optionally only background joining the
  edge), masks, islands (4/8-connected, merge gap, minimum area), rows by their gaps, template grid, trim, names,
  front/back matching, Aseprite JSON, and the kits' steps (scipy's opening, dilation and labels; Pillow's box filter
  with its fixed-point rounding; the old double unpremultiply and pink clean-up). logic/pixel-snap.js: pixel size and
  grid from where edges gather (noise under a threshold ignored), most common colour per cell.
- Parity: every kit sheet gives the committed parts exactly (240 pictures, sockets, manifest order); in the browser
  too (writing the beasts kit again changes no picture and no data). Then tools/slice-part-kit.py went.
- studio/js/workbench.js: section `workbench` (Billies & battles); a drop anywhere opens it. The sheet shows on
  `pixelCanvas` (a host tool picks parts and the background colour). Write: pictures as one undo group
  (`artSteps`, `historyArtGroup`; a new picture's undo drops it, `forgetArt`), then the parts as a data step.
- Corrections: the kit pictures keep a transparent margin of about 1-2 px (the slicer cut the grown box), so a part's
  box is not its art's box; generic islands are trimmed.
- For ST-4: Part mode can start from `partKits.parts` (pivot, sockets per view) and `wbParts()`'s pieces; sockets are
  still worked out from the outline only (the old auto_sockets).

## ST-2: the shared pixel canvas (done 2026-10-19)
- game/js/logic/pixel-ops.js: the pixel work as numbers (line, fill inside a box, flips, quarter turns, symmetry,
  palette colours and the nearest one, what is off the palette, patches, zoom steps) and the key table PIXEL_KEYS;
  game/js/logic/history.js: the Studio's one undo stack (data snapshots and picture patches in one order, 80 steps and
  64 MB of pictures). Both tested in Node.
- studio/js/pixel-canvas.js: `pixelCanvas(stage, o)` (o: get, path, ids, repeat, boxAt, focusBox, overlay, onion,
  hostTool, hover, changed, drawn), `pixelCanvasPanelHTML` / `pixelCanvasPanel` (symmetry, palette, onion),
  `pixelCanvasToolsHTML` (a tool bar for a host without one), `pixelCanvasAct` (what a key does), `artStep` (a
  picture step: the box that changed, before and after; a size change keeps the whole picture) and `artStepPut`.
  A picture undone or redone fires `studio-art` on document; an open canvas of that path redraws.
- Users: sprites.js (the sheet editor; skeleton.js's Paint pixels opens it) and map-editor.js (props and ground
  tiles; its keys go to the canvas only while the pointer is over it, so B and E still paint the map elsewhere).
  wardrobe.js still paints on its own (ST-6).
- Corrections: skeleton.js never had a painter of its own; there were three painters (sheets, wardrobe, props and
  tiles). The undo snapshot now leaves out `_` keys as saving does: the map's height cache (`_hg`, with a clock) made
  every undo in Walk scenes only take that back.
- Onion skin: centred on the part's box, not on the pivot (front and back place their pivots differently, so the
  pivot put most back parts beside the front ones).
- For ST-3 and ST-4: build Sheet and Part modes on `pixelCanvas` (a `boxAt` per part, `overlay` for pivots and
  sockets, `hostTool` for the pivot drag); `artStep` for anything that changes pixels outside a stroke.

## ST-1: the layout shell (done 2026-10-19)
- Sizes are custom properties (`--nav-w`, `--list-w`, `--side-w`, `--pane-cols`). game/js/logic/studio-layout.js holds
  the numbers (width classes, limits, the saved layout, presets; tested in Node); studio/js/layout.js puts them on the
  page (handles, presets, the second pane). Saved in localStorage `studio-layout`.
- Not CSS container queries: `container-type` on a pane makes it the box its fixed children are placed in (the big
  3D view, the story reference), so a ResizeObserver gives each pane `data-w` = narrow / wide / ultra and the CSS keys
  off that. Window-level media queries stay as they were.
- The second pane is `#main2` (`studioState.sec2`); `renderPane(root, sec)` draws a section into either, `paneRoot()`
  is the pane being drawn (for afterRender), `sectionShown(k)` replaces `studioState.sec === k` in gates that must run
  in either pane. `PANE2_REFUSED` keeps the four 3D sections on the left; a section is never in both panes (its ids).
  The Studio check fails if two sections the second pane can show share an element id.
- Handles: the section list, `.split` and `.props-sec` lists, the battle preview's side panel, between the panes. Not
  yet: the skeleton builder and pixel editor (they get wider defaults; ST-2 rebuilds them on the shared canvas).
- tools/studio-shots.py: pictures and element boxes at any widths (`--compare` for a no-op check).
- For ST-2 to ST-4: the workbench should use `--list-w`/`--side-w` and `.pane[data-w]` so it fits a pane of the split;
  the skeleton builder's zoom is still 2.5x on a 3440 window (the shared canvas fixes that).

## ST-0: every use of Golden (2026-10-19, on main 4cd4fb6)
Golden is a game feature, not only art. "gold" is also a colour, a coin and a button style (`c: 'gold'`, `pb gold`,
`kind='gold'`); those stay.

Game rules and data
- game/data/rules.json: `encounters.goldOdds` (512), `eggs.goldOdds` (512) and `goldOdds10` (128), `fishing.goldOdds` (64).
- logic/rules.js:317, 350 (`gold` on a made Billie), 742 (the encounter roll).
- logic/battle-engine.js:234 (copied into the fighter), 958-970 ("A wild Golden ...", "It shimmers ...").
- fishing.js:121, 389. story.js:140 (`gold: false` on legends). talk.js:282 (a townsperson's rumour).
- The egg hatch roll that reads `eggs.goldOdds` (to find in the egg code; ui.js:626 shows "a Golden ...").

Drawing
- skeleton-rig.js:454-455 (`_gold.png` in rigAtlas), 546 (`data-g`), 559 (bust).
- `rigParts(sp, gold, ...)` callers: battle-stage.js (580, 757, 895, 1091, 1255, 1473; 778 the gold shimmer),
  battle.js:244-245, walk/prop-look.js:142-148, world-billies.js:293-510 (443 the glints in the grass).
- `{ gold: m.gold }` in rigCanvasHTML / bustHTML: ui.js (537, 571, 597, 627, 831, 1261, 1690, 2206), battle.js:712,
  bag.js:125, friends.js:356, unit-card.js:61-105 (the Golden tag).
- friends.js:188, 229, 454 (shared buddy and pet carry `gold`).
- debug-menu.js:111, 232-251 (the Golden checkbox).

Art
- 129 `game/art/next/billionaires/*_gold.png`, 1.3 MB. tools/build-roster-sheets.py and build-starter-sheets.py write them.

Studio
- sprites.js: `goldFrom`, `atlasPath`, the "Front/Back golden" tabs and the "Golden version" panel.
- skeleton.js:33, 278 (putPart repaints the gold sheet). data-editors.js:175, 376, 382 (the Golden preview switch).
- battle-preview.js:69-70, 118-119, 137-138, 239-240, 311-323. world-rules-art.js:779, 826-827 (the odds fields).

Tests and checks
- tools/test/setup-fixture.mjs:30, 40; `gold: false` in battle-formats, parts tests; self-test.js:740, 801.
- tools/check-quick.py:434, 877, 1151, 1418, 1460 (needs `_gold.png`), 1484, 1506.

Saves: old saves may carry `gold: true`. CLAUDE.md says old saves do not matter; the field is just ignored.

### Proposed order (one cause per commit)
1. Stop rolling Golden (encounters, eggs, fishing) and remove the odds from rules.json, the Studio and the fixture.
2. Remove the Golden words (battle lines, hatch title, fishing toast, the rumour) and the unit card tag.
3. Remove the shimmer and the grass glints.
4. Remove the `gold` argument from rigAtlas / rigParts / rigCanvasHTML / bustHTML and every caller.
5. Remove the Studio's Golden tabs, panel, preview switches and goldFrom.
6. Delete the 129 `_gold.png` files and the gold output of the two sheet builders; update check-quick.py.
7. Add variants: format, Studio editor, game drawing (separate commits).

### Coats (decided and built, 2026-10-19)
The owner named them **coats** (not variants: the Variants are a group of people and props have variants) and chose
ramp swaps plus exact swaps, odds per coat (none at first) and optional hand-painted sheets.
- game/data/coats.json, keyed by id: `{ name, ramps: { from: to }, swap: { "#old": "#new" }, odds: { wild, egg, fish },
  art: { <species>: { front, back } } }`; schema game/data/schema/coats.schema.json; check-data checks ramps, species
  and pictures. game/art/next/palette.js now loads on the game and Studio pages.
- game/js/logic/coats.js: `coatColorMap`, `coatRecolor` (nearest palette shade within 24, only swapped shades move),
  `coatRoll` (no odds: no random number drawn), `coatArt`.
- Game: `rigAtlas(sp, view, coat)`, `rigParts(sp, k, coat)`, `rigPreload([[sp, k, coat]])`, `rigCanvasHTML`/`bustHTML`
  `{ coat }`; one recoloured sheet per sheet and coat, cached. A Billie or encounter carries `coat`.
- Studio: the Coats section; coat pickers in Billies and the battle preview.

### Variants (the first proposal, kept for the record)
A variant is a named palette recolour: `{ id, name, swaps: { "#rrggbb": "#rrggbb", ... }, art?: { view: path } }`
in a new `game/data/variants.json`, applied as the rig is drawn (a cached recoloured atlas per species and variant).
Optional hand-painted override sheets replace the recolour. A Billie carries `variant: '<id>'` or nothing.
Open: whether any variant is rolled in the wild (a rare-encounter replacement) or only given by story and breeding.

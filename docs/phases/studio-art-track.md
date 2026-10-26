# Studio art track (SA) - every piece of art viewable and editable in the Studio

Branch: track/studio-art

The owner's brief (2026-10-26): "Make it so all art in the game is easily viewable and editable in the studio. Do
online research on how to make the studio better and more intuitive. Look at what things can be removed or changed
that don't fit into the current Vision of the game or if they don't really have a function anymore."

Planned 2026-10-26 on `ccr-a073cfde-ab64xh` (the track branch didn't exist yet; the owner makes `track/studio-art` from
main, and SA-1 starts there). Reviewed at main b87b818d. Tags `sa-N-done`. Builds on the Studio track (ST-0..ST-6)
and the Studio roguelite improvement plan (docs/plans/studio-roguelite-improvement-plan.md: T4.5 and T6.8 are taken
over by SA-4 here).

## Decisions (owner, 2026-10-26)
1. **Ground tiles:** the 936 PNGs in `game/art/next/tiles47` are the source. The Studio paints them directly and
   `tools/build-terrain-v47.py` retires (as tools/slice-part-kit.py did in ST-3), so a rebuild can't overwrite them.
2. **Unused art:** delete the clear orphans (git history and the `legacy` tag keep them); move legacy-only art
   (postcards and flags of legacy towns) under a legacy folder that the Studio shows read-only.
3. **Clean-up goes into the game too:** Jobs goes, Town shops goes (the boutique names move to the Wardrobe), the dead
   Rules and Trainers fields go, and so does the walk-egg code left from step tracking, with its rules.
4. **Branch and order:** `track/studio-art`, SA-1 (the Art browser) first.

### Decisions (owner, 2026-10-26, SA-2's plan)
5. **Lite tiles:** the Studio makes the 16 px Lite tiles from the 32 px tiles47 set (the retired builder did it), so
   Lite keeps in step. (Found in SA-2a: only the 40 kinds the builder added were made that way; the 38 older kinds'
   Lite tiles were drawn by hand and stay until the owner asks for them, per kind.)
6. **SVG icons:** the SVG files become the source and `tools/build-ui-icons.py` retires (SA-2b); its test keeps the
   names, the count and the code's uses.
7. **The other builders** (pyramids, walls, buildings, flags, effects, life) stay; the Studio says, wherever it
   shows their art, that running them again can draw over edits.
8. **SA-2 is split:** SA-2a (tag `sa-2a-done`) and SA-2b (tag `sa-2-done`).

## What was found (verified against the code, 2026-10-26)

### Art the Studio can't show or edit
- **Art files is stale** (world-rules-art.js `ART_GROUPS`, about line 1035). 4 of its 10 tabs name folders that don't
  exist (`billionaires`, `background`, `pyramids`, `items`), so they are empty. `scene/`, `next/`, `trainer/`,
  `robots/`, `people/`, `coins/` and `postcards/` have no tab; together they hold about 3,700 of the about 3,850 art
  files. It can Replace or Download a picture, not paint it, and SVGs can't be replaced. The file list itself
  (github.js `files`) already holds the whole tree; only the tabs filter it wrongly.
- **The real ground can't be opened.** `next/tiles47` (78 kinds x 12, 936 tiles) is the only full-mode ground
  (walk-view.js); the Studio's tile painter edits the 16 px `scene/tiles`, which only Lite mode draws.
- **Shown, not editable:** robot pictures (the Robots help says "upload under Art files", which has no robots tab),
  pyramids and coins (`coins/`), the 51 UI icons (`ui/*.svg`), the icon atlas (one sheet; its rectangles in
  `art/manifest.js` aren't editable), type glyphs (code, `ui-kit.js` `TYPE_GLYPHS`).
- **Not in the Studio at all, or a name in a list:** `scene/fx`, `scene/life`, `scene/far`, `scene/flags`,
  `scene/build` (walls, rooms, detail), `scene/models` (the airship), `postcards/`.
- **Drawn in code** (opening fall, train carriage, pixel sky, battle particles): shown where a preview exists; not
  moved into data (a lot of work for little gain).

### Art nothing loads (to be checked again before deleting, SA-5)
- Orphans: `art/people/` (18), `ui/loader-coins.png` and `loader-runner.png`, `battle/cloud_3-5.png`, 71
  `scene/props/*_vN.png` building renders plus `clinic_pearl.png` and `flag_pole.png` (variants are recolours now),
  `next/billionaires/hand/` and `hand/concept/` (an archive of the part library).
- Legacy-only: 15 of 16 postcards (all but copperleaf), the town flags of legacy towns.
- **Kept on purpose:** the portrait kit (`next/portraits`, 311 pieces, portraits.json): nothing reads it yet, but
  32-bit portraits are phase 07's target in VISION.md. The palette PNGs (the palette tool reads them).

### Studio parts with no function or that don't fit the Vision
- **Jobs** (`jobs.json` is `{}`; the game reads no jobs) and its Find entries (find.js).
- **Town shops** (`shops.json` is `{}`; only boutique names are read: dressing-room.js, walk-control.js).
- **World & encounters** opens on the legacy Route stops tab; the Eggs tab has km tiers from step tracking; the live
  "What's new" (`meta.whatsNew`, title.js) sits in a legacy tab beside the dead `meta.endText`. Find indexes route
  stops.
- **Rules** fields nothing reads: `start.starterEgg`, `eggs.dropChance`, `eggs.dropTiers`, `battle.restCost`. The walk
  eggs (`addEgg`, `hatchEgg` in logic/rules.js, `eggs.capacity`, `slots`, `mythOdds`, `mythSpecies`, eggs.json tiers in
  metres) have no caller. Ranch eggs (breeding.js) are separate and stay. "Every number that tunes the game" is not
  true any more (run, ranch, parts and robots are elsewhere).
- **Trainers:** the km "First-win egg" (nothing reads it), the route-gate badge help, "Stands at" a stop.
- **Art workbench:** the Pixels and Model buttons are always disabled.
- **Roster board:** its text says "117 Billies … v35"; the roster has 46.
- **Local mode leftovers** (dropped by the owner 2026-10-22): `window.STUDIO_KEY` in studio/index.html, the
  `X-Studio-Key` header in studio-app.js, STUDIO.md's "Saving in local mode".
- **Confusing navigation:** "Parts" means four things (Part sizes, Workbench Part mode, robot parts, the skeleton's
  part slot); pixels are painted in five places; Copperleaf's map in two sections; Looks (key `people`) and Wardrobe
  apart; a group "Moneys" holding only Items; Perks are `relics` in code and "Loopholes" in STUDIO.md; Generate is a
  hidden mode of Walk scenes.
- Not art, noted for later: banter, relations, events, factions, modifiers, rewards and quests have no editor
  (RL-16's ground, not this track's).

## What the research says (2026-10-26)
- **One browser over every asset** with thumbnails, a size slider and type filters: Unity's Project window
  (`t:` and `l:` search tokens), Unreal's Content Browser (stacked filters, collections), Godot's FileSystem dock
  (thumbnails, favourites). https://docs.unity3d.com/2020.2/Documentation/Manual/ProjectView.html ,
  https://dev.epicgames.com/documentation/en-us/unreal-engine/filters-and-collections-in-unreal-engine ,
  https://godotengine.org/article/godot-gets-new-filesystem-dock-3-1/
- **"Used by" for each asset** is what makes edits and deletes safe: Unreal's Reference Viewer, Unity's Find
  References. https://docs.unrealengine.com/4.26/Basics/ContentBrowser/ReferenceViewer ,
  https://docs.unity3d.com/Manual/search-ref-prop.html
- **One search for commands, settings and assets** that shows where each lives: Blender's F3 menu search, VS Code's
  command palette. https://docs.blender.org/manual/en/2.83/interface/controls/templates/operator_search.html ,
  https://code.visualstudio.com/api/ux-guidelines/command-palette
- **Workspaces instead of one long tool list:** Blender. https://docs.blender.org/manual/en/4.2/interface/window_system/workspaces.html
- **A live preview beside the canvas** (Aseprite's preview window, Piskel's layout) and an immediate connection to
  what you make (Bret Victor, "Inventing on Principle"). https://www.aseprite.org/docs/preview-window/ ,
  https://hacks.mozilla.org/2012/04/bret-victors-inventing-on-principle-and-a-few-things-it-inspired/
- **Unused assets are reported, never deleted on their own:** GDevelop's "Remove all unused" (project only, files
  stay). https://forum.gdevelop.io/t/identify-unused-extensions-resources/51960
- **Checks in the editor:** palette (Aseprite's indexed mode, Lospec palettes), texel density (Unreal's view mode).
  https://aseprite.org/docs/color-mode/ , https://docs.unrealengine.com/udk/Three/ViewModes.html
- **Consistent patterns across tools, made by watching people work:** David Lightbown, *Designing the UX of Game
  Development Tools*; LDtk's "do less, but do it right". https://www.routledge.com/products/9780429174308 ,
  https://ldtk.io/about/
- Not confirmed by the searches (so not used as evidence): Unity's thumbnail slider, Godot's quick open, write-ups of
  the Witness's or Hades's editors.

## Sessions
| # | What | Checks before the tag |
|---|------|-----------------------|
| SA-1 | **Art browser** in place of Art files. Folders from the real file tree (never a hard-coded list), breadcrumbs. Thumbnail grid: size slider, nearest-neighbour, checkerboard. Search with tokens (`dir:`, `w:`, `h:`, `unused`, `legacy`) and chips from the same parser (a pure module in game/js/logic, unit-tested). A detail panel: path, size, frames, palette notes, **Used by** (a reference index from the data, scenery, rigs, model recipes and the art paths the code names). Actions: **Edit pixels** on any PNG (the shared pixel canvas, one undo), Replace, Download, **Open in its editor** (Billies, Workbench, Wardrobe, Props, Walk scenes, Robots). Ctrl K finds art files. STUDIO.md. | unit tests (search, reference index), Studio self-test, check-studio-github.py, smoke |
| SA-2a | **The missing editors, part 1** (done 2026-10-26). Ground tiles: `tiles47` as a tile set (kind x 12), painted with a tiled live preview laid by the game's own pick; the Lite tiles made from it (decision 5); `tools/build-terrain-v47.py` retires (decision 1). Robot pictures: paint and upload from Robots and the browser. Pyramids. An animated preview for frame strips, so effects and life are previewed. The builder warning (decision 7). | unit tests, Studio self-test, check-studio-github.py, smoke |
| SA-2b | **The missing editors, part 2.** A text-file save (SVG and manifest.js, kept as drafts). SVG icons: a small text editor with a live preview; `tools/build-ui-icons.py` retires (decision 6). The icon atlas's rectangles. Far backdrops, flags, building walls and rooms (a tiling preview for the wall and detail cells), each with a preview. | unit tests, Studio self-test, check-studio-github.py, smoke, the owner's look on the phone |
| SA-3 | **Clean-up**, one cause per commit (decision 3). Studio: Jobs and its Find entries; World & encounters without Route stops and Eggs, opening on Wild encounters, What's new moved to Game, Find without route stops; the dead Rules fields; the Trainers egg, badge and stop fields; the Workbench's disabled buttons; the Roster's stale text; the local-mode leftovers. Game: the walk-egg code and its rules and eggs.json tiers (ranch eggs stay), Jobs and Town shops data with the boutique names moved to the Wardrobe (data first, then readers, then the section). Each removal verified by grep before and the checks after. | lint, typecheck, check:modules, check:data, unit tests, smoke, Studio self-test |
| SA-4 | **Navigation.** Workspaces: Art (the browser, Workbench), Creatures, World, People & story, Runs (Robots join: bots are the enemy faction), Sound & UI, Legacy. Looks and Wardrobe as one "Characters" entry; "Part sizes" labelled "Part rules"; the Moneys group goes. Labels only (Studio words, no internal renames, no player-facing words). STUDIO.md's names brought up to date (Perks, not Loopholes). Takes over the improvement plan's T4.5 and T6.8. | studio-layout tests, Find finds every section, Studio self-test |
| SA-5 | **Unused art.** The browser's missing/unused report (from SA-1's index). Then decision 2: orphans deleted, legacy postcards and flags moved under legacy (the Studio shows them read-only); each list checked again with grep and the full check first. | full quick check, the report shows 0 orphans |

## Pushing back
- **3D models** stay where they are: made in Blender and the like; import and export are ST-7 and ST-8.
- **Art drawn in code** is shown, not moved into data.
- **The portrait kit** stays (phase 07).
- Hot reload into a running game tab and shared asset collections are good ideas from the research, left for after
  SA-5.

## Ask me before
- Anything SA-5 would delete that the grep finds a use for.
- Splitting a session that runs long.

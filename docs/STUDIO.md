# Pocket Billies Studio

The Studio edits the game's data, skeletons and art. It runs from the game's site (`…/studio/`): sign in with a GitHub
token, and **Propose changes** puts your changes on a new branch with a pull request, so nothing changes in the game
until the owner merges it. That is the only way it runs: the old local mode (a server on your own computer that
saved straight into `game/data`) was dropped (Studio plan, owner's decision 2026-10-22).

## Propose changes: what it does, and what happens when it fails (Studio plan Phase 0)

- **What is sent.** Every picture, the rigs and the data you changed, as one commit on a new branch
  (`studio/<you>-<date>-<time>-<4 letters>`) and a pull request against main. Nothing is marked saved until GitHub
  has opened the pull request; then only what is still as it was sent is. A picture you paint, or a field you change,
  while it is sending stays unsaved for the next proposal.
- **When it fails** (no connection, GitHub busy, a permission missing), the toast says so and **nothing is lost**:
  everything stays unsaved ("Unsaved changes" stays in the top bar) and Propose sends all of it again. If the branch was made before the
  failure, the retry reuses it.
- **An expired sign-in** opens the sign-in card over the Studio. Sign in with a new token and the same changes are
  sent; Cancel keeps them unsaved. There is no need to sign out (Sign out does lose unsaved changes).
- **If something can't be packed** (a bad id, a picture that won't encode), nothing is sent and the toast names it.
- **Main has moved on.** The Studio reads the game at the commit main was on when you opened it, and makes your
  proposal on that commit. If main has new commits that changed files your proposal also writes, a question names
  them first: *Propose anyway* (the pull request shows them as conflicts for the owner to settle) or *Cancel* (reload
  the Studio and make the change again on the new version). New commits that touch other files ask nothing.
- **One at a time.** Propose (and Ctrl+S) does nothing while a proposal is on its way.
- **Proposals add up.** Until the Studio is reloaded, a new proposal also carries the data changes of your earlier
  ones (it compares with the commit it loaded); pictures and rigs go in the proposal they were changed for.
- **Closing the tab loses nothing** (Studio plan Phase 1, T1.1): see the next part.

## Unsent changes are kept in this browser (Studio plan Phase 1)

- **What is kept.** Two seconds after your last change, and whenever the tab is hidden, the Studio keeps what you
  haven't proposed yet in this browser (IndexedDB): the data files that differ from the commit it opened on, the
  skeletons if they changed, each unsaved picture, and that commit. Not the whole game, and never your token.
- **Opening the Studio again** with kept changes asks first: **Restore** puts them back as unsaved (undo starts
  empty), **Later** opens without them and keeps them for next time (nothing new is kept until then: the top bar says
  "Not kept if the tab closes"), **Discard** deletes them after a second question.
- **Main moved on since.** Restore opens the Studio at the commit the changes were made on, so nothing merged since is
  put back; Propose then names any file main changed too, as above.
- **When the draft goes.** When a proposal took everything (what was changed during the send stays kept), or on
  Discard. A failed proposal keeps it.
- **A browser that can't keep it** (some private windows, blocked site data): the Studio works as before and the top
  bar says "Not kept if the tab closes".
- The kept changes stay in this browser on this device. They are never sent anywhere; another browser or computer
  doesn't see them. GitHub mode only.

## Undo (Studio plan Phase 1, T1.2)

- **One undo for everything**, in the order you made it: every data edit, every picture stroke, and a picture change
  that also changed the data (a replaced part) as one step. Up to 80 steps.
- **A step keeps only what the edit changed.** The undo holds the data once, as one text per entry (each map, move,
  person, rig, each entry of meta and the other sections) plus the order of the keys; a step holds the entries it
  changed, before and after. A field edit costs a few kilobytes, not a copy of the whole game; an edit to a very big
  map costs more (Copperleaf's, about 5 MB a step). Data steps and pictures each have a 64 MB cap; past it the
  oldest steps go.
- **Undo puts back only those entries.** Undoing a map edit replaces that map and nothing else; adding or deleting
  an entry puts back the whole data.
- **Opening a section never changes the data.** The self-test checks it for every section: a write outside an edit
  would ride along with your next edit, and its undo would take it back too (this is what made an undo in Rules fail
  after People had been opened). Keys starting with `_` are caches: never kept by the undo, as by saving.

## The Check: problems and notes (Studio plan Phase 1, T1.3)

- The Check runs the same checks as `npm run check:data` (CI) where they overlap: they live in
  `game/js/logic/data-checks.js`, so the run rules, ranch, robots, biomes, node types, relics (Loopholes), currencies,
  buildings, unlocks, scenes and roads are checked the same way in both.
- A **Problem** (an error) is something check-data fails on. **Propose changes refuses while there is one**: it names
  the first few, and Show me opens the Check. Nothing is sent and your changes stay unsaved until you fix it.
- A **Note** (a warning) is something the game works around (a missing picture, an unknown shop, a stop no road
  reaches). It is shown and never blocks. check-data prints the scene and road notes too, and never fails on them.
- The rigs (Studio plan Phase 5, T5.3) are checked too, in both: every picture's box inside its sheet, the rig's size
  the sheet's, every bone's parent and picture there, the same bones front and back, and `geo` (the size a Billie
  stands in the world) as the builders made it: mid and cy halfway from its top to the ground line, the top inside the
  pictures and above the ground. A rig fault is a problem.
- A Billie named from a line parked in `game/data/legacy` is a note (the game stands a new line's Billie in for it).
  A name that is in neither, like a typo, is a problem.

## How a section draws (for contributors; Studio plan Phase 6)

- A section is a function returning HTML; `renderPane` puts it in its pane, then runs `afterRender` steps. If the
  section throws, the pane says so (and the console has the error); an error nothing caught elsewhere is a toast.
- A redraw of the section a pane already shows keeps the focused control (found again by its `data-p`, or its tag and
  `data-*`) and the pane's scroll.
- **Keep an element across redraws** with `data-keep="<key>"`: before the redraw it is put aside, then it replaces
  the new HTML's placeholder with the same key (taking the placeholder's id and classes). The 3D previews (Walk scenes,
  Generate, Hub island, Props, Engine) share `walk-gl`: one canvas, so one WebGL context, for the whole session. A new
  3D section needs only `<canvas id="..." data-keep="walk-gl">`.
- **Section hooks** (`studioState.hooks[sec]`) run on every input event of a field in that section's pane (the second
  pane's own section, too). Expensive drawing goes through `drawSoon(key, f)`: once in the next frame, however many
  events came. Rebuilds that may wait (Walk scenes' walk-view paths and ground) wait for 300 ms of stillness.
- **Paths that read and write their own way** (`@lines.` lore lists, `@script.` scripts, `@thanks.` a shop keeper's
  lines): `pathPrefix(prefix, read, write)`. A prefix is claimed once; a claim that starts another throws at load,
  and a unit test reads every claim in studio/js.
- **Person pictures** (game/js/person-art.js) keep a sheet's pixels and each recoloured piece per picture
  (`markArt` bumps the picture's `_ver`); after a data edit call `forgetPersonLooks()`, not `PERSON_ART_CACHE.clear()`.
- An undo that changes only text data (moves, items, lore, story and the like) keeps the picture caches.

## Layout (studio track ST-1)

The Studio is built for wide screens (up to 3440 x 1440) and still works on a tablet.

- **Handles.** Drag the edge of the section list, of a section's list (Billies, Moves, Props and the others with a
  list) and of the battle preview's side panel. A handle also takes the keyboard: Tab to it, then the arrow keys (8 px,
  Shift 32 px), Home and End for the smallest and largest, Delete or a double-click to go back. Each section keeps its
  own sizes (in this browser).
- **Wide screens.** On a window of about 1920 px lists and side panels get wider; from about 2560 px an editor beside
  its list puts its cards in two columns, and the battle preview's stage fills the height with the controls beside it.
- **Two sections side by side.** The ⇥ button next to a section in the list (or Shift-click) opens it on the right.
  Drag the line between the two panes; **Swap** or **Close** on the right pane's bar. Walk scenes, Hub island, Props, Engine
  and the Battle preview have a 3D view (there is one), so they only open on the left. Undo and Save cover both panes. The
  split comes back when you open the Studio again; below 1000 px the right pane hides.
- **Layout presets** (top bar, from 1200 px): Auto (sizes follow the window), Compact, Wide, Ultrawide and Split (two
  sections). A preset sets every section's sizes; after a drag it says "adjusted", and Reset sizes goes back to it.

## The pixel canvas (studio track ST-2)

One canvas paints the Billies' sheets (Edit pixels) and props and ground tiles (Walk scenes and Props → Edit pixels).

- **Tools.** Pencil (B), eraser (E), fill (G, stays inside the part), pick a colour (I, or hold Alt), line (L, or
  Shift-click with the pencil from where the last stroke ended), select a box (M).
- **Flip ↔, Flip ↕ and Turn ⟳** (Shift+H, Shift+V, Shift+R) act on the selection, else on the part under the pointer
  (on a prop or tile, the whole picture). A box that is not square turns into one the other way round on the same
  middle; art turned onto a neighbour's pixels covers them.
- **Symmetry** (Y, or the side panel): left-right, top-bottom or both, about the middle of the selection, else of the
  part under the pointer; the axis is drawn and can be moved by half pixels.
- **Game palette.** Lock to it (K) and every colour snaps to its nearest shade; its ramps become swatches. "Show
  colours not on it" paints the pixels that are off it in magenta and counts them.
- **Onion skin** (O, sheets only): the same part of the other view (Front or Back), faint under the part you point at.
- **View.** Whole-number zoom (+ and −, 1 to 6 for 1x to 32x, 0 to fit, Ctrl+wheel; it keeps the pixel under the
  pointer), the grid from 8x (Ctrl+'), Space-drag or the middle button to move the view.
- **Undo.** Each stroke, flip, turn, upload, revert and resize is one step of the Studio's undo, in order with every
  other edit (a skeleton number, a field). Switching Front/Back or closing the editor keeps them.
- **`?`** anywhere outside a text field lists every key in the Studio, the open tool's first.

## Art workbench: Sheet mode (studio track ST-3)

Cuts a sheet of art into parts (Billies & battles → Art workbench). Part mode is below; Pixels and Model come later.

- **Drop sheets anywhere** on the Studio (or Open sheets…); several at once, with an Aseprite JSON beside its PNG
  (same name). A name ending in front or back sets the sheet's view; the list beside each sheet changes it. Dropped
  sheets stay in this tab only and are never saved: keep the sources yourself (the kits' are in
  tools/art-source/part-kit).
- **Kit.** Parts go in a kit (partKits.json `kits`). A kit's own sheet (`beasts-front.png`) takes its settings: the
  phase 16 kits slice by **kit rows** (magenta, one animal a column, one kind a row, then the extras, a quarter of the
  size), exactly as tools/slice-part-kit.py did, so writing them again changes nothing.
- **Other ways to find parts.** Islands of art (touching at edges and corners or edges only, pieces closer than a gap
  joined, specks under a size left out), a template grid (columns, rows, cell size, start, gaps; optional trim), or
  an Aseprite JSON's slices (else its frames), named by them.
- **Background.** The colour around the edge (guessed), clear pixels, magenta, or a colour you pick on the sheet; with
  how close a colour counts. "Only background that joins the edge" keeps background colour inside a part.
- **Snap to pixels.** Art drawn big (an AI image at about 4x) is found on dropping: its pixel size and where the grid
  starts, drawn over the sheet and nudgeable. Each cell becomes one pixel of its most common colour.
- **Names.** A template: {kit} {n} {row} {col} {name} {view}; a name ending in _front or _back puts the part in that
  view (front and back on one sheet). Click a part (on the sheet or in the list) to rename it or pick its kind. Back
  parts take the name of the front part they match by position.
- **Write N parts to the game** puts the pictures in art/next/parts/<view>/<id>.png and the parts in partKits.json
  (kind, slot, pivot, size M, sockets worked out from the outline; a view not on these sheets stays as it was). Then
  Save. One undo takes the pictures back (new ones go away), one more the parts.

## Art workbench: Part mode (studio track ST-4)

Art workbench → **Part**: a part written by Sheet mode, its joints. The numbers are in game/js/logic/part-joints.js.

- **The list** filters by kit and kind, or finds a part by name; front and back thumbnails.
- **Front and back side by side**, each on the shared pixel canvas. The **pivot** is the crosshair; until moved it is
  the joint (a limb), chin (a head) or base (a tail) socket, else the part's pivot. **Sockets** are coloured dots,
  labelled with the slots they take. Drag one, or click it and nudge it with the arrow keys (1 px; Shift ¼ px). Each
  view has its own pivot. Every drag or nudge is one undo step. Moved sockets are kept in partKits.json `sockets`, so
  slicing the sheet again doesn't move them back.
- **Sockets** (side panel): rename, remove, add (it starts on the pivot in both views); the slots each one takes. A
  part starts with the kit's rule for that socket name (`socketRules`); changing it makes the part's own (`accepts`,
  ↺ goes back).
- **Turn and draw order**: how far the part turns about its pivot (degrees, clockwise positive) and its z per view
  (higher in front; from behind, arms go under the body). Each kind has defaults (`turns`, `z`); ↺ goes back to them.
- **Test fit**: the part on a body (the same animal's torso first) at a socket that takes it, both views, at the size
  shown (S, M, L). The turn slider stays inside the limits; Swing moves it back and forth. A body part picks a part
  to hang on itself instead. On the other side of the body the part is mirrored, or its copy is used.
- **Mirror to other side** makes `<id>_r`: the pictures (and painted sizes) flipped, the pivot and sockets mirrored,
  L and R names swapped (shoulderL ↔ shoulderR), turn limits mirrored. Mirroring the copy gives the part back.
  `sides` says which side each kind's art is drawn for (arms right, legs left, as the rework placeholders draw them).
- **S, M, L**: S and L are M scaled about the pivot (rules.json `parts.sizes`). **Paint S/L** makes its own picture
  beside M (`<id>_s.png`, `_l.png`), starting from M scaled: Points, Pencil, Eraser, Fill and Pick in the bar, and a
  colour. Points moved there belong to that size. **Back to scaled** stops using it (the picture stays in art/).

## Art workbench: robots in Part mode (studio track ST-5)

Part mode's **Robots** source (beside **Kits** above the list) shows robots.json the same way; the numbers are in
game/js/logic/robot-joints.js. The Robots section's **Edit joints on the workbench** (and, for a torso, **The head's
joints**) opens it on that part, in the pane the Robots section is in.

- **The list**: every robot part with a picture, a torso's head as `<torso>:head`, each gem as `gem:<id>`.
- **Points** are where the game joins the pictures. A torso's sockets follow the socket standard: `neck` (the head),
  `shoulderL`, `shoulderR` (arms), `hipL`, `hipR` (legs), `hip` (treads and hover), `gem`. An arm, legs or head has a
  pivot only: the point it hangs from and turns around. Until moved they are worked out from the picture, as the game
  always placed them; a back point not moved keeps the front's offset from the pivot.
- Drag or nudge (1 px; robots are whole pixels) and the point is stored in the part's `art.joints` (a head's in its
  torso's `art.headJoints`), per view; every drag or nudge is one undo step. **Back to computed** drops a view's
  stored points. Draw order per view and turn limits (for the test fit only: the game's poses don't read them yet)
  are stored too (`turn`, `headTurn`). Gems sit on their centre and store nothing.
- **Test fit**: arms and legs are drawn the same on both sides, not mirrored. The battle preview (and the Robots
  section) redraw the robots after every change.
- Stored points belong to the part's own pictures; a stand-in (a part without a picture) always uses computed points.
  Socket names, socket rules, S/L and Mirror are kit-only.

The battle preview offers robots too: the Robots section's Try a build and every trainer's robots.

## Art workbench: species sheets in Part mode (studio track ST-6)

Part mode's **Billies** source shows a species' rig (art/next/rigs-next.js) the same way; the numbers are in
game/js/logic/rig-joints.js. The Billies section's **Parts on the workbench** (and the skeleton builder's) opens it on
that species.

- **The list**: the species picked, a part per bone with a picture (the role it moves as, the bone it hangs from).
- **Each view** shows the picture's box on the sheet with a little of the sheet around it: the pivot crosshair, the
  bones that hang on it as labelled sockets, the box's edges as small squares.
- **Pivot**: dragging or nudging it (½ px with Shift) keeps the Billie drawn where it was: the picture shifts back by
  as much and what hangs on the part stays put. It is the skeleton builder's pivot drag (the same function), so it
  only changes where the part turns.
- **Sockets**: dragging one moves the bone that hangs there (and everything on it).
- **Box**: an edge, or the box itself, changes which pixels of the sheet the picture takes; the pivot stays on its
  sheet pixel, so the art stays where it is drawn. With **all frames** (the default) squash and stretch, blink, happy
  and hurt move their edges by as much; pick a frame to change only its box (a view without that frame is left as it
  is).
- **z** per view (the back view's is `zb`, the one the game draws it by). Every change is one undo step and is saved
  with the rigs.
- **As drawn**: the species front and back as the game draws it, the part picked marked; **Move** plays its idle.

### A kit Billie's recipe (Studio plan Phase 5)

The 24 kit Billies (game/data/kitBuilds.json) are baked from a recipe: which kit part sits on each bone, at what size
and colour, plus extras (horns, ears, a crest, a shell). On a kit Billie Part mode shows **Kit recipe** above the
part's numbers (and when no part is picked): the stage scale, each bone kind's part, size and colour, and the extras
(part, where it sits, size, colour, a mirrored pair; **Add an extra**, ✕ to take one off).

- **A change bakes at once** with the game's own baker (the code `npm run bake:kits` runs): the recipe, the sheet,
  the rig and the line's native parts change together, as **one undo step**. Propose then carries all of them, so a
  recipe never leaves without its bake (CI fails a recipe sent without one).
- **Write Billie** bakes the recipe as it is again: after a kit part's picture was repainted, for example. When the
  Billie already is as baked it says so and changes nothing.
- A recipe the baker can't make (a slot left empty, a missing picture) is not written; the card says why.
- Edits by hand to a kit Billie's sheet or rig (pixels, pivots) are lost at its next bake: the recipe is the truth.

### Repack sheet (Studio plan Phase 5, T5.4)

**Repack sheet** (beside Skeleton builder and Paint pixels) packs the species' sheet again without the pixels no frame
shows: every picture's frames and the portrait once, tallest first, as the kit baker packs. The Billie is drawn pixel for
pixel the same; only the boxes and the sheet's size change, as one undo step. It refuses a kit Billie (its recipe packs
its sheet when it is written) and a species a coat has its own sheet for (that sheet is laid out like this one). On
today's sheets 122 of 129 would get smaller; nothing is repacked until someone presses it.

The skeleton builder zooms by whole steps (+, −, 0 to fit, 1 to 6 for 1x to 32x, as on the pixel canvas; O for the
onion), fits its window when opened, and **Paint pixels** opens the sheet with the part picked in focus.

## Pixel density (Studio plan Phase 5, T5.7)

The Roster board's **Pixel density** lists, per Billie of the game's lines, how many of its rig pixels go into a metre in
the world, how many fall in one pixel of the art grid (68 a metre, the props') and of the ground (32 a metre), and the
grid it sits on (whole, quarter, or off grid when its listed height won over the grid). A kit Billie also shows the stage
scale it was baked at and the parts scaled more than 25% off its torso. Every Billie's S and L parts are drawn at 0.85
and 1.2 (not whole). It only measures: nothing changes until a target density is set (an art direction call). The maths
is game/js/logic/pixel-density.js, which the game sizes Billies in the world with.

## Wardrobe on the pixel canvas (studio track ST-6)

The wardrobe's pieces are painted on the shared pixel canvas: the item's picture, with every tool, key, symmetry,
the palette lock and the Studio's one undo; the trainer shows faintly behind the piece picked (O). Pencil and fill
mark the colour area picked in the mask (the eraser clears it), in the same undo step; **Colour area** (A) paints the
mask only; **Pick** also picks the area. The canvas paints inside the picture only, so **Grow piece** copies a piece
with 2 px of room on every side to the bottom of the picture and mask. Beside it the pieces on the trainer: drag the
piece picked there to move it on its bone. Adding a piece (or a copy for an expression) is a picture step and a data
step of the undo.

## World map look (phase 10)

World & encounters → **World map look** edits game/data/worldmap.json, the world map's look.

- **The bowl from above.** A picture worked out with the game's own code as you edit: sea and land, rivers, routes,
  trees in clumps, places (▲: it has a landmark). **Open the 3D bowl** opens the game's world map with your unsaved
  changes (nothing there is saved).
- **Brush.** Land brush (L) and Sea brush (W) force land or sea where a stroke passes; Remove strokes (X) takes away
  the strokes you click; Look (V) does nothing; [ and ] change the size. The keys work while the pointer is over the
  picture. A place's own ground and the routes always stay dry. Each stroke is one step of Undo.
- **The sea.** How much of the bowl is sea (before painting), how rough the coast is, how much the land rises towards
  the rim (high: an inland sea), how deep it is, and a seed for another coast. The Check warns outside 30-50% sea.
- **Island** (RL-8b). Above 0 the hub is one island of that radius round its places (0.2 is 200 m) with sea all the
  way to the rim; the sea's share and the rise to the rim aren't used then, and the Check doesn't warn about the share.
  The game's hub is an island of 0.2. A run's map isn't edited here: it is made from the run's seed.
- **Relief.** How much each kind of place lifts or lowers the ground round it, and its own ground there.
- **Regions.** Each region's ground between places, its wet lowland, dry slopes and high ground (the game's terrain
  tiles; ✎ opens one in the pixel canvas), and the trees in its clumps.
- **Landmarks.** On a stop (Route stops), **Landmark on the world map**: Auto (the biggest landmark in its walk scene)
  or one of its scene's landmarks and buildings; far out the map shows it standing up as its own picture.

## Hub island (island track IS-6a, IS-6b)

World & places → **Hub island** edits the hub's island (the owner, 2026-10-22: the island is the main hub, never a run
node; shaped by hand, then locked). The logic is in game/js/logic/hub-island.js; the island's fields are
logic/island.js's contract (docs/phases/island-track.md). It opens on the left only, like the other 3D views.

- **Which map.** Copperleaf (the hub) and every map with an island. A map with no coast yet is **view only**: Copperleaf
  until IS-5 moves it onto its island. Until then the editor opens on **test_island**.
- **Orbit view.** The game's renderer through a camera of its own that looks at the island's middle (`island.c`):
  drag turns round it, Shift-drag (or the right button) tilts, the wheel or a pinch zooms. **Auto-orbit** turns it
  slowly (a drag stops it); **S W N E** look from that side; **Whole island** frames it again. **Walk the coast**
  walks the walker round the island 6 m in from the coast under the game's own walk camera, so it shows what a player
  sees (IS-1's orbit camera; the preview's free-camera mark is off while it walks); press it again to stop.
- **Map.** The ground (each letter's colour), the heights (lighter is higher, a contour every 2 m), the coast (white),
  the zones by kind (hatched when locked, labelled), the orbit's pivot (the red cross) and its dead zone (dashed), the
  island's middle (the yellow diamond) and where the orbit camera stands. − and + change its size.
- **Tools.** **Paint ground** (B; Walk scenes' brush; Alt-click picks the ground under the pointer), **Shape the land**
  (H; raise, lower, flatten, smooth), **Coast & zones** (Z: drag a point, click near an edge to add one, Alt-click or
  right-click a point to remove it, never under three; click inside a zone to edit it, its kind and lock; **Add a
  zone** then click the map for a 12 m square), **Pivot** (V: drag the pivot, Shift-drag the island's middle; the dead
  zone's size). Each stroke or move is one step of Undo.
- **Ground lock.** **Lock the ground** (refused while the island has problems; they are listed) stores `islandGen.lock`
  and the ground's hash: its letters, heights, steps, coast and zones freeze. The tools here go off, and Walk scenes
  refuses Paint, Fill, Shape the land, Cliffs & stairs, Curved road, Resize and Flatten on that map (its Map card says
  why). Props, people, buildings, water and exits stay free (**Props in Walk scenes** opens the map there). A changed
  locked ground fails check-data and shows in the Studio's Check. **Unlock…** asks first and clears the hash.
- **Dials** (island track IS-6b): IS-2's island generator (logic/island-gen.js) in the editor. **Make it again from
  dials…** opens them at the map's own dials and seed (`islandGen`), else the generator's defaults. The groups are
  size and coast, mountain and hills, cove, beaches/cliffs/dunes/heath, forest, stream, paths, and town/hamlet/barn
  (the flat zones as rows). ↺ resets a dial and Reset a group. The seed can be typed or 🎲 rolled, and each stage
  (coast, land, mountain, water, paths, trail, ground) can get a seed of its own (Alt-click: back to the main seed).
  The island is made again half a second after a dial stops (about 2 s, "Generating…"). The orbit view and the map
  show the **draft** (not saved, not in Undo), with its size, the coast walk, plots, the generator's notes and the
  island's own problems; **Check the walks** walks to every zone, the summit, the dock and each plot from the hub.
  While a draft shows, the map's tools are off. **Use this island** puts its ground on the map in one undo step: the
  tiles, heights, steps, coast, zones, plots, water, bridges, spots, hub and `islandGen`. The locked zones (and their
  plots) come back exactly as they were; props, people, exits, the look and the map's in-game checks stay, and a
  prop now out at sea is named, not moved. The orbit's pivot follows the mountain; its dead zone, lag and turn stay.
  The map keeps its middle (so nothing on it moves), so a seed whose coast would cross the map's west or south edge
  says so: try another seed, or a smaller island. A **locked** ground shows its dials read-only and is never made
  again. Copperleaf has no coast yet, so it has no dials until IS-5.

## Water tools (water track WA-9)
The Studio's river brush, waterfall placer and water-kind painter, in two places (code: studio/js/water-tools.js; the
generation in game/js/logic/water-gen.js; the data contract in docs/phases/water-track.md).

- **On the Generate card** (Walk scenes → Generate…), over the **From above** map: pick **River brush**,
  **Waterfall** or **Water kinds** (**Walk** puts the map back to click-to-walk). They write the draft's own dials,
  `params.hand` (`rivers`, `falls`, `waters`), so every remake of the draft keeps them: a dial moved, **New seed**, a
  part's 🎲 reroll. The draft is made again as you edit, so the 3D preview and the map are the live preview; the notes
  under the preview say what could not be done. **Add as a new scene** keeps them in the scene's `gen.params.hand`.
  **Clear hand water** removes them all.
  - **River brush**: click its points from the source to the mouth, double-click (or **End the river**) to end, Esc
    or **Cancel** to drop it. A point within 2 m of a side lands on it (a river that crosses that side, `src` or
    `mouth: 'edge'`); an end in water already there is a `lake` (the `sea` on a coast); otherwise it starts at a
    `spring` and ends in a `pool`. It is an **extra river**: the scene's own river (the Water dial) stays, and finds
    the hand one as other water. Its bed is made as the generator's rivers are (WA-3a): smoothed but never meandered,
    its level never rising, wider downstream, rapids on steep stretches, its banks eased, a bridge where it crosses
    the road; on terraces its water steps with the land and may make falls (WA-2b). Drag a point to move it,
    Alt-click a point to remove it. Picked: its width at the mouth (0: the dial's), what was made (source, mouth,
    length, widths, rapids), **Look at it**, **Remove**.
  - **Waterfall**: click its lip on a river and drag the way it falls. Width, drop (0: measured from the ground), pool
    (its radius; its middle lies `pool + 0.25` m past the lip), climbed (the Waterfall field move) and the kind at the
    lip. It writes a `falls` entry as WA-2b's are and replaces a generated fall within 2 m. Its pool is painted where
    it fits and cuts no ground off from the road; **Climbed** stays only where WA-2b's rule passes (2 m or taller, a
    pool, its top and its foot walked to: the climb is a short cut, never the only way), and a fall placed without it
    never gets one. The picked fall says what was made (the drop, its pool, its climb, a lip off water).
  - **Water kinds**: pick a kind (all fifteen of `WATER_KINDS`) and drag a rectangle; it is laid last, so it wins
    where it lies. Alt-click one to remove it.
  - The bar is drawn again when you let go, so the map never moves under a drag.
- **In the map editor** (Walk scenes, a saved scene → **Kinds of water**, Q): **Kinds** is the painter as before (its
  list is now `WATER_KINDS`: sea, lava and ice were missing). **Rivers** edits the scene's `streams`: click away from a
  line to draw a new one (double-click or **End the stream**), drag a point, Alt-click to remove one, click a line to
  pick it; its speed, width at the mouth, source and mouth; **Carve the bed** makes its water and bed again from its
  line (`waterGenSceneRiver`: the same shaping, on the scene's own tiles and heights; the level is read from the
  banks, so carving again moves the bed a tenth of a metre at most; water off the new line stays). **Falls** places
  and edits `falls` entries (click a lip, drag the way it falls; width, drop or empty for the ground's, pool, climbed,
  kind), and says when a lip is off water. Every change is one undo step.
- **The hub island is never written to**: on a scene with `islandGen` the whole Kinds of water tool says so and changes
  nothing (rectangles included; they were free before WA-9). Its waterfall waits for the hub track's HB-4b.
- **"Survives a regenerate"** means the draft's remakes: the Studio has no regenerate of a saved scene yet (MG-4, its
  ground mask and keep lock were never built). A scene added from the card keeps its hand water in `gen`, so such a
  regenerate can make it again.
- Checks: tools/test/water-gen.test.mjs (a hand river and fall survive a new seed, a dial and a reroll; a scene
  without hand water is made exactly as before; the saved scene's carve), the Studio check's `water_tools` step
  (`python3 tools/check-studio-github.py --only=water_tools`) and the self-test's Water tools row.

## Run Lab (Studio plan Phase 2, T2.2-T2.6)

Runs → **Run Lab** shows a run's map from its seed, made by the game's own start (`runStartPlan` in
game/js/logic/run-start.js, the one taking off from the mast calls) on the Studio's data as it is now, unsaved changes
included. It changes nothing.

- **Seed.** Type it, roll one (🎲), or **Paste a debug log…**: the log's run seed and the run's own unlocks are read
  (an older log has only the save's), nothing else. A seed is cleaned as the game's debug menu cleans it (letters, digits, `_` and `-`, 20 at most), so the
  same text makes the same run there.
- **Unlocks.** None (a fresh save), All, or the pasted log's. Only unlocks that open a biome change the map (those
  that open shop wares change the shops). A short map isn't logged: tick it yourself.
- **Short map** is the debug menu's (5 rows, 1 mini-boss).
- **The map.** Rows from the landing (left) to the boss (right), lane 0 below. A node's fill is its biome's haze
  colour (`look.haze`), its letter and ring colour its type. A dashed ring is what the landing shows as `?`, a faint
  one what it doesn't show yet.
- **A node** (click it): its type, row and role (landing, filler, rest stop, mini-boss, boss), biome and climate,
  links both ways, the day the shortest walk reaches it, the deadline, its node seed (what its scene, wild Billies,
  shop and weather are drawn from) and its forecast.
- **Beside the loaded data** draws the same seed on the data as the Studio loaded it, so an edit to rules.run,
  nodeTypes or biomes shows as two maps.
- **Copy seed + data version** copies the seed, unlocks, data version, the loaded commit and whether there are unsaved
  changes, for a bug report.
- An edit made in the other pane (Rules beside it, for example) redraws the map at once.

- **From the game's logic** (under a clicked place): its wild Billies (levels and odds), its mini-boss's or boss's
  leader and team, a town's stock and Loophole on every day it can be open, and the run's Loophole picks after each
  mini-boss with none held. The game's own code works these out on your unsaved data in a background worker
  (`studio/js/logic-worker.js`); the first answer after an edit takes a moment longer.
- **Over 1,000 seeds** (under the map): the map checks (every place reachable, no dead end, each role row holding the
  type the game looks for, a deadline after the shortest walk), each problem with a seed that shows it, and the
  figures: places, place types, towns on a walk, towns made against routes, biomes, and seeds worth a look. **Open**
  draws that seed.
- **Run rules** (beside the map): rules.json `run` (map, clock, what the map shows, wild levels, foes, the town shop
  and clinic, the payout) and nodeTypes (names and weights). Each change redraws the map, the logic and the checks, and
  is saved and proposed like any other field. **In the code (read-only)** lists what the code decides, not the data
  (two lanes at most, where mini-boss rows fall, the exits, the buildings…), each with its file and line.
- **▶ Play this seed** opens the game on this seed with these unlocks and this map size, after your unsaved changes,
  in a test run: a new game that takes off at once from the mast, never saved and never signed in. Edits made while it
  runs (a clinic's price, a shop's wares) reach it half a second later. By hand: add
  `?debug&run=<seed>&unlocks=none|all|<ids>&short=1&party=<species@level,…>&relics=<ids>&draft=1` to the game's
  address.

### Simulate (Studio plan Phase 3, T3.4)

The Run Lab's **Simulate** card plays whole runs with the game's own rules and a bot in the player's place
(`game/js/logic/run-sim.js`, balance mode: no scenes are made, the same outcomes), on a fixed seed list (SIM0, SIM1,
...; at most 200 here, the CLI runs more). It plays the same seeds twice, in two logic workers: **Base**, the data as
the Studio loaded it, and **Draft**, the data with your unsaved changes. Every difference is paired, seed by seed, so
a small change shows without the noise of two separate samples.
- Choices: seeds, the bot policy (`greedy-forward`, or `never-pick`, which takes and buys no Loophole), the party (who
  waits at home, Potions packed) and the unlocks (none or all).
- Tables: per run (won with its 95% Wilson interval; days, places, battles, catches, clinic and shop money, money left,
  Capital, Loopholes held, top level, each with Draft − Base and a 95% interval and how many runs changed); where runs
  were lost, by place and by row; money in and out; the Loopholes held at the end; the leaders beaten. Every table
  carries the banner "Bot policy X: a lower bound on a careful player, not a prediction"; the rows the policy mostly
  decides say **policy-driven**.
- Each side shows its data's hash. The same data gives "Every run is the same on both sides"; a re-run gives the same
  numbers.
- **Export JSON** saves the compare; `node tools/test/sim/run-sim.mjs --compare=base.json` writes the same JSON.
- The numbers measure the bot on legacy stand-in species. Use them to see what a change does, not to judge balance.

## Roguelite content editors (Studio plan Phase 4)

The Runs group holds the Run Lab and three pages for what a run is made of. Each shows something the JSON can't: the
game's own logic on your unsaved data (most of it in the Studio's logic worker), the limits that live in the code, a
graph, or a value a run overrides. Edits are ordinary fields: saved, undone and proposed like any other.

- **Loopholes** (relics.json, rules.json `run.relics`). The list shows each one's rarity, its weight and its chance to
  be drawn first at a pick. Each effect row is edited by its kind (money, price, catch, stat, damage, heal, payout;
  changing the kind puts that kind's fields in), with the code's limits beside the field: a factor from x0.1 to x4
  (effects.js `FX_LIMIT`), stages from -6 to +6 (`FX_STAGES`). A row outside them is a data error (check:data fails;
  the message shows on the row). **On a sample build**: pick a Billie, a level and other Loopholes held with it; its
  stats before and as a battle starts, and what wins pay, shop and clinic prices, catch chance, damage, healing and
  the payout become, from the game's effect code; a kind whose rows multiply past the limit says what the code uses.
  **Offer order for a seed**: the picks after each mini-boss on a run of that seed (nothing taken, the first offered,
  or this one when offered), the same as the Run Lab's for that seed. **Rarity and the picks**: each rarity's weight,
  shop price and how many Loopholes have it (a rarity nobody has, or Loopholes never offered, are flagged), the cap and
  how many are offered.
- **Unlocks & hub** (unlocks.json, buildings.json, currencies.json, rules.json `ranch` costs). The **unlock graph**: a
  column per building with the rows sold there and their cost in its currency, the earned rows apart, an arrow from
  each row a row needs; click a row to edit it (name, bought or earned, where and for how much or when, what it gives,
  what it needs). A need that would close a circle is refused, and the message names it (`ranch_2 -> ranch_3 ->
  ranch_2`). **What a new save has** after a number of runs, wins and catches: the earned rows (the game's
  `unlockAuto`), its currencies and building levels, what it can buy, and the biomes and wares a run can draw; the
  graph shades what it owns. Buildings and currencies are below, with their data-check messages.
- **Economy** (read-mostly). Every source and sink of each currency (wild prizes, mini-boss and boss rewards, money
  Loopholes, the clinic, run shop wares and Loopholes, the payout's rates, earned unlocks, unlock costs, the ranch),
  each with its value and a link to the field that sets it. The money in and out of simulated runs (Phase 3's balance
  dashboard) will show here; until it lands the page says so.
- **Trainers**: a mini-boss leader's card **In runs (overridden in runs)** shows what a run makes of it on each
  mini-boss row and the boss's row: the run's reward and its team's levels (the game's `runFoes`). Its own reward
  field says "outside runs only".
- **World & encounters** says what a run reads: each pool is tagged with the biomes whose run places draw from it, or
  "legacy"; a species id whose line is in game/data/legacy shows the species the game puts in for it. Route stops,
  eggs, regions and the world map are marked legacy.
- **Town shops** and **Jobs** moved to the Legacy group: shops.json and jobs.json are empty (run shops stock from
  `run.shop`; the game has no jobs).

## UI look (UI track UI-3)

Game → **UI look** edits game/data/uiTheme.json, the look of the game's menus (not the 3D scenes: that is Engine).

- **Set the look for** the whole game, or one screen's colours and shapes only (Walk, Map, Team, Guide, Bag, Trainer
  card, Battle, Dialogue): the screen's own part of the page; its top and bottom bars and sheets follow the game.
- **Dials** in groups that fold: Colours (light and dark side by side; each text colour shows its grade and how
  well it reads on the ground and on a surface: text needs 4.5:1, danger and primary 3:1), Surface (the glass: blur,
  saturation, and per side its opacity, highlight, edge line and shadow colour), Depth (the glass panels' raised and
  floating shadows, per side), Drop shadows (the cut parts'), Shape (the three cut sizes, the slant, stepped like
  pixel art, and each family's shape, cut size, corners and radius), Space, Type (the two fonts, the voice font's
  size, every text size, line height), Motion (three speeds, the stagger, three eases) and Layers (read only).
- **↺** on a dial: on the whole game it goes back to the value last saved; on a screen the screen stops setting it.
  **Reset** does a group. **Back to the saved look** (the whole game) or **Clear everything set here** (a screen);
  **Use these for the whole game** moves a screen's values to the game.
- **Presets** are data in uiTheme.json (Alpha 0.5, the look before UI-1; Stepped pixels). One applies onto the level
  you are on (on a screen, its colours and shapes only); **+ Save as preset** saves the level's look under a name;
  × deletes one. Undo takes any of it back.
- **The preview** is the UI gallery (every part of the kit, in its states) with your unsaved look: Light or Dark,
  320, 390 or wide, Reduced motion, Settings' text size, and the screen you are setting. **Hold to compare** (or hold
  C) shows the look as last saved. **Open the gallery** opens it in a tab. An open game tab follows the dials too.
- Find (Ctrl+K) knows every dial; the Check lists a colour that reads too faintly, with Show me.
- **Real screens** (UI-3b): above the preview, Gallery, Team, Bag, Battle or Dialogue. A screen is the game itself,
  started from a ready-made game of its own (a fixture: nothing is saved to yours), with your unsaved look; it takes
  a few seconds to start. The look, Light/Dark, the width, text size and reduced motion all reach it.
- **Before / after**: the saved look and your unsaved one side by side, scrolled together.
- **Inspect**: tap a part in the preview: what it is (its kit component, the gallery section or screen) and every
  variable its rules read, with its value and the dials that write it (click one to go there).
- **Connections** (Ctrl+L) on a dial: where its value comes from (the whole game, screens, presets), the variables it
  writes and the parts in the preview that read them (click one to see it outlined).
- **Overlays**: Under 44 px (tap targets too small), Contrast (text under 4.5:1, or 3:1 for large text, worked out
  through the see-through layers behind it; text over an image can't be told, text shadows aren't counted) and Glass
  (each blurred surface, red when more than two stack, and the count on screen against the budget of 3).
- **Rule check**: the Check has one report line (not counted in its badge) with the raw values tools/ui-lint.mjs
  counts; Show me opens the list by rule and file, each line linked on GitHub. A report until UI-6.

## Music & sound (sound track SND-3)

Sound → **Music & sound** edits game/data/music.json. Sound plays through the game's own tracker
(game/js/audio/tracker.js) on the Studio's own AudioContext, made on the first press of a ▶ (a browser starts sound
only after a click). It stops by itself when the section is off screen.

- **The song list** (left, on every tab): ▶ plays a song from its start, **Stop**, **Loop** (off: a song stops after
  its last bar), the bar playing under them; a song nothing plays is marked unused.
- **Songs**: the song picked. **Recipe**: tempo, key, scale, lead wave, bass, arpeggio, drums, the eight bars' chords
  as roman numerals for the scale with their root (IV · F; bVII in mixolydian), swing, echo, sevenths, the seed and
  **New tune**. Every change is heard at once: the song playing keeps its place with the new notes. **Hook**: a
  32-step roll for bars 1-2, played instead of the composed tune in bars 1-2 and again in 5-6 (the composed tune shows
  faintly; **Copy the tune's bars 1-2** starts from it), and a **Countermelody** under them on a quieter pulse. Click
  an empty cell to write a note (you hear it), drag right to lengthen it, click a note to take it away; one note at a
  time, so a note you write over another replaces it. **Where it plays**: the where-rules, places (parked ones too),
  story scripts and code that play it.
- **Where they play**: the where table, read from the top; the first rule whose every condition fits picks the song.
  Each rule shows only the conditions it sets (✕ leaves one out, **+ condition** adds one), its song (or the place's
  own), ▶, ↑ ↓ to reorder and ✕ to remove; **+ Add a rule** goes before the last, which must fit everywhere. **Try a
  place** (above it): set where you are (battle, tab, room, node, biome, row, the place's own song) and it names the
  rule that wins and plays its song.
- **Jingles**: each jingle with ▶ (at its own **Tempo** and **Wave** when it sets them, else 150 bpm on a 25 % pulse,
  with a triangle an octave down, as the game plays them), its name, and a roll for the one picked: one note at a
  time, a gap a rest.
- **Sounds** (SND-6): the eight **base cries** (beast, bird, slime, machine, fish, insect, ghost, suit), each opened
  to its name, wave and notes (when each starts, its note over the Billie's pitch, length, volume, slide, wobble,
  wave), ▶ at middle C and ▶ **Low on health**; the **button sounds** (select, confirm, cancel, can't: ▶, their
  names, and which classes and actions make confirm and cancel); the **Mix** (each bus's trim, how far the world and
  ambience come down under a song, the compressor). The game uses the mix; the Studio's own player doesn't.
- **Cry** card on the Billies page (after Stats): the stage's base cry (a kind), pitch, length and name, each shown as
  its id makes it until set; ▶ **Cry**, ▶ **Low on health** (as the game plays it in the red zone: a quarter faster,
  a minor third down), **Use the cry its id makes**. Saved per stage as `cry` in lines/*.json.
- The Check lists a where-rule that names no song (an error, as check-data) and a song nothing plays (a warning),
  with Show me, one note on how many Billies use the cry their id makes, and notes listing the hooks, jingles, base
  cries and Billie cries still named "placeholder".

## Sections

| Section | What you can do |
|---|---|
| **Billies** | Names, Field Guide text, types, height and weight per stage; stat profile or exact stats; moves learned and when; how and when each stage evolves; where it appears; its cry (base, pitch, length; ▶ to hear it). Animated front/back preview with every action, in any coat. |
| **Coats** | A coat recolours a Billie's art (in place of the old Golden sheets). Swap whole palette ramps (every shade of one becomes the same shade of another), then exact colours; art a little off the palette follows the nearest shade. How often each coat turns up in the wild, from eggs and on the line (empty: never). Give one Billie its own hand-painted sheet for a coat: it starts as the recolour; download it, paint it, upload it back. A before/after preview on any Billie. |
| **Edit pixels and skeleton** | Pixel editor on the real sprite sheets (the pixel canvas, above): every tool, part outlines, an onion skin of the other view, a live animated preview. Download a sheet, edit it in another app, upload it back. Nudge where each body part attaches and how parts stack. |
| **Skeleton builder** | Build or reshape a body: add parts (blank or from a PNG), drag parts and pivots, tilt, re-parent, mirror a limb with everything attached to it, choose which motion each part follows, switch the body plan, and copy a layout between the front and back views. Whole-step zoom with the pixel canvas's keys; **Parts on the workbench** for boxes, pivots and draw order on the sheet. |
| **+ New Billie** | Start from a blank body (biped, four-legged, flyer, fish, blob or worm) in a color you pick, or copy an existing Billie's skeleton and recolored art. Either way it works in the game immediately. Add or remove evolution stages, duplicate, recolor or reorder lines. |
| **Battle preview** | The game's battle stage with your unsaved changes. Pick any two Billies (each in any coat) and a backdrop, then play any move with any outcome, status effects, wild and trainer intros, taxes, faints, sandstorms and camera moves at ½×, 1× or 2× speed. Sky and haze colors change live. |
| **Robots** | Phase 17. Torsos, arms, legs and gems: names, types, weight, toughness, what the legs carry, the move each part gives, stats, and pictures (front and back, a torso's head, a gem's chest picture), with a colour and shape for the stand-in when a part has no picture. Rules: the stat floor, upgrades, the gem's type bonus, weight, part HP and where hits land. **Try a build** draws any gem and parts as the game does and shows its types, weight, stats and moves. A trainer's team entry can be a robot (Trainers). |
| **Moves** | Name, type, kind, power, accuracy, priority, description and an effects builder (status, stat changes, healing, draining, hedging, hype, rent, market shock, delayed delivery and more). |
| **Types** | Colors, the full matchup chart (click to cycle 2× / ½×), each type's battle ability and particle effects. Renaming a type updates everything that uses it. |
| **Items & coins, Town shops, Day Jobs** | Prices, effects, icons (or upload your own), what each shop sells, keepers, greetings, job pay (jobs are kept for the ranch, phase 12, and unused for now). Since RL-5 Town shops and Day Jobs are empty: the old ones were parked with their towns. Since Studio plan T4.5 both are in the Legacy group. |
| **World & encounters** | Stops on a drag-and-drop world map and the **roads** between them (add, remove, re-point, pick the exit it leaves by at each end: both must face each other, or the Check lists it as an error; a road's length is measured from its two exits; the glass lift is set on its lift props); gates, shops, backdrops; wild encounter tables; eggs; regions ahead; which walk scene each stop uses; battle backdrop colors and ambience. Since RL-5 the game's world is one stop, Copperleaf, with no roads or regions (the rest is in Legacy); a run's stops are made at run time (RL-7). |
| **Prop editor** (in Walk scenes) | Open any prop and edit everything about it on its picture: drag the base point, click to add lamp glows, lit windows, fires, smoke, water spray and sparkles exactly where they belong (drag to move, Delete to remove), set the door, see the footprint. Add **layers** (from a PNG or a copy of the main picture) and place each one in front of or behind the main picture in meters, shift it, make it face the camera, stay put as the world turns, or lie flat, and let it glow. A 3D turntable shows the prop in the game's renderer while you work. |
| **Walk scenes** | The scene for each stop: shape the land (raise, lower, smooth, flatten); paint the ground tiles; place, move, resize and mirror props; drag the **hub** (where you stand when you stay) and the **exits** roads leave through; choose what a prop does when tapped (shop, clinic, a message), its label and its words; distant hills, townsfolk and what they say, wind, sun rays, sky, haze, shade, tilt-shift blur and camera. The live preview runs the game's renderer: walk around in it and tap things. Paint prop pictures and ground tiles pixel by pixel; set a prop's shadow, sway, solid footprint, door and walkable area; add new props (blank or from a PNG) and new ground types. **People who talk** edit each person's id, spot, facing, `when` / `unless` and script. **Story preview**: pick a start preset and switch flags; who isn't there for them is hidden in the 3D preview and faded on the map. **Play from here** opens the game in this place on the spot you pick (Pick the spot, or where the preview's walker stands), at the preview's preset and flags, with your unsaved changes. **Free camera** (🎥 under the preview, or C): the camera leaves the walker and flies over the scene like a map app: drag to move (the ground stays under the pointer), right-drag to turn and tilt, the wheel to zoom towards the pointer, double-click to look at a spot; on a phone one finger moves, pinch zooms, twist turns, two fingers up or down tilt; W A S D, Q E, R F and Page Up/Down too. **Top view**, ▲ ▼, **Walker here** and **Back to the walker**; each scene keeps its camera while the Studio is open, and Play from here starts where it looks. |
| **Generate** (in Walk scenes) | Map generator MG-1: **Generate…** beside + New scene makes a whole route from dials and a seed: the biome (ground, plants, water kind, sky and animals from game/data/biomes.json), size presets, hilliness, terraces and their height, mountains (terrain TR-2: up to 20 m on the sides chosen, rock shelves and cliffs, a footpath winding up each to a summit marked in `spots`), water (stream, pond, coast) and how much, the road's entry and exit edges (side, place along it, width; written to edgeExits with the walk length), its shape (straight, gentle winding, S-curve, switchback), wobble, width, surface and verge, trees, wild growth (the grow-wild rules), tall grass (the encounters), clearings, one feature (stream and bridge, lookout, jetty, glade, lava flow, terraces) and props (signposts, lamps, benches, bins, townsfolk spots). ↺ puts a dial back, Reset a group; 🎲 New seed, or a new seed for one part only (land and water, mountains, ground, road, plants, feature, props) keeping the rest. The draft is drawn by the game's renderer (walk around it) and from above (click to walk there); it is not game data, not in Undo and not saved until **Add as a new scene** (one undo step; Ctrl+S saves it). Every generated prop carries `g: 1` and the scene keeps its dials in `gen`. **Joins…** (map generator MG-2) under each exit joins it to an exit of any scene: the exit turns to face it, a whole number of metres along from it and as wide (its side, place and width are then locked; **Unjoin** frees them), and the draft takes that scene's edge (its heights, step raise and natural ground over the stretch a neighbour shows, 26 m either side of the exit; the dials keep the edge, so an added scene keeps it in `gen`). The stats say how the two meet (heights along the band, the step, a straight walk across), and warn when the exits break the data's rules for a place's map (two a side, 44 m apart). **Preview the pair** shows both side by side as the game lays them, nothing eased. Props → **Airship mast / Clinic / Shop at the hub** put them beside the main road near the hub facing the camera, on level ground with a path to the door (🎲 Buildings rerolls where). Terraces come down to ground level by every exit, and roads climb them as ramps (terrain track TR-1). **Water tools** (WA-9) over the map from above: a river brush, a waterfall placer and water kinds of your own, kept in the dials (`params.hand`) so a new seed keeps them (Water tools, above). Coming: presets and regenerating only what was generated (MG-4). The place and its roads (the old MG-2 Accept) are parked: every map outside the hub is legacy. |
| **Hub island** | Island track IS-6a: the hub's island in an orbit view and on a map: paint the ground, shape the land, move the coast's and zones' points, set a zone's kind and lock, place the orbit's pivot and dead zone; Walk the coast; lock the ground once it is right (Walk scenes then refuses its ground tools; props stay free). IS-6b: the generator's dials with a live draft and Use this island (locked zones kept; refused while the ground is locked). Above. |
| **Engine** | Every dial of the 3D renderer, with a live preview of any walk scene: lens (sharp band, blur in front and behind, round highlights, chromatic aberration, vignette, grain, sharpen), color (exposure, highlight roll-off, contrast, saturation, warmth, bloom), sun and sky (direction, height, color, real-clock sun, sky light, ground bounce, clouds and their shadows, light shafts), shadows (strength, softness, color, contact shadows, solid building shadows, ambient occlusion), lights, haze and mist, horizon curve, ground bumpiness and shine, world map mountains, grass and wind, water and quality, plus colour grades. The camera's dials are in **Camera** (below). Set them for the **whole game**, override them for **one scene** (battles there follow it) or for the **world map**; ↺ puts back a single dial. Ready-made presets (Sunny, Overcast, Golden hour, Cave, Mall), your own presets, a "Hold to compare" button that shows the built-in look, and a frame meter. |
| **Camera** | Every dial of the walking camera, in folders: **Framing** (tilt, height, distance, view width, turn limit, phone tilt, walk bob, the pixel grid, and the preview scene's own tilt, height and width), **Zoom stops** (CAM-4b: 3 to 5 named stops, a column each, with their zoom, tilt, distance, field of view, blur and look-ahead; + Add a stop puts one in the widest gap without moving the picture; × removes one (a scene that started at it starts at the stop nearest zoom 1); the curve graph draws one value against zoom through the stops: drag a stop's point up and down for its value, sideways for its zoom; Pull to stops and the two-finger tap's time and movement; the stops are the whole game's, so on one scene they are shown, not edited), **Zoom feel** (how long a zoom takes, eased so in and out feel alike; pinch and wheel sensitivity; a rubber band past the limits; zooming toward the point you pinch), **Follow**, **Moments**, **Visibility** and **Island orbit**. **Camera looks** above the folders (Diorama, Classic RPG, Close-up and your own, + Save as a look): presets of camera dials only (tilt, width shown, Pull to stops and the stops). Same scopes as Engine (the whole game, one scene), ↺ per dial, Reset per folder. Beside them the game's renderer on any walk scene, with the camera's real numbers under it (tilt, height above the aim, distance, field of view, metres across, and how many of the game's drawing pixels one art pixel covers; green when it's a whole number), **Frame** (Fill, Phone portrait, Phone landscape, Desktop: the preview at that shape, and the art pixel's size on that screen), **Your zoom** (a slider for the player's zoom, the stops marked on it), **Stops** (a button per stop; the scene's starting stop marked ·), **Snapshot** and **Hold** (hold to see the camera as at the snapshot, or the built-in camera; light and blur stay), Camera guides and Play moment. The data is the Engine's (`engine.defaults.camera`, its `stops`, a scene's `look.camera`), your own looks (`engine.cameraLooks`) and a scene's `cam` (its starting stop is `cam.stop`: Walk scenes → Starting zoom stop). |
| **Trainers, Looks** | Trainer teams, their script (checked as you type), when they're there, rewards, badges, sandstorms; trainer and shopkeeper looks with a live preview. **Mini-boss** (RL-5): the trainer stands on no stop (the eight badge leaders, for the runs, RL-13); Stands at is hidden. |
| **Run Lab** (group Runs) | Studio plan Phase 2: a run's map from a seed, on your unsaved data and beside the loaded data; a place's foes, shops and wild Billies from the game's logic; checks over 1,000 seeds; the run rules beside it; Play this seed; Simulate, Base against Draft (see Run Lab above). |
| **Loopholes, Unlocks & hub, Economy** (group Runs) | Studio plan Phase 4: a run's Loopholes with a sample build and a seed's offers, the unlock graph with what a new save has, and every source and sink of each currency (see Roguelite content editors above). |
| **Legacy world** (group Legacy) | RL-5: the old world outside the hub, parked in `game/data/legacy`, read-only: the 48 places with their old stop numbers, the trainers who stood there and their roads, plus counts of the parked shops, jobs and lore, and (test cleanup, 2026-10-23) a card of the maps parked without a place: the 16 rooms only old places' buildings opened, and `city_opening`. It is read beside the Studio, or from GitHub when signed in, and never enters the Studio's data, so Save, Undo and the Check never touch it. **Copy into game** brings a place's map (or one of those rooms) back as a walk scene of its own (no place, no roads) in one undo step and opens it in Walk scenes; whatever its people name that the game no longer has shows in the Check. |
| **Story scripts** | Project Story S3: story.json's own scripts (Hazel's lab, after Blake's first battle, the ending): add, rename, remove and edit them in the script field; the story's flags, start presets (with ▶ Play) and quests to read. |
| **Scripts everywhere** | Every script field (a trainer's, a person's, story.json's) shows the parser's error at once and the story checks a moment later, each on its line (click to go there); **Add line ids**; **Commands**, a reference built from the parser's own tables that puts a command in the script. Condition fields (when, unless, a place's requires) are checked the same way, and the Check lists every story finding. docs/SCRIPTS.md. |
| **UI look** | The menus' look (uiTheme.json): colours light and dark with contrast grades, glass, depth, shapes, space, type and motion, for the whole game or one screen's colours and shapes; presets, Hold to compare, the UI gallery as a live preview. UI track UI-3, above. |
| **Music & sound** (group Sound) | The songs (play, loop, the recipe's dials heard at once, a hook and countermelody roll), the where table with Try a place, the jingles, and (SND-6) the base cries, the button sounds and the mix (music.json). A Billy's cry is on its Billies page. Sound track SND-3, above. |
| **Rules** | Every number that tunes the game: starting items, starters and rival, wild Billies per place and how fast they come back, prize money, leveling curve, team size, eggs, damage, critical hits, type abilities, taxing, bargains. |
| **Art files** | Browse, download and replace any image. |
| **Check** | Lists problems with "Show me" links (see "The Check" below); downloads or loads the game data; runs the Studio test. Earlier versions are in git: a proposal is a pull request. |
| **Find and Connections** | Ctrl+K finds any setting or thing and takes you to it; Ctrl+L shows what the thing you're editing uses and what uses it, or, for an engine dial, where its value comes from and what it depends on. |

## Saving in local mode

**Save to game** (Ctrl+S) writes the game data, `game/art/rigs.js` and the
changed images. Undo/redo cover every
edit in the session. **Play test** opens the game with the debug menu at
`localhost:8001`, which keeps a separate save from your normal game. Reload the game tab
to see saved changes.

The Studio only listens on your own computer, only writes inside `game/data` and
`game/art`, and only accepts requests carrying the key it puts into its own page.

The game data is JSON files in `game/data/` (a file per map, line, trainer and person, one per
other section; `index.json` lists them). On GitHub, **Propose changes** sends only the files
you changed. You can also edit them by hand; `npm run check:data` checks them (and
`node tools/check-data.mjs --fix` lays a hand-edited file out the way the Studio writes it).
The game tolerates mistakes. It skips anything it can't use and lists it in the debug
menu.



## Notes and limits

- Blank bodies are simple colored shapes meant to be painted over.
- New parts make sheets taller. They are never packed tighter automatically, so a
  heavily edited billionaire's sheet can grow a little each time you add parts.
- Checked in Chromium at phone, tablet, desktop and phone-landscape sizes, in light
  and dark modes. The checks covered every screen, every battle backdrop, trainer
  battles, shops, evolution, hatching, broken game data and a full Studio save
  round trip. Version 8 adds checks of the skeleton builder (moving, tilting, renaming,
  adding, mirroring, deleting, undo), blank bodies in every body plan, the battle
  preview and map painting, each saved and loaded in the game. Version 14 adds the opening cutscene (skip, dressing room, starter
  pick) on phone and desktop and the Studio's Wardrobe section. Real phone motion sensors, touch throws and vibration still need a
  device check.


## Replacing a Billie's part from the library

In Art workbench → Part → Billies, select a species and one of its pieces, then choose **Replace from Parts Library**.
The picker filters by body group, kit (beasts, birds, fish), and part type. Groups are inferred from the existing bone;
choose a group explicitly for custom bones. A part that lacks a socket one of the bone's children hangs on (a torso's
neck, shoulders, hips or tail) is greyed out, with the reason. Select a thumbnail to stage the change. The strip shows
the Billie before (top row) and after, front and back, idle, blink, happy and hurt, as the game draws it; the assembled
front/back previews show the result. Use Move and the idle/walk/attack/hurt
selector to inspect motion. Scale, rotation and offsets are baked into the replacement picture around its library pivot.
Match current part’s palette maps the new pixels to colours sampled from the old piece.

For recognised paired limbs, Replace both sides uses each side's library art or its mirrored counterpart. Missing back
art keeps the existing back piece, with a warning. Frames (Studio plan Phase 5): a head's blink is made again from the
new picture (the kit baker's rule; happy and hurt then show the new picture), unless **Keep the old blink, happy and
hurt frames** is ticked; a torso gets its squash and stretch again. Children: one on a named socket moves to the new
part's socket (scaled, turned and offset with the picture); any other (horns, ears, a crest) keeps its place in
proportion to the picture. The size the Billie stands in the world (geo) moves by what the part changed, so a part of
the same size leaves it as it was. The separate portrait remains unchanged. On a kit Billie the recipe is the truth: a
swap by hand is lost at its next bake, so change the recipe instead (Kit recipe, above).

Nothing changes until Apply. Apply appends the pieces to the species sheet and creates separate crop metadata, preserving
bones, parents, animation roles, and draw order. Save to game writes the modified sheet(s) and rig through the existing
save flow. One Undo/Redo restores both the pictures and metadata. Cancel discards the staged preview. Library source
images are never overwritten. Refresh the preview if the species or its sheet changes while the picker is open.

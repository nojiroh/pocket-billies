# Changelog

Pocket Billies, from the fresh base on. Versions are `0.MINOR.PATCH alpha`: MINOR for a finished phase or a batch of
new features, PATCH for fix-only releases; "alpha" becomes "beta" once the planned features are all in. The version is
written in one place, game/version.js. The legacy build's changelog is in docs/archive/LEGACY-CHANGELOG.md.

## 0.1.0 alpha (unreleased)

The fresh base. Numbering starts over; saves from the legacy build don't load (a new game starts and the old save is
kept aside in the browser).

- Battle and run music (sound track SND-5): a battle's song starts on the encounter's flash with a short intro
  run and holds its drums until your first Billie is sent out. A run's mini-bosses have a song of their own (the
  title's theme in a minor key) and its boss another. While your lead Billie is under a quarter of its HP, the battle
  song turns tense (faster, marching drums), back when healed; Settings → Sound has the classic low-HP beep as a
  switch, off by default. A run's music builds as you go: from the first mini-boss's row the biome's song marches
  with its arpeggio higher, from the second it adds a countermelody; on the deadline day and after it, the songs drop
  to drums and the tune alone. On the run's map tab the map song is muffled by today's rain, storm, snow, fog or ash
  where you stand. The battle songs' hooks and intros are drafts, named "placeholder" in the Studio, which can now
  edit intros, play each version and edit the run's settings.
- The music's first rework toward the Game Boy Pokémon sound (sound track SND-4): every song plays on four voices
  (two pulse waves, a triangle bass, noise drums), except the title and the fall, which keep their fuller sound. A
  written hook comes back answered in bars 3-4. The title has a theme of its own (I-bVII-I) that returns under
  Copperleaf's song, as the airship takes off on a run and on the payout screen. Copperleaf is a two-voice music box
  with no drums. Outdoors at night a song plays its night version: slower, lower, softer drums. Ten place songs have
  draft hooks, each named "placeholder" in the Studio until it is rewritten; the Studio's player has a Night switch.
- The Studio's Music & sound section (sound track SND-3): play and loop any song and change its recipe while it
  plays (tempo, key, scale, the chords as numerals, the instruments, swing, echo, a new tune from a seed); write a
  two-bar hook and a countermelody on a piano roll, which the game now plays in place of the composed tune's first
  bars; edit the table of which song plays where, with Try a place to hear what it picks; edit the jingles. Each
  Billy can have its own cry (base, pitch and length) on its Billies page, with a low-health preview; until one is
  set, every cry sounds as before. The Studio's Check flags a where-rule that names no song and a song nothing plays.
- Music in a run (sound track SND-2): each place on a run's map plays its biome's song (a meadow its own, a lake the
  trench song, a thicket spore, a ridge crystal, an autumn wood spire), a run's town the town song and the landing
  the route song. The songs, jingles and cries are now data (game/data/music.json) and play exactly as before; the
  music's timer stops while the game is in the background.
- Settings → Sound (sound track SND-1): the Volume and Music Test buttons play again (Volume played nothing; Music
  was silent when Sound effects was at 0). Volume and Ambience change while you drag them, like the others. A
  speaker button beside the Settings title mutes everything from any tab, keeping your levels. Sound comes back with
  the next tap after a phone call or Siri on an iPhone. The Sound tab reads in Dutch, German, Spanish and French.
- A run's world (roguelite track RL-7), not playable yet (a run starts at the airship from RL-8; to look at one, open
  the game with `?fixture=run`): each place on a run's map is a walkable route made from the run's seed, joined
- The barn has its pasture (island track IS-8): a rail fence round the field beside Copperleaf's barn, a field gate
  standing open so you can walk in, a water trough and a hay rack with round bales. Up to six of your Billies at home
  (the ones training first) wander in it, poking about the hay and now and then hopping. Tap one, or the gate, and
  the ranch opens. A Billie you take onto your team or on a run leaves the field.
- Copperleaf's island is dressed (island track IS-9): a mixed forest from the north-west round to the north-east
  (oaks, beeches, birches, hazels and rowans low down, pines and larches up the mountain's foot), with ferns, bracken,
  mushrooms, mossy logs and glades; flowers in the meadows and the odd lone tree; juniper on the heath; beach grass on
  the dunes, driftwood and shells on the sand, rocks on the shore; boulders and scree on the mountain, cairns along the
  trail and a lookout on the summit. Gulls wheel over both beaches and crabs scuttle on the wet sand. Six patches of
  tall grass by the woods and on the heath hide wild Billies. Two corners of the mountain by the summit that you
  couldn't climb onto can be walked to now (the rounded terrace edges no longer make a gentle slope too steep to step).
- The Studio's Hub island section has the island generator's dials (IS-6b): size, coast, mountain, cove, beaches,
  cliffs, forest, stream, paths, the town and the hamlet, a seed and a seed for each part. A draft shows in the
  orbit view and on the map as you change them, with its size, the walk round the coast and a walking check. "Use
  this island" puts the new ground on the island (Undo takes it back); locked zones, props and people stay as they
  are. A locked island shows its dials but is never made again.
- Copperleaf is the island now (island track IS-5): the town stands on its generated island, a market town where the
  stream meets the bay. Professor Hazel's lab and the well on the square, the airship station by the harbour, Granny
  Juniper's cottage with her hives and lavender, the General store (closed for now), cottages along the streets and in
  the hamlet under the mountains, the barn by its pasture with the farm patch, the great oak with its swing by the
  square, a pier at the cove. A new game falls onto the square and wakes in front of the lab. Wild Billies hide in tall
  grass out by the woods and on the heath, not in town. Rooms open in place behind a door facing any way, the camera
  looking in through the door. A tap walks you all the way across the island.
- The world map shows Copperleaf's real island (island track IS-7): its own coastline with the cove and the
  headlands, its beaches, meadows, forest and paths as they are on the ground, its mountain standing up in the
  middle, and the town's buildings close in (the lab, the airship station, the houses, the well, the barn). The
  shallows follow the coast. The island is drawn at its true size, so it is smaller than the old round blob; zoom in
  to see the town. The debug menu's Bowl map test has a step for it.
- Copperleaf's island has its ground and its town's layout (IS-2): a generated island in the debug menu's Test scenes,
  "Copperleaf island (generated ground)", about 215 m across with a natural shape (lobes, headlands, rolling hills): a
  mountain with spurs in the middle, climbed by a switchback trail to a lookout; forest round its north side; a long
  beach in the west; a wide bay in the south-east. A river runs from a pond under the mountain down to the bay, and the
  town's streets follow it: a main street along the bank, a square with a bridge, a quay on the bay, lanes, with plots
  for the lab, the airship station, a shop, Juniper's home and the cottages. A hamlet sits round a green under the
  mountains and a farmhouse beside the barn and its pasture; a road runs all the way round (under three minutes'
  walk). No buildings stand on the plots yet, and Copperleaf itself is unchanged.
- The Studio has a Hub island section (IS-6a): the hub's island in an orbiting 3D view and on a map, with its ground,
  coast, zones and the camera's pivot edited by hand, a walk round the coast, and a lock that freezes the island's
  ground once it is right (props stay free). It works on the test island until Copperleaf moves onto its island.
- Island props (IS-4): the ranch barn is 3D now (still its red gambrel barn, every side finished, its colour looks
  kept), and a new set for the island waits in the debug menu's Test scenes ("the island props"): a field gate,
  a water trough, round hay bales and a hay rack; driftwood, beach grass, shells, shore rocks and tide pools; a
  fishing boat and a net rack by a pier; granite boulders, a cairn and a summit lookout; forest litter. Scree and the
  mossy log and stump on runs are 3D too. Nothing moves in Copperleaf yet.
- The sea all round (island track IS-3): on the test island the sea now runs out to the horizon on every side
  with no line where it meets the shore's water; waves and their whitecaps roll in toward the island from every
  direction, lines of surf break along the whole coast, the water washes up the beach and leaves the sand wet, and
  a cove's water stays calm. Trees no longer stand out on the open sea past the edge. The far wall of the Hollow
  Earth in the sky has a softer outline.
- The orbit camera (island track IS-1): on the test island the camera stands out over the sea and looks in at the
  island's middle, so walking round the coast turns it all the way round, smoothly and with no jump. Holding right
  walks you round on the same circle. On the summit the camera holds still; your own turn (two fingers, Q/E) still
  works on top, up to 30 degrees. Engine > Camera has "Orbit round an island" and, to compare, "Sun turns with the
  camera" (off: the sun stays put in the world). Copperleaf is unchanged until it becomes the island.
- The island track begins (IS-0): a test island in the debug menu's Test scenes (a cone of a mountain, a grass ring,
  beaches and the sea all round), the first step to Copperleaf becoming a real island you can walk round. Nothing
  changes in Copperleaf yet. The island will be the hub itself, with its own editor in the Studio and its ground
  locked once it is right.
- Loopholes (RL-12): beat a mini-boss on a run and pick one of three Loopholes, or buy one in a town's shop (one a
  day, priced by rarity). Each lasts the rest of the run and bends a rule: cheaper shops or clinics, better catches,
  more money from wins, a Speed boost at the start of every battle, harder physical hits, less damage taken, a little
  healing each time you walk into a place, more Capital at the payout. You hold up to six; past that, a new one takes
  the place of one you let go. The run's bottom bar has a Loopholes tab listing what you hold. Ten to start with, all
  on offer from the first run; the numbers are first guesses.
- Breeding (RL-10a): the ranch's sheet has a Nursery and "Breed a pair". Safe: two Billies of one line, 10 Scrap, and
  you see the egg before paying. Risky: any two, 5 Scrap, and anything can hatch: most often a plain Billie, sometimes
  one with a quirk (a parent's move, an odd size or coat), and one time in ten an abomination with odd parts, a name
  made from both parents' and one stat far up and another down. Eggs hatch at the ranch after 4 hours of real time,
  even while you're away; the parents stay free meanwhile. The old eggs are gone: wild Billies and trainers don't
  give them, walking doesn't hatch them, and the incubators and the Bag's Eggs pocket went with them.
- The last flat trees on a run are 3D now (props batch 10): the ridge's pines and cypress, the autumn wood's rowan
  and great oak, and the thicket's oaks, birches and pines have a modelled trunk and roots like the other trees. The
  pines keep their drawn look; each tier sways on its own. The larch was rebuilt the same way, so it no longer shows
  its stem through its branches.
- The Lab's unlock board (RL-11): the Lab tab is in Copperleaf's bottom bar now (and the machine in Hazel's lab opens
  it). Spend Capital there on wares for the shops in a run's towns (Nerve Tonic, Wake-Up Tea and Revives are no longer
  sold there until you unlock them). The ranch's sheet sells Ranch Lv 2 and 3 for Scrap (more training slots, a higher
  level cap); the airship mast sells Airship Lv 2 for an Audit Seal, then the ridge and autumn lands (a new player's
  runs have meadow, lake and thicket places only). Milestones pay on their own: your first run, five runs, your first
  win, fifteen kinds caught. Buildings with levels say theirs on their label. All prices are first guesses.
- Packing for a run (RL-9b): at the airship mast you now pick who comes from home, one Billie at Bracket I, from your
  team or storage (one training at the ranch stops while it is away), and pack up to 5 things from Copperleaf's bag
  (items and Copper Coins) on top of what the airship gives. The rest stay home. Your travellers leave fully healed.
  Win, and everyone comes home with what they learned and the run's bag goes into Copperleaf's; lose, and you keep one
  Billie (one from storage goes back to storage with its run's levels) while the bag turns into Capital.
- The ranch (RL-9): a red barn by Copperleaf's farm. Walk in and tap the training board or the rancher: Billies resting
  in storage can train there for a little Scrap, gaining a level every two hours of real time (up to eight hours
  between visits, up to level 15 for now), collected when you come back. Storage shows there too, and the Team tab
  keeps it. Runs now bring Scrap home: a little for every place reached, more for a win. Rooms are a little smaller
  inside (still bigger than the building).
- Tall grass grows in patches (terrain TR-2c): every place on a run has 4-6 patches of tall grass instead of strips
  beside the road, and one of them lies across the road west, so the way on goes through it. Wild Billies wait in any
  patch, anywhere on the map (before, only near the middle). Hopping down a ledge now kicks up a puff of dust where you
  land. The places of a run already going change to match the next time it loads.
- The pictures behind the menus (the pixel sky's sky and clouds, the sunset on the title, Trainer card and route card)
  were deleted; the sky and those cards now use plain gradients in the same colours, and the sky has no clouds.
- The camera on tall ground (terrain TR-3): when a mountain or a cliff stands between the camera and you, the camera
  tilts down further to look over it (up to 18 degrees more), the rock, trees and water in the way thin out in a
  circle round you, and where something still hides you your shape shows through it as a blue silhouette. On flat
  ground nothing changes. Each can be switched off (Engine > Camera: "Rise on tall ground", "Rock fades in front of
  you", "Your silhouette through rock"). Shadows near you now follow you up a mountain. The debug menu's mountains run
  now has mountains on both sides (north and south), and the debug log says how far the camera has risen; it also
  said 0 for a place's mountains on every run, now fixed.
- The game always runs the latest version: after an update it loads the new one by itself (when you come back to
  it, or within ten minutes), saving first and waiting until a battle, cutscene, flight or window is over; it never
  mixes files of two versions.
- Runs look like your own (RL-8b, after the first play): the world map in Copperleaf shows Copperleaf's island alone,
  in open sea; a run has its own world map, made from its seed: its own land, coast, hills, woods and clouds, the
  run laid across the whole bowl from the landing in the east to the boss in the west, each place's own ground round
  it, and no Copperleaf on it. Rooms are darker: their fill light was set almost nine times higher than outdoors, which
  washed them out to white.
- Runs go east to west: you enter each place on a run from the east and the way on is to the west (RL-8b: and on
  the world map the run crosses the bowl from east to west). A run started before this is left (its places were
  laid out the other way).
- Every screen in the angular look (UI track UI-5): buttons have cut corners and a screen's main action is a long
  hexagon; the top bar, the place card and the Walk sheet, the Map's card, the Trainer card, the Guide's pages, Team's
  storage, the Bag, shops, Settings and the pickers in sheets have cut panels and cards with a fine edge line; tabs are
  cut on top. The bottom bar is new: Map, Team and Bag (a run has its own set; Lab and Relics come with their
  screens). There's no Walk tab any more: tap the open tab again, or press Esc, to go back to the world. The Guide
  opens from your Trainer card (tap your portrait). Under the hood the screens each have their own code and styles,
  and 75 unused style rules are gone.
- Runs go east to west: you enter each place on a run from the east and the way on is to the west, and on the world
  map the run is an arc across the south of the bowl, from the south-east to the south-west. A run started before
  this is left (its places were laid out the other way).
- Mountains and mountain trails (terrain TR-2a, TR-2b), in the Studio's map generator and in a test run from the debug
  menu (Runs, "Mountains"); runs don't use them yet: ridges up to 20 m on the sides you choose, rising in rock shelves
  and cliffs, kept away from the road, the exits and water, and a footpath that winds up each one in switchbacks, stone
  steps where it's steep, to a flat summit (most about 11 m up, the highest 15-19 m). The debug log says whether a run
  has mountains and how many triangles the ground has, for measuring them on a phone.
- Ledges (terrain TR-2c), in the map generator and the debug menu's test run ("Mountains and ledges"): terrace edges
  facing you become ledges you hop down but can't climb, with stone stairs here and there to get back up, so a raised
  shelf runs beside the road like a second lane; no ledge ever drops you somewhere you can't get out of. Far corners
  and raised shelves get marked spots for things to find later.
- Runs are playable (roguelite track RL-8): the airship at Copperleaf's mast takes your team on a run. You land on
  day 1 and walk the run's places: wild battles, towns where the clinic charges $60 a hurt Billie and the shop sells
  the day's stock, two mini-bosses (leaders, in double battles, who block the way on until beaten) and the boss (a
  leader's strongest Billie as an Alpha). Win, or lose your whole party, and the payout turns your money and finds
  into Capital (Seals too on a win); on a loss you keep one Billie of your choice. Then you're back in Copperleaf by
  the mast. Storage stays home during a run; a seventh Billie caught means letting one go. Closing the game anywhere
  brings you back where you were, even mid-battle (the battle starts again). "Give up the run" is in the Map tab.
  New game now plays the fall alone: you wake in Copperleaf, meet Hazel, make yourself up and pick your starter, and
  Hazel sends you to the airship (Blake is out of the opening for now). Bridges on a run's routes now cross the
  stream square and can be walked; one could trap you on the landing.
- A run's world (roguelite track RL-7): each place on a run's map is a walkable route made from the run's seed, joined
  seamlessly to the places before and after it, in its biome's look, ground and weather, with a little variety of its
  own (hills, cliffs, a stream or a pond, the road's shape, a lookout, a glade or a bridge). Walking into the next
  place, or back, takes a day; a step over the edge and back doesn't. Each place has the weather of its forecast for
  the day, and its wild Billies at the levels of its row (3-5 on the landing, one more a row), fewer when you walk
  back. The world map shows the run: its places by type as you come near them, "?" for the row after, the boss
  always, the day and deadline at the top, and each place's week of weather on its card. On a run, your friends see
  "a run" rather than where; postcards, today's visits and the townsfolk's requests stay in Copperleaf.
- The run map and its clock (roguelite track RL-6), not in the game yet: a run's map is made from its seed, 9 rows
  from the airship's landing to the boss, mini-bosses on rows 3 and 6 with a town before each, one or two lanes,
  sometimes a switch between them. Entering a node, forward or back, takes a day; the landing is day 1 and the
  deadline three days after the shortest walk (day 12). The map shows the next row, the row after as "?", and the
  boss. Each node has its weather day by day from its biome (meadow, lake, thicket, ridge or autumn). The weather's
  odds now live in one place the run reads too (the weather you see in Copperleaf is unchanged), and the payout will
  pay for each node once, however often you walk back.
- Billies from the part kits (phase 16): all 24 Billies are now built from the three part kits (beasts, birds,
  fish), drawn straight-on and upright: the starters too (a muskox from bear parts with horns and a spark tail, an
  otter from cat and bear parts with a flat tail, a goat from rabbit parts with horns and a beard), a swift with a
  blonde fringe and a silver mic crest, a chameleon with a sleek dark crest and a glowing ring, the slug and the
  octopus as before. No clothing or gear: boosters, boxes, the sweater and the hat are gone. Each stage names its
  native parts (the set that will make it Prime), they squash, stretch and blink, and every form fits the stage box.
  The hand-drawn starters are kept as a part library.
- The run parts (UI track UI-4), not in the game yet: the parts the run's screens will use, in the UI gallery. A
  day and deadline chip (gold on the last day, red past it), the forecast as a row of weather icons by day, map
  markers by node type (a diamond for the boss, a hexagon for a town, a chevron for a route, a slanted card for an
  event; seen, here, visited, locked or not yet seen), chips for the four currencies that count to a new value, the
  card for relic picks and the keep-one picker (face down it flips over), the payout (rows slam in one by one, Capital
  counts up; a tap skips), and the bottom bar with the run's tabs (Map, Team, Bag, Relics) or the hub's (Map, Team,
  Bag, Lab). Six new icons. With reduced motion the numbers jump and the motions fade.
- Turned props (phase 09 batch 9): any prop on a map can face any way (a placement's `rot`, degrees, which only
  buildings had, for a few degrees along a street). The model, its decals and leaves, its shadow, its reflection,
  its footprint (where you can't walk), the ground levelled and shaded under it, its door, lamps, windows and smoke
  all turn with it; a picture that stands still in the world turns too, one that faces the camera doesn't. In the
  Studio's Walk scenes, [ and ] turn the selected prop 15° (Shift: 90°, Alt: 1°), several selected props turn together
  about their middle, the card has a Turn box and buttons, and the map shows which way a turned prop faces. Mirroring
  a block or a room turns its props the other way. Test map: `test_props_turn`.
- Plants (phase 09): the flowers, grasses, reeds, ferns, pads and ground cover of Copperleaf and the generated routes
  each come in four more drawings: a sprig with a bud, a domed cluster, a wide drift with fallen petals, tall stems,
  scattered rosettes, windswept or seeding grass, curled fiddleheads, rafts of lily pads and so on. Generated routes
  pick among them instead of stretching one picture to a random size, so every plant stays on the 32 px/m pixel
  grid (and the renderer no longer gives these plants a random size either).
- The hub alone (roguelite track RL-5): the game is Copperleaf Town now; every other place, its map, trainers,
  shops, day jobs and lore is parked for the Studio (its new Legacy section) and no longer loaded. Copperleaf's south
  exit and Route 1 are gone, the world map shows Copperleaf alone, and the eight badge leaders wait for the runs as
  mini-bosses. Hazel, Blake and Copperleaf's people no longer give directions to places that are gone. A save from
  before loads at Copperleaf with the parked places dropped from it; a backup file exported before can't be
  imported. Rooms now open in place in a town with no exits (Pearlantis's didn't). The game's data is about a
  quarter smaller to load.
- The Studio's UI look, tools (UI track UI-3b): the preview shows the game's real Team, Bag, battle and dialogue
  screens with the look being edited, or the saved and unsaved looks side by side. Inspect a part to see which dials
  reach it; Connections on a dial lists the parts it reaches. Overlays mark tap targets under 44 px, text that reads
  too faintly and glass stacked too deep. The Check reports the UI rule counts, with every line listed.
- The Studio's UI look (UI track UI-3a): Game → UI look edits the menus' look: colours light and dark side by side
  with a contrast grade on each text colour, the glass, depth and drop shadows, the shapes (each family's cut,
  corners and radius), space, type and motion, for the whole game or one screen's colours and shapes. Presets (save
  your own), Hold to compare with the saved look, and the UI gallery as a live preview; an open game tab follows the
  dials. The Check flags text that reads too faintly. The game looks the same: the look's data now holds every value
  the dials edit.
- The look, angular (UI track UI-2): panels, sheets, cards, buttons, tabs and toasts have cut 45° corners with a thin
  edge line, light on top and dark below; the main action is a long hexagon. The team rows are solid cards, the
  battle text, the move menu and the dialogue box cut panels, move tiles cut cards. HP bars are angular and
  segmented. Portraits sit on a circle with the head breaking out of its top. Type pills carry a glyph (flame, drop,
  leaf...). Bots get a steel plate with pips for each limb, in battle and on the team. The icons are redrawn on the
  45° grid. Screens and sheets come in with a diagonal wipe (a fade with reduced motion). New parts for the screens to
  come: cards, tabs, stat bars, text fields, a slanted selection bar, a rule with a diamond. A stepped (pixel) and a
  rounded look are in the theme data to compare. The dialogue box is a speech bubble with a tail over the portrait;
  the bubble floats and breathes a little and pops with each new line, while the words stay still.

- Battles (roguelite track RL-4): a battle still going after 40 turns is called off as a draw (a wild battle as if
  you walked away, a trainer's as a loss). Lullaby's text says 2-4 turns of sleep, as the rule has it. Inside, a
  battle can now run with its own seeded chances and without touching the save (for runs, ghosts and tests); the
  battles you play are unchanged.
- Save format 4 (roguelite track RL-3): the save gets room for the roguelite (what lasts between runs, the run in
  progress, the ranch). Saves from before are set aside and a new game starts; Settings > Save can download the old
  one. The set-aside slot now keeps the latest unloadable save (it kept the first, so a second one was lost).

- Map generator (MG-2, with terrain TR-1): a generated route joined to another scene's exit meets it: the exits face
  each other a whole number of metres apart, the land meets at the same heights along the stretch the game shows of
  its neighbour, the neighbour's natural ground runs on across, and you walk straight across. Terraces come down to
  ground level by every exit, and roads climb terraces as slopes instead of little stairs. The Studio's Generate card
  joins an exit to any scene's exit (Joins…), shows how the two meet, previews them side by side, and can put an
  airship mast, a clinic and a shop by the hub. The seam rules the data check uses are now one module the generator's
  tests use too.
- Map generator (MG-1): the Studio's Walk scenes → Generate… makes a whole route from dials and a seed (biome, size,
  land, water, the road and its exits, nature, a feature, props), drawn live by the game's renderer as a draft and
  added as a scene of its own in one undo step. The same dials and seed always give the same route. The biome
  recipes are data (game/data/biomes.json, 11 biomes taken from hand-built routes).
- Story scripts (Project Story S1, S2): every conversation is written as lines in the data, with choices,
  conditions, once-only and rotating lines, and commands (docs/SCRIPTS.md): people, trainers before a battle, Blake,
  Cass and Vinylla running up to you, Hazel in the lab, the talk after Blake's first battle and the ending. Same words
  as before. Hold the dialogue box to skip. A save taken mid-conversation keeps the state from before it and plays it
  again on Continue. Test runs can start at a point in the story (`?story=after-opening`).
  People, trainers and props can appear only at some points of the story, places can stay closed until a point, and a
  chapter can swap a map for another version. Every line has an id the debug log names. The data check checks the
  story (names, flags, line ids, places that could never open). A battle started from the debug menu no longer shows
  the trainer's opening lines.
- Cutscenes are data (cutscene tools, sessions 1 and 3): each is one file, game/data/cutscenes/<id>.json, with the
  map it is filmed on, named camera shots and spots, traffic lanes, its own time of day and weather, and a script
  (docs/CUTSCENES.md). The opening with Professor Hazel and Blake plays from its file, same words as before.
- A new start (Project Story S7): New game opens in a city at night in the rain; a figure walks up a neon street,
  sees a violet light in an alley, reaches for the rift and falls; the fall goes on from the crust to Copperleaf.
- The title is back (the test boot is off; `?boot=test` gives the quick start): signed out, a card to sign in with
  Google or play without an account; signed in, your account in the corner (tap to sign out) and Continue presses
  itself after 4 s unless you touch anything. A new player sees the city behind the title, a returning one Copperleaf.
  What's new opens the latest notes (meta.json, the Studio's World page). When your account and this browser have
  different games, you choose which to keep; the other is set aside (Settings → Save brings it back or downloads it).
- The Studio writes the story (Project Story S3): every script (trainers, people in a scene, the story's own) in one
  field that shows mistakes as you type, on their line, with a command reference and line ids; a Story scripts
  section; a story preview in the scene editor (pick a point in the story: who is there and who isn't); **Play from
  here** opens the game in that place, on a spot you pick, at that point in the story, with your unsaved changes.
  The scene editor's People card edits today's people (script, when, unless), and the Check lists the story checks.
- Golden Billies are gone (Studio track ST-0). In their place, coats: a recolour of a Billie's art, made in the
  Studio's new Coats section from palette ramp and colour swaps or a hand-painted sheet, each with its own odds in the
  wild, from eggs and on the line (none yet: the sample coat, Midnight, only comes from the debug menu). A coat's name
  goes before the Billie's ("A wild Midnight Emberox appeared.") and shows on its card. The Studio's pixel editor
  loses its Golden tabs; the Billies section and the battle preview pick a coat instead.
- The Studio on wide screens (Studio track ST-1): drag the edges of the section list, a section's list and the battle
  preview's panel (or use the keys), and each section keeps its sizes; wider layouts at 1920 and 2560 px and up, and
  no more 1180 px cap; two sections side by side (Shift-click a section, or its ⇥ button); layout presets in the top
  bar (Auto, Compact, Wide, Ultrawide, Split).
- The Studio paints pixels on one shared canvas (Studio track ST-2), in the sheet editor and the prop and ground tile
  painter: whole-number zoom that keeps the pixel under the pointer, a grid from 8x, Space-drag to move the view, a
  line tool, box selection, flip left-right or upside down and quarter turns of the selection or the part under the
  pointer, symmetry drawing, a lock to the game palette (and the pixels off it shown in magenta), an onion skin of
  the other view, and Aseprite's keys. Painting is in the Studio's one undo, in order with every other edit, and stays
  undoable after switching Front/Back. `?` lists every key. An undo in Walk scenes no longer only takes back a
  height cache the map kept.
- The Studio's Art workbench (Studio track ST-3), Sheet mode: drop sheets anywhere on the Studio and cut them into
  parts by a kit's rows, islands of art, a template grid or an Aseprite JSON's frames and slices; art drawn big (an AI
  image at about 4x) snaps back to its pixels; names from a template; front and back matched by name, then by
  position; Write puts the pictures and the parts in the game (one undo each). The phase 16 kits slice exactly as
  before, so tools/slice-part-kit.py is retired; the part list is now game/data/partKits.json.
- Art workbench, Part mode (Studio track ST-4): a kit part's front and back side by side; drag the pivot crosshair
  and the labelled sockets, or nudge them with the arrow keys (Shift for a quarter pixel); pick the slots each socket
  takes; turn limits and draw order per view; a test fit onto a body with a turn slider and a swing; Mirror to other
  side makes a copy (<id>_r) with the pictures flipped and the sockets swapped; S and L can be painted by hand,
  starting from M scaled. Writing a sheet again keeps all of it. Each kind has a draw order, turn limits and the side
  its art is drawn for in partKits.json; the pivot of a part not moved by hand is its joint, chin or base socket.
- Robots on the workbench (Studio track ST-5): Part mode shows robot parts, heads and gems with the points the game
  joins their pictures at (neck, shoulders, hips, gem); drag or nudge one to store it in robots.json, or go back to
  the computed point. Robots look exactly as before until a point is moved. The Robots section opens a part there,
  and the battle preview can put robots on the stage (Try a build and the trainers' robots).
- The species' sheets on the workbench (Studio track ST-6): Part mode's Billies source shows a species' pictures on
  its sheet, front and back, with the pivot, the parts that hang on it and the picture's box. Moving a pivot keeps the
  Billie drawn where it was (as the skeleton builder's pivot drag does); dragging a socket moves the part that hangs
  there; an edge or the box itself changes which pixels of the sheet the picture takes (every frame together, or one);
  draw order per view; the Billie as the game draws it beside, standing or moving. The Billies section and the
  skeleton builder open it. The skeleton builder zooms by whole steps, fits its window and takes the pixel canvas's
  zoom keys; Paint pixels opens the part picked. The wardrobe paints on the shared pixel canvas (its tools, keys,
  symmetry and palette lock, the Studio's one undo) with the trainer faint behind the piece; a stroke marks the
  colour-area mask in the same undo step; Grow piece gives a piece room (pieces no longer grow while painting).
- The Studio's scene preview has a free camera: fly over the scene and look at any corner from any angle, with the
  mouse, the keys or two fingers on a phone; a top view; put the walker where you look.
- Robots (phase 17 prototype): build your own from a gem and four parts (torso with head, left arm, right arm,
  legs). They join the same team and the same battles as Billies. Their moves come from their parts; a hit on a robot
  also lands on a part, aimed moves pick the part, a broken arm loses its move and broken legs are slow; healing and
  the new Repair Kit fix them. A Workshop panel on the Team screen refits them. Placeholder art. In the Studio: a
  Robots section, robot options in Moves, Items and Trainers.
- One version, 0.1.0 alpha, read everywhere from game/version.js: the title screen, the Studio's top bar, the offline
  cache, the debug log, the diagnostics report and saves.
- Friends are safer: friends find each other by code only, only friends see a player's page, and only the receiver
  can accept a friend request. Names lose characters that could break the screen.
- The game needs WebGL 2. Without it, a screen says this device can't run the game, with Try again and Export debug
  log. Lite mode and Settings → Graphics → Battery saver are gone (a save with it on comes back at full effects).
- Steps are gone (phase 08 Part A). Nothing counts steps any more, real or in the game:
  - Wild Billies live on each map: 4 on a route, 2 in a town with tall grass, none in other towns and rooms; full on
    your first visit, then one more a minute of play.
  - Money: a wild win pays level x $20; trainers, bribes and challenges pay as before.
  - Eggs hatch by the real metres you walk outdoors: 2 / 4 / 8 km eggs. Distance walked on the trainer card is real km.
  - Your buddy gets the full XP of a win even when it sat out. At level 32 a starter's evolution asks you: Build or
    Hype. Day jobs are gone until the ranch.
  - The daily challenge is "Visit N different places today"; a letter goes to a town 1 to 3 roads away and back.
  - Roads are measured in metres from the maps ("90 m"); the gold arrows guide by metres.
  - All the step text is rewritten (tips, people, Hazel, rooms, lore: money is coins now).
  - Saves of format 2 start over (save format 3).
- Rooms open at once (phase 08 Part B): the room is drawn over its town at the door, the town dimmed round it, and
  nothing of the town is painted or built again, so stepping in no longer waits (the Marigold shop took up to 11 s
  headless, now under 1.2 s; your phone's debug log says "inside ... (waited N ms)"). There is one way in: through a
  building's door. The 9 s fallback that showed a room on its own and Settings → "Shops and houses: Counter" are gone
  (a door with no room still goes straight to the counter). Coming out, you stand just in front of the door facing
  out, and the camera is as it was. A turned building's door turns with it. Marigold's shop and clinic signs lead
  into their buildings.
- Run: push the joystick past its rim into the outer ring (it turns gold), hold the D-pad's centre, or hold Shift.
  Settings → Moving about → Always run makes a full push, the keys and tapping the ground run. The keys and the D-pad
  walk at walking speed (they were a little faster). The walk cycle, footsteps and camera bob keep pace with your
  speed.
- Studio: the Jobs section opens again (it broke when the jobs' rules went); Rest stop price is in the Battle card;
  the camera dial "Step sway" is called "Walk bob".
- Removed: the single-file Claude-artifact version, the old train station prop, the v45 backup scenes in the game data
  (1.5 MB), importing a legacy Net Worth backup.
- Smoother towns on phones: props no longer all recheck their height and look in the same frame twice a second, and
  the props' culling grid is no longer rebuilt every 2 s (both were regular hitches in big towns like Clovercrest).
- Diagnostics report format 2: a place's fps counts from once it is open, its opening hitch is reported apart
  (`openHitchMs`, `openHitchCause`), and the first and last second of the other steps are left out (they read low).
  The debug log now names the opening hitch (setting up the ground, building the ground mesh, the walk grid, reading
  the picture back) instead of "outside the marked steps".
- Draw counts (phase 20, stage A): the debug log says, once a second, how many draw calls, instances, program
  switches, texture binds and uniform calls a frame made, and how many draws each render pass made (shadow maps,
  lamps and the reflection apart); also the lights in the frame, programs compiled after a place had settled, and a
  rough sign of garbage-collection hitches (Chrome). The graphics test and the diagnostics report the draws per step
  (a Draws column). Fix: their pass timers had skipped the 3D models, box faces and structures.
- Less work per frame (phase 20, stage C, first part): the graphics settings are looked up once a frame instead of
  thousands of times, and the walk view stops making new lists and arrays every frame for the shadow passes, the
  contact shadows, the sprites and the grass, which leaves less for the browser's garbage collector. Nothing looks
  different.
- Less work per frame (phase 20, stage C, second part): a test switch, Studio → Quality → "One light block per frame"
  (off for now), sends the frame's light (sun, sky, fog, shadow maps, lamps) to the graphics card once a frame instead
  of again for each kind of thing drawn; the graphics test compares it off and on at the Lamp square and the Depth
  corridor. Rugs, lily pads and other flat things are drawn as one group, and windmill sails and clock hands no longer
  send the light again each. Nothing looks different.
- New: the **graphics test** (Settings → Help, and the debug menu), about ten minutes on a new test place, the Graphics
  bench. It measures what each graphics setting costs on your device: the 17 Expert dials and five hidden ones, five
  steps each, then everything at its lowest and highest. It ends with a table, costliest first, and Save the report.
- Fix: the full test could let the friends list publish your name and place while the maps loaded at its start.
- Fixes: with Motion set to reduced, the camera snaps instead of gliding. Puffcap Woods and Russetwood get their own
  flower colours (they had the default ones).
- Under the hood: the game's and the Studio's code are ES modules, and the published game loads them as one file.
  The game needs a web server (opening index.html from disk no longer works at all).
- Under the hood: the modules no longer put their names on `window` (the game and the Studio reach each other's
  code through imports); for the console, add `?globals` to the address.
- Under the hood: the code, the data and the files have descriptive names (docs/NAMING.md; the old -> new list is in
  docs/archive/phase-05-renames.md). The places' ids match their names (Marigold Town is `marigold`, no longer
  `sundown`), so a debug log, a `?scene=` link or a Studio export from an earlier build names places the old way.
  The save format is 2: a save from an earlier 0.1.0 build doesn't load (a new game starts and the old save is kept
  aside, as with legacy saves). No text changed, but the 43 places with a new id look a little different: the
  pattern of their ground, their countryside, townsfolk and stamps are picked from the id.
- Under the hood: the rules, the save format and the battle engine are in game/js/logic/, which runs without a
  browser (the page reaches it only through hooks.js; `npm run check:logic` runs it in plain Node). TypeScript checks
  the data, the save and the logic from JSDoc comments (`npm run typecheck`); nothing is compiled.
- Studio: the hidden "With its neighbours" preview button is gone (it hadn't shown since the modules change).
- The debug log's picture of the scene no longer shows what your buddy says (it could name your Billie).
- Settings → Help → Run the graphics test (also in the debug menu): every graphics setting on its own, then the
  graphics presets, each checked for frames, frame rate and errors, in an OK/Problem table. "Save the report" saves a
  short file with no save data or names. Your save and your graphics settings are put back afterwards.
- The full test saves nothing while it runs, in this browser, to your account or to your friends, and puts your save
  back after (a signed-in player's account could get the test's changed save before). Its Road step arrives again
  (it never did since walking became the default), and its room step works on a slow device. Settings → Help says
  what it really covers and that it takes a few minutes.
- Under the hood: unit tests (`npm test`, tools/test/, in plain Node, about a second): the logic on a small data set
  and on the game's own data (battles, double and Alpha battles, catching, the AI, evolution, encounters, saves), the
  world-map graph (places, roads, exits, gates, lifts) and the expressions in dialogue. The quick check runs the
  game's own full test one step at a time, and whole every night (`check-quick.py --selftest`); smoke checks that the
  exported debug log holds no names. A Claude Code hook runs the fast checks after each edit.

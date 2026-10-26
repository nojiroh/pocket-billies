# Changelog

Pocket Billies, from the fresh base on. Versions are `0.MINOR.PATCH alpha`: MINOR for a finished phase or a batch of
new features, PATCH for fix-only releases; "alpha" becomes "beta" once the planned features are all in. The version is
written in one place, game/version.js. The legacy build's changelog is in docs/archive/LEGACY-CHANGELOG.md.

## 0.1.0 alpha (unreleased)

The fresh base. Numbering starts over; saves from the legacy build don't load (a new game starts and the old save is
kept aside in the browser).

- **More props on the routes** (route props track RP-1): the last drawn props in the routes' set pieces (firewood,
  the scrap heap, the creature statue, tyres, the tollbooth) are 3D models, and 20 new 3D props: a stile, a
  landing stage, broken columns, a ruined arch and wall corner, a milestone, a trail post, a wayside shrine with a
  glowing seed, a haystack, a rain barrel, a water pump, beehives, a tool shed, a vegetable bed, a small wind
  turbine, a solar path light, a seed library, and a Bureau barrier and crate (plus a footbridge, not placed yet).
  The ruins, farm pen, rest stop, woodcutter's clearing, fishing jetty and Bureau checkpoint use them, and two new
  set pieces appear on routes: a wayside shrine and a solar garden. A run's places change (generator version 18).
- **Sturdier after the graphics card is lost** (phase 20): when the browser takes the graphics card away and gives it
  back (a phone under memory pressure, a driver reset, the debug menu's "Lose the GPU context"), every part of the
  walk view, the world map and a battle is made again, with none of the hundreds of warnings and the unlit things of
  before, and the place fades back in once it is drawn. A place now fades in only once its first two frames are drawn
  (at most 1.5 s later; Studio > Engine > Quality "Warm up before showing", on), so the first draws' hitch happens out
  of sight. The debug log says how much of the graphics card's memory each kind of thing takes (pictures, render
  targets, ground, the near ring, meshes, instances) and names any shader compiled after a place had settled.
- **Smart light shafts and the HD-2D fixes** (all off until tested on the phone): cheap sunbeams placed where they
  show best (through gaps between trees and past houses, with shade behind them, looking into the light, never over
  you, fading in and out); and switches that fix what the audit found: rays that follow the light's colour and fade
  under the moon, window light that falls out of a turned house's front, shadow edges that stand still, lamp shadows
  that hold, shaded tree cores, occlusion that leaves open ground alone, lamp light on water, outlines that follow the
  camera, even bloom, half-float HDR, steady light on far props, fronts lit as their material, and Building bumpiness
  (bricks, planks and roof tiles catching the light). Engine > Air, Sun, Lights, Shadows, Colour, World and Quality.
- **Battles: rigs reused** (phase 20, a test switch, off for now; Studio > Engine > Quality "Reuse battle rigs"): each
  Billie's picture in a battle is drawn and sent to the graphics card again only when its pose, face or tint changes
  (about 6 times a second) instead of on every frame. Same picture. The diagnostics test now counts a battle's whole
  frame in its CPU time (it counted only the battle's own part, about 1 ms) and reports what the rigs cost.
- **Lighter shadows** (phase 20, test switches, all off for now; Studio > Engine > Quality): "Shadows in batches"
  draws the shadows of grass, bushes, leaves, people and models in batches, one draw for all the copies of a picture
  or a model (in a jungle route the shadows from about 360 draws a frame to about 120, and to about 75 with the next two), with the same look. "Models
  in the shadow cache" keeps the far shadows of trees and other standing models from frame to frame (boats, the
  airship, windmill sails and propellers are drawn each frame, so their far shadows move again). "Far shadows hold
  still" stops the shadows of grass and leaves swaying past the sharp shadows round you (about 13 m) and keeps them
  from frame to frame. They are in the graphics test.
- **Lighter drawing for phones** (phase 20, test switches, all off for now; Studio > Engine > Quality): "Sky last"
  draws the sky only where it shows, "Solid things first" lets the graphics card skip leaves hidden behind trunks and
  walls, "Drop spent pictures" saves memory traffic between the effects, "Rain in one go" draws rain, snow and ash in
  one go (bad weather cost about 150-230 extra draws a frame), "Phone pixel budget" (phones draw at most 1.2 million
  pixels, starting a step lower) and "Phone lamps" (8 lamps lit at once on phones, 4 of them glowing in the air).
  Studio > Engine > Air "Cheap light shafts" adds a few soft sunbeams from the trees when God rays are off. They are
  in the graphics test, with two new stations (the Sun gap without god rays, the meadow in the rain).
- **Pictures in batches** (phase 20, a test switch, off for now): Studio > Engine > Quality "Pictures in batches"
  draws the trees, leaf clumps, people and other standing pictures (and their reflections) in batches, one draw for
  all the copies of a picture next to each other (Copperleaf's pictures from about 700 draws a frame to about 140),
  with the same look. It is in the graphics test.
- **Reflections show the seasons**: trees and leaves in the water now turn with autumn and carry snow as the trees
  themselves do, crowns shade themselves in the water too, and a reflection no longer borrows the shading of the last
  picture drawn the frame before.
- **Models in batches** (phase 20, a test switch, off for now): Studio > Engine > Quality "Models in batches" draws
  every tree, house or lamp post of one kind in one go instead of one at a time (about 130 fewer draws a frame in
  Copperleaf), with the same look. It is in the graphics test.
- **Steadier lamps at night** (phase 20, a test switch, off for now): Studio > Engine > Quality "Steady lamps" keeps
  the lamps, windows and fires that light the scene from popping and flickering as you walk (each fades in and out,
  a lit one stays lit until another is clearly nearer, lamp shadows stop swapping), and "Lamps lit at once" sets how
  many may light the scene (1-16). Both are in the graphics test.
- **One light block per frame** is now the only way the renderer sends the frame's light (the old switch and path are
  gone); it looks the same.
- **Residents live in Copperleaf** (residents track RS-3): whoever you bring home now lives in town. Each has their
  own look and walks Copperleaf with the townsfolk: out of their door in the morning, at work, on the square around
  noon, about the streets in the afternoon and indoors at night. Dottie keeps the library, Mo the General store,
  Bertha the inn, Gus the Workshop, Hayden helps at the ranch, Rosa works at Skyline Station, Seamus sews from a
  cottage of his own and Dr. Helix keeps the Gene Bank. Tap one for a word: the first time it's about moving in, then
  about your last run. Walk into their building and its card says who lives there, with a Talk button and their
  upgrades (the first ones come next). The station's and the ranch's sheets name theirs too.
- **Residents** (residents track RS-2): runs can now bring people home to Copperleaf. On your first run, **Dottie
  Filewell**, a clerk who walked out of the Bureau with a cardigan full of files, waits in the first row of towns with
  a gold "!": say yes and she moves to Copperleaf. After her, one person a run waits in one town with a **favour**
  (catch a Billie of a type, beat route trainers, carry something to the next town, or beat the mini-boss with nobody
  fainting). The favour doesn't count towards your three quests; hand it in at another town's notice board and they
  agree to come. A few of them can also turn up stuck on the road at a waystation (**Stranded Cart**). Whoever you
  invite moves in when the run ends, **won or lost**, and the payout screen says so. What they do in Copperleaf comes
  next.
- **Spliced Billies, the rules** (splicing track SP-2; for now only through the debug menu, numbers are placeholders):
  a Billie can wear another species' arm, leg or tail, and it is saved with it. A foreign part weighs what it did on
  its donor (a bear's arm on a Swiftlet hits harder and slows it down), brings a trait (wings: Airborne, half damage
  from Ground; fins: Swimmer; tails: Counterweight; arms: Grip; legs and feet: Stride), and some parts carry a
  dominant type that becomes the Billie's second type. Each foreign part costs Stability; past the limit the Billie is
  **Unstable**: a merged name, one stat up and one down (rolled once, kept until it's stable again), and it loses
  a little HP each turn. A spliced Billie is never
  Prime. Splices survive evolving. **Prime** (every part its own and Normal sized) now gives +5% instead of +10%.
- **Wild splices** (splicing track SP-3; odds and amounts are placeholders): on a run, about one wild Billie in eight
  wears a part from another Billie of the same place (a **Graft**), and now and then one wears two or three (a
  **Chimera**, often Unstable). The battle says so as it opens ("This Swiftlet has an eagle's wings!"). Catch one and
  it keeps its parts; knock it out and you take a **Gene Sample** of what it wore and some **DNA**, a new currency
  banked at once (kept even if the run is lost). Copperleaf's Gene Bank, coming later, will splice your samples into
  your own Billies.
- **The Gene Bank** (splicing track SP-4; prices and levels are placeholders): Copperleaf's new lab-vault stands on
  its plot by the square. Walk in and use the Splice console: **sequence** any of your Billies (free) to read its
  parts into the Gene library, next to the Gene Samples your runs bring home, then **splice** a Gene from the library
  onto a Billie for DNA (5, 10 or 15 by how foreign the part is). A preview shows the Billie wearing it, its weight,
  stats, trait, types and Stability first. **Take off** is free and the Gene stays in the library, so a splice can
  always be undone. The Bank splices tails at first; its upgrades, bought with DNA, open front parts (Lv 2) and back
  parts (Lv 3) and raise the Stability limit from 3 to 4 and 5 (your Billies only: wild ones stay at 3). Eggs can
  keep a parent's Gene. A spliced Billie costs a starter point more per 2 Stability. Fins count as Water for **Surf**
  and a bear's arm as Ground for **Rock Smash** (the badge is still needed).
- **Splice events on runs** (splicing track SP-6; prices are placeholders): four new waystation events. A
  **back-alley splicer** gives one of your Billies a Gene of his own choosing, any part, for Moneys or DNA. The
  Bureau's **field lab** splices a Gene from your library at the Gene Bank's price (it only turns up once you have a
  Gene). A **Gene auction** sells Genes you don't have, for Moneys or DNA. A Bureau **Gene recall** asks one of your
  spliced Billies to hand its Gene back for DNA (it only turns up when you have a spliced Billie); refuse and a clerk
  battles you for it. A Gene spliced on a run also goes into your library, so it isn't lost if that Billie doesn't
  come home. Three new Perks: **Petri Dish** (Gene Samples pay 50% more DNA), **Gene Lure** (wild Billies of the next
  places are spliced twice as often), **Stabilizer Gel** (your Unstable Billies lose half as much HP each turn).
- **Augments** (splicing track SP-5; prices are placeholders): Copperleaf's **Workshop** opens. Walk in and use the
  Upgrade bench to fit a bot's arm or legs from your spare parts (salvage from the Bureau's bots) on one of your
  Billies, for Scrap: an arm replaces its right arm, legs its legs. An Augment brings its move (beside the Billie's
  own), its type, some of its stats and its weight, and counts for field moves (the Hydrant Arm for **Surf**, the
  Auger Arm for **Rock Smash**; the badge is still needed). It costs 3 Stability, so a Billie with a Gene and an
  Augment can turn Unstable. Augments are the only parts that **break** in battle (aimed moves go for them; a broken
  arm's move fails, broken legs are slow); a town's clinic or a rest mends them. Upgrade them at the Workshop; its
  levels (bought with Scrap) fit legs and upgrade further. Taking one off is free and the part goes back to your
  spares. Now and then a wild Billie on a run is an **Escaped specimen** wearing an Augment, more often next to a
  Scrapyard: catch it and it keeps it, knock it out and you pry the part off (and some DNA).
- **The Bureau's bots** (roguelite track RL-14, first half): the Bureau of Lost, Found and Beans now fields an army
  of bots built from robot parts (Courier Units, Repossession Units, Shredders, Stamp Presses, Filing Drones, Audit
  Units). Deeper into a run (from the fourth row on) about one wild encounter in ten on rocky, hot or cold ground is
  a bot instead of a Billie; the Bureau's clerks and its new **Reclamation Agents** bring one or two bots along. Bots
  **can't be caught**. Their limbs break in battle and now **drop off**, and every bot has a beeping cry. Beat bots and
  they leave **salvage**: pick one of two of their parts (kept for the Workshop) or a stack of **Scrap** sent home.
  About a third of runs now have a **Scrapyard**: a place where every wild one is a bot, Reclamation Agents stand guard
  and scrap heaps line the way.
- **Three new Billies (roster RO-3f, placeholder art)**: Pseudonymph, a faceless mythical Steel blob whose move Fork
  takes the foe's types for 5 turns; it stands in for a route's rarer one in 2% of routes, at most once a run, and is
  in no pool or regional dex. Pilotbat evolves into Bingebat at 18 (Flying, then Flying/Psychic), the cave bat, in
  the cave, thicket and jungle.
- **You stay visible behind things**: when a building, a tree or anything else stands between the camera and you,
  your outline shows through it in the colour of your top, the thing in front thins out in a soft circle round you,
  and tall things covering you fade a little (now smoothly, and the modelled buildings too). Out in the open nothing
  changes. The one you are talking to shows through the same way. Engine > Camera has the dials: "Your outline when
  hidden" (was "Your silhouette through rock"), the outline's width and fill, the circle's switch, size and strength,
  and how far things covering you fade.
- **Blake is your rival on runs** (roguelite track RL-S2): he waits on a run's map (a "Rival" pin), once a run at
  Expedition I and up to twice later, with a team built to beat the Billie you set off with. It grows with every
  meeting. Beat him for a reward pick and Moneys (and a Bean, the first time in a run); lose and the run is over. On a
  two-place row you can go round him. He has something to say before every battle, and remembers how the last ones went.
- **Beans and the hub folk** (RL-S2): a fifth currency, **Beans**, found now and then on runs (a certain crate, your
  first badge of a type, a side area's leader, a won run). Back home, Professor Chosen, Hazel and Granny Juniper each
  take one Bean each time you are home, and thank you for it. Gifts raise your level with them (five levels), and
  levels bring small things: a few more Moneys or XP, a Potion, a Hi-Potion or a pyramid at takeoff, better catches, a
  piece of clothing, and at the top something they've never told anyone.
- **Favours and Chapter 1** (RL-S2): each of the three asks one favour of you for a run (beat a leader, go far, bring
  a Grass Billie home); do it and they notice when you get back. Over your first runs Hazel and Chosen piece together
  Chapter 1 of what's going on with the Bureau, a beat each time home.
- **The story reacts to your runs** (roguelite track RL-S1, the story director): the game remembers your last 20
  runs (where, how far, what beat you, who you brought, the Perks and leaders). Back in Copperleaf, **Professor
  Chosen, Hazel and Granny Juniper** each have a fresh word about your last run the first time you talk to them. After
  a **lost run** Chosen loudly takes the credit for bringing you back, and Hazel isn't so sure it was him. On a run,
  **leaders** say something before the battle (they remember beating you), and the **Bureau's clerks** have started
  keeping a file on you.
- **Held items** (roguelite track RL-12c): every Billie has one held-item slot. Eight to start with: Leftover
  Sandwich (heals a little each turn), Snack Pack (a quarter of its HP once a battle, when low), Lucky Coin (wins pay
  25% more), Study Notes (50% more XP), Iron Vest (15% less damage taken), Quick Laces (Speed up as it comes in), Brass
  Knuckles and Smart Specs (physical or special moves 20% harder). A trainer's reward pick can offer one; you choose
  who holds it, or put it in the bag. Give, swap or take off held items from a Billie's details. They last one run: at
  the end they go back into the bag (paid as Research on a loss, taken home on a win).
- **Expeditions, challenges and starter points** (roguelite track RL-13): runs now have difficulty tiers.
  **Expedition I** is the game as it was; winning the highest one open unlocks the next, up to **V**. Each one above I
  sends foes out 2 levels higher, makes the final boss tougher (+15% HP a step), raises run shop and clinic prices by
  10%, and (from the region generator) adds a zone or two to the run. Once you have won a run you can also take
  **challenges** on: **Mono-type** (pick a type; only Billies of it may start the run or be caught), **No healing**
  (clinics shut, no healing items sold or packed), **No Perks** and **Fainted is gone** (a Billie that faints leaves
  the run). Each pays 25% more Research.
  **Starter points** replace "one Billie from home": every Billie at the ranch has a price in points (by how rare and
  how evolved it is, and 1 more per 5 levels), and the mast gives you a budget to spend (20 at Expedition I, more
  later). Bring six fresh ones or three trained ones. A Billie that is already fully evolved, or never evolves, is
  priced as a final form. The start sheet shows each card's price and why one can't come.
  **Leaders now field their own type**: the Water leader brings Water Billies from the region, not whatever the old
  data said.
- Leaders and trainers on a run no longer field a fully evolved Billie before level 32: a Flying leader could send out
  four Peacoutures at level 11.
- Run towns look like towns (towns track TW-1): a short street leads off the road to a little square with a well or a
  fountain, benches and lamps, the clinic and the shop facing it, and a row of houses with gardens and fences along
  the road. The houses are for show; only the clinic and the shop open. Each biome builds with its own houses.
- Run towns have people in them (towns track TW-2): 2 to 5 townsfolk by the town's size go to work, sit on the
  square, wander the street and go home at dusk; chickens and cats (pigeons on a bigger town's square, crows in the
  volcano and the badlands) keep to the town. Folk talk about their biome and the run's region, and one or two named
  locals stand about with something to say. Beautiful draws up to 6 folk, Balanced 5, and 3 while the game is
  softening the picture to keep up.
- Run towns give quests (towns track TW-3): a townsperson with a gold "!" by the notice board on each town's square
  offers one quest (catch a Billie of a type, beat route trainers, carry a parcel to the next town, or beat the next
  mini-boss with nobody fainting), only ever one you can finish on this run. Hold up to three; the Map tab lists them.
  Hand a finished quest in at another town's notice board for a reward pick. Quests end with the run.
- Three new Billies and five regional forms (roster track RO-2c): **Siliclet**, a black gecko with one glowing scale,
  evolving at level 20 into **Jenzard** and at 40 into **Gigajenzard**, a rare Electric/Dragon data-centre dragon
  whose keynote dims the lights. Five Billies you already know now have a regional form, met in the biomes it suits:
  the **Harbour** goose (Flying/Water), the **Meatball** rat (Steel/Fire), the **Courtside** fish (Ground, and
  Ground/Dragon once it grows), the **Livestream** ferret (Electric/Fire) and the **Hazard** tiger (Water, then
  Water/Grass). That makes 40 Billies, the roster the plan set out to build.
- Balance: **Sharktank** is a real payoff now (a weaker Pupfin, a much stronger shark), the ferret and the tiger grew,
  and the goose, the rat, the ferret and the tiger evolve earlier, so a single run can see them change.
- Five new Billies (roster track RO-2b): **Cliplet**, a yellow kit that copies every dance it sees, evolving at level
  18 into **Tiktokferret**, an Electric/Psychic ferret that loops in fifteen seconds; **Cublet**, a tiger cub that
  could putt before it could walk, evolving at level 24 into **Tigerwoods**, a Ground/Grass tiger in Sunday red; and
  **Peacouture**, a rare Fire/Flying peacock whose fan is made of other birds' feathers.
- Eight new Billies (roster track RO-2a): **Gosling**, **Sprucegoose** and **Aviatorgoose**, the goose you meet on
  almost every route; **Flatpackrat** and **Kamprat**, a rat that assembles itself; **Pupfin**, a goldfish that won't
  stop pitching, until it evolves at level 20 into **Sharktank**, a Water/Dragon shark; and **Altmowl**, a rare owl
  with a cloud for a brain. They're the first common and rare Billies, so each run's region differs more, and fishing
  and eggs that used to give a stand-in now give these.
- **A floating island**: the hub's world map shows Copperleaf's island floating in open sky, its rock hanging under it,
  with no bowl and no sea round it. The town's buildings and trees stand at their real size, so the island reads as
  big as it is, and every landmark with a model (the giant swing tree, the summit lookout, the airship station and
  mast, the well) is drawn as that model. The sky follows the time of day, with a calm sea of clouds far below.
- **Orbit camera on the map**: it opens from your side of the island looking across it; drag to turn round it and
  tilt, pinch to zoom; left alone it turns slowly.
- **The map opens whole**: it is made ready while you walk, and stays covered until everything on it is in.
- **A shorter, livelier fall**: about 10 seconds. You drop out of the sky onto the floating island, faster and faster,
  then swoop round it and land by the lab.
- **Five times of day**: the light outdoors now comes from five looks, dawn, day, golden hour, dusk and night, that
  blend into each other with the clock (and move with sunrise and sunset through the seasons). Golden hour is warm
  with teal shadows, dusk pink and violet, night deep blue with warm lamps and stars; day keeps each place's own sky.
  Each look (its sky, light, fill, haze, mist, exposure, colour, shadow tints, glow, lamps and stars) can be tuned in
  the Studio's Engine page, which can now show any hour, weather and season and play a whole day in 20 seconds.
- **Calmer effects**: half the depth-of-field blur and a wider sharp band, much weaker colour fringes and vignette,
  less bloom, glare, saturation and mist. The blur behind menus on a phone is lighter too.
- **Faster on phones**: menus no longer redraw the moving 3D world behind them (it settles, then holds still), glass
  panels blur less, Billie pictures redraw less often, things too small to see aren't drawn, a phone skips small props
  far off in the haze, effects of things off screen aren't drawn, and the automatic quality on a phone now lowers the
  effects and then the resolution when frames are slow (it used to keep the full resolution on the Android phone).
- **Side areas and field moves** (roguelite track RL-R2, part 1): most runs now hide a side area. On the main path a
  thorny little tree, a cracked boulder or a boat at the shore blocks a road north. As in Pokémon, it opens for a
  Billie of the right type once you have that type's badge: **Cut** (Grass), **Rock Smash** (Ground) and **Surf**
  (Water, riding your Billie over the water). Tap it and the talk box asks "Would you like to use Cut?"; your Billie
  uses it and the obstacle goes with a burst of leaves, dust or ripples. A **detour** is 2-4 places (routes, a town and a
  leader of its own) with Billies the region doesn't have, and a one-way way out back to the main path. A rarer
  **alternate path** runs beside the main one with its own mini-boss, and now and then ends at a boss of its own.
  **Badges are kept for good**: the first win over a leader of a type keeps its badge, shown on the trainer card.
- **Caves, an islet and the way back** (roguelite track RL-R2, part 2): behind Rock Smash's boulder is now a real
  **cave**: rock walls all round, a rock and crystal floor, stalagmites, glowing crystals and mushrooms, dripping water
  and the cave song, dark enough that you carry a lantern (the dark eases in as you walk through the cave mouth).
  Surf's town is an **islet**: the sea all round, crossed by sandy causeways. Taking a side area's one-way way out now
  plays a short moment, Pokémon's way: the picture dips to dark with a few words ("Swept along by the current…") and
  you are back on the main path.
- **The Studio's Run Lab** shows a run's side area in a band above the main path, with its way in and its one-way way
  out, and says what it is; the run preview and the run simulator have it too (the simulator's `--badges=all` lets its
  bot open it). The map generator has a new **Islet** water.
- **No more deadline on a run**: the day still counts (the forecast, the shops' stock) but nothing is late. The day
  chip shows the day alone and the run songs lose their deadline version.
- Encounters on a run (roguelite track RL-12b, part 1):
  - **Events**: eighteen of them, in the new tone (a Bureau desk wanting Form 27-B, an unpaid intern guarding a Revive,
    a crate that says DO NOT OPEN: BEANS, a pay-to-wish fountain...). Each has two or three choices; some need a Billie
    of a type, an item, Moneys or a badge, and say so when you can't pick them. Outcomes give items, Moneys, Perks,
    battles, a move tutor, or a while of cheaper or dearer prices. For now they open from the debug menu; places that
    hold them come next.
  - **Route trainers**: one or two stand by every route's road. Walk into their line of sight and they spot you, walk
    up and battle. Beating one lets you **pick a reward**: one of three cards (items, pyramids, a Protein Bar, the
    Shining Stone, or a move tutor), with a reroll for Moneys that doubles each time.
  - The **Protein Bar**: a Billie that eats one gains a level (from its sheet, not in battle).
  - Versewift and Feedopus now evolve with the **Shining Stone** from level 20 (they evolved at level 36).
- **Waystations and stalls** on a run (roguelite track RL-12b, part 2): the run's map now has two new kinds of place.
  A **waystation** has a striped market tent by the road: tap it and its event opens (the events above now happen on
  the map, not just from the debug menu). A **stall** is a fruit stall with a shop (new stock every day, no clinic).
  Both have fewer wild Billies than a route. The map never puts two shops (a town or a stall) one after the other.

- Fix: the full test (Settings → Help) no longer fails three steps on every device while the game draws fine. Night,
  weather and seasons now waits for Copperleaf to open before it starts; the Light lab counts the new low-poly
  buildings; the opening's fall counts the frames the fall draws.
- New jokes in the lore, the loading tips and people's lines (reflavour track RF-5): the satire moves off money onto
  bureaucracy, tech and influencers. The Guide's lore tells where the Billies came from (Legacy Labs, "You, again, but
  forever": the billionaires' vanity clones, dropped down a sinkhole when they came out wrong) and why a pyramid
  catches them (every cloning vat was one). The Bureau of Lost, Found and Beans turns up in hints; nobody says what the
  Beans are. The cow is called Synergy now.
- Saves from before this change don't load (reflavour track RF-4, save format 5): the game's internal names moved off
  finance (Perks, Research, Crests, Pyramids, Expeditions, the item, status and ability names), so an older save is set
  aside and a new game starts. Nothing you see changes, except that a seed's run may offer different Perks (they are
  drawn in the data's order now) and its town shops may stock different wares.
- New interface icons: all 49 UI icons (the bottom bar, currencies, weather, the run's day chip and map markers,
  buttons) are redrawn as larger, full-colour pixel art: little blocks with a diagonal light split, in the game's
  own greens, golds and reds. They look the same on the light and dark themes.
- Fewer finance words (reflavour track RF-1): you **catch** Billies now ("Catch it", "Caught!", the Guide's Caught
  count), and nothing says "tax" except the title's "Gotta tax 'em all!". Run money is **Moneys** (1 Money), shown
  with a small gold coin instead of a $; Capital is **Research** (with a flask icon), Audit Seals are **Crests**,
  Loopholes are **Perks** and Brackets are **Expeditions** (Expedition I). The ten Perks have new names: Lucky Charm,
  Clinic Loyalty Card, Coupon Book, Steady Hand, Running Shoes, Power Gloves, Bubble Wrap, Trail Snacks, Field
  Notebook and Lost Property Form. A Billie that breaks free no longer offers you money to let it go: a miss is a miss.
- Every run is a small region (roguelite track RL-R1): its seed picks a theme (Lakeland, Greenbelt, Wildwood,
  Highland or Harvest Country; the last two need the Ridge or Autumn lands), names it ("Pendingvale", "Beta Basin",
  "Hotfix Hollow") and walks it in three zones, each one biome over two or three rows of the map, one leading into
  the next. A region has its own dex of four or five Billie lines (each as its normal look or its regional form, as
  the region leans), and its mini-bosses and boss are leaders of the types it leans to. The world map shows the
  region's name and each zone's own ground, and a place's card says which zone it is in.
- Type abilities (reflavour track RF-3): each type's ability has a name, shown in the Guide's species page under
  Abilities and in battle lines: Kindling (Fire), Undertow (Water), Regrowth (Grass), Live Wire (Electric), Bedrock
  (Ground), Slipstream (Flying), Wild Mind (Psychic), Alloy (Steel), Parting Roar (Dragon). Three are new: Water's
  Undertow (its Water moves hit 1.3× at a third of its HP or less; Water had none), Ground's Bedrock (once a battle a
  hit that would knock it out from full HP leaves it at 1 HP; sharp stones still don't hurt it) and Dragon's Parting
  Roar (when it faints, the next one in gets +1 Attack and +1 Sp. Atk, instead of the boosts it had). The rest work as
  before.
- Wild Billies by biome (roster track RO-1): every biome has its own wild pool of the seven Billie lines, met by
  rarity (the uncommon lines often, the starters' lines rarely, a line whose types suit the biome most), so a run
  meets real Billies everywhere instead of stand-ins. Four regional forms: Waterfront Gildlet (Water, by the lake),
  Cloud Facelet (Electric/Flying, on the ridge), Folklore Swiftlet (Grass/Psychic, in the autumn wood) and Festival
  Kontourlet (Psychic/Ground, in the canyon), each line with its own colours and its own evolutions. The Guide shows
  a line's regional forms on its page; catching one counts for that entry.
- Catching with pyramids (reflavour track RF-2): the four catch coins are now the Pyramid, the Step Pyramid, the
  Gold Pyramid and the Capstone (never fails, from badges), with new icons; the catch odds are the same. The throw is
  a small lit 3D pyramid that tumbles through the air, rights itself as it drops, lands point up, rocks on an edge
  once a wobble and seals with light climbing to its point; a critical catch lands balanced on its point. The throw
  has sounds now (the throw, a stone landing, the wobbles, the seal, the pop when a Billie breaks out). Billies are
  sent out of pyramids, and the professor throws three in the opening. The bag's pocket is Pyramids.
- Things to do is gone (test cleanup track): the daily challenges, the townsfolk's requests and letters, the gold
  stamps (and their tile on the Trainer card), photo mode and your room in Granny Juniper's cottage are removed;
  her cottage no longer opens. The weather still changes battles.
- The title screen shows Copperleaf for a new player too (the city at night is parked with the opening's city, kept
  for the story). The in-game full test walks Copperleaf and the rooms its doors and a run town's open, not rooms no
  door leads to any more; the diagnostics test walks the hub and its busiest room and one generated run road. The
  debug menu's Earn every badge and Reset trainer wins are gone.
- The debug menu, tidied (UI-7c): nine sections by task (Tests and performance, Give me, Billies, Battle, Run, Places
  and test scenes, Story, Ranch and time, Save), a search box at the top that filters the buttons, the sections you
  open remembered in this browser, and each button saying what it changed instead of "Done.". Gold buttons give you
  things, red ones erase or start a battle. Labels lost their phase codes. Walk 1 km, Earn every badge, Reset
  trainer wins, Lead +3 win streak and Age storage by a day are gone (nothing left to test with them).
- Sound effects and jingles (sound track SND-6): each Billie has a cry of its own, built from eight kinds (beast,
  bird, slime, machine, fish, insect, ghost, suit) with its own pitch and length per stage, and cries as it is sent
  out; a Billie under a quarter of its HP cries its low-HP cry (a quarter faster and a third down), and a fainting one
  too. Buttons make four sounds instead of one tick: select, confirm (a rising fifth), cancel (a falling one) and
  a buzz for one you can't press yet. A run has jingles for its beats: a tick and tock as each day passes, two pings
  when the map shows more, a jingle for a Loophole taken, a coin for each payout row (higher each row), then the
  victory tune and the title's theme on a win, or the victory tune backwards in a minor key on a loss. The water,
  wind and birds come down a little while a song plays. Every new cry, jingle and button sound is a draft, named
  "placeholder" in the Studio, whose Music & sound section has a Sounds tab for the base cries, the button sounds and
  the mix, and plays each jingle at its own tempo.
- A new professor: Professor Chosen runs the lab in Copperleaf. He finds you after the fall, hands out the starters,
  gives his (chosen) opinion of each and sends you to the airship; he is sure he is the main character and is wrong
  about most things, his type tips especially. Hazel stays as his assistant: she follows him out of the lab in the
  opening, corrects him, and has her own things to say at her desk in the lab. Name tags, the lab's sign, the Field
  Guide (recorded by Hazel, signed by the Chosen) and the lore follow. His look uses today's wardrobe; his wolf shirt
  and katana come later.
- Ranch income (RL-10b): the ranch earns Scrap by itself, 1 an hour at Lv 1 (2 at Lv 2, 3 at Lv 3), banking up to
  24 hours; the ranch's sheet shows the pile and how long until it is full, and Collect pays it. It counts from the
  first time you open the ranch, and works offline. Every ranch timer (training, eggs, income) now shares one clock:
  turning the device's clock back stops them until it catches up (the sheet says so), and turning it forward again
  no longer pays the gap to training. Signed in, the account's save carries the server's time, so a clock set ahead
  counts at the real pace. (Firebase rules: only publish the new saves rule once this version is live.)
- Settings in seven tabs (UI-7b): Sound, Display, Controls, Accessibility, Game, Save, Help, opening on the last one
  you used. Start over moved from beside Done to the foot of the Save tab, and now also ends a battle in progress.
  The Save card shows runs won and Billies taxed. Help has a Report a problem box (the full test and the debug log);
  the other tests, and the time, weather and season overrides, moved to the debug menu. Customize trainer left
  Settings (Edit look on the trainer card does it).
- Settings → Sound (UI-7a): the Test buttons are gone; letting go of a slider plays its sound once at the new level
  (the Music slider plays nothing while a song is on, as you hear it change). Each sound has its own mute button
  where Test was, which keeps its level; moving a muted slider unmutes it. The Volume row's mute is the same as the
  button beside the title, so the separate Sound on/off switch went.
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
- The run simulator plays by the game's own rules (Studio plan Phase 3, first part): the clinic, Potions, shop
  prices, how battles start and end, catching (a miss can now bring the foe's money offer, which the simulator
  refuses), and the payout all run the same code as the game. What the simulated player decides is one named bot
  policy, printed with every report, with a note that the numbers catch changes rather than judge balance. The core
  now lives with the game's logic so the Studio can run it later. The old species balance report
  (tools/balance-report.py) is gone.
- The run simulator now takes Loopholes (Studio plan Phase 3, second part): it picks one after a mini-boss and buys a
  town shop's, heals on walking in when a Loophole says so, and stocks a town's shop with only what the run has
  unlocked, as the game does. A second bot, never-pick, takes none, to compare against. A balance mode plays the
  same runs about 250 times faster by not building the places' scenery. Two simulation reports of the same seeds can
  be compared run by run, with 95% intervals.
- The Studio's Run Lab has a Simulate card: it plays up to 200 runs on the data as loaded and on your unsaved
  changes, side by side, and shows what changed (wins, where runs were lost, money in and out, Loopholes, leaders),
  each table marked as a bot's results rather than a prediction. The results can be saved as JSON.
- The Studio has pages for what a run is made of (Studio plan Phase 4), in the Runs group beside the Run Lab.
  **Loopholes**: each effect edited by its kind with the code's limits beside it, what a set of Loopholes does to a
  Billie's stats and to a run's prices and payouts, and the order they are offered in for a seed. **Unlocks & hub**:
  the unlock table as a graph by building, refusing a "needs" that would go round in a circle, and what a new save has
  after a few runs. **Economy**: every way each currency comes in and goes out, with a link to the number. Trainers
  shows what a run gives a mini-boss leader instead of its own reward and levels, and World & encounters which pools a
  run reads and which Billie stands in for a legacy one. Town shops and Jobs moved to the Legacy group. A Loophole
  factor outside the game's limits (x0.1 to x4) is now a data error.
- The Studio has a Run Lab (Studio plan Phase 2): type or roll a seed, or paste a debug log, and see that run's map
  as the game makes it, with your unsaved changes, and beside the data as loaded. Click a place for its type, biome,
  the day you reach it, its seed and its weather. Every run now starts the same way, from the mast, the test runs and
  the simulator alike, so the same seed and unlocks always make the same map. The test runs start as a new player's
  would: no ridge or autumn until those are unlocked.
  The Lab now also shows, from the game's own code on your unsaved data, a place's wild Billies, its mini-boss's team,
  a town's wares day by day and the Loophole picks; checks the map rules over 1,000 seeds and names a seed for each
  problem; edits the run rules beside the map; and opens the game on that seed (Play this seed) in a test run that is
  never saved, with your unsaved rules. A debug log taken on a run now names the run's own unlocks.
- The Studio can repack a Billie's sheet (Studio plan Phase 5): Repack sheet in Part mode drops the pixels no frame
  shows, and the Billie looks exactly the same. The Roster board has a Pixel density report: how many of each Billie's
  pixels go into a metre in the world against the props' and the ground's, and which kit parts were scaled more than
  their body. It only measures. No change in the game.
- Replacing a Billie's part from the Parts Library keeps the Billie whole (Studio plan Phase 5). The body parts
  hanging on the old part move to the new part's neck, shoulders, hips and tail (horns, ears and crests keep their
  place on a new head); a new head blinks (the blink is drawn again from it) unless you keep the old faces; a new
  torso squashes and stretches; the Billie's size in the world moves only by what the part changed. Parts a body part
  can't hang on are greyed out with the reason, and a strip shows the Billie before and after, front and back, with
  each face. The Studio's Check and CI now also check every Billie's skeleton (pictures inside their sheet, bones,
  front and back, size in the world). No change in the game.
- The Studio bakes kit Billies (Studio plan Phase 5). In the Art workbench's Part mode a kit Billie shows its recipe
  (which part on each bone, at what size and colour, and its extras); a change there bakes the Billie's sheet and
  skeleton at once with the game's own baker, as one undo step, and Propose sends them with the recipe. Write Billie
  bakes it again after a part's picture was repainted. The old Python builder is gone, and so are the kit Billies'
  piece layout files, which nothing used. No change in the game.
- The 24 kit Billies' recipes are game data now (Studio plan Phase 5): game/data/kitBuilds.json, which part sits on
  which bone at what size and colour, and the baker's settings, checked by `npm run check:data`. `npm run bake:kits`
  bakes them with the game's own code and writes only what changed; on today's data it changes nothing. The part
  kits use the game's slot words (sig, headExtra, bodyExtra). No change in the game.
- The Studio's Billie previews move the way the game moves them (Studio plan Phase 5): on the game's 12 frames a
  second, tails and hair lagging a frame behind, in the animated previews and in Parts' "As drawn". They used to
  play the plain 60 fps pose, so a Billie could look smoother in the Studio than in the game.
- The Studio's undo is lighter and more exact (Studio plan Phase 1). A step keeps only what the edit changed instead
  of a copy of the whole game data, so a long editing session no longer fills the memory, and undoing an edit puts
  back only what it changed. Opening the People section no longer changes the data by itself: it used to convert
  nine older people to the new look and fill in clothing colours every time, which then rode along with the next
  edit and made its undo take more back than it should (seen as an undo in Rules failing). Those nine people are now
  stored in the new look once (they look exactly the same), and a person without a look is a data error.
- The Studio's Check and the game data check in CI are one set of checks (Studio plan Phase 1). The Check now also
  checks the run rules, the ranch, robots, biomes, node types, Loopholes, currencies, buildings and unlocks, in the
  same words as CI; CI now also checks what only the Studio used to (scenes and roads, as notes). Propose changes
  refuses while the Check lists a problem, so a proposal can no longer fail CI on something the Studio didn't show;
  everything else is a note that never gets in the way. A typo in a Billie's name is a problem now, not a "legacy"
  note. CI runs the Studio's own checks on pull requests that change the Studio or the game's logic. The Studio's
  local mode (never in this repository) is gone from the docs and the tests.
- The Studio keeps what you haven't proposed yet in the browser (Studio plan Phase 1). Closing the tab, a crash or a
  phone dropping the page no longer loses work: the next time the Studio opens it offers the changes back (Restore,
  Later or Discard), at the commit they were made on, so nothing merged since is put back. Only the changed files and
  pictures are kept, never the sign-in.
- The Studio's Propose changes no longer loses work (Studio plan Phase 0). A failed proposal used to drop the
  pictures and rigs you had changed from the next try while showing them as saved; now nothing is marked saved until
  the pull request is open, a retry sends everything, and a proposal that can't be packed sends nothing. The Studio
  reads the game at the commit it opened on and proposes on that commit, so it can't quietly undo what was merged in
  the meantime: if main changed the same files, it names them and asks first. An expired sign-in opens the sign-in
  card over the Studio and sends the same changes afterwards. Branch names carry the second, so two proposals in a
  minute no longer clash, and a retry reuses the branch a failed try left.
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
- The blur looks like a diorama (CAM-3): the sharp zone can stand upright through where you are, so whatever stands
  there is sharp head to toe and the ground ahead and behind melts away, as in a tilt-shift photo of a model town.
  The sharp zone follows what the camera is about: you, the middle of you and who you talk to (for the whole talk),
  the spot of an encounter, a boss as it is revealed. Sharp things no longer leave a halo in the blur behind them, a
  blurred thing in front spills over what is behind it, and the edge between sharp and blurred is smooth. On the
  slowest graphics setting the blur is a cheap one instead of none. Settings > Graphics > Blur: Off, Low, Medium (the
  game's look) or Strong; Off costs nothing (it replaces the Expert "Depth of field" dial). The Studio: Engine > Lens
  dials for the tilt, an edge blur, a Miniature look (a little more colour, contrast and vignette) and how fast the
  focus moves; a Miniature preset; Blur guides (the sharp strip tinted on the ground) and a Blur heatmap on the
  preview.
- The camera frames what matters (CAM-2): while someone talks to you it frames you both and comes in closer; the swoop
  into a battle frames you and the spot and the battle comes up once the camera is there; the first time you come
  near a run's boss in a place the camera leans toward them; by a landmark, a shop, a clinic, the lab or the ranch it
  leans a little that way; standing still a few seconds it drifts slowly in, and running it eases out a little. One
  thing at a time, nothing new right after a sharp turn; with reduced motion the drift and the ease are off and the
  rest is gentler. Your own zoom is kept through all of it, battles included. Zoom now moves the tilt, distance and
  field of view together along curves. The Studio: dials for all of it in Engine > Camera, the points of interest and
  camera zones on the Camera guides, "Play moment" buttons, and a Camera zones tool in the Walk scenes editor (a
  rectangle or circle where the camera frames differently).
- The walking camera follows more smoothly (CAM-1): it trails you by the same amount at any frame rate, holds still
  while you move a little and catches up as you go further, and settles on you again when you stop. It looks ahead
  the way you push the joystick (or the way you walk when you tap), further sideways on a phone held upright. Looking
  up at a landmark, tilting indoors, rising ground ahead, a room framed whole and the swoop into a battle now blend
  in and out as one camera instead of each pulling on its own. The camera on tall ground behaves as before. The
  Studio's Engine preview has Camera guides: the zones drawn on the scene, dragged to resize.
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

# Vision: Pocket Billies, fresh base (0.1.0 alpha)

The game's name is to be changed (the owner, 2026-10-23; options in docs/phases/reflavour-track.md).

The single source of truth for what the game is becoming. Phase files implement it. Items marked (ASK) are not decided; offer options and wait for me.

## Fresh start
- New base. Version numbering restarts at 0.1.0 alpha. The old game is "legacy" (branch + tag + zip), kept only for reference and reuse.
- No save compatibility. Keep the strong parts (renderer, battle engine, Studio, Firebase and friends, debug tools) and rework the rest.

## Setting and story
- Still set in the Hollow Earth, but told as an alternative-future story.
- Opening (scripted, not player-controlled): a map-like scene of a cyberpunk city with tall neon buildings and flying cars. A silhouette walks along the street below. A strange portal opens. When the figure steps through, the game goes into the existing "falling through the air" sequence, then arrives in the Hollow Earth. (Phase 11.) Since RL-8 (the owner's choice for a faster first run) New game plays the fall alone; the city scene is kept in the data for the story to bring back.
- A shadowy, mysterious organization works in the background, in the spirit of the FBC from Control and the SCP Foundation (secretive, contains and studies the anomalous). It must be ORIGINAL: its own name, logo, terms and lore, with no copied names, text or terminology from either. It is the runs' villain team, a secret bureaucratic agency, and the bots are its army (the owner, 2026-10-23). (ASK: its name, reflavour-track.md 5.)
- Possible contrast to confirm (ASK): cyberpunk surface city above, retro-futuristic solarpunk Hollow Earth within.

## How the game plays
- A roguelite in the vein of Slay the Spire, Darkest Dungeon and Balatro that keeps the Pokémon-style world: you walk with a joystick, the maps join seamlessly, rooms open in place. The plan is docs/phases/roguelite-track.md (approved 2026-10-20).
- The hub is Copperleaf Town on the first island, on the walkable 3D bowl world map. Every other map is legacy: kept for the Studio, not loaded by the game.
- A run: the airship flies you from the hub to a branching node map, revealed as you go, 8 to 12 nodes, about 30 minutes. Nodes are short walkable routes and towns made by the map generator from the run's seed and joined seamlessly; events and shops are menus. Each node has a weather forecast that affects battles. One run clock (a day per node arrival, backtracking included) advances the forecast, hardens the world past a deadline and re-rolls shop stock. Mini-bosses along the way and a final boss; the first final boss is a "Voltron" of bots fought as an Alpha. Difficulty tiers and relics modify runs. Healing in towns costs money. A party of six.
- Billies in a run: tax wild ones, buy them in shops and events, or bring unlocked ones from the ranch.
- A run is a small Pokémon region (the owner, 2026-10-23; roguelite-track.md section 9): each seed makes a named region with 3-4 zones on a biome graph and its own regional dex, with leaders that match its types. Hidden side areas (an island, a cave, a grove) and rare alternate paths open with Surf, Dig and Cut: a Billie of the type plus that type's badge, and badges are kept between runs. Route trainers, events with choices (PokeRogue's mystery encounters) and a pick of 1 of 3 rewards after trainer battles.
- The run starts with starter points: every species you have caught can start a run, priced by strength, from a budget.
- The story reacts to your runs, as in Hades: hub characters pick lines from your run history, relationships unlock lines and small bonuses, Blake returns as a rival whose team counters yours, and each bracket is a chapter of the organization's mystery. After a loss Professor Chosen takes credit for bringing you back; Hazel finds the organization's portal did it.
- Losing a run: you keep one Billy of your choice and lose the rest with your money and items; money and items convert to unlock currency. Winning pays the unlock currency plus the rare boss currency and opens the next tier.
- The ranch, a hub building: stores Billies, trains them between runs (ranch-trained levels persist), hatches eggs and breeds (a safe mode and a risky mode with "abominations"), and earns passive income on real-time timers (capped, safe against clock rollback, working offline).
- Hub upgrades are paid with four currencies in all (run money, unlock currency, a building material, a rare boss currency), one per building.
- Bots (robots) are an enemy faction first and playable much later.
- Modular: nodes, relics, modifiers, currencies, factions, buildings, unlocks and bosses are data sections with schemas, so new systems and, later, content packs by others are added without editing core files.
- Online: friends' ghost teams (a friend's last run as a rival fight) and daily shared seeds. Nothing else.
- World map: always 3D, the inside of a half sphere, like a bowl. In the hub it shows the island; during a run it shows the run's node map with the forecast. (Phase 10, then RL-7.)
- The fitness step tracking stays REMOVED: real-world steps never drive the game.
- Locations and maps keep the retro-futuristic solarpunk vibe.

## Two kinds of creatures
- Billies (existing): the messed-up clones of billionaires, made by the billionaires' own vanity cloning projects gone wrong, treated like Pokémon: caught with capsules, raised, evolved, battled. They are the one finance-flavoured thing left (the owner, 2026-10-23; docs/phases/reflavour-track.md); the rest of the game is Pokémon-like, its satire aimed at bureaucracy, tech and influencers, RPG clichés and clone ethics. Slimmed roster, swappable parts, breeding and funny "abominations". (Phase 16.)
- Robots (new): inspired by Medabots, similar in role to Billies. The player builds their own from many parts. Each robot has a torso with head, a left arm, a right arm, legs and a gem that acts as its soul. They battle in the same system as Billies, on mixed teams; their own flavour comes from parts: moves come from parts and arms and legs can break in battle. Parts can be upgraded and are found, crafted or won in trainer battles. Bots are an enemy faction first (the roguelite track, RL-14) and playable much later. (Phase 17.) Use original names and designs.

## Presentation
- Portraits: only the eyes and mouth animate; the head may move a little. The old portrait system is replaced. 32-bit pixel art. (Phase 07.)
- Art targets: terrain textures and the airship style (low-poly, 32 px/m). Flat props stay flat. (Phase 09.)

## Keeps
Walking maps, seamless joins and rooms that are bigger on the inside than the outside (kept and improved), friends (ghost teams and daily seeds in the roguelite track, RL-15; trading later), the Studio (extended), Firebase accounts, the debug tools and my phone-testing workflow.

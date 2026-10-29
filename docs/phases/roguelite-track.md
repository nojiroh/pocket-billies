# Roguelite track (RL) - Pocket Billies as a run-based game

The owner's brief (2026-10-20) reworks the game from a classic RPG into a roguelite in the vein of Slay the Spire,
Darkest Dungeon and Balatro while keeping the Pokémon-style walkable world: a hub (Copperleaf Town), runs on a
branching node map of short walkable scenes reached by airship, mini-bosses and a "Voltron" bot final boss fought
as an Alpha, four currencies, relics, difficulty tiers, a ranch between runs, data-driven unlocks and content packs,
and later friend ghost teams and daily seeds. This file is the plan, approved by the owner on 2026-10-20 (session
RL-0, planning only; nothing was built). It is a track like the Studio and Map generator tracks: one session per
row of docs/ROADMAP.md's roguelite table, each in Plan Mode first, one cause per commit, the quick check tiers of
docs/TESTING.md after every change, a docs/HANDOFF.md entry and a tag `rl-N-done` at the end (tags are pushed from
the owner's machine; sessions can't push them). Every number and line below was read at HEAD e3df43a; verify again
before each session and correct this file where the code disagrees. **Section 9 (2026-10-23) restructures the track
after RL-12a around regions, encounters and a story director; its order wins over the first roadmap's.**
The first audit and roadmap (sections 0, 0b, 0c and 1) and 9.5's name options were removed on 2026-10-28 (git
history has them); what each session changed is in its HANDOFF entry (older ones in docs/archive/HANDOFF-2026-10.md).

## 2. Architecture decisions (recommendations; options are in section 8 where the owner decides)

**2a. Where run, meta and ranch state live.** One save, three sub-objects: `saveData.meta` (capital, scrap, seals,
unlocks, building levels, run counts, tier), `saveData.run` (null in the hub: seed, tier, mapgen version, the node
map, position `{node, phase, battle}`, clock, deadline, forecast, relics, the saved relic offer, modifiers, the
hub snapshot, uid counter, battle counter, choice log, released Billies, hints) and `saveData.ranch` (pens, trainees,
nursery, income). `team, se, items, coins, trip, wild, eggs, flags, seats, visited` stay the **working fields**: the
run's live state while `run` is set, the hub's otherwise; `runStart()` snapshots them into `run.start`, `runEnd()`
converts and restores. Every engine and UI read stays as it is. Scenes are never saved; they regenerate from the seed.
SAVE_VERSION 3 → 4 with no migration (old saves set aside, as CLAUDE.md allows). Saved at run start, every node
arrival, every purchase, event choice and battle end (`save(); flushSave()`). Resume: `migrate()` must stop resetting
the trip when `run` is set (`saves.js:146-148`), both `migrate` and `validSave` bound `trip.node` by the run map;
`runWorldInstall(saveData.run)` runs in `boot.js` before `loadMapsAhead`; a run whose `mapgenV` differs from
`MAPGEN_VERSION` is abandoned with a message. Rejected: three stored documents (triples the set-aside/cloud code),
and "seed + choice log replayed on load" (the online architecture, not the first cut; the choice log is still kept).

**2b. Battle state as an argument, in green commits.** A module-local current battle in the engine
(`useBattle(b)`, `B()`), entry points (`runTurn`, `enemyOnly`, `catchRoll`, `applyItem`, `doSwitch`, `chooseAI`,
`benchCandidates`, `teamNeedsHp`) take an optional last `b` and default to the hooks value, so the UI's 165 reads of
`activeBattle` are untouched. Steps: golden-record test first (RL-2); `logic/battle-state.js makeBattle` returning
exactly today's object, proven by a snapshot; `B()` everywhere in the engine; the engine stops writing `saveData`
(XP to `B().sides[0].team`, `seen` to `B().seen`, copied by `endBattle`); `extra.host` with hook defaults for headless
fights; `b.rng` behind one `roll()` for the 16 draws; a turn cap (`rules.battle.turnCap`, 40). Side 0's team stays
`saveData.team` by reference in ordinary play (the Team tab sees live HP); a ghost fight or a sim passes a copy.
Phase 19's effect-handler table and replay log come later (RL-12, RL-15), when relics and ghosts need them.

**2c. One seedable RNG.** `logic/rng.js` = `mapgenHashString` and `mapgenRandom` moved unchanged (`rngFrom(seed,
salt)` → `{next, range, int, chance, pick, gauss}`, `rngFn` for `() => number`, `hashString`), re-exported by mapgen so
Studio drafts hash the same. Only `run.seed` is stored (10 base32 chars rolled at run start; `'d' + UTC date` for a
daily; a friend's seed for a ghost). Derived streams: `nodeSeed(i) = run.seed + '|n' + i`; scene `hash(nodeSeed +
'|scene')`; wild `rngFrom(nodeSeed, 'wild|' + visits)`; shop and event `rngFrom(nodeSeed, 'shop|' + day)`; weather
`rngFrom(nodeSeed, 'weather|' + day)`; battle k `rngFrom(nodeSeed, 'battle' + k)` as `b.rng`; relic offers
`rngFrom(run.seed, 'relic|' + n)`. Counters live in `run`, so a resume continues the streams. Onto the stream: the
bribe (`battle.js:937`), the egg drop (`:999`), `hatchEgg`'s coat (`coatRoll` already takes `rnd`). Stays on
`Math.random`: particles, ambient life, sound, clouds, `tid`, hub-only rewards. `newUid` in a run becomes
`'r' + meta.runs + '-' + run.uidN`; weather in a run comes from `run.forecast` through `extra.wx`, never `Date`.
Proof: `tools/test/sim/run-sim.mjs` plays one seed twice and asserts equal maps, scene hashes, encounters, shops and
battle events (sample in `npm test`, full nightly). Rejected: seeding `util.random` itself (visuals would eat draws).

**2d. Modular feature registration.** A feature is a data section following the biomes pattern (file, `index.json`
key, schema, type, check-data block, `game-data.js` export), added when its session needs it: `nodeTypes` (RL-6),
`currencies`, `buildings`, `unlocks` (RL-11), `relics`, `events` (RL-12), `modifiers` (RL-13), `factions`, `bosses`
(RL-14). Code grows only **effect kinds** (`logic/effects.js`: `rule`, `stat`, `price`, `heal`, `money`, `catch`,
`clock`, `start`, `boss`, applied at named hooks: `battleStart`, `damage`, `catchOdds`, `shopPrice`, `heal`, `payout`,
`nodeArrive`; relics, brackets, badges, perks and building levels compile into `run.fx`) and two **node engines**
(`scene`: a walkable map; `menu`: a story script or shop sheet; new script commands `relic`, `wager`, `breed`).
`currencies.json` has four rows and check-data fails on a fifth. `unlocks.json` is one table with three doors (`cost`
on the board, `shop` at a building, `auto` by condition) and `requires` drawing it as a tree; new condition kinds
`unlock:` and `won:`. Content packs: `game/data/packs/<pack>/index.json` in the same `{keys, split}` format merged by
`PB_DATA.mergeInto` (build, Studio, fallback), ids prefixed `<pack>_`, duplicates a check-data error, text escaped on
output; no code in packs, no remote loader (RL-16). Rejected: a JS plugin registry (packs would ship code), a DSL.

**2e. The node map, clock, bowl, seamless world, airship.** (Built in RL-6, HANDOFF says how: `runMapMake(seed,
nodeTypes, rules.run.map)`, `runMapStart`, `runArrive`; the rows' roles are rules.json `run.map`'s, fillers are
nodeTypes.json weights; shops and their apart rule come with RL-12.) `run.map` from `logic/run-map.js runMapMake(seed, tier,
nodeTypes, rules.run)`: a layered DAG, row 0 the landing, rows 1..R-2 of one or two nodes (two lanes, a merge every
2-3 rows), the boss last; R = 9 (estimate) gives about 14 nodes with 9 walked. Row rules in `rules.run` (a town
before each mini-boss, mini-bosses near R/3 and 2R/3, no two shops adjacent). Reveal: on arrival at row r, row r+1
becomes `seen` with its type icon, row r+2 shows "?" pins. First node types: `landing`, `route`, `town` (clinic door
= paid heal, shop door, one event NPC), `miniboss`, `boss`; `event` and `shop` menu nodes later as tiny generated
waystation scenes whose hub prop opens the menu (one mechanism: every node is a location). **Seams decided by the
code:** every run scene 112×64; forward links leave by N and arrive by S at `t ∈ {0.25, 0.5, 0.75}` (28, 56, 84 m:
integer offsets, 56 m apart ≥ check-data's 44 m, bands 52 m wide after the composer's midpoint clip); MG-2 gives
`mapgenScene` a `params.edges` strip copied from the parent's edge and eased inward; scenes generate lazily one hop
ahead (136-451 ms each in Node). **Node indices:** `worldSetGraph(locations, roads)` (a move of the import-time
derivation in `game-data.js:288-358` into a function, RL-5) mutates the exported tables in place; the run's install
(RL-7) bumps `seamlessWorld.gen` and calls `worldBowlReset()` (game-data.js is logic and can't); the run table is
**Copperleaf at index 0 plus the run's nodes**, so `START_NODE` stays, the airship has an origin, and `trip.node = i +
1`. Run nodes are ordinary location rows (`id: 'run_<i>'`, `mapId`, kind, biome, pool, battleStage, bowl spot from row
and lane); run trainers are runtime `TRAINERS` entries removed at run end; scenes go into `gameData.maps` without
`_lite` (never fetched); friends see `place: 'On a run'`, node 0. **Clock:** `run.clock` counts days; entering any
node, forward or back, costs one day; the day drives (1) `run.forecast[i][day]` (seeded per node and day from the
climate odds moved into `logic/weather.js`; `environment.force.weather` on arrival; every battle gets `extra.wx`), (2)
`run.deadline = shortest path + slack (3)`, past which each day adds levels to foes and prices to shops through effect
rows, (3) shop and event rolls keyed by the day. The player sees "Day N · deadline day M" on the Map tab and walk HUD,
weather icons on seen pins, a red chip past the deadline. Backtracking costs one day and a smaller re-rolled wild
stock. **Bowl:** no change beyond the swapped tables; hidden nodes carry a gate the run's `canEnter` refuses.
**Airship:** `startAirshipFlight(1)` unchanged except a `free` flag; the landing scene places an `airship_station`
prop at its hub with `mapgenPutProp`, so `flyLand` works; a kill mid-flight resumes at the landing because `trip.node`
is set first.

**2f. Parking the legacy maps.** Move the 47 location maps with their locations, roads, trainers, shops, jobs,
fishing, regions, lore and postcards under `game/data/legacy/` with their own `legacy/index.json`, read by the Studio
as a read-only Legacy group with "Copy into game"; `index.json` keeps `copperleaf`, every `int_*`, every `test_*`,
`gallery`, `city_opening`. Parked locations leave `locations.json` (Copperleaf becomes index 0; the world-graph
snapshot is remade on purpose). The 8 badge leaders stay in `trainers/` with `miniboss: true`, handled by the
"waits on no location" branch next to `tutorial`. Copperleaf's south exit is removed (owner's call, 8.3). Retargeted:
`fixture.js:34-40`, the check-quick and self-test lines naming parked places, `story.json:38,66`. check-data validates
legacy maps against `map.schema.json` only. Rejected: a `world: 'legacy'` flag (13 MB and 47 map fetches would stay,
against "not loaded in the new flow") and deleting them (the Studio would lose them).

## 3. Design answers

- **Four currencies** (`currencies.json`; names are placeholders, 8.5): **$** (`se`, run; wild prizes, trainer
  rewards, bribes, events, releasing a run Billy → healing in towns, run shops, wagers; converts at run end).
  **Capital** (`meta.capital`, the unlock currency; payout = money at a rate + items at half price + released Billies +
  per node cleared + a win bonus, plus milestones → the Lab's board and shop-style unlock rows). **Scrap**
  (`meta.scrap`, the building material; bot salvage, scrapyard nodes, ranch income → Ranch and Workshop levels,
  breeding fees, part upgrades). **Audit Seals** (`meta.seals`, rare; 1 per final-boss win, 1 per first mini-boss kill
  per tier → the Airship: new areas and node types, the next tier's starting perk, a one-off second keep on a loss).
  One currency per building as decided: Lab = Capital, Ranch and Workshop = Scrap, Airship = Seals, town shops = $.
  The Platinum Coin is not reused.
- **Relics ("Loopholes"; data section `relics`, since `loophole` is an item id):** about 6-8 a run: a pick of 3 at
  each of 2 mini-bosses, 1 for $ in each shop, 0-1 from events; held cap 6 (8.14). Shown as three face-up rows (the
  `flyMenu` pickrow pattern); the offer is saved before it is shown.
- **Difficulty tiers:** "Expeditions" I-V in `modifiers.json`. **Built in RL-13 (2026-10-24), counted from I** (the
  owner): I changes nothing; each step above it is +2 foe levels, boss HP ×1.15 a step, +10% to run shop and clinic
  prices, and a zone or two more (RL-R1's `regions.json zones`). The deadline's slack is gone with the deadline
  (RL-R2a) and **nothing replaces it** (the owner). Winning the highest Expedition open opens the next
  (`run-state.js runEnd`, `logic/modifiers.js expeditionAfterWin`; the condition kind is `expedition >= n`, not
  `won:bracket_N`). The bot trainer from III waits for RL-14.
- **Battle formats:** by node type: routes single, town and mini-boss trainers double, the final boss an Alpha fought
  by three; a 40-turn cap on every battle (the sim saw 70-190-turn stalls). No engine change.
- **Keep-one vs ranch levels (owner's call, 8.2):** recommended: ranch Billies travel and return on a loss at the
  level they left with (the run's gains are lost); run-caught and bought Billies are lost except the one you choose,
  which keeps its gains (choosing a ranch Billy keeps its gains too); a per-tier cap on ranch Billies per run (1 at
  Bracket I) so most of the party is run-caught. Both sentences hold and a trained Billy is never wiped out.
- **Party of 6:** no box in a run; a seventh replaces one or is released into `run.released`, paid as Capital at the
  payout; more can be released on the payout screen. Wager stakes: an item or a run-caught Billy, never a ranch one.
- **Healing:** run towns' clinic charges `rules.run.healCost` (flat $60, estimate) per injured Billy; free only in
  the hub; items heal anywhere; `restCost` retired.
- **First final boss, a Voltron as an Alpha:** `bosses.json {id, fighter: {kind: 'robot', gem, torso, armL, armR,
  legs}, boss: {hp, st, levels}, phases: [{at, shield, stages, say, breaks}], join: '<cutscene>', rewards}`;
  `makeBossRobot(def)` = `makeRobot` + `m.boss`; `fmt: 'alpha'` gives boss HP, double actions, aimed hits, limb
  breaks unchanged; the four slots **are** the four bots (a leader torso, two arm-bots, a leg-bot), each a boss-rarity
  part with art in `robots.json`. One engine change: `alphaPhase` reads `m.boss.phases` from data (today's 50 % rule
  as the default) and a phase may break a limb ("a bot tears loose"). Visuals: a join cutscene (four rigs walk in, a
  flash, one rig at Alpha scale 1.6), broken limbs faint with the bot dropping. Several separate bots would widen the
  foe side: rejected for the first boss.
- **Mini-bosses as gym leaders with badges as relics:** accepted, changed: the 8 seat holders become the mini-boss
  pool ("Auditors"), rescaled by `trainerTeam`; a win offers the badge as a run relic and records the seat for
  `badges >= n` conditions; no node is gated by badges.
- **Pokédex as meta:** accepted as `unlocks.json` rows with `auto: 'caught >= 15'` or `billie:<line>`.
- **One unlock system:** one table, three doors (board, sold at a building, milestone), one `meta.unlocks` record,
  one screen with three looks.
- **Breeding (RL-10):** safe: two parents of one line, parts by rule from the parents' uids, coat by `coatRoll('egg')`,
  Scrap plus a real-time timer, the result shown before confirming. Risky: any two lines, half the Scrap, seeded:
  60 % as safe, 30 % a quirk (a passive and a parent move, a coat or size swing), 10 % an **abomination** (mixed S/L
  parts through `logic/parts.js`, a portmanteau name, a stat spike with a drawback passive, a "???" Index page). Good
  for: a unique passive, double Capital on release, wager bait, some relic conditions. The breeding sim reports before
  any bound is asserted. Hatchery node: after the ranch, as a `breed` event command.
- **Ranch passive income (RL-10):** `ranch.income = {rate, cap: 24 h, lastAt, bank}`; on opening, `gain = clamp(now −
  lastAt, 0, cap) × rate`; if `now < lastAt − 60 s` nothing pays and `lastAt` only moves forward; offline is the same
  computation from device time within the cap; signed in, the cloud save gains `t: serverTimestamp()` with a rule
  (`t == request.time` and a key whitelist on `saves/{uid}`, a behaviour change: 8.12) and `lastAt = max(lastAt, t)`
  on load. Emulator test for the rule; unit tests for cap, rollback, anchor.
- **A new player's first run:** the opening stays as built (city → fall → Hazel → starter → Blake); Hazel's last
  lines send you to the mast, replacing `story.json:38` and `:66`; the first run is normal with `hintOnce` toasts
  (first node, forecast, paid heal, relic, payout); no scripted three-node run (a `?story=firstrun` test preset instead).
- **Bots as an enemy faction first (RL-14):** `factions.json bots` with a wild pool of `'bot:<torso>'` entries built
  by `makeRobot`, bot trainers ("Collectors") at route nodes, a scrapyard node type, robots never taxable, salvage
  after a win (1 of 3 parts into `saveData.parts`, or Scrap), the Voltron. Kept possible for playable bots: the part
  library, `saveData.parts`, `buildRobot`, the Workshop as a hub building later.
- **Online (RL-15):** `logic/run-record.js` `{v, seed, tier, days, result, score, party ≤ 6 (sp, kind, gem, fit,
  lvl, moves, coat, nick), relics ≤ 6, path, name, hash}` under 8 KB, `validRunRecord` strict like `validSave`,
  `cleanName` on nicks. Firestore: `ghosts/{uid}` (owner writes with a key whitelist and sizes; friends read through
  the `users/{uid}.friends` pattern) and `daily/{date}_{uid}` (create-only, `uid == me()`); no listing. A ghost fight
  is the friend's party as an AI trainer at a `rival` node (no turn replay needed); a daily is the same seed for
  everyone with friends' scores on the payout screen. Rules check shape and size only.
- **Suggestions:** tax-bracket tiers accepted; loophole relics accepted (player word); part salvage accepted
  (RL-14); wager nodes accepted after relics as an event command; hatchery node changed to after the ranch; save at
  every node accepted as a requirement; scripted three-node first run rejected (hints instead).

## 4. Phases in detail

**RL-1 Hardening.** Goal: brief 2.6-2.8, PR #78 verified, RNG facts written down. Files: `studio/js/github.js:131,
137` (SECURITY A and B), the 16 version-stamped tools (delete, 8.11), `eslint.config.js:2-5`, `CLAUDE.md:30`,
`docs/SECURITY.md` (`cleanName` is `rules.js:210`; SAVE_VERSION 3), `game-state.js:106-113` + `account.js:304-310`
(one set-aside shape, one writer). Tests: `tools/test/rng-baseline.test.mjs` (`util.random === Math.random`; two
seeded battles identical); first run #78's unrun checks (`npm test`, typecheck, smoke) and fix or revert. Could break:
Studio sign-in (`check-studio-github.py`), the set-aside restore UI, check steps importing deleted tools. Verify:
tiers (a), (b), before-commit, smoke. 1 session. The owner pushes the outstanding tags.

**RL-2 Golden record and RNG module.** Files: new `tools/test/battle-golden.test.mjs` (single, double, alpha,
robot; a planted fault seen to fail), new `logic/rng.js` (one move commit, one rename commit; mapgen imports it
back), `logic/rules.js` (`pickWeighted(list, rnd)`, `spawn(…, rnd)`, `dailySeed(now)`), `game/index.html` +
`npm run modules`. Tests: `rng.test.mjs` (same seed same stream, salts independent, first five values frozen, the
UTC daily seed, a known mapgen scene hashes the same), `mapgen.test.mjs` unchanged. Could break: Studio drafts,
encounter spawning. Verify: (a), (b), smoke. 1 session.

**RL-3 State separation.** Files: `logic/saves.js` (SAVE_VERSION 4, `newSave` with `meta`, `run: null`, `ranch`;
`migrate`/`validSave` bounded by the run map, no trip reset while `run` is set), new `logic/run-state.js` (`newRun`,
`validRun`, the pure parts of `runStart`/`runEnd`, `payoutOf`), `logic/meta-state.js`, `logic/ranch-state.js`
(validator only), `game/types/save-data.d.ts`, the title's set-aside message. Tests: `saves.test.mjs` (a run-shaped
save keeps trip, plan, visited through `migrate` with a one-entry LOCATIONS; bad run shapes refused), new
`run-state.test.mjs`, `meta-state.test.mjs`. Could break: every save on the owner's phone and account is set aside
(intended, 8.12), cloud restore, backup import. Verify: (a), (b), check:data, smoke (Start-Game, save round trip,
debug log export). 1 session.

**RL-4 Battle state injected.** Files: new `logic/battle-state.js`, `logic/battle-engine.js`, `game-state.js`
(`setActiveBattle` calls `useBattle`), `battle.js endBattle` (copies `B().seen`; bribe and egg rolls onto `b.rng`),
`tools/test/sim/robot-sim.mjs` (silent host), `rules.json battle.turnCap`. Tests: `battle-state.test.mjs` (snapshot
equality incl. the `act` getters, copied team untouched, replay equality, headless `said` empty),
`battle-engine-state.test.mjs` (two battles in one process), turn-cap test; the golden record unchanged at every
commit. Could break: every battle, the opening's Blake battle, the full test's double and Alpha phases, the catch
flow. Verify: (a), (b), smoke, the full check's battle steps, `--selftest` battle phases. 1-2 sessions. HANDOFF says
Project Story S6 may proceed.

**RL-5 Legacy parking and the world setter.** Files: `game/data/maps/*` → `game/data/legacy/maps/` (one move commit),
`legacy/index.json`, `index.json`, `locations.json`, `roads.json`, `trainers/*` (8 leaders `miniboss: true`),
`shops.json`, jobs/fishing/regions/lore/postcards (one commit each), `maps/copperleaf.json` (south exit),
`story.json:38,66`, `game-data.js` (`worldSetGraph` move commit; the `miniboss` branch at 393-396),
`tools/check-data.mjs` (legacy schema-only; miniboss skip), `studio/js/check.js:223`, the Studio Legacy group,
`fixture.js:34-40`, `tools/check-quick.py` and `self-test.js` lines naming parked places, the world-graph snapshot
(remade on purpose, said in the commit). Tests: world-graph on the hub alone; new `world-graph-set.test.mjs`
(`worldSetGraph` rebuilds and restores exactly). Could break: Start-Game (`START_NODE` 0), the bowl with one place,
map look-ahead, the smoke phone flow, postcards. Verify: (a), (b), check:data, smoke, Studio check; full check and
`--selftest` at the end. 1-2 sessions.

**MG-2 Seam agreement.** Files: `logic/mapgen.js` (`params.edges` strip copy and inward easing; `mast`/`clinic`/
`shop` props at the hub by params), `studio/js/map-generate.js`. Tests: `mapgen.test.mjs` (a parent/child pair
passes `logic/seam-rules.js`, the check-data rules re-implemented once in Node, and a02_joins' numbers). Could
break: the Studio's Generate card. 1 session.

**RL-6 Run map and clock logic.** Files: new `logic/run-map.js` (`runMapMake`, `runReveal`, `runNext`, `runArrive`,
`runOverdue`, bowl spots), `logic/weather.js` (move of `CLIMATE_WEATHER_ODDS`; `weatherPick(climate, rnd)`),
`data/nodeTypes.json` + schema + type + check + export, `rules.json run`. Tests: `run-map.test.mjs` (same seed same
snapshot, every node reachable, 8-12 nodes on every path, row rules, reveal, backtrack ticks, forecast determinism,
deadline maths). Could break: nothing in the page. 1 session. Done 2026-10-21 (HANDOFF; the archived HANDOFF entry for what changed
from this paragraph): also `runMapRows`, `runMapStart`, `runBack`, `runExits`, `runSpot`, `runForecastFill`, biome
climates, the payout's distinct nodes; `run-map-real.test.mjs` and `weather.test.mjs`.

**RL-7 Run world.** Files: `game/index.html` (+ mapgen), new `run-world.js` (`runWorldInstall`/`runWorldRestore`,
lazy generation, run trainers, `seamlessWorld.gen++`, `worldBowlReset()`), `boot.js` (install before
`loadMapsAhead`), `world-bowl.js` (locked pins, day chip, forecast icons), `rules.js encounterStock` (`stock`),
`environment.js` (forced weather on arrival). Tests: `run-world.test.mjs` on real data (every run road's exits face
and align; restore leaves the hub tables as before). Could break: the walk view when tables change mid-session,
seamless caches, name-free debug log. Verify: (a), (b), smoke, a quick-check step on `?fixture=run` (install, open the
map, walk one seam). 1-2 sessions. Done 2026-10-21 in one session (HANDOFF; the archived HANDOFF entry for what changed from this
paragraph): `logic/run-scenes.js` and `game/js/run-world.js` (`runWorldSync`, all scenes at once), `worldPut` and
`worldHubBack`, the weather from the forecast, the bowl's run pins and day chip, a run place's wild stock; tested by
`run-scenes.test.mjs`, `run-world-real.test.mjs`, the `run` fixture, a fast-check page, a quick-check step and an
in-game test phase. Run trainers moved to RL-8.

**RL-8 Run loop and payout (first playable cut).** Files: `logic/battle-rewards.js` (move of `endBattle`'s arithmetic
first, with a fixture test that the numbers match), new `run.js` (start from the mast, arrival checkpoints,
`hintOnce`, abandon), `run-payout.js` (payout screen, keep-one picker), `airship.js` (`free`), `ui.js` (clinic cost in
run towns, the mast act), `shop.js` (seeded stock), `things-to-do.js` (`extra.wx`), `friends.js` (node 0 in a run),
`story.json` (Hazel's mast lines), `fixture.js` (`run`), `self-test.js` (phase "A run: airship, nodes, payout"),
`debug-menu.js` (start a seeded run). Tests: `run-state.test.mjs` (payout, release, keep-one, resume),
`battle-rewards.test.mjs`, `sim/run-sim.mjs` (replay equality; run-length statistics reported), a quick-check group on
the `run` fixture (mast → flight → node → battle → town heal → mini-boss → payout; reload mid-run resumes), the
smoke phone flow extended by the mast tap. Could break: Start-Game, the opening's end, the phone flow, the full
test's airship step, the debug log export. Verify: all tiers, `--selftest`, then the owner's phone. 2 sessions. Done 2026-10-21 in one session (HANDOFF;
the archived HANDOFF entry for what changed from this paragraph): `logic/battle-rewards.js`, `logic/run-loop.js`, `run.js`,
`run-payout.js`, the run's buildings, battles (seed, forecast weather, checkpoint and restart), towns (paid clinic, the
day's shop), mini-bosses and the Alpha boss, the payout and resume, `sim/run-sim.mjs`, the fall-only opening, hints, the
debug menu's runs; tested by `battle-rewards`, `run-loop` and `run-sim` tests, a fast-check page, a quick-check step and
an in-game test phase. The owner played it the same day (section 5's notes).
**Nothing below starts before the owner has played.**

**RL-9 Ranch A.** The ranch as a hub building (a barn room via `enterRoom`; `int_barn` exists; the walkable yard is
cut first if time is short), store and keep (the box behind it), train (Scrap + real time → levels through
`gainXp`, capped by building level, the rollback guard shared with income), the keep-one rule as decided. Files:
`logic/ranch.js`, `ranch.js`, `scenery.json` props, `buildings.json` stub, `self-test.js` (ranch step),
`check-quick.py` (edit-and-reload step, TESTING.md phase 12). Tests: `ranch.test.mjs`. Could break: team/box screens.
2 sessions. First half done 2026-10-22 (HANDOFF; the archived HANDOFF entry for what changed): the barn and its sheet (`ranch-screen.js`),
`logic/ranch.js`, `rules.ranch`, Scrap from the payout, the fixture, check-fast and in-game steps. RL-9b done
2026-10-22: the mast's pick of 1 home Billie and the packed bag (8.2), the storage trap in `runEnd`, the bag home on a
win, the sim's policy, check-fast's "Packing for a run".

**RL-10 Ranch B.** Breeding safe/risky with abominations, hatching on ranch time, passive income with cap, rollback
guard, offline, the cloud `t` anchor and its rule. Files: `logic/breeding.js`, `logic/ranch.js`, `logic/rules.js`
(eggs), `account.js:331-351`, `firebase/firestore.rules` + `firebase/test/rules.test.mjs`,
`tools/test/sim/breeding-sim.mjs` (reports only until bounds are agreed). Could break: cloud saves (publish the rule
after the emulator passes). 2 sessions. RL-10a done 2026-10-22 (HANDOFF; the archived HANDOFF entry for what changed): breeding,
hatching, `m.mut`, the old walking eggs retired, the sim. RL-10b done 2026-10-23 (HANDOFF): passive income, one ranch
clock with the rollback guard (training's fixed), offline, the cloud `t` anchor with a measured skew, the key whitelist
(8.12).

**RL-11 Hub upgrades, currencies, unlock board.** `currencies.json`, `buildings.json` (Lab, Ranch, Workshop, Airship),
`unlocks.json` with the three doors, `logic/unlocks.js` (`unlockReady`, buy, auto at payout and on load),
`conditions.js` (`unlock:`, `won:`), `hub.js` board screen, `copperleaf.json` building variants per level. Tests:
`unlocks.test.mjs`, `conditions.test.mjs`, check-data (a fifth currency fails, every grant exists). 1-2 sessions. Done
2026-10-22 in one session (HANDOFF; the archived HANDOFF entry for what changed from this paragraph): the three sections,
`logic/unlocks.js`, the conditions `unlock:`, `runs`, `wins`, `run.unlocks`, `lab-board.js` (the Lab tab, the ranch's
and the mast's upgrade rows, levels in labels), the `lab` fixture, check-fast's Lab step, the in-game phase.

**RL-12 Relics and effects.** `relics.json`, `events.json` (scripts with `relic`, `wager`), `logic/effects.js` (kinds,
hooks, `B().fx`; phase 19's handler idea), one hook call each in `calcDamage`, `catchOdds`, `newBattle`, the pick
sheet, the Bag's relic list, the waystation node engine. Tests: `effects.test.mjs` (each kind, stacking order, a run
with every relic stays finite), a golden battle with a relic, story checks on events. 1-2 sessions. RL-12a done 2026-10-22 (HANDOFF; the archived HANDOFF entry for what changed): `relics.json`
(ten Loopholes), `logic/effects.js`, `logic/relics.js`, the battle, shop, clinic, arrival and payout hooks, the
mini-boss pick and a shop's Loophole, the Loopholes tab (`relic-screen.js`). RL-12b: `events.json` with `relic` and
`wager`, the event and shop places (waystations, 8.6), the no-two-shops rule.

**RL-13 Modifiers, tiers, mini-boss leaders. Done 2026-10-24** (9.4 and the HANDOFF have it as built): `modifiers.json`
(Expeditions I-V and four challenges), the Expedition and challenge pick at the mast, starter points in place of
RL-9b's one Billie from home, and the leaders fielding their own type. No badge relics (9.6, 22: badges are kept in
`meta.badges` and a leader's prize is the pick of 3 Perks) and no overdue hardening (the deadline is gone, RL-R2a).

**RL-14 Bots as enemies, salvage, the Voltron.** `factions.json`, `bosses.json`, boss parts and art in `robots.json`,
`rules.js spawn` (`bot:` entries, never taxed), `battle-engine.js` (`alphaPhase` from data, `makeBossRobot`),
`battle-stage.js` (join intro, limb drop), the salvage sheet, `self-test.js` (a robot phase). Tests: `robots.test.mjs`
(boss build, phases, limb loss, never caught), robot-sim with boss builds, the golden snapshot extended. 2 sessions.

**RL-15 Online.** `logic/run-record.js`, `friends.js` (ghost source, `rival` node type), `daily.js`,
`firestore.rules` (`ghosts`, `daily`) + emulator tests (owner writes, friends read, size, key whitelist, no listing),
`account.js`. Tests: `run-record.test.mjs` (shape, size, hostile names, a deterministic ghost fight), a planted-name
check on the record. Could break: friend presence. Verify: rules job, smoke's debug-log privacy check. 2 sessions.

**RL-16 Content packs and Studio editors.** `data-files.js mergeInto`, `build-data.mjs`, `check-data.mjs`, the Studio's
pack filter, generic data editors for the new sections, `docs/CONTENT-PACKS.md`. Tests: `packs.test.mjs` (merge,
duplicate id refused). 1-2 sessions.

## 5. First playable cut (after RL-8)

As built in RL-8 (the owner's answers to 8.8, 8.9 and 8.20): New game plays the fall from the crust → Copperleaf
(Hazel, the dressing room, the coins, the starter) → Hazel's last lines point at the airship mast → the mast's "Start a
run (Bracket I)" (your team as a copy, $600, 5 Copper Coins, 2 Potions; storage stays home) → a free flight to the
landing, day 1, beside the landing's mast → the run's map (9 rows, 9-14 places, about 9 walked; the next row shown,
'?' after, the boss always) → wild battles one on one, each seeded and checkpointed → towns: a clinic at $60 a hurt
Billie and a shop with the day's stock → two mini-bosses (a leader copied to the row's level + 3, doubles, blocking the
way north) → the boss (a third leader's top Billie as an Alpha at + 5, fought by up to three) → win, or wipe → the
payout (Capital from money, items and released Billies; Seals on a win; on a loss pick one Billie to keep) →
Copperleaf by the mast, healed, Capital and Seals in the Map header. "Give up the run" in the Map tab, "Fly home" at the
landing's mast. Killing the app anywhere reopens there: at the place, mid-battle (the battle starts again from its
seed), mid-flight (on the landing) or at the payout.

Stubbed: relics, modifiers (Bracket I = no effects), event nodes, route trainers, bots (the boss fields a Billie, not
the Voltron), the ranch, the unlock board (Capital is a balance only), deadline hardening, the return flight's
animation, online, hub trainers. Balance is untuned: the run simulation (`tools/test/sim/run-sim.mjs`) loses every run
on the placeholders (HANDOFF RL-8).

**The owner's notes after the first play (2026-10-21), for the plan:**
- It got stuck: a run's landing couldn't be left (fixed in RL-8: bridges walkable over steep banks; bridges only where
  the road crosses a stream, square to it, dry at both ends).
- "The bridge was turned the wrong way" (the same fix).
- Rooms are too bright.
- Routes should be wider than they are long: it's an HD-2D diorama.
- Copperleaf's world map should be Copperleaf's island alone.
- A run gets its own world map, generated from its seed.
The last four are new work, waiting for the owner's choices (HANDOFF RL-8, "Next"). **Done in RL-8b (2026-10-22):**
rooms darker (ambient 0.5, was 1.75); routes were already wider than long (TR-2: 112 x 64 m, joined east and west);
the hub's map is Copperleaf's island alone (worldmap.json sea.island); a run gets its own map from its seed, laid
across the bowl east to west, with no hub on it (HANDOFF RL-8b).

## 6. Leave alone (no refactor without evidence)

The renderer (`engine/`, `walk/`, `walk-view.js`, `world-bowl.js`'s GPU half, `battle-stage.js`): the run reaches
them through tables and entry points they already read. `seamlessCompose` and the room composer. The giant functions
(`runFullTest`, `battleStagePlay`, `makeBuildingModel`, `setBuildGroundMesh`, ui.js's click handler): add steps, don't
split (06-5 is parked). `hooks.js`/`to-module.mjs`: the bridge stays; the UI keeps reading `activeBattle` from hooks.
Explicit battle parameters everywhere and id-based node identity: not without a second concurrent battle or two
worlds at once. `environment.js`'s real-clock day/night in the hub. The story layer and opening structure. `validSave`'s
strictness, the set-aside policy, the one-string cloud shape (only `t` is added). `innerHTML` + `escapeHtml` +
`cleanName` (new screens follow the rule; ghost names go through `cleanName`). Studio editors beyond a Legacy group,
a pack filter and the new sections' editors.

## 7. Risks and unknowns

**Verified facts:** everything in the first audit (sections 0-0c, removed) and the spot checks: `random` unseedable at runtime; the engine's
16 draws and three page-side outcome rolls; `mapgenRandom` pure and versioned; the engine shares `saveData.team` by
reference and writes XP and `seen`; weather enters battles only through `activeBattle.wx` and `environmentWeatherFor`
short-circuits on force/preferences and uses local time; `migrate` resets the trip at load; node indices are identity;
`LOCATIONS` is the raw array; `START_NODE` is a const; injected non-lite maps are never fetched; the seamless cache
keys on `gen`; `startAirshipFlight` sets `trip.node` first; the 44 m exit rule and 26 m bands; `check-quick.py` pins
`Date`; `CLIMATE_WEATHER_ODDS`/`WEATHER_TYPE_BOOSTS` live in browser files; mapgen is not loaded by the game page;
trainers already field robots; `loophole` is an item id; `fixture.js` names four parked places; `story.json:38,66`
point at Hedgerow and Marigold; no server timestamp is used; 13 rules tests; no phase tag on the remote; PR #78 is
unverified; no Node modules or Playwright here, so nothing in this plan was executed.

**Inferences and estimates:** phone cost of generating scenes (2-4× Node's 136-451 ms; lazy generation and the
ground-paint worker as fallback); MG-2's edge strip being enough for a02_joins on generated pairs; a 112×64 scene at
20-40 KB; battle length (an in-memory sim, not telemetry); 25-40 minutes per run and the deadline numbers; the bowl's
look with one hub place and a 14-node fan; `serverTimestamp()` from the compat SDK as loaded; where the clinic's heal
triggers (RL-8 finds it); run-map constraints yielding good maps (the sim and the first play decide); the ghost record
under 8 KB; every payout rate, cap and bracket number is a placeholder in `rules.run`; `tsc` may need the owner's
machine or CI (it crashed in the #78 container).

## 8. Ask me before (the owner's decisions; recommendation first)

Decided this session: the rework is a track RL-N (`rl-N-done`); parked phases are marked in the roadmap.

1. **Internal key for the run:** `run` as is (recommended; `storyRun`, `runBase`, `runTurn` are functions, no save-key
   clash) / `run` after renaming the story layer's `runBase/saveDuringRun/storyRun` / `voyage`. Player word "run".
2. **Keep-one vs ranch levels:** option 3 in section 3 (recommended) / ranch Billies never at risk with a per-tier cap /
   everything at risk, the ranch only trains. **Answered in RL-9: option 3 with 1 home Billie a run at Bracket I**, and
   a bag packed at the mast (a limited number of items) from Copperleaf's bag (RL-9b). **RL-9b:** 5 items and coins in
   all on top of the gift; the home Billie from the team or storage; on a win the run's bag goes home and is not paid,
   on a loss it is paid as Capital.
3. **Hub extent:** Copperleaf alone with the south exit removed (recommended) / Copperleaf + Hedgerow Lane as a practice
   route / the exit kept behind a fence (check-data needs a `closed` exit).
4. **Legacy parking:** move under `game/data/legacy/` with a read-only Studio group (recommended) / a `world: 'legacy'`
   flag (nothing moves; 13 MB and 47 map fetches stay).
5. **Currency names and buildings:** $ / Capital / Scrap / Audit Seals with Lab = Capital, Ranch and Workshop = Scrap,
   Airship = Seals (recommended) / Money/Capital/Scrap/Seal / $/Ledger/Copper/Bonds / the Platinum Coin reused (no).
   **Answered in RL-11: the recommendation** (currencies.json, buildings.json).
6. **Menu nodes on a walked map:** tiny generated waystation scenes whose hub prop opens the menu (recommended, from
   RL-12) / a gate prop at the previous seam / events and shops folded into towns (the first cut has only this).
   **Answered in RL-12: the waystation**, as a normal-sized place (every run scene is 112 x 64 m) with a stand by the
   road and fewer wild Billies; built in RL-12b.
7. **Mid-battle kill:** restart the battle at the node from the same seed and battle index (recommended for the first
   cut) / save the battle object every turn and resume it (phase 19's recommendation; later option).
8. **First-cut shape:** five nodes made, four walked, one branch (recommended) / four in a line / the full ~14-node map.
   **Answered in RL-8: the full map** (9 rows), with a 5-row short run in the debug menu.
9. **Battle formats and turn cap:** by node type with a 40-turn cap (recommended) / singles everywhere / cap 30.
   **Answered in RL-8: by node type** (wild single, a mini-boss a leader in doubles, the boss a leader's top Billie as
   an Alpha fought by up to three), the cap 40; a wipe or a trainer battle at the cap ends the run; keep 1 Billie on a
   loss, all on a win.
10. **Clock numbers:** a day per arrival including backtracking, deadline = shortest path + 3, no tick for healing or
    waiting until the first play (recommended) / + 5 / healing +1 and waiting +2. **Answered in RL-6: the
    recommendation** (rules.json `run.clock`).
11. **Hardening items that change behaviour:** SECURITY A and B, delete the 16 version-stamped tools (recommended) /
    move the tools to `tools/legacy/`.
12. **SAVE_VERSION 4** sets aside every current save on your phone and account; and the `saves/{uid}` key whitelist
    with `t` in RL-10 (recommended yes to both). **Answered in RL-10b: yes**, the rule published only after the build
    that sends `t` is live.
13. **`seen`/`caught`:** stay top level (recommended) / move to `meta.dex` now (14 reader files).
14. **Relic cap:** 6 held (recommended) / 8. **Answered in RL-12: 6** (rules.json `run.relics.cap`).
15. **Hub island look after parking:** only Copperleaf on the terrain (recommended) / parked places as bowl-only pins
    (both world-graph tests change on purpose). **Corrected in RL-8b:** "the sea share set in the Studio" couldn't make
    an island (the share stops at 0.8 and the land rose toward the rim); the island is `sea.island` (0.2, the owner's
    "medium"), sea all the way to the rim.
16. **Ranch cut order if RL-9/10 overrun:** server timestamp, then risky breeding, then the walkable yard (recommended).
    **RL-9:** the walkable yard and pens wait; the barn room stands in.
17. **Order after the first cut:** the brief's (ranch, hub upgrades, relics, modifiers, bots, online; recommended) /
    relics and currencies before the ranch.
18. **Tuning placeholders in `rules.run`:** rows 9, slack 3, healCost 60, the Capital rate, relic cap 6, turnCap 40,
    income cap 24 h, as starting values. **RL-6 took the map's:** 9 rows, 2 mini-bosses, two lanes on 70% of free
    and town rows, a lane switch on 25% of lane pairs, the five biomes with finished plants (meadow 3, lake 2, thicket
    2, ridge 1, autumn 1, each node its own); reveal the next row, '?' on the row after, the boss always.
19. **Tags:** push the outstanding `phase-*`, `st-*`, `mg-*` tags from your machine so CI's full run can fire on
    `rl-*`.
20. **Opening:** keep city → fall → Hazel/Blake and add Hazel's "the airship is waiting" lines (recommended) / shorten
    to the fall only for a faster first run. **Answered in RL-8: the fall only**, Blake cut from it (his data kept),
    Hazel's new lines send you to the mast.

## 9. Regions, encounters and story: the restructure (the owner, 2026-10-23)

A review of the track after RL-12a (planning only; nothing built). The owner's goal: a run should feel like a small
Pokémon region, with ideas taken from PokeRogue, and the story should react to your runs the way Hades does. This
section records the owner's answers, the new and changed sessions, and the new "Ask me before" items. Numbers below
were read at 2361848; verify again before each session.

**Words (2026-10-23, docs/phases/reflavour-track.md):** the owner moved the game off finance. Read Loopholes as
**Perks**, Brackets as **Expeditions**, Capital as **Research**, Audit Seals as **Crests**, $ as **Moneys** ("1 Money", RF-1); catching is
with pyramids. The organization is the Bureau of Lost, Found and Beans; the game is Pocket B&B² (the old 9.5's name options were superseded by
reflavour-track.md section 4).

### 9.1 Why runs feel the same today (verified at 2361848)

- **Wild Billies are the same 4 lines almost everywhere.** biomes.json points each biome at a legacy pool
  (`lake` → `willowmere`, `ridge` → `kitewind`, `autumn` → `russetwood`); those pools list parked species (`ek0`,
  `hughes0`, `woods1`...) that `standInSpecies` maps by hash onto the 4 uncommon lines. Only `grass` (meadow) and
  `shell` (thicket) list the 7 real lines.
- **Each place rolls its own biome** (rules.json `run.map.biomes`, 5 of the 11 biomes), so a run has no regional shape.
- **One shape:** 9 rows, 5 node types (`landing`, `route`, `town`, `miniboss`, `boss`); the mini-bosses are the 8 old
  leaders, whose teams are also mostly legacy ids.
- **No story inside a run:** the professor, Hazel and Blake speak in the opening and the hub only; nothing reads a
  run's history.
- **Roster:** 7 lines, 24 species, 121 moves, 9 types.
- **Balance:** the run sim loses every run on the placeholders (HANDOFF RL-8); content added before tuning hides this.

### 9.2 The owner's answers

| Topic | Answer |
|---|---|
| Run length | About 30 minutes at Bracket I; higher brackets add a zone or two |
| Biomes in a run | A **region**: each seed rolls a theme with 3-4 zones in order; each zone is one biome over 2-3 rows; zones follow a **biome graph** (each biome lists its likely next ones) |
| Run start | **Starter points from the first run**: the Billies at the ranch (team and storage) can start a run, each priced by strength, from a point budget (PokeRogue's budget, the owner's pool: 9.6, 24). Replaces RL-9b's "1 home Billie a run" pick |
| Reward picks | **After trainer battles** (route trainers, leaders, rival, boss): pick 1 of 3, a paid reroll. Wild battles pay money and catches only |
| Side areas | **Both**: small detours (an island, a cave or a grove: 1-2 routes, a town, its own species, trainers and boss, then back to the main path) on most runs, and rare **alternate paths** that replace part of the main path with a different mini-boss and possibly a different final boss. "It has to be a bit like he's in Pokémon" |
| Field moves | **Surf** (Water), **Dig / Rock Smash** (Ground), **Cut / Overgrowth** (Grass) first |
| Field move requirement | A Billie of the type **plus that type's badge** |
| Badges | **Carry over** between runs (meta): a field move opens for good once its badge is won |
| Why you return after losing | **Both**: Professor Chosen loudly takes credit for "saving" you; Hazel quietly finds the organization's portal is the real cause. Funny up front, eerie underneath |
| The organization | **The villain team of the runs, bots are its army**; the Voltron is its first big weapon. Claude drafts 3 name options (answered in 9.6) |
| Blake | **A rival in runs**: 1-2 times a run, his team built against your starter, growing over your runs, lines that remember past fights |
| Hub characters | **Lines and relationships** (Hades): they react to your run history; gifts or favours unlock lines, cosmetics or small run bonuses |
| Story arc | **One chapter per bracket** (five); each ends with its boss and reveals part of the mystery; hub lines fill in between |
| Roster | **About 40 species plus regional forms** (a coat and a type swap) |
| Challenge and endless modes | Challenges (mono-type, no healing...) in RL-13 as modifiers; endless mode after RL-15 |
| Writing | Claude drafts events and lines in the house tone; the owner edits and approves before they go in |
| Order | **Region → encounters → story**, then the rest |

### 9.3 Conflicts the answers create (recommendations; the owner decides, 9.6)

- **Kept badges vs badge Loopholes (section 3, RL-13).** A badge can't be both a permanent unlock and a run-only
  Loophole. Recommended: the first win against a leader of a type records the badge in `meta.badges` (permanent, opens
  that field move); the leader's prize in the run is the existing pick of 3 Loopholes. Section 3's "the badge as a run
  relic" is dropped.
- **Starter points vs RL-9b.** The mast's "pick 1 home Billie" screen becomes the starter-points screen; the packed bag
  stays. A ranch-trained Billie keeps its trained level on the run; its cost must account for that (9.6).
- **Kept badges vs runs only 2 leaders.** With 2 mini-bosses a run, the three field-move badges (Marina: Water,
  Rocco: Ground, Poppy: Grass) take several runs to collect. That is the intended unlock curve; the region picks its
  leaders from its types, so a coastal region tends to offer Marina.
- **Side areas vs the seam model.** A side area can't hang off a 112 x 64 scene's free sides without breaking the
  seam rules. Recommended: a side area is its own small branch of the run map, entered by a **field link** (a dock,
  a cave mouth, an overgrown arch: a prop with an act, like the airship's mast) that plays a short travel moment and
  puts you at the area's first place. Its places are ordinary run scenes joined by seams among themselves. It costs
  days on the clock like any place.
- **Biome art.** Only meadow, lake, thicket, ridge and autumn have finished plants. A region theme can only use
  finished biomes; a sea or cave side area needs its kit (a cove/beach scene from the island track's work, a cave
  scene type). Volcanic, frozen and jungle themes wait for their biomes' props (phase 09 / terrain track).

### 9.4 The new and changed sessions (order as the owner chose)

| # | Session | Goal | Depends on | Sessions |
|---|---|---|---|---|
| RO-1 | Roster: real pools and regional forms | every biome pool lists real lines (no stand-ins in runs); `forms` on lines (a coat and a type swap, a regional name); the run's wild pick reads the region's dex | none (alongside) | 1 |
| RL-R1 | Region generator | `regions.json` themes (zones, biome graph, type leanings, name parts); `runRegionMake(seed)` → name, zones, regional dex (15-25 species and forms), leader picks by type; `run.map` rows follow the zones; the bowl shows zone bands and the region's name | RO-1 | 1-2 |
| RL-R2 | Side areas and field moves | `run.map` side branches (detours on most runs, rare alternate paths with their own mini-boss/boss); field links (dock, cave mouth, overgrown arch) with a travel moment; `meta.badges`; Surf, Dig, Cut checks (type + badge); a cave scene type and a cove scene from the island kit | RL-R1 | 2 |
| RL-12b | Encounters (was "events and waystations") | `events.json` PokeRogue-style: 2-3 options with requirements (a type in the team, an item, money, a badge, a relationship) and outcomes as effect rows and script commands (`relic`, `wager`, `give`, `battle`); waystation places; **reward picks after trainer battles** (`rewards.json`: items, move tutors, candy levels, evolution items; a paid reroll); route trainers who battle on sight; the no-two-shops rule; first 15-20 events drafted by Claude, approved by the owner | RL-R1 | 2 |
| RL-S1 | Story director (**done 2026-10-25**, branch `track/story`; `banter.json`, not `lines.json`) | `meta.history` (the last 20 runs: seed, region, result, what beat you, team, Loopholes, leaders, rival result); `lines.json` (who, text, `when`, priority, `once`, cooldown, `must`) on the story layer's conditions plus new kinds (`last:`, `history:`, `rel:`, `chapter:`); `storyPick(who)` on each return to the hub; leaders and agents' in-run lines from the same table; the return-from-a-loss scene (Chosen's credit, Hazel's doubt) | RL-12b | 1-2 |
| RL-S2 | Rival and relationships | Blake as a `rival` node (shared with RL-15's ghost node): `rivalTeam(starter, history, row)` counters your starter and grows over runs; `meta.rel` per hub character, gifts and favours, what each level unlocks; Chapter 1's beats | RL-S1 | 1-2 |
| RL-13 | Expeditions, challenges, starter points (**done 2026-10-24**; HANDOFF has what changed and where this shape was wrong) | `modifiers.json` brackets I-V (as section 3), challenge modes as modifiers (mono-type, no healing, ...); **starter points**: species unlocked by catching, a cost per species and stage, a budget by bracket, the mast's pick reworked; the region's leaders as the mini-boss pool | RL-R2 | 1-2 |
| RL-14 | The organization's bots, salvage, the Voltron | as section 4, with the bots as the organization's army: its agents as trainers and events, the Voltron as Chapter 1's boss | RL-13, RL-S1 | 2 |
| RL-15 | Online | as section 4; the ghost node shares RL-S2's `rival` node | RL-14 | 2 |
| RL-16 | Content packs and Studio editors | as section 4, plus editors for `regions`, `events`, `rewards`, `lines` | RL-11 | 1-2 |
| RO-2.. | Roster: new lines | from 7 lines (24 species) to about 40 species, through the Studio's kit bake; one or two lines a session, art first | RO-1 | 4-6 |
| RL-E | Endless mode | after RL-15 | RL-15 | 1 |

About 14-19 sessions after RL-12a (was 8-10), plus the roster sessions alongside. The first roadmap (the old section 1) and the order in
section 4 stand for RL-1..RL-12a; from here the order is this table's. If the scope is too big: RO-1, RL-R1, RL-12b,
RL-S1, then play; side areas, the rival and relationships next; endless last.

**Each session's shape**, for its own Plan Mode:
- **The roster sessions (RO-1, RO-2..)** live on one branch. Branch: track/roster
- **RO-1** (done 2026-10-23; HANDOFF has what changed and where this shape was wrong). Files: `biomes.json` pools (one per biome, the 7 real lines by rarity), `pools.json` (legacy pools parked),
  `lines/*.json` `forms`, `game-data.js` (`standInSpecies` not used for a run), `logic/rules.js spawn`. Tests: every
  run pool resolves without a stand-in; a form's types and name. Could break: wild battles, the dex, the Studio's
  line editor.
- **RO-2.. plan (the owner, 2026-10-23).** 24 → 40 species, shaped like a small Pokémon dex (Gen 6's mix: the
  starters, about four 3-stage lines, about five 2-stage lines, a few singles), filling the archetypes every Pokémon
  generation repeats and the roster lacked. Art: kit parts only; an animal the kits can't make gets a kit stand-in
  marked placeholder (the owner's pick), not a legacy sheet. Parodies: a mix, legacy lines where a kit animal fits,
  new ones for the gaps. The 16 new species:
  - **RO-2a** (done 2026-10-23, HANDOFF): Hughes goose (Gosling → Sprucegoose → Aviatorgoose, early bird, common,
    Flying → Flying/Steel), Kamprad rat (Flatpackrat → Kamprat, early rodent, common, Steel → Steel/Grass), Cuban
    (Pupfin → Sharktank, the joke fish, common, Water → Water/Dragon), Altmowl (single, rare, Psychic/Electric).
  - **RO-2b** (done 2026-10-23, HANDOFF): Yiming ferret (Cliplet → Tiktokferret, the Electric mascot, common,
    Electric → Electric/Psychic, fox parts on a cat head), Woods tiger (Cublet → Tigerwoods, common, Ground →
    Ground/Grass, cat parts), Peacouture (the Arnault peacock, single, rare, Fire/Flying, bird parts, crown and a plume
    fan). Names and bios are drafts for the owner.
  - **RO-2c** (done 2026-10-24, HANDOFF): Huang gecko (Siliclet → Jenzard → Gigajenzard, the Dragon pseudo-legend,
    rare, Electric → Electric/Dragon, 20/40), regional forms for the five commons (Harbour, Meatball, Courtside,
    Livestream, Hazard), each with its own baked kit look because a coat's ramps cannot recolour a kit Billie's tinted
    sheet, and the balance pass: a line's own `totals` (Cuban 235/515, Yiming and Woods 265/470, Huang 300/420/560),
    earlier first evolutions (12-16) against the designed level curve, Alta's `woods1`. **The RO-2.. plan is done:
    40 species.**
  - Later, outside the 40: the critters kit (beetle, spider, snake, frog, crab, octopus) and the hooves kit (horse,
    deer, ox, goat, elephant, camel) open the lines the kits can't make; historic tycoons as legendary or boss
    Billies; an Eevee-style Billie whose evolution follows its parts.
  - How a line is added (RO-2a's recipe): copy its legacy sheets, layouts and rigs into
    `game/art/next/billionaires/hand` (rigs-hand.json) first; `lines/<id>.json` (learnset of existing moves of its
    types; cry drafts), `index.json` `lines`, a roster.json row, a kitBuilds.json recipe and colours, then
    `npm run bake:kits` (sheet, rig, native parts) and `node tools/check-data.mjs --fix`; drop the legacy
    `<name>.json` layouts from the sheets folder; the biome pools; then the counts in kit-bake-parity and
    pixel-density, the check-data and run-start snapshots, and `python3 tools/check-sound.py --baseline` for the new
    cries.
- **RO-3.. plan (the owner, 2026-10-26): every skeleton, placeholder sheets, about 58 species.** Branch: track/roster
  (sessions that can only push to their own branch work there and open a pull request into track/roster, the
  owner's word). Checked at bc106c41: all 40 species and the 11 form sheets are baked `biped` (kit-assemble.js writes
  `plan: 'biped'`), while body-plan-animation.js animates 14 plans (biped, quad, bird, flyer, fish, serpent, worm,
  octo, blob, insect, crab, hopper, plant, shell). The owner's decisions:
  - **Every plan is used** by the roster, whether or not a kit has parts for it.
  - **Art: new, very obvious placeholders** (flat shapes in the Billie's colours, a thick outline, a diagonal hatch,
    the part's name inside where it fits), **for every Billie**, kit art included: the kit recipes stay on disk,
    unused, so the kit look can come back.
  - **Sheets to draw on outside the game, both kinds:** one sheet per Billie (a column per drawn bone, a row per
    view) and one sheet per body plan (a column per bone, a row per Billie), magenta cells with a label strip and
    pivot ticks; export, draw in any tool, import, bake.
  - **Starters:** the muskox and goat lines move to quad; the otter stays biped.
  - **Splicing maps parts by slot across plans** (head, body, front, back, sig).
  - **Scope: everything**: the core lines, the cave bat, two legendaries and an Eevee-style line.
  - Research (Pokémon's recurring archetypes and its 14 body shapes): the roster had the starters, early bird,
    early rodent, Electric mascot, joke fish and pseudo-legend; it lacked the early bug, a fossil pair, an early
    Grass plant, a Water frog, a mythical, a cave bat, legendaries and a branching evolution. With 9 types, the Bug,
    Rock, Ghost, Normal, Fighting, Poison, Ice, Dark and Fairy niches can only be met by look.
  - **RO-3a** skeletons and the placeholder pipeline: `game/data/bodyPlans.json` (a template per plan whose bones are
    the ones the animation moves, with slots, draw order and shapes; `forms`, the placeholder recipes),
    `logic/placeholder-art.js` (paint, bake, both sheets and their cutting), `npm run bake:placeholders` (bake,
    export, import). Tests: every bone an animation names exists; a bake is the same twice; export then import gives
    the same pixels.
  - **RO-3b** (done 2026-10-26; HANDOFF has what changed) every existing Billie (40 and 11 forms) to placeholders on its plan: quad (muskox, goat, tiger, rat,
    ferret), bird (goose, Swift, owl, peacock), fish (Pupfin, Sharktank), worm (Trump slug), octo (Zuckerberg),
    biped (otter, chameleon, gecko). Remakes the quick-check baseline and kit counts on purpose.
  - **RO-3c** splicing by slot across plans (socket rules per plan pair, graft-art). Done 2026-10-26 (HANDOFF): the
    slot map works on the baked sheets and rigs, not per plan pair; the octopus and blob share one bone (`also`).
  - **RO-3d** Ortega silkworm (insect, then shell, then flyer; the early bug) and the Bloomberg plant (plant). Done
    2026-10-26 (HANDOFF): Threadling → Zaracoon → Ortegamoth (Grass → Grass/Steel → Grass/Flying, 7/10) and Tickerbud →
    Bloomburst → Terminalia (Grass → Grass → Grass/Psychic, 14/30), both common, dex 41-46, placeholders only.
  - **RO-3e** the Knight frog (hopper) and the fossil pair: Carnegie trilobite (crab), Vanderbilt rail snake
    (serpent). Done 2026-10-26 (HANDOFF): Swooshpole > Victoad (common, Water > Water/Flying, level 18), the fossils
    as two rare singles (Philanthrobite Steel/Water, Vanderbolt Fire/Ground, totals 490), `wild: false` lines given
    only by the Dig Site event's new `revive` command (`gift` on its branch, renamed in the merge: RL-S2 has a `gift`) (pick one of the two).
  - **RO-3f** Satoshi (blob, the mythical copycat) and the Hastings cave bat (flyer). Done 2026-10-26 (HANDOFF): the
    owner's picks: **Pseudonymph** (dex 51, Steel, mythical, one stage; **Fork**, a new move: takes the foe's types
    for 5 turns; met only as a route's rarer one, 2% of routes, once a run, at the rarer one's level; in no pool and
    no regional dex) and **Pilotbat → Bingebat** (52-53, common, Flying → Flying/Psychic at 18, Autoplay; cave 30,
    thicket 12, jungle 6). Two new rules: `battle.forkTurns` with the move's `fx.copyTypes`, and
    `run.wild.rare.myth`.
  - **RO-3g** legendaries Mansa Musa (quad) and Rockefeller (biped), the Eevee-style line, pools and a balance pass.
    **The owner (2026-10-26): the Swift line is the Eevee-style line** (in place of the draft "Pivotlet"): Swiftlet
    the base, branching into one era form per type (Erastar already "changes colour each era"); which eras, their
    types and how a branch is picked are asked in RO-3g. It changes the Swift line RO-3b moves to the bird plan, so
    RO-3g comes after RO-3b.
  - **What can run side by side** (each session on its own branch, merged into track/roster one at a time):
    RO-3b and RO-3c together (3c needs only 3a's slots, and tests on sample Billies); RO-3d, RO-3e and RO-3f together
    once 3b is merged (or beside it). They share files that are rebuilt rather than merged by hand: rigs-next.js and
    the baked sheets (`npm run bake:placeholders` again), the check-data and run-start snapshots, the sound
    baseline; roster.json rows, index.json lines, bodyPlans.json forms and biome pools merge by hand. Dex numbers
    given out ahead: RO-3d 41-46, RO-3e 47-50, RO-3f 51-53, RO-3g from 54. RO-3g last (it balances everything). The
    quick-check baseline: remade by RO-3b, then by whichever session merges after another one's art.
- **The region sessions (RL-R1, RL-R2)** live on one branch. Branch: track/regions
- **RL-R1** (done 2026-10-23; HANDOFF has what changed and where this shape was wrong). Files: new `game/data/regions.json` + schema, type, check, export; new `logic/run-region.js`;
  `logic/run-map.js` (rows from zones); `logic/run-bowl.js` (zone bands); the Map tab's header. Tests: same seed same
  region; zones follow the graph; every dex entry resolvable; leaders match the region's types. Could break: the run
  map's snapshot tests (remade on purpose), the run sim.
- **RL-R2.** Files: `logic/run-map.js` (branches), `logic/run-scenes.js` (cave and cove kinds), mapgen (field-link
  props), `run.js` (the travel moment), `meta-state.js` (`badges`), `rules.json run.side`. Tests: every side area
  reachable only through its link; the clock counts it; an alternate path still reaches a boss; a field link refused
  without the type or the badge. Could break: seams, the bowl's run layout, the in-game test's run phase.
- **RL-R2a as built (2026-10-23; HANDOFF has where this shape was wrong).** The owner's answers in Plan Mode: you walk
  in past the obstacle by a seam (not a travel moment both ways), the way out is one way to the main path's next row,
  a run gets a detour (60%) or an alternate path (15%) and never both, badges are kept by type, the moves' data is
  `fieldMoves.json`, and **the deadline is dropped** (the day clock stays for the forecast and the shops' stock;
  RL-13's "overdue hardening" goes with it). Files: new `logic/run-side.js` (runSideAdd after the main map, from its
  own streams), `run-map.js` (start, arrive, reveal, spot), `run-scenes.js` (the north exit, the obstacle and way-out
  props, Surf's ridden water, the gate on the first place), `run-loop.js` (the side's leader), `battle-rewards.js`
  (`meta.badges` on a leader's first win), new `game/js/field-moves.js` (Pokémon's talk box and a little burst on the
  map), `rules.js` canEnter and gateText, `conditions.js` `opened:<move>`. No cave or cove scene yet: the areas use the
  finished biomes (thicket for Cut, ridge for Rock Smash, lake with coast water for Surf); RL-R2b makes them.
- **RL-13 (Expeditions, challenges, starter points)** lives on its own branch (the owner, 2026-10-24). Branch: track/expeditions
- **RL-R2b as built (2026-10-24; HANDOFF has where this shape was wrong).** The owner's answers in Plan Mode: the
  cave uses the game's own cave darkness (`dark: 1`, the lantern), the islet joins Surf's chain by seams (riding in,
  no dock), the way out is a fade with the move's words, and the islet could move to an RL-R2c if it ran long (it
  didn't). No cave scene type was needed: a `cave` biome (biomes.json, pools.json, music.json; no region draws it)
  and fieldMoves.json `land` (the move's land dials: Rock Smash's mountains north and south, Surf's coast water, moved
  out of the code) and `townLand` (Surf's town: mapgen's new `islet` water). The islet is mapgen's, not the island
  generator's: logic/island-gen.js makes a whole free-sized island with no exits, props or seams, where mapgen's
  islet keeps the run's 112 x 64 frame and every seam rule. The way out: field-moves.js `fieldWayOutTravel`
  (fieldMoves.json `travel`). The Run Lab, the run preview, the run sim (`badges`, `simSideNext`) and the Studio
  check's Node start get the field moves. Not done: the world map's crowding at Expeditions III-V (the owner left it
  out), a picker in the Run Lab that forces a side area (likewise).
- **The encounter sessions (RL-12b's two parts, RL-12c)** live on one branch (the owner, 2026-10-23). Branch: track/encounters
- **RL-12b part 1** (done 2026-10-23; HANDOFF has what changed). Part 2 (after
  RL-R2 merges): the `event` and `stall` waystation node types and their stand, the no-two-shops rule in run-map.js,
  the run sim and preview, a check-fast page and the in-game test's step. RL-12c: held items (9.6 27).
- **RL-12c as built (2026-10-25).** Held items are items.json items with `hold` effect rows (not a file of their own:
  the bag carries them, taking one off puts it back, the payout counts them), eight placeholders. `Billy.held`
  (optional, no SAVE_VERSION change); logic/held.js (give, take, all off); logic/effects.js `fxOfBillie` (a Billie's
  own rows; where parts can join later) and three holder-only kinds, `xp`, `turnHeal`, `pinchHeal`. The battle reads
  them at calcDamage, makeBattle/doSwitch (stages), endTurn (heals), award (XP) and battleMoneyFx (money, holders
  standing). The owner's answers (2026-10-25): held items last one run (runEnd takes them off first: a loss pays them at
  the item share, a win takes them home in the bag), foes hold none (RL-14 may give leaders some), the eight
  placeholders stand. The reward pick's `held` card is on (weight 3) and asks who holds it.
- **RL-13 as built (2026-10-24).** `modifiers.json` + `logic/modifiers.js` (the Expedition's and challenges' effect
  rows, joined to the Perks' in `fxOfRun`; two new kinds, `level` and `bossHp`), `logic/starter-points.js` +
  `rules.json run.points` (`run.home` gone; the cost counts any levels above 5, since ranch levels are not tracked),
  the mast's Expedition and challenge rows, the four challenges at their own choke points (`perkPool`, `runClinic`,
  `runShopOpen`, `runCatchFits`, `runFragileDrop`), `runLeaderTeam` (leaders field their own type at last), and the
  run sim with `--expedition`, `--mods` and `--lvl`. The sim's first wins came from tuning three placeholders:
  budget 10 → [20, 22, 24, 26, 28], `foes.miniboss.up` 3 → 2, `foes.boss.up` 5 → 3 (the table is in the HANDOFF).
  No check-fast page yet.
- **RL-12b, RL-S1, RL-S2:** files and tests as their rows say; each adds a fast-check page and an in-game test
- **RL-12b part 2 as built (2026-10-24; HANDOFF has the detail).** Two node types: `event` ("Waystation", weight 2) and
  `stall` ("Stall", weight 1, `shop: true` like a town); route 4, town 1 (placeholders). `runMapNoTwoShops` redraws a
  shop led to from a shop. A waystation's stand is the market tent (act `event`, opens `encounterOpen` for the node);
  a stall is the fruit stall (act `stall`, opens the place's shop where you stand, no room); both are lots placed like
  the town buildings (mapgen `MAPGEN_HUB_BUILDINGS`). Both rows are `waystation: 1`: `rules.json run.wild.waystation`
  (2) wild Billies. The sim sells at a stall (no heal) and notes a waystation's event (the bot plays no option); the
  preview gives a stall's shop by day and each waystation's first-drawn event.
- **RL-12b, RL-S1, RL-S2, RL-13:** files and tests as their rows say; each adds a fast-check page and an in-game test
  step, as earlier RL sessions did.
- **The story sessions (RL-S1, RL-S2)** live on one branch (made from main 2026-10-25 at the owner's word).
  Branch: track/story
- **RL-S1 as built (2026-10-25; HANDOFF has the detail).** The table is **`banter.json`**, not `lines.json` (`lines`
  is the Billie evolution lines' section; the owner chose the name). `logic/run-history.js` (`meta.history`, the newest
  20; what beat you is caught in `battleSettle` as `run.lostTo`, the leaders beaten as `run.beat`; the entry is made in
  `runEnd`, so the sim records it too), condition kinds `last:`, `lastby:`, `history:`, `rematch` (**`rel:` and
  `chapter:` moved to RL-S2**, the owner: `rel:` reads RL-S2's `meta.rel`; `chapter:` would duplicate `expedition`
  until Chapter 1's beats say more), `logic/story-pick.js storyPick` and the script command `pick <who>`, the hub's
  fresh lines (replacing the first talk after a run, the owner's choice), story.json `scripts.back-lost`, and the
  leaders' and Bureau agents' words in runs. "Hazel's mast lines" (RL-8) never existed in the code.
- **RL-S2 as built, part A (2026-10-26; HANDOFF has the detail).** Where the row was wrong: a run has **no single
  starter** since RL-13 (several Billies on starter points), so Blake counters **the lead you take off with**
  (`run.rival.lead`), by type (`typeEffectiveness`), not by the opening's `rules.start.rival` table; Blake's opening
  battle (`blake0`) was already dormant since RL-8 and he is in no hub; **favours had no system** (no
  `things-to-do.js` on main); the hub has **three** people to relate to (Chosen, Hazel, Juniper); `chapter:` would
  have clashed with story.json's map-variant chapters, so it is a count, `chapter >= n`. Built, every number a
  placeholder (rules.json `run.rival`, `run.beans`, `run.payout.beansWin`, relations.json): the node type `rival`
  (`runMapRival`, a post-pass on its own streams after the side area, so no other draw moves), `logic/rival.js`
  (`rivalTeam`, `run.rival`, the history's `rival: {met, won}`, facts `last:rival`, `history:rivalmet` ...), Beans as
  currencies.json's fifth row, `logic/relations.js` (`meta.rel`, `meta.gifted`, `run.rel` read by `fxOfRun`, items
  at takeoff), conditions `rel:`, `beans`, `gifted:`, `chapter`, commands `beans`, `gift`, `rel`, `chapter`, the
  gift offered before a hub person's talk. Waiting on the owner (9.6-style asks in the session's plan): Blake's
  rules, the levels and what they bring, Beans' sources, Chapter 1's beats and every line. Part B: Chapter 1's beats
  and the favours, in the owner's words.
- **RL-S2 as built, part B (2026-10-26; HANDOFF has the detail).** The owner's answers: A Blake as built (the lead, 1/2/2/2/2
  meetings, 2 Billies +1 per 2 meetings, a loss ends the run); B level 1 a line, 3 a second bonus (Chosen +5% XP,
  Hazel a Hi-Potion, Juniper +10% catch), 4 a wardrobe piece, 5 a once-only line; C Beans as built plus 1 for Blake's
  first defeat in a run; D every drafted line approved. Where part A's notes were wrong: Blake's lose line never
  shows on a run (battle.js only shows it off a run: a `back_lost` pair says it); a chapter is not one an Expedition
  (only `chapter n` moves it); part A's six beats were never written down; and two found in the build: an `xp` row
  on a run did nothing (only held items' were read) and a `must` fresh line not talked to was lost for good (its
  `once` marked at the pick). Built: favours as relations.json data (`relFavoursPay` on the way home), `thanks_<who>`
  after a gift, conditions `lastteam:` and `rival`, Chapter 1's five beats and `scripts.chapter1-end` (for RL-14).

- **The bots sessions (RL-14a, RL-14b)** were meant for a branch of their own (`track/bots`); RL-14a was built on its
  session's branch, `ccr-15fdd30c-5nfh0d`, at the owner's word (2026-10-26). RL-14b was built on `track/bots`, made
  by the owner from main (2026-10-27).
  Branch: track/bots
- **RL-14 split (the owner, 2026-10-26).** RL-14a: the Bureau's bots, salvage, the scrapyard; RL-14b: the Voltron
  (`bosses.json`, `alphaPhase` from data, the join intro, the story scene last, beside RL-S2). The owner's answers: the
  build may start on the session branch; salvage is 2 parts + 1 Scrap stack (parts kept in `saveData.parts` for SP-5
  and the Workshop); the Voltron is Expedition I's boss only (leaders stay the boss from II up); wild bots yes, rare;
  the scrapyard built in RL-14a; the Voltron's four boss parts placeholders drawn by robot-art.js; phase 17's numbers
  kept, tuned by the sim, the gem's story role left open.
- **RL-14a as built (2026-10-26; HANDOFF has the detail).** `factions.json` (the Bureau: six bots, `wild` 10% from row
  3 in six biomes, `agents` the Bureau Clerk and a new Reclamation Agent with 1-2 bots, `scrapyard`, `salvage`),
  `logic/factions.js`; `rules.js spawnBot` (a wild bot is a wild entry with a robot's sp), `battle-engine.js
  startWildBot` and `catchable`; `encounters.js encClassFoe` fields an agent's bots from a stream of their own;
  `battle-rewards.js battleSalvage` and `rewards.js salvageOfferMake` (salvage in place of a reward pick, never
  rerolled; a part into `saveData.parts`, Scrap into `meta.scrap`); a `scrapyard` node type by its own `chance` (12%)
  from `fromRow` 3, not a weight (a weight moved every free node's draw), with its agents (`scrapyardAgents`) and set
  pieces by a scene `site` dial (setPieces.json `sites`, the Scrap heap); bots' cries (`cries.js cryOfBot`); a broken
  part drops off the battle stage. Where the plan was wrong: the robot prototype was already in main (not only on
  `archive/phase-17-robots`), robots have no head slot, `trainerTeam` already took robot entries, the Bureau's agents
  already existed (`bureau_clerk`, RL-S1), so "Collectors" are Bureau agents; wild bots are full builds, not
  `'bot:<torso>'`.
- **RL-14b as built (2026-10-27, on `track/bots`; HANDOFF has the detail).** The owner's answers: two phases (60%: a
  shield for 2 turns, +1 both attacks; 30%: an arm-bot tears loose, +1 Speed); the name **the Retrieval Unit**; the
  payout plus one of its boss parts on the first win only; Chapter 1's end on the first win only, while the chapter
  is 1; the join intro on the battle stage. Built: `bosses.json` (`fighter`, `bots`, `boss {hp, st, levels}`,
  `phases`, `call`, `join`, `glow`, `win`, `rewards.parts`, `story`, `chapter`; one boss an Expedition), four
  boss-rarity parts in `robots.json` (Intake Frame, Seizure Arm, Franking Cannon, Conveyor Treads; placeholders drawn
  by robot-art.js; never on an Escaped specimen, not in the robot sim's builds), `battle-engine.js makeBossRobot` and
  `bossPhase` (`alphaPhase` fires a boss's own phases once each, in order; without phases the old 50% rule, so every
  Billie Alpha is unchanged), `run-loop.js runBossFor` (runFoes: the boss node's foe on Expedition I, the leader still
  drawn so every other foe stays), `battle-rewards.js bossWin` (`meta.bosses`, the part) and `bossStoryNext`
  (`storyHomeArrive`'s `next`), the stage's `join` event. Where the plan was wrong: `alphaPhase` needed more than "one
  engine change" (a list of thresholds and a limb break), `startTrainer` builds the boss through `bossAlpha` (a
  Billie only), so the Voltron has its own path; the stage already drew a boss at 1.6. The first numbers (HP x3,
  stats x1.3) took Expedition I's wins from 62 to 4 of 200 in the sim; tuned to HP x2, stats x1.1 (62 -> 75 at level
  20, 18 -> 9 at level 15). Its four bots joining are drawn as its four parts flying in, not four walking rigs.

### 9.6 Ask me before (new; recommendation first)

21. **The organization's name:** answered 2026-10-23: the Bureau of Lost, Found and Beans.
Answered by the owner, 2026-10-23:

22. **Kept badges vs badge Loopholes:** **the recommendation**: the first win against a leader keeps its badge for
    good (`meta.badges`, opens its field move); every leader win offers a pick of 3 Perks.
23. **Starter points:** **the recommendation**: a budget of 10, costs 1-5 by rarity and stage, a ranch-trained Billie
    +1 per 5 trained levels (placeholders for the sim).
24. **Which Billies are startable:** **only the Billies at the ranch** (the team and storage), not every species ever
    caught. Catching matters by bringing a Billie home (won runs, the keep-one), not by a dex unlock.
25. **Side areas:** **the recommendation**: a detour on about 60% of runs, an alternate path on about 15%.
26. **A detour's size:** **2-4 places.**
27. **Reward pick contents:** **both**: items, move tutors, candy levels, evolution items, **and held items** (a new
    system: one held-item slot per Billie, PokeRogue-like). Held items need their own work (data section, the slot in
    the save and the Team tab, effect rows at the battle hooks): RL-12b grows to 2-3 sessions, or held items get their
    own session RL-12c after it.
28. **Route trainers:** **walk up on sight**, as in Pokémon (a '!' and they come to you).
29. **Relationship gifts:** **a new gift currency, Beans**, earned as **rare finds on runs** (1-3 a run: hidden spots,
    events, side areas, first boss wins; like Hades' Nectar). A fifth currency: `currencies.json` gets a fifth row
    and check-data's four-row rule becomes five (RL-S2). It ties to the Bureau's unexplained Beans (reflavour-track 4).
30. **Chapter 1's end:** **the Voltron**, the Bureau's first big retrieval unit, as the Alpha boss of Expedition I.
31. **Region names:** **made from parts, satirical** in the new tone (tech, bureaucracy, clichés: "Pendingvale",
    "Beta Basin").
32. **Where the lines live:** **a new `lines.json` data section** beside `story.json`.

### 9.7 Running sessions in parallel (the owner, 2026-10-23)

Split by the files a session owns, as docs/archive/tracks/test-cleanup-track.md does: each session is its own branch and PR
with its own HANDOFF entry. Every PR conflicts on `docs/HANDOFF.md`, `docs/ROADMAP.md`, the changelog,
`game/js/hooks.js` and often `rules.json`: merge one PR at a time and merge main into the next before merging it;
regenerate hooks.js with `npm run modules`, never by hand. One SAVE_VERSION bump per round.

- **Round 1: RO-1 + TC-1** (the owner: RL-16's pack merge and the art sessions wait). TC-1 is test-cleanup's deletions
  only (its lanes A-D, deletions only); TC-2..TC-4 (the rewrites, speed, the picture baseline) move to after RF-4, so
  they're done once with the new names. RO-1 owns `biomes.json` pools, `pools.json`, `lines/*.json`,
  `game-data.js standInSpecies`, `logic/rules.js spawn` and its own new test file; it doesn't edit the checks TC-1
  deletes.
- **Round 2: RF-1, RF-2, RF-3, RL-R1** at once. RF-1 owns player-facing text and the checks that read it; RF-2 the
  catch items' data, the throw's model and sound; RF-3 `types.json`, the passives' engine code and the golden record;
  RL-R1 `run-map.js`, the new `regions.json`, `run-bowl.js`.
- **Round 3: RF-4 alone** (renames touch nearly every file), then TC-2..TC-4 on the new names (test-cleanup's own
  lanes and rounds).
- **Round 4: RL-R2, RL-12b, RF-5** at once; RL-12b's waystation edits to the run map after RL-R2 merges; RL-12c (held
  items) after RL-12b.
- **Round 5: RL-S1 + RL-13** (both touch the run's start and end: merge one, then main into the other), RF-6 beside
  them if no save change is open; then **RL-S2 + RL-14** (the Voltron's story scene last).
- **Then:** RL-15, RL-E in order; RL-16 when the new sections exist. RO-2.. (art) beside any round but 3.

The Smosh note in project-story.md still holds for Professor Chosen before any public release.

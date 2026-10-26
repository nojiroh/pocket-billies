# Roguelite track (RL) - Pocket Billies as a run-based game

The owner's brief (2026-10-20) reworks the game from a classic RPG into a roguelite in the vein of Slay the Spire,
Darkest Dungeon and Balatro while keeping the Pokémon-style walkable world: a hub (Copperleaf Town), runs on a
branching node map of short walkable scenes reached by airship, mini-bosses and a "Voltron" bot final boss fought
as an Alpha, four currencies, relics, difficulty tiers, a ranch between runs, data-driven unlocks and content packs,
and later friend ghost teams and daily seeds. This file is the plan, approved by the owner on 2026-10-20 (session
RL-0, planning only; nothing was built). It is a track like the Studio and Map generator tracks: one session per
row of the table in section 1, each in Plan Mode first, one cause per commit, the quick check tiers of
docs/TESTING.md after every change, a docs/HANDOFF.md entry and a tag `rl-N-done` at the end (tags are pushed from
the owner's machine; sessions can't push them). Every number and line below was read at HEAD e3df43a; verify again
before each session and correct this file where the code disagrees. **Section 9 (2026-10-23) restructures the track
after RL-12a around regions, encounters and a story director; its order wins over section 1's.**

## 0. What the repo says today (verified at HEAD e3df43a, 2026-10-20)

**State of the repo.** Latest merges: PR #78 (Studio Billie part-library picker) and PR #77 (back-view rig and bot HP
fixes), both 2026-10-20. The #78 HANDOFF entry says its validation could not run (no Node suite, no browser), so it is
unverified work sitting on main. Before that: map generator MG-1 (routes only; towns MG-3 not built), Studio track
ST-6, Project Story S1-S3 and the city opening, world-map bowl done, phase 17 robots prototype "in progress, not
tagged", phase 16 prototype part 1, phase 12 ranch and phase 18 friends not started.

**Tags.** The remote holds no `phase-NN-done` tag at all, only `Baseline`; every HANDOFF since phase 03 says tag pushes
get HTTP 403 from these sessions. The `legacy` branch exists at 0314a22. So "never start a phase from an untagged state"
has not held for a while, and the CI full run "on phase-* tags" never fires. (The plan asks the owner to push tags.)

**Tools in this container.** No `node_modules`, no Python Playwright: `npm test`, lint, typecheck and the quick check
could not be run here. The audit's "263 tests pass" is now 279 per HANDOFF (52 files, ~280 `test(` calls).

**Corrected in RL-1 (2026-10-20, read and run at c2d51d6).** `npm ci` and `pip install -r tools/requirements-check.txt`
work in the container (the pinned `playwright==1.56.0` matches /opt/pw-browsers; the newest Playwright does not), so
every tier ran. 285 tests passed before RL-1 (290 after). PR #78 left `check:modules` and `format:check` red (fixed);
the smoke check's one red step was older than #78 (the world map's `mthing` shader, aCol on location 7, from phase
10; fixed). `CLAUDE.md:30` had already been corrected in RL-0. The "16 version-stamped tools" are **not** dead weight:
`build-scene-props.py` execs the five `scene_props_v*.py`, `build-props-a04.py` imports `build-buildings-v46.py`,
`build-terrain-v47.py` is the ground generator the game's painter mirrors, and 03-audit-notes lists most of the rest
as live generators; only a few are one-off migrations (owner's decision pending, HANDOFF RL-1). Direct `Math.random`
calls: 172, not 177.

**Corrected in RL-2 (2026-10-21).** `dailySeed` went into `logic/rng.js`, not rules.js (it is seed code; rules.js
has none). No old-name re-export from mapgen: only mapgen.js and its test called `mapgenHashString`/`mapgenRandom`, and
the hash is the same wherever it lives (`rng.test.mjs` freezes values taken before the move, a generated scene's hash
included). `rng-baseline.test.mjs` does not change in RL-2: `util.random` stays `Math.random` until RL-4's `b.rng`.
`game/index.html` did not load mapgen.js; both pages now load `rng.js` first among the logic modules. Battles at
equal-ish levels last 2-5 turns, so the golden record's seeds and levels were picked to include a crit, the Alpha's
shield and a robot part breaking. `spawn`'s species odds also pass through `environmentOdds` (the real-clock weather):
a run's spawn needs `extra.wx`-style weather from `run.forecast` too (RL-6/7).

**Corrected in RL-3 (2026-10-21).** The save already had a field `v: 4` (read nowhere, apart from `saveVersion`):
deleted first, so "format 4" means one thing. The trip reset is one line (`saves.js:146`), not 146-148. `rules.json`
had no `run` block: RL-3 adds `run.payout` (placeholders). The run does not store its own position (`run.at` holds the
phase and the battle only): `trip.node` is the position, one copy. `trip.node` in a run counts Copperleaf as 0 and map
node i as i + 1, as 2e says, so `run.path` holds map indices. The set-aside slot kept the *first* unloadable save, so
SAVE_VERSION 4 would have lost a format 3 save on a phone that already had one set aside: fixed (the latest wins).
The account's older save goes to `-cloud-set-aside`, which nothing reads (not fixed: one slot, two saves; owner's
call). Keep-one in `runEnd` follows option 3 of 8.2 by shape (travellers come back as they left, kept ones keep their
gains); how many are kept on a win or a loss is still the owner's call.

**Corrected in RL-4 (2026-10-21).** The engine read `activeBattle` 64 times (68 with the import and comments), not 56.
It drew chances in 18 places, not 16: two `pickWeighted` calls (the AI's weighted pick, the limb a hit lands on)
used the default `random`. "No save writes" covered items too (`applyItem` spent `saveData.items`, `award` read
`saveData.buddy` and the save's team). `B()` breaks the naming rule (no top-level name of one or two characters):
the engine reads `battleNow()`, and `withBattle(b, f)` plays a battle given to an entry point. `setActiveBattle` did
not need to call anything: `battleNow()` falls back to the page's `activeBattle`. `seen` is not copied by `endBattle`:
a battle on the save's own team (every battle the page starts) marks the save as before, a battle on a copied team
keeps `b.seen`, `b.bag`, `b.buddy`. `b.rng` is made by `makeBattle` from `b.seed` (`rngFn(seed, 'battle')`); with no
seed the engine still draws `util.random`, so ordinary play and the golden record are unchanged. Owner's answers:
turn cap 40, a draw (wild = walked away, trainer = loss) (8.9); a killed battle restarts from its seed (8.7, built in
RL-8); Lullaby's text fixed to 2-4 turns.

**Corrected in MG-2 (2026-10-21).** "Seams decided by the code" holds: run scenes 112×64, forward links N to S at t
0.25/0.5/0.75 join with whole-metre offsets, and a child generated from its parent's strip (`mapgenEdgeStrip` into
`params.edges`) meets it with no height gap or step and a straight walk across (docs/phases/mapgen-track.md, MG-2). Two
things the plan didn't say: terraces must stay at ground level by every exit's edge, not only joined ones (a parent is
made before its children), and a node with two parents shares its south side at the midpoint between the exits.
`logic/seam-rules.js` is check-data's seam rules moved into one module (check-data is already Node), not a
re-implementation; a02_joins compares views, so on raw data the numbers are heights, step and the walk. The hub's
buildings for RL-8's towns are the props dials `mast`, `clinic`, `shop` (a lot beside the main road facing the camera,
level, with a path to the door). The terrain track's TR-1 (smooth roads) was folded in by the owner.
**Corrected in RL-5 (2026-10-21).** 48 places and 48 maps were parked, not 47 (49 locations, Copperleaf index 46,
now 0); 39 trainers moved, 10 stayed (the 8 leaders, now `miniboss: true` with no `node`, and the tutorials blake0
and tinker). Trainers name their place by a numeric `node`, so a leader without one needed the `miniboss` branch in
`worldSetGraph`, the schema (`node` only for a trainer that stands somewhere) and both checks (check-data and the
Studio's; neither exempted tutorials: they passed because node 0 existed). More of story.json named parked things
than lines 38 and 66: 47 (Fizzwell), 48-49 (`beat:chad`, `!beat:chad2`, Clovercrest), 67 (Tallgrass), and the
`before-cass` preset (moved to legacy); Copperleaf's own signpost, a townsfolk line and one of Granny Juniper's
pointed at Marigold too (cut, the owner's answer). A place with no exits opened as its plain map, where no room
opens in place (`roomLayIn` needs a hub view's parts): Pearlantis had that bug, and Copperleaf would have; fixed in
`seamlessRoamView`. `worldSetGraph` is pure (game-data.js is logic): it does **not** bump `seamlessWorld.gen` or call
`worldBowlReset()` (2e said so); RL-7's install does that, and must also reset what holds a node or a place:
`worldBowl.sel`/`marks`, `uiState.mapSel`, `airshipFlight.a/b`, the walk view's composite (a `gen` bump with the same
view id keeps it), `watchMapsAhead`'s cached node, things-to-do's node keys (`saveData.x` is not a run field),
`mapIdAt`'s fallback to the first map (Copperleaf, listed first since RL-5), and `walk-view.js mapMoodName`, which
reads `gameData.locations` (the hub's; shared with the Studio, so a run scene should carry its own `mood`). Hub
trainers attach by node number in whatever world is in (none stand anywhere after RL-5; a run puts its trainers in
`TRAINERS` first). A world without roads now has none (an empty list made up a chain). check-data's seam offset
rule rejects only an offset of exactly x.5 m (now `logic/seam-rules.js:122`, moved there by MG-2): a small fix for later.
`gamedata.js` was 0.76 MB (lite maps), not 13 MB (CLAUDE.md's gotcha is stale): 0.59 MB after; game/data/maps 7.3 MB
-> 0.8 MB. Kept, against this plan: fishing.json (keyed by water, not place; Copperleaf has water) and the postcard
pictures (loaded only on arrival). Left dead in the data: `rules.json legends[].scene` (cinderpeak, frostcrown),
`scenery.json` flags (parked towns), `biomes.json from`, the parked places' pools.
**Corrected in RL-6 (2026-10-21).** The climate odds can't make a forecast alone: no place, map or biome had a climate
(`environmentClimate` guesses one from a scene's fields, and a node's weather is needed before its scene exists), so
biomes.json rows got `climate` (today's guess for each biome's generated scene, default dials; a map with coast water
guesses coast whatever its biome, so RL-7 writes `scene.climate` from the biome). `weatherPick(climate, rnd)` became
`weatherPick(climate, roll, season)`: the page's pick changes the mild odds by season first; environment.js is on the
Studio page too, so logic/weather.js loads on both. `runMapMake` takes no tier (RL-13: an Expedition changes the foes and the prices, and its region's zones the rows, not the map's shape).
The seam rules cap a node at two links each way (two exits a side, 44 m apart: t 0.5, or 0.25 and 0.75). On the bowl
every map's north faces the centre, so a run's rows go from the rim (r 0.94) towards it (0.12), on the south side;
the hub's 30-degree seam rule holds for straight links and splits, not for a lane switch (45 is tested; 34 seen on the
game's rules). `runEnd` paid per node cleared from the path's length, which counts backtracks: now distinct nodes.
`forecast[node][day]` is `forecast[world node][day - 1]`; the node seed uses the map's numbering. "About 14 nodes"
needs two lanes on almost every free or town row: with the 70% chosen, a map has 12.5 on average (9 to 14), and towns
are 4.4 of them (the two rows before the mini-boss rows, plus a filler at weight 1 of 5).
**Corrected in RL-7 (2026-10-21).** A scene takes about 30 ms to make in Node, not 136-451 ms (MG-1's numbers, before
MG-2); a run's 12-14 took 0.4-0.9 s in headless Chromium, so a run's world makes all its scenes when it goes in,
not "lazily one hop ahead" (which can't work per node anyway: a child is made from every parent's edge, so the order
is row by row). 501 scenes of 40 runs with the scene dials varied all joined with no gap and a straight walk, all
reachable. The world follows the save, not boot alone: the save is swapped in many places (New game, an account or
backup restore, the debug menu, the in-game test), so `setSaveData` calls `runWorldSync` once boot has (RL-8's run
start calls it too). `runArrive` took where you stand from `run.path`; `trip.node` is the one copy (RL-3), so it reads
that. `migrate`/`validSave` bounded a hub save by the installed world's places: the hub's own now (`HUB_LOCATIONS`).
Not in 2e: a crossing counts `run.seamIn` (6) metres in, so a step over a seam and back costs no day; a run place's
pool is its own (its biome's species at its row's levels: the source places' pools carry old levels, Russetwood
41-45); biomes.json rows got `pool`, `battleStage`, `mood`. 2a's "a run made by another generator version is
abandoned" became "kept" (the owner's J: the map and position don't depend on the generator). The walked view copies
a scene's `climate` (LOOK_KEYS). Things that would misfire on run nodes were kept to the hub: postcards, things-to-do's
visits and requests, friends' presence (node 0, "a run"). Run trainers, the landing's mast and towns' clinic and shop
moved to RL-8 with their behaviour; RL-7's scenes are plain routes. A place's landmark picture on the bowl draws as a
red block in headless Chromium, Copperleaf's in the hub too (not RL-7's; HANDOFF).

**Corrected in RL-8 (2026-10-21).** No battle had a seed and `extra.wx` didn't exist; battle weather already
followed the forecast (RL-7) except sunny and night (the real hour); a run's battles now take the forecast alone (clear
counts as sunny). Run towns offered a free clinic on the place card, and no run scene had a mast, clinic or shop
building (mapgen's MG-2 dials make them, by node type). "You hurried back to the clinic" healed where you stood. The
in-game test had no airship step (a04's model check was the only one). The debug menu's "Go there" skipped the run's
arrival. Leaks the plan didn't list: storage (`box`) isn't a run field, so a 7th catch or a move to or from storage
leaked Billies into Copperleaf (storage is closed on a run; a 7th catch waits until one is released, as `validSave`
refuses a team of 7); today's challenges kept counting and paid into the run's money; releasing a Billie from
Copperleaf would have been paid though it comes home; moves waiting to be learned are kept by Billie id (cleared at a
run's start and end). The account upload runs about 5 s after a save, so a checkpoint is uploaded at once (`saveNow`).
No trainer stood anywhere; the leaders have `blocks: false` and scripts that fight the real leader (badge included),
so a run copies them with ids of its own and no script, badge, egg or story conditions. The wild odds followed the real
hour and new ids came from the clock (a run wasn't reproducible from its seed): both now come from the run. Section 5
put Capital "in the Lab": the Lab's board is RL-11, so Capital shows in the Map header. `pb-payout` has one total and
no Seals line, and there is no keep-one component: the payout lays out `pb-pick-card`s. The owner's answers: the full
9-row map (8.8; the debug menu has a 5-row short run), formats by node type with an Alpha boss and the 40-turn cap
(8.9), and the opening is the fall only (8.20). The owner's play found a trap RL-7 had left: a run's bridges couldn't be
walked where a stream's banks are steep (walk/heights.js blocked the steep ground under the deck), and mapgen laid a
bridge along a stream where the road ran beside it, often ending in the water; both fixed (MAPGEN_VERSION 4).

**Corrected in RL-9 (2026-10-22).** Copperleaf had no barn and no live map used `int_barn` (no acts in it); the barn's
opening hours (`OPEN_HOURS.barn`) would have closed the ranch at night; `meta.scrap` and `meta.buildings` were never
used; storage is the Team tab, not a building. The ranch is a barn by Copperleaf's farm patch (act `ranch`) into
`int_barn`, with a training board; training is `logic/ranch.js` with `rules.ranch` (placeholders); Scrap comes from the
payout (`scrapNode`, `scrapWin`). No `buildings.json` stub (RL-11). The owner's answers: 8.2, 1 home Billie a run at
Bracket I, and a bag packed at the mast from Copperleaf's bag, which keeps everything gathered (RL-9b builds both); the
ranch's sheet shows storage and the Team tab keeps it. Rooms were made a little smaller at the owner's word (12 x 10
and 16 x 11 m). A `runEnd` trap for RL-9b: a kept Billie that travelled from storage isn't in the restored team and
would be pushed in twice.

**Corrected in RL-9b (2026-10-22).** Before RL-9b the whole hub team travelled and the run's bag was only the rules'
gift. The trap above was real and had two more faces: `runReleasePays` and the payout's cards called a Billie "from
Copperleaf" by `run.start.team`, so one from storage would have been paid as caught on the run if released; and
`saveData.buddy` was not a run field, so with one traveller the hub's buddy wasn't on the run. Built: `rules.run.home`
[1] and `run.pack` [5] by Bracket; `runBegin` takes `home` (uids from the team or storage) and `pack` (taken from the
hub's bag, so `run.start` keeps what stays home); `run.home`, `run.pack`, the buddy a run field; `runEnd` puts a kept
Billie back where it lives (team or storage) and, on a win, the run's items and coins into the hub's bag, which then
pay no Capital. The owner's answers: items and coins pack, 5 in all, on top of the gift; a win's bag goes home unpaid;
the pick from the team or storage (a trainee stops, healed); the run fixture follows the rule (its lead alone). The
sim (`--team`, `--pack`): one Lv 5 starter loses on the landing in 31 of 50 runs, as on main; packing 5 Potions
changes little (balance is for the owner's play).

**Corrected in RL-10a (2026-10-22).** RL-10 split in two at the owner's word: RL-10a breeding and hatching, RL-10b
passive income and the cloud `t` anchor. Where section 3 and RL-10 were wrong: eggs hatched by metres walked
(`addWalked`), not by time, and nothing gave eggs any more on the hub's terms; `eggs.json` lists legacy species
(played by stand-ins, `standInSpecies`); no Billie has a passive of its own (only types do), so a quirk's or an
abomination's "passive" waits for RL-12's effects; an abomination can't look mixed (the art is built per species
offline; `logic/parts.js` is size arithmetic); `account.js` writes the cloud save in two places (`flushAccountSave`,
`accountSignOut`), not one; and training's rollback guard (RL-9) moves a trainee's start back to a turned-back clock,
so turning it forward again pays the gap (RL-10b's shared guard should fix it). The owner's answers (the
recommendations): you pick the parents and the ranch picks the parts (16's 5.1: both); an abomination wears one
parent's art with its own name and a stat swing; the walking eggs are retired; the parents stay free. Built:
`rules.ranch.breed`; `logic/breeding.js` (the egg rolled from the parents' uids and `ranch.bred` when the pair starts,
kept in the nursery entry, its ready time never moving); `m.mut` (a quirk, or an abomination's name, one stat
`abomUp`, another `abomDown`) read by `stat()` and `billyName`; the ranch sheet's Nursery and "Breed a pair"; the
hatch window moved to the ranch. The old eggs no longer drop, are no longer given or hatched by walking, and their
screens are gone; their data (`eggs.json`, `saveData.eggs`, trainers' `egg`, the Studio's editors, the incubators'
CSS) is dormant, for a cleanup session. The sim's first numbers: 59/31/11 % (odds 60/30/10); a bred Billie's mark
is about even against its unmarked twin, but mixed part sizes lose phase 16's Prime bonus (0.11-0.17 against a plain
Billie; the duel's control is 0.43).

**Corrected in RL-10b (2026-10-23).** Section 3's `ranch.income = {rate, cap: 24 h, lastAt, bank}`: the save already
held `{rate, bank, lastAt}` (RL-3) and no cap; the rate and the cap are rules (`rules.ranch.income`: 1/2/3 Scrap an hour
by ranch level, 24 h; placeholders), so the save drops `rate` (a stored rate would go stale on an upgrade) and `bank`
holds what an old level earned (buying an unlock banks the income first). `lastAt` 0 on a new save would have paid a
full pile at once: income starts at the ranch's first opening. "`lastAt = max(lastAt, t)` on load" only stops a clock
turned back across devices, not a clock set forward; the owner chose the anchor plus a measured skew. Built: one ranch
clock, `logic/ranch-clock.js` (`ranchNow`: the phone time less the session's skew; more than `guardMs` behind the
save's high-water mark `ranch.seen`, time stands still at the mark; `ranchAnchor`, `clockSkew`, a session floor from the
cloud save's `t`), read by training, eggs and income; training's start never moves back (the RL-9 bug RL-10a found);
`logic/ranch-income.js` and the sheet's Income row with Collect (the owner's pick over collecting on opening); both
cloud writes (`accountSaveDoc`) carry `t: serverTimestamp()`, read back once a session for the skew. 8.12: the
`saves/{uid}` key whitelist with `t == request.time`, 14 emulator tests; publish it only after the build is live.
"Working offline" needed nothing new: the service worker was there, and the sums run on the phone's clock with the mark.

**Corrected in RL-11 (2026-10-22).** There is no `hub.js`: the board is `lab-board.js` in the hub's Lab tab (hidden
since UI-5 for it), and Hazel's lab machine (now act `board`) opens it. `won:bracket_N` can't be built yet: meta keeps a
win count and the highest tier, and nothing raises the tier (RL-13 does, on a win); RL-11 added the condition kinds `unlock:<id>`,
`runs` and `wins`. The three doors are one field each: a row with `at` (and `cost`) is sold at that building in its
currency (the Lab's rows are the board), a row with `when` is earned (a milestone; no `door` field). A grant is one of a
building's level, an item into run shops, a biome onto run maps, or a currency; nothing else needed effects (RL-12).
`meta.buildings` stays where a level lives (`ranchLevel` read it already); the load step rebuilds it from the owned
rows. A run copies its shop and biome unlocks at the start (`run.unlocks`), so a run is still made by its seed and that
copy; a run from before RL-11 has none and keeps everything open. Milestones are granted in the hub only (after the
payout and when the world shows at boot), never on a run. Building looks per level: no art, so the label shows the level
(the owner's answer). The Workshop is a row "coming later" (the owner's answer). The run sim, the fixture's run and the
in-game test's run are made without `runTakeOff`, so they keep everything open. The owner's answers: 8.5 the
recommendation; the first unlocks ranch levels, run shop wares, new biomes and milestones.

**Corrected in RL-12 (RL-12a, 2026-10-22).** The owner let RL-12 go before RL-11 (every Loophole on offer from the
first run; RL-11's unlocks may narrow the pool later) and split it: RL-12a is the effects, the Loopholes, the
mini-boss pick and the shops; RL-12b is `events.json` (`relic`, `wager`) and the event and shop places. The calls named
in 4 were all there (`calcDamage`, `catchOdds`, `newBattle` with the run's `runBattleStart`), and the save already had
`run.relics`, `run.offer` and the `menu` phase; RL-12a added `run.offerN` (the offers' stream) and `run.shelf` (a run
shop's Loophole by node and day, so buying it doesn't put another on the shelf), filled by `migrate` for a run saved
before. The effect kinds built are `money`, `price` (shop, heal), `catch`, `stat`, `damage` (deal, take, by category or
type), `heal` (walking in) and `payout` (Capital, the items' share); RL-13 added `level` and `bossHp` (modifiers only); `rule`, `clock` and `start` wait for RL-14
and RL-14. Stat rows apply as the battle is made (yours on the field), said after the sides come out. UI-4 had already
built the run bar's fourth tab (hidden) and the pick card: the tab opens as "Loopholes" and the pick shows its cards
one to a row (three across cut the names). "Tiny waystation scenes" (8.6) can't be: every run scene is 112 x 64 m for
the seams; the owner chose a normal-sized place with a stand (RL-12b). RL-9b (merged during RL-12) brings a won run's
items home, so Write-off (items at full price) counts only on a loss. Names: "Loophole" on screen, `relics` in the data
(the item id `loophole` is the Hi-Potion).

**Corrected in RL-12b (part 1, 2026-10-23, branch `track/encounters`).** Checked in the code first: nothing read
nodeTypes' `engine: "menu"` or the run's `menu` phase (both left for part 2); the map had no rule against two shops in
a row (a town is forced before each mini-boss, and filler rows roll towns too); there were no route trainers, no line
of sight and no "!" until spotted (the only walk-up was the story's `runsUp`); only a mini-boss win left a pick;
there was one evolution item (the Shining Stone) and no line used it, no candy, no tutor; conditions couldn't test
money or a type in the team; `give` handled items only. Built: `events.json` (the owner's 18 events, loot tables,
seven trainer classes) with options as conditions, costs and scripts in the story language; the event commands
(`perk`, `money`, `hurt`, `heal`, `status`, `fx`, `wager`, `loot`, `level`, `recall`, `foe`, `wild`, `reward`) and
conditions (`type:`, `money`, `team`, `badge:`); `run.enc` (no SAVE_VERSION bump: missing on an older run) with timed
boons read by `fxOfRun`; the reward pick (`rewards.json`, a paid reroll that doubles; the owner's option B: Versewift
and Feedopus evolve with the Shining Stone from level 20); route trainers on every route who walk up on sight. Not
"a day passes": RL-R2 drops the deadline, so the drafts' day costs became a tenth of the team's HP. Part 2 (after
RL-R2 merges): the waystation places, the no-two-shops rule, the check-fast page and the in-game test's step.

**Changed in the TR-2 session (2026-10-21, the owner: "runs should go from east to west").** A run scene is entered
by its east side and left ahead by its west: `east`/`east2` back, `west`/`west2` ahead (logic/run-scenes.js
runSceneExits; runExits' `ahead`/`back`, renamed from north/south). Two links a side sit 10 m and 54 m along the 64 m
edge (t 0.15625 and 0.84375, the seam rules' 44 m apart). Every run scene's east and west edges are pinned to height
0 (mapgen `pin`), because on a 64 m edge the strips of two parents overlap and one scene can't follow both. On the
bowl west is clockwise, so the run is an arc on the south side, landing in the south-east, boss in the south-west
(RUN_BOWL a 270, span 120, r 0.62). **Changed in RL-8b:** the run runs straight across the bowl, the landing near the
east rim and the boss near the west (RUN_BOWL x 0.72, step 0.18, lane 0.1, bend 0.06), every run place's map facing
the bowl's north (a spot's `up` 90), on land of its own made from the seed (logic/run-bowl.js); Copperleaf is off a
run's map. MAPGEN_VERSION 5 (merged after RL-8 took 4) leaves a run saved going north. The free sides of a run scene
are now north (the back, behind what the camera looks at) and south (toward the camera); the lines below that say
N to S describe the layout before this change.

### Findings A: battle, state, randomness, saves (verified)

- `game/js/hooks.js` is generated by `tools/to-module.mjs` (one `export let` slot per name, ~274 slots, `provide()`
  fills them). `saveData` and `activeBattle` live in `game-state.js:115-128` with `setSaveData`/`setActiveBattle`,
  which assign and re-`provide`. Each name therefore exists as two live bindings (hooks.js and game-state.js), in sync
  only through the setters.
- `logic/battle-engine.js` reads `activeBattle` as a module global from hooks (56 references), never as an argument.
  `newBattle(kind, foe, extra)` (line 876) installs it with `setActiveBattle`. Side 0's team **is `saveData.team` by
  reference** (line 906): damage and XP land on the save directly. The engine also calls UI seams (`toast`, `save`,
  `openBattle`, `playTurnEvents`, `uiState.dbgCatch`). Battle-end rewards, the lose fee, egg drops and badges live in
  `battle.js endBattle`/`finishThrow`, not in logic/.
- Logic files reading hooks: battle-engine (10 names), rules (14), saves (`saveData`), script, coats, game-data.
  `tools/test/logic.test.mjs:12-29` lists the allowed seams.
- **Randomness: `util.js:11` is `export const random = Math.random`.** Not seedable. The unit tests seed by replacing
  `Math.random` with Park-Miller in `tools/test/load-logic.mjs` *before* util.js loads. The engine calls `random()`
  ~16 times (crit 286, damage 288-289, sleep, retarget, paralysis, confusion, accuracy, effects, AI pick, speed
  tiebreak, catch rolls); `rules.js pickWeighted` too. 177 direct `Math.random` calls in game/+studio/ (rendering,
  sound, ambient life mostly; also `battle.js` bribe/egg drops and `things-to-do.js` rewards, which are game outcomes).
  `logic/mapgen.js` has its own pure sfc32 (`mapgenRandom(seed, salt)` from an FNV-1a string hash, per-stage streams).
  Logic is also not deterministic for other reasons: `newUid` and `met` use `Date.now()`, battle weather follows the
  real clock, wild refill uses `playMs`.
- **Saves:** `SAVE_VERSION = 3` (`saves.js:161`); `migrate()` fills same-version defaults and drops stale ids (not a
  format converter); `validSave` (174-250) is strict (team 1..6, box ≤ 5000, species/uid/lvl/moves checks, `trip.node`
  an index, `se` money, coins/items records, `wild`, `seen`, `caught`, `flags`, `seats`). Top-level keys of
  `newSave()`: `saveVersion, gameVersion, avatar, preferences, started, gender, starter, team, box, parts, seen, caught,
  se (money), coins, items, trip{node,plan}, wild, buddy, flags, seats (badges), visited, serial, eggs, savedAt, tid,
  since, hatched` plus `playMs, story, stats, x, cards, wardrobe` added by other modules. No `unlocks`, no ranch, no
  run, no `day`. Storage key `networth-save-v1[-u-<account>]` in localStorage; cloud copy at Firestore `saves/<uid>`
  (`{json, savedAt, saveVersion, name, game}`, < 1 MB). Save is event-driven (~95 `save()` sites) plus a minute tick.
- **Alpha fights:** actors 0,2,4 vs 1 (`SIDE_ACTORS`), `alphaTeam = 3`, the Alpha acts twice a turn, `makeAlpha`
  sets `m.boss = {hp: 3, st: 1.3}` and +3 levels; `alphaPhase` at 50% HP raises a 2-turn shield and +1 Atk/SpA.
  Wild only today (1/45 with ≥ 2 members). Formats `single|double|alpha` are hard-coded (not in rules.json).
- **Robot parts:** `kind:'robot'`, `gem`, `fit {torso, armL, armR, legs}`, `partDmg` per limb, limb HP = maxHp × 0.4
  × dur, every hit also calls `hitPart` (weights 0.25 each incl. torso), 3 aimed moves, broken limb disables its
  moves, broken legs halve Speed, `aiAimPart` targets the weakest limb.
- **Weather:** `battleWeatherMultiplier` is in `things-to-do.js:705` (reached by the engine through hooks as an
  optional function, line 304). It reads `environmentState(map)` = place climate × the real clock (3-hour blocks,
  hashed, deterministic from wall time). `environmentForecast` exists in environment.js. `logic/bowl-weather.js` is
  bowl visuals only (sky blend, clouds, wind, the Inner Sun); `walk/fountains-weather.js` is rendering only.
- Statuses are `aud` (Paralyzed, "audit"), `sub` (Asleep, "subpoena"), `scn` (Burned, "scandal"). 9 types, 6 stats.
- **Economy:** money is `saveData.se` (start $600). Sources: wild win lvl × $20, trainer reward, bribe after a failed
  catch, things-to-do rewards. Sinks: shops, 10% lose fee, $100 rest stop, airship tickets, clothes. **Healing at the
  clinic is free.** `jobs.json` is dead data. 18 shops (per location, `stock: [{item|coin, price}]`), 12 items, 4 catch
  coins (silver/gold need badges), eggs hatch by metres walked (2/4/8 km) from wild wins (12%) and trainer firsts.
- **Roster:** the game reads `game/data/lines/*.json`: 7 lines, 24 species (roster.json is not read). Legacy ids in
  pools/trainers are stood in by hash onto the 4 uncommon lines, so the effective wild roster is small. 121 moves.
- **Battle length:** no telemetry; an AI-vs-AI simulation (run in memory by the explorer) gave a median of 2 turns
  for equal-level 1v1, with rare 70-190-turn stalls. Playback paces 820 ms per event. So a battle is well under the
  2-3 minute target; a turn cap is advisable for ghost replays.
- **Bug found:** `game-state.js:109-112` and `account.js:304-319` both write `SAVE_KEY-set-aside` with different
  shapes; the account overwrites the game-state copy and the restore UI never shows the game-state one.

### Findings B: world, hub, flow, map generator, content pipeline (verified)

- **Seamless world** (`seamless-world.js`): a place's own map plus a band of each neighbour, built on the fly as a
  composite view (`seamlessHubMap(node)`, view ids `w:<scene>*`); crossing shifts the player by the view-origin
  difference (`shiftWalkView`). Neighbours come from `ROADS`/`ROADS_BY_NODE` derived **once at import** in
  `game-data.js:288-358` (only `kind:'seam'` roads; lifts dropped), looked up by `LOCATIONS.findIndex(mapId)`.
  Caches key on `seamlessWorld.gen`; `boot.js studioLive` already swaps `gameData.maps` live and bumps `gen`. There is
  **no API to swap the location/road graph**; `LOCATION_BY_ID`, `START_NODE`, trainer→node attach are frozen copies.
- **Node indices are identity everywhere**: `trip.node`, `trip.plan`, `visited`, trainer `node`, ROADS entries, the
  world-graph snapshot. `validSave` rejects `trip.node >= LOCATIONS.length` (`saves.js:146, 204`). One location per map
  is assumed (`mapIdAt` falls back to the first map).
- **Data counts:** 96 map files (49 location maps, 23 `int_*` rooms, 22 `test_*`, `gallery`, `city_opening`); 49
  locations; 57 roads (56 seam + 1 lift). **Copperleaf** is index 46, bowl `{a:0, r:0}` (the centre), kind town,
  88×76, **one exit (south)** → `road:hedgerow-copperleaf` ("Route 1") → Hedgerow Lane → Marigold. Props: 5 houses,
  Juniper's home, `lab`, `sign`, `airship_station` (act `fly`). `rules.start.locationId = "copperleaf"`. **No islands**:
  `regions.json` has one entry; the location field `region` groups 28 of 49 places, Copperleaf has none.
- **Map loading:** `build-data.mjs` writes one `gamedata.js` with "lite" maps; `map-files.js loadMapFile(id)` fetches
  `data/maps/<id>.json` lazily (2 roads ahead, then all). A map injected at runtime with no `_lite` is never fetched
  (good for generated scenes). `game/data/legacy/` holds the 55 old Billie lines, not maps.
- **Rooms** open from `ui.js enterRoom` (not walk/rooms.js, which only draws): `seamlessRoomMap(view, roomId, door)`.
- **Travel:** walking across seams (`walkCross`, ui.js:1388) sets `trip.node` and calls `arrivedAt`. "Travel here"
  only sets a guide plan. Glass lift is a prop `act:'lift'`. **No day/step clock remains**; `today()` is the real date;
  weather and time of day follow the real clock.
- **Bowl:** a place's spot is `locations.json bowl {a, r}`; pins from `LOCATIONS` (`world-bowl.js:507, 2409`); the
  module imports `LOCATIONS, LOCATION_BY_ID, ROADS, gameData` and uses them in ~10 places; the logic layer
  (`bowlSeaInput(places, roads, mapOf)`, `bowlReliefFeatures(places)`, `bowlClumps`) is parametric;
  `worldBowlReset()` rebuilds spots and ground. Weather on the bowl: every 5 s per place from `environmentState`.
- **Airship** (`airship.js`): masts are props `act:'fly'`; `flyMenu` lists visited towns with a fare from bowl
  distance; `startAirshipFlight(i)` **sets `trip.node` immediately**, switches to the Map tab and animates a **2D
  sprite** (`map/airship.png`) along a parabola for 2-3 s on the bowl overlay; `flyLand` puts you by the `fly` prop.
  The 3D airship is only the mast prop model.
- **`startGame` is 40 lines (ui.js:2263-2302)**, not 574 (the audit's number spans the global click handler):
  new save keeping preferences, starter at `RULES.start.starterLevel`, `trip = {node: START_NODE}`, starter
  encounters and egg, save, walk tab, welcome modal or `storyRivalBattle`. Boot: `boot.js:905-951`. Tabs:
  `walk, map, team, ledger (Guide), bag` + profile; Settings, shop, dressing room, things-to-do, fishing, talk,
  gallery, friends are overlays.
- **Opening today:** `cutsceneStart` → `openingCity` (cutscenes/city.json, 21 s) → `fallPlay` (crust to Copperleaf)
  → cutscenes/opening.json on Copperleaf (wake, Hazel, dressing room, Blake, staged fight, coins, `pick-starter`,
  `rival-battle`) → `startGame`. `nw-opening-done` (story.js:161-172) is a per-device "offer Skip" flag, **kept on
  purpose** (HANDOFF 740); only its prefix is legacy (so is the save key `networth-save-v1`).
- **Story layer:** flags in `saveData.story` (`storyFlags()`), trainers beaten in `saveData.flags`, badges in
  `saveData.seats`; scripts, `when`/`unless`, `requires`/`locked`, chapters, presets (`?story=`), story checks.
- **Badges/gates:** 8 leaders with `trainer.seat` (oil, retail, haven, peak, bloom, vault, morel, carat); 11
  locations carry `gate: <seat>`, 4 `ride: 1`; `canEnter` (rules.js:629). `world-graph.test.mjs` snapshots places,
  roads, exits, gates, lifts and requires `map.locationId === location.id`.
- **Map generator** (`logic/mapgen.js`, imports only test-globals, Node-safe, **not loaded by the game page**):
  `mapgenParams`, `mapgenScene(params, {scenery, biomes}) → {scene, notes}`, `mapgenRandom`, `mapgenNoise`,
  `mapgenUnreachable`. Output: a full route scene with `edgeExits [{id, side, t, in, width, len, path}]`, `hub`,
  `gen {v, params, seed}` (seeds inside params). **Routes only**: the `lots` stage and town kinds are named but
  missing (MG-3 not started); no `locationId`; no seam alignment to a neighbour (MG-2 not started). Measured here:
  136 ms (112×64), 184 ms (128×96), 451 ms (200×200). 11 biomes. A seam join must satisfy check-data (opposite
  sides, equal width, integer `t` offset, walkable ground, ≤ 2 exits a side 44 m apart) and a02_joins (heights within
  5 cm and identical tiles within ±6 m, a straight walk across).
- **Adding a data section** (pattern of commit 2457957, biomes): `game/data/<key>.json`, `index.json keys`, a
  schema in `game/data/schema/`, a type in `game/types/game-data.d.ts`, a check in `tools/check-data.mjs`; an export
  in `game-data.js` to use it; `data-files.js SPLIT` only for a per-id folder. Data is one generated `gamedata.js`
  (+ lazy map files); `data-fallback.js` loads files one by one when it is missing.
- Candidates to park: `jobs.json` (unused), `fishing.json` (water encounters), lore, postcards, `regions.json`
  (one entry), story.json `quests` (empty), location `requires` (unused).

### Findings C: robots, Alpha, online, security, tests, eggs (verified)

- **Robots:** 4 slots `torso, armL, armR, legs` + `gem` (**no head slot**; the head is torso art). Data: 3 torsos, 6
  arms (either side), 3 legs, 3 gems = 972 builds; 12 robot moves (`fx.aim`, `fx.breaker`, `fx.repair`); moves from
  parts (`robotMathMoves`); `makeRobot(gem, fit, lvl)` → `kind:'robot', sp:'bot:…'`; everything else via
  `speciesOf(m)`. Gem = stat bonus, signature move, type affinity, keeps level across bodies; **no personality/passive
  trait**, "personality core" appears nowhere. Reachable only via the debug menu (`giveRobotKit`, Tinker Rho). No wild
  robots, no repair kits in shops. `robot-art.js robotRig` draws parts on the biped skeleton. The phase 17 prototype
  is unapproved and untagged.
- **Alpha:** one fighter, one HP pool, `m.boss = {hp:3, st:1.3}`, foe side capped at 2 actors (`SIDE_ACTORS`,
  `allSnapshots` hard-coded 0..4), `alphaPhase` once at 50%. **A Voltron as one robot with `m.boss`** gets boss HP,
  3 breakable limbs, aimed hits, the shield phase and double actions with no engine change; limbs are part ids, not
  whole bots. Separate bots would need the foe side widened (formations, snapshots). Visuals: scale 1.6 for boss,
  alpha formation, red glow, shield light, screen shake, broken limbs drawn faint.
- **Online:** Firebase Auth **Google only** (no anonymous); compat SDK loaded from jsdelivr with no SRI; cloud save
  `saves/{uid}` `{json, savedAt, saveVersion, name, game}` (< 1 MB, no key whitelist); friends: codes, requests,
  presence (`users/{uid}`: name, avatar, partner, `at {node, place, sid, x, z, t}`), friends drawn walking in the
  world; **no trading, battling or visiting**. Rules: 4 match blocks, default deny; new collections need their own
  blocks + emulator tests (13 today, Java 21, `firebase emulators:exec`). Rules can check shape and size only; a
  legal team can't be checked without server code (SECURITY.md). Known friend bugs: re-adding from the other side,
  `friendWorldItems` reads `p.build` which `cleanFriend` drops, `codes/` never deletable.
- **Security/dead weight:** `studio/js/github.js:131` links a classic `public_repo` token, `:137` ticks Remember me
  (localStorage); SECURITY.md recommends A (fine-grained single-repo token) and B (session-only default), marked
  "ask before changing". `cleanName` is in `logic/rules.js:210` (SECURITY.md says game-state.js: stale; it also says
  `esc`, `N(m)`, SAVE_VERSION 1). `escapeHtml` (game-state.js:53) used 299 times; 58 `innerHTML` in game/js, 73 in
  studio; `modal()` and `toast` put titles in unescaped, so safety rests on callers + `cleanName`. Version-stamped
  tools: 10 `*-v46/v47.py` + `build-v28.py` + 5 `scene_props_v*.py` (most are live generators, not dead: RL-1); `eslint.config.js:2-3` and `CLAUDE.md:30` still
  describe shared globals (README is current). `account-config.js` is committed (normal for Firebase; header stale).
- **to-module.mjs:** new module state = `export let x` + `export function setX(v) { x = v; provide({ x }); }`, then
  `npm run modules`; `check:modules` also checks load order. The edit hook does **not** run check:modules or format.
- **Tests/CI:** 52 test files, 266 literal `test(` calls (279 cases with loops); fixture vs real data setups;
  `sim/` holds only robot-sim. CI: lint job (lint, typecheck, test, data, modules, format, build), smoke job
  (check-fast in Playwright), rules job, nightly full + selftest; `check-quick --smoke` is **not** in CI.
  `runFullTest` phases include Alpha, double, opening, world map; **no robot phase**. Debug log: counts and
  preferences only + small scene screenshots; check-fast plants names and checks the export. Typing: 34/129 game
  files (all 29 logic files), 0/34 Studio files.
- **Eggs:** tiers 2/5/10, `need` in metres (2000/4000/8000), capacity 8, 2 incubator slots, 12% drop after wild wins,
  `addWalked` outdoors only; `hatchEgg` picks by weight and rolls a coat. **No breeding code exists.** Dex: `seen`,
  `caught` records of species id → 1. Billie "parts" are size builds `{head, body, front, back, sig}` S/M/L
  (`logic/parts.js`: weight, stat factor, Prime +10%); not swappable in game; `partKits.json` is a Studio art kit.

### Findings D: plans that already exist for what the brief asks (verified)

- **Phase 19 "Battle core: seeded, replayable, two-sided, effect handlers"** exists only on the branch
  `plan/engine-phases-19-21` (docs/phases/19-battle-core.md, 12 KB), decided by the owner on 2026-10-19 to come
  **before** phases 18, 20 and 21. It designs exactly what brief section 4.2 asks: a battle-owned seeded PRNG
  (`logic/prng.js`, `b.rng`, cosmetic `fxRandom` apart), `createBattle({sides, seed, rules, kind})` on a JSON-safe copy
  of the fighters, `battleResult`/`applyBattleResult` so the engine never calls `save()`/`toast()`, two-sided inputs
  with controllers (`player | ai | remote`), a replayable input log with an engine version and a rules hash, an
  effect-handler table (`logic/effects.js`), seeded wild encounters (place id + a counter in the save), scripted
  battles for Project Story S6, a golden-record test first. Its "Ask me before": mid-battle quit (recommends keeping
  the battle in the save and resuming), Lullaby turns, and finishing/tagging the phase 17 prototype first. **Nothing
  of it is in main** (no prng.js, no effects.js, no golden record; `random` is still `Math.random`).
- **Phase 21 "Texture atlases and KTX2"** (same branch): after phase 20; not needed by the roguelite.
- **Phase 20** (renderer batching) is in main with stages A, B, C-1, C-2 done; its later stages wait on phase 19.
- Numbering: 19 and 21 are taken on that branch, 22 (story layer) was absorbed into Project Story, so **23 is the
  first free phase number**; the tracks use prefixes (ST-N, MG-N, PS-SN).

## 0b. Old phases: where they stand (read from docs/HANDOFF.md only)

No `phase-NN-done` tag was ever pushed (every session's tag push got HTTP 403), so "done" below means the HANDOFF
entry says the phase's work is finished, not that a tag or the tag-triggered CI full run exists. "Open" lists what
the entry itself left undone or asked the owner.

| Phase | Status | Open (from HANDOFF) | In the rework |
|---|---|---|---|
| 00 Finish current work | done (`Baseline` tag is the one tag on GitHub) | — | keep |
| 01 Baseline and bug fixes | done 10-16 | tag; Studio round trip in CI | keep |
| 02 Security | done 10-16 | owner console steps (publish rules, restrict the key); Studio token options A/B "ask before" | absorb: hardening phase does A and B |
| 03 Fresh base | done 10-16 | full quick check skipped; no picture baseline (made by the first phase tag) | keep |
| 04 Modernize (04a-04e) | done 10-18 | tag; check-studio-github in CI?; Studio local mode | keep |
| 05 Internal renaming | done 10-18 | tag | keep |
| 06 UI structure (06-1..06-4) | mostly done 10-19 | plan not fully met: ui.js ~3,000 lines not split, old CSS layers not emptied; owner's answer on a 06-5 session; tag | park 06-5; the run screens are new modules anyway |
| 07 Portraits | part 1 only (kit, slicer, portraits.json; nothing uses them) | renderer, Studio section, tests, old system removal | park (not needed by the loop) |
| 08 Movement, maps, rooms | 08a-1..3 and 08b-1..2 done; 08b-3 not | room templates and slot sets, Studio edits links/doors, the full quick check, the first picture baseline, tag | absorb: the run-loop phase composes generated maps on 08b's seam model; 08b-3 templates parked |
| 09 Props and terrain | partly: Copperleaf, Route 1, Marigold and the city set redone (batches 1-8) | the rest of the world's props; duplicates and unused props; baseline; tag | park: the other towns move to legacy anyway; run biomes reuse the done kits |
| 10 World-map bowl | done pending the owner's phone look (E-map-1..4, look s1-5, fixes) | phone look, then tag; the mthing shader location (ST-5/6 note) | absorb: the bowl must show a run's node map |
| 11 Opening | moved to Project Story S7-S8: the city plays from New game before the fall | lite version, sounds, logo, show-once skip (beat sheet "Still to do") | absorb: the first run starts from the airship (see opening decision) |
| 12 Ranch | not started (plan doc only) | everything | absorb: the ranch milestone |
| 13 Testing | 13a done (unit tests, check-fast, fixtures, graphics test, edit hook); 13b, 13c not | fixtures per group, parallel groups, waits, key shots; lazy debug code; opt-in error reports; smoke and full over budget | absorb: 13b's fixtures are what run tests need; 13c parked |
| 14 Studio | partly, early, through the Studio track (ST-0..ST-6) | performance, new editors for new formats, local mode | absorb: run-content editors come with their data sections |
| 15 Design and story | archived; story half → Project Story S4 (not done); design half (core loop, tax mechanics) never written | — | superseded: this plan is the design half |
| 16 Billies | prep + prototype part 1 (parts, 7 lines, Studio Parts) | starter split by body, passives, quirks, Prime moves, breed function, abominations, breeding sim, full roster | absorb: breeding/abominations in the ranch milestone; the rest parked |
| 17 Robots | prototype built, unapproved, untagged, debug-only | the "Ask me" list, first robot in play, balance bounds, 3D preview, paint, loadouts, crafting, wild robots | absorb: bots-as-enemies phase (sourcing from runs, the Voltron) |
| 18 Friends trading and battles | not started | everything | absorb: online phase (ghosts, daily seeds); trading stays out of scope |
| 19 Battle core | plan only, on branch `plan/engine-phases-19-21` | the whole phase; asks: mid-battle quit, Lullaby, finish 17's prototype first | absorb: it IS the state-separation phase |
| 20 Renderer batching | stages A, B, C-1, C-2 done; C5 and stage D not; frameBlock off by default | owner's phone check of the Frame block; tags 20a/20b | park |
| 21 Atlases and KTX2 | plan only, on the branch | — | park |
| Project Story | S1-S3 done; cutscene tools s1, s3 done (s2 not); S7 built; S8 partly (city before the fall) | S4 story bible, S5 Hazel's opening rewrite, S6 (waits for 19), S8's rest, cutscene tools s2 | absorb S5/S8 into the opening decision; S4, S6 parked |
| Studio track | ST-0..ST-6 done; ST-7 next | st-N-done tags local only; ST-5/6 questions | keep running alongside |
| Map generator | MG-1 done (routes); MG-2..MG-5 not | linking (MG-2), towns (MG-3), presets/regenerate (MG-4), checks (MG-5) | absorb: MG-2 and MG-3 are prerequisites of the run map |
| Other | Graphics test and bench done; debug session; Parts fixes 1-2 (PR #77, #78) | **PR #78's entry says its validation could not run** | hardening phase verifies #78 first |

Owner questions still open in HANDOFF that touch the rework: tags for 01-05, 06, 10, 20, ST-4..6, PS-S1/S2; phase 06's
06-5; phase 10's phone look; phase 17's prototype approval and ask list; phase 16's breeding mode (5.1); phase 19's
three asks; whether old account saves may be replaced (02).

### 0c. Old work the roguelite does not need (parked) and what it does need

Owner's decisions (this session): the rework is a **track**, `docs/phases/roguelite-track.md`, sessions **RL-1..RL-N**
tagged `rl-N-done` (like the Studio and Map generator tracks; 19 and 21 stay reserved on `plan/engine-phases-19-21`);
parked phases are **marked parked in docs/ROADMAP.md** with a note saying what brings them back.

**Parked (nothing in the rework depends on them):** 06-5 (ui.js split, old CSS); 07's remainder (portrait renderer,
Studio section, old system removal); 08b-3 (room templates, slot sets, Studio door editing); 09's remainder (the other
towns' props, dedupe, unused props: those maps go to legacy); 13c (lazy debug code, error reports); 14's remainder
(Studio performance, local mode); Project Story S4, S5, S6, S8's leftovers and cutscene tools s2; 16's remainder except
breeding (starter split by body, passives, quirks, Prime moves, full roster); 17's remainder except enemies (3D
preview, paint, loadouts, crafting, the workshop's place); 18's trading half; 20 C5 and stage D; 21; ST-7 and the rest
of the Studio track (runs alongside); MG-4, MG-5; the mthing shader location (a fix, not a dependency).

**On the path (remaining work the rework absorbs):** 02's Studio token options A and B (RL hardening); 10's bowl
showing a run's node map; 12 the ranch (all four functions); 13b's fixtures for starting inside a run; 16's breeding
and abominations (ranch milestone); 17's bots as enemies (trainer bots in runs, the Voltron, salvage); 18's async
battle half (ghosts, daily seeds); **19 battle core as the state-separation session**; MG-2 linking and MG-3 towns
(prerequisites of the run map); S7/S8's city opening (where it sits once the first run starts from the airship).
Count: 14 parked items, 10 on the path.

## 1. The reworked roadmap (what docs/ROADMAP.md becomes when the plan is approved)

**Restructured 2026-10-23 (section 9):** after RL-12a the order is section 9.4's (regions, encounters, story, then
brackets, bots, online). The table below is the original plan.

- The roguelite rework is the spine: one track, `docs/phases/roguelite-track.md`, sessions **RL-1..RL-16** (plus
  MG-2 pulled onto the path), each one session unless marked, tagged `rl-N-done`, a HANDOFF entry per session, Plan
  Mode first, one cause per commit, the quick check tiers of docs/TESTING.md after every change.
- Tracks alongside: Studio (ST-7+), Map generator (MG-2 on the path; MG-3 when a town node needs it; MG-4/5 after
  the first cut), Project Story (S6 unblocked by RL-4; S4, S5, S8's leftovers parked until the first cut is played).
- Old phases stay in the roadmap in one table (section 0b): done in one line each, parked with what brings them back,
  absorbed with their RL session. docs/VISION.md gets a rewritten "How the game plays"; CLAUDE.md gains one ground
  rule ("a roguelite: hub + runs; every map outside the hub is legacy") and loses the stale camTo/dioTileHalf gotcha.
- Order after the first cut follows the brief (ranch, hub upgrades, relics, modifiers, bots, online).

| # | Session | Goal | Sessions | Playable |
|---|---|---|---|---|
| RL-1 | Hardening | brief 2.6-2.8, PR #78 verified, the set-aside bug, RNG facts written down | 1 | no |
| RL-2 | Golden record and RNG module | battle golden snapshot; `logic/rng.js` (mapgen's sfc32 moved); seeded `pickWeighted`/`spawn` | 1 | no |
| RL-3 | State separation | SAVE_VERSION 4; `meta`, `run`, `ranch` in the save; validators; `migrate` keeps a run's trip | 1 | no |
| RL-4 | Battle state injected (phase 19's core) | engine context `useBattle`, no save writes, silent host, `b.rng`, turn cap | 1-2 | no |
| RL-5 | Legacy parking and the world setter | 47 maps and their places to `game/data/legacy/`, `worldSetGraph`, fixtures and checks retargeted | 1-2 | no |
| MG-2 | Seam agreement in mapgen | generated parent/child pairs pass check-data's seam rules and a02_joins' numbers | 1 | no |
| RL-6 | Run map and clock logic | `logic/run-map.js`, `nodeTypes.json`, forecast, deadline; no UI | 1 | no |
| RL-7 | Run world | generated scenes installed and walkable, the bowl shows the run | 1-2 | no |
| RL-8 | Run loop and payout | airship start, town with paid healing, mini-boss, payout, resume: **first playable cut** | 2 | yes |
| RL-8b | Run look | the owner's notes from the first play: rooms darker, the hub an island, a run's own world map | 1 | yes |
| RL-9 | Ranch A | the building, store and keep, train between runs, the keep-one rule | 2 | yes |
| RL-10 | Ranch B | breed safe/risky with abominations, hatch, passive income (cap, rollback guard, offline, server anchor) | 2 | yes |
| RL-11 | Hub upgrades, currencies, unlocks | `currencies/buildings/unlocks.json`, the Lab board, one unlock registry | 1-2 | yes |
| RL-12 | Relics and effects | `relics.json`, `events.json`, `logic/effects.js` (phase 19's handler table), picks | 1-2 | yes |
| RL-13 | Expeditions, challenges, starter points (done 2026-10-24; section 9.4's row and the HANDOFF) | `modifiers.json`, the Expedition and challenge pick at the mast, starter points, leaders of their own type | 1 | yes |
| RL-14 | Bots as enemies, salvage, the Voltron | `factions.json`, `bosses.json`, data-driven `alphaPhase`, a robot phase in the full test | 2 | yes |
| RL-15 | Online | run record, friend ghosts, daily seeds, rules and emulator tests | 2 | yes |
| RL-16 | Content packs and Studio editors | `mergeInto`, pack checks, editors for the new sections | 1-2 | yes |

Total about 22-28 sessions; the first cut (RL-1..RL-8 plus MG-2) about 10-13. If the scope is too big: RL-1..RL-8 with
MG-2, then play; then RL-9, RL-10, RL-11, RL-12, RL-13, RL-14, RL-15, RL-16. Cut order inside the ranch milestone: the
server timestamp first (keep the local guard), then risky breeding, then the walkable yard; never store/keep or train.

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

**2e. The node map, clock, bowl, seamless world, airship.** (Built in RL-6 as section 0 says: `runMapMake(seed,
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
deadline maths). Could break: nothing in the page. 1 session. Done 2026-10-21 (HANDOFF; section 0 for what changed
from this paragraph): also `runMapRows`, `runMapStart`, `runBack`, `runExits`, `runSpot`, `runForecastFill`, biome
climates, the payout's distinct nodes; `run-map-real.test.mjs` and `weather.test.mjs`.

**RL-7 Run world.** Files: `game/index.html` (+ mapgen), new `run-world.js` (`runWorldInstall`/`runWorldRestore`,
lazy generation, run trainers, `seamlessWorld.gen++`, `worldBowlReset()`), `boot.js` (install before
`loadMapsAhead`), `world-bowl.js` (locked pins, day chip, forecast icons), `rules.js encounterStock` (`stock`),
`environment.js` (forced weather on arrival). Tests: `run-world.test.mjs` on real data (every run road's exits face
and align; restore leaves the hub tables as before). Could break: the walk view when tables change mid-session,
seamless caches, name-free debug log. Verify: (a), (b), smoke, a quick-check step on `?fixture=run` (install, open the
map, walk one seam). 1-2 sessions. Done 2026-10-21 in one session (HANDOFF; section 0 for what changed from this
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
section 0 for what changed from this paragraph): `logic/battle-rewards.js`, `logic/run-loop.js`, `run.js`,
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
2 sessions. First half done 2026-10-22 (HANDOFF; section 0 for what changed): the barn and its sheet (`ranch-screen.js`),
`logic/ranch.js`, `rules.ranch`, Scrap from the payout, the fixture, check-fast and in-game steps. RL-9b done
2026-10-22: the mast's pick of 1 home Billie and the packed bag (8.2), the storage trap in `runEnd`, the bag home on a
win, the sim's policy, check-fast's "Packing for a run".

**RL-10 Ranch B.** Breeding safe/risky with abominations, hatching on ranch time, passive income with cap, rollback
guard, offline, the cloud `t` anchor and its rule. Files: `logic/breeding.js`, `logic/ranch.js`, `logic/rules.js`
(eggs), `account.js:331-351`, `firebase/firestore.rules` + `firebase/test/rules.test.mjs`,
`tools/test/sim/breeding-sim.mjs` (reports only until bounds are agreed). Could break: cloud saves (publish the rule
after the emulator passes). 2 sessions. RL-10a done 2026-10-22 (HANDOFF; section 0 for what changed): breeding,
hatching, `m.mut`, the old walking eggs retired, the sim. RL-10b done 2026-10-23 (section 0): passive income, one ranch
clock with the rollback guard (training's fixed), offline, the cloud `t` anchor with a measured skew, the key whitelist
(8.12).

**RL-11 Hub upgrades, currencies, unlock board.** `currencies.json`, `buildings.json` (Lab, Ranch, Workshop, Airship),
`unlocks.json` with the three doors, `logic/unlocks.js` (`unlockReady`, buy, auto at payout and on load),
`conditions.js` (`unlock:`, `won:`), `hub.js` board screen, `copperleaf.json` building variants per level. Tests:
`unlocks.test.mjs`, `conditions.test.mjs`, check-data (a fifth currency fails, every grant exists). 1-2 sessions. Done
2026-10-22 in one session (HANDOFF; section 0 for what changed from this paragraph): the three sections,
`logic/unlocks.js`, the conditions `unlock:`, `runs`, `wins`, `run.unlocks`, `lab-board.js` (the Lab tab, the ranch's
and the mast's upgrade rows, levels in labels), the `lab` fixture, check-fast's Lab step, the in-game phase.

**RL-12 Relics and effects.** `relics.json`, `events.json` (scripts with `relic`, `wager`), `logic/effects.js` (kinds,
hooks, `B().fx`; phase 19's handler idea), one hook call each in `calcDamage`, `catchOdds`, `newBattle`, the pick
sheet, the Bag's relic list, the waystation node engine. Tests: `effects.test.mjs` (each kind, stacking order, a run
with every relic stays finite), a golden battle with a relic, story checks on events. 1-2 sessions. RL-12a done 2026-10-22 (HANDOFF; section 0 for what changed): `relics.json`
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

**Verified facts:** everything in sections 0, 0b-0c and the spot checks: `random` unseedable at runtime; the engine's
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
with pyramids. The organization is the Bureau of Lost, Found and Beans; the game is Pocket B&B² (9.5 is superseded by
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
| The organization | **The villain team of the runs, bots are its army**; the Voltron is its first big weapon. Claude drafts 3 name options (9.5) |
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

About 14-19 sessions after RL-12a (was 8-10), plus the roster sessions alongside. Section 1's table and the order in
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
- **RL-12b part 1** (done 2026-10-23; HANDOFF and section 0 "Corrected in RL-12b" have what changed). Part 2 (after
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

### 9.5 The organization: three name options (superseded 2026-10-23: finance names; see reflavour-track.md section 4)

1. **The Office of Unclaimed Property (OUP)** (recommended). It files everything that falls through a portal as
   unclaimed property, you included, and "returns" lost property to the drop point: Copperleaf. That is why a lost
   run ends there (Hazel's discovery), and why Chosen's credit is wrong. Logo: a luggage tag with a keyhole. Terms:
   "claims", "lots", "the Register". Goal: catalogue the Hollow Earth, then auction it.
2. **The Escrow.** Holds the anomalous "in escrow" until a buyer appears. Logo: a sealed envelope with a wax eye.
   Goal: sell the Inner Sun to the surface's billionaires.
3. **Quiet Holdings.** A holding company that owns things nobody is allowed to know exist. Logo: a hollow circle with
   a notch. Goal: hold the Hollow Earth off every map.

The bots fit any of them as "repossession units"; the Voltron as the first "Lot".

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

Split by the files a session owns, as docs/phases/test-cleanup-track.md does: each session is its own branch and PR
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

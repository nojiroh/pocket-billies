# Splicing track (SP) - Genes, splicing and Augments for Billies

Branch: track/splicing

The owner asked (2026-10-25) for a Billies system that is "dynamic, unique and fun": players make their own Billies
by gene splicing "a little like Spore", can give a Billie a bot arm, and wild Billies can wear other Billies' parts.
Designed in a project thread with research on comparable games; the full design, with the owner's answers, is the
Claude Doc "Billie Splicing: parts, genes and augments" (https://claude.ai/artifact/B7RaHqpA3gxirCTLNmGtTG). This file
is the build plan. The planning session ran on a `claude/` branch (BRANCHES.md: the owner makes `track/splicing` from
main, then every SP session starts on it). Tags `sp-N-done`.

Before proposing anything in a session: read the latest HANDOFF.md entries and recent merges, then check the facts
below against main and report what differs.

## The design in short (decided 2026-10-25)

- **The body is locked.** The body slot is the species (line, first type, base stats, learnset, evolution, Prime
  check) and is never spliced. Front, back, sig and the extras take **Genes**; the head too, as a late unlock.
- **A Gene** is a kit part id (`eagle_wing`) plus a donor species (its weight and colour), a **trait** from its part
  kind (wing: Airborne, fin: Swimmer, shell: Armored, horn: Gore, spikes: Barbed, mane/crest/ruff/crown/plume: Showy,
  ear: Keen, lure: Lure, tail: Counterweight), an optional move and, for about 1 in 6 Genes, a **dominant type** that
  becomes the second type (only one counts, the heaviest slot's; never more than 2 types). At most 3 traits show.
- **Stats** come from the existing weight formula: a foreign part weighs what it did on its donor (donor stage weight
  x slot share x size), inside the existing +/-20 % cap.
- **Stability** is the budget: a part from the same line costs 0, another species of the same kit 1, another kit 2,
  an Augment 3. The limit starts at 3 and the Gene Bank raises it to 5. Past the limit is allowed on purpose: the
  Billie is **Unstable** (RL-10a's abomination made deliberate: merger name, one stat x1.3, one x0.75, a drawback
  passive). Past limit + 3 the splice is refused.
- **Prime** stays (all native parts at M). Its +10 % is set after the balance sim, likely +5 % (RL-10a's duel sim:
  mixed sizes win 11-17 % against a Prime twin, control 43 %).
- **Wild splices, about 15 % in all:** Graft about 12 % (1 foreign part from the same biome pool), Chimera about
  2.5 % (2-3 parts, often Unstable), Escaped specimen about 0.5 % (an Augment; more near Bureau nodes). After a win:
  **Tax** it (keep it with its parts) or **Sample** it (knock it out: DNA plus a Gene Sample of its foreign part).
- **The Gene Bank** is a new Copperleaf building paid in a new meta currency, **DNA** (a fifth currency: VISION.md's
  "four currencies in all" is updated when DNA lands). Sequencing a Billie's parts into the library is free; a splice
  costs DNA; the swapped-out part goes back to the library, so splices can be undone. Splicing is a hub action, plus
  rare run events (a back-alley splicer, a Bureau field lab, a Gene auction, a recall).
- **Splices survive evolution:** native slots update to the next stage, foreign parts stay and scale.
- **Augments** are robots.json arms and legs (RL-14 salvage) fitted at the Workshop for Scrap. They bring their move,
  stats and type, and they are the **only parts that break** in battle (limb HP as robots), repaired in towns.
- **Field moves:** a fitting part counts as the type for Surf, Dig and Cut (fins or the Hydrant Arm for Surf, a horn
  for Cut, bear arms or the Auger Arm for Dig); the badge is still needed.
- **Late:** head splices (passive swap), resizing and recolouring, the **Seedling** (a blank clone whose types, moves
  and final form come from its parts: Seedling -> Sproutling -> Apex, names are placeholders), and custom species
  shared in friends' ghost teams and as wild Billies in daily seeds (names need a filter).
- **Later, not in this track:** the Hostile Takeover set bonus (3+ parts from one donor give its passive at half
  strength) waits for species passives.

## Verified facts (2026-10-25, main at 2cfef57)

- **A build is sizes only.** `Billy.build` is `Record<string, 'S'|'M'|'L'>` (`game/types/save-data.d.ts`), rolled
  20/60/20 per slot by `rules.js rollBuild`; `cleanBuild` fills missing slots with M. Slots and shares live in
  `rules.json parts` (head 0.15, body 0.4, front 0.15, back 0.15, sig 0.15).
- **Part arithmetic** is `logic/parts.js` (`partsWeightRatio`, `partsStatFactor`, `partsLean`, `partsPrime`), shared
  with the Studio. It knows sizes, not which part sits in a slot.
- **Native parts** per stage are in `lines/<id>.json parts` (a kit part per slot), written by the kit baker; nothing
  in battle reads them.
- **Art is baked offline.** `logic/kit-assemble.js` (`kitBakeWhole`) and `logic/rig-swap.js` (`rigRefit`) are logic
  only (no DOM) and run in the Studio (`studio/js/kit-recipe.js`) and `npm run bake:kits`; the game itself never
  calls them. (SP-1, checked at 501b286: kit-assemble.js wasn't even on the game page; SP-1 put it there. Rebaking
  the whole recipe with a part swapped is exact and needs no `rigRefit`, which stays a Studio tool.) `skeleton-rig.js` scales pieces for sizes. Every Billie (40 species) is built from the kit parts on a
  biped rig, so a part from one fits another's sockets (`partKits.json socketRules`).
- **Parts library:** `partKits.json parts`, 120 parts from 3 kits (beasts, birds, fish); no claws yet.
- **Abominations** (`logic/breeding.js`, RL-10a): `m.mut` with a name, one stat up (`abomUp` 1.3), one down
  (`abomDown` 0.75); they wear one parent's art.
- **Robots** (phase 17): `robots.json` has 12 parts (3 torsos, 6 arms, 3 legs), each with a type, stats, weight,
  durability and (arms, legs) a move; `partHpRatio` 0.4, `upgradePart` to `maxUpgrade` 3. `robotRig` draws them on
  the biped skeleton. RL-14 (bots as enemies, salvage) is not built yet.
- **Effects** are team-wide rows (`logic/effects.js fxOfRun`). RL-12c (held items, `track/encounters`, not on main
  yet) plans the first per-Billie path (`fxHeld`); parts should use the same path, not a second hook.
- **Passives** exist only per type (`types.json`); no species passive exists, so head splices wait for them.
- **Buildings and currencies:** `buildings.json` (lab: research, airship: crests, ranch: scrap, workshop: scrap,
  `soon`), `currencies.json` (money, research, scrap, crests).
- **Wild spawns:** `rules.js spawn`; run pools come from `biomes.json` and the region's dex (`regions.json`).

**Corrections found by SP-2 (2026-10-25, on SP-1's branch):** Prime's +10 % is applied after the +/-20 % cap and to
every stat, HP included (so the cap doesn't bound it). `partsLean` isn't the Studio's (it uses WeightRatio, StatFactor,
Prime, PrimeOdds). `lines/<id>.json parts` are part ids for the art, not sizes. The parts a splice can swap are only
the slot bones (front: arm, wing, frontfin; back: leg, foot, backfin; sig: tail, tailfin): the trait list's extras
(shell, horn, spikes, mane, crest, ruff, crown, plume, ear, lure) aren't spliced yet, `lure` is in no recipe, and arm,
leg and foot had no trait (SP-2 gives them placeholders: Grip, Stride). SPECIES has 63 ids, the 40 species and 23
regional forms; kitBuilds has 51 rigs, so a regional form with no rig of its own (e.g. `swift_folklore0`) can't be
spliced yet. The per-Billie effect path is `fxOfBillie` (RL-12c is on main), not `fxHeld`; the effect kinds have no
on-hit, immunity, crit or foe-debuff kind. Abominations have no drawback passive (only the two stats). Robots: torsos
have no move; `upgradePart` is a function, the rules are `upgradeStat` and `maxUpgrade`. `regions.json dex` is a size
range, not a species list. Moves have no "family".

**Corrections found by SP-3 (2026-10-25, on SP-2's branch):** Scrap isn't banked when it drops: it is paid at a run's
end (`run-state.js payoutOf`: per place cleared and a win); no currency was banked mid-run before DNA (`meta` isn't in
`RUN_FIELDS`, so a mid-run deposit survives a lost run). `currencies.schema.json` allowed exactly four. "Tax" isn't
the catch word any more ("Catch it", pyramids), and catching happens during the battle: a win means the foe fainted,
so "Tax or Sample after a win" became catch (keeps its parts) or knock out (samples them). There are no Bureau nodes
(nodeTypes has none; the Bureau is a trainer and two event texts), and Escaped specimens need SP-5's Augments.
Species come from `pools.json` (a place's `pool`), cut to the region's dex by `wildPoolList`. Fishing doesn't go
through `spawn` (no fished splices). A run place's stock comes from one seeded stream: a roll inside `spawn` would
change every later Billie of the place, so splices roll from a stream of their own. The run-start snapshots hold no
wild stock (unchanged).

**Corrections found by SP-4 (2026-10-26, on SP-3's branch with main merged in):** main already had most of the Gene
Bank's building (the hub track: HB-5's `gene_bank` model, a solarpunk lab-vault, its room `int_gene_bank` with a
Splice console, the door act `enter`; HB-4b's bare `genebank` plot), none of it on SP-3's branch. Building levels are
unlocks.json rows (`grant {building, level}`), not a buildings.json field, and `dataBuildings` refuses an act no
Copperleaf prop has. The Stability limit was read at the default in five places (rules.js billyUnstable, unstableTidy,
spliceReport; saves.js graftTidy; genes.js wildSplice), not graftTidy alone. "Extras and sig first" can't be built:
only front, back and sig are spliceable (extras are anchors on a form, not slots), so the levels open sig, then front,
then back. There is no Dig: the Ground field move is Rock Smash; a horn for Cut can't be spliced (an extra) and the
Hydrant and Auger arms are SP-5's. The Studio's "Parts" section edits rules.json `parts`, and no Studio file read
genes.json. A milestone granting DNA was dropped (unlockGrant knew research, scrap and crests only). `pointCost` saw no
splice. Breeding never read `graft`. genes.json `parts` has no `move` yet (Gene moves are still with the owner).
`meta.genes` is a set: a Gene is never used up. CLAUDE.md's gamedata.js note is stale (generated, not in git).

## Sessions

Each session: one cause per commit, lint, type-check and unit tests after each change, the smoke subset, the quick
check at the end, a HANDOFF entry, tag `sp-N-done`. Battles with no graft stay byte-identical (the golden battles must
not move), as RL-12c does for held items.

**SP-1 Art spike (prove it on the phone first).** Built 2026-10-25 (HANDOFF): `logic/graft-art.js` (a graft is
`{ slot: donor species }`, swapped bone kind for bone kind), the runtime bake in skeleton-rig.js, the debug buttons
and the debug log's `graphics.grafts`. Waiting on the phone's numbers for the exit.
 Compose a grafted Billie at runtime: bake its sheet and rig from its
species recipe with one bone's part swapped (`kitBakeWhole`, `rigRefit`), cache it per build, and draw it everywhere a
Billie shows (battle, grass, follower, menus). A debug button grafts a random Gene onto the lead. Measure the bake
time and memory on the owner's phone (debug log). Exit: a number the owner accepts, or the fallback: bake the wild
Grafts offline per biome pool and keep runtime baking for the Gene Bank preview only. Files: a new
`logic/graft-art.js`, `skeleton-rig.js`, `debug-*`. Could break: every Billie's drawing, so the pixel tests and
kit-bake-parity must not move for ungrafted Billies.

**SP-2 Rules.** Built 2026-10-25 on `claude/sp-2-rules`, on top of SP-1's branch (HANDOFF): `genes.json` (traits,
9 dominant types, Stability, Unstable; trait numbers placeholders), `logic/genes.js`, the saved `Billy.graft` (slot ->
Gene id "part@donor") and `Billy.unstable` (rolled once past the limit), donor weight, the dominant type, traits and
Unstable through `fxOfBillie`, `tools/test/sim/splice-sim.mjs`. The owner's answers: Prime +5 %, `aug` in SP-5.
Waiting on the owner: Gene moves.
 `genes.json` + schema, types and check-data (trait, move family and Stability cost per part kind; per
part an optional move and dominant type). Optional `graft` (slot -> Gene id) and `aug` (slot -> robot
`PartInstance`) on `Billy`, kept by the validators, dropped when unknown: no SAVE_VERSION bump. Donor weights in
`partsWeightRatio`, traits through the per-Billie effect path (generalized from RL-12c's `fxHeld`, or added if
RL-12c has not landed), the dominant type, Stability and Unstable. Unit tests, and the balance sim against Prime
(the result sets Prime's bonus with the owner). Depends on RL-12c's effect path, or builds it.

**SP-3 Wild splices.** Built 2026-10-25 on `claude/sp-3-wild-splices`, on top of SP-2's branch (HANDOFF): genes.json
`wild` (Graft 12 %, Chimera 2.5 %, DNA 5 / 12, all placeholders; `escaped` unused until SP-5), `genes.js wildSplice`
and `geneWords`, run places' stocks spliced from a `splice|visit` stream (Unstable rolled there too), the battle's
opening line, DNA (the fifth currency, banked at the win), `meta.genes` (Gene ids sampled), the Gene Sample sheet, the
run sim's counts, the debug buttons and the full test's step. Tax = the existing catch (no new choice). Waiting on
the owner: the odds, DNA's amounts.
 Graft, Chimera and Escaped-specimen rolls in `spawn` from the biome pool and the regional dex;
the battle intro line ("This Swiftlet has a shark's tail!"); Tax or Sample after a win; DNA in `currencies.json`
(banked when it drops, like Scrap); Gene Samples. The run sim learns the odds. Could break: wild battles, the run sim's
numbers, the run-start snapshots.

**SP-4 The Gene Bank.** Built 2026-10-26 on `claude/sp-4-gene-bank`, on top of SP-3's branch with main merged in
once (HANDOFF): genes.json `bank` (levels: limit 3/4/5, slots sig, + front, + back; a splice 5 + 5 x Stability DNA;
eggs keep a Gene at 0.5; all placeholders), buildings.json `genebank` and unlocks `genebank_2` (30 DNA), `genebank_3`
(80), the Bank on its Copperleaf plot (act `genebank`, the room's console), `logic/gene-bank.js`, the sheet
(`gene-bank-screen.js`), your Billies held to the Bank's limit (Unstable a stored fact; wild ones at the default),
eggs inheriting Genes, starter points (`run.points.perStability` 2), field parts (fins: Surf, `bear_arm`: Rock
Smash), the Studio's Genes section with a splice preview, the full test's step and debug buttons. Waiting on the
owner: the prices and levels.
 The building in Copperleaf (`buildings.json`, a model and a door), the Gene library and
sequencing, the splice screen with its preview (look, weight bar, stats, trait, move, type, Stability), undo, the
building's levels (Stability limit, which slots open: extras and sig first, then front and back), eggs inheriting
Genes (`breeding.js`), starter-point cost (+1 per 2 Stability spent), field moves counting a fitting part. The Studio's
Parts section gets the Gene fields and a splice preview. The in-game full test gets a step (sequence, splice, see it
in battle).

**SP-5 Augments.** After RL-14's salvage: the Workshop built, fitting arms and legs on Billies for Scrap, breaking in
battle and repair in towns, upgrades, the Augment art on the Billie's sockets, Escaped specimens wearing them
(genes.json `wild.escaped` is in the data since SP-3, unused; "more near the Bureau" needs a Bureau tag on places).
Depends on RL-14.

**SP-6 Run events.** The splice events in `events.json` (back-alley splicer, Bureau field lab, Gene auction, recall)
on RL-12b's event system, and relics that touch splicing.

**SP-7 Late unlocks.** Head splices (once species passives exist), resizing with a rare XL and recolouring, the
Seedling line, custom species in ghost teams and daily seeds (with RL-15; names filtered or built from name parts).

## Ask me before
- SP-1's exit: runtime baking or the offline fallback, from the measured numbers.
- Prime's bonus after SP-2's sim.
- The trait list and numbers, the dominant Genes, the DNA prices and the Gene Bank's levels (all placeholders).
- SP-3: the wild splice odds (Graft 12 %, Chimera 2.5 %), the DNA a Graft and a Chimera pay (5, 12), and whether DNA
  has other sources; Tax as the existing catch.
- The Gene Bank's look and where it stands in Copperleaf. (SP-4, the owner's go on its plan: HB-5's lab-vault on HB-4b's
  `genebank` plot.)
- The Seedling line's names and art.

## Done when
SP-1..SP-6 merged into main, SP-7 planned with its dependencies (species passives, RL-15), the quick check green,
tag `splicing-done`.

# Reflavour track (RF) - less finance, more Pokémon

Branch: track/reflavour

The owner's brief (2026-10-23): "overall a lot less finance focused and more like Pokémon". The Billies are the one
finance thing that stays: they are the messed-up clones of billionaires, treated like Pokémon. Everything around them
(catching, items, currencies, relics, tiers, battle words, the organization, the story's jokes) moves off finance.
This file is the plan (planning only; nothing built). Sessions follow CLAUDE.md: Plan Mode first, one rename per
commit, never a rename mixed with a behaviour change, the test tiers of docs/TESTING.md after every change, a HANDOFF
entry and a tag `rf-N-done`. This file says which player-facing words change, as CLAUDE.md's ground rule asks.
Numbers below were read at 2361848; verify again before each session.

## 1. The owner's answers (2026-10-23)

| Topic | Answer |
|---|---|
| The Billies | **Stay**: the messed-up clones of billionaires, made by the billionaires' own vanity cloning projects gone wrong and dumped in the Hollow Earth. Treated like Pokémon (caught, raised, evolved, battled). The only finance-flavoured thing left |
| Their moves | **Stay** (Hot Take, Pipeline...): the clones' personality |
| Type passives | **Change** to Pokémon-like names and ideas (`ramp`, `subsidy`, `landlord`, `pivot`, `volatile`, `synergy`, `inherit`, `sharp`) |
| Catching | **Pyramids**, thrown like Poké Balls; no "tax" wording anywhere |
| Tone | **Satire, other targets**: bureaucracy and corporations, tech and influencer culture, RPG and Pokémon clichés, celebrity and clone ethics |
| The run's relics | **Perks** (was Loopholes) |
| Difficulty tiers | **Expeditions I-V** (was Brackets), each a story chapter (roguelite-track.md 9.2) |
| Currencies | **Moneys** (run money, "1 Money", a silly plural on purpose; the owner, RF-1, 2026-10-23: was Coins), shown as the game's coin icon, **Research** (was Capital, spent at the Lab), **Scrap** (stays), **Crests** (was Audit Seals, from bosses, for the airship), and a fifth, **Beans** (gifts for hub characters, rare finds on runs; roguelite-track 9.6, 29) |
| The organization | **A secret bureaucratic agency** (names in 4) |
| Status ids | **Renamed internally** (`aud`, `sub`, `scn`; the player already sees Paralyzed, Asleep, Burned) |
| The game's name | **Pocket B&B²** with the ² drawn as a small raised **B** (the owner, 2026-10-23): "Pocket B&B" and a superscript B in the logo |
| The organization's name | **The Bureau of Lost, Found and Beans** (the owner, 2026-10-23) |
| The capsules | **Pyramids** (the owner, 2026-10-23): thrown to catch a Billie |

## 2. What carries finance today (verified at 2361848, game/js and game/data, gamedata.js excluded)

- **Catching:** "tax" in 34 files, 89 times, mostly catching ("Taxed.", "Critical tax!", "Flick a coin at a tired
  Billie to tax it", the haptics and settings lines). The catch items are coins (`coins.json`: `penny` Copper Coin,
  `silver`, `gold`, `tbtf` Platinum Coin "never fails"; "tax odds" in their text), the coin flick and its art.
- **Currencies:** `currencies.json` `money` "$", `capital` "Capital" (56 mentions in 23 files), `scrap`, `seals`
  "Audit Seals" (14 in 11).
- **Relics:** "Loophole" 123 times in 31 files; the ten Perks' names (Offshore Account, Tax Shelter, Lobbyist, Fine
  Print, Insider Tip, Hostile Takeover, Hedge Fund, Severance Package, Stock Options, Write-off); the item id
  `loophole` is the Hi-Potion.
- **Tiers:** "Bracket" 18 times in 11 files (rules.json `run.home`/`run.pack` by Bracket, the mast's "Start a run
  (Bracket I)").
- **Items:** names on screen are already Pokémon-like (Potion, Revive...); the ids are finance (`taxbreak`,
  `loophole`, `apology`, `settlement`, `appeal`, `bailout`, `parachute`, `spillkit`).
- **Battle:** the bribe after a failed catch (3 files); type passives in `types.json`; status ids.
- **Words around the game:** "IPO"/"stock" (45 in 14 files, some are the shop's stock and stay), the leaders' old
  badge texts (legacy), the ledger tab id (`ledger`, shown as Guide), story and lore lines, Professor Chosen's tables,
  Hazel's lines, signs, the Billies' Index text where it talks about money rather than the clone.
- **Names that stay:** the Billies' species names, lines, moves, bios; "Scrap"; the shop's "stock" (wares).

## 3. Sessions

| # | Session | Goal | Depends on | Sessions |
|---|---|---|---|---|
| RF-1 | Words players see (**done 2026-10-23**, HANDOFF) | every player-facing finance word in 2 changed: catching ("catch"), currencies (Moneys, Research, Crests), Perks, Expeditions, the bribe line, settings and haptics text; data text only, ids untouched | none | 1 |
| RF-2 | Pyramids | `coins.json`'s four coins become pyramids (names, text, icons, a low-poly pyramid for the throw, its tumble and landing, the sound); catch odds unchanged; the never-fail one stays a boss/badge reward | RF-1 | 1 |
| RF-3 | Type passives (**done 2026-10-23**, section 6) | the nine passives get Pokémon-like names and, where the idea was finance (`landlord`, `subsidy`, `inherit`), a new effect; the golden battle record remade on purpose for the changed ones | RF-1 | 1 |
| RF-4 | Internal renames (**done 2026-10-23**, section 7) | one rename per commit: `relics` → `perks` (data section, `run.relics`, `logic/relics.js`, `relic-screen.js`), `capital` → `research`, `seals` → `crests`, `brackets`/Bracket keys → `expeditions`, status ids, item ids, coin ids → pyramid ids, `ledger` tab id, the passive ids and their rule keys (6: `ramp`, `subsidy`, `sharp`, `landlord`, `pivot`, `volatile`, `synergy`, `inherit`; `financeRamp*`, `mediaCrit`, `cryptoRoll*`, `retailSynergy`, `rentFraction`, the stones' `fx.rent`/`sides.rent` and the move ids `renthike`/`eviction`); `npm run modules` and check:modules after each; SAVE_VERSION bumped once (old saves set aside, as CLAUDE.md allows) | RF-1..RF-3 | 2 |
| RF-5 | The new tone in text | story.json, Chosen's and Hazel's tables, signs, lore, the opening, the Index text, the leaders' lines: satire moved onto bureaucracy, tech and influencers, RPG clichés and clone ethics; the clones' origin (billionaires' vanity cloning projects) written into the Index and lore; Claude drafts, the owner approves | RF-1 | 1-2 |
| RF-6 | The game's name | **Pocket B&B²** (the raised B) in the title screen's logo, page titles, manifest, README, the changelog; storage keys untouched (or moved with a set-aside) | RF-1 | 1 |

**Order with the roguelite track:** RF-1 and RF-2 before RO-1 (so new content is written in the new words), RF-3
before RL-12b (encounters lean on passives), RF-4 before RL-S1 (the story director's data uses the new ids), RF-5
beside RL-S1 (the same writing pass), RF-6 whenever the owner picks.

**In parallel** (the owner, 2026-10-23): rounds in roguelite-track.md 9.7: RF-1..RF-3 together in round 2, RF-4 alone
in round 3, RF-5 in round 4, RF-6 in round 5.

**Could break:** every check that reads a player-facing string (check-fast, check-quick, the in-game test, story
checks: retarget in the same commit as the text), the debug log's words (CLAUDE.md: don't break the exported log;
keep its keys, change only the text), the Studio's labels for these sections, the golden record (RF-3 only).

## 4. Names (decided by the owner, 2026-10-23)

**The game: Pocket B&B².** The ² is a small raised capital **B**, not a 2: the logo reads "Pocket B&B" with a
superscript B. Where text can't raise a letter (page titles, the manifest, file names, the debug log) it needs a plain
form: "Pocket B&Bᴮ" (5.1).

**The organization: the Bureau of Lost, Found and Beans.** Secret and bureaucratic (nothing from Control or the SCP
Foundation). It files everything that falls through a portal, you included, as "lost", and "returns" it to the drop
point, Copperleaf, which is why a lost run ends there; Professor Chosen takes the credit. Nobody inside will say what
the Beans are. The clones are the billionaires' doing; the Bureau contains and studies them, and the bots are its
"retrieval units" (roguelite-track.md 9.2).

**The capsules: pyramids.** Thrown at a tired Billie; it tumbles, lands point up and seals. Four tiers replace the four
coins. Names (5.3): **Pyramid** (was Copper Coin), **Step Pyramid** (Silver, 1.5×), **Gold Pyramid** (Gold, 2×),
**Capstone** (Platinum: never fails, from badges and bosses).

## 5. Ask me before

1. **The game's name in plain text:** answered 2026-10-23: **"Pocket B&Bᴮ"** (the Unicode modifier letter ᴮ) wherever
   a raised B can't be drawn; check it on the phone's fonts in RF-6.
2. **The Beans:** answered 2026-10-23: **a running joke, never explained.**
3. **The pyramids' names:** answered 2026-10-23: **4's drafts** (Pyramid, Step Pyramid, Gold Pyramid, Capstone), their
   text **plain for now** (no pyramid-scheme joke).
4. **The coins' symbol:** answered 2026-10-23: **the game's own small coin icon** beside the number, no text symbol.
   RF-1 (the owner): the run money is named **Moneys** ("1 Money"), not Coins; plain text says "120 Moneys".
5. **The failed-catch bribe:** answered: **cut** (RF-1 removes it with its text; catching works or it doesn't).
6. **The new passives:** answered: **Claude drafts nine** in RF-3's plan, the owner approves.
7. **SAVE_VERSION bump in RF-4:** answered: **yes**, old saves set aside, no migration.
8. **Storage keys** (`networth-save-v1`, `nw-opening-done`, the `-set-aside` slots): answered: **remove them**. RF-6
   moves to new keys named for the game and deletes the old ones on load (the saves are set aside by RF-4's bump
   anyway). The debug log and the account's cloud document keep working; the per-device "offer Skip" flag starts
   over once.
9. **RF-1's wording** (the owner, 2026-10-23): RF-1 changes the words only; the finance jokes in lore, story, talk
   and people's lines (Dividend the cow, "old money", "no refunds", Sterling Capital, the coin lore's body) wait for
   RF-5. The ten Perks: **Lucky Charm** (was Offshore Account), **Clinic Loyalty Card** (Tax Shelter), **Coupon Book**
   (Lobbyist), **Steady Hand** (Fine Print), **Running Shoes** (Insider Tip), **Power Gloves** (Hostile Takeover),
   **Bubble Wrap** (Hedge Fund), **Trail Snacks** (Severance Package), **Field Notebook** (Stock Options), **Lost
   Property Form** (Write-off). The title's tagline **"Gotta tax 'em all!" stays** (the one "tax" left, on purpose;
   RF-4 and RF-6 leave it). Research's icon is a lab flask. "First audit" is "First Crest". The Studio's labels use
   the new words too.

## 6. RF-3 as built (2026-10-23)

Checked against the code first: section 3's premise was half wrong. Only the passives' **ids** and rule keys were
finance; the effects were already Pokémon ideas (`subsidy` is a Leftovers heal, `landlord` immunity to sharp stones,
`inherit` a Baton Pass on fainting; only `volatile` kept a finance idea, crypto swings). They had Pokémon-like names
too, but only in the Studio's dropdown: the player never saw a passive's name. No passive had a test.

| Type | id (RF-4 renames) | Name | What it does | Against before |
|---|---|---|---|---|
| Fire | `ramp` | Kindling | Attack +10% a turn in, up to +100% | same |
| Water | `undertow` (new) | Undertow | its Water moves 1.3× at 1/3 HP or less (rules `undertowMult`, `undertowHp`) | new; Water had none |
| Grass | `subsidy` | Regrowth | 1/16 HP back each turn | same |
| Electric | `sharp` | Live Wire | one crit stage up | same |
| Ground | `landlord` | Bedrock | once a battle, a knockout hit from full HP leaves 1 HP; no stone damage | new effect added |
| Flying | `pivot` | Slipstream | first switch out of a battle costs no turn | same |
| Psychic | `volatile` | Wild Mind | damage 25%-160% instead of 85%-100% (same average) | same |
| Steel | `synergy` | Alloy | +10% per living Steel teammate | same |
| Dragon | `inherit` | Parting Roar | on fainting, the next in gets +1 Attack, +1 Sp. Atk | new effect (was: its own boosts, if any) |

Names and texts are data (`types.json` `passiveName`, `passiveText`), shown in the Guide's species page (Abilities)
and in the battle lines of Regrowth, Slipstream, Bedrock and Parting Roar. Strength (a seeded duel sweep, 1v1 and
3v3 at levels 10 and 25): no type's win rate moved more than 3 points; Bedrock barely shows even 4 levels down (one
more move rarely turns a loss).


## 7. RF-4 as built (2026-10-23)

44 commits on `track/reflavour` (with the docs), each a single rename, except the first and the Perk order (below): SAVE_VERSION 5 (old saves set aside, no
migration). The owner's answers to the plan: the money id stays `money`; `tier` becomes `expedition` now; the art folder
`art/coins/` keeps its name; `foreclose` goes with the stone moves.

- Where the plan was wrong (checked in the code): there were no Bracket keys. The difficulty was `tier` (`run.tier`,
  `meta.tier`, `runByTier`), and "Bracket" survived only in comments. Item ids `trailmix`, `pretzel`, `bell`, `repairkit`
  were never finance. The shop unlocks `shop_settlement`, `shop_bailout`,
  `shop_appeal` also embedded item ids (renamed with them). The rules held more finance keys than listed: `auditSkip`,
  `subpoena`, `luxuryPenny`, `winSeals`, the Kindling, Live Wire, Wild Mind and Alloy numbers, `rentFraction`.
- Renamed: `relics` → `perks` (files logic/perks.js, perk-screen.js, studio/js/perks-editor.js, the data section, the
  code names `relic*`, `RELICS`, `renderRelics`..., rules `run.perks`, `run.perks` in the save, the tab id); `capital` →
  `research` and `seals` → `crests` (currency ids, meta keys, payouts, grants, icons; rules `winCrests`); catch items
  `penny`, `silver`, `gold`, `tbtf` → `pyramid`, `step_pyramid`, `gold_pyramid`, `capstone` (and their art files), the
  section `coins` → `pyramids` (`PYRAMIDS`, `saveData.pyramids`, reward, start and pack counts), `coin*` code names →
  `pyramid*`, `MONEY_COIN` → `MONEY_ICON`, rules `luxuryPyramid`; the eight finance item ids → their names
  (`potion`, `hi_potion`, `burn_salve`, `nerve_tonic`, `wake_tea`, `revive`, `max_revive`, `full_remedy`); statuses
  `aud`, `sub`, `scn` → `par`, `slp`, `brn` (rules `paralysisSkip`, `asleepCatch`); the passives (section 6's ids) with
  their rule keys and battle-side fields (`slipstream`, `roar`, `stones`); the stone moves `scatterstones`,
  `quakestomp`, `bouldertoss`; `tier` → `expedition`; the `ledger` tab → `guide`; run-sim's `catchWhileBelow`,
  `pyramidsUpTo`, `perks` and its report's `perks`; the `taxed` local and check-quick's `name_caught_room_windows`.
- Kept on purpose: the title's tagline, the storage keys (RF-6), the debug log's keys (`relics`, `capital`, `seals`:
  they now read the renamed fields), URL parameters (`&relics=`) and fixture names, Studio section ids, CSS classes,
  data-a keys and DOM ids (`bcoins`, `#aimCoin`, `shoprelic`), UI icon names `relic` and `ledger`, the art folder
  `art/coins/`, the opening's `coins` and `throw-coins`, the singular `coin` key of a ware or seat and the `coin:`
  condition, the offer stream's name `relic|`.
- The ten Perk ids, at the owner's word after the first PR text: perkPool sorted the pool by id before the seeded
  draw (and the run sim broke ties by id), so a behaviour commit first makes both follow perks.json's order (every
  seed's offers change once, on purpose), then the ids are renamed alone: `lucky_charm`, `clinic_card`, `coupon_book`,
  `steady_hand`, `running_shoes`, `power_gloves`, `bubble_wrap`, `trail_snacks`, `field_notebook`, `lost_property`.
  Still finance, left: the stat ids `lev`, `lob`, `hus` and most move ids (the moves stay, section 1).
- One rename did change behaviour: runShopStock sorts a town's weighted wares by item id before its draw, so the item
  rename changed which wares a seed's run shop stocks. No test pinned it; SAVE_VERSION 5 means no saved run carries over.
  The owner accepted it (RF-4).

# Reflavour track (RF) - less finance, more Pokémon

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
| Catching | **Capsules**, thrown like Poké Balls; no "tax" wording anywhere |
| Tone | **Satire, other targets**: bureaucracy and corporations, tech and influencer culture, RPG and Pokémon clichés, celebrity and clone ethics |
| The run's relics | **Perks** (was Loopholes) |
| Difficulty tiers | **Expeditions I-V** (was Brackets), each a story chapter (roguelite-track.md 9.2) |
| Currencies | **Coins** (run money, its own symbol), **Research** (was Capital, spent at the Lab), **Scrap** (stays), **Crests** (was Audit Seals, from bosses, for the airship) |
| The organization | **A secret bureaucratic agency** (names in 4) |
| Status ids | **Renamed internally** (`aud`, `sub`, `scn`; the player already sees Paralyzed, Asleep, Burned) |
| The game's name | **Rename**: three options in 4, the owner picks |

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
| RF-1 | Words players see | every player-facing finance word in 2 changed: catching ("catch"), currencies (Coins, Research, Crests), Perks, Expeditions, the bribe line, settings and haptics text; data text only, ids untouched | none | 1 |
| RF-2 | Capsules | `coins.json`'s four coins become capsules (names, text, icons, the throw's art and sound); catch odds unchanged; the never-fail one stays a boss/badge reward | RF-1 | 1 |
| RF-3 | Type passives | the nine passives get Pokémon-like names and, where the idea was finance (`landlord`, `subsidy`, `inherit`), a new effect; the golden battle record remade on purpose for the changed ones | RF-1 | 1 |
| RF-4 | Internal renames | one rename per commit: `relics` → `perks` (data section, `run.relics`, `logic/relics.js`, `relic-screen.js`), `capital` → `research`, `seals` → `crests`, `brackets`/Bracket keys → `expeditions`, status ids, item ids, coin ids → capsule ids, `ledger` tab id; `npm run modules` and check:modules after each; SAVE_VERSION bumped once (old saves set aside, as CLAUDE.md allows) | RF-1..RF-3 | 2 |
| RF-5 | The new tone in text | story.json, Chosen's and Hazel's tables, signs, lore, the opening, the Index text, the leaders' lines: satire moved onto bureaucracy, tech and influencers, RPG clichés and clone ethics; the clones' origin (billionaires' vanity cloning projects) written into the Index and lore; Claude drafts, the owner approves | RF-1 | 1-2 |
| RF-6 | The game's name | the picked name in the title screen, page titles, manifest, README, the changelog; storage keys untouched (or moved with a set-aside) | the owner's pick | 1 |

**Order with the roguelite track:** RF-1 and RF-2 before RO-1 (so new content is written in the new words), RF-3
before RL-12b (encounters lean on passives), RF-4 before RL-S1 (the story director's data uses the new ids), RF-5
beside RL-S1 (the same writing pass), RF-6 whenever the owner picks.

**Could break:** every check that reads a player-facing string (check-fast, check-quick, the in-game test, story
checks: retarget in the same commit as the text), the debug log's words (CLAUDE.md: don't break the exported log;
keep its keys, change only the text), the Studio's labels for these sections, the golden record (RF-3 only).

## 4. Names for the owner (Claude's drafts; original)

**The game** (three directions):
1. **Hollow Pocket** (recommended): keeps "Pocket", names the setting.
2. **Billie Clones**: says what the creatures are.
3. **Expedition: Inner Sun**: the airship and the run.

**The agency** (secret, bureaucratic; nothing from Control or the SCP Foundation):
1. **The Bureau of Misplaced Persons** (recommended): it files everything that falls through a portal, you included,
   as misplaced, and "returns" you to the drop point, Copperleaf; Professor Chosen takes credit for it. Logo: a
   luggage tag with an eye. Terms: case numbers, forms in triplicate, "pending".
2. **The Department of Anomalous Returns.** Returns what doesn't belong; you keep coming back.
3. **The Office of Lost and Found.** A friendly name on a very unfriendly building.

The clones are the billionaires' doing; the agency contains and studies them, and the bots are its
"retrieval units" (roguelite-track.md 9.2).

**The capsules:** Pod / Sturdy Pod / Prime Pod / Sure Pod (recommended) / Clone Jars (Jar, Big Jar, ...) / plain
Capsules.

## 5. Ask me before

1. **The game's name:** 4's option 1 / 2 / 3 / your own.
2. **The agency's name:** 4's option 1 / 2 / 3 / your own.
3. **The capsules' names:** Pods (recommended) / Clone Jars / Capsules.
4. **The coins' symbol:** the ruble sign ₽ is a real currency sign (it's what "₽-style" would print), and Pokémon's
   own sign is a custom glyph. Recommended: a small coin icon of the game's own beside the number, no text symbol /
   "c" after the number / ₽ anyway.
5. **The failed-catch bribe:** cut (recommended; catching is plain) / kept as "it drops some coins".
6. **The new passives' ideas:** Claude drafts nine in RF-3's plan (recommended) / the owner writes them.
7. **SAVE_VERSION bump in RF-4:** sets every save aside again (recommended: yes, with no migration, as CLAUDE.md
   allows) / a one-off key migration.
8. **Storage keys** (`networth-save-v1`, `nw-opening-done`) with the new name: leave (recommended; players never see
   them) / move with a set-aside.

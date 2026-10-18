# Phase 16 - Billies rework (design first, prototype before scaling)

## Goal
Rework the Billies into a smaller, sharper system: each species is a parody billionaire built on a real animal and body plan, made of body parts that come in sizes. Size changes weight, and weight trades speed for attack. A Billie wearing all of its own fitting parts is a **Prime Billie**. Mixed parts give abominations (task 9). Phase 13's breeding unit tests and simulation must exist before the full build. Robots stay a separate system (phase 17).

Items marked (ASK) are open questions; the full list is at the end. Everything else is a proposal I can change.

## Verify first
- 117 species in 58 lines (`game/data/roster.json`, `game/data/lines/*.json`). Every line already has a `parody`, per-stage height (`ht`) and weight (`wt`), stat profile (`prof`), learnset, bio and notes.
- Art: piece sheets in `game/art/next/billionaires/` (normal and `_gold`), rigs in `game/art/next/rigs-next.js`. Body plans in use: quad 55, bird 17, biped 14, insect 8, fish 4, serpent 4, hopper 4, crab 3, plant 3, blob 2, shell 2, flyer 1. The Studio skeleton builder also has blank bodies for every plan (`studio/js/skeleton.js`, `BODY_TEMPLATES`), including `octo`.
- Pieces are already separate bones (head, torso, legs, tail, wings, extras), so part swaps and part sizes can be done on the existing rig, without new art pipelines.

## 1. Prototype roster: 7 lines

Starters keep their split final stage. Names are parodies; the `parody` field is internal only, never shown in game (ASK 1.3).

| # | Line | Parody | Animal / body plan | Type | Stages | Weight class | Art |
|---|------|--------|--------------------|------|--------|--------------|-----|
| 1 | Emberox → Boostox → Marsox / Memeox | Elon Musk | muskox, quad | Fire (→ Fire/Dragon or Fire/Psychic) | 3, split | medium → heavy | **existing, all 4** |
| 2 | Cartotter → Primotter → Orbitotter / Everyotter | Jeff Bezos | otter, biped | Water (→ Water/Flying or Water/Steel) | 3, split | light → medium | **existing, all 4** |
| 3 | Kidling → Billgoat → Windowgoat / Harvestgoat | Bill Gates | goat, quad | Grass (→ Grass/Electric or Grass/Ground) | 3, split | light → medium | **existing, all 4** |
| 4 | Swiftlet → Versewift → Erastar | Taylor Swift | swift (the bird), bird | Flying/Psychic | 3 | featherweight | placeholder (jay line recolour) |
| 5 | Kontourlet → Filterleon → Kardashleon | Kim Kardashian | chameleon, quad (lizard) | Psychic → Psychic/Steel | 3 | light | placeholder (gecko line recolour) |
| 6 | Tycalf → Towerphant → Tremendophant | Donald Trump | elephant, quad | Ground → Ground/Steel | 3 | super-heavy | placeholder (elephant line recolour) |
| 7 | Facelet → Feedopus → Metapus | Mark Zuckerberg (ASK 1.2) | octopus, octo | Electric → Electric/Water | 3 | medium | placeholder (Studio blank `octo`) |

Why these seven: three starters with finished art, four new faces you named (plus one open slot), seven different weight classes from featherweight to super-heavy, and all nine types are touched except Dragon, which stays on the starter splits.

Satire rule (proposal): jokes target the persona, brand and business (towers, eras, filters, launches, metaverse), never looks, bodies, family or real politics. Same rule as the existing 58 lines.

### Starter split evolutions (unchanged, now tied to parts)
The split happens at level 32 as today. New: which branch you get depends on the **signature part** the Billie is wearing at that moment (proposal), so a player steers the split by choosing parts, instead of a hidden roll. Example: Boostox with large boosters becomes Marsox; with the phone-horn it becomes Memeox. (ASK 2.3)

## 2. Body parts

### Slots
Every Billie has 5 part slots, mapped onto existing rig bones:

| Slot | Quad | Biped | Bird | Octo |
|------|------|-------|------|------|
| Head | head | head | head | head (mantle) |
| Body | torso | torso | torso | torso |
| Front | front legs | arms | wings | front 3 tentacles |
| Back | back legs | legs | legs | back 3 tentacles |
| Signature | tail or extra (spark, mound, plume) | tail or held item | tail or crest | ink sac / extra |

The **signature** slot is the species' gimmick part: Musk's sparking tail/boosters, Bezos's parcel/rocket, Gates's leaf/window, Swift's tail fan (microphone crest), Kim's ring-light crest, Trump's gold tower howdah, Zuck's VR visor.

### Sizes
Each part comes in **S, M or L** (ASK 2.1 whether XL exists). Size is drawn by scaling the piece around its pivot (S 85%, M 100%, L 120%), so no extra art is needed for the prototype.

### Weight, speed and attack
Weight is already in the data per stage (`wt`). New: each slot carries a share of the body's weight and each size multiplies its share.

- Slot weight share: Body 40%, Head 15%, Front 15%, Back 15%, Signature 15%.
- Size multiplier on that share: S ×0.75, M ×1.0, L ×1.35.
- Billie weight = species stage weight × Σ(share × size multiplier). All M = exactly the species weight.
- Weight ratio `w` = Billie weight / species stage weight (range about 0.75 to 1.35).
- Attack and Sp. Atk × `w^0.5`, Speed × `w^-0.6`. Cap each at ±20%.

Worked example, Tremendophant with L body, L head, L signature, M legs: w ≈ 1.25 → Attack +12%, Speed −12%. The same Billie all S: w = 0.75 → Attack −13%, Speed +19%.

Further proposed weight effects (ASK 2.2, pick any):
- Heavy Billies resist knockback-type and "push" moves; light ones dodge more.
- Some moves scale with weight (a body slam that hits harder when heavier, a "Low Kick"-style move that hits heavier targets harder).
- Light Billies can be carried on the trainer's shoulder in the overworld; heavy ones walk behind.

### Fitting parts and Prime Billies
Every species has its own **fitting set**: one native part per slot, in its native size (the size drawn in its art). A Billie wearing all five native parts in native size is a **Prime Billie**.

Prime bonus (proposal):
- +10% to all stats, applied after the weight change.
- Unlocks the species' **Prime move** (one per line, see section 3).
- A visual tell: a thin gold rim-light pass on the sheet (reuse the `_gold` rebuild at low strength) and a "Prime" tag on the summary screen.

Non-native parts or sizes are allowed; they just don't count towards Prime. Parts from distant species or body plans give abominations (task 9). (ASK 2.4, 2.5)

### Where parts come from
Wild Billies drop or carry parts, breeding passes parts on, trainers give them as rewards, and the ranch can resize a part over time (ASK 2.6). Prototype: parts come only from the 7 lines.

## 3. Moves, advantages and disadvantages

Each Billie has **4 move slots**: 2 species moves from its learnset, 1 move from its head or signature part, and 1 free slot. The Prime move replaces the part move when Prime. Existing moves in `moves.json` are reused where they fit.

| Line | Strength (passive) | Weakness (quirk) | Signature move ideas | Prime move |
|------|--------------------|------------------|----------------------|------------|
| Musk / muskox | **Launch window**: first move each battle is +1 priority | **Delays**: 15% chance a charged move slips to next turn | `liftoff`, `post3am`, `launch` | Rapid Unscheduled Disassembly: huge damage, Billie loses its signature part's bonus for the battle |
| Bezos / otter | **Two-day delivery**: a delayed move that lands in 2 turns and can't miss | **Thin margins**: healing items are 20% weaker on it | `twoday`, `flashsale`, `shipdirect` | Same-Day: the delayed move lands this turn |
| Gates / goat | **Patch Tuesday**: removes one status every 3rd turn | **Blue screen**: rare 1-turn freeze when holding 3+ status effects | `harvest`, `rollback`, `developers` | Ctrl-Alt-Delete: resets both sides' stat changes |
| Swift / swift | **Fan base**: each ally that fainted raises its Sp. Atk | **Feud**: takes 25% more damage from a Billie that hit it last turn (it remembers) | `rerecord` (copies its last-used move as a stronger "version"), `insync` | The Eras: cycles through 3 move "eras" with different types each turn |
| Kardashian / chameleon | **Filter**: changes its type to resist the last move that hit it | **Bad lighting**: loses Filter for 2 turns after a critical hit | `rebrand`, `exclusive`, `headline` | Break the Internet: confuses every opponent, boosts own Speed |
| Trump / elephant | **Branding**: puts its name on the field; allies get +Defense | **Tremendous**: very slow, and misses more when angry (after being hit twice) | `towerdrop`, `zoning`, `renthike` | Grand Opening: summons a gold tower that blocks one hit for the team |
| Zuckerberg / octopus | **Data harvest**: sees the opponent's next move 1 turn in 3 | **Pivot**: 10% chance it switches strategy (random own move) | `stakeineverything`, `autoplay`, new: Poke, Feed Scroll | Metaverse: moves the battle to a virtual field where Electric moves gain power |

Type advantages stay on the existing chart (`game/data/types.json`). Weight adds a second axis: heavy beats bulky walls, light beats slow heavies by moving first.

## 4. Art: reuse and placeholders

### Reuse as is
- All 12 starter sheets (`emberox` … `harvestgoat`), normal and gold, with rigs. Only new work: part-size scaling (code) and Prime rim-light (existing gold tool at low strength).

### Placeholders made in this phase
`tools/build-rework-placeholders.py` recolours an existing sheet with the same body plan, keeps outlines, eyes and highlights, and copies the piece map, so the existing rig works unchanged. Files are in `game/art/next/placeholders/`. Nothing in the game loads them yet.

| New Billie | Placeholder from | Recolour | Final art needs |
|------------|------------------|----------|-----------------|
| Swiftlet | jaylet | violet | swift silhouette: forked tail, slim crescent wings |
| Versewift | hovajay | violet | sparkly tail fan, microphone crest |
| Erastar | hovajay | magenta | stage-3 size, era-coloured feathers |
| Kontourlet | siliclet | warm beige | chameleon curled tail, turret eyes |
| Filterleon | jenzard | rose | ring-light crest, colour-shift scales |
| Kardashleon | gigajenzard | rose | larger frame, gem scales, phone-tail |
| Tycalf | tuskling | orange-tan | golden tuft of hair, tie for a trunk tip |
| Towerphant | reliancephant | amber | golf-flag tusks, gold blanket |
| Tremendophant | antiliaphant_gold | gold | gold tower howdah (keep the helipad gag) |
| Facelet / Feedopus / Metapus | none (no octo art yet) | — | make in the Studio from the blank `octo` body; all new art |

### Old art that becomes free for parts and abominations
The other 51 lines are cut from the prototype but their sheets stay. Proposal: their pieces become a **part library** for abominations and later species (wings from birds, horns from quads, claws from crabs), so nothing drawn is wasted. (ASK 4.2)

## 5. Prototype scope (replaces old task 8)
1. The 7 lines above in data, with parts, sizes, weight math and Prime check.
2. Part swap and size on the summary screen (debug UI is fine).
3. Battle uses weight-adjusted stats, the 7 passives and quirks, and the 7 Prime moves.
4. One breed function and one abomination (for example Kardashleon × Tremendophant).
5. Unit tests for the weight formula, the caps and the Prime check; a quick simulation of all-S vs all-L builds for each line.
6. Studio: part list per species with native size and weight shares.

Stop and show me the result before scaling.

## 6. Later (after the prototype is approved)
These are the original phase 16 tasks, kept:
7. Grow to about 30-40 species, reusing old sheets (ASK 4.1).
8. Breeding at the ranch (phase 12). (ASK 5.1)
9. Abominations: crossing distant species or body plans gives chimeras with a satirical merger-style name (for example "Cartokid Holdings"), a stat spike and a drawback (it taxes itself, files for bankruptcy mid-battle, hedges instead of attacking). Rare, capped weirdness, readable function (wings mean flying, horns mean attack), capped stat variance.
10. Encounters (phase 08) produce Billies with varied parts, sizes, rarities and quirks within the caps.
11. Trading parts, Billies and abominations with friends (phase 18).
12. Full Studio section for part libraries and breeding rules.

## Ask me before
The 7-line roster; the weight formula and caps; the Prime bonus; how the split is chosen; the prototype result before scaling up.

## Open questions (ASK)

**1. Roster**
1.1 Are these the right 7, and do the three starters stay Musk, Bezos and Gates?
1.2 Slot 7: Zuckerberg as an octopus, or someone else (Oprah, Beyoncé, Jay-Z, LeBron, Rihanna, Jensen Huang)? LeBron and Jensen Huang already have full art.
1.3 How close to the real person can parodies go: names only as puns (current style), or recognisable looks (hair, outfits)? Any figures you want to avoid?
1.4 Trump as an elephant: fine, or too close to a party symbol? Alternatives: a golden bull, a blustery pufferfish, a gilded peacock.
1.5 Are the names (Swiftlet, Kontourlet, Tycalf, Facelet and evolutions) OK, or do you want to name them?

**2. Parts and Prime**
2.1 Three sizes (S, M, L), or add XL for rare drops?
2.2 Which extra weight effects do you want (knockback resistance, weight-based moves, shoulder carry)?
2.3 Should the starter split be chosen by the signature part (my proposal), by level only, or by player choice?
2.4 Does Prime need the native size too, or only the native parts at any size?
2.5 Is Prime +10% all stats plus a Prime move right, or should Prime be cosmetic plus move only?
2.6 Can parts be resized or upgraded after you get them (ranch, items), or is the size fixed on the part?
2.7 Do parts carry through evolution, grow with it, or get replaced by the next stage's native parts?
2.8 Can a part be lost in battle (like robots in phase 17), or only swapped outside battle? Keeping them different from robots is my recommendation.

**3. Moves and battle**
3.1 Is 4 move slots (2 species, 1 part, 1 free) right?
3.2 Are the passives and quirks above the right tone, or should they be more or less mechanical?
3.3 Does weight show as a number to the player, or only as a bar or class (Feather, Light, Medium, Heavy, Super-heavy)?

**4. Art**
4.1 Are you OK with the cut 51 lines becoming a part library, or do you want some kept as full species?
4.2 Final art for the 4 new lines: drawn by you, made by me in the Studio, or generated and cleaned up?
4.3 Should part sizes be scaled pieces (free) or hand-drawn S/M/L pieces (better looking, 3x the work)?

**5. Breeding**
5.1 Deliberate (pick parents), partly random (ranch surprises), or both? I recommend both: you pick parents, the ranch picks which parts and sizes are passed on, with a small chance of a mutation.

## Done when
Prototype approved, then the full system built, simulation tests within bounds, Studio section in place, tag `phase-16-done`.

## First reply
Same four items as phase 01, plus answers to any open questions above that are still open.

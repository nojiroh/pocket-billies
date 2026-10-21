# Phase 16 - Billies rework (design first, prototype before scaling)

## Goal
Rework the Billies into a smaller, sharper system: each species is a parody billionaire built on a real animal and body plan, made of body parts that come in sizes. Size changes weight, and weight trades speed for attack. A Billie wearing all of its own fitting parts is a **Prime Billie**. Mixed parts give abominations (task 9). The breeding simulation is written at the start of this phase against the prototype, on phase 13's harness (tools/test/sim), with bounds agreed before the full build (decided in phase 13a). Robots stay a separate system (phase 17).

Items marked (ASK) are open questions; the full list is at the end, after the decisions already made. Everything else is a proposal I can change.

## Verify first
- 117 species in 58 lines (`game/data/roster.json`, `game/data/lines/*.json`). Every line already has a `parody`, per-stage height (`ht`) and weight (`wt`), stat profile (`prof`), learnset, bio and notes.
- Art: piece sheets in `game/art/next/billionaires/` (normal and `_gold`), rigs in `game/art/next/rigs-next.js`. Body plans in use: quad 55, bird 17, biped 14, insect 8, fish 4, serpent 4, hopper 4, crab 3, plant 3, blob 2, shell 2, flyer 1. The Studio skeleton builder also has blank bodies for every plan (`studio/js/skeleton.js`, `BODY_TEMPLATES`), including `octo`.
- Pieces are already separate bones (head, torso, legs, tail, wings, extras), so part swaps and part sizes can be done on the existing rig, without new art pipelines.

## 1. Prototype roster: 7 lines

Starters keep their split final stage. Names are parodies; the `parody` field is internal only, never shown in game.

| # | Line | Parody | Animal / body plan | Type | Stages | Weight class | Art |
|---|------|--------|--------------------|------|--------|--------------|-----|
| 1 | Emberox → Boostox → Marsox / Memeox | Elon Musk | muskox, quad | Fire (→ Fire/Dragon or Fire/Psychic) | 3, split | medium → heavy | **existing, all 4** |
| 2 | Cartotter → Primotter → Orbitotter / Everyotter | Jeff Bezos | otter, biped | Water (→ Water/Flying or Water/Steel) | 3, split | light → medium | **existing, all 4** |
| 3 | Kidling → Billgoat → Windowgoat / Harvestgoat | Bill Gates | goat, quad | Grass (→ Grass/Electric or Grass/Ground) | 3, split | light → medium | **existing, all 4** |
| 4 | Swiftlet → Versewift → Erastar | Taylor Swift | swift (the bird), bird | Flying/Psychic | 3 | featherweight | placeholder: jay line recolour, jay rig |
| 5 | Kontourlet → Filterleon → Kardashleon | Kim Kardashian | chameleon, quad | Psychic → Psychic/Steel | 3 | light | placeholder: gecko line recolour, gecko rig |
| 6 | Gildlet → Gildslug → Tremendoslug | Donald Trump | giant slug, blob (Jabba-style: huge body, tiny arms, slug tail) | Ground → Ground/Steel | 3 | super-heavy | placeholder: built from the part kit (big bear body, small arms, reptile tail as the slug tail, mane as the golden crest) |
| 7 | Facelet → Feedopus → Metapus | Mark Zuckerberg | octopus, octo | Electric → Electric/Water | 3 | medium | placeholder: built from the fish kit until octopus parts exist |

Why these seven: three starters with finished art, four new faces you named (plus one open slot), seven different weight classes from featherweight to super-heavy, and all nine types are touched except Dragon, which stays on the starter splits.

### Look rule (decided)
- They are animals: **no clothing at all**. No hats, sweaters, jackets, ties or blankets.
- Each one has the person's **recognisable features, drawn as animal features**: hair becomes a crest, mane, fringe or fur swoop; skin tone becomes the hide or feather colour; a signature expression or pose stays.
- Jokes target the persona, brand and business (launches, eras, filters, towers, the metaverse). Avoid family, health and real-world politics.

| Line | Recognisable features (no clothing) |
|------|-------------------------------------|
| Swift | blonde feather fringe across the brow, red beak tip, big sparkling eyes, a crest shaped like a microphone |
| Kardashian | long sleek dark crest down the back, contour-shaded scales, a glowing ring-shaped crest, a pout |
| Trump | golden swept-over fur crest, orange-tan hide, a smug half-closed squint, a gold-flecked belly |
| Zuckerberg | short curly fur crest, pale skin, wide unblinking eyes, a visor-shaped brow ridge |

Existing starter art that breaks the rule: **Kidling** loses its sweater and **Orbitotter** its cowboy hat (decided). Whether gear counts too (Musk's boosters, Bezos's boxes, Harvestgoat's tractor-tyre collar) is still open (ASK 1.6).

### Starter split evolutions (decided: the body decides)
The split happens at level 32 as today. Which branch you get depends on the **body part** the Billie has at that moment (decided):
- **L body → heavy branch**: Marsox (lander), Everyotter (warehouse), Harvestgoat (owns the field).
- **S body → light branch**: Memeox (floats on posts), Orbitotter (rocket), Windowgoat (startup chime).
- **M body → the player picks** at evolution, so a Prime-ready Billie never loses its Prime status by evolving.

## 2. Body parts

### Slots
Every Billie has 5 part slots, mapped onto existing rig bones:

| Slot | Quad | Biped | Bird | Octo |
|------|------|-------|------|------|
| Head | head | head | head | head (mantle) |
| Body | torso | torso | torso | torso |
| Front | front legs | arms | wings | front 3 tentacles |
| Back | back legs | legs | legs | back 3 tentacles |
| Signature | tail or extra (spark, mound, plume) | tail or held item | tail or crest | brow ridge / ink sac |

Blob (Trump line): Head = head, Body = the big body, Front = tiny arms, Back = slug tail, Signature = golden fur crest. The Studio's blank `blob` has only a head and two arms, so the placeholder adds a body and a tail piece.

The **signature** slot is the species' gimmick part: Musk's sparking tail/boosters, Bezos's parcel/rocket, Gates's leaf/window, Swift's microphone crest, Kim's ring-shaped crest, Trump's golden fur crest, Zuck's visor brow ridge.

### Sizes
Each part comes in **S, M or L** (ASK 2.1 whether XL exists). M is the normal size, the one drawn in the art. Size is drawn by scaling the piece around its pivot (S 85%, M 100%, L 120%), so no extra art is needed (decided for the prototype; hand-drawn sizes can come later). A part's size is fixed for now; resizing parts may come later in the game.

### Weight, speed and attack
Weight is already in the data per stage (`wt`). New: each slot carries a share of the body's weight and each size multiplies its share.

- Slot weight share: Body 40%, Head 15%, Front 15%, Back 15%, Signature 15%.
- Size multiplier on that share: S ×0.75, M ×1.0, L ×1.35.
- Billie weight = species stage weight × Σ(share × size multiplier). All M = exactly the species weight.
- Weight ratio `w` = Billie weight / species stage weight (range about 0.75 to 1.35).
- Attack and Sp. Atk × `w^0.5`, Speed × `w^-0.6`. Cap each at ±20%.

Worked example, Tremendoslug with L body, L head, L signature, M arms and tail: w ≈ 1.25 → Attack +12%, Speed −12%. The same Billie all S: w = 0.75 → Attack −13%, Speed +19%.

Further proposed weight effects (ASK 2.2, pick any):
- Heavy Billies resist knockback-type and "push" moves; light ones dodge more.
- Some moves scale with weight (a body slam that hits harder when heavier, a "Low Kick"-style move that hits heavier targets harder).
- Light Billies can be carried on the trainer's shoulder in the overworld; heavy ones walk behind.

### Fitting parts and Prime Billies
Every species has its own **fitting set**: one native part per slot. A Billie wearing all five native parts, **all at normal size (M)**, is a **Prime Billie** (decided). A Prime Billie therefore always has exactly its species weight.

Prime bonus (proposal):
- +10% to all stats, applied after the weight change.
- Unlocks the species' **Prime move** (one per line, see section 3).
- A visual tell: a thin gold rim-light pass on the sheet (reuse the `_gold` rebuild at low strength) and a "Prime" tag on the summary screen.

Non-native parts or S/L sizes are allowed; they just don't count towards Prime. Parts from distant species or body plans give abominations (task 9). (ASK 2.5)

### Where parts come from
Wild Billies drop or carry parts, breeding passes parts on, and trainers give them as rewards. Prototype: parts come only from the 7 lines, plus the part library (section 4).

## 3. Moves, advantages and disadvantages

Each Billie has **4 move slots**: 2 species moves from its learnset, 1 move from its head or signature part, and 1 free slot. The Prime move replaces the part move when Prime. Existing moves in `moves.json` are reused where they fit.

| Line | Strength (passive) | Weakness (quirk) | Signature move ideas | Prime move |
|------|--------------------|------------------|----------------------|------------|
| Musk / muskox | **Launch window**: first move each battle is +1 priority | **Delays**: 15% chance a charged move slips to next turn | `liftoff`, `post3am`, `launch` | Rapid Unscheduled Disassembly: huge damage, Billie loses its signature part's bonus for the battle |
| Bezos / otter | **Two-day delivery**: a delayed move that lands in 2 turns and can't miss | **Thin margins**: healing items are 20% weaker on it | `twoday`, `flashsale`, `shipdirect` | Same-Day: the delayed move lands this turn |
| Gates / goat | **Patch Tuesday**: removes one status every 3rd turn | **Blue screen**: rare 1-turn freeze when holding 3+ status effects | `harvest`, `rollback`, `developers` | Ctrl-Alt-Delete: resets both sides' stat changes |
| Swift / swift | **Fan base**: each ally that fainted raises its Sp. Atk | **Feud**: takes 25% more damage from a Billie that hit it last turn (it remembers) | `rerecord` (copies its last-used move as a stronger "version"), `insync` | The Eras: cycles through 3 move "eras" with different types each turn |
| Kardashian / chameleon | **Filter**: changes its type to resist the last move that hit it | **Bad lighting**: loses Filter for 2 turns after a critical hit | `rebrand`, `exclusive`, `headline` | Break the Internet: confuses every opponent, boosts own Speed |
| Trump / slug | **Branding**: puts its name on the field; allies get +Defense | **Tremendous**: very slow, and misses more when angry (after being hit twice); can't be pushed or switched out by moves | `towerdrop`, `zoning`, `renthike` | Grand Opening: summons a gold tower that blocks one hit for the team |
| Zuckerberg / octopus | **Data harvest**: sees the opponent's next move 1 turn in 3 | **Pivot**: 10% chance it switches strategy (random own move) | `stakeineverything`, `autoplay`, new: Poke, Feed Scroll | Metaverse: moves the battle to a virtual field where Electric moves gain power |

Type advantages stay on the existing chart (`game/data/types.json`). Weight adds a second axis: heavy beats bulky walls, light beats slow heavies by moving first.

## 4. Art: reuse and placeholders

### Reuse as is
- All 12 starter sheets (`emberox` … `harvestgoat`), normal and gold, with rigs. Only new work: part-size scaling (code) and Prime rim-light (existing gold tool at low strength).

### Placeholder part kits (from you, 2026-10-18)
Your part sheets come in kits. Each kit is a pair of sheets (front and back view) on a magenta background: six animals as columns, one slot per row, and a last row of extras. Sources live in `tools/art-source/part-kit/` (outside the game folder, so they never ship) and are listed in `game/data/partKits.json` (`kits`; studio track ST-3, was tools/art-source/part-kit/kits.json). The Studio's Art workbench (Sheet mode; was `tools/slice-part-kit.py`) cuts every kit into separate transparent pieces at game scale (1/4 of the source, so a full Billie fits the 128 px stage box) in `game/art/next/parts/front/` and `back/`, and writes `game/data/partKits.json` (was game/art/next/parts/parts.json) with each part's kit, animal, slot, pivot and default size M.

| Kit | Animals (columns) | Rows | Extras |
|-----|-------------------|------|--------|
| beasts | cat, rabbit, fox, bear, bird, reptile | head, ear, torso, arm, leg, tail | horn, spikes, mane, shell |
| birds | chick, duck, owl, sparrow, eagle, hawk | head, crest, torso, wing, foot, tail | ruff, horn, plume, crown |
| fish | goldfish, carp, koi, piranha, betta, shark | head, dorsal fin, torso, front fin, back fin, tail fin | sail, spike, scales, lure |

**Room to grow (decided):** a new kit is two PNGs plus one entry in partKits.json `kits` (name, animal per column, slot per row, extras). Part ids are `<animal>_<row>` and `<kit>_<extra>`, so new kits never rename old parts. Planned next kits: octopus (Zuckerberg), slug (Trump), and ox, otter and goat (the starters).

Front is the view facing the camera (the opponent's Billie), back is the view from behind (the player's Billie), the same as the existing sheets.

How the kit covers the new lines in the prototype:

| Line | Head | Crest / extra | Body | Front | Back | Signature |
|------|------|---------------|------|-------|------|-----------|
| Swift | sparrow (birds kit) | sparrow crest | sparrow | hawk wing (long, swift-like) | sparrow foot | duck tail (forked) or sparrow tail |
| Kardashian | reptile | reptile spikes crest | reptile | reptile arm | reptile leg | reptile tail |
| Trump (blob) | bear (recoloured gold-orange) | mane as the golden fur crest | bear body at L | bear arms at S | reptile tail as the slug tail | mane |
| Zuckerberg | no kit part fits an octopus yet: Studio blank `octo` until the kit gets octopus parts | | | | | |

The fish kit has no prototype line yet; it is ready for a fish Billie or abominations. Kit parts for the starters (cat, fox, bear, rabbit) are spare: the starters keep their own art, and the kit parts join the part library for swaps and abominations.

Style difference: the kits are drawn straight-on, upright and with softer shading; the existing Billie sheets are side-on 3/4 views with harder 4-band shading. Both are allowed in the prototype (decided); pick one before the full build.

### Placeholder sheets and rigs (built)
`tools/build-kit-billies.py` makes every new Billie's sheet, Gold-Plated sheet and piece layout in `game/art/next/billionaires/` (where the Studio looks for them) and adds its rig to `game/art/next/rigs-next.js`, marked `"placeholder"`. Swift and Kardashian are recolours of the jay and gecko lines on their rigs. Trump and Zuckerberg are put together from the part kits on a biped rig. Replace any of them in the Studio; running the tool again rebuilds them.

| New Billie | Placeholder | Final art needs |
|------------|-------------|-----------------|
| Swiftlet / Versewift / Erastar | jaylet, hovajay, hovajay recoloured | swift silhouette (forked tail, crescent wings), blonde feather fringe, microphone crest, era-coloured feathers |
| Kontourlet / Filterleon / Kardashleon | siliclet, jenzard, gigajenzard recoloured | chameleon curled tail and turret eyes, long dark crest, ring-shaped glowing crest, contour-shaded scales |
| Gildlet / Gildslug / Tremendoslug | part kit (bear, reptile tail, mane) in gold-orange | golden swept fur crest, orange-tan hide, huge slug body, tiny arms, slug tail |
| Facelet / Feedopus / Metapus | part kit (carp, koi, piranha, shark, mane) in pale blue | octopus with curly fur crest, unblinking eyes, visor-shaped brow ridge |

### Old art that becomes free for parts and abominations
The other 55 lines are in `game/data/legacy/` (built 2026-10-18); their sheets stay. Their pieces become a **part library** (decided) for abominations and later species (wings from birds, horns from quads, claws from crabs), so nothing drawn is wasted. The elephant line is the obvious first source of heavy parts.

## Testing (phase 13)
Follow docs/TESTING.md: where new tests go, what must pass before the phase ends, and its section for phase 16.

## 5. Prototype scope (replaces old task 8)
Built on 2026-10-18 (the ✓ items):
1. ✓ The 7 lines in data (`game/data/lines/`); the other 55 moved to `game/data/legacy/` (art kept as the part library). The game stands a new-line Billie of the same stage in for any legacy species still named elsewhere (`game-data.js` standInSpecies; the data check and the Studio check accept them).
2. ✓ The starting area's wild pools (Copperleaf, Hedgerow Lane, Marigold, Tallgrass Meadow, Old Fairway, Thicket, Fizzwell) use the 7 lines.
3. ✓ Parts: every Billie has a build (`m.build`, rules.js). Every wild Billie (spawns, debug, story and old queue entries) and every egg rolls one; starters and trainers are all M (Prime). Sizes are drawn by scaling the rig's pieces (skeleton-rig.js), everywhere a Billie shows: battle, grass, buddy, follower, menus, friends.
4. ✓ Weight and Prime change the stats (`game/js/logic/parts.js`, shared with the Studio); a Billie's details show its parts, weight and Prime.
5. ✓ Studio: a **Parts** section (size odds, scales, weights, shares, effects, a live preview with readouts), a **Part slot** picker per bone in the skeleton builder, previews draw builds, and the Check warns about part rules and slots.
6. ✓ Unit tests and a 20,000-roll simulation (`tools/test/parts.test.mjs`).
7. To do: the starter split by body size (decided: L → heavy branch, S → light branch, M → the player picks); the 7 passives, quirks and Prime moves; one breed function and one abomination.

Stop and show me the result before scaling.

## 6. Later (after the prototype is approved)
These are the original phase 16 tasks, kept:
7. Grow to about 30-40 species, reusing old sheets and the part library.
8. Breeding at the ranch (phase 12). (ASK 5.1)
9. Abominations: crossing distant species or body plans gives chimeras with a satirical merger-style name (for example "Cartokid Holdings"), a stat spike and a drawback (it taxes itself, files for bankruptcy mid-battle, hedges instead of attacking). Rare, capped weirdness, readable function (wings mean flying, horns mean attack), capped stat variance.
10. Encounters (phase 08) produce Billies with varied parts, sizes, rarities and quirks within the caps.
11. Trading parts, Billies and abominations with friends (phase 18).
12. Full Studio section for part libraries and breeding rules.

## Ask me before
The 7-line roster; the weight formula and caps; the Prime bonus; how the split is chosen; the prototype result before scaling up.

## Decided (2026-10-18)
- Roster: the 7 lines above, starters Musk, Bezos and Gates, slot 7 Zuckerberg as an octopus.
- Looks: recognisable features drawn as animal features, no clothing at all.
- Trump line: a Jabba-style blob (giant slug), not an elephant.
- Starter split: the body part decides.
- Prime: all five native parts, all at normal size (M).
- Part sizes are fixed for now; resizing may come later in the game.
- Prototype part sizes are scaled pieces, not hand-drawn.
- Cut lines become a part library.
- The part kits you sent are the placeholder art for the new lines; both art styles are allowed in the prototype.
- Kidling loses its sweater and Orbitotter its cowboy hat.
- Starter split: L body → heavy branch, S body → light branch, M body → the player picks.
- The kits will grow; the slicer and data leave room for more kits.
- The first column of the beasts kit is a cat.

**Testing boot (2026-10-18):** for now the game boots straight into starter selection, with saves and accounts switched off. Nothing is removed; see docs/HANDOFF.md for the one switch that turns it off.

## Open questions (ASK)

**1. Roster and looks**
1.5 Are the names (Swiftlet, Kontourlet, Gildlet, Facelet and their evolutions) OK, or do you want to name them?
1.6 Does gear (Musk's boosters, Bezos's boxes, Harvestgoat's tyre collar) count as clothing and go too?

**2. Parts and Prime**
2.1 Three sizes (S, M, L), or add XL for rare drops?
2.2 Which extra weight effects do you want (knockback resistance, weight-based moves, shoulder carry)?
2.5 Is Prime +10% all stats plus a Prime move right, or should Prime be cosmetic plus move only?
2.7 Do parts carry through evolution, grow with it, or get replaced by the next stage's native parts?
2.8 Can a part be lost in battle (like robots in phase 17), or only swapped outside battle? Keeping them different from robots is my recommendation.

**3. Moves and battle**
3.1 Is 4 move slots (2 species, 1 part, 1 free) right?
3.2 Are the passives and quirks above the right tone, or should they be more or less mechanical?
3.3 Does weight show as a number to the player, or only as a bar or class (Feather, Light, Medium, Heavy, Super-heavy)?

**4. Art**
4.2 Final art for the 4 new lines: drawn by you, made by me in the Studio, or generated and cleaned up?
4.7 Are the bird and fish column names right (chick, duck, owl, sparrow, eagle, hawk; goldfish, carp, koi, piranha, betta, shark)?

**5. Breeding**
5.1 Deliberate (pick parents), partly random (ranch surprises), or both? I recommend both: you pick parents, the ranch picks which parts and sizes are passed on, with a small chance of a mutation.

## Done when
Prototype approved, then the full system built, simulation tests within bounds, Studio section in place, tag `phase-16-done`.

## First reply
Same four items as phase 01, plus answers to any open questions above that are still open.

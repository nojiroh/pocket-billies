# Perks track (PK) - many more Perks, held items, boons and curses, each with its own art

Branch: track/perks

The owner's brief (2026-10-27): "Make a plan for additions for the relics and such. There should be a lot of variety.
Also make it so they have their own art in a style that fits. Do research online." Then: "Automatically approve plans
for next steps and start them in new sessions until this plan is finished."

This file is the plan (session PK-0, planning and art samples only; nothing in the game changed). Sessions follow
CLAUDE.md (one cause per commit, the test tiers of docs/TESTING.md, a HANDOFF entry, a tag `pk-N-done` to suggest),
except that the owner pre-approved every step's plan: see "How the sessions run". Numbers and lines below were read at
main 07c9b28 (2026-10-27); verify again before each session and correct this file where the code disagrees.

## 1. The owner's answers (2026-10-27, PK-0)

| Topic | Answer |
|---|---|
| Scope of "and such" | **All four**: held items, Bag item icons, boons and curses, Perk sets (besides the Perks) |
| How many new Perks | **About 60** (66 below, in four waves plus the Fine Print tier) |
| Trade-off Perks | **Fine Print**, strong with a real cost, **offered at mini-boss (leader) wins**; ordinary picks stay downside-free |
| Art | Each one its own picture "in a style that fits": the UI icon set's 36 px block-and-split look (section 6) |
| Sessions | Each next step in a new session, its plan approved in advance, until the plan is finished (section 10) |

## 2. What the code does today (read at 07c9b28; verify)

**Perks.** `game/data/perks.json` holds 13 Perks, one effect row each (5 common, 5 uncommon, 3 rare): lucky_charm,
clinic_card, coupon_book, steady_hand, running_shoes, power_gloves, bubble_wrap, trail_snacks, field_notebook,
lost_property, petri_dish, gene_lure, stabilizer_gel. `game/data/schema/perks.schema.json`: ids `^[a-z][a-z0-9_]*$`,
`additionalProperties: false`, required `name` (40), `d` (160), `rarity` (enum common|uncommon|rare), `fx` (1-4 rows,
a `oneOf` of 10 kinds). No field for art, tags, sets or triggers. Types: `FxRow`, `Perk` in
`game/types/game-data.d.ts:1902-1928, 2217-2224`.

**Effects** (`game/js/logic/effects.js`). `FX_KINDS` (:63-80) has 16 kinds: money, price, catch, stat, damage, heal,
payout, level, bossHp, xp, turnHeal, pinchHeal, turnHurt, dna, splice, unstable; Perks may use 10 of them.
`FX_LIMIT` 0.1-4 (:82), `FX_STAGES` 6 (:84). `fxOfRun` (:95-109) joins Perks, event boons (`encBoonRows`), modifiers
(`modFxRows`), relations (`rel:`) and residents (`res:`), rebuilt on every read (there is no `run.fx`); `fxOfBillie`
(:117-123) is a Billie's held item and gene rows. Multipliers multiply (`fxMult`, clamped per call), stages and shares
add. Where each kind is read:
- money `battle-rewards.js:72, 78` (`battleMoneyFx` :89-94); price `shop.js:100-111`, `run.js:759` (clinic);
  catch `battle-engine.js:1471`; damage `battle-engine.js:425-427` in `calcDamage`; heal `run-loop.js:99-104`
  (`runArriveFx`); payout `run-state.js:541-571`; xp `battle-engine.js:863-866`; dna `battle-rewards.js:266`; splice
  `rules.js:1109`; unstable `battle-engine.js:784`.
- **stat** rows apply in `battle-state.js:94-100` `makeBattle` to your fighters on the field only: `doSwitch`
  (`battle-engine.js:898-931`, held stages at :919) gives a Billie that switches in no Perk stages, so Running Shoes
  ("Your Billies start each battle with their Speed up") only helps the lead.
- turnHeal, pinchHeal and turnHurt are read from `fxOfBillie` only (`endTurn` :763-789): run rows of those kinds do
  nothing. level and bossHp are read only through `modFxRows` (`modifiers.js:86-91`): a Perk's or boon's would do
  nothing. The `rule`, `clock` and `start` kinds planned in roguelite-track.md 2d were never built.
- The foe AI (`aiScore` :1026, `chooseAI` :1066) never reads effects.

**Offers** (`game/js/logic/perks.js`). `perkPool` (:47-53) is perks.json's key order minus held Perks (empty under
the `noperks` challenge); `perkDraw` (:57-66) draws by rarity weight from `rngFrom(run.seed, 'relic|' + offerN)`;
`perkShelf` (:85-97) gives a shop one Perk per node and day; `perkTake` (:107-119) appends or opens the "Let one go"
sheet at the cap. rules.json `run.perks` (:258-263): cap 6, pick 3, weights common 6 / uncommon 3 / rare 1, prices
150 / 250 / 400. Where Perks come from: a leader win (`battle-rewards.js:187`, mini-bosses only; the boss gives none),
a run shop's shelf (`shop.js:187-192`), events' `perk [rarity|id]` (8 uses in 6 events; `encounters.js:234-238`).
Adding Perks changes every seed's offers (the pool follows the file's order).

**Screens.** `perk-screen.js:38-41`: `<pb-pick-card heading sub>` with `uiIconHTML('relic', 40)` in its art slot,
rarity as caption text; the Perks tab rows (:154-169) show the same icon at 30 px in a 44 px `.bag-ic` tile; the shop
row (`shop.js:114-120`) at 36 px; the bar's Perks tab (`ui-run-kit.js:97`) and the card's back (:674) also use
`relic`. `PbPickCard` (`ui-run-kit.js:503-679`): slot `art` (min-height 64 px), no rarity attribute. No rarity colours
exist in code yet (UI-14a/b will add the ladder). In battle the only Perk text is `sayBattleFx` (:1335-1349), which
prints a boon's raw source ("event:ring_light") because it only knows Perk names.

**Items.** `items.json` has 21 items; 8 are held (`hold` rows: leftover_sandwich, snack_pack, lucky_coin, study_notes,
iron_vest, quick_laces, brass_knuckles, smart_specs; `logic/held.js`, one per Billie in `m.held`, kinds money, stat,
damage, xp, turnHeal, pinchHeal). Pictures come from the legacy atlas `art/icons/icons.png` (`i_<icon>` rectangles,
9-11 px, 1 px dark outline) through `itemIcon` (`battle.js:735-740`), shown at 30 px (Bag), 36 px (shop) and 40 px
(reward cards); several share or borrow finance-era sprites (`settlement`, `taxbreak`, `bailout`, `loophole`). An
item may name an `img` path (`artURL`), which `itemIcon` prefers; none does, and the `Item` type lacks it.

**Boons and curses.** Events' `fx N kind k=v` command (`encounter-screen.js:327-329`, `encBoon` in `run-enc.js:41-66`)
leaves an unnamed row for this place plus N more (4 uses: ring_light, terms_of_service, surveyor_hole, poster_grove);
the fountain's wish (rules.json `square.wish`) leaves next-run boons and a curse (src `fountain`). None has a name or a
picture.

**The icon look.** The 51 UI icons (`game/art/ui/*.svg`) are 36x36 pixel SVGs: a flat 34x34 front in fixed colours,
shaded by `game/js/logic/icon-block.js` (`iconBlockKeyed`: a 2 px block side to the lower right, the front split on
the 45-degree line through its middle with the upper half paler, a lit top and left edge, a darker seam where two
colours meet) and written by `game/js/logic/svg-pixels.js` (`pixelsToSvg`; `svgProblem` checks an icon). Colours are
`ICON_PALETTE` letters (g G y o r t b B w W p s k n v V c) or one `ICON_RAMPS` hue (gold, red, green, steel, blue,
teal, violet; digits 1-4 light, mid, dark, ink). ART-NOTES.md "UI icons, 36x36": the same colours on both themes,
nothing darker than slate `#4A5544`, 45-degree lines, octagons for circles, strokes of 3 px. The original grids are
`tools/test/fixtures/ui-icon-grids.json`; since SA-2b the SVGs are the source, edited in the Studio's icon editor
(`studio/js/icon-editor.js`, "Shade as a block"). `tools/test/ui-icons.test.mjs:18` pins art/ui at 51 icons with
hyphenated names, so new pictures get their own folders.

**Tests that the growth will touch.** `perks.test.mjs:41` (most Perks turn up over 40 seeds) and :71; `effects`,
`run-fx`, `battle-fx`, `battle-golden` (its snapshot holds Running Shoes, Power Gloves, Bubble Wrap and the line
"Running Shoes: Emberox's Speed rose."), `modifiers.test.mjs:39`, `data-checks.test.mjs:104, 116, 170-180, 226`,
`check-data-snapshot`, `content-preview`, `run-sim`, `economy-view`; `tools/check-fast.py:1636` and
`tools/check-studio-github.py:1993-2078` (`--only=relics`). The online run record keeps at most 6 Perks
(`run-record.js:117, 152`: it truncates).

## 3. Research (2026-10-27; sources in section 15)
- **Slay the Spire**: relic rarity odds 50/33/17; boss relics swap a starter or bring +1 Energy, and every Energy
  relic carries a permanent downside (the model for Fine Print); some relics are offered only when they can matter
  (the Bottled relics need a matching card); a few are gated by floor.
- **Balatro**: 150 Jokers (61 common, 64 uncommon, 20 rare, 5 legendary), sorted by what they give (chips, +mult,
  xmult, economy, retrigger, effect) and when they act (scored, held, discard, blind select, independent). Scaling
  Jokers grow from a condition. Its designer balances "by feel" and changes a number; the art follows strict rules
  (palette, resolution, card standards) for cohesion. GMTK's review: hidden numbers send players to calculators, so
  show them.
- **PokeRogue**: tiered item rolls (about 768/195/48/12/1 of 1024); items are offered only when someone in the party
  can use them (TMs, evolution items, species boosters), weighted by the party's move types; held items vs party-wide
  items; stack caps.
- **The Binding of Isaac**: three items of a themed set give a transformation (Perk sets).
- **Darkest Dungeon II**: trinkets with trade-offs; "the rarer and most powerful trinkets" should be "run-altering".
- **Risk of Rain 2**: chance-based items stack on a curve that never reaches 100%.
- **Hades**: combination rewards that need two sources; keepsakes from relationships (RL-S2 already gives the hub
  folk's bonuses).
- **Pokemon held items**: type boosters (+20%), Focus Sash, Rocky Helmet, Weakness Policy, Air Balloon, Shell Bell,
  Quick Claw, Life Orb and the Choice items: tested templates for held items and Fine Print.
- **Itemization guides**: tag items and weight drops toward the player's build without ruling out the rest; keep a
  few wildcards; items should change how a run plays, not only add numbers.
- **Pixel icons**: silhouette first (it must read filled with one colour), one light direction, 3-4 tones per
  material, readable at the real size with no label; a shared outline and palette make a set.

## 4. Design rules
1. Every Perk changes a decision (what to catch, whom to lead with, where to go, what to buy), not only a number.
2. Variety on two axes, as Balatro: what it gives (damage, defence, tempo, status, economy, catching, map, rules) and
   when it acts (always, battle start, switch-in, on hit, when hurt, on a KO, every Nth, grows over the run, on
   arrival, when taken).
3. Offered only when it can matter (a Fire Perk needs a Fire Billie in the team: PokeRogue's rule), and weighted
   toward the team's types and the sets already held (section 8).
4. Counters and growth show on the card and the Perks tab ("5/8", "+12%"). Full effect text, no hidden numbers.
5. Chances never stack past a cap (Risk of Rain 2's lesson): chance rows add up to at most 50%.
6. Names: plain objects, the game's satire (bureaucracy, tech, influencers, RPG cliches, clone ethics), no finance
   (reflavour-track.md), never a name already used by an item, event, bot, wardrobe piece or another Perk (checked in
   PK-0: Shredder Unit is a bot, the Retrieval Unit's leader is "a filing cabinet that walks", Hard hat is a wardrobe
   piece, Recall Notice is an event; Running Shoes and Power Gloves were taken when held items were named).
7. Rarity: common, uncommon, rare (weights 6/3/1 today) and **fine** (Fine Print), offered at leader wins only. Every
   number is a placeholder for the owner to tune on the phone.
8. One kind of effect per commit; a battle without Perks plays exactly as before (the golden battles prove it).

## 5. The catalog
Each entry: name (`id`, rarity, set): the card's text, then how it works (kinds and fields of section 7) and its art
(colour letters of section 6). Texts and names are drafts for the owner's review. 13 existing + 66 new = 79 Perks.

### 5.1 The 13 existing Perks (redrawn in PK-2, numbers unchanged)
- Lucky Charm (`lucky_charm`, common, -): a gold horseshoe, dark nail holes (one-colour gold; sample drawn).
- Clinic Loyalty Card (`clinic_card`, common): a cream card with a red cross and two punched holes.
- Coupon Book (`coupon_book`, common): a paper booklet with a dashed cut line and a green tab.
- Steady Hand (`steady_hand`, common, Trainer Classics): a gold pyramid held between two fingers (cream).
- Running Shoes (`running_shoes`, uncommon, Trainer Classics): a red sneaker with a cream sole and stripes.
- Power Gloves (`power_gloves`, uncommon, Trainer Classics): a red boxing glove, cream cuff.
- Bubble Wrap (`bubble_wrap`, rare): an ice-blue sheet with a grid of round bubbles.
- Trail Snacks (`trail_snacks`, uncommon, Trainer Classics): a wood-brown bag with a green leaf label.
- Field Notebook (`field_notebook`, uncommon, Trainer Classics): a green notebook with an elastic band and a pencil.
- Lost Property Form (`lost_property`, rare): a paper form with a gold stamp and a slate paper clip.
- Petri Dish (`petri_dish`, common, Lab Kit): an ice-glass dish with green and violet spots.
- Gene Lure (`gene_lure`, uncommon, Lab Kit): a teal fishing lure with a DNA twist.
- Stabilizer Gel (`stabilizer_gel`, rare, Lab Kit): a teal tube of gel with a steel cap.

### 5.2 Wave A, the battle kit (PK-3; 15)
- Rubber Stamp (`rubber_stamp`, common, Office Supplies): "The first hit your team lands in each battle deals 50%
  more damage." `damage` deal x1.5, `when: hit`, `once: battle`. Art: wood knob and block, steel collar, cream
  label, red rubber (sample drawn).
- Click Pen (`click_pen`, uncommon, Office Supplies): "Every 8th move your team makes is a critical hit." `crit`
  force, `when: move`, `every: 8` (the card counts). Art: blue pen on the rising diagonal, steel clip (sample drawn).
- Laser Pointer (`laser_pointer`, common, Tech Gear): "Your Billies land critical hits more often." `crit` stages
  +1. Art: a steel pointer, a red dot and beam.
- Screen Protector (`screen_protector`, common, Tech Gear): "Each of your Billies takes half damage from the first
  hit it takes in a battle." `damage` take x0.5, `when: hurt`, `once: billie`. Art: an ice pane with a crack, slate
  frame.
- Power Bank (`power_bank`, uncommon, Tech Gear): "Once a battle, a Billie that falls below a quarter of its HP heals
  25%." `pinchHeal` at 0.25 share 0.25, `once: battle` (run rows read: section 7). Art: a slate brick, gold bolt.
- Mic Drop (`mic_drop`, rare, Influencer Kit): "When one of your Billies knocks a foe out, its Attack and Sp. Atk
  rise." `stat` lev +1, lob +1 on the knocker, `when: ko`. Art: steel mesh head, gold handle (sample drawn).
- Joy Buzzer (`joy_buzzer`, uncommon): "Your physical hits have a 15% chance to paralyze." `inflict` par 0.15,
  `when: hit`, `cat: H`. Art: a steel disc, red button, gold zap.
- Hot Sauce (`hot_sauce`, uncommon): "Your special hits have a 10% chance to burn." `inflict` brn 0.1, `when: hit`,
  `cat: S`. Art: a red bottle, cream label, green cap.
- Oven Mitts (`oven_mitts`, common): "Your Billies can't be burned." `immune` brn. Art: a quilted red mitt
  (one-colour red).
- Noise-Cancelling Headphones (`noise_headphones`, common, Tech Gear): "Your Billies can't fall asleep." `immune`
  slp. Art: violet headphones (one-colour violet).
- Rubber Boots (`rubber_boots`, common, Weather Kit): "Your Billies can't be paralyzed." `immune` par. Art: gold
  boots (one-colour gold).
- Hazmat Suit (`hazmat_suit`, uncommon): "Sandstorm and sharp stones don't hurt your Billies, and burns hurt them half
  as much." `immune` sandstorm, `immune` stones, `chip` burn x0.5. Art: a gold suit, ice visor.
- Alarm Clock (`alarm_clock`, rare): "Your Billies always move first on a battle's first turn." `first`, `if:
  turn:1`. Art: a red clock, cream face, gold bells.
- Plot Armor (`plot_armor`, rare, Adventurer's Pack): "Your last Billie standing takes 30% less damage and hits 30%
  harder." `damage` take x0.7 and deal x1.3, `if: alone`. Art: a steel breastplate, gold trim.
- Warranty Card (`warranty_card`, rare): "Once a run, when your whole team faints, they all get back up with half
  their HP. Then the card is void." `revive` share 0.5, `once: run` (the card then shows VOID). Art: paper card, blue
  head, red seal (sample drawn).

### 5.3 Wave B, types, team and weather (PK-4; 15)
The type Perks (all uncommon, `needs: team:<Type>`) each strengthen one type's passive (`passive` kind):
- Bellows (`bellows`, Fire): "Your Fire Billies' Kindling builds twice as fast." Art: wood bellows, red leather,
  brass nozzle, a puff of fire (sample drawn).
- Snorkel (`snorkel`, Water): "Your Water Billies' Undertow kicks in from half HP." Art: a blue mask, gold tube.
- Watering Can (`watering_can`, Grass): "Your Grass Billies' Regrowth heals twice as much." Art: a green can
  (one-colour green), blue drops.
- Static Socks (`static_socks`, Electric): "Your Electric Billies' Live Wire lands critical hits twice as often."
  Art: gold and cream striped socks, a spark.
- Knee Pads (`knee_pads`, Ground): "Your Ground Billies' Bedrock works twice a battle, and from 75% HP." Art: wood
  pads, steel straps.
- Kite (`kite`, Flying): "Your Flying Billies' Slipstream works on every switch." Art: a blue and red diamond kite
  with a tail.
- Mood Ring (`mood_ring`, Psychic): "Your Psychic Billies' Wild Mind rolls twice and keeps the better." Art: a steel
  ring, violet stone.
- Union Card (`union_card`, Steel): "Your Steel Billies' Alloy counts every teammate on its feet." Art: a steel card
  with a red stripe.
- Heirloom Locket (`heirloom_locket`, Dragon): "Your Dragon Billies' Parting Roar raises Speed too." Art: a gold
  locket, deep violet scale.
- Matching Hoodies (`matching_hoodies`, common, Influencer Kit): "If all your Billies share a type, they take 15%
  less damage." `damage` take x0.85, `if: mono`. Art: a teal hoodie (one-colour teal), cream logo.
- Rainbow Lanyard (`rainbow_lanyard`, common): "Your Billies hit 3% harder for each different type on your team."
  `damage` deal x1.03, `per: teamTypes`. Art: a red, gold, green and blue lanyard, cream badge.
- Group Chat (`group_chat`, common, Tech Gear): "Billies who sit out a battle still get half its XP." `benchXp`
  share 0.5. Art: a slate phone with green and cream bubbles.
- Umbrella (`umbrella`, common, Weather Kit): "Weather never weakens your Billies' moves." `weather` noWeaken. Art:
  blue canopy (one-colour blue), steel shaft, wood hook (sample drawn).
- Snow Globe (`snow_globe`, rare, Weather Kit): "Your Billies get the weather's boosts twice over." `weather` boost 2.
  Art: an ice globe, wood base, cream snow.
- Barometer (`barometer`, common, Weather Kit): "The forecast shows 3 more days, and arriving somewhere in rain or a
  storm heals your team 10%." `rule` forecastDays +3; `heal` share 0.1, `when: arrive`, `if: weather:rain|storm`.
  Art: a gold dial, cream face, red needle.

### 5.4 Wave C, catching, cash and maps (PK-5; 12)
- Bug Net (`bug_net`, common): "Billies of a species you haven't caught this run are 25% easier to catch." `catch`
  x1.25, `if: newSpecies`. Art: wood pole, cream net.
- Music Box (`music_box`, uncommon): "Wild Billies start battles asleep 20% of the time." `inflict` slp 0.2 on the
  foe, `when: battleStart`, `if: foe:wild`. Art: a wood box, gold crank.
- Name Tags (`name_tags`, common): "Billies you catch join two levels higher." `catchLevel` +2. Art: a red sticker
  with a cream band.
- Pyramid Pouch (`pyramid_pouch`, uncommon): "The first pyramid you throw in a battle comes back if it misses."
  `refund` pyramid, `when: throwMiss`, `once: battle`. Art: a wood pouch, a gold pyramid.
- Tip Jar (`tip_jar`, uncommon): "Each place you walk into adds 1 Money for every 10 you carry, up to 40."
  `money` share 0.1 max 40, `when: arrive`. Art: an ice jar, gold coins.
- Punch Card (`punch_card`, common, Office Supplies): "Every 4th thing you buy in a run is free." `free`, `when:
  buy`, `every: 4` (the card counts). Art: a cream card with slate holes.
- Gift Receipt (`gift_receipt`, rare): "Reward picks show 4 cards." `rule` rewardPick +1. Art: a cream receipt, red
  bow.
- Fortune Cookie (`fortune_cookie`, common): "The first reroll at every reward pick is free." `rule` rerollFree 1.
  Art: a gold cookie (one-colour gold), cream slip.
- Tour Brochure (`tour_brochure`, common): "The run map shows what every place is from the start." `rule`
  mapReveal. Art: a folded paper map, green and blue panels.
- Bounty Poster (`bounty_poster`, uncommon, Adventurer's Pack): "Leaders and the rival pay double Moneys." `money`
  x2, `if: foe:leader|rival`. Art: a paper poster, a red band, a slate silhouette.
- Magnet on a String (`string_magnet`, common, `needs: bots`): "Bots leave twice the salvage." `salvage` x2. Art: a
  red and steel horseshoe magnet on a string.
- Lab Goggles (`lab_goggles`, common, Lab Kit): "Spliced wild Billies are 25% easier to catch." `catch` x1.25, `if:
  foe:spliced`. Art: green goggles, ice lenses.

### 5.5 Wave D, rules, growth and adventure (PK-6; 12)
- Accordion File (`accordion_file`, rare, Office Supplies): "Hold 7 Perks instead of 6." `rule` cap +1 (the online
  record still keeps 6). Art: a stone expanding file, steel clasp.
- Photocopier (`photocopier`, rare, Office Supplies): "Copies the Perk just above it in your list." `copy` (downsides
  too; never itself or another Photocopier). Art: a stone and steel copier, green light.
- Like Button (`like_button`, rare, Influencer Kit): "Your Billies hit 1% harder for every battle won this run, up to
  25%." `damage` deal, `grow` {on: win, by: 0.01, max: 0.25}. Art: a blue thumb (one-colour blue).
- Streak Tracker (`streak_tracker`, uncommon, Influencer Kit): "Each battle in a row won without a faint: +5% damage,
  up to 25%. A faint resets it." `grow` {on: win, if: noFaint, by: 0.05, max: 0.25, reset: faint}. Art: a red and
  gold flame badge.
- Selfie Stick (`selfie_stick`, common, Influencer Kit): "Catching a Billie heals your team 10%." `heal` share 0.1,
  `when: catch`. Art: a steel stick, slate phone, gold flash.
- Coil of Rope (`coil_of_rope`, uncommon, Adventurer's Pack, `needs: side`): "Side areas open with the badge alone; no
  Billie of the type needed." `rule` sideOpen. Art: a coil of gold-brown rope.
- Ten-Foot Pole (`ten_foot_pole`, common, Adventurer's Pack): "Event choices never cost your team HP." `rule`
  eventHurt 0. Art: a long wood pole across the diagonal, steel tip.
- Rusty Key (`rusty_key`, uncommon, Adventurer's Pack, `needs: side`): "Side areas hold one more find." `rule`
  sideFind +1. Art: a gold key with red rust spots.
- Time Card (`time_card`, common, Office Supplies): "Every 5th place you reach is a day off: your team heals fully."
  `heal` share 1, `when: arrive`, `every: 5` (the card counts; the run clock moves a day per arrival, so a day is a
  place). Art: a cream card, slate and red punch marks.
- Boarding Pass (`boarding_pass`, common): "Take it: 150 Moneys and 2 Potions at once. Then it's a souvenir."
  `give` money 150, potion 2, `when: take` (Slay the Spire's on-pickup relics: a slot spent for a lump sum). Art: a
  cream ticket, blue stripe, a small airship.
- Travel Pillow (`travel_pillow`, common): "Walking into a town heals your team 25%." `heal` share 0.25, `when:
  arrive`, `if: place:town`. Art: a teal U pillow (one-colour teal).
- Correction Fluid (`correction_fluid`, uncommon, Office Supplies; built in PK-9 with the curses): "Curses last one
  place less, and the first curse each run is erased at once." `rule` curseShorter 1; `once: run` erase. Art: a
  white bottle (cream), slate brush cap.

### 5.6 Fine Print (PK-7; rarity `fine`, offered only at leader wins; 12)
- Terms and Conditions (`terms_conditions`): "Your Billies hit 30% harder. Shops and clinics charge 50% more."
- Energy Drink (`energy_drink`): "Your Billies start every battle with Speed +2, and take 15% more damage."
- Glass Trophy (`glass_trophy`): "Your Billies deal 50% more damage and take 30% more." Art: ice-glass cup with a
  crack, gold foot (sample drawn).
- Overclock Chip (`overclock_chip`): "Your moves hit 35% harder; each attack costs its user 8% of its HP." `recoil`.
- Ethics Waiver (`ethics_waiver`): "Spliced wild Billies turn up three times as often and pay double DNA. Clinics
  charge double."
- Hustle Planner (`hustle_planner`): "Wins pay double Moneys. Your Billies get a quarter of the XP."
- Influencer Contract (`influencer_contract`): "Trainers pay triple, but a battle in which one of your Billies faints
  pays nothing." (`rule`: FX_LIMIT floors multipliers at 0.1.)
- Non-Refundable Ticket (`nonrefundable_ticket`): "Hold 8 Perks. You can never let one go." `rule` cap +2, noDrop.
- Early Access Pass (`early_access`): "The whole run map shows from the start. Foes are 3 levels higher." `rule`
  mapReveal; `level` +3 (read through the run's rows: section 7).
- Subscription Box (`subscription_box`): "A random item at every new place. Every place costs 15 Moneys." `loot`
  common and `money` add -15, both `when: arrive`.
- Heavy Crown (`heavy_crown`): "Your lead Billie hits 40% harder and takes 20% less. The others hit 15% less."
  `if: lead` / `if: notLead`.
- Paid Promotion (`paid_promotion`): "Shops are 40% off. The boss has 30% more HP." `price` shop x0.6, `bossHp` x1.3.

Since leader picks become Fine Print, ordinary Perks also come from a new reward-pick card (rewards.json kind `perk`,
weight 2 of about 45, a normal-pool Perk, taken through `perkTake`) besides shops and events. Fine Print art: each its
own object; the card shows a small red "Fine Print" stamp.

### 5.7 Perk sets (PK-8; data section `perkSets`; 3 held gives the bonus)
| Set (`id`) | Members | Bonus (draft) |
|---|---|---|
| Office Supplies (`office`) "Middle Management" | Rubber Stamp, Click Pen, Punch Card, Accordion File, Photocopier, Time Card, Correction Fluid | Every run shop stocks a Perk, at half price |
| Influencer Kit (`influencer`) "Verified" | Mic Drop, Like Button, Streak Tracker, Matching Hoodies, Selfie Stick | Wins pay 25% more Moneys; the first hit each battle is critical |
| Tech Gear (`tech`) "Power User" | Laser Pointer, Screen Protector, Power Bank, Noise-Cancelling Headphones, Group Chat | Held items work 50% better |
| Lab Kit (`lab`) "Mad Science" | Petri Dish, Gene Lure, Stabilizer Gel, Lab Goggles | Unstable Billies hit 20% harder and lose no HP |
| Adventurer's Pack (`adventurer`) "Seasoned Adventurer" | Plot Armor, Bounty Poster, Coil of Rope, Ten-Foot Pole, Rusty Key | Side areas always hold a Perk |
| Weather Kit (`weather`) "Weather Person" | Rubber Boots, Umbrella, Snow Globe, Barometer | +15% damage in any weather but clear |
| Trainer Classics (`classics`) "Old School" | Steady Hand, Running Shoes, Power Gloves, Trail Snacks, Field Notebook | +25% XP; catching 10% easier |

A Perk belongs to at most one set (field `set`). `fxOfRun` adds a set's rows (src `set:<id>`) while `need` (3) of its
members are held; cards show the set and "2/3"; the Perks tab groups by set.

### 5.8 Held items (PK-10; 16 new, the 8 existing redrawn)
Type boosters, "Held: its holder's <Type> moves hit 20% harder." (`damage` deal, `type`, x1.2): Matchbook (Fire),
Water Bottle (Water), Seed Packet (Grass), Spare Battery (Electric), Garden Trowel (Ground), Paper Plane (Flying),
Tarot Card (Psychic), Socket Wrench (Steel), Dragon Fruit (Dragon).
Tricks:
- Seatbelt: "Held: once a battle, at full HP, its holder survives a knockout hit with 1 HP." `survive`.
- Cactus Keyring: "Held: Billies that hit its holder with a physical move lose 1/8 of their HP." `reflect` 0.125.
- Complaint Form: "Held: when a super-effective hit lands on its holder, its Attack and Sp. Atk rise sharply, once."
  `stat` +2 +2, `when: hurt`, `if: superEffective`, `once: battle`.
- Party Balloon: "Held: Ground moves miss its holder until it is hit." `immune` type Ground, until hit.
- Costume Fangs: "Held: its holder heals 1/8 of the damage it deals." `drain` 0.125.
- Express Pass: "Held: a 20% chance its holder moves first." `first` chance 0.2.
- Ankle Weights: "Held: its holder always moves last, but hits 30% harder." `last`, `damage` x1.3.
The 8 existing (Leftover Sandwich, Snack Pack, Lucky Coin, Study Notes, Iron Vest, Quick Laces, Brass Knuckles, Smart
Specs) get their own pictures. Held items' rarity tiers follow UI-14's ladder (recommendation: type boosters common,
tricks uncommon).

### 5.9 Boons and curses (PK-9; data section `boons`; 20)
Named from today's rows: Glittering Water (fountain, Moneys +10%, 3 places), Lucky Ripples (fountain, catch +5%, 3),
Stamped Insufficient (fountain curse, shops +10%, 2), Camera-Ready (ring_light, Speed +1, 1), Surge Pricing
(terms_of_service, shops +25%, 3), Clinic Backlog (surveyor_hole, clinics +50%, 2), Fired Up (poster_grove, Attack
+1, 1). New boons: Tailwind (Speed +1, 2), Pep Talk (+10% damage, 2), Grand Opening (shops -20%, 2), Second
Breakfast (arriving heals 10%, 3), Viral Moment (Moneys +25%, 3), Beginner's Luck (catch +15%, 3). New Bureau "Red
Tape" curses: Pending Review (reward picks show 2 cards, 2), Mandatory Training (Speed -1 at battle start, 2), Audit
Trail (wins pay 25% less, 3), Hold Music (your Billies move last on the first turn, 2), Permit Revoked (your newest
Perk does nothing, 2), Out of Office (the next town's shop is shut), Paper Cuts (each place costs 5% HP, 3).
A clinic takes an appeal fee to lift a curse (placeholder 50 Moneys). Events and the fountain name a boon or curse by
id (`boon <id>`, `curse <id>`; `fx` stays for packs). 4-5 new Bureau events hand curses out (drafted lines). The
Perks tab lists them with places left; battle lines name them, not "event:ring_light".

### 5.10 Bag item icons (PK-11)
Potion, Hi-Potion, Burn Salve, Nerve Tonic, Wake-Up Tea, Revive, Max Revive, Full Remedy, Shining Stone, Protein Bar,
Trail Mix, Pretzel and Repair Kit get 36 px pictures (`img: "items/<id>.svg"`); `itemIcon` already prefers `img`;
the Bag draws 36 px (was 30), reward cards 72 px; the atlas's `i_*` rectangles retire through the Studio's
unused-art gate.

## 6. The art (every Perk, held item, Bag item and boon)
- **Look**: exactly the UI icons'. A flat 34x34 front in `ICON_PALETTE` letters or one `ICON_RAMPS` hue (digits 1-4,
  letters as accents), shaded by `iconBlockKeyed` and written by `pixelsToSvg`: a 36x36 SVG. One object per icon,
  a silhouette that reads filled with one colour, at most 4-5 colour letters, 45-degree lines, octagons for circles,
  main strokes of 3 px. The same colours on both themes; a cream or pale shape must not sit alone on the background
  (PK-0 found a cream sparkle vanishing on the light panel). The samples (docs/samples/perk-icons.png, grids in
  docs/samples/perk-icon-samples.json): Lucky Charm, Rubber Stamp, Click Pen, Warranty Card, Bellows, Mic Drop,
  Umbrella, Glass Trophy. Lucky Charm is a horseshoe: the clover read as a gem at 36 px.
- **Folders**: `game/art/perks/`, `game/art/items/`, `game/art/boons/` (art/ui stays 51). File names are the ids.
- **Data**: an `img` field with the path (`"perks/rubber_stamp.svg"`), as items already have, so art-refs and the
  unused-art gate see every picture. A missing picture falls back to the `relic` icon (a pack's Perk may come
  without art); check-data warns.
- **Tool** (PK-2): `tools/build-icons.mjs` reads `tools/art/icon-grids/<folder>.json` (the fixture format: `about`,
  `mono`, `icons`), checks each grid (34x34, known letters, digits only with a `mono` hue, the shaded SVG passes
  `svgProblem`), and writes the SVGs. It never overwrites an SVG without `--force`: once written, the SVG is the
  source and the Studio's icon editor edits it (SA-2b, decision 6). `--check` also flags two icons whose filled
  silhouettes overlap 90% or more. `--sheet` renders `validation/icon-sheets/<folder>-{light,dark}.png` (cards at
  72 px, rows at 36 and 18 px, as the PK-0 sheet).
- **Shown at whole multiples**: 72 px in a pick card's art slot, 36 px in the Perks tab, shop and Bag rows (today's 40
  and 30 px blur the pixels). `image-rendering: pixelated`.
- **Studio**: the icon editor opens and saves the three new folders too; the art browser lists them with "Used by";
  the Perks editor shows each Perk's picture with "Edit art".
- **Review**: each art session commits its contact sheets and lists the new icons under "Decided for the owner";
  the owner can redraw any icon in the Studio.

**Corrected in PK-2** (built 2026-10-28; where the code or the plan above was wrong or vague):
- Section 2's screen claims held: the pick card's art slot drew `relic` at 40 px, the Perks tab at 30 px in a 44 px
  tile, the shop row at 36 px; the bar's Perks tab and the card's back use `relic` (they still do). **The "Let one go"
  sheet is pick cards, not rows**: its six cards show the picture at 36 px (`perkCardHTML`'s size), the pick's three
  at 72.
- "Two silhouettes overlapping 90%" is measured as **intersection over union** (`iconOverlap`): shared pixels over the
  larger shape flagged boxy pictures that are nested but clearly different (Coupon Book and Petri Dish read 93%; 87%
  as IoU). The closest pair now is Field Notebook and Lost Property Form at 88%.
- **A grid is written only once the data names its picture** (`img`), so the later waves' samples wait as grids and
  the unused-art gate stays green with nothing else to keep in step; `--force` is the only way over an SVG on disk.
- In a one-colour (`mono`) picture the ramp's shades get no seam, so a detail drawn in a darker shade can vanish in the
  pale top half (Power Gloves' thumb, Gene Lure's helix in the first drafts). A same-colour letter (`r` beside the red
  ramp's `2`) is its own block and gets a seam: ART-NOTES.md "Perk pictures".
- The picture check is its own data check, `dataPerkArt` (it reads files, which `dataPerks` doesn't), run by
  check-data: an error for an `img` that isn't there or fails `svgProblem`, a warning for a Perk without one.
- The art browser and art-refs needed no change for "Used by" (perks.json's `img` is data text naming the path);
  the icon editor learned the folders (`ICON_DIRS`, `svgIconKey` in svg-pixels.js: `perks/<id>` keys). The folders
  `items` and `boons` exist only in that list until a picture goes in (git keeps no empty folders).
- `--sheet` uses the container's global Playwright for Node; it is not run in CI. The sheets are committed in
  `validation/icon-sheets/`.
- The 51 UI icon grids shade back to their SVGs byte for byte through the tool (its test), so the pipeline is the
  retired builder's.

## 7. The engine
**PK-1 (the core)**, then each wave adds only the kinds its entries need, one kind per commit:
- Effect rows gain optional fields with fixed names (data-checked, no script language; roguelite-track.md 2d):
  - `when`: battleStart, switchIn, move, hit, hurt, crit, ko, faint, turnEnd, catch, throwMiss, win, arrive, buy,
    take (the moment the Perk is taken). A row without `when` acts where its kind always acts. There is no `day`:
    the run clock moves one day per arrival, so `arrive` is it.
  - `if`: one or more of `weather:<k>` (`|` for or), `type:<T>` (the Billie acting), `team:<T>`, `mono`, `alone`,
    `lead`, `notLead`, `hp<x`, `foe:wild|trainer|leader|rival|boss|bot|spliced`, `turn:1`, `newSpecies`,
    `place:town`, `superEffective`, `noFaint`, `cat:H|S`.
  - `every` N (fires on every Nth `when`), `grow` {on, by, max, reset} (a value that builds over the run), `per`
    (scales by a count: teamTypes), `once` (battle, run, billie).
- State: `run.perkState` (`{<src>: {n, v, used}}`: counters, growth, used-once flags; validRun bounds; missing on an
  older run reads as empty, no SAVE_VERSION bump) and the battle's own `fxState` for once-per-battle and per-Billie
  marks. Chance rolls use the battle's seeded stream (`b.rng`), so battles stay replayable.
- Fixes: Perk stat rows apply to Billies that switch in (Running Shoes then does what it says; if the golden battle
  changes, its snapshot is remade in its own commit with the reason); turnHeal, pinchHeal, turnHurt, level and bossHp
  rows from the run are read (one pipeline for Perks, boons, modifiers, relations and residents).
- A firing Perk says one battle line (an optional `say` on the Perk, at most 40 letters); `sayBattleFx` names boons by
  their names. The UI track's blip (UI-16b) can read the same events later.
- Schema, `data-checks.js` (`dataPerks`, `fxRowProblems`), `game-data.d.ts`, and the Studio's Perks editor (a When,
  If, Every, Grows and Once input per row) grow with each field and kind.
- Hook points (battle-engine.js unless named): battle start `battle-state.js:94-107` and `newBattle` :1136-1150;
  switch-in `doSwitch` :898-931; turn start :1357-1362; move order :1398-1405; before a move :507-540; damage
  `calcDamage` :386-442 (crit :398-399, weather :419, Perks :425-427); on hit :610-646; status `inflict` :473-491;
  turn end `endTurn` :731-830 (burn :743-747, Sandstorm :748-757); faints `checkFaints` :932-969 (loss :966); XP
  `award` :831-860; catch `catchOdds` :1453-1474, `catchKeep` :1492-1504, `battle.js` `doThrow`/`finishThrow`
  :913-962; battle end `battle-rewards.js` `battleSettle` :106-153, `battleSettleWin` :163-194; arrival
  `run-loop.js:99-104` (the day moves at `run-map.js:1046`); taking a Perk `perks.js` `perkTake` :107-119; shops
  `shop.js:100-111, 247-274`; reward picks `rewards.js:91-170`; events `encounter-screen.js`, `encounters.js`.
- New kinds by session: PK-3 `crit`, `immune`, `inflict`, `chip`, `first`, `revive`; PK-4 `passive`, `weather`,
  `benchXp`, `rule` forecastDays; PK-5 `catchLevel`, `refund`, `free`, `salvage`, `rule` rewardPick, rerollFree,
  mapReveal; PK-6 `copy`, `rule` cap, sideOpen, eventHurt, sideFind, `give`; PK-7 `recoil`, `loot`, `rule` noDrop,
  faintPaysNothing, the `fine` rarity; PK-8 the set rows (`heldBoost`); PK-9 boons and curses (`rule` shopClosed,
  muteNewest, curseShorter, `last`); PK-10 held `survive`, `reflect`, `drain`, `immune` type, `first` chance, `last`.

**Corrected in PK-1** (built 2026-10-28; where the code or the plan above was wrong or vague):
- Section 2's claims held at 07c9b28: `doSwitch` gave a Billie coming in only its held item's stages; run rows of
  turnHeal, pinchHeal and turnHurt were read from held items only; level and bossHp from modifiers only;
  `sayBattleFx` printed "event:ring_light". The golden battle holding Running Shoes has no switch, so the fix left it
  unchanged (no snapshot remade).
- `run.perkState` is keyed `'<source>/<row>'` (effects.js `fxKey`), not `<src>`: a Perk can hold two counting rows.
  `fxOfRun` numbers only the rows that keep state (`row`); the others are the objects they were. Marks: `n` (every),
  `v` (grow), `used` (once a run); the battle's own `b.fxState` holds once-a-battle `used` and once-for-each-Billie
  `by` (uids). A run battle carries `run.perkState` itself (`runBattleExtra`'s `perkState`) when a row keeps state,
  so a battle's counts and growth are the run's at once.
- The perks schema now admits turnHeal, pinchHeal, turnHurt, level and bossHp on Perks (the core reads them from the
  run); no Perk uses them yet. The Studio editor got a **Per** input too (the plan listed When, If, Every, Grows, Once).
- Where each kind can take a `when` (data-checks.js `FX_WHEN_KINDS`): stat at the battle moments but throwMiss, heal
  at every moment, damage at hit and crit (side deal) or hurt (side take). Later waves add kinds to that table.
  Kinds read where no battle, Billie or team is known take no condition (`FX_PLAIN`): price, payout and splice no
  `if`, `grow` or `per`; level and bossHp no `if` or `per` (they count as the run's places and foes are made).
  `every` needs a `when`; `once: battle|billie` needs a battle moment (or a stat or pinchHeal row); `once: run`
  needs a `when` (or a stat or pinchHeal row).
- Conditions as built: `lead` is whoever stands in your first field place (a Billie that switches in there leads);
  `turn:1` holds during the first turn's moves (battleStart is turn 0); **`weather:clear` never holds on a run**: a run
  battle's clear forecast is `sunny` (run-loop.js `runBattleWeather`), so the Weather Kit's "any weather but clear"
  must list the others; `newSpecies` is "no Billie of the foe's species on your team" (a run keeps no list of what it
  caught); `foe:leader` is a mini-boss (`runFoe` miniboss), `foe:boss` the final boss; a condition the moment can't
  know is false.
- A row without `when` acts where its kind always acts: a stat row now as **each** of your Billies takes the field (the
  start and every switch in, moved from `makeBattle` into the engine: `fxBattleStart`, `fxFieldStages`); a heal row on
  arrival (where its condition holds). A damage row of hit, crit or hurt counts for that one hit (`fxHitMult` with
  `fxPeek`); the moment is counted after the hit lands (`fxHitMoments`).
- A stat or heal row at a moment acts on the Billie the moment is about, else on yours on the field; on the run a heal
  row heals the team (rounded up, as arrival). A Perk with `say` says "<Perk>: <say>" once instead of the kind's own
  lines ({name}: the Billie, or "your team").
- A run pinchHeal row acts once a battle for each Billie unless its `once` says otherwise. Buying several of one ware
  at once is one `buy`.
- The take moment needs the save: `perkTake`, `perkChoose` and `perkBuy` take an optional last `s`; the page's
  callers and the simulation pass it.

## 8. Offers (PK-4, PK-7)
- `needs` on a Perk (a condition: `team:Fire`, `bots`, `side`, `spliced`): unmet, its weight is 0, so a Fire Perk is
  never offered to a team without a Fire Billie. `tags` (types and themes): a tag matching the team's types, or a set
  already held, multiplies the weight by rules.json `run.perks.bias` (placeholder 2).
- The leader pick draws 3 from the `fine` rarity (rules.json `run.perks.leader`: `{rarity: "fine", pick: 3}`); shops,
  events and the reward-pick card draw from common, uncommon and rare. The `noperks` challenge still empties every
  pool.
- `perks.test.mjs:41` is rewritten for a large, filtered pool (coverage per rarity over a few hundred seeds with a team
  of every type), and new tests pin relevance (no type Perk without its type) and the leader pool.

## 9. Sessions (one at a time, each on `track/perks`)
| # | Session | Does | Done when |
|---|---|---|---|
| PK-0 | Plan (done 2026-10-27) | this file, the 8 art samples, ROADMAP, BRANCHES, HANDOFF | merged by the owner |
| PK-1 | Effects core (**done 2026-10-28**, `track/perks`; "Corrected in PK-1" in section 7) | section 7's fields and state, the switch-in fix, run rows of every kind read, schema, data checks, types, the Studio's row inputs, battle lines; tests for each trigger, counter, growth and condition (test-only Perks) | a battle without Perks unchanged; every tier green |
| PK-2 | Art pipeline (**done 2026-10-28**, `track/perks`; "Corrected in PK-2" in section 6) | `tools/build-icons.mjs` and its test, `img` on Perks (schema, checks, types), cards at 72 px and rows at 36 px, the Studio's icon editor and art browser on the new folders, the 13 existing Perks drawn | 13 pictures in game, contact sheets committed |
| PK-3 | Wave A | 15 Perks of 5.2: data, kinds, art, tests | every Wave A Perk works in a battle test |
| PK-4 | Wave B | 15 Perks of 5.3, `needs`, `tags` and the bias (section 8) | no type Perk offered without its type |
| PK-5 | Wave C | 12 Perks of 5.4 | catching, shop, reward and map rules tested |
| PK-6 | Wave D | 11 Perks of 5.5 (Correction Fluid waits for PK-9) | growth and copy tested over a simulated run |
| PK-7 | Fine Print | 12 Perks of 5.6, the `fine` rarity, the leader pick from it, the reward-pick Perk card | leaders offer only Fine Print |
| PK-8 | Sets | `perkSets` data section (file, index.json key, schema, types, check-data block, export), the 7 sets, the card's set line, the Perks tab grouped | a set's bonus starts and stops with its third member |
| PK-9 | Boons and curses | `boons` data section, the 20 of 5.9 with art, `boon`/`curse` commands, the fountain by id, the appeal, 4-5 Bureau events, Correction Fluid | every timed effect has a name and a picture |
| PK-10 | Held items | 16 new, 8 redrawn, the held kinds, rarity tiers | every held item has its own picture |
| PK-11 | Bag item icons | 13 consumables drawn, `itemIcon` sizes, atlas `i_*` retired | no item draws from the atlas |
| PK-12 | Collection and wrap-up | the Field Guide's Perks tab (seen, taken, silhouettes of the unseen: the SVGs work as masks), the run sim over every Perk, the full check, the summary of every decision for the owner | the track's done-when (section 14) |

About 12 sessions after this one. Each one merges main into `track/perks` first (a merge, not a rebase; `npm run
modules` for hooks.js, never by hand).

## 10. How the sessions run (the owner's standing instruction, 2026-10-27)
"Automatically approve plans for next steps and start them in new sessions until this plan is finished."
- The planning session (PK-0's, `session_019UpAFzVwfZypdpgBr3Cg1E`) starts each step in a new cloud session once the
  step before has pushed its HANDOFF entry and its CI is green (or its red is established as main's). PK-1 starts from
  `ccr-24be55e6-2bmqci` (this plan) with outcome branch `track/perks`, which makes the branch; every later step starts
  from `track/perks`. A cloud session can push only to its own branch, so each pushes to `track/perks`.
- A step does not wait in Plan Mode: it reads ROADMAP, VISION, the top of HANDOFF and this file, checks the code
  against section 2 and its own section, writes its plan as the first part of its HANDOFF entry and goes on. Where it
  meets an open choice or an "Ask me before" item it takes the recommended option and lists it under "Decided for the
  owner, to review". Phone checks are listed, not waited for.
- A step drives its push to green CI, then reports done with a one-shot scheduled task into the planning session (its
  commit and one line). An hourly scheduled check in the planning session covers a missed report or a failed session
  (one restart; a second failure goes to the owner). The checks stop after PK-12.
- Merges to main stay the owner's: one draft PR from `track/perks` holds the track (milestones merged with a merge
  commit, BRANCHES.md). The step that is running watches it and hands the watch on when it finishes.

## 11. Ask me before (each decided by its recommendation under the standing instruction; listed for review)
1. Fine Print's look: recommended the rarity ladder's top orange `#F77036` and a small red "Fine Print" stamp.
2. Rarity weights once Fine Print leaves the ordinary pool: recommended unchanged (6/3/1).
3. The reward-pick Perk card's weight: recommended 2 of about 45.
4. Every name and line drafted here and in the sessions (Perks, sets, boons, curses, events, held items, battle lines).
5. Held items' rarity tiers: recommended type boosters common, tricks uncommon, on UI-14's ladder.
6. Reroll prices once Gift Receipt and Fortune Cookie exist: recommended unchanged (50, doubling).
7. The curse appeal fee: recommended 50 Moneys at a clinic.
8. Lucky Charm's picture: recommended the gold horseshoe of the samples.
9. The 13 existing Perks keep their numbers: recommended yes (tuned later on the phone).
10. The cap stays 6 (Accordion File +1, Non-Refundable Ticket +2).

## 12. Fits with other tracks
- UI track: UI-14a/b put rarity frames, pills and name colours on `pb-pick-card`, the Perks screen, the reward pick
  and the shop, and give held items, Augments and Genes tiers; UI-16a/b add the gain flight and the battle blip
  (`pb-proc`). This track adds the pictures, the Fine Print rarity and the counters to the same cards
  (`perk-screen.js`, `ui-run-kit.js`, `shop.js`, `reward-screen.js`): whichever lands second merges. UI-13's short
  effect glyphs can show boons and curses in the HUD later.
- Roguelite track RL-16 (content packs) is next there: every new field and section here is data (`perkSets`, `boons`
  follow the data-section pattern), so packs can add Perks, sets and boons without code.
- Splicing (Lab Kit, Ethics Waiver), bots (Magnet on a String), side areas (Coil of Rope, Rusty Key), relations and
  residents (their rows join the same pipeline), Expeditions and challenges (`noperks`).
- The Studio (Perks editor, icon editor, art browser), the in-game full test (`self-test.js:2215-2267` buys a shop
  Perk and takes a leader pick: PK-7 changes what that pick offers) and the exported debug log (`relics` stays the
  key; PK-1 adds `relicState`, counters only, nothing personal).

## 13. Risks
- Many new effect kinds in the battle engine: one kind per commit, the golden battles unchanged without Perks, and a
  test that holds every Perk at once and stays finite.
- Every seed's offers change as Perks are added (the pool follows the file's order): accepted, as in SP-6.
- Balance: every number is a placeholder; the run sim cannot judge late-run power (no simulated run beats a leader,
  HANDOFF Studio Phase 3b).
- Art volume, about 140 pictures: contact sheets each session, the silhouette check, the owner's review list.
- The PR from `track/perks` grows over 12 sessions: the owner may merge milestones (after PK-2, PK-7, PK-12).
- The full quick check's RL-8 step ("the town's shop has no Perk") is red on main too; not this track's.
- The online run record shows 6 Perks when 7 or 8 are held.

## 14. Done when (the track)
79 Perks (13 + 66), each with its own picture; Fine Print at leader wins and a Perk card in the reward pick; 7 sets;
24 held items and 13 Bag items with pictures; 20 named boons and curses with pictures; the Field Guide's Perks tab;
every test tier green but main's known red step; HANDOFF lists every decision taken for the owner; tags `pk-N-done`
suggested.

## 15. Sources (research, 2026-10-27)
- Slay the Spire relics: https://slaythespire.wiki.gg/wiki/Relics; boss relic downsides:
  https://www.ludo.guide/guide/slay-the-spire/relics-passive-powerhouses/relic-tier-list-recommendations
- Balatro Jokers: https://balatrowiki.org/w/Jokers; LocalThunk interview: https://rogueliker.com/balatro-interview/;
  GMTK, "Balatro's 'Cursed' Design Problem": https://gmtk.substack.com/p/balatros-cursed-design-problem
- PokeRogue item types: https://github.com/pagefaultgames/pokerogue (`src/modifier/modifier-type.ts`)
- The Binding of Isaac transformations: https://bindingofisaacrebirth.wiki.gg/wiki/Transformation
- Darkest Dungeon II, the Trinkets and Baubles update: https://www.gamebanshee.com/xfwcx
- Risk of Rain 2 item stacking: https://riskofrain2.wiki.gg/wiki/Item_Stacking
- Pokemon hold items: https://www.serebii.net/itemdex/list/holditem.shtml
- Itemization: https://www.wayline.io/blog/roguelike-itemization-balancing-randomness-player-agency,
  https://bugnet.io/blog/how-to-design-a-roguelike-item-and-synergy-system
- Pixel icons: https://bugnet.io/blog/how-to-make-pixel-art-that-reads-clearly, https://www.sprite-ai.art/gallery/items,
  https://www.slynyrd.com/blog/2018/1/10/pixelblog-1-color-palettes

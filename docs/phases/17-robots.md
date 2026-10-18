# Phase 17 - Robots (build your own, battling in the same system as Billies)

## Goal
A second kind of fighter: robots, built by the player from parts. Robots are NOT a separate battle game. They fight
in the existing battle engine, on the same teams and against the same opponents as Billies. The engine is extended so
a fighter can be a Billie or a robot. Robots get their own flavour from parts: moves come from parts, arms and legs
can break, and a robot's build is its strategy. Use original names, terms and designs (nothing from Medabots).
Prototype first.

## Decided (owner, 2026-10-18)
- **Fully mixed.** One team can hold Billies and robots together. A robot can fight a Billie and the other way round.
  Trainers can field both. Same battle UI, same turn flow, same rewards.
- **Damage: body HP + breakable parts.** A robot has one HP bar (torso and head together) that decides the KO, like a
  Billie. Its left arm, right arm and legs also have their own smaller HP and can break. A broken part stays broken
  for the rest of that battle.
- **Moves come from parts.** Each arm gives a move, the legs give a move, the gem gives a signature technique.
  Swapping a part changes the moveset. Robots do not learn moves by level.
- **Every part has a type** (the existing nine: Fire, Water, Grass, Electric, Ground, Flying, Psychic, Steel, Dragon).
  A robot's defensive types are **torso + legs** (dual type, like a dual-type Billie). Each move carries the type of
  the part it comes from.
- **Targeting: some moves aim.** Normal hits on a robot land on a random part (weighted). Moves marked "aimed" let the
  attacker pick the part. Billies' attacks break robot parts too.
- **Growth: gem levels + part upgrades.** The gem earns XP and levels (the robot's level). Parts are upgraded with
  materials at the workshop.
- **Repair: healed like HP.** Clinic, rest and repair items fix broken parts the same way they restore HP. No
  permanent loss.

## What the engine has today (read 2026-10-18, verify again before starting)
- `game/js/logic/battle-engine.js` (1111 lines) is classic turn-based: up to 3 player and 2 enemy actors on the field
  (`ACTOR_SIDE`, `SIDE_ACTORS`), a plan per turn (move, switch, item, run), actions ordered by move priority then
  Speed (`hus`), one HP pool per fighter, stat stages, statuses, passives per type, Alpha bosses with two actions.
- Stats are the six in `stats.json` (`hp`, `lev` Attack, `law` Defense, `lob` Sp. Atk, `pr` Sp. Def, `hus` Speed),
  computed by `stat(m, k)` in `rules.js` from `SPECIES[m.sp].base`, level and the phase 16 build.
- The coupling to Billies is small: `stat()`, `actorTypes()` (reads `SPECIES[..].types`), about 9 `SPECIES[` reads in
  the engine and 1 in `battle.js`, move lists in `m.moves` (max 4, enforced in `saves.js` and `rules.js`).
- Phase 16's parts (`logic/parts.js`, rules.json `parts`) give Billies part sizes, weight and Prime. Robots reuse the
  idea of weight but have their own parts system.

## Design

### 1. The fighter layer (the core engine change)
Introduce a fighter kind: `m.kind` is `'billie'` (default, so existing saves and trainers need no change) or
`'robot'`. Every place the engine reads species data goes through a small set of functions in a new
`game/js/logic/fighters.js`:
- `fighterBase(m)` - the six base stats (species base for a Billie; summed part stats for a robot)
- `fighterTypes(m)` - species types / torso + legs types
- `fighterMoves(m)` - `m.moves` / the moves given by its working parts
- `fighterName(m)`, `fighterLevel(m)`, `fighterWeight(m)`
`stat(m, k)` keeps its formula and calls `fighterBase`. `actorTypes` calls `fighterTypes`. Billie behaviour must not
change: the existing unit tests and the battle simulation must give identical results before and after (a pure
refactor commit first, robots added after).

### 2. Robot anatomy and stats
Five components: **torso** (with head), **left arm**, **right arm**, **legs**, **gem**.
- Each part has base stats (a share of the six), a type, a weight, a rarity, an upgrade level, a cosmetic variant.
- Robot base stats = sum of the four body parts' stats, scaled by the gem's level with the same level formula as
  Billies, so a level-30 robot and a level-30 Billie are in the same range.
- **Weight vs. legs.** Legs have a carry rating. If the total weight is over it, Speed drops; well under it, Speed
  gets a small bonus. Heavy arms hit harder. This echoes phase 16's weight-for-attack trade.
- Torso decides body HP and defenses; legs decide Speed and evasion; arms decide attack stats and moves.

### 3. Moves (four buttons, same UI as Billies)
| Source | Moves | Notes |
|---|---|---|
| Left arm | 1 | type = the arm's type |
| Right arm | 1 | type = the arm's type |
| Legs | 1 | usually mobility or support (dodge, charge, kick) |
| Gem | 1 | signature technique, unlocked by gem level |
That is exactly four, so the battle UI needs no new layout. A fully upgraded arm may swap its move for a stronger
one (an upgrade path, not a fifth slot). Robot moves live in `moves.json` like other moves, with new optional
fields: `aimed: true`, `breaks` (bonus damage to parts), `part: 'armL'|'armR'|'legs'|'gem'` (who provides it).

### 4. Damage, part HP and breaking
- Body HP works exactly like a Billie's HP. 0 HP = KO, defeat condition unchanged for the whole engine.
- Every hit on a robot also lands on one part: **left arm, right arm or legs** (torso is the body bar). Random,
  weighted by part size; an **aimed** move picks the part.
- The hit deals its full damage to body HP and a share (rules.json `robots.partShare`, start at 100% of the damage
  against the part's own smaller pool) to that part's HP. Parts have roughly 30-40% of body HP, so a focused robot
  can lose an arm in two or three hits.
- **Broken arm:** its move is greyed out. Both arms broken: the robot can still use legs and gem moves (never fully
  helpless). **Broken legs:** Speed halved, evasion lost, legs move unavailable.
- Billies hitting robots and robots hitting Billies use the same `calcDamage`; type effectiveness uses the robot's
  torso + legs types. A Billie has no breakable parts in battle (phase 16 recommendation 2.8 stands).
- New feedback: a "part broke" battle event, sound and stage effect (the arm drops or sparks), and a small part-HP
  readout under the robot's HP bar.

### 5. The gem (the soul)
- The gem is the robot's level and XP. Battle XP and the rewards that now go to Billies go to the gem.
- Gem has a type affinity (+ bonus to moves of its type), a passive trait (like type passives today) and the
  signature move. Personality and story role are open (see "Ask me before").
- Moving a gem to a new body keeps its level: the gem is the character, the body is equipment.

### 6. Statuses and items on robots
Existing statuses apply unless a part or gem gives immunity. Healing items restore body HP; new **repair kits**
restore part HP (one part or all). Clinic and rest fix everything, as with Billies.

### 7. Teams, switching, trainers, AI
- Team slots hold either kind; the team box shows both. Switching is unchanged.
- Trainer data (`trainers/*.json`) gets an optional robot entry: `{ "kind": "robot", "build": { ... }, "lvl": 20 }`.
- The AI (`chooseAI`, `aiScore`) learns: avoid moves of broken parts, prefer aimed moves at a robot's strongest arm,
  and value breaking legs on fast robots.
- No catching robots. Wild encounters stay Billies only (open question: wild robots that drop parts).

### 8. Parts: sourcing and the workshop
- **Found** on maps (chests, secrets), **crafted** at the workshop from materials, **won** from trainer battles.
- Parts are inventory items (`saveData.parts`), not part of a robot until fitted. Upgrades and paint happen at the
  workshop.
- The socket standard (task 11) means any arm fits any torso.

### 9. Save format
- Robot team member: `{ kind:'robot', uid, name, gem:{ id, lvl, xp }, fit:{ torso, armL, armR, legs }, hp,
  partHp:{ armL, armR, legs }, status }` where `fit` holds part uids.
- Part instance: `{ uid, id, up, paint }` in `saveData.parts`.
- Types in `game/types/save-data.d.ts`, schema in `game/data/schema/`, defaults in `saves.js`. Old saves load as
  before (no `kind` = Billie).

## Tasks
1. **Refactor (no behaviour change):** add `logic/fighters.js` and route every species read in the engine, `stat()`,
   the battle UI and the stage through it. Unit tests and smoke must stay green and the sim give identical numbers.
2. **Rules data:** rules.json `robots` (part share, part HP ratio, weight/carry curve, leg-break penalty, gem XP);
   `parts` data file for robot parts and gems with a JSON schema.
3. **Robot fighters in the engine:** stats, types (torso + legs), moves from parts, part HP, hit location, aimed
   moves, breaking, broken-part rules, repair items. Unit tests for each rule in `tools/test/`.
4. **Battle UI and stage:** part-HP readout, greyed moves for broken parts, part picker for aimed moves (one extra tap
   only on aimed moves), break events and effects. Phone first.
5. **AI:** robot-aware scoring as in design 7.
6. **Trainers:** optional robot entries; one test trainer with a mixed team.
7. **Save format** as in design 9, with tests in `saves.test.mjs`.
8. **Builder screen (phone):** five slots, inventory with stat comparison (before/after), type and weight readout,
   resulting moveset, saved loadouts. Prototype preview: the assembled 3D model turning slowly is the goal; if it is
   costly, a 2D layered preview is enough for the prototype.
9. **Sourcing:** chests and trainer rewards drop parts; crafting at the workshop.
10. **Balance simulation** on phase 13's harness (`tools/test/sim`, which does not exist yet: build it here or in a
    13 follow-up). For the prototype, **all** builds can be tested (3 torsos x 3 L arms x 3 R arms x 3 legs x 3 gems =
    243 builds): every build vs every build, and every build vs a reference set of Billies at the same level. Bounds
    to agree before building: no build wins more than ~60% of matchups; robots vs Billies at equal level within
    ~45-55% overall.
11. **Art pipeline:** modular low-poly parts (airship style, 32 px/m) on a skeleton with standard sockets (neck, two
    shoulders, hips, gem slot), palette variants from phase 09. Document the socket standard.
12. **Studio:** editors for robot parts, gems and trainer robot builds.

## Prototype (do this first, then stop and show me)
- One chassis family: 3 torsos, 3 left arms, 3 right arms, 3 legs, 3 gems, about 12 moves.
- Tasks 1-7 and a simple version of 8, enough for: build a robot, put it on a team with Billies, fight a mixed
  trainer team.
- The 243-build simulation (task 10) passing the agreed bounds.
- If it is not fun, rethink before scaling.

## Ask me before
- The numbers in "Design" that feel like rules: part HP ratio, weight curve, leg-break penalty, the sim bounds.
- The gem's role beyond level and signature move: personality, story, ties to the organization (phase 15).
- Where the workshop lives (ranch or a town, phase 12).
- Whether wild robots exist (encounters that drop parts) or robots only come from building.
- Whether a robot's moves get one-per-part forever, or upgraded arms can choose between two moves.
- The prototype result before scaling up.

## Done when
Prototype approved, then the full system built with simulation tests inside the agreed bounds, Billie battles
unchanged by the refactor, tag `phase-17-done`.

## First reply
Same four items as phase 01, plus a short check of the "What the engine has today" section against the real code.

## Testing (phase 13)
Follow docs/TESTING.md and its section for phase 17. In addition: the task 1 refactor must leave every existing test
and the sim output identical; each robot rule (part hit, break, aimed move, weight, repair) gets a unit test; one
smoke test fights a mixed battle end to end.

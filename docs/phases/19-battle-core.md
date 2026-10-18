# Phase 19 - Battle core: seeded, replayable, two-sided, effect handlers

## Goal
Make the battle engine a self-contained simulation: it owns its random numbers, works on its own copy of the fighters,
takes inputs for both sides, keeps a log that replays to the same result, and runs every move effect, passive and
status through one table of handlers. Players see no change except fixes. This is the ground phase 18 (friend
battles) stands on, and it makes phases 16 and 17 cheaper: a new effect becomes a handler plus data.

Comparison points (from the 2026-10-19 engine review): Pokémon Showdown's simulator (battle-owned seeded PRNG, input
log, replays, `onX` event handlers on each effect), pkmn/engine (fixed RNG for reproducible tests), PokeRogue.

## Decided (owner, 2026-10-19)
- Battle core comes before the renderer work (phases 20, 21) and before phase 18.
- Who is trusted with a friend battle's result (server replay or both clients cross-checking) is decided in phase 18.
  This phase only makes that possible: a battle must replay identically from its seed and inputs, in Node and in
  any browser.

## What the engine has today (read 2026-10-19, verify again before starting)
- `game/js/logic/battle-engine.js` (1186 lines). State is one mutable global, `activeBattle`, from `hooks.js`.
- Random numbers: `random = Math.random` (`game/js/util.js:11`), about 16 calls in the engine (speed ties, rolls,
  crits, retargeting, status turns, catch). The battle screen draws from the same stream (`battle.js` `hudPop` jitter,
  about line 679) and the particles call `Math.random` (about 308-321). Only the tests seed it (`reseed()` replaces
  `Math.random`, tools/test/load-logic.mjs).
- Fighters are the live `saveData.team` objects (about line 900): damage, XP (646-648), `seen` (694, 937) and items
  (`applyItem`, 1135, 1184, which also calls `save()`) change the save during the battle. Fighters get
  `defineProperty` getters (`act`, 918-935); `extra.T` holds the whole trainer object (986).
- `runTurn` (1013-1071): run, switches, faints, items, then moves sorted by priority `pr`, Alpha second action, Speed
  `hus`, random tiebreak. The AI's choices are made inside `runTurn` (1043-1049) and always for side 1. Switching,
  pivot, `needSwitch` and XP exist only for side 0 (705-741, 1028).
- Events: `battleSay` pushes `{t, an, s: allSnapshots(), mk}` (251-255), played back by `battle.js` (396-466). The
  text is English built in the engine.
- Effects: moves are JSON with 23 `fx` keys (protect status selfStage selfChance drain selfStatus tgtStage hype wipe
  chance heal market spread vary delay crit spin hold missCost rent aim breaker repair). Each key is coded in
  `useMove` (361-564), again in `aiScore` (767-802), and targeting again in `battle.js` `needsTarget` (756-760).
  Passives (per type, types.json) and statuses (sleep, paralysis, burn; hyped) are checked inline in many places.
  `check-data.mjs` does not check `fx` keys.
- The damage formula is written four times: `calcDamage` (281), the confusion self-hit (391-394), `aiDamage`
  (755-766), `aiScore` (781-788).
- Some rules live in the battle screen: the bribe roll (`battle.js` 1066-1068), win and loss rewards and drops
  (about 1110-1130), the multi-fighter plan flow (`planNext`, 733-745).
- Tests: battle, battle-formats, robots, parts, and the seeded AI-vs-AI robot simulation (`tools/test/sim/`).

## Design

### 1. A random-number generator the battle owns
- New `game/js/logic/prng.js`: a small seeded generator (sfc32 or xoshiro128**), state of four 32-bit numbers,
  functions `makeRng(seed)`, `next(rng)`, `int(rng, n)`, `chance(rng, p)`. Same numbers in Node and every browser
  (integer maths only, no `Math.random`, no float tricks that differ by engine).
- The state lives in the battle (`b.rng`), so it is saved and replayed with it. Seeds come from the caller: a random
  seed for normal battles, a given one for tests, replays and friend battles.
- Every random draw in `logic/` battle code goes through `b.rng`. The battle screen's cosmetic randomness gets its own
  `fxRandom()` that never touches `b.rng`, so animations can't shift the results.
- Out of scope: random draws outside battles (encounters, uids in `rules.js`, `saves.js`). They stay on `random()`.

### 2. The battle works on its own state
- `createBattle({ sides, seed, rules, kind })` copies each fighter into a plain battle object (JSON-safe: no getters,
  no functions, no references into the save). Trainers are referenced by id.
- `act` and similar getters become plain functions (`actorOf(b, i)`).
- When the battle ends, `battleResult(b)` returns what changed (HP and statuses left, XP per fighter, items used,
  Billies seen and caught, money, drops), and `applyBattleResult(save, result)` writes it in one place. The engine
  never calls `save()` or `toast()` itself.
- The bribe roll, rewards, money lost and drops move from `battle.js` into logic (a move commit, then a test).
- **Ask me before:** what happens when the game is closed mid-battle (today the HP lost so far is already saved).
  Options: (a) keep the battle in the save and resume it, (b) treat it as a loss/flee, (c) apply what changed so far.
  Recommendation: (a), since the battle state is now JSON-safe anyway.

### 3. Inputs for both sides
- `runTurn(b, choices)` takes the choices of every side: `{ 0: [...], 1: [...] }`. Each side has a `controller`:
  `'player'`, `'ai'` or (phase 18) `'remote'`. The AI becomes a function that returns a side's choices
  (`aiChoose(b, side)`), called by whoever drives the battle, not by `runTurn`.
- Switching, pivot, `needSwitch` and XP are per side, not tied to side 0. Rewards and XP still go only to the
  player's side; that is a rule in `battleResult`, not a hard-wired index.
- The failed-catch path (`enemyOnly`) becomes a normal turn where the player's side has used its action.

### 4. A log that replays
- `b.log = { engine, rules, seed, sides, inputs: [] }`: `engine` is a version number bumped whenever battle results
  can change, `rules` a hash of the battle-relevant data (moves, types, statuses, rules.json battle keys, robot parts),
  `sides` the starting teams, `inputs` every turn's choices.
- `replayBattle(log)` runs it in Node or the browser and returns the final state and a short hash of it. Same log,
  same hash, or the replay says which turn first differs.
- Events keep being emitted for the screen, but carry ids and numbers (`{k: 'hit', a, d, dmg, eff}`) instead of
  English text; `battle.js` builds the text through `i18n.js`. The full snapshot on every event is cut down to what
  changed.

### 5. Effect handlers (Showdown-style, kept small)
- New `game/js/logic/effects.js`: one table, keyed by `fx` key, passive id and status id. An entry may define:
  `onTry`, `onHit`, `onAfterHit`, `onModifyDamage`, `onModifySpeed`, `onBeforeMove`, `onResidual` (end of turn),
  `onSwitchIn`, `onFaint`, `targets` (who the move may aim at, read by the engine and the screen), and `aiValue` (how
  the AI scores it).
- `useMove` runs the move through the hooks of its `fx` keys, the user's and target's passives and statuses, in a
  fixed order (move, then attacker, then defender; ties by a `priority` number in the entry).
- One damage function, `calcDamage(b, atk, def, move, { roll })`. With `roll: 'expected'` it uses no random numbers;
  the AI and the confusion self-hit use it instead of their own copies.
- Robots (phase 17) plug in the same way: part breaking, aimed moves and repair become handlers.
- `check-data.mjs` fails on an `fx` key, passive or status with no handler, and the moves schema lists the keys.

### 6. Out of scope (separate decisions)
Deeper mechanics (abilities per species, type immunities, held items in battle) and a stronger AI (switching,
looking a turn ahead) are design questions for phases 15 and 16. The handler table makes them cheap later.

## Tasks
Order matters: refactors first with results unchanged, then the one commit that changes the random numbers.
1. **Golden record.** Add a test that plays a fixed set of seeded battles (singles, doubles, Alpha, robots, a catch,
   a flee) with today's `reseed()` and snapshots every turn's events and the end state. It must pass unchanged
   through tasks 2-6.
2. **Move rules out of the screen** (bribe roll, rewards, drops, plan flow) into `logic/`, one move commit, then
   tests.
3. **One damage function** (`calcDamage` with `roll: 'expected'`); the AI and confusion use it. Golden record holds.
4. **Effect handler table.** Move one `fx` key per commit (or a few small ones together) from `useMove`/`aiScore`/
   `needsTarget` into `effects.js`; then passives; then statuses. Golden record holds after each.
5. **Data check** for `fx` keys, passives and statuses; plant one bad key to see it fail.
6. **Own state.** `createBattle` copies fighters; `battleResult` + `applyBattleResult`; getters become functions;
   trainer by id. Golden record holds (compare the end state after applying the result).
7. **Two-sided inputs.** `runTurn(b, choices)`, controllers, per-side switching/pivot/XP; the AI moves out of
   `runTurn`. Golden record holds.
8. **Seeded PRNG** (`prng.js`, `b.rng`, `fxRandom` for the screen). This changes every random result: regenerate the
   golden record in this commit and say so in the message. Check the robot simulation's win rates stay within the
   bounds agreed in phase 17.
9. **Log and replay** (`b.log`, `replayBattle`, version and rules hash). Event text moves to `battle.js` / `i18n.js`.
10. **Mid-battle quit**, as the owner decides (see "Ask me before").
11. **Fix the Lullaby text** or the rule, as the owner decides (rules.json says sleep lasts 2-4 turns, the move text
    says 1-3).

## Tests
- Replay: 200 seeded AI-vs-AI battles (random teams drawn from the game's data, singles and doubles, Billies and
  robots); each one's log replays to the same hash. A second run in the in-game full test checks the browser gets
  the same hashes as Node (tells us before phase 18 if any phone differs).
- Invariants (a fuzz run in `tools/test/sim/`, small sample in `npm test`, full run nightly): HP stays in
  0..max, no NaN in any stat or damage, every battle ends within a turn limit, exactly one side wins (or a flee/catch),
  the save is untouched until `applyBattleResult`.
- Every handler has a unit test on the fixture data; plant a fault in one to see it fail.
- The battle screen still plays a battle start to end (smoke), with no graphics settings changed.

## Ask me before
- Mid-battle quit behaviour (section 2).
- Lullaby: 1-3 turns or 2-4 (task 11).
- When to start: phase 17's prototype is in progress and touches the same file. Recommendation: finish and tag the
  phase 17 prototype first, then do this phase, then continue 16/17 on top of the handler table.

## Done when
All tiers pass, the golden record and replay tests pass, 200 replays match in Node and in the in-game test, `useMove`
contains no `fx`-specific code, nothing in `logic/` battle code calls `random()` or `Math.random`, HANDOFF is updated,
tag `phase-19-done`.

## First reply
A plan in Plan Mode: the golden-record battles you will use, the commit order, and anything in this file the code
proves wrong.

## Testing (phase 13)
Follow docs/TESTING.md: where new tests go, what must pass before the phase ends.

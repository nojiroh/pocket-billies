# Phase 04e plan: TypeScript and a boundary for the logic

Done (2026-10-18, phase 04e session): applied and finished as below, except that the artCacheVersion branches were
checked before deletion and the logic-only tsconfig went in. See the phase 04e entry in docs/HANDOFF.md.

Prepared during the phase 05 session (2026-10-18), alongside the renames. You asked me to make the recommended
choices, and the work to start in a new session once phase 05 is closed. The phase itself is
[04-modernize-codebase.md](04-modernize-codebase.md) (tasks 4 and 6). This file says what is ready, how to land it,
and what is still to do. The ready part is 22 commits as patch files in [04e/patches/](04e/patches/), made on the
phase 05 head (70b0872), plus [04e/files/](04e/files/) for what is not committed yet.

## Decisions (made, as you asked; listed again in HANDOFF)

- TypeScript **7.0.2**, the native compiler (released 2026-07-08), pinned exact. It gives the same results as 6.0.3 on
  this code (the same errors before the JSDoc, 0 after), runs 5-7 times faster (0.5 s instead of 2 s), and the JSDoc
  written here passes both, so going back to 6.0.3 means only changing the pin.
- JSDoc and `.d.ts` files, no `.ts` sources and no compile step: a file is checked when it starts with `// @ts-check`.
  `strict` on with `noImplicitAny` off (full strict gives 328 errors on the first four files alone).
- First files: data-files.js, game-data.js, map-files.js and game-state.js (the data and save formats), then the
  logic modules.
- The logic boundary is `game/js/logic/` (rules.js, saves.js, battle-engine.js) plus game-data.js (the tables). It has
  no browser globals (ESLint), imports only from logic, game-data.js, util.js, hooks.js and test-globals.js, and loads
  in plain Node (`npm run check:logic`, 0.2 s). It reaches the page only through 17 named seams in hooks.js.
- Kept for later: rewriting the logic to take its state as parameters (it changes saveData and activeBattle in place;
  that would be a behaviour change, and tests don't need it); the renderer interface and a null renderer (phase 13
  task 12); types for hooks.js's 212 slots (a generated hooks.d.ts; it needs a choice for the 64 names the game and
  the Studio fill differently).
- `dist/` leaves out `game/types/` (types are only for the check).
- The to-module.mjs fixes go in as their own commits (a comment right after the generated part stays where it is:
  the JSDoc on a module's first declaration depends on it; a blank line ends a module's header).

## Step 1: apply the 22 commits

```sh
git am docs/phases/04e/patches/*.patch
npm ci            # TypeScript 7.0.2 is a native binary, installed per platform as an optional package
npm run data
```

Done and checked in the phase 05 session, on 70b0872: `git am` applies all 22 with no conflict, and the result is the
tree that was tested. On every one of the 22 commits: tsc (from 0004 on), check:modules, ESLint, check-names and
format:check pass; build passes; each of the four moves passes `node tools/move-names.mjs verify` ("a pure move");
smoke passes 14/14 at the last commit (135 s); `tools/check-logic.mjs` (from 04e/files) passes 7/7 there. A
planted `s.route.plan` read in game-state.js is caught (TS2339: Property 'route' does not exist on type
'SaveData'). Not run: smoke after each move on its own, check-studio-github.py.

The commits:
- 0001-0002 `Code:` two small syntax changes TypeScript needs (an empty `if` body is a block; migrate()'s fresh trip
  says `hold: false`). Same behaviour.
- 0003 `Tools:` to-module.mjs keeps a comment that follows the generated part where it is.
- 0004 `Types:` TypeScript 7.0.2, tsconfig.json, game/types/game-data.d.ts, save-data.d.ts and globals.d.ts,
  `npm run typecheck`, and Prettier on the .d.ts files.
- 0005 `Tools:` in a checked file, to-module.mjs writes `// @ts-expect-error -- replaced on purpose` above each
  generated setter that replaces a function (TypeScript refuses those otherwise, TS2630).
- 0006-0009 `Types:` data-files.js, game-data.js, map-files.js and game-state.js are checked (JSDoc only; the review
  fixes are folded in).
- 0010 `CI:` the type check in the lint job. 0011 `Build:` dist/ leaves out game/types.
- 0012 `Code:` game-data.js reads `globalThis.GAMEDATA` (window on the page; a test sets it in Node).
- 0013 `Tools:` tools/move-names.mjs moves named top-level declarations to another module, and its `verify` proves a
  move changed nothing else.
- 0014 `Tools:` the game/js/logic/ rules (ESLint: no browser globals, limited imports; to-module.mjs: the logic exports
  every top-level name, for tests; vite.config.js). 0015-0018: fixes to the move tool and a comment.
- 0019-0022 `Move:` the rules outside battle (game-state.js -> logic/rules.js, 65 names), the save format
  (game-state.js -> logic/saves.js), the backup check validSave (settings-screen.js -> logic/saves.js), the battle
  engine (battle.js -> logic/battle-engine.js, 50 names). Same names; to-module.mjs rewrote the imports. game-state.js
  goes from 930 to 172 lines, battle.js from 2320 to 1299. The moves were made by the commands under "Move
  commands" below, and can be made again the same way if something changes first.

After `git am`: run smoke once after 0019, 0020 and 0022 if you want each move covered on its own (the session
covered the last commit only), and check-studio-github.py once (hooks.js changed).

## Step 2: what is still to do (one commit each)

- `tools/check-logic.mjs` (copy from 04e/files/; its own small data set, with the final key names),
  `"check:logic": "node --test tools/check-logic.mjs"` in package.json, a CI lint-job step
  (`- name: Logic in plain Node (game/js/logic/, no browser)` / `run: npm run check:logic`), and a README line for
  game/js/logic/.
- `// @ts-check` on the three logic modules (then `npm run modules` for the setter markers); fix what it reports with
  JSDoc only. The save code's JSDoc moved with it into logic/saves.js, but saves.js is not checked until it gets
  the line. A tsconfig for logic/ alone with no DOM lib would also prove "no browser" at the type level (optional).
- `roadsOf()` in game-data.js always returns []: the road's fourth entry has its own `a`/`b` (exit names), which
  overwrite the node numbers. Nothing calls it (only the test globals list it): delete it.
- `artCacheVersion` (ground-paint-worker.js, world-map-gl.js) and `seamlessHubMap` (studio/js/map-editor.js) are
  read as bare names behind `typeof` checks that are always false since 04d (the page that defines each never loads
  those files). Delete the dead branches and their two entries in eslint.config.js's OPTIONAL list.
- NAMING.md: one line for game/js/logic/ (logic that runs without a browser; reaches the page only through hooks.js).
- Optional, for the lint-plus-types budget (phase 13: 10 s; lint alone is ~9.5 s cold here): `eslint --cache` in the
  local lint script (2.7 s warm, same results; CI unchanged).

Close: fast checks after every commit, smoke at the end, check-studio-github.py; the full quick check is skipped
(your call for this phase too); HANDOFF entry; tag `phase-04-done`.

## Move commands (how 0019-0022 were made)

```sh
H=docs/phases/04e/files
node tools/move-names.mjs game/js/game-state.js game/js/logic/rules.js cleanName formatNumber stepsToKm newUid today plural pickWeighted xpFor maxLevel moveSlotCount teamSize jobSlotCount emptyJob stat maxHp movesAt makeBilly billyName allBillies findBilly gainXp canEvolve evolutionItemName evolutionHint splitPath evolve healAll toBox toTeam addBilly STEP_BRACKETS earningsBetween stepRate nextBracket rollDay gateOwner gateText blockerAt riderOf canRide riderName canEnter canLeave nextTripNode walkMode traveling gateMsg walkDistances pathFrom tripTo setTrip stopTrip resumeTrip hereLocation encounterPoolHere spawn addSteps eggSlotCount autoSlot addEgg hatchable hatchEgg assignJob collectJob endShift --after game/js/game-data.js --header "$(cat $H/header-rules.txt)"
node tools/move-names.mjs game/js/game-state.js game/js/logic/saves.js newSave newSaveKeepingPreferences migrate SAVE_VERSION saveAge loadSave SAVE_OLD_MSG SAVE_NEW_MSG --after game/js/logic/rules.js --header "$(cat $H/header-saves.txt)"
node tools/move-names.mjs game/js/settings-screen.js game/js/logic/saves.js validSave
node tools/move-names.mjs game/js/battle.js game/js/logic/battle-engine.js BATTLE_RULES CATCH_RULES newFieldState ACTOR_SIDE ACTOR_SLOT SIDE_ACTORS actorIndex fieldSlot fighter fieldState allActors liveActors foeSide actorTypes shockName isMulti effectiveStat actorSnapshot allSnapshots battleSay refreshLastSnapshot movePower calcDamage applyStatStages inflict retarget useMove endTurn award inherit benchCandidates doSwitch checkFaints alphaPhase aiDamage aiScore chooseAI newBattle joinNames makeAlpha startWild startTrainer battleStageKey runTurn enemyOnly catchOdds catchRoll teamNeedsHp canUse applyItem --after game/js/logic/saves.js --with-header --header "$(cat $H/header-battle.txt)"
```

After each: `git add -A game && node tools/move-names.mjs verify`, then the fast checks.

## Known risks

- hooks.js's slots are untyped (`any`), so a name a checked file imports from there is not checked.
- `noImplicitAny` is off: an untyped parameter is `any`. About 14 casts state what the code knows and the types can't
  see; each has a one-line reason.
- The `.d.ts` types repeat the JSON schemas: a field added in the Studio needs both updated.
- TypeScript 7 installs a native binary per platform as an optional dependency: `npm ci --omit=optional` or an
  unlisted platform has no compiler. Editors still bundle TypeScript 5/6 (the JSDoc here works in both).
- The logic modules run before map-files.js and game-state.js. At load they compute only from the rules data; the
  load-order check passes, but it is a static safety net.
- check-logic.mjs's SEAMS list fails when a logic module starts reading a new name from hooks.js (on purpose, a
  review point).
- A latent case, not reachable today: the trip code assumes every hop of a stored plan is a road, but migrate()
  checks only the first hop (a road deleted in the Studio would be walked for free). It can't happen while
  rules.travel is 'walk'; the casts there say so.

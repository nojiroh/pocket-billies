# Phase 08 plan: remove step tracking (Part A), then maps and rooms (Part B)

Prepared 2026-10-18 in the first phase 08 session. That session audited the code (read-only, at dba2d07), asked
you the phase's "Ask me before" questions and saved the answers here. No code changed. The phase itself is
[08-classic-movement-seamless-maps-rooms.md](08-classic-movement-seamless-maps-rooms.md). Work starts in a new
session from this file: say "start 08a-1".

Sessions: **08a-1**, **08a-2**, **08a-3** do Part A (each ends green and pushed); **08b** does Part B and tags
`phase-08-done`. Usage: the audit alone used about 2.9 M tokens and hit the account's spend limit, so each session
works directly, without workflows, with at most one review agent at a risky point.

## Your decisions

| Question | Answer |
|---|---|
| Money (steps paid most of it) | Prize money for wild wins. Trainers, bribes and challenges stay. Rematches keep full rewards until the 15/16 economy pass |
| Wild encounters | Visible Billies per map, from that map's pool, refilling over time (tap to battle, like today's grass tufts) |
| Eggs | Hatch by real metres walked **outdoors**: 2,000 / 4,000 / 8,000 m |
| Buddy | No XP from walking; the buddy gets full battle XP even when it didn't fight |
| Starters' Build/Hype split (level 32) | The player chooses in the evolution modal. The unused buddy-km evolution kind is deleted |
| Jobs | Removed until the ranch (phase 12) |
| "Walk N steps today", letter request | "Visit N places today"; the letter becomes a delivery to another town and back |
| Pace | A run button (hold; Shift on a keyboard) plus an optional "always run" setting |
| World map numbers | Real metres, measured from the maps |
| Stats (trainer card, Settings) | Distance walked (real km, the egg counter), play time, battles won, places visited |
| Lore that makes steps the currency | Rewritten as coins now |
| Map neighbours | Keep today's rule: one exit per neighbour, at most two neighbours per side, at least 44 m apart |
| Neighbour graph in data | Typed links: one record per link `{id, name, kind, a:{map, exit}, b:{map, exit}}` |
| Bigger-inside rooms | The room lives in its own space but is drawn at the door over the dimmed town (town hidden inside the room). If that misses the phone budget, plain separate space (option a) |
| Room fallback (9 s) and "Shops and houses: Counter" | Remove both, after measuring room open times (headless and from your phone's debug log) |
| Rooms as maps | Already `kind: 'room'` maps (map.schema.json:12); stays so, no separate interiors type |

## Conversion table (old step values to the new units)

Approved with the plan. Anything marked "proposed" can still be tuned when it lands.

| Old | Old value | New |
|---|---|---|
| Egg need (tiers `2`, `5`, `10`) | 2,667 / 6,667 / 13,334 steps (about 189 / 473 / 946 m walked) | 2,000 / 4,000 / 8,000 m outdoors. Labels come from `need`: "2 km / 4 km / 8 km egg". Tier ids stay (the code turns them into numbers: game-data.js:301-303, battle.js:1055, debug-menu.js:333, rules.js:651) |
| Encounter spacing | 1 per $500 earned (about 35 m), one global queue of at most 10 | Proposed: route maps stock 4, towns with tall grass 2, rooms 0; full on entry; 1 refill per 60 s of play; the first map starts with 3 gentle ones (was starterEncounters 3) |
| Step money | $1 / $0.5 / $0.1 a step, daily brackets 8,000 / 15,000, reset at midnight | None. Proposed wild-win prize: level x $20 (level 5 $100, level 30 $600; the median trainer reward is $1,600) |
| Buddy XP | 1 XP per 5 steps (about 2.8 XP a metre) | None; the buddy in the team gets full battle XP instead of teamXpShare 0.5 |
| Build/Hype split | (bsteps + psteps/2) / 1,333 vs wins (rules.js:308-312) | The player's choice |
| Job pay | 1 per 2,000 steps (about 142 m) | Jobs removed; game/data/jobs.json kept as content for phase 12 |
| Challenge kind `steps` | 3,000 / 5,000 / 8,000 steps today | Visit 2 / 3 / 4 different places today |
| Letter request | 800 / 1,500 / 2,500 steps since accepting | Deliver to a town 1 / 2 / 3 roads away and come back (reward x1.2 kept) |
| Road cost (roads.json `[2]`) | 1,150-2,160 steps = 14.07-14.16 x the two exits' walk `len` | Metres = lenA + lenB, worked out at load from the maps' edgeExits (82-153 m, 6,562 m in all); the guide routes by metres |
| Location `cost` | 0-3,640 on 43 of 49 locations; dead | Deleted |
| Rest stop | $100 (`rules.steps.restCost`) | $100, key moved out of `rules.steps` |
| Airship fare | Money, by the angle between towns (airship.js:58-61) | Unchanged |
| `goldOdds` 512, `alphaOdds` 45 | Under `rules.steps` | Moved to `rules.encounters`, one rename commit each (battle-engine.js:890 also reads goldOdds) |
| `stepsPerKm`, `brackets`, `encounterEverySE`, `maxEncounters`, `buddyStepsPerXp`, `jobs` | rules.json | Deleted |
| Pace | 3.4 m/s; stick at the rim x1.3, light push x0.6; the D-pad and keys always x1.3 (walk-view.js:3536) | Walk 3.4 m/s (stick x0.6-1.0), run x1.7 (5.8 m/s), D-pad and keys walk at x1 |
| Distance shown | km = steps / 1,333, so 1 km shown is 94.5 m walked | Real km from the metre counter |

## What the audit found

### Claims of the phase file
- Confirmed: in-game walking feeds a step pipeline (below); the 4x hurry exists (walk-view.js:3499-3503); seamless
  joins exist as composite views; rooms open in place with the town dimmed (walk-view-gl.js:5025-5052) and are
  bigger inside (14 x 11 or 18 x 12 m against buildings of 2.6 x 1.2 to 7.4 x 4.4 m); the 9 s fallback
  (ui.js:1156-1164) and the "quick" rooms setting (ui.js:1048; Settings > Game > "Shops and houses",
  settings-screen.js:296-303); the debug log sends nothing anywhere and has no step counts.
- Wrong: **camera sway and tilt are not step-driven.** Sway is the walking bob (walk-view-gl.js:3441, gated on
  moving); tilt is the gyroscope (walk-view-gl.js:1017-1031). Only the Studio dial is labelled "Step sway"
  (engine/settings.js:660).
- Wrong or stale: the 4x hurry is dead (steps travel mode only); the location `cost` is dead data, the live number is
  the road cost; `tools/join-places.py` is gone (25a5b64), joins are computed at runtime from roads.json exit ids
  and edgeExits (seamless-world.js:282-304) and nothing recomputes the road costs; exits are not shared (112 exits
  for 56 roads); there are three seamless switches plus `world.seamlessRooms`; there are 22 rooms, not 23, all made
  by tools/build-interiors.py (now out of sync with the room files); the README no longer mentions the fallback or
  the setting; settings have no step option, only text that shows steps.
- Shown km are about 10.6x too big: walking gives 14.1 steps a metre (walk-view.js:3584) but km use 1,333 steps
  (rules.json:15). Road ground used a third ratio, 12.5 steps a metre (seamless-world.js:126).

### Where steps come from
- The only live source: walk-view.js:3575-3590. Every metre moved in movePlayer's roam branch (joystick, D-pad,
  keys, tap-to-walk; rooms included; not ladders, test benches or the Studio) adds 14.1 to `P.stepAcc`; at 300 it
  calls `addSteps(n, true)`, about every 21 m.
- **Bug**: phantom metres. A new view moves the player after `ox/oz` are captured (walk-view.js:3418 vs 3462-3466;
  walk-view-gl.js:737 keeps the old x/z), so every app start, Continue, airship landing, glass lift and debug jump
  counts the jump to the spawn point as walked. The egg metre counter must skip that frame.
- Other callers: the debug buttons +1,000 / +10,000 steps and "Start a new day" (debug-menu.js:102, 207-212, 220),
  self-test.js:829-831, check-quick.py:504, 690, 1132, 1306, 1720, check-game.py:115, 168. No sensor, timer, URL
  parameter or service worker source.

### What addSteps drives (rules.js:553-625)
- Money: `saveData.se += earningsBetween(day.steps, day.steps + n) + seFrac` (556-563); `rollDay` resets at local
  midnight (381). `se` is the money (legacy "Sweat Equity"). Other income exists: trainer rewards on every win,
  rematches included (battle.js:1066; 46 of 48 trainers can be rematched), bribes after a failed catch (ui.js:3000),
  challenge rewards (things-to-do.js:104-125).
- Trip progress, only when `traveling()` (566-584): dead in walk mode.
- Encounters: `saveData.meter` counts dollars earned, a `spawn()` per 500 (585-594), into the global
  `saveData.queue` (cap 10; validSave caps it too, saves.js:227). The only grass-encounter source besides the
  starter's 3 (ui.js:2536), legends (story.js:261-262, they push into the same queue), fishing (fishing.js:393) and
  debug. Shown as grass tufts near the map hub (walk-view.js:3018-3077 encounterSpot, walk-view-gl.js:4806-4866)
  and as cards (ui.js:972-974).
- Buddy: `bsteps`, `buddyRem`, 1 XP per 5 (595-604); every other team member gets `psteps` (598-599); level-up
  toasts come from here too.
- Eggs: slotted eggs get `prog += n` up to `EGGS[tier].need` (605-607). Sources: the starter egg, a 12% wild-win
  drop (battle.js:1051-1063), 20 trainers' first win (battle.js:1070). bag.js:61 wrongly says shops give eggs.
- Jobs: `j.acc += n`, a pay per 2,000 (608-615); collectJob (rules.js:680-689). Jobs are step income too.
- Then a toast, `save()`, `render()`, `onStepsAdded()` (world-map.js:703, in practice a no-op) and
  `showPendingWindows()` (hatch, learn-move, evolution modals). The only other callers of showPendingWindows are
  event paths (ui.js:383, battle.js:1035/1113, story.js:426/437): the egg hatch check needs its own trigger.
  title.js:209-212 play time is persisted today only because addSteps saves every ~6 s.
- Read elsewhere: challenge kind `steps` (things-to-do.js:128-133, 162) and the letter request (212-215, 295-340),
  both seeded per day/town, so removing a kind reshuffles every day's picks; postcards.js:115 stores the whole
  `saveData.day` object (date and steps) per postcard.

### The dead 'steps' travel mode (still exercised by the tests)
`RULES.travel` (rules.json:2 is 'walk'), `walkMode()` / `traveling()` (rules.js:425-427). Dead in walk mode:
trip.prog and trip.hold, gateMsg / canLeave, the go/hold/blocked trip UI and progress bars, the exitPrompt steps
branch (ui.js:1547-1574), stay / resumetrip / turnback, walkState's 'road' and 'path' views (ui.js:1315-1350),
seamlessTripView / seamlessJoinTrip / seamlessPrefetch (seamless-world.js:1935-2059), the hurry and teleports
(walk-view.js:3434-3503), the 3x arrival hurry (ui.js:1386-1387, uiState.arrive set only at rules.js:577), the
ground-tap toasts (ui.js:1509-1521), stepsTo, the walker icon (person-art.js:882-894, ui.js:881-884), i18n.js:43-45,
CSS .nextstop/.trail/.walker/.wh-next and .demo-note. Live and kept: trip.node and trip.plan (the gold-arrow guide:
setTrip, tripTo, walkDistances by road cost; ui.js:1397-1404, walk-view.js:3974/4029; "Stop guiding me";
walkCross uses up the plan, ui.js:1647-1649). Note: story.js:203/231 skip rival intros and legends while a guide is
set (not step-related; left as is).

**Tests**: check-quick.py play() (503-510) adds 2,400 steps and sets `RULES.travel='steps'` for the whole run, smoke
included; only a041_walk switches to walk (1848) and back (1876). So the full check tests the dead mode. The
in-game full test's phase "Road: Marigold Town to Tallgrass Meadow on the ground" (self-test.js:801-869) runs a
steps trip without setting the mode, so it most likely fails on your phone today; it is guarded by
`typeof seamlessTripView === 'function'` (802), so deleting that function would make the phase vanish silently.
check-game.py has the same trip and also uses species that no longer exist; it is not in CI.

### Saves, types, debug log, friends, Studio
- saves.js newSave (48-93) writes se, seFrac, day.steps, totalSteps, trip.prog/hold, meter, buddyRem, eggs[].prog,
  jobs[].acc; validSave (184-263) requires them; migrate (153-159) repairs trip.prog with roadCost. A second
  new-game trip literal is at ui.js:2532. Types: game/types/save-data.d.ts, game-data.d.ts. There is no rules or
  eggs schema (game/data/schema has index, line, map, person, trainer). SAVE_VERSION is 2 (saves.js:171).
- Bumping SAVE_VERSION sets the save aside once (game-state.js:84-90, account.js:163-170), but only if no
  set-aside copy exists yet: a copy from the phase 05 bump means the current save is not kept.
- Debug log (debug-log.js): no step counts; it has `tripProgress` (414, always 0), the plan, 'travel' events from
  the setTrip wrap (665-670) and today's challenge targets (542-549). It wraps functions by name through the
  generated debug-log-names.js; a wrapped name that disappears gives a console.error, which fails smoke.
- Friends get name, look, partner and place only (friends.js:215-240, firestore.rules); account.js:196 shows the
  guest save's totalSteps to the player.
- Studio: world-rules-art.js (travel select 763-776, stepsPerKm 776, brackets 710 and 1001-1013, buddy steps per
  XP 799, jobs 852, egg "Steps to hatch" 552-556, road "Steps" column 315-322 with 800 as a new road's default
  335/408, dead location-cost sum 198-199), data-editors.js (buddy-km evolution 297/312-317, egg labels 351/357/
  473/1563, jobs 1450-1468), check.js (154, 168, 236-237), find.js:315, docs/STUDIO.md:25/31.

### Text the player sees
About 60 strings in the code and 16 in the data. Taglines "A walking RPG..." at game/index.html:7,
game/manifest.webmanifest:4 and ui.js:725 (README.md is already "A classic RPG"). Load tips boot.js:150-157;
NPC lines talk.js:197/200, walk-view.js:320/323; Hazel story.js:420 = cutscene.js:850 (keep both identical);
airship.js:9/75; "Not enough money. Walk a little first." (shop.js:128, dressing-room.js:766); the Today card,
brackets and step chips (ui.js:752-789, 923, 958, 961-975); eggs "K km" (ui.js:536, 892, 2064, 2547; bag.js:58;
battle.js:1061/1070); buddy, jobs, trainer card (ui.js:908, 1892-1906, 2147-2158); Settings (settings-screen.js:114,
424, 428); lore.json (world "Money and steps" 28-31, story 63, Verdigris 323, Mirrormere 358, book "The Step
Standard" 651-656, placed in int_library.json:55, airships 671, loading 690/700, chat 737); chat lines in int_shop,
int_library, int_school and marigold (stale copies in tools/build-interiors.py:50/138/150 and build-scenes.py:698/
740). i18n.js matches exact English text (rows 43-45, 80, 108-110): change or remove rows with their strings.

### Not step tracking: do not delete
The terrain step grid (map fields `steps`, `stepm`, `stepsV`; stepGrid, stepRaiseAt, canStepTo, MAX_STEP_RISE, the
Studio "Cliffs & stairs" tool; map.schema.json:22-23; map-files.js:49), `soundEffect('step')` footsteps, stepClimb
ladders, stepFolk, lifeStep, GLSL smoothstep, number-input `step=` attributes, CSS steps(), the test-step plumbing
(check-quick's @step, self-test phases, "marked steps" in debug-log.js), `stepstone_canyon` / `zenith_steps`, the
"Stone steps" tile, roomStepIn ("step in"), catching.integrityStep, connections.js "step 1-4".

### Pace today
WALK_SPEED 3.4 m/s (walk-view.js:298); stick tiers at 3536; dead zone 0.12, radius 56 px, drag start 14 px
(joystick.js). Tap-to-walk: walkTo (walk-view.js:3177-3193). Walk cycle 6 frames x 110 ms (walk-view-gl.js:4878,
4923), footsteps every 330 ms (sound.js:1112-1156), bob period about 1.07 s: all time-based, so they slide or
drift when the speed changes. Frame time is capped at 60 ms (walk-view-gl.js:3613).

## Part A: the order

One cause per commit; never a rename together with a behaviour change. After every commit: `npm run lint`,
`npm run typecheck`, `npm run check:logic`, `npm run check:data`, `npm run check:modules`, `npm run format:check`.
Any commit that removes or adds a module-level name runs `npm run modules` (hooks.js, debug-log-names.js, the test
globals) in the same commit. Smoke (`python3 tools/check-quick.py --smoke`) after each batch.

Not yet done: a review of this order against the code (it was started and stopped to save usage). Start 08a-1 with
a short read of the files each commit touches.

### 08a-1: tests off the steps mode, then delete the dead mode
1. Setup: `pip install -r tools/requirements-check.txt` (Python Playwright 1.56.0, which matches
   /opt/pw-browsers/chromium-1194) and `npm ci`; fast checks and smoke on the base. Recreate the tags locally:
   `phase-05-done` on 0c62318, `phase-04-done` on 12a3b58 (you push them; my tag pushes were refused). No "before"
   picture run: it would record the dead steps mode.
2. Fix the phantom metres (behaviour commit): skip the step accumulation on the frame the fresh view repositions.
3. A shared `cross()` helper in check-quick.py (teleport along findPath in steps of at most 0.8 m, calling
   walkCross; the a041 pattern, check-quick.py:1861-1871). Rewrite, one test per commit, as walk crossings:
   Walking (690), the v43 trip (1287-1312; its road-frame part builds every road's frame with dead code), and
   a04_copperleaf (1716-1723, "N steps on foot").
4. Rewrite the self-test Road phase (self-test.js:801-869) as a walk crossing with the same measurements (view
   changes, unready frames), before anything it is guarded by is deleted.
5. play() stops setting `RULES.travel='steps'` and the addSteps seed (set money, encounters and eggs directly);
   a041 drops its two toggles and the unused `st0`. Visible changes: "Staying in X" becomes "In X" (ui.js:809), the
   .walkbtns note shows (ui.js:970); pictures change.
6. Delete tools/check-game.py (stale, not in CI, its flows are in check-quick). Remove the second a02_ground() call
   (check-quick.py:1660-1661), its own commit.
7. Delete the dead steps travel mode, in deletion-only commits: the trip UI and actions, the road/path walk modes
   and hurry, the trip views and prefetch, exitPrompt's steps branch, uiState.arrive, onStepsAdded, the walker icon,
   stepsTo, walkMode/traveling, trip.prog/hold (newSave, validSave, migrate, ui.js:2532, the test literals at
   self-test.js:809/887 and check-quick.py:516/1718/1905, types), the Studio "How you travel" select, i18n rows
   43-45, the dead CSS. check-logic.mjs (315-336) changes with tripTo. Keep trip.node and trip.plan.

### 08a-2: the mechanics (one behaviour commit each)
Each commit removes its own part of addSteps and its save fields (newSave, validSave, types, check-logic) in the
same commit, and updates the quick-check steps, self-test checks and debug-menu buttons that read them.
1. Encounters: per-map stock from the map's location pool (pools.json; tall grass tiles 't'), stored per map in the
   save; legends and fishing keep their own way in; encounter cards show the current map's stock; no encounters in
   rooms. `meter` and the global queue go; validSave's cap changes.
2. Money: wild-win prize money; `day`, `seFrac`, the brackets and rollDay go (postcards.js:115 stores `Date.now()`).
3. Buddy: no walking XP; full battle XP for the buddy; `buddyRem` goes.
4. Split: the player chooses Build or Hype in the evolution modal; `bsteps`/`psteps` go; check-quick v36/v37
   (1099-1136) rewritten.
5. Delete the buddy-km evolution kind (rules.js:262-263, 289-290; ui.js:466, 903-907, 2026-2027; Studio
   data-editors.js:297, 312-317; game-data.d.ts:175).
6. Jobs removed (rules.js:608-615, 668-689; ui.js:1892-1906, 1949, 2445-2447; Studio cards); jobs.json stays.
7. Challenge "Visit N places today" and the letter delivery (things-to-do.js).
8. Eggs by the outdoor metre counter (`saveData.stats.walked`, metres; not in rooms, benches or ladders; skips
   jumps); `need` in metres in eggs.json; the hatch check runs when an egg reaches its need; play time saved on its
   own (title.js:209-212).
9. Delete addSteps, the step accumulator, the debug step buttons and "Start a new day", totalSteps.
10. Data: goldOdds, alphaOdds, restCost out of `rules.steps` (one rename commit each), then the rest of `rules.steps`
    deleted; location `cost` deleted with game-data.js:234, check.js:168, world-rules-art.js:199 and the writer
    tools/build-regions-v47.py:1430-1431; road length in metres worked out at load (the edgeExits stay in the boot
    bundle, map-files.js:49); the map chips, Places list and card show metres; the Studio road column shows the
    measured length, read-only.
11. SAVE_VERSION 3, once, after the save changes: your phone and cloud saves are set aside once and a new game
    starts.

### 08a-3: UI, text, Studio, run
1. Step widgets: the Today card and brackets, the .wh-steps chips (ui.js:923, 958), the trainer card and Settings
   tiles (distance in real km, play time, battles won, places visited), the restore and account-merge dialogs;
   their CSS (only the `.today`-scoped rules: `.mid` and `.se` are shared with battle HP bars and pops) and i18n
   rows.
2. Text, one commit per file group: taglines, load tips, NPC lines, toasts, egg labels from `need`, airship text,
   Hazel's line in both openings, room chat lines and their generator copies; lore as coins (text commits; the
   `steps` lore ids renamed in separate commits).
3. Studio: editors and labels follow the data ("Step sway" becomes "Walk bob": label only, the key `sway` stays),
   check.js, find.js, docs/STUDIO.md.
4. Debug log: drop `tripProgress`; keep the plan and travel events; the header and README say "no save data, names
   or movement history".
5. Run: the speed tiers, a hold-to-run button (like joystickDpad in joystick.js) and Shift, an "always run"
   preference (settings-screen.js:310-318, save-data.d.ts), D-pad and keys at x1; then the walk cycle, footsteps
   and bob follow distance walked (separate commit).
6. README, CHANGELOG; the full quick check (about 40 min), a new picture baseline, the in-game full test headless,
   a debug log export compared with the start of the phase, a HANDOFF entry.

## Part B (08b): outline and facts

### Maps today
- Exactly one way is used in play: the join. For each road, seamlessJoin (seamless-world.js:282-304) pairs the
  two named edgeExits and places the neighbour against the edge; the offset is the rounded exit difference
  (294-301). All 56 roads face each other, so all are joins. A place's view `w:<map>*` (seamlessHubParts
  1372-1464, seamlessCompose 766-1348) holds the map, a 36 m band of each neighbour (+-26 m round the exit) and 6 m
  of countryside. Crossing: walkCross (ui.js:1597-1657), walkMapSync shifts without a remount, seamlessGate holds
  the old view until the new ground is painted.
- The seam is runtime only: seamlessSeamOf (328-392), eased heights (398-470), tile mingling (911-936), sky and haze
  mixing (698-756). Raw heights at the exits agree within 5 cm, but along the +-22 m stretch they differ by up to
  2.09 m (clovercrest/mirrormere); within 6 m of the exit, three seams differ by more than 5 cm
  (zenith_steps/bellwether_rise 1.14 m, clovercrest/verdigris 0.29 m, marigold/driftwreck 0.14 m).
- Unused paths: the road frame (seamlessRoad 173-258 and its helpers, 'w:road' views), and the switches
  seamlessWorld.on (122/124, never false), engineSetting('world','seamless') (Studio dial, engine/settings.js:123,
  505-510), engineSetting('world','joined') (283, no default), engineSetting('world','seamlessRooms') (ui.js:1114)
  and 'roomDim' (walk-view-gl.js:5029). The Studio's "Add a road" makes roads with no exits ([i, j, 800]), which
  only the road frame could show.
- Neighbours: 19 sides carry two neighbours, none more; 112 exits for 56 roads; on 16 seams the exits are 0.04-0.45 m
  apart after rounding. The pairwise offsets don't form one plane (9 loops don't close, 13 map pairs would
  overlap): fine for per-place views, matters for phase 10.
- Positional readers of roads.json: game-data.js:231-242, the Studio (world-rules-art.js:308-408, check.js:233-237),
  check-quick.py:266/1275/1488, tools/build-scenes.py, build-places-v46.py, build-regions-v47.py, migrate-places.py,
  rename-places.py.
- Streaming: maps two roads round the start before boot, two roads ahead on every node change
  (map-files.js:135-148), then all maps in the background (149-159); nothing is released. All 91 maps parsed are
  about 11 MB of JS heap (7.1 MB on disk; place maps 38-416 KB, rooms 3-5 KB). Composites are capped at 5 + roads,
  ground caches 2-4, GPU views 3. Walk mode has no prefetch before a crossing (seamlessPrefetch is steps-only).
  performance.memory is missing on iPhone Safari.
- Existing seam checks: check-quick a02_joins (1663-1694), v42 (1249-1285), paths (590-603), copperleaf_data
  (255-294). check-data.mjs only checks that road ends are stops. The Studio's facing check doesn't check facing
  (check.js:340-357).

### Rooms today
- 22 `int_*` maps: 17 of 14 x 11 m, 5 of 18 x 12 m. int_house serves 270 buildings of 18 kinds. int_station is gone
  but still listed in build-interiors.py, the Studio (map-editor.js:370, 1641) and ROOM_GAP_BY_KIND
  (seamless-world.js:1555).
- Link: roomFor (ui.js:1047-1057): the prop's `room` (6 props), then ROOM_BY_BUILDING by kind or group, then
  ROOM_BY_USE by act. Door point per catalog kind (scenery.json `door.x`), mirrored and scaled; `p.rot` ignored
  (251 of 342 enterable buildings turn up to 6 degrees); the room origin is rounded (up to 0.5 m off).
- Placement: stamped into a copy of the town view (seamlessRoomMap, seamless-world.js:1722-1899); town props in
  the room and a 3.2 m strip in front are removed; the nav grid blocks everything outside (walk-view.js:2736-2749);
  the town is dimmed, not culled. Estimated in each town's own coordinates: 303 of 342 room footprints cover
  another building.
- Four paths: in place; the 9 s fallback; standalone when roomLayIn returns null (Marigold's sign_shop and
  sign_clinic have no box, marigold.json:479-480; test benches); none with "Counter". The wait exists because each
  building's view has its own ground: room art, a CPU repaint of about 50 x 45 m and a GPU mesh per entry.
- Leaving puts you 0.6 m in front of the door facing down (ui.js:1183-1200); the camera is shifted, never restored.
- int_home is empty in the data and furnished at runtime by changing gameData.maps.int_home.props
  (things-to-do.js:429-478, HOME_SLOTS 449-462 is already a slot template).
- Furniture: 64 kinds, the most shared are plant_tall (17 rooms), wall_clock (13), shop_counter (8, always at
  w/2, 6.4-7.0 with the keeper behind).

### Part B tasks
1. Remove the road frame and the switches; an unjoined road is a data error (check-data.mjs; the Studio forces
   exits).
2. roads.json becomes typed links `{id, name, kind: 'seam' | 'lift', a: {map, exit}, b: {map, exit}}` by map id; the
   offset is derived and validated; one data commit snaps the 16 exits that are slightly off. The glass lift
   (kelpport, pearlantis; airship.js:283-347) is a `lift` link. Doors: 342 buildings and props have no ids, so the
   door link lives on the building (a default per kind in scenery.json, an optional override on the prop) in the
   same link shape, checked by the same validator. Every positional reader changes in the same commit.
3. Seam naming: already `seam` in the code; check the data and docs.
4. Validations: in check-data.mjs (every exit used by one link end, partners exist and face each other, at most
   two per side and 44 m apart, widths equal, no solid prop in the crossing corridor, path tiles at the exit); in
   the browser, the crossing and the eased heights (within 5 cm), raw differences reported.
5. A prefetch near an edge (about 40 m), map-load and memory counters in the debug log; measure before and after;
   release far maps only if the numbers ask for it.
6. A seam screenshot walk: the six hardest seams in the full check, all 56 behind a flag.
7. Rooms in their own space, drawn at the door over the dimmed town (the town hidden inside the room, its ground and
   props not rebuilt), one path, no fallback, no Counter setting; the door uses the building's rotation; leaving
   puts you at the door facing out with the camera as it was. Measure room open times first (headless, and the
   "inside ... (waited N ms)" lines from your phone's log).
8. Room checks: door within 0.1 m, exact position and camera after leaving, no room collision outside, the nav grid
   outside unchanged.
9. Room templates: a shell (size, walls, door, look) plus named slot sets (counter and keeper, back wall, corner
   plants, lounge, storage), a floor and wall colour per room; home filled from the save; int_station leftovers
   removed; tools/build-interiors.py retired (it is out of sync).
10. The Studio views and edits the links and doors. Full check, baseline, HANDOFF, `phase-08-done`.

## Risks
- Order: the quick check runs in the steps mode, so tests move first (08a-1) or most of it turns red at once.
- No grass encounters, no income or no egg progress between commits: each mechanic's replacement lands in the same
  commit that removes its part of addSteps.
- The quick-check pictures change by design (walk mode, removed widgets). No picture baseline exists anywhere yet
  (no phase tag was ever pushed); the end of 08a makes the first real one.
- Your phone save starts over once (save format 3).
- Rooms drawn over the dimmed town is the biggest renderer job of the phase and must fit the phone budget.
- Many lines in ui.js are over 300 characters; reformatting goes in its own no-op commit.

## Setup notes for this container type
Python Playwright and node_modules are not installed by default: `pip install -r tools/requirements-check.txt`,
`npm ci`. Node 22. No validation/ directory. The full check takes about 40 minutes; smoke about two.

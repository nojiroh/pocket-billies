# Intro track (IN) - a cold open: the crash, a prepared first run, then the story

Branch: track/intro

The owner asked (2026-10-29): "The new intro brings you faster into the game. You start at a preprepared run. The
player character wakes up next to a crashed skytrain. Chosen and Kappi are also there. They let you choose from the
starters and give you 5 pyramids and a potion. You then start the run. Kappi sometimes gives tips on what to do for
the player. Don't be too handholdy. When the player finishes the run or dies he'll be picked up by the agency and
thrown in a square portal. Then a part of the old intro plays but it's changed to fit this. You still fall from the
sky, no hollow earth. The player wakes up at the lab and Kappi and Chosen talk shortly and explain the expeditions."
IN-0 (this file, docs only) was written on `track/intro`, made from main bb658f52 on 2026-10-29.

**Status:** IN-0 done (2026-10-29): the plan, with the owner's answers (section 1). Next: wave 1 (IN-1 to IN-4),
waiting for the owner's go-ahead to start.

Before editing, every session checks the facts it relies on against main and says in its HANDOFF entry what
differs: they come from read-only audits on 2026-10-29 (main at bb658f52). Line numbers drift; find lines by text.

## Contents
1. The owner's answers
2. The new path, end to end
3. What the code does today (audit)
4. The research, in short
5. Sessions
6. Ask me before
7. Not in this track
8. Risks
9. Sources

## 1. The owner's answers (2026-10-29)
Sessions act on these without asking again.
- **No Hollow Earth in the intro only.** The intro loses its Hollow Earth captions ("Inside the planet / The Hollow
  Earth", "The Inner Sun", "You landed in | {place}" with its Hollow Earth fallback) and Chosen's "comes down through
  the crust" line. The setting stays in the lore, the tagline and later chapters (VISION.md unchanged on this).
- **You make yourself up at the lab**, not at the crash: the crash and the first run play with a default look and no
  name; the dressing room (look and name) opens when you wake at the lab.
- **The prepared run is short:** the short-run shape (6 rows with the landing, 1 mini-boss), about 10-15 minutes.
- **The payout is shown at the lab**, after you wake (Kappi tallies it), not between the run's end and the portal.
- **The first run keeps your starter and every Billie you caught, win or lose** (the usual loss rule, "keep one", starts
  with the second run).
- **The first run's boss is a Bureau retrieval bot**, which ties the run to the pickup.
- **You wake outside the lab door**, as today (not inside the lab).
- **Kappi is a voice during the run:** a short bubble with Kappi's face, not a follower.
- **The first run is hard: a simulated win rate of about 20%.** Most players lose, Hades style; the pickup makes the
  loss part of the story.
- **No starting money:** exactly 5 pyramids and 1 potion. Money comes from the run's battles, as in any run.
- **Returning players are offered "Skip the crash"** once it has been finished on this device.
- **Sessions run on their own:** each session plans and builds without waiting for approval (this answer is the
  approval), stops only on an item still in section 6, and wave 2 starts on its own once wave 1 is merged.
- **Dialogue:** sessions write the lines as drafts in the cast's voice, build them in, and list them in their HANDOFF
  entry for the owner to change afterwards.
- **Art:** built straight in, with screenshots in the HANDOFF entry; the owner judges it on the phone.
- **The crash's cause:** one line from Kappi (a square of light in front of the train; nobody else saw it), paid off
  in the lab scene.
- **This reverses an earlier decision:** roguelite-track.md section 3 rejected a scripted first run ("hints instead",
  2026-10-20). That line gets a note pointing here (IN-6). VISION.md's "Since RL-8 New game plays the fall alone" line
  is rewritten to the new path (IN-6).

## 2. The new path, end to end

| # | Beat | Who drives | Target length |
|---|---|---|---|
| 1 | **Title → New game.** No logos, no account prompt in the way. | - | - |
| 2 | **The crash (cold open).** Black, a thud, eyes open (`blink`, `screen waking`): you lie on the run's landing beside a crashed sky train (one of Skyline Station's five, a wreck with smoke). Chosen climbs out of the wreck, Kappi checks on you. Amnesia stays (no name yet: it is asked at the lab). A square of light was in front of the train: Kappi saw it, nobody else did (one line, the hook). | cutscene | under 60 s to the pick |
| 3 | **The starter pick.** The train's cargo: three pyramids. Chosen throws them (`throw-coins`), the existing pick card (`pick-starter`): idle rigs, type, Strong against / Weak to, one personality line; stats stay behind a tap. Not blind. | player | - |
| 4 | **The gift and the goal.** Kappi hands over 5 pyramids and 1 potion (no money). One line points the way: the station's rescue beacon is past the far end (the boss). No item tutorial. | cutscene | 2-3 lines |
| 5 | **The prepared run.** A hand-written map (section 5, IN-1): one new idea per place. Kappi's tips fire only when you struggle or stall (IN-2). | player | 10-15 min |
| 6 | **The pickup, win or lose.** In the place where the run ended, two Bureau clerks (bots) walk up (the story stage's run-up), stamp you (`RETURNED TO SENDER` on a loss, `RECOVERED PROPERTY` on a win: the Bureau stamps exist since DL-7) and a square portal opens under you. | story stage | 15-20 s |
| 7 | **The fall, shortened.** The existing world-map dive (`fallOverWorldMap`), started from the square portal's light instead of the crust, no captions, onto Copperleaf's landing spot `me`. | cutscene | 6-10 s |
| 8 | **Wake at the lab.** The opening's set outside the lab door (shots `drop`, `wake`, `door`...). Chosen runs out ("You came out of the sky. Again."; they caught the next train home), Kappi follows. The dressing room (look and name). Kappi tallies what you brought back: the payout sheet. Chosen and Kappi explain expeditions in about 4-6 lines (Skyline Station, every trip a new region, what you keep), Kappi names the square portal as the Bureau's. | cutscene + payout | about 60 s plus the payout |
| 9 | **The hub, in control.** By the lab, the welcome points at Skyline Station. Daily/Weekly chips open (`meta.runs >= 1`), the `first_run` milestone is paid, Dottie is home (she joins free on the first run, as now). | player | - |

Killing the app anywhere reopens at the start of the beat it was in: the crash (before the pick), the run (as any run
resumes today), the pickup or fall (reopens at beat 8), the lab (at beat 8, or the payout if it was open).

**Returning players:** once the cold open has been finished on this device (a local flag, like today's
`nw-opening-done`), New game offers **Skip the crash**: the pick card alone, then beat 8 without the payout (a run of
zero places). The debug menu and fixtures can jump to each beat.

## 3. What the code does today (audit, 2026-10-29, main bb658f52)

### 3.1 The opening
- New game: `ui.js` `case 'intro'` → `cutsceneStart()` (`cutscene/opening.js`): preload, `fallPlay(run, {from:'crust'})`
  (`opening-fall.js`; the street leg skipped; `fallOverWorldMap` with the two Hollow Earth captions; `fallHold`),
  then Copperleaf's walk view and `cutscenes/opening.json` with the extra commands `dressing-room`, `throw-coins`,
  `pick-starter` (plus unused `staged-fight`, `rival-battle`), then `cutsceneEnd` → `startGame(l)` (`ui.js`): a fresh
  save in Copperleaf, the starter at level 5, 3 wild spawns, the welcome modal.
- The script's last lines still say "See the airship at the mast?" (`#l:9e1c`), while runs leave from Skyline Station.
- Skip (`skipCutscene`, the Skip button and Escape) runs every wait at once and stops at the dressing room and the pick.
- `saveData.started` is the only gate (no `introDone` flag). `cutscene.test` and `uiState.intro` are vestigial.
- Leftovers: Blake's battle tutor ("HOT TIP", `opening-fall.js` `battleTutor`/`battleTip`, `#btip`; dormant since
  RL-8), `staged-fight.js`, `story.json` `blake-first-battle`, `logic/chosen.js` tips and hot takes, spot/shot/music
  names from the old professor Hazel. `openingCity` (the city) is never called; city.json stays parked.
- `tools/build-copperleaf.mjs` rewrites opening.json's spots, shots and clear relative to the lab door: a new cutscene
  on that set must be added to it, or kept out of its reach.

### 3.2 Runs
- `runTakeOff(seed, map, mods, pick, expedition, board)` (`run.js`) → `runStartPlan` (`logic/run-start.js`: a plain
  map object in the plan) → `runStartOn(s, plan, {home, pack})` → `runBegin` (`logic/run-state.js`: `run.start` =
  the hub snapshot; the gift from `rules.json run.start`, today $600, 5 pyramids, 2 potions) → the train ride →
  `runArrive(s, 0)` on the landing.
- A fixed seed works everywhere. **A fixed map does not exist**, but `plan.map` can be replaced between `runStartPlan`
  and `runStartOn` (the self-test's `baselineRun` does). **Scenes are always made by mapgen from the node seed**
  (`MAPGEN_VERSION` 27): a pinned seed's places change when mapgen changes.
- No rest or catch node; towns have a paid clinic. Wild stock: `encountersHere`/`spawn` (`logic/rules.js`).
  Leaders and the boss: `runFoes` (`logic/run-loop.js`); Expedition I's boss is the Voltron (`runBossFor`).
- The end: `runOver(win)` → the payout (`run-payout.js`) → "Ride home" → `runEndHome` → `runEnd` (pays `meta`,
  restores the hub fields, merges kept Billies, `meta.runs`, `historyPush`) → `storyHomeArrive` (`back-lost` on a
  loss) → the train home.
- **Hints:** `RUN_HINTS` / `runHint(id)` (`run.js`): toasts once per run while `meta.runs` is 0 (landing, map,
  town, event, stall, miniboss, scrapyard, boss, rival, relic). No companion speaks during runs.
- Bubbles in the world: the buddy's `say` label (`world-billies.js` `buddyTap`, drawn by `walk-view.js`
  `drawSpeech`); the dialogue box (`talk.js`, stacked bubbles, markup).
- Balance: the run simulation has never won with a fresh level-5 party (HANDOFF archive).

### 3.3 Checks that see the intro
- `tools/check-quick.py` `phone_flow` (in `--smoke`): plays the real opening, dressing room, pick, then expects
  `copperleaf`, no battle, the welcome, then the station's "Start a run" sheet. **Breaks with this track** (IN-5).
- `tools/test/opening-script.test.mjs` + `opening-said.json` pin the opening's 21 lines and commands.
- `self-test.js`: "Opening: falling..." (films `fallOverWorldMap`), the lab room phase, the cleanup; its run phases
  use their own seeds and are not touched.
- `check-fast.py` `boots` (the title over Copperleaf), the fall camera step, `lab` (the `first_run` milestone).
- `check-quick.py` `starter_rigs` (starters musk, bezos, gates). `check-data.mjs` reads every cutscene.

## 4. The research, in short (sources in section 9)
- **Speed:** mobile day-1 retention has a median of about 23%; practitioner guidance is core play within about 60 s
  and teaching through play, not text. The hook first: the first thing touched is the best mechanic.
- **Death as story:** Hades makes the hub reachable only by dying, and critics note that winning early then skips
  content. Here the pickup plays on both outcomes. Cult of the Lamb plays first and gives the purpose after the first
  death: the same order as crash → run → lab.
- **Easing in the open:** Slay the Spire's Neow eases a first run with a visible, in-fiction blessing, never hidden
  rigging. Here: the first run's wild ones "look dazed from the crash" (lower levels, said aloud once).
- **One idea at a time:** Mario 1-1 and kishōtenketsu (introduce, develop, twist, conclude): one new idea per place.
  Balatro's first runs plant one "aha" reward.
- **Hints on struggle, capped:** NSMB Wii's Super Guide waits for 8 deaths; Uncharted waits minutes; a stuck timer
  starts when the goal becomes active and resets only on real progress. Inscryption's talking Stoat is the model for
  Kappi: a companion that remarks, not a tutor. World cues (a pulse, a brighter tile) before words.
- **Starters:** personality and art first, stats behind a tap; never blind (Cassette Beasts' blind pick annoyed
  players); say the pick mostly matters early.
- **Pitfalls:** unskippable or replayed tutorials are the top complaint; text walls; a scripted run that feels fake.

## 5. Sessions

Two waves. Wave 1's four sessions touch different files and run **at the same time**, each on a side branch
`claude/in-<n>-<words>` with a draft PR into `track/intro` (the VFX track's pattern). Wave 2 needs wave 1 merged.
Shared hot spots: `game/js/hooks.js` is generated (`npm run modules`): on a merge conflict, take either side and
re-run it. `run.js` is touched by IN-2 (the `RUN_HINTS` block only) and IN-4 (`runOver`, `runEndHome`, the payout's
order only). Every session runs lint, type-check, unit tests and `npm run check:smoke` before each commit, keeps
Start-Game, phone mode, the Studio, the in-game full test and the debug log working, and writes a HANDOFF entry.
Until IN-5 lands, New game still plays today's opening, so every wave 1 session builds behind a debug entry.

### Wave 1 (parallel)

#### IN-1 The prepared run (logic and data)
- `game/data/firstRun.json` + schema: the map written by hand, 6 rows: **landing** (the crash site) → **route** (two
  lanes: the right lane holds a pinned weak, catchable wild one; the left a type-advantage fight against the starter's
  counter type) → **town or waystation** (a choice of lanes: clinic and shop, or an event) → **mini-boss** (one leader,
  doubles; a reward pick after it with one planted "aha" item) → **town** (the rule: a town after each mini-boss) →
  **boss** (the Bureau retrieval bot, Alpha). Node types, biomes, lanes, encounter species and levels are data;
  places are still made by mapgen from pinned node seeds.
- `runStartPrepared(s)` in `logic/run-start.js`: `runStartPlan` with the file's seed and short rules, then the map
  replaced from the file, then `runStartOn` with the gift (`rules.json run.first`: 5 pyramids, 1 potion, no money)
  and no train ride (you are already on the landing). `run.first = true`. The gift is `{se: 0, pyramids: {pyramid:
  5}, items: {potion: 1}}`: the town's shop and clinic are paid from what the route's battles earn.
- The keep rule: `runEnd` keeps the starter and every Billie caught when `run.first` (win or lose).
- The boss: a small Bureau bot ("Retrieval Unit", name provisional) in `bosses.json` on RL-14's bot parts; Expedition
  I's Voltron is unchanged.
- The crash site: the landing gets the wreck as a set piece at a spot pinned relative to the landing's mast, and the
  file exports named spots (`wreck`, `me`, `chosen`, `kappi`, `star1..3`) for IN-5's cutscene.
- Balance with `tools/test/sim/run-sim.mjs` on the file: **target win rate about 20%** (the owner), with the route
  and the first town fair (the sim should rarely lose before the mini-boss) and the boss as the wall.
- Tests: the file reads and validates (`validRun`), the map is the file's, the keep rule, a snapshot of the prepared
  run's places that fails when mapgen moves them, so a mapgen change shows up as a picture to look at.
- Debug: debug menu "Prepared run" starts it on any save copy.

#### IN-2 Kappi's tips
- `game/js/logic/kappi-tips.js` (pure, tested in Node) and `game/data/kappiTips.json`: each tip is a trigger, a
  line and a cap. Triggers on struggle or stall only:
  - 2 failed catches in a row; the first faint; a Billie under a third of its HP with a potion unused for a whole
    battle; out of pyramids with a wild one in view; about 20 s on a choice sheet (reward pick, event, shop) without
    progress (the timer starts when the sheet opens, resets only on a real choice); about 60 s on a place without
    moving toward a road out; the first fight against a type that beats the lead Billie.
  - Caps: no tip in the first battle, at most 1 per place, about 5 per run, each tip shown once ever
    (`meta.tipsSeen`), never during a line or a menu animation.
  - World cues first where they exist (a pulse on the pyramid button, the next road's marker) and Kappi's line only
    if the cue didn't help.
- Kappi's voice: a short bubble with Kappi's face (talk.js stacked bubble, not the blocking box), tap or 4 s to dismiss.
  In battle, the dormant `#btip` card is reused in Kappi's skin. A voice only (the owner): Kappi does not walk with you.
- `RUN_HINTS` toasts: on the first run they become Kappi's world-cue tips or are dropped (the landing toast is the
  crash scene's own last line now); the second run on keeps them as toasts while `meta.tipsSeen` lacks them.
- Settings: "Kappi's tips" on/off (on by default). After the first run tips fire only for things not yet seen.
- Tests: the trigger rules and caps in Node; a check-fast step that fails a catch twice and sees one tip.

#### IN-3 The art: the wreck, the square portal, the clerks, the boss
- **The wreck:** a crashed sky train from `tools/build-station-trains.py`'s train (a nosed-in front carriage, a
  tipped second one, the sky rail's broken piece, cargo crates with the Bureau's `bureau_crate`), smoke from the
  VFX track's particles. Low-poly, 32 px/m (CLAUDE.md).
- **The square portal:** the Bureau's portal, square like a filing drawer (Kappi's DL-7 line "like someone shutting
  a drawer"), light only like `sky_portal`, opening from a line to a square; built from the `portal_door` mockup's
  frame. A prop plus an "opens" animation.
- **The clerks:** two Bureau bots for the pickup (RL-14's parts), with a stamp pose.
- **The boss's look:** the retrieval bot from RL-14's parts (IN-1 uses its id).
- Built straight in (the owner); `tools/look-*.py` style shots of each go in the HANDOFF entry.

#### IN-4 The way back: the pickup, the fall, the lab
- **The pickup:** a story script (`story.json`, `pickup-lost` and `pickup-won`) played by the story stage in the place
  the run ended: the clerks run up, the stamp, the square portal under you (IN-3's prop, a stand-in until it lands).
  Called from `runOver` when `run.first`, before the payout.
- **The fall:** `fallPlay(run, {from:'portal'})`: the square portal's light as its first frame, then
  `fallOverWorldMap` with **no captions**, onto `me`. The crust and street legs stay for the story to bring back.
- **The lab:** `game/data/cutscenes/return.json` on the opening's set (map `copperleaf`, spots and shots from
  `opening.json`, added to `tools/build-copperleaf.mjs`): wake, Chosen and Kappi, `dressing-room`, then a new
  `payout` command that opens the payout sheet in the scene, then the expeditions lines, then the hub. `cutsceneEnd`
  for this scene finishes the run (`runEnd` without the train home) instead of `startGame`.
- Save and resume: a run phase `return` (after `payout`): a reload in the pickup or the fall reopens at the lab.
- The lines are drafts in the cast's voice (DL-7's markup), built in and listed in the HANDOFF entry for the owner.
- Tests: a script test like `opening-script.test.mjs` with its own `return-said.json`; resume from `return`.
- Debug: "Jump to the pickup (win / loss)" in the debug menu.

### Wave 2 (after wave 1 is merged into `track/intro`)

#### IN-5 New game: the crash scene, wired end to end
- `game/data/cutscenes/crash.json` on the prepared landing (IN-1's spots; the cutscene moves with the landing like
  a place's hub): wake, Chosen and Kappi, the square-light line, `throw-coins` from the wreck's cargo,
  `pick-starter`, the gift, the way. Under 60 s from New game to the pick.
- New game (`ui.js` `intro`, `title.js` `titleNew`, Settings' "Erase and start over") → a new save made at the crash
  (`started`, the starter, a default look, no name) → `crash` → `runStartPrepared` → the run. `startGame` keeps its
  hub half for Skip the crash and fixtures.
- The old opening's start-of-game half (`opening.json` beats before the pick, the Hollow Earth captions,
  "through the crust", the airship lines) leaves the New game path; `opening.json` is replaced by `crash.json` and
  `return.json` (git has it). Dead code goes: `staged-fight.js`, the HOT TIP tutor (unless IN-2 reused `#btip`),
  `blake-first-battle`, `cutscene.test`, `uiState.intro`.
- Skip the crash (section 2) and the device flag; the debug menu's beat jumps.
- **Tests rewritten in the same session:** `phone_flow` (New game → crash → pick → the run's landing → `runlose` →
  pickup → fall → lab → dressing room → payout → hub, by the station), `opening-script.test.mjs` →
  `crash-script.test.mjs`, the self-test's opening phase (films the shortened fall), `check-fast.py` `boots`
  (unchanged: the title is still over Copperleaf), `lab`, `starter_rigs`.

#### IN-6 Phone pass, numbers and docs
- The owner plays it on the phone and sends a debug log. The debug log gains a first-session line: seconds from New
  game to the pick, the first battle, the first catch, the run's end and the hub, and where a quit happened (beat and
  place; no names or save data, CLAUDE.md).
- Tuning from the log: the boss, the planted catch, the tip timers.
- Docs: CUTSCENES.md (the new scenes and commands, the old opening's notes out, Escape skips), VISION.md's opening
  line, roguelite-track.md section 3's note, ROADMAP.md, city-opening-beats.md's stale "New game plays it" line,
  BRANCHES.md's row. Then the `intro-done` tag and the branch's deletion (docs/BRANCHES.md).

## 6. Ask me before
All five first-draft items were answered on 2026-10-29 (section 1). Still the owner's:
1. **Merging into main:** `track/intro` goes to main by one draft PR after IN-6; the owner merges.
2. **Anything that changes a later run** (not the first one): the usual gift, the loss rule, run balance, the
   `RUN_HINTS` toasts beyond the first run.
3. **Deleting the Hollow Earth from anything outside the intro.**

## 7. Not in this track
- The city opening (stays parked for the story).
- Removing the Hollow Earth from the game (the owner: intro only).
- The ranch, the unlock board and later expeditions' onboarding (their own tracks).
- Accounts and online: the cold open asks for nothing; sign-in stays on the title and in Settings.

## 8. Risks
- **Mapgen drift:** the prepared run's places are made by mapgen; a mapgen change moves them. IN-1's snapshot test
  makes it visible; the wreck and the cutscene hang off the landing's mast, not absolute points.
- **A save before the hub exists:** the first save is made in a run with no hub visit; `run.start`'s hub snapshot
  is a fresh hub. `runEnd`, `saveFill` (a started save with no Billies becomes a new save) and resume need care.
- **Two run endings:** the first run ends through the pickup and the lab, every later run through the payout and the
  train. Keep one `runEnd`; only the presentation differs.
- **Parallel sessions on `run.js` and `hooks.js`:** see section 5's hot spots.
- **Balance:** the fresh party has never won in the sim; IN-1 tunes the prepared run alone, not runs in general.
- **Phone cost:** the wreck's smoke and the portal on weak phones: follow VFX-20's quality ladder.

## 9. Sources
- GameAnalytics benchmarks (via Game Dev Reports): https://gamedevreports.substack.com/p/gameanalytics-benchmarks-in-mobile
- Mobile onboarding: https://blog.playio.co/mobile-game-onboarding-retention, https://liquidandgrit.com/first-time-user-experience-ftue-toolkit,
  https://unity.com/how-to/10-first-time-user-experience-tips-games
- Hades and death: https://inlander.com/culture/hades-writer-greg-kasavin-on-how-he-made-video-game-deaths-drive-a-feel-good-story-22725237,
  https://criticalvideogamestudies.com/hades-death-and-the-players-experience/
- Slay the Spire's Neow: https://slaythespire.gg/guides/strategy
- Cult of the Lamb: https://www.levelup.com/en/news/693769/Cult-of-the-Lamb-Creating-your-cult-has-never-been-this-fun
- Inscryption: https://en.wikipedia.org/wiki/Inscryption
- Balatro's signposting: https://gamedeveloper.com/design/balatro-creator-unveils-a-few-slick-signposting-strategies
- World 1-1 and kishōtenketsu: https://en.wikipedia.org/wiki/World_1-1, https://www.gamedeveloper.com/design/the-secret-to-i-mario-i-level-design
- Hints: https://www.mariowiki.com/Super_Guide_Block, https://bugnet.io/blog/how-to-fix-contextual-hint-that-never-fires-when-the-player-is-stuck,
  https://www.wayline.io/blog/build-effective-game-tutorials
- Starters: https://www.thegamer.com/cassette-beasts-starter-choice-guide/
- Skippable tutorials: https://bugnet.io/blog/how-to-design-a-tutorial-that-players-can-skip

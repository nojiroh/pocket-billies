# Cutscenes

A cutscene is a scene the game films for you: the camera moves, people walk and talk, and you only watch and tap.
Each one is a single file, `game/data/cutscenes/<id>.json`, holding everything it needs: the map it is filmed on, its
named spots and shots, and its script. Maps stay pure level data, and a cutscene can be read, copied or deleted as a
whole. The story layer's scripts (docs/SCRIPTS.md) are the language; this page covers what a cutscene adds.

Today: `city` (the city at night, before the fall; not played since RL-8, and its map `city_opening` is parked in
`game/data/legacy` since the test cleanup, kept for the story to bring back), `opening` (Copperleaf, after the fall) and
`return` (intro track IN-4: the lab scene after the first run, on the opening's set; below, "The way back"). The
Studio's cutscene tools (save the free camera as a shot, drop spots as pins, a step list with Preview) are the plan's
session 2, not built yet (docs/HANDOFF.md).

## The file

```json
{
  "about": "what it is and when it plays",
  "map": "copperleaf",
  "spots": { "door": [50.32, 50.4], "hazel": [52.22, 48.25] },
  "shots": { "trio": { "eye": [53.85, 1.9, 42.75], "tgt": [53.85, 1.0, 47.95], "fov": 40, "w": 5.9 } },
  "lanes": { "high": [[-20, 40, 50], [32, 44, 60]] },
  "clear": { "areas": [[50.8, 44.6, 55.8, 48.9]], "paths": [["blakeFrom", "blake"]], "eyes": [[55.5, 41.2]] },
  "script": ["actor Kappi at door down", "camera trio 1.1", "[happy] Kappi: Hello! #l:2c0a"]
}
```

| Field | What it holds |
|---|---|
| `map` | the map it is filmed on. Every point is in **that map's own coordinates**, in metres (x across, z away); when the map is part of a bigger view (a place's hub), the cutscene moves with it. |
| `spots` | named places, `[x, z]`: where people stand and walk to. |
| `shots` | named camera shots: `eye` (where the camera is) and `tgt` (what it looks at), each `[x, height, z]` with the height **above the ground under that point**; `fov` in degrees (40 if left out); `w`, metres round the target that stay in frame on a narrow phone. |
| `lanes` | named paths of `[x, height, z]` points for traffic (the flying cars of the city opening). |
| `clear` | props put out of the way while filming (never flat ones): inside an `area` `[x0, z0, x1, z1]`, within `pathWidth` (1.1 m) of a `path` between two spots, or, for props without a footprint, within `eyeRadius` (2.3 m) of an `eye` point the camera stands at. |
| `who` | who says a line that names nobody (a speaker); usually every line names its speaker. |
| `look` | its own time of day (0-24), weather (clear, rain, storm, fog, snow ...) and season while it plays, whatever Settings say: the city is `{ "time": 23, "weather": "rain" }`. |
| `script` | the lines and commands, docs/SCRIPTS.md's format. |

Schema: `game/data/schema/cutscene.schema.json`. Types: `CutsceneData` in `game/types/game-data.d.ts`.

## The commands

People are named as the script names them: `you`, or a speaker from story.json (`Chosen`, `Kappi`, `Blake`, ...). A place may be
a spot, someone in the scene (where they stand now), or a place the cutscene names itself (the opening's `starter`).

Which way someone faces (characters track CH-1): the four words `up`, `down`, `side` and `sideR` are on the screen, in
whatever shot is showing (`down`: toward the camera, `side`: to the left). A walk, or `face Kappi Blake` toward someone or
a spot, turns them for real in the scene, and each shot then shows the side of them that faces its camera.

| Command | Does | Waits? |
|---|---|---|
| `actor Kappi at door down` | puts someone in the scene at a spot, facing up, down, side or sideR | no |
| `actor you at walkFrom up silhouette` | the same, drawn as a dark figure (who it is stays hidden) | no |
| `camera trio 1.1` | glides to a shot in that many seconds (0 or none: a cut) | no: the camera moves on while the next step starts |
| `camera picked 0.9 on starter you` | the same, aimed at a place, or between two | no |
| `walk Blake blake 1.5` | walks someone to a place; no time given: 1.6 m a second | yes, till they arrive |
| `walk Blake blake 1.5 nowait` | the same, while the script goes on | no |
| `face Kappi sideR` / `face Kappi Blake` | turns someone, or towards someone or a spot | no |
| `act Kappi throw 0.9` | a pose for a while: throw, cheer, react, reach (an arm held out the way they face), stamp (a Bureau clerk bot raises its stamp arm and slams it down, then holds; IN-3) | no |
| `wait 1.5` / `wait Blake` | pauses for seconds, or till Blake stops walking | yes |
| `caption 3.4 The Hollow Earth \| {place}` | a caption for seconds: the small line, then the big one | no |
| `blink` | the letterbox closes and opens like eyelids | yes |
| `screen dazed` / `waking` / `clear` | the look of the whole picture, coming round after the fall | no |
| `effect landing at me` / `effect sparkle at Kappi` | a little effect at a place | no |
| `hide box` / `hide Blake` | the dialogue box goes away / someone leaves the scene | no |
| `hide prop rift` / `show prop rift` | the prop standing nearest a spot (within 3 m) out of the scene, and back; `show Blake` too | no |
| `traffic high city_flying_car 9 3` | that many of a prop along one of the cutscene's lanes, end to end in that many seconds, again and again, floating at the lane's height | no |
| `fade out #0B0912` / `fade in` | the screen fades out (to a colour) or back in | no |
| `music rival` / `sound throw` | music, a sound effect | no |
| `Kappi: text`, `[happy] Kappi: text` | a line in the dialogue box | yes, till the tap |

The rule in one line: **lines and walks wait; camera moves, poses and captions run on.** Put a `wait` where the picture
should hold.

Slots work in commands too (`{place}`, `{name}`, `{starter}` ...: docs/SCRIPTS.md).

### How New game begins (intro track IN-5)

New game (`cutscene/crash-scene.js` `newGameStart`) is the cold open: a new save with a stand-in starter, the prepared
first run started at once (`run.js` `runTakeOffPrepared({ crash })`, no train), and `crash.json` played on its landing
while the run waits at phase `crash` (a reload plays it again). `crash.json` has `"landing": true` and `"map":
"first_run"`: it has no map of its own, its spots are the crash site's (`firstRun.json` `crash.spots`, checked equal
by check-data), and its spots, its shots' eye and target and its clear areas are metres from the landing's mast,
turned with it (`logic/first-run.js` `firstRunCutscene`; a turned area clears the square round its corners). Its own
commands are the opening's `throw-coins` and `pick-starter`; the picked starter takes the stand-in's place on the run
(`firstRunStarter`, then `run-world.js` `runWorldRepool`). The run ends through the way back below.

Once a first run has ended at the lab on this device (localStorage `pb-intro-done`), New game asks: **Skip the
crash** plays the opening below (the fall from the Bureau's portal with no captions, the lab, the dressing room, the
pick, Skyline Station), or play it again.

The opening's fall ends in a dive straight down onto Copperleaf's island, onto the opening's own landing spot (`me`): the
world map films it (opening-fall.js `fallFloatCamera`), clouds and streaks of air over it. Its last picture is held
(dazed) behind the impact's flash while Copperleaf's walk view is made, and the opening's first shot, `drop`, looks
down on the same spot before `wake` brings the camera down to the ground. `tools/look-opening.py` takes pictures of
it and of the starter pick, which looks across the three starters from the side the coins came from.

### The opening's own

`dressing-room` (you make yourself up; the lab scene's too), `payout` (the lab scene's: the payout sheet), `throw-coins` (the professor's coins pop open on the spots star1 to star3),
`pick-starter` (the pick card; afterwards `{starter}`, `{counter}` and the place `starter` are known), `staged-fight`
(the Chosen against Blake, staged; Project Story S6 makes it a real battle; `{foe}` after it), `rival-battle` (Blake's
battle follows the opening), `fall`. Skipping stops at the dressing room and the pick.

### The way back (intro track IN-4)

The first run (the intro's prepared run, `run.first`; the debug menu's "Jump to the pickup (win / loss)" on any run)
ends another way than a run's payout and train (run.js `runOver`; the run's phase is `return` at once, so a reload in
the pickup or the fall opens the lab):
1. **The pickup**, where the run ended: story.json `pickup-lost` or `pickup-won` on the story stage (`camera run-up`,
   two Bureau clerks walk over beside you, `[stamp=returned]` "Returned to sender" or `[stamp=recovered]` "Recovered
   property" on the Bureau's bubble, then `portal`: the square portal opens under you and you drop through it; its
   light stays on screen as a white veil, `#backVeil`).
2. **The fall**, `fallPlay(run, { from: 'portal' })` (opening-fall.js): the portal's light as its first picture
   (`fallPortal`), then the world map's dive with no captions, onto the opening's spot `me`. The street and the crust
   stay for the story.
3. **The lab**, cutscenes/return.json (cutscene/return-scene.js): wake, Chosen and Kappi, `dressing-room` (look and
   name are made here now), `payout` (the payout sheet over the scene: Kappi tallies the run, everyone comes home, its
   Done goes back to the scene; skipping stops here), the expeditions. Its end finishes the run (run.js `runEndLab`:
   the same `runEnd`, no train) and you stand outside the lab door. It can't run (no 3D view) or breaks: the run still
   ends the same way.

Its set is the opening's: `tools/build-copperleaf.mjs` gives return.json the opening's spots, shots and clear whenever
it moves them with the lab door (return-script.test.mjs checks they are the same).

## Skipping

The Skip button makes every wait and line pass at once, so the script runs to the end with every change it makes; the
dressing room and the starter pick stop it, as they need you.

## Checks

`npm run check:data` reads every cutscene: its schema, its map, the spots its clear paths join, and its script with the
story checks: the script reads, every spot, shot and person it names is its own or a speaker, line ids
(`npm run story:ids`). A cutscene's own commands (`actor`, `caption`, `screen` ...) in a person's or trainer's script
are a problem: they play only in a cutscene. Tests: `tools/test/opening-script.test.mjs`.

## The code

| File | What it does |
|---|---|
| `game/js/logic/cutscene-set.js` | reads what a cutscene command says (one reading for the stage, the checks and the Studio); the set in the view: the map's corner, a shot's heights on the ground, what is cleared. Logic only, tested in Node. |
| `game/js/cutscene/director.js` | the state, timing that resolves while skipping, the camera, the people, what the engine draws each frame (plus each cutscene's own layers), the overlay, the dialogue, the teardown |
| `game/js/cutscene/stage.js` | plays a cutscene's script on the director: every command above; `cutscenePlayScript(id, { extra, slots })` |
| `game/js/cutscene/opening.js` | the opening: mounts Copperleaf after the fall, clears the set, plays `opening` with its own commands, starts the game; `cutsceneBegin` and `cutsceneMount`, shared with the way back |
| `game/js/cutscene/return-scene.js` | IN-4, the way back: the fall from the portal, the lab scene (`return`) with the dressing room and the payout, the run finished at the lab door |
| `game/js/cutscene/starter-pick.js` | the three starters drawn with their rigs and the pick card |
| `game/js/cutscene/staged-fight.js` | the professor's staged fight (until S6) |

Scenes in the walk scene you stand in (someone runs up to you: `camera run-up`, `walk Blake beside me`) are the
story stage's (story-stage.js), not cutscenes.

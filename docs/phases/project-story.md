# Project Story

## Goal
Everything the player hears and sees of the story, from the first frame to the end of Blake's battle, written once in
game data and editable in the Studio. Project Story replaces three older plans: phase 11 (opening sequence), phase 15's
story half (story bible, the organization, parodies of real people) and phase 22 (story layer). Those files are in
docs/archive for reference. Phase 15's design half (core loop, tax and market mechanics, exploring) stays with
roadmap session A2 and is not part of this project.

Project Story is its own track. It runs alongside phases A to E; A2 and E3 point here for anything story.

## Owner decisions (2026-10-19)
| Topic | Decision |
|---|---|
| Scope | City opening, story bible, story layer, rework of the Hazel and Blake opening; from phase 15 only the parody fixes |
| Order | Story layer → story bible → Hazel's opening → city opening |
| Script storage | JSON arrays of lines inside the existing data files (people, trainers, signs, events) |
| Openings as scripts | Yes, both: the city opening is built as a script, and Hazel's opening is moved into scripts |
| Quests | Internal for now: tracked, no journal screen |
| Studio story editor | Built in Project Story (not phase 14) |
| The player | An ordinary person; the portal opens by accident |
| The organization | A background mystery: clues, logos, documents; rarely seen in person until late |
| Tone | Balanced: funny people, a mystery that gets genuinely eerie |
| Hazel | Stays Professor Hazel, she/her. A **former member** of the organization: she knows more than she says |
| Surface / interior contrast | **Not decided.** Cyberpunk city above, solarpunk Hollow Earth within, is the working idea only |
| Character creation | After the fall (already true: the dressing room comes after you wake outside Hazel's lab) |
| City look | Dark, rainy neon at night |
| City-to-arrival length | Under 30 seconds |
| Hazel's lines | Not funny enough and too few. She makes fun of **the absurdity of a person falling from the sky and surviving**. Meta jokes stay but come rarer; she must not be annoying in a meta way |
| Hazel vs Blake | A **real battle in the battle engine** with the normal battle UI, built after phase 19 (battle core) |
| Pacing | First talk: flat rhythm. Hazel vs Blake: too fast. Starter pick: too fast. Blake's battle: flat rhythm |
| Arrival | Open: Claude proposes 2-3 options (see "Ask me before") |
| Phase 22 | Moved here from the `plan/engine-phases-19-21` branch |

## What exists today (read 2026-10-19 on main 09ae2ba; verify again before each session)
- **The fall** (`opening-fall.js`, 899 lines): surface, crust, inner sky, landing. Starts on New game.
- **The opening** (`cutscene.js`, 1254 lines, `cutsceneScript`): imperative JavaScript on `cutsceneSay`,
  `cutsceneWalk`, `cutsceneShot`, filmed in Sundown with the walk-scene engine. You wake outside Hazel's lab, she comes
  running ("Oh! Another one!"), you can't remember your name, you make yourself in the dressing room, she throws three
  coins, Blake runs in, Hazel fights him (staged inside the cutscene, made to look like a battle: Gildlet, plates,
  one hit), then the starter pick, then Blake's battle.
- **Hazel's lines** (`logic/hazel.js`, 159 lines): one table `HAZEL`: hot takes per starter, annoyed lines, `meta`,
  `tooFastPicks`, `tooFastSkips`; `hotTake`, `hazelTip`. Unit tested in `tools/test/hazel.test.mjs`.
- **Blake's battle tips**: `battleTutor` (opening-fall.js), called from battle.js each turn: a HOT TIP card over the
  move buttons until tapped. Fast-pick and fast-skip comments via `speedWatch`.
- **Dialogue and story** (`talk.js` 259 lines, `story.js` 433 lines): one dialogue box with `[expr]` portrait
  prefixes; `trainerTalk`, `rivalScene`, `personTalk`. Flags are loose keys in `saveData.story` and
  `saveData.flags` (`met_`, `talk_`, `legend_` ...), used in about a dozen places.
- No choices, quests, conditions or story events.
- Stale: the header of cutscene.js still says the step-by-step intro in ui.js runs if the cutscene fails; that intro
  was removed in 06-2 (now a Try again screen). Fix in session S5.

## After S2 (2026-10-19)
- Every person, trainer, run-up scene, Hazel's lab talk, the talk after Blake's first battle and the ending play from
  scripts (docs/SCRIPTS.md); `personTalk`, `trainerTalk`, `talkHazel`, `storyAfterRival`, `storyEnding` only start
  them; `rivalScene` is gone (its staging is the stage's `camera run-up`, `walk ... beside me`, `face`). The opening
  itself (cutscene.js, `HAZEL`, `battleTutor`) is untouched: S5.
- Townsfolk chatter (`talkFolk`) and favours (things-to-do.js) stay lists (owner, 2026-10-19). Prop `say` toasts
  (shops, clinic, rest) are not conversations and are not scripts.
- `when` / `unless` (people, trainers, props), `requires` / `locked` (places), chapters (map variants), line ids,
  the story checks in check-data. Doors have no `requires` of their own yet (a door prop can carry `when`).

## After S3 (2026-10-19)
- The parser and the format's tables are in `logic/script-parse.js` (the runner stays in `logic/script.js`); the story
  checks are `logic/story-checks.js` (`storyFindings`, each with file, script, line, thing and field); check-data and
  the Studio run the same ones. `scriptReference()` builds the Studio's command reference from the tables.
- Studio: `studio/js/story-editor.js` (script field, condition field, line ids, reference, Story scripts section);
  the map editor's People card, story preview and Play from here; the Check's story findings.
- Play from here: `?test=1&story=<preset>&place=<loc>&at=x,z&flags=a,!b,beat:t&draft=1`; the live channel now carries
  the story and the trainers.

## Sessions
Sized in sessions and owner decisions, like the roadmap. Each session starts in Plan Mode and ends with HANDOFF.

| Session | Work | Needs from you |
|---|---|---|
| S1 | Story layer: conditions, script parser and runner, flags list, safe runs, start presets | The line format check on 3 real conversations |
| S2 | Story layer: every person, trainer and rival scene moved into scripts (same words), `when`/`unless`, gates, chapters, story checks, line ids | — |
| S3 | Studio story editor: script field with errors and reference, story preview, Play from here | Try it in the Studio |
| S4 | Story bible and parody fixes (writing, no code) | Every naming and lore choice listed below |
| S5 | Hazel's opening rewritten as scripts: new lines, new pacing, the arrival | Read the lines; play it on your phone |
| S6 | Hazel vs Blake as a real battle. **Waits for phase 19** | Play it on your phone |
| S7-S8 | The city opening: dark rainy neon, silhouette, portal, into the fall, under 30 s | City mockups and the opening on your phone |

### S1-S2: Story layer
**Conditions.** A small grammar, parsed once, never run as code: `flag`, `!flag`, `item:coin_gold >= 3`,
`quest:id = active`, `stage:id >= found`, `visits:person`, `visited:place`, `billie:line`, `robot`, `badge:n`,
combined with `and`, `or`, parentheses. One module, `game/js/logic/conditions.js`, used by the game, the Studio and the
data check.

**Scripts.** A JSON array of strings inside the person, trainer, sign or event that owns it. Each line is one of:
- `Name: text` or `[expr] Name: text`: a dialogue line (`Name` may be left out for the person speaking).
- `choice` with `> text` options and indented lines under each; `> [if cond] text`, `> [once] text`.
- `if cond` / `elif cond` / `else`; `once key`; `cycle` / `seq` (lines that change from visit to visit).
- Commands: `set flag`, `clear flag`, `give item n`, `take item n`, `quest id stage`, `battle trainer`, `heal`,
  `walk who x z`, `face who dir`, `camera ...`, `wait s`, `fade`, `go place entrance`, `call script`.
- Opening commands (needed by S5 and S7): `shot`, `dressing-room`, `pick-starter`, `hot-take`, `tip`, `fall`, and the
  city's `camera` paths. The exact list is settled in S1's plan.
Indentation is two spaces inside the strings. Unknown commands are errors with "did you mean ...?", never dialogue.

**Line ids.** Every dialogue line gets a short id (`#l:3fa9`) from a tool (`npm run story:ids`), kept when the text is
edited or moved. The Studio, debug logs and the battle replay log can point at a line; translation can key on it later.

**Story-dependent world.** People, trainers, props and exits can carry `when` / `unless`. Exits and gates can carry
`requires` and a `locked` line. A named chapter is a condition that can swap a place for a variant map file.

**Running safely.** Changes apply as a script runs, but a save taken mid-script stores the state from before it
started, and the script restarts on Continue. Skipping (hold the button) runs the rest at once and still makes every
change. Debug-only start presets: `?story=<preset>` starts a test game at a named point with given flags, items, team.

**Quests** are tracked internally (flags and stages); no journal screen.

**Story checks** in `check-data.mjs`: every script parses (errors with file and line). Warnings: flags read but never
set or set but never read; items taken but never given; unknown speakers, trainers, places, items; `once` keys shared
by two scripts; quests with unreachable stages. A reach check over the location graph: every gate's `requires` can
become true somewhere the player can get to.

Tasks:
1. `logic/conditions.js` with unit tests.
2. Parser and runner in `logic/`. The runner takes a small stage interface (say, walk, face, camera, battle, shot) so
   it runs in Node with a stub; unit tests including "did you mean".
3. Rewrite `personTalk`, `trainerTalk`, `rivalScene` as scripts in the data; same words, same order. A test plays every
   script with the stub and compares with a snapshot taken before the rewrite.
4. One list of known flags; move the loose keys over (fresh base: no old-save conversion).
5. `when` / `unless`, `requires` / `locked`, chapters.
6. Safe runs, honest skip, start presets.
7. Story checks and the reach check; plant a bad flag to see each one fail.
8. The line ids tool.

### S3: Studio story editor
The script field shows errors as you type and a command reference built from the runner's command table. The map
editor's story preview hides people and props whose conditions fail for the flags you pick. "Play from here" opens the
game at this place and spot with a chosen start preset and the unsaved draft. One check function for the Studio and
the command line.

### S4: Story bible and parody fixes
Written to `docs/STORY.md`. Claude proposes; nothing is locked until you pick.
1. **The world.** The Hollow Earth as an alternative future; how the portal and the fall connect the surface to the
   interior. The surface/interior contrast is drafted two ways (strong contrast, or blurred with surface tech leaking
   in) for you to choose.
2. **The player.** An ordinary person who falls through by accident. What they want once they are down there (going
   home, or something they find) is proposed as options.
3. **The organization.** Original: its own name, logo, terms and lore, nothing copied from Control or the SCP
   Foundation. 3 name options, its goals, how it looks (agents, redacted documents, hidden facilities), how it relates
   to the ranch, Billies and robots. Background mystery: when it is first seen in person is proposed.
4. **Hazel's past.** What she did for the organization, why she left, what she hides, how it surfaces in her lines
   ("Oh! Another one!" already hints that people have fallen before).
5. **The gem.** Its role in the story (a robot's gem is its soul; how that ties to the organization).
6. **Clue plan.** Which clue appears where: the city logos, Hazel's slips, documents, first reveals. Eerie moments
   placed so the tone stays balanced.
7. **Arrival options.** 2-3 ways you land and are found, for S5.
8. **Parody fixes.** Creatures that parody real named people (for example Ballmerilla, Gabenwalrus, Tiktokferret)
   turned into satire of types. A full list with a proposed new name and angle for each; one rename per commit later.

### S5: Hazel's opening, rewritten
1. Move the opening into scripts (Hazel's first talk, the dressing room, the coins, the pick, Blake's arrival, the
   battle tips, `HAZEL`'s tables), keeping the cutscene camera work.
2. New lines. Hazel mocks the absurdity of a person falling from the sky and surviving: the landing, that you're
   alive, that you don't know your name. More hot takes and tips, sharper writing. The meta jokes stay but rarer
   (proposal: at most one fast-skip and one fast-pick comment per opening, a HOT TIP on some turns, not every one).
   Small slips that hint she was in the organization (from S4's clue plan).
3. Pacing:
   - First talk (flat): build-up, joke, pause, move on; vary line length; a beat after each punchline.
   - Hazel vs Blake (too fast): build it up before the one hit (Blake's bravado, Hazel's calm), then the hit, then a
     beat to let it land. The real-battle version is S6; S5 tunes the staged one or leaves it for S6.
   - Starter pick (too fast): more time to meet each starter (its hot take, a small idle animation, a line from it).
   - Blake's battle (flat): stakes and jokes: Blake's taunts, Hazel's reactions, a payoff at the end.
4. The chosen arrival from S4.
5. Fix the stale cutscene.js header.
6. Tests: the snapshot test covers the new scripts; the smoke phone flow still plays the opening through.

### S6: Hazel vs Blake as a real battle (after phase 19)
Hazel battles Blake in the battle engine with the normal battle UI, plates and log. She has no Billie (a special
trainer); her hit takes his Billie down at once. The player only watches and taps. Phase 19 must support a trainer
with no Billie and a scripted battle (`battle hazel_vs_blake` from a script); add that to phase 19's requirements.

### S7-S8: The city opening
1. A beat sheet with timings under 30 s: city at night in the rain, flying cars in lanes, the silhouette on the street,
   the portal opens, the figure steps through, into the existing fall, the landing, the arrival from S5.
2. Built as a script with camera commands. The city scene in the airship style (low-poly, 32 px/m): tall neon
   buildings, signs, rain or haze within the phone budget, flying cars on splines (instanced), a portal swirl.
3. The silhouette hides who you are (you make yourself after the fall).
4. The organization's logo hidden in the city (S4's clue plan).
5. Skippable by tap; shown once, then skippable always.
6. Phone budget: frame times and load time in the debug log; a lighter version for weak devices.
7. **Graphics are tested on your devices, not headless.** Claude's checks for this session use lite/low-render
   settings and check only that the script runs, skip works and the console is clean.

## Ask me before
- The line format, after S1 shows three real conversations in it.
- Every name and lore choice in S4: the organization's name, logo idea and goals; when it is first seen; Hazel's past;
  the gem's role; the surface/interior contrast; what the player wants; every creature rename.
- The arrival (2-3 options from S4).
- Hazel's new lines, before they go in.
- The city mockups and beat sheet, before S8 builds the full scene.

## Testing (phase 13)
Follow docs/TESTING.md. Scripts are logic and are tested in Node with a stub stage, not by playing the screens. No
headless graphics or performance tests: you run those on your devices; Claude uses lite settings when a headless render
is unavoidable.

## Done when
All conversations and both openings live in scripts and play as approved; the story checks run in the data check; the
Studio edits and previews scripts; `docs/STORY.md` agreed; parodies of real people replaced; Hazel vs Blake is a real
battle; the city opening plays from first launch through the fall to Hazel, skippable, under 30 s; HANDOFF updated;
tag `project-story-done`.

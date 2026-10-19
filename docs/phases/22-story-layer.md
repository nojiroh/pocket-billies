# Phase 22 - Story layer: conditions, scripts in data, story checks

## Goal
Move dialogue, choices, quests and story flags out of hand-written JavaScript into the game data, in a small format
the Studio can edit and the data check can verify. Phase 15 (story bible, the organization's clues) and phase 14 task
12 (the Studio's story editor) both need this. Players see no change at first: the existing talk, trainer and rival
scenes are rewritten in the new format with the same words.

Idea source (2026-10-19 review): Luminati's story script (a three.js engine; no license, so ideas only, no code).
Its useful parts are taken; its party tactics, clock and weather commands and its 700-line spec are not.

## What the game has today (read 2026-10-19, verify again before starting)
- `game/js/talk.js` (259 lines): one dialogue box, `[expr]` prefixes for portrait expressions.
- `game/js/story.js` (433 lines): each kind of scene is its own function: `trainerTalk`, `rivalScene`,
  `personTalk` (a person has `first` lines, then cycles `lines`, tracked by `F['talk_' + id]`).
- Flags are loose keys in `saveData.story` and `saveData.flags` (`met_`, `talk_`, `legend_` and others), used in
  about a dozen places across story.js, lore.js, postcards.js, fixture.js, boot.js.
- The opening (`cutscene.js`, `cutsceneScript`) is imperative JavaScript built on `cutsceneSay`, `cutsceneWalk`,
  `cutsceneShot`.
- People and trainers carry plain arrays of lines in the map and trainer files.
- No choices, quests, conditions or story events.

## Design

### 1. Conditions
A small grammar, parsed once, never run as code: `flag`, `!flag`, `item:coin_gold >= 3`, `quest:id = active`,
`stage:id >= found`, `visits:person`, `visited:place`, `billie:line`, `robot`, `badge:n`, combined with `and`, `or`,
parentheses. One module, `game/js/logic/conditions.js`, used by the game, the Studio and the data check.

### 2. Scripts as lines in the existing data files
A script is a JSON array of strings inside the person, trainer, sign or event that owns it (fits the schemas, the
Studio and pull-request diffs). Each line is one of:
- `Name: text` or `[expr] Name: text`: a dialogue line (`Name` may be omitted for the person speaking).
- `choice` with `> text` options, indented lines under each; `> [if cond] text`, `> [once] text`.
- `if cond` / `elif cond` / `else`; `once key`; `cycle` / `seq` (lines that change from one visit to the next).
- Commands: `set flag`, `clear flag`, `give item n`, `take item n`, `quest id stage`, `battle trainer`, `heal`,
  `walk who x z`, `face who dir`, `camera ...`, `wait s`, `fade`, `go place entrance`, `call script`.
Indentation is two spaces inside the strings. Unknown commands are errors with "did you mean ...?" (an edit-distance
match against the command table), never shown as dialogue.

**Ask me before:** JSON arrays in the existing files (recommended: schemas, Studio, diffs), or separate `.story` text
files (nicer to type by hand, need their own loader and check).

### 3. Stable line ids
Every dialogue line gets a short id (`#l:3fa9`) assigned by a tool (`npm run story:ids`), kept when the text is edited
or moved. The Studio, debug logs and the battle replay log can point at a line; translation later can key on it. Menu
text keeps the current `i18n.js` table.

### 4. Story-dependent people and props
Any person, trainer, prop or exit can carry `when` / `unless` conditions; the world shows or hides them as flags
change. Exits and gates can carry `requires` and a `locked` line. A named "chapter" is a condition that can swap a
place for a variant map file (a town changed by the story) without editing its terrain.

### 5. Running scripts safely
- A script's changes are applied as it runs, but a save taken in the middle stores the state from before it started,
  and the script restarts on Continue. No half-finished scene in a save after a phone reload.
- Skipping (hold the button) runs the rest at once and still makes every change.
- Start presets: `?story=<preset>` (debug only) starts a test game at a named point with given flags, items and team.

### 6. Story checks in `check-data.mjs`
Parse every script; errors with file and line. Warnings: flags read but never set, set but never read; items taken but
never given; unknown speakers, trainers, places, items; `once` keys shared by two scripts; quests with unreachable
stages. Then a reach check over the location graph: every gate's `requires` can become true somewhere the player can
get to (a fixpoint over places, flags set there, exits they open).

### 7. Studio
The script field shows errors as you type and a command reference built from the same command table; a story preview
in the map editor hides people and props whose conditions fail for the flags you pick; "Play from here" opens the game
at this place and spot with a chosen start preset and the unsaved draft. One check function for the Studio and the
command line.

## Tasks
1. `logic/conditions.js` with unit tests (fixture data).
2. Script parser and runner in `logic/` (runner takes a small "stage" interface: say, walk, face, camera, battle, so it
   runs in Node with a stub); unit tests, including "did you mean".
3. Rewrite `personTalk`, `trainerTalk`, `rivalScene` as scripts in the data; same words, same order. A test plays
   every person's script with the stub and compares with a snapshot taken before the rewrite.
4. Flags: one list of known flags (derived from the scripts plus a small declared list); migrate the loose keys
   (fresh base: no old-save conversion needed, CLAUDE.md).
5. `when`/`unless` on people, props and exits; `requires`/`locked`; chapters with variant maps.
6. Safe runs, honest skip, start presets.
7. Story checks and the reach check in `check-data.mjs`; plant a bad flag to see each one fail.
8. Line ids tool.
9. Studio: script field with errors and reference, story preview, Play from here (may move to phase 14 if long).
10. Optional: the opening (`cutsceneScript`) as a script, if the stage interface covers it; otherwise leave it.

## Ask me before
- JSON arrays or `.story` files (section 2).
- Whether quests appear to the player (a journal screen) or stay internal for now.
- Whether task 9 belongs here or in phase 14.

## Done when
All tiers pass; every existing conversation plays as before (snapshot test); the data check runs the story checks;
a test game can start from a preset; HANDOFF updated; tag `phase-22-done`.

## First reply
A plan in Plan Mode: the line format with three real conversations rewritten as examples, and anything here the code
proves wrong.

## Testing (phase 13)
Follow docs/TESTING.md. Scripts are logic: they are tested in Node with a stub stage, not by playing the screens.

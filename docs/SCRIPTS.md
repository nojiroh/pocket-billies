# Story scripts

Project Story's story layer (docs/phases/project-story.md, S1 and S2). A script is what someone says and does, written as a
JSON array of lines in the data, next to the thing that owns it:

- a person in a map's `people` list: `script` (id `person:<id>`),
- a trainer, `game/data/trainers/<id>.json`: `script` (id `trainer:<id>`).
- the story itself, `game/data/story.json` `scripts`: `{ "who": <who talks>, "script": [...] }` (id `story:<id>`):
  Hazel in the lab, after Blake's first battle, the ending.

A line or a choice waits until the windows on screen (a battle's result) are closed. Each talk with a person or a
trainer counts one visit (`visits:<id>`).

Since S2 every conversation is a script: people, trainers (what they say before a battle; the battle ends the
script), the ones who run up to you (`"runsUp": true` on the trainer: Blake, Cass, Vinylla), Hazel in the lab, what
comes after Blake's first battle and the ending. Townsfolk chatter and favours stay as they are (made up from lists).
The debug menu's "Story scripts" row plays any of them.

Code: `game/js/logic/conditions.js` (conditions), `game/js/logic/script.js` (parser, runner, flags, presets, safe
runs, `when` / `unless`, chapters), `game/js/story-stage.js` (the game's stage). Data: `game/data/story.json`.
Tools: `npm run story:ids` (line ids), `tools/story-checks.mjs` (run by `npm run check:data`). Tests:
`tools/test/conditions`, `script`, `story-data`, `story-scripts`, `story-snapshot` (every conversation against what
the game said before S2, `talk-before-scripts.json`) and `story-checks`.

## Lines

One string per line. Indentation is two spaces per level, inside the string.

| Line | Means |
|---|---|
| `There you are, dear.` | a line said by the one the script belongs to |
| `[happy] There you are, dear.` | with an expression (happy, surprised, sad, angry, blink, talk) |
| `Hazel: Another one!` / `[happy] Hazel: ...` | said by someone else: a speaker from story.json `speakers` (Hazel, Blake, Juniper, Nacre, Cass, You) or a person id (`gini: ...`) |
| `set met_juniper` | a command (below) |

A line may hold slots, filled in as it is said: `{name}` (your name; Trainer before you have one), `{caught}`
(kinds of Billie caught) and `{badges}`. Any other `{word}` is an error.

A line that starts with a small letter is a command or a keyword. An unknown one is an error ("unknown command
"sett", did you mean "set"?"), never a line of dialogue. A line of dialogue starts with a capital, a quote, a digit,
`[expression]` or `Name:`.

## Blocks

```
if !met_juniper
  [happy] There you are, dear.
  set met_juniper
elif item:honey >= 2
  Honey! For me?
else
  cycle
    - The bees know everyone in Copperleaf.
    - [happy] Honey’s in the jar by the door.
      Don’t tell the bees I said so.
```

| Block | Means |
|---|---|
| `if cond` / `elif cond` / `else` | the first clause whose condition holds |
| `once [key]` | the lines under it, the first time only |
| `cycle [key]` | a different `- ` entry each time, then from the top again |
| `seq [key]` | a different `- ` entry each time, then the last one for good |
| `choice` with `> text` options | the player picks; the lines under an option play after it |

Options can carry `[if cond]` (shown only when it holds) and `[once]` (gone once picked):

```
choice
  > [once] Why didn’t anyone stop her?
    We sank because we wouldn’t spend.
  > [if item:ledger] Show her the ledger.
    So it’s true.
  > Just passing.
```

An entry of `cycle` or `seq` starts after `- `; its other lines go under it, two places in. `once`, `cycle` and
`seq` without a key are remembered by script and line (S2's line ids make that stable when lines move).

## Conditions

| Term | Holds when |
|---|---|
| `met_juniper` | the story flag is set; `!met_juniper` or `not met_juniper`: it isn't |
| `rival0 = win`, `flights >= 3` | a flag holds that word or number |
| `beat:chad` | the trainer is beaten |
| `item:honey >= 3`, `coin:gold > 0` | items in the bag, coins |
| `quest:ledger = asked`, `quest:ledger >= found` | a quest's stage (`>=`, `<` in the quest's own order of stages; `none` before it starts) |
| `visits:juniper >= 2` | times you have talked to someone |
| `visited:copperleaf` | you have been there |
| `billie:musk` | a Billie of that line caught (`billie:musk1`: that one) |
| `robot`, `badges >= 2`, `caught >= 15` | you have a robot; badges won; kinds of Billie caught (the Index) |

Combine with `and`, `or`, `not` / `!` and parentheses; `and` binds tighter than `or`. A count on its own
(`item:honey`, `badges`) means more than 0. Conditions are parsed once and never run as code. A mistake says where:
`unknown term "itme:", did you mean "item:"?`.

## Commands

| Command | Does |
|---|---|
| `set flag [value]`, `clear flag` | a story flag (to 1, or the word or number) |
| `give item [n]`, `take item [n]` | items, or coins as `coin:gold` |
| `quest id stage` | moves a quest on |
| `battle trainer` | a battle; the script goes on after it (a checkpoint) |
| `heal` | heals the team |
| `wait s` | waits, in seconds |
| `music piece` | plays a piece of music (`rival`, `title`, ...: sound.js) |
| `call script` | plays another script, then goes on |
| `end` | stops the script |
| `camera run-up` | someone runs up to you: the walk scene you stand in becomes a scene, with you and the one who talks (out of sight beyond you) on it; a battle, or the script's end, ends it |
| `walk who beside me` | the one who ran up comes over to stand beside you |
| `face who me`, `face who dir` | the two of you turn to each other; or up, down, side, sideR |
| `fade [in/out]` | the scene fades out, or back in |
| `go place [entrance]` | a checkpoint; from S2 |
| `shot`, `dressing-room`, `pick-starter`, `hot-take`, `tip`, `fall` | the openings' commands (S5, S7) |

The command table is `SCRIPT_COMMANDS` in logic/script.js; the Studio's reference (S3) is built from it.

## Flags

Every story flag is listed in `game/data/story.json` with what it means: `flags` by name, `patterns` for flags made
from an id (`met_<id>`, `read_<book>`, `legend_<species>`, `clue_<clue>`), and `kept` for the
story's own records (`talks`, `quests`, `once`, `cycles`, `resume`). The game sets flags through `setStoryFlag`; one
story.json doesn't list is a warning in the debug log's data list. Trainers beaten stay in `saveData.flags` (read as
`beat:<id>`).

## Running safely and skipping

A script changes the save as it plays. A save taken while it plays writes the story, items, coins and trainers
beaten as they were when it started, or at its last checkpoint (a battle), and `story.resume` says which script and
where; Continue plays it again from there. Hold the dialogue box for 0.6 s to skip: the rest runs at once and still
makes every change (a choice takes its first option); a battle stops the skip.

## Start presets

`game/index.html?story=<preset>` (alone or with `?test=1`) is a test run: a new game that saves nothing, put at a
point in the story by story.json `presets` (place, story flags, trainers beaten with their badges, coins, items,
team). `after-opening`: Copperleaf, Blake's first battle won. `before-cass`: every badge, a team near level 55, at
the pressing plant.

## Line ids

Every line of dialogue and every choice option ends with a short id: `There you are, dear. #l:3fa9`. It is not
shown; it stays with the line when the text is edited or moved, so the debug log ("stopped after #l:3fa9"), the
Studio and a translation can point at the line. `once`, `cycle`, `seq` and `[once]` without a key remember by their
(first) line's id, so lines added above them move nothing. `npm run story:ids` gives every new line an id (and a
second copy of an id a new one); the data check fails on a line without one. Write new lines without an id and run
it.

## The story-dependent world

| Field | On | Means |
|---|---|---|
| `when`, `unless` | a map's people, a trainer, a prop | there only while the condition holds / doesn't (a prop is neither drawn nor solid) |
| `requires`, `locked` | a place (locations.json) | closed until the condition holds: walking in, the world map, the airship and the route finder all refuse, and you are told `locked` (or "<place> is closed for now.") |
| `chapters` | story.json | `{ "<id>": { "when": cond, "maps": { "copperleaf": "copperleaf__ch2" } } }`: while `when` holds, the map loads the variant file's props and people (game/data/maps/copperleaf__ch2.json, not listed in index.json). Chosen as the map loads: a new chapter shows the next time the game starts |

## Story checks

`npm run check:data` runs `tools/story-checks.mjs` on the data. It fails on: a script that doesn't read (file, line,
"did you mean"), a line without an id or an id used twice, a speaker, trainer, place, item, coin, Billie, quest or
script that doesn't exist, a quest stage the quest lacks, a `when` / `unless` / `requires` / chapter condition that
doesn't read, and a place whose `requires` can't come true anywhere the player can get to (the reach check: along
roads and lifts from the start, opening places as the flags the scripts there set allow; a flag story.json lists
counts as one the game sets). It warns about: a flag read that nothing sets, a flag a script sets that story.json
doesn't list, items taken but never given, a `once` key two scripts share, a quest stage no script moves to.

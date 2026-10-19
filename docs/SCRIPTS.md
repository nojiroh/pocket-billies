# Story scripts

Project Story's story layer (docs/phases/project-story.md, S1). A script is what someone says and does, written as a
JSON array of lines in the data, next to the thing that owns it:

- a person in a map's `people` list: `script` (id `person:<id>`),
- a trainer, `game/data/trainers/<id>.json`: `script` (id `trainer:<id>`).
- the story itself, `game/data/story.json` `scripts`: `{ "who": <who talks>, "script": [...] }` (id `story:<id>`):
  Hazel in the lab, after Blake's first battle, the ending.

A line or a choice waits until the windows on screen (a battle's result) are closed. Each talk with a person or a
trainer counts one visit (`visits:<id>`).

S1 adds the format, the runner and three scripts (Granny Juniper, Blake on the golf course, Curator Nacre). They sit
next to the old fields and the game does not play them on its own yet: the debug menu's "Story scripts" row plays
them. S2 moves every conversation over.

Code: `game/js/logic/conditions.js` (conditions), `game/js/logic/script.js` (parser, runner, flags, presets, safe
runs), `game/js/story-stage.js` (the game's stage). Data: `game/data/story.json`. Tests: `tools/test/conditions`,
`script`, `story-data` and `story-scripts`.

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
from an id (`met_<id>`, `talk_<person>`, `read_<book>`, `legend_<species>`, `clue_<clue>`), and `kept` for the
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

# Story scripts

Project Story's story layer (docs/phases/project-story.md, S1 and S2). A script is what someone says and does, written as a
JSON array of lines in the data, next to the thing that owns it:

- a person in a map's `people` list: `script` (id `person:<id>`),
- a trainer, `game/data/trainers/<id>.json`: `script` (id `trainer:<id>`).
- the story itself, `game/data/story.json` `scripts`: `{ "who": <who talks>, "script": [...] }` (id `story:<id>`):
  Professor Chosen in the lab (`story:chosen`), after Blake's first battle, the ending. Hazel's own lab talk is a
  person in the lab room's map (`person:hazel_lab`, maps/int_lab.json): a room may hold talking people besides its keeper.
- a cutscene, `game/data/cutscenes/<id>.json` `script` (id `cutscene:<id>`): the opening. A cutscene has commands of
  its own (people, named shots and spots, captions): docs/CUTSCENES.md.

A line or a choice waits until the windows on screen (a battle's result) are closed. Each talk with a person or a
trainer counts one visit (`visits:<id>`).

Since S2 every conversation is a script: people, trainers (what they say before a battle; the battle ends the
script), the ones who run up to you (`"runsUp": true` on the trainer: Blake, Cass, Vinylla), Professor Chosen and Hazel in the lab, what
comes after Blake's first battle and the ending. Townsfolk chatter and favours stay as they are (made up from lists).
The debug menu's "Story scripts" row plays any of them.

Code: `game/js/logic/conditions.js` (conditions), `game/js/logic/script.js` (parser, runner, flags, presets, safe
runs, `when` / `unless`, chapters), `game/js/story-stage.js` (the game's stage). Data: `game/data/story.json`.
Tools: `npm run story:ids` (line ids), `tools/story-checks.mjs` (run by `npm run check:data`). Tests:
`tools/test/conditions`, `script`, `story-data`, `story-scripts` and `story-checks`.

## Lines

One string per line. Indentation is two spaces per level, inside the string.

| Line | Means |
|---|---|
| `There you are, dear.` | a line said by the one the script belongs to |
| `[happy] There you are, dear.` | with an expression (happy, surprised, sad, angry, blink, talk) |
| `Hazel: Another one!` / `[happy] Hazel: ...` | said by someone else: a speaker from story.json `speakers` (Chosen, Hazel, Blake, Juniper, Nacre, Cass, You) or a person id (`chosen: ...`) |
| `set met_juniper` | a command (below) |

A line (or a command) may hold slots, filled in as it is said: `{name}` (your name; Trainer before you have one),
`{caught}` (kinds of Billie caught) and `{badges}`; in a cutscene also `{place}` (where it is filmed), and in the
opening `{starter}`, `{counter}` and `{foe}` (docs/CUTSCENES.md). Any other `{word}` is an error.

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
| `beat:crude` | the trainer is beaten |
| `item:honey >= 3`, `coin:gold > 0` | items in the bag, coins |
| `quest:ledger = asked`, `quest:ledger >= found` | a quest's stage (`>=`, `<` in the quest's own order of stages; `none` before it starts) |
| `visits:juniper >= 2` | times you have talked to someone |
| `visited:copperleaf` | you have been there |
| `billie:musk` | a Billie of that line caught (`billie:musk1`: that one) |
| `robot`, `badges >= 2`, `caught >= 15` | you have a robot; badges won; kinds of Billie caught (the Index) |
| `unlock:ranch_2`, `runs >= 3`, `wins >= 1`, `expedition >= 2` | an unlock is owned (unlocks.json); runs ended; runs won; the highest Expedition open (RL-11, RL-13: what lasts between runs, the same in a run and in the hub) |
| `type:Water`, `type:Fire >= 2` | Billies of that type in the team, fainted ones too (RL-12b) |
| `money >= 200` | Moneys on hand (RL-12b) |
| `team >= 2` | Billies in the team (RL-12b) |
| `badge:Water` | a badge of that type is won: `meta.badges` (RL-R2) or a leader's seat (RL-12b) |

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
| `fade [in/out] [#colour]` | the scene fades out (to a colour), or back in |
| `go place [entrance]` | a checkpoint; from S2 |
| `actor`, `act`, `caption`, `blink`, `screen`, `effect`, `hide`, `sound`, `walk who spot`, `camera shot`, `wait who` | a cutscene's: docs/CUTSCENES.md (only in a cutscene) |
| `dressing-room`, `throw-coins`, `pick-starter`, `staged-fight`, `rival-battle`, `fall` | the opening's: docs/CUTSCENES.md |
| `perk [rarity or id]`, `money n`, `hurt share`, `heal [share]`, `status id`, `fx n kind key=value...`, `wager percent`, `loot table [n]`, `level n`, `recall [up]`, `foe class [up]`, `wild [up]`, `reward [kind] [n]` | an event's (events.json, on a run; RL-12b): below |

### Event commands (RL-12b)

An event (game/data/events.json) has an intro (lines only) and 2-3 options; an option's `need` is a condition (the
option shows greyed out with what it needs until it holds), its `cost` Moneys paid when it is picked, and its `then` a
script with these commands besides the usual ones. Every chance comes from the run's own stream, so a run made again
plays the same.

| Command | Does |
|---|---|
| `perk`, `perk rare`, `perk lucky_charm` | offers one Perk (any, of a rarity, or that one); past the cap you let one go |
| `money 150`, `money -50` | Moneys gained or lost (never below 0) |
| `hurt 0.1`, `heal 0.25`, `heal` | every Billie standing loses / gains that share of its HP (never past 1 HP); `heal` alone heals all |
| `status slp` | every Billie standing without a status gets one (par, slp, brn) |
| `fx 3 price what=shop mult=1.25` | an effect row (perks.json's kinds) for this place and 3 more |
| `wager 50` | a 50% chance: sets the flag `wager` to `win` or `lose` (`if wager = win`) |
| `loot auction`, `loot common 2` | items drawn from a loot table (events.json `loot`) |
| `level -1` | a Billie of the team, drawn, gains or loses levels |
| `recall 2` | you pick a Billie (not one from home) to give up; one of the region's takes its place, 2 levels up |
| `foe hustle_coach 1` | a battle with a trainer of that class (events.json `classes`), 1 level over the place; lost, the run ends |
| `wild 2` | a wild battle with a Billie of the region, 2 levels over the place |
| `reward`, `reward tutor 2` | a reward pick (rewards.json): of every kind, or of one (item, candy, evo, tutor), n cards |

Speakers in an event are one word (`Clerk: ...`): the parser reads a single word before the colon as the speaker.

The command table is `SCRIPT_COMMANDS` in logic/script-parse.js (with the parser; the runner is logic/script.js);
the Studio's command reference is built from it, the keywords (`KEYWORD_ABOUT`), the slots and the condition terms
(`CONDITION_KINDS`) by `scriptReference()`, so it can't drift from what the parser reads.

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
team). `after-opening`: Copperleaf, Blake's first battle won. (`before-cass`, every badge at the pressing plant, was
parked with its place in RL-5: game/data/legacy/story.json.)

The Studio's Play from here adds (S3): `&place=<location>` starts you in the place itself (its people, trainers and
exits) and `&at=x,z` on a spot of its scene; `&flags=met_x,!rival0,beat:crude` switches flags and trainers on or off
on top of the preset; `&draft=1` waits up to 2 s for the open Studio's unsaved data first.

## Line ids

Every line of dialogue and every choice option ends with a short id: `There you are, dear. #l:3fa9`. It is not
shown; it stays with the line when the text is edited or moved, so the debug log ("stopped after #l:3fa9"), the
Studio and a translation can point at the line. `once`, `cycle`, `seq` and `[once]` without a key remember by their
(first) line's id, so lines added above them move nothing. `npm run story:ids` gives every new line an id (and a
second copy of an id a new one); the data check fails on a line without one. Write new lines without an id and run
it, or press **Add line ids** under a script in the Studio (the same rule).

## The story-dependent world

| Field | On | Means |
|---|---|---|
| `when`, `unless` | a map's people, a trainer, a prop | there only while the condition holds / doesn't (a prop is neither drawn nor solid) |
| `requires`, `locked` | a place (locations.json) | closed until the condition holds: walking in, the world map, the airship and the route finder all refuse, and you are told `locked` (or "<place> is closed for now.") |
| `chapters` | story.json | `{ "<id>": { "when": cond, "maps": { "copperleaf": "copperleaf__ch2" } } }`: while `when` holds, the map loads the variant file's props and people (game/data/maps/copperleaf__ch2.json, not listed in index.json). Chosen as the map loads: a new chapter shows the next time the game starts |

## Story checks

`npm run check:data` runs the story checks (game/js/logic/story-checks.js, through tools/story-checks.mjs) on the
data; the Studio runs the same ones as you type and in its Check. It fails on: a script that doesn't read (file, line,
"did you mean"), a line without an id or an id used twice, a speaker, trainer, place, item, coin, Billie, quest or
script that doesn't exist, a quest stage the quest lacks, a `when` / `unless` / `requires` / chapter condition that
doesn't read, and a place whose `requires` can't come true anywhere the player can get to (the reach check: along
roads and lifts from the start, opening places as the flags the scripts there set allow; a flag story.json lists
counts as one the game sets). It warns about: a flag read that nothing sets, a flag a script sets that story.json
doesn't list, items taken but never given, a `once` key two scripts share, a quest stage no script moves to.

## In the Studio (S3)

- **Every script has one field**: a trainer's (Trainers → Dialogue), a person's in a scene (Walk scenes → People who
  talk: id, look, name, spot, facing, `when`, `unless`, script) and story.json's (Story scripts). The parser's error
  shows at once, the story checks for that script a moment later, each with its line; click one to select the line.
  Tab / Shift+Tab indent by two spaces (Esc first to leave the box with Tab); Enter keeps the indent, one more after
  a line that opens a block. **Commands** opens the reference; a row puts itself in the script.
- **Condition fields** (`when`, `unless`, a place's `requires`) say at once when a condition doesn't read, and what
  the checks find (a trainer or item that doesn't exist).
- **The Check** lists every story finding; Show me opens the script with the line selected.
- **Story preview** (Walk scenes → Preview): a start preset and flags (and trainers beaten) switched on or off; who
  and what isn't there for them is hidden in the 3D preview and faded on the map.
- **Play from here** (Walk scenes → Preview, or a preset in Story scripts): the game in this place, on the spot you
  pick, at the preview's preset and flags, with your unsaved changes; nothing is saved there.

# Dialogue track (DL): talking with character

Branch: track/dialogue

The owner's brief (2026-10-28): "Make a plan to improve the visuals of characters talking. Make it appear more like a
modern stylized text bubble that subtly moves and expands. Make it so text can have different effects and boldness
for emphasis and humor. Make sure the character portraits are dynamic and fun. Do research and come back to me."
Then, during planning: "Do research online. There can be multiple bubbles on top of one another. Really give it
character and style. Don't make it boring."

DL-0 (this file) was planned in Plan Mode and approved 2026-10-28, and written on `ccr-2d53c4cf-8w7kd2` because
`track/dialogue` doesn't exist yet. DL-1 on starts on `track/dialogue`, which the owner makes from main (or from that
branch before its PR merges).

## The owner's answers (2026-10-28)
- Markup: **bracket tags**, like today's leading `[happy]` (`[b]…[/b]`, `[wave]`, `[p]`, `[face=smug]`).
- Portraits: **"Use the new rigs the character branch is working on"**: the characters track's jointed figures
  (docs/phases/characters-track.md, game/js/figures.js), not more work on today's wardrobe-crop portrait.
- Extras approved: pop-up emotes, the frame behind the portrait bouncing, mid-line face swaps, bubble shapes
  (shout, whisper, think).
- Writing: I mark up the key scenes (the opening, Chosen, Kappi, Blake, the Bureau) with a light hand, in one
  session; the owner reviews. The rest stays plain until rewritten.

## In short
- **A conversation, not a text box.** Bubbles stack like a group chat drawn as a comic: the newest at the bottom, the
  last two above it, smaller and dimmer, speakers on alternating sides, interruptions that knock a bubble aside, a
  "…" bubble before a slow or dramatic line, a Log of the whole talk.
- **Every character has their own bubble:** the Bureau's form paper with a rubber stamp, Professor Chosen's
  pompous gold, Kappi's calm leaf, Blake's brash pop-art slant, your neon edge.
- **Text that acts:** about 12 tags (bold, slant, big, small, colour, wave, shake, slow, fast, pause, face, emote),
  letters that arrive with a small rise, automatic beats after punctuation, a Text speed setting.
- **Portraits that perform:** random blinks, a mouth synced to the voice, the head on a spring (nod, jolt, shake,
  droop), emotes popping beside the head, the frame bouncing, the listener dimmed. On the new figures the head
  really turns; today's portrait gets the cheap parts only, since CH-14 removes it.
- **Motion with a cause**, inside the UI track's rules: transform and opacity only, at most two idle loops a screen,
  all off under Reduced; the frame tilts, the text never does.

## What the code does today (read at main 76aea599, 2026-10-28; verify)
- **One path for every spoken line.** `talkLine(who, text, expr, o)` (game/js/talk.js:105) is called by `talk()`
  (:225), `storyGameStage.say` (game/js/story-stage.js:254-275, every person, trainer, story, banter and event script),
  `cutsceneSay` (game/js/cutscene/director.js:345-358, `{cs:true}`), folk chat (talk.js:288), `residentHomeTalk`
  (story.js:219-241), the quest board (quest-board.js:108-166), route-sight.js:107, field-moves.js:75-266 and the
  `talk` fixture (fixture.js:211).
- **The box** is one `#talk` layer with one `.talk-box` (talk.js:92-104). The bubble is UI-2's: the panel's clip-path
  on `::before`/`::after` (`--clip-bubble`, `--edge-bubble`, `--bubble-tail: 18px`; game/css/dialogue.css:5-42,
  tokens from logic/ui-theme.js shapes :291-419), three slow idle loops (`m-bubble-float/wiggle/breathe`,
  game/css/motion.css:330-367) and a squash pop on each new line (`box.animate({scale})`, talk.js:127). The owner's
  word at UI-2: "subtle, not seasick". game/css/talk.css holds the older base rules (`.talk-layer`, the `csUp`
  entrance, `.talk-more` bob); dialogue.css overrides it. studio/gallery.html:178 has a static copy of the markup.
- **Text** is typed through `line.textContent = text.slice(0, n)` at one letter every 28 ms (talk.js:145), instant
  under reduced motion. No inline markup, no pauses, no text-speed setting. A leading `[expr]` is stripped
  (talk.js:110) and in scripts by `sayLine` (logic/script-parse.js:287-303, `[\w-]+`).
- **Voice**: `soundEffect('blip', {who})` every 3 letters (talk.js:151); sound.js:474-500 gives each speaker a pitch
  (Kappi their own purr) and a random step from [0, 2, 4, 7].
- **Portrait**: a 96 px slot with a circle behind it, the head breaking out of its top (dialogue.css:46-80).
  `drawPortrait` (person-art.js:996-1016) poses the full-body wardrobe rig and crops the bust (`wardrobe.json
  crops.bust`, about 62×76 art px), scaled by whole device pixels (`drawTalkPortrait`, talk.js:237). Expressions are
  wardrobe piece swaps (eyes blink/happy/surprised/sad/angry, brows angry/sad/surprised, mouth
  happy/sad/angry/surprised/talk; one `expr` per item, person-art.js:626-629). `talkTick` (talk.js:257) redraws every
  70 ms: a blink fixed at `ts % 3700 < 130` (none while happy), the mouth flapping every 120 ms only on lines with
  **no** expression tag. `talkBox.onType` (:38) exists and nothing listens to it. Kappi is a creature
  (`creaturePortrait` :1019; blink, talk and happy only).
- **The new figures** (characters track CH-2, CH-3, behind Engine > People > Figures, off, waiting on the owner's
  pick): game/js/figures.js `bakeFigure(Fig, clip, frame, V, ppm, outline, style)` :439 renders jointed rigid parts
  in a small WebGL2 context and reads the picture back (:497); game/js/logic/figure-pose.js `figurePose` :356 (the
  head is a joint, `P.rot[at('head')]`), `jointMatrices` :460, `figureFaceMarks` :716 paints a code figure's face in
  whole pixels (eyes, glint, mouth, blush; it already knows `P.blink`). Bakes are gated by `FIGURE_BAKES_A_FRAME`
  and `frameBudgetLeft` (:551-560); the cache holds 600 pictures (`FIGURE_CACHE_BYTES` 48 MB). The Rogue stand-in has
  its face in its texture.
- **Text elsewhere** (not through `talkLine`): the battle box `#msgT` with its own typer (battle.js:445-468), walk
  speech drawn on the canvas (`drawSpeech`, walk-view.js), event intros (`encLineHTML`, encounter-screen.js:140), the
  opening's hot takes `#csBubble` (opening.js:462).
- Corrected at DL-1: `#csBubble` is filled in game/js/cutscene/opening.js:462 (declared in cutscene/director.js:333);
  `drawSpeech` is walk-view.js:4758, called from walk-view-gl.js; the three leading-expression readings disagreed
  (talk.js `\w+`, script-parse.js `[\w-]+`, expressions.test.mjs `\w+` plus a space, and it skipped indented script
  lines). All now go through `leadingExpr`.
- **About 600 spoken lines** (banter 143, events 131, biome chat 72, maps 48, story 30, trainers 28, lore 23,
  cutscenes 21, quests about 40, about 30 in JS). `*`, `_`, `~`, `^`, `|`, `<`, `>` and backticks appear in none;
  `[` only as the leading expression; `{word}` is a slot (unknown slots are a parse error, script-parse.js:297).
  tools/check-data-text.py bans `<`, `>` and backticks in all text.
- **Fonts**: the voice font Jersey 15 (one weight) and the prose font Oxanium (500 and 600 only), from uiTheme.json.
- **Tests that read the box**: `talkBox.cur.text`, `.tap()`, `.done()`, `.typing` and `#talk .talk-who`
  (check-fast.py:446-532 and 1401-1418, check-quick.py:1747 and 1919, self-test.js:2239 and 2353, story-stage.js:504);
  the Safety step (check-quick.py:500-580) sends a hostile `<img data-pwn>` name through `talkLine`;
  idle-life.test.mjs fails on any new endless CSS animation not listed in logic/idle-life.js (`IDLE_LOOPS`,
  `SIGNAL_LOOPS`, :85-124) and gated in motion.css; `uiElementCount` (theme-sheet.js:143) has ceilings
  (check-quick.py:57); the gallery shots (check-ui-gallery.py) freeze animations; tools/test/opening-said.json is the
  owner-approved opening text; tools/test/expressions.test.mjs checks every expression tag has pieces.

## Research (2026-10-28)
Done online in DL-0 by three researchers. Some sites couldn't be opened from the session (itch.io, codepen.io,
blambot.com, kleinletters.com, gameaccessibilityguidelines.com); those points come from search summaries, and points
marked [unverified] are rules of thumb.

**Tag syntaxes.** Ren'Py: `{w}` waits, `{cps=20}` speed, `{size=+10}`, `{b}`. Yarn Spinner (Night in the Woods):
`[wave]…[/wave]`, `[wave=2]`, self-closing `[pause=500/]`, `[/]` closes all; the game implements every effect.
Celeste: `{~}` wavy, `{*}` shaky, `{!}` impact, `{big}`, `{0.5}` pause, `{>> 0.5}` half speed, `{trigger N}` events
mid-line, `[MADELINE left normal]` portrait lines. Godot BBCode: `[wave amp freq]`, `[shake rate level]`,
`[rainbow]`, custom effects get each glyph's index and time. Febucci Text Animator: *behaviours* loop after a letter
appears, *appearances* play once. Square brackets are the easiest to type on a phone and don't clash with HTML.

**Games.**
- Oxenfree: bubbles over heads so the player never looks away; you can talk over people, and the writers wrote a
  "picking my point back up" line for nearly every interruptible moment; players complained about lines vanishing,
  so crosstalk needs a log. A small bubble with Alex's face pops when someone's opinion of her shifts: a model for a
  reaction stamp.
- Florence: argument bubbles redesigned as sharper and sharper shapes, arriving faster.
- Persona 5: the style is in the frame; its slanted text and moving baselines were "impossible to read at first"
  (Hashino) and Tactica went back to a plainer font. Tilt the frame, keep the text straight.
- Paper Mario TTYD: no voices, so bubbles change speed and size for tempo and volume.
- Animal Crossing: a voice built per letter, higher when happy, lower when sad, faster when skipped; muttered lines
  faded.
- Undertale and Deltarune: per-character fonts and voices, the strongest precedent for per-character bubbles.
- Ace Attorney: the "Objection!" burst slams in with a shake and a flash for under a second.
- Chants of Sennaar: the log is part of the fiction.

**Comic lettering** (Blambot, Comicraft's glossary, Todd Klein, BnF's speech-bubble sheet). Burst = shout, bold
text; dashed or dotted edge = whisper; a cloud with a trail of bubbles = thought; a uniformly spiky edge with a
lightning tail = electronic or radio; icicles = cold or hostile; a wavy edge = weak or feigned. The stress word is
bold and italic together, sparingly. A double dash or em dash = an interruption, an ellipsis = trailing off. About
25 words a balloon at most. Tails point at the mouth. One speaker's beats in a row are linked balloons. Readers start
at the top bubble and read down.

**Motion and the web.**
- Springs: CSS `linear()` approximates a spring (the Linear Easing Generator, Archibald and Argyle). iMessage-like
  bubbles: response about 0.35 s, damping about 0.7, on scale and offset, never on width (width reflows the text).
  Material: mobile transitions about 300 ms (enter 225, exit 195); over 400 ms feels slow.
- Stacks: FLIP (First, Last, Invert, Play) for the older bubbles sliding up; hand-rolled with the Web Animations API is
  more predictable on phones than View Transitions, which animate snapshots. Framer's chat stacks cap the visible
  bubbles and measure the new one's height first so nothing jumps.
- Letters: split into spans with an index (Splitting.js, SplitType, GSAP SplitText); build them all at line start,
  hidden, so the line breaks are fixed before anything shows. Animate each letter's arrival once, then leave it
  still; loop only inside tagged words; no `will-change` on hundreds of spans.
- Shapes: SVG paths are the most flexible, but the panel's clip-path pair (fill and edge) already works here and has
  its tests; bursts and clouds as polygons with a seeded random push per point keep one shape per bubble. An
  `feTurbulence` wobble is slow on iOS and has crashed Safari when left running: use 2-3 pre-built outlines swapped
  at 8-12 fps ("boiling line") if a wobble is ever wanted. Halftone in pure CSS: a repeating radial gradient with
  hard stops. A hard pop-art shadow: a duplicate shape offset 3-4 px (cheaper than `drop-shadow`).
- Accessibility: the animated letters `aria-hidden`, the whole line once in an `aria-live="polite"` node; Reduced:
  instant text, no wave or shake, bold, size and colour kept; colour never alone; text 16 px or more; at most about
  40 characters a line on a phone; a speaker name each time the speaker changes.

**Sources**
- https://raw.githubusercontent.com/renpy/renpy/master/sphinx/source/text.rst
- https://raw.githubusercontent.com/YarnSpinnerTool/YSDocs/main/docs/getting-started/writing-in-yarn/markup.md
- https://github.com/EverestAPI/Resources/wiki/Adding-Custom-Dialogue
- https://raw.githubusercontent.com/godotengine/godot-docs/master/tutorials/ui/bbcode_in_richtextlabel.rst
- https://docs.febucci.com/text-animator-unity/effects/built-in-effects-list
- https://www.thumbsticks.com/gdc-17-creating-narrative-gameplay-oxenfree/
- https://mcvuk.com/business-news/i-thought-we-were-going-to-go-out-of-business-sean-krankel-on-the-development-of-oxenfree/
- https://www.player.one/florence-game-ken-wong-interview-123975
- https://kotaku.com/-metaphor-refantazio-persona-5-menu-ui-hashino-1851667088
- https://inverse.com/gaming/persona-5-tactica-user-interface
- https://www.rpgsite.net/review/2739-paper-mario-the-thousand-year-door-review
- https://nookipedia.com/wiki/Animalese
- https://deltarune.wiki/w/Voice
- https://aceattorney.fandom.com/wiki/Objection!
- https://www.axios.com/2023/09/08/chants-of-sennaar-rundisc-interview
- https://blambot.com/pages/comic-book-grammar-tradition
- https://kleinletters.com/Blog/punctuating-comics-dots-and-dashes/
- https://www.balloontales.com/articles/glossary/index.html
- https://bdnf.bnf.fr/uploads/fiches/8.%20Speech%20Bubbles.pdf
- https://developer.chrome.com/docs/css-ui/css-linear-easing-function
- https://vp0.com/blogs/imessage-reply-bubble-physics-swiftui
- https://m1.material.io/motion/duration-easing.html
- https://aerotwist.com/blog/flip-your-animations/
- https://css-tricks.com/animating-layouts-with-the-flip-technique/
- https://www.framer.com/marketplace/components/chat-bubble-pro/
- https://splitting.js.org/guide.html
- https://gsap.com/docs/v3/Plugins/SplitText/
- https://dev.to/savvasstephnds/the-problem-with-the-typewriter-effect-and-how-to-fix-it-2731
- https://greensock.com/forums/topic/33075-gsap-and-feturbulence-mobile-performance/
- https://frontendmasters.com/blog/pure-css-halftone-effect-in-3-declarations/
- https://devdocs.xbox.com/gaming/accessibility/xbox-accessibility-guidelines/104
- https://80.lv/articles/10-golden-rules-on-subtitles-for-games
- https://w3c.github.io/wcag/understanding/animation-from-interactions

## The look
### 1. A conversation, not a text box
- The newest bubble sits at the bottom, over the bottom bar where the box is today. The last two stay above it,
  pushed up on a spring: the one before at 0.88 and 85% opacity, the one before that at 0.76 and 60%, each
  clamped to two lines; then they leave. Older bubbles stop moving and keep their text readable (contrast 4.5:1).
- Speakers take sides: you always on the right, anyone else opposite whoever spoke before them. Each bubble has its
  speaker's portrait and name tag; the listener's portrait in the stack dims.
- One speaker's lines in a row are **linked bubbles** (a short bridge, no second portrait), as in comics.
- **Interruptions:** a line ending in `—` or `[cut]` stops mid-word and goes on by itself after 250 ms; the next
  bubble knocks it aside (about 8° and 20 px) as it settles into the stack.
- **The "…" bubble:** three dots for 400-800 ms before a line marked `[wait]`, and always before Kappi's first line.
- **The Log:** a small Log button on the newest bubble opens the whole conversation, scrollable (closes with a tap).
- **Choices** take the history's place above the newest bubble, so the tail never meets a button.
- **The height budget** on a 390×844 phone: the bottom bar 96 px plus about 34 safe area, the newest bubble about
  146 (the 96 px slot, padding, the tail), two older ones about 64 each: about 300 px, capped at 40% of the screen
  height (the oldest drops first). The CAM-2 two-shot (talk.js:316) keeps the speaker above it; phone-checked.

### 2. Every character has their own bubble
Skins are data (`game/data/talkSkins.json`): a speaker or faction maps to a skin; a skin names its shape, edge,
fill, name-tag style, decoration, entrance and blip. Starting skins (the mockup in DL-0 shows them; the owner picks):
- **The Bureau** (any speaker of its faction): form paper, faint ruled lines, a form number in the corner
  ("Form 27-B/6"), a typewriter blip. On a punchline a rubber stamp thunks onto the bubble (APPROVED, DENIED,
  PENDING, FILED, VOID: the style track's words and `pb-stamp`): scale 1.4 → 1.0 in 120 ms, a little crooked, a
  small thump of the bubble.
- **Professor Chosen:** a gold edge, one shine sweep as each new bubble arrives (finite, not a loop), his name tag
  with a small laurel.
- **Kappi the Wise:** a soft rounded leaf of a bubble, slower and gentler entrances, the "…" before they speak, a
  calmer blip.
- **Blake:** a brash slanted bubble, a halftone corner, a hard offset shadow in the plum outline colour.
- **You:** a neon edge (the outsider from the cyberpunk city).
- **Townsfolk and trainers:** today's cream bubble, a seeded accent colour each.

### 3. Bubbles shaped by tone
- `[shout]`: a spiky burst (seeded, so each burst has its own shape that holds still). It squashes 1.15 × 0.85 for
  60 ms, rebounds and shakes 2-4 px once; bigger bold text; a louder blip a few notes higher.
- `[whisper]`: smaller, a dashed edge, fainter text, a soft blip.
- `[think]`: a cloud with a trail of three dots in place of the tail; no blips.

### 4. Motion with a cause
- **Pop-in:** from the speaker's side, scale 0.6 → 1.06 → 1 over 240 ms with a 10 px slide, and a tilt of ±3° chosen
  once per bubble (seeded by the line). The player's bubbles are a little springier than everyone else's.
- **Grow to fit:** the new line is laid out before it types, so the bubble springs once to its final size
  (response about 0.35 s, damping 0.7) and never jumps while typing.
- **Breathing:** only the active bubble keeps the UI-2 loops, made smaller; older bubbles are still.
- **The frame tilts, the text doesn't** (Persona 5's lesson): the letters keep a straight baseline at any tilt.
- The UI track's rules hold: transform and opacity only, no animated filters, at most two idle loops a screen
  (`IDLE_MAX`), Calm and Reduced without idle loops, Reduced without any of this.

### 5. Text that acts
| Tag | Does | Notes |
|---|---|---|
| `[b]…[/b]` | bold, with a small pop as it appears | the 700 weight is "Ask me before" 1 |
| `[i]…[/i]` | a slant for the stress word | with `[b]`: the comic stress word |
| `[big]` `[small]` | 1.3 em in the voice font; 0.85 em and fainter | |
| `[c=gold\|red\|teal\|grey]` | colour from the palette tokens | always with weight or an effect |
| `[wave]` | letters bob in a travelling wave | a signal loop, off under Reduced |
| `[shake]` | a short jitter in whole pixels (0.4 s, once) | |
| `[slow]` `[fast]` | half and double typing speed | |
| `[p]` `[p=0.8]` | a pause (0.4 s, or the seconds given) | |
| `[face=smug]` | changes the face here, mid-line | any expression tag |
| `[emote=sweat]` | pops an emote here | ! ? sweat anger sparkle note heart |
| `[stamp=denied]` | the Bureau's stamp thunks onto the bubble | denied, approved, pending, filed, void |
| `[cut]` | the line breaks off; the next one interrupts | a line ending in `—` does the same |
| `[shout]` `[whisper]` `[think]` `[wait]` | the bubble's style, right after the expression | |
- Letters arrive with a 2 px rise and a fade (120 ms), not a hard typewriter.
- Automatic beats: about 4 letters' time after a comma, 8 after `. ! ?`, an ellipsis typed slowly.
- A **Text speed** setting: Slow, Normal, Fast, Instant (Instant shows the line at once).
- The voice follows the style: shout higher and louder, whisper softer, think silent, `[big]` an accent.
- Lines stay under about 25 words: the data check warns above that (a warning, not a failure).

### 6. Portraits that perform
- **Eyes:** random blinks every 2-6 s, a double blink about one time in six; none while happy.
- **Mouth:** opens on vowels and shuts on spaces, punctuation and pauses, held at least 60 ms, driven by the same
  tick as the voice; it also moves on lines with an expression tag (today it doesn't).
- **Head on a spring:** a happy nod, a surprised jolt up, an angry shake, a sad droop, a smug tilt; a small settle
  when a line starts. On the figures the head joint really turns (in stepped angles, which read as pixel-art key
  frames); on today's portrait there is no head motion.
- **Emotes:** small pixel icons (12 px cells, drawn at whole device pixels) pop beside the head, 0 → 1.2 → 1 over
  200 ms, and fade after about a second.
- **The frame bounces:** the circle behind the portrait squashes and springs on reactions; the pixel art never
  stretches.
- **Mid-line faces:** `[face=angry]` swaps the face on the punchline.
- Reduced: blinking and talking stay, no bounce, no head motion (07-portraits.md:20).

## How it is built
1. **Markup** (DL-1): `game/js/logic/line-markup.js`, pure and tested in Node.
   - `parseLine(text)` → `{plain, style, runs: [{from, to, fx}], events: [{at, kind, v}], errors}`.
   - `MARKUP_TAGS` and one `leadingExpr()`, used by talk.js:110, script-parse.js:292 and expressions.test.mjs:39, so
     a leading `[shout]` or `[b]` is never read as an expression; a test that no wardrobe expression is also a tag.
   - `sayLine` turns bad markup (an unknown tag, an unclosed or crossed tag, a face with no pieces) into a script
     error with a did-you-mean (as slots do, script-parse.js:297); the Studio's script box shows it (`storyFindings`).
   - Choice options show `plain` (only `[b]` allowed in them).
   - `talkBox.cur.text` becomes the plain line, so every check that reads it keeps working.
   - The other surfaces use `plain`: the battle typer (battle.js:445), walk speech, `encLineHTML`, `#csBubble`;
     opening-script.test.mjs compares `plainOf(text)` so the approved opening doesn't churn.
   - docs/SCRIPTS.md and the script commands reference (script-parse.js:499) list the tags.
2. **The letter renderer** (DL-2), in talk.js:
   - Built with `createElement` and `textContent` only, never `innerHTML`, so the Safety step's hostile name stays
     text. Each word a `nowrap` inline-block span of letter spans with `--i`; spaces stay text nodes, so the line
     wraps normally and the bubble's size is final before the first letter shows.
   - The existing `step` loop reveals letters (`.on`), with pauses and speed from the parsed events.
   - Effects in a new game/css/talk-text.css. `wave` is listed in `SIGNAL_LOOPS` (logic/idle-life.js) and gated in
     motion.css; everything else is finite.
   - The letters `aria-hidden`; a visually hidden `p.talk-sr` carries the plain line and the `aria-live`.
   - `uiElementCount` counts a `[data-one-piece]` subtree (a line, an older bubble) as one piece.
   - Text speed: a row on Settings' game tab beside Battle speed (settings-screen.js:391), `preferences.textSpeed`
     with its default in logic/saves.js.
   - Blips: `soundEffect('blip', {who, style})` (sound.js:474).
   - The `onType` hook finally gets listeners (the director, DL-5).
3. **Shapes and skins** (DL-3):
   - New shape families in `UI_SHAPE_FAMILIES` (logic/ui-theme.js:291) and the Studio's list (`UI_FAMILY_LABELS`,
     ui-dials.js:96): `bubbleShout` (a new `jag` kind: seeded zigzag points in `shapePoints`) and `bubbleThink` (a
     large radius, the dots as a `span.talk-dots`). The fallback copies in tokens.css are checked by
     ui-theme.test.mjs. Whisper is CSS only (a dashed edge masked on `::after`).
   - The seed for a bubble's own shape and tilt comes from its line, kept in a custom property.
   - Growing: a registered `@property --grow` animated from the old height over the new to 1, the pseudo-elements
     scaled by it from the tail; it stacks with the idle loops' `translate`, `rotate` and `scale` properties. The
     spring is a `linear()` string from a new `springEase(response, damping)` in logic/motion.js, with a test.
   - Skins: `game/data/talkSkins.json` and `game/data/schema/talkSkins.schema.json`, registered in index.json, read
     through game-data.js; `.talk-box[data-skin]` rules in a new game/css/talk-skins.css. One central file rather
     than people/*.json, because the Bureau's skin covers many speakers and the Studio edits one place.
   - The stamp reuses the style track's `pb-stamp`.
   - Dials (the Studio's UI section, the Motion group, ui-dials.js:232): the bubble's spring, the idle strength, the
     base typing time; uiTheme.schema.json gets the keys.
4. **The stack** (DL-4):
   - `.talk-layer > .talk-stack`; each new `talkLine` while the layer is open demotes the previous bubble
     (`was-1`, then `was-2`, then removed); `talkHide` clears the stack.
   - A demoted bubble's name tag becomes `.talk-was` and its line `.talk-said`, so only the newest bubble has
     `.talk-who` and `.talk-line`: check-fast.py and check-quick.py keep finding one of each. `talkBox.cur` is
     unchanged.
   - `game/js/logic/talk-stack.js`: `stackStep(prev, who, style)` → `{side, linked, keep, drop}`, tested.
   - The push-up is FLIP with the Web Animations API (measure, add, invert, spring).
   - The side swap is a grid swap plus `scaleX(-1)` on the pseudo-elements; the text is never flipped.
   - The interruption advances by itself, so tests that tap through wait on `talkBox.cur !== st` before tapping
     again (check-fast.py).
   - The Log keeps the plain lines of the open conversation (never saved, never sent).
   - studio/gallery.html shows a stack of three (a shout, a whisper, a thought) with markup.
5. **Portraits** (DL-5, DL-6):
   - **The director**, `game/js/logic/talk-director.js`: rig-agnostic, seeded (tested with a fixed seed). In: the
     line's events and each typed letter (`onType`). Out, each tick: `{expr, eyes, mouth, head: {yaw, pitch, roll},
     bounce, emotes}`.
   - **Today's portrait** (figures off; DL-5): expressions may combine (`'happy+talk'`: each wardrobe item uses the
     last token it has pieces for, person-art.js:627), so the mouth talks while the eyes stay happy; blinks and the
     mouth from the director; frames kept per `(who, combo)`; emotes and the bounce in CSS; no head motion. Kept
     small: CH-14 deletes this path.
   - **Figure close-ups** (figures on; DL-6): `bakeFigure` gains an options argument: a bust window (the anchor below
     the canvas, tilt 0), head angles added to the head joint's rotation before `jointMatrices`, and no face (it is
     painted after). Pictures kept by stepped head angle (about 5 × 3 × 3 = 45, about 37 KB each, about 1.7 MB);
     the rest pose baked when the talk opens, at most one bake a frame through the existing gate, the nearest kept
     angle shown meanwhile. The face painted fresh each tick from `figureFaceMarks` with the director's state. The
     Rogue model's head (a mesh clip) needs the head-joint step that CH-12 brings; until then it gets no head motion.
   - **Emotes**: `game/art/ui/emotes.png` (12 px cells: ! ? sweat anger sparkle note heart) and
     `game/data/emotes.json`; drawn in the slot's top 55 px, which the circle mask leaves whole.
6. **With the characters track** (agreed in DL-0; tell the CH session when DL-5 starts):
   - DL owns the director, the stack, the close-up bake and the emote sheet.
   - CH-6 supplies each figure's face set (eyes, brows, open and shut mouths for every expression tag) through a
     small `faceState` argument to `figureFaceMarks`, agreed in DL-6. If CH-6 isn't in yet, DL-6 uses the
     mannequin's marks plus a 2 px open mouth.
   - CH-11 (talk and emotes in the world, emote bubbles) reuses emotes.json and the director's head hits; CH-12
     (spring bones, look-at) can reuse the director's spring.

## Sessions
Each session ends with lint, typecheck, unit tests and the smoke subset, screenshots at `?fixture=talk` (the look
skill), its HANDOFF entry, and the owner's phone check.

- **DL-0 The plan.** This file, ROADMAP, BRANCHES, HANDOFF; the interactive mockup, docs/samples/dialogue-mockup.html
  (also a private page for the owner: https://claude.ai/artifact/FuBfW9mRqSeao2y9rmJLDW): four scenes (Chosen and
  Kappi, the Bureau, Blake with a choice, Kappi calm) playing the stack, the skins, the shapes, the tags, the faces,
  Text speed and the motion levels, plus a box to try any line. Its `parseLine` is a first cut of DL-1's parser and
  its shapes and numbers are DL-3's starting point; its faces are stand-ins for the figures. Docs only.
- **DL-1 Markup.** line-markup.js, `leadingExpr`, plain text on every other surface, the data checks, SCRIPTS.md.
  Tests: line-markup, line-markup-real (every spoken string in game/data parses), expressions, script,
  opening-script. On the phone: nothing looks different; a bad tag shows in the Studio's script box.
  **Done in DL-1** (2026-10-28, `track/dialogue`): as planned, with these choices. Unknown tags stay in the plain
  text as typed (a mistake shows). A point tag between two spaces leaves one space. `[face=x]` is checked for shape
  only in `parseLine`; that the face has wardrobe pieces is the expressions test's job (it now collects `[face=x]`).
  `sayLine` keeps the line's markup in `text`, with the styles put back in front after the speaker
  (`[happy][shout] Chosen: …` → expr happy, who Chosen, text `[shout]…`). The "under about 25 words" data warning
  waits for DL-7. The Studio GitHub check (tools/check-studio-github.py, `--only=story`) types a bad tag.
- **DL-2 Letters.** The span renderer, the effects, pauses and speeds, the screen-reader copy, Text speed, blip
  styles, the element count rule. Tests: idle-life, the Safety step, settings, motion. The full quick check. On the
  phone: bold, wave, shake and the pauses read well; the Reduced setting.
  **Done in DL-2** (2026-10-28, `track/dialogue`): bold is **Oxanium 700** (the owner's answer to Ask me before 1;
  game/fonts/oxanium-700.woff2, 8.8 KB, in ui-theme.js `UI_FONTS`). The timing is its own logic module,
  game/js/logic/talk-type.js (`TEXT_SPEEDS` slow 42 / normal 28 / fast 14 / instant 0 ms a letter; `letterTimes`:
  [slow] ×2, [fast] ×0.5, [p] seconds, beats of 4 letters after `, ; :` and 8 after `. ! ? …` only where a space
  follows, an ellipsis ×3), tested in talk-type.test.mjs. talk.js `talkLetters` builds `.talk-line[data-one-piece]` >
  `span.talk-sr` (the plain line) + `span.talk-glyphs[aria-hidden]` > `span.w` > `span.l` (`--i`, `fx-*`); the box
  keeps its `aria-live`, which now reads the whole line once. The effects compose through custom properties
  (`--talk-pop`, `--talk-shake`, `--talk-wave` in one `animation` list); their keyframes are in motion.css (ui-lint:
  keyframes live there only). Wave is the signal loop `.talk-glyphs .fx-wave`. Reduced: Instant typing (as before) and
  no rise, pop, shake or wave; Calm keeps them (they have a cause). Colours are the colour code's text shades
  (`--sig-value-text`, `-bad-`, `-good-`, `-machine-`). Battle speed's default lives in settings-screen.js, not saves.js
  (the track said saves.js); Text speed's default is in saves.js as asked. Face, emote, stamp and cut events are parsed
  but act in DL-4/DL-5.
- **DL-3 Bubbles.** Pop-in from the side, the grow spring, the tilt, shout, whisper and think, the skins and the
  stamp, the dials. Tests: ui-theme, the skins' schema and data, springEase. On the phone: every character's bubble.
- **DL-4 The stack.** Sides, links, interruptions, the "…" bubble, choices, the Log, the height budget, the gallery.
  Tests: talk-stack; check-fast and the quick check (element ceilings). On the phone: three bubbles at most; the
  speaker stays in view; a choice in a stack.
- **DL-5 Faces.** The director, today's portrait (combined expressions, blinks, the mouth), emotes, the frame bounce,
  the listener dimmed. Tests: talk-director, expressions. On the phone: faces feel alive and stay crisp.
- **DL-6 Figure close-ups.** The bust bake, the head spring in stepped angles, the face state (with CH-6). Tests:
  the figure tests, the bake count in the debug log. The full quick check with figures off and on. On the phone:
  figures on, heads nod and jolt; the debug log's bake cost.
- **DL-7 The writing pass.** Markup in the opening, Chosen, Kappi, Blake and the Bureau's lines, light-handed: a
  stressed word, a beat before a punchline, a face on the turn, a stamp on the Bureau's best lines. The owner reviews
  every changed line; opening-said.json only changes at the owner's word.
- **DL-8 (optional) The rest.** Effects in the battle box (its own typer) and the walk speech; a stamp in battle.

Tags `dl-N-done` are not asked for per session (CLAUDE.md); the track gets `dialogue-done` when it ends.

## Ask me before
1. Bold: add Oxanium 700 (one small woff2), or show stressed words in the voice font. **Answered 2026-10-28 (DL-2):
   Oxanium 700.**
2. Each skin's final look, after the mockup (DL-0) and again on the phone (DL-3).
3. The lines in DL-7, and any change to the approved opening text.
4. Whether the "…" bubble and the stamp also show outside Kappi and the Bureau.

## Risks
- Tests that tap through talk: the interruption's auto-advance and the stack's renamed classes (`.talk-was`,
  `.talk-said`) must keep check-fast, the quick check and the full test finding one current line.
- The Safety step if anything ever uses `innerHTML` on a line: DOM calls only.
- `@property` and the Web Animations API on custom properties need Safari 16.4 or later; older Safari gets the box
  without the grow spring.
- Figure bakes read back from the graphics chip: a stall on a slow phone (DL-6 measures it).
- The phone's height: three bubbles and the bottom bar must leave the speaker in view.
- Too much motion: the owner's UI-2 word "subtle, not seasick" stands; every number is a dial.

## Key files
- game/js/talk.js, game/css/dialogue.css, game/css/talk.css, game/css/motion.css, studio/gallery.html.
- game/js/logic/script-parse.js, game/js/logic/script.js, game/js/story-stage.js, game/js/cutscene/director.js,
  docs/SCRIPTS.md.
- game/js/logic/ui-theme.js, game/js/ui-dials.js, game/css/tokens.css, game/data/uiTheme.json,
  game/js/logic/idle-life.js, game/js/theme-sheet.js.
- game/js/person-art.js, game/js/figures.js, game/js/logic/figure-pose.js.
- game/js/sound.js, game/js/settings-screen.js, game/js/logic/saves.js.
- New: logic/line-markup.js, logic/talk-stack.js, logic/talk-director.js, game/css/talk-text.css,
  game/css/talk-skins.css, game/data/talkSkins.json and its schema, game/art/ui/emotes.png, game/data/emotes.json.

## Verification
- New unit tests: line-markup, line-markup-real, talk-stack, talk-director, springEase.
- Kept green: idle-life, the Safety step, the element ceilings, expressions, opening-script, ui-theme, check-fast's
  talk steps, the full test's talk taps.
- The full quick check at the end of DL-2, DL-4 and DL-6; gallery baselines remade in their own commit when the
  box's look changes on purpose.
- The owner's phone after each session; the debug log in DL-6.

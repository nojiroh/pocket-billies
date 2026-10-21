# UI track (UI) - Semigloss Angular

A track of its own, like the Studio and Map generator tracks (owner's brief and answers, 2026-10-21; planned in a
chat session, not yet started in the repo). It reworks the UI's shapes and palette, keeps the alpha 0.5 semigloss,
gives the Studio a UI section, and finishes phase 06's leftover (06-5). Each session is tagged `ui-N-done`.

Mockup (Team, battle, payout; the kit; three palettes): a private Design canvas the owner holds, "Semigloss Angular
mockup". The chosen look there is the row titled "Chosen".

## Where it fits in the roguelite track
- UI-1 to UI-4 run beside RL-3 to RL-7. Those sessions build logic and the run world and add almost no screens, so
  the two tracks barely touch. UI sessions stay out of `ui.js` until UI-5.
- UI-4 finishes before RL-7, so RL-7's day chip, locked pins and forecast icons and RL-8's screens (mast, payout,
  keep-one picker, clinic cost, shop sheet, relic picks) use the new parts and need no CSS of their own.
- UI-5 and UI-6 wait for the owner's play test of RL-8, like every RL session after RL-8.
- After UI-6, each RL session builds its screens (ranch, Lab board, relic list, bracket pick, salvage sheet, ghosts)
  from the kit and adds them to the Studio preview.

## What the code does today (read at main 072f993, 2026-10-21; verify)
Phase 06 (06-1..06-4) put every screen on tokens and Lit, but the old layers still win most rules. Counts come from a
pattern scan of comment-stripped CSS and JS; treat them as within a few percent.

| Rule (06-plan.md, tokens.css) | Measured in game CSS | Worst files |
| --- | --- | --- |
| Corners 12, 16, 22 px, pill, circle only | 200 raw radii vs 81 token uses; 20+ distinct values (10 px 43×, 6 px 31×) | style.css 64, screens.css 62, v05.css 30 |
| Space on the 4/8/12/16/24/32/48 scale | 746 raw padding, gap and margin values vs 152 token uses (6 px 128×, 10 px 80×, 3 px 48×) | style.css 323, screens.css 263 |
| Three depths | 81 hand-written box-shadows | v05.css 26, style.css 19 |
| One motion file, three speeds | 91 keyframes (9 in motion.css); 191 transitions or animations with raw times, 25+ durations | style.css 38, polish.css 12 |
| Two fonts by token | 12 raw font-family lines; v05's `--disp`/`--body` duplicate `--font-voice` | loader, style, v05 |
| Colours as variables | about 740 raw colour literals in CSS rules; 547 hex colours in game JS | style.css 232, screens.css 180 |
| Old CSS emptied | about 10,600 of 12,600 lines in loader, style, battle, polish, screens, v05; 205 `!important` (107 in v05) | style.css 4,404 lines |
| Escaped rendering | 57 `innerHTML` writes, 39 `style="` strings in game JS; Lit `html` used 7 times (safe today: 06-4's Safety step) | battle.js 13, ui.js 9 |
| One module per screen | ui.js 2,952 lines | 06-5 parked |
| Dead CSS removed | 72 rules name a class nothing uses (tools/unused-css.mjs) | v05, screens |

UI-1 found (read at 29834ca): the fonts in use were not the ones tokens.css and style.css name. v05.css set both
`--disp` and `--body` to Pixelify Sans, so all UI text was Pixelify; style.css's Tiny5/Chakra pair was dead. Chakra
Petch still draws the loader's text (loader.css), canvas captions (walk-view.js, things-to-do.js) and the Studio;
Tiny5 the walk view's pixel labels and the opening's canvas text. The colour roles were spread over two sets
(style.css `--bg --panel-s --gold --red --ok`, v05.css `--text --text2 --line --g-* --gold-a/b`), with no primary,
danger or ground name. tools/ui-lint.mjs counts every length in a shorthand, so its numbers differ from the table
above (spacing 1,093 raw values, radii 168): see the UI-1 HANDOFF entry. Blurred surfaces measured on the phone
screens: walk 6, map 12, team 6, ledger 5, profile 4, shop 8, battle 3, against the budget of 3.

UI-2 found (read at 3479f01): the plan's "screens already on the kit" were few: only the lead card (`pb-panel`) and
the toast used kit components; the team rows, the battle cards and plates, the sheets and the dialogue box are page
markup styled by units.css, battle-ui.css, ui-kit.css and dialogue.css, so UI-2 shaped them there. The gallery had no
picture tests and the quick-check baseline is not in git, so the gallery's baseline is committed
(validation/ui-gallery/). How the shapes are built (logic/ui-theme.js, "the angular shapes"): each family's outline,
its 1 px edge ring and the ring outside it are clip-path polygons made from uiTheme.json (`shape.families`: cut,
rounded or square; `shape.stepped`), written as `--clip-*`, `--edge-*`, `--ring-*`. A clip-path cuts off box-shadows
and borders, and a `filter` on an ancestor stops `backdrop-filter` blurring the page behind (a backdrop root), so a
glass part draws its shadow on a sibling layer clipped to the ring outside its outline; a solid page part carries a
`drop-shadow` filter and draws its fill and edge in its pseudo-elements; parts whose pseudo-elements were taken
(old sheets, battle buttons) are clipped themselves and go without a shadow. `corner-shape` is not used (Safari lacks
it). Type pills needed one line in ui.js (`typeBadgeHTML`), the only ui.js change.

UI-3 found (read at 550c4ed): uiTheme.json held only colours, the glass (light side only: the dark side's highlight,
edge and shadows were fixed in code), the cut sizes and the fonts; space, text sizes, line height, motion and the
depths lived only in tokens.css and v05.css, and which corners each family cuts was fixed in code. `overrides` was in
the schema but nothing read it, and presets merged one level deep. `--shape-panel/card/button` in tokens.css are dead
(families switch through the `--clip-*` polygons). The Studio can't take the game's theme sheet on its own page
(studio.css uses the same names: `--line`, `--text2`, `--text`...), so the preview is the UI gallery in a frame. Its
colour field took `#rrggbb` only (`line` is `#rrggbbaa`), and `studioBroadcast` didn't send the look, though the game
already applied it live. The Studio had no "Save as" (owner: it means Save as preset). ui-lint.mjs is Node only and
counts without lines, so the Studio's rule check with Show me needs a browser-safe module first (UI-3b). How UI-3a
built it: uiTheme.json version 2 (every dial's value, the defaults equal to today's CSS, proven by every custom
property resolving the same on the gallery and the 73 pictures); overrides scoped to each screen's root (`UI_SCREENS`)
with the variables the sheets derive at `:root` declared again (`UI_DERIVED`); the dials as a table
(logic/ui-dials.js); the contrast check shared by check-data and the Studio (danger and primary at 3:1 besides text at
4.5:1; not on presets, as alpha05's green reads 2.5:1).

UI-3b found (read at 00be53b): Ctrl+L was taken by Connections, so "Ctrl+L the reverse" is Connections on a UI dial
(the parts that read what it writes). ui-lint deleted comments, so its places shifted; it now blanks them and gives
lines. No Team, Bag or dialogue fixture existed and the game's screens draw into their own document, so a real screen
is the game in a frame at a new fixture. No DOM capture exists (glass, clip-paths and web fonts defeat DOM-to-image),
so before/after is live, side by side (owner's choice). The rule report is one line, not counted (owner's choice): the
gallery today has 45 texts under their contrast (white on type pills 3.2-3.8:1, the move tiles, the bot plate's name)
and 12 tap targets under 44 px; the Team screen blurs 4 surfaces (budget 3).

UI-4 found (read at 167cc96): the bowl draws its pins on a 2D canvas (world-bowl.js `worldBowlPin`), so a kit
component can't be a map pin: the node shapes are data (logic/run-marks.js) with a canvas painter (`runMarkDraw`)
for RL-7, and `<pb-node>` draws the same outlines as SVG. No node type, currency or weather data exists yet
(nodeTypes.json is RL-6, currencies.json RL-11), so every run part takes its values as attributes and reads no game
data; the currency names are the plan's placeholders. The page's modules share one namespace: the run parts live in
their own module (game/js/ui-run-kit.js) and take Lit and `reduced` from ui-kit.js. The shapes the plan didn't give
were chosen: a notched diamond for a mini-boss, a cut square for the landing, the shop slanted the other way from an
event, a small diamond for "?"; the event's slant is about 11°, as the plan's 10° reads too faint at pin size. The
gallery's pictures have the gallery's sticky bar over the top of tall sections (73 older pictures too); and a longer
gallery moves what the light glass blurs, so panels and cards in light were remade with the new sections.

No rule yet but needed: a layer scale (24 distinct z-index values, -1 to 2147483000) and cut-corner tokens. The Studio
is outside the 06 rules (studio.css: 108 raw radii, 372 raw spacing values, its own teal palette). The bottom bar's
tabs (walk, map, team, ledger, bag) and `--t-*` colours are the pre-roguelite game's.

## The look: Semigloss Angular (owner's decisions)
- **Kept:** frosted glass panels, the 1 px top highlight, layered shadows, the gold main action, light and dark for
  every screen, the eight motions' roles and the message rules.
- **Glass:** a bit less blur and a sharper 1 px highlight. Blur only on panels, sheets and bars; cards inside a panel
  are solid semigloss. At most 3 blurred surfaces per screen.
- **Shapes:** chamfered 45° cuts. Panels and sheets: top-left and bottom-right cut (`--cut-lg` 12 px). Cards: four
  small cuts (`--cut-md` 8 px), a gold notch on the left when selected. Quiet buttons: four cuts (`--cut-sm` 4 px).
  Main action: a long hexagon. Tabs: trapezoids. Selection: a slanted bar (`--slant` about 10°). HP, XP and stat
  bars: angular, segmented. Section rules: a line and a diamond. Smooth cuts, with a stepped pixel preset to compare.
- **Edge line:** a 1 px line that follows each cut, light on top and dark below.
- **Round stays:** portraits and avatars, type and status pills, the hub island's map pins, toggles, the joystick.
  Toasts, the inbox dot and coins go angular (shown in the mockup: a long-hexagon toast, a diamond dot, a slanted chip).
- **Meaning, lightly:** bot cards and the run map lean angular. Run nodes by type: diamond boss, hexagon town, chevron
  route, slanted event.
- **Reference:** Pokémon BW2's calm menus, with Medabots-style plates for bots.
- **Palette:** Copper Grove (solarpunk warm). Light: ground #F4EFE0, surface #FFFBF0, text #22301F, primary #3B8446,
  gold #F6D06C to #D99E33, danger #C8492F. Dark: ground #17261E, surface #1D2E25, text #EEF2E2, primary #7DCB7B,
  gold #F3CF6E to #DDA640, danger #FF8466. Healthy HP is teal, not green, so primary, the Grass pill and HP stay
  apart. Type colours stay those of types.json, darkened for contrast (logic/colors.js).
- **Fonts:** Jersey 15 for names, headings, buttons and numbers; Oxanium for long text (replacing Pixelify Sans and
  Chakra Petch). Jersey 15 has one weight: emphasis by size and colour, never faked bold. Its sizes run about 15-20%
  larger than today's. Both are self-hosted as woff2 in game/fonts with their OFL licences.
- **Icons:** a new set on the 45° grid, replacing game/art/ui's rounded icons. **Type pills** gain a glyph each
  (flame, drop, leaf...).
- **Portraits:** the circle sits behind; the head breaks out of its top.
- **Motion:** diagonal wipes along the 45° angle for screen changes and sheets; a plain fade with reduced motion.
- **Rewards:** payout, relic picks and the keep-one picker are showy (Balatro-like): rows slam in one by one, Capital
  counts up, the chosen card flips. Relics keep their own art (badges, items) and sit on a card when offered, the same
  card as the keep-one picker.
- **Bottom bar:** one bar whose tabs change. Run: Map, Team, Bag, Relics. Hub: Map, Team, Bag, Lab.

## Building it
- New tokens beside the radii: `--cut-sm/md/lg`, `--slant`, a `--z-*` layer scale, and a shape per component family
  (`--shape-panel`, `--shape-card`, `--shape-button`...) so the Studio can switch a family between cut, rounded and
  square.
- Cut corners are `clip-path: polygon()` from the cut tokens. A clip-path also clips box-shadows and borders: the
  shadow comes from `filter: drop-shadow()` on a wrapper or an underlay, the edge line and highlight from a
  pseudo-element with the same polygon. CSS `corner-shape` can replace this where the owner's phone browsers support
  it; check before relying on it. Cuts snap to whole device pixels next to the 32 px art.
- Components change in ui-kit.js and ui-kit.css, so every screen on the kit follows at once; old layers keep their
  shapes until each screen moves (UI-5).

## The Studio's UI section (owner's decisions)
Works like the Engine section (dials in groups, ↺ per dial, presets, Hold to compare, whole game plus overrides).
- **Data:** the look is `game/data/uiTheme.json` (schema, types, data check); boot writes it as CSS variables;
  tokens.css keeps today's values as the fallback. Presets are data too, so content packs can ship a look.
- **Overrides:** per screen, for colour and shape.
- **Dials:** colours (light and dark side by side, an AA badge per text colour), surface (glass opacity, blur,
  saturation, highlight, shadow tint, the three depths), shape (per family: cut, rounded or square; cut size; which
  corners; slant; the round list), space, type (scale, line height, fonts, Settings' Large text), motion (speeds,
  eases, spring, reduced-motion preview), layers (read-only).
- **Preview:** every gallery component in every state (empty, full, long names, 320 / 390 / wide, light / dark) beside
  real screens from fixtures: Team, Bag, a battle with the floating cards, the dialogue box, the payout, the run chip.
- **Tools (all four groups):** presets and Hold to compare; a rule check with Show me (tools/ui-lint.mjs, also in the
  Studio's Check); inspect (tap a part: its component and tokens; Ctrl+L the reverse) and overlays (tap targets under
  44 px, contrast failures, more than two glass layers); before/after shots. Find (Ctrl+K), Undo and Save as everywhere
  (owner, UI-3: "Save as" is + Save as preset, as in the Engine section; no Studio-wide Save as).
- **Split (owner, UI-3):** UI-3a builds the data, the section, the dials, the overrides, presets, Hold to compare, the
  gallery preview, Find, the contrast check and the check step; UI-3b the rest of the tools (real screens from
  fixtures, inspect and Ctrl+L, overlays, before/after shots, the rule check with Show me).
- **The Studio's own look** moves onto the shared tokens (its own calm preset) after UI-3. Desktop and iPad only.

## Sessions

| # | Session | Does | Visible change | Done when |
| --- | --- | --- | --- | --- |
| UI-1 (done 2026-10-21) | Theme as data, rules as a check | uiTheme.json + schema, boot writes the variables; `--cut-*`, `--slant`, `--z-*`; the Copper Grove palette and teal HP as data; Jersey 15 and Oxanium in game/fonts; tools/ui-lint.mjs counts raw values per rule and file and blurred surfaces per screen (report only); v05's `--disp`/`--body` folded into the font tokens | the palette and fonts | game otherwise identical; lint report in the HANDOFF entry |
| UI-2 (done 2026-10-21) | Kit v2: angular shapes | cut panel, card, button, tab, bar, selection with the edge line; `pb-card`, `pb-tabs`, `pb-stat-bar`, `pb-field`; the shared bot plate (limb pips); the 45° icon set; type glyphs; portraits breaking the frame; diagonal wipes in motion.css; battle floating cards and move tiles; gallery picture tests per component state | screens already on the kit | gallery picture tests and smoke pass; phone check of three screens |
| UI-3a (done 2026-10-21) | Studio UI section, core | uiTheme.json version 2; overrides read; the section with every dial group, the whole game or a screen, presets as data (+ Save as preset), Hold to compare, the UI gallery as live preview, Find, the contrast check in the Studio's Check; a Studio check step (a dial changed, previewed, undone, saved as a PR) | Studio only | the Studio check step passes |
| UI-3b (done 2026-10-21) | Studio UI section, tools | real screens from fixtures beside the gallery (Team, Bag, a battle, the dialogue box; payout and run chip once they exist); inspect (tap a part: its component and tokens) and Ctrl+L the reverse; overlays (tap targets under 44 px, contrast failures, glass layers); before/after shots; the rule check (ui-lint as a browser-safe module with lines) in the Studio's Check with Show me | Studio only | its check steps pass |
| UI-4 (done 2026-10-21) | Run parts | day and deadline chip, forecast icon row, node markers, the four currency chips, the relic and keep-one card, payout rows with their motion, the hub/run bottom bar | gallery only | RL-7 and RL-8 can use them with no CSS of their own |
| UI-5 | Every screen onto the kit | after the RL-8 play test: every screen, including ones the roguelite replaces, moves out of ui.js and the old CSS, one screen per commit, moves only (absorbs 06-5) | every remaining screen | each moved screen passes its UI test; the unused-CSS list shrinks |
| UI-6 | Old layers gone | style, polish, screens and v05 emptied and deleted; lint and the blur budget enforced (fail when raw values rise); accessibility pass; then `phase-06-done` and `ui-6-done` | none intended | ui-lint at or near zero; full quick check green apart from known reds |

UI-2 is the biggest; if it runs long, split it: shapes, edge line, wipes and battle cards first, then icons, glyphs,
portraits and the bot plate. About 6-8 sessions of Claude's working time, plus the owner's phone checks after UI-2,
UI-4 and UI-5.

## Risks
- Clip-path shapes plus blur on many surfaces can cost frames on phones: measure with the Graphics bench after UI-2.
- RL and UI sessions in parallel can both touch `hooks.js` (a new module value needs `npm run modules`): check for
  clashes at the start of each session.
- Any look change turns the quick-check picture baseline red: remake it on purpose once per session and say so in the
  commit.
- Jersey 15 at small sizes: check 12-13 px labels on the phone before UI-2 ends; the glyphs on type pills help.

## Ask me before
- Splitting UI-2 into two sessions.
- Changing any decision above (palette, fonts, which shapes stay round, the tab sets).
- Deleting an old CSS file in UI-6 while the unused-CSS list still names classes from it.
- The uiTheme.json schema's first version (shown as a draft at the start of UI-1).

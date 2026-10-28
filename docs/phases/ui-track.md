# UI track (UI) - Semigloss Angular
Branch: track/ui

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
gallery's sticky bar lay over the top of tall sections in the pictures (older ones too): in picture mode it now stays
at the top. A longer gallery moves what the light glass blurs, so panels and cards in light were remade.

UI-5 found (read at ca9aa54): no screen had ever left ui.js (bag.js, shop.js and settings-screen.js were born
outside it). A CSS "move" is not a pure move: the old layers load before the kit and v05.css carries 107 !important,
so a rule moved out of style.css lands after rules that used to override it; each move was proven with a computed-
style diff (tools/style-diff.py: 33 screens and states, light and dark) and the rules a later old rule overrode at
equal specificity were found on the page beforehand and left in place (Walk's .today/.here/.enc/.slot.empty/.buddy,
the shell's early .sheet, .dr-panel, .chal, the debug menu's fields). The screens' rules went into one file per
screen loaded right after v05.css and before the kit (the plan's units.css/menus.css load after the kit and would have
changed the cascade). The plan's "moves only" and "every remaining screen" (visible change) disagreed: the owner chose
move, then reshape. Page markup takes the kit's shapes through ui-kit.css .k-panel, .k-card, .k-btn, .k-action, .k-tab
(clipped to the family outline from uiTheme.json, the edge line in ::after; a clip-path cuts the old outer shadow);
the old .pb button, the shell's panels, tabs, segmented choices and pick rows join the families in CSS. The top bar
can't be clipped (the portrait breaks out below it): its glass is a clipped ::before. One !important stays in the kit
(square corners) against v05's own !important corners; it goes with v05. Only Team and the toasts had their own UI
test: the fast check's "Every screen opens with its parts" now opens each by the buttons a player taps. The bottom bar
(the owner: swap now): <pb-nav-bar> with the hub's or a run's set, Map, Team, Bag; Lab and Relics hidden until RL-11/12;
no Walk tab (the open tab again or Esc goes back to the world); the Guide from the Trainer card. The kit's shadow-tree
labels needed i18n.js i18nText (the page's translation observer can't see a shadow tree). The fast check's world map
step failed about one run in three on a postcard lying over the map (fixed in the check). Not moved, as the style
diff has no view of them: the opening cutscene, the postcard pop-up, the airship flight, the joystick and d-pad,
photo mode, the workshop and fishing; and the old shared pieces (.pb, .pbar, .px, .glass, .sec-h, .seg, .tpanel,
.fchip, .note) stay in the old layers for UI-6 to fold into the kit.

UI-6a found (written up from its commits in UI-6b; the session left no HANDOFF entry or row): of the old layers' rules, 125
went to the top of their screen files and 51 stayed, each one a rule a move would have put on the other side of a rule it
fights (a cascade check over every pair whose order changed); the parts the roguelite barely shows got a file each
(airship, postcard, controls, fishing, photo-mode, workshop, opening-old, evolution, full-test) and style-diff four views
for them (37 in all); what was left became base.css (the page: fonts, old variables, reset, the world behind the
screens, reduced motion; 98 rules) and parts.css (the old shared parts not on the kit: .px, .pb, .chip, .pbar, .seg,
.sec-h, .sheet, .pickrow...; 225 rules). The ratchet (`UI_LINT_CEILING` in logic/ui-lint.js) counts the whole game, so
two branches each under a ceiling can merge over it (it happened twice on 2026-10-22: lower the value or set the
ceiling to main's count). The blur budget and the accessibility pass were not done.

UI-6b found (read at 1bf2f45, 2026-10-26): 380 of the 995 raw spacing values, 43 radii and 14 times already equalled a
token, so they became it with no change on screen (style-diff 29 of 36 the same, the other 7 differing only by timing:
the map's fade layer, the title's live class, the battle canvases' size); the lint counted @font-face's family names
as raw fonts (8). The style diff's four sheet views had failed since UI-8 (they tapped a Billie card the Walk screen
no longer has) and it compared some screens before the place had faded in. Blur, measured by smoke's phone flow: walk
3, map 10, team 2, guide 3, profile 2, shop 5, battle 3; on the 36 style-diff screens up to 14 (heal pick, bag 12): the
count includes the screen under a sheet. The game's tap rule is 40 px (06-4, the quick check), the Studio's overlay 44
px; small icons carry an invisible 7 px margin (menus.css), so most of the overlay's marks pass the game's rule. Its
contrast overlay misreads the kit's clipped pseudo-element fills (white text on dark called 1.9:1); a pixel-based
reading is closer but still muddled by glass over the moving scene and by entrances: findings were judged on pictures.
Real ones fixed: the Guide's quiet tabs sat on the bare scene (v05's 7 % tint as the track: 2.2:1 light, 1.4:1 dark),
and every active segment was v05's white under dark mode's light text (1.03:1). The kit's square-corner !important
still has work: v05's !important corners moved to parts.css in UI-6a.

UI-9a found (read at 066f970e, 2026-10-27): parts.css loads before all 27 screen files and the kit after them, so a move
into the kit hands every fight a screen rule won back to the part: tools/css-order.mjs (new) counted 619 for the whole
file, and nearly every one of its 48 !important beat a real screen rule. A tenth of its declarations were dead (beaten
by a later one on the same selector). The `.badge` rules never reached anything: the game's only `.badge` is in
`<pb-nav-bar>`'s shadow tree, and the unused-CSS check counts words in JS, so it can't see that. An !important in a
keyframe is ignored, so v05Grow (the Billie sheet's stat bars) never ran. The owner's answers: UI-9 split (UI-9a
shrinks parts.css in place, UI-9b the rest and the snapping); tap targets stay 40 px (the Studio overlay now marks
under 40, `--tap` stays 44 px as the size real controls use).

UI-9b found (read at 2e74c89d, 2026-10-27): the radius scale had nothing under 12 px, and base.css still defined v05's
`--r-s/m/l` (6/10/16 px) and `--r1/2/3`; "nearest step" would have turned every 3-8 px corner into 12 px. The owner
added `--r-xxs` 4 px and `--r-xs` 8 px (named so beside base.css's old `--r-s`). The owner's first pick for parts.css,
a cascade layer, can't keep the screens: in a layer a rule loses even the fights it wins today by specificity
(css-order, which now reads layers: 3,827 changed; 130 declarations both win and lose, so no split between a layer
and unlayered works), and unlayered at ui-kit.css's top it wins fights screens win today by order (29 of 36 views
differ). base.css loaded just before parts.css, so appending it there changes nothing: the owner's second answer.
"Ties up" was kept only where a value moves 1-2 px, as the plan promised; 20, 28, 36 and 40 px (moves of 4-8 px) and
values above 48 px are layout sizes and stay (39 in all, named in each file's commit).

No rule yet but needed: a layer scale (24 distinct z-index values, -1 to 2147483000) and cut-corner tokens. The Studio
is outside the 06 rules (studio.css: 108 raw radii, 372 raw spacing values, its own teal palette). The bottom bar's
`--t-*` colours are the pre-roguelite game's (UI-5 swapped the bar itself).

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
| UI-5 (done 2026-10-22) | Every screen onto the kit | after the RL-8 play test: every screen, including ones the roguelite replaces, moves out of ui.js and the old CSS, one screen per commit, moves only (absorbs 06-5) | every remaining screen | each moved screen passes its UI test; the unused-CSS list shrinks |
| UI-6a (done 2026-10-22, PR #112; written up 2026-10-26) | Old layers gone | style, polish, screens, v05 and battle.css deleted: screen rules to their screen files, legacy parts to a file each, the rest to base.css and parts.css; style-diff views for the legacy parts; the ui-lint ratchet in `npm run lint` | none | style-diff 37 of 37 the same; lint fails when a raw count rises |
| UI-6b (done 2026-10-26) | Lint down, blur and accessibility | raw values that equal a token became the token (no change on screen); the blur budget enforced per screen; the accessibility pass (tap targets, contrast, names); then `phase-06-done` and `ui-6-done` | the Guide's tabs, five controls up to 40 px | ui-lint ceilings lowered; smoke and the tap-target step green, each seen failing on a planted fault |
| UI-9a (done 2026-10-27) | parts.css shrunk in place | split from UI-9 by the owner: tools/css-order.mjs; parts.css's dead rules, 41 of its 48 `!important` (each fight checked), the type pill into ui-kit.css, its keyframes into motion.css; the tap rule decided: 40 px, the Studio overlay too | none | css-order and style-diff the same at every CSS commit; ui-lint !important 194 -> 153 |
| UI-9b (done 2026-10-27, branch `track/ui`) | Off the scale, the rest of parts.css | parts.css appended whole to base.css (0 fights change) and deleted, the owner's answer after the layer was measured; css-order reads `@layer`; `--r-xxs`/`--r-xs` added, `--r1/2/3` renamed to `--r-sm/md/lg`, v05's `--r-s/m/l` gone; 1-2 px are hairlines in ui-lint; every CSS file snapped, one per commit (nearest step, ties up, no value moved more than 2 px); v05Grow switched on | spacing and corners 1-2 px on most screens; the stat bars grow in | ui-lint radius 99 -> 0, space 616 -> 39; css-order 0 changed fights at every commit; gallery baseline remade on purpose; phone check by the owner |
| UI-7a (done 2026-10-23) | Settings: Sound | the Test buttons go; a slider plays its sound once when let go (the music slider not over a song); each row has its own mute (the Volume row's is the master mute); dragging a muted slider unmutes it; the duplicate on/off switch goes | a mute icon on each sound row, no Test buttons | quick check's Sound settings step passes; phone check by the owner |
| UI-7b (done 2026-10-23) | Settings: layout | seven tabs (Sound, Display, Controls, Accessibility, Game, Save, Help), opening on the last one used; time, weather and season to the debug menu; Start over into the Save tab's red section, one shared reset that stops a battle; Save card: runs won and taxed; Customize trainer to the trainer card; Help: a Report a problem box (Full test, Export debug log) | the new tabs | quick check green, settings screenshots remade on purpose |
| UI-7c (done 2026-10-23) | Debug menu | grouped by task (tests, give me, Billies, battle, run, places, story, ranch and time, save); one copy of each test; no phase codes in labels; a search box; open sections remembered; a message saying what changed; the four old buttons gone once checked unused | the new menu | quick check green |
| UI-8 (built 2026-10-26, phone check next) | Bottom bar with the minimap | Map becomes the minimap tile in the middle of the bar, two buttons on each side (Team, Guide; Bag, Perks or Lab); the bar compact while walking; what sits above the bar on `--nav-h`; the minimap's dials in the Studio | the new bar | fast check's bar step (team,guide,map,bag,lab); gallery run-hud remade; phone check by the owner |

UI-2 is the biggest; if it runs long, split it: shapes, edge line, wipes and battle cards first, then icons, glyphs,
portraits and the bot plate. About 6-8 sessions of Claude's working time, plus the owner's phone checks after UI-2,
UI-4 and UI-5.

## UI-7: settings and the debug menu (owner's decisions, 2026-10-23)
Asked for by the owner: settings and the debug menu clearer for players. Decided in a question round: a slider plays
its sound when let go (not while dragged); the music slider skips it while a song plays; a drag unmutes a muted row
(unmuting plays nothing, a slider at 0 keeps the plain icon, a muted row doesn't grey out); World sounds and Ambience
stay two sliders; seven tabs, opening on the last one used; time, weather and season overrides move to the debug menu
(they change which Billies appear, a cheat in a roguelite); Start over into the Save tab; the Save card shows runs won
and Billies taxed (no km walked); Customize trainer moves to the trainer card; Help keeps only Full test and Export
debug log; the debug menu stays at the bottom of Help (and Ctrl+Shift+D, `?debug`), gets a search box, remembers its
open sections, says what each button changed; Walk 1 km, Earn every badge, Reset trainer wins, Lead +3 win streak
and Age storage go once each is checked unused (badges and storage ageing are still read by the game: ask again if
they turn out useful). Three steps, a tag each (`ui-7a-done` …).

UI-7a as built: `preferences.mutes` (audio/levels.js gives a muted bus 0 and keeps its level; unit-tested), a
`.vol-mute` button per row in settings-screen.js (the master row's sets `preferences.mute`, the header button's
preference), `testVolume` called on a slider's `change`, the effects slider's drag tick removed, the on/off switch
removed (its hint moved to the Volume row), translations. Found while reading: the debug menu's Erase save and
Settings' Start over are two copies of the reset, and only the debug one stops a battle in progress (UI-7b).

UI-7b as built: one `settingsReset` (moved to settings-screen.js; stops a battle, which Settings' copy didn't); Start
over leaves the footer for a red section at the foot of the Save tab; the Save card reads `meta.wins` of `meta.runs`
and the Field Guide's taxed count; Customize trainer left the Save tab (the trainer card's Edit look opens the same
dressing room); time, weather and season are a debug-menu section (same preferences); Help's Report a problem box
holds Full test and Export debug log, the diagnostics test joined the debug menu's Performance row (the others were
there already); seven tabs (keys `sound`, `graphics` shown as Display, `controls`, `access`, `game`, `save`, `help`),
wrapping onto two rows at 390 px; the last tab used is `preferences.setTab` (Sound with none); translations.
Not changed, worth a look: Help's How to play still describes the legacy game (towns and roads, map arrows, eggs on
real time).

UI-7c as built: the five old buttons went after a check (no species evolves by storage time or win streak: 61 by
level, 3 split; no shop item or place needs badges; walking only adds to the trainer card's distance), their game
code stays. The brief's "bowl map test twice" was by then one button and Settings' leftover handler, removed. Nine
sections, each `<details data-k>` built by `debugSection` (keys `tests`, `give`, `billies`, `battle`, `run`,
`places`, `story`, `ranch`, `save`); Tests and performance open by default, Battle forced open during a battle,
Places during a test scene. Open sections are kept in localStorage `pb-debug-open` (this browser, never in the save,
so never exported or synced; the owner's pick of the two); a refresh keeps them by key. The search box (`#dbgFind`,
`debugFind`) hides buttons whose words don't hold the text, rows and sections left empty and the notes, opens the
matching sections, keeps a section whole when its title matches, and puts the sections back when cleared; searching
isn't remembered as opening or closing. Each button's message says what it changed (money and currencies what you
have, the team its levels, a test scene's checks how many passed). Colour key: gold gives (money, items,
currencies, a Billie, levels, the Field Guide, the robot kit, a Loophole, Win now, Win the run), red erases or
starts a battle (Battle it now, As an Alpha, trainers, Clear encounters, Lose the run, Erase save); a note at the top
says so. Phase and track codes went from labels and notes; test scene names lose a bracketed phase note in the menu
only (the map data keeps it for the Studio). The quick check's new Debug menu step checks it.
Found while reading, not changed: the trainer list still offers the legacy leaders (Rocco and the rest).

## UI-8: the bottom bar with the minimap (owner's brief and answers, 2026-10-26)
The owner asked for a new bottom bar: a big, roughly square map in the middle that is also a minimap, two buttons on
each side, under each other, in the current look. Online research (thumb reach: Hoober's field study; Roblox's
mobile UI guide: the bottom corners belong to movement; minimap rotation and shape surveys) and a clickable mockup (a
private Design canvas the owner holds, "Bottom bar + minimap mockup") came first. The owner's answers: the Guide is the
fourth button (both sets), north up, trainers and wild Billies shown, facilities in the hub and towns as one small icon
on the roof (no labels, never on plain houses), no doors, exits or next-node arrow, and the bar compact while walking.

As built (branch `ccr-30c007a6-eol40p`; `track/ui` didn't exist):
- `<pb-nav-bar>` (ui-run-kit.js): the set's Map tab is a raised tile (card family: four cuts, the edge line, gold
  edge and notch when open) holding slot "map"; the rest go two to a side. The outline is the tab family's stepped up
  round the tile with 45° shoulders (`navStep`, clip-path polygons on `--rise` and `--tw`). `compact`: a 72 px tile,
  icon-only buttons side by side. A container query keeps the labels on a 320 px phone.
- js/minimap.js: a canvas in that slot, drawn about five times a second on frame-scheduler.js: the ground by kind
  painted once per view at a pixel a metre (tiles' row 0 is north) and scaled up unsmoothed, the roofs, facility
  icons by the door's act (`p.act || M.act`), trainers not beaten (`walkView.npcAt`, TRAINERS, flags), the wild ones
  placed (`walkRenderer.encPos`) and you (a chevron by `pl.dir`). Indoors the room's floor alone. Colours are the
  theme's roles mixed (no colours of its own: the lint's ceilings hold). Skips a frame a battle or a cutscene borrows.
- `--nav-h` (shell.css): the dialogue box, the hint and Actions, sticky rows, the map's controls, the d-pad and the
  debug button clear the bar: 172 px with it, 102 px compact, the old 96 px with no bar.
- uiTheme.json `minimap` (schema, defaults, the Studio's Minimap group): metres across (44), compact after 2.5 s of
  walking, full 0.7 s after stopping, and which marks show; written as `--minimap-*`, read where the canvas sits.

Left for later: the full quick check's pictures (the bar changed on purpose); a minimap step in the fast check beyond
the bar's tabs; the owner's phone check (the compact timing, the icon size, the frame cost on a phone).

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

# Part 2: Living Semigloss (UI-10 onward)

Branch: track/ui

The owner's brief (2026-10-27): "Make a new plan for the ui. I like the current design but I think it could be better
looking and feeling. Think of the ux experience. Do research. Make sure everything is in the same design language.
Make sure it's not too cluttered. Give me samples of different color pallets. It should feel dynamic and alive. Status
effects and things you get in runs should be color coded so you can see what is what at a glance. If you have any
design suggestions I'm open to it."

Planned in UI-10 (Plan Mode, plan approved) on `ccr-03a15a70-nd3yqu`, since a cloud session pushes only to its own
branch; from UI-11 on, sessions start on `track/ui` after UI-9b's PR #266 merges. Three read-only passes (the UI code;
everything a run gives or a battle does; outside research) and a review of the draft against the code. Semigloss
Angular stays the base: Part 2 changes meaning, colour, motion and density, not the shapes.

Sampler: a private artifact the owner holds, "Living Semigloss Sampler"
(https://claude.ai/artifact/89UBnLzgC5Uq99aytdb6SS): the palettes on real screens captured headless (battle, Team,
walking in a run, the run map, the Perk pick; light and dark), the colour code, mock screens of a battle turn, a run,
rewards and Team on backdrops from the game, a colour-blind preview, Animation Full / Calm / Reduced and the Colour
shapes switch. The captures and the page live outside the repo (nothing committed).

## What the code does today (read at 6a48215 and 60eef39, 2026-10-27; verify)
Line refs to parts.css move to base.css with UI-9b (#266).
- **Gold means about 15 things:** the main action; Prime and Coat (units.css 67-70); Lead (team.css 92-105); Damaged
  (units.css 618-628); Moneys and Beans (pb-coin falls back to gold); shop and waystation nodes and the current node
  (logic/run-marks.js 142-167); finished quests (map-tab.css 175-177); today in the forecast; crits and level-ups, both
  #ffe27a (battle.js 582-585, battle-screen.css 27-51); the shield and Bedrock rings; Sandstorm, with the bolt icon
  (battle.js 514-517, battle-screen.css 325-340); Alpha in the turn bar (battle-screen.css 1168-1171). Red means about
  9 (burn, Fire, low HP, Broken, Crests, all five danger node types, stat drops, the foe in the turn bar). Purple: Sleep
  #7b6be9, Dragon, Flying, the Perk and DNA icons, the Guide tab. Light blue #8FD8FF: stat up, Protect, the bot plate,
  limb HP. Towns are green on the run map, orange on the hub map (world-bowl.js 3666-3671), blue in the places list
  (map-tab.css 329-332); Alpha is crimson on its plate, gold in the turn bar.
- **The battle's command buttons borrow type colours** for things that aren't types: Bag green, Team blue, Run dark
  (battle.js 742-779, parts.css `.pb.green/.blue/.dark`).
- **Most battle effects can't be seen:** Kindling, Undertow, Live Wire, Wild Mind and Alloy never show
  (battle-engine.js 316-317, 393-413); Protect, the Alpha shield, Soaked, Fork, the delayed hit and sharp stones show
  only on their turn (battle-engine.js 523-720); held-item, Perk and trait boosts at the start are applied silently
  (battle-state.js 94-107); stat chips print the first three letters, so Sp. Atk and Sp. Def both read "SP." (battle.js
  509). Statuses are square outlined badges with full words and three fixed hexes (ui-bits.js 29, parts.css 268-286),
  with particles in the 3D scene (battle-stage.js 798-811); burn's `--red` follows the page theme on an always-dark
  plate (battle-screen.css 968-990). Confusion is a short effect, not a status (statuses.json holds par, slp, brn).
- **About 45 effect sources have no coding;** they share 16 effect kinds (logic/effects.js 5-18): 13 Perks (5 common, 5
  uncommon, 3 rare, one lavender icon for all, rarity as caption text: perk-screen.js 36-40), 8 held items (items.json
  `hold`), 11 gene traits (genes.json), Unstable, 5 Expeditions and 4 challenges (modifiers.json), residents' services,
  timed event effects (run-enc.js 37-48, shown nowhere). Reward kinds are grey captions (reward-screen.js 41-61); item
  icons are shared across kinds (the pretzel twice, trail mix three times, the tonic twice); event outcomes have no
  good or bad look (encounter-screen.js 258).
- **Type colours:** pills are darkened to 4.5:1 (colors.js `readableBg`, ui-bits.js 22-27), but move tiles, plates,
  the Guide and battle effects use the raw types.json colours (white text 2.7:1 on Flying up to 5.9:1 on Dragon;
  OKLCH lightness 0.52 to 0.80, so some types shout and others mumble).
- **Two looks still mix:** 5 of the 17 kit elements appear only in the gallery (pb-button, pb-card, pb-tabs, pb-field,
  pb-node); 32 literal `rgba(46,33,64)` (alpha 0.5's purple) shadows in 8 files; three XP blues (ui-kit.js 773,
  parts.css 195, the battle plate); the top bar's `.tb-chip[title='Money']` rules never match (shell.css 214-222,
  274-276: the markup says Moneys); battle plates are always dark while the cards beside them follow the theme.
- **Clutter sits in battle and on the Map:** the command card holds about 30 labels and a ticker repeats the plates on
  a 26 s loop (battle.js 520-564); the Map draws 10 blurred surfaces against the budget of 3 (check-quick.py 48), a
  header with Give up, trip status and quests, four side buttons, three rotate buttons and a place card of up to 8
  blocks; sheets stack to 12-14 blurred surfaces (heal pick, Bag). Walking is lean (no currencies or forecast), but the
  hint pill never leaves (walk-tab.js 196), the Actions button bobs forever (walk-tab.css 366-382) and five animations
  loop endlessly (walk-tab.css 20, 198, 230, 381, 473).
- **The motion set is barely wired:** of the eight motions (06-plan.md 81-89, motion.css), sheet, nudge and done are
  never used by game code; count only in pb-coin and pb-payout (ui-run-kit.js 450, 755); press, enter and idle only on
  Team cards and the inbox (unit-card.js 154-163, overlay.js 93); nothing sets a pick card's `facedown`, so it never
  flips. The kit's JS reads the game's Animation setting (`reduced()`, ui-kit.js 54), but its shadow CSS uses
  `:host-context` (ui-run-kit.js 626, 761), which Safari and Firefox ignore. The low-HP bar animates a `filter`
  forever (battle-screen.css 1049).
- **Sound:** select, confirm, cancel and can't (sound.js 719-775), a coin per payout row, the run jingles, the Perk
  jingle, the shop's buy; nothing for a sheet, a card flip, a count-up's end or a toast.
- **Theme:** boot applies `defaults` only (boot.js 975, theme-sheet.js 56), but `applyUiTheme(theme, preset)`
  (theme-sheet.js 27) already takes a preset: a palette at runtime is one call. A new colour role takes four edits
  (`UI_ROLES`, the schema's palette, tokens.css's fallback, a Studio dial: ui-dials.js 74-87). The minimap mixes the
  theme's roles (minimap.js), so a palette's hue reaches it (a purple palette gives a purple minimap: seen in the
  sampler's captures).
- **Icons are objects** in fixed colours, the owner's P5 (ART-NOTES.md, "UI icons, 36×36"); the SVGs are the source
  since SA-2b (the Studio's icon editor, logic/icon-block.js, logic/svg-pixels.js). Every drawn pixel is opaque, so an
  icon's SVG also works as an alpha mask.
- **Settings** already has Animation (Device / Full / Reduced), Theme (Device / Light / Dark), Flashes and High
  contrast (settings-screen.js 446-470).

## Six rules for one design language
1. **Calm chrome, loud meaning.** Panels, text and buttons use the palette's quiet colours; saturated colour is kept
   for things that mean something. One gold main action per screen.
2. **One meaning, one colour, everywhere.** A family means the same on every screen; nothing changes colour by view.
3. **Never colour alone.** Every coded mark has colour, shape and glyph, and its word on tap (Game Accessibility
   Guidelines; Xbox guideline 103), checked with a colour-blind simulation.
4. **Glance, tap, sheet.** Glance: glyph and colour. Tap the plate or row (long-press in battle): a short explainer.
   Sheet: the full details.
5. **Motion has a cause.** Things move because something happened. Frequent motion is small and short; big moments
   get the big effects; idle loops are slow, small and at most two on screen.
6. **The world shows through.** The glass takes the sky's light, in small steps (no Follow the sky theme: the owner
   turned it down).

## The colour code (the same in every palette)
Separate channels, as Hades, Balatro, Pokémon Showdown and Marvel Snap do:

| Channel | Shows | Mark |
| --- | --- | --- |
| Fill colour + glyph | a type (9) | round pill, as today |
| Status colour + glyph + code | a status: BRN, PAR, SLP | angled tag in a fixed slot by the HP bar |
| Arrow first, colour second | a boost or drop | ▲ teal / ▼ red with Atk, Def, SpA, SpD, Spe and pips |
| Small glyph + turns left | a short effect (Protect, the shield, confusion, Soaked, Fork, the delayed hit, stones) | pip on the plate or the field strip |
| Family colour + frame shape | what kind of pickup | the card's ribbon and silhouette |
| Frame, pill and name in the tier's colour | rarity | the loot ladder: common grey, uncommon green, rare blue, mythical orange (never a fill) |
| Family colour + icon | currency, map node, message | chip, node outline, toast |

Families. The fill is for tags, chips and bars on dark glass (dark text on it); the text shades are for words and bars
on light and dark screens.

| Family | Means | Fill | Text, light | Text, dark |
| --- | --- | --- | --- | --- |
| Good, teal | healthy HP, boosts, heals, held items, good outcomes, Protect and shields, towns | #40D9C1 | #007E6E | #57D6C0 |
| Bad, red | low HP, drops, damage, bad outcomes, Broken, danger buttons, bosses, Crests | #EA5974 | #BD2C42 | #FF8A9F |
| Caution, amber | mid HP, Damaged, costs, field hazards (stones, Sandstorm) | #FAAB3F | #9A5505 | #F5AD53 |
| Value, gold | the main action, Moneys, shops and stalls, rewards | #FACA59 | #855E11 | #F6CB69 |
| Special, violet | Perks, events and "?", rumours, timed event effects, friends' ghosts | #AE7EE2 | #7847A6 | #CFA3FF |
| Growth, sky | XP, candy, evolution, level-ups, Research, the Lab | #82D7FF | #1774A4 | #8BD6FA |
| Machine, gunmetal | Scrap, Augments, bot parts and limbs, scrapyards, the Workshop | #99AEBB | #546673 | #ABBECA |
| Bio, magenta | DNA, Genes, splices, Unstable, quirks, the Gene Bank | #DA5AB6 | #A73189 | #FF8BDD |
| BRN ember | Burned | #FF8F49 | #AF4803 | #FF9D61 |
| PAR lemon | Paralyzed | #ECE95C | #756700 | #EBE86F |
| SLP dusk | Asleep | #B3B3DD | #656390 | #B6B6DD |
| Types | the 9 types at one lightness (white text 4.5:1; Electric keeps dark text), used everywhere | types.json | | |
| Neutral | Lead, fainted, locked, plain routes, Beans, consumables (their own art), info | palette greys | | |

The types at one lightness (OKLCH L about 0.58): Fire #CC4C25, Water #1577D0 (UI-13; #2C78C5 sat 4.2 from Flying), Grass #418623, Electric #E2B92C (dark
text), Ground #A16B32, Flying #5973BE, Psychic #C14B7F, Steel #65798A, Dragon #7C63D6.

Rarity (the owner's picks: the loot ladder over metal frames, then "frame and pill" from the bar examples): a thick
frame in the tier's colour, a pill with the tier's name, and the item's name written in the tier's colour; the kind
stays on the ribbon. Common #A5ACB2, uncommon #4AB962, rare #629BFF, mythical #F77036 (orange, clear of the Perks'
violet). Text shades, light: #5F6469, #02782E, #2F5EB9, #AA3700; dark: #B9BEC4, #7CD68B, #8ABDFF, #FF9A6B (5:1 or more
on all three player palettes' surfaces; dark text on every fill 6:1 or more). It shows on Perks (common, uncommon,
rare), on held items, Augments and Genes (their tiers are new: proposed by price and effect size, the owner's call) and
on Billie cards (each species' rarity, common to mythical, today shown only in the Guide). Common's grey sits close to
the Machine family's gunmetal: on an Augment card both are quiet, and the pill names the tier.

Checked by script (UI-10, OKLCH and OKLab, Machado 2009 for colour blindness): dark text on every fill is 5:1 or more;
each text shade is 4.5:1 or more on every candidate palette's surface; within each screen's set (battle, pickups,
map, types included) pairs are apart (OKLab distance 5.5 at the lowest, 94-100% of pairs 9+). The nearest pairs
(amber and Electric, burn and amber, red and Psychic, gold and Electric) never share a kind of mark. Under simulated
colour blindness the close pairs (burn and confusion, sky and teal, red and cocoa) always differ by glyph and code.

Gold keeps only "value and your choice". Prime becomes a teal ★ tag; Coats get a prism foil; level-ups go sky;
crits keep VFX-4's impact frame (the UI only recolours the crit number); the map's "you are here" is its own pin, not
a gold node. Object icons keep their fixed colours (P5); only the new marks' glyphs are tinted, as CSS masks of the
same SVGs (`-webkit-mask` with `mask`, shadows on a wrapper; no `mask-composite`).

## Palettes (chrome only; the colour code never changes)
Every palette sets ground, surface, text, text2, line, primary and the gold pair, light and dark; danger and the HP
colours come from the families. Contrast (UI-10's script): text 12-16:1, muted text 5.8-8.8:1, primary and danger
4.5:1 or more, dark text on gold 6.3:1 or more.

| Palette | Mood | Light: ground, surface, text, text2, primary, gold | Dark: ground, surface, text, text2, primary, gold |
| --- | --- | --- | --- |
| Today | Copper Grove as it is | #F4EFE0 #FFFBF0 #22301F #55634F #3B8446 #F6D06C/#D99E33 | #17261E #1D2E25 #EEF2E2 #AEB9A4 #7DCB7B #F3CF6E/#DDA640 |
| Copper Grove+ | today's, tuned: primary clear of Grass and the HP teal | #F4EFE0 #FFFBF1 #203020 #51604D #3A6B3D #F6CF6D/#DB9E38 | #15241D #1D2F26 #EEF2E2 #B1BCA7 #85CD75 #F3CF6E/#DEA640 |
| Field Guide | a naturalist's journal: parchment, ink, moss | #F0E5CF #FAF3E3 #2E1F14 #625240 #5E721F #F2C36A/#D18E35 | #1A1611 #25211A #F1E7D2 #BCAF99 #B0CB67 #EEC469/#DB9D40 |
| Brass & Plum | regal; purple chrome makes the green world pop | #F5EAE5 #FEF9F4 #361B34 #684E65 #763671 #F7CB65/#DB992E | #1F1120 #2B1B2C #F7EAF5 #C4ABC1 #DC95D5 #F4CC6A/#DEA13C |
| Bureau Night | dark-first agency look: cool ink, cyan, form paper by day | #E6EAEF #F8FAFD #151E2F #4A5669 #0078A2 #F9C555/#E1961B | #0B111F #141B2C #E9EFF6 #A5B2C4 #31CFEE #F9C555/#E9A128 |
| Sunpunk Day | bright sky and sunflower, the most Pokémon-bright | #E2F5F4 #F9FFFF #0C263A #415C6F #1777B8 #FBD452/#EBA503 | #071B2B #0F2638 #E6F3F7 #A1BCCA #61C3F9 #FACF4E/#EDA922 |

Light `line` is the text colour at 18%, dark `line` white at 14%; the shadow tint stays as today (light: text; dark:
black). The minimap takes the palette's hue, so a purple or blue palette needs its own minimap ground (UI-12).

The owner's pick (2026-10-27): **Field Guide is the default**, and players choose between Field Guide, Copper Grove+ and
Bureau Night in a new Palette row in Settings (the owner's words: "Bureau night and field guide, make them options in
the settings"; the default question's Field Guide option named Copper Grove+ and Bureau Night as the other two). Brass
& Plum and Sunpunk Day stay as Studio presets, not offered to players. Today's Copper Grove gives way to Copper
Grove+.

## Alive, without clutter
- **First, wire what exists:** press, enter (rows staggered 35 ms), sheet, nudge (with the can't sound) and done on
  every screen; the pick card flips. New sounds where there are none: a sheet opening, a card flip, a count-up's end,
  a toast.
- **Feedback (you caused it):** press squash and spring; the selection bar slides to its new row; numbers tick with a
  pop in their family's colour; gains fly to where they go (coins to Moneys, an item to Bag, a Perk to Perks) and the
  target bumps.
- **Events (the game tells you):** a status tag stamps on; boosts rise, drops fall; a trigger gets a blip by its plate
  (a Perk, held item, trait or type passive firing: its glyph in its family's colour, "Bubble Wrap −10%", "Kindling
  ▲Atk"); short effects stay as pips with turns left; effectiveness banners slam in at the slant. The blips read what
  the battle already reports, so the battle engine and its golden record (battle-golden.test.mjs) stay untouched; if
  an event must be added, its snapshot is remade in a commit of its own with the end states shown unchanged.
- **Idle life (slow, small, few):** a glint across the main action every 6-8 s; reachable map nodes breathe and the
  "you are here" pin bobs (canvas work in the map code); Coats shimmer (a moving sheen layer, transform only); today's forecast icon moves; the glass shifts with the sky in steps, not every frame. Walking drops
  from five endless loops to at most two; the low-HP pulse moves to opacity.
- **Big moments:** payout, picks, catch, level-up, evolution, a boss's name banner (shared with RL-14b's stage intro).
  Hit-stop stays only on crits, KOs and super-effective hits (the VFX track's).
- **Timings** (NN/g; the research): press 80-120 ms; enter 220-280 ms with a 30-40 ms stagger, 400 ms at most; exit
  150-200 ms; pops 150 ms then a 500-700 ms float; tick-ups 400-700 ms ending in a small pop. Transform and opacity
  only: never animated blur or filters.
- **Settings (today's rows extended):** Animation Device / Full / Calm (no idle loops) / Reduced (fades only), where
  Device plays Full unless the phone asks for reduced motion (the owner: Full by default); a new Palette row (Field
  Guide, Copper Grove+, Bureau Night); Theme stays Device / Light / Dark; Flashes also governs glints and foil; a
  Colour shapes switch in Accessibility adds patterns to bars and tags. All of them go into the debug log's state with
  the resolved light or dark side (debug-log.js 442-448), never save data.

## Less clutter
- **Battle:** the ticker goes; a field strip shows the weather and hazards as glyphs with turns left. Plates: name,
  level, HP with its trail (the `.ghost` bar, battle.js 1161-1182), up to 3 tags and "+N". Move tiles: glyph, name,
  power, effectiveness; accuracy and text on long-press (`-webkit-touch-callout: none`). The command buttons go quiet
  (chrome with icons), so the moves are the loud choice.
- **Walk:** the hint shows when it is relevant and fades; the Actions button bobs only when something is new; the
  place card plays as a title on arrival, then folds into the top bar with today's weather glyph.
- **Map:** 10 blurred surfaces down to 3 (a solid semigloss header and place card); Give up moves into a ⋯ menu; the
  place card opens folded (name, today's weather, what's there) and unfolds for the 7-day forecast; + and − stay
  (pinch alone fails WCAG 2.5.1).
- **Sheets:** the screen under a sheet stops blurring.
- **Everywhere:** each screen shows only the currencies it uses (Moneys in a run, Research at the Lab, Scrap at the
  Workshop, DNA at the Gene Bank), with a wallet sheet for all; one-line hints; rarity and kind become frames and
  ribbons instead of captions; tap areas are whole plates and rows (tags are smaller than the 40 px rule).

## The bottom bar, rethought (UI-8b; the owner's brief 2026-10-27)
The owner, after the sampler: "I want you to rethink the bottom nav bar. I want the map to be bigger. Ask questions and
give me examples. Rarities for perks and stuff should also be clearly color codes." Four layouts were drawn at true
phone size on a real run screen with the real minimap (captured headless in Field Guide), standing and walking, beside
today's bar: a private artifact the owner holds, "Bottom Bar Options" (https://claude.ai/artifact/RnTqYhcn9KbPrThvY6uZ8A).
They were a bigger tile (today's layout, larger), a Pocket screen (a full-width 72 m map with four buttons under it),
a corner map (158 px at the top right, a slim bar of five buttons) and a pull-up map (a 150 px tile that opens a
half-screen 72 m map).

The owner's pick: **the bigger tile**; then, after a look at it: "The map should be bigger than the frame when it's big
and wider." Three takes on the standing tile followed on the same page (Wide 232 x 184, Wider 264 x 184, Big 240 x 220,
each with the minimap captured at its own size), and the owner picked **Wide**.
- Standing: the tile is 232 x 184 px (120 x 128 today), wider than tall, and stands about 60 px out of the bar's frame:
  the bar's outline loses its raised tower and runs straight under the tile, so the world shows on both sides of the
  tile's top. The cuts and the edge stay (the examples drew the edge gold; today it turns gold while the Map is open).
  Two buttons a side (Team, Guide; Bag, Perks or Lab), the icon over the word, in columns about 60 px wide.
- Walking: the tile shrinks to a 112 px square (72 today) in a 76 px bar; the buttons drop their words and sit side by
  side, as today.
- The map keeps 44 m from top to bottom and shows about 55 m across while standing (`minimap.span` stays 44, measured
  on the tile's shorter side).
- Room on screen (390 x 844, the home-bar strip counted): about 25% standing (20% today), 16% walking (11% today).
- Build:
  - pb-nav-bar's sizes in ui-run-kit.js: `--tile-w` 120 to 232 and `--tile-h` 128 to 184, `--bar-h` 120 to about 124,
    `--rise` (now the tile's overhang plus its 4 px top gap) 20 to about 64; compact `--tile-w` 72 to 112, `--tile-h`
    66 to about 108, `--bar-h` 60 to about 76, `--rise` 10 to about 36. Best as dials beside uiTheme.json's `minimap`
    group, so the Studio can tune them.
  - The outline (`navStep`) without the tower: a plain cut bar from `--rise` down, the tile over its top edge.
  - The side buttons stacked icon over word while standing; `--apart` (48 px) narrowed so each side keeps about 60 px;
    the tile's width capped on narrow phones (about 200 px on a 360 px phone); the 320 px container query (a 96 px
    tile today) rechecked.
  - minimap.js: the scale from the tile's shorter side (`s = min(W, H) / span`; today `W / span`), so 44 m stays top
    to bottom; the marks' size (`unit`, from the width today) checked at 232 px. It draws 5 times a second at its
    canvas size, about 2.8 times today's pixels.
  - shell.css `--nav-h` (172 to about 220 standing, 102 to about 144 compact), so the dialogue box, the hint, Actions,
    sticky rows, the map's controls, the d-pad and the debug button clear the tile.
- Not taken: the 176 px square (the first pick, before the owner's note), Wider (44 px buttons with small words), Big
  (29% of the screen); of the first four layouts, the Pocket screen (a third of the screen), the corner map (away from
  the thumb, a busier top) and the pull-up map (one more gesture).

UI-8b as built (2026-10-27, `track/ui`). The owner's answers at the start: the tile's edge turns gold only while the
Map is open (today's rule, not the examples' gold); narrow phones shrink the whole tile, keeping its shape.
- Dials: uiTheme.json `minimap` gains `tileW` 232, `tileH` 184 and `tileCompact` 112 (schema, the Studio's Minimap
  group, tokens.css), written as `--minimap-tile-w/-h/-compact` and `--minimap-tile-aspect` (h / w, for the shrink).
  The span dial is now "Metres shown", across the tile's shorter side.
- pb-nav-bar: the host is the container (`container-type` moved from `nav`), so the tile sizes from `100cqw`: standing
  `min(tileW, 100cqw - 136px)` wide and as tall as its shape allows, so a side keeps 60 px (4 px margin, 4 px gap);
  the bar 128 px, `--rise` the tile's height plus 8 px less the bar (60 px on a 390 px phone, never under 0). Walking:
  `min(tileCompact, 100cqw - 208px)` square in a 76 px bar. `navStep` keeps its name but lost the tower (6 points, not
  10). The 320 px container query went: the cqw rule covers it. Buttons stand icon over word, 63 x 52 px at 390.
- minimap.js: `S = min(W, H)`; `s = S / span`; the marks' `unit` and the facility icon's size from `S` too, so marks
  keep their size in metres (1.53x on screen standing; walking up to 1.56x, the unit floor of 1 holding at 1x).
- shell.css `--nav-h` worked out from the same tokens on the bar's width (`min(100vw - 16px, 480px)`): 224 px standing
  and 148 px walking on a 390 px phone (172 and 102 before).
- Measured in the game (fixture run, 390 x 844): the bar 374 x 192, the tile 232 x 184 at 4 px from the top of the bar
  box, 60 px over the frame; walking 112 x 112 in 116. At 360 px: 208 x 165 (rise 41); at 320 px: 168 x 133 (rise 13),
  walking 96 x 96. Side buttons 60-63 x 52 px at every width; no page errors.
- Corrections to the plan's numbers: today's compact tile is 72 x 66, not a 72 px square; the bar is 128 px, not about
  124, so the tile keeps a 4 px gap below as before; walking is a true 112 px square (rise 40), not 112 x 108.
- Left for the owner's phone check: the size, the compact timing, the marks at 232 px, the minimap's frame cost (its
  canvas is 2.8 times today's pixels standing), and whether 13 px of rise on a 320 px phone is enough.

## The run map's icons (UI-8c; the owner's note 2026-10-27)
The owner, after the bar: "I also want you to give the world map icons on the run more the style of all the others."
What the code does today:
- The run's places on the bowl are flat polygons in the theme's roles with a 1 px edge (run-marks.js `runMarkDraw`:
  UI-4's ten outlines, `RUN_MARK_TONES`), 18 px and 22 px where you stand, on a 3 px stalk 22 px tall
  (world-bowl.js `worldBowlRunPin`, `BOWL_PIN`). A place not yet seen prints "?" in the phone's font (700 10px
  system-ui); the names are canvas text in system-ui at 11 and 12 px. The kit's `<pb-node>` (ui-run-kit.js) draws the
  same outlines as SVG; no game screen uses it, only the Studio's UI gallery (UI-8c: the place card's corner shows
  `locationSubtitle`'s text, not a marker).
- The map's buttons are the old look: 34 px squares in `rgba(20,14,30,.78)` with a near-black ring (map-tab.css
  `.mbtn`), zoom as typed "+" and "−" (map-tab.js), and the look-around group (world-bowl.js) as typed ⟲ ◎ ⟳ at 28 px,
  under the 40 px tap rule.
- Every other icon is a 36 px pixel-art SVG in game/art/ui (51 of them: a rim in a darker tone of the same hue, a light
  top-left edge, a shaded bottom-right, a shared muted palette). The map's canvas is drawn at most twice the screen's
  pixels (world-bowl.js `worldMapSize`).

Examples: a private artifact the owner holds, "Run Map Icons" (https://claude.ai/artifact/KjBa67X4gcVLGynRjj79dL): the
run's map captured in the real game in Field Guide, light and dark, today and with a scratch painter put in through the
test hooks (`window.runMarkDraw`), plus a key of every place in every state. Two takes: Badges and Pins (every place a
map pin like art/ui/map.svg, coloured by family, the glyph on a cream face).

The owner's pick: **Badges**, with the buttons and the names, built right after UI-8b. Then the owner: "I meant
especially the map markers", and asked for UI-8c to start at once, beside UI-8b: the place markers come first; the
other marks the run's map draws (the gold ring where you stand, the picked place's ring, the destination dot) follow
them; whether the minimap's marks (trainers, wild Billies, you) follow too is asked in UI-8c's plan; the buttons and the
names come last. UI-8c runs on `claude/ui-8c-map-markers` (from this branch, a PR into `track/ui`), as WM-4b, WM-5 and
WM-7 ran beside their track's sessions.
- Each place keeps UI-4's outline as a bevelled pixel plate on the 36 grid, like the coin, clock and mint icons, in the
  icon set's own palette, one hue per colour family, with a glyph lit from the top left: the landing a blue octagon
  (an airship), a road a plain cream chevron (no glyph, so the special places stand out), a town a teal hexagon (a
  house), a shop a gold card (an awning), an event a violet card (a sparkle), a mini-boss a red notched diamond (a horned
  skull), the boss a red diamond (a skull), the rival a red shield (crossed swords), a scrapyard a grey cog (a nut), a
  place not yet seen a slate diamond with a pixel "?".
- States: seen; where you stand a gold rim two art pixels wide with a soft glow; done dimmed with a small green check;
  locked grey with a small padlock.
- Sizes: 28 px a place and 34 px where you stand (18 and 22 today). On the map's canvas (at most twice the screen's
  pixels) the 36 px art is sharpest at 18, 36 or 54 px; the phone check decides.
- The names in Jersey 15, the game's own font, instead of system-ui.
- The map's seven buttons as the kit's chips at 44 px with the set's icons: plus and minus to zoom, the footprints
  (walk) back to you, the list for places, back and back mirrored to turn, the globe for the whole bowl.
- Build: the ten place icons drawn as 36 px SVGs in the Studio's icon editor (art/ui, beside the others), so the owner
  can repaint them; `runMarkLook` names each place's icon; the pin painter in world-bowl.js draws the icon (rasterized
  once per size) in place of the flat shape, with the rim, the check and the padlock; run-marks.js stays logic only
  (its unit test); `<pb-node>` shows the same SVG; the label font and the look-around buttons in world-bowl.js; the
  buttons' markup in map-tab.js and their style in map-tab.css (the look-around group clears the place card, which it
  overlaps today).
- Not taken: Pins (one outline for every place, so places differ only by colour and the small glyph; the cream faces
  brighten a busy map).

Built (UI-8c, 2026-10-27, on `claude/ui-8c-map-markers`):
- The art: twelve 36 px SVGs in art/ui in the pixel format (svg-pixels.js), so the Studio's icon editor opens them:
  `node-landing`, `node-route`, `node-town`, `node-miniboss`, `node-boss`, `node-event`, `node-shop`, `node-rival`,
  `node-scrapyard`, `node-unknown`, and the badges `node-check` and `node-lock` (in the grid's bottom-right corner).
  Painted once from the examples' painter on `RUN_MARK_SHAPES`; the SVGs are the source now, for the owner to repaint.
- run-marks.js: `runMarkLook` gives `icon`, `badge` and `size` (`RUN_MARK_SIZES` 28 and 34); `runMarkPixels` makes a
  state's picture from an icon's pixels (the rim, faded, grey, the badge), `RUN_MARK_ART` its numbers and colours.
- The bowl (world-bowl.js): the run pin draws that picture, made once per icon, state and size at the canvas's own
  pixels, a gold glow where you stand, the flat shape until the icon loads; the head stands 4 px higher. The ground
  rings (where you stand, picked) take a dark rim under their colour; the trip's end is the set's flag. The names are
  in the theme's voice font (`--font-voice`, Jersey 15 in Field Guide) at 13 and 14 px.
- `<pb-node>` paints the same picture (the gallery shows every type and state).
- The seven buttons: `.mbtn.k-btn` at 44 px (the kit's button outline and edge line, the card's panel colour, no
  blur), with plus, minus, walk, list, back, back mirrored and globe; the look-around group is three chips of their own
  riding just above the place card (`--mapcard-h`, written by a ResizeObserver).
- The minimap's marks (trainers, wild Billies, you) stay as they are: at 5 to 8 px a plate with a rim and a glyph
  doesn't read; their shapes already carry the meaning (a diamond for danger, a round dot for wild, a chevron for you).
- Found: the run map never gives a place the `locked` state (world-bowl.js `worldBowlRunMark`: current, hidden,
  visited or seen), so the padlock shows only in the gallery for now.

## UI-15 as built (2026-10-27, `claude/ui-15-less-clutter`, PR #294 into main)
Run beside UI-11 and UI-8c (the owner's waves), the plan approved in advance. Battle and walk only; the battle engine
and its golden record untouched.
- **Measured:** `uiElementCount()` (theme-sheet.js, beside `uiBlurCount`): visible elements with words of their own,
  icons and pictures, shadow trees included, opacity not read. Smoke logs it per screen and holds each at
  `ELEMENT_CEILING` (check-quick.py). Before and after (smoke, 390 x 844): walk 27 to 14, battle 42 to 23, shop 73 to
  66 (the walk screen under it folds its card); map 25, team 28, guide 39, profile 55 unchanged. Walk's ceiling is 18
  (its hint shows for 6 s when a Billie wanders in).
- **The field strip** (battle.js `fieldStripUpdate`) replaces the ticker and the gold storm chip: the weather's glyph,
  the storm's bolt with turns left, sharp stones on each side (yours left, the foe's right). Stones show when their
  event plays or when the turn is over, never a turn early (the battle runs ahead of the playback). A tap shows the
  chip's words under the strip. Icons from the set (rain, snow, fog, ash, sun, moon, cloud, bolt; scrap for stones)
  until UI-13. An empty strip keeps its 28 px box, so the stage frames the action as under the ticker.
- **Plates:** name, level, HP with the trail, at most 3 tags (the status first, then the biggest stat changes) and
  "+N" with the rest's words. The limb pips, the party's dots, your HP number and XP stay. Found: a plate is a
  `<button>` disabled unless aimed at, so base.css faded it to 42% nearly all battle; fixed.
- **Move tiles:** the type's glyph (ui-kit `typeGlyphHTML`), name, power (with the weather's ▲/▼) and effectiveness.
  The type's word, the same-type ★, accuracy and the move's text are in a details panel over the tile grid: held
  420 ms on touch (the press then doesn't pick the move), on hover with a mouse, on keyboard focus.
- **Command buttons:** quiet chrome, an icon over a word, 52 px; the small lines (pyramids left, items, who can fight,
  why one is off) are each button's title and spoken name. The plan's "parts.css `.pb.green/.blue/.dark`" was wrong:
  the colours were battle-screen.css `.bt.coin/.items/.team` and battle-ui.css `.bt.run`.
- **Dark glass:** `.battle`'s `--bt-glass` / `--bt-ink` / `--bt-ink2` (the night tokens; UI-12 can point them at each
  palette's dark side) on the message, the menu, the plates, the turn bar, the strip and the details panel, in both
  themes; inside the cards the theme's text roles read the dark side. Found: by day the team, items and pyramid lists
  were white on the cream card. The plates' and turn bar's 6 px blurs went (ui-lint's blur rules 27 to 24).
- **Walk:** the place card plays as a title on arrival at a place or room (motion.css `m-title`, 4.5 s), then folds;
  the top bar keeps the name with today's weather glyph (not in rooms). The name unfolds the card, which then stays
  (`preferences.cardClosed` false) until × or the name. A room's Go outside moves to the foot row while folded. The
  hint shows on arrival or when more Billies hide than before, and fades after 6 s (`m-linger`). The Actions button
  bobs only while its sheet holds something not yet opened (a new place, a Billie that wandered in). `walkAfterRender`
  sets both animations to their age after each render, so a render never starts them over. Found: with the card gone
  the hero's `space-between` put Actions at the top; `.wh-foot` keeps to the bottom.
- **Gallery:** the battle and plates sections redrawn as the game draws them; their pictures remade, and the sections
  under them (moved by a fraction of a pixel).
- **Left for the owner's phone check:** the hold time (420 ms), the title's 4.5 s and the hint's 6 s, the glass's
  opacity (86%) by day, the details panel's place, Run's disabled look.

## UI-16a as built (2026-10-28, `claude/ui-16a-motion`, into main)
The plan approved in advance (the owner's standing instruction); the browser checks skipped until UI-18.
- **Levels:** logic/motion.js `motionLevelOf(pref, phoneReduces)`: Device is Full unless the phone asks for reduced
  motion; Full, Calm and Reduced win over the phone. `<html data-motion>` holds full, calm or reduced; ui-kit
  `motionNow()` and `reduced()` read it (the phone only where no level is written). Shadow roots read two inherited
  tokens instead of `:host-context`: `--m-k` (1, 0 under Reduced: multiply a move's time) and `--m-loop` (running,
  paused under Calm and Reduced: an idle loop's play state). Calm drops the idle loops (m-idle, the dialogue bubble's
  drift, the battle camera's sway, Fight's glow, the title coin, the bloom); loops that say something stay. The
  debug log's preferences carry `motion` and `motionLevel`.
- **Timings (checked):** press 100 ms down, 120 back (spring); enter 240 with 35 ms stagger, rows past the 4th
  together (last in at 380); slow 420 to 380 (sheets, flips: inside 400); exit 180 (toasts); pop 150; float 600
  after the pop (was one 1100 ms move); tick-ups 400-700 by the size of the change (pb-coin was 840 ms, the top bar
  700 flat). uiTheme.json motion `press`, `exit`, `pop`, `float` are new dials; motion.test.mjs keeps them inside.
- **Wired:** press (ui-motion.js: every button, tab, radio, kit part and tappable card squashes on the `scale`
  property, so a control's own transform stays; 23 CSS `:active` scale() rules and pb-button's went); enter (a new
  tab's rows and a new sheet's rows, `pbEnterRows`); sheet (a phone's bottom sheet slides up with the spring, the
  centred dialog keeps the wipe; the same sheet redrawn stays still: it used to replay on every pick-card tap);
  nudge (a press on a disabled control, `pbNudge` for refusals with the can't buzz); done (a Quest done toast draws
  its check); flip (the reward and Perk picks deal face down the first time an offer shows, then turn over a beat
  apart; `dealt` lets a tap turn and pick at once).
- **Feedback:** the selection bar slides (a ghost of the slanted bar, from the old tab, segment or bottom-bar tab to
  the new); tick-ups in the family's colour with a pop and the count sound (pb-coin, so pb-chip, and the top bar);
  gains fly (`pbFlyTo`: a reward item and a purchase to the Bag tab, a Perk to Perks, money right after a press to
  the Moneys chip) and the target bumps.
- **Sounds:** music.json ui `sheet`, `flip`, `count`, `toast` (placeholders), played by sound.js's `uiSound` from
  ui-motion.js (the kit's `pb-sound` event) and overlay.js; sound.js unchanged.
- **Walking:** five endless loops to one: `.enc.gp`'s sheen and `.slot`'s breathe were dead (removed), the egg's wob
  is the Ranch's, the rustle plays three times on a hidden card's first showing; the Actions bob stays (only while
  something is new).
- **For UI-16b and UI-17:** `--m-k`, `--m-loop`, `motionNow()`, `pbSound`, `pbBump`, `pbFlyTo`, `pbSlideBar`,
  `pbDoneHTML`/`pbDrawDone`, the motion tokens; the low-HP pulse's filter and the evolution flashes are left to them.
## UI-18 as built (2026-10-28, `claude/ui-18-map-clutter`, a draft PR into main)
Run with the plan approved in advance; the browser checks wait until the UI plan is done (the owner's word).
- **The blur count, checked:** the "10" was right on 2026-10-26 (check-quick.py's `BLUR_CEILING`): the header, the place
  card, the look-around group's glass panel and seven `.mbtn` buttons. UI-8c had already taken the buttons' and the
  panel's blurs off, leaving 2 that smoke counts. `uiBlurCount` (theme-sheet.js) counts page elements only, not
  pseudo-elements or shadow trees, so it never saw the top bar's glass (`.topbar.glass::before`) or the bottom bar's
  (pb-nav-bar's `.glass`). Real blurred surfaces on the Map: 4 before (5 with the places list open), **2 now** (the
  top bar and the bottom bar). Smoke's count for the map: **0** (it was 2); `BLUR_CEILING`'s map entry is gone, so the
  budget of 3 applies.
- **Solid semigloss:** the header, the place card and the places list are the surface colour with its sheen (a Team
  card's gradient on `--g-solid`), no `.glass`/`.px`.
- **Give up in ⋯:** the header's row holds the day chip and a 44 px ⋯ chip (a `<details>`, the new `more` icon in
  the list icon's greys); opened, it shows Give up the run as a red button in the header's flow (the header is clipped
  to its outline, so a popover can't hang out of it).
- **The folded place card:** the name, today's weather (a run place's forecast, first day), the kind chip, one line of
  what's there (shops, a clinic, trainers, how many kinds of Billie), the status and the main action. More (40 px)
  unfolds the place's words, zone, rumour, the 7-day forecast, its Billies, roads and services. `uiState.mapCardOpen`
  keeps the one unfolded place; every other place's card opens folded. + and − stay.
- **One colour everywhere (UI-14b's leftovers):** the hub map's towns teal (they were orange `#ffb46b`), where you
  stand value gold, plain places the road badge's cream, locked the list icon's grey; the run's flat markers (before
  an icon loads) take their family (`runMarkLook`'s tone; `RUN_MARK_TONES` gone).
- **WM-6's find:** the names are drawn after your figure (`worldBowlNames`), and a name that would touch the figure
  rises clear of its head.

## Sessions (Part 2; each starts on `track/ui` after #266 merges)

| # | Session | Does | Visible change | Done when |
| --- | --- | --- | --- | --- |
| UI-10 (done 2026-10-27) | Plan and sampler | this part; the sampler and the bar examples (artifacts); the owner's answers | none | the owner's answers written here |
| UI-8b (done 2026-10-27, `track/ui`) | The wide map tile | the bar's sizes as dials (232 x 184 standing, out of the frame; the 112 px square walking), the outline without the tower, the side buttons stacked, the minimap's scale from the shorter side, `--nav-h`, narrow phones and the 320 px query; small and on its own, so first | the bar | gallery run-hud pictures and the fast check's bar step remade on purpose; tap targets; the owner's phone check (size, compact timing, the marks at 232 px, frame cost) |
| UI-8c (built 2026-10-27, `claude/ui-8c-map-markers`) | The run map's icons | the ten place icons drawn as 36 px SVGs in the Studio's icon editor (Badges: UI-4's outlines as pixel plates, a glyph each, the icon set's palette by family); the bowl's pin painter (28 px, 34 px where you stand; the gold rim, the check, the padlock, the pixel "?"); `<pb-node>` the same; the names in Jersey 15; the map's seven buttons as 44 px chips with the set's icons | the run's map | run-marks and ui-icons tests; the gallery's pb-node pictures and the fast check's map step remade on purpose; tap targets; the owner's phone check (sizes, sharpness at 28 px, the art) |
| UI-11 (done 2026-10-27) | Colour code as data | `signals` in uiTheme.json (schema, types, check), `--sig-*` tokens, a Studio "Colour code" dial group with a colour-blind preview; checks: contrast and per-screen distance with the types; danger = the red family | none (data and the Studio) | check:data and the Studio check step pass; a planted clash fails the distance check |
| UI-12 (built 2026-10-27; checks after UI-18) | The palettes | Field Guide as `defaults` (every role); Copper Grove+ and Bureau Night as presets players pick in a Settings Palette row (Display tab; `preferences.palette`, applied with `applyUiTheme(theme, preset)`, in the debug log); Brass & Plum and Sunpunk Day as Studio presets; the 32 purple literals and the three XP blues; reduced transparency; the minimap's ground per palette | the palette | gallery and quick-check pictures remade once for Field Guide; a smoke step switches the three palettes (contrast check, no page errors); the owner's phone check |
| UI-13 (done 2026-10-27) | Glyphs and types | tinted glyphs for the new marks (masks of the SVGs, drawn in the Studio's icon editor): statuses, short effects, kinds, families; the bolt only for storms (Sandstorm and paralysis get their own); HP's heart icon teal, like its bar; types at one lightness, used by tiles, plates and the Guide (the 3D rings checked) | glyphs, type colours | ui-icons test and the gallery updated; contrast check green |
| UI-14a (built 2026-10-27; checks after UI-18) | Marks kit | `pb-tag`, `pb-chip` (on `pb-coin`'s API, ON-3 builds on it), `pb-proc` (the blip), `pb-info` (the explainer), rarity as frame, pill and name colour on `pb-pick-card` and on list rows; every state in the gallery | gallery only | gallery pictures; smoke |
| UI-14b (built 2026-10-27, `claude/ui-14b-marks-screens`; checks after UI-18; the battle plates went to UI-16b) | Marks on every screen | one screen per commit: Team, the Billie sheet, the build tab, battle plates, shop, reward pick, Perks, Bag, map nodes (run-marks.js), payout; Atk/Def/SpA/SpD/Spe; towns, Alpha and Lead one colour everywhere; rarity on held items, Augments and Genes (a `rarity` field in items.json, robots.json's unused `rar` made real, genes.json; the tiers the owner's call) and on Billie cards | tags, marks, rarity | each screen's UI test; check:data; the owner's phone check |
| UI-15 (done 2026-10-27, `claude/ui-15-less-clutter`) | Less clutter: battle and walk | the field strip, plates' "+N", long-press details, quiet command buttons; the hint, the Actions bob, the place card | battle and walk | element counts down per screen (logged by smoke); fast check green |
| UI-16a (built 2026-10-28, `claude/ui-16a-motion`; checks after UI-18) | Alive: feedback | the motions wired everywhere, fly-to, tick-ups, the new sounds, Animation Calm, no `:host-context`, the five walk loops down to two | motion | frame check on the Graphics bench; reduced motion seen in every motion |
| UI-16b | Alive: battle events | UI-14b's leftovers first (UI-15 had not finished): the plates' tag row on `markRow` and `pb-tag` (Atk..Spe on the stage chips, battle.js `statShortName`), the statuses as tags on the plates, Alpha one colour (the bad family; battle-screen.css's turn bar has it gold, its plate crimson); then the stamp, blips, effect pips, banners; with VFX-5/6 (smears under Calm) and RL-14b (shield phases, the stage intro) | battle motion | the battle golden record untouched (or remade alone, end states equal) |
| UI-17 | Alive: idle life and big moments | glints, breathing nodes, the Coat's foil, the live forecast icon, the boss banner, catch and level-up bursts; Flashes for glints and foil; the loop budget | idle motion | the owner's phone check of feel and frame rate |
| UI-18 (done 2026-10-28, `claude/ui-18-map-clutter`) | Less clutter: the Map | after WM-4b (#267) and WM-6, which own world-bowl.js: blur 10 to 3, Give up in ⋯, the folded place card | the Map | smoke's blur count for the map at 3 |

About 13 sessions in all, plus the owner's phone checks after UI-8b, UI-8c, UI-12, UI-14b, UI-15 and UI-17. Tags `ui-10-done`
and on.

How the sessions run (the owner, 2026-10-27: "Start each next step of the ui plan in a new session and automatically
approve the plans. The choices are made and I want it done."): the planning session starts each step in a new session
on `track/ui` when the one before has pushed its HANDOFF entry. A step writes its plan and goes on without waiting for
approval; where it meets an open choice or an "Ask me before" item it takes the recommended option and lists it in its
HANDOFF entry under "Decided for the owner, to review"; the phone checks are listed, not waited for. Each step tells
the planning session it is done with a one-shot scheduled task, and an hourly check covers a missed one. Merges to
main stay the owner's (the PR from `track/ui`).

The owner, 2026-10-27, after UI-11: "Automatically start the next session after done, skip the checks until after
all ui is done." So each step, when its HANDOFF entry is pushed, starts the next step itself in a new session (from
its own branch, since main may not hold it yet), with these same rules. Until UI-18 is done the browser checks
(check-fast, check-quick, the Studio check, the gallery, the picture baselines) and the phone checks are skipped;
the seconds-long ones (lint, typecheck, unit tests, check:data, check:modules) still run, as the edit hook runs them
anyway. After UI-18, one session runs every skipped check and fixes what they find.

## UI-11: the colour code as data (the plan, 2026-10-27)
Built on the session's own branch (a cloud session pushes only there), from main, which already holds `track/ui`;
its PR goes to main, as UI-10's did (a PR into `track/ui` would carry main's 220 newer commits with it).
- **Data:** `defaults.signals` in uiTheme.json, so the Studio's dials, ↺, Find and Connections work on it as on every
  other group: `fill.<id>` (tags, chips, bars on dark glass, dark text on them) and `light.<id>` / `dark.<id>` (the
  text shades). Ids: the eight families (good, bad, caution, value, special, growth, machine, bio), the three statuses
  (brn, par, slp) and the four rarity tiers (common, uncommon, rare, mythical), with the hexes in the tables above.
  Neutral is the palette's greys and the types stay in types.json (UI-13 retunes them), so neither is here.
- **The same in every palette:** a preset or a screen's override can't set `signals` (the schema for overrides; the
  check and the Studio's Save as preset for presets).
- **Tokens:** `--sig-<id>` (the fill, both sides) and `--sig-<id>-text` (the side's shade), written by the theme sheet
  and in tokens.css as the fallback for a page without the data. Nothing reads them yet: no visible change.
- **Danger is the red family:** a palette that leaves `danger` out gets the red family's text shade for its side. The
  defaults keep today's `danger` for now (no visible change); UI-12's palettes drop it.
- **Checks** (logic/signals.js; check-data and the Studio's Check share them): each text shade reads at 4.5:1 on its
  side's surface and 3:1 on its ground, in the defaults, every preset and every screen's colours; dark text (the dark
  side's ground) on every fill at 4.5:1; within each screen's set the fills, the types included, at least OKLab 5
  apart (the nearest today: amber and Electric, 5.5). The sets: battle (good, bad, caution, special, growth, the three
  statuses, the types), pickups (the eight families and the types), map (the eight families), rarity (the four
  tiers, on their own: common sits by Machine's gunmetal on purpose, and the pill names the tier).
- **The Studio:** a "Colour code" group (the whole game only): a row each, the fill and both text shades, each shade
  with its contrast badge; a colour-blind preview (none, protan, deutan, tritan; Machado 2009 at full strength) that
  shows every screen's set as swatches and its nearest pair.
- **Tests:** unit tests for the data, the sheet, the fallback, the checks (a planted clash fails); the Studio check's
  `ui` step changes a fill and sees it in the preview, plants a clash for the Check, then undoes.

## UI-12: the palettes (the plan, 2026-10-27)
Built on the session's own branch `claude/ui-12-palettes`, from UI-11's (`ccr-dab4e0cd-6re1eb`, PR #280 not merged
yet); its PR goes to main and carries UI-11's commits until #280 merges. No Plan Mode, no browser checks (the
owner's rules above).
- **Field Guide is `defaults`:** every role of the table above, light and dark; `line` the text at 18% (light) and
  white at 14% (dark); `danger` and the HP colours left out, so they come from the colour code (`paletteFor`: danger
  and hpLow from bad, hpMid from caution, hpOk from good; each side's text shade, as the table says for bars on light
  and dark screens). `defaults.name` "Field Guide".
- **Presets:** `copper_grove` (Copper Grove+) and `bureau_night` with `player: true` (a new look field: offered in
  Settings); `brass_plum` and `sunpunk_day` for the Studio only. Each sets every role but danger and HP. alpha05 and
  stepped stay.
- **Settings:** a Palette row at the top of the Display tab (Field Guide, Copper Grove+, Bureau Night, read from the
  data); `preferences.palette` (a preset id; none is the defaults); `applyPreferences` re-applies the theme sheet with
  it (theme-sheet.js `setUiPalette`), and so do the Studio's live draft and the fixtures. The debug log's state gets
  `palette` and the resolved `side` (light or dark), never save data.
- **The minimap's ground per palette:** two new optional roles, `mapGrass` and `mapWater` (UI_ROLES, the schema,
  tokens.css's fallback, a Studio dial), which minimap.js mixes into the surface instead of primary and the HP teal;
  without them it falls back as today. Bureau Night's cyan primary would otherwise paint blue grass.
- **The literals:** the alpha 0.5 purple `rgba(46, 33, 64, a)` shadows and tints become `--c-shadow` mixes; dark text
  on gold (`#2e2140`) becomes a new `--c-ink` (the dark side's ground, the colour code's "dark text"); `.pb.dark`'s
  purple gradient becomes ink. The three XP blues become the Growth family: `--sig-growth-text` on the theme's
  screens, `--sig-growth` on the always-dark battle plate.
- **Reduced transparency:** `prefers-reduced-transparency: reduce` makes the glass solid and drops its blur, as High
  contrast does (base.css).
- **Checks:** a preset with `player: true` is checked in full, like the defaults (contrast and the colour code on
  ground and surface, dark text on fills); the Studio-only presets as before. Unit tests for the data, the fallbacks,
  the Settings row and the preference.
- **Skipped for now (the owner's rule):** the gallery and quick-check pictures, the smoke step that opens the three
  palettes, the phone check. Listed in HANDOFF for the session after UI-18.

## Fits with other tracks
- UI-9b (#266, `track/ui`) goes first: it deletes parts.css into base.css, lowers the lint's ceilings (radius 0, space
  39), and edits this file, ROADMAP, BRANCHES and HANDOFF; whichever of the two PRs merges second takes a small merge.
- UI-8c touches world-bowl.js lightly (the run pin's painter, the label font, the look-around buttons), which the
  world map track also edits (WM-4b, #267, on `track/worldmap`; WM-6): keep those edits small and merge main first.
- VFX-4 (#257, #268) owns crits' impact frame; VFX-5 and VFX-6 work in battle-stage.js and need a rule for Calm.
- RL-14b (#264) adds boss shield phases and a stage intro: the boss banner and the shield pip are shared with it.
- ON-3 (#255) builds the Showcase on the kit: `pb-coin`'s API stays as it is.
- WM-4b (#267) and WM-6 own world-bowl.js: UI-18 comes after them.

## Risks
- Phone frame cost: masks, more animations and blur. Measure on the Graphics bench; transform and opacity only.
- Safari: `-webkit-mask` beside `mask`; a `filter` on a masked element runs before the mask; animate a wrapper.
- The ui-lint ratchet after #266 (radius 0, space 39): tags and chips use tokens or 1-2 px hairlines; new timings use
  the motion tokens.
- i18n: the 3-letter codes, kinds and new settings need rows; text in a shadow tree goes through `i18nText`.
- Any look change turns the picture baselines red: remake them once, in UI-12, and say so in the commit.
- Retuned type colours reach battle's 3D rings and effects (battle-stage.js uses types.json): check them in UI-13.
- Three player palettes triple what a look change can break: the gallery's pictures run on the default, and a smoke
  step opens every screen in the other two (contrast, no page errors).

## The owner's answers (2026-10-27, after the sampler)
1. **Palette:** Field Guide by default; Field Guide, Copper Grove+ and Bureau Night offered in a Settings Palette row;
   Brass & Plum and Sunpunk Day kept as Studio presets only.
2. **Status marks:** angled tags with a glyph and a 3-letter code (BRN, PAR, SLP).
3. **The family table:** as proposed (Perks violet, Research sky, held items teal, Scrap and Augments gunmetal, DNA and
   Genes magenta, Crests red with bosses, Beans neutral).
4. **Tinted glyphs:** yes, for the new marks only; object icons keep their fixed colours.
5. **Types at one lightness:** yes, retune types.json.
6. **Battle:** all four: quiet command buttons; a field strip instead of the ticker; every floating battle part in the
   palette's dark glass, in both themes; move details on long-press.
7. **Icon fixes:** yes: the bolt only for storms (Sandstorm and paralysis get their own glyphs); HP's heart icon teal.
8. **Motion:** Full by default (through Device, which still honours the phone's reduced motion); Calm added. **Follow
   the sky:** no.
9. **Rarity:** the loot colour ladder (not metal frames), shown as frame and pill (after the bar examples): common
   grey, uncommon green, rare blue, mythical orange (not purple); on Perks, held items, Augments, Genes and Billie
   cards.
10. **New UI sounds:** yes (a sheet opening, a card flip, a count-up's end, a toast).
11. **Colour shapes switch:** yes, in Accessibility.
12. **The bottom bar (after the bar examples):** the bigger tile; then, after the owner's note ("The map should be
    bigger than the frame when it's big and wider"), **Wide**: 232 x 184 px standing, out of the bar's frame, and the
    112 px square walking.
13. **The map's area:** 44 m from top to bottom, drawn bigger (about 55 m across while standing).
14. **Walking:** the bar shrinks a little (labels off, the tile at 112 px).
15. **The run map's places (after the map examples):** Badges: UI-4's outlines as pixel plates with a glyph each, in
    the icon set's palette by colour family.
16. **The map's buttons and names:** both: the kit's 44 px chips with the set's icons, and the names in the game's font.
17. **When:** UI-8c, started at once beside UI-8b at the owner's word (its own branch, a PR into `track/ui`); the map
    markers first ("I meant especially the map markers").

## Ask me before
- Any change to the answers above (palettes, statuses, families, types, battle layout, rarity, motion defaults).
- The exact hexes of the retuned types and the rarity ladder if the phone shows them differently from the sampler.
- A fourth player palette, or dropping one of the three.
- The tier of each held item, Augment and Gene (proposed by price and effect size).
- The final art of the ten place icons (the examples' glyphs are a first pass, for the owner to repaint in the Studio).

## Research (UI-10; sources)
- Status colours: Pokémon Showdown's battle CSS (BRN #EE5533, PSN #A4009A, PAR #9AA400, SLP #AA77AA, FRZ #009AA4;
  3-letter pills), Bulbapedia (paralysis), Smogon. Intents: Slay the Spire wiki (7 attack tiers by size).
- Rarity and identity: Hades (rarity on the frame, the god on the symbol), Balatro wiki (joker rarity, editions as
  shaders, seals), Marvel Snap (rarity as escalating effects), Game Informer on the loot colour ladder.
- Colour blindness: Game Accessibility Guidelines ("no essential information by colour alone"), Xbox Accessibility
  Guideline 103, Okabe-Ito and IBM palettes, Chrome's `prefers-reduced-transparency`; Machado, Oliveira and Fernandes
  (2009) for the simulation matrices.
- Motion: NN/g on animation duration, "Juice it or lose it" (Jonasson, Purho), "The art of screenshake" (Nijman),
  Sakurai on hit-stop, Game Developer on juice; MDN on `navigator.vibrate` (no iOS Safari).
- Layout and touch: Hoober's thumb study (UXmatters), Slay the Spire and Balatro mobile reviews, Pokémon Scarlet and
  Violet UI notes.
- Palettes: Evil Martians on OKLCH, Lospec (Patina, Verdigris, Hidden Library), solarpunk art direction notes.

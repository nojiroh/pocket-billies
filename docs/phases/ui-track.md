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
| UI-6b | Lint down, blur and accessibility | raw values that equal a token become the token (no change on screen); the blur budget enforced per screen; the accessibility pass (tap targets, contrast, focus, labels); then `phase-06-done` and `ui-6-done` | the accessibility fixes | ui-lint ceilings lowered; full quick check green apart from known reds |
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

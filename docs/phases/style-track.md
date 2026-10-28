# Style track: the Bureau's look, numbers you feel, foil Billies

Branch: track/style

The owner's brief (2026-10-27), after the VFX track: "What are other things I should add to the game that adds to the
style? Do research online." Of the eight ideas found, the owner picked three to expand ("Make sure they fit in with
the current game") and then "Make this a plan for the game":
- **The Bureau's look:** its own paperwork style (stamps, case files, a notice, ID plates), seen only where the Bureau
  is.
- **Numbers you feel:** battle numbers that roll and grow with the hit, beyond what the UI track already plans.
- **Foil Billies:** a sheen on the Billie itself, in battle and on the maps.

SY-0 (this file) was written on `ccr-86dc9cb1-odx2za` because `track/style` doesn't exist yet. Later sessions start on
`track/style`, which the owner makes from main or from that branch.

## The owner's answers (2026-10-27)
- Emblem: a bean on a lost-property tag (SY-3 draws it; the owner may repaint it in the Studio).
- Laminated (SY-9): not now. Foil means "has a coat"; revisit after SY-6 ships.
- The coat's foil shows in battle too, not only on the maps and in menus.
- Stamp words: the placeholders (RETRIEVED, VOID, DENIED, PENDING, FILED), editable later in factions.json.

## What the game has (checked in the code, 2026-10-27; verify)

### The Bureau
- Named by the owner (2026-10-23): the Bureau of Lost, Found and Beans, "a secret bureaucratic agency"; nothing from
  Control or the SCP Foundation (reflavour-track.md 25-28, 79-83). Internal id `bureau` (NAMING.md 72, 77).
- Content exists: factions.json `bureau` (six bots: Courier, Repossession, Shredder, Stamp Press, Filing Drone, Audit
  Unit); events.json trainer classes `bureau_clerk` (48) and `bureau_reclaimer` (57) and about eight Bureau events
  (the checkpoint 295, the field lab 491, the recall drone 532, ...); bosses.json's Retrieval Unit (its `call` and
  `join` lines, `glow #FF5A7A`, the win line "Retrieval suspended. Claim filed as pending."); banter.json `who:"bureau"`
  (416-430); lore.json (323: "a Bureau pamphlet, form 7B attached"); setPieces.json 120-140 (signposts, the
  checkpoint); scenery.json `bureau_barrier` and `bureau_crate`; arenas.json 90 (the scrap ring).
- **Missing:** no logo or emblem (HANDOFF: "no Bureau prop or logo"); no leader or face (HANDOFF: "no Bureau leader
  yet"); Bureau events use the plain event sheet (encounter-screen.js `encSheet` 116, `encounterStage` 294); the boss
  intro is the `call`/`join` text, a glow and the join animation (battle-stage.js 1808-1815, battle-engine.js 1309);
  bot plates are generic steel (battle.js 1193, base.css 1175 and 1507), flagged for contrast in the UI track.
- **Planned elsewhere:** the Bureau's costumes, "beige-grey suits, lanyards and ID cards, clipboards, red tape and bean
  pins", clerks that "shuffle stiffly" (characters-track.md 30, 172-175); "the Bureau's look" is an open question
  there (245). "Bureau Night" is a player palette for the whole UI (ui-track.md 490), not the Bureau's branding.

### Battle numbers and money
- Damage numbers exist: `hudPop`/`hudHit` (battle.js 566-586) float "−N" at the target, coloured for super effective,
  crit and not very effective, then a tag ("Critical hit", "Super effective"). Sizes by kind, not by amount: 28 px,
  34 px super effective, 36 px crit (battle-screen.css 10-60, 246-250).
- HP plates: the fill moves in .38 s; a red `.ghost` trail follows after .45 s (battle.js 1161-1184,
  battle-screen.css 1034-1038). Your side shows `hp/max`, which **jumps**; a foe shows % only for bosses (battle.js
  1202).
- Hit feel already scales: `hitWeight` (battle-stage.js 1552) is damage / max HP; `hitFx` (1562-1600) sets shake
  `1.4 + w*6`, hit-stop `20 + w*70` ms, a punch above w .45. Super effective and crits have their own sets.
- **Found:** `battleStageFlash` (battle-stage.js 577) ignores both the Flashes setting and Reduced motion. Flashes only
  sets `data-flash` on the root (settings-screen.js 124), and only the evolution and hatch CSS reads it
  (battle-screen.css 1263-1264). With Flashes off a player still gets full-screen white and gold flashes.
- Payout already slams rows in and counts up with a rising jingle (run-payout.js 69-90, `pb-payout`, `pb-coin`). Wild
  prize money is only a toast (battle.js 1011).
- **The UI track already owns** (ui-track.md "Alive, without clutter", sessions UI-16a, UI-16b, UI-17): numbers that
  tick with a pop, gains flying to their counter (coins to Moneys), the pick card's flip, sounds for a flip and a
  count-up's end, trigger blips by the plates ("Kindling ▲Atk"), status tags that stamp on, effectiveness banners,
  hit-stop only on crits, KOs and super-effective hits, the boss's name banner (shared with RL-14b). **This track
  doesn't build any of those;** it builds on them.

### Billie finishes
- Coats are palette recolours, done (coats.json, logic/coats.js); the owner dropped the old Golden shiny
  (studio-track.md 27, 204-211). No coat has `odds` yet, so none rolls at random.
- Prime (all five native parts at M, rules.js 526) shows as a tag; the UI track makes it a teal ★ (ui-track.md).
- **The UI track gives Coats a prism foil** in menus ("Coats get a prism foil"; UI-17: "Coats shimmer (a moving
  sheen layer, transform only)"; "Flashes also governs glints and foil"). That is DOM only.
- Billies are recoloured on the CPU (skeleton-rig.js 496-552, `coatAtlas`) and drawn in battle and on the maps by the
  walk sprite shader (walk/walk-shaders.js 181-211, instanced 511-554; uniforms set in walk/sprites.js 389-391).
  It already has `uEmit`, `uRim`, `uFade` (Bayer) and LOOK_GLSL's `uHsv`; nothing for a sheen.
- The Showcase sends the coat (logic/showcase.js 158-187); trades will copy it (online-legal.js 61-106, 158-161).

## The research, in short
- **Bureaucracy you can feel:** Papers, Please makes its satire land through the stamp itself, repeated until it is
  routine (PopMatters; Tampere University's Weber reading). Control's Bureau reads through brutalist concrete and
  Swiss office typefaces (Fonts in Use; Game Informer). We take the first idea (paper, stamps, forms) and leave the
  second: the Bureau here is beige-grey office comedy, not concrete.
- **Numbers:** Balatro stacks its channels (number, shake, particles, sound) on every scoring moment and scales the
  shake with the score; you always see *what* caused a number. Neverwinter's developers shrank damage numbers but
  kept them growing on bigger hits, one number per action. A 2025 thesis on action-roguelites names celebration that
  hides danger as a common failure. Earthbound's rolling HP meter is the classic "the number counts down" moment.
- **Foil:** Balatro's foil (as ported to Godot, CC0) shifts the colour channels by a few sine terms of time and
  distance, weighted by each pixel's saturation; holo cards blend a gradient into the darker pixels and add emission.
- Not taken: a third font for the Bureau (Jersey 15 and Oxanium cover it); damage numbers that pile up (one per
  action); random shiny rolls (the owner dropped Golden).

## How it fits the game
- **Calm chrome, loud meaning** (the UI track's rule 1): the Bureau's paperwork shows only where the Bureau is: its
  events, its bots, its boss, its props. Everywhere else stays as it is.
- **One meaning, one colour** (rule 2): the Bureau is the enemy, so its stamp ink is the **red family**
  (#EA5974, text shades #BD2C42 / #FF8A9F), which already means bosses and danger and sits beside the Retrieval
  Unit's #FF5A7A glow. No new colour. Paper is the palette's own surface, so it works in Field Guide, Copper Grove+
  and Bureau Night, light and dark.
- **Never colour alone** (rule 3): every stamp is a word plus a shape (the stamp's border), never just red.
- **Data, not code** (the roguelite track's modular rule): the Bureau's emblem, stamp words and form numbers live in
  factions.json `bureau.look`; a later faction can bring its own.
- **Stepped, not smooth** (the VFX track's rules): the foil sweeps in steps on the 24 fps grid with a dithered edge,
  using the Billie's own colours brightened. No soft gradients on the sprites.
- **Settings:** stamps, rolls and foil follow Animation (Full / Calm / Reduced) and Flashes. Under Reduced, stamps
  appear without the slam, numbers set at once, foil is off. Flashes off turns the foil off.
- **No longer battles:** nothing here adds time a player must wait through. The Notice of Retrieval plays during the
  join intro's own 900 ms, and a tap skips it, as a tap skips the join.
- **Not here:** the Bureau's people (the characters track), its leader and story (the story sessions), sounds beyond a
  stamp's thunk (the sound track's mix).

## Sessions
- **SY-0** the plan (this file), ROADMAP, BRANCHES, HANDOFF. Docs only.
- **SY-1** flashes that obey the settings. Done 2026-10-27 on `ccr-86dc9cb1-odx2za` at the owner's word (built as
  below, except the plan's "drops white to the palette's surface": a bright flash keeps its colour and is held to 15%;
  a dark one, a faint's deep red, stays; the rule is `flashFor` in logic/smear.js). `battleStageFlash` reads Flashes and Reduced motion: Flashes off caps a
  flash at 15% and drops white to the palette's surface; Reduced shows no flash. The same rule for the impact frame's
  check (VFX-4) and the coat foil (SY-6). A unit test per setting. Small and on its own, so first: it is an
  accessibility fix.
- **SY-2** numbers you feel, the battle part the UI track doesn't own. Done 2026-10-27 on `track/style` (built as
  below in today's `hudPop` and plates, since UI-16a/b aren't built; logic/hit-numbers.js `popSize`, `rollValue`; the
  status-damage pop is sized too; the KO's "short beat" adds no time: the faint already waits for its own event).
  - **Your HP rolls.** Your plate's `hp/max` counts down over the fill's .38 s instead of jumping (display only: the
    battle engine and its golden record don't change). A foe's boss % rolls the same way.
  - **Sized by the hit.** The pop's size comes from `hitWeight`: 24 px at a scratch to 40 px at a one-shot, then the
    kind's colour on top. A crit's number is still the crit's colour (VFX-4 owns its impact frame).
  - **KO weight.** A KO's pop gets the largest size and a short beat before the faint (hit-stop on KOs is the UI
    track's rule, UI-16b; this only sizes the number).
  - Builds on UI-16a's tick-up and UI-16b's pops; runs after them, or lands its sizes in their component if they come
    later.
- **SY-3** the Bureau's mark, as data and kit. Done 2026-10-28 on `track/style` (built as below; the emblem is
  art/ui/bureau.svg; the stamp words are keyed by moment, `look.stamps.retrieved` ...; the ink is today's `--redink`,
  since the red family's hexes are UI-11's, not built; the stamp motion is pb-stamp's own, since UI-16b isn't built; the
  thunk is music.json `ui.sounds.stamp`; "every palette" is the gallery's three looks, since Field Guide, Copper Grove+
  and Bureau Night are UI-12's):
  - The emblem: a bean on a lost-property tag, with a string hole (the owner's pick), drawn as SVG in the Studio's
    icon editor.
  - `bureau.look` in factions.json (schema, types, data check): `emblem`, `stamps` (the words: RETRIEVED, DENIED,
    PENDING, FILED, VOID; the owner's to edit), `forms` (form numbers for events: "Form 7B", ...).
  - `pb-stamp`: a word in a rough red border, slammed on at a small slant with UI-16b's stamp motion, a thunk (a
    placeholder sound in the sound track's set). In the gallery in every palette.
- **SY-4** case files. Done 2026-10-28 on `track/style` (built as below; events.json `bureau: 1` on nine events, `redact`
  words, `form` where the intro names its form, an option's `stamp`; logic/case-file.js; `pb-typed`; css/case-file.css.
  The Bureau set piece needs no code: its event, the checkpoint, is marked. The bars lift when you choose: the intro
  stays on file above the script's lines, its bars lifted. Unless an option names its stamp, the last option, the one
  that walks away, is DENIED and any other is FILED):
  Bureau events (`bureau: 1`, or an event in a Bureau set piece) open in a manila-folder sheet:
  the form number, the emblem, the body typed in line by line (Oxanium, 20 ms a letter, a tap shows it all).
  **Redaction bars** cover flavour words only and lift when you choose; costs and outcomes are never hidden (verify in
  `encChoose` what each choice shows today). The event's result is stamped (FILED, DENIED).
- **SY-5** the Bureau in battle. Done 2026-10-28 on `track/style` (built as below, with UI-16a/b merged in for their
  plates; logic/bureau-battle.js, battle.js "THE BUREAU IN BATTLE", css/bureau-battle.css; bosses.json `faction`,
  factions.json `look.notice` and `look.property`. Who fights for the Bureau: a bot whose build is one of its bots, or
  a boss whose `faction` is `bureau`. RETRIEVED only when a Bureau bot's own hit (or a spread hit riding on its move)
  knocks yours out, never a burn, the stones or a delayed hit. The win's DENIED replaces a knockout's stamp; against the
  boss the win line's PENDING is on the sheet after the battle, a screen of its own. The join intro is 2,200 ms (its
  bots lock at 1,300), not 900: the notice is gone by the lock. The notice is stamped FILED. Stamps land on a paper slip
  so the red reads on any stage):
  - **Stamps:** RETRIEVED when a Bureau bot knocks out one of yours; VOID when you knock out a Bureau bot; DENIED on
    your win; PENDING over the Retrieval Unit's win line. One stamp per event, never two at once.
  - **Notice of Retrieval:** during the join intro (battle-stage.js 1808), a form slides up listing the four bots as
    line items, gets stamped, and slides away as they lock together. Within the intro's 900 ms; a tap skips both.
    Shares the boss banner with UI-17 and RL-14b.
  - **ID plates:** a Bureau bot's plate is form paper with a serial number (from the bot's id) and "Property of the
    Bureau" in red; after UI-14b's plates. Your own bots, later, keep the plain plate.
- **SY-6** the coat's foil in the world. Done 2026-10-28 on `track/style` (logic/coat-foil.js, the sprite shader's
  `uFoil`, walk/sprites.js `drawFoilRecord`; set on the items in world-billies.js `worldBillyItem` and battle-3d.js
  `battle3dFrame`, not in walk/sprites.js. The instanced program gets the same text but never sets `uFoil`: a coated
  Billie leaves its run only while its band crosses it (0.7 s of every 3.5 s). "Quality 2 and up" exists only in
  battle (`battleStage.q.lvl`); on the maps the foil is off with Graphics Off. A regional form's coat has no foil. The
  brightness step is 0.3 (lit-colour luma). UI-17's menu foil isn't built: this goes first, so UI-17 matches it.
  Graphics bench before and after is the owner's, on the phone (the bench is never run headless)):
  the UI track's prism foil, carried onto the Billie in battle and on the maps.
  A sheen term in the sprite shader (walk-shaders.js 181 and the instanced 511): a band sweeping across the sprite
  every 3-4 s on the 24 fps grid, Bayer-dithered edges, only on pixels above a brightness step, hue shifted from the
  coat's own colours. A `uFoil` uniform set in walk/sprites.js from the Billie's coat; off at quality 2 and up, under
  Reduced motion and with Flashes off. Graphics bench before and after.
- **SY-7** the Bureau in the world. Done 2026-10-28 on `track/style` (built in tools/build-props-routes.py, the
  props' own build script, so the art stays editable in the Studio: red tape layers on both models; the checkpoint had
  a plain `signpost`, so the emblem went on a new low-poly `bureau_sign` as a fixed decal made from art/ui/bureau.svg
  (scene/next/decals/bureau_emblem.png); the forms are ambient-life kind `form` with `fly` and a new `drift` flag
  (low, sideways, never walks, rustles), art/scene/life/form.png from tools/build-bureau-forms.py, in the checkpoint's
  and the scrap heap's `life`; MAPGEN_VERSION 25 at SY-7, 26 after main's WM-6 took 25): red tape on `bureau_barrier` and `bureau_crate`, the emblem on the
  checkpoint's sign, loose forms blowing past near Bureau places (an ambient-life kind with the `fly` flag). Flat
  props stay flat (CLAUDE.md). Art from the Studio.
- **SY-8** tuning and docs. Done 2026-10-28 on `track/style`; **the track is done** (built as below: the dials are
  uiTheme.json `style`, the Studio's UI section, group Style; logic/style-dials.js; the theme sheet writes them as
  `--stamp-scale`, `--stamp-slant`, `--hp-roll`, `--pop-min`, `--pop-max`, `--foil-*`; theme-sheet.js `styleDials()`
  reads them for battle.js and the foil, at most twice a second. The debug log's line is `state.style`: the state now
  and, per "flashes on/off, full/calm/reduced" state that ran, counts of flashes shown, held to 15% and skipped, stamps,
  pops, rolls and foil frames. Every default is the number SY-2 to SY-6 shipped, so nothing looks different until a
  dial moves): Studio dials (stamp size and slant, the roll's time, the pop's sizes, the foil's speed and
  width), a debug-log line with the Flashes and Animation states that ran (never save data), HANDOFF. Tag
  `style-done`.

## Decided for the owner, to review (SY-1 to SY-8, in one place)
Every step ran without waiting (the owner, 2026-10-27). Each choice below is in that step's HANDOFF entry too.
- **SY-1:** a bright flash with Flashes off keeps its colour, held to 15% (the plan said "drops white to the
  palette's surface"); a dark flash (the faint's deep red) stays as it is.
- **SY-2:** no beat added before a faint (it already waits for its own event; "Ask me before" 6); say if you want
  150-250 ms. Sizes replace the kind's size (a small crit shows small, in the crit's colour). Status damage is sized
  too. A heal's plate number rolls; its "+N" pop keeps its fixed size.
- **SY-3:** the emblem's drawing (a draft; repaint in the Studio's icon editor). Form numbers "Form 7B", "Form 12-C",
  "Form 4A-4", "Form 31", "Form 9-Lost", "Form 0" ("Ask me before" 2). Stamp words keyed by moment. The thunk is a
  fifth UI sound (music.json `ui.sounds.stamp`, a placeholder). No Studio card for the Bureau's look (still not added:
  see SY-8).
- **SY-4:** which nine events are the Bureau's (`bureau` in events.json; Form 27-B is in). The redaction words. The
  stamp rule (the last option DENIED, any other FILED, unless an option names its own). Form 27-B, 9-C and 9-G are
  events' own `form`. Bars lift when the intro shows again on file (a tap lifts one early). Buttons work while it
  types. The stamp sits under the summary. The manila colours are the file's own tokens. The lines are in Oxanium
  in every look.
- **SY-5:** UI-16a/b merged into `track/style` (so #289 carries them). The notice's stamp is FILED. RETRIEVED only on a
  Bureau bot's own hit. The boss: DENIED in battle, PENDING on its sheet after. Stamps land on a paper slip. Serial
  "No. NNNN-XX". The plate's paper is the case files' tokens. No gallery section for the plate and notice yet (UI-18).
- **SY-6:** maps: foil off with Graphics Off (they have no quality level). Regional forms' coats have no foil.
  Brightness step 0.3, sweep 3.5 s / 0.7 s, band along x + .6 y, hue turn per coat from a hash of its id, lift x1.25
  + .06 at 0.55. A foiled Billie leaves the instanced run while its band crosses. Reflections get no foil.
- **SY-7:** a new prop `bureau_sign` for the checkpoint (not the shared signpost). The tape is the scenery's red
  #DE4048. Forms also in the scrap heap. A new `drift` flag; size 0.95, lift 1.6 m. MAPGEN_VERSION 25 (26 since SY-8's merge of main, where WM-6 had taken 25). The emblem
  decal is made from art/ui/bureau.svg by the build script (rerun it after repainting).
- **SY-8:** the dials live in uiTheme.json `style` (the UI section's Style group), not in factions.json or engine.json,
  so palettes and presets can set them and the Studio's live preview shows them. Stamp size is a multiplier (x1) and
  slant is degrees (8) that scales each page's own tilt (-7 and -8 stay apart). The roll dial times the fill's move
  too, so number and bar land together. The foil dials are its period, sweep time and band half width; strength,
  brightness step and hue stay in code. Pop sizes are the smallest and largest (a KO is the largest). The log counts
  foil per frame drawn (a number that grows fast, but cheap). No Studio card for the Bureau's words and forms (edit
  factions.json `bureau.look`); a small one would fit the factions' own editor when there is one.

Optional, only if the owner asks (see "Ask me before" 4): **SY-9 Laminated**, a rarer finish, a second sheen on any
coat, given by the Bureau (a field-lab event, a Showcase prize), saved as `Billy.finish`, shared by the Showcase and
trades (`ONLINE_BILLY_KEYS`, `showValid`, the trade check). Looks only, never stats.

Each session: lint, type-check, unit tests and the smoke check after each change; the quick check at its end; tag
`sy-N-done`.

How the sessions run (the owner, 2026-10-27: "Also automatically start the next steps in their own Sessions. Their
plans are automatically approved"): the planning session (SY-0, SY-1) starts each step in a new session that pushes to
`track/style` once the step before has pushed its HANDOFF entry. A step writes its plan and goes on without waiting for
approval. At an open choice or an "Ask me before" item it takes the recommended option and lists it in HANDOFF under
"Decided for the owner, to review". Each step tells the planning session it is done with a one-shot scheduled task,
and an hourly check covers a missed one. Merges to main stay the owner's (the PR from `track/style`). The prompt
is in docs/phases/style-track-sessions.md.

## Fits with other tracks
- **UI track:** SY-2 after UI-16a/b; SY-5's plates after UI-14b; SY-6 after UI-17's menu foil (the same look, so one
  meaning); the stamp motion is UI-16b's.
- **Bots (RL-14b, `track/bots`):** SY-5 edits the join intro beside its shield phases: merge main first.
- **VFX track:** VFX-5/6 work in battle-stage.js; SY-1 and SY-2 touch the same file (`hitFx`, `battleStageFlash`).
- **Characters track:** the Bureau's people and leader are theirs; SY-3's emblem goes on their lanyards later.
- **Online track:** SY-9 only; ON-4 and ON-5 must carry `finish` if it is built.

## Risks
- Paper and red in three palettes and two themes: the gallery and a smoke step in each, the UI track's contrast
  check on the stamp's red.
- The roll and the pop sizes read the battle's numbers but must not change them: the battle golden record stays
  untouched.
- The foil on phones: one more term in the sprite shader for every sprite. Off when `uFoil` is 0, measured on the
  Graphics bench; quality 2 and up turns it off.
- Satire that tips into noise: one stamp per event, the Bureau's style only where the Bureau is.

## Ask me before
1. A different emblem than the bean on a tag (answered 2026-10-27).
2. Form numbers (the stamp words are answered: the placeholders).
3. The Notice of Retrieval, if it can't fit inside the join intro's time.
4. Reopening Laminated (SY-9; answered "not now" 2026-10-27).
5. Turning the foil off in battle (answered: it shows in battle).
6. Any change that makes a battle or an event longer.

## Sources
- https://popmatters.com/184010-the-bureacracy-of-play-2495635987.html (Papers, Please and bureaucracy)
- https://www.tuni.fi/playlab/papers-please-succeeds-in-replicating-webers-iron-cage-of-bureaucracy-in-video-game-form
- https://www.fontsinuse.com/uses/48689/control-video-game (Control's typefaces)
- https://gameinformer.com/2019/03/27/the-mesmerizing-art-behind-control
- https://blakecrosley.com/zh-Hans/guides/design/balatro (Balatro's layered feedback, shake by score)
- https://forum.arcgames.com/neverwinter/roletracker/jump/1266779 (Neverwinter's damage numbers)
- https://www.theseus.fi/handle/10024/900621 (readability in action-roguelites)
- https://godotshaders.com/shader/balatro-foil-card-effect/ (Balatro's foil, ported, CC0)
- https://godotshaders.com/shader/simple-dynamic-holographic-card-effect-foil (a holographic card shader)

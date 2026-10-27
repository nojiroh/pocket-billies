# VFX track: smears for throws and attacks, then battle effects (Part 2)

Branch: track/vfx

Part 1 (VFX-0..VFX-6) is the smears below. Part 2 (VFX-7 on, planned 2026-10-27) is the battle's effects: every
move animated from data, new effect art, light, hit tiers, statuses, the battle's flow, signature scenes, scars and
move sounds; it starts at "Part 2: battle effects".

The owner's brief (2026-10-26): "stylized smear animation effects that fit into the current artstyle. Like when you
throw a pyramid and stuff like that." Planned and researched in one session; the owner's answers are below. VFX-0 and
VFX-1 were built on `ccr-a98cc267-eqso1d` at the owner's word (`track/vfx` didn't exist yet); later sessions start on
`track/vfx`, made from that branch.

## The owner's answers (2026-10-26)
- Looks: all four. Afterimages (multiples), a motion-line ribbon, the stretched pyramid (an elongated in-between)
  and an impact frame.
- Colour: each pyramid's own colours, with a white core.
- The throw's arc is eased: a fast release, a short hang at the top, a fast drop, the same total time.
- Several sessions on `track/vfx`.

## What the game had (checked in the code, 2026-10-26)
- The throw: battle-stage.js `pyramidArc` moves `battleStage.coin` at constant speed with a sine hop (480 ms for a
  catch, 380 ms for a send-out and the mail move's coin). battle-3d.js `pyramidItem` draws it as a lit voxel model
  (`pyramidWorldItem`); a flat icon on the 2D canvas when models can't be drawn.
- Billies and trainers are pixel-art billboards from their rigs, posed on a 12 fps grid ("on twos", attacks and
  hurts on ones); poses already squash and stretch (skeleton-rig.js). Lunges are 120 ms `ox`/`oy` tweens. The sprite
  shader has a lean (`uShear`), always 0 in battle.
- Hits already have hit-stop, shake, flashes, rings, a chromatic flash and 2D speed lines on crits.
- No trail, ribbon, motion blur or velocity buffer anywhere. Voxel models have a Bayer-dithered fade (`uFade`) and an
  emission term (`uEmit`, the item's `glow`): enough for afterimages without a new shader.

## The research, in short
- Three kinds of smear (Richard Williams; the SIGGRAPH 2024 SMEAR paper, Basset, Bénard, Barla): the elongated
  in-between, multiples, motion lines. In games they show for one or two frames and keep the silhouette readable
  (Overwatch's GDC talk, via Kotaku).
- Real-time stretch: in the vertex shader, push the vertices that face away from the motion back toward a position a
  few frames old, broken up by noise (cjacobwade's SmearEffect: a lagged position queue, about ten lines of shader).
- Trails and slashes: a flat ribbon mesh, a texture panned along it, the wrap clamped (realtimevfx "Soulercoasters").
- Pixel-art games pair smears with hit-stop, a hit flash and shake (all already here).
- Not taken: screen-space motion blur (a velocity buffer, costly on phones, and soft, which fights the pixel art);
  the SMEAR paper's per-vertex offsets (built for skinned meshes; the pyramid is a small rigid model).

## How it fits the art
- Stepped, not blurred: the smears sample on a 24 fps grid (the rigs' "on ones") and hold between samples.
- Hard edges and flat colour: dithered fades (the models' own Bayer fade), the object's own colours brightened, a
  white core where a line is drawn. No soft gradients.
- Every smear is off under Reduced motion and thins out as the battle's adaptive quality drops (`battleStage.q.lvl`).

## Sessions
- **VFX-0** the plan (this file), ROADMAP and BRANCHES.
- **VFX-1** the eased arc and afterimages. `pyramidArc` eases its progress (logic/smear.js `throwArcEase`): fast at
  both ends, a hang at the top, the same duration. The pyramid keeps a short history on the 24 fps grid
  (`smearRecord`), and up to three afterimages are drawn at older places, dithered and brighter (`smearGhosts`); they
  cast no shadows and run out one by one after the throw lands. The 2D fallback draws them too.
- **VFX-2** the motion-line ribbon: a tapered strip along the last part of the arc, the pyramid's colour with a white
  core, eroded away in dithered steps in about 150 ms; spin throws twist it about the tumble axis. A new pass beside
  the `fx` pass in walk/effects.js. Done 2026-10-26 (the owner's answers: six places, about 250 ms; the 2D fallback
  too; the catch, the send-out and the mail coin, gold). Built as planned, three changes after a headless film: half
  width 0.24 m (about half the pyramid's side; 0.13 m read as a thin line), the twist a third of the tumble (the
  whole turned the strip nearly twice along its length, so it mostly showed its edge), the colour's value x1.35.
- **VFX-3** the stretched pyramid: the vertex stretch in the voxel shader (a lagged position, the trailing side
  pushed back, a little noise), on the pyramid only, on its fastest one or two frames (the release and before impact).
  Done 2026-10-26 (the owner's answers: the 2 m rule near the camera stays, so a catch stretches only before the hit;
  the 2D fallback's icon stretches too). The pyramid is a low-poly model by default, so the stretch is in both
  one-at-a-time vertex shaders (low-poly and voxel, prop-models.js `SMEAR_GLSL`); "Models in batches" is on by
  default, so a stretched pyramid leaves the batch and is drawn one at a time. A cell is stretched when the throw's
  pace there is 1.3x its mean or more (`throwArcPace`): one or two cells at each end; the trailing side is dragged
  0.6 of the way back to the place one cell ago, at most 0.8 m. Shadows stay unstretched.
- **VFX-4** the impact frame: one or two frames of a two-tone flash with radial lines from the hit point, on the
  pyramid's impact and on crits. The crit speed lines move from the 2D canvas into GL. Done 2026-10-27 (the plan's
  recommendations approved: the catch's hit, the mail move's coin and crits, not the send-out or super-effective
  hits; ink and white, the crit's warm yellow as paper on crits; the negative, then the positive). Drawn in the grade
  pass (engine/post-effects.js), no new pass: two cells on the 24 fps grid (one at quality 2, none at 3 or under
  Reduced motion), on real time so it plays through the hit-stop; the flashes it would be washed out by wait for it.
  Checked: there is no non-GL battle picture (battleStageDraw draws nothing without GL), so "the 2D fallback" is the
  flat pyramid icon over a GL battle, and the post pass covers it.
- **VFX-5** attack lunges: the lean (`uShear`) driven by the lunge's speed, one or two afterimages of the rig's
  billboard (its texture exists already); dash moves reuse the ribbon. Since Part 2: the lean and the afterimages
  are built as helpers (logic/smear.js and one callable step) that Part 2's runner reuses.
- **VFX-6** tuning and docs: Studio dials (ghost count, colours, ribbon length, stretch), a debug-log line saying
  which smears ran and at which quality (never save data), HANDOFF. Folded into Part 2 (VFX-7): the debug-log line
  goes to VFX-8, the dials to VFX-12, where they become battleAnims data instead of being built twice.

Each session: lint, type-check, unit tests and the smoke check after each change; the quick check at its end; tag
`vfx-N-done`.

## Ask me before
- Changing the throw's total time, or easing the send-out and the mail coin differently from the catch (VFX-1 eases
  all three the same).
- Adding the smears to the opening's throws (cutscene/opening.js).
- Anything that makes an attack longer (VFX-5 adds no time). Answered in Part 2 (2026-10-27): signature scenes and
  moves of power 100+ may run up to 0.5 s longer; every other move keeps its time.

## Sources
- https://en.wikipedia.org/wiki/Smear_frame
- https://hal-iogs.archives-ouvertes.fr/hal-04576817v1 (SMEAR, SIGGRAPH 2024)
- https://kotaku.com/this-is-not-an-overwatch-glitch-1777612546
- https://github.com/cjacobwade/HelpfulScripts/tree/master/SmearEffect
- https://polycount.com/discussion/comment/2344470 (Guilty Gear Xrd trails)
- https://realtimevfx.com/t/vfx-basics-mesh-soulercoasters/1987
- https://gamineai.com/blog/pixel-art-combat-fx-hitstop-smear-frames-impact-timing-2026
- https://godotshaders.com/shader/screen-sampled-black-and-white-manga-hit-impact-post-process-shader/

# Part 2: battle effects (VFX-7 onward)

The owner's brief (2026-10-27): "Make a plan to improve the art and effects of attacks and other things in battle. Do
research online. Make suggestions for additions."

Planned in VFX-7 (Plan Mode, plan approved) on `ccr-7526d712-gliikp`, since a cloud session pushes only to its own
branch; the build sessions start on `track/vfx` after VFX-5 (fetch it first: a fresh clone holds only main and the
session's branch). Three read-only passes (what a battle draws; data, Studio and tests; the renderer), outside
research, and a review of the plan against the code, whose corrections are in "How it's built".

## The owner's answers (2026-10-27)
- **Home:** Part 2 of this track, sessions VFX-8 on, on `track/vfx`. VFX-6 folds in (see Part 1's sessions).
- **Effect art:** Claude draws it (a tool makes grayscale pixel sprites and short flipbooks at the Billies' pixel
  size; each type colours them); the owner repaints any in the Studio (Art browser, Edit pixels).
- **Additions, all four offered:** signature scenes (the 56 signature moves get their own animation); leader, rival
  and boss intros (a VS splash with portraits and a name banner, no added time); battle scars (marks that stay on the
  ground for the battle); move sounds (a sound per family and type, with the sound track).
- **Long moves:** signature scenes and power 100+ moves may play up to 0.5 s longer; Fast and Faster still shorten
  them, and a tap skips. Today a tap only finishes the text (battle.js `tapMessage` 492-501): the runner adds the
  skip, as the Battle speed row's text ("Tap still skips ahead at any speed") already promises.

## What a battle shows today (checked in the code, 2026-10-27; verify)
Refs are under game/js: BS battle-stage.js, B battle.js, B3 battle-3d.js, BE logic/battle-engine.js, FX
walk/effects.js, PE engine/post-effects.js, WS walk/walk-shaders.js.

**Attacks.** A battle's pictures come from one switch, BS `battleStagePlay` (1685-2397), over 21 event kinds. It
returns `{dur, hit}`, which B `showEvent` (427-449) waits on: plates repaint at `hit`; the line is ready after
dur + 120 ms on the stage clock and its typing; it moves on 820 ms later (1300 under Reduced motion) ÷ speed. The
engine's `item`, `xp`, `draw` and `crit` events have no case. Case `move` (1910-2095) has three choreographies, by
category:
- H (43 moves): a lunge (+30 px in 120 ms, back in 200) and 5 dust pixels; the hit at 200 ms (dur 880).
- S (51): a ring and a ground ring in the type's colour on the attacker, 9 type icons lobbed 34 ms apart, a straight
  2D beam for Electric, Psychic and Water only; the hit at 500 ms (dur 1060).
- X (28): 10 type icons converge on the target or itself, a ring at 600 ms (dur 1000).
- Power 80+ adds a handheld wobble and a two-step camera sweep; miss, Guard and blocked have short versions of their
  own. A type is a colour and its icon keys (types.json `fx`, game-data.js 146-160).
So the 122 moves share 3 choreographies in 10 colours, and signature moves look like any other.

**Hits.** `hitFx` (BS 1562-1600), with w = damage ÷ max HP (`hitWeight`, 1552): knockback 4+9w px, the hurt pose, a
burst of 10 type icons, hit-stop 20+70w ms, shake 1.4+6w, a zoom punch above w 0.45. Super-effective: shake 8,
hit-stop 80, a white flash (.55, 260 ms), the chromatic flash (a CSS drop-shadow filter over the whole canvas,
battle-screen.css 212), rings, 16 icons, haptics. Crits: VFX-4's impact frame, then a warm flash and hit-stop 90.
Not-very-effective looks like neutral and x4 like x2. The "−N" pops and tags are DOM (B 566-586).

**Particles and pixels.** One CPU list (`addParticle`, `burst`, `ringFx`, `groundRing`, BS 1489-1525): move particles
uncapped, ambient ones stop at 220. Icons are drawn in GL one quad and one texture bind each, an alpha pass then an
additive one (FX 787-808); unlit (only particles with a hex `col` add a light, B3 305-315, so the icons never lit
anything); 3-11 px cells of icons.png, one canvas and texture per key (art.js 155), at 30 px/m (B3 326); they fade
smoothly and move at the display rate. Rings, dust, the beam (an antialiased stroke) and bot parts are on a 2D canvas
over the GL (BS 1271-1339), never depth-tested or lit. Rigs are sized from a 224x168 stage frame by depth (BS
198-209, B3 228 `mpp`): about 65 px/m for your Billie and 30 for the foe, so icons near your Billie show pixels about
twice the size of its art's.

**Statuses, stats and other events.** Statuses (par, slp, brn) are text badges: 8 icons when one starts, then one
icon over the head every 700 ms (BS 802-821); no tint or pose. Confusion: 7 stars circle once. Stat changes: 9
arrows and a ring (BS 2163-2184); ±2 looks like ±1. Protect, the Alpha shield, Soaked, Fork, the delayed hit and
sharp stones show only on their turn or not at all; Perks, held-item boosts and five type passives fire unseen
(ui-track.md, Part 2, "What the code does today").

**Flow.** The 3D start: a camera swoop and leaves (B 275-345). Wild: a silhouette revealed at 700 ms; an Alpha adds a
flash, shake and sparks. Trainers slide in (BS 1755-1770, dur 1150) with no banner or portrait. Send-out: Part 1's
pyramid, a white flash, the Billie scales in from white. Recall: the block pose, white, a shrink; no beam or sound.
Catch: about 5.3 s (BS 2411-2519). Faint: sink, fade, a lilac ring. Level-up: gold rings and a pop. Bosses: `join`
(four bot pictures fly in and lock, 1810-1874), 1.6x size, a pink under-light; `alphaPhase` a gold flash; the shield
only a gold light. Bot limbs: sparks, the part's picture falls (2300-2349). Weather: the walk scene's own keeps
falling; Sandstorm adds 2D streaks and a banner (2243-2263).

**Who draws, and when.** One GL context: the walk renderer draws the battle inside the place you stand in
(walk-view-gl.js 580-795: shadows, lights, sky, ground, sprites, models, water, `effectsPass` 710, `ribbonPass` 712,
then depth of field, bloom, AO, rays, light-in-air and grade). Rigs are lit billboards of 2D canvases posed on a 12
fps clock; a hit flash bakes white or dark into the canvas (`rigTint`, BS 1228) and the frame key includes it (1211),
so a tweened flash redraws and uploads every frame. The camera is directed (camTo, camAt, camHome, handheld, punch),
with CSS shake, zoom and roll on `#camWorld` (BS 926-958). Hit-stop holds the stage clock and speed multiplies it (BS
644). `battleStageFlush` (528-547) runs every pending step at once when the next line starts.

**Settings and quality.** Battle speed 1 / 1.6 / 2.2 (B 239-241). Animation Device / Full / Reduced (Calm comes with
UI-16a). Flashes: only lightning and the evolution and hatch flashes read it (environment.js 422); the battle's flash,
the impact frame, the chromatic flash and the wipe don't; nothing limits flashes a second, and `blinkActor` flickers
at 8 Hz. The battle's own quality `battleStage.q.lvl` 0-3 (BS 898-923) thins Part 1's smears; particle counts never
scale.

**There to build on.** Point lights from battle code (`battle3d.lights`, B3 279-316; 16 in the shader, 8 on phones,
walk/lighting.js 147-162); weather particles in one instanced draw (`weatherBatch`, FX 147-229); the `fx` program's
strips and the ribbon pass (WS 488-506, FX 87-146); the lit `face` program for marks on the ground (WS 478-486); the
grade pass's heat shimmer (`uHeat`, up to 6 local sources, PE 292-296), moods, `uCA` and the impact frame; NW_PALETTE's
20 ramps (game/art/next/palette.js); `portraitHTML`; 243 low-poly recipes (game/art/scene/next/models: the city
towers, the library, the market cart, five trains, boats, Bureau crates...); the icon atlas's props (yacht, building,
skyline, cart, mic, megaphone, phone, sneaker, burger, rocket, truck, box, paper, chart, dice, tv); Part 1's model on
an eased arc with afterimages, ribbon, stretch and impact frame; the Studio's battle preview
(studio/js/battle-preview.js 165-242: any move and outcome on the real stage) and the Moves editor's "Preview
animation".

## The research, in short
- **Big move lists are scripts built from a small vocabulary, with fallbacks.** Pokémon Emerald (pret/pokeemerald,
  battle_anim_scripts.s): a script per move from shared commands (createsprite, createvisualtask, delay,
  waitforvisualfinish, playsewithpan, monbg, fadetobg, palette blends) and shared sub-animations (call, goto); tables
  of their own for statuses, general events (stat change, weather, hit, heal) and special ones (level-up, switch-out,
  ball throw). Pokémon Showdown's web client (battle-animations.ts): about 60 reusable effect images, one tween call
  (`showEffect(effect, start, end, transition)`: linear, swing, accel, decel, ballistic), `backgroundEffect` tints,
  about 40 generic animations reused by many moves (slashattack, clawattack, punchattack, bite, kick, fastattack,
  spinattack, selfstatus, chargestatus, heal, drain, leech, sound, flight) and status ones (brn, psn, slp, par, frz,
  confused); an unknown move plays Tackle, and fast variants play at high speed. PokeRogue (a browser roguelite): a
  JSON per move (frames of cells: x, y, zoom, angle, opacity, blend, tone, focus on user or target; timed sound and
  background events); a missing file falls back by category (attack: Tackle; self: Focus Energy; else Tail Whip).
- **Grayscale art coloured by a ramp; rings by erosion.** Overwatch's FX team: a flipbook turned grayscale and
  coloured by a gradient map; rings as a static texture with eroded alpha; at 24-30 fps flipbooks read as held anime
  frames (realtimevfx). Kanada-style effects: angular shapes, hard contrast, held frames, impact frames. A dissolve is
  a hard step against a threshold pattern, with a bright rim at the edge (GameDev.net; Godot forum).
- **Light sells effects.** Octopath Traveler's battle effects looked flat until a point light came with each, casting
  the characters' shadows (Unreal Engine spotlight; Wikipedia, HD-2D).
- **Hit feel.** Sakurai's hit-stop techniques: shake the one hit more than the attacker, horizontally on the ground,
  decay the shake, blend into the hurt pose, nudge the attacker, scale with camera distance, keep the numbers in a
  table. Vlambeer: a camera kick along the hit, shake that fades fast.
- **Escalation.** Balatro: each trigger pops in turn, counters roll, shake and sound grow with the size.
- **Backgrounds.** EarthBound's battle backgrounds: rows oscillating, palette cycling (WebGL recreations exist).
- **Safety.** WCAG 2.3.1: at most 3 flashes in any second; saturated red is worse; regular light-dark stripes are a
  risk; a warning doesn't replace the limit. Pokémon long had a Battle Effects (Battle Scene) Off option, until
  Legends: Arceus, because battles run faster without.
- **Intros.** Pokémon's VS screens appear inside the battle transition's time (a community note).
- **Tools.** Pixel FX Designer renders particle effects into pixel-art sheets with palettes and dithering: a
  reference for the drawing tool, not a dependency.

## How Part 2 fits the art (rules)
1. **Three beats:** wind-up, hit, fade. The hit is one or two cells, the brightest; the fade is the longest.
2. **The Billies' pixels:** a texel in the air is a stage pixel at its depth (z/170 m, the rigs' rule: about 65 px/m
   near, 30 far), drawn at whole-number scales, nearest-filtered, with no free rotation (0, 90, 180, 270, flips, or a
   ribbon). Marks on the ground and summoned models keep the world's 32 px/m. Positions aren't snapped (the camera
   moves smoothly and the rigs aren't snapped either); time is.
3. **Stepped:** loops and holds at 12 fps, hits at 24 fps (`SMEAR_STEP`), all on the stage clock.
4. **Value first, colour from the type:** sprites are 8 greys; a type's NW_PALETTE ramp colours them and pure white
   stays the core. Proposed ramps: Fire ember, Water sky, Grass leaf, Electric gold, Ground rust, Flying cobalt,
   Psychic rose, Steel steel, Dragon indigo, None stone; the Bureau crimson with ink.
5. **Hard edges:** fades are erosion (a hard step against a Bayer pattern on the effect's own texel grid, so holes are
   art-pixel sized, with a bright rim on the eroding edge), never smooth alpha. No blur, no soft glows.
6. **Light:** effects light the stage in their colour; big ones darken the rest of it a little.
7. **Big for big:** size, light, shake and hit-stop rise with the hit's tier; frequent things stay small.
8. **Time:** a normal move keeps today's timing; signature scenes and power 100+ moves get up to 0.5 s more; all of it
   on the stage clock (speed already scales it); a tap skips; Faster plays each family's short variant.
9. **Safe:** at most 3 full-screen flashes in any second, 333 ms apart, peak .55, none in saturated red; a flash over
   the limit becomes a sprite flash, never a late one. Flashes off: no full-screen flash, sprite flashes at most half
   strength, blinks at most 3 a second. Calm (UI-16a; the rule ui-track.md asks VFX-5/6 for): what an action causes
   still plays, smears included; idle loops (status fizz, auras, motes) pulse once a turn. Reduced: the meaning
   without the motion (a dithered tint; no shake, camera, smears or extra time).
10. **Original:** signature props allude through generic objects (a sneaker, a burger, a yacht), never a brand's logo
    or lettering. Drawn words can't be translated (i18n.js), so only proper names and sound words are drawn as
    sprites; any other word goes through the text the game translates.

## How it's built
### Data: `battleAnims.json`
A new section: game/data/battleAnims.json, its schema in game/data/schema, types in game/types/game-data.d.ts, checks
in logic/data-checks.js, `BATTLE_ANIMS` in game-data.js, the check-data snapshot updated. Colours live here, not in
JS (the UI lint caps raw hexes in game JS).
- `sprites`: each strip's cells, frames, size and anchor.
- `ramps`: a type's ramp (an NW_PALETTE name, or eight greys mapped to hexes) and its light colour.
- `families`: the timelines (below), each with a `short` variant for Faster and a type slot.
- `types`: per type, its sprites (from today's types.json `fx` keys), its motion and its light.
- `moves`: signature scenes by move id.
- `events`: statuses (start, loop, tick, end), stat up and down, heal, drain, protect, shield, send-out, recall,
  catch, faint, level-up, item, weather start, boss phase, limb break, passive and held-item glints.
- `tiers`: the hit-tier table.

moves.json gets an optional `anim` (a family or a scene id); the data check requires every `anim` to resolve. Not
`fx`: moves.json's `fx` holds mechanics and Perks have `fx` effect rows; logic/effects.js is the Perks' too, so new
names avoid "effects".

### The resolver: `logic/battle-anims.js` (browser-free)
- `battleAnimFor(an, ev, ctx)`: the move's `anim`, else its family for its type, else its category's default.
- `hitTier(an)`: resisted, neutral, super, super x4, crit. `koAhead(events, i)`: a `faint` of the target before the
  next `move`; not from `ev.s`, since `refreshLastSnapshot` (BE 370) refreshes only the last event and an
  `alphaPhase` or a spread move's second line can sit between. Last KO: no later `enter` for that side and the battle
  ends. UI-16b can use both.
- The timeline: steps at stage-ms times, with quality, motion, Flashes and the speed variant applied, the flash
  limiter and the +0.5 s cap; unit tests and a snapshot of every move x outcome.
- Loaded in game/index.html, studio/index.html and studio/js/logic-worker-modules.js; `npm run modules`.

The engine and its events don't change, so the golden record (battle-golden.test.mjs) stays as it is. Effects use
their own random numbers (seeded per event, so films repeat), never the battle's `b.rng`.

### The runner and its steps
A runner, loaded after battle-stage.js and reached through hooks.js `provide` (its state one exported object, so no
setters), plays a timeline and returns `{dur, hit}`: battle.js keeps its timing. It keeps its own step queue: on a
skip (a tap, or the next line's flush) state steps (show, hide, positions, `st`) jump to their end and visual and
sound steps are dropped, instead of all firing at once as `battleStageFlush` does today. The new tap: flush, paint
the line's plates, mark the line ready, keep its text. Sounds go through the stage clock (`scheduleAt`), so they keep
step with hit-stop (today they use `setTimeout`, sound.js 609).

| Step | What it does | Built from |
| --- | --- | --- |
| lunge, dash | the attacker moves in, leans, leaves afterimages | VFX-5 |
| projectile | a sprite or prop flies (straight, arc, zigzag, spiral) with a ribbon | Part 1's arc and ribbon |
| beam | a strip from one to the other, its caps, its texture scrolling | the ribbon pass |
| burst, ring, spray | a flipbook or a spray of sprites at a point | the pool |
| rain, storm | sprites or props falling or circling over an area | the pool |
| aura, rise, fall | a loop round a Billie; chevrons up or down | the pool |
| slash, claw, bite | arc flipbooks over the target | the pool |
| prop | a low-poly model summoned, thrown or dropped, with Part 1's smears | `propWorldItem` |
| mood | darken, tint, a row wave, heat | the grade pass |
| light | a point light for a while, in the ramp's colour | `battle3d.lights` |
| camera | push, punch, pull, follow | camTo, camAt, punch |
| hit | the tier's hit-stop, shake, knockback, flashes | `hitFx` |
| flash | a sprite's flash, tint or dissolve | `uHit`, `uFade` |
| stamp | a drawn proper name or sound word, stepped in | the pool |
| scar | a mark on the ground for the battle | decals |
| sound | a move sound | sound.js, music.json |

### Drawing
- **One draw for effects:** an instanced pool (copying `weatherBatch`) over one atlas packed with `kitPack`
  (logic/kit-assemble.js 375) from the strips and icons.png, made through `gpuTexture` (engine/webgl.js 861, rebuilt
  when the context is lost) and warmed with the other programs (walk-view-gl.js 329). Drawn as cutout (discarded by
  the erosion step, depth written): no sorting, depth of field reads each particle's own depth, alpha 0 out so the ink
  outlines skip it, as the ground does. Only the white cores are additive.
- **The 2D canvas leaves:** rings, dust and beams move into GL (depth-tested, fogged, lit); the bot parts' pictures
  stay 2D for now. In GL they also get depth of field, bloom and the impact frame's two-tone: judged on a film.
- **The rig's flash on the GPU:** `uHit` (a colour and an amount, after lighting) in the sprite fragment shader (WS
  170-212), set per rig item (B3 223-249); white and dark leave the rig's frame key, so a flash no longer redraws and
  uploads its canvas. The rigs (7 at most) keep the plain sprite program, as VFX-3 does for a stretched pyramid; phase
  20's instanced `spriteI` takes `uHit` too if it is turned on.
- **Lights with fixed keys:** lighting.js keys battle lights by array index (`l.kind = i`, 326-332), so with Steady
  lamps on they would swap. Fixed small kinds: the selection 0, the boss and shield 1-4, effects 8-10 from a pool.
- **Moods:** a battle mood on top of the place mood (PE 724-772), tweened on the stage clock (not the place mood's
  2 s ease): darken, tint, warmth. The row wave is a new uniform beside `uHeat`, added to the Medium precision pass's
  highp list. The chromatic flash moves from the CSS filter to a `uCA` pulse (PE 731), cheaper on phones.
- **Scars:** one batched draw of small 3x3-vertex patches laid on the ground's height (`standingHeightAt`) and lit as
  the `face` program is; never on water.
- **Props:** `pyramidWorldItem` (B3 486) generalised into `propWorldItem(path)` with a `battleStage.props` list;
  models preloaded at the battle's start; with 3D props off a scene plays its family instead.

### Studio, tools and the debug log
- **Battle effects** in the Studio (Creatures workspace), grown from the battle preview: pick a move or an event and
  play it on the real stage at any speed, quality, motion setting and Flashes; its steps on a 24 fps scrubber; the
  tier table, budgets, ramps per type and the sprite cells; Part 1's dials (ghosts, ribbon, stretch). It saves
  battleAnims.json like any section (drafts, Propose). Each later session adds its dials there.
- **tools/look-battle-anims.py:** films moves headless (Math.random seeded, the battle's quality locked) into contact
  sheets in validation/look-battle-anims/ (gitignored like the other look folders); `--only=` moves, families or
  types.
- **tools/build-battle-anims.py:** draws the sprite strips ("The effect art").
- **Debug log:** an `anim` line per move: the move's id, its family or scene, the tier, the variant, the quality and
  any flash the limiter held back; never save data or names.

## Families
Proposed from each move's mechanics first (protect, heal, selfStage, tgtStage, status, delay), then its name and
description. Every move has one, signature moves too until their scene exists. Reviewed in the Moves editor (a
dropdown) in VFX-11.

| Family | What it looks like | Moves (122) |
| --- | --- | --- |
| charge | a run-up and a full-body hit | Tackle, Rush, Blaze Charge, Kisses, Rollback, Full Steam (6) |
| dash | too fast to see: afterimages, then the hit | Quick Strike, Zip, Dash Kick, Flame Dash, Front Run, Just Do It (6) |
| dive | up and out of view, then down from above | Drake Dive, Wing Strike, Spruce Dive, Siu!, Tower Drop, Library Slam (6) |
| strike | a close punch, jab, drill or squeeze with an impact burst | Piston Jab, Grip Crush, Iron Squeeze, Heavy Press, Finisher, Auger Bore, Drill Strike, Mind Wipe, Premonition (delayed), Blast Furnace, Standard Oil, The Decision, Sunday Red, I'm Out (14) |
| slash | arcs across the target | Vine Lash, Arc Whip, Gale Slash, One-handed Backhand, Empire State (5) |
| quake | the ground: stomps, rocks, cracks | Quake Stomp, Landslide, Boulder Toss, Concrete Pour, State-sized Pit (5) |
| flurry | hits in a row | Assembly Line, Counts to Two, In Sync, Developers!, Billions Served (5) |
| shot | a projectile; drain is its reverse | Spark Shot, Cinder Shot, Flare Core, Splash Shot, Sticky Seeds, Sap Drain (reverse), Fifteen Seconds, Ship Direct, Smart Contract, Character Limit, Fast Fashion, One More Thing, Zero to One, Cleaning Fee, Stake in Everything, Yacht Race (16) |
| beam | a held ray | Searing Beam, Chrome Ray, Moonbeam, Overcharge, Green Hydrogen, Feeling Lucky, Vision Fund (7) |
| breath | a cone or a jet | Wyrm Breath, Inferno, Jet Blast, CUDA Call (4) |
| wave | rings and pulses outward | Mind Pulse, Shock Pulse, Surge Wave, Riptide, Rolling Wave, Spring Tide (heals), Shuffle Play, Autoplay, Cut To, Hallucinate, Harbour Fee, Wrong Name (12) |
| storm | many things over an area | Petal Storm, Cinders, Cyclone (Flying), Sand Squall, Cyclone (Electric), Open Sesame, Golden Caravan, Flatpack (8) |
| buff | an aura and rising chevrons | Charge Up, Overclock, Stoke, Updraft, Gives Wings, Anchor Down, Flow State, Principle No. 212 (8) |
| hex | at the foe: a status, a drop, a hazard or a type change | Scorch, Static Wave, Lullaby, Bewilder, Per Minute, Terminal Fee, Unnerve, Grinding Screech, Perfect Fold, Pop the Collar, Scatter Stones, Soak, Fork (13) |
| guard | a shield | Guard, Skim Guard (2) |
| heal | sparkles rising, light | Sunbathe, Second Wind, Self-Repair, Buy the Dip, Quiet Gift (5) |

Spread moves play on every foe in the one move event; aimed moves (Auger Bore, Grip Crush, Jet Blast) hit the part.

## Type kits
| Type | Ramp | Sprites | How it moves | Light |
| --- | --- | --- | --- | --- |
| Fire | ember | ember, flame tongue, smoke | flickers upward; heat shimmer on big hits | warm, flickering |
| Water | sky | droplet, bubble, splash crown | arcs and splashes; ripples on battle water (WA-7) | cool |
| Grass | leaf | leaf, petal, seed | spirals and tumbles | green |
| Electric | gold | bolt piece, spark | zigzags; a held frame doubled (a stutter) | white-gold, brief |
| Ground | rust | pebble, dust, crack | thuds; vertical shake; dust rings | dim, warm |
| Flying | cobalt | feather, wind streak | sweeps on ribbons | pale |
| Psychic | rose | orb, ring, star | waves and rings; the stage's row wave on big moves | pink |
| Steel | steel | shard, cog, spark | hard rings, glints, sparks | white |
| Dragon | indigo | scale, flame | two-tone; a roar ring | violet |
| None | stone | pow star, dust | plain impacts | white |
| the Bureau (its bots and agents) | crimson and ink | paper, stamp | stamped in, square | red, cold |

## Hit tiers (starting numbers; a cell is 42 ms)
| Tier | Hit-stop | Shake | Full-screen | Burst | Light |
| --- | --- | --- | --- | --- | --- |
| resisted | 20 ms | 1+2w | none: a grey sprite flash, a dull puff | 6 | dim |
| neutral | 20+70w ms, today's (Ask me before) | 1.4+5w | none: a one-cell sprite flash | 10 | normal |
| super x2 | 2 cells | 6 | a type tint .35, the `uCA` pulse | 16 | bright |
| super x4 | 3 cells | 9 | a tint .45 and a darken | 24 | bright |
| crit | 2 cells + the impact frame | 7 | a warm flash .5 after it | 16 | warm |
| KO | 1 cell more | 2 more | none: the target flashes white, then ink | 6 more, a scar | |
| the last foe, a boss | a 6-cell freeze, about 250 ms (Ask me before: it adds a quarter second) | 10 | the impact frame (its lines only with Flashes off) | 10 more | |

Knockback stays 4+9w px, more for super and the last KO. Each row is a dial in the Studio.

## Statuses, stat changes and short effects on the stage
The stage side of UI-16b's tags, blips and pips; both read the same events, so they land together.
- **Burned:** embers rise in a slow loop; a warm flicker on the sprite (`uHit`, dithered); the burn's tick a lick of
  flame.
- **Paralyzed:** sparks jump; on a lost turn the sprite stutters (a held frame) and flashes a jagged gold edge.
- **Asleep:** Z's rise; a slower, lower idle (a sleep pose if body-plan-animation.js can take one); a pop on waking.
- **Confused:** three stars orbit while it lasts; hitting itself, a bonk star.
- **Stat changes:** chevrons rise (teal) or fall (red), the colour code's; "sharply" doubles them, read from the
  line's stage change (the stage compares the snapshots before and after; the engine is untouched).
- **Protect, Skim Guard:** a hex bubble that flashes on a block. **The Alpha shield:** a dome of hex cells that crack
  as it wears down. **Soaked:** drips. **Fork:** a flickering copy. **The delayed hit:** a mark in the sky until it
  lands. **Sharp stones:** small rocks on that side's ground that glint, and hit on entry. The Alpha's red eyes (only
  a comment today, BE 972).
- **Passives, held items, Perks:** a small glint in the source's colour on the Billie when one fires (the HUD blip is
  UI-16b's); boosts at the start pop one by one, as Balatro reveals its triggers.

## The stage: moods, weather and scars
- **Moods:** big moves darken the stage a little and tint it to the type; Psychic and the Bureau get a row wave
  (EarthBound's), Fire's big moves heat shimmer.
- **Weather in battle:** the walk weather keeps falling; rain splashes on the battle's ground, snow and ash settle,
  sun warms the grade and its shafts; Sandstorm moves into the weather batch (no 2D streaks).
- **Battle scars (the owner's pick):** scorch (Fire), puddle (Water), crack (Ground), leaf litter (Grass), sand drift
  (Sandstorm), a dent (heavy hits); one per hit and one more on a KO; at most 12 (8, 4, 0 at quality 1-3), 1.2 m at
  most, the oldest replaced; gone in four dithered steps over 400 ms when the battle ends.

## Battle flow
- **Start:** today's swoop keeps its time. Leaders, Blake and bosses get the **VS splash** (the owner's pick):
  portraits (`portraitHTML`, at whole-number scales), the name in the game's font, the type's colour and the kit's
  slant, inside `trainerIn`'s 1150 ms and the first line's reading time, with no time added; static under Reduced
  motion. One component with UI-17's boss banner: whichever lands first builds it.
- **Send-out:** the pyramid's landing (Part 1), a burst in the Billie's type, the Billie dithering in from the feet
  up; each pyramid kind in its own colours; Prime and Coats a glint.
- **Recall:** a beam from the Billie back to the trainer's hand while it dithers out; a sound.
- **Catch:** each wobble squashes the pyramid and puffs dust; caught: sparks up its edges, stars, the type's ring;
  an escape: the pyramid's shards in its colours.
- **Faint:** the hurt pose holds, the Billie sinks and dithers out with a dust puff; bots shed their limbs with sparks
  and bolts, then smoke.
- **Level-up:** a column of growth-sky light and a ring, on the right Billie. **Victory:** the winner's cheer and
  sparkles. **Defeat:** your side fades.
- **Items used:** the item's icon pops from the bag to the Billie, then the heal. **XP:** the bar moves with its line.

## Signature scenes (the owner's pick)
Each of the 56 signature moves gets a scene: the steps above, a prop (a low-poly model or an icon atlas prop) and,
where it fits, a stamped proper name or sound word; up to 0.5 s longer than its family. Each scene's one-line
storyboard is the owner's to approve before it is built. Examples:
- Tower Drop: a city tower drops from above with Part 1's stretch; a dust ring and a crack.
- Library Slam: the library drops; books (paper sprites) scatter.
- Golden Caravan: the market cart rolls in on an arc and coins rain, in the Dragon's two-tone.
- Full Steam: a train crosses the stage through the foe.
- Siu!: a jump, a turn, a landing ring, the name stamped.
- Developers!: three shouts in a row, a ring each, a megaphone.
- Cut To: the picture cuts (a hard cut, a two-tone frame) and the foe is already hit.
- Open Sesame: doors open and the stalls' goods pour out.
- Yacht Race: a boat skims in, turns hard and rams.
- Flatpack: crates fly in and assemble on the foe, one screw left bouncing.

The first batch (VFX-17) is the 12 of power 100+ (Tower Drop, Zero to One, Vision Fund, The Decision, Concrete Pour,
Blast Furnace, Hallucinate, Developers!, Siu!, Full Steam, Standard Oil, Golden Caravan) and about 6 more.

## Move sounds (the owner's pick)
A sound per family, layered by type, as data in music.json (notes like SND-6's UI sounds, plus a noise voice for
hits, whooshes and splashes), edited in the Studio's Sounds tab and played on the stage clock; placeholders until
the owner's listening pass. Hurt events (a burn, recoil, a spread move's second target, the delayed hit) get a sound.
`python3 tools/check-sound.py` fingerprints every one (a new baseline in its own commit).

## The effect art
tools/build-battle-anims.py, modelled on build-fx-v47.py (strips from character grids) and pixkit.py (`Piece`), with
procedural rings and explosions eroded by a Bayer pattern frame by frame. It writes only what's missing (`--force`
draws again); `--check` checks the strips against the data; `--sheet` makes a contact sheet of every sprite through
every ramp. Strips go to game/art/battle/anims/, one PNG each, so the Art browser's Edit pixels and its strip preview
work on each; the game packs them when it loads.
- 8 px: spark, ember, droplet, chip, star, chevron, bubble, leaf, petal, feather, pebble, shard (three), note, Z,
  plus, coin, paper; the bolt piece 8x16.
- 16 px: burst, hit spark, splash crown, smoke, dust, flame tongue (12x16), orb, claw, jaws, swirl, heal sparkle,
  the stamp's frame; the slash arc 32x16.
- 32 px: explosion, shock ring, shield hex, the beam's caps and strip.
- On the ground (32 px/m): scorch, puddle, crack, leaf litter, sand drift, dent.
- Frames: 3-8 at 12 fps; impacts play their first two at 24 fps. Values: 8 greys, pure white the core.

## Budgets
- Particles: one pool for move and ambient particles, 256 / 160 / 96 / 48 alive at quality 0-3; a burst at most 24 /
  16 / 10 / 6; ambient at most a quarter of the pool.
- Effect lights: 3 / 2 / 1 / 0 at quality 0-3, at most 2 on phones; 2.4 m, 300 ms or less; 6 in the battle in all.
- Draws: a move's effects in at most 3 draws (today 10-40); the phone's 400 a frame and no frame over 33 ms hold.
- Scars: 12 / 8 / 4 / 0. Extra time: 0.5 s at most, none under Reduced motion.

## Sessions (Part 2)
Each: Plan Mode on `track/vfx` (merge main first); lint, type-check, unit tests and the smoke check after each
change; the quick check at its end; HANDOFF; tag `vfx-N-done`. "Phone" marks the owner's phone check.

| # | Session | Does | Visible change | Done when |
| --- | --- | --- | --- | --- |
| VFX-5 | Attack lunges (Part 1) | as planned; the lean and afterimages as helpers the runner can call | lunges | as planned. Phone |
| VFX-7 (done 2026-10-27) | The plan | Part 2, with research; the owner's answers | none | merged |
| VFX-8 | Anims as data | battleAnims.json (schema, types, checks); logic/battle-anims.js (resolver, `hitTier`, `koAhead`, the timeline, the gates, the flash limiter) with tests and a snapshot; the runner with today's 3 choreographies and miss, Guard and blocked as legacy families; the tap that skips; Flashes reaches the battle; the debug-log line; the look tool, first version | none, but the tap skips and Flashes off works | `{dur, hit}` equal for 122 moves x 8 outcomes; films before and after equal; the golden record untouched; the quick check's battle steps (4x speed) rechecked |
| VFX-9 | One draw for effects | the atlas, the instanced pool, cutout drawing, the budgets; rings, dust and beams into GL; `uHit`; fixed light keys; the `uCA` pulse | rings sit in the scene; no CPU flash redraws | a move's effects in at most 3 draws (gpu counters); rig uploads down (`rigStats`); frame time not worse. Phone |
| VFX-10 | Effect art | tools/build-battle-anims.py and the strips; ramps (texture and data); the texel rule; 24 fps steps; erosion; the Studio's previews per ramp | every particle redrawn | `--check`; an Edit pixels round trip; the contact sheet. Phone (the repaint list) |
| VFX-11 | Families x types | the 16 families and their short variants; the type kits; every move's `anim` and the Moves editor's dropdown; beams and projectiles in GL; effect lights; spread and aimed moves | every move by family and type | the snapshot remade on purpose; contact sheets of all 122. Phone |
| VFX-12 | Battle effects in the Studio | the editor on the battle preview (steps, scrubber, tiers, ramps, cells, budgets; Part 1's dials); more preview outcomes | Studio | check-studio-github.py; the Studio self-test's row |
| VFX-13 | Hit tiers | the tier table; resisted, x4, KO and last-KO looks; the rhythm of multi-hits; drain, heal, recoil; misses per family | hits read by tier | tier tests; films. Phone |
| VFX-14 | Statuses and stats | the lasting looks, "sharply", Protect, the shield dome, Soaked, Fork, the delayed hit, stones, glints (with UI-16b's events if they have landed) | statuses visible | the golden record untouched; Calm read if UI-16a has landed. Phone |
| VFX-15 | The stage | moods, the row wave, heat, weather on the stage, scars | the stage reacts | decal cap tests; frame budget on the Graphics bench. Phone |
| VFX-16 | Battle flow | the VS splash; send-out per pyramid; the recall beam; catch; faint and bots' faint; level-up, victory, defeat; items used; XP | the flow | films; Reduced motion seen in each. Phone |
| VFX-17 | Signature scenes 1 | `propWorldItem`, the stamp, the +0.5 s rule; the 12 power 100+ scenes and about 6 more | first scenes | storyboards approved first; films. Phone |
| VFX-18 | Signature scenes 2 | the other 38 (split in two if it runs long); the bots' and the boss's specials | every scene | films. Phone |
| VFX-19 | Move sounds | music.json's battle sounds, the noise voice, family x type, hurt sounds, the Studio's Sounds tab | sounds | check-sound.py fingerprints. Phone (listen) |
| VFX-20 | Phone pass | tuning from the owner's phone notes, the quality ladder, a flash audit of filmed frames, the old 2D effect code and types.json `fx` removed (Ask me before), docs; tag `vfx-done` | tuning | the owner's phone log |

## Bugs found (VFX-7) and where they're fixed
- Flashes doesn't reach the battle's flash, the impact frame, the chromatic flash or the wipe (VFX-8).
- The selection and target rings divide by `R.k2`, which no rig has (BS 1379; B3 228 uses `R.k`), so they never
  draw (VFX-8, seen on screen first; turning them on is an Ask me before).
- `an.t = M.t` (BS 1917) writes into the engine's event; the runner passes the type itself (VFX-8).
- "Dynasty" and "Retail" aren't types (BS 1798, 2133), so those bursts fall back to None (VFX-11).
- The Studio's particle picker misses the sprites of 7 types (data-editors.js 924) (VFX-10).
- Under Reduced motion the tags still pop: `kind === 'tag'` never matches 'tag crit' (B 568) (VFX-13).
- A stat drop plays the rising sound: sound.js 643 reads `an.n` and `an.down`, the engine sends `up: false` (BE
  466-469) (VFX-14).
- Any status but par and slp shows flames, a broken part's too (BS 2188) (VFX-14).
- Level-up always plays on slot 0: the stage reads `an.si`, the engine sends `uid` (rules.js 793); mapped from `ev.s`
  on the stage side (VFX-16).
- The XP bar moves a line late: the `xp` line's snapshot is taken before the XP is added (BE 842): an engine change,
  its own commit, the golden record remade alone with the end states equal (VFX-16).

## Fits with other tracks
- **UI track, Part 2:** UI-13 retunes types.json's colours (the ramps are data of their own; light colours follow the
  types); UI-15, UI-16b and UI-17 own the HUD side (tags, blips, pips, banners, the boss banner, the HUD's catch and
  level-up bursts) and edit battle.js; both sides read the same events, and `hitTier` and `koAhead` are shared.
  Rule 9 is the Calm rule ui-track.md asks VFX-5/6 for. The UI plan's "hit-stop stays only on crits, KOs and
  super-effective hits" ("Alive, without clutter") is open: see Ask me before.
- **RL-14b** (bosses, shield phases, the `join` intro): the shield dome and the boss's phases build on it.
- **Phase 20** (renderer): the atlas through `gpuTexture`, the programs in the warm-up, `spriteI` with `uHit`, fixed
  light keys for Steady lamps, the row wave on the Medium precision pass's highp list.
- **Characters track:** battle trainers may be redrawn (throw poses); the VS splash uses portraits, not the battle
  sprites.
- **Sound track:** move sounds in music.json and its Studio tab; check-sound.py's baseline.
- **Water track** (WA-7): ripples and splashes on battle water.
- **The quick check** plays battles at 4x speed (check-quick.py 778-786): the tap that skips changes its timing, so
  VFX-8 rechecks those steps.

## Risks
- The phone: more drawing. The pool must lower today's draws, and every session measures (gpu counters, the Graphics
  bench, the debug log's slow-frame causes).
- In GL, effects get depth of field, ink, bloom and the impact frame's two-tone: judged on films in VFX-9.
- battle-stage.js and battle.js are shared with UI-15, UI-16b, UI-17 and RL-14b: merge main at each session's start.
- Films need Math.random seeded and the battle's quality locked.
- Placeholder art can look made by a program: the owner's repaint, after the contact sheet.
- Props: big models cost draws; with 3D props off, scenes fall back to their family.
- 56 scenes are a lot of content: storyboards first, two or three batches.
- Real brands: generic objects only.

## Not taken
- Another effects runtime (Effekseer and the like): the custom renderer stays.
- GPU particles by transform feedback: a few hundred CPU particles in one instanced draw are enough.
- Motion blur and soft glows: they fight the pixel art.
- Showdown's CC0 effect images: soft and high-resolution, another style.
- Snapping positions to a pixel grid: the camera moves smoothly, so it buys nothing; time is stepped instead.

## Ideas for later (not in these sessions)
- A "Simple effects" row (Pokémon's Battle Effects Off), if Faster's short variants aren't enough.
- Trainers reacting (flinching at a hit, cheering a crit), after the characters track's battle people.
- An evolution scene in the battle (today a sheet after it).
- Weather-flavoured moves (bigger splashes in rain, fire hissing in it).
- A shorter repeat of a signature scene used again in the same battle.
- Haptic patterns per tier (Android only, `buzz`).

## Ask me before (Part 2)
- Hit-stop on normal hits: today's small one, 20-90 ms by damage (recommended: Sakurai's research, and it costs under
  0.1 s), or the UI plan's "only crits, KOs and super-effective hits".
- Turning the selection and target rings on (they have never drawn).
- The KO's extra cell and the last KO's freeze (about 250 ms).
- Each signature scene's storyboard; a shorter repeat of one within a battle.
- The ramp table and the Bureau's look.
- The VS splash's art and titles.
- The repaint list, and when the sheet is frozen.
- Removing types.json `fx` and the old icon particles.
- How strict the flash limiter is.
- Any other move getting longer; a full-scene darken on big moves; scars outliving the battle; haptic patterns.

## Sources (Part 2)
- https://github.com/pret/pokeemerald/blob/master/data/battle_anim_scripts.s
- https://github.com/smogon/pokemon-showdown-client/blob/master/play.pokemonshowdown.com/src/battle-animations.ts
- https://github.com/pagefaultgames/pokerogue/blob/beta/src/data/battle-anims.ts
- https://realtimevfx.com/t/overwatch-fx-pharah-rocket-study/758
- https://fullfrontal.moe/sakuga-expresso-16-arcadia-of-my-youth/ (Kanada's effects)
- https://animetudes.com/2021/07/09/the-kanada-style-now/
- https://gamedev.net/shaderlab/14-sprite-dissolve-effect/
- https://forum.godotengine.org/t/how-can-i-apply-a-dithering-effect-to-a-gradienttexture/143687
- https://www.unrealengine.com/en-US/spotlights/octopath-traveler-s-hd-2d-art-style-and-story-make-for-a-jrpg-dream-come-true
- https://en.wikipedia.org/wiki/HD-2D
- https://nintendowire.com/news/2022/12/12/this-week-in-sakurai-12-5-12-11-fine-tuning-hit-stop-and-cheating-the-system/
- https://infovore.org/?p=5275 (Vlambeer's screenshake in Nuclear Throne)
- https://blakecrosley.com/guides/design/balatro
- https://phaser.discourse.group/t/wip-recreating-earthbound-s-battle-backgrounds-with-webgl-phaser-3-tutorial-series/15498
- https://github.com/alphagov/guide-to-wcag/wiki/2.3.1
- https://bulbapedia.bulbagarden.net/wiki/Battle_effects
- https://bulbagarden.net/goto/post?id=1810755 (VS screens inside the transition; a community note)
- https://codemanu.itch.io/particle-fx-designer

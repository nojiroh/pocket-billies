# VFX track: smears for throws and attacks

Branch: track/vfx

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
- **VFX-4** the impact frame: one or two frames of a two-tone flash with radial lines from the hit point, on the
  pyramid's impact and on crits. The crit speed lines move from the 2D canvas into GL.
- **VFX-5** attack lunges: the lean (`uShear`) driven by the lunge's speed, one or two afterimages of the rig's
  billboard (its texture exists already); dash moves reuse the ribbon.
- **VFX-6** tuning and docs: Studio dials (ghost count, colours, ribbon length, stretch), a debug-log line saying
  which smears ran and at which quality (never save data), HANDOFF.

Each session: lint, type-check, unit tests and the smoke check after each change; the quick check at its end; tag
`vfx-N-done`.

## Ask me before
- Changing the throw's total time, or easing the send-out and the mail coin differently from the catch (VFX-1 eases
  all three the same).
- Adding the smears to the opening's throws (cutscene/opening.js).
- Anything that makes an attack longer (VFX-5 adds no time).

## Sources
- https://en.wikipedia.org/wiki/Smear_frame
- https://hal-iogs.archives-ouvertes.fr/hal-04576817v1 (SMEAR, SIGGRAPH 2024)
- https://kotaku.com/this-is-not-an-overwatch-glitch-1777612546
- https://github.com/cjacobwade/HelpfulScripts/tree/master/SmearEffect
- https://polycount.com/discussion/comment/2344470 (Guilty Gear Xrd trails)
- https://realtimevfx.com/t/vfx-basics-mesh-soulercoasters/1987
- https://gamineai.com/blog/pixel-art-combat-fx-hitstop-smear-frames-impact-timing-2026
- https://godotshaders.com/shader/screen-sampled-black-and-white-manga-hit-impact-post-process-shader/

# Phase 07 plan: portraits from a part kit, edited in the Studio

Started 2026-10-18/19 on the branch `phase-07-portraits`. The phase itself is [07-portraits.md](07-portraits.md); this
file records what the owner decided since, what exists, the data format and what is left. Status is at the bottom.

## Decisions the owner made
- **Size: 64×64 art pixels** (the phase file's "ask me"). 96 was also cut and tried; 64 was chosen.
- **The face kit is AI-drawn part sheets, cut by a tool** (the phase file's "how the face kit is made"): 15 sheets
  of heads, hair, hats, clothes, eyes, brows, noses, mouths, face marks and accessories on magenta, in
  `tools/art-source/portrait-kit/`. The sheets' "pixels" are uneven (5-9 source px each); the tool resamples every part
  to one shared grid, so nothing mixes pixel sizes.
- **The body stays still; the head moves, and NOT on the pixel grid.** This replaces the phase file's "whole pixels
  only (no rotation, scaling or sub-pixel movement)" and "1 px bob/shake/pop". The owner asked for "more dynamic,
  more natural". The head and everything on it is drawn as one layer and moved with springs: sub-pixel offsets and
  rotation round the neck. Side effect, accepted in the prototype: rotated pixels look slightly jaggy at angles.
- **Everything must be easy to edit in the Studio** (a new Portraits section), so all placement numbers live in
  `game/data/portraits.json`, none in code.
- Old system: untouched for now; deleting it stays an "ask me before".
- Wiring into dialogue, battle and trainer card: later, on top of phase 06's dialogue box (its portrait slot).
  Note: 06's slot is 96×96 CSS px; a 64 px portrait there is a 1.5× scale. Use 64×64 (1×) or 128×128 (2×) in that
  slot, or draw the portrait to a canvas with smoothing off at the slot's device pixels (the head is sub-pixel
  anyway, the body is not).

## What exists (on the branch)
| Path | What |
|---|---|
| `tools/art-source/portrait-kit/*.png` | the 15 source sheets (never shipped) |
| `tools/art-source/portrait-kit/kit.json` | each sheet's kind, grid and the id of every cell (null skips a cell) |
| `tools/slice-portrait-kit.py` | cuts the sheets: `python3 tools/slice-portrait-kit.py [--reset]` (Pillow, numpy, scipy) |
| `game/art/next/portraits/*.png` | 311 pictures at 64 px, made by the tool |
| `game/data/portraits.json` | the editable data (below); registered in `index.json` after `wardrobe` |
| `game/data/schema/portraits.schema.json` | its schema; `npm run check:data` validates it and checks every picture, part and frame it names exists |
| `game/types/game-data.d.ts` | `PortraitData`, `PortraitHead`, `PortraitItem`, `PortraitExpression`, `PortraitFace` |
| `tools/art-source/portrait-kit/prototype/` | the prototype renderer and test page (reference only, see below) |

Running the tool again re-cuts every picture but **keeps the data**: only parts the data doesn't have yet are added
with first-guess placement. `--reset` throws the data away and starts from the guesses. A new sheet: add it to
`kit.json` (a known `kind`), run the tool, then place the new parts in the Studio.

## The data format (`portraits.json`)
All positions are art px in the 64×64 frame.

- **`heads.<id>`**: `img` (the head above the chin) and `body` (neck stub and shoulders), drawn at `x, y` and
  `x, bodyY`. The points parts hang from: `cx`, `crown`, `forehead`, `eyeY`, `noseY`, `mouthY`, `neck` (the pivot the
  head turns round), `bottom`, `eyeGap` (middle to each eye), `earL`, `earR`, `earY`, `lobeY`. `top` picks the clothes
  cut (`s`/`m`/`l`) that fits the shoulders. `nudge.<itemId> = [dx, dy]` moves one part on this head only.
- **Anchor points** a part can use (`at`): `crown`, `forehead`, `eyes`, `nose`, `mouth`, `neck`, `bottom`, `eyeL`,
  `eyeR`, `earL`, `earR`, each `(cx or the x named, the y named)`. Pairs (a part with `img: {l, r}`) use a pair anchor:
  `eye` (cx∓eyeGap, eyeY), `brow` (same x, just above the eyes: the bottom of the brow sits 1 px above the open eye),
  `cheek` (cx∓eyeGap, noseY), `mouthSide` (cx∓eyeGap, mouthY), `ear` (earL/earR, earY), `lobe` (earL/earR, lobeY).
- **`items.<id>`**: `slot`, `name`, `img` (one picture, a pair `{l, r}`, or clothes cuts `{s, m, l}`), `at`, `ax`/`ay`
  (which point of the picture sits on the anchor: 0..1, so `0.5, 1` is bottom centre), `dx`/`dy` (px; on a pair `dx`
  is outwards, the right one mirrored), optional `tint` (which face colour it takes), `layer: "body"` (clothes,
  necklace: never move), and for long hair `back: {img, dx, dy}` (drawn behind the body, swinging from the crown).
  Placement: `x = anchor.x - ax * w + dx + nudge`, `y = anchor.y - ay * h + dy + nudge`.
- **`slots`**: drawing order (later on top) and whether a face wears one or many: top, neck, nose, marks, eyes, brows,
  mouth, beard, face, hair, ears, hat, band, phones, eyewear. Head layer order: back hair → body → clothes → head →
  the slots in order (eyes, brows and mouth are drawn at their slot's place).
- **`eyes.<id>`**: `frames` (frame → picture, `_l`/`_r` added), `mid` (frames centred at 55% of the open eye's height
  instead of resting on its bottom: closed and happy on the lashes set), `dx`/`dy`. The eye's top is
  `eyeY - round(openH / 2)`; open/half/... frames sit on the open eye's bottom. The "lashes" set has 12 drawn frames
  (open, half, closed, look_l, look_r, up, down, happy, angry, narrow, wide, bored); the 12 single styles have open
  plus half/closed/happy made by the tool. `eyeFallback` maps a frame a style lacks to one it has.
- **`mouths.<id>`**: two sets (`lips`, `simple`), each a map from mouth frame (closed, neutral, smile, grin, o, shout,
  talk_a/b/c, angry, frown, kiss, wince, smirk, tongue) to a picture. Editing is choosing a picture per frame.
- **`expressions.<tag>`**: idle, happy, sad, angry, surprised, hurt, smug, the tags dialogue lines carry
  (`[happy]`). `eyes`, `mouth`, `browTilt` (px the inner brow ends move down: angry +2, sad -2; drawn by shearing the
  brow column by column), `browLift`, `blush`, `talk` (mouth frames while talking), `pose` [x, y, degrees] where the
  head settles, `sway` (idle motion ×), `hit` (a one-shot motion on entering: bounce, shake, jolt, recoil, nod).
- **`motion`**: global strengths: `sway`, `talkSway`, `nod`, `nodChance`, `hits`, `hairLag`, `follow` (head
  following the pointer or a glance). 1 = as tuned in the prototype, 0 = off.
- **`palettes`**: skin, hair, iris, cloth swatches for the Studio.
- **`faces.<id>`**: ready-made faces: `head`, `eyes`, `mouth`, `items` (part ids), `colors` (skin, hair, iris, top,
  hat, acc; no skin = the head's own colour). Four samples: juniper, rex, ada, gus. Later people/trainers can point
  at a face id.

Tinting (prototype `tinted()`): a gradient map built from the chosen colour (shadow, base, light) applied by the
part's own luminance; outline pixels (luminance ≤ 60) become a deep shade of it. `skin` works the same;
`iris` only recolours the grey mid-tones of an eye (whites, pupils and lashes stay).

## How the head moves (from the prototype, to keep)
Per frame: three layers drawn at 64 px (back hair, body, head), then composited at the screen's pixel size: body
as is; head and back hair translated by the pose and rotated round `(cx, neck)`; back hair also rotated round
`(cx, crown + 2)` by its own lagging angle. Pose = damped springs (x: k 70, y: k 90, angle: k 60, damping ~0.5)
toward a target = expression pose + layered slow sines (sway) + pointer/glance follow + a 7° tilt for 0.9 s after a
"?". Impulses: a word start nods (55% chance), "!" a big nod, expression hits (jolt, bounce, recoil, shake as a
decaying 11 Hz wobble). Blink every 2.6-5.2 s (half, closed, half over 200 ms); idle glances every 5-9 s (lashes
set) with the head following; mouth frames ~8/s while text types, shut on punctuation pauses. Reduce motion: no
head motion, blinking and talking stay.

## The prototype (reference only)
`tools/art-source/portrait-kit/prototype/portrait.js` (renderer, tinting, expression table) and `portrait-lab.html`
(the test page: picker, dialogue with tags, head rig in `stepPose()` and `loop()`). It predates `portraits.json`:
its placement constants (HAIR_PAD, HAT_BRIM, the beard/accessory positions) are what the tool wrote into the data as
first guesses, and it read a different manifest. Port the logic, not the file. A published copy of the page was
shown to the owner in chat ("Portrait Lab").

## What is left
1. **Renderer, game side.** `game/js/logic/portrait-layout.js` (Node-safe, no DOM: data + face + frame state +
   picture sizes → a list of draws `{img, x, y, tint, layer, shear}`, plus the spring step for the head pose), and
   `game/js/portrait-art.js` (loads pictures with `artImg('next/portraits/<img>.png')`, tints with a cache, draws the
   three layers, a small player: `setExpression`, `say(text)` with tags, pointer look). Add both to `game/index.html`
   and `studio/index.html` as modules and run `npm run modules`. Give it a hook so the Studio can hand in unsaved
   pictures (`studioState.artDirty`, keys `art/next/portraits/<img>.png`).
2. **Studio section "Portraits"** (`studio/js/portraits-editor.js`, `SECTION_LIST` + group "People & story"), in
   the style of `robots-editor.js`: list of heads/parts/eyes/mouths/expressions/faces on the left; a live animated
   preview with expression buttons and a talk line; click a part in the preview to select it; drag or arrow keys
   nudge `dx/dy` (Shift: this head only, into `nudge`); drag the head's lines (eye, nose, mouth, crown, neck);
   fields for anchor/align/tint/slot; mouth frame pickers; expression table (eyes, mouth, brows, pose, sway, hit);
   motion sliders; palettes; faces editor; "replace picture" via `pickFile` + `markArt`. Edits go through
   `changed()`/undo like every section.
3. **Tests** `tools/test/portraits.test.mjs`: every head × expression × eye style × mouth set resolves to pictures that
   exist (read PNG sizes from their headers) and lands inside the frame; anchors sit inside their head (crown <
   eyeY < noseY < mouthY < neck; earL < cx-eyeGap; earR > cx+eyeGap); the spring step settles. The old
   `expressions.test.mjs` stays until the old system goes.
4. **Wire-in** (after 06-3): the dialogue box slot, then battles and the trainer card; then ask about deleting the old
   system.

## Known rough spots in the cut art (fix in the Studio or by re-drawing)
Earrings are tiny at 64 px; stubble is faint; the hood and some long hair need small nudges on some heads; a few
magenta specks remain near hair ties; under a high collar (suit) a tilted jaw meets the collar.

## Status (2026-10-19)
Done: kit, tool, pictures, data, schema, types, data checks. Checked: lint, typecheck, unit tests (72), check:data,
format:check. Not run: the smoke check (only a data section was added; the owner prefers no headless graphics runs).
Next: step 1 above.

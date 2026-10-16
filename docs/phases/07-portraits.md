# Phase 07 - Portraits (animated eyes and mouth)

## Goal
A new portrait system, replacing the old one. Only the eyes and mouth animate; the head may move a little. 32-bit pixel art (full colour with transparency).

## Verify first
- The legacy build builds people from layered wardrobe pieces and crops a bust for the portrait; the README says faces have blink, happy, surprised, sad, angry and talking expressions. Confirm how portraits work in the current build and what depends on them (talk.js, cutscene.js, story.js, opening.js, ui.js).
- Dialogue lines already carry expression tags ([happy], [angry], [sad]). Keep that tag mechanism.
- Proof-of-concept finding (one AI-generated 3x2 expression sheet of Blake, measured from a JPEG): hair and jacket were nearly identical across the top three cells (under 0.3% of pixels differed) but differed by about 9-14% in the bottom three, so generators do not keep cells pixel-aligned. Do not cut expressions straight out of generated sheets. Build one base per character and draw the face pieces separately.

## Design
- Draw order: body, head (skin, ears, hair back, headset), eyes (with brows), mouth, front (bangs, glasses frames and anything covering the eyes).
- Per character: `body.png`, `head.png`, optional `front.png`, and `portrait.json` (size, eye anchor, mouth anchor, eye style, eye colour, brow colour, mouth style).
- Shared face kit (drawn once, reused by every character): eye styles (about 3-4 styles, including one that works behind glasses) with frames open, half-blink, closed, happy, sad, angry, surprised, hurt; mouth styles with closed, smile, frown, "o", talk A/B/C, angry line, wince. Iris and brow colours are tinted per character.
- Expressions are combinations of an eye frame and a mouth frame. Tags map to expressions: idle, happy, sad, angry, surprised, talking, hurt.
- Motion, whole pixels only (no rotation, scaling or sub-pixel movement): idle head bob of 1 px about every 1.2 s; random blink every 3-5 s (about 0.2 s); while text types, mouth cycles about 8 fps and the head nods 1 px per word or line, then closes; angry = 1 px shake; surprised = 1 px pop; hurt = 1 px shake and wince. A "reduce motion" setting disables bob and shake (blink and mouth remain).
- Size: propose a pixel size (default 64x64 art pixels, integer upscale) and ask me.

## Tasks
1. Audit the current portrait system and list what to delete (old face pieces, bust crops, expression code) once the new one works.
2. Implement the layered portrait renderer, the data format and the tag-to-expression mapping, plus the talking and blink loops.
3. Build the shared face kit (by hand or from an AI draft cleaned up in pixel art) and a tool that tints it per character.
4. Make a tool (a Studio screen) to import a character's base art, split it into body/head/front layers, drag the eye and mouth anchors, preview every expression and animation, and set colours. The base portraits come from me (AI-generated or drawn) with the eye and mouth areas blank; a skin-tone fill script may be needed to clean them.
5. Replace all uses of the old portraits, then delete the old system.
6. Tests: render every portrait x expression; anchors inside the head; talking stops when text ends; reduce-motion respected; frame-time check on a phone.

## Ask me before
The portrait pixel size; how the face kit is produced; deleting the old system.

## Done when
Dialogue, trainer cards and battles use the new portraits, old system removed, Studio tool works, tag `phase-07-done`.

## First reply
Same four items as phase 01, plus a proposed portrait size and a mock layer layout for one character.

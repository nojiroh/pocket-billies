# Phase 06 plan: the UI look and structure

Drafted 2026-10-18 from a look at the current build (main at c3b5de9, phone size 390×844, light theme) and its CSS.
No code changed for this plan. The phase itself is [06-ui-structure.md](06-ui-structure.md). It keeps the alpha 0.5
look and builds on it: same fonts, colours, glass and pixel art, with more room, one motion system and quieter
messages. Work starts from this file once the decisions at the bottom are answered: say "start 06-1".

## The direction in one line
A calm, warm pixel-glass UI that breathes: fewer, roomier panels; one obvious action per screen; small springs and
idle life everywhere; messages that appear at the edge, say their piece and leave.

## What the UI looks like now

### Keep (this is the identity)
- **Pixel type.** Pixelify Sans for everything, Tiny5 only for the logo. Gold heading dash, pixel sparkles.
- **Warm cream light / deep purple dark.** Text `#2e2140`, glass `rgba(255,251,242,.7)`, gold `#ffda7a → #f2b84b`.
- **Frosted glass panels** over the pixel sky and the world, with soft layered shadows (`--g-sh`, `--g-sh2`).
- **A colour per screen** in the bottom bar (`--t-walk`, `--t-map`, `--t-team`, `--t-ledger`, `--t-bag`, `--t-profile`).
- **Touch answers.** Buttons lift and press in; screens arrive with a spring (`--spring: cubic-bezier(.3,1.6,.5,1)`).
- **Type pills** (Fire, Water, Grass) and the toast with the spinning coin.
- The opening cutscene's starter card (glass sheet, arrows, big gold "Choose" button) is the best screen today:
  roomy, one action, the art in charge. Other screens should feel like it.

### Fix
| What | Seen where | Why it matters |
|---|---|---|
| Six CSS files layered on each other (`style` 90 KB, `screens` 70 KB, `polish` 30 KB, `v05` 30 KB, `battle`, `loader`). 0.5 restyles the older parts instead of replacing them | all | Every change fights older rules; two toast styles, two button styles (pixel bevel in polish, glass in v05) |
| Eight different corner radii (2, 6, 8, 10, 12, 14, 999 px, 50%) next to the 0.5 tokens `--r1..3` | all | Edges don't match from screen to screen |
| Tight padding: the most used values are `10px 12px` and `8px 10px` | cards, lists, settings | Feels cramped on a phone; little room to breathe |
| Long text set in the pixel font, 15.5 px, full width | starter cards, battle log, Guide | Pixel fonts tire the eye in paragraphs; the starter card has five lines of description plus two lines of type facts |
| A choice opens right after loading: `showPendingWindows` (hatch, learn a move, evolve) runs 500 ms after boot, so the evolution sheet covers a blurred world before you've seen it. (Corrected: modals already queue one at a time, ui.js `modal`/`nextModal`; they don't stack) | town after loading | The first thing a player sees is a wall, not the world |
| 72 `@keyframes`, several doing the same thing under different names (`pop`, `nwPop`; `rise`, `nwFadeUp`, `csUp`; `breathe`, `nwIdle`), reduced-motion handled per file | all | Motion feels different from screen to screen and is hard to tune |
| The battle text log stacks every line at the bottom of the screen | battle | Reads like a log file; the important line isn't the loudest |
| Loader tip still says real steps move you along | loader | Stale since phase 08 Part A (steps removed) |
| The test boot skipped the opening cutscene | start | Fixed in PR #19 |

## The look

### Space
- One spacing scale, as tokens: `--s1 4px · --s2 8px · --s3 12px · --s4 16px · --s5 24px · --s6 32px · --s7 48px`.
- Defaults: panel padding `--s5` (24 px; `--s4` on screens narrower than 360 px), gap between cards `--s4`, between
  sections `--s6`. Screen side gutter 16 px. Bottom space for the nav bar plus the safe area.
- **One main action per screen**, gold, at the bottom within thumb reach. Everything else is the quiet button style.
- **Less on a card.** A card shows name, level, types and one bar; the rest moves to the details sheet. Descriptions get
  two lines and a "More" tap.
- Separate with space and surface colour, not lines. Keep the dashed rule only as a section ornament.

### Shape and depth
- Radii: `--r1 12px` (chips, inputs, small buttons), `--r2 16px` (cards, buttons), `--r3 22px` (sheets, panels),
  `--pill 999px` (type pills, toasts), circles for avatars. Nothing else.
- Three depths only: **flat** (inside a panel), **raised** (`--g-sh`, cards and buttons), **floating** (`--g-sh2`,
  sheets, toasts, the nav bar). Shadows stay tinted purple, never grey.
- Keep the glass blur, but at most two glass layers on top of each other; a sheet over a sheet gets a solid panel.

### Type
- Pixelify Sans stays the voice: headings, names, buttons, labels, numbers.
- **Paragraphs** (descriptions, dialogue longer than two lines, the Guide, help) switch to Chakra Petch, which is
  already in `game/fonts`, at 15–16 px with line height 1.5 and a 34-character-per-line minimum. This is a choice for
  you (see the decisions); the fallback is Pixelify Sans at 16 px with more line height.
- Size scale with `clamp()`: caption 12–13, body 15–16, title 20–24, screen title 28–34, so text grows on wide screens
  without breakpoints.

### Colour
- Keep today's palette. Each screen's colour (`--t-*`) also tints that screen's heading dash, selected tab and focus
  ring, so screens feel distinct without new colours.
- Gold is only for the main action and rewards (money, Prime, evolution). Red only for real danger.
- Contrast checked for both themes on text over glass (WCAG AA, 4.5:1 for body text).

## Motion: alive, never in the way

One small motion file replaces the 72 keyframes. Everything uses transforms and opacity only (smooth on phones).

| Token | Value | Use |
|---|---|---|
| `--m-fast` | 140 ms | presses, toggles, hovers |
| `--m-base` | 240 ms | panels, sheets, list items |
| `--m-slow` | 420 ms | screen changes, celebrations |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | things arriving |
| `--ease-in` | `cubic-bezier(.4,0,1,1)` | things leaving (always faster than arriving) |
| `--spring` | today's `cubic-bezier(.3,1.6,.5,1)` | presses releasing, pops, sliders settling |

The motions (each one named once, used everywhere):
- **press**: scale to .96 on press, spring back on release. Every button and tappable card.
- **enter**: fade plus 8 px rise; list items stagger by 35 ms (at most 8 items, the rest arrive together).
- **sheet**: slides up with the spring, the backdrop fades; drag down to close.
- **pop**: for new things (an item, a badge, Prime): scale .8 → 1 with the spring.
- **idle**: Billies on cards and portraits breathe (1 px, 3.2 s), at a random phase so a team never moves in step.
- **count**: numbers roll to their new value (money, XP, HP) instead of jumping.
- **nudge**: wrong input shakes 4 px twice, no red flash.
- **done**: a check mark draws itself for saves and successful actions.

Forms feel alive:
- Inputs lift 1 px and get a soft glow in the screen's colour on focus; the label floats up while typing.
- Toggles slide with the spring; chips (like the dressing room's Build options) pop when picked.
- Sliders (part sizes in phase 16) wobble once when released and show the value in a bubble while dragging.
- The Save button breathes gently only when there are unsaved changes.

Reduced motion (the system setting or a game setting): every motion becomes a 120 ms fade; idle and stagger stop.

## Messages: present, never obtrusive

| Kind | How it shows | Example |
|---|---|---|
| **In place** (first choice) | Feedback where the action happened: a number floats up, a badge dot appears, a card shimmers | +$120 above the money chip; a dot on Bag |
| **Toast** | A small glass pill at the top under the top bar, never over buttons; one at a time, 2.5 s, longer only for long text; swipe up to dismiss; same kind within 3 s merges ("3 items found") | "Saved", "Kidling learned Leaf Toss" |
| **Inbox** | Things that can wait (letters, friend requests, pending windows) collect behind a dot on the trainer portrait instead of opening on their own | today's `showPendingWindows` on load |
| **Sheet** | Only for choices the player must make: evolve, trade, spend, delete, quit a battle | "Let it evolve / Not yet" |

Rules:
- Never more than one sheet on load. The evolution choice waits until the world is visible, then slides in.
- No sounds or vibration for routine messages; only for battles, evolution, Prime and catches.
- Battle text: one line at a time in the dialogue box, the newest line loudest, earlier lines one tap away.

## Structure (how it is built)

Recommended: **Lit** web components (about 6 KB, escapes by default, works with Vite and the current plain JS, the same
components run in the game and the Studio). Fallback: plain lit-html templates with the same tokens. Phase 06 says to ask
before adopting a library, so this waits for your answer.

- `game/ui/tokens.css`: every token above, light and dark. The only place colours, sizes, radii and timings live.
- `game/ui/motion.css`: the eight motions.
- `game/ui/components/`: `pb-button`, `pb-panel`, `pb-sheet`, `pb-card`, `pb-tabs`, `pb-pill`, `pb-toast`,
  `pb-dialogue` (portrait slot sized 96×96 for phase 07, typing hook for the mouth), `pb-stat-bar`, `pb-field`.
- `game/ui/screens/<screen>/`: each screen's component, its styles and its test.
- Components size to their container (container queries), so a card looks right in the phone column, the wide-screen
  side panel and a Studio form.
- A **gallery page in the Studio** shows every component in every state (empty, full, long names, dark, 320 px wide).
- The old CSS files shrink as screens move over and are deleted when empty.

## Removing the painted battle stage (owner, 2026-10-18)
The 3D stage ("Where I stand") has replaced the old painted backdrop battle, so the painted stage goes, together with
the classic battle HUD. This lands in session **06-3**, with the battle screens.

| Question | Answer |
|---|---|
| Battles inside rooms (today they fall back to the painted stage: `battle3dWanted` in battle-3d.js skips `sc.room`) | The 3D stage works in rooms too: the room is the stage, like outdoors |
| No 3D scene ready yet (a battle starting while a map loads) | The battle waits behind its intro wipe until the scene is ready; no painted fallback |
| Settings → "Battle HUD: classic cards" | Removed too; one battle HUD, the in-scene plates |
| Settings → "Battles happen: Where I stand / Painted stage" | Removed; the `battleStage` and `battleHud` preferences are dropped from saves |

To check when it lands (verify, these are from a first look):
- battle-stage.js draws the painted stage **and** still directs the 3D camera and draws move effects; only the painted
  parts go.
- `game/art/battle/` (39 files, about 1 MB): the clouds `battle/cloud_0..4.png` are also used by walk-view.js and stay
  (or move to a shared folder); the painted stage's grounds, walls and foregrounds go.
- `game/art/background/` is used by the title's painted landscape and the Studio (world-rules-art.js), so it stays.
- The in-game full test's step "Battle on a painted stage" (self-test.js) and the painted-stage branch in its battle
  check go; the quick check and smoke must not ask for the painted stage.

## Sessions

Order follows the roadmap's priority on Billies and robots: the screens they need come first.

| Session | Does | Ends with |
|---|---|---|
| **06-1** | Audit (refresh the numbers above), tokens.css, motion.css, the renderer (after your decision), button, panel, sheet, pill, toast; the new message rules (toasts, inbox, one sheet on load); loader copy | Tokens in use by the bottom bar and toasts; no visible change except calmer messages |
| **06-2** | Billie card, details sheet with parts, sizes, weight and the Prime badge (phase 16), Team screen, starter pick | Team and details on the new look; UI tests for them |
| **06-3** | Dialogue box with portrait slot, battle menus and battle text, Bag, the robot builder shell (phase 17); remove the painted battle stage and the classic HUD (section above) | Battle reads one line at a time; every battle on the 3D stage, rooms included |
| **06-4** | Guide, Trainer card, Settings, shops, dressing room, friends; Studio gallery; delete the emptied CSS; accessibility pass | All screens moved, no innerHTML with untrusted values, tag `phase-06-done` |

Each session: lint, type-check, module check, unit tests, the UI tests for the screens it moved, screenshots of those
screens at 390 px in both themes attached to the handoff.

## Your decisions (2026-10-18)
| Question | Answer |
|---|---|
| Rendering | **Lit components**. Lit is bundled once into `game/vendor/lit.js` (a script in tools/ makes it from the npm package), so the game still runs from `npm run dev`, the build and a plain `python3 -m http.server` |
| Long text | **Chakra Petch** (already in game/fonts). Pixelify Sans stays for names, headings, buttons and numbers |
| Things that can wait | **Inbox dot** on your trainer portrait. Only real choices (evolve, learn a move, trade, spend) open a sheet, one at a time, after the world is showing |
| codex/playable-ui-graphics-poc | **Delete.** Saved as the branch `archive/codex-playable-ui-graphics-poc` (tag pushes and branch deletes are refused from Claude's sessions); delete the codex branch on GitHub |
| When | Start 06-1 now |

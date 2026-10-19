# Roadmap

Do the phases in order. Each phase is one session (or a few for the big ones). Every phase follows docs/TESTING.md (phase 13): where its tests go and what must pass before it ends. Work-time estimates are rough guesses of Claude's working time, not calendar time, and exclude my testing. The vision is in docs/VISION.md.

| # | File | Goal | Rough work time | Depends on |
|---|------|------|-----------------|------------|
| 00 | 00-finish-current-work | Stable checkpoint, tagged `baseline` | unknown | none |
| 01 | 01-baseline-and-bug-fixes | Tests green, duplicates fixed, CI | 1-2 h | 00 |
| 02 | 02-security | Firestore rules, keys, token, innerHTML, saveVersion | 2-4 h | 01 |
| 03 | 03-fresh-base-and-scope-reset | Legacy preserved, version 0.1.0 alpha, keep/rewrite/delete list, deletions | 4-8 h | 01 |
| 04 | 04-modernize-codebase | Vite, ESLint, modules, data split, TypeScript, README | 12-25 h | 03 |
| 05 | 05-internal-renaming | Clean names for code, data, concepts | 3-6 h | 04 |
| 06 | 06-ui-structure | RPG UI: one module per screen, safe rendering, dialogue box, tokens | 10-20 h | 04, 05 |
| 07 | 07-portraits | Layered portraits: animated eyes and mouth, head moves a little | 8-14 h | 06 |
| 08 | 08-classic-movement-seamless-maps-rooms | Part A: remove step tracking. Part B: seamless maps and rooms | 14-28 h | 03, 04, 05 |
| 09 | 09-props-and-terrain | Terrain textures, low-poly 32 px/m props, variants, dedupe | 15-30 h | 04, 05 |
| 10 | 10-world-map-bowl | New 3D bowl world map, clouds, simplified terrain, new layout | 15-30 h | 05, 08, 09 |
| 11 | moved to project-story | Cyberpunk city, portal, fall, arrival: now Project Story S7-S8 (archived: docs/archive/11-opening-sequence.md) | see Project Story | 07, 09 |
| 12 | 12-ranch | Customizable ranch in the starting town | 10-20 h | 08, 09 |
| 13 | 13-testing-and-debugging | Fast tests (fixtures, tiers, parallel), unit tests, simulations, lazy debug, error reports | 6-10 h | 04 |
| 14 | 14-studio | Studio performance, polish and new editors | 14-28 h | 04, 05, 06, 08, 10 |
| 15 | archive/15-game-design-and-story | Design half (core loop, tax mechanics, exploring) stays here; the story half and parody fixes are now Project Story S4 | 3-5 h doc; rest open | any (do before 16, 17) |
| 16 | 16-billies-monster-system | Slimmed roster, parts, breeding, abominations, encounters | 6-12 h prototype; 20-40 h full | 04, 05, 13, 15 |
| 17 | 17-robots | Medabot-inspired build-your-own robots and battles | 8-15 h prototype; 25-45 h full | 09, 13, 15 |
| 18 | 18-friend-trading-and-battles | Async friend battles and atomic trades (Billies, robots, parts) | 10-20 h | 02, 16, 17 |

Rough total: about 190-370 hours at a careful, gated pace (plan first, approvals, tests, tags). These are guesses, not measurements, and are probably too high: the legacy game was built in about six days (file dates run 2026-10-10 to 2026-10-15) with roughly 50 releases. Treat the numbers as upper bounds and recalibrate after phases 01 and 03 using real usage. Phases 00-05 give a stable, modern, fresh base. Look at the game on my phone before starting phase 06.

## Project Story
The opening, the story bible, the story layer and the Hazel/Blake rework are one track of their own: docs/phases/project-story.md (2026-10-19). It runs alongside the phases above; its session S6 waits for phase 19.

## Studio track
A more intuitive Studio: wide-screen layout, a shared pixel canvas, an Art workbench (sheet slicing, parts with joints and sockets, 3D model import and export) and variants in place of Golden: docs/phases/studio-track.md (2026-10-19). It runs alongside the phases above and does the art-tool half of phase 14 early.

## What "remove the walking" means
It means the FITNESS STEP TRACKING (real-world steps driving travel, hatching and pace) is removed. In-game walking with the joystick, the seamless maps and the rooms stay. That is phase 08 (Part A removes steps, Part B improves maps and rooms).

## Where the old brief went
Old 1 -> 01, old 2 -> 02, old 3 -> 04, old 4 -> 05, old 5 (seamless maps and rooms) -> 08 Part B, old 5B -> 06, old 5C -> 09, old 6 -> 13, old 7 -> 14, old 8 -> 15, old 9 -> 16, old 10 -> 18. New: 03, 07, 10, 11, 12, 17, and 08 Part A.

## If the scope is too big
Priority order: 01, 02, 03, the cheap parts of 04 (.gitignore, CI, README, tooling), the 04 data split, 05, 08, 07, 10, 11, 12, the 13 unit tests, then the 17 prototype and the 16 prototype. 06, 09 and 14 grow as needed. 15 happens early because the story and mechanics drive everything else. 18 comes last.

## Questions I want to be asked (do not decide these alone)
- Version scheme after 0.1.0 alpha and the single game name (03).
- The keep / rewrite / delete list (03).
- Lite mode: keep or remove (03).
- Which UI rendering approach to adopt (06).
- Portrait pixel size and how the face kit is made (07).
- What replaces each step-based mechanic: travel cost, encounters, egg hatching, pace, step-based unlocks and costs (08 Part A).
- Maps with several neighbours per side, or one exit per neighbour; rooms as `kind: room` maps or a separate type (08 Part B).
- Which props stay flat on purpose (09).
- Bowl layout, camera limits, central light, travel animation (10).
- When character creation happens in the opening (11).
- Ranch editing UI and whether the robot workshop lives at the ranch (12).
- The organization's name, goals and how often it appears (15).
- Breeding mode: deliberate, partly random, or both (16).
- Robots: decided 2026-10-18 (same battle system, mixed teams, body HP + breakable parts; see 17). Still open: the gem's story role, wild robots, the sim bounds (17).
- Live real-time friend battles (18).

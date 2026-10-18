# Roadmap

Do the phases in the order of the table below. From phase 05 on, the phase number is an ID (file name, tag `phase-NN-done`, cross-references), not the position: the table lists the phases in the order to do them. Each phase is one session (or a few for the big ones). Work-time estimates are rough guesses of Claude's working time, not calendar time, and exclude my testing. The vision is in docs/VISION.md.

| # | File | Goal | Rough work time | Depends on |
|---|------|------|-----------------|------------|
| 00 | 00-finish-current-work | Stable checkpoint, tagged `baseline` | unknown | none |
| 01 | 01-baseline-and-bug-fixes | Tests green, duplicates fixed, CI | 1-2 h | 00 |
| 02 | 02-security | Firestore rules, keys, token, innerHTML, saveVersion | 2-4 h | 01 |
| 03 | 03-fresh-base-and-scope-reset | Legacy preserved, version 0.1.0 alpha, keep/rewrite/delete list, deletions | 4-8 h | 01 |
| 04 | 04-modernize-codebase | Vite, ESLint, modules, data split, TypeScript, README | 12-25 h | 03 |
| 05 | 05-internal-renaming | Clean names for code, data, concepts | 3-6 h | 04 |
| 15 | 15-game-design-and-story | Design doc, story bible, organization, tax mechanics, what replaces each step mechanic | 3-5 h doc; rest open | 05 |
| 13a | 13-testing-and-debugging, tasks 1 and 9-17 | Fast tests: unit tests for existing logic, fixtures, Node-runnable logic, null renderer, parallel groups, tiers, ready events, speed budget | 4-6 h | 04 |
| 08 | 08-classic-movement-seamless-maps-rooms | Part A: remove step tracking. Part B: seamless maps and rooms | 14-28 h | 05, 13a, 15 |
| 06 | 06-ui-structure | RPG UI: one module per screen, safe rendering, dialogue box, tokens | 10-20 h | 05, 08 |
| 07 | 07-portraits | Layered portraits: animated eyes and mouth, head moves a little | 8-14 h | 06 |
| 09 | 09-props-and-terrain | Terrain textures, low-poly 32 px/m props, variants, dedupe | 15-30 h | 05, 15 |
| 16p | 16-billies-monster-system, task 8 | Billies prototype: one quadruped body plan, about 10 parts, one breed function | 6-12 h | 13a, 15 |
| 17p | 17-robots, task 9 | Robots prototype: 3 of each part, builder screen, 1v1 battle | 8-15 h | 09, 13a, 15 |
| 10 | 10-world-map-bowl | New 3D bowl world map, clouds, simplified terrain, new layout | 15-30 h | 08, 09, 15 |
| 11 | 11-opening-sequence | Cyberpunk city, flying cars, portal, falling, arrival | 6-12 h | 07, 09, 15 |
| 12 | 12-ranch | Customizable ranch in the starting town | 10-20 h | 08, 09, 16p, 17p |
| 13b | 13-testing-and-debugging, tasks 2-8 | Breeding and robot-battle simulations, lazy debug code, opt-in error reports, modular check-quick, sturdier screenshots, full test updated for the new game | 2-4 h | 13a, 16p, 17p |
| 16 | 16-billies-monster-system | Full Billies: slimmed roster, parts, breeding, abominations, encounters | 20-40 h | 12, 13b |
| 17 | 17-robots | Full robots: parts, gems, sourcing, builder, balance | 25-45 h | 12, 13b |
| 14 | 14-studio, tasks 1-5 | Studio performance and polish (its editors are built in their own phases, see below) | 6-12 h | 06, 08, 10 |
| 18 | 18-friend-trading-and-battles | Async friend battles and atomic trades (Billies, robots, parts) | 10-20 h | 02, 16, 17 |

Rough total: about 190-370 hours at a careful, gated pace (plan first, approvals, tests, tags). These are guesses, not measurements, and are probably too high: the legacy game was built in about six days (file dates run 2026-10-10 to 2026-10-15) with roughly 50 releases. Treat the numbers as upper bounds and recalibrate after phases 01 and 03 using real usage. Phases 00-05 give a stable, modern, fresh base. Look at the game on my phone before starting phase 06.

## Why this order (changed 2026-10-18, after phase 04)
- 15 moves up: its answers drive earlier phases (what replaces the step mechanics in 08, the cyberpunk surface / solarpunk interior contrast for 09-11, the organization for 11).
- 13 is split. The fast tests (13a) come before the big code changes in 08, 06 and 09; the simulations and the rest (13b) come once there is breeding and a robot battle to simulate.
- 08 comes before 06, so the UI rewrite does not rebuild step screens that 08 removes.
- The Billies and robot prototypes (16p, 17p) come before the ranch: the ranch holds the nursery and maybe the robot workshop, so it needs the breeding mode and the workshop decision. The prototypes also test the core fun before the big art work.
- The breeding simulation that phase 16 requires is written in 13b, after the prototype's breed function exists, and must pass before the full 16 build. The same holds for the robot battle simulation and 17.
- 14's new editors (tasks 6-12) are built in the phase they belong to: the map editor in 08, the portrait editor in 07, the prop and terrain editor in 09, the world-map editor in 10, the ranch catalog editor in 12, the part editors in 16 and 17, the story editor with 15 or 11. What remains of 14 is performance and polish.
- Phases 00-04 are unchanged.

## What "remove the walking" means
It means the FITNESS STEP TRACKING (real-world steps driving travel, hatching and pace) is removed. In-game walking with the joystick, the seamless maps and the rooms stay. That is phase 08 (Part A removes steps, Part B improves maps and rooms).

## Where the old brief went
Old 1 -> 01, old 2 -> 02, old 3 -> 04, old 4 -> 05, old 5 (seamless maps and rooms) -> 08 Part B, old 5B -> 06, old 5C -> 09, old 6 -> 13, old 7 -> 14, old 8 -> 15, old 9 -> 16, old 10 -> 18. New: 03, 07, 10, 11, 12, 17, and 08 Part A.

## If the scope is too big
Priority order: 01, 02, 03, the cheap parts of 04 (.gitignore, CI, README, tooling), the 04 data split, 05, 08, 07, 10, 11, 12, the 13a unit tests, then the 17 prototype and the 16 prototype. 06, 09 and 14 grow as needed. 15 happens early because the story and mechanics drive everything else. 18 comes last.

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
- Robot battle model, defeat condition, and whether robots and Billies can share a team (17).
- Live real-time friend battles (18).

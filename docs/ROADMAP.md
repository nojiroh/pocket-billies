# Roadmap (what is left)

Updated 2026-10-19. Only remaining work is listed; what is done lives in docs/HANDOFF.md, and the previous roadmap is
in git history. The vision is in docs/VISION.md.

## How to read this
- **Five phases, A to E**, done in order. A letter avoids clashing with the old numbered files and `phase-NN-done`
  tags.
- **A phase spans several sessions.** A session is one sitting: a plan you approve, one branch, one PR, a HANDOFF
  entry. Sessions inside a phase go in the order listed.
- **Chapters:** the old phase files in docs/phases/ are kept as the detailed task lists. Each session names the
  chapter (and part) it works from. Chapter numbers are not phases any more.
- **A phase ends** when its "Done when" holds, the full quick check is green, you have tested on your phone and
  approved, and the commit is tagged `phase-X-done` (you push tags; Claude's tag pushes are refused).
- **Size is counted in sessions, not hours.** Hours were never measured. For scale: about 23 sessions landed between
  16 and 19 October. The real pace is set by your testing and your decisions, so each phase lists those too.
- **Testing:** every session follows docs/TESTING.md. Phase E only holds the leftover test infrastructure.

## Already done
00-05 (stable base, security, fresh base 0.1.0 alpha, modern tooling, renaming). Partly: chapter 06 sessions 1-3,
08a-1, 09 batch 1 and the cottage, 13 (fast check, fixtures, Node unit tests, robot sim, edit hooks, graphics bench),
16 prototype part 1, 17 prototype built.

## Phase A - Lock the creatures
Goal: every rule for Billies and robots is decided before the full build, so nothing is built twice.

| Session | Work | Chapter |
|---|---|---|
| A1 | Finish the Billies prototype: starter split by body size (L heavy, S light, M you pick), the 7 passives, quirks and Prime moves, one breed function, one abomination | 16 §5 item 7 |
| A2 | Design doc and story bible: core loop, progression, tax and market mechanics, the organization, the first 30 minutes, parodies of real people made into types | 15 |
| A3 | Breeding simulation within the agreed bounds; replace the red roster-count steps (v35, v38, v39/v40) and the Studio round trip that name legacy species | 13 tasks 2, 7 |

Sessions: 3-4. **Your part:** play both prototypes (robots: debug menu → Give the robot kit, battle Tinker Rho) and
answer the open questions for 16, 17 and 15 below. A1 can start before you answer; A2 and A3 need the answers.
**Done when:** both prototypes approved, the answers written into chapters 15, 16 and 17, the breeding and robot sims
pass agreed bounds, the full check is green. Tag `phase-A-done`.

## Phase B - Classic RPG
Goal: no real-world steps anywhere; maps and rooms in their final form.

| Session | Work | Chapter |
|---|---|---|
| B1 | Step mechanics, part 1: per-map encounter stock, prize money, buddy XP, Build/Hype chosen in the evolution sheet | 08a-2 items 1-5 |
| B2 | Step mechanics, part 2: jobs and step challenges out, eggs by metres, addSteps and `rules.steps` deleted, road lengths in metres, **SAVE_VERSION 3** | 08a-2 items 6-11 |
| B3 | Step widgets, text, Studio labels, the debug log, a run button | 08a-3 |
| B4-B5 | Typed links and doors, seam checks, edge prefetch, rooms in their own space, room templates, Studio link editing | 08b |

Sessions: 4-6. **Warning:** B2 resets your phone and cloud saves once (a new game starts). **Your part:** the maps
and rooms questions below before B4; a phone test after B2 and after B5.
**Done when:** no step code or text left, every seam and door passes the checks, a new picture baseline, the full
check green. Tag `phase-B-done`.

## Phase C - Creatures, full
Goal: you can catch, breed, build, battle and trade Billies and robots without the debug menu.

| Session | Work | Chapter |
|---|---|---|
| C1-C3 | Billies: 30-40 species from old sheets and the part library, abominations, encounters with varied parts, every area and trainer off the legacy stand-ins, the full Studio section | 16 §6 |
| C4-C6 | Robots: the first robot and parts in the game (chests, trainers, maybe wild robots), crafting, paint, loadouts, 3D assembly and the art socket standard, robots as walking buddy | 17 tasks |
| C7-C8 | Ranch in the starting town: editing, breeding, maybe the workshop | 12 |
| C9 | Friends: async battles and atomic trades of Billies, robots and parts | 18 |

Sessions: 7-10. **Your part:** approve the species list before C1 goes wide; the ranch and friends questions below
before C7 and C9; art for the new lines when you have it (placeholders until then).
**Done when:** a new game reaches every creature feature by playing, the sims pass, trades are atomic and pass the
security rules, the full check green. Tag `phase-C-done`.

## Phase D - The look
Goal: final screens, portraits, props and terrain.

| Session | Work | Chapter |
|---|---|---|
| D1 | Remaining screens: Guide, Trainer card, Settings, shops, dressing room, friends; Studio gallery; delete emptied CSS and the hidden classic HUD; accessibility pass | 06-4 |
| D2-D3 | Portraits. Decided: 64 px art, the head moves freely (not locked to the pixel grid) while the body stays still, editable in the Studio. Work: audit, layered renderer and tags, shared face kit, Studio portrait editor, swap in, delete the old system | 07 |
| D4-D7 | Props and terrain in batches: swap the new props into the first three maps, then terrain library, variants and dedupe, compact mesh pipeline, instancing and far versions, delete extrusion and volumetric code | 09 |
| D8 | Studio performance and polish | 14 |

Sessions: 7-9. **Your part:** portrait base art for the 6 story characters and 23 trainer looks; how the face kit is
made; the flat-vs-model list; approve each props batch on your phone (Claude does no graphics tests headless).
**Done when:** every chapter 06, 07, 09 and 14 "Done when" holds. Tag `phase-D-done`.

## Phase E - World, opening, finish
Goal: the bowl world map, the opening, and the remaining test work.

| Session | Work | Chapter |
|---|---|---|
| E1-E2 | 3D bowl world map: clouds, simplified terrain, new layout, airship travel | 10 |
| E3 | Opening: cyberpunk city, portal, fall, arrival, leading into the Hazel scene | 11 |
| E4 | Lazy-load debug, self-test and debug-log scripts; opt-in error reports; split check-quick.py; screenshot tolerances; waits instead of sleeps; null renderer; parallel end-to-end; speed budget report | 13 rest |

Sessions: 4-5. **Your part:** the world map and opening questions below; a graphics bench run on phone and PC.
**Done when:** chapters 10, 11 and 13 "Done when" hold. Tag `phase-E-done`.

## Total
About 25-34 sessions. Decisions and phone tests usually take longer than the sessions themselves.

## Open questions (do not decide these alone)
- **A, Billies (16):** names of the 4 new lines; does gear count as clothing; S/M/L or add XL; weight effects and how
  weight shows; the Prime bonus; parts through evolution; can parts break in battle; 4 move slots; tone of passives
  and quirks; final art for the new lines; bird and fish column names; breeding mode (deliberate, random or both).
- **A, robots (17):** part HP ratio, weight curve, leg-break penalty, sim bounds; the gem's story role; wild robots;
  how the first robot is found; one move per part or a choice; where the workshop lives.
- **A, story (15):** the organization's name, goals and prominence; cyberpunk surface / solarpunk interior; every
  mechanic change.
- **B, steps and maps (08):** anything still open in 08a-plan.md; trainers' block texts (shown nowhere now); several
  neighbours per side or one exit each; rooms as `kind: room` maps or a separate type.
- **C, ranch and friends (12, 18):** ranch editing UI; the workshop at the ranch or not; live real-time friend battles.
- **D, look (07, 09):** how the face kit is made; deleting the old portrait system; which props stay flat; each batch.
- **E, world and opening (10, 11):** bowl layout, camera limits, central light, travel animation; when character
  creation happens.

## Housekeeping
- Tags: only `Baseline` is on GitHub; `phase-04-done` and `phase-05-done` were never pushed.
- PR #11 (old phase order) is replaced by this file: close it. PRs #5 and #1 are stale.
- Many old `ccr-*` and merged branches on GitHub can be deleted.

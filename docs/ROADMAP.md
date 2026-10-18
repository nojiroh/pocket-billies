# Roadmap (what is left)

Updated 2026-10-19. Only remaining work is listed. What is done lives in docs/HANDOFF.md and the phase files; the
previous full roadmap is in git history. Every phase follows docs/TESTING.md. Times are rough guesses of Claude's
working time, not calendar time, and exclude my testing. The vision is in docs/VISION.md.

**Done:** 00-05 (stable base, security, fresh base 0.1.0 alpha, Vite/ESLint/modules/data split/TypeScript, renaming).
**Partly done:** 06 (06-1, 06-2, 06-2b, 06-3), 08 (08a-1), 09 (batch 1), 13 (fast check, fixtures, Node unit tests,
logic in Node, robot sim, edit hooks, graphics test and bench), 16 (prototype part 1), 17 (prototype built).
**Not started:** 07, 10, 11, 12, 14, 15, 18.

## Order: Billies and robots first

| Step | Phase | What is left | Rough work time | Needs |
|------|-------|--------------|-----------------|-------|
| 1 | 16 prototype | Starter split by body size (L heavy, S light, M you pick); the 7 passives, quirks and Prime moves; one breed function and one abomination. Then stop and show me | 4-8 h | - |
| 2 | 17 prototype review | I play it (debug menu: robot kit, Tinker Rho); answer the "Ask me before" list; agree the sim bounds; Hazel's tips say "Billies" for robots | 1-2 h | - |
| 3 | 15 design and story | Design doc (core loop, progression, tax/market mechanics central), story bible, the organization, first 30 minutes, de-personalise parodies. Short doc only; it steers the full 16 and 17 builds | 3-5 h | - |
| 4 | 13b sims and checks | Breeding simulation within agreed bounds (must exist before 16 full); replace the old roster-count steps (v35, v38, v39/v40) and the Studio round trip that name legacy species | 3-5 h | 1 |
| 5 | 08a-2, 08a-3 | Remove the remaining step mechanics (per-map encounter stock, prize money, buddy XP, Build/Hype split choice, eggs by metres, jobs, addSteps, `rules.steps`, SAVE_VERSION 3), then step widgets, text, Studio labels, run button, full check and a new baseline | 8-14 h | - |
| 6 | 16 full | 30-40 species from old sheets and the part library; abominations; encounters with varied parts; trainers and areas past Fizzwell off the legacy stand-ins; full Studio section | 20-40 h | 3, 4, 5 |
| 7 | 17 full | First robot and parts in the game (sourcing, chests, trainers, maybe wild robots), the workshop's place, crafting, paint, loadouts, 3D assembly and the art socket standard, robots as walking buddy | 25-45 h | 2, 3 |
| 8 | 06-4 | Guide, Trainer card, Settings, shops, dressing room, friends; Studio gallery; delete emptied CSS and the hidden classic HUD (`paintBoxes`, `.hcard`); accessibility pass; tag `phase-06-done` | 5-10 h | - |
| 9 | 07 portraits | Decided: 64 px art, head moves freely (not locked to the pixel grid) while the body stays still, editable in the Studio. Left: audit the old system, layered renderer and tags, shared face kit, Studio portrait editor, replace and delete the old system. The dialogue box's 96 px slot and `talkBox.onType` hook exist | 8-14 h | 6 assets from me |
| 10 | 09 props and terrain | My verdict on batch 1 (and PR #31, the cottage); swap new props into Copperleaf, Hedgerow Lane, Tallgrass Meadow; flat-vs-model list; terrain library; variants and dedupe; compact mesh pipeline; instancing and LOD; delete extrusion/volumetric code | 15-30 h | - |
| 11 | 08b maps and rooms | Typed links and doors, seam validations, edge prefetch, rooms in their own space, room templates, Studio link editing; tag `phase-08-done` | 10-20 h | 5 |
| 12 | 12 ranch | Customizable ranch in the starting town; breeding (16) and maybe the workshop (17) live here | 10-20 h | 6, 9 |
| 13 | 10 world map bowl | 3D bowl map, clouds, simplified terrain, new layout | 15-30 h | 11, 10 |
| 14 | 11 opening sequence | Cyberpunk city, portal, fall, arrival, leading into the Hazel opening built in 06-2b | 6-12 h | 3, 9, 10 |
| 15 | 13c rest of testing | Lazy-load debug, self-test and debug-log scripts; opt-in error reports; split check-quick.py; screenshot tolerances (no quick baseline exists yet); ready-event waits instead of sleeps; null renderer; parallel end-to-end; portrait tests; speed budget report; tag `phase-13-done` | 6-10 h | - |
| 16 | 14 Studio | Studio performance and polish (new editors are built in their own phases) | 6-12 h | - |
| 17 | 18 friend trading and battles | Async friend battles, atomic trades of Billies, robots and parts | 10-20 h | 6, 7 |

Rough total left: about 155-300 hours, probably high (the past phases ran well under their guesses).

## Housekeeping
- Tags: only `Baseline` is on GitHub. `phase-04-done` and `phase-05-done` exist only locally in an old session; push
  tags from your machine (Claude's tag pushes are refused).
- Open PRs: #31 (cottage, step 10); #11 (old phase order, replaced by this file: close it); #5 and #1 (stale).
- Many old `ccr-*` and merged branches on GitHub can be deleted.
- Your devices: run the graphics bench and Diagnostics on phone and PC when a step asks for it.

## Open questions (do not decide these alone)
- Billies (16): names of the 4 new lines; does gear count as clothing; S/M/L or add XL; weight effects and how weight
  shows; Prime bonus; parts through evolution; can parts break in battle; 4 move slots; tone of passives and quirks;
  final art for the new lines; bird and fish column names; breeding mode (deliberate, random or both).
- Robots (17): part HP ratio, weight curve, leg-break penalty, sim bounds; the gem's story role; wild robots; how
  the first robot is found; one move per part or a choice; where the workshop lives.
- Steps (08a): anything still open in docs/phases/08a-plan.md; trainers' block texts (shown nowhere now).
- Maps (08b): several neighbours per side or one exit each; rooms as `kind: room` maps or a separate type.
- Props (09): which props stay flat; approval of each batch.
- World map (10): bowl layout, camera limits, central light, travel animation.
- Opening (11): when character creation happens.
- Ranch (12): editing UI; robot workshop at the ranch or not.
- Story (15): the organization's name, goals and prominence; the cyberpunk surface / solarpunk interior contrast;
  every mechanic change.
- Friends (18): live real-time friend battles.

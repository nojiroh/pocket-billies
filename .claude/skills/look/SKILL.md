---
name: look
description: Open Pocket Billies on an emulated phone and look at it - serve the game, open a fixture or a test scene, read the game's own diagnostics, tap through it, take screenshots and judge them. Use to see how a screen, place or change looks or behaves in the real game, before claiming a visual change works, or when the owner asks to see something.
---

# Look at the game

**Serve it.** `python3 -m http.server 8765 --bind 127.0.0.1 -d game` (in the background). The game needs
game/data/gamedata.js (`npm run data`; the session-start hook builds it). Stop the server when done:
`pgrep -f "[h]ttp.server 8765" | xargs -r kill`.

**Open it with the Playwright MCP server** (`mcp__playwright__*`, started by .mcp.json through
tools/mcp-playwright.mjs): a 390x844 touch page with the checks' set-up (the clock at 15 June 12:30, no accounts, the
test globals, low graphics) and software WebGL.
- `browser_navigate` to `http://127.0.0.1:8765/?fixture=<name>`, then `browser_wait_for` 20-45 s: software drawing is
  slow (a boot takes 25-65 s, a frame of Copperleaf about 1.5 s).
- `browser_take_screenshot` returns the picture; look at it before saying how something looks.
- `browser_evaluate` reads state: `debugLog.diag()` gives `{view, scene, renderer, drawn, slow, long, errors, events,
  mb}`; with the test globals the page modules' names are on window (`walkView`, `saveData`, ...).
- `browser_console_messages` (level `error`) after each step. The `[gamedata] ... is in legacy` warnings are expected.
- Menus and sheets are HTML: `browser_snapshot`, then `browser_click` by ref. The 3D view is a canvas:
  `browser_mouse_click_xy` at CSS pixels of the 390x844 page.

**Fixtures** (game/js/fixture.js): `title` (new game, title screen), `town` (Copperleaf, the hub), `room` (Professor
Chosen's lab), `battle` (Leader Rocco, a win), `run` (a run's landing, day 1, seed RL7FIXTURE), `mountains`, `layout`
(`&plan=<id>`), `ranch`, `pasture`, `relics`, `lab`, `island` (the test island), `team`, `bag`, `talk`, `stored`.
Other URLs: `?test=1&scene=<mapId>` (a throwaway game on any map, never saved; `&place=`, `&at=x,z`, `&story=`),
`?debug` (the debug button), `?debug&run=<seed>` (a test run, logic/run-test.js).

**Repeatable pictures** (before/after, several places): a script on the model of tools/look-pasture.py or
tools/look-station.py: `serve(GAME)`, `chromium.launch(args=LAUNCH)`, `open_game`, `drawing(pg)`, screenshot, from
tools/browser_check.py; output in `validation/<tool>/` with that folder added to .gitignore.

**Judge** against the targets in docs/VISION.md ("Presentation") and ART-NOTES.md (terrain and the airship's low-poly
models at 32 px/m; flat props stay flat; 32-bit pixel-art portraits).

**What this can't show**: frame rates (software drawing), `mediump` precision (SwiftShader computes it at full
precision), a real phone's GPU limits, iOS Safari. Those come from the owner's phone: the in-game full test, then
the debug log (the debug-log skill).

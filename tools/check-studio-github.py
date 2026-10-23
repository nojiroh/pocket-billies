#!/usr/bin/env python3
"""The Studio in GitHub mode against a local stand-in for the GitHub API (phase 04c): it signs in, reads the game data
files, opens every section, then makes an edit and proposes it (blobs, a tree, a commit, a branch and a pull request
reach the stand-in). Any error on the page fails it. Nothing leaves the machine; nothing in the repository changes.
Project Story S3: on the way it writes in a trainer's script (an error on its line, line ids, the command reference),
follows the Check's Show me, uses the story preview and plays from here in a second tab (the game gets the draft).
And it flies the Walk scenes preview's free camera with the mouse, the keys and two fingers.
Studio track ST-1: it shows two sections side by side and tries the presets and the handles.
Studio track ST-2: it paints on the shared pixel canvas (strokes, lines, flips, symmetry, the palette lock, the keys,
the ? sheet) and undoes pictures and data in one order, in the sheet editor and the ground tile painter.
Studio track ST-3: it drops sheets on the Studio: a kit's two sheets slice to exactly the parts the game has (writing
them changes nothing), and a sheet drawn at 4x on a flat background snaps to its pixels, writes three new parts and
undoes and redoes them.
Studio track ST-4: Part mode on a kit part: the pivot dragged and nudged, a socket rule, a test fit, Mirror to other
side, an L painted, and the kit written again keeping it all; then everything undone.
Studio track ST-5: a robot torso in Part mode beside the battle preview: a shoulder moved moves the robot's arm on the
stage, front and back; a test fit; back to computed; everything undone.
Studio track ST-6: the skeleton builder's zoom keys; a species in Part mode (opened from Billies): its head's pivot
dragged and nudged (the figure drawn the same), its box grown by an edge, its back draw order, everything undone. The
wardrobe on the shared pixel canvas: a pencil click paints the item and marks its colour-area mask in one undo step
(undone and redone together); the Colour area brush paints the mask only; Grow piece; everything undone.
Studio track ST-T: the Studio self-test runs whole and must pass (no errors, every edit undone, everything put back,
no token in its report); its times are not judged here.
Studio plan Phase 5 (T5.1): a kit Billie's recipe edited in Part mode bakes at once (one undo step), and the proposal
carries its sheet (pixel-equal to the Node bake), rigs-next.js, kitBuilds.json and its line.
Studio plan Phase 5 (T5.2): Replace from Parts Library greys a part a child can't hang on, shows before and after,
and a head swapped keeps a blink as one undo step.
Studio plan Phase 5 (T5.4): Repack sheet makes a hand-drawn Billie's sheet smaller, drawn the same, one undo step.
Studio plan Phase 1 (T1.3): the Check lists check-data's own problems (planted), and an error blocks Propose.
UI track UI-3: the UI look section: a colour dial changed shows in the preview frame, Undo puts the data and the
preview back; a screen's own colour shows on that screen only and ↺ takes it away; a preset applies and undoes; Find
and the Check's Show me reach a dial; Hold to compare shows the saved look; a cut size is left changed, so the
proposal at the end must carry uiTheme.json with it.
Island track IS-6a/IS-6b (a page of its own, after the proposal): the Hub island section on test_island draws (the
orbit view and the map), a drag turns it, a stroke paints and undoes; the ground lock here and in Walk scenes; the
dials: too big round the middle, a draft drawn, Use this island, Undo, read-only when locked.

    python3 tools/check-studio-github.py           # the repository as it is (run `npm run data` first)
    python3 tools/check-studio-github.py dist      # the build (`npm run build` first)
    python3 tools/check-studio-github.py --only=ui,studio_test   # sign in, only these steps, then the proposal
                                                                 # (step names: STEPS below)
    python3 tools/check-studio-github.py --only=publish  # Studio plan Phase 0: Propose's failure cases alone
    python3 tools/check-studio-github.py --only=drafts   # Studio plan Phase 1 (T1.1): kept drafts, restore, discard
    python3 tools/check-studio-github.py --only=checks   # Studio plan Phase 1 (T1.3): the shared checks, an error blocks
    python3 tools/check-studio-github.py --only=polish   # Studio plan Phase 6: second pane, paths, errors, listeners, GL
    python3 tools/check-studio-github.py --only=hub      # island track IS-6a/IS-6b: the Hub island section, its dials
    PB_STUDIO_TEST_OUT=report.json python3 tools/check-studio-github.py --only=studio_test   # keeps the self-test's report

Needs Python 3 and Playwright (tools/requirements-check.txt). About a minute."""
import json, os, re, subprocess, sys, threading, time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from playwright.sync_api import sync_playwright

REPO = Path(__file__).resolve().parent.parent
POS = [a for a in sys.argv[1:] if not a.startswith('--')]
ROOT = REPO / POS[0] if POS else REPO
# UI-3: --only=a,b runs only these steps (the full chain stalls at the story preview's real click in some containers)
ONLY = next((set(a.split('=', 1)[1].split(',')) for a in sys.argv[1:] if a.startswith('--only=')), None)


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass


def play_from_here(pg, errs):
    """Project Story S3: Play from here opens the game in Copperleaf on the picked spot, at the preview's preset with a
    trainer switched to beaten, and with the Studio's unsaved script; nothing is saved there."""
    pg.evaluate("studioState.D.trainers.crude.script.splice(1, 0, '  set s3_draft'); mapEditor.story.flags = {'beat:crude': true}; mapEditor.story.v++")
    pg.locator('#scStory [data-act="scPlaySpot"]').click()
    pg.locator('#scMap').scroll_into_view_if_needed()
    box = pg.locator('#scMap').bounding_box()
    pg.mouse.click(box['x'] + min(box['width'], 800) * 0.4, box['y'] + min(box['height'], 600) * 0.5)
    spot = pg.evaluate("[mapEditor.playAt.x, mapEditor.playAt.z]")
    with pg.context.expect_page(timeout=10000) as info:
        pg.locator('#scStory [data-act="scPlayHere"]').click()
    gp = info.value
    gp.on('pageerror', lambda e: errs.append('game: ' + str(e)[:300]))
    t0 = time.time()
    while time.time() - t0 < 120:
        try:
            if gp.evaluate("typeof saveData!=='undefined' && typeof uiState!=='undefined' && uiState.tab==='walk' && !!saveData.started"): break
        except Exception: pass
        time.sleep(0.5)
    # the game waits 2 s at most for the Studio's draft, then starts and takes it live when it comes (game/js/boot.js
    # studioDraftReady); with software drawing the busy Studio page can answer later than that
    t0 = time.time()
    while time.time() - t0 < 15 and not gp.evaluate("gameData.trainers.crude.script.includes('  set s3_draft')"): time.sleep(0.5)
    got = gp.evaluate("""[LOCATIONS[saveData.trip.node].id, uiState.roam && [uiState.roam.x, uiState.roam.z], saveData.story.rival0,
        saveData.flags.crude, gameData.trainers.crude.script.includes('  set s3_draft'), Object.keys(localStorage).filter(k => k.startsWith('networth-save'))]""")
    want = ['copperleaf', spot, 'win', 1, True, []]
    if got != want: errs.append(f'story: Play from here gave {got}, wanted {want}')
    else: print(f'Play from here: Copperleaf at {spot}, after-opening, crude beaten, the draft script, no save', flush=True)
    gp.close()
    pg.evaluate("studioState.D.trainers.crude.script.splice(1, 1); mapEditor.story.flags = {}; mapEditor.playAt = null; mapEditor.story.v++")


def free_camera_steps(pg, errs):
    """The Walk scenes preview's free camera: a drag keeps the ground under the pointer, the wheel zooms, a right-drag
    turns and tilts, Top view looks down, W moves, two fingers pinch and twist, and it hands back to the walker."""
    pg.evaluate("studioState.sel.scene='copperleaf'; void openSection('scenes')")
    time.sleep(4)
    # Studio plan T6.7: the kept WebGL context draws at once, and a software-drawn frame can take seconds, so the
    # scroll and the clicks don't wait for two frames with the same box
    pg.evaluate("document.querySelector('#scPv').scrollIntoView({ block: 'nearest' })")
    pg.locator('#scFreeCam [data-act="fcOn"]').click(force=True)
    time.sleep(1.5)
    G = lambda: pg.evaluate("JSON.parse(JSON.stringify(freeCamera.goal))")
    ground = lambda x, y: pg.evaluate(f"(() => {{ const p = canvasPoint({{ clientX: {x}, clientY: {y} }}); const g = screenToGround(p[0], p[1]); return g && [g.x, g.z]; }})()")
    b = pg.locator('#scPv').bounding_box()
    cx, cy = b['x'] + b['width'] / 2, b['y'] + b['height'] / 2
    a = ground(cx, cy)
    pg.mouse.move(cx, cy)
    pg.mouse.down()
    for i in range(12): pg.mouse.move(cx + 10 * (i + 1), cy + 5 * (i + 1))
    pg.mouse.up()
    time.sleep(1.5)
    z = ground(cx + 120, cy + 60)
    if not a or not z or abs(a[0] - z[0]) > 0.75 or abs(a[1] - z[1]) > 0.75: errs.append(f'free camera: the ground under the pointer moved: {a} -> {z}')
    g0 = G()
    pg.mouse.move(cx, cy)
    pg.mouse.wheel(0, -500)
    time.sleep(0.5)
    if not G()['dist'] < g0['dist'] * 0.8: errs.append('free camera: the wheel didn\'t zoom in')
    g0 = G()
    pg.mouse.down(button='right')
    pg.mouse.move(cx + 120, cy - 40, steps=6)
    pg.mouse.up(button='right')
    g1 = G()
    if not (g1['yaw'] > g0['yaw'] + 0.3 and g1['pitch'] < g0['pitch']): errs.append(f'free camera: right-drag {g0} -> {g1}')
    pg.locator('#scFreeCam [data-act="fcTop"]').click(force=True)
    if G()['pitch'] != 89: errs.append('free camera: Top view doesn\'t look down')
    g0 = G()
    pg.mouse.move(cx, cy)
    pg.keyboard.down('w')
    t0 = time.time()  # held until it moves: headless, the first frames after Top view build the ground it now sees
    while time.time() - t0 < 6 and abs(G()['tgt'][2] - g0['tgt'][2]) + abs(G()['tgt'][0] - g0['tgt'][0]) < 0.5:
        time.sleep(0.25)
    pg.keyboard.up('w')
    g1 = G()
    if abs(g1['tgt'][0] - g0['tgt'][0]) + abs(g1['tgt'][2] - g0['tgt'][2]) < 0.5: errs.append('free camera: W didn\'t move it')
    # two fingers: apart (closer) and turned a quarter
    g0 = G()
    pg.evaluate(f"""(() => {{ const cv = document.getElementById('scPv'), e = (t, id, x, y) => cv.dispatchEvent(new PointerEvent(t, {{ pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: id === 11 }}));
      e('pointerdown', 11, {cx - 40}, {cy}); e('pointerdown', 12, {cx + 40}, {cy});
      for (let i = 1; i <= 8; i++) {{ const r = 40 + i * 10, a = (i / 8) * Math.PI / 2; e('pointermove', 11, {cx} - r * Math.cos(a), {cy} - r * Math.sin(a)); e('pointermove', 12, {cx} + r * Math.cos(a), {cy} + r * Math.sin(a)); }}
      e('pointerup', 11, 0, 0); e('pointerup', 12, 0, 0); }})()""")
    g1 = G()
    if not (g1['dist'] < g0['dist'] * 0.7 and abs(abs(g1['yaw'] - g0['yaw']) - 3.14159 / 2) < 0.2): errs.append(f'free camera: pinch and twist {g0} -> {g1}')
    pg.locator('#scFreeCam [data-act="fcOn"]').first.click(force=True)
    time.sleep(0.5)
    if pg.evaluate("freeCamera.on") or pg.evaluate("walkView.opt.look(0.016)") is not None: errs.append('free camera: still on after Back to the walker')
    print('free camera: drag keeps the ground, wheel, right-drag, top view, keys, pinch and twist, back to the walker', flush=True)


def story_steps(pg, errs):
    """Project Story S3: a trainer's script says what is wrong as you type, with the line; Add line ids gives the new
    line one; the command reference opens and puts a command in the script; a scene's person has a script field."""
    pg.evaluate("studioState.sel.trainer='crude'; void openSection('trainers')")
    ta = pg.locator('textarea[data-script="trainer:crude"]')
    ta.click()
    pg.keyboard.press('Control+End')
    pg.keyboard.press('Enter')
    pg.keyboard.type('sett met_x')
    time.sleep(0.5)
    msg = pg.locator('.scriptf[data-sf="trainer:crude"] .sf-msgs').inner_text()
    n = pg.evaluate("document.querySelector('textarea[data-script=\"trainer:crude\"]').value.split('\\n').length")
    if 'did you mean "set"' not in msg or f'line {n}' not in msg: errs.append(f'story: no "did you mean" on line {n}: {msg!r}')
    for _ in range(len('sett met_x')): pg.keyboard.press('Backspace')
    pg.keyboard.type('A new line.')
    time.sleep(0.6)
    msg = pg.locator('.scriptf[data-sf="trainer:crude"] .sf-msgs').inner_text()
    if 'has no line id' not in msg: errs.append(f'story: a new line without an id isn\'t named: {msg!r}')
    pg.locator('.scriptf[data-sf="trainer:crude"] [data-act="sfIds"]').click()
    time.sleep(0.6)
    last = pg.evaluate("studioState.D.trainers.crude.script.at(-1)")
    msg = pg.locator('.scriptf[data-sf="trainer:crude"] .sf-msgs').inner_text()
    if not re.search(r'^A new line\. #l:[0-9a-f]{4}$', last) or 'Reads fine' not in msg:
        errs.append(f'story: Add line ids: {last!r}, {msg!r}')
    pg.locator('.scriptf[data-sf="trainer:crude"] [data-act="sfRef"]').click()
    pg.fill('#sfRefQ', 'heal')
    vis = pg.evaluate("[...document.querySelectorAll('#sfRef li[data-q]')].filter(l => !l.hidden).map(l => l.textContent)")
    if len(vis) != 1 or not vis[0].startswith('heal'): errs.append(f'story: the reference finds {vis}')
    pg.locator('#sfRef [data-act="sfInsert"]', has_text='heal').click()
    if pg.evaluate("studioState.D.trainers.crude.script.at(-1)") != 'heal': errs.append('story: the reference didn\'t put heal in the script')
    pg.locator('#sfRef header [data-act="sfRef"]').click()
    pg.evaluate("studioState.sel.scene='copperleaf'; void openSection('scenes')")
    time.sleep(1)
    if not pg.locator('textarea[data-script="person:juniper"]').count(): errs.append('story: no script field for Juniper in Copperleaf')
    # the story preview: Juniper only while a flag of this check's own holds (no story sets it); on at a new game she
    # is hidden, the flag's chip brings her back, and picking a preset starts from its own flags again (hidden)
    pg.evaluate("studioState.D.maps.copperleaf.people[0].when = 'check_flag'; render()")
    time.sleep(1)
    pg.locator('#scStoryOn').check()
    time.sleep(0.4)
    a = pg.locator('#scStory').inner_text()
    pg.locator('#scStory [data-act="scStoryFlag"][data-f="check_flag"]').click()
    time.sleep(0.4)
    b = pg.locator('#scStory').inner_text()
    pg.select_option('#scStoryPreset', 'after-opening')
    time.sleep(0.4)
    c = pg.locator('#scStory').inner_text()
    if '1 hidden' not in a or 'Everyone is here' not in b or '1 hidden' not in c:
        errs.append(f'story: the preview hides {a!r} / {b!r} / {c!r}')
    play_from_here(pg, errs)
    pg.locator('#scStoryOn').uncheck()
    pg.evaluate("delete studioState.D.maps.copperleaf.people[0].when")
    pg.evaluate("void openSection('story')")
    if not pg.locator('textarea[data-script^="story:"]').count(): errs.append('story: the Story section has no script field')
    pg.evaluate("studioState.D.trainers.crude.script.splice(2, 0, '  sett x'); void openSection('check')")
    time.sleep(0.8)
    i = pg.evaluate("studioState.lastCheck.findIndex(p => p.msg.startsWith('Story:') && p.msg.includes('sett'))")
    if i < 0: errs.append('story: the Check doesn\'t list the story problem')
    else:
        pg.locator(f'[data-act="fix"][data-i="{i}"]').click()
        time.sleep(0.8)
        got = pg.evaluate("[studioState.sec, document.activeElement.dataset.script, document.activeElement.value.slice(document.activeElement.selectionStart, document.activeElement.selectionEnd)]")
        if got != ['trainers', 'trainer:crude', '  sett x']: errs.append(f'story: Show me went to {got}')
    pg.evaluate("void undo(); void undo(); void undo(); void undo(); void undo()")
    print('story editor: messages, line ids, reference, people, story section, the Check, the story preview', flush=True)


def split_steps(pg, errs):
    """Studio track ST-1: two sections side by side. No two sections the second pane can show share an element id;
    an edit in the second pane is an edit (and undoes); a 3D section stays on the left beside a light one; the second
    pane refuses a 3D section and the one already on the left; the presets and the handles answer."""
    shared = pg.evaluate("""(() => { const by = {}, keep = studioState.sec;
      for (const k of Object.keys(SECTIONS)) { if (PANE2_REFUSED[k]) continue; openSection(k);
        for (const i of new Set([...document.querySelectorAll('#main [id]')].map(e => e.id))) (by[i] = by[i] || []).push(k); }
      openSection(keep); return Object.entries(by).filter(([i, ks]) => ks.length > 1).map(([i, ks]) => i + ' in ' + ks.join(', ')); })()""")
    if shared: errs.append('split: sections share ids: ' + '; '.join(shared[:5]))
    # the Check: no music error or warning on the game's data (notes, like the placeholders, are fine); a rule of the
    # check's own naming no song (put first, then taken out) is an error and a song nothing plays a warning, and Show
    # me opens them. The wait stays: the Studio's music Check holds its warnings until the parked world is read (a song
    # only a parked place plays, like variants, isn't unused)
    pg.wait_for_function("legacyView.data !== null", timeout=30000)
    got = pg.evaluate("runCheck().filter(c => c.msg.startsWith('Music:') || c.msg.startsWith('Cries:')).map(c => [c.lvl, c.msg.slice(0, 40)])")
    if any(lvl != 'info' for lvl, _ in got): errs.append(f'music: the Check on the game data says {got}')
    pg.evaluate("studioState.D.music.where.unshift({battle: 'wild', song: 'nosuch'}); studioState.D.music.songs.lonely = {...studioState.D.music.songs.town}")
    found = pg.evaluate("runCheck().filter(c => c.go === 'music' && c.lvl !== 'info').map(c => [c.lvl, c.sel])")
    if found != [['error', {'musicTab': 'where', 'musicRule': 0}], ['warn', {'musicTab': 'songs', 'musicSong': 'lonely'}]]: errs.append(f'music: the Check found {found}')
    pg.evaluate("void openSection('music', {musicTab: 'where', musicRule: 0})")
    if not pg.evaluate("!!document.querySelector('#musRule0.mus-hit')"): errs.append('music: Show me did not mark the rule')
    pg.evaluate("studioState.D.music.where.shift(); delete studioState.D.music.songs.lonely; void render()")
    pg.evaluate("void openSection('billionaires')"); time.sleep(0.3)
    pg.locator('.nav[data-s=moves]').click(modifiers=['Shift']); time.sleep(0.8)
    if pg.evaluate("[studioState.sec, studioState.sec2, document.querySelector('#main2').hidden]") != ['billionaires', 'moves', False]:
        errs.append('split: Shift-click did not open Moves beside Billies')
    f = pg.locator('#main2 input[data-p]').first
    path, v0 = f.get_attribute('data-p'), f.input_value()
    f.fill(v0 + ' Split'); f.dispatch_event('change'); time.sleep(0.4)
    got = pg.evaluate(f"[readPath({json.dumps(path)}), studioState.dirty]")
    pg.evaluate("void undo()"); time.sleep(0.4)
    back = pg.evaluate(f"readPath({json.dumps(path)})")
    if got != [v0 + ' Split', True] or back != v0: errs.append(f'split: an edit in the second pane gave {got}, undo {back!r}')
    pg.evaluate("void openSection('preview')"); pg.wait_for_selector('#cvWorld', timeout=20000); time.sleep(1.5)
    if pg.evaluate("[studioState.sec, studioState.sec2]") != ['preview', 'moves']: errs.append('split: the battle preview did not open beside Moves')
    pg.evaluate("ACTIONS.openBeside({ s: 'scenes' })"); pg.evaluate("ACTIONS.openBeside({ s: 'preview' })"); time.sleep(0.3)
    if pg.evaluate("studioState.sec2") != 'moves': errs.append('split: the second pane took a 3D section')
    pg.select_option('#layPick', 'compact'); time.sleep(0.4)
    if pg.evaluate("[studioState.sec2, getComputedStyle(document.querySelector('#side')).width]") != [None, '200px']: errs.append('split: the Compact preset did not close the split or set the sizes')
    pg.select_option('#layPick', 'auto'); time.sleep(0.3)
    pg.evaluate("void openSection('billionaires')"); time.sleep(0.3)
    h = pg.locator('#main .split > .lay-h'); h.focus(); pg.keyboard.press('Shift+ArrowRight'); time.sleep(0.2)
    w = pg.evaluate("Math.round(document.querySelector('#main .list-col').getBoundingClientRect().width)")
    pg.keyboard.press('Delete'); time.sleep(0.2)
    w0 = pg.evaluate("Math.round(document.querySelector('#main .list-col').getBoundingClientRect().width)")
    if w != w0 + 32: errs.append(f'split: the list handle moved it to {w} from {w0}')
    pg.evaluate("localStorage.removeItem('studio-layout')")
    print('split: no shared ids, an edit and undo in the second pane, preview beside Moves, 3D refused, presets, handles', flush=True)


PIXELS = "(p => { const c = loadedAtlas(p); return Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data).reduce((a, v, i) => (a * 31 + v * ((i % 7) + 1)) % 1000000007, 0) })"
PIXEL_AT = "((p, x, y) => Array.from(loadedAtlas(p).getContext('2d').getImageData(x, y, 1, 1).data))"


def pixel_canvas_steps(pg, errs, sp):
    """Studio track ST-2: the sheet editor on the shared pixel canvas. A stroke, a skeleton number and a second stroke
    undo in the order they were made (and redo), across a Front/Back switch; a flip twice and four quarter turns
    change nothing; symmetry paints the mirrored pixel; the palette lock snaps a colour; the keys pick tools; ? lists
    them. Everything is undone and the sheet left unchanged."""
    path = pg.evaluate("atlasPath(pixelEditor.sp, 'front')")
    h = lambda: pg.evaluate(f"{PIXELS}({json.dumps(path)})")
    at = lambda x, y: pg.evaluate(f"{PIXEL_AT}({json.dumps(path)}, {x}, {y})")
    pg.evaluate("pixelCanvasZoom(pixelEditor.pc, 4); pxStage.scrollTo(0, 0)"); time.sleep(0.3)
    box = pg.locator('#pxCv').bounding_box()
    Z = 4
    xy = lambda x, y: (box['x'] + x * Z + Z / 2, box['y'] + y * Z + Z / 2)
    def stroke(a, b):
        pg.mouse.move(*xy(*a)); pg.mouse.down(); pg.mouse.move(*xy(*b), steps=6); pg.mouse.up()
    steps0 = pg.evaluate('studioState.undo.length')
    h0 = h()
    stroke((6, 8), (30, 20)); h1 = h()
    if h1 == h0: errs.append('pixels: a stroke changed nothing')
    if pg.evaluate("typeof studioState.undo.at(-1)") != 'object': errs.append('pixels: a stroke is not a step of the undo')
    bone = "studioState.rigs[pixelEditor.sp].front.bones[0].at[0]"
    b0 = pg.evaluate(bone)
    inp = pg.locator('#pxBones input').first
    inp.fill(str(b0 + 3)); inp.press('Tab'); time.sleep(0.7)
    stroke((10, 30), (20, 34)); h2 = h()
    pg.click('.pxed [data-pe=atlas][data-v=back]'); time.sleep(0.4)
    pg.mouse.move(*xy(2, 2))
    got = []
    for _ in range(3):
        pg.keyboard.press('Control+z'); time.sleep(0.3); got.append((h(), pg.evaluate(bone)))
    want = [(h1, b0 + 3), (h1, b0), (h0, b0)]
    if got != want: errs.append(f'pixels: undo went {[(a == h0, a == h1, a == h2, b) for a, b in got]}, wanted stroke 2, the bone, stroke 1 (bone {b0})')
    for _ in range(3): pg.keyboard.press('Control+y'); time.sleep(0.2)
    if (h(), pg.evaluate(bone)) != (h2, b0 + 3): errs.append('pixels: redo did not bring both strokes and the bone back')
    pg.click('.pxed [data-pe=atlas][data-v=front]'); time.sleep(0.4)
    pg.evaluate("pixelCanvasZoom(pixelEditor.pc, 4); pxStage.scrollTo(0, 0)"); time.sleep(0.2)
    # the line tool and Shift-click
    pg.keyboard.press('l'); stroke((40, 4), (50, 9))
    if at(50, 9)[3] == 0: errs.append('pixels: the line tool left its end unpainted')
    # a flip twice, four quarter turns of a square selection
    part = pg.evaluate("partsOf(pixelEditor.sp, 'front')[0].r")
    hf = h()
    pg.mouse.move(*xy(part[0] + 3, part[1] + 3)); time.sleep(0.2)
    pg.keyboard.press('Shift+H')
    if h() == hf: errs.append('pixels: Shift+H flipped nothing')
    pg.keyboard.press('Shift+H')
    pg.keyboard.press('m'); stroke((part[0] + 2, part[1] + 2), (part[0] + 13, part[1] + 13))
    if pg.evaluate('pixelEditor.pc.sel') != [part[0] + 2, part[1] + 2, 12, 12]: errs.append(f"pixels: the selection is {pg.evaluate('pixelEditor.pc.sel')}")
    for _ in range(4): pg.click('.pxed [data-pe=xf][data-x=rotate]')
    if h() != hf: errs.append('pixels: two flips and four quarter turns changed the sheet')
    pg.keyboard.press('Escape')
    if pg.evaluate('pixelEditor.pc.sel') or not pg.locator('.pxed').count(): errs.append('pixels: Esc should drop the selection and keep the editor open')
    # symmetry: a dot in the part paints its mirror
    pg.keyboard.press('b'); pg.click('.pxed [data-pc=sym][data-m=v]')
    pg.evaluate("choosePixelColor('#123456')")
    x, y = part[0] + 4, part[1] + 5
    pg.mouse.move(*xy(x, y)); pg.mouse.click(*xy(x, y))
    mx = 2 * part[0] + part[2] - 1 - x
    if at(x, y)[:3] != [0x12, 0x34, 0x56] or at(mx, y)[:3] != [0x12, 0x34, 0x56]: errs.append(f'pixels: symmetry painted {at(x, y)} and {at(mx, y)}')
    pg.click('.pxed [data-pc=sym][data-m=off]')
    # the palette lock snaps a colour onto the game palette
    pg.keyboard.press('k')
    snapped = pg.evaluate('pixelEditor.pc.color')
    if not pg.evaluate(f"gamePalette().includes({json.dumps(snapped)})"): errs.append(f'pixels: the palette lock left {snapped}')
    pg.keyboard.press('k')
    for k, t in [('e', 'erase'), ('g', 'fill'), ('i', 'pick'), ('m', 'select'), ('b', 'pen')]:
        pg.keyboard.press(k)
        if pg.evaluate('pixelEditor.pc.tool') != t: errs.append(f'pixels: {k} gave {pg.evaluate("pixelEditor.pc.tool")}')
    pg.keyboard.press('?'); time.sleep(0.3)
    if not pg.locator('#dlg .keys-sheet').count(): errs.append('pixels: ? showed no key sheet')
    pg.keyboard.press('Escape'); time.sleep(0.2)
    if not pg.locator('.pxed').count(): errs.append('pixels: Esc on the key sheet closed the editor too')
    # take it all back
    for _ in range(pg.evaluate('studioState.undo.length') - steps0): pg.evaluate('undo()')
    if h() != h0: errs.append('pixels: undoing every step did not bring the sheet back')
    pg.evaluate(f"studioState.artDirty.delete({json.dumps(path)}); updateTopBar()")
    print('pixel canvas: strokes, a bone and undo/redo in order, line, flips and turns, selection, symmetry, palette lock, keys, ? sheet', flush=True)


def tile_painter_steps(pg, errs):
    """Studio track ST-2: a ground tile on the shared canvas: a click on a repeat paints the tile, undo takes it back,
    the painter's keys do not reach the map's."""
    pg.set_default_timeout(120000)
    pg.evaluate("void openSection('scenes')"); time.sleep(4)
    t = pg.evaluate("Object.keys(sceneryCatalog().terrains).find(c => sceneryCatalog().terrains[c].tile)")
    pg.evaluate(f"ACTIONS.scEditTile({{ c: {json.dumps(t)} }})")
    pg.wait_for_selector('#scPeStage .pc-art'); time.sleep(1)
    path = pg.evaluate('mapEditor.pe.path')
    h0 = pg.evaluate(f"{PIXELS}({json.dumps(path)})")
    pg.locator('#scPeStage .pc-art').scroll_into_view_if_needed()
    box = pg.locator('#scPeStage .pc-art').bounding_box()
    Z, W = pg.evaluate('mapEditor.pePc.zoom'), pg.evaluate(f"loadedAtlas({json.dumps(path)}).width")
    pg.evaluate("pixelCanvasTool(mapEditor.pePc, 'pen'); pixelCanvasColor(mapEditor.pePc, '#FF0000')")
    tool = pg.evaluate('mapEditor.tool')
    pg.mouse.move(box['x'] + Z / 2, box['y'] + W * Z + Z / 2)
    pg.keyboard.press('e')
    if pg.evaluate('mapEditor.pePc.tool') != 'erase' or pg.evaluate('mapEditor.tool') != tool: errs.append('tile painter: E over it should pick its eraser, not the map tool')
    pg.keyboard.press('b')
    pg.mouse.click(box['x'] + Z / 2, box['y'] + W * Z + Z / 2)
    got = pg.evaluate(f"{PIXEL_AT}({json.dumps(path)}, 0, 0)")
    if got != [255, 0, 0, 255]:
        errs.append(f"tile painter: a click on a repeat did not paint the tile ({got}, " + pg.evaluate(f"[mapEditor.pePc.tool, mapEditor.pePc.color, (document.elementFromPoint({box['x'] + Z / 2}, {box['y'] + W * Z + Z / 2}) || {{}}).className, innerWidth, innerHeight].join(' ')") + ')')
    pg.evaluate('undo()'); time.sleep(0.3)
    if pg.evaluate(f"{PIXELS}({json.dumps(path)})") != h0: errs.append('tile painter: undo did not take the stroke back')
    pg.evaluate(f"studioState.artDirty.delete({json.dumps(path)}); ACTIONS.scPeClose(); updateTopBar()")
    pg.set_default_timeout(30000)
    print('tile painter: paints through a repeat, its keys, undo', flush=True)


def workbench_steps(pg, errs):
    """Studio track ST-3: the Art workbench's Sheet mode, with sheets dropped on the page (not on a drop zone)."""
    drop = """async ([names, made]) => { const dt = new DataTransfer();
      for (const n of names) { const r = await fetch('/tools/art-source/part-kit/' + n); if (!r.ok) return false; dt.items.add(new File([await r.blob()], n, { type: 'image/png' })); }
      if (made) dt.items.add(made);
      document.body.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); return true; }"""
    n = len(errs)
    kit = pg.evaluate(f"({drop})([['beasts-front.png', 'beasts-back.png'], null])")
    if kit:  # the repository (the build has no kit sources): the kit slices to exactly the game's parts
        t0 = time.time()
        while time.time() - t0 < 30 and pg.evaluate("workbench.sheets.length") < 2: time.sleep(0.3)
        time.sleep(0.5)
        if pg.evaluate("studioState.sec") != 'workbench': errs.append('workbench: a drop did not open the workbench')
        got = pg.evaluate("({ kit: workbench.kit, method: workbench.o.method, ids: new Set(wbParts().all.map(p => p.id)).size, problems: wbParts().per.map(r => r.problem).join('') })")
        if (got['kit'], got['method'], got['ids'], got['problems']) != ('beasts', 'kit', 40, ''): errs.append(f'workbench: the beasts kit sliced as {got}')
        data = pg.evaluate("JSON.stringify(studioState.D.partKits)")
        steps = pg.evaluate("studioState.undo.length")
        pg.evaluate("ACTIONS.wbWrite()"); time.sleep(4)
        if pg.evaluate("studioState.artDirty.size") or pg.evaluate("JSON.stringify(studioState.D.partKits)") != data or pg.evaluate("studioState.undo.length") != steps:
            errs.append(f"workbench: writing the beasts kit again changed {pg.evaluate('studioState.artDirty.size')} pictures or the parts")
        pg.evaluate("ACTIONS.wbDrop({ i: 1 }); ACTIONS.wbDrop({ i: 0 })")
    # a sheet drawn at 4x on a flat cream background: three blobs of art, snapped back to their pixels
    made = """(() => { const c = document.createElement('canvas'); c.width = 4 * 40 + 2; c.height = 4 * 14 + 3; const x = c.getContext('2d');
      x.fillStyle = '#eee8d6'; x.fillRect(0, 0, c.width, c.height);
      [['#c83c28', 2, 2, 8, 9], ['#2a5ac8', 15, 3, 6, 10], ['#30a050', 26, 2, 11, 6]].forEach(([f, a, b, w, h]) => { x.fillStyle = f; x.fillRect(2 + a * 4, 3 + b * 4, w * 4, h * 4); });
      x.fillStyle = '#eee8d6'; x.fillRect(2 + 4 * 4, 3 + 5 * 4, 4, 4);
      return new Promise(r => c.toBlob(b => r(new File([b], 'blobs-front.png', { type: 'image/png' })))); })()"""
    pg.evaluate(f"(async () => ({drop})([[], await {made}]))()")
    t0 = time.time()
    while time.time() - t0 < 30 and not pg.evaluate("workbench.sheets.some(s => s.name === 'blobs-front.png')"): time.sleep(0.3)
    time.sleep(0.5)
    got = pg.evaluate("({ kit: workbench.kit, scale: workbench.o.scale, s: workbench.o.snapScale, parts: wbParts().all.map(p => [p.id, p.img.width, p.img.height]) })")
    want = {'kit': 'blobs', 'scale': 'snap', 's': 4, 'parts': [['blobs_1', 8, 9], ['blobs_2', 11, 6], ['blobs_3', 6, 10]]}
    if got != want: errs.append(f'workbench: the 4x sheet sliced as {got}')
    hole = pg.evaluate("wbParts().all[0].img.data[(3 * 8 + 2) * 4 + 3]")
    if hole != 255: errs.append('workbench: background colour inside a part was cut out')
    pg.evaluate("ACTIONS.wbWrite()"); time.sleep(3)
    paths = sorted(pg.evaluate("[...studioState.artDirty.keys()]"))
    if paths != [f'art/next/parts/front/blobs_{i}.png' for i in (1, 2, 3)]: errs.append(f'workbench: wrote the pictures {paths}')
    have = lambda: pg.evaluate("Object.keys(studioState.D.partKits.parts).filter(k => k.startsWith('blobs_')).length")
    if have() != 3: errs.append('workbench: the parts are not in partKits.json')
    pg.evaluate("undo(); undo()"); time.sleep(0.5)
    if have() or pg.evaluate("studioState.artDirty.size"): errs.append('workbench: two undos left the new parts or pictures')
    pg.evaluate("redo(); redo()"); time.sleep(0.5)
    if have() != 3 or pg.evaluate("studioState.artDirty.size") != 3: errs.append('workbench: two redos did not bring the parts and pictures back')
    # its sheets go, so a later Write (Part mode's step) only writes the sheets it drops (blobs left in would ask
    # whether to replace parts of another kit, and nobody answers)
    pg.evaluate("while (workbench.sheets.length) ACTIONS.wbDrop({ i: 0 })")
    if len(errs) > n: errs[n:] = [f'workbench: {e}' for e in errs[n:]]
    print(f"workbench: {'a kit sliced as the game has it, ' if kit else ''}a 4x sheet snapped, three parts written, undone and redone", flush=True)


def part_mode_steps(pg, errs):
    """Studio track ST-4: the Art workbench's Part mode on cat_leg: the pivot dragged and nudged with the arrow keys
    (each one undo step), a socket rule, a test fit on cat_torso's hip, Mirror to other side, an L painted, and the
    beasts kit written again keeping it all. Everything is undone at the end."""
    n = len(errs)
    # as the Studio's undo and save see it: without its _ keys (_help)
    kits = "JSON.stringify(studioState.D.partKits, (k, v) => (k[0] === '_' && k.length > 1 ? undefined : v))"
    data0 = pg.evaluate(kits)
    pg.evaluate("void openSection('workbench'); ACTIONS.wbMode({ m: 'part' }); ACTIONS.wbpPick({ id: 'cat_leg' })")
    pg.wait_for_selector('#wbpfrontStage .pc-art', timeout=20000); time.sleep(1)
    steps0 = pg.evaluate("studioState.undo.length")
    pv = lambda: pg.evaluate("partJoint(studioState.D.partKits, 'cat_leg', 'front').px")
    Z = pg.evaluate("wbPart.pcs.front.zoom")
    box = pg.locator('#wbpfrontStage .pc-art').bounding_box()
    x0, y0 = pv()
    sx, sy = box['x'] + x0 * Z, box['y'] + y0 * Z
    pg.mouse.move(sx, sy); pg.mouse.down(); pg.mouse.move(sx + 3 * Z, sy + 2 * Z, steps=4); pg.mouse.up(); time.sleep(0.3)
    x1, y1 = pv()
    if (round(x1 - x0), round(y1 - y0)) != (3, 2): errs.append(f'the pivot dragged from {(x0, y0)} to {(x1, y1)}, not by (3, 2)')
    if pg.evaluate("studioState.D.partKits.parts.cat_leg.views.back.pivot") is not None: errs.append('dragging the front pivot moved the back one')
    pg.locator('#wbpfrontStage').hover()
    pg.keyboard.press('ArrowRight'); pg.keyboard.press('Shift+ArrowDown'); time.sleep(0.3)
    x2, y2 = pv()
    if (round(x2 - x1, 2), round(y2 - y1, 2)) != (1, 0.25): errs.append(f'the arrow keys moved the pivot by {(x2 - x1, y2 - y1)}')
    if pg.evaluate("studioState.undo.length") - steps0 != 3: errs.append(f"a drag and two nudges made {pg.evaluate('studioState.undo.length') - steps0} undo steps, not 3")
    # a socket rule of the part's own: the leg's joint takes a foot
    pg.evaluate("ACTIONS.wbpAccept({ n: 'joint', s: 'back' })"); time.sleep(0.3)
    if pg.evaluate("studioState.D.partKits.parts.cat_leg.accepts") != {'joint': ['back']}: errs.append('the socket rule was not kept on the part')
    # test fit on the torso's left hip, then its right one (mirrored there)
    pg.evaluate("wbPart.fit.other = 'cat_torso'; wbPart.fit.socket = 'hipL'; render()"); time.sleep(1.5)
    fit = pg.evaluate("({ z: document.querySelector('#wbpFitfront').dataset.z, w: document.querySelector('#wbpFitfront').width, flip: document.querySelector('#wbpFitfront').dataset.flip })")
    if fit['z'] != 'body,part' or fit['w'] < 20 or fit['flip'] != 'false': errs.append(f'the test fit on hipL drew {fit}')
    pg.evaluate("wbPart.fit.socket = 'hipR'; wbPart.fit.angle = 90; render()"); time.sleep(1.5)
    fit = pg.evaluate("({ flip: document.querySelector('#wbpFitfront').dataset.flip, angle: document.querySelector('#wbpFitfront').dataset.angle })")
    if fit != {'flip': 'true', 'angle': '35'}: errs.append(f'the test fit on hipR at 90 degrees drew {fit} (mirrored, kept to 35)')
    # Mirror to other side: cat_leg_r, pictures flipped, the hand sockets mirrored
    pg.evaluate("ACTIONS.wbpMirror()"); time.sleep(2)
    got = pg.evaluate("""(() => { const K = studioState.D.partKits, R = K.parts.cat_leg_r; return R && { of: R.mirrorOf, file: R.views.front.file,
      art: [...studioState.artDirty.keys()].filter(k => k.includes('cat_leg_r')).sort() }; })()""")
    if got != {'of': 'cat_leg', 'file': 'next/parts/front/cat_leg_r.png', 'art': ['art/next/parts/back/cat_leg_r.png', 'art/next/parts/front/cat_leg_r.png']}:
        errs.append(f'Mirror to other side made {got}')
    flipped = pg.evaluate("""(() => { const a = loadedAtlas('art/next/parts/front/cat_leg.png'), b = loadedAtlas('art/next/parts/front/cat_leg_r.png');
      if (!a || !b) return false; const p = a.getContext('2d').getImageData(0, 0, a.width, a.height).data, q = b.getContext('2d').getImageData(0, 0, b.width, b.height).data;
      for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) for (let k = 0; k < 4; k++) if (p[(y * a.width + x) * 4 + k] !== q[(y * a.width + a.width - 1 - x) * 4 + k]) return false; return true; })()""")
    if not flipped: errs.append('the mirrored picture is not the part flipped')
    # Paint L: a picture 1.2x, painted on, its own pivot
    pg.evaluate("ACTIONS.wbpPaint({ s: 'L' })"); time.sleep(2)
    pg.wait_for_selector('#wbpfrontStage .pc-art', timeout=20000); time.sleep(0.5)
    L = pg.evaluate("studioState.D.partKits.parts.cat_leg.views.front.sizes?.L")
    W = pg.evaluate("studioState.D.partKits.parts.cat_leg.views.front.w")
    if not L or L['file'] != 'next/parts/front/cat_leg_l.png' or L['w'] != round(W * 1.2): errs.append(f'Paint L made {L}')
    Z = pg.evaluate("wbPart.pcs.front.zoom")
    box = pg.locator('#wbpfrontStage .pc-art').bounding_box()
    before = pg.evaluate("studioState.undo.length")
    pg.mouse.click(box['x'] + 1.5 * Z, box['y'] + 1.5 * Z); time.sleep(0.3)
    px = pg.evaluate("loadedAtlas('art/next/parts/front/cat_leg_l.png').getContext('2d').getImageData(1, 1, 1, 1).data[3]")
    if px != 255 or pg.evaluate("studioState.undo.length") != before + 1: errs.append('a pencil click on L did not paint one undoable pixel')
    # the beasts kit written again keeps Part mode's work
    pg.evaluate("ACTIONS.wbMode({ m: 'sheet' })")
    keep = pg.evaluate("JSON.stringify(studioState.D.partKits.parts.cat_leg)")
    dropped = pg.evaluate("""(async () => { const dt = new DataTransfer(); for (const n of ['beasts-front.png', 'beasts-back.png']) { const r = await fetch('/tools/art-source/part-kit/' + n);
      if (!r.ok) return false; dt.items.add(new File([await r.blob()], n, { type: 'image/png' })); }
      document.body.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); return true; })()""")
    if dropped:
        t0 = time.time()
        while time.time() - t0 < 30 and pg.evaluate("workbench.sheets.filter(s => s.name.startsWith('beasts')).length") < 2: time.sleep(0.3)
        time.sleep(0.5)
        pg.evaluate("ACTIONS.wbWrite()"); time.sleep(4)
        if pg.evaluate("JSON.stringify(studioState.D.partKits.parts.cat_leg)") != keep: errs.append('writing the beasts kit again lost Part mode\'s work on cat_leg')
        pg.evaluate("for (let i = workbench.sheets.length - 1; i >= 0; i--) if (workbench.sheets[i].name.startsWith('beasts')) ACTIONS.wbDrop({ i })")
    # everything undone: the parts as they were, no picture left changed
    t0 = time.time()
    while time.time() - t0 < 30 and pg.evaluate("studioState.undo.length") > steps0: pg.evaluate("undo()")
    time.sleep(0.5)
    data1 = pg.evaluate(kits)
    if data1 != data0:
        a, b = json.loads(data0), json.loads(data1)
        diff = [k for k in sorted(set(a) | set(b)) if a.get(k) != b.get(k)]
        diff += [f'parts.{k}' for k in sorted(set(a['parts']) | set(b['parts'])) if a['parts'].get(k) != b['parts'].get(k)]
        diff += [f'sockets.{k}' for k in sorted(set(a.get('sockets', {})) | set(b.get('sockets', {}))) if a.get('sockets', {}).get(k) != b.get('sockets', {}).get(k)]
        errs.append(f'undoing it all did not bring the parts back as they were: {diff[:8]}')
    left = pg.evaluate("[...studioState.artDirty.keys()].filter(k => k.includes('cat_leg'))")
    if left: errs.append(f'undoing it all left pictures changed: {left}')
    pg.evaluate("ACTIONS.wbMode({ m: 'sheet' })")
    if len(errs) > n: errs[n:] = [f'part mode: {e}' for e in errs[n:]]
    print('part mode: pivot dragged and nudged, a socket rule, a test fit on both hips, mirrored, L painted, kept on a rewrite, all undone', flush=True)


def robot_joint_steps(pg, errs):
    """Studio track ST-5: robots on the workbench. The Robots section opens a torso in Part mode; beside the battle
    preview (a robot against a robot), its left shoulder is dragged and nudged, which moves that robot's arm in the
    rig the stage draws, front and back; a test fit of an arm on the other shoulder is not mirrored; Back to computed
    drops the view's points; everything is undone."""
    n = len(errs)
    robots = "JSON.stringify(studioState.D.robots, (k, v) => (k[0] === '_' && k.length > 1 ? undefined : v))"
    data0 = pg.evaluate(robots)
    sp, me = 'bot:ember.bulwark.piston.auger.striders', 'bot:volt.vane.tesla.auger.striders'
    arm = lambda k: pg.evaluate(f"robotRigParts({json.dumps(sp)}, {k}).bones.find(b => b.n === 'armL').at")
    # the Robots section's button opens Part mode on the torso
    pg.evaluate("studioState.sel.rbKind = 'torso'; studioState.sel.rbId = 'bulwark'; studioState.sel.rbBuild = { gem: 'ember', torso: 'bulwark', armL: 'piston', armR: 'auger', legs: 'striders' }; void openSection('robots')")
    time.sleep(0.8)
    pg.locator('[data-act=rbJoints][data-id=bulwark]').click()
    pg.wait_for_selector('#wbpfrontStage .pc-art', timeout=20000); time.sleep(0.5)
    if pg.evaluate("[studioState.sec, workbench.mode, wbPart.src, wbPart.id]") != ['workbench', 'part', 'robots', 'bulwark']:
        errs.append('Edit joints on the workbench did not open Part mode on bulwark')
    # the battle preview: robots offered and drawn, the workbench beside it
    pg.evaluate("void openSection('preview')"); pg.wait_for_selector('#cvWorld', timeout=20000); time.sleep(1)
    opts = pg.evaluate("[...document.querySelectorAll('[data-bp=foe] option')].map(o => o.value)")
    if sp not in opts or me not in opts: errs.append(f'the battle preview does not offer the robots ({[o for o in opts if o.startswith("bot:")]})')
    pg.evaluate(f"battlePreview.me = {json.dumps(me)}; battlePreview.foe = {json.dumps(sp)}; void render()"); time.sleep(3)
    if pg.evaluate("[battleStage.s[0].sp, battleStage.s[1].sp]") != [me, sp]: errs.append('the battle preview did not put the two robots on the stage')
    a0, b0 = arm(1), arm(1.4)
    pg.evaluate("ACTIONS.openBeside({ s: 'workbench' })")
    pg.wait_for_selector('#main2 #wbpfrontStage .pc-art', timeout=20000); time.sleep(0.8)
    steps0 = pg.evaluate("studioState.undo.length")
    Z = pg.evaluate("wbPart.pcs.front.zoom")
    box = pg.locator('#wbpfrontStage .pc-art').bounding_box()
    j = pg.evaluate("(j => [j.sockets.shoulderL[0] * j.w, j.sockets.shoulderL[1] * j.h])(wbpJoint('front'))")
    sx, sy = box['x'] + j[0] * Z, box['y'] + j[1] * Z
    pg.mouse.move(sx, sy); pg.mouse.down(); pg.mouse.move(sx + 2 * Z, sy + 1 * Z, steps=4); pg.mouse.up(); time.sleep(0.3)
    stored = pg.evaluate("studioState.D.robots.parts.bulwark.art.joints")
    want = [round((j[0] + 2) / 29, 3), round((j[1] + 1) / 27, 3)]
    if stored != {'front': {'sockets': {'shoulderL': want}}}: errs.append(f'dragging shoulderL stored {stored}, not {want}')
    a1, b1 = arm(1), arm(1.4)
    if [a1[0] - a0[0], a1[1] - a0[1]] != [2, 1] or [b1[0] - b0[0], b1[1] - b0[1]] != [2, 1]:
        errs.append(f'the robot\'s left arm moved from {a0} to {a1} (back {b0} to {b1}), not by (2, 1) in both views')
    if pg.evaluate(f"rigParts({json.dumps(sp)}, 1).bones.find(b => b.n === 'armL').at") != a1: errs.append('the battle stage draws the robot from an old rig')
    pg.locator('#wbpfrontStage').hover()
    pg.keyboard.press('ArrowLeft'); time.sleep(0.3)
    a2 = arm(1)
    if [a2[0] - a0[0], a2[1] - a0[1]] != [1, 1]: errs.append(f'the arrow key moved the arm to {a2} (from {a0})')
    if pg.evaluate("studioState.undo.length") - steps0 != 2: errs.append(f"a drag and a nudge made {pg.evaluate('studioState.undo.length') - steps0} undo steps, not 2")
    # a test fit: an arm on the right shoulder, the same picture (not mirrored), under the torso from behind
    pg.evaluate("wbPart.fit.other = 'piston'; wbPart.fit.socket = 'shoulderR'; render()"); time.sleep(1.5)
    fit = pg.evaluate("['front', 'back'].map(v => { const c = document.querySelector('#wbpFit' + v); return c && [c.dataset.z, c.dataset.flip]; })")
    if fit != [['body,part', 'false'], ['part,body', 'false']]: errs.append(f'the test fit of piston on shoulderR drew {fit}')
    # Back to computed, then everything undone
    pg.evaluate("ACTIONS.wbpRobotReset({ v: 'front' })"); time.sleep(0.3)
    if pg.evaluate("studioState.D.robots.parts.bulwark.art.joints") is not None or arm(1) != a0: errs.append('Back to computed left stored points')
    t0 = time.time()
    while time.time() - t0 < 30 and pg.evaluate("studioState.undo.length") > steps0: pg.evaluate("undo()")
    time.sleep(0.5)
    if pg.evaluate(robots) != data0: errs.append('undoing it all did not bring robots.json back as it was')
    if arm(1) != a0: errs.append(f'after undoing it all the arm is at {arm(1)}, not {a0}')
    pg.evaluate("ACTIONS.paneClose(); wbPart.src = 'kits'; wbPart.id = ''; workbench.mode = 'sheet'")
    if len(errs) > n: errs[n:] = [f'robot joints: {e}' for e in errs[n:]]
    print('robot joints: opened from Robots, two robots in the battle preview, shoulder dragged and nudged (the rig follows, front and back), a test fit, back to computed, all undone', flush=True)


def generate_steps(pg, errs):
    """map generator MG-1: Walk scenes → Generate… draws a draft route in the game's renderer, the dials change it (a
    biome, terraces, a new seed for the plants only, the clinic dial puts a clinic at the hub) without touching the data
    or the undo history, and Add as a new scene is one undo step. MG-2: a second draft's exit joined to the first new
    scene's meets it, the pair is drawn side by side, and it is added too (both left in, so the proposal at the end
    carries generated scenes). The game's own scenes have no edge exit to join (Copperleaf is an island), so the
    check joins to the scene it made; no legacy map is brought in."""
    n = len(errs)

    def draft():
        pg.evaluate("mapGen.on=false;void openSection('scenes')")
        pg.wait_for_selector('[data-act=genOpen]', timeout=20000)
        pg.click('[data-act=genOpen]')
        t0 = time.time()
        while time.time() - t0 < 60 and not pg.evaluate("!!mapGen.draft&&walkView.id==='_gen'&&walkView.ready"):
            time.sleep(0.3)
        return pg.evaluate("!!mapGen.draft&&walkView.id==='_gen'")

    def accept(name):
        pg.click('[data-act=genAccept]')
        pg.fill('#genName', name)
        pg.click('#dlg [data-dlg="1"]'); time.sleep(0.5)

    pg.evaluate("studioState.sel.scene='copperleaf'")
    maps0, undo0 = pg.evaluate("[Object.keys(studioState.D.maps).length, studioState.undo.length]")
    if not draft():
        errs.append('generate: the draft never drew')
        return
    pg.select_option('select[data-gen=biome]', 'canyon')
    pg.evaluate("""(()=>{const r=document.querySelector('input[data-gen="land.terraces"]');r.value='0.7';r.dispatchEvent(new Event('input',{bubbles:true}))})()""")
    time.sleep(0.8)
    if not pg.evaluate("mapGen.draft.biome==='canyon'&&!!mapGen.draft.steps"): errs.append('generate: the biome and terrace dials changed nothing')
    ground = pg.evaluate("JSON.stringify([mapGen.draft.tiles,mapGen.draft.edgeExits])")
    pg.click('[data-act=genReroll][data-st=plants]'); time.sleep(0.6)
    if pg.evaluate("JSON.stringify([mapGen.draft.tiles,mapGen.draft.edgeExits])") != ground: errs.append('generate: a new seed for the plants changed the ground or the road')
    if pg.evaluate("mapgenUnreachable(mapGen.draft, studioState.D.scenery).length"): errs.append('generate: the hub of the draft does not reach every exit')
    if not pg.evaluate("!!document.querySelector('input[data-gen=\"props.clinic\"]')"): pg.click('[data-act=genOpenG][data-g=props]'); time.sleep(0.3)
    pg.evaluate("(()=>{const c=document.querySelector('input[data-gen=\"props.clinic\"]');c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}))})()")
    t0 = time.time()
    while time.time() - t0 < 30 and not pg.evaluate("mapGen.draft.props.some(p=>p.k==='clinic'&&p.act==='clinic')"): time.sleep(0.3)
    if not pg.evaluate("mapGen.draft.props.some(p=>p.k==='clinic'&&p.act==='clinic')"): errs.append('generate: the clinic dial put no clinic at the hub')
    if pg.evaluate("[Object.keys(studioState.D.maps).length, studioState.undo.length]") != [maps0, undo0]: errs.append('generate: the draft reached the data or the undo history')
    accept('Check Trail')
    if not pg.evaluate("!!studioState.D.maps.checktrail&&studioState.D.maps.checktrail.gen.params.biome==='canyon'&&studioState.D.maps.checktrail.props.every(p=>p.g===1)&&studioState.D.maps.checktrail.edgeExits.length>0"):
        errs.append('generate: Add as a new scene made no scene with its dials and exits')
        return
    if pg.evaluate("studioState.undo.length") != undo0 + 1: errs.append('generate: adding the scene is not one undo step')
    # MG-2: a second draft's first exit joins Check Trail's first exit: it faces it a whole number of metres along, and
    # the draft meets that edge (heights, step, a straight walk across); the pair side by side
    ex = pg.evaluate("studioState.D.maps.checktrail.edgeExits[0].id")
    pg.evaluate("studioState.sel.scene='checktrail'")
    if not draft():
        errs.append('generate: the second draft never drew')
        return
    pg.select_option('select[data-gen-join="0"]', f'checktrail|{ex}')
    t0 = time.time()
    while time.time() - t0 < 60 and not pg.evaluate("mapGen.agree.length>0&&!!mapGen.agree[0].a&&walkView.ready"): time.sleep(0.3)
    a = pg.evaluate("mapGen.agree.length?mapGen.agree[0].a:null")
    if not a or a['dhBand'] > 0.05 or abs(a['raiseExit']) > 0.05 or a['walk']: errs.append(f'generate: the joined exit does not meet Check Trail: {a}')
    rules = pg.evaluate(f"(()=>{{const T=studioState.D.maps.checktrail,d=mapGen.draft,g=mapGen.agree[0];return seamRulesPair(T,T.edgeExits.find(e=>e.id==={json.dumps(ex)}),d,d.edgeExits.find(e=>e.id===g.id))}})()")
    if rules: errs.append(f'generate: the joined pair breaks the seam rules: {rules}')
    pg.click('[data-act=genPair]')
    t0 = time.time()
    while time.time() - t0 < 60 and not pg.evaluate("!!mapGen.shown&&walkView.sc===mapGen.shown&&walkView.ready"): time.sleep(0.3)
    if not pg.evaluate("!!mapGen.shown&&walkView.sc===mapGen.shown"): errs.append('generate: Preview the pair drew nothing')
    pg.click('[data-act=genPair]'); time.sleep(0.5)
    if pg.evaluate("[Object.keys(studioState.D.maps).length, studioState.undo.length]") != [maps0 + 1, undo0 + 1]: errs.append('generate: joining reached the data or the undo history')
    accept('Check Spur')
    if not pg.evaluate("!!studioState.D.maps.checkspur&&studioState.D.maps.checkspur.gen.params.edges[0].from.map==='checktrail'"):
        errs.append('generate: the joined draft was not added with its join')
    elif pg.evaluate("studioState.undo.length") != undo0 + 2: errs.append('generate: adding the joined scene is not one undo step')
    if len(errs) > n: errs[n:] = [f'generate: {e}' for e in errs[n:]]
    else: print('generate: a canyon route drafted and drawn, dials, a plants reroll and a clinic at the hub, added as a scene in one undo step; a second draft joined to it (meets it, the pair drawn), added too', flush=True)


def species_part_steps(pg, errs):
    """Studio track ST-6: the skeleton builder zooms by whole steps with the pixel canvas's keys; the Billies section
    opens the species in Part mode; the head's pivot dragged and nudged keeps the figure drawn where it was (the rig
    changes), its box grown by the right edge, its back draw order set; four undo steps; everything undone."""
    n = len(errs)
    sp = pg.evaluate("studioState.D.lines[0].id + '0'")
    rig = f"JSON.stringify(studioState.rigs[{json.dumps(sp)}])"
    rig0 = pg.evaluate(rig)
    pg.evaluate(f"void openSkeleton({json.dumps(sp)}, 'front')")
    pg.wait_for_selector('.pxed.skel', timeout=20000); time.sleep(0.5)
    z0 = pg.evaluate("skeletonEditor.zoom")
    pg.locator('#skStage').hover(); pg.keyboard.press('+'); time.sleep(0.2)
    z1 = pg.evaluate("skeletonEditor.zoom")
    pg.keyboard.press('3'); time.sleep(0.2)
    z2 = pg.evaluate("skeletonEditor.zoom")
    if z0 != int(z0) or z1 <= z0 or z2 != 4: errs.append(f'the skeleton builder zoomed {z0}, then + {z1}, then 3 {z2} (whole steps; 3 is 4x)')
    pg.click('.pxed.skel [data-sk=close]'); time.sleep(0.3)
    # Billies: Parts on the workbench
    pg.evaluate("studioState.sel.line = studioState.D.lines[0].id; studioState.sel.stage = 0; void openSection('billionaires')"); time.sleep(1)
    pg.locator(f'[data-act=wbsOpen][data-sp="{sp}"]').click()
    pg.wait_for_selector('#wbpfrontStage .pc-art', timeout=20000); time.sleep(0.5)
    if pg.evaluate("[studioState.sec, workbench.mode, wbPart.src, wbPart.sp]") != ['workbench', 'part', 'species', sp]:
        errs.append('Parts on the workbench did not open Part mode on the species')
    pg.evaluate("ACTIONS.wbpPick({ id: 'head' })")
    pg.wait_for_selector('#wbpfrontStage .pc-art', timeout=20000); time.sleep(0.8)
    drawn = f"""(() => {{ const R = rigFor({json.dumps(sp)}, 'front'), c = document.createElement('canvas'); c.width = R.BW; c.height = R.BH;
      drawRig(c.getContext('2d'), R, neutralPose(), 'front'); return c.getContext('2d').getImageData(0, 0, R.BW, R.BH).data.join(','); }})()"""
    d0 = pg.evaluate(drawn)
    steps0 = pg.evaluate("studioState.undo.length")
    handle = lambda h: pg.evaluate(f"wbsHandles('front').find(x => x[0] === '{h}')")
    Z = pg.evaluate("wbPart.pcs.front.zoom")
    box = pg.locator('#wbpfrontStage .pc-art').bounding_box()
    h0 = handle('pivot')
    sx, sy = box['x'] + h0[1] * Z, box['y'] + h0[2] * Z
    pg.mouse.move(sx, sy); pg.mouse.down(); pg.mouse.move(sx + 3 * Z, sy + 2 * Z, steps=4); pg.mouse.up(); time.sleep(0.3)
    h1 = handle('pivot')
    if (round(h1[1] - h0[1]), round(h1[2] - h0[2])) != (3, 2): errs.append(f'the head\'s pivot dragged from {h0[1:]} to {h1[1:]}, not by (3, 2)')
    pg.locator('#wbpfrontStage').hover(); pg.keyboard.press('ArrowLeft'); time.sleep(0.3)
    h2 = handle('pivot')
    if round(h2[1] - h1[1], 2) != -1: errs.append(f'the arrow key moved the pivot by {h2[1] - h1[1]}')
    if pg.evaluate(rig) == rig0: errs.append('moving the pivot did not change the rig')
    if pg.evaluate(drawn) != d0: errs.append('moving the pivot moved the species as drawn')
    b0 = pg.evaluate("wbsCrop('front').box")
    e = handle('edgeR')
    box = pg.locator('#wbpfrontStage .pc-art').bounding_box()
    sx, sy = box['x'] + e[1] * Z, box['y'] + e[2] * Z
    pg.mouse.move(sx, sy); pg.mouse.down(); pg.mouse.move(sx + 2 * Z, sy, steps=4); pg.mouse.up(); time.sleep(0.3)
    b1 = pg.evaluate("wbsCrop('front').box")
    if [b1[k] - b0[k] for k in range(4)] != [0, 0, 2, 0]: errs.append(f'the right edge dragged made the box {b1} (was {b0})')
    pg.evaluate("""(() => { const el = document.querySelector('[data-wbs=z][data-v=back]'); el.value = '3'; el.dispatchEvent(new Event('change', { bubbles: true })); })()""")
    time.sleep(0.3)
    if pg.evaluate(f"studioState.rigs[{json.dumps(sp)}].back.bones.find(b => b.n === 'head').zb") != 3: errs.append('the back draw order was not stored as zb')
    if pg.evaluate("studioState.undo.length") - steps0 != 4: errs.append(f"a drag, a nudge, an edge and a z made {pg.evaluate('studioState.undo.length') - steps0} undo steps, not 4")
    if not pg.evaluate("studioState.rigsDirty"): errs.append('the rigs are not marked to save')
    t0 = time.time()
    while time.time() - t0 < 30 and pg.evaluate("studioState.undo.length") > steps0: pg.evaluate("undo()")
    time.sleep(0.5)
    if pg.evaluate(rig) != rig0: errs.append('undoing it all did not bring the rig back as it was')
    pg.evaluate("wbPart.src = 'kits'; wbPart.id = ''; workbench.mode = 'sheet'")
    if len(errs) > n: errs[n:] = [f'species parts: {e}' for e in errs[n:]]
    print('species parts: builder zoom keys, opened from Billies, the head\'s pivot dragged and nudged (drawn the same), an edge, a back z, all undone', flush=True)


def wardrobe_steps(pg, errs):
    """Studio track ST-6: the wardrobe paints on the shared pixel canvas. A pencil click on an item's piece paints it
    and marks the colour area picked in its mask, one undo step (undone and redone together); the Colour area brush
    changes the mask only; Grow piece gives the piece room (a new place at the bottom of the picture and the mask);
    everything is undone."""
    n = len(errs)
    k = pg.evaluate("Object.keys(studioState.D.wardrobe.items).find(k => studioState.D.wardrobe.items[k].mask && studioState.D.wardrobe.items[k].pieces.some(p => p.v === 'front'))")
    item = f"studioState.D.wardrobe.items[{json.dumps(k)}]"
    pg.evaluate(f"wardrobeEditor.sel = {json.dumps(k)}; wardrobeEditor.view = 'front'; wardrobeEditor.piece = {item}.pieces.findIndex(p => p.v === 'front'); void openSection('wardrobe')")
    pg.wait_for_selector('#wdStage .pc-art', timeout=20000); time.sleep(1)
    data0 = pg.evaluate(f"JSON.stringify({item})")
    img, mask = pg.evaluate(f"['art/' + {item}.img, 'art/' + {item}.mask]")
    px = lambda path, x, y: pg.evaluate(f"[...loadedAtlas({json.dumps(path)}).getContext('2d').getImageData({x}, {y}, 1, 1).data]")
    steps0 = pg.evaluate("studioState.undo.length")
    r = pg.evaluate(f"{item}.pieces[wardrobeEditor.piece].r")
    x, y = r[0] + r[2] // 2, r[1] + r[3] // 2
    pg.evaluate("ACTIONS.wdArea({ a: 2 })"); pg.wait_for_selector('#wdStage .pc-art', timeout=20000); time.sleep(0.5)
    pg.evaluate("pixelCanvasTool(wardrobeEditor.pc, 'pen'); pixelCanvasColor(wardrobeEditor.pc, '#123456')")
    i0, m0 = px(img, x, y), px(mask, x, y)
    Z = pg.evaluate("wardrobeEditor.pc.zoom")
    pg.locator('#wdStage').scroll_into_view_if_needed()
    box = pg.locator('#wdStage .pc-art').bounding_box()
    pg.mouse.click(box['x'] + (x + 0.5) * Z, box['y'] + (y + 0.5) * Z); time.sleep(0.4)
    i1, m1 = px(img, x, y), px(mask, x, y)
    if i1 != [0x12, 0x34, 0x56, 255] or m1 != [46, 168, 74, 255]: errs.append(f'a pencil click made the picture {i1} and the mask {m1} (want #123456 and area 2)')
    if pg.evaluate("studioState.undo.length") - steps0 != 1: errs.append('a stroke and its mask were not one undo step')
    pg.evaluate("undo()"); time.sleep(0.3)
    if px(img, x, y) != i0 or px(mask, x, y) != m0: errs.append('undo did not take back the picture and the mask together')
    pg.evaluate("redo()"); time.sleep(0.3)
    if px(img, x, y) != i1 or px(mask, x, y) != m1: errs.append('redo did not bring back the picture and the mask together')
    # the Colour area brush: area 3 on the same pixel, the picture untouched
    pg.evaluate("ACTIONS.wdArea({ a: 3 })"); pg.wait_for_selector('#wdStage .pc-art', timeout=20000); time.sleep(0.5)
    pg.evaluate("pixelCanvasTool(wardrobeEditor.pc, 'area')")
    Z = pg.evaluate("wardrobeEditor.pc.zoom")
    pg.locator('#wdStage').scroll_into_view_if_needed()
    box = pg.locator('#wdStage .pc-art').bounding_box()
    pg.mouse.click(box['x'] + (x + 0.5) * Z, box['y'] + (y + 0.5) * Z); time.sleep(0.4)
    if px(img, x, y) != i1 or px(mask, x, y) != [58, 98, 224, 255]: errs.append(f'the Colour area brush made {px(img, x, y)} and {px(mask, x, y)}')
    # Grow piece
    h0 = pg.evaluate(f"loadedAtlas({json.dumps(img)}).height")
    pg.evaluate("ACTIONS.wdGrow()"); pg.wait_for_selector('#wdStage .pc-art', timeout=20000); time.sleep(0.5)
    r2 = pg.evaluate(f"{item}.pieces[wardrobeEditor.piece].r")
    hs = pg.evaluate(f"[loadedAtlas({json.dumps(img)}).height, loadedAtlas({json.dumps(mask)}).height]")
    if r2 != [1, h0, r[2] + 4, r[3] + 4] or hs[0] != hs[1] or hs[0] < h0 + r[3] + 4: errs.append(f'Grow piece made {r2} on pictures {hs} high (was {r}, {h0})')
    t0 = time.time()
    while time.time() - t0 < 30 and pg.evaluate("studioState.undo.length") > steps0: pg.evaluate("undo()")
    time.sleep(0.5)
    if pg.evaluate(f"JSON.stringify({item})") != data0: errs.append('undoing it all did not bring the item back as it was')
    if px(img, x, y) != i0 or px(mask, x, y) != m0 or pg.evaluate(f"loadedAtlas({json.dumps(img)}).height") != h0: errs.append('undoing it all left pixels changed')
    if len(errs) > n: errs[n:] = [f'wardrobe: {e}' for e in errs[n:]]
    print('wardrobe: a pencil click and its mask one undo step (undone and redone), the Colour area brush, Grow piece, all undone', flush=True)


def ui_steps(pg, errs):
    """UI-3: the UI look section (studio/js/ui-editor.js): a dial changed shows in the preview frame (the UI gallery),
    Undo puts the data and the preview back; a screen's own colour reaches that screen only and ↺ takes it away; a
    preset applies and undoes; Find and the Check's Show me reach a dial; Hold to compare shows the saved look. The
    large cut is left at 20 px, so the proposal at the end must carry uiTheme.json with it."""
    n = len(errs)
    # a variable as the preview frame's first card has it
    PV = """(v => { const f = document.querySelector('#uiPv'), w = f && f.contentWindow;
      const el = w && w.galleryLook && w.document.querySelector('.g-wrap pb-card');
      return el ? w.getComputedStyle(el).getPropertyValue(v).trim() : null })"""
    def pv(v): return pg.evaluate(f"{PV}({json.dumps(v)})")
    def wait_pv(v, want, what):
        try: pg.wait_for_function(f"{PV}({json.dumps(v)}) === {json.dumps(want)}", timeout=20000)
        except Exception: errs.append(f'{what}: the preview shows {v} = {pv(v)!r}, wanted {want!r}')
    pg.evaluate("void openSection('ui')")
    try: pg.wait_for_function(f"{PV}('--c-text') !== null", timeout=30000)
    except Exception:
        errs.append('the preview frame never showed the gallery'); return
    p = 'uiTheme.defaults.color.light.text'
    was, before, undo0 = pg.evaluate(f"[readPath('{p}'), {PV}('--c-text'), studioState.undo.length]")
    box = pg.locator(f'#uiSet input.hex[data-p="{p}"]')
    box.fill('#102030'); box.press('Tab')
    if pg.evaluate(f"readPath('{p}')") != '#102030': errs.append('the text colour field did not reach the data')
    wait_pv('--c-text', '#102030', 'a colour')
    if not pg.evaluate(f"!!document.querySelector('#uiSet .eng-f.own[data-path=\"{p}\"]')"): errs.append('a changed dial is not marked')
    if not pg.evaluate("!!document.querySelector('#uiSet [data-aa=\"light.text\"]')"): errs.append('the text colour has no contrast badge')
    pg.click('#undoBtn')
    if pg.evaluate(f"readPath('{p}')") != was: errs.append('Undo did not put the colour back')
    wait_pv('--c-text', before, 'undo')
    # one screen's own colour: on that screen only; ↺ takes the override away
    pg.select_option('#uiScope', 'team')
    q = 'uiTheme.overrides.team.color.light.text'
    box = pg.locator(f'#uiSet input.hex[data-p="{q}"]')
    box.fill('#AA2020'); box.press('Tab')
    if pg.evaluate(f"[readPath('{q}'), readPath('{p}')]") != ['#AA2020', was]: errs.append('a screen colour did not stay on the screen')
    wait_pv('--c-text', '#aa2020', 'a screen colour')
    if pg.evaluate("document.querySelector('#uiPv').contentWindow.document.querySelector('.g-wrap').dataset.uiScreen") != 'team':
        errs.append('the preview does not show the screen')
    pg.click('#uiSet [data-act=uiReset][data-r="color.light.text"]')
    if pg.evaluate("JSON.stringify(studioState.D.uiTheme.overrides)") != '{}': errs.append('↺ left the screen an override')
    wait_pv('--c-text', before, 'a screen colour taken away')
    pg.select_option('#uiScope', 'game')
    # a preset, undone
    pg.click('#uiSet [data-act=uiPreset][data-k=alpha05]')
    if pg.evaluate("studioState.D.uiTheme.defaults.type.voice") != 'Pixelify Sans': errs.append('the alpha05 preset did not apply')
    try: pg.wait_for_function(f"({PV}('--font-voice') || '').includes('Pixelify')", timeout=20000)
    except Exception: errs.append(f"the preset is not in the preview ({pv('--font-voice')!r})")
    pg.click('#undoBtn')
    if pg.evaluate("studioState.D.uiTheme.defaults.type.voice") != 'Jersey 15': errs.append('Undo did not take the preset back')
    # Find and the Check reach a dial
    pg.evaluate("buildSearchIndex().find(e => e.x.includes('shape.families.tab.corners')).fn()")
    try: pg.wait_for_selector('#uiSet .eng-f[data-path="uiTheme.defaults.shape.families.tab.corners"]', timeout=10000)
    except Exception: errs.append('Find did not open the tabs’ corners')
    pg.evaluate("studioState.D.uiTheme.overrides.bag = {color: {dark: {text2: '#2A3A30'}}}")
    found = pg.evaluate("runCheck().filter(c => c.go === 'ui' && c.lvl === 'error').map(c => [c.msg, c.sel])")
    if len(found) != 2 or found[0][1] != {'uiFocus': {'scope': 'bag', 'rel': 'color.dark.text2'}}: errs.append(f'the Check found {found}')
    pg.evaluate("delete studioState.D.uiTheme.overrides.bag")
    # the large cut, compared with the saved look, and left changed for the proposal
    pg.evaluate("uiEditor.open.shape = 1; refreshUiSettings()")
    pg.evaluate("""(()=>{const r=document.querySelector('#uiSet input[data-p="uiTheme.defaults.shape.cutLg"]');r.value='20';
      r.dispatchEvent(new Event('input',{bubbles:true}));r.dispatchEvent(new Event('change',{bubbles:true}))})()""")
    wait_pv('--cut-lg', '20px', 'the large cut')
    pg.locator('#uiCmp').hover(); pg.mouse.down()
    wait_pv('--cut-lg', '12px', 'Hold to compare')
    pg.mouse.up()
    wait_pv('--cut-lg', '20px', 'letting go of compare')
    if pg.evaluate("studioState.D.uiTheme.defaults.shape.cutLg") != 20: errs.append('the large cut did not reach the data')
    if pg.evaluate("studioState.undo.length") < undo0 + 2: errs.append('the edits are not undo steps')
    if len(errs) > n: errs[n:] = [f'ui: {e}' for e in errs[n:]]
    else: print('ui: a colour previewed and undone, a screen colour on its screen and taken away, a preset undone, Find and the Check, compare; the large cut left at 20 px', flush=True)


def ui_tools_steps(pg, errs):
    """UI-3b: the UI look section's tools. The rule check: the Check has one report line (not in its badge) and its
    Show me lists the raw values, each line's text equal to that line of the file. UI-6: over a ceiling it's a problem."""
    n = len(errs)
    pg.evaluate("uiRulesLoad()")
    try: pg.wait_for_function("uiRules.state === 'ready' || uiRules.state === 'failed'", timeout=60000)
    except Exception: errs.append('the rule check never read the files')
    if pg.evaluate("uiRules.state") != 'ready': errs.append(f"the rule check: {pg.evaluate('uiRules.err')}")
    line = pg.evaluate("runCheck().find(c => c.lvl === 'info' && c.msg.startsWith('UI rules'))")
    if not line or line.get('go') != 'ui': errs.append(f'the Check has no rule report line ({line})')
    # UI-6: one raw value over a rule's ceiling makes the line a problem
    over = pg.evaluate("(() => { const f = uiRules.found; uiRules.found = f.concat(Array.from({length: UI_LINT_CEILING.radius + 1 - f.filter(x => x.rule === 'radius').length}, () => ({rule: 'radius', file: 'game/css/x.css', line: 1, text: ''}))); const c = runCheck().find(c => c.msg.startsWith('UI rules')); uiRules.found = f; return c })()")
    if not over or over.get('lvl') != 'error' or 'ceiling' not in over.get('msg', ''): errs.append(f'a rule over its ceiling is not a problem in the Check ({over})')
    pg.evaluate("void openSection('check')")
    pg.evaluate("scheduleCheck(true)"); time.sleep(0.3)
    badge = pg.evaluate("document.querySelector('#checkCount').textContent")
    real = pg.evaluate("runCheck().filter(c => c.lvl !== 'info').length")
    if not real and badge != '✓': errs.append(f'the Check badge counts the report ({badge})')
    try:
        pg.wait_for_selector('#checkList li.info button[data-act=fix]', timeout=10000)
        pg.click('#checkList li.info button[data-act=fix]')
        pg.wait_for_selector('#uiRules .ui-rules li', timeout=20000)
    except Exception: errs.append('Show me did not open the rule list')
    pg.select_option('#uiRulesRule', 'important'); time.sleep(0.2)
    rows = pg.evaluate("[...document.querySelectorAll('#uiRules .ui-rules li')].slice(0, 5).map(li => [li.dataset.rule, li.querySelector('a').textContent, li.querySelector('a').href, li.querySelector('code').textContent])")
    if not rows: errs.append('the rule list is empty for !important')
    for rule, at, href, text in rows:
        f, ln = at.rsplit(':', 1)
        lines = (REPO / 'game' / f).read_text().split('\n')
        if rule != 'important' or lines[int(ln) - 1].strip()[:200] != text or '!important' not in text: errs.append(f'the rule list says {at} {text!r}')
        if not href.endswith(f'/game/{f}#L{ln}') or 'github.com/nojiroh/pocket-billies/blob/' not in href: errs.append(f'the link {href}')
    # inspect: a tap on the gold button picks it (it doesn't press) and lists the variables it reads, with their dials
    pg.evaluate("void openSection('ui')")
    try: pg.wait_for_function("(w => w && w.galleryLook && w.document.querySelector('pb-button[kind=gold]'))(document.querySelector('#uiPv').contentWindow)", timeout=30000)
    except Exception: errs.append('the preview never showed the gallery')
    pg.click('#uiInsp')
    pg.frame_locator('#uiPv').locator('.g-wrap pb-button[kind=gold]').first.click()
    try: pg.wait_for_selector('#uiInspect tr[data-var]', timeout=10000)
    except Exception: errs.append(f"inspect listed nothing: {pg.evaluate('document.querySelector(\"#uiInspect\").textContent')!r}")
    info = pg.evaluate("[document.querySelector('#uiInspect .ui-insp-h').textContent, [...document.querySelectorAll('#uiInspect tr[data-var]')].map(r => [r.dataset.var, r.querySelectorAll('[data-act=uiInspectGo]').length])]")
    if 'pb-button' not in info[0] or 'Buttons' not in info[0]: errs.append(f'inspect named the part {info[0]!r}')
    names = [v for v, _ in info[1]]
    if not any(v.startswith('--clip-') for v in names) or not any(k for v, k in info[1] if v.startswith('--clip-')): errs.append(f'inspect: no cut shape with its dial among {names}')
    if not pg.evaluate("!!document.querySelector('#uiPv').contentWindow.document.querySelector('#studioInspect div')"): errs.append('inspect drew no outline')
    go = pg.evaluate("(b => b && b.dataset.r)(document.querySelector('#uiInspect tr[data-var^=\"--clip-\"] [data-act=uiInspectGo]'))")
    if go:
        pg.click(f'#uiInspect tr[data-var^="--clip-"] [data-act=uiInspectGo][data-r="{go}"]')
        try: pg.wait_for_selector(f'#uiSet .eng-f[data-path="uiTheme.defaults.{go}"]', timeout=10000)
        except Exception: errs.append(f'the dial button did not open {go}')
    pg.click('#uiInsp')
    if pg.evaluate("!!document.querySelector('#uiPv').contentWindow.document.querySelector('#studioInspect div')"): errs.append('the outline stayed after Inspect went off')
    # Connections (Ctrl+L) on a dial: what it writes and the parts in the preview that read it; a part shows there
    pg.evaluate("uiEditor.open.color = 1; refreshUiSettings()")
    pg.locator('#uiSet input.hex[data-p="uiTheme.defaults.color.light.text"]').focus()
    pg.keyboard.press('Control+l')
    try: pg.wait_for_selector('#lnkB .lk-n.k-part', timeout=10000)
    except Exception: errs.append(f"Connections on a dial listed no parts: {pg.evaluate('(document.querySelector(\"#lnkB\")||{}).textContent')!r}")
    lk = pg.evaluate("[[...document.querySelectorAll('#lnkB .lk-n.k-var')].map(b => b.textContent), document.querySelectorAll('#lnkB .lk-n.k-part').length, (document.querySelector('#lnkB h4')||{}).textContent]")
    if '--c-text' not in ' '.join(lk[0]) or lk[1] < 3: errs.append(f'Connections on the text colour: {lk}')
    if lk[1]:
        pg.click('#lnkB .lk-n.k-part >> nth=0')
        try: pg.wait_for_function("(w => !!w.document.querySelector('#studioFlash div'))(document.querySelector('#uiPv').contentWindow)", timeout=5000)
        except Exception: errs.append('a part in Connections did not show in the preview')
    pg.keyboard.press('Control+l')
    # overlays: a planted 30 px button, a faint text and glass three deep are marked; switched off, nothing is
    pg.evaluate("""(() => { const d = document.querySelector('#uiPv').contentWindow.document, m = d.querySelector('.g-wrap');
      m.insertAdjacentHTML('afterbegin', '<div id="plant" style="background:#ffffff;padding:8px"><button id="plantTap" style="width:30px;height:30px">x</button><span id="plantFaint" style="color:#dddddd;font-size:14px">faint words</span>'
        + '<div id="g1" style="backdrop-filter:blur(4px);padding:4px"><div id="g2" style="backdrop-filter:blur(4px);padding:4px"><div id="g3" style="backdrop-filter:blur(4px);height:20px"></div></div></div></div>');
      d.querySelector('#plant').scrollIntoView() })()""")
    for k in ['tap', 'contrast', 'glass']: pg.click(f'[data-act=uiOverlay][data-k={k}]')
    ov = pg.evaluate("""(() => { const S = uiOverlays.last; if (!S) return null;
      return { tap: S.tap.some(t => t.el.id === 'plantTap'), faint: S.contrast.some(c => c.el.id === 'plantFaint'),
        deep: S.glass.filter(g => g.depth > 2).map(g => g.el.id), boxes: document.querySelector('#uiPv').contentWindow.document.querySelectorAll('#studioOverlay > div').length,
        note: document.querySelector('#uiOvNote').textContent } })()""")
    if not ov or not ov['tap'] or not ov['faint'] or ov['deep'] != ['g3'] or not ov['boxes'] or 'Tap targets under 44 px' not in ov['note']: errs.append(f'overlays: {ov}')
    for k in ['tap', 'contrast', 'glass']: pg.click(f'[data-act=uiOverlay][data-k={k}]')
    if pg.evaluate("document.querySelector('#uiPv').contentWindow.document.querySelectorAll('#studioOverlay > div').length"): errs.append('overlays stayed when switched off')
    pg.evaluate("document.querySelector('#uiPv').contentWindow.document.querySelector('#plant').remove()")
    if len(errs) > n: errs[n:] = [f'ui tools: {e}' for e in errs[n:]]
    else: print(f"ui tools: overlays ({ov and ov['note']}); Connections on the text colour ({lk[1]} parts read {len(lk[0])} variables); inspect (the gold button: {len(names)} variables, its cut opens {go}); the rule report ({pg.evaluate('uiRules.found.length')} raw values) with Show me to lines that match the files", flush=True)


def ui_screens_steps(pg, errs):
    """UI-3b: the UI look preview's real screens: the Team screen is the game itself at its fixture (team), it follows
    a colour edit and its Undo, light and dark, Hold to compare; inspect and the overlays work on it; then the Bag,
    the dialogue box and a battle open at their fixtures. Back to the gallery at the end."""
    n = len(errs)
    W = "document.querySelector('#uiPv').contentWindow"
    def screen_var(sel, v):
        return pg.evaluate(f"(w => {{ const el = w.document.querySelector({json.dumps(sel)}); return el ? w.getComputedStyle(el).getPropertyValue({json.dumps(v)}).trim() : null }})({W})")
    def open_view(v, sel):
        pg.evaluate("void openSection('ui')")
        pg.click(f'[data-act=uiPv][data-g=view][data-v={v}]')
        try:
            pg.wait_for_function(f"(w => w && w.location.search.includes('fixture={v}') && !!w.document.querySelector({json.dumps(sel)}) && (!w.document.querySelector('#loader') || w.getComputedStyle(w.document.querySelector('#loader')).display === 'none' || w.document.querySelector('#loader').hidden || w.getComputedStyle(w.document.querySelector('#loader')).visibility === 'hidden' || w.getComputedStyle(w.document.querySelector('#loader')).opacity === '0'))({W})", timeout=150000)
            return True
        except Exception:
            errs.append(f'the {v} screen never showed in the preview'); return False
    t0 = time.time()
    if open_view('team', 'main.s-team'):
        print(f'ui screens: the Team screen started in {time.time() - t0:.0f} s', flush=True)
        p = 'uiTheme.defaults.color.light.text'
        before = screen_var('main.s-team', '--c-text')
        pg.evaluate("uiEditor.open.color = 1; refreshUiSettings()")
        box = pg.locator(f'#uiSet input.hex[data-p="{p}"]')
        box.fill('#102030'); box.press('Tab')
        try: pg.wait_for_function(f"(w => w.getComputedStyle(w.document.querySelector('main.s-team')).getPropertyValue('--c-text').trim() === '#102030')({W})", timeout=15000)
        except Exception: errs.append(f"the Team screen did not follow the colour ({screen_var('main.s-team', '--c-text')!r})")
        pg.locator('#uiCmp').hover(); pg.mouse.down()
        try: pg.wait_for_function(f"(w => w.getComputedStyle(w.document.querySelector('main.s-team')).getPropertyValue('--c-text').trim() === {json.dumps(before)})({W})", timeout=10000)
        except Exception: errs.append('Hold to compare did not show the saved look on the Team screen')
        pg.mouse.up()
        pg.click('#undoBtn')
        try: pg.wait_for_function(f"(w => w.getComputedStyle(w.document.querySelector('main.s-team')).getPropertyValue('--c-text').trim() === {json.dumps(before)})({W})", timeout=10000)
        except Exception: errs.append('Undo did not reach the Team screen')
        pg.click('[data-act=uiPv][data-g=mode][data-v=dark]')
        try: pg.wait_for_function(f"{W}.document.documentElement.dataset.theme === 'dark'", timeout=10000)
        except Exception: errs.append('the Team screen did not go dark')
        pg.click('[data-act=uiPv][data-g=mode][data-v=light]')
        # inspect a team row, and the overlays, on the game itself
        pg.click('#uiInsp')
        pg.frame_locator('#uiPv').locator('main.s-team .u-row, main.s-team .u-hero').first.click()
        try: pg.wait_for_selector('#uiInspect tr[data-var]', timeout=10000)
        except Exception: errs.append('inspect found nothing on the Team screen')
        where = pg.evaluate("(document.querySelector('#uiInspect .ui-insp-h') || {}).textContent || ''")
        if 'Team screen' not in where: errs.append(f'inspect on the Team screen says {where!r}')
        pg.click('#uiInsp')
        pg.click('[data-act=uiOverlay][data-k=glass]')
        note = pg.evaluate("document.querySelector('#uiOvNote').textContent")
        if 'Blurred surfaces on screen' not in note: errs.append(f'the glass overlay on the Team screen: {note!r}')
        pg.click('[data-act=uiOverlay][data-k=glass]')
        print(f'ui screens: Team followed a colour, compare, undo and dark; inspect ({where.strip()}); {note}', flush=True)
    for v, sel in [('bag', 'main.s-bag'), ('talk', '#talk:not([hidden]) .talk-box'), ('battle', '.battle')]:
        t0 = time.time()
        if open_view(v, sel): print(f'ui screens: {v} in {time.time() - t0:.0f} s', flush=True)
    pg.click('[data-act=uiPv][data-g=view][data-v=gallery]')
    try: pg.wait_for_function(f"(w => w && typeof w.galleryLook === 'function')({W})", timeout=30000)
    except Exception: errs.append('the gallery did not come back')
    # before/after: the saved look beside the edited one, scrolled together
    pg.click('#uiSplit')
    B = "document.querySelector('#uiPvBefore').contentWindow"
    try: pg.wait_for_function(f"(w => w && typeof w.galleryLook === 'function' && w.document.querySelector('pb-card'))({B})", timeout=30000)
    except Exception: errs.append('the before frame never showed the gallery')
    pg.evaluate("uiEditor.open.shape = 1; refreshUiSettings()")
    pg.evaluate("""(()=>{const r=document.querySelector('#uiSet input[data-p="uiTheme.defaults.shape.cutLg"]');r.value='30';
      r.dispatchEvent(new Event('input',{bubbles:true}));r.dispatchEvent(new Event('change',{bubbles:true}))})()""")
    cut = lambda w: pg.evaluate(f"(w => w.getComputedStyle(w.document.querySelector('pb-card')).getPropertyValue('--cut-lg').trim())({w})")
    try: pg.wait_for_function(f"(w => w.getComputedStyle(w.document.querySelector('pb-card')).getPropertyValue('--cut-lg').trim() === '30px')({W})", timeout=10000)
    except Exception: pass
    if cut(W) != '30px' or cut(B) == '30px': errs.append(f'before/after: after {cut(W)!r}, before {cut(B)!r}')
    pg.evaluate(f"{W}.scrollTo(0, 600)"); time.sleep(0.4)
    if abs(pg.evaluate(f"{B}.scrollY") - pg.evaluate(f"{W}.scrollY")) > 2: errs.append('the before frame did not scroll with the after one')
    pg.click('#undoBtn')
    pg.click('#uiSplit')
    if pg.evaluate("!!document.querySelector('#uiPvBeforeSlot')"): errs.append('before/after did not close')
    else: print(f'ui screens: before/after (before {cut(B) if False else "the saved cut"}, after 30px, scrolled together)', flush=True)
    if len(errs) > n: errs[n:] = [f'ui screens: {e}' for e in errs[n:]]


def studio_test_steps(pg, errs):
    """Studio track ST-T: the Studio self-test (studio/js/studio-test.js) runs whole. It fails on an error, an edit
    that didn't come back with its undo, data not put back or a token in its report; never on a time, since a headless
    browser draws in software."""
    pg.evaluate("window.__stR = null; startStudioTest({ quiet: true, planted: ['ghp_stand-in'] }).then(r => window.__stR = r)")
    t0 = time.time()
    while time.time() - t0 < 600 and not pg.evaluate("!!window.__stR"):
        time.sleep(1)
    r = pg.evaluate("window.__stR")
    if not r:
        errs.append('studio test: no report in 600 s'); return
    for e in r['errors']: errs.append(f"studio test: {e['where']}: {e['msg']}")
    if not r['restored']: errs.append('studio test: the data was not put back as it was')
    for s in r['sections']:
        if s.get('edit') and s['edit']['back'] is False: errs.append(f"studio test: the edit in {s['id']} did not come back with undo")
        if s.get('outside'): errs.append(f"studio test: opening {s['id']} changed the data outside an edit: {', '.join(s['outside'])}")
    if r['privacy']: errs.append('studio test: the report holds ' + ', '.join(r['privacy']))
    if pg.evaluate("studioProbe.on !== null || studioProbe.running"): errs.append('studio test: the probe was left on')
    edits = sum(1 for s in r['sections'] if s.get('edit'))
    if os.environ.get('PB_STUDIO_TEST_OUT'):  # Studio plan Phase 6: the report kept, for timings before and after
        Path(os.environ['PB_STUDIO_TEST_OUT']).write_text(json.dumps(r, indent=1))
    print(f"studio test: {len(r['sections'])} sections, {edits} edits undone, {len(r['findings'])} findings, {r['seconds']} s", flush=True)
    U = r.get('undo') or {}
    big = sorted((s for s in r['sections'] if s.get('edit') and s['edit'].get('stepBytes')), key=lambda s: -s['edit']['stepBytes'])[:3]
    print(f"studio test: the undo holds {U.get('fullMB')} MB after {U.get('edits')} edits (the data once {U.get('lastMB')} MB, the steps {U.get('stepsMB')} MB; biggest: "
          + ', '.join(f"{s['id']} {s['edit']['path']} {s['edit']['stepBytes'] / 1e3:.0f} kB" for s in big) + ')', flush=True)
    # Studio plan T1.2: the undo holds only the parts an edit changed, and puts back only those
    u = pg.evaluate("""(() => {
      const S = studioState, ids = Object.keys(S.D.maps), id = ids[0], before = {};
      const text = v => JSON.stringify(v, SAVE_REPLACER);  // the undo, like saving, keeps no _ caches
      commit(true);
      const was = text(S.D.maps[id]), steps = S.undo.length;
      for (const k of ids) before[k] = S.D.maps[k];
      S.D.maps[id].name = (S.D.maps[id].name || '') + ' x';
      changed();
      commit(true);
      const step = S.undo[S.undo.length - 1], parts = step && step.parts ? Object.keys(step.parts) : [];
      undo();
      const same = ids.filter(k => k !== id && S.D.maps[k] !== before[k]);
      return { parts, steps: S.undo.length - steps, back: text(S.D.maps[id]) === was, same, n: ids.length };
    })()""")
    if u['parts'] != ['D/maps/' + pg.evaluate("Object.keys(studioState.D.maps)[0]")]: errs.append(f"undo: a map edit's step holds {u['parts']}")
    if not u['back']: errs.append('undo: the map edit did not come back')
    if u['same']: errs.append(f"undo: an undo of one map replaced other maps: {u['same'][:5]}")
    if u['steps'] != 0: errs.append(f"undo: the edit and its undo left {u['steps']} steps")
    print(f"undo: a map edit's step holds {u['parts']}; its undo kept the other {u['n'] - 1} maps the same objects", flush=True)


# Studio plan T2.2: the same seed's run as the game's own start makes it in Node (tools/test/setup-real.mjs, the
# logic on the game's data), each node as type:biome, with no unlocks and with all of them
RUN_LAB_NODE = """import { GAME_DATA as D, modules } from './tools/test/setup-real.mjs';
const U = { unlocks: D.unlocks, buildings: D.buildings }, out = {};
for (const [k, ids] of [['none', []], ['all', Object.keys(D.unlocks)]]) {
  const un = modules.unlocks.runUnlocks({ meta: { unlocks: Object.fromEntries(ids.map(i => [i, 1])) } }, U);
  const p = modules['run-start'].runStartPlan('LABCHECK7', { nodeTypes: D.nodeTypes, biomes: D.biomes, rules: D.rules.run, unlockData: U }, { unlocks: un });
  out[k] = p.map.nodes.map(n => n.type + ':' + n.biome);
}
/* T2.4: what the logic worker's panel must show: runPreview with no unlocks, for the first mini-boss and town */
const P = modules['run-preview'].runPreview('LABCHECK7', { unlocks: [] }),
  at = t => P.map.nodes.findIndex(n => n.type === t),
  g = at('miniboss'), w = at('town'), F = P.nodes[g].foe;
out.preview = {
  guard: { i: g, foe: [F.from, F.team.map(e => e.sp + '@' + e.lvl).join(',')], wild: P.nodes[g].wild.list.map(e => e.join(':')).join(',') },
  town: { i: w, shop: P.nodes[w].shop.map(S => [S.day, S.stock.map(x => x.item || 'coin:' + x.coin).join(','), S.relic]) },
  offers: P.relicOffers.map(o => o.join(',')),
};
console.log(JSON.stringify(out));"""


def run_lab_steps(pg, errs):
    """Studio plan T2.2: the Run Lab draws the game's own run start. A typed seed's map equals, node for node, the one
    the game's logic makes in Node on the same data, with no unlocks and with all; an edit elsewhere (nodeTypes) redraws
    it within 100 ms; a node's click shows its seed; beside the loaded data shows the loaded map too."""
    n = len(errs)
    tree = ROOT if (ROOT / 'tools/test/setup-real.mjs').is_file() else REPO  # the served tree's data, when it has the loader
    r = subprocess.run(['node', '--input-type=module', '-e', RUN_LAB_NODE], cwd=tree, capture_output=True, text=True)
    try: want = json.loads(r.stdout.strip().splitlines()[-1])
    except Exception: errs.append(f'run lab: the Node run start failed: {r.stderr[-400:]}'); return
    pg.evaluate("void openSection('runlab')")
    pg.wait_for_selector('#rlSeed', timeout=20000)
    got = lambda: pg.evaluate("[...(document.querySelector('#main .rl-map')||{querySelectorAll:()=>[]}).querySelectorAll('.rl-node')].map(g=>g.dataset.type+':'+g.dataset.biome)")
    def settle(before):
        t0 = time.time()
        while time.time() - t0 < 5 and got() == before: time.sleep(0.05)
        return got()
    first = got()
    pg.fill('#rlSeed', 'LABCHECK7')
    none = settle(first)
    if none != want['none']: errs.append(f"run lab: seed LABCHECK7 with no unlocks drew {none}, the game's start makes {want['none']}")
    pg.select_option('#rlUnlocks', 'all')
    every = settle(none) if want['all'] != want['none'] else got()
    if every != want['all']: errs.append(f"run lab: with all unlocks it drew {every}, the game's start makes {want['all']}")
    # an edit made elsewhere (a field of another section) redraws the map: no route weight, so no routes
    ms = pg.evaluate("""(async()=>{const T=studioState.D.nodeTypes,was=T.route.weight;T.route.weight=0;
      const f=document.createElement('input');f.dataset.p='nodeTypes.route.weight';document.body.appendChild(f);
      const before=document.querySelector('#main .rl-figures').textContent,t0=performance.now();
      f.dispatchEvent(new Event('input',{bubbles:true}));
      while(document.querySelector('#main .rl-figures').textContent===before&&performance.now()-t0<2000)await new Promise(r=>setTimeout(r,5));
      const ms=performance.now()-t0;window.__rlRoutes=document.querySelectorAll('#main .rl-map .rl-node[data-type=route]').length;
      T.route.weight=was;f.dispatchEvent(new Event('input',{bubbles:true}));f.remove();return ms})()""")
    routes = pg.evaluate('window.__rlRoutes')
    if ms > 100 or routes: errs.append(f'run lab: a nodeTypes edit (no route weight) redrew in {ms:.0f} ms with {routes} routes (want under 100 ms and none)')
    time.sleep(0.2)
    pg.click('#main .rl-node[data-i="3"]')
    info = pg.evaluate("(document.querySelector('#main .rl-node-info')||{}).textContent||''")
    if 'LABCHECK7|n3' not in info: errs.append(f'run lab: clicking node 3 did not show its seed ({info[:120]!r})')
    pg.check('#rlBeside')
    t0 = time.time()
    while time.time() - t0 < 5 and pg.evaluate("document.querySelectorAll('#main .rl-map').length") < 2: time.sleep(0.05)
    if pg.evaluate("document.querySelectorAll('#main .rl-map').length") != 2: errs.append('run lab: beside the loaded data did not draw a second map')
    pg.uncheck('#rlBeside')
    # T2.6: a debug log's run carries its own unlocks; an older log only the save's
    read = pg.evaluate("""[runLabReadLog(JSON.stringify({state:{run:{seed:'LOGSEED',unlocks:['biome_ridge'],nodes:12},meta:{unlocks:['biome_ridge','shop_appeal']}}})),
      runLabReadLog(JSON.stringify({state:{run:{seed:'OLDLOG',nodes:12},meta:{unlocks:['shop_appeal']}}}))]""")
    if [read[0]['unlocks'], read[0]['own'], read[1]['unlocks'], read[1]['own']] != [['biome_ridge'], True, ['shop_appeal'], False]:
        errs.append(f'a debug log read for the run’s own unlocks gave {read}')
    logic = run_lab_logic_steps(pg, errs, want)
    rules = run_lab_rules_steps(pg, errs)
    sweep = run_lab_sweep_steps(pg, errs)
    play = run_lab_play_steps(pg, errs)
    if len(errs) > n: errs[n:] = [f'run lab: {e}' if not e.startswith('run lab') else e for e in errs[n:]]
    else: print(f"run lab: LABCHECK7 drawn as the game makes it ({len(want['none'])} places, no unlocks and all), a nodeTypes edit redrawn in {ms:.0f} ms, node 3's seed, beside the loaded data; {logic}; {rules}; {sweep}; {play}", flush=True)


def run_lab_sweep_steps(pg, errs):
    """Studio plan T2.3: the map checks over 1,000 seeds under the map: none on the game's rules; a planted bad rule
    (the last row a mini-boss) is named with a seed, and its button opens that seed."""
    ready = "(()=>{const e=document.querySelector('#main [data-runlab-sweep][data-ready]');return e?+e.dataset.problems:-1})()"
    t0 = time.time()
    while time.time() - t0 < 30 and pg.evaluate(ready) < 0: time.sleep(0.05)
    if pg.evaluate(ready) != 0:
        said = pg.evaluate("(document.querySelector('#main [data-runlab-sweep]')||{}).textContent||''")
        errs.append(f"the seed sweep on the game's rules: {pg.evaluate(ready)} problem(s) ({said[:200]})"); return 'no sweep'
    ratio = pg.evaluate("document.querySelector('#main [data-runlab-sweep] [data-ratio]').dataset.ratio")
    pg.select_option('#main .rl-rules [data-p="rules.run.map.last"]', 'miniboss')
    t0 = time.time()
    while time.time() - t0 < 30 and pg.evaluate(ready) < 1: time.sleep(0.05)
    seed = pg.evaluate("(document.querySelector('#main .rl-sweep-problems li')||{dataset:{}}).dataset.seed||''")
    text = pg.evaluate("(document.querySelector('#main .rl-sweep-problems li')||{}).textContent||''")
    if not seed or 'not the boss' not in text: errs.append(f'the last row a mini-boss: the sweep said {text[:160]!r}')
    else:
        pg.click(f'#main .rl-sweep-problems [data-act=runLabOpenSeed][data-seed="{seed}"]')
        if pg.input_value('#rlSeed') != seed: errs.append(f"the sweep's Open {seed} left the seed at {pg.input_value('#rlSeed')}")
    pg.select_option('#main .rl-rules [data-p="rules.run.map.last"]', 'boss')
    t0 = time.time()
    while time.time() - t0 < 30 and pg.evaluate(ready) != 0: time.sleep(0.05)
    return f"1,000 seeds checked with no problems (towns : routes {ratio}); the last row a mini-boss named with {seed}, which opens"


def run_lab_play_steps(pg, errs):
    """Studio plan T2.6: "Play this seed" opens the game in a test run on the Lab's seed (short map), after the Studio's
    unsaved data: its map is the one the Lab draws, an unsaved clinic price (rules.run.healCost) is the run's, an edit
    made while it runs reaches it, and the live channel carries no save."""
    if not (ROOT / 'game/data/gamedata.js').is_file(): subprocess.run(['node', 'tools/build-data.mjs'], cwd=ROOT, check=True, capture_output=True)
    pg.fill('#rlSeed', 'PLAYCHECK1')
    pg.select_option('#rlUnlocks', 'none')
    pg.check('#rlShort')
    t0 = time.time()
    rows = "(()=>{const m=document.querySelector('#main .rl-map');return m?new Set([...m.querySelectorAll('circle')].map(c=>c.getAttribute('cx'))).size:0})()"
    while time.time() - t0 < 5 and pg.evaluate(rows) != 5: time.sleep(0.05)
    lab = pg.evaluate("[...document.querySelector('#main .rl-map').querySelectorAll('.rl-node')].map(g=>g.dataset.type+':'+g.dataset.biome)")
    was = pg.evaluate('studioState.D.rules.run.healCost')
    pg.fill('#main .rl-rules [data-p="rules.run.healCost"]', '77')
    sent = []
    pg.evaluate("window.__sent=[];const c=new BroadcastChannel('networth-studio');c.onmessage=e=>window.__sent.push(Object.keys((e.data&&e.data.D)||{}).sort().join(','));0")
    with pg.context.expect_page(timeout=20000) as info: pg.click('#main [data-act=runLabPlay]')
    gp = info.value
    gp_errs = []
    gp.on('pageerror', lambda e: gp_errs.append(str(e)[:300]))
    try:
        t0 = time.time()
        ok = False
        while time.time() - t0 < 150:
            try: ok = gp.evaluate("typeof saveData!=='undefined'&&!!saveData.run&&runWorld.seed==='PLAYCHECK1'")
            except Exception: ok = False
            if ok: break
            time.sleep(0.5)
        if not ok: errs.append(f'Play this seed: no run on PLAYCHECK1 took off in the game ({gp.url})'); return 'no run'
        got = gp.evaluate("({map: saveData.run.map.nodes.map(n=>n.type+':'+n.biome), test: !!TEST_RUN, heal: RULES.run.healCost, clinic: runClinicEach(), live: !!studioLive.told})")
        if not got['test']: errs.append('Play this seed: the game is not in a test run')
        if got['map'] != lab: errs.append(f"Play this seed: the game's map {got['map']} isn't the Lab's {lab}")
        if got['heal'] != 77 or got['clinic'] != 77: errs.append(f"Play this seed: the unsaved clinic price 77 isn't the run's (rules {got['heal']}, the clinic {got['clinic']}; Studio data came: {got['live']})")
        pg.fill('#main .rl-rules [data-p="rules.run.healCost"]', '88')
        t0 = time.time()
        while time.time() - t0 < 5 and gp.evaluate('RULES.run.healCost') != 88: time.sleep(0.1)
        if gp.evaluate('runClinicEach()') != 88: errs.append('Play this seed: a clinic price edited while the run goes did not reach it')
        keys = set(','.join(pg.evaluate('window.__sent')).split(','))
        if keys & {'saveData', 'save', 'meta', 'team', 'run'}: errs.append(f'the live channel carried save fields: {sorted(keys)}')
        if not {'rules', 'nodeTypes', 'perks', 'unlocks', 'items', 'trainers'} <= keys: errs.append(f'the live channel did not carry the run data: {sorted(keys)}')
        for e in gp_errs: errs.append(f'Play this seed: the game: {e}')
    finally:
        gp.close()
        pg.fill('#main .rl-rules [data-p="rules.run.healCost"]', str(was))
        pg.uncheck('#rlShort')
    return f"Play this seed opened PLAYCHECK1 in a test run with the Lab's {len(lab)} places, the unsaved clinic price 77 and a live edit to 88"


def run_lab_rules_steps(pg, errs):
    """Studio plan T2.5: the run rules card. Typing in a field redraws the map (rows), the edit is in what Propose would
    send (rules.json, nodeTypes.json), the shop's always-stocked box edits the list, a value the game can't lay out
    shows its error beside the map, every rule in code finds its line, and putting the values back leaves nothing to
    propose in those files."""
    rows_drawn = lambda: pg.evaluate("(()=>{const m=document.querySelector('#main .rl-map');if(!m)return 0;return new Set([...m.querySelectorAll('.rl-node circle')].map(c=>c.getAttribute('cx'))).size})()")
    pending = lambda: pg.evaluate("changedDataFiles(studioState.D).map(f=>f.path).filter(p=>/rules\\.json$|nodeTypes\\.json$/.test(p)).sort()")
    if not pg.locator('#main .rl-rules').count(): errs.append('no run rules card'); return 'no rules card'
    was = pg.evaluate('studioState.D.rules.run.map.rows')
    before = rows_drawn()
    pg.fill('#main .rl-rules [data-p="rules.run.map.rows"]', '7')
    t0 = time.time()
    while time.time() - t0 < 5 and rows_drawn() == before: time.sleep(0.05)
    drawn = rows_drawn()
    if drawn != 7: errs.append(f'rows 7 typed in the rules card: the map has {drawn} rows')
    if pg.evaluate('studioState.D.rules.run.map.rows') != 7: errs.append('the rows field did not write rules.run.map.rows')
    name_was = pg.evaluate('studioState.D.nodeTypes.town.name')
    pg.fill('#main .rl-rules [data-p="nodeTypes.town.name"]', 'Market')
    pg.evaluate("document.querySelector('#main .rl-rules [data-rl-always=\"taxbreak\"]').click()")
    sent = pending()
    rules_text = pg.evaluate("(changedDataFiles(studioState.D).find(f=>/rules\\.json$/.test(f.path))||{}).text||''")
    if not any(p.endswith('rules.json') for p in sent) or not any(p.endswith('nodeTypes.json') for p in sent): errs.append(f'Propose would send {sent}, not rules.json and nodeTypes.json')
    elif '"rows": 7' not in rules_text.replace('"rows":7', '"rows": 7'): errs.append('the proposed rules.json does not hold rows 7')
    if 'taxbreak' in pg.evaluate('studioState.D.rules.run.shop.always'): errs.append('unticking the Potion left it always on the shelves')
    # a value the map can't lay out (more mini-bosses than rows hold): the game's own error beside the map
    pg.fill('#main .rl-rules [data-p="rules.run.map.minibosses"]', '6')
    t0 = time.time()
    while time.time() - t0 < 5 and not pg.locator('#main .rl-error').count(): time.sleep(0.05)
    if not pg.locator('#main .rl-error').count(): errs.append('6 mini-bosses on 7 rows drew a map, not the game’s error')
    mb = pg.evaluate('studioState.loaded.rules.run.map.minibosses')
    pg.fill('#main .rl-rules [data-p="rules.run.map.minibosses"]', str(mb))
    pg.fill('#main .rl-rules [data-p="rules.run.map.rows"]', str(was))
    pg.fill('#main .rl-rules [data-p="nodeTypes.town.name"]', name_was)
    pg.evaluate("document.querySelector('#main .rl-rules [data-rl-always=\"taxbreak\"]').click()")
    left = pending()
    if left: errs.append(f'every rules card value put back, Propose would still send {left}')
    t0 = time.time()
    while time.time() - t0 < 10 and pg.evaluate("[...document.querySelectorAll('#main [data-rl-code]')].some(e=>!e.dataset.line)"): time.sleep(0.1)
    lines = pg.evaluate("[...document.querySelectorAll('#main [data-rl-code]')].map(e=>e.textContent)")
    if not lines or any(l.endswith(':?') or ':' not in l for l in lines): errs.append(f'the rules in code did not all find their line: {lines}')
    return f"the rules card: rows 7 redrawn, proposed in rules.json and nodeTypes.json, the game's error for 6 mini-bosses, put back with nothing left to send, {len(lines)} rules in code with their lines ({lines[0] if lines else ''})"


def run_lab_logic_steps(pg, errs, want):
    """Studio plan T2.4: the node panel's part from the game's logic, worked out in the Studio's logic worker on the
    data as it is now, equals runPreview in Node for the same seed: a mini-boss's leader and team, a town's stock and
    Perk on each day, the Perk picks. One worker per data version: another click asks the same worker; an
    edit makes a new one."""
    P = want['preview']
    pg.select_option('#rlUnlocks', 'none')
    def panel(i):
        pg.click(f'#main .rl-node[data-i="{i}"]')
        t0 = time.time()
        while time.time() - t0 < 30 and not pg.evaluate(f"!!document.querySelector('#main [data-runlab-logic][data-ready=LABCHECK7] .rl-logic-node[data-node=\"{i}\"]')"): time.sleep(0.05)
        return pg.evaluate("""i=>{const el=document.querySelector('#main [data-runlab-logic]');const t=el&&el.querySelector('.rl-logic-node[data-node="'+i+'"]');
          if(!t)return {err:(el||{}).textContent||'no panel'};const f=t.querySelector('[data-foe]');
          return {ms:+el.dataset.ms,foe:f?[f.dataset.foe,f.dataset.team]:null,wild:(t.querySelector('[data-wild]')||{dataset:{}}).dataset.wild||'',
            shop:[...t.querySelectorAll('[data-day]')].map(r=>[+r.dataset.day,r.dataset.stock,r.dataset.relic]),
            offers:[...el.querySelectorAll('[data-offer]')].map(o=>o.dataset.offer)}}""", i)
    boss = panel(P['guard']['i'])
    if 'err' in boss: errs.append(f"the logic panel for mini-boss node {P['guard']['i']} never came: {boss['err'][:200]}"); return 'no logic panel'
    if boss['foe'] != P['guard']['foe']: errs.append(f"mini-boss node {P['guard']['i']}: the panel shows {boss['foe']}, runPreview in Node {P['guard']['foe']}")
    if boss['wild'] != P['guard']['wild']: errs.append(f"mini-boss node {P['guard']['i']}: wild {boss['wild']!r}, Node {P['guard']['wild']!r}")
    if boss['offers'] != P['offers']: errs.append(f"the Perk picks: the panel shows {boss['offers']}, Node {P['offers']}")
    made = pg.evaluate('logicWorker.made')
    town = panel(P['town']['i'])
    if 'err' in town: errs.append(f"the logic panel for town node {P['town']['i']} never came: {town['err'][:200]}"); return 'no logic panel'
    if town['shop'] != P['town']['shop']: errs.append(f"town node {P['town']['i']}: the panel's shop {town['shop']}, Node {P['town']['shop']}")
    if pg.evaluate('logicWorker.made') != made: errs.append('a second click on the same data made a new logic worker')
    # an edit: a new worker on the new data, and the panel follows it (the town's first day sells no Potion)
    pg.evaluate("studioState.D.rules.run.shop.always=studioState.D.rules.run.shop.always.filter(w=>w!=='taxbreak');"
                "document.querySelector('#main [data-runlab-logic]').removeAttribute('data-ready');runLabRedraw()")
    t0 = time.time()
    while time.time() - t0 < 30 and not pg.evaluate("!!document.querySelector('#main [data-runlab-logic][data-ready]')"): time.sleep(0.05)
    stock = pg.evaluate("[...document.querySelectorAll('#main [data-runlab-logic] [data-day]')].map(r=>r.dataset.stock)")
    more = pg.evaluate('logicWorker.made') - made
    pg.evaluate("studioState.D.rules.run.shop.always.push('taxbreak');runLabRedraw()")
    if more != 1: errs.append(f"an edit made {more} new logic workers (want 1)")
    if not stock or any('taxbreak' in s.split(',') for s in stock): errs.append(f'after taking the Potion off the shop rules the panel still sells it: {stock}')
    return f"the logic worker's panel equals runPreview (mini-boss {boss['foe'][0] if boss['foe'] else '?'}, a town's {len(town['shop'])} days, {len(P['offers'])} picks; {boss['ms']} ms), one worker per data version"
RUN_LAB_SIM_NODE = """import { modules } from './tools/test/setup-real.mjs';
import { runReport } from './tools/test/sim/run-sim.mjs';
const R = runReport(modules['sim-compare'].simSeeds(5), { team: 1, unlocks: 'none', policy: 'greedy-forward', scenes: 'skip' });
console.log(JSON.stringify(R.summary));"""


def run_lab_sim_steps(pg, errs):
    """Studio plan T3.4: the Run Lab's Simulate card plays 5 seeds on Base (the data as loaded) and Draft in two logic
    workers. With no changes every run is the same on both sides, both hashes match, and Base's numbers are the CLI's
    in Node; every table carries the policy banner and the policy-driven rows say so. An unsaved dearer clinic
    (rules.run.healCost doubled, 60 -> 120 on the game's data) shows a paired difference with its interval and a new Draft hash. The seed count
    stops at 200."""
    n = len(errs)
    tree = ROOT if (ROOT / 'tools/test/setup-real.mjs').is_file() else REPO
    r = subprocess.run(['node', '--input-type=module', '-e', RUN_LAB_SIM_NODE], cwd=tree, capture_output=True, text=True)
    try: want = json.loads(r.stdout.strip().splitlines()[-1])
    except Exception: errs.append(f'simulate: the Node report failed: {r.stderr[-400:]}'); return
    pg.evaluate("void openSection('runlab')")
    pg.wait_for_selector('#rlSimN', timeout=20000)
    pg.fill('#rlSimN', '5')
    pg.dispatch_event('#rlSimN', 'change')
    def simulate():
        pg.evaluate("document.querySelector('#main [data-runlab-sim]').removeAttribute('data-ready')")
        pg.click('#main [data-act=runLabSimulate]')
        t0 = time.time()
        while time.time() - t0 < 60 and not pg.evaluate("!!document.querySelector('#main [data-runlab-sim][data-ready]')"):
            if pg.evaluate("runLabSim.error"): break
            time.sleep(0.05)
        return pg.evaluate("runLabSim.error ? {error: runLabSim.error} : runLabSim.result")
    C = simulate()
    if not C or 'error' in C: errs.append(f"simulate: no compare came back: {(C or {}).get('error')}"); return
    zero = all(C['diff'][k]['changed'] == 0 for k in C['diff'])
    if not (C['same'] and zero and C['hash']['base'] == C['hash']['draft']):
        errs.append(f"simulate: with no changes, same={C['same']}, hashes {C['hash']}, differences {[k for k in C['diff'] if C['diff'][k]['changed']]}")
    if C['base'] != want: errs.append(f"simulate: Base's numbers are not the CLI's in Node: {json.dumps(C['base'])[:300]} against {json.dumps(want)[:300]}")
    banner = f"Bot policy {C['policy']['name']}: a lower bound on a careful player, not a prediction"
    marks = pg.evaluate("""b=>{const o=document.querySelector('#main [data-runlab-sim]');return {tables:o.querySelectorAll('.rl-sim-table').length,
      banners:[...o.querySelectorAll('.rl-sim-banner')].filter(e=>e.textContent===b).length,
      driven:[...o.querySelectorAll('tr[data-metric] .rl-sim-driven')].map(e=>e.closest('tr').dataset.metric)}}""", banner)
    if marks['tables'] < 5 or marks['banners'] != marks['tables']: errs.append(f"simulate: {marks['banners']} banners on {marks['tables']} tables")
    if sorted(marks['driven']) != sorted(C['policyDriven']): errs.append(f"simulate: policy-driven rows {marks['driven']}, the report's {C['policyDriven']}")
    base_made = pg.evaluate('logicWorkerBase.made')
    heal = pg.evaluate("studioState.D.rules.run.healCost")
    pg.evaluate(f"studioState.D.rules.run.healCost = {heal * 2}")
    try: D = simulate()
    finally: pg.evaluate(f"studioState.D.rules.run.healCost = {heal}")
    if not D or 'error' in D: errs.append(f"simulate: no compare after the clinic edit: {(D or {}).get('error')}"); return
    h = D['diff']['healed']
    if D['same'] or not (h['changed'] > 0 and h['mean'] > 0) or D['hash']['draft'] == D['hash']['base'] or D['hash']['base'] != C['hash']['base']:
        errs.append(f"simulate: healCost {heal * 2} gave same={D['same']}, healed {h}, hashes {D['hash']}")
    if pg.evaluate('logicWorkerBase.made') != base_made: errs.append('simulate: the Base worker was made again for the same loaded data')
    pg.fill('#rlSimN', '500')
    pg.dispatch_event('#rlSimN', 'change')
    if pg.input_value('#rlSimN') != '200' or pg.evaluate('runLabSim.n') != 200: errs.append(f"simulate: 500 seeds asked kept {pg.input_value('#rlSimN')} (the browser's cap is 200)")
    pg.fill('#rlSimN', '200')
    pg.dispatch_event('#rlSimN', 'change')
    if len(errs) > n: errs[n:] = [f'run lab: {e}' for e in errs[n:]]
    else: print(f"run lab simulate: 5 seeds the same on Base and Draft ({C['hash']['base']}), Base equals the CLI's report; a banner on each of {marks['tables']} tables; healCost {heal} -> {heal * 2} healed +{h['mean']} [{h['lo']}, {h['hi']}] (Draft {D['hash']['draft']}); capped at 200", flush=True)


def rig_preview_steps(pg, errs):
    """Studio plan Phase 5 (T5.6): a Studio preview draws a Billie as the game does. For a kit Billie, front and back,
    at fixed clocks (idle, walk, attack, hurt): the Studio's preview canvas (drawSpritePreview on rigFor) is pixel-equal
    to the game's drawing (rigFromMeta on the game's rigs-next.js and sheet, rigFrame, drawRig). The Studio's rig has
    the game's 12 fps clock and lag, and the old 60 fps pose (rigPose) differs on some of those clocks, so the check
    can tell the two apart."""
    n = len(errs)
    sp = pg.evaluate("studioState.D.lines[0].id + '0'")
    out = pg.evaluate("""async sp => {
      const rigs = await (await fetch('../game/art/next/rigs-next.js')).text(),
        RN = JSON.parse(rigs.slice(rigs.indexOf('{'), rigs.lastIndexOf('}') + 1)),
        CASES = [[null, 1000], [null, 1234], [null, 1517], ['walk', 300], ['walk', 377], ['attack', 210], ['hurt', 95]],
        pixels = c => c.getContext('2d').getImageData(0, 0, c.width, c.height).data,
        same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]),
        res = { views: {} };
      for (const view of ['front', 'back']) {
        const meta = RN[sp][view],
          img = new Image();
        img.src = '../game/art/' + meta.sheet;
        await img.decode();
        const R = rigFromMeta(meta, img), S = rigFor(sp, view);
        const r = { clock: S && S.clock, lag: S && S.lag, differ: 0, old: 0 };
        for (const [act, tau] of CASES) {
          const ts = 5000 + tau, c = document.createElement('canvas');
          c.width = c.height = 10;
          c._p = { sp, view, seed: 1, t0: 5000, act, loop: false };
          drawSpritePreview(c, ts);
          const g = document.createElement('canvas');
          g.width = R.BW; g.height = R.BH;
          const x = g.getContext('2d');
          x.imageSmoothingEnabled = false;
          drawRig(x, R, rigFrame(R, act, tau, ts, 1), view);
          if (!same(pixels(c), pixels(g))) r.differ++;
          const o = document.createElement('canvas');
          o.width = R.BW; o.height = R.BH;
          const y = o.getContext('2d');
          y.imageSmoothingEnabled = false;
          drawRig(y, R, rigPose(act, tau, ts, 1), view);
          if (!same(pixels(o), pixels(g))) r.old++;
        }
        res.views[view] = r;
      }
      return res;
    }""", sp)
    for view, r in out['views'].items():
        if r['clock'] != 12 or not r['lag']: errs.append(f"{view}: the Studio's rig has clock {r['clock']} and lag {r['lag']}, not the game's 12 and lag")
        if r['differ']: errs.append(f"{view}: {r['differ']} of 7 preview frames differ from the game's drawing")
        if not r['old']: errs.append(f"{view}: the 60 fps pose drew every frame the same as the game's clock (the check can't tell them apart)")
    if len(errs) > n: errs[n:] = [f'rig preview: {e}' for e in errs[n:]]
    print(f"rig preview: {sp} front and back, 7 clocks each, pixel-equal to the game's drawing (the old pose differs on "
          f"{out['views']['front']['old']} and {out['views']['back']['old']})", flush=True)


def checks_steps(pg, errs):
    """Studio plan Phase 1 (T1.3): the Check runs check-data's checks (logic/data-checks.js) and an error blocks
    Propose. The game data has no error; a planted relic, unlock, run rule and robot problem, and a pool typo, are
    each listed as an error; Propose with an error sends nothing and offers Show me; a warning never blocks."""
    n = len(errs)
    errors = "runCheck().filter(p => p.lvl === 'error').map(p => p.msg)"
    base = pg.evaluate(errors)
    for m in base: errs.append(f'the game data has a Check error: {m}')
    pg.evaluate("window.__ckD = JSON.stringify(studioState.D)")
    plants = {
        'run.relics.cap': "studioState.D.rules.run.relics.cap = 0",
        'goes round in a circle': "(() => { const U = studioState.D.unlocks, [a, b] = Object.keys(U); U[a].requires = [b]; U[b].requires = [a]; })()",
        'run.typo: no such rule': "studioState.D.rules.run.typo = 1",
        'nosuchmove, no such move': "Object.values(studioState.D.robots.gems)[0].move = 'nosuchmove'",
        'lists waltn0': "studioState.D.pools[Object.keys(studioState.D.pools)[0]].list[0][0] = 'waltn0'",
    }
    for want, js in plants.items():
        pg.evaluate(js)
        if not any(want in m for m in pg.evaluate(errors)): errs.append(f'a planted problem is not a Check error: {want}')
    # Studio plan Phase 5 (T5.3): a rig fault is a Check error too (data-checks.js dataRigs), and goes with its fix
    sp = pg.evaluate("Object.keys(studioState.rigs).find(k => studioState.rigs[k].back && studioState.rigs[k].back.bones.some(b => b.n === 'head'))")
    par = pg.evaluate(f"studioState.rigs[{json.dumps(sp)}].back.bones.find(b => b.n === 'head').par")
    pg.evaluate(f"studioState.rigs[{json.dumps(sp)}].back.bones.find(b => b.n === 'head').par = 'nosuchbone'")
    if not any(f'{sp} back: head hangs from nosuchbone, no such bone' in m for m in pg.evaluate(errors)): errs.append('a planted rig fault is not a Check error')
    pg.evaluate(f"studioState.rigs[{json.dumps(sp)}].back.bones.find(b => b.n === 'head').par = {json.dumps(par)}")
    # Propose with errors: nothing is sent, the dialog says why and offers Show me
    pg.evaluate("studioState.dirty = true; window.__ckDone = false; void saveAll().then(() => window.__ckDone = true)")
    pg.wait_for_selector('#dlg .dlg', timeout=10000)
    text = pg.inner_text('#dlg .dlg')
    if 'Show me' not in text: errs.append(f'the blocked Propose offers no Show me: {text[:200]}')
    pg.evaluate("[...document.querySelectorAll('#dlg button')].find(b => /Show me/.test(b.textContent))?.click()")
    t0 = time.time()
    while time.time() - t0 < 10 and not pg.evaluate("window.__ckDone"): time.sleep(0.2)
    if not pg.evaluate("studioState.dirty"): errs.append('Propose went ahead with Check errors')
    if pg.evaluate("studioState.sec") != 'check': errs.append(f"Show me opened {pg.evaluate('studioState.sec')}, not the Check")
    # a warning alone never blocks: the same data, a wild pool's levels the wrong way round
    pg.evaluate("studioState.D = JSON.parse(window.__ckD); const P = Object.values(studioState.D.pools)[0]; P.lv = [P.lv[1] + 1, P.lv[0]]")
    if pg.evaluate(errors): errs.append(f'the wrong-way pool levels are a Check error: {pg.evaluate(errors)}')
    pg.evaluate("studioState.dirty = true; window.__ckDone = false; void saveAll().then(() => window.__ckDone = true)")
    t0 = time.time()
    while time.time() - t0 < 30 and not pg.evaluate("window.__ckDone"):
        time.sleep(0.3)
        pg.evaluate("document.querySelectorAll('#dlg button').forEach(b => /Propose|Send|OK/.test(b.textContent) && b.click())")
    if pg.evaluate("studioState.dirty"): errs.append('Propose did not go ahead with only a warning')
    pg.evaluate("studioState.D = JSON.parse(window.__ckD); delete window.__ckD; render()")
    if len(errs) > n: errs[n:] = [f'checks: {e}' for e in errs[n:]]
    print(f'checks: {len(base)} error(s) on the game data, 5 planted problems and a rig fault listed, Propose blocked on an error, not on a warning ({len(errs) - n} problem(s))', flush=True)


def kit_write_steps(pg, errs):
    """Studio plan Phase 5 (T5.1): the Studio bakes kit Billies. Part mode on a kit Billie shows its recipe; Write
    Billie on the recipe as it is changes nothing; a head part changed in the recipe bakes at once (the recipe, the
    sheet, the rig and the line's native parts) as one undo step, which undo takes back whole and redo puts back. The
    edit is left pending: after the proposal, kit_write_sent checks it carried all of it, equal to the Node bake."""
    n = len(errs)
    form = pg.evaluate("studioState.D.kitBuilds.forms[0]")
    sp, name = form['rig'], form['name']
    state = f"""JSON.stringify({{ form: studioState.D.kitBuilds.forms[0], rig: studioState.rigs[{json.dumps(sp)}],
      parts: studioState.D.lines.find(l => l.id === {json.dumps(form['line'])}).parts[{form['stage']}],
      art: studioState.artDirty.has('art/next/billionaires/{name}.png') }})"""
    s0 = pg.evaluate(state)
    pg.evaluate(f"wbPart.src = 'species'; wbPart.sp = {json.dumps(sp)}; wbPart.id = ''; workbench.mode = 'part'; void openSection('workbench')")
    pg.wait_for_selector(f'[data-kit-form="{name}"]', timeout=20000)
    steps0 = pg.evaluate("studioState.undo.length")
    idle = "!kitRecipe.busy"

    def wait_steps(k, limit=20):
        t0 = time.time()
        while time.time() - t0 < limit and (pg.evaluate("studioState.undo.length") < steps0 + k or not pg.evaluate(idle)): time.sleep(0.2)

    # parity through the browser: every kit Billie baked in the Studio is its committed sheet and rig
    par = pg.evaluate("""(async () => { const out = [];
      for (const f of studioState.D.kitBuilds.forms) {
        const m = await kitBakeInStudio(f), i = new Image(); i.src = '../game/art/next/billionaires/' + f.name + '.png'; await i.decode();
        const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; c.getContext('2d').drawImage(i, 0, 0);
        if (!kitSameShown(m.sheet, kitPixelsOf(c))) out.push(f.name + ' sheet');
        if (JSON.stringify(JSON.parse(JSON.stringify(m.rig))) !== JSON.stringify(studioState.rigs[f.rig])) out.push(f.name + ' rig');
      } return out; })()""")
    for p in par: errs.append(f'baked in the browser, {p} is not as committed')
    # Write Billie on the recipe as it is: nothing changes
    pg.locator(f'[data-kit-form="{name}"] [data-act=kitWriteBillie]').click()
    t0 = time.time()
    while time.time() - t0 < 20 and not pg.locator('.toast', has_text='Already as baked').count(): time.sleep(0.2)
    if not pg.locator('.toast', has_text='Already as baked').count(): errs.append(f"Write Billie on {name} as it is did not say it is already as baked")
    if pg.evaluate(state) != s0 or pg.evaluate("studioState.undo.length") != steps0: errs.append(f'Write Billie on {name} as it is changed something')
    # a head part changed in the recipe: one bake, one undo step
    old = form['parts']['head'][0]
    new = pg.evaluate(f"""[...document.querySelectorAll('[data-kit-form="{name}"] [data-kitr=part][data-kind=head] option')].map(o => o.value).find(v => v !== {json.dumps(old)})""")
    pg.evaluate(f"""(() => {{ const el = document.querySelector('[data-kit-form="{name}"] [data-kitr=part][data-kind=head]'); el.value = {json.dumps(new)};
      el.dispatchEvent(new Event('change', {{ bubbles: true }})); }})()""")
    wait_steps(1)
    s1 = json.loads(pg.evaluate(state))
    if s1['form']['parts']['head'][0] != new: errs.append(f"the recipe's head is {s1['form']['parts']['head'][0]}, not {new}")
    if s1['rig'] == json.loads(s0)['rig']: errs.append('the head part changed but the rig did not')
    if not s1['art']: errs.append('the head part changed but the sheet is not marked to save')
    if s1['parts'].get('head') != new: errs.append(f"the line's native head is {s1['parts'].get('head')}, not {new}")
    if pg.evaluate("studioState.undo.length") != steps0 + 1: errs.append(f"the bake made {pg.evaluate('studioState.undo.length') - steps0} undo steps, not 1")
    if not pg.evaluate("studioState.dirty && studioState.rigsDirty"): errs.append('the bake did not mark the data and the rigs to save')
    pg.evaluate("undo()"); time.sleep(0.5)
    s2 = json.loads(pg.evaluate(state))
    s0j = json.loads(s0)
    if s2['form'] != s0j['form'] or s2['rig'] != s0j['rig'] or s2['parts'] != s0j['parts']: errs.append('one undo did not take the recipe, the rig and the native parts back together')
    same = pg.evaluate(f"""(async () => {{ const a = await atlasGet('art/next/billionaires/{name}.png'), i = new Image(); i.src = '../game/art/next/billionaires/{name}.png'; await i.decode();
      const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; c.getContext('2d').drawImage(i, 0, 0);
      return kitSameShown(kitPixelsOf(a), kitPixelsOf(c)); }})()""")
    if not same: errs.append('after the undo the sheet is not the committed one')
    pg.evaluate("redo()"); time.sleep(0.5)
    if json.loads(pg.evaluate(state)) != s1: errs.append('redo did not put the bake back whole')
    pg.evaluate("window.__kitWrite = " + json.dumps({'name': name, 'rig': sp, 'line': form['line'], 'form': s1['form']}))
    pg.evaluate("workbench.mode = 'sheet'; wbPart.src = 'kits'")
    if len(errs) > n: errs[n:] = [f'kit write: {e}' for e in errs[n:]]
    print(f'kit write: all {pg.evaluate("studioState.D.kitBuilds.forms.length")} kit Billies baked in the browser as committed; {name} written as it is (nothing changed), its head {old} -> {new} baked in one undo step, undone and redone, left to propose', flush=True)


def kit_write_sent(pg, bodies, errs):
    """after the proposal: it carries the kit Billie's sheet, rigs-next.js, kitBuilds.json and its line; the sheet is
    pixel-equal (alpha, colour where shown) to `npm run bake:kits`'s bake of the same recipe, and the rig equal"""
    import base64, io, subprocess
    from PIL import Image
    n = len(errs)
    k = pg.evaluate("window.__kitWrite || null")
    if not k: return errs.append('kit write: the step left nothing to propose')
    tree = next((json.loads(b) for kd, b in bodies if kd == 'trees'), {'tree': []})['tree']
    blobs = [json.loads(b)['content'] for kd, b in bodies if kd == 'blobs']
    sent = dict(zip([e['path'] for e in tree if e.get('sha') is not None], blobs))
    png, want = f"game/art/next/billionaires/{k['name']}.png", ['game/art/next/rigs-next.js', 'game/data/kitBuilds.json', f"game/data/lines/{k['line']}.json"]
    for f in [png] + want:
        if f not in sent: errs.append(f'the proposal does not carry {f} (it has {sorted(sent)[:12]})')
    if png in sent and 'game/art/next/rigs-next.js' in sent:
        node = r"""
          import { readFileSync } from 'node:fs';
          import { join } from 'node:path';
          import { readPng } from './tools/test/png.mjs';
          import { kitBakeWhole } from './game/js/logic/kit-assemble.js';
          const j = f => JSON.parse(readFileSync(join('game/data', f), 'utf8')), D = { partKits: j('partKits.json'), kitBuilds: j('kitBuilds.json'), rules: j('rules.json') };
          const form = JSON.parse(process.argv[1]), made = kitBakeWhole(D, form, (id, v) => readPng(join('game/art', D.partKits.parts[id].views[v].file)));
          process.stdout.write(JSON.stringify({ w: made.sheet.width, h: made.sheet.height, px: Buffer.from(made.sheet.data).toString('base64'), rig: made.rig, parts: made.parts }));"""
        out = json.loads(subprocess.run(['node', '--input-type=module', '-e', node, json.dumps(k['form'])], cwd=REPO, capture_output=True, text=True, check=True).stdout)
        im = Image.open(io.BytesIO(base64.b64decode(sent[png]))).convert('RGBA')
        a, b = im.tobytes(), base64.b64decode(out['px'])
        if im.size != (out['w'], out['h']): errs.append(f"the proposed sheet is {im.size}, the Node bake {out['w']}x{out['h']}")
        else:
            bad = sum(1 for i in range(0, len(b), 4) if a[i + 3] != b[i + 3] or (b[i + 3] and a[i:i + 3] != b[i:i + 3]))
            if bad: errs.append(f'the proposed sheet differs from the Node bake in {bad} pixels')
        rigs = base64.b64decode(sent['game/art/next/rigs-next.js']).decode()
        RN = json.loads(rigs[rigs.index('{'):rigs.rindex('}') + 1])
        if RN.get(k['rig']) != json.loads(json.dumps(out['rig'])): errs.append('the proposed rig is not the Node bake\'s')
        line = json.loads(base64.b64decode(sent.get(want[2], '') or b'e30=').decode())
        if (line.get('parts') or [None] * 9)[k['form']['stage']] != out['parts']: errs.append('the proposed native parts are not the Node bake\'s')
        recipe = json.loads(base64.b64decode(sent.get(want[1], '') or b'e30=').decode())
        if (recipe.get('forms') or [None])[0] != k['form']: errs.append('the proposed kitBuilds.json does not hold the edited recipe')
    if len(errs) > n: errs[n:] = [f'kit write: {e}' for e in errs[n:]]
    else: print(f"kit write: the proposal carries {k['name']}.png (pixel-equal to the Node bake), rigs-next.js (the rig equal), kitBuilds.json and lines/{k['line']}.json", flush=True)


def library_swap_steps(pg, errs):
    """Studio plan Phase 5 (T5.2): Replace from Parts Library keeps the Billie whole. On a kit Billie's torso, a library
    torso without a tail socket is greyed out with the reason; on its head, a library head prepared shows the
    before/after strip (front and back), and applied it is one undo step: the head keeps a blink, its horns move with
    it, geo is updated; undo puts the rig back."""
    n = len(errs)
    sp = pg.evaluate("studioState.D.kitBuilds.forms[0].rig")
    rig = f"JSON.stringify(studioState.rigs[{json.dumps(sp)}])"
    rig0 = pg.evaluate(rig)
    pg.evaluate(f"wbPart.src = 'species'; wbPart.sp = {json.dumps(sp)}; wbPart.id = ''; workbench.mode = 'part'; void openSection('workbench')")
    pg.wait_for_selector(f'[data-kit-form]', timeout=20000)

    def library(bone):
        pg.evaluate(f"ACTIONS.wbpPick({{ id: '{bone}' }})"); time.sleep(0.5)
        pg.evaluate("void wbsLibrary.open()")
        pg.wait_for_selector('[data-act=wbsLibraryPick]', timeout=20000)

    # a torso without a tail socket: greyed, with the reason
    library('torso')
    pg.evaluate("window.__lsK = JSON.stringify(studioState.D.partKits); delete studioState.D.partKits.parts.cat_torso.views.front.sockets.tail; render()")
    time.sleep(0.3)
    why = pg.evaluate("(b => b && [b.disabled, b.title])(document.querySelector('[data-act=wbsLibraryPick][data-id=cat_torso]'))")
    if not why or not why[0] or 'no tail socket for tail' not in why[1]: errs.append(f'a torso without a tail socket is not greyed with its reason: {why}')
    ok = pg.evaluate("(b => b && !b.disabled)(document.querySelector('[data-act=wbsLibraryPick][data-id=bear_torso]'))")
    if not ok: errs.append('a torso with every socket is greyed')
    pg.evaluate("studioState.D.partKits = JSON.parse(window.__lsK); delete window.__lsK; ACTIONS.wbsLibraryCancel()")
    # a head: prepared, before and after, applied as one step
    library('head')
    steps0 = pg.evaluate("studioState.undo.length")
    horn0 = pg.evaluate(f"studioState.rigs[{json.dumps(sp)}].front.bones.find(b => b.n === 'hornL').at")
    pg.evaluate("ACTIONS.wbsLibraryPick({ id: 'cat_head' })")
    t0 = time.time()
    while time.time() - t0 < 20 and not pg.evaluate("!!wbsLibrary.active() && !wbsLibrary.active().busy && !!wbsLibrary.active().after"): time.sleep(0.2)
    strips = pg.evaluate("[...document.querySelectorAll('[data-wbs-swap]')].map(i => [i.dataset.wbsSwap, i.naturalWidth > 0 || i.src.startsWith('data:image/png')])")
    if sorted(s[0] for s in strips) != ['back', 'front'] or not all(s[1] for s in strips): errs.append(f'the before/after strip is not shown for both views: {strips}')
    if pg.evaluate(rig) != rig0: errs.append('preparing a swap changed the rig')
    pg.evaluate("ACTIONS.wbsLibraryApply()"); time.sleep(0.5)
    R = json.loads(pg.evaluate(rig))
    R0 = json.loads(rig0)
    for view in ['front', 'back']:
        h = next(b for b in R[view]['bones'] if b['n'] == 'head')
        f = R[view]['imgs'][h['i']]['f']
        h0 = next(b for b in R0[view]['bones'] if b['n'] == 'head')
        if 'blink' in R0[view]['imgs'][h0['i']]['f'] and 'blink' not in f: errs.append(f'{view}: the swapped head lost its blink ({list(f)})')
    if R['front']['bones'][[b['n'] for b in R['front']['bones']].index('hornL')]['at'] == horn0: errs.append('the horn did not move with the new head')
    if R['front']['geo'] == R0['front']['geo']: errs.append('geo was not updated')
    if pg.evaluate("studioState.undo.length") != steps0 + 1: errs.append(f"the swap made {pg.evaluate('studioState.undo.length') - steps0} undo steps, not 1")
    pg.evaluate("undo()"); time.sleep(0.5)
    if pg.evaluate(rig) != rig0: errs.append('undo did not put the rig back')
    pg.evaluate("wbPart.src = 'kits'; wbPart.id = ''; workbench.mode = 'sheet'")
    if len(errs) > n: errs[n:] = [f'library swap: {e}' for e in errs[n:]]
    print(f'library swap: {sp}: a torso without a tail socket greyed with its reason; a head swapped with a before/after strip, a blink kept, horns moved, geo updated, one undo step, undone', flush=True)


def repack_steps(pg, errs):
    """Studio plan Phase 5 (T5.4): Repack sheet on a hand-drawn species (huang0): the sheet gets smaller, both views are
    drawn pixel for pixel as before (neutral pose, every face), it is one undo step and undo puts the sheet and rig
    back; on a kit Billie it refuses (the recipe packs its sheet)."""
    n = len(errs)
    sp = 'huang0'
    pg.evaluate(f"wbPart.src = 'species'; wbPart.sp = {json.dumps(sp)}; wbPart.id = 'head'; workbench.mode = 'part'; void openSection('workbench')")
    pg.wait_for_selector('[data-act=wbsRepack]', timeout=20000); time.sleep(0.8)
    drawn = f"""(async () => {{ const out = []; for (const v of ['front', 'back']) {{ await atlasGet(atlasPath({json.dumps(sp)}, v));
      const R = rigFor({json.dumps(sp)}, v); for (const face of ['idle', 'blink', 'happy', 'hurt']) {{ const c = document.createElement('canvas'); c.width = R.BW; c.height = R.BH;
      const P = neutralPose(); P.face = face; drawRig(c.getContext('2d'), R, P, v); out.push(c.toDataURL()); }} }} return out; }})()"""
    rig = f"JSON.stringify(studioState.rigs[{json.dumps(sp)}])"
    size = f"(c => [c.width, c.height])(loadedAtlas(atlasPath({json.dumps(sp)}, 'front')))"
    d0, r0, s0, steps0 = pg.evaluate(drawn), pg.evaluate(rig), pg.evaluate(size), pg.evaluate("studioState.undo.length")
    pg.locator('[data-act=wbsRepack]').first.click()
    t0 = time.time()
    while time.time() - t0 < 20 and pg.evaluate("studioState.undo.length") == steps0: time.sleep(0.2)
    time.sleep(0.5)
    s1 = pg.evaluate(size)
    if s1[0] * s1[1] >= s0[0] * s0[1]: errs.append(f'the sheet is {s1}, not smaller than {s0}')
    if pg.evaluate(rig) == r0: errs.append('the rig did not change')
    if pg.evaluate(drawn) != d0: errs.append('the repacked Billie is not drawn as before')
    if pg.evaluate("studioState.undo.length") != steps0 + 1: errs.append(f"the repack made {pg.evaluate('studioState.undo.length') - steps0} undo steps, not 1")
    pg.evaluate("undo()"); time.sleep(0.5)
    if pg.evaluate(rig) != r0 or pg.evaluate(size) != s0: errs.append('undo did not put the sheet and the rig back')
    kit = pg.evaluate("studioState.D.kitBuilds.forms[0].rig")
    pg.evaluate(f"wbPart.sp = {json.dumps(kit)}; render()"); time.sleep(0.5)
    k0 = pg.evaluate("studioState.undo.length")
    pg.locator('[data-act=wbsRepack]').first.click(); time.sleep(0.8)
    if pg.evaluate("studioState.undo.length") != k0 or not pg.locator('.toast', has_text='baked from its recipe').count(): errs.append('Repack sheet on a kit Billie did not refuse')
    pg.evaluate("wbPart.src = 'kits'; wbPart.id = ''; workbench.mode = 'sheet'")
    if len(errs) > n: errs[n:] = [f'repack: {e}' for e in errs[n:]]
    print(f'repack: {sp} {s0} -> {s1}, drawn the same front and back (4 faces), one undo step, undone; a kit Billie refused', flush=True)


def density_steps(pg, errs):
    """Studio plan Phase 5 (T5.7): the Roster board's Pixel density report opens with a row per Billie of the game's
    lines with a rig (legacy rigs have no species), the kit Billies with their stage scale, and names the part sizes
    that are not whole (measure only)."""
    n = len(errs)
    pg.evaluate("void openSection('roster')")
    pg.wait_for_selector('[data-act=roDensity]', timeout=20000)
    pg.locator('[data-act=roDensity]').click()
    pg.wait_for_selector('#dlg table', timeout=10000)
    r = pg.evaluate("""(() => { const rows = [...document.querySelectorAll('#dlg tbody tr')];
      return { rows: rows.length, kit: rows.filter(t => t.children[6].textContent.includes('×')).length, text: document.querySelector('#dlg .dlg-body').textContent }; })()""")
    want = pg.evaluate("Object.keys(densityHeights(studioState.D.lines)).filter(sp => studioState.rigs[sp]).length")
    if r['rows'] != want: errs.append(f"the report has {r['rows']} rows, not one per Billie with a rig ({want})")
    if r['kit'] != 24: errs.append(f"the report shows {r['kit']} kit Billies, not 24")
    if 'S 0.85 and L 1.2' not in r['text']: errs.append('the report does not name the S and L sizes')
    pg.locator('#dlg button', has_text='Close').click()
    if len(errs) > n: errs[n:] = [f'density: {e}' for e in errs[n:]]
    print(f"density: the Pixel density report, {r['rows']} Billies, {r['kit']} kit Billies with their parts", flush=True)


def music_steps(pg, errs):
    """SND-3: the Music & sound section (studio/js/music-editor.js): a song plays through the game's tracker on the
    Studio's own AudioContext (a real click starts it), the bar playing shows, Stop stops it, and leaving the section
    stops it too (no scheduler left running)."""
    n = len(errs)
    pg.evaluate("void openSection('music')")
    try: pg.wait_for_selector('#musList [data-act=musPlay][data-song=town]', timeout=20000)
    except Exception:
        errs.append('music: the song list never showed'); return
    pg.click('#musList [data-act=musPlay][data-song=town]')
    time.sleep(1.2)
    state = pg.evaluate("[musicStudio.ctx && musicStudio.ctx.state, musicPlaying(), document.querySelector('#musNow').textContent, !!musicStudio.tracker.timer]")
    if state[0] != 'running': errs.append(f'music: the AudioContext is {state[0]!r}, not running')
    if state[1] != 'town' or not state[2].startswith('\u25b6 town · bar'): errs.append(f'music: playing {state[1]!r}, shown {state[2]!r}')
    if not state[3]: errs.append('music: the scheduler is not running')
    # the recipe: a tempo typed in while it plays reaches the song playing, which keeps its place; Undo too
    pg.click('#musList [data-act=musPick][data-song=town]')
    box = pg.locator('#main input[data-p="music.songs.town.bpm"]')
    box.fill('140'); box.press('Tab'); time.sleep(0.3)
    got = pg.evaluate("[musicPlaying(), musicStudio.tracker.song.D.bpm, studioState.D.music.songs.town.bpm, musicStudio.tracker.song.step > 4]")
    if got != ['town', 140, 140, True]: errs.append(f'music: a tempo change while playing gave {got}')
    pg.select_option('#main select[data-p="music.songs.town.prog.1"]', '3'); time.sleep(0.3)
    if pg.evaluate("musicStudio.tracker.song.D.prog[1]") != 3: errs.append('music: a chord change did not reach the song playing')
    pg.click('#undoBtn'); pg.click('#undoBtn'); time.sleep(0.3)
    got = pg.evaluate("[musicPlaying(), musicStudio.tracker.song.D.bpm, musicStudio.tracker.song.D.prog[1], studioState.D.music.songs.town.bpm]")
    if got != ['town', 100, 5, 100]: errs.append(f'music: undo gave {got} (playing, its tempo and second chord, the data’s tempo)')
    left = pg.evaluate("changedDataFiles(studioState.D).map(f => f.path)")
    if left: errs.append(f'music: after the undo these still differ from GitHub: {left}')
    # the hook roll: a click on an empty cell of the roll writes a note, a drag makes it longer, and the song playing
    # plays the hook at once; a click on the note takes it away; the countermelody is its own line; all undone
    # SND-4: on hills, whose rolls are empty (town has a placeholder hook and counter now), played and picked first
    pg.click('#musList [data-act=musPick][data-song=hills]'); pg.click('#musList [data-act=musPlay][data-song=hills]'); time.sleep(0.3)
    undo0 = pg.evaluate("studioState.undo.length")
    pg.locator('#musRoll').scroll_into_view_if_needed(); box = pg.locator('#musRoll').bounding_box()
    cell = lambda st, row: (box['x'] + 40 + st * 22 + 11, box['y'] + 18 + row * 16 + 8)
    x, y = cell(4, 3); pg.mouse.click(x, y)
    hook = pg.evaluate("studioState.D.music.songs.hills.hook")
    if not hook or len(hook) != 1 or hook[0][0] != 4 or hook[0][2] != 2: errs.append(f'music: a click on the roll wrote {hook}')
    elif pg.evaluate("JSON.stringify(musicStudio.tracker.song.D.notes.slice(0, 32).filter(Boolean))") != json.dumps([[hook[0][1], 2]], separators=(',', ':')):
        errs.append('music: the song playing does not play the hook')
    pg.locator('#musRoll').scroll_into_view_if_needed(); box = pg.locator('#musRoll').bounding_box()
    x, y = cell(4, 3); pg.mouse.click(x, y)
    if pg.evaluate("'hook' in studioState.D.music.songs.hills"): errs.append('music: a click on the note did not take it away')
    pg.click('[data-act=musLine][data-l=counter]')
    pg.locator('#musRoll').scroll_into_view_if_needed(); box = pg.locator('#musRoll').bounding_box()
    x, y = cell(8, 10); x2, _ = cell(13, 10)
    pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x2, y, steps=4); pg.mouse.up()
    ctr = pg.evaluate("studioState.D.music.songs.hills.counter")
    if not ctr or ctr[0][0] != 8 or ctr[0][2] != 6: errs.append(f'music: a drag on the counter roll wrote {ctr}')
    elif pg.evaluate("musicStudio.tracker.song.D.counterNotes[8]") != [ctr[0][1], 6]: errs.append('music: the song playing does not play the counter')
    while pg.evaluate("studioState.undo.length") > undo0: pg.click('#undoBtn')
    if pg.evaluate("['hook', 'counter'].some(k => k in studioState.D.music.songs.hills)"): errs.append('music: undo left a hook or counter')
    # SND-5: the intro on the roll (every semitone a row), drawn and undone; a battle song plays its intro first, and
    # its tense version with Version set to it
    pg.click('[data-act=musLine][data-l=intro]')
    pg.locator('#musRoll').scroll_into_view_if_needed(); box = pg.locator('#musRoll').bounding_box()
    x, y = cell(0, 5); pg.mouse.click(x, y)
    intro = pg.evaluate("studioState.D.music.songs.hills.intro")
    if not intro or intro[0][0] != 0: errs.append(f'music: a click on the intro roll wrote {intro}')
    while pg.evaluate("studioState.undo.length") > undo0: pg.click('#undoBtn')
    if pg.evaluate("'intro' in studioState.D.music.songs.hills"): errs.append('music: undo left an intro')
    pg.click('[data-act=musLine][data-l=hook]')
    pg.evaluate("void musicPlay('wild')"); time.sleep(0.3)
    if not pg.evaluate("musicStudio.tracker.song.step < 0 || musicStudio.tracker.song.step < 20"): errs.append('music: wild did not start on its intro')
    pg.select_option('#musPart', 'tense'); time.sleep(0.3)
    if pg.evaluate("musicPlaying()") != 'wild@tense': errs.append(f"music: Version tense played {pg.evaluate('musicPlaying()')!r}, not wild@tense")
    pg.evaluate("void musicPlay('hazel')"); time.sleep(0.3)
    if pg.evaluate("musicPlaying()") != 'hazel@tense' and pg.evaluate("musicPlaying()") != 'hazel': errs.append(f"music: a song with Version tense played {pg.evaluate('musicPlaying()')!r}")
    pg.select_option('#musPart', ''); time.sleep(0.2)
    pg.click('.ed-head [data-act=musStop]')
    time.sleep(0.3)
    if pg.evaluate("musicPlaying()") != '': errs.append('music: Stop did not stop the song')
    # the where table: Try a place answers; a rule moved below the one it beat changes the answer; a condition
    # added and taken away; a rule added before the last; all undone, nothing left to propose
    pg.click('[data-act=musTab][data-t=where]')
    pg.wait_for_selector('#musTryOut')
    pg.select_option('select[data-mt=nodeType]', 'town'); pg.select_option('select[data-mt=biome]', 'lake')
    pick = lambda: pg.evaluate("document.querySelector('#musTryOut').textContent")
    undo0 = pg.evaluate("studioState.undo.length")
    # SND-5: the rules' places are read from the table (new battle rules moved them)
    town = pg.evaluate("studioState.D.music.where.findIndex(w => w.nodeType === 'town')") + 1
    wild = pg.evaluate("studioState.D.music.where.findIndex(w => w.battle === 'wild')")
    n0 = pg.evaluate("studioState.D.music.where.length")
    if pick() != f'Rule {town} picks town': errs.append(f'music: a lake town gave {pick()!r}')
    lake = pg.evaluate("studioState.D.music.where.findIndex(w => w.biome === 'lake')")
    for _ in range(lake - town + 1): pg.click(f'#musRule{lake} [data-act=musRuleMove][data-d="-1"]'); lake -= 1
    if pg.evaluate(f"studioState.D.music.where[{lake}].biome") != 'lake' or pick() != f'Rule {town} picks trench':
        errs.append(f'music: the lake rule moved to {lake + 1} gave {pick()!r}, wanted trench')
    pg.select_option(f'#musRule{wild} select[data-mk="+"]', 'indoor')
    if pg.evaluate(f"studioState.D.music.where[{wild}]") != {'battle': 'wild', 'indoor': True, 'song': 'wild'}: errs.append(f"music: adding a condition gave {pg.evaluate(f'studioState.D.music.where[{wild}]')}")
    pg.click(f'#musRule{wild} [data-act=musCondDel][data-k=indoor]')
    pg.click('[data-act=musRuleAdd]')
    W = pg.evaluate("studioState.D.music.where")
    if len(W) != n0 + 1 or W[-1] != {'song': 'route'}: errs.append(f'music: a new rule went to {len(W)} (last {W[-1]})')
    if pg.evaluate("runCheck().filter(c => c.go === 'music' && c.lvl === 'error').length"): errs.append('music: the Check finds errors in a table only moved and added to')
    pg.click(f'#musRule{n0 - 1} [data-act=musRulePlay]'); time.sleep(0.4)
    if pg.evaluate("musicPlaying()") != pg.evaluate(f"studioState.D.music.where[{n0 - 1}].song"): errs.append('music: a rule’s ▶ did not play its song')
    # SND-5: the run's arc in the In a run card: a band's drums set, then undone with the rest
    pg.select_option('select[data-p="music.run.arc.0.changes.drums"]', 'drive')
    if pg.evaluate("studioState.D.music.run.arc[0].changes.drums") != 'drive': errs.append('music: the arc band\'s drums did not change')
    while pg.evaluate("studioState.undo.length") > undo0: pg.click('#undoBtn')
    if pick() != f'Rule {town} picks town' or pg.evaluate("changedDataFiles(studioState.D).map(f => f.path)"):
        errs.append(f'music: undoing the table gave {pick()!r} and left {pg.evaluate("changedDataFiles(studioState.D).map(f => f.path)")}')
    # the jingles: one plays (its voices start on the context), a note drawn after its end lengthens it with a rest
    # between, undone
    pg.click('[data-act=musTab][data-t=jingles]')
    pg.click('[data-act=musJinglePick][data-j=hatch]')
    pg.click('.list-head [data-act=musStop]'); time.sleep(0.6)
    pg.evaluate("(() => { const T = musicStudio.tracker, f = T.synthVoice; window.__mv = 0; T.synthVoice = (...a) => { window.__mv++; return f(...a); }; window.__mvf = f })()")
    pg.click('.card [data-act=musJinglePlay][data-j=hatch].primary'); time.sleep(0.2)
    if pg.evaluate("window.__mv") != 6: errs.append(f'music: the hatch jingle started {pg.evaluate("window.__mv")} voices, not 6 (3 notes, each with its bass)')
    pg.evaluate("void (musicStudio.tracker.synthVoice = window.__mvf)")
    pg.locator('#musJRoll').scroll_into_view_if_needed(); box = pg.locator('#musJRoll').bounding_box()
    pg.mouse.click(box['x'] + 40 + 10 * 22 + 11, box['y'] + 18 + 2 * 16 + 8)
    got = pg.evaluate("studioState.D.music.jingles.hatch.notes")
    if len(got) != 5 or got[3] != [0, 2] or got[4][1] != 2: errs.append(f'music: a note after the hatch jingle gave {got}')
    pg.click('#undoBtn')
    if pg.evaluate("studioState.D.music.jingles.hatch.notes") != [[76, 2], [79, 2], [84, 4]]: errs.append('music: undo did not put the jingle back')
    # SND-6: the Sounds tab: a base cry and a button sound play their notes; the mix's master changed and undone
    pg.click('[data-act=musTab][data-t=sounds]')
    pg.wait_for_selector('[data-act=musBaseCry][data-k=beast]', timeout=10000)
    pg.evaluate("(() => { const T = musicStudio.tracker, f = T.synthVoice; window.__mv = 0; T.synthVoice = (...a) => { window.__mv++; return f(...a); }; window.__mvf = f })()")
    pg.click('summary [data-act=musBaseCry][data-k=beast]'); time.sleep(0.1)
    beast = pg.evaluate("window.__mv"); pg.evaluate("window.__mv = 0")
    pg.click('[data-act=musUiSound][data-k=confirm]'); time.sleep(0.1)
    conf = pg.evaluate("window.__mv")
    pg.evaluate("void (musicStudio.tracker.synthVoice = window.__mvf)")
    want = pg.evaluate("[studioState.D.music.cries.bases.beast.voices.length, studioState.D.music.ui.sounds.confirm.notes.length]")
    if [beast, conf] != want: errs.append(f'music: the beast cry and the confirm sound started {[beast, conf]} voices, not {want}')
    m = pg.locator('#main input[data-p="music.mix.master"]')
    m.fill('0.8'); m.press('Tab')
    if pg.evaluate("studioState.D.music.mix.master") != 0.8: errs.append(f'music: the mix master gave {pg.evaluate("studioState.D.music.mix.master")}')
    pg.click('#undoBtn')
    if pg.evaluate("studioState.D.music.mix.master") != 0.9 or pg.evaluate("changedDataFiles(studioState.D).map(f => f.path)"):
        errs.append('music: undo did not put the mix back')
    # a Billy's cry (the Billies page; SND-6: every stage has one): a new pitch keeps its base and plays the base's
    # notes from it, and its low-HP version a third down; undone, nothing to propose
    pg.evaluate("void openSection('billionaires')")
    pg.wait_for_selector('#main input[data-p$=".cry.0.pitch"]', timeout=20000)
    li = pg.evaluate("+document.querySelector('#main input[data-p$=\".cry.0.pitch\"]').dataset.p.split('.')[1]")
    was = pg.evaluate(f"JSON.stringify(studioState.D.lines[{li}].cry)")
    box = pg.locator(f'#main input[data-p="lines.{li}.cry.0.pitch"]')
    box.fill('60'); box.press('Tab')
    C = pg.evaluate(f"studioState.D.lines[{li}].cry[0]")
    if C.get('pitch') != 60 or not C.get('base'): errs.append(f"music: a cry pitch gave {C}")
    notes = pg.evaluate(f"studioState.D.music.cries.bases[studioState.D.lines[{li}].cry[0].base].voices.map(v => 60 + v.note)")
    pg.evaluate("(() => { const T = musicStudio.tracker, f = T.synthVoice; window.__mv = []; T.synthVoice = (o, v) => { window.__mv.push(v); return f(o, v); }; window.__mvf = f })()")
    pg.click('#main [data-act=musCry]:not([data-low])'); pg.click('#main [data-act=musCry][data-low]')
    heard = pg.evaluate("window.__mv.map(v => Math.round(12 * Math.log2(v.freq / 440) + 69))")
    pg.evaluate("void (musicStudio.tracker.synthVoice = window.__mvf)")
    if heard != notes + [n - 3 for n in notes]: errs.append(f'music: the cry and its low-health version played notes {heard}, not {notes} then a minor third down')
    pg.click('#undoBtn')
    if pg.evaluate(f"JSON.stringify(studioState.D.lines[{li}].cry)") != was or pg.evaluate("changedDataFiles(studioState.D).map(f => f.path)"):
        errs.append('music: undoing the cry pitch did not put it back, or left something to propose')
    pg.evaluate("void openSection('music')")
    pg.click('[data-act=musTab][data-t=songs]')
    pg.click('#musList [data-act=musPlay][data-song=meadow]')
    time.sleep(0.5)
    pg.evaluate("void openSection('rules')")
    time.sleep(0.5)
    if pg.evaluate("[musicPlaying(), !!musicStudio.tracker.timer]") != ['', False]: errs.append('music: leaving the section left the song playing')
    if len(errs) > n: errs[n:] = [f'music: {e}' if not e.startswith('music:') else e for e in errs[n:]]
    else: print('music: town played (context running, bar shown), its tempo and a chord changed while playing and undone, a hook note and a counter note drawn and heard and undone (on hills), an intro note drawn and undone, wild with its intro and its tense version, stopped; the where table: a rule moved, a condition, a rule added, Try a place following, an arc band’s drums, all undone; a jingle played and lengthened and undone; the Sounds tab: a base cry and a button sound heard, the mix changed and undone; a cry’s pitch set, heard (and low on health) and undone; the Check’s music findings and Show me; meadow stopped when the section was left', flush=True)


CONTENT_NODE = """import { GAME_DATA as D, modules } from './tools/test/setup-real.mjs';
const out = {};
/* Studio plan Phase 4: what the content editors must show, from the game's logic in Node */
out.offers = modules.perks.perkOfferOrder('LAB1', D.perks, D.rules.run.relics, D.rules.run.map.minibosses).map(p => p.offer.join(','));
out.lab = modules['run-preview'].runPreview('LAB1', { unlocks: [] }).relicOffers.map(o => o.join(','));
out.insider = modules['content-preview'].perkPreview(['insider'], { sp: D.lines[0].id + '1', lvl: 30 }).stats.find(s => s.id === 'hus');
out.leaders = modules['content-preview'].leaderRunValues();
out.standIns = modules['content-preview'].speciesStandIns(Object.values(D.pools).flatMap(P => P.list.map(e => e[0])));
out.fresh = modules['unlock-graph'].unlockSaveAfter(D);
console.log(JSON.stringify(out));"""


def content_want(errs):
    """the content editors' expectations, worked out by the game's logic in Node (once)"""
    if not hasattr(content_want, 'v'):
        tree = ROOT if (ROOT / 'tools/test/setup-real.mjs').is_file() else REPO
        r = subprocess.run(['node', '--input-type=module', '-e', CONTENT_NODE], cwd=tree, capture_output=True, text=True)
        try: content_want.v = json.loads(r.stdout.strip().splitlines()[-1])
        except Exception: errs.append(f'content editors: the Node logic failed: {r.stderr[-400:]}'); content_want.v = None
    return content_want.v


def wait_js(pg, js, secs=30):
    t0 = time.time()
    while time.time() - t0 < secs and not pg.evaluate(js): time.sleep(0.05)
    return pg.evaluate(js)


def pending_files(pg, rx):
    return pg.evaluate(f"changedDataFiles(studioState.D).map(f=>f.path).filter(p=>/{rx}/.test(p)).sort()")


def edit_undo(pg, errs, where, sel, value, path, rx):
    """type a value into a field: the data has it and Propose would send its file; undo puts it back and leaves
    nothing to send in that file"""
    was = pg.evaluate(f"JSON.stringify(readPath({json.dumps(path)}))")
    pg.fill(sel, str(value))
    pg.dispatch_event(sel, 'change')
    time.sleep(0.6)
    now = pg.evaluate(f"readPath({json.dumps(path)})")
    if now != value: errs.append(f'{where}: typing {value} left {path} at {now!r}')
    sent = pending_files(pg, rx)
    if not sent: errs.append(f'{where}: after the edit Propose would not send {rx}')
    pg.evaluate("undo()")
    time.sleep(0.3)
    back = pg.evaluate(f"JSON.stringify(readPath({json.dumps(path)}))")
    if back != was: errs.append(f'{where}: undo left {path} at {back}, not {was}')
    left = pending_files(pg, rx)
    if left: errs.append(f'{where}: after the undo Propose would still send {left}')
    return sent


def relics_steps(pg, errs):
    """Studio plan T4.1: the Perks editor. The sample build's Speed with Running Shoes is the game's (perkPreview in
    Node); the offer order for LAB1 is the Run Lab's picks; a stages edit redraws the preview and is in perks.json; a
    factor under FX_LIMIT shows data-checks' message on its row; a row's kind change and the edits all undo."""
    W = content_want(errs)
    if not W: return
    n = len(errs)
    pg.evaluate("void openSection('relics', { relic: 'insider' })")
    pg.wait_for_selector('#main [data-relic-preview]', timeout=20000)
    if not wait_js(pg, "!!document.querySelector('#main [data-relic-preview][data-ready=insider]')"):
        errs.append('perks: the sample build never came from the logic worker'); return
    hus = pg.evaluate("+(document.querySelector('#main [data-relic-preview] [data-stat=hus]')||{dataset:{}}).dataset.after")
    if hus != W['insider']['after']: errs.append(f"perks: Running Shoes's Speed after is {hus}, the game's {W['insider']['after']}")
    wait_js(pg, "!!document.querySelector('#main [data-relic-offers][data-ready]')")
    offers = pg.evaluate("[...document.querySelectorAll('#main [data-relic-offers] [data-offer]')].map(e=>e.dataset.offer)")
    if offers != W['offers'] or offers != W['lab'][:len(offers)]: errs.append(f"perks: LAB1's offer order {offers}, Node {W['offers']}, the Run Lab's {W['lab']}")
    # a stages edit: the preview follows, Propose carries perks.json, undo puts it back
    sel = '#main [data-p="perks.insider.fx.0.stages"]'
    pg.fill(sel, '2'); pg.dispatch_event(sel, 'change')
    two = wait_js(pg, f"+(document.querySelector('#main [data-relic-preview] [data-stat=hus]')||{{dataset:{{}}}}).dataset.after==={W['insider']['before'] * 2}", 10)
    if not two: errs.append('perks: +2 stages did not double the preview’s Speed')
    pg.evaluate("undo()"); time.sleep(0.3)
    edit_undo(pg, errs, 'perks', sel, 3, 'perks.insider.fx.0.stages', 'perks\\.json$')
    # a factor under the code's limit: data-checks' message on its row
    pg.evaluate("void openSection('relics', { relic: 'offshore' })"); time.sleep(0.3)
    sel = '#main [data-p="perks.offshore.fx.0.mult"]'
    pg.fill(sel, '0.05'); pg.dispatch_event(sel, 'change'); time.sleep(0.6)
    pg.evaluate("render()")
    msg = pg.evaluate("(document.querySelector('#main [data-relic-row=\"0\"] .relic-err')||{}).textContent||''")
    if "outside the code's limits" not in msg: errs.append(f'perks: a factor of 0.05 showed no limit message on its row ({msg!r})')
    pg.evaluate("undo()"); time.sleep(0.3)
    # a row's kind: the row becomes a stat row; undo makes it money again
    pg.select_option('#main [data-relic-kind="offshore"][data-n="0"]', 'stat'); time.sleep(0.6)
    kind = pg.evaluate("studioState.D.perks.offshore.fx[0].kind")
    pg.evaluate("undo()"); time.sleep(0.3)
    if kind != 'stat' or pg.evaluate("JSON.stringify(studioState.D.perks.offshore.fx)") != '[{"kind":"money","mult":1.2}]':
        errs.append(f"perks: the kind change made {kind!r} and undo left {pg.evaluate('JSON.stringify(studioState.D.perks.offshore.fx)')}")
    if pending_files(pg, 'perks\\.json$'): errs.append('perks: after every undo Propose would still send perks.json')
    if len(errs) == n: print(f"perks: Running Shoes's Speed {W['insider']['before']} -> {hus} as the game, LAB1's offers as the Run Lab's, a stages edit proposed and undone, the limit on its row, a kind change undone", flush=True)


def unlocks_steps(pg, errs):
    """Studio plan T4.2: Unlocks & hub. The graph has a node per row and the edges unlocks.test.mjs expects; a need that
    would close a circle is refused, the data unchanged and the message naming the path; "what a new save has" is the
    game's (unlockSaveAfter in Node) and follows runs; a cost edit is in unlocks.json and undoes."""
    W = content_want(errs)
    if not W: return
    n = len(errs)
    pg.evaluate("void openSection('unlocks', { unlock: 'ranch_2' })")
    pg.wait_for_selector('#main .ug-map', timeout=20000)
    nodes = pg.evaluate("document.querySelectorAll('#main .ug-map .ug-node').length")
    want_nodes = pg.evaluate("Object.keys(studioState.D.unlocks).length")
    if nodes != want_nodes: errs.append(f'unlocks: the graph has {nodes} nodes, the table {want_nodes} rows')
    edges = pg.evaluate("[...document.querySelectorAll('#main .ug-map [data-edge]')].map(e=>e.dataset.edge)")
    for e in ['ranch_2>ranch_3', 'airship_2>biome_ridge', 'airship_2>biome_autumn']:
        if e not in edges: errs.append(f'unlocks: no edge {e} in the graph ({edges})')
    owned = pg.evaluate("document.querySelector('#main .ug-save').dataset.owned")
    if owned != ','.join(W['fresh']['owned']): errs.append(f"unlocks: a new save owns {owned!r}, the game's {W['fresh']['owned']}")
    # a planted circle: ranch_2 needs ranch_3 (which needs ranch_2)
    before = pg.evaluate("JSON.stringify(studioState.D.unlocks)")
    pg.evaluate("""document.querySelector('#main [data-ug-req="ranch_2"][value="ranch_3"]').click()"""); time.sleep(0.3)
    said = pg.evaluate("(document.querySelector('#main .ug-refused')||{}).textContent||''")
    if 'ranch_2 -> ranch_3 -> ranch_2' not in said: errs.append(f'unlocks: the circle was not refused with its path ({said!r})')
    if pg.evaluate("JSON.stringify(studioState.D.unlocks)") != before: errs.append('unlocks: the refused need changed the data')
    # the save after a run: First flight earned
    pg.fill('#main [data-ug-ed="runs"]', '1'); pg.dispatch_event('#main [data-ug-ed="runs"]', 'change'); time.sleep(0.3)
    if 'first_run' not in pg.evaluate("document.querySelector('#main .ug-save').dataset.owned"): errs.append('unlocks: after a run the save did not earn first_run')
    pg.fill('#main [data-ug-ed="runs"]', '0'); pg.dispatch_event('#main [data-ug-ed="runs"]', 'change'); time.sleep(0.3)
    sent = edit_undo(pg, errs, 'unlocks', '#main [data-p="unlocks.ranch_2.cost"]', 77, 'unlocks.ranch_2.cost', 'unlocks\\.json$')
    edit_undo(pg, errs, 'unlocks: buildings', '#main [data-p="buildings.ranch.name"]', 'Barn', 'buildings.ranch.name', 'buildings\\.json$')
    if len(errs) == n: print(f"unlocks: {nodes} nodes with the expected edges, the circle ranch_2 -> ranch_3 -> ranch_2 refused, a new save as the game's, a run earns first_run, a cost edit proposed ({sent}) and undone", flush=True)


def leaders_steps(pg, errs):
    """Studio plan T4.3: a mini-boss leader's run values in Trainers are runFoes's (leaderRunValues in Node), marked
    overridden in runs; its reward field says outside runs only; a pool a run reads is tagged by its biomes; no pool
    marks a species legacy (RO-1: the pools list real lines and forms only); the miniboss box is an edit Propose carries and undo puts back."""
    W = content_want(errs)
    if not W: return
    n = len(errs)
    k = sorted(W['leaders'])[0]
    pg.evaluate(f"void openSection('trainers', {{ trainer: {json.dumps(k)} }})")
    if not wait_js(pg, "!!document.querySelector('#main [data-run-leader][data-ready]')"):
        errs.append('leaders: the run values never came from the logic worker'); return
    got = pg.evaluate("[...document.querySelectorAll('#main .run-leader tr[data-kind]')].map(r=>[r.dataset.kind,+r.dataset.row,+r.dataset.reward,r.dataset.levels])")
    want = [[r['kind'], r['row'], r['reward'], f"{r['levels'][0]}-{r['levels'][1]}"] for r in W['leaders'][k]]
    if got != want: errs.append(f"leaders: {k}'s run values {got}, the game's {want}")
    if 'overridden in runs' not in pg.evaluate("document.querySelector('#main').textContent"): errs.append('leaders: no "overridden in runs" label')
    if 'outside runs only' not in pg.evaluate("document.querySelector('#main [data-p$=\".reward\"]').closest('label').textContent"): errs.append('leaders: the reward field does not say outside runs only')
    box = f'#main [data-p="trainers.{k}.miniboss"]'
    pg.uncheck(box); time.sleep(0.6)
    if pg.evaluate(f"!!studioState.D.trainers[{json.dumps(k)}].miniboss"): errs.append('leaders: unticking the mini-boss box left it on')
    if not pending_files(pg, f'trainers\\/{k}\\.json$'): errs.append(f'leaders: Propose would not send trainers/{k}.json')
    pg.evaluate("undo()"); time.sleep(0.3)
    if not pg.evaluate(f"!!studioState.D.trainers[{json.dumps(k)}].miniboss") or pending_files(pg, f'trainers\\/{k}\\.json$'): errs.append('leaders: undo did not put the mini-boss box back')
    pg.evaluate("studioState.sel.wtab='pools'; void openSection('world')")
    tags = pg.evaluate("[...document.querySelectorAll('#main [data-pool-run]')].map(e=>e.dataset.poolRun)")
    if not any(tags): errs.append('leaders: no pool is tagged as one a run reads')
    if not wait_js(pg, "[...document.querySelectorAll('#main [data-standin]')].every(e=>'to' in e.dataset)", 30): errs.append('leaders: the stand-ins never came')
    marks = pg.evaluate("[...document.querySelectorAll('#main [data-standin]')].map(e=>[e.dataset.standin,e.dataset.to])")
    bad = [m for m in marks if (W['standIns'].get(m[0]) or {}).get('to', '') != m[1]]
    if bad: errs.append(f"leaders: stand-ins {bad[:3]} differ from the game's")
    # RO-1: every pool lists real lines (regional forms included), so none is marked legacy
    if marks: errs.append(f"leaders: the pools mark {[m[0] for m in marks][:3]} as legacy; RO-1 lists only real lines")
    if len(errs) == n: print(f"leaders: {k}'s {len(got)} run places as runFoes makes them, overridden in runs; {sum(1 for t in tags if t)} pools a run reads; no pool lists a legacy id; the mini-boss box proposed and undone", flush=True)


def economy_steps(pg, errs):
    """Studio plan T4.4: the Economy page lists a line per source and sink with its value; a link opens the field;
    the simulator's numbers are a placeholder that says so."""
    n = len(errs)
    pg.evaluate("void openSection('economy')")
    pg.wait_for_selector('#main .eco', timeout=20000)
    rows = pg.evaluate("document.querySelectorAll('#main [data-eco]').length")
    want = pg.evaluate("economyLines(studioState.D).length")
    if rows != want or rows < 20: errs.append(f'economy: {rows} lines shown, economyLines gives {want}')
    if not pg.locator('#main [data-eco-sim="none"]').count(): errs.append('economy: no placeholder for the simulator numbers')
    pg.click('#main [data-act="ecoGo"][data-path="unlocks.ranch_2.cost"]'); time.sleep(0.5)
    if pg.evaluate("studioState.sec") != 'unlocks' or not pg.locator('#main [data-p="unlocks.ranch_2.cost"]').count(): errs.append('economy: the ranch_2 cost link did not open its field')
    pg.evaluate("void openSection('economy')"); time.sleep(0.3)
    pg.click('#main [data-act="ecoGo"][data-path="perks.offshore.fx.0.mult"]'); time.sleep(0.5)
    if pg.evaluate("studioState.sec + ':' + studioState.sel.relic") != 'relics:offshore': errs.append('economy: the Lucky Charm link did not open that Perk')
    if len(errs) == n: print(f'economy: {rows} lines, links open their fields, the simulator placeholder shown', flush=True)


# Studio plan Phase 6 (T6.7): every WebGL context the page makes is counted (a canvas that gets one), and the GPU's
# warnings are kept apart, so a redraw that makes a new context or uses a stale object shows
GL_COUNT = """(() => { window.__glCount = 0; const g = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, ...a) { const c = g.call(this, t, ...a);
    if (c && /webgl/.test(t) && !this.__glMade) { this.__glMade = 1; window.__glCount++; } return c; }; })()"""
GL_WARN = []


def polish_steps(pg, errs):
    """Studio plan Phase 6 (T6.6, T6.7): a rename in the second pane updates that pane's list (F16); a shop keeper's
    thank-you field reads and writes that shop's lines (F20); a section that throws says so in its pane, and an
    error anywhere is a toast; the pixel canvas leaves no listeners behind; 20 tool switches in Walk scenes keep one
    WebGL context and no stale GPU object."""
    # F16: a move renamed in the second pane shows the new name in that pane's list
    pg.evaluate("void openSection('billionaires')"); time.sleep(0.3)
    pg.evaluate("ACTIONS.openBeside({ s: 'moves' })"); time.sleep(0.8)
    k = pg.evaluate("studioState.sel.move")
    f = pg.locator(f'#main2 input[data-p="moves.{k}.n"]')
    v0 = f.input_value()
    f.fill(v0 + ' Polish'); time.sleep(0.3)
    listed = pg.evaluate("(document.querySelector('#main2 #moveList') || {}).textContent || ''")
    f.dispatch_event('change'); time.sleep(0.3)
    pg.evaluate("void undo()"); time.sleep(0.4)
    if v0 + ' Polish' not in listed: errs.append('F16: a move renamed in the second pane kept its old name in that pane\'s list')
    pg.evaluate("ACTIONS.paneClose()"); time.sleep(0.3)
    # F20: the shop keeper's thank-you lines are the shop's, not a key of the data
    got = pg.evaluate("""(async () => { const D = studioState.D, had = D.shops, keep = studioState.sel.shop;
      D.shops = { tst: { name: 'Test shop', keeper: 'K', who: Object.keys(D.people)[0], thanks: ['Ta', 'Cheers'], stock: [] } };
      studioState.sel.shop = 'tst'; openSection('shops'); await new Promise(r => setTimeout(r, 300));
      const t = [...document.querySelectorAll('#main textarea[data-p]')].find(e => e.dataset.p.startsWith('@') && e.dataset.p.endsWith('.tst'));
      const shown = t ? t.value : null;
      if (t) { t.value = 'One\\nTwo'; t.dispatchEvent(new Event('input', { bubbles: true })); }
      const r = { shown, thanks: D.shops.tst.thanks, top: 'tst' in D };
      delete D.tst; D.shops = had; studioState.sel.shop = keep; commit(true); return r; })()""")
    if got != {'shown': 'Ta\nCheers', 'thanks': ['One', 'Two'], 'top': False}: errs.append(f'F20: the shop thank-you field gave {got}')
    # F20: lore's lists of lines and a trainer's script read as text and write back the same
    got = pg.evaluate("""(() => { const L = readPath('@lines.lore.loading'), S = readPath('@script.trainer:crude'),
      a = JSON.stringify(studioState.D.lore.loading), b = JSON.stringify(studioState.D.trainers.crude.script);
      writePath('@lines.lore.loading', L); writePath('@script.trainer:crude', S);
      return [L.split('\\n').length > 1, S.split('\\n').length > 1, JSON.stringify(studioState.D.lore.loading) === a,
        JSON.stringify(studioState.D.trainers.crude.script) === b]; })()""")
    if got != [True, True, True, True]: errs.append(f'F20: @lines. and @script. read and wrote back {got}')
    # a section that throws says so in its pane; an error or a refused promise anywhere is a toast
    n = len(errs)
    got = pg.evaluate("""(async () => { const keep = studioState.sec, toasts = () => [...document.querySelectorAll('#toasts .toast.err')].map(t => t.textContent);
      SECTIONS.__boom = () => { throw new Error('planted boom') }; openSection('__boom');
      const pane = document.querySelector('#main').textContent.includes('planted boom');
      setTimeout(() => { throw new Error('planted throw') }); Promise.reject(new Error('planted refusal'));
      await new Promise(r => setTimeout(r, 200)); const t = toasts().join(' | ');
      delete SECTIONS.__boom; openSection(keep);
      return { pane, thrown: t.includes('planted throw'), refused: t.includes('planted refusal') }; })()""")
    errs[n:] = [e for e in errs[n:] if 'planted' not in e]
    if got != {'pane': True, 'thrown': True, 'refused': True}: errs.append(f'errors: a throwing section, a throw and a refusal showed {got}')
    # the pixel canvas's listeners on document go with its canvas: the count is flat over 5 opens of the pixel editor
    cdp = pg.context.new_cdp_session(pg)
    def doc_listeners():
        o = cdp.send('Runtime.evaluate', {'expression': 'document'})['result']['objectId']
        return len(cdp.send('DOMDebugger.getEventListeners', {'objectId': o})['listeners'])
    sp = pg.evaluate("studioState.D.lines[0].id + '0'")
    counts = []
    for _ in range(5):
        pg.evaluate(f"void openPixelEditor({json.dumps(sp)}, 'front')"); pg.wait_for_selector('#pxCv', timeout=20000); time.sleep(0.3)
        pg.click('.pxed [data-pe=close]'); time.sleep(0.3)
        counts.append(doc_listeners())
    if counts[-1] != counts[0]: errs.append(f'pixel canvas: document listeners after each of 5 opens: {counts}')
    print('polish: second-pane rename, shop thank-you lines, prefixes, errors shown, pixel canvas listeners ' + str(counts), flush=True)
    # T6.2, F21: a redraw keeps the focus and the scroll: a matchup click in Types, a select that redraws in Moves
    got = pg.evaluate("""(async () => { openSection('types'); await new Promise(r => setTimeout(r, 300));
      const m = document.querySelector('#main'), b = m.querySelectorAll('[data-act=mx]')[30];
      b.scrollIntoView({ block: 'center' }); const y = m.scrollTop; b.focus(); b.click();
      const a = document.activeElement, r = { mx: !!(a && a.dataset.act === 'mx' && a.dataset.a === b.dataset.a && a.dataset.b === b.dataset.b), scroll: Math.abs(m.scrollTop - y) < 2 };
      undo(); openSection('moves'); await new Promise(r => setTimeout(r, 300));
      const s = m.querySelector('select[data-rr][data-p$=".t"]');
      if (s) { s.focus(); s.dispatchEvent(new Event('change', { bubbles: true })); const f = document.activeElement; r.select = !!(f && f.dataset.p === s.dataset.p); undo(); }
      else r.select = 'no select';
      return r; })()""")
    if got != {'mx': True, 'scroll': True, 'select': True}: errs.append(f'focus: a redraw kept focus and scroll as {got}')
    # T6.3: person art keeps a sheet's pixels across data edits, keyed by the picture: a painted sheet still shows
    got = pg.evaluate("""(async () => { openSection('wardrobe'); await new Promise(r => setTimeout(r, 1500));
      const W = studioState.D.wardrobe, [k, it] = Object.entries(W.items).find(([, i]) => i.slot === 'hair' && i.img && i.pieces && i.pieces.length);
      const L = cleanLook(LOOK_PRESETS[0]); L.wear.hair = k;
      const hash = () => { forgetPersonLooks(); const f = personFrame(L, 'front', 'idle', 0, 0), d = f.getContext('2d').getImageData(0, 0, f.width, f.height).data; let h = 0; for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + 7 * d[i + 1] + 13 * d[i + 2]) % 1000000007; return h; };
      const path = 'art/' + it.img, c = await atlasGet(path), before = hash(), P = it.pieces.find(p => p.v === 'front') || it.pieces[0];
      const x = c.getContext('2d'), keep = x.getImageData(0, 0, c.width, c.height);
      x.fillStyle = '#ff00ff'; x.fillRect(P.r[0], P.r[1], P.r[2], P.r[3]); markArt(path, c);
      const painted = hash();
      x.putImageData(keep, 0, 0); markArt(path, c); const back = hash(); studioState.artDirty.delete(path); updateTopBar();
      return { changed: painted !== before, back: back === before }; })()""")
    if got != {'changed': True, 'back': True}: errs.append(f'person art: a painted sheet and its undo showed {got}')
    # T6.7: 20 tool switches in Walk scenes (each redraws the section) keep one WebGL context and use no stale object
    ready = "walkView.ready && !!document.querySelector('#scPv')"
    pg.evaluate("void openSection('scenes')")
    t0 = time.time()
    while time.time() - t0 < 90 and not pg.evaluate(ready): time.sleep(0.5)
    c0, w0 = pg.evaluate("window.__glCount"), len(GL_WARN)
    tools = pg.evaluate("[...document.querySelectorAll('#main [data-act=scTool]')].map(b => b.dataset.t)")
    for i in range(20):
        pg.evaluate(f"ACTIONS.scTool({{ t: {json.dumps(tools[i % len(tools)])} }})"); time.sleep(0.3)
    pg.evaluate("const m = studioState.D.maps[currentMapId()]; m.name = (m.name || '') + ' x'; changed(); commit(true); undo()")
    t0 = time.time()
    while time.time() - t0 < 120 and not pg.evaluate(ready): time.sleep(0.5)
    time.sleep(2)
    made = pg.evaluate("window.__glCount") - c0
    if made: errs.append(f'3D view: 20 tool switches and an undo in Walk scenes made {made} new WebGL contexts')
    if len(GL_WARN) > w0: errs.append(f'3D view: stale GPU objects after redraws: {GL_WARN[w0:w0 + 2]}')
    print(f'polish: 20 tool switches in Walk scenes made {made} new WebGL contexts, {len(GL_WARN) - w0} GPU warnings ({time.time() - t0:.0f} s to ready)', flush=True)
    # the other 3D sections take the same canvas: one context for all of them, and each still draws
    shown = []
    for s, cv in [('engine', 'engPv'), ('hub', 'hubPv'), ('props', 'pedPv'), ('scenes', 'scPv')]:
        pg.evaluate(f"void openSection('{s}')")
        if s == 'props':  # the turntable shows a prop open in its editor
            pg.evaluate("ACTIONS.propsPick({ k: document.querySelector('#main [data-act=propsPick]').dataset.k })")
        t0 = time.time()
        while time.time() - t0 < 90 and not pg.evaluate(f"walkView.ready && !!document.querySelector('#{cv}.in')"): time.sleep(0.5)
        shown.append(s if pg.evaluate(f"walkView.ready && walkView.cv === document.querySelector('#{cv}')") else s + ' (not drawn)')
        if s == 'props': pg.evaluate("ACTIONS.pedClose()")
    made = pg.evaluate("window.__glCount") - c0
    if made or any('not drawn' in x for x in shown): errs.append(f'3D view: across {shown}, {made} new WebGL contexts')
    if len(GL_WARN) > w0: errs.append(f'3D view: stale GPU objects across the 3D sections: {GL_WARN[w0:w0 + 2]}')
    print(f'polish: {", ".join(shown)} on one canvas, {made} new WebGL contexts, {len(GL_WARN) - w0} GPU warnings', flush=True)
    pg.evaluate("void openSection('jobs')")  # a section with no 3D view, so its frames don't slow the steps after


# the steps after sign-in, in order (--only picks some by name; 'sections' and 'art' are the two blocks in main)
STEPS = [
    ('story', story_steps),
    ('free_camera', free_camera_steps),
    ('tiles', tile_painter_steps),
    ('split', split_steps),
    ('workbench', workbench_steps),
    ('part_mode', part_mode_steps),
    ('robot_joints', robot_joint_steps),
    ('generate', generate_steps),
    ('species_parts', species_part_steps),
    ('rig_preview', rig_preview_steps),
    ('library_swap', library_swap_steps),
    ('repack', repack_steps),
    ('density', density_steps),
    ('wardrobe', wardrobe_steps),
    ('ui', ui_steps),
    ('ui_tools', ui_tools_steps),
    ('ui_screens', ui_screens_steps),
    ('music', music_steps),
    ('studio_test', studio_test_steps),
    ('run_lab', run_lab_steps),
    ('run_lab_sim', run_lab_sim_steps),
    # its bake stays pending for the proposal at the end (window.__kitWrite), so it runs after the music and the
    # simulation, which want nothing pending
    ('kit_write', kit_write_steps),
    ('relics', relics_steps),
    ('unlocks', unlocks_steps),
    ('leaders', leaders_steps),
    ('economy', economy_steps),
    ('checks', checks_steps),
    ('polish', polish_steps),
]


def publish_checks(b, url, errs):
    """Studio plan Phase 0 (T0.1): Propose never drops, half-sends or doubles a proposal. Its own page and stand-in, so
    the main flow's proposal is untouched. Each case leaves an art picture, a rig and a data edit pending, makes one
    GitHub step fail (or holds it), and checks that nothing pending is lost and that the retry carries all of it."""
    import base64
    tree = [{'type': 'blob', 'path': str(p.relative_to(ROOT)), 'sha': 'x', 'size': p.stat().st_size}
            for p in (ROOT / 'game' / 'art').rglob('*') if p.is_file()]
    st = {'fail': {}, 'hold': None, 'held': [], 'log': [], 'head': 'base1', 'reads': [], 'compare': [], 'calls': [], 'auth': []}

    def api(route):
        u = urlparse(route.request.url)
        p = u.path
        if route.request.method != 'GET':
            k = p.rsplit('/', 1)[-1]
            st['calls'].append((route.request.method, p, route.request.post_data or ''))
            st['auth'].append(route.request.headers.get('authorization', ''))
            if k == st['hold']:
                st['held'].append(route); return
            st['log'].append((k, route.request.post_data or ''))
            if st['fail'].get(k):
                code = st['fail'][k].pop(0)
                return route.fulfill(status=code, json={'message': f'stand-in {code} at {k}'})
            return route.fulfill(json={'sha': 'x', 'number': 7, 'html_url': 'x', 'object': {'sha': 'x'}, 'tree': {'sha': 'x'}})
        if p == '/user': return route.fulfill(json={'login': 'nojiroh'})
        if p.rstrip('/') == '/repos/nojiroh/pocket-billies': return route.fulfill(json={'permissions': {'push': True, 'admin': True}})
        if '/compare/' in p: return route.fulfill(json={'total_commits': 2, 'files': [{'filename': f} for f in st['compare']]})
        if '/git/trees/' in p:
            st['reads'].append(('tree', p.rsplit('/', 1)[-1]))
            return route.fulfill(json={'tree': tree})
        if '/git/commits/' in p: return route.fulfill(json={'sha': p.rsplit('/', 1)[-1], 'tree': {'sha': 'tree-' + p.rsplit('/', 1)[-1]}})
        if '/git/ref' in p: return route.fulfill(json={'object': {'sha': st['head']}})
        if '/contents/' in p:
            f = ROOT / unquote(p.split('/contents/', 1)[1])
            if 'studio/admins.json' not in p: st['reads'].append((p.split('/contents/', 1)[1], parse_qs(u.query).get('ref', [''])[0]))
            if f.is_file(): return route.fulfill(body=f.read_bytes())
        return route.fulfill(status=404, json={'message': 'Not Found'})

    ctx = b.new_context(viewport={'width': 1400, 'height': 900})
    ctx.add_init_script('window.PB_TEST_GLOBALS=true')
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append('publish: ' + str(e)[:300]))
    pg.route('https://api.github.com/**', api)
    pg.add_init_script("localStorage.setItem('pb-studio-gh-token','ghp_stand-in')")
    t0 = time.time()
    pg.goto(url)
    while time.time() - t0 < 120 and not pg.evaluate("typeof studioState!=='undefined'&&!!studioState.D&&!document.querySelector('#main .loading')"):
        time.sleep(0.5)
    # T0.2: everything is read at the commit the Studio loaded, rigs-next.js included (not the page's own copy)
    at = sorted({r for _, r in st['reads']})
    if at != ['base1']: errs.append(f'publish: the Studio read at {at}, not only at the loaded commit base1')
    if not any(f == 'game/art/next/rigs-next.js' for f, _ in st['reads']): errs.append('publish: rigs-next.js was not read from the repository')
    ART = 'art/next/parts/front/publish_check.png'
    pending = "({data: studioState.dirty, rigs: studioState.rigsDirty, art: studioState.artDirty.has(%s)})" % json.dumps(ART)

    def make_edits(tag):
        pg.evaluate("""tag => { const c = document.createElement('canvas'); c.width = c.height = 4;
          const x = c.getContext('2d'); x.fillStyle = '#c03'; x.fillRect(0, 0, 4, 4);
          markArt(%s, c);
          const k = Object.keys(studioState.rigs).find(k => String((studioState.rigs[k].front || {}).sheet || '').startsWith('next/'));
          studioState.rigs[k].publishCheck = tag; studioState.rigsDirty = true;
          studioState.D.meta.publishCheck = tag; studioState.dirty = true; }""" % json.dumps(ART), tag)

    def idle():
        return pg.evaluate("document.querySelector('#saveBtn').textContent === 'Propose changes' && !document.querySelector('#saveBtn').disabled && !document.querySelector('#ghSum')")

    def start(summary):
        pg.evaluate("void saveAll()")
        t1 = time.time()
        while time.time() - t1 < 20 and not pg.locator('#ghSum').count(): time.sleep(0.1)
        pg.fill('#ghSum', summary)
        pg.locator('#dlg button', has_text='Propose changes').click()

    def settle(limit=30):
        t1 = time.time()
        while time.time() - t1 < limit:
            a = pg.locator('#dlg button', has_text='Save anyway')
            if a.count(): a.first.click()
            ok = pg.locator('#dlg button', has_text='OK')  # "Sent for approval"
            if ok.count(): ok.first.click()
            if idle(): return True
            time.sleep(0.2)
        return False

    def last_tree():
        trees = [json.loads(bd) for k, bd in st['log'] if k == 'trees']
        return [t['path'] for t in trees[-1]['tree']] if trees else []

    want = {'game/' + ART, 'game/art/rigs.js', 'game/art/next/rigs-next.js', 'game/data/meta.json'}
    # 1. a failure at each step: everything stays pending, and the retry carries all of it
    for step in ['blobs', 'trees', 'commits', 'refs', 'pulls']:
        st['log'].clear(); st['fail'] = {step: [502]}
        make_edits('fail-' + step)
        start('publish check: ' + step + ' fails'); settle()
        left = pg.evaluate(pending)
        if not all(left.values()): errs.append(f'publish: after a {step} failure, pending changes were dropped: {left}')
        made = [json.loads(bd)['ref'] for m, q, bd in st['calls'] if m == 'POST' and q.endswith('/git/refs')]
        st['log'].clear(); st['calls'].clear()
        start('publish check: retry after ' + step); settle()
        if step == 'pulls':
            # T0.3: the branch made before the pull request failed is moved to the new commit, not made again
            moved = [q for m, q, _ in st['calls'] if m == 'PATCH']
            again = [q for m, q, _ in st['calls'] if m == 'POST' and q.endswith('/git/refs')]
            if not made or again or not moved or not moved[0].endswith(made[-1][len('refs/heads/'):]): errs.append(f'publish: the retry after a pull request failure did not reuse its branch (made {made}, moved {moved}, made again {again})')
        refs = [json.loads(bd)['ref'] for m, q, bd in st['calls'] if m == 'POST' and q.endswith('/git/refs')]
        if any(not re.match(r'^refs/heads/studio/nojiroh-\d{8}-\d{6}-[a-z0-9]{1,4}$', r) for r in refs): errs.append(f'publish: branch names {refs}')
        sent = last_tree()
        if not any(k == 'pulls' for k, _ in st['log']): errs.append(f'publish: the retry after a {step} failure opened no pull request')
        missing = sorted(want - set(sent))
        if missing: errs.append(f'publish: the retry after a {step} failure left out {missing}')
        left = pg.evaluate(pending)
        if any(left.values()): errs.append(f'publish: after a successful retry ({step}), something still shows as pending: {left}')
    # 2. an error while building the proposal sends nothing
    st['log'].clear(); st['fail'] = {}
    make_edits('bad-id')
    pg.evaluate("studioState.D.maps['Bad id!'] = {}")
    # T1.3: the Check refuses that map before anything is built; this case is about the building, so it steps past it
    pg.evaluate("window.__ckBefore = checkBeforeSave; void (checkBeforeSave = async () => true)")
    start('publish check: bad id'); settle()
    pg.evaluate("void (checkBeforeSave = window.__ckBefore)")
    if st['log']: errs.append(f"publish: a proposal that could not be built still sent {[k for k, _ in st['log']]}")
    left = pg.evaluate(pending)
    if not all(left.values()): errs.append(f'publish: a proposal that could not be built dropped pending changes: {left}')
    pg.evaluate("delete studioState.D.maps['Bad id!']")
    # 3. while a proposal is sending: a second Ctrl+S does nothing, and an edit made meanwhile stays pending
    make_edits('held')
    st['log'].clear(); st['hold'] = 'trees'
    start('publish check: held'); t1 = time.time()
    while time.time() - t1 < 30 and not st['held']:
        a = pg.locator('#dlg button', has_text='Save anyway')
        if a.count(): a.first.click()
        time.sleep(0.1)
    if not st['held']: errs.append('publish: the proposal never reached the tree step')
    pg.evaluate("void saveAll()"); time.sleep(0.5)
    if pg.locator('#ghSum').count():
        errs.append('publish: a second Propose started while the first was sending')
        pg.locator('#dlg button', has_text='Cancel').click()
    pg.evaluate("""() => { const c = studioState.artDirty.get(%s); c.getContext('2d').fillRect(0, 0, 1, 1); markArt(%s, c);
      studioState.D.meta.publishCheck = 'during'; studioState.dirty = true; }""" % (json.dumps(ART), json.dumps(ART)))
    st['hold'] = None
    for r in st['held']:
        st['log'].append(('trees', r.request.post_data or ''))
        r.fulfill(json={'sha': 'x'})
    st['held'].clear(); settle()
    if sum(1 for k, _ in st['log'] if k == 'pulls') != 1: errs.append(f"publish: the held proposal made {sum(1 for k, _ in st['log'] if k == 'pulls')} pull requests")
    left = pg.evaluate(pending)
    if not (left['art'] and left['data']): errs.append(f'publish: an edit made while sending was cleared without being sent: {left}')
    # 4. T0.2: main moved on. A proposal sharing a file with main's new commits names it before anything is sent;
    # one that doesn't goes without a question. Either way the commit is made on the loaded commit (base1).
    def moved_case(files, answer):
        st['log'].clear(); st['head'] = 'main2'; st['compare'] = files
        make_edits('moved-' + answer)
        start('publish check: main moved')
        t1 = time.time(); asked = None
        while time.time() - t1 < 30 and not idle():
            h = pg.locator('#dlg h2')
            if h.count() and h.first.text_content() == 'Main has moved on':
                asked = pg.locator('#dlg .dlg-body').first.text_content()
                pg.locator('#dlg button', has_text=answer).click()
            a = pg.locator('#dlg button', has_text='Save anyway')
            if a.count(): a.first.click()
            ok = pg.locator('#dlg button', has_text='OK')
            if ok.count(): ok.first.click()
            time.sleep(0.2)
        return asked
    asked = moved_case(['game/data/meta.json', 'game/data/moves.json'], 'Cancel')
    if not asked or 'game/data/meta.json' not in asked or 'moves.json' in asked: errs.append(f'publish: main moved and changed meta.json, but the question was {asked!r}')
    if st['log']: errs.append(f"publish: a cancelled proposal still sent {[k for k, _ in st['log']]}")
    if not all(pg.evaluate(pending).values()): errs.append('publish: a cancelled proposal dropped pending changes')
    for files, answer in ((['game/data/meta.json'], 'Propose anyway'), (['game/data/moves.json'], 'none')):
        asked = moved_case(files, answer)
        if answer == 'none' and asked: errs.append(f'publish: main changed only other files, yet it asked: {asked!r}')
        parents = [json.loads(bd).get('parents') for k, bd in st['log'] if k == 'commits']
        if parents != [['base1']]: errs.append(f'publish: the proposal was not made on the loaded commit: parents {parents}')
        if any(pg.evaluate(pending).values()): errs.append(f'publish: after proposing on a moved main ({answer}), changes still show as pending')
    st['head'] = 'base1'; st['compare'] = []
    # 5. T0.3: an expired sign-in (401) opens the sign-in card over the Studio; Cancel keeps everything unsaved, a new
    # token sends the same changes with no reload
    def expired_case(token):
        st['log'].clear(); st['calls'].clear(); st['auth'].clear(); st['fail'] = {'blobs': [401]}
        make_edits('expired-' + (token or 'cancel'))
        start('publish check: expired sign-in')
        t1 = time.time()
        while time.time() - t1 < 20 and not pg.locator('#ghLogin #ghTok').count():
            a = pg.locator('#dlg button', has_text='Save anyway')
            if a.count(): a.first.click()
            time.sleep(0.2)
        if not pg.locator('#ghLogin #ghTok').count():
            errs.append('publish: a 401 did not open the sign-in card'); return
        if token:
            pg.fill('#ghTok', token); pg.click('#ghGo')
        else: pg.click('#ghCancel')
        settle()
    expired_case('')
    if any(k == 'pulls' for k, _ in st['log']): errs.append('publish: a cancelled sign-in still opened a pull request')
    if not all(pg.evaluate(pending).values()): errs.append('publish: a cancelled sign-in dropped pending changes')
    expired_case('ghp_fresh')
    if not any(k == 'pulls' for k, _ in st['log']): errs.append('publish: no pull request after signing in again')
    missing = sorted(want - set(last_tree()))
    if missing: errs.append(f'publish: after signing in again the proposal left out {missing}')
    if not st['auth'] or st['auth'][-1] != 'Bearer ghp_fresh': errs.append(f"publish: the retry did not use the new token ({st['auth'][-1:]})")
    if any(pg.evaluate(pending).values()): errs.append('publish: after signing in again, changes still show as pending')
    if pg.evaluate("performance.getEntriesByType('navigation').length !== 1"): errs.append('publish: the page reloaded')
    # put the page back (nothing pending) so the context closes cleanly
    pg.evaluate("studioState.artDirty.delete(%s); delete studioState.D.meta.publishCheck; studioState.dirty = studioState.rigsDirty = false" % json.dumps(ART))
    n = sum(1 for e in errs if e.startswith('publish:'))
    print(f'publish: failures at 5 steps, a proposal that cannot be built, a held send, main moved on, an expired sign-in ({n} problem(s))', flush=True)
    ctx.close()


def drafts_checks(b, url, errs):
    """Studio plan Phase 1 (T1.1): what isn't proposed yet is kept in the browser (IndexedDB) and offered back when the
    Studio opens again. One context (one browser profile, so its IndexedDB lasts across pages) and a GitHub stand-in.
    Each case edits a data field, a rig and a picture with the Studio's own calls, waits for the draft, closes the page
    without saving and opens a new one."""
    import base64
    tree = [{'type': 'blob', 'path': str(p.relative_to(ROOT)), 'sha': 'x', 'size': p.stat().st_size}
            for p in (ROOT / 'game' / 'art').rglob('*') if p.is_file()]
    st = {'head': 'base1', 'reads': [], 'log': [], 'fail': {}, 'compare': []}

    def api(route):
        u = urlparse(route.request.url)
        p = u.path
        if route.request.method != 'GET':
            k = p.rsplit('/', 1)[-1]
            st['log'].append((k, route.request.post_data or ''))
            if st['fail'].get(k):
                code = st['fail'][k].pop(0)
                return route.fulfill(status=code, json={'message': f'stand-in {code} at {k}'})
            return route.fulfill(json={'sha': 'x', 'number': 8, 'html_url': 'x', 'object': {'sha': 'x'}, 'tree': {'sha': 'x'}})
        if p == '/user': return route.fulfill(json={'login': 'nojiroh'})
        if p.rstrip('/') == '/repos/nojiroh/pocket-billies': return route.fulfill(json={'permissions': {'push': True, 'admin': True}})
        if '/compare/' in p: return route.fulfill(json={'total_commits': 1, 'files': [{'filename': f} for f in st['compare']]})
        if '/git/trees/' in p: return route.fulfill(json={'tree': tree})
        if '/git/commits/' in p: return route.fulfill(json={'sha': p.rsplit('/', 1)[-1], 'tree': {'sha': 'tree-x'}})
        if '/git/ref' in p: return route.fulfill(json={'object': {'sha': st['head']}})
        if '/contents/' in p:
            f = ROOT / unquote(p.split('/contents/', 1)[1])
            if 'studio/admins.json' not in p: st['reads'].append(parse_qs(u.query).get('ref', [''])[0])
            if f.is_file(): return route.fulfill(body=f.read_bytes())
        return route.fulfill(status=404, json={'message': 'Not Found'})

    ctx = b.new_context(viewport={'width': 1400, 'height': 900})
    ctx.add_init_script('window.PB_TEST_GLOBALS=true')
    ctx.add_init_script("localStorage.setItem('pb-studio-gh-token','ghp_stand-in')")
    ctx.route('https://api.github.com/**', api)
    ART = 'art/next/parts/front/draft_check.png'
    pending = "({data: studioState.dirty, rigs: studioState.rigsDirty, art: studioState.artDirty.has(%s)})" % json.dumps(ART)
    stored = """async () => { const d = await draftRead(); return d ? {files: Object.keys(d.files), rigs: d.rigsText != null,
      art: d.art.map(a => a.path), base: d.base, meta: d.files['meta.json'] || '', token: JSON.stringify(Object.keys(d)).includes('token')} : null }"""

    def ready(pg):
        return pg.evaluate("typeof studioState!=='undefined'&&!!studioState.D&&!document.querySelector('#main .loading')")

    def open_page(answer=None):
        """a new page; answers the draft question (Restore, Later, Discard) if asked. Returns (page, question text)"""
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append('drafts: ' + str(e)[:300]))
        st['reads'].clear()
        pg.goto(url)
        t0 = time.time(); asked = None
        while time.time() - t0 < 120 and not ready(pg):
            h = pg.locator('#dlg h2')
            if asked is None and h.count() and h.first.text_content() == 'Unsent changes':
                asked = pg.locator('#dlg .dlg-body').first.text_content()
                if answer: pg.locator('#dlg button', has_text=answer).click()
                if answer == 'Discard':
                    pg.wait_for_selector('#dlg button:has-text("Delete")', timeout=5000)
                    pg.locator('#dlg button', has_text='Delete').click()
            time.sleep(0.3)
        if not ready(pg): errs.append(f'drafts: the Studio did not load (asked {asked!r})')
        time.sleep(0.5)
        return pg, asked

    def make_edits(pg, tag):
        pg.evaluate("""tag => { const c = document.createElement('canvas'); c.width = c.height = 4;
          const x = c.getContext('2d'); x.fillStyle = '#c03'; x.fillRect(0, 0, 4, 4);
          markArt(%s, c);
          const k = Object.keys(studioState.rigs).find(k => String((studioState.rigs[k].front || {}).sheet || '').startsWith('next/'));
          studioState.rigs[k].draftCheck = tag; changed(true);
          studioState.D.meta.draftCheck = tag; changed(); }""" % json.dumps(ART), tag)

    def wait_draft(pg, tag, limit=10):
        """the draft holds this tag, written by the Studio's own timer (2 s after the last change)"""
        t0 = time.time()
        while time.time() - t0 < limit:
            d = pg.evaluate(stored)
            if d and tag in d['meta']: return d, time.time() - t0
            time.sleep(0.25)
        return pg.evaluate(stored), None

    def propose(pg, summary, answer='Propose anyway'):
        pg.evaluate("void saveAll()")
        t1 = time.time()
        while time.time() - t1 < 20 and not pg.locator('#ghSum').count(): time.sleep(0.1)
        pg.fill('#ghSum', summary)
        pg.locator('#dlg button', has_text='Propose changes').click()
        t1 = time.time(); moved = None
        while time.time() - t1 < 30:
            h = pg.locator('#dlg h2')
            if h.count() and h.first.text_content() == 'Main has moved on':
                moved = pg.locator('#dlg .dlg-body').first.text_content()
                pg.locator('#dlg button', has_text=answer).click()
            for t in ('Save anyway', 'OK'):
                a = pg.locator('#dlg button', has_text=t)
                if a.count(): a.first.click()
            if pg.evaluate("document.querySelector('#saveBtn').textContent === 'Propose changes' && !document.querySelector('#saveBtn').disabled && !document.querySelector('#ghSum') && !document.querySelector('#dlg .dlg')"): break
            time.sleep(0.2)
        return moved

    def last_tree():
        trees = [json.loads(bd) for k, bd in st['log'] if k == 'trees']
        return [t['path'] for t in trees[-1]['tree']] if trees else []

    want = {'game/' + ART, 'game/art/rigs.js', 'game/art/next/rigs-next.js', 'game/data/meta.json'}
    # 1. edits, the tab closed without proposing, reopened: one question; Restore brings all three back
    pg, asked = open_page()
    if asked: errs.append(f'drafts: a fresh browser was asked about a draft: {asked!r}')
    make_edits(pg, 'kept-1')
    d, secs = wait_draft(pg, 'kept-1')
    if secs is None: errs.append(f'drafts: no draft 10 s after the edits ({d})')
    else:
        if set(d['files']) != {'meta.json'} or not d['rigs'] or d['art'] != [ART] or d['base'] != 'base1' or d['token']:
            errs.append(f'drafts: the draft does not hold exactly the three changes at base1: {d}')
        print(f'drafts: written {secs:.1f} s after the last edit ({len(d["files"])} data file, rigs, {len(d["art"])} picture)', flush=True)
    ms = pg.evaluate("async () => { const a = performance.now(); studioState.D.meta.draftCheck += '+'; changed(); await draftNow(); return performance.now() - a }")
    pg.close()
    pg, asked = open_page('Restore')
    if not asked or '1 data file, the skeletons and 1 picture' not in asked: errs.append(f'drafts: the question on reopening was {asked!r}')
    elif 'Main has new commits' in asked: errs.append('drafts: main did not move, yet the question says it did')
    left = pg.evaluate(pending)
    if not all(left.values()): errs.append(f'drafts: Restore did not bring every change back as pending: {left}')
    back = pg.evaluate("""() => { const k = Object.keys(studioState.rigs).find(k => studioState.rigs[k].draftCheck);
      const c = studioState.artDirty.get(%s), px = c ? [...c.getContext('2d').getImageData(1, 1, 1, 1).data] : null;
      return {meta: studioState.D.meta.draftCheck, rig: k ? studioState.rigs[k].draftCheck : null, px, undo: studioState.undo.length,
        undoOff: document.querySelector('#undoBtn').disabled} }""" % json.dumps(ART))
    if back['meta'] != 'kept-1+' or back['rig'] != 'kept-1' or back['px'] != [204, 0, 51, 255]: errs.append(f'drafts: the restored changes are not the ones made: {back}')
    if back['undo'] or not back['undoOff']: errs.append(f'drafts: undo does not start empty after a restore: {back}')
    # 2. a restored draft proposes correctly, and the draft goes once the proposal is confirmed
    st['log'].clear()
    propose(pg, 'drafts check: restored')
    missing = sorted(want - set(last_tree()))
    if missing: errs.append(f'drafts: the proposal after a restore left out {missing}')
    meta = next((base64.b64decode(json.loads(bd)['content']).decode() for k, bd in st['log'] if k == 'blobs' and 'kept-1+' in base64.b64decode(json.loads(bd)['content']).decode('utf8', 'replace')), None)
    if not meta: errs.append('drafts: the proposal does not carry the restored data edit')
    if any(pg.evaluate(pending).values()): errs.append('drafts: after proposing, changes still show as pending')
    if pg.evaluate(stored): errs.append('drafts: the draft is still there after a confirmed proposal')
    pg.close()
    # 3. a failed proposal keeps the draft
    pg, asked = open_page()
    if asked: errs.append(f'drafts: asked again after the draft was proposed: {asked!r}')
    make_edits(pg, 'failed-3')
    wait_draft(pg, 'failed-3')
    st['fail'] = {'trees': [502]}
    propose(pg, 'drafts check: fails')
    time.sleep(0.5)
    d = pg.evaluate(stored)
    if not d or 'failed-3' not in d['meta'] or not d['rigs'] or d['art'] != [ART]: errs.append(f'drafts: a failed proposal did not keep the whole draft: {d}')
    pg.close()
    # 4. main moved on: the question says so, and Restore reads everything at the draft's commit (base1), not main's
    st['head'] = 'main2'; st['compare'] = ['game/data/meta.json']
    pg, asked = open_page('Restore')
    if not asked or 'Main has new commits' not in asked: errs.append(f'drafts: main moved, but the question was {asked!r}')
    at = sorted(set(st['reads']))
    if at != ['base1']: errs.append(f'drafts: a restore on a moved main read at {at}, not only at the draft commit base1')
    st['log'].clear()
    moved = propose(pg, 'drafts check: moved', 'Cancel')
    if not moved or 'meta.json' not in moved: errs.append(f'drafts: proposing a restored draft on a moved main did not name meta.json ({moved!r})')
    if st['log']: errs.append(f"drafts: a cancelled proposal still sent {[k for k, _ in st['log']]}")
    pg.close()
    st['head'] = 'base1'; st['compare'] = []
    # 5. Later keeps the draft and writes nothing over it; Discard removes it
    pg, asked = open_page('Later')
    if any(pg.evaluate(pending).values()): errs.append('drafts: Later still put changes back')
    if not pg.locator('#draftOff').count(): errs.append('drafts: after Later, nothing says new changes are not kept')
    make_edits(pg, 'later-5'); time.sleep(3)
    d = pg.evaluate(stored)
    if not d or 'failed-3' not in d['meta']: errs.append(f'drafts: an edit after Later wrote over the kept draft: {d}')
    pg.close()
    pg, asked = open_page('Discard')
    if not asked: errs.append('drafts: the kept draft was not offered again after Later')
    if any(pg.evaluate(pending).values()) or pg.evaluate(stored): errs.append('drafts: Discard left the draft or its changes')
    pg.close()
    # 6. a browser that can't keep drafts (IndexedDB refused): the Studio works and says changes aren't kept
    ctx2 = b.new_context(viewport={'width': 1400, 'height': 900})
    ctx2.add_init_script('window.PB_TEST_GLOBALS=true')
    ctx2.add_init_script("localStorage.setItem('pb-studio-gh-token','ghp_stand-in')")
    ctx2.add_init_script("IDBFactory.prototype.open = function () { throw new DOMException('stand-in: storage refused', 'SecurityError') }")
    ctx2.route('https://api.github.com/**', api)
    pg = ctx2.new_page()
    pg.on('pageerror', lambda e: errs.append('drafts (no storage): ' + str(e)[:300]))
    pg.goto(url); t0 = time.time()
    while time.time() - t0 < 120 and not ready(pg): time.sleep(0.3)
    if not ready(pg): errs.append('drafts: without IndexedDB the Studio did not load')
    elif not pg.locator('#draftOff').count(): errs.append('drafts: without IndexedDB nothing says changes are not kept')
    else:
        make_edits(pg, 'none-6'); time.sleep(2.5)
        if not all(pg.evaluate(pending).values()): errs.append('drafts: without IndexedDB, edits did not stay pending')
    ctx2.close()
    n = sum(1 for e in errs if e.startswith('drafts'))
    print(f'drafts: restore, propose, a failed proposal, main moved on, Later, Discard, no storage; a write takes {ms:.0f} ms ({n} problem(s))', flush=True)
    ctx.close()


# island track IS-6a/IS-6b (moved here from check-fast.py in the test cleanup track, TC-4: the island's 3D view draws
# slowly in a headless browser, about 3 minutes, too long for every push). The Studio on a page of its own, its data
# read straight from the files (no sign-in)
STUDIO_DATA = """(async()=>{const ix=await (await fetch('../game/data/index.json')).json(),paths=[];
 for(const k of ix.keys){const sp=ix.split&&ix.split[k];if(!sp)paths.push(k+'.json');else for(const id of sp.ids)paths.push(k+'/'+id+'.json')}
 const F={};await Promise.all(paths.map(async p=>{F[p]=await (await fetch('../game/data/'+p)).json()}));
 const D=PB_DATA.assemble(ix,p=>F[p]);studioState.D=D;studioState.rigs={};studioState.files=[];studioState.last=null;commit(true);
 document.querySelectorAll('.dlg,.modal,.overlay').forEach(e=>e.remove());return Object.keys(D).length})()"""


HUB_STROKE = """((id,x0,z0,x1,z1,o)=>{const c=document.getElementById(id);c.setPointerCapture=()=>{};const sc=studioState.D.maps.test_island,r=c.getBoundingClientRect(),Z=r.width/sc.w,
 ev=(t,x,z)=>c.dispatchEvent(new PointerEvent(t,Object.assign({clientX:r.left+x*Z,clientY:r.top+(sc.h-z)*Z,pointerId:7,bubbles:true,button:0},o||{})));
 ev('pointerdown',x0,z0);for(let i=1;i<=4;i++)ev('pointermove',x0+(x1-x0)*i/4,z0+(z1-z0)*i/4);ev('pointerup',x1,z1)})"""


def poll(pg, cond, sec):
    """until(), asked from here: the island's frames take seconds each in a headless browser and come back to back,
    which can starve the page's own timers that until()'s polling runs on (seen on a busy runner); an evaluate still
    gets through between frames"""
    end = time.time() + sec
    while True:
        if pg.evaluate(f'(()=>{{try{{return !!({cond})}}catch(e){{return false}}}})()'): return True
        if time.time() > end: return False
        time.sleep(0.25)


def studio_hub(pg, base):
    """island track IS-6a: the Hub island section opens on test_island and draws (the orbit view and the map), a drag
    turns the orbit, a brush stroke paints; locking stores the hash and turns the tools off, here and in Walk scenes,
    where props stay free; the Studio's Check catches a changed locked ground; unlocking (asked first) frees it.
    The island's frames are slow in a headless browser (seconds each on a busy runner), so it waits with poll() and
    as long as check-fast's drawing() did"""
    if not poll(pg, "typeof openSection==='function'&&typeof PB_DATA==='object'", 60): raise Exception('the Studio never loaded')
    pg.evaluate(STUDIO_DATA)
    # the section opens on the hub's own island by default (copperleaf, since IS-5); this check uses the small one
    pg.evaluate("studioState.sel.hub='test_island';openSection('hub');0")
    if not poll(pg, "studioState.sel.hub==='test_island'&&walkView.id==='test_island'&&!!document.getElementById('hubMap')", 40):
        raise Exception('Hub island didn’t open on test_island: ' + str(pg.evaluate("[studioState.sel.hub,walkView.id]")))
    if not poll(pg, "walkView.ready&&walkRenderer.on", 90): raise Exception('the orbit view never got ready')
    f0 = pg.evaluate('walkRenderer.frames')
    if not poll(pg, f'walkRenderer.frames>={f0 + 3}', 60): raise Exception('test_island isn’t drawing (black screen)')
    if not poll(pg, "!!hubEd.goal", 40):
        raise Exception('the orbit view never looked at the island: ' + pg.evaluate("JSON.stringify({sec:studioState.sec,mapId:hubEd.mapId,walk:hubEd.walk,look:walkView.opt.look&&walkView.opt.look.name,id:walkView.id,scw:walkView.sc&&walkView.sc.w,frames:walkRenderer.frames,cv:walkView.cv&&walkView.cv.id,ready:walkView.ready,bt:!!walkRenderer.bt,dir:!!walkView.director,bat:!!walkView.battle})"))
    if not pg.evaluate("(()=>{const c=document.getElementById('hubMap');return c.width>100&&c.getContext('2d').getImageData(c.width>>1,c.height>>1,1,1).data[3]>0})()"):
        raise Exception('the map drew nothing')
    y0 = pg.evaluate("hubEd.goal.yaw")
    pg.evaluate("""(()=>{const c=document.getElementById('hubPv');c.setPointerCapture=()=>{};const r=c.getBoundingClientRect(),ev=(t,x)=>c.dispatchEvent(new PointerEvent(t,{clientX:r.left+x,clientY:r.top+r.height/2,pointerId:8,bubbles:true,button:0}));
      ev('pointerdown',20);ev('pointermove',60);ev('pointermove',120);ev('pointerup',120)})();0""")
    if abs(pg.evaluate("hubEd.goal.yaw") - y0) < 0.1: raise Exception('a drag on the orbit view didn’t turn it')
    rows = "JSON.stringify(studioState.D.maps.test_island.tiles)"
    t0 = pg.evaluate(rows)
    bound = lambda id: poll(pg, f"!!(document.getElementById('{id}')||{{}})._b", 40)   # the map's tools bind after its art loads
    pg.evaluate("ACTIONS.hubTool({t:'paint'});ACTIONS.hubTer({c:'r'});0")
    if not bound('hubMap'): raise Exception('the map’s tools never bound')
    pg.evaluate(f"({HUB_STROKE})('hubMap',40,20,50,20);0")
    if pg.evaluate(rows) == t0: raise Exception('a Paint ground stroke changed nothing')
    pg.evaluate("undo();0")
    if pg.evaluate(rows) != t0: raise Exception('Undo didn’t take the stroke back')
    pg.evaluate("ACTIONS.hubLock();0")
    bound('hubMap')
    G = pg.evaluate("studioState.D.maps.test_island.islandGen")
    if not (G.get('lock') and G.get('hash')): raise Exception(f'Lock the ground stored {G}')
    if not pg.evaluate("[...document.querySelectorAll('[data-act=hubTool]')].every(b=>b.disabled)"): raise Exception('the tools stay on when locked')
    pg.evaluate(f"({HUB_STROKE})('hubMap',40,20,50,20);0")
    if pg.evaluate(rows) != t0: raise Exception('a locked ground took a brush stroke')
    pg.evaluate("studioState.sel.scene='test_island';openSection('scenes');ACTIONS.scTool({t:'paint'});0")
    if not poll(pg, "!!document.getElementById('scMap')&&!!document.querySelector('#main .hub-note')", 40): raise Exception('Walk scenes doesn’t say the ground is locked')
    if not bound('scMap'): raise Exception('Walk scenes’ map never bound')
    n0 = pg.evaluate("studioState.D.maps.test_island.props.length")
    pg.evaluate(f"({HUB_STROKE})('scMap',40,20,50,20);ACTIONS.scTool({{t:'props'}});mapEditor.prop=Object.keys(sceneryCatalog().props)[0];0")
    bound('scMap')
    pg.evaluate(f"({HUB_STROKE})('scMap',45,25,45,25);0")
    if pg.evaluate(rows) != t0: raise Exception('Walk scenes painted a locked ground')
    if pg.evaluate("studioState.D.maps.test_island.props.length") != n0 + 1: raise Exception('Walk scenes didn’t place a prop on a locked island')
    pg.evaluate("studioState.D.maps.test_island.heights[10][10]+=1;0")
    if not pg.evaluate("runCheck().some(p=>p.go==='hub'&&/locked but changed/.test(p.msg))"): raise Exception('the Studio’s Check missed a changed locked ground')
    pg.evaluate("studioState.D.maps.test_island.heights[10][10]-=1;openSection('hub');ACTIONS.hubUnlock();0")
    if not poll(pg, "!!document.querySelector('#dlg button.primary')", 40): raise Exception('Unlock didn’t ask first')
    pg.evaluate("document.querySelector('#dlg button.primary').click();0")
    if not poll(pg, "!studioState.D.maps.test_island.islandGen.lock&&!studioState.D.maps.test_island.islandGen.hash", 40): raise Exception('Unlock left the lock')
    if not poll(pg, "[...document.querySelectorAll('[data-act=hubTool]')].every(b=>!b.disabled)", 40): raise Exception('the tools stay off after Unlock')
    return f'drawn, a drag turned it {abs(pg.evaluate("hubEd.goal.yaw") - y0):.2f} rad, a stroke and its undo, the lock here and in Walk scenes (props free), the Check, unlock'


def studio_hub_dials(pg, base):
    """island track IS-6b: the Hub island editor's dials on test_island (after studio_hub, on its page): the map's own
    dials don't fit round its middle and say so; a slider makes a draft that the orbit view draws (`_hubgen`) while the
    map's tools are off; the walk check runs; Use this island puts the draft's ground on the map with the locked town
    zone as it was and the props kept; Undo takes it back; a locked ground shows the dials read-only, no draft"""
    M = 'studioState.D.maps.test_island'
    if not pg.evaluate("typeof studioState==='object'&&!!studioState.D"):   # run alone (--only): the Studio loads here
        if not poll(pg, "typeof openSection==='function'&&typeof PB_DATA==='object'", 60): raise Exception('the Studio never loaded')
        pg.evaluate(STUDIO_DATA)
    pg.evaluate("studioState.sel.hub='test_island';openSection('hub');0")
    if not poll(pg, "!!document.getElementById('hubGen')&&!!hubEd.goal", 60): raise Exception('Hub island didn’t open again')
    t0 = pg.evaluate(f"JSON.stringify({M}.tiles)")
    town = pg.evaluate(f"JSON.stringify({M}.zones.find(z=>z.k==='town'))")
    props = pg.evaluate(f"JSON.stringify({M}.props)")
    pg.evaluate("document.querySelector('[data-act=hubGenOpen]').click();0")
    if not poll(pg, "hubGen.on&&!hubGen.busy&&(!!hubGen.draft||!!hubGen.err)", 90): raise Exception('the dials never made a draft')
    if not pg.evaluate("/doesn’t fit round the map’s middle/.test(hubGen.err)"):
        raise Exception('test_island’s own dials should not fit round its middle: ' + pg.evaluate("hubGen.err||'a draft'"))
    # a small island fits round (60, 60); the last change goes through a slider, as a hand would
    pg.evaluate("Object.assign(hubGen.dials,{mountain:{r:10,peak:12},town:{on:0},hamlet:{on:0},zones:[]});0")
    if not pg.evaluate("(()=>{const r=document.querySelector('[data-hubgen=\"size.r\"]');if(!r)return false;r.value='30';r.dispatchEvent(new Event('input',{bubbles:true}));return true})()"):
        raise Exception('no Land radius slider')
    if not poll(pg, "!hubGen.busy&&!!hubGen.draft&&hubGen.draft.w===120", 90): raise Exception('the slider made no draft: ' + pg.evaluate("hubGen.err"))
    if not poll(pg, "walkView.id==='_hubgen'&&walkView.ready", 60): raise Exception('the orbit view doesn’t show the draft')
    if not poll(pg, "walkView.ready&&walkRenderer.on", 90): raise Exception('the draft never got ready')
    f0 = pg.evaluate('walkRenderer.frames')
    if not poll(pg, f'walkRenderer.frames>={f0 + 2}', 90): raise Exception('the draft isn’t drawing (black screen)')
    if pg.evaluate(f"JSON.stringify({M}.tiles)") != t0: raise Exception('a draft changed the map')
    if not pg.evaluate("[...document.querySelectorAll('[data-act=hubTool]')].every(b=>b.disabled)"): raise Exception('the map’s tools stay on over a draft')
    pg.evaluate("ACTIONS.hubGenWalk();0")
    if not pg.evaluate("Array.isArray(hubGen.walk)"): raise Exception('the walk check didn’t run')
    walks = pg.evaluate("hubGen.walk.length")
    pg.evaluate("document.querySelector('[data-act=hubGenUse]').click();0")
    if not poll(pg, f"JSON.stringify({M}.tiles)!=={json.dumps(t0)}", 30): raise Exception('Use this island changed nothing')
    if pg.evaluate(f"JSON.stringify({M}.zones.find(z=>z.k==='town'))") != town: raise Exception('the locked town zone changed')
    if pg.evaluate(f"JSON.stringify({M}.props)") != props: raise Exception('the props changed')
    if pg.evaluate(f"{M}.islandGen.dials.size.r") != 30: raise Exception('the dials weren’t stored in islandGen')
    if not poll(pg, "walkView.id==='test_island'", 30): raise Exception('the orbit view stayed on the draft')
    pg.evaluate("undo();0")
    if pg.evaluate(f"JSON.stringify({M}.tiles)") != t0: raise Exception('Undo didn’t take the island back')
    pg.evaluate("ACTIONS.hubGenClose();ACTIONS.hubLock();0")
    if not poll(pg, f"!!{M}.islandGen.lock", 30): raise Exception('the ground didn’t lock')
    pg.evaluate("hubGen.open.size=true;document.querySelector('[data-act=hubGenOpen]').click();0")
    if not poll(pg, "hubGen.on&&!!document.querySelector('[data-hubgen=\"size.r\"]')", 30): raise Exception('a locked island’s dials didn’t show')
    if not pg.evaluate("[...document.querySelectorAll('#hubGen [data-hubgen]')].every(e=>e.disabled)&&!document.querySelector('[data-act=hubGenUse]')"):
        raise Exception('a locked island’s dials can be moved, or it offers Use this island')
    if pg.evaluate("!!hubGen.draft||hubGen.busy"): raise Exception('a locked island made a draft')
    pg.evaluate(f"hubUnlockGround({M});ACTIONS.hubGenClose();0")
    return f'too big round the middle said so; a slider made a 120 m draft, drawn; {walks} walk problems; used (town zone and props kept), undone; locked: read-only'


def hub_checks(b, url, errs):
    """the Hub island section on test_island (IS-6a, then IS-6b on the same page): a small page (400x300, as the fast
    check had it), no GitHub token; anything the page asks of GitHub gets a 404, so nothing leaves the machine"""
    ctx = b.new_context(viewport={'width': 400, 'height': 300}, device_scale_factor=1)
    ctx.add_init_script('window.PB_TEST_GLOBALS=true')
    ctx.route('https://api.github.com/**', lambda r: r.fulfill(status=404, json={'message': 'Not Found'}))
    ctx.set_default_timeout(60000)
    pg = ctx.new_page()
    seen = []
    pg.on('pageerror', lambda e: seen.append(str(e)[:300]))
    pg.on('console', lambda m: seen.append(m.text[:300]) if m.type == 'error' else None)
    pg.goto(url)
    for what, step in (('hub', studio_hub), ('hub dials', studio_hub_dials)):
        t0, n0 = time.time(), len(seen)
        try:
            note = step(pg, None)
        except Exception as e:
            note = None
            errs.append(f'{what}: {str(e).splitlines()[0][:300]}')
        errs.extend(f'{what}: {e}' for e in seen[n0:])
        if note: print(f'{what}: {note} ({time.time() - t0:.0f} s)', flush=True)
    ctx.close()


def main():
    srv = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    tree = [{'type': 'blob', 'path': str(p.relative_to(ROOT)), 'sha': 'x', 'size': p.stat().st_size}
            for p in (ROOT / 'game').rglob('*') if p.is_file()]
    posts, bodies = [], []

    def api(route):
        p = urlparse(route.request.url).path
        if route.request.method != 'GET':
            posts.append(p.rsplit('/', 1)[-1])
            bodies.append((p.rsplit('/', 1)[-1], route.request.post_data or ''))
            return route.fulfill(json={'sha': 'x', 'number': 1, 'html_url': 'x', 'object': {'sha': 'x'}, 'tree': {'sha': 'x'}})
        if p == '/user': return route.fulfill(json={'login': 'nojiroh'})
        if p.rstrip('/') == '/repos/nojiroh/pocket-billies': return route.fulfill(json={'permissions': {'push': True, 'admin': True}})
        if '/git/trees/' in p: return route.fulfill(json={'tree': tree})
        if '/git/commits/' in p: return route.fulfill(json={'sha': 'x', 'tree': {'sha': 'x'}})
        if '/git/ref' in p: return route.fulfill(json={'object': {'sha': 'x'}})
        if '/contents/' in p:
            f = ROOT / unquote(p.split('/contents/', 1)[1])
            if f.is_file(): return route.fulfill(body=f.read_bytes())
        return route.fulfill(status=404, json={'message': 'Not Found'})

    errs = []
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        ctx = b.new_context(viewport={'width': 1400, 'height': 900})
        ctx.add_init_script('window.PB_TEST_GLOBALS=true')  # phase 04d: the modules' names on window, for evaluate()
        ctx.add_init_script(GL_COUNT)
        pg = ctx.new_page()
        pg.on('console', lambda m: errs.append(m.text[:300]) if m.type == 'error' else None)
        pg.on('console', lambda m: GL_WARN.append(m.text[:300]) if re.search(r'INVALID_OPERATION|does not belong to this context', m.text) else None)
        pg.on('pageerror', lambda e: errs.append(str(e)[:400]))
        pg.route('https://api.github.com/**', api)
        pg.add_init_script("localStorage.setItem('pb-studio-gh-token','ghp_stand-in')")
        t0 = time.time()
        pg.goto(f'http://127.0.0.1:{srv.server_address[1]}/studio/index.html')
        while time.time() - t0 < 120 and not pg.evaluate("typeof studioState!=='undefined'&&!!studioState.D&&!document.querySelector('#main .loading')"):
            time.sleep(0.5)
        if not pg.evaluate("typeof studioState!=='undefined'&&!!studioState.D"): errs.append('the game data never loaded')
        print(f'loaded in {time.time() - t0:.0f} s', flush=True)
        if ONLY is None or 'sections' in ONLY or 'art' in ONLY:
            sections = pg.evaluate("typeof SECTIONS==='object'?Object.keys(SECTIONS):[]")
            for k in sections:
                n = len(errs)
                pg.evaluate(f"void openSection({json.dumps(k)})")
                time.sleep(1)
                if len(errs) > n: errs[n:] = [f'{k}: {e}' for e in errs[n:]]
            print(f'{len(sections)} sections opened', flush=True)
            # the art tools (studio track): the pixel editor on both views, the skeleton builder, the battle preview
            n = len(errs)
            sp = pg.evaluate("studioState.D.lines[0].id + '0'")
            pg.evaluate(f"void openPixelEditor({json.dumps(sp)}, 'front')")
            pg.wait_for_selector('#pxCv', timeout=20000); time.sleep(0.5)
            pixel_canvas_steps(pg, errs, sp)
            pg.click('.pxed [data-pe=atlas][data-v=back]'); time.sleep(0.5)
            pg.click('.pxed [data-pe=close]'); time.sleep(0.3)
            pg.evaluate(f"void openSkeleton({json.dumps(sp)}, 'front')")
            pg.wait_for_selector('.pxed.skel', timeout=20000); time.sleep(0.5)
            pg.click('.pxed.skel [data-sk=close]'); time.sleep(0.3)
            pg.evaluate("void openSection('preview')"); pg.wait_for_selector('#cvWorld', timeout=20000); time.sleep(2)
            # studio track ST-0: the Coats section recolours its preview; a new coat and a ramp swap are edits
            pg.evaluate("void openSection('coats')"); pg.wait_for_selector('canvas.spr-prev', timeout=20000); time.sleep(1.5)
            diff = pg.evaluate("""(()=>{const [a,b]=[...document.querySelectorAll('#main canvas.spr-prev')];if(!a||!b)return -1;
              const d=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data,x=d(a),y=d(b);let n=0;for(let i=0;i<x.length;i+=4)if(x[i]!==y[i]||x[i+1]!==y[i+1]||x[i+2]!==y[i+2])n++;return n})()""")
            if diff < 20: errs.append(f'coats: the coat preview looks like the normal one ({diff} pixels differ)')
            pg.evaluate("document.querySelector('[data-act=coatRampAdd]').click()"); time.sleep(0.3)
            if pg.evaluate("Object.keys(studioState.D.coats[studioState.sel.coat].ramps).length") < 2: errs.append('coats: + Swap a ramp added nothing')
            pg.evaluate("void openSection('preview')"); time.sleep(1)
            if len(errs) > n: errs[n:] = [f'art tools: {e}' for e in errs[n:]]
            print(f'art tools opened: pixel editor (front, back), skeleton builder, battle preview, coats ({diff} pixels recoloured)', flush=True)
        for name, step in STEPS:
            if ONLY is None or name in ONLY: step(pg, errs)
        pg.evaluate("const k = Object.keys(studioState.D.moves)[0]; studioState.D.moves[k].name += ' Test'; studioState.dirty = true; void saveAll()")
        t0 = time.time()
        while time.time() - t0 < 60 and 'pulls' not in posts:
            time.sleep(0.5)
            pg.evaluate("document.querySelectorAll('#dlg button, #modal button').forEach(b => /Save anyway|Propose|Send|OK/.test(b.textContent) && b.click())")
        if 'pulls' not in posts: errs.append(f'no pull request proposed (sent: {posts})')
        else: print('proposed: ' + ', '.join(posts), flush=True)
        if ONLY is None or 'kit_write' in ONLY: kit_write_sent(pg, bodies, errs)
        if ONLY is None or 'ui' in ONLY:
            # UI-3: the large cut left at 20 px is in the proposal, as uiTheme.json
            import base64
            tree = next((json.loads(b) for k, b in bodies if k == 'trees'), {'tree': []})
            paths = [t['path'] for t in tree.get('tree', [])]
            blobs = [json.loads(b) for k, b in bodies if k == 'blobs']
            sent = [base64.b64decode(x['content']).decode('utf8', 'replace') for x in blobs]
            ui = next((json.loads(t) for t in sent if '"overrides"' in t and '"defaults"' in t and '"cutLg"' in t), None)
            if 'game/data/uiTheme.json' not in paths: errs.append(f'ui: uiTheme.json is not in the proposal ({paths})')
            elif not ui or ui['defaults']['shape']['cutLg'] != 20: errs.append('ui: the proposal does not carry the large cut at 20 px')
            else: print('ui: the proposal carries game/data/uiTheme.json with the large cut at 20 px', flush=True)
        if ONLY is None or 'publish' in ONLY:
            publish_checks(b, f'http://127.0.0.1:{srv.server_address[1]}/studio/index.html', errs)
        if ONLY is None or 'drafts' in ONLY:
            drafts_checks(b, f'http://127.0.0.1:{srv.server_address[1]}/studio/index.html', errs)
        if ONLY is None or 'hub' in ONLY:
            hub_checks(b, f'http://127.0.0.1:{srv.server_address[1]}/studio/index.html', errs)
        b.close()
    for e in errs: print('PROBLEM', e)
    print('ok' if not errs else f'{len(errs)} problem(s)')
    sys.exit(1 if errs else 0)


if __name__ == '__main__':
    main()

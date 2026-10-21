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
UI track UI-3: the UI look section: a colour dial changed shows in the preview frame, Undo puts the data and the
preview back; a screen's own colour shows on that screen only and ↺ takes it away; a preset applies and undoes; Find
and the Check's Show me reach a dial; Hold to compare shows the saved look; a cut size is left changed, so the
proposal at the end must carry uiTheme.json with it.

    python3 tools/check-studio-github.py           # the repository as it is (run `npm run data` first)
    python3 tools/check-studio-github.py dist      # the build (`npm run build` first)
    python3 tools/check-studio-github.py --only=ui,studio_test   # sign in, only these steps, then the proposal
                                                                 # (step names: STEPS below)

Needs Python 3 and Playwright (tools/requirements-check.txt). About a minute."""
import json, re, sys, threading, time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

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
    pg.evaluate("studioState.D.trainers.crude.script.splice(1, 0, '  set s3_draft'); mapEditor.story.flags = {'beat:chad': true}; mapEditor.story.v++")
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
    got = gp.evaluate("""[LOCATIONS[saveData.trip.node].id, uiState.roam && [uiState.roam.x, uiState.roam.z], saveData.story.rival0,
        saveData.flags.chad, gameData.trainers.crude.script.includes('  set s3_draft'), Object.keys(localStorage).filter(k => k.startsWith('networth-save'))]""")
    want = ['copperleaf', spot, 'win', 1, True, []]
    if got != want: errs.append(f'story: Play from here gave {got}, wanted {want}')
    else: print(f'Play from here: Copperleaf at {spot}, after-opening, chad beaten, the draft script, no save', flush=True)
    gp.close()
    pg.evaluate("studioState.D.trainers.crude.script.splice(1, 1); mapEditor.story.flags = {}; mapEditor.playAt = null; mapEditor.story.v++")


def free_camera_steps(pg, errs):
    """The Walk scenes preview's free camera: a drag keeps the ground under the pointer, the wheel zooms, a right-drag
    turns and tilts, Top view looks down, W moves, two fingers pinch and twist, and it hands back to the walker."""
    pg.evaluate("studioState.sel.scene='copperleaf'; void openSection('scenes')")
    time.sleep(4)
    pg.locator('#scPv').scroll_into_view_if_needed()
    pg.locator('#scFreeCam [data-act="fcOn"]').click()
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
    pg.locator('#scFreeCam [data-act="fcTop"]').click()
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
    pg.locator('#scFreeCam [data-act="fcOn"]').first.click()
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
    # the story preview: Juniper only while met_blake0 holds; on at a new game she is hidden, the preset brings her back
    pg.evaluate("studioState.D.maps.copperleaf.people[0].when = 'met_blake0'; render()")
    time.sleep(1)
    pg.locator('#scStoryOn').check()
    time.sleep(0.4)
    a = pg.locator('#scStory').inner_text()
    pg.select_option('#scStoryPreset', 'after-opening')
    time.sleep(0.4)
    b = pg.locator('#scStory').inner_text()
    pg.locator('#scStory [data-act="scStoryFlag"][data-f="met_blake0"]').click()
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
    biome, terraces, a new seed for the plants only) without touching the data or the undo history, and Add as a new
    scene is one undo step (left in, so the proposal at the end carries a generated scene)"""
    n = len(errs)
    pg.evaluate("studioState.sel.scene='tallgrass_meadow';mapGen.on=false;void openSection('scenes')")
    pg.wait_for_selector('[data-act=genOpen]', timeout=20000)
    maps0, undo0 = pg.evaluate("[Object.keys(studioState.D.maps).length, studioState.undo.length]")
    pg.click('[data-act=genOpen]')
    t0 = time.time()
    while time.time() - t0 < 60 and not pg.evaluate("!!mapGen.draft&&walkView.id==='_gen'&&walkView.ready"):
        time.sleep(0.3)
    if not pg.evaluate("!!mapGen.draft&&walkView.id==='_gen'"):
        errs.append('generate: the draft never drew')
        return
    pg.select_option('select[data-gen=biome]', 'canyon')
    pg.evaluate("""(()=>{const r=document.querySelector('input[data-gen="land.terraces"]');r.value='0.7';r.dispatchEvent(new Event('input',{bubbles:true}))})()""")
    time.sleep(0.8)
    if not pg.evaluate("mapGen.draft.biome==='canyon'&&!!mapGen.draft.steps"): errs.append('generate: the biome and terrace dials changed nothing')
    ground = pg.evaluate("JSON.stringify([mapGen.draft.tiles,mapGen.draft.edgeExits])")
    pg.click('[data-act=genReroll][data-st=plants]'); time.sleep(0.6)
    if pg.evaluate("JSON.stringify([mapGen.draft.tiles,mapGen.draft.edgeExits])") != ground: errs.append('generate: a new seed for the plants changed the ground or the road')
    if pg.evaluate("[Object.keys(studioState.D.maps).length, studioState.undo.length]") != [maps0, undo0]: errs.append('generate: the draft reached the data or the undo history')
    if pg.evaluate("mapgenUnreachable(mapGen.draft, studioState.D.scenery).length"): errs.append('generate: the hub of the draft does not reach every exit')
    pg.click('[data-act=genAccept]')
    pg.fill('#genName', 'Check Trail')
    pg.click('#dlg [data-dlg="1"]'); time.sleep(0.5)
    if not pg.evaluate("!!studioState.D.maps.checktrail&&studioState.D.maps.checktrail.gen.params.biome==='canyon'&&studioState.D.maps.checktrail.props.every(p=>p.g===1)"):
        errs.append('generate: Add as a new scene made no scene with its dials')
    elif pg.evaluate("studioState.undo.length") != undo0 + 1: errs.append('generate: adding the scene is not one undo step')
    if len(errs) > n: errs[n:] = [f'generate: {e}' for e in errs[n:]]
    else: print('generate: a canyon route drafted and drawn, dials and a plants reroll, added as a scene in one undo step', flush=True)
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
    found = pg.evaluate("runCheck().filter(c => c.go === 'ui').map(c => [c.msg, c.sel])")
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
    if r['privacy']: errs.append('studio test: the report holds ' + ', '.join(r['privacy']))
    if pg.evaluate("studioProbe.on !== null || studioProbe.running"): errs.append('studio test: the probe was left on')
    edits = sum(1 for s in r['sections'] if s.get('edit'))
    print(f"studio test: {len(r['sections'])} sections, {edits} edits undone, {len(r['findings'])} findings, {r['seconds']} s", flush=True)


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
    ('wardrobe', wardrobe_steps),
    ('ui', ui_steps),
    ('studio_test', studio_test_steps),
]


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
        pg = ctx.new_page()
        pg.on('console', lambda m: errs.append(m.text[:300]) if m.type == 'error' else None)
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
        b.close()
    for e in errs: print('PROBLEM', e)
    print('ok' if not errs else f'{len(errs)} problem(s)')
    sys.exit(1 if errs else 0)


if __name__ == '__main__':
    main()

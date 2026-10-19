#!/usr/bin/env python3
"""The Studio in GitHub mode against a local stand-in for the GitHub API (phase 04c): it signs in, reads the game data
files, opens every section, then makes an edit and proposes it (blobs, a tree, a commit, a branch and a pull request
reach the stand-in). Any error on the page fails it. Nothing leaves the machine; nothing in the repository changes.
Project Story S3: on the way it writes in a trainer's script (an error on its line, line ids, the command reference),
follows the Check's Show me, uses the story preview and plays from here in a second tab (the game gets the draft).
And it flies the Walk scenes preview's free camera with the mouse, the keys and two fingers.
Studio track ST-1: it shows two sections side by side and tries the presets and the handles.

    python3 tools/check-studio-github.py           # the repository as it is (run `npm run data` first)
    python3 tools/check-studio-github.py dist      # the build (`npm run build` first)

Needs Python 3 and Playwright (tools/requirements-check.txt). About a minute."""
import json, re, sys, threading, time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

from playwright.sync_api import sync_playwright

REPO = Path(__file__).resolve().parent.parent
ROOT = REPO / sys.argv[1] if len(sys.argv) > 1 else REPO


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


def main():
    srv = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    tree = [{'type': 'blob', 'path': str(p.relative_to(ROOT)), 'sha': 'x', 'size': p.stat().st_size}
            for p in (ROOT / 'game').rglob('*') if p.is_file()]
    posts = []

    def api(route):
        p = urlparse(route.request.url).path
        if route.request.method != 'GET':
            posts.append(p.rsplit('/', 1)[-1])
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
        pg.wait_for_selector('#pxCv', timeout=20000)
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
        story_steps(pg, errs)
        free_camera_steps(pg, errs)
        split_steps(pg, errs)
        pg.evaluate("const k = Object.keys(studioState.D.moves)[0]; studioState.D.moves[k].name += ' Test'; studioState.dirty = true; void saveAll()")
        t0 = time.time()
        while time.time() - t0 < 60 and 'pulls' not in posts:
            time.sleep(0.5)
            pg.evaluate("document.querySelectorAll('#dlg button, #modal button').forEach(b => /Save anyway|Propose|Send|OK/.test(b.textContent) && b.click())")
        if 'pulls' not in posts: errs.append(f'no pull request proposed (sent: {posts})')
        else: print('proposed: ' + ', '.join(posts), flush=True)
        b.close()
    for e in errs: print('PROBLEM', e)
    print('ok' if not errs else f'{len(errs)} problem(s)')
    sys.exit(1 if errs else 0)


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""The Studio in GitHub mode against a local stand-in for the GitHub API (phase 04c): it signs in, reads the game data
files, opens every section, then makes an edit and proposes it (blobs, a tree, a commit, a branch and a pull request
reach the stand-in). Any error on the page fails it. Nothing leaves the machine; nothing in the repository changes.

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
        pg = b.new_page(viewport={'width': 1400, 'height': 900})
        pg.add_init_script('window.PB_TEST_GLOBALS=true')  # phase 04d: the modules' names on window, for evaluate()
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
        story_steps(pg, errs)
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

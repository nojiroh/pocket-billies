#!/usr/bin/env python3
"""The Studio in GitHub mode against a local stand-in for the GitHub API (phase 04c): it signs in, reads the game data
files, opens every section, then makes an edit and proposes it (blobs, a tree, a commit, a branch and a pull request
reach the stand-in). Any error on the page fails it. Nothing leaves the machine; nothing in the repository changes.

    python3 tools/check-studio-github.py           # the repository as it is (run `npm run data` first)
    python3 tools/check-studio-github.py dist      # the build (`npm run build` first)

Needs Python 3 and Playwright (tools/requirements-check.txt). About a minute."""
import json, sys, threading, time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

from playwright.sync_api import sync_playwright

REPO = Path(__file__).resolve().parent.parent
ROOT = REPO / sys.argv[1] if len(sys.argv) > 1 else REPO


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass


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

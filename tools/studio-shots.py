#!/usr/bin/env python3
"""Studio track ST-1: pictures of the Studio at several window widths, for the layout checks (1024, 1920, 3440 by
default). It serves the repository, opens the Studio in GitHub mode against a stand-in (nothing leaves the machine)
and saves one PNG per view and width. With --compare DIR it also says how many elements moved compared with the same
views in DIR (element boxes, not pixels: the previews move).

    python3 tools/studio-shots.py validation/st1                  # 1024, 1920, 3440
    python3 tools/studio-shots.py out --widths 1000,1100,1200     # around the old breakpoints
    python3 tools/studio-shots.py out --compare before

Needs Python 3 and Playwright (tools/requirements-check.txt)."""
import argparse, json, threading, time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

from playwright.sync_api import sync_playwright

REPO = Path(__file__).resolve().parent.parent
HEIGHT = {1024: 768, 1920: 1080, 2560: 1440, 3440: 1440}
# name: (section, javascript run after it opens, selector to wait for)
VIEWS = {
    'billies': ('billionaires', '', '.split'),
    'moves': ('moves', '', '.split'),
    'world': ('world', '', '.ed-col'),
    'rules': ('rules', '', '.ed-col'),
    'preview': ('preview', '', '#cvWorld'),
    'skeleton': ('billionaires', "void openSkeleton(studioState.D.lines[0].id + '0', 'front')", '.pxed.skel'),
    'pixels': ('billionaires', "void openPixelEditor(studioState.D.lines[0].id + '0', 'front')", '#pxCv'),
    'split': ('billionaires', "ACTIONS.openBeside({ s: 'moves' })", '#main2 .split'),
    'genes': ('genes', "studioState.sel.genes = { sp: 'swift0', slot: 'sig', gene: 'shark_tailfin@zuck2', aug: 'front:hydrant' }; render()", '#genesCanvas'),
    'workbench': ('workbench', """(async () => { const fs = []; for (const n of ['beasts-front.png', 'beasts-back.png']) {
      const r = await fetch('/tools/art-source/part-kit/' + n); fs.push(new File([await r.blob()], n)); } await wbAddFiles(fs); })()""", '#wbCv'),
}


TREE = [{'type': 'blob', 'path': str(p.relative_to(REPO)), 'sha': 'x', 'size': p.stat().st_size}
        for p in (REPO / 'game').rglob('*') if p.is_file()]


# where every element sits (for comparing layouts exactly, as moving previews make pixels differ)
BOXES = """(() => { const o = {}; let i = 0;
  for (const e of document.querySelectorAll('#studio *, .pxed *')) { const r = e.getBoundingClientRect();
    o[i++ + ' ' + e.tagName + '.' + (typeof e.className === 'string' ? e.className : '')] = [r.x, r.y, r.width, r.height].map(Math.round); }
  return o })()"""


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass


def stand_in(route):
    """The same GitHub stand-in as check-studio-github.py: files come from the repository; nothing is written."""
    p = urlparse(route.request.url).path
    if route.request.method != 'GET': return route.fulfill(status=403, json={'message': 'read only'})
    if p == '/user': return route.fulfill(json={'login': 'nojiroh'})
    if p.rstrip('/') == '/repos/nojiroh/pocket-billies': return route.fulfill(json={'permissions': {'push': True, 'admin': True}})
    if '/git/trees/' in p: return route.fulfill(json={'tree': TREE})
    if '/git/commits/' in p: return route.fulfill(json={'sha': 'x', 'tree': {'sha': 'x'}})
    if '/git/ref' in p: return route.fulfill(json={'object': {'sha': 'x'}})
    if '/contents/' in p:
        f = REPO / unquote(p.split('/contents/', 1)[1])
        if f.is_file(): return route.fulfill(body=f.read_bytes())
    return route.fulfill(status=404, json={'message': 'Not Found'})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('--widths', default='1024,1920,3440')
    ap.add_argument('--views', default=','.join(VIEWS))
    ap.add_argument('--setup', default='', help='javascript run once after loading (a preset, a split)')
    ap.add_argument('--compare')
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    srv = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(REPO)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    errs = []
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        for w in [int(x) for x in a.widths.split(',')]:
            ctx = b.new_context(viewport={'width': w, 'height': HEIGHT.get(w, 900)})
            ctx.add_init_script('window.PB_TEST_GLOBALS=true')
            ctx.add_init_script("localStorage.setItem('pb-studio-gh-token','ghp_stand-in')")
            pg = ctx.new_page()
            pg.on('pageerror', lambda e: errs.append(f'{w}: {str(e)[:300]}'))
            pg.route('https://api.github.com/**', stand_in)
            pg.goto(f'http://127.0.0.1:{srv.server_address[1]}/studio/index.html')
            t0 = time.time()
            while time.time() - t0 < 120 and not pg.evaluate("typeof studioState!=='undefined'&&!!studioState.D&&!document.querySelector('.loading')"):
                time.sleep(0.5)
            if a.setup: pg.evaluate(a.setup); time.sleep(0.5)
            for name in a.views.split(','):
                sec, js, sel = VIEWS[name]
                pg.evaluate("document.querySelectorAll('.pxed [data-pe=close], .pxed [data-sk=close]').forEach(b => b.click())")
                pg.evaluate("if (studioState.sec2 && typeof ACTIONS.paneClose === 'function') ACTIONS.paneClose()")
                pg.evaluate(f"void openSection({json.dumps(sec)})")
                if js: pg.evaluate(js)
                try: pg.wait_for_selector(sel, timeout=20000)
                except Exception: errs.append(f'{w} {name}: {sel} never showed')
                time.sleep(1.5)
                f = out / f'{name}-{w}.png'
                pg.screenshot(path=str(f))
                (out / f'{name}-{w}.json').write_text(json.dumps(pg.evaluate(BOXES)))
                print(f'{f.name}', flush=True)
            ctx.close()
        b.close()
    if a.compare:
        for f in sorted(out.glob('*.json')):
            g = Path(a.compare) / f.name
            if not g.exists(): print(f'{f.stem}: nothing to compare'); continue
            x, y = json.loads(f.read_text()), json.loads(g.read_text())
            moved = [k for k in x if k in y and x[k] != y[k]]
            print(f'{f.stem}: {len(moved)} of {len(x)} elements moved, {len(set(x) ^ set(y))} only on one side' + (f' (first {moved[0]}: {y[moved[0]]} -> {x[moved[0]]})' if moved else ''))
    for e in errs: print('PROBLEM', e)
    raise SystemExit(1 if errs else 0)


if __name__ == '__main__':
    main()

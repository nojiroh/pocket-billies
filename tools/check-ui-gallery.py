#!/usr/bin/env python3
"""UI-2: picture tests for the UI kit. Opens studio/gallery.html (every component in its states, from the game's own
styles and js/ui-kit.js) and takes a picture of each section at 320 and 390 px, light and dark, then compares each with
the committed baseline in validation/ui-gallery/; the shaped parts once more with the stepped preset (SY-3: the
Bureau's stamps in every preset, light and dark).

    python3 tools/check-ui-gallery.py            # take the pictures and compare (fails when one differs)
    python3 tools/check-ui-gallery.py --update   # make this run's pictures the baseline (a look change, on purpose)
    python3 tools/check-ui-gallery.py --only=buttons,cards   # only these sections (their data-shot names)

Needs Python Playwright and Pillow (tools/requirements-check.txt) and game/data/gamedata.js (built here first).
This run's pictures go to validation/ui-gallery-out/, with a side-by-side picture of each one that differs."""
import json, subprocess, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from browser_check import serve  # noqa: E402  (TC-4: the browser checks' shared helpers)

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / 'validation' / 'ui-gallery'
OUT = ROOT / 'validation' / 'ui-gallery-out'
ARGS = sys.argv[1:]
UPDATE = '--update' in ARGS
ONLY = next((a.split('=', 1)[1].split(',') for a in ARGS if a.startswith('--only=')), None)
WIDTHS = (320, 390)
THEMES = ('light', 'dark')
# UI-2: the shaped parts again with uiTheme.json's stepped preset (pixel-step cuts), at 390 px, light
STEPPED = ('buttons', 'panels', 'cards', 'tabs', 'messages')
# the other looks (uiTheme.json presets) at 390 px: (theme, preset, sections). SY-3: the Bureau's stamps in every look
# the gallery has, light and dark (red ink on paper must read in each)
LOOKS = (('light', 'stepped', STEPPED + ('stamps',)), ('dark', 'stepped', ('stamps',)),
         ('light', 'alpha05', ('stamps',)), ('dark', 'alpha05', ('stamps',)))
# a picture differs when more than this share of its pixels moved by more than TOL in any channel (fonts antialias a
# little differently from run to run; a reshaped part moves far more)
SHARE, TOL = 0.0005, 24


def differs(a, b):
    """the share of pixels that moved, and a side-by-side picture"""
    from PIL import Image, ImageChops
    if a.size != b.size:
        return 1.0
    d = ImageChops.difference(a.convert('RGB'), b.convert('RGB')).convert('L').point(lambda v: 255 if v > TOL else 0)
    return sum(d.histogram()[255:]) / (a.size[0] * a.size[1])


def main():
    try:
        from playwright.sync_api import sync_playwright
        from PIL import Image
    except ImportError:
        print('Install the check tools first:  pip install -r tools/requirements-check.txt')
        sys.exit(1)
    subprocess.run(['node', 'tools/build-data.mjs'], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    OUT.mkdir(parents=True, exist_ok=True)
    BASE.mkdir(parents=True, exist_ok=True)
    srv, base = serve(ROOT)
    shots, problems, errors = [], [], []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for theme, w, look, only in [(t, w, '', None) for t in THEMES for w in WIDTHS] + [(t, 390, k, o) for t, k, o in LOOKS]:
            if True:
                page = b.new_page(viewport={'width': w, 'height': 900}, device_scale_factor=1, reduced_motion='reduce')
                page.on('pageerror', lambda e: errors.append(str(e)))
                page.goto(f'{base}/studio/gallery.html?shots=1', wait_until='load')
                page.evaluate(
                    """([theme, w]) => { document.documentElement.dataset.theme = theme;
                       document.querySelector('.g-wrap').style.setProperty('--g-w', w + 'px');
                       document.documentElement.classList.add('g-shots'); }""",
                    [theme, w],
                )
                if look:
                    page.click(f'[data-g="look"][data-v="{look}"]')
                page.evaluate('document.fonts.ready')
                # UI-8c: the run map's markers paint their pixel icons once those have loaded
                page.evaluate("Promise.all([...document.querySelectorAll('pb-node')].map(n => n.updateComplete.then(() => n.painted)))")
                page.wait_for_timeout(400)
                names = page.eval_on_selector_all('[data-shot]', 'els => els.map(e => e.dataset.shot)')
                for name in names:
                    if (ONLY and name not in ONLY) or (only and name not in only):
                        continue
                    key = f'{name}-{w}-{theme}' + (f'-{look}' if look else '')
                    el = page.locator(f'[data-shot="{name}"]')
                    el.scroll_into_view_if_needed()
                    page.wait_for_timeout(60)
                    path = OUT / f'{key}.png'
                    el.screenshot(path=str(path), animations='disabled')
                    shots.append(key)
                    ref = BASE / f'{key}.png'
                    if UPDATE:
                        ref.write_bytes(path.read_bytes())
                    elif not ref.exists():
                        problems.append(f'{key}: no baseline (run with --update)')
                    else:
                        a, r = Image.open(path), Image.open(ref)
                        share = differs(a, r)
                        if share > SHARE:
                            problems.append(f'{key}: {share:.1%} of the picture differs from the baseline')
                            side = Image.new('RGB', (a.size[0] + r.size[0] + 8, max(a.size[1], r.size[1])), 'white')
                            side.paste(r, (0, 0))
                            side.paste(a, (r.size[0] + 8, 0))
                            side.save(OUT / f'{key}-compare.png')
                page.close()
        b.close()
    srv.shutdown()
    if UPDATE:
        for old in BASE.glob('*.png'):
            if old.stem not in shots and not ONLY:
                old.unlink()
    problems += [f'page error: {e}' for e in errors]
    (OUT / 'results.json').write_text(json.dumps({'shots': len(shots), 'problems': problems}, indent=1))
    print(f'{len(shots)} pictures' + (' saved as the baseline' if UPDATE else ''))
    for p in problems:
        print('  ' + p)
    sys.exit(1 if problems else 0)


if __name__ == '__main__':
    main()

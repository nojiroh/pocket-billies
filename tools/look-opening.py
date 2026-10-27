#!/usr/bin/env python3
"""Pictures of New game's opening (cutscenes track, part B), for picture notes (nothing is judged here): the fall (a
picture every half second: the crust, the dive onto Copperleaf, the impact and the held landing), the opening's first
shots after it (the walk view taking over on the same spot), and the starter pick with each of the three starters.
Phone sized, the game's own graphics. Real time, so the fall's pictures depend on the machine's speed.

    python3 tools/look-opening.py                 # in validation/look-opening/
    python3 tools/look-opening.py --out=DIR

Uses the browser checks' page set-up (tools/browser_check.py)."""
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import browser_check as CF  # noqa: E402
ARGS = sys.argv[1:]
OUT = Path(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--out=')), ROOT / 'validation' / 'look-opening'))
SKIP = "cutscene.say&&cutscene.say.tap();cutscene.skip||skipCutscene()"


def main():
    from playwright.sync_api import sync_playwright
    OUT.mkdir(parents=True, exist_ok=True)
    srv, base = CF.serve(CF.GAME)
    errs = []
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=CF.LAUNCH)
        ctx, pg = CF.open_game(b, None, errs, low=False)
        ctx.set_default_timeout(240000)
        pg.set_viewport_size({'width': 390, 'height': 640})
        pg.goto(base + '/index.html')
        CF.drawing(pg)
        pg.click('[data-a=intro]')
        t0, i = time.time(), 0
        # the fall and the opening's first lines, till Chosen first speaks
        while time.time() - t0 < 40 and not pg.evaluate('!!(cutscene.say&&cutscene.say.on)'):
            pg.screenshot(path=str(OUT / f'fall-{i:02d}-{time.time() - t0:04.1f}s.png'))
            i += 1
            pg.wait_for_timeout(450)
        print('fall', i, 'pictures', flush=True)
        if not CF.until(pg, 'dressingRoom.on', 90, SKIP): raise Exception('never reached the dressing room')
        pg.click('[data-a=dr-preset][data-i="2"]')
        pg.fill('#drName', 'Checker')
        pg.click('[data-a=dr-save]')
        if not CF.until(pg, 'cutscene.choosing', 90, SKIP): raise Exception('never reached the starter pick')
        for k in range(3):
            pg.wait_for_timeout(1500)
            pg.screenshot(path=str(OUT / f'pick-{k}.png'))
            print('pick', k, flush=True)
            pg.evaluate("document.querySelector('[data-a=cs-next]').click();0")
        ctx.close(); b.close()
    srv.shutdown()
    print('errors:', [e for e in errs if 'gamedata.js' not in e][:6])


if __name__ == '__main__':
    main()

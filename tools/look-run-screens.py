#!/usr/bin/env python3
"""Pictures of a run's loading screens (cutscenes track, part C), for picture notes (nothing is judged here): the
take-off's screen (the carriage, the region's card, the tips) a moment after it comes up and a few seconds later, and
the way home's "Heading home" screen the moment Ride home is pressed (in place of HB-8's plain white veil), then the
ride home under way. The ranch fixture, phone sized, the game's own graphics.

    python3 tools/look-run-screens.py                  # in validation/look-run-screens/
    python3 tools/look-run-screens.py --out=DIR

Uses the browser checks' page set-up (tools/browser_check.py)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import browser_check as CF  # noqa: E402
ARGS = sys.argv[1:]
OUT = Path(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--out=')), ROOT / 'validation' / 'look-run-screens'))


def main():
    from playwright.sync_api import sync_playwright
    OUT.mkdir(parents=True, exist_ok=True)
    srv, base = CF.serve(CF.GAME)
    errs = []
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=CF.LAUNCH)
        ctx, pg = CF.open_game(b, None, errs, low=False)
        ctx.set_default_timeout(240000)
        pg.set_viewport_size({'width': 390, 'height': 720})
        pg.goto(base + '/index.html?fixture=ranch')
        if not CF.until(pg, "typeof saveData!=='undefined'&&!document.getElementById('loader')&&walkView.ready", 90):
            raise Exception('the fixture never booted')
        pg.evaluate("uiState.inside=null;uiState.modal=null;uiState.mq=[];renderOverlay();0")
        lead = pg.evaluate("saveData.team[0].uid")
        pg.evaluate(f"runTakeOff(undefined,undefined,undefined,{{home:['{lead}'],pack:{{items:{{}},pyramids:{{}}}}}});0")
        CF.until(pg, "!!trainRide.W||!trainRide.on", 20)
        pg.evaluate("trainRideSkip();0")
        if not CF.until(pg, "!!document.getElementById('runload')", 20): raise Exception('no loading screen')
        for ms, name in ((900, 'out-1s'), (3200, 'out-4s')):
            pg.wait_for_timeout(ms)
            pg.screenshot(path=str(OUT / f'{name}.png'))
            print(name, flush=True)
        if not CF.until(pg, "saveData.run.at.phase==='walk'&&runLoad.ready", 90): raise Exception('never landed')
        pg.evaluate("uiState.modal=null;uiState.mq=[];runOver(true);0")
        if not CF.until(pg, "!!uiState.modal&&uiState.modal.cls==='run-payout'", 30): raise Exception('no payout')
        pg.wait_for_timeout(600)
        # the hub's view comes back at once here (a slow phone takes seconds): held back for the pictures
        pg.evaluate("window._trw=trainRideWorld;trainRideWorld=()=>null;0")
        pg.evaluate("document.querySelector('#ov [data-a=mb]').click();0")
        for ms, name in ((80, 'home-0s'), (1400, 'home-1s')):
            pg.wait_for_timeout(ms)
            pg.screenshot(path=str(OUT / f'{name}.png'))
            print(name, flush=True)
        pg.evaluate("trainRideWorld=window._trw;0")
        CF.until(pg, "!!trainRide.W||!trainRide.on", 45)
        pg.wait_for_timeout(1500)
        pg.screenshot(path=str(OUT / 'home-ride.png'))
        print('home-ride', 'white veil' if pg.evaluate("!!document.getElementById('trainveil')") else 'no veil', flush=True)
        ctx.close(); b.close()
    srv.shutdown()
    print('errors:', [e for e in errs if 'gamedata.js' not in e][:6])


if __name__ == '__main__':
    main()

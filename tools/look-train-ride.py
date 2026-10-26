#!/usr/bin/env python3
"""Pictures of the sky train's ride (HB-8), for picture notes (nothing is judged here): the departure from Skyline
Station (it glides in, you board, it climbs the sky rail, the tear opens, it flies in), the carriage's loading screen,
and the ride home after a win (gold) and after a loss (battered). Copperleaf with the game's own graphics, phone sized;
each frame is a fixed moment of the ride (train-ride.js trainRide.hold), so the pictures don't depend on the machine's
speed.

    python3 tools/look-train-ride.py                    # every part, in validation/look-train-ride/
    python3 tools/look-train-ride.py depart carriage    # some parts: depart, carriage, won, lost
    python3 tools/look-train-ride.py --train=train_highland --out=DIR

Uses the browser checks' page set-up (tools/browser_check.py: the clock, no accounts, the test globals), without the
low graphics."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import browser_check as CF  # noqa: E402
ARGS = sys.argv[1:]
OUT = Path(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--out=')), ROOT / 'validation' / 'look-train-ride'))
TRAIN = next((a.split('=', 1)[1] for a in ARGS if a.startswith('--train=')), 'train_greenbelt')
PARTS = [a for a in ARGS if not a.startswith('--')] or ['depart', 'carriage', 'won', 'lost']
# the moments (ms into the ride, train-ride.js DEPART and HOME) and what each shows
DEPART = [(400, 'glide'), (1800, 'glide-low'), (3200, 'board'), (5800, 'climb'), (7600, 'climb-high'), (8300, 'portal'),
          (8800, 'into-the-tear')]
HOME = [(500, 'tear-opens'), (1300, 'out-of-the-tear'), (3200, 'down-the-rail'), (5200, 'down-low'), (6200, 'step-off')]


def settle(pg, frames=6):
    f0 = pg.evaluate('walkRenderer.frames')
    if not CF.until(pg, f'walkRenderer.frames>={f0 + frames}', 240): raise Exception('stopped drawing')


def frames(pg, start, moments, tag):
    pg.evaluate(f"trainRide.hold={moments[0][0]};{start};0")
    if not pg.evaluate('!!trainRide.W'):
        CF.until(pg, '!!trainRide.W', 20)
    for ms, name in moments:
        pg.evaluate(f'trainRide.hold={ms};0')
        settle(pg)
        pg.screenshot(path=str(OUT / f'{tag}-{ms:05d}-{name}.png'))
        print(tag, ms, name, flush=True)
    pg.evaluate('trainRide.hold=null;trainRideSkip();0')
    CF.until(pg, '!trainRide.on', 20)
    pg.evaluate('trainVeil(false,0);0')


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
        pg.goto(base + '/index.html?fixture=town')
        CF.drawing(pg)
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();environment.force={time:12.5,weather:'clear'};0")
        settle(pg, 30)
        if 'depart' in PARTS:
            frames(pg, f"trainRideDepart('{TRAIN}',()=>{{}})", DEPART, 'depart')
        if 'carriage' in PARTS:
            pg.evaluate(f"""(()=>{{const el=document.createElement('pb-loading');el.id='looktrain';el.heading='Backlog Downs';
              el.sub='Through the portal · '+trainName('{TRAIN}');el.tip=(loreLoadingLines()[0]||'');el.value=0.35;
              el.stages=[{{id:'places',label:'The run’s places',state:'working'}},{{id:'map',label:'The landing',state:'waiting'}},
              {{id:'models',label:'Buildings and things',state:'waiting'}},{{id:'bowl',label:'The world map',state:'waiting'}},
              {{id:'walk',label:'Setting down',state:'waiting'}}];const v=trainCarriage('{TRAIN}',false);v.setAttribute('slot','view');
              el.appendChild(v);document.body.appendChild(el);return 0}})()""")
            pg.wait_for_timeout(900)
            pg.screenshot(path=str(OUT / 'carriage.png'))
            print('carriage', flush=True)
            pg.evaluate("document.getElementById('looktrain').remove();0")
        for part, won in (('won', 'true'), ('lost', 'false')):
            if part in PARTS:
                frames(pg, f"trainRideHome('{TRAIN}',{won},()=>{{}})", HOME, part)
        ctx.close(); b.close()
    srv.shutdown()
    print('errors:', [e for e in errs if 'gamedata.js' not in e][:6])


if __name__ == '__main__':
    main()

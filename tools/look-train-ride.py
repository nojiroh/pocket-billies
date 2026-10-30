#!/usr/bin/env python3
"""Pictures of the sky train's ride (HB-8), for picture notes (nothing is judged here): the departure from Skyline
Station (it glides in, you board, it rises on its engines, turns to the portal and shoots in), the carriage's loading screen,
and the ride home after a win (gold) and after a loss (battered). Copperleaf with the game's own graphics, phone sized;
each frame is a fixed moment of the ride (train-ride.js trainRide.hold), so the pictures don't depend on the machine's
speed.

    python3 tools/look-train-ride.py                    # every part, in validation/look-train-ride/
    python3 tools/look-train-ride.py depart carriage    # some parts: depart, carriage, won, lost
    python3 tools/look-train-ride.py --train=train_highland --out=DIR
    python3 tools/look-train-ride.py depart --hours=12.5,19.6,22.5 --only=lift,dash   # AS-1: at these hours, these moments
    python3 tools/look-train-ride.py --windows [--step=600]   # AS-1: the windows test (exit 1 when a window changes during a ride)

AS-1's windows test steps through both rides (every 200 ms or --step, held moments, at night with the window light on) and reads
back what each moment's windows were (walk/lighting.js modelWindowLight keeps [lit bits, colour seed] on the ride's
placement): every moment of a ride must have the same. It also counts the colour seeds the old rule (by where the train
was) would have given, for the notes. Results in OUT/windows.json.

Uses the browser checks' page set-up (tools/browser_check.py: the clock, no accounts, the test globals), without the
low graphics."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import browser_check as CF  # noqa: E402
ARGS = sys.argv[1:]
OUT = Path(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--out=')), ROOT / 'validation' / 'look-train-ride'))
TRAIN = next((a.split('=', 1)[1] for a in ARGS if a.startswith('--train=')), 'train_greenbelt')
PARTS = [a for a in ARGS if not a.startswith('--')] or ['depart', 'carriage', 'won', 'lost']
HOURS = [float(h) for h in next((a.split('=', 1)[1] for a in ARGS if a.startswith('--hours=')), '12.5').split(',')]
ONLY = next((a.split('=', 1)[1].split(',') for a in ARGS if a.startswith('--only=')), None)
WINDOWS = '--windows' in ARGS
STEP = int(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--step=')), '200'))
# the moments (ms into the ride, train-ride.js DEPART and HOME) and what each shows
DEPART = [(400, 'glide'), (1800, 'glide-low'), (3000, 'board-street'), (4000, 'board-steps'), (5000, 'board-platform'),
          (6600, 'lift'), (7600, 'lift-high'), (8500, 'turn'), (9600, 'dash'), (10200, 'into-the-portal')]
HOME = [(500, 'portal-opens'), (1300, 'out-of-the-portal'), (2300, 'across'), (3100, 'turn'), (4000, 'down'),
        (5800, 'step-off'), (7000, 'step-off-steps')]


def settle(pg, frames=6):
    f0 = pg.evaluate('walkRenderer.frames')
    if not CF.until(pg, f'walkRenderer.frames>={f0 + frames}', 240): raise Exception('stopped drawing')


# AS-1: the train's model made now (software drawing makes one new model a frame, so a held moment could show the
# train as its picture), its looks too (v 1 gold, v 2 battered: their colour swaps), as prop-models.js tagPropModel does
WARM = """((k)=>{const M=walkData().sc.props[k];if(!M||typeof M.model!=='string')return 0;const r=loadPropModelRecipe(M.model);if(!r)return 0;
  propModelMesh(M.model,r);for(const V of M.variants||[]){if(!V.swap)continue;const p=M.model+'#'+JSON.stringify(V.swap);propModelMesh(p,swappedRecipe(p,r,V.swap))}return 1})"""


def frames(pg, start, moments, tag):
    moments = [m for m in moments if not ONLY or m[1] in ONLY]
    if not moments: return
    CF.until(pg, f"{WARM}('{TRAIN}')", 60)
    pg.evaluate(f"trainRide.hold={moments[0][0]};{start};0")
    if not pg.evaluate('!!trainRide.W'):
        CF.until(pg, '!!trainRide.W', 20)
    settle(pg, 12)
    for ms, name in moments:
        pg.evaluate(f'trainRide.hold={ms};0')
        settle(pg)
        pg.screenshot(path=str(OUT / f'{tag}-{ms:05d}-{name}.png'))
        print(tag, ms, name, flush=True)
    pg.evaluate('trainRide.hold=null;trainRideSkip();0')
    CF.until(pg, '!trainRide.on', 20)
    pg.evaluate('trainVeil(false,0);0')


def hour(pg, h):
    # the way home after a win opens what waited for it (an evolution: pending-windows.js): closed for the next pictures
    pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();0")
    pg.evaluate(f"(()=>{{environment.force={{time:{h},weather:'clear'}};walkRenderer.adaptT=0;return 0}})()")
    settle(pg, 12)


def windows_test(pg):
    """AS-1: each ride's moments, every 200 ms: the windows' [lit bits, seed] must stay the same through a ride"""
    out, bad = {}, 0
    dep, home = pg.evaluate('[Object.values(TRAIN_DEPART),Object.values(TRAIN_HOME)].map(v=>v.reduce((a,b)=>a+b,0))')
    for tag, start, total in (('depart', f"trainRideDepart('{TRAIN}',()=>{{}})", dep),
                              ('won', f"trainRideHome('{TRAIN}',true,()=>{{}})", home)):
        CF.until(pg, f"{WARM}('{TRAIN}')", 60)
        pg.evaluate(f"trainRide.hold=0;{start};0")
        CF.until(pg, '!!trainRide.W', 20)
        seen, old = [], set()
        for ms in range(0, total, STEP):
            pg.evaluate(f'trainRide.hold={ms};0')
            settle(pg, 2)
            w = pg.evaluate("(()=>{const p=trainRide.W&&trainRide.W.train;if(!p)return null;"
                            "return {win:p._win||null,old:Math.round(((Math.abs(Math.sin(p.x*12.9898+p.z*78.233))*43.7585)%1)*1000)}})()")
            if not w: continue
            seen.append([ms, w['win']])
            old.add(w['old'])
            if len(seen) % 10 == 1: print(tag, ms, w['win'], flush=True)
        wins = {json.dumps(v) for _, v in seen if v}
        drawn = sum(1 for _, v in seen if v)
        ok = len(wins) == 1 and drawn > len(seen) // 2
        bad += 0 if ok else 1
        out[tag] = {'moments': len(seen), 'drawn': drawn, 'states': sorted(wins), 'oldSeeds': len(old), 'ok': ok}
        print(tag, 'windows', 'steady' if ok else 'CHANGED', f'({drawn} of {len(seen)} moments drawn; the old rule: {len(old)} seeds)', flush=True)
        pg.evaluate('trainRide.hold=null;trainRideSkip();0')
        CF.until(pg, '!trainRide.on', 20)
        pg.evaluate('trainVeil(false,0);0')
    (OUT / 'windows.json').write_text(json.dumps(out, indent=1))
    return bad


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
        if WINDOWS:
            hour(pg, 22.5)
            bad = windows_test(pg)
            ctx.close(); b.close(); srv.shutdown()
            print('errors:', [e for e in errs if 'gamedata.js' not in e][:6])
            sys.exit(1 if bad else 0)
        for h in HOURS:
            run_hour(pg, h, len(HOURS) > 1)
        ctx.close(); b.close()
    srv.shutdown()
    print('errors:', [e for e in errs if 'gamedata.js' not in e][:6])


def run_hour(pg, h, tagged):
    hour(pg, h)
    sfx = f'h{h:g}-' if tagged else ''
    if 'depart' in PARTS:
        frames(pg, f"trainRideDepart('{TRAIN}',()=>{{}})", DEPART, sfx + 'depart')
    if 'carriage' in PARTS:
        pg.evaluate(f"""(()=>{{const el=document.createElement('pb-loading');el.id='looktrain';el.heading='Backlog Downs';
          el.sub='Through the portal · '+trainName('{TRAIN}');el.tip=(loreLoadingLines()[0]||'');el.value=0.35;
          el.stages=[{{id:'places',label:'The run’s places',state:'working'}},{{id:'map',label:'The landing',state:'waiting'}},
          {{id:'models',label:'Buildings and things',state:'waiting'}},{{id:'bowl',label:'The world map',state:'waiting'}},
          {{id:'walk',label:'Setting down',state:'waiting'}}];const v=trainCarriage('{TRAIN}',false);v.setAttribute('slot','view');
          el.appendChild(v);document.body.appendChild(el);return 0}})()""")
        pg.wait_for_timeout(900)
        pg.screenshot(path=str(OUT / f'{sfx}carriage.png'))
        print('carriage', flush=True)
        pg.evaluate("document.getElementById('looktrain').remove();0")
    for part, won in (('won', 'true'), ('lost', 'false')):
        if part in PARTS:
            frames(pg, f"trainRideHome('{TRAIN}',{won},()=>{{}})", HOME, sfx + part)


if __name__ == '__main__':
    main()

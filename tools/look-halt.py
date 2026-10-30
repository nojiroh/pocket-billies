#!/usr/bin/env python3
"""Assets track AS-2: pictures of the sky train halt (tools/build-halt.py), for the HANDOFF entry (nothing is judged
here). Opens a map with the game's own graphics, phone sized, and takes pictures round the landing's prop with act
'fly' (the halt; before AS-2 the airship's mast): from the front, nearer, both sides and behind.

    python3 tools/look-halt.py                 # the showcase map test_halt, in validation/look-halt/
    python3 tools/look-halt.py --run           # a run's landing (the fixture run, seed RL7FIXTURE)
    python3 tools/look-halt.py --time=21       # at another hour (the lamp, the kiosk's window)
    python3 tools/look-halt.py --arrive        # a run started from Skyline Station (its ride skipped): the train
                                               # setting down at the landing's halt and you stepping off, held at
                                               # fixed moments (halt-arrival.js haltArrival.hold)
    python3 tools/look-halt.py --out=DIR

Uses the browser checks' page set-up (tools/browser_check.py: the clock, no accounts, the test globals), without the
low graphics."""
import math, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import browser_check as CF  # noqa: E402
ARGS = sys.argv[1:]
RUN = '--run' in ARGS
ARRIVE = '--arrive' in ARGS
MOMENTS = [0, 500, 1000, 1500, 1900, 2600, 3300, 4000]  # ms into the arrival: down 0-1700, off 1700-4100
OUT = Path(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--out=')), ROOT / 'validation' / 'look-halt'))
HOUR = float(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--time=')), 12.5))
HIDE_HUD = """(()=>{const cv=walkView.cv;for(const el of document.body.querySelectorAll('*'))
 if(el!==cv&&!el.contains(cv))el.style.setProperty('visibility','hidden','important');
 for(let e=cv;e;e=e.parentElement)e.style.setProperty('visibility','visible','important');return 0})()"""


def settle(pg, frames=8):
    f0 = pg.evaluate('walkRenderer.frames')
    if not CF.until(pg, f'walkRenderer.frames>={f0 + frames}', 240): raise Exception('stopped drawing')


def views(pg):
    """cameras round the prop with act 'fly': its middle a few metres behind its base point (the footprint's)"""
    s = pg.evaluate("(()=>{const p=walkView.sc.props.find(q=>q.act==='fly');if(!p)return null;const M=walkData().sc.props[p.k]||{};return {x:p.x,z:p.z,rot:p.rot||0,k:p.k,d:(M.box||[2,2])[1]}})()")
    if not s: raise Exception('no prop with act fly here')
    print('the landing prop:', s['k'], flush=True)
    r = s['rot'] * math.pi / 180
    fx, fz = math.sin(r), -math.cos(r)  # its front
    cx, cz = s['x'] - fx * s['d'] / 2, s['z'] - fz * s['d'] / 2
    out = []
    for name, a, dist, up, fov in (('front', 0, 17, 8, 58), ('near', 18, 9, 3.2, 60), ('right', 80, 17, 7, 58),
                                   ('back', 180, 17, 8, 58), ('left', 280, 17, 7, 58)):
        b = r + a * math.pi / 180
        out.append((name, [cx + math.sin(b) * dist, up, cz - math.cos(b) * dist], [cx, 1.8, cz], fov))
    return out


def arrive(pg):
    """a run started as the station's sheet starts one, the departure skipped, then the arrival held at MOMENTS"""
    CF.until(pg, "walkView.ready&&!!walkView.sc.props.find(p=>p.act==='station')", 90)
    pg.evaluate("(p=>walkPick({k:'act',p,act:'station'}))(walkView.sc.props.find(p=>p.act==='station'));0")
    CF.until(pg, "!!document.querySelector('#ov [data-a=runstart]')", 20)
    pg.click('#ov [data-a=runstart]')
    CF.until(pg, "uiState.modal&&uiState.modal.title==='Start a run'", 10)
    pg.click('#ov [data-a=mb][data-i="0"]')
    if not CF.until(pg, "!!saveData.run&&(trainRide.on||!!document.getElementById('runload'))", 90): raise Exception('no take-off')
    CF.until(pg, "!!trainRide.W||!trainRide.on", 20)
    pg.evaluate("trainRideSkip();0")
    if not CF.until(pg, "!!haltArrival.W", 240): raise Exception(f"the arrival never filmed: {pg.evaluate('JSON.stringify({on:haltArrival.on,key:haltArrival.key})')}")
    pg.evaluate("haltArrival.hold=0;0")
    CF.until(pg, "runLoad.ready&&!document.getElementById('runload')", 120)
    pg.evaluate(f"environment.force={{time:{HOUR},weather:'clear'}};0")
    settle(pg, 20)
    pg.evaluate(HIDE_HUD)
    for t in MOMENTS:
        pg.evaluate(f"haltArrival.hold={t};0")
        settle(pg, 10)
        tag = f'arrive-{t:04d}' + ('' if HOUR == 12.5 else f'-{HOUR:g}h')
        pg.screenshot(path=str(OUT / f'{tag}.png'))
        print(tag, flush=True)
    pg.evaluate("haltArrival.hold=null;haltArriveSkip();0")
    CF.until(pg, "!haltArrival.on&&!walkView.director", 20)
    settle(pg, 10)
    pg.screenshot(path=str(OUT / 'arrive-after.png'))
    print('arrive-after', flush=True)


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
        pg.goto(base + ('/index.html?fixture=town' if ARRIVE else '/index.html?fixture=run' if RUN else '/index.html?test=1&scene=test_halt'))
        CF.drawing(pg)
        if ARRIVE:
            pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();saveData.team.forEach(m=>{m.hp=maxHp(m);m.status=null});(()=>{const p=saveData.preferences=saveData.preferences||{};p.expert=true;p.eng={lens:{blur:0,bokeh:0}};return 0})()")
            arrive(pg)
            ctx.close(); b.close(); srv.shutdown(); print('errors:', errs[:6])
            return
        pg.evaluate(f"uiState.modal=null;uiState.mq=[];renderOverlay();environment.force={{time:{HOUR},weather:'clear'}};0")
        pg.evaluate("(()=>{const p=saveData.preferences=saveData.preferences||{};p.expert=true;p.eng={lens:{blur:0,bokeh:0}};return 0})()")
        settle(pg, 30)
        pg.evaluate(HIDE_HUD)
        for name, eye, tgt, fov in views(pg):
            pg.evaluate(f"(()=>{{const g=groundHeightAt({eye[0]},{eye[2]}),h=groundHeightAt({tgt[0]},{tgt[2]});walkView.opt.look=()=>({{eye:[{eye[0]},g+{eye[1]},{eye[2]}],tgt:[{tgt[0]},h+{tgt[1]},{tgt[2]}],fov:{fov}}});return 0}})()")
            settle(pg, 12)
            tag = ('run-' if RUN else '') + name + ('' if HOUR == 12.5 else f'-{HOUR:g}h')
            pg.screenshot(path=str(OUT / f'{tag}.png'))
            print(tag, flush=True)
        pg.evaluate('delete walkView.opt.look')
        ctx.close(); b.close()
    srv.shutdown()
    print('errors:', errs[:6])


if __name__ == '__main__':
    main()

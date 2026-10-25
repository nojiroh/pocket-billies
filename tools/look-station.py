#!/usr/bin/env python3
"""Pictures of Skyline Station, the sky rail, the portal and the trains (HB-7), for picture notes (nothing is judged
here). Opens a map with the game's own graphics, phone sized, and takes a picture from each fixed camera below. The
showcase map test_station_trains by default (tools/build-station-trains.py); --hub looks at the station in Copperleaf.

    python3 tools/look-station.py                 # test_station_trains, in validation/look-station/
    python3 tools/look-station.py --hub           # the station in Copperleaf (by its act), from four sides
    python3 tools/look-station.py --time=21       # at another hour (lamps, lit windows, the portal's glow)
    python3 tools/look-station.py --out=DIR

Uses the browser checks' page set-up (tools/browser_check.py: the clock, no accounts, the test globals), without the
low graphics."""
import json, math, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import browser_check as CF  # noqa: E402
ARGS = sys.argv[1:]
HUB = '--hub' in ARGS
OUT = Path(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--out=')), ROOT / 'validation' / 'look-station'))
HOUR = float(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--time=')), 12.5))

# the showcase's cameras: (name, eye [x, up, z], target [x, up, z], fov); the map's props in build-station-trains.py
VIEWS = [
    ('station', [14, 7, 4], [14, 2.5, 19], 58),
    ('station-side', [-2, 6, 14], [12, 2, 20], 58),
    ('platform', [8, 3.2, 30], [14, 1.5, 21], 62),
    ('trains', [27, 6, -6], [27, 1.5, 6], 70),
    ('lakeland', [15, 5, -9], [8, 1.8, 6], 60),
    ('wildwood', [29, 5, -9], [22, 1.8, 6], 60),
    ('highland', [43, 5, -9], [36, 1.8, 6], 60),
    ('harvest', [57, 5, -9], [50, 1.8, 6], 60),
    ('climb', [44, 12, -14], [52, 7, 22], 64),
    ('portal', [72, 18, 6], [91, 16, 22], 60),
    ('portal-end', [76, 17, 22], [92, 17, 22], 60),
]
HIDE_HUD = """(()=>{const cv=walkView.cv;for(const el of document.body.querySelectorAll('*'))
 if(el!==cv&&!el.contains(cv))el.style.setProperty('visibility','hidden','important');
 for(let e=cv;e;e=e.parentElement)e.style.setProperty('visibility','visible','important');return 0})()"""


def settle(pg, frames=8):
    f0 = pg.evaluate('walkRenderer.frames')
    if not CF.until(pg, f'walkRenderer.frames>={f0 + frames}', 240): raise Exception('stopped drawing')


def hub_views(pg):
    """four cameras round Copperleaf's station (the prop with act 'station'), 18 m out and 9 m up"""
    s = pg.evaluate("(()=>{const p=walkView.sc.props.find(q=>q.act==='station');return p&&{x:p.x,z:p.z,rot:p.rot||0}})()")
    if not s: raise Exception('Copperleaf has no station')
    r = s['rot'] * math.pi / 180
    fx, fz = math.sin(r), -math.cos(r)  # its front
    cx, cz = s['x'] - fx * 3.3, s['z'] - fz * 3.3  # its middle (the footprint lies behind the base point)
    out = []
    for name, a in (('front', 0), ('right', 90), ('back', 180), ('left', 270)):
        b = r + a * math.pi / 180
        ex, ez = cx + math.sin(b) * 18, cz - math.cos(b) * 18
        out.append((name, [ex, 9, ez], [cx, 2, cz], 58))
    return out


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
        if HUB:
            pg.goto(base + '/index.html?fixture=town')
        else:
            pg.goto(base + '/index.html?test=1&scene=test_station_trains')
        CF.drawing(pg)
        pg.evaluate(f"uiState.modal=null;uiState.mq=[];renderOverlay();environment.force={{time:{HOUR},weather:'clear'}};0")
        pg.evaluate("(()=>{const p=saveData.preferences=saveData.preferences||{};p.expert=true;p.eng={lens:{blur:0,bokeh:0}};return 0})()")
        settle(pg, 30)
        pg.evaluate(HIDE_HUD)
        views = hub_views(pg) if HUB else VIEWS
        for name, eye, tgt, fov in views:
            pg.evaluate(f"(()=>{{const g=groundHeightAt({eye[0]},{eye[2]}),h=groundHeightAt({tgt[0]},{tgt[2]});walkView.opt.look=()=>({{eye:[{eye[0]},g+{eye[1]},{eye[2]}],tgt:[{tgt[0]},h+{tgt[1]},{tgt[2]}],fov:{fov}}});return 0}})()")
            settle(pg, 12)
            tag = ('hub-' if HUB else '') + name + ('' if HOUR == 12.5 else f'-{HOUR:g}h')
            pg.screenshot(path=str(OUT / f'{tag}.png'))
            print(tag, flush=True)
        pg.evaluate('delete walkView.opt.look')
        ctx.close(); b.close()
    srv.shutdown()
    print('errors:', errs[:6])


if __name__ == '__main__':
    main()

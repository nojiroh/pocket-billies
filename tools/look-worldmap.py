#!/usr/bin/env python3
"""Pictures of the hub's world map (the floating island, HB-3) at phone size: a few hours of the day times four orbit
angles, the map's canvas alone, and the map's numbers (things, clumps, the lagoon, the falls) in OUT_DIR/shots.json.

    python3 tools/look-worldmap.py OUT_DIR                     # hours 7, 13, 19, 23; angles 0, 90, 180, 270
    python3 tools/look-worldmap.py OUT_DIR --hours=13 --angles=0,180
    python3 tools/look-worldmap.py OUT_DIR --close             # zoomed in on the town too (one more picture an hour)
    python3 tools/look-worldmap.py OUT_DIR --close --at=120,52  # ... zoomed in over that spot of the island map (metres)
    python3 tools/look-worldmap.py OUT_DIR --map=PATH.json     # another island's map file in place of copperleaf.json
                                                              # (served to the page only; nothing is written)
    python3 tools/look-worldmap.py OUT_DIR --eng='{"worldMap":{"treeFar":120}}'   # Engine dials, as a player's own

Run `npm run data` first (the page reads game/data/gamedata.js). Software drawing: a look note, never a frame time
(the debug menu's Bowl map test measures those on a phone). Nothing is sent anywhere."""
import json, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import browser_check as fast  # noqa: E402  (the browser checks' page set-up)

ARGS = sys.argv[1:]
OUT = Path(next((a for a in ARGS if not a.startswith('--')), 'look-worldmap')).resolve()
opt = lambda k, d: next((a.split('=', 1)[1] for a in ARGS if a.startswith(f'--{k}=')), d)
HOURS = [float(h) for h in opt('hours', '7,13,19,23').split(',')]
ANGLES = [float(a) for a in opt('angles', '0,90,180,270').split(',')]
CLOSE = '--close' in ARGS
MAP = opt('map', None)
ENG = opt('eng', None)
AT = opt('at', None)
W, H = 390, 760
NAV = "document.querySelector('#nav')?.shadowRoot?.querySelector('button[data-t=map]')"

# the map's numbers: what is drawn on the floating island
NUMBERS = """(()=>{const g=worldBowl.ground,F=g.float,W=g.things||{};const kinds=Object.entries((W.gpu&&W.gpu.kinds)||{});
 return {floats:!!F,lift:typeof worldBowlIslandLift==='function'?worldBowlIslandLift():null,clumps:W.clumps??null,
  stands:(W.stand||[]).length,tris:W.tris??null,models:kinds.filter(([k])=>k.startsWith('m:')).length,
  trees:kinds.filter(([k])=>!k.startsWith('m:')).reduce((s,[,v])=>s+(v.n||0),0),
  lagoon:!!(F&&F.lagoon),falls:F&&F.falls?F.falls.n:0,water:!!g.water,isleWater:!!(F&&F.water)}})()"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    from playwright.sync_api import sync_playwright
    srv, base = fast.serve(fast.GAME)
    errs, shots = [], []
    t0 = time.time()
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=fast.LAUNCH)
        ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1)
        for s in (fast.CLOCK, fast.NO_ACCOUNTS, fast.TEST_GLOBALS): ctx.add_init_script(s)
        ctx.set_default_timeout(240000)
        if MAP:
            body = Path(MAP).read_text()
            ctx.route('**/data/maps/copperleaf.json', lambda r: r.fulfill(status=200, content_type='application/json', body=body))
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'{base}/index.html?fixture=town')
        if not fast.until(pg, f"typeof walkView!=='undefined'&&walkView.ready&&walkRenderer.on&&!!{NAV}", 240): raise Exception('the town never opened')
        if not fast.until(pg, "!document.getElementById('loader')", 60): raise Exception('the loading screen never went')
        if MAP:
            # the page's own copy of the map is from gamedata.js: put the file's in its place before the map opens
            pg.evaluate(f"(()=>{{gameData.maps.copperleaf=JSON.parse({json.dumps(body)});return 0}})()")
        if ENG:
            # a player's own Engine dials (the expert switch on), as tools/island-shots.py sets them
            pg.evaluate(f"(()=>{{const p=saveData.preferences=saveData.preferences||{{}};p.expert=true;p.eng={ENG};return 0}})()")
        pg.evaluate(f"(()=>{{{NAV}.click();return 0}})()")
        if not fast.until(pg, "typeof worldBowl!=='undefined'&&worldBowl.on&&worldBowl.frames>=3", 60): raise Exception('the map never opened')
        if not fast.until(pg, "worldBowlReady()&&!!worldBowl.ground.float&&!worldBowl.tween&&!document.getElementById('mapfade')", 180): raise Exception('the map never got ready')
        # everything but the map's canvas hidden (the card, the bar)
        # (the map's own canvas holds the pins and labels; the graphics card's canvas under it the island)
        pg.evaluate("(()=>{const C=[worldMap.cv,gpuState.cv].filter(Boolean);for(const el of document.body.querySelectorAll('*'))if(!C.some(cv=>el===cv||el.contains(cv)))el.style.setProperty('visibility','hidden','important');for(const cv of C)for(let e=cv;e;e=e.parentElement)e.style.setProperty('visibility','visible','important');return 0})()")
        if AT:
            # the orbit's pan limit lifted for these pictures alone, so a spot near the coast can be framed
            pg.evaluate("(()=>{FLOAT_CAMERA.pan=1.3;return 0})()")
        numbers = pg.evaluate(NUMBERS)
        print('numbers', numbers, flush=True)

        def settle(n=6):
            f0 = pg.evaluate('worldBowl.frames')
            if not fast.until(pg, f'worldBowl.frames>={f0 + n}', 120): raise Exception('the map stopped drawing')

        for hr in HOURS:
            pg.evaluate(f"environment.force={{time:{hr}}};worldBowl.skyState&&(worldBowl.skyState.at=-1e9);worldBowl.dirty=true;0")
            views = [(a, False) for a in ANGLES] + ([(ANGLES[0], True)] if CLOSE else [])
            for a, close in views:
                # the camera still (no slow idle turn), from the island's own home at that angle
                pg.evaluate(f"(()=>{{const F=worldBowl.ground.float;worldBowl.goal=null;worldBowl.tween=null;worldBowl.bench={{turn:0}};let c=bowlCamHomeFloat(F,{a}*Math.PI/180);if({str(close).lower()}){{c={{...c,dist:c.dist*.45,tilt:c.tilt*.8}};if({json.dumps(AT)}){{const [mx,mz]={json.dumps(AT)}.split(',').map(Number),g=worldBowl.ground,M=gameData.maps[g.islandMap],p=bowlMapPoint(worldBowl.spots[F.i],M,mx,mz,1000);c={{...c,tx:p[0],ty:p[1],dist:c.dist*.5,tilt:70*Math.PI/180}}}}c=bowlCamClamp(c)}}worldBowl.cam=c;worldBowl.dirty=true;return 0}})()")
                settle()
                name = f"h{int(hr):02d}-a{int(a):03d}{'-close' if close else ''}"
                box = pg.evaluate("(()=>{const r=worldMap.cv.getBoundingClientRect();return [r.x,r.y,r.width,r.height]})()")
                pg.screenshot(path=str(OUT / f'{name}.png'), clip={'x': box[0], 'y': box[1], 'width': min(box[2], W), 'height': min(box[3], H)})
                shots.append({'name': name, 'hour': hr, 'angle': a, 'close': close})
                print(f'[{time.time() - t0:5.0f}s] {name}', flush=True)
        b.close()
    srv.shutdown()
    (OUT / 'shots.json').write_text(json.dumps({'size': [W, H], 'map': MAP, 'eng': ENG, 'numbers': numbers, 'shots': shots, 'pageErrors': errs[:10]}, indent=1))
    print(f'{len(shots)} pictures in {OUT}; page errors: {len(errs)}')


if __name__ == '__main__':
    main()

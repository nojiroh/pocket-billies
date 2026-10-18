#!/usr/bin/env python3
"""alpha 0.4: a postcard of every town, made by the game's own renderer (like the map miniatures), so it always
matches the town. Each town is shown from a little above and in front of its middle, at its best hour (golden light
in Marigold Town, the night neon of Nimbus City, morning in Copperleaf...), clear weather, no one in the way, and saved
as game/art/postcards/<scene>.webp (480 x 320). The game lays the "Greetings from ..." lettering and the stamp over it
(game/js/postcards.js), so a renamed town needs no new picture.

    python3 tools/build-postcards.py              # every town that has no postcard yet
    python3 tools/build-postcards.py --all        # all of them again
    python3 tools/build-postcards.py city sundown # just these

Needs Playwright with Chromium (software WebGL is fine, just slow: about half a minute a town)."""
import gamedata  # phase 04b: the data files in game/data
import functools, http.server, json, socketserver, sys, threading, time
from pathlib import Path
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
GAME = ROOT / 'game'
OUT = GAME / 'art' / 'postcards'
SIZE = (480, 320)
# each town's hour, and where the camera looks (offset from the town's middle, metres), how far back and how high
# (ty: how high the point it looks at is, for a tall landmark; 1 m when not given)
VIEW = {
    'copperleaf': dict(time=9.5, at=(38, 42)), 'sundown': dict(time=16.6, at=(57, 25)), 'grotto': dict(time=12, dz=4, back=14, up=10),
    'foodcourt': dict(time=19.4, dz=6), 'mall': dict(time=12, dz=5, back=14, up=10), 'farm': dict(time=10.5, at=(56, 33)),
    'city': dict(time=16, at=(36, 35), back=20, up=13), 'taxhaven': dict(time=12.5, at=(80, 16)), 'summit': dict(time=11, dz=8, season='winter'),
    'twofold': dict(time=15, at=(48, 33)), 'bullion': dict(time=17.8, dz=6), 'marketcap': dict(time=19.6, at=(48, 40), back=24),
    'mintshaft': dict(time=12, at=(48, 35), back=16, up=10), 'portfolio': dict(time=18.3, dz=8), 'upside': dict(time=21.5, at=(48, 50), back=24, up=10),
    'pearlantis': dict(time=13, at=(44, 55.5), ty=4.5, back=25, up=8)}


def clear_view(D, sid, v):
    """a place to look at with nothing tall between the camera and it: the moored airship, a wind sail or a tower in the
    foreground would fill the card. Tries the town's own view first, then its middle, its landmarks and points round it"""
    sc = D['maps'][sid]; C = D['scenery']['props']; hub = sc.get('hub') or [sc['w'] / 2, sc['h'] / 2]
    back = v.get('back', 22)
    def tall(p):
        M = C.get(p['k']) or {}
        if M.get('build') or (M.get('group') or p['k']).startswith(('tree', 'palm', 'street_tree')) or any(w in p['k'] for w in ('lamp', 'lantern', 'mirror_shaft', 'solar_tree')): return False
        return -M.get('oy', 0) * p.get('s', 1) / 34 > 4.8 or p['k'] in ('airship_mast', 'airship_station', 'airship', 'wind_sail_flower')
    T = [p for p in sc['props'] if tall(p)]
    def ok(x, z):
        for p in T:
            span = (-2, 9) if p['k'] in ('airship_mast', 'airship_station', 'airship') else (-1.5, 1.5)
            if z - back * .8 < p['z'] < z - 2.5 and x - 7 < p['x'] + span[0] and p['x'] + span[1] > x - 7 and p['x'] + span[0] < x + 7: return False
            if p['k'] in ('airship_mast', 'airship_station') and abs(p['x'] + 3 - x) < 10 and z - back < p['z'] < z + 3: return False
        return 4 < x < sc['w'] - 4 and 4 < z < sc['h'] - 2
    base = v.get('at') or [hub[0] + v.get('dx', 0), hub[1] + v.get('dz', 0)]
    cands = [base, [hub[0], hub[1] + 4]]
    for p in sc['props']:
        if (C.get(p['k']) or {}).get('landmark'): cands.append([p['x'], p['z'] - 3])
    for dx, dz in ((-10, 4), (10, 4), (-14, 8), (14, 8), (0, 10), (-18, 2), (18, 2), (-8, -6), (8, -6)): cands.append([hub[0] + dx, hub[1] + dz])
    for c in cands:
        if ok(*c): return [round(c[0], 2), round(c[1], 2)]
    return base


def gamedata():
    s = gamedata.js_text()
    return json.JSONDecoder().raw_decode(s[s.index('window.GAMEDATA=') + 16:])[0]


SHOT_JS = """(async(a)=>{const sc=mapById(a.id),hub=a.at||mapHub(sc),x=hub[0]+(a.dx||0),z=hub[1]+(a.dz||0),y=groundHeightAt(x,z);
 const tgt=[x,y+(a.ty||1),z],eye=[x,y+(a.up||11),z-(a.back||22)];walkView.director={frame:()=>({look:{eye,tgt,fov:a.fov||36},items:[],parts:[],lights:[],hide:null,cut:0,center:[x,z]})};
 const f0=walkRenderer.frames;await new Promise(r=>{const t0=performance.now();const k=()=>{if(walkRenderer.frames>=f0+8&&(!walkRenderer.ring||!(walkRenderer.ring.jobs||[]).length)||performance.now()-t0>60000)r();else setTimeout(k,150)};k()});
 return true})"""


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    D = gamedata(); towns = [r['mapId'] for r in D['locations'] if r.get('kind') == 'town' and r.get('mapId')]
    want = [s for s in towns if (not args or s in args) and ('--all' in sys.argv or args or not (OUT / f'{s}.webp').exists())]
    if not want: print('every town has its postcard (use --all to make them again)'); return
    OUT.mkdir(parents=True, exist_ok=True)
    from playwright.sync_api import sync_playwright

    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Q, directory=str(GAME))); port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = b.new_page(viewport={'width': 960, 'height': 640}); pg.set_default_timeout(240000)
        pg.add_init_script('window.PB_TEST_GLOBALS=true')  # phase 04d: the modules' names on window, for evaluate()
        pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_selector('.ttl,.title', timeout=60000)
        pg.evaluate("gameData.engine=gameData.engine||{};gameData.engine.defaults=Object.assign({},gameData.engine.defaults||{},{quality:{resolution:1,shadowMap:2048,auto:false},lens:{blur:0,vignette:.25,grain:0,aberration:0}});0")
        pg.evaluate("if(typeof titleEnd==='function')titleEnd();uiState.pg='girl';startGame(SPECIES.scoop0?'scoop':RULES.start.starters[0]);uiState.modal=null;uiState.mq=[];renderOverlay();uiState.toastQ=[];uiState.toastOn=false;render();0")
        pg.add_style_tag(content='body *:not(#dio){visibility:hidden!important} #dio{visibility:visible!important}')
        for sid in want:
            t0 = time.time(); v = dict(VIEW.get(sid, {})); v['id'] = sid; v['at'] = clear_view(D, sid, v); v.pop('dx', None); v.pop('dz', None)
            pg.evaluate("((v)=>{environment.on=true;environment.force={time:v.time||16,season:v.season||'summer',weather:'clear'}})(%s);0" % json.dumps(v))
            pg.evaluate(f"uiState.tab='walk';uiState.bench={{id:'{sid}',test:1}};render();0")
            for _ in range(160):
                if pg.evaluate(f"!!(walkView.ready&&walkView.id==='{sid}'&&walkRenderer.frames>2)"): break
                time.sleep(.5)
            time.sleep(1.5)
            pg.evaluate(SHOT_JS + "(%s)" % json.dumps(v))
            time.sleep(.6)
            pg.screenshot(path=str(OUT / '_shot.png'))
            im = Image.open(OUT / '_shot.png').convert('RGB')
            im = im.resize(SIZE, Image.LANCZOS)
            im = ImageEnhance.Color(im).enhance(1.08)
            im.save(OUT / f'{sid}.webp', quality=82, method=6)
            pg.evaluate("walkView.director=null;0")
            print(f'  {sid}: {SIZE[0]}x{SIZE[1]} in {time.time() - t0:.0f}s', flush=True)
        (OUT / '_shot.png').unlink(missing_ok=True)
        b.close()
    srv.shutdown()


if __name__ == '__main__':
    main()

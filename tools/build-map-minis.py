#!/usr/bin/env python3
"""Miniatures of every stop for the world map (v24): each walk scene is drawn by the game's own renderer from a high
three-quarter view, cut out along the edge of the scene, given a slice of earth underneath like a tabletop diorama,
and saved as game/art/map/mini/<scene>.png. The map stands them on the globe where the stops are.

    python3 tools/build-map-minis.py                 # every stop's scene that has no miniature yet
    python3 tools/build-map-minis.py --all           # redraw all of them
    python3 tools/build-map-minis.py verdigris marigold    # just these scenes

Needs Playwright with Chromium (software WebGL is fine, just slow: about half a minute a scene)."""
import gamedata  # phase 04b: the data files in game/data
import functools, http.server, json, socketserver, sys, threading, time
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
GAME = ROOT / 'game'
OUT = GAME / 'art' / 'map' / 'mini'
WMINI = 220            # width of the saved miniature in pixels


def gamedata():
    s = gamedata.js_text()
    return json.JSONDecoder().raw_decode(s[s.index('window.GAMEDATA=') + 16:])[0]


SHOT_JS = """(async(id)=>{const sc=mapById(id);const W=sc.w,H=sc.h;
 const tgt=[W/2,0,H*.5],eye=[W/2,Math.max(W,H)*.6,-H*.66];walkView.director={frame:()=>({look:{eye,tgt,fov:30,w:W*1.08},items:[],parts:[],lights:[],hide:null,cut:0,center:[W/2,H/2]})};
 const f0=walkRenderer.frames;await new Promise(r=>{const t0=performance.now();const k=()=>{if(walkRenderer.frames>=f0+4||performance.now()-t0>40000)r();else setTimeout(k,100)};k()});
 const C=walkView.C,cv=walkView.cv,R=cv.getBoundingClientRect(),m=C.vp;
 const P=(x,y,z)=>{const cx=m[0]*x+m[4]*y+m[8]*z+m[12],cy=m[1]*x+m[5]*y+m[9]*z+m[13],w=m[3]*x+m[7]*y+m[11]*z+m[15];return [R.left+(cx/w*.5+.5)*R.width,R.top+(1-(cy/w*.5+.5))*R.height]};
 const g=(x,z)=>groundHeightAt(Math.min(W-.01,Math.max(0,x)),Math.min(H-.01,Math.max(0,z)));const top=[],bot=[];const n=48;
 for(let i=0;i<=n;i++){const x=W*i/n;top.push(P(x,g(x,0),0));bot.push(P(x,g(x,0)-1.4,0))}
 const ring=[];for(let i=0;i<=n;i++)ring.push(P(W*i/n,g(W*i/n,0),0));for(let i=0;i<=n;i++)ring.push(P(W,g(W,H*i/n),H*i/n));for(let i=n;i>=0;i--)ring.push(P(W*i/n,g(W*i/n,H),H));for(let i=n;i>=0;i--)ring.push(P(0,g(0,H*i/n),H*i/n));
 return {ring,front:top,skirt:bot,rect:[R.left,R.top,R.width,R.height]}})"""


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    D = gamedata(); scenes = [r['mapId'] for r in D['locations'] if r.get('mapId')]
    want = [s for s in scenes if (not args or s in args) and ('--all' in sys.argv or args or not (OUT / f'{s}.png').exists())]
    if not want: print('every stop has a miniature (use --all to redraw)'); return
    OUT.mkdir(parents=True, exist_ok=True)
    from playwright.sync_api import sync_playwright

    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Q, directory=str(GAME))); port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = b.new_page(viewport={'width': 1200, 'height': 900}); pg.set_default_timeout(240000)
        pg.add_init_script('window.PB_TEST_GLOBALS=true')  # phase 04d: the modules' names on window, for evaluate()
        pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_selector('.ttl,.title', timeout=60000)
        pg.evaluate("gameData.engine=gameData.engine||{};gameData.engine.defaults=Object.assign({},gameData.engine.defaults||{},{quality:{resolution:1,shadowMap:2048,auto:false},lens:{blur:0,vignette:0,grain:0,aberration:0}});0")
        pg.evaluate("if(typeof titleEnd==='function')titleEnd();uiState.pg='girl';startGame(SPECIES.scoop0?'scoop':RULES.start.starters[0]);uiState.modal=null;uiState.mq=[];renderOverlay();uiState.toastQ=[];uiState.toastOn=false;render();0")
        pg.add_style_tag(content='body *:not(#dio){visibility:hidden!important} #dio{visibility:visible!important}')
        # v47: always at noon on a clear spring day, whatever the clock says (the light follows the time of day now)
        pg.evaluate("if(typeof environment!=='undefined'){environment.on=true;environment.force={time:12.5,season:'spring',weather:'clear'}}0")
        for sid in want:
            t0 = time.time()
            pg.evaluate(f"uiState.tab='walk';uiState.bench={{id:'{sid}',test:1}};render();0")
            for _ in range(160):
                if pg.evaluate(f"!!(walkView.ready&&walkView.id==='{sid}'&&walkRenderer.frames>2)"): break
                time.sleep(.5)
            time.sleep(1.5)
            info = pg.evaluate(SHOT_JS + f"('{sid}')")
            pg.screenshot(path=str(OUT / '_shot.png'))
            im = Image.open(OUT / '_shot.png').convert('RGBA')
            ring = [tuple(p) for p in info['ring']]; front = info['front']; skirt = info['skirt']
            mask = Image.new('L', im.size, 0); dr = ImageDraw.Draw(mask); dr.polygon(ring, fill=255)
            out = Image.new('RGBA', im.size, (0, 0, 0, 0)); out.paste(im, (0, 0), mask)
            # a slice of earth under the front edge
            soil = Image.new('RGBA', im.size, (0, 0, 0, 0)); sd = ImageDraw.Draw(soil)
            poly = [tuple(p) for p in front] + [tuple(p) for p in skirt[::-1]]
            sd.polygon(poly, fill=(104, 74, 56, 255))
            a = np.asarray(soil).copy(); ys = np.arange(a.shape[0])[:, None]
            ftop = np.interp(np.arange(a.shape[1]), [p[0] for p in front], [p[1] for p in front]); fbot = np.interp(np.arange(a.shape[1]), [p[0] for p in skirt], [p[1] for p in skirt])
            f = np.clip((ys - ftop[None, :]) / np.maximum(1, fbot - ftop)[None, :], 0, 1)
            band = (f < .18)
            col = np.where(band[..., None], np.array([92, 140, 70]), np.array([118, 84, 62]) * (1 - .35 * f[..., None]))
            a[..., :3] = np.where(a[..., 3:4] > 0, col, a[..., :3]); soil = Image.fromarray(a.astype(np.uint8), 'RGBA')
            soil.alpha_composite(out); out = soil
            bb = out.getbbox()
            if not bb: print('  nothing drawn for', sid); continue
            out = out.crop(bb)
            h = round(out.height * WMINI / out.width)
            out = out.resize((WMINI, h), Image.LANCZOS)
            al = np.asarray(out)[..., 3]; arr = np.asarray(out).copy(); arr[..., 3] = np.where(al > 110, 255, 0); out = Image.fromarray(arr, 'RGBA')
            out.save(OUT / f'{sid}.png', optimize=True)
            print(f'  {sid}: {out.size[0]}x{out.size[1]} in {time.time() - t0:.0f}s', flush=True)
        (OUT / '_shot.png').unlink(missing_ok=True)
        b.close()
    srv.shutdown()


if __name__ == '__main__':
    main()

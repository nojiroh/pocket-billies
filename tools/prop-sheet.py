#!/usr/bin/env python3
"""v32: every prop in the game's own 3D renderer, seen from two sides, on contact sheets of twelve.

    python3 tools/prop-sheet.py                    # all props -> validation/props/props-00.png, props-01.png, ...
    python3 tools/prop-sheet.py fountain,crate     # just these
    python3 tools/check-quick.py --props           # the quick check runs it too

Software drawing, so it takes a while (about twelve seconds a prop). The props stand in one row per batch (sixteen at
a time, spaced by their size, so a tall building never hides the next prop), tall ones are framed from farther back,
and only the part of the screen round the prop is captured. A small review sheet (sheet-NN.png) is written as soon
as each batch is done. Useful after editing props in the Studio: anything floating, cut off, oddly shaped or badly
lit shows up at a glance."""
import sys, time, json, io
from pathlib import Path
import importlib.util
ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('cq', ROOT / 'tools' / 'check-quick.py'); cq = importlib.util.module_from_spec(spec); spec.loader.exec_module(cq)
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
OUT = ROOT / 'validation' / 'props'; OUT.mkdir(parents=True, exist_ok=True); TAG = 'props'
ARGS = [a for a in sys.argv[1:] if not a.startswith('-')]
ONLY = ARGS[0].split(',') if ARGS else None
srv, base = cq.serve(cq.ROOT / 'game')
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    errs = []; ctx, pg = cq.open_game(b, base, 520, 420, False, errs)
    pg.evaluate("gameData.engine.defaults.quality=Object.assign({},gameData.engine.defaults.quality,{resolution:.6,auto:false});gameData.engine.defaults.lens=Object.assign({},gameData.engine.defaults.lens,{blur:0,grain:0});gameData.engine.defaults.color=Object.assign({},gameData.engine.defaults.color,{bloom:0});gameData.engine.defaults.shadows=Object.assign({},gameData.engine.defaults.shadows,{ao:0});gameData.engine.defaults.sun=Object.assign({},gameData.engine.defaults.sun,{shafts:0});gameData.engine.defaults.grass=Object.assign({},gameData.engine.defaults.grass,{density:0});gameData.engine.defaults.world=Object.assign({},gameData.engine.defaults.world,{farProps:0});gameData.engine.defaults.quality=Object.assign({},gameData.engine.defaults.quality,{shadowMap:1024});environment.force={time:13,weather:'clear',season:'summer'};;0"); cq.play(pg)
    keys = pg.evaluate("Object.keys(walkData().sc.props).filter(k=>!/^wall_|rug|ladder/.test(k))")
    if ONLY: keys = [k for k in keys if k in ONLY]
    print(len(keys), 'props', flush=True)
    tiles = []; T0=time.time()
    B = 16
    CAT = pg.evaluate("JSON.stringify(Object.fromEntries(Object.entries(walkData().sc.props).map(([k,P])=>[k,[P.box?P.box[0]:0,P.img,-(P.oy||0)]])))")
    SZ = {}
    for k, (bx, img, oy) in json.loads(CAT).items():
        try: w = Image.open(ROOT / 'game' / 'art' / img).size[0]
        except Exception: w = 40
        SZ[k] = [bx, w / 34, oy / 34]
    for bi in range(0, len(keys), B):
        batch = keys[bi:bi + B]; sid = f'_audit{bi}'
        xs = []; x = 6
        for k in batch:
            wm = max(SZ.get(k, [0, 1.2, 1])[0], SZ.get(k, [0, 1.2, 1])[1]); x += max(5, wm / 2 + 4); xs.append(round(x)); x += max(5, wm / 2 + 4)
        W, H = int(x) + 6, 20
        props = [{'k': k, 'x': xs[i], 'z': 12} for i, k in enumerate(batch)]
        pg.evaluate(f"""gameData.scenes['{sid}']={{name:'Audit',w:{W},h:{H},edge:'g',tiles:Array({H}).fill('g'.repeat({W})),props:{json.dumps(props)},cam:{{pitch:30,h:8,fov:1}},sky:['#8CC6E6','#BFE3EE','#F4E8C8'],haze:'#EAD9C0',hazeD:80,far:null,folk:0,test:1,exits:[],hub:[1,1],blur:0}};uiState.tab='walk';uiState.bench={{id:'{sid}',test:1}};render();0""")
        cq.until(pg, f"walkView.ready&&walkView.id==='{sid}'", 60); time.sleep(2)
        pg.evaluate("document.body.classList.add('photo');walkView.pl.route=null;walkView.pl.x=1;walkView.pl.z=1;0")
        for p in props:
            row = []
            hm = SZ.get(p['k'], [0, 1, 1])[2]; zm = round(min(1.7, .62 * max(1, hm / 3.4)), 3)
            for yaw in (-.55, .55):
                pg.evaluate(f"walkRenderer.swoop={{x:{p['x']},z:{p['z']}-1.6}};walkRenderer.yawT=walkRenderer.yaw={yaw};walkRenderer.zoomT=walkRenderer.zoom={zm};walkRenderer.camT=null;0")
                f0 = pg.evaluate("walkRenderer.frames"); cq.until(pg, f"walkRenderer.frames>{f0 + 1}", 20)
                q = pg.evaluate(f"(()=>{{const C=walkView.C,M=walkData().sc.props['{p['k']}'],hm=Math.max(.6,-(M.oy||0)/(walkData().sc.ppu||34)),wm=Math.max(.6,(artImage(M.img)||{{width:40}}).width/(walkData().sc.ppu||34)),a=worldToScreen(C,{p['x']},0,{p['z']}),b=worldToScreen(C,{p['x']},hm+.3,{p['z']});return a&&b?[a.x,a.y,b.y,C.rw,C.rh,wm*a.s]:null}})()")
                if q:
                    vw, vh = pg.viewport_size['width'], pg.viewport_size['height']; sx, sy = vw / q[3], vh / q[4]; cx = q[0] * sx; y0, y1 = q[2] * sy - 18, q[1] * sy + 32
                    hh = max(85, y1 - y0); ww = max(hh * 300 / 260, q[5] * sx * 1.3); hh = ww * 260 / 300; ym = (y0 + y1) / 2
                    L, T = max(0, cx - ww / 2), max(0, ym - hh / 2); R2, B2 = min(vw, cx + ww / 2), min(vh, ym + hh / 2)
                    im = Image.open(io.BytesIO(pg.screenshot(clip={'x': L, 'y': T, 'width': max(8, R2 - L), 'height': max(8, B2 - T)}))).convert('RGB')
                    fr = Image.new('RGB', (int(ww), int(hh)), (0, 0, 0)); fr.paste(im, (int(L - (cx - ww / 2)), int(T - (ym - hh / 2))))
                    row.append(fr.resize((300, 260)))
            print(p["k"], round(time.time()-T0,1), flush=True)
            if len(row) == 2:
                t = Image.new('RGB', (606, 278), (30, 30, 36)); t.paste(row[0], (0, 18)); t.paste(row[1], (306, 18))
                ImageDraw.Draw(t).text((6, 3), p['k'], fill=(255, 240, 200)); tiles.append(t)
        bt = tiles[-len(batch):]
        S = Image.new('RGB', (606, 140 * ((len(bt) + 1) // 2)), (20, 20, 24))
        for j, t in enumerate(bt): S.paste(t.resize((303, 139)), ((j % 2) * 303, (j // 2) * 140))
        S.save(OUT / f'sheet-{bi // B:02d}.png')
        print('batch', bi, 'done', flush=True)
    pg.evaluate("walkRenderer.swoop=null;0")
    # sheets of 12
    for si in range(0, len(tiles), 12):
        S = Image.new('RGB', (606 * 2, 278 * 6), (20, 20, 24))
        for j, t in enumerate(tiles[si:si + 12]): S.paste(t, ((j % 2) * 606, (j // 2) * 278))
        S.save(OUT / f'{TAG}-{si // 12:02d}.png')
    print('errs', errs[:4])
    b.close()

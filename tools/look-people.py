#!/usr/bin/env python3
"""Characters track CH-1: people side by side (the test map test_people), in pictures and in draw calls, headless.

    python3 tools/look-people.py                    # every zoom stop, by day and at night, the camera turned 0, 35, 90 degrees
    python3 tools/look-people.py --crowd=40         # with 40 townsfolk wandering round the lineup as well
    python3 tools/look-people.py --only=normal,day  # only these zoom stops (close, normal, far), times (day, night)
                                                    # or turns (yaw0, yaw35, yaw90); kinds left out are all taken
    python3 tools/look-people.py --frames=12        # frames counted a shot (default 6)
    python3 tools/look-people.py --out=DIR          # somewhere else (a "before" set from another worktree)
    python3 tools/look-people.py --scene=test_props # another test map

The page is a 390 x 844 phone at 3 device pixels to the CSS pixel (the one the characters track's numbers are worked
out for: the scene drawn into the same 860 x 1861 buffer as on the phone), with the game's own graphics, but auto
quality off (every pass every frame, as a phone with room to spare draws them), no depth of field (it would blur
everyone but you) and no see-through circle round you (it would thin out the people in front of you). You stand at
the map's hub, in the middle of the lineup; the camera is the game's own at each zoom stop (logic/camera-zoom.js
zoomStops), turned by hand as a player turns it. Everyone's walk frames are drawn before the first shot.

For each shot: the picture, and over --frames frames (engine/gpu-counters.js, as the debug log counts them) the draws
of each pass and how many of them drew people (the `person` tag), the people drawn, their pictures on the graphics
card and their MB (walk-view-gl.js peopleReport), the quality step, and how many scene-buffer pixels one art pixel of
yours covers (CH-0: 0.74 at the Normal stop). Headless Chromium draws in software, so its milliseconds mean nothing
(docs/graphics-bench.md): only counts are kept. Pictures and notes.json go to validation/look-people/ (not in git).
Run `npm run data` first. Nothing is sent anywhere."""
import json, math, sys, time
from importlib import import_module
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import browser_check as fast  # noqa: E402  (the browser checks' page set-up)
shots = import_module('island-shots')  # its HIDE_HUD and settle

ROOT = fast.ROOT
ARGS = sys.argv[1:]
arg = lambda k, d=None: next((a.split('=', 1)[1] for a in ARGS if a.startswith(f'--{k}=')), d)
SCENE = arg('scene', 'test_people')
OUT = Path(arg('out', ROOT / 'validation' / 'look-people'))
FRAMES = int(arg('frames', 6))
CROWD = int(arg('crowd', 0))
ONLY = set(arg('only', '').split(',')) - {''}
TIMES = [('day', 12.5), ('night', 22.0)]
YAWS = [0, 35, 90]
W, H, DPR = 390, 844, 3

# the counts of the frames that follow (engine/gpu-counters.js): every pass's draws, the people's among them, and the
# people's own report; no times
COUNT = """(async (n)=>{
 const R=walkRenderer, f0=R.frames;
 gpuCountBegin();
 await new Promise(ok=>{const tick=()=>{if(R.frames-f0>=n)ok();else requestAnimationFrame(tick)};requestAnimationFrame(tick)});
 const g=gpuCountEnd(), ppl={};
 for (const p in (g&&g.dct)||{}) if (g.dct[p].person) ppl[p]=g.dct[p].person;
 const rep=typeof peopleReport==='function'?peopleReport():null;
 return {frames:g&&g.frames, draws:g&&g.dc[0], instances:g&&g.dc[1], passes:g&&g.dcp, people:ppl,
  peopleDraws:Object.values(ppl).reduce((a,b)=>a+b,0), drawn:rep&&rep.drawn, pictures:rep&&rep.textures,
  mb:rep&&rep.mb, q:R.qe||0, lights:R.X&&R.X.lights?R.X.lights.length:0}})"""

# every walk frame of everyone in the lineup and you drawn now (person-art.js draws them a few a frame otherwise, which
# at a headless frame every few seconds takes minutes); false while some art is still loading (person-art.js keeps
# nothing drawn without it), so it is asked again
WARM = """(()=>{const who=[...new Set(['me',...(walkView.sc.lineup||[]).map(L=>L.who)])];personArtMissing=false;
 for(const w of who){const F=personWalkFrames(w);if(!F)continue;
  for(const d of ['down','up','side','sideR']){const v=F[d];if(!v)continue;v[0];for(let i=0;i<6;i++)if(v.cyc)v.cyc[i]}}
 return !personArtMissing})()"""

# how many scene-buffer pixels tall one of your art pixels is: you, 1.75 m upright, projected by this frame's camera
DENSITY = """(()=>{const C=walkView.C,P=walkView.pl;if(!C||!C.vp||!P)return null;
 const y=P.yv??standingHeightAt(P.x,P.z),ppm=(wardrobeData()||{}).ppm||66.5,
  sy=v=>{const m=C.vp,w=m[3]*v[0]+m[7]*v[1]+m[11]*v[2]+m[15],yc=m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13];return (1-yc/w)/2*C.rh};
 const px=Math.abs(sy([P.x,y,P.z])-sy([P.x,y+1.75,P.z]));
 return {buffer:[C.rw,C.rh],personPx:Math.round(px*10)/10,perArtPx:Math.round(px/(1.75*ppm)*100)/100}})()"""


def wanted(*names):
    """a shot is taken unless --only names something of its kind and not this one"""
    kinds = [{'close', 'normal', 'far'}, {'day', 'night'}, {f'yaw{y}' for y in YAWS}]
    return all(not (ONLY & k) or n in ONLY for n, k in zip(names, kinds))


def main():
    from playwright.sync_api import sync_playwright
    OUT.mkdir(parents=True, exist_ok=True)
    srv, base = fast.serve(fast.GAME)
    errs, rows = [], []
    t0 = time.time()
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=fast.LAUNCH)
        ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=DPR, is_mobile=True, has_touch=True)
        for s in (fast.CLOCK, fast.NO_ACCOUNTS, fast.TEST_GLOBALS): ctx.add_init_script(s)
        ctx.set_default_timeout(600000)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'{base}/index.html?test=1&scene={SCENE}')
        if not fast.until(pg, f"typeof walkView!=='undefined'&&walkView.ready&&walkRenderer.on&&(walkView.sc.baseId||walkView.id)==='{SCENE}'", 300):
            raise Exception(f'{SCENE} never opened')
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();0")
        # the game's graphics, with auto quality and depth of field off, as a player's own expert dials set them, and no
        # see-through circle round you (the lineup in front of you would thin out)
        pg.evaluate("(()=>{const p=saveData.preferences=saveData.preferences||{};p.expert=true;p.eng={quality:{auto:false},lens:{blur:0,bokeh:0},camera:{hideFade:false}};return 0})()")
        if CROWD: pg.evaluate(f"walkView.sc.folk={CROWD};walkView.folkId='';0")
        hub = pg.evaluate('mapHub(walkView.sc)')
        # you at the hub, the camera's target reset (browser_check.stand, with island-shots' longer wait: at three
        # device pixels to the CSS pixel a headless frame takes seconds)
        pg.evaluate(f"(()=>{{const P=walkView.pl;P.x={hub[0]};P.z={hub[1]};P.route=null;P.yv=null;walkRenderer.camT=null;return 0}})()")
        shots.settle(pg, 4)
        # you face the camera (a plain word: logic/person-view.js faceWord), as a fresh view stands you
        pg.evaluate("(()=>{const P=walkView.pl;if(typeof faceWord==='function')faceWord(P,'down');else P.dir='down';return 0})()")
        print(f'[{time.time() - t0:5.0f}s] {SCENE} open; drawing everyone\'s walk frames', flush=True)
        for _ in range(60):
            if pg.evaluate(WARM): break
            shots.settle(pg, 2)
        else: print('  some art never loaded: those people are drawn without it', flush=True)
        want = pg.evaluate('(walkView.sc.lineup||[]).length') + 1 + CROWD
        if not fast.until(pg, f'peopleReport().drawn>={want}', 600):
            print(f"  only {pg.evaluate('peopleReport().drawn')} of {want} people drawn", flush=True)
        shots.settle(pg, 4)
        print(f'[{time.time() - t0:5.0f}s] {pg.evaluate("peopleReport().drawn")} people drawn; the shots', flush=True)
        pg.evaluate(shots.HIDE_HUD)
        stops = pg.evaluate('zoomStops().map(s=>[s.id,s.zoom])')
        for tname, hour in TIMES:
            pg.evaluate(f"environment.force={{time:{hour},weather:'clear',season:'summer'}};0")
            for sid, zoom in stops:
                for yaw in YAWS:
                    if not wanted(sid, tname, f'yaw{yaw}'): continue
                    pg.evaluate(f"walkRenderer.zoomT=walkRenderer.zoom={zoom};walkRenderer.yawT=walkRenderer.yaw={math.radians(yaw)};walkRenderer.camT=null;0")
                    shots.settle(pg, 6)
                    name = f"{'crowd%d-' % CROWD if CROWD else ''}{tname}-{sid}-yaw{yaw}"
                    pg.screenshot(path=str(OUT / f'{name}.png'))
                    r = pg.evaluate(f'{COUNT}({FRAMES})')
                    r.update(shot=name, time=tname, stop=sid, zoom=zoom, yaw=yaw, crowd=CROWD, **(pg.evaluate(DENSITY) or {}))
                    rows.append(r)
                    print(f"[{time.time() - t0:5.0f}s] {name:>24}: {r['drawn']} people drawn, {r['draws']} draws "
                          f"({r['peopleDraws']} people's: {r['people']}), {r['pictures']} pictures {r['mb']} MB, "
                          f"q{r['q']}, {r.get('perArtPx')} buffer px an art px", flush=True)
        pg.evaluate("environment.force=null;0")
        ctx.close(); b.close()
    srv.shutdown()
    notes = {'scene': SCENE, 'phone': [W, H, DPR], 'frames': FRAMES, 'crowd': CROWD, 'shots': rows, 'errors': errs[:6]}
    (OUT / 'notes.json').write_text(json.dumps(notes, indent=1))
    print(f'{len(rows)} shots in {OUT}', 'errors:', errs[:6])


if __name__ == '__main__':
    main()

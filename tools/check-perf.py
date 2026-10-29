#!/usr/bin/env python3
"""Test data track TD-3: the Graphics test's benchmark path, headless, with blocking gates (counts, not milliseconds).

    python3 tools/check-perf.py                  # the path on a phone page and the memory matrix, against the baseline
    python3 tools/check-perf.py --baseline       # rewrite validation/perf-baseline.json on purpose (HANDOFF says why)
    python3 tools/check-perf.py --only=path      # or --only=matrix
    python3 tools/check-perf.py --segments=open,lamps   # some segments only (the gates read only those)
    python3 tools/check-perf.py --walk           # also walk each route for real (bench-walk.js benchWalk: slow, notes)
    python3 tools/check-perf.py --plant=draws    # a regression on purpose (draws, memory, compile; comma-separated):
                                                 # the check must go red
    python3 tools/check-perf.py --routes [--plans=none,forest --full --frames=20 --shots=DIR --out=FILE]
                                                 # what drawing a laid-out run route costs (was tools/route-perf.py)
    python3 tools/check-perf.py --island [--low --scene=ID --frames=30 --square --folk=0,6 --hours=12.5,21 --out=FILE]
                                                 # the hub island round its coast or on its square (was tools/island-perf.py)

The path: every segment of game/js/logic/bench-path.js (TD-2), on an Android phone page (390 x 844, so the game's
phone limits hold), at its own hour, weather, season, townsfolk and engine values, with automatic quality off and the
resolution as shipped. Headless Chromium draws in software (SwiftShader, about one frame a second at full graphics),
so a walk in real time would take hours: the player is put at every point of the route and halfway along each leg
longer than 8 m, the place is left to settle, and 4 frames are counted (engine/gpu-counters.js). Those counts
repeat; the milliseconds are notes. `--walk` also walks each route as the Graphics test does.

The gates (the owner's answers, docs/phases/test-data-track.md section 5, TD-3): against validation/perf-baseline.json,
a segment's draws or instances a frame (mean or most over its spots) or its graphics memory (the game's own
estimate, engine/webgl.js gpuMemory) more than 10% up; any program compiled after a place settled that the baseline
doesn't list (phase 20 H5); a segment over 400 draws a frame (phase 20 A8, the phone budget) that the baseline doesn't
already list as over it; a renderer that isn't SwiftShader (the counts were made on it); and in the memory matrix
(Copperleaf as shipped at DPR 1-4 on a phone and a desktop page; in test_graphics at DPR 4, Balanced and Beautiful
on both and each engine preset on the phone page: DPR 2-4 draw the same canvas) anything over 300 MB at a phone size. Results go to validation/perf/results.json. Run `npm run data`
first. Nothing is sent anywhere: numbers, segment ids and program names only."""
import json
import queue
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import browser_check as fast  # noqa: E402  (the browser checks' page set-up)

ARGS = sys.argv[1:]
ROOT = fast.ROOT
OUT = ROOT / 'validation' / 'perf'
BASELINE = ROOT / 'validation' / 'perf-baseline.json'


def arg(name, default=None):
    return next((a.split('=', 1)[1] for a in ARGS if a.startswith(f'--{name}=')), default)


ONLY = arg('only')
SEGMENTS = [s for s in (arg('segments') or '').split(',') if s]
PLANT = [s for s in (arg('plant') or '').split(',') if s]
WALK = '--walk' in ARGS
MAKE_BASELINE = '--baseline' in ARGS
PATH_RES = float(arg('res', 0.5))

GROW = 0.10                                   # the owner's answer: more than 10% over the baseline fails
FLOOR = {'draws': 5, 'instances': 50, 'mb': 2}  # and at least this much, so a small count's jitter isn't a failure
DRAW_BUDGET = 400                             # phase 20 A8: draws a frame on a phone
MB_BUDGET = 300                               # the owner's answer (TD-0): graphics memory on a phone
SPOT_LEG = 8                                  # a leg longer than this (m) gets a spot halfway along
SETTLE, COUNT = 2, 4                          # frames to settle at a spot, then frames counted (an even number:
                                              # some work runs every other frame)
PHONE = {'width': 390, 'height': 844, 'mobile': True,
         'ua': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'}
# the game draws the walk at most at DPR 1.75 and then at most 1.2 million pixels on a phone, 1.6 elsewhere
# (walk-view-gl.js), so DPR 2, 3 and 4 draw the same canvas (measured: 860x1861 on the phone page at each): every DPR
# for the place as shipped, the presets at DPR 4, the most they draw (each reading is one to two minutes in software
# drawing with the path running beside it)
PRESET_DPRS = (4,)
DESKTOP = {'width': 1280, 'height': 800, 'mobile': False, 'ua': None}

# automatic quality off, in the game-wide defaults, before any script reads them: the counts need a still scene (auto
# quality would chase software drawing's frame rate). The path's page also draws at half the resolution (--res=):
# the same counts (measured: open ground 750.7 / 824 draws at 1 and at 0.5) at a third of the time; graphics memory
# there is compared with the baseline at the same resolution, and the matrix measures it as shipped
PIN = """(()=>{const was=Object.getOwnPropertyDescriptor(window,'GAMEDATA');let G;Object.defineProperty(window,'GAMEDATA',{configurable:true,
 get(){return was&&was.get?was.get():G},set(v){if(v&&typeof v==='object'){v.engine=v.engine||{};const d=v.engine.defaults=v.engine.defaults||{};
 d.quality=Object.assign({},d.quality||{},{auto:false%s})}if(was&&was.set)was.set(v);else G=v}})})()"""
# --plant=draws: every indexed draw is followed by an empty one (counted: the counters wrap the context's own method)
PLANT_DRAWS = """(()=>{const P=WebGL2RenderingContext.prototype,f=P.drawElements;
 P.drawElements=function(...a){const r=f.apply(this,a);this.drawArrays(this.POINTS,0,0);return r}})()"""
# --plant=memory: a 64 MB render target nobody frees; --plant=compile: a program compiled once the place has settled
PLANT_MEMORY = "(()=>{window.__planted=gpuTexture('targets',64*1048576);return 0})()"
PLANT_COMPILE = """(()=>{const v='#version 300 es\\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}',
 f='#version 300 es\\nprecision mediump float;out vec4 o;void main(){o=vec4(1.,0.,1.,1.);}';compileProgram([v,f],'planted');return 0})()"""

# counts and memory over n frames where the player stands
MEASURE = """(async (n)=>{const R=walkRenderer,f0=R.frames,t0=performance.now();gpuCountBegin();
 await new Promise(ok=>{const tick=()=>{if(R.frames-f0>=n)ok();else requestAnimationFrame(tick)};requestAnimationFrame(tick)});
 const g=gpuCountEnd();return {ms:Math.round((performance.now()-t0)/Math.max(1,R.frames-f0)),draws:g?g.dc[0]:null,
 instances:g?g.dc[1]:null,programs:g?g.dc[2]:null,mb:benchMemory().mb}})"""
# a segment's set-up, as benchWalk does it: its hour, weather and season, its townsfolk, and its engine values
# (prefs, then the place built again, as the Graphics test does); returns the place to wait for
SEG_ENTER = """(async (id)=>{const s=benchSegmentById(id);segmentForce(s);
 const own=JSON.stringify(s.eng||null),P=saveData.preferences||(saveData.preferences={});
 if((window.__engNow||'null')!==own){P.expert=!!s.eng;P.eng=s.eng?JSON.parse(own):{};window.__engNow=own;
  if(sceneOpen(s.scene)){rebuildFromSettings();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))}}
 await benchOpen(s.scene);const sc=walkView.sc;
 if(sc&&s.folk!=null&&held.sc!==sc){held.sc=sc;held.folk=sc.folk}
 if(sc)sc.folk=s.folk!=null?s.folk:held.sc===sc?held.folk:sc.folk;standAt(s);return s.scene})"""
STAND = """((x,z,zoom)=>{const P=walkView.pl,o=(walkView.sc&&walkView.sc.baseOff)||[0,0];P.x=x+o[0];P.z=z+o[1];P.route=null;P.yv=null;
 walkRenderer.camT=null;walkRenderer.yawT=0;walkRenderer.zoomT=zoom||1;return 0})"""
LATE = 'JSON.stringify({n:gpuState.pcl.slice(),names:gpuState.pclNames.slice()})'


def spots(route):
    """the points to stand at: every point of the route, and halfway along each leg longer than SPOT_LEG"""
    out = [route[0]]
    for a, b in zip(route, route[1:]):
        if ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5 > SPOT_LEG:
            out.append([round((a[0] + b[0]) / 2, 2), round((a[1] + b[1]) / 2, 2)])
        out.append(b)
    return out


def page(b, size, errs, init=(), timeout=900000, res=None):
    """a page with the check set-up, the quality pinned and (phone) an Android browser's name, so the game's phone
    limits hold (walk-view-gl.js PHONE: lamps, pixels)"""
    extra = {'user_agent': size['ua']} if size['ua'] else {}
    pin = PIN % (f',resolution:{res}' if res else '')
    return fast.new_page(b, errs, width=size['width'], height=size['height'], mobile=size['mobile'], low=False,
                         timeout=timeout, init=(pin,) + tuple(init), **extra)


def wait_ready(pg, scene, sec=300):
    if not fast.until(pg, f"typeof walkView!=='undefined'&&walkView.ready&&walkRenderer.on&&benchReady({json.dumps(scene)})", sec):
        raise Exception(f'{scene} never got ready')


def settle(pg, scene, n=SETTLE):
    """nothing left to prepare, plant or paint, then n frames"""
    wait_ready(pg, scene, 240)
    fast.frames(pg, n, 600)
    wait_ready(pg, scene, 240)


def renderer(pg):
    return pg.evaluate("(debugLog.glInfo&&debugLog.glInfo().renderer)||''")


# ------------------------------------------------------------------ the path
def run_path(b, base, R):
    errs = []
    init = (PLANT_DRAWS,) if 'draws' in PLANT else ()
    ctx, pg = page(b, PHONE, errs, init, res=PATH_RES)
    try:
        t0 = time.time()
        pg.goto(f'{base}/index.html?test=1&scene=test_graphics')
        wait_ready(pg, 'test_graphics')
        R['boot'] = round(time.time() - t0, 1)
        R['renderer'] = renderer(pg)
        R['conditions'] = pg.evaluate('benchConditions()')
        segs = pg.evaluate('BENCH_SEGMENTS.map(s=>({id:s.id,scene:s.scene,route:s.route,zoom:s.zoom||1,turn:!!s.turn}))')
        if SEGMENTS:
            unknown = [s for s in SEGMENTS if s not in {g['id'] for g in segs}]
            if unknown: raise Exception(f'no such segment: {", ".join(unknown)}')
            segs = [g for g in segs if g['id'] in SEGMENTS]
        bad = [c for c in pg.evaluate('benchPathChecks()') if not c['ok']]
        if bad: raise Exception('the bench path doesn’t walk: ' + '; '.join(f"{c['seg']}: {c['what']}" for c in bad))
        late0 = json.loads(pg.evaluate(LATE))
        seen = list(late0['names'])
        out = {}
        for k, g in enumerate(segs):
            t1 = time.time()
            scene = pg.evaluate(f'{SEG_ENTER}({json.dumps(g["id"])})')
            if k == 0:
                if 'memory' in PLANT: pg.evaluate(PLANT_MEMORY)
            rows = []
            for x, z in spots(g['route']):
                pg.evaluate(f'{STAND}({x},{z},{g["zoom"]})')
                settle(pg, scene)
                if 'compile' in PLANT and k == 0 and not rows: pg.evaluate(PLANT_COMPILE)
                r = pg.evaluate(f'{MEASURE}({COUNT})')
                r['at'] = [x, z]
                rows.append(r)
            late = json.loads(pg.evaluate(LATE))
            new = [n for n in late['names'] if n not in seen]
            seen += new
            walk = None
            if WALK:
                walk = pg.evaluate(f"(async()=>{{const s=benchSegmentById({json.dumps(g['id'])});try{{return await benchWalk(s,{{measure:true,budget:{MB_BUDGET},settle:3000}})}}"
                                   f"catch(e){{return {{error:String(e.message||e)}}}}finally{{benchWalkEnd()}}}})()")
            pg.evaluate('benchWalkEnd();0')
            d = [r['draws'] or 0 for r in rows]
            i = [r['instances'] or 0 for r in rows]
            out[g['id']] = {
                'scene': scene, 'spots': rows,
                'draws': {'mean': round(sum(d) / len(d), 1), 'max': max(d)},
                'instances': {'mean': round(sum(i) / len(i), 1), 'max': max(i)},
                'programs': max(r['programs'] or 0 for r in rows),
                'mb': max(r['mb'] for r in rows),
                'lateCompiles': new,
                'notes': {'msMean': round(sum(r['ms'] for r in rows) / len(rows)), 'seconds': round(time.time() - t1)},
            }
            if walk: out[g['id']]['walk'] = walk
            fast.log(f"path {g['id']:>12}: {len(rows)} spots, draws mean {out[g['id']]['draws']['mean']} max {max(d)}, "
                     f"instances max {max(i)}, {out[g['id']]['mb']} MB" + (f", compiled late: {', '.join(new)}" if new else ''))
        R['segments'] = out
        R['lateCompiles'] = sorted(set(seen) - set(late0['names']))
    finally:
        with LOCK: R.setdefault('pageErrors', []).extend(errs[:10])
        ctx.close()


# ------------------------------------------------------------------ the memory matrix
# a preset's values are read live each frame (only grass.density and world.farProps need the place built again, TD-2,
# and no preset sets them): no rebuild, which took minutes on the desktop page
PRESET_SET = """((key)=>{const P=saveData.preferences||(saveData.preferences={});
 if(key.startsWith('aim:')){P.aim=key.slice(4);P.expert=false;P.eng={}}else{P.aim='sharp';P.expert=true;P.eng=JSON.parse(JSON.stringify(ENGINE_PRESETS[key].v))}
 environment.force={time:15,weather:'clear',season:'summer'};return 0})"""


def metrics(pg, size, dpr):
    """the page's size and device pixel ratio, changed in place (Chrome's device emulation)"""
    cdp = pg.context.new_cdp_session(pg)
    cdp.send('Emulation.setDeviceMetricsOverride', {'width': size['width'], 'height': size['height'],
                                                    'deviceScaleFactor': dpr, 'mobile': size['mobile']})
    return cdp


def memory_reading(pg, scene):
    """graphics memory after the page's new size has been drawn twice. Copperleaf's grass plants for minutes in
    software drawing (about 4 s a frame there), so the wait for a settled place is at most 90 s; a reading taken before
    says `settled: false` (the 300 MB gate is a ceiling: a place still planting can only read lower)"""
    ok = fast.until(pg, f'benchReady({json.dumps(scene)})', 90)
    fast.frames(pg, 2, 600)
    r = pg.evaluate('(()=>{const m=benchMemory();return {mb:m.mb,kinds:m.kinds,canvas:[walkView.cv.width,walkView.cv.height],dpr:devicePixelRatio}})()')
    r['settled'] = ok and pg.evaluate(f'benchReady({json.dumps(scene)})')
    return r


def run_matrix(b, base, R, name, size):
    errs = []
    ctx, pg = page(b, size, errs)
    rows = []
    try:
        pg.goto(f'{base}/index.html?fixture=town')
        if not fast.until(pg, "typeof walkView!=='undefined'&&walkView.ready&&walkRenderer.on&&!!walkView.sc&&walkView.sc.baseId==='copperleaf'", 300):
            raise Exception(f'{name}: Copperleaf never opened')
        if not R.get('renderer'): R['renderer'] = renderer(pg)
        hub = pg.evaluate('walkView.sc.baseId||walkView.id')
        pg.evaluate("environment.force={time:15,weather:'clear',season:'summer'};0")
        # the hub as shipped (Beautiful), at each DPR
        for dpr in (1, 2, 3, 4):
            metrics(pg, size, dpr)
            r = memory_reading(pg, hub)
            r.update(page=name, place='copperleaf', preset='aim:sharp', dprAsked=dpr)
            rows.append(r)
            fast.log(f'matrix {name:>7} Copperleaf, Beautiful, DPR {dpr}: {r["mb"]} MB (canvas {r["canvas"][0]}x{r["canvas"][1]})' + ('' if r['settled'] else ', still planting'))
        # the engine presets on the phone page only: the desktop page draws as many pixels (the 1.6 million cap)
        presets = [('aim:smooth', 'Balanced'), ('aim:sharp', 'Beautiful')] + ([(k, 'Engine: ' + v) for k, v in pg.evaluate(
            'Object.entries(ENGINE_PRESETS).map(([k,P])=>[k,P.name])')] if size['mobile'] else [])
        metrics(pg, size, 1)
        pg.evaluate("(async()=>{await benchOpen('test_graphics');standAt(benchSegmentById('shade'));return 0})()")
        for key, label in presets:
            pg.evaluate(f"{PRESET_SET}({json.dumps(key)})")
            for dpr in PRESET_DPRS:
                metrics(pg, size, dpr)
                r = memory_reading(pg, 'test_graphics')
                r.update(page=name, place='test_graphics', preset=key, label=label, dprAsked=dpr)
                rows.append(r)
                fast.log(f'matrix {name:>7} test_graphics, {label}, DPR {dpr}: {r["mb"]} MB (canvas {r["canvas"][0]}x{r["canvas"][1]})')
            metrics(pg, size, 1)
    finally:
        with LOCK:
            R.setdefault('matrix', []).extend(rows)
            R.setdefault('pageErrors', []).extend(errs[:5])
        ctx.close()


# ------------------------------------------------------------------ the gates
def over(now, was, floor):
    return was is not None and now is not None and now > was * (1 + GROW) and now - was >= floor


def gates(R, B):
    """[problems], [notes]: R this run, B the baseline (None: none yet)"""
    problems, notes = [], []
    if 'SwiftShader' not in (R.get('renderer') or ''):
        problems.append(f"the renderer isn’t SwiftShader ({R.get('renderer')!r}): the counts were made on it")
    elif B and B.get('renderer') and B['renderer'] != R.get('renderer'):
        notes.append(f"renderer string changed: {B['renderer']!r} → {R['renderer']!r}")
    for r in R.get('matrix', []):
        if r['page'] == 'phone' and r['mb'] > MB_BUDGET:
            problems.append(f"memory: {r['place']} {r.get('label', r['preset'])} at DPR {r['dprAsked']} on a phone is {r['mb']} MB, over {MB_BUDGET} MB")
    segs = R.get('segments', {})
    base = (B or {}).get('segments', {})
    # memory builds up along the path (the figures' pictures stay), so it is compared only on a whole run
    same_res = (not B or B.get('res', PATH_RES) == PATH_RES) and not SEGMENTS
    if SEGMENTS: notes.append('memory not compared: some segments only (it builds up along the whole path)')
    elif not same_res: notes.append(f"memory not compared: the baseline was made at resolution {B.get('res')}, this run at {PATH_RES}")
    known_over = set((B or {}).get('overBudget', []))
    for sid, s in segs.items():
        if s['draws']['max'] > DRAW_BUDGET:
            msg = f"{sid}: {s['draws']['max']} draws a frame, over the phone budget of {DRAW_BUDGET}"
            (notes if sid in known_over else problems).append(msg + (' (known: in the baseline)' if sid in known_over else ''))
        b = base.get(sid)
        if not b:
            if B: notes.append(f'{sid}: not in the baseline yet')
            continue
        for k in ('draws', 'instances'):
            for m in ('mean', 'max'):
                if over(s[k][m], b[k][m], FLOOR[k]):
                    problems.append(f"{sid}: {k} a frame ({m}) {b[k][m]} → {s[k][m]}, more than {round(GROW * 100)}% up")
        if same_res and over(s['mb'], b['mb'], FLOOR['mb']):
            problems.append(f"{sid}: graphics memory {b['mb']} → {s['mb']} MB, more than {round(GROW * 100)}% up")
    if B is not None:
        new = [n for n in R.get('lateCompiles', []) if n not in set(B.get('lateCompiles', []))]
        if new: problems.append('programs compiled after the place settled (a warm-up missed them): ' + ', '.join(new))
    return problems, notes


def baseline_of(R, B):
    """what the baseline keeps: per segment its counts and memory, the late compiles, the segments over the budget"""
    segs = dict((B or {}).get('segments', {})) if SEGMENTS else {}
    for sid, s in R.get('segments', {}).items():
        segs[sid] = {'draws': s['draws'], 'instances': s['instances'], 'mb': s['mb'], 'scene': s['scene']}
    return {
        'made': time.strftime('%Y-%m-%d'), 'renderer': R.get('renderer'), 'page': [PHONE['width'], PHONE['height'], 'phone'], 'res': PATH_RES,
        'segments': segs,
        'overBudget': sorted(k for k, s in segs.items() if s['draws']['max'] > DRAW_BUDGET),
        'lateCompiles': sorted(set(R.get('lateCompiles', [])) | (set((B or {}).get('lateCompiles', [])) if SEGMENTS else set())),
        'matrix': {f"{r['page']} {r['place']} {r['preset']} dpr{r['dprAsked']}": r['mb'] for r in R.get('matrix', [])} or (B or {}).get('matrix', {}),
    }


LOCK = threading.Lock()


def main():
    if '--routes' in ARGS: return routes_main()
    if '--island' in ARGS: return island_main()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('Install Playwright first:  pip install -r tools/requirements-check.txt && python3 -m playwright install chromium'); sys.exit(1)
    if PLANT and MAKE_BASELINE: print('--plant and --baseline together would bake the regression in'); sys.exit(2)
    unknown = [p for p in PLANT if p not in ('draws', 'memory', 'compile')]
    if unknown: print(f'--plant: no such regression: {", ".join(unknown)}'); sys.exit(2)
    import subprocess
    subprocess.run(['node', str(ROOT / 'tools' / 'build-data.mjs')], check=True)
    OUT.mkdir(parents=True, exist_ok=True)
    R = {'when': time.strftime('%Y-%m-%d %H:%M'), 'plant': PLANT, 'segmentsAsked': SEGMENTS or None}
    jobs = []
    if ONLY in (None, 'path'): jobs.append(('path', lambda b, base: run_path(b, base, R)))
    if ONLY in (None, 'matrix') and not SEGMENTS:
        jobs.append(('matrix phone', lambda b, base: run_matrix(b, base, R, 'phone', PHONE)))
        jobs.append(('matrix desktop', lambda b, base: run_matrix(b, base, R, 'desktop', DESKTOP)))
    srv, base = fast.serve(fast.GAME)
    failed = []
    q = queue.Queue()
    for j in jobs: q.put(j)

    def worker():
        with sync_playwright() as pw:
            b = pw.chromium.launch(args=fast.LAUNCH)
            while True:
                try: name, fn = q.get_nowait()
                except queue.Empty: break
                try: fn(b, base)
                except Exception as e:
                    with LOCK: failed.append(f'{name}: {str(e).splitlines()[0][:300]}')
            b.close()

    # each page in a browser of its own, side by side (the path is the longest, about 20 minutes)
    threads = [threading.Thread(target=worker) for _ in range(len(jobs))]
    for t in threads: t.start()
    for t in threads: t.join()
    srv.shutdown()
    B = json.loads(BASELINE.read_text()) if BASELINE.exists() else None
    problems, notes = gates(R, B)
    problems = failed + problems
    if R.get('pageErrors'): problems.append(f"page errors: {len(R['pageErrors'])} (first: {R['pageErrors'][0][:200]})")
    if B is None and not MAKE_BASELINE: notes.append(f'no baseline yet ({BASELINE.relative_to(ROOT)}): run with --baseline')
    if MAKE_BASELINE:
        if failed: print('not writing the baseline: a part of the run failed'); problems.append('baseline not written')
        else:
            BASELINE.write_text(json.dumps(baseline_of(R, B), indent=1) + '\n')
            notes.append(f'baseline written: {BASELINE.relative_to(ROOT)}')
            problems = [p for p in problems if 'over the phone budget' not in p]   # it records them as known
    R.update({'problems': problems, 'notes': notes, 'seconds': round(time.time() - fast.T0)})
    (OUT / 'results.json').write_text(json.dumps(R, indent=1))
    fast.log(f'done in {R["seconds"]}s: ' + ('no problems' if not problems else f'{len(problems)} problem(s)'))
    for p in problems: print('  PROBLEM', p)
    for n in notes: print('  note', n)
    sys.exit(1 if problems else 0)


# ------------------------------------------------------------------ --routes (was tools/route-perf.py, routes track RT-1)
# Each plan opens ?fixture=layout&plan=<plan> (the run fixture standing on its landing, every laid-out place given that
# plan; `none` is the open field as before RT-1), stands at 6 spots along the way west (the hub to the west exit) at
# 390 x 760, lets the camera settle, then counts every graphics call for --frames frames. Low graphics by default (as
# phase 20 asks of headless graphics runs); --full the game's own defaults.
ROUTE_MEASURE = """(async (n)=>{
 const R=walkRenderer, f0=R.frames, t0=performance.now();
 gpuCountBegin();
 await new Promise(ok=>{const tick=()=>{if(R.frames-f0>=n)ok();else requestAnimationFrame(tick)};requestAnimationFrame(tick)});
 const g=gpuCountEnd();
 return {ms:Math.round((performance.now()-t0)/(R.frames-f0)*10)/10, draws:g&&g.dc[0], inst:g&&g.dc[1],
  passes:g&&g.dcp, cull:[R.culled||0,R.cullOf||0]}})"""
# six spots on the way west, from the hub to the west exit (its edge path), 15% to 90% along: the place's own scene
# (the view is the seamless world round it, the place moved by baseOff)
ROUTE_SPOTS = """(()=>{const V=walkView.sc,sc=(V.baseId&&mapById(V.baseId))||V,O=V.baseOff||[0,0],
 e=(sc.edgeExits||[]).filter(e=>e.side==='W')[0]||sc.edgeExits[0],P=e.path.map(p=>[p[0]+O[0],p[1]+O[1]]);
 const L=[0];for(let i=1;i<P.length;i++)L.push(L[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]));
 const out=[];for(const f of [0.15,0.3,0.45,0.6,0.75,0.9]){const d=f*L[L.length-1];let i=1;while(i<P.length-1&&L[i]<d)i++;
 const t=(d-L[i-1])/((L[i]-L[i-1])||1);out.push([P[i-1][0]+(P[i][0]-P[i-1][0])*t,P[i-1][1]+(P[i][1]-P[i-1][1])*t])}
 return {spots:out,props:sc.props.length,canopy:sc.props.filter(p=>/canopy/.test(p.k)).length,layout:sc.layout||null}})()"""


def routes_main():
    from playwright.sync_api import sync_playwright
    full = '--full' in ARGS
    out, shots = arg('out'), arg('shots')
    n = int(arg('frames', 20))
    plans = arg('plans', 'none,forest,farmland,lakeside,ledges,lanes').split(',')
    W, H = 390, 760
    srv, base = fast.serve(fast.GAME)
    res, errs = {}, []
    t0 = time.time()
    if shots: Path(shots).mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=fast.LAUNCH)
        for plan in plans:
            ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1)
            for s in (fast.CLOCK, fast.NO_ACCOUNTS, fast.TEST_GLOBALS) + (() if full else (fast.LOW_GRAPHICS,)):
                ctx.add_init_script(s)
            ctx.set_default_timeout(600000)
            pg = ctx.new_page()
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(f'{base}/index.html?fixture=layout&plan={plan}')
            if not fast.until(pg, "typeof walkView!=='undefined'&&walkView.ready&&walkRenderer.on&&!!walkView.sc&&!!walkView.sc.baseId&&!!mapById(walkView.sc.baseId)", 300):
                raise Exception(f'{plan}: the run never opened')
            info = pg.evaluate(ROUTE_SPOTS)
            rows = []
            for k, (x, z) in enumerate(info['spots']):
                fast.stand(pg, round(x, 2), round(z, 2), frames=12)
                r = pg.evaluate(f'{ROUTE_MEASURE}({n})')
                r.update(x=round(x, 1), z=round(z, 1))
                rows.append(r)
                if shots: pg.screenshot(path=str(Path(shots) / f'{plan}_{k}.png'))
            d = [r['draws'] for r in rows]
            res[plan] = {'props': info['props'], 'canopy': info['canopy'], 'layout': info['layout'], 'spots': rows,
                         'drawsMean': round(sum(d) / len(d)), 'drawsMax': max(d)}
            print(f"[{time.time() - t0:5.0f}s] {plan:>8}: {info['props']} props ({info['canopy']} canopy), draws mean "
                  f"{res[plan]['drawsMean']}, max {max(d)}; ms mean {sum(r['ms'] for r in rows) / len(rows):.1f}; "
                  f"walk {(info['layout'] or {}).get('walk', '-')}", flush=True)
            ctx.close()
        b.close()
    srv.shutdown()
    print(f'page errors: {len(errs)}' + (f' (first: {errs[0][:200]})' if errs else ''))
    if out: Path(out).write_text(json.dumps({'full': full, 'size': [W, H], 'plans': res, 'pageErrors': errs[:10]}, indent=1))


# ------------------------------------------------------------------ --island (was tools/island-perf.py, island track IS-9)
# At 8 places round the hub island's coast (the spots of tools/island-shots.py) it lets the camera settle, then counts
# every graphics call for --frames frames (default 30) and times them. --square (HB-10c): at the hub on the square, by
# hour (--hours) and the Engine's quality.townFolk (--folk). The game's own graphics defaults; --low the fast check's.
ISLAND_MEASURE = """(async (n)=>{
 const R=walkRenderer, f0=R.frames, t0=performance.now();
 gpuCountBegin();
 const times=[]; let last=t0, lf=f0;
 await new Promise(ok=>{const tick=()=>{if(R.frames>lf){const t=performance.now();times.push((t-last)/(R.frames-lf));last=t;lf=R.frames}
  if(R.frames-f0>=n)ok();else requestAnimationFrame(tick)};requestAnimationFrame(tick)});
 const g=gpuCountEnd(); times.sort((a,b)=>a-b);
 return {ms:Math.round((performance.now()-t0)/(R.frames-f0)*10)/10, p90:Math.round(times[Math.floor(times.length*.9)]*10)/10,
  draws:g&&g.dc[0], inst:g&&g.dc[1], programs:g&&g.dc[2], passes:g&&g.dcp,
  cull:[R.culled||0,R.cullOf||0], groundTris:R.mesh?Math.round(R.mesh.n/3):null, yaw:R.orbit?Math.round(R.orbit.yaw*180/Math.PI):null}})"""


def island_main():
    from importlib import import_module
    from playwright.sync_api import sync_playwright
    shots = import_module('island-shots')
    low, out, scene = '--low' in ARGS, arg('out'), arg('scene', 'copperleaf')
    n = int(arg('frames', 30))
    square = '--square' in ARGS
    folk = [int(v) for v in arg('folk', '0,6,8,10').split(',')]
    hours = [float(v) for v in arg('hours', '12.5,21').split(',')]
    srv, base = fast.serve(fast.GAME)
    rows, errs = [], []
    t0 = time.time()
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=fast.LAUNCH)
        ctx = b.new_context(viewport={'width': shots.W, 'height': shots.H}, device_scale_factor=1)
        for s in (fast.CLOCK, fast.NO_ACCOUNTS, fast.TEST_GLOBALS) + ((fast.LOW_GRAPHICS,) if low else ()): ctx.add_init_script(s)
        ctx.set_default_timeout(600000)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        url = f'{base}/index.html?fixture=town' if scene == 'copperleaf' else f'{base}/index.html?test=1&scene={scene}'
        pg.goto(url)
        if not fast.until(pg, f"typeof walkView!=='undefined'&&walkView.ready&&walkRenderer.on&&(walkView.sc.baseId||walkView.id)==='{scene}'", 300):
            raise Exception('the island never opened')
        boot = round(time.time() - t0, 1)
        shots.settle(pg, 10)
        if square:
            hub = pg.evaluate('mapHub(walkView.sc)')
            fast.stand(pg, hub[0], hub[1], frames=8)
            for h in hours:
                pg.evaluate(f"environment.force={{time:{h},weather:'clear',season:'summer'}};walkView.folkId='';0")
                for f in folk:
                    pg.evaluate(f'ENGINE_DEFAULTS.quality.townFolk={f};0')
                    shots.settle(pg, 12)
                    r = pg.evaluate(f'{ISLAND_MEASURE}({n})')
                    r.update(at=f'{h:g}h folk {f}', hour=h, townFolk=f, folk=pg.evaluate('walkView.folk.length'))
                    rows.append(r)
                    print(f"[{time.time() - t0:5.0f}s] {r['at']:>14}: {r['ms']:6.1f} ms/frame (p90 {r['p90']}), {r['draws']} draws, "
                          f"{r['inst']} instances, {r['folk']} folk drawn", flush=True)
            pg.evaluate('ENGINE_DEFAULTS.quality.townFolk=10;environment.force=null;0')
        for k, nm in enumerate([] if square else shots.COMPASS):
            x, z = pg.evaluate(f'{shots.COAST_SPOT}({k * 45})')
            fast.stand(pg, x, z, frames=12)
            r = pg.evaluate(f'{ISLAND_MEASURE}({n})')
            r.update(at=nm, x=round(x, 1), z=round(z, 1))
            rows.append(r)
            print(f"[{time.time() - t0:5.0f}s] {nm:>2}: {r['ms']:6.1f} ms/frame (p90 {r['p90']}), {r['draws']} draws, "
                  f"{r['inst']} instances, props drawn {r['cull'][1] - r['cull'][0]} of {r['cull'][1]}", flush=True)
        b.close()
    srv.shutdown()
    res = {'scene': scene, 'low': low, 'size': [shots.W, shots.H], 'bootSeconds': boot, 'angles': rows, 'pageErrors': errs[:10]}
    ms = [r['ms'] for r in rows]
    print(f"mean {sum(ms) / len(ms):.1f} ms, worst {max(ms):.1f} ms ({rows[ms.index(max(ms))]['at']}); boot {boot} s; page errors: {len(errs)}")
    if out: Path(out).write_text(json.dumps(res, indent=1))


if __name__ == '__main__':
    main()

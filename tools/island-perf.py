#!/usr/bin/env python3
"""Island track IS-9: what drawing the hub island (Copperleaf) costs at 8 places round its coast, headless.

    python3 tools/island-perf.py                 # 390 x 760, the game's own graphics defaults
    python3 tools/island-perf.py --low           # the fast check's low graphics
    python3 tools/island-perf.py --out=FILE.json # also write the numbers to a file
    python3 tools/island-perf.py --scene=test_island
    python3 tools/island-perf.py --frames=10     # fewer frames a place (default 30; full graphics headless is slow)
    python3 tools/island-perf.py --square        # HB-10c: at the hub on the square instead, by hour and townsfolk
    python3 tools/island-perf.py --square --folk=0,6,10 --hours=12.5,21   # (default folk 0,6,8,10; hours 12.5,21)

At each place (the same spots as tools/island-shots.py: by the coast road N, NE ... NW of the middle) it lets the
camera settle, then for 30 frames (--frames) counts every graphics call (engine/gpu-counters.js, as the debug log does) and times
the frames. Headless Chromium draws in software (SwiftShader), so the milliseconds are only good for comparing one
angle or one build with another; the draw calls, instances and triangles are what carries over to a phone. Run
`npm run data` first. Nothing is sent anywhere."""
import json, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from importlib import import_module
import browser_check as fast  # noqa: E402  (the browser checks' page set-up)
shots = import_module('island-shots')

ARGS = sys.argv[1:]
LOW = '--low' in ARGS
OUT = next((a.split('=', 1)[1] for a in ARGS if a.startswith('--out=')), None)
SCENE = next((a.split('=', 1)[1] for a in ARGS if a.startswith('--scene=')), 'copperleaf')
FRAMES = int(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--frames=')), 30))

SQUARE = '--square' in ARGS
FOLK = [int(v) for v in next((a.split('=', 1)[1] for a in ARGS if a.startswith('--folk=')), '0,6,8,10').split(',')]
HOURS = [float(v) for v in next((a.split('=', 1)[1] for a in ARGS if a.startswith('--hours=')), '12.5,21').split(',')]

MEASURE = """(async (n)=>{
 const R=walkRenderer, f0=R.frames, t0=performance.now();
 gpuCountBegin();
 const times=[]; let last=t0, lf=f0;
 await new Promise(ok=>{const tick=()=>{if(R.frames>lf){const t=performance.now();times.push((t-last)/(R.frames-lf));last=t;lf=R.frames}
  if(R.frames-f0>=n)ok();else requestAnimationFrame(tick)};requestAnimationFrame(tick)});
 const g=gpuCountEnd(); times.sort((a,b)=>a-b);
 return {ms:Math.round((performance.now()-t0)/(R.frames-f0)*10)/10, p90:Math.round(times[Math.floor(times.length*.9)]*10)/10,
  draws:g&&g.dc[0], inst:g&&g.dc[1], programs:g&&g.dc[2], passes:g&&g.dcp,
  cull:[R.culled||0,R.cullOf||0], groundTris:R.mesh?Math.round(R.mesh.n/3):null, yaw:R.orbit?Math.round(R.orbit.yaw*180/Math.PI):null}})"""


def square(pg, rows, t0):
    """HB-10c: at the hub, the square in view, at each hour (clear summer weather) with the Engine's quality.townFolk
    at each count: the townsfolk drawn, the lights lit and what it costs"""
    hub = pg.evaluate('mapHub(walkView.sc)')
    fast.stand(pg, hub[0], hub[1], frames=8)
    for h in HOURS:
        pg.evaluate(f"environment.force={{time:{h},weather:'clear',season:'summer'}};walkView.folkId='';0")
        for n in FOLK:
            pg.evaluate(f'ENGINE_DEFAULTS.quality.townFolk={n};0')
            shots.settle(pg, 12)
            r = pg.evaluate(f'{MEASURE}({FRAMES})')
            r.update(at=f'{h:g}h folk {n}', hour=h, townFolk=n, folk=pg.evaluate('walkView.folk.length'))
            rows.append(r)
            print(f"[{time.time() - t0:5.0f}s] {r['at']:>14}: {r['ms']:6.1f} ms/frame (p90 {r['p90']}), {r['draws']} draws, "
                  f"{r['inst']} instances, {r['folk']} folk drawn", flush=True)
    pg.evaluate('ENGINE_DEFAULTS.quality.townFolk=10;environment.force=null;0')


def main():
    from playwright.sync_api import sync_playwright
    srv, base = fast.serve(fast.GAME)
    rows, errs = [], []
    t0 = time.time()
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=fast.LAUNCH)
        ctx = b.new_context(viewport={'width': shots.W, 'height': shots.H}, device_scale_factor=1)
        for s in (fast.CLOCK, fast.NO_ACCOUNTS, fast.TEST_GLOBALS) + ((fast.LOW_GRAPHICS,) if LOW else ()): ctx.add_init_script(s)
        ctx.set_default_timeout(600000)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        url = f'{base}/index.html?fixture=town' if SCENE == 'copperleaf' else f'{base}/index.html?test=1&scene={SCENE}'
        pg.goto(url)
        if not fast.until(pg, f"typeof walkView!=='undefined'&&walkView.ready&&walkRenderer.on&&(walkView.sc.baseId||walkView.id)==='{SCENE}'", 300):
            raise Exception('the island never opened')
        boot = round(time.time() - t0, 1)
        shots.settle(pg, 10)
        if SQUARE:
            square(pg, rows, t0)
        for k, nm in enumerate([] if SQUARE else shots.COMPASS):
            x, z = pg.evaluate(f'{shots.COAST_SPOT}({k * 45})')
            fast.stand(pg, x, z, frames=12)
            r = pg.evaluate(f'{MEASURE}({FRAMES})')
            r.update(at=nm, x=round(x, 1), z=round(z, 1))
            rows.append(r)
            print(f"[{time.time() - t0:5.0f}s] {nm:>2}: {r['ms']:6.1f} ms/frame (p90 {r['p90']}), {r['draws']} draws, "
                  f"{r['inst']} instances, props drawn {r['cull'][1] - r['cull'][0]} of {r['cull'][1]}", flush=True)
        b.close()
    srv.shutdown()
    res = {'scene': SCENE, 'low': LOW, 'size': [shots.W, shots.H], 'bootSeconds': boot, 'angles': rows, 'pageErrors': errs[:10]}
    ms = [r['ms'] for r in rows]
    print(f"mean {sum(ms) / len(ms):.1f} ms, worst {max(ms):.1f} ms ({rows[ms.index(max(ms))]['at']}); boot {boot} s; page errors: {len(errs)}")
    if OUT: Path(OUT).write_text(json.dumps(res, indent=1))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Routes track RT-1: what drawing a laid-out run route costs, plan by plan, headless.

    python3 tools/route-perf.py                    # every plan and the open field (none), the fast check's low graphics
    python3 tools/route-perf.py --plans=none,forest
    python3 tools/route-perf.py --full             # the game's own graphics defaults (slow headless)
    python3 tools/route-perf.py --frames=10        # fewer frames a spot (default 20)
    python3 tools/route-perf.py --shots=DIR        # also a picture at each spot
    python3 tools/route-perf.py --out=FILE.json

Each plan opens ?fixture=layout&plan=<plan> (the run fixture standing on its landing, every laid-out place given that
plan; `none` is the open field as before RT-1), stands at 6 spots along the way west (the hub to the west exit) at
phone size (390 x 760), lets the camera settle, then counts every graphics call for --frames frames
(engine/gpu-counters.js, as the debug log does). Headless Chromium draws in software (SwiftShader), so the
milliseconds only compare one plan with another; the draw calls and instances are what carry over to a phone (the
phone budget: 400 draws a frame, docs/phases/20-renderer-batching.md). Low graphics by default, as phase 20 asks of
headless graphics runs. Run `npm run data` first. Nothing is sent anywhere."""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import browser_check as fast  # noqa: E402  (the browser checks' page set-up)

ARGS = sys.argv[1:]
FULL = '--full' in ARGS
OUT = next((a.split('=', 1)[1] for a in ARGS if a.startswith('--out=')), None)
SHOTS = next((a.split('=', 1)[1] for a in ARGS if a.startswith('--shots=')), None)
FRAMES = int(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--frames=')), 20))
PLANS = next((a.split('=', 1)[1] for a in ARGS if a.startswith('--plans=')),
             'none,forest,farmland,lakeside,ledges,lanes').split(',')
W, H = 390, 760

MEASURE = """(async (n)=>{
 const R=walkRenderer, f0=R.frames, t0=performance.now();
 gpuCountBegin();
 await new Promise(ok=>{const tick=()=>{if(R.frames-f0>=n)ok();else requestAnimationFrame(tick)};requestAnimationFrame(tick)});
 const g=gpuCountEnd();
 return {ms:Math.round((performance.now()-t0)/(R.frames-f0)*10)/10, draws:g&&g.dc[0], inst:g&&g.dc[1],
  passes:g&&g.dcp, cull:[R.culled||0,R.cullOf||0]}})"""
# six spots on the way west, from the hub to the west exit (its edge path), 15% to 90% along: the place's own scene
# (the view is the seamless world round it, the place moved by baseOff)
SPOTS = """(()=>{const V=walkView.sc,sc=(V.baseId&&mapById(V.baseId))||V,O=V.baseOff||[0,0],
 e=(sc.edgeExits||[]).filter(e=>e.side==='W')[0]||sc.edgeExits[0],P=e.path.map(p=>[p[0]+O[0],p[1]+O[1]]);
 const L=[0];for(let i=1;i<P.length;i++)L.push(L[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]));
 const out=[];for(const f of [0.15,0.3,0.45,0.6,0.75,0.9]){const d=f*L[L.length-1];let i=1;while(i<P.length-1&&L[i]<d)i++;
 const t=(d-L[i-1])/((L[i]-L[i-1])||1);out.push([P[i-1][0]+(P[i][0]-P[i-1][0])*t,P[i-1][1]+(P[i][1]-P[i-1][1])*t])}
 return {spots:out,props:sc.props.length,canopy:sc.props.filter(p=>/canopy/.test(p.k)).length,layout:sc.layout||null}})()"""


def main():
    from playwright.sync_api import sync_playwright
    srv, base = fast.serve(fast.GAME)
    res, errs = {}, []
    t0 = time.time()
    if SHOTS: Path(SHOTS).mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=fast.LAUNCH)
        for plan in PLANS:
            ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1)
            for s in (fast.CLOCK, fast.NO_ACCOUNTS, fast.TEST_GLOBALS) + (() if FULL else (fast.LOW_GRAPHICS,)):
                ctx.add_init_script(s)
            ctx.set_default_timeout(600000)
            pg = ctx.new_page()
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(f'{base}/index.html?fixture=layout&plan={plan}')
            if not fast.until(pg, "typeof walkView!=='undefined'&&walkView.ready&&walkRenderer.on&&!!walkView.sc&&!!walkView.sc.baseId&&!!mapById(walkView.sc.baseId)", 300):
                raise Exception(f'{plan}: the run never opened')
            info = pg.evaluate(SPOTS)
            rows = []
            for k, (x, z) in enumerate(info['spots']):
                fast.stand(pg, round(x, 2), round(z, 2), frames=12)
                r = pg.evaluate(f'{MEASURE}({FRAMES})')
                r.update(x=round(x, 1), z=round(z, 1))
                rows.append(r)
                if SHOTS: pg.screenshot(path=str(Path(SHOTS) / f'{plan}_{k}.png'))
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
    if OUT: Path(OUT).write_text(json.dumps({'full': FULL, 'size': [W, H], 'plans': res, 'pageErrors': errs[:10]}, indent=1))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Pictures of the water, for the water track's picture notes (docs/phases/water-track.md, WA-0): nothing is judged
here; software drawing can't judge a look. Opens a test scene (default test_water: every kind of water, stepped
pools, a stream down terraces, a 6 m fall into a plunge pool) at phone size with the game's own graphics, stands at
each of the scene's `shots` and takes a picture of the walk view's canvas. A scene without shots (test_island) gets
four spots by its water instead. The numbers (water cells, the water mesh's triangles, fall sheets, kinds present,
mirror levels, the water settings the game data changes) go to OUT/notes-<scene>.json, so a session can compare before and after.

    python3 tools/look-water.py                       # every shot of test_water at noon, in validation/look-water/
    python3 tools/look-water.py --only=tall-fall,sea  # only the shots whose names hold these words
    python3 tools/look-water.py --hour=22.5           # another time of day (night: the moon, the lamps)
    python3 tools/look-water.py --scene=test_island   # another scene (here: the sea all round, IS-3)
    python3 tools/look-water.py --low                 # the fast check's low graphics
    python3 tools/look-water.py --out=DIR             # somewhere else (a "before" set from another worktree)

Run `npm run data` first (the page reads game/data/gamedata.js). Uses the browser checks' page set-up
(tools/browser_check.py: the clock, no accounts, the test globals). Nothing is sent anywhere."""
import json, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import browser_check as CF  # noqa: E402

ROOT = CF.ROOT
ARGS = sys.argv[1:]
ONLY = next((a.split('=', 1)[1].split(',') for a in ARGS if a.startswith('--only=')), None)
OUT = Path(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--out=')), ROOT / 'validation' / 'look-water'))
SCENE = next((a.split('=', 1)[1] for a in ARGS if a.startswith('--scene=')), 'test_water')
HOUR = float(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--hour=')), 12.5))
LOW = '--low' in ARGS
W, H = 390, 760

# everything on the page but the walk view's canvas hidden (as tools/island-shots.py does)
HIDE_HUD = """(()=>{const cv=walkView.cv;for(const el of document.body.querySelectorAll('*'))
 if(el!==cv&&!el.contains(cv))el.style.setProperty('visibility','hidden','important');
 for(let e=cv;e;e=e.parentElement)e.style.setProperty('visibility','visible','important');return 0})()"""

# the scene's shots, or (none) four walkable spots 1.5 m off its water, spread through the list of water tiles
SPOTS = """(()=>{const S=(walkView.sc.shots||[]).map(s=>({label:s.label,x:s.x,z:s.z,yaw:s.yaw||0}));if(S.length)return S;
 const wt=walkView.water||[];const out=[];for(const f of [.15,.4,.65,.9]){const w=wt[Math.floor(wt.length*f)];if(!w)continue;
  const p=walkablePointNear(w[0]-1.5,w[1]-1.5);if(p)out.push({label:'water-'+Math.round(f*100),x:p[0],z:p[1],yaw:0})}return out})()"""

# what the renderer built for the scene's water (walk/ground-mesh.js): the counts a later session compares against
WATER_NUMBERS = """(()=>{const T=walkRenderer,G=T.wgrid,K={};
 if(G)for(let q=0;q<G.kind.length;q++)if(G.dep[q]>0||G.y[q]!==0){const k=(WATER_KIND_LOOKS[G.kind[q]]||{}).k||G.kind[q];K[k]=(K[k]||0)+1}
 return {tiles:(walkView.water||[]).length,triangles:T.water?Math.round(T.water.n/3):0,fallSheets:(T.falls||[]).length,
  fallTriangles:T.fallMesh?Math.round(T.fallMesh.n/3):0,tallestFall:+Math.max(0,...(T.falls||[]).map(f=>f[3])).toFixed(2),
  halfMetreCells:K,mirrorLevels:(T.wlevels||[]).length,fishHomes:(T.fishHomes||[]).length,streams:(walkView.sc.streams||[]).length,
  seaAllRound:!!walkView.sc.flatFar,settingsChanged:Object.assign({},(gameData.engine.defaults||{}).water||{})}})()"""


def settle(pg, x, z, yaw, frames=12):
    """you at a spot, the camera snapped there at this turn (no glide), then a few frames"""
    pg.evaluate(f"(()=>{{const P=walkView.pl;P.x={x};P.z={z};P.route=null;P.yv=null;walkRenderer.yaw=walkRenderer.yawT={yaw};walkRenderer.camT=null;walkRenderer.focus=null;return 0}})()")
    f0 = pg.evaluate('walkRenderer.frames')
    if not CF.until(pg, f'walkRenderer.frames>={f0 + frames}', 300): raise Exception(f'{SCENE} isn’t drawing')


def main():
    from playwright.sync_api import sync_playwright
    OUT.mkdir(parents=True, exist_ok=True)
    srv, base = CF.serve(CF.GAME)
    errs, notes, t0 = [], {'scene': SCENE, 'hour': HOUR, 'low': LOW, 'shots': []}, time.time()
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=CF.LAUNCH)
        ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1)
        for s in (CF.CLOCK, CF.NO_ACCOUNTS, CF.TEST_GLOBALS) + ((CF.LOW_GRAPHICS,) if LOW else ()): ctx.add_init_script(s)
        ctx.set_default_timeout(240000)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'{base}/index.html?test=1&scene={SCENE}')
        if not CF.until(pg, f"typeof walkView!=='undefined'&&walkView.ready&&walkRenderer.on&&(walkView.sc.baseId||walkView.id)==='{SCENE}'", 240):
            raise Exception(f'{SCENE} never opened')
        pg.evaluate("(()=>{if(typeof uiState!=='undefined'){uiState.modal=null;uiState.mq=[]}const D=gameData.engine.defaults;D.quality=Object.assign({},D.quality||{},{auto:false});return 0})()")
        pg.evaluate(f"(()=>{{environment.force=Object.assign({{}},environment.force||{{}},{{time:{HOUR},weather:'clear'}});walkRenderer.adaptT=0;walkRenderer.q=0;walkView.R=1;return 0}})()")
        # the ground and its water are built a slice at a time (walk/map-cache.js): wait for the water grid
        if not CF.until(pg, '!!walkRenderer.wgrid', 240): raise Exception(f'{SCENE}: the water was never built')
        pg.evaluate(HIDE_HUD)
        for s in pg.evaluate(SPOTS):
            if ONLY and not any(w in s['label'] for w in ONLY): continue
            settle(pg, s['x'], s['z'], s['yaw'])
            name = f"{SCENE}-{s['label']}" + (f'-h{HOUR:g}' if HOUR != 12.5 else '')
            pg.screenshot(path=str(OUT / f'{name}.png'))
            notes['shots'].append({'name': name, 'at': [round(s['x'], 2), round(s['z'], 2)], 'yaw': s['yaw']})
            print(f'[{time.time() - t0:5.0f}s] {name}', flush=True)
        notes['water'] = pg.evaluate(WATER_NUMBERS)
        ctx.close(); b.close()
    srv.shutdown()
    notes['errors'] = errs[:6]
    (OUT / f'notes-{SCENE}.json').write_text(json.dumps(notes, indent=2))
    print(json.dumps(notes['water']))
    if errs: print('page errors:', errs[:3])


if __name__ == '__main__':
    main()

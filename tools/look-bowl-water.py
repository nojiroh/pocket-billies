#!/usr/bin/env python3
"""Pictures of the world map's water and a battle by water, for the water track's lane B notes (docs/phases/water-track.md,
WA-7): nothing is judged here; software drawing can't judge a look. Opens the run fixture's world map (the bowl: the
sea, its coasts, lakes, rivers and each place's own water) at phone size and takes the map's canvas from a few fixed
cameras, then the hub's map (Copperleaf's island in open sky: no sea), each with Pixel water on and off. `--battle`
adds a wild battle beside water on the first run place that has some. The numbers (the cameras, the water mesh's triangles, the
rivers, the battle's facing) go to OUT/notes.json, so a session can compare before and after.

    python3 tools/look-bowl-water.py                 # every shot, in validation/look-water-bowl/
    python3 tools/look-bowl-water.py --only=coast    # only the shots whose names hold these words
    python3 tools/look-bowl-water.py --battle        # and a battle by the water
    python3 tools/look-bowl-water.py --out=DIR       # somewhere else (a "before" set)

Run `npm run data` first (the page reads game/data/gamedata.js). Uses the browser checks' page set-up
(tools/browser_check.py: the clock, no accounts, the test globals). Nothing is sent anywhere."""
import json, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import browser_check as CF  # noqa: E402

ROOT = CF.ROOT
ARGS = sys.argv[1:]
ONLY = next((a.split('=', 1)[1].split(',') for a in ARGS if a.startswith('--only=')), None)
OUT = Path(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--out=')), ROOT / 'validation' / 'look-water-bowl'))
BATTLE = '--battle' in ARGS
W, H = 390, 760
NAV = "document.querySelector('#nav')?.shadowRoot?.querySelector('button[data-t={t}]')"

# everything on the page but some canvases hidden (the map draws on the GL canvas, its pins and names on its own) (as look-water.py does for the walk view)
HIDE_BUT = """((...cvs)=>{cvs=cvs.filter(Boolean);for(const el of document.body.querySelectorAll('*'))el.style.removeProperty('visibility');
 for(const el of document.body.querySelectorAll('*'))if(!cvs.some(cv=>el===cv||el.contains(cv)))el.style.setProperty('visibility','hidden','important');
 for(const cv of cvs)for(let e=cv;e;e=e.parentElement)e.style.setProperty('visibility','visible','important');return 0})"""
SHOW_ALL = "(()=>{for(const el of document.body.querySelectorAll('*'))el.style.removeProperty('visibility');return 0})()"

# the run's bowl: cameras over its water. The coast: the sea cell next to land nearest the landing; the river: the
# middle of the longest; each also as close as the camera may come at its lowest tilt (the sky in the water); the
# place: the landing (its own map's water shows there)
CAMS = """(()=>{const g=worldBowl.ground,G=g.G,me=worldBowl.spots[saveData.trip.node],out=[];
 const near=d=>bowlCamClamp(Object.assign({},d,{dist:0})).dist;
 const at=(label,x,y,k,tilt)=>{let c=bowlCamHome(x,y);c=Object.assign(c,{dist:Math.max(near(c),c.dist*k)});if(tilt!=null)c.tilt=tilt;out.push({label,cam:bowlCamClamp(c)})};
 out.push({label:'whole',cam:worldBowl.cam});
 if(G.c){const w=G.n+1;let best=null,bd=9;for(let j=1;j<G.n;j++)for(let i=1;i<G.n;i++){const q=j*w+i;if(G.c[q]<=0)continue;
  if(G.c[q-1]>0&&G.c[q+1]>0&&G.c[q-w]>0&&G.c[q+w]>0)continue;const x=-G.e+2*G.e*i/G.n,y=-G.e+2*G.e*j/G.n;if(Math.hypot(x,y)>.95)continue;
  const d=Math.hypot(x-me.x,y-me.y);if(d<bd){bd=d;best=[x,y]}}
  if(best){at('coast',best[0],best[1],.35);at('coast-low',best[0],best[1],0,BOWL_CAMERA.tiltMin)}}
 const R=(G.rivers||[]).slice().sort((a,b)=>b.length-a.length)[0];if(R){const p=R[Math.floor(R.length/2)];at('river',p[0],p[1],.3);at('river-low',p[0],p[1],0,BOWL_CAMERA.tiltMin)}
 at('place',me.x,me.y,.02);return out})()"""

NUMBERS = """(()=>{const g=worldBowl.ground;return {sea:!!g.water,waterTriangles:g.water?Math.round(g.water.n/3):0,
 rivers:(g.G.rivers||[]).length,programs:['mwater','mground'].filter(k=>gpuState.P[k]&&gpuState.P[k].p).length,floats:!!g.float,pixel:engineSetting('water','pixel')!==false,bands:engineSetting('water','bands'),frames:engineSetting('water','frames')}})()"""


def pixel(pg, on):
    pg.evaluate(f"(()=>{{const D=gameData.engine.defaults;D.water=Object.assign({{}},D.water||{{}},{{pixel:{'true' if on else 'false'}}});if(typeof worldBowl!=='undefined')worldBowl.dirty=true;return 0}})()")


def bowl_frames(pg, n=3):
    f0 = pg.evaluate('worldBowl.frames')
    if not CF.until(pg, f'(worldBowl.dirty=true,worldBowl.frames>={f0 + n})', 300): raise Exception('the bowl isn’t drawing')


def open_map(pg, sea):
    if not CF.until(pg, "!document.getElementById('loader')&&!document.getElementById('runload')", 120): raise Exception('the loading never went')
    if not CF.until(pg, f"!!{NAV.format(t='map')}", 60): raise Exception('no Map tab')
    pg.evaluate("uiState.mapSel=null;0")
    pg.evaluate(f"{NAV.format(t='map')}.click()")
    ready = "typeof worldBowl!=='undefined'&&worldBowl.on&&worldBowl.frames>=3&&!worldBowl.tween&&!!(worldBowl.ground&&worldBowl.ground.terrain&&worldBowl.ground.terrain.ready&&worldBowl.ground.ok&&worldBowl.ground.lines)"
    if not CF.until(pg, ready + ('&&!!worldBowl.ground.water' if sea else ''), 240): raise Exception('the bowl never got ready')
    pg.evaluate("(()=>{const c=document.querySelector('.pcard-wrap');if(c)c.remove();return 0})()")


def shoot(pg, name, notes, extra=None):
    if ONLY and not any(w in name for w in ONLY): return
    for on in (True, False):
        pixel(pg, on)
        bowl_frames(pg)
        n = f"{name}-{'pixel' if on else 'smooth'}"
        pg.screenshot(path=str(OUT / f'{n}.png'))
        notes['shots'].append(dict({'name': n}, **(extra or {})))
        print(f'  {n}', flush=True)
    pixel(pg, True)


def page(b, fixture, errs):
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1)
    for s in (CF.CLOCK, CF.NO_ACCOUNTS, CF.TEST_GLOBALS): ctx.add_init_script(s)
    ctx.set_default_timeout(240000)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'{CF_BASE}/index.html?fixture={fixture}')
    if not CF.until(pg, "typeof walkView!=='undefined'&&walkView.ready&&walkRenderer.on", 240): raise Exception(f'{fixture} never opened')
    pg.evaluate("(()=>{if(typeof uiState!=='undefined'){uiState.modal=null;uiState.mq=[]}const D=gameData.engine.defaults;D.quality=Object.assign({},D.quality||{},{auto:false});environment.force=Object.assign({},environment.force||{},{time:12.5,weather:'clear'});return 0})()")
    return ctx, pg


# the battle: on the first of the run's places with water in its scene, you put where water lies 7-11 m away (8 tiles of it within 12 m with no tree or house in the way) but
# none ahead (north from the camera 4 m behind you, where a battle looked before WA-7; you stand at the middle of the
# action), a wild battle begun there (as the fast check's run battle
# does), the whole screen taken after the intro (the battle's HUD with it)
BATTLE_GO = """(()=>{const wt=walkView.water||[],sc=walkView.sc,M=walkData().sc.props;if(!wt.length)return null;
 const B=(sc.props||[]).filter(p=>M[p.k]&&!M[p.k].flat&&M[p.k].box).map(p=>[p.x,p.z,M[p.k].box[0]*(p.s||1)/2]);
 const clear=(x,z,w)=>{const dx=w[0]-x,dz=w[1]-z,L=Math.hypot(dx,dz);return !B.some(b=>{const t=((b[0]-x)*dx+(b[1]-z)*dz)/(L*L);return t*L>3.5&&t*L<L-.5&&Math.hypot(x+dx*t-b[0],z+dz*t-b[1])<b[2]+.3})};
 for(let z=6;z<sc.h-12;z+=1.5)for(let x=6;x<sc.w-6;x+=1.5){if(!isWalkable(x,z))continue;let nd=1e9,ahead=0;
  for(const w of wt){const dx=w[0]-x,dz=w[1]-z,dc=dz+4.15;nd=Math.min(nd,Math.hypot(dx,dz));if(dc>6.5&&dc<30&&Math.abs(dx)<dc*.62)ahead++}
  if(nd>=7&&nd<=11&&!ahead&&wt.filter(w=>Math.hypot(w[0]-x,w[1]-z)<=12&&clear(x,z,w)).length>=8){const P=walkView.pl;P.x=x;P.z=z;P.route=null;return [x,z,walkView.id]}}
 return null})()"""


def battle(pg, notes):
    at = None
    for n in range(1, pg.evaluate('LOCATIONS.length')):
        CF.go_scene(pg, n, 90)
        if not CF.until(pg, '!!walkRenderer.wgrid||!(walkView.water||[]).length', 120): continue
        at = pg.evaluate(BATTLE_GO)
        if at: break
    if not at: print('  no water in the run: no battle shot'); return
    f0 = pg.evaluate('walkRenderer.frames'); CF.until(pg, f'walkRenderer.frames>={f0 + 6}', 120)
    pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();startWild(encountersHere()[0]);0")
    if not CF.until(pg, "typeof battleStage!=='undefined'&&battleStage.on&&battleStage.gl", 120): raise Exception('the battle never joined the 3D scene')
    time.sleep(4)
    for on in (True, False):
        pixel(pg, on)
        f0 = pg.evaluate('walkRenderer.frames'); CF.until(pg, f'walkRenderer.frames>={f0 + 4}', 120)
        n = f"battle-water-{'pixel' if on else 'smooth'}"
        pg.screenshot(path=str(OUT / f'{n}.png'))
        notes['shots'].append({'name': n, 'at': at, 'face': pg.evaluate("typeof battle3d!=='undefined'?+(battle3d.yaw||0).toFixed(3):0"), 'wetInView': pg.evaluate('(battleStage.wet||[]).length'), 'wetFeet': pg.evaluate('battleStage.wetFeet||[]')})
        print(f'  {n}', flush=True)
    pixel(pg, True)


def main():
    global CF_BASE
    from playwright.sync_api import sync_playwright
    OUT.mkdir(parents=True, exist_ok=True)
    srv, CF_BASE = CF.serve(CF.GAME)
    errs, notes, t0 = [], {'shots': []}, time.time()
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=CF.LAUNCH)
        ctx, pg = page(b, 'run', errs)
        open_map(pg, True)
        pg.evaluate(f"{HIDE_BUT}(gpuState.gl.canvas,worldMap.cv)")
        for c in pg.evaluate(CAMS):
            pg.evaluate(f"(()=>{{worldBowl.goal=null;worldBowl.tween=null;worldBowl.cam={json.dumps(c['cam'])};worldBowl.dirty=true;return 0}})()")
            shoot(pg, 'run-' + c['label'], notes, {'cam': c['cam']})
        notes['run'] = pg.evaluate(NUMBERS)
        if BATTLE:
            pg.evaluate(SHOW_ALL)
            battle(pg, notes)
        ctx.close()
        ctx, pg = page(b, 'town', errs)
        open_map(pg, False)
        pg.evaluate(f"{HIDE_BUT}(gpuState.gl.canvas,worldMap.cv)")
        shoot(pg, 'hub-island', notes)
        notes['hub'] = pg.evaluate(NUMBERS)
        ctx.close(); b.close()
    srv.shutdown()
    notes['errors'] = errs[:6]
    (OUT / 'notes.json').write_text(json.dumps(notes, indent=2))
    print(f'[{time.time() - t0:.0f}s]', json.dumps({k: notes.get(k) for k in ('run', 'hub')}))
    if errs: print('page errors:', errs[:3])


if __name__ == '__main__':
    main()

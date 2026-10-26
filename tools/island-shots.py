#!/usr/bin/env python3
"""Pictures of the hub island (Copperleaf) at phone size, for the owner's look rounds: the game's own orbit camera from
8 places on the coast (you stand by the coast road at N, NE, E ... NW of the island's middle), the town square (the
hub), the summit, a top-down view (the Studio's free-camera hook), Skyline Station with its sky rail and portal, the
lighthouse, the windmill and the town from a free camera, and a flat ground map coloured by ground kind.

    python3 tools/island-shots.py OUT_DIR                # 390 x 760, the game's own graphics defaults
    python3 tools/island-shots.py OUT_DIR --low          # the fast check's low graphics
    python3 tools/island-shots.py OUT_DIR --scene=test_island
    python3 tools/island-shots.py OUT_DIR --only=top-down,summit   # only these (the others in OUT_DIR stay)
    python3 tools/island-shots.py OUT_DIR --hud          # the whole page, the HUD too (default: the game's canvas alone)
    python3 tools/island-shots.py OUT_DIR --hour=22      # at this hour, clear summer weather (HB-10b: the square by night)
    python3 tools/island-shots.py OUT_DIR --last=won     # as after a won (or lost) run: the square's reactions (HB-10d)

Run `npm run data` first (the page reads game/data/gamedata.js). Writes OUT_DIR/<name>.png and OUT_DIR/shots.json
(the names, where you stood, the frame count). Nothing is sent anywhere."""
import json, subprocess, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import browser_check as fast  # noqa: E402  (the browser checks' page set-up)

ROOT = fast.ROOT
ARGS = sys.argv[1:]
OUT = Path(next((a for a in ARGS if not a.startswith('--')), 'island-shots')).resolve()
LOW = '--low' in ARGS
CANVAS = '--hud' not in ARGS
ONLY = next((a.split('=', 1)[1].split(',') for a in ARGS if a.startswith('--only=')), None)
want = lambda name: not ONLY or name in ONLY
HOUR = next((float(a.split('=', 1)[1]) for a in ARGS if a.startswith('--hour=')), None)
SCENE = next((a.split('=', 1)[1] for a in ARGS if a.startswith('--scene=')), 'copperleaf')
LAST = next((a.split('=', 1)[1] for a in ARGS if a.startswith('--last=')), None)
# HB-10d: a made-up last run in the save's history (logic/run-history.js historyEntry's fields), so the square reacts
FAKE_RUN = ("(end=>{{const M=saveData.meta;M.history=[...(M.history||[]),{{seed:'shots',theme:'greenbelt',region:'Shot Vale',"
            "exp:1,end,by:end==='won'?null:{{kind:'boss'}},row:6,days:9,team:[],perks:[],leaders:[],rival:null}}];"
            "M.runs=(M.runs||0)+1;return 0}})('{}')")
W, H = 390, 760
COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

# a point by the coast road at compass bearing deg (0 north, clockwise) from the island's middle: out along the ray to
# the coast, back in 12 m, the nearest walkable spot
COAST_SPOT = """((deg)=>{const sc=walkView.sc,c=sc.island.c,P=sc.island.coast,a=deg*Math.PI/180,dx=Math.sin(a),dz=Math.cos(a);
 const inside=(x,z)=>{let o=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const [xi,zi]=P[i],[xj,zj]=P[j];
  if((zi>z)!==(zj>z)&&x<((xj-xi)*(z-zi))/(zj-zi)+xi)o=!o}return o};
 let r=0;while(r<400&&inside(c[0]+dx*(r+1),c[1]+dz*(r+1)))r++;
 return walkablePointNear(c[0]+dx*Math.max(4,r-12),c[1]+dz*Math.max(4,r-12))})"""

# everything on the page but the walk view's canvas (and what holds it) hidden: the cards, labels and buttons
HIDE_HUD = """(()=>{const cv=walkView.cv;for(const el of document.body.querySelectorAll('*'))
 if(el!==cv&&!el.contains(cv))el.style.setProperty('visibility','hidden','important');
 for(let e=cv;e;e=e.parentElement)e.style.setProperty('visibility','visible','important');return 0})()"""


def settle(pg, frames=16):
    f0 = pg.evaluate('walkRenderer.frames')
    if not fast.until(pg, f'walkRenderer.frames>={f0 + frames}', 240): raise Exception('stopped drawing')


def ground_map(path):
    """the flat map: each cell coloured by its ground letter, shaded by height; sea blue"""
    js = f"""import {{ readFileSync }} from 'node:fs';
import {{ islandDecodeGround }} from '{(ROOT / 'game/js/logic/island-gen.js').as_posix()}';
const sc = JSON.parse(readFileSync('{(ROOT / f'game/data/maps/{SCENE}.json').as_posix()}'));
const G = islandDecodeGround(sc);
process.stdout.write(JSON.stringify({{ w: G.w, h: G.h, T: Array.from(G.T).join(''), H: Array.from(G.H, v => Math.round(v * 10) / 10),
  bridges: (sc.bridges || []).map(b => [b.a, b.b, !!b.pier]), coast: sc.island && sc.island.coast }}));"""
    d = json.loads(subprocess.run(['node', '--input-type=module', '-e', js], capture_output=True, text=True, check=True, cwd=ROOT).stdout)
    from PIL import Image, ImageDraw
    col = {'w': (90, 170, 205), 'd': (40, 95, 160), 'S': (196, 178, 130), 's': (232, 214, 160), 'B': (190, 180, 110),
           '2': (120, 150, 150), '3': (95, 110, 100), 'j': (90, 85, 90), 'G': (110, 165, 80), 'E': (125, 175, 85),
           'g': (100, 155, 70), 'l': (140, 180, 90), 'y': (60, 110, 55), 'L': (70, 105, 50), 'M': (80, 120, 60),
           'F': (55, 95, 50), 'H': (150, 110, 140), 'r': (140, 135, 125), 'P': (165, 155, 140), 'p': (200, 180, 140),
           'v': (185, 160, 120), 'c': (180, 170, 160), 'C': (130, 170, 100), 'u': (150, 170, 90), 't': (90, 140, 60), 'f': (150, 175, 95)}
    w, h, T, Hs = d['w'], d['h'], d['T'], d['H']
    s = 3
    im = Image.new('RGB', (w * s, h * s))
    px = im.load()
    for j in range(h):
        for i in range(w):
            t = T[j * w + i]
            c = col.get(t, (200, 0, 200))
            y = (Hs[j * (w + 1) + i] + Hs[(j + 1) * (w + 1) + i + 1]) / 2
            k = 1 if t in 'wd' else max(0.75, min(1.35, 0.85 + y / 40))
            c = tuple(min(255, int(v * k)) for v in c)
            for a in range(s):
                for b in range(s):
                    px[i * s + a, (h - 1 - j) * s + b] = c   # north up
    dr = ImageDraw.Draw(im)
    for a, b, pier in d['bridges']:
        dr.line([(a[0] * s, (h - a[1]) * s), (b[0] * s, (h - b[1]) * s)], fill=(255, 255, 255) if pier else (255, 60, 40), width=4)
    im.save(path)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    from playwright.sync_api import sync_playwright
    srv, base = fast.serve(fast.GAME)
    errs, shots = [], []
    t0 = time.time()
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=fast.LAUNCH)
        ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1)
        for s in (fast.CLOCK, fast.NO_ACCOUNTS, fast.TEST_GLOBALS) + ((fast.LOW_GRAPHICS,) if LOW else ()): ctx.add_init_script(s)
        ctx.set_default_timeout(240000)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        url = f'{base}/index.html?fixture=town' if SCENE == 'copperleaf' else f'{base}/index.html?test=1&scene={SCENE}'
        pg.goto(url)
        if not fast.until(pg, f"typeof walkView!=='undefined'&&walkView.ready&&walkRenderer.on&&(walkView.sc.baseId||walkView.id)==='{SCENE}'", 240):
            raise Exception('the island never opened')
        if HOUR is not None: pg.evaluate(f"environment.force={{time:{HOUR},weather:'clear',season:'summer'}};0")
        if LAST: pg.evaluate(FAKE_RUN.format(LAST))
        settle(pg, 10)

        def shot(name, label, where=None):
            settle(pg)
            if CANVAS: pg.evaluate(HIDE_HUD)
            pg.screenshot(path=str(OUT / f'{name}.png'))
            shots.append({'name': name, 'label': label, 'at': where})
            print(f'[{time.time() - t0:5.0f}s] {name}', flush=True)

        for k, nm in enumerate(COMPASS):
            if not want(f'coast-{nm.lower()}'): continue
            x, z = pg.evaluate(f'{COAST_SPOT}({k * 45})')
            fast.stand(pg, x, z, frames=4)
            shot(f'coast-{nm.lower()}', f'From the coast, {nm} of the middle', [round(x, 1), round(z, 1)])
        hub = pg.evaluate('mapHub(walkView.sc)')
        if want('town-square'):
            fast.stand(pg, hub[0], hub[1], frames=4)
            shot('town-square', 'The town square (the hub)', [round(hub[0], 1), round(hub[1], 1)])
        sm = pg.evaluate("((mapById(walkView.sc.baseId||walkView.id)||walkView.sc).spots||[]).find(s=>s.kind==='summit')")
        if sm and want('summit'):
            fast.stand(pg, sm['x'], sm['z'], frames=4)
            shot('summit', 'On the summit', [sm['x'], sm['z']])
        # the views from above: no depth of field (it focuses on you, so the island blurs), as a player's own expert
        # dials would set it; put back after
        pg.evaluate("(()=>{const p=saveData.preferences=saveData.preferences||{};window.__pref={expert:p.expert,eng:p.eng};p.expert=true;p.eng={lens:{blur:0,bokeh:0}};return 0})()")
        c = pg.evaluate('walkView.sc.island.c')
        span = pg.evaluate('Math.max(walkView.sc.w,walkView.sc.h)')
        pg.evaluate(f"walkView.opt.look=()=>({{eye:[{c[0]},{span * 0.95},{c[1]}-{span * 0.12}],tgt:[{c[0]},0,{c[1]}],fov:62}})")
        if want('top-down'): shot('top-down', 'From above (north up)')
        pg.evaluate(f"walkView.opt.look=()=>({{eye:[{c[0]}+{span * 0.55},{span * 0.5},{c[1]}-{span * 0.55}],tgt:[{c[0]},0,{c[1]}],fov:55}})")
        if want('overview-se'): shot('overview-se', 'Overview from the south-east, high up')
        # hub placing: the landmarks from a free camera: [name, label, prop key, the eye's offset from it, the target's]
        for name, label, k, eye, tgt in (
                ('station', 'Skyline Station on its headland, the sky rail out to sea and the portal', 'train_station', [-6, 26, -46], [30, 6, 6]),
                ('station-rail', 'The sky rail climbing to the portal, from the headland', 'train_station', [-4, 4, -10], [60, 14, 6]),
                ('station-near', 'Skyline Station and the rail out of its right-hand end, close', 'train_station', [4, 9, -22], [8, 2, 3]),
                ('lighthouse', 'The lighthouse on the cove', 'lighthouse', [-14, 10, -18], [0, 4, 0]),
                ('windmill', 'The windmill by the farm', 'windmill', [-12, 8, -16], [0, 3, 0]),
                ('town', 'The town round the square, from above', 'fountain', [-10, 34, -40], [0, 0, 4]),
                # HB-10a: the framed view from the square's south-west edge to the sky rail and the portal (north-east)
                ('square-portal', 'From the square toward the sky rail and the portal', 'fountain', [-7, 1.7, -5], [60, 12, 40]),
                ('square-near', 'The square and its fountain, close', 'fountain', [-6, 5, -10], [0, 0.5, 0])):
            p = pg.evaluate(f"(walkView.sc.props.find(p=>p.k==='{k}')||null)")
            if not p or not want(name): continue
            # stand beside it (the walk view draws what is near you), then the free camera
            pg.evaluate('delete walkView.opt.look')
            # beside a fountain, not in its basin (HB-10a: the hub's own spot is 3 m east of it)
            sx = p['x'] + (3 if k == 'fountain' else 0)
            fast.stand(pg, *pg.evaluate(f"walkablePointNear({sx},{p['z']})"), frames=4)
            y = pg.evaluate(f"standingHeightAt({p['x']},{p['z']})")
            pg.evaluate(f"walkView.opt.look=()=>({{eye:[{p['x'] + eye[0]},{y + eye[1]},{p['z'] + eye[2]}],tgt:[{p['x'] + tgt[0]},{y + tgt[1]},{p['z'] + tgt[2]}],fov:55}})")
            shot(name, label, [p['x'], p['z']])
        pg.evaluate('delete walkView.opt.look')
        pg.evaluate("(()=>{const p=saveData.preferences;p.expert=window.__pref.expert;p.eng=window.__pref.eng;return 0})()")
        b.close()
    srv.shutdown()
    if want('ground-map'):
        ground_map(OUT / 'ground-map.png')
        shots.append({'name': 'ground-map', 'label': 'Ground map (north up; red lines are bridges, white the pier)'})
    # a partial run (--only) keeps the other pictures' entries
    old = json.loads((OUT / 'shots.json').read_text()) if ONLY and (OUT / 'shots.json').exists() else {'shots': []}
    new = {s['name'] for s in shots}
    shots = [s for s in old['shots'] if s['name'] not in new] + shots
    (OUT / 'shots.json').write_text(json.dumps({'scene': SCENE, 'low': LOW, 'size': [W, H], 'shots': shots, 'pageErrors': errs[:10]}, indent=1))
    print(f'{len(shots)} pictures in {OUT}; page errors: {len(errs)}')


if __name__ == '__main__':
    main()

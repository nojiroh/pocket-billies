#!/usr/bin/env python3
"""A quick check of Pocket Billies made for a headless test machine (a browser without a graphics chip, which draws the
3D scenes in software and slowly). It is the check Claude runs while building a version; it takes a few minutes.

    python3 tools/check-quick.py                 # data, code, shaders, every scene once, the main flows
    python3 tools/check-quick.py --smoke         # the fast subset: the data, Start-Game on a phone + debug log, the in-game test's first step
    python3 tools/check-quick.py --selftest      # the game's own full test and diagnostics test, whole (about 25 minutes)
    python3 tools/check-quick.py --steps=running,lamps # only the steps whose names hold these words
    python3 tools/check-quick.py --tests         # also draw every test scene and take its pictures (the walking checks
                                                 # of the test scenes always run; they need no drawing)

The game's own **full test** (Settings → Help, or the debug menu) runs here one step at a time (smoke and full) and
whole with --selftest (nightly), stretched for software drawing (phase 13); its frame rates and the stress test only
mean something on a real phone or computer with a graphics chip, so those come from you as a debug log.

How it stays quick in software: the frames are drawn at a third of the resolution with a small shadow map, scene
logic (walkable paths, doors, bridges, stairs) is checked directly from the data without drawing, each scene is drawn
just until its first frames appear, and every step has a time limit so a stuck step is reported, not waited on.
Pictures go to validation/quick/ as WebP; the summary to validation/quick/results.json. With a baseline in
validation/quick-baseline/ (make one with --baseline), each picture is compared with it. Nothing in game/ or studio/
is changed."""
# RL-5: --closeups and --seams=all went with their steps (every close-up spot and every seam was in a parked place);
# TC-1: --scenes went with the Scenes and Paths steps, the only ones that read it
import io, json, math, os, re, shutil, socket, subprocess, sys, tempfile, threading, time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gamedata as GAMEDATA  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
GAME = ROOT / 'game'
OUT = ROOT / 'validation' / 'quick'
T0 = time.time()
# alpha 0.1: every page the check opens lives on 15 June at half past twelve (the clock still runs), so the pictures
# are always taken at the same time of day and compare with the baseline
CLOCK = """(()=>{const D=Date,off=new D(2026,5,15,12,30,0).getTime()-D.now();class FD extends D{constructor(...a){if(a.length)super(...a);else super(D.now()+off)}static now(){return D.now()+off}}
 FD.UTC=D.UTC;FD.parse=D.parse;window.Date=FD})()"""
# RL-5: the shops were parked with their towns (game/data/legacy): the checks open a shop of their own to see the shop
# screen (the stock Marigold's General Store had)
CHECK_SHOP = "SHOPS.check_shop=SHOPS.check_shop||{name:'Corner Store',keeper:'Mabel Underhill',who:'clerk',greeting:'Welcome in! Potions on the left, coins on the right.',stock:[{item:'taxbreak',price:150},{item:'apology',price:200},{item:'settlement',price:200},{item:'appeal',price:200},{item:'trailmix',price:260},{coin:'penny',price:300}]};"
NO_ACCOUNTS = "Object.defineProperty(window,'PB_FIREBASE',{get(){return null},set(){},configurable:false})"   # alpha 0.4.1: no Google sign-in during the checks
# phase 04d: the modules' names on window (game/js/test-globals.js), only for the checks' page.evaluate() calls
TEST_GLOBALS = "window.PB_TEST_GLOBALS=true"
LOW_RENDER = "gameData.engine=gameData.engine||{};gameData.engine.defaults=Object.assign({},gameData.engine.defaults||{},{quality:{resolution:.34,shadowMap:1024,auto:false}});0"
ARGS = sys.argv[1:]
# phase 01: --smoke is a fast subset (the data checks, Start-Game on a phone with the debug log export, one step of the
# in-game test, the actions sheet); every push runs tools/check-fast.py, which also opens the Studio. The full check
# runs nightly and per phase
SMOKE = '--smoke' in ARGS
# where a point of the walk scene is on screen (the same projection the renderer uses)
PROJ = "(([x,z])=>{const C=walkView.C,r=walkView.cv.getBoundingClientRect(),y=standingHeightAt(x,z)+(typeof worldCurveDrop==='function'?worldCurveDrop(x,z):0);if(C.vp){const m=C.vp,cx=m[0]*x+m[4]*y+m[8]*z+m[12],cy=m[1]*x+m[5]*y+m[9]*z+m[13],w=m[3]*x+m[7]*y+m[11]*z+m[15];return [r.left+(cx/w*.5+.5)*r.width,r.top+(1-(cy/w*.5+.5))*r.height]}const q=worldToScreen(C,x,y,z);return [r.left+q.x/walkView.cv.width*r.width,r.top+q.y/walkView.cv.height*r.height]})(%s)"
STEPS = next((a.split('=', 1)[1].split(',') for a in ARGS if a.startswith('--steps=')), None)
problems, notes, steps = [], [], []


def log(msg):
    print(f'[{time.time() - T0:6.1f}s] {msg}', flush=True)


CUR = {'pg': None}


def page_diag(since=0):
    """v33: what the game says about itself (debugLog.diag): screen, scene, renderer, slow frames and their causes, errors"""
    pg = CUR['pg']
    if not pg: return None
    try: return pg.evaluate(f"typeof debugLog!=='undefined'&&debugLog.diag?debugLog.diag({int(since)}):null")
    except Exception as e: return {'unavailable': str(e).splitlines()[0][:120]}


def page_now():
    try: return CUR['pg'].evaluate("typeof debugLog!=='undefined'?debugLog.now():0") if CUR['pg'] else 0
    except Exception: return 0


def step(name, limit):
    """a step with a time limit: decorated functions run, their time is logged, an exception becomes a problem.
    v33: each step also says what the game was doing (slow frames and their causes, errors); a problem adds where it
    happened in our code, what was on screen, and a picture (fail-<step>.webp)"""
    def wrap(fn):
        def run(*a, **k):
            # v34: --steps=running,lamps runs only the steps whose name holds one of those words (the scenes still load)
            if STEPS and not any(w.lower() in name.lower() for w in STEPS):
                return None
            log(name); t = time.time(); ok = True; note = ''; t0 = page_now(); where = ''
            try:
                r = fn(*a, **k); note = r if isinstance(r, str) else ''
            except Exception as e:
                import traceback
                ok = False; note = str(e).splitlines()[0][:300]; problems.append(f'{name}: {note}')
                tb = [f for f in traceback.extract_tb(e.__traceback__) if f.filename.endswith('check-quick.py')]
                where = f'check-quick.py line {tb[-1].lineno}: {tb[-1].line}' if tb else ''
                try:
                    slug = re.sub(r'[^a-z0-9]+', '-', name.lower())[:40]
                    if CUR['pg']: shot(CUR['pg'], 'fail-' + slug)
                except Exception: pass
            dt = round(time.time() - t, 1)
            D = page_diag(t0) or {}
            if ok and dt > limit: notes.append(f'{name} took {dt}s (expected under {limit}s)')
            rec = {'step': name, 'ok': ok, 'seconds': dt, 'note': note}
            if D: rec['game'] = D
            if where: rec['where'] = where
            steps.append(rec); log(f'  {"ok" if ok else "PROBLEM"} ({dt}s) {note}')
            slow = (D.get('slow') or []) if isinstance(D, dict) else []
            if slow: log(f'     slow frames: {"; ".join(slow[-3:])}')
            if not ok:
                if where: log(f'     at {where}')
                for k2 in ('view', 'scene', 'renderer'):
                    if isinstance(D, dict) and D.get(k2): log(f'     {k2}: {D[k2]}')
                for e2 in (D.get('errors') or [])[-3:] if isinstance(D, dict) else []: log(f'     error: {e2}')
        return run
    return wrap


def pixels(im):
    """the pixels of a picture as a list (Pillow 14 drops getdata for get_flattened_data)"""
    return list(im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata())


def shot(pg, name):
    from PIL import Image
    im = Image.open(io.BytesIO(pg.screenshot())).convert('RGB')
    if max(im.size) > 1400: im.thumbnail((1400, 1400))
    im.save(OUT / f'{name}.webp', 'WEBP', quality=78)


def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


def serve(directory):
    port = free_port()
    class Quiet(SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    srv = ThreadingHTTPServer(('127.0.0.1', port), partial(Quiet, directory=str(directory)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f'http://127.0.0.1:{port}'


def gamedata():
    return GAMEDATA.load()  # phase 04b: from the data files (tools/gamedata.py)


# ------------------------------------------------------------------ 1. without a browser
@step('Windows: no prop stands in front of one (from the data)', 30)
def check_windows():
    """alpha 0.1: tools/clear-windows.py looks at every window on every building front and room wall as the walk camera
    sees it; no prop may hide more than a fifth of one"""
    import importlib.util
    spec = importlib.util.spec_from_file_location('clearwin', ROOT / 'tools' / 'clear-windows.py'); CW = importlib.util.module_from_spec(spec); spec.loader.exec_module(CW)
    head, D = CW.load(); C = D['scenery']['props']; P = CW.ppu(D); bad = []; nw = 0
    for sid, sc in D['maps'].items():
        if sid.startswith('test') or not sc.get('props'): continue
        wins = CW.windows_of(sc, C, P); nw += len(wins)
        for (W, n, c) in CW.occluders(sc, C, P, wins): bad.append(f"{sid}: {sc['props'][n]['k']} at {sc['props'][n]['x']:.1f},{sc['props'][n]['z']:.1f} hides {c:.0%} of a {W['k']} window")
    if bad: raise Exception(f'{len(bad)} props in front of windows (python3 tools/clear-windows.py --fix moves them): ' + '; '.join(bad[:5]))
    return f'{nw} windows in {len(D["maps"])} scenes, nothing stands in front of one'


@step('Ground: every kind has twelve tiles of its own', 30)
def check_ground():
    """v47: the 12 tiles of every ground kind exist, differ from each other, and share no picture or overlay with
    another kind (v46 stamped the same grey smudge onto one tile of every kind)"""
    from PIL import Image
    import hashlib
    D = gamedata(); SY = D['scenery']; folder = GAME / 'art' / 'next' / SY.get('tileSet', 'tiles47'); bad = []; seen = {}; masks = {}
    for ch, T in SY['terrains'].items():
        name = T['tile'].rsplit('/', 1)[-1][:-4]; hs = []
        for i in range(1, 13):
            f = folder / f'{name}_{i}.png'
            if not f.exists(): bad.append(f'{name}: no tile {i}'); break
            im = Image.open(f).convert('RGB'); h = hashlib.md5(im.tobytes()).hexdigest(); hs.append(h)
            if h in seen and seen[h][0] != name: bad.append(f'{name}_{i} is the same picture as {seen[h][0]}_{seen[h][1]}')
            seen.setdefault(h, (name, i))
            px = pixels(im); med = sorted(px, key=sum)[len(px) // 2]
            masks[(name, i)] = frozenset(k for k, c in enumerate(px) if sum(abs(c[q] - med[q]) for q in range(3)) > 60)
        if len(set(hs)) != len(hs): bad.append(f'{name}: two of its tiles are the same picture')
    by_i = {}
    for (name, i), m in masks.items(): by_i.setdefault(i, []).append((name, m))
    for i, L in by_i.items():
        for a in range(len(L)):
            for b in range(a + 1, len(L)):
                ma, mb = L[a][1], L[b][1]
                if len(ma) > 60 and len(mb) > 60 and len(ma & mb) / len(ma | mb) > .85: bad.append(f'{L[a][0]}_{i} and {L[b][0]}_{i} carry the same overlay')
    if bad: raise Exception('; '.join(bad[:6]))
    return f'{len(SY["terrains"])} kinds x 12 tiles in next/{folder.name}, all distinct'


@step('Unused: art, props and songs nothing names', 30)
def report_unused():
    """v47: lists pictures and sounds no code, page or data names, and catalogue props no place uses and no code
    names, so old things don't build up again. A report, not a failure. A folder the code builds names in (battle/
    plus a stage) counts as named as a whole, so the list holds only what nothing reaches"""
    D = gamedata(); SY = D['scenery']
    srcs = list((GAME / 'js').rglob('*.js')) + list((ROOT / 'studio' / 'js').glob('*.js')) + list((GAME / 'data').glob('*.js')) + list((GAME / 'art').rglob('*.json'))
    srcs += [f for f in GAME.glob('*') if f.suffix in ('.html', '.json', '.webmanifest', '.css', '.js')] + list((ROOT / 'studio').glob('*.html')) + list((ROOT / 'studio').glob('*.css'))
    text = '\n'.join(f.read_text(encoding='utf-8', errors='ignore') for f in srcs)
    text = re.sub(r'[A-Za-z0-9+/=]{200,}', ' ', text)      # the step grids and other base64: no names in them
    tokens = set(re.findall(r'[A-Za-z0-9_./-]{1,160}', text)); tokens |= {t.rsplit('/', 1)[-1] for t in tokens}
    dyn = set()                                            # folders the code builds names in: 'dir/'+x, `dir/${x}`
    for m in re.finditer(r'[A-Za-z0-9_.-]{1,40}(?:/[A-Za-z0-9_.-]{1,40}){0,4}/', text):
        nxt = text[m.end():m.end() + 3]
        if nxt.startswith('${') or (nxt[:1] in '\'"`' and '+' in nxt[1:3]): dyn.add(m.group(0).rstrip('/'))
    pre = set(re.findall(r'([A-Za-z0-9_.-]{1,40}(?:/[A-Za-z0-9_.-]{0,40}){1,4})\$\{', text)) | set(re.findall(r'[\'"]([A-Za-z0-9_.-]{1,40}(?:/[A-Za-z0-9_.-]{0,40}){1,4})[\'"]\s*\+', text))
    art = GAME / 'art'; unused = []
    dirs = {f.parent.relative_to(art).as_posix() for f in art.rglob('*') if f.is_file()}
    dynd = {d for d in dirs if any(d == x or x.endswith('/' + d) or d.endswith('/' + x) for x in dyn)}
    for f in art.rglob('*'):
        if not f.is_file() or f.suffix.lower() not in ('.png', '.webp', '.jpg', '.vox', '.ogg', '.mp3', '.wav'): continue
        rel = f.relative_to(art).as_posix(); d = f.parent.relative_to(art).as_posix(); stem = re.sub(r'(_\d+|_[a-z]+)$', '', f.stem)
        if {rel, f.name, f.stem, stem} & tokens or d in dynd or 'tiles' in d or any(rel.startswith(x) for x in pre if x.startswith(d)): continue
        unused.append(rel)
    placed = {p['k'] for sc in D['maps'].values() for p in sc.get('props', [])}
    # RL-5: what the parked maps place counts as placed (game/data/legacy: kept for the Studio's Legacy section, and a map
    # copied back into the game brings its props with it)
    for f in (GAME / 'data' / 'legacy' / 'maps').glob('*.json'):
        placed |= {p['k'] for p in json.loads(f.read_text(encoding='utf-8')).get('props', [])}
    code = '\n'.join(f.read_text(encoding='utf-8', errors='ignore') for f in list((GAME / 'js').rglob('*.js')) + list((ROOT / 'studio' / 'js').glob('*.js')))
    ctok = set(re.findall(r'[\'"`]([A-Za-z0-9_]+)[\'"`]', code)) | set(re.findall(r'[\'"`]([A-Za-z0-9_]+)[|,]', code))
    props = [k for k in SY.get('props', {}) if k not in placed and k not in ctok]
    spare = len([k for k in SY.get('props', {}) if k not in placed])
    # SND-2: songs no where-rule, no place (locations' music, the parked ones too), no story script (`music <song>`) and no
    # code (music('<song>')) names
    M = D.get('music') or {}
    named = {W['song'] for W in M.get('where', [])}
    for f in [GAME / 'data' / 'locations.json', GAME / 'data' / 'legacy' / 'locations.json']:
        if f.exists(): named |= set(re.findall(r'"music"\s*:\s*"([a-z0-9_]+)"', f.read_text(encoding='utf-8')))
    for f in (GAME / 'data').rglob('*.json'):
        if f.name != 'music.json': named |= set(re.findall(r'\bmusic ([a-z0-9_]+)', f.read_text(encoding='utf-8', errors='ignore')))
    named |= set(re.findall(r"\bmusic\(\s*'([a-z0-9_]+)'", code))
    songs = [k for k in M.get('songs', {}) if k not in named]
    (OUT / 'unused.txt').write_text('Pictures and sounds nothing names:\n' + '\n'.join(sorted(unused)) + '\n\nCatalogue props no place uses and no code names:\n' + '\n'.join(sorted(props)) + '\n\nSongs no where-rule, place, script or code plays (music.json):\n' + '\n'.join(sorted(songs)) + '\n')
    if unused or props or songs: notes.append(f'unused: {len(unused)} pictures/sounds, {len(props)} props and {len(songs)} songs nothing names (validation/quick/unused.txt)')
    return f'{len(unused)} pictures/sounds, {len(props)} props, {len(songs)} songs ({", ".join(songs) or "none"}) nothing names; {spare} props kept for the Studio palette, placed nowhere yet'


# ------------------------------------------------------------------ 2. in the browser
def console_text(m):
    """v47: a failed load says which file (the browser's own message doesn't)"""
    from urllib.parse import urlparse
    t = m.text
    try:
        if 'Failed to load' in t and m.location and m.location.get('url'): t += f' ({urlparse(m.location["url"]).path.lstrip("/")})'
    except Exception: pass
    return t


def open_game(b, base, w, h, mobile, errs):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile); ctx.add_init_script(CLOCK); ctx.add_init_script(NO_ACCOUNTS); ctx.add_init_script(TEST_GLOBALS)
    ctx.set_default_timeout(90000); pg = ctx.new_page(); CUR['pg'] = pg
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(console_text(m)) if m.type == 'error' else None)
    pg.goto(base + '/index.html?boot=normal'); pg.wait_for_selector('.ttl,.title', timeout=60000); pg.evaluate(LOW_RENDER)
    return ctx, pg


def until(pg, cond, sec, poke=None):
    end = time.time() + sec
    while time.time() < end:
        if pg.evaluate(cond): return True
        if poke: pg.evaluate(poke)
        time.sleep(.3)
    return False


def wait_phase(pg, want=('choose',), sec=60):
    end = time.time() + sec
    while time.time() < end:
        ph = pg.evaluate('activeBattle?activeBattle.phase:"none"')
        if ph in want: return ph
        if ph == 'playing': pg.evaluate('tapMessage()')
        time.sleep(.15)
    return pg.evaluate('activeBattle?activeBattle.phase:"none"')


def play(pg):
    # phase 08: the money, four encounters, egg progress and buddy XP that 2,400 steps used to bring are given directly
    pg.evaluate("if(typeof titleEnd==='function')titleEnd();uiState.pg='girl';startGame(SPECIES.scoop0?'scoop':RULES.start.starters[0]);saveData.story={met_chad:1,met_chad2:1};Object.values(TRAINERS).forEach(T=>{if(T.runsUp)saveData.story['met_'+T.id]=1});uiState.modal=null;uiState.mq=[];renderOverlay();saveData.team.push(makeBilly('swift1',18));saveData.se+=2400;for(let i=0;i<4;i++)spawn();saveData.eggs.forEach(e=>{if(e.slot!=null)e.prog=1500});gainXp(findBilly(saveData.buddy)||saveData.team[0],480,()=>{});uiState.toastQ=[];uiState.toastOn=false;uiState.modal=null;uiState.mq=[];renderOverlay();render();0")
    # alpha 0.2: the legendaries count as met today, so passing through their places doesn't leave one waiting in a later
    # step (RL-5: the v39 step no longer brings the volcano's back: the volcano is parked)
    pg.evaluate("for(const l of (RULES.legends||[]))saveData.story['legend_'+l.sp]=today();0")


def go_scene(pg, node, sec=40):
    # alpha 0.4: a jump, not a walk: a neighbour whose middle is near this view's would otherwise wait for its view to be
    # prepared a few milliseconds a frame (seamless-world.js seamlessGate), which at a frame every few seconds here takes minutes
    pg.evaluate(f"uiState.inside=null;uiState.tab='walk';saveData.trip={{node:{node},plan:[]}};saveData.visited[{node}]=1;uiState.roam=null;if(typeof walkView!=='undefined'&&walkView.pl)walkView.pl.fresh=true;render();0")
    if not until(pg, f'!!(walkView.ready&&(walkView.id===LOCATIONS[{node}].mapId||(walkView.sc&&walkView.sc.baseId===LOCATIONS[{node}].mapId)))', sec):   # v43: the hub may sit near an exit, so the view may be the scene with its road
        raise Exception(f'{pg.evaluate(f"LOCATIONS[{node}].mapId")} didn’t open in {sec}s')
    f0 = pg.evaluate("typeof walkRenderer!=='undefined'&&walkRenderer.on?walkRenderer.frames:-1")
    if f0 >= 0 and not until(pg, f'walkRenderer.frames>={f0 + 2}', 30): raise Exception(f'{pg.evaluate("walkView.id")} isn’t drawing (black screen)')



def walk_in(pg, act, k):
    # phase 08b: into a building the way a tap at its door does: stand at the door, then tap it
    pg.evaluate(f"(()=>{{const p=walkView.sc.props.find(p=>p.act==='{act}'&&p.k==='{k}'),g=actionSpot(p,walkData().sc.props[p.k]);walkView.pl.route=null;walkView.pl.x=g[0];walkView.pl.z=g[1];walkPick({{k:'act',p,act:'{act}'}})}})();0")


# RL-5: cross() was unused while the hub was the only place (no road, no seam, no neighbour); RL-8 walks a run's seam
# with it (a run's crossing counts rules.json run.seamIn metres in, so the walk goes that much further)
# phase 08: travel is walking. cross() walks from where you stand over the edge into the neighbour n1 the way a player
# does: a path to 6 m past the exit (no search limit: a route view is long), the player put along it at most 0.8 m at a time, walkCross() after each (the a041
# way: game time is too slow here to walk it for real). Returns the metres walked, the views seen on the way and how
# often the view was not ready (a remount instead of a shift)
# phase 08b: prep_ms gives the ground a phone's share of work for each 0.8 m step (about 0.24 s of walking at 4 ms a
# frame; headless software drawing manages two frames a second, so the next view would otherwise take minutes), and
# meter['waits'] counts those steps' worth spent waiting at the seam for the next view
def cross(pg, n1, sec=90, look=None, prep_ms=None, meter=None):
    if not until(pg, 'walkView.ready', sec): raise Exception(f'the view {pg.evaluate("walkView.id")} never got ready to walk from')
    r = pg.evaluate(f"""(()=>{{const v=walkState(),e=(v.exits||[]).find(e=>e.to==={n1});if(!e)return 'no exit to '+LOCATIONS[{n1}].name+' from '+LOCATIONS[saveData.trip.node].name;const sc=walkView.sc,pt=sc.exits[e.i],hub=mapHub(sc),ee=(sc.edgeExits||(sc.baseId&&mapById(sc.baseId)||{{}}).edgeExits||[])[e.i],sv=ee&&SIDE_VECTORS[ee.side],dx=sv?sv[0]:pt[0]-hub[0],dz=sv?sv[1]:pt[1]-hub[1],l=Math.hypot(dx,dz)||1,past=6+(saveData.run?RULES.run.seamIn:0),tg=[pt[0]+dx/l*past,pt[1]+dz/l*past];/* phase 08b: straight out of the edge the exit is on */
      const P=walkView.pl,R=findPath(P.x,P.z,tg[0],tg[1],{{max:1e6}});return R?{{R}}:'no path to the exit to '+LOCATIONS[{n1}].name}})()""")
    if isinstance(r, str): raise Exception(r)
    R = r['R']; walked = 0; views = [pg.evaluate('walkView.id')]; unready = 0
    total = sum(((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2) ** .5 for p, q in zip(R, R[1:]))
    for a, bb in zip(R, R[1:]):
        d = ((bb[0] - a[0]) ** 2 + (bb[1] - a[1]) ** 2) ** .5; k = max(1, int(d / .8))
        for j in range(1, k + 1):
            x = a[0] + (bb[0] - a[0]) * j / k; z = a[1] + (bb[1] - a[1]) * j / k; walked += d / k
            if not pg.evaluate('walkView.ready'): unready += 1
            if not until(pg, 'walkView.ready', sec): raise Exception(f'the view went unready on the way ({views})')
            st = pg.evaluate(f"(()=>{{walkView.pl.x={x};walkView.pl.z={z};walkView.pl.route=null;walkCross();return [saveData.trip.node==={n1},walkView.id]}})()")
            if prep_ms: pg.evaluate(f"groundPrepWork({prep_ms});0")
            if look: look(total - walked, st[1] != views[-1])   # phase 08b: how far is left to the end of the path, and whether the view just changed
            if st[1] != views[-1]: views.append(st[1])
            if st[0]:
                shown = f"walkView.ready&&(walkView.id===LOCATIONS[{n1}].mapId||(walkView.sc&&walkView.sc.baseId===LOCATIONS[{n1}].mapId))"
                if prep_ms:   # the player waits at the seam (a real one keeps walking, inside the band the view holds)
                    waits = 0
                    while not pg.evaluate(shown) and waits < 400:
                        pg.evaluate(f"groundPrepWork({prep_ms});render();0"); waits += 1; time.sleep(.05)
                    if meter is not None: meter['waits'] = waits
                    if look and waits: look(0, True)   # the view changed while waiting: the picture after it
                if not until(pg, f"walkView.ready&&(walkView.id===LOCATIONS[{n1}].mapId||(walkView.sc&&walkView.sc.baseId===LOCATIONS[{n1}].mapId))", sec): raise Exception(f'crossed into {pg.evaluate(f"LOCATIONS[{n1}].name")} but its view never showed (still {pg.evaluate("walkView.id")})')
                v = pg.evaluate('walkView.id')
                if v != views[-1]: views.append(v)
                return walked, views, unready
    raise Exception(f'walked {walked:.0f} m toward {pg.evaluate(f"LOCATIONS[{n1}].name")} and never crossed ({views})')


def debug_picture_privacy(pg):
    # phase 13: the debug log keeps a picture of the scene, and what the buddy says names the Billie, so in the frame that
    # takes the picture speech is drawn after it (walk-view-gl.js). The buddy talks, the log takes its picture, and the
    # order of drawing in that frame is read back. A window or the camera can keep the speech out of that frame (the
    # check then proves nothing), so it tries up to three times
    pg.evaluate("uiState.tab='walk';render();0")
    if not until(pg, 'walkView.ready&&walkRenderer.on&&!!worldBillies.bud', 40): raise Exception('no buddy in the walk view to test the debug picture with')
    pg.evaluate("""window.__pq={ev:[],say:drawSpeech,snap:screenSnapshot};
      drawSpeech=(...a)=>{__pq.ev.push(['say',walkRenderer.frames]);return __pq.say(...a)};
      screenSnapshot=(...a)=>{const b=worldBillies.bud,q=b&&worldToScreen(walkView.C,b.x,1.1,b.z);__pq.ev.push(['snap',walkRenderer.frames,{active:walkView.opt.active(),sayT:+worldBillies.sayT.toFixed(1),onScreen:!!q}]);return __pq.snap(...a)};0""")
    seen = []
    try:
        for _ in range(3):
            t0 = pg.evaluate("__pq.ev=[];__pq.t=debugLog.shot&&debugLog.shot.t;uiState.mq=[];uiState.modal=null;renderOverlay();buddyTap();worldBillies.sayT=60;debugLog.snap();__pq.t")
            if not until(pg, f'walkRenderer.snapReq===0&&!!debugLog.shot&&debugLog.shot.t!=={json.dumps(t0)}', 30): raise Exception('the debug log took no picture')
            f1 = pg.evaluate('walkRenderer.frames'); until(pg, f'walkRenderer.frames>{f1}', 30)
            ev = pg.evaluate('__pq.ev'); snap = next((e for e in ev if e[0] == 'snap'), None)
            frame = [e[0] for e in ev if snap and e[1] == snap[1]]
            seen.append(snap[2] if snap else None)
            if 'say' in frame:
                if frame.index('say') < frame.index('snap'): raise Exception('the debug picture shows what the buddy says (speech drawn before the picture was taken)')
                return
    finally:
        pg.evaluate("drawSpeech=__pq.say;screenSnapshot=__pq.snap;0")
    raise Exception(f'the buddy’s speech wasn’t drawn in the frame of the debug picture (three tries: {seen})')


# phase 13: the game's own full test (self-test.js, Settings → Help), which the owner runs on a phone, runs here too, so a
# change that breaks it shows before the phone does. Software drawing is slow: selfTest.slow = 3 stretches its waits
# and limits, and its frame rates mean nothing here. A step that ran out of time is a note; any other failure is a
# problem
def start_for_in_game_test(pg):
    play(pg)
    pg.evaluate("uiState.mq=[];uiState.modal=null;renderOverlay();0")


def run_in_game_test(pg, only, diag, sec):
    pg.evaluate(f"selfTest.slow=3;selfTest.only={json.dumps(only)};{'runDiagnostics' if diag else 'runFullTest'}();0")
    if not until(pg, '!selfTest.on&&!!(debugLog.bench&&debugLog.bench.result)', sec): raise Exception(f'the in-game test didn’t finish in {sec} s (at {pg.evaluate("debugLog.bench&&debugLog.bench.step")})')
    r = json.loads(pg.evaluate("JSON.stringify((({kind,seconds,errors,phases})=>({kind,seconds,errors,phases:phases.map(p=>({name:p.name,ok:p.ok,why:p.why||p.note||''}))}))(debugLog.bench.result))"))
    late = [p for p in r['phases'] if not p['ok'] and p['why'].startswith('took longer than')]
    bad = [p for p in r['phases'] if not p['ok'] and p not in late]
    for p in late: notes.append(f'in-game {r["kind"]} test: {p["name"]} {p["why"]} (software drawing)')
    if bad or r['errors']: raise Exception(f'in-game {r["kind"]} test: ' + '; '.join([f'{p["name"]}: {p["why"]}' for p in bad] + r['errors'][:4]))
    return r


# a stand-in account and friends list that only record what would be written, and a record of what goes into this
# browser's storage while the test runs; save() leaves a write waiting, as a player's last move would
SAVE_SPY = r"""(()=>{window.__st={w:[],ls:[]};account.user={uid:'check',name:'Check'};
  account.db={collection:c=>({doc:d=>({set:o=>{__st.w.push({c,during:selfTest.on,team:o.json?JSON.parse(o.json).team.map(m=>m.uid):null});return Promise.resolve()}})})};
  friends.on=true;friends.uid='check';friends.pubT=0;
  const si=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(selfTest.on)__st.ls.push(k);return si.call(this,k,v)};
  save();__st.team=saveData.team.map(m=>m.uid)})();0"""


@step('Actions sheet: a wheel never opens it; its button and Tab do; Esc, Tab and its buttons close it; the hub marker; a run\'s status', 150)
def actions_sheet_step(b, base, R):
    """the Actions sheet (walk-tab.js walkSheetSync) is a <pb-sheet> over the world: it used to be page content under the
    scene, so a mouse wheel scrolled it into view. In the hub: wheel, button, Esc, Tab, a "show me the way" that closes
    it and marks the ranch. The full check also opens a run's sheet for its day, type and weather"""
    errs = []
    ctx = b.new_context(viewport={'width': 1280, 'height': 800}, device_scale_factor=1); ctx.add_init_script(CLOCK); ctx.add_init_script(NO_ACCOUNTS); ctx.add_init_script(TEST_GLOBALS)
    ctx.set_default_timeout(90000); pg = ctx.new_page(); CUR['pg'] = pg
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(console_text(m)) if m.type == 'error' else None)
    is_open = "[uiState.walkSheet,!!document.querySelector('#walkSheet[open]')]"
    def ready(fix):
        pg.goto(base + f'/index.html?fixture={fix}'); pg.evaluate(LOW_RENDER)
        pg.wait_for_function("typeof walkView!=='undefined'&&walkView.ready&&!!document.querySelector('.wh-down')", timeout=90000)
        # a waiting window or a postcard would take the clicks: none
        pg.evaluate("uiState.modal=null;uiState.mq=[];uiState.toastQ=[];uiState.toastOn=false;renderOverlay();document.querySelectorAll('.pcard-wrap').forEach(e=>e.remove());0")
    try:
        ready('town')
        pg.mouse.move(640, 400)
        for dy in (400, 400, -400, 400): pg.mouse.wheel(0, dy); time.sleep(.15)
        if pg.evaluate(is_open) != [False, False] or pg.evaluate('scrollY') != 0:
            raise Exception(f'a mouse wheel opened the sheet or scrolled the page: {pg.evaluate(is_open)}, scrollY {pg.evaluate("scrollY")}')
        pg.evaluate("document.querySelector('.wh-down').click()")
        if not until(pg, "!!document.querySelector('#walkSheet[open]')", 5): raise Exception('the Actions button did not open the sheet')
        acts = pg.evaluate("[...document.querySelectorAll('#walkSheet [data-a]')].map(e=>e.dataset.a)")
        for want in ('walkrun', 'walkmark'):
            if want not in acts: raise Exception(f'the hub sheet has no {want} button: {acts}')
        for gone in ('stoptrip', 'rest', 'customize'):
            if gone in acts: raise Exception(f'the sheet still has {gone}: {acts}')
        pg.keyboard.press('Escape')
        if not until(pg, "!uiState.walkSheet&&!document.querySelector('#walkSheet[open]')", 5): raise Exception('Esc did not close the sheet')
        pg.evaluate("document.activeElement&&document.activeElement.blur&&document.activeElement.blur();0")
        pg.keyboard.press('Tab')
        if not until(pg, "!!document.querySelector('#walkSheet[open]')", 5): raise Exception('Tab did not open the sheet')
        if not until(pg, "!!document.activeElement&&!!document.activeElement.closest('#walkSheet')", 5): raise Exception('Tab opened the sheet without its first button taking the focus')
        pg.keyboard.press('Tab')
        if not until(pg, "!uiState.walkSheet", 5): raise Exception('Tab did not close the sheet')
        pg.evaluate("document.querySelector('.wh-down').click()"); until(pg, "!!document.querySelector('#walkSheet [data-a=walkmark][data-k=ranch]')", 5)
        pg.evaluate("document.querySelector('#walkSheet [data-a=walkmark][data-k=ranch]').click()")
        m = pg.evaluate("[uiState.walkSheet, walkView.mark&&walkView.mark.act]")
        if m != [False, 'ranch']: raise Exception(f'"show me the way" to the ranch: sheet open, marker {m}')
        out = ['wheel ×4: closed, no scroll', 'button, Esc, Tab, Tab', 'the ranch marked, the sheet closed']
        if not SMOKE:
            ready('run')
            pg.evaluate("document.querySelector('.wh-down').click()")
            if not until(pg, "!!document.querySelector('#walkSheet .ws-status pb-day-chip')", 5): raise Exception("a run's sheet has no day chip")
            t = pg.evaluate("document.querySelector('#walkSheet .ws-status').innerText")
            if 'Today' not in t or not pg.evaluate("!!document.querySelector('#walkSheet [data-a=tab][data-t=map]')"):
                raise Exception(f"a run's sheet lacks today's weather or the way on: {t!r}")
            out.append("a run's day, type and weather: " + ' / '.join(x for x in t.splitlines() if x.strip())[:120])
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    finally:
        ctx.close()


@step('Safety: hostile names on every screen stay text (phase 06-4)', 240)
def safety_step(b, base, R):
    """phase 06 "done when": no untrusted value is built into the page as markup. Names a player or a friend controls get
    an HTML payload written straight into the save and the friend data (as an imported save or the server could), past
    the cleaning names get when typed; then every screen opens and nothing the payload carries may exist or have run"""
    errs = []
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1); ctx.add_init_script(CLOCK); ctx.add_init_script(NO_ACCOUNTS); ctx.add_init_script(TEST_GLOBALS)
    ctx.set_default_timeout(90000); pg = ctx.new_page(); CUR['pg'] = pg
    pg.on('pageerror', lambda e: errs.append(str(e)))
    try:
        pg.goto(base + '/index.html?fixture=town'); pg.evaluate(LOW_RENDER)
        if not until(pg, "typeof walkView!=='undefined'&&walkView.ready", 120): raise Exception('the town never opened')
        pg.evaluate("""(()=>{const X='<img src=x data-pwn=1 onerror="window.__pwn=(window.__pwn||0)+1"><b data-pwn=1>x</b>';window.__X=X;
          uiState.modal=null;uiState.mq=[];renderOverlay();
          saveData.avatar.name='Ann'+X;saveData.team[0].nick='Nick'+X;
          if(saveData.team[1])saveData.team[1].nick=X;
          /* a friend (as the server would send it) and a friend request */
          accountOn=()=>true;friendsOn=()=>true;friends.code='C0DE'+X;friends.list=['u1'];
          friends.data.u1={name:'Friend'+X,at:{place:'Place'+X,node:0,t:Date.now()},partner:{sp:saveData.team[0].sp,name:'Pal'+X,lvl:5}};
          friends.inc=[{id:'r1'+X,status:'pending',fromName:'Req'+X}];friends.out=[];
          notice({id:'pwn',title:'A letter',html:'<p>hello</p>'});0})()""")
        def check(where):
            n = pg.evaluate("""(()=>{let n=document.querySelectorAll('[data-pwn]').length;
              for(const h of document.querySelectorAll('*'))if(h.shadowRoot)n+=h.shadowRoot.querySelectorAll('[data-pwn]').length;
              return n+(window.__pwn||0)})()""")
            if n: raise Exception(f'markup from a name got into the page at: {where}')
        shown = []
        for tab in ['walk', 'team', 'ledger', 'profile', 'bag']:
            pg.evaluate(f"uiState.tab='{tab}';render();0"); time.sleep(.5); check(tab); shown.append(tab)
        for k in ['sum', 'build', 'moves', 'evo']:
            pg.evaluate(f"uiState.modal=null;uiState.mq=[];renderOverlay();billySheet(saveData.team[0]);document.querySelector('[data-a=ms-tab][data-k={k}]')?.click();0"); time.sleep(.3); check('details ' + k)
        shown.append('details')
        for k in ['sound', 'graphics', 'controls', 'access', 'game', 'save', 'help']:
            pg.evaluate(f"uiState.modal=null;uiState.mq=[];renderOverlay();openSettings();document.querySelector('[data-a=set-tab][data-k={k}]')?.click();0"); time.sleep(.3); check('settings ' + k)
        shown.append('settings')
        pg.evaluate(CHECK_SHOP + "uiState.modal=null;uiState.mq=[];renderOverlay();openShop('check_shop');0"); time.sleep(.4); check('shop'); shown.append('shop')
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();document.querySelector('[data-a=inbox]')?.click();0"); time.sleep(.4); check('inbox'); shown.append('inbox')
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();toast(saveData.team[0].nick+' leads the team now.');talkLine('me',saveData.avatar.name+' says hi.');0"); time.sleep(.6); check('toast and dialogue'); shown.append('toast'); shown.append('dialogue')
        pg.evaluate("talkHide();uiState.modal=null;uiState.mq=[];renderOverlay();openDressingRoom({});0"); time.sleep(1); check('dressing room'); shown.append('dressing room')
        pg.evaluate("typeof closeDressingRoom==='function'&&closeDressingRoom();screenWipe=f=>f();saveData.team.forEach(m=>{m.hp=maxHp(m)});const q={id:'tq',sp:saveData.team[0].sp,lvl:3,no:1};saveData.queue=[q];startWild(q);0")
        if wait_phase(pg, ('choose',), 120) != 'choose': raise Exception('the battle never reached the move menu')
        time.sleep(.5); check('battle'); shown.append('battle')
        pg.evaluate("stopTimers();activeBattle=null;battleStageStop();render();0")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return f'a payload in the trainer, nicknames, a friend, a request and the friend code stayed text on {len(shown)} screens: ' + ', '.join(shown)
    finally:
        ctx.close()


@step('Tap targets: every control on the main screens is big enough to tap (phase 06-4)', 240)
def targets_step(b, base, R):
    """phase 06-4 accessibility: on a 390 px phone every visible control is at least 40 px each way, or one of the small
    icon controls that carry an invisible margin (game/css/menus.css: 7 px all round)"""
    errs = []
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1); ctx.add_init_script(CLOCK); ctx.add_init_script(NO_ACCOUNTS); ctx.add_init_script(TEST_GLOBALS)
    ctx.set_default_timeout(90000); pg = ctx.new_page(); CUR['pg'] = pg
    pg.on('pageerror', lambda e: errs.append(str(e)))
    small = """(where)=>{const out=[];const pad=e=>e.matches('.wh-x,.mbtn,.swatch,.tb-btn,.qb')?14:0;
      for(const e of document.querySelectorAll('button,a[href],[role=button],[role=tab],input,select,[data-a]')){
        if(e.closest('[hidden],.dbg'))continue;const r=e.getBoundingClientRect();if(!r.width||!r.height||r.bottom<0||r.top>innerHeight)continue;
        const cs=getComputedStyle(e);if(cs.visibility==='hidden'||cs.display==='none'||+cs.opacity===0)continue;
        const m=Math.min(r.width,r.height)+pad(e);if(m<39.5)out.push(where+': '+(e.dataset.a||e.className||e.tagName)+' '+Math.round(r.width)+'x'+Math.round(r.height))}
      return [...new Set(out)]}"""
    try:
        pg.goto(base + '/index.html?fixture=town'); pg.evaluate(LOW_RENDER)
        if not until(pg, "typeof walkView!=='undefined'&&walkView.ready", 120): raise Exception('the town never opened')
        pg.add_style_tag(content='*,*::before,*::after{animation:none!important;transition:none!important}')
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();saveData.team.forEach(m=>{m.evoNo=m.lvl});0")
        bad = []
        for tab in ['walk', 'team', 'ledger', 'profile', 'bag']:
            pg.evaluate(f"uiState.modal=null;uiState.mq=[];renderOverlay();uiState.tab='{tab}';render();scrollTo(0,0);0"); time.sleep(.6)
            bad += pg.evaluate(small, tab)
        for name, js in [('details', "billySheet(saveData.team[0])"), ('settings', "openSettings()"), ('shop', CHECK_SHOP + "openShop('check_shop')"), ('dressing room', "openDressingRoom({})")]:
            pg.evaluate(f"uiState.modal=null;uiState.mq=[];renderOverlay();uiState.tab='walk';render();{js};0"); time.sleep(.8)
            bad += pg.evaluate(small, name)
        if bad: raise Exception(f'{len(bad)} controls too small to tap: ' + '; '.join(bad[:8]))
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return 'every control on 9 screens is 40 px or more, or an icon with its 7 px tap margin'
    finally:
        ctx.close()


@step('Sound settings: each slider sets its bus and sounds on it when let go, each row mutes its bus, the header mute keeps the levels (SND-1, UI-7a)', 120)
def sound_step(b, base, R):
    """sound track SND-1: Settings → Sound on a 390 px phone. UI-7a: each slider, let go, must play its sound on its own
    bus (a wrapper on AudioNode.connect lists what each release connects to; the music is stopped first, as the music
    slider plays nothing over a song); each slider, dragged, must set its bus to soundLevels() at once; each row's mute
    button silences its own bus and keeps its level, and dragging the muted slider unmutes it; the mute button beside
    the title silences the master and keeps every level. Nothing is heard: only the connections and the targets the gains are given are read. A browser that won't start audio is
    reported, not failed, like the world-sounds step"""
    errs = []
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
    for s in (CLOCK, NO_ACCOUNTS, TEST_GLOBALS): ctx.add_init_script(s)
    ctx.set_default_timeout(90000); pg = ctx.new_page(); CUR['pg'] = pg
    pg.on('pageerror', lambda e: errs.append(str(e)))
    try:
        pg.goto(base + '/index.html?fixture=town'); pg.evaluate(LOW_RENDER)
        if not until(pg, "typeof walkView!=='undefined'&&walkView.ready", 120): raise Exception('the town never opened')
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();openSettings('sound');0"); time.sleep(.8)
        pg.click('.sheet h2')   # a touch unlocks sound, as on a phone
        until(pg, "typeof soundEngine!=='undefined'&&!!soundEngine.ctx&&soundEngine.ctx.state==='running'", 8)
        state = pg.evaluate("typeof soundEngine==='undefined'||!soundEngine.ctx?'no sound in this browser':soundEngine.ctx.state")
        if state != 'running': return f'not checked: {state if state.startswith("no ") else "sound not started (" + state + ")"}'
        if not until(pg, "!!ambience.bus&&!!ambience.amb", 10): raise Exception('the world and ambience buses never started in the town')
        pg.evaluate("""(()=>{const B={master:[soundEngine.master],music:[soundEngine.mus],sfx:[soundEngine.fx],world:[ambience.bus],amb:[ambience.amb,ambience.lpA].filter(Boolean)};
          window.__snd={B,hit:new Set(),to:new Map()};const c=AudioNode.prototype.connect;window.__sndConnect=c;
          const st=AudioParam.prototype.setTargetAtTime;window.__sndTarget=st;AudioParam.prototype.setTargetAtTime=function(v,...a){__snd.to.set(this,v);return st.call(this,v,...a)};
          AudioNode.prototype.connect=function(d,...a){for(const [k,L] of Object.entries(__snd.B))if(L.includes(d))__snd.hit.add(k);return c.call(this,d,...a)}})();0""")
        if pg.query_selector('[data-a=aud-test]'): raise Exception('a Test button is still in the Sound tab')
        missed = []
        for k in ['master', 'music', 'sfx', 'world', 'amb']:
            pg.evaluate("musicStop();__snd.hit=new Set();0")
            pg.evaluate(f"document.querySelector('input[data-preference={k}]').dispatchEvent(new Event('change',{{bubbles:true}}));0")
            until(pg, f"__snd.hit.has('{k}')", 4)   # the sound starts 60 ms after the slider is let go
            hit = pg.evaluate("[...__snd.hit]")
            if k not in hit: missed.append(f'{k} slider reached {", ".join(sorted(hit)) or "no bus"}')
        if missed: raise Exception('a slider, let go, played somewhere else: ' + '; '.join(missed))
        # what the bus must be set to is worked out from where the slider stands, not from the saved preference: without
        # the live listener neither moves while the slider is held, so the two would agree. The target each gain is
        # given is read (the setTargetAtTime wrapper), not gain.value: Chrome stops working out a gain no sound goes
        # through, so an idle bus's value can stop part way (seen on the effects bus at 0.13 on its way to 0.09)
        bus = "({master:soundEngine.master,music:soundEngine.mus,sfx:soundEngine.fx,world:ambience.bus,amb:ambience.amb})"
        off = []
        for k, v in [('master', 70), ('music', 40), ('sfx', 30), ('world', 60), ('amb', 20)]:
            want = f"(soundLevels({{{k}:{v / 100}}},MUSIC.mix).{k}*({'ambienceFadeIn()*soundBedDuck()' if k in ('world', 'amb') else '1'}))"
            pg.evaluate(f"(()=>{{const e=document.querySelector('input[data-preference={k}]');e.value='{v}';e.dispatchEvent(new Event('input',{{bubbles:true}}))}})();0")
            # no 'change' event: the level must follow while the slider is still held
            if not until(pg, f"Math.abs(__snd.to.get({bus}.{k}.gain)-{want})<0.02", 4):
                have, w = pg.evaluate(f"[__snd.to.has({bus}.{k}.gain)?+__snd.to.get({bus}.{k}.gain).toFixed(3):'not set',+{want}.toFixed(3)]")
                off.append(f'{k} at {v}: bus set to {have}, wanted {w}')
        if off: raise Exception('a slider didn’t set its bus while dragged: ' + '; '.join(off))
        # UI-7a: each row's own mute (the Volume row's is the master mute)
        rows = []
        for k in ['music', 'sfx', 'world', 'amb', 'master']:
            lv = pg.evaluate(f"saveData.preferences.{k}")
            pg.click(f'.vol-mute[data-k={k}]')
            if not until(pg, f"__snd.to.get({bus}.{k}.gain)===0", 4): rows.append(f'{k}: its mute didn’t silence its bus'); continue
            r = pg.evaluate(f"({{pressed:document.querySelector('.vol-mute[data-k={k}]').getAttribute('aria-pressed'),lv:saveData.preferences.{k},others:['music','sfx','world','amb'].filter(o=>o!=='{k}'&&'{k}'!=='master'&&__snd.to.get({bus}[o].gain)===0)}})")
            if r['pressed'] != 'true' or r['lv'] != lv or r['others']: rows.append(f'{k}: {r}')
            pg.evaluate(f"(()=>{{const e=document.querySelector('input[data-preference={k}]');e.dispatchEvent(new Event('input',{{bubbles:true}}))}})();0")
            if not until(pg, f"__snd.to.get({bus}.{k}.gain)>0&&document.querySelector('.vol-mute[data-k={k}]').getAttribute('aria-pressed')==='false'", 4):
                rows.append(f'{k}: dragging the muted slider didn’t unmute it')
        if rows: raise Exception('a row’s mute went wrong: ' + '; '.join(rows))
        levels = pg.evaluate("JSON.stringify(['master','music','sfx','world','amb'].map(k=>saveData.preferences[k]))")
        pg.click('.set-mute'); until(pg, "!!saveData.preferences.mute&&__snd.to.get(soundEngine.master.gain)===0", 5)
        m = pg.evaluate("({mute:!!saveData.preferences.mute,pressed:document.querySelector('.set-mute').getAttribute('aria-pressed'),row:document.querySelector('.vol-mute[data-k=master]').getAttribute('aria-pressed'),master:__snd.to.get(soundEngine.master.gain),levels:JSON.stringify(['master','music','sfx','world','amb'].map(k=>saveData.preferences[k]))})")
        if not m['mute'] or m['pressed'] != 'true' or m['row'] != 'true' or m['master'] > 0.01: raise Exception(f'the header mute didn’t mute: {m}')
        if m['levels'] != levels: raise Exception(f'muting changed the levels: {levels} became {m["levels"]}')
        pg.click('.set-mute'); until(pg, "!saveData.preferences.mute&&Math.abs(__snd.to.get(soundEngine.master.gain)-soundLevels(saveData.preferences,MUSIC.mix).master)<0.02", 5)
        back = pg.evaluate("[!!saveData.preferences.mute,+__snd.to.get(soundEngine.master.gain).toFixed(3),+soundLevels(saveData.preferences,MUSIC.mix).master.toFixed(3)]")
        if back[0] or abs(back[1] - back[2]) > 0.02: raise Exception(f'the header mute didn’t unmute: mute {back[0]}, master {back[1]}, wanted {back[2]}')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return 'five sliders sounded on their own buses when let go and set their bus while dragged; five row mutes silenced their own bus and came back on a drag; the header mute silenced the master, kept the levels and came back'
    finally:
        try: pg.evaluate("window.__sndConnect&&(AudioNode.prototype.connect=__sndConnect);window.__sndTarget&&(AudioParam.prototype.setTargetAtTime=__sndTarget);0")
        except Exception: pass
        ctx.close()


@step('Debug menu: nine sections, plain labels, search, remembered sections, a message per button (UI-7c)', 60)
def debug_menu_step(b, base, R):
    """UI-7c: the debug menu on a 390 px phone: the nine sections in their order, no phase or track code in what it
    says, one copy of each test, the search box narrowing the buttons and putting the sections back, the open sections
    kept across closing and opening, and a button saying what it changed (not "Done.")"""
    errs = []
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
    for s in (CLOCK, NO_ACCOUNTS, TEST_GLOBALS): ctx.add_init_script(s)
    ctx.set_default_timeout(90000); pg = ctx.new_page(); CUR['pg'] = pg
    pg.on('pageerror', lambda e: errs.append(str(e)))
    try:
        pg.goto(base + '/index.html?fixture=town'); pg.evaluate(LOW_RENDER)
        if not until(pg, "typeof walkView!=='undefined'&&walkView.ready", 120): raise Exception('the town never opened')
        pg.evaluate("localStorage.removeItem('pb-debug-open');uiState.modal=null;uiState.mq=[];renderOverlay();openDebug();0"); time.sleep(.5)
        keys = pg.evaluate("[...document.querySelectorAll('.dbg details[data-k]')].map(d=>d.dataset.k)")
        want = ['tests', 'give', 'billies', 'battle', 'run', 'places', 'story', 'ranch', 'save']
        if keys != want: raise Exception(f'sections {keys}, wanted {want}')
        text = pg.evaluate("document.querySelector('.dbg').textContent")
        codes = sorted(set(re.findall(r'\b(?:[Pp]hase \d+|(?:RL|UI|TR|ST|MG|IS|SND|CAM)-\d+|v\d{2}\b|S\d\b)', text)))
        if codes: raise Exception('phase or track codes in the menu: ' + ', '.join(codes))
        dup = pg.evaluate("(()=>{const n={};document.querySelectorAll('.dbg button').forEach(b=>{const k=b.dataset.a+':'+(b.dataset.x||'');n[k]=(n[k]||0)+1});return Object.keys(n).filter(k=>n[k]>1)})()")
        if dup: raise Exception('buttons in the menu twice: ' + ', '.join(dup))
        shown = "[...document.querySelectorAll('.dbg button')].filter(b=>b.offsetParent).map(b=>b.textContent)"
        pg.fill('#dbgFind', 'scrap'); time.sleep(.3)
        found = pg.evaluate(shown)
        if found != ['+50 Scrap']: raise Exception(f'searching "scrap" left {found}')
        pg.fill('#dbgFind', ''); time.sleep(.3)
        back = pg.evaluate("[...document.querySelectorAll('.dbg details[data-k]')].filter(d=>d.open&&!d.hidden).map(d=>d.dataset.k)")
        if back != ['tests']: raise Exception(f'clearing the search left open {back}, wanted tests alone')
        pg.click('.dbg details[data-k=give] summary'); pg.click('.dbg details[data-k=tests] summary'); time.sleep(.3)
        pg.evaluate("closeModal();0"); time.sleep(.3); pg.evaluate("openDebug();0"); time.sleep(.5)
        kept = pg.evaluate("[...document.querySelectorAll('.dbg details[data-k]')].filter(d=>d.open).map(d=>d.dataset.k)")
        if kept != ['give']: raise Exception(f'reopened with {kept} open, wanted give alone')
        se = pg.evaluate("saveData.se")
        pg.click('.dbg [data-x=se1]'); time.sleep(.3)
        said = pg.evaluate("JSON.stringify([uiState.toastOn,...(uiState.toastQ||[])].filter(Boolean).map(t=>t.text))")
        if 'you have $' not in said or 'Done.' in said: raise Exception(f'+$1,000 said {said[:160]}')
        if pg.evaluate("saveData.se") != se + 1000: raise Exception('+$1,000 didn’t add $1,000')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return 'nine sections in order, no phase codes, each button once, search narrowed to +50 Scrap and put the sections back, Give me kept open across reopening, +$1,000 said what it changed'
    finally:
        ctx.close()


@step('Song fingerprints: every song, jingle and cry renders as in validation/sound-baseline (SND-2)', 180)
def sound_fingerprints(b, base, R):
    """sound track SND-2: tools/check-sound.py on this browser. Every song (day and night), jingle and cry is rendered
    offline through the game's own sound code and compared, 50 ms at a time, with the committed baseline. A change
    in what the music sounds like is a problem here unless the baseline was written again on purpose (--baseline)"""
    import importlib.util
    spec = importlib.util.spec_from_file_location('check_sound', ROOT / 'tools' / 'check-sound.py')
    cs = importlib.util.module_from_spec(spec); spec.loader.exec_module(cs)
    bad, line = cs.run(b, base)
    if bad: raise Exception(f'{line}: ' + '; '.join(bad[:4]))
    return line


BIOME_SONGS = {'meadow': 'meadow', 'thicket': 'spore', 'jungle': 'spore', 'lake': 'trench', 'sea': 'trench', 'canyon': 'hills',
               'badlands': 'hills', 'volcano': 'innersun', 'tundra': 'crystal', 'ridge': 'crystal', 'autumn': 'spire'}


@step("Run music: the run fixture's landing plays route, each node its biome's song, a town node town (SND-2), in its row's arc band (SND-5)", 180)
def run_music_step(b, base, R):
    """sound track SND-2: the run fixture (seed RL7FIXTURE, the landing on day 1). musicFor picks route on the landing;
    for every place of the run, what it picks follows its node (a town node town, the landing route, any other node its
    biome's song, the owner's mapping); on a route node, the music sync (musicSync, called there) asks for that biome's
    song. SND-5: each walkable node plays its row's arc band (music.json run.arc: 'meadow@mid' on rows 3-5,
    '@late' on 6-8), a town node and the landing the song as written; the sync asks for the band, and on the deadline
    day for the deadline version. Nothing is
    heard: soundEngine.want is what the game asked to play (headless, sound never starts without a touch)"""
    errs = []
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
    for s in (CLOCK, NO_ACCOUNTS, TEST_GLOBALS): ctx.add_init_script(s)
    ctx.set_default_timeout(90000); pg = ctx.new_page(); CUR['pg'] = pg
    pg.on('pageerror', lambda e: errs.append(str(e)))
    try:
        pg.goto(base + '/index.html?fixture=run'); pg.evaluate(LOW_RENDER)
        if not until(pg, "typeof walkView!=='undefined'&&walkView.ready&&!!saveData.run", 150): raise Exception('the run fixture never opened')
        if pg.evaluate('saveData.trip.node') != 1: raise Exception('not on the landing')
        if not until(pg, "soundEngine.want==='route'", 10): raise Exception(f'the landing asked for {pg.evaluate("soundEngine.want")!r}, not route')
        places = pg.evaluate("""(()=>{const n0=saveData.trip.node,out=[];
          for(let n=1;n<LOCATIONS.length;n++){const L=LOCATIONS[n],N=saveData.run.map.nodes[L.runNode];
            saveData.trip.node=n;const st=musicState();out.push({n,name:L.name,type:N.type,biome:N.biome||'',row:N.row,song:musicFor(),
              plays:songVariant(musicFor(),{...st,night:0},SONGS,null,MUSIC.run)})}
          saveData.trip.node=n0;return out})()""")
        bad = []; seen = {}
        for P in places:
            want = 'town' if P['type'] == 'town' else 'route' if P['type'] == 'landing' else BIOME_SONGS.get(P['biome'])
            seen[P['song']] = seen.get(P['song'], 0) + 1
            if P['song'] != want: bad.append(f"{P['name']} ({P['type']}, {P['biome']}): {P['song']}, not {want}")
            band = None if P['type'] in ('town', 'landing') else 'mid' if 3 <= P['row'] <= 5 else 'late' if 6 <= P['row'] <= 8 else None
            if P['plays'] != (want + '@' + band if band else want): bad.append(f"{P['name']} (row {P['row']}): plays {P['plays']}, not in its band {band}")
            if band: seen['@' + band] = seen.get('@' + band, 0) + 1
        if bad: raise Exception('; '.join(bad[:5]))
        route = next((P for P in places if P['type'] == 'route' and P['row'] >= 3), None) or next((P for P in places if P['type'] == 'route'), None)
        if not route: raise Exception('the fixture run has no route node')
        # the node and the sync in one go: the walk view puts trip.node back where the player stands (the landing)
        got = pg.evaluate(f"(()=>{{const n0=saveData.trip.node;saveData.trip.node={route['n']};musicSync();const w=soundEngine.want;saveData.trip.node=n0;return w}})()")
        if got != route['plays']: raise Exception(f"standing in {route['name']} the music sync asked for {got!r}, not {route['plays']}")
        # SND-5: on the deadline day (music.json run.deadlineDays 1) the sync asks for the deadline version
        late = pg.evaluate(f"(()=>{{const R=saveData.run,c=R.clock,n0=saveData.trip.node;R.clock=R.deadline;saveData.trip.node={route['n']};musicSync();const w=soundEngine.want;R.clock=c;saveData.trip.node=n0;return [w,R.deadline]}})()")
        if late[0] != route['song'] + '@deadline': raise Exception(f"on the deadline day (day {late[1]}) the sync asked for {late[0]!r}, not {route['song']}@deadline")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return f"{len(places)} places: " + ', '.join(f'{k} {v}' for k, v in sorted(seen.items())) + f"; in {route['name']} ({route['biome']}, row {route['row']}) the sync asked for {route['plays']}, on the deadline day (day {late[1]}) for {late[0]}"
    finally:
        ctx.close()


@step("Battle music: the song starts on the flash with its intro, the drums wait for the throw; a mini-boss plays the leader song (SND-5)", 180)
def battle_music_step(b, base, R):
    """sound track SND-5: the run fixture, sound unlocked by a tap. A wild battle: soundEngine.log (the music's cues,
    in memory) must show the battle's song starting with its intro on the encounter's flash, and the drums coming in
    on the first throw, after the player taps through to it (not by the 8 s fallback); then the run's first mini-boss
    plays the leader song the same way"""
    errs = []
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
    for s in (CLOCK, NO_ACCOUNTS, TEST_GLOBALS): ctx.add_init_script(s)
    ctx.set_default_timeout(90000); pg = ctx.new_page(); CUR['pg'] = pg
    pg.on('pageerror', lambda e: errs.append(str(e)))
    def fight(start, kind, song):
        pg.evaluate("soundEngine.log.length=0;0")
        pg.evaluate(start)
        if not until(pg, "soundEngine.log.some(e=>e.e.startsWith('battle '))", 6): raise Exception(f'{kind}: no battle cue')
        held = pg.evaluate("!!(soundEngine.song&&soundEngine.song.hold)")
        # the player taps through the opening lines; the throw ('enter') lets the drums in
        # (in a run the battle can begin again from its seed at once, "The battle starts again.": its cue comes again)
        if not until(pg, "soundEngine.log.some(e=>e.e==='drums in')", 15, "uiState.evReady&&nextEvent()"): raise Exception(f'{kind}: the drums never came in on a throw ({pg.evaluate("JSON.stringify(soundEngine.log)")})')
        L = pg.evaluate("soundEngine.log.map(e=>e.e)"); T = pg.evaluate("soundEngine.log.map(e=>e.at)")
        d = L.index('drums in'); c = max(i for i in range(d) if L[i].startswith('battle '))
        cue = L[c]
        if cue != f'battle {kind}: {song}, its intro': raise Exception(f'{kind}: the cue was {cue!r}')
        if not held: raise Exception(f'{kind}: the drums were not held at the flash')
        gap = T[d] - T[c]
        if gap >= 8000: raise Exception(f'{kind}: the drums came in {gap} ms after the flash, past the 8 s fallback')
        return f"{song} with its intro, drums in {gap} ms later on the throw"
    try:
        pg.goto(base + '/index.html?fixture=run'); pg.evaluate(LOW_RENDER)
        if not until(pg, "typeof walkView!=='undefined'&&walkView.ready&&!!saveData.run", 150): raise Exception('the run fixture never opened')
        pg.mouse.click(200, 300)
        if not until(pg, "!!soundEngine.ctx&&soundEngine.ctx.state==='running'", 8): return 'not checked: sound did not start in this browser'
        a = fight("screenWipe=f=>f();const q={id:'tbm',sp:'swift1',lvl:3,no:1};encountersHere().splice(0,1e9,q);saveData.team.forEach(m=>{m.hp=maxHp(m)});startWild(q);0", 'wild', 'wild')
        pg.evaluate("closeModal();activeBattle=null;0")
        boss = pg.evaluate("Object.keys(TRAINERS).find(k=>TRAINERS[k].runFoe==='miniboss')")
        if not boss: raise Exception('the run fixture has no mini-boss')
        c = fight(f"saveData.team.forEach(m=>{{m.hp=maxHp(m)}});startTrainer('{boss}');0", 'leader', 'leader')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return f'wild: {a}; mini-boss {boss}: {c}'
    finally:
        ctx.close()


@step("Run map music hears the forecast: on a run's map tab, today's storm or rain where you stand muffles the map song, clear opens it (SND-5)", 180)
def run_map_weather_step(b, base, R):
    """sound track SND-5: the run fixture, sound unlocked by a tap. Today's forecast where the player stands is set to
    storm, then rain, then clear; on the map tab the music's low-pass is given music.json run.weather's cut for it
    (read through a wrapper on setTargetAtTime, as the Sound settings step does: Chrome stops working out a param no
    sound goes through). Back on the walk tab the old rain filter decides again"""
    errs = []
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
    for s in (CLOCK, NO_ACCOUNTS, TEST_GLOBALS): ctx.add_init_script(s)
    ctx.set_default_timeout(90000); pg = ctx.new_page(); CUR['pg'] = pg
    pg.on('pageerror', lambda e: errs.append(str(e)))
    try:
        pg.goto(base + '/index.html?fixture=run'); pg.evaluate(LOW_RENDER)
        if not until(pg, "typeof walkView!=='undefined'&&walkView.ready&&!!saveData.run", 150): raise Exception('the run fixture never opened')
        pg.mouse.click(200, 300)
        if not until(pg, "!!soundEngine.ctx&&soundEngine.ctx.state==='running'", 8): return 'not checked: sound did not start in this browser'
        pg.evaluate("window.__cut=[];const f=soundEngine.musLP.frequency,o=f.setTargetAtTime.bind(f);f.setTargetAtTime=(v,t,c)=>{__cut.push(v);return o(v,t,c)};0")
        setw = "(w=>{const R=saveData.run,i=LOCATIONS[saveData.trip.node].runNode;R.forecast[runWorldNode(i)][R.clock-1]=w})"
        pg.evaluate("uiState.tab='map';render();0"); seen = []
        for w in ('storm', 'rain', 'clear'):
            want = pg.evaluate(f"{setw}('{w}');musicWeatherCut('{w}',MUSIC.run)")
            if not until(pg, f"__cut.length&&__cut[__cut.length-1]==={want}", 4): raise Exception(f"{w} on the map tab: the low-pass was given {pg.evaluate('__cut.slice(-1)[0]')}, not {want}")
            seen.append(f'{w} {want} Hz')
        if pg.evaluate('soundEngine.want') != 'map': raise Exception(f"the map tab asked for {pg.evaluate('soundEngine.want')!r}, not map")
        pg.evaluate(f"{setw}('storm');uiState.tab='walk';render();0")
        if not until(pg, "__cut[__cut.length-1]!==1400", 4): raise Exception('back on the walk tab the forecast still muffled the music')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return 'map tab: ' + ', '.join(seen) + f"; walk tab: {pg.evaluate('__cut.slice(-1)[0]')} Hz (the place's own weather)"
    finally:
        ctx.close()


@step("Sound effects and jingles: the beds under a song, four UI sounds, a cry as a Billie comes out (its low-HP cry in the red zone), the run's day, reveal, Loophole and payout jingles (SND-6)", 300)
def sound_effects_step(b, base, R):
    """sound track SND-6: the run fixture on a phone, sound unlocked by a tap; soundEngine.log (in memory, never sent)
    says what played. A sheet's gold, quiet and disabled buttons and a tab make confirm, cancel, can't and select
    (tapped, as a player taps). A wild battle with the lead Billie under a quarter: it cries its low-HP cry as it comes
    out, the wild one its own. Walking into the next place: the day jingle, then the reveal jingle (the map shows the
    next rows). A Loophole taken: its jingle. The payout, won: a coin per row a step higher each, then run_won after the
    last coin; lost: run_lost"""
    errs = []
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, has_touch=False)
    for s in (CLOCK, NO_ACCOUNTS, TEST_GLOBALS): ctx.add_init_script(s)
    ctx.set_default_timeout(90000); pg = ctx.new_page(); CUR['pg'] = pg
    pg.on('pageerror', lambda e: errs.append(str(e)))
    log = lambda: pg.evaluate("soundEngine.log.map(e=>e.e)")
    clear = lambda: pg.evaluate("soundEngine.log.length=0;0")
    out = []
    try:
        pg.goto(base + '/index.html?fixture=run'); pg.evaluate(LOW_RENDER)
        if not until(pg, "typeof walkView!=='undefined'&&walkView.ready&&!!saveData.run", 150): raise Exception('the run fixture never opened')
        pg.mouse.click(200, 300)
        if not until(pg, "!!soundEngine.ctx&&soundEngine.ctx.state==='running'", 8): return 'not checked: sound did not start in this browser'
        # (the loader, then) the four UI sounds, on a real sheet's buttons and the bottom bar's tab
        pg.evaluate("modal({title:'Sounds',html:'<p>x</p>',btns:[{l:'Yes',c:'gold',f:closeModal},{l:'No',c:'quiet',f:closeModal},{l:'Locked',c:'dark',dis:1,f:closeModal}]});0")
        if not until(pg, "!document.getElementById('loader')", 30): raise Exception('the loader never went')
        # the mix: under the run's song the world and ambience beds come down by music.json mix bedsUnderSong
        if not until(pg, "!!soundEngine.tracker.song", 8): raise Exception('no song played on the run')
        duck = pg.evaluate("[soundBedDuck(),Math.pow(10,MUSIC.mix.bedsUnderSong/20),soundEngine.tracker.song.name]")
        if abs(duck[0] - duck[1]) > 1e-9 or duck[0] >= 1: raise Exception(f'under {duck[2]} the beds were x{duck[0]}, not x{duck[1]:.3f}')
        out.append(f'beds x{duck[0]:.3f} under {duck[2]}')
        heard = {}; time.sleep(.6)   # the sheet slides in
        for i, want in ((2, 'cant'), (0, 'confirm')):
            clear(); pg.click(f'#ov [data-a="mb"][data-i="{i}"]', force=True); time.sleep(.3); heard[want] = log()
            if not heard[want]: heard[want] = [pg.evaluate(f"(()=>{{const e=document.querySelector('#ov [data-a=\"mb\"][data-i=\"{i}\"]'),r=e.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return 'at '+Math.round(r.x)+','+Math.round(r.y)+' '+(h&&h.outerHTML.slice(0,80))}})()")]
        pg.evaluate("modal({title:'Sounds',html:'<p>x</p>',btns:[{l:'Yes',c:'gold',f:closeModal},{l:'No',c:'quiet',f:closeModal}]});0")
        clear(); pg.click('#ov [data-a="mb"][data-i="1"]'); time.sleep(.3); heard['cancel'] = log()
        clear(); pg.evaluate("(()=>{const t=document.querySelector('[data-a=tab],pb-nav-bar');t&&t.click()})();0"); time.sleep(.3)
        tab = log()
        for want, got in heard.items():
            if ('ui ' + want) not in got: raise Exception(f"the sheet's {want} button made {got}, not ui {want}")
        out.append('buttons: confirm, cancel, cant' + (', a tab select' if 'ui select' in tab else ''))
        # a cry as each side's Billie comes out; the lead in the red zone cries low
        clear()
        pg.evaluate("screenWipe=f=>f();const q={id:'tse',sp:'swift1',lvl:3,no:1};encountersHere().splice(0,1e9,q);saveData.team.forEach(m=>{m.hp=maxHp(m)});saveData.team[0].hp=1;startWild(q);0")
        if not until(pg, "soundEngine.log.some(e=>e.e.startsWith('cry ')&&e.e.endsWith(' low'))", 20, "uiState.evReady&&nextEvent()"): raise Exception(f'no low-HP cry as the lead came out: {log()}')
        cries = [e for e in log() if e.startswith('cry ')]
        if 'cry swift1' not in cries: raise Exception(f'the wild Swift did not cry: {cries}')
        out.append('cries: ' + ', '.join(cries[:3]))
        pg.evaluate("closeModal();activeBattle=null;saveData.team.forEach(m=>{m.hp=maxHp(m)});0")
        # walking into the next place: a day, then the reveal
        n1 = pg.evaluate("(()=>{const R=saveData.run,i=runMapNode(saveData.trip.node);return runWorldNode(runNext(R.map,i)[0])})()")
        day0 = pg.evaluate('saveData.run.clock'); clear()
        try: cross(pg, n1, sec=20)
        except Exception as e:   # the arrival is what counts here; a next view slow to draw headless doesn't
            if pg.evaluate('saveData.trip.node') != n1: raise
        if not until(pg, "soundEngine.log.some(e=>e.e==='jingle reveal')", 6): raise Exception(f'walking into the next place: {log()}')
        L = log()
        if L.index('jingle day') > L.index('jingle reveal'): raise Exception(f'the reveal came before the day: {L}')
        out.append(f"day {day0} to {pg.evaluate('saveData.run.clock')}: day, reveal")
        # a Loophole taken
        clear(); pg.evaluate("(()=>{const R=saveData.run;R.offer=Object.keys(RELICS).slice(0,3);relicPickOpen();relicPickDone(R.offer[0])})();0")
        if 'jingle relic' not in log(): raise Exception(f'a Loophole taken: {log()}')
        out.append('Loophole: relic')
        # the payout: a coin per row, rising, then run_won after the last; then a loss plays run_lost
        clear(); pg.evaluate("closeModal();runOver(true);0")
        if not until(pg, "soundEngine.log.some(e=>e.e==='jingle run_won')", 15): raise Exception(f'the payout, won: {log()}')
        L = log(); coins = [e for e in L if e.startswith('jingle payout_coin')]
        rows = pg.evaluate("JSON.parse(document.querySelector('#ov pb-payout').getAttribute('rows')||'[]').length")
        if len(coins) != rows: raise Exception(f'{len(coins)} coins for {rows} payout rows: {L}')
        if L.index('jingle run_won') < max(i for i, e in enumerate(L) if e.startswith('jingle payout_coin')): raise Exception(f'run_won before the last coin: {L}')
        clear(); pg.evaluate("closeModal();saveData.run.at={phase:'walk',battle:-1};uiState.runPayoutPlayed=false;uiState.runPayoutSung=false;runOver(false);0")
        if not until(pg, "soundEngine.log.some(e=>e.e==='jingle run_lost')", 15): raise Exception(f'the payout, lost: {log()}')
        out.append(f'payout: {len(coins)} coins ({coins[-1].split(" ", 2)[-1] if coins else ""} last), run_won; lost: run_lost')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    finally:
        ctx.close()


@step('In-game full test: one step headless, and nothing is saved while it runs', 120)
def in_game_test_step(b, base, R):
    errs = []; ctx, pg = open_game(b, base, 1100, 700, False, errs)
    try:
        start_for_in_game_test(pg)
        pg.evaluate(SAVE_SPY)
        r = run_in_game_test(pg, ['Shaders'], False, 120)
        # the account write waits 1.5 s after the test puts the save back; on a slow headless page its timer can run late,
        # so wait for it (up to 12 s) instead of a fixed 2.5 s
        until(pg, "__st.w.some(w=>w.c==='saves'&&!w.during)", 12)
        time.sleep(0.5)
        st = pg.evaluate('__st')
        during = [w['c'] for w in st['w'] if w['during']]
        if during or st['ls']: raise Exception(f'written while the test ran: account {during}, this browser {st["ls"]}')
        after = [w for w in st['w'] if w['c'] == 'saves']
        if not after or after[-1]['team'] != st['team']: raise Exception(f'the save wasn’t written back to the account as it was: {after}')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        g = graphics_test_ready(pg)
        names = ', '.join(p['name'] + (' (' + p['why'] + ')' if p['ok'] and p.get('why') else '') for p in r['phases'])
        return f'{names} passed in {r["seconds"]} s; nothing written during it, the save written back after; {g}'
    finally:
        ctx.close()


def graphics_test_ready(pg):
    """The graphics test is only run by players (docs/graphics-bench.md): here it is never started and nothing is
    drawn. Its step list builds, every setting it steps is a real one, every station has a spot to stand on that is
    open ground, and a report made from made-up numbers saves as a JSON file without the player's name."""
    r = pg.evaluate("""(()=>{const sc=mapById(GRAPHICS_TEST_MAP),bad=[];if(!sc)return{bad:['no '+GRAPHICS_TEST_MAP]};
      const plan=graphicsTestPlan();for(const p of plan)for(const gk of Object.keys(p.set||{})){const[g,k]=gk.split('.');
        if(!ENGINE_DEFAULTS[g]||!(k in ENGINE_DEFAULTS[g]))bad.push('unknown setting '+gk)}
      const keep=[walkView.sc,walkView.nav,walkView.gkey];walkView.sc=sc;walkView.nav=null;walkView.gkey='check-gfx';
      try{const G=navGrid();for(const st of GRAPHICS_TEST_STATIONS){const at=(sc.bench||{})[st.id];
        if(!at){bad.push(st.id+': no spot');continue}const c=navCellAt(at[0],at[1]);if(c<0||G.blk[c])bad.push(st.id+': spot blocked')}}
      finally{[walkView.sc,walkView.nav,walkView.gkey]=keep}
      const keys=new Set(plan.filter(p=>p.kind==='dial').map(p=>p.key));
      graphicsTest.result={stopped:false,seconds:1,fpsCap:60,steps:plan.map((p,i)=>Object.assign({},p,{set:undefined,fps:60,cpuMs:4+i%5,gpuMs:null})),errors:[]};
      graphicsTest.result.settings=graphicsTestCosts(graphicsTest.result.steps);graphicsTest.result.drift=graphicsTestDrift(graphicsTest.result.steps);graphicsTest.result.noise=graphicsTestNoise(graphicsTest.result.steps);
      return{bad,steps:plan.length,settings:keys.size,name:saveData.avatar.name}})()""")
    if r['bad']: raise Exception('graphics test: ' + '; '.join(r['bad'][:6]))
    with pg.expect_download(timeout=30000) as dl:
        pg.evaluate("exportGraphicsReport();0")
    text = Path(dl.value.path()).read_text(encoding='utf-8'); rep = json.loads(text)
    if rep.get('kind') != 'graphics' or len(rep.get('settings', [])) != r['settings']: raise Exception('graphics test: the report is incomplete')
    if r['name'] and r['name'].lower() in text.lower(): raise Exception('graphics test: the report holds the player’s name')
    pg.evaluate("graphicsTest.result=null;0")
    return f'graphics test ready (not run): {r["steps"]} steps over {r["settings"]} settings, report saves without names'


@step('In-game full test and diagnostics test, whole, headless', 5400)
def in_game_test_whole(b, base, R):
    errs = []; ctx, pg = open_game(b, base, 1100, 700, False, errs)
    try:
        start_for_in_game_test(pg)
        out = []
        for diag in (False, True):
            r = run_in_game_test(pg, None, diag, 3600)
            out.append(f'{r["kind"]}: {sum(p["ok"] for p in r["phases"])} of {len(r["phases"])} steps passed in {r["seconds"]} s')
            R['inGame' + ('Diagnostics' if diag else 'FullTest')] = r
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    finally:
        ctx.close()


@step('Phone: opening, the airship mast, screens and a battle', 260)
def phone_flow(b, base, R):
    errs = []; ctx, pg = open_game(b, base, 390, 844, True, errs)
    try:
        pg.click('[data-a=intro]')
        if not until(pg, 'cutscene.on', 15): raise Exception('the opening cutscene didn’t start')
        skip = "cutscene.say&&cutscene.say.tap();cutscene.skip||skipCutscene()"
        if not until(pg, 'dressingRoom.on', 60, skip): raise Exception('never reached the dressing room')
        pg.click('[data-a=dr-preset][data-i="2"]'); pg.fill('#drName', 'Checker'); pg.click('[data-a=dr-save]')
        if not until(pg, 'cutscene.choosing', 60, skip): raise Exception('never reached the starter picker')
        shot(pg, 'phone-opening-pick')
        pg.click('[data-a=cs-next]'); time.sleep(.5); pg.click('[data-a=cs-choose]'); pg.click('[data-a=cs-yes]')
        if not until(pg, 'saveData.started', 40, skip): raise Exception('the game didn’t start after picking a starter')
        R['opening'] = pg.evaluate('[saveData.starter,saveData.avatar.name,saveData.team.length,LOCATIONS[saveData.trip.node].id]')
        if R['opening'][3] != 'copperleaf': raise Exception(f'the game started at {R["opening"][3]}, not in Copperleaf')
        # RL-8 (the owner's "fall only"): Blake left the opening: no fight of Hazel's, no battle of his; the welcome
        # sheet comes straight after the pick
        if pg.evaluate('!!cutscene.foeName||!!activeBattle'): raise Exception('Blake is still in the opening (Hazel’s fight or his battle)')
        if not until(pg, '!!uiState.modal', 30): raise Exception('no welcome sheet after the opening')
        R['afterOpening'] = pg.evaluate("({welcome:uiState.modal&&uiState.modal.title,rival0:(saveData.story||{}).rival0||null})")
        pg.evaluate("closeModal();0")
        # RL-8: Copperleaf's airship mast offers a run: tapped (walkPick, as a tap on it does), its sheet has "Start a
        # run"; a real tap on that row opens the run's sheet (left there: the fast check and the full check fly it)
        if not until(pg, "walkView.ready&&!!walkView.sc.props.find(p=>p.act==='fly')", 60): raise Exception('Copperleaf has no airship mast')
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();(p=>walkPick({k:'act',p,act:'fly'}))(walkView.sc.props.find(p=>p.act==='fly'));0")
        if not until(pg, "!!document.querySelector('#ov [data-a=runstart]')", 30): raise Exception('the mast’s sheet has no “Start a run”')
        shot(pg, 'phone-mast')
        pg.click('#ov [data-a=runstart]')
        if not until(pg, "uiState.modal&&uiState.modal.title==='Start a run'", 10): raise Exception('“Start a run” didn’t open the run’s sheet')
        R['runSheet'] = pg.evaluate("uiState.modal.btns.map(b=>b.l)")
        shot(pg, 'phone-run-sheet')
        pg.evaluate("closeModal();uiState.modal=null;uiState.mq=[];renderOverlay();0")
        play(pg)
        # UI-1: how many surfaces blur what's behind them on each screen (the plan's budget is 3); a report, not a failure
        blur = {}
        for tab in ['walk', 'map', 'team', 'ledger', 'profile']:
            pg.evaluate(f"uiState.tab='{tab}';render();scrollTo(0,0);0"); time.sleep(2.5 if tab in ('walk', 'map') else .6); shot(pg, f'phone-{tab}')
            blur[tab] = pg.evaluate('uiBlurCount()')
        pg.evaluate(CHECK_SHOP + "uiState.tab='walk';saveData.trip.node=0;render();openShop('check_shop');0"); time.sleep(.6); shot(pg, 'phone-shop')
        blur['shop'] = pg.evaluate('uiBlurCount()')
        pg.evaluate("closeModal();screenWipe=f=>f();activeBattle=null;const q={id:'tq',sp:'swift1',lvl:12,no:1};encountersHere().splice(0,1e9,q);saveData.team.forEach(m=>{m.hp=maxHp(m)});startWild(q);0")
        if wait_phase(pg) != 'choose': raise Exception('a wild battle never reached the move menu')
        shot(pg, 'phone-battle')
        blur['battle'] = pg.evaluate('uiBlurCount()')
        R['blurPerScreen'] = blur
        pg.evaluate("stopTimers();activeBattle=null;battleStageStop();render();0")
        # phase 13: the debug log never holds names: the trainer is called Checker, and the buddy gets a nickname it
        # then says out loud (debug_picture_privacy); neither may be in the exported log
        pg.evaluate("(buddyBilly()||saveData.team[0]).nick='Zorblax';0")
        debug_picture_privacy(pg)
        # phase 01: the owner tests on a phone and sends the exported debug log, so the export must keep working. Here the
        # game saves it as a download (nothing is sent anywhere); the file must be a JSON log
        with pg.expect_download(timeout=60000) as dl:
            pg.evaluate("exportDebugLog();0")
        d = dl.value; dlog = json.loads(Path(d.path()).read_text(encoding='utf-8'))
        if not isinstance(dlog, dict) or not dlog: raise Exception('the exported debug log is empty')
        names = [n for n in ('Checker', 'Zorblax') if n.lower() in Path(d.path()).read_text(encoding='utf-8').lower()]
        if names: raise Exception(f'the exported debug log holds a name: {names}')
        # kept for comparing logs across a phase (validation/ is not committed)
        shutil.copyfile(d.path(), OUT / 'phone-debug-log.json')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return f'the fall, Hazel, dressing room, starter (no Blake: RL-8), the welcome sheet, the mast’s run sheet, five screens, shop, battle, speech kept out of the debug picture, debug log ({len(json.dumps(dlog)) // 1024} KB, no names); blurred surfaces per screen: {", ".join(f"{k} {v}" for k, v in blur.items())}'
    finally:
        R['phoneErrors'] = errs[:10]; ctx.close()


def all_maps(pg, sec=180):
    # phase 04b: the game fetches each map's ground and props when it is needed and the rest in the background; the
    # steps below read every map at once, so wait until all of them are whole
    if not until(pg, "typeof loadAllMaps!=='function'||(loadAllMaps(),Object.keys(gameData.maps).every(id=>!isLiteMap(id)))", sec):
        raise Exception('the maps didn’t all load in %ds: %s' % (sec, pg.evaluate("Object.keys(gameData.maps).filter(isLiteMap).join(', ')")))


def desktop_steps(b, base, R):
    errs = []; ctx, pg = open_game(b, base, 1100, 700, False, errs)
    play(pg); pg.evaluate("uiState.tab='team';render();0"); time.sleep(1); all_maps(pg)

    @step('Test scenes: walking rules (from the data)', 30)
    def test_checks():
        r = pg.evaluate("(()=>{const o={};for(const id of testMaps())o[id]=testMapChecks(id);return o})()")
        R['testChecks'] = r; bad = [f'{k}: {c["what"]}' for k, v in r.items() for c in v if not c['ok']]
        if bad: raise Exception('; '.join(bad[:6]))
        return f'{len(r)} test scenes, {sum(len(v) for v in r.values())} checks'
    test_checks()

    if '--tests' in ARGS:
        @step('Test scenes: each one drawn, with its pictures', 600)
        def test_draw():
            tests = pg.evaluate('testMaps()'); n = 0
            for id in tests:
                pg.evaluate(f"uiState.tab='walk';uiState.bench={{id:'{id}',test:1}};render();0")
                if not until(pg, f"!!(walkView.ready&&walkView.id==='{id}')", 40): raise Exception(f'{id} didn’t open')
                f0 = pg.evaluate("typeof walkRenderer!=='undefined'&&walkRenderer.on?walkRenderer.frames:-1")
                if f0 >= 0 and not until(pg, f'walkRenderer.frames>={f0 + 2}', 30): raise Exception(f'{id} isn’t drawing')
                for sh in pg.evaluate(f"gameData.maps['{id}'].shots||[]"):
                    pg.evaluate(f"walkView.pl.x={sh['x']};walkView.pl.z={sh['z']};walkView.pl.route=null;if(typeof walkRenderer!=='undefined')walkRenderer.yawT={sh.get('yaw', 0)};0"); time.sleep(2.2)
                    shot(pg, f"{id}-{sh['label']}"); n += 1
            pg.evaluate("uiState.bench=null;if(typeof walkRenderer!=='undefined')walkRenderer.yawT=0;render();0")
            if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
            return f'{len(tests)} test scenes, {n} pictures'
        test_draw()

    # RL-5: 'Close-ups of cliffs, stairs, bridges and water' (--closeups) retired: every spot it pictured is in a parked place (a run's places get their close-ups when RL-7 builds them)

    @step('Walking: tap to walk', 150)   # RL-5: the trip along two roads is retired (the hub has no road; RL-7 walks a run's roads)
    def walking():
        go_scene(pg, 0)
        tgt = pg.evaluate("(()=>{const h=mapHub(walkView.sc);return walkablePointNear(h[0]-3.5,h[1]-1)})()")   # v46: a few steps from where you stand (the places are bigger now)   # v46: the hub view holds the scene at its baseOff; v40: a short walk; software drawing throttles game time, so a long one can outlast the wait
        # the camera eases in after a scene opens, and a story message can be up: let both settle, then tap (twice if the first missed)
        time.sleep(2.5); pg.evaluate("uiState.toastQ=[];uiState.modal=null;uiState.mq=[];renderOverlay();0")
        pg.evaluate("encountersHere().length=0;if(activeBattle){activeBattle.over='ran';activeBattle.phase='end';endBattle()}uiState.modal=null;uiState.mq=[];renderOverlay();0"); time.sleep(.5)   # v40: no hidden encounters near the tap (a tap on one starts a battle)
        # townsfolk wander about: none may stand where the tap lands (a tap on a person starts a chat instead)
        pg.evaluate("(t=>{for(const f of walkView.folk||[])if(Math.hypot(f.x-t[0],f.z-t[1])<3.5){f.x=Math.min(walkView.sc.w-1,f.x+7);f.tx=f.x;f.tz=f.z}})(%s);0" % json.dumps(tgt)); time.sleep(.3)
        # v47: and no billionaire hiding in the open nearby (its marker and label are a big target, and a tap on it starts a battle)
        pg.evaluate("(t=>{for(const k in walkView.enc||{}){const s=walkView.enc[k];if(s&&Math.hypot(s.x-t[0],s.z-t[1])<6){const q=walkablePointNear(Math.min(walkView.sc.w-2,s.x+10),s.z);s.x=q[0];s.z=q[1]}}})(%s);0" % json.dumps(tgt)); time.sleep(.3)
        # v40: after a long run the ground of a big scene may still be painting; wait for it, then tap up to five times
        until(pg, "walkView.ready&&!!walkView.ground&&(!walkView.opt.active||walkView.opt.active())", 20); time.sleep(.5)
        # the camera eases toward you after a scene opens, slowly when drawing is slow: tap only once the target holds still on screen
        # (v47: and once it has finished looking up at a landmark nearby, the clock tower on Marigold's square)
        until(pg, "Math.abs((walkRenderer.lmT||0)-(typeof landmarkTilt==='function'?landmarkTilt(walkView.pl,walkView.sc):0))<.1", 40)
        last = None
        for _ in range(20):
            pt = pg.evaluate(PROJ % json.dumps(tgt))
            if last and abs(pt[0] - last[0]) < 1.5 and abs(pt[1] - last[1]) < 1.5: break
            last = pt; time.sleep(1)
        # a sprite standing between the camera and the spot (a tree, a sign, a person) would take the tap instead: pick a spot nothing covers
        for dx, dz in ((0, 0), (.6, 0), (-.6, 0), (0, .6), (0, -.6), (1.2, 0), (-1.2, 0), (0, 1.2), (1.2, 1.2), (-1.2, -1.2)):
            cand = pg.evaluate(f"walkablePointNear({tgt[0] + dx},{tgt[1] + dz})"); pt = pg.evaluate(PROJ % json.dumps(cand))
            if not pg.evaluate("(p=>!!hitAt({clientX:p[0],clientY:p[1]}))(%s)" % json.dumps(pt)): tgt = cand; break
        whys = []
        for attempt in range(5):
            pt = pg.evaluate(PROJ % json.dumps(tgt)); pg.mouse.click(pt[0], pt[1]); time.sleep(.8)
            if pg.evaluate('!!walkView.pl.route'): break
            whys.append(pg.evaluate("uiState.modal?('a message: '+(uiState.modal.title||'')):(walkView.opt.active&&!walkView.opt.active())?'the scene wasn’t taking taps':talkBox.on?'a chat':'no path from the tap'"))
            pg.evaluate("uiState.toastQ=[];uiState.modal=null;uiState.mq=[];if(talkBox.on&&typeof talkHide==='function')talkHide();renderOverlay();0"); time.sleep(1.2)
        if whys: notes.append(f'Walking: {len(whys)} tap(s) didn’t start a walk ({", ".join(whys)})')
        if not pg.evaluate('!!walkView.pl.route'): raise Exception(f'no walk started after 5 taps at {tgt} ({", ".join(whys)})')
        until(pg, '!walkView.pl.route', 45)
        roam = pg.evaluate("[+walkView.pl.x.toFixed(1),+walkView.pl.z.toFixed(1)]")
        pg.evaluate("if(typeof talkBox!=='undefined'&&talkBox.on&&typeof talkHide==='function')talkHide();0")
        if abs(roam[0] - tgt[0]) > .8 or abs(roam[1] - tgt[1]) > .8: raise Exception(f'tapped {tgt}, ended at {roam} ({pg.evaluate("JSON.stringify({mode:walkView.opt.state&&walkView.opt.state().mode,route:saveData.trip,battle:!!activeBattle,modal:uiState.modal&&uiState.modal.title,talk:talkBox.on,cs:typeof cutscene!==\"undefined\"&&cutscene.on,climb:!!walkView.pl.climb,keys:Object.keys(walkView.keys||{})})")})')
        # RL-5: the trip over two roads to Willowmere (cross_to, the picture 'arrived') is retired: Willowmere is parked and
        # the hub has no road (RL-7 walks a run's roads)
        pg.evaluate("uiState.toastQ=[];uiState.modal=null;uiState.mq=[];renderOverlay();0")
        return f'walked to {roam}'
    walking()

    @step('Time, weather and rooms: night, a storm, snow, autumn, walking into the lab', 240)   # RL-5: the dark cave (Fizzwell) is parked; the room is Hazel's lab (the hub has no shop)
    def atmosphere():
        if not pg.evaluate("typeof environment!=='undefined'"): return 'no time and weather in this build'
        go_scene(pg, 0); out = []
        # TC-3: what each look is comes from the game's own environment state after a frame drawn with it (a forced look
        # snaps, environmentFrame), not from the picture's brightness; the pictures stay for the baseline
        env = "JSON.stringify({tod:environment.tod,season:environment.season,weather:environment.weather,night:environment.night,storm:environment.storm,rain:environment.rain,snow:environment.snow,sk:environment.sk,lamp:environment.lampK})"
        looks = (('day', "{time:13,weather:'clear',season:'summer'}", lambda e: e['night'] < .1 and e['lamp'] < .2 and not e['rain'] and not e['snow']),
                 ('night', "{time:23.5,weather:'clear',season:'summer'}", lambda e: e['night'] > .9 and e['lamp'] > .9),
                 ('storm', "{time:15,weather:'storm',season:'summer'}", lambda e: e['night'] < .1 and e['storm'] > .5 and e['rain'] > .3),
                 ('snow', "{time:11,weather:'snow',season:'winter'}", lambda e: e['snow'] > .3 and e['sk'][2] > 0 and e['sk'][3] > 0),
                 ('autumn', "{time:12,weather:'clear',season:'autumn'}", lambda e: e['sk'][0] > 0 and e['season'] == 'autumn'))
        seen = {}
        for name, f, ok in looks:
            pg.evaluate(f"environment.force={f};0"); f0 = pg.evaluate("walkRenderer.frames")
            if not until(pg, f"walkRenderer.frames>{f0 + 1}", 20): raise Exception(f'{name}: the scene stopped drawing')
            e = json.loads(pg.evaluate(env)); seen[name] = e
            if e['weather'] != f.split("weather:'")[1].split("'")[0] or not ok(e): raise Exception(f'{name}: the environment reads {e}')
            time.sleep(1); shot(pg, 'env-' + name)
        lamps = seen['night']['lamp']
        pg.evaluate("environment.force={time:23.5,weather:'clear',season:'summer'};0"); f0 = pg.evaluate("walkRenderer.frames"); until(pg, f"walkRenderer.frames>{f0 + 1}", 20)
        odds =pg.evaluate("(()=>{const ps=Object.keys(SPECIES).find(k=>SPECIES[k].types.includes('Psychic'));if(!ps)return [10];return environmentOdds([[ps,10]]).map(x=>+x[1].toFixed(2))})()")
        out.append(f"night {seen['night']['night']:.2f} (day {seen['day']['night']:.2f}), storm {seen['storm']['storm']:.2f} with rain {seen['storm']['rain']:.2f}, snow {seen['snow']['snow']:.2f} lying {seen['snow']['sk'][3]:.2f}, autumn colour {seen['autumn']['sk'][0]:.2f}")
        # RL-5: the dark cave (Fizzwell, 'env-dark-cave') is retired with its place: no cave in the hub (a run's caves come with RL-7)
        # walk into the lab and out again (RL-5: was the shop, parked with its town; the hub's public building is Hazel's lab)
        pg.evaluate("environment.force={time:13,weather:'clear',season:'summer'};0"); go_scene(pg, 0); time.sleep(1)
        p0 = pg.evaluate("[walkView.pl.x,walkView.pl.z]")
        pg.evaluate("(()=>{const p=walkView.sc.props.find(p=>p.act==='lab'),C=walkData().sc,g=actionSpot(p,C.props[p.k],C.ppu||34);walkView.pl.route=null;walkView.pl.x=g[0];walkView.pl.z=g[1];walkPick({k:'act',p,act:'lab'})})();0")   # v46: as a tap does: at the door first
        if not until(pg, "walkView.ready&&(walkView.id==='int_lab'||(walkView.sc&&walkView.sc.roomOf==='int_lab'))", 60): raise Exception('walking into the lab didn’t open its room')
        time.sleep(2); shot(pg, 'room-lab')
        # RL-5: tapping the shopkeeper to open the shop is dropped (no shop room in the hub; the shop screen is checked with CHECK_SHOP)
        door = pg.evaluate("uiState.inside&&uiState.inside.door?[uiState.inside.door[0],uiState.inside.door[1]-.6]:null")      # v46: a room laid into the place: you come out at its door
        pg.evaluate("leaveRoom();0")
        if not until(pg, "walkView.ready&&!walkView.sc.roomRect&&(walkView.id===LOCATIONS[0].mapId||(walkView.sc&&walkView.sc.baseId===LOCATIONS[0].mapId))", 30): raise Exception('going outside didn’t bring you back to town (' + pg.evaluate("walkView.id") + ')')
        f0 = pg.evaluate("walkRenderer.frames"); until(pg, f"walkRenderer.frames>{f0 + 2}", 20)          # you're placed on the first frame
        p1 = pg.evaluate("[walkView.pl.x,walkView.pl.z]")
        at = door or p0
        if abs(p1[0] - at[0]) > 1 or abs(p1[1] - at[1]) > 1: raise Exception(f'back outside at {p1}, not at the door ({at})')
        pg.evaluate("environment.force=null;0")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out) + f'; lamps {lamps:.2f} at night; Psychic odds at night ×{odds[0] / 10:.1f}; the lab’s room opened, back at the door'   # RL-5: the lab, not the shop
    atmosphere()

    @step('Animals, footprints and world sounds: a rabbit bolts, prints in the snow, the sound beds start', 150)   # RL-5: Willowmere and its frogs are parked: the hub's pond and a rabbit
    def animals():
        if not pg.evaluate("typeof LIFE_KIND!=='undefined'&&!!LIFE_KIND.rabbit"): return 'no new animals in this build'   # RL-5: the rabbit, not the frog
        pg.evaluate("environment.force={time:13,weather:'clear',season:'summer'};0")
        # RL-5: the animals of Copperleaf (Willowmere is parked); the ducks join once the pond's water is known, a few frames
        # after the scene opens, so wait for them before picking a rabbit (the list is made again then)
        go_scene(pg, 0); time.sleep(3); until(pg, "['duck','rabbit'].every(k=>ambientLife.list.some(c=>c.k===k))", 20)
        kinds = pg.evaluate("[...new Set(ambientLife.list.map(c=>c.k))]")
        for k in ('duck', 'rabbit'):
            if k not in kinds: raise Exception(f'no {k} in Copperleaf (animals there: {", ".join(kinds)})')
        # RL-5: a rabbit bolts when you stand next to it (was a frog leaping into the water: the hub has no frogs); its run
        # is short, so watch for it, or for the rabbit having got away from where it was to out of your reach
        pg.evaluate("(()=>{const f=ambientLife.list.find(c=>c.k==='rabbit');window.__rb={c:f,x:f.x,z:f.z};walkView.pl.route=null;const p=walkablePointNear(f.x+.7,f.z-.4);walkView.pl.x=p[0];walkView.pl.z=p[1]})();0")
        bolted = until(pg, "(({c,x,z})=>c.st==='run'||(Math.hypot(c.x-x,c.z-z)>1.5&&Math.hypot(c.x-walkView.pl.x,c.z-walkView.pl.z)>2.6))(__rb)", 8)
        if not bolted: raise Exception('a rabbit didn’t bolt when you stood next to it')
        time.sleep(1); shot(pg, 'life-copperleaf')
        pg.evaluate("environment.force={time:11,weather:'snow',season:'winter'};0"); go_scene(pg, 0); time.sleep(1)
        end = pg.evaluate("(()=>{const e=[walkView.pl.x-6,walkView.pl.z-1.5];walkView.pl.route=[[walkView.pl.x,walkView.pl.z],[walkView.pl.x-4,walkView.pl.z+1],e];walkView.pl.ri=1;return e})()"); time.sleep(3)
        until(pg, f"Math.hypot(walkView.pl.x-({end[0]}),walkView.pl.z-({end[1]}))<.6", 25); time.sleep(1)     # alpha 0.1: walk to the end, however slowly frames come here
        prints = pg.evaluate("(walkRenderer.prints||[]).length"); shot(pg, 'prints-snow')
        if prints < 4: raise Exception(f'only {prints} footprints after a walk in the snow')
        pg.mouse.click(5, 300); time.sleep(1.5)
        snd = pg.evaluate("typeof soundEngine==='undefined'||!soundEngine.ctx?'no sound in this browser':soundEngine.ctx.state!=='running'?'sound not started ('+soundEngine.ctx.state+')':(typeof ambience!=='undefined'&&Object.keys(ambience.beds).length>=9?'ok':'beds missing')")
        if snd == 'beds missing': raise Exception('the world sound beds didn’t start')
        pg.evaluate("environment.force=null;0")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return f'animals at the pond: {", ".join(kinds)}; a rabbit bolted; {prints} footprints; world sounds: {snd}'   # RL-5: a rabbit, not a frog
    animals()

    @step('Battle weather: rain where you stand makes Water moves stronger and Fire weaker', 120)
    def battle_weather():
        """TC-1: the part of the Things to do step that stays (that step went with the system)"""
        go_scene(pg, 0); pg.evaluate("environment.force={time:15,weather:'rain'};const q={id:'twx',sp:'swift1',lvl:8,no:1};encountersHere().splice(0,1e9,q);saveData.team.forEach(m=>{m.hp=maxHp(m)});startWild(q);0")
        wait_phase(pg, sec=60); bw = pg.evaluate("(()=>{const w=battleWeather();return w?[w.k,battleWeatherMultiplier('Water'),battleWeatherMultiplier('Fire'),document.getElementById('camWorld')?document.getElementById('camWorld').dataset.wx:''] :null})()")
        time.sleep(1); shot(pg, 'battle-rain'); pg.evaluate("stopTimers();activeBattle=null;battleStageStop();environment.force=null;render();0")
        if not bw or bw[0] != 'rain' or bw[1] <= 1 or bw[2] >= 1: raise Exception(f'rain didn’t change the battle ({bw})')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return f'rain in battle: Water ×{bw[1]}, Fire ×{bw[2]}'
    battle_weather()

    @step('Walking left and right, the shoreline, room light, settings tabs, the place card, the world map camera', 300)   # RL-5: the fountains (Marigold Town's) are parked
    def frames_rooms_settings_map():
        if not pg.evaluate("typeof shoreField==='function'"): return 'not in this build'
        out = []
        # walking left is the mirror of walking right, not the same picture
        f = pg.evaluate("""(()=>{const fr=personWalkFrames('me'),a=fr.side[0],b=fr.sideR[0],px=c=>{const x=c.getContext('2d');return x.getImageData(0,0,c.width,c.height).data};const A=px(a),B=px(b);let same=0,n=0;for(let i=3;i<A.length;i+=4){if(A[i]>0||B[i]>0){n++;if(A[i]===B[i]&&A[i-1]===B[i-1]&&A[i-2]===B[i-2])same++}}return [n,same]})()""")
        if f[0] and f[1] / f[0] > .97: raise Exception('walking left and walking right show the same picture')
        out.append('left and right walking frames differ')
        # RL-5: the shoreline at Copperleaf's pond (Willowmere is parked)
        go_scene(pg, 0); time.sleep(1)
        sh = pg.evaluate("[!!walkRenderer.shoreF,!!walkRenderer.shoreTex,walkRenderer.shoreF?walkRenderer.shoreF.FW:0]")
        if not sh[0] or not sh[1]: raise Exception(f'no shoreline field in Copperleaf ({sh})')
        pg.evaluate("(()=>{const w=walkView.water[Math.floor(walkView.water.length*.3)];walkView.pl.route=null;const p=walkablePointNear(w[0]-1.5,w[1]-1.5);walkView.pl.x=p[0];walkView.pl.z=p[1]})();0"); time.sleep(2); shot(pg, 'water-edge')
        out.append(f'shoreline field {sh[2]} samples wide')
        # RL-5: the fountain water in Marigold Town (and its picture, 'fountain') is retired with the town: the hub has no fountain
        pg.evaluate("environment.force={time:13,weather:'clear',season:'autumn'};0"); time.sleep(2); shot(pg, 'autumn'); pg.evaluate("environment.force=null;0")
        # rooms: light through the window by day, lamps at night, the floor ends at the door
        walk_in(pg, 'house', 'cottage_moss'); until(pg, "walkView.ready&&(walkView.id==='int_house'||(walkView.sc&&walkView.sc.roomOf==='int_house'))", 30); time.sleep(1.5)   # phase 08b: through a house's door (no room opens without one); RL-5: a moss-roof cottage of Copperleaf (Marigold's red-roof house is parked)
        # IS-5: waits for frames drawn in the room, not a fixed time (the island hub draws more slowly in software)
        frames = lambda: (lambda f0: until(pg, f'walkRenderer.frames>={f0 + 2}&&!!walkRenderer.roomSky', 60))(pg.evaluate('walkRenderer.frames'))
        pg.evaluate("environment.force={time:15.5,weather:'clear',season:'summer'};walkRenderer.roomSkyT=0;0"); time.sleep(.5); frames(); shot(pg, 'room-day')
        day = pg.evaluate("[walkRenderer.roomSky&&walkRenderer.roomSky.I,walkRenderer.roomSky&&walkRenderer.roomSky.lamp,(roomLamps(walkView.sc)||[]).length,!!walkRenderer.roomBox]")
        pg.evaluate("environment.force={time:23,weather:'clear',season:'summer'};walkRenderer.roomSkyT=0;0"); time.sleep(.5); frames(); shot(pg, 'room-night')
        night = pg.evaluate("[walkRenderer.roomSky&&walkRenderer.roomSky.night,walkRenderer.roomSky&&walkRenderer.roomSky.lamp]")
        pg.evaluate("environment.force=null;leaveRoom();0"); until(pg, "walkView.ready&&!walkView.sc.roomRect&&(walkView.id==='copperleaf'||(walkView.sc&&walkView.sc.baseId==='copperleaf'))", 30)   # RL-5: back out in Copperleaf
        if not day[3] or not day[0] or day[0] < .2 or night[1] < .9 or day[2] < 1: raise Exception(f'room light: day {day}, night {night}')
        out.append(f'room: daylight {day[0]:.2f}, {day[2]} lamps lit at night')
        # settings in tabs, every tab fits the phone width; a switch flips
        # a message waiting on screen (an egg hatching, in steps mode) would queue Settings behind it
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();uiState.tab='walk';render();openSettings('game');0"); time.sleep(.6); tabs = []
        # alpha 0.5: the tabs are whatever the game lists (UI-7b: sound, graphics, controls, access, game, save, help);
        # contrast is under Accessibility
        names = pg.evaluate("SETTINGS_TABS.map(t=>t[0])")
        for t in names:
            pg.evaluate(f"document.querySelector('[data-a=set-tab][data-k={t}]').click();0"); time.sleep(.3)
            tabs.append(pg.evaluate("[document.querySelectorAll('.set-body .set-row,.set-body .settings-profile,.set-body details').length,(()=>{const b=document.querySelector('.sheet .body');return b.scrollWidth-b.clientWidth})()]"))
            if t == 'graphics': shot(pg, 'settings-graphics')
        if len(names) < 7 or any(n == 0 for n, _ in tabs) or any(o > 4 for _, o in tabs): raise Exception(f'settings tabs {names}: {tabs}')
        pg.evaluate("document.querySelector('[data-a=set-tab][data-k=access]').click();0"); time.sleep(.2)
        c0 = pg.evaluate("saveData.preferences.contrast||'normal'"); pg.evaluate("document.querySelector('[data-pref-set=contrast]').click();0"); time.sleep(.2); c1 = pg.evaluate("saveData.preferences.contrast")
        pg.evaluate("document.querySelector('[data-pref-set=contrast]').click();uiState.modal=null;uiState.mq=[];renderOverlay();0")
        if c0 == c1: raise Exception('the High contrast switch did nothing')
        out.append(f'{len(names)} settings tabs, switches work')
        # the place card closes with x and opens again from the name in the top bar
        pg.evaluate("render();0"); time.sleep(.4); pg.evaluate("document.querySelector('.wh-x').click();0"); time.sleep(.3)
        gone = pg.evaluate("!document.querySelector('.wh-card')"); pg.evaluate("document.querySelector('button.tb-where').click();0"); time.sleep(.3); back = pg.evaluate("!!document.querySelector('.wh-card')")
        if not gone or not back: raise Exception(f'place card: closed {gone}, reopened {back}')
        out.append('place card closes and comes back')
        # the map: drag the land, turn, zoom right down to the miniatures
        pg.evaluate("uiState.tab='map';render();0"); time.sleep(6)
        if pg.evaluate("typeof worldBowl!=='undefined'&&worldBowl.on"):
            # phase 10: the bowl map (game/js/world-bowl.js): drag, turn and zoom with its own camera, then Home (IS-5:
            # from Home, so where an earlier step left the camera doesn't decide how far the pan lands from the rim)
            pg.evaluate("(()=>{const me=worldBowlSpots()[saveData.trip.node];worldBowl.goal=null;worldBowl.tween=null;worldBowl.cam=bowlCamClamp(bowlCamHome(me.x,me.y));worldBowl.dirty=true})();0"); time.sleep(.5)
            c0 = pg.evaluate("JSON.stringify(worldBowl.cam)")
            pg.evaluate("(()=>{const W=worldMapWidth,H=worldMapHeight;let c=bowlCamPan(worldBowl.cam,bowlCamView(worldBowl.cam,W,H),-120,40);c=bowlCamTurn(c,.8,.2);for(let i=0;i<20;i++)c=bowlCamZoom(c,.8);worldBowl.goal=null;worldBowl.cam=c;worldBowl.dirty=true})();0"); time.sleep(2); shot(pg, 'map-close')
            # TC-3: zoomed right in, the camera is as close as it may come there: the nearest zoom, or nearer the rim's
            # height the distance that keeps the eye above the rim line (bowlCamClamp backs off at its steepest tilt;
            # over the hub island's low ground that is about 0.49, so a fixed 0.46 failed)
            m = pg.evaluate("(()=>{const c=worldBowl.cam,v=bowlCamView(c,worldMapWidth,worldMapHeight);return [JSON.stringify(c),c.dist,v.C[1],bowlCamClamp(Object.assign({},c,{dist:0})).dist]})()")
            pg.evaluate("worldMapReset();0")
            if m[0] == c0 or m[1] > m[3] + .01 or m[2] < .37: raise Exception(f'bowl map camera: {m}')
            out.append(f'the bowl map pans, turns and zooms to {m[1]:.2f} (as close as it may come there: {m[3]:.2f}), the eye {m[2]:.2f} up (above the rim)')
        pg.evaluate("uiState.tab='walk';render();0"); time.sleep(.5)
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    frames_rooms_settings_map()

    @step('Off-screen culling, the scene cache, prop wear and variety', 240)
    def culling_cache_wear():
        if not pg.evaluate("typeof cullItems==='function'"): return 'not in this build'
        out = []
        # what's off screen is skipped (RL-5: in Copperleaf, the one place left; Verdigris City, the biggest scene, is parked)
        go_scene(pg, 0); until(pg, "!!walkRenderer.grass&&!walkRenderer.grassJob", 60); f0 = pg.evaluate("walkRenderer.frames"); until(pg, f"walkRenderer.frames>{f0 + 2}", 20)   # v46: the grass of a big view is still being planted for a while
        c = pg.evaluate("[walkRenderer.culled||0,walkRenderer.cullOf||0,walkRenderer.grassDrawn||0,walkRenderer.grass?walkRenderer.grass.n:0]")
        if not c[1] or c[0] <= 0: raise Exception(f'nothing was skipped in Copperleaf ({c})')
        out.append(f'Copperleaf: {c[0]} of {c[1]} things and {c[3] - c[2]} of {c[3]} grass blades off screen skipped')
        # going back to a scene seen a moment ago doesn't rebuild its ground (RL-5: there and back is the hub and a test
        # scene, test_tiny, opened as a bench: the hub has no neighbour, and Verdigris City is parked)
        go_scene(pg, 0); b0 = pg.evaluate("walkRenderer.builds||0")
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();uiState.bench={id:'test_tiny',test:1};render();0")
        if not until(pg, "!!(walkView.ready&&walkView.id==='test_tiny')", 40): raise Exception('test_tiny didn’t open')
        pg.evaluate("uiState.bench=null;render();0"); go_scene(pg, 0)
        b1 = pg.evaluate("walkRenderer.builds||0")
        if b1 - b0 > 1: raise Exception(f'the ground was rebuilt {b1 - b0} times going there and back')
        out.append(f'there and back: {b1 - b0} ground build(s)')
        # wear and variety (with the dial at 0, ask computePropLook: propLook keeps a look for the rest of the frame, the game sees the dial on the next one)
        r = pg.evaluate("""(()=>{const sc=walkView.sc,C0=walkData().sc,P=sc.props||[],b=P.find(p=>{const M=C0.props[p.k];return M&&M.box&&M.door}),tr=P.filter(p=>/tree/.test(p.k)).slice(0,6);
         const L=b?propLook(b,C0.props[b.k],sc):null,T=tr.map(p=>propLook(p,C0.props[p.k],sc)),sizes=new Set(T.map(l=>l.size.toFixed(3))),hues=new Set(T.map(l=>l.hsv[0].toFixed(4)));
         gameData.engine.defaults.world=Object.assign(gameData.engine.defaults.world||{},{wear:0});const L0=b?computePropLook(b,C0.props[b.k],sc):null;delete gameData.engine.defaults.world.wear;
         return {w:L?L.wear.reduce((x,y)=>x+y,0):-1,w0:L0?L0.wear.reduce((x,y)=>x+y,0):-1,sizes:sizes.size,hues:hues.size,n:T.length}})()""")
        if r['w'] <= 0: raise Exception(f'buildings have no wear ({r})')
        if r['w0'] != 0: raise Exception(f'Wear and tear at 0 still leaves wear ({r})')
        if r['n'] >= 3 and (r['sizes'] < 2 or r['hues'] < 2): raise Exception(f'trees all look the same ({r})')
        out.append(f"a building's wear {r['w']:.2f} (0 with the dial at 0); {r['n']} trees in {r['sizes']} sizes and {r['hues']} shades")
        # the prop audit's fixes: new variants load, box props have a top from their picture, mossy twins, texture dials
        v = pg.evaluate("""(async()=>{const C0=walkData().sc,K=['barrels','haybale_stack','stump_mossy','log_mossy','mushroom_ring','flowers_meadow','rocks_c','crate_stack','cactus_pair','firewood_b'],miss=K.filter(k=>!C0.props[k]);
         await artLoad(K.filter(k=>C0.props[k]).map(k=>C0.props[k].img).concat([C0.props.sofa.img]));const bad=K.filter(k=>C0.props[k]&&!imageReady(artImage(C0.props[k].img)));
         const B=boxInfo(artImage(C0.props.sofa.img)),rc=B&&B.roof.getContext('2d').getImageData(0,0,B.roof.width,B.roof.height).data;let lum=0;if(rc){for(let i=0;i<rc.length;i+=4)lum+=rc[i]*.3+rc[i+1]*.59+rc[i+2]*.11;lum/=rc.length/4}
         const sc={},alts=[];for(let i=0;i<40;i++){const p={k:'stump',x:i*3.1,z:i*1.7};alts.push(alternatePropImage(p,C0.props.stump,C0,sc))}const mossy=alts.filter(a=>a===C0.props.stump_mossy.img).length;
         const plain=alternatePropImage({k:'stump',x:0,z:0,plain:true},C0.props.stump,C0,sc)===C0.props.stump.img;
         return {miss,bad,lum:Math.round(lum),mossy,plain,det:engineSetting('world','texDetail'),aniso:!!gpuState.aniso}})()""")
        if v['miss'] or v['bad']: raise Exception(f'prop variants missing or not loading: {v}')
        if v['lum'] < 45: raise Exception(f"the sofa's top is still dark (brightness {v['lum']})")
        if not (4 <= v['mossy'] <= 30) or not v['plain']: raise Exception(f'mossy twins: {v}')
        out.append(f"10 new prop variants load; a sofa's top {v['lum']} bright (was black); {v['mossy']} of 40 stumps mossy; surface detail {v['det']}, sharp-at-a-slant {'on' if v['aniso'] else 'not offered by this graphics chip'}")
        pg.evaluate("(()=>{const sc=walkView.sc,C0=walkData().sc,b=(sc.props||[]).find(p=>{const M=C0.props[p.k];return M&&M.box&&M.door});if(!b)return;walkView.pl.route=null;const q=walkablePointNear(b.x,b.z-2.5);walkView.pl.x=q[0];walkView.pl.z=q[1];walkRenderer.zoomT=walkRenderer.zoom=.7})();0"); time.sleep(2.5); shot(pg, 'wear-building')
        # the map's 3D miniatures
        pg.evaluate("uiState.tab='map';render();0"); time.sleep(3)
        out.append('the bowl map has no miniatures yet (phase 10)')
        pg.evaluate("uiState.tab='walk';render();0"); time.sleep(.5)
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    culling_cache_wear()

    @step('Double and Alpha battles, nameplates, Billies in the world', 300)
    def battles_and_world_billies():
        if not pg.evaluate("typeof liveActors==='function'&&typeof worldBillyItem==='function'"): return 'not in this build'
        out = []
        pg.evaluate("saveData.team.forEach(m=>{m.hp=maxHp(m);m.status=null;m.lvl=Math.max(m.lvl,12)});while(saveData.team.length<3)saveData.team.push(makeBilly(DEX_ORDER[(saveData.team.length*5+3)%DEX_ORDER.length],10));saveData.team.forEach(m=>m.hp=maxHp(m));0")
        tap = "activeBattle&&activeBattle.phase==='playing'&&tapMessage()"
        for kind in ('double', 'alpha'):
            if kind == 'double':
                tid = pg.evaluate("Object.keys(TRAINERS).find(k=>TRAINERS[k].team.length>=2)||''")
                if not tid: out.append('no trainer for a double battle'); continue
                pg.evaluate(f"startTrainer('{tid}',{{talked:true,double:true}});0")
            else:
                pg.evaluate("(()=>{const sp=Object.keys(SPECIES).find(k=>SPECIES[k].stage===0&&!RULES.start.starters.includes(SPECIES[k].line));const q={id:'cq-alpha',sp,lvl:6,no:1,alpha:true};encountersHere().push(q);startWild(q)})()")
            if not until(pg, "activeBattle&&activeBattle.phase==='choose'", 90, tap): raise Exception(f'{kind}: never reached the move menu (phase {pg.evaluate("activeBattle&&activeBattle.phase")})')
            # the plates fade in with their billionaires; in software drawing that can take a few seconds
            until(pg, "document.querySelectorAll('#plates .bplate:not(.off):not(.gone)').length>=liveActors(0).length+liveActors(1).length", 12); time.sleep(.5)
            r = pg.evaluate("JSON.stringify({fmt:activeBattle.fmt,mine:liveActors(0).length,theirs:liveActors(1).length,plates:document.querySelectorAll('#plates .bplate:not(.off):not(.gone)').length,boss:!!(fighter(1)&&fighter(1).boss),big:battleStage.s[1]?battleStage.s[1].big:1,bar:!!document.querySelector('#plates .turnbar')})")
            r = json.loads(r)
            if kind == 'double' and (r['fmt'] != 'double' or r['theirs'] < 2): raise Exception(f'double battle came out as {r}')
            if kind == 'alpha' and (r['fmt'] != 'alpha' or not r['boss'] or r['mine'] < 2): raise Exception(f'Alpha battle came out as {r}')
            if r['plates'] < r['mine'] + r['theirs']: raise Exception(f'{kind}: only {r["plates"]} nameplates for {r["mine"] + r["theirs"]} billionaires')
            shot(pg, f'battle-{kind}')
            # every fighter picks; with two foes the move needs a target
            picks = pg.evaluate("""(async()=>{let n=0,aim=0;while(activeBattle&&activeBattle.phase==='choose'&&n<4){const m=fighter(activeBattle.cur),mid=m.moves.find(id=>MOVES[id]&&MOVES[id].c!=='X')||m.moves[0];pickMove(mid);n++;if(activeBattle.phase==='target'){aim++;await new Promise(r=>setTimeout(r,300));pickTarget(liveActors(1)[liveActors(1).length-1])}await new Promise(r=>setTimeout(r,60))}return [n,aim]})()""")
            if kind == 'double' and picks[1] < 1: raise Exception('double battle: no move asked for a target')
            if not until(pg, "activeBattle&&['choose','end','switch'].includes(activeBattle.phase)", 120, tap): raise Exception(f'{kind}: the turn never finished (phase {pg.evaluate("activeBattle&&activeBattle.phase")})')
            lines = pg.evaluate("activeBattle.events.map(e=>e.t).filter(Boolean)")
            hit_two = sum(1 for l in lines if ' used ' in l)
            out.append(f"{kind}: {r['mine']} vs {r['theirs']}, {r['plates']} nameplates, {picks[0]} picks ({picks[1]} aimed), {hit_two} moves in the turn" + (f", Alpha {r['big']}x size, turn order bar {'shown' if r['bar'] else 'missing'}" if kind == 'alpha' else ''))
            if kind == 'alpha':
                pg.evaluate("(async()=>{for(let i=0;i<20&&activeBattle&&activeBattle.phase==='switch';i++){const b=document.querySelector('#acts [data-a=bswitch]:not([disabled])');if(b)b.click();await new Promise(r=>setTimeout(r,200));for(let j=0;j<40&&activeBattle&&activeBattle.phase==='playing';j++){tapMessage();await new Promise(r=>setTimeout(r,150))}}})()")
                c = pg.evaluate("""(async()=>{if(!activeBattle||activeBattle.phase!=='choose')return 'catching skipped: the battle '+(activeBattle?'is at '+activeBattle.phase:'ended');uiState.dbgCatch=true;activeBattle.coin=Object.keys(COINS).find(k=>saveData.coins[k]>0)||Object.keys(COINS)[0];saveData.coins[activeBattle.coin]=(saveData.coins[activeBattle.coin]||0)+1;activeBattle.phase='aim';paintActions();showAim();doThrow(false);
                  for(let i=0;i<120&&activeBattle&&activeBattle.phase!=='end';i++){if(activeBattle.phase==='playing')tapMessage();await new Promise(r=>setTimeout(r,250))}uiState.dbgCatch=false;const m=saveData.team.concat(saveData.box).find(m=>m.alpha);return m?`caught: Alpha flag kept, boss boost dropped (${m.hp}/${maxHp(m)} HP)`:'not caught'})()""")
                out.append(c)
            pg.evaluate("if(activeBattle){activeBattle.over=activeBattle.over||'ran';activeBattle.phase='end';endBattle()};0"); time.sleep(2.5); pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();0")
        # the world: billionaires waiting in the grass (one an Alpha; v46: each keeps its spot), the buddy, a trainer's companion
        pg.evaluate("encountersHere().length=0;for(let i=0;i<3;i++){const q=spawn(false);if(!i)q.alpha=true};saveData.buddy=saveData.team[1].uid;save();0")
        go_scene(pg, 0); time.sleep(4)   # RL-5: the tall grass of Copperleaf (Tallgrass Meadow is parked)
        w0 = pg.evaluate("JSON.stringify(Object.fromEntries(Object.entries(walkView.enc).map(([k,v])=>[k,[v.x,v.z]])))"); time.sleep(5)
        w = json.loads(pg.evaluate(f"(()=>{{const p0={w0};return JSON.stringify({{shown:(walkView.st.enc||[]).filter(e=>worldBillies.mons[e.id]).length,moved:Object.entries(walkView.enc).filter(([k,v])=>p0[k]&&Math.hypot(v.x-p0[k][0],v.z-p0[k][1])>.25).length,alpha:(walkView.st.enc||[]).some(e=>e.alpha),bud:!!worldBillies.bud}})}})()"))
        if not w['shown']: raise Exception(f'no billionaires shown in the grass: {w}')
        if w['moved']: raise Exception(f'{w["moved"]} wild Billie(s) left their spot in 5 s (v46: they stand still)')
        if not w['bud']: raise Exception('the buddy isn’t walking with you')
        pg.evaluate("(()=>{const P=walkView.pl,s=walkView.sc;walkTo([clamp(P.x+4,1,s.w-1),clamp(P.z+2,1,s.h-1)])})()"); time.sleep(4)
        gap = pg.evaluate("Math.hypot(worldBillies.bud.x-walkView.pl.x,worldBillies.bud.z-walkView.pl.z)")
        if gap > 4: raise Exception(f'the buddy fell {gap:.1f} m behind')
        pg.evaluate("buddyTap();0"); time.sleep(.8); shot(pg, 'world-buddy')
        said = pg.evaluate("worldBillies.say")
        pets = pg.evaluate("Object.values(TRAINERS).filter(T=>companionSpecies(T)).length")
        out.append(f"world: {w['shown']} in the grass (none left its spot in 5 s, Alpha {'there' if w['alpha'] else 'not rolled'}), buddy {gap:.1f} m behind and says “{said[:50]}”, {pets} trainers with a companion")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    battles_and_world_billies()

    @step('Starters: their rigs, 12 fps puppets, the motion audit, a battle on the 3D stage', 150)
    def starter_rigs():
        if not pg.evaluate("typeof rigFrame==='function'&&!!window.RIGS_NEXT"): return 'not in this build'
        out = []
        st = pg.evaluate("RULES.start.starters")
        if st != ['musk', 'bezos', 'gates']: raise Exception(f'starters are {st}')
        ids = [f'{l}{i}' for l in st for i in range(4)]
        miss = [i for i in ids if not pg.evaluate(f"!!(SPECIES['{i}']&&RIGS['{i}']&&RIGS['{i}'].front&&RIGS['{i}'].back)")]
        if miss: raise Exception(f'missing species or rigs: {miss}')
        nx = ROOT / 'game' / 'art' / 'next' / 'billionaires'
        sheets = [n for n in ('emberox', 'boostox', 'marsox', 'memeox', 'cartotter', 'primotter', 'orbitotter', 'everyotter', 'kidling', 'billgoat', 'windowgoat', 'harvestgoat') if (nx / f'{n}.png').exists()]
        if len(sheets) < 12: raise Exception(f'only {len(sheets)} starter sheets')
        # Studio plan Phase 5: the kit Billies' piece layouts (<name>.json) retired; the rig names the sheet
        unrigged = [n for n in sheets if not pg.evaluate(f"Object.values(RIGS).some(r => r.front && r.front.sheet === 'next/billionaires/{n}.png')")]
        if unrigged: raise Exception(f'starter sheets no rig draws from: {unrigged}')
        out.append('12 starter species, 12 sheets, each drawn by a rig; rigs for front and back')
        pg.evaluate("rigPreload(%s.flatMap(id=>[[id,1],[id,1.4]]))" % json.dumps(ids)); time.sleep(3)
        r = json.loads(pg.evaluate("""(ids=>{const out={};for(const id of ids){const o={};for(const [v,k] of [['front',1],['back',1.4]]){const R=rigParts(id,k);if(!R){o[v]=null;continue}
          const c=makeCanvas(R.BW,R.BH),x=c.getContext('2d');const n=(P)=>{x.clearRect(0,0,R.BW,R.BH);drawRig(x,R,P,v);const d=x.getImageData(0,0,R.BW,R.BH).data;let s=0;for(let i=3;i<d.length;i+=4)if(d[i]>0)s++;return s};
          const a=n(rigFrame(R,null,0,1000,1)),b=n(rigFrame(R,null,0,1030,1)),c2=n(rigFrame(R,'hurt',60,1200,1));o[v]={px:a,sameTick:a===b,hurt:c2,clock:R.clock,lag:R.lag,sq:rigFrame(R,'hurt',60,1200,1).sq||null}}out[id]=o}return JSON.stringify(out)})(%s)""" % json.dumps(ids)))
        bad = [k for k, v in r.items() if not v['front'] or not v['back'] or v['front']['px'] < 800 or v['back']['px'] < 500]
        if bad: raise Exception(f'rigs draw nothing or too little: {bad} ({ {k: r[k] for k in bad[:2]} })')
        if not all(v['front']['clock'] == 12 for v in r.values()): raise Exception('new rigs are not on the 12 fps clock')
        if not r['musk0']['front']['sq'] == 'squash': raise Exception(f"hurt pose doesn't pick the squashed torso ({r['musk0']['front']['sq']})")
        out.append(f"every rig draws ({min(v['front']['px'] for v in r.values())}+ px front); 12 fps clock; lag pieces on {sum(1 for v in r.values() if v['front']['lag'])}; hurt squashes the torso")
        # v36c: the motion audit: every piece moves in some pose, and legs, head and tail move in a walk and a hit
        au = json.loads(pg.evaluate("JSON.stringify(Object.fromEntries(%s.map(id=>[id,rigAudit(id,'front')])))" % json.dumps(ids)))
        still = {k: v['still'] for k, v in au.items() if v and v['still']}
        if still: raise Exception(f'pieces that never move: {still}')
        weak = [k for k, v in au.items() if not v or not any(n.startswith('leg') and (v['poses']['walk'].get(n, 0) > .5) for n in v['bones']) or v['poses']['hurt'].get('head', 0) < .5]
        if weak: raise Exception(f'walk or hurt leaves legs/head still for {weak}')
        plans = pg.evaluate("Object.keys(POSES_BY_PLAN).length")
        out.append(f"motion audit: every piece moves, legs walk and heads flinch on all 12; {plans} body plans")
        # a battle with the new starter on the 3D stage: the player's rig buffer has pixels
        pg.evaluate("saveData.team.unshift(makeBilly('gates0',14));saveData.team[0].hp=maxHp(saveData.team[0]);const q={id:'cq36',sp:'bezos1',lvl:12,no:1};encountersHere().push(q);startWild(q);0")
        if not until(pg, "activeBattle&&activeBattle.phase==='choose'", 90, "activeBattle&&activeBattle.phase==='playing'&&tapMessage()"): raise Exception('the starter battle never reached the move menu')
        until(pg, "(()=>{const a=actorBuffer(0),b=actorBuffer(1);return !!(a&&b)})()", 15); time.sleep(2)
        px = json.loads(pg.evaluate("(()=>{const o={};for(const i of [0,1]){const Bf=actorBuffer(i);if(!Bf){o[i]=0;continue}const d=Bf.buf.getContext('2d').getImageData(0,0,Bf.buf.width,Bf.buf.height).data;let n=0;for(let k=3;k<d.length;k+=4)if(d[k]>0)n++;o[i]=n}return JSON.stringify(o)})()"))
        shot(pg, 'starter-battle')
        if px['0'] < 500 or px['1'] < 500: raise Exception(f'battle rig buffers nearly empty: {px}')
        pg.evaluate("if(activeBattle){activeBattle.over='ran';activeBattle.phase='end';endBattle()};0"); time.sleep(2.5); pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();saveData.team.shift();0")
        out.append(f"3D-stage battle Kidling vs Primotter: both puppets drawn ({px['0']} / {px['1']} px)")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    starter_rigs()

    @step('Nature props, the wild growth, edge-relative exits', 120)   # RL-5: the join table (roads between places) is retired: no road is left
    def nature_growth_exits():
        out = []
        # the seventy nature props: in the catalogue, on disk, with a family and the ground they grow on
        nat = json.loads(pg.evaluate("JSON.stringify(Object.entries(walkData().sc.props).filter(([k,M])=>M.family).map(([k,M])=>[k,M.family,M.grow,M.img]))"))
        fams = {}
        for k, f, g, img in nat:
            fams[f] = fams.get(f, 0) + 1
            if not g: raise Exception(f'{k} has no ground to grow on')
            if not (ROOT / 'game' / 'art' / img).exists(): raise Exception(f'{k}: {img} is missing')
        if len(nat) < 70: raise Exception(f'{len(nat)} nature props (want 70)')
        out.append(f'{len(nat)} nature props in {len(fams)} families (' + ', '.join(f'{f} {n}' for f, n in sorted(fams.items())) + ')')
        # the wild growth: every outdoor scene grown, nothing it added stands on a path or in the sea (test scenes such as
        # alpha 0.5's Graphics gallery, test: true, are laid out by hand; IS-5: the hub island grows its own ground and
        # IS-9 dresses it, so it need not be grown, but what it kept of the old growth is checked)
        bad = json.loads(pg.evaluate("""JSON.stringify((()=>{const C=walkData().sc.props,out=[];for(const [id,sc] of Object.entries(gameData.maps)){if(/^(test_|int_)/.test(id)||sc.test||sc.indoor||sc.room)continue;const g=(sc.props||[]).filter(p=>p.w===42);if(!sc.islandGen&&(sc.wild!==42||!g.length)){out.push(id+': not grown');continue}
         for(const p of g){const ch=(sc.tiles[sc.h-1-Math.floor(p.z)]||'')[Math.floor(p.x)],M=C[p.k];if(!M){out.push(id+': '+p.k+' unknown');break}if('pcmbaqheo'.includes(ch)){out.push(id+': '+p.k+' on paved ground');break}if('wd'.includes(ch)&&!(M.grow||'').includes(ch)){out.push(id+': '+p.k+' in water');break}}}return out})())"""))
        if bad: raise Exception('wild growth: ' + '; '.join(bad[:4]))
        grown = pg.evaluate("Object.values(gameData.maps).reduce((n,sc)=>n+(sc.props||[]).filter(p=>p.w===42).length,0)")
        out.append(f'{grown} props grown over the outdoor scenes, none on paths')
        # edge-relative exits: every scene with exits has them, the points they give are the ones everything reads
        ex = json.loads(pg.evaluate("""JSON.stringify((()=>{const out=[];for(const [id,sc0] of Object.entries(gameData.maps)){if(!(sc0.exits||[]).length)continue;const sc=mapById(id);if(!sc.edgeExits||sc.edgeExits.length!==sc.exits.length){out.push(id+': no edge exits');continue}
         sc.edgeExits.forEach((e,k)=>{const p=exitPoint(sc,e),q=sc.exits[k];if(!e.id||!'NSEW'.includes(e.side)||Math.hypot(p[0]-q[0],p[1]-q[1])>.02)out.push(id+' '+(e.id||k)+': '+JSON.stringify(p)+' vs '+JSON.stringify(q))})}return out})())"""))
        if ex: raise Exception('edge exits: ' + '; '.join(ex[:4]))
        n_ex = pg.evaluate("Object.values(gameData.maps).reduce((n,sc)=>n+((sc.edgeExits||[]).length),0)")
        # RL-5: the join table (every road's ends name an exit of their place) is retired: ROADS is empty and the hub has no
        # exit; a run's roads bring it back (RL-7). The exits left are the rooms' doorways
        out.append(f'{n_ex} edge-relative exits')
        # a resize keeps exits on their edge: grow a copy of Hazel's lab (RL-5: a room, the only scenes with an exit now;
        # Tallgrass Meadow is parked) by 6 m each way, then shrink it back
        r = json.loads(pg.evaluate("""JSON.stringify((()=>{const sc=JSON.parse(JSON.stringify(mapById('int_lab')));delete sc._exk;const before=sc.exits.map(p=>p.slice());sc.w+=6;sc.h+=6;syncExits(sc);const after=sc.exits;
         const ok=sc.edgeExits.every((e,k)=>{const p=after[k],q=before[k],n=e.in==null?1.1:e.in;return e.side==='N'?Math.abs(p[1]-(sc.h-n))<.02:e.side==='S'?Math.abs(p[1]-n)<.02:e.side==='E'?Math.abs(p[0]-(sc.w-n))<.02:Math.abs(p[0]-n)<.02});return {ok,before,after,E:sc.edgeExits}})())"""))
        if not r['ok']: raise Exception(f'after a resize the exits left their edge: {r}')
        out.append('a resized scene keeps its exits on their edges')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    nature_growth_exits()

    @step('Place views, flags, wind, voxel props, the light', 240)
    def views_flags_wind_light():
        out = []
        # every place's view composes (phase 08b: the only kind of view; the road frame and its middle views are gone): no cut
        # tiles, parts on whole metres, sizes the distant ground picture can hold, the place's own tiles carried over exactly
        r = json.loads(pg.evaluate("""JSON.stringify((()=>{const out=[];let n=0,mx=0;for(let k=0;k<LOCATIONS.length;k++){const sid=mapIdAt(k),A=mapById(sid);if(!A)continue;const sc=seamlessHubMap(k);if(!sc){out.push(sid+': no view');continue}n++;mx=Math.max(mx,sc.w,sc.h);
         if((sc.w+16)*8>4096||(sc.h+16)*8>4096)out.push(sc.id+': '+sc.w+'x'+sc.h+' is too big for its distant ground picture');/* v46: the near ring paints the full size round you */
         if(sc.tiles.length!==sc.h||sc.tiles.some(r=>r.length!==sc.w))out.push(sc.id+': ragged tiles');if(!(sc.props||[]).length)out.push(sc.id+': no props');
         for(const P of sc.parts)if(P.ox%1||P.oz%1)out.push(sc.id+': '+P.id+' off the metre grid');
         const pa=sc.parts.find(p=>p.id===sid);for(let j=0;j<4;j++){/* alpha 0.2: away from the edges, where two places' grounds mingle */const i0=Math.floor(A.w/4*j)+4,z0=Math.floor(A.h/3)+1;if(sc.tiles[sc.h-1-(z0+pa.oz)][i0+pa.ox]!==A.tiles[A.h-1-z0][i0]){out.push(sc.id+': scene tiles don’t match');break}}}
         return {out:out.slice(0,6),n,mx}})())"""))
        if r['out']: raise Exception('views: ' + '; '.join(r['out']))
        out.append(f'{r["n"]} place views composed, the biggest {r["mx"]} m, scene tiles carried over exactly')
        # RL-5: the trip seen on the ground (Marigold Town over the road to Tallgrass Meadow, 'v43-road') is retired: both
        # places are parked and the hub has no road (RL-7 walks a run's roads)
        # the flags: only towns have one; a flag pole flies its town's and is rigid. RL-5: Kitewind Ridge (no pole there),
        # Marigold Town's own flag and the route's coin ring are parked: the hub flies its own flag when the catalogue has
        # one, else the coin ring
        fl = json.loads(pg.evaluate("JSON.stringify({towns:gameData.scenery.flags,pole:gameData.scenery.props.flag_pole,path:flagPicturePath(gameData.maps.copperleaf)})"))
        for t in fl['towns'] + ['default']:
            if not (ROOT / 'game' / 'art' / 'scene' / 'flags' / (t + '.png')).exists(): raise Exception(f'no flag picture for {t}')
        own = 'copperleaf' in fl['towns']
        if fl['pole']['sway'] or not fl['pole'].get('flag') or fl['path'] != f'scene/flags/{"copperleaf" if own else "default"}.png': raise Exception(f'flags: {fl}')
        out.append(f'{len(fl["towns"])} town flags, poles rigid with a waving cloth, Copperleaf flies {"its own" if own else "the coin ring"}')
        # wind: every plant sways
        still = json.loads(pg.evaluate("JSON.stringify(Object.entries(walkData().sc.props).filter(([k,M])=>/^(tree|bush|flower|tulip|daisy|fern|reed|cattail|grass|tallgrass|lavender|heather|sedge|bracken|nettle|iris|bulrush)/.test(k)&&!M.flat&&!/fallen|stump|log/.test(k)&&!(M.sway>0)).map(([k])=>k))"))
        if still: raise Exception('plants that never sway: ' + ', '.join(still[:8]))
        w = pg.evaluate("[windLeanAt(10,10,0,walkView.sc,1),windLeanAt(10,10,900,walkView.sc,1)]")
        if abs(w[0] - w[1]) < .005: raise Exception(f'the wind does not move: {w}')
        out.append('every plant sways; the encounter grass takes the wind')
        # voxel props: recipes resolve, meshes build, a few draw
        vx = json.loads(pg.evaluate("""JSON.stringify((()=>{const C=walkData().sc.props,keys=Object.keys(C).filter(k=>C[k].model);const out={n:keys.length,built:0,empty:[],drawn:propModelState.drawn};
         for(const k of keys.slice(0,12)){const spec=C[k].model,rec=typeof spec==='object'?spec:propModelState.recipes.get(spec);if(!rec){loadPropModelRecipe(spec);continue}const m=greedyVoxelMesh(voxelise(rec),rec.vpm||8);if(m&&m.n>0)out.built++;else out.empty.push(k)}return out})())"""))
        if vx['n'] < 30: raise Exception(f'{vx["n"]} props with a voxel recipe (want 30+)')
        if vx['empty']: raise Exception('empty voxel models: ' + ', '.join(vx['empty']))
        out.append(f'{vx["n"]} props with a voxel recipe, {vx["built"]} of 12 meshed on the spot, {vx["drawn"]} drawn last frame')
        # the light: SH ambient, cascades, lamp maps, god rays all on and running without errors
        lt = json.loads(pg.evaluate("JSON.stringify({sh:!!(walkRenderer.X&&walkRenderer.X.sh),cas:!!(walkRenderer.lastShadow&&walkRenderer.lastShadow.far),vol:!!gpuState.fb.vol1,ao:engineSetting('shadows','aoKind')})"))
        if not (lt['sh'] and lt['cas']): raise Exception(f'light: {lt}')
        go_scene(pg, 0); pg.evaluate("environment.force={time:22,weather:'clear',season:'summer'};0"); time.sleep(4); until(pg, "(walkRenderer.X&&walkRenderer.X.lampSh||[]).length>0", 20)   # RL-5: node 0 is Copperleaf now (its lanterns; was Marigold Town)
        lamps = pg.evaluate("(walkRenderer.X&&walkRenderer.X.lampSh||[]).length"); shot(pg, 'lamps-night'); pg.evaluate("environment.force=null;0")
        if not lamps: raise Exception('no lamp shadow map at night in Copperleaf ' + pg.evaluate("JSON.stringify({id:walkView.id,pl:[walkView.pl.x,walkView.pl.z],n:(walkRenderer.X&&walkRenderer.X.lights||[]).length,night:environment.night,force:environment.force,dark:walkRenderer.dark,bt:!!walkRenderer.bt,q:engineSetting('shadows','lampShadows'),near:(walkRenderer.X&&walkRenderer.X.lights||[]).slice(0,3).map(l=>[l.p.map(v=>+v.toFixed(1)),l.r])})"))
        out.append(f'sky-shaped ambient, two shadow cascades, god rays {"on" if lt["vol"] else "off"}, {lt["ao"]} occlusion, {lamps} lamp shadow map(s) at night')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    views_flags_wind_light()

    @step('Ground tiles, building plans and colours, rooms laid in at their doors', 300)
    def buildings_and_rooms():
        """every ground kind has its 12 tiles; the new buildings have a 3D plan or a low-poly model and every colour variant
        loads; each kind of building has a room (in the game or parked); walking into Hazel's lab lays the room into Copperleaf where the lab stands (its doorway
        exactly at the lab's door, the hamlet dimmed around it, nowhere to walk but the floor) and walking out leaves you
        at the door with the lab back. RL-5: the hub's doors and its lab (the shop was Marigold Town's, parked)"""
        out = []
        tiles = json.loads(pg.evaluate("JSON.stringify(Object.values(walkData().sc.terrains).map(T=>bigTilePaths(T.tile)))"))
        miss = [p for L in tiles for p in L if not (ROOT / 'game' / 'art' / p).exists()]
        short = [L[0] for L in tiles if len(L) < 12]
        if miss or short: raise Exception(f'ground tiles: {len(miss)} missing (e.g. {miss[:3]}), {len(short)} kinds with fewer than 12')
        out.append(f'{len(tiles)} ground kinds × 12 tiles')
        b = json.loads(pg.evaluate("""(()=>{const C=walkData().sc.props,K=['bakery','inn','market_hall','bank','library','school','fire_station','mansion','barn','greenhouse','ski_lodge'],imgs=[];let plans=0,vars=0;
          for(const [k,M] of Object.entries(C)){if(!M.build)continue;plans++;for(const v of M.build.variants||[]){vars++;imgs.push(v.img)}}
          return JSON.stringify({missing:K.filter(k=>!C[k]||!(C[k].build||C[k].model)),plans,models:K.filter(k=>C[k]&&C[k].model).length,vars,imgs,rooms:K.map(k=>[k,(C[k]&&C[k].room)||'int_'+k]),v2:propWithVariant({v:2},C.house).img})})()"""))
        # TC-3: a kind of building is drawn from its 3D plan (build) or, since the low-poly kit, from its model; its room is
        # in the game or parked with the unreachable rooms in game/data/legacy (the owner's choice, lane C), as check-data
        # allows. The colour pick is the house's (the bakery's colours went with its plan)
        rooms = [k for k, r in b['rooms'] if not pg.evaluate(f"!!gameData.maps[{json.dumps(r)}]") and not (GAME / 'data' / 'legacy' / 'maps' / f'{r}.json').exists()]
        if b['missing'] or rooms: raise Exception(f'buildings without a plan or a model: {b["missing"]}; kinds without a room: {rooms}')
        if not b['v2'].endswith('house_v2.png'): raise Exception('a placed building’s colour (v) doesn’t pick its picture: ' + b['v2'])
        bad = pg.evaluate(f"Promise.all({json.dumps(b['imgs'])}.map(p=>artLoad([p]).then(()=>imageReady(artImage(p))?null:p).catch(()=>p))).then(L=>L.filter(Boolean))")
        if bad: raise Exception(f'{len(bad)} building colours don’t load: {bad[:3]}')
        out.append(f'{b["plans"]} buildings with 3D plans ({b["models"]} of the {len(b["rooms"])} kinds with a model instead), {b["vars"]} colour variants load, a room for each kind (in the game or parked)')
        # phase 08b: every door of three towns: its room's doorway within 0.1 m of the door, the room inside the view
        # (RL-5: of the hub alone: Verdigris City and Marigold Town are parked)
        nd, bad = 0, []
        for place in ('copperleaf',):
            go_scene(pg, pg.evaluate(f"LOCATIONS.findIndex(l=>l.mapId==='{place}')"))
            d = json.loads(pg.evaluate("""JSON.stringify((()=>{const C=walkData().sc,bad=[];let n=0;
              for(const p of walkView.sc.props){if(!ROOM_BY_USE[p.act])continue;const M=C.props[p.k],E=doorOf(p),id=roomFor(p.act,p);if(!M||!M.box||!E||!id)continue;
                const q=roomTurnOf(p.rot),dr=[+E.at[0].toFixed(1),+E.at[1].toFixed(1),+E.mid[0].toFixed(1)];if(q)dr.push(q,+E.mid[1].toFixed(1));/* IS-5: a building facing any way, its doorway measured along its front */
                const sc=seamlessRoomMap(walkView.id,id,dr),R=sc&&sc.roomRect,d=sc?Math.abs((sc.exits[0][0]-E.at[0])*-E.out[1]+(sc.exits[0][1]-E.at[1])*E.out[0]):9;n++;
                if(d>.1||!R||R[0]<0||R[1]<0||R[0]+R[2]>sc.w||R[1]+R[3]>sc.h)bad.push(p.k+' at '+p.x+', '+p.z+': '+d.toFixed(2)+' m')}return {n,bad}})())"""))
            nd += d['n']; bad += [place + ' ' + b for b in d['bad']]
        if bad: raise Exception(f'{len(bad)} of {nd} doors: the room’s doorway isn’t at the door, or the room leaves the view: {bad[:4]}')
        out.append(f'{nd} doors in Copperleaf: each room’s doorway within 0.1 m of its door')   # RL-5: the hub's doors alone
        # walk into Hazel's lab: the room opens in place (RL-5: was Marigold Town's shop, parked with its town)
        pg.evaluate("uiState.inside=null;uiState.goingIn=null;uiState.bench=null;uiState.modal=null;uiState.mq=[];renderOverlay();environment.force={time:13,weather:'clear',season:'summer'};0"); go_scene(pg, 0); time.sleep(2)
        pg.evaluate("(()=>{const p=walkView.sc.props.find(p=>p.act==='lab'),C=walkData().sc,g=actionSpot(p,C.props[p.k],C.ppu||34);window.__lab=[p.x,p.z];walkView.pl.route=null;walkView.pl.x=g[0]-2;walkView.pl.z=g[1]-1.5;walkPick({k:'act',p,act:'lab'})})();0")   # a couple of steps from the door (walking is slow here)
        t0 = time.time(); ok = False
        while time.time() - t0 < 90:
            pg.evaluate("walkRenderer.prepBoost=60;0")                                    # this machine draws a frame a second: let the room be prepared in big slices
            if pg.evaluate("!!(walkView.ready&&walkView.sc&&walkView.sc.roomOf==='int_lab'&&walkView.id.includes('#'))"): ok = True; break
            time.sleep(1)
        if not ok: raise Exception('the lab’s room didn’t open in place (' + pg.evaluate("walkView.id") + '; ' + ' | '.join(pg.evaluate("debugLog.ev.slice(-4).map(e=>e.msg)")) + ')')
        time.sleep(2); until(pg, "(roomDimming(walkView.sc)||{dim:0}).dim>.6", 15)   # alpha 0.1: the dimming fades in over the first frames drawn inside (slow here)
        r = json.loads(pg.evaluate("""JSON.stringify((()=>{const sc=walkView.sc,I=uiState.inside,RD=roomDimming(sc),n=navGrid(),N=NAV_CELLS_PER_M,R=sc.roomRect,blocked=(x,z)=>!!n.blk[Math.floor(z*N)*n.gw+Math.floor(x*N)];
          return {exit:sc.exits[0],door:I&&I.door,dim:RD?RD.dim:0,outBlocked:blocked(R[0]-2,R[1]+R[3]/2)&&blocked(R[0]+R[2]/2,R[1]-2),inFree:!blocked(R[0]+R[2]/2,R[1]+R[3]/2-1),labGone:!sc.props.some(p=>p.act==='lab')}})())"""))
        shot(pg, 'room-in-place')
        if not r['door'] or math.hypot(r['exit'][0] - r['door'][0], r['exit'][1] - r['door'][1]) > .76: raise Exception(f'the room’s doorway {r["exit"]} isn’t at the lab’s door {r["door"]}')   # IS-5: whichever way the lab faces
        if r['dim'] < .4: raise Exception(f'the hamlet around the room isn’t dimmed ({r["dim"]:.2f})')
        if not r['outBlocked'] or not r['inFree']: raise Exception(f'walking: outside the room blocked {r["outBlocked"]}, the floor free {r["inFree"]}')
        if not r['labGone']: raise Exception('the lab’s outside is still standing in its own room')
        out.append(f'lab room laid in at its door (doorway {r["exit"][0]:.1f}, door {r["door"][0]:.1f}), hamlet dimmed {r["dim"]:.2f}')
        pg.evaluate("leaveRoom();0")
        if not until(pg, "walkView.ready&&!walkView.sc.roomRect&&walkView.id==='w:copperleaf*'", 30): raise Exception('walking out didn’t bring the hamlet back (' + pg.evaluate("walkView.id") + ')')   # RL-5: the hub's view
        time.sleep(1.5); shot(pg, 'room-out')
        back = pg.evaluate("(()=>{const d=uiState.roam;const s=walkView.sc.props.some(p=>p.act==='lab');return [Math.hypot(walkView.pl.x-window.__lab[0],walkView.pl.z-window.__lab[1]),s]})()")
        if back[0] > 3 or not back[1]: raise Exception(f'outside: {back[0]:.1f} m from the lab, lab standing {back[1]}')
        pg.evaluate("environment.force=null;0")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out) + '; out again at the lab’s door'
    buildings_and_rooms()

    @step('The game\'s name, Taxed in the Guide, rooms with their building\'s windows', 240)
    def name_taxed_room_windows():
        """Pocket Billies on the page and the title; the Guide counts the Billies you've taxed and the battle has a Tax!
        button; every room of a town shows its building's windows (as many as the front has, double windows as one, in
        the same order) with no furniture in front of them; the picture setting. RL-5: the town is Copperleaf; the
        library's four windows went with Marigold Town"""
        out = []
        t = pg.evaluate("[document.title,renderTitle().includes('<span>POCKET</span><span>BILLIES</span>')?'POCKET BILLIES':'',gameData.meta.title]")
        if 'Pocket Billies' not in t[0] or 'POCKETBILLIES' not in t[1].replace(' ', '') or t[2] != 'Pocket Billies': raise Exception(f'the name: {t}')
        g = pg.evaluate("(()=>{uiState.tab='ledger';uiState.dex=null;uiState.guideTab='dex';render();const h=document.body.innerText;uiState.tab='walk';render();return [h.includes('Taxed'),h.includes('Caught')]})()")
        if not g[0] or g[1]: raise Exception(f'the Guide: Taxed shown {g[0]}, Caught still shown {g[1]}')
        out.append('Pocket Billies on the page, the title screen and in the data; the Guide counts Taxed')
        pg.evaluate("uiState.inside=null;uiState.goingIn=null;uiState.bench=null;uiState.modal=null;uiState.mq=[];renderOverlay();0"); go_scene(pg, 0); time.sleep(1)
        rows = pg.evaluate("""(()=>{const C=walkData().sc,ppu=C.ppu||34,out=[];for(const p of walkView.sc.props){const M=C.props[p.k];if(!M||!M.box||!p.act)continue;let id=null;try{id=roomFor(p.act,p)}catch(e){}if(!id||!mapById(id)||mapById(id).winMatch===0)continue;
          const s=p.s||1,f=p.f?-1:1,dx=((M.door&&M.door.x)||0)/ppu*s*f,door=[+(p.x+dx).toFixed(1),+(+p.z).toFixed(1),+(+p.x).toFixed(1)];seamlessWorld.cache.delete(seamlessRoomId(walkView.id,id,door)+'|'+seamlessWorld.gen);
          const sc=seamlessRoomMap(walkView.id,id,door);if(!sc)continue;const R=sc.roomRect,inR=q=>q.x>=R[0]&&q.x<=R[0]+R[2]&&q.z>=R[1]&&q.z<=R[1]+R[3],ws=sc.props.filter(q=>q.k==='wall_window'&&inR(q)).sort((a,b)=>a.x-b.x);
          const tan=Math.tan((((mapById(id).cam||{}).pitch||34)-3+12)*Math.PI/180),hid=ws.filter(w=>sc.props.some(q=>{if(q===w||!inR(q)||q.k==='wall_window')return false;const Q=C.props[q.k]||{};if(Q.flat)return false;const k=(q.s||1)/ppu,hw=-(Q.ox??-16)*k*.92,d=w.z-q.z;if(d<=.05)return false;
            return Math.min(q.x+hw,w.x+.75*w.s)-Math.max(q.x-hw,w.x-.75*w.s)>.3&&-(Q.oy??-32)*k-d*tan>1.3*w.s+.3}));
          out.push({k:p.k,room:id,front:seamlessBuildingWindows(M,p,ppu).length,inside:ws.length,hidden:hid.length})}return out})()""")
        if not rows: raise Exception('no building in Copperleaf opens into a room')   # RL-5: node 0 is Copperleaf now (was Marigold Town)
        hidden = [r for r in rows if r['hidden']]; none = [r for r in rows if r['front'] and not r['inside']]; more = [r for r in rows if r['inside'] > r['front']]
        if hidden: raise Exception(f'furniture in front of a room window: {hidden[:3]}')
        if none or more: raise Exception(f'rooms whose windows don’t match their building: no window {none[:3]}, more than the front {more[:3]}')
        same = sum(1 for r in rows if r['inside'] == r['front'])
        out.append(f'{len(rows)} rooms in Copperleaf: {same} show exactly their front\'s windows, the rest join a double window into one; none behind furniture')
        # RL-5: the library's four windows (a check of its row, then walking into it, 'a01-library-windows') are retired: the
        # library stood in Marigold Town, parked; the hub has none (its room, int_library, stays in the data)
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    name_taxed_room_windows()

    @step('Terraces leave walking as it was, nothing floats', 600)
    def terraces_and_floating():
        """the land between metre corners is smooth and terraces of rock round off at the top and fan out at the foot:
        from every place's hub you reach exactly the same half-metre cells and exits as without that shaping, and no
        prop's base is more than 15 cm above the ground under its footprint (fences and the like follow the slope)"""
        R2 = pg.evaluate("""(()=>{const out=[],C=walkData().sc,keep=walkView.sc;
          const reach=sc=>{walkView.nav=null;walkView.navSc=null;const G=navGrid(),gw=G.gw,gh=G.gh,h=sc.hub||[sc.w/2,sc.h/2],s=nearestWalkableCell(h[0],h[1]);if(!s)return [0,0];const seen=new Uint8Array(gw*gh),Q=[s.j*gw+s.i];seen[Q[0]]=1;
            while(Q.length){const c=Q.pop(),i=c%gw,j=(c-i)/gw;for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){const ii=i+a,jj=j+b;if(ii<0||jj<0||ii>=gw||jj>=gh)continue;const q=jj*gw+ii;if(seen[q]||G.blk[q]||!canStepBetween(G,c,q))continue;seen[q]=1;Q.push(q)}}
            let n=0;for(const v of seen)n+=v;let ex=0;for(const e of sc.exits||[]){const c=nearestWalkableCell(e[0],e[1]);if(c&&seen[c.j*gw+c.i])ex++}return [n,ex]};
          for(const id of LOCATIONS.map(r=>r.mapId).filter(Boolean)){const sc=mapById(id);if(!sc)continue;walkView.sc=sc;walkView.noShape=1;const a=reach(sc);walkView.noShape=0;const b=reach(sc);
            let fl=[];for(const p of sc.props||[]){const M=C.props[p.k];if(!M||M.flat||M.walk||M.build||M.door!=null||(typeof propShown==='function'&&!propShown(p)))continue;const g=(M.group||'')+' '+p.k;if(SLOPE_HUGGERS.test(g)&&!/tree|lamp|post|sign|pole/.test(g))continue;
              const s=p.s||1,y=propBaseHeight(p,M),lv=stepLevelAt(p.x,p.z);let pts;if(M.box){const bw=M.box[0]*s/2,bd=M.box[1]*s;pts=[[p.x-bw,p.z-.05],[p.x+bw,p.z-.05],[p.x-bw,p.z+bd],[p.x+bw,p.z+bd]]}else{const r=Math.min(.45,(M.shadow||0)*.3*s);if(r<.08)continue;pts=[[p.x-r,p.z],[p.x+r,p.z],[p.x,p.z-r*.6],[p.x,p.z+r*.6]]}
              let lo=1e9;for(const [x,z] of pts)if(Math.abs(stepLevelAt(x,z)-lv)<=.05)lo=Math.min(lo,standingHeightAt(x,z));if(lo<1e8&&y-lo>.15)fl.push(p.k+'@'+p.x.toFixed(1)+','+p.z.toFixed(1))}
            out.push({id,a,b,fl})}
          walkView.sc=keep;walkView.nav=null;walkView.navSc=null;return out})()""")
        moved = [f"{r['id']} ({r['a'][0]}→{r['b'][0]} cells, exits {r['a'][1]}→{r['b'][1]})" for r in R2 if r['a'] != r['b']]
        floating = [f"{r['id']}: {', '.join(r['fl'][:3])}" for r in R2 if r['fl']]
        if moved: raise Exception('shaped terraces change where you can walk: ' + '; '.join(moved[:5]))
        if floating: raise Exception('props in the air: ' + '; '.join(floating[:5]))
        # RL-5: the picture of Horn Pass's terraces ('a02-terrace-hornpass') is retired: Horn Pass is parked, and its bench
        # only waited 60 s for a scene that no longer opens
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return f'{len(R2)} places: the same cells and exits reachable with natural terraces as without, no prop more than 15 cm off the ground'
    terraces_and_floating()

    # RL-5: 'alpha 0.2: places joined edge to edge — every seam walks straight across and both views agree there' retired: the hub has no neighbour, no road and no exit, so there is no seam, no stored walk and no underground neighbour to check (RL-7 joins a run's places)

    # RL-5: 'phase 08b: walking across seams — the next view ready ahead, no wait, no jump in the picture' retired: every seam it walked (and --seams=all) joined two parked places (RL-7 walks a run's roads, below)

    @step('RL-8: a run from the mast — the flight, a battle, a seam, a paid heal, the shop, a mini-boss and its Loophole pick (RL-12), the boss, the payout, home', 420)
    def rl8_run_from_mast():
        """Copperleaf's mast sheet (tapped as walkPick does) offers "Start a run"; its sheet's "Take off" puts a run on the
        save with its world and flies to the landing (skipped to the end: day 1, beside the landing's mast); a wild
        battle won pays and lets saving go on; the north seam walked (cross()) is day 2; "Go there" walks to the first
        town: the clinic charges $60 a hurt Billie (after a yes), the shop has the day's stock and (RL-12) a Loophole;
        on to the first mini-boss, which blocks the way north and fights a double battle (won): "Pick a Loophole" opens
        the pick, a card tapped and "Take it" holds it; on to the boss, an Alpha (won, its battle carrying the
        Loophole): "On to the payout", the payout as won, "Fly home": Copperleaf with Capital, no run. The hub's save is
        put back after"""
        if not pg.evaluate("typeof runTakeOff==='function'"): return 'not in this build'
        pg.evaluate("window.rl8Hub=JSON.parse(JSON.stringify(saveData));uiState.inside=null;uiState.bench=null;uiState.modal=null;uiState.mq=[];renderOverlay();uiState.tab='walk';saveData.team.forEach(m=>{m.hp=maxHp(m);m.status=null});render();0")
        try:
            if not until(pg, "walkView.ready&&!!walkView.sc.props.find(p=>p.act==='fly')", 90): raise Exception('Copperleaf’s mast isn’t in the view')
            pg.evaluate("(p=>walkPick({k:'act',p,act:'fly'}))(walkView.sc.props.find(p=>p.act==='fly'));0")
            if not until(pg, "!!document.querySelector('#ov [data-a=runstart]')", 20): raise Exception('the mast’s sheet has no “Start a run”')
            pg.click('#ov [data-a=runstart]')
            if not until(pg, "uiState.modal&&uiState.modal.title==='Start a run'", 10): raise Exception('no run sheet')
            pg.click('#ov [data-a=mb][data-i="0"]')
            if not until(pg, "!!saveData.run&&airshipFlight.on", 30): raise Exception('“Take off” didn’t start a run’s flight')
            pg.evaluate("flySkip();0")
            if not until(pg, "!airshipFlight.on&&saveData.run.at.phase==='walk'&&walkView.ready&&walkView.id==='w:'+LOCATIONS[1].mapId+'*'", 90): raise Exception(f'never landed on the landing ({pg.evaluate("saveData.run&&saveData.run.at.phase")}, {pg.evaluate("walkView.id")})')
            land = pg.evaluate("[saveData.run.seed, saveData.trip.node, saveData.run.clock, !!uiState.roam, runWorld.scenes]")
            if land[1] != 1 or land[2] != 1: raise Exception(f'landed at node {land[1]} on day {land[2]}')
            # a wild battle, won
            pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();startWild(encountersHere()[0]);0")
            if not until(pg, "!!activeBattle&&saveHeld()", 20): raise Exception('a run battle didn’t hold the save')
            pg.evaluate("stopTimers();activeBattle.over='win';endBattle();0")
            if not until(pg, "!activeBattle&&!saveHeld()&&saveData.run.at.phase==='walk'", 30): raise Exception('the battle’s end didn’t let saving go on')
            # the north seam, walked: day 2
            pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();0")
            n1 = pg.evaluate("runWorldNode(runNext(saveData.run.map,0)[0])")
            cross(pg, n1)
            if pg.evaluate('saveData.run.clock') != 2: raise Exception(f'walked over the seam: day {pg.evaluate("saveData.run.clock")}, not 2')
            # the first town: a paid heal, the shop
            town = pg.evaluate("runWorldNode(saveData.run.map.nodes.findIndex(n=>n.type==='town'))")
            if not pg.evaluate(f"runJump({town})"): raise Exception('couldn’t walk to the first town')
            pg.evaluate("render();0")
            if not until(pg, f"walkView.ready&&walkView.id==='w:'+LOCATIONS[{town}].mapId+'*'", 90): raise Exception('the town’s view never opened')
            heal = pg.evaluate("""(()=>{uiState.modal=null;uiState.mq=[];saveData.team.forEach(m=>{m.hp=Math.max(1,m.hp-5)});saveData.se=Math.max(saveData.se,500);
              const c=runHealCost(saveData.team,RULES.run.healCost),se=saveData.se;clinicHeal();return [c.cost,se]})()""")
            if not until(pg, "uiState.modal&&uiState.modal.title==='The clinic'", 10): raise Exception('the clinic asked nothing')
            pg.click('#ov [data-a=mb][data-i="0"]')
            if pg.evaluate("saveData.se") != heal[1] - heal[0] or not pg.evaluate("saveData.team.every(m=>m.hp===maxHp(m))"): raise Exception(f'the clinic: ${heal[1]} - ${heal[0]} gave ${pg.evaluate("saveData.se")}')
            wares = pg.evaluate(f"openShop(LOCATIONS[{town}].shop);SHOPS[LOCATIONS[{town}].shop].stock.length")
            if not pg.evaluate("!!document.querySelector('#ov .shop-sheet [data-a=shoprelic]')"): raise Exception('the town’s shop has no Loophole (RL-12)')
            pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();0")
            if wares != len(pg.evaluate('RULES.run.shop.always')) + pg.evaluate('RULES.run.shop.more'): raise Exception(f'the shop has {wares} wares')
            # the first mini-boss: it blocks, a double battle, won
            mb = pg.evaluate("runWorldNode(saveData.run.map.nodes.findIndex(n=>n.type==='miniboss'))")
            pg.evaluate(f"runJump({mb});render();0")
            foe = pg.evaluate(f"(b=>b&&[b.id,b.name])(blockerAt({mb}))")
            if not foe: raise Exception('the mini-boss doesn’t block the way north')
            pg.evaluate(f"saveData.team.forEach(m=>{{m.hp=maxHp(m)}});startTrainer('{foe[0]}',{{talked:true}});0")
            if not until(pg, "!!activeBattle&&activeBattle.fmt==='double'", 20): raise Exception('the mini-boss’s battle isn’t a double battle')
            pg.evaluate("stopTimers();activeBattle.over='win';endBattle();0")
            if not until(pg, f"!activeBattle&&!blockerAt({mb})", 30): raise Exception('beaten, the mini-boss still blocks')
            # RL-12: its pick of Loopholes, stored before the sheet; tapped through
            if not until(pg, "uiState.modal&&uiState.modal.btns&&uiState.modal.btns[0].l==='Pick a Loophole'", 30): raise Exception('no “Pick a Loophole” after the mini-boss')
            if len(pg.evaluate("JSON.parse(localStorage.getItem(SAVE_KEY)).run.offer||[]")) != pg.evaluate('RULES.run.relics.pick'): raise Exception('the pick isn’t stored before it shows')
            pg.click('#ov [data-a=mb][data-i="0"]')
            if not until(pg, "uiState.modal&&uiState.modal.cls==='relic-pick'&&document.querySelectorAll('#ov pb-pick-card').length===RULES.run.relics.pick", 10): raise Exception('the pick didn’t open')
            pg.evaluate("document.querySelector('#ov pb-pick-card').shadowRoot.querySelector('button').click();0")
            if not until(pg, "!document.querySelector('#ov [data-a=mb][data-i=\"0\"]').disabled", 10): raise Exception('a card didn’t enable “Take it”')
            shot(pg, 'rl12-pick')
            pg.click('#ov [data-a=mb][data-i="0"]')
            relic = pg.evaluate("saveData.run.relics.length===1&&!saveData.run.offer&&saveData.run.relics[0]")
            if not relic: raise Exception(f'the pick: held {pg.evaluate("JSON.stringify([saveData.run.relics,saveData.run.offer])")}')
            # the boss: an Alpha, won, the payout, home
            boss = pg.evaluate("saveData.run.map.nodes.length")
            pg.evaluate(f"uiState.modal=null;uiState.mq=[];renderOverlay();runJump({boss});render();0")
            B = pg.evaluate(f"(T=>T&&T.id)(trainersAt({boss})[0])")
            if not B: raise Exception('no boss stands on the boss’s place')
            pg.evaluate(f"saveData.team.forEach(m=>{{m.hp=maxHp(m)}});startTrainer('{B}',{{talked:true}});0")
            if not until(pg, "!!activeBattle&&activeBattle.fmt==='alpha'&&!!activeBattle.sides[1].team[0].boss", 20): raise Exception('the boss isn’t an Alpha battle')
            if pg.evaluate("(activeBattle.fx||[]).map(f=>f.src).join()") != relic: raise Exception('the boss’s battle doesn’t carry the Loophole')
            pg.evaluate("stopTimers();activeBattle.over='win';endBattle();0")
            if not until(pg, "uiState.modal&&uiState.modal.btns&&uiState.modal.btns[0].l==='On to the payout'", 30): raise Exception('no “On to the payout” after the boss')
            pg.click('#ov [data-a=mb][data-i="0"]')
            if not until(pg, "uiState.modal&&uiState.modal.cls==='run-payout'&&saveData.run.at.won===1", 20): raise Exception('no payout as won')
            shot(pg, 'rl8-payout')
            pg.click('#ov [data-a=mb][data-i="0"]')
            if not until(pg, "!saveData.run&&LOCATIONS.length===gameData.locations.length&&walkView.ready&&walkView.id==='w:'+mapIdAt(saveData.trip.node)+'*'", 90): raise Exception('Fly home didn’t bring you back to Copperleaf')
            home = pg.evaluate("[saveData.meta.runs, saveData.meta.wins, saveData.meta.capital, saveData.meta.seals]")
            if home[0] < 1 or home[1] < 1 or home[2] <= 0: raise Exception(f'home: {home}')
            if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
            return f'seed {land[0]}: {land[4]} scenes, landed day 1 by the mast; a battle won; day 2 over the seam; healed for ${heal[0]}; {wares} wares and a Loophole; {foe[1]} beaten (doubles), {relic} picked; the boss (an Alpha) beaten; payout; home: {home[2]} Capital, {home[3]} Seal'
        finally:
            pg.evaluate("if(activeBattle){stopTimers();setActiveBattle(null);battleStageStop()}airshipFlight.on=false;uiState.modal=null;uiState.mq=[];renderOverlay();setSaveData(window.rl8Hub);render();0")
    rl8_run_from_mast()

    @step('Copperleaf: Granny Juniper in her garden, the lab', 240)   # RL-5: the lane down to Marigold Town is parked
    def juniper_and_lab():
        """the new start drawn: Granny Juniper stands by her hives and talks (her first words, then a line), the lab's
        door opens the lab. RL-5: the trip from Copperleaf down Route 1 to Marigold Town went with those places"""
        if not pg.evaluate("typeof personTalk==='function'&&!!LOCATION_BY_ID.copperleaf"): return 'not in this build'
        out = []; node = pg.evaluate("LOCATION_BY_ID.copperleaf.node")
        pg.evaluate("uiState.inside=null;uiState.goingIn=null;uiState.bench=null;uiState.modal=null;uiState.mq=[];renderOverlay();environment.force={time:11,weather:'clear',season:'summer'};saveData.story=saveData.story||{};delete saveData.story.met_juniper;0")
        go_scene(pg, node); time.sleep(2)
        j = pg.evaluate("(()=>{const p=walkView.npcAt['_talk:juniper'];return p?[+p[0].toFixed(1),+p[1].toFixed(1)]:null})()")
        if not j: raise Exception('Granny Juniper isn’t standing in Copperleaf')
        shot(pg, 'copperleaf-juniper')
        pg.evaluate("personTalk(walkState().npcs.find(n=>n.id==='_talk:juniper').talk);0")
        if not until(pg, '!!talkBox.cur', 15): raise Exception('Granny Juniper didn’t say anything')
        first = pg.evaluate("talkBox.cur&&talkBox.cur.text||''")
        until(pg, '!talkBox.on', 40, 'talkBox.cur&&talkBox.cur.tap()')
        if not pg.evaluate("!!storyFlags().met_juniper"): raise Exception('talking to Granny Juniper didn’t count as meeting her')
        out.append(f'Granny Juniper at {j}, she said “{first[:40]}…”')
        pg.evaluate("uiState.toastQ=[];(()=>{const p=walkView.sc.props.find(p=>p.act==='lab'),C=walkData().sc,g=actionSpot(p,C.props[p.k],C.ppu||34);walkView.pl.route=null;walkView.pl.x=g[0];walkView.pl.z=g[1];walkPick({k:'act',p,act:'lab'})})();0")
        if not until(pg, "walkView.ready&&(walkView.id==='int_lab'||(walkView.sc&&walkView.sc.roomOf==='int_lab'))||talkBox.on", 60): raise Exception('the lab didn’t open')
        pg.evaluate("talkHide&&talkHide();if(uiState.inside)leaveRoom();0"); until(pg, "walkView.ready&&!walkView.sc.roomRect", 30)
        out.append('the lab opens')
        # RL-5: down Route 1 (Hedgerow Lane) to Marigold Town on foot is retired: both are parked and the hub has no edge
        # to walk over (RL-7 walks a run's roads)
        pg.evaluate("environment.force=null;uiState.modal=null;uiState.mq=[];renderOverlay();0")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    juniper_and_lab()

    @step('The airship moored in Copperleaf: a low-poly model, its propellers turning', 240)   # RL-5: the flight to Marigold Town is parked
    def airship_moored():
        """the mast's airship draws as a low-poly model, painted with the buildings' 32 px textures, its propellers turning.
        RL-5: the flight (the mast's list of towns you've been to, the fare, crossing the map, landing by the next town's
        mast) is retired: there is no other town to fly to; it comes back with RL-8's airship start"""
        if not pg.evaluate("typeof flyMenu==='function'&&!!LOCATION_BY_ID.copperleaf"): return 'not in this build'
        out = []; cl = pg.evaluate("LOCATION_BY_ID.copperleaf.node")   # RL-5: no Marigold Town to fly to
        pg.evaluate("uiState.inside=null;uiState.bench=null;uiState.modal=null;uiState.mq=[];renderOverlay();environment.force={time:11,weather:'clear',season:'summer'};0")   # RL-5: no visit to Marigold or money for a fare
        go_scene(pg, cl); time.sleep(1)
        pg.evaluate("(()=>{const p=walkView.sc.props.find(p=>p.act==='fly');walkView.pl.route=null;walkView.pl.x=p.x+2.2;walkView.pl.z=p.z-1.6})();0")
        until(pg, "propModelState.meshes.has('scene/models/airship.json')&&!!propModelState.meshes.get('scene/models/airship.json')", 60); time.sleep(2)
        v = pg.evaluate("(()=>{const m=propModelState.meshes.get('scene/models/airship.json');return m?{spins:(m.spins||[]).length,model:!!m.model,tris:m.n/3,drawn:propModelState.drawn}:null})()")
        if not v or not v['model'] or v['spins'] != 2: raise Exception(f'the airship isn’t drawn as a low-poly model with two turning propellers: {v}')
        shot(pg, 'airship-mast')
        out.append(f'the airship drawn as a low-poly model ({v["tris"]:.0f} triangles, the buildings’ textures), {v["spins"]} propellers turning')
        # RL-5: the flight to Marigold Town (the mast's list, the fare, 'a04-airship-flight', landing by its mast) is retired:
        # Marigold Town is parked and the hub is the only town (RL-8's airship start brings a flight back)
        pg.evaluate("environment.force=null;0")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    airship_moored()

    @step('Props made of shapes: low-poly with the 32 px textures (voxels one to a pixel when switched)', 120)
    def lowpoly_props():
        """in the every-prop scene the props made of shapes draw as low-poly models, none as voxels. TC-3: that each recipe
        builds and the budget a phone can carry are tools/test/lowpoly-props.test.mjs's (this step took five minutes
        building every recipe as voxels)"""
        if not pg.evaluate("typeof lowPolyFromRecipe==='function'"): return 'not in this build'
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();uiState.tab='walk';uiState.inside=null;uiState.bench={id:'test_props',test:1};render();0")
        until(pg, "!!(walkView.ready&&walkView.id==='test_props')", 60); pg.evaluate("walkView.pl.x=12;walkView.pl.z=21;walkView.pl.route=null;0"); time.sleep(3)
        m = pg.evaluate("(()=>{const v=[...propModelState.meshes.values()].filter(Boolean);return {lp:v.filter(m=>m.lowpoly).length,vox:v.filter(m=>!m.model).length,drawn:propModelState.drawn}})()")
        if not m['lp'] or m['vox']: raise Exception(f'the every-prop scene drew {m["lp"]} low-poly props and {m["vox"]} voxel ones')
        shot(pg, 'props-lowpoly')
        pg.evaluate("uiState.bench=null;render();0")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return f'the every-prop scene draws {m["lp"]} props as low-poly models, none as voxels'
    lowpoly_props()

    @step('Postcards: the first visit brings the card, the Guide keeps it', 90)
    def postcard_visit():
        """walking into a town you haven't had the postcard of: it slides in with the town's picture and is kept in the
        Guide's Postcards page (it slides away by itself or on a tap); coming back shows just the stamp. RL-5: the town
        is Copperleaf, the only one (Marigold Town is parked)"""
        if not pg.evaluate("typeof postcardCheck==='function'"): return 'not in this build'
        sd = pg.evaluate("LOCATION_BY_ID.copperleaf.node")   # RL-5: Copperleaf's postcard (Marigold Town is parked)
        # alpha 0.5: no postcard before the opening has ended (postcardAllowed; RL-8: it waited for Blake's battle, which left the opening)
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();uiState.bench=null;saveData.cards={};postcardState.last=null;postcardState.on=false;0")
        go_scene(pg, sd)
        if not until(pg, "!!document.querySelector('.pcard-wrap.in')", 12, "postcardCheck()"): raise Exception('no postcard came on walking into Copperleaf')   # RL-5: Copperleaf
        time.sleep(1.2)
        ok = pg.evaluate("(()=>{const im=document.querySelector('.pcard-wrap img');return !!(im&&im.complete&&im.naturalWidth>100)})()")
        if not ok: raise Exception('the postcard’s picture didn’t load')
        shot(pg, 'postcard')
        pg.evaluate("(()=>{const w=document.querySelector('.pcard-wrap');if(w)w.click()})();0"); time.sleep(.8)   # it may have slid away by itself (9 s)
        got = pg.evaluate("Object.keys(saveData.cards||{})")
        if got != ['copperleaf']: raise Exception(f'the Guide keeps {got}')   # RL-5: Copperleaf's card
        pg.evaluate("uiState.tab='ledger';uiState.guideTab='cards';render();0"); time.sleep(.6)
        n = pg.evaluate("document.querySelectorAll('.pc-thumb:not(.none)').length")
        if n != 1: raise Exception(f'the Postcards page shows {n} cards')
        shot(pg, 'postcards-page')
        pg.evaluate("uiState.guideTab='dex';uiState.tab='walk';render();postcardState.last=null;0")
        if not until(pg, "!!document.querySelector('.pc-mini')", 10, "postcardCheck()"): raise Exception('coming back showed no stamp')
        if pg.evaluate("!!document.querySelector('.pcard-wrap')"): raise Exception('coming back showed the big card again')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return 'Copperleaf’s postcard came on the first visit, went into the Guide (1 card), and only its stamp the next time'   # RL-5: Copperleaf
    postcard_visit()

    @step('Windows and lamps by night; a weather front passing', 120)
    def night_lights_and_front():
        """every building kind and every lamp in one scene (test_windows), opened at night: it draws, the buildings are 3D
        and the lamps are lit; then a front of rain comes in over Copperleaf (RL-5: was Marigold Town) and its curtain
        sweeps across"""
        if not pg.evaluate("!!gameData.maps.test_windows"): return 'not in this build'
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();environment.on=true;environment.force={time:22,weather:'clear',season:'summer'};uiState.tab='walk';uiState.inside=null;uiState.bench={id:'test_windows',test:1};render();0")
        if not until(pg, "!!(walkView.ready&&walkView.id==='test_windows'&&walkRenderer.frames>4)", 60): raise Exception('the windows and lamps scene didn’t open')
        pg.evaluate("walkView.pl.x=44;walkView.pl.z=10;walkView.pl.route=null;0"); time.sleep(4)
        until(pg, "typeof buildingState!=='undefined'&&buildingState.drawn>=8", 90)   # the buildings' meshes come a few a frame: give them time (5 to 8 are in view here)
        r = pg.evaluate("""(()=>{const L=walkView.sc.props.filter(p=>{const M=gameData.scenery.props[p.k];return M&&(M.glow||(M.fx||[]).some(f=>f.k==='glow'))});
          engineContext.env=true;const on=typeof lampLit==='function'?L.filter(p=>lampLit(p.x,p.z,0)>.9).length:-1;engineContext.env=false;let fw=0,lit=0;const lf=typeof litWindowFraction==='function'?litWindowFraction():0;
          for(const p of walkView.sc.props){const E=typeof buildingState!=='undefined'?buildingState.mesh.get(p):null;if(E&&E.fw){fw+=E.fw.length;lit+=E.fw.filter(f=>frontWindowLight(f[3],lf)).length}}
          return {b:typeof buildingState!=='undefined'?buildingState.drawn:0,lamp:environment.lampK,lamps:L.length,on,fw,lit}})()""")
        if r['b'] < 4: raise Exception(f'only {r["b"]} buildings drawn in 3D')
        # alpha 0.4: at ten at night every lamp is on, and some (not all, not none) of the front windows are lit
        if r['on'] < r['lamps']: raise Exception(f'only {r["on"]} of {r["lamps"]} lamps are on at night')
        if r['fw'] and not (0 < r['lit'] < r['fw']): raise Exception(f'{r["lit"]} of {r["fw"]} front windows lit at night')
        shot(pg, 'windows-night')
        # a front: the weather changes while you're in a place, the curtain comes across
        sd = pg.evaluate("LOCATION_BY_ID.copperleaf.node")   # RL-5: over the hub (Marigold Town is parked)
        pg.evaluate("uiState.bench=null;environment.force={time:13,weather:'clear',season:'summer',front:1};0"); go_scene(pg, sd); time.sleep(2)
        pg.evaluate("environment.force={time:13,weather:'rain',season:'summer',front:1};0")
        if not until(pg, "!!(environment.front&&environment.curtain)", 15): raise Exception('no front came in when the weather turned to rain')
        time.sleep(3); c = pg.evaluate("({e:environment.curtain?environment.curtain.e:null,into:environment.curtain?environment.curtain.into:null,cloud:environment.cloud})")
        shot(pg, 'rain-front')
        pg.evaluate("environment.force=null;0")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return f'{r["b"]} buildings in 3D by night, {r["on"]} of {r["lamps"]} lamps on, {r["lit"]} of {r["fw"]} front windows lit; a rain front came in (its curtain at {c["e"]:.2f}, coming in: {c["into"]})'
    night_lights_and_front()

    @step('Running: the joystick’s outer ring, the D-pad’s centre, Shift and "Always run"', 180)
    def run_speeds():
        """the walk speed a full push gives, and 1.7 times that when running; the ring and the D-pad's centre set the run from
        real pointer events, a light push walks slowly, and the keys walk at the same speed as a full push"""
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();saveData.preferences.control='stick';saveData.preferences.alwaysRun=false;0")
        n0 = pg.evaluate("LOCATIONS.findIndex(r=>r.mapId==='copperleaf')")   # RL-5: Copperleaf (Marigold Town is parked)
        go_scene(pg, n0, 150); time.sleep(2)
        hub = pg.evaluate("[walkView.pl.x,walkView.pl.z]")

        def speed(setup, undo):
            """metres a second over about 0.6 s of game time, back and forth so the player stays near the hub"""
            out = []
            for y in (1, -1):
                pg.evaluate(f"walkView.pl.x={hub[0]};walkView.pl.z={hub[1]};walkView.pl.route=null;0")
                a = pg.evaluate(f"(()=>{{{setup.replace('Y', str(y))};return [walkView.pl.x,walkView.pl.z,walkView.t,walkView.pl.gait]}})()")
                until(pg, f"walkView.t>={a[2] + 600}", 60)
                b = pg.evaluate(f"(()=>{{const r=[walkView.pl.x,walkView.pl.z,walkView.t,walkView.pl.gait];{undo};return r}})()")
                d = ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** .5
                # the walk cycle, footsteps and bob follow the metres walked (pl.gait), at any speed
                if d > .5 and abs((b[3] - a[3]) / d - 1) > .05: gait.append(f'{setup}: walked {d:.2f} m, gait grew {b[3] - a[3]:.2f}')
                out.append(d / max(.001, (b[2] - a[2]) / 1000))
            return max(out)
        gait = []
        walk = speed("walkView.stick={x:0,y:Y}", "walkView.stick=null")
        light = speed("walkView.stick={x:0,y:Y*0.4}", "walkView.stick=null")
        ring = speed("walkView.stick={x:0,y:Y};walkView.run=true", "walkView.stick=null;walkView.run=false")
        keys = speed("walkView.keys[Y>0?'u':'d']=1", "walkView.keys={}")
        shift = speed("walkView.keys[Y>0?'u':'d']=1;walkView.keys.run=1", "walkView.keys={}")
        always = speed("saveData.preferences.alwaysRun=true;walkView.stick={x:0,y:Y}", "walkView.stick=null;saveData.preferences.alwaysRun=false")
        bad = list(gait)
        if not 2.6 < walk < 3.8: bad.append(f'a full push walks at {walk:.2f} m/s (3.4)')
        for n, v, k in (('a light push', light, .6), ('the ring', ring, 1.7), ('the keys', keys, 1), ('Shift', shift, 1.7), ('Always run', always, 1.7)):
            if abs(v / walk - k) > .15 * k: bad.append(f'{n}: {v:.2f} m/s, {v / walk:.2f}x a full push (want {k}x)')
        # the ring and the D-pad's centre from real pointer events
        r = pg.evaluate("""(()=>{const d=document.getElementById('dio'),R=d.getBoundingClientRect(),x=R.left+R.width/2,y=R.top+R.height/2,
          ev=(k,dx,dy)=>document.dispatchEvent(new PointerEvent(k,{pointerId:7,clientX:x+dx,clientY:y+dy,bubbles:true,isPrimary:true}));
          d.dispatchEvent(new PointerEvent('pointerdown',{pointerId:7,clientX:x,clientY:y,bubbles:true,isPrimary:true}));
          ev('pointermove',0,-40);const a=[walkView.run,!!document.querySelector('.joy.run')];
          ev('pointermove',0,-75);const b=[walkView.run,!!document.querySelector('.joy.run')];
          ev('pointermove',0,-62);const c=walkView.run;ev('pointermove',0,-50);const e=walkView.run;
          ev('pointerup',0,-50);return {inside:a,ring:b,give:c,back:e,after:walkView.run}})()""")
        if r['inside'] != [False, False] or r['ring'] != [True, True] or not r['give'] or r['back'] or r['after']:
            bad.append(f'the joystick ring: {r}')
        pg.evaluate("saveData.preferences.control='dpad';renderOverlay();render();0"); time.sleep(.8)
        dp = pg.evaluate("""(()=>{const i=document.querySelector('.dpad.on i');if(!i)return null;const R=i.getBoundingClientRect(),
          o={pointerId:9,clientX:R.left+R.width/2,clientY:R.top+R.height/2,bubbles:true};
          i.dispatchEvent(new PointerEvent('pointerdown',o));const a=[walkView.run,!!document.querySelector('.dpad.run'),!!walkView.stick];
          i.dispatchEvent(new PointerEvent('pointerup',o));return [a,walkView.run]})()""")
        pg.evaluate("saveData.preferences.control='stick';walkView.run=false;renderOverlay();render();0")
        if dp != [[True, True, False], False]: bad.append(f'the D-pad centre: {dp} (want it to run without walking, and stop on release)')
        if bad: raise Exception('; '.join(bad))
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return f'full push {walk:.2f} m/s; light push {light / walk:.2f}x, ring {ring / walk:.2f}x, keys {keys / walk:.2f}x, Shift {shift / walk:.2f}x, Always run {always / walk:.2f}x; the ring and the D-pad centre run from pointer events'
    run_speeds()

    @step('Settings: one save and the account box, languages, text size, contrast', 90)
    def settings():
        pg.evaluate("(()=>{const gl=typeof gpuState!=='undefined'&&gpuState.gl;if(gl&&gl.__chk){for(const k of ['useProgram','drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced'])delete gl[k];delete gl.__chk}})()")
        out = []
        # alpha 0.4.1: one save per player; the account box shows in Settings → Save (a sign-in button once Firebase is set up)
        acc = pg.evaluate("(()=>{const t=uiState.setTab;uiState.setTab='save';const h=settingsHTML();uiState.setTab=t;return {box:h.includes('acc-box'),slots:typeof slotInfo==='function',key:SAVE_KEY}})()")
        if acc['slots']: raise Exception('the old save slots are still there')
        if not acc['box']: raise Exception('no account box in Settings → Save')
        out.append(f'one save ({acc["key"]}), the account box in Settings')
        pg.evaluate("saveData.preferences.lang='nl';applyPreferences();uiState.tab='walk';render();0"); time.sleep(1)
        # UI-5: the bottom bar is <pb-nav-bar id="nav">, its tabs in its shadow tree (Map, Team, Bag; no Walk tab)
        nl = pg.evaluate("[...document.querySelector('#nav').shadowRoot.querySelectorAll('button')].map(b=>b.textContent.trim()).join(',')")
        pg.evaluate("saveData.preferences.lang='en';applyPreferences();render();0"); time.sleep(.5)
        en = pg.evaluate("[...document.querySelector('#nav').shadowRoot.querySelectorAll('button')].map(b=>b.textContent.trim()).join(',')")
        if 'Kaart' not in nl or 'Map' not in en: raise Exception(f'language switch: Dutch tabs “{nl}”, back to English “{en}”')
        out.append(f'Dutch tabs: {nl}')
        pg.evaluate("saveData.preferences.textSize='xlarge';saveData.preferences.contrast='high';applyPreferences();0"); time.sleep(.6); shot(pg, 'settings-large-contrast')
        a = pg.evaluate("[document.documentElement.dataset.text,document.documentElement.dataset.contrast]")
        pg.evaluate("saveData.preferences.textSize='normal';saveData.preferences.contrast='normal';applyPreferences();0")
        if a != ['xlarge', 'high']: raise Exception(f'text size and contrast didn’t apply ({a})')
        out.append('larger text and high contrast apply')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    settings()
    R['desktopErrors'] = errs[:10]; ctx.close()


BASE = ROOT / 'validation' / 'quick-baseline'


def compare_pictures(R):
    """v30: every picture this run took next to the same picture from the baseline (validation/quick-baseline/).
    Small differences are normal (animation, weather, the clock); a big one is worth a look, so it's listed with a
    side-by-side image in validation/quick/compare/. --baseline makes this run's pictures the new baseline."""
    from PIL import Image, ImageChops, ImageStat
    if '--baseline' in ARGS:
        if BASE.exists(): shutil.rmtree(BASE)
        BASE.mkdir(parents=True)
        for f in OUT.glob('*.webp'): shutil.copy2(f, BASE / f.name)
        notes.append(f'{len(list(BASE.glob("*.webp")))} pictures saved as the new baseline (validation/quick-baseline/)'); return
    if not BASE.exists(): return
    out = OUT / 'compare'; diffs = []
    for f in sorted(OUT.glob('*.webp')):
        b = BASE / f.name
        if not b.exists(): continue
        A = Image.open(f).convert('L').resize((96, 64)); Bm = Image.open(b).convert('L').resize((96, 64))
        d = ImageStat.Stat(ImageChops.difference(A, Bm)).mean[0]
        diffs.append((round(d, 1), f.stem))
        if d > 14:
            out.mkdir(exist_ok=True); a1, b1 = Image.open(b).convert('RGB'), Image.open(f).convert('RGB'); h = max(a1.height, b1.height)
            s2 = Image.new('RGB', (a1.width + b1.width + 8, h), (40, 40, 40)); s2.paste(a1, (0, 0)); s2.paste(b1, (a1.width + 8, 0)); s2.save(out / f'{f.stem}.webp', 'WEBP', quality=75)
    R['pictureDifferences'] = sorted(diffs, reverse=True)
    big = [n for d, n in diffs if d > 14]
    if big: notes.append(f'{len(big)} picture(s) look different from the baseline: {", ".join(big[:8])} (side by side in validation/quick/compare/)')
    elif diffs: notes.append(f'{len(diffs)} pictures match the baseline closely')


def timing_report(R):
    """phase 01: the total and the slowest steps, so the time a check costs stays visible"""
    done = [s for s in steps if s.get('seconds')]
    slow = sorted(done, key=lambda s: -s['seconds'])[:10]
    R['slowest'] = [[s['step'], s['seconds']] for s in slow]
    print(f'\nTime: {round(time.time() - T0)} s in all, {len(steps)} steps ({sum(1 for s in steps if s["ok"])} passed). Slowest:')
    for s in slow: print(f'  {s["seconds"]:7.1f} s  {s["step"][:100]}')


def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('Install Playwright first:  pip install playwright && python3 -m playwright install chromium'); sys.exit(1)
    if OUT.exists(): shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    R = {'when': time.strftime('%Y-%m-%d %H:%M'), 'render': 'software, a third of the resolution, 1024 shadow map'}
    # phase 04b: data/gamedata.js is generated from the data files; make it from the files as they are now
    subprocess.run(['node', str(ROOT / 'tools' / 'build-data.mjs')], check=True)
    check_windows(); check_ground(); report_unused()
    srv, base = serve(GAME)
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        if '--selftest' in ARGS:
            in_game_test_whole(b, base, R)
        else:
            phone_flow(b, base, R)
            in_game_test_step(b, base, R)
            actions_sheet_step(b, base, R)
            if not SMOKE:
                safety_step(b, base, R)
                targets_step(b, base, R)
                sound_step(b, base, R)
                debug_menu_step(b, base, R)
                sound_fingerprints(b, base, R)
                run_music_step(b, base, R)
                battle_music_step(b, base, R)
                run_map_weather_step(b, base, R)
                sound_effects_step(b, base, R)
                try:
                    desktop_steps(b, base, R)
                except Exception as e:
                    problems.append(f'desktop: {str(e).splitlines()[0][:200]}')
        b.close()
    srv.shutdown()
    if '--props' in ARGS:
        log('Props: every prop on contact sheets (validation/props/)')
        r = subprocess.run([sys.executable, str(ROOT / 'tools' / 'prop-sheet.py')], capture_output=True, text=True)
        steps.append({'step': 'Props: contact sheets', 'ok': r.returncode == 0, 'seconds': 0, 'note': (r.stdout.strip().splitlines() or [''])[-1][:200]})
        if r.returncode: problems.append('Props: ' + (r.stderr.strip().splitlines() or ['failed'])[-1][:200])
    if not SMOKE: compare_pictures(R)
    timing_report(R)
    R.update({'steps': steps, 'problems': problems, 'notes': notes, 'seconds': round(time.time() - T0), 'smoke': SMOKE})
    (OUT / 'results.json').write_text(json.dumps(R, indent=2, ensure_ascii=False))
    log(f'done in {R["seconds"]}s: ' + ('no problems' if not problems else f'{len(problems)} problem(s)'))
    for p in problems: print('  PROBLEM', p)
    for n in notes: print('  note', n)
    sys.exit(1 if problems else 0)


if __name__ == '__main__':
    main()

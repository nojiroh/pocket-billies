#!/usr/bin/env python3
"""A quick check of Pocket Billies made for a headless test machine (a browser without a graphics chip, which draws the
3D scenes in software and slowly). It is the check Claude runs while building a version; it takes a few minutes.

    python3 tools/check-quick.py                 # data, code, shaders, every scene once, the main flows
    python3 tools/check-quick.py --smoke         # the fast subset: data and code, Start-Game on a phone + debug log, Studio opens
    python3 tools/check-quick.py --studio        # also the Studio round trip on a temporary copy
    python3 tools/check-quick.py --closeups      # also close-up pictures of cliffs, stairs, bridges and water
    python3 tools/check-quick.py --scenes=city,pond   # only these walk scenes (by id), for a change to one place
    python3 tools/check-quick.py --steps=v34,battle   # only the steps whose names hold these words
    python3 tools/check-quick.py --tests         # also draw every test scene and take its pictures (the walking checks
                                                 # of the test scenes always run; they need no drawing)

What it does not do: the game's own **full test** (the debug menu: Settings → Debug, or Ctrl+Shift+D → Full test). That one measures frame rates,
stress-tests the renderer and plays every scene for real, which only means something on a real phone or computer
with a graphics chip, so it is run by you and sent back as a debug log. `tools/check-game.py` is the long play-test
at four screen sizes (best run on a real computer too).

How it stays quick in software: the frames are drawn at a third of the resolution with a small shadow map, scene
logic (walkable paths, doors, bridges, stairs) is checked directly from the data without drawing, each scene is drawn
just until its first frames appear, and every step has a time limit so a stuck step is reported, not waited on.
Pictures go to validation/quick/ as WebP; the summary to validation/quick/results.json. With a baseline in
validation/quick-baseline/ (make one with --baseline), each picture is compared with it. Nothing in game/ or studio/
is changed."""
import io, json, os, re, shutil, socket, subprocess, sys, tempfile, threading, time
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
NO_ACCOUNTS = "Object.defineProperty(window,'PB_FIREBASE',{get(){return null},set(){},configurable:false})"   # alpha 0.4.1: no Google sign-in during the checks
# phase 04d: the modules' names on window (game/js/test-globals.js), only for the checks' page.evaluate() calls
TEST_GLOBALS = "window.PB_TEST_GLOBALS=true"
LOW_RENDER = "GD.engine=GD.engine||{};GD.engine.defaults=Object.assign({},GD.engine.defaults||{},{quality:{resolution:.34,shadowMap:1024,auto:false}});0"
ARGS = sys.argv[1:]
# phase 01: --smoke is the fast subset run after every change and on every push (about two minutes): the data and code
# checks, Start-Game on a phone (with the debug log export) and the Studio opening. The full check runs nightly and per phase
SMOKE = '--smoke' in ARGS
# where a point of the walk scene is on screen (the same projection the renderer uses)
PROJ = "(([x,z])=>{const C=walkView.C,r=walkView.cv.getBoundingClientRect(),y=standingHeightAt(x,z)+(typeof worldCurveDrop==='function'?worldCurveDrop(x,z):0);if(C.vp){const m=C.vp,cx=m[0]*x+m[4]*y+m[8]*z+m[12],cy=m[1]*x+m[5]*y+m[9]*z+m[13],w=m[3]*x+m[7]*y+m[11]*z+m[15];return [r.left+(cx/w*.5+.5)*r.width,r.top+(1-(cy/w*.5+.5))*r.height]}const q=worldToScreen(C,x,y,z);return [r.left+q.x/walkView.cv.width*r.width,r.top+q.y/walkView.cv.height*r.height]})(%s)"
ONLY = next((a.split('=', 1)[1].split(',') for a in ARGS if a.startswith('--scenes=')), None)
STEPS = next((a.split('=', 1)[1].split(',') for a in ARGS if a.startswith('--steps=')), None)
problems, notes, steps = [], [], []


def log(msg):
    print(f'[{time.time() - T0:6.1f}s] {msg}', flush=True)


CUR = {'pg': None}


def page_diag(since=0):
    """v33: what the game says about itself (NWLOG.diag): screen, scene, renderer, slow frames and their causes, errors"""
    pg = CUR['pg']
    if not pg: return None
    try: return pg.evaluate(f"typeof NWLOG!=='undefined'&&NWLOG.diag?NWLOG.diag({int(since)}):null")
    except Exception as e: return {'unavailable': str(e).splitlines()[0][:120]}


def page_now():
    try: return CUR['pg'].evaluate("typeof NWLOG!=='undefined'?NWLOG.now():0") if CUR['pg'] else 0
    except Exception: return 0


def step(name, limit):
    """a step with a time limit: decorated functions run, their time is logged, an exception becomes a problem.
    v33: each step also says what the game was doing (slow frames and their causes, errors); a problem adds where it
    happened in our code, what was on screen, and a picture (fail-<step>.webp)"""
    def wrap(fn):
        def run(*a, **k):
            # v34: --steps=v34,battle runs only the steps whose name holds one of those words (the scenes still load)
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
@step('Version: one source, the same in README.md and CHANGELOG.md', 5)
def check_version():
    """phase 03: game/version.js is the only place the version is written; the game, the Studio, the service worker,
    the debug log and saves read it. The README title and the newest CHANGELOG entry can't read it, so compare them."""
    m = re.search(r"PB_VERSION\s*=\s*'([^']+)'", (GAME / 'version.js').read_text(encoding='utf-8'))
    if not m: raise Exception('game/version.js has no PB_VERSION')
    v = m.group(1); bad = []
    if not re.match(r'^\d+\.\d+\.\d+ (alpha|beta)$', v): bad.append(f'"{v}" is not 0.MINOR.PATCH alpha/beta')
    readme = (ROOT / 'README.md').read_text(encoding='utf-8').splitlines()[0]
    if not readme.endswith(' ' + v): bad.append(f'README.md title says "{readme}"')
    ch = re.search(r'^## (\S+ \S+)', (ROOT / 'CHANGELOG.md').read_text(encoding='utf-8'), re.M)
    if not ch or ch.group(1) != v: bad.append(f'the newest CHANGELOG.md entry is {ch.group(1) if ch else "missing"}')
    for f in ['game/index.html', 'studio/index.html']:
        if 'version.js"' not in (ROOT / f).read_text(encoding='utf-8'): bad.append(f'{f} does not load version.js')
    if "importScripts('version.js')" not in (GAME / 'sw.js').read_text(encoding='utf-8'): bad.append('sw.js does not read version.js')
    old = [str(f.relative_to(ROOT)) for f in list((GAME / 'js').rglob('*.js')) + [GAME / 'sw.js'] if re.search(r"'(?:pocketbillies-)?alpha-0\.\d", f.read_text(encoding='utf-8'))]
    if old: bad.append('an old version string is left in ' + ', '.join(old))
    if bad: raise Exception('; '.join(bad))
    return f'{v}: README.md, CHANGELOG.md, the game, the Studio and the service worker agree'


@step('Code: every script parses', 20)
def check_code():
    node = shutil.which('node')
    if not node: return 'node not installed, skipped'
    files = sorted(list((GAME / 'js').rglob('*.js')) + list((ROOT / 'studio' / 'js').glob('*.js')))
    bad = []
    for f in files:
        r = subprocess.run([node, '--check', str(f)], capture_output=True, text=True)
        if r.returncode: bad.append(f'{f.relative_to(ROOT)}: {r.stderr.strip().splitlines()[-1] if r.stderr.strip() else "error"}')
    # v47: a function declared in two of the page's scripts: the later one silently replaces the other everywhere
    # (walk-view.js's placeKind(act, prop) for shop hours hid game-data.js's placeKind(id))
    where = {}
    for src in re.findall(r'<script (?:type="module" )?src="(js/[^"]+)"', (GAME / 'index.html').read_text(encoding='utf-8')):
        f = GAME / src
        if not f.exists(): continue
        for m in re.finditer(r'^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(', f.read_text(encoding='utf-8'), re.M):
            where.setdefault(m.group(1), set()).add(src)
    twice = {k: sorted(v) for k, v in where.items() if len(v) > 1}
    bad += [f'{k}() is declared in {" and ".join(v)}' for k, v in twice.items()]
    if bad: raise Exception('; '.join(bad[:5]))
    return f'{len(files)} scripts, no function declared in two of them'


@step('Data: game data, pictures and scenes', 20)
def check_data():
    D = gamedata(); SY = D.get('scenery', {}); missing = set(); warn = []
    art = GAME / 'art'
    def need(p):
        if p and not (art / p).exists(): missing.add(p)
    for t in SY.get('terrains', {}).values():
        need(t.get('tile')); [need(v) for v in t.get('vars', [])]
    for P in SY.get('props', {}).values():
        need(P.get('img')); [need(l.get('img')) for l in P.get('layers', []) if isinstance(l, dict)]
    need(SY.get('wallArt', 'scene/build/walls.png'))
    for k in ('detail', 'rooms'): need((SY.get('buildArt') or {}).get(k))
    import base64
    for k, s in D.get('scenes', {}).items():
        if len(s.get('tiles', [])) != s['h']: warn.append(f'{k}: {len(s.get("tiles", []))} rows for height {s["h"]}')
        if s.get('steps') and len(base64.b64decode(s['steps'])) != s['w'] * 2 * s['h'] * 2 * 2: warn.append(f'{k}: step grid is the wrong size')
        for p in s.get('props', []):
            if p['k'] not in SY.get('props', {}): warn.append(f'{k}: unknown prop {p["k"]}')
        # alpha 0.2: every square of the map names a ground kind (keys may now be accented letters, tools/groundkeys.py)
        bad = {ch for row in s.get('tiles', []) for ch in row} - set(SY.get('terrains', {}))
        if bad: warn.append(f'{k}: squares with no ground kind: {"".join(sorted(bad))[:12]}')
    for r in D['route']:
        if r.get('scene') and r['scene'] not in D.get('scenes', {}): warn.append(f'{r["name"]}: missing scene {r["scene"]}')
        if r.get('scene'): need(f'map/mini/{r["scene"]}.png')   # v47: the world map asks for every stop's miniature (tools/build-map-minis.py)
    if missing: warn.append('missing pictures: ' + ', '.join(sorted(missing)[:8]))
    # v46: every place, scene and road says what it is (tools/migrate-places.py)
    import importlib.util as ilu
    sp = ilu.spec_from_file_location('mplaces', ROOT / 'tools' / 'migrate-places.py'); MP = ilu.module_from_spec(sp); sp.loader.exec_module(MP)
    warn += MP.problems(D)
    if warn: raise Exception('; '.join(warn[:8]))
    kinds = {}
    for s in D.get('scenes', {}).values(): kinds[s.get('kind')] = kinds.get(s.get('kind'), 0) + 1
    return f'{len(D.get("scenes", {}))} scenes ({", ".join(f"{v} {k}s" for k, v in kinds.items())}), {len(SY.get("props", {}))} props, {len(D["links"])} named roads'


@step('alpha 0.4: no old place name left (the game data and what the game says)', 20)
def old_names():
    """the places were renamed in alpha 0.4 (tools/rename-places.py): no old name may be left where a player reads it,
    in the game data (the Studio's old copies of places aside) or in the game's own texts (comments aside)"""
    import importlib.util as ilu, re as _re
    sp = ilu.spec_from_file_location('rnp', ROOT / 'tools' / 'rename-places.py'); RN = ilu.module_from_spec(sp); sp.loader.exec_module(RN)
    rx = [_re.compile(r"\b" + (r"[Tt]he " if pid in RN.NEEDS_THE else "") + _re.escape(o) + r"\b") for pid, L in RN.OLD.items() for o in L]
    keep = [_re.compile(k) for k in RN.KEEP]
    def hits(t):
        for k in keep: t = k.sub('', t)
        return [m.group(0) for r in rx for m in r.finditer(t)]
    D = gamedata(); bad = []
    def walk(v, path):
        if isinstance(v, dict):
            for k, x in v.items():
                if k in ('id', 'img', 'tile', 'scene', 'k', 'src', 'path') or (path[:1] == ['scenes'] and len(path) == 1 and '@' in k): continue
                walk(x, path + [k])
        elif isinstance(v, list):
            for i, x in enumerate(v): walk(x, path + [i])
        elif isinstance(v, str):
            for h in hits(v): bad.append(f"{'/'.join(map(str, path))}: {h}")
    walk(D, [])
    for f in sorted((GAME / 'js').glob('*.js')):
        code = _re.sub(r'/\*.*?\*/', '', f.read_text(encoding='utf-8'), flags=_re.S)
        code = _re.sub(r'(?m)^\s*//.*$', '', code)
        for h in hits(code): bad.append(f'js/{f.name}: {h}')
    if bad: raise Exception(f'{len(bad)} old names: ' + '; '.join(bad[:8]))
    return f'{len(D["route"])} places by their new names; none of the {len(rx)} old names left in the data or the game\'s texts'


@step('alpha 0.4: Copperleaf Town and Route 1, the new start (from the data)', 20)
def copperleaf_data():
    """a new game starts in Copperleaf (rules.start.place); Route 1 · Hedgerow Lane joins it to Marigold Town, the exits
    facing; the lab and your room are in Copperleaf and nowhere else outdoors; Granny Juniper stands in her garden; no
    shop or clinic in the hamlet; Marigold Town's signpost names the lane; nothing solid stands on the opening's stage"""
    D = gamedata(); R = D['route']; ix = {r['id']: i for i, r in enumerate(R)}; bad = []
    start = (D['rules'].get('start') or {}).get('place')
    if start != 'copperleaf' or 'copperleaf' not in ix: raise Exception(f'a new game starts at {start!r}')
    if (R[ix.get('hedgerow', 0)] or {}).get('route') != 'Route 1': bad.append('Hedgerow Lane is not Route 1')
    S_ = D['scenes']; C = D['scenery']['props']
    for rid, a, b in (('road:sundown-hedgerow', 'sundown', 'hedgerow'), ('road:hedgerow-copperleaf', 'hedgerow', 'copperleaf')):
        L = next((L for L in D['links'] if len(L) > 3 and (L[3] or {}).get('id') == rid), None)
        if not L: bad.append(f'no road {rid}'); continue
        sa = next((e['side'] for e in S_[a].get('edgeExits') or [] if e['id'] == L[3].get('a')), None); sb = next((e['side'] for e in S_[b].get('edgeExits') or [] if e['id'] == L[3].get('b')), None)
        if (sa, sb) != ('N', 'S'): bad.append(f'{rid}: exits {sa} and {sb} don’t face each other north to south')
    outdoor = {k: v for k, v in S_.items() if '@' not in k and v.get('kind') in ('town', 'route')}
    for act in ('lab', 'home'):
        where = [k for k, v in outdoor.items() for p in v.get('props', []) if p.get('act') == act]
        if where != ['copperleaf']: bad.append(f'act {act} stands in {where}')
    cl = S_['copperleaf']
    if {'shop', 'clinic'} & {p.get('act') for p in cl['props']}: bad.append('Copperleaf has a shop or a clinic')
    ppl = cl.get('people') or []
    if not any(p.get('who') == 'juniper' and p.get('first') and p.get('lines') for p in ppl) or 'juniper' not in D['people']: bad.append('Granny Juniper isn’t in Copperleaf')
    LO = D.get('lore') or {}
    for k in ('copperleaf', 'hedgerow'):
        if k not in (LO.get('places') or {}): bad.append(f'no lore for {k}')
    if 'juniper' not in (LO.get('people') or {}): bad.append('Granny Juniper has no page in the Lore')
    sd = S_['sundown']; sign = [p.get('say') for p in sd['props'] if p.get('act') == 'sign']
    if 'Route 1 · Hedgerow Lane this way.' not in sign: bad.append(f'Marigold Town’s signposts: {sign}')
    # the opening's stage: east and south of the lab's door, as cutscene.js CS_SPOT has it (door [7.4, 15.4])
    lab = next(p for p in cl['props'] if p.get('act') == 'lab'); M = C[lab['k']]; dx = M['door']['x'] / 34 * lab.get('s', 1) * (-1 if lab.get('f') else 1)
    d = (lab['x'] + dx, lab['z'])
    for p in cl['props']:
        Q = C.get(p['k']) or {}
        if Q.get('flat') or p is lab: continue
        solid = Q.get('box') or (Q.get('solid') or 0) > .25
        if solid and d[0] + .8 < p['x'] < d[0] + 9.6 and d[1] - 4.8 < p['z'] < d[1] - 1.4: bad.append(f'{p["k"]} at {p["x"]},{p["z"]} stands on the opening’s stage')
    if bad: raise Exception('; '.join(bad[:6]))
    return f'a new game starts in Copperleaf (node {ix["copperleaf"]}); Route 1 joins it to Marigold Town; the lab and your room are there, Granny Juniper in her garden, no shop or clinic; the opening’s stage is clear'


@step('alpha 0.4: no building stands in water; every jetty is a flat deck over water (from the data)', 20)
def check_water():
    """a building's footprint (turned as it stands) holds no water; boards never run out over water as ground (a jetty is
    a flat deck on posts with the water under it: scene.bridges, pier: 1, tools/fix-piers.py)"""
    import importlib.util as ilu, math as _m
    sp = ilu.spec_from_file_location('fms', ROOT / 'tools' / 'fix-marigold-stream.py'); FM = ilu.module_from_spec(sp); sp.loader.exec_module(FM)
    sp2 = ilu.spec_from_file_location('fpi', ROOT / 'tools' / 'fix-piers.py'); FP = ilu.module_from_spec(sp2); sp2.loader.exec_module(FP)
    D = gamedata(); bad = [f'{a}: {b} at {c},{d} has water in it' for a, b, c, d, e in FM.buildings_in_water(D)]
    piers = 0
    for sid, sc in D['scenes'].items():
        if '@' in sid or not sc.get('tiles') or sc.get('kind') == 'room': continue
        for cells, a, b, w in FP.piers_of(sc): bad.append(f'{sid}: boards run out over the water at {a} (python3 tools/fix-piers.py makes them a jetty)')
        for B_ in sc.get('bridges') or []:
            if B_.get('pier'):
                piers += 1; T = sc['tiles']; H = len(T); x, z = B_['b']
                if T[H - 1 - int(_m.floor(z - .3 if B_['b'][1] > B_['a'][1] else z + .3))][int(_m.floor(x))] not in 'wd': bad.append(f'{sid}: the jetty to {B_["b"]} doesn’t end over water')
    if bad: raise Exception('; '.join(bad[:6]))
    return f'no building has water in it; {piers} jetties, each a flat deck ending over water'


@step('alpha 0.4: an airship mast in every town, the terminal in Verdigris City (from the data)', 20)
def check_masts():
    """every town has something to fly from (a prop with act 'fly': a mast, or a sky lift under the ground); the
    terminal's ticket window sells tickets; the mast's airship is a low-poly model with two propellers that turn"""
    D = gamedata(); bad = []; n = 0
    for r in D['route']:
        if r.get('kind') != 'town': continue
        sc = D['scenes'][r['scene']]; f = [p for p in sc['props'] if p.get('act') == ('lift' if r.get('noFly') else 'fly')]
        if not f: bad.append(f'{r["id"]}: nowhere to fly from' if not r.get('noFly') else f'{r["id"]}: no lift')
        n += len(f)
    if 'station' in [p['k'] for sc in D['scenes'].values() for p in sc.get('props', [])]: bad.append('an old train station is still standing')
    # alpha 0.4.1: the mast and the airship are two props; every mast has its airship moored at it
    CP = D['scenery']['props']; M = CP.get('airship_mast') or {}; AS = CP.get('airship') or {}; rp = GAME / 'art' / (M.get('vox') or 'missing'); ra = GAME / 'art' / (AS.get('vox') or 'missing')
    for sc in D['scenes'].values():
        P = sc.get('props') or []
        for m in [q for q in P if q.get('k') in ('airship_mast', 'airship_station')]:
            if not any(q.get('k') == 'airship' and abs(q['x'] - m['x']) < .05 and abs(q['z'] - m['z']) < .05 for q in P): bad.append(f'{sc.get("name")}: a mast without its airship')
    if not rp.exists() or not ra.exists(): bad.append('the mast or the airship has no 3D model')
    else:
        rec = json.loads(ra.read_text()); spins = rec.get('spins') or []; recm = json.loads(rp.read_text())
        if rec.get('kind') != 'mesh' or recm.get('kind') != 'mesh': bad.append('the mast and the airship aren’t low-poly models (tools/build-airship.py)')
        if len(spins) != 2: bad.append(f'the airship has {len(spins)} turning propellers, not 2')
        if not AS.get('bob'): bad.append('the airship doesn’t bob')
        if M.get('box', [9])[0] > 2.5: bad.append('the mast’s footprint reaches past the tower')
        import base64
        for P in (rec.get('parts') or []) + (recm.get('parts') or []) + spins:
            if len(base64.b64decode(P['data'])) != P['n'] * 24 + P['ni'] * 2: bad.append(f'{P.get("name")}: its vertex data is the wrong size')
        A = (D['scenery'].get('buildArt') or {}).get('detail')
        if not A or not (GAME / 'art' / A).exists(): bad.append('the building sheet the model is painted from is missing')
    if bad: raise Exception('; '.join(bad[:6]))
    return f'{n} masts and sky lifts in {sum(1 for r in D["route"] if r.get("kind") == "town")} towns; airship stations, no train station; the mast and its moored airship are two low-poly props ({sum(P["ni"] for P in recm["parts"]) // 3} and {sum(P["ni"] for P in rec["parts"]) // 3} triangles), the airship bobbing, two turning propellers'


@step('alpha 0.4: a postcard for every town; a solarpunk touch in every town; Verdigris Park (from the data)', 20)
def check_postcards():
    """every town has its postcard picture (tools/build-postcards.py); every town but the new start has something of
    the solarpunk kit or a green or solar roof (tools/build-solarpunk.py); Verdigris City has its park"""
    D = gamedata(); bad = []; n = 0; C = D['scenery']['props']; kit = {'solar_tree', 'vertical_garden', 'solar_canopy', 'heat_dome', 'floating_solar', 'light_pipe', 'wind_sail_flower', 'banner_bunting'}
    for r in D['route']:
        if r.get('kind') != 'town': continue
        sid = r['scene']; f = GAME / 'art' / 'postcards' / f'{sid}.webp'
        if not f.exists() or f.stat().st_size < 4000: bad.append(f'{r["id"]}: no postcard')
        else: n += 1
        sc = D['scenes'][sid]
        if sid != 'copperleaf' and not any(p['k'] in kit or p.get('roof') for p in sc['props']): bad.append(f'{r["id"]}: no solarpunk touch')
    city = D['scenes'].get('city') or {}
    if not city.get('a04park') or not any(p.get('label') == 'Verdigris Park' for p in city.get('props', [])): bad.append('Verdigris City has no park')
    for k in kit:
        if k not in C: bad.append(f'{k} missing from the catalogue')
    if bad: raise Exception('; '.join(bad[:6]))
    roofs = sum(1 for sc in D['scenes'].values() for p in sc.get('props', []) if p.get('roof'))
    return f'{n} postcards; every town has its solarpunk touch ({roofs} moss and solar roofs); Verdigris Park is there'


@step('Windows: no prop stands in front of one (from the data)', 30)
def check_windows():
    """alpha 0.1: tools/clear-windows.py looks at every window on every building front and room wall as the walk camera
    sees it; no prop may hide more than a fifth of one"""
    import importlib.util
    spec = importlib.util.spec_from_file_location('clearwin', ROOT / 'tools' / 'clear-windows.py'); CW = importlib.util.module_from_spec(spec); spec.loader.exec_module(CW)
    head, D = CW.load(); C = D['scenery']['props']; P = CW.ppu(D); bad = []; nw = 0
    for sid, sc in D['scenes'].items():
        if sid.startswith('test') or not sc.get('props'): continue
        wins = CW.windows_of(sc, C, P); nw += len(wins)
        for (W, n, c) in CW.occluders(sc, C, P, wins): bad.append(f"{sid}: {sc['props'][n]['k']} at {sc['props'][n]['x']:.1f},{sc['props'][n]['z']:.1f} hides {c:.0%} of a {W['k']} window")
    if bad: raise Exception(f'{len(bad)} props in front of windows (python3 tools/clear-windows.py --fix moves them): ' + '; '.join(bad[:5]))
    return f'{nw} windows in {len(D["scenes"])} scenes, nothing stands in front of one'


@step('Rooms: no wall taller than the room', 10)
def check_rooms():
    """v47: the back corners of every room stood twice the wall's height (the walls overlapped); no step cell of a
    room may be taller than the height most of its wall cells have"""
    import base64, struct
    D = gamedata(); bad = []; n = 0
    for sid, sc in D['scenes'].items():
        if sc.get('kind') != 'room' or not sc.get('steps'): continue
        raw = base64.b64decode(sc['steps']); v = struct.unpack('<%dh' % (len(raw) // 2), raw); nz = [x for x in v if x > 0]
        if not nz: continue
        n += 1; wall = max(set(nz), key=nz.count); over = sum(1 for x in v if x > wall)
        if over: bad.append(f'{sid}: {over} cells above the wall ({max(v) / 20:.1f} m, the wall is {wall / 20:.1f} m)')
    if bad: raise Exception('; '.join(bad[:6]))
    return f'{n} rooms, every wall at its room\'s height'


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


@step('Unused: art and props nothing names', 30)
def report_unused():
    """v47: lists pictures and sounds no code, page or data names, and catalogue props no place uses and no code
    names, so old things don't build up again. A report, not a failure. A folder the code builds names in (battle/
    plus a stage, a billionaire plus _gold) counts as named as a whole, so the list holds only what nothing reaches"""
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
    placed = {p['k'] for sc in D['scenes'].values() for p in sc.get('props', [])}
    code = '\n'.join(f.read_text(encoding='utf-8', errors='ignore') for f in list((GAME / 'js').rglob('*.js')) + list((ROOT / 'studio' / 'js').glob('*.js')))
    ctok = set(re.findall(r'[\'"`]([A-Za-z0-9_]+)[\'"`]', code)) | set(re.findall(r'[\'"`]([A-Za-z0-9_]+)[|,]', code))
    props = [k for k in SY.get('props', {}) if k not in placed and k not in ctok]
    spare = len([k for k in SY.get('props', {}) if k not in placed])
    (OUT / 'unused.txt').write_text('Pictures and sounds nothing names:\n' + '\n'.join(sorted(unused)) + '\n\nCatalogue props no place uses and no code names:\n' + '\n'.join(sorted(props)) + '\n')
    if unused or props: notes.append(f'unused: {len(unused)} pictures/sounds and {len(props)} props nothing names (validation/quick/unused.txt)')
    return f'{len(unused)} pictures/sounds, {len(props)} props nothing names; {spare} props kept for the Studio palette, placed nowhere yet'


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
    pg.goto(base + '/index.html'); pg.wait_for_selector('.ttl,.title', timeout=60000); pg.evaluate(LOW_RENDER)
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
        ph = pg.evaluate('B?B.phase:"none"')
        if ph in want: return ph
        if ph == 'playing': pg.evaluate('tapMsg()')
        time.sleep(.15)
    return pg.evaluate('B?B.phase:"none"')


def play(pg):
    pg.evaluate("if(typeof titleEnd==='function')titleEnd();U.pg='girl';startGame(SP.scoop0?'scoop':RULES.start.starters[0]);S.story={met_chad:1,met_chad2:1,copperleafNote:1};Object.values(TRAINERS).forEach(T=>{if(T.intro)S.story['met_'+T.id]=1});U.modal=null;U.mq=[];renderOv();S.team.push(makeMon('ek1',18));addSteps(2400,true);U.toastQ=[];U.toastOn=false;U.modal=null;U.mq=[];renderOv();render();0")
    # alpha 0.2: the legendaries count as met today, so passing through their places doesn't leave one waiting in a later
    # step (the v39 step brings the volcano's back on purpose)
    pg.evaluate("for(const l of (RULES.legends||[]))S.story['legend_'+l.sp]=today();0")
    # alpha 0.4.1: the game walks by default now (RULES.travel 'walk'); the older steps test trips made with real steps, so
    # they run in 'steps' mode. The walking step (a041_walk) switches back
    pg.evaluate("RULES.travel='steps';0")


def go_scene(pg, node, sec=40):
    # alpha 0.4: a jump, not a walk: a neighbour whose middle is near this view's would otherwise wait for its view to be
    # prepared a few milliseconds a frame (seamless-world.js seamlessGate), which at a frame every few seconds here takes minutes
    pg.evaluate(f"U.inside=null;U.tab='walk';S.route={{node:{node},prog:0,plan:[],hold:false}};S.visited[{node}]=1;U.roam=null;if(typeof walkView!=='undefined'&&walkView.pl)walkView.pl.fresh=true;render();0")
    if not until(pg, f'!!(walkView.ready&&(walkView.id===ROUTE[{node}].scene||(walkView.sc&&walkView.sc.baseId===ROUTE[{node}].scene)))', sec):   # v43: the hub may sit near an exit, so the view may be the scene with its road
        raise Exception(f'{pg.evaluate(f"ROUTE[{node}].scene")} didn’t open in {sec}s')
    f0 = pg.evaluate("typeof walkRenderer!=='undefined'&&walkRenderer.on?walkRenderer.frames:-1")
    if f0 >= 0 and not until(pg, f'walkRenderer.frames>={f0 + 2}', 30): raise Exception(f'{pg.evaluate("walkView.id")} isn’t drawing (black screen)')


@step('Phone: opening, first battle, screens and a battle', 260)
def phone_flow(b, base, R):
    errs = []; ctx, pg = open_game(b, base, 390, 844, True, errs)
    try:
        pg.click('[data-a=intro]')
        if not until(pg, 'CS.on', 15): raise Exception('the opening cutscene didn’t start')
        skip = "CS.say&&CS.say.tap();CS.skip||csSkip()"
        if not until(pg, 'DR.on', 60, skip): raise Exception('never reached the dressing room')
        pg.click('[data-a=dr-preset][data-i="2"]'); pg.fill('#drName', 'Checker'); pg.click('[data-a=dr-save]')
        if not until(pg, 'CS.choosing', 60, skip): raise Exception('never reached the starter picker')
        shot(pg, 'phone-opening-pick')
        pg.click('[data-a=cs-next]'); time.sleep(.5); pg.click('[data-a=cs-choose]'); pg.click('[data-a=cs-yes]')
        if not until(pg, 'S.started', 40, skip): raise Exception('the game didn’t start after picking a starter')
        R['opening'] = pg.evaluate('[S.starter,S.avatar.name,S.team.length,ROUTE[S.route.node].id]')
        if R['opening'][3] != 'copperleaf': raise Exception(f'the game started at {R["opening"][3]}, not in Copperleaf')
        # v47: Blake battles you on the spot, with Hazel's tips; win or lose, he talks, Hazel heals you, the welcome sheet
        if not until(pg, "!!B&&B.phase==='choose'", 120): raise Exception('Blake’s first battle never reached the move menu')
        R['rivalBattle'] = pg.evaluate("({tutorial:!!(B.T&&B.T.tutorial),foe:B.foeName,moves:B.sides[1].team[0].moves,tip:!!document.querySelector('#btip.on')})")
        shot(pg, 'phone-rival-battle')
        if not R['rivalBattle']['tutorial'] or not R['rivalBattle']['tip']: raise Exception(f'Blake’s first battle isn’t the tutorial one: {R["rivalBattle"]}')
        pg.evaluate("B.over='win';stopTimers();endBattle();0")
        if not until(pg, '!!TALK.cur', 40): raise Exception('nobody spoke after Blake’s battle')
        if not until(pg, '!TALK.on&&!!U.modal', 60, 'TALK.cur&&TALK.cur.tap()'): raise Exception('the talk after Blake’s battle never ended')
        R['afterRival'] = pg.evaluate("({story:S.story.rival0,hp:S.team.map(m=>m.hp===maxHp(m)),welcome:U.modal&&U.modal.title})")
        pg.evaluate("closeModal();0")
        play(pg)
        for tab in ['walk', 'map', 'team', 'ledger', 'profile']:
            pg.evaluate(f"U.tab='{tab}';render();scrollTo(0,0);0"); time.sleep(2.5 if tab in ('walk', 'map') else .6); shot(pg, f'phone-{tab}')
        pg.evaluate("U.tab='walk';S.route.node=0;render();openShop('sundown');0"); time.sleep(.6); shot(pg, 'phone-shop')
        pg.evaluate("closeModal();wipe=f=>f();S.preferences.battleStage='classic';B=null;const q={id:'tq',sp:'knight1',lvl:12,gold:false,no:1};S.queue=[q];S.team.forEach(m=>{m.hp=maxHp(m)});startWild(q);0")
        if wait_phase(pg) != 'choose': raise Exception('a wild battle never reached the move menu')
        shot(pg, 'phone-battle')
        pg.evaluate("stopTimers();B=null;battleStageStop();render();0")
        # phase 01: the owner tests on a phone and sends the exported debug log, so the export must keep working. Here the
        # game saves it as a download (nothing is sent anywhere); the file must be a JSON log
        with pg.expect_download(timeout=60000) as dl:
            pg.evaluate("exportDebugLog();0")
        d = dl.value; dlog = json.loads(Path(d.path()).read_text(encoding='utf-8'))
        if not isinstance(dlog, dict) or not dlog: raise Exception('the exported debug log is empty')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return f'the fall, Hazel, dressing room, starter, Blake’s first battle and the talk after, five screens, shop, battle, debug log ({len(json.dumps(dlog)) // 1024} KB)'
    finally:
        R['phoneErrors'] = errs[:10]; ctx.close()


def all_maps(pg, sec=180):
    # phase 04b: the game fetches each map's ground and props when it is needed and the rest in the background; the
    # steps below read every map at once, so wait until all of them are whole
    if not until(pg, "typeof loadAllMaps!=='function'||(loadAllMaps(),Object.keys(GD.scenes).every(id=>!isLiteMap(id)))", sec):
        raise Exception('the maps didn’t all load in %ds: %s' % (sec, pg.evaluate("Object.keys(GD.scenes).filter(isLiteMap).join(', ')")))


def desktop_steps(b, base, R):
    errs = []; ctx, pg = open_game(b, base, 1100, 700, False, errs)
    play(pg); pg.evaluate("U.tab='team';render();0"); time.sleep(1); all_maps(pg)
    D = gamedata(); ids = [r.get('scene') for r in D['route']]
    nodes = [i for i, s in enumerate(ids) if s and (not ONLY or s in ONLY)]

    @step('Shaders: every program compiles, no clashing inputs', 30)
    def shaders():
        r = pg.evaluate("""(()=>{if(typeof EGL==='undefined'||!EGL.gl)return {skip:'no WebGL in this browser'};const sets={WALK_SHADERS:typeof WALK_SHADERS!=='undefined'?WALK_SHADERS:null,BLD_SH:typeof BLD_SH!=='undefined'?BLD_SH:null,EGL_POST_SH:typeof EGL_POST_SH!=='undefined'?EGL_POST_SH:null,WORLD_MAP_GL_SHADERS:typeof WORLD_MAP_GL_SHADERS!=='undefined'?WORLD_MAP_GL_SHADERS:null,P3D_SH:typeof P3D_SH!=='undefined'?P3D_SH:null};
         const bad=[];let n=0;for(const [name,S] of Object.entries(sets)){if(!S)continue;for(const [k,v] of Object.entries(S)){n++;const c=eglAttrClashes(v[0]);if(c.length)bad.push(k+' clash: '+c.join(','));try{if(!EGL.P[k])EGL.P[k]=eglCompile(v,k)}catch(e){bad.push(String(e.message||e).slice(0,160))}}}return {n,bad}})()""")
        if r.get('skip'): return r['skip']
        if r['bad']: raise Exception('; '.join(r['bad'][:4]))
        return f"{r['n']} programs"
    shaders()

    @step('Paths: exits, doors, bridges and stairs in every scene (from the data)', 40)
    def paths():
        r = pg.evaluate("""((ids)=>{const out={},keep=[walkView.sc,walkView.nav,walkView.gkey];
         for(const id of ids){const sc=mapById(id);if(!sc)continue;walkView.sc=sc;walkView.nav=null;walkView.gkey='quick-'+id;const C0=walkData().sc,hub=mapHub(sc),bad=[],far=(q,p)=>{const e=q&&q[q.length-1];return !q||Math.hypot(e[0]-p[0],e[1]-p[1])>1.6};
          for(const e of sc.exits||[])if(far(findPath(hub[0],hub[1],e[0],e[1]),e))bad.push('exit '+e.map(v=>v.toFixed(1)));
          for(const p of sc.props||[])if(p.act&&!(p.act==='climb'&&typeof climbEnds==='function'&&[climbEnds(p).bot,climbEnds(p).top].some(g=>{const q=findPath(hub[0],hub[1],g[0],g[1]),e=q&&q[q.length-1];return e&&Math.hypot(e[0]-g[0],e[1]-g[1])<=1.6}))){const g=actionSpot(p,C0.props[p.k],C0.ppu||34);if(g&&far(findPath(hub[0],hub[1],g[0],g[1]),g))bad.push(p.k+' @'+p.x+','+p.z)}
          for(const b of mapBridges(sc)||[]){const A=[b.a[0]-b.ux*.4,b.a[1]-b.uz*.4],B=b.pier?[b.b[0]-b.ux*.4,b.b[1]-b.uz*.4]:[b.b[0]+b.ux*.4,b.b[1]+b.uz*.4];if(far(findPath(A[0],A[1],B[0],B[1]),B))bad.push((b.pier?'jetty ':'bridge ')+b.a)}
          const G=navGrid(),hc=navCellAt(hub[0],hub[1]);if(hc<0||G.blk[hc])bad.push('hub is blocked');out[id]=bad}
         [walkView.sc,walkView.nav,walkView.gkey]=keep;return out})(%s)""" % json.dumps([ids[n] for n in nodes]))
        bad = {k: v for k, v in r.items() if v}
        R['paths'] = r
        if bad: raise Exception('; '.join(f'{k}: {", ".join(v[:4])}' for k, v in bad.items()))
        return f'{len(r)} scenes, all reachable'
    paths()

    @step('Test scenes: walking rules (from the data)', 30)
    def test_checks():
        r = pg.evaluate("(()=>{const o={};for(const id of testScenes())o[id]=stSceneChecks(id);return o})()")
        R['testChecks'] = r; bad = [f'{k}: {c["what"]}' for k, v in r.items() for c in v if not c['ok']]
        if bad: raise Exception('; '.join(bad[:6]))
        return f'{len(r)} test scenes, {sum(len(v) for v in r.values())} checks'
    test_checks()

    if '--tests' in ARGS:
        @step('Test scenes: each one drawn, with its pictures', 600)
        def test_draw():
            tests = pg.evaluate('testScenes()'); n = 0
            for id in tests:
                pg.evaluate(f"U.tab='walk';U.bench={{id:'{id}',test:1}};render();0")
                if not until(pg, f"!!(walkView.ready&&walkView.id==='{id}')", 40): raise Exception(f'{id} didn’t open')
                f0 = pg.evaluate("typeof walkRenderer!=='undefined'&&walkRenderer.on?walkRenderer.frames:-1")
                if f0 >= 0 and not until(pg, f'walkRenderer.frames>={f0 + 2}', 30): raise Exception(f'{id} isn’t drawing')
                for sh in pg.evaluate(f"GD.scenes['{id}'].shots||[]"):
                    pg.evaluate(f"walkView.pl.x={sh['x']};walkView.pl.z={sh['z']};walkView.pl.route=null;if(typeof walkRenderer!=='undefined')walkRenderer.yawT={sh.get('yaw', 0)};0"); time.sleep(2.2)
                    shot(pg, f"{id}-{sh['label']}"); n += 1
            pg.evaluate("U.bench=null;if(typeof walkRenderer!=='undefined')walkRenderer.yawT=0;render();0")
            if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
            return f'{len(tests)} test scenes, {n} pictures'
        test_draw()

    @step('Scenes: each one opens and draws', 30 * max(1, len(nodes)))
    def scenes():
        drawn = []
        for n in nodes:
            go_scene(pg, n, 75); time.sleep(.4); sid = pg.evaluate('walkView.id'); shot(pg, f'scene-{sid}')   # alpha 0.2: a place's view holds its neighbours' edges too, bigger to paint in software
            info = pg.evaluate("[typeof walkRenderer!=='undefined'&&walkRenderer.on,typeof STR!=='undefined'&&!!STR.mesh,typeof strHas==='function'&&strHas(walkView.sc),typeof BLD!=='undefined'?(BLD.fail||''):'',typeof BLD!=='undefined'?BLD.drawn||0:0]")
            if info[0] and info[2] and not info[1]: raise Exception(f'{sid}: bridges and railings not drawn')
            if info[3]: raise Exception(f'{sid}: 3D buildings off: {info[3][:100]}')
            drawn.append(sid)
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return ', '.join(drawn)
    scenes()

    if '--closeups' in ARGS:
        @step('Close-ups of cliffs, stairs, bridges and water', 180)
        def closeups():
            spots = [('sundown', 23.2, 17.6, 'sundown-stairs'), ('city', 32.5, 9.6, 'city-canal'), ('city', 32.5, 30.5, 'city-stairs'), ('ridge', 22, 25.6, 'ridge-bridge'),
                     ('pond', 27, 21, 'pond-falls'), ('mall', 31, 18.5, 'mall-escalators'), ('grotto', 11.2, 14.2, 'grotto-cascade'), ('canyon', 19.3, 7.4, 'canyon-arch')]
            for sid, x, z, label in spots:
                if sid not in ids or (ONLY and sid not in ONLY): continue
                go_scene(pg, ids.index(sid)); pg.evaluate(f"walkView.pl.x={x};walkView.pl.z={z};walkView.pl.route=null;0"); time.sleep(2.5); shot(pg, f'closeup-{label}')
        closeups()

    @step('Walking: tap to walk, then a trip along two roads', 150)   # alpha 0.2: the walk between places is the places' own ground now, and longer
    def walking():
        go_scene(pg, 0)
        tgt = pg.evaluate("(()=>{const h=mapHub(walkView.sc);return walkablePointNear(h[0]-3.5,h[1]-1)})()")   # v46: a few steps from where you stand (the places are bigger now)   # v46: the hub view holds the scene at its baseOff; v40: a short walk; software drawing throttles game time, so a long one can outlast the wait
        # the camera eases in after a scene opens, and a story message can be up: let both settle, then tap (twice if the first missed)
        time.sleep(2.5); pg.evaluate("U.toastQ=[];U.modal=null;U.mq=[];renderOv();0")
        pg.evaluate("S.queue=[];if(B){B.over='ran';B.phase='end';endBattle()}U.modal=null;U.mq=[];renderOv();0"); time.sleep(.5)   # v40: no hidden encounters near the tap (a tap on one starts a battle)
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
            whys.append(pg.evaluate("U.modal?('a message: '+(U.modal.title||'')):(walkView.opt.active&&!walkView.opt.active())?'the scene wasn’t taking taps':TALK.on?'a chat':'no path from the tap'"))
            pg.evaluate("U.toastQ=[];U.modal=null;U.mq=[];if(TALK.on&&typeof talkHide==='function')talkHide();renderOv();0"); time.sleep(1.2)
        if whys: notes.append(f'Walking: {len(whys)} tap(s) didn’t start a walk ({", ".join(whys)})')
        if not pg.evaluate('!!walkView.pl.route'): raise Exception(f'no walk started after 5 taps at {tgt} ({", ".join(whys)})')
        until(pg, '!walkView.pl.route', 45)
        roam = pg.evaluate("[+walkView.pl.x.toFixed(1),+walkView.pl.z.toFixed(1)]")
        pg.evaluate("if(typeof TALK!=='undefined'&&TALK.on&&typeof talkHide==='function')talkHide();0")
        if abs(roam[0] - tgt[0]) > .8 or abs(roam[1] - tgt[1]) > .8: raise Exception(f'tapped {tgt}, ended at {roam} ({pg.evaluate("JSON.stringify({mode:walkView.opt.state&&walkView.opt.state().mode,route:S.route,battle:!!B,modal:U.modal&&U.modal.title,talk:TALK.on,cs:typeof CS!==\"undefined\"&&CS.on,climb:!!walkView.pl.climb,keys:Object.keys(walkView.keys||{})})")})')
        pg.evaluate("(()=>{const n=tripTo(9).steps;setTrip(9);addSteps(n,true)})();U.toastQ=[];U.modal=null;U.mq=[];renderOv();render();0")   # alpha 0.2: the steps a trip costs follow the walk
        if not until(pg, "S.route.node===9&&!S.route.plan.length&&(walkView.id==='pond'||(walkView.sc&&walkView.sc.baseId==='pond'))", 30): raise Exception('the trip to Willowmere didn’t arrive (' + pg.evaluate("JSON.stringify([S.route,walkView.id])") + ')')   # v43: you arrive at the exit, with the road still in view
        shot(pg, 'arrived')
        return f'walked to {roam}, arrived at Willowmere'
    walking()

    @step('Crowd: forty people in town draw about as fast as a few', 90)
    def crowd():
        go_scene(pg, 0); time.sleep(3)
        rate = "(()=>{const f0=walkRenderer.frames,t0=performance.now();return new Promise(r=>setTimeout(()=>r((walkRenderer.frames-f0)/(performance.now()-t0)*1000),5000))})()"
        a = pg.evaluate(rate); n0 = pg.evaluate("walkView.sc.folk"); pg.evaluate("walkView.sc.folk=40;0"); time.sleep(6)
        b2 = pg.evaluate(rate); size = pg.evaluate("typeof TR_CACHE!=='undefined'?TR_CACHE.size:0"); pg.evaluate(f"walkView.sc.folk={n0 or 0};0")
        if b2 < a * .45: raise Exception(f'{a:.1f} frames a second with {n0} people, {b2:.1f} with 40')
        return f'{a:.1f} → {b2:.1f} frames a second (software drawing), {size} pictures of people kept'
    crowd()

    @step('Time, weather and rooms: night, a storm, snow, autumn, a dark cave, walking into the shop', 240)
    def atmosphere():
        if not pg.evaluate("typeof environment!=='undefined'"): return 'no time and weather in this build'
        go_scene(pg, 0); out = []
        def lum():
            from PIL import Image, ImageStat
            im = Image.open(io.BytesIO(pg.screenshot())).convert('L'); w, h = im.size
            return ImageStat.Stat(im.crop((0, int(h * .3), w, int(h * .75)))).mean[0]     # the scene, under the cards
        bright = {}
        for name, f in (('day', "{time:13,weather:'clear',season:'summer'}"), ('night', "{time:23.5,weather:'clear',season:'summer'}"), ('storm', "{time:15,weather:'storm',season:'summer'}"),
                        ('snow', "{time:11,weather:'snow',season:'winter'}"), ('autumn', "{time:12,weather:'clear',season:'autumn'}")):
            pg.evaluate(f"environment.force={f};0"); f0 = pg.evaluate("walkRenderer.frames"); time.sleep(2.5)
            if not until(pg, f"walkRenderer.frames>{f0 + 1}", 20): raise Exception(f'{name}: the scene stopped drawing')
            bright[name] = round(lum()); shot(pg, 'env-' + name)
        if bright['night'] > bright['day'] * .8: raise Exception(f'night isn’t darker than day (brightness {bright["night"]} vs {bright["day"]})')
        pg.evaluate("environment.force={time:23.5,weather:'clear'};0"); time.sleep(1.5); lamps = pg.evaluate("environment.lampK")
        odds = pg.evaluate("(()=>{const ps=Object.keys(SP).find(k=>SP[k].types.includes('Psychic'));if(!ps)return [10];return environmentOdds([[ps,10]]).map(x=>+x[1].toFixed(2))})()")
        out.append('brightness ' + ', '.join(f'{k} {v}' for k, v in bright.items()))
        # a dark cave: away from the lantern it's dim
        node = pg.evaluate("ROUTE.findIndex(r=>r.scene==='grotto')")
        if node >= 0:
            pg.evaluate("environment.force=null;0"); go_scene(pg, node); time.sleep(2); shot(pg, 'env-dark-cave'); out.append('cave drawn')
        # walk into the shop and out again
        pg.evaluate("environment.force={time:13,weather:'clear',season:'summer'};0"); go_scene(pg, 0); time.sleep(1)
        p0 = pg.evaluate("[walkView.pl.x,walkView.pl.z]")
        pg.evaluate("(()=>{const p=walkView.sc.props.find(p=>p.act==='shop'&&p.k==='shop'),C=walkData().sc,g=actionSpot(p,C.props[p.k],C.ppu||34);walkView.pl.route=null;walkView.pl.x=g[0];walkView.pl.z=g[1];walkPick({k:'act',p,act:'shop'})})();0")   # v46: as a tap does: at the door first
        if not until(pg, "walkView.ready&&(walkView.id==='int_shop'||(walkView.sc&&walkView.sc.roomOf==='int_shop'))", 60): raise Exception('walking into the shop didn’t open its room')
        time.sleep(2); shot(pg, 'room-shop')
        pg.evaluate("walkPick({k:'npc',n:{id:'_keeper:int_shop'}});0"); time.sleep(.8)
        opened = pg.evaluate("!!(U.modal&&U.modal.shop)"); pg.evaluate("U.modal=null;U.mq=[];renderOv();0")
        if not opened: raise Exception('tapping the shopkeeper didn’t open the shop')
        door = pg.evaluate("U.inside&&U.inside.door?[U.inside.door[0],U.inside.door[1]-.6]:null")      # v46: a room laid into the place: you come out at its door
        pg.evaluate("leaveRoom();0")
        if not until(pg, "walkView.ready&&!walkView.sc.roomRect&&(walkView.id===ROUTE[0].scene||(walkView.sc&&walkView.sc.baseId===ROUTE[0].scene))", 30): raise Exception('going outside didn’t bring you back to town (' + pg.evaluate("walkView.id") + ')')
        f0 = pg.evaluate("walkRenderer.frames"); until(pg, f"walkRenderer.frames>{f0 + 2}", 20)          # you're placed on the first frame
        p1 = pg.evaluate("[walkView.pl.x,walkView.pl.z]")
        at = door or p0
        if abs(p1[0] - at[0]) > 1 or abs(p1[1] - at[1]) > 1: raise Exception(f'back outside at {p1}, not at the door ({at})')
        pg.evaluate("environment.force=null;0")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out) + f'; lamps {lamps:.2f} at night; Psychic odds at night ×{odds[0] / 10:.1f}; shop room opened, shopkeeper sold, back at the door'
    atmosphere()

    @step('Animals, footprints and world sounds: frogs leap in, prints in the snow, the sound beds start', 150)
    def animals():
        if not pg.evaluate("typeof LIFE_KIND!=='undefined'&&!!LIFE_KIND.frog"): return 'no new animals in this build'
        pg.evaluate("environment.force={time:13,weather:'clear',season:'summer'};0")
        node = pg.evaluate("ROUTE.findIndex(r=>r.scene==='pond')"); go_scene(pg, node); time.sleep(3)
        kinds = pg.evaluate("[...new Set(LIFE.list.map(c=>c.k))]")
        for k in ('frog', 'rabbit'):
            if k not in kinds: raise Exception(f'no {k} at Willowmere (animals there: {", ".join(kinds)})')
        pg.evaluate("(()=>{const f=LIFE.list.find(c=>c.k==='frog'&&!(c.hide>0));walkView.pl.route=null;const p=walkablePointNear(f.x+.7,f.z-.4);walkView.pl.x=p[0];walkView.pl.z=p[1]})();0"); time.sleep(4)
        leapt = pg.evaluate("LIFE.list.some(c=>c.k==='frog'&&(c.hide>0||c.dive||c.st==='run'))")
        if not leapt: raise Exception('a frog didn’t leap away when you stood next to it')
        shot(pg, 'life-pond')
        pg.evaluate("environment.force={time:11,weather:'snow',season:'winter'};0"); go_scene(pg, 0); time.sleep(1)
        end = pg.evaluate("(()=>{const e=[walkView.pl.x-6,walkView.pl.z-1.5];walkView.pl.route=[[walkView.pl.x,walkView.pl.z],[walkView.pl.x-4,walkView.pl.z+1],e];walkView.pl.ri=1;return e})()"); time.sleep(3)
        until(pg, f"Math.hypot(walkView.pl.x-({end[0]}),walkView.pl.z-({end[1]}))<.6", 25); time.sleep(1)     # alpha 0.1: walk to the end, however slowly frames come here
        prints = pg.evaluate("(walkRenderer.prints||[]).length"); shot(pg, 'prints-snow')
        if prints < 4: raise Exception(f'only {prints} footprints after a walk in the snow')
        pg.mouse.click(5, 300); time.sleep(1.5)
        snd = pg.evaluate("typeof AUD==='undefined'||!AUD.ctx?'no sound in this browser':AUD.ctx.state!=='running'?'sound not started ('+AUD.ctx.state+')':(typeof AMB!=='undefined'&&Object.keys(AMB.beds).length>=9?'ok':'beds missing')")
        if snd == 'beds missing': raise Exception('the world sound beds didn’t start')
        pg.evaluate("environment.force=null;0")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return f'animals at the pond: {", ".join(kinds)}; a frog leapt in; {prints} footprints; world sounds: {snd}'
    animals()

    @step('Things to do: challenges, a request, a gold stamp, your room, a photo, a ladder, weather in battle', 240)
    def things():
        if not pg.evaluate("typeof chalToday==='function'"): return 'not in this build'
        out = []
        pg.evaluate("environment.force={time:13,weather:'clear',season:'summer'};0"); go_scene(pg, 0); time.sleep(2)
        n = pg.evaluate("chalToday().list.length")
        if n != 3: raise Exception(f'{n} challenges today, not 3')
        out.append('3 challenges: ' + pg.evaluate("chalToday().list.map(chalText).join('; ')"))
        q = pg.evaluate("(()=>{const q=reqHere();return q?q.k+' '+q.t:null})()")
        if not q: raise Exception('no request in Marigold Town today')
        out.append('request: ' + q + (' (someone is asking)' if pg.evaluate("!!reqAsker()") else ''))
        # a gold stamp: stand on one
        spots = pg.evaluate("stampSpots()")
        if len(spots) < 1: raise Exception('no gold stamps in Marigold Town')
        c0 = pg.evaluate("stampCount()"); pg.evaluate(f"walkView.pl.route=null;walkView.pl.x={spots[0][0]};walkView.pl.z={spots[0][1]};0"); time.sleep(2)
        if pg.evaluate("stampCount()") <= c0: raise Exception('standing on a gold stamp didn’t pick it up')
        out.append(f'{len(spots)} stamps here, one picked up')
        # your room (alpha 0.4: in Granny Juniper's cottage in Copperleaf): walk in, put a table in the middle
        home = pg.evaluate("ROUTE.findIndex(r=>r.id==='copperleaf')")
        if home < 0: home = 0
        go_scene(pg, home); time.sleep(1.5)
        pg.evaluate("U.toastQ=[];(()=>{const p=walkView.sc.props.find(p=>p.act==='home'),C=walkData().sc,g=actionSpot(p,C.props[p.k],C.ppu||34);walkView.pl.route=null;walkView.pl.x=g[0];walkView.pl.z=g[1];walkPick({k:'act',p,act:'home'})})();0")
        if not until(pg, "walkView.ready&&(walkView.id==='int_home'||(walkView.sc&&walkView.sc.roomOf==='int_home'))", 60): raise Exception('your room didn’t open')
        pg.evaluate("U.modal=null;U.mq=[];renderOv();x28().home.slots[5]='table_round';x28().home.slots[10]='rug_round';homeApply();0"); time.sleep(2.5); shot(pg, 'room-home')
        if pg.evaluate("GD.scenes.int_home.props.length") < 2: raise Exception('furniture didn’t appear in your room')
        pg.evaluate("leaveRoom();0"); until(pg, f"walkView.ready&&!walkView.sc.roomRect&&(walkView.id===ROUTE[{home}].scene||(walkView.sc&&walkView.sc.baseId===ROUTE[{home}].scene))", 30); time.sleep(1.5)
        # a photo
        pg.evaluate("window.__ph=null;photoStart();walkRenderer.photoReq=c=>{window.__ph=c?c.width:0};0"); until(pg, "window.__ph!==null", 15)
        w = pg.evaluate("window.__ph"); pg.evaluate("photoEnd();0")
        if not w: raise Exception('photo mode didn’t take a picture')
        out.append(f'photo {w}px wide')
        # up a ladder at Kitewind Ridge
        node = pg.evaluate("ROUTE.findIndex(r=>r.scene==='ridge')")
        if node >= 0:
            go_scene(pg, node); time.sleep(1.5)
            r = pg.evaluate("(()=>{const p=walkView.sc.props.find(p=>p.act==='climb');if(!p)return null;const E=climbEnds(p);walkView.pl.route=null;walkView.pl.x=E.bot[0];walkView.pl.z=E.bot[1];walkView.pl.yv=standingHeightAt(E.bot[0],E.bot[1]);return [E.top[0],E.top[1],standingHeightAt(E.top[0],E.top[1]),p.h]})()")
            if not r: raise Exception('no ladder at Kitewind Ridge')
            time.sleep(1); pg.evaluate("walkPick({k:'act',p:walkView.sc.props.find(p=>p.act==='climb'),act:'climb'});0"); time.sleep(1)
            until(pg, '!walkView.pl.climb', 60); time.sleep(.5); shot(pg, 'ladder-top')          # the climb runs on game time, slow in software drawing
            at = pg.evaluate("[walkView.pl.x,walkView.pl.z,walkView.pl.yv,!!walkView.pl.climb]")
            if at[3] or abs(at[0] - r[0]) > .4 or abs(at[1] - r[1]) > .4 or abs(at[2] - r[2]) > .3: raise Exception(f'climbing the ladder ended at {[round(v, 2) for v in at[:3]]}, not on top at {[round(v, 2) for v in r[:3]]}')
            out.append(f'climbed a {r[3]} m ladder')
        # rain in battle
        go_scene(pg, 0); pg.evaluate("environment.force={time:15,weather:'rain'};S.preferences.battleStage='classic';const q={id:'twx',sp:'knight1',lvl:8,gold:false,no:1};S.queue=[q];S.team.forEach(m=>{m.hp=maxHp(m)});startWild(q);0")
        wait_phase(pg, sec=60); bw = pg.evaluate("(()=>{const w=battleWx();return w?[w.k,battleWeatherMult('Water'),battleWeatherMult('Fire'),document.getElementById('camWorld')?document.getElementById('camWorld').dataset.wx:''] :null})()")
        time.sleep(1); shot(pg, 'battle-rain'); pg.evaluate("stopTimers();B=null;battleStageStop();S.preferences.battleStage='scene';environment.force=null;render();0")
        if not bw or bw[0] != 'rain' or bw[1] <= 1 or bw[2] >= 1: raise Exception(f'rain didn’t change the battle ({bw})')
        out.append(f'rain in battle: Water ×{bw[1]}, Fire ×{bw[2]}')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    things()

    @step('v31: shorelines, fountains, autumn, facing, rooms, settings tabs, place card, map camera', 300)
    def v31():
        if not pg.evaluate("typeof shoreField==='function'"): return 'not in this build'
        out = []
        # walking left is the mirror of walking right, not the same picture
        f = pg.evaluate("""(()=>{const fr=owFrames('me'),a=fr.side[0],b=fr.sideR[0],px=c=>{const x=c.getContext('2d');return x.getImageData(0,0,c.width,c.height).data};const A=px(a),B=px(b);let same=0,n=0;for(let i=3;i<A.length;i+=4){if(A[i]>0||B[i]>0){n++;if(A[i]===B[i]&&A[i-1]===B[i-1]&&A[i-2]===B[i-2])same++}}return [n,same]})()""")
        if f[0] and f[1] / f[0] > .97: raise Exception('walking left and walking right show the same picture')
        out.append('left and right walking frames differ')
        node = pg.evaluate("ROUTE.findIndex(r=>r.scene==='pond')")
        if node >= 0:
            go_scene(pg, node); time.sleep(1)
            sh = pg.evaluate("[!!walkRenderer.shoreF,!!walkRenderer.shoreTex,walkRenderer.shoreF?walkRenderer.shoreF.FW:0]")
            if not sh[0] or not sh[1]: raise Exception(f'no shoreline field at Willowmere ({sh})')
            pg.evaluate("(()=>{const w=walkView.water[Math.floor(walkView.water.length*.3)];walkView.pl.route=null;const p=walkablePointNear(w[0]-1.5,w[1]-1.5);walkView.pl.x=p[0];walkView.pl.z=p[1]})();0"); time.sleep(2); shot(pg, 'water-edge')
            out.append(f'shoreline field {sh[2]} samples wide')
        go_scene(pg, 0); until(pg, "(walkRenderer.basinL||[]).some(b=>/^fountain/.test(b.p.k))", 90); time.sleep(.5)   # solids build one a frame at least, slowly in software
        bs = pg.evaluate("(walkRenderer.basinL||[]).map(b=>b.p.k+':'+b.B.length)")
        if not any(x.startswith('fountain') for x in bs): raise Exception(f'no fountain water in Marigold Town ({bs})')
        pg.evaluate("(()=>{const f=walkView.sc.props.find(p=>p.k==='fountain');walkView.pl.route=null;const p=walkablePointNear(f.x+.3,f.z-2.4);walkView.pl.x=p[0];walkView.pl.z=p[1]})();0"); time.sleep(2); shot(pg, 'fountain')
        out.append('basins: ' + ', '.join(bs))
        pg.evaluate("environment.force={time:13,weather:'clear',season:'autumn'};0"); time.sleep(2); shot(pg, 'autumn'); pg.evaluate("environment.force=null;0")
        # rooms: light through the window by day, lamps at night, the floor ends at the door
        pg.evaluate("enterRoom('house',{});0"); until(pg, "walkView.ready&&(walkView.id==='int_house'||(walkView.sc&&walkView.sc.roomOf==='int_house'))", 30); time.sleep(1.5)
        pg.evaluate("environment.force={time:15.5,weather:'clear',season:'summer'};walkRenderer.roomSkyT=0;0"); time.sleep(2); shot(pg, 'room-day')
        day = pg.evaluate("[walkRenderer.roomSky&&walkRenderer.roomSky.I,walkRenderer.roomSky&&walkRenderer.roomSky.lamp,(roomLamps(walkView.sc)||[]).length,!!walkRenderer.roomBox]")
        pg.evaluate("environment.force={time:23,weather:'clear',season:'summer'};walkRenderer.roomSkyT=0;0"); time.sleep(2); shot(pg, 'room-night')
        night = pg.evaluate("[walkRenderer.roomSky&&walkRenderer.roomSky.night,walkRenderer.roomSky&&walkRenderer.roomSky.lamp]")
        pg.evaluate("environment.force=null;leaveRoom();0"); until(pg, "walkView.ready&&!walkView.sc.roomRect&&(walkView.id==='sundown'||(walkView.sc&&walkView.sc.baseId==='sundown'))", 30)
        if not day[3] or not day[0] or day[0] < .2 or night[1] < .9 or day[2] < 1: raise Exception(f'room light: day {day}, night {night}')
        out.append(f'room: daylight {day[0]:.2f}, {day[2]} lamps lit at night')
        # settings in tabs, every tab fits the phone width; a switch flips
        # a message waiting on screen (an egg hatching, in steps mode) would queue Settings behind it
        pg.evaluate("U.modal=null;U.mq=[];renderOv();U.tab='walk';render();settings('game');0"); time.sleep(.6); tabs = []
        # alpha 0.5: the tabs are whatever the game lists (sound, graphics, game, save, help); contrast is under Game
        names = pg.evaluate("SET_TABS.map(t=>t[0])")
        for t in names:
            pg.evaluate(f"document.querySelector('[data-a=set-tab][data-k={t}]').click();0"); time.sleep(.3)
            tabs.append(pg.evaluate("[document.querySelectorAll('.set-body .set-row,.set-body .settings-profile,.set-body details').length,(()=>{const b=document.querySelector('.sheet .body');return b.scrollWidth-b.clientWidth})()]"))
            if t == 'graphics': shot(pg, 'settings-graphics')
        if len(names) < 5 or any(n == 0 for n, _ in tabs) or any(o > 4 for _, o in tabs): raise Exception(f'settings tabs {names}: {tabs}')
        pg.evaluate("document.querySelector('[data-a=set-tab][data-k=game]').click();0"); time.sleep(.2)
        c0 = pg.evaluate("S.preferences.contrast||'normal'"); pg.evaluate("document.querySelector('[data-pref-set=contrast]').click();0"); time.sleep(.2); c1 = pg.evaluate("S.preferences.contrast")
        pg.evaluate("document.querySelector('[data-pref-set=contrast]').click();U.modal=null;U.mq=[];renderOv();0")
        if c0 == c1: raise Exception('the High contrast switch did nothing')
        out.append(f'{len(names)} settings tabs, switches work')
        # the place card closes with x and opens again from the name in the top bar
        pg.evaluate("render();0"); time.sleep(.4); pg.evaluate("document.querySelector('.wh-x').click();0"); time.sleep(.3)
        gone = pg.evaluate("!document.querySelector('.wh-card')"); pg.evaluate("document.querySelector('button.tb-where').click();0"); time.sleep(.3); back = pg.evaluate("!!document.querySelector('.wh-card')")
        if not gone or not back: raise Exception(f'place card: closed {gone}, reopened {back}')
        out.append('place card closes and comes back')
        # the map: drag the land, turn, zoom right down to the miniatures
        pg.evaluate("U.tab='map';render();0"); time.sleep(6)
        if pg.evaluate("worldMap.gl"):
            f0 = pg.evaluate("JSON.stringify(worldMap.focus)"); y0 = pg.evaluate("worldMap.yaw")
            pg.evaluate("worldMapGlPanTo({focus:worldMap.focus||worldMapPlayerPosition(),cam:worldMap.cam},-120,40);worldMapGlAction('mturn',{k:'1'});for(let i=0;i<20;i++)worldMapZoom(.8);worldMap.tilt=.35;0"); time.sleep(2); shot(pg, 'map-close')
            m = pg.evaluate("[JSON.stringify(worldMap.focus),worldMap.yaw,worldMap.alt,worldMap.free]")
            pg.evaluate("worldMapReset();0")
            if m[0] == f0 or abs(m[1] - y0) < .3 or m[2] > .03 or not m[3]: raise Exception(f'map camera: {m}')
            out.append(f'map pans, turns and zooms to {m[2]:.3f}')
        pg.evaluate("U.tab='walk';render();0"); time.sleep(.5)
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    v31()

    @step('v32: 3D miniatures, skipping what is off screen, the scene cache, wear and variety', 240)
    def v32():
        if not pg.evaluate("typeof cullItems==='function'"): return 'not in this build'
        out = []
        # what's off screen is skipped (Verdigris City is the biggest scene)
        node = pg.evaluate("ROUTE.findIndex(r=>r.scene==='city')")
        if node >= 0:
            go_scene(pg, node); until(pg, "!!walkRenderer.grass&&!walkRenderer.grassJob", 60); f0 = pg.evaluate("walkRenderer.frames"); until(pg, f"walkRenderer.frames>{f0 + 2}", 20)   # v46: the grass of a big view is still being planted for a while
            c = pg.evaluate("[walkRenderer.culled||0,walkRenderer.cullOf||0,walkRenderer.grassDrawn||0,walkRenderer.grass?walkRenderer.grass.n:0]")
            if not c[1] or c[0] <= 0: raise Exception(f'nothing was skipped in Verdigris City ({c})')
            out.append(f'Verdigris City: {c[0]} of {c[1]} things and {c[3] - c[2]} of {c[3]} grass blades off screen skipped')
        # going back to a scene seen a moment ago doesn't rebuild its ground
        go_scene(pg, 0); b0 = pg.evaluate("walkRenderer.builds||0")
        if node >= 0: go_scene(pg, node); go_scene(pg, 0)
        b1 = pg.evaluate("walkRenderer.builds||0")
        if node >= 0 and b1 - b0 > 1: raise Exception(f'the ground was rebuilt {b1 - b0} times going there and back')
        out.append(f'there and back: {b1 - b0} ground build(s)')
        # wear and variety (with the dial at 0, ask computePropLook: propLook keeps a look for the rest of the frame, the game sees the dial on the next one)
        r = pg.evaluate("""(()=>{const sc=walkView.sc,C0=walkData().sc,P=sc.props||[],b=P.find(p=>{const M=C0.props[p.k];return M&&M.box&&M.door}),tr=P.filter(p=>/tree/.test(p.k)).slice(0,6);
         const L=b?propLook(b,C0.props[b.k],sc):null,T=tr.map(p=>propLook(p,C0.props[p.k],sc)),sizes=new Set(T.map(l=>l.size.toFixed(3))),hues=new Set(T.map(l=>l.hsv[0].toFixed(4)));
         GD.engine.defaults.world=Object.assign(GD.engine.defaults.world||{},{wear:0});const L0=b?computePropLook(b,C0.props[b.k],sc):null;delete GD.engine.defaults.world.wear;
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
         return {miss,bad,lum:Math.round(lum),mossy,plain,det:eng('world','texDetail'),aniso:!!EGL.aniso}})()""")
        if v['miss'] or v['bad']: raise Exception(f'prop variants missing or not loading: {v}')
        if v['lum'] < 45: raise Exception(f"the sofa's top is still dark (brightness {v['lum']})")
        if not (4 <= v['mossy'] <= 30) or not v['plain']: raise Exception(f'mossy twins: {v}')
        out.append(f"10 new prop variants load; a sofa's top {v['lum']} bright (was black); {v['mossy']} of 40 stumps mossy; surface detail {v['det']}, sharp-at-a-slant {'on' if v['aniso'] else 'not offered by this graphics chip'}")
        pg.evaluate("(()=>{const sc=walkView.sc,C0=walkData().sc,b=(sc.props||[]).find(p=>{const M=C0.props[p.k];return M&&M.box&&M.door});if(!b)return;walkView.pl.route=null;const q=walkablePointNear(b.x,b.z-2.5);walkView.pl.x=q[0];walkView.pl.z=q[1];walkRenderer.zoomT=walkRenderer.zoom=.7})();0"); time.sleep(2.5); shot(pg, 'wear-building')
        # the map's 3D miniatures
        pg.evaluate("U.tab='map';render();0"); time.sleep(3)
        if pg.evaluate("worldMap.gl&&typeof worldMapMinisOn==='function'&&worldMapMinisOn()"):
            pg.evaluate("worldMap.alt=.04;worldMap.tilt=.45;worldMapGl.altT=null;worldMap.dirty=true;0"); time.sleep(4)
            n = pg.evaluate("[...MM.cache.values()].filter(e=>e.m).length"); shot(pg, 'map-minis')
            pg.evaluate("worldMapReset();0")
            if n < 1: raise Exception('no 3D miniatures were built on the map')
            out.append(f'{n} 3D miniatures on the map')
        pg.evaluate("U.tab='walk';render();0"); time.sleep(.5)
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    v32()

    @step('v33: double and Alpha battles, nameplates, Billies in the world', 300)
    def v33():
        if not pg.evaluate("typeof liveK==='function'&&typeof worldBillyItem==='function'"): return 'not in this build'
        out = []
        pg.evaluate("S.team.forEach(m=>{m.hp=maxHp(m);m.status=null;m.lvl=Math.max(m.lvl,12)});while(S.team.filter(m=>m.job==null).length<3)S.team.push(makeMon(DEX[(S.team.length*5+3)%DEX.length],10));S.team.forEach(m=>m.hp=maxHp(m));0")
        tap = "B&&B.phase==='playing'&&tapMsg()"
        for kind in ('double', 'alpha'):
            if kind == 'double':
                tid = pg.evaluate("Object.keys(TRAINERS).find(k=>TRAINERS[k].team.length>=2)||''")
                if not tid: out.append('no trainer for a double battle'); continue
                pg.evaluate(f"startTrainer('{tid}',{{talked:true,double:true}});0")
            else:
                pg.evaluate("(()=>{const sp=Object.keys(SP).find(k=>SP[k].stage===0&&!RULES.start.starters.includes(SP[k].line));const q={id:'cq-alpha',sp,lvl:6,gold:false,no:1,alpha:true};S.queue.push(q);startWild(q)})()")
            if not until(pg, "B&&B.phase==='choose'", 90, tap): raise Exception(f'{kind}: never reached the move menu (phase {pg.evaluate("B&&B.phase")})')
            # the plates fade in with their billionaires; in software drawing that can take a few seconds
            until(pg, "document.querySelectorAll('#plates .bplate:not(.off):not(.gone)').length>=liveK(0).length+liveK(1).length", 12); time.sleep(.5)
            r = pg.evaluate("JSON.stringify({fmt:B.fmt,mine:liveK(0).length,theirs:liveK(1).length,plates:document.querySelectorAll('#plates .bplate:not(.off):not(.gone)').length,boss:!!(A(1)&&A(1).boss),big:battleStage.s[1]?battleStage.s[1].big:1})")
            r = json.loads(r)
            if kind == 'double' and (r['fmt'] != 'double' or r['theirs'] < 2): raise Exception(f'double battle came out as {r}')
            if kind == 'alpha' and (r['fmt'] != 'alpha' or not r['boss'] or r['mine'] < 2): raise Exception(f'Alpha battle came out as {r}')
            if r['plates'] < r['mine'] + r['theirs']: raise Exception(f'{kind}: only {r["plates"]} nameplates for {r["mine"] + r["theirs"]} billionaires')
            shot(pg, f'battle-{kind}')
            # every fighter picks; with two foes the move needs a target
            picks = pg.evaluate("""(async()=>{let n=0,aim=0;while(B&&B.phase==='choose'&&n<4){const m=A(B.cur),mid=m.moves.find(id=>MOVES[id]&&MOVES[id].c!=='X')||m.moves[0];pickMove(mid);n++;if(B.phase==='target'){aim++;await new Promise(r=>setTimeout(r,300));pickTarget(liveK(1)[liveK(1).length-1])}await new Promise(r=>setTimeout(r,60))}return [n,aim]})()""")
            if kind == 'double' and picks[1] < 1: raise Exception('double battle: no move asked for a target')
            if not until(pg, "B&&['choose','end','switch'].includes(B.phase)", 120, tap): raise Exception(f'{kind}: the turn never finished (phase {pg.evaluate("B&&B.phase")})')
            lines = pg.evaluate("B.events.map(e=>e.t).filter(Boolean)")
            hit_two = sum(1 for l in lines if ' used ' in l)
            out.append(f"{kind}: {r['mine']} vs {r['theirs']}, {r['plates']} nameplates, {picks[0]} picks ({picks[1]} aimed), {hit_two} moves in the turn" + (f", Alpha {r['big']}x size" if kind == 'alpha' else ''))
            if kind == 'alpha':
                pg.evaluate("(async()=>{for(let i=0;i<20&&B&&B.phase==='switch';i++){const b=document.querySelector('#acts [data-a=bswitch]:not([disabled])');if(b)b.click();await new Promise(r=>setTimeout(r,200));for(let j=0;j<40&&B&&B.phase==='playing';j++){tapMsg();await new Promise(r=>setTimeout(r,150))}}})()")
                c = pg.evaluate("""(async()=>{if(!B||B.phase!=='choose')return 'catching skipped: the battle '+(B?'is at '+B.phase:'ended');U.dbgCatch=true;B.coin=Object.keys(COINS).find(k=>S.coins[k]>0)||Object.keys(COINS)[0];S.coins[B.coin]=(S.coins[B.coin]||0)+1;B.phase='aim';paintActions();showAim();doThrow(false);
                  for(let i=0;i<120&&B&&B.phase!=='end';i++){if(B.phase==='playing')tapMsg();await new Promise(r=>setTimeout(r,250))}U.dbgCatch=false;const m=S.team.concat(S.box).find(m=>m.alpha);return m?`caught: Alpha flag kept, boss boost dropped (${m.hp}/${maxHp(m)} HP)`:'not caught'})()""")
                out.append(c)
            pg.evaluate("if(B){B.over=B.over||'ran';B.phase='end';endBattle()};0"); time.sleep(2.5); pg.evaluate("U.modal=null;U.mq=[];renderOv();0")
        # the world: billionaires waiting in the grass (one an Alpha; v46: each keeps its spot), the buddy, a trainer's companion
        pg.evaluate("S.queue=[];for(let i=0;i<3;i++){const q=spawn(false);if(!i)q.alpha=true};S.buddy=S.team[1].uid;save();0")
        node = pg.evaluate("ROUTE.findIndex(r=>r.scene==='longgrass')")
        go_scene(pg, node); time.sleep(4)
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
    v33()

    @step('v34: shadow cache, walk cycles, Alpha shield, turn order, partner AI', 300)
    def v34():
        out = []
        # (v37: the 2x "detailed art" of v34 is retired; the ground is the 32 px tiles of v37) open a scene and read the renderer's counters
        node = pg.evaluate("ROUTE.findIndex(r=>r.scene==='city')")
        if node >= 0: go_scene(pg, node); time.sleep(6)
        r = json.loads(pg.evaluate("JSON.stringify({tp:(walkRenderer.ring&&walkRenderer.ring.TP)||(walkView.ground&&walkView.ground._TP),mb:Math.round((EGL.texB||0)/1048576),sh:[walkRenderer.shHit||0,walkRenderer.shMiss||0],grid:walkRenderer.gridSkip||0,gpu:EGL.gpuX?'timer':'no timer'})"))
        if r['tp'] != 32: raise Exception(f'the ground isn’t painted from the 32 px tiles (tile {r["tp"]} px)')
        shot(pg, 'v34-city')
        out.append(f"ground {r['tp']} px a tile, {r['mb']} MB of pictures on the card; shadow cache {r['sh'][0]} kept / {r['sh'][1]} drawn; {r['grid']} props skipped by the grid; GPU {r['gpu']}")
        # walk cycles per body plan, front and back only
        w = pg.evaluate("""(()=>{const plans={};for(const sp of Object.keys(SP)){const R=typeof rigParts==='function'?rigParts(sp,false,1):null;if(!R||plans[R.plan])continue;const a=worldBillyFrame(sp,false,'front','walk',0,1),b=worldBillyFrame(sp,false,'front','walk',280,1);if(!a||!b)continue;
          const d=(c)=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;const x=d(a),y=d(b);let diff=0;for(let i=3;i<x.length;i+=16)if(x[i]!==y[i])diff++;plans[R.plan]=diff}return plans})()""")
        still = [k for k, v in w.items() if v == 0]
        if still: raise Exception(f'walk cycle doesn’t move for: {", ".join(still)}')
        out.append('walk cycles move for ' + ', '.join(sorted(w)))
        # an Alpha brought below half: the shield phase
        pg.evaluate("(()=>{const sp=Object.keys(SP).find(k=>SP[k].stage===0);const q={id:'cq-a34',sp,lvl:6,gold:false,no:1,alpha:true};S.queue.push(q);S.team.forEach(m=>{m.hp=maxHp(m);m.status=null});startWild(q)})()")
        tap = "B&&B.phase==='playing'&&tapMsg()"
        if not until(pg, "B&&B.phase==='choose'", 90, tap): raise Exception('Alpha battle never reached the move menu')
        a = json.loads(pg.evaluate("(()=>{const m=A(1);m.hp=Math.floor(maxHp(m)*.55);B.events=[];alphaPhase(1);m.hp=Math.floor(maxHp(m)*.45);alphaPhase(1);const tb=document.querySelector('#plates .turnbar');paintPlates(snapAll());return JSON.stringify({ph2:!!m.boss.ph2,shield:FV(1).shield,lines:B.events.map(e=>e.t),bar:!!document.querySelector('#plates .turnbar')})})()"))
        if not a['ph2'] or a['shield'] < 1: raise Exception(f'Alpha shield phase didn’t start: {a}')
        out.append(f"Alpha below half: “{a['lines'][0][:60]}”, shield {a['shield']} turns, turn order bar {'shown' if a['bar'] else 'missing'}")
        pg.evaluate("if(B){B.over='ran';B.phase='end';endBattle()};0"); time.sleep(2.5); pg.evaluate("U.modal=null;U.mq=[];renderOv();0")
        # partner AI: two foes don't both hit a target the first one already finishes
        tid = pg.evaluate("Object.keys(TRAINERS).find(k=>TRAINERS[k].team.length>=2)||''")
        if tid:
            pg.evaluate(f"startTrainer('{tid}',{{talked:true,double:true}});0")
            if until(pg, "B&&B.phase==='choose'", 90, tap):
                p = json.loads(pg.evaluate("(()=>{const me=liveK(0);if(me.length<2)return JSON.stringify({skip:1});const t=A(me[0]);const keep=t.hp;t.hp=1;let pile=0;for(let i=0;i<30;i++){B.aiPlan={};const a=chooseAI(liveK(1)[0]),b=chooseAI(liveK(1)[1]);if(a&&b&&a.tk===me[0]&&b.tk===me[0]&&MOVES[a.mid].c!=='X'&&MOVES[b.mid].c!=='X')pile++}t.hp=keep;return JSON.stringify({pile})})()"))
                out.append('partner AI: ' + ('skipped (one fighter)' if p.get('skip') else f"both foes piled on a 1 HP target {p['pile']} of 30 times"))
            pg.evaluate("if(B){B.over='ran';B.phase='end';endBattle()};0"); time.sleep(2.5); pg.evaluate("U.modal=null;U.mq=[];renderOv();0")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    v34()

    @step('v35: roster, palette, starter studies, pixel-grid camera', 120)
    def v35():
        out = []
        n = pg.evaluate("(GD.roster||[]).length")
        if n != 117: raise Exception(f'the roster has {n} billionaires, not 117')
        kinds = pg.evaluate("GD.roster.reduce((a,e)=>{a[e.kind]=(a[e.kind]||0)+1;return a},{})")
        if kinds != {'starter': 12, 'legendary': 2, 'line3': 45, 'line2': 40, 'single': 18}: raise Exception(f'roster shape: {kinds}')
        ids = pg.evaluate("GD.roster.map(e=>e.id)")
        if len(set(ids)) != 117: raise Exception('roster ids repeat')
        old = pg.evaluate("Object.keys(SP)")
        clash = sorted(set(ids) & set(old))
        if clash: raise Exception(f'new ids clash with current species: {clash[:5]}')
        out.append('roster: 117 (12 starters, 2 legendaries, 45 in three-stage lines, 40 in two-stage, 18 singles), no id clashes')
        nx = ROOT / 'game' / 'art' / 'next'
        for f in ('palette.png', 'palette.js'):
            if not (nx / f).exists(): raise Exception(f'missing {f} under art/next')
        # phase 03 deleted the v35 master tiles (art/next/tiles, Lite mode's ground); the ground the game draws is
        # art/next/tiles47, checked by 'Ground: every kind has twelve tiles of its own'
        studies = len(list((nx / 'starters').glob('*_sil.png')))
        if studies < 12: raise Exception(f'only {studies} starter silhouettes')
        out.append(f'art/next: palette, {studies} starter silhouettes')
        # every palette colour is distinct
        from PIL import Image
        pal = {tuple(c) for c in pixels(Image.open(nx / 'palette.png').convert('RGB'))}
        if len(pal) < 150: raise Exception(f'palette has {len(pal)} distinct colours')
        # the pixel-grid camera dial: off by default, and turning it on keeps the scene drawing
        if pg.evaluate("eng('camera','pixelGrid')!==false"): raise Exception('pixelGrid should be off by default')
        pg.evaluate("GD.engine.defaults.camera=Object.assign({},GD.engine.defaults.camera||{},{pixelGrid:true});0"); time.sleep(2)
        fr = pg.evaluate("walkRenderer.frames||0")
        if not until(pg, f"(walkRenderer.frames||0)>{fr + 1}", 30): raise Exception('no frames drawn with the pixel-grid camera on')   # alpha 0.1: a frame can take seconds here
        pg.evaluate("delete GD.engine.defaults.camera.pixelGrid;0")
        out.append('pixel-grid camera: off by default, draws when on')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    v35()

    @step('v36: new starters on piece sheets, split evolution, 12 fps puppets, next ground tiles', 150)
    def v36():
        if not pg.evaluate("typeof rigFrame==='function'&&!!window.RIGS_NEXT"): return 'not in this build'
        out = []
        st = pg.evaluate("RULES.start.starters")
        if st != ['musk', 'bezos', 'gates']: raise Exception(f'starters are {st}')
        ids = [f'{l}{i}' for l in st for i in range(4)]
        miss = [i for i in ids if not pg.evaluate(f"!!(SP['{i}']&&RIGS['{i}']&&RIGS['{i}'].front&&RIGS['{i}'].back)")]
        if miss: raise Exception(f'missing species or rigs: {miss}')
        nx = ROOT / 'game' / 'art' / 'next' / 'billionaires'
        sheets = [n for n in ('emberox', 'boostox', 'marsox', 'memeox', 'cartotter', 'primotter', 'orbitotter', 'everyotter', 'kidling', 'billgoat', 'windowgoat', 'harvestgoat') if (nx / f'{n}.png').exists() and (nx / f'{n}.json').exists() and (nx / f'{n}_gold.png').exists()]
        if len(sheets) < 12: raise Exception(f'only {len(sheets)} piece sheets with layout and gold')
        out.append('12 starter species, 12 sheets (png + json + gold), rigs for front and back')
        pg.evaluate("rigPreload(%s.flatMap(id=>[[id,false,1],[id,false,1.4],[id,true,1]]))" % json.dumps(ids)); time.sleep(3)
        r = json.loads(pg.evaluate("""(ids=>{const out={};for(const id of ids){const o={};for(const [v,k] of [['front',1],['back',1.4]]){const R=rigParts(id,false,k);if(!R){o[v]=null;continue}
          const c=cnv(R.BW,R.BH),x=c.getContext('2d');const n=(P)=>{x.clearRect(0,0,R.BW,R.BH);drawRig(x,R,P,v);const d=x.getImageData(0,0,R.BW,R.BH).data;let s=0;for(let i=3;i<d.length;i+=4)if(d[i]>0)s++;return s};
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
        plans = pg.evaluate("Object.keys(ANIM).length")
        out.append(f"motion audit: every piece moves, legs walk and heads flinch on all 12; {plans} body plans")
        # split evolution: the middle stage goes to A on kilometres, to B on wins
        e = json.loads(pg.evaluate("""(()=>{const a=makeMon('musk1',32);a.bsteps=4000;a.wins=1;const b=makeMon('musk1',32);b.wins=5;b.bsteps=100;const ra=evoReady(a),pa=splitPath(a),pb=splitPath(b);evolve(a);evolve(b);return JSON.stringify({ra,pa,pb,a:a.sp,b:b.sp,hint:evoHint(makeMon('musk1',20))})})()"""))
        if not (e['ra'] and e['a'] == 'musk2' and e['b'] == 'musk3'): raise Exception(f'split evolution: {e}')
        out.append(f"split at 32: Build → Marsox, Hype → Memeox (“{e['hint'][:60]}…”)")
        # a battle with the new starter on the 3D stage: the player's rig buffer has pixels
        pg.evaluate("S.team.unshift(makeMon('gates0',14));S.team[0].hp=maxHp(S.team[0]);S.preferences.battleStage='scene';const q={id:'cq36',sp:'bezos1',lvl:12,gold:false,no:1};S.queue.push(q);startWild(q);0")
        if not until(pg, "B&&B.phase==='choose'", 90, "B&&B.phase==='playing'&&tapMsg()"): raise Exception('the starter battle never reached the move menu')
        until(pg, "(()=>{const a=sideBuf(0),b=sideBuf(1);return !!(a&&b)})()", 15); time.sleep(2)
        px = json.loads(pg.evaluate("(()=>{const o={};for(const i of [0,1]){const Bf=sideBuf(i);if(!Bf){o[i]=0;continue}const d=Bf.buf.getContext('2d').getImageData(0,0,Bf.buf.width,Bf.buf.height).data;let n=0;for(let k=3;k<d.length;k+=4)if(d[k]>0)n++;o[i]=n}return JSON.stringify(o)})()"))
        shot(pg, 'v36-starter-battle')
        if px['0'] < 500 or px['1'] < 500: raise Exception(f'battle rig buffers nearly empty: {px}')
        pg.evaluate("if(B){B.over='ran';B.phase='end';endBattle()};0"); time.sleep(2.5); pg.evaluate("U.modal=null;U.mq=[];renderOv();S.team.shift();0")
        out.append(f"3D-stage battle Kidling vs Primotter: both puppets drawn ({px['0']} / {px['1']} px)")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    v36()

    @step('v37: 32 px ground, building budget, party steps, retired 2x art', 150)
    def v37():
        out = []
        if pg.evaluate("typeof artHdOf==='function'||typeof dglHdAuto==='function'||!!window.NW_HD"): raise Exception('the v34 2x pipeline is still in the build')
        if (GAME / 'art' / 'hd').exists() or (GAME / 'data' / 'hdart.js').exists(): raise Exception('art/hd or data/hdart.js still shipped')
        node = pg.evaluate("ROUTE.findIndex(r=>r.scene==='sundown')")
        if node < 0: raise Exception('no Marigold Town')
        go_scene(pg, node); time.sleep(8)
        tp = pg.evaluate("(walkRenderer.ring&&walkRenderer.ring.TP)||(walkView.ground&&walkView.ground._TP)")
        if tp != 32: raise Exception(f'Marigold Town ground painted at {tp} px a tile')
        r = json.loads(pg.evaluate("JSON.stringify({made:BLD.made||0,drawn:BLD.drawn||0,n:(walkView.sc.props||[]).filter(p=>{const M=GD.scenery.props[p.k];return M&&M.build}).length})"))
        if r['made'] < 1: raise Exception('no 3D building model was built at Marigold Town')
        shot(pg, 'v37-sundown')
        out.append(f"Marigold Town: ground {tp} px a tile; {r['made']} building models built over frames, {r['drawn']} drawn, {r['n']} buildings in the scene")
        # v47: the 16 px dial is gone; the 32 px ground is the only full-mode ground
        if pg.evaluate("eng('world','nextArt')!==undefined"): raise Exception('the old 32 px ground dial is still in the settings')
        # the party walks at half weight for the Build path
        w = pg.evaluate("(()=>{const m=S.team[0];const b0=m.bsteps||0;const extra={uid:'cq37',sp:m.sp,lvl:5,hp:10,wins:0,bsteps:0,psteps:0};S.team.push(extra);const s0=S.buddy;S.buddy=m.uid;addSteps(2000);const ps=extra.psteps;S.team.pop();S.buddy=s0;return [m.bsteps-b0,ps]})()")
        if w[0] < 2000 or w[1] < 2000: raise Exception(f'steps: buddy got {w[0]}, party member got {w[1]}')
        pth = pg.evaluate("splitPath({wins:1,bsteps:0,psteps:RULES.steps.stepsPerKm*4})")
        if pth != 'A': raise Exception(f'4 km in the party at half weight (2 km) should beat 1 win, got path {pth}')
        out.append('party steps count at half weight for the Build path')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    v37()

    @step('v38: 61 roster species on piece sheets, rigs that draw, filled pools, saves checked against the data', 240)
    def v38():
        out = []
        lines = ['huang', 'ellison', 'ma', 'walton', 'bloomberg', 'jobs', 'knight', 'kroc', 'ambani', 'ortega', 'hughes', 'carnegie', 'lauren', 'ford', 'slim', 'cuban', 'pagebrin', 'thiel', 'dorsey', 'ek', 'son', 'buterin', 'saylor']
        ids = json.loads(pg.evaluate("JSON.stringify(Object.keys(SP).filter(id=>%s.includes(SP[id].line)))" % json.dumps(lines)))
        if len(ids) != 61: raise Exception(f'{len(ids)} roster species in the data, not 61')
        miss = [i for i in ids if not pg.evaluate(f"!!(RIGS['{i}']&&RIGS['{i}'].front&&RIGS['{i}'].back&&RIGS['{i}'].front.sheet)")]
        if miss: raise Exception(f'missing rigs: {miss[:6]}')
        nx = ROOT / 'game' / 'art' / 'next' / 'billionaires'
        names = json.loads(pg.evaluate("JSON.stringify(GD.roster.filter(e=>%s.includes(e.line)).map(e=>e.id))" % json.dumps(lines)))
        bad = [n for n in names if not ((nx / f'{n}.png').exists() and (nx / f'{n}.json').exists() and (nx / f'{n}_gold.png').exists())]
        if bad: raise Exception(f'sheets missing: {bad[:6]}')
        st = pg.evaluate("GD.roster.filter(e=>e.state&&e.state.sheet&&e.state.rig).length")
        if st < 73: raise Exception(f'roster board marks only {st} species as drawn and rigged')
        out.append(f'61 species in 23 lines, numbered {pg.evaluate("SP.huang0.no")} to {pg.evaluate("SP.saylor1.no")}; {len(names)} sheets (png + json + gold); roster board: {st} drawn and rigged')
        pg.evaluate("rigPreload(%s.flatMap(id=>[[id,false,1],[id,true,1]]))" % json.dumps(ids)); time.sleep(4)
        r = json.loads(pg.evaluate("""(ids=>{const out={};for(const id of ids){const o={};for(const v of ['front','back']){const R=rigParts(id,false,1);if(!R){o[v]=null;continue}
          const c=cnv(R.BW,R.BH),x=c.getContext('2d');x.clearRect(0,0,R.BW,R.BH);drawRig(x,R,rigFrame(R,null,0,1000,1),v);const d=x.getImageData(0,0,R.BW,R.BH).data;let s=0;for(let i=3;i<d.length;i+=4)if(d[i]>0)s++;o[v]=s}out[id]=o}return JSON.stringify(out)})(%s)""" % json.dumps(ids)))
        weak = [k for k, v in r.items() if not v['front'] or v['front'] < 600 or not v['back'] or v['back'] < 400]
        if weak: raise Exception(f'rigs draw too little: {weak[:6]} ({ {k: r[k] for k in weak[:3]} })')
        au = json.loads(pg.evaluate("JSON.stringify(Object.fromEntries(%s.map(id=>[id,rigAudit(id,'front')])))" % json.dumps(ids)))
        still = {k: v['still'] for k, v in au.items() if v and v['still']}
        if still: raise Exception(f'pieces that never move: {dict(list(still.items())[:4])}')
        plans = sorted(set(pg.evaluate(f"RIGS['{i}'].front.plan") for i in ids))
        out.append(f"every rig draws front and back ({min(v['front'] for v in r.values())}+ px); every piece moves; body plans {', '.join(plans)}")
        # the first twelve regions hold only new species; the rest only old ones
        pools = json.loads(pg.evaluate("JSON.stringify(Object.fromEntries(Object.entries(POOLS).map(([k,p])=>[k,p.list.map(x=>SP[x[0]].line)])))"))
        new_all = set(json.loads(pg.evaluate("JSON.stringify(LINES.map(l=>l.id).filter(id=>!['musk','bezos','gates'].includes(id)))")))   # v39: every line beyond the starters is new roster
        mixed = [k for k, L in pools.items() if any(l in new_all for l in L) and any(l not in new_all for l in L)]
        if mixed: raise Exception(f'pools mixing old and new species: {mixed}')
        new_pools = [k for k, L in pools.items() if all(l in new_all for l in L)]
        if len(new_pools) < 12: raise Exception(f'only {len(new_pools)} pools filled with the new roster')
        out.append(f'{len(new_pools)} regions filled with the new roster, {len(pools) - len(new_pools)} still old, none mixed')
        # alpha 0.4.1: saves only need to work with this version: a save is checked against the game data, a species the
        # data no longer has is dropped with its Guide marks, the rest loads as it was
        m = json.loads(pg.evaluate("""(()=>{const s=migrate({started:true,team:[{uid:'g1',sp:'ghost0',lvl:7,moves:[]},{uid:'g2',sp:'walton0',lvl:6,moves:[]}],box:[],seen:{ghost0:1,walton1:1},caught:{ghost0:1},queue:[{id:'q',sp:'ghost0',lvl:5}]});
          return JSON.stringify({team:s.team.map(m=>m.sp),moves:s.team[0].moves.length,seen:Object.keys(s.seen),caught:Object.keys(s.caught),q:s.queue.length})})()"""))
        if m['team'] != ['walton0'] or not m['moves'] or m['seen'] != ['walton1'] or m['caught'] or m['q']: raise Exception(f'save check: {m}')
        out.append('a save is checked against the game data: a species it no longer has is dropped with its Guide marks')
        # a wild battle with a new species on the 3D stage
        pg.evaluate("(()=>{const q={id:'cq38',sp:'kroc0',lvl:8,gold:false,no:1};S.queue.push(q);S.team.forEach(m=>{m.hp=maxHp(m);m.status=null});startWild(q)})()")
        until(pg, "(()=>{const a=sideBuf(0),b=sideBuf(1);return !!(a&&b)})()", 15); time.sleep(2)
        px = json.loads(pg.evaluate("(()=>{const o={};for(const i of [0,1]){const Bf=sideBuf(i);if(!Bf){o[i]=0;continue}const d=Bf.buf.getContext('2d').getImageData(0,0,Bf.buf.width,Bf.buf.height).data;let n=0;for(let k=3;k<d.length;k+=4)if(d[k]>0)n++;o[i]=n}return JSON.stringify(o)})()"))
        shot(pg, 'v38-battle')
        if px['1'] < 500: raise Exception(f'the wild Frylet drew nothing on the stage: {px}')
        pg.evaluate("if(B){B.over='ran';B.phase='end';endBattle()};0"); time.sleep(2.5); pg.evaluate("U.modal=null;U.mq=[];renderOv();0")
        out.append(f"wild Frylet on the 3D stage ({px['1']} px)")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    v38()

    @step('v39/v40: the whole roster, old roster gone, legendaries, signature moves, six-choice dressing room, busts', 300)
    def v39():
        out = []
        n = pg.evaluate("Object.keys(SP).length"); ln = pg.evaluate("LINES.length")
        if n != 117 or ln != 58: raise Exception(f'{n} species in {ln} lines (want 117 in 58)')
        if pg.evaluate("!!(SP.hood0||SP.goss0||SP.myth0||RIGS.hood0)"): raise Exception('old species still in the data')
        if (GAME / 'art' / 'billionaires').exists(): raise Exception('art/billionaires still shipped')
        ids = json.loads(pg.evaluate("JSON.stringify(Object.keys(SP))"))
        miss = [i for i in ids if not pg.evaluate(f"!!(RIGS['{i}']&&RIGS['{i}'].front&&RIGS['{i}'].back&&RIGS['{i}'].front.sheet&&RIGS['{i}'].front.portrait)")]
        if miss: raise Exception(f'rigs or busts missing: {miss[:6]}')
        nx = ROOT / 'game' / 'art' / 'next' / 'billionaires'
        sheets = len([f for f in nx.glob('*.png') if not f.stem.endswith('_gold')])
        if sheets < 117: raise Exception(f'{sheets} sheets')
        out.append(f'117 species in 58 lines, every one with a sheet, a rig and a bust; old roster and art/billionaires gone')
        pools = json.loads(pg.evaluate("JSON.stringify(Object.values(POOLS).concat(Object.values(EGGS||{}),Object.values(GD.fishing||{})).map(p=>p.list.map(x=>x[0])))"))
        bad = [i for L in pools for i in L if i not in ids]
        if bad: raise Exception(f'pools name species that are gone: {bad[:5]}')
        sig = json.loads(pg.evaluate("JSON.stringify(LINES.filter(l=>!(l.learn||[]).some(([lv,m])=>MOVES[m]&&MOVES[m].sig===l.id)).map(l=>l.id))"))
        if [x for x in sig if x not in ('musk', 'bezos', 'gates')]: raise Exception(f'lines without a signature move: {sig[:6]}')
        nsig = pg.evaluate("Object.values(MOVES).filter(m=>m.sig).length")
        out.append(f'{nsig} signature moves, one per new line; every pool, egg and fishing list names a living species')
        # the legendary at the volcano
        node = pg.evaluate("ROUTE.findIndex(r=>r.scene==='volcano')")
        if node >= 0:
            pg.evaluate("delete S.story['legend_rockefeller0'];delete S.caught.rockefeller0;STORY.pending=null;U.modal=null;U.mq=[];if(TALK.on&&typeof talkHide==='function')talkHide();renderOv();0"); go_scene(pg, node); time.sleep(3)
            if not until(pg, "!!U.modal&&/leaking/.test(U.modal.title||'')", 40): raise Exception(f"the legendary at the volcano did not show up ({pg.evaluate('JSON.stringify({ready:walkView.ready,id:walkView.id,tab:U.tab,modal:U.modal&&U.modal.title,talk:TALK.on,cs:CS.on,pend:STORY.pending,flag:S.story.legend_rockefeller0,route:S.route,b:!!B})')})")
            pg.evaluate("U.modal.btns[0].f();0"); until(pg, "!!B", 6); time.sleep(2)
            foe = pg.evaluate("B&&B.sides[1].team.map(m=>[m.sp,m.lvl])[0]")
            if foe != ['rockefeller0', 42]: raise Exception(f'legendary battle foe: {foe}')
            shot(pg, 'v39-legend')
            pg.evaluate("if(B){B.over='ran';B.phase='end';endBattle()};0"); time.sleep(2.5); pg.evaluate("U.modal=null;U.mq=[];renderOv();0")
            if pg.evaluate("!!U.modal"): raise Exception('the legendary came back the same day')
            out.append('Oilympus meets you at the volcano at level 42, once a day')
        # the six-choice dressing room
        pg.evaluate("openDressing({});0"); time.sleep(1.5)
        tabs = json.loads(pg.evaluate("JSON.stringify([...document.querySelectorAll('[data-a=dr-tab]')].map(b=>b.dataset.t))"))
        if tabs != ['body', 'face', 'hair', 'outfit', 'hat', 'extras']: raise Exception(f'dressing room tabs: {tabs}')
        pg.evaluate("DR.tab='face';drRefresh();document.querySelectorAll('[data-a=dr-face]')[3].click();0"); time.sleep(.5)
        f = json.loads(pg.evaluate("JSON.stringify([DR.look.wear.eyes,DR.look.wear.brows,DR.look.wear.mouth])"))
        pg.evaluate("DR.tab='outfit';drRefresh();0"); time.sleep(1)
        no = pg.evaluate("document.querySelectorAll('[data-a=dr-outfit][data-w=\"0\"]').length")
        pg.evaluate("[...document.querySelectorAll('[data-a=dr-outfit]')].find(e=>e.dataset.n==='Everyday'&&e.dataset.w==='1').click();0"); time.sleep(.5)
        o = json.loads(pg.evaluate("JSON.stringify([DR.look.wear.top,DR.look.wear.bottom,DR.look.wear.shoes,(DR.look.colors.tee||[])[0]])"))
        pg.evaluate("document.querySelector('[data-a=dr-more][data-t=outfit]').click();0"); time.sleep(.6)
        more = pg.evaluate("document.querySelectorAll('[data-a=dr-wear][data-s=top]').length")
        shot(pg, 'v40-dressing'); pg.evaluate("closeDressing();0")
        if f != ['eyes_sharp', 'brows_straight', 'mouth_smirk'] or no < 12 or o != ['tee', 'jeans', 'sneakers', '#C8323C'] or more < 10: raise Exception(f'dressing room: face {f}, {no} outfits, outfit {o}, more {more}')
        out.append(f'dressing room: six tabs, 12 faces, {no} outfits in three colourways, every piece under More')
        # busts in the Guide and the switch menu
        pg.evaluate("S.seen['walton0']=1;U.tab='ledger';render();0"); time.sleep(1)
        busts = pg.evaluate("document.querySelectorAll('.ledger .bust').length"); pg.evaluate("U.tab='walk';render();0")
        if busts < 100: raise Exception(f'the Guide shows {busts} busts')
        out.append(f'{busts} busts in the Guide')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    v39()

    @step('v42: nature props and the wild growth, edge-relative exits and the join table', 120)
    def v42():
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
        # alpha 0.5's Graphics gallery, test: true, are laid out by hand)
        bad = json.loads(pg.evaluate("""JSON.stringify((()=>{const C=walkData().sc.props,out=[];for(const [id,sc] of Object.entries(GD.scenes)){if(/^(test_|int_)/.test(id)||sc.test||sc.indoor||sc.room)continue;const g=(sc.props||[]).filter(p=>p.w===42);if(sc.wild!==42||!g.length){out.push(id+': not grown');continue}
         for(const p of g){const ch=(sc.tiles[sc.h-1-Math.floor(p.z)]||'')[Math.floor(p.x)],M=C[p.k];if(!M){out.push(id+': '+p.k+' unknown');break}if('pcmbaqheo'.includes(ch)){out.push(id+': '+p.k+' on paved ground');break}if('wd'.includes(ch)&&!(M.grow||'').includes(ch)){out.push(id+': '+p.k+' in water');break}}}return out})())"""))
        if bad: raise Exception('wild growth: ' + '; '.join(bad[:4]))
        grown = pg.evaluate("Object.values(GD.scenes).reduce((n,sc)=>n+(sc.props||[]).filter(p=>p.w===42).length,0)")
        out.append(f'{grown} props grown over the outdoor scenes, none on paths')
        # edge-relative exits: every scene with exits has them, the points they give are the ones everything reads
        ex = json.loads(pg.evaluate("""JSON.stringify((()=>{const out=[];for(const [id,sc0] of Object.entries(GD.scenes)){if(!(sc0.exits||[]).length)continue;const sc=mapById(id);if(!sc.edgeExits||sc.edgeExits.length!==sc.exits.length){out.push(id+': no edge exits');continue}
         sc.edgeExits.forEach((e,k)=>{const p=exitPoint(sc,e),q=sc.exits[k];if(!e.id||!'NSEW'.includes(e.side)||Math.hypot(p[0]-q[0],p[1]-q[1])>.02)out.push(id+' '+(e.id||k)+': '+JSON.stringify(p)+' vs '+JSON.stringify(q))})}return out})())"""))
        if ex: raise Exception('edge exits: ' + '; '.join(ex[:4]))
        n_ex = pg.evaluate("Object.values(GD.scenes).reduce((n,sc)=>n+((sc.edgeExits||[]).length),0)")
        # the join table: every road's ends name an exit of their place (alpha 0.2: the names decide; tools/join-places.py on the legacy branch
        # moved exits so the two ends of a road face each other, so the old compass match no longer has a say)
        diff = json.loads(pg.evaluate("""JSON.stringify((()=>{const out=[];let joined=0;for(let n=0;n<ROUTE.length;n++){const sc=mapById(sceneIdAt(n));if(!sc||!(sc.exits||[]).length)continue;const a=sceneExits(n);for(const e of ADJ[n]){const L=LINKS[e.i],id=L[3]&&(L[0]===n?L[3].a:L[3].b);if(id&&(sc.edgeExits||[]).some(q=>q.id===id))joined++;else out.push(ROUTE[n].name+' -> '+ROUTE[e.to].name+': no exit named '+id);if(a[e.to]==null)out.push(ROUTE[n].name+' -> '+ROUTE[e.to].name+': no exit')}}return {out,joined}})())"""))
        if diff['out']: raise Exception('join table: ' + '; '.join(diff['out'][:4]))
        out.append(f'{n_ex} edge-relative exits, {diff["joined"]} road ends joined by name')
        # a resize keeps exits on their edge: grow a copy of Tallgrass Meadow by 6 m each way, then shrink it back
        r = json.loads(pg.evaluate("""JSON.stringify((()=>{const sc=JSON.parse(JSON.stringify(mapById('longgrass')));delete sc._exk;const before=sc.exits.map(p=>p.slice());sc.w+=6;sc.h+=6;syncExits(sc);const after=sc.exits;
         const ok=sc.edgeExits.every((e,k)=>{const p=after[k],q=before[k],n=e.in==null?1.1:e.in;return e.side==='N'?Math.abs(p[1]-(sc.h-n))<.02:e.side==='S'?Math.abs(p[1]-n)<.02:e.side==='E'?Math.abs(p[0]-(sc.w-n))<.02:Math.abs(p[0]-n)<.02});return {ok,before,after,E:sc.edgeExits}})())"""))
        if not r['ok']: raise Exception(f'after a resize the exits left their edge: {r}')
        out.append('a resized scene keeps its exits on their edges')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    v42()

    @step('v43: the seamless world, flags, voxel props, the new light', 240)
    def v43():
        out = []
        # every road composes at both ends and in the middle: no cut tiles, offsets on whole metres, sizes the card can hold
        r = json.loads(pg.evaluate("""JSON.stringify((()=>{const out=[];let n=0,mx=0;for(let i=0;i<LINKS.length;i++){const R=seamlessRoad(i);if(!R){out.push('link '+i+': no road');continue}
         for(const u of [0,R.Lr/2,R.Lr]){const v=seamlessViewFor(R,u),sc=seamlessViewMap(v,R);n++;mx=Math.max(mx,sc.w,sc.h);if((sc.w+16)*8>4096||(sc.h+16)*8>4096)out.push(v.id+': '+sc.w+'x'+sc.h+' is too big for its distant ground picture');/* v46: the near ring paints the full size round you */
          if(sc.tiles.length!==sc.h||sc.tiles.some(r=>r.length!==sc.w))out.push(v.id+': ragged tiles');if(!(sc.props||[]).length)out.push(v.id+': no props');
          for(const P of sc.parts)if(!P.road&&(P.ox%1||P.oz%1))out.push(v.id+': '+P.id+' off the metre grid')}
         const a=seamlessViewMap(seamlessViewFor(R,0,'a'),R),b=seamlessViewMap(seamlessViewFor(R,0,'b'),R);const pa=a.parts.find(p=>p.id===R.aId),pb=b.parts.find(p=>p.id===R.bId);
         const A=mapById(R.aId),B=mapById(R.bId);for(let j=0;j<4;j++){/* alpha 0.2: away from the edges, where two places' grounds mingle */let i0=Math.floor(A.w/4*j)+4,z0=Math.floor(A.h/3)+1;if(a.tiles[a.h-1-(z0+pa.oz)][i0+pa.ox]!==A.tiles[A.h-1-z0][i0])out.push(a.id+': scene tiles don’t match');i0=Math.floor(B.w/4*j)+4;z0=Math.floor(B.h/3)+1;/* v46: B's own size */if(b.tiles[b.h-1-(z0+pb.oz)][i0+pb.ox]!==B.tiles[B.h-1-z0][i0])out.push(b.id+': scene tiles don’t match')}}
         return {out:out.slice(0,6),n,mx}})())"""))
        if r['out']: raise Exception('roads: ' + '; '.join(r['out']))
        out.append(f'{r["n"]} road views composed for {pg.evaluate("LINKS.length")} roads, the biggest {r["mx"]} m, scene tiles carried over exactly')
        # a trip seen on the ground: leave Marigold Town, cross the road, arrive at Tallgrass Meadow without a remount
        go_scene(pg, 0); pg.evaluate("(()=>{const h=mapHub(mapById('sundown'));U.roam={id:'sundown',node:0,x:h[0],z:h[1]}})();render();0")   # alpha 0.2: places grew; start at the hub
        if not until(pg, "walkView.id==='w:sundown*'&&walkView.ready", 30): raise Exception('Marigold Town is not shown with its roads (' + pg.evaluate('walkView.id') + ')')   # v46: a place is always shown with the first stretch of its roads
        pg.evaluate("S.queue=[];setTrip(1);render();0"); time.sleep(1); ids = []
        per = pg.evaluate("Math.ceil(linkCost(0,1)/6)+5")   # alpha 0.2: a road's steps follow its walk
        for n in range(6):
            pg.evaluate(f"addSteps({per},true);U.modal=null;U.mq=[];renderOv();render();0"); time.sleep(2.5); ids.append(pg.evaluate("walkView.id"))
            if pg.evaluate("!walkView.ready"): raise Exception('the view went unready mid-road (a remount instead of a shift)')
        if not until(pg, "S.route.node===1&&S.route.prog===0&&walkView.id.startsWith('w:longgrass')", 20): raise Exception(f'the walk to Tallgrass Meadow did not end on its ground ({ids})')
        shot(pg, 'v43-road')
        views = [i for k, i in enumerate(ids) if k == 0 or ids[k - 1] != i]
        out.append('walked Marigold Town → Tallgrass Meadow on the ground: ' + ' → '.join(views + [pg.evaluate("walkView.id")]))
        # the flags: only towns have one; a flag pole flies its town's and is rigid
        fl = json.loads(pg.evaluate("JSON.stringify({towns:GD.scenery.flags,pole:GD.scenery.props.flag_pole,ridge:(GD.scenes.ridge.props||[]).filter(p=>p.k==='flag_pole').length,path:flagPicturePath(GD.scenes.sundown),pathRoute:flagPicturePath(GD.scenes.longgrass)})"))
        for t in fl['towns'] + ['default']:
            if not (ROOT / 'game' / 'art' / 'scene' / 'flags' / (t + '.png')).exists(): raise Exception(f'no flag picture for {t}')
        if fl['pole']['sway'] or not fl['pole'].get('flag') or fl['ridge'] or fl['path'] != 'scene/flags/sundown.png' or fl['pathRoute'] != 'scene/flags/default.png': raise Exception(f'flags: {fl}')
        out.append(f'{len(fl["towns"])} town flags, poles rigid with a waving cloth, routes fly the coin ring')
        # wind: every plant sways
        still = json.loads(pg.evaluate("JSON.stringify(Object.entries(walkData().sc.props).filter(([k,M])=>/^(tree|bush|flower|tulip|daisy|fern|reed|cattail|grass|tallgrass|lavender|heather|sedge|bracken|nettle|iris|bulrush)/.test(k)&&!M.flat&&!/fallen|stump|log/.test(k)&&!(M.sway>0)).map(([k])=>k))"))
        if still: raise Exception('plants that never sway: ' + ', '.join(still[:8]))
        w = pg.evaluate("[windLeanAt(10,10,0,walkView.sc,1),windLeanAt(10,10,900,walkView.sc,1)]")
        if abs(w[0] - w[1]) < .005: raise Exception(f'the wind does not move: {w}')
        out.append('every plant sways; the encounter grass takes the wind')
        # voxel props: recipes resolve, meshes build, a few draw
        vx = json.loads(pg.evaluate("""JSON.stringify((()=>{const C=walkData().sc.props,keys=Object.keys(C).filter(k=>C[k].vox);const out={n:keys.length,built:0,empty:[],drawn:propModelState.drawn};
         for(const k of keys.slice(0,12)){const spec=C[k].vox,rec=typeof spec==='object'?spec:propModelState.recipes.get(spec);if(!rec){voxRecipe(spec);continue}const m=greedyVoxelMesh(voxelise(rec),rec.vpm||8);if(m&&m.n>0)out.built++;else out.empty.push(k)}return out})())"""))
        if vx['n'] < 30: raise Exception(f'{vx["n"]} props with a voxel recipe (want 30+)')
        if vx['empty']: raise Exception('empty voxel models: ' + ', '.join(vx['empty']))
        out.append(f'{vx["n"]} props with a voxel recipe, {vx["built"]} of 12 meshed on the spot, {vx["drawn"]} drawn last frame')
        # the light: SH ambient, cascades, lamp maps, god rays all on and running without errors
        lt = json.loads(pg.evaluate("JSON.stringify({sh:!!(walkRenderer.X&&walkRenderer.X.sh),cas:!!(walkRenderer.lastShadow&&walkRenderer.lastShadow.far),vol:!!EGL.fb.vol1,ao:eng('shadows','aoKind')})"))
        if not (lt['sh'] and lt['cas']): raise Exception(f'light: {lt}')
        go_scene(pg, 0); pg.evaluate("environment.force={time:22,weather:'clear',season:'summer'};0"); time.sleep(4); until(pg, "(walkRenderer.X&&walkRenderer.X.lampSh||[]).length>0", 20)
        lamps = pg.evaluate("(walkRenderer.X&&walkRenderer.X.lampSh||[]).length"); shot(pg, 'v43-night'); pg.evaluate("environment.force=null;0")
        if not lamps: raise Exception('no lamp shadow map at night in Marigold Town ' + pg.evaluate("JSON.stringify({id:walkView.id,pl:[walkView.pl.x,walkView.pl.z],n:(walkRenderer.X&&walkRenderer.X.lights||[]).length,night:environment.night,force:environment.force,dark:walkRenderer.dark,bt:!!walkRenderer.bt,q:eng('shadows','lampShadows'),near:(walkRenderer.X&&walkRenderer.X.lights||[]).slice(0,3).map(l=>[l.p.map(v=>+v.toFixed(1)),l.r])})"))
        out.append(f'sky-shaped ambient, two shadow cascades, god rays {"on" if lt["vol"] else "off"}, {lt["ao"]} occlusion, {lamps} lamp shadow map(s) at night')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    v43()

    @step('v44: the light lab — the land, a room, props, the air, the night', 300)
    def v44():
        """the four light test scenes (tools/build-test-scenes.py) are opened and measured on the picture itself:
        the ground normal map changes the picture, the sun-facing slope is brighter, a block throws a shadow that darkens
        the ground, every kind of prop draws, a room has daylight from its window and lamp pools after dark, the god rays
        add light in a misty wood, and no draw call is refused by WebGL"""
        from PIL import Image
        out = []
        def bench(id, t, x=None, z=None, yaw=0, js='0'):
            pg.evaluate(f"environment.force={{time:{t},weather:'clear',season:'summer'}};U.modal=null;U.mq=[];U.toastQ=[];renderOv();U.tab='walk';U.bench={{id:'{id}',test:1}};render();0")   # v46: no window from an earlier step over the picture
            if not until(pg, f"!!(walkView.ready&&walkView.id==='{id}')", 40): raise Exception(f'{id} didn’t open')
            f0 = pg.evaluate("walkRenderer.frames"); until(pg, f'walkRenderer.frames>={f0 + 6}', 30); time.sleep(1)
            if x is not None: pg.evaluate(f"walkView.pl.x={x};walkView.pl.z={z};walkView.pl.route=null;walkRenderer.yawT={yaw};0")
            # v47: wait for frames, not a fixed time: the camera eases to where you stand and the shadow map follows it
            # a few frames later (a slow machine with many places visited draws a frame a second or less)
            pg.evaluate(js); f1 = pg.evaluate("walkRenderer.frames"); until(pg, f'walkRenderer.frames>={f1 + 8}', 60); time.sleep(.5)
        def picture():
            pg.evaluate("U.modal=null;U.mq=[];renderOv();document.body.classList.add('photo');0"); time.sleep(.4)
            im = Image.open(io.BytesIO(pg.screenshot())).convert('RGB'); pg.evaluate("document.body.classList.remove('photo');0"); return im
        def lum(im, pts, r=6):
            """mean brightness (0-255) of the picture round each world point (x, y, z), projected with the frame's camera"""
            P = pg.evaluate(f"(()=>{{const C=walkView.C,m=C.vp,W=C.rw,H=C.rh;return {json.dumps(pts)}.map(([x,y,z])=>{{const X=m[0]*x+m[4]*y+m[8]*z+m[12],Y=m[1]*x+m[5]*y+m[9]*z+m[13],Wc=m[3]*x+m[7]*y+m[11]*z+m[15];return [(X/Wc*.5+.5)*W,(1-(Y/Wc*.5+.5))*H]}})}})()")
            sx, sy = im.width / pg.evaluate("walkView.C.rw"), im.height / pg.evaluate("walkView.C.rh"); res = []
            for X, Y in P:
                X, Y = X * sx, Y * sy
                if not (r < X < im.width - r and r < Y < im.height - r): res.append(None); continue
                c = pixels(im.crop((int(X - r), int(Y - r), int(X + r), int(Y + r)))); res.append(sum(.3 * p[0] + .59 * p[1] + .11 * p[2] for p in c) / len(c))
            return res
        # GL draw calls that WebGL refuses (a sampler fed the wrong kind of texture) show as nothing drawn; count them
        pg.evaluate("""(()=>{const gl=EGL.gl;if(gl.__chk)return;gl.__chk={n:0,last:''};const proto=Object.getPrototypeOf(gl),ge=proto.getError;let cur=null;const ou=proto.useProgram;gl.useProgram=function(p){cur=p;return ou.call(gl,p)};
         for(const k of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){const f=proto[k];gl[k]=function(...a){const r=f.apply(gl,a);const e=ge.call(gl);if(e){gl.__chk.n++;gl.__chk.last=k+' '+e+' '+(Object.keys(EGL.P).find(n=>EGL.P[n].p===cur)||'?')}return r}}})()""")
        unwrap = "(()=>{const gl=EGL.gl;for(const k of ['useProgram','drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced'])delete gl[k];delete gl.__chk})()"   # the error check after every draw stalls software drawing: only for this step
        try:
            # 1. the land: the normal map, the slope toward the sun, the shadow of a block (the sun in the west at 17:00)
            bench('test_light_terrain', 17, 30, 11, 0); lab = pg.evaluate("walkView.sc.lab"); im1 = picture()
            pg.evaluate("ENGINE_DEFAULTS.world.groundBumps=0;0"); time.sleep(2); im0 = picture(); pg.evaluate("ENGINE_DEFAULTS.world.groundBumps=1;0")
            from PIL import ImageChops
            d = pixels(ImageChops.difference(im1, im0)); bump = sum(sum(p) for p in d) / (3 * len(d))
            if bump < .6: raise Exception(f'the ground normal map changes the picture by only {bump:.2f}/255 (not in use?)')
            rx, z0, z1 = lab['ridge']; zz = 16
            hy = lambda x, z: pg.evaluate(f"standingHeightAt({x},{z})")
            west, east, top = lum(im1, [[rx - 2.4, hy(rx - 2.4, zz), zz], [rx + 2.4, hy(rx + 2.4, zz), zz], [rx, hy(rx, zz), zz]])
            if west is None or east is None or west < east * 1.1: raise Exception(f'the slope facing the sun is not brighter: west {west and round(west)}, east {east and round(east)}, top {top and round(top)}')
            bench('test_light_terrain', 17, 9, 17, 0); im2 = picture(); bx0, bz0, bx1, bz1, bh = lab['block']
            # the shadow runs east and away from the block (the sun is west and in front): the darkest of a few spots just
            # east of it against the brightest of the same spots 7 m further east
            zs = [bz0 + 1.5, bz0 + 2.5, bz0 + 3.5]
            near = [v for v in lum(im2, [[bx1 + 1, hy(bx1 + 1, z), z] for z in zs], 4) if v is not None]; far = [v for v in lum(im2, [[bx1 + 7, hy(bx1 + 7, z), z] for z in zs], 4) if v is not None]
            if not near or not far: raise Exception('the block’s shadow is off screen')
            shade, lit = min(near), max(far)
            if shade > lit * .85: raise Exception(f'the block’s shadow does not darken the ground: in it {round(shade)}, beside it {round(lit)}')
            out.append(f'land: bumps change the picture by {bump:.1f}/255, the sunward slope is {west / east:.2f}× the far one, the block’s shadow {100 - 100 * shade / lit:.0f}% darker')
            shot(pg, 'v44-land')
            # 2. props: every kind draws (pictures, solids, voxels, buildings) and no draw is refused
            bench('test_light_props', 16, 20, 7, 0); time.sleep(1)
            c = json.loads(pg.evaluate("JSON.stringify({bld:BLD.drawn,vox:propModelState.drawn,p3d:P3D.drawn,spr:walkRenderer.sprN||null,placed:(walkView.sc.props||[]).length,fails:[BLD.fail,propModelState.fail,P3D.fail].filter(Boolean)})"))
            if c['fails']: raise Exception('renderers off: ' + ' | '.join(c['fails']))
            if c['bld'] < 3 or c['vox'] < 4 or c['p3d'] < 1: raise Exception(f'props scene: {c}')
            shot(pg, 'v44-props'); out.append(f'props: {c["bld"]} buildings, {c["vox"]} voxel props, {c["p3d"]} solid props drawn of {c["placed"]} placed')
            # 3. a room: daylight from the window makes a readable, not blown-out floor; after dark the lamps lay pools
            bench('test_light_room', 13, 7, 2.2, 0); im = picture(); fl = lab = pg.evaluate("walkView.sc.lab")
            floor = lum(im, [[x, 0, z] for x in (4, 7, 10) for z in (2.5, 4)])
            if any(v is None for v in floor): raise Exception('the room floor is off screen')
            if not (40 < min(floor) and max(floor) < 215): raise Exception(f'room floor brightness out of range: {[round(v) for v in floor]}')
            bench('test_light_room', 23, 7, 2.2, 0); im = picture(); L = lab['lamps']
            under = lum(im, [[L[0][0], 0, L[0][1] - 1.2], [L[1][0], 0, L[1][1] - 1.2]]); between = lum(im, [[7, 0, 2.2]])
            if None in under or between[0] is None or min(under) < between[0] * 1.08: raise Exception(f'no lamp pools after dark: under {[round(v) for v in under]}, between {round(between[0])}')
            shot(pg, 'v44-room'); out.append(f'room: floor {round(min(floor))}–{round(max(floor))}/255 by day, lamp pools {min(under) / between[0]:.2f}× the floor between them at night')
            # 4. the air: god rays add light in the wood (the sun low behind the trees)
            bench('test_light_air', 17.5, 18, 6, 0); imR = picture(); pg.evaluate("ENGINE_DEFAULTS.air.godRays=0;0"); time.sleep(2); imN = picture(); pg.evaluate("ENGINE_DEFAULTS.air.godRays=.5;0")
            d = pixels(ImageChops.difference(imR, imN)); rays = sum(sum(p) for p in d) / (3 * len(d)); shot(pg, 'v44-air')
            if rays < .3: raise Exception(f'the god rays change the picture by only {rays:.2f}/255')
            out.append(f'air: god rays add {rays:.1f}/255')
            # 5. the night: lamps lay pools on the ground
            bench('test_night', 23, 16, 1.5, 0); im = picture()   # standing back so your own lantern does not light the spots
            under = lum(im, [[13, 0, 8.2], [18.5, 0, 8.2]]); dark = lum(im, [[15.75, 0, 8.2]])     # lamps stand at x = 2 + 5.5 k, z = 9
            if None in under or dark[0] is None or max(under) < dark[0] * 1.1: raise Exception(f'night: no pools under the lamps: {under} vs {dark[0]} between')
            shot(pg, 'v44-night'); out.append(f'night: the ground under a lamp is {max(under) / dark[0]:.2f}× the ground between')
            chk = json.loads(pg.evaluate("JSON.stringify(EGL.gl.__chk)"))
        finally:   # v47: never leave the check on (a failure above used to): it stalls every later step's drawing
            pg.evaluate("(()=>{const gl=EGL.gl;if(!gl||!gl.__chk)return;for(const k of ['useProgram','drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced'])delete gl[k];delete gl.__chk})()")
        if chk['n']: raise Exception(f'{chk["n"]} draw calls refused by WebGL (last: {chk["last"]})')
        pg.evaluate("U.bench=null;environment.force=null;walkRenderer.yawT=0;render();0")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out) + '; no draw call refused'
    v44()

    @step('v46: the world update — ground kit, buildings and their colours, rooms that open in place', 300)
    def v46():
        """every ground kind has its 12 tiles; the new buildings and every colour variant load and have a 3D plan; each new
        kind of building has a room; walking into the shop lays the room into Marigold Town where the shop stands (its doorway
        exactly at the shop's door, the town dimmed around it, nowhere to walk but the floor) and walking out leaves you
        at the door with the shop back"""
        out = []
        tiles = json.loads(pg.evaluate("JSON.stringify(Object.values(walkData().sc.terrains).map(T=>bigTilePath(T.tile)))"))
        miss = [p for L in tiles for p in L if not (ROOT / 'game' / 'art' / p).exists()]
        short = [L[0] for L in tiles if len(L) < 12]
        if miss or short: raise Exception(f'ground tiles: {len(miss)} missing (e.g. {miss[:3]}), {len(short)} kinds with fewer than 12')
        out.append(f'{len(tiles)} ground kinds × 12 tiles')
        b = json.loads(pg.evaluate("""(()=>{const C=walkData().sc.props,K=['bakery','inn','market_hall','bank','library','school','fire_station','mansion','barn','greenhouse','ski_lodge'],imgs=[];let plans=0,vars=0;
          for(const [k,M] of Object.entries(C)){if(!M.build)continue;plans++;for(const v of M.build.variants||[]){vars++;imgs.push(v.img)}}
          return JSON.stringify({missing:K.filter(k=>!C[k]||!C[k].build),plans,vars,imgs,rooms:K.filter(k=>!GD.scenes['int_'+k]),v2:propWithVariant({v:2},C.bakery).img})})()"""))
        if b['missing'] or b['rooms']: raise Exception(f'buildings without a plan: {b["missing"]}; kinds without a room: {b["rooms"]}')
        if not b['v2'].endswith('bakery_v2.png'): raise Exception('a placed building’s colour (v) doesn’t pick its picture: ' + b['v2'])
        bad = pg.evaluate(f"Promise.all({json.dumps(b['imgs'])}.map(p=>artLoad([p]).then(()=>imageReady(artImage(p))?null:p).catch(()=>p))).then(L=>L.filter(Boolean))")
        if bad: raise Exception(f'{len(bad)} building colours don’t load: {bad[:3]}')
        out.append(f'{b["plans"]} buildings with 3D plans, {b["vars"]} colour variants load, a room for each new kind')
        # walk into the shop: the room opens in place
        pg.evaluate("U.inside=null;U.goingIn=null;U.bench=null;U.roomWait=900;U.modal=null;U.mq=[];renderOv();environment.force={time:13,weather:'clear',season:'summer'};0"); go_scene(pg, 0); time.sleep(2)
        pg.evaluate("(()=>{const p=walkView.sc.props.find(p=>p.act==='shop'&&p.k==='shop'),C=walkData().sc,g=actionSpot(p,C.props[p.k],C.ppu||34);window.__shop=[p.x,p.z];walkView.pl.route=null;walkView.pl.x=g[0]-2;walkView.pl.z=g[1]-1.5;walkPick({k:'act',p,act:'shop'})})();0")   # a couple of steps from the door (walking is slow here)
        t0 = time.time(); ok = False
        while time.time() - t0 < 90:
            pg.evaluate("walkRenderer.prepBoost=60;0")                                    # this machine draws a frame a second: let the room be prepared in big slices
            if pg.evaluate("!!(walkView.ready&&walkView.sc&&walkView.sc.roomOf==='int_shop'&&walkView.id.includes('#'))"): ok = True; break
            if pg.evaluate("!!(walkView.ready&&walkView.id==='int_shop')"): break
            time.sleep(1)
        if not ok: raise Exception('the shop’s room didn’t open in place (' + pg.evaluate("walkView.id") + '; ' + ' | '.join(pg.evaluate("NWLOG.ev.slice(-4).map(e=>e.msg)")) + ')')
        time.sleep(2); until(pg, "(roomDimming(walkView.sc)||{dim:0}).dim>.6", 15)   # alpha 0.1: the dimming fades in over the first frames drawn inside (slow here)
        r = json.loads(pg.evaluate("""JSON.stringify((()=>{const sc=walkView.sc,c=sc.roomCut,I=U.inside,RD=roomDimming(sc),n=navGrid(),N=NAV_CELLS_PER_M,R=sc.roomRect,blocked=(x,z)=>!!n.blk[Math.floor(z*N)*n.gw+Math.floor(x*N)];
          return {exit:[sc.exits[0][0]+c[0],sc.exits[0][1]+c[1]],door:I&&I.door,dim:RD?RD.dim:0,outBlocked:blocked(R[0]-2,R[1]+R[3]/2)&&blocked(R[0]+R[2]/2,R[1]-2),inFree:!blocked(R[0]+R[2]/2,R[1]+R[3]/2-1),shopGone:!sc.props.some(p=>p.act==='shop'&&p.k==='shop')}})())"""))
        shot(pg, 'v46-room-in-place')
        if not r['door'] or abs(r['exit'][0] - r['door'][0]) > .3 or abs(r['exit'][1] - r['door'][1]) > .7: raise Exception(f'the room’s doorway {r["exit"]} isn’t at the shop’s door {r["door"]}')
        if r['dim'] < .4: raise Exception(f'the town around the room isn’t dimmed ({r["dim"]:.2f})')
        if not r['outBlocked'] or not r['inFree']: raise Exception(f'walking: outside the room blocked {r["outBlocked"]}, the floor free {r["inFree"]}')
        if not r['shopGone']: raise Exception('the shop’s outside is still standing in its own room')
        out.append(f'shop room laid in at its door (doorway {r["exit"][0]:.1f}, door {r["door"][0]:.1f}), town dimmed {r["dim"]:.2f}')
        pg.evaluate("leaveRoom();0")
        if not until(pg, "walkView.ready&&!walkView.sc.roomRect&&walkView.id==='w:sundown*'", 30): raise Exception('walking out didn’t bring the town back (' + pg.evaluate("walkView.id") + ')')
        time.sleep(1.5); shot(pg, 'v46-room-out')
        back = pg.evaluate("(()=>{const d=U.roam;const s=walkView.sc.props.some(p=>p.act==='shop');return [Math.hypot(walkView.pl.x-window.__shop[0],walkView.pl.z-window.__shop[1]),s]})()")
        if back[0] > 3 or not back[1]: raise Exception(f'outside: {back[0]:.1f} m from the shop, shop standing {back[1]}')
        pg.evaluate("environment.force=null;U.roomWait=null;0")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out) + '; out again at the shop’s door'
    v46()

    @step('v47: the road east — places, gates, shop hours, the story to its end, the lore, room floors', 300)
    def v47():
        """every place can be reached from Marigold Town along the roads; every place of the seven regions has its song,
        mood, lore and (unless it is open water) a landmark standing in it, and every new town a shop and a clinic;
        Fanfare Fields opens with Marina's badge and the Rimefrost Caves with Carat's; shops close at night and open
        at noon, and each new town's shop opens; the Guide's Lore page shows the places you've been; beating Cass Flow
        gives the face clue, and Vinylla waits at the Inner Sun until she's beaten on the Spire, then plays the ending;
        no two rooms share a floor"""
        import collections
        out = []; D = gamedata(); RT = D['route']; rid = [r['id'] for r in RT]
        adj = collections.defaultdict(set)
        for L in D['links']: adj[L[0]].add(L[1]); adj[L[1]].add(L[0])
        for i, r in enumerate(RT):   # alpha 0.4: a glass lift joins two places too (Kelpport and Pearlantis)
            if r.get('lift') in rid: j = rid.index(r['lift']); adj[i].add(j); adj[j].add(i)
        seen = {0}; todo = [0]
        while todo:
            for m in adj[todo.pop()] - seen: seen.add(m); todo.append(m)
        cut = [rid[i] for i in range(len(RT)) if i not in seen]
        if cut: raise Exception(f'no road or lift reaches {", ".join(cut[:6])}')
        new = [r for r in RT if (D['scenes'].get(r.get('scene')) or {}).get('v47region')]
        if len(new) < 27: raise Exception(f'only {len(new)} places of the seven regions')
        C = D['scenery']['props']; LP = (D.get('lore') or {}).get('places') or {}; bad = []
        REST = {'bench_wood', 'bench_metal', 'bench', 'log', 'log_mossy', 'campfire', 'picnic', 'deck_chair'}
        for r in new:
            sc = D['scenes'][r['scene']]
            if (sc.get('mood') or r.get('mood')) not in (D.get('moods') or {}): bad.append(f'{r["id"]}: mood {r.get("mood")} unknown')
            if not (LP.get(r['id']) or {}).get('landmark'): bad.append(f'{r["id"]}: no lore')
            if not sc.get('ride') and not any((C.get(p['k']) or {}).get('landmark') for p in sc['props']): bad.append(f'{r["id"]}: no landmark stands in it')
            if sc.get('kind') == 'town' and (not {'shop', 'clinic'} <= {p.get('act') for p in sc['props']} or r.get('shop') not in (D.get('shops') or {})):
                bad.append(f'{r["id"]}: shop or clinic missing')
            if sc.get('kind') == 'town':
                rm = next((p.get('room') for p in sc['props'] if p.get('act') == 'shop'), None)
                if not rm or rm not in D['scenes'] or not any(q.get('act') == 'shop' for q in D['scenes'][rm]['props']): bad.append(f'{r["id"]}: its shop has no room of its own with a counter')
            if not any(p['k'] in REST for p in sc['props']): bad.append(f'{r["id"]}: nowhere to sit')
            if not sc.get('life'): bad.append(f'{r["id"]}: no animals')
        floors = collections.defaultdict(list)
        for sid, sc in D['scenes'].items():
            if sc.get('kind') == 'room' and '@' not in sid: floors[collections.Counter(''.join(sc['tiles'])).most_common(1)[0][0]].append(sid)
        bad += [f'rooms sharing a floor ({k}): {", ".join(v)}' for k, v in floors.items() if len(v) > 1]
        if bad: raise Exception('; '.join(bad[:6]))
        out.append(f'{len(RT)} places, all on the roads; {len(new)} new ones with mood, lore, landmark, somewhere to sit and animals, each new town’s shop a room of its own; {len(floors)} rooms, a floor each')
        keep = pg.evaluate("JSON.stringify({seats:S.seats,story:S.story,flags:S.flags,visited:S.visited,beaten:S.beaten||null})")
        try:
            g = pg.evaluate("""(()=>{const ix=id=>ROUTE.findIndex(r=>r.id===id),s0=S.seats,o={};
              S.seats=['oil','retail','peak'];o.festShut=!canEnter(ix('festival'));S.seats=[...S.seats,'haven'];o.festOpen=canEnter(ix('festival'));
              o.frozenShut=!canEnter(ix('frozen'));S.seats=[...S.seats,'bloom','vault','morel'];o.frozenStill=!canEnter(ix('frozen'));S.seats=[...S.seats,'carat'];o.frozenOpen=canEnter(ix('frozen'));
              S.seats=s0;o.songs=ROUTE.filter(r=>!r.music||!SONGS[r.music]).filter(r=>GD.scenes[r.scene]&&GD.scenes[r.scene].v47region).map(r=>r.id+':'+r.music);
              /* each new town's shop opens into its own room */
              o.rooms=ROUTE.filter(r=>GD.scenes[r.scene]&&GD.scenes[r.scene].v47region&&GD.scenes[r.scene].kind==='town').map(r=>{const p=GD.scenes[r.scene].props.find(p=>p.act==='shop');return [r.id,p&&roomFor('shop',p)]}).filter(([k,v])=>!v||!v.startsWith('int_')||['int_shop','int_bank','int_market_hall'].includes(v)).map(x=>x.join(' → '));return o})()""")
            if g['rooms']: raise Exception(f'new towns whose shop doesn’t open into a room of its own: {", ".join(g["rooms"])}')
            if g['songs']: raise Exception(f'places without a song of their own: {", ".join(g["songs"][:6])}')
            if not all(g[k] for k in ('festShut', 'festOpen', 'frozenShut', 'frozenStill', 'frozenOpen')): raise Exception(f'gates: {g}')
            out.append('every new place has its song; Fanfare Fields opens with Marina’s Water Badge, the Rimefrost Caves only with Carat’s, the last')
            # shop hours: closed at night, open at noon; then every new town's shop opens
            pg.evaluate("U.tab='team';render();environment.on=true;environment.force={time:23.5,weather:'clear',season:'summer'};PROP_CLOCK.t=0;0")
            night = pg.evaluate("isOpenNow('shop')")
            pg.evaluate("environment.force={time:12.5,weather:'clear',season:'summer'};PROP_CLOCK.t=0;0")
            noon = pg.evaluate("isOpenNow('shop')")
            if night or not noon: raise Exception(f'shop hours: open at 23:30 {night}, open at 12:30 {noon}')
            shops = [r['shop'] for r in new if r.get('shop')]; opened = []
            for sh in shops:
                pg.evaluate(f"U.modal=null;U.mq=[];openShop('{sh}');0"); time.sleep(.3)
                if pg.evaluate(f"!!(U.modal&&U.modal.shop==='{sh}')"): opened.append(sh)
                pg.evaluate("closeModal();0")
            if len(opened) != len(shops): raise Exception(f'shops that didn’t open: {sorted(set(shops) - set(opened))}')
            out.append(f'shops closed at 23:30, open at 12:30; {len(opened)} new shops open')
            # the Guide's Lore page shows the places you've been
            pg.evaluate("ROUTE.forEach((r,i)=>{S.visited[i]=1});U.tab='ledger';U.dex=null;U.guideTab='lore';U.loreSec='places';render();scrollTo(0,0);0")
            names = pg.evaluate("[...document.querySelectorAll('.lore .lore-card h3')].map(e=>e.textContent)")
            until(pg, "(m=>!!m&&getComputedStyle(m).opacity==='1')(document.querySelector('main.screen.s-ledger'))", 15)   # the screen fades in (slowly here)
            pg.evaluate("U.modal=null;U.mq=[];renderOv();0"); time.sleep(.6)                                   # an egg hatching or the like, not over the page
            shot(pg, 'v47-lore-places')
            gone = [r['name'] for r in new if r['name'] not in names]
            if gone: raise Exception(f'the Lore page doesn’t show {", ".join(gone[:5])}')
            out.append(f'the Lore page shows {len(names)} places')
            # the story: Cass Flow's clue, then Vinylla, hidden at the Inner Sun until she's beaten on the Spire, and the ending
            pg.evaluate("U.guideTab=null;U.tab='team';render();S.preferences.battleStage='classic';wipe=f=>f();Object.values(TRAINERS).forEach(T=>{if(T.intro)storyFlags()['met_'+T.id]=1});"
                        "['oil','retail','peak','haven','bloom','vault','morel','carat'].forEach(s=>{if(!S.seats.includes(s))S.seats.push(s)});delete S.flags.cass;delete S.flags.vinylla1;delete S.flags.vinylla2;S.team.forEach(m=>{m.hp=maxHp(m)});0")
            def beat(tid, pic=None):
                pg.evaluate(f"S.team.forEach(m=>{{m.hp=maxHp(m)}});startTrainer('{tid}',{{talked:true}});0")
                if wait_phase(pg, ('choose',), 90) != 'choose': raise Exception(f'{tid}: the battle never reached the move menu')
                pg.evaluate("B.over='win';stopTimers();endBattle();0")
                if not until(pg, '!!U.modal', 30): raise Exception(f'{tid}: no sheet after the win')
                seen = []; idle = 0; t_end = time.time() + 150; taps = 0
                while idle < 6 and len(seen) < 40:
                    if time.time() > t_end: raise Exception(f'{tid}: the talk and sheets after the win never ended ({taps} taps; sheets {seen}; talk {pg.evaluate("JSON.stringify({on:TALK.on,cur:!!TALK.cur})")})')
                    if pg.evaluate("!!(TALK.cur&&TALK.on)"): pg.evaluate("TALK.cur.tap();0"); idle = 0; taps += 1
                    elif pg.evaluate("!!U.modal"):
                        seen.append(pg.evaluate("String(U.modal.title||'')"))
                        if pic and pic[0] == seen[-1]: time.sleep(4); shot(pg, pic[1])     # the sheet slides in (slowly here)
                        pg.evaluate("(()=>{const b=U.modal.btns&&U.modal.btns[0];(b&&b.f||closeModal)()})();0"); idle = 0
                    else: idle += 1
                    time.sleep(.4)
                return seen
            beat('cass')
            if not pg.evaluate("!!storyFlags().metCass"): raise Exception('beating Cass Flow didn’t give the face clue (metCass)')
            inner = rid.index('innersun')
            hidden = pg.evaluate(f"!trainersAt({inner}).some(T=>T.id==='vinylla2')")
            pg.evaluate("S.flags.vinylla1=1;0")
            shown = pg.evaluate(f"trainersAt({inner}).some(T=>T.id==='vinylla2')")
            if not hidden or not shown: raise Exception(f'Vinylla at the Inner Sun: hidden before the Spire {hidden}, there after {shown}')
            E = pg.evaluate("(LORE().story||[]).find(s=>s.id==='ending').title")
            sheets = beat('vinylla2', (E, 'v47-ending'))
            st = pg.evaluate("[!!storyFlags().ending,loreStage()]")
            if not st[0] or st[1] != 9 or E not in sheets: raise Exception(f'the ending: flag {st[0]}, stage {st[1]}, sheets {sheets}')
            out.append(f'Cass Flow’s clue; Vinylla at the Inner Sun only after the Spire; the ending (“{E}”, stage 9)')
        finally:
            pg.evaluate(f"(o=>{{S.seats=o.seats;S.story=o.story;S.flags=o.flags;S.visited=o.visited;if(o.beaten)S.beaten=o.beaten;U.modal=null;U.mq=[];if(typeof TALK!=='undefined')TALK.on=false;environment.force=null;PROP_CLOCK.t=0;U.guideTab=null;U.tab='walk';renderOv();render()}})({keep});0")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    v47()

    @step('alpha 0.1: the new name, Billies and taxing, rooms with their building\'s windows', 240)
    def a01():
        """Pocket Billies on the page and the title; the Guide counts the Billies you've taxed and the battle has a Tax!
        button; every room of a town shows its building's windows (as many as the front has, double windows as one, in
        the same order) with no furniture in front of them; the library's four; the picture setting"""
        out = []
        t = pg.evaluate("[document.title,renderTitle().includes('<span>POCKET</span><span>BILLIES</span>')?'POCKET BILLIES':'',GD.meta.title]")
        if 'Pocket Billies' not in t[0] or 'POCKETBILLIES' not in t[1].replace(' ', '') or t[2] != 'Pocket Billies': raise Exception(f'the name: {t}')
        g = pg.evaluate("(()=>{U.tab='ledger';U.dex=null;U.guideTab='dex';render();const h=document.body.innerText;U.tab='walk';render();return [h.includes('Taxed'),h.includes('Caught')]})()")
        if not g[0] or g[1]: raise Exception(f'the Guide: Taxed shown {g[0]}, Caught still shown {g[1]}')
        out.append('Pocket Billies on the page, the title screen and in the data; the Guide counts Taxed')
        pg.evaluate("U.inside=null;U.goingIn=null;U.bench=null;U.modal=null;U.mq=[];renderOv();0"); go_scene(pg, 0); time.sleep(1)
        rows = pg.evaluate("""(()=>{const C=walkData().sc,ppu=C.ppu||34,out=[];for(const p of walkView.sc.props){const M=C.props[p.k];if(!M||!M.box||!p.act)continue;let id=null;try{id=roomFor(p.act,p)}catch(e){}if(!id||!mapById(id)||mapById(id).winMatch===0)continue;
          const s=p.s||1,f=p.f?-1:1,dx=((M.door&&M.door.x)||0)/ppu*s*f,door=[+(p.x+dx).toFixed(1),+(+p.z).toFixed(1),+(+p.x).toFixed(1)];seamlessWorld.cache.delete(seamlessRoomId(walkView.id,id,door)+'|'+seamlessWorld.gen);
          const sc=seamlessRoomMap(walkView.id,id,door);if(!sc)continue;const R=sc.roomRect,inR=q=>q.x>=R[0]&&q.x<=R[0]+R[2]&&q.z>=R[1]&&q.z<=R[1]+R[3],ws=sc.props.filter(q=>q.k==='wall_window'&&inR(q)).sort((a,b)=>a.x-b.x);
          const tan=Math.tan((((mapById(id).cam||{}).pitch||34)-3+12)*Math.PI/180),hid=ws.filter(w=>sc.props.some(q=>{if(q===w||!inR(q)||q.k==='wall_window')return false;const Q=C.props[q.k]||{};if(Q.flat)return false;const k=(q.s||1)/ppu,hw=-(Q.ox??-16)*k*.92,d=w.z-q.z;if(d<=.05)return false;
            return Math.min(q.x+hw,w.x+.75*w.s)-Math.max(q.x-hw,w.x-.75*w.s)>.3&&-(Q.oy??-32)*k-d*tan>1.3*w.s+.3}));
          out.push({k:p.k,room:id,front:seamlessBuildingWindows(M,p,ppu).length,inside:ws.length,hidden:hid.length})}return out})()""")
        if not rows: raise Exception('no building in Marigold Town opens into a room')
        hidden = [r for r in rows if r['hidden']]; none = [r for r in rows if r['front'] and not r['inside']]; more = [r for r in rows if r['inside'] > r['front']]
        if hidden: raise Exception(f'furniture in front of a room window: {hidden[:3]}')
        if none or more: raise Exception(f'rooms whose windows don’t match their building: no window {none[:3]}, more than the front {more[:3]}')
        same = sum(1 for r in rows if r['inside'] == r['front'])
        lib = next((r for r in rows if r['k'] == 'library'), None)
        if lib and lib['inside'] != 4: raise Exception(f'the library shows {lib["inside"]} of its 4 windows')
        out.append(f'{len(rows)} rooms in Marigold Town: {same} show exactly their front\'s windows, the rest join a double window into one; none behind furniture')
        # walk into the library: its four windows, a picture
        pg.evaluate("""(()=>{const p=walkView.sc.props.find(p=>p.k==='library'&&p.act),C=walkData().sc,g=actionSpot(p,C.props[p.k],C.ppu||34);walkView.pl.route=null;walkView.pl.x=g[0]-2;walkView.pl.z=g[1]-1.5;walkPick({k:'act',p,act:p.act})})();0""")
        t0 = time.time()
        while time.time() - t0 < 90:
            pg.evaluate("walkRenderer.prepBoost=60;0")
            if pg.evaluate("!!(walkView.ready&&walkView.sc&&walkView.sc.roomOf==='int_library')"): break
            time.sleep(1)
        else: raise Exception('the library’s room didn’t open in place')
        time.sleep(3); pg.evaluate("U.modal=null;U.mq=[];renderOv();0"); shot(pg, 'a01-library-windows')
        pg.evaluate("leaveRoom();0"); until(pg, "walkView.ready&&!walkView.sc.roomRect", 30)
        # the picture setting: Sharpest by default, and 90 frames a second survives a reload of the save
        a = pg.evaluate("(()=>{const o=S.preferences.fps;S.preferences.fps=90;const m=migrate(JSON.parse(JSON.stringify(S)));S.preferences.fps=o;return [m.preferences.fps,m.preferences.aim]})()")
        if a != [90, 'sharp']: raise Exception(f'preferences after loading: fps {a[0]} (90 wanted), aim {a[1]} (sharp wanted)')
        out.append('the library’s four windows; 90 frames a second kept, Sharpest by default')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    a01()

    @step('alpha 0.2: the ground — natural terraces leave walking as it was, nothing floats', 600)
    def a02_ground():
        """the land between metre corners is smooth and terraces of rock round off at the top and fan out at the foot:
        from every place's hub you reach exactly the same half-metre cells and exits as without that shaping, and no
        prop's base is more than 15 cm above the ground under its footprint (fences and the like follow the slope)"""
        R2 = pg.evaluate("""(()=>{const out=[],C=walkData().sc,keep=walkView.sc;
          const reach=sc=>{walkView.nav=null;walkView.navSc=null;const G=navGrid(),gw=G.gw,gh=G.gh,h=sc.hub||[sc.w/2,sc.h/2],s=nearestWalkableCell(h[0],h[1]);if(!s)return [0,0];const seen=new Uint8Array(gw*gh),Q=[s.j*gw+s.i];seen[Q[0]]=1;
            while(Q.length){const c=Q.pop(),i=c%gw,j=(c-i)/gw;for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){const ii=i+a,jj=j+b;if(ii<0||jj<0||ii>=gw||jj>=gh)continue;const q=jj*gw+ii;if(seen[q]||G.blk[q]||!canStepBetween(G,c,q))continue;seen[q]=1;Q.push(q)}}
            let n=0;for(const v of seen)n+=v;let ex=0;for(const e of sc.exits||[]){const c=nearestWalkableCell(e[0],e[1]);if(c&&seen[c.j*gw+c.i])ex++}return [n,ex]};
          for(const id of ROUTE.map(r=>r.scene).filter(Boolean)){const sc=mapById(id);if(!sc)continue;walkView.sc=sc;walkView.noShape=1;const a=reach(sc);walkView.noShape=0;const b=reach(sc);
            let fl=[];for(const p of sc.props||[]){const M=C.props[p.k];if(!M||M.flat||M.walk||M.build||M.door!=null||(typeof propShown==='function'&&!propShown(p)))continue;const g=(M.group||'')+' '+p.k;if(SLOPE_HUGGERS.test(g)&&!/tree|lamp|post|sign|pole/.test(g))continue;
              const s=p.s||1,y=propBaseHeight(p,M),lv=stepLevelAt(p.x,p.z);let pts;if(M.box){const bw=M.box[0]*s/2,bd=M.box[1]*s;pts=[[p.x-bw,p.z-.05],[p.x+bw,p.z-.05],[p.x-bw,p.z+bd],[p.x+bw,p.z+bd]]}else{const r=Math.min(.45,(M.shadow||0)*.3*s);if(r<.08)continue;pts=[[p.x-r,p.z],[p.x+r,p.z],[p.x,p.z-r*.6],[p.x,p.z+r*.6]]}
              let lo=1e9;for(const [x,z] of pts)if(Math.abs(stepLevelAt(x,z)-lv)<=.05)lo=Math.min(lo,standingHeightAt(x,z));if(lo<1e8&&y-lo>.15)fl.push(p.k+'@'+p.x.toFixed(1)+','+p.z.toFixed(1))}
            out.push({id,a,b,fl})}
          walkView.sc=keep;walkView.nav=null;walkView.navSc=null;return out})()""")
        moved = [f"{r['id']} ({r['a'][0]}→{r['b'][0]} cells, exits {r['a'][1]}→{r['b'][1]})" for r in R2 if r['a'] != r['b']]
        floating = [f"{r['id']}: {', '.join(r['fl'][:3])}" for r in R2 if r['fl']]
        if moved: raise Exception('shaped terraces change where you can walk: ' + '; '.join(moved[:5]))
        if floating: raise Exception('props in the air: ' + '; '.join(floating[:5]))
        bench_pic = "U.modal=null;U.mq=[];renderOv();U.tab='walk';U.bench={id:'pass',test:1};render();0"
        pg.evaluate("environment.force={time:12.5,weather:'clear',season:'summer'};" + bench_pic)
        if until(pg, "!!(walkView.ready&&walkView.id==='pass')", 60):
            f0 = pg.evaluate("walkRenderer.frames"); until(pg, f'walkRenderer.frames>={f0 + 6}', 30); pg.evaluate("(()=>{const g=mapById('pass').grown2||{};walkView.pl.x=69.5+(g.W||0);walkView.pl.z=25+(g.S||0);walkView.pl.route=null})();0")   # alpha 0.2: the pass grew
            f1 = pg.evaluate("walkRenderer.frames"); until(pg, f'walkRenderer.frames>={f1 + 8}', 60); time.sleep(.5); shot(pg, 'a02-terrace-pass')
        pg.evaluate("U.bench=null;environment.force=null;render();0")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return f'{len(R2)} places: the same cells and exits reachable with natural terraces as without, no prop more than 15 cm off the ground'
    a02_ground()
    a02_ground()

    @step('alpha 0.2: places joined edge to edge — every seam walks straight across and both views agree there', 600)
    def a02_joins():
        """every link's two places meet at their exits (no road between): each place's view holds it with a band of every
        neighbour; across each seam you walk straight (4 m in to 5 m out, in both places' views, unless the far side is
        water you can only cross riding); within 6 m of the exit both views show the same ground (heights to 5 cm,
        the same tiles) wherever both show the same place; underground places are a mountain from outside, rock all
        round from inside; every exit has the walk from its hub stored (the trips follow it)"""
        r = json.loads(pg.evaluate("""JSON.stringify((()=>{const out=[],keep=walkView.sc,keepId=walkView.id;let slow=0,slowId='',n=0;
          for(let k=0;k<ROUTE.length;k++){const t0=performance.now();let sc=null;try{sc=seamlessHubMap(k)}catch(e){out.push(ROUTE[k].scene+': '+e)}const ms=performance.now()-t0;if(ms>slow){slow=ms;slowId=ROUTE[k].scene}if(sc&&!sc.comp.joined&&ADJ[k].length)out.push(ROUTE[k].scene+': not joined')}/* alpha 0.4: a place reached only by a lift (Pearlantis) has no neighbour to join */
          const nav=sc=>{walkView.sc=sc;walkView.id=sc.id;walkView.nav=null;walkView.navSc=null;walkView.cand=null;return navGrid()};
          for(let i=0;i<LINKS.length;i++){const J=seamlessJoin(i);if(!J){out.push('link '+i+': not joined');continue}n++;
           for(const [vn,isA] of [[J.a,1],[J.b,0]]){const sc=seamlessHubMap(vn),o=sc.baseOff,d=SIDE_VECTORS[J.ea.side],p=isA?[J.ea.p[0]+o[0],J.ea.p[1]+o[1]]:[J.ea.p[0]+o[0]-J.off[0],J.ea.p[1]+o[1]-J.off[1]];
            const a=[p[0]-d[0]*4,p[1]-d[1]*4],b=[p[0]+d[0]*5.2,p[1]+d[1]*5.2],G=nav(sc),cb=Math.floor(b[1]*G.N)*G.gw+Math.floor(b[0]*G.N),ch=terrainAt(b[0],b[1]),ca=terrainAt(a[0],a[1]);
            if('wd'.includes(ch)&&!sc.ride||'wd'.includes(ca)&&!sc.ride)continue;const rt=findPath(a[0],a[1],b[0],b[1]);let L=0;if(rt)for(let q=1;q<rt.length;q++)L+=Math.hypot(rt[q][0]-rt[q-1][0],rt[q][1]-rt[q-1][1]);const e=rt&&rt[rt.length-1];
            if(!rt||Math.hypot(e[0]-b[0],e[1]-b[1])>.6||L>11.5)out.push(ROUTE[J.a].scene+' → '+ROUTE[J.b].scene+' in '+ROUTE[vn].scene+'’s view: '+(rt?L.toFixed(1)+' m to cross':'no way across'))}
           const A=seamlessHubMap(J.a),B=seamlessHubMap(J.b),oA=A.baseOff,oB=B.baseOff,e=J.ea.p;if(A.under!==B.under)continue;let dh=0,dt=0;
           const who=(sc,x,z)=>{x+=.5;z+=.5;/* the cell's middle */for(const r of sc.stable.scenes){const k=r.clip||[r.x,r.z,r.x+r.w,r.z+r.h];if(x>=k[0]&&z>=k[1]&&x<k[2]&&z<k[3])return r.id}return null};
           for(let dz=-6;dz<=6;dz++)for(let dx=-6;dx<=6;dx++){const ax=Math.round(e[0]+dx+oA[0]),az=Math.round(e[1]+dz+oA[1]),bx=Math.round(e[0]+dx-J.off[0]+oB[0]),bz=Math.round(e[1]+dz-J.off[1]+oB[1]);
            if(ax<0||az<0||ax>=A.w||az>=A.h||bx<0||bz<0||bx>=B.w||bz>=B.h)continue;const wa=who(A,ax,az);if(!wa||wa!==who(B,bx,bz))continue;
            /* a corner counts where all four cells round it show the same place in both views */const all=[[0,0],[-1,0],[0,-1],[-1,-1]].every(([u,v])=>{const p=who(A,ax+u,az+v);return p&&p===who(B,bx+u,bz+v)});
            if(all)dh=Math.max(dh,Math.abs(A.heights[A.h-az][ax]-B.heights[B.h-bz][bx]));if(A.tiles[A.h-1-az][ax]!==B.tiles[B.h-1-bz][bx])dt++}
           if(dh>.05||dt)out.push(ROUTE[J.a].scene+' / '+ROUTE[J.b].scene+': the two views differ near the exit ('+dh.toFixed(2)+' m, '+dt+' tiles)')}
          /* underground places */const und=ROUTE.map((r,k)=>ADJ[k].length?r.scene:null).filter(id=>id&&(GD.scenes[id]||{}).under);
          for(const id of und){const S=GD.scenes[id];if(!(S.arches||[]).length||!S.grown2)out.push(id+': underground without tunnels');const k=ROUTE.findIndex(r=>r.scene===id),v=seamlessHubMap(k);if(!v.under)out.push(id+': its view isn’t underground');
           for(const e of ADJ[k]){const w=seamlessHubMap(e.to);if(w.under)continue;const P=w.parts.find(q=>q.id===id);if(!P)continue;const g=S.grown2,cx=P.ox+(g.W||0)+(S.w-(g.W||0)-(g.E||0))/2,cz=P.oz+(g.S||0)+(S.h-(g.S||0)-(g.N||0))/2;
            const c=(w.stable.scenes.find(r=>r.id===id)||{}).clip;if(!c)continue;/* the point of the cave nearest the middle of the band: under rock */const px=clamp(cx,c[0]+.5,c[2]-.5),pz=clamp(cz,c[1]+.5,c[3]-.5);
            if(px>=P.ox+(g.W||0)&&px<P.ox+S.w-(g.E||0)&&pz>=P.oz+(g.S||0)&&pz<P.oz+S.h-(g.N||0)){const t=w.tiles[w.h-1-Math.floor(pz)][Math.floor(px)];if(!'rMP'.includes(t))out.push(ROUTE[e.to].scene+' sees into '+id+'’s cave ('+t+')')}}}
          let walks=0;for(const r of ROUTE){const S=GD.scenes[r.scene];for(const e of (S&&S.edgeExits)||[]){if(!(e.path&&e.path.length>1&&e.len>0))out.push(r.scene+' '+e.id+': no stored walk');else walks++}}
          walkView.sc=keep;walkView.id=keepId;walkView.nav=null;walkView.navSc=null;walkView.cand=null;return {out:out.slice(0,8),n,slow:Math.round(slow),slowId,walks,und}})())"""))
        if r['out']: raise Exception('; '.join(r['out']))
        return f"{r['n']} links joined edge to edge, every seam crossed straight in both views and the views agree round each exit; {r['walks']} exits with their walk stored; underground: {', '.join(r['und']) or 'none'}; the slowest view built in {r['slow']} ms ({r['slowId']})"
    a02_joins()

    @step('alpha 0.4: Copperleaf — Granny Juniper in her garden, the lab, the lane down to Marigold Town', 240)
    def a04_copperleaf():
        """the new start drawn: Granny Juniper stands by her hives and talks (her first words, then a line), the lab's
        door opens the lab, and a trip from Copperleaf down Route 1 arrives in Marigold Town"""
        if not pg.evaluate("typeof personTalk==='function'&&!!PLACE.copperleaf"): return 'not in this build'
        out = []; node = pg.evaluate("PLACE.copperleaf.node")
        pg.evaluate("U.inside=null;U.goingIn=null;U.bench=null;U.modal=null;U.mq=[];renderOv();environment.force={time:11,weather:'clear',season:'summer'};S.story=S.story||{};delete S.story.met_juniper;0")
        go_scene(pg, node); time.sleep(2)
        j = pg.evaluate("(()=>{const p=walkView.npcAt['_talk:juniper'];return p?[+p[0].toFixed(1),+p[1].toFixed(1)]:null})()")
        if not j: raise Exception('Granny Juniper isn’t standing in Copperleaf')
        shot(pg, 'a04-copperleaf')
        pg.evaluate("personTalk(walkState().npcs.find(n=>n.id==='_talk:juniper').talk);0")
        if not until(pg, '!!TALK.cur', 15): raise Exception('Granny Juniper didn’t say anything')
        first = pg.evaluate("TALK.cur&&TALK.cur.text||''")
        until(pg, '!TALK.on', 40, 'TALK.cur&&TALK.cur.tap()')
        if not pg.evaluate("!!storyFlags().met_juniper"): raise Exception('talking to Granny Juniper didn’t count as meeting her')
        out.append(f'Granny Juniper at {j}, she said “{first[:40]}…”')
        pg.evaluate("U.toastQ=[];(()=>{const p=walkView.sc.props.find(p=>p.act==='lab'),C=walkData().sc,g=actionSpot(p,C.props[p.k],C.ppu||34);walkView.pl.route=null;walkView.pl.x=g[0];walkView.pl.z=g[1];walkPick({k:'act',p,act:'lab'})})();0")
        if not until(pg, "walkView.ready&&(walkView.id==='int_lab'||(walkView.sc&&walkView.sc.roomOf==='int_lab'))||TALK.on", 60): raise Exception('the lab didn’t open')
        pg.evaluate("talkHide&&talkHide();if(U.inside)leaveRoom();0"); until(pg, "walkView.ready&&!walkView.sc.roomRect", 30)
        out.append('the lab opens')
        # down Route 1 to Marigold Town, on foot
        pg.evaluate(f"S.route={{node:{node},prog:0,plan:[PLACE.hedgerow.node,PLACE.sundown.node],hold:false}};U.roam=null;render();0")
        cost = pg.evaluate(f"linkCost({node},PLACE.hedgerow.node)+linkCost(PLACE.hedgerow.node,PLACE.sundown.node)")
        pg.evaluate(f"addSteps({cost + 10},true);render();0"); time.sleep(1)
        at = pg.evaluate("ROUTE[S.route.node].id")
        if at != 'sundown': raise Exception(f'the trip down Route 1 ended at {at}')
        out.append(f'Copperleaf to Marigold Town is {cost} steps on foot')
        pg.evaluate("environment.force=null;U.modal=null;U.mq=[];renderOv();0")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    a04_copperleaf()

    @step('alpha 0.4: airships — fly from Copperleaf to Marigold Town over the map, the propellers turning', 240)
    def a04_airships():
        """the mast's airship draws as a low-poly model, painted with the buildings' 32 px textures, its propellers turning; the mast's list holds the towns you've
        been to; a ticket is paid, the flight crosses the map, and you land by the next town's mast"""
        if not pg.evaluate("typeof flyMenu==='function'&&!!PLACE.copperleaf"): return 'not in this build'
        out = []; cl = pg.evaluate("PLACE.copperleaf.node"); sd = pg.evaluate("PLACE.sundown.node")
        pg.evaluate(f"U.inside=null;U.bench=null;U.modal=null;U.mq=[];renderOv();environment.force={{time:11,weather:'clear',season:'summer'}};S.visited[{sd}]=1;S.se=Math.max(S.se,2000);0")
        go_scene(pg, cl); time.sleep(1)
        pg.evaluate("(()=>{const p=walkView.sc.props.find(p=>p.act==='fly');walkView.pl.route=null;walkView.pl.x=p.x+2.2;walkView.pl.z=p.z-1.6})();0")
        until(pg, "propModelState.meshes.has('scene/models/airship.json')&&!!propModelState.meshes.get('scene/models/airship.json')", 60); time.sleep(2)
        v = pg.evaluate("(()=>{const m=propModelState.meshes.get('scene/models/airship.json');return m?{spins:(m.spins||[]).length,model:!!m.model,tris:m.n/3,drawn:propModelState.drawn}:null})()")
        if not v or not v['model'] or v['spins'] != 2: raise Exception(f'the airship isn’t drawn as a low-poly model with two turning propellers: {v}')
        shot(pg, 'a04-airship-mast')
        out.append(f'the airship drawn as a low-poly model ({v["tris"]:.0f} triangles, the buildings’ textures), {v["spins"]} propellers turning')
        pg.evaluate("flyMenu(walkView.sc.props.find(p=>p.act==='fly'));0")
        rows = pg.evaluate("[...document.querySelectorAll('[data-a=flyto]')].map(b=>+b.dataset.n)")
        if sd not in rows: raise Exception(f'Marigold Town isn’t on the mast’s list: {rows}')
        se0 = pg.evaluate("S.se"); fare = pg.evaluate(f"flyFare({cl},{sd})")
        pg.evaluate(f"document.querySelector('[data-a=flyto][data-n=\"{sd}\"]').click();0")
        if not until(pg, "airshipFlight.on&&U.tab==='map'", 10): raise Exception('the flight didn’t start')
        time.sleep(2.5); shot(pg, 'a04-airship-flight')
        if not until(pg, "!airshipFlight.on&&U.tab==='walk'", 30, "flySkip()"): raise Exception('the flight never landed')
        r = pg.evaluate("[ROUTE[S.route.node].id,S.se]")
        if r[0] != 'sundown' or se0 - r[1] != fare: raise Exception(f'landed at {r[0]}, paid {se0 - r[1]} (the fare is {fare})')
        if not until(pg, f"!!(walkView.ready&&(walkView.sc.baseId||walkView.id)===ROUTE[{sd}].scene)", 60): raise Exception('Marigold Town didn’t open after landing')
        time.sleep(1.5); d = pg.evaluate("(()=>{const sc=walkView.sc,o=sc.baseOff||[0,0],p=mapById(baseMapId()).props.find(p=>p.act==='fly');return Math.hypot(walkView.pl.x-p.x-o[0],walkView.pl.z-p.z-o[1])})()")
        if d > 5: raise Exception(f'you landed {d:.1f} m from the mast')
        out.append(f'flew to Marigold Town for ${fare}, landed {d:.1f} m from its mast')
        pg.evaluate("environment.force=null;0")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    a04_airships()

    @step('alpha 0.4: props made of shapes are low-poly with the 32 px textures (voxels one to a pixel when switched)', 120)
    def a04_props():
        """every voxel recipe of shapes builds as a low-poly model painted from the building sheet, and as voxels at the
        art's scale (32 to the metre) when "Props as low-poly" is off; both within a budget a phone can carry; in the
        every-prop scene they draw as models"""
        if not pg.evaluate("typeof lowPolyFromRecipe==='function'"): return 'not in this build'
        pg.evaluate("window.__P=Object.entries(GD.scenery.props).filter(([k,M])=>typeof M.vox==='string').map(([k,M])=>M.vox);__P.forEach(p=>voxRecipe(p));0")
        until(pg, "__P.every(p=>propModelState.recipes.get(p))", 30)
        r = pg.evaluate("""(()=>{let n=0,lp=0,q=0,bad=[];for(const p of __P){const rec=propModelState.recipes.get(p);if(!rec||rec.kind==='mesh')continue;n++;
          const L=lowPolyFromRecipe(rec),V=greedyVoxelMesh(voxelise(rec,32),32);if(!L||!V){bad.push(p.split('/').pop());continue}lp+=L.tris;q+=V.quads}return {n,lp,q,bad,on:!!eng('world','voxelLowPoly'),res:propModelState.VPM}})()""")
        if r['bad']: raise Exception(f'these recipes make nothing: {r["bad"][:6]}')
        if not r['on']: raise Exception('props aren’t low-poly by default')
        if r['res'] != 32: raise Exception(f'voxels are {r["res"]} to the metre, not 32')
        if r['lp'] > 15000 or r['q'] > 40000: raise Exception(f'too heavy: {r["lp"]} low-poly triangles, {r["q"]} voxel quads')
        pg.evaluate("U.modal=null;U.mq=[];renderOv();U.tab='walk';U.inside=null;U.bench={id:'test_props',test:1};render();0")
        until(pg, "!!(walkView.ready&&walkView.id==='test_props')", 60); pg.evaluate("walkView.pl.x=12;walkView.pl.z=21;walkView.pl.route=null;0"); time.sleep(3)
        m = pg.evaluate("(()=>{const v=[...VOX.meshes.values()].filter(Boolean);return {lp:v.filter(m=>m.lowpoly).length,vox:v.filter(m=>!m.model).length,drawn:propModelState.drawn}})()")
        if not m['lp'] or m['vox']: raise Exception(f'the every-prop scene drew {m["lp"]} low-poly props and {m["vox"]} voxel ones')
        shot(pg, 'a04-props-lowpoly')
        pg.evaluate("U.bench=null;render();0")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return f'{r["n"]} recipes: {r["lp"]} triangles low-poly, {r["q"]} quads as voxels at 32 to the metre; the every-prop scene draws {m["lp"]} as low-poly models'
    a04_props()

    @step('alpha 0.4: postcards — the first visit brings the card, the Guide keeps it', 90)
    def a04_postcards():
        """walking into a town you haven't had the postcard of: it slides in with the town's picture and is kept in the
        Guide's Postcards page (it slides away by itself or on a tap); coming back shows just the stamp"""
        if not pg.evaluate("typeof postcardCheck==='function'"): return 'not in this build'
        sd = pg.evaluate("PLACE.sundown.node")
        # alpha 0.5: no postcard before Blake's first battle (pcFree); the checks skip the opening, so mark it as played
        pg.evaluate("U.modal=null;U.mq=[];renderOv();U.bench=null;S.cards={};PC.last=null;PC.on=false;Object.assign(storyFlags(),{rival0:'win',met_blake0:1});0")
        go_scene(pg, sd)
        if not until(pg, "!!document.querySelector('.pcard-wrap.in')", 12, "postcardCheck()"): raise Exception('no postcard came on walking into Marigold Town')
        time.sleep(1.2)
        ok = pg.evaluate("(()=>{const im=document.querySelector('.pcard-wrap img');return !!(im&&im.complete&&im.naturalWidth>100)})()")
        if not ok: raise Exception('the postcard’s picture didn’t load')
        shot(pg, 'a04-postcard')
        pg.evaluate("(()=>{const w=document.querySelector('.pcard-wrap');if(w)w.click()})();0"); time.sleep(.8)   # it may have slid away by itself (9 s)
        got = pg.evaluate("Object.keys(S.cards||{})")
        if got != ['sundown']: raise Exception(f'the Guide keeps {got}')
        pg.evaluate("U.tab='ledger';U.guideTab='cards';render();0"); time.sleep(.6)
        n = pg.evaluate("document.querySelectorAll('.pc-thumb:not(.none)').length")
        if n != 1: raise Exception(f'the Postcards page shows {n} cards')
        shot(pg, 'a04-postcards-page')
        pg.evaluate("U.guideTab='dex';U.tab='walk';render();PC.last=null;0")
        if not until(pg, "!!document.querySelector('.pc-mini')", 10, "postcardCheck()"): raise Exception('coming back showed no stamp')
        if pg.evaluate("!!document.querySelector('.pcard-wrap')"): raise Exception('coming back showed the big card again')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return 'Marigold Town’s postcard came on the first visit, went into the Guide (1 card), and only its stamp the next time'
    a04_postcards()

    @step('alpha 0.4: the windows and lamps scene, by night; a weather front passing', 120)
    def a04_lights():
        """every building kind and every lamp in one scene (test_windows), opened at night: it draws, the buildings are 3D
        and the lamps are lit; then a front of rain comes in over Marigold Town and its curtain sweeps across"""
        if not pg.evaluate("!!GD.scenes.test_windows"): return 'not in this build'
        pg.evaluate("U.modal=null;U.mq=[];renderOv();environment.on=true;environment.force={time:22,weather:'clear',season:'summer'};U.tab='walk';U.inside=null;U.bench={id:'test_windows',test:1};render();0")
        if not until(pg, "!!(walkView.ready&&walkView.id==='test_windows'&&walkRenderer.frames>4)", 60): raise Exception('the windows and lamps scene didn’t open')
        pg.evaluate("walkView.pl.x=44;walkView.pl.z=10;walkView.pl.route=null;0"); time.sleep(4)
        until(pg, "typeof BLD!=='undefined'&&BLD.drawn>=8", 90)   # the buildings' meshes come a few a frame: give them time (5 to 8 are in view here)
        r = pg.evaluate("""(()=>{const L=walkView.sc.props.filter(p=>{const M=GD.scenery.props[p.k];return M&&(M.glow||(M.fx||[]).some(f=>f.k==='glow'))});
          ENG_CTX.env=true;const on=typeof lampLit==='function'?L.filter(p=>lampLit(p.x,p.z,0)>.9).length:-1;ENG_CTX.env=false;let fw=0,lit=0;const lf=typeof bldLitF==='function'?bldLitF():0;
          for(const p of walkView.sc.props){const E=typeof BLD!=='undefined'?BLD.mesh.get(p):null;if(E&&E.fw){fw+=E.fw.length;lit+=E.fw.filter(f=>bldWinLit(f[3],lf)).length}}
          return {b:typeof BLD!=='undefined'?BLD.drawn:0,lamp:environment.lampK,lamps:L.length,on,fw,lit}})()""")
        if r['b'] < 4: raise Exception(f'only {r["b"]} buildings drawn in 3D')
        # alpha 0.4: at ten at night every lamp is on, and some (not all, not none) of the front windows are lit
        if r['on'] < r['lamps']: raise Exception(f'only {r["on"]} of {r["lamps"]} lamps are on at night')
        if r['fw'] and not (0 < r['lit'] < r['fw']): raise Exception(f'{r["lit"]} of {r["fw"]} front windows lit at night')
        shot(pg, 'a04-windows-night')
        # a front: the weather changes while you're in a place, the curtain comes across
        sd = pg.evaluate("PLACE.sundown.node")
        pg.evaluate("U.bench=null;environment.force={time:13,weather:'clear',season:'summer',front:1};0"); go_scene(pg, sd); time.sleep(2)
        pg.evaluate("environment.force={time:13,weather:'rain',season:'summer',front:1};0")
        if not until(pg, "!!(environment.front&&environment.curtain)", 15): raise Exception('no front came in when the weather turned to rain')
        time.sleep(3); c = pg.evaluate("({e:environment.curtain?environment.curtain.e:null,into:environment.curtain?environment.curtain.into:null,cloud:environment.cloud})")
        shot(pg, 'a04-rain-front')
        pg.evaluate("environment.force=null;0")
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return f'{r["b"]} buildings in 3D by night, {r["on"]} of {r["lamps"]} lamps on, {r["lit"]} of {r["fw"]} front windows lit; a rain front came in (its curtain at {c["e"]:.2f}, coming in: {c["into"]})'
    a04_lights()

    @step('alpha 0.4.1: walk the world yourself — the joystick, the D-pad, walking over the edge from Copperleaf onto Route 1, steps counted', 300)
    def a041_walk():
        """the classic way: RULES.travel 'walk'. The joystick moves you along the camera, the D-pad shows when chosen, and
        walking out of Copperleaf over its edge makes Route 1 where you are (the trip is only a guide now)"""
        pg.evaluate("RULES.travel='walk';U.modal=null;U.mq=[];U.toastQ=[];renderOv();environment.force={time:12,weather:'clear',season:'summer'};0")
        try:
            if pg.evaluate("walkMode()") is not True or pg.evaluate("traveling()") is not False: raise Exception('walk mode is not on')
            n0 = pg.evaluate("ROUTE.findIndex(r=>r.scene==='copperleaf')"); n1 = pg.evaluate("ROUTE.findIndex(r=>r.scene==='hedgerow')")
            if n0 < 0 or n1 < 0: return 'no Copperleaf or Hedgerow Lane in this build'
            go_scene(pg, n0, 150); time.sleep(2)
            p0 = pg.evaluate("[walkView.pl.x,walkView.pl.z]"); pg.evaluate("walkView.stick={x:0,y:1};0"); f0 = pg.evaluate("walkRenderer.frames"); until(pg, f"walkRenderer.frames>={f0 + 4}", 120)
            pg.evaluate("walkView.stick=null;0"); p1 = pg.evaluate("[walkView.pl.x,walkView.pl.z]"); moved = ((p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2) ** .5
            if moved < .2: raise Exception(f'the joystick moved the player {moved:.2f} m')
            pg.evaluate("S.preferences.control='dpad';renderOv();render();0"); time.sleep(.8)
            dp = pg.evaluate("!!document.querySelector('.dpad')"); pg.evaluate("S.preferences.control='stick';renderOv();render();0")
            if not dp: raise Exception('no D-pad when the D-pad is chosen')
            st0 = pg.evaluate("S.totalSteps")
            r = pg.evaluate(f"""(()=>{{const v=walkState(),e=(v.exits||[]).find(e=>e.to==={n1});if(!e)return 'no exit to Route 1';const sc=walkView.sc,pt=sc.exits[e.i],hub=mapHub(sc),dx=pt[0]-hub[0],dz=pt[1]-hub[1],l=Math.hypot(dx,dz)||1,tg=[pt[0]+dx/l*6,pt[1]+dz/l*6];
              const P=walkView.pl,R=findPath(P.x,P.z,tg[0],tg[1])||[[P.x,P.z],tg];return {{R}}}})()""")
            if isinstance(r, str): raise Exception(r)
            crossed = False; R = r['R']; walked = 0
            for a, bb in zip(R, R[1:]):
                d = ((bb[0] - a[0]) ** 2 + (bb[1] - a[1]) ** 2) ** .5; k = max(1, int(d / .8))
                for j in range(1, k + 1):
                    x = a[0] + (bb[0] - a[0]) * j / k; z = a[1] + (bb[1] - a[1]) * j / k; walked += d / k
                    if pg.evaluate(f"(()=>{{walkView.pl.x={x};walkView.pl.z={z};walkView.pl.route=null;walkCross();return S.route.node==={n1}}})()"): crossed = True; break
                if crossed: break
            if not crossed: raise Exception(f'walked {walked:.0f} m toward Route 1 and never crossed onto it')
            shot(pg, 'a041-walked-to-route1')
            if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
            return f'the joystick moved the player {moved:.1f} m, the D-pad shows when chosen, {walked:.0f} m of walking crossed from Copperleaf onto Route 1'
        finally:
            pg.evaluate("RULES.travel='steps';environment.force=null;0")
    a041_walk()

    @step('Settings: one save and the account box, languages, text size, contrast', 90)
    def settings():
        pg.evaluate("(()=>{const gl=typeof EGL!=='undefined'&&EGL.gl;if(gl&&gl.__chk){for(const k of ['useProgram','drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced'])delete gl[k];delete gl.__chk}})()")
        out = []
        # alpha 0.4.1: one save per player; the account box shows in Settings → Save (a sign-in button once Firebase is set up)
        acc = pg.evaluate("(()=>{const t=U.setTab;U.setTab='save';const h=settingsHTML();U.setTab=t;return {box:h.includes('acc-box'),slots:typeof slotInfo==='function',key:LS}})()")
        if acc['slots']: raise Exception('the old save slots are still there')
        if not acc['box']: raise Exception('no account box in Settings → Save')
        out.append(f'one save ({acc["key"]}), the account box in Settings')
        pg.evaluate("S.preferences.lang='nl';applyPreferences();U.tab='walk';render();0"); time.sleep(1)
        nl = pg.evaluate("[...document.querySelectorAll('nav#nav button')].map(b=>b.textContent.trim()).join(',')")
        pg.evaluate("S.preferences.lang='en';applyPreferences();render();0"); time.sleep(.5)
        en = pg.evaluate("[...document.querySelectorAll('nav#nav button')].map(b=>b.textContent.trim()).join(',')")
        if 'Lopen' not in nl or 'Walk' not in en: raise Exception(f'language switch: Dutch tabs “{nl}”, back to English “{en}”')
        out.append(f'Dutch tabs: {nl}')
        pg.evaluate("S.preferences.textSize='xlarge';S.preferences.contrast='high';applyPreferences();0"); time.sleep(.6); shot(pg, 'settings-large-contrast')
        a = pg.evaluate("[document.documentElement.dataset.text,document.documentElement.dataset.contrast]")
        pg.evaluate("S.preferences.textSize='normal';S.preferences.contrast='normal';applyPreferences();0")
        if a != ['xlarge', 'high']: raise Exception(f'text size and contrast didn’t apply ({a})')
        out.append('larger text and high contrast apply')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return '; '.join(out)
    settings()

    @step('Battles: on the 3D stage, and a trainer battle played to the end', 330)
    def battles():
        pg.evaluate("S.preferences.battleStage='scene';wipe=f=>f();S.route={node:0,prog:0,plan:[],hold:false};U.tab='walk';render();0"); time.sleep(2)
        pg.evaluate("const q={id:'t3d',sp:'knight1',lvl:12,gold:false,no:1};S.queue=[q];S.team.forEach(m=>{m.hp=maxHp(m)});startWild(q);0")
        if wait_phase(pg, sec=60) != 'choose': raise Exception('the 3D-stage battle never reached the move menu')
        shot(pg, 'battle-3d'); stage = pg.evaluate("!!battleStage.gl")
        pg.evaluate("stopTimers();B=null;battleStageStop();S.preferences.battleStage='classic';render();0")
        # battle animations at four times the speed (the Debug panel's speed setting), so the result comes quickly
        pg.evaluate("battleStage.speed=4;S.team=[makeMon('musk2',45),makeMon('ek1',30)];S.route.node=4;startTrainer('crude');0")
        end = time.time() + 300; won = None
        while time.time() < end:
            ph = wait_phase(pg, ('choose', 'switch', 'end'), 30)
            if ph == 'end': won = pg.evaluate('B.over') == 'win'; break
            if ph == 'switch': pg.evaluate("document.querySelector('[data-a=bswitch]:not([disabled])').click()"); continue
            if ph == 'choose': pg.evaluate("document.querySelector('[data-a=bfight]').click();document.querySelector('[data-a=bmove]').click()")
        pg.evaluate("battleStage.speed=1;if(B){stopTimers();B=null;battleStageStop()}render();0")
        if won is None: raise Exception('the trainer battle didn’t finish in 300s')
        if not won: raise Exception('the trainer battle was lost (it should be an easy win)')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return ('3D stage' if stage else 'painted stage (no WebGL)') + ', trainer battle won'
    battles()
    R['desktopErrors'] = errs[:10]; ctx.close()


def studio_round_trip(pw, R):
    """the Studio on a temporary copy: open every section, change a move, add a Billie, save, see both in the game"""
    @step('Studio: sections, an edit and a new Billie reach the game', 360)
    def run():
        tmp = Path(tempfile.mkdtemp(prefix='networth-quick-'))
        for d in ('game', 'studio'): shutil.copytree(ROOT / d, tmp / d)
        shutil.copy2(ROOT / 'start-studio.py', tmp / 'start-studio.py'); port = free_port()
        proc = subprocess.Popen([sys.executable, str(tmp / 'start-studio.py'), '--no-browser'], env={**os.environ, 'NETWORTH_STUDIO_PORT': str(port)}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        b = pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']); errs = []
        try:
            time.sleep(1.5); ctx = b.new_context(viewport={'width': 1280, 'height': 860}); ctx.add_init_script(CLOCK); ctx.add_init_script(NO_ACCOUNTS); ctx.add_init_script(TEST_GLOBALS); ctx.set_default_timeout(90000); pg = ctx.new_page()
            pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            pg.goto(f'http://localhost:{port}/studio/index.html'); pg.wait_for_selector('.split', timeout=30000); time.sleep(1)
            for sec in ['billionaires', 'moves', 'preview', 'types', 'items', 'shops', 'world', 'scenes', 'engine', 'wardrobe', 'trainers', 'lore', 'people', 'jobs', 'rules', 'art', 'check']:
                pg.evaluate(f"go('{sec}')"); time.sleep(1.6 if sec in ('preview', 'scenes', 'engine') else .4)
                if sec in ('scenes', 'check'): shot(pg, f'studio-{sec}')
                if sec == 'lore':   # v47: every tab of Lore & story opens
                    for t in ['world', 'story', 'people', 'places', 'legends', 'clues', 'books', 'loading', 'chat']:
                        pg.evaluate(f"ACTS.loreTab({{k:'{t}'}});0"); time.sleep(.2)
                    shot(pg, 'studio-lore')
            # v29 scene tools: scatter, copy and paste, a block stamp, a curved road, a smooth path; then a test run that sees the edits live
            extra = ''
            if pg.evaluate("typeof scxScatter==='function'"):
                pg.evaluate("go('scenes');ACTS.scPick({k:'pond'});0"); time.sleep(2.5)
                r = pg.evaluate("""(()=>{const sc=scCur(),n0=sc.props.length,t0=sc.tiles.join('');SCN.prop=Object.keys(scD().props).find(k=>/bush|flower/.test(k));SCN.scat.dens=1.5;SCN.brush=3;
                  const D={n:0};for(let i=0;i<4;i++)scxScatter(sc,{x:6+i,z:6},D);const n1=sc.props.length;SCN.multi=new Set([0,1]);scxCopy();SCN.mouse=[sc.w/2,sc.h/2];scxPaste();const n2=sc.props.length;
                  scxStampAt(sc,{name:'t',props:[{k:sc.props[0].k,x:0,z:0},{k:sc.props[1].k,x:1,z:0}]},4,4,false);const n3=sc.props.length;
                  SCN.ter='p';SCN.road=[[2,3],[sc.w/2,sc.h/2],[sc.w-3,4]];scxRoadLay(sc);const roadOk=sc.tiles.join('')!==t0;const p0=(sc.path||[]).length;ACTS.scxSmoothPath();changed();
                  return {scattered:n1-n0,pasted:n2-n1,stamped:n3-n2,road:roadOk,path:[p0,(sc.path||[]).length],n:sc.props.length}})()""")
                if r['scattered'] < 3 or r['pasted'] != 2 or r['stamped'] != 2 or not r['road']: raise Exception(f'scene tools: {r}')
                pg.evaluate("go('rules');0")          # the Studio's scene preview would otherwise share the software renderer with the test run
                g = ctx.new_page(); g.goto(f'http://localhost:{port}/game/index.html?test=1&scene=pond'); g.wait_for_selector('#walkHero', timeout=240000)
                ok = False
                for _ in range(120):
                    st = g.evaluate("[typeof walkView!=='undefined'&&walkView.id,GD.scenes.pond.props.length,typeof NW_TEST!=='undefined'&&!!NW_TEST]")
                    if st[0] == 'pond' and st[1] == r['n']: ok = True; break
                    time.sleep(.5)
                saved = g.evaluate("(()=>{try{return localStorage.getItem(LS)}catch(e){return 'x'}})()")
                g.close()
                if not ok: raise Exception(f'the test run didn’t open Willowmere with the Studio’s edits ({st}, Studio has {r["n"]} props)')
                if saved: raise Exception('the test run wrote a save')
                extra = f"; scene tools: {r['scattered']} scattered, 2 pasted, a block stamped, a road laid, path {r['path'][0]}→{r['path'][1]} points; a test run opened Willowmere with the unsaved edits and saved nothing"
            pg.evaluate("go('rules')"); time.sleep(.5)
            pg.evaluate("go('moves',{move:'lawsuit'})"); pg.fill('input[data-p="moves.lawsuit.p"]', '77'); pg.dispatch_event('input[data-p="moves.lawsuit.p"]', 'change')
            pg.evaluate("go('billionaires')"); pg.click('[data-act=newLine]'); time.sleep(.5); pg.fill('#nwName', 'Checko'); pg.click('.dlg-btns .btn.primary')
            pg.wait_for_selector('.skel', timeout=10000); time.sleep(.6); pg.click('[data-sk=close]'); time.sleep(.3)
            pg.click('#saveBtn'); time.sleep(4); pg.evaluate("go('rules')")
            g = ctx.new_page(); g.on('pageerror', lambda e: errs.append('game: ' + str(e))); g.on('console', lambda m: errs.append('game: ' + m.text) if m.type == 'error' else None)
            g.goto(f'http://localhost:{port}/game/index.html')
            try: g.wait_for_selector('.ttl,.title', timeout=60000)
            except Exception: raise Exception('after saving, the game didn’t reach its title: ' + (' | '.join(errs[:4]) or g.evaluate("document.querySelector('.ld-phase')&&document.querySelector('.ld-phase').textContent")))
            seen = g.evaluate("[MOVES.lawsuit.p,!!SP.checko0]")
            if seen != [77, True]: raise Exception(f'after saving, the game sees move power {seen[0]} and new Billie {seen[1]}')
            # v37: the save put the piece-sheet rigs back in rigs-next.js and the rest in rigs.js
            rn = (tmp / 'game' / 'art' / 'next' / 'rigs-next.js').read_text(); ro = (tmp / 'game' / 'art' / 'rigs.js').read_text()
            if '"musk0"' not in rn or '"musk0"' in ro or '"checko0"' not in ro: raise Exception('rigs were not split between rigs-next.js and rigs.js on save')
            if g.evaluate("!(RIGS.musk0&&RIGS.checko0)"): raise Exception('the game lost a rig after the Studio saved')
            if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
            return 'edit and new Billie seen in the game; rigs saved to rigs-next.js and rigs.js' + extra
        finally:
            R['studioErrors'] = errs[:10]; b.close(); proc.terminate(); shutil.rmtree(tmp, ignore_errors=True)
    run()


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


@step('Studio: every script loads and the sign-in shows (GitHub mode)', 60)
def studio_opens(b):
    """phase 01: the Studio as GitHub Pages serves it (no Studio server): all its scripts run and it asks for a token.
    The full round trip (--studio) needs start-studio.py"""
    srv, base = serve(ROOT); errs = []
    ctx = b.new_context(viewport={'width': 1280, 'height': 860}); ctx.add_init_script(CLOCK); ctx.add_init_script(NO_ACCOUNTS); ctx.add_init_script(TEST_GLOBALS); pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(console_text(m)) if m.type == 'error' else None)
    try:
        pg.goto(base + '/studio/index.html'); pg.wait_for_selector('#ghTok', timeout=60000)
        ok = pg.evaluate("[typeof go==='function',typeof GH==='object',typeof propLook==='function']")
        if not all(ok): raise Exception(f'Studio scripts missing (go, GH, the shared renderer): {ok}')
        shot(pg, 'studio-sign-in')
        if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))
        return 'the Studio and the shared game scripts loaded; the GitHub sign-in is showing'
    finally:
        ctx.close(); srv.shutdown()


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
    check_version(); check_code(); check_data(); old_names(); copperleaf_data(); check_water(); check_masts(); check_postcards(); check_rooms(); check_windows(); check_ground(); report_unused()
    srv, base = serve(GAME)
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        if '--studio-only' not in ARGS:
            phone_flow(b, base, R)
            if SMOKE:
                studio_opens(b)
            else:
                try:
                    desktop_steps(b, base, R)
                except Exception as e:
                    problems.append(f'desktop: {str(e).splitlines()[0][:200]}')
        b.close()
        if '--studio' in ARGS or '--studio-only' in ARGS: studio_round_trip(pw, R)
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

#!/usr/bin/env python3
"""The fast check of Pocket Billies: only what must never break, in one to three minutes on a headless machine. Claude
Code runs it after a change and CI on every push.

    python3 tools/check-fast.py                  # every check
    python3 tools/check-fast.py --workers=2      # browser checks side by side in this many browsers (default 2)
    python3 tools/check-fast.py --only=battle,save   # only the checks whose names hold these words

Without a browser (Node): the game data is valid, and the world-map graph is unchanged (tools/test/world-graph.test.mjs
and its snapshot). In a browser, each check opens its own page straight where it needs to be (?fixture=<name>,
game/js/fixture.js), never through the opening and never waiting for every map: the game boots with no console or page
errors; a town, a route, a room and a cave each open and draw frames; a battle plays to the end; a save round-trips;
the Studio loads; the exported debug log holds no names; the world map opens as the bowl, a tap opens a card, Home
comes back. The page is small (400x300) with every costly graphics dial
off before it loads; nothing waits a fixed time, only for frames or the game's state. No pictures are taken.

Graphics are not judged here: software drawing can't. The game's own graphics test (Settings → Help) is for a person
on a real device and is never run from a script."""
import json, queue, socket, subprocess, sys, threading, time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAME = ROOT / 'game'
T0 = time.time()
ARGS = sys.argv[1:]
WORKERS = int(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--workers=')), 2))
ONLY = next((a.split('=', 1)[1].split(',') for a in ARGS if a.startswith('--only=')), None)
LAUNCH = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']

# from tools/check-quick.py: every page lives on 15 June at half past twelve (the clock still runs), no Google sign-in,
# and the modules' names on window for page.evaluate()
CLOCK = """(()=>{const D=Date,off=new D(2026,5,15,12,30,0).getTime()-D.now();class FD extends D{constructor(...a){if(a.length)super(...a);else super(D.now()+off)}static now(){return D.now()+off}}
 FD.UTC=D.UTC;FD.parse=D.parse;window.Date=FD})()"""
NO_ACCOUNTS = "Object.defineProperty(window,'PB_FIREBASE',{get(){return null},set(){},configurable:false})"
TEST_GLOBALS = "window.PB_TEST_GLOBALS=true"
# every costly graphics dial off (or at its least) in the game-wide defaults, set as data/gamedata.js hands the game
# data over, before any script reads it. Buildings, rooms and the seamless world stay on: rooms and scene loading need them
LOW_GRAPHICS = """(()=>{const off={lens:{blur:0,bokeh:0,aberration:0,grain:0,sharpen:0,vignette:0},color:{bloom:0,ink:0,outlines:0},
 air:{godRays:0,lightsInAir:0,mist:0,valleyMist:0,sunFog:0,particles:0},sun:{shafts:0,glare:0,clouds:0,cloudShadows:0},
 shadows:{ao:0,contact:0,cascades:false,lampShadows:0,groundAO:0},grass:{density:0},
 world:{groundBumps:0,farProps:0,treeCount:0,mini3d:false,variety:0,wear:0,buildings3d:true,interiors:true},
 quality:{auto:false,shadowMap:1024,resolution:.4}};let G;
 Object.defineProperty(window,'GAMEDATA',{configurable:true,get(){return G},set(v){if(v&&typeof v==='object'){v.engine=v.engine||{};
  const d=v.engine.defaults=v.engine.defaults||{};for(const k in off)d[k]=Object.assign({},d[k]||{},off[k])}G=v}})})()"""
NAMES = ('Quillonda', 'Zorblax')   # planted by the fixture (game/js/fixture.js FIXTURE_NAMES)
results, lock = [], threading.Lock()


def log(msg):
    print(f'[{time.time() - T0:6.1f}s] {msg}', flush=True)


def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


def serve(directory):
    port = free_port()
    class Quiet(SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    srv = ThreadingHTTPServer(('127.0.0.1', port), partial(Quiet, directory=str(directory)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f'http://127.0.0.1:{port}'


def console_text(m):
    """a failed load says which file (the browser's own message doesn't)"""
    from urllib.parse import urlparse
    t = m.text
    try:
        if 'Failed to load' in t and m.location and m.location.get('url'): t += f' ({urlparse(m.location["url"]).path.lstrip("/")})'
    except Exception: pass
    return t


def open_game(b, url, errs, low=True):
    """a small page, with the graphics off for the game (url None: not opened yet)"""
    ctx = b.new_context(viewport={'width': 400, 'height': 300}, device_scale_factor=1)
    for s in (CLOCK, NO_ACCOUNTS, TEST_GLOBALS) + ((LOW_GRAPHICS,) if low else ()): ctx.add_init_script(s)
    ctx.set_default_timeout(60000); pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(console_text(m)) if m.type == 'error' else None)
    if url: pg.goto(url)
    return ctx, pg


def until(pg, cond, sec):
    """wait for the game's state (checked in the page every 100 ms), no fixed sleeps"""
    try:
        pg.wait_for_function(f'()=>{{try{{return !!({cond})}}catch(e){{return false}}}}', timeout=sec * 1000, polling=100)
        return True
    except Exception as e:
        if 'Timeout' not in type(e).__name__ and 'Timeout' not in str(e): raise
        return False


def drawing(pg, n=3, sec=40):
    """the walk view is ready (a boot may take a while: 90 s) and draws n more frames"""
    if not until(pg, "typeof walkView!=='undefined'&&walkView.ready&&walkRenderer.on", 90): raise Exception('the walk view never got ready')
    f0 = pg.evaluate('walkRenderer.frames')
    if not until(pg, f'walkRenderer.frames>={f0 + n}', sec): raise Exception(f'{pg.evaluate("walkView.id")} isn’t drawing (black screen)')


def go_scene(pg, node, sec=40):
    # from tools/check-quick.py: a jump, not a walk, then wait until the scene is open and draws
    pg.evaluate(f"uiState.inside=null;uiState.tab='walk';saveData.trip={{node:{node},plan:[]}};saveData.visited[{node}]=1;uiState.roam=null;if(typeof walkView!=='undefined'&&walkView.pl)walkView.pl.fresh=true;render();0")
    if not until(pg, f'!!(walkView.ready&&(walkView.id===LOCATIONS[{node}].mapId||(walkView.sc&&walkView.sc.baseId===LOCATIONS[{node}].mapId)))', sec):
        raise Exception(f'{pg.evaluate(f"LOCATIONS[{node}].mapId")} didn’t open in {sec}s')
    f0 = pg.evaluate("typeof walkRenderer!=='undefined'&&walkRenderer.on?walkRenderer.frames:-1")
    if f0 >= 0 and not until(pg, f'walkRenderer.frames>={f0 + 2}', 30): raise Exception(f'{pg.evaluate("walkView.id")} isn’t drawing (black screen)')


def no_errors(errs):
    if errs: raise Exception('errors: ' + ' | '.join(errs[:4]))


# ---------- the checks without a browser ----------

def node_check(cmd):
    r = subprocess.run(['node', *cmd], cwd=ROOT, capture_output=True, text=True)
    out = (r.stdout + r.stderr).strip().splitlines()
    if r.returncode:
        # node --test: the tests that failed and why; anything else: its last lines
        failed = [l.strip()[7:] for l in out if l.strip().startswith('not ok')]
        why = [l.strip() for l in out if l.strip().startswith(("error: '", 'error: "'))]
        raise Exception('; '.join(failed[:3] + why[:2]) if failed else ' | '.join(out[-3:]) or 'failed')
    return out[-1][:160] if out else 'fine'


def data_valid(_):
    return node_check(['tools/check-data.mjs'])


def world_graph(_):
    node_check(['--test', 'tools/test/world-graph.test.mjs'])
    return 'places, roads, edges, gates and lifts match the snapshot'


# ---------- the checks in a browser ----------
# Booting costs most of a check (the loading screen reads and decodes every picture, then the scene is made), so the
# checks share four pages, each opened at its fixture: a check gets its page as the one before left it, and the errors
# that came up while it ran (the first one also those of the boot)

def boots(pg, base):
    """a new player's boot: the title over Copperleaf, drawing"""
    if not until(pg, "typeof titleScreen!=='undefined'&&titleScreen.on&&!document.getElementById('nogl')", 90): raise Exception('the title never showed')
    drawing(pg)
    return f'title over {pg.evaluate("walkView.id")}, drawing'


def scene(node_id):
    def run(pg, base):
        node = pg.evaluate(f"LOCATIONS.findIndex(l=>l.id==={json.dumps(node_id)})")
        if pg.evaluate(f'saveData.trip.node!=={node}'): go_scene(pg, node)   # the town is the page's fixture; the others are a jump away
        else: drawing(pg)
        return f'{pg.evaluate("walkView.id")} drew {pg.evaluate("walkRenderer.frames")} frames'
    return run


def bowl_map(pg, base):
    """phase 10: the Map tab opens as the bowl (world-bowl.js) and keeps drawing; a tap on a place's pin opens its card,
    and Home brings the camera back over you. Small page, graphics off, no pictures: on a device, the debug menu's
    Bowl map test checks the rest (frame rate, every place)"""
    # from the walk scene by its tab button: the walk camera rises, the bowl pulls back from right above you
    if not until(pg, "!!document.querySelector('[data-a=tab][data-t=map]')&&typeof walkRenderer!=='undefined'&&walkRenderer.on", 90): raise Exception('the walk scene never got ready')
    z0 = pg.evaluate("typeof walkRenderer!=='undefined'?walkRenderer.zoomT:null")
    pg.evaluate("uiState.mapSel=null;document.querySelector('[data-a=tab][data-t=map]').click();0")
    if not until(pg, "typeof worldBowl!=='undefined'&&worldBowl.on&&worldBowl.frames>=3", 30):
        raise Exception('the map didn’t open as the bowl' + (' (the old map opened)' if pg.evaluate("worldMap.gl") else ''))
    if not until(pg, "!worldBowl.tween&&!document.getElementById('mapfade')", 10): raise Exception('the zoom out from the walk scene never settled')
    # touches must reach the map: its layer fills the screen and some of it is not under the card or the buttons (on a
    # phone-sized page: this page's 300 px are mostly card)
    pg.set_viewport_size({'width': 400, 'height': 760}); time.sleep(.5)
    hit = pg.evaluate("(()=>{const r=worldMap.cv.getBoundingClientRect();if(r.height<innerHeight*.9)return 'a map layer '+Math.round(r.height)+' px high';for(const fy of [.2,.3,.4,.5])for(const fx of [.3,.5,.7]){const e=document.elementFromPoint(innerWidth*fx,innerHeight*fy);if(e===worldMap.cv)return ''}const e=document.elementFromPoint(innerWidth/2,innerHeight/2);return e?e.tagName+'#'+e.id:'nothing'})()")
    if hit: raise Exception(f'a touch on the map lands on {hit}, not the map')
    pg.set_viewport_size({'width': 400, 'height': 300})
    # the ground's terrain map fills and the terrain pictures go up (graphics off: nothing is judged by eye)
    if not until(pg, "!!(worldBowl.ground&&worldBowl.ground.terrain&&worldBowl.ground.terrain.ready&&worldBowl.ground.ok)", 60): raise Exception('the terrain never got ready')
    # the sea (look session 1): a water sheet over about 40% of the bowl, its shader in the same programs
    if not pg.evaluate("!!(worldBowl.ground.water&&gpuState.P.mwater)"): raise Exception('the sea isn’t drawn')
    # look session 2: the shadow map, the routes' and rivers' line map and the rivers
    if not until(pg, "!!(worldBowl.ground.shadow&&worldBowl.ground.shadow.t&&worldBowl.ground.lines&&(worldBowl.ground.G.rivers||[]).length>=4)", 20): raise Exception('no shadow map, route lines or rivers')
    f1 = pg.evaluate("worldBowl.frames"); until(pg, f"worldBowl.frames>={f1 + 2}", 10)
    err = pg.evaluate("gpuState.gl.getError()")
    if err: raise Exception(f'the GPU reports error {err} while drawing the bowl')
    n = pg.evaluate("LOCATIONS.length"); s = pg.evaluate("(worldBowl.spots||[]).filter(s=>isFinite(s.x)&&isFinite(s.y)).length")
    if s != n: raise Exception(f'{s} of {n} places have a spot on the bowl')
    pick = pg.evaluate("""(()=>{const t=LOCATIONS.findIndex(l=>l.id==='tallgrass_meadow'),p=worldBowl.spots[t];worldBowl.goal=null;worldBowl.cam=bowlCamHome(p.x,p.y);worldBowl.dirty=true;return t})()""")
    f0 = pg.evaluate("worldBowl.frames")
    if not until(pg, f"worldBowl.frames>={f0 + 2}&&(worldBowl.marks||[]).some(m=>m.i==={pick})", 20): raise Exception('the bowl stopped drawing')
    pg.evaluate(f"(()=>{{const r=worldMap.cv.getBoundingClientRect(),m=worldBowl.marks.find(m=>m.i==={pick});worldBowlPick({{clientX:r.left+m.top.x,clientY:r.top+(m.top.y+m.base.y)/2}})}})();0")
    if not until(pg, f"uiState.mapSel==={pick}&&document.querySelector('#mapcard').textContent.includes(LOCATIONS[{pick}].name)", 5):
        raise Exception(f'tapping Tallgrass Meadow’s pin picked {pg.evaluate("uiState.mapSel")}')
    pg.evaluate("uiState.mapSel=null;worldBowl.cam=bowlCamOverview();worldMapReset();0")
    if not until(pg, "!worldBowl.goal&&(()=>{const p=worldBowl.spots[saveData.trip.node];return Math.hypot(worldBowl.cam.tx-p.x,worldBowl.cam.ty-p.y)<.01})()", 15):
        raise Exception('Home didn’t bring the camera back')
    fr = pg.evaluate("worldBowl.frames")
    # the opening fall films the bowl (one frame of it, mid-fall)
    pg.evaluate("worldBowlFilm(fallCamera(.5,400,300),performance.now());0")
    pg.evaluate("uiState.tab='walk';render();0")
    if z0 is not None and not until(pg, f"Math.abs(walkRenderer.zoomT-{z0})<1e-6", 10): raise Exception(f'the walk camera’s zoom didn’t come back ({pg.evaluate("walkRenderer.zoomT")}, was {z0})')
    # an airship flight over the bowl, skipped to the end: you land in the other town
    to = pg.evaluate("(()=>{const i=LOCATIONS.findIndex(l=>l.id==='copperleaf');saveData.visited[i]=1;saveData.se+=100000;startAirshipFlight(i);return i})()")
    if not until(pg, "airshipFlight.on&&worldBowl.on", 15): raise Exception('the flight didn’t show on the bowl')
    f1 = pg.evaluate("worldBowl.frames")
    if not until(pg, f"worldBowl.frames>{f1}||!airshipFlight.on", 15): raise Exception('the bowl stopped drawing during the flight')
    pg.evaluate("flySkip();0")
    if not until(pg, f"!airshipFlight.on&&saveData.trip.node==={to}&&uiState.tab==='walk'", 30): raise Exception('the flight never landed')
    return f'{n} places on the bowl, {fr} frames; opened from the walk scene; a tap opens the card, Home comes back; the fall films it; a flight lands'


def room(pg, base):
    if not until(pg, "!!uiState.inside&&walkView.ready&&walkView.sc.roomOf===uiState.inside.id", 60): raise Exception(f'not in the room: {pg.evaluate("walkView.id")}')
    drawing(pg)
    return f'{pg.evaluate("walkView.id")} drew {pg.evaluate("walkRenderer.frames")} frames'


def battle(pg, base):
    """a trainer battle on the default stage, animations at four times the speed, played to the end"""
    if not until(pg, '!!activeBattle', 90): raise Exception('the battle never started')
    pg.evaluate('battleStage.speed=4;0')
    turns, end = 0, time.time() + 120
    while time.time() < end:
        if not until(pg, "(()=>{const p=activeBattle?activeBattle.phase:'none';if(p==='playing')tapMessage();return ['choose','switch','end','none'].includes(p)})()", 30):
            raise Exception(f'the battle stuck at {pg.evaluate("activeBattle&&activeBattle.phase")}')
        ph = pg.evaluate("activeBattle?activeBattle.phase:'none'")
        if ph in ('end', 'none'): break
        if ph == 'switch': pg.evaluate("document.querySelector('[data-a=bswitch]:not([disabled])').click()")
        if ph == 'choose': turns += 1; pg.evaluate("document.querySelector('[data-a=bfight]')?.click();document.querySelector('[data-a=bmove]').click()")
    over = pg.evaluate('activeBattle&&activeBattle.over')
    if not over: raise Exception('the battle didn’t end in 120 s')
    if over != 'win': raise Exception(f'the battle ended “{over}” (the fixture’s team should win)')
    return f'won in {turns} turns'


def save_round_trip(pg, base):
    """the save written in this browser comes back whole after a reload (under the fixture's own key)"""
    drawing(pg, 1)
    # what only the player changes (money and experience grow by themselves as time passes), and three marks
    pick = "JSON.stringify((s=>({team:s.team.map(m=>[m.uid,m.sp,m.lvl,m.nick,m.moves]),box:s.box.length,avatar:s.avatar.name,items:s.items,node:s.trip.node,flags:s.flags,story:s.story.fastCheck,started:s.started}))(saveData))"
    before = pg.evaluate(f"saveData.flags.fastCheck=1;saveData.story.fastCheck=7;saveData.team[1].nick='Two';save();{pick}")
    keys = pg.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('networth-save'))")
    if keys != ['networth-save-v1-fixture']: raise Exception(f'saved under {keys}, not only the fixture’s own key')
    pg.goto(base + '/index.html?fixture=stored')
    drawing(pg, 1)
    after = pg.evaluate(pick)
    if after != before:
        a, z = json.loads(before), json.loads(after)
        raise Exception('changed after the reload: ' + ', '.join(f'{k} {a[k]} -> {z.get(k)}' for k in a if a[k] != z.get(k)))
    return 'team, avatar, items, place, flags and story back as saved'


def debug_log(pg, base):
    """the exported debug log is a JSON log without the trainer’s name or the buddy’s nickname"""
    drawing(pg, 1)
    planted = pg.evaluate('[saveData.avatar.name,(buddyBilly()||saveData.team[0]).nick]')
    if list(planted) != list(NAMES): raise Exception(f'the fixture didn’t plant the names: {planted}')
    with pg.expect_download(timeout=30000) as dl:
        pg.evaluate('exportDebugLog();0')
    text = Path(dl.value.path()).read_text(encoding='utf-8')
    log_ = json.loads(text)
    if not isinstance(log_, dict) or not log_: raise Exception('the exported debug log is empty')
    found = [n for n in NAMES if n.lower() in text.lower()]
    if found: raise Exception(f'the exported debug log holds a name: {found}')
    return f'{len(text) // 1024} KB, no names'


def studio(pg, base):
    """the Studio as GitHub Pages serves it: its scripts and the shared renderer load, it asks for a token"""
    if not until(pg, "!!document.getElementById('ghTok')", 60): raise Exception('the GitHub sign-in never showed')
    ok = pg.evaluate("[typeof openSection==='function',typeof githubMode==='object',typeof propLook==='function']")
    if not all(ok): raise Exception(f'Studio scripts missing (openSection, githubMode, the shared renderer): {ok}')
    return 'scripts and the shared renderer loaded, the GitHub sign-in is there'


NODE_CHECKS = [('Game data is valid', data_valid), ('The world-map graph is unchanged', world_graph)]
PAGES = [   # (what the page opens, its checks in order); the longest first, so the browsers finish together
    ('town', [('A town opens and draws (Marigold Town)', scene('marigold')),
              ('The exported debug log holds no names', debug_log),
              ('A route opens and draws (Tallgrass Meadow)', scene('tallgrass_meadow')),
              ('A cave opens and draws (Gloomwater)', scene('gloomwater')),
              ('The world map opens as the bowl', bowl_map)]),
    ('room', [('A room opens and draws (the shop)', room), ('A save round-trips', save_round_trip)]),
    ('battle', [('A battle plays to the end', battle)]),
    ('title', [('The game boots with no console or page errors', boots)]),
    ('studio', [('The Studio loads', studio)]),
]


def record(name, fn, *a):
    t = time.time()
    try:
        note, ok = fn(*a) or '', True
    except Exception as e:
        note, ok = str(e).splitlines()[0][:300], False
    dt = round(time.time() - t, 1)
    with lock:
        results.append({'check': name, 'ok': ok, 'seconds': dt, 'note': note})
        log(f'{"ok     " if ok else "PROBLEM"} {dt:5.1f}s  {name}: {note}')
    return ok


def run_page(b, fixture, checks, bases):
    """one page at its fixture (the Studio's page at the Studio), its checks one after another"""
    errs = []; base = bases['root' if fixture == 'studio' else 'game']
    url = base + ('/studio/index.html' if fixture == 'studio' else f'/index.html?fixture={fixture}')
    ctx, pg = open_game(b, None, errs, low=fixture != 'studio')
    try:
        for i, (name, fn) in enumerate(checks):
            n0 = len(errs)
            def one(fn=fn, n0=n0, first=i == 0):
                try:
                    if first: pg.goto(url)   # the first check's time holds the boot
                    note = fn(pg, base)
                except Exception as e:
                    if errs[n0:]: raise Exception(f'{str(e).splitlines()[0]}; errors: ' + ' | '.join(errs[n0:][:4]))
                    raise
                no_errors(errs[n0:])
                return note
            record(name, one)
    finally:
        ctx.close()


def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('Install Playwright first:  pip install -r tools/requirements-check.txt && python3 -m playwright install chromium'); sys.exit(1)
    pick = lambda L: [c for c in L if not ONLY or any(w.lower() in c[0].lower() for w in ONLY)]
    # data/gamedata.js is made from the data files; make it from the files as they are now
    subprocess.run(['node', str(ROOT / 'tools' / 'build-data.mjs')], check=True, capture_output=True)
    for name, fn in pick(NODE_CHECKS): record(name, fn, None)
    todo = [(f, [c for c in cs if not ONLY or any(w.lower() in c[0].lower() for w in ONLY)]) for f, cs in PAGES]
    todo = [(f, cs) for f, cs in todo if cs]
    game_srv, game_base = serve(GAME); root_srv, root_base = serve(ROOT)
    bases = {'game': game_base, 'root': root_base}
    q = queue.Queue()
    for t in todo: q.put(t)

    def worker():
        # one browser per worker (Playwright's sync API keeps to its thread); each fixture page is a context of its own
        with sync_playwright() as pw:
            b = pw.chromium.launch(args=LAUNCH)
            while True:
                try: fixture, checks = q.get_nowait()
                except queue.Empty: break
                run_page(b, fixture, checks, bases)
            b.close()

    n = max(1, min(WORKERS, len(todo)))
    log(f'{sum(len(cs) for _, cs in todo)} browser checks on {len(todo)} pages in {n} browser(s)')
    threads = [threading.Thread(target=worker) for _ in range(n)]
    for t in threads: t.start()
    for t in threads: t.join()
    game_srv.shutdown(); root_srv.shutdown()
    bad = [r for r in results if not r['ok']]
    total = round(time.time() - T0, 1)
    print(f'\nTime: {total} s in all ({WORKERS} browser(s)), {len(results)} checks, {len(results) - len(bad)} passed')
    for r in sorted(results, key=lambda r: -r['seconds']): print(f'  {r["seconds"]:6.1f} s  {"ok     " if r["ok"] else "PROBLEM"} {r["check"]}')
    out = ROOT / 'validation' / 'fast'; out.mkdir(parents=True, exist_ok=True)
    (out / 'results.json').write_text(json.dumps({'seconds': total, 'workers': WORKERS, 'checks': results}, indent=2, ensure_ascii=False))
    for r in bad: print('  PROBLEM', r['check'] + ':', r['note'])
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()

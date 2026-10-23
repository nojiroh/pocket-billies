"""What the browser checks share (test cleanup track, TC-4): a quiet local web server on a free port, the page set-up
every check page gets (the clock, no accounts, the test globals, the low graphics), the wait on the game's state,
the console text and the log line.

Used by check-fast.py, check-quick.py, check-ui-gallery.py, check-sound.py and check-studio-github.py, and by the look
tools (style-diff.py, look-blur.py, island-perf.py, island-shots.py; look-tall-ground.py through check-fast.py).
Nothing here waits a fixed time: `until` asks the page every 100 ms."""
import socket, threading, time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAME = ROOT / 'game'
T0 = time.time()
# software drawing (no graphics chip on a check machine)
LAUNCH = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']

# every page lives on 15 June at half past twelve (the clock still runs), so pictures are taken at the same time of day
CLOCK = """(()=>{const D=Date,off=new D(2026,5,15,12,30,0).getTime()-D.now();class FD extends D{constructor(...a){if(a.length)super(...a);else super(D.now()+off)}static now(){return D.now()+off}}
 FD.UTC=D.UTC;FD.parse=D.parse;window.Date=FD})()"""
# no Google sign-in during the checks
NO_ACCOUNTS = "Object.defineProperty(window,'PB_FIREBASE',{get(){return null},set(){},configurable:false})"
# phase 04d: the modules' names on window (game/js/test-globals.js), only for the checks' page.evaluate() calls
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


def log(msg):
    """a line with the seconds since the check started"""
    print(f'[{time.time() - T0:6.1f}s] {msg}', flush=True)


def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass


def serve(directory):
    """a quiet web server for the folder on a free port, in a thread of its own: (server, its base URL)"""
    srv = ThreadingHTTPServer(('127.0.0.1', free_port()), partial(Quiet, directory=str(directory)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f'http://127.0.0.1:{srv.server_address[1]}'


def console_text(m):
    """a failed load says which file (the browser's own message doesn't)"""
    from urllib.parse import urlparse
    t = m.text
    try:
        if 'Failed to load' in t and m.location and m.location.get('url'): t += f' ({urlparse(m.location["url"]).path.lstrip("/")})'
    except Exception: pass
    return t


def collect_errors(pg, errs, console=True):
    """the page's errors (and console errors) go into the list errs"""
    pg.on('pageerror', lambda e: errs.append(str(e)))
    if console: pg.on('console', lambda m: errs.append(console_text(m)) if m.type == 'error' else None)


def new_page(b, errs, width=400, height=300, mobile=False, low=True, timeout=60000, console=True, init=(), **context):
    """a page with the check set-up: the clock, no accounts, the test globals, (low) the graphics off and the scripts
    in init; its errors go into errs. Not opened yet: (context, page)"""
    ctx = b.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile, **context)
    for s in (CLOCK, NO_ACCOUNTS, TEST_GLOBALS) + ((LOW_GRAPHICS,) if low else ()) + tuple(init): ctx.add_init_script(s)
    ctx.set_default_timeout(timeout); pg = ctx.new_page()
    collect_errors(pg, errs, console)
    return ctx, pg


def open_game(b, url, errs, low=True):
    """a small page, with the graphics off for the game (url None: not opened yet)"""
    ctx, pg = new_page(b, errs, low=low)
    if url: pg.goto(url)
    return ctx, pg


def until(pg, cond, sec, poke=None, poll=100):
    """wait for the game's state (the JS condition, checked in the page every poll ms), no fixed sleeps; poke is JS
    run after each look that came out false (a tap through a message, say). False when the time ran out"""
    js = f'()=>{{try{{if({cond})return true}}catch(e){{}}' + (f'try{{{poke}}}catch(e){{}}' if poke else '') + 'return false}'
    try:
        pg.wait_for_function(js, timeout=sec * 1000, polling=poll)
        return True
    except Exception as e:
        if 'Timeout' not in type(e).__name__ and 'Timeout' not in str(e): raise
        return False


def frames(pg, n=2, sec=30):
    """n more frames of the walk view drawn; False if they didn't come in sec seconds"""
    f0 = pg.evaluate("typeof walkRenderer!=='undefined'&&walkRenderer.on?walkRenderer.frames:-1")
    return f0 < 0 or until(pg, f'walkRenderer.frames>={f0 + n}', sec)


def drawing(pg, n=3, sec=40):
    """the walk view is ready (a boot may take a while: 90 s) and draws n more frames"""
    if not until(pg, "typeof walkView!=='undefined'&&walkView.ready&&walkRenderer.on", 90): raise Exception('the walk view never got ready')
    f0 = pg.evaluate('walkRenderer.frames')
    if not until(pg, f'walkRenderer.frames>={f0 + n}', sec): raise Exception(f'{pg.evaluate("walkView.id")} isn’t drawing (black screen)')


def stand(pg, x, z, frames=30):
    """put the player at (x, z) and let the camera settle there (no glide in: its target is reset)"""
    pg.evaluate(f"(()=>{{const P=walkView.pl;P.x={x};P.z={z};P.route=null;P.yv=null;walkRenderer.camT=null;return 0}})()")
    f0 = pg.evaluate('walkRenderer.frames')
    if not until(pg, f'walkRenderer.frames>={f0 + frames}', 60): raise Exception(f'{pg.evaluate("walkView.id")} isn’t drawing')


def go_scene(pg, node, sec=40):
    """a jump to the place at node, not a walk, then wait until its scene is open and draws (a neighbour's view would
    otherwise be prepared a few milliseconds a frame, which at a frame every few seconds here takes minutes)"""
    pg.evaluate(f"uiState.inside=null;uiState.tab='walk';saveData.trip={{node:{node},plan:[]}};saveData.visited[{node}]=1;uiState.roam=null;if(typeof walkView!=='undefined'&&walkView.pl)walkView.pl.fresh=true;render();0")
    # the hub may sit near an exit, so the view may be the scene with its road (baseId)
    if not until(pg, f'!!(walkView.ready&&(walkView.id===LOCATIONS[{node}].mapId||(walkView.sc&&walkView.sc.baseId===LOCATIONS[{node}].mapId)))', sec):
        raise Exception(f'{pg.evaluate(f"LOCATIONS[{node}].mapId")} didn’t open in {sec}s')
    if not frames(pg, 2, 30): raise Exception(f'{pg.evaluate("walkView.id")} isn’t drawing (black screen)')

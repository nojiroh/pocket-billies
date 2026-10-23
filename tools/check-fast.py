#!/usr/bin/env python3
"""The fast check of Pocket Billies: only what must never break, in one to three minutes on a headless machine. Claude
Code runs it after a change and CI on every push.

    python3 tools/check-fast.py                  # every check
    python3 tools/check-fast.py --workers=2      # browser checks side by side in this many browsers (default 2)
    python3 tools/check-fast.py --only=battle,save   # only the checks whose names hold these words

Without a browser (Node): the game data is valid, and the world-map graph is unchanged (tools/test/world-graph.test.mjs
and its snapshot). In a browser, each check opens its own page straight where it needs to be (?fixture=<name>,
game/js/fixture.js), never through the opening and never waiting for every map: the game boots with no console or page
errors; a town and a room each open and draw frames (RL-5: the hub, Copperleaf; the route and the cave were parked
with their places); a run's world (RL-7) opens on its landing, its places on the bowl, and a walk over a seam arrives
at the next node a day later; a battle plays to the end; a save round-trips; the Studio loads; the exported debug
log holds no names; the world map opens as the bowl, a tap opens a card, Home comes back; every screen opens with its parts (UI-5);
on tall ground (TR-3, the mountains fixture) the camera rises, rock fades and the player's silhouette is drawn, and
none of it on flat ground; the Lab's unlock board (RL-11) grants, sells and keeps; the test island (island track) opens with its contract fields, and its orbit camera (IS-1) looks at the middle from 8 places, holds on the summit and walks a circle when you hold right; the Studio's Hub island editor draws, turns, paints and locks (IS-6a). The page is small (400x300) with every costly graphics dial
off before it loads; nothing waits a fixed time, only for frames or the game's state. No pictures are taken.

Graphics are not judged here: software drawing can't. The game's own graphics test (Settings → Help) is for a person
on a real device and is never run from a script."""
import json, math, queue, socket, subprocess, sys, threading, time
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


# UI-5: the bottom bar is the kit's <pb-nav-bar id="nav">; its buttons sit in its shadow tree, one per tab (data-t)
NAV_BUTTON = "document.querySelector('#nav')?.shadowRoot?.querySelector('button[data-t={t}]')"
def nav_tap(t):
    """a tap on the bottom bar's tab t, as a player taps it (the open tab tapped again goes back to the world)"""
    return f"(()=>{{const b={NAV_BUTTON.format(t=t)};if(!b)return false;b.click();return true}})()"


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


def walk_over(pg, n1, past, sec=60):
    """RL-7: walk from where you stand out of the exit to the place n1 and on `past` metres, the way check-quick.py's
    cross() does (a path, the player put along it 0.8 m at a time, walkCross() after each); True once you are in n1"""
    R = pg.evaluate("""(([to, past]) => {
      const v = walkState(), e = (v.exits || []).find(e => e.to === to);
      if (!e) return 'no exit to ' + LOCATIONS[to].name + ' from ' + LOCATIONS[saveData.trip.node].name;
      const sc = walkView.sc, pt = sc.exits[e.i],
        ee = (sc.edgeExits || (sc.baseId && mapById(sc.baseId) || {}).edgeExits || [])[e.i], sv = SIDE_VECTORS[ee.side],
        P = walkView.pl, R = findPath(P.x, P.z, pt[0] + sv[0] * past, pt[1] + sv[1] * past, { max: 1e6 });
      return R || 'no path to the exit to ' + LOCATIONS[to].name;
    })""", [n1, past])
    if isinstance(R, str): raise Exception(R)
    for a, b in zip(R, R[1:]):
        d = ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** .5; k = max(1, int(d / .8))
        for j in range(1, k + 1):
            if not until(pg, 'walkView.ready', sec): raise Exception(f'the view {pg.evaluate("walkView.id")} went unready on the way')
            x = a[0] + (b[0] - a[0]) * j / k; z = a[1] + (b[1] - a[1]) * j / k
            if pg.evaluate(f"(()=>{{walkView.pl.x={x};walkView.pl.z={z};walkView.pl.route=null;walkCross();return saveData.trip.node==={n1}}})()"): return True
    return False


def run_world(pg, base):
    """RL-7: the run fixture boots on its landing (day 1), its world made from the seed at boot: Copperleaf and a place
    per node, the landing's view drawing; the Map tab opens as the bowl with every place on it; a walk over the
    landing's west seam (the way ahead; rules.json run.seamIn metres in) arrives at the next node on day 2 and opens its view"""
    drawing(pg)
    seed, scenes, ms, places, want, node, day, view = pg.evaluate("[runWorld.seed, runWorld.scenes, runWorld.ms, LOCATIONS.length, 1 + saveData.run.map.nodes.length, saveData.trip.node, saveData.run.clock, walkView.id]")
    if seed != 'RL7FIXTURE' or places != want: raise Exception(f"the run's world isn't in: {places} places for {want}, made from {seed!r}")
    if node != 1 or day != 1: raise Exception(f'not on the landing on day 1: node {node}, day {day}')
    if view != pg.evaluate("'w:' + LOCATIONS[1].mapId + '*'"): raise Exception(f'the landing’s view isn’t open: {view}')
    if not until(pg, "!document.getElementById('loader')", 30): raise Exception('the loading screen never went')
    bar = pg.evaluate("document.querySelector('#nav').set")
    if bar != 'run': raise Exception(f"the bottom bar shows the {bar} tabs on a run")
    if not pg.evaluate(nav_tap('map')): raise Exception('no Map tab on the bottom bar')
    if not until(pg, "typeof worldBowl!=='undefined'&&worldBowl.on&&worldBowl.frames>=3&&!!worldBowl.spots&&worldBowl.spots.length===LOCATIONS.length", 30):
        raise Exception('the map didn’t open as the bowl with the run’s places')
    pg.evaluate(nav_tap('map'))   # the open tab again: back to the world
    drawing(pg)
    n1 = pg.evaluate("runWorldNode(runNext(saveData.run.map, 0)[0])")
    if not walk_over(pg, n1, pg.evaluate('RULES.run.seamIn') + 6): raise Exception(f'walked toward {pg.evaluate(f"LOCATIONS[{n1}].name")} and never crossed')
    if pg.evaluate('saveData.run.clock') != 2: raise Exception(f'arrived on day {pg.evaluate("saveData.run.clock")}, not 2')
    if not until(pg, f"walkView.ready&&walkView.id==='w:'+LOCATIONS[{n1}].mapId+'*'", 60): raise Exception(f'crossed but the view is still {pg.evaluate("walkView.id")}')
    return f'{scenes} scenes made in {ms} ms; walked into {pg.evaluate(f"LOCATIONS[{n1}].name")} on day 2'


def bowl_map(pg, base):
    """phase 10: the Map tab opens as the bowl (world-bowl.js) and keeps drawing; a tap on a place's pin opens its card,
    and Home brings the camera back over you. Small page, graphics off, no pictures: on a device, the debug menu's
    Bowl map test checks the rest (frame rate, every place)"""
    # from the walk scene by its tab button: the walk camera rises, the bowl pulls back from right above you
    if not until(pg, f"!!{NAV_BUTTON.format(t='map')}&&typeof walkRenderer!=='undefined'&&walkRenderer.on", 90): raise Exception('the walk scene never got ready')
    # RL-5: and the loading screen gone (it takes a few seconds to fade; the route and cave checks that ran before this
    # one on this page went with their places)
    if not until(pg, "!document.getElementById('loader')", 30): raise Exception('the loading screen never went')
    z0 = pg.evaluate("typeof walkRenderer!=='undefined'?walkRenderer.zoomT:null")
    pg.evaluate("uiState.mapSel=null;0"); pg.evaluate(nav_tap('map'))
    if not until(pg, "typeof worldBowl!=='undefined'&&worldBowl.on&&worldBowl.frames>=3", 30):
        raise Exception('the map didn’t open as the bowl' + (' (the old map opened)' if pg.evaluate("worldMap.gl") else ''))
    if not until(pg, "!worldBowl.tween&&!document.getElementById('mapfade')", 10): raise Exception('the zoom out from the walk scene never settled')
    # touches must reach the map: its layer fills the screen and some of it is not under the card or the buttons (on a
    # phone-sized page: this page's 300 px are mostly card)
    pg.set_viewport_size({'width': 400, 'height': 760}); time.sleep(.5)
    # a postcard that came while walking (postcards.js: 3 s of calm in Copperleaf, shown 9 s) lies over everything until
    # it closes by itself; none comes on the Map tab. It made this check fail now and then (once in six here, and in CI)
    if not until(pg, "!document.querySelector('.pcard-wrap')", 15): raise Exception('a postcard never closed')
    hit = pg.evaluate("(()=>{const r=worldMap.cv.getBoundingClientRect();if(r.height<innerHeight*.9)return 'a map layer '+Math.round(r.height)+' px high';for(const fy of [.2,.3,.4,.5])for(const fx of [.3,.5,.7]){const e=document.elementFromPoint(innerWidth*fx,innerHeight*fy);if(e===worldMap.cv)return ''}const e=document.elementFromPoint(innerWidth/2,innerHeight/2),p=e&&e.parentElement;return e?e.tagName+'#'+e.id+'.'+e.className+(e.src?' src '+String(e.src).split('/').pop().slice(0,40):'')+' in '+(p?p.tagName+'#'+p.id+'.'+p.className:'?'):'nothing'})()")
    if hit: raise Exception(f'a touch on the map lands on {hit}, not the map')
    pg.set_viewport_size({'width': 400, 'height': 300})
    # the ground's terrain map fills and the terrain pictures go up (graphics off: nothing is judged by eye)
    if not until(pg, "!!(worldBowl.ground&&worldBowl.ground.terrain&&worldBowl.ground.terrain.ready&&worldBowl.ground.ok)", 60): raise Exception('the terrain never got ready')
    # calm ground (fix 2026-10-19): few single squares of another ground in the middle of the map (it read as camouflage)
    sp = pg.evaluate("(()=>{const I=worldBowl.ground.terrain.idx,N=2048;let s=0,n=0;for(let j=600;j<1450;j++)for(let i=600;i<1450;i++){const v=I[j*N+i];n++;if(I[j*N+i+1]!==v&&I[j*N+i-1]!==v&&I[(j+1)*N+i]!==v&&I[(j-1)*N+i]!==v)s++}return s/n})()")
    if sp > 0.07: raise Exception(f'the ground is speckled: {sp * 100:.1f}% single squares')
    # the sea (look session 1): a water sheet (RL-8b: round the hub's island), its shader in the same programs
    if not pg.evaluate("!!(worldBowl.ground.water&&gpuState.P.mwater)"): raise Exception('the sea isn’t drawn')
    # look session 2: the shadow map, the routes' and rivers' line map and the rivers
    # RL-8b: the hub is an island (worldmap.json sea.island): a river or two, not four; IS-7: none on an island drawn
    # from its own map (its stream is its own)
    if not until(pg, "!!(worldBowl.ground.shadow&&worldBowl.ground.shadow.t&&worldBowl.ground.lines&&(worldBowl.ground.G.rivers||[]).length>=(worldBowl.ground.islandMap?0:worldBowl.ground.isle?1:4))", 20): raise Exception('no shadow map, route lines or rivers')
    # look session 3: the clouds follow the setting (Off: none; High: 40), the shaders draw with them
    for lv, want in (('off', 0), ('high', 40)):
        pg.evaluate(f"saveData.preferences.mapClouds='{lv}';worldBowl.dirty=true;0")
        if not until(pg, f"!!(worldBowl.skyState&&worldBowl.skyState.level==='{lv}'&&worldBowl.skyState.clouds.length==={want})", 10): raise Exception(f'the clouds don’t follow the setting {lv}')
    if not pg.evaluate("!!(gpuState.P.mcloud&&gpuState.P.mfall)"): raise Exception('the cloud shaders are missing')
    # a storm everywhere: clouds show, rain falls (then the weather goes back to the game's own)
    pg.evaluate("environment.force={weather:'storm'};worldBowl.skyState.at=-1e9;worldBowl.skyState.grid=null;worldBowl.dirty=true;0")
    if not until(pg, "worldBowl.skyState.shown>10&&worldBowl.skyState.nFall>0", 15): raise Exception('a storm shows no clouds or rain on the map')
    pg.evaluate("environment.force=null;worldBowl.skyState.at=-1e9;0")
    # look session 4: landmarks far out, buildings and trees close in (over Copperleaf, the hub, zoomed right in)
    pg.evaluate("(()=>{const t=LOCATIONS.findIndex(l=>l.id==='copperleaf'),p=worldBowl.spots[t];worldBowl.goal=null;worldBowl.tween=null;worldBowl.cam=bowlCamClamp({...bowlCamHome(p.x,p.y),dist:.45});worldBowl.dirty=true})();0")
    if not until(pg, "(()=>{const W=worldBowl.ground.things;return !!(W&&W.gpu&&W.gpu.ns>0&&W.tris>0&&W.done.size>0&&Object.keys(W.gpu.kinds).some(k=>k.startsWith('m:')))})()", 30): raise Exception('no landmarks, buildings or trees on the map')
    f1 = pg.evaluate("worldBowl.frames"); until(pg, f"worldBowl.frames>={f1 + 2}", 10)
    err = pg.evaluate("gpuState.gl.getError()")
    if err: raise Exception(f'the GPU reports error {err} while drawing the bowl')
    n = pg.evaluate("LOCATIONS.length"); s = pg.evaluate("(worldBowl.spots||[]).filter(s=>isFinite(s.x)&&isFinite(s.y)).length")
    if s != n: raise Exception(f'{s} of {n} places have a spot on the bowl')
    pick = pg.evaluate("""(()=>{const t=LOCATIONS.findIndex(l=>l.id==='copperleaf'),p=worldBowl.spots[t];worldBowl.goal=null;worldBowl.cam=bowlCamHome(p.x,p.y);worldBowl.dirty=true;return t})()""")
    f0 = pg.evaluate("worldBowl.frames")
    if not until(pg, f"worldBowl.frames>={f0 + 2}&&(worldBowl.marks||[]).some(m=>m.i==={pick})", 20): raise Exception('the bowl stopped drawing')
    pg.evaluate(f"(()=>{{const r=worldMap.cv.getBoundingClientRect(),m=worldBowl.marks.find(m=>m.i==={pick});worldBowlPick({{clientX:r.left+m.top.x,clientY:r.top+(m.top.y+m.base.y)/2}})}})();0")
    if not until(pg, f"uiState.mapSel==={pick}&&document.querySelector('#mapcard').textContent.includes(LOCATIONS[{pick}].name)", 5):
        raise Exception(f'tapping Copperleaf’s pin picked {pg.evaluate("uiState.mapSel")}')
    pg.evaluate("uiState.mapSel=null;worldBowl.cam=bowlCamOverview();worldMapReset();0")
    if not until(pg, "!worldBowl.goal&&(()=>{const p=worldBowl.spots[saveData.trip.node];return Math.hypot(worldBowl.cam.tx-p.x,worldBowl.cam.ty-p.y)<.01})()", 15):
        raise Exception('Home didn’t bring the camera back')
    fr = pg.evaluate("worldBowl.frames")
    # the opening fall films the bowl (one frame of it, mid-fall)
    pg.evaluate("worldBowlFilm(fallCamera(.5,400,300),performance.now());0")
    pg.evaluate("uiState.tab='walk';render();0")
    if z0 is not None and not until(pg, f"Math.abs(walkRenderer.zoomT-{z0})<1e-6", 10): raise Exception(f'the walk camera’s zoom didn’t come back ({pg.evaluate("walkRenderer.zoomT")}, was {z0})')
    # an airship flight over the bowl, skipped to the end: you land at the mast (RL-5: Copperleaf to itself, the hub's one
    # town; RL-8 flies from it to a run)
    to = pg.evaluate("(()=>{const i=LOCATIONS.findIndex(l=>l.id==='copperleaf');saveData.visited[i]=1;saveData.se+=100000;startAirshipFlight(i);return i})()")
    if not until(pg, "airshipFlight.on&&worldBowl.on", 15): raise Exception('the flight didn’t show on the bowl')
    f1 = pg.evaluate("worldBowl.frames")
    if not until(pg, f"worldBowl.frames>{f1}||!airshipFlight.on", 15): raise Exception('the bowl stopped drawing during the flight')
    pg.evaluate("flySkip();0")
    if not until(pg, f"!airshipFlight.on&&saveData.trip.node==={to}&&uiState.tab==='walk'", 30): raise Exception('the flight never landed')
    return f'{n} places on the bowl, {fr} frames; opened from the walk scene; a tap opens the card, Home comes back; the fall films it; a flight lands'


def island(pg, base):
    """island track IS-0: the island fixture opens test_island (the island contract's fields: cam.orbit, island,
    zones, islandGen, a sea edge) and draws; you stand on open ground; its walking checks hold (the top and the north
    side reachable, the sea not). IS-3: the sea skirt reaches the horizon at the sea's level; it draws from 8 angles"""
    if not until(pg, "typeof walkView!=='undefined'&&walkView.ready&&walkView.id==='test_island'", 90): raise Exception(f'not on the test island: {pg.evaluate("typeof walkView!==\'undefined\'&&walkView.id")}')
    drawing(pg)
    if not pg.evaluate("!!(walkView.sc.cam&&walkView.sc.cam.orbit&&walkView.sc.island&&walkView.sc.zones&&walkView.sc.islandGen)"): raise Exception('the island contract fields didn’t reach the scene')
    res = pg.evaluate("testMapChecks('test_island')")
    bad = [r['what'] for r in res if not r['ok']]
    if bad: raise Exception('walking checks failed: ' + '; '.join(bad))
    # IS-3: the sea all round: one skirt out to the horizon at the sea's level, and the scene draws looking in from
    # over the sea at 8 angles round the island (the Studio's free camera hook, so the walk camera is left alone)
    sk = pg.evaluate("walkRenderer.seaSkirt&&{out:walkRenderer.seaSkirt.out,rings:walkRenderer.seaSkirt.rings,level:walkRenderer.seaSkirt.level}")
    if not sk or sk['out'] < 380: raise Exception(f'no sea skirt out to the horizon: {sk}')
    if abs(sk['level'] - pg.evaluate("walkRenderer.wlevel")) > 0.05: raise Exception(f"the skirt lies at {sk['level']}, the sea at {pg.evaluate('walkRenderer.wlevel')}")
    for k in range(8):
        f = pg.evaluate("walkRenderer.frames")
        pg.evaluate(f"(()=>{{const a={k}*Math.PI/4;walkView.opt.look=()=>({{eye:[60-Math.sin(a)*75,30,60-Math.cos(a)*75],tgt:[60-Math.sin(a)*20,0,60-Math.cos(a)*20],fov:60}})}})()")
        if not until(pg, f"walkRenderer.frames>{f}+2", 20): raise Exception(f'stopped drawing looking in from {k * 45} degrees')
    pg.evaluate("delete walkView.opt.look")
    orbit = island_orbit(pg)
    return f'test_island drew {pg.evaluate("walkRenderer.frames")} frames; {len(res)} walking checks hold; the sea skirt has {sk["rings"]} rings out to {sk["out"]:.0f} m and draws from 8 angles; {orbit}'


# IS-1: the camera's yaw (0 looking north) and the wrapped difference between two angles, in the page
WRAP = "((a)=>a-2*Math.PI*Math.floor((a+Math.PI)/(2*Math.PI)))"


def island_orbit(pg):
    """island track IS-1: the orbit camera on test_island (middle 60, 60; dead zone 3 m; turn 30 degrees). From 8 places
    round the coast it looks at the middle and follows you past the scene's edge (no clamp); on the summit it holds
    still; holding right walks round the middle on the same circle, the yaw turning smoothly"""
    if not pg.evaluate("!!walkRenderer.orbit"): raise Exception('no orbit on the island')
    if abs(pg.evaluate("cameraTurnLimit()*180/Math.PI") - 30) > 1e-6: raise Exception("your turn limit isn't the map's 30 degrees")
    pg.evaluate("walkRenderer.yawT=walkRenderer.yaw=0;0")
    for i in range(8):
        cut = f"(()=>{{const a={i}*Math.PI/4,P=walkView.pl;P.x=60-Math.sin(a)*44;P.z=60-Math.cos(a)*44;P.route=null;walkRenderer.camT=null;return 0}})()"
        pg.evaluate(cut)
        f0 = pg.evaluate('walkRenderer.frames')
        if not until(pg, f'walkRenderer.frames>={f0 + 2}', 30): raise Exception('the island stopped drawing')
        off = pg.evaluate(f"Math.abs({WRAP}(walkView.C.yaw-{i}*Math.PI/4))")
        if off > 0.06: raise Exception(f'at {i * 45} degrees round the camera is {off:.2f} rad off the middle')
        lag = pg.evaluate("Math.hypot(walkView.C.tgt[0]-walkView.pl.x,walkView.C.tgt[2]-walkView.pl.z)")
        if lag > 4: raise Exception(f'at {i * 45} degrees round the camera aims {lag:.1f} m from you (held inside the scene?)')
    # the summit: the yaw holds what it had
    pg.evaluate("walkView.pl.x=60;walkView.pl.z=16;walkRenderer.camT=null;0")
    f0 = pg.evaluate('walkRenderer.frames'); until(pg, f'walkRenderer.frames>={f0 + 2}', 30)
    pg.evaluate("walkView.pl.x=60.5;walkView.pl.z=61;0")
    f0 = pg.evaluate('walkRenderer.frames')
    if not until(pg, f'walkRenderer.frames>={f0 + 6}', 30): raise Exception('the island stopped drawing')
    if not pg.evaluate("walkRenderer.orbit.hold&&Math.abs(walkView.C.yaw)<0.02"): raise Exception(f'on the summit the camera turned: {pg.evaluate("walkView.C.yaw")}')
    # holding right from the south: an eighth of the way round on the same circle, no jump in the yaw
    pg.evaluate("walkView.pl.x=60;walkView.pl.z=16;walkRenderer.camT=null;window.__orb={y:[],a0:0};0")
    f0 = pg.evaluate('walkRenderer.frames'); until(pg, f'walkRenderer.frames>={f0 + 2}', 30)
    pg.evaluate("walkView.stick={x:1,y:0};walkView.run=true;0")
    gone = "Math.abs(Math.atan2(walkView.pl.x-60,walkView.pl.z-60))"
    t0 = time.time(); ys = []
    while time.time() - t0 < 60:
        ys.append(pg.evaluate("walkView.C.yaw"))
        if pg.evaluate(f"{gone}<Math.PI*0.75"): break
        pg.wait_for_timeout(100)
    pg.evaluate("walkView.stick=null;walkView.run=false;0")
    turned = pg.evaluate(f"Math.PI-{gone}")
    if turned < 0.7: raise Exception(f'holding right walked only {turned:.2f} rad round in 60 s')
    r = pg.evaluate("Math.hypot(walkView.pl.x-60,walkView.pl.z-60)")
    if abs(r - 44) > 1: raise Exception(f'holding right drifted from the 44 m circle to {r:.2f} m')
    jump = max((abs((ys[k] - ys[k - 1] + math.pi) % (2 * math.pi) - math.pi) for k in range(1, len(ys))), default=0)
    if jump > 0.35: raise Exception(f'the yaw jumped {jump:.2f} rad between two looks')
    return f'the orbit looks at the middle from 8 places, holds on the summit, holding right went {turned:.2f} rad round at {r:.2f} m'


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


def run_loop(pg, base):
    """RL-8: on the run fixture's landing, a wild battle begins and the save holds it (phase 'battle', stored at once);
    a reload (?fixture=stored) starts the same battle again from its seed; lost, the run ends: the payout screen with
    its rows and a keep-one card per Billie; a reload there opens it again (the run still on the save, nothing paid
    yet); one card picked, "Fly home": back in Copperleaf by the mast, the hub's world in, the run's Capital in meta"""
    drawing(pg)
    if not until(pg, "!document.getElementById('loader')", 30): raise Exception('the loading screen never went')
    seed = pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();startWild(encountersHere()[0]);activeBattle&&activeBattle.seed")
    if not seed: raise Exception('no seeded battle began on the run')
    stored = pg.evaluate("(r=>r&&r.run.at)(JSON.parse(localStorage.getItem(SAVE_KEY)))")
    if not stored or stored.get('phase') != 'battle' or not stored.get('foe'): raise Exception(f'the battle’s start isn’t stored: {stored}')
    pg.goto(base + '/index.html?fixture=stored')
    if not until(pg, '!!activeBattle', 90): raise Exception('a reload mid-battle didn’t start the battle again')
    again = pg.evaluate('activeBattle.seed')
    if again != seed: raise Exception(f'started again with seed {again}, not {seed}')
    pg.evaluate("stopTimers();activeBattle.over='lose';endBattle();0")
    if not until(pg, "!!uiState.modal&&uiState.modal.cls==='run-payout'&&!!document.querySelector('#ov pb-payout')", 30): raise Exception('no payout screen after the loss')
    rows, cards = pg.evaluate("[document.querySelector('#ov pb-payout').rows.length,document.querySelectorAll('#ov pb-pick-card').length]")
    if rows < 4 or cards != pg.evaluate('saveData.team.length'): raise Exception(f'the payout: {rows} rows, {cards} cards')
    pg.goto(base + '/index.html?fixture=stored')
    if not until(pg, "!!uiState.modal&&uiState.modal.cls==='run-payout'&&!!document.querySelector('#ov pb-payout')", 90): raise Exception('a reload at the payout didn’t open it again')
    again = pg.evaluate("[document.querySelector('#ov pb-payout').rows.length,document.querySelectorAll('#ov pb-pick-card').length,saveData.run&&saveData.run.at.phase,saveData.meta.runs]")
    if again != [rows, cards, 'payout', 0]: raise Exception(f'after a reload at the payout: rows, cards, phase, runs {again}')
    pg.evaluate("document.querySelector('#ov pb-pick-card').shadowRoot.querySelector('button').click();0")
    if not until(pg, "!document.querySelector('#ov [data-a=mb]').disabled", 10): raise Exception('picking a card didn’t enable Fly home')
    pg.evaluate("document.querySelector('#ov [data-a=mb]').click();0")
    if not until(pg, "!saveData.run&&LOCATIONS.length===1&&saveData.meta.runs===1", 30): raise Exception('Fly home didn’t end the run')
    home = pg.evaluate("[saveData.meta.capital, !!uiState.roam, saveData.trip.node]")
    if home[0] <= 0 or not home[1] or home[2] != 0: raise Exception(f'home: capital {home[0]}, by the mast {home[1]}, node {home[2]}')
    return f'a battle held as it began ({seed}), started again after a reload, lost: the payout ({rows} rows, {cards} cards), again after a reload, home with {home[0]} Capital'


# TR-3: the reachable spot with the most ground above the player's head on the camera's side (smaller z), 3-14 m off
TALL_SPOT = """(() => {
  const sc = walkView.sc, P = walkView.pl, c = [];
  for (let x = 4; x < sc.w - 4; x += 1.5)
    for (let z = 4; z < sc.h - 4; z += 1.5) {
      const h = standingHeightAt(x, z);
      let up = 0;
      for (let s = 3; s <= 14; s += 1) up = Math.max(up, standingHeightAt(x, z - s) - h);
      if (up > 3) c.push([up, x, z]);
    }
  c.sort((a, b) => b[0] - a[0]);
  for (const [up, x, z] of c.slice(0, 80)) {
    const R = findPath(P.x, P.z, x, z, { max: 1e6 });
    if (R) { const e = R[R.length - 1]; return { up: +up.toFixed(1), x: e[0], z: e[1], h: +standingHeightAt(e[0], e[1]).toFixed(1) }; }
  }
  return null;
})()"""


def stand(pg, x, z, frames=30):
    """put the player at (x, z) and let the camera settle there (no glide in: its target is reset)"""
    pg.evaluate(f"(()=>{{const P=walkView.pl;P.x={x};P.z={z};P.route=null;P.yv=null;walkRenderer.camT=null;return 0}})()")
    f0 = pg.evaluate('walkRenderer.frames')
    if not until(pg, f'walkRenderer.frames>={f0 + frames}', 60): raise Exception(f'{pg.evaluate("walkView.id")} isn’t drawing')


def tall_ground(pg, base):
    """TR-3: the mountains fixture (the run fixture with the debug menu's mountains mod: mountains north and south) at
    its landing; at the reachable spot with the most rock on the camera's side the camera tilts down further (rise),
    the rock between it and the player thins out (the rock fade's circle is on) and the player's silhouette is drawn;
    back where the player started (flat ground) none of it. No pictures: tools/look-tall-ground.py takes those"""
    drawing(pg)
    if not until(pg, "!document.getElementById('loader')", 30): raise Exception('the loading screen never went')
    if pg.evaluate("(((mapById(walkView.sc.baseId||walkView.id).gen||{}).params||{}).land||{}).mountains||0") != 1: raise Exception('the landing has no mountains: the mod isn’t on')
    home = pg.evaluate('[walkView.pl.x, walkView.pl.z]')
    spot = pg.evaluate(TALL_SPOT)
    if not spot: raise Exception('no reachable spot with rock on the camera’s side')
    pg.evaluate("(()=>{const f=drawPlayerSilhouette;window.__sil=0;drawPlayerSilhouette=(...a)=>{const r=f(...a);window.__sil+=r;return r};return 0})()")
    stand(pg, spot['x'], spot['z'])
    rise, k, circle, sil = pg.evaluate("[walkRenderer.occT, walkView.C.rockK, rockUniformsFor(walkView.C).rock[1], window.__sil]")
    if not (rise > 1): raise Exception(f'the camera didn’t rise at the foot of {spot["up"]} m of rock: {rise}')
    if not (k > 0.9 and circle > 0): raise Exception(f'the rock fade isn’t on there: rockK {k}, circle {circle}')
    if not sil: raise Exception('no silhouette was drawn there')
    stand(pg, home[0], home[1], 60)
    rise2, k2, circle2, sil0 = pg.evaluate("[walkRenderer.occT, walkView.C.rockK, rockUniformsFor(walkView.C).rock[1], window.__sil]")
    stand(pg, home[0], home[1], 5)
    if pg.evaluate('window.__sil') != sil0 or circle2 != 0 or rise2 > 0.05: raise Exception(f'on flat ground: rise {rise2}, rockK {k2}, circle {circle2}, silhouettes still drawn')
    return f'at the foot of {spot["up"]} m of rock: the camera rose {rise:.1f} degrees, the rock fade and the silhouette on; on flat ground off'


def ranch(pg, base):
    """RL-9: the ranch fixture stands in Copperleaf's barn. The training board opens the ranch's sheet; Train on a
    stored Billie pays the Scrap and starts it; two hours later (the page's clock moved on) the sheet opened again has
    collected a level; the one two levels under the cap, trained for a whole bank, stops at the cap; the clock turned
    back gains nothing and leaves the trainees' starts where they were; forward again a minute past them pays only that
    minute (RL-10b: RL-9 moved the starts back, so this paid a whole bank); a reload (?fixture=stored) keeps it all"""
    if not until(pg, "!!uiState.inside&&uiState.inside.kind==='ranch'&&walkView.ready", 60): raise Exception(f'not in the ranch: {pg.evaluate("walkView.id")}')
    pg.evaluate("window.__d0=Date.now;window.__shift=0;Date.now=()=>__d0.call(Date)+__shift;0")
    board = "(()=>{const p=walkView.sc.props.find(q=>q.act==='ranch'&&q.k==='blackboard');uiState.modal=null;uiState.mq=[];walkPick({k:'act',p,act:'ranch'});return !!(uiState.modal&&uiState.modal.cls==='ranch-sheet'&&document.querySelector('#ov .ranch-sheet'))})()"
    R = pg.evaluate("RULES.ranch"); H = 3600000
    if not pg.evaluate(board): raise Exception('the training board didn’t open the ranch’s sheet')
    lv = lambda i: pg.evaluate(f"saveData.box[{i}].lvl")
    first, last = lv(0), lv(2)
    for i in (0, 2):
        uid = pg.evaluate(f"saveData.box[{i}].uid")
        pg.click(f"#ov .ranch-sheet [data-r=train][data-u='{uid}']")
    st = pg.evaluate("[saveData.meta.scrap,saveData.ranch.trainees.length]")
    if st != [50 - 2 * R['trainCost'], 2]: raise Exception(f'after two Trains: Scrap and trainees {st}')
    pg.evaluate(f"__shift={int(2 * H / (2 * R['levelsPerHour']))};0")   # a level's time
    if not pg.evaluate(board): raise Exception('the sheet didn’t open again')
    if lv(0) != first + 1: raise Exception(f'a level’s time gave Lv {first} → {lv(0)}')
    pg.evaluate(f"__shift={20 * H};0")
    pg.evaluate(board)
    cap = pg.evaluate("ranchCap(saveData,RULES.ranch)")
    if lv(2) != cap: raise Exception(f'trained a whole bank from Lv {last}: Lv {lv(2)}, the cap is {cap}')
    if lv(0) > first + 1 + R['bankHours'] * R['levelsPerHour']: raise Exception(f'more than a bank: Lv {lv(0)}')
    got = lv(0)
    at0 = pg.evaluate("saveData.ranch.trainees.map(t=>t.at)")
    pg.evaluate(f"__shift={-30 * H};0")
    pg.evaluate(board)
    at = pg.evaluate("saveData.ranch.trainees.map(t=>t.at)")
    if lv(0) != got or at != at0: raise Exception(f'the clock turned back: Lv {got} → {lv(0)}, starts {at0} → {at}')
    pg.evaluate(f"__shift={20 * H + 60000};0")
    pg.evaluate(board)
    if lv(0) != got: raise Exception(f'forward again a minute past the starts: Lv {got} → {lv(0)} (the gap paid)')
    keep = pg.evaluate("JSON.stringify([saveData.meta.scrap,saveData.ranch.trainees.map(t=>t.uid),saveData.box.map(m=>m.lvl)])")
    pg.goto(base + '/index.html?fixture=stored')
    if not until(pg, "typeof saveData!=='undefined'&&!!saveData.ranch&&!document.getElementById('loader')", 90): raise Exception('the reload never booted')
    back = pg.evaluate("JSON.stringify([saveData.meta.scrap,saveData.ranch.trainees.map(t=>t.uid),saveData.box.map(m=>m.lvl)])")
    if back != keep: raise Exception(f'after a reload {back}, not {keep}')
    return f'Train paid {R["trainCost"]} Scrap each; a level’s time: Lv {first} → {first + 1}; a whole bank from Lv {last} stopped at the cap ({cap}); the clock turned back gained nothing, and forward again paid no gap; a reload kept it'


def relics(pg, base):
    """RL-12: the relics fixture is on a run holding five Loopholes with a mini-boss's pick waiting: the pick opens once
    the world shows, three cards; one taken: six held, the pick gone, stored; the Loopholes tab lists them; a battle
    starts with the Speed stage and the catch row; walking in heals; a town's clinic charges half and its shop sells the
    day's Loophole 15% cheaper; bought at the cap, one is let go; a mini-boss beaten stores a new pick before its sheet,
    whose button opens it; a reload (?fixture=stored) opens the same pick; Take none clears it"""
    pick = "!!uiState.modal&&uiState.modal.cls==='relic-pick'&&document.querySelectorAll('#ov pb-pick-card').length===3"
    stored = lambda: pg.evaluate("JSON.parse(localStorage.getItem(SAVE_KEY)).run")
    if not until(pg, pick, 90): raise Exception('the waiting pick didn’t open')
    offer = pg.evaluate("saveData.run.offer.slice()")
    pg.evaluate("document.querySelectorAll('#ov pb-pick-card')[1].shadowRoot.querySelector('button').click();0")
    if not until(pg, "!document.querySelector('#ov [data-a=mb]').disabled", 10): raise Exception('a card didn’t enable Take it')
    pg.evaluate("document.querySelector('#ov [data-a=mb]').click();0")
    took = offer[1]
    if not until(pg, f"saveData.run.relics.length===6&&saveData.run.relics.includes('{took}')&&!saveData.run.offer&&!(uiState.modal&&uiState.modal.cls==='relic-pick')", 10):
        raise Exception(f'taking {took}: {pg.evaluate("JSON.stringify([saveData.run.relics,saveData.run.offer])")}')
    if len(stored()['relics']) != 6: raise Exception('the pick wasn’t stored')
    pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();uiState.tab='relics';render();0")
    if not until(pg, "document.querySelectorAll('.s-relics .bag-row').length===6", 10): raise Exception('the Loopholes tab doesn’t list six')
    pg.evaluate("uiState.tab='walk';render();0")
    st = pg.evaluate("startWild(encountersHere()[0]);[!!activeBattle.fx,activeBattle.sides[0].f[0].v.st.hus]")
    if st != [True, 1]: raise Exception(f'a battle’s Loopholes and Speed stage: {st}')
    odds = pg.evaluate("[catchOdds('penny',1,false),(activeBattle.fx=null,catchOdds('penny',1,false))]")
    if abs(odds[0] - min(1, odds[1] * 1.25)) > 1e-9: raise Exception(f'the catch row: {odds}')
    pg.evaluate("stopTimers();activeBattle.over='ran';endBattle();0")
    if not until(pg, "!activeBattle", 20): raise Exception('the battle didn’t end')
    heal = pg.evaluate("uiState.modal=null;uiState.mq=[];saveData.team[0].hp=1;runArrivedFx();saveData.team[0].hp")
    if heal <= 1: raise Exception('walking in didn’t heal')
    town = pg.evaluate("saveData.run.map.nodes.findIndex(n=>n.type==='town')")
    if not pg.evaluate(f"runJump({town}+1)"): raise Exception('couldn’t walk to a town')
    clinic = pg.evaluate("[runClinicEach(),RULES.run.healCost]")
    if clinic[0] != round(clinic[1] / 2): raise Exception(f'the clinic charges {clinic[0]} a Billie, not half of {clinic[1]}')
    sid = pg.evaluate(f"Object.keys(SHOPS).find(k=>SHOPS[k].runNode==={town})")
    pg.evaluate(f"uiState.modal=null;uiState.mq=[];openShop('{sid}');0")
    if not until(pg, "!!document.querySelector('#ov .shop-sheet [data-a=shoprelic]')", 10): raise Exception('the town’s shop has no Loophole')
    shelf = pg.evaluate("Object.values(saveData.run.shelf)[0]")
    price = pg.evaluate(f"Math.round(RULES.run.relics.price[RELICS['{shelf}'].rarity]*0.85)")
    se, held = pg.evaluate("[saveData.se,saveData.run.relics.slice()]")
    pg.evaluate("document.querySelector('#ov [data-a=shoprelic]').click();0")
    if not until(pg, "!!uiState.modal&&uiState.modal.cls==='relic-drop'&&document.querySelectorAll('#ov pb-pick-card').length===6", 10): raise Exception('buying at the cap didn’t ask which to let go')
    pg.evaluate("document.querySelector('#ov pb-pick-card').shadowRoot.querySelector('button').click();0")
    if not until(pg, f"saveData.run.relics.includes('{shelf}')&&!saveData.run.relics.includes('{held[0]}')", 10): raise Exception('the Loophole wasn’t bought')
    after = pg.evaluate("[saveData.se,saveData.run.relics.length,Object.values(saveData.run.shelf)[0],!!document.querySelector('#ov .shop-sheet [data-a=shoprelic]')]")
    if after != [se - price, 6, '', False]: raise Exception(f'after buying: money, held, shelf, row {after} (paid {se - after[0]}, price {price})')
    if stored()['shelf'] != {f'{town}:{pg.evaluate("saveData.run.clock")}': ''}: raise Exception(f'the bought shelf isn’t stored: {stored()["shelf"]}')
    # a mini-boss beaten: the pick is stored with the battle's end, before its sheet
    mb = pg.evaluate("saveData.run.map.nodes.findIndex(n=>n.type==='miniboss')")
    if not pg.evaluate(f"uiState.modal=null;uiState.mq=[];renderOverlay();runJump({mb}+1)"): raise Exception('couldn’t walk to a mini-boss')
    pg.evaluate(f"startTrainer(runFoeId({mb}),{{talked:true}});0")
    if not until(pg, "!!activeBattle&&activeBattle.T&&activeBattle.T.runFoe==='miniboss'", 20): raise Exception('the mini-boss battle didn’t start')
    pg.evaluate("stopTimers();activeBattle.over='win';endBattle();0")
    if not until(pg, "!activeBattle&&!!uiState.modal&&!!(uiState.modal.btns||[]).find(b=>b.l==='Pick a Loophole')", 30):
        raise Exception(f'no “Pick a Loophole” after the mini-boss: {pg.evaluate("uiState.modal&&uiState.modal.title")}')
    offer2 = stored()['offer']
    if not offer2 or len(offer2) != 3 or offer2 != pg.evaluate("saveData.run.offer"): raise Exception(f'the new pick isn’t stored: {offer2}')
    pg.evaluate("uiState.modal.btns.find(b=>b.l==='Pick a Loophole').f();0")
    if not until(pg, pick, 10): raise Exception('the button didn’t open the pick')
    pg.goto(base + '/index.html?fixture=stored')
    if not until(pg, pick, 90): raise Exception('a reload didn’t open the pick again')
    if pg.evaluate("saveData.run.offer") != offer2: raise Exception('a reload showed another pick')
    pg.evaluate("document.querySelectorAll('#ov [data-a=mb]')[1].click();0")
    if not until(pg, "!saveData.run.offer&&!(uiState.modal&&uiState.modal.cls==='relic-pick')", 10): raise Exception('Take none didn’t clear the pick')
    return f'the pick ({", ".join(offer)}), {took} taken; six on the tab; a battle with Speed +1 and catch x1.25; walking in healed to {heal} HP; the clinic ${clinic[0]}; {shelf} bought for ${price} in place of {held[0]}; a mini-boss beaten: a stored pick ({", ".join(offer2)}), the same after a reload, none taken'


def income(pg, base):
    """RL-10b: the ranch fixture stands in the barn. The training board opens the ranch's sheet, which starts the
    income (a new save has none waiting); five hours later the Income row shows five hours' Scrap and Collect pays it;
    the clock turned back a day shows nothing waiting and moves nothing back; forward again an hour past where it was
    pays that hour only; a reload (?fixture=stored) keeps the Scrap and the income's time"""
    if not until(pg, "!!uiState.inside&&uiState.inside.kind==='ranch'&&walkView.ready", 60): raise Exception(f'not in the ranch: {pg.evaluate("walkView.id")}')
    pg.evaluate("window.__d0=Date.now;window.__shift=0;Date.now=()=>__d0.call(Date)+__shift;0")
    board = "(()=>{const p=walkView.sc.props.find(q=>q.act==='ranch'&&q.k==='blackboard');uiState.modal=null;uiState.mq=[];walkPick({k:'act',p,act:'ranch'});return !!(uiState.modal&&uiState.modal.cls==='ranch-sheet'&&document.querySelector('#ov .ranch-sheet .ranch-income'))})()"
    H = 3600000
    rate = pg.evaluate("incomeRate(saveData,RULES.ranch)")
    if not pg.evaluate(board): raise Exception('the sheet has no Income row')
    if pg.evaluate("incomePile(saveData,Date.now(),RULES.ranch).scrap") != 0 or not pg.evaluate("saveData.ranch.income.lastAt"): raise Exception('a new save’s income didn’t start at the first opening (or started full)')
    if not pg.evaluate("document.querySelector('#ov .ranch-income [data-r=collect]').disabled"): raise Exception('Collect is open with nothing waiting')
    s0 = pg.evaluate("saveData.meta.scrap")
    pg.evaluate(f"__shift={5 * H};0")
    pg.evaluate(board)
    want = int(5 * rate)
    shown = pg.evaluate("document.querySelector('#ov .ranch-income .count').textContent")
    if shown != f'{want} Scrap': raise Exception(f'five hours shows “{shown}”, not {want} Scrap')
    pg.click("#ov .ranch-income [data-r=collect]")
    if pg.evaluate("saveData.meta.scrap") != s0 + want: raise Exception(f'Collect paid {pg.evaluate("saveData.meta.scrap") - s0}, not {want}')
    last = pg.evaluate("saveData.ranch.income.lastAt")
    pg.evaluate(f"__shift={5 * H - 24 * H};0")
    pg.evaluate(board)
    if pg.evaluate("document.querySelector('#ov .ranch-income .count').textContent") != '0 Scrap' or pg.evaluate("saveData.ranch.income.lastAt") != last: raise Exception('the clock turned back a day: Scrap waiting, or the income’s time moved back')
    if not pg.evaluate("!!document.querySelector('#ov .ranch-back')"): raise Exception('the sheet didn’t say the clock is behind')
    pg.evaluate(f"__shift={6 * H};0")
    pg.evaluate(board)
    pg.click("#ov .ranch-income [data-r=collect]")
    if pg.evaluate("saveData.meta.scrap") != s0 + want + int(rate): raise Exception(f'forward again an hour past: Scrap {pg.evaluate("saveData.meta.scrap")}, not {s0 + want + int(rate)} (the gap paid?)')
    keep = pg.evaluate("JSON.stringify([saveData.meta.scrap,saveData.ranch.income,saveData.ranch.seen])")
    pg.goto(base + '/index.html?fixture=stored')
    if not until(pg, "typeof saveData!=='undefined'&&!!saveData.ranch&&!document.getElementById('loader')", 90): raise Exception('the reload never booted')
    back = pg.evaluate("JSON.stringify([saveData.meta.scrap,saveData.ranch.income,saveData.ranch.seen])")
    if back != keep: raise Exception(f'after a reload {back}, not {keep}')
    return f'started at the first opening; five hours showed and paid {want} Scrap ({rate} an hour); a day back showed nothing and said so; forward again an hour paid {int(rate)}; a reload kept it'


def breed(pg, base):
    """RL-10: the ranch fixture (three Billies of the lead's line in storage, 50 Scrap). Two storage cards picked show
    the safe egg before paying, the very egg Breed puts in the nursery (safeCost paid); it can't hatch before
    breed.hours, then Hatch brings it onto the team. A risky pair (storage and the team's second) pays riskyCost; the
    clock turned back keeps its ready time (no hatch); a reload (?fixture=stored) keeps the nursery, the count and Scrap"""
    if not until(pg, "!!uiState.inside&&uiState.inside.kind==='ranch'&&walkView.ready", 60): raise Exception(f'not in the ranch: {pg.evaluate("walkView.id")}')
    pg.evaluate("window.__d0=Date.now;window.__shift=0;Date.now=()=>__d0.call(Date)+__shift;0")
    board = "(()=>{const p=walkView.sc.props.find(q=>q.act==='ranch'&&q.k==='blackboard');uiState.modal=null;uiState.mq=[];walkPick({k:'act',p,act:'ranch'});return !!(uiState.modal&&uiState.modal.cls==='ranch-sheet'&&document.querySelector('#ov .ranch-sheet'))})()"
    B = pg.evaluate("RULES.ranch.breed"); H = 3600000
    if not pg.evaluate(board): raise Exception('the training board didn’t open the ranch’s sheet')
    tap = lambda uid: pg.evaluate(f"document.querySelector('#ov pb-pick-card[data-u=\"{uid}\"]').shadowRoot.querySelector('button').click();0")
    a, b = pg.evaluate("[saveData.box[0].uid,saveData.box[1].uid]")
    for u in (a, b):
        tap(u)
        if not until(pg, f"!!document.querySelector('#ov pb-pick-card[data-u=\"{u}\"][selected]')", 10): raise Exception('a tapped card wasn’t picked')
    if not until(pg, "!!document.querySelector('#ov .breed-preview')&&!document.querySelector('#ov [data-r=breed]').disabled", 10): raise Exception('two of one line picked: no egg shown, or Breed off')
    shown = pg.evaluate("document.querySelector('#ov .breed-preview b').textContent")
    rolled = pg.evaluate(f"JSON.stringify((m=>[m.sp,m.build,m.uid])(breedRoll(saveData,saveData.box[0],saveData.box[1],'safe',RULES.ranch.breed).m))")
    pg.click('#ov [data-r=breed]')
    got = pg.evaluate("JSON.stringify([saveData.meta.scrap,saveData.ranch.nursery.length,saveData.ranch.bred,(m=>[m.sp,m.build,m.uid])(saveData.ranch.nursery[0].egg)])")
    want = json.dumps([50 - B['safeCost'], 1, 1, json.loads(rolled)], separators=(',', ':'))
    if got != want: raise Exception(f'after Breed {got}, not {want}')
    if not pg.evaluate("document.querySelector('#ov [data-r=hatch][data-i=\"0\"]').disabled"): raise Exception('a new egg could hatch at once')
    egg = json.loads(rolled)[2]
    pg.evaluate(f"__shift={B['hours'] * H};0")
    pg.evaluate(board)
    pg.click('#ov [data-r=hatch][data-i="0"]')
    if not until(pg, "!!uiState.modal&&uiState.modal.title==='An egg is hatching'", 10): raise Exception('Hatch opened no hatch window')
    pg.click('#ov [data-a=mb][data-i="0"]')
    if not until(pg, f"saveData.ranch.nursery.length===0&&saveData.team.some(m=>m.uid==='{egg}')", 10): raise Exception('“Hatch it” didn’t bring the egg onto the team')
    if not until(pg, "!!uiState.modal&&/^It’s/.test(uiState.modal.title)", 10): raise Exception('the hatch window never showed the Billie')
    pg.click('#ov [data-a=mb][data-i="0"]')
    # the ranch's sheet comes back, or waits behind a window that was waiting (the fixture's lead can evolve)
    if not until(pg, "[uiState.modal,...uiState.mq].some(m=>m&&m.cls==='ranch-sheet')", 10): raise Exception('“Welcome aboard” didn’t bring the ranch’s sheet back')
    pg.evaluate("uiState.mq=[];uiState.modal=null;renderOverlay();0")
    pg.evaluate(board)
    second = pg.evaluate("saveData.team[1].uid")
    pg.click('#ov [data-r=mode][data-m=risky]')
    for u in (a, second): tap(u)
    if not until(pg, "!!document.querySelector('#ov .breed-preview')&&!document.querySelector('#ov [data-r=breed]').disabled", 10): raise Exception('a risky pair: no odds shown, or Breed off')
    pg.click('#ov [data-r=breed]')
    st = pg.evaluate("JSON.stringify([saveData.meta.scrap,saveData.ranch.nursery.map(n=>n.mode),saveData.ranch.bred])")
    if st != json.dumps([50 - B['safeCost'] - B['riskyCost'], ['risky'], 2], separators=(',', ':')): raise Exception(f'after a risky Breed {st}')
    ready = pg.evaluate("saveData.ranch.nursery[0].ready")
    pg.evaluate(f"__shift={-30 * H};0")
    pg.evaluate(board)
    if not pg.evaluate("document.querySelector('#ov [data-r=hatch][data-i=\"0\"]').disabled") or pg.evaluate("saveData.ranch.nursery[0].ready") != ready: raise Exception('the clock turned back moved the egg’s time')
    keep = pg.evaluate("JSON.stringify([saveData.meta.scrap,saveData.ranch.bred,saveData.ranch.nursery,saveData.team.map(m=>m.uid)])")
    pg.goto(base + '/index.html?fixture=stored')
    if not until(pg, "typeof saveData!=='undefined'&&!!saveData.ranch&&!document.getElementById('loader')", 90): raise Exception('the reload never booted')
    back = pg.evaluate("JSON.stringify([saveData.meta.scrap,saveData.ranch.bred,saveData.ranch.nursery,saveData.team.map(m=>m.uid)])")
    if back != keep: raise Exception(f'after a reload the nursery changed')
    return f'a safe pair showed “{shown}” before paying {B["safeCost"]} Scrap, the same egg hatched after {B["hours"]} h onto the team; a risky pair paid {B["riskyCost"]}; the clock turned back kept its time; a reload kept it'


def lab(pg, base):
    """RL-11: the lab fixture stands in Copperleaf after a run (500 Capital, 60 Scrap, 2 Seals, one run ended). The
    first milestone was granted on load; the bottom bar's Lab tab opens the board with every row; a board row bought
    pays its Capital; the ranch's sheet sells Ranch Lv 2 for Scrap (its slots rise); the mast's sheet sells Airship Lv 2
    for a Seal and then offers the ridge lands; a run would carry the shop unlock; a reload (?fixture=stored) keeps it all"""
    if not until(pg, "typeof saveData!=='undefined'&&!!saveData.meta.unlocks.first_run&&walkView.ready", 60): raise Exception(f'no first milestone on load: {pg.evaluate("JSON.stringify(saveData.meta)")}')
    if pg.evaluate("saveData.meta.scrap") != 70: raise Exception(f'the milestone paid {pg.evaluate("saveData.meta.scrap") - 60} Scrap, not 10')
    pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();0")
    if not pg.evaluate(nav_tap('lab')): raise Exception('no Lab tab in the bottom bar')
    if not until(pg, "!!document.querySelector('.s-lab')", 10): raise Exception('the Lab tab didn’t open the board')
    rows, want = pg.evaluate("[document.querySelectorAll('.s-lab .lab-row').length,Object.keys(UNLOCK_DATA.unlocks).length]")
    if rows != want: raise Exception(f'the board shows {rows} rows of {want}')
    cost = pg.evaluate("UNLOCK_DATA.unlocks.shop_bailout.cost")
    pg.click(".s-lab [data-a=lab-buy][data-k=shop_bailout]")
    st = pg.evaluate("[saveData.meta.capital,!!saveData.meta.unlocks.shop_bailout]")
    if st != [500 - cost, True]: raise Exception(f'buying Revives: Capital and owned {st}')
    pg.evaluate("uiState.tab='walk';render();uiState.modal=null;uiState.mq=[];ranchOpen();0")
    pg.click("#ov .ranch-sheet [data-a=lab-buy][data-k=ranch_2]")
    st = pg.evaluate("[saveData.meta.scrap,ranchLevel(saveData),ranchSlots(saveData,RULES.ranch),uiState.modal&&uiState.modal.title]")
    if st[:3] != [70 - pg.evaluate("UNLOCK_DATA.unlocks.ranch_2.cost"), 2, pg.evaluate("RULES.ranch.slots[1]")] or 'Lv 2' not in (st[3] or ''): raise Exception(f'Ranch Lv 2: Scrap, level, slots, title {st}')
    pg.evaluate("uiState.modal=null;uiState.mq=[];flyMenu(walkView.sc.props.find(q=>q.act==='fly'));0")
    pg.click("#ov .fly-sheet [data-a=lab-buy][data-k=airship_2]")
    if not until(pg, "saveData.meta.seals===1&&!!document.querySelector('#ov .fly-sheet [data-k=biome_ridge]:not([disabled])')", 10): raise Exception('Airship Lv 2 didn’t open the ridge lands on the mast’s sheet')
    if pg.evaluate("runUnlocks(saveData,UNLOCK_DATA).join()") != 'shop_bailout': raise Exception('a run wouldn’t carry the shop unlock')
    keep = pg.evaluate("JSON.stringify(saveData.meta)")
    pg.goto(base + '/index.html?fixture=stored')
    if not until(pg, "typeof saveData!=='undefined'&&!!saveData.meta&&!document.getElementById('loader')", 90): raise Exception('the reload never booted')
    back = pg.evaluate("JSON.stringify(saveData.meta)")
    if back != keep: raise Exception(f'after a reload {back}, not {keep}')
    return f'the first milestone on load (+10 Scrap); {rows} rows on the board; Revives for {cost} Capital; Ranch Lv 2 (3 slots); Airship Lv 2 opened the ridge lands; a reload kept it'


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


STUDIO_DATA = """(async()=>{const ix=await (await fetch('../game/data/index.json')).json(),paths=[];
 for(const k of ix.keys){const sp=ix.split&&ix.split[k];if(!sp)paths.push(k+'.json');else for(const id of sp.ids)paths.push(k+'/'+id+'.json')}
 const F={};await Promise.all(paths.map(async p=>{F[p]=await (await fetch('../game/data/'+p)).json()}));
 const D=PB_DATA.assemble(ix,p=>F[p]);studioState.D=D;studioState.rigs={};studioState.files=[];studioState.last=null;commit(true);
 document.querySelectorAll('.dlg,.modal,.overlay').forEach(e=>e.remove());return Object.keys(D).length})()"""


def studio_worldmap(pg, base):
    """phase 10, session 5: World & encounters → World map look: the picture of the bowl from the game's own code, a
    land brush stroke that is one undo step, and each place's landmark field"""
    if not until(pg, "typeof openSection==='function'&&typeof PB_DATA==='object'", 60): raise Exception('the Studio never loaded')
    pg.evaluate(STUDIO_DATA)
    pg.evaluate("studioState.sel.wtab='look';openSection('world');0")
    if not until(pg, "!!document.getElementById('wmlPic')&&typeof wmlSeaShare==='function'&&wmlSeaShare()>0", 30): raise Exception('the World map look tab drew no bowl')
    share = pg.evaluate("wmlSeaShare()")
    n0 = pg.evaluate("(studioState.D.worldmap.sea.paint||[]).length")
    pg.evaluate("""(()=>{const c=document.getElementById('wmlPic'),r=c.getBoundingClientRect(),ev=(t,x,y)=>c.dispatchEvent(new PointerEvent(t,{clientX:r.left+r.width*x,clientY:r.top+r.height*y,pointerId:1,bubbles:true}));
      ACTIONS.wmlTool({t:'land'});})();0""")
    pg.evaluate("""(()=>{const c=document.getElementById('wmlPic');c.setPointerCapture=()=>{};const r=c.getBoundingClientRect(),ev=(t,x,y)=>c.dispatchEvent(new PointerEvent(t,{clientX:r.left+r.width*x,clientY:r.top+r.height*y,pointerId:1,bubbles:true}));
      ev('pointerdown',.5,.8);ev('pointermove',.55,.8);ev('pointermove',.6,.8);ev('pointerup',.6,.8)})();0""")
    n1 = pg.evaluate("studioState.D.worldmap.sea.paint.length")
    if n1 != n0 + 1: raise Exception(f'a land brush stroke made {n1 - n0} strokes')
    pg.evaluate("undo();0")
    if pg.evaluate("(studioState.D.worldmap.sea.paint||[]).length") != n0: raise Exception('Undo didn’t take the stroke back')
    pg.evaluate("studioState.sel.wtab='route';studioState.sel.stop=LOCATIONS_STUDIO_PROBE=studioState.D.locations.findIndex(l=>l.id==='copperleaf');render();0")
    if not until(pg, "[...document.querySelectorAll('select[data-p$=\".landmark\"]')].some(s=>s.options[0].textContent.includes('Great oak'))", 10):
        raise Exception('the landmark field doesn’t offer Auto (the great oak) for Copperleaf')
    return f'the bowl drawn ({round(share * 100)}% sea), a brush stroke and its undo, the landmark field'


HUB_STROKE = """((id,x0,z0,x1,z1,o)=>{const c=document.getElementById(id);c.setPointerCapture=()=>{};const sc=studioState.D.maps.test_island,r=c.getBoundingClientRect(),Z=r.width/sc.w,
 ev=(t,x,z)=>c.dispatchEvent(new PointerEvent(t,Object.assign({clientX:r.left+x*Z,clientY:r.top+(sc.h-z)*Z,pointerId:7,bubbles:true,button:0},o||{})));
 ev('pointerdown',x0,z0);for(let i=1;i<=4;i++)ev('pointermove',x0+(x1-x0)*i/4,z0+(z1-z0)*i/4);ev('pointerup',x1,z1)})"""


def poll(pg, cond, sec):
    """until(), asked from here: the island's frames take seconds each in a headless browser and come back to back,
    which can starve the page's own timers that until()'s polling runs on (seen on a busy runner); an evaluate still
    gets through between frames"""
    end = time.time() + sec
    while True:
        if pg.evaluate(f'(()=>{{try{{return !!({cond})}}catch(e){{return false}}}})()'): return True
        if time.time() > end: return False
        time.sleep(0.25)


def studio_hub(pg, base):
    """island track IS-6a: the Hub island section opens on test_island and draws (the orbit view and the map), a drag
    turns the orbit, a brush stroke paints; locking stores the hash and turns the tools off, here and in Walk scenes,
    where props stay free; the Studio's Check catches a changed locked ground; unlocking (asked first) frees it.
    The island's frames are slow in a headless browser (seconds each on a busy runner), so it waits with poll() and
    as long as drawing() does"""
    if not poll(pg, "typeof openSection==='function'&&typeof PB_DATA==='object'", 60): raise Exception('the Studio never loaded')
    pg.evaluate(STUDIO_DATA)
    # the section opens on the hub's own island by default (copperleaf, since IS-5); this check uses the small one
    pg.evaluate("studioState.sel.hub='test_island';openSection('hub');0")
    if not poll(pg, "studioState.sel.hub==='test_island'&&walkView.id==='test_island'&&!!document.getElementById('hubMap')", 40):
        raise Exception('Hub island didn’t open on test_island: ' + str(pg.evaluate("[studioState.sel.hub,walkView.id]")))
    if not poll(pg, "walkView.ready&&walkRenderer.on", 90): raise Exception('the orbit view never got ready')
    f0 = pg.evaluate('walkRenderer.frames')
    if not poll(pg, f'walkRenderer.frames>={f0 + 3}', 60): raise Exception('test_island isn’t drawing (black screen)')
    if not poll(pg, "!!hubEd.goal", 40):
        raise Exception('the orbit view never looked at the island: ' + pg.evaluate("JSON.stringify({sec:studioState.sec,mapId:hubEd.mapId,walk:hubEd.walk,look:walkView.opt.look&&walkView.opt.look.name,id:walkView.id,scw:walkView.sc&&walkView.sc.w,frames:walkRenderer.frames,cv:walkView.cv&&walkView.cv.id,ready:walkView.ready,bt:!!walkRenderer.bt,dir:!!walkView.director,bat:!!walkView.battle})"))
    if not pg.evaluate("(()=>{const c=document.getElementById('hubMap');return c.width>100&&c.getContext('2d').getImageData(c.width>>1,c.height>>1,1,1).data[3]>0})()"):
        raise Exception('the map drew nothing')
    y0 = pg.evaluate("hubEd.goal.yaw")
    pg.evaluate("""(()=>{const c=document.getElementById('hubPv');c.setPointerCapture=()=>{};const r=c.getBoundingClientRect(),ev=(t,x)=>c.dispatchEvent(new PointerEvent(t,{clientX:r.left+x,clientY:r.top+r.height/2,pointerId:8,bubbles:true,button:0}));
      ev('pointerdown',20);ev('pointermove',60);ev('pointermove',120);ev('pointerup',120)})();0""")
    if abs(pg.evaluate("hubEd.goal.yaw") - y0) < 0.1: raise Exception('a drag on the orbit view didn’t turn it')
    rows = "JSON.stringify(studioState.D.maps.test_island.tiles)"
    t0 = pg.evaluate(rows)
    bound = lambda id: poll(pg, f"!!(document.getElementById('{id}')||{{}})._b", 40)   # the map's tools bind after its art loads
    pg.evaluate("ACTIONS.hubTool({t:'paint'});ACTIONS.hubTer({c:'r'});0")
    if not bound('hubMap'): raise Exception('the map’s tools never bound')
    pg.evaluate(f"({HUB_STROKE})('hubMap',40,20,50,20);0")
    if pg.evaluate(rows) == t0: raise Exception('a Paint ground stroke changed nothing')
    pg.evaluate("undo();0")
    if pg.evaluate(rows) != t0: raise Exception('Undo didn’t take the stroke back')
    pg.evaluate("ACTIONS.hubLock();0")
    bound('hubMap')
    G = pg.evaluate("studioState.D.maps.test_island.islandGen")
    if not (G.get('lock') and G.get('hash')): raise Exception(f'Lock the ground stored {G}')
    if not pg.evaluate("[...document.querySelectorAll('[data-act=hubTool]')].every(b=>b.disabled)"): raise Exception('the tools stay on when locked')
    pg.evaluate(f"({HUB_STROKE})('hubMap',40,20,50,20);0")
    if pg.evaluate(rows) != t0: raise Exception('a locked ground took a brush stroke')
    pg.evaluate("studioState.sel.scene='test_island';openSection('scenes');ACTIONS.scTool({t:'paint'});0")
    if not poll(pg, "!!document.getElementById('scMap')&&!!document.querySelector('#main .hub-note')", 40): raise Exception('Walk scenes doesn’t say the ground is locked')
    if not bound('scMap'): raise Exception('Walk scenes’ map never bound')
    n0 = pg.evaluate("studioState.D.maps.test_island.props.length")
    pg.evaluate(f"({HUB_STROKE})('scMap',40,20,50,20);ACTIONS.scTool({{t:'props'}});mapEditor.prop=Object.keys(sceneryCatalog().props)[0];0")
    bound('scMap')
    pg.evaluate(f"({HUB_STROKE})('scMap',45,25,45,25);0")
    if pg.evaluate(rows) != t0: raise Exception('Walk scenes painted a locked ground')
    if pg.evaluate("studioState.D.maps.test_island.props.length") != n0 + 1: raise Exception('Walk scenes didn’t place a prop on a locked island')
    pg.evaluate("studioState.D.maps.test_island.heights[10][10]+=1;0")
    if not pg.evaluate("runCheck().some(p=>p.go==='hub'&&/locked but changed/.test(p.msg))"): raise Exception('the Studio’s Check missed a changed locked ground')
    pg.evaluate("studioState.D.maps.test_island.heights[10][10]-=1;openSection('hub');ACTIONS.hubUnlock();0")
    if not poll(pg, "!!document.querySelector('#dlg button.primary')", 40): raise Exception('Unlock didn’t ask first')
    pg.evaluate("document.querySelector('#dlg button.primary').click();0")
    if not poll(pg, "!studioState.D.maps.test_island.islandGen.lock&&!studioState.D.maps.test_island.islandGen.hash", 40): raise Exception('Unlock left the lock')
    if not poll(pg, "[...document.querySelectorAll('[data-act=hubTool]')].every(b=>!b.disabled)", 40): raise Exception('the tools stay off after Unlock')
    return f'drawn, a drag turned it {abs(pg.evaluate("hubEd.goal.yaw") - y0):.2f} rad, a stroke and its undo, the lock here and in Walk scenes (props free), the Check, unlock'


def studio_hub_dials(pg, base):
    """island track IS-6b: the Hub island editor's dials on test_island (after studio_hub, on its page): the map's own
    dials don't fit round its middle and say so; a slider makes a draft that the orbit view draws (`_hubgen`) while the
    map's tools are off; the walk check runs; Use this island puts the draft's ground on the map with the locked town
    zone as it was and the props kept; Undo takes it back; a locked ground shows the dials read-only, no draft"""
    M = 'studioState.D.maps.test_island'
    if not pg.evaluate("typeof studioState==='object'&&!!studioState.D"):   # run alone (--only): the Studio loads here
        if not poll(pg, "typeof openSection==='function'&&typeof PB_DATA==='object'", 60): raise Exception('the Studio never loaded')
        pg.evaluate(STUDIO_DATA)
    pg.evaluate("studioState.sel.hub='test_island';openSection('hub');0")
    if not poll(pg, "!!document.getElementById('hubGen')&&!!hubEd.goal", 60): raise Exception('Hub island didn’t open again')
    t0 = pg.evaluate(f"JSON.stringify({M}.tiles)")
    town = pg.evaluate(f"JSON.stringify({M}.zones.find(z=>z.k==='town'))")
    props = pg.evaluate(f"JSON.stringify({M}.props)")
    pg.evaluate("document.querySelector('[data-act=hubGenOpen]').click();0")
    if not poll(pg, "hubGen.on&&!hubGen.busy&&(!!hubGen.draft||!!hubGen.err)", 90): raise Exception('the dials never made a draft')
    if not pg.evaluate("/doesn’t fit round the map’s middle/.test(hubGen.err)"):
        raise Exception('test_island’s own dials should not fit round its middle: ' + pg.evaluate("hubGen.err||'a draft'"))
    # a small island fits round (60, 60); the last change goes through a slider, as a hand would
    pg.evaluate("Object.assign(hubGen.dials,{mountain:{r:10,peak:12},town:{on:0},hamlet:{on:0},zones:[]});0")
    if not pg.evaluate("(()=>{const r=document.querySelector('[data-hubgen=\"size.r\"]');if(!r)return false;r.value='30';r.dispatchEvent(new Event('input',{bubbles:true}));return true})()"):
        raise Exception('no Land radius slider')
    if not poll(pg, "!hubGen.busy&&!!hubGen.draft&&hubGen.draft.w===120", 90): raise Exception('the slider made no draft: ' + pg.evaluate("hubGen.err"))
    if not poll(pg, "walkView.id==='_hubgen'&&walkView.ready", 60): raise Exception('the orbit view doesn’t show the draft')
    drawing(pg, 2, 90)
    if pg.evaluate(f"JSON.stringify({M}.tiles)") != t0: raise Exception('a draft changed the map')
    if not pg.evaluate("[...document.querySelectorAll('[data-act=hubTool]')].every(b=>b.disabled)"): raise Exception('the map’s tools stay on over a draft')
    pg.evaluate("ACTIONS.hubGenWalk();0")
    if not pg.evaluate("Array.isArray(hubGen.walk)"): raise Exception('the walk check didn’t run')
    walks = pg.evaluate("hubGen.walk.length")
    pg.evaluate("document.querySelector('[data-act=hubGenUse]').click();0")
    if not poll(pg, f"JSON.stringify({M}.tiles)!=={json.dumps(t0)}", 30): raise Exception('Use this island changed nothing')
    if pg.evaluate(f"JSON.stringify({M}.zones.find(z=>z.k==='town'))") != town: raise Exception('the locked town zone changed')
    if pg.evaluate(f"JSON.stringify({M}.props)") != props: raise Exception('the props changed')
    if pg.evaluate(f"{M}.islandGen.dials.size.r") != 30: raise Exception('the dials weren’t stored in islandGen')
    if not poll(pg, "walkView.id==='test_island'", 30): raise Exception('the orbit view stayed on the draft')
    pg.evaluate("undo();0")
    if pg.evaluate(f"JSON.stringify({M}.tiles)") != t0: raise Exception('Undo didn’t take the island back')
    pg.evaluate("ACTIONS.hubGenClose();ACTIONS.hubLock();0")
    if not poll(pg, f"!!{M}.islandGen.lock", 30): raise Exception('the ground didn’t lock')
    pg.evaluate("hubGen.open.size=true;document.querySelector('[data-act=hubGenOpen]').click();0")
    if not poll(pg, "hubGen.on&&!!document.querySelector('[data-hubgen=\"size.r\"]')", 30): raise Exception('a locked island’s dials didn’t show')
    if not pg.evaluate("[...document.querySelectorAll('#hubGen [data-hubgen]')].every(e=>e.disabled)&&!document.querySelector('[data-act=hubGenUse]')"):
        raise Exception('a locked island’s dials can be moved, or it offers Use this island')
    if pg.evaluate("!!hubGen.draft||hubGen.busy"): raise Exception('a locked island made a draft')
    pg.evaluate(f"hubUnlockGround({M});ACTIONS.hubGenClose();0")
    return f'too big round the middle said so; a slider made a 120 m draft, drawn; {walks} walk problems; used (town zone and props kept), undone; locked: read-only'


def run_shop(pg, base):
    """UI-5: a run town's shop opens with the day's wares (the hub has no shop since RL-5)"""
    pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();openShop(Object.keys(SHOPS)[0]);0")
    if not until(pg, "document.querySelectorAll('#ov .shop-sheet .ware2').length>0", 10): raise Exception('no shop with wares')
    n = pg.evaluate("document.querySelectorAll('#ov .shop-sheet .ware2').length")
    pg.evaluate("closeModal();0")
    return f'{n} wares'


def screens(pg, base):
    """UI-5: every screen opens with its parts, through the buttons a player taps: the bottom bar's Map, Team, Bag and Lab, the
    world again (the open tab tapped again, and Esc), the Trainer card from the portrait and the Guide from it,
    the Billie sheet and its four tabs, a Guide page, Settings, the evolution window, the inbox, a toast (a run town's shop: run_shop). The check each
    screen moved out of ui.js must pass (docs/phases/ui-track.md, UI-5)"""
    if not until(pg, "!document.getElementById('loader')&&!!document.querySelector('.screen')", 90): raise Exception('the game never came up')
    pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();0")
    tap = lambda sel: pg.evaluate(f"(()=>{{const e=document.querySelector({json.dumps(sel)});if(!e)return false;e.click();return true}})()")
    seen = []
    def need(what, cond, sec=10):
        if not until(pg, cond, sec):
            raise Exception(f'{what}: not there ({cond}); on screen: ' + pg.evaluate("[uiState.tab,uiState.modal&&(uiState.modal.cls||uiState.modal.title),document.querySelector('#ov').className+' '+(document.querySelector('#ov .sheet')||{}).className].join(' / ')"))
        seen.append(what)
    screen = lambda t, part: f"!!document.querySelector('.screen.s-{t}')&&!!document.querySelector('.screen.s-{t} :is({part})')"
    # UI-5: the bar holds Map, Team and Bag, and RL-11's Lab (the hub's set)
    tabs = pg.evaluate("[...document.querySelector('#nav').shadowRoot.querySelectorAll('button')].map(b=>b.dataset.t).join(',')")
    if tabs != 'map,team,bag,lab': raise Exception(f'the bottom bar holds {tabs}')
    for t, part in (('map', '.map-head,pb-day-chip,.map-full'), ('team', '.u-team .u-hero'),
                    ('bag', '.bag-tabs,.bag-list,.bag-empty,[data-a^=bag]'), ('lab', '.lab-sec .lab-row')):
        if not pg.evaluate(nav_tap(t)): raise Exception(f'no {t} tab to tap')
        need(t, screen(t, part))
    # the world is the base view: the open tab tapped again, or Esc, goes back to it
    pg.evaluate(nav_tap('lab'))
    need('the world (the open tab again)', screen('walk', '#walkHero'))
    pg.evaluate(nav_tap('team')); need('team again', screen('team', '.u-hero'))
    pg.keyboard.press('Escape')
    need('the world (Esc)', screen('walk', '#walkHero'))
    # the Trainer card from the portrait, the Guide from the Trainer card
    if not tap('.tb-me'): raise Exception('no portrait to tap')
    need('the Trainer card', "!!document.querySelector('.screen.s-profile .tcard,.screen.s-profile .tc-card,.screen.s-profile [class*=tc-]')")
    if not tap('.screen.s-profile [data-a=tab][data-t=ledger]'): raise Exception('no Guide button on the Trainer card')
    need('the Guide', screen('ledger', '.dex,.ledger,.lrow'))
    if not tap('.screen.s-ledger [data-a=dex]'): raise Exception('no Guide entry to open')
    need('a Guide page', "!!document.querySelector('.screen.s-ledger .dexpage')")
    pg.evaluate(nav_tap('team'))
    if not tap('.screen.s-team [data-a=mon]'): raise Exception('no Billie to open')
    need('the Billie sheet', "!!document.querySelector('#ov .mon-sheet')")
    keys = pg.evaluate("[...document.querySelectorAll('#ov [data-a=ms-tab]')].map(b=>b.dataset.k)")
    if len(keys) < 4: raise Exception(f'the Billie sheet has tabs {keys}')
    for k in keys:
        tap(f'#ov [data-a=ms-tab][data-k={k}]')
        need(f'its {k} tab', f"document.querySelector('#ov [data-a=ms-tab][data-k={k}]').getAttribute('aria-selected')==='true'")
    pg.evaluate("closeModal();0")
    # the fixture's lead can evolve: closing the sheet brings up the evolution window (a pending window)
    need('the evolution window', "!!document.querySelector('#ov .evo-sheet')")
    pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();0")
    if not tap('[data-a=settings]'): raise Exception('no Settings button')
    need('Settings', "!!document.querySelector('#ov .set-sheet')")
    pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();notice({id:'ui5',title:'A notice',html:'<p>Read me.</p>'});0")
    if not until(pg, "!!document.querySelector('[data-a=inbox]')", 10) or not tap('[data-a=inbox]'): raise Exception('no inbox dot after a notice')
    need('the inbox', "!!document.querySelector('#ov .inbox-sheet')")
    pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();toast('Hello');0")
    need('a toast', "!!document.getElementById('toast')")
    return 'opened: ' + ', '.join(seen)


NODE_CHECKS = [('Game data is valid', data_valid), ('The world-map graph is unchanged', world_graph)]
def run_pack(pg, base):
    """RL-9b: from the ranch fixture (three Billies in storage), one of them training: the mast's start sheet picks it
    (a pick card tapped) and packs two Potions (+ tapped twice); "Take off": the party is that Billie alone, healed,
    its training stopped, the hub's team and storage left as they were, the bag the gift and the pack, Copperleaf's
    two Potions fewer. Given up, keeping it: back in storage once (no second copy) with its run's levels, the team and
    buddy the hub's, the packed Potions gone. A second run (the default pick, one Potion packed), won: no items row on
    the payout, the run's bag added to Copperleaf's. A reload (?fixture=stored) keeps it all"""
    if not until(pg, "typeof saveData!=='undefined'&&!!saveData.ranch&&!document.getElementById('loader')&&walkView.ready", 90): raise Exception('the ranch fixture never booted')
    pg.evaluate("uiState.inside=null;uiState.modal=null;uiState.mq=[];renderOverlay();saveData.items.taxbreak=3;saveData.coins.penny=2;0")
    who = pg.evaluate("saveData.box[1].uid")
    if pg.evaluate(f"ranchTrainStart(saveData,'{who}',Date.now(),RULES.ranch)") != '': raise Exception('the fixture’s Billie couldn’t start training')
    pg.evaluate(f"saveData.box[1].hp=1;0")
    hub = pg.evaluate("JSON.stringify([saveData.team.map(m=>m.uid),saveData.box.map(m=>m.uid),saveData.buddy])")
    gift = pg.evaluate("RULES.run.start.items.taxbreak||0")
    pg.evaluate("runStartSheet();0")
    if not until(pg, "uiState.modal&&uiState.modal.title==='Start a run'&&!!document.querySelector('#ov pb-pick-card')", 10): raise Exception('no start sheet')
    pg.evaluate(f"document.querySelector('#ov pb-pick-card[data-u=\"{who}\"]').shadowRoot.querySelector('button').click();0")
    if not until(pg, f"!!document.querySelector('#ov pb-pick-card[data-u=\"{who}\"][selected]')", 10): raise Exception('a tapped card wasn’t picked')
    for _ in range(2): pg.click("#ov [data-pk=items][data-k=taxbreak][data-d='1']")
    packed = pg.evaluate("document.querySelector('#ov h3 small').textContent")
    if not packed.startswith('2 of '): raise Exception(f'the pack says “{packed}”')
    pg.click('#ov [data-a=mb][data-i="0"]')
    # the flight is 2-3 s: on a slow page (CI's software drawing) it may have landed already when the wait first looks
    if not until(pg, "!!saveData.run&&(airshipFlight.on||saveData.run.at.phase==='walk')", 30): raise Exception('“Take off” didn’t start a run')
    got = pg.evaluate(f"JSON.stringify([saveData.team.map(m=>m.uid),saveData.team[0].hp===maxHp(saveData.team[0]),saveData.ranch.trainees.some(t=>t.uid==='{who}'),saveData.run.start.team.map(m=>m.uid),saveData.box.map(m=>m.uid),saveData.run.start.items.taxbreak,saveData.items.taxbreak,saveData.buddy])")
    want = json.dumps([[who], True, False, json.loads(hub)[0], json.loads(hub)[1], 1, gift + 2, who], separators=(',', ':'))
    if got != want: raise Exception(f'at take-off {got}, not {want}')
    pg.evaluate("flySkip();0")
    if not until(pg, "!airshipFlight.on&&saveData.run.at.phase==='walk'&&walkView.ready", 90): raise Exception('never landed')
    lv = pg.evaluate("saveData.team[0].lvl+=3")
    pg.evaluate("uiState.modal=null;uiState.mq=[];runOver(false);0")
    if not until(pg, "!!uiState.modal&&uiState.modal.cls==='run-payout'&&!!document.querySelector('#ov pb-pick-card')", 30): raise Exception('no payout after giving up')
    pg.evaluate("document.querySelector('#ov pb-pick-card').shadowRoot.querySelector('button').click();0")
    if not until(pg, "!document.querySelector('#ov [data-a=mb]').disabled", 10): raise Exception('picking a card didn’t enable Fly home')
    pg.evaluate("document.querySelector('#ov [data-a=mb]').click();0")
    if not until(pg, "!saveData.run&&saveData.meta.runs===1", 30): raise Exception('Fly home didn’t end the run')
    back = pg.evaluate(f"JSON.stringify([saveData.team.map(m=>m.uid),saveData.box.map(m=>m.uid),saveData.buddy,saveData.box.find(m=>m.uid==='{who}').lvl,saveData.items.taxbreak])")
    H = json.loads(hub)
    if back != json.dumps([H[0], H[1], H[2], lv, 1], separators=(',', ':')): raise Exception(f'home after a loss {back}: team, storage, buddy as before, Lv {lv} kept, 1 Potion')
    lead = H[0][0]
    pg.evaluate(f"runTakeOff(undefined,undefined,undefined,{{home:['{lead}'],pack:{{items:{{taxbreak:1}},coins:{{}}}}}});0")
    if not until(pg, "!!saveData.run&&(airshipFlight.on||saveData.run.at.phase==='walk')", 30): raise Exception('the second run didn’t start')
    pg.evaluate("flySkip();0")
    if not until(pg, "!airshipFlight.on&&saveData.run.at.phase==='walk'&&walkView.ready", 90): raise Exception('the second run never landed')
    bag = pg.evaluate("saveData.items.taxbreak")
    pg.evaluate("uiState.modal=null;uiState.mq=[];runOver(true);0")
    if not until(pg, "!!uiState.modal&&uiState.modal.cls==='run-payout'&&!!document.querySelector('#ov pb-payout')", 30): raise Exception('no payout after the win')
    labels = pg.evaluate("document.querySelector('#ov pb-payout').rows.map(r=>r.label)")
    if 'Items in the bag' in labels: raise Exception(f'a win paid the bag: {labels}')
    pg.evaluate("document.querySelector('#ov [data-a=mb]').click();0")
    if not until(pg, "!saveData.run&&saveData.meta.wins===1", 30): raise Exception('Fly home didn’t end the won run')
    keep = pg.evaluate("JSON.stringify([saveData.items.taxbreak,saveData.box.map(m=>[m.uid,m.lvl]),saveData.team.map(m=>m.uid)])")
    if json.loads(keep)[0] != bag: raise Exception(f'after the win Copperleaf has {json.loads(keep)[0]} Potions, not {bag} (none at home + the run’s)')
    pg.goto(base + '/index.html?fixture=stored')
    if not until(pg, "typeof saveData!=='undefined'&&!!saveData.ranch&&!document.getElementById('loader')", 90): raise Exception('the reload never booted')
    again = pg.evaluate("JSON.stringify([saveData.items.taxbreak,saveData.box.map(m=>[m.uid,m.lvl]),saveData.team.map(m=>m.uid)])")
    if again != keep: raise Exception(f'after a reload {again}, not {keep}')
    return f'a trainee from storage travelled alone with 2 Potions packed (training stopped, healed); given up and kept: back in storage once at Lv {lv}; a won run brought its bag home ({bag} Potions, no items row); a reload kept it'


def hub_island(pg, base):
    """island track IS-5: Copperleaf is the island. Its walking checks hold (the island's: from the square to the barn,
    the pasture, the hamlet, each plot's door, up the trail to the summit, the dock; the sea not), with its houses on
    their plots; from where you arrive a tap walks to every door in one go (findPath's budget grows with the map); the
    wild Billies wait only in the tall grass patches; the camera orbits"""
    drawing(pg)
    if not pg.evaluate("!!(walkView.sc.island&&walkView.sc.cam&&walkView.sc.cam.orbit&&(walkView.sc.grassPatches||[]).length)"): raise Exception('Copperleaf has no island fields')
    res = pg.evaluate("testMapChecks('copperleaf')")
    bad = [r['what'] for r in res if not r['ok']]
    if bad: raise Exception(f'{len(bad)} of {len(res)} walking checks fail: {bad[:3]}')
    r = pg.evaluate("""(()=>{const sc=walkView.sc,C=walkData().sc,hub=mapHub(sc),out=[];let n=0,ms=0;
      for(const p of sc.props){if(!p.act||!C.props[p.k])continue;const g=actionSpot(p,C.props[p.k],C.ppu||34);if(!g)continue;n++;
        const t=performance.now(),q=findPath(hub[0],hub[1],g[0],g[1]);ms=Math.max(ms,performance.now()-t);const e=q&&q[q.length-1];
        if(!e||Math.hypot(e[0]-g[0],e[1]-g[1])>1.6)out.push(p.k+' at '+p.x+','+p.z)}
      const P=sc.grassPatches,cand=encounterCandidates(sc),off=cand.filter(c=>!P.some(g=>Math.hypot(g.x-c[0],g.z-c[1])<=g.r)).length;
      return {n,bad:out,ms:Math.round(ms),cand:cand.length,off,orbit:!!walkRenderer.orbit}})()""")
    if r['bad']: raise Exception(f"from where you arrive a tap doesn't reach {len(r['bad'])} of {r['n']} doors: {r['bad'][:3]}")
    if not r['cand'] or r['off']: raise Exception(f"wild Billies' spots: {r['cand']}, {r['off']} outside the tall grass patches")
    if not r['orbit']: raise Exception('the camera doesn’t orbit on the hub')
    return f"{len(res)} walking checks hold; a tap reaches all {r['n']} doors from where you arrive (the longest search {r['ms']} ms); {r['cand']} wild spots, all in the patches; the camera orbits"


PAGES = [   # (what the page opens, its checks in order); the longest first, so the browsers finish together
    ('town', [('A town opens and draws (Copperleaf Town)', scene('copperleaf')),
              ('Copperleaf is the island: its walking checks, every door a tap away, the wild grass, the orbit (IS-5)', hub_island),
              ('The exported debug log holds no names', debug_log),
              ('The world map opens as the bowl', bowl_map)]),
    ('room', [('A room opens and draws (the lab)', room), ('A save round-trips', save_round_trip)]),
    ('ranch', [('The ranch trains: Train, a level with time, the cap, a clock turned back and forward, a reload (RL-9, RL-10b)', ranch)]),
    ('relics', [("Loopholes: the pick (again after a reload), the tab, a battle's and a walk's effects, a town's prices, buying at the cap (RL-12)", relics)]),
    ('ranch', [('Breeding: a safe egg shown and hatched, a risky pair, a clock turned back, a reload (RL-10)', breed)]),
    ('ranch', [('Income: started at the first opening, Collect, a clock turned back and forward, a reload (RL-10b)', income)]),
    ('lab', [('The Lab: a milestone on load, the board, buying at the Lab, the ranch and the mast, a reload (RL-11)', lab)]),
    ('ranch', [('Packing for a run: a Billie from storage, a packed bag; kept on a loss, the bag home on a win (RL-9b)', run_pack)]),
    ('battle', [('A battle plays to the end', battle)]),
    ('run', [("A run's world: the landing, its places on the bowl, a seam walked a day later", run_world),
             ("A run town's shop opens (UI-5)", run_shop)]),
    ('run', [("A run's battle held and started again after a reload; a loss, the payout (again after a reload) and home", run_loop)]),
    ('mountains', [('Tall ground: behind a south mountain the camera rises, rock fades, your silhouette shows; none on flat ground', tall_ground)]),
    ('team', [('Every screen opens with its parts (UI-5)', screens)]),
    ('title', [('The game boots with no console or page errors', boots)]),
    ('island', [('The test island opens and draws; its walking checks hold; the orbit camera (island track)', island)]),
    ('studio', [('The Studio loads', studio), ("The Studio's world map look", studio_worldmap)]),
    # IS-6a: a page of its own (it runs beside the others): the island's 3D view draws slowly in a headless browser
    ('studio', [("The Studio's Hub island: the orbit view, the map's tools, the ground lock (IS-6a)", studio_hub),
                ("The Studio's Hub island dials: a draft, Use this island, locked read-only (IS-6b)", studio_hub_dials)]),
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

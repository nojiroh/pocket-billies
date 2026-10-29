#!/usr/bin/env python3
"""Characters track CH-3c: people as figures where they live, headless: Copperleaf by day and at night with its
townsfolk and residents, the rooms whose keepers stand behind a counter, and a run's arena with its leader in the ring.
Engine > People > Figures on (with Everyone else as figures); --off for the same shots with today's people.

    python3 tools/look-places.py                     # town (day, night), rooms, arena
    python3 tools/look-places.py --only=rooms,arena  # some of: town, rooms, arena, dressing
    python3 tools/look-places.py --only=dressing     # the dressing room with Figures off and on (CH-7: on the figure):
                                                     # every tab's tiles become figures; a picture of each tab
    python3 tools/look-places.py --only=rooms --room=int_shop   # one room
    python3 tools/look-places.py --off               # Figures off (today's people), for a before/after
    python3 tools/look-places.py --out=DIR

The page is a 390 x 844 phone at 2 device pixels to the CSS pixel (look-people.py takes 3, slower), the game's own
graphics with auto quality and depth of field off. Pictures and notes.json go to validation/look-places/ (not in git).
Headless Chromium draws in software: counts and pictures only, no milliseconds. Nothing is sent anywhere."""
import json, sys, time
from importlib import import_module
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import browser_check as fast  # noqa: E402
shots = import_module('island-shots')  # settle

ROOT = fast.ROOT
ARGS = sys.argv[1:]
arg = lambda k, d=None: next((a.split('=', 1)[1] for a in ARGS if a.startswith(f'--{k}=')), d)
OUT = Path(arg('out', ROOT / 'validation' / 'look-places'))
ONLY = set((arg('only') or 'town,rooms,arena,dressing').split(','))
OFF = '--off' in ARGS
ROOM = arg('room')  # only this room (int_shop, ...)
TAG = 'off' if OFF else 'fig'
W, H, DPR = 390, 844, 2


def setup(pg):
    """the game's graphics with auto quality and depth of field off, Figures on (or off), no messages"""
    people = {} if OFF else {'figures': True, 'folk': True}
    pg.evaluate(f"(()=>{{uiState.modal=null;uiState.mq=[];renderOverlay();const p=saveData.preferences=saveData.preferences||{{}};p.expert=true;p.eng={{quality:{{auto:false}},lens:{{blur:0,bokeh:0}},people:{json.dumps(people)}}};return 0}})()")


def people(pg):
    """who is drawn and how: the people report and the figures' (figures.js figureReport)"""
    return pg.evaluate("({drawn:peopleReport().drawn, figures:typeof figureReport==='function'?(r=>r&&{pictures:r.pictures,failed:r.failed,atlas:r.atlas&&r.atlas.cells}) (figureReport()):null})")


# everyone's picture in: today's walk frames drawn (person-art.js draws a few a frame, slow headless), and with
# Figures on no figure mesh still on its way from the helper thread
READY = """(()=>{const npcs=(walkState().npcs||[]).length+1, m=typeof figureReport==='function'&&figuresOn()?(figureReport().meshes||{}):{};
 return peopleReport().drawn>=npcs&&!personArtMissing&&!(m.waiting>0)})()"""


def shot(pg, name, n=8):
    for _ in range(30):
        if pg.evaluate(READY): break
        shots.settle(pg, 4)
    shots.settle(pg, n)
    pg.screenshot(path=str(OUT / f'{name}-{TAG}.png'))
    r = {'shot': f'{name}-{TAG}.png', **people(pg)}
    print(f"  {r['shot']}: {r['drawn']} people {r['figures']}", flush=True)
    return r


def town(pg, notes):
    """Copperleaf's square by day and at night, the townsfolk walking"""
    for tname, hour in (('day', 12.5), ('night', 22.0)):
        pg.evaluate(f"environment.force={{time:{hour},weather:'clear',season:'summer'}};0")
        notes.append(shot(pg, f'town-{tname}', 16))


def rooms(pg, notes):
    """each room with a keeper (its map's `keeper`), entered by its door in town: you set down at the door's front and
    stepped in (no walk there), the keeper behind the counter facing you"""
    pg.evaluate("environment.force={time:12.5,weather:'clear',season:'summer'};0")
    doors = pg.evaluate("""(()=>{const seen=new Set(),out=[];walkView.sc.props.forEach((p,i)=>{if(!p.act||!PB_DATA.opensRoom(p.act))return;
      const q=doorBuildingOf(p.act,p),id=roomFor(p.act,q),R=id&&mapById(id);if(!R||!R.keeper||seen.has(id))return;seen.add(id);out.push({i,act:p.act,id,keeper:R.keeper})});return out})()""")
    for d in [d for d in doors if not ROOM or d['id'] == ROOM]:
        ok = pg.evaluate(f"""(()=>{{const p=walkView.sc.props[{d['i']}];if(!enterRoom(p.act,p))return false;const I=uiState.goingIn,P=walkView.pl;
          if(!I||uiState.inside)return !!uiState.inside;const fr=roomFrontOf(I);P.x=fr[0];P.z=fr[1];P.route=null;P.goal=null;roomStepIn(I);return true}})()""")
        if not ok or not fast.until(pg, 'uiState.inside&&walkView.ready||false', 120):
            notes.append({'room': d['id'], 'entered': False, 'ok': ok}); print(f"  {d['id']}: not entered", flush=True); continue
        r = shot(pg, f"room-{d['id']}", 12)
        r.update(room=d['id'], keeper=d['keeper'], npcs=pg.evaluate("walkState().npcs.map(n=>n.who)"))
        notes.append(r)
        pg.evaluate("(()=>{if(uiState.inside)leaveRoom();return 0})()")
        fast.until(pg, '!uiState.inside&&walkView.ready', 60)
        shots.settle(pg, 4)


# every picture in the dressing room: each tab's thumbnails (img data URLs) and the preview canvas, hashed; with
# Figures on (CH-7), each tab waited on until every tile is its figure's (or `wait` seconds), its picture taken
DRESS_JS = """(async({wait,on})=>{const h=s=>{let a=2166136261;for(let i=0;i<s.length;i++){a^=s.charCodeAt(i);a=Math.imul(a,16777619)}return (a>>>0).toString(16)};
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 talkHide();uiState.modal=null;uiState.mq=[];renderOverlay();openDressingRoom({});
 const tabs=[...document.querySelectorAll('#dressing [data-a="dr-tab"]')].map(b=>b.dataset.t), out={};
 for(const t of tabs){closeDressingRoom();openDressingRoom({tab:t});const t0=performance.now();await sleep(600);
  let figs=0,n=0;
  if(on)for(;;){const ims=[...document.querySelectorAll('#dressing img')];n=ims.filter(i=>i.dataset.fs!=='').length;figs=ims.filter(i=>i.dataset.fs==='2').length;
   if((figs>=n&&dressingRoom.figPic)||performance.now()-t0>wait*1000)break;await sleep(250)}
  const ims=[...document.querySelectorAll('#dressing img')].map(i=>i.src), cv=document.getElementById('drCv'),
   p1=cv&&cv.width?h(cv.toDataURL()):null; await sleep(700); const p2=cv&&cv.width?h(cv.toDataURL()):null;
  out[t]={imgs:ims.length,hash:h(ims.join('|')),preview:p1===p2?p1:'moving',figTiles:figs,tiles:n,s:Math.round(performance.now()-t0)/1000,figure:!!dressingRoom.figPic};
  if(on)window.__dressShot=t;while(on&&window.__dressShot)await sleep(100)}
 closeDressingRoom();return {tabs:out,report:typeof figureReport==='function'?figureReport().dress:null}})"""


def dressing(pg, notes):
    """the dressing room with Figures off (today's 2D pictures) and on (CH-7: the figure, every tile its figure's
    picture, each tab's picture taken), each tab's pictures counted and hashed"""
    got = {}
    for on in (False, True):
        pg.evaluate(f"(()=>{{const p=saveData.preferences;p.eng={{...(p.eng||{{}}),people:{{figures:{'true' if on else 'false'},folk:true}}}};return 0}})()")
        h = pg.evaluate_handle(DRESS_JS + "(" + json.dumps({'wait': 240, 'on': on}) + ")")
        while on:
            t = pg.evaluate("window.__dressShot||null")
            if t:
                pg.screenshot(path=str(OUT / f'dressing-{t}-fig.png'))
                pg.evaluate("window.__dressShot=null;0")
            if pg.evaluate("!dressingRoom.on&&!window.__dressShot"):
                break
            time.sleep(0.3)
        got['on' if on else 'off'] = h.json_value()
    off, fig = got['off']['tabs'], got['on']['tabs']
    every = all(v['figTiles'] >= v['tiles'] and v['figure'] for v in fig.values())
    differ = all(fig[t]['hash'] != off[t]['hash'] for t in fig if fig[t]['tiles'])
    notes.append({'dressing': every and differ, 'off': off, 'on': fig, 'report': got['on']['report']})
    for t, v in fig.items():
        print(f"  dressing {t}: {v['figTiles']} of {v['tiles']} tiles figures in {v['s']} s (of {off[t]['imgs']} pictures), preview {'a figure' if v['figure'] else '2D'}", flush=True)
    print(f"  dressing room: {'every tile a figure' if every else 'NOT every tile a figure'}; {'new pictures' if differ else 'SOME TABS UNCHANGED'} with Figures on; {got['on']['report']}", flush=True)


def arena(b, base, errs, notes):
    """the run fixture's first mini-boss place: you stand at its arena's way in, the leader in the ring facing you"""
    ctx, pg = page(b, errs, f'{base}/index.html?fixture=run')
    fast.drawing(pg)
    setup(pg)
    n = pg.evaluate("saveData.run.map.nodes.findIndex(x=>x.type==='miniboss')")
    pg.evaluate(f"uiState.modal=null;uiState.mq=[];renderOverlay();runJump({n}+1)")
    foe = pg.evaluate(f"runFoeId({n})")
    if not fast.until(pg, f"walkView.ready&&saveData.trip.node==={n}+1&&walkState().npcs.some(p=>p.id==='{foe}'&&p.arena)", 60):
        notes.append({'arena': False}); ctx.close(); return
    A = pg.evaluate(f"(sc=>sc.arena&&{{x:sc.arena.x,z:sc.arena.z,from:sc.arena.from}})(mapById(LOCATIONS[{n}+1].mapId))")
    # just outside the ring's way in (inside starts the leader's intro), the camera's target reset
    pg.evaluate(f"(o=>{{const P=walkView.pl,f={A['from']},c=[{A['x']},{A['z']}],d=Math.hypot(f[0]-c[0],f[1]-c[1])||1;P.x=f[0]+(f[0]-c[0])/d*2.5+o[0];P.z=f[1]+(f[1]-c[1])/d*2.5+o[1];P.route=null;P.goal=null;walkRenderer.camT=null;return 0}})(walkView.sc.baseOff||[0,0])")
    pg.evaluate("environment.force={time:12.5,weather:'clear',season:'summer'};0")
    # the camera at the ring, from its way in (walkView.opt.look, as look-hub-buildings.py aims it)
    shots.settle(pg, 4)
    # the camera on the leader where they stand (walkView.npcAt), from the ring's way in, 7 m back and up
    pg.evaluate(f"""(o=>{{const f={A['from']},L=walkView.npcAt['{foe}']||[{A['x']}+o[0],{A['z']}+o[1]],fx=f[0]+o[0],fz=f[1]+o[1],d=Math.hypot(fx-L[0],fz-L[1])||1,u=[(fx-L[0])/d,(fz-L[1])/d],y=groundHeightAt(L[0],L[1]);
      walkView.opt.look=()=>({{eye:[L[0]+u[0]*7,y+6,L[1]+u[1]*7],tgt:[L[0],y+0.9,L[1]],fov:45}});return 0}})(walkView.sc.baseOff||[0,0])""")
    r = shot(pg, 'arena', 16)
    r.update(leader=pg.evaluate(f"walkState().npcs.find(p=>p.id==='{foe}').who"))
    notes.append(r)
    ctx.close()


def page(b, errs, url):
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=DPR, is_mobile=True, has_touch=True)
    for s in (fast.CLOCK, fast.NO_ACCOUNTS, fast.TEST_GLOBALS): ctx.add_init_script(s)
    ctx.set_default_timeout(600000)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url)
    return ctx, pg


def main():
    from playwright.sync_api import sync_playwright
    OUT.mkdir(parents=True, exist_ok=True)
    srv, base = fast.serve(fast.GAME)
    errs, notes = [], []
    t0 = time.time()
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=fast.LAUNCH)
        if ONLY & {'town', 'rooms', 'dressing'}:
            ctx, pg = page(b, errs, f'{base}/index.html?fixture=town')
            fast.drawing(pg)
            setup(pg)
            pg.evaluate("walkRenderer.camT=null;0")
            if 'town' in ONLY: town(pg, notes)
            if 'rooms' in ONLY: rooms(pg, notes)
            if 'dressing' in ONLY: dressing(pg, notes)
            ctx.close()
        if 'arena' in ONLY: arena(b, base, errs, notes)
        b.close()
    srv.shutdown()
    (OUT / f'notes-{TAG}.json').write_text(json.dumps({'shots': notes, 'errors': errs[:6]}, indent=1))
    print(f'[{time.time() - t0:5.0f}s] errors:', errs[:6])


if __name__ == '__main__':
    main()

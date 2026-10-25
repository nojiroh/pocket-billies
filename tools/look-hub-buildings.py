#!/usr/bin/env python3
"""Pictures of the hub's buildings on their showcase map (HB-5, tools/build-hub-showcase.py), for picture notes
(nothing is judged here; software drawing can't judge a look). Opens test_hub_buildings with the game's own graphics,
and takes: each row from the front at noon (landscape: the variants and roof styles side by side); the new buildings
close up, phone sized, at noon and at night, and two pictures a second and a half apart of their turning parts; then
walks into every door the map gives an act (the General store, the inn, the library, the Workshop, the Gene Bank, also
turned) and notes the room it opened. Software drawing is slow: about a minute a picture.

    python3 tools/look-hub-buildings.py                     # in validation/look-hub-buildings/
    python3 tools/look-hub-buildings.py --only=windmill     # close-ups of only these props
    python3 tools/look-hub-buildings.py --times=noon        # only these of rows, noon, night, turning, rooms
    python3 tools/look-hub-buildings.py --out=DIR

Uses the browser checks' page set-up (tools/browser_check.py: the clock, no accounts, the test globals), without the
low graphics. The numbers go to notes.json there (not kept in git)."""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import browser_check as CF  # noqa: E402
ARGS = sys.argv[1:]
ONLY = next((a.split('=', 1)[1].split(',') for a in ARGS if a.startswith('--only=')), None)
TIMES = next((a.split('=', 1)[1].split(',') for a in ARGS if a.startswith('--times=')), ['rows', 'noon', 'night', 'turning', 'rooms'])
CLOSE = ['workshop', 'gene_bank', 'lighthouse', 'windmill']  # the close-ups (by default)
OUT = Path(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--out=')), ROOT / 'validation' / 'look-hub-buildings'))
SCENE = 'test_hub_buildings'
TURNING = {'workshop', 'gene_bank', 'lighthouse', 'windmill'}
TALL = {'lighthouse': (14, 5.5), 'windmill': (12, 4.5), 'gene_bank': (10, 3)}  # camera distance, aim height

HIDE_HUD = """(()=>{const cv=walkView.cv;for(const el of document.body.querySelectorAll('*'))
 if(el!==cv&&!el.contains(cv))el.style.setProperty('visibility','hidden','important');
 for(let e=cv;e;e=e.parentElement)e.style.setProperty('visibility','visible','important');return 0})()"""
SHOW_HUD = """(()=>{for(const el of document.body.querySelectorAll('*'))el.style.removeProperty('visibility');return 0})()"""


def settle(pg, frames=8):
    f0 = pg.evaluate('walkRenderer.frames')
    if not CF.until(pg, f'walkRenderer.frames>={f0 + frames}', 240): raise Exception('stopped drawing')


def name_of(p):
    extra = ''.join(f"-{f}{p[f]}" for f in ('v', 'roof', 'rot') if p.get(f))
    return p['k'] + extra


def main():
    from playwright.sync_api import sync_playwright
    OUT.mkdir(parents=True, exist_ok=True)
    srv, base = CF.serve(CF.GAME)
    errs, notes = [], {'scene': SCENE, 'rooms': {}}
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=CF.LAUNCH)
        ctx, pg = CF.open_game(b, None, errs, low=False)
        ctx.set_default_timeout(240000)
        pg.set_viewport_size({'width': 390, 'height': 640})
        pg.goto(base + f'/index.html?test=1&scene={SCENE}')
        CF.drawing(pg)
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();environment.force={time:12.5,weather:'clear'};0")
        pg.evaluate("(()=>{const p=saveData.preferences=saveData.preferences||{};p.expert=true;p.eng={lens:{blur:0,bokeh:0}};return 0})()")
        props = pg.evaluate("walkView.sc.props.map((p,i)=>({i,k:p.k,x:p.x,z:p.z,rot:p.rot||0,v:p.v||0,roof:p.roof||'',act:p.act||''}))")
        # the recipes come in by fetch: let a few frames go by
        for _ in range(3):
            settle(pg, 10)
        pg.evaluate(HIDE_HUD)
        if 'rows' in TIMES:
            pg.set_viewport_size({'width': 960, 'height': 540})
            for sh in pg.evaluate('walkView.sc.shots.filter(s=>!s.yaw)'):
                z = sh['z'] + 4
                pg.evaluate(f"(()=>{{const x={sh['x']},z={z},y=groundHeightAt(x,z);walkView.opt.look=()=>({{eye:[x,y+9,z-24],tgt:[x,y+2,z],fov:62}});return 0}})()")
                settle(pg)
                pg.screenshot(path=str(OUT / f"row-{sh['label']}.png"))
                print('row', sh['label'], flush=True)
            pg.set_viewport_size({'width': 390, 'height': 640})
        close = [s for s in props if s['k'] in (ONLY or CLOSE)]
        for time in [t for t in ('noon', 'night') if t in TIMES]:
            pg.evaluate(f"environment.force={{time:{12.5 if time == 'noon' else 22.5},weather:'clear'}};0")
            for s in close:
                dist, aim = TALL.get(s['k'], (8, 2))
                pg.evaluate(f"(()=>{{const r={s['rot']}*Math.PI/180,f=[Math.sin(r),-Math.cos(r)],x={s['x']},z={s['z']},y=groundHeightAt(x,z);walkView.opt.look=()=>({{eye:[x+f[0]*{dist},y+{aim}+4,z+f[1]*{dist}],tgt:[x,y+{aim},z],fov:58}});return 0}})()")
                settle(pg)
                pg.screenshot(path=str(OUT / f"{name_of(s)}-{time}.png"))
                if time == 'noon' and 'turning' in TIMES and s['k'] in TURNING and not s['rot']:
                    pg.wait_for_timeout(1500)
                    settle(pg, 4)
                    pg.screenshot(path=str(OUT / f"{name_of(s)}-turning.png"))
                print(name_of(s), time, flush=True)
        pg.evaluate('delete walkView.opt.look')
        pg.evaluate(SHOW_HUD)
        pg.evaluate("environment.force={time:12.5,weather:'clear'};0")
        # walk in through each door with an act, note the room, take a picture inside, come back out
        for s in props:
            if 'rooms' not in TIMES or not s['act'] or (ONLY and s['k'] not in ONLY): continue
            got = pg.evaluate(f"(()=>{{const p=walkView.sc.props[{s['i']}];walkView.pl.x=p.x;walkView.pl.z=p.z-3;const ok=enterRoom(p.act,p);return {{ok,inside:uiState.inside?uiState.inside.id:null}}}})()")
            settle(pg, 30)
            pg.screenshot(path=str(OUT / f"room-{name_of(s)}.png"))
            notes['rooms'][name_of(s)] = got
            pg.evaluate("(()=>{if(uiState.inside&&typeof leaveRoom==='function')leaveRoom();return 0})()")
            settle(pg, 10)
            print('room', name_of(s), got, flush=True)
        ctx.close(); b.close()
    srv.shutdown()
    notes['errors'] = errs[:6]
    (OUT / 'notes.json').write_text(json.dumps(notes, indent=2))
    print(json.dumps(notes['rooms']), 'errors:', notes['errors'])


if __name__ == '__main__':
    main()

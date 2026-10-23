"""phase 08b: how long walking into a building takes, headless (software drawing, so slower than a phone; compare runs
with each other, not with the phone). For each sample door: the time from the tap at the door until the room is shown
and drawing, the first time (cold) and again (warm), and how the game says it went (the debug log's "inside" line).

    python3 tools/measure-rooms.py              # writes validation/rooms/rooms.json and prints a table
"""
import importlib.util
import json
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('check_quick', ROOT / 'tools' / 'check-quick.py')
Q = importlib.util.module_from_spec(spec)
spec.loader.exec_module(Q)

# (place, the building's catalog kind, what it does)
SAMPLES = [
    ('marigold', 'shop', 'shop'),
    ('marigold', 'market_hall', 'shop'),
    ('marigold', 'sign_shop', 'shop'),
    ('marigold', 'house_red', 'house'),
    ('verdigris', 'mansion', 'house'),
    ('verdigris', 'townhouse_red', 'house'),
]

# the room is open and drawn: either way the game shows one (a room view laid into the place, a room map on its own,
# or the room drawn over the place)
OPEN = """(()=>{const I=uiState.inside;if(!I||!walkView.ready)return false;
  if(walkView.room)return !!walkView.room.ready;
  return walkView.id===I.id||(walkView.sc&&walkView.sc.roomOf===I.id)})()"""


def measure(pg, node, kind, act):
    Q.go_scene(pg, node)
    time.sleep(1)
    found = pg.evaluate(f"!!walkView.sc.props.find(p=>p.act==='{act}'&&p.k==='{kind}')")
    if not found: return {'error': 'no such building here'}
    out = {}
    for run in ('cold', 'warm'):
        n0 = pg.evaluate("debugLog.ev.length")
        pg.evaluate(f"""(()=>{{const p=walkView.sc.props.find(p=>p.act==='{act}'&&p.k==='{kind}'),C=walkData().sc,g=actionSpot(p,C.props[p.k],C.ppu||34);
          walkView.pl.route=null;walkView.pl.x=g[0];walkView.pl.z=g[1];window.__t0=performance.now();walkPick({{k:'act',p,act:'{act}'}})}})();0""")
        if not Q.until(pg, OPEN, 30): out[run] = {'error': 'never opened', 'view': pg.evaluate('walkView.id')}; break
        ms = pg.evaluate("performance.now()-window.__t0")
        f0 = pg.evaluate('walkRenderer.frames'); Q.until(pg, f'walkRenderer.frames>{f0 + 1}', 20)
        drawn = pg.evaluate("performance.now()-window.__t0")
        said = pg.evaluate(f"debugLog.ev.slice({n0}).map(e=>e.msg).filter(t=>/inside|room/.test(t))")
        out[run] = {'open_ms': round(ms), 'drawn_ms': round(drawn), 'log': said[-2:]}
        pg.evaluate('leaveRoom();0')
        Q.until(pg, '!uiState.inside&&walkView.ready&&!walkView.room&&!(walkView.sc&&walkView.sc.roomRect)', 30)
        time.sleep(1)
    return out


def main():
    from playwright.sync_api import sync_playwright
    out_dir = ROOT / 'validation' / 'rooms'
    out_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(['node', str(ROOT / 'tools' / 'build-data.mjs')], check=True)  # data/gamedata.js from the files as they are
    srv, base = Q.serve(Q.GAME)
    errs = []
    res = []
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx, pg = Q.open_game(b, base, 412, 860, True, errs)
        Q.play(pg)
        nodes = pg.evaluate("Object.fromEntries(LOCATIONS.map((l,i)=>[l.mapId,i]))")
        for place, kind, act in SAMPLES:
            r = measure(pg, nodes[place], kind, act)
            res.append({'place': place, 'kind': kind, 'act': act, **r})
            print(place, kind, json.dumps(r, ensure_ascii=False))
        ctx.close(); b.close()
    srv.shutdown()
    (out_dir / 'rooms.json').write_text(json.dumps({'when': time.strftime('%Y-%m-%d %H:%M'), 'rooms': res, 'errors': errs[:20]}, indent=2, ensure_ascii=False))
    if errs: print('errors:', ' | '.join(errs[:4]))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Assets track AS-2: pictures of New game's crash scene (IN-5, cutscenes/crash.json) on the prepared run's landing,
for the HANDOFF entry (nothing is judged here): each of the scene's camera shots as it plays (lines tapped through),
the starter pick, and the landing seen from above with the crash site and the halt (or, before AS-2, the mast).

    python3 tools/look-crash.py               # in validation/look-crash/
    python3 tools/look-crash.py --site        # faster: no scene; the prepared run's landing (the debug menu's
                                              # "Prepared run") from above, from the south and from each of the
                                              # scene's cameras (cutscenes/crash.json shots, metres from the halt)
    python3 tools/look-crash.py --out=DIR

Uses the browser checks' page set-up (tools/browser_check.py), without the low graphics."""
import sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import browser_check as CF  # noqa: E402
ARGS = sys.argv[1:]
SITE = '--site' in ARGS
OUT = Path(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--out=')), ROOT / 'validation' / 'look-crash'))


def settle(pg, frames=6):
    f0 = pg.evaluate('walkRenderer.frames')
    CF.until(pg, f'walkRenderer.frames>={f0 + frames}', 240)


def site(pg, base, ctx, b, srv, errs):
    pg.goto(base + '/index.html?fixture=town')
    CF.drawing(pg)
    pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();environment.force={time:12.5,weather:'clear'};0")
    if not pg.evaluate("runTakeOffPrepared()"): raise Exception('the prepared run didn’t start')
    if not CF.until(pg, "!!saveData.run&&saveData.run.at.phase==='walk'&&runLoad.ready&&walkView.ready&&!!walkView.sc.props.find(p=>p.act==='fly')", 240): raise Exception('never stood on the landing')
    pg.evaluate("(()=>{const p=saveData.preferences=saveData.preferences||{};p.expert=true;p.eng={lens:{blur:0,bokeh:0}};return 0})()")
    settle(pg, 20)
    m = pg.evaluate("(()=>{const p=walkView.sc.props.find(q=>q.act==='fly');return {x:p.x,z:p.z,rot:p.rot||0,k:p.k}})()")
    print('landing prop', m, flush=True)
    shots = pg.evaluate("CUTSCENES.crash.shots")
    views = [('above', [m['x'] - 7, 46, m['z'] - 14], [m['x'] - 7, 0, m['z'] + 1], 60),
             ('south', [m['x'] - 6, 12, m['z'] - 24], [m['x'] - 6, 1, m['z'] + 2], 60)]
    for name, S in shots.items():  # metres from the landing prop, unturned (mapgen's halts face the camera)
        e, t = S['eye'], S['tgt']
        views.append((f'cam-{name}', [m['x'] + e[0], e[1], m['z'] + e[2]], [m['x'] + t[0], t[1], m['z'] + t[2]], S.get('fov', 44)))
    for name, eye, tgt, fov in views:
        pg.evaluate(f"(()=>{{const g=groundHeightAt({eye[0]},{eye[2]}),h=groundHeightAt({tgt[0]},{tgt[2]});walkView.opt.look=()=>({{eye:[{eye[0]},g+{eye[1]},{eye[2]}],tgt:[{tgt[0]},h+{tgt[1]},{tgt[2]}],fov:{fov}}});return 0}})()")
        settle(pg, 12)
        pg.screenshot(path=str(OUT / f'{name}.png'))
        print(name, flush=True)
    ctx.close(); b.close()
    srv.shutdown()
    print('errors:', errs[:6])


def main():
    from playwright.sync_api import sync_playwright
    OUT.mkdir(parents=True, exist_ok=True)
    srv, base = CF.serve(CF.GAME)
    errs = []
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=CF.LAUNCH)
        ctx, pg = CF.open_game(b, None, errs, low=False)
        ctx.set_default_timeout(240000)
        pg.set_viewport_size({'width': 390, 'height': 640})
        if SITE: return site(pg, base, ctx, b, srv, errs)
        pg.goto(base + '/index.html?fixture=title')
        CF.until(pg, "!!document.querySelector('[data-a=intro]')", 120)
        pg.click('[data-a=intro]')
        if not CF.until(pg, 'cutscene.on', 120): raise Exception('the crash scene didn’t start')
        n, t0, last, early = 0, time.time(), None, [1.5, 4.5, 8]
        while time.time() - t0 < 600:
            st = pg.evaluate("({choosing:!!cutscene.choosing,say:cutscene.say?String(cutscene.say.text||'1'):''})")
            if st['choosing']:
                settle(pg)
                pg.screenshot(path=str(OUT / 'pick.png'))
                print('pick', flush=True)
                break
            if early and time.time() - t0 > early[0]:
                early.pop(0); n += 1
                pg.screenshot(path=str(OUT / f'shot-{n:02d}.png')); print('shot', n, flush=True)
            if st['say'] and st['say'] != last:
                last = st['say']; settle(pg, 4); n += 1
                pg.screenshot(path=str(OUT / f'shot-{n:02d}.png')); print('shot', n, flush=True)
                pg.evaluate('cutscene.say&&cutscene.say.tap();0')
            time.sleep(0.3)
        # the landing from above: the crash site and the halt, north at the top
        top = pg.evaluate("(()=>{const sc=walkView.sc,m=sc.props.find(p=>p.act==='fly');return m&&{x:m.x,z:m.z,k:m.k}})()")
        print('landing prop', top, flush=True)
        if top:
            for name, eye, tgt, fov in (('above', [top['x'] - 7, 46, top['z'] - 14], [top['x'] - 7, 0, top['z'] + 1], 60),
                                        ('south', [top['x'] - 6, 12, top['z'] - 24], [top['x'] - 6, 1, top['z'] + 2], 60)):
                pg.evaluate(f"walkView.opt.look=()=>({{eye:{eye},tgt:{tgt},fov:{fov}}});0")
                settle(pg, 12)
                pg.screenshot(path=str(OUT / f'{name}.png'))
                print(name, flush=True)
        ctx.close(); b.close()
    srv.shutdown()
    print('errors:', errs[:6])


if __name__ == '__main__':
    main()

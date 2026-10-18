#!/usr/bin/env python3
"""The long play-test: Pocket Billies in a real browser at four screen sizes, with screenshots in validation/.
Best run on a computer with a graphics chip; on a machine without one it takes about half an hour.
For a quick check (a few minutes, made for a test machine without a graphics chip) use tools/check-quick.py.
The game's own full test (the debug menu: Settings → Debug, or Ctrl+Shift+D → Full test) is not run here: run it on your phone or computer and
send the debug log.

    pip install playwright && python3 -m playwright install chromium
    python3 tools/check-game.py            # the game: every screen, every battle backdrop, phone/tablet/desktop
    python3 tools/check-game.py --studio   # also: a Studio round trip on a temporary copy (your files are not touched)

Nothing here writes into game/ or studio/. Results go to validation/results.json (screenshots are PNG; the shipped ones were shrunk to WebP)."""
import json, os, shutil, socket, subprocess, sys, tempfile, threading, time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# phase 04d: the modules' names on window (game/js/test-globals.js), only for this script's page.evaluate() calls
TEST_GLOBALS = "window.PB_TEST_GLOBALS=true"

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'validation'
VIEWPORTS = [('phone', 390, 844, 3, True), ('tablet', 820, 1180, 2, True), ('desktop', 1440, 900, 1, False), ('phone-landscape', 844, 390, 3, True)]


T0 = time.time()
# the test browser draws in software: half resolution and a smaller shadow map keep each frame quick, so the page
# answers between frames and the run takes minutes instead of an hour (layout and screenshots are unchanged in size)
TEST_RENDER = "GD.engine=GD.engine||{};GD.engine.defaults=Object.assign({},GD.engine.defaults||{},{quality:{resolution:.5,shadowMap:1024,auto:true}});0"


def log(msg):
    """progress with the time since the start, so a long run shows where it is (and where it's slow)"""
    print(f'[{time.time() - T0:7.1f}s] {msg}', flush=True)


def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


def serve(directory):
    port = free_port()
    class Quiet(SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    srv = ThreadingHTTPServer(('127.0.0.1', port), partial(Quiet, directory=str(directory)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f'http://127.0.0.1:{port}'


def wait_phase(pg, want=('choose',), tries=120):
    for _ in range(tries):
        ph = pg.evaluate('B?B.phase:"none"')
        if ph in want:
            return ph
        if ph == 'playing':
            pg.evaluate('tapMsg()')
        time.sleep(.15)
    return pg.evaluate('B?B.phase:"none"')


def check_game(pw, base, results):
    b = pw.chromium.launch()
    for name, w, h, dpr, mob in VIEWPORTS:
        ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dpr, is_mobile=mob, has_touch=mob)
        ctx.set_default_timeout(240000)  # the 3D scene renders in software here, so pictures can take a while
        ctx.add_init_script(TEST_GLOBALS)
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        log(f'{name}: open the game'); t0 = time.time(); pg.goto(base + '/index.html'); pg.wait_for_selector('.ttl,.title', timeout=30000); boot = round(time.time() - t0, 2); pg.evaluate(TEST_RENDER)
        if name in ('phone', 'desktop'):
            # the opening cutscene: Start, skip the talk, make a trainer, pick a starter
            log(f'{name}: opening cutscene'); pg.click('[data-a=intro]'); time.sleep(4); opening = {'cutscene': pg.evaluate('CS.on')}
            pg.screenshot(path=str(OUT / f'{name}-opening.png'))
            def until(cond, n=90):
                for _ in range(n):
                    if pg.evaluate(cond): return True
                    pg.evaluate("CS.say&&CS.say.tap();CS.skip||csSkip()"); time.sleep(.5)
                return False
            if opening['cutscene']:
                opening['dressingRoom'] = until('DR.on'); time.sleep(1); pg.screenshot(path=str(OUT / f'{name}-opening-dress.png'))
                pg.click('[data-a=dr-preset][data-i="2"]'); pg.fill('#drName', 'Checker'); pg.click('[data-a=dr-save]')
                opening['picker'] = until('CS.choosing'); time.sleep(1.5); pg.screenshot(path=str(OUT / f'{name}-opening-pick.png'))
                pg.click('[data-a=cs-next]'); time.sleep(.6); pg.click('[data-a=cs-choose]'); pg.click('[data-a=cs-yes]')
                opening['started'] = until('S.started'); time.sleep(1.5)
                opening['result'] = pg.evaluate('[S.starter,S.avatar.name,S.team.length]')
                opening['ok'] = bool(opening['started'] and opening['result'][0] == 'scoop' and opening['result'][1] == 'Checker')
                # v47: Blake's first battle (Hazel's tips), then the talk after it and the welcome sheet
                opening['rivalBattle'] = False
                for _ in range(120):
                    if pg.evaluate("!!B&&B.phase==='choose'"): opening['rivalBattle'] = pg.evaluate("!!(B.T&&B.T.tutorial)"); break
                    time.sleep(1)
                pg.screenshot(path=str(OUT / f'{name}-opening-rival.png'))
                pg.evaluate("if(B){B.over='win';stopTimers();endBattle()}0")
                for _ in range(80):
                    if pg.evaluate("!TALK.on&&!!U.modal&&!B"): break
                    pg.evaluate('TALK.cur&&TALK.cur.tap()'); time.sleep(.8)
                opening['afterRival'] = pg.evaluate("(S.story||{}).rival0||null")
                opening['ok'] = opening['ok'] and bool(opening['rivalBattle']) and opening['afterRival'] == 'win'
            results.setdefault('opening', {})[name] = opening
            if opening.get('ok'):
                # the rival's scene at the golf course, then his battle
                pg.evaluate("U.modal=null;U.mq=[];renderOv();S.route={node:2,prog:0,plan:[],hold:false};S.visited[2]=1;U.roam=null;U.tab='walk';render();0")
                rival = {'scene': False, 'battle': False}; log(f'{name}: rival scene')
                for _ in range(40):
                    if pg.evaluate('CS.on'): rival['scene'] = True; break
                    time.sleep(1)
                time.sleep(3); pg.screenshot(path=str(OUT / f'{name}-rival.png'))
                for _ in range(80):
                    if pg.evaluate('!!B'): rival['battle'] = pg.evaluate('B.foeName'); break
                    pg.evaluate('TALK.cur&&TALK.cur.tap()'); time.sleep(.8)
                results.setdefault('rival', {})[name] = rival
                pg.evaluate("if(B){stopTimers();B=null;battleStageStop()}render();0")
        pg.evaluate("if(typeof titleEnd==='function')titleEnd();U.pg='girl';startGame('scoop');S.story={met_chad:1,met_chad2:1};U.modal=null;U.mq=[];renderOv();S.team.push(makeMon('box1',18));addSteps(2400,true);U.toastQ=[];U.toastOn=false;U.modal=null;U.mq=[];renderOv();render();0")
        log(f'{name}: screens and battles')
        for tab in ['walk', 'map', 'team', 'ledger', 'profile']:
            pg.evaluate(f"U.tab='{tab}';render();scrollTo(0,0);0"); time.sleep(1.4 if tab == 'map' else .5)
            pg.screenshot(path=str(OUT / f'{name}-{tab}.png'))
        pg.evaluate("U.tab='walk';S.route.node=0;render();openShop('sundown');0"); time.sleep(.5); pg.screenshot(path=str(OUT / f'{name}-shop.png'))
        pg.evaluate("closeModal();wipe=f=>f();0")
        areas = pg.evaluate('Object.keys(BACKDROPS)') if name == 'phone' else ['grass', 'mall']
        pg.evaluate("S.preferences.battleStage='classic';0")  # the painted backdrops first
        for area in areas:
            pg.evaluate(f"B=null;const q={{id:'t{area}',sp:'tweet1',lvl:12,gold:false,no:1}};S.queue=[q];S.team.forEach(m=>{{m.hp=maxHp(m)}});const f=areaKey;areaKey=()=>'{area}';startWild(q);areaKey=f;0")
            wait_phase(pg); time.sleep(.6)
            pg.screenshot(path=str(OUT / f'{name}-battle-{area}.png'))
            pg.evaluate("stopTimers();B=null;battleStageStop();render();0")
        # then a battle on the 3D stage, where you stand in the walk scene
        pg.evaluate("S.preferences.battleStage='scene';U.tab='walk';S.route={node:0,prog:0,plan:[],hold:false};render();0"); time.sleep(2)
        pg.evaluate("const q={id:'t3d',sp:'tweet1',lvl:12,gold:false,no:1};S.queue=[q];startWild(q);0")
        wait_phase(pg); time.sleep(1)
        pg.screenshot(path=str(OUT / f'{name}-battle-3d.png'))
        results.setdefault('battle3d', {})[name] = pg.evaluate("[!!battleStage.gl,!!walkView.battle,walkView.id]")
        pg.evaluate("stopTimers();B=null;battleStageStop();render();0")
        pg.evaluate("S.team=[makeMon('hood2',45),makeMon('box1',30)];S.route.node=4;startTrainer('crude');0")
        won = False
        for _ in range(60):
            ph = wait_phase(pg, ('choose', 'switch', 'end'))
            if ph == 'end':
                won = pg.evaluate("B.over")=='win'; break
            if ph == 'switch':
                pg.evaluate("document.querySelector('[data-a=bswitch]:not([disabled])').click()"); continue
            pg.evaluate("document.querySelector('[data-a=bfight]').click()"); pg.evaluate("document.querySelector('[data-a=bmove]').click()")
        if name in ('phone', 'desktop'):
            # every walk scene, walking around in a town, and a trip along two roads
            log(f'{name}: every walk scene')
            pg.evaluate("stopTimers&&stopTimers();B=null;battleStageStop();S.queue=[];U.tab='walk';0")
            for i in range(pg.evaluate('ROUTE.length')):
                pg.evaluate(f"S.route={{node:{i},prog:0,plan:[],hold:false}};S.visited[{i}]=1;U.roam=null;render();0"); time.sleep(2.6)
                if name == 'phone' or i in (0, 10, 12): pg.screenshot(path=str(OUT / f'{name}-scene-{pg.evaluate("walkView.id")}.png'))
            if name == 'desktop':
                # v18: cliffs, stairs, bridges, waterfalls, arches and escalators up close
                for node, x, z, label in ((0, 23.2, 17.6, 'sundown-stairs'), (12, 32.5, 9.6, 'city-canal'), (12, 32.5, 30.5, 'city-stairs'), (11, 22, 25.6, 'ridge-bridge'),
                                          (9, 27, 21, 'pond-falls'), (8, 31, 18.5, 'mall-escalators'), (4, 11.2, 14.2, 'grotto-cascade'), (5, 19.3, 7.4, 'canyon-arch')):
                    if node >= pg.evaluate('ROUTE.length'): continue
                    pg.evaluate(f"S.route={{node:{node},prog:0,plan:[],hold:false}};S.visited[{node}]=1;U.roam=null;render();0"); time.sleep(2.6)
                    pg.evaluate(f"walkView.pl.x={x};walkView.pl.z={z};walkView.pl.route=null;0"); time.sleep(2.2)
                    pg.screenshot(path=str(OUT / f'desktop-geo-{label}.png'))
            pg.evaluate("S.route={node:0,prog:0,plan:[],hold:false};U.roam=null;render();0"); time.sleep(1.5)
            tgt = pg.evaluate("walkablePointNear(20.5,13.4)")
            pt = pg.evaluate("(([x,z])=>{const q=worldToScreen(walkView.C,x,0,z),r=walkView.cv.getBoundingClientRect();return [r.left+q.x/walkView.cv.width*r.width,r.top+q.y/walkView.cv.height*r.height]})(%s)" % json.dumps(tgt))
            pg.mouse.click(pt[0], pt[1]); time.sleep(.5)
            for _ in range(80):  # software rendering in a test browser can be slow; wait until the walk ends
                if pg.evaluate("!walkView.pl.route"): break
                time.sleep(.25)
            roam = pg.evaluate("[+walkView.pl.x.toFixed(1),+walkView.pl.z.toFixed(1)]")
            pg.evaluate("(()=>{const n=tripTo(9).steps;setTrip(9);addSteps(n,true)})();U.toastQ=[];U.modal=null;U.mq=[];renderOv();render();0"); time.sleep(3)
            trip = pg.evaluate("[S.route.node,S.route.plan.length,walkView.id,!!S.visited[9]]")
            pg.screenshot(path=str(OUT / f'{name}-arrived.png'))
            results.setdefault('walk', {})[name] = {'walkedTo': roam, 'tripEnd': trip, 'ok': abs(roam[0] - tgt[0]) < .8 and abs(roam[1] - tgt[1]) < .8 and trip[0] == 9 and trip[1] == 0 and trip[2] == 'pond'}
        fps = pg.evaluate('[FRAME.meter.fps,FRAME.hz,battleStage.q.lvl]')
        results['viewports'][name] = {'bootSeconds': boot, 'errors': errs[:10], 'trainerBattleWon': won, 'battleFps': fps[0], 'displayHz': fps[1], 'qualityLevel': fps[2]}
        ctx.close()
    b.close()


def check_studio(pw, results):
    log('studio: round trip'); tmp = Path(tempfile.mkdtemp(prefix='networth-studio-'))
    for d in ('game', 'studio'):
        shutil.copytree(ROOT / d, tmp / d)
    shutil.copy2(ROOT / 'start-studio.py', tmp / 'start-studio.py')
    port = free_port()
    proc = subprocess.Popen([sys.executable, str(tmp / 'start-studio.py'), '--no-browser'], env={**os.environ, 'NETWORTH_STUDIO_PORT': str(port)}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1.5)
        b = pw.chromium.launch(); ctx = b.new_context(viewport={'width': 1440, 'height': 900}); ctx.add_init_script(TEST_GLOBALS); ctx.set_default_timeout(240000); pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto(f'http://localhost:{port}/studio/index.html'); pg.wait_for_selector('.split', timeout=30000); time.sleep(1)
        for sec in ['billionaires', 'moves', 'preview', 'types', 'items', 'shops', 'world', 'scenes', 'engine', 'wardrobe', 'trainers', 'people', 'jobs', 'rules', 'art', 'check']:
            pg.evaluate(f"go('{sec}')"); time.sleep(2 if sec in ('preview', 'scenes', 'engine') else .6); pg.screenshot(path=str(OUT / f'studio-{sec}.png'))
        pg.evaluate("go('scenes');SCN.tool='steps';SCN.smode='stairs';SCN.walkOv=true;render()"); time.sleep(3); pg.evaluate("scMapDraw()"); time.sleep(.5)
        pg.screenshot(path=str(OUT / 'studio-scenes-steps.png'))
        pg.evaluate("SCN.tool='paint';SCN.walkOv=false;go('rules')"); time.sleep(.6)
        pg.evaluate("go('moves',{move:'lawsuit'})"); pg.fill('input[data-p="moves.lawsuit.p"]', '77'); pg.dispatch_event('input[data-p="moves.lawsuit.p"]', 'change')
        # a new billionaire from a blank body, finished in the skeleton builder
        pg.evaluate("go('billionaires')"); pg.click('[data-act=newLine]'); time.sleep(.5); pg.fill('#nwName', 'Checko'); pg.click('.dlg-btns .btn.primary')
        pg.wait_for_selector('.skel', timeout=10000); time.sleep(1)
        pg.click('[data-sk=sel][data-n=head]'); pg.click('[data-sk=child]'); time.sleep(.4)
        pg.screenshot(path=str(OUT / 'studio-skeleton.png'))
        pg.click('[data-sk=close]'); time.sleep(.4)
        # the battle preview, with the new billionaire as the opponent
        pg.evaluate("BP.foe='checko1';go('preview')"); time.sleep(2.5); pg.evaluate("ACTS.bp({x:'move1'})"); time.sleep(.6)
        pg.screenshot(path=str(OUT / 'studio-preview-new.png'))
        # map art: repaint the trail along the stops
        pg.evaluate("go('world',{wtab:'paint'})"); time.sleep(2.5); pg.click('[data-mp=paintTrail]'); time.sleep(1)
        pg.evaluate("document.querySelector('#main').scrollTop=0"); pg.screenshot(path=str(OUT / 'studio-mapart.png'))
        pg.click('#saveBtn'); time.sleep(5)
        pg.evaluate("go('rules')")  # leave the heavier 3D sections before opening the game
        g = b.new_context(viewport={'width': 1440, 'height': 900}); g.add_init_script(TEST_GLOBALS); g = g.new_page(); g.set_default_timeout(240000); gerrs = []
        g.on('pageerror', lambda e: gerrs.append(str(e))); g.on('console', lambda m: gerrs.append(m.text) if m.type == 'error' else None)
        g.goto(f'http://localhost:{port}/game/index.html'); g.wait_for_selector('.ttl,.title', timeout=30000)
        seen = g.evaluate("[MOVES.lawsuit.p,!!SP.checko0,!!(RIGS.checko0&&RIGS.checko0.front.bones.some(b=>b.n==='headTip'))]")
        results['studioSeen'] = seen
        if not seen[1]:
            results['studio'] = {'errors': (errs + gerrs + ['the new billionaire did not reach the game'])[:10], 'movePowerSaved': seen[0] == 77, 'newBillionaireInGame': False, 'builderPartInGame': seen[2]}
            b.close(); return
        g.evaluate("if(typeof titleEnd==='function')titleEnd();U.pg='girl';startGame('scoop');U.modal=null;U.mq=[];renderOv();wipe=f=>f();B=null;const q={id:'tc',sp:'checko0',lvl:9,gold:false,no:1};S.queue=[q];startWild(q);0")
        wait_phase(g); time.sleep(.6); g.screenshot(path=str(OUT / 'studio-new-in-game.png'))
        results['studio'] = {'errors': (errs + gerrs)[:10], 'movePowerSaved': seen[0] == 77, 'newBillionaireInGame': seen[1], 'builderPartInGame': seen[2]}
        b.close()
    finally:
        proc.terminate(); shutil.rmtree(tmp, ignore_errors=True)


def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('Install Playwright first:  pip install playwright && python3 -m playwright install chromium'); sys.exit(1)
    OUT.mkdir(exist_ok=True)
    srv, base = serve(ROOT / 'game')
    results = {'viewports': {}, 'when': time.strftime('%Y-%m-%d %H:%M'), 'testRender': 'half resolution, 1024 shadow map (software rendering)'}
    with sync_playwright() as pw:
        check_game(pw, base, results)
        (OUT / 'results.json').write_text(json.dumps(results, indent=2))  # kept even if the Studio part fails
        if '--studio' in sys.argv:
            check_studio(pw, results)
    srv.shutdown()
    (OUT / 'results.json').write_text(json.dumps(results, indent=2))
    log('done'); print(json.dumps(results, indent=2))
    bad = any(v['errors'] for v in results['viewports'].values()) or ('studio' in results and results['studio']['errors']) or any(not v['ok'] for v in results.get('walk', {}).values()) or any(not v.get('ok') for v in results.get('opening', {}).values()) or any(not v.get('battle') for v in results.get('rival', {}).values())
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()

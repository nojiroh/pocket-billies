#!/usr/bin/env python3
"""Pictures of the intro's art (intro track IN-3, tools/build-intro-art.py), for the HANDOFF entry (nothing is judged
here). Opens the showcase map test_intro_art with the game's own graphics and takes:

  wreck-<theme>.png        each train's wreck, wide (a phone held sideways)
  wreck-close.png          the base wreck from nearer, phone sized
  portal-<n>.png           the Bureau's portal opening, frame by frame, with the two clerks either side (phone sized)
  portal-night.png         the open portal at night (it is drawn unlit: light only)
  clerk-stamp.png          both clerks' stamp pose, drawn by the game (person-art.js personBattlePose), 3x
  clerk-walk.png           both clerks' walk cycle, down and up, 3x
  boss.png                 the first run's retrieval bot (bot:volt.intake.seizer.franker.conveyor), front and back, 3x

    python tools/look-intro-art.py               # in validation/look-intro-art/
    python tools/look-intro-art.py --out=DIR

Uses the browser checks' page set-up (tools/browser_check.py), without the low graphics."""
import base64
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import browser_check as CF  # noqa: E402
ARGS = sys.argv[1:]
OUT = Path(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--out=')), ROOT / 'validation' / 'look-intro-art'))
THEMES = ['lakeland', 'greenbelt', 'wildwood', 'highland', 'harvest']
BOSS = 'bot:volt.intake.seizer.franker.conveyor'
HIDE_HUD = """(()=>{const cv=walkView.cv;for(const el of document.body.querySelectorAll('*'))
 if(el!==cv&&!el.contains(cv))el.style.setProperty('visibility','hidden','important');
 for(let e=cv;e;e=e.parentElement)e.style.setProperty('visibility','visible','important');return 0})()"""
# draws pictures the game makes (each a canvas) into one sheet, 3x, on a pale ground; returns a PNG data URL
SHEET = """(rows => {
  const S = 3, gap = 6, W = Math.max(...rows.map(r => r.reduce((t, c) => t + c.width + gap, gap))),
    H = rows.reduce((t, r) => t + Math.max(...r.map(c => c.height)) + gap, gap),
    o = document.createElement('canvas');
  o.width = W * S; o.height = H * S;
  const x = o.getContext('2d');
  x.imageSmoothingEnabled = false; x.fillStyle = '#C8D2DC'; x.fillRect(0, 0, o.width, o.height);
  let y = gap;
  for (const r of rows) {
    let cx = gap;
    const h = Math.max(...r.map(c => c.height));
    for (const c of r) { x.drawImage(c, cx * S, (y + h - c.height) * S, c.width * S, c.height * S); cx += c.width + gap; }
    y += h + gap;
  }
  return o.toDataURL('image/png');
})"""


def settle(pg, frames=8):
    f0 = pg.evaluate('walkRenderer.frames')
    if not CF.until(pg, f'walkRenderer.frames>={f0 + frames}', 240): raise Exception('stopped drawing')


def look(pg, eye, tgt, fov):
    pg.evaluate(f"(()=>{{const g=groundHeightAt({eye[0]},{eye[2]}),h=groundHeightAt({tgt[0]},{tgt[2]});walkView.opt.look=()=>({{eye:[{eye[0]},g+{eye[1]},{eye[2]}],tgt:[{tgt[0]},h+{tgt[1]},{tgt[2]}],fov:{fov}}});return 0}})()")


def save_url(url, path):
    path.write_bytes(base64.b64decode(url.split(',', 1)[1]))


def sheets(pg):
    """the clerks' poses and the boss bot, drawn by the game's own person art once their pictures are in"""
    pg.evaluate(f"PEOPLE.__boss={{look:{{name:'Retrieval bot'}},creature:{{rig:'{BOSS}',ht:1.3}}}};0")
    files = pg.evaluate(f"robotArtFiles('{BOSS}', gameData.robots).concat(robotArtFiles('bot:tide.intake.franker.seizer.hover', gameData.robots), robotArtFiles('bot:volt.intake.seizer.franker.striders', gameData.robots))")
    pg.evaluate(f"{files!r}.forEach(f=>artImg(f));0")
    CF.until(pg, f"{files!r}.every(f=>artReady(f))", 60)
    who = ['bureau_clerk_a', 'bureau_clerk_b']
    stamp = pg.evaluate(SHEET + "(" + repr(who) + ".map(w => Array.from({length: 13}, (_, i) => personBattlePose(w, 'front', 'stamp', i / 12))))")
    save_url(stamp, OUT / 'clerk-stamp.png')
    walk = pg.evaluate(SHEET + "(" + repr(who) + ".flatMap(w => ['down', 'up'].map(d => { const F = personWalkFrames(w)[d]; return F.cyc ? F.cyc.slice() : [F[0], F[1], F[2]]; })))")
    save_url(walk, OUT / 'clerk-walk.png')
    boss = pg.evaluate(SHEET + "([[personWalkFrames('__boss').down[0], personWalkFrames('__boss').up[0], personBattlePose('__boss', 'front', 'stamp', 0.5), personBattlePose('__boss', 'front', 'stamp', 0.8)]])")
    save_url(boss, OUT / 'boss.png')
    print('clerk-stamp clerk-walk boss', flush=True)


def main():
    from playwright.sync_api import sync_playwright
    OUT.mkdir(parents=True, exist_ok=True)
    srv, base = CF.serve(CF.GAME)
    errs = []
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=CF.LAUNCH)
        ctx, pg = CF.open_game(b, None, errs, low=False)
        ctx.set_default_timeout(240000)
        pg.set_viewport_size({'width': 844, 'height': 390})
        pg.goto(base + '/index.html?test=1&scene=test_intro_art')
        CF.drawing(pg)
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();environment.force={time:12.5,weather:'clear'};0")
        pg.evaluate("(()=>{const p=saveData.preferences=saveData.preferences||{};p.expert=true;p.eng={lens:{blur:0,bokeh:0}};return 0})()")
        # a test scene stands nobody in it: the two clerks either side of the portal, you out of the way
        pg.evaluate("""(()=>{const f=walkView.opt.state;walkView.opt.state=()=>{const s=f();s.npcs=[
          {who:'bureau_clerk_a',id:'_clerk_a',at:[42.3,7.4],done:true,exit:null,dir:'down'},
          {who:'bureau_clerk_b',id:'_clerk_b',at:[45.7,7.4],done:true,exit:null,dir:'down'}];return s};return 0})()""")
        CF.stand(pg, 52, 3)
        settle(pg, 30)
        pg.evaluate(HIDE_HUD)
        for i, theme in enumerate(THEMES):  # each wreck, its footprint 22 m wide behind its base point
            x = 14 + i * 26
            look(pg, [x, 9, 7], [x, 1.5, 27], 58)
            settle(pg, 14)
            pg.screenshot(path=str(OUT / f'wreck-{theme}.png'))
            print('wreck-' + theme, flush=True)
        pg.set_viewport_size({'width': 390, 'height': 640})
        look(pg, [14, 8, 9], [14, 1.6, 27], 66)
        settle(pg, 14)
        pg.screenshot(path=str(OUT / 'wreck-close.png'))
        print('wreck-close', flush=True)
        # the portal opening: its placement's open time set so each shot falls in the next frame (700 ms, 6 frames)
        look(pg, [44, 4.2, 1.0], [44, 0.6, 8.2], 58)
        settle(pg, 10)
        for n, ms in enumerate((40, 160, 280, 400, 520, 640, 900)):
            pg.evaluate(f"(()=>{{const p=walkView.sc.props.find(q=>q.k==='bureau_portal');p.open=walkView.t-{ms};return 0}})()")
            pg.evaluate("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))")
            pg.screenshot(path=str(OUT / f'portal-{n + 1}.png'))
            print(f'portal-{n + 1}', flush=True)
        pg.evaluate("environment.force={time:21.5,weather:'clear'};0")
        settle(pg, 20)
        pg.screenshot(path=str(OUT / 'portal-night.png'))
        print('portal-night', flush=True)
        pg.evaluate('delete walkView.opt.look')
        sheets(pg)
        ctx.close(); b.close()
    srv.shutdown()
    print('errors:', errs[:6])


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Where the interface sits on a portrait phone, a 16:9 desktop and a 21:9 ultrawide screen (the owner, 2026-10-30:
"make sure the interface is reactive and looks correct on portrait phone, widescreen and ultrawide, especially the
placing"). Counted from the page's own boxes, not pictures.

    python3 tools/check-placing.py              # every size
    python3 tools/check-placing.py --shots      # and a picture of each screen at each size in validation/placing/
    python3 tools/check-placing.py --only=360,3440   # only the sizes whose names hold these

One page (Copperleaf, ?fixture=town) is resized from size to size without reloading, so the layout must follow a
resize (a phone turned, a window dragged). At each size, for the walk, Team, Bag, Guide, Trainer, Settings and a
battle:
- the page can't slide sideways (a scroll to the side stays at 0) and the bars are inside the screen;
- on a wide screen (the owner's answer) the top bar, the bottom bar, the Actions button, the side panel, a window and
  the battle's cards sit inside the centred 16:9 area (--hud-w, --hud-x in base.css), with 2 px of slack;
- the side panel and the bottom bar don't overlap; the battle's cards don't cover the fighters' frame;
- the walk's label band (walk-control.js safe) lies between the top bar and the bottom bar.
Exit status 1 when a gate fails."""
import sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import browser_check as CF  # noqa: E402

SIZES = [('phone 360x740', 360, 740), ('phone 390x844', 390, 844), ('phone 430x932', 430, 932),
         ('16:9 1366x768', 1366, 768), ('16:9 1920x1080', 1920, 1080), ('16:9 2560x1440', 2560, 1440),
         ('21:9 2560x1080', 2560, 1080), ('21:9 3440x1440', 3440, 1440)]
SHOTS = '--shots' in sys.argv
OUT = ROOT / 'validation' / 'placing'

# every box the gates read, in CSS pixels, and the 16:9 area
BOXES = """(()=>{const r=e=>{if(!e)return null;const b=e.getBoundingClientRect();return b.width&&b.height?[b.left,b.top,b.right,b.bottom]:null};
const cs=getComputedStyle(document.documentElement),W=innerWidth,H=innerHeight,hw=Math.min(W,H*16/9);
const se=document.scrollingElement;se.scrollLeft=40;const sx0=se.scrollLeft;se.scrollLeft=0;
/* by hand: a root that clips (overflow-x clip or hidden) can't be slid by a finger or a wheel, only by a script */
const sx=['clip','hidden'].includes(getComputedStyle(document.documentElement).overflowX)?0:sx0;
return {W,H,sx,sx0,area:[(W-hw)/2,0,(W+hw)/2,H],
top:r(document.querySelector('#app .topbar')),nav:r(document.querySelector('pb-nav-bar#nav:not([hidden])')),
acts:r(document.querySelector('.wh-foot > *')),app:r(document.getElementById('app')),
sheet:r(document.querySelector('#ov .sheet')),cards:[r(document.getElementById('acts')),r(document.getElementById('msg'))].filter(Boolean),
frame:typeof battleStage!=='undefined'&&battleStage.L&&battleStage.L.beside?[battleStage.L.fx,battleStage.L.fy,battleStage.L.fx+battleStage.L.fw,battleStage.L.fy+battleStage.L.fh]:null,
band:walkView.opt&&walkView.opt.safe?walkView.opt.safe():null,wide:matchMedia('(min-width: 960px) and (orientation: landscape)').matches}})()"""


def inside(b, a, slack=2):
    return b is None or (b[0] >= a[0] - slack and b[2] <= a[2] + slack)


def overlap(a, b):
    return bool(a and b) and a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]


def main():
    from playwright.sync_api import sync_playwright
    srv, base = CF.serve(CF.GAME)
    errs, fails, notes = [], [], []
    if SHOTS: OUT.mkdir(parents=True, exist_ok=True)

    def gate(ok, what):
        (notes if ok else fails).append(('ok   ' if ok else 'FAIL ') + what)

    with sync_playwright() as pw:
        b = pw.chromium.launch(args=CF.LAUNCH)
        # half the device pixels: the same CSS layout, a quarter of the drawing on the big screens
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=0.5)
        for s in (CF.CLOCK, CF.NO_ACCOUNTS, CF.TEST_GLOBALS, CF.LOW_GRAPHICS): ctx.add_init_script(s)
        ctx.set_default_timeout(240000)
        pg = ctx.new_page(); CF.collect_errors(pg, errs)
        pg.goto(base + '/index.html?fixture=town')
        CF.until(pg, "typeof walkView!=='undefined'&&walkView.ready&&walkRenderer.on", 240); CF.drawing(pg)
        pg.evaluate("if(typeof postcardState!=='undefined')postcardState.on=true;0")

        def settle():
            CF.until(pg, "document.getAnimations().every(a=>a.playState!=='running'||!isFinite(a.effect.getComputedTiming().endTime))", 20)
            time.sleep(0.3)

        only = [a.split('=', 1)[1] for a in sys.argv if a.startswith('--only=')]
        for label, w, h in [z for z in SIZES if not only or any(o in z[0] for o in only[0].split(','))]:
            pg.set_viewport_size({'width': w, 'height': h})
            tag = label.split()[1]

            def look(scr, js):
                pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();" + js + ";0"); settle()
                if scr == 'walk': CF.frames(pg, 2)
                B = pg.evaluate(BOXES)
                if SHOTS: pg.screenshot(path=str(OUT / f'{tag}-{scr}.png'))
                return B

            B = look('walk', "uiState.tab='walk';render()")
            A = B['area']
            gate(B['sx'] == 0, f'{label} walk: the page doesn\'t slide sideways (scrolled {B["sx"]} px of 40)')
            gate(inside(B['top'], A) and inside(B['nav'], A) and inside(B['acts'], A), f'{label} walk: top bar, bottom bar and Actions inside the centred 16:9 area {[round(x) for x in A[::2]]}: {B["top"] and [round(x) for x in B["top"][::2]]}, {B["nav"] and [round(x) for x in B["nav"][::2]]}')
            if B['band'] and B['top'] and B['nav']:
                t, n = B['band'][0] * B['H'], B['band'][1] * B['H']
                gate(t >= B['top'][3] - 2 and n <= B['nav'][1] + 2, f'{label} walk: the label band {round(t)}-{round(n)} px lies between the top bar ({round(B["top"][3])}) and the bottom bar ({round(B["nav"][1])})')
            for scr in ['team', 'bag', 'guide', 'profile']:
                B = look(scr, f"uiState.tab='{scr}';render()")
                gate(B['sx'] == 0, f'{label} {scr}: the page doesn\'t slide sideways (scrolled {B["sx"]} px of 40)')
                if B['wide']:
                    gate(inside(B['app'], A), f'{label} {scr}: the side panel inside the centred 16:9 area ({[round(x) for x in B["app"][::2]]} in {[round(x) for x in A[::2]]})')
                    gate(not overlap(B['app'], B['nav']), f'{label} {scr}: the side panel and the bottom bar apart ({B["app"] and round(B["app"][0])} vs {B["nav"] and round(B["nav"][2])})')
                else:
                    gate(B['app'] is None or (B['app'][0] >= -1 and B['app'][2] <= B['W'] + 1), f'{label} {scr}: the screen within the screen\'s width')
            B = look('settings', "uiState.tab='walk';render();openSettings('graphics')")
            gate(B['sheet'] is not None and B['sheet'][0] >= -1 and B['sheet'][2] <= B['W'] + 1 and inside(B['sheet'], A), f'{label} settings: the window inside the screen and the 16:9 area ({B["sheet"] and [round(x) for x in B["sheet"][::2]]})')
            pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();uiState.tab='walk';render();const q={id:'placing',sp:'swift1',lvl:8,no:1};encountersHere().splice(0,1e9,q);saveData.team.forEach(m=>{m.hp=maxHp(m)});startWild(q);0")
            CF.until(pg, "activeBattle&&activeBattle.phase==='choose'&&battleStage.gl&&battleStage.L", 120, "activeBattle&&activeBattle.phase==='playing'&&tapMessage()")
            settle(); time.sleep(1)
            B = pg.evaluate(BOXES)
            if SHOTS: pg.screenshot(path=str(OUT / f'{tag}-battle.png'))
            gate(B['sx'] == 0 and all(c[0] >= -1 and c[2] <= B['W'] + 1 and c[3] <= B['H'] + 1 for c in B['cards']), f'{label} battle: the cards on screen ({[[round(x) for x in c] for c in B["cards"]]})')
            if B['wide']:
                gate(all(inside(c, A) for c in B['cards']), f'{label} battle: the cards inside the centred 16:9 area')
                gate(not any(overlap(c, B['frame']) for c in B['cards']), f'{label} battle: the cards beside the fighters, not over them (frame {B["frame"] and [round(x) for x in B["frame"]]})')
            pg.evaluate("stopTimers();activeBattle=null;battleStageStop();render();0")
            print(label, 'done', flush=True)
        b.close()
    srv.shutdown()
    bad = [e for e in errs if 'is in legacy' not in e]
    if bad: fails.append('FAIL page errors: ' + '; '.join(bad[:5]))
    for line in notes + fails: print(line)
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()

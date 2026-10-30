#!/usr/bin/env python3
"""FL-6's headless gates (docs/phases/fluid-track.md): the fluid UI, counted (not timed: a headless browser draws in
software, so milliseconds are notes only).

    python3 tools/check-fluid-ui.py

Opens Copperleaf (?fixture=town) on a phone-sized touch page (so the phone rules apply) and checks:
- the world frozen behind a full screen and a window: its clock doesn't move, and its still picture is drawn again
  every 2 s (walkView.still, cap 0.5: a canvas left idle stalled the page's frames once it closed); at most 3 frames
  come in 5 s; a window that asks for the world (modal({world: true})) keeps 20;
- no filter transition on the 3D canvas (#dio), the dim a layer (body::after) behind a screen;
- while walking on a phone the two bars have no backdrop blur (uiBlurCount with and without them is the same);
- the minimap's picture is moved by transform between its pictures (minimapPan), you and north on their own layer;
- a new screen's rows come in only where they start on screen (the Guide's ledger);
- Bag and Settings taps change the screen in place (the same screen and sheet elements after a tap) and each tap is
  in the debug log's taps (Event Timing: touch to paint);
- battle frames: at most 1 layout and 1 style recalculation a frame (CDP Performance counters, over the choosing
  phase's frames), the plates placed after the frame's work.
Exit status 1 when a gate fails."""
import sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import browser_check as CF  # noqa: E402

# counts the page's animation frames (rAF ticks) for the battle's per-frame counters
TICKS = "(()=>{if(window.__ticks)return 0;window.__ticks={n:0};const f=()=>{window.__ticks.n++;requestAnimationFrame(f)};requestAnimationFrame(f);return 0})()"


def main():
    from playwright.sync_api import sync_playwright
    srv, base = CF.serve(CF.GAME)
    errs, fails, notes = [], [], []

    def gate(ok, what):
        (notes if ok else fails).append(('ok   ' if ok else 'FAIL ') + what)

    def frames_in(pg, sec):
        f0 = pg.evaluate('walkRenderer.frames')
        time.sleep(sec)
        return pg.evaluate('walkRenderer.frames') - f0

    with sync_playwright() as pw:
        b = pw.chromium.launch(args=CF.LAUNCH)
        ctx, pg = CF.new_page(b, errs, width=390, height=844, mobile=True)
        ctx.set_default_timeout(240000)
        pg.goto(base + '/index.html?fixture=town')
        CF.drawing(pg)
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();uiState.tab='walk';render();0")
        CF.frames(pg, 3)

        # the bars while walking on a phone: tinted, no blur
        on_walk = pg.evaluate("document.body.classList.contains('on-walk')")
        blur, blur_all = pg.evaluate('uiBlurCount({bars:false})'), pg.evaluate('uiBlurCount()')
        gate(on_walk and blur_all == blur, f'blurred surfaces in the bars while walking on a phone: {blur_all - blur} (0; on-walk {on_walk})')

        # the minimap: panned by transform between pictures, you and north on the still layer
        mm = pg.evaluate("(()=>{const ok=minimapDraw();const A=minimap.at;if(!A)return [ok,null];A.x=walkView.pl.x+1;minimap.pan='';minimapPan();const t=minimap.cv.style.transform;return [ok,t,!!(minimap.you&&minimap.you.isConnected)]})()")
        gate(bool(mm[1]) and 'translate' in mm[1] and mm[2], f'the minimap moved by transform under you, you on your own layer: {mm}')

        # behind a full screen: frozen
        pg.evaluate("uiState.tab='team';render();0")
        cap = pg.evaluate('walkView.opt.cap()')
        gate(cap <= 0.5 and pg.evaluate('!!walkView.still'), f'the 3D cap behind a screen: {cap} (0.5, a still picture)')
        tr = pg.evaluate("getComputedStyle(document.getElementById('dio')).transitionProperty")
        gate('filter' not in tr, f'no filter transition on the 3D canvas: {tr}')
        CF.until(pg, "getComputedStyle(document.body,'::after').opacity==='0.18'", 5)
        dim = pg.evaluate("getComputedStyle(document.body,'::after').opacity")
        gate(abs(float(dim) - 0.18) < 0.01, f'the dim layer behind a screen: opacity {dim} (0.18 once faded)')
        t0 = pg.evaluate('walkView.t')
        n = frames_in(pg, 5)
        gate(n <= 3 and pg.evaluate('walkView.t') - t0 < 1, f'frames drawn in 5 s behind a screen: {n} (at most 3), the world clock {pg.evaluate("walkView.t") - t0:.0f} ms on (0)')
        pg.evaluate("uiState.tab='walk';render();0")
        CF.frames(pg, 2)

        # behind a window: frozen; a window that asks for the world keeps 20
        pg.evaluate("modal({title:'check',html:'<p>check</p>'});0")
        cap = pg.evaluate('walkView.opt.cap()')
        gate(cap <= 0.5 and pg.evaluate('!!walkView.still'), f'the 3D cap behind a window: {cap} (0.5, a still picture)')
        t0 = pg.evaluate('walkView.t')
        n = frames_in(pg, 5)
        gate(n <= 3 and pg.evaluate('walkView.t') - t0 < 1, f'frames drawn in 5 s behind a window: {n} (at most 3), the world clock {pg.evaluate("walkView.t") - t0:.0f} ms on (0)')
        # after 16 s frozen, the page's frames come back at once (a canvas left idle stalled them about as long)
        time.sleep(11)
        pg.evaluate("window.__g=[];let p=performance.now();const f=()=>{const n=performance.now();window.__g.push(n-p);p=n;if(window.__g.length<12)requestAnimationFrame(f)};requestAnimationFrame(f);uiState.modal=null;uiState.mq=[];renderOverlay();0")
        time.sleep(15)
        g = pg.evaluate('window.__g')
        gate(len(g) >= 8 and max(g) < 5000, f'frames after a 16 s window: {len(g)} in 15 s, the longest gap {max(g) if g else 0:.0f} ms (under 5 s; software drawing)')
        pg.evaluate("modal({title:'check',html:'<p>check</p>'});0")
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();modal({title:'check',world:true,html:'<p>check</p>'});0")
        cap = pg.evaluate('walkView.opt.cap()')
        gate(cap == 20, f'a window that asks for the world: cap {cap} (20)')
        pg.evaluate('uiState.modal=null;uiState.mq=[];renderOverlay();0')
        CF.frames(pg, 2)

        # the Guide: rows come in only where they start on screen
        pg.evaluate("uiState.tab='guide';render();0")
        g = pg.evaluate("(()=>{const r=[...document.querySelectorAll('#app .m-enter')].map(e=>e.getBoundingClientRect());return [r.length,r.filter(b=>b.top>=innerHeight||b.bottom<=0).length,document.querySelectorAll('#app .lrow').length]})()")
        gate(g[0] > 0 and g[1] == 0, f'rows coming in on the Guide: {g[0]}, off screen among them {g[1]} (0), rows in all {g[2]}')

        # Bag: a pocket tap changes the screen in place, and the tap is logged
        w = pg.evaluate("uiState.modal?uiState.modal.title:''")
        if w: notes.append(f'note a window was open before the Bag: {w} (closed)')
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();uiState.tab='bag';uiState.bagP='heal';render();window.__sc=document.querySelector('#app > .screen');0")
        time.sleep(1)
        pg.click('[data-a="bag-p"][data-p="pyramids"]')
        time.sleep(1.5)
        same = pg.evaluate("document.querySelector('#app > .screen')===window.__sc&&uiState.bagP==='pyramids'")
        gate(same, 'a Bag pocket tap changes the screen in place (the same screen element)')
        U = pg.evaluate("debugLog.uiReport()")
        bag = [r for r in U['paint']['last'] if r[2] == 'bag']
        slow = [r for r in U['taps']['last'] if r[3] == 'bag']
        gate(len(bag) >= 1, f"the Bag tap's click to paint in the debug log: {bag[-1] if bag else None} (over 16 ms in Event Timing: {slow[-1:] or 'none'})")

        # Settings: a tab tap changes the sheet in place, and the tap is logged
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();openSettings('sound');window.__sh=document.querySelector('#ov .sheet');0")
        time.sleep(1)
        pg.click('[data-a="set-tab"][data-k="access"]' if pg.query_selector('[data-a="set-tab"][data-k="access"]') else '[data-a="set-tab"]:not(.on)')
        time.sleep(1.5)
        same = pg.evaluate("document.querySelector('#ov .sheet')===window.__sh")
        gate(same, 'a Settings tab tap changes the sheet in place (the same sheet element)')
        U = pg.evaluate("debugLog.uiReport()")
        st = [r for r in U['paint']['last'] if r[2] == 'settings']
        slow = [r for r in U['taps']['last'] if r[3] == 'settings']
        gate(len(st) >= 1, f"the Settings tap's click to paint in the debug log: {st[-1] if st else None} (Event Timing: {slow[-1:] or 'none'})")
        for r in (bag[-1:] + st[-1:]): notes.append(f'note click to paint {r[2]} {r[3]}: {r[1]} ms (software drawing)')
        pg.evaluate("closeModal();uiState.tab='walk';render();0")
        CF.frames(pg, 2)

        # a battle: layouts and style recalculations a frame while choosing
        pg.evaluate("const q={id:'flcheck',sp:'swift1',lvl:8,no:1};encountersHere().splice(0,1e9,q);saveData.team.forEach(m=>{m.hp=maxHp(m)});startWild(q);0")
        CF.until(pg, "activeBattle&&activeBattle.phase==='choose'&&typeof battleStage!=='undefined'&&battleStage.gl", 120, "activeBattle&&activeBattle.phase==='playing'&&tapMessage()")
        time.sleep(3)
        pg.evaluate(TICKS)
        cdp = ctx.new_cdp_session(pg)
        cdp.send('Performance.enable')

        def metrics():
            m = {x['name']: x['value'] for x in cdp.send('Performance.getMetrics')['metrics']}
            return m.get('LayoutCount', 0), m.get('RecalcStyleCount', 0)
        t0, (l0, s0) = pg.evaluate('window.__ticks.n'), metrics()
        time.sleep(12)
        t1, (l1, s1) = pg.evaluate('window.__ticks.n'), metrics()
        nf = max(1, t1 - t0)
        ph = pg.evaluate("activeBattle?activeBattle.phase:'none'")
        gate(ph == 'choose', f'the battle stayed in its choosing phase while measured: {ph}')
        # one more than the frames: the two readings fall mid-frame
        gate((l1 - l0) <= nf + 1, f'layouts a battle frame: {(l1 - l0) / nf:.2f} ({l1 - l0} in {nf} frames; at most 1)')
        # and one more: a hit's or an idle step's full-screen flash forces one pass (battle-stage.js battleStageFlash's
        # void offsetWidth, kept: tools/flash-audit.py reads the flash from those style changes)
        gate((s1 - s0) <= nf + 2, f'style recalculations a battle frame: {(s1 - s0) / nf:.2f} ({s1 - s0} in {nf} frames; at most 1)')
        pl = pg.evaluate("[...document.querySelectorAll('#plates .bplate:not(.off)')].map(e=>e.style.transform).filter(Boolean).length")
        gate(pl >= 1, f'plates placed (after the frame task): {pl}')
        fill = pg.evaluate("(()=>{const f=document.querySelector('#plates .pl-hp .fill');return f?[f.style.getPropertyValue('--p'),getComputedStyle(f).transform]:null})()")
        gate(bool(fill) and fill[0].endswith('%'), f'the HP fill moved by transform (--p): {fill}')
        pg.evaluate("stopTimers();activeBattle=null;battleStageStop();render();0")
        b.close()
    srv.shutdown()
    bad = [e for e in errs if 'is in legacy' not in e]
    if bad: fails.append('FAIL page errors: ' + '; '.join(bad[:5]))
    for line in notes + fails: print(line)
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
